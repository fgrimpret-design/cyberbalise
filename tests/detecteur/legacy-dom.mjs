// Exécute l'ancienne version de l'outil (copie figée dans legacy/) dans jsdom, pour mesurer la baseline.
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { ICI } from './lib.mjs';

const HTML = fs.readFileSync(path.join(ICI, 'legacy', 'index.v1.html'), 'utf8');

export function analyserLegacy(cas) {
  const dom = new JSDOM(HTML, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://cyberbalise.fr/outils/detecteur-arnaque/',
    beforeParse(w) {
      w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
      w.HTMLElement.prototype.scrollIntoView = function () {};
      w.fetch = () => { throw new Error('requête réseau interdite pendant une analyse'); };
    },
  });
  const w = dom.window;
  const d = w.document;
  const clic = (el) => el.dispatchEvent(new w.Event('click', { bubbles: true }));
  clic(d.querySelector(`.sd-mode[data-type="${cas.type === 'email' ? 'email' : 'sms'}"]`));
  const ta = d.getElementById('sd-in');
  ta.value = cas.texte || (cas.qr || []).join(' ');
  ta.dispatchEvent(new w.Event('input', { bubbles: true }));
  d.getElementById('sd-from').value = cas.expediteur || '';
  d.getElementById('sd-subj').value = cas.objet || '';
  d.getElementById('sd-foot').value = cas.pied || '';
  clic(d.getElementById('sd-go'));
  const v = d.querySelector('.sd-verdict');
  const niveau = v ? Number((v.className.match(/\bv(\d)\b/) || [])[1]) : NaN;
  const titre = d.getElementById('sd-vt')?.textContent || '';
  w.close();
  return { niveau, titre };
}
