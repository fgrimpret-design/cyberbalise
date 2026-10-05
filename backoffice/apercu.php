<?php
declare(strict_types=1);
/* Aperçu d'un brouillon (rangé hors du site) : réservé aux membres connectés. */
require __DIR__ . '/inc/bootstrap.php';
require __DIR__ . '/inc/pages.php';
require_login();
$f = (string)($_GET['f'] ?? '');
if (!page_name_ok($f) || !is_file($p = page_path($f))) { http_response_code(404); exit('Page introuvable.'); }
header('X-Robots-Tag: noindex');
header("Content-Security-Policy: frame-ancestors 'self'");
$src = (string)file_get_contents($p);
$src = preg_replace('~\s*<script[^>]*data-cr-mesure[^>]*></script>~i', '', $src);
$bar = '<div style="position:fixed;bottom:14px;left:50%;transform:translateX(-50%);background:#E4572E;color:#fff;font:600 13px Archivo,sans-serif;padding:8px 16px;border-radius:99px;z-index:99999;box-shadow:0 4px 14px rgba(0,0,0,.2)">' . (is_draft($f) ? 'Brouillon — non visible du public' : 'Aperçu') . '</div>';
echo preg_replace('~</body>~i', $bar . '</body>', $src, 1);
