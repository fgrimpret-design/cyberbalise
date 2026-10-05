<?php
declare(strict_types=1);
require __DIR__ . '/inc/bootstrap.php';
require_once __DIR__ . '/inc/layout.php';
require __DIR__ . '/inc/pages.php';
require __DIR__ . '/inc/stats.php';
require_login();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $a = (string)($_POST['action'] ?? '');
    $f = (string)($_POST['file'] ?? '');
    try {
        switch ($a) {
            case 'publish':
            case 'unpublish':
                $a === 'publish' ? publish_page($f) : unpublish_page($f);
                log_action($a === 'publish' ? 'Publication' : 'Mise en brouillon', $f);
                flash('ok', $a === 'publish' ? page_url_path($f) . ' est maintenant en ligne.' : page_url_path($f) . ' est en brouillon : la page est retirée du site public.');
                break;
            case 'tracking':
                $on = ($_POST['on'] ?? '') === '1';
                $src = (string)file_get_contents(page_path($f));
                write_page($f, set_tracking($src, $on), $on ? 'Ajout de la mesure d\'audience' : 'Retrait de la mesure d\'audience');
                log_action($on ? 'Mesure activée' : 'Mesure retirée', $f);
                flash('ok', ($on ? "Mesure d'audience ajoutée à " : "Mesure d'audience retirée de ") . page_url_path($f) . '.');
                break;
            case 'tracking_all':
                if (!is_admin()) throw new RuntimeException('Action réservée aux administrateurs.');
                [$done, $fail] = tracking_all(true);
                log_action('Mesure activée sur tout le site', '', count($done) . ' page(s)');
                flash($fail ? 'err' : 'ok', count($done) . ' page(s) mises à jour.' . ($fail ? ' Échec pour : ' . implode(', ', $fail) . ' (permissions).' : ''));
                break;
            case 'duplicate':
                $base = preg_replace('~/index\.html$|\.html$~', '', $f);
                $i = 1; do { $new = $base . '-copie' . ($i > 1 ? '-' . $i : '') . (str_ends_with($f, '/index.html') ? '/index.html' : '.html'); $i++; } while (page_exists($new));
                if (!page_name_ok($new)) throw new RuntimeException('Duplication impossible pour cette page.');
                write_page($new, (string)file_get_contents(page_path($f)), 'Duplication de ' . $f, 'brouillon');
                log_action('Duplication', $new, 'depuis ' . $f);
                flash('ok', 'Copie créée en brouillon : ' . page_url_path($new) . '. Pensez à changer son titre.');
                redirect(url('edit.php?f=' . urlencode($new)));
            case 'delete':
                if (!is_admin()) throw new RuntimeException('Action réservée aux administrateurs.');
                if (in_array($f, cfg('protected_files', []), true)) throw new RuntimeException(page_url_path($f) . ' est une page protégée et ne peut pas être supprimée.');
                trash_page($f);
                log_action('Suppression', $f, 'Placée dans la corbeille');
                flash('ok', page_url_path($f) . ' a été placée dans la corbeille. Vous pouvez la restaurer plus bas.');
                break;
            case 'restore':
                $rf = restore_trash((string)($_POST['id'] ?? ''));
                log_action('Restauration', $rf);
                flash('ok', page_url_path($rf) . ' a été restaurée en brouillon. Vérifiez-la puis publiez-la.');
                break;
            case 'sitemap':
                $n = build_sitemap();
                log_action('Sitemap régénéré', 'sitemap.xml', "$n URL");
                flash('ok', "sitemap.xml régénéré ($n pages publiées). Pensez à le déclarer dans Google Search Console.");
                break;
        }
    } catch (Throwable $t) { flash('err', $t->getMessage()); }
    redirect(url('pages.php' . (isset($_GET['filtre']) ? '?filtre=' . urlencode($_GET['filtre']) : '')));
}

$pages = list_pages();
$filtre = $_GET['filtre'] ?? '';
if ($filtre === 'brouillons') $pages = array_values(array_filter($pages, fn($p) => $p['draft']));
$views = [];
foreach (q('SELECT path, COUNT(*) n FROM cr_hits WHERE day >= ? GROUP BY path', [date('Y-m-d', strtotime('-29 days'))]) as $r) $views[$r['path']] = (int)$r['n'];
$trash = list_trash();

layout_start('Pages', 'pages.php');
?>
<div class="row" style="margin:-8px 0 18px">
  <div class="seg"><a href="pages.php" class="<?= $filtre === '' ? 'on' : '' ?>">Toutes</a><a href="?filtre=brouillons" class="<?= $filtre === 'brouillons' ? 'on' : '' ?>">Brouillons</a></div>
  <input type="search" id="q" placeholder="Filtrer par titre ou adresse" style="max-width:280px" aria-label="Filtrer les pages">
  <select id="rub" aria-label="Rubrique" style="max-width:200px"><option value="">Toutes les rubriques</option><?php foreach (['particuliers' => 'Particuliers', 'pro' => 'Professionnels', 'offres' => 'Offres & outils', 'outils' => 'Ressources', 'autres' => 'Pages générales'] as $k => $l): ?><option value="<?= $k ?>"><?= $l ?></option><?php endforeach; ?></select>
  <span class="spacer"></span>
  <?php if (is_admin()): ?><form method="post" style="display:inline"><?= csrf_field() ?><input type="hidden" name="action" value="sitemap"><button class="btn sm" title="<?= ($l = settings()['sitemap_last']) ? 'Dernière génération : ' . e(fr_date((int)$l)) : 'Jamais généré' ?>">Régénérer sitemap.xml</button></form><?php endif; ?>
  <a class="btn pri" href="<?= e(url('edit.php?nouveau=1')) ?>">+ Nouvelle page</a>
</div>

<div class="card" style="padding:6px 8px">
  <div class="tbl-wrap"><table id="tbl">
    <thead><tr><th>Page <span class="dim small" style="font-weight:400">· <?= count($pages) ?></span></th><th>État</th><th class="num">Vues · 30 j</th><th>Modifiée</th><th></th></tr></thead>
    <tbody>
    <?php if (!$pages): ?><tr><td colspan="5" class="empty">Aucune page ici. <a href="<?= e(url('edit.php?nouveau=1')) ?>">Créer une page</a></td></tr><?php endif; ?>
    <?php foreach ($pages as $p): $url = page_url_path($p['file']); ?>
      <?php $rub = explode('/', $p['file'])[0]; $rub = in_array($rub, ['particuliers', 'pro', 'offres', 'outils'], true) ? $rub : 'autres'; ?>
      <tr data-q="<?= e(mb_strtolower($url . ' ' . $p['title'])) ?>" data-r="<?= $rub ?>">
        <td><a href="<?= e(url('edit.php?f=' . urlencode($p['file']))) ?>" style="text-decoration:none"><strong><?= e($p['title']) ?></strong></a>
          <span class="mono dim small" style="display:block"><?= e($url) ?></span></td>
        <td><div class="row" style="gap:5px">
          <?= $p['draft'] ? '<span class="badge warn">Brouillon</span>' : '<span class="badge ok">En ligne</span>' ?>
          <?= $p['tracked'] ? '' : '<span class="badge" title="Cette page n\'est pas comptée dans les statistiques">Non mesurée</span>' ?>
          <?= $p['visual'] ? '' : '<span class="badge info" title="Page interactive : modifiable en mode code uniquement">Code</span>' ?>
          <?= $p['protected'] ? '<span class="badge" title="Ne peut pas être supprimée">Protégée</span>' : '' ?>
        </div></td>
        <td class="num"><a href="<?= e(url('stats.php?page=' . urlencode($url))) ?>"><?= fr_num($views[$url] ?? 0) ?></a></td>
        <td class="small muted" style="white-space:nowrap"><?= e(fr_date($p['mtime'])) ?></td>
        <td style="text-align:right;white-space:nowrap">
          <a class="btn sm" href="<?= e(url('edit.php?f=' . urlencode($p['file']))) ?>">Modifier</a>
          <a class="btn sm ghost" href="<?= e($p['draft'] ? url('apercu.php?f=' . urlencode($p['file'])) : rtrim(cfg('site_url'), '/') . $url) ?>" target="_blank" rel="noopener" title="<?= $p['draft'] ? 'Aperçu du brouillon' : 'Ouvrir la page sur le site' ?>"><?= $p['draft'] ? 'Aperçu ↗' : 'Voir ↗' ?></a>
          <details style="display:inline-block;position:relative"><summary class="btn sm ghost" style="list-style:none" aria-label="Plus d'actions">•••</summary>
            <div class="card" style="position:absolute;right:0;top:34px;z-index:5;min-width:220px;padding:8px;text-align:left">
              <?php foreach ([
                  [$p['draft'] ? 'publish' : 'unpublish', $p['draft'] ? 'Publier' : 'Repasser en brouillon', ''],
                  ['tracking', $p['tracked'] ? 'Retirer la mesure d\'audience' : 'Ajouter la mesure d\'audience', $p['tracked'] ? '0' : '1'],
                  ['duplicate', 'Dupliquer', ''],
              ] as [$act, $lbl, $on]): ?>
                <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="<?= $act ?>"><input type="hidden" name="file" value="<?= e($p['file']) ?>"><?= $on !== '' ? '<input type="hidden" name="on" value="' . $on . '">' : '' ?><button class="btn sm ghost" style="width:100%;justify-content:flex-start"><?= e($lbl) ?></button></form>
              <?php endforeach; ?>
              <?php if (is_admin() && !$p['protected']): ?>
                <form method="post" onsubmit="return confirm('Placer « <?= e($url) ?> » dans la corbeille ? La page ne sera plus accessible sur le site.')"><?= csrf_field() ?><input type="hidden" name="action" value="delete"><input type="hidden" name="file" value="<?= e($p['file']) ?>"><button class="btn sm ghost" style="width:100%;justify-content:flex-start;color:var(--r)">Supprimer</button></form>
              <?php endif; ?>
            </div>
          </details>
        </td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table></div>
</div>

<?php if ($trash): ?>
<div class="card" style="margin-top:16px">
  <h2>Corbeille</h2>
  <table><tbody><?php foreach ($trash as $t): ?>
    <tr><td class="mono"><?= e(page_url_path($t['file'])) ?></td><td class="small muted">Supprimée par <?= e($t['user']) ?> le <?= e(fr_date((int)$t['ts'])) ?></td>
    <td style="text-align:right"><form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="restore"><input type="hidden" name="id" value="<?= e($t['id']) ?>"><button class="btn sm">Restaurer</button></form></td></tr>
  <?php endforeach; ?></tbody></table>
</div>
<?php endif; ?>
<?php layout_end(<<<'HTML'
<script>
function flt() {
  var v = document.getElementById('q').value.trim().toLowerCase(), r = document.getElementById('rub').value;
  document.querySelectorAll('#tbl tbody tr[data-q]').forEach(function (tr) { tr.style.display = (!v || tr.dataset.q.includes(v)) && (!r || tr.dataset.r === r) ? '' : 'none'; });
}
document.getElementById('q').addEventListener('input', flt); document.getElementById('rub').addEventListener('change', flt);
document.addEventListener('click', function (e) { document.querySelectorAll('details[open]').forEach(function (d) { if (!d.contains(e.target)) d.removeAttribute('open'); }); });
</script>
HTML);
