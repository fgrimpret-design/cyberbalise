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
