// Tests unitaires des règles : chaque règle doit porter ses propres exemples positifs et négatifs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { PAGE_OUTIL } from './lib.mjs';

const require = createRequire(import.meta.url);
const R = require(path.join(PAGE_OUTIL, 'regles.js'));
const M = require(path.join(PAGE_OUTIL, 'moteur.js'));

test('les identifiants de règles sont uniques', () => {
  const ids = R.REGLES.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
});

for (const regle of R.REGLES) {
  test(`règle ${regle.id} : structure`, () => {
    assert.ok(['manipulation', 'contexte'].includes(regle.categorie), 'catégorie inconnue');
    assert.ok(regle.poids >= 1 && regle.poids <= 5, 'poids hors de 1 à 5');
    assert.ok(Array.isArray(regle.portee) && regle.portee.length, 'portée vide');
    assert.ok(regle.portee.every((p) => ['corps', 'objet'].includes(p)), 'portée inconnue');
    assert.ok(regle.libelle && regle.explication, 'libellé ou explication manquant');
    assert.ok(R.FICHES[regle.fiche], 'fiche inconnue : ' + regle.fiche);
    assert.ok(regle.motifs.length > 0, 'aucun motif');
  });

  test(`règle ${regle.id} : motifs bornés et sans accents`, () => {
    for (const m of regle.motifs) {
      const src = m.source;
      assert.ok(!/[\u00c0-\u00ff\u0152\u0153]/.test(src) || m.flags.includes('u'), `lettre accentuée dans le motif ${src}`);
      assert.ok(!/(^|[^\\\]])\.[*+](?!\?)/.test(src), `quantificateur non borné « .* » ou « .+ » dans ${src}`);
      assert.ok(!/\[\^[^\]]*\][*+]/.test(src), `classe négative non bornée dans ${src}`);
    }
  });

  test(`règle ${regle.id} : exemples positifs et négatifs`, () => {
    assert.ok(regle.tests && regle.tests.positifs.length >= 1, 'au moins un test positif');
    assert.ok(regle.tests.negatifs.length >= 1, 'au moins un test négatif');
    for (const p of regle.tests.positifs) assert.ok(M.testerRegle(regle, p), `devrait se déclencher sur : ${p}`);
    for (const n of regle.tests.negatifs) assert.ok(!M.testerRegle(regle, n), `ne devrait pas se déclencher sur : ${n}`);
  });
}

test('les scénarios ne référencent que des indices connus', () => {
  const connus = new Set(R.REGLES.map((r) => r.id).concat(['lien', 'qr', 'hote_non_officiel', 'manip']));
  var cats = new Set(R.MARQUES.map((b) => 'marque:' + b.cat).concat(R.MARQUES.map((b) => 'marque:' + b.id)));
  for (const sc of R.SCENARIOS) {
    const ids = sc.briques.map((b) => b.id);
    assert.ok(sc.confirme.every((i) => ids.includes(i)), `${sc.id} : brique « confirme » inconnue`);
    assert.ok(sc.partiel.every((i) => ids.includes(i)), `${sc.id} : brique « partiel » inconnue`);
    assert.ok(R.FICHES[sc.fiche], `${sc.id} : fiche inconnue`);
    for (const b of sc.briques) for (const i of b.indices) assert.ok(connus.has(i) || cats.has(i), `${sc.id}/${b.id} : indice inconnu « ${i} »`);
  }
});

test('les fiches citées existent sur le site', async () => {
  const fs = await import('node:fs');
  const { RACINE } = await import('./lib.mjs');
  for (const f of Object.values(R.FICHES)) {
    const p = path.join(RACINE, f.url.replace(/^\//, ''), 'index.html');
    assert.ok(fs.existsSync(p), `fiche introuvable : ${f.url}`);
  }
});

test('au moins 15 motifs anglais', () => {
  const anglais = /\b(your|verify|click|within|notice|gift|seed|delivery|customs|refund|password|sign|parcel|package|wire|unusual|suspicious|security|billing|dear|wallet|congratulations|prize|redeliver|remote|never|guaranteed|compromising|webcam)\b/;
  let n = 0;
  for (const r of R.REGLES) for (const m of r.motifs) if (anglais.test(m.source)) n++;
  assert.ok(n >= 15, `seulement ${n} motifs anglais`);
});
