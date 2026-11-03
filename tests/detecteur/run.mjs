// Mesure les niveaux rendus sur le corpus. Usage :
//   node tests/detecteur/run.mjs --legacy   -> ancienne version, écrit BASELINE.md
//   node tests/detecteur/run.mjs            -> moteur actuel, écrit BENCHMARK.md (à partir du lot L2)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ICI, PAGE_OUTIL, chargerCorpus, statistiques, composition, nomNiveau, tronquer, attenduTexte } from './lib.mjs';

const legacy = process.argv.includes('--legacy');
const ecrire = !process.argv.includes('--sans-fichier');
const corpus = chargerCorpus();
const niveaux = {};
const titres = {};
let enTete;

if (legacy) {
  const { analyserLegacy } = await import('./legacy-dom.mjs');
  for (const c of corpus) {
    const r = analyserLegacy(c);
    niveaux[c.id] = r.niveau;
    titres[c.id] = r.titre;
  }
  enTete = {
    titre: 'BASELINE : outil actuel (avant refonte)',
    intro: "Mesure de la version en production avant refonte (copie figée dans `tests/detecteur/legacy/index.v1.html`), exécutée dans jsdom avec le parcours complet de l'outil. Échelle de l'ancienne version : 1 = « Plutôt sain », 2 = « Douteux », 3 = « Très probablement une arnaque ». Le niveau 1 est comparé à la cible « 0 ou 1 ».",
    fichier: 'BASELINE.md',
  };
} else {
  const require = createRequire(import.meta.url);
  const moteurPath = path.join(PAGE_OUTIL, 'moteur.js');
  if (!fs.existsSync(moteurPath)) {
    console.error('Le moteur (outils/detecteur-arnaque/moteur.js) n\'existe pas encore : utilisez --legacy.');
    process.exit(2);
  }
  const Moteur = require(moteurPath);
  for (const c of corpus) {
    const r = Moteur.analyser({ texte: c.texte, type: c.type, expediteur: c.expediteur, objet: c.objet, piedDePage: c.pied, qr: c.qr });
    niveaux[c.id] = r.niveau;
    titres[c.id] = nomNiveau(r.niveau);
  }
  const Regles = require(path.join(PAGE_OUTIL, 'regles.js'));
  enTete = {
    titre: 'BENCHMARK : moteur 2.x',
    intro: `Mesure du moteur v${Regles.VERSION} sur le corpus de test, en Node pur (sans navigateur). Échelle : 0 = aucun signal, 1 = signaux faibles, 2 = message suspect, 3 = arnaque probable.`,
    fichier: 'BENCHMARK.md',
  };
}

const s = statistiques(corpus, niveaux);
const comp = composition(corpus);
const lignes = [];
lignes.push(`# ${enTete.titre}`, '', enTete.intro, '');
lignes.push(`Date de mesure : ${new Date().toISOString().slice(0, 10)}. Échantillon : **${s.total} messages** (${Object.entries(comp).map(([k, v]) => `${k} : ${v}`).join(', ')}). Les messages sont fictifs ou paraphrasés ; l'échantillon est petit, les pourcentages sont donc indicatifs.`, '');
lignes.push('## Synthèse', '');
lignes.push('| Indicateur | Valeur |', '|---|---|');
lignes.push(`| Cas conformes à la cible | ${s.conformes} / ${s.total} |`);
lignes.push(`| Faux positifs (légitimes ou prévention au niveau ≥ 2) | ${s.fauxPositifs2.length} / ${s.legitimes} (${s.faussesAlertesPct} %) |`);
lignes.push(`| dont au niveau 3 | ${s.fauxPositifs3.length} / ${s.legitimes} |`);
lignes.push(`| Détection (hameçonnages au niveau ≥ 2) | ${s.detection2} / ${s.hameconnages} (${s.detection2Pct} %) |`);
lignes.push(`| Détection forte (niveau 3) | ${s.detection3} / ${s.hameconnages} (${s.detection3Pct} %) |`);
lignes.push(`| Faux négatifs (hameçonnages au niveau ≤ 1) | ${s.fauxNegatifs.length} / ${s.hameconnages} (${s.fauxNegatifsPct} %) |`, '');
lignes.push('## Détail par message', '');
lignes.push('| Id | Catégorie | Message | Niveau mesuré | Cible | Conforme |', '|---|---|---|---|---|---|');
for (const c of corpus) {
  const n = niveaux[c.id];
  const ok = n <= c.attendu[1] && (n >= c.attendu[0] || (n === 1 && c.attendu[0] === 0));
  const msg = tronquer((c.expediteur ? `[${c.expediteur}] ` : '') + (c.texte || (c.qr ? 'QR : ' + c.qr.join(' ') : '')), 60).replace(/\|/g, '\\|');
  lignes.push(`| ${c.id} | ${c.categorie} | ${msg} | ${n} (${legacy ? titres[c.id] : nomNiveau(n)}) | ${attenduTexte(c.attendu)} | ${ok ? 'oui' : '**non**'} |`);
}
lignes.push('');
lignes.push('## Cas de non-régression de l\'annexe B du cahier des charges', '');
lignes.push('| Annexe | Id | Niveau mesuré | Cible | Conforme |', '|---|---|---|---|---|');
for (const a of s.annexeB) lignes.push(`| ${a.annexe} | ${a.id} | ${a.niveau} | ${attenduTexte(a.attendu)} | ${a.ok ? 'oui' : '**non**'} |`);
lignes.push('', `Annexe B conforme : **${s.annexeB.filter((a) => a.ok).length} / ${s.annexeB.length}**.`, '');
if (s.fauxPositifs2.length) lignes.push('Faux positifs : ' + s.fauxPositifs2.map((c) => `${c.id} (niveau ${niveaux[c.id]})`).join(', ') + '.', '');
if (s.fauxNegatifs.length) lignes.push('Faux négatifs : ' + s.fauxNegatifs.map((c) => `${c.id} (niveau ${niveaux[c.id]})`).join(', ') + '.', '');
lignes.push('_Fichier généré par `node tests/detecteur/run.mjs' + (legacy ? ' --legacy' : '') + '`. Ne pas modifier à la main._', '');

const md = lignes.join('\n');
console.log(md);
if (ecrire) fs.writeFileSync(path.join(ICI, enTete.fichier), md, 'utf8');
