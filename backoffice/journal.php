<?php
declare(strict_types=1);
require __DIR__ . '/inc/bootstrap.php';
require_once __DIR__ . '/inc/layout.php';
require __DIR__ . '/inc/stats.php';
require_login('admin');
$p = max(1, (int)($_GET['p'] ?? 1)); $per = 50;
$total = (int)q1('SELECT COUNT(*) FROM cr_journal');
$rows = q('SELECT * FROM cr_journal ORDER BY ts DESC LIMIT ' . $per . ' OFFSET ' . (($p - 1) * $per));
layout_start('Journal des actions', 'journal.php');
?>
<p class="muted" style="margin:-10px 0 16px">Toutes les connexions et modifications effectuées dans le back office.</p>
<div class="card" style="padding:6px 8px"><div class="tbl-wrap"><table>
  <thead><tr><th>Date</th><th>Utilisateur</th><th>Action</th><th>Élément</th><th>Détails</th></tr></thead><tbody>
  <?php if (!$rows): ?><tr><td colspan="5" class="empty">Aucune action enregistrée.</td></tr><?php endif; ?>
  <?php foreach ($rows as $r): ?><tr><td class="small mono" style="white-space:nowrap"><?= e(fr_date((int)$r['ts'])) ?></td><td><?= e($r['user_name']) ?></td><td><?= e($r['action']) ?></td><td class="mono small"><?= e($r['target']) ?></td><td class="small muted"><?= e($r['details']) ?></td></tr><?php endforeach; ?>
  </tbody></table></div></div>
<div class="row" style="margin-top:12px"><?php if ($p > 1): ?><a class="btn sm" href="?p=<?= $p - 1 ?>">← Plus récent</a><?php endif; ?><span class="spacer"></span><span class="dim small">Page <?= $p ?> / <?= max(1, (int)ceil($total / $per)) ?></span><?php if ($p * $per < $total): ?><a class="btn sm" href="?p=<?= $p + 1 ?>">Plus ancien →</a><?php endif; ?></div>
<?php layout_end();
