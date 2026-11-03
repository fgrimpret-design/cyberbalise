<?php
/* Liste de diffusion de la newsletter CyberBalise : inscription avec double opt-in, désinscription, export.
   Aucun service tiers : les adresses sont stockées dans la base du back office (cr_newsletter)
   et les e-mails de confirmation partent du serveur du site. */
declare(strict_types=1);

function nl_cfg(): array {
    return (array)cfg('newsletter', []) + [
        'enabled'   => true,
        'from'      => 'contact@cyberbalise.fr',
        'from_name' => 'CyberBalise',
        'transport' => 'mail',   // 'mail' = fonction mail() de PHP ; 'log' = écrit dans data/newsletter-mails.log (tests locaux)
        'pending_days' => 7,     // les inscriptions non confirmées sont supprimées après ce délai
    ];
}

function nl_table(): void {
    static $done = false;
    if ($done) return;
    $mysql = (cfg('db', ['driver' => 'sqlite'])['driver'] ?? 'sqlite') === 'mysql';
    $pk = $mysql ? 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
    $eng = $mysql ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4' : '';
    db()->exec("CREATE TABLE IF NOT EXISTS cr_newsletter (
        id $pk, email VARCHAR(190) NOT NULL UNIQUE, status VARCHAR(12) NOT NULL DEFAULT 'pending',
        tok_confirm CHAR(40) NOT NULL, tok_unsub CHAR(40) NOT NULL, source VARCHAR(40) NOT NULL DEFAULT '',
        created_at INT NOT NULL, confirmed_at INT NOT NULL DEFAULT 0, unsub_at INT NOT NULL DEFAULT 0,
        last_sent INT NOT NULL DEFAULT 0, ip_hash CHAR(12) NOT NULL DEFAULT '')$eng");
    $done = true;
}

function nl_link(string $action, string $token): string {
    return rtrim((string)cfg('site_url'), '/') . BASE_URL . '/newsletter.php?a=' . $action . '&t=' . $token;
}

function nl_mail_header_subject(string $s): string {
    return '=?UTF-8?B?' . base64_encode($s) . '?=';
}

/* Envoie un e-mail texte. Retourne false en cas d'échec. */
function nl_send(string $to, string $subject, string $body): bool {
    $c = nl_cfg();
    if ($c['transport'] === 'log') {
        return @file_put_contents(DATA_DIR . '/newsletter-mails.log', "--- " . date('c') . " → $to\nSujet : $subject\n$body\n\n", FILE_APPEND | LOCK_EX) !== false;
    }
    $from = '"' . str_replace(['"', "\r", "\n"], '', (string)$c['from_name']) . '" <' . $c['from'] . '>';
    $headers = "From: $from\r\nReply-To: {$c['from']}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\nX-Mailer: CyberBalise";
    return @mail($to, nl_mail_header_subject($subject), str_replace("\n", "\r\n", $body), $headers, '-f' . $c['from']);
}

function nl_send_confirmation(array $row): bool {
    $body = "Bonjour,\n\n"
        . "Vous avez demandé à recevoir la newsletter de CyberBalise : tous les 15 jours, les actualités, les guides et les outils au meilleur prix.\n\n"
        . "Pour confirmer votre inscription, cliquez sur ce lien :\n" . nl_link('confirm', $row['tok_confirm']) . "\n\n"
        . "Si vous n'êtes pas à l'origine de cette demande, ignorez simplement ce message : vous ne recevrez rien et l'adresse sera supprimée sous quelques jours.\n\n"
        . "CyberBalise — " . cfg('site_url') . "\n";
    return nl_send($row['email'], "Confirmez votre inscription à la newsletter CyberBalise", $body);
}

/* Limite le nombre de demandes par visiteur et par heure. */
function nl_rate_ok(): bool {
    $key = sys_get_temp_dir() . '/crnl_' . substr(hash('sha256', secret() . client_ip()), 0, 16) . '_' . intdiv(time(), 3600);
    $n = (int)@file_get_contents($key);
    if ($n >= 6) return false;
    @file_put_contents($key, (string)($n + 1));
    return true;
}

/* Inscription : retourne true si la demande est acceptée (même si l'adresse était déjà inscrite). */
function nl_subscribe(string $email, string $source): bool {
    nl_table();
    $pdo = db(); $now = time();
    $st = $pdo->prepare('SELECT * FROM cr_newsletter WHERE email = ?'); $st->execute([$email]);
    $row = $st->fetch();
    if ($row && $row['status'] === 'confirmed') return true;                 // déjà inscrit : rien à envoyer
    if ($row && $row['status'] === 'pending' && $now - (int)$row['last_sent'] < 600) return true; // déjà envoyé il y a moins de 10 min
    $ip = substr(hash('sha256', secret() . client_ip()), 0, 12);
    if (!$row) {
        $row = ['email' => $email, 'status' => 'pending', 'tok_confirm' => bin2hex(random_bytes(20)), 'tok_unsub' => bin2hex(random_bytes(20))];
        $pdo->prepare('INSERT INTO cr_newsletter (email, status, tok_confirm, tok_unsub, source, created_at, ip_hash) VALUES (?,?,?,?,?,?,?)')
            ->execute([$email, 'pending', $row['tok_confirm'], $row['tok_unsub'], substr($source, 0, 40), $now, $ip]);
    } elseif ($row['status'] === 'unsubscribed') {
        $row['tok_confirm'] = bin2hex(random_bytes(20));
        $pdo->prepare("UPDATE cr_newsletter SET status='pending', tok_confirm=?, source=?, created_at=?, confirmed_at=0, unsub_at=0, ip_hash=? WHERE id=?")
            ->execute([$row['tok_confirm'], substr($source, 0, 40), $now, $ip, $row['id']]);
    }
    if (!nl_send_confirmation($row)) return false;
    $pdo->prepare('UPDATE cr_newsletter SET last_sent = ? WHERE email = ?')->execute([$now, $email]);
    if (random_int(1, 40) === 1) {
        $pdo->prepare("DELETE FROM cr_newsletter WHERE status = 'pending' AND created_at < ?")
            ->execute([$now - max(1, (int)nl_cfg()['pending_days']) * 86400]);
    }
    return true;
}

function nl_confirm(string $token): bool {
    nl_table();
    if (!preg_match('/^[a-f0-9]{40}$/', $token)) return false;
    $st = db()->prepare("UPDATE cr_newsletter SET status='confirmed', confirmed_at=? WHERE tok_confirm=? AND status IN ('pending','confirmed')");
    $st->execute([time(), $token]);
    if ($st->rowCount() > 0) return true;
    $c = db()->prepare("SELECT COUNT(*) FROM cr_newsletter WHERE tok_confirm=? AND status='confirmed'"); $c->execute([$token]);
    return (int)$c->fetchColumn() > 0;
}

function nl_unsubscribe(string $token): bool {
    nl_table();
    if (!preg_match('/^[a-f0-9]{40}$/', $token)) return false;
    $st = db()->prepare("SELECT id FROM cr_newsletter WHERE tok_unsub=?"); $st->execute([$token]);
    if (!$st->fetchColumn()) return false;
    db()->prepare("UPDATE cr_newsletter SET status='unsubscribed', unsub_at=? WHERE tok_unsub=?")->execute([time(), $token]);
    return true;
}

/* Page publique minimale (confirmation, désinscription). */
function nl_page(string $title, string $html, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: text/html; charset=UTF-8');
    header('Cache-Control: no-store');
    header('X-Robots-Tag: noindex, nofollow');
    header('Referrer-Policy: no-referrer');
    echo '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">'
        . '<title>' . e($title) . ' — CyberBalise</title><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/fonts/fonts.css">'
        . '<style>body{margin:0;background:#EDF1F6;color:#132232;font:17px/1.6 "Source Serif 4",Georgia,serif}main{max-width:560px;margin:8vh auto;padding:28px;background:#fff;border-radius:18px;box-shadow:0 8px 28px rgba(15,36,56,.08)}'
        . 'h1{font:800 1.6rem "Archivo",system-ui,sans-serif;margin:0 0 .5em}a{color:#0B545C}.btn{display:inline-block;margin-top:8px;padding:.8em 1.4em;border:0;border-radius:12px;background:#187343;color:#fff;font:800 1rem "Archivo",system-ui,sans-serif;text-decoration:none;cursor:pointer}</style></head><body><main>'
        . '<h1>' . e($title) . '</h1>' . $html . '<p style="margin-top:22px"><a href="/">← Retour sur CyberBalise</a></p></main></body></html>';
    exit;
}
