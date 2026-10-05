<?php
/* Point de collecte de la mesure d'audience. Répond toujours 204, ne pose aucun cookie. */
declare(strict_types=1);
define('CR_NO_SESSION', true);
require __DIR__ . '/inc/bootstrap.php';
header('Cache-Control: no-store');

function done(): void { http_response_code(204); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') done();
$st = settings();
if (empty($st['tracking'])) done();
if (preview_cookie_valid($_COOKIE['cr_apercu'] ?? null)) done();          // membres de l'équipe exclus

$ua = substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 400);
if ($ua === '' || preg_match('~bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|java/|go-http|scrapy|axios|node-fetch|httpclient|semrush|ahrefs|mj12|petal|bytespider|gptbot|claude|perplexity~i', $ua)) done();

$raw = file_get_contents('php://input', false, null, 0, 4096);
$in = json_decode((string)$raw, true);
if (!is_array($in) || empty($in['t']) || empty($in['id'])) done();

// Contrôle d'origine : on n'accepte que les requêtes venant du site
$origin = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? '';
$host = strtolower(preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? ''));
if ($origin !== '' && strtolower((string)parse_url($origin, PHP_URL_HOST)) !== $host) done();

$path = '/' . ltrim(substr((string)preg_replace('/[^\w\-.\/%~]/u', '', (string)($in['p'] ?? '/')), 0, 190), '/');
if (preg_match('~^/backoffice(/|$)~', $path)) done();
foreach ((array)($st['exclude_paths'] ?? []) as $ex) {
    if ($ex !== '' && str_starts_with($path, $ex)) done();
}
$pvid = substr(preg_replace('/[^a-z0-9]/', '', (string)$in['id']), 0, 32);
$now = time();
$day = date('Y-m-d', $now);
// Identifiant anonyme : empreinte quotidienne, non réversible, renouvelée chaque jour (aucun cookie, IP jamais stockée)
$visitor = substr(hash('sha256', secret() . '|' . $day . '|' . client_ip() . '|' . $ua), 0, 16);

// Anti-abus simple : 120 requêtes / minute max par visiteur
$rl = sys_get_temp_dir() . '/crrl_' . $visitor . '_' . intdiv($now, 60);
$c = (int)@file_get_contents($rl);
if ($c > 120) done();
@file_put_contents($rl, (string)($c + 1));

$pdo = db();
try {
    if ($in['t'] === 'pv') {
        $ref = (string)($in['r'] ?? '');
        $refHost = strtolower((string)parse_url($ref, PHP_URL_HOST));
        $refHost = preg_replace('/^www\./', '', $refHost);
        if ($refHost === preg_replace('/^www\./', '', $host)) $refHost = '';
        parse_str(ltrim((string)($in['q'] ?? ''), '?'), $q);
        $utmSrc = substr(strtolower(trim((string)($q['utm_source'] ?? ''))), 0, 60);
        $campaign = substr(trim((string)($q['utm_campaign'] ?? '')), 0, 80);
        $source = classify_source($refHost, $utmSrc, (string)($q['utm_medium'] ?? ''));
        [$device, $browser, $os] = parse_ua($ua, (int)($in['sw'] ?? 0));
        $lang = substr(strtolower(preg_replace('/[^a-zA-Z\-]/', '', (string)($in['l'] ?? ''))), 0, 2);
        $screen = (int)($in['sw'] ?? 0) . '×' . (int)($in['sh'] ?? 0);
        $pdo->prepare('INSERT INTO cr_hits (ts, day, hour, wd, path, visitor, pvid, ref_host, source, utm_campaign, device, browser, os, lang, screen)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
            ->execute([$now, $day, (int)date('G', $now), (int)date('N', $now), $path, $visitor, $pvid,
                       $utmSrc !== '' ? $utmSrc : substr($refHost, 0, 120), $source, $campaign, $device, $browser, $os, $lang, $screen]);
        // Purge automatique (1 fois sur 500)
        if (random_int(1, 500) === 1) {
            $lim = strtotime('-' . max(1, (int)$st['retention_months']) . ' months');
            $pdo->prepare('DELETE FROM cr_hits WHERE ts < ?')->execute([$lim]);
            $pdo->prepare('DELETE FROM cr_events WHERE ts < ?')->execute([$lim]);
            $pdo->prepare('DELETE FROM cr_attempts WHERE ts < ?')->execute([$now - 86400]);
        }
    } elseif ($in['t'] === 'd') {
        $sec = max(0, min(3600, (int)($in['s'] ?? 0)));
        $pdo->prepare('UPDATE cr_hits SET duration = ? WHERE pvid = ? AND visitor = ? AND ts > ?')
            ->execute([$sec, $pvid, $visitor, $now - 7200]);
    } elseif ($in['t'] === 'ev') {
        $name = substr(trim((string)($in['n'] ?? '')), 0, 60);
        if ($name !== '') {
            $pdo->prepare('INSERT INTO cr_events (ts, day, path, visitor, name, value) VALUES (?,?,?,?,?,?)')
                ->execute([$now, $day, $path, $visitor, $name, substr(trim((string)($in['v'] ?? '')), 0, 200)]);
        }
    }
} catch (Throwable $t) { /* silencieux */ }
done();

function classify_source(string $h, string $utm, string $medium): string {
    $x = $utm !== '' ? $utm : $h;
    $medium = strtolower($medium);
    if ($x === '') return 'Direct';
    if (in_array($medium, ['email', 'e-mail', 'newsletter'], true) || preg_match('~mail\.|newsletter|brevo|sendinblue|mailchimp|webmail|outlook\.live~', $x)) return 'E-mail';
    if (preg_match('~(^|\.)(google|bing|qwant|duckduckgo|ecosia|yahoo|yandex|baidu|lilo|startpage|brave)\.~', $x . '.')) return 'Moteurs de recherche';
    if (preg_match('~facebook|fb\.|instagram|linkedin|lnkd|twitter|t\.co|x\.com|tiktok|youtube|youtu\.be|reddit|pinterest|snapchat|whatsapp|telegram|threads|bsky|mastodon|discord~', $x)) return 'Réseaux sociaux';
    if (preg_match('~chatgpt|openai|perplexity|claude|gemini|copilot|mistral|genspark~', $x)) return 'Assistants IA';
    if ($medium === 'cpc' || $medium === 'paid') return 'Publicité';
    return 'Sites référents';
}

function parse_ua(string $ua, int $sw): array {
    $device = preg_match('~iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))~i', $ua) ? 'Tablette'
        : (preg_match('~Mobi|iPhone|iPod|Android|Windows Phone~i', $ua) ? 'Mobile' : 'Ordinateur');
    if ($device === 'Ordinateur' && $sw > 0 && $sw < 768) $device = 'Mobile';
    $browser = 'Autre';
    foreach (['Edg/' => 'Edge', 'OPR/' => 'Opera', 'SamsungBrowser' => 'Samsung Internet', 'Firefox/' => 'Firefox', 'FxiOS' => 'Firefox', 'CriOS' => 'Chrome', 'Chrome/' => 'Chrome', 'Safari/' => 'Safari'] as $k => $v) {
        if (stripos($ua, $k) !== false) { $browser = $v; break; }
    }
    $os = 'Autre';
    foreach (['Windows' => 'Windows', 'iPhone' => 'iOS', 'iPad' => 'iOS', 'Android' => 'Android', 'Mac OS X' => 'macOS', 'CrOS' => 'ChromeOS', 'Linux' => 'Linux'] as $k => $v) {
        if (stripos($ua, $k) !== false) { $os = $v; break; }
    }
    return [$device, $browser, $os];
}
