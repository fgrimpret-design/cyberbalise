# BASELINE : outil actuel (avant refonte)

Mesure de la version en production avant refonte (copie figée dans `tests/detecteur/legacy/index.v1.html`), exécutée dans jsdom avec le parcours complet de l'outil. Échelle de l'ancienne version : 1 = « Plutôt sain », 2 = « Douteux », 3 = « Très probablement une arnaque ». Le niveau 1 est comparé à la cible « 0 ou 1 ».

Date de mesure : 2026-11-04. Échantillon : **140 messages** (legitime_transactionnel : 31, legitime_perso : 19, prevention : 9, phishing_fr : 60, phishing_en : 11, ambigu : 10). Les messages sont fictifs ou paraphrasés ; l'échantillon est petit, les pourcentages sont donc indicatifs.

Le corpus compte deux séries : **développement** (71 messages, écrits en même temps que les règles : leur score mesure la cohérence interne) et **validation** (69 messages, rédigés ensuite et à part, sans consulter les règles : seule cette série donne une idée de la généralisation).

## Synthèse

| Indicateur | Ensemble | Développement | Validation |
|---|---|---|---|
| Cas conformes à la cible | 79 / 140 | 38 / 71 | 41 / 69 |
| Faux positifs (légitimes ou prévention au niveau ≥ 2) | 35 / 59 (59.3 %) | 19 / 34 (55.9 %) | 16 / 25 (64 %) |
| dont au niveau 3 | 17 / 59 | 12 / 34 | 5 / 25 |
| Détection (hameçonnages au niveau ≥ 2) | 63 / 71 (88.7 %) | 31 / 32 (96.9 %) | 32 / 39 (82.1 %) |
| Détection forte (niveau 3) | 45 / 71 (63.4 %) | 26 / 32 (81.3 %) | 19 / 39 (48.7 %) |
| Faux négatifs (hameçonnages au niveau ≤ 1) | 8 / 71 (11.3 %) | 1 / 32 (3.1 %) | 7 / 39 (17.9 %) |

Limites connues (déclarées, hors cible) : **N04** : Message vague sans marque ni menace : seul le lien en .top est repérable (niveau 1). Le classer plus haut ferait monter les faux positifs.

## Détail par message

| Id | Série | Catégorie | Message | Niveau mesuré | Cible | Conforme |
|---|---|---|---|---|---|---|
| B01 | dev | legitime_transactionnel | Amazon : votre commande a été expédiée. Suivez sa livraison… | 3 (Très probablement une arnaque) | 0–1 | **non** |
| B02 | dev | legitime_transactionnel | Votre colis Colissimo sera livré demain entre 9h et 12h. | 2 (Message suspect : prudence) | 0–1 | **non** |
| B03 | dev | legitime_transactionnel | Votre code de confirmation est 482913. Ne le communiquez à … | 2 (Message suspect : prudence) | 0–1 | **non** |
| B04 | dev | legitime_transactionnel | Votre relevé est disponible : https://www.credit-agricole.f… | 2 (Message suspect : prudence) | 0–1 | **non** |
| B05 | dev | legitime_transactionnel | EDF : votre facture de 78,50 € est disponible dans votre es… | 2 (Message suspect : prudence) | 0–1 | **non** |
| B06 | dev | legitime_perso | Bonjour, votre rendez-vous chez le dentiste est confirmé po… | 1 (Peu de signaux d'arnaque détectés) | 0 | **non** |
| B07 | dev | legitime_transactionnel | Votre carte a été utilisée 12,90 € chez CARREFOUR. Si ce n'… | 1 (Peu de signaux d'arnaque détectés) | 0–1 | oui |
| B08 | dev | prevention | Ne communiquez jamais votre code de confirmation, même à vo… | 2 (Message suspect : prudence) | 0 | **non** |
| B09 | dev | phishing_fr | Colissimo : votre colis n'a pas pu être livré faute de frai… | 3 (Très probablement une arnaque) | 3 | oui |
| B10 | dev | phishing_fr | URGENT : votre compte bancaire sera suspendu. Confirmez vos… | 3 (Très probablement une arnaque) | 3 | oui |
| B11 | dev | phishing_en | Dear customer, your account has been limited. Verify your i… | 1 (Peu de signaux d'arnaque détectés) | 3 | **non** |
| B12 | dev | phishing_fr | Bonjour, une nouvelle connexion a été détectée sur votre es… | 2 (Message suspect : prudence) | 2–3 | oui |
| B13 | dev | phishing_fr | [Service Facturation <facturation@edf-facture.top>] Bonjour… | 2 (Message suspect : prudence) | 3 | **non** |
| B14 | dev | phishing_fr | Votre véhicule a circulé sur le réseau autoroutier sans pai… | 3 (Très probablement une arnaque) | 3 | oui |
| B15 | dev | phishing_fr | Amazon : votre compte sera suspendu. Confirmez ici → https:… | 3 (Très probablement une arnaque) | 3 | oui |
| B16 | dev | phishing_fr | https://amazon.fr@evil.top/login | 3 (Très probablement une arnaque) | 3 | oui |
| B17 | dev | phishing_fr | Bonjour papa, c'est mon nouveau numéro, mon téléphone est c… | 3 (Très probablement une arnaque) | 3 | oui |
| B18 | dev | phishing_fr | From: ameli@ameli-secure.top Authentication-Results: mx.exa… | 3 (Très probablement une arnaque) | 3 | oui |
| B19 | dev | phishing_fr | Votre forfait mobile sera résilié aujourd'hui. Réactivez la… | 3 (Très probablement une arnaque) | 3 | oui |
| B20 | dev | phishing_fr | QR : https://amendes-antai-paiement.top | 3 (Très probablement une arnaque) | 3 | oui |
| P01 | dev | legitime_perso | On se retrouve à 19h devant le cinéma ? J'ai pris les place… | 1 (Peu de signaux d'arnaque détectés) | 0 | **non** |
| P02 | dev | legitime_perso | Coucou maman, c'est Léa. Je passe dimanche pour le déjeuner… | 1 (Peu de signaux d'arnaque détectés) | 0 | **non** |
| P03 | dev | legitime_perso | Réunion décalée à 15h, salle B. Merci de confirmer par reto… | 1 (Peu de signaux d'arnaque détectés) | 0–1 | oui |
| P04 | dev | legitime_perso | [Claire Dubois <claire.dubois@cabinet-dubois.fr>] Bonjour, … | 2 (Message suspect : prudence) | 0–1 | **non** |
| P05 | dev | legitime_perso | Salut, tu peux me virer les 25 € du resto quand tu as un mo… | 1 (Peu de signaux d'arnaque détectés) | 0–1 | oui |
| P06 | dev | legitime_perso | Bonjour, votre réservation au restaurant Le Zinc est confir… | 1 (Peu de signaux d'arnaque détectés) | 0 | **non** |
| P07 | dev | legitime_perso | Le plombier passera demain entre 14h et 16h. Pensez à laiss… | 1 (Peu de signaux d'arnaque détectés) | 0 | **non** |
| P08 | dev | legitime_perso | Joyeux anniversaire ! On fait un cadeau commun, 15 € chacun… | 1 (Peu de signaux d'arnaque détectés) | 0–1 | oui |
| P09 | dev | legitime_perso | Bonjour Madame Martin, votre ordonnance est prête à la phar… | 1 (Peu de signaux d'arnaque détectés) | 0 | **non** |
| P10 | dev | legitime_perso | Papa, j'ai raté mon train, je rentre avec le suivant à 18h.… | 1 (Peu de signaux d'arnaque détectés) | 0 | **non** |
| P11 | dev | legitime_perso | [syndic@residence-des-tilleuls.fr] Bonjour, Rappel : l'asse… | 1 (Peu de signaux d'arnaque détectés) | 0–1 | oui |
| P12 | dev | legitime_perso | Ton colis est chez la voisine du 3e, je te le dépose ce soi… | 1 (Peu de signaux d'arnaque détectés) | 0 | **non** |
| T01 | dev | legitime_transactionnel | [DOCTOLIB] Votre code de connexion Doctolib est 531892. Il … | 1 (Peu de signaux d'arnaque détectés) | 0–1 | oui |
| T02 | dev | legitime_transactionnel | [LAPOSTE] La Poste : votre colis sera livré demain. Suivi :… | 3 (Très probablement une arnaque) | 0–1 | **non** |
| T03 | dev | legitime_transactionnel | [Chronopost] Chronopost : votre colis est en cours de livra… | 3 (Très probablement une arnaque) | 0–1 | **non** |
| T04 | dev | legitime_transactionnel | Crédit Agricole : paiement de 54,20 € chez FNAC par carte s… | 3 (Très probablement une arnaque) | 0–1 | **non** |
| T05 | dev | legitime_transactionnel | [Google] G-482913 est votre code de validation Google. Ne l… | 3 (Très probablement une arnaque) | 0–1 | **non** |
| T06 | dev | legitime_transactionnel | [EDF <ne-pas-repondre@edf.fr>] Bonjour, Votre facture de 78… | 3 (Très probablement une arnaque) | 0–1 | **non** |
| T07 | dev | legitime_transactionnel | [Netflix <info@account.netflix.com>] Bonjour, Nous avons bi… | 3 (Très probablement une arnaque) | 0–1 | **non** |
| T08 | dev | legitime_transactionnel | [Mondial Relay] Mondial Relay : votre colis est disponible … | 3 (Très probablement une arnaque) | 0–1 | **non** |
| V01 | dev | prevention | Attention aux arnaques : votre banque ne vous demandera jam… | 2 (Message suspect : prudence) | 0 | **non** |
| V02 | dev | prevention | Conseil : n'envoyez jamais de photo de votre carte bancaire… | 1 (Peu de signaux d'arnaque détectés) | 0 | **non** |
| V03 | dev | prevention | Hameçonnage : un message qui vous presse de payer sous 24 h… | 3 (Très probablement une arnaque) | 0–1 | **non** |
| V04 | dev | prevention | Si un faux conseiller vous demande de valider une opération… | 3 (Très probablement une arnaque) | 0–1 | **non** |
| V05 | dev | prevention | Les faux colis : on vous demande 1,99 € de frais de livrais… | 3 (Très probablement une arnaque) | 0–1 | **non** |
| V06 | dev | prevention | [CyberBalise <newsletter@cyberbalise.fr>] Bonjour, Cette se… | 3 (Très probablement une arnaque) | 0–1 | **non** |
| F01 | dev | phishing_fr | [06 12 34 56 78] Ameli : votre carte Vitale est arrivée à e… | 3 (Très probablement une arnaque) | 3 | oui |
| F02 | dev | phishing_fr | [Direction Générale des Finances Publiques <remboursement@i… | 3 (Très probablement une arnaque) | 3 | oui |
| F03 | dev | phishing_fr | [+44 7700 900123] Banque Populaire : une opération suspecte… | 3 (Très probablement une arnaque) | 2–3 | oui |
| F04 | dev | phishing_fr | Salut maman, j'ai cassé mon téléphone, voici mon nouveau nu… | 3 (Très probablement une arnaque) | 3 | oui |
| F05 | dev | phishing_fr | Votre compte formation CPF est suspendu. Régularisez avant … | 3 (Très probablement une arnaque) | 3 | oui |
| F06 | dev | phishing_fr | J'ai pris le contrôle de votre webcam et enregistré une vid… | 3 (Très probablement une arnaque) | 3 | oui |
| F07 | dev | phishing_fr | Doublez votre capital en 30 jours : rendement garanti de 18… | 3 (Très probablement une arnaque) | 3 | oui |
| F08 | dev | phishing_fr | [Direction <direction.generale@societe-groupe.com>] Bonjour… | 3 (Très probablement une arnaque) | 2–3 | oui |
| F09 | dev | phishing_fr | ALERTE : votre ordinateur est infecté par un virus. N'éteig… | 3 (Très probablement une arnaque) | 3 | oui |
| F10 | dev | phishing_fr | ANTAI : une amende de 35 € est en attente. Réglez avant 24h… | 3 (Très probablement une arnaque) | 3 | oui |
| F11 | dev | phishing_fr | Isolation de vos combles à 1 € ! Dossier MaPrimeRénov' pré-… | 2 (Message suspect : prudence) | 2–3 | oui |
| F12 | dev | phishing_fr | Bonjour, votre livreur a tenté de vous joindre, je repasse … | 3 (Très probablement une arnaque) | 2–3 | oui |
| F13 | dev | phishing_fr | [Netflix <service@netflix-billing-support.com>] Bonjour, Vo… | 3 (Très probablement une arnaque) | 3 | oui |
| F14 | dev | phishing_fr | Chronopost : votre colis est retenu au dépôt. Réglez 2,49 €… | 3 (Très probablement une arnaque) | 3 | oui |
| F15 | dev | phishing_fr | France Travail : votre allocation est suspendue. Actualisez… | 3 (Très probablement une arnaque) | 3 | oui |
| E01 | dev | phishing_en | Dear user, unusual activity has been detected on your PayPa… | 2 (Message suspect : prudence) | 3 | **non** |
| E02 | dev | phishing_en | Your package could not be delivered. A customs fee of £2.99… | 2 (Message suspect : prudence) | 3 | **non** |
| E03 | dev | phishing_en | Your Apple ID has been locked for security reasons. Verify … | 3 (Très probablement une arnaque) | 3 | oui |
| E04 | dev | phishing_en | Congratulations! You have been selected to receive a $500 g… | 3 (Très probablement une arnaque) | 2–3 | oui |
| E05 | dev | phishing_en | Final notice: your password expires today. Sign in to confi… | 3 (Très probablement une arnaque) | 3 | oui |
| A01 | dev | ambigu | Votre abonnement expire dans 3 jours. Renouvelez-le depuis … | 1 (Peu de signaux d'arnaque détectés) | 0–2 | oui |
| A02 | dev | ambigu | [Boutique Atelier <contact@atelier-boutique.fr>] Profitez d… | 2 (Message suspect : prudence) | 0–1 | **non** |
| A03 | dev | ambigu | Bonjour, je suis intéressé par votre vélo, est-il toujours … | 2 (Message suspect : prudence) | 0–2 | oui |
| A04 | dev | ambigu | URGENT : réunion à 15h en salle 3, merci de confirmer imméd… | 1 (Peu de signaux d'arnaque détectés) | 0–2 | oui |
| A05 | dev | ambigu | Bonjour, votre annonce m'intéresse. Je suis à l'étranger : … | 1 (Peu de signaux d'arnaque détectés) | 1–3 | oui |
| N01 | validation | phishing_fr | [Télépéage] Vous avez un solde impayé de 6,40 € sur votre t… | 3 (Très probablement une arnaque) | 3 | oui |
| N02 | validation | phishing_fr | Bonjour, un passage au péage n'a pas été réglé. Merci de ré… | 2 (Message suspect : prudence) | 2–3 | oui |
| N03 | validation | phishing_fr | ANTAI : votre avis de contravention n°2294-77 est en attent… | 3 (Très probablement une arnaque) | 3 | oui |
| N04 | validation | phishing_fr | Votre dossier d'infraction nécessite une action. Consultez … | 2 (Message suspect : prudence) | 2–3 | oui |
| N05 | validation | phishing_fr | PARKING : scannez le QR code affiché sur l'horodateur pour … | 3 (Très probablement une arnaque) | 3 | oui |
| N06 | validation | phishing_fr | QR : https://pay-parking-ville.xyz/ticket | 2 (Message suspect : prudence) | 1–3 | oui |
| N07 | validation | phishing_fr | SFR : votre ligne sera suspendue ce soir faute de paiement … | 3 (Très probablement une arnaque) | 3 | oui |
| N08 | validation | phishing_fr | Votre forfait mobile arrive à expiration. Renouvelez-le pou… | 2 (Message suspect : prudence) | 2–3 | oui |
| N09 | validation | phishing_fr | Bonjour, je suis conseiller Mon Compte Formation. Vos droit… | 3 (Très probablement une arnaque) | 2–3 | oui |
| N10 | validation | phishing_fr | Votre solde CPF a été mis à jour. Consultez vos droits ici … | 3 (Très probablement une arnaque) | 2–3 | oui |
| N11 | validation | phishing_fr | Bonjour, je suis intéressé par votre appartement. Je suis e… | 1 (Peu de signaux d'arnaque détectés) | 3 | **non** |
| N12 | validation | phishing_fr | Bonjour, votre logement est-il encore disponible ? Je suis … | 1 (Peu de signaux d'arnaque détectés) | 1–2 | oui |
| N13 | validation | phishing_fr | Dernière chance : isolation de vos combles à 1 € grâce aux … | 2 (Message suspect : prudence) | 3 | **non** |
| N14 | validation | phishing_fr | Bonjour, vous êtes éligible aux aides à la rénovation énerg… | 1 (Peu de signaux d'arnaque détectés) | 1–3 | oui |
| N15 | validation | phishing_fr | Livreur : je suis passé, vous étiez absent. Je repasse dema… | 3 (Très probablement une arnaque) | 3 | oui |
| N16 | validation | phishing_fr | Bonjour, votre colis n'a pas pu être remis. Choisissez un n… | 3 (Très probablement une arnaque) | 2–3 | oui |
| N17 | validation | phishing_fr | Salut papa c'est moi, j'ai changé de numéro. Je t'explique … | 2 (Message suspect : prudence) | 3 | **non** |
| N18 | validation | phishing_fr | Coucou maman, c'est mon nouveau numéro, mon ancien téléphon… | 2 (Message suspect : prudence) | 1–2 | oui |
| N19 | validation | phishing_fr | [Assurance Maladie <noreply@ameli-remboursements.fr>] Bonjo… | 3 (Très probablement une arnaque) | 3 | oui |
| N20 | validation | phishing_en | Microsoft Defender detected a critical virus on your PC. Do… | 2 (Message suspect : prudence) | 3 | **non** |
| N21 | validation | phishing_en | I know your password. I recorded you through your webcam. P… | 2 (Message suspect : prudence) | 3 | **non** |
| N22 | validation | phishing_fr | Rejoignez notre groupe privé : +15 % par semaine garantis, … | 3 (Très probablement une arnaque) | 3 | oui |
| N23 | validation | phishing_fr | [Paul Garnier <p.garnier@societe-garnier.fr>] Bonjour Marie… | 1 (Peu de signaux d'arnaque détectés) | 2–3 | **non** |
| N24 | validation | phishing_fr | Votre acheteur a payé. Pour recevoir votre argent, confirme… | 3 (Très probablement une arnaque) | 3 | oui |
| N25 | validation | phishing_fr | Bonjour, je vous ai envoyé le paiement via Leboncoin Pay. C… | 3 (Très probablement une arnaque) | 2–3 | oui |
| N26 | validation | phishing_fr | Offre d'emploi : 250 € par jour en télétravail, aucun diplô… | 1 (Peu de signaux d'arnaque détectés) | 1–3 | oui |
| N27 | validation | phishing_fr | [Netflix <info@netflix-support.net>] Bonjour, nous n'avons … | 3 (Très probablement une arnaque) | 3 | oui |
| N28 | validation | phishing_en | [PayPal <service@paypal-notice.com>] You sent a payment of … | 3 (Très probablement une arnaque) | 2–3 | oui |
| N29 | validation | phishing_en | HMRC: You are eligible for a tax refund of £384.20. Claim w… | 2 (Message suspect : prudence) | 3 | **non** |
| N30 | validation | phishing_fr | [Chronopost <suivi@chronopost-colis.fr>] Votre colis ne peu… | 3 (Très probablement une arnaque) | 3 | oui |
| N31 | validation | phishing_fr | [Crédit Agricole <conseiller.ca.service@gmail.com>] Une opé… | 2 (Message suspect : prudence) | 3 | **non** |
| N32 | validation | phishing_fr | Salut, je t'ai envoyé un code par SMS par erreur, tu peux m… | 1 (Peu de signaux d'arnaque détectés) | 1–3 | oui |
| N33 | validation | phishing_en | UPS: your package is awaiting an address update. Update her… | 3 (Très probablement une arnaque) | 3 | oui |
| N34 | validation | phishing_fr | BNP Paribas : connexion suspecte détectée, rappelez immédia… | 2 (Message suspect : prudence) | 2–3 | oui |
| N35 | validation | phishing_fr | CAF : un trop-perçu de 412 € vous est réclamé. Contestez so… | 3 (Très probablement une arnaque) | 3 | oui |
| N36 | validation | phishing_fr | [EDF <remboursement@edf-clients-remboursement.com>] Bonjour… | 3 (Très probablement une arnaque) | 3 | oui |
| N37 | validation | phishing_fr | Votre colis est arrivé : https://bit.ly/3Xy9Kqz | 3 (Très probablement une arnaque) | 1–3 | oui |
| N38 | validation | phishing_fr | Votre compte est bloqué, connectez-vous : http://185.234.72… | 2 (Message suspect : prudence) | 2–3 | oui |
| N39 | validation | phishing_fr | Votre compte PayPal est limité : https://pаypal.com/signin | 1 (Peu de signaux d'arnaque détectés) | 3 | **non** |
| M01 | validation | legitime_transactionnel | [Free] Free Mobile : votre facture de 19,99 € est disponibl… | 3 (Très probablement une arnaque) | 0–1 | **non** |
| M02 | validation | legitime_transactionnel | Orange : votre forfait mobile sera renouvelé le 12/11 pour … | 3 (Très probablement une arnaque) | 0–1 | **non** |
| M03 | validation | legitime_transactionnel | [Doctolib] Doctolib : rappel de votre rendez-vous demain à … | 2 (Message suspect : prudence) | 0–1 | **non** |
| M04 | validation | legitime_transactionnel | BNP Paribas : un paiement de 120,00 € par carte a été effec… | 2 (Message suspect : prudence) | 0–1 | **non** |
| M05 | validation | legitime_transactionnel | Votre commande est à retirer avant le 15 novembre à la phar… | 1 (Peu de signaux d'arnaque détectés) | 0–1 | oui |
| M06 | validation | legitime_transactionnel | [Mairie de Lyon <demarches@mairie-lyon.fr>] Bonjour, votre … | 1 (Peu de signaux d'arnaque détectés) | 0–1 | oui |
| M07 | validation | legitime_perso | [Sophie Renard <sophie.renard@cabinet-renard.fr>] Bonjour, … | 2 (Message suspect : prudence) | 0–1 | **non** |
| M08 | validation | legitime_perso | Maman, peux-tu m'avancer 50 € pour le cadeau de mamie ? Je … | 2 (Message suspect : prudence) | 0–1 | **non** |
| M09 | validation | legitime_transactionnel | [BOURSORAMA] Votre code de sécurité Boursorama est 482913. … | 3 (Très probablement une arnaque) | 0–1 | **non** |
| M10 | validation | legitime_transactionnel | Rappel : votre ticket de parking expire à 18h30. Prolongez-… | 1 (Peu de signaux d'arnaque détectés) | 0–1 | oui |
| M11 | validation | legitime_transactionnel | [Decathlon <newsletter@decathlon.fr>] Profitez de -40 % jus… | 2 (Message suspect : prudence) | 0–1 | **non** |
| M12 | validation | legitime_transactionnel | Your Amazon order #123-4567 has shipped and will arrive Thu… | 2 (Message suspect : prudence) | 0–1 | **non** |
| M13 | validation | legitime_transactionnel | Chase: A transaction of $42.18 at Starbucks was made on you… | 1 (Peu de signaux d'arnaque détectés) | 0–1 | oui |
| M14 | validation | legitime_perso | Je suis dans le train, je t'appelle dans 10 minutes. Urgent… | 1 (Peu de signaux d'arnaque détectés) | 0–1 | oui |
| M15 | validation | legitime_transactionnel | Bonjour, je suis votre livreur Chronopost, je serai chez vo… | 2 (Message suspect : prudence) | 0–1 | **non** |
| M16 | validation | legitime_transactionnel | Alerte météo : vigilance orange orages ce soir. Évitez les … | 1 (Peu de signaux d'arnaque détectés) | 0 | **non** |
| M17 | validation | prevention | Attention : des SMS frauduleux circulent au nom de Colissim… | 2 (Message suspect : prudence) | 0–1 | **non** |
| M18 | validation | prevention | Cher client, votre banque ne vous demandera jamais votre mo… | 3 (Très probablement une arnaque) | 0–1 | **non** |
| M19 | validation | legitime_transactionnel | Votre rendez-vous à la CAF est confirmé le 14/11 à 10h. Mun… | 2 (Message suspect : prudence) | 0–1 | **non** |
| M20 | validation | legitime_transactionnel | [Impots.gouv <ne-pas-repondre@impots.gouv.fr>] Bonjour, vot… | 3 (Très probablement une arnaque) | 0–1 | **non** |
| M21 | validation | legitime_perso | Hey, can you send me 20 euros for the pizza? I'll pay you b… | 1 (Peu de signaux d'arnaque détectés) | 0–1 | oui |
| M22 | validation | legitime_perso | Voici les photos de la soirée : https://bit.ly/photos-soire… | 2 (Message suspect : prudence) | 0–1 | **non** |
| M23 | validation | legitime_perso | [Julien Faure <j.faure@faure-conseil.fr>] Madame, Monsieur,… | 2 (Message suspect : prudence) | 0–1 | **non** |
| M24 | validation | legitime_transactionnel | [Netflix] Netflix : votre code de connexion est 4821. Ne le… | 1 (Peu de signaux d'arnaque détectés) | 0–1 | oui |
| M25 | validation | legitime_transactionnel | [Doctolib] Doctolib : code 884219 pour confirmer votre rend… | 1 (Peu de signaux d'arnaque détectés) | 0–1 | oui |
| Q01 | validation | ambigu | Bonjour, je suis intéressé par votre annonce. Pouvez-vous m… | 1 (Peu de signaux d'arnaque détectés) | 0–1 | oui |
| Q02 | validation | ambigu | Votre colis sera livré par La Poste. Pour modifier le créne… | 3 (Très probablement une arnaque) | 0–1 | **non** |
| Q03 | validation | ambigu | Votre abonnement vous sera remboursé sous 5 jours ouvrés. | 1 (Peu de signaux d'arnaque détectés) | 0–1 | oui |
| Q04 | validation | ambigu | Bonjour, vous avez gagné un café offert pour votre prochain… | 2 (Message suspect : prudence) | 0–2 | oui |
| Q05 | validation | ambigu | URGENT : paiement requis avant ce soir pour valider votre i… | 3 (Très probablement une arnaque) | 0–2 | **non** |

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

Faux positifs : B01 (niveau 3), B02 (niveau 2), B03 (niveau 2), B04 (niveau 2), B05 (niveau 2), B08 (niveau 2), P04 (niveau 2), T02 (niveau 3), T03 (niveau 3), T04 (niveau 3), T05 (niveau 3), T06 (niveau 3), T07 (niveau 3), T08 (niveau 3), V01 (niveau 2), V03 (niveau 3), V04 (niveau 3), V05 (niveau 3), V06 (niveau 3), M01 (niveau 3), M02 (niveau 3), M03 (niveau 2), M04 (niveau 2), M07 (niveau 2), M08 (niveau 2), M09 (niveau 3), M11 (niveau 2), M12 (niveau 2), M15 (niveau 2), M17 (niveau 2), M18 (niveau 3), M19 (niveau 2), M20 (niveau 3), M22 (niveau 2), M23 (niveau 2).

Faux négatifs : B11 (niveau 1), N11 (niveau 1), N12 (niveau 1), N14 (niveau 1), N23 (niveau 1), N26 (niveau 1), N32 (niveau 1), N39 (niveau 1).

_Fichier généré par `node tests/detecteur/run.mjs --legacy`. Ne pas modifier à la main._
