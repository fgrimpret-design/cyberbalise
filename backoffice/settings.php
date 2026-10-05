<?php
declare(strict_types=1);
require __DIR__ . '/inc/bootstrap.php';
require_once __DIR__ . '/inc/layout.php';
require __DIR__ . '/inc/pages.php';
require __DIR__ . '/inc/stats.php';
require_login('admin');
$st = settings();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $a = $_POST['action'] ?? 'save';
    if ($a === 'save') {
        $ex = array_values(array_filter(array_map('trim', explode("\n", (string)$_POST['exclude_paths']))));
        save_settings([
            'tracking' => !empty($_POST['tracking']), 'respect_dnt' => !empty($_POST['respect_dnt']),
            'retention_months' => max(1, min(25, (int)$_POST['retention_months'])), 'exclude_paths' => $ex,
        ]);
        log_action('Réglages modifiés');
        flash('ok', 'Réglages enregistrés.');
    } elseif ($a === 'purge') {
        db()->exec('DELETE FROM cr_hits'); db()->exec('DELETE FROM cr_events');
        log_action('Statistiques effacées');
        flash('ok', 'Toutes les statistiques ont été effacées.');
    } elseif ($a === 'tracking_off_all') {
        [$done] = tracking_all(false);
        log_action('Mesure retirée de tout le site', '', count($done) . ' page(s)');
        flash('ok', count($done) . ' page(s) mises à jour.');
    }
    redirect(url('settings.php'));
}
$nHits = (int)q1('SELECT COUNT(*) FROM cr_hits');
$first = q1('SELECT MIN(day) FROM cr_hits');
$dbFile = DATA_DIR . '/cyberbalise.sqlite';
$checks = [
    ['PHP ' . PHP_VERSION, version_compare(PHP_VERSION, '8.0', '>=')],
    ['Extension PDO SQLite', extension_loaded('pdo_sqlite') || (cfg('db')['driver'] ?? '') === 'mysql'],
    ['Écriture dans le dossier du site', is_writable(SITE_ROOT) && is_writable(SITE_ROOT . '/index.html')],
    ['Écriture dans le dossier des données', is_writable(DATA_DIR)],
    ['Connexion HTTPS', is_https()],
    ['Dossier des données protégé', is_file(DATA_DIR . '/.htaccess') || !str_starts_with(realpath(DATA_DIR) ?: '', SITE_ROOT)],
];
layout_start('Réglages', 'settings.php');
?>
<div class="grid g-main">
  <form method="post" class="card"><?= csrf_field() ?><input type="hidden" name="action" value="save">
    <h2>Mesure d'audience</h2>
    <div class="field"><label class="check"><input type="checkbox" name="tracking" value="1" <?= !empty($st['tracking']) ? 'checked' : '' ?>><span><strong>Enregistrer les visites</strong><br><span class="muted small">Décochez pour suspendre la collecte sans retirer le script des pages.</span></span></label></div>
    <div class="field"><label class="check"><input type="checkbox" name="respect_dnt" value="1" <?= !empty($st['respect_dnt']) ? 'checked' : '' ?>><span>Ne pas compter les visiteurs ayant activé « Do Not Track »<br><span class="muted small">S'applique aux pages enregistrées après ce réglage.</span></span></label></div>
    <div class="field"><label for="ret">Durée de conservation (mois)</label><input id="ret" name="retention_months" type="number" min="1" max="25" value="<?= (int)$st['retention_months'] ?>" style="max-width:120px">
      <p class="help">La CNIL recommande 25 mois maximum pour les données de mesure d'audience. Les données plus anciennes sont supprimées automatiquement.</p></div>
    <div class="field"><label for="ex">Chemins exclus des statistiques</label><textarea id="ex" name="exclude_paths" rows="3" class="mono" placeholder="/page-test/&#10;/outils/quiz-niveau-cyber/"><?= e(implode("\n", (array)$st['exclude_paths'])) ?></textarea><p class="help">Un chemin par ligne. Toute adresse qui commence par ce chemin est ignorée.</p></div>
    <button class="btn pri">Enregistrer</button>
  </form>
  <div class="stack">
    <div class="card">
      <h2>Vérifications</h2>
      <table><tbody><?php foreach ($checks as [$l, $ok]): ?><tr><td><?= e($l) ?></td><td style="text-align:right"><?= $ok ? '<span class="badge ok">OK</span>' : '<span class="badge ko">À corriger</span>' ?></td></tr><?php endforeach; ?></tbody></table>
    </div>
    <div class="card">
      <h2>Données</h2>
      <p class="muted small"><?= fr_num($nHits) ?> pages vues enregistrées<?= $first ? ' depuis le ' . e(fr_date(strtotime($first), false)) : '' ?><?= is_file($dbFile) ? ' · base : ' . human_size((int)filesize($dbFile)) : '' ?>.</p>
      <div class="row">
        <form method="post" onsubmit="return confirm('Retirer le script de mesure de toutes les pages ?')"><?= csrf_field() ?><input type="hidden" name="action" value="tracking_off_all"><button class="btn sm">Retirer la mesure de toutes les pages</button></form>
        <form method="post" onsubmit="return confirm('Effacer définitivement toutes les statistiques ? Cette action est irréversible.')"><?= csrf_field() ?><input type="hidden" name="action" value="purge"><button class="btn sm danger">Effacer les statistiques</button></form>
      </div>
    </div>
    <div class="card">
      <h2>Mention pour la politique de confidentialité</h2>
      <p class="muted small">À ajouter à votre page Confidentialité :</p>
      <p class="small" style="background:#081522;padding:12px;border-radius:8px;line-height:1.6">« Nous mesurons la fréquentation de ce site avec un outil interne, hébergé sur nos propres serveurs. Il ne dépose aucun cookie, ne conserve pas votre adresse IP et ne permet pas de vous identifier : un identifiant anonyme, renouvelé chaque jour, sert uniquement à compter les visites. Les statistiques sont réservées à l'usage de CyberBalise, ne sont transmises à aucun tiers et sont conservées <?= (int)$st['retention_months'] ?> mois au maximum. »</p>
    </div>
  </div>
</div>
<?php layout_end();
