<?php
declare(strict_types=1);
/*
 * Gestion des pages du site CyberBalise (site statique : un dossier = une page, ex. /particuliers/menaces/ -> particuliers/menaces/index.html).
 * Liste, lecture, écriture sûre, versions, corbeille, brouillons (hors ligne), mesure, menu centralisé, recherche, sitemap.
 */

const CB_MARK_START = '<!-- CB-CONTENU:DEBUT -->';
const CB_MARK_END   = '<!-- CB-CONTENU:FIN -->';
const CB_MENU_START = '<!-- CB-MENU:DEBUT -->';
const CB_MENU_END   = '<!-- CB-MENU:FIN -->';
const CB_MNAV_START = '<!-- CB-MNAV:DEBUT -->';
const CB_MNAV_END   = '<!-- CB-MNAV:FIN -->';
const CB_SKIP_DIRS  = ['backoffice', 'assets', 'uploads', 'cdn-cgi', '.well-known'];

function tracking_tag(): string {
    return '<script defer src="' . e(BASE_URL . '/t.js') . '" data-cr-mesure' . (!empty(settings()['respect_dnt']) ? ' data-dnt="1"' : '') . '></script>';
}
function drafts_dir(): string { return DATA_DIR . '/brouillons'; }

/* ---------- Identifiants de page ---------- */
/** Une page = chemin relatif à la racine : « index.html », « a-propos/index.html », « 404.html »… */
function page_name_ok(string $f): bool {
    if ($f === '' || str_contains($f, '..') || str_contains($f, '\\') || str_contains($f, '//')) return false;
    if (!preg_match('~^(?:[a-z0-9][a-z0-9_\-]*/)*[a-zA-Z0-9][a-zA-Z0-9_\-]*\.html$~', $f)) return false;
    $first = explode('/', $f)[0];
    return !in_array($first, CB_SKIP_DIRS, true);
}
function is_draft(string $f): bool { return page_name_ok($f) && is_file(drafts_dir() . '/' . $f); }
function site_path(string $f): string {
    if (!page_name_ok($f)) throw new RuntimeException('Nom de page invalide.');
    return SITE_ROOT . '/' . $f;
}
function draft_path(string $f): string {
    if (!page_name_ok($f)) throw new RuntimeException('Nom de page invalide.');
    return drafts_dir() . '/' . $f;
}
/** Emplacement actuel de la page (brouillon hors ligne, ou en ligne). */
function page_path(string $f): string { return is_draft($f) ? draft_path($f) : site_path($f); }
function page_exists(string $f): bool { return page_name_ok($f) && (is_file(site_path($f)) || is_file(draft_path($f))); }
function page_url_path(string $f): string {
    if ($f === 'index.html') return '/';
    if (str_ends_with($f, '/index.html')) return '/' . substr($f, 0, -strlen('index.html'));
    return '/' . $f;
}
function page_from_url(string $u): ?string {
    $u = '/' . ltrim((string)parse_url($u, PHP_URL_PATH), '/');
    $f = $u === '/' ? 'index.html' : (str_ends_with($u, '/') ? ltrim($u, '/') . 'index.html' : ltrim($u, '/'));
    return page_name_ok($f) ? $f : null;
}

function scan_html(string $root): array {
    $out = [];
    if (!is_dir($root)) return $out;
    $it = new RecursiveIteratorIterator(new RecursiveCallbackFilterIterator(
        new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS),
        function ($cur, $key, $iter) use ($root) {
            if ($iter->hasChildren()) {
                $rel = ltrim(substr($cur->getPathname(), strlen($root)), '/');
                return !in_array(explode('/', $rel)[0], CB_SKIP_DIRS, true);
            }
            return str_ends_with($cur->getFilename(), '.html');
        }));
    foreach ($it as $file) {
        $rel = ltrim(str_replace('\\', '/', substr($file->getPathname(), strlen($root))), '/');
        if (page_name_ok($rel)) $out[] = $rel;
    }
    return $out;
}

function list_pages(): array {
    $out = [];
    $files = array_fill_keys(scan_html(SITE_ROOT), false) + array_fill_keys(scan_html(drafts_dir()), true);
    foreach ($files as $f => $draft) {
        $p = $draft ? draft_path($f) : site_path($f);
        $src = (string)@file_get_contents($p);
        $out[] = [
            'file' => $f,
            'title' => page_h1($src) ?: (page_title($src) ?: $f),
            'desc' => page_desc($src),
            'size' => filesize($p),
            'mtime' => filemtime($p),
            'draft' => $draft,
            'tracked' => str_contains($src, 'data-cr-mesure'),
            'visual' => split_content($src) !== null,
            'menu' => str_contains($src, CB_MENU_START),
            'protected' => in_array($f, cfg('protected_files', []), true),
            'depth' => substr_count($f, '/'),
        ];
    }
    usort($out, fn($a, $b) => $a['file'] === 'index.html' ? -1 : ($b['file'] === 'index.html' ? 1 : strcmp(page_url_path($a['file']), page_url_path($b['file']))));
    return $out;
}
/** Dossiers pouvant accueillir une nouvelle page (rubriques existantes). */
function parent_choices(): array {
    $c = ['' => 'Racine du site  /'];
    foreach (list_pages() as $p) {
        if ($p['draft'] || !str_ends_with($p['file'], '/index.html')) continue;
        $c[substr($p['file'], 0, -strlen('index.html'))] = page_url_path($p['file']) . '  ·  ' . $p['title'];
    }
    return $c;
}

/* ---------- Lecture / écriture des métadonnées ---------- */
function page_title(string $src): string {
    return preg_match('~<title>(.*?)</title>~is', $src, $m) ? trim(html_entity_decode(strip_tags($m[1]), ENT_QUOTES, 'UTF-8')) : '';
}
function page_desc(string $src): string {
    return preg_match('~<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']~is', $src, $m) ? html_entity_decode($m[1], ENT_QUOTES, 'UTF-8') : '';
}
function page_h1(string $src): string {
    return preg_match('~<div class="pagehead">.*?<h1>(.*?)</h1>~is', $src, $m) ? trim(html_entity_decode(strip_tags($m[1]), ENT_QUOTES, 'UTF-8')) : '';
}
function page_lead(string $src): string {
    return preg_match('~</h1><p class="lead">(.*?)</p>~is', $src, $m) ? trim(html_entity_decode(strip_tags($m[1]), ENT_QUOTES, 'UTF-8')) : '';
}
function rx_val(string $s): string { return str_replace(['\\', '$'], ['\\\\', '\$'], $s); }
function set_head_meta(string $src, string $title, string $desc): string {
    $t = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
    $d = htmlspecialchars($desc, ENT_QUOTES, 'UTF-8');
    if ($title !== '') {
        $src = preg_replace('~<title>.*?</title>~is', '<title>' . rx_val($t) . '</title>', $src, 1);
        $short = htmlspecialchars(preg_replace('~\s+—\s+' . preg_quote(cfg('site_name'), '~') . '$~u', '', $title), ENT_QUOTES, 'UTF-8');
        $src = preg_replace('~<meta property="og:title" content="[^"]*">~', '<meta property="og:title" content="' . rx_val($short) . '">', $src, 1);
    }
    $src = preg_replace('~<meta name="description" content="[^"]*">~', '<meta name="description" content="' . rx_val($d) . '">', $src, 1);
    $src = preg_replace('~<meta property="og:description" content="[^"]*">~', '<meta property="og:description" content="' . rx_val($d) . '">', $src, 1);
    return $src;
}
/** Titre affiché (H1), chapô et date « Mise à jour » de l'en-tête de page. */
function set_pagehead(string $src, string $h1, string $lead, bool $touchDate): string {
    if ($h1 !== '') $src = preg_replace('~(<div class="pagehead">.*?<h1>).*?(</h1>)~is', '${1}' . rx_val(e($h1)) . '${2}', $src, 1);
    if ($lead !== '') $src = preg_replace('~(</h1><p class="lead">).*?(</p>)~is', '${1}' . rx_val(e($lead)) . '${2}', $src, 1);
    if ($touchDate) $src = preg_replace('~(<span class="date">Mise à jour : )[^<]*(</span>)~u', '${1}' . rx_val(fr_month_year()) . '${2}', $src, 1);
    return $src;
}
function fr_month_year(?int $ts = null): string {
    $m = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    $ts ??= time();
    return $m[(int)date('n', $ts) - 1] . ' ' . date('Y', $ts);
}

/** Zone modifiable en mode visuel : entre les repères CB-CONTENU, sans script. */
function split_content(string $src): ?array {
    $a = strpos($src, CB_MARK_START);
    $b = strpos($src, CB_MARK_END);
    if ($a === false || $b === false || $b <= $a) return null;
    $a += strlen(CB_MARK_START);
    $mid = substr($src, $a, $b - $a);
    if (stripos($mid, '<script') !== false || stripos($mid, '<style') !== false || str_contains($mid, '<?')) return null;
    return [substr($src, 0, $a), $mid, substr($src, $b), 'marqueurs'];
}
function check_code(string $code): ?string {
    if (str_contains($code, '<?php') || str_contains($code, '<?=')) return "Les pages du site sont en HTML statique : le code PHP n'y serait pas exécuté. Retirez-le";
    if (stripos($code, '</html>') === false) return 'La balise de fin </html> est absente : le fichier semble incomplet';
    return null;
}

/* ---------- Versions & corbeille (fichiers PHP inertes) ---------- */
function version_dir(string $f): string { return DATA_DIR . '/versions/' . preg_replace('/[^a-zA-Z0-9_\-.]/', '_', $f); }
function save_version(string $f, string $reason): void {
    $p = page_path($f);
    if (!is_file($p)) return;
    $d = version_dir($f);
    if (!is_dir($d)) @mkdir($d, 0750, true);
    $id = date('Ymd-His') . '-' . bin2hex(random_bytes(2));
    $data = ['ts' => time(), 'user' => current_user()['name'] ?? '?', 'reason' => $reason, 'size' => filesize($p), 'src' => base64_encode((string)file_get_contents($p))];
    write_atomic("$d/$id.php", "<?php\nreturn " . var_export($data, true) . ";\n");
    $all = glob("$d/*.php") ?: [];
    rsort($all);
    foreach (array_slice($all, 30) as $old) @unlink($old);
}
function list_versions(string $f): array {
    $out = [];
    foreach (glob(version_dir($f) . '/*.php') ?: [] as $p) {
        $v = include $p;
        if (is_array($v)) $out[] = ['id' => basename($p, '.php'), 'ts' => $v['ts'], 'user' => $v['user'], 'reason' => $v['reason'], 'size' => $v['size']];
    }
    usort($out, fn($a, $b) => $b['ts'] <=> $a['ts']);
    return $out;
}
function read_version(string $f, string $id): ?string {
    if (!preg_match('/^[0-9]{8}-[0-9]{6}-[a-f0-9]{4}$/', $id)) return null;
    $p = version_dir($f) . "/$id.php";
    if (!is_file($p)) return null;
    $v = include $p;
    return is_array($v) ? base64_decode($v['src']) : null;
}

function ensure_dir(string $file): void {
    $d = dirname($file);
    if (!is_dir($d) && !@mkdir($d, 0755, true)) throw new RuntimeException("Impossible de créer le dossier « " . basename($d) . " » (permissions).");
}
/** Écrit la page à son emplacement actuel (ou en ligne si $where = 'site', hors ligne si 'brouillon'). */
function write_page(string $f, string $src, string $reason, ?string $where = null, bool $version = true): void {
    $p = $where === 'site' ? site_path($f) : ($where === 'brouillon' ? draft_path($f) : page_path($f));
    if ($version && is_file($p)) save_version($f, $reason);
    ensure_dir($p);
    if (!write_atomic($p, $src)) throw new RuntimeException("Écriture impossible : vérifiez les permissions du fichier $f.");
    if ($where !== 'brouillon' && !is_draft($f)) maybe_sitemap();
}
function maybe_sitemap(): void { if (is_file(SITE_ROOT . '/sitemap.xml')) build_sitemap(); }
function remove_empty_dirs(string $file, string $root): void {
    $d = dirname($file);
    while (strlen($d) > strlen($root) && is_dir($d) && count(scandir($d)) === 2) { @rmdir($d); $d = dirname($d); }
}

/* ---------- Brouillon / publication : un brouillon est rangé hors du site (il n'existe pas pour le public) ---------- */
function publish_page(string $f): void {
    if (!is_draft($f)) return;
    if (is_file(site_path($f))) throw new RuntimeException("Une page en ligne existe déjà à l'adresse " . page_url_path($f) . '.');
    $src = (string)file_get_contents(draft_path($f));
    write_page($f, $src, 'Publication', 'site', false);
    @unlink(draft_path($f));
    remove_empty_dirs(draft_path($f), drafts_dir());
    search_index_add($f);
    maybe_sitemap();
}
function unpublish_page(string $f): void {
    if (is_draft($f)) return;
    if ($f === 'index.html') throw new RuntimeException("La page d'accueil ne peut pas être mise hors ligne.");
    $src = (string)file_get_contents(site_path($f));
    write_page($f, $src, 'Passage en brouillon', 'brouillon', false);
    @unlink(site_path($f));
    remove_empty_dirs(site_path($f), SITE_ROOT);
    search_index_remove($f);
    maybe_sitemap();
}

function trash_page(string $f): void {
    $p = page_path($f);
    $data = ['ts' => time(), 'user' => current_user()['name'] ?? '?', 'file' => $f, 'draft' => is_draft($f), 'src' => base64_encode((string)file_get_contents($p))];
    $id = date('Ymd-His') . '-' . preg_replace('/[^a-zA-Z0-9_\-]/', '_', $f);
    if (!is_dir(DATA_DIR . '/corbeille')) @mkdir(DATA_DIR . '/corbeille', 0750, true);
    write_atomic(DATA_DIR . "/corbeille/$id.php", "<?php\nreturn " . var_export($data, true) . ";\n");
    if (!@unlink($p)) throw new RuntimeException("Suppression impossible (permissions).");
    remove_empty_dirs($p, is_file($p) ? SITE_ROOT : (str_starts_with($p, drafts_dir()) ? drafts_dir() : SITE_ROOT));
    search_index_remove($f);
    maybe_sitemap();
}
function list_trash(): array {
    $out = [];
    foreach (glob(DATA_DIR . '/corbeille/*.php') ?: [] as $p) {
        $v = include $p;
        if (is_array($v)) $out[] = ['id' => basename($p, '.php'), 'file' => $v['file'], 'ts' => $v['ts'], 'user' => $v['user']];
    }
    usort($out, fn($a, $b) => $b['ts'] <=> $a['ts']);
    return $out;
}
/** La page restaurée revient en brouillon : à vérifier puis publier. */
function restore_trash(string $id): string {
    if (!preg_match('/^[0-9]{8}-[0-9]{6}-[a-zA-Z0-9_\-]+$/', $id)) throw new RuntimeException('Élément introuvable.');
    $p = DATA_DIR . "/corbeille/$id.php";
    $v = is_file($p) ? include $p : null;
    if (!is_array($v)) throw new RuntimeException('Élément introuvable.');
    $f = $v['file'];
    if (page_exists($f)) throw new RuntimeException("Une page existe déjà à l'adresse " . page_url_path($f) . '.');
    write_page($f, base64_decode($v['src']), 'Restauration depuis la corbeille', 'brouillon');
    @unlink($p);
    return $f;
}

/* ---------- Mesure d'audience ---------- */
function set_tracking(string $src, bool $on): string {
    $src = preg_replace('~\s*<script[^>]*data-cr-mesure[^>]*></script>~i', '', $src);
    if (!$on) return $src;
    if (stripos($src, '</body>') !== false) return preg_replace('~</body>~i', tracking_tag() . "\n</body>", $src, 1);
    return $src . "\n" . tracking_tag() . "\n";
}
function tracking_all(bool $on): array {
    $done = []; $fail = [];
    foreach (list_pages() as $pg) {
        try {
            $src = (string)file_get_contents(page_path($pg['file']));
            $new = set_tracking($src, $on);
            if ($new !== $src) { write_page($pg['file'], $new, $on ? 'Ajout de la mesure d\'audience' : 'Retrait de la mesure d\'audience'); $done[] = $pg['file']; }
        } catch (Throwable $t) { $fail[] = $pg['file']; }
    }
    return [$done, $fail];
}

/* ---------- Menu centralisé (menu principal + menu mobile, identiques sur toutes les pages) ---------- */
const CB_CHIPS = ['part' => 'Particuliers', 'pro' => 'Pros', 'both' => 'Les deux', '' => ''];
function menu_items(): array {
    $m = php_data_read('menu');
    if (!empty($m['sections'])) return $m['sections'];
    $src = (string)@file_get_contents(SITE_ROOT . '/index.html');
    $sections = [];
    if (preg_match('~<nav class="main"[^>]*>(.*?)</nav>~s', $src, $nav)) {
        preg_match_all('~<div class="nav-item"><a href="([^"]+)">(.*?)</a>(?:<div class="dropdown">(.*?)</div>)?</div>~s', $nav[1], $secs, PREG_SET_ORDER);
        foreach ($secs as $s) {
            $items = [];
            preg_match_all('~<a href="([^"]+)"><div><strong>(.*?)</strong></div>(?:<span class="chip (\w+)">[^<]*</span>)?</a>~s', $s[3] ?? '', $its, PREG_SET_ORDER);
            foreach ($its as $i) $items[] = ['label' => html_entity_decode($i[2], ENT_QUOTES, 'UTF-8'), 'href' => $i[1], 'chip' => $i[3] ?? ''];
            $sections[] = ['label' => html_entity_decode($s[2], ENT_QUOTES, 'UTF-8'), 'href' => $s[1], 'items' => $items];
        }
    }
    return $sections;
}
function mtxt(string $s): string { return htmlspecialchars($s, ENT_NOQUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function menu_html(array $sections): array {
    $nav = '<nav class="main" aria-label="Navigation principale">';
    $mnav = '<div class="mnav">';
    foreach ($sections as $s) {
        $nav .= '<div class="nav-item"><a href="' . e($s['href']) . '">' . mtxt($s['label']) . '</a>';
        $mnav .= '<div class="mnav-section"><a class="mnav-top" href="' . e($s['href']) . '">' . mtxt($s['label']) . '</a><div class="mnav-children">';
        if (!empty($s['items'])) {
            $nav .= '<div class="dropdown">';
            foreach ($s['items'] as $i) {
                $chip = CB_CHIPS[$i['chip'] ?? ''] ?? '';
                $nav .= '<a href="' . e($i['href']) . '"><div><strong>' . mtxt($i['label']) . '</strong></div>' . ($chip !== '' ? '<span class="chip ' . e($i['chip']) . '">' . mtxt($chip) . '</span>' : '') . '</a>';
                $mnav .= '<a href="' . e($i['href']) . '">' . mtxt($i['label']) . '</a>';
            }
            $nav .= '</div>';
        }
        $nav .= '</div>';
        $mnav .= '</div></div>';
    }
    return [$nav . '</nav>', $mnav . '</div>'];
}
function apply_menu(string $src, array $sections): ?string {
    [$nav, $mnav] = menu_html($sections);
    $n = 0;
    $src = preg_replace_callback('~' . preg_quote(CB_MENU_START, '~') . '.*?' . preg_quote(CB_MENU_END, '~') . '~s', fn() => CB_MENU_START . $nav . CB_MENU_END, $src, 1, $c1);
    $src = preg_replace_callback('~' . preg_quote(CB_MNAV_START, '~') . '.*?' . preg_quote(CB_MNAV_END, '~') . '~s', fn() => CB_MNAV_START . $mnav . CB_MNAV_END, $src, 1, $c2);
    return ($c1 + $c2) ? $src : null;
}
/** Enregistre le menu et l'applique à toutes les pages (en ligne et brouillons). */
function save_menu(array $sections): array {
    $old = php_data_read('menu');
    $hist = array_slice(array_merge([['ts' => time(), 'sections' => $old['sections'] ?? menu_items()]], $old['history'] ?? []), 0, 20);
    php_data_write('menu', ['sections' => $sections, 'history' => $hist]);
    $done = 0; $skip = [];
    foreach (list_pages() as $p) {
        $src = (string)file_get_contents(page_path($p['file']));
        $new = apply_menu($src, $sections);
        if ($new === null) { $skip[] = $p['file']; continue; }
        if ($new !== $src) { write_page($p['file'], $new, 'Menu du site', null, false); $done++; }
    }
    return [$done, $skip];
}

/* ---------- Moteur de recherche interne (index de la page d'accueil) ---------- */
function search_index_edit(callable $fn): void {
    $home = SITE_ROOT . '/index.html';
    $src = (string)@file_get_contents($home);
    if (!preg_match('~const SEARCH_INDEX=(\[.*?\]);</script>~s', $src, $m, PREG_OFFSET_CAPTURE)) return;
    $list = json_decode($m[1][0], true);
    if (!is_array($list)) return;
    $new = $fn($list);
    if ($new === $list) return;
    $json = json_encode(array_values($new), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG);
    $src = substr($src, 0, $m[1][1]) . $json . substr($src, $m[1][1] + strlen($m[1][0]));
    write_atomic($home, $src);
}
function search_index_add(string $f): void {
    if (in_array($f, ['index.html', '404.html'], true)) return;
    $src = (string)@file_get_contents(site_path($f));
    $u = page_url_path($f); $t = page_h1($src) ?: page_title($src);
    $aud = preg_match('~<div class="meta"><span class="chip (\w+)">~', $src, $m) ? ['part' => 'Particuliers', 'pro' => 'Professionnels'][$m[1]] ?? 'Les deux' : 'Les deux';
    search_index_edit(function (array $l) use ($u, $t, $aud, $src) {
        foreach ($l as &$x) if (($x['u'] ?? '') === $u) { $x['t'] = $t; return $l; }
        $l[] = ['t' => $t, 'u' => $u, 'k' => mb_strtolower(mb_substr(page_desc($src), 0, 160)), 'a' => $aud];
        return $l;
    });
}
function search_index_remove(string $f): void {
    $u = page_url_path($f);
    search_index_edit(fn(array $l) => array_values(array_filter($l, fn($x) => ($x['u'] ?? '') !== $u)));
}
function search_index_retitle(string $f, string $t): void {
    $u = page_url_path($f);
    search_index_edit(function (array $l) use ($u, $t) { foreach ($l as &$x) if (($x['u'] ?? '') === $u) $x['t'] = $t; return $l; });
}

/* ---------- Sitemap ---------- */
function build_sitemap(): int {
    $base = rtrim(cfg('site_url'), '/');
    $x = '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
    $n = 0;
    foreach (scan_html(SITE_ROOT) as $f) {
        if (in_array($f, cfg('sitemap_exclude', []), true)) continue;
        $x .= '  <url><loc>' . htmlspecialchars($base . page_url_path($f)) . '</loc><lastmod>' . date('Y-m-d', (int)filemtime(site_path($f))) . "</lastmod></url>\n";
        $n++;
    }
    $x .= "</urlset>\n";
    write_atomic(SITE_ROOT . '/sitemap.xml', $x);
    save_settings(['sitemap_last' => time()]);
    return $n;
}

/* ---------- Modèle de nouvelle page ---------- */
function crumbs_html(string $f): string {
    $h = '<a href="/">Accueil</a>';
    $parts = explode('/', $f); array_pop($parts); array_pop($parts);
    $acc = '';
    foreach ($parts as $seg) {
        $acc .= $seg . '/';
        $pf = $acc . 'index.html';
        if (is_file(site_path($pf))) $h .= ' › <a href="' . e(page_url_path($pf)) . '">' . e(page_h1((string)file_get_contents(site_path($pf))) ?: $seg) . '</a>';
    }
    return $h;
}
function new_page_source(string $f, string $title, string $desc, string $lead, string $aud, string $content): string {
    $tpl = (string)file_get_contents(BO_DIR . '/templates/page-modele.html');
    $chip = ['part' => '<span class="chip part">Particuliers</span>', 'pro' => '<span class="chip pro">Pros</span>'][$aud] ?? '<span class="chip both">Les deux</span>';
    $src = strtr($tpl, [
        '{{TITRE_ONGLET}}' => e($title . ' — ' . cfg('site_name')),
        '{{TITRE}}' => e($title),
        '{{DESCRIPTION}}' => e($desc),
        '{{CHAPO}}' => e($lead),
        '{{URL}}' => e(rtrim(cfg('site_url'), '/') . page_url_path($f)),
        '{{FIL}}' => crumbs_html($f),
        '{{PUBLIC}}' => $chip,
        '{{DATE}}' => fr_month_year(),
        '{{CONTENU}}' => $content,
    ]);
    $src = apply_menu($src, menu_items()) ?? $src;
    return set_tracking($src, !empty(settings()['tracking']));
}
