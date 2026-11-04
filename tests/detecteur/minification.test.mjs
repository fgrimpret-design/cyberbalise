// La version minifiée déployée doit se comporter exactement comme les sources lisibles du dépôt.
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { minifier, retirerTests } from '../../scripts/minify-detecteur.mjs';
import { PAGE_OUTIL, chargerCorpus } from './lib.mjs';
import { ouvrirPage } from './dom.mjs';

const require = createRequire(import.meta.url);
const corpus = chargerCorpus();
let dossier, rapport, Source, Mini, RMini, RSource;

before(async () => {
  dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'min-det-'));
  rapport = await minifier(dossier);
  RSource = require(path.join(PAGE_OUTIL, 'regles.js'));
  Source = require(path.join(PAGE_OUTIL, 'moteur.js'));
  RMini = require(path.join(dossier, 'regles.js'));
  Mini = require(path.join(dossier, 'moteur.js'));
});

const entree = (c) => ({ texte: c.texte, type: c.type, expediteur: c.expediteur, objet: c.objet, piedDePage: c.pied, qr: c.qr });

test('minification : mêmes règles, sans les tests embarqués', () => {
  assert.equal(RMini.REGLES.length, RSource.REGLES.length);
  assert.equal(RMini.SCENARIOS.length, RSource.SCENARIOS.length);
  assert.equal(RMini.MARQUES.length, RSource.MARQUES.length);
  assert.equal(RMini.VERSION, RSource.VERSION);
  assert.ok(RMini.REGLES.every((r) => r.tests === undefined), 'les tests ne doivent pas être déployés');
  assert.deepEqual(RMini.REGLES.map((r) => r.motifs.map((m) => m.source + '/' + m.flags)), RSource.REGLES.map((r) => r.motifs.map((m) => m.source + '/' + m.flags)), 'motifs identiques');
  assert.deepEqual(RMini.REGLES.map((r) => [r.id, r.poids, r.explication, r.action]), RSource.REGLES.map((r) => [r.id, r.poids, r.explication, r.action]));
});

test('minification : résultats d\'analyse identiques sur les 140 messages du corpus', () => {
  for (const c of corpus) assert.deepEqual(JSON.parse(JSON.stringify(Mini.analyser(entree(c)))), JSON.parse(JSON.stringify(Source.analyser(entree(c)))), c.id);
});

test('minification : mêmes résultats pour .eml, domaines récents et liens', () => {
  const eml = ['Return-Path: <b@mail-4455.top>', 'Authentication-Results: mx; spf=fail; dkim=none', 'From: =?UTF-8?Q?Imp=C3=B4ts?= <r@impots-gouv-fr.top>', 'Reply-To: <x@autre.xyz>', 'Subject: Remboursement', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: quoted-printable', '', 'Confirmez vos coordonn=C3=A9es bancaires : https://impots-gouv-fr.top/r'].join('\n');
  const cas = [{ texte: eml, type: 'email' }, { texte: 'Confirmez : https://exemple-suivi.top/x', type: 'sms', domaines: { 'exemple-suivi.top': { ageJours: 4 } } }, { texte: 'https://amazon.fr@evil.top/login', type: 'sms' }];
  for (const e of cas) assert.deepEqual(JSON.parse(JSON.stringify(Mini.analyser(e))), JSON.parse(JSON.stringify(Source.analyser(e))));
  assert.equal(Mini.nettoyerEml(eml), Source.nettoyerEml(eml));
});

test('minification : le balayage des tests ne casse ni chaîne ni accolade', () => {
  const src = fs.readFileSync(path.join(PAGE_OUTIL, 'regles.js'), 'utf8');
  const { code, retires } = retirerTests(src);
  assert.equal(retires, RSource.REGLES.length, 'un bloc « tests » par règle');
  assert.ok(code.length < src.length);
  assert.doesNotThrow(() => new Function(code));
});

test('minification : la page complète fonctionne avec les scripts minifiés (parcours, XSS, e-mail, réseau)', async () => {
  const p = await ouvrirPage({ dossierScripts: dossier });
  assert.ok(p.w.CyberBaliseEngine && p.w.CyberBaliseRules);
  let r = p.analyser({ texte: 'Colissimo : réglez 1,99 € sous 24h : https://colissimo-suivi-livraison.top/fr', expediteur: '07 58 21 90 44' });
  assert.equal(r.niveau, 3);
  assert.equal(r.focus, 'sd-vt');
  p.clic(p.d.getElementById('sd-again'));
  const charge = '<img src=x onerror=window.__xss=1>';
  r = p.analyser({ type: 'email', texte: 'Urgent : confirmez sur https://secure-verif.xyz ' + charge, expediteur: charge + ' <a@b.top>', objet: charge, pied: charge });
  assert.equal(p.d.querySelector('#sd-res img'), null);
  assert.equal(p.w.__xss, undefined);
  assert.deepEqual(p.appelsReseau, []);
  p.clic(p.d.getElementById('sd-again'));
  for (const [i, nom] of ['Faux colis', 'Faux conseiller', 'Faux proche', 'Faux e-mail impôts', 'Message légitime'].entries()) {
    p.clic(p.d.querySelectorAll('#sd-ex button')[i]);
    const n = p.lireResultat().niveau;
    assert.ok(nom === 'Message légitime' ? n <= 1 : n >= 2, `${nom} : ${n}`);
    p.clic(p.d.getElementById('sd-again'));
  }
  p.fermer();
});

test('minification : le poids ajouté par rapport à l\'ancien script reste sous 25 000 octets en gzip', () => {
  const ancien = fs.readFileSync(path.join(path.dirname(PAGE_OUTIL), '..', 'tests', 'detecteur', 'legacy', 'index.v1.html'), 'utf8');
  const a = ancien.indexOf('<script>\n(function(){\n  var D = ');
  const b = ancien.indexOf('setStep(1); upd();\n})();\n</script>', a) + 37;
  const poidsAncien = zlib.gzipSync(ancien.slice(a, b), { level: 9 }).length;
  const poidsNouveau = ['regles.js', 'moteur.js', 'ui.js'].map((f) => zlib.gzipSync(fs.readFileSync(path.join(dossier, f)), { level: 9 }).length).reduce((x, y) => x + y, 0);
  assert.ok(poidsNouveau - poidsAncien <= 25000, `+${poidsNouveau - poidsAncien} octets (ancien ${poidsAncien}, nouveau ${poidsNouveau})`);
});
