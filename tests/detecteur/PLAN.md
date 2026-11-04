# Plan : refonte du détecteur d'arnaque

1. L0 (fait) : harnais de test (corpus, jsdom) et baseline chiffrée de l'outil actuel.
2. L1 (fait) : verdict honnête (4 niveaux, plus de « sain », plus de score, bloc « ce qui n'a pas pu être vérifié »).
3. L2 (fait) : moteur séparé (`regles.js` + `moteur.js`), liens v2, 14 scénarios, négation, anglais.
4. L3 (fait) : rendu (surlignage sans `innerHTML`, trois sections, « Copier le résumé », parcours au clavier).
5. L4 (fait) : e-mails bruts et `.eml`, codes QR (chargement à la demande), âge des domaines facultatif.
6. L5 et L6 (faits) : 140 messages dont 69 de validation, `BENCHMARK.md`, bloc « Méthode » sur la page.

Commandes : `npm install`, `npm test` (232 tests), `npm run benchmark` (régénère `BENCHMARK.md` et le bloc de la page).
Reste à faire : validation humaine (voir `NOTES.md`), puis déploiement.
