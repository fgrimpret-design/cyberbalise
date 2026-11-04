// Tests des nouvelles entrées : e-mails bruts (.eml), codes QR, âge des domaines (RDAP facultatif).
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { PAGE_OUTIL, RACINE } from './lib.mjs';
import { ouvrirPage } from './dom.mjs';

const require = createRequire(import.meta.url);
const R = require(path.join(PAGE_OUTIL, 'regles.js'));
const M = require(path.join(PAGE_OUTIL, 'moteur.js'));

/* ===== e-mails bruts ===== */
const sujetEncode = '=?UTF-8?B?' + Buffer.from('Votre remboursement est en attente').toString('base64') + '?=';
const corpsQP = 'Bonjour,\r\n\r\nPour recevoir votre remboursement de 312,40 =E2=82=AC, confirmez vos coordonn=C3=A9es bancaires sous 48 h :\r\nhttps://impots-gouv-fr.top/remboursement\r\n';
const eml = [
  'Received: from mx.exemple.net by mx2.exemple.net; Tue, 3 Nov 2026 10:00:00 +0100',
  'Return-Path: <bounce@mail-delivery-4455.top>',
  'Authentication-Results: mx.exemple.net; spf=fail smtp.mailfrom=mail-delivery-4455.top; dkim=none; dmarc=fail',
  'From: =?UTF-8?Q?Direction_G=C3=A9n=C3=A9rale_des_Finances_Publiques?= <remboursement@impots-gouv-fr.top>',
  'Reply-To: <gains@autre-domaine.xyz>',
  'Subject: ' + sujetEncode,
  'MIME-Version: 1.0',
  'Content-Type: multipart/alternative; boundary="BORD"',
  '',
  'This is a multi-part message.',
  '--BORD',
  'Content-Type: text/html; charset="UTF-8"',
  'Content-Transfer-Encoding: base64',
  '',
  Buffer.from('<p>HTML</p>').toString('base64'),
  '--BORD',
  'Content-Type: text/plain; charset="UTF-8"',
  'Content-Transfer-Encoding: quoted-printable',
  '',
  corpsQP,
  '--BORD--',
  '',
].join('\r\n');

test('.eml : mots encodés, multipart, quoted-printable et base64 sont décodés', () => {
  const p = M.preparer({ texte: eml, type: 'email' });
  assert.match(p.expediteur, /Direction Générale des Finances Publiques/);
  assert.equal(p.objet, 'Votre remboursement est en attente');
  assert.match(p.corps, /remboursement de 312,40 €/);
  assert.match(p.corps, /coordonnées bancaires/);
  assert.ok(!p.corps.includes('multi-part'), 'le préambule MIME ne doit pas apparaître');
  assert.ok(!p.corps.includes('HTML'), 'la partie text/plain est préférée au HTML');
});

test('.eml : le verdict combine incohérences, authentification et scénario', () => {
  const r = M.analyser({ texte: eml, type: 'email' });
  assert.equal(r.niveau, 3);
  const ids = r.incoherences.map((i) => i.id);
  assert.ok(ids.includes('AUTHENTIFICATION_ECHEC'), ids.join(','));
  assert.ok(ids.includes('REPONSE_DIVERGENTE'), ids.join(','));
  assert.ok(ids.includes('RETOUR_DIVERGENT'), ids.join(','));
  assert.ok(ids.includes('DOMAINE_SOSIE'), ids.join(','));
  assert.ok(r.scenarios.some((s) => s.id === 'S5' && s.statut === 'confirme'));
});

test('.eml : e-mail HTML seul, les adresses réelles des liens sont conservées', () => {
  const brut = ['From: Support <support@exemple.fr>', 'Subject: Votre compte', 'Content-Type: text/html; charset=utf-8', '', '<html><body><p>Bonjour, cliquez sur <a href="https://secure-verif.top/login">https://www.exemple.fr/compte</a></p><script>x</script></body></html>'].join('\n');
  const p = M.preparer({ texte: brut, type: 'email' });
  assert.match(p.corps, /secure-verif\.top\/login/);
  assert.ok(!p.corps.includes('<p>') && !p.corps.includes('x</script'));
  const r = M.analyser({ texte: brut, type: 'email' });
  assert.ok(r.lienAnalyse.some((l) => l.hote === 'secure-verif.top' && l.niveau >= 1));
});

test('.eml : Return-Path différent mais SPF validé -> aucune incohérence (expéditeur de masse légitime)', () => {
  const brut = ['Return-Path: <bounce@mail.newsletter-service.net>', 'Authentication-Results: mx.exemple.net; spf=pass; dkim=pass; dmarc=pass', 'From: Boutique <contact@atelier-boutique.fr>', 'Subject: Nouveautés', '', 'Découvrez nos nouveautés de saison.'].join('\n');
  const r = M.analyser({ texte: brut, type: 'email' });
  assert.deepEqual(r.incoherences, []);
  assert.equal(r.contexte.enteteAuthentification.spf, 'pass');
});

test('.eml : nettoyerEml garde l\'authentification et décode le corps', () => {
  const propre = M.nettoyerEml(eml);
  assert.match(propre, /^From: Direction Générale/m);
  assert.match(propre, /^Authentication-Results: .*spf=fail/m);
  assert.match(propre, /confirmez vos coordonnées bancaires/);
  assert.ok(!/^Received:/m.test(propre));
  assert.equal(M.analyser({ texte: propre, type: 'email' }).niveau, 3, 'le texte nettoyé conserve le verdict');
});

test('.eml : charge hostile ou énorme, sans plantage ni lenteur', () => {
  const t0 = Date.now();
  const gros = 'From: a@b.fr\nContent-Type: multipart/mixed; boundary=B\n\n' + ('--B\nContent-Type: text/html\n\n<a href="x">' + '<'.repeat(3000) + '\n').repeat(40);
  const r = M.analyser({ texte: gros, type: 'email' });
  assert.ok(r.niveau >= 0);
  assert.ok(Date.now() - t0 < 500, `${Date.now() - t0} ms`);
});

/* ===== codes QR ===== */
test('QR : un code QR réel est décodé par jsQR puis analysé comme un lien', async () => {
  const QRCode = require('qrcode'), { PNG } = require('pngjs'), jsQR = require('jsqr');
  const png = await QRCode.toBuffer('https://amendes-antai-paiement.top', { margin: 4, scale: 8 });
  const img = PNG.sync.read(png);
  const code = jsQR(new Uint8ClampedArray(img.data), img.width, img.height);
  assert.equal(code && code.data, 'https://amendes-antai-paiement.top');
  const r = M.analyser({ texte: '', type: 'sms', qr: [code.data] });
  assert.equal(r.niveau, 3);
  assert.ok(r.lienAnalyse[0].origine === 'qr');
  assert.ok(r.lienAnalyse[0].raisons.includes('MARQUE_TIERS'));
  assert.ok(r.incoherences.some((i) => i.id === 'LIEN_MARQUE_TIERS'));
});

test('QR : l\'empreinte d\'intégrité de jsQR dans ui.js correspond au fichier épinglé', () => {
  const ui = fs.readFileSync(path.join(PAGE_OUTIL, 'ui.js'), 'utf8');
  const sri = /JSQR_SRI = '(sha384-[^']+)'/.exec(ui)[1];
  const fichier = fs.readFileSync(path.join(RACINE, 'node_modules', 'jsqr', 'dist', 'jsQR.js'));
  assert.equal(sri, 'sha384-' + crypto.createHash('sha384').update(fichier).digest('base64'));
  assert.match(ui, /jsqr@1\.4\.0/);
  assert.equal(require(path.join(RACINE, 'node_modules', 'jsqr', 'package.json')).version, '1.4.0');
});

test('QR : jsQR n\'est téléchargé que dans la fonction d\'import d\'image', () => {
  const ui = fs.readFileSync(path.join(PAGE_OUTIL, 'ui.js'), 'utf8');
  const html = fs.readFileSync(path.join(PAGE_OUTIL, 'index.html'), 'utf8');
  assert.ok(!/jsqr|jsdelivr/i.test(html.replace(/<script[^>]*src="\/assets[^>]*>/g, '')), 'aucune balise de chargement externe dans la page');
  assert.equal((ui.match(/loadJsQR\(\)/g) || []).length, 2, 'défini une fois, appelé une fois (repli de decodeQR)');
});

/* ===== âge des domaines (RDAP) ===== */
test('RDAP : un domaine récent devient une incohérence forte quand le message se réclame d\'une marque', () => {
  const entree = { texte: 'Votre compte sera suspendu, confirmez sur https://exemple-suivi.top/x', type: 'sms' };
  const sans = M.analyser(entree);
  const avec = M.analyser({ ...entree, domaines: { 'exemple-suivi.top': { ageJours: 6 } } });
  assert.ok(!sans.lienAnalyse[0].raisons.includes('DOMAINE_RECENT'));
  assert.ok(avec.lienAnalyse[0].raisons.includes('DOMAINE_RECENT'));
  assert.equal(avec.lienAnalyse[0].ageJours, 6);
  assert.ok(avec.incoherences.some((i) => i.id === 'DOMAINE_RECENT'));
  assert.match(avec.limites[0], /réputation/);
  assert.match(sans.limites[0], /âge et la réputation/);
});

test('RDAP : un domaine ancien n\'ajoute aucun signal', () => {
  const r = M.analyser({ texte: 'Voici le programme : https://www.atelier-boutique.fr/reunion', type: 'sms', domaines: { 'atelier-boutique.fr': { ageJours: 4000 } } });
  assert.deepEqual(r.incoherences, []);
  assert.ok(!r.lienAnalyse[0].raisons.includes('DOMAINE_RECENT'));
});

function rdapReponse(joursAvant) {
  const d = new Date(Date.now() - joursAvant * 864e5).toISOString();
  return { ok: true, status: 200, json: () => Promise.resolve({ events: [{ eventAction: 'registration', eventDate: d }, { eventAction: 'last changed', eventDate: d }] }) };
}
const MESSAGE_LIEN = 'URGENT : votre compte sera suspendu, confirmez sur https://exemple-suivi.top/verif?id=SECRET42 ou https://www.amazon.fr/gp/css';

test('RDAP : la case est décochée par défaut et rien n\'est envoyé tant qu\'elle l\'est', async () => {
  const p = await ouvrirPage();
  const box = p.d.getElementById('sd-rdap');
  assert.equal(box.checked, false);
  assert.match(p.d.querySelector('.sd-rdap').textContent, /seuls les noms de domaine/);
  p.analyser({ texte: MESSAGE_LIEN });
  assert.deepEqual(p.appelsReseau, []);
  p.fermer();
});

test('RDAP : case cochée -> seul le domaine est envoyé, sans identifiants ni référent, et le verdict l\'utilise', async () => {
  const p = await ouvrirPage();
  const appels = [];
  p.w.fetch = (url, opts) => { appels.push([String(url), opts]); return Promise.resolve(rdapReponse(5)); };
  p.choisirType('sms');
  p.d.getElementById('sd-rdap').checked = true;
  p.saisir('sd-in', MESSAGE_LIEN);
  p.clic(p.d.getElementById('sd-go'));
  await new Promise((ok) => setTimeout(ok, 50));
  assert.equal(appels.length, 1, 'un seul domaine non officiel à vérifier : ' + JSON.stringify(appels.map((a) => a[0])));
  assert.equal(appels[0][0], 'https://rdap.org/domain/exemple-suivi.top');
  assert.equal(appels[0][1].credentials, 'omit');
  assert.equal(appels[0][1].referrerPolicy, 'no-referrer');
  assert.ok(!appels[0][1].body, 'aucun corps de requête');
  const envoye = JSON.stringify(appels);
  assert.ok(!/SECRET42|compte sera suspendu|amazon/i.test(envoye), 'rien du message ne doit partir');
  const r = p.lireResultat();
  assert.match(r.texte, /Domaine enregistré depuis 5 jours/);
  assert.match(r.texte, /Le site derrière le lien est très récent/);
  p.fermer();
});

test('RDAP : cache en mémoire, pas de seconde requête pour le même domaine', async () => {
  const p = await ouvrirPage();
  let n = 0;
  p.w.fetch = () => { n++; return Promise.resolve(rdapReponse(900)); };
  for (let i = 0; i < 2; i++) {
    p.choisirType('sms'); p.d.getElementById('sd-rdap').checked = true;
    p.saisir('sd-in', MESSAGE_LIEN); p.clic(p.d.getElementById('sd-go'));
    await new Promise((ok) => setTimeout(ok, 40));
    p.clic(p.d.getElementById('sd-again'));
  }
  assert.equal(n, 1);
  assert.equal(p.d.getElementById('sd-rdap').checked, false, 'la case est décochée après une nouvelle analyse');
  p.fermer();
});

test('RDAP : échec réseau ou CORS -> dégradation silencieuse, le verdict s\'affiche quand même', async () => {
  const p = await ouvrirPage();
  p.w.fetch = () => Promise.reject(new TypeError('Failed to fetch'));
  p.choisirType('sms'); p.d.getElementById('sd-rdap').checked = true;
  p.saisir('sd-in', MESSAGE_LIEN); p.clic(p.d.getElementById('sd-go'));
  await new Promise((ok) => setTimeout(ok, 60));
  const r = p.lireResultat();
  assert.ok(r.niveau >= 2);
  assert.ok(!/RDAP|Domaine enregistré/.test(r.texte.replace(/rdap\.org/g, '')) || !/Domaine enregistré depuis/.test(r.texte));
  assert.equal(p.d.getElementById('sd-ocr').textContent, '', 'aucun message d\'erreur affiché');
  p.fermer();
});

test('RDAP : au plus trois domaines, jamais un domaine officiel de marque ni une adresse IP', async () => {
  const p = await ouvrirPage();
  const appels = [];
  p.w.fetch = (url) => { appels.push(String(url)); return Promise.resolve(rdapReponse(900)); };
  p.choisirType('sms'); p.d.getElementById('sd-rdap').checked = true;
  p.saisir('sd-in', 'Confirmez : https://a-test.top https://b-test.xyz https://c-test.info https://d-test.club https://www.amazon.fr/x http://192.168.1.5/login');
  p.clic(p.d.getElementById('sd-go'));
  await new Promise((ok) => setTimeout(ok, 60));
  assert.equal(appels.length, 3);
  assert.ok(appels.every((u) => /^https:\/\/rdap\.org\/domain\/[a-z0-9.-]+$/.test(u)));
  assert.ok(!appels.some((u) => /amazon|192\.168/.test(u)));
  p.fermer();
});

/* ===== import .eml dans la page ===== */
test('page : import d\'un .eml par glisser-déposer', async () => {
  const p = await ouvrirPage();
  p.choisirType('sms');
  const f = new p.w.File([eml], 'message.eml', { type: 'message/rfc822' });
  const ev = new p.w.Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'dataTransfer', { value: { files: [f] } });
  p.d.getElementById('sd-card').dispatchEvent(ev);
  await new Promise((ok) => setTimeout(ok, 120));
  assert.match(p.d.getElementById('sd-in').value, /confirmez vos coordonnées bancaires/);
  assert.match(p.d.getElementById('sd-in').value, /^Authentication-Results: .*spf=fail/m);
  assert.ok(!p.d.getElementById('sd-p2').querySelector('.sd-only-mail').hidden, 'les champs e-mail sont affichés');
  p.clic(p.d.getElementById('sd-go'));
  const r = p.lireResultat();
  assert.equal(r.niveau, 3);
  assert.equal(p.d.getElementById('sd-from').value.includes('impots-gouv-fr.top'), true);
  p.fermer();
});
