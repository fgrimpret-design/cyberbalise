<?php
declare(strict_types=1);
require __DIR__ . '/inc/bootstrap.php';
require_once __DIR__ . '/inc/layout.php';
require __DIR__ . '/inc/pages.php';
$u = require_login();
$canCode = is_admin() && cfg('allow_code_edit', true);

/* =================== Création =================== */
if (isset($_GET['nouveau'])) {
    $err = '';
    $parents = parent_choices();
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        csrf_check();
        $title = trim((string)($_POST['title'] ?? ''));
        $slug = slugify((string)($_POST['slug'] ?? '') ?: $title);
        $desc = trim((string)($_POST['desc'] ?? ''));
        $lead = trim((string)($_POST['lead'] ?? '')) ?: $desc;
        $parent = (string)($_POST['parent'] ?? '');
        $aud = in_array($_POST['aud'] ?? '', ['part', 'pro', 'both'], true) ? $_POST['aud'] : 'both';
        $file = $parent . $slug . '/index.html';
        if ($title === '') $err = 'Indiquez un titre.';
        elseif (!array_key_exists($parent, $parents)) $err = 'Rubrique invalide.';
        elseif ($slug === '' || !page_name_ok($file)) $err = 'Adresse invalide : lettres, chiffres et tirets uniquement.';
        elseif (page_exists($file) || is_dir(SITE_ROOT . '/' . $parent . $slug)) $err = 'Une page existe déjà à l\'adresse ' . page_url_path($file) . '. Choisissez une autre adresse.';
        else {
            try {
                $content = "\n<h2 id=\"introduction\">Premier intertitre</h2>\n<p>Rédigez votre contenu ici.</p>\n";
                $src = new_page_source($file, $title, $desc, $lead, $aud, $content);
                $pub = ($_POST['etat'] ?? 'brouillon') === 'publier';
                write_page($file, $src, 'Création', $pub ? 'site' : 'brouillon');
                if ($pub) search_index_add($file);
                if (!empty($_POST['in_menu']) && is_admin() && $parent !== '') {
                    $secs = menu_items();
                    foreach ($secs as &$sec) if (rtrim($sec['href'], '/') === '/' . rtrim(explode('/', $parent)[0], '/')) $sec['items'][] = ['label' => mb_substr($title, 0, 60), 'href' => page_url_path($file), 'chip' => $aud];
                    unset($sec);
                    save_menu($secs);
                }
                log_action('Création de page', $file, $title);
                flash('ok', 'Page ' . page_url_path($file) . ' créée' . ($pub ? ' et publiée.' : ' en brouillon (invisible du public).'));
                redirect(url('edit.php?f=' . urlencode($file)));
            } catch (Throwable $t) { $err = $t->getMessage(); }
        }
    }
    layout_start('Nouvelle page', 'pages.php');
    ?>
    <form method="post" class="card" style="max-width:760px"><?= csrf_field() ?>
      <?php if ($err): ?><div class="flash err" role="alert"><?= e($err) ?></div><?php endif; ?>
      <div class="field"><label for="title">Titre de la page</label><input id="title" name="title" type="text" required maxlength="110" value="<?= e($_POST['title'] ?? '') ?>" autofocus><p class="help">Grand titre de la page, repris dans l'onglet du navigateur et dans Google.</p></div>
      <div class="field"><label for="parent">Rubrique</label><select id="parent" name="parent">
        <?php foreach ($parents as $k => $l): ?><option value="<?= e($k) ?>" <?= ($_POST['parent'] ?? '') === $k ? 'selected' : '' ?>><?= e($l) ?></option><?php endforeach; ?></select>
        <p class="help">La page sera rangée dans ce dossier, et son fil d'Ariane construit automatiquement.</p></div>
      <div class="field"><label for="slug">Adresse</label>
        <div class="row" style="gap:0;flex-wrap:nowrap"><span class="mono dim small" id="pfx" style="padding-right:6px;white-space:nowrap"></span><input id="slug" name="slug" type="text" maxlength="70" pattern="[a-z0-9\-]+" value="<?= e($_POST['slug'] ?? '') ?>" class="mono"><span class="mono dim small" style="padding-left:6px">/</span></div>
        <p class="help">Générée à partir du titre. Évitez de la changer après publication (les liens existants casseraient).</p></div>
      <div class="field"><label for="lead">Chapô</label><textarea id="lead" name="lead" maxlength="260" rows="2"><?= e($_POST['lead'] ?? '') ?></textarea><p class="help">Une ou deux phrases sous le titre.</p></div>
      <div class="field"><label for="desc">Description pour les moteurs de recherche</label><textarea id="desc" name="desc" maxlength="300" rows="2"><?= e($_POST['desc'] ?? '') ?></textarea><p class="help"><span id="dc">0</span> caractères · idéal entre 120 et 160.</p></div>
      <div class="field"><label>Public visé</label>
        <div class="row"><?php foreach (['both' => 'Les deux', 'part' => 'Particuliers', 'pro' => 'Professionnels'] as $k => $l): ?><label class="check" style="margin:0"><input type="radio" name="aud" value="<?= $k ?>" <?= ($_POST['aud'] ?? 'both') === $k ? 'checked' : '' ?>> <span><?= $l ?></span></label><?php endforeach; ?></div></div>
      <?php if (is_admin()): ?>
      <div class="field"><label class="check"><input type="checkbox" name="in_menu" value="1"> <span>Ajouter au menu déroulant de la rubrique</span></label></div>
      <?php endif; ?>
      <div class="field"><label>État</label>
        <label class="check"><input type="radio" name="etat" value="brouillon" checked> <span>Brouillon — rangé hors du site, visible uniquement dans le back office</span></label>
        <label class="check"><input type="radio" name="etat" value="publier"> <span>Publier immédiatement</span></label></div>
      <div class="row"><button class="btn pri">Créer et rédiger le contenu</button><a class="btn ghost" href="<?= e(url('pages.php')) ?>">Annuler</a></div>
    </form>
    <?php
    $host = json_encode(preg_replace('~^https?://~', '', cfg('site_url')) . '/');
    layout_end(<<<HTML
<script>
var t=document.getElementById('title'),s=document.getElementById('slug'),touched=!!s.value,d=document.getElementById('desc'),dc=document.getElementById('dc'),pa=document.getElementById('parent'),pfx=document.getElementById('pfx');
function sl(v){return v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/œ/g,'oe').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70)}
function px(){pfx.textContent=$host+pa.value}
t.addEventListener('input',function(){if(!touched)s.value=sl(t.value)});s.addEventListener('input',function(){touched=true});pa.addEventListener('change',px);px();
d.addEventListener('input',function(){dc.textContent=d.value.length});dc.textContent=d.value.length;
</script>
HTML);
    exit;
}

/* =================== Édition =================== */
$f = (string)($_GET['f'] ?? '');
try { $path = page_path($f); } catch (Throwable $t) { flash('err', 'Page introuvable.'); redirect(url('pages.php')); }
if (!is_file($path)) { flash('err', "Cette page n'existe pas."); redirect(url('pages.php')); }

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $mode = (string)($_POST['mode'] ?? '');
    $src = (string)file_get_contents($path);
    $mtime = (int)($_POST['mtime'] ?? 0);
    try {
        if ($mtime && $mtime !== filemtime($path) && empty($_POST['force'])) {
            throw new RuntimeException('Cette page a été modifiée par quelqu\'un d\'autre depuis que vous l\'avez ouverte. Copiez vos changements, rechargez la page puis réappliquez-les.');
        }
        if ($mode === 'visuel') {
            $parts = split_content($src);
            if (!$parts) throw new RuntimeException('Cette page ne peut pas être modifiée en mode visuel.');
            $html = (string)($_POST['contenu'] ?? '');
            $html = str_replace(['<?', '?>'], ['&lt;?', '?&gt;'], $html);
            $html = preg_replace(['~<script\b.*?</script>~is', '~<style\b.*?</style>~is', '~\son[a-z]+\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)~i', '~(href|src)\s*=\s*(["\']?)\s*javascript:~i'], ['', '', '', '$1=$2#'], $html);
            $new = $parts[0] . "\n" . trim($html) . "\n" . $parts[2];
            $h1 = trim((string)($_POST['h1'] ?? ''));
            $new = set_pagehead($new, $h1, trim((string)($_POST['lead'] ?? '')), !empty($_POST['touch_date']));
            $new = set_head_meta($new, trim((string)$_POST['title']), trim((string)$_POST['desc']));
            write_page($f, $new, 'Modification (visuel)');
            if ($h1 !== '' && !is_draft($f)) search_index_retitle($f, $h1);
            log_action('Modification', $f, 'Éditeur visuel');
        } elseif ($mode === 'code') {
            if (!$canCode) throw new RuntimeException('La modification du code est réservée aux administrateurs.');
            $code = str_replace("\r\n", "\n", (string)($_POST['code'] ?? ''));
            if (trim($code) === '') throw new RuntimeException('Le code est vide : enregistrement annulé.');
            if ($e = check_code($code)) throw new RuntimeException($e . '. La page n\'a pas été modifiée.');
            write_page($f, $code, 'Modification (code)');
            log_action('Modification', $f, 'Éditeur de code');
        } elseif ($mode === 'seo') {
            write_page($f, set_head_meta($src, trim((string)$_POST['title']), trim((string)$_POST['desc'])), 'Titre et description');
            log_action('Modification SEO', $f);
        } elseif ($mode === 'restore') {
            $old = read_version($f, (string)($_POST['v'] ?? ''));
            if ($old === null) throw new RuntimeException('Version introuvable.');
            write_page($f, $old, 'Restauration d\'une version');
            log_action('Restauration de version', $f, (string)$_POST['v']);
        }
        flash('ok', 'Modifications enregistrées.' . (is_draft($f) ? ' (Page en brouillon : non visible du public.)' : ''));
    } catch (Throwable $t) {
        flash('err', $t->getMessage());
        if ($mode === 'code' && isset($code)) $_SESSION['code_draft'][$f] = $code;
    }
    redirect(url('edit.php?f=' . urlencode($f) . '&onglet=' . urlencode($mode === 'restore' ? 'versions' : ($mode ?: 'visuel'))));
}

$path = page_path($f);
$src = (string)file_get_contents($path);
$parts = split_content($src);
$isDraft = is_draft($f);
$versions = list_versions($f);
$tab = (string)($_GET['onglet'] ?? ($parts ? 'visuel' : ($canCode ? 'code' : 'seo')));
if ($tab === 'visuel' && !$parts) $tab = $canCode ? 'code' : 'seo';
if ($tab === 'code' && !$canCode) $tab = 'seo';
$codeDraft = $_SESSION['code_draft'][$f] ?? null; unset($_SESSION['code_draft'][$f]);
$pageUrl = rtrim(cfg('site_url'), '/') . page_url_path($f);

$head = '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/jodit@4.2.27/es2021/jodit.min.css">'
      . '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.css">'
      . '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/theme/material-darker.min.css">';
layout_start(page_title($src) ?: $f, 'pages.php', $head);
?>
<div class="row" style="margin:-10px 0 16px">
  <a class="btn sm ghost" href="<?= e(url('pages.php')) ?>">← Pages</a>
  <span class="mono small muted"><?= e(page_url_path($f)) ?></span>
  <?= $isDraft ? '<span class="badge warn">Brouillon</span>' : '<span class="badge ok">En ligne</span>' ?>
  <span class="spacer"></span>
  <a class="btn sm" href="<?= e($isDraft ? url('apercu.php?f=' . urlencode($f)) : $pageUrl) ?>" target="_blank" rel="noopener"><?= $isDraft ? 'Aperçu ↗' : 'Voir la page ↗' ?></a>
  <a class="btn sm" href="<?= e(url('stats.php?page=' . urlencode(page_url_path($f)))) ?>">Statistiques</a>
  <form method="post" action="<?= e(url('pages.php')) ?>" style="display:inline"><?= csrf_field() ?><input type="hidden" name="file" value="<?= e($f) ?>"><input type="hidden" name="action" value="<?= $isDraft ? 'publish' : 'unpublish' ?>">
    <button class="btn sm <?= $isDraft ? 'pri' : '' ?>"><?= $isDraft ? 'Publier' : 'Repasser en brouillon' ?></button></form>
</div>

<div class="tabs" role="tablist">
  <?php foreach (['visuel' => 'Contenu', 'code' => 'Code source', 'seo' => 'Titre & référencement', 'versions' => 'Historique (' . count($versions) . ')'] as $k => $l):
      $dis = ($k === 'visuel' && !$parts) || ($k === 'code' && !$canCode); ?>
    <button type="button" role="tab" data-tab="<?= $k ?>" class="<?= $tab === $k ? 'on' : '' ?>" <?= $dis ? 'disabled title="' . ($k === 'visuel' ? 'Page interactive (outil) : modifiable en mode code' : 'Réservé aux administrateurs') . '"' : '' ?> aria-selected="<?= $tab === $k ? 'true' : 'false' ?>"><?= e($l) ?></button>
  <?php endforeach; ?>
</div>

<?php if ($parts): ?>
<section data-panel="visuel" <?= $tab !== 'visuel' ? 'hidden' : '' ?>>
  <form method="post" id="f-visuel"><?= csrf_field() ?><input type="hidden" name="mode" value="visuel"><input type="hidden" name="mtime" value="<?= filemtime($path) ?>">
    <div class="editor-grid">
      <div><textarea id="wys" name="contenu"><?= e($parts[1]) ?></textarea>
        <p class="dim small">Zone modifiée : corps de l'article. Le menu, l'en-tête de page et le pied de page ne sont pas touchés.</p></div>
      <div class="card stack">
        <div><label for="v-h1">Titre affiché (H1)</label><input id="v-h1" name="h1" type="text" maxlength="110" value="<?= e(page_h1($src)) ?>"></div>
        <div><label for="v-lead">Chapô</label><textarea id="v-lead" name="lead" rows="3" maxlength="300"><?= e(page_lead($src)) ?></textarea></div>
        <div><label for="v-title">Titre de l'onglet &amp; Google</label><input id="v-title" name="title" type="text" maxlength="120" value="<?= e(page_title($src)) ?>"></div>
        <div><label for="v-desc">Description</label><textarea id="v-desc" name="desc" rows="4" maxlength="300"><?= e(page_desc($src)) ?></textarea></div>
        <label class="check small"><input type="checkbox" name="touch_date" value="1" checked> <span>Mettre à jour la date « Mise à jour : <?= e(fr_month_year()) ?> »</span></label>
        <button class="btn pri" style="width:100%;justify-content:center">Enregistrer</button>
        <p class="dim small" style="margin:0">Chaque enregistrement crée une version restaurable dans « Historique ». Raccourci : Ctrl + S.</p>
      </div>
    </div>
  </form>
</section>
<?php endif; ?>

<?php if ($canCode): ?>
<section data-panel="code" <?= $tab !== 'code' ? 'hidden' : '' ?>>
  <form method="post" id="f-code"><?= csrf_field() ?><input type="hidden" name="mode" value="code"><input type="hidden" name="mtime" value="<?= filemtime($path) ?>">
    <div class="row" style="margin-bottom:10px"><span class="muted small">Fichier complet <span class="mono"><?= e($f) ?></span> · une version est sauvegardée à chaque enregistrement.</span><span class="spacer"></span>
      <button class="btn pri sm">Enregistrer le code</button></div>
    <?php if ($codeDraft !== null): ?><div class="flash info">Votre code non enregistré a été conservé ci-dessous. Corrigez l'erreur puis enregistrez.</div><?php endif; ?>
    <textarea id="code" name="code"><?= e($codeDraft ?? $src) ?></textarea>
  </form>
</section>
<?php endif; ?>

<section data-panel="seo" <?= $tab !== 'seo' ? 'hidden' : '' ?>>
  <form method="post" class="card" style="max-width:760px"><?= csrf_field() ?><input type="hidden" name="mode" value="seo"><input type="hidden" name="mtime" value="<?= filemtime($path) ?>">
    <div class="field"><label for="s-title">Titre</label><input id="s-title" name="title" type="text" maxlength="120" value="<?= e(page_title($src)) ?>"><p class="help"><span data-count="s-title"></span> caractères · idéal : moins de 60.</p></div>
    <div class="field"><label for="s-desc">Description</label><textarea id="s-desc" name="desc" rows="3" maxlength="300"><?= e(page_desc($src)) ?></textarea><p class="help"><span data-count="s-desc"></span> caractères · idéal : 120 à 160.</p></div>
    <p class="muted small" style="margin:0 0 6px">Aperçu dans Google</p>
    <div style="background:#fff;border-radius:10px;padding:14px 16px;margin-bottom:16px;font-family:Arial,sans-serif">
      <div style="color:#202124;font-size:12px"><?= e(preg_replace('~^https?://~', '', $pageUrl)) ?></div>
      <div id="g-t" style="color:#1a0dab;font-size:19px;line-height:1.3;margin:3px 0"></div>
      <div id="g-d" style="color:#4d5156;font-size:13.5px;line-height:1.5"></div>
    </div>
    <button class="btn pri">Enregistrer</button>
  </form>
</section>

<section data-panel="versions" <?= $tab !== 'versions' ? 'hidden' : '' ?>>
  <div class="card">
    <?php if (!$versions): ?><p class="empty">Aucune version précédente. Une copie est créée automatiquement à chaque enregistrement.</p>
    <?php else: ?>
    <table><thead><tr><th>Date</th><th>Par</th><th>Action enregistrée</th><th class="num">Taille</th><th></th></tr></thead><tbody>
    <?php foreach ($versions as $v): ?>
      <tr><td class="small" style="white-space:nowrap"><?= e(fr_date((int)$v['ts'])) ?></td><td><?= e($v['user']) ?></td><td class="muted small"><?= e($v['reason']) ?></td><td class="num small"><?= human_size((int)$v['size']) ?></td>
        <td style="text-align:right;white-space:nowrap"><button type="button" class="btn sm ghost" data-view="<?= e($v['id']) ?>">Afficher</button>
          <form method="post" style="display:inline" onsubmit="return confirm('Remplacer la page actuelle par cette version ? La version actuelle sera elle-même sauvegardée.')"><?= csrf_field() ?><input type="hidden" name="mode" value="restore"><input type="hidden" name="v" value="<?= e($v['id']) ?>"><button class="btn sm">Restaurer</button></form></td></tr>
    <?php endforeach; ?></tbody></table>
    <p class="dim small">Les 30 dernières versions sont conservées.</p>
    <?php endif; ?>
  </div>
</section>
<dialog id="dlg" style="max-width:1000px"><div class="row" style="margin-bottom:10px"><h2 style="margin:0">Version enregistrée</h2><span class="spacer"></span><button class="btn sm" onclick="this.closest('dialog').close()">Fermer</button></div><pre id="dlg-src" class="mono small" style="max-height:70vh;overflow:auto;background:#081522;padding:14px;border-radius:10px;white-space:pre-wrap"></pre></dialog>

<?php
$csrf = json_encode(csrf_token());
$upl = json_encode(url('medias.php?api=upload'));
$ver = json_encode(url('medias.php?api=version&f=' . urlencode($f) . '&v='));
$isAdmin = is_admin() ? 'true' : 'false';
layout_end(<<<HTML
<script src="https://cdn.jsdelivr.net/npm/jodit@4.2.27/es2021/jodit.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/xml/xml.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/javascript/javascript.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/css/css.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/htmlmixed/htmlmixed.min.js"></script>
<script>
var CSRF = $csrf, dirty = false, cm = null, jo = null;
/* Onglets */
document.querySelectorAll('[data-tab]').forEach(function (b) {
  b.addEventListener('click', function () {
    if (b.disabled) return;
    document.querySelectorAll('[data-tab]').forEach(function (x) { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); });
    document.querySelectorAll('[data-panel]').forEach(function (p) { p.hidden = p.dataset.panel !== b.dataset.tab; });
    if (b.dataset.tab === 'code' && cm) setTimeout(function () { cm.refresh(); }, 10);
    history.replaceState(null, '', location.pathname + location.search.replace(/&onglet=[^&]*/, '') + '&onglet=' + b.dataset.tab);
  });
});
/* Éditeur visuel */
if (document.getElementById('wys')) {
  jo = Jodit.make('#wys', {
    language: 'fr', theme: 'default', height: '68vh', iframe: true, iframeCSS: '/assets/fonts/fonts.css', iframeStyle: 'html{background:#fff}body{font:17px/1.68 \'Source Serif 4\',Georgia,serif;color:#132232;padding:26px 30px;max-width:900px;margin:0 auto}h2,h3{font-family:Archivo,sans-serif;line-height:1.2}h2{font-size:1.5rem;margin-top:1.6em}a{color:#0B545C}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #D7DFE8;padding:.6em;text-align:left;vertical-align:top}.note{background:#E3F0F1;border:1px solid #BFD9DC;border-radius:10px;padding:12px 16px}.warn{background:#FBEAE3;border:1px solid #F0C4B3;border-radius:10px;padding:12px 16px}img{max-width:100%;height:auto}', toolbarAdaptive: false, askBeforePasteHTML: false, askBeforePasteFromWord: false,
    defaultActionOnPaste: 'insert_clear_html', cleanHTML: { removeEmptyElements: false, fillEmptyParagraph: false },
    buttons: 'paragraph,bold,italic,|,ul,ol,|,link,image,table,|,hr,eraser,|,undo,redo,|,source,fullsize',
    uploader: { url: $upl, format: 'json', filesVariableName: function () { return 'files[]'; },
      prepareData: function (fd) { fd.append('csrf', CSRF); return fd; },
      isSuccess: function (r) { return r.success; }, getMessage: function (r) { return r.message || ''; },
      process: function (r) { return { files: r.data.files, path: '', baseurl: r.data.baseurl, error: r.success ? 0 : 1, msg: r.message }; } },
    events: { change: function () { dirty = true; } }
  });
}
/* Éditeur de code */
if (document.getElementById('code')) {
  cm = CodeMirror.fromTextArea(document.getElementById('code'), { mode: 'htmlmixed', theme: 'material-darker', lineNumbers: true, lineWrapping: true, indentUnit: 4 });
  cm.on('change', function () { dirty = true; });
  if (!document.querySelector('[data-panel=code]').hidden) setTimeout(function () { cm.refresh(); }, 10);
}
/* Compteurs & aperçu Google */
function upd() {
  var t = document.getElementById('s-title'), d = document.getElementById('s-desc');
  document.querySelectorAll('[data-count]').forEach(function (c) { c.textContent = document.getElementById(c.dataset.count).value.length; });
  document.getElementById('g-t').textContent = (t.value || 'Sans titre').slice(0, 62) + (t.value.length > 62 ? '…' : '');
  document.getElementById('g-d').textContent = (d.value || 'Aucune description : Google choisira un extrait de la page.').slice(0, 160) + (d.value.length > 160 ? '…' : '');
}
['s-title', 's-desc'].forEach(function (id) { document.getElementById(id).addEventListener('input', function () { dirty = true; upd(); }); });
upd();
/* Versions */
document.querySelectorAll('[data-view]').forEach(function (b) {
  b.addEventListener('click', function () {
    fetch($ver + b.dataset.view).then(function (r) { return r.text(); }).then(function (t) { document.getElementById('dlg-src').textContent = t; document.getElementById('dlg').showModal(); });
  });
});
/* Protection contre la perte de modifications + Ctrl+S */
document.querySelectorAll('form').forEach(function (f) { f.addEventListener('submit', function () { dirty = false; if (cm) cm.save(); }); });
window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
document.addEventListener('keydown', function (e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    var p = document.querySelector('[data-panel]:not([hidden]) form'); if (p) { dirty = false; if (cm) cm.save(); p.submit(); }
  }
});
</script>
HTML);
