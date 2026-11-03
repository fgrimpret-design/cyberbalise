# BASELINE : outil actuel (avant refonte)

Mesure de la version en production avant refonte (copie figée dans `tests/detecteur/legacy/index.v1.html`), exécutée dans jsdom avec le parcours complet de l'outil. Échelle de l'ancienne version : 1 = « Plutôt sain », 2 = « Douteux », 3 = « Très probablement une arnaque ». Le niveau 1 est comparé à la cible « 0 ou 1 ».

Date de mesure : 2026-11-03. Échantillon : **71 messages** (legitime_transactionnel : 14, legitime_perso : 13, prevention : 7, phishing_fr : 26, phishing_en : 6, ambigu : 5). Les messages sont fictifs ou paraphrasés ; l'échantillon est petit, les pourcentages sont donc indicatifs.

## Synthèse

| Indicateur | Valeur |
|---|---|
| Cas conformes à la cible | 38 / 71 |
| Faux positifs (légitimes ou prévention au niveau ≥ 2) | 19 / 34 (55.9 %) |
| dont au niveau 3 | 12 / 34 |
| Détection (hameçonnages au niveau ≥ 2) | 31 / 32 (96.9 %) |
| Détection forte (niveau 3) | 26 / 32 (81.3 %) |
| Faux négatifs (hameçonnages au niveau ≤ 1) | 1 / 32 (3.1 %) |

## Détail par message

| Id | Catégorie | Message | Niveau mesuré | Cible | Conforme |
|---|---|---|---|---|---|
| B01 | legitime_transactionnel | Amazon : votre commande a été expédiée. Suivez sa livraison… | 3 (Très probablement une arnaque) | 0–1 | **non** |
| B02 | legitime_transactionnel | Votre colis Colissimo sera livré demain entre 9h et 12h. | 2 (Message suspect : prudence) | 0–1 | **non** |
| B03 | legitime_transactionnel | Votre code de confirmation est 482913. Ne le communiquez à … | 2 (Message suspect : prudence) | 0–1 | **non** |
| B04 | legitime_transactionnel | Votre relevé est disponible : https://www.credit-agricole.f… | 2 (Message suspect : prudence) | 0–1 | **non** |
| B05 | legitime_transactionnel | EDF : votre facture de 78,50 € est disponible dans votre es… | 2 (Message suspect : prudence) | 0–1 | **non** |
| B06 | legitime_perso | Bonjour, votre rendez-vous chez le dentiste est confirmé po… | 1 (Peu de signaux d'arnaque détectés) | 0 | **non** |
| B07 | legitime_transactionnel | Votre carte a été utilisée 12,90 € chez CARREFOUR. Si ce n'… | 1 (Peu de signaux d'arnaque détectés) | 0–1 | oui |
| B08 | prevention | Ne communiquez jamais votre code de confirmation, même à vo… | 2 (Message suspect : prudence) | 0 | **non** |
| B09 | phishing_fr | Colissimo : votre colis n'a pas pu être livré faute de frai… | 3 (Très probablement une arnaque) | 3 | oui |
| B10 | phishing_fr | URGENT : votre compte bancaire sera suspendu. Confirmez vos… | 3 (Très probablement une arnaque) | 3 | oui |
| B11 | phishing_en | Dear customer, your account has been limited. Verify your i… | 1 (Peu de signaux d'arnaque détectés) | 3 | **non** |
| B12 | phishing_fr | Bonjour, une nouvelle connexion a été détectée sur votre es… | 2 (Message suspect : prudence) | 2–3 | oui |
| B13 | phishing_fr | [Service Facturation <facturation@edf-facture.top>] Bonjour… | 2 (Message suspect : prudence) | 3 | **non** |
| B14 | phishing_fr | Votre véhicule a circulé sur le réseau autoroutier sans pai… | 3 (Très probablement une arnaque) | 3 | oui |
| B15 | phishing_fr | Amazon : votre compte sera suspendu. Confirmez ici → https:… | 3 (Très probablement une arnaque) | 3 | oui |
| B16 | phishing_fr | https://amazon.fr@evil.top/login | 3 (Très probablement une arnaque) | 3 | oui |
| B17 | phishing_fr | Bonjour papa, c'est mon nouveau numéro, mon téléphone est c… | 3 (Très probablement une arnaque) | 3 | oui |
| B18 | phishing_fr | From: ameli@ameli-secure.top Authentication-Results: mx.exa… | 3 (Très probablement une arnaque) | 3 | oui |
| B19 | phishing_fr | Votre forfait mobile sera résilié aujourd'hui. Réactivez la… | 3 (Très probablement une arnaque) | 3 | oui |
| B20 | phishing_fr | QR : https://amendes-antai-paiement.top | 3 (Très probablement une arnaque) | 3 | oui |
| P01 | legitime_perso | On se retrouve à 19h devant le cinéma ? J'ai pris les place… | 1 (Peu de signaux d'arnaque détectés) | 0 | **non** |
| P02 | legitime_perso | Coucou maman, c'est Léa. Je passe dimanche pour le déjeuner… | 1 (Peu de signaux d'arnaque détectés) | 0 | **non** |
| P03 | legitime_perso | Réunion décalée à 15h, salle B. Merci de confirmer par reto… | 1 (Peu de signaux d'arnaque détectés) | 0–1 | oui |
| P04 | legitime_perso | [Claire Dubois <claire.dubois@cabinet-dubois.fr>] Bonjour, … | 2 (Message suspect : prudence) | 0–1 | **non** |
| P05 | legitime_perso | Salut, tu peux me virer les 25 € du resto quand tu as un mo… | 1 (Peu de signaux d'arnaque détectés) | 0–1 | oui |
| P06 | legitime_perso | Bonjour, votre réservation au restaurant Le Zinc est confir… | 1 (Peu de signaux d'arnaque détectés) | 0 | **non** |
| P07 | legitime_perso | Le plombier passera demain entre 14h et 16h. Pensez à laiss… | 1 (Peu de signaux d'arnaque détectés) | 0 | **non** |
| P08 | legitime_perso | Joyeux anniversaire ! On fait un cadeau commun, 15 € chacun… | 1 (Peu de signaux d'arnaque détectés) | 0–1 | oui |
| P09 | legitime_perso | Bonjour Madame Martin, votre ordonnance est prête à la phar… | 1 (Peu de signaux d'arnaque détectés) | 0 | **non** |
| P10 | legitime_perso | Papa, j'ai raté mon train, je rentre avec le suivant à 18h.… | 1 (Peu de signaux d'arnaque détectés) | 0 | **non** |
| P11 | legitime_perso | [syndic@residence-des-tilleuls.fr] Bonjour, Rappel : l'asse… | 1 (Peu de signaux d'arnaque détectés) | 0–1 | oui |
| P12 | legitime_perso | Ton colis est chez la voisine du 3e, je te le dépose ce soi… | 1 (Peu de signaux d'arnaque détectés) | 0 | **non** |
| T01 | legitime_transactionnel | [DOCTOLIB] Votre code de connexion Doctolib est 531892. Il … | 1 (Peu de signaux d'arnaque détectés) | 0–1 | oui |
| T02 | legitime_transactionnel | [LAPOSTE] La Poste : votre colis sera livré demain. Suivi :… | 3 (Très probablement une arnaque) | 0–1 | **non** |
| T03 | legitime_transactionnel | [Chronopost] Chronopost : votre colis est en cours de livra… | 3 (Très probablement une arnaque) | 0–1 | **non** |
| T04 | legitime_transactionnel | Crédit Agricole : paiement de 54,20 € chez FNAC par carte s… | 3 (Très probablement une arnaque) | 0–1 | **non** |
| T05 | legitime_transactionnel | [Google] G-482913 est votre code de validation Google. Ne l… | 3 (Très probablement une arnaque) | 0–1 | **non** |
| T06 | legitime_transactionnel | [EDF <ne-pas-repondre@edf.fr>] Bonjour, Votre facture de 78… | 3 (Très probablement une arnaque) | 0–1 | **non** |
| T07 | legitime_transactionnel | [Netflix <info@account.netflix.com>] Bonjour, Nous avons bi… | 3 (Très probablement une arnaque) | 0–1 | **non** |
| T08 | legitime_transactionnel | [Mondial Relay] Mondial Relay : votre colis est disponible … | 3 (Très probablement une arnaque) | 0–1 | **non** |
| V01 | prevention | Attention aux arnaques : votre banque ne vous demandera jam… | 2 (Message suspect : prudence) | 0 | **non** |
| V02 | prevention | Conseil : n'envoyez jamais de photo de votre carte bancaire… | 1 (Peu de signaux d'arnaque détectés) | 0 | **non** |
| V03 | prevention | Hameçonnage : un message qui vous presse de payer sous 24 h… | 3 (Très probablement une arnaque) | 0–1 | **non** |
| V04 | prevention | Si un faux conseiller vous demande de valider une opération… | 3 (Très probablement une arnaque) | 0–1 | **non** |
| V05 | prevention | Les faux colis : on vous demande 1,99 € de frais de livrais… | 3 (Très probablement une arnaque) | 0–1 | **non** |
| V06 | prevention | [CyberBalise <newsletter@cyberbalise.fr>] Bonjour, Cette se… | 3 (Très probablement une arnaque) | 0–1 | **non** |
| F01 | phishing_fr | [06 12 34 56 78] Ameli : votre carte Vitale est arrivée à e… | 3 (Très probablement une arnaque) | 3 | oui |
| F02 | phishing_fr | [Direction Générale des Finances Publiques <remboursement@i… | 3 (Très probablement une arnaque) | 3 | oui |
| F03 | phishing_fr | [+44 7700 900123] Banque Populaire : une opération suspecte… | 3 (Très probablement une arnaque) | 2–3 | oui |
| F04 | phishing_fr | Salut maman, j'ai cassé mon téléphone, voici mon nouveau nu… | 3 (Très probablement une arnaque) | 3 | oui |
| F05 | phishing_fr | Votre compte formation CPF est suspendu. Régularisez avant … | 3 (Très probablement une arnaque) | 3 | oui |
| F06 | phishing_fr | J'ai pris le contrôle de votre webcam et enregistré une vid… | 3 (Très probablement une arnaque) | 3 | oui |
| F07 | phishing_fr | Doublez votre capital en 30 jours : rendement garanti de 18… | 3 (Très probablement une arnaque) | 3 | oui |
| F08 | phishing_fr | [Direction <direction.generale@societe-groupe.com>] Bonjour… | 3 (Très probablement une arnaque) | 2–3 | oui |
| F09 | phishing_fr | ALERTE : votre ordinateur est infecté par un virus. N'éteig… | 3 (Très probablement une arnaque) | 3 | oui |
| F10 | phishing_fr | ANTAI : une amende de 35 € est en attente. Réglez avant 24h… | 3 (Très probablement une arnaque) | 3 | oui |
| F11 | phishing_fr | Isolation de vos combles à 1 € ! Dossier MaPrimeRénov' pré-… | 2 (Message suspect : prudence) | 2–3 | oui |
| F12 | phishing_fr | Bonjour, votre livreur a tenté de vous joindre, je repasse … | 3 (Très probablement une arnaque) | 2–3 | oui |
| F13 | phishing_fr | [Netflix <service@netflix-billing-support.com>] Bonjour, Vo… | 3 (Très probablement une arnaque) | 3 | oui |
| F14 | phishing_fr | Chronopost : votre colis est retenu au dépôt. Réglez 2,49 €… | 3 (Très probablement une arnaque) | 3 | oui |
| F15 | phishing_fr | France Travail : votre allocation est suspendue. Actualisez… | 3 (Très probablement une arnaque) | 3 | oui |
| E01 | phishing_en | Dear user, unusual activity has been detected on your PayPa… | 2 (Message suspect : prudence) | 3 | **non** |
| E02 | phishing_en | Your package could not be delivered. A customs fee of £2.99… | 2 (Message suspect : prudence) | 3 | **non** |
| E03 | phishing_en | Your Apple ID has been locked for security reasons. Verify … | 3 (Très probablement une arnaque) | 3 | oui |
| E04 | phishing_en | Congratulations! You have been selected to receive a $500 g… | 3 (Très probablement une arnaque) | 2–3 | oui |
| E05 | phishing_en | Final notice: your password expires today. Sign in to confi… | 3 (Très probablement une arnaque) | 3 | oui |
| A01 | ambigu | Votre abonnement expire dans 3 jours. Renouvelez-le depuis … | 1 (Peu de signaux d'arnaque détectés) | 0–2 | oui |
| A02 | ambigu | [Boutique Atelier <contact@atelier-boutique.fr>] Profitez d… | 2 (Message suspect : prudence) | 0–1 | **non** |
| A03 | ambigu | Bonjour, je suis intéressé par votre vélo, est-il toujours … | 2 (Message suspect : prudence) | 0–2 | oui |
| A04 | ambigu | URGENT : réunion à 15h en salle 3, merci de confirmer imméd… | 1 (Peu de signaux d'arnaque détectés) | 0–2 | oui |
| A05 | ambigu | Bonjour, votre annonce m'intéresse. Je suis à l'étranger : … | 1 (Peu de signaux d'arnaque détectés) | 1–3 | oui |

## Cas de non-régression de l'annexe B du cahier des charges

| Annexe | Id | Niveau mesuré | Cible | Conforme |
|---|---|---|---|---|
| 1 | B01 | 3 | 0–1 | **non** |
| 2 | B02 | 2 | 0–1 | **non** |
| 3 | B03 | 2 | 0–1 | **non** |
| 4 | B04 | 2 | 0–1 | **non** |
| 5 | B05 | 2 | 0–1 | **non** |
| 6 | B06 | 1 | 0 | **non** |
| 7 | B07 | 1 | 0–1 | oui |
| 8 | B08 | 2 | 0 | **non** |
| 9 | B09 | 3 | 3 | oui |
| 10 | B10 | 3 | 3 | oui |
| 11 | B11 | 1 | 3 | **non** |
| 12 | B12 | 2 | 2–3 | oui |
| 13 | B13 | 2 | 3 | **non** |
| 14 | B14 | 3 | 3 | oui |
| 15 | B15 | 3 | 3 | oui |
| 16 | B16 | 3 | 3 | oui |
| 17 | B17 | 3 | 3 | oui |
| 18 | B18 | 3 | 3 | oui |
| 19 | B19 | 3 | 3 | oui |
| 20 | B20 | 3 | 3 | oui |

Annexe B conforme : **11 / 20**.

Faux positifs : B01 (niveau 3), B02 (niveau 2), B03 (niveau 2), B04 (niveau 2), B05 (niveau 2), B08 (niveau 2), P04 (niveau 2), T02 (niveau 3), T03 (niveau 3), T04 (niveau 3), T05 (niveau 3), T06 (niveau 3), T07 (niveau 3), T08 (niveau 3), V01 (niveau 2), V03 (niveau 3), V04 (niveau 3), V05 (niveau 3), V06 (niveau 3).

Faux négatifs : B11 (niveau 1).

_Fichier généré par `node tests/detecteur/run.mjs --legacy`. Ne pas modifier à la main._
