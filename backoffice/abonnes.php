<?php
/* Abonnés à la newsletter : suivi des inscriptions, export CSV des adresses confirmées, suppression. */
declare(strict_types=1);
require __DIR__ . '/inc/bootstrap.php';
require_once __DIR__ . '/inc/layout.php';
require __DIR__ . '/inc/stats.php';
require __DIR__ . '/inc/newsletter.php';
require_login('admin');
nl_table();

if (($_GET['export'] ?? '') === 'csv') {
    $rows = q("SELECT email, confirmed_at, source FROM cr_newsletter WHERE status = 'confirmed' ORDER BY confirmed_at");
    log_action('Export abonnés', 'cr_newsletter', count($rows) . ' adresses');
    header('Content-Type: text/csv; charset=UTF-8');
    header('Content-Disposition: attachment; filename="abonnes-newsletter-' . date('Y-m-d') . '.csv"');
    header('Cache-Control: no-store');
    echo "\xEF\xBB\xBF" . "email;date_confirmation;source\r\n";
    foreach ($rows as $r) echo $r['email'] . ';' . date('Y-m-d', (int)$r['confirmed_at']) . ';' . preg_replace('/[^a-z0-9_\-]/i', '', (string)$r['source']) . "\r\n";
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $id = (int)($_POST['id'] ?? 0);
    if (($_POST['do'] ?? '') === 'delete' && $id > 0) {
        db()->prepare('DELETE FROM cr_newsletter WHERE id = ?')->execute([$id]);
        log_action('Suppression abonné', '#' . $id);
        flash('ok', 'Adresse supprimée.');
    }
    redirect(url('abonnes.php'));
}

$count = [];
foreach (q('SELECT status, COUNT(*) n FROM cr_newsletter GROUP BY status') as $r) $count[$r['status']] = (int)$r['n'];
$rows = q('SELECT * FROM cr_newsletter ORDER BY created_at DESC LIMIT 200');
$labels = ['confirmed' => 'Confirmé', 'pending' => 'En attente de confirmation', 'unsubscribed' => 'Désinscrit'];
layout_start('Abonnés à la newsletter', 'abonnes.php');
?>
<div class="grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px">
  <?= kpi('Abonnés confirmés', fr_num($count['confirmed'] ?? 0)) ?>
  <?= kpi('En attente de confirmation', fr_num($count['pending'] ?? 0), null, 'Supprimés automatiquement après ' . (int)nl_cfg()['pending_days'] . ' jours') ?>
  <?= kpi('Désinscrits', fr_num($count['unsubscribed'] ?? 0)) ?>
</div>
<div class="row" style="margin-bottom:12px"><a class="btn" href="?export=csv">Exporter les abonnés confirmés (CSV)</a></div>
<p class="muted small">Seules les adresses confirmées (double opt-in) peuvent recevoir la lettre. Chaque envoi doit contenir un lien de désinscription (<code><?= e(nl_link('unsub', '…')) ?></code>) ; si vous utilisez un outil d'envoi externe, mettez à jour la politique de confidentialité avant d'y importer la liste.</p>
<div class="card" style="padding:6px 8px"><div class="tbl-wrap"><table>
  <thead><tr><th>Adresse</th><th>Statut</th><th>Inscription</th><th>Confirmation</th><th>Source</th><th></th></tr></thead><tbody>
  <?php if (!$rows): ?><tr><td colspan="6" class="empty">Aucune inscription pour l'instant.</td></tr><?php endif; ?>
  <?php foreach ($rows as $r): ?><tr>
    <td class="mono small"><?= e($r['email']) ?></td>
    <td><?= e($labels[$r['status']] ?? $r['status']) ?></td>
    <td class="small mono" style="white-space:nowrap"><?= e(fr_date((int)$r['created_at'])) ?></td>
    <td class="small mono" style="white-space:nowrap"><?= $r['confirmed_at'] ? e(fr_date((int)$r['confirmed_at'])) : '—' ?></td>
    <td class="small"><?= e($r['source'] ?: '—') ?></td>
    <td><form method="post" onsubmit="return confirm('Supprimer définitivement cette adresse ?')"><?= csrf_field() ?><input type="hidden" name="do" value="delete"><input type="hidden" name="id" value="<?= (int)$r['id'] ?>"><button class="btn sm" type="submit">Supprimer</button></form></td>
  </tr><?php endforeach; ?>
  </tbody></table></div></div>
<?php layout_end();
