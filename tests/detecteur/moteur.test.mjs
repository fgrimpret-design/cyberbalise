// Tests du moteur : non-régression (annexe B), faux positifs, détection, négation, liens, réseau, performance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { PAGE_OUTIL, chargerCorpus, LEGITIMES, HAMECONNAGES } from './lib.mjs';

const require = createRequire(import.meta.url);
const R = require(path.join(PAGE_OUTIL, 'regles.js'));
const M = require(path.join(PAGE_OUTIL, 'moteur.js'));
const corpus = chargerCorpus();
const lancer = (c) => M.analyser({ texte: c.texte, type: c.type, expediteur: c.expediteur, objet: c.objet, piedDePage: c.pied, qr: c.qr });
const niveau = (c) => lancer(c).niveau;

test('annexe B : les 20 cas de non-régression atteignent le niveau cible', () => {
  const echecs = [];
  for (const c of corpus.filter((x) => x.annexe)) {
    const n = niveau(c);
    if (n < c.attendu[0] || n > c.attendu[1]) echecs.push(`annexe ${c.annexe} (${c.id}) : niveau ${n}, cible ${c.attendu.join('-')}`);
  }
  assert.deepEqual(echecs, []);
});

test('faux positifs : aucun message légitime n\'atteint le niveau 2', () => {
  const trop = corpus.filter((c) => LEGITIMES.includes(c.categorie) && niveau(c) >= 2).map((c) => `${c.id} -> ${niveau(c)}`);
  assert.deepEqual(trop, []);
});

test('chaque cas du corpus respecte sa fourchette attendue', () => {
  const echecs = corpus.filter((c) => { const n = niveau(c); return n < c.attendu[0] || n > c.attendu[1]; }).map((c) => `${c.id} -> ${niveau(c)} (cible ${c.attendu.join('-')})`);
  assert.deepEqual(echecs, []);
});

test('détection : au moins 90 % des hameçonnages au niveau 2 ou plus, 70 % au niveau 3', () => {
  const ph = corpus.filter((c) => HAMECONNAGES.includes(c.categorie));
  const n2 = ph.filter((c) => niveau(c) >= 2).length / ph.length;
  const n3 = ph.filter((c) => niveau(c) >= 3).length / ph.length;
  assert.ok(n2 >= 0.9, `détection niveau 2+ : ${(100 * n2).toFixed(1)} %`);
  assert.ok(n3 >= 0.7, `détection niveau 3 : ${(100 * n3).toFixed(1)} %`);
});

test('négation : les messages de prévention restent au niveau 0 ou 1', () => {
  const prev = corpus.filter((c) => c.categorie === 'prevention');
  assert.ok(prev.length >= 6);
  for (const c of prev) assert.ok(niveau(c) <= 1, `${c.id} -> ${niveau(c)}`);
});

test('un message de prévention n\'est pas signalé, mais un vrai piège caché dedans l\'est', () => {
  const piege = M.analyser({ texte: 'Attention aux arnaques : ne cliquez pas sur les liens suspects. Mais ici, exceptionnellement, validez votre compte : https://amazon.fr@evil.top/login', type: 'sms' });
  assert.equal(piege.niveau, 3);
});

test('« Attention » ou « Ne tardez pas » ne neutralisent pas une vraie arnaque', () => {
  const a = M.analyser({ texte: 'ATTENTION : votre compte bancaire sera suspendu. Ne tardez pas, confirmez vos coordonnées bancaires sur https://secure-banque-verif.top', type: 'sms' });
  assert.equal(a.niveau, 3);
});

test('un lien seul ne suffit pas à rendre un message suspect', () => {
  const r = M.analyser({ texte: 'Voici le programme de la réunion : https://www.atelier-boutique.fr/reunion', type: 'sms' });
  assert.ok(r.niveau <= 1);
});

test('un montant, un colis ou un mot de banque ne font pas un verdict', () => {
  const r = M.analyser({ texte: 'Votre colis de 12,90 € est livré. Merci d\'avoir commandé, la banque a validé votre carte bancaire.', type: 'sms' });
  assert.equal(r.niveau, 0);
  assert.ok(r.signaux.every((s) => s.categorie === 'contexte'));
});

test('déduplication : un même thème détecté plusieurs fois donne un seul signal et plusieurs extraits', () => {
  const r = M.analyser({ texte: 'Urgent ! Réponse immédiate demandée. Dernier rappel avant ce soir, sous 24 h.', type: 'sms' });
  assert.equal(r.signaux.filter((s) => s.id === 'urgence').length, 1);
  assert.ok(r.signaux.find((s) => s.id === 'urgence').extraits.length >= 2);
});

test('le nombre de signaux n\'est pas un niveau : quatre thèmes de contexte restent au niveau 0', () => {
  const r = M.analyser({ texte: 'Votre colis arrive. Facture de 78,50 €. Code de confirmation 4821. Votre banque vous remercie.', type: 'sms' });
  assert.ok(r.signaux.filter((s) => s.categorie === 'contexte').length >= 3);
  assert.equal(r.niveau, 0);
});

test('cliquet : un vrai message de marque authentifiée plafonne à 1', () => {
  const r = M.analyser({ texte: 'Amazon : votre commande de 129,90 € est expédiée. Suivi : https://www.amazon.fr/gp/css/order', type: 'sms' });
  assert.ok(r.niveau <= 1);
  assert.deepEqual(r.contexte.marqueAuthentifiee, ['Amazon']);
});

test('sortie : forme conforme au modèle d\'objet', () => {
  const r = M.analyser({ texte: 'Colissimo : réglez 1,99 € ici https://colissimo-suivi.top', type: 'sms' });
  for (const k of ['niveau', 'scenarios', 'incoherences', 'signaux', 'lienAnalyse', 'contexte', 'limites', 'versionRegles']) assert.ok(k in r, 'clé manquante : ' + k);
  assert.equal(r.versionRegles, R.VERSION);
  for (const l of r.lienAnalyse) for (const code of l.raisons) assert.ok(code in R.LIEN_RAISONS, 'code de raison inconnu : ' + code);
  assert.ok(r.limites.length >= 3);
  for (const s of r.scenarios) assert.ok(['confirme', 'partiel'].includes(s.statut));
});

/* ===== Liens v2 ===== */
const raisons = (u) => M.analyserLien(u).raisons;

test('liens : domaines officiels avec tiret ou sous-domaine ne sont pas signalés à tort', () => {
  for (const u of ['https://www.credit-agricole.fr/particuliers', 'https://www.caisse-epargne.fr/', 'https://www.banque-populaire.fr/', 'https://suivi.colis.laposte.fr/x', 'https://www.amazon.fr/gp/your-account/order', 'https://account.netflix.com/Billing', 'https://monespace.edf.fr/client']) {
    assert.deepEqual(raisons(u), [], u);
  }
});

test('liens : identifiants dans l\'URL (userinfo)', () => assert.ok(raisons('https://amazon.fr@evil.top/login').includes('USERINFO')));
test('liens : adresse IP', () => assert.ok(raisons('http://192.168.12.4/login').includes('IP_BRUTE')));
test('liens : punycode', () => assert.ok(raisons('https://xn--amazn-mua.fr/x').includes('PUNYCODE')));
test('liens : port inhabituel', () => assert.ok(raisons('https://exemple.fr:8443/x').includes('PORT_INHABITUEL')));
test('liens : port usuel accepté', () => assert.ok(!raisons('https://exemple.fr:443/x').includes('PORT_INHABITUEL')));
test('liens : sous-domaine trompeur (marque.tld.autre.tld)', () => {
  assert.ok(raisons('https://amazon.fr.secure-login.top/verify').includes('SOUS_DOMAINE_TROMPEUR'));
  assert.ok(raisons('https://amazon.secure-login.top/verify').includes('SOUS_DOMAINE_TROMPEUR'));
});
test('liens : marque tierce, y compris avec chiffres à la place de lettres', () => {
  assert.ok(raisons('https://paypa1-secure.com/login').includes('MARQUE_TIERS'));
  assert.ok(raisons('https://colissimo-suivi-livraison.top/fr').includes('MARQUE_TIERS'));
  assert.ok(raisons('https://edf-facture.top').includes('MARQUE_TIERS'));
});
test('liens : raccourcisseur et extension à risque', () => {
  assert.ok(raisons('https://bit.ly/3abc').includes('LIEN_RACCOURCI'));
  assert.ok(raisons('https://exemple-promo.xyz').includes('TLD_RISQUE'));
});
test('liens : casse et ponctuation finale', () => {
  const r = M.extraireLiens('Voir HTTPS://WWW.AMAZON.FR/offre. Merci', 'Voir HTTPS://WWW.AMAZON.FR/offre. Merci');
  assert.equal(r.length, 1);
  assert.ok(!/[.]$/.test(r[0].brut));
  assert.deepEqual(raisons(r[0].brut), []);
});
test('liens : une adresse e-mail n\'est pas un lien', () => {
  assert.equal(M.extraireLiens('écrivez à jean@exemple.com', 'écrivez à jean@exemple.com').length, 0);
});
test('liens : adresse sans http reconnue', () => {
  const r = M.analyser({ texte: 'Régularisez sur peage-regul.top sous 48 h', type: 'sms' });
  assert.equal(r.lienAnalyse.length, 1);
});

/* ===== Expéditeur et en-têtes ===== */
test('expéditeur : webmail pour un message « officiel »', () => {
  const r = M.analyser({ texte: 'Impôts : votre remboursement est disponible, confirmez sur votre espace.', type: 'email', expediteur: 'impots.service@gmail.com' });
  assert.ok(r.incoherences.some((i) => i.id === 'WEBMAIL_OFFICIEL'));
  assert.ok(r.niveau >= 2);
});
test('expéditeur : nom affiché évoquant une marque avec un autre domaine', () => {
  const r = M.analyser({ texte: 'Bonjour, votre document est prêt.', type: 'email', expediteur: 'Amazon Service <service@doc-livraison.fr>' });
  assert.ok(r.incoherences.some((i) => i.id === 'EXPEDITEUR_USURPE'));
});
test('en-têtes bruts : échec SPF/DKIM détecté', () => {
  const brut = 'From: Service <info@ma-banque.fr>\nAuthentication-Results: mx.exemple.net; spf=fail; dkim=none; dmarc=fail\nSubject: Votre dossier\n\nBonjour, voici votre dossier.';
  const r = M.analyser({ texte: brut, type: 'email' });
  assert.ok(r.incoherences.some((i) => i.id === 'AUTHENTIFICATION_ECHEC'));
  assert.equal(r.contexte.expediteur, 'Service <info@ma-banque.fr>');
});
test('en-têtes bruts : Reply-To divergent', () => {
  const brut = 'From: Support <support@exemple.fr>\nReply-To: <gains@autre-domaine.top>\nSubject: Votre dossier\n\nBonjour.';
  const r = M.analyser({ texte: brut, type: 'email' });
  assert.ok(r.incoherences.some((i) => i.id === 'REPONSE_DIVERGENTE'));
});
test('en-têtes bruts : authentification réussie et domaine officiel -> aucune incohérence', () => {
  const brut = 'From: EDF <ne-pas-repondre@edf.fr>\nAuthentication-Results: mx.exemple.net; spf=pass; dkim=pass; dmarc=pass\nSubject: Votre facture\n\nVotre facture est disponible sur votre espace client edf.fr.';
  const r = M.analyser({ texte: brut, type: 'email' });
  assert.deepEqual(r.incoherences, []);
  assert.ok(r.niveau <= 1);
});

/* ===== Sécurité, réseau, robustesse, performance ===== */
test('XSS : le moteur ne renvoie que du texte brut, jamais du HTML interprété', () => {
  const charge = '<img src=x onerror=alert(1)> Urgent : votre compte sera suspendu, confirmez sur https://secure-verif.top';
  const r = M.analyser({ texte: charge, type: 'sms' });
  const extraits = r.signaux.flatMap((s) => s.extraits).concat(r.lienAnalyse.map((l) => l.url));
  assert.ok(extraits.length > 0);
  for (const e of extraits) assert.equal(typeof e, 'string');
  assert.ok(r.niveau >= 2);
});

test('réseau : aucune requête sortante pendant l\'analyse', () => {
  const appels = [];
  const sauvegarde = { fetch: globalThis.fetch, xhr: globalThis.XMLHttpRequest };
  globalThis.fetch = (...a) => { appels.push(['fetch', a[0]]); throw new Error('requête réseau interdite'); };
  globalThis.XMLHttpRequest = function () { appels.push(['xhr']); throw new Error('requête réseau interdite'); };
  try { for (const c of corpus) lancer(c); }
  finally { globalThis.fetch = sauvegarde.fetch; if (sauvegarde.xhr) globalThis.XMLHttpRequest = sauvegarde.xhr; else delete globalThis.XMLHttpRequest; }
  assert.deepEqual(appels, []);
});

const chrono = (f) => { const t = process.hrtime.bigint(); f(); return Number(process.hrtime.bigint() - t) / 1e6; };
const gros = (n) => ('Bonjour, votre colis sera livré demain. Régularisez sous 48 h sur https://exemple-suivi.top/x ou appelez le 09 88 12 34 56. ').repeat(Math.ceil(n / 110)).slice(0, n);

test('performance : 5 000 caractères en moins de 50 ms', () => {
  const t = gros(5000);
  M.analyser({ texte: t, type: 'sms' });
  const ms = Math.min(...[1, 2, 3].map(() => chrono(() => M.analyser({ texte: t, type: 'sms' }))));
  assert.ok(ms < 50, `${ms.toFixed(1)} ms`);
});
test('performance : 50 000 caractères en moins de 150 ms', () => {
  const t = gros(50000);
  M.analyser({ texte: t, type: 'sms' });
  const ms = Math.min(...[1, 2, 3].map(() => chrono(() => M.analyser({ texte: t, type: 'sms' }))));
  assert.ok(ms < 150, `${ms.toFixed(1)} ms`);
});
test('robustesse : 20 Ko de « a. » et 20 Ko de tirets en moins de 200 ms', () => {
  for (const t of ['a.'.repeat(10000), '-'.repeat(20000), 'a-'.repeat(10000), 'www.'.repeat(5000), '!'.repeat(20000), ('http://' + 'a'.repeat(100) + '.').repeat(200)]) {
    const ms = chrono(() => M.analyser({ texte: t, type: 'email', objet: t.slice(0, 300) }));
    assert.ok(ms < 200, `${ms.toFixed(1)} ms sur ${t.slice(0, 12)}…`);
  }
});
test('robustesse : entrées vides ou étranges', () => {
  for (const e of [undefined, {}, { texte: '' }, { texte: null, type: 'email' }, { texte: '\u0000\uffff', type: 'sms' }, { texte: 'x'.repeat(300000) }]) {
    const r = M.analyser(e);
    assert.ok(r.niveau >= 0 && r.niveau <= 3);
  }
});
