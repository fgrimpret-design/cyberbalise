# cyberbalise

## Badges de public

Les badges « Particuliers », « Pros » et « Les deux » ne sont plus affichés :
ni dans les menus, ni sur les pages et cartes, ni dans les résultats de recherche.
Conserver les données de public utilisées par les filtres. Le gabarit et les
générateurs du backoffice ne doivent pas réintroduire ces badges.

## Offres du moment en préparation

Le contenu est conservé dans le brouillon
`backoffice/data/brouillons/offres/promotions/index.html`. Son édition est accessible
après connexion à `/backoffice/edit.php?f=offres%2Fpromotions%2Findex.html`.
Le dossier de données est interdit d'accès HTTP par Apache ; ne pas le servir
avec un serveur statique public ignorant les fichiers `.htaccess`.
Le serveur Python local ne permet pas de tester l'authentification PHP.

L'ancienne adresse affiche une page en construction non indexable, absente des
menus, cartes, recherche et sitemap. Le marqueur `CB-PAGE:EN-CONSTRUCTION` permet
au bouton « Publier » de remplacer uniquement cette page d'attente, sans bloquer
sur une collision d'adresse. Après publication, rétablir les liens souhaités
depuis le menu du backoffice et la rubrique Offres.

## Détecteur d'arnaque

Le détecteur est une page statique, sans framework : l'analyse se fait **dans le
navigateur**, le texte n'est jamais envoyé. Trois fichiers dans
`outils/detecteur-arnaque/` :

- `regles.js` : données pures (règles de détection avec leurs tests, scénarios
  d'arnaque, marques et domaines officiels, listes d'extensions à risque, réglages
  et libellés). C'est le fichier à compléter au fil du temps ;
- `moteur.js` : le calcul (liens, expéditeur, en-têtes, scénarios, niveau). Il ne
  touche jamais au DOM et se charge aussi dans Node ;
- `ui.js` : le parcours, l'import, l'OCR, le rendu du verdict, la newsletter.
  Tout texte venant de l'utilisateur y est écrit par nœuds texte, jamais par
  `innerHTML` (un test le vérifie).

**Parcours** en trois étapes : 1) choix du type de message (SMS ou e-mail),
2) champs à renseigner (expéditeur ; pour un e-mail, objet et pied de page) et
texte du message, fourni par capture d'écran (lecture locale par Tesseract.js,
chargé seulement à l'import d'une image), fichier `.txt` ou copier-coller,
3) verdict. Un e-mail collé en entier ou importé en `.eml` (avec ses en-têtes `From`,
`Subject`, `Reply-To`, `Return-Path`, `Authentication-Results`, `Received-SPF`) est
décodé (mots encodés, quoted-printable, base64, HTML, multipart) et lu
automatiquement. Un **code QR** présent dans une image est lu localement
(`BarcodeDetector` du navigateur ; à défaut, jsQR 1.4.0 chargé à la demande depuis
jsDelivr avec empreinte d'intégrité, à mettre à jour dans `ui.js` si la version
change : un test compare l'empreinte au fichier épinglé) et son adresse est analysée
sans être ouverte. Une case **décochée par défaut** permet de vérifier l'âge des sites
des liens : seuls les noms de domaine (3 au plus, hors marques connues) sont envoyés
à `https://rdap.org/domain/<domaine>` ; échec ou CORS refusé = aucun message d'erreur.

**Verdict à quatre niveaux, sans score** : 0 « Aucun signal détecté » (gris, jamais
de coche verte ni de mot « sain »), 1 « Signaux faibles », 2 « Message suspect »,
3 « Arnaque probable ». Le niveau vient de la nature des éléments repérés, pas de
leur nombre : une **incohérence vérifiable** (lien ou domaine « sosie »,
identifiant avant le `@`, expéditeur qui n'est pas celui de la marque citée,
échec SPF/DKIM, adresse de réponse différente), un **scénario d'arnaque**
reconnu (faux colis, faux conseiller, faux proche, hameçonnage de compte, faux
remboursement, sextorsion, faux investissement, fraude au président, faux
support, faux péage ou QR de parking, faux opérateur, faux CPF, faux acheteur,
rénovation énergétique) ou des **signaux de manipulation**. Les **éléments de
contexte** (colis, facture, banque, code, petit montant…) sont affichés mais ne
comptent jamais : ils figurent dans beaucoup de vrais messages. Un message d'une
marque dont l'adresse officielle est confirmée reste au niveau 1 au plus. Les
messages de prévention (« ne communiquez jamais votre code ») ne sont pas signalés.
L'outil ne donne jamais de pourcentage et ne promet jamais qu'un message est sûr ;
un bloc « Ce que cet outil n'a pas pu vérifier » est toujours affiché.

**Ajouter une règle** : ajouter un objet dans `REGLES` (`regles.js`) avec ses motifs
**sans accents** (le moteur aplatit le texte à longueur constante), des quantificateurs
bornés (`[^.\n]{0,40}`, jamais `.*`), et au moins un test positif et un test négatif :
la suite de tests échoue sinon. **Ajouter une marque** : entrée dans `MARQUES`
(domaines officiels dans `dom`). **Ajouter un scénario** : entrée dans `SCENARIOS`,
chaque « brique » listant les règles qui la satisfont.

**Tests** : `npm install` (une fois), puis `npm test` (équivalent de
`node --test tests/detecteur/`). La suite vérifie les règles, les 20 cas de
non-régression, les faux positifs, la détection, la négation, les liens, les
en-têtes, l'absence de requête réseau, les performances et le parcours complet de la
page dans jsdom. `npm run test:baseline` exécute l'ancienne version
(`tests/detecteur/legacy/`) et `node tests/detecteur/run.mjs` le moteur actuel :
`tests/detecteur/BASELINE.md` et `BENCHMARK.md` sont des fichiers générés. Le bloc
« Méthode et résultats mesurés » de la page est lui aussi généré par
`npm run benchmark` (aucun chiffre écrit à la main) : un test échoue tant qu'il
n'est pas à jour après une modification des règles. Pensez à incrémenter `?v=` des
trois scripts dans `index.html` à chaque modification (cache d'une heure chez IONOS).
Hypothèses et écarts : `tests/detecteur/NOTES.md`. Les dossiers `tests/` et
`node_modules/` ne sont pas déployés. **Au déploiement**, le workflow minifie
`regles.js`, `moteur.js` et `ui.js` (`scripts/minify-detecteur.mjs`, qui retire aussi
les blocs `tests` des règles) : les sources du dépôt restent lisibles, et
`npm test` vérifie que la version minifiée se comporte à l'identique. Pour voir ce
qui sera servi : `node scripts/minify-detecteur.mjs <dossier de sortie>`.

**Newsletter CyberBalise (inscription après le verdict, un e-mail tous les 15 jours).** L'inscription passe par le script PHP
du site `backoffice/newsletter.php` (double opt-in : e-mail de confirmation, lien de
désinscription avec confirmation). Les adresses sont stockées dans la table
`cr_newsletter` du back office ; la liste (compteurs, export CSV des adresses
confirmées, suppression) est dans le back office, page **Abonnés** (administrateurs).
Réglages dans `backoffice/config.php`, clé `newsletter` (expéditeur `from`, qui doit
être une adresse du domaine ; `transport` `mail` en production, `log` pour tester en
local sans envoyer). Les inscriptions non confirmées sont supprimées après 7 jours,
une même adresse reçoit au plus un e-mail de confirmation toutes les 10 minutes et
chaque visiteur est limité à 6 demandes par heure. Tout l'envoi passe côté page par
`subscribeNewsletter(email)` et la constante `CB_NEWSLETTER` (en tête de
`outils/detecteur-arnaque/ui.js`) ; l'adaptateur `form` permet de basculer vers
un service externe (Brevo…), et `?nl=preview` simule l'inscription sans rien envoyer.
Seule l'adresse e-mail est transmise, jamais le message analysé. La politique de
confidentialité décrit ce traitement. Envoyer la lettre elle-même se fait hors du site
(export CSV vers un outil d'envoi) : chaque envoi doit contenir un lien de
désinscription.

**Événements de mesure.** `outil_lance` (valeur : `capture`, `fichier`, `texte` ou
`demo`), `analyse_terminee` (valeur : `aucun`, `faible`, `suspect` ou `probable`),
`scenario_detecte` (identifiant du scénario, par exemple `S1` : jamais le texte),
`inscription_newsletter` et `partage_clic` (valeur : `whatsapp`, `lien`, `natif`
ou `resume`). Avant le 4 novembre 2026, `analyse_terminee` valait `sain`, `douteux`
ou `arnaque_probable`. Ils passent par `window.crTrack` (outil interne
`backoffice/t.js`, chargé uniquement après consentement) et seraient aussi envoyés à
GA4/GTM si `gtag` ou `dataLayer` existaient. Ils apparaissent dans la page
Statistiques du back-office (événements).

## Top protections

Le module partagé utilise `assets/top-protections.js` et `assets/site-spacing.css`.
Chaque catégorie affiche ses trois premières cartes. Au-delà, le bouton
« Voir tous les résultats » déplie la liste et permet ensuite de la réduire.
L'état est indépendant par catégorie et conservé lors des changements d'onglet.
Sans JavaScript, toutes les cartes restent accessibles.

Proton Drive figure en première position du comparatif sauvegardes cloud :
cartes, tableau, détails et fiches produit, ainsi que dans les modules partagés
de quatre cartes (trois visibles avant dépliage). Les fragments des anciens
fournisseurs sont conservés malgré la nouvelle numérotation visible.
La fiche est sous `offres/sauvegardes-cloud/proton-drive/`.
Source : page affiliée Black Friday <https://proton.me/l/bf-drive-offers-2026>,
consultée le 28 octobre 2026 avec la devise EUR sélectionnée. Drive Plus :
200 Go, 23,88 EUR les 12 premiers mois puis 47,88 EUR/an ; Unlimited :
500 Go, 77,88 EUR les 12 premiers mois puis 119,88 EUR/an. Distinguer stockage
synchronisé et sauvegarde complète ; ne pas promettre une restauration système.
Le logo officiel pour fond clair est conservé dans
`assets/img/provider-logos/proton-drive-logo-light.svg`. Revalider prix,
renouvellements et caractéristiques sur les cartes, le comparatif, la fiche
et le gabarit lors des mises à jour ; conserver le lien affilié fourni complet.

AdGuard VPN est le neuvième fournisseur VPN du comparatif et du module partagé
(neuf cartes, trois visibles avant dépliage). Sa fiche est disponible sous
`offres/vpn/adguard-vpn/`. Le lien affilié fourni est conservé intégralement.
Sources consultées le 28 octobre 2026 : arrivée officielle
<https://adguard-vpn.com/en/welcome.html>, FAQ et promotion liée
<https://adguard-vpn.com/en/license.html?promoCode=HALLOWEENVPN26>.
L'offre Halloween est annoncée jusqu'au 1er novembre : 2,16 EUR/mois équivalents,
facturés tous les deux ans, TVA éventuelle ; total de commande et renouvellement
non relevés. Revalider ces conditions après la promotion, sur les cartes,
le comparatif, la fiche et le gabarit. La garantie de 30 jours concerne les
abonnements d'un an ou plus achetés sur le site officiel.
Le logo `assets/img/provider-logos/adguard-vpn.svg` est extrait du SVG officiel
de l'en-tête ; les couleurs du thème clair sont incorporées pour un rendu autonome.
AdGuard Ad Blocker est un produit distinct, ne pas le présenter comme inclus.

L'offre partenaire Proton Pass est présente dans le module et dans le comparatif
et sa fiche dédiée. Prix, renouvellements et logo proviennent de la page affiliée
Black Friday 2026, relevée en EUR le 27 octobre 2026. Lors d'une mise à jour,
répercuter la carte sur les pages qui incluent le module et sur le gabarit
du backoffice ; conserver le lien affilié complet et préciser la facturation
annuelle ainsi que le tarif de renouvellement.
Proton Pass figure en troisième position après Keeper et NordPass dans le module,
les cartes, le tableau et les détails du comparatif. Le logo officiel pour fond
clair est servi depuis `assets/img/provider-logos/proton-pass-logo-light.svg`,
issu de la page produit du fournisseur ; ne pas utiliser la variante à texte blanc.

Sticky Password figure en quatrième position, après Proton Pass. Son logo et ses
arguments proviennent de <https://www.stickypassword.com/lp/lifetime-deal>,
consulté le 27 octobre 2026 : licence Premium à vie à paiement unique,
synchronisation cloud/Wi-Fi local/aucune, partage, 2FA et accès d'urgence.
La remise de 60 % et l'année de surveillance du dark web offerte sont celles de
cette page générale ; aucun prix final n'a été relevé. Ne pas les présenter comme
des conditions vérifiées de la page partenaire CyberBalise.
Le lien affilié complet a été conservé à la demande du responsable du site malgré
sa réponse 404 initiale. Vérifier son activation annoncée pour le 28 octobre 2026,
puis mettre à jour les mentions d'attente et les conditions propres à cette offre.

## Logo de l'en-tête

Toutes les pages utilisent le logo officiel (crochets autour de BALISE, point
orange) : `assets/img/logo-cyberbalise-header.png`, dérivé de
`assets/img/logo-cyberbalise.png` avec « CYBER » en bleu du site (`#0c3e9b`) et
« BALISE » en orange. Le style est dans `assets/site-spacing.css` (`.logo-img`).
Le favicon (`favicon.svg`) et le logo du back-office (`brand_svg()` dans
`backoffice/inc/layout.php`) reprennent le pictogramme crochets + point.

## Menu principal

Le menu (bureau et mobile) est le même sur toutes les pages, entre les repères
`CB-MENU` et `CB-MNAV`, et géré depuis le backoffice (Menu). Entrées actuelles :
Actualités · Guides (sous-menu Particuliers et Professionnels, page d'accueil de la
rubrique `/guides/`) · Comparatifs (anciennement « Offres & outils », toujours sous
`/offres/` pour ne pas casser les adresses) · Ressources (`/outils/` et le lexique).
Les pages `/particuliers/` et `/pro/` restent les espaces détaillés ; `/guides/`
les présente côte à côte.

## Notes Trustpilot

Les notes Trustpilot s'affichent pour chaque VPN (carte du comparatif, colonne du
tableau récapitulatif, en-tête, tableau « Caractéristiques » et sources des fiches).
Trustpilot note l'entreprise, pas le produit : la mention « note de l'éditeur » est donc
conservée partout, avec la date de relevé, le nombre d'avis et un lien vers la page
Trustpilot. Aucune donnée structurée `aggregateRating` n'est ajoutée (les avis tiers n'y
ont pas leur place), et le logo Trustpilot n'est pas utilisé.

Les accès automatisés à Trustpilot sont bloqués et ses conditions interdisent
l'extraction : relever les notes à la main sur `fr.trustpilot.com/review/<domaine>`,
les saisir dans `scripts/trustpilot.json` (note, nombre d'avis, date de relevé), puis
lancer `python scripts/trustpilot_apply.py` (`--dry-run` pour simuler). Le script met à
jour les pages de manière idempotente à partir de ce fichier. Relevé initial :
30 octobre 2026. Pour étendre à une autre catégorie, ajouter ses produits au fichier JSON
et sa configuration (comparatif, correspondances de noms, fiches) dans `CATEGORIES`.

## Panda Dome (antivirus)

La fiche `offres/antivirus/panda-dome/`, la carte du comparatif antivirus et la carte
« Antivirus » du module Top protections (quatrième carte, visible après « Voir tous
les résultats ») utilisent le lien affilié
`https://www.tkqlhce.com/click-101904907-15329858?sid=panda-security`, qui redirige vers
la page de promotion `https://www.pandasecurity.com/security-promotion/` de Panda Security
(une marque de WatchGuard). Arguments, systèmes pris en charge, distinctions et prix
proviennent de cette page, relevés le 30 octobre 2026 : prix de première année affichés
par défaut, −60 % sur Essential (15,98 €), Advanced (21,98 €), Complete (33,98 €) et
Premium (55,98 €), qui varient selon le nombre d'appareils et la durée.
Le logo est le logo officiel « panda, a WatchGuard brand » de l'en-tête de cette page
(`assets/img/provider-logos/panda-security.svg`). À revérifier : la promesse de
« renouvellement au même prix » (affichée en anglais sur la page), la durée et les
conditions de l'évaluation de 30 jours, et les distinctions AV-Comparatives annoncées
par l'éditeur, non vérifiées sur le site du laboratoire. La page affiche aussi des bandeaux
de saison (Black Friday −70 % sur Premium 10 appareils) susceptibles de changer.

## Actualités

La rubrique statique est accessible depuis `/actualites/`. Les pages utilisent
le gabarit et les repères de menu/contenu du site pour rester éditables dans le backoffice.
La mise en page commune des articles est définie dans `assets/actualites.css`.

La page d'accueil de la rubrique (`/actualites/`) a une mise en page « magazine »
dans `assets/actualites-hub.css` : une mosaïque de trois « Unes » en pleine image
(classes `nh-card`, la première est la grande), puis une grille « Dernières
actualités » (`nh-item`) et deux tuiles vers les guides. Les cartes apparaissent
en fondu au défilement (petit script en bas de page, désactivé si l'on a demandé
moins d'animations). Pour une nouvelle actualité, copier une carte `nh-item` ;
pour changer la Une, modifier les trois cartes `nh-card`. Une image sans
fond neutre (logo) se traite comme celle de Vizio : bloc `nh-item__media--brand`.

Pour ajouter un article, créer son dossier sous `actualites/`, puis mettre à jour
la liste de la rubrique, le bloc « Toutes vos actus » et l'index de recherche dans
`index.html`, ainsi que `sitemap.xml`. Relier l'article aux guides pertinents,
avec des renvois depuis ces guides lorsque le sujet s'y prête.
Sur l'accueil, les actualités reprennent les cartes compactes et le carrousel
des guides et comparatifs ; la rubrique conserve ses cartes éditoriales détaillées.

### Photos des actualités

Pour chaque article présent ou futur, choisir une photographie réelle directement
liée au sujet précis : l'entreprise concernée, ses locaux ou son produit, la personne
citée, ou l'événement décrit. Pas d'illustration générique de cybersécurité, de photo
générée ni de photo d'une autre entreprise présentée comme celle du sujet.
Vérifier les droits de réutilisation avant intégration ; si aucune photo adaptée
n'est disponible avec des droits vérifiables, demander une photo autorisée.
Réutiliser cette photo sur l'accueil, dans la rubrique, dans l'article et dans
ses métadonnées de partage. Ajouter une légende exacte, l'auteur, la source et la
licence. Une photo de contexte ne doit jamais être présentée comme une preuve
d'un piratage ou d'une autre allégation non confirmée.

Photos intégrées :
- Centre de recherche Hisense (2024) : Windmemories,
  [source](https://commons.wikimedia.org/wiki/File:20240730_Hisense_R%26D_Center.jpg),
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- Jared Kushner (2025) : Andrea Hanks / The White House,
  [source](https://commons.wikimedia.org/wiki/File:Jared_Kushner_2025.jpg),
  domaine public (photographie officielle fédérale américaine).
- Vizio : logo de la marque, utilisé à défaut de photographie pertinente,
  [source](https://commons.wikimedia.org/wiki/File:VIZIO_logo.svg).
  Graphisme indiqué dans le domaine public ; la marque reste la propriété de Vizio.
- Assemblée nationale (Palais Bourbon, 2014) : DXR,
  [source](https://commons.wikimedia.org/wiki/File:Palais_Bourbon,_Paris_7e,_NW_View_140402_1.jpg),
  domaine public. Photo de contexte de l'article sur les données de partis politiques.
- Siège de la NSA (2013) : Trevor Paglen,
  [source](https://commons.wikimedia.org/wiki/File:National_Security_Agency,_2013.jpg),
  CC0. Photo de contexte du dossier spécial sur l'écoute des téléphones.
- Blocage du lycée Louis-le-Grand, Paris (2 octobre 2026) : Wyslijp16,
  [source](https://commons.wikimedia.org/wiki/File:2026_high_school_student_movement_and_blockades_at_Lyc%C3%A9e_Louis-le-Grand_in_Paris_%E2%80%94_102.jpg),
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), image redimensionnée.
  Choisie car les visages y sont masqués ; illustre l'article sur l'application Cortège.
- Main tenant un smartphone : bohed (Pixabay), via
  [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Smartphone_Use.jpg),
  CC0. Photo d'illustration anonyme du dossier « Pirater le téléphone d'un particulier ».
- Icône Telegram sur un smartphone (2020) : Yuri Samoilov,
  [source](https://commons.wikimedia.org/wiki/File:Telegram_app_icon_on_smartphone_screen_(perspective_render)_(49896396508).jpg),
  [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/), image recadrée et redimensionnée.
  Photo d'illustration de la tribune « Macron sur Telegram : vous êtes sérieux ? ».
- Rayon de surgelés d'un supermarché Dia : Pierre Rudloff,
  [source](https://commons.wikimedia.org/wiki/File:Dia_int%C3%A9rieur.JPG),
  domaine public, image recadrée et redimensionnée.
  Photo d'illustration de l'article sur les frigos de supermarchés piratés.

Les articles proposent des vignettes pour les guides liés et des liens de
partage Facebook, X et LinkedIn utilisant son URL publique canonique. Pour
Instagram, qui ne fournit pas de partage web direct, le bouton copie le lien ;
un champ permet la copie manuelle si le presse-papiers est indisponible.
Les logos SVG sont servis localement depuis les fichiers `assets/img/social-*.svg`.

### Dossier spécial

Un contenu long, documentaire, porte la mention « Dossier spécial » : surtitre et
fil d'Ariane de l'article, encart dédié au-dessus de « À la une » dans la rubrique
(`see-also-card--special`) et mention « Dossier spécial » sur la carte de l'accueil.
Le sommaire en tête d'article (`news-toc`), les schémas (`news-figure`) et les
numéros de section (`news-num`) sont définis dans `assets/actualites.css`, ainsi que
les chiffres clés en tête de section (`news-stats`). Les dossiers déjà publiés :
écoute des téléphones par les services de renseignement, et « Pirater le téléphone
d'un particulier ».

## Fiches pratiques

Vingt fiches pas à pas (1 200 à 1 600 mots chacune) sont publiées à plat sous
`/particuliers/<slug>/` (17 fiches) et `/pro/<slug>/` (3 fiches : rançongiciel en PME,
fraude au président, kit de crise TPE). Elles utilisent le gabarit des articles
(`news-layout`), la mention « Fiche pratique » (fil d'Ariane et `article:section`),
une visuelle éditoriale du site (pas de photo à créditer), un bloc « Réponse rapide »,
un sommaire, une FAQ (données structurées `FAQPage`), des sources officielles et des
renvois vers les guides existants. Elles sont listées dans la section « Fiches
pratiques » de la page `/guides/` (ancre `#fiches-pratiques`), le sitemap et la
recherche. Règles de rédaction : aucun chiffre non sourcé, aucun exemple présenté
comme réel, aucun lien d'affiliation, aucun nom de gestionnaire de mots de passe.

## Partage des articles sur Facebook

Le script `scripts/facebook_share.py` publie un article sur la **Page** Facebook
(l'API ne permet pas de publier sur un profil personnel). Il lit le titre, la
description, l'image et l'URL canonique dans les balises `og:*` de l'article, vérifie
que la page est en ligne, demande à Facebook d'actualiser son aperçu, puis publie le
lien avec le texte d'accroche fourni. Il n'a besoin d'aucune dépendance Python.
Le dossier `scripts/` n'est pas déployé sur le site.

### Mise en place (une seule fois)

1. Sur <https://developers.facebook.com>, créer une application de type « Entreprise »
   et ajouter le produit « Facebook Login for Business » (ou utiliser le Graph API Explorer).
2. Dans le Graph API Explorer, choisir l'application, demander les autorisations
   `pages_show_list`, `pages_read_engagement` et `pages_manage_posts`, puis générer un
   jeton utilisateur en sélectionnant la Page.
3. Échanger ce jeton contre un jeton longue durée, puis appeler `/me/accounts` pour
   récupérer le **jeton de Page** (qui n'expire pas lorsqu'il vient d'un jeton longue
   durée) et l'**identifiant de la Page**.
4. Copier `scripts/.env.facebook.example` en `scripts/.env.facebook` et renseigner
   `FB_PAGE_ID` et `FB_PAGE_ACCESS_TOKEN`. Ce fichier est ignoré par Git : ne jamais
   le versionner ni communiquer le jeton.
5. Vérifier : `python scripts/facebook_share.py check`.

Tant que l'application reste en mode développement, seuls ses administrateurs et
testeurs peuvent publier : c'est suffisant pour la Page du site, sans validation Meta.

### Utilisation

```
python scripts/facebook_share.py share <slug> --message "Accroche"            # aperçu seul
python scripts/facebook_share.py share <slug> --message "Accroche" --publish  # publication
python scripts/facebook_share.py share <slug> --message "..." --schedule "2026-11-03 09:00" --publish
```

Options : `--hashtags`, `--schedule` (10 minutes à 30 jours à l'avance), `--force`
(repartager un article déjà publié), `--no-utm`. Les partages sont consignés dans
`scripts/facebook-posts.log.jsonl` (ignoré par Git) pour éviter les doublons.
L'article doit d'abord être publié sur le site : Facebook lit la page en ligne.

### À partir d'une simple demande

Dans VS Code, la commande `/partager-facebook` (fichier
`.github/prompts/partager-facebook.prompt.md`) ou une demande du type « partage
l'article X sur Facebook » déclenche le processus : l'assistant rédige l'accroche
à partir de l'article, affiche l'aperçu, demande confirmation, puis publie.