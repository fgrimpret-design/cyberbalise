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

L'outil privilégie l'import local d'images PNG/JPG/WebP ou de fichiers texte
`.txt` (10 Mo maximum). Les PDF et documents Office ne sont pas pris en charge.
Après import, le texte est présenté pour relecture avant analyse manuelle.
Le résultat affiche le niveau sur une échelle de vigilance à trois niveaux,
le score pondéré et ses seuils (0–3, 4–7, 8 et plus), sans le présenter comme
une probabilité de fraude. Un signal de poids au moins 4 impose le niveau 2.

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
La mise en page commune et les cartes de l'accueil sont définies dans `assets/actualites.css`.

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
numéros de section (`news-num`) sont définis dans `assets/actualites.css`.

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