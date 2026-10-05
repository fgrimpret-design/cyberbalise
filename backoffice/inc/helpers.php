<?php
declare(strict_types=1);

function cfg(string $k, $def = null) { return $GLOBALS['CR_CFG'][$k] ?? $def; }
function e($s): string { return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function url(string $p = ''): string { return BASE_URL . '/' . ltrim($p, '/'); }
function redirect(string $to): void { header('Location: ' . $to); exit; }
function is_https(): bool {
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
}
function client_ip(): string {
    if (cfg('trust_proxy') && !empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        return trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
    }
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

/* ---------- Fichiers PHP de données (illisibles via HTTP même sans .htaccess) ---------- */
function php_data_read(string $name, array $def = []): array {
    $f = DATA_DIR . '/' . $name . '.php';
    if (!is_file($f)) return $def;
    $v = include $f;
    return is_array($v) ? $v + $def : $def;
}
function php_data_write(string $name, array $data): bool {
    return write_atomic(DATA_DIR . '/' . $name . '.php', "<?php\nreturn " . var_export($data, true) . ";\n");
}
function write_atomic(string $path, string $content): bool {
    $tmp = $path . '.tmp' . bin2hex(random_bytes(4));
    if (@file_put_contents($tmp, $content, LOCK_EX) === false) return false;
    if (!@rename($tmp, $path)) { @unlink($tmp); return false; }
    if (function_exists('opcache_invalidate')) @opcache_invalidate($path, true);
    return true;
}

function settings(): array {
    static $s;
    if ($s === null) {
        $s = php_data_read('settings', [
            'tracking' => true, 'respect_dnt' => false, 'retention_months' => 25,
            'exclude_paths' => [], 'sitemap_last' => null,
        ]);
    }
    return $s;
}
function save_settings(array $new): bool { return php_data_write('settings', $new + settings()); }

function secret(): string {
    $s = php_data_read('secret');
    if (empty($s['key'])) { $s = ['key' => bin2hex(random_bytes(32))]; php_data_write('secret', $s); }
    return $s['key'];
}

/* ---------- CSRF & messages ---------- */
function csrf_token(): string {
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(24));
    return $_SESSION['csrf'];
}
function csrf_field(): string { return '<input type="hidden" name="csrf" value="' . e(csrf_token()) . '">'; }
function csrf_check(): void {
    $t = $_POST['csrf'] ?? $_SERVER['HTTP_X_CSRF'] ?? '';
    if (!is_string($t) || !hash_equals($_SESSION['csrf'] ?? '', $t)) {
        http_response_code(400);
        exit('Jeton de sécurité expiré. Rechargez la page et recommencez.');
    }
}
function flash(string $type, string $msg): void { $_SESSION['flash'][] = [$type, $msg]; }
function flashes(): array { $f = $_SESSION['flash'] ?? []; unset($_SESSION['flash']); return $f; }

/* ---------- Authentification ---------- */
function current_user(): ?array {
    static $u = false;
    if ($u !== false) return $u;
    $u = null;
    if (!empty($_SESSION['uid'])) {
        $st = db()->prepare('SELECT * FROM cr_users WHERE id = ?');
        $st->execute([$_SESSION['uid']]);
        $u = $st->fetch() ?: null;
    }
    return $u;
}
function is_admin(): bool { return (current_user()['role'] ?? '') === 'admin'; }
function require_login(?string $role = null): array {
    $u = current_user();
    if (!$u) redirect(url('login.php?retour=' . urlencode($_SERVER['REQUEST_URI'] ?? '')));
    if ($role === 'admin' && $u['role'] !== 'admin') {
        http_response_code(403);
        require_once __DIR__ . '/layout.php';
        layout_start('Accès réservé', '');
        echo '<div class="card"><h2>Accès réservé aux administrateurs</h2><p class="muted">Demandez à un administrateur de modifier votre rôle si vous avez besoin de cette fonction.</p></div>';
        layout_end(); exit;
    }
    return $u;
}
function log_action(string $action, string $target = '', string $details = ''): void {
    try {
        db()->prepare('INSERT INTO cr_journal (ts, user_name, action, target, details, ip_hash) VALUES (?,?,?,?,?,?)')
            ->execute([time(), current_user()['name'] ?? 'système', $action, mb_substr($target, 0, 190), mb_substr($details, 0, 500),
                substr(hash('sha256', secret() . client_ip()), 0, 12)]);
    } catch (Throwable $t) { /* le journal ne doit jamais bloquer l'action */ }
}

/* Cookie d'aperçu : permet de voir les brouillons et exclut l'administrateur des statistiques */
function preview_cookie_set(int $uid): void {
    $exp = time() + 43200;
    $v = $uid . '.' . $exp . '.' . hash_hmac('sha256', $uid . '.' . $exp, secret());
    setcookie('cr_apercu', $v, ['expires' => $exp, 'path' => '/', 'secure' => is_https(), 'httponly' => true, 'samesite' => 'Lax']);
}
function preview_cookie_valid(?string $v): bool {
    if (!$v || substr_count($v, '.') !== 2) return false;
    [$uid, $exp, $sig] = explode('.', $v);
    return (int)$exp > time() && hash_equals(hash_hmac('sha256', $uid . '.' . $exp, secret()), $sig);
}

/* ---------- Divers ---------- */
function slugify(string $s): string {
    $s = mb_strtolower(trim($s));
    $s = strtr($s, ['à'=>'a','â'=>'a','ä'=>'a','á'=>'a','ã'=>'a','ç'=>'c','é'=>'e','è'=>'e','ê'=>'e','ë'=>'e','î'=>'i','ï'=>'i','í'=>'i','ô'=>'o','ö'=>'o','ó'=>'o','ù'=>'u','û'=>'u','ü'=>'u','ú'=>'u','ÿ'=>'y','ñ'=>'n','œ'=>'oe','æ'=>'ae','’'=>'-',"'"=>'-']);
    $s = preg_replace('/[^a-z0-9]+/', '-', $s);
    return trim(substr((string)$s, 0, 70), '-');
}
function fr_date(int $ts, bool $time = true): string {
    $m = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
    return date('j', $ts) . ' ' . $m[(int)date('n', $ts) - 1] . ' ' . date('Y', $ts) . ($time ? ' à ' . date('H:i', $ts) : '');
}
function fr_num($n, int $dec = 0): string { return number_format((float)$n, $dec, ',', "\u{202F}"); }
function human_size(int $b): string {
    if ($b < 1024) return $b . ' o';
    if ($b < 1048576) return fr_num($b / 1024, 0) . ' Ko';
    return fr_num($b / 1048576, 1) . ' Mo';
}
function duration_fmt(float $s): string {
    if ($s <= 0) return '—';
    $s = (int)round($s);
    return $s < 60 ? $s . ' s' : intdiv($s, 60) . ' min ' . str_pad((string)($s % 60), 2, '0', STR_PAD_LEFT);
}
