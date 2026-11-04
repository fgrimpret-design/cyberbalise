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
