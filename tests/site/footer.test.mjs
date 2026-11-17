import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const pages = execFileSync('git', ['ls-files', '--', '*.html'], {
  cwd: root,
  encoding: 'utf8',
}).trim().split('\n').filter((file) => !file.startsWith('backoffice/') && !file.startsWith('tests/'));
pages.push('backoffice/templates/page-modele.html');

const normalize = (value) => value.replace(/\s+/g, ' ').trim();
const home = readFileSync(resolve(root, 'index.html'), 'utf8');
const canonical = normalize(home.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/i)[0]);
const footerStylesheet = '<link rel="stylesheet" href="/assets/site-footer.css?v=20261117">';

test('les pages publiques et le modèle utilisent le même pied de page', () => {
  assert.ok(pages.length > 100);
  for (const file of pages) {
    const html = readFileSync(resolve(root, file), 'utf8');
    const footers = html.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi) ?? [];
    assert.equal(footers.length, 1, `${file} : nombre de pieds de page`);
    assert.equal(normalize(footers[0]), canonical, `${file} : contenu du pied de page`);
    assert.ok(html.includes(footerStylesheet), `${file} : feuille de style commune absente`);
  }
});

test('la source Trustpilot AdGuard reste dans la section des sources', () => {
  const page = readFileSync(resolve(root, 'offres/vpn/adguard-vpn/index.html'), 'utf8');
  const sources = page.indexOf('<h2 id="sources-et-methodologie">');
  const source = page.indexOf('<li data-tp="adguard">');
  const end = page.indexOf('<!-- CB-CONTENU:FIN -->', sources);
  assert.ok(sources >= 0 && source > sources && source < end);
});
