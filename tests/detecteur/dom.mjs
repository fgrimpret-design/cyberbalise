// Harnais navigateur (jsdom) : exécute la vraie page de l'outil avec ses scripts et pilote le parcours complet.
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM, ResourceLoader } from 'jsdom';
import { RACINE, PAGE_OUTIL } from './lib.mjs';

const URL_PAGE = 'https://cyberbalise.fr/outils/detecteur-arnaque/';

/* Sert les scripts du site depuis le dépôt (aucun accès réseau) ; refuse tout le reste. */
class ChargeurLocal extends ResourceLoader {
  fetch(url) {
    const u = new URL(url);
    if (u.origin !== 'https://cyberbalise.fr') return Promise.resolve(Buffer.from(''));
    const fichier = path.join(RACINE, decodeURIComponent(u.pathname));
    if (!fichier.startsWith(RACINE) || !fs.existsSync(fichier) || fs.statSync(fichier).isDirectory()) return Promise.resolve(Buffer.from(''));
    return Promise.resolve(fs.readFileSync(fichier));
  }
}

export async function ouvrirPage({ page = path.join(PAGE_OUTIL, 'index.html'), bloquerReseau = true } = {}) {
  const html = fs.readFileSync(page, 'utf8');
  const appelsReseau = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: new ChargeurLocal(),
    pretendToBeVisual: true,
    url: URL_PAGE,
    beforeParse(w) {
      w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
      w.HTMLElement.prototype.scrollIntoView = function () {};
      if (!w.Blob.prototype.text) {
        // jsdom n'implémente pas Blob.text() que tous les navigateurs actuels fournissent.
        w.Blob.prototype.text = function () { return new Promise((ok, ko) => { const r = new w.FileReader(); r.onload = () => ok(String(r.result)); r.onerror = ko; r.readAsText(this); }); };
      }
      if (bloquerReseau) {
        w.fetch = (...a) => { appelsReseau.push(['fetch', String(a[0])]); throw new Error('requête réseau interdite pendant une analyse'); };
        w.XMLHttpRequest = function () { appelsReseau.push(['xhr']); throw new Error('requête réseau interdite'); };
      }
    },
  });
  await new Promise((ok) => (dom.window.document.readyState === 'complete' ? ok() : dom.window.addEventListener('load', ok)));
  const w = dom.window;
  const d = w.document;
  const clic = (el) => el.dispatchEvent(new w.Event('click', { bubbles: true }));
  const saisir = (id, valeur) => {
    const el = d.getElementById(id);
    el.value = valeur;
    el.dispatchEvent(new w.Event('input', { bubbles: true }));
  };

  return {
    dom, w, d, appelsReseau, clic, saisir,
    choisirType(type) { clic(d.querySelector(`.sd-mode[data-type="${type}"]`)); },
    analyser({ texte, type = 'sms', expediteur = '', objet = '', pied = '' }) {
      this.choisirType(type);
      saisir('sd-in', texte);
      if (expediteur) saisir('sd-from', expediteur);
      if (objet) saisir('sd-subj', objet);
      if (pied) saisir('sd-foot', pied);
      clic(d.getElementById('sd-go'));
      return this.lireResultat();
    },
    lireResultat() {
      const v = d.querySelector('.sd-verdict');
      return {
        niveau: v ? Number((v.className.match(/\bv(\d)\b/) || [])[1]) : NaN,
        badge: d.querySelector('.sd-badge')?.textContent.replace(/\s+/g, ' ').trim() || '',
        texte: d.getElementById('sd-res').textContent.replace(/\s+/g, ' ').trim(),
        focus: d.activeElement?.id || '',
        live: d.getElementById('sd-live').textContent,
      };
    },
    fermer() { w.close(); },
  };
}
