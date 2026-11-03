<?php
/* Point public de la newsletter CyberBalise : inscription (POST JSON), confirmation et désinscription (liens e-mail). */
declare(strict_types=1);
define('CR_NO_SESSION', true);
require __DIR__ . '/inc/bootstrap.php';
require __DIR__ . '/inc/newsletter.php';
header('X-Content-Type-Options: nosniff');

function json_out(int $code, array $data): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=UTF-8');
    header('Cache-Control: no-store');
    echo json_encode($data);
    exit;
}

$cfgNl = nl_cfg();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = (string)($_GET['a'] ?? $_POST['a'] ?? '');

/* ---- Liens reçus par e-mail ---- */
if ($method === 'GET' && $action === 'confirm') {
    nl_confirm((string)($_GET['t'] ?? ''))
        ? nl_page('Inscription confirmée', '<p>Merci ! Vous recevrez la newsletter de CyberBalise tous les 15 jours : actualités, guides et outils au meilleur prix.</p><p>Vous pouvez vous désinscrire à tout moment grâce au lien présent dans chaque e-mail.</p>')
        : nl_page('Lien invalide ou expiré', '<p>Ce lien de confirmation n\'est plus valable. Vous pouvez refaire une demande depuis le <a href="/outils/detecteur-arnaque/">détecteur d\'arnaque</a>.</p>', 410);
}
if ($action === 'unsub') {
    $t = (string)($_GET['t'] ?? $_POST['t'] ?? '');
    if ($method === 'POST') {
        nl_unsubscribe($t)
            ? nl_page('Vous êtes désinscrit(e)', '<p>Votre adresse ne recevra plus la newsletter CyberBalise. Vous pouvez vous réinscrire à tout moment.</p>')
            : nl_page('Lien invalide', '<p>Ce lien de désinscription n\'est pas valable. Écrivez-nous via la <a href="/contact/">page Contact</a> et nous supprimerons votre adresse.</p>', 400);
    }
    // Une confirmation est demandée : un lien ouvert par un antivirus ou une messagerie ne désinscrit personne.
    nl_page('Se désinscrire de la newsletter CyberBalise', '<p>Confirmez que vous ne souhaitez plus recevoir la newsletter CyberBalise.</p><form method="post" action=""><input type="hidden" name="a" value="unsub"><input type="hidden" name="t" value="' . e($t) . '"><button class="btn" type="submit">Me désinscrire</button></form>');
}

/* ---- Inscription depuis le site ---- */
if ($method !== 'POST') json_out(405, ['ok' => false]);
if (empty($cfgNl['enabled'])) json_out(503, ['ok' => false, 'error' => 'disabled']);

$origin = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? '';
$host = strtolower(preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? ''));
if ($origin !== '' && strtolower((string)parse_url($origin, PHP_URL_HOST)) !== $host) json_out(403, ['ok' => false]);

$raw = file_get_contents('php://input', false, null, 0, 4096);
$in = json_decode((string)$raw, true);
if (!is_array($in)) $in = $_POST;

if (!empty($in['website'])) json_out(200, ['ok' => true]);                       // champ piège : on fait semblant
$email = strtolower(trim((string)($in['email'] ?? '')));
if ($email === '' || strlen($email) > 190 || !filter_var($email, FILTER_VALIDATE_EMAIL)) json_out(422, ['ok' => false, 'error' => 'email']);
if (empty($in['consent'])) json_out(422, ['ok' => false, 'error' => 'consent']);
if (!nl_rate_ok()) json_out(429, ['ok' => false, 'error' => 'rate']);

try {
    $ok = nl_subscribe($email, preg_replace('/[^a-z0-9_\-]/i', '', (string)($in['source'] ?? '')));
} catch (Throwable $t) {
    error_log('CyberBalise newsletter : ' . $t->getMessage());
    $ok = false;
}
$ok ? json_out(200, ['ok' => true]) : json_out(500, ['ok' => false, 'error' => 'server']);
