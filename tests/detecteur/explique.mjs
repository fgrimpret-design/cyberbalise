// Affiche, pour des cas choisis, le niveau et les raisons du moteur (outil de mise au point).
import { createRequire } from 'node:module';
import path from 'node:path';
import { PAGE_OUTIL, chargerCorpus } from './lib.mjs';

const require = createRequire(import.meta.url);
const M = require(path.join(PAGE_OUTIL, 'moteur.js'));
const ids = process.argv.slice(2);
const corpus = chargerCorpus();
const cas = ids.length ? corpus.filter((c) => ids.includes(c.id)) : corpus;
for (const c of cas) {
  const r = M.analyser({ texte: c.texte, type: c.type, expediteur: c.expediteur, objet: c.objet, piedDePage: c.pied, qr: c.qr });
  console.log(`${c.id} [${c.categorie}] niveau ${r.niveau} (cible ${c.attendu.join('-')})`);
  console.log('   scénarios   :', r.scenarios.map((s) => `${s.id}:${s.statut}`).join(', ') || '-');
  console.log('   incohérences:', r.incoherences.map((i) => `${i.id}[${i.force}]`).join(', ') || '-');
  console.log('   manipulation:', r.signaux.filter((s) => s.categorie === 'manipulation').map((s) => s.id).join(', ') || '-');
  console.log('   contexte    :', r.signaux.filter((s) => s.categorie !== 'manipulation').map((s) => s.id).join(', ') || '-');
  if (r.contexte.marqueRevendiquee.length) console.log('   marques     :', r.contexte.marqueRevendiquee.join(', '), '| authentifiée :', r.contexte.marqueAuthentifiee.join(', ') || '-', r.contexte.cliquet ? '(cliquet)' : '');
  if (r.contexte.prevention) console.log('   prévention');
}
