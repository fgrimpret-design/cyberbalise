// Parcours complet de la page dans jsdom : étapes, verdict, focus, accessibilité, sécurité du rendu.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ouvrirPage } from './dom.mjs';
import { PAGE_OUTIL, chargerCorpus } from './lib.mjs';

const corpus = chargerCorpus();

test('page : les trois scripts se chargent sans erreur', async () => {
  const p = await ouvrirPage();
  assert.ok(p.w.CyberBaliseEngine && p.w.CyberBaliseRules, 'moteur ou règles absents');
  assert.equal(p.d.getElementById('sd-ex').children.length, 5, 'cinq exemples attendus');
  assert.equal(p.d.getElementById('sd-p1').hidden, false);
  p.fermer();
});

test('parcours SMS : trois étapes, verdict, focus sur le titre, aria-live', async () => {
  const p = await ouvrirPage();
  p.choisirType('sms');
  assert.equal(p.d.getElementById('sd-p2').hidden, false, 'étape 2 visible');
  p.saisir('sd-in', 'Colissimo : réglez 1,99 € sous 24h : https://colissimo-suivi-livraison.top/fr');
  assert.equal(p.d.getElementById('sd-go').disabled, false);
  p.clic(p.d.getElementById('sd-go'));
  const r = p.lireResultat();
  assert.equal(r.niveau, 3);
  assert.equal(r.focus, 'sd-vt', 'le focus doit aller au titre du verdict');
  assert.match(r.live, /Arnaque probable/);
  assert.equal(p.d.getElementById('sd-res').hidden, false);
  assert.equal(p.d.getElementById('sd-live').getAttribute('role'), 'status');
  assert.deepEqual(p.appelsReseau, [], 'aucune requête réseau pendant l\'analyse');
  p.fermer();
});

test('parcours e-mail : expéditeur, objet et pied de page pris en compte', async () => {
  const p = await ouvrirPage();
  const r = p.analyser({
    type: 'email', texte: 'Bonjour, veuillez trouver votre document en pièce jointe.',
    expediteur: 'Service Facturation <facturation@edf-facture.top>', objet: 'URGENT : DOCUMENT !!', pied: '© 2019 Ne pas répondre',
  });
  assert.equal(r.niveau, 3);
  assert.match(r.texte, /Incohérences vérifiables/);
  assert.match(r.texte, /Domaine « sosie »/);
  p.fermer();
});

test('parcours : en-têtes d\'un e-mail brut collé dans le champ texte', async () => {
  const p = await ouvrirPage();
  const brut = corpus.find((c) => c.id === 'B18');
  const r = p.analyser({ type: 'email', texte: brut.texte });
  assert.equal(r.niveau, 3);
  assert.match(r.texte, /contrôles techniques de l'e-mail ont échoué/);
  assert.equal(p.d.getElementById('sd-from').value, 'ameli@ameli-secure.top');
  p.fermer();
});

test('verdict : jamais de « sain », de coche verte ni de score chiffré', async () => {
  const p = await ouvrirPage();
  for (const t of ['Bonjour, votre rendez-vous chez le dentiste est confirmé pour mardi 14 h.', 'Votre colis Colissimo sera livré demain entre 9h et 12h.']) {
    p.choisirType('sms'); p.saisir('sd-in', t); p.clic(p.d.getElementById('sd-go'));
    const res = p.d.getElementById('sd-res').textContent;
    assert.ok(!/\bsain\b|Plutôt sain|points? pondér|score/i.test(res), 'mot interdit dans : ' + res.slice(0, 200));
    assert.ok(!res.includes('✓'), 'coche verte présente');
    const r = p.lireResultat();
    assert.equal(r.niveau, 0);
    assert.match(r.badge, /Aucun signal détecté/);
    assert.match(r.badge, /pas une garantie/i, 'la réserve doit être dans le badge');
    p.clic(p.d.getElementById('sd-again'));
  }
  p.fermer();
});

test('verdict : le bloc « ce que l\'outil n\'a pas pu vérifier » est toujours présent', async () => {
  const p = await ouvrirPage();
  const r = p.analyser({ texte: 'Bonjour, rendez-vous demain à 14 h.' });
  assert.match(r.texte, /Ce que cet outil n'a pas pu vérifier/);
  assert.match(r.texte, /âge et la réputation/);
  p.fermer();
});

test('newsletter : après « Que faire maintenant ? », et absente au niveau 3', async () => {
  const p = await ouvrirPage();
  p.analyser({ texte: 'Bonjour, votre rendez-vous chez le dentiste est confirmé pour mardi 14 h.' });
  const blocs = [...p.d.getElementById('sd-res').children].map((e) => e.id || e.className.split(' ')[0]);
  assert.ok(blocs.indexOf('sd-nl') > blocs.findIndex((x) => x === 'sd-help' || x.includes('sd-help')), 'newsletter avant les conseils : ' + blocs.join(','));
  assert.ok(p.d.getElementById('sd-nl'));
  p.clic(p.d.getElementById('sd-again'));
  p.analyser({ texte: 'URGENT : votre compte bancaire sera suspendu. Confirmez vos coordonnées via https://secure-verif.xyz' });
  assert.equal(p.d.getElementById('sd-nl'), null, 'pas de newsletter au niveau 3');
  p.fermer();
});

test('résultat : trois sections dans l\'ordre incohérences, manipulation, contexte', async () => {
  const p = await ouvrirPage();
  p.analyser({ texte: 'Colissimo : votre colis est retenu. Réglez 1,99 € sous 24h : https://colissimo-suivi.top/x', expediteur: '07 58 21 90 44' });
  const titres = [...p.d.querySelectorAll('#sd-res .sd-sec > h3')].map((h) => h.textContent);
  const pos = (re) => titres.findIndex((t) => re.test(t));
  assert.ok(pos(/Incohérences vérifiables/) >= 0, titres.join(' | '));
  assert.ok(pos(/Incohérences vérifiables/) < pos(/Signaux de manipulation/));
  assert.ok(pos(/Signaux de manipulation/) < pos(/Éléments de contexte \(non concluants\)/));
  p.fermer();
});

test('surlignage : les passages repérés sont des <mark> faits de nœuds texte', async () => {
  const p = await ouvrirPage();
  p.analyser({ texte: 'URGENT : votre compte sera suspendu. Régularisez sous 48 h sur https://secure-verif.xyz' });
  const marks = [...p.d.querySelectorAll('#sd-res mark.sd-m')];
  assert.ok(marks.length >= 2, 'au moins deux passages surlignés');
  for (const m of marks) assert.equal(m.children.length, 0, 'un <mark> ne contient que du texte');
  assert.ok(marks.some((m) => /secure-verif\.xyz/.test(m.textContent)));
  p.fermer();
});

test('sécurité : une charge XSS dans le texte, l\'expéditeur, l\'objet ou le pied est affichée comme texte', async () => {
  const p = await ouvrirPage();
  const charge = '<img src=x onerror=window.__xss=1><script>window.__xss=2</script>';
  p.analyser({ type: 'email', texte: 'Urgent : confirmez sur https://secure-verif.xyz ' + charge, expediteur: charge + ' <a@b.top>', objet: charge, pied: charge });
  const res = p.d.getElementById('sd-res');
  assert.equal(res.querySelector('img'), null, 'aucune balise <img> injectée');
  assert.equal(res.querySelector('script'), null, 'aucune balise <script> injectée');
  assert.equal(res.querySelectorAll('[onerror]').length, 0);
  assert.equal(p.w.__xss, undefined, 'le code injecté ne doit pas s\'exécuter');
  assert.ok(res.textContent.includes('<img src=x onerror=window.__xss=1>'), 'la charge doit apparaître littéralement');
  p.fermer();
});

test('sécurité : innerHTML n\'est utilisé que sur du contenu statique du site', () => {
  const src = fs.readFileSync(path.join(PAGE_OUTIL, 'ui.js'), 'utf8').split('\n');
  const lignes = src.map((l, i) => [i + 1, l.trim()]).filter(([, l]) => /\.innerHTML/.test(l) && !l.startsWith('//') && !l.startsWith('/*'));
  const autorises = [
    /^function esc\(s\)\{ var d=document\.createElement\('div'\); d\.textContent=s; return d\.innerHTML; \}$/,
    /^el\('sd-from-help'\)\.innerHTML = mail \?/,
    /^help\.querySelector\('ol'\)\.innerHTML = todo;/,
    /^help\.querySelector\('\.sd-pills'\)\.innerHTML = pills;/,
    /^extra\.innerHTML = \(level < 3 \? nlHTML\(\) : ''\) \+ shareHTML\(\);/,
  ];
  const interdites = lignes.filter(([, l]) => !autorises.some((re) => re.test(l)));
  assert.deepEqual(interdites, [], 'innerHTML non prévu : ' + JSON.stringify(interdites));
  assert.equal(src.join('\n').match(/\beval\(|new Function\(|document\.write\(/g), null);
});

test('exemples : chacun s\'analyse et le message légitime reste au niveau 0 ou 1', async () => {
  const p = await ouvrirPage();
  const noms = [...p.d.querySelectorAll('#sd-ex button strong')].map((e) => e.textContent);
  assert.deepEqual(noms, ['Faux colis', 'Faux conseiller', 'Faux proche', 'Faux e-mail impôts', 'Message légitime']);
  const niveaux = {};
  for (let i = 0; i < 5; i++) {
    p.clic(p.d.querySelectorAll('#sd-ex button')[i]);
    niveaux[noms[i]] = p.lireResultat().niveau;
    p.clic(p.d.getElementById('sd-again'));
  }
  assert.ok(niveaux['Message légitime'] <= 1, JSON.stringify(niveaux));
  for (const n of ['Faux colis', 'Faux conseiller', 'Faux proche', 'Faux e-mail impôts']) assert.ok(niveaux[n] >= 2, `${n} : ${niveaux[n]}`);
  p.fermer();
});

test('copier le résumé : un bouton, qui ne contient pas le message', async () => {
  const p = await ouvrirPage();
  let copie = '';
  Object.defineProperty(p.w.navigator, 'clipboard', { value: { writeText: (t) => { copie = t; return Promise.resolve(); }, readText: () => Promise.resolve('') }, configurable: true });
  p.analyser({ texte: 'Colissimo : réglez 1,99 € sous 24h : https://colissimo-suivi-livraison.top/fr MOTSECRET123' });
  p.clic(p.d.getElementById('sd-copy'));
  await new Promise((ok) => setTimeout(ok, 20));
  assert.match(copie, /Verdict : Arnaque probable/);
  assert.ok(copie.split('\n').filter((l) => l.startsWith('- ')).length >= 1);
  assert.ok(!copie.includes('MOTSECRET123') && !copie.includes('colissimo-suivi-livraison.top'), 'le message ne doit pas figurer dans le résumé');
  p.fermer();
});

test('accessibilité : étapes et titres', async () => {
  const p = await ouvrirPage();
  assert.ok(p.d.querySelector('#sd-steps[aria-label]'));
  assert.ok(p.d.querySelector('li[aria-current="step"]'));
  p.analyser({ texte: 'URGENT : votre compte sera suspendu : https://secure-verif.xyz' });
  assert.equal(p.d.getElementById('sd-vt').getAttribute('tabindex'), '-1');
  assert.ok(p.d.querySelector('#sd-res [aria-labelledby]'));
  const boutonsSansNom = [...p.d.querySelectorAll('#sd-res button')].filter((b) => !b.textContent.trim() && !b.getAttribute('aria-label'));
  assert.equal(boutonsSansNom.length, 0);
  p.fermer();
});

test('import .txt par glisser-déposer', async () => {
  const p = await ouvrirPage();
  p.choisirType('sms');
  const f = new p.w.File(['Votre compte sera suspendu : confirmez sur https://secure-verif.xyz sous 24h'], 'message.txt', { type: 'text/plain' });
  const ev = new p.w.Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'dataTransfer', { value: { files: [f] } });
  p.d.getElementById('sd-card').dispatchEvent(ev);
  await new Promise((ok) => setTimeout(ok, 100));
  assert.match(p.d.getElementById('sd-in').value, /secure-verif\.xyz/);
  p.clic(p.d.getElementById('sd-go'));
  assert.equal(p.lireResultat().niveau, 3);
  p.fermer();
});
