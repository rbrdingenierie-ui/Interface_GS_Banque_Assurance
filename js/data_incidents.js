/* GS Banque & Assurance – gestion des incidents : 16 dossiers de référence (4 par palier : 15, 30, 60 et 90 jours à l'état débiteur).
   Clients, montants et sociétés sont imaginaires. Les dossiers sont figés (fabriqués une fois par build/gdi_reference.js) ; chaque jour, l'outil en reprend environ un quart
   et fabrique les autres (quotidien_gdi.js). Modèle d'un dossier : voir rules_incidents.js (palier, compte, relevé, ressources, contact, régularisation, attendu).
   Les dates sont relatives : « {+7} » désigne la date du jour + 7 jours. Le relevé compte les jours avant aujourd'hui. */
(function (root) {
  "use strict";
  var dossiers = [
    {
      "scenario": "salaire",
      "palier": 15,
      "objectif": "Un salaire attendu à une date précise : on enregistre le versement et on maintient le suivi.",
      "client": {
        "civilite": "Mme",
        "prenom": "Mélanie",
        "nom": "MAUGER",
        "age": 49,
        "profession": "Employée de bureau (CDI)",
        "situation": "Mariée",
        "ancienneteAns": 2,
        "revenus": 2050,
        "revenusNote": "salaire domicilié",
        "produits": [
          "Compte courant",
          "Carte Visa Classic"
        ],
        "fragile": false,
        "compte": "00514 874 3245",
        "coordonnees": {
          "mobile": "06 39 98 14 27",
          "telephone": "01 99 00 14 27",
          "email": "melanie.mauger@example.com",
          "adresse": "21 rue de Charonne, 75011 Paris"
        }
      },
      "note": null,
      "compte": {
        "solde": -590,
        "autorisation": 0,
        "debutJours": 15,
        "frais": 36,
        "origine": "Voyages Horizon – séjour"
      },
      "ressources": {
        "revenuDomicilie": true,
        "salaire": {
          "montant": 2050,
          "dans": 4
        },
        "epargne": [],
        "credits": [],
        "notes": []
      },
      "releve": [
        {
          "j": 26,
          "lib": "Virement salaire",
          "m": 2050,
          "solde": 2211,
          "type": "credit",
          "debut": false
        },
        {
          "j": 23,
          "lib": "Boutique Mode & Co – Paris 15e",
          "m": -120.78,
          "solde": 2090.22,
          "type": "carte",
          "debut": false
        },
        {
          "j": 23,
          "lib": "Station Relais Est – carburant",
          "m": -141.19,
          "solde": 1949.03,
          "type": "carte",
          "debut": false
        },
        {
          "j": 23,
          "lib": "Boutique Mode & Co – Paris 15e",
          "m": -101.55,
          "solde": 1847.48,
          "type": "carte",
          "debut": false
        },
        {
          "j": 21,
          "lib": "Station Voltaire – carburant",
          "m": -128.19,
          "solde": 1719.29,
          "type": "carte",
          "debut": false
        },
        {
          "j": 19,
          "lib": "Résidence Les Lilas – loyer",
          "m": -520,
          "solde": 1199.29,
          "type": "prelevement",
          "mandat": "RL-91857",
          "debut": false
        },
        {
          "j": 19,
          "lib": "Mobilis – forfait",
          "m": -17.72,
          "solde": 1181.57,
          "type": "prelevement",
          "mandat": "MB-25458",
          "debut": false
        },
        {
          "j": 18,
          "lib": "Boulangerie du Marché – Paris 15e",
          "m": -96.83,
          "solde": 1084.74,
          "type": "carte",
          "debut": false
        },
        {
          "j": 17,
          "lib": "Station Relais Est – carburant",
          "m": -135.71,
          "solde": 949.03,
          "type": "carte",
          "debut": false
        },
        {
          "j": 16,
          "lib": "Marché Bio du Centre – Paris 15e",
          "m": -209.87,
          "solde": 739.16,
          "type": "carte",
          "debut": false
        },
        {
          "j": 16,
          "lib": "Supermarché Marché Plus – Paris 15e",
          "m": -246.53,
          "solde": 492.63,
          "type": "carte",
          "debut": false
        },
        {
          "j": 16,
          "lib": "Station Voltaire – carburant",
          "m": -125.63,
          "solde": 367,
          "type": "carte",
          "debut": false
        },
        {
          "j": 15,
          "lib": "Voyages Horizon – séjour",
          "m": -447,
          "solde": -80,
          "type": "carte",
          "debut": true
        },
        {
          "j": 14,
          "lib": "Brasserie du Coin – Paris 15e",
          "m": -95.8,
          "solde": -175.8,
          "type": "carte",
          "debut": false
        },
        {
          "j": 14,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -183.8,
          "type": "frais",
          "debut": false
        },
        {
          "j": 8,
          "lib": "Prélèvement rejeté (provision insuffisante) – Assurances Solidaires – assurance auto",
          "m": 0,
          "solde": -183.8,
          "type": "rejet",
          "mandat": "AS-94380",
          "montantRejete": 90.34,
          "debut": false
        },
        {
          "j": 8,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -203.8,
          "type": "frais",
          "debut": false
        },
        {
          "j": 7,
          "lib": "Primeur & Cie – Paris 15e",
          "m": -140.07,
          "solde": -343.87,
          "type": "carte",
          "debut": false
        },
        {
          "j": 6,
          "lib": "Retrait DAB",
          "m": -68.58,
          "solde": -412.45,
          "type": "carte",
          "debut": false
        },
        {
          "j": 4,
          "lib": "Boutique Mode & Co – Paris 15e",
          "m": -169.55,
          "solde": -582,
          "type": "carte",
          "debut": false
        },
        {
          "j": 4,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -590,
          "type": "frais",
          "debut": false
        }
      ],
      "historique": [
        {
          "j": 3,
          "canal": "Système",
          "texte": "SMS automatique d'alerte « compte débiteur » envoyé au client"
        }
      ],
      "services": [
        {
          "id": "carte",
          "libelle": "Carte Visa Classic"
        },
        {
          "id": "chequier",
          "libelle": "Chéquier"
        },
        {
          "id": "bad",
          "libelle": "Banque à distance (application et site internet)"
        }
      ],
      "prelevements": [
        {
          "id": "p1",
          "libelle": "Résidence Les Lilas – loyer (mandat RL-91857)",
          "montant": 520
        },
        {
          "id": "p2",
          "libelle": "Mobilis – forfait (mandat MB-25458)",
          "montant": 17.72
        },
        {
          "id": "p3",
          "libelle": "Gaz de Ville – facture (mandat GV-51822)",
          "montant": 112.85
        },
        {
          "id": "p4",
          "libelle": "Assurances Solidaires – assurance auto (mandat AS-94380)",
          "montant": 90.34
        }
      ],
      "contact": {
        "canaux": [
          "mobile",
          "sms",
          "email",
          "agence",
          "fixe"
        ],
        "echange": [
          "Vous : « Bonjour Mme Mauger, votre compte présente un solde débiteur de 590 € depuis 15 jours. Pouvons-nous trouver ensemble une solution pour le régulariser ? »",
          "Mme Mauger : « Oui, je l'ai vu. Mon salaire de 2 050 € est versé le {+4} : le compte sera de nouveau créditeur ce jour-là. J'ai eu un mois chargé avec les frais de rentrée. »",
          "Vous : « Je note le virement du {+4} sur ce compte. »"
        ],
        "maj": [
          {
            "rubrique": "Revenus",
            "texte": "Salaire net de 2 050 € domicilié sur ce compte, prochain versement le {+4}"
          }
        ]
      },
      "regularisation": {
        "plan": true,
        "reels": {
          "salaire": {
            "montant": 2050,
            "delai": 7
          }
        },
        "sociaux": []
      },
      "attendu": {
        "decision": "suivi",
        "courrier": null
      },
      "retenir": [
        "À J15, le premier contact sert à comprendre l'origine du débit et à obtenir une date de régularisation.",
        "Le client a une solution réelle : seuls les moyens et les montants qu'il a annoncés se saisissent."
      ],
      "id": 1
    },
    {
      "scenario": "epargne",
      "palier": 15,
      "objectif": "Le client a de l'épargne chez nous : le virement règle le débit tout de suite.",
      "client": {
        "civilite": "M.",
        "prenom": "Samir",
        "nom": "BESNARD",
        "age": 42,
        "profession": "Comptable (CDI)",
        "situation": "Marié",
        "ancienneteAns": 3,
        "revenus": 2800,
        "revenusNote": "revenus non domiciliés (aucun versement régulier sur ce compte)",
        "produits": [
          "Compte courant",
          "Carte Visa Classic",
          "Autorisation de découvert de 500 €"
        ],
        "fragile": false,
        "compte": "00668 855 3145",
        "coordonnees": {
          "mobile": "06 39 98 25 88",
          "telephone": "01 99 00 25 88",
          "email": "samir.besnard@example.com",
          "adresse": "58 rue des Pyrénées, 75020 Paris"
        }
      },
      "note": null,
      "compte": {
        "solde": -670,
        "autorisation": 500,
        "debutJours": 15,
        "frais": 56,
        "origine": "Centre Auto Pneus"
      },
      "ressources": {
        "revenuDomicilie": false,
        "salaire": null,
        "epargne": [
          {
            "produit": "Livret A",
            "solde": 720
          }
        ],
        "credits": [],
        "notes": []
      },
      "releve": [
        {
          "j": 38,
          "lib": "Boutique Mode & Co – Paris 14e",
          "m": -114,
          "solde": 670.81,
          "type": "carte",
          "debut": false
        },
        {
          "j": 34,
          "lib": "Mutuelle Santé Plus",
          "m": -38.46,
          "solde": 632.35,
          "type": "prelevement",
          "mandat": "MS-66377",
          "debut": false
        },
        {
          "j": 32,
          "lib": "Crèche Les Petits Pas – participation",
          "m": -138.09,
          "solde": 494.26,
          "type": "prelevement",
          "mandat": "CP-14445",
          "debut": false
        },
        {
          "j": 27,
          "lib": "Le Bistrot Lyonnais – Paris 14e",
          "m": -59.5,
          "solde": 434.76,
          "type": "carte",
          "debut": false
        },
        {
          "j": 23,
          "lib": "Électricité Verte – facture",
          "m": -132.65,
          "solde": 302.11,
          "type": "prelevement",
          "mandat": "EV-39991",
          "debut": false
        },
        {
          "j": 22,
          "lib": "Fibra – box internet",
          "m": -44.11,
          "solde": 258,
          "type": "prelevement",
          "mandat": "FB-44226",
          "debut": false
        },
        {
          "j": 15,
          "lib": "Centre Auto Pneus",
          "m": -788,
          "solde": -530,
          "type": "carte",
          "debut": true
        },
        {
          "j": 13,
          "lib": "Retrait DAB",
          "m": -48.48,
          "solde": -578.48,
          "type": "carte",
          "debut": false
        },
        {
          "j": 13,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -586.48,
          "type": "frais",
          "debut": false
        },
        {
          "j": 6,
          "lib": "Station Voltaire – carburant",
          "m": -35.52,
          "solde": -622,
          "type": "carte",
          "debut": false
        },
        {
          "j": 6,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -630,
          "type": "frais",
          "debut": false
        },
        {
          "j": 4,
          "lib": "Prélèvement rejeté (provision insuffisante) – Mutuelle Santé Plus",
          "m": 0,
          "solde": -630,
          "type": "rejet",
          "mandat": "MS-66377",
          "montantRejete": 38.46,
          "debut": false
        },
        {
          "j": 4,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -650,
          "type": "frais",
          "debut": false
        },
        {
          "j": 2,
          "lib": "Prélèvement rejeté (provision insuffisante) – Crèche Les Petits Pas – participation",
          "m": 0,
          "solde": -650,
          "type": "rejet",
          "mandat": "CP-14445",
          "montantRejete": 138.09,
          "debut": false
        },
        {
          "j": 2,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -670,
          "type": "frais",
          "debut": false
        }
      ],
      "historique": [
        {
          "j": 3,
          "canal": "Système",
          "texte": "SMS automatique d'alerte « compte débiteur » envoyé au client"
        }
      ],
      "services": [
        {
          "id": "carte",
          "libelle": "Carte Visa Classic"
        },
        {
          "id": "chequier",
          "libelle": "Chéquier"
        },
        {
          "id": "bad",
          "libelle": "Banque à distance (application et site internet)"
        },
        {
          "id": "decouvert",
          "libelle": "Autorisation de découvert de 500 €"
        }
      ],
      "prelevements": [
        {
          "id": "p1",
          "libelle": "Crèche Les Petits Pas – participation (mandat CP-14445)",
          "montant": 138.09
        },
        {
          "id": "p2",
          "libelle": "Électricité Verte – facture (mandat EV-39991)",
          "montant": 132.65
        },
        {
          "id": "p3",
          "libelle": "Mutuelle Santé Plus (mandat MS-66377)",
          "montant": 38.46
        },
        {
          "id": "p4",
          "libelle": "Fibra – box internet (mandat FB-44226)",
          "montant": 44.11
        }
      ],
      "contact": {
        "canaux": [
          "mobile",
          "sms",
          "email",
          "agence",
          "fixe"
        ],
        "echange": [
          "Vous : « Bonjour M. Besnard, votre compte présente un solde débiteur de 670 € depuis 15 jours. Pouvons-nous trouver ensemble une solution pour le régulariser ? »",
          "M. Besnard : « Je pensais que mon compte était approvisionné. Je vire depuis mon Livret A d'ici trois jours. »"
        ],
        "maj": [
          {
            "rubrique": "Épargne",
            "texte": "Livret A à GS Banque & Assurance : 720 € disponibles"
          }
        ]
      },
      "regularisation": {
        "plan": true,
        "reels": {
          "virement_epargne": {
            "montant": 720,
            "delai": 3
          }
        },
        "sociaux": []
      },
      "attendu": {
        "decision": "suivi",
        "courrier": null
      },
      "retenir": [
        "À J15, le premier contact sert à comprendre l'origine du débit et à obtenir une date de régularisation.",
        "Le client a une solution réelle : seuls les moyens et les montants qu'il a annoncés se saisissent."
      ],
      "id": 2
    },
    {
      "scenario": "injoignable",
      "palier": 15,
      "objectif": "Client injoignable : plusieurs canaux, dont le courrier, avant de décider.",
      "client": {
        "civilite": "M.",
        "prenom": "Samir",
        "nom": "BÉNARD",
        "age": 36,
        "profession": "Technicien de maintenance (CDI)",
        "situation": "Célibataire",
        "ancienneteAns": 9,
        "revenus": 2100,
        "revenusNote": "revenus non domiciliés (aucun versement régulier sur ce compte)",
        "produits": [
          "Compte courant",
          "Carte Visa Classic",
          "Autorisation de découvert de 600 €"
        ],
        "fragile": false,
        "compte": "00525 406 0939",
        "coordonnees": {
          "mobile": "06 39 98 58 78",
          "telephone": "01 99 00 58 78",
          "email": "samir.benard@example.com",
          "adresse": "42 rue Daguerre, 75014 Paris"
        }
      },
      "note": null,
      "compte": {
        "solde": -1080,
        "autorisation": 600,
        "debutJours": 15,
        "frais": 76,
        "origine": "Mobilier Maison & Co"
      },
      "ressources": {
        "revenuDomicilie": false,
        "salaire": null,
        "epargne": [],
        "credits": [],
        "notes": []
      },
      "releve": [
        {
          "j": 37,
          "lib": "Énergie Citoyenne – électricité",
          "m": -41.99,
          "solde": 1135.06,
          "type": "prelevement",
          "mandat": "EC-21384",
          "debut": false
        },
        {
          "j": 34,
          "lib": "Salle de sport Énergie – abonnement",
          "m": -30.56,
          "solde": 1104.5,
          "type": "prelevement",
          "mandat": "SE-22172",
          "debut": false
        },
        {
          "j": 25,
          "lib": "Magasin de sport Sportifs – Paris 17e",
          "m": -95,
          "solde": 1009.5,
          "type": "carte",
          "debut": false
        },
        {
          "j": 21,
          "lib": "Boulangerie Les Délices – Paris 17e",
          "m": -25.5,
          "solde": 984,
          "type": "carte",
          "debut": false
        },
        {
          "j": 19,
          "lib": "Résidence Les Lilas – loyer",
          "m": -705,
          "solde": 279,
          "type": "prelevement",
          "mandat": "RL-40154",
          "debut": false
        },
        {
          "j": 15,
          "lib": "Mobilier Maison & Co",
          "m": -1019,
          "solde": -740,
          "type": "carte",
          "debut": true
        },
        {
          "j": 13,
          "lib": "Prélèvement rejeté (provision insuffisante) – Prévoyance Famille – cotisation",
          "m": 0,
          "solde": -740,
          "type": "rejet",
          "mandat": "PF-11027",
          "montantRejete": 24.22,
          "debut": false
        },
        {
          "j": 13,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -760,
          "type": "frais",
          "debut": false
        },
        {
          "j": 7,
          "lib": "Prélèvement rejeté (provision insuffisante) – Énergie Citoyenne – électricité",
          "m": 0,
          "solde": -760,
          "type": "rejet",
          "mandat": "EC-21384",
          "montantRejete": 41.99,
          "debut": false
        },
        {
          "j": 7,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -780,
          "type": "frais",
          "debut": false
        },
        {
          "j": 6,
          "lib": "Retrait DAB",
          "m": -170.45,
          "solde": -950.45,
          "type": "carte",
          "debut": false
        },
        {
          "j": 6,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -958.45,
          "type": "frais",
          "debut": false
        },
        {
          "j": 4,
          "lib": "Prélèvement rejeté (provision insuffisante) – Salle de sport Énergie – abonnement",
          "m": 0,
          "solde": -958.45,
          "type": "rejet",
          "mandat": "SE-22172",
          "montantRejete": 30.56,
          "debut": false
        },
        {
          "j": 4,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -978.45,
          "type": "frais",
          "debut": false
        },
        {
          "j": 4,
          "lib": "Boulangerie Les Délices – Paris 17e",
          "m": -93.55,
          "solde": -1072,
          "type": "carte",
          "debut": false
        },
        {
          "j": 4,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -1080,
          "type": "frais",
          "debut": false
        }
      ],
      "historique": [
        {
          "j": 3,
          "canal": "Système",
          "texte": "SMS automatique d'alerte « compte débiteur » envoyé au client"
        }
      ],
      "services": [
        {
          "id": "carte",
          "libelle": "Carte Visa Classic"
        },
        {
          "id": "chequier",
          "libelle": "Chéquier"
        },
        {
          "id": "bad",
          "libelle": "Banque à distance (application et site internet)"
        },
        {
          "id": "decouvert",
          "libelle": "Autorisation de découvert de 600 €"
        }
      ],
      "prelevements": [
        {
          "id": "p1",
          "libelle": "Énergie Citoyenne – électricité (mandat EC-21384)",
          "montant": 41.99
        },
        {
          "id": "p2",
          "libelle": "Résidence Les Lilas – loyer (mandat RL-40154)",
          "montant": 705
        },
        {
          "id": "p3",
          "libelle": "Prévoyance Famille – cotisation (mandat PF-11027)",
          "montant": 24.22
        },
        {
          "id": "p4",
          "libelle": "Salle de sport Énergie – abonnement (mandat SE-22172)",
          "montant": 30.56
        }
      ],
      "contact": {
        "canaux": [],
        "echange": [],
        "maj": [
          {
            "rubrique": "Coordonnées",
            "texte": "Client injoignable par téléphone, SMS et e-mail à la date du jour : coordonnées à vérifier"
          }
        ]
      },
      "regularisation": {
        "plan": false,
        "reels": {},
        "sociaux": []
      },
      "attendu": {
        "decision": "agence",
        "courrier": "j15_info"
      },
      "retenir": [
        "À J15, le premier contact sert à comprendre l'origine du débit et à obtenir une date de régularisation.",
        "Un client injoignable se relance par plusieurs canaux ; le courrier laisse une trace écrite."
      ],
      "id": 3
    },
    {
      "scenario": "credit",
      "palier": 15,
      "objectif": "Un découvert récurrent : un prêt de substitution règle durablement le débit (opportunité commerciale), le relèvement de l'autorisation seul ne suffit pas.",
      "client": {
        "civilite": "M.",
        "prenom": "Vincent",
        "nom": "SABATIER",
        "age": 36,
        "profession": "Comptable (CDI)",
        "situation": "Célibataire",
        "ancienneteAns": 10,
        "revenus": 2240,
        "revenusNote": "revenus non domiciliés (aucun versement régulier sur ce compte)",
        "produits": [
          "Compte courant",
          "Carte Visa Classic",
          "Autorisation de découvert de 400 €"
        ],
        "fragile": false,
        "compte": "00514 547 8596",
        "coordonnees": {
          "mobile": "06 39 98 53 97",
          "telephone": null,
          "email": "vincent.sabatier@example.com",
          "adresse": "16 rue des Pyrénées, 75020 Paris"
        }
      },
      "note": null,
      "compte": {
        "solde": -1300,
        "autorisation": 400,
        "debutJours": 15,
        "frais": 46.4,
        "origine": "Voyages Horizon – séjour"
      },
      "ressources": {
        "revenuDomicilie": false,
        "salaire": null,
        "epargne": [
          {
            "produit": "Livret A",
            "solde": 160
          }
        ],
        "credits": [],
        "notes": [
          "Revenus domiciliés dans une autre banque : la domiciliation est à proposer."
        ]
      },
      "releve": [
        {
          "j": 40,
          "lib": "Cantine scolaire – régie",
          "m": -42.73,
          "solde": 609,
          "type": "prelevement",
          "mandat": "CS-11843",
          "debut": false
        },
        {
          "j": 38,
          "lib": "Station Relais Nord – carburant",
          "m": -59,
          "solde": 550,
          "type": "carte",
          "debut": false
        },
        {
          "j": 33,
          "lib": "Pharmacie du Centre – Paris 11e",
          "m": -48,
          "solde": 502,
          "type": "carte",
          "debut": false
        },
        {
          "j": 25,
          "lib": "Station Relais Nord – carburant",
          "m": -116,
          "solde": 386,
          "type": "carte",
          "debut": false
        },
        {
          "j": 20,
          "lib": "Café de la Gare – Paris 11e",
          "m": -23,
          "solde": 363,
          "type": "carte",
          "debut": false
        },
        {
          "j": 15,
          "lib": "Voyages Horizon – séjour",
          "m": -843,
          "solde": -480,
          "type": "carte",
          "debut": true
        },
        {
          "j": 11,
          "lib": "Prélèvement rejeté (provision insuffisante) – Opérateur mobile",
          "m": 0,
          "solde": -480,
          "type": "rejet",
          "mandat": "OM-17482",
          "montantRejete": 10.4,
          "debut": false
        },
        {
          "j": 11,
          "lib": "Frais de rejet de prélèvement",
          "m": -10.4,
          "solde": -490.4,
          "type": "frais",
          "debut": false
        },
        {
          "j": 10,
          "lib": "Prélèvement rejeté (provision insuffisante) – Cantine scolaire – régie",
          "m": 0,
          "solde": -490.4,
          "type": "rejet",
          "mandat": "CS-11843",
          "montantRejete": 42.73,
          "debut": false
        },
        {
          "j": 10,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -510.4,
          "type": "frais",
          "debut": false
        },
        {
          "j": 8,
          "lib": "Bijouterie du Centre",
          "m": -276.41,
          "solde": -786.81,
          "type": "carte",
          "debut": false
        },
        {
          "j": 5,
          "lib": "Marché Bio du Centre – Paris 11e",
          "m": -142.67,
          "solde": -929.48,
          "type": "carte",
          "debut": false
        },
        {
          "j": 3,
          "lib": "Supermarché Frais & Co – Paris 11e",
          "m": -139.46,
          "solde": -1068.94,
          "type": "carte",
          "debut": false
        },
        {
          "j": 3,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -1076.94,
          "type": "frais",
          "debut": false
        },
        {
          "j": 2,
          "lib": "Station Relais Est – carburant",
          "m": -215.06,
          "solde": -1292,
          "type": "carte",
          "debut": false
        },
        {
          "j": 2,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -1300,
          "type": "frais",
          "debut": false
        }
      ],
      "historique": [
        {
          "j": 3,
          "canal": "Système",
          "texte": "SMS automatique d'alerte « compte débiteur » envoyé au client"
        }
      ],
      "services": [
        {
          "id": "carte",
          "libelle": "Carte Visa Classic"
        },
        {
          "id": "chequier",
          "libelle": "Chéquier"
        },
        {
          "id": "bad",
          "libelle": "Banque à distance (application et site internet)"
        },
        {
          "id": "decouvert",
          "libelle": "Autorisation de découvert de 400 €"
        }
      ],
      "prelevements": [
        {
          "id": "p1",
          "libelle": "Cantine scolaire – régie (mandat CS-11843)",
          "montant": 42.73
        },
        {
          "id": "p2",
          "libelle": "Opérateur mobile (mandat OM-17482)",
          "montant": 10.4
        }
      ],
      "contact": {
        "canaux": [
          "mobile",
          "sms",
          "email",
          "agence"
        ],
        "echange": [
          "Vous : « Bonjour M. Sabatier, votre compte présente un solde débiteur de 1 300 € depuis 15 jours. Pouvons-nous trouver ensemble une solution pour le régulariser ? »",
          "M. Sabatier : « Depuis les travaux, je suis régulièrement à découvert et ça m'embête. Mon salaire est versé dans ma banque principale : ici, mon compte me sert surtout pour les prélèvements. Si vous avez une solution pour en finir avec ce découvert, je suis preneur. »",
          "Vous : « Je regarde ce que nous pouvons vous proposer. »"
        ],
        "maj": [
          {
            "rubrique": "Revenus",
            "texte": "2 240 € nets par mois, domiciliés dans une autre banque"
          },
          {
            "rubrique": "Endettement",
            "texte": "Taux d'endettement d'environ 19 %, aucun incident de paiement, non inscrit au FICP"
          },
          {
            "rubrique": "Capacité",
            "texte": "Prêt personnel envisageable jusqu'à 2 000 € après étude ; relèvement de l'autorisation de découvert possible de 300 € au plus"
          },
          {
            "rubrique": "Épargne",
            "texte": "Livret A à GS Banque & Assurance : 160 € disponibles"
          }
        ]
      },
      "regularisation": {
        "plan": true,
        "reels": {
          "pret_substitution": {
            "montant": 2000,
            "delai": 7
          },
          "decouvert_autorise": {
            "montant": 300,
            "delai": 3
          },
          "virement_epargne": {
            "montant": 160,
            "delai": 0
          }
        },
        "sociaux": []
      },
      "attendu": {
        "decision": "suivi",
        "courrier": null
      },
      "retenir": [
        "À J15, le premier contact sert à comprendre l'origine du débit et à obtenir une date de régularisation.",
        "Le client a une solution réelle : seuls les moyens et les montants qu'il a annoncés se saisissent."
      ],
      "id": 4
    },
    {
      "scenario": "salaire",
      "palier": 30,
      "objectif": "Un salaire attendu à une date précise : on enregistre le versement et on maintient le suivi.",
      "client": {
        "civilite": "Mme",
        "prenom": "Manon",
        "nom": "SILVA-MARQUES",
        "age": 25,
        "profession": "Éducatrice spécialisée",
        "situation": "Mariée, 2 enfants",
        "ancienneteAns": 7,
        "revenus": 2170,
        "revenusNote": "nouvel employeur, premier salaire à venir",
        "produits": [
          "Compte courant",
          "Carte Visa Classic",
          "Autorisation de découvert de 400 €"
        ],
        "fragile": false,
        "compte": "00732 786 1427",
        "coordonnees": {
          "mobile": "06 39 98 56 95",
          "telephone": "01 99 00 56 95",
          "email": "manon.silva-marques@example.com",
          "adresse": "48 rue de Tolbiac, 75013 Paris"
        },
        "professionnel": "Nouvel employeur depuis le mois dernier"
      },
      "note": null,
      "compte": {
        "solde": -1540,
        "autorisation": 400,
        "debutJours": 30,
        "frais": 103.15,
        "origine": "Garage Moderne – réparation"
      },
      "ressources": {
        "revenuDomicilie": false,
        "salaire": {
          "montant": 2170,
          "dans": 6,
          "nouveau": true
        },
        "epargne": [],
        "credits": [],
        "notes": []
      },
      "releve": [
        {
          "j": 53,
          "lib": "Gaz de Ville – facture",
          "m": -112.96,
          "solde": 1123.21,
          "type": "prelevement",
          "mandat": "GV-85969",
          "debut": false
        },
        {
          "j": 45,
          "lib": "TELCOM+ – forfait mobile",
          "m": -23.71,
          "solde": 1099.5,
          "type": "prelevement",
          "mandat": "TC-87547",
          "debut": false
        },
        {
          "j": 41,
          "lib": "Librairie Le Passage – Paris 7e",
          "m": -39.5,
          "solde": 1060,
          "type": "carte",
          "debut": false
        },
        {
          "j": 36,
          "lib": "Boulangerie du Marché – Paris 7e",
          "m": -37,
          "solde": 1023,
          "type": "carte",
          "debut": false
        },
        {
          "j": 34,
          "lib": "Résidence Les Lilas – loyer",
          "m": -625,
          "solde": 398,
          "type": "prelevement",
          "mandat": "RL-48489",
          "debut": false
        },
        {
          "j": 30,
          "lib": "Garage Moderne – réparation",
          "m": -948,
          "solde": -550,
          "type": "carte",
          "debut": true
        },
        {
          "j": 28,
          "lib": "Prélèvement rejeté (provision insuffisante) – Assurances Solidaires – assurance auto",
          "m": 0,
          "solde": -550,
          "type": "rejet",
          "mandat": "AS-45842",
          "montantRejete": 43.46,
          "debut": false
        },
        {
          "j": 28,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -570,
          "type": "frais",
          "debut": false
        },
        {
          "j": 27,
          "lib": "Marché Bio du Centre – Paris 7e",
          "m": -118.62,
          "solde": -688.62,
          "type": "carte",
          "debut": false
        },
        {
          "j": 23,
          "lib": "Prélèvement rejeté (provision insuffisante) – Gaz de Ville – facture",
          "m": 0,
          "solde": -688.62,
          "type": "rejet",
          "mandat": "GV-85969",
          "montantRejete": 112.96,
          "debut": false
        },
        {
          "j": 23,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -708.62,
          "type": "frais",
          "debut": false
        },
        {
          "j": 17,
          "lib": "Station Relais Est – carburant",
          "m": -237.13,
          "solde": -945.75,
          "type": "carte",
          "debut": false
        },
        {
          "j": 17,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -953.75,
          "type": "frais",
          "debut": false
        },
        {
          "j": 15,
          "lib": "Prélèvement rejeté (provision insuffisante) – TELCOM+ – forfait mobile",
          "m": 0,
          "solde": -953.75,
          "type": "rejet",
          "mandat": "TC-87547",
          "montantRejete": 23.71,
          "debut": false
        },
        {
          "j": 15,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -973.75,
          "type": "frais",
          "debut": false
        },
        {
          "j": 12,
          "lib": "Boutique Mode & Co – Paris 7e",
          "m": -226.82,
          "solde": -1200.57,
          "type": "carte",
          "debut": false
        },
        {
          "j": 8,
          "lib": "Bricol'Express – travaux",
          "m": -304.28,
          "solde": -1504.85,
          "type": "carte",
          "debut": false
        },
        {
          "j": 4,
          "lib": "Prélèvement rejeté (provision insuffisante) – Résidence Les Lilas – loyer",
          "m": 0,
          "solde": -1504.85,
          "type": "rejet",
          "mandat": "RL-48489",
          "montantRejete": 625,
          "debut": false
        },
        {
          "j": 4,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -1524.85,
          "type": "frais",
          "debut": false
        },
        {
          "j": 2,
          "lib": "Intérêts débiteurs (agios)",
          "m": -15.15,
          "solde": -1540,
          "type": "frais",
          "debut": false
        }
      ],
      "historique": [
        {
          "j": 15,
          "canal": "Appel",
          "texte": "Appel – client joint : change d'employeur, premier salaire attendu à la fin du mois."
        },
        {
          "j": 3,
          "canal": "Système",
          "texte": "SMS automatique d'alerte « compte débiteur » envoyé au client"
        }
      ],
      "services": [
        {
          "id": "carte",
          "libelle": "Carte Visa Classic"
        },
        {
          "id": "chequier",
          "libelle": "Chéquier"
        },
        {
          "id": "bad",
          "libelle": "Banque à distance (application et site internet)"
        },
        {
          "id": "decouvert",
          "libelle": "Autorisation de découvert de 400 €"
        }
      ],
      "prelevements": [
        {
          "id": "p1",
          "libelle": "Gaz de Ville – facture (mandat GV-85969)",
          "montant": 112.96
        },
        {
          "id": "p2",
          "libelle": "Assurances Solidaires – assurance auto (mandat AS-45842)",
          "montant": 43.46
        },
        {
          "id": "p3",
          "libelle": "Résidence Les Lilas – loyer (mandat RL-48489)",
          "montant": 625
        },
        {
          "id": "p4",
          "libelle": "TELCOM+ – forfait mobile (mandat TC-87547)",
          "montant": 23.71
        }
      ],
      "contact": {
        "canaux": [
          "mobile",
          "sms",
          "email",
          "agence",
          "fixe"
        ],
        "echange": [
          "Vous : « Bonjour Mme Silva-Marques, votre compte présente un solde débiteur de 1 540 € depuis 30 jours. Pouvons-nous trouver ensemble une solution pour le régulariser ? »",
          "Mme Silva-Marques : « J'ai changé d'employeur le mois dernier. Mon premier salaire, 2 170 €, arrive le {+6}. L'ancien employeur a tardé à me verser mon solde de tout compte et je me suis retrouvée à découvert. »",
          "Vous : « Je note le virement du {+6} sur ce compte. »"
        ],
        "maj": [
          {
            "rubrique": "Situation professionnelle",
            "texte": "Nouvel employeur depuis le mois dernier"
          },
          {
            "rubrique": "Revenus",
            "texte": "Premier salaire de 2 170 € attendu le {+6}, domicilié sur ce compte"
          }
        ]
      },
      "regularisation": {
        "plan": true,
        "reels": {
          "salaire": {
            "montant": 2170,
            "delai": 7
          }
        },
        "sociaux": []
      },
      "attendu": {
        "decision": "suivi",
        "courrier": "j30_depassement"
      },
      "retenir": [
        "À J30, après un mois de dépassement, le client doit recevoir une information écrite (montant, taux débiteur, frais).",
        "Le client a une solution réelle : seuls les moyens et les montants qu'il a annoncés se saisissent."
      ],
      "id": 5
    },
    {
      "scenario": "creance",
      "palier": 30,
      "objectif": "Une somme est à recevoir : on vérifie le montant et le délai avant le palier suivant.",
      "client": {
        "civilite": "M.",
        "prenom": "Mickaël",
        "nom": "VIAL",
        "age": 34,
        "profession": "Chauffeur-livreur (salarié)",
        "situation": "Célibataire",
        "ancienneteAns": 6,
        "revenus": 1750,
        "revenusNote": "revenus non domiciliés (aucun versement régulier sur ce compte)",
        "produits": [
          "Compte courant",
          "Carte Visa Classic"
        ],
        "fragile": false,
        "compte": "00981 367 9476",
        "coordonnees": {
          "mobile": "06 39 98 80 61",
          "telephone": null,
          "email": "mickael.vial@example.com",
          "adresse": "64 boulevard de Magenta, 75010 Paris"
        }
      },
      "note": null,
      "compte": {
        "solde": -470,
        "autorisation": 0,
        "debutJours": 30,
        "frais": 62.31,
        "origine": "Primeur & Cie – Paris 4e"
      },
      "ressources": {
        "revenuDomicilie": false,
        "salaire": null,
        "epargne": [],
        "credits": [],
        "notes": []
      },
      "releve": [
        {
          "j": 47,
          "lib": "Assurances Solidaires – assurance auto",
          "m": -92.81,
          "solde": 343.46,
          "type": "prelevement",
          "mandat": "AS-76664",
          "debut": false
        },
        {
          "j": 41,
          "lib": "Association de quartier – cotisation",
          "m": -13.96,
          "solde": 329.5,
          "type": "prelevement",
          "mandat": "AQ-94561",
          "debut": false
        },
        {
          "j": 40,
          "lib": "Supermarché Marché Plus – Paris 4e",
          "m": -118.5,
          "solde": 211,
          "type": "carte",
          "debut": false
        },
        {
          "j": 38,
          "lib": "Droguerie du Centre – Paris 4e",
          "m": -63.5,
          "solde": 147.5,
          "type": "carte",
          "debut": false
        },
        {
          "j": 36,
          "lib": "Boulangerie du Marché – Paris 4e",
          "m": -18.5,
          "solde": 129,
          "type": "carte",
          "debut": false
        },
        {
          "j": 30,
          "lib": "Primeur & Cie – Paris 4e",
          "m": -259,
          "solde": -130,
          "type": "carte",
          "debut": true
        },
        {
          "j": 28,
          "lib": "Restaurant Chez Mamie – Paris 4e",
          "m": -59.54,
          "solde": -189.54,
          "type": "carte",
          "debut": false
        },
        {
          "j": 28,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -197.54,
          "type": "frais",
          "debut": false
        },
        {
          "j": 24,
          "lib": "Boutique Mode & Co – Paris 4e",
          "m": -34.1,
          "solde": -231.64,
          "type": "carte",
          "debut": false
        },
        {
          "j": 24,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -239.64,
          "type": "frais",
          "debut": false
        },
        {
          "j": 19,
          "lib": "Retrait DAB",
          "m": -33.56,
          "solde": -273.2,
          "type": "carte",
          "debut": false
        },
        {
          "j": 19,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -281.2,
          "type": "frais",
          "debut": false
        },
        {
          "j": 17,
          "lib": "Prélèvement rejeté (provision insuffisante) – Assurances Solidaires – assurance auto",
          "m": 0,
          "solde": -281.2,
          "type": "rejet",
          "mandat": "AS-76664",
          "montantRejete": 92.81,
          "debut": false
        },
        {
          "j": 17,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -301.2,
          "type": "frais",
          "debut": false
        },
        {
          "j": 17,
          "lib": "Pharmacie du Centre – Paris 4e",
          "m": -57.32,
          "solde": -358.52,
          "type": "carte",
          "debut": false
        },
        {
          "j": 11,
          "lib": "Prélèvement rejeté (provision insuffisante) – Association de quartier – cotisation",
          "m": 0,
          "solde": -358.52,
          "type": "rejet",
          "mandat": "AQ-94561",
          "montantRejete": 13.96,
          "debut": false
        },
        {
          "j": 11,
          "lib": "Frais de rejet de prélèvement",
          "m": -13.96,
          "solde": -372.48,
          "type": "frais",
          "debut": false
        },
        {
          "j": 4,
          "lib": "Boutique Mode & Co – Paris 4e",
          "m": -30.89,
          "solde": -403.37,
          "type": "carte",
          "debut": false
        },
        {
          "j": 2,
          "lib": "Intérêts débiteurs (agios)",
          "m": -4.35,
          "solde": -407.72,
          "type": "frais",
          "debut": false
        },
        {
          "j": 1,
          "lib": "Boutique Mode & Co – Paris 4e",
          "m": -62.28,
          "solde": -470,
          "type": "carte",
          "debut": false
        }
      ],
      "historique": [
        {
          "j": 15,
          "canal": "Appel",
          "texte": "Appel – client joint : attend une somme à recevoir, pas encore arrivée."
        },
        {
          "j": 3,
          "canal": "Système",
          "texte": "SMS automatique d'alerte « compte débiteur » envoyé au client"
        }
      ],
      "services": [
        {
          "id": "carte",
          "libelle": "Carte Visa Classic"
        },
        {
          "id": "chequier",
          "libelle": "Chéquier"
        },
        {
          "id": "bad",
          "libelle": "Banque à distance (application et site internet)"
        }
      ],
      "prelevements": [
        {
          "id": "p1",
          "libelle": "Assurances Solidaires – assurance auto (mandat AS-76664)",
          "montant": 92.81
        },
        {
          "id": "p2",
          "libelle": "Association de quartier – cotisation (mandat AQ-94561)",
          "montant": 13.96
        }
      ],
      "contact": {
        "canaux": [
          "mobile",
          "sms",
          "email",
          "agence"
        ],
        "echange": [
          "Vous : « Bonjour M. Vial, votre compte présente un solde débiteur de 470 € depuis 30 jours. Pouvons-nous trouver ensemble une solution pour le régulariser ? »",
          "M. Vial : « J'attends le remboursement d'un voyage annulé : 770 €, qui doit être versé d'ici 21 jours. Je vous apporterai le chèque dès réception. »",
          "Vous : « Je note la somme et le délai annoncés. »"
        ],
        "maj": [
          {
            "rubrique": "Somme à recevoir",
            "texte": "Remboursement d'un voyage annulé : 770 €, attendu dans 21 jours"
          }
        ]
      },
      "regularisation": {
        "plan": true,
        "reels": {
          "creance": {
            "montant": 770,
            "delai": 30
          }
        },
        "sociaux": []
      },
      "attendu": {
        "decision": "suivi",
        "courrier": "j30_depassement"
      },
      "retenir": [
        "À J30, après un mois de dépassement, le client doit recevoir une information écrite (montant, taux débiteur, frais).",
        "Le client a une solution réelle : seuls les moyens et les montants qu'il a annoncés se saisissent."
      ],
      "id": 6
    },
    {
      "scenario": "proche",
      "palier": 30,
      "objectif": "Une aide familiale est annoncée : on note le montant et la date.",
      "client": {
        "civilite": "Mme",
        "prenom": "Colette",
        "nom": "SANTOS",
        "age": 79,
        "profession": "Retraitée (ancienne ouvrière)",
        "situation": "Divorcée, 1 enfant",
        "ancienneteAns": 4,
        "revenus": 1510,
        "revenusNote": "revenus non domiciliés (aucun versement régulier sur ce compte)",
        "produits": [
          "Compte courant",
          "Carte Visa Classic",
          "Autorisation de découvert de 500 €"
        ],
        "fragile": false,
        "compte": "00845 185 8131",
        "coordonnees": {
          "mobile": "06 39 98 61 62",
          "telephone": "01 99 00 61 62",
          "email": "colette.santos@example.com",
          "adresse": "33 rue de la Convention, 75015 Paris"
        }
      },
      "note": null,
      "compte": {
        "solde": -1590,
        "autorisation": 500,
        "debutJours": 30,
        "frais": 63.81,
        "origine": "Voyages Horizon – séjour"
      },
      "ressources": {
        "revenuDomicilie": false,
        "salaire": null,
        "epargne": [],
        "credits": [],
        "notes": []
      },
      "releve": [
        {
          "j": 49,
          "lib": "Résidence Les Lilas – loyer",
          "m": -410,
          "solde": 650.77,
          "type": "prelevement",
          "mandat": "RL-55957",
          "debut": false
        },
        {
          "j": 36,
          "lib": "Magasin de sport Sportifs – Paris 10e",
          "m": -70.5,
          "solde": 580.27,
          "type": "carte",
          "debut": false
        },
        {
          "j": 34,
          "lib": "TELCOM+ – forfait mobile",
          "m": -35.27,
          "solde": 545,
          "type": "prelevement",
          "mandat": "TC-87890",
          "debut": false
        },
        {
          "j": 34,
          "lib": "Magasin de sport Sportifs – Paris 10e",
          "m": -81.5,
          "solde": 463.5,
          "type": "carte",
          "debut": false
        },
        {
          "j": 33,
          "lib": "Boutique Mode & Co – Paris 10e",
          "m": -86.5,
          "solde": 377,
          "type": "carte",
          "debut": false
        },
        {
          "j": 30,
          "lib": "Voyages Horizon – séjour",
          "m": -967,
          "solde": -590,
          "type": "carte",
          "debut": true
        },
        {
          "j": 25,
          "lib": "High-Tech Store",
          "m": -268.84,
          "solde": -858.84,
          "type": "carte",
          "debut": false
        },
        {
          "j": 19,
          "lib": "Prélèvement rejeté (provision insuffisante) – Résidence Les Lilas – loyer",
          "m": 0,
          "solde": -858.84,
          "type": "rejet",
          "mandat": "RL-55957",
          "montantRejete": 410,
          "debut": false
        },
        {
          "j": 19,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -878.84,
          "type": "frais",
          "debut": false
        },
        {
          "j": 4,
          "lib": "Prélèvement rejeté (provision insuffisante) – TELCOM+ – forfait mobile",
          "m": 0,
          "solde": -878.84,
          "type": "rejet",
          "mandat": "TC-87890",
          "montantRejete": 35.27,
          "debut": false
        },
        {
          "j": 4,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -898.84,
          "type": "frais",
          "debut": false
        },
        {
          "j": 3,
          "lib": "Voyages Horizon – séjour",
          "m": -302.6,
          "solde": -1201.44,
          "type": "carte",
          "debut": false
        },
        {
          "j": 3,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -1209.44,
          "type": "frais",
          "debut": false
        },
        {
          "j": 2,
          "lib": "Intérêts débiteurs (agios)",
          "m": -15.81,
          "solde": -1225.25,
          "type": "frais",
          "debut": false
        },
        {
          "j": 2,
          "lib": "Boutique Mode & Co – Paris 10e",
          "m": -242.05,
          "solde": -1467.3,
          "type": "carte",
          "debut": false
        },
        {
          "j": 1,
          "lib": "Boutique Mode & Co – Paris 10e",
          "m": -122.7,
          "solde": -1590,
          "type": "carte",
          "debut": false
        }
      ],
      "historique": [
        {
          "j": 15,
          "canal": "Appel",
          "texte": "Appel – client joint : une aide de la famille est annoncée, pas encore reçue."
        },
        {
          "j": 3,
          "canal": "Système",
          "texte": "SMS automatique d'alerte « compte débiteur » envoyé au client"
        }
      ],
      "services": [
        {
          "id": "carte",
          "libelle": "Carte Visa Classic"
        },
        {
          "id": "chequier",
          "libelle": "Chéquier"
        },
        {
          "id": "bad",
          "libelle": "Banque à distance (application et site internet)"
        },
        {
          "id": "decouvert",
          "libelle": "Autorisation de découvert de 500 €"
        }
      ],
      "prelevements": [
        {
          "id": "p1",
          "libelle": "Résidence Les Lilas – loyer (mandat RL-55957)",
          "montant": 410
        },
        {
          "id": "p2",
          "libelle": "TELCOM+ – forfait mobile (mandat TC-87890)",
          "montant": 35.27
        }
      ],
      "contact": {
        "canaux": [
          "mobile",
          "sms",
          "email",
          "agence",
          "fixe"
        ],
        "echange": [
          "Vous : « Bonjour Mme Santos, votre compte présente un solde débiteur de 1 590 € depuis 30 jours. Pouvons-nous trouver ensemble une solution pour le régulariser ? »",
          "Mme Santos : « Ma sœur va m'aider : un virement de 1 710 € d'ici trois jours. Je leur ai expliqué la situation. »",
          "Vous : « D'accord, je note l'aide de votre famille. »"
        ],
        "maj": [
          {
            "rubrique": "Aide d'un proche",
            "texte": "Virement de 1 710 € annoncé d'ici trois jours"
          }
        ]
      },
      "regularisation": {
        "plan": true,
        "reels": {
          "aide_proche": {
            "montant": 1710,
            "delai": 3
          }
        },
        "sociaux": []
      },
      "attendu": {
        "decision": "suivi",
        "courrier": "j30_depassement"
      },
      "retenir": [
        "À J30, après un mois de dépassement, le client doit recevoir une information écrite (montant, taux débiteur, frais).",
        "Le client a une solution réelle : seuls les moyens et les montants qu'il a annoncés se saisissent."
      ],
      "id": 7
    },
    {
      "scenario": "difficultes",
      "palier": 30,
      "objectif": "Aucune ressource à court terme : pas de promesse à noter, une démarche d'accompagnement s'impose.",
      "client": {
        "civilite": "M.",
        "prenom": "Tom",
        "nom": "PARENT",
        "age": 26,
        "profession": "Agent d'accueil (CDI)",
        "situation": "Pacsé",
        "ancienneteAns": 8,
        "revenus": 1500,
        "revenusNote": "revenus interrompus, aucun versement régulier sur ce compte",
        "produits": [
          "Compte courant",
          "Carte Visa Classic",
          "Autorisation de découvert de 300 €"
        ],
        "fragile": false,
        "compte": "00253 960 5084",
        "coordonnees": {
          "mobile": "06 39 98 64 75",
          "telephone": "01 99 00 64 75",
          "email": "tom.parent@example.com",
          "adresse": "43 rue de Tolbiac, 75013 Paris"
        },
        "professionnel": "Fin de contrat, allocations pas encore versées"
      },
      "note": null,
      "compte": {
        "solde": -1170,
        "autorisation": 300,
        "debutJours": 30,
        "frais": 123.46,
        "origine": "Garage Moderne – réparation"
      },
      "ressources": {
        "revenuDomicilie": false,
        "salaire": null,
        "epargne": [],
        "credits": [],
        "notes": []
      },
      "releve": [
        {
          "j": 55,
          "lib": "TELCOM+ – forfait mobile",
          "m": -27.62,
          "solde": 794.93,
          "type": "prelevement",
          "mandat": "TC-76210",
          "debut": false
        },
        {
          "j": 55,
          "lib": "Boulangerie du Marché – Paris 16e",
          "m": -51.5,
          "solde": 743.43,
          "type": "carte",
          "debut": false
        },
        {
          "j": 52,
          "lib": "Habitat Capitale – loyer",
          "m": -420,
          "solde": 323.43,
          "type": "prelevement",
          "mandat": "HC-98965",
          "debut": false
        },
        {
          "j": 40,
          "lib": "Prévoyance Famille – cotisation",
          "m": -19.64,
          "solde": 303.79,
          "type": "prelevement",
          "mandat": "PF-83540",
          "debut": false
        },
        {
          "j": 34,
          "lib": "Association de quartier – cotisation",
          "m": -12.29,
          "solde": 291.5,
          "type": "prelevement",
          "mandat": "AQ-52978",
          "debut": false
        },
        {
          "j": 31,
          "lib": "Magasin de sport Sportifs – Paris 16e",
          "m": -120.5,
          "solde": 171,
          "type": "carte",
          "debut": false
        },
        {
          "j": 30,
          "lib": "Garage Moderne – réparation",
          "m": -591,
          "solde": -420,
          "type": "carte",
          "debut": true
        },
        {
          "j": 26,
          "lib": "Station Relais Est – carburant",
          "m": -105.03,
          "solde": -525.03,
          "type": "carte",
          "debut": false
        },
        {
          "j": 26,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -533.03,
          "type": "frais",
          "debut": false
        },
        {
          "j": 25,
          "lib": "Prélèvement rejeté (provision insuffisante) – TELCOM+ – forfait mobile",
          "m": 0,
          "solde": -533.03,
          "type": "rejet",
          "mandat": "TC-76210",
          "montantRejete": 27.62,
          "debut": false
        },
        {
          "j": 25,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -553.03,
          "type": "frais",
          "debut": false
        },
        {
          "j": 22,
          "lib": "Prélèvement rejeté (provision insuffisante) – Habitat Capitale – loyer",
          "m": 0,
          "solde": -553.03,
          "type": "rejet",
          "mandat": "HC-98965",
          "montantRejete": 420,
          "debut": false
        },
        {
          "j": 22,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -573.03,
          "type": "frais",
          "debut": false
        },
        {
          "j": 20,
          "lib": "Station Relais Est – carburant",
          "m": -91.83,
          "solde": -664.86,
          "type": "carte",
          "debut": false
        },
        {
          "j": 20,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -672.86,
          "type": "frais",
          "debut": false
        },
        {
          "j": 18,
          "lib": "Boutique Mode & Co – Paris 16e",
          "m": -170.54,
          "solde": -843.4,
          "type": "carte",
          "debut": false
        },
        {
          "j": 18,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -851.4,
          "type": "frais",
          "debut": false
        },
        {
          "j": 10,
          "lib": "Prélèvement rejeté (provision insuffisante) – Prévoyance Famille – cotisation",
          "m": 0,
          "solde": -851.4,
          "type": "rejet",
          "mandat": "PF-83540",
          "montantRejete": 19.64,
          "debut": false
        },
        {
          "j": 10,
          "lib": "Frais de rejet de prélèvement",
          "m": -19.64,
          "solde": -871.04,
          "type": "frais",
          "debut": false
        },
        {
          "j": 8,
          "lib": "Supermarché Frais & Co – Paris 16e",
          "m": -117.87,
          "solde": -988.91,
          "type": "carte",
          "debut": false
        },
        {
          "j": 8,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -996.91,
          "type": "frais",
          "debut": false
        },
        {
          "j": 6,
          "lib": "Marché Bio du Centre – Paris 16e",
          "m": -141.27,
          "solde": -1138.18,
          "type": "carte",
          "debut": false
        },
        {
          "j": 6,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -1146.18,
          "type": "frais",
          "debut": false
        },
        {
          "j": 4,
          "lib": "Prélèvement rejeté (provision insuffisante) – Association de quartier – cotisation",
          "m": 0,
          "solde": -1146.18,
          "type": "rejet",
          "mandat": "AQ-52978",
          "montantRejete": 12.29,
          "debut": false
        },
        {
          "j": 4,
          "lib": "Frais de rejet de prélèvement",
          "m": -12.29,
          "solde": -1158.47,
          "type": "frais",
          "debut": false
        },
        {
          "j": 2,
          "lib": "Intérêts débiteurs (agios)",
          "m": -11.53,
          "solde": -1170,
          "type": "frais",
          "debut": false
        }
      ],
      "historique": [
        {
          "j": 15,
          "canal": "Appel",
          "texte": "Appel – client joint : perte de revenus, aucune solution à court terme."
        },
        {
          "j": 3,
          "canal": "Système",
          "texte": "SMS automatique d'alerte « compte débiteur » envoyé au client"
        }
      ],
      "services": [
        {
          "id": "carte",
          "libelle": "Carte Visa Classic"
        },
        {
          "id": "chequier",
          "libelle": "Chéquier"
        },
        {
          "id": "bad",
          "libelle": "Banque à distance (application et site internet)"
        },
        {
          "id": "decouvert",
          "libelle": "Autorisation de découvert de 300 €"
        }
      ],
      "prelevements": [
        {
          "id": "p1",
          "libelle": "Habitat Capitale – loyer (mandat HC-98965)",
          "montant": 420
        },
        {
          "id": "p2",
          "libelle": "Prévoyance Famille – cotisation (mandat PF-83540)",
          "montant": 19.64
        },
        {
          "id": "p3",
          "libelle": "Association de quartier – cotisation (mandat AQ-52978)",
          "montant": 12.29
        },
        {
          "id": "p4",
          "libelle": "TELCOM+ – forfait mobile (mandat TC-76210)",
          "montant": 27.62
        }
      ],
      "contact": {
        "canaux": [
          "mobile",
          "sms",
          "email",
          "agence",
          "fixe"
        ],
        "echange": [
          "Vous : « Bonjour M. Parent, votre compte présente un solde débiteur de 1 170 € depuis 30 jours. Pouvons-nous trouver ensemble une solution pour le régulariser ? »",
          "M. Parent : « Mon contrat s'est terminé et mes allocations ne sont pas encore versées. Je n'ai aucune rentrée avant plusieurs semaines. »",
          "Vous : « Je comprends. Je note que vous n'avez pas de rentrée prévue à court terme. »",
          "M. Parent : « Ma famille peut peut-être m'avancer 110 € la semaine prochaine, mais pas plus. »"
        ],
        "maj": [
          {
            "rubrique": "Situation professionnelle",
            "texte": "Fin de contrat, allocations pas encore versées"
          },
          {
            "rubrique": "Ressources",
            "texte": "Aucune rentrée régulière actuellement ; charges fixes d'environ 1 540 € par mois"
          },
          {
            "rubrique": "Aide d'un proche",
            "texte": "Avance possible de 110 € dans la semaine"
          }
        ]
      },
      "regularisation": {
        "plan": false,
        "reels": {
          "aide_proche": {
            "montant": 110,
            "delai": 7
          }
        },
        "sociaux": [
          "accompagnement",
          "surendettement"
        ]
      },
      "attendu": {
        "decision": "agence",
        "courrier": "j30_depassement"
      },
      "retenir": [
        "À J30, après un mois de dépassement, le client doit recevoir une information écrite (montant, taux débiteur, frais).",
        "Sans solution financière, on enregistre « aucun moyen » ou une démarche d'accompagnement, jamais une ressource inventée."
      ],
      "id": 8
    },
    {
      "scenario": "creance",
      "palier": 60,
      "objectif": "Une somme est à recevoir : on vérifie le montant et le délai avant le palier suivant.",
      "client": {
        "civilite": "M.",
        "prenom": "Damien",
        "nom": "DUBREUIL",
        "age": 55,
        "profession": "Comptable (CDI)",
        "situation": "Marié",
        "ancienneteAns": 3,
        "revenus": 2680,
        "revenusNote": "revenus non domiciliés (aucun versement régulier sur ce compte)",
        "produits": [
          "Compte courant",
          "Carte Visa Classic",
          "Autorisation de découvert de 300 €"
        ],
        "fragile": false,
        "compte": "00325 964 1690",
        "coordonnees": {
          "mobile": "06 39 98 36 16",
          "telephone": null,
          "email": "damien.dubreuil@example.com",
          "adresse": "42 rue de Charonne, 75011 Paris"
        }
      },
      "note": null,
      "compte": {
        "solde": -1500,
        "autorisation": 300,
        "debutJours": 60,
        "frais": 170.98,
        "origine": "Électroménager Plus"
      },
      "ressources": {
        "revenuDomicilie": false,
        "salaire": null,
        "epargne": [],
        "credits": [],
        "notes": []
      },
      "releve": [
        {
          "j": 78,
          "lib": "Habitat Capitale – loyer",
          "m": -850,
          "solde": 417.45,
          "type": "prelevement",
          "mandat": "HC-11185",
          "debut": false
        },
        {
          "j": 76,
          "lib": "Le Bistrot Lyonnais – Paris 13e",
          "m": -84,
          "solde": 333.45,
          "type": "carte",
          "debut": false
        },
        {
          "j": 74,
          "lib": "Mutuelle Santé Plus",
          "m": -45.99,
          "solde": 287.46,
          "type": "prelevement",
          "mandat": "MS-38691",
          "debut": false
        },
        {
          "j": 68,
          "lib": "Fibra – box internet",
          "m": -35.46,
          "solde": 252,
          "type": "prelevement",
          "mandat": "FB-78314",
          "debut": false
        },
        {
          "j": 62,
          "lib": "Le Bistrot Lyonnais – Paris 13e",
          "m": -49,
          "solde": 203,
          "type": "carte",
          "debut": false
        },
        {
          "j": 60,
          "lib": "Électroménager Plus",
          "m": -563,
          "solde": -360,
          "type": "carte",
          "debut": true
        },
        {
          "j": 53,
          "lib": "Boutique Mode & Co – Paris 13e",
          "m": -92.65,
          "solde": -452.65,
          "type": "carte",
          "debut": false
        },
        {
          "j": 52,
          "lib": "Boutique Mode & Co – Paris 13e",
          "m": -124.77,
          "solde": -577.42,
          "type": "carte",
          "debut": false
        },
        {
          "j": 52,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -585.42,
          "type": "frais",
          "debut": false
        },
        {
          "j": 48,
          "lib": "Prélèvement rejeté (provision insuffisante) – Habitat Capitale – loyer",
          "m": 0,
          "solde": -585.42,
          "type": "rejet",
          "mandat": "HC-11185",
          "montantRejete": 850,
          "debut": false
        },
        {
          "j": 48,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -605.42,
          "type": "frais",
          "debut": false
        },
        {
          "j": 44,
          "lib": "Prélèvement rejeté (provision insuffisante) – Mutuelle Santé Plus",
          "m": 0,
          "solde": -605.42,
          "type": "rejet",
          "mandat": "MS-38691",
          "montantRejete": 45.99,
          "debut": false
        },
        {
          "j": 44,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -625.42,
          "type": "frais",
          "debut": false
        },
        {
          "j": 38,
          "lib": "Prélèvement rejeté (provision insuffisante) – Fibra – box internet",
          "m": 0,
          "solde": -625.42,
          "type": "rejet",
          "mandat": "FB-78314",
          "montantRejete": 35.46,
          "debut": false
        },
        {
          "j": 38,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -645.42,
          "type": "frais",
          "debut": false
        },
        {
          "j": 32,
          "lib": "Intérêts débiteurs (agios)",
          "m": -13.49,
          "solde": -658.91,
          "type": "frais",
          "debut": false
        },
        {
          "j": 30,
          "lib": "Primeur & Cie – Paris 13e",
          "m": -173.73,
          "solde": -832.64,
          "type": "carte",
          "debut": false
        },
        {
          "j": 29,
          "lib": "Marché Bio du Centre – Paris 13e",
          "m": -171.73,
          "solde": -1004.37,
          "type": "carte",
          "debut": false
        },
        {
          "j": 18,
          "lib": "Prélèvement rejeté (provision insuffisante) – Habitat Capitale – loyer",
          "m": 0,
          "solde": -1004.37,
          "type": "rejet",
          "mandat": "HC-11185",
          "montantRejete": 850,
          "debut": false
        },
        {
          "j": 18,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -1024.37,
          "type": "frais",
          "debut": false
        },
        {
          "j": 14,
          "lib": "Prélèvement rejeté (provision insuffisante) – Mutuelle Santé Plus",
          "m": 0,
          "solde": -1024.37,
          "type": "rejet",
          "mandat": "MS-38691",
          "montantRejete": 45.99,
          "debut": false
        },
        {
          "j": 14,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -1044.37,
          "type": "frais",
          "debut": false
        },
        {
          "j": 11,
          "lib": "Magasin de sport Sportifs – Paris 13e",
          "m": -200.14,
          "solde": -1244.51,
          "type": "carte",
          "debut": false
        },
        {
          "j": 11,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -1252.51,
          "type": "frais",
          "debut": false
        },
        {
          "j": 9,
          "lib": "Boutique Mode & Co – Paris 13e",
          "m": -87.86,
          "solde": -1340.37,
          "type": "carte",
          "debut": false
        },
        {
          "j": 9,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -1348.37,
          "type": "frais",
          "debut": false
        },
        {
          "j": 8,
          "lib": "Prélèvement rejeté (provision insuffisante) – Fibra – box internet",
          "m": 0,
          "solde": -1348.37,
          "type": "rejet",
          "mandat": "FB-78314",
          "montantRejete": 35.46,
          "debut": false
        },
        {
          "j": 8,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -1368.37,
          "type": "frais",
          "debut": false
        },
        {
          "j": 2,
          "lib": "Intérêts débiteurs (agios)",
          "m": -13.49,
          "solde": -1381.86,
          "type": "frais",
          "debut": false
        },
        {
          "j": 2,
          "lib": "Primeur & Cie – Paris 13e",
          "m": -118.14,
          "solde": -1500,
          "type": "carte",
          "debut": false
        }
      ],
      "historique": [
        {
          "j": 30,
          "canal": "Courrier",
          "texte": "Information écrite sur le dépassement envoyée au client (courrier simple)."
        },
        {
          "j": 15,
          "canal": "Appel",
          "texte": "Appel – client joint : attend une somme à recevoir, pas encore arrivée."
        },
        {
          "j": 3,
          "canal": "Système",
          "texte": "SMS automatique d'alerte « compte débiteur » envoyé au client"
        }
      ],
      "services": [
        {
          "id": "carte",
          "libelle": "Carte Visa Classic"
        },
        {
          "id": "chequier",
          "libelle": "Chéquier"
        },
        {
          "id": "bad",
          "libelle": "Banque à distance (application et site internet)"
        },
        {
          "id": "decouvert",
          "libelle": "Autorisation de découvert de 300 €"
        }
      ],
      "prelevements": [
        {
          "id": "p1",
          "libelle": "Mutuelle Santé Plus (mandat MS-38691)",
          "montant": 45.99
        },
        {
          "id": "p2",
          "libelle": "Habitat Capitale – loyer (mandat HC-11185)",
          "montant": 850
        },
        {
          "id": "p3",
          "libelle": "Fibra – box internet (mandat FB-78314)",
          "montant": 35.46
        }
      ],
      "contact": {
        "canaux": [
          "mobile",
          "sms",
          "email",
          "agence"
        ],
        "echange": [
          "Vous : « Bonjour M. Dubreuil, votre compte présente un solde débiteur de 1 500 € depuis 60 jours. Pouvons-nous trouver ensemble une solution pour le régulariser ? »",
          "M. Dubreuil : « J'attends le remboursement d'un voyage annulé : 1 700 €, qui doit être versé d'ici 28 jours. Je l'ai fait virer sur ce compte. »",
          "Vous : « Je note la somme et le délai annoncés. »"
        ],
        "maj": [
          {
            "rubrique": "Somme à recevoir",
            "texte": "Remboursement d'un voyage annulé : 1 700 €, attendu dans 28 jours"
          }
        ]
      },
      "regularisation": {
        "plan": true,
        "reels": {
          "creance": {
            "montant": 1700,
            "delai": 30
          }
        },
        "sociaux": []
      },
      "attendu": {
        "decision": "maintenir",
        "courrier": "j60_relance"
      },
      "retenir": [
        "À J60, la clôture devient possible : la banque dénonce la convention de compte avec un préavis de deux mois. Un client fragile se traite d'abord par l'accompagnement.",
        "Le client a une solution réelle : seuls les moyens et les montants qu'il a annoncés se saisissent."
      ],
      "id": 9
    },
    {
      "scenario": "fragile",
      "palier": 60,
      "objectif": "Un client fragile : on accompagne avant toute clôture.",
      "client": {
        "civilite": "M.",
        "prenom": "Anthony",
        "nom": "COUTURIER",
        "age": 55,
        "profession": "Demandeur d'emploi (ancien employé)",
        "situation": "Marié",
        "ancienneteAns": 20,
        "revenus": 1090,
        "revenusNote": "revenus interrompus, aucun versement régulier sur ce compte",
        "produits": [
          "Compte courant",
          "Offre clientèle fragile (OCF)",
          "Carte à autorisation systématique",
          "Autorisation de découvert de 100 €",
          "Crédit à la consommation GS (échéance de 310 € par mois)"
        ],
        "fragile": true,
        "compte": "00968 881 1108",
        "coordonnees": {
          "mobile": "06 39 98 17 67",
          "telephone": null,
          "email": "anthony.couturier@example.com",
          "adresse": "27 rue des Pyrénées, 75020 Paris"
        },
        "professionnel": "Séparation récente, charges du foyer assumées seul"
      },
      "note": null,
      "compte": {
        "solde": -782.76,
        "autorisation": 100,
        "debutJours": 60,
        "frais": 32.76,
        "origine": "FINACRED – mensualité de crédit (échéance du crédit)"
      },
      "ressources": {
        "revenuDomicilie": false,
        "salaire": null,
        "epargne": [
          {
            "produit": "Livret A",
            "solde": 60
          }
        ],
        "credits": [
          {
            "libelle": "FINACRED – mensualité de crédit (crédit à la consommation GS)",
            "mensualite": 310
          }
        ],
        "notes": []
      },
      "releve": [
        {
          "j": 78,
          "lib": "Boulangerie Les Délices – Paris 5e",
          "m": -46,
          "solde": 499.71,
          "type": "carte",
          "debut": false
        },
        {
          "j": 75,
          "lib": "Gaz de Ville – facture",
          "m": -85.21,
          "solde": 414.5,
          "type": "prelevement",
          "mandat": "GV-77514",
          "debut": false
        },
        {
          "j": 69,
          "lib": "Pharmacie Centrale – Paris 5e",
          "m": -77.5,
          "solde": 337,
          "type": "carte",
          "debut": false
        },
        {
          "j": 68,
          "lib": "Brasserie du Coin – Paris 5e",
          "m": -102.5,
          "solde": 234.5,
          "type": "carte",
          "debut": false
        },
        {
          "j": 61,
          "lib": "Brasserie du Coin – Paris 5e",
          "m": -54.5,
          "solde": 180,
          "type": "carte",
          "debut": false
        },
        {
          "j": 60,
          "lib": "FINACRED – mensualité de crédit (échéance du crédit)",
          "m": -310,
          "solde": -130,
          "type": "prelevement",
          "mandat": "FC-83063",
          "debut": true
        },
        {
          "j": 56,
          "lib": "Prélèvement rejeté (provision insuffisante) – Presse & Co – abonnement",
          "m": 0,
          "solde": -130,
          "type": "rejet",
          "mandat": "PC-83158",
          "montantRejete": 24.68,
          "debut": false
        },
        {
          "j": 45,
          "lib": "Prélèvement rejeté (provision insuffisante) – Gaz de Ville – facture",
          "m": 0,
          "solde": -130,
          "type": "rejet",
          "mandat": "GV-77514",
          "montantRejete": 85.21,
          "debut": false
        },
        {
          "j": 45,
          "lib": "Frais de rejet de prélèvement",
          "m": -10,
          "solde": -140,
          "type": "frais",
          "debut": false
        },
        {
          "j": 32,
          "lib": "Intérêts débiteurs (agios)",
          "m": -6.38,
          "solde": -146.38,
          "type": "frais",
          "debut": false
        },
        {
          "j": 30,
          "lib": "FINACRED – mensualité de crédit (échéance du crédit)",
          "m": -310,
          "solde": -456.38,
          "type": "prelevement",
          "mandat": "FC-83063",
          "debut": false
        },
        {
          "j": 26,
          "lib": "Prélèvement rejeté (provision insuffisante) – Presse & Co – abonnement",
          "m": 0,
          "solde": -456.38,
          "type": "rejet",
          "mandat": "PC-83158",
          "montantRejete": 24.68,
          "debut": false
        },
        {
          "j": 15,
          "lib": "Prélèvement rejeté (provision insuffisante) – Gaz de Ville – facture",
          "m": 0,
          "solde": -456.38,
          "type": "rejet",
          "mandat": "GV-77514",
          "montantRejete": 85.21,
          "debut": false
        },
        {
          "j": 15,
          "lib": "Frais de rejet de prélèvement",
          "m": -10,
          "solde": -466.38,
          "type": "frais",
          "debut": false
        },
        {
          "j": 2,
          "lib": "Intérêts débiteurs (agios)",
          "m": -6.38,
          "solde": -472.76,
          "type": "frais",
          "debut": false
        },
        {
          "j": 0,
          "lib": "FINACRED – mensualité de crédit (échéance du crédit)",
          "m": -310,
          "solde": -782.76,
          "type": "prelevement",
          "mandat": "FC-83063",
          "debut": false
        }
      ],
      "historique": [
        {
          "j": 30,
          "canal": "Courrier",
          "texte": "Information écrite sur le dépassement envoyée au client (courrier simple)."
        },
        {
          "j": 15,
          "canal": "Appel",
          "texte": "Appel – client joint : perte de revenus, aucune solution à court terme."
        },
        {
          "j": 3,
          "canal": "Système",
          "texte": "SMS automatique d'alerte « compte débiteur » envoyé au client"
        }
      ],
      "services": [
        {
          "id": "carte",
          "libelle": "Carte à autorisation systématique"
        },
        {
          "id": "bad",
          "libelle": "Banque à distance (application et site internet)"
        },
        {
          "id": "decouvert",
          "libelle": "Autorisation de découvert de 100 €"
        }
      ],
      "prelevements": [
        {
          "id": "p1",
          "libelle": "Gaz de Ville – facture (mandat GV-77514)",
          "montant": 85.21
        },
        {
          "id": "p2",
          "libelle": "Presse & Co – abonnement (mandat PC-83158)",
          "montant": 24.68
        }
      ],
      "contact": {
        "canaux": [
          "mobile",
          "sms",
          "email",
          "agence"
        ],
        "echange": [
          "Vous : « Bonjour M. Couturier, votre compte présente un solde débiteur de 782,76 € depuis 60 jours. Pouvons-nous trouver ensemble une solution pour le régulariser ? »",
          "M. Couturier : « Je me suis séparé et je supporte seul le loyer et les charges du logement. Je n'ai pas les moyens de rembourser pour l'instant. »",
          "Vous : « Je comprends. Je note que vous n'avez pas de rentrée prévue à court terme. »"
        ],
        "maj": [
          {
            "rubrique": "Situation professionnelle",
            "texte": "Séparation récente, charges du foyer assumées seul"
          },
          {
            "rubrique": "Ressources",
            "texte": "Aucune rentrée régulière actuellement ; charges fixes d'environ 1 010 € par mois"
          },
          {
            "rubrique": "Statut",
            "texte": "Client titulaire de l'offre clientèle fragile (OCF) : frais d'incidents plafonnés"
          },
          {
            "rubrique": "Crédit",
            "texte": "Crédit à la consommation GS : échéance de 310 € prélevée chaque mois"
          },
          {
            "rubrique": "Épargne",
            "texte": "Livret A à GS Banque & Assurance : 60 € disponibles"
          }
        ]
      },
      "regularisation": {
        "plan": false,
        "reels": {
          "virement_epargne": {
            "montant": 60,
            "delai": 0
          }
        },
        "sociaux": [
          "accompagnement"
        ]
      },
      "attendu": {
        "decision": "maintenir",
        "courrier": "j60_relance"
      },
      "retenir": [
        "À J60, la clôture devient possible : la banque dénonce la convention de compte avec un préavis de deux mois. Un client fragile se traite d'abord par l'accompagnement.",
        "Sans solution financière, on enregistre « aucun moyen » ou une démarche d'accompagnement, jamais une ressource inventée."
      ],
      "id": 10
    },
    {
      "scenario": "difficultes",
      "palier": 60,
      "objectif": "Aucune ressource à court terme : pas de promesse à noter, une démarche d'accompagnement s'impose.",
      "client": {
        "civilite": "M.",
        "prenom": "Mickaël",
        "nom": "LECOMTE",
        "age": 34,
        "profession": "Vendeur (CDI)",
        "situation": "Célibataire, 1 enfant",
        "ancienneteAns": 4,
        "revenus": 1500,
        "revenusNote": "revenus interrompus, aucun versement régulier sur ce compte",
        "produits": [
          "Compte courant",
          "Carte Visa Classic",
          "Autorisation de découvert de 500 €"
        ],
        "fragile": false,
        "compte": "00566 554 9625",
        "coordonnees": {
          "mobile": "06 39 98 43 22",
          "telephone": "01 99 00 43 22",
          "email": "mickael.lecomte@example.com",
          "adresse": "64 boulevard de Magenta, 75010 Paris"
        },
        "professionnel": "Fin de contrat, allocations pas encore versées"
      },
      "note": null,
      "compte": {
        "solde": -1960,
        "autorisation": 500,
        "debutJours": 60,
        "frais": 180.1,
        "origine": "High-Tech Store"
      },
      "ressources": {
        "revenuDomicilie": false,
        "salaire": null,
        "epargne": [],
        "credits": [],
        "notes": []
      },
      "releve": [
        {
          "j": 85,
          "lib": "Boulangerie Les Délices – Paris 14e",
          "m": -14.5,
          "solde": 786.13,
          "type": "carte",
          "debut": false
        },
        {
          "j": 79,
          "lib": "TELCOM+ – forfait mobile",
          "m": -59.63,
          "solde": 726.5,
          "type": "prelevement",
          "mandat": "TC-25551",
          "debut": false
        },
        {
          "j": 73,
          "lib": "Boulangerie Les Délices – Paris 14e",
          "m": -71.5,
          "solde": 655,
          "type": "carte",
          "debut": false
        },
        {
          "j": 72,
          "lib": "Agence du Faubourg – loyer",
          "m": -555,
          "solde": 100,
          "type": "prelevement",
          "mandat": "AF-41663",
          "debut": false
        },
        {
          "j": 61,
          "lib": "Parking du Centre-ville – Paris 14e",
          "m": -24,
          "solde": 76,
          "type": "carte",
          "debut": false
        },
        {
          "j": 60,
          "lib": "High-Tech Store",
          "m": -606,
          "solde": -530,
          "type": "carte",
          "debut": true
        },
        {
          "j": 59,
          "lib": "Hypermarché Grand Marché – Paris 14e",
          "m": -202.25,
          "solde": -732.25,
          "type": "carte",
          "debut": false
        },
        {
          "j": 59,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -740.25,
          "type": "frais",
          "debut": false
        },
        {
          "j": 58,
          "lib": "Prélèvement rejeté (provision insuffisante) – Énergie Citoyenne – électricité",
          "m": 0,
          "solde": -740.25,
          "type": "rejet",
          "mandat": "EC-64437",
          "montantRejete": 126.39,
          "debut": false
        },
        {
          "j": 58,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -760.25,
          "type": "frais",
          "debut": false
        },
        {
          "j": 55,
          "lib": "Primeur & Cie – Paris 14e",
          "m": -231.38,
          "solde": -991.63,
          "type": "carte",
          "debut": false
        },
        {
          "j": 49,
          "lib": "Prélèvement rejeté (provision insuffisante) – TELCOM+ – forfait mobile",
          "m": 0,
          "solde": -991.63,
          "type": "rejet",
          "mandat": "TC-25551",
          "montantRejete": 59.63,
          "debut": false
        },
        {
          "j": 49,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -1011.63,
          "type": "frais",
          "debut": false
        },
        {
          "j": 42,
          "lib": "Prélèvement rejeté (provision insuffisante) – Agence du Faubourg – loyer",
          "m": 0,
          "solde": -1011.63,
          "type": "rejet",
          "mandat": "AF-41663",
          "montantRejete": 555,
          "debut": false
        },
        {
          "j": 42,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -1031.63,
          "type": "frais",
          "debut": false
        },
        {
          "j": 32,
          "lib": "Intérêts débiteurs (agios)",
          "m": -18.05,
          "solde": -1049.68,
          "type": "frais",
          "debut": false
        },
        {
          "j": 29,
          "lib": "Retrait DAB",
          "m": -214.73,
          "solde": -1264.41,
          "type": "carte",
          "debut": false
        },
        {
          "j": 29,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -1272.41,
          "type": "frais",
          "debut": false
        },
        {
          "j": 28,
          "lib": "Prélèvement rejeté (provision insuffisante) – Énergie Citoyenne – électricité",
          "m": 0,
          "solde": -1272.41,
          "type": "rejet",
          "mandat": "EC-64437",
          "montantRejete": 126.39,
          "debut": false
        },
        {
          "j": 28,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -1292.41,
          "type": "frais",
          "debut": false
        },
        {
          "j": 26,
          "lib": "Jardinerie du Parc – Paris 14e",
          "m": -176.74,
          "solde": -1469.15,
          "type": "carte",
          "debut": false
        },
        {
          "j": 19,
          "lib": "Prélèvement rejeté (provision insuffisante) – TELCOM+ – forfait mobile",
          "m": 0,
          "solde": -1469.15,
          "type": "rejet",
          "mandat": "TC-25551",
          "montantRejete": 59.63,
          "debut": false
        },
        {
          "j": 19,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -1489.15,
          "type": "frais",
          "debut": false
        },
        {
          "j": 19,
          "lib": "Station Relais Nord – carburant",
          "m": -166.05,
          "solde": -1655.2,
          "type": "carte",
          "debut": false
        },
        {
          "j": 19,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -1663.2,
          "type": "frais",
          "debut": false
        },
        {
          "j": 12,
          "lib": "Prélèvement rejeté (provision insuffisante) – Agence du Faubourg – loyer",
          "m": 0,
          "solde": -1663.2,
          "type": "rejet",
          "mandat": "AF-41663",
          "montantRejete": 555,
          "debut": false
        },
        {
          "j": 12,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -1683.2,
          "type": "frais",
          "debut": false
        },
        {
          "j": 4,
          "lib": "Hypermarché Grand Marché – Paris 14e",
          "m": -124.55,
          "solde": -1807.75,
          "type": "carte",
          "debut": false
        },
        {
          "j": 2,
          "lib": "Intérêts débiteurs (agios)",
          "m": -18.05,
          "solde": -1825.8,
          "type": "frais",
          "debut": false
        },
        {
          "j": 1,
          "lib": "Supermarché Frais & Co – Paris 14e",
          "m": -134.2,
          "solde": -1960,
          "type": "carte",
          "debut": false
        }
      ],
      "historique": [
        {
          "j": 30,
          "canal": "Courrier",
          "texte": "Information écrite sur le dépassement envoyée au client (courrier simple)."
        },
        {
          "j": 15,
          "canal": "Appel",
          "texte": "Appel – client joint : perte de revenus, aucune solution à court terme."
        },
        {
          "j": 3,
          "canal": "Système",
          "texte": "SMS automatique d'alerte « compte débiteur » envoyé au client"
        }
      ],
      "services": [
        {
          "id": "carte",
          "libelle": "Carte Visa Classic"
        },
        {
          "id": "chequier",
          "libelle": "Chéquier"
        },
        {
          "id": "bad",
          "libelle": "Banque à distance (application et site internet)"
        },
        {
          "id": "decouvert",
          "libelle": "Autorisation de découvert de 500 €"
        }
      ],
      "prelevements": [
        {
          "id": "p1",
          "libelle": "Énergie Citoyenne – électricité (mandat EC-64437)",
          "montant": 126.39
        },
        {
          "id": "p2",
          "libelle": "TELCOM+ – forfait mobile (mandat TC-25551)",
          "montant": 59.63
        },
        {
          "id": "p3",
          "libelle": "Agence du Faubourg – loyer (mandat AF-41663)",
          "montant": 555
        }
      ],
      "contact": {
        "canaux": [
          "mobile",
          "sms",
          "email",
          "agence",
          "fixe"
        ],
        "echange": [
          "Vous : « Bonjour M. Lecomte, votre compte présente un solde débiteur de 1 960 € depuis 60 jours. Pouvons-nous trouver ensemble une solution pour le régulariser ? »",
          "M. Lecomte : « Mon contrat s'est terminé et mes allocations ne sont pas encore versées. Je n'ai aucune rentrée avant plusieurs semaines. »",
          "Vous : « Je comprends. Je note que vous n'avez pas de rentrée prévue à court terme. »"
        ],
        "maj": [
          {
            "rubrique": "Situation professionnelle",
            "texte": "Fin de contrat, allocations pas encore versées"
          },
          {
            "rubrique": "Ressources",
            "texte": "Aucune rentrée régulière actuellement ; charges fixes d'environ 1 430 € par mois"
          }
        ]
      },
      "regularisation": {
        "plan": false,
        "reels": {},
        "sociaux": [
          "accompagnement",
          "surendettement"
        ]
      },
      "attendu": {
        "decision": "cloturer",
        "courrier": "j60_preavis"
      },
      "retenir": [
        "À J60, la clôture devient possible : la banque dénonce la convention de compte avec un préavis de deux mois. Un client fragile se traite d'abord par l'accompagnement.",
        "Sans solution financière, on enregistre « aucun moyen » ou une démarche d'accompagnement, jamais une ressource inventée."
      ],
      "id": 11
    },
    {
      "scenario": "injoignable",
      "palier": 60,
      "objectif": "Client injoignable : plusieurs canaux, dont le courrier, avant de décider.",
      "client": {
        "civilite": "Mme",
        "prenom": "Laëtitia",
        "nom": "GRECO",
        "age": 52,
        "profession": "Agente d'accueil (CDI)",
        "situation": "Mariée, 2 enfants",
        "ancienneteAns": 14,
        "revenus": 1750,
        "revenusNote": "revenus non domiciliés (aucun versement régulier sur ce compte)",
        "produits": [
          "Compte courant",
          "Carte Visa Classic",
          "Autorisation de découvert de 300 €"
        ],
        "fragile": false,
        "compte": "00969 348 8898",
        "coordonnees": {
          "mobile": "06 39 98 92 34",
          "telephone": "01 99 00 92 34",
          "email": "laetitia.greco@example.com",
          "adresse": "30 rue Oberkampf, 75011 Paris"
        }
      },
      "note": null,
      "compte": {
        "solde": -2130,
        "autorisation": 300,
        "debutJours": 60,
        "frais": 229.42,
        "origine": "Électroménager Plus"
      },
      "ressources": {
        "revenuDomicilie": false,
        "salaire": null,
        "epargne": [],
        "credits": [],
        "notes": []
      },
      "releve": [
        {
          "j": 83,
          "lib": "Primeur & Cie – Paris 18e",
          "m": -118,
          "solde": 1154.82,
          "type": "carte",
          "debut": false
        },
        {
          "j": 81,
          "lib": "Mutuelle Santé Plus",
          "m": -42.41,
          "solde": 1112.41,
          "type": "prelevement",
          "mandat": "MS-47677",
          "debut": false
        },
        {
          "j": 74,
          "lib": "Agence du Faubourg – loyer",
          "m": -420,
          "solde": 692.41,
          "type": "prelevement",
          "mandat": "AF-19480",
          "debut": false
        },
        {
          "j": 67,
          "lib": "Association de quartier – cotisation",
          "m": -25.57,
          "solde": 666.84,
          "type": "prelevement",
          "mandat": "AQ-22519",
          "debut": false
        },
        {
          "j": 67,
          "lib": "Hyper Express – Paris 18e",
          "m": -113,
          "solde": 553.84,
          "type": "carte",
          "debut": false
        },
        {
          "j": 65,
          "lib": "Énergie Citoyenne – électricité",
          "m": -125.84,
          "solde": 428,
          "type": "prelevement",
          "mandat": "EC-69143",
          "debut": false
        },
        {
          "j": 60,
          "lib": "Électroménager Plus",
          "m": -878,
          "solde": -450,
          "type": "carte",
          "debut": true
        },
        {
          "j": 57,
          "lib": "Garage Moderne – réparation",
          "m": -320.86,
          "solde": -770.86,
          "type": "carte",
          "debut": false
        },
        {
          "j": 57,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -778.86,
          "type": "frais",
          "debut": false
        },
        {
          "j": 57,
          "lib": "Supermarché Frais & Co – Paris 18e",
          "m": -259.96,
          "solde": -1038.82,
          "type": "carte",
          "debut": false
        },
        {
          "j": 57,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -1046.82,
          "type": "frais",
          "debut": false
        },
        {
          "j": 51,
          "lib": "Prélèvement rejeté (provision insuffisante) – Mutuelle Santé Plus",
          "m": 0,
          "solde": -1046.82,
          "type": "rejet",
          "mandat": "MS-47677",
          "montantRejete": 42.41,
          "debut": false
        },
        {
          "j": 51,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -1066.82,
          "type": "frais",
          "debut": false
        },
        {
          "j": 50,
          "lib": "Primeur & Cie – Paris 18e",
          "m": -136.68,
          "solde": -1203.5,
          "type": "carte",
          "debut": false
        },
        {
          "j": 44,
          "lib": "Prélèvement rejeté (provision insuffisante) – Agence du Faubourg – loyer",
          "m": 0,
          "solde": -1203.5,
          "type": "rejet",
          "mandat": "AF-19480",
          "montantRejete": 420,
          "debut": false
        },
        {
          "j": 44,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -1223.5,
          "type": "frais",
          "debut": false
        },
        {
          "j": 44,
          "lib": "Mobilier Maison & Co",
          "m": -299,
          "solde": -1522.5,
          "type": "carte",
          "debut": false
        },
        {
          "j": 44,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -1530.5,
          "type": "frais",
          "debut": false
        },
        {
          "j": 37,
          "lib": "Prélèvement rejeté (provision insuffisante) – Association de quartier – cotisation",
          "m": 0,
          "solde": -1530.5,
          "type": "rejet",
          "mandat": "AQ-22519",
          "montantRejete": 25.57,
          "debut": false
        },
        {
          "j": 37,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -1550.5,
          "type": "frais",
          "debut": false
        },
        {
          "j": 35,
          "lib": "Prélèvement rejeté (provision insuffisante) – Énergie Citoyenne – électricité",
          "m": 0,
          "solde": -1550.5,
          "type": "rejet",
          "mandat": "EC-69143",
          "montantRejete": 125.84,
          "debut": false
        },
        {
          "j": 35,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -1570.5,
          "type": "frais",
          "debut": false
        },
        {
          "j": 34,
          "lib": "Station Relais Nord – carburant",
          "m": -148.1,
          "solde": -1718.6,
          "type": "carte",
          "debut": false
        },
        {
          "j": 34,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -1726.6,
          "type": "frais",
          "debut": false
        },
        {
          "j": 32,
          "lib": "Intérêts débiteurs (agios)",
          "m": -18.71,
          "solde": -1745.31,
          "type": "frais",
          "debut": false
        },
        {
          "j": 21,
          "lib": "Prélèvement rejeté (provision insuffisante) – Mutuelle Santé Plus",
          "m": 0,
          "solde": -1745.31,
          "type": "rejet",
          "mandat": "MS-47677",
          "montantRejete": 42.41,
          "debut": false
        },
        {
          "j": 21,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -1765.31,
          "type": "frais",
          "debut": false
        },
        {
          "j": 14,
          "lib": "Prélèvement rejeté (provision insuffisante) – Agence du Faubourg – loyer",
          "m": 0,
          "solde": -1765.31,
          "type": "rejet",
          "mandat": "AF-19480",
          "montantRejete": 420,
          "debut": false
        },
        {
          "j": 14,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -1785.31,
          "type": "frais",
          "debut": false
        },
        {
          "j": 7,
          "lib": "Prélèvement rejeté (provision insuffisante) – Association de quartier – cotisation",
          "m": 0,
          "solde": -1785.31,
          "type": "rejet",
          "mandat": "AQ-22519",
          "montantRejete": 25.57,
          "debut": false
        },
        {
          "j": 7,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -1805.31,
          "type": "frais",
          "debut": false
        },
        {
          "j": 5,
          "lib": "Prélèvement rejeté (provision insuffisante) – Énergie Citoyenne – électricité",
          "m": 0,
          "solde": -1805.31,
          "type": "rejet",
          "mandat": "EC-69143",
          "montantRejete": 125.84,
          "debut": false
        },
        {
          "j": 5,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -1825.31,
          "type": "frais",
          "debut": false
        },
        {
          "j": 5,
          "lib": "Cycles & Mobilité",
          "m": -285.98,
          "solde": -2111.29,
          "type": "carte",
          "debut": false
        },
        {
          "j": 2,
          "lib": "Intérêts débiteurs (agios)",
          "m": -18.71,
          "solde": -2130,
          "type": "frais",
          "debut": false
        }
      ],
      "historique": [
        {
          "j": 30,
          "canal": "Courrier",
          "texte": "Information écrite sur le dépassement envoyée au client (courrier simple)."
        },
        {
          "j": 15,
          "canal": "Appel",
          "texte": "Appel au mobile sans réponse, SMS laissé : pas de rappel."
        },
        {
          "j": 3,
          "canal": "Système",
          "texte": "SMS automatique d'alerte « compte débiteur » envoyé au client"
        }
      ],
      "services": [
        {
          "id": "carte",
          "libelle": "Carte Visa Classic"
        },
        {
          "id": "chequier",
          "libelle": "Chéquier"
        },
        {
          "id": "bad",
          "libelle": "Banque à distance (application et site internet)"
        },
        {
          "id": "decouvert",
          "libelle": "Autorisation de découvert de 300 €"
        }
      ],
      "prelevements": [
        {
          "id": "p1",
          "libelle": "Association de quartier – cotisation (mandat AQ-22519)",
          "montant": 25.57
        },
        {
          "id": "p2",
          "libelle": "Mutuelle Santé Plus (mandat MS-47677)",
          "montant": 42.41
        },
        {
          "id": "p3",
          "libelle": "Énergie Citoyenne – électricité (mandat EC-69143)",
          "montant": 125.84
        },
        {
          "id": "p4",
          "libelle": "Agence du Faubourg – loyer (mandat AF-19480)",
          "montant": 420
        }
      ],
      "contact": {
        "canaux": [],
        "echange": [],
        "maj": [
          {
            "rubrique": "Coordonnées",
            "texte": "Client injoignable par téléphone, SMS et e-mail à la date du jour : coordonnées à vérifier"
          }
        ]
      },
      "regularisation": {
        "plan": false,
        "reels": {},
        "sociaux": []
      },
      "attendu": {
        "decision": "cloturer",
        "courrier": "j60_preavis"
      },
      "retenir": [
        "À J60, la clôture devient possible : la banque dénonce la convention de compte avec un préavis de deux mois. Un client fragile se traite d'abord par l'accompagnement.",
        "Un client injoignable se relance par plusieurs canaux ; le courrier laisse une trace écrite."
      ],
      "id": 12
    },
    {
      "scenario": "difficultes",
      "palier": 90,
      "objectif": "Aucune ressource à court terme : pas de promesse à noter, une démarche d'accompagnement s'impose.",
      "client": {
        "civilite": "M.",
        "prenom": "Samir",
        "nom": "BIANCHI",
        "age": 38,
        "profession": "Agent d'accueil (CDI)",
        "situation": "Marié, 1 enfant",
        "ancienneteAns": 18,
        "revenus": 1500,
        "revenusNote": "revenus interrompus, aucun versement régulier sur ce compte",
        "produits": [
          "Compte courant",
          "Carte Visa Classic"
        ],
        "fragile": false,
        "compte": "00840 143 3379",
        "coordonnees": {
          "mobile": "06 39 98 47 71",
          "telephone": "01 99 00 47 71",
          "email": "samir.bianchi@example.com",
          "adresse": "18 avenue Daumesnil, 75012 Paris"
        },
        "professionnel": "Sans emploi, droits au chômage en cours d'étude, aucun versement depuis deux mois"
      },
      "note": null,
      "compte": {
        "solde": -3180,
        "autorisation": 0,
        "debutJours": 90,
        "frais": 298.05,
        "origine": "Électroménager Plus"
      },
      "ressources": {
        "revenuDomicilie": false,
        "salaire": null,
        "epargne": [],
        "credits": [],
        "notes": []
      },
      "releve": [
        {
          "j": 113,
          "lib": "Électricité Verte – facture",
          "m": -117.01,
          "solde": 1009.31,
          "type": "prelevement",
          "mandat": "EV-42091",
          "debut": false
        },
        {
          "j": 113,
          "lib": "Presse & Tabac du Coin – Paris 19e",
          "m": -15,
          "solde": 994.31,
          "type": "carte",
          "debut": false
        },
        {
          "j": 110,
          "lib": "Fibra – box internet",
          "m": -33.31,
          "solde": 961,
          "type": "prelevement",
          "mandat": "FB-54648",
          "debut": false
        },
        {
          "j": 98,
          "lib": "Boucherie Martin & Fils – Paris 19e",
          "m": -70,
          "solde": 891,
          "type": "carte",
          "debut": false
        },
        {
          "j": 94,
          "lib": "Immobilière du Parc – loyer",
          "m": -470,
          "solde": 421,
          "type": "prelevement",
          "mandat": "IP-78144",
          "debut": false
        },
        {
          "j": 90,
          "lib": "Électroménager Plus",
          "m": -461,
          "solde": -40,
          "type": "carte",
          "debut": true
        },
        {
          "j": 83,
          "lib": "Prélèvement rejeté (provision insuffisante) – Électricité Verte – facture",
          "m": 0,
          "solde": -40,
          "type": "rejet",
          "mandat": "EV-42091",
          "montantRejete": 117.01,
          "debut": false
        },
        {
          "j": 83,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -60,
          "type": "frais",
          "debut": false
        },
        {
          "j": 80,
          "lib": "Prélèvement rejeté (provision insuffisante) – Fibra – box internet",
          "m": 0,
          "solde": -60,
          "type": "rejet",
          "mandat": "FB-54648",
          "montantRejete": 33.31,
          "debut": false
        },
        {
          "j": 80,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -80,
          "type": "frais",
          "debut": false
        },
        {
          "j": 77,
          "lib": "Bricol'Express – travaux",
          "m": -418.65,
          "solde": -498.65,
          "type": "carte",
          "debut": false
        },
        {
          "j": 76,
          "lib": "Centre Auto Pneus",
          "m": -380.82,
          "solde": -879.47,
          "type": "carte",
          "debut": false
        },
        {
          "j": 64,
          "lib": "Prélèvement rejeté (provision insuffisante) – Immobilière du Parc – loyer",
          "m": 0,
          "solde": -879.47,
          "type": "rejet",
          "mandat": "IP-78144",
          "montantRejete": 470,
          "debut": false
        },
        {
          "j": 64,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -899.47,
          "type": "frais",
          "debut": false
        },
        {
          "j": 62,
          "lib": "Intérêts débiteurs (agios)",
          "m": -23.35,
          "solde": -922.82,
          "type": "frais",
          "debut": false
        },
        {
          "j": 61,
          "lib": "Garage Moderne – réparation",
          "m": -401.85,
          "solde": -1324.67,
          "type": "carte",
          "debut": false
        },
        {
          "j": 61,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -1332.67,
          "type": "frais",
          "debut": false
        },
        {
          "j": 57,
          "lib": "Garage Moderne – réparation",
          "m": -280.99,
          "solde": -1613.66,
          "type": "carte",
          "debut": false
        },
        {
          "j": 57,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -1621.66,
          "type": "frais",
          "debut": false
        },
        {
          "j": 53,
          "lib": "Prélèvement rejeté (provision insuffisante) – Électricité Verte – facture",
          "m": 0,
          "solde": -1621.66,
          "type": "rejet",
          "mandat": "EV-42091",
          "montantRejete": 117.01,
          "debut": false
        },
        {
          "j": 53,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -1641.66,
          "type": "frais",
          "debut": false
        },
        {
          "j": 50,
          "lib": "Prélèvement rejeté (provision insuffisante) – Fibra – box internet",
          "m": 0,
          "solde": -1641.66,
          "type": "rejet",
          "mandat": "FB-54648",
          "montantRejete": 33.31,
          "debut": false
        },
        {
          "j": 50,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -1661.66,
          "type": "frais",
          "debut": false
        },
        {
          "j": 34,
          "lib": "Prélèvement rejeté (provision insuffisante) – Immobilière du Parc – loyer",
          "m": 0,
          "solde": -1661.66,
          "type": "rejet",
          "mandat": "IP-78144",
          "montantRejete": 470,
          "debut": false
        },
        {
          "j": 34,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -1681.66,
          "type": "frais",
          "debut": false
        },
        {
          "j": 32,
          "lib": "Intérêts débiteurs (agios)",
          "m": -23.35,
          "solde": -1705.01,
          "type": "frais",
          "debut": false
        },
        {
          "j": 23,
          "lib": "Prélèvement rejeté (provision insuffisante) – Électricité Verte – facture",
          "m": 0,
          "solde": -1705.01,
          "type": "rejet",
          "mandat": "EV-42091",
          "montantRejete": 117.01,
          "debut": false
        },
        {
          "j": 23,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -1725.01,
          "type": "frais",
          "debut": false
        },
        {
          "j": 21,
          "lib": "Cycles & Mobilité",
          "m": -396.71,
          "solde": -2121.72,
          "type": "carte",
          "debut": false
        },
        {
          "j": 21,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -2129.72,
          "type": "frais",
          "debut": false
        },
        {
          "j": 20,
          "lib": "Prélèvement rejeté (provision insuffisante) – Fibra – box internet",
          "m": 0,
          "solde": -2129.72,
          "type": "rejet",
          "mandat": "FB-54648",
          "montantRejete": 33.31,
          "debut": false
        },
        {
          "j": 20,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -2149.72,
          "type": "frais",
          "debut": false
        },
        {
          "j": 18,
          "lib": "Voyages Horizon – séjour",
          "m": -415.42,
          "solde": -2565.14,
          "type": "carte",
          "debut": false
        },
        {
          "j": 18,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -2573.14,
          "type": "frais",
          "debut": false
        },
        {
          "j": 4,
          "lib": "Prélèvement rejeté (provision insuffisante) – Immobilière du Parc – loyer",
          "m": 0,
          "solde": -2573.14,
          "type": "rejet",
          "mandat": "IP-78144",
          "montantRejete": 470,
          "debut": false
        },
        {
          "j": 4,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -2593.14,
          "type": "frais",
          "debut": false
        },
        {
          "j": 4,
          "lib": "Supermarché Marché Plus – Paris 19e",
          "m": -209.83,
          "solde": -2802.97,
          "type": "carte",
          "debut": false
        },
        {
          "j": 4,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -2810.97,
          "type": "frais",
          "debut": false
        },
        {
          "j": 2,
          "lib": "Intérêts débiteurs (agios)",
          "m": -23.35,
          "solde": -2834.32,
          "type": "frais",
          "debut": false
        },
        {
          "j": 2,
          "lib": "Retrait DAB",
          "m": -337.68,
          "solde": -3172,
          "type": "carte",
          "debut": false
        },
        {
          "j": 2,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -3180,
          "type": "frais",
          "debut": false
        }
      ],
      "historique": [
        {
          "j": 60,
          "canal": "Lettre recommandée",
          "texte": "Dénonciation de la convention de compte envoyée (préavis de 60 jours).",
          "preavis": true
        },
        {
          "j": 30,
          "canal": "Courrier",
          "texte": "Information écrite sur le dépassement envoyée au client (courrier simple)."
        },
        {
          "j": 15,
          "canal": "Appel",
          "texte": "Appel – client joint : perte de revenus, aucune solution à court terme."
        },
        {
          "j": 3,
          "canal": "Système",
          "texte": "SMS automatique d'alerte « compte débiteur » envoyé au client"
        }
      ],
      "services": [
        {
          "id": "carte",
          "libelle": "Carte Visa Classic"
        },
        {
          "id": "chequier",
          "libelle": "Chéquier"
        },
        {
          "id": "bad",
          "libelle": "Banque à distance (application et site internet)"
        }
      ],
      "prelevements": [
        {
          "id": "p1",
          "libelle": "Immobilière du Parc – loyer (mandat IP-78144)",
          "montant": 470
        },
        {
          "id": "p2",
          "libelle": "Électricité Verte – facture (mandat EV-42091)",
          "montant": 117.01
        },
        {
          "id": "p3",
          "libelle": "Fibra – box internet (mandat FB-54648)",
          "montant": 33.31
        }
      ],
      "contact": {
        "canaux": [
          "mobile",
          "sms",
          "email",
          "agence",
          "fixe"
        ],
        "echange": [
          "Vous : « Bonjour M. Bianchi, votre compte présente un solde débiteur de 3 180 € depuis 90 jours. Pouvons-nous trouver ensemble une solution pour le régulariser ? »",
          "M. Bianchi : « J'ai perdu mon emploi à la fin de ma période d'essai. Mes droits au chômage sont en cours d'étude : je n'ai rien reçu depuis deux mois. »",
          "Vous : « Je comprends. Je note que vous n'avez pas de rentrée prévue à court terme. »",
          "M. Bianchi : « Ma famille peut peut-être m'avancer 790 € la semaine prochaine, mais pas plus. »"
        ],
        "maj": [
          {
            "rubrique": "Situation professionnelle",
            "texte": "Sans emploi, droits au chômage en cours d'étude, aucun versement depuis deux mois"
          },
          {
            "rubrique": "Ressources",
            "texte": "Aucune rentrée régulière actuellement ; charges fixes d'environ 1 450 € par mois"
          },
          {
            "rubrique": "Aide d'un proche",
            "texte": "Avance possible de 790 € dans la semaine"
          }
        ]
      },
      "regularisation": {
        "plan": false,
        "reels": {
          "aide_proche": {
            "montant": 790,
            "delai": 7
          }
        },
        "sociaux": [
          "accompagnement",
          "surendettement"
        ]
      },
      "attendu": {
        "decision": "sra",
        "courrier": "j90_sra"
      },
      "retenir": [
        "À J90, on clôture les services, on s'oppose aux prélèvements et on envoie le compte au service de recouvrement amiable.",
        "Sans solution financière, on enregistre « aucun moyen » ou une démarche d'accompagnement, jamais une ressource inventée."
      ],
      "id": 13
    },
    {
      "scenario": "injoignable",
      "palier": 90,
      "objectif": "Client injoignable : plusieurs canaux, dont le courrier, avant de décider.",
      "client": {
        "civilite": "M.",
        "prenom": "Samir",
        "nom": "BERTHELOT",
        "age": 44,
        "profession": "Cuisinier (CDI)",
        "situation": "Divorcé, 1 enfant",
        "ancienneteAns": 14,
        "revenus": 2070,
        "revenusNote": "revenus non domiciliés (aucun versement régulier sur ce compte)",
        "produits": [
          "Compte courant",
          "Carte Visa Classic"
        ],
        "fragile": false,
        "compte": "00793 600 9018",
        "coordonnees": {
          "mobile": "06 39 98 29 18",
          "telephone": "01 99 00 29 18",
          "email": "samir.berthelot@example.com",
          "adresse": "30 rue des Pyrénées, 75020 Paris"
        }
      },
      "note": null,
      "compte": {
        "solde": -1510,
        "autorisation": 0,
        "debutJours": 90,
        "frais": 231.88,
        "origine": "Mobilier Maison & Co"
      },
      "ressources": {
        "revenuDomicilie": false,
        "salaire": null,
        "epargne": [],
        "credits": [],
        "notes": []
      },
      "releve": [
        {
          "j": 115,
          "lib": "Librairie Le Passage – Paris 16e",
          "m": -30,
          "solde": 436.15,
          "type": "carte",
          "debut": false
        },
        {
          "j": 113,
          "lib": "Mutuelle Santé Plus",
          "m": -85.99,
          "solde": 350.16,
          "type": "prelevement",
          "mandat": "MS-71588",
          "debut": false
        },
        {
          "j": 112,
          "lib": "Boulangerie Les Délices – Paris 16e",
          "m": -86,
          "solde": 264.16,
          "type": "carte",
          "debut": false
        },
        {
          "j": 110,
          "lib": "Opérateur mobile",
          "m": -28.03,
          "solde": 236.13,
          "type": "prelevement",
          "mandat": "OM-65023",
          "debut": false
        },
        {
          "j": 108,
          "lib": "Gaz de Ville – facture",
          "m": -57.13,
          "solde": 179,
          "type": "prelevement",
          "mandat": "GV-58338",
          "debut": false
        },
        {
          "j": 90,
          "lib": "Mobilier Maison & Co",
          "m": -319,
          "solde": -140,
          "type": "carte",
          "debut": true
        },
        {
          "j": 83,
          "lib": "Prélèvement rejeté (provision insuffisante) – Mutuelle Santé Plus",
          "m": 0,
          "solde": -140,
          "type": "rejet",
          "mandat": "MS-71588",
          "montantRejete": 85.99,
          "debut": false
        },
        {
          "j": 83,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -160,
          "type": "frais",
          "debut": false
        },
        {
          "j": 80,
          "lib": "Prélèvement rejeté (provision insuffisante) – Opérateur mobile",
          "m": 0,
          "solde": -160,
          "type": "rejet",
          "mandat": "OM-65023",
          "montantRejete": 28.03,
          "debut": false
        },
        {
          "j": 80,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -180,
          "type": "frais",
          "debut": false
        },
        {
          "j": 78,
          "lib": "Prélèvement rejeté (provision insuffisante) – Gaz de Ville – facture",
          "m": 0,
          "solde": -180,
          "type": "rejet",
          "mandat": "GV-58338",
          "montantRejete": 57.13,
          "debut": false
        },
        {
          "j": 78,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -200,
          "type": "frais",
          "debut": false
        },
        {
          "j": 78,
          "lib": "Boutique Mode & Co – Paris 16e",
          "m": -176.83,
          "solde": -376.83,
          "type": "carte",
          "debut": false
        },
        {
          "j": 78,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -384.83,
          "type": "frais",
          "debut": false
        },
        {
          "j": 78,
          "lib": "Hyper Express – Paris 16e",
          "m": -112.32,
          "solde": -497.15,
          "type": "carte",
          "debut": false
        },
        {
          "j": 78,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -505.15,
          "type": "frais",
          "debut": false
        },
        {
          "j": 62,
          "lib": "Intérêts débiteurs (agios)",
          "m": -11.96,
          "solde": -517.11,
          "type": "frais",
          "debut": false
        },
        {
          "j": 59,
          "lib": "Retrait DAB",
          "m": -175.32,
          "solde": -692.43,
          "type": "carte",
          "debut": false
        },
        {
          "j": 53,
          "lib": "Prélèvement rejeté (provision insuffisante) – Mutuelle Santé Plus",
          "m": 0,
          "solde": -692.43,
          "type": "rejet",
          "mandat": "MS-71588",
          "montantRejete": 85.99,
          "debut": false
        },
        {
          "j": 53,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -712.43,
          "type": "frais",
          "debut": false
        },
        {
          "j": 52,
          "lib": "Station Relais Est – carburant",
          "m": -103,
          "solde": -815.43,
          "type": "carte",
          "debut": false
        },
        {
          "j": 50,
          "lib": "Prélèvement rejeté (provision insuffisante) – Opérateur mobile",
          "m": 0,
          "solde": -815.43,
          "type": "rejet",
          "mandat": "OM-65023",
          "montantRejete": 28.03,
          "debut": false
        },
        {
          "j": 50,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -835.43,
          "type": "frais",
          "debut": false
        },
        {
          "j": 49,
          "lib": "Supermarché Frais & Co – Paris 16e",
          "m": -165.4,
          "solde": -1000.83,
          "type": "carte",
          "debut": false
        },
        {
          "j": 48,
          "lib": "Prélèvement rejeté (provision insuffisante) – Gaz de Ville – facture",
          "m": 0,
          "solde": -1000.83,
          "type": "rejet",
          "mandat": "GV-58338",
          "montantRejete": 57.13,
          "debut": false
        },
        {
          "j": 48,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -1020.83,
          "type": "frais",
          "debut": false
        },
        {
          "j": 32,
          "lib": "Intérêts débiteurs (agios)",
          "m": -11.96,
          "solde": -1032.79,
          "type": "frais",
          "debut": false
        },
        {
          "j": 23,
          "lib": "Prélèvement rejeté (provision insuffisante) – Mutuelle Santé Plus",
          "m": 0,
          "solde": -1032.79,
          "type": "rejet",
          "mandat": "MS-71588",
          "montantRejete": 85.99,
          "debut": false
        },
        {
          "j": 23,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -1052.79,
          "type": "frais",
          "debut": false
        },
        {
          "j": 20,
          "lib": "Prélèvement rejeté (provision insuffisante) – Opérateur mobile",
          "m": 0,
          "solde": -1052.79,
          "type": "rejet",
          "mandat": "OM-65023",
          "montantRejete": 28.03,
          "debut": false
        },
        {
          "j": 20,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -1072.79,
          "type": "frais",
          "debut": false
        },
        {
          "j": 18,
          "lib": "Prélèvement rejeté (provision insuffisante) – Gaz de Ville – facture",
          "m": 0,
          "solde": -1072.79,
          "type": "rejet",
          "mandat": "GV-58338",
          "montantRejete": 57.13,
          "debut": false
        },
        {
          "j": 18,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -1092.79,
          "type": "frais",
          "debut": false
        },
        {
          "j": 18,
          "lib": "Retrait DAB",
          "m": -163.76,
          "solde": -1256.55,
          "type": "carte",
          "debut": false
        },
        {
          "j": 14,
          "lib": "Hypermarché Grand Marché – Paris 16e",
          "m": -186.8,
          "solde": -1443.35,
          "type": "carte",
          "debut": false
        },
        {
          "j": 13,
          "lib": "Librairie Le Passage – Paris 16e",
          "m": -54.69,
          "solde": -1498.04,
          "type": "carte",
          "debut": false
        },
        {
          "j": 2,
          "lib": "Intérêts débiteurs (agios)",
          "m": -11.96,
          "solde": -1510,
          "type": "frais",
          "debut": false
        }
      ],
      "historique": [
        {
          "j": 60,
          "canal": "Lettre recommandée",
          "texte": "Dénonciation de la convention de compte envoyée (préavis de 60 jours).",
          "preavis": true
        },
        {
          "j": 30,
          "canal": "Courrier",
          "texte": "Information écrite sur le dépassement envoyée au client (courrier simple)."
        },
        {
          "j": 15,
          "canal": "Appel",
          "texte": "Appel au mobile sans réponse, SMS laissé : pas de rappel."
        },
        {
          "j": 3,
          "canal": "Système",
          "texte": "SMS automatique d'alerte « compte débiteur » envoyé au client"
        }
      ],
      "services": [
        {
          "id": "carte",
          "libelle": "Carte Visa Classic"
        },
        {
          "id": "chequier",
          "libelle": "Chéquier"
        },
        {
          "id": "bad",
          "libelle": "Banque à distance (application et site internet)"
        }
      ],
      "prelevements": [
        {
          "id": "p1",
          "libelle": "Gaz de Ville – facture (mandat GV-58338)",
          "montant": 57.13
        },
        {
          "id": "p2",
          "libelle": "Opérateur mobile (mandat OM-65023)",
          "montant": 28.03
        },
        {
          "id": "p3",
          "libelle": "Mutuelle Santé Plus (mandat MS-71588)",
          "montant": 85.99
        }
      ],
      "contact": {
        "canaux": [],
        "echange": [],
        "maj": [
          {
            "rubrique": "Coordonnées",
            "texte": "Client injoignable par téléphone, SMS et e-mail à la date du jour : coordonnées à vérifier"
          }
        ]
      },
      "regularisation": {
        "plan": false,
        "reels": {},
        "sociaux": []
      },
      "attendu": {
        "decision": "sra",
        "courrier": "j90_sra"
      },
      "retenir": [
        "À J90, on clôture les services, on s'oppose aux prélèvements et on envoie le compte au service de recouvrement amiable.",
        "Un client injoignable se relance par plusieurs canaux ; le courrier laisse une trace écrite."
      ],
      "id": 14
    },
    {
      "scenario": "refus",
      "palier": 90,
      "objectif": "Un client qui refuse de régulariser : constat, courrier et suite de la procédure.",
      "client": {
        "civilite": "Mme",
        "prenom": "Laëtitia",
        "nom": "BAUDOUIN",
        "age": 41,
        "profession": "Aide à domicile (temps partiel)",
        "situation": "Divorcée, 1 enfant",
        "ancienneteAns": 16,
        "revenus": 1260,
        "revenusNote": "revenus non domiciliés (aucun versement régulier sur ce compte)",
        "produits": [
          "Compte courant",
          "Carte Visa Classic",
          "Autorisation de découvert de 400 €"
        ],
        "fragile": false,
        "compte": "00330 978 0741",
        "coordonnees": {
          "mobile": "06 39 98 52 72",
          "telephone": "01 99 00 52 72",
          "email": "laetitia.baudouin@example.com",
          "adresse": "58 rue Daguerre, 75014 Paris"
        }
      },
      "note": null,
      "compte": {
        "solde": -3430,
        "autorisation": 400,
        "debutJours": 90,
        "frais": 289.71,
        "origine": "Bijouterie du Centre"
      },
      "ressources": {
        "revenuDomicilie": false,
        "salaire": null,
        "epargne": [],
        "credits": [],
        "notes": []
      },
      "releve": [
        {
          "j": 110,
          "lib": "Gestion Locative Nation – loyer",
          "m": -480,
          "solde": 353,
          "type": "prelevement",
          "mandat": "GN-82187",
          "debut": false
        },
        {
          "j": 109,
          "lib": "Pâtisserie du Marché – Paris 6e",
          "m": -26,
          "solde": 327,
          "type": "carte",
          "debut": false
        },
        {
          "j": 104,
          "lib": "Salle de sport Énergie – abonnement",
          "m": -32.22,
          "solde": 294.78,
          "type": "prelevement",
          "mandat": "SE-83227",
          "debut": false
        },
        {
          "j": 103,
          "lib": "Brasserie du Coin – Paris 6e",
          "m": -107.5,
          "solde": 187.28,
          "type": "carte",
          "debut": false
        },
        {
          "j": 95,
          "lib": "TELCOM+ – forfait mobile",
          "m": -26.28,
          "solde": 161,
          "type": "prelevement",
          "mandat": "TC-72824",
          "debut": false
        },
        {
          "j": 90,
          "lib": "Bijouterie du Centre",
          "m": -671,
          "solde": -510,
          "type": "carte",
          "debut": true
        },
        {
          "j": 80,
          "lib": "Prélèvement rejeté (provision insuffisante) – Gestion Locative Nation – loyer",
          "m": 0,
          "solde": -510,
          "type": "rejet",
          "mandat": "GN-82187",
          "montantRejete": 480,
          "debut": false
        },
        {
          "j": 80,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -530,
          "type": "frais",
          "debut": false
        },
        {
          "j": 74,
          "lib": "Prélèvement rejeté (provision insuffisante) – Salle de sport Énergie – abonnement",
          "m": 0,
          "solde": -530,
          "type": "rejet",
          "mandat": "SE-83227",
          "montantRejete": 32.22,
          "debut": false
        },
        {
          "j": 74,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -550,
          "type": "frais",
          "debut": false
        },
        {
          "j": 73,
          "lib": "Supermarché Marché Plus – Paris 6e",
          "m": -172.27,
          "solde": -722.27,
          "type": "carte",
          "debut": false
        },
        {
          "j": 65,
          "lib": "Prélèvement rejeté (provision insuffisante) – TELCOM+ – forfait mobile",
          "m": 0,
          "solde": -722.27,
          "type": "rejet",
          "mandat": "TC-72824",
          "montantRejete": 26.28,
          "debut": false
        },
        {
          "j": 65,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -742.27,
          "type": "frais",
          "debut": false
        },
        {
          "j": 62,
          "lib": "Intérêts débiteurs (agios)",
          "m": -28.57,
          "solde": -770.84,
          "type": "frais",
          "debut": false
        },
        {
          "j": 55,
          "lib": "Cycles & Mobilité",
          "m": -404.56,
          "solde": -1175.4,
          "type": "carte",
          "debut": false
        },
        {
          "j": 50,
          "lib": "Prélèvement rejeté (provision insuffisante) – Gestion Locative Nation – loyer",
          "m": 0,
          "solde": -1175.4,
          "type": "rejet",
          "mandat": "GN-82187",
          "montantRejete": 480,
          "debut": false
        },
        {
          "j": 50,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -1195.4,
          "type": "frais",
          "debut": false
        },
        {
          "j": 44,
          "lib": "Prélèvement rejeté (provision insuffisante) – Salle de sport Énergie – abonnement",
          "m": 0,
          "solde": -1195.4,
          "type": "rejet",
          "mandat": "SE-83227",
          "montantRejete": 32.22,
          "debut": false
        },
        {
          "j": 44,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -1215.4,
          "type": "frais",
          "debut": false
        },
        {
          "j": 35,
          "lib": "Prélèvement rejeté (provision insuffisante) – TELCOM+ – forfait mobile",
          "m": 0,
          "solde": -1215.4,
          "type": "rejet",
          "mandat": "TC-72824",
          "montantRejete": 26.28,
          "debut": false
        },
        {
          "j": 35,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -1235.4,
          "type": "frais",
          "debut": false
        },
        {
          "j": 32,
          "lib": "Intérêts débiteurs (agios)",
          "m": -28.57,
          "solde": -1263.97,
          "type": "frais",
          "debut": false
        },
        {
          "j": 26,
          "lib": "Bijouterie du Centre",
          "m": -361.7,
          "solde": -1625.67,
          "type": "carte",
          "debut": false
        },
        {
          "j": 20,
          "lib": "Prélèvement rejeté (provision insuffisante) – Gestion Locative Nation – loyer",
          "m": 0,
          "solde": -1625.67,
          "type": "rejet",
          "mandat": "GN-82187",
          "montantRejete": 480,
          "debut": false
        },
        {
          "j": 20,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -1645.67,
          "type": "frais",
          "debut": false
        },
        {
          "j": 20,
          "lib": "Retrait DAB",
          "m": -313.54,
          "solde": -1959.21,
          "type": "carte",
          "debut": false
        },
        {
          "j": 20,
          "lib": "Voyages Horizon – séjour",
          "m": -320.05,
          "solde": -2279.26,
          "type": "carte",
          "debut": false
        },
        {
          "j": 20,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -2287.26,
          "type": "frais",
          "debut": false
        },
        {
          "j": 14,
          "lib": "Prélèvement rejeté (provision insuffisante) – Salle de sport Énergie – abonnement",
          "m": 0,
          "solde": -2287.26,
          "type": "rejet",
          "mandat": "SE-83227",
          "montantRejete": 32.22,
          "debut": false
        },
        {
          "j": 14,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -2307.26,
          "type": "frais",
          "debut": false
        },
        {
          "j": 6,
          "lib": "Bricol'Express – travaux",
          "m": -404.86,
          "solde": -2712.12,
          "type": "carte",
          "debut": false
        },
        {
          "j": 6,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -2720.12,
          "type": "frais",
          "debut": false
        },
        {
          "j": 5,
          "lib": "Prélèvement rejeté (provision insuffisante) – TELCOM+ – forfait mobile",
          "m": 0,
          "solde": -2720.12,
          "type": "rejet",
          "mandat": "TC-72824",
          "montantRejete": 26.28,
          "debut": false
        },
        {
          "j": 5,
          "lib": "Frais de rejet de prélèvement",
          "m": -20,
          "solde": -2740.12,
          "type": "frais",
          "debut": false
        },
        {
          "j": 4,
          "lib": "Voyages Horizon – séjour",
          "m": -341.72,
          "solde": -3081.84,
          "type": "carte",
          "debut": false
        },
        {
          "j": 2,
          "lib": "Intérêts débiteurs (agios)",
          "m": -28.57,
          "solde": -3110.41,
          "type": "frais",
          "debut": false
        },
        {
          "j": 2,
          "lib": "High-Tech Store",
          "m": -311.59,
          "solde": -3422,
          "type": "carte",
          "debut": false
        },
        {
          "j": 2,
          "lib": "Commission d'intervention",
          "m": -8,
          "solde": -3430,
          "type": "frais",
          "debut": false
        }
      ],
      "historique": [
        {
          "j": 60,
          "canal": "Lettre recommandée",
          "texte": "Dénonciation de la convention de compte envoyée (préavis de 60 jours).",
          "preavis": true
        },
        {
          "j": 30,
          "canal": "Courrier",
          "texte": "Information écrite sur le dépassement envoyée au client (courrier simple)."
        },
        {
          "j": 15,
          "canal": "Appel",
          "texte": "Appel – client joint : refuse de régulariser."
        },
        {
          "j": 3,
          "canal": "Système",
          "texte": "SMS automatique d'alerte « compte débiteur » envoyé au client"
        }
      ],
      "services": [
        {
          "id": "carte",
          "libelle": "Carte Visa Classic"
        },
        {
          "id": "chequier",
          "libelle": "Chéquier"
        },
        {
          "id": "bad",
          "libelle": "Banque à distance (application et site internet)"
        },
        {
          "id": "decouvert",
          "libelle": "Autorisation de découvert de 400 €"
        }
      ],
      "prelevements": [
        {
          "id": "p1",
          "libelle": "TELCOM+ – forfait mobile (mandat TC-72824)",
          "montant": 26.28
        },
        {
          "id": "p2",
          "libelle": "Salle de sport Énergie – abonnement (mandat SE-83227)",
          "montant": 32.22
        },
        {
          "id": "p3",
          "libelle": "Gestion Locative Nation – loyer (mandat GN-82187)",
          "montant": 480
        }
      ],
      "contact": {
        "canaux": [
          "mobile",
          "sms",
          "email",
          "agence",
          "fixe"
        ],
        "echange": [
          "Vous : « Bonjour Mme Baudouin, votre compte présente un solde débiteur de 3 430 € depuis 90 jours. Pouvons-nous trouver ensemble une solution pour le régulariser ? »",
          "Mme Baudouin : « Ces frais sont abusifs, je ne vois pas pourquoi je devrais payer. Je ne ferai rien tant que la banque ne m'aura pas remboursé. »",
          "Vous : « Je vous rappelle les conséquences d'un compte débiteur qui dure. »",
          "Mme Baudouin : « Faites ce que vous voulez. »"
        ],
        "maj": [
          {
            "rubrique": "Position du client",
            "texte": "Refuse de régulariser et ne propose aucune date"
          }
        ]
      },
      "regularisation": {
        "plan": false,
        "reels": {},
        "sociaux": []
      },
      "attendu": {
        "decision": "sra",
        "courrier": "j90_sra"
      },
      "retenir": [
        "À J90, on clôture les services, on s'oppose aux prélèvements et on envoie le compte au service de recouvrement amiable.",
        "Sans solution financière, on enregistre « aucun moyen » ou une démarche d'accompagnement, jamais une ressource inventée."
      ],
      "id": 15
    },
    {
      "scenario": "fragile",
      "palier": 90,
      "objectif": "Un client fragile : on accompagne avant toute clôture.",
      "client": {
        "civilite": "Mme",
        "prenom": "Huguette",
        "nom": "ZERROUKI",
        "age": 58,
        "profession": "Aide à domicile (temps partiel)",
        "situation": "Divorcée, 1 enfant",
        "ancienneteAns": 13,
        "revenus": 1270,
        "revenusNote": "revenus interrompus, aucun versement régulier sur ce compte",
        "produits": [
          "Compte courant",
          "Offre clientèle fragile (OCF)",
          "Carte à autorisation systématique",
          "Crédit à la consommation GS (échéance de 125 € par mois)"
        ],
        "fragile": true,
        "compte": "00776 727 2040",
        "coordonnees": {
          "mobile": "06 39 98 89 65",
          "telephone": "01 99 00 89 65",
          "email": "huguette.zerrouki@example.com",
          "adresse": "11 rue de Charonne, 75011 Paris"
        },
        "professionnel": "Arrêt maladie, indemnités journalières non encore versées"
      },
      "note": null,
      "compte": {
        "solde": -444.45,
        "autorisation": 0,
        "debutJours": 90,
        "frais": 39.45,
        "origine": "FINACRED – mensualité de crédit (échéance du crédit)"
      },
      "ressources": {
        "revenuDomicilie": false,
        "salaire": null,
        "epargne": [],
        "credits": [
          {
            "libelle": "FINACRED – mensualité de crédit (crédit à la consommation GS)",
            "mensualite": 125
          }
        ],
        "notes": []
      },
      "releve": [
        {
          "j": 115,
          "lib": "Station Relais Est – carburant",
          "m": -37,
          "solde": 686.52,
          "type": "carte",
          "debut": false
        },
        {
          "j": 107,
          "lib": "Assur'Horizon – assurance habitation",
          "m": -36.02,
          "solde": 650.5,
          "type": "prelevement",
          "mandat": "AH-33281",
          "debut": false
        },
        {
          "j": 105,
          "lib": "Résidence Les Lilas – loyer",
          "m": -480,
          "solde": 170.5,
          "type": "prelevement",
          "mandat": "RL-61477",
          "debut": false
        },
        {
          "j": 98,
          "lib": "Pâtisserie du Marché – Paris 15e",
          "m": -24,
          "solde": 146.5,
          "type": "carte",
          "debut": false
        },
        {
          "j": 97,
          "lib": "Boulangerie Les Délices – Paris 15e",
          "m": -51.5,
          "solde": 95,
          "type": "carte",
          "debut": false
        },
        {
          "j": 90,
          "lib": "FINACRED – mensualité de crédit (échéance du crédit)",
          "m": -125,
          "solde": -30,
          "type": "prelevement",
          "mandat": "FC-55441",
          "debut": true
        },
        {
          "j": 87,
          "lib": "Prélèvement rejeté (provision insuffisante) – Électricité Verte – facture",
          "m": 0,
          "solde": -30,
          "type": "rejet",
          "mandat": "EV-18478",
          "montantRejete": 56.05,
          "debut": false
        },
        {
          "j": 86,
          "lib": "Prélèvement rejeté (provision insuffisante) – Fibra – box internet",
          "m": 0,
          "solde": -30,
          "type": "rejet",
          "mandat": "FB-76233",
          "montantRejete": 29.92,
          "debut": false
        },
        {
          "j": 77,
          "lib": "Prélèvement rejeté (provision insuffisante) – Assur'Horizon – assurance habitation",
          "m": 0,
          "solde": -30,
          "type": "rejet",
          "mandat": "AH-33281",
          "montantRejete": 36.02,
          "debut": false
        },
        {
          "j": 75,
          "lib": "Prélèvement rejeté (provision insuffisante) – Résidence Les Lilas – loyer",
          "m": 0,
          "solde": -30,
          "type": "rejet",
          "mandat": "RL-61477",
          "montantRejete": 480,
          "debut": false
        },
        {
          "j": 75,
          "lib": "Frais de rejet de prélèvement",
          "m": -10,
          "solde": -40,
          "type": "frais",
          "debut": false
        },
        {
          "j": 62,
          "lib": "Intérêts débiteurs (agios)",
          "m": -3.15,
          "solde": -43.15,
          "type": "frais",
          "debut": false
        },
        {
          "j": 60,
          "lib": "FINACRED – mensualité de crédit (échéance du crédit)",
          "m": -125,
          "solde": -168.15,
          "type": "prelevement",
          "mandat": "FC-55441",
          "debut": false
        },
        {
          "j": 57,
          "lib": "Prélèvement rejeté (provision insuffisante) – Électricité Verte – facture",
          "m": 0,
          "solde": -168.15,
          "type": "rejet",
          "mandat": "EV-18478",
          "montantRejete": 56.05,
          "debut": false
        },
        {
          "j": 56,
          "lib": "Prélèvement rejeté (provision insuffisante) – Fibra – box internet",
          "m": 0,
          "solde": -168.15,
          "type": "rejet",
          "mandat": "FB-76233",
          "montantRejete": 29.92,
          "debut": false
        },
        {
          "j": 47,
          "lib": "Prélèvement rejeté (provision insuffisante) – Assur'Horizon – assurance habitation",
          "m": 0,
          "solde": -168.15,
          "type": "rejet",
          "mandat": "AH-33281",
          "montantRejete": 36.02,
          "debut": false
        },
        {
          "j": 45,
          "lib": "Prélèvement rejeté (provision insuffisante) – Résidence Les Lilas – loyer",
          "m": 0,
          "solde": -168.15,
          "type": "rejet",
          "mandat": "RL-61477",
          "montantRejete": 480,
          "debut": false
        },
        {
          "j": 45,
          "lib": "Frais de rejet de prélèvement",
          "m": -10,
          "solde": -178.15,
          "type": "frais",
          "debut": false
        },
        {
          "j": 32,
          "lib": "Intérêts débiteurs (agios)",
          "m": -3.15,
          "solde": -181.3,
          "type": "frais",
          "debut": false
        },
        {
          "j": 30,
          "lib": "FINACRED – mensualité de crédit (échéance du crédit)",
          "m": -125,
          "solde": -306.3,
          "type": "prelevement",
          "mandat": "FC-55441",
          "debut": false
        },
        {
          "j": 27,
          "lib": "Prélèvement rejeté (provision insuffisante) – Électricité Verte – facture",
          "m": 0,
          "solde": -306.3,
          "type": "rejet",
          "mandat": "EV-18478",
          "montantRejete": 56.05,
          "debut": false
        },
        {
          "j": 26,
          "lib": "Prélèvement rejeté (provision insuffisante) – Fibra – box internet",
          "m": 0,
          "solde": -306.3,
          "type": "rejet",
          "mandat": "FB-76233",
          "montantRejete": 29.92,
          "debut": false
        },
        {
          "j": 17,
          "lib": "Prélèvement rejeté (provision insuffisante) – Assur'Horizon – assurance habitation",
          "m": 0,
          "solde": -306.3,
          "type": "rejet",
          "mandat": "AH-33281",
          "montantRejete": 36.02,
          "debut": false
        },
        {
          "j": 15,
          "lib": "Prélèvement rejeté (provision insuffisante) – Résidence Les Lilas – loyer",
          "m": 0,
          "solde": -306.3,
          "type": "rejet",
          "mandat": "RL-61477",
          "montantRejete": 480,
          "debut": false
        },
        {
          "j": 15,
          "lib": "Frais de rejet de prélèvement",
          "m": -10,
          "solde": -316.3,
          "type": "frais",
          "debut": false
        },
        {
          "j": 2,
          "lib": "Intérêts débiteurs (agios)",
          "m": -3.15,
          "solde": -319.45,
          "type": "frais",
          "debut": false
        },
        {
          "j": 0,
          "lib": "FINACRED – mensualité de crédit (échéance du crédit)",
          "m": -125,
          "solde": -444.45,
          "type": "prelevement",
          "mandat": "FC-55441",
          "debut": false
        }
      ],
      "historique": [
        {
          "j": 60,
          "canal": "Lettre recommandée",
          "texte": "Dernière relance avant mesures envoyée au client."
        },
        {
          "j": 30,
          "canal": "Courrier",
          "texte": "Information écrite sur le dépassement envoyée au client (courrier simple)."
        },
        {
          "j": 15,
          "canal": "Appel",
          "texte": "Appel – client joint : perte de revenus, aucune solution à court terme."
        },
        {
          "j": 3,
          "canal": "Système",
          "texte": "SMS automatique d'alerte « compte débiteur » envoyé au client"
        }
      ],
      "services": [
        {
          "id": "carte",
          "libelle": "Carte à autorisation systématique"
        },
        {
          "id": "bad",
          "libelle": "Banque à distance (application et site internet)"
        }
      ],
      "prelevements": [
        {
          "id": "p1",
          "libelle": "Résidence Les Lilas – loyer (mandat RL-61477)",
          "montant": 480
        },
        {
          "id": "p2",
          "libelle": "Électricité Verte – facture (mandat EV-18478)",
          "montant": 56.05
        },
        {
          "id": "p3",
          "libelle": "Fibra – box internet (mandat FB-76233)",
          "montant": 29.92
        },
        {
          "id": "p4",
          "libelle": "Assur'Horizon – assurance habitation (mandat AH-33281)",
          "montant": 36.02
        }
      ],
      "contact": {
        "canaux": [
          "mobile",
          "sms",
          "email",
          "agence",
          "fixe"
        ],
        "echange": [
          "Vous : « Bonjour Mme Zerrouki, votre compte présente un solde débiteur de 444,45 € depuis 90 jours. Pouvons-nous trouver ensemble une solution pour le régulariser ? »",
          "Mme Zerrouki : « Je suis en arrêt maladie depuis plusieurs semaines. Les indemnités journalières n'ont pas encore été versées et mes charges n'ont pas changé. »",
          "Vous : « Je comprends. Je note que vous n'avez pas de rentrée prévue à court terme. »",
          "Mme Zerrouki : « Ma famille peut peut-être m'avancer 80 € la semaine prochaine, mais pas plus. »"
        ],
        "maj": [
          {
            "rubrique": "Situation professionnelle",
            "texte": "Arrêt maladie, indemnités journalières non encore versées"
          },
          {
            "rubrique": "Ressources",
            "texte": "Aucune rentrée régulière actuellement ; charges fixes d'environ 1 340 € par mois"
          },
          {
            "rubrique": "Statut",
            "texte": "Client titulaire de l'offre clientèle fragile (OCF) : frais d'incidents plafonnés"
          },
          {
            "rubrique": "Crédit",
            "texte": "Crédit à la consommation GS : échéance de 125 € prélevée chaque mois"
          },
          {
            "rubrique": "Aide d'un proche",
            "texte": "Avance possible de 80 € dans la semaine"
          }
        ]
      },
      "regularisation": {
        "plan": false,
        "reels": {
          "aide_proche": {
            "montant": 80,
            "delai": 7
          }
        },
        "sociaux": [
          "accompagnement"
        ]
      },
      "attendu": {
        "decision": "sra",
        "courrier": "j90_sra"
      },
      "retenir": [
        "À J90, on clôture les services, on s'oppose aux prélèvements et on envoie le compte au service de recouvrement amiable.",
        "Sans solution financière, on enregistre « aucun moyen » ou une démarche d'accompagnement, jamais une ressource inventée."
      ],
      "id": 16
    }
  ];
  if (typeof module !== "undefined" && module.exports) module.exports = { dossiers: dossiers };
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.incidents = dossiers; }
})(typeof window !== "undefined" ? window : null);
