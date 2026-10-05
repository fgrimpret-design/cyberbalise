<?php
declare(strict_types=1);
require __DIR__ . '/inc/bootstrap.php';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    log_action('Déconnexion');
    $_SESSION = [];
    session_destroy();
    setcookie('cr_apercu', '', ['expires' => time() - 3600, 'path' => '/']);
}
redirect(url('login.php'));
