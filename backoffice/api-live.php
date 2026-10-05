<?php
declare(strict_types=1);
require __DIR__ . '/inc/bootstrap.php';
require __DIR__ . '/inc/stats.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
if (!current_user()) { http_response_code(401); exit('{}'); }
echo json_encode(['n' => live_visitors(), 'pages' => live_pages()]);
