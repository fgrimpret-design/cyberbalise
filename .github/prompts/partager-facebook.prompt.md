---
description: Partager un article de la rubrique Actualités sur la Page Facebook de CyberBalise
agent: agent
---

Partage sur la Page Facebook de CyberBalise l'article suivant : ${input:article:slug, chemin ou URL de l'article}

Procédure à suivre, dans l'ordre :

1. Retrouver l'article dans `actualites/` et lire son contenu pour rédiger une accroche fidèle.
2. Vérifier que l'article est déjà en ligne sur https://cyberbalise.fr (sinon, le signaler et s'arrêter : il faut d'abord publier le site).
3. Rédiger en français une accroche de 1 à 3 phrases (environ 250 caractères), sobre, sans formule racoleuse ni emoji, qui respecte les réserves de l'article (par exemple « non confirmé », « revendication »), puis 2 à 4 hashtags pertinents.
4. Lancer l'aperçu : `python scripts/facebook_share.py share <slug> --message "<accroche>" --hashtags "<hashtags>"`.
5. Présenter à l'utilisateur le titre, le lien, l'image et le texte, et demander confirmation (ou une planification avec `--schedule`) avant toute publication.
6. Après accord explicite, relancer la même commande avec `--publish` et communiquer l'adresse du post.

Règles :

- Ne jamais afficher, copier ni enregistrer le jeton d'accès ; il vit uniquement dans `scripts/.env.facebook` (ignoré par Git).
- Si les identifiants manquent ou si le jeton est expiré, renvoyer vers la section « Partage des articles sur Facebook » du README sans contourner le script.
- Si l'article a déjà été partagé, le dire et ne repartager (`--force`) que sur demande explicite.
