/*
 * CyberBalise : règles du détecteur d'arnaque (données pures, sans logique de calcul).
 *
 * Chargé tel quel par le navigateur (window.CyberBaliseRules) et par Node (require).
 * Conventions :
 *  - les motifs sont écrits SANS accents, en minuscules, avec l'apostrophe droite ' :
 *    le moteur « aplatit » le texte (accents -> lettres de base, apostrophes typographiques -> ')
 *    en conservant exactement la longueur, ce qui permet de surligner le texte d'origine ;
 *  - aucune expression régulière non bornée : on écrit [^.\n]{0,40}, jamais .* ni .+ ;
 *  - chaque règle porte ses propres tests (positifs / négatifs) : une règle sans test fait échouer la suite.
 */
(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) module.exports = fabrique();
  else racine.CyberBaliseRules = fabrique();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '2.0.0';
  var DATE_MAJ = '2026-11-04';

  /* ------------------------------------------------------------------
   * Réglages. Aucun nombre magique dans le moteur : tout est ici.
   * ------------------------------------------------------------------ */
  var CONFIG = {
    // Un signal de manipulation de poids >= poidsFort compte pour deux signaux (ex. demande de code).
    poidsFort: 4,
    // Nombre de « points de manipulation » à partir duquel un message est dit suspect (niveau 2).
    pointsPourSuspect: 2,
    // Nombre de points de manipulation qui, ajoutés à une incohérence forte, donnent le niveau 3.
    pointsAvecIncoherenceForte: 2,
    // Fenêtre (en caractères) examinée avant un motif pour y chercher une négation ou une mise en garde.
    fenetreNegation: 40,
    // Nombre minimal de marqueurs de prévention pour considérer le message comme un message de prévention.
    marqueursPrevention: 2,
    // Plafond du niveau quand la marque est authentifiée et qu'aucun signal de manipulation n'existe.
    plafondMarqueAuthentifiee: 1,
    // Bornes de sécurité (performance et abus).
    longueurMaxTexte: 100000,
    maxCorrespondancesParRegle: 12,
    maxExtraitsParRegle: 3,
    maxLiens: 30,
    longueurMaxExtrait: 140,
    // Ports considérés comme normaux pour un lien.
    portsUsuels: [80, 443],
    // Nombre minimal de tirets dans un nom de domaine pour le juger « à rallonge ».
    tiretsExcessifs: 2,
    // Longueur minimale d'un mot-clé de marque pour le chercher à l'intérieur d'un nom de domaine.
    longueurMinMotMarque: 5,
    // Un message de cette longueur ou moins est « court » : une marque citée n'importe où est alors réputée revendiquée.
    longueurMessageCourt: 400,
    // Dans un message long, seule une marque citée dans ces premiers caractères est réputée revendiquée.
    fenetreRevendication: 160
  };

  /* Domaines techniques de grandes marques (hébergement, statiques) : ni officiels, ni « sosies ». */
  var DOMAINES_NEUTRES = ['amazonaws.com', 'amazon-adsystem.com', 'googleapis.com', 'googleusercontent.com', 'googlegroups.com', 'googletagmanager.com', 'googleadservices.com', 'google-analytics.com', 'gstatic.com', 'facebook.net', 'fbcdn.net', 'microsoftonline-p.com', 'microsoftstore.com', 'apple-dns.net', 'cloudfront.net'];

  /* Libellé affiché quand le message est une mise en garde (il cite des arnaques pour en protéger). */
  var PREVENTION = {
    libelle: 'Message de prévention : il cite des arnaques pour vous en protéger',
    explication: 'Ce texte ressemble à une mise en garde : les formules d\'arnaque qu\'il contient sont citées pour que vous les reconnaissiez, pas pour vous les appliquer. Les éléments « d\'arnaque » ne sont donc pas comptés.',
    fiche: 'phishing'
  };

  /*
   * Mises en garde : une correspondance précédée (dans la fenêtre) d'un de ces motifs est ignorée.
   * Volontairement stricts : « Attention », « Alerte fraude » ou « Ne tardez pas » apparaissent dans de
   * vrais messages frauduleux et ne doivent surtout pas les neutraliser.
   */
  var ANNULATEURS = [
    /(\bne\b|\bn')\s*[^.\n]{0,20}\bjamais\b/i,
    /(\bne\b|\bn')\s*(le |la |les |l')?\s*(communiquez|partagez|transmettez|donnez|divulguez|envoyez|saisissez|cliquez|ouvrez|repondez|payez|installez|rappelez)\b/i,
    /\b(hameconnage|phishing|arnaques?|escroqueries?|tentatives? de fraude|faux|fausse|fausses)\b/i,
    /\b(raccrochez|signalez)\b/i,
    /\battention aux\b/i,
    /\bnever\b|\bbeware\b|\bscams?\b|\bphishing\b/i
  ];

  /* Marqueurs d'un message de prévention (le site en publie : il ne doit pas se signaler lui-même). */
  var MARQUEURS_PREVENTION = [
    /\bne cliquez (pas|jamais)\b/i,
    /\bn'envoyez jamais\b/i,
    /\bne communiquez jamais\b/i,
    /\bne vous (demandera|demandent|demanderont) jamais\b/i,
    /\bne partagez (jamais|avec personne)\b/i,
    /\bne (donnez|transmettez|saisissez) jamais\b/i,
    /\bne repondez (pas|jamais)\b/i,
    /\braccrochez\b/i,
    /\battention aux (arnaques?|faux|fraudes?|messages?)\b/i,
    /\b(c'est|est|sont|probablement) (une |des )?(arnaques?|frauduleux|frauduleuse|hameconnage|tentatives? de fraude)\b/i,
    /\brestez vigilants?\b/i,
    /\bsignalez[- ](le|la|les|ce)\b/i,
    /\b33700\b|\bsignal[- ]?spam\b/i,
    /\b(conseil|astuce|prevention)\s*:/i,
    /\bne payez (pas|rien)\b/i
  ];

  var FICHES = {
    phishing: { titre: 'Phishing et hameçonnage', url: '/particuliers/menaces/phishing-hameconnage/' },
    sms: { titre: 'Arnaques par SMS et appels', url: '/particuliers/menaces/arnaques-sms-et-appels/' },
    paiement: { titre: 'Banque en ligne et fraude aux paiements', url: '/particuliers/achats/fraude-aux-paiements/' },
    support: { titre: 'Arnaques au faux support', url: '/particuliers/menaces/arnaques-au-faux-support/' },
    chantage: { titre: 'Chantage et sextorsion', url: '/particuliers/menaces/chantage-et-sextorsion/' },
    invest: { titre: "Fausses plateformes d'investissement", url: '/particuliers/menaces/fausses-plateformes-dinvestissement/' },
    crypto: { titre: 'Cryptomonnaies : les pièges', url: '/particuliers/achats/cryptomonnaies-pieges/' },
    entre_particuliers: { titre: 'Arnaques entre particuliers', url: '/particuliers/achats/arnaques-entre-particuliers/' },
    president: { titre: 'Fraude au président : la détecter', url: '/pro/fraude-au-president-detecter/' },
    signaler: { titre: 'Où et comment signaler', url: '/particuliers/victime/signaler-un-probleme/' },
    carte: { titre: 'Carte bancaire débitée : que faire', url: '/particuliers/victime/carte-bancaire-debitee/' },
    vie_privee: { titre: 'Vie privée et données personnelles', url: '/particuliers/comptes/vie-privee-et-donnees-personnelles/' }
  };

  /* ------------------------------------------------------------------
   * Domaines, extensions, marques
   * ------------------------------------------------------------------ */
  var RACCOURCISSEURS = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'is.gd', 'cutt.ly', 'rb.gy', 'ow.ly', 'shorturl.at', 'tiny.cc', 'buff.ly', 'rebrand.ly', 's.id', 'urlz.fr', 't.ly', 'v.gd', 'bl.ink', 'lnkd.in', 'qrco.de', 'l.ead.me', 'short.io', 'clck.ru', 'cli.re', 'u.to'];

  var TLD_RISQUES = ['top', 'xyz', 'info', 'click', 'live', 'icu', 'buzz', 'site', 'online', 'club', 'vip', 'work', 'rest', 'cfd', 'sbs', 'cyou', 'monster', 'quest', 'loan', 'tk', 'ml', 'ga', 'cf', 'gq', 'men', 'bid', 'win', 'stream', 'download', 'review', 'party', 'trade', 'date', 'accountant', 'science', 'zip', 'mov', 'cam', 'bond', 'lat', 'ink'];

  /* Extensions reconnues pour repérer une adresse « nue » (sans http) dans un texte. */
  var TLD_CONNUS = TLD_RISQUES.concat(['com', 'fr', 'net', 'org', 'eu', 'io', 'co', 'be', 'ch', 'de', 'es', 'it', 'uk', 'us', 'ca', 'nl', 'pt', 'lu', 'me', 'tv', 'app', 'dev', 'shop', 'store', 'tech', 'pro', 'biz', 'gouv', 'ru', 'cn', 'su', 'pw', 'cc', 'ws', 'to', 'ly', 'gl']);

  /* Suffixes à deux niveaux (pour trouver le « domaine enregistrable »). */
  var SUFFIXES_DOUBLES = ['co.uk', 'org.uk', 'gov.uk', 'ac.uk', 'com.au', 'com.br', 'co.jp', 'gouv.fr', 'asso.fr', 'com.fr', 'co.nz', 'co.za', 'com.tr', 'com.mx', 'com.cn', 'co.in'];

  var WEBMAIL = ['gmail.com', 'googlemail.com', 'outlook.com', 'outlook.fr', 'hotmail.com', 'hotmail.fr', 'live.com', 'live.fr', 'yahoo.com', 'yahoo.fr', 'msn.com', 'icloud.com', 'me.com', 'aol.com', 'free.fr', 'orange.fr', 'wanadoo.fr', 'sfr.fr', 'neuf.fr', 'laposte.net', 'bbox.fr', 'proton.me', 'protonmail.com', 'gmx.com', 'gmx.fr', 'mail.com', 'yandex.com', 'mail.ru', 'zoho.com'];

  /*
   * Marques souvent imitées. Liste non exhaustive : elle sert à repérer une usurpation, pas à certifier un site.
   *  re     : motif (aplati) qui indique que le message « se réclame » de la marque
   *  mots   : mots-clés (>= 5 lettres) cherchés à l'intérieur d'un nom de domaine
   *  tokens : mots courts, cherchés seulement comme élément entier d'un nom de domaine (edf-facture.top)
   *  dom    : domaines officiels (les sous-domaines sont acceptés)
   *  domRe  : variantes officielles décrites par un motif
   *  cat    : famille, utilisée par les scénarios (livraison, banque, operateur, admin, energie, plateforme)
   */
  var MARQUES = [
    { id: 'ameli', nom: 'Ameli / Assurance Maladie', cat: 'admin', re: /\bameli\b|assurance maladie|carte vitale|\bcpam\b/i, mots: ['ameli', 'assurancemaladie'], tokens: [], dom: ['ameli.fr', 'assurance-maladie.fr'] },
    { id: 'impots', nom: 'Impôts / DGFiP', cat: 'admin', re: /\bimpots?\b|dgfip|finances publiques|tresor public/i, mots: ['dgfip', 'impots', 'tresorpublic'], tokens: [], dom: ['impots.gouv.fr', 'dgfip.finances.gouv.fr', 'finances.gouv.fr'] },
    { id: 'caf', nom: 'CAF', cat: 'admin', re: /\bcaf\b|allocations familiales/i, mots: ['allocationsfamiliales'], tokens: ['caf'], dom: ['caf.fr', 'mon-enfant.fr'] },
    { id: 'ants', nom: 'ANTS', cat: 'admin', re: /\bants\b|carte grise|permis de conduire/i, mots: ['cartegrise'], tokens: ['ants'], dom: ['ants.gouv.fr', 'interieur.gouv.fr'] },
    { id: 'antai', nom: 'ANTAI / amendes', cat: 'admin', re: /\bantai\b|amende forfaitaire|\bpv electronique\b/i, mots: ['antai'], tokens: [], dom: ['antai.gouv.fr', 'amendes.gouv.fr', 'timbres-amendes.gouv.fr'] },
    { id: 'francetravail', nom: 'France Travail', cat: 'admin', re: /france travail|pole emploi|francetravail/i, mots: ['francetravail', 'poleemploi'], tokens: [], dom: ['francetravail.fr', 'pole-emploi.fr', 'francetravail.org'] },
    { id: 'cpf', nom: 'Mon Compte Formation', cat: 'admin', re: /compte (personnel de )?formation|moncompteformation|\bcpf\b/i, mots: ['moncompteformation', 'comptformation'], tokens: ['cpf'], dom: ['moncompteformation.gouv.fr', 'caissedesdepots.fr'] },
    { id: 'servicepublic', nom: 'Service-Public', cat: 'admin', re: /service[- ]public/i, mots: ['servicepublic'], tokens: [], dom: ['service-public.fr', 'gouv.fr'] },
    { id: 'laposte', nom: 'La Poste / Colissimo', cat: 'livraison', re: /la poste|laposte|colissimo/i, mots: ['laposte', 'colissimo'], tokens: [], dom: ['laposte.fr', 'colissimo.fr', 'lapostemobile.fr', 'laposte.com', 'labanquepostale.fr'] },
    { id: 'chronopost', nom: 'Chronopost', cat: 'livraison', re: /chronopost/i, mots: ['chronopost'], tokens: [], dom: ['chronopost.fr', 'chronopost.com'] },
    { id: 'mondialrelay', nom: 'Mondial Relay', cat: 'livraison', re: /mondial ?relay/i, mots: ['mondialrelay'], tokens: [], dom: ['mondialrelay.fr', 'mondialrelay.com'] },
    { id: 'colisprive', nom: 'Colis Privé', cat: 'livraison', re: /colis ?prive/i, mots: ['colisprive'], tokens: [], dom: ['colisprive.fr', 'colisprive.com'] },
    { id: 'dhl', nom: 'DHL', cat: 'livraison', re: /\bdhl\b/i, mots: [], tokens: ['dhl'], dom: ['dhl.com', 'dhl.fr', 'dhl.de'] },
    { id: 'ups', nom: 'UPS', cat: 'livraison', re: /\bups\b/i, mots: [], tokens: ['ups'], dom: ['ups.com'] },
    { id: 'fedex', nom: 'FedEx', cat: 'livraison', re: /fedex/i, mots: ['fedex'], tokens: [], dom: ['fedex.com'] },
    { id: 'gls', nom: 'GLS', cat: 'livraison', re: /\bgls\b/i, mots: [], tokens: ['gls'], dom: ['gls-group.com', 'gls-france.com', 'gls-group.eu'] },
    { id: 'royalmail', nom: 'Royal Mail', cat: 'livraison', re: /royal ?mail/i, mots: ['royalmail'], tokens: [], dom: ['royalmail.com', 'royalmail.co.uk'] },
    { id: 'usps', nom: 'USPS', cat: 'livraison', re: /\busps\b/i, mots: [], tokens: ['usps'], dom: ['usps.com'] },
    { id: 'edf', nom: 'EDF', cat: 'energie', re: /\bedf\b/i, mots: [], tokens: ['edf'], dom: ['edf.fr', 'edf.com'] },
    { id: 'engie', nom: 'Engie', cat: 'energie', re: /\bengie\b/i, mots: ['engie'], tokens: [], dom: ['engie.fr', 'engie.com'] },
    { id: 'totalenergies', nom: 'TotalEnergies', cat: 'energie', re: /total ?energies/i, mots: ['totalenergies'], tokens: [], dom: ['totalenergies.fr', 'totalenergies.com'] },
    { id: 'orange', nom: 'Orange', cat: 'operateur', re: /\borange\b/i, mots: [], tokens: ['orange'], dom: ['orange.fr', 'orange.com', 'sosh.fr', 'orange-business.com'] },
    { id: 'sfr', nom: 'SFR', cat: 'operateur', re: /\bsfr\b/i, mots: [], tokens: ['sfr'], dom: ['sfr.fr', 'sfr.com', 'red-by-sfr.fr'] },
    { id: 'bouygues', nom: 'Bouygues Telecom', cat: 'operateur', re: /bouygues/i, mots: ['bouygues'], tokens: [], dom: ['bouyguestelecom.fr', 'bouygues.com', 'bouyguestelecom.com'] },
    { id: 'free', nom: 'Free / Free Mobile', cat: 'operateur', re: /\bfree mobile\b|\bfreebox\b|\bfree\.fr\b/i, mots: ['freemobile', 'freebox'], tokens: [], dom: ['free.fr', 'free-mobile.fr', 'freebox.fr', 'iliad.fr'] },
    { id: 'amazon', nom: 'Amazon', cat: 'plateforme', re: /amazon/i, mots: ['amazon'], tokens: [], dom: ['amazon.fr', 'amazon.com', 'amazon.de', 'amazon.es', 'amazon.it', 'amazon.co.uk', 'amazonses.com', 'amzn.eu', 'amzn.to', 'a.co'] },
    { id: 'netflix', nom: 'Netflix', cat: 'plateforme', re: /netflix/i, mots: ['netflix'], tokens: [], dom: ['netflix.com', 'nflxext.com'] },
    { id: 'paypal', nom: 'PayPal', cat: 'banque', re: /paypal/i, mots: ['paypal'], tokens: [], dom: ['paypal.com', 'paypal.fr', 'paypal.me'] },
    { id: 'apple', nom: 'Apple', cat: 'plateforme', re: /\bapple\b|icloud/i, mots: ['appleid', 'icloud'], tokens: ['apple'], dom: ['apple.com', 'icloud.com'] },
    { id: 'microsoft', nom: 'Microsoft', cat: 'plateforme', re: /microsoft|\boutlook\b|office ?365|\bonedrive\b/i, mots: ['microsoft', 'office365', 'onedrive'], tokens: ['outlook'], dom: ['microsoft.com', 'microsoftonline.com', 'outlook.com', 'office.com', 'live.com', 'office365.com'] },
    { id: 'google', nom: 'Google', cat: 'plateforme', re: /\bgoogle\b|\bgmail\b/i, mots: ['google', 'gmail'], tokens: [], dom: ['google.com', 'google.fr', 'gmail.com', 'googlemail.com', 'youtube.com'] },
    { id: 'meta', nom: 'Facebook / Instagram / WhatsApp', cat: 'plateforme', re: /facebook|instagram|whatsapp|\bmeta\b/i, mots: ['facebook', 'instagram', 'whatsapp'], tokens: [], dom: ['facebook.com', 'facebookmail.com', 'fb.com', 'meta.com', 'instagram.com', 'whatsapp.com', 'messenger.com'] },
    { id: 'linkedin', nom: 'LinkedIn', cat: 'plateforme', re: /linkedin/i, mots: ['linkedin'], tokens: [], dom: ['linkedin.com', 'lnkd.in'] },
    { id: 'dropbox', nom: 'Dropbox', cat: 'plateforme', re: /dropbox/i, mots: ['dropbox'], tokens: [], dom: ['dropbox.com', 'dropboxmail.com'] },
    { id: 'docusign', nom: 'DocuSign', cat: 'plateforme', re: /docusign/i, mots: ['docusign'], tokens: [], dom: ['docusign.com', 'docusign.net'] },
    { id: 'vinted', nom: 'Vinted', cat: 'plateforme', re: /vinted/i, mots: ['vinted'], tokens: [], dom: ['vinted.fr', 'vinted.com'] },
    { id: 'leboncoin', nom: 'Leboncoin', cat: 'plateforme', re: /leboncoin/i, mots: ['leboncoin'], tokens: [], dom: ['leboncoin.fr'] },
    { id: 'doctolib', nom: 'Doctolib', cat: 'plateforme', re: /doctolib/i, mots: ['doctolib'], tokens: [], dom: ['doctolib.fr', 'doctolib.com'] },
    { id: 'booking', nom: 'Booking.com', cat: 'plateforme', re: /booking\.com|\bbooking\b/i, mots: ['booking'], tokens: [], dom: ['booking.com'] },
    { id: 'creditagricole', nom: 'Crédit Agricole', cat: 'banque', re: /credit agricole|creditagricole/i, mots: ['creditagricole'], tokens: [], dom: ['credit-agricole.fr', 'credit-agricole.com', 'ca-sa.fr'], domRe: /(^|\.)ca-[a-z0-9-]+\.fr$/ },
    { id: 'societegenerale', nom: 'Société Générale', cat: 'banque', re: /societe generale|societegenerale/i, mots: ['societegenerale'], tokens: [], dom: ['societegenerale.fr', 'societegenerale.com', 'socgen.com', 'sg.fr'] },
    { id: 'bnp', nom: 'BNP Paribas', cat: 'banque', re: /bnp ?paribas|\bbnp\b/i, mots: ['bnpparibas'], tokens: ['bnp'], dom: ['bnpparibas.com', 'bnpparibas.net', 'bnpparibas.fr', 'bnpparibas.com.fr', 'mabanque.bnpparibas'] },
    { id: 'lcl', nom: 'LCL', cat: 'banque', re: /\blcl\b/i, mots: [], tokens: ['lcl'], dom: ['lcl.fr'] },
    { id: 'banquepopulaire', nom: 'Banque Populaire', cat: 'banque', re: /banque populaire|banquepopulaire/i, mots: ['banquepopulaire'], tokens: [], dom: ['banquepopulaire.fr', 'banque-populaire.fr'] },
    { id: 'caissedepargne', nom: "Caisse d'Épargne", cat: 'banque', re: /caisse d.?epargne|caisse-epargne/i, mots: ['caisseepargne', 'caissedepargne'], tokens: [], dom: ['caisse-epargne.fr'] },
    { id: 'banquepostale', nom: 'La Banque Postale', cat: 'banque', re: /banque postale|labanquepostale/i, mots: ['labanquepostale', 'banquepostale'], tokens: [], dom: ['labanquepostale.fr'] },
    { id: 'creditmutuel', nom: 'Crédit Mutuel / CIC', cat: 'banque', re: /credit mutuel|creditmutuel|\bcic\b/i, mots: ['creditmutuel'], tokens: ['cic'], dom: ['creditmutuel.fr', 'cmb.fr', 'cic.fr', 'cmso.com'] },
    { id: 'boursorama', nom: 'Boursorama / BoursoBank', cat: 'banque', re: /boursorama|boursobank/i, mots: ['boursorama', 'boursobank'], tokens: [], dom: ['boursorama.fr', 'boursorama.com', 'boursobank.com'] },
    { id: 'hsbc', nom: 'HSBC', cat: 'banque', re: /\bhsbc\b/i, mots: [], tokens: ['hsbc'], dom: ['hsbc.fr', 'hsbc.com'] },
    { id: 'revolut', nom: 'Revolut', cat: 'banque', re: /revolut/i, mots: ['revolut'], tokens: [], dom: ['revolut.com'] },
    { id: 'binance', nom: 'Binance / Coinbase', cat: 'banque', re: /binance|coinbase/i, mots: ['binance', 'coinbase'], tokens: [], dom: ['binance.com', 'coinbase.com'] },
    { id: 'cyberbalise', nom: 'CyberBalise', cat: 'plateforme', re: /cyberbalise/i, mots: ['cyberbalise'], tokens: [], dom: ['cyberbalise.fr'] }
  ];

  /* Mots d'appât fréquents dans les faux domaines (utilisés pour qualifier un « domaine sosie »). */
  var MOTS_APPAT = ['secure', 'securite', 'verif', 'verify', 'login', 'signin', 'suivi', 'facture', 'paiement', 'payment', 'regul', 'connexion', 'compte', 'account', 'support', 'service', 'update', 'confirm', 'livraison', 'delivery', 'redelivery', 'remboursement', 'refund', 'actualisation', 'reactivation', 'billing', 'espace'];

  /* ------------------------------------------------------------------
   * Liens : raisons (codes énumérés) et leur gravité
   *   niveau 1 : indice faible ; 2 : indice net ; 3 : incohérence critique
   * ------------------------------------------------------------------ */
  var LIEN_RAISONS = {
    LIEN_RACCOURCI: { niveau: 1, libelle: 'Lien raccourci qui cache la vraie destination', explication: 'Un lien raccourci masque l\'adresse réelle du site : impossible de savoir où il mène avant de cliquer.' },
    TLD_RISQUE: { niveau: 1, libelle: 'Extension d\'adresse très utilisée par les sites frauduleux', explication: 'Certaines extensions (.top, .xyz, .info, .click…) sont bon marché et très utilisées pour les faux sites. Ce n\'est pas une preuve, mais un indice.' },
    TIRETS_MULTIPLES: { niveau: 1, libelle: 'Nom de domaine à rallonge avec plusieurs tirets', explication: 'Les faux sites empilent des mots (« suivi-livraison-colis ») pour paraître officiels.' },
    PORT_INHABITUEL: { niveau: 1, libelle: 'Adresse avec un numéro de port inhabituel', explication: 'Un site ordinaire n\'indique jamais de numéro de port dans son adresse.' },
    IP_BRUTE: { niveau: 2, libelle: 'Adresse IP au lieu d\'un nom de site', explication: 'Les organismes sérieux utilisent un nom de site, pas une suite de chiffres.' },
    PUNYCODE: { niveau: 2, libelle: 'Adresse avec caractères spéciaux (technique d\'homographe)', explication: 'Des caractères d\'autres alphabets, ressemblant à des lettres latines, permettent de fabriquer une adresse qui paraît identique à l\'officielle.' },
    MARQUE_TIERS: { niveau: 3, libelle: 'Le nom d\'une marque apparaît dans une adresse qui n\'est pas la sienne', explication: 'Cette adresse reprend le nom de l\'organisme (parfois avec un chiffre à la place d\'une lettre) sans être son adresse officielle : c\'est la technique du « domaine sosie ».' },
    SOUS_DOMAINE_TROMPEUR: { niveau: 3, libelle: 'L\'adresse officielle est placée devant un autre domaine', explication: 'Seule la dernière partie d\'une adresse compte : dans « amazon.fr.secure-login.top », le site réel est « secure-login.top », pas Amazon.' },
    USERINFO: { niveau: 3, libelle: 'Faux identifiant placé devant l\'adresse (avant le « @ »)', explication: 'Dans « https://amazon.fr@evil.top », ce qui précède le « @ » est ignoré : le site réel est « evil.top ».' }
  };

  var LIBELLES_NIVEAUX = { 0: 'Aucun signal détecté', 1: 'Signaux faibles', 2: 'Message suspect', 3: 'Arnaque probable' };
  var NIVEAUX_ANALYTIQUES = { 0: 'aucun', 1: 'faible', 2: 'suspect', 3: 'probable' };

  /* Limites : ce que l'outil ne peut pas vérifier. Le moteur retient celles qui s'appliquent. */
  var LIMITES = {
    age_domaine: 'L\'âge et la réputation du site derrière chaque lien : un site créé il y a quelques jours est un signal fort, qu\'une analyse du texte seul ne peut pas mesurer.',
    page_destination: 'Le contenu de la page de destination : seul le texte de l\'adresse est examiné, jamais la page elle-même.',
    authenticite_expediteur: 'Que le message vienne vraiment de l\'expéditeur affiché : un nom, un numéro ou une adresse peuvent être usurpés.',
    controles_email: 'Les contrôles techniques de l\'e-mail (SPF, DKIM, DMARC), faute d\'en-têtes complets : collez le message brut pour qu\'ils soient lus.',
    expediteur_absent: 'L\'expéditeur, non renseigné : un numéro ou une adresse incohérents sont parmi les indices les plus fiables.',
    pieces_jointes: 'Les pièces jointes et les images, qui ne sont pas analysées.',
    texte_tronque: 'La fin du message, au-delà de la longueur analysée.'
  };

  /* Libellés des incohérences vérifiables (produites par le moteur, pas par des motifs). */
  var INCOHERENCES = {
    EXPEDITEUR_USURPE: { force: 'forte', libelle: 'Le nom affiché évoque une marque, mais l\'adresse vient d\'ailleurs', explication: 'Le nom d\'un expéditeur s\'écrit librement : n\'importe qui peut afficher « {marque} ». Seul le domaine après le @ compte, et « {domaine} » n\'est pas un domaine habituel de cet organisme.', fiche: 'phishing' },
    DOMAINE_SOSIE: { force: 'critique', libelle: 'Domaine « sosie » qui imite une marque', explication: 'Le domaine « {domaine} » reprend le nom de « {marque} » sans être son adresse officielle (tirets, extension inhabituelle, lettres remplacées par des chiffres…).', fiche: 'phishing' },
    LIEN_MARQUE_TIERS: { force: 'critique', libelle: 'Lien vers un domaine sosie', explication: 'Le lien mène à « {domaine} », une adresse qui reprend le nom de « {marque} » sans lui appartenir.', fiche: 'phishing' },
    LIEN_TROMPEUR: { force: 'critique', libelle: 'Lien dont l\'adresse réelle est dissimulée', explication: 'L\'adresse « {domaine} » est construite pour ressembler à une adresse officielle : le site réel n\'est pas celui que l\'on croit.', fiche: 'phishing' },
    LIEN_NON_OFFICIEL: { force: 'forte', libelle: 'Le message se réclame d\'une marque, mais le lien mène ailleurs', explication: 'Le texte parle de {marque}, mais le lien pointe vers « {domaine} », qui n\'est pas une adresse habituelle de cet organisme.', fiche: 'phishing' },
    EXPEDITEUR_INCOHERENT: { force: 'forte', libelle: 'Le message se réclame d\'une marque, mais l\'expéditeur est un autre domaine', explication: 'Le texte parle de {marque}, mais l\'adresse d\'envoi (« {domaine} ») n\'est pas la sienne. Un vrai message d\'un organisme arrive de son propre domaine.', fiche: 'phishing' },
    WEBMAIL_OFFICIEL: { force: 'forte', libelle: 'Adresse de messagerie grand public pour un message « officiel »', explication: 'Un organisme, une banque ou un transporteur n\'écrit pas depuis une adresse gratuite ({domaine}) : elle se crée en une minute.', fiche: 'phishing' },
    MOBILE_ORDINAIRE: { force: 'forte', libelle: 'Numéro de mobile ordinaire pour un message « officiel »', explication: 'Une administration, une banque ou un transporteur n\'envoie pas ses messages depuis un 06 ou un 07 : ce sont des numéros de particuliers.', fiche: 'sms' },
    NUMERO_ETRANGER_OFFICIEL: { force: 'forte', libelle: 'Numéro étranger pour un message « officiel »', explication: 'Ce numéro commence par un indicatif étranger ({numero}). Les organismes français écrivent depuis des numéros français ou des numéros courts.', fiche: 'sms' },
    AUTHENTIFICATION_ECHEC: { force: 'forte', libelle: 'Les contrôles techniques de l\'e-mail ont échoué', explication: 'Les en-têtes indiquent un échec de vérification ({controles}) : l\'expéditeur n\'est pas authentifié pour ce domaine.', fiche: 'phishing' },
    REPONSE_DIVERGENTE: { force: 'forte', libelle: 'L\'adresse de réponse diffère de l\'adresse d\'envoi', explication: 'Les réponses partiraient vers « {domaine} », un autre domaine que l\'expéditeur affiché : technique courante pour récupérer vos réponses.', fiche: 'phishing' },
    IDN_EXPEDITEUR: { force: 'forte', libelle: 'Domaine d\'expédition avec caractères spéciaux (homographe)', explication: 'Certains caractères d\'autres alphabets ressemblent à des lettres latines et permettent de fabriquer une adresse qui paraît identique à l\'officielle.', fiche: 'phishing' }
  };

  /* ------------------------------------------------------------------
   * Règles de détection
   *  categorie : 'manipulation' (comportement typique d'une arnaque)
   *              'contexte' (thème fréquent, y compris dans les messages légitimes : jamais concluant seul)
   * ------------------------------------------------------------------ */
  var REGLES = [
    /* ===== Manipulation (français) ===== */
    {
      id: 'urgence', categorie: 'manipulation', poids: 2, portee: ['corps', 'objet'],
      libelle: 'Urgence ou délai très court',
      motifs: [
        /\burgent(e|es|s)?\b/i, /\ben urgence\b/i, /\bimmediat(e|ement)?\b/i,
        /\bsous \d{1,2} ?(h|heures?|jours?)\b/i, /\bdans les \d{1,2} ?(h|heures?|jours?)\b/i,
        /\bavant (ce soir|demain|minuit|\d{1,2} ?h)\b/i, /\bdernier (rappel|avertissement|avis|delai)\b/i,
        /\bsans reponse de votre part\b/i, /\baujourd'hui (meme|avant)\b/i, /\bau plus vite\b/i,
        /\bexpire(ra)? (aujourd'hui|ce soir|demain|bientot)\b/i, /\b(places?|offre) limitee?s?\b/i, /\bderniere chance\b/i,
        /\b(final|last) (notice|warning|reminder)\b/i, /\bwithin \d{1,2} ?(hours?|hrs?|days?)\b/i,
        /\b(act|respond|reply) now\b/i, /\bexpires? (today|tonight|soon)\b/i
      ],
      explication: 'Créer l\'urgence empêche de réfléchir : c\'est le ressort numéro un des arnaques. Un vrai organisme laisse le temps de vérifier.',
      action: 'Prenez le temps de vérifier par un autre canal avant d\'agir.', fiche: 'phishing',
      tests: {
        positifs: ['Régularisez sous 48 h', 'Dernier rappel avant poursuites', 'URGENT : action requise', 'Votre dossier doit être traité avant ce soir', 'Final notice: respond now', 'Offre limitée, places limitées'],
        negatifs: ['Votre colis sera livré demain entre 9h et 12h.', 'Le code expire dans 10 minutes.', 'À bientôt pour la suite du projet.']
      }
    },
    {
      id: 'menace_blocage', categorie: 'manipulation', poids: 3, portee: ['corps', 'objet'],
      libelle: 'Menace de blocage, de suspension ou de clôture',
      motifs: [
        /\b(compte|carte|ligne|acces|abonnement|dossier|forfait|colis|allocations?|droits?|espace)\b[^.\n]{0,45}\b(sera|seront|va etre|vont etre|est|a ete|ont ete|sont)\b[^.\n]{0,14}\b(suspendu(e|es|s)?|bloque(e|es|s)?|desactive(e|es|s)?|resilie(e|es|s)?|cloture(e|es|s)?|annule(e|es|s)?|limite(e|es|s)?|verrouille(e|es|s)?|supprime(e|es|s)?|retenu(e|es|s)?|clos)\b/i,
        /\b(suspension|blocage|cloture|resiliation|desactivation) (de|du|d') ?(votre|vos|l'|la|le)\b/i,
        /\bevitez? (la |une |le |des )?(suspension|blocage|cloture|amende|poursuites|majoration)\b/i,
        /\brisque[zr]? (de )?(suspension|blocage|poursuites|perdre)\b/i,
        /\b(faute|a defaut) de (paiement|reglement|reponse|regularisation)\b/i
      ],
      explication: 'Faire peur (compte bloqué, ligne coupée, dossier clôturé) pousse à agir sans vérifier. Les vrais organismes ne menacent pas par message avec un lien à suivre.',
      action: 'Ne suivez pas le lien : ouvrez vous-même l\'application ou le site officiel.', fiche: 'sms',
      tests: {
        positifs: ['Votre compte bancaire sera suspendu.', 'Votre forfait mobile sera résilié aujourd\'hui.', 'Évitez la suspension de votre accès.', 'Votre compte formation CPF est suspendu.'],
        negatifs: ['Votre compte a été créé avec succès.', 'Votre colis a été livré hier.', 'Le dossier sera examiné lundi.']
      }
    },
    {
      id: 'menace_autorite', categorie: 'manipulation', poids: 3, portee: ['corps', 'objet'],
      libelle: 'Menace de poursuites, d\'amende ou de convocation',
      motifs: [
        /\bconvocation\b/i, /\bhuissier\b/i, /\bpoursuites? (judiciaires?|penales?)\b/i, /\bmajoration\b/i,
        /\bamende (forfaitaire |majoree )?(de \d+|est en attente|impayee|en attente)\b/i,
        /\b(gendarmerie|police nationale|parquet|tribunal)\b[^.\n]{0,40}\b(plainte|convoqu|poursuite|affaire|dossier)\b/i,
        /\b(plainte|poursuites?) (sera|seront|va|vont) (etre )?(deposee?s?|engagee?s?|lancee?s?)\b/i
      ],
      explication: 'Les administrations n\'envoient pas de menaces de poursuites ou d\'amende assorties d\'un lien de paiement par SMS ou par e-mail.',
      action: 'Ne payez rien depuis le message : vérifiez sur le site officiel de l\'administration.', fiche: 'sms',
      tests: {
        positifs: ['Une amende de 35 € est en attente.', 'Un huissier a été mandaté pour votre dossier.', 'Vous recevrez une convocation sous peu.'],
        negatifs: ['Pensez à votre rendez-vous de mardi.', 'La police municipale a distribué des flyers.']
      }
    },
    {
      id: 'code_transmission', categorie: 'manipulation', poids: 5, portee: ['corps', 'objet'],
      libelle: 'Demande de code, de mot de passe ou de validation',
      motifs: [
        /\b(communiqu|donn|envoy|transmet|fourni|saisi|indiqu|repond|dict|lisez|partag)[a-z]*\b[^.\n]{0,35}\b(code|mot de passe|mdp|identifiants?|cryptogramme|pin)\b/i,
        /\bcode (recu|envoye)\b[^.\n]{0,25}\b(par sms|par mail|par e-mail|ci-dessous)\b/i,
        /\bcode (de )?(confirmation|validation|securite|verification)\b[^.\n]{0,40}\b(en reponse|par retour|a nous (communiquer|transmettre))\b/i
      ],
      explication: 'Votre banque, un service client ou l\'administration ne vous demanderont jamais un code, un mot de passe ou la validation d\'une opération par message ou par téléphone.',
      action: 'Ne communiquez aucun code. S\'il s\'agit de votre banque, raccrochez et rappelez le numéro figurant au dos de votre carte.', fiche: 'paiement',
      tests: {
        positifs: ['Envoyez-nous le code reçu par SMS pour valider.', 'Communiquez votre mot de passe au conseiller.', 'Veuillez saisir votre code de confirmation ici.'],
        negatifs: ['Votre code de confirmation est 482913.', 'Ne communiquez jamais votre code de confirmation.', 'Il expire dans 10 minutes. Ne le communiquez à personne.']
      }
    },
    {
      id: 'coordonnees_bancaires', categorie: 'manipulation', poids: 4, portee: ['corps', 'objet'],
      libelle: 'Demande de coordonnées bancaires ou de données de carte',
      motifs: [
        /\b(confirm|mett|actualis|verifi|renseign|saisi|fourni|communiqu|transmet|envoy)[a-z]*\b[^.\n]{0,25}\b(coordonnees|informations|donnees|details)\b[^.\n]{0,10}\b(bancaires?|de paiement|de carte)\b/i,
        /\bcryptogramme\b|\bcvv2?\b|\bcvc2?\b/i,
        /\bdate d'expiration\b[^.\n]{0,15}\bcarte\b/i,
        /\b(mettre|mettez) a jour (votre |vos )?(moyen de paiement|carte bancaire|rib|iban)\b/i,
        /\bmoyen de paiement\b[^.\n]{0,20}\b(a mettre a jour|invalide|refuse|echoue)\b/i,
        /\bnumero de (votre )?carte\b/i
      ],
      explication: 'Un message non sollicité qui demande de saisir vos données de carte ou vos coordonnées bancaires est suspect par principe. Payez uniquement depuis le site ou l\'application officiels, ouverts par vous-même.',
      action: 'Ne saisissez aucune donnée bancaire. Si vous l\'avez fait, faites opposition immédiatement.', fiche: 'paiement',
      tests: {
        positifs: ['Confirmez vos coordonnées bancaires sur le lien.', 'Saisissez le cryptogramme de votre carte.', 'Mettez à jour votre moyen de paiement.'],
        negatifs: ['Nos coordonnées bancaires figurent en bas du devis.', 'Votre carte a été utilisée chez CARREFOUR.']
      }
    },
    {
      id: 'paiement_demande', categorie: 'manipulation', poids: 3, portee: ['corps', 'objet'],
      libelle: 'Demande de paiement ou de frais à régler',
      motifs: [
        /\b(reglez|payez|acquittez|regularisez)(-les|-le|-la)?\b/i,
        /\bfrais\b[^.\n]{0,25}\b(a regler|a payer|impayes?|manquants?|restant|supplementaires?|requis|en attente)\b/i,
        /\bfaute de frais\b/i,
        /\b(regler|payer|acquitter)\b[^.\n]{0,20}\b(maintenant|en ligne|ici|ci-dessous|sous)\b/i
      ],
      explication: 'Un message non sollicité qui réclame un petit paiement (frais de port, de douane, amende) sert à récupérer votre numéro de carte, pas à vous faire payer 1,99 €.',
      action: 'Ne payez rien depuis ce message : vérifiez sur le site officiel du transporteur ou de l\'organisme.', fiche: 'paiement',
      tests: {
        positifs: ['Réglez-les sous 24h', 'Payez votre amende en ligne', 'Des frais de réexpédition restent à régler', 'Régularisez votre situation'],
        negatifs: ['Le règlement s\'effectue par virement à 30 jours.', 'Votre carte a été utilisée 12,90 € chez CARREFOUR.', 'Paiement de 54,20 € chez FNAC.']
      }
    },
    {
      id: 'faux_conseiller', categorie: 'manipulation', poids: 3, portee: ['corps', 'objet'],
      libelle: 'Faux conseiller ou « opération suspecte » à annuler',
      motifs: [
        /\boperations? (suspecte|frauduleuse|inhabituelle|non autorisee|douteuse)\b/i,
        /\b(service|cellule|equipe|departement) (anti[- ]?)?fraudes?\b/i,
        /\bactivite (suspecte|inhabituelle|anormale)\b/i,
        /\btentative (de (paiement|connexion|fraude|virement|debit)|d'acces)\b/i,
        /\bsecuris(er|ez) (votre|vos) (compte|fonds|argent|epargne|avoirs)\b/i,
        /\bvirement de securite\b/i, /\bcompte (de )?securite\b/i,
        /\bconseill?er (bancaire|de votre banque|securite)\b/i, /\bpaiement (frauduleux|suspect)\b/i
      ],
      explication: 'Le faux conseiller bancaire signale une « opération suspecte » pour vous faire valider… une opération frauduleuse. Raccrochez et rappelez votre banque au numéro habituel.',
      action: 'Ne validez rien. Rappelez votre banque au numéro figurant au dos de votre carte.', fiche: 'paiement',
      tests: {
        positifs: ['Une opération suspecte de 489 € a été détectée.', 'Je suis conseiller bancaire de votre banque.', 'Vous êtes victime d\'une tentative de paiement.'],
        negatifs: ['Si vous ne reconnaissez pas cette opération, contactez votre banque.', 'Votre conseiller vous recevra mardi.']
      }
    },
    {
      id: 'validation_operation', categorie: 'manipulation', poids: 4, portee: ['corps', 'objet'],
      libelle: 'Demande de valider ou d\'annuler une opération',
      motifs: [
        /\b(valid(er|ez)|annul(er|ez)|confirm(er|ez)|bloqu(er|ez)|contest(er|ez))\b[^.\n]{0,25}\b(operation|virement|paiement|transaction|prelevement)\b/i,
        /\bcode (recu|envoye) par (sms|mail|e-mail|courriel)\b/i,
        /\bpour (l'annuler|annuler|la bloquer|le bloquer)\b/i
      ],
      explication: 'Valider ou annuler une « opération » à la demande d\'un message ou d\'un appel est le cœur de la fraude au faux conseiller : c\'est vous qui autorisez le vol.',
      action: 'Ne validez aucune opération sur demande. Contactez votre banque par le numéro habituel.', fiche: 'paiement',
      tests: {
        positifs: ['Validez l\'opération avec le code reçu par SMS.', 'Rappelez-nous pour annuler l\'opération.', 'Appelez vite pour l\'annuler.'],
        negatifs: ['Votre virement a été validé hier.', 'L\'opération s\'est bien déroulée.']
      }
    },
    {
      id: 'prise_en_main', categorie: 'manipulation', poids: 4, portee: ['corps', 'objet'],
      libelle: 'Demande d\'installer un logiciel ou de prendre la main à distance',
      motifs: [
        /\b(anydesk|teamviewer|quicksupport|ultraviewer|rustdesk|splashtop|logmein|ammyy)\b/i,
        /\bprises? en main( a distance)?\b/i,
        /\b(prend(re|ra)|prenne) (la|le) (main|controle)( a distance)?\b/i,
        /\b(controle|acces) (a distance|distant)\b/i,
        /\binstall(er|ez) (l'application|le logiciel|ce programme|cette application)\b/i,
        /\bremote (access|control|session)\b/i
      ],
      explication: 'Aucun support technique légitime ne vous demande d\'installer un logiciel de prise en main à distance à la suite d\'une alerte ou d\'un appel non sollicité.',
      action: 'N\'installez rien et ne rappelez pas. Si vous l\'avez fait, déconnectez l\'appareil d\'Internet et changez vos mots de passe.', fiche: 'support',
      tests: {
        positifs: ['Un technicien prendra la main à distance avec AnyDesk.', 'Installez le logiciel de prise en main.', 'Remote access required.'],
        negatifs: ['La main courante est à jour.', 'Installez-vous confortablement.']
      }
    },
    {
      id: 'alerte_virus', categorie: 'manipulation', poids: 3, portee: ['corps', 'objet'],
      libelle: 'Fausse alerte de virus ou de piratage',
      motifs: [
        /\b(ordinateur|appareil|telephone|pc|mac|systeme|navigateur)\b[^.\n]{0,25}\b(infecte|pirate|compromis|contamine|attaque|bloque)\b/i,
        /\bvirus (detecte|trouve|critique)\b/i,
        /\b(trojan|malware|spyware|ransomware|logiciel malveillant) (detecte|trouve)\b/i,
        /\bsupport (technique )?(microsoft|apple|windows|google|norton|mcafee)\b/i,
        /\bn'(eteignez|eteindre|fermez|redemarrez) (pas|plus)\b/i
      ],
      explication: 'Aucun éditeur ne vous alerte d\'un virus par une fenêtre ou un message avec un numéro à appeler : c\'est le scénario du faux support technique.',
      action: 'Ne rappelez pas le numéro. Fermez la page et lancez un antivirus de confiance.', fiche: 'support',
      tests: {
        positifs: ['ALERTE : votre ordinateur est infecté par un virus.', 'Appelez le support Microsoft.', 'N\'éteignez pas votre ordinateur.'],
        negatifs: ['Votre téléphone est en charge.', 'Le support technique est ouvert du lundi au vendredi.']
      }
    },
    {
      id: 'chantage', categorie: 'manipulation', poids: 4, portee: ['corps', 'objet'],
      libelle: 'Chantage ou menace de divulgation',
      motifs: [
        /\b(votre|ta|ton) (webcam|camera)\b[^.\n]{0,30}\b(controle|acces|enregistr|film|pirat)/i,
        /\b(video|photo)s? (intimes?|compromettantes?)\b/i,
        /\bj'ai (pris|obtenu) (le controle|l'acces|acces)\b/i,
        /\bvos contacts (recevront|vont recevoir)\b/i,
        /\b(diffus|envoy|publi)[a-z]*\b[^.\n]{0,40}\b(a tous vos contacts|a vos contacts|a votre famille|a vos amis|a vos collegues)\b/i,
        /\b(your )?webcam\b[^.\n]{0,30}\b(recorded|hacked)\b/i, /\bcompromising (video|photos?|footage)\b/i
      ],
      explication: 'Les e-mails de chantage (« je vous ai filmé via votre webcam ») sont presque toujours du bluff envoyé en masse. Ne payez pas et ne répondez pas.',
      action: 'Ne payez pas, ne répondez pas, changez vos mots de passe et signalez le message.', fiche: 'chantage',
      tests: {
        positifs: ['J\'ai pris le contrôle de votre webcam.', 'Une vidéo compromettante de vous.', 'Vos contacts recevront cette vidéo.'],
        negatifs: ['La webcam de mon ordinateur fonctionne très bien.', 'Photos de vacances en pièce jointe.']
      }
    },
    {
      id: 'rendement_garanti', categorie: 'manipulation', poids: 4, portee: ['corps', 'objet'],
      libelle: 'Promesse de gain garanti ou d\'investissement miracle',
      motifs: [
        /\brendements? (garantis?|assures?|eleves?|exceptionnels?)\b/i, /\bsans risques?\b/i,
        /\bdoubl(er|ez|e) (votre|vos|le) (capital|argent|mise|investissement|gains?)\b/i,
        /\b\d{1,3} ?% (par|en|chaque) (jour|semaine|mois)\b/i, /\bgains? (garantis?|assures?|rapides?)\b/i,
        /\bcapital (garanti|protege)\b/i, /\binvestissez? (des maintenant|maintenant)\b/i, /\bopportunite unique\b/i,
        /\b(guaranteed|risk-free) (returns?|profits?)\b/i
      ],
      explication: 'Un rendement élevé « sans risque » est le signe le plus sûr d\'une arnaque. Vérifiez toujours que la plateforme figure sur les listes de l\'AMF.',
      action: 'N\'investissez rien. Vérifiez la plateforme sur les listes noires de l\'AMF.', fiche: 'invest',
      tests: {
        positifs: ['Rendement garanti de 18 % par mois', 'Doublez votre capital en 30 jours.', 'Placement sans risque'],
        negatifs: ['Le rendement du livret A est fixé par l\'État.', 'Les risques sont expliqués dans la notice.']
      }
    },
    {
      id: 'remboursement_gain', categorie: 'manipulation', poids: 2, portee: ['corps', 'objet'],
      libelle: 'Remboursement, gain ou cadeau inattendu',
      motifs: [
        /\bvous avez droit a un rembours[a-z]*/i,
        /\brembours[a-z]*\b[^.\n]{0,40}\b(en attente|disponible|vous (attend|revient|est du))\b/i,
        /\btrop[- ]?percu\b/i, /\bvous avez gagne\b/i,
        /\bfelicitations\b[^.\n]{0,60}\b(gagn|selectionn|tire au sort|lot|cadeau)/i,
        /\b(selectionne|tire au sort)\b/i,
        /\b(credit d'impot|aide exceptionnelle|prime exceptionnelle|prime energie|bon d'achat offert)\b/i,
        /\b(gift ?card|carte cadeau)\b/i, /\bcongratulations\b/i, /\byou (have )?(won|been selected)\b/i,
        /\bclaim your (prize|reward|gift|refund)\b/i, /\b(tax|hmrc|irs) (refund|rebate)\b/i
      ],
      explication: 'Un remboursement ou un gain que vous n\'attendiez pas sert d\'appât pour obtenir vos coordonnées bancaires.',
      action: 'Ne répondez pas et ne cliquez pas : un vrai remboursement passe par votre espace officiel.', fiche: 'phishing',
      tests: {
        positifs: ['Vous avez droit à un remboursement de 312,40 €.', 'Félicitations, vous avez gagné un lot !', 'Votre remboursement est en attente.', 'Claim your prize now.'],
        negatifs: ['Tu me rembourseras plus tard.', 'Le remboursement a été effectué ce matin.']
      }
    },
    {
      id: 'nouveau_numero', categorie: 'manipulation', poids: 3, portee: ['corps'],
      libelle: 'Proche qui change de numéro ou de téléphone',
      motifs: [
        /\bmon nouveau (numero|portable|telephone|tel)\b/i,
        /\b(c'est|voici|ceci est|ci[- ]joint) (mon|ma) nouveau/i,
        /\bj'ai (change|perdu|casse) (de )?(numero|telephone|portable)\b/i,
        /\bmon (telephone|portable|tel) (est |a ete |vient d'etre )?(casse|perdu|vole|tombe|hs|en panne|hors service)\b/i,
        /\bje (change|viens de changer) de numero\b/i,
        /\bnouveau numero\b[^.\n]{0,20}\b(enregistre|sauvegard|ajoute)/i
      ],
      explication: 'Le message « c\'est mon nouveau numéro » d\'un faux proche est l\'ouverture classique d\'une arnaque : la demande d\'argent vient ensuite.',
      action: 'Appelez votre proche sur son ancien numéro, ou posez une question dont seul lui connaît la réponse.', fiche: 'sms',
      tests: {
        positifs: ['C\'est mon nouveau numéro, enregistre-le.', 'Mon téléphone est cassé.', 'Voici mon nouveau numéro.'],
        negatifs: ['Le nouveau numéro de la mairie est affiché à l\'entrée.', 'Mon téléphone est en charge.']
      }
    },
    {
      id: 'virement_urgent', categorie: 'manipulation', poids: 4, portee: ['corps', 'objet'],
      libelle: 'Demande de virement urgent',
      motifs: [
        /\bvirement (urgent|immediat|confidentiel|express)\b/i,
        /\b(effectu(er|ez|iez)|faire|fassiez|realis(er|ez)) (un|le) virement\b[^.\n]{0,40}\b(urgent|immediat|aujourd'hui|ce jour|avant)\b/i,
        /\bvirement\b[^.\n]{0,40}\b(urgent|urgence|immediat)/i,
        /\bj'ai besoin que vous (effectuiez|fassiez|realisiez) (un|le) virement\b/i,
        /\burgent(ly)? wire\b/i, /\b(wire|transfer) (the )?(funds|money|payment)\b[^.\n]{0,30}\b(urgent|immediately|today|asap)\b/i
      ],
      explication: 'Un virement « urgent » demandé par message, souvent au nom d\'un dirigeant, est le schéma de la fraude au président.',
      action: 'Ne faites aucun virement : vérifiez la demande par un autre canal avec la personne concernée.', fiche: 'president',
      tests: {
        positifs: ['Effectuez un virement urgent de 24 500 €.', 'Je souhaite un virement immédiat.', 'Wire the funds immediately.'],
        negatifs: ['Le règlement s\'effectue par virement à 30 jours.', 'Virement reçu, merci.']
      }
    },
    {
      id: 'confidentialite', categorie: 'manipulation', poids: 3, portee: ['corps', 'objet'],
      libelle: 'Demande de garder le secret',
      motifs: [
        /\b(reunion|operation|dossier|affaire|transaction|virement|mission) confidentiel(le)?\b/i,
        /\bne (en )?(parlez|dites|dis|parle|dit)\b[^.\n]{0,40}\b(a personne|a quiconque)\b/i,
        /\bgardez (ca|cela|ceci) (secret|pour vous)\b/i, /\bentre nous\b/i, /\bnotre secret\b/i
      ],
      explication: 'Demander de ne rien dire à personne isole la victime de ceux qui pourraient la prévenir : c\'est un ressort classique de la fraude au président et du faux proche.',
      action: 'Parlez-en autour de vous avant d\'agir : une demande légitime supporte la vérification.', fiche: 'president',
      tests: {
        positifs: ['Ne parlez de cette opération à personne.', 'Je suis en réunion confidentielle.', 'Gardez cela secret.'],
        negatifs: ['Ce message est confidentiel et destiné à son destinataire.', 'Nous en parlons demain en équipe.']
      }
    },
    {
      id: 'changement_rib', categorie: 'manipulation', poids: 4, portee: ['corps', 'objet'],
      libelle: 'Changement de RIB ou de coordonnées bancaires',
      motifs: [
        /\b(nouveau|nouvelle|nouveaux|nouvelles|changement de|modification de|mise a jour (de|du|des)) (rib|iban|coordonnees bancaires)\b/i,
        /\bchang(e|ement)[a-z]* (de )?(rib|iban|banque)\b/i, /\bvers (un|le) (nouveau )?(rib|iban)\b/i
      ],
      explication: 'Un changement de RIB annoncé par message est la technique centrale de la fraude au faux fournisseur et au faux dirigeant.',
      action: 'Confirmez tout changement de RIB par un appel au numéro que vous connaissez déjà.', fiche: 'president',
      tests: {
        positifs: ['Merci de virer vers un nouveau RIB.', 'Voici nos nouvelles coordonnées bancaires.', 'Changement de RIB à effectuer.'],
        negatifs: ['Veuillez trouver notre RIB en pièce jointe.', 'Nos coordonnées bancaires figurent sur le devis.']
      }
    },
    {
      id: 'verification_identite', categorie: 'manipulation', poids: 3, portee: ['corps', 'objet'],
      libelle: 'Demande de vérifier ou de mettre à jour son compte ou ses informations',
      motifs: [
        /\b(verifi|confirm|mett|actualis|regularis|renseign|valid)[a-z]*\b[^.\n]{0,25}\b(votre|vos) (identite|compte|acces|dossier|situation|informations|donnees|coordonnees|adresse|carte vitale|profil|abonnement)\b/i,
        /\b(nouvelle|inhabituelle|suspecte) connexion\b/i,
        /\bconnexion (inhabituelle|suspecte|detectee|non reconnue)\b/i,
        /\bactivite (du compte|de votre compte)\b/i
      ],
      explication: 'Demander de « confirmer », de « mettre à jour » ou de « vérifier » vos informations par un lien est la méthode de base de l\'hameçonnage.',
      action: 'N\'utilisez pas le lien : connectez-vous en tapant vous-même l\'adresse du site officiel.', fiche: 'phishing',
      tests: {
        positifs: ['Mettez à jour vos informations sous 48 h.', 'Une nouvelle connexion a été détectée sur votre espace.', 'Confirmez votre identité.'],
        negatifs: ['Merci de votre confiance.', 'Votre dossier est complet.']
      }
    },
    {
      id: 'faux_livreur', categorie: 'manipulation', poids: 3, portee: ['corps', 'objet'],
      libelle: 'Faux problème de livraison',
      motifs: [
        /\b(livreur|facteur|transporteur|chauffeur)\b[^.\n]{0,45}\b(tente|essaye|passe|repasse|repasser|joindre|contacte|absent|echoue)\b/i,
        /\bje repasse\b/i,
        /\bcolis (retenu|bloque|suspendu|en souffrance|en attente de (paiement|reglement|confirmation))\b/i,
        /\b(adresse|creneau)\b[^.\n]{0,25}\b(incomplete|invalide|erronee|a confirmer)\b/i,
        /\b(reprogramm|replanif)[a-z]*\b[^.\n]{0,20}\b(livraison|colis|passage)\b/i,
        /\bn'a pas pu etre (livre|delivre|remis)(e|es|s)?\b/i
      ],
      explication: 'Le faux problème de livraison (colis retenu, adresse incomplète, livreur qui « repasse ») est l\'un des SMS frauduleux les plus répandus : le but est de récupérer votre carte bancaire.',
      action: 'Suivez votre colis depuis le site du transporteur, en tapant vous-même son adresse.', fiche: 'sms',
      tests: {
        positifs: ['Votre colis n\'a pas pu être livré.', 'Le livreur a tenté de vous joindre, je repasse demain.', 'Reprogrammez votre livraison.', 'Colis retenu au dépôt.'],
        negatifs: ['Le livreur passera demain matin.', 'Votre colis a été livré hier.']
      }
    },
    {
      id: 'prix_symbolique', categorie: 'manipulation', poids: 3, portee: ['corps', 'objet'],
      libelle: 'Offre à prix symbolique ou dossier « pré-validé »',
      motifs: [
        /\b(a|pour) 1 ?(€|euros?)(?!\w)/i,
        /\b(gratuit|gratuite|gratuits|gratuites|sans reste a charge|sans frais)\b[^.\n]{0,30}\b(travaux|isolation|installation|dossier|renovation)\b/i,
        /\b(travaux|isolation|installation|renovation)\b[^.\n]{0,20}\b(gratuits?|gratuites?|sans reste a charge)\b/i,
        /\bdossier\b[^.\n]{0,30}\b(pre-?valide|accepte|eligible|approuve)\b/i
      ],
      explication: 'Les offres de travaux « à 1 € » ou « gratuits » et les dossiers « pré-validés » servent à récupérer vos coordonnées pour du démarchage frauduleux.',
      action: 'Ne rappelez pas : renseignez-vous sur le site officiel France Rénov\'.', fiche: 'sms',
      tests: {
        positifs: ['Isolation de vos combles à 1 € !', 'Dossier MaPrimeRénov\' pré-validé.', 'Travaux gratuits pour tous.'],
        negatifs: ['Un café à 1,20 € en terrasse.', 'Le dossier est incomplet.']
      }
    },
    {
      id: 'arnaque_annonce', categorie: 'manipulation', poids: 4, portee: ['corps', 'objet'],
      libelle: 'Faux acheteur ou faux locataire (chèque, trop-perçu, étranger)',
      motifs: [
        /\b(renvoy|rembours|retourn|restitu)[a-z]* (moi )?(la |le )?(difference|surplus|trop[- ]?percu|reste)\b/i,
        /\b(cheque|mandat)\b[^.\n]{0,30}\b(depot de garantie|caution|difference)\b/i,
        /\bje (suis|vis|travaille) a l'etranger\b/i,
        /\bdepot de garantie\b[^.\n]{0,30}\b(avance|envoy|vire)/i
      ],
      explication: 'Le faux acheteur ou locataire envoie un chèque trop élevé et demande de lui rembourser la différence, avant que le chèque ne soit rejeté.',
      action: 'N\'acceptez ni chèque ni mandat et ne remboursez jamais un trop-perçu avant encaissement définitif.', fiche: 'entre_particuliers',
      tests: {
        positifs: ['Merci de me renvoyer la différence par virement.', 'Je suis à l\'étranger pour mon travail.', 'Un chèque de dépôt de garantie vous sera envoyé.'],
        negatifs: ['La différence de prix est minime.', 'Nous habitons à Lyon.']
      }
    },
    {
      id: 'seed_phrase', categorie: 'manipulation', poids: 5, portee: ['corps', 'objet'],
      libelle: 'Demande de phrase secrète ou de clé privée',
      motifs: [/\b(seed|recovery|secret) (phrase|words?)\b/i, /\bprivate key\b/i, /\bphrase (secrete|de recuperation)\b/i, /\bcle privee\b/i],
      explication: 'Votre phrase de récupération ou votre clé privée donne un accès total à vos cryptomonnaies : aucun service légitime ne la demande jamais.',
      action: 'Ne la communiquez à personne. Si c\'est fait, déplacez vos fonds vers un nouveau portefeuille.', fiche: 'crypto',
      tests: {
        positifs: ['Enter your seed phrase to restore.', 'Envoyez votre phrase secrète.', 'Votre clé privée est requise.'],
        negatifs: ['Notez vos mots de passe en lieu sûr.', 'Le wallet est à jour.']
      }
    },

    /* ===== Manipulation (anglais) ===== */
    {
      id: 'en_verify_account', categorie: 'manipulation', poids: 3, portee: ['corps', 'objet'],
      libelle: 'Demande de vérifier son compte ou son identité (anglais)',
      motifs: [/\bverify (your|the|this) (account|identity|information|details|email|payment)\b/i, /\bconfirm your (identity|payment|details|information|account|password|email|address)\b/i, /\b(sign|log) ?in to (confirm|verify|review|restore|unlock|secure|update)\b/i],
      explication: 'Demander de « vérifier » ou de « confirmer » son compte par un lien est la méthode de base de l\'hameçonnage, dans toutes les langues.',
      action: 'N\'utilisez pas le lien : connectez-vous depuis l\'adresse officielle du service.', fiche: 'phishing',
      tests: {
        positifs: ['Verify your identity here.', 'Please confirm your payment details.', 'Sign in to confirm your account.'],
        negatifs: ['Your order has shipped.', 'We verified the numbers yesterday.']
      }
    },
    {
      id: 'en_account_status', categorie: 'manipulation', poids: 3, portee: ['corps', 'objet'],
      libelle: 'Menace sur le compte (anglais)',
      motifs: [/\b(account|apple id|icloud|paypal|netflix|amazon|microsoft|password|card)\b[^.\n]{0,15}\b(has been|will be|is|was|have been)\b[^.\n]{0,12}\b(suspended|limited|locked|disabled|restricted|compromised|deactivated|closed|expired|blocked)\b/i, /\bpassword (will )?(expires?|is expiring|has expired)\b/i],
      explication: 'Annoncer que votre compte est limité, bloqué ou sur le point d\'expirer est le message type de l\'hameçonnage.',
      action: 'Ne suivez pas le lien : ouvrez vous-même le site ou l\'application officiels.', fiche: 'phishing',
      tests: {
        positifs: ['Your account has been limited.', 'Your Apple ID has been locked.', 'Your password expires today.'],
        negatifs: ['Your account was created today.', 'The card is in my wallet.']
      }
    },
    {
      id: 'en_unusual_activity', categorie: 'manipulation', poids: 3, portee: ['corps', 'objet'],
      libelle: 'Fausse alerte d\'activité suspecte (anglais)',
      motifs: [/\b(unusual|suspicious|unauthori[sz]ed|irregular)\b[^.\n]{0,10}\b(activity|sign[- ]?in|log[- ]?in|transaction|access|attempt)\b/i, /\bsecurity (alert|notice|warning)\b/i],
      explication: 'Une « activité inhabituelle » annoncée par message sert à vous faire cliquer sur un faux lien de sécurisation.',
      action: 'Vérifiez l\'activité depuis le site officiel, jamais depuis le lien reçu.', fiche: 'phishing',
      tests: {
        positifs: ['Unusual activity has been detected.', 'Suspicious sign-in attempt.', 'Security alert for your account.'],
        negatifs: ['The weather was unusual today.', 'See you at the activity centre.']
      }
    },
    {
      id: 'en_delivery_failed', categorie: 'manipulation', poids: 3, portee: ['corps', 'objet'],
      libelle: 'Faux problème de livraison ou frais de douane (anglais)',
      motifs: [/\b(delivery|package|parcel|shipment)\b[^.\n]{0,40}\b(failed|could not be delivered|undeliverable|on hold|held|returned)\b/i, /\bdelivery attempt\b|\bredeliver(y)?\b|\bmissed (a )?delivery\b/i, /\b(customs|delivery|redelivery|shipping|handling|clearance|release) (fee|charge|duty|tax)s?\b/i],
      explication: 'Les faux messages de transporteur réclament de petits frais de douane ou de réexpédition pour récupérer votre carte bancaire.',
      action: 'Suivez le colis depuis le site officiel du transporteur.', fiche: 'sms',
      tests: {
        positifs: ['Your package could not be delivered.', 'A customs fee of £2.99 is required.', 'Redelivery is possible online.'],
        negatifs: ['Your order has shipped.', 'The parcel arrived on time.']
      }
    },
    {
      id: 'en_payment_issue', categorie: 'manipulation', poids: 3, portee: ['corps', 'objet'],
      libelle: 'Problème de paiement annoncé (anglais)',
      motifs: [/\b(payment|billing) (failed|declined|overdue|issue|problem)\b/i, /\boutstanding (balance|payment|invoice)\b/i, /\bupdate your (payment|billing)\b/i],
      explication: 'Un « problème de paiement » signalé par message sert à récupérer vos données de carte sur une fausse page.',
      action: 'Vérifiez votre moyen de paiement depuis votre compte, jamais depuis le lien.', fiche: 'paiement',
      tests: {
        positifs: ['Your payment failed.', 'Please update your billing information.', 'Outstanding balance due.'],
        negatifs: ['Payment received, thank you.', 'The billing department is open.']
      }
    },
    {
      id: 'en_generic_greeting', categorie: 'manipulation', poids: 1, portee: ['corps'],
      libelle: 'Formule d\'appel générique (anglais)',
      motifs: [/\bdear (customer|user|client|member|valued customer|account holder|sir|madam)\b/i],
      explication: 'Un message qui s\'adresse à « Dear customer » ne vous connaît pas : les vrais services utilisent votre nom. Ce n\'est qu\'un indice faible.',
      action: 'Soyez attentif aux autres éléments du message.', fiche: 'phishing',
      tests: {
        positifs: ['Dear customer, your account…', 'Dear user, hello.'],
        negatifs: ['Dear Sophie, thank you for your order.', 'Customer service is available.']
      }
    },
    {
      id: 'en_remote_support', categorie: 'manipulation', poids: 3, portee: ['corps', 'objet'],
      libelle: 'Appel à un faux support (anglais)',
      motifs: [/\bcall (us|this number|our (support|helpline))\b/i, /\bcontact (microsoft|apple) support\b/i, /\byour (computer|device|pc) (is|has been) (infected|compromised|blocked)\b/i],
      explication: 'Aucun éditeur ne vous demande d\'appeler un numéro depuis une alerte non sollicitée.',
      action: 'Ne rappelez pas et n\'installez aucun logiciel de prise en main.', fiche: 'support',
      tests: {
        positifs: ['Call this number now.', 'Contact Microsoft support.', 'Your computer is infected.'],
        negatifs: ['Call me when you arrive.', 'The device is charging.']
      }
    },

    /* ===== Contexte (thèmes fréquents, y compris dans les messages légitimes) ===== */
    {
      id: 'theme_livraison', categorie: 'contexte', poids: 1, portee: ['corps', 'objet'],
      libelle: 'Parle d\'un colis ou d\'une livraison',
      motifs: [/\b(colis|livraison|livreur|livre(e|es|s)?|expedition|expedie(e|es|s)?|point relais|parcel|package|delivery|shipment)\b/i],
      explication: 'Un colis ou une livraison est le thème de millions de messages légitimes : ce mot ne prouve rien. Ce sont les demandes de paiement ou le lien qui comptent.',
      action: 'Suivez votre colis depuis le site officiel du transporteur.', fiche: 'sms',
      tests: { positifs: ['Votre colis arrive demain.', 'Delivery tomorrow.'], negatifs: ['Merci pour votre visite.', 'Rendez-vous mardi.'] }
    },
    {
      id: 'theme_facture', categorie: 'contexte', poids: 1, portee: ['corps', 'objet'],
      libelle: 'Parle d\'une facture ou d\'un montant',
      motifs: [/\b(facture|invoice|montant|echeance|prelevement)\b/i, /\b\d+[,.]\d{2} ?(€|eur|euros?)\B/i],
      explication: 'Une facture ou un montant figure dans tous les messages de facturation légitimes : ce n\'est pas, en soi, un signe d\'arnaque.',
      action: 'Consultez vos factures depuis votre espace client habituel.', fiche: 'paiement',
      tests: { positifs: ['Votre facture est disponible.', 'Un montant de 78,50 € sera prélevé.'], negatifs: ['Bonne journée à vous.', 'À mardi.'] }
    },
    {
      id: 'theme_banque', categorie: 'contexte', poids: 1, portee: ['corps', 'objet'],
      libelle: 'Parle de banque ou de carte bancaire',
      motifs: [/\b(banque|bancaire|compte courant|carte (bancaire|bleue|visa|mastercard)|iban)\b/i],
      explication: 'Citer sa banque ou sa carte est normal dans un message de banque, et c\'est aussi ce que font les faux messages : ce thème ne tranche pas.',
      action: 'Pour vérifier, appelez le numéro figurant au dos de votre carte.', fiche: 'paiement',
      tests: { positifs: ['Votre carte bancaire a été utilisée.', 'Contactez votre banque.'], negatifs: ['Bonne soirée.', 'Rendez-vous chez le dentiste.'] }
    },
    {
      id: 'code_present', categorie: 'contexte', poids: 1, portee: ['corps', 'objet'],
      libelle: 'Contient un code de confirmation',
      motifs: [/\bcode (de |d')?(confirmation|validation|securite|connexion|verification|acces|a usage unique|unique)\b/i, /\bone[- ]time (code|password)\b/i, /\bverification code\b/i, /\bcode [a-z]-?\d{4,8}\b/i, /\b[a-z]-\d{4,8} est votre code\b/i],
      explication: 'Les vrais codes à usage unique existent et sont envoyés après une action de votre part. Le danger commence quand on vous demande de les communiquer.',
      action: 'Ne communiquez jamais ce code à quiconque, même à votre banque.', fiche: 'paiement',
      tests: { positifs: ['Votre code de confirmation est 482913.', 'G-482913 est votre code Google.'], negatifs: ['Code postal 75001.', 'Bonne journée.'] }
    },
    {
      id: 'montant_petit', categorie: 'contexte', poids: 1, portee: ['corps', 'objet'],
      libelle: 'Petit montant (moins de 6 €)',
      motifs: [/\b[0-5][,.]\d{2} ?(€|eur|euros?)\B/i, /(€|£|\$) ?[0-5][,.]\d{2}\b/i],
      explication: 'Les faux messages réclament souvent un très petit montant (1,99 €) pour que vous ne vous méfiez pas et pour obtenir votre carte. Un petit montant est aussi banal ailleurs.',
      action: 'Ne payez pas depuis le message.', fiche: 'paiement',
      tests: { positifs: ['Frais de 1,99 € à régler.', 'A fee of £2.99.', 'Total 4.50 €.'], negatifs: ['Total 12,90 €.', 'Facture de 78,50 €.'] }
    },
    {
      id: 'appel_numero', categorie: 'contexte', poids: 1, portee: ['corps'],
      libelle: 'Invite à appeler un numéro',
      motifs: [/\b0[1-9]([ .]?\d{2}){4}\b/i, /\b(appelez|rappelez|telephonez|contactez)\b[^.\n]{0,30}\b(numero|au \d)/i, /\bcall (us|this number|our)\b/i],
      explication: 'Un numéro à rappeler peut être légitime, mais c\'est aussi la méthode des faux conseillers et des faux supports. Ne rappelez jamais le numéro d\'un message : cherchez-le vous-même.',
      action: 'Utilisez le numéro officiel figurant sur le site ou au dos de votre carte.', fiche: 'sms',
      tests: { positifs: ['Appelez le 09 88 12 34 56.', 'Rappelez-nous au numéro indiqué.'], negatifs: ['Rendez-vous à 14 h.', 'Merci de votre visite.'] }
    },
    {
      id: 'demande_argent', categorie: 'contexte', poids: 1, portee: ['corps'],
      libelle: 'Demande d\'argent',
      motifs: [
        /\b(peux|pourrais|peut|pouvez|pourriez|veux|voudrais|voulez)[- ]?(tu|vous)\b[^.\n]{0,25}\b(virement|virer|envoyer|avancer|depanner|payer|transferer)\b/i,
        /\b(tu|vous) (peux|pouvez|pourrais|pourriez)\b[^.\n]{0,25}\b(virement|virer|envoyer|avancer|depanner|payer|transferer)\b/i,
        /\b(fais|faites|envoie|envoyez)[- ]?moi\b[^.\n]{0,25}\b(virement|\d[\d ]{0,6} ?(€|euros?))/i,
        /\bbesoin (d'argent|de \d[\d ]{0,6} ?(€|euros?))/i,
        /\bvirement de \d[\d ]{0,6}[,.]?\d* ?(€|euros?)/i,
        /\bme (virer|renvoyer|rembourser|envoyer)\b[^.\n]{0,20}\b(difference|surplus|reste|somme)\b/i
      ],
      explication: 'Une demande d\'argent entre proches est banale. Elle devient un signal quand elle suit « c\'est mon nouveau numéro » ou une urgence : vérifiez par un autre canal.',
      action: 'Ne faites aucun virement avant d\'avoir parlé à la personne, par téléphone ou en face à face.', fiche: 'sms',
      tests: { positifs: ['Tu peux me faire un virement de 850 € ?', 'Peux-tu m\'envoyer 1 200 € ?', 'J\'ai besoin d\'argent.'], negatifs: ['Rendez-vous à 19 h.', 'Merci pour le dîner.'] }
    },
    {
      id: 'pretexte_proche', categorie: 'contexte', poids: 1, portee: ['corps'],
      libelle: 'Évoque un incident pressant (carte perdue, facture à payer)',
      motifs: [/\bj'ai (perdu|oublie) ma carte\b/i, /\bpas (acces|d'acces) a (mon|ma) (appli|application|banque|compte)\b/i, /\bje (ne peux|n'arrive) (pas|plus) (a )?(payer|acceder|me connecter)\b/i, /\bfacture (a payer|urgente)\b/i, /\bbanque (bloquee|ne marche|inaccessible)\b/i],
      explication: 'Le faux proche invente un incident (carte perdue, facture urgente) pour justifier sa demande d\'argent.',
      action: 'Appelez votre proche sur son numéro habituel.', fiche: 'sms',
      tests: { positifs: ['J\'ai perdu ma carte.', 'Je n\'arrive pas à payer.'], negatifs: ['Rendez-vous demain.', 'Bonne soirée.'] }
    },
    {
      id: 'theme_amende', categorie: 'contexte', poids: 1, portee: ['corps', 'objet'],
      libelle: 'Parle de péage, d\'amende ou de stationnement',
      motifs: [/\b(peage|telepeage|autoroute|reseau autoroutier|antai|amende|contravention|forfait post[- ]stationnement|fps|stationnement|parking)\b/i],
      explication: 'Péage, amende et stationnement sont des thèmes réels, mais aussi les prétextes des faux SMS de régularisation qui circulent depuis 2025.',
      action: 'Vérifiez sur le site officiel de l\'organisme, en tapant vous-même l\'adresse.', fiche: 'sms',
      tests: { positifs: ['Votre trajet sur l\'autoroute.', 'Une amende est en attente.'], negatifs: ['Bonjour tout le monde.', 'Mon colis arrive.'] }
    },
    {
      id: 'theme_operateur', categorie: 'contexte', poids: 1, portee: ['corps', 'objet'],
      libelle: 'Parle d\'un forfait ou d\'une ligne téléphonique',
      motifs: [/\bforfait (mobile|telephonique|internet|box)\b/i, /\b(votre|la) ligne (mobile|fixe|internet|est|sera)\b/i, /\bcarte sim\b/i, /\b(freebox|livebox|bbox)\b/i, /\bla ligne\b/i],
      explication: 'Un forfait ou une ligne coupée est un thème réel, et celui des faux SMS d\'opérateur qui réclament une « réactivation » en ligne.',
      action: 'Connectez-vous à votre espace client en tapant vous-même l\'adresse.', fiche: 'sms',
      tests: { positifs: ['Votre forfait mobile sera résilié.', 'Réactivez la ligne.'], negatifs: ['Bonne journée.', 'Rendez-vous à 15 h.'] }
    },
    {
      id: 'theme_cpf', categorie: 'contexte', poids: 1, portee: ['corps', 'objet'],
      libelle: 'Parle du compte formation (CPF)',
      motifs: [/\b(cpf|compte (personnel de )?formation|moncompteformation|droits? a la formation)\b/i],
      explication: 'Le CPF est la cible d\'une vague de faux démarchages : le thème seul ne tranche pas, mais toute demande d\'action urgente doit alerter.',
      action: 'Passez par moncompteformation.gouv.fr en tapant vous-même l\'adresse.', fiche: 'phishing',
      tests: { positifs: ['Votre compte formation CPF.', 'Vos droits à la formation.'], negatifs: ['Bonne journée.', 'À demain.'] }
    },
    {
      id: 'theme_annonce', categorie: 'contexte', poids: 1, portee: ['corps'],
      libelle: 'Répond à une annonce',
      motifs: [/\bvotre annonce\b/i, /\bannonce (leboncoin|seloger|vinted)\b/i, /\best[- ]il (toujours )?disponible\b/i],
      explication: 'Répondre à une annonce est banal, mais c\'est la porte d\'entrée des faux acheteurs et des faux locataires.',
      action: 'Ne faites ni virement ni envoi de colis avant d\'avoir encaissé définitivement un paiement.', fiche: 'entre_particuliers',
      tests: { positifs: ['Votre annonce m\'intéresse.', 'Est-il toujours disponible ?'], negatifs: ['Bonne journée.', 'Merci.'] }
    },
    {
      id: 'theme_renovation', categorie: 'contexte', poids: 1, portee: ['corps', 'objet'],
      libelle: 'Parle de rénovation énergétique',
      motifs: [/\b(isolation|combles|pompe a chaleur|panneaux? solaires?|chaudiere|maprimerenov'?|renovation (energetique|thermique)|certificats? d'economies d'energie)\b/i],
      explication: 'Les aides à la rénovation sont réelles, mais aussi le prétexte d\'un démarchage frauduleux très répandu.',
      action: 'Renseignez-vous sur le site officiel France Rénov\'.', fiche: 'sms',
      tests: { positifs: ['Isolation de vos combles.', 'MaPrimeRénov\' pour votre chaudière.'], negatifs: ['Bonne journée.', 'À demain.'] }
    },
    {
      id: 'crypto', categorie: 'contexte', poids: 1, portee: ['corps', 'objet'],
      libelle: 'Parle de cryptomonnaies',
      motifs: [/\b(bitcoin|btc|ethereum|usdt|crypto-?monnaies?|cryptos?|wallet|portefeuille (crypto|bitcoin|numerique))\b/i],
      explication: 'Les cryptomonnaies sont un sujet légitime, mais aussi le moyen de paiement préféré des escrocs, car il est irréversible.',
      action: 'Ne payez jamais en cryptomonnaie à la demande d\'un message.', fiche: 'crypto',
      tests: { positifs: ['Payez en bitcoin.', 'Votre wallet crypto.'], negatifs: ['Bonne journée.', 'Merci.'] }
    },
    {
      id: 'appel_proche', categorie: 'contexte', poids: 1, portee: ['corps'],
      libelle: 'S\'adresse à vous comme un proche (« maman », « papa »)',
      motifs: [/(^|[.!?]\s*)(salut|coucou|bonjour|hello|hey)[^.\n]{0,15}\b(maman|papa|mamie|papi|mam|pap)\b/i, /\b(maman|papa|mamie|papi)\b,? (c'est|ici)\b/i],
      explication: 'S\'adresser à vous comme un enfant ou un petit-enfant est l\'ouverture du faux proche. Seule, cette formule est banale.',
      action: 'Appelez votre proche sur son numéro habituel avant de répondre.', fiche: 'sms',
      tests: { positifs: ['Coucou maman, c\'est Léa.', 'Papa, c\'est moi.'], negatifs: ['Bonjour, merci de votre visite.', 'Rendez-vous demain.'] }
    },
    {
      id: 'en_click', categorie: 'contexte', poids: 1, portee: ['corps'],
      libelle: 'Invite à cliquer (anglais)',
      motifs: [/\b(click|tap) (here|the link|below|on the link)\b/i, /\bfollow (this|the) link\b/i],
      explication: 'Une invitation à « cliquer ici » est banale, mais c\'est le geste que cherchent à provoquer les messages frauduleux.',
      action: 'N\'ouvrez pas le lien : allez vous-même sur le site officiel.', fiche: 'phishing',
      tests: { positifs: ['Click here to continue.', 'Tap the link below.'], negatifs: ['Come here tomorrow.', 'Thanks.'] }
    },

    /* ===== Objet d'un e-mail ===== */
    {
      id: 'objet_re', categorie: 'manipulation', poids: 2, portee: ['objet'],
      libelle: 'Préfixe « RE : » ou « TR : » qui simule un échange en cours',
      motifs: [/^\s*(re|tr|fwd?|fw)\s*:/i],
      explication: 'Les escrocs ajoutent « RE : » ou « TR : » pour faire croire à une conversation déjà engagée. Demandez-vous si vous avez vraiment échangé avec cet expéditeur.',
      action: 'Vérifiez si vous avez bien une conversation en cours avec cet expéditeur.', fiche: 'phishing',
      tests: { positifs: ['RE : facture impayée', 'TR: document'], negatifs: ['Facture de novembre', 'Retour sur la réunion'] }
    },
    {
      id: 'objet_majuscules', categorie: 'manipulation', poids: 1, portee: ['objet'],
      libelle: 'Objet écrit en majuscules',
      motifs: [/^(?=[^A-Z]{0,40}[A-Z]{4})[^a-z]{12,300}$/],
      explication: 'Écrire en majuscules est une façon de crier pour provoquer une réaction immédiate : les vrais organismes écrivent des objets sobres.',
      action: 'Lisez le contenu avec calme, sans vous laisser presser.', fiche: 'phishing',
      tests: { positifs: ['URGENT REMBOURSEMENT EN ATTENTE', 'DERNIER AVIS AVANT POURSUITES'], negatifs: ['Votre facture de novembre', 'Rendez-vous mardi'] }
    },
    {
      id: 'objet_ponctuation', categorie: 'manipulation', poids: 1, portee: ['objet'],
      libelle: 'Ponctuation excessive dans l\'objet',
      motifs: [/[!?]{2,}/, /!.{0,40}!/],
      explication: 'Plusieurs points d\'exclamation ou d\'interrogation cherchent à dramatiser le message.',
      action: 'Lisez le contenu avec calme.', fiche: 'phishing',
      tests: { positifs: ['Dernier rappel !!', 'Attention ! Vite !'], negatifs: ['Votre facture', 'Rendez-vous ?'] }
    },
    {
      id: 'objet_symboles', categorie: 'manipulation', poids: 1, portee: ['objet'],
      libelle: 'Symboles d\'alerte dans l\'objet',
      motifs: [/[\u26A0\u2757\u203C\u{1F6A8}\u{1F514}\u{1F4B0}\u{1F381}]/u],
      explication: 'Les symboles d\'alerte (⚠, 🚨, 🔔, 💰…) sont rares dans les messages d\'organismes sérieux et fréquents dans l\'hameçonnage.',
      action: 'Lisez le contenu avec calme.', fiche: 'phishing',
      tests: { positifs: ['⚠ Votre compte', '🚨 Alerte'], negatifs: ['Votre compte', 'Alerte météo'] }
    },
    {
      id: 'objet_vague', categorie: 'manipulation', poids: 1, portee: ['objet'],
      libelle: 'Objet vague et générique',
      motifs: [/^\s*(important|urgent|document|facture|message|notification|information|nouveau message|avis)\s*[.!]*\s*$/i],
      explication: 'Un objet très général (« Important », « Document »…) pousse à ouvrir le message sans savoir de quoi il s\'agit.',
      action: 'Ne téléchargez aucune pièce jointe sans être sûr de l\'expéditeur.', fiche: 'phishing',
      tests: { positifs: ['Important', 'Document'], negatifs: ['Votre facture EDF de novembre', 'Document de travail du projet'] }
    }
  ];

  /* ------------------------------------------------------------------
   * Scénarios : une arnaque connue = plusieurs « briques » réunies.
   * Une brique est satisfaite si l'un de ses indices (règle ou fonction du moteur) est présent.
   * Indices fournis par le moteur : lien, qr, hote_non_officiel, manip (au moins un signal de
   * manipulation), marque:<famille> (livraison, banque, operateur, admin, energie, plateforme).
   *  confirme : briques toutes requises -> statut « confirmé »
   *  partiel  : briques qui, réunies sans les autres, donnent le statut « partiel »
   * ------------------------------------------------------------------ */
  var SCENARIOS = [
    { id: 'S1', libelle: 'Faux colis ou faux livreur', fiche: 'sms',
      explication: 'Un message de transporteur qui réclame de petits frais ou une confirmation d\'adresse, avec un lien qui ne mène pas au site du transporteur.',
      briques: [
        { id: 'contexte', libelle: 'Parle d\'une livraison', indices: ['marque:livraison', 'theme_livraison', 'en_delivery_failed'] },
        { id: 'appat', libelle: 'Petit montant ou lien à suivre', indices: ['montant_petit', 'lien'] },
        { id: 'pression', libelle: 'Marque de transport citée ou signal de manipulation', indices: ['marque:livraison', 'manip'] },
        { id: 'hote', libelle: 'Lien vers un site qui n\'est pas celui du transporteur', indices: ['hote_non_officiel'] }
      ],
      confirme: ['contexte', 'appat', 'pression', 'hote'], partiel: ['contexte', 'appat', 'pression'] },
    { id: 'S2', libelle: 'Faux conseiller bancaire', fiche: 'paiement',
      explication: 'Une « opération suspecte » est signalée pour vous faire valider, annuler ou communiquer un code : c\'est vous qui autorisez le vol.',
      briques: [
        { id: 'operation', libelle: 'Parle d\'une opération suspecte', indices: ['faux_conseiller'] },
        { id: 'validation', libelle: 'Demande un code ou une validation', indices: ['code_transmission', 'validation_operation'] },
        { id: 'contact', libelle: 'Invite à appeler ou à cliquer', indices: ['appel_numero', 'lien'] }
      ],
      confirme: ['operation', 'validation', 'contact'], partiel: ['operation', 'contact'] },
    { id: 'S3', libelle: 'Faux proche (nouveau numéro)', fiche: 'sms',
      explication: 'Un « proche » qui change de numéro, invente un incident et demande de l\'argent : l\'arnaque « bonjour papa, bonjour maman ».',
      briques: [
        { id: 'numero', libelle: 'Annonce un nouveau numéro ou un téléphone cassé', indices: ['nouveau_numero'] },
        { id: 'argent', libelle: 'Demande de l\'argent', indices: ['demande_argent'] },
        { id: 'pression', libelle: 'Urgence ou incident pressant', indices: ['urgence', 'pretexte_proche', 'nouveau_numero'] }
      ],
      confirme: ['numero', 'argent', 'pression'], partiel: ['numero', 'pression'] },
    { id: 'S4', libelle: 'Hameçonnage de compte', fiche: 'phishing',
      explication: 'Une menace sur votre compte, assortie d\'un lien vers un site qui n\'est pas celui de l\'organisme, pour récupérer vos identifiants.',
      briques: [
        { id: 'menace', libelle: 'Menace de suspension ou demande de vérification', indices: ['menace_blocage', 'verification_identite', 'en_account_status', 'en_verify_account', 'en_unusual_activity', 'en_payment_issue'] },
        { id: 'lien', libelle: 'Lien à suivre', indices: ['lien'] },
        { id: 'hote', libelle: 'Lien vers un site non officiel', indices: ['hote_non_officiel'] }
      ],
      confirme: ['menace', 'lien', 'hote'], partiel: ['menace', 'lien'] },
    { id: 'S5', libelle: 'Faux remboursement ou faux gain', fiche: 'phishing',
      explication: 'Un remboursement ou un gain inattendu, pour vous faire saisir vos coordonnées bancaires sur un faux site.',
      briques: [
        { id: 'appat', libelle: 'Annonce un remboursement ou un gain', indices: ['remboursement_gain'] },
        { id: 'action', libelle: 'Demande vos coordonnées ou un lien', indices: ['coordonnees_bancaires', 'lien'] },
        { id: 'delai', libelle: 'Délai, coordonnées bancaires ou site non officiel', indices: ['urgence', 'coordonnees_bancaires', 'hote_non_officiel'] }
      ],
      confirme: ['appat', 'action', 'delai'], partiel: ['appat', 'action'] },
    { id: 'S6', libelle: 'Chantage (sextorsion)', fiche: 'chantage',
      explication: 'Un prétendu piratage de votre webcam, avec menace de diffusion et demande de paiement en cryptomonnaie sous un délai court.',
      briques: [
        { id: 'chantage', libelle: 'Menace de divulgation', indices: ['chantage'] },
        { id: 'paiement', libelle: 'Paiement en cryptomonnaie', indices: ['crypto'] },
        { id: 'delai', libelle: 'Délai court', indices: ['urgence'] }
      ],
      confirme: ['chantage', 'paiement', 'delai'], partiel: ['chantage'] },
    { id: 'S7', libelle: 'Faux investissement', fiche: 'invest',
      explication: 'Un rendement garanti ou miraculeux, sur une plateforme à rejoindre vite : le signe le plus sûr d\'une arnaque à l\'investissement.',
      briques: [
        { id: 'rendement', libelle: 'Promet un gain garanti', indices: ['rendement_garanti'] },
        { id: 'support', libelle: 'Cryptomonnaie, plateforme ou promesse sans risque', indices: ['crypto', 'rendement_garanti'] },
        { id: 'pression', libelle: 'Urgence ou lien à suivre', indices: ['urgence', 'lien'] }
      ],
      confirme: ['rendement', 'support', 'pression'], partiel: ['rendement'] },
    { id: 'S8', libelle: 'Fraude au président', fiche: 'president',
      explication: 'Un virement urgent et confidentiel vers de nouvelles coordonnées bancaires, demandé au nom d\'un dirigeant.',
      briques: [
        { id: 'virement', libelle: 'Demande un virement urgent', indices: ['virement_urgent'] },
        { id: 'secret', libelle: 'Demande la confidentialité', indices: ['confidentialite'] },
        { id: 'rib', libelle: 'Change les coordonnées bancaires', indices: ['changement_rib'] }
      ],
      confirme: ['virement', 'secret', 'rib'], partiel: ['virement'] },
    { id: 'S9', libelle: 'Faux support technique', fiche: 'support',
      explication: 'Une alerte de virus, un numéro à appeler et une prise de main à distance : le déroulé du faux support technique.',
      briques: [
        { id: 'alerte', libelle: 'Alerte de virus ou de piratage', indices: ['alerte_virus', 'en_remote_support'] },
        { id: 'appel', libelle: 'Numéro à appeler', indices: ['appel_numero'] },
        { id: 'main', libelle: 'Prise en main à distance', indices: ['prise_en_main'] }
      ],
      confirme: ['alerte', 'appel', 'main'], partiel: ['alerte', 'appel'] },
    { id: 'S10', libelle: 'Faux péage, fausse amende ou faux QR de parking', fiche: 'sms',
      explication: 'Un péage, une amende ou un stationnement à « régulariser » en ligne, avec un lien ou un QR code qui ne mène pas à l\'organisme officiel.',
      briques: [
        { id: 'theme', libelle: 'Parle de péage, d\'amende ou de stationnement', indices: ['theme_amende', 'menace_autorite'] },
        { id: 'acces', libelle: 'Lien ou QR code à suivre', indices: ['lien', 'qr'] },
        { id: 'pression', libelle: 'Urgence, petit montant ou demande de paiement', indices: ['urgence', 'montant_petit', 'paiement_demande'] },
        { id: 'hote', libelle: 'Lien vers un site non officiel', indices: ['hote_non_officiel'] }
      ],
      confirme: ['theme', 'acces', 'pression', 'hote'], partiel: ['theme', 'acces', 'pression'] },
    { id: 'S11', libelle: 'Faux SMS d\'opérateur (forfait coupé)', fiche: 'sms',
      explication: 'Votre forfait ou votre ligne serait coupé, avec un lien de « réactivation » vers un site qui n\'est pas celui de l\'opérateur.',
      briques: [
        { id: 'operateur', libelle: 'Parle d\'un opérateur, d\'un forfait ou d\'une ligne', indices: ['marque:operateur', 'theme_operateur'] },
        { id: 'menace', libelle: 'Menace de suspension ou de résiliation', indices: ['menace_blocage'] },
        { id: 'lien', libelle: 'Lien de réactivation', indices: ['lien'] },
        { id: 'hote', libelle: 'Lien vers un site non officiel', indices: ['hote_non_officiel'] }
      ],
      confirme: ['operateur', 'menace', 'lien', 'hote'], partiel: ['operateur', 'menace', 'lien'] },
    { id: 'S12', libelle: 'Faux conseiller CPF', fiche: 'phishing',
      explication: 'Votre compte formation serait suspendu ou vos droits expirés, avec un lien ou un numéro de « régularisation ».',
      briques: [
        { id: 'cpf', libelle: 'Parle du compte formation', indices: ['theme_cpf', 'marque:cpf'] },
        { id: 'pression', libelle: 'Menace, urgence ou vérification', indices: ['menace_blocage', 'urgence', 'verification_identite'] },
        { id: 'acces', libelle: 'Lien ou numéro à utiliser', indices: ['lien', 'appel_numero'] },
        { id: 'hote', libelle: 'Lien vers un site non officiel', indices: ['hote_non_officiel'] }
      ],
      confirme: ['cpf', 'pression', 'acces', 'hote'], partiel: ['cpf', 'pression', 'acces'] },
    { id: 'S13', libelle: 'Faux acheteur ou faux locataire', fiche: 'entre_particuliers',
      explication: 'Une réponse à votre annonce, un chèque ou un dépôt de garantie « trop élevé » et une demande de remboursement de la différence.',
      briques: [
        { id: 'annonce', libelle: 'Répond à une annonce', indices: ['theme_annonce'] },
        { id: 'pretexte', libelle: 'Chèque, dépôt de garantie, étranger', indices: ['arnaque_annonce'] },
        { id: 'argent', libelle: 'Demande de rembourser une différence', indices: ['demande_argent', 'arnaque_annonce'] }
      ],
      confirme: ['annonce', 'pretexte', 'argent'], partiel: ['pretexte'] },
    { id: 'S14', libelle: 'Faux démarchage de rénovation énergétique', fiche: 'sms',
      explication: 'Des travaux « à 1 € » ou un dossier « pré-validé », avec un numéro à rappeler vite.',
      briques: [
        { id: 'theme', libelle: 'Parle de rénovation énergétique', indices: ['theme_renovation'] },
        { id: 'appat', libelle: 'Prix symbolique, dossier pré-validé ou urgence', indices: ['prix_symbolique', 'urgence'] },
        { id: 'contact', libelle: 'Numéro à rappeler ou lien', indices: ['appel_numero', 'lien'] }
      ],
      confirme: ['theme', 'appat', 'contact'], partiel: ['theme', 'appat'] }
  ];

  /* Signaux propres au pied de page d'un e-mail (analyse faite par le moteur). */
  var SIGNAUX_PIED = {
    pied_desinscription: { poids: 1, libelle: 'Message commercial sans lien de désinscription', explication: 'Un message promotionnel légitime doit permettre de se désinscrire facilement. Son absence est un signal d\'envoi en masse non conforme.', fiche: 'vie_privee' },
    pied_identite: { poids: 1, libelle: 'Aucune identification de l\'entreprise ou de l\'organisme', explication: 'Un expéditeur sérieux indique qui il est (raison sociale, adresse, numéro d\'immatriculation ou mentions légales). Un pied de page sans identité précise est un signal d\'alerte.', fiche: 'phishing' },
    pied_annee: { poids: 1, libelle: 'Copyright ancien : modèle recopié ?', explication: 'Un « © {annee} » dans un message récent trahit souvent un modèle copié d\'un ancien message légitime.', fiche: 'phishing' },
    pied_lien: { poids: 3, libelle: 'Lien suspect dans le pied de page', explication: 'Le lien « se désinscrire » ou « mentions légales » est souvent piégé.', fiche: 'phishing' }
  };

  /* Signaux propres à l'expéditeur (analyse faite par le moteur). */
  var SIGNAUX_EXPEDITEUR = {
    exp_domaine: { poids: 2, libelle: 'Domaine d\'expédition atypique', explication: 'Le domaine « {domaine} » présente des caractéristiques courantes chez les expéditeurs frauduleux.', fiche: 'phishing' },
    exp_local: { poids: 1, libelle: 'Adresse aléatoire ou générée automatiquement', explication: 'Une partie locale très longue ou pleine de chiffres est typique des adresses jetables créées en masse.', fiche: 'phishing' },
    exp_etranger: { poids: 2, libelle: 'Numéro étranger', explication: 'Ce numéro commence par un indicatif étranger ({numero}). Les organismes français écrivent depuis des numéros français ou des numéros courts.', fiche: 'sms' },
    exp_surtaxe: { poids: 3, libelle: 'Numéro surtaxé', explication: 'Les numéros en 089x sont facturés très cher à celui qui les rappelle. Ne rappelez pas.', fiche: 'sms' },
    exp_court: { poids: 0, libelle: 'Numéro court : ne pas répondre sans vérifier', explication: 'Les numéros courts servent à des services légitimes mais aussi à des services payants. Ne répondez pas (même « STOP ») avant d\'avoir vérifié l\'émetteur.', fiche: 'sms' },
    exp_alpha: { poids: 0, libelle: 'Nom d\'expéditeur affiché : il peut être usurpé', explication: 'Un nom affiché à la place d\'un numéro n\'est pas une preuve : des escrocs peuvent l\'usurper, et leur faux SMS peut même s\'afficher dans la conversation d\'un vrai message.', fiche: 'sms' }
  };

  return {
    VERSION: VERSION, DATE_MAJ: DATE_MAJ, CONFIG: CONFIG, ANNULATEURS: ANNULATEURS, MARQUEURS_PREVENTION: MARQUEURS_PREVENTION,
    FICHES: FICHES, RACCOURCISSEURS: RACCOURCISSEURS, TLD_RISQUES: TLD_RISQUES, TLD_CONNUS: TLD_CONNUS,
    SUFFIXES_DOUBLES: SUFFIXES_DOUBLES, WEBMAIL: WEBMAIL, MARQUES: MARQUES, MOTS_APPAT: MOTS_APPAT,
    LIEN_RAISONS: LIEN_RAISONS, LIBELLES_NIVEAUX: LIBELLES_NIVEAUX, NIVEAUX_ANALYTIQUES: NIVEAUX_ANALYTIQUES,
    LIMITES: LIMITES, INCOHERENCES: INCOHERENCES, REGLES: REGLES, SCENARIOS: SCENARIOS,
    DOMAINES_NEUTRES: DOMAINES_NEUTRES, PREVENTION: PREVENTION,
    SIGNAUX_PIED: SIGNAUX_PIED, SIGNAUX_EXPEDITEUR: SIGNAUX_EXPEDITEUR
  };
});
