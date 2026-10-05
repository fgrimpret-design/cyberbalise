<?php
declare(strict_types=1);

function nav_items(): array {
    return [
        ['index.php',     'Tableau de bord', 'M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10', null],
        ['stats.php',     'Statistiques',    'M4 20V10M10 20V4M16 20v-7M22 20H2', null],
        ['pages.php',     'Pages',           'M7 3h7l5 5v13H7zM14 3v5h5', null],
        ['menu.php',      'Menu du site',    'M4 6h16M4 12h16M4 18h10', 'admin'],
        ['medias.php',    'Médias',          'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9.5h.01', null],
        ['users.php',     'Utilisateurs',    'M16 19v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 10a3.5 3.5 0 100-7 3.5 3.5 0 000 7M21 19v-1a4 4 0 00-3-3.9M16 3.1a3.5 3.5 0 010 6.8', 'admin'],
        ['settings.php',  'Réglages',        'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z', 'admin'],
        ['journal.php',   'Journal',         'M12 8v4l3 2M12 21a9 9 0 100-18 9 9 0 000 18z', 'admin'],
    ];
}

function brand_svg(): string {
    return '<svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 2 L28 6.5 V15 c0 7.4-4.9 12.2-12 14.5 C8.9 27.2 4 22.4 4 15 V6.5 Z" fill="#E4572E"/><circle cx="16" cy="18.2" r="2.7" fill="#fff"/><path d="M11.6 13.4a6.3 6.3 0 0 1 8.8 0M8.9 10.6a10.2 10.2 0 0 1 14.2 0" stroke="#fff" stroke-width="2.3" fill="none" stroke-linecap="round"/><path d="M16 21v4.2" stroke="#fff" stroke-width="2.3" stroke-linecap="round"/></svg>';
}

function icon(string $d, int $s = 18): string {
    return '<svg width="' . $s . '" height="' . $s . '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' . $d . '"/></svg>';
}

function layout_start(string $title, string $active = '', string $head = ''): void {
    $u = current_user();
    $script = basename($_SERVER['SCRIPT_NAME'] ?? '');
    $active = $active ?: $script;
    ?><!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title><?= e($title) ?> · Back office <?= e(cfg('site_name')) ?></title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/fonts/fonts.css">
<link rel="stylesheet" href="<?= e(url('assets/admin.css')) ?>?v=cb1">
<?= $head ?>
</head>
<body>
<?php if ($u): ?>
<a class="skip" href="#contenu">Aller au contenu</a>
<aside class="side" id="side">
  <a class="brand" href="<?= e(url('index.php')) ?>"><?= brand_svg() ?><span>CYBER<b>BALISE</b><small>Back office</small></span></a>
  <nav aria-label="Navigation du back office">
  <?php foreach (nav_items() as [$href, $label, $ico, $role]):
      if ($role === 'admin' && !is_admin()) continue; ?>
    <a href="<?= e(url($href)) ?>" class="<?= $active === $href ? 'on' : '' ?>"<?= $active === $href ? ' aria-current="page"' : '' ?>><?= icon($ico) ?><span><?= e($label) ?></span></a>
  <?php endforeach; ?>
  </nav>
  <div class="side-foot">
    <a href="<?= e(cfg('site_url')) ?>/" target="_blank" rel="noopener"><?= icon('M14 3h7v7M10 14L21 3M21 14v7H3V3h7') ?><span>Voir le site</span></a>
    <a href="<?= e(url('profil.php')) ?>" class="<?= $active === 'profil.php' ? 'on' : '' ?>"><?= icon('M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8') ?><span><?= e($u['name']) ?><em><?= $u['role'] === 'admin' ? 'Administrateur' : 'Éditeur' ?></em></span></a>
    <form method="post" action="<?= e(url('logout.php')) ?>"><?= csrf_field() ?><button type="submit"><?= icon('M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9') ?><span>Se déconnecter</span></button></form>
  </div>
</aside>
<button class="burger" type="button" aria-controls="side" aria-expanded="false" onclick="var s=document.getElementById('side');s.classList.toggle('open');this.setAttribute('aria-expanded',s.classList.contains('open'))">Menu</button>
<?php endif; ?>
<main class="<?= $u ? 'main' : 'main bare' ?>" id="contenu">
<?php if ($u): ?><header class="top"><h1><?= e($title) ?></h1><div class="top-actions" id="top-actions"></div></header><?php endif; ?>
<?php foreach (flashes() as [$t, $m]): ?>
  <div class="flash <?= e($t) ?>" role="<?= $t === 'err' ? 'alert' : 'status' ?>"><?= e($m) ?></div>
<?php endforeach;
}

function layout_end(string $foot = ''): void {
    echo "\n</main>\n" . $foot . "\n</body>\n</html>";
}

function kpi(string $label, string $value, ?float $delta = null, string $hint = ''): string {
    $d = '';
    if ($delta !== null) {
        $cls = $delta > 0.5 ? 'up' : ($delta < -0.5 ? 'down' : 'flat');
        $d = '<span class="delta ' . $cls . '">' . ($delta > 0 ? '+' : '') . fr_num($delta, 0) . ' %</span>';
    }
    return '<div class="kpi"><p class="kpi-l">' . e($label) . ($hint ? ' <span class="hint" title="' . e($hint) . '">?</span>' : '') . '</p><p class="kpi-v">' . $value . '</p>' . $d . '</div>';
}
