// Minifie les trois scripts du détecteur d'arnaque (regles.js, moteur.js, ui.js).
// Utilisé au déploiement (les sources du dépôt restent lisibles) et par les tests, qui vérifient
// que la version minifiée se comporte exactement comme l'originale.
//   node scripts/minify-detecteur.mjs --en-place          (déploiement)
//   node scripts/minify-detecteur.mjs <dossier de sortie>  (essai)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { minify } from 'terser';

export const FICHIERS = ['regles.js', 'moteur.js', 'ui.js'];
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DOSSIER = path.join(RACINE, 'outils', 'detecteur-arnaque');

/* Les motifs de détection et les textes sont conservés tels quels : seules les variables locales sont renommées. */
export const OPTIONS = {
  compress: { passes: 2, drop_console: false },
  mangle: true,
  format: { comments: false, ascii_only: false },
  sourceMap: false,
};

/* Retire les blocs « tests: { positifs: [...], negatifs: [...] } » des règles : utiles à la suite de tests,
   inutiles aux visiteurs. Le balayage connaît les chaînes entre apostrophes ou guillemets. */
export function retirerTests(source) {
  const re = /\btests\s*:\s*\{/g;
  let sortie = '', dernier = 0, m, n = 0;
  while ((m = re.exec(source)) !== null) {
    let i = m.index + m[0].length, profondeur = 1, quote = null;
    for (; i < source.length && profondeur > 0; i++) {
      const c = source[i];
      if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; }
      else if (c === "'" || c === '"') quote = c;
      else if (c === '{') profondeur++;
      else if (c === '}') profondeur--;
    }
    if (profondeur !== 0) throw new Error('bloc tests non refermé');
    const reste = /^\s*,?/.exec(source.slice(i))[0].length;
    sortie += source.slice(dernier, m.index);
    dernier = i + reste;
    re.lastIndex = dernier;
    n++;
  }
  return { code: sortie + source.slice(dernier), retires: n };
}

export async function minifier(sortie) {
  const rapport = [];
  for (const f of FICHIERS) {
    let source = fs.readFileSync(path.join(DOSSIER, f), 'utf8');
    const original = source;
    if (f === 'regles.js') {
      const r0 = retirerTests(source);
      if (/\b(positifs|negatifs)\s*:/.test(r0.code)) throw new Error('des tests subsistent dans regles.js');
      source = r0.code;
    }
    const r = await minify(source, OPTIONS);
    if (!r.code) throw new Error('minification vide pour ' + f);
    fs.mkdirSync(sortie, { recursive: true });
    fs.writeFileSync(path.join(sortie, f), r.code, 'utf8');
    rapport.push({ fichier: f, avant: Buffer.byteLength(original), apres: Buffer.byteLength(r.code) });
  }
  return rapport;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2];
  if (!arg) { console.error('Usage : node scripts/minify-detecteur.mjs --en-place | <dossier de sortie>'); process.exit(2); }
  const sortie = arg === '--en-place' ? DOSSIER : path.resolve(arg);
  const rapport = await minifier(sortie);
  for (const r of rapport) console.log(`${r.fichier} : ${r.avant} -> ${r.apres} octets`);
}
