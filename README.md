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

Les articles proposent des vignettes pour les guides liés et des liens de
partage Facebook, X et LinkedIn utilisant son URL publique canonique. Pour
Instagram, qui ne fournit pas de partage web direct, le bouton copie le lien ;
un champ permet la copie manuelle si le presse-papiers est indisponible.
Les logos SVG sont servis localement depuis les fichiers `assets/img/social-*.svg`.