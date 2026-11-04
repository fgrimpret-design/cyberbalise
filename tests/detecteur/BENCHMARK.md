# BENCHMARK : moteur 2.x

Mesure du moteur v2.0.0 sur le corpus de test, en Node pur (sans navigateur). Échelle : 0 = aucun signal, 1 = signaux faibles, 2 = message suspect, 3 = arnaque probable.

Date de mesure : 2026-11-04. Échantillon : **140 messages** (legitime_transactionnel : 31, legitime_perso : 19, prevention : 9, phishing_fr : 60, phishing_en : 11, ambigu : 10). Les messages sont fictifs ou paraphrasés ; l'échantillon est petit, les pourcentages sont donc indicatifs.

Le corpus compte deux séries : **développement** (71 messages, écrits en même temps que les règles : leur score mesure la cohérence interne) et **validation** (69 messages, rédigés ensuite et à part, sans consulter les règles : seule cette série donne une idée de la généralisation).

## Synthèse

| Indicateur | Moteur 2.x : ensemble | Développement | Validation | Ancienne version : ensemble | Ancienne version : validation |
|---|---|---|---|---|---|
| Cas conformes à la cible | 139 / 140 | 71 / 71 | 68 / 69 | 79 / 140 | 41 / 69 |
| Faux positifs (légitimes ou prévention au niveau ≥ 2) | 0 / 59 (0 %) | 0 / 34 (0 %) | 0 / 25 (0 %) | 35 / 59 (59.3 %) | 16 / 25 (64 %) |
| dont au niveau 3 | 0 / 59 | 0 / 34 | 0 / 25 | 17 / 59 | 5 / 25 |
| Détection (hameçonnages au niveau ≥ 2) | 69 / 71 (97.2 %) | 32 / 32 (100 %) | 37 / 39 (94.9 %) | 63 / 71 (88.7 %) | 32 / 39 (82.1 %) |
| Détection forte (niveau 3) | 60 / 71 (84.5 %) | 32 / 32 (100 %) | 28 / 39 (71.8 %) | 45 / 71 (63.4 %) | 19 / 39 (48.7 %) |
| Faux négatifs (hameçonnages au niveau ≤ 1) | 2 / 71 (2.8 %) | 0 / 32 (0 %) | 2 / 39 (5.1 %) | 8 / 71 (11.3 %) | 7 / 39 (17.9 %) |

Limites connues (déclarées, hors cible) : **N04** : Message vague sans marque ni menace : seul le lien en .top est repérable (niveau 1). Le classer plus haut ferait monter les faux positifs.

## Détail par message

| Id | Série | Catégorie | Message | Niveau mesuré | Cible | Conforme |
|---|---|---|---|---|---|---|
| B01 | dev | legitime_transactionnel | Amazon : votre commande a été expédiée. Suivez sa livraison… | 0 (Aucun signal) | 0–1 | oui |
| B02 | dev | legitime_transactionnel | Votre colis Colissimo sera livré demain entre 9h et 12h. | 0 (Aucun signal) | 0–1 | oui |
| B03 | dev | legitime_transactionnel | Votre code de confirmation est 482913. Ne le communiquez à … | 0 (Aucun signal) | 0–1 | oui |
| B04 | dev | legitime_transactionnel | Votre relevé est disponible : https://www.credit-agricole.f… | 0 (Aucun signal) | 0–1 | oui |
| B05 | dev | legitime_transactionnel | EDF : votre facture de 78,50 € est disponible dans votre es… | 0 (Aucun signal) | 0–1 | oui |
| B06 | dev | legitime_perso | Bonjour, votre rendez-vous chez le dentiste est confirmé po… | 0 (Aucun signal) | 0 | oui |
| B07 | dev | legitime_transactionnel | Votre carte a été utilisée 12,90 € chez CARREFOUR. Si ce n'… | 0 (Aucun signal) | 0–1 | oui |
| B08 | dev | prevention | Ne communiquez jamais votre code de confirmation, même à vo… | 0 (Aucun signal) | 0 | oui |
| B09 | dev | phishing_fr | Colissimo : votre colis n'a pas pu être livré faute de frai… | 3 (Arnaque probable) | 3 | oui |
| B10 | dev | phishing_fr | URGENT : votre compte bancaire sera suspendu. Confirmez vos… | 3 (Arnaque probable) | 3 | oui |
| B11 | dev | phishing_en | Dear customer, your account has been limited. Verify your i… | 3 (Arnaque probable) | 3 | oui |
| B12 | dev | phishing_fr | Bonjour, une nouvelle connexion a été détectée sur votre es… | 3 (Arnaque probable) | 2–3 | oui |
| B13 | dev | phishing_fr | [Service Facturation <facturation@edf-facture.top>] Bonjour… | 3 (Arnaque probable) | 3 | oui |
| B14 | dev | phishing_fr | Votre véhicule a circulé sur le réseau autoroutier sans pai… | 3 (Arnaque probable) | 3 | oui |
| B15 | dev | phishing_fr | Amazon : votre compte sera suspendu. Confirmez ici → https:… | 3 (Arnaque probable) | 3 | oui |
| B16 | dev | phishing_fr | https://amazon.fr@evil.top/login | 3 (Arnaque probable) | 3 | oui |
| B17 | dev | phishing_fr | Bonjour papa, c'est mon nouveau numéro, mon téléphone est c… | 3 (Arnaque probable) | 3 | oui |
| B18 | dev | phishing_fr | From: ameli@ameli-secure.top Authentication-Results: mx.exa… | 3 (Arnaque probable) | 3 | oui |
| B19 | dev | phishing_fr | Votre forfait mobile sera résilié aujourd'hui. Réactivez la… | 3 (Arnaque probable) | 3 | oui |
| B20 | dev | phishing_fr | QR : https://amendes-antai-paiement.top | 3 (Arnaque probable) | 3 | oui |
| P01 | dev | legitime_perso | On se retrouve à 19h devant le cinéma ? J'ai pris les place… | 0 (Aucun signal) | 0 | oui |
| P02 | dev | legitime_perso | Coucou maman, c'est Léa. Je passe dimanche pour le déjeuner… | 0 (Aucun signal) | 0 | oui |
| P03 | dev | legitime_perso | Réunion décalée à 15h, salle B. Merci de confirmer par reto… | 0 (Aucun signal) | 0–1 | oui |
| P04 | dev | legitime_perso | [Claire Dubois <claire.dubois@cabinet-dubois.fr>] Bonjour, … | 0 (Aucun signal) | 0–1 | oui |
| P05 | dev | legitime_perso | Salut, tu peux me virer les 25 € du resto quand tu as un mo… | 0 (Aucun signal) | 0–1 | oui |
| P06 | dev | legitime_perso | Bonjour, votre réservation au restaurant Le Zinc est confir… | 0 (Aucun signal) | 0 | oui |
| P07 | dev | legitime_perso | Le plombier passera demain entre 14h et 16h. Pensez à laiss… | 0 (Aucun signal) | 0 | oui |
| P08 | dev | legitime_perso | Joyeux anniversaire ! On fait un cadeau commun, 15 € chacun… | 0 (Aucun signal) | 0–1 | oui |
| P09 | dev | legitime_perso | Bonjour Madame Martin, votre ordonnance est prête à la phar… | 0 (Aucun signal) | 0 | oui |
| P10 | dev | legitime_perso | Papa, j'ai raté mon train, je rentre avec le suivant à 18h.… | 0 (Aucun signal) | 0 | oui |
| P11 | dev | legitime_perso | [syndic@residence-des-tilleuls.fr] Bonjour, Rappel : l'asse… | 1 (Signaux faibles) | 0–1 | oui |
| P12 | dev | legitime_perso | Ton colis est chez la voisine du 3e, je te le dépose ce soi… | 0 (Aucun signal) | 0 | oui |
| T01 | dev | legitime_transactionnel | [DOCTOLIB] Votre code de connexion Doctolib est 531892. Il … | 0 (Aucun signal) | 0–1 | oui |
| T02 | dev | legitime_transactionnel | [LAPOSTE] La Poste : votre colis sera livré demain. Suivi :… | 1 (Signaux faibles) | 0–1 | oui |
| T03 | dev | legitime_transactionnel | [Chronopost] Chronopost : votre colis est en cours de livra… | 1 (Signaux faibles) | 0–1 | oui |
| T04 | dev | legitime_transactionnel | Crédit Agricole : paiement de 54,20 € chez FNAC par carte s… | 0 (Aucun signal) | 0–1 | oui |
| T05 | dev | legitime_transactionnel | [Google] G-482913 est votre code de validation Google. Ne l… | 0 (Aucun signal) | 0–1 | oui |
| T06 | dev | legitime_transactionnel | [EDF <ne-pas-repondre@edf.fr>] Bonjour, Votre facture de 78… | 0 (Aucun signal) | 0–1 | oui |
| T07 | dev | legitime_transactionnel | [Netflix <info@account.netflix.com>] Bonjour, Nous avons bi… | 0 (Aucun signal) | 0–1 | oui |
| T08 | dev | legitime_transactionnel | [Mondial Relay] Mondial Relay : votre colis est disponible … | 1 (Signaux faibles) | 0–1 | oui |
| V01 | dev | prevention | Attention aux arnaques : votre banque ne vous demandera jam… | 0 (Aucun signal) | 0 | oui |
| V02 | dev | prevention | Conseil : n'envoyez jamais de photo de votre carte bancaire… | 0 (Aucun signal) | 0 | oui |
| V03 | dev | prevention | Hameçonnage : un message qui vous presse de payer sous 24 h… | 0 (Aucun signal) | 0–1 | oui |
| V04 | dev | prevention | Si un faux conseiller vous demande de valider une opération… | 0 (Aucun signal) | 0–1 | oui |
| V05 | dev | prevention | Les faux colis : on vous demande 1,99 € de frais de livrais… | 0 (Aucun signal) | 0–1 | oui |
| V06 | dev | prevention | [CyberBalise <newsletter@cyberbalise.fr>] Bonjour, Cette se… | 0 (Aucun signal) | 0–1 | oui |
| F01 | dev | phishing_fr | [06 12 34 56 78] Ameli : votre carte Vitale est arrivée à e… | 3 (Arnaque probable) | 3 | oui |
| F02 | dev | phishing_fr | [Direction Générale des Finances Publiques <remboursement@i… | 3 (Arnaque probable) | 3 | oui |
| F03 | dev | phishing_fr | [+44 7700 900123] Banque Populaire : une opération suspecte… | 3 (Arnaque probable) | 2–3 | oui |
| F04 | dev | phishing_fr | Salut maman, j'ai cassé mon téléphone, voici mon nouveau nu… | 3 (Arnaque probable) | 3 | oui |
| F05 | dev | phishing_fr | Votre compte formation CPF est suspendu. Régularisez avant … | 3 (Arnaque probable) | 3 | oui |
| F06 | dev | phishing_fr | J'ai pris le contrôle de votre webcam et enregistré une vid… | 3 (Arnaque probable) | 3 | oui |
| F07 | dev | phishing_fr | Doublez votre capital en 30 jours : rendement garanti de 18… | 3 (Arnaque probable) | 3 | oui |
| F08 | dev | phishing_fr | [Direction <direction.generale@societe-groupe.com>] Bonjour… | 3 (Arnaque probable) | 2–3 | oui |
| F09 | dev | phishing_fr | ALERTE : votre ordinateur est infecté par un virus. N'éteig… | 3 (Arnaque probable) | 3 | oui |
| F10 | dev | phishing_fr | ANTAI : une amende de 35 € est en attente. Réglez avant 24h… | 3 (Arnaque probable) | 3 | oui |
| F11 | dev | phishing_fr | Isolation de vos combles à 1 € ! Dossier MaPrimeRénov' pré-… | 3 (Arnaque probable) | 2–3 | oui |
| F12 | dev | phishing_fr | Bonjour, votre livreur a tenté de vous joindre, je repasse … | 3 (Arnaque probable) | 2–3 | oui |
| F13 | dev | phishing_fr | [Netflix <service@netflix-billing-support.com>] Bonjour, Vo… | 3 (Arnaque probable) | 3 | oui |
| F14 | dev | phishing_fr | Chronopost : votre colis est retenu au dépôt. Réglez 2,49 €… | 3 (Arnaque probable) | 3 | oui |
| F15 | dev | phishing_fr | France Travail : votre allocation est suspendue. Actualisez… | 3 (Arnaque probable) | 3 | oui |
| E01 | dev | phishing_en | Dear user, unusual activity has been detected on your PayPa… | 3 (Arnaque probable) | 3 | oui |
| E02 | dev | phishing_en | Your package could not be delivered. A customs fee of £2.99… | 3 (Arnaque probable) | 3 | oui |
| E03 | dev | phishing_en | Your Apple ID has been locked for security reasons. Verify … | 3 (Arnaque probable) | 3 | oui |
| E04 | dev | phishing_en | Congratulations! You have been selected to receive a $500 g… | 3 (Arnaque probable) | 2–3 | oui |
| E05 | dev | phishing_en | Final notice: your password expires today. Sign in to confi… | 3 (Arnaque probable) | 3 | oui |
| A01 | dev | ambigu | Votre abonnement expire dans 3 jours. Renouvelez-le depuis … | 0 (Aucun signal) | 0–2 | oui |
| A02 | dev | ambigu | [Boutique Atelier <contact@atelier-boutique.fr>] Profitez d… | 0 (Aucun signal) | 0–1 | oui |
| A03 | dev | ambigu | Bonjour, je suis intéressé par votre vélo, est-il toujours … | 0 (Aucun signal) | 0–2 | oui |
| A04 | dev | ambigu | URGENT : réunion à 15h en salle 3, merci de confirmer imméd… | 1 (Signaux faibles) | 0–2 | oui |
| A05 | dev | ambigu | Bonjour, votre annonce m'intéresse. Je suis à l'étranger : … | 3 (Arnaque probable) | 1–3 | oui |
| N01 | validation | phishing_fr | [Télépéage] Vous avez un solde impayé de 6,40 € sur votre t… | 3 (Arnaque probable) | 3 | oui |
| N02 | validation | phishing_fr | Bonjour, un passage au péage n'a pas été réglé. Merci de ré… | 3 (Arnaque probable) | 2–3 | oui |
| N03 | validation | phishing_fr | ANTAI : votre avis de contravention n°2294-77 est en attent… | 3 (Arnaque probable) | 3 | oui |
| N04 | validation | phishing_fr | Votre dossier d'infraction nécessite une action. Consultez … | 1 (Signaux faibles) | 2–3 | **non** |
| N05 | validation | phishing_fr | PARKING : scannez le QR code affiché sur l'horodateur pour … | 3 (Arnaque probable) | 3 | oui |
| N06 | validation | phishing_fr | QR : https://pay-parking-ville.xyz/ticket | 2 (Suspect) | 1–3 | oui |
| N07 | validation | phishing_fr | SFR : votre ligne sera suspendue ce soir faute de paiement … | 3 (Arnaque probable) | 3 | oui |
| N08 | validation | phishing_fr | Votre forfait mobile arrive à expiration. Renouvelez-le pou… | 3 (Arnaque probable) | 2–3 | oui |
| N09 | validation | phishing_fr | Bonjour, je suis conseiller Mon Compte Formation. Vos droit… | 2 (Suspect) | 2–3 | oui |
| N10 | validation | phishing_fr | Votre solde CPF a été mis à jour. Consultez vos droits ici … | 3 (Arnaque probable) | 2–3 | oui |
| N11 | validation | phishing_fr | Bonjour, je suis intéressé par votre appartement. Je suis e… | 3 (Arnaque probable) | 3 | oui |
| N12 | validation | phishing_fr | Bonjour, votre logement est-il encore disponible ? Je suis … | 2 (Suspect) | 1–2 | oui |
| N13 | validation | phishing_fr | Dernière chance : isolation de vos combles à 1 € grâce aux … | 3 (Arnaque probable) | 3 | oui |
| N14 | validation | phishing_fr | Bonjour, vous êtes éligible aux aides à la rénovation énerg… | 2 (Suspect) | 1–3 | oui |
| N15 | validation | phishing_fr | Livreur : je suis passé, vous étiez absent. Je repasse dema… | 3 (Arnaque probable) | 3 | oui |
| N16 | validation | phishing_fr | Bonjour, votre colis n'a pas pu être remis. Choisissez un n… | 3 (Arnaque probable) | 2–3 | oui |
| N17 | validation | phishing_fr | Salut papa c'est moi, j'ai changé de numéro. Je t'explique … | 3 (Arnaque probable) | 3 | oui |
| N18 | validation | phishing_fr | Coucou maman, c'est mon nouveau numéro, mon ancien téléphon… | 2 (Suspect) | 1–2 | oui |
| N19 | validation | phishing_fr | [Assurance Maladie <noreply@ameli-remboursements.fr>] Bonjo… | 3 (Arnaque probable) | 3 | oui |
| N20 | validation | phishing_en | Microsoft Defender detected a critical virus on your PC. Do… | 3 (Arnaque probable) | 3 | oui |
| N21 | validation | phishing_en | I know your password. I recorded you through your webcam. P… | 3 (Arnaque probable) | 3 | oui |
| N22 | validation | phishing_fr | Rejoignez notre groupe privé : +15 % par semaine garantis, … | 3 (Arnaque probable) | 3 | oui |
| N23 | validation | phishing_fr | [Paul Garnier <p.garnier@societe-garnier.fr>] Bonjour Marie… | 2 (Suspect) | 2–3 | oui |
| N24 | validation | phishing_fr | Votre acheteur a payé. Pour recevoir votre argent, confirme… | 3 (Arnaque probable) | 3 | oui |
| N25 | validation | phishing_fr | Bonjour, je vous ai envoyé le paiement via Leboncoin Pay. C… | 2 (Suspect) | 2–3 | oui |
| N26 | validation | phishing_fr | Offre d'emploi : 250 € par jour en télétravail, aucun diplô… | 1 (Signaux faibles) | 1–3 | oui |
| N27 | validation | phishing_fr | [Netflix <info@netflix-support.net>] Bonjour, nous n'avons … | 3 (Arnaque probable) | 3 | oui |
| N28 | validation | phishing_en | [PayPal <service@paypal-notice.com>] You sent a payment of … | 3 (Arnaque probable) | 2–3 | oui |
| N29 | validation | phishing_en | HMRC: You are eligible for a tax refund of £384.20. Claim w… | 3 (Arnaque probable) | 3 | oui |
| N30 | validation | phishing_fr | [Chronopost <suivi@chronopost-colis.fr>] Votre colis ne peu… | 3 (Arnaque probable) | 3 | oui |
| N31 | validation | phishing_fr | [Crédit Agricole <conseiller.ca.service@gmail.com>] Une opé… | 3 (Arnaque probable) | 3 | oui |
| N32 | validation | phishing_fr | Salut, je t'ai envoyé un code par SMS par erreur, tu peux m… | 2 (Suspect) | 1–3 | oui |
| N33 | validation | phishing_en | UPS: your package is awaiting an address update. Update her… | 3 (Arnaque probable) | 3 | oui |
| N34 | validation | phishing_fr | BNP Paribas : connexion suspecte détectée, rappelez immédia… | 2 (Suspect) | 2–3 | oui |
| N35 | validation | phishing_fr | CAF : un trop-perçu de 412 € vous est réclamé. Contestez so… | 3 (Arnaque probable) | 3 | oui |
| N36 | validation | phishing_fr | [EDF <remboursement@edf-clients-remboursement.com>] Bonjour… | 3 (Arnaque probable) | 3 | oui |
| N37 | validation | phishing_fr | Votre colis est arrivé : https://bit.ly/3Xy9Kqz | 3 (Arnaque probable) | 1–3 | oui |
| N38 | validation | phishing_fr | Votre compte est bloqué, connectez-vous : http://185.234.72… | 3 (Arnaque probable) | 2–3 | oui |
| N39 | validation | phishing_fr | Votre compte PayPal est limité : https://pаypal.com/signin | 3 (Arnaque probable) | 3 | oui |
| M01 | validation | legitime_transactionnel | [Free] Free Mobile : votre facture de 19,99 € est disponibl… | 0 (Aucun signal) | 0–1 | oui |
| M02 | validation | legitime_transactionnel | Orange : votre forfait mobile sera renouvelé le 12/11 pour … | 0 (Aucun signal) | 0–1 | oui |
| M03 | validation | legitime_transactionnel | [Doctolib] Doctolib : rappel de votre rendez-vous demain à … | 0 (Aucun signal) | 0–1 | oui |
| M04 | validation | legitime_transactionnel | BNP Paribas : un paiement de 120,00 € par carte a été effec… | 0 (Aucun signal) | 0–1 | oui |
| M05 | validation | legitime_transactionnel | Votre commande est à retirer avant le 15 novembre à la phar… | 0 (Aucun signal) | 0–1 | oui |
| M06 | validation | legitime_transactionnel | [Mairie de Lyon <demarches@mairie-lyon.fr>] Bonjour, votre … | 1 (Signaux faibles) | 0–1 | oui |
| M07 | validation | legitime_perso | [Sophie Renard <sophie.renard@cabinet-renard.fr>] Bonjour, … | 0 (Aucun signal) | 0–1 | oui |
| M08 | validation | legitime_perso | Maman, peux-tu m'avancer 50 € pour le cadeau de mamie ? Je … | 0 (Aucun signal) | 0–1 | oui |
| M09 | validation | legitime_transactionnel | [BOURSORAMA] Votre code de sécurité Boursorama est 482913. … | 0 (Aucun signal) | 0–1 | oui |
| M10 | validation | legitime_transactionnel | Rappel : votre ticket de parking expire à 18h30. Prolongez-… | 0 (Aucun signal) | 0–1 | oui |
| M11 | validation | legitime_transactionnel | [Decathlon <newsletter@decathlon.fr>] Profitez de -40 % jus… | 0 (Aucun signal) | 0–1 | oui |
| M12 | validation | legitime_transactionnel | Your Amazon order #123-4567 has shipped and will arrive Thu… | 0 (Aucun signal) | 0–1 | oui |
| M13 | validation | legitime_transactionnel | Chase: A transaction of $42.18 at Starbucks was made on you… | 0 (Aucun signal) | 0–1 | oui |
| M14 | validation | legitime_perso | Je suis dans le train, je t'appelle dans 10 minutes. Urgent… | 1 (Signaux faibles) | 0–1 | oui |
| M15 | validation | legitime_transactionnel | Bonjour, je suis votre livreur Chronopost, je serai chez vo… | 0 (Aucun signal) | 0–1 | oui |
| M16 | validation | legitime_transactionnel | Alerte météo : vigilance orange orages ce soir. Évitez les … | 0 (Aucun signal) | 0 | oui |
| M17 | validation | prevention | Attention : des SMS frauduleux circulent au nom de Colissim… | 0 (Aucun signal) | 0–1 | oui |
| M18 | validation | prevention | Cher client, votre banque ne vous demandera jamais votre mo… | 0 (Aucun signal) | 0–1 | oui |
| M19 | validation | legitime_transactionnel | Votre rendez-vous à la CAF est confirmé le 14/11 à 10h. Mun… | 0 (Aucun signal) | 0–1 | oui |
| M20 | validation | legitime_transactionnel | [Impots.gouv <ne-pas-repondre@impots.gouv.fr>] Bonjour, vot… | 0 (Aucun signal) | 0–1 | oui |
| M21 | validation | legitime_perso | Hey, can you send me 20 euros for the pizza? I'll pay you b… | 0 (Aucun signal) | 0–1 | oui |
| M22 | validation | legitime_perso | Voici les photos de la soirée : https://bit.ly/photos-soire… | 1 (Signaux faibles) | 0–1 | oui |
| M23 | validation | legitime_perso | [Julien Faure <j.faure@faure-conseil.fr>] Madame, Monsieur,… | 0 (Aucun signal) | 0–1 | oui |
| M24 | validation | legitime_transactionnel | [Netflix] Netflix : votre code de connexion est 4821. Ne le… | 0 (Aucun signal) | 0–1 | oui |
| M25 | validation | legitime_transactionnel | [Doctolib] Doctolib : code 884219 pour confirmer votre rend… | 0 (Aucun signal) | 0–1 | oui |
| Q01 | validation | ambigu | Bonjour, je suis intéressé par votre annonce. Pouvez-vous m… | 0 (Aucun signal) | 0–1 | oui |
| Q02 | validation | ambigu | Votre colis sera livré par La Poste. Pour modifier le créne… | 1 (Signaux faibles) | 0–1 | oui |
| Q03 | validation | ambigu | Votre abonnement vous sera remboursé sous 5 jours ouvrés. | 1 (Signaux faibles) | 0–1 | oui |
| Q04 | validation | ambigu | Bonjour, vous avez gagné un café offert pour votre prochain… | 1 (Signaux faibles) | 0–2 | oui |
| Q05 | validation | ambigu | URGENT : paiement requis avant ce soir pour valider votre i… | 1 (Signaux faibles) | 0–2 | oui |

## Cas de non-régression de l'annexe B du cahier des charges

| Annexe | Id | Niveau mesuré | Cible | Conforme |
|---|---|---|---|---|
| 1 | B01 | 0 | 0–1 | oui |
| 2 | B02 | 0 | 0–1 | oui |
| 3 | B03 | 0 | 0–1 | oui |
| 4 | B04 | 0 | 0–1 | oui |
| 5 | B05 | 0 | 0–1 | oui |
| 6 | B06 | 0 | 0 | oui |
| 7 | B07 | 0 | 0–1 | oui |
| 8 | B08 | 0 | 0 | oui |
| 9 | B09 | 3 | 3 | oui |
| 10 | B10 | 3 | 3 | oui |
| 11 | B11 | 3 | 3 | oui |
| 12 | B12 | 3 | 2–3 | oui |
| 13 | B13 | 3 | 3 | oui |
| 14 | B14 | 3 | 3 | oui |
| 15 | B15 | 3 | 3 | oui |
| 16 | B16 | 3 | 3 | oui |
| 17 | B17 | 3 | 3 | oui |
| 18 | B18 | 3 | 3 | oui |
| 19 | B19 | 3 | 3 | oui |
| 20 | B20 | 3 | 3 | oui |

Annexe B conforme : **20 / 20**.

Faux négatifs : N04 (niveau 1), N26 (niveau 1).

_Fichier généré par `node tests/detecteur/run.mjs`. Ne pas modifier à la main._
