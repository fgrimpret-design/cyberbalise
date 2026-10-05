<?php
declare(strict_types=1);
require __DIR__ . '/inc/bootstrap.php';
require_once __DIR__ . '/inc/layout.php';
require __DIR__ . '/inc/pages.php';
require_login();

const MEDIA_DIR = 'uploads';
const MEDIA_TYPES = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'gif' => 'image/gif', 'webp' => 'image/webp',
                     'pdf' => 'application/pdf', 'csv' => 'text/csv', 'zip' => 'application/zip', 'mp4' => 'video/mp4'];
const MEDIA_MAX = 10 * 1024 * 1024;
$dir = SITE_ROOT . '/' . MEDIA_DIR;
if (!is_dir($dir)) @mkdir($dir, 0755, true);
if (!is_file("$dir/.htaccess")) {
    // Aucun script ne peut s'exécuter dans le dossier des médias
    @file_put_contents("$dir/.htaccess", "Options -Indexes -ExecCGI\nRemoveHandler .php .phtml .php3 .php4 .php5 .php7 .php8 .phar\n<FilesMatch \"\\.(php|phtml|phar|php\\d)$\">\n  Require all denied\n</FilesMatch>\n");
}

function store_upload(array $file, string $dir): array {
    if (($file['error'] ?? 1) !== UPLOAD_ERR_OK) throw new RuntimeException('Envoi interrompu (code ' . (int)$file['error'] . '). Taille maximale autorisée par le serveur : ' . ini_get('upload_max_filesize') . '.');
    if ($file['size'] > MEDIA_MAX) throw new RuntimeException('Fichier trop lourd (10 Mo maximum).');
    $ext = strtolower(pathinfo((string)$file['name'], PATHINFO_EXTENSION));
    if (!isset(MEDIA_TYPES[$ext])) throw new RuntimeException('Type de fichier non autorisé. Formats acceptés : ' . implode(', ', array_keys(MEDIA_TYPES)) . '.');
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    $okMime = $mime === MEDIA_TYPES[$ext] || ($ext === 'csv' && in_array($mime, ['text/plain', 'application/csv'], true)) || ($ext === 'zip' && $mime === 'application/x-zip-compressed');
    if (!$okMime) throw new RuntimeException("Le contenu du fichier ne correspond pas à son extension ($mime).");
    if (in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp'], true) && !@getimagesize($file['tmp_name'])) throw new RuntimeException('Image illisible ou corrompue.');
    $base = slugify(pathinfo((string)$file['name'], PATHINFO_FILENAME)) ?: 'fichier';
    $name = "$base.$ext"; $i = 2;
    while (is_file("$dir/$name")) $name = "$base-" . $i++ . ".$ext";
    if (!move_uploaded_file($file['tmp_name'], "$dir/$name")) throw new RuntimeException('Enregistrement impossible (permissions du dossier uploads).');
    @chmod("$dir/$name", 0644);
    log_action('Média ajouté', $name, human_size((int)$file['size']));
    return ['name' => $name, 'url' => '/' . MEDIA_DIR . '/' . $name];
}
function reorder_files(array $f): array {
    if (!is_array($f['name'])) return [$f];
    $out = [];
    foreach ($f['name'] as $i => $n) $out[] = ['name' => $n, 'type' => $f['type'][$i], 'tmp_name' => $f['tmp_name'][$i], 'error' => $f['error'][$i], 'size' => $f['size'][$i]];
    return $out;
}

/* ---------- API : envoi depuis l'éditeur visuel & lecture de version ---------- */
if (($_GET['api'] ?? '') === 'upload') {
    csrf_check();
    header('Content-Type: application/json; charset=utf-8');
    $res = []; $msg = '';
    foreach (reorder_files($_FILES['files'] ?? ['name' => []]) as $file) {
        try { $res[] = store_upload($file, $dir)['url']; } catch (Throwable $t) { $msg = $t->getMessage(); }
    }
    echo json_encode(['success' => (bool)$res, 'message' => $msg, 'data' => ['files' => $res, 'baseurl' => '', 'isImages' => array_fill(0, count($res), true)]]);
    exit;
}
if (($_GET['api'] ?? '') === 'version') {
    header('Content-Type: text/plain; charset=utf-8');
    echo read_version((string)($_GET['f'] ?? ''), (string)($_GET['v'] ?? '')) ?? 'Version introuvable.';
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    if (($_POST['action'] ?? '') === 'delete') {
        $n = basename((string)($_POST['name'] ?? ''));
        if (is_admin() && $n !== '' && $n[0] !== '.' && is_file("$dir/$n")) { @unlink("$dir/$n"); log_action('Média supprimé', $n); flash('ok', "« $n » supprimé."); }
        else flash('err', 'Suppression impossible.');
    } else {
        $ok = 0;
        foreach (reorder_files($_FILES['files'] ?? ['name' => []]) as $file) {
            if (($file['name'] ?? '') === '') continue;
            try { store_upload($file, $dir); $ok++; } catch (Throwable $t) { flash('err', $file['name'] . ' : ' . $t->getMessage()); }
        }
        if ($ok) flash('ok', "$ok fichier(s) ajouté(s).");
    }
    redirect(url('medias.php'));
}

$files = [];
foreach (glob("$dir/*") ?: [] as $p) {
    if (!is_file($p) || basename($p)[0] === '.') continue;
    $files[] = ['name' => basename($p), 'size' => filesize($p), 'mtime' => filemtime($p), 'img' => (bool)preg_match('/\.(jpe?g|png|gif|webp)$/i', $p)];
}
usort($files, fn($a, $b) => $b['mtime'] <=> $a['mtime']);

layout_start('Médias', 'medias.php');
?>
<form method="post" enctype="multipart/form-data" class="drop" id="drop"><?= csrf_field() ?>
  <p style="margin:0 0 10px">Glissez des fichiers ici ou</p>
  <label class="btn pri" style="display:inline-flex;margin:0">Choisir des fichiers<input type="file" name="files[]" multiple accept="<?= e('.' . implode(',.', array_keys(MEDIA_TYPES))) ?>" hidden onchange="this.form.submit()"></label>
  <p class="dim small" style="margin:10px 0 0">Images, PDF, CSV, ZIP, MP4 · 10 Mo maximum · enregistrés dans <span class="mono">/<?= MEDIA_DIR ?>/</span></p>
</form>

<div class="row" style="margin:18px 0 12px"><h2 style="margin:0"><?= count($files) ?> fichier(s)</h2><span class="spacer"></span><input type="search" id="q" placeholder="Rechercher" style="max-width:240px" aria-label="Rechercher un média"></div>
<?php if (!$files): ?><div class="card empty">Aucun média pour l'instant.</div><?php endif; ?>
<div class="media-grid">
<?php foreach ($files as $m): $u = '/' . MEDIA_DIR . '/' . rawurlencode($m['name']); ?>
  <div class="media" data-q="<?= e(strtolower($m['name'])) ?>">
    <div class="th" <?= $m['img'] ? 'style="background-image:url(\'' . e(rtrim(cfg('site_url'), '/') . $u) . '\')"' : '' ?>><?= $m['img'] ? '' : e(strtoupper(pathinfo($m['name'], PATHINFO_EXTENSION))) ?></div>
    <div class="meta"><span class="trunc" title="<?= e($m['name']) ?>"><?= e($m['name']) ?></span><span class="dim"><?= human_size((int)$m['size']) ?></span>
      <div class="row" style="gap:4px;margin-top:6px"><button type="button" class="btn sm" data-copy="<?= e($u) ?>">Copier le lien</button>
      <?php if (is_admin()): ?><form method="post" onsubmit="return confirm('Supprimer définitivement ce fichier ? Les pages qui l\'utilisent afficheront une image manquante.')"><?= csrf_field() ?><input type="hidden" name="action" value="delete"><input type="hidden" name="name" value="<?= e($m['name']) ?>"><button class="btn sm danger" aria-label="Supprimer">×</button></form><?php endif; ?></div>
    </div>
  </div>
<?php endforeach; ?>
</div>
<?php layout_end(<<<'HTML'
<script>
var d = document.getElementById('drop'), inp = d.querySelector('input[type=file]');
['dragenter','dragover'].forEach(function (ev) { d.addEventListener(ev, function (e) { e.preventDefault(); d.classList.add('over'); }); });
['dragleave','drop'].forEach(function (ev) { d.addEventListener(ev, function (e) { e.preventDefault(); d.classList.remove('over'); }); });
d.addEventListener('drop', function (e) { inp.files = e.dataTransfer.files; d.submit(); });
document.querySelectorAll('[data-copy]').forEach(function (b) { b.addEventListener('click', function () { navigator.clipboard.writeText(b.dataset.copy); b.textContent = 'Copié'; setTimeout(function () { b.textContent = 'Copier le lien'; }, 1500); }); });
document.getElementById('q').addEventListener('input', function () { var v = this.value.toLowerCase(); document.querySelectorAll('.media').forEach(function (m) { m.style.display = m.dataset.q.includes(v) ? '' : 'none'; }); });
</script>
HTML);
