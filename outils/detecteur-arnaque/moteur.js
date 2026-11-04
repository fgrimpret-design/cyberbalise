/*
 * CyberBalise : moteur d'analyse du détecteur d'arnaque.
 *
 * Aucun accès au DOM, aucun accès au réseau : le moteur reçoit un message et retourne un objet.
 * Chargé par le navigateur (window.CyberBaliseEngine) et par Node (require), après regles.js.
 *
 *   analyser({ texte, type: 'sms'|'email', expediteur, objet, piedDePage, qr: [url, ...], annee })
 *     -> { niveau, scenarios, incoherences, signaux, lienAnalyse, contexte, limites, versionRegles, ... }
 */
(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) module.exports = fabrique(require('./regles.js'));
  else racine.CyberBaliseEngine = fabrique(racine.CyberBaliseRules);
})(typeof self !== 'undefined' ? self : this, function (R) {
  'use strict';

  var CFG = R.CONFIG;

  /* ------------------------------------------------------------------
   * Aplatissement : accents -> lettres de base, apostrophes typographiques -> ', espaces insécables -> espace.
   * La longueur est conservée à l'identique, ce qui permet de reporter les positions sur le texte d'origine.
   * ------------------------------------------------------------------ */
  var CARTE = {};
  (function () {
    var paires = [
      ['àâäáãå', 'a'], ['ÀÂÄÁÃÅ', 'A'], ['ç', 'c'], ['Ç', 'C'], ['éèêë', 'e'], ['ÉÈÊË', 'E'], ['íìîï', 'i'], ['ÍÌÎÏ', 'I'],
      ['ñ', 'n'], ['Ñ', 'N'], ['óòôöõ', 'o'], ['ÓÒÔÖÕ', 'O'], ['úùûü', 'u'], ['ÚÙÛÜ', 'U'], ['ýÿ', 'y'], ['Ý', 'Y'],
      ['œ', 'o'], ['Œ', 'O'], ['æ', 'a'], ['Æ', 'A'], ['\u2019\u2018\u02bc`\u00b4', "'"], ['\u201c\u201d\u00ab\u00bb', '"'],
      ['\u00a0\u202f\u2009', ' '], ['\u2013\u2014\u2011', '-']
    ];
    paires.forEach(function (p) { p[0].split('').forEach(function (c) { CARTE[c] = p[1]; }); });
  })();
  var RE_APLATIR = new RegExp('[' + Object.keys(CARTE).join('') + ']', 'g');
  function aplatir(s) { return String(s == null ? '' : s).replace(RE_APLATIR, function (c) { return CARTE[c]; }); }

  /* Variante pour les noms de domaine : chiffres « leetspeak » et lettres collées (paypa1, rnicrosoft). */
  function aplatirDomaine(s) {
    return aplatir(s).toLowerCase().replace(/0/g, 'o').replace(/1/g, 'l').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/rn/g, 'm').replace(/vv/g, 'w');
  }

  function extrait(brut, debut, fin) {
    var s = String(brut).slice(debut, fin).replace(/\s+/g, ' ').trim();
    return s.length > CFG.longueurMaxExtrait ? s.slice(0, CFG.longueurMaxExtrait - 1) + '…' : s;
  }
  function remplacer(modele, valeurs) {
    return String(modele).replace(/\{(\w+)\}/g, function (m, k) { return valeurs && valeurs[k] != null ? valeurs[k] : m; });
  }
  function fiche(cle) { return R.FICHES[cle] || null; }

  /* ------------------------------------------------------------------
   * Mises en garde (négation) et messages de prévention
   * ------------------------------------------------------------------ */
  function annule(plat, debut, fin) {
    var avant = plat.slice(Math.max(0, debut - CFG.fenetreNegation), debut);
    var coupe = Math.max(avant.lastIndexOf('.'), avant.lastIndexOf('!'), avant.lastIndexOf('?'), avant.lastIndexOf('\n'));
    var fenetre = avant.slice(coupe + 1) + plat.slice(debut, fin);
    for (var i = 0; i < R.ANNULATEURS.length; i++) if (R.ANNULATEURS[i].test(fenetre)) return true;
    return false;
  }

  function marqueursPrevention(plat) {
    var trouves = [];
    R.MARQUEURS_PREVENTION.forEach(function (re) {
      var m = re.exec(plat);
      if (m) trouves.push({ debut: m.index, fin: m.index + m[0].length });
    });
    return trouves;
  }

  /* ------------------------------------------------------------------
   * Règles compilées une fois (drapeau g ajouté, autres drapeaux conservés)
   * ------------------------------------------------------------------ */
  var COMPILEES = R.REGLES.map(function (regle) {
    return {
      regle: regle,
      motifs: regle.motifs.map(function (m) { return new RegExp(m.source, m.flags.replace(/g/g, '') + 'g'); })
    };
  });

  function chevauche(hits, champ, d, f) {
    for (var i = 0; i < hits.length; i++) if (hits[i].champ === champ && d < hits[i].fin && f > hits[i].debut) return true;
    return false;
  }

  function scannerRegle(c, champs) {
    var hits = [];
    var regle = c.regle;
    for (var pi = 0; pi < regle.portee.length; pi++) {
      var champ = regle.portee[pi];
      var cible = champs[champ];
      if (!cible || !cible.plat) continue;
      for (var mi = 0; mi < c.motifs.length; mi++) {
        var re = c.motifs[mi];
        re.lastIndex = 0;
        var m, n = 0;
        while ((m = re.exec(cible.plat)) !== null && n < CFG.maxCorrespondancesParRegle) {
          n++;
          if (m[0].length === 0) { re.lastIndex++; continue; }
          var d = m.index, f = d + m[0].length;
          if (annule(cible.plat, d, f)) continue;
          if (chevauche(hits, champ, d, f)) continue;
          hits.push({ champ: champ, debut: d, fin: f, extrait: extrait(cible.brut, d, f) });
        }
      }
    }
    return hits;
  }

  /* Test d'une règle isolée (utilisé par la suite de tests) : la règle se déclenche-t-elle sur ce texte ? */
  function testerRegle(regle, texte) {
    var c = COMPILEES.filter(function (x) { return x.regle === regle || x.regle.id === regle.id; })[0];
    if (!c) throw new Error('règle inconnue : ' + regle.id);
    var champs = {};
    regle.portee.forEach(function (p) { champs[p] = { brut: texte, plat: aplatir(texte) }; });
    return scannerRegle(c, champs).length > 0;
  }

  /* ------------------------------------------------------------------
   * Domaines
   * ------------------------------------------------------------------ */
  function domaineEnregistrable(hote) {
    var p = hote.split('.');
    if (p.length <= 2) return hote;
    var dernier2 = p.slice(-2).join('.');
    return R.SUFFIXES_DOUBLES.indexOf(dernier2) >= 0 ? p.slice(-3).join('.') : dernier2;
  }
  function suffixe(hote) {
    var reg = domaineEnregistrable(hote);
    var i = reg.indexOf('.');
    return i < 0 ? '' : reg.slice(i + 1);
  }
  function etiquetteRacine(hote) { return domaineEnregistrable(hote).split('.')[0]; }
  function estOfficiel(hote, marque) {
    if (marque.dom.some(function (d) { return hote === d || hote.slice(-(d.length + 1)) === '.' + d; })) return true;
    return !!(marque.domRe && marque.domRe.test(hote));
  }
  function estNeutre(hote) {
    return R.DOMAINES_NEUTRES.some(function (d) { return hote === d || hote.slice(-(d.length + 1)) === '.' + d; });
  }
  /* Le nom de la marque figure-t-il dans cette chaîne de domaine (mots longs ou éléments entiers) ? */
  function marqueDansDomaine(marque, chaine) {
    var plat = aplatirDomaine(chaine);
    var compact = plat.replace(/[.\-_]/g, '');
    var i;
    for (i = 0; i < marque.mots.length; i++) {
      if (marque.mots[i].length >= CFG.longueurMinMotMarque && compact.indexOf(marque.mots[i]) >= 0) return true;
    }
    if (marque.tokens.length) {
      var morceaux = plat.split(/[.\-_]/);
      for (i = 0; i < marque.tokens.length; i++) if (morceaux.indexOf(marque.tokens[i]) >= 0) return true;
    }
    return false;
  }

  /* ------------------------------------------------------------------
   * Liens : extraction et analyse (v2)
   * ------------------------------------------------------------------ */
  var TLD_ALT = R.TLD_CONNUS.slice().sort(function (a, b) { return b.length - a.length; }).join('|');
  var RE_LIEN = new RegExp(
    '(?:https?:\\/\\/|www\\.)[^\\s<>"\']{1,2000}' +
    '|(?:^|[^@\\w.-])(?:[a-z0-9][a-z0-9-]{0,62}(?:\\.[a-z0-9][a-z0-9-]{0,62}){0,5}\\.(?:' + TLD_ALT + ')(?![a-z0-9-])(?::\\d{1,5})?(?:\\/[^\\s<>"\']{0,500})?)',
    'gi'
  );

  function extraireLiens(plat, brut) {
    var sortie = [];
    var texte = plat.replace(/\[\.\]|\(\.\)/g, '..').replace(/hxxp/gi, 'http');
    RE_LIEN.lastIndex = 0;
    var m;
    while ((m = RE_LIEN.exec(texte)) !== null && sortie.length < CFG.maxLiens * 2) {
      var s = m[0];
      var decal = 0;
      if (!/^(https?:|www\.)/i.test(s)) { var t = s.match(/^[^a-z0-9]+/i); if (t) { decal = t[0].length; s = s.slice(decal); } }
      var nettoye = s.replace(/[.,;:!?)\]}»"'>]+$/, '');
      if (nettoye.length < 4) continue;
      var debut = m.index + decal;
      sortie.push({ brut: extrait(brut, debut, debut + nettoye.length), debut: debut, fin: debut + nettoye.length });
    }
    return sortie;
  }

  function niveauDesRaisons(raisons) {
    var max = 0, faibles = 0;
    raisons.forEach(function (c) { var n = R.LIEN_RAISONS[c].niveau; if (n > max) max = n; if (n === 1) faibles++; });
    if (max === 1 && faibles >= 2) return 2;
    return max;
  }

  function analyserLien(brut, origine, ages) {
    var u = String(brut).trim().replace(/^hxxp/i, 'http');
    var m = /^(?:([a-z][a-z0-9+.-]*):\/\/)?(?:([^\/?#@\s]*)@)?(\[[^\]]+\]|[^\/?#:\s]+)(?::(\d{1,5}))?([\/?#][^\s]*)?$/i.exec(u);
    var resultat = { url: String(brut), hote: '', domaine: '', raisons: [], niveau: 0, officielPour: [], marquesTierces: [], origine: origine || 'texte' };
    if (!m) return resultat;
    var hote = m[3].toLowerCase().replace(/\.+$/, '').replace(/^www\./, '');
    if (!hote) return resultat;
    resultat.hote = hote;
    resultat.domaine = domaineEnregistrable(hote);
    var raisons = [];
    var ajouter = function (c) { if (raisons.indexOf(c) < 0) raisons.push(c); };

    if (m[2]) ajouter('USERINFO');
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hote) || hote.charAt(0) === '[') ajouter('IP_BRUTE');
    if (/(^|\.)xn--/.test(hote) || /[^\x00-\x7f]/.test(hote)) ajouter('PUNYCODE');
    if (m[4] && CFG.portsUsuels.indexOf(+m[4]) < 0) ajouter('PORT_INHABITUEL');
    if (R.RACCOURCISSEURS.some(function (s) { return hote === s || hote.slice(-(s.length + 1)) === '.' + s; })) ajouter('LIEN_RACCOURCI');

    var neutre = estNeutre(hote);
    var tld = hote.split('.').pop();
    var enregistrable = domaineEnregistrable(hote);
    var gauche = hote.length > enregistrable.length ? hote.slice(0, hote.length - enregistrable.length - 1) : '';
    var etiquette = etiquetteRacine(hote);

    R.MARQUES.forEach(function (b) {
      if (estOfficiel(hote, b)) { resultat.officielPour.push(b.id); return; }
      if (neutre) return;
      var trompeur = b.dom.some(function (d) {
        return d.length >= 6 && (hote.indexOf('.' + d + '.') >= 0 || hote.indexOf(d + '.') === 0) && hote.slice(-(d.length + 1)) !== '.' + d && hote !== d;
      });
      if (trompeur || (gauche && marqueDansDomaine(b, gauche))) { ajouter('SOUS_DOMAINE_TROMPEUR'); resultat.marquesTierces.push(b.id); return; }
      if (marqueDansDomaine(b, etiquette)) { ajouter('MARQUE_TIERS'); resultat.marquesTierces.push(b.id); }
    });

    if (R.TLD_RISQUES.indexOf(tld) >= 0 && !neutre) ajouter('TLD_RISQUE');
    if ((etiquette.match(/-/g) || []).length >= CFG.tiretsExcessifs) ajouter('TIRETS_MULTIPLES');
    var age = ages && ages[resultat.domaine];
    if (age && typeof age.ageJours === 'number') {
      resultat.ageJours = age.ageJours;
      if (age.ageJours < CFG.ageRecentJours) ajouter('DOMAINE_RECENT');
    }

    if (resultat.officielPour.length) raisons = raisons.filter(function (c) { return c === 'USERINFO' || c === 'PORT_INHABITUEL'; });
    resultat.raisons = raisons;
    resultat.niveau = niveauDesRaisons(raisons);
    return resultat;
  }

  /* ------------------------------------------------------------------
   * Expéditeur
   * ------------------------------------------------------------------ */
  function parseSender(s) {
    s = String(s || '').trim();
    if (!s) return null;
    var m = s.match(/^(.*?)<\s*([^<>\s]+@[^<>\s]+)\s*>\s*$/);
    var addr = m ? m[2] : (s.match(/[^\s<>"']+@[^\s<>"']+\.[a-z]{2,}/i) || [''])[0];
    if (addr) {
      var at = addr.lastIndexOf('@');
      return {
        kind: 'email', display: (m ? m[1] : s.replace(addr, '')).replace(/["'<>]/g, '').trim(),
        addr: addr.toLowerCase(), local: addr.slice(0, at).toLowerCase(),
        domain: addr.slice(at + 1).toLowerCase().replace(/[>.,;]+$/, '')
      };
    }
    var digits = s.replace(/[\s.\-()]/g, '');
    if (/^(\+|00)?\d{4,15}$/.test(digits)) {
      var n = digits.replace(/^00/, '+'), intl = n.charAt(0) === '+', nat = n;
      if (/^\+33\d{9}$/.test(n)) nat = '0' + n.slice(3);
      return { kind: 'phone', raw: s, num: n, nat: nat, intl: intl && !/^\+33/.test(n) };
    }
    return { kind: 'name', name: s };
  }

  /* ------------------------------------------------------------------
   * Préparation : séparation des en-têtes, du corps et du pied de page
   * ------------------------------------------------------------------ */
  var NOMS_ENTETES = /^(from|de|exp[ée]diteur|subject|objet|sujet|to|[àa]|cc|bcc|date|envoy[ée]|received|return-path|reply-to|authentication-results|received-spf|dkim-signature|message-id|mime-version|delivered-to|content-[a-z-]+|arc-[a-z-]+|x-[a-z0-9-]+)$/i;
  var RE_PIED = /(se d[ée]sabonner|se d[ée]sinscrire|d[ée]sinscri|unsubscribe|mentions l[ée]gales|tous droits r[ée]serv[ée]s|all rights reserved|©|\bsiret\b|\brcs\b|ne pas r[ée]pondre|do not reply|vous recevez (ce|cet)|politique de confidentialit)/i;

  function lireEntetes(lignes) {
    var entetes = {}, i = 0, dernier = null, vus = 0;
    for (; i < Math.min(lignes.length, 80); i++) {
      var l = lignes[i];
      if (/^[ \t]+\S/.test(l) && dernier) { entetes[dernier] += ' ' + l.trim(); continue; }
      var m = /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9-]{0,40})\s*:\s*(.*)$/.exec(l);
      if (m && NOMS_ENTETES.test(m[1])) {
        dernier = m[1].toLowerCase();
        entetes[dernier] = (entetes[dernier] ? entetes[dernier] + ' ' : '') + m[2].trim();
        vus++;
        continue;
      }
      if (l.trim() === '' && vus) { i++; break; }
      break;
    }
    return vus ? { entetes: entetes, suite: i } : null;
  }

  function lireAuth(entetes) {
    var ar = (entetes['authentication-results'] || '') + ' ' + (entetes['received-spf'] || '');
    var lire = function (nom) { var m = new RegExp('\\b' + nom + '\\s*=\\s*(pass|fail|softfail|neutral|none|temperror|permerror)', 'i').exec(ar); return m ? m[1].toLowerCase() : null; };
    var spf = lire('spf');
    if (!spf) { var r = /^\s*(pass|fail|softfail|neutral|none|temperror|permerror)\b/i.exec(entetes['received-spf'] || ''); if (r) spf = r[1].toLowerCase(); }
    var dk = (/\bd=([^;\s]+)/i.exec(entetes['dkim-signature'] || '') || [])[1] || '';
    return { spf: spf, dkim: lire('dkim'), dmarc: lire('dmarc'), dkimDomaine: dk.toLowerCase() };
  }

  /* ------------------------------------------------------------------
   * Messages bruts (.eml ou « afficher l'original ») : mots encodés, quoted-printable, base64, HTML
   * ------------------------------------------------------------------ */
  function octetsVersTexte(octets, charset) {
    try { return new TextDecoder((charset || 'utf-8').toLowerCase()).decode(octets); }
    catch (e) {
      /* repli sans TextDecoder : latin-1 puis tentative UTF-8 */
      var s = '';
      for (var i = 0; i < octets.length; i++) s += String.fromCharCode(octets[i]);
      if (!charset || /utf-?8/i.test(charset)) { try { return decodeURIComponent(escape(s)); } catch (e2) { return s; } }
      return s;
    }
  }
  function decoderQP(s, charset) {
    var plat = String(s).replace(/=\r?\n/g, '');
    var octets = [];
    for (var i = 0; i < plat.length; i++) {
      var c = plat.charAt(i);
      if (c === '=' && /^[0-9a-fA-F]{2}$/.test(plat.substr(i + 1, 2))) { octets.push(parseInt(plat.substr(i + 1, 2), 16)); i += 2; }
      else octets.push(plat.charCodeAt(i) & 0xff);
    }
    return octetsVersTexte(new Uint8Array(octets), charset);
  }
  function decoderB64(s, charset) {
    var bin;
    try { bin = atob(String(s).replace(/[^A-Za-z0-9+/=]/g, '')); } catch (e) { return ''; }
    var octets = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) octets[i] = bin.charCodeAt(i);
    return octetsVersTexte(octets, charset);
  }
  function decoderMots(s) {
    return String(s || '').replace(/(\?=)\s+(=\?)/g, '$1$2').replace(/=\?([\w-]+)\?([bBqQ])\?([^?]{0,500})\?=/g, function (m, cs, enc, txt) {
      return enc.toLowerCase() === 'b' ? decoderB64(txt, cs) : decoderQP(txt.replace(/_/g, ' '), cs);
    });
  }
  /* HTML -> texte : les adresses des liens sont conservées entre parenthèses, car le texte affiché peut mentir. */
  function htmlVersTexte(html) {
    var t = String(html)
      .replace(/<(script|style)\b[\s\S]{0,60000}?<\/\1>/gi, ' ')
      .replace(/<a\b[^>]{0,500}?href\s*=\s*["']([^"']{1,2000})["'][^>]{0,500}>([\s\S]{0,2000}?)<\/a>/gi, function (m, href, inner) {
        var txt = inner.replace(/<[^>]{0,500}>/g, '').trim();
        return txt && txt !== href ? txt + ' (' + href + ') ' : href + ' ';
      })
      .replace(/<br\s*\/?>|<\/(p|div|tr|li|h[1-6]|table)>/gi, '\n')
      .replace(/<[^>]{0,2000}>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
      .replace(/&#(\d{1,6});/g, function (m, n) { try { return String.fromCodePoint(+n); } catch (e) { return ' '; } });
    return t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  function decoderPartie(corps, cte, charset) {
    cte = String(cte || '').toLowerCase().trim();
    if (cte === 'quoted-printable') return decoderQP(corps, charset);
    if (cte === 'base64') return decoderB64(corps, charset);
    return corps;
  }
  /* Retourne le texte lisible d'un message MIME (partie text/plain de préférence, sinon text/html). */
  function corpsMime(apresEntetes, h, profondeur) {
    var ctype = h['content-type'] || '';
    var cs = (/charset\s*=\s*"?([\w-]+)/i.exec(ctype) || [])[1];
    if (/^\s*multipart\//i.test(ctype)) {
      var bm = /boundary\s*=\s*"?([^";\s]+)"?/i.exec(ctype);
      if (!bm || (profondeur || 0) >= 4) return '';
      var parts = apresEntetes.split('--' + bm[1]);
      var meilleur = { plain: '', html: '' };
      for (var i = 1; i < parts.length; i++) {
        var seg = parts[i].replace(/^\r?\n/, '');
        if (/^--/.test(seg)) break;
        var l = seg.split(/\r?\n/);
        var sub = lireEntetes(l);
        var sh = sub ? sub.entetes : {};
        var body = sub ? l.slice(sub.suite).join('\n') : seg;
        var ct = sh['content-type'] || 'text/plain';
        if (/\battachment\b/i.test(sh['content-disposition'] || '')) continue;
        if (/^\s*multipart\//i.test(ct)) { var interne = corpsMime(body, sh, (profondeur || 0) + 1); if (interne && !meilleur.plain) meilleur.plain = interne; continue; }
        if (/^\s*text\/plain/i.test(ct) && !meilleur.plain) meilleur.plain = corpsMime(body, sh, (profondeur || 0) + 1);
        else if (/^\s*text\/html/i.test(ct) && !meilleur.html) meilleur.html = corpsMime(body, sh, (profondeur || 0) + 1);
      }
      return meilleur.plain || meilleur.html;
    }
    var decode = decoderPartie(apresEntetes, h['content-transfer-encoding'], cs);
    return /^\s*text\/html/i.test(ctype) ? htmlVersTexte(decode) : decode;
  }

  function preparer(entree) {
    var type = entree.type === 'email' ? 'email' : 'sms';
    var texte = String(entree.texte || '');
    var tronque = false;
    if (texte.length > CFG.longueurMaxTexte) { texte = texte.slice(0, CFG.longueurMaxTexte); tronque = true; }
    var prep = {
      type: type, corps: texte, objet: String(entree.objet || '').slice(0, 300), expediteur: String(entree.expediteur || '').slice(0, 300),
      pied: String(entree.piedDePage || '').slice(0, 20000), entetes: null, auth: null, replyTo: '', returnPath: '', tronque: tronque,
      auto: { expediteur: false, objet: false, pied: false }
    };
    if (type !== 'email') return prep;

    var lignes = texte.split(/\r?\n/);
    var lu = lireEntetes(lignes);
    var corps = texte;
    if (lu) {
      var h = lu.entetes;
      ['from', 'de', 'subject', 'objet', 'sujet', 'reply-to', 'return-path'].forEach(function (k) { if (h[k]) h[k] = decoderMots(h[k]); });
      prep.entetes = h;
      var suite = lignes.slice(lu.suite).join('\n');
      var mime = /multipart\/|quoted-printable|base64|text\/html/i.test((h['content-type'] || '') + ' ' + (h['content-transfer-encoding'] || ''));
      corps = mime ? (corpsMime(suite, h, 0) || suite) : suite.replace(/^\s*\n/, '');
      if (!prep.expediteur && (h.from || h['de'] || h['expéditeur'] || h['expediteur'])) { prep.expediteur = (h.from || h['de'] || h['expéditeur'] || h['expediteur']).slice(0, 300); prep.auto.expediteur = true; }
      if (!prep.objet && (h.subject || h.objet || h.sujet)) { prep.objet = (h.subject || h.objet || h.sujet).slice(0, 300); prep.auto.objet = true; }
      prep.replyTo = h['reply-to'] || '';
      prep.returnPath = h['return-path'] || '';
      prep.auth = lireAuth(h);
      if (!(prep.auth.spf || prep.auth.dkim || prep.auth.dmarc)) prep.auth = null;
    }
    if (!prep.pied) {
      var bl = corps.split('\n');
      var depart = -1;
      for (var j = Math.max(0, bl.length - 14); j < bl.length; j++) { if (RE_PIED.test(bl[j])) { depart = j; break; } }
      if (depart > 0) { prep.pied = bl.slice(depart).join('\n').trim(); corps = bl.slice(0, depart).join('\n').trim() || corps; prep.auto.pied = true; }
    }
    prep.corps = corps.trim() || corps;
    return prep;
  }

  /* ------------------------------------------------------------------
   * Analyse
   * ------------------------------------------------------------------ */
  var FAMILLES_ORGANISME = ['faux_conseiller', 'menace_blocage', 'menace_autorite', 'verification_identite', 'paiement_demande', 'coordonnees_bancaires', 'code_transmission', 'alerte_virus', 'faux_livreur'];

  function creerChamp(brut) { brut = String(brut || ''); return { brut: brut, plat: aplatir(brut) }; }

  function analyser(entree) {
    entree = entree || {};
    var prep = preparer(entree);
    var champs = { corps: creerChamp(prep.corps), objet: creerChamp(prep.objet), pied: creerChamp(prep.pied), expediteur: creerChamp(prep.expediteur) };
    var annee = entree.annee || new Date().getFullYear();

    /* --- liens (texte, objet, pied de page) et QR codes décodés --- */
    var liensBruts = [];
    var vusLiens = {};
    ['corps', 'objet', 'pied'].forEach(function (champ) {
      extraireLiens(champs[champ].plat, champs[champ].brut).forEach(function (l) {
        var cle = l.brut.toLowerCase();
        if (vusLiens[cle] || liensBruts.length >= CFG.maxLiens) return;
        vusLiens[cle] = true;
        liensBruts.push({ brut: l.brut, champ: champ, debut: l.debut, fin: l.fin, origine: 'texte' });
      });
    });
    (entree.qr || []).forEach(function (u) {
      var cle = String(u).toLowerCase();
      if (!u || vusLiens[cle] || liensBruts.length >= CFG.maxLiens) return;
      vusLiens[cle] = true;
      liensBruts.push({ brut: String(u), champ: null, origine: 'qr' });
    });
    var lienAnalyse = liensBruts.map(function (l) {
      var a = analyserLien(l.brut, l.origine, entree.domaines);
      a.champ = l.champ; a.debut = l.debut; a.fin = l.fin;
      return a;
    }).filter(function (a) { return a.hote; });

    /* --- expéditeur --- */
    var exp = parseSender(prep.expediteur);

    /* --- marques revendiquées (début du message, objet, nom d'expéditeur, ou message court) --- */
    var affiche = exp && exp.kind === 'email' ? exp.display : (exp && exp.kind === 'name' ? exp.name : '');
    var court = prep.corps.length <= CFG.longueurMessageCourt;
    var zoneRevendication = aplatir(affiche) + '\n' + champs.objet.plat + '\n' + (court ? champs.corps.plat : champs.corps.plat.slice(0, CFG.fenetreRevendication));
    var revendiquees = R.MARQUES.filter(function (b) { return b.re.test(zoneRevendication); });

    /* --- règles de détection --- */
    var signaux = [];
    var enPrevention = false;
    var marqueurs = marqueursPrevention(champs.corps.plat + '\n' + champs.objet.plat);
    if (marqueurs.length >= CFG.marqueursPrevention) enPrevention = true;

    COMPILEES.forEach(function (c) {
      var hits = scannerRegle(c, champs);
      if (!hits.length) return;
      var regle = c.regle;
      if (regle.condition && !regle.condition(hits, { annee: annee })) return;
      var vus = {}, extraits = [];
      hits.forEach(function (h) { var k = h.extrait.toLowerCase(); if (!vus[k] && extraits.length < CFG.maxExtraitsParRegle) { vus[k] = true; extraits.push(h.extrait); } });
      signaux.push({
        id: regle.id, categorie: regle.categorie, poids: regle.poids, libelle: regle.libelle, extraits: extraits,
        positions: hits.map(function (h) { return { champ: h.champ, debut: h.debut, fin: h.fin }; }),
        explication: regle.explication, action: regle.action, fiche: fiche(regle.fiche), regle: regle.id
      });
    });

    /* Dans un message de prévention, les motifs d'arnaque sont cités pour mettre en garde : ils ne comptent pas. */
    if (enPrevention) {
      signaux = signaux.filter(function (s) { return s.categorie !== 'manipulation'; });
      signaux.push({
        id: 'prevention', categorie: 'contexte', poids: 0, libelle: R.PREVENTION.libelle,
        extraits: [], positions: marqueurs.map(function (h) { return { champ: 'corps', debut: h.debut, fin: h.fin }; }),
        explication: R.PREVENTION.explication, action: '', fiche: fiche(R.PREVENTION.fiche), regle: 'prevention'
      });
    }

    var idsSignaux = {};
    signaux.forEach(function (s) { idsSignaux[s.id] = s; });
    var orgClaim = revendiquees.length > 0 || FAMILLES_ORGANISME.some(function (id) { return idsSignaux[id]; });
    var personnel = !!(idsSignaux.nouveau_numero || idsSignaux.appel_proche);

    /* --- incohérences vérifiables --- */
    var incoherences = [];
    var incoh = function (code, valeurs, preuve, champ) {
      var d = R.INCOHERENCES[code];
      incoherences.push({
        id: code, force: d.force, libelle: d.libelle, preuve: preuve || '', champ: champ || null,
        explication: remplacer(d.explication, valeurs), fiche: fiche(d.fiche)
      });
    };
    var dejaIncoh = {};
    var unique = function (cle) { if (dejaIncoh[cle]) return false; dejaIncoh[cle] = true; return true; };

    /* liens piégés */
    lienAnalyse.forEach(function (l) {
      var marque = l.marquesTierces.length ? R.MARQUES.filter(function (b) { return b.id === l.marquesTierces[0]; })[0] : null;
      if (l.raisons.indexOf('USERINFO') >= 0 && unique('userinfo|' + l.hote)) incoh('LIEN_TROMPEUR', { domaine: l.hote }, l.url);
      else if (l.raisons.indexOf('SOUS_DOMAINE_TROMPEUR') >= 0 && unique('sous|' + l.hote)) incoh('LIEN_TROMPEUR', { domaine: l.hote }, l.url);
      else if (l.raisons.indexOf('MARQUE_TIERS') >= 0 && unique('tiers|' + l.hote)) incoh('LIEN_MARQUE_TIERS', { domaine: l.hote, marque: marque ? marque.nom : '' }, l.url);
    });
    /* lien à indice faible ou net (hors incohérence critique, déjà comptée) : un signal, pas un verdict */
    var risques = lienAnalyse.filter(function (l) { return l.niveau >= 1 && l.niveau < 3; });
    if (risques.length) {
      var lienNet = risques.some(function (l) { return l.niveau >= 2; });
      var sl2 = R.SIGNAL_LIEN[lienNet ? 'net' : 'faible'];
      var codesLien = [];
      risques.forEach(function (l) { l.raisons.forEach(function (c) { if (codesLien.indexOf(c) < 0) codesLien.push(c); }); });
      signaux.push({
        id: 'lien_a_risque', categorie: 'manipulation', poids: sl2.poids, libelle: sl2.libelle,
        extraits: risques.slice(0, CFG.maxExtraitsParRegle).map(function (l) { return l.hote; }),
        positions: risques.filter(function (l) { return l.champ && l.debut != null; }).map(function (l) { return { champ: l.champ, debut: l.debut, fin: l.fin }; }),
        explication: sl2.explication + codesLien.map(function (c) { return R.LIEN_RAISONS[c].libelle; }).join(' ; ') + '.',
        action: 'Ne cliquez pas : tapez vous-même l\'adresse du site officiel.', fiche: fiche('phishing'), regle: 'lien_a_risque'
      });
    }
    /* lien qui ne mène pas à la marque dont le message se réclame */
    revendiquees.forEach(function (b) {
      lienAnalyse.forEach(function (l) {
        if (l.niveau >= 3 || l.officielPour.indexOf(b.id) >= 0) return;
        if (l.officielPour.length) return;
        if (unique('nonoff|' + b.id + '|' + l.hote)) incoh('LIEN_NON_OFFICIEL', { marque: b.nom, domaine: l.hote }, l.url);
      });
    });

    var senderOfficiel = [];
    var senderTierce = false;
    if (exp && exp.kind === 'email') {
      var dom = exp.domain;
      var enreg = domaineEnregistrable(dom);
      var neutreExp = estNeutre(dom);
      var marqueDomaine = null;
      R.MARQUES.forEach(function (b) {
        if (estOfficiel(dom, b)) { senderOfficiel.push(b.id); return; }
        if (neutreExp) return;
        if (!marqueDomaine && marqueDansDomaine(b, etiquetteRacine(dom))) marqueDomaine = b;
      });
      if (marqueDomaine) { senderTierce = true; if (unique('sosie|' + dom)) incoh('DOMAINE_SOSIE', { domaine: dom, marque: marqueDomaine.nom }, exp.addr, 'expediteur'); }
      else {
        R.MARQUES.forEach(function (b) {
          if (senderOfficiel.indexOf(b.id) >= 0 || neutreExp) return;
          if (aplatir(exp.display).match(b.re) && unique('usurpe|' + b.id)) { senderTierce = true; incoh('EXPEDITEUR_USURPE', { marque: b.nom, domaine: dom }, exp.addr, 'expediteur'); }
        });
      }
      var webmail = R.WEBMAIL.indexOf(dom) >= 0;
      if (webmail) senderOfficiel = [];
      if (!senderTierce && !senderOfficiel.length) {
        if (webmail) { if (orgClaim && unique('webmail')) incoh('WEBMAIL_OFFICIEL', { domaine: dom }, exp.addr, 'expediteur'); }
        else {
          var nonConcordant = revendiquees.filter(function (b) { return !estOfficiel(dom, b); })[0];
          if (nonConcordant && unique('expinc|' + nonConcordant.id)) incoh('EXPEDITEUR_INCOHERENT', { marque: nonConcordant.nom, domaine: dom }, exp.addr, 'expediteur');
        }
      }
      if ((/(^|\.)xn--/.test(dom) || /[^\x00-\x7f]/.test(dom)) && unique('idn')) incoh('IDN_EXPEDITEUR', {}, dom, 'expediteur');
      var raisonsDom = analyserLien(dom).raisons.filter(function (c) { return c !== 'MARQUE_TIERS' && c !== 'SOUS_DOMAINE_TROMPEUR'; });
      if (raisonsDom.length && !marqueDomaine) {
        var sd = R.SIGNAUX_EXPEDITEUR.exp_domaine;
        signaux.push({ id: 'exp_domaine', categorie: 'manipulation', poids: sd.poids, libelle: sd.libelle, extraits: [dom], positions: [], explication: remplacer(sd.explication, { domaine: dom }) + ' ' + raisonsDom.map(function (c) { return R.LIEN_RAISONS[c].libelle + '.'; }).join(' '), action: '', fiche: fiche(sd.fiche), regle: 'exp_domaine', champ: 'expediteur' });
      }
      if (/\d{6,}/.test(exp.local) || exp.local.length > 28) {
        var sl = R.SIGNAUX_EXPEDITEUR.exp_local;
        signaux.push({ id: 'exp_local', categorie: 'manipulation', poids: sl.poids, libelle: sl.libelle, extraits: [exp.addr], positions: [], explication: sl.explication, action: '', fiche: fiche(sl.fiche), regle: 'exp_local', champ: 'expediteur' });
      }
    } else if (exp && exp.kind === 'phone') {
      var nat = exp.nat;
      var sig = function (id, valeurs, poids) {
        var d = R.SIGNAUX_EXPEDITEUR[id];
        signaux.push({ id: id, categorie: (poids === undefined ? d.poids : poids) > 0 ? 'manipulation' : 'contexte', poids: poids === undefined ? d.poids : poids, libelle: d.libelle, extraits: [exp.raw], positions: [], explication: remplacer(d.explication, valeurs), action: '', fiche: fiche(d.fiche), regle: id, champ: 'expediteur' });
      };
      if (/^089\d{7}$/.test(nat)) sig('exp_surtaxe');
      else if (exp.intl) { if (orgClaim) { if (unique('etranger')) incoh('NUMERO_ETRANGER_OFFICIEL', { numero: exp.num.slice(0, 4) + '…' }, exp.raw, 'expediteur'); } else sig('exp_etranger', { numero: exp.num.slice(0, 4) + '…' }); }
      else if (/^0[67]\d{8}$/.test(nat) && orgClaim && !personnel) { if (unique('mobile')) incoh('MOBILE_ORDINAIRE', {}, exp.raw, 'expediteur'); }
      else if (/^\d{4,6}$/.test(exp.num)) sig('exp_court');
    } else if (exp && exp.kind === 'name') {
      var da = R.SIGNAUX_EXPEDITEUR.exp_alpha;
      signaux.push({ id: 'exp_alpha', categorie: 'contexte', poids: 0, libelle: da.libelle, extraits: [exp.name], positions: [], explication: da.explication, action: '', fiche: fiche(da.fiche), regle: 'exp_alpha', champ: 'expediteur' });
    }

    /* en-têtes bruts : authentification et adresse de réponse */
    if (prep.auth) {
      var echecs = [];
      ['spf', 'dkim', 'dmarc'].forEach(function (k) { if (/^(fail|softfail|permerror)$/.test(prep.auth[k] || '')) echecs.push(k.toUpperCase() + ' ' + prep.auth[k]); });
      if (echecs.length) incoh('AUTHENTIFICATION_ECHEC', { controles: echecs.join(', ') }, echecs.join(' ; '), 'expediteur');
    }
    var domaineReponse = function (s) { var p = parseSender(s); return p && p.kind === 'email' ? p.domain : ''; };
    var dFrom = exp && exp.kind === 'email' ? exp.domain : '';
    var dReply = domaineReponse(prep.replyTo);
    if (dFrom && dReply && domaineEnregistrable(dFrom) !== domaineEnregistrable(dReply) && unique('reply|' + dReply)) {
      var officielReply = revendiquees.some(function (b) { return estOfficiel(dReply, b); });
      if (!officielReply) incoh('REPONSE_DIVERGENTE', { domaine: dReply }, prep.replyTo, 'expediteur');
    }
    var dRetour = domaineReponse(prep.returnPath);
    if (dFrom && dRetour && domaineEnregistrable(dFrom) !== domaineEnregistrable(dRetour)) {
      var spfValide = prep.auth && prep.auth.spf === 'pass';
      var spfEchec = prep.auth && /^(fail|softfail|permerror)$/.test(prep.auth.spf || '');
      if (!spfValide && (spfEchec || analyserLien(dRetour).niveau >= 1) && unique('retour|' + dRetour)) incoh('RETOUR_DIVERGENT', { domaine: dRetour }, prep.returnPath, 'expediteur');
    }

    /* --- pied de page --- */
    if (prep.pied) {
      var pied = champs.pied.plat;
      var promo = /(offre|promo|remise|soldes?|bon plan|newsletter|-\s?\d{1,2} ?%)/i.test(champs.corps.plat + ' ' + champs.objet.plat + ' ' + pied);
      var ajouterPied = function (id, valeurs, extraits) {
        var d = R.SIGNAUX_PIED[id];
        signaux.push({ id: id, categorie: 'manipulation', poids: d.poids, libelle: d.libelle, extraits: extraits || [], positions: [], explication: remplacer(d.explication, valeurs), action: '', fiche: fiche(d.fiche), regle: id, champ: 'pied' });
      };
      if (promo && !/(desabonner|desinscri|unsubscribe)/i.test(pied)) ajouterPied('pied_desinscription');
      if ((promo || orgClaim) && !senderOfficiel.length && !/(siret|siren|\brcs\b|capital|\bsas\b|\bsarl\b|mentions legales|\b\d{5}\s+[a-z-]{3,})/i.test(pied)) ajouterPied('pied_identite', {}, [extrait(prep.pied, 0, 80)]);
      var an = (/©\s*(?:copyright\s*)?((?:19|20)\d{2})/i.exec(pied) || [])[1];
      if (an && +an < annee - 1) ajouterPied('pied_annee', { annee: an }, ['© ' + an]);
    }

    /* --- indices (features) disponibles pour les scénarios --- */
    lienAnalyse.forEach(function (l) {
      var manipPresente = signaux.some(function (s) { return s.categorie === 'manipulation'; });
      if (typeof l.ageJours === 'number' && l.ageJours < CFG.ageRecentJours && (revendiquees.length || manipPresente) && unique('recent|' + l.domaine)) incoh('DOMAINE_RECENT', { domaine: l.domaine, jours: l.ageJours }, l.domaine);
    });
    var manipulation = signaux.filter(function (s) { return s.categorie === 'manipulation'; });
    var indices = {};
    signaux.forEach(function (s) { indices[s.id] = true; });
    var suspect = lienAnalyse.some(function (l) { return l.niveau >= 1; });
    var nonOfficiel = revendiquees.length > 0 && lienAnalyse.some(function (l) { return !revendiquees.some(function (b) { return l.officielPour.indexOf(b.id) >= 0; }); });
    if (lienAnalyse.length) indices.lien = true;
    if (lienAnalyse.some(function (l) { return l.origine === 'qr'; })) indices.qr = true;
    if (suspect || nonOfficiel) indices.hote_non_officiel = true;
    if (manipulation.length) indices.manip = true;
    revendiquees.forEach(function (b) { indices['marque:' + b.cat] = true; indices['marque:' + b.id] = true; });

    /* --- scénarios --- */
    var scenarios = [];
    if (!enPrevention) {
      R.SCENARIOS.forEach(function (sc) {
        var ok = {};
        sc.briques.forEach(function (b) { ok[b.id] = b.indices.some(function (i) { return indices[i]; }); });
        var tous = sc.confirme.every(function (id) { return ok[id]; });
        var part = !tous && sc.partiel.every(function (id) { return ok[id]; });
        if (!tous && !part) return;
        var preuves = [];
        sc.briques.forEach(function (b) {
          if (!ok[b.id]) return;
          for (var k = 0; k < b.indices.length; k++) {
            var ind = b.indices[k];
            if (!indices[ind]) continue;
            var s = idsSignaux[ind];
            if (s && s.extraits.length) preuves.push({ extrait: s.extraits[0], regle: ind, brique: b.libelle });
            else if (ind === 'lien' && lienAnalyse.length) preuves.push({ extrait: lienAnalyse[0].url, regle: 'lien', brique: b.libelle });
            else if (ind === 'qr') preuves.push({ extrait: lienAnalyse.filter(function (l) { return l.origine === 'qr'; })[0].url, regle: 'qr', brique: b.libelle });
            else if (ind === 'hote_non_officiel') { var lh = lienAnalyse.filter(function (l) { return l.niveau >= 1 || !l.officielPour.length; })[0]; if (lh) preuves.push({ extrait: lh.hote, regle: 'hote_non_officiel', brique: b.libelle }); }
            else if (ind.indexOf('marque:') === 0) { var mb = revendiquees.filter(function (x) { return x.cat === ind.slice(7); })[0]; if (mb) preuves.push({ extrait: mb.nom, regle: ind, brique: b.libelle }); }
            else if (ind === 'manip' && manipulation.length) preuves.push({ extrait: manipulation[0].extraits[0] || manipulation[0].libelle, regle: manipulation[0].id, brique: b.libelle });
            else continue;
            break;
          }
        });
        scenarios.push({
          id: sc.id, libelle: sc.libelle, statut: tous ? 'confirme' : 'partiel', preuves: preuves, explication: sc.explication, fiche: fiche(sc.fiche),
          briquesManquantes: sc.briques.filter(function (b) { return !ok[b.id]; }).map(function (b) { return b.libelle; })
        });
      });
    }

    /* --- niveau --- */
    var points = 0;
    manipulation.forEach(function (s) { points += s.poids >= CFG.poidsFort ? 2 : 1; });
    var critique = incoherences.some(function (i) { return i.force === 'critique'; });
    var forte = incoherences.some(function (i) { return i.force === 'forte'; });
    var confirme = scenarios.some(function (s) { return s.statut === 'confirme'; });
    var partiel = scenarios.some(function (s) { return s.statut === 'partiel'; });

    var niveau = 0;
    if (points >= 1) niveau = 1;
    if (points >= CFG.pointsPourSuspect || partiel || forte) niveau = 2;
    if (confirme || critique || (forte && points >= CFG.pointsAvecIncoherenceForte)) niveau = 3;

    /* Cliquet de cohérence : marque authentifiée par un domaine officiel et aucun signal de manipulation. */
    var authentifiees = [];
    revendiquees.forEach(function (b) {
      var parLien = lienAnalyse.length && lienAnalyse.every(function (l) { return l.officielPour.indexOf(b.id) >= 0; });
      var parExp = senderOfficiel.indexOf(b.id) >= 0 && !incoherences.some(function (i) { return i.id === 'AUTHENTIFICATION_ECHEC'; });
      if ((parLien || parExp) && authentifiees.indexOf(b.nom) < 0) authentifiees.push(b.nom);
    });
    R.MARQUES.forEach(function (b) {
      if (senderOfficiel.indexOf(b.id) >= 0 && authentifiees.indexOf(b.nom) < 0 && !incoherences.some(function (i) { return i.id === 'AUTHENTIFICATION_ECHEC'; })) authentifiees.push(b.nom);
    });
    var cliquet = false;
    if (authentifiees.length && points === 0 && !incoherences.length && niveau > CFG.plafondMarqueAuthentifiee) { niveau = CFG.plafondMarqueAuthentifiee; cliquet = true; }

    /* --- limites --- */
    var ageVerifie = lienAnalyse.some(function (l) { return typeof l.ageJours === 'number'; });
    var limites = [ageVerifie ? R.LIMITES.reputation : R.LIMITES.age_domaine, R.LIMITES.page_destination, R.LIMITES.authenticite_expediteur];
    if (prep.type === 'email' && !prep.auth) limites.push(R.LIMITES.controles_email);
    if (!exp) limites.push(R.LIMITES.expediteur_absent);
    if (prep.tronque) limites.push(R.LIMITES.texte_tronque);

    /* --- justification en langage naturel (preuves, jamais un score) --- */
    var justification = [];
    scenarios.slice().sort(function (a, b) { return (a.statut === 'confirme' ? 0 : 1) - (b.statut === 'confirme' ? 0 : 1); }).forEach(function (s) { justification.push((s.statut === 'confirme' ? 'le scénario « ' : 'un début du scénario « ') + s.libelle.toLowerCase() + ' »'); });
    incoherences.forEach(function (i) { justification.push(i.libelle.charAt(0).toLowerCase() + i.libelle.slice(1)); });
    manipulation.slice().sort(function (a, b) { return b.poids - a.poids; }).forEach(function (s) { justification.push(s.libelle.charAt(0).toLowerCase() + s.libelle.slice(1)); });

    var tri = function (a, b) { return b.poids - a.poids; };
    return {
      niveau: niveau,
      scenarios: scenarios,
      incoherences: incoherences,
      signaux: manipulation.sort(tri).concat(signaux.filter(function (s) { return s.categorie !== 'manipulation'; })),
      lienAnalyse: lienAnalyse,
      contexte: {
        type: prep.type,
        expediteur: prep.expediteur || null,
        domaine: exp && exp.kind === 'email' ? exp.domain : null,
        marqueRevendiquee: revendiquees.map(function (b) { return b.nom; }),
        marqueAuthentifiee: authentifiees,
        piedDePage: !!prep.pied,
        prevention: enPrevention,
        cliquet: cliquet,
        enteteAuthentification: prep.auth
      },
      affichage: { corps: prep.corps, objet: prep.objet, expediteur: prep.expediteur, piedDePage: prep.pied, auto: prep.auto },
      justification: justification,
      limites: limites,
      versionRegles: R.VERSION
    };
  }

  /* Version lisible d'un .eml ou d'un message brut : en-têtes utiles conservés (dont l'authentification), corps décodé. */
  function nettoyerEml(brut) {
    var texte = String(brut || '');
    var prep = preparer({ texte: texte, type: 'email' });
    if (!prep.entetes) return texte;
    var h = prep.entetes, lignes = [];
    var ajouter = function (nom, v) { if (v) lignes.push(nom + ': ' + v); };
    ajouter('From', prep.expediteur); ajouter('Reply-To', prep.replyTo); ajouter('Return-Path', prep.returnPath); ajouter('Subject', prep.objet); ajouter('Date', h.date);
    ajouter('Authentication-Results', h['authentication-results']); ajouter('Received-SPF', h['received-spf']);
    if (h['dkim-signature']) ajouter('DKIM-Signature', h['dkim-signature'].slice(0, 160));
    return lignes.join('\n') + '\n\n' + (prep.corps + (prep.pied ? '\n\n' + prep.pied : '')).trim();
  }

  return {
    VERSION: R.VERSION, analyser: analyser, analyserLien: analyserLien, extraireLiens: extraireLiens, parseSender: parseSender,
    preparer: preparer, aplatir: aplatir, testerRegle: testerRegle, domaineEnregistrable: domaineEnregistrable, nettoyerEml: nettoyerEml,
    decoderMots: decoderMots, htmlVersTexte: htmlVersTexte
  };
});
