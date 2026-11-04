# Notes de réalisation

Hypothèses, chemins adaptés et écarts par rapport au cahier des charges. Mis à jour à chaque lot.

## Outillage (hors lot)

- Node.js 26 LTS installé avec winget ; `jsdom` en dépendance de développement (`package.json` à la racine, sans `"type": "module"` pour que `regles.js` et `moteur.js` restent des scripts classiques chargeables à la fois par le navigateur et par `require`).
- `tests/`, `package.json` et `node_modules` sont exclus du déploiement IONOS (étape « Nettoyage » du workflow).
- Les livrables (`PLAN.md`, `NOTES.md`, `BASELINE.md`, `BENCHMARK.md`) sont dans `tests/detecteur/` pour ne pas encombrer la racine du site.

## L0

- La baseline est mesurée sur une **copie figée** de l'outil de production (`tests/detecteur/legacy/index.v1.html`), exécutée dans jsdom. Elle reste reproductible après la refonte.
- Les 13 premiers cas de l'annexe B retombent exactement sur les niveaux « actuels » annoncés dans le cahier des charges : le diagnostic est confirmé.
- Écart : les cas 14 à 20 de l'annexe B sont annoncés « non détectés aujourd'hui ». La version en production (déjà enrichie par l'analyse de l'expéditeur) les classe au niveau 3, mais pour une mauvaise raison : tout lien y vaut au moins « Douteux ». Ils servent donc de garde-fou, pas de preuve d'amélioration.
- Le cas 20 (QR code dans une capture) est représenté par `qr: [url]` : l'ancienne version reçoit l'URL comme texte, le nouveau moteur la reçoit comme URL décodée.

## L1

- La page (encore sur l'ancien moteur) passe à l'échelle 0 à 3. L'ancien niveau « sain » devient « Aucun signal détecté » (0) s'il n'y a ni signal ni lien, « Signaux faibles » (1) sinon : mapping provisoire, remplacé par le nouveau moteur au lot L3.
- Plus de coche verte : les pastilles « Rien repéré » de la zone « Ce qui a été examiné » sont grises, pas vertes. La coche ✓ de la liste de réassurance de la page (`.sd-trust`) est conservée : elle ne porte pas de verdict.
- Événement `analyse_terminee` : valeurs `aucun`, `faible`, `suspect`, `probable` (anciennes valeurs : `sain`, `douteux`, `arnaque_probable`). À prendre en compte dans les tableaux de bord déjà construits.

## L2 : décisions techniques

- **Architecture** : `regles.js` (données pures) et `moteur.js` (logique), deux scripts classiques (UMD) chargés par la page et par Node. Pas de modules ES : pas de risque avec la politique de contenu, et `node --test` charge les fichiers sans configuration. Le rendu (`ui.js`) arrive au lot L3.
- **Aplatissement à longueur constante** : accents, apostrophes typographiques et espaces insécables sont ramenés à des caractères simples sans changer la longueur du texte. Les motifs sont donc écrits sans accents, et les positions trouvées servent directement au surlignage du texte d'origine.
- **Négation** : on regarde les 40 caractères qui précèdent le motif, en s'arrêtant à la dernière fin de phrase. Les annulateurs sont volontairement stricts (`ne … jamais`, `ne communiquez`, `faux`, `arnaque`, `hameçonnage`, `raccrochez`…). Les mots « attention », « fraude », « ne tardez pas » ou « warning » ne neutralisent rien : ils figurent dans de vrais messages frauduleux (un test le vérifie).
- **Message de prévention** : au moins deux marqueurs (« ne cliquez pas », « n'envoyez jamais », « 33700 »…) font passer les motifs d'arnaque du message en simple contexte. Les incohérences (lien piégé, expéditeur usurpé) restent évaluées : un piège caché dans un texte de prévention est toujours signalé (un test le vérifie).
- **Poids** : un signal de manipulation de poids ≥ 4 (demande de code, coordonnées bancaires, prise en main, chantage, virement urgent…) compte pour deux « points ». Deux points = message suspect. Aucune somme brute : les thèmes de contexte (colis, facture, banque, code, petit montant…) ne comptent jamais.
- **Incohérence « critique »** (écart par rapport au cahier des charges) : le tableau d'agrégation ne prévoit que « incohérence forte + ≥ 2 signaux ». Mais les cas 13 (expéditeur `edf-facture.top`, aucun autre signal) et 16 (`amazon.fr@evil.top`, aucun texte) doivent atteindre le niveau 3. On distingue donc les incohérences *fortes* (niveau 2 seules) des incohérences *critiques* (niveau 3 seules) : domaine sosie (marque dans un domaine qui n'est pas le sien), sous-domaine trompeur, identifiant avant le `@`.
- **Marque revendiquée** : dans un message court (≤ 400 caractères), une marque citée n'importe où ; dans un message long, seulement dans les 160 premiers caractères, l'objet ou le nom d'expéditeur. Évite de traiter une mention incidentelle comme une usurpation.
- **Webmail** : une adresse `@gmail.com` n'authentifie jamais une marque, même Google.
- **Scénarios** : S10 (péage, amende) accepte « urgence » ou « petit montant » (le cas 14 n'a pas de montant) ; S1 et S10 ne passent en « partiel » qu'avec un lien ou un montant. Trois scénarios s'ajoutent à la liste S1 à S11 pour les familles 2025-2026 : S12 (faux CPF), S13 (faux acheteur ou locataire), S14 (rénovation énergétique à 1 €).
- **Rejets de règles à portée « corps » seulement** : `nouveau_numero`, `appel_proche`, `demande_argent` ne cherchent pas dans l'objet.
- **Domaines neutres** : `amazonaws.com`, `googleapis.com`… ne sont ni officiels ni « sosies » (sinon tout lien vers un hébergement de marque serait signalé).
- **Tests** : `node --test tests/detecteur/` (ou `npm test`) exécute 190 tests : règles, annexe B, faux positifs, détection, négation, liens, en-têtes, réseau, performance, robustesse.
- **Honnêteté du corpus** : les 71 messages ont été écrits en même temps que les règles ; leur score parfait mesure la cohérence interne, pas la généralisation. Le lot L5 ajoute un jeu de messages rédigés autrement, pour mesurer l'écart.

## L3 : rendu

- **La page n'est plus générée** par les scripts de la session (`assemble.py`…) : `outils/detecteur-arnaque/index.html` (HTML et CSS) et `ui.js` sont désormais la source. Le script inline de 60 Ko est remplacé par trois fichiers (`regles.js`, `moteur.js`, `ui.js`), servis en chemin absolu avec `?v=2.0.0` (à incrémenter à chaque modification pour contourner le cache d'une heure d'IONOS).
- **Aucun `innerHTML` sur du texte utilisateur** : le rendu passe par une fonction `h()` (éléments et nœuds texte). Cinq `innerHTML` subsistent, tous sur du contenu statique du site (texte d'aide du champ expéditeur, liste « que faire », boutons de signalement, newsletter, partage) : un test refuse tout autre usage.
- **Surlignage** : `<mark>` construits par nœuds texte à partir des positions fournies par le moteur ; un expéditeur incohérent est surligné en entier.
- **Trois sections** dans l'ordre demandé (incohérences, manipulation, contexte), plus les scénarios reconnus et les liens examinés. Le nombre d'éléments n'est affiché nulle part.
- **Bouton « Copier le résumé »** : verdict et trois raisons, sans le message ni les adresses (un test le vérifie). Nouvel événement `partage_clic` = `resume`.
- **Mesure** : `scenario_detecte` (identifiant du scénario), jamais le texte.
- **Limites du contrôle** : vérifié par jsdom (parcours, XSS, focus, aria-live, absence de réseau) et par captures Edge à 1100 px ; à 360 px, le navigateur de test ne signale aucun débordement horizontal, mais la page n'a pas été essayée sur un vrai téléphone. Pas de test de lecteur d'écran réel.

## L4 : nouvelles entrées

- **E-mails bruts** : `preparer()` décode les mots encodés (RFC 2047), le quoted-printable, le base64, le HTML (les adresses réelles des liens sont conservées entre parenthèses, car le texte affiché peut mentir) et les messages multipart (partie `text/plain` de préférence). Nouvelle incohérence `RETOUR_DIVERGENT` : `Return-Path` d'un autre domaine **et** SPF non validé (un `Return-Path` différent avec SPF valide est normal pour les envois de masse, un test le vérifie). Le domaine `d=` de la signature DKIM est lu (`contexte.enteteAuthentification.dkimDomaine`) mais ne déclenche pas d'incohérence à lui seul : trop de prestataires d'envoi légitimes signent avec leur propre domaine.
- **Import `.eml`** dans la page : `nettoyerEml()` garde les en-têtes utiles (dont l'authentification) et le corps décodé, pour que le champ de texte reste lisible et pesant moins qu'un fichier brut avec pièces jointes.
- **Codes QR : écart au cahier des charges.** Le cahier annonce jsQR à « ~8 Ko » ; la mesure donne 257 Ko bruts, **57 Ko en gzip, 33 Ko en brotli** (CDN jsDelivr), au-dessus de la limite de 15 Ko. Choix : lecture par l'API native `BarcodeDetector` quand elle existe (aucun téléchargement), jsQR 1.4.0 seulement en repli (Firefox, Safari, et Chrome sous Windows), chargé uniquement à l'import d'une image, servi par le même CDN que Tesseract, avec `integrity` (sha384) et `crossOrigin`. **À valider par vous** (voir le compte rendu). Vérifié dans un vrai navigateur : le repli lit un QR généré et l'empreinte est acceptée.
- **Texte parasite de l'OCR** : sur une image qui ne contient qu'un QR, l'OCR invente quelques caractères ; ils sont écartés quand un QR est lu et que le texte compte moins de 12 lettres.
- **Âge des domaines (RDAP)** : case décochée par défaut, jamais cochée automatiquement (décochée après chaque nouvelle analyse). Requête `GET https://rdap.org/domain/<domaine enregistrable>` avec `credentials: omit`, `referrerPolicy: no-referrer`, délai de 4 s, 3 domaines au plus, jamais pour une marque connue ni pour une adresse IP, cache en mémoire de la page, échec silencieux. Un domaine de moins de 30 jours (`CONFIG.ageRecentJours`) devient une raison de lien (`DOMAINE_RECENT`) et, si le message se réclame d'une marque ou contient un signal de manipulation, une incohérence forte. Mesuré en conditions réelles : `.com` et `.fr` répondent avec CORS (141 à 151 ms) ; un domaine inexistant répond 404 et reste sans effet. Les registres de certaines extensions peuvent ne pas autoriser CORS : le résultat reste alors sans effet, sans message d'erreur.
- **Politique de confidentialité** mise à jour (lecture des QR, vérification RDAP, transferts) : texte à faire valider (base légale, durée, mention des destinataires).
- Version des scripts passée à `2.1.0` dans `index.html` (à incrémenter à chaque modification, car IONOS met les fichiers en cache une heure).

## L5 : corpus et généralisation

- Le corpus passe de 71 à **140 messages** : 71 de « développement » (écrits avec les règles) et 69 de « validation », rédigés ensuite et à part, sans consulter les règles : les neuf familles 2025-2026 (péage, amende ANTAI, QR de parking, forfait coupé, faux CPF, faux locataire, rénovation à 1 €, faux livreur « je repasse », « bonjour papa/maman ») en version « évidente » et « sobre », plus d'autres arnaques (faux Ameli, support, sextorsion anglaise, faux investissement, fraude au président, Vinted, Leboncoin, faux emploi, PayPal, HMRC, UPS…) et 25 messages légitimes difficiles (factures, alertes bancaires, codes à usage unique, rappels de rendez-vous, newsletters, messages entre proches avec demande d'argent, lien raccourci d'un ami).
- **Première mesure sur la série de validation, avant toute correction : 57 messages sur 69 dans la cible, 12 hors cible, tous des détections manquées ; 0 faux positif sur les 25 messages légitimes.** C'est le seul chiffre qui mesure la généralisation ; les autres sont postérieurs aux corrections.
- Les 12 échecs révélaient de vraies lacunes, corrigées : un lien seul à indice faible ou net ne comptait pour rien (nouveau signal `lien_a_risque`, un point pour un indice faible, deux pour un indice net ; les domaines officiels de marques n'en déclenchent jamais, même avec un lien raccourci comme `lnkd.in`), « expirent demain », « arrive à expiration », « renverrez le surplus », « à l'étranger » (nouvelle règle à indice faible), « éligible aux aides », « besoin que tu paies », la famille « faux emploi », les formes anglaises de la sextorsion et du faux support (« I recorded you through your webcam », « detected a critical virus », « Call Microsoft Support at… », « immediately »), et deux scénarios resserrés (S9 accepte une consigne pressante à la place de la prise en main, S13 n'est « partiel » qu'avec une annonce).
- **Après corrections : 68 sur 69 (série de validation), 71 sur 71 (développement).** Ces corrections ayant été guidées par la série de validation, ce second chiffre est optimiste : une nouvelle série, rédigée sans avoir vu celle-ci, serait nécessaire pour une vraie mesure.
- **Limite connue déclarée : N04** (« Votre dossier d'infraction nécessite une action. Consultez le détail ici : https://….top »). Le message est vague, sans marque ni menace : seul le lien en `.top` est repérable, d'où le niveau 1. Le monter ferait grimper les faux positifs. Le niveau attendu (2 ou 3) n'a pas été modifié pour faire passer le test ; un test garantit que la liste des limites connues ne grossit pas en silence.
- **Comparaison avec l'ancienne version, même corpus** : voir `BENCHMARK.md` (colonnes « Ancienne version »). Sur la série de validation, l'ancienne version donne 64 % de faux positifs et 82 % de détection ; le moteur 2.x, 0 % et 95 %.

## L6 : crédibilité

- **Bloc « Méthode et résultats mesurés »** sur la page, généré par `node tests/detecteur/run.mjs` (`npm run benchmark`) entre les repères `MESURES:DEBUT` et `MESURES:FIN` de `index.html` : version des règles, date de mise à jour, taille de l'échantillon, taux de détection et de faux positifs (ensemble et série de validation). Un test compare les chiffres affichés aux mesures du moment : après toute modification des règles, la suite échoue tant que `npm run benchmark` n'a pas été relancé. Aucun chiffre n'est écrit à la main.
- **Version des règles** affichée discrètement sous chaque résultat (« Règles version 2.0.0, mises à jour le 4 novembre 2026 ») et renvoyée par le moteur (`versionRegles`). À faire évoluer à la main dans `regles.js` (`VERSION`, `DATE_MAJ`).
- **Vérifications finales** : parcours au clavier seul dans un vrai navigateur (4 appuis sur Tab de l'étape 2 au bouton « Analyser », focus sur le titre du verdict, annonce `aria-live`, aucun débordement horizontal) ; performances mesurées : 1,2 ms pour 5 000 caractères, 7,1 ms pour 50 000, 2 ms pour 20 Ko de « a. », 1,5 ms pour 20 Ko de tirets (limites : 50, 150 et 200 ms).

## Écarts et points à valider

- **Poids** : sources lisibles = 58 Ko en gzip, soit +37 Ko par rapport à l'ancien script inline (21 Ko), au-dessus du budget de +25 Ko du cahier des charges (hors OCR et QR). Corrigé par une **minification au déploiement** (`scripts/minify-detecteur.mjs`, étape ajoutée au workflow, `terser` épinglé en 5.51.2) : les sources du dépôt restent lisibles, le site sert des fichiers minifiés dont les blocs `tests` des règles sont retirés (inutiles aux visiteurs). Résultat mesuré : **43,7 Ko en gzip (39,4 Ko en brotli), soit +22,3 Ko**, sous le budget. Le HTML de la page a par ailleurs perdu 19 Ko de gzip (le script en est sorti). `tests/detecteur/minification.test.mjs` vérifie que la version minifiée donne des résultats strictement identiques sur les 140 messages, sur les `.eml` et les âges de domaines, qu'elle fait tourner la page entière (parcours, XSS, exemples, absence de réseau) et que l'écart de poids reste sous 25 000 octets. **Le workflow lui-même n'a pas pu être exécuté en local** : sa première exécution réelle, au prochain push, est le vrai test ; une erreur de minification interrompt le déploiement au lieu de publier un script cassé.
- **jsQR** : voir le lot L4 (57 Ko de gzip au lieu des « 8 Ko » annoncés, mis en repli de l'API native).
- **Échantillon** : 140 messages écrits par la même équipe que les règles, dont 69 rédigés à part ; aucune donnée réelle. Ne pas citer ces taux comme une performance générale.
- **Aucune requête vers un LLM, aucun backend, aucune base de phishing** : conformément à la section 11.

### À valider par un humain (choix éditoriaux ou juridiques)

1. **Formulations du verdict** : libellés des quatre niveaux, titres (« Très probablement une arnaque », « Aucun signal détecté dans ce que vous avez saisi »), textes d'explication des règles et des scénarios (`regles.js`, `ui.js`). Le ton prudent est volontaire ; le mot « probable » du niveau 3 reste une appréciation.
2. **Mention de confidentialité à l'endroit du clic** : texte de la case « Vérifier l'âge des sites des liens » et paragraphes ajoutés à la politique de confidentialité (lecture des QR, RDAP, transferts).
3. **Base légale de la requête RDAP** : la politique retient le consentement (la case, décochée par défaut). L'adresse IP de l'utilisateur est vue par `rdap.org` puis par le registre du domaine : à confirmer (mention de ces destinataires, durée de conservation côté tiers, éventuelle analyse d'impact).
4. **jsQR depuis jsDelivr** : acceptable à votre sens malgré son poids (57 Ko) ? Sinon, retirer le repli et ne garder que `BarcodeDetector` (le QR ne serait alors lu que sur Chrome et Edge hors Windows).
5. **Événements de mesure** : les valeurs de `analyse_terminee` changent (`aucun|faible|suspect|probable`) ; les tableaux de bord existants du back-office, s'ils filtrent sur les anciennes valeurs, sont à adapter. Nouvel événement `scenario_detecte`.
6. **Incohérence « critique »** (écart au tableau d'agrégation) et **limite connue N04** : voir plus haut.
7. **Liste des marques** (`MARQUES`) : non exhaustive, à compléter ; une marque absente de la liste n'est jamais protégée contre l'usurpation.
