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
