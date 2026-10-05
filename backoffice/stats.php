<?php
declare(strict_types=1);
require __DIR__ . '/inc/bootstrap.php';
require_once __DIR__ . '/inc/layout.php';
require __DIR__ . '/inc/stats.php';
require_login();

$P = period_from_request();
$page = substr((string)($_GET['page'] ?? ''), 0, 200);
$extra = $page !== '' ? '&page=' . urlencode($page) : '';

// Export CSV
if (($_GET['export'] ?? '') === 'csv') {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="statistiques-' . $P['from'] . '_' . $P['to'] . '.csv"');
    $o = fopen('php://output', 'w'); fwrite($o, "\xEF\xBB\xBF");
    fputcsv($o, ['date', 'page', 'pages_vues', 'visiteurs', 'duree_moyenne_s'], ';');
    $w = 'day BETWEEN ? AND ?' . ($page !== '' ? ' AND path = ?' : '');
    $a = $page !== '' ? [$P['from'], $P['to'], $page] : [$P['from'], $P['to']];
    foreach (q("SELECT day, path, COUNT(*) pv, COUNT(DISTINCT visitor) v, ROUND(AVG(NULLIF(duration,0))) d FROM cr_hits WHERE $w GROUP BY day, path ORDER BY day, pv DESC", $a) as $r) {
        fputcsv($o, [$r['day'], $r['path'], $r['pv'], $r['v'], $r['d'] ?? ''], ';');
    }
    exit;
}

$s = summary($P['from'], $P['to'], $page);
$sp = summary($P['pfrom'], $P['pto'], $page);
$ts = timeseries($P, $page);
$pw = $page !== '' ? ' AND path = ?' : '';
$pa = $page !== '' ? [$page] : [];
$sources = top('source', $P, 7, $pw, $pa);
$refs = top('ref_host', $P, 10, " AND ref_host <> ''" . $pw, $pa);
$camps = top('utm_campaign', $P, 8, " AND utm_campaign <> ''" . $pw, $pa);
$devices = top('device', $P, 5, $pw, $pa);
$browsers = top('browser', $P, 6, $pw, $pa);
$oses = top('os', $P, 6, $pw, $pa);
$langs = top('lang', $P, 6, $pw, $pa);
[$heat, $hmax] = heatmap($P);
$evs = events($P);
$periodLabel = fr_date(strtotime($P['from']), false) . ' – ' . fr_date(strtotime($P['to']), false);

layout_start($page !== '' ? 'Statistiques · ' . $page : 'Statistiques', 'stats.php');
?>
<div class="row" style="margin:-8px 0 18px">
  <?= period_selector($P, $extra) ?>
  <span class="spacer"></span>
  <?php if ($page !== ''): ?><a class="btn sm" href="?periode=<?= e($P['key']) ?>">× Toutes les pages</a><?php endif; ?>
  <a class="btn sm" href="?<?= e(http_build_query(array_merge($_GET, ['export' => 'csv']))) ?>">Exporter en CSV</a>
</div>
<p class="dim small" style="margin:-8px 0 14px"><?= e($periodLabel) ?> · comparé à la période précédente de même durée</p>

<div class="kpis">
  <?= kpi('Visites', fr_num($s['visits']), pct_change($s['visits'], $sp['visits']), 'Un visiteur anonyme sur une journée. Sans cookie, un internaute revenu 3 jours différents compte 3 visites.') ?>
  <?= kpi('Pages vues', fr_num($s['pv']), pct_change($s['pv'], $sp['pv'])) ?>
  <?= kpi('Pages / visite', fr_num($s['ppv'], 1), pct_change($s['ppv'], $sp['ppv'])) ?>
  <?= kpi('Taux de rebond', fr_num($s['bounce'], 0) . ' %', null, 'Part des visites d\'une seule page') ?>
  <?= kpi('Durée moyenne / page', duration_fmt($s['dur']), pct_change($s['dur'], $sp['dur']), 'Temps pendant lequel l\'onglet était visible') ?>
</div>

<div class="card" style="margin-bottom:16px">
  <h2>Évolution</h2>
  <div class="chart-box"><canvas id="c-main" role="img" aria-label="Évolution des pages vues et visiteurs"></canvas></div>
</div>

<div class="grid g2" style="margin-bottom:16px">
  <?php if ($page === ''): ?>
  <div class="card"><h2>Pages les plus vues</h2>
    <?= bar_table(top('path', $P, 12), 'Page', 'pv', fn($k, $r) => '<a href="?page=' . urlencode($k) . '&periode=' . e($P['key']) . '">' . e($k) . '</a> <span class="dim small">· ' . duration_fmt((float)$r['dur']) . '</span>') ?>
  </div>
  <div class="card"><h2>Pages d'entrée</h2>
    <?= bar_table(entry_pages($P, 12), 'Première page vue', 'n', null, 'Visites') ?>
  </div>
  <?php endif; ?>
  <div class="card"><h2>Canaux d'acquisition</h2>
    <?php if ($sources): ?><div class="chart-sm"><canvas id="c-src" role="img" aria-label="Répartition des sources de trafic"></canvas></div><?php else: ?><p class="empty small">Pas encore de données.</p><?php endif; ?>
  </div>
  <div class="card"><h2>Sites référents</h2><?= bar_table($refs, 'Provenance') ?></div>
  <?php if ($camps): ?><div class="card"><h2>Campagnes (utm_campaign)</h2><?= bar_table($camps, 'Campagne') ?></div><?php endif; ?>
  <div class="card"><h2>Appareils</h2>
    <?php if ($devices): ?><div class="chart-sm"><canvas id="c-dev" role="img" aria-label="Répartition par appareil"></canvas></div><?php else: ?><p class="empty small">Pas encore de données.</p><?php endif; ?>
  </div>
  <div class="card"><h2>Navigateurs &amp; systèmes</h2>
    <div class="grid g2"><?= bar_table($browsers, 'Navigateur') ?><?= bar_table($oses, 'Système') ?></div>
  </div>
  <div class="card"><h2>Langue du navigateur</h2><?= bar_table($langs, 'Langue') ?></div>
</div>

<?php if ($page === ''): ?>
<div class="grid g2">
  <div class="card"><h2>Affluence par jour et par heure</h2>
    <div class="heat" role="img" aria-label="Carte de chaleur des pages vues par jour de la semaine et heure">
      <span></span><?php for ($h = 0; $h < 24; $h++): ?><span style="justify-content:center"><?= $h % 3 === 0 ? $h : '' ?></span><?php endfor; ?>
      <?php foreach ([1 => 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'] as $d => $l): ?>
        <span><?= $l ?></span>
        <?php for ($h = 0; $h < 24; $h++): $v = $heat[$d][$h]; $o = $hmax ? 0.06 + $v / $hmax * 0.94 : 0.06; ?>
          <div title="<?= $l ?> <?= $h ?> h : <?= $v ?> vue(s)" style="background:rgba(228,87,46,<?= round($o, 2) ?>)"></div>
        <?php endfor; ?>
      <?php endforeach; ?>
    </div>
  </div>
  <div class="card"><h2>Événements (clics suivis)</h2>
    <?php if (!$evs): ?><p class="empty small">Aucun événement. Les téléchargements (PDF, CSV…) et liens sortants sont suivis automatiquement ; ajoutez <code class="mono">data-cr-event="Nom"</code> sur un bouton pour le suivre.</p>
    <?php else: ?><div class="tbl-wrap"><table><thead><tr><th>Événement</th><th>Détail</th><th class="num">Clics</th></tr></thead><tbody>
      <?php foreach ($evs as $ev): ?><tr><td><?= e($ev['name']) ?></td><td><span class="trunc small muted"><?= e($ev['value']) ?></span></td><td class="num"><?= fr_num($ev['n']) ?></td></tr><?php endforeach; ?>
    </tbody></table></div><?php endif; ?>
  </div>
</div>
<?php endif; ?>

<details class="card" style="margin-top:16px"><summary style="cursor:pointer;font-weight:600">Comment ces chiffres sont calculés</summary>
  <ul class="muted small" style="line-height:1.8">
    <li><strong>Page vue</strong> : un affichage de page par un navigateur réel. Les robots connus et les membres connectés au back office sont exclus.</li>
    <li><strong>Visite</strong> : un visiteur anonyme sur une journée. L'identifiant est une empreinte non réversible, renouvelée chaque jour ; aucun cookie n'est déposé et aucune adresse IP n'est conservée.</li>
    <li><strong>Visiteurs</strong> (courbe pointillée) : visiteurs uniques de chaque jour. Pas de suivi d'un jour à l'autre, par choix de confidentialité.</li>
    <li><strong>Durée</strong> : temps pendant lequel l'onglet était au premier plan.</li>
    <li>Les bloqueurs de publicité ne bloquent généralement pas ce script (hébergé sur votre domaine), mais les navigateurs sans JavaScript ne sont pas comptés.</li>
  </ul>
</details>
<?php
$js = json_encode($ts, JSON_UNESCAPED_UNICODE);
$src = json_encode([array_column($sources, 'k'), array_map('intval', array_column($sources, 'pv'))], JSON_UNESCAPED_UNICODE);
$dev = json_encode([array_column($devices, 'k'), array_map('intval', array_column($devices, 'pv'))], JSON_UNESCAPED_UNICODE);
layout_end(<<<HTML
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<script src="assets/charts.js"></script>
<script>crLine('c-main', $js); var s=$src, d=$dev; crDonut('c-src', s[0], s[1]); crDonut('c-dev', d[0], d[1]);</script>
HTML);
