# Plan : refonte du détecteur d'arnaque

1. L0 : harnais de test (corpus, jsdom) et baseline chiffrée de l'outil actuel.
2. L1 : verdict honnête (4 niveaux, plus de « sain », plus de score, bloc « ce qui n'a pas pu être vérifié »).
3. L2 : moteur séparé (`regles.js` + `moteur.js`), liens v2, scénarios, négation, anglais.
4. L3 : rendu (surlignage sans `innerHTML`, trois sections, « Copier le résumé », 360 px).
5. L4 : en-têtes d'e-mail bruts, QR codes (chargement à la demande), vérification de domaine facultative.
6. L5 et L6 : corpus ≥ 80 cas, `BENCHMARK.md`, bloc « Méthode » visible.

État : voir `git log` ; chaque lot est un commit (`test:`, `feat:`, `fix:`).
