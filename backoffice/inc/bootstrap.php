<?php
declare(strict_types=1);

$GLOBALS['CR_CFG'] = require __DIR__ . '/../config.php';
date_default_timezone_set($GLOBALS['CR_CFG']['timezone'] ?? 'Europe/Paris');

define('BO_DIR', realpath(__DIR__ . '/..'));
define('SITE_ROOT', rtrim((string)realpath($GLOBALS['CR_CFG']['site_root']), '/'));
define('DATA_DIR', rtrim($GLOBALS['CR_CFG']['data_dir'], '/'));
define('BASE_URL', rtrim($GLOBALS['CR_CFG']['base_url'], '/'));

foreach ([DATA_DIR, DATA_DIR . '/versions', DATA_DIR . '/corbeille'] as $d) {
    if (!is_dir($d)) @mkdir($d, 0750, true);
}

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/db.php';

if (!defined('CR_NO_SESSION')) {
    header('X-Frame-Options: DENY');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: same-origin');
    header("Content-Security-Policy: frame-ancestors 'none'");
    session_name('CRBOSESS');
    session_set_cookie_params([
        'lifetime' => 0, 'path' => BASE_URL . '/', 'secure' => is_https(),
        'httponly' => true, 'samesite' => 'Strict',
    ]);
    session_start();
    // Expiration après 2 h d'inactivité
    if (!empty($_SESSION['uid']) && (time() - ($_SESSION['seen'] ?? 0)) > 7200) {
        $_SESSION = [];
        session_regenerate_id(true);
    }
    $_SESSION['seen'] = time();
}
