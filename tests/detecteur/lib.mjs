// Utilitaires partagés par les tests du détecteur d'arnaque.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ICI = path.dirname(fileURLToPath(import.meta.url));
export const RACINE = path.resolve(ICI, '..', '..');
export const PAGE_OUTIL = path.join(RACINE, 'outils', 'detecteur-arnaque');

export function chargerCorpus() {
  const brut = JSON.parse(fs.readFileSync(path.join(ICI, 'fixtures.json'), 'utf8'));
  return brut.cas;
}

export const LEGITIMES = ['legitime_perso', 'legitime_transactionnel', 'prevention'];
export const HAMECONNAGES = ['phishing_fr', 'phishing_en'];

/** Statistiques communes à la baseline et au benchmark. */
export function statistiques(cas, niveaux) {
  const lire = (c) => niveaux[c.id];
  const legit = cas.filter((c) => LEGITIMES.includes(c.categorie));
  const phish = cas.filter((c) => HAMECONNAGES.includes(c.categorie));
  const conformes = cas.filter((c) => lire(c) >= c.attendu[0] || (lire(c) === 1 && c.attendu[0] === 0)).filter((c) => lire(c) <= c.attendu[1]);
  const pct = (n, d) => (d ? Math.round((1000 * n) / d) / 10 : 0);
  const fp2 = legit.filter((c) => lire(c) >= 2);
  const fp3 = legit.filter((c) => lire(c) >= 3);
  const det2 = phish.filter((c) => lire(c) >= 2);
  const det3 = phish.filter((c) => lire(c) >= 3);
  const fn = phish.filter((c) => lire(c) <= 1);
  return {
    total: cas.length,
    legitimes: legit.length,
    hameconnages: phish.length,
    conformes: conformes.length,
    fauxPositifs2: fp2,
    fauxPositifs3: fp3,
    faussesAlertesPct: pct(fp2.length, legit.length),
    detection2: det2.length,
    detection2Pct: pct(det2.length, phish.length),
    detection3: det3.length,
    detection3Pct: pct(det3.length, phish.length),
    fauxNegatifs: fn,
    fauxNegatifsPct: pct(fn.length, phish.length),
    annexeB: cas.filter((c) => c.annexe).map((c) => ({ id: c.id, annexe: c.annexe, niveau: lire(c), attendu: c.attendu, ok: conformes.includes(c) })),
  };
}

export function composition(cas) {
  const n = {};
  for (const c of cas) n[c.categorie] = (n[c.categorie] || 0) + 1;
  return n;
}

const NOMS = { 0: 'Aucun signal', 1: 'Signaux faibles', 2: 'Suspect', 3: 'Arnaque probable' };
export const nomNiveau = (n) => NOMS[n] ?? String(n);

export function tronquer(s, n = 70) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

export function attenduTexte(a) {
  return a[0] === a[1] ? String(a[0]) : `${a[0]}–${a[1]}`;
}
