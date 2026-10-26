# cyberbalise

## Top protections

Le module partagé utilise `assets/top-protections.js` et `assets/site-spacing.css`.
Chaque catégorie affiche ses trois premières cartes. Au-delà, le bouton
« Voir tous les résultats » déplie la liste et permet ensuite de la réduire.
L'état est indépendant par catégorie et conservé lors des changements d'onglet.
Sans JavaScript, toutes les cartes restent accessibles.

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