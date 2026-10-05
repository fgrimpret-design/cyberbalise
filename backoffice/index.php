<?php
declare(strict_types=1);
require __DIR__ . '/inc/bootstrap.php';
require_once __DIR__ . '/inc/layout.php';
require __DIR__ . '/inc/stats.php';
require __DIR__ . '/inc/pages.php';
$u = require_login();

$today = date('Y-m-d');
$_GET['periode'] = '7j';
$P = period_from_request();
$s = summary($P['from'], $P['to']);
$sp = summary($P['pfrom'], $P['pto']);
$ts = timeseries($P);
$sToday = summary($today, $today);
$pages = list_pages();
$untracked = array_filter($pages, fn($p) => !$p['tracked'] && !$p['draft'] && $p['file'] !== '404.html');
$drafts = array_filter($pages, fn($p) => $p['draft']);
$recent = q('SELECT * FROM cr_journal ORDER BY ts DESC LIMIT 6');
$noData = (int)q1('SELECT COUNT(*) FROM cr_hits') === 0;

layout_start('Tableau de bord', 'index.php');
?>
<p class="muted" style="margin:-12px 0 20px">Bonjour <?= e($u['name']) ?>. Voici l'activité des 7 derniers jours.</p>

<?php if ($noData && is_admin()): ?>
<div class="card" style="border-color:rgba(228,87,46,.35);margin-bottom:16px">
  <h2>Activer la mesure d'audience</h2>
  <p class="muted">Aucune visite enregistrée pour l'instant. La mesure démarre dès que le petit script de suivi est présent sur les pages du site.</p>
  <form method="post" action="<?= e(url('pages.php')) ?>" class="row"><?= csrf_field() ?><input type="hidden" name="action" value="tracking_all"><input type="hidden" name="on" value="1">
    <button class="btn pri">Ajouter la mesure à toutes les pages</button>
    <span class="dim small">Une copie de sauvegarde de chaque page est conservée.</span></form>
</div>
<?php endif; ?>

<div class="kpis">
  <?= kpi('Visiteurs en ce moment', '<span id="live">' . live_visitors() . '</span>', null, 'Visiteurs actifs sur les 5 dernières minutes') ?>
  <?= kpi("Pages vues aujourd'hui", fr_num($sToday['pv'])) ?>
  <?= kpi('Visites · 7 jours', fr_num($s['visits']), pct_change($s['visits'], $sp['visits']), 'Comparé aux 7 jours précédents') ?>
  <?= kpi('Pages vues · 7 jours', fr_num($s['pv']), pct_change($s['pv'], $sp['pv'])) ?>
  <?= kpi('Durée moyenne', duration_fmt($s['dur'])) ?>
</div>

<div class="grid g-main">
  <div class="card">
    <div class="row" style="margin-bottom:10px"><h2 style="margin:0">Fréquentation</h2><span class="spacer"></span><a class="btn sm ghost" href="<?= e(url('stats.php')) ?>">Toutes les statistiques →</a></div>
    <div class="chart-box"><canvas id="c-main" aria-label="Pages vues et visiteurs par jour" role="img"></canvas></div>
  </div>
  <div class="stack">
    <div class="card">
      <h2>Pages les plus vues</h2>
      <?= bar_table(top('path', $P, 6), 'Page', 'pv', fn($k) => '<a href="' . e(url('stats.php?page=' . urlencode($k))) . '">' . e($k) . '</a>') ?>
    </div>
    <div class="card">
      <h2>À faire</h2>
      <ul class="menu-list" style="margin:0">
      <?php if ($untracked): ?><li style="display:flex"><span class="badge warn"><?= count($untracked) ?></span><span>page(s) en ligne sans mesure d'audience</span><span class="spacer"></span><a class="btn sm" href="<?= e(url('pages.php')) ?>">Voir</a></li><?php endif; ?>
      <?php if ($drafts): ?><li style="display:flex"><span class="badge info"><?= count($drafts) ?></span><span>brouillon(s) en attente</span><span class="spacer"></span><a class="btn sm" href="<?= e(url('pages.php?filtre=brouillons')) ?>">Voir</a></li><?php endif; ?>
      <?php if ($u['totp_secret'] === ''): ?><li style="display:flex"><span class="badge ko">!</span><span>Double authentification non activée</span><span class="spacer"></span><a class="btn sm" href="<?= e(url('profil.php')) ?>">Activer</a></li><?php endif; ?>
      <?php if (!$untracked && !$drafts && $u['totp_secret'] !== ''): ?><li style="display:flex"><span class="badge ok">OK</span><span>Rien en attente.</span></li><?php endif; ?>
      </ul>
      <p style="margin:14px 0 0"><a class="btn pri" href="<?= e(url('edit.php?nouveau=1')) ?>">+ Nouvelle page</a></p>
    </div>
  </div>
</div>

<?php if (is_admin()): ?>
<div class="card" style="margin-top:16px">
  <div class="row" style="margin-bottom:6px"><h2 style="margin:0">Dernières actions</h2><span class="spacer"></span><a class="btn sm ghost" href="<?= e(url('journal.php')) ?>">Journal complet →</a></div>
  <?php if (!$recent): ?><p class="empty small">Aucune action enregistrée.</p><?php else: ?>
  <table><tbody><?php foreach ($recent as $r): ?><tr><td class="dim small mono" style="width:170px"><?= e(fr_date((int)$r['ts'])) ?></td><td><strong><?= e($r['user_name']) ?></strong> · <?= e($r['action']) ?> <span class="mono small muted"><?= e($r['target']) ?></span></td></tr><?php endforeach; ?></tbody></table>
  <?php endif; ?>
</div>
<?php endif; ?>

<?php
$js = json_encode($ts, JSON_UNESCAPED_UNICODE);
layout_end(<<<HTML
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<script src="assets/charts.js"></script>
<script>crLine('c-main', $js);
setInterval(function(){fetch('api-live.php').then(r=>r.json()).then(d=>{document.getElementById('live').textContent=d.n}).catch(()=>{})},30000);</script>
HTML);
