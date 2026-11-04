/* =====================================================================
   CyberBalise : interface du détecteur d'arnaque (étapes, import, rendu du verdict).
   Le moteur d'analyse est dans moteur.js, ses règles dans regles.js.
   Règle de sécurité : tout texte venant de l'utilisateur est écrit avec textContent ou des
   nœuds texte (fonction h), jamais avec innerHTML.
   ===================================================================== */
(function(){
  'use strict';
  var Engine = window.CyberBaliseEngine, Rules = window.CyberBaliseRules;
  var ocrBox = document.getElementById('sd-ocr');
  if(!Engine || !Rules){ if(ocrBox) ocrBox.textContent = 'Le détecteur n\'a pas pu se charger. Rechargez la page.'; return; }

  /* =====================================================================
     CONFIGURATION : inscription à la newsletter CyberBalise.
     Par défaut : script PHP du site (backoffice/newsletter.php), double opt-in, adresses stockées sur le site.
     Pour utiliser un service externe : endpoint = adresse de son formulaire public, adapter = 'form'
     (Brevo, MailerLite… ; emailField = nom du champ e-mail, extra = champs fixes). Endpoint vide = module masqué.
     Pour prévisualiser le module sans rien envoyer : ajouter ?nl=preview à l'adresse de la page.
     Seule l'adresse e-mail (et la preuve de consentement) est transmise : jamais le message analysé.
     ===================================================================== */
  var CB_NEWSLETTER = { endpoint: '/backoffice/newsletter.php', adapter: 'json', emailField: 'EMAIL', extra: { source: 'detecteur-arnaque' }, doubleOptIn: true };
  var NL_PREVIEW = /[?&]nl=preview\b/.test(location.search);
  var SHARE_URL = 'https://cyberbalise.fr/outils/detecteur-arnaque/';

  /* Point d'entrée unique pour l'inscription. Retourne une promesse (rejetée en cas d'échec). */
  function subscribeNewsletter(email){
    var c = CB_NEWSLETTER;
    if(NL_PREVIEW) return new Promise(function(ok){ setTimeout(ok, 700); });
    if(!c.endpoint) return Promise.reject(new Error('newsletter_non_configuree'));
    if(c.adapter === 'json'){
      var payload = {}; Object.keys(c.extra || {}).forEach(function(k){ payload[k] = c.extra[k]; }); payload.email = email; payload.consent = true;
      return fetch(c.endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
        .then(function(r){ if(!r.ok) throw new Error('http_' + r.status); });
    }
    var body = new URLSearchParams(); Object.keys(c.extra || {}).forEach(function(k){ body.set(k, c.extra[k]); });
    body.set(c.emailField || 'EMAIL', email);
    return fetch(c.endpoint, { method:'POST', mode:'no-cors', body: body });
  }

  /* ===== Mesure d'audience : outil interne (window.crTrack, chargé après consentement) ;
         compatible GA4/GTM si gtag ou dataLayer existent un jour. Sans consentement : rien n'est envoyé.
         Jamais le texte du message : uniquement des identifiants (niveau, scénario, canal). ===== */
  function track(name, val){
    try{ if(typeof window.crTrack === 'function') window.crTrack(name, val || ''); }catch(e){}
    try{
      var p = {}; if(val){ if(name === 'analyse_terminee') p.niveau_risque = val; else if(name === 'partage_clic') p.canal = val; else if(name === 'scenario_detecte') p.scenario = val; else p.methode = val; }
      if(typeof window.gtag === 'function') window.gtag('event', name, p);
      else if(Array.isArray(window.dataLayer)){ p.event = name; window.dataLayer.push(p); }
    }catch(e){}
  }

  var el = function(id){ return document.getElementById(id); };
  function esc(s){ var d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
  /* Construit un élément DOM : les textes passent toujours par des nœuds texte. */
  function h(tag, props, kids){
    var e = document.createElement(tag);
    if(props) Object.keys(props).forEach(function(k){
      var v = props[k]; if(v == null || v === false) return;
      if(k === 'cls') e.className = v; else if(k === 'text') e.textContent = v; else e.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function(c){ if(c == null || c === false) return; e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var input = el('sd-in'), go = el('sd-go'), card = el('sd-card'), res = el('sd-res');
  var step = 1, started = false, isDemo = false, importVersion = 0, previewUrl = null, qrUrls = [];

  /* ===== Navigation entre les 3 étapes ===== */
  function setStep(n){
    step = n; card.dataset.step = n;
    el('sd-p1').hidden = n !== 1; el('sd-p2').hidden = n !== 2; res.hidden = n !== 3;
    [].forEach.call(el('sd-steps').children, function(li){
      var s = +li.dataset.s; li.classList.toggle('is-done', s < n); li.classList.toggle('is-cur', s === n);
      if(s === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    if(n > 1) el('sd').scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block:'start'});
  }
  function upd(){ go.disabled = input.value.trim().length < 8 && !qrUrls.length; }
  function msg(t, err){ var o = el('sd-ocr'); o.textContent = t || ''; o.classList.toggle('err', !!err); }
  function trackStart(m){ if(!started){ started = true; track('outil_lance', m); } }

  /* ===== Type de message : SMS ou e-mail (change les champs proposés) ===== */
  var msgType = 'sms', typeManual = false;
  function setType(t, manual){
    msgType = t; if(manual) typeManual = true;
    var mail = t === 'email';
    el('sd-type-banner').textContent = mail ? '2. Renseignez l\'e-mail à analyser' : '2. Renseignez le SMS à analyser';
    document.querySelectorAll('.sd-only-mail').forEach(function(d){ d.hidden = !mail; });
    el('sd-from-label').textContent = mail ? 'Adresse de l\'expéditeur' : 'Expéditeur du SMS';
    el('sd-from').placeholder = mail ? 'ex. service@ameli-secure.top ou Nom <adresse@domaine.fr>' : 'Numéro ou nom affiché du SMS';
    el('sd-from-help').innerHTML = mail ? 'Copiez l\'adresse complète telle qu\'elle s\'affiche dans votre messagerie.' : 'Numéro (ex. <code>07 58 21 90 44</code>) ou nom affiché (ex. <code>COLISSIMO</code>)';
  }
  function guessType(text){ if(!typeManual) setType(/@|^\s*(objet|subject|de|from)\s*:/im.test(text) ? 'email' : 'sms', false); }
  /* boutons « Coller » (si le navigateur autorise la lecture du presse-papiers) */
  if(navigator.clipboard && navigator.clipboard.readText){
    document.querySelectorAll('.sd-pastebtn').forEach(function(b){
      b.hidden = false;
      b.addEventListener('click', function(){
        var t = el(b.dataset.target);
        navigator.clipboard.readText().then(function(v){
          v = (v || '').trim(); if(!v){ msg('Le presse-papiers est vide.', true); return; }
          t.value = t.tagName === 'INPUT' ? v.split(/\r?\n/)[0].trim() : v; msg(''); t.focus();
        }).catch(function(){ msg('Accès au presse-papiers refusé : appuyez longuement dans le champ puis choisissez « Coller ».', true); });
      });
    });
  }

  input.addEventListener('input', function(){ upd(); guessType(input.value); if(input.value.trim().length >= 8) trackStart('texte'); });
  input.addEventListener('focus', function(){ if(window.matchMedia('(max-width:760px)').matches) setTimeout(function(){ input.scrollIntoView({block:'center', behavior: reduce ? 'auto' : 'smooth'}); }, 300); });
  go.addEventListener('click', analyse);
  el('sd-back').addEventListener('click', function(){ reset(); focusStart(); });

  /* ===== Étape 1 : choix du type de message ===== */
  var fileInput = el('sd-file');
  function pick(accept){ fileInput.accept = accept; fileInput.value = ''; fileInput.click(); }
  var IMG_ACCEPT = 'image/png,image/jpeg,image/webp', TXT_ACCEPT = '.txt,.eml,text/plain,message/rfc822';
  function focusStart(){ var b = document.querySelector('.sd-mode'); if(b) b.focus({preventScroll:true}); }
  function chooseType(t){
    reset(true, true); setType(t, true); setStep(2);
    el('sd-busy').hidden = true; el('sd-edit').hidden = false; input.focus({preventScroll:true});
  }
  document.querySelectorAll('.sd-mode').forEach(function(b){ b.addEventListener('click', function(){ chooseType(b.dataset.type); }); });
  /* Étape 2 : trois façons de fournir le texte du message */
  el('sd-imp-capture').addEventListener('click', function(){ pick(IMG_ACCEPT); });
  el('sd-imp-file').addEventListener('click', function(){ pick(TXT_ACCEPT); });
  el('sd-imp-paste').addEventListener('click', function(){
    if(navigator.clipboard && navigator.clipboard.readText){
      navigator.clipboard.readText().then(function(t){
        t = (t || '').trim();
        if(t){ input.value = t; upd(); trackStart('texte'); msg('Texte collé. Relisez-le puis lancez l\'analyse.'); input.focus(); }
        else msg('Le presse-papiers est vide.', true);
      }).catch(function(){ input.focus(); msg('Accès au presse-papiers refusé : appuyez longuement dans le champ puis choisissez « Coller ».', true); });
    } else { input.focus(); msg('Collez le texte avec Ctrl+V, ou par un appui long dans le champ.'); }
  });
  fileInput.addEventListener('change', function(){ handle(this.files[0]); });

  /* ===== Exemples : messages fictifs écrits par CyberBalise ===== */
  var EXAMPLES = [
    ['Faux colis', 'Colissimo : votre colis n\'a pas pu être livré faute de frais d\'affranchissement (1,99 €). Réglez-les sous 24h pour reprogrammer la livraison : https://colissimo-suivi-livraison.top/fr'],
    ['Faux conseiller', 'Bonjour, ici le service fraude de votre banque. Une opération suspecte de 1 450 € est en cours sur votre compte. Pour l\'annuler, communiquez-nous le code de confirmation que vous allez recevoir par SMS.'],
    ['Faux proche', 'Coucou maman, mon téléphone est cassé, c\'est mon nouveau numéro. Tu peux me faire un virement de 850 € aujourd\'hui ? C\'est urgent, je t\'explique après.'],
    ['Faux e-mail impôts', 'Bonjour,\nAprès un dernier calcul de votre situation fiscale, vous avez droit à un remboursement de 312,40 €. Pour le recevoir, confirmez vos coordonnées bancaires sur le lien ci-dessous, sous 48 h, sinon votre dossier sera clôturé.\nhttps://impots-gouv-fr.top/remboursement'],
    ['Message légitime', 'Bonjour, votre rendez-vous chez le dentiste est confirmé pour mardi 14 h. Pour toute modification, appelez le cabinet. Bonne journée.']
  ];
  var EX_HINT = {'Faux colis':'SMS de faux colis, avec numéro d\'expéditeur', 'Faux conseiller':'Faux « service fraude » de la banque', 'Faux proche':'« Maman, c\'est mon nouveau numéro »', 'Faux e-mail impôts':'Faux remboursement : expéditeur, objet et pied de page', 'Message légitime':'Un vrai message, pour comparer'};
  /* Expéditeur, objet et pied de page fictifs associés aux exemples (champs facultatifs de l'outil) */
  var EX_EXTRA = {
    'Faux colis': {from:'07 58 21 90 44'},
    'Faux conseiller': {from:'+44 7700 900123'},
    'Faux e-mail impôts': {type:'email', from:'Direction Générale des Finances Publiques <remboursement@impots-gouv-fr.top>', subj:'URGENT : remboursement de 312,40 € en attente – dernier rappel !!', foot:'© 2019 Impôts — Ne pas répondre à ce message.\nPour vous désinscrire : https://bit.ly/3xYzAb'}
  };
  var demoName = '';
  EXAMPLES.forEach(function(ex){
    var b = h('button', {type:'button'}, [h('strong', {text: ex[0]}), h('span', {text: EX_HINT[ex[0]] || ''})]);
    b.addEventListener('click', function(){ runExample(ex); });
    el('sd-ex').appendChild(b);
  });
  function runExample(ex){
    reset(true); input.value = ex[1]; upd(); isDemo = true; demoName = ex[0]; started = true; track('outil_lance', 'demo');
    var x = EX_EXTRA[ex[0]] || {};
    setType(x.type || 'sms', true);
    el('sd-from').value = x.from || ''; el('sd-subj').value = x.subj || ''; el('sd-foot').value = x.foot || '';
    el('sd-busy').hidden = true; el('sd-edit').hidden = false; analyse();
  }

  /* ===== Niveaux affichés (libellés : voir aussi Rules.LIBELLES_NIVEAUX) ===== */
  var NIV = {
    3:{badge:'Arnaque probable', note:'', icon:'✖', t:'Très probablement une arnaque', p:'Plusieurs éléments typiques des arnaques sont réunis. Ne cliquez pas, ne répondez pas, ne payez pas et ne communiquez aucun code.'},
    2:{badge:'Message suspect', note:'', icon:'⚠', t:'Message suspect : prudence', p:'Certains éléments sont fréquents dans les arnaques. Vérifiez par vous-même, sans utiliser le lien ni le numéro du message.'},
    1:{badge:'Signaux faibles', note:'', icon:'!', t:'Quelques éléments à vérifier', p:'Un élément isolé ne suffit pas à conclure. Vérifiez par vous-même avant d\'agir : cela ne garantit pas que le message est sûr.'},
    0:{badge:'Aucun signal détecté', note:'Ce n\'est pas une garantie', icon:'i', t:'Aucun signal détecté dans ce que vous avez saisi', p:'Cet outil ne peut ni vérifier le lien, ni authentifier l\'expéditeur : l\'absence de signal ne prouve pas que le message est sûr. Dans le doute, n\'agissez pas depuis le message.'}
  };
  function lcfirst(s){ return s.charAt(0).toLowerCase() + s.slice(1); }
  var MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  function dateFr(iso){ var p = String(iso).split('-'); return p.length === 3 ? (+p[2]) + ' ' + MOIS[+p[1] - 1] + ' ' + p[0] : iso; }

  /* Phrase en langage naturel qui justifie le niveau : ce sont les éléments repérés, pas un score. */
  function whyText(r){
    var ctx = r.contexte;
    if(ctx.prevention && r.niveau === 0) return 'Ce texte ressemble à un message de prévention : il cite des arnaques pour vous en protéger, il n\'en applique pas.';
    if(r.niveau <= 1 && ctx.marqueAuthentifiee.length) return 'Le message se réclame de ' + ctx.marqueAuthentifiee[0] + ' et l\'adresse correspond à son domaine officiel. Cela ne prouve pas son authenticité : ouvrez vous-même le site ou l\'application.';
    var parts = r.justification.slice(0, 3);
    if(!parts.length) return 'Aucun des signaux courants (urgence, menace, demande de code ou de paiement, lien douteux, expéditeur incohérent) n\'a été repéré.';
    return 'Ce verdict repose sur : ' + parts.join(' ; ') + '.';
  }

  /* ===== Surlignage : nœuds texte et <mark>, jamais innerHTML ===== */
  function markInto(parent, text, ranges){
    var rs = (ranges || []).filter(function(x){ return x.f > x.d && x.d < text.length; }).sort(function(a, b){ return a.d - b.d || b.f - a.f; });
    var merged = [];
    rs.forEach(function(x){
      var last = merged[merged.length - 1];
      if(last && x.d <= last.f){ if(x.f > last.f) last.f = x.f; if(x.k === 'incoh') last.k = 'incoh'; }
      else merged.push({d: x.d, f: Math.min(x.f, text.length), k: x.k});
    });
    var pos = 0;
    merged.forEach(function(x){
      if(x.d > pos) parent.appendChild(document.createTextNode(text.slice(pos, x.d)));
      var m = document.createElement('mark'); m.className = 'sd-m sd-m-' + x.k; m.textContent = text.slice(x.d, x.f);
      parent.appendChild(m); pos = x.f;
    });
    if(pos < text.length) parent.appendChild(document.createTextNode(text.slice(pos)));
  }
  function rangesFor(r, champ){
    var out = [];
    r.signaux.forEach(function(s){ if(s.categorie === 'manipulation') (s.positions || []).forEach(function(p){ if(p.champ === champ) out.push({d:p.debut, f:p.fin, k:'manip'}); }); });
    r.lienAnalyse.forEach(function(l){ if(l.champ === champ && l.niveau >= 1) out.push({d:l.debut, f:l.fin, k: l.niveau >= 3 ? 'incoh' : 'manip'}); });
    return out;
  }
  function messageView(r){
    var a = r.affichage, box = h('blockquote', {cls:'sd-msg'});
    var line = function(label, champ, text, whole){
      if(!text) return;
      var d = h('div', {cls:'sd-msg-line'}, [h('span', {cls:'sd-msg-lbl', text: label})]);
      var rg = rangesFor(r, champ);
      if(whole) rg.push({d:0, f:text.length, k:'incoh'});
      markInto(d, text, rg); box.appendChild(d);
    };
    var expIncoh = r.incoherences.some(function(i){ return i.champ === 'expediteur'; }) || r.signaux.some(function(s){ return s.champ === 'expediteur' && s.categorie === 'manipulation'; });
    line('Expéditeur : ', 'expediteur', a.expediteur, expIncoh);
    line('Objet : ', 'objet', a.objet);
    var corps = h('div', {cls:'sd-msg-body'}); markInto(corps, a.corps, rangesFor(r, 'corps')); box.appendChild(corps);
    if(a.piedDePage){ box.appendChild(h('div', {cls:'sd-msg-lbl sd-msg-sep', text:'— Pied de page —'})); var pd = h('div', {cls:'sd-msg-foot'}); markInto(pd, a.piedDePage, rangesFor(r, 'pied')); box.appendChild(pd); }
    qrUrls.forEach(function(u){ box.appendChild(h('div', {cls:'sd-msg-line'}, [h('span', {cls:'sd-msg-lbl', text:'QR code décodé : '}), document.createTextNode(u)])); });
    return box;
  }

  /* ===== Blocs du verdict ===== */
  var anim = 0;
  function appear(e){ e.classList.add('sd-in'); e.style.setProperty('--i', String(Math.min(anim++, 8))); return e; }
  function ficheLink(f){ return f ? h('a', {href: f.url, text: '→ ' + f.titre}) : null; }
  function quotes(list){ return h('div', {cls:'sd-quotes'}, (list || []).map(function(x){ return h('q', {text: x}); })); }

  function signalItem(s, cls){
    var det = h('details', null, [h('summary', {text: s.categorie === 'manipulation' ? 'Pourquoi cet élément compte-t-il ?' : 'Pourquoi n\'est-ce pas concluant ?'}), h('p', {text: s.explication}), s.action ? h('p', {cls:'sd-act', text: s.action}) : null, ficheLink(s.fiche)]);
    return appear(h('li', {cls:'sd-sig ' + (cls || '') + (s.poids <= 2 && s.categorie === 'manipulation' ? ' w2' : '')}, [h('b', {text: s.libelle}), quotes(s.extraits), det]));
  }
  function section(title, id, items, intro){
    var s = h('section', {cls:'sd-sec', 'aria-labelledby': id}, [appear(h('h3', {id: id, text: title})), intro ? h('p', {cls:'sd-sec-intro', text: intro}) : null, h('ul', {cls:'sd-sigs'}, items)]);
    return s;
  }

  function scenarioBlock(sc){
    var conf = sc.statut === 'confirme';
    var kids = [
      h('div', {cls:'sd-scen-head'}, [h('b', {text: sc.libelle}), h('span', {cls:'sd-scen-tag ' + (conf ? 'is-conf' : 'is-part'), text: conf ? 'Scénario reconnu' : 'Début de scénario'})]),
      h('p', {text: sc.explication})
    ];
    if(sc.preuves.length) kids.push(h('ul', {cls:'sd-proofs'}, sc.preuves.map(function(p){ return h('li', null, [h('span', {text: p.brique + ' : '}), h('q', {text: p.extrait})]); })));
    if(!conf && sc.briquesManquantes.length) kids.push(h('p', {cls:'sd-scen-miss', text: 'Il manque encore, pour que le scénario soit complet : ' + sc.briquesManquantes.map(lcfirst).join(' ; ') + '.'}));
    kids.push(ficheLink(sc.fiche));
    return appear(h('div', {cls:'sd-scen'}, kids));
  }

  function linkItem(l){
    var raisons = l.raisons.map(function(c){ return Rules.LIEN_RAISONS[c]; });
    var etat = l.niveau >= 3 ? 'Incohérence' : l.niveau === 2 ? 'Indice net' : l.niveau === 1 ? 'Indice faible' : 'Aucun indice';
    var kids = [h('b', {text: l.hote || l.url}), h('span', {cls:'sd-src', text: etat + (l.origine === 'qr' ? ' · QR code' : '')})];
    if(l.officielPour.length) kids.push(h('p', {cls:'sd-link-ok', text: 'Adresse officielle connue de : ' + l.officielPour.map(function(id){ return Rules.MARQUES.filter(function(b){ return b.id === id; })[0].nom; }).join(', ') + '. Cela ne garantit pas que la page n\'a pas été piratée.'}));
    else if(!raisons.length) kids.push(h('p', {cls:'sd-link-ok', text: 'Rien d\'anormal dans l\'adresse elle-même. Cela ne dit rien du contenu de la page : cet outil ne l\'ouvre jamais.'}));
    if(raisons.length) kids.push(h('details', {open: l.niveau >= 2}, [h('summary', {text:'Pourquoi cette adresse est suspecte ?'}), h('ul', null, raisons.map(function(rs){ return h('li', null, [h('strong', {text: rs.libelle + '. '}), document.createTextNode(rs.explication)]); })), h('a', {href: Rules.FICHES.phishing.url, text: '→ Reconnaître un faux site'})]));
    if(typeof l.ageJours === 'number') kids.splice(2, 0, h('p', {cls:'sd-link-ok', text:'Domaine enregistré depuis ' + ageLabel(l.ageJours) + ' (date lue auprès du service RDAP, à votre demande).'}));
    return appear(h('li', {cls:'sd-sig' + (l.niveau >= 2 ? '' : l.niveau === 1 ? ' w2' : ' sd-ctx')}, kids));
  }

  function scopeBlock(r, ctx){
    var mail = ctx.type === 'email', A = r.affichage;
    var s = r.signaux;
    var textN = s.some(function(x){ return x.categorie === 'manipulation' && (x.positions || []).some(function(p){ return p.champ === 'corps'; }); }) || r.scenarios.length > 0 || r.lienAnalyse.some(function(l){ return l.niveau >= 1 && l.champ === 'corps'; });
    var expN = r.incoherences.some(function(i){ return i.champ === 'expediteur'; }) || s.some(function(x){ return x.champ === 'expediteur' && x.categorie === 'manipulation'; });
    var objN = s.some(function(x){ return x.categorie === 'manipulation' && (x.positions || []).some(function(p){ return p.champ === 'objet'; }); });
    var piedN = s.some(function(x){ return x.champ === 'pied' && x.categorie === 'manipulation'; }) || r.lienAnalyse.some(function(l){ return l.niveau >= 1 && l.champ === 'pied'; });
    var tile = function(title, value, n, auto, field){
      var state = !value ? 'none' : (n ? 'warn' : 'ok');
      var li = h('li', {cls: state}, [h('b', {text: title}), h('span', {cls:'st', text: !value ? 'Non renseigné' : (n ? 'Éléments repérés' : 'Rien repéré')})]);
      if(value) li.appendChild(h('small', {text: (value.length > 46 ? value.slice(0, 44) + '…' : value) + (auto ? ' · repéré automatiquement' : '')}));
      if(!value && field){ var b = h('button', {type:'button', cls:'sd-add', 'data-field': field, text:'Ajouter'}); b.addEventListener('click', function(){ backToEdit(field); }); li.appendChild(b); }
      return li;
    };
    var first = (A.piedDePage || '').split('\n')[0];
    var tiles = h('ul', {cls:'sd-tiles' + (mail ? '' : ' two')}, [
      h('li', {cls: textN ? 'warn' : 'ok'}, [h('b', {text:'Texte du message'}), h('span', {cls:'st', text: textN ? 'Éléments repérés' : 'Rien repéré'})]),
      tile(mail ? 'Expéditeur' : 'Expéditeur du SMS', A.expediteur, expN, A.auto.expediteur, 'sd-from'),
      mail ? tile('Objet', A.objet, objN, A.auto.objet, 'sd-subj') : null,
      mail ? tile('Pied de page', first, piedN, A.auto.pied, 'sd-foot') : null
    ]);
    return appear(h('section', {cls:'sd-scope', 'aria-labelledby':'sd-scope-t'}, [h('h3', {id:'sd-scope-t', text:'Ce qui a été examiné'}), tiles,
      h('p', {cls:'sd-scope-note', text: (mail ? 'L\'expéditeur, l\'objet et le pied de page sont facultatifs mais très révélateurs : un faux message se trahit souvent par son adresse d\'envoi.' : 'Le numéro ou le nom d\'expéditeur est facultatif mais révélateur : un faux SMS vient souvent d\'un numéro de mobile ordinaire ou étranger.') + ' Rien n\'est envoyé hors de votre appareil.'})]));
  }

  function summaryText(r){
    var v = NIV[r.niveau], lines = ['Détecteur d\'arnaque CyberBalise', 'Verdict : ' + v.badge];
    var raisons = r.justification.slice(0, 3);
    if(raisons.length){ lines.push('Ce verdict repose sur :'); raisons.forEach(function(x){ lines.push('- ' + x); }); }
    else lines.push('Aucun des signaux courants d\'arnaque n\'a été repéré (cela ne garantit pas que le message est sûr).');
    lines.push('À faire : ' + (r.niveau >= 2 ? 'ne cliquez sur aucun lien, ne rappelez pas le numéro du message, vérifiez par un autre canal, signalez-le (SMS au 33700, e-mail sur Signal Spam).' : 'en cas de doute, vérifiez auprès de l\'expéditeur par un autre moyen que ce message.'));
    lines.push('Ce résumé ne contient pas le message analysé. Un verdict automatique n\'est pas une garantie.');
    lines.push(SHARE_URL);
    return lines.join('\n');
  }

  /* ===== Modules du verdict ===== */
  var nlDismissed = false;
  function nlHTML(){
    if(nlDismissed || (!CB_NEWSLETTER.endpoint && !NL_PREVIEW)) return '';
    return '<section class="sd-nl sd-in" id="sd-nl" aria-labelledby="sd-nl-t" style="--i:2">'
      + '<h3 id="sd-nl-t">Recevez la newsletter CyberBalise</h3>'
      + '<p>Tous les 15 jours : actualités, guides et outils au meilleur prix. Gratuit, désinscription en un clic.</p>'
      + (NL_PREVIEW ? '<p class="preview">Aperçu : aucune inscription n\'est envoyée.</p>' : '')
      + '<form id="sd-nl-form" novalidate>'
      + '<label class="t" for="sd-nl-email">Votre adresse e-mail</label>'
      + '<input type="email" id="sd-nl-email" name="email" autocomplete="email" inputmode="email" autocapitalize="off" spellcheck="false" placeholder="prenom@exemple.fr" aria-describedby="sd-nl-msg">'
      + '<label class="consent" for="sd-nl-ok"><input type="checkbox" id="sd-nl-ok" name="consent"><span>J\'accepte de recevoir la newsletter CyberBalise par e-mail, tous les 15 jours. Je peux me désinscrire à tout moment. <a href="/politique-de-confidentialite/">Politique de confidentialité</a></span></label>'
      + '<div class="sd-hp" aria-hidden="true"><label>Ne pas remplir<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>'
      + '<div class="row"><button type="submit">Je m\'abonne</button><button type="button" class="no" id="sd-nl-no">Non merci</button></div>'
      + '<p class="msg" id="sd-nl-msg" role="status" aria-live="polite"></p></form></section>';
  }
  function bindNl(){
    var f = el('sd-nl-form'); if(!f) return;
    var em = el('sd-nl-email'), ok = el('sd-nl-ok'), m = el('sd-nl-msg'), btn = f.querySelector('button[type=submit]');
    function say(t, good){ m.textContent = t; m.classList.toggle('ok', !!good); }
    el('sd-nl-no').addEventListener('click', function(){ nlDismissed = true; el('sd-nl').remove(); });
    f.addEventListener('submit', function(ev){
      ev.preventDefault();
      var v = em.value.trim();
      em.removeAttribute('aria-invalid'); ok.removeAttribute('aria-invalid');
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)){ em.setAttribute('aria-invalid','true'); say('Saisissez une adresse e-mail valide (ex. prenom@exemple.fr).'); em.focus(); return; }
      if(!ok.checked){ ok.setAttribute('aria-invalid','true'); say('Cochez la case pour confirmer votre accord.'); ok.focus(); return; }
      if(f.elements.website.value){ say('Merci !', true); return; }
      btn.disabled = true; say('Inscription en cours…');
      subscribeNewsletter(v).then(function(){
        track('inscription_newsletter', 'detecteur');
        f.hidden = true;
        var p = document.createElement('p'); p.className = 'msg ok'; p.setAttribute('role','status');
        p.textContent = CB_NEWSLETTER.doubleOptIn ? 'Merci ! Un e-mail de confirmation vient de vous être envoyé : cliquez sur le lien qu\'il contient pour valider votre inscription.' : 'Merci ! Vous êtes inscrit(e) à la newsletter CyberBalise.';
        el('sd-nl').appendChild(p);
      }).catch(function(e){
        console.error('CyberBalise : inscription impossible.', e);
        btn.disabled = false;
        say(e && e.message === 'http_429' ? 'Trop de demandes pour le moment. Réessayez dans une heure.' : e && e.message === 'http_422' ? 'Adresse refusée : vérifiez-la et réessayez.' : 'Impossible de vous inscrire pour le moment. Réessayez dans un instant.');
      });
    });
  }
  function shareHTML(){
    var u = function(medium){ return SHARE_URL + '?utm_source=partage&utm_medium=' + medium + '&utm_campaign=detecteur'; };
    var txt = 'Un SMS ou un e-mail te paraît louche ? Teste-le gratuitement, tout reste sur ton téléphone : ';
    return '<section class="sd-share sd-in" aria-labelledby="sd-sh-t" style="--i:7"><h3 id="sd-sh-t">Ce test peut aider un proche</h3>'
      + '<p>Un parent, un ami ou un collègue a peut-être reçu le même type de message. Envoyez-lui l\'outil.</p><div class="sd-pills">'
      + '<a class="sd-pill wa" data-share="whatsapp" target="_blank" rel="noopener noreferrer" href="https://wa.me/?text=' + encodeURIComponent(txt + u('whatsapp')) + '">Envoyer sur WhatsApp</a>'
      + '<button type="button" class="sd-pill" data-share="lien" data-url="' + u('lien') + '">Copier le lien</button>'
      + (navigator.share ? '<button type="button" class="sd-pill" data-share="natif" data-url="' + u('natif') + '" data-txt="' + esc(txt) + '">Partager…</button>' : '')
      + '</div><p class="sd-share-status" id="sd-share-status" role="status" aria-live="polite"></p></section>';
  }
  function bindShare(){
    var st = el('sd-share-status');
    res.querySelectorAll('[data-share]').forEach(function(b){
      b.addEventListener('click', function(){
        var k = b.dataset.share; track('partage_clic', k);
        if(k === 'lien'){
          var u = b.dataset.url;
          var done = function(){ st.textContent = 'Lien copié.'; };
          if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(done).catch(function(){ st.textContent = u; });
          else { var t = document.createElement('input'); t.value = u; document.body.appendChild(t); t.select(); try{ document.execCommand('copy'); done(); }catch(e){ st.textContent = u; } t.remove(); }
        } else if(k === 'natif'){
          navigator.share({title:'Détecteur d\'arnaque SMS/Email', text:b.dataset.txt, url:b.dataset.url}).catch(function(){});
        }
      });
    });
  }
  function copyText(t, status, okMsg){
    var done = function(){ status.textContent = okMsg; };
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done).catch(function(){ status.textContent = 'Copie impossible : sélectionnez le texte et copiez-le à la main.'; });
    else { var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); done(); }catch(e){ status.textContent = 'Copie impossible.'; } ta.remove(); }
  }

  function backToEdit(fieldId){
    setStep(2); el('sd-busy').hidden = true; el('sd-edit').hidden = false;
    var f = el(fieldId); if(f) f.focus();
  }

  /* ===== Analyse et rendu ===== */
  function analyse(){
    var text = input.value.trim(); if(!text && !qrUrls.length) return;
    guessType(text);
    var entree = { texte: text, type: msgType, expediteur: el('sd-from').value.trim(), objet: el('sd-subj').value.trim(), piedDePage: el('sd-foot').value.trim(), qr: qrUrls.slice() };
    var r;
    try{ r = Engine.analyser(entree); }
    catch(e){ console.error('CyberBalise : analyse impossible.', e); msg('L\'analyse a échoué. Rechargez la page et réessayez.', true); return; }
    var au = r.affichage.auto;
    if(au.expediteur) el('sd-from').value = r.contexte.expediteur || '';
    if(au.objet) el('sd-subj').value = r.affichage.objet;
    if(au.pied) el('sd-foot').value = r.affichage.piedDePage;
    var doms = el('sd-rdap').checked ? domainesAVerifier(r) : [];
    if(!doms.length){ render(r); return; }
    /* vérification facultative : on attend au plus quelques secondes, puis on affiche le verdict une seule fois */
    var version = importVersion;
    go.disabled = true; msg('Vérification de l\'âge des domaines auprès de rdap.org (facultatif)…');
    Promise.all(doms.map(function(d){ return rdapAge(d).then(function(v){ return [d, v]; }); })).then(function(pairs){
      if(version !== importVersion) return;
      var map = {}; pairs.forEach(function(p){ if(p[1]) map[p[0]] = p[1]; });
      msg(''); upd();
      var r2 = Object.keys(map).length ? Engine.analyser(Object.assign({}, entree, {domaines: map})) : r;
      render(r2);
    });
  }

  function render(r){
    var level = r.niveau, v = NIV[level], ctx = r.contexte, isMail = ctx.type === 'email';
    anim = 0; res.textContent = '';

    /* message analysé, passages repérés surlignés */
    var view = messageView(r);
    var legend = h('p', {cls:'sd-legend', text:'Les passages surlignés sont ceux qui ont déclenché un signal ou un lien à risque. Rien n\'est envoyé hors de votre appareil.'});
    if(isDemo) res.appendChild(appear(h('figure', {cls:'sd-sample'}, [h('figcaption', {text:'Exemple « ' + demoName + ' » : un message fictif écrit par CyberBalise, qui ne vient d\'aucun vrai expéditeur'}), view, legend, h('p', {cls:'sd-sample-note', text:'Voici ce que l\'outil dit de ce message :'})])));
    else res.appendChild(appear(h('details', {cls:'sd-sample', open: level >= 1}, [h('summary', {text:'Voir le message analysé, avec les passages repérés'}), view, legend])));

    /* verdict */
    res.appendChild(appear(h('div', {cls:'sd-verdict v' + level}, [
      h('div', {cls:'sd-badge'}, [h('i', {'aria-hidden':'true', text: v.icon}), document.createTextNode(v.badge), v.note ? h('small', {text: v.note}) : null]),
      h('div', null, [h('h3', {id:'sd-vt', tabindex:'-1', text: v.t}), h('p', {text: v.p}), h('p', {cls:'sd-why', text: whyText(r)}), h('div', {cls:'sd-meter', 'aria-hidden':'true'}, [h('i'), h('i'), h('i')])])
    ])));

    /* scénarios reconnus */
    if(r.scenarios.length){
      res.appendChild(h('section', {cls:'sd-sec', 'aria-labelledby':'sd-sc-t'}, [appear(h('h3', {id:'sd-sc-t', text:'Scénario d\'arnaque reconnu'}))].concat(r.scenarios.map(scenarioBlock))));
    }

    /* 1. incohérences vérifiables */
    var incItems = r.incoherences.map(function(i){
      var det = h('details', {open: i.force === 'critique'}, [h('summary', {text:'Pourquoi c\'est vérifiable ?'}), h('p', {text: i.explication}), ficheLink(i.fiche)]);
      return appear(h('li', {cls:'sd-sig'}, [h('span', {cls:'sd-src', text: i.force === 'critique' ? 'Incohérence critique' : 'Incohérence forte'}), h('b', {text: i.libelle}), i.preuve ? quotes([i.preuve]) : null, det]));
    });
    if(incItems.length) res.appendChild(section('Incohérences vérifiables', 'sd-inc-t', incItems, 'Ce sont les indices les plus solides : ils se vérifient sans se fier au ton du message.'));

    /* liens examinés */
    if(r.lienAnalyse.length) res.appendChild(section(r.lienAnalyse.length > 1 ? 'Liens examinés' : 'Lien examiné', 'sd-lnk-t', r.lienAnalyse.map(linkItem), 'Seule l\'adresse est examinée, jamais la page : aucun lien n\'est ouvert par cet outil.'));

    /* 2. signaux de manipulation */
    var manip = r.signaux.filter(function(s){ return s.categorie === 'manipulation'; });
    if(manip.length) res.appendChild(section('Signaux de manipulation', 'sd-man-t', manip.map(function(s){ return signalItem(s); }), 'Des procédés typiques des arnaques : ils cherchent à vous faire agir vite et sans vérifier.'));

    /* 3. éléments de contexte non concluants */
    var ctxs = r.signaux.filter(function(s){ return s.categorie !== 'manipulation'; });
    if(ctxs.length) res.appendChild(section('Éléments de contexte (non concluants)', 'sd-ctx-t', ctxs.map(function(s){ return signalItem(s, 'sd-ctx'); }), 'Ces thèmes apparaissent aussi dans beaucoup de vrais messages : ils sont notés, mais ne pèsent pas dans le verdict.'));

    res.appendChild(scopeBlock(r, ctx));

    /* comment lire */
    var scale = h('ol', null, ['Aucun signal', 'Signaux faibles', 'Suspect', 'Arnaque probable'].map(function(label, index){ return h('li', {'aria-current': index === level ? 'step' : null}, [label + (index === level ? ' — votre résultat' : '')]); }));
    res.appendChild(h('details', {cls:'sd-more'}, [h('summary', {text:'Comment lire ce niveau ?'}), h('section', {'aria-label':'Échelle de vigilance'}, [h('p', null, [h('strong', {text: v.badge})]), scale,
      h('p', {text:'Échelle indicative, ce n\'est pas une probabilité de fraude. Le niveau dépend de la nature des éléments repérés (expéditeur ou lien incohérent, scénario d\'arnaque connu), pas de leur nombre.'}),
      h('p', {text:'« Aucun signal détecté » ne signifie jamais que le message est sûr.'})])]));

    /* ce que l'outil n'a pas pu vérifier */
    res.appendChild(appear(h('section', {cls:'sd-limits', 'aria-labelledby':'sd-lim-t'}, [h('h3', {id:'sd-lim-t', text:'Ce que cet outil n\'a pas pu vérifier'}), h('ul', null, r.limites.map(function(t){ return h('li', {text: t}); }))])));

    /* que faire */
    var P = {
      sms: '<a class="sd-pill' + (isMail ? '' : ' first') + '" href="https://www.33700.fr/" target="_blank" rel="noopener noreferrer">Signaler un SMS : 33700</a>',
      mail: '<a class="sd-pill' + (isMail ? ' first' : '') + '" href="https://www.signal-spam.fr/" target="_blank" rel="noopener noreferrer">Signaler un e-mail : Signal Spam</a>',
      bank: '<a class="sd-pill" href="/particuliers/victime/carte-bancaire-debitee/">J\'ai payé : faire opposition</a>',
      c17: '<a class="sd-pill" href="https://17cyber.gouv.fr/" target="_blank" rel="noopener noreferrer">Besoin d\'aide : 17Cyber</a>'
    };
    var todo = level >= 2
      ? '<li><strong>Ne cliquez sur aucun lien</strong> et ne rappelez pas le numéro indiqué.</li><li><strong>Vérifiez par vous-même</strong> : ouvrez l\'application ou le site officiel, ou appelez l\'organisme au numéro habituel.</li><li><strong>Signalez</strong> le message : SMS au 33700, e-mail sur Signal Spam, et 17Cyber si vous avez un doute — <a href="/particuliers/victime/signaler-un-probleme/">voir la fiche</a>.</li><li><strong>Vous avez déjà cliqué, payé ou donné un code ?</strong> Appelez votre banque pour faire opposition et suivez <a href="/particuliers/victime/">nos fiches réflexes</a>.</li>'
      : '<li>En cas de doute, vérifiez auprès de l\'expéditeur par un autre moyen que ce message.</li><li>Ne communiquez jamais un code, un mot de passe ou vos coordonnées bancaires en réponse à un message.</li>';
    var pills = level === 3 ? P.bank + (isMail ? P.mail + P.sms : P.sms + P.mail) + P.c17 : level === 2 ? (isMail ? P.mail + P.sms : P.sms + P.mail) + P.c17 + P.bank : (isMail ? P.mail + P.sms : P.sms + P.mail);
    var help = appear(h('section', {cls:'sd-help', 'aria-labelledby':'sd-todo-t'}, [h('h3', {id:'sd-todo-t', text:'Que faire maintenant ?'}), h('ol'), h('div', {cls:'sd-pills'})]));
    help.querySelector('ol').innerHTML = todo;          // texte statique du site, sans donnée utilisateur
    help.querySelector('.sd-pills').innerHTML = pills;  // idem
    var copy = h('button', {type:'button', cls:'sd-pill', id:'sd-copy', text:'Copier le résumé'});
    var copyStatus = h('p', {cls:'sd-share-status', id:'sd-copy-status', role:'status', 'aria-live':'polite'});
    copy.addEventListener('click', function(){ track('partage_clic', 'resume'); copyText(summaryText(r), copyStatus, 'Résumé copié : verdict et raisons, sans votre message.'); });
    help.querySelector('.sd-pills').appendChild(copy);
    help.appendChild(h('p', {cls:'sd-copy-note', text:'Le résumé copié contient le verdict et ses raisons, jamais le texte de votre message : vous pouvez l\'envoyer à un proche ou à votre banque.'}));
    help.appendChild(copyStatus);
    res.appendChild(help);

    var extra = document.createElement('div');
    extra.innerHTML = (level < 3 ? nlHTML() : '') + shareHTML();   // modules statiques, sans donnée utilisateur
    while(extra.firstChild) res.appendChild(extra.firstChild);
    var again = h('button', {cls:'sd-ghost', type:'button', id:'sd-again', text:'Analyser un autre message'});
    again.addEventListener('click', function(){ reset(); focusStart(); });
    res.appendChild(h('div', {cls:'sd-again'}, [again]));
    res.appendChild(h('p', {cls:'sd-ver', text:'Règles version ' + r.versionRegles + ', mises à jour le ' + dateFr(Rules.DATE_MAJ) + '. Méthode et résultats mesurés en bas de page.'}));

    setStep(3);
    bindNl(); bindShare();
    el('sd-live').textContent = 'Analyse terminée : ' + v.badge + '. ' + v.t + '.';
    var t = el('sd-vt'); if(t) t.focus({preventScroll:true});
    track('analyse_terminee', Rules.NIVEAUX_ANALYTIQUES[level]);
    r.scenarios.forEach(function(s){ track('scenario_detecte', s.id); });
  }

  /* ===== Remise à zéro ===== */
  function reset(keepStep, keepFields){
    importVersion++; started = false; isDemo = false; qrUrls = [];
    input.value = ''; upd(); fileInput.value = '';
    if(!keepFields){ ['sd-from', 'sd-subj', 'sd-foot'].forEach(function(id){ el(id).value = ''; }); typeManual = false; setType('sms', false); }
    res.hidden = true; res.textContent = '';
    setQr([]);
    if(!keepFields) el('sd-rdap').checked = false;
    ['sd-prev', 'sd-prev-busy'].forEach(function(id){ var p = el(id); p.hidden = true; p.removeAttribute('src'); });
    if(previewUrl){ URL.revokeObjectURL(previewUrl); previewUrl = null; }
    el('sd-busy').hidden = true; el('sd-edit').hidden = false; msg('');
    el('sd-live').textContent = '';
    if(!keepStep) setStep(1);
  }

  /* ===== Capture d'écran : OCR local avec Tesseract.js, chargé uniquement à l'import d'une image ===== */
  var tessLoading = null;
  function loadTess(){
    if(window.Tesseract) return Promise.resolve();
    if(tessLoading) return tessLoading;
    tessLoading = new Promise(function(ok, ko){
      var s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      s.onload = ok; s.onerror = function(){ tessLoading=null; s.remove(); ko(new Error('load')); }; document.head.appendChild(s);
    });
    return tessLoading;
  }
  function bar(pct, text){
    var b = el('sd-bar'); b.setAttribute('aria-valuenow', Math.round(pct)); el('sd-barfill').style.width = pct + '%';
    if(text) el('sd-busymsg').textContent = text;
  }

  /* ===== Codes QR : lecture locale de l'image. API native du navigateur si elle existe ; sinon petite
         bibliothèque libre (jsQR), téléchargée seulement à l'import d'une image, avec empreinte d'intégrité.
         L'image n'est jamais envoyée ; le contenu du code QR n'est jamais ouvert. ===== */
  var JSQR_URL = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
  var JSQR_SRI = 'sha384-b5Ya4Bq3qCyz39m2ISh+4DxjAIljdeFwK/BsXLuj9gugaNwAcj/ia15fxNZL9Nlx';
  var jsqrLoading = null;
  function loadJsQR(){
    if(window.jsQR) return Promise.resolve();
    if(jsqrLoading) return jsqrLoading;
    jsqrLoading = new Promise(function(ok, ko){
      var s = document.createElement('script'); s.src = JSQR_URL; s.integrity = JSQR_SRI; s.crossOrigin = 'anonymous';
      s.onload = ok; s.onerror = function(){ jsqrLoading = null; s.remove(); ko(new Error('load')); }; document.head.appendChild(s);
    });
    return jsqrLoading;
  }
  function imageToCanvas(file){
    return new Promise(function(ok, ko){
      var u = URL.createObjectURL(file), img = new Image();
      img.onload = function(){
        var sc = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight, 1));
        var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * sc)); c.height = Math.max(1, Math.round(img.naturalHeight * sc));
        c.getContext('2d', {willReadFrequently:true}).drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(u); ok(c);
      };
      img.onerror = function(){ URL.revokeObjectURL(u); ko(new Error('image')); };
      img.src = u;
    });
  }
  function decodeQR(file){
    return imageToCanvas(file).then(function(c){
      if(window.BarcodeDetector){
        return new window.BarcodeDetector({formats:['qr_code']}).detect(c).then(function(codes){ return codes.map(function(x){ return x.rawValue; }).filter(Boolean); }).catch(function(){ return []; });
      }
      return loadJsQR().then(function(){
        var d = c.getContext('2d').getImageData(0, 0, c.width, c.height);
        var code = window.jsQR(d.data, c.width, c.height, {inversionAttempts:'attemptBoth'});
        return code && code.data ? [code.data] : [];
      }).catch(function(){ return []; });
    });
  }
  /* Affiche le contenu lu ; seules les adresses sont analysées. */
  function setQr(list){
    var box = el('sd-qrbox'); box.textContent = '';
    qrUrls = (list || []).filter(function(u){ return /^(https?:\/\/|www\.)/i.test(u); }).slice(0, 3);
    if(!(list || []).length){ box.hidden = true; return; }
    box.hidden = false;
    box.appendChild(h('b', {text:'Code QR détecté dans l\'image'}));
    list.slice(0, 3).forEach(function(u){ box.appendChild(h('code', {text: u})); });
    box.appendChild(h('small', {text: qrUrls.length ? 'Cette adresse sera analysée avec le message. Elle n\'est jamais ouverte par cet outil.' : 'Ce contenu n\'est pas une adresse web : il n\'est pas analysé.'}));
  }

  /* ===== Âge des domaines (facultatif, sur case cochée) : seul le nom de domaine est envoyé à rdap.org ===== */
  var RDAP_BASE = 'https://rdap.org/domain/', MAX_RDAP = 3, rdapCache = {};
  function rdapAge(domaine){
    if(Object.prototype.hasOwnProperty.call(rdapCache, domaine)) return Promise.resolve(rdapCache[domaine]);
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function(){ if(ctrl) ctrl.abort(); }, 4000);
    return fetch(RDAP_BASE + encodeURIComponent(domaine), { method:'GET', credentials:'omit', referrerPolicy:'no-referrer', cache:'no-store', headers:{'Accept':'application/rdap+json, application/json'}, signal: ctrl ? ctrl.signal : undefined })
      .then(function(r){ if(!r.ok) throw new Error('rdap_' + r.status); return r.json(); })
      .then(function(j){
        var ev = (j.events || []).filter(function(e){ return e.eventAction === 'registration'; })[0];
        var t = ev && Date.parse(ev.eventDate);
        return t && t <= Date.now() ? { ageJours: Math.floor((Date.now() - t) / 864e5) } : null;
      })
      .catch(function(){ return null; })   /* dégradation silencieuse : CORS, réseau, domaine inconnu */
      .then(function(v){ clearTimeout(timer); rdapCache[domaine] = v; return v; });
  }
  function domainesAVerifier(r){
    var out = [];
    r.lienAnalyse.forEach(function(l){
      if(!l.domaine || l.officielPour.length || /^\d{1,3}(\.\d{1,3}){3}$/.test(l.hote) || out.indexOf(l.domaine) >= 0) return;
      out.push(l.domaine);
    });
    return out.slice(0, MAX_RDAP);
  }
  function ageLabel(j){ return j < 1 ? 'moins d\'un jour' : j < 60 ? j + ' jour' + (j > 1 ? 's' : '') : j < 730 ? Math.round(j / 30) + ' mois' : Math.round(j / 365) + ' ans'; }
  function handle(file){
    if(!file) return;
    var isEml = /\.eml$/i.test(file.name) || file.type === 'message/rfc822';
    var isText = isEml || file.type === 'text/plain' || /\.txt$/i.test(file.name);
    var isImage = /^(image\/png|image\/jpeg|image\/webp)$/.test(file.type);
    if(!isText && !isImage){ msg('Format non pris en charge. Choisissez une image PNG, JPG, WebP, un fichier .txt ou un e-mail .eml.', true); return; }
    if(file.size > 10 * 1024 * 1024){ msg('Fichier trop volumineux : la limite est de 10 Mo.', true); return; }
    reset(true, true);
    var version = importVersion;
    started = true; track('outil_lance', isEml ? 'eml' : isText ? 'fichier' : 'capture');
    setStep(2);
    el('sd-busy').hidden = false; el('sd-edit').hidden = true; bar(4, isText ? 'Lecture du fichier…' : 'Préparation de la lecture…');
    var reading, qrReading = Promise.resolve([]);
    if(isText){ reading = file.text().then(function(raw){ return isEml ? Engine.nettoyerEml(raw) : raw; }); }
    else {
      previewUrl = URL.createObjectURL(file);
      ['sd-prev', 'sd-prev-busy'].forEach(function(id){ var p = el(id); p.src = previewUrl; p.hidden = false; });
      qrReading = decodeQR(file).catch(function(){ return []; });
      reading = loadTess().then(function(){
        bar(18, 'Lecture du texte…');
        return Tesseract.recognize(file, 'fra', { logger: function(m){ if(version === importVersion && m.status === 'recognizing text'){ var p = Math.round(m.progress * 100); bar(18 + p * 0.82, 'Lecture du texte… ' + p + ' %'); } } });
      }).then(function(r){ return r.data.text || ''; }).catch(function(error){ console.error('CyberBalise : lecture du texte impossible.', error); return qrReading.then(function(q){ if(q.length) return ''; throw error; }); });
    }
    Promise.all([reading, qrReading]).then(function(res2){
      if(version !== importVersion) return;
      var text = res2[0], qr = res2[1];
      var t = text.trim();
      el('sd-busy').hidden = true; el('sd-edit').hidden = false;
      setQr(qr);
      /* une image qui ne contient qu'un code QR donne un « texte » parasite à l'OCR : on l'écarte */
      if(qrUrls.length && (t.match(/[A-Za-zÀ-ÿ]/g) || []).length < 12) t = '';
      if(!t && !qrUrls.length){ msg('Aucun texte lisible trouvé. Essayez une capture plus nette, un fichier texte, ou collez le texte ci-dessus.', true); input.focus(); return; }
      if(isEml) setType('email', true);
      input.value = t; upd(); if(t) guessType(t);
      msg(qrUrls.length && !t ? 'Un code QR a été lu dans l\'image : il sera analysé. Vous pouvez ajouter le texte du message si vous l\'avez.' : 'Texte importé. Relisez-le et corrigez-le si nécessaire, puis cliquez sur « Analyser le message ».');
      input.classList.add('sd-edit-flash'); setTimeout(function(){ input.classList.remove('sd-edit-flash'); }, 1500);
      input.focus({preventScroll:true});
    }).catch(function(error){
      console.error('CyberBalise : échec de lecture du fichier.', error);
      if(version !== importVersion) return;
      el('sd-busy').hidden = true; el('sd-edit').hidden = false;
      msg('Impossible de lire ce fichier. Essayez un autre fichier ou collez le texte dans le champ ci-dessus.', true);
    });
  }
  /* Glisser-déposer sur tout le cadre + collage d'une image (Ctrl+V / appui long) */
  ['dragenter','dragover'].forEach(function(e){ card.addEventListener(e, function(ev){ ev.preventDefault(); card.classList.add('over'); }); });
  card.addEventListener('dragleave', function(ev){ if(!card.contains(ev.relatedTarget)) card.classList.remove('over'); });
  card.addEventListener('drop', function(ev){ ev.preventDefault(); card.classList.remove('over'); handle(ev.dataTransfer.files[0]); });
  document.addEventListener('paste', function(ev){
    var it = ev.clipboardData && [].slice.call(ev.clipboardData.items).filter(function(i){ return /^image\//.test(i.type); })[0];
    if(it){ ev.preventDefault(); handle(it.getAsFile()); }
  });
  setStep(1); upd();
})();
