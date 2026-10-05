<?php
declare(strict_types=1);
require __DIR__ . '/inc/bootstrap.php';
require_once __DIR__ . '/inc/layout.php';
require __DIR__ . '/inc/pages.php';
require_login('admin');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    try {
        $raw = json_decode((string)($_POST['menu'] ?? ''), true);
        if (!is_array($raw) || !$raw) throw new RuntimeException('Menu vide : enregistrement annulé.');
        $ok = fn(string $h) => (bool)preg_match('~^(/[a-z0-9_\-/]*(#[\w\-]+)?|https://[^\s"<>]+)$~i', $h);
        $sections = [];
        foreach ($raw as $s) {
            $l = trim((string)($s['label'] ?? '')); $h = trim((string)($s['href'] ?? ''));
            if ($l === '' || $h === '') continue;
            if (!$ok($h)) throw new RuntimeException("Lien invalide pour « $l » : $h (exemple attendu : /pro/menaces/)");
            $items = [];
            foreach ((array)($s['items'] ?? []) as $i) {
                $il = trim((string)($i['label'] ?? '')); $ih = trim((string)($i['href'] ?? ''));
                if ($il === '' || $ih === '') continue;
                if (!$ok($ih)) throw new RuntimeException("Lien invalide pour « $il » : $ih");
                $items[] = ['label' => mb_substr($il, 0, 70), 'href' => $ih, 'chip' => in_array($i['chip'] ?? '', ['part', 'pro', 'both'], true) ? $i['chip'] : ''];
            }
            $sections[] = ['label' => mb_substr($l, 0, 30), 'href' => $h, 'items' => $items];
        }
        if (count($sections) > 6) throw new RuntimeException('6 rubriques maximum : au-delà, le menu ne tient plus sur une ligne.');
        [$done, $skip] = save_menu($sections);
        log_action('Menu modifié', '', count($sections) . ' rubriques · ' . $done . ' pages mises à jour');
        flash('ok', "Menu enregistré et appliqué à $done page(s)." . ($skip ? ' Non concernées (sans repère de menu) : ' . count($skip) . '.' : ''));
    } catch (Throwable $t) { flash('err', $t->getMessage()); }
    redirect(url('menu.php'));
}

$sections = menu_items();
$urls = array_map(fn($p) => [page_url_path($p['file']), $p['title']], array_filter(list_pages(), fn($p) => !$p['draft']));
layout_start('Menu du site', 'menu.php');
?>
<div class="grid g-main">
  <div class="card">
    <div class="row" style="margin-bottom:6px"><h2 style="margin:0">Rubriques et sous-menus</h2><span class="spacer"></span><button type="button" class="btn sm" id="add-sec">+ Rubrique</button></div>
    <p class="muted small" style="margin:0 0 14px">Le menu est identique sur toutes les pages (ordinateur et mobile). Glissez les lignes pour réordonner.</p>
    <div id="secs"></div>
    <form method="post" id="f"><?= csrf_field() ?><input type="hidden" name="menu" id="menu">
      <div class="row" style="margin-top:16px"><button class="btn pri">Enregistrer et appliquer à tout le site</button><span class="dim small">Une copie de chaque page est conservée dans son historique.</span></div></form>
  </div>
  <div class="card">
    <h2>Mode d'emploi</h2>
    <ul class="small muted" style="padding-left:18px;line-height:1.7">
      <li><strong>Rubrique</strong> : entrée du menu principal (4 ou 5 au maximum pour rester lisible).</li>
      <li><strong>Sous-menu</strong> : liens du menu déroulant, avec la pastille de public (Particuliers, Pros, Les deux).</li>
      <li>Les adresses commencent par « / » et finissent par « / », par ex. <span class="mono">/pro/menaces/</span>. Commencez à taper : la liste propose les pages existantes.</li>
      <li>Retirer un lien du menu ne supprime pas la page.</li>
    </ul>
    <datalist id="urls"><?php foreach ($urls as [$u, $t]): ?><option value="<?= e($u) ?>"><?= e($t) ?></option><?php endforeach; ?></datalist>
  </div>
</div>
<?php
$js = json_encode($sections, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
layout_end(<<<HTML
<script>
var S = $js, box = document.getElementById('secs');
var CH = {'':'Sans pastille', part:'Particuliers', pro:'Pros', both:'Les deux'};
function el(h){var d=document.createElement('div');d.innerHTML=h.trim();return d.firstChild}
function esc(s){return String(s||'').replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function itemRow(i){i=i||{};return el('<li draggable="true" class="mi"><span class="grip" aria-hidden="true">⋮⋮</span><input type="text" class="il" placeholder="Libellé" value="'+esc(i.label)+'" aria-label="Libellé"><input type="text" class="ih mono" list="urls" placeholder="/rubrique/page/" value="'+esc(i.href)+'" aria-label="Adresse"><select class="ic" aria-label="Pastille">'+Object.keys(CH).map(function(k){return '<option value="'+k+'"'+((i.chip||'')===k?' selected':'')+'>'+CH[k]+'</option>'}).join('')+'</select><button type="button" class="btn sm ghost" data-del aria-label="Retirer">×</button></li>')}
function secBox(s){s=s||{items:[]};var b=el('<div class="card sec" draggable="true" style="background:var(--panel2);margin-bottom:12px;padding:14px"><div class="row" style="flex-wrap:nowrap"><span class="grip" aria-hidden="true">⋮⋮</span><input type="text" class="sl" placeholder="Nom de la rubrique" value="'+esc(s.label)+'" style="font-weight:600" aria-label="Rubrique"><input type="text" class="sh mono" list="urls" placeholder="/rubrique/" value="'+esc(s.href)+'" aria-label="Adresse de la rubrique"><button type="button" class="btn sm danger" data-delsec aria-label="Supprimer la rubrique">×</button></div><ul class="menu-list" style="margin:10px 0 0 22px"></ul><button type="button" class="btn sm ghost" data-additem style="margin:6px 0 0 22px">+ Lien de sous-menu</button></div>');var ul=b.querySelector('ul');(s.items||[]).forEach(function(i){ul.appendChild(itemRow(i))});return b}
S.forEach(function(s){box.appendChild(secBox(s))});
document.getElementById('add-sec').onclick=function(){var b=secBox();box.appendChild(b);b.querySelector('.sl').focus()};
box.addEventListener('click',function(e){
  if(e.target.matches('[data-del]'))e.target.closest('li').remove();
  if(e.target.matches('[data-delsec]')&&confirm('Retirer cette rubrique et son sous-menu ?'))e.target.closest('.sec').remove();
  if(e.target.matches('[data-additem]')){var li=itemRow();e.target.previousElementSibling.appendChild(li);li.querySelector('input').focus()}
});
var drag=null;
box.addEventListener('dragstart',function(e){drag=e.target.closest('li')||e.target.closest('.sec');if(drag)drag.classList.add('drag')});
box.addEventListener('dragend',function(){if(drag)drag.classList.remove('drag');drag=null});
box.addEventListener('dragover',function(e){if(!drag)return;e.preventDefault();var sel=drag.tagName==='LI'?'li':'.sec',t=e.target.closest(sel);if(!t||t===drag||t.parentNode!==drag.parentNode)return;var r=t.getBoundingClientRect();t.parentNode.insertBefore(drag,e.clientY>r.top+r.height/2?t.nextSibling:t)});
document.getElementById('f').addEventListener('submit',function(){
  document.getElementById('menu').value=JSON.stringify([].map.call(box.querySelectorAll('.sec'),function(b){return{label:b.querySelector('.sl').value,href:b.querySelector('.sh').value,items:[].map.call(b.querySelectorAll('li.mi'),function(li){return{label:li.querySelector('.il').value,href:li.querySelector('.ih').value,chip:li.querySelector('.ic').value}})}}));
});
</script>
HTML);
