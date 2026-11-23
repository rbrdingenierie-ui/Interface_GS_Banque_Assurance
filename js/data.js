/* GS Banque & Assurance – banque fictive à usage pédagogique.
   Clients, montants et échelle de notation sont imaginaires.
   Pour ajouter ou modifier un dossier, suivre le modèle ci-dessous (voir README). */
(function (root) {
  "use strict";

  /* Échelle interne fictive de la note Bâle. */
  var notes = [
    { code: "A", libelle: "Risque très faible", description: "Client sain : aucun incident, revenus domiciliés et réguliers." },
    { code: "B", libelle: "Risque faible", description: "Client sain : incidents rares ou anciens." },
    { code: "C", libelle: "Risque modéré", description: "Client à surveiller : incidents récents ou revenus modestes." },
    { code: "D", libelle: "Risque élevé", description: "Incidents répétés : la tolérance doit rester exceptionnelle." },
    { code: "E", libelle: "Risque très élevé", description: "Situation dégradée : pas de tolérance sans crédit certain." },
    { code: "Défaut", libelle: "Client en défaut", description: "Arriérés de plus de 90 jours : dossier suivi par le recouvrement." }
  ];

  /* Modèle d'un dossier :
     client       : identité et situation
     note         : "A" à "E" ou "Défaut"
     position     : solde, autorisation de découvert, crédit attendu (ou null),
                    debiteurDepuis (nombre de jours à l'état des débiteurs, ou null)
     operations   : type "carte" | "cheque" | "prelevement", montant (débit),
                    detail (« {date} » est remplacé par la date réelle), joursAvant (nombre de jours avant le jour de l'exercice ; 0 = aujourd'hui),
                    attendu "payer" | "rejeter", acceptable (facultatif), tolerance (facultatif),
                    explication
     antecedents  : rejets des 12 derniers mois (type, montant, joursAvant, libelle)
     controle     : facultatif, { motif } : compte sous contrôle (mention SC), par exemple après une
                    fraude ou à l'ouverture récente du compte. Il n'est pas à l'état des débiteurs :
                    le conseiller le surveille.
     client.fragile : true pour un client titulaire de l'offre clientèle fragile (mention OCF)
     client.ficp    : true pour un client fiché au FICP (mention FCP)
     client.dac     : true pour un client en droit au compte (mention DAC)
     client.ancienneteMois : facultatif, pour un client récent (remplace l'ancienneté en années)
     observations : facultatif, remarques du conseiller affichées dans le dossier client
     opportunite  : { type: "carte" | "decouvert" | "credit" | null, explication } :
                    opportunité commerciale à détecter (null = aucune)
     L'identifiant (id) est attribué automatiquement : c'est le rang du dossier dans la liste. */
  var dossiers = [
    {
      objectif: "Le paiement fait passer le compte à découvert, mais dans l'autorisation : ce n'est pas l'état des débiteurs, on paie.",
      opportunite: { type: "carte",
        explication: "Note A, 2 350 € de salaire domicilié, 9 ans d'ancienneté, aucun rejet et une carte Visa Classic qui règle la plus grande part de ses dépenses (1 319 € le mois dernier) : une montée en gamme vers une carte Premier se justifie." },
      client: {
        civilite: "Mme", prenom: "Léa", nom: "MARCHAND", age: 34,
        profession: "Infirmière (hôpital public)", situation: "Célibataire",
        ancienneteAns: 9, revenus: 2350, revenusNote: "salaire domicilié",
        produits: ["Compte courant", "Carte Visa Classic", "Livret A", "Assurance habitation GS Habitat", "Autorisation de découvert"],
        fragile: false, compte: "00412 375 6621"
      },
      observations: ["Règle la plus grande part de ses dépenses courantes par carte : 1 319 € de paiements le mois dernier"],
      note: "A",
      position: {
        solde: 190, autorisation: 500,
        creditAttendu: { libelle: "Salaire", montant: 2350, dansJours: 3 },
        debiteurDepuis: null
      },
      operations: [
        { id: "o1", type: "carte", libelle: "Primeur & Cie – Paris 4e", detail: "Paiement par carte autorisé le {date}", joursAvant: 1, montant: 54.2,
          attendu: "payer",
          explication: "Une opération par carte se valide toujours : l'ordre de paiement est irrévocable. Le solde passe à 135,80 €." },
        { id: "o2", type: "cheque", libelle: "Auto-école Horizon", detail: "Chèque n° 7302914, émis le {date}", joursAvant: 2, montant: 120,
          attendu: "payer",
          explication: "Après ce chèque, le solde est de 15,80 € : le compte reste créditeur. Rien ne justifie un rejet." },
        { id: "o3", type: "prelevement", libelle: "TELCOM+ – forfait mobile", detail: "Prélèvement SEPA, mandat n° TC-88215, présenté le {date}", joursAvant: 0, montant: 79.9,
          attendu: "payer",
          explication: "Le prélèvement fait passer le solde à −64,10 € : le compte est débiteur, mais dans l'autorisation de 500 €. Ce n'est pas l'état des débiteurs. Cliente de note A sans incident : on paie." }
      ],
      antecedents: [],
      retenir: [
        "Un solde négatif n'est pas forcément l'état des débiteurs : tant que le compte reste dans l'autorisation de découvert, on paie. Un rejet serait injustifié et pourrait engager la responsabilité de la banque.",
        "Une note A et l'absence d'antécédents confirment qu'il n'y a pas de risque particulier."
      ],
      argumentaire: [
        "Solde de −64,10 € après les trois opérations : débiteur, mais dans l'autorisation de 500 €",
        "Note Bâle A",
        "Aucun rejet sur les 12 derniers mois",
        "Carte Visa Classic très utilisée : 1 319 € de paiements le mois dernier"
      ]
    },

    {
      objectif: "Détecter une montée en gamme de carte chez un client sain dont la carte atteint son plafond.",
      opportunite: { type: "carte",
        explication: "Note A, 3 200 € de salaire domicilié, aucun incident et une carte Visa Classic dont le plafond est atteint : montée en gamme vers une carte Premier." },
      client: {
        civilite: "Mme", prenom: "Julie", nom: "MERCIER", age: 36,
        profession: "Responsable des ressources humaines", situation: "Pacsée, 1 enfant",
        ancienneteAns: 6, revenus: 3200, revenusNote: "salaire domicilié",
        produits: ["Compte courant", "Carte Visa Classic", "Livret A", "Autorisation de découvert"],
        fragile: false, compte: "00417 285 6093"
      },
      observations: ["Le plafond de paiement de la carte a été atteint deux fois ce trimestre"],
      note: "A",
      position: {
        solde: 900, autorisation: 500,
        creditAttendu: { libelle: "Salaire", montant: 3200, dansJours: 4 },
        debiteurDepuis: null
      },
      operations: [
        { id: "o1", type: "carte", libelle: "Agence Horizon Voyages – Paris 9e", detail: "Paiement par carte autorisé le {date}", joursAvant: 1, montant: 640,
          attendu: "payer",
          explication: "Une opération par carte se valide toujours. Le solde passe à 260 €." },
        { id: "o2", type: "prelevement", libelle: "Mutuelle Santé Plus – cotisation", detail: "Prélèvement SEPA, mandat n° MS-44120, présenté le {date}", joursAvant: 0, montant: 78,
          attendu: "payer",
          explication: "Provision suffisante : le compte reste créditeur, avec 182 € après le prélèvement." },
        { id: "o3", type: "cheque", libelle: "Crèche Les Petits Loups", detail: "Chèque n° 6150382, émis le {date}", joursAvant: 2, montant: 420,
          attendu: "payer",
          explication: "Le chèque fait passer le solde à −238 € : le compte est débiteur, mais dans l'autorisation de 500 €. Ce n'est pas l'état des débiteurs : aucune raison de rejeter." }
      ],
      antecedents: [],
      retenir: [
        "Un découvert qui reste dans l'autorisation d'un client sans incident se paie sans hésiter : l'analyse commerciale vient en plus de la décision payer ou rejeter.",
        "Un client de note A, aux revenus élevés, avec une carte d'entrée de gamme dont le plafond est atteint : montée en gamme de carte."
      ],
      argumentaire: [
        "Solde final de −238 € : débiteur, mais dans l'autorisation de 500 €",
        "Note A, 3 200 € de salaire, aucun rejet",
        "Carte Visa Classic dont le plafond est atteint",
        "Opportunité : carte Premier"
      ]
    },

    {
      objectif: "Distinguer un compte débiteur autorisé de l'état des débiteurs.",
      opportunite: { type: "augmentation",
        explication: "Après le loyer, le compte utilise 76 % de l'autorisation de 600 € avec un salaire régulier de 1 780 €, une note B et un seul rejet ancien : l'autorisation devient juste en fin de mois, une augmentation du découvert est à proposer." },
      client: {
        civilite: "M.", prenom: "Karim", nom: "BENALI", age: 41,
        profession: "Chauffeur-livreur (salarié)", situation: "Marié, 2 enfants",
        ancienneteAns: 4, revenus: 1780, revenusNote: "salaire domicilié",
        produits: ["Compte courant", "Carte Visa Classic", "Autorisation de découvert"],
        fragile: false, compte: "00587 120 4478"
      },
      note: "B",
      position: {
        solde: 220, autorisation: 600,
        creditAttendu: { libelle: "Salaire", montant: 1780, dansJours: 17 },
        debiteurDepuis: null
      },
      operations: [
        { id: "o1", type: "carte", libelle: "Station Relais Nord – carburant", detail: "Paiement par carte autorisé le {date}", joursAvant: 1, montant: 35,
          attendu: "payer",
          explication: "Opération par carte : on valide, l'ordre est irrévocable." },
        { id: "o2", type: "prelevement", libelle: "Immobilière du Marais – loyer", detail: "Prélèvement SEPA, mandat n° IM-20931, présenté le {date}", joursAvant: 0, montant: 640,
          attendu: "payer",
          explication: "Après le loyer, le solde est de −455 € pour 600 € d'autorisation : le compte est débiteur mais dans l'autorisation. Il n'est pas à l'état des débiteurs : on paie." }
      ],
      antecedents: [
        { type: "prelevement", montant: 38, joursAvant: 270, libelle: "Assurance habitation" }
      ],
      retenir: [
        "Un compte peut être débiteur sans être à l'état des débiteurs : tant que le solde reste dans l'autorisation de découvert, on paie.",
        "L'état des débiteurs commence quand le solde dépasse l'autorisation, ou quand le compte devient débiteur sans autorisation."
      ],
      argumentaire: [
        "Solde projeté de −455 € pour une autorisation de 600 €",
        "Dépassement nul : pas d'état des débiteurs",
        "Note B et un seul rejet, ancien (9 mois)"
      ]
    },

    {
      objectif: "Un compte à 0 € n'est pas débiteur : on paie jusqu'au dernier euro disponible.",
      opportunite: { type: "decouvert",
        explication: "Le compte tombe à 0,00 € alors qu'il n'a aucune autorisation de découvert, avec un salaire régulier de 1 750 €, une note B et aucun rejet : une autorisation de découvert lui laisserait une marge de sécurité." },
      client: {
        civilite: "M.", prenom: "Thomas", nom: "GIRARD", age: 29,
        profession: "Technicien de maintenance", situation: "Célibataire",
        ancienneteAns: 5, revenus: 1750, revenusNote: "salaire domicilié",
        produits: ["Compte courant", "Carte Visa Classic", "Livret A"],
        fragile: false, compte: "00519 842 3067"
      },
      note: "B",
      position: {
        solde: 340, autorisation: 0,
        creditAttendu: { libelle: "Salaire", montant: 1750, dansJours: 12 },
        debiteurDepuis: null
      },
      operations: [
        { id: "o1", type: "carte", libelle: "Supermarché Bio Plus – Paris 3e", detail: "Paiement par carte autorisé le {date}", joursAvant: 1, montant: 28.5,
          attendu: "payer",
          explication: "Une opération par carte se valide toujours. Le solde passe de 340 € à 311,50 €." },
        { id: "o2", type: "cheque", libelle: "Cycles Rivière – révision vélo", detail: "Chèque n° 4172066, émis le {date}", joursAvant: 2, montant: 200,
          attendu: "payer",
          explication: "Après ce chèque, le solde est de 111,50 € : le compte reste créditeur. Rien ne justifie un rejet." },
        { id: "o3", type: "prelevement", libelle: "Assurances Mutuelle Nord – assurance auto", detail: "Prélèvement SEPA, mandat n° MN-61207, présenté le {date}", joursAvant: 0, montant: 111.5,
          attendu: "payer",
          explication: "Le prélèvement ramène le solde à 0,00 €. Un solde nul n'est pas négatif : le compte est créditeur, il n'y a ni découvert ni état des débiteurs. On paie." }
      ],
      antecedents: [],
      retenir: [
        "Un compte est créditeur tant que le solde est de 0 € ou plus : un solde de 0,00 € n'est pas un découvert.",
        "On additionne les opérations dans l'ordre de présentation et on regarde le solde après chacune d'elles."
      ],
      argumentaire: [
        "Solde de 311,50 € après la carte, puis 111,50 € après le chèque",
        "Solde de 0,00 € après le prélèvement : compte créditeur",
        "Note B et aucun rejet sur les 12 derniers mois",
        "Pas d'état des débiteurs : aucune raison de rejeter"
      ]
    },

    {
      objectif: "Repérer une montée en gamme de carte chez un client qui voyage beaucoup.",
      opportunite: { type: "carte",
        explication: "Note A, 3 900 € de salaire et des déplacements fréquents à l'étranger avec une carte Visa Classic : montée en gamme de carte." },
      client: {
        civilite: "M.", prenom: "Alexandre", nom: "FONTAINE", age: 41,
        profession: "Consultant en informatique", situation: "Marié",
        ancienneteAns: 11, revenus: 3900, revenusNote: "salaire domicilié",
        produits: ["Compte courant", "Carte Visa Classic", "Assurance-vie", "Assurance habitation GS Habitat", "Autorisation de découvert"],
        fragile: false, compte: "00652 938 1174"
      },
      observations: ["Déplacements professionnels fréquents à l'étranger"],
      note: "A",
      position: {
        solde: 1000, autorisation: 500,
        creditAttendu: { libelle: "Salaire", montant: 3900, dansJours: 4 },
        debiteurDepuis: null
      },
      operations: [
        { id: "o1", type: "carte", libelle: "Hôtel Kensington – Londres", detail: "Paiement par carte à l'étranger autorisé le {date}", joursAvant: 1, montant: 186,
          attendu: "payer",
          explication: "Une opération par carte se valide toujours. Le solde passe à 814 €." },
        { id: "o2", type: "carte", libelle: "Location Auto Hudson – New York", detail: "Paiement par carte à l'étranger autorisé le {date}", joursAvant: 2, montant: 312,
          attendu: "payer",
          explication: "Même règle : la carte se valide. Le solde passe à 502 €." },
        { id: "o3", type: "prelevement", libelle: "Fibre Net – abonnement", detail: "Prélèvement SEPA, mandat n° FN-90321, présenté le {date}", joursAvant: 0, montant: 129,
          attendu: "payer",
          explication: "Provision suffisante : il reste 373 € après le prélèvement." },
        { id: "o4", type: "cheque", libelle: "Menuiserie Fabre – solde de travaux", detail: "Chèque n° 3340987, émis le {date}", joursAvant: 4, montant: 540,
          attendu: "payer",
          explication: "Le chèque fait passer le solde à −167 € : le compte est débiteur, mais dans l'autorisation de 500 €. Ce n'est pas l'état des débiteurs : on paie." }
      ],
      antecedents: [],
      retenir: [
        "Le découvert est ponctuel et reste dans l'autorisation de 500 € : ce n'est pas un besoin de découvert supplémentaire, le besoin à repérer est celui de la carte.",
        "Une carte d'entrée de gamme, de revenus élevés, de nombreux paiements à l'étranger : montée en gamme de carte."
      ],
      argumentaire: [
        "Solde final de −167 € : débiteur, mais dans l'autorisation de 500 €",
        "Note A, 3 900 € de salaire, 11 ans d'ancienneté",
        "Paiements fréquents à l'étranger avec une carte Visa Classic",
        "Opportunité : carte de gamme supérieure"
      ]
    },

    {
      objectif: "Reconnaître un client déjà bien équipé : toutes les opportunités ne se valent pas, certains dossiers n'en ont aucune.",
      opportunite: { type: null,
        explication: "Client déjà bien équipé : carte Premier, autorisation de 1 500 € qui couvre largement ce découvert ponctuel, épargne et crédit immobilier. Aucun besoin détecté." },
      client: {
        civilite: "M.", prenom: "Hugo", nom: "CHEVALIER", age: 52,
        profession: "Directeur d'agence commerciale", situation: "Marié, 2 enfants",
        ancienneteAns: 20, revenus: 4200, revenusNote: "salaire domicilié",
        produits: ["Compte courant", "Carte Visa Premier", "Livret A", "Assurance-vie", "Crédit immobilier", "Assurance habitation GS Habitat", "Assurance automobile GS Auto", "Parts sociales GS Banque & Assurance", "Autorisation de découvert"],
        fragile: false, compte: "00109 472 5586"
      },
      note: "A",
      position: {
        solde: 3000, autorisation: 1500,
        creditAttendu: { libelle: "Salaire", montant: 4200, dansJours: 6 },
        debiteurDepuis: null
      },
      operations: [
        { id: "o1", type: "carte", libelle: "Restaurant Le Bistrot Lyonnais", detail: "Paiement par carte autorisé le {date}", joursAvant: 1, montant: 214,
          attendu: "payer",
          explication: "Une opération par carte se valide toujours." },
        { id: "o2", type: "prelevement", libelle: "GS Banque & Assurance – crédit immobilier", detail: "Échéance du prêt immobilier, prélèvement n° GS-10077, présenté le {date}", joursAvant: 0, montant: 1150,
          attendu: "payer",
          explication: "Provision suffisante : on paie la mensualité de crédit. Il reste 1 636 € après le prélèvement." },
        { id: "o3", type: "cheque", libelle: "Lycée Saint-Exupéry – frais de scolarité", detail: "Chèque n° 8850214, émis le {date}", joursAvant: 5, montant: 2300,
          attendu: "payer",
          explication: "Le chèque fait passer le solde à −664 € : le compte est débiteur, mais dans l'autorisation de 1 500 €. Ce n'est pas l'état des débiteurs : on paie." }
      ],
      antecedents: [],
      retenir: [
        "Un client déjà équipé (carte Premier, autorisation de découvert, épargne, crédit immobilier) n'offre pas d'opportunité à saisir : son autorisation couvre déjà ce besoin ponctuel.",
        "Savoir répondre « aucune opportunité » fait partie du métier."
      ],
      argumentaire: [
        "Solde final de −664 € : débiteur, mais dans l'autorisation de 1 500 €",
        "Carte Premier déjà en place",
        "Autorisation de 1 500 € suffisante pour ce découvert ponctuel",
        "Aucun besoin détecté"
      ]
    },

    {
      objectif: "Repérer qu'une carte d'entrée de gamme devient trop juste quand tout passe par carte.",
      opportunite: { type: "carte",
        explication: "Note B, 2 700 € de salaire et l'essentiel des dépenses payé par carte (Visa Classic) : montée en gamme de carte." },
      client: {
        civilite: "M.", prenom: "Romain", nom: "GUERIN", age: 30,
        profession: "Ingénieur", situation: "Célibataire",
        ancienneteAns: 3, revenus: 2700, revenusNote: "salaire domicilié",
        produits: ["Compte courant", "Carte Visa Classic", "Livret A", "Autorisation de découvert"],
        fragile: false, compte: "00583 710 2269"
      },
      observations: ["Paie presque toutes ses dépenses par carte : 2 100 € de paiements le mois dernier"],
      note: "B",
      position: {
        solde: 400, autorisation: 300,
        creditAttendu: { libelle: "Salaire", montant: 2700, dansJours: 5 },
        debiteurDepuis: null
      },
      operations: [
        { id: "o1", type: "carte", libelle: "High-Tech Store – Paris 2e", detail: "Paiement par carte autorisé le {date}", joursAvant: 1, montant: 320,
          attendu: "payer",
          explication: "Une opération par carte se valide toujours. Le solde passe à 80 €." },
        { id: "o2", type: "prelevement", libelle: "Fibre Net – abonnement", detail: "Prélèvement SEPA, mandat n° FN-60418, présenté le {date}", joursAvant: 0, montant: 29.99,
          attendu: "payer",
          explication: "Provision suffisante : il reste 50,01 € après le prélèvement." },
        { id: "o3", type: "cheque", libelle: "Association Cycles Urbains – adhésion", detail: "Chèque n° 4412076, émis le {date}", joursAvant: 3, montant: 190,
          attendu: "payer",
          explication: "Le chèque fait passer le solde à −139,99 € : le compte est débiteur, mais dans l'autorisation de 300 €. Ce n'est pas l'état des débiteurs : on paie." }
      ],
      antecedents: [],
      retenir: [
        "La décision payer ou rejeter est simple ici ; l'enjeu est de repérer l'usage intensif de la carte.",
        "Revenus de 2 700 €, note B, aucun rejet, carte Classic très utilisée : montée en gamme de carte."
      ],
      argumentaire: [
        "Solde final de −139,99 € : débiteur, mais dans l'autorisation de 300 €",
        "Note B, 2 700 € de salaire, aucun rejet",
        "2 100 € de paiements par carte le mois dernier",
        "Opportunité : montée en gamme de carte"
      ]
    },

    {
      objectif: "Repérer la limite exacte de l'autorisation de découvert.",
      opportunite: { type: null,
        explication: "Note C, 2 rejets sur 12 mois et autorisation de 300 € déjà entièrement utilisée après le loyer : on n'ajoute ni découvert ni crédit." },
      client: {
        civilite: "Mme", prenom: "Camille", nom: "ROSSI", age: 31,
        profession: "Graphiste (CDI)", situation: "Pacsée",
        ancienneteAns: 3, revenus: 1900, revenusNote: "salaire domicilié",
        produits: ["Compte courant", "Carte Visa Classic", "Autorisation de découvert"],
        fragile: false, compte: "00734 205 1189"
      },
      note: "C",
      position: {
        solde: 400, autorisation: 300,
        creditAttendu: { libelle: "Salaire", montant: 1900, dansJours: 18 },
        debiteurDepuis: null
      },
      operations: [
        { id: "o1", type: "prelevement", libelle: "Résidence Les Cèdres – loyer", detail: "Prélèvement SEPA, mandat n° RC-52088, présenté le {date}", joursAvant: 0, montant: 700,
          attendu: "payer",
          explication: "Après le loyer, le solde est de −300,00 € pour 300 € d'autorisation : le compte est exactement à la limite. Il n'y a aucun dépassement, ce n'est pas l'état des débiteurs : on paie." },
        { id: "o2", type: "cheque", libelle: "Garage Bastide – révision", detail: "Chèque n° 9026418, émis le {date}", joursAvant: 2, montant: 180,
          attendu: "rejeter",
          explication: "L'autorisation est déjà entièrement utilisée : le chèque ferait passer le solde à −480 €, soit un dépassement de 180 €. Note C, 2 rejets sur 12 mois et salaire attendu seulement dans 18 jours : on ne creuse pas le dépassement. Le chèque dépasse 15 € : il peut être refusé. Frais de rejet : 50 € (chèque de plus de 50 €)." }
      ],
      antecedents: [
        { type: "prelevement", montant: 45, joursAvant: 73, libelle: "Assurance habitation" },
        { type: "cheque", montant: 70, joursAvant: 210, libelle: "Artisan peintre" }
      ],
      retenir: [
        "L'autorisation de découvert peut être utilisée jusqu'à sa limite : −300 € pour 300 € d'autorisation, ce n'est pas l'état des débiteurs.",
        "Un seul euro de plus fait basculer à l'état des débiteurs : l'opération suivante se décide, elle ne se paie pas automatiquement."
      ],
      argumentaire: [
        "Loyer : solde de −300 € pour 300 € d'autorisation, pas de dépassement",
        "Chèque : solde de −480 €, dépassement de 180 €",
        "Note C et 2 rejets sur 12 mois",
        "Salaire attendu seulement dans 18 jours"
      ]
    },

    {
      objectif: "Un compte sous contrôle (SC) n'est pas un compte débiteur : le conseiller surveille, il ne rejette pas.",
      controle: { motif: "ouverture de compte récente (il y a 2 mois)" },
      opportunite: { type: null,
        explication: "Compte ouvert depuis 2 mois et sous contrôle (SC) : on attend de connaître son fonctionnement avant toute proposition commerciale." },
      client: {
        civilite: "M.", prenom: "Antoine", nom: "PERRIN", age: 44,
        profession: "Artisan plombier (entreprise individuelle)", situation: "Marié, 2 enfants",
        ancienneteAns: 0, ancienneteMois: 2, revenus: 2500, revenusNote: "revenus d'activité, variables",
        produits: ["Compte courant", "Carte Visa Classic"],
        fragile: false, compte: "00861 530 7742"
      },
      note: "C",
      position: {
        solde: 1850, autorisation: 0,
        creditAttendu: null,
        debiteurDepuis: null
      },
      operations: [
        { id: "o1", type: "carte", libelle: "Quincaillerie Pro – Paris", detail: "Paiement par carte autorisé le {date}", joursAvant: 1, montant: 64,
          attendu: "payer",
          explication: "Une opération par carte se valide toujours." },
        { id: "o2", type: "prelevement", libelle: "Assurances Artisans – responsabilité décennale", detail: "Prélèvement SEPA, mandat n° AA-30551, présenté le {date}", joursAvant: 0, montant: 420,
          attendu: "payer",
          explication: "Le compte est sous contrôle, mais il est largement créditeur : la provision est suffisante, on paie." },
        { id: "o3", type: "cheque", libelle: "Grossiste Matériaux Sud", detail: "Chèque n° 2275810, émis le {date}", joursAvant: 3, montant: 1100,
          attendu: "payer",
          explication: "Après ce chèque, le solde est de 266 € : le compte reste créditeur. Le statut SC ne crée aucun motif de rejet : la gestion consiste à surveiller le compte." }
      ],
      antecedents: [],
      retenir: [
        "SC : le compte figure dans les états du conseiller (ici, une ouverture de compte récente), mais il n'est pas à l'état des débiteurs.",
        "Le conseiller contrôle et surveille. La décision de payer repose toujours sur la provision et sur la situation du client."
      ],
      argumentaire: [
        "Compte sous contrôle (SC) : ouverture récente, 2 mois",
        "Compte créditeur : 266 € après les trois opérations",
        "Pas d'état des débiteurs : aucun motif de rejet",
        "Aucun historique de rejet : le client est nouveau"
      ]
    },

    {
      objectif: "Un compte sous contrôle (SC) après une fraude reste un compte à provision suffisante : on paie, le conseiller contrôle.",
      controle: { motif: "fraude à la carte constatée il y a 3 semaines (carte remplacée)" },
      opportunite: { type: null,
        explication: "Compte sous contrôle (SC) à la suite d'une fraude : on ne propose rien tant que le contrôle n'est pas levé." },
      client: {
        civilite: "Mme", prenom: "Nadia", nom: "LAMBERT", age: 39,
        profession: "Cadre commerciale", situation: "Divorcée, 1 enfant",
        ancienneteAns: 8, revenus: 3100, revenusNote: "salaire domicilié",
        produits: ["Compte courant", "Carte Visa Premier", "Livret A", "Assurance automobile GS Auto"],
        fragile: false, compte: "00290 614 8803"
      },
      note: "A",
      position: {
        solde: 9200, autorisation: 0,
        creditAttendu: { libelle: "Salaire", montant: 3100, dansJours: 14 },
        debiteurDepuis: null
      },
      operations: [
        { id: "o1", type: "cheque", libelle: "Étude Girault, notaire – frais d'acquisition", detail: "Chèque n° 1830246, émis le {date}", joursAvant: 1, montant: 6400,
          attendu: "payer",
          explication: "Le compte est sous contrôle (SC) à la suite d'une fraude : le conseiller contrôle l'opération, par exemple en contactant la cliente. La provision est largement suffisante (2 800 € après le chèque) : il n'y a aucun motif de rejet." },
        { id: "o2", type: "prelevement", libelle: "Résidence Les Lilas – loyer", detail: "Prélèvement SEPA, mandat n° RL-71264, présenté le {date}", joursAvant: 0, montant: 740,
          attendu: "payer",
          explication: "Provision suffisante : le solde final est de 2 060 €. On paie." }
      ],
      antecedents: [],
      retenir: [
        "SC ne veut pas dire état des débiteurs : ici le compte reste largement créditeur.",
        "Après une fraude, le conseiller contrôle les opérations importantes. Sans insuffisance de provision, on paie."
      ],
      argumentaire: [
        "Compte sous contrôle (SC) à la suite d'une fraude à la carte",
        "Solde final de 2 060 € : aucun découvert",
        "Note A et aucun rejet sur 12 mois",
        "Le conseiller contrôle, il ne rejette pas"
      ]
    },

    {
      objectif: "Appliquer la règle du chèque de 15 € ou moins.",
      opportunite: { type: null,
        explication: "Retraité de note D, 3 rejets sur 12 mois et pension de 1 120 € : aucun produit à proposer." },
      client: {
        civilite: "M.", prenom: "Paul", nom: "LEFEBVRE", age: 67,
        profession: "Retraité", situation: "Veuf",
        ancienneteAns: 22, revenus: 1120, revenusNote: "pension de retraite",
        produits: ["Compte courant", "Carte Visa Classic"],
        fragile: false, compte: "00114 760 2285"
      },
      note: "D",
      position: {
        solde: 8, autorisation: 0,
        creditAttendu: { libelle: "Pension de retraite", montant: 1120, dansJours: 19 },
        debiteurDepuis: null
      },
      operations: [
        { id: "o1", type: "cheque", libelle: "Club de pétanque Les Boules d'Or – cotisation", detail: "Chèque n° 6641029, émis le {date}", joursAvant: 5, montant: 12.5,
          attendu: "payer",
          explication: "Un chèque sans provision de 15 € ou moins ne peut pas être refusé : il est débité (le compte passe à −4,50 €) et donne lieu à des intérêts débiteurs." },
        { id: "o2", type: "prelevement", libelle: "Presse & Co – abonnement", detail: "Prélèvement SEPA, mandat n° PC-30871, présenté le {date}", joursAvant: 0, montant: 14.9,
          attendu: "rejeter",
          explication: "Compte à l'état des débiteurs, note D, 3 rejets sur 12 mois et pension attendue seulement dans 19 jours : on rejette. Les frais sont limités à 14,90 € : pour une opération de 20 € ou moins, ils ne dépassent jamais le montant rejeté (art. D133-6 du CMF)." }
      ],
      antecedents: [
        { type: "prelevement", montant: 29.9, joursAvant: 42, libelle: "Mutuelle Santé Plus" },
        { type: "prelevement", montant: 14.9, joursAvant: 120, libelle: "Presse & Co – abonnement" },
        { type: "prelevement", montant: 19.9, joursAvant: 250, libelle: "Cinéma Club – abonnement" }
      ],
      retenir: [
        "Chèque de 15 € ou moins : paiement obligatoire, comme pour la carte.",
        "Frais de rejet d'un prélèvement : 20 € au maximum, et jamais plus que le montant rejeté (art. D133-6 du CMF)."
      ],
      argumentaire: [
        "Chèque de 12,50 € : il ne peut pas être refusé",
        "Solde de −4,50 € après le chèque, puis −19,40 € si le prélèvement était payé",
        "Note D et 3 rejets sur 12 mois",
        "Pension attendue seulement dans 19 jours"
      ]
    },

    {
      objectif: "Distinguer un chèque de 15,00 € d'un chèque de 15,01 €.",
      opportunite: { type: null,
        explication: "Note C et 2 rejets sur 12 mois, tous deux datant de moins de 6 mois : pas de proposition commerciale." },
      client: {
        civilite: "M.", prenom: "Bruno", nom: "FOURNIER", age: 54,
        profession: "Agent de maîtrise", situation: "Marié",
        ancienneteAns: 10, revenus: 2100, revenusNote: "salaire domicilié",
        produits: ["Compte courant", "Carte Visa Classic"],
        fragile: false, compte: "00457 913 6620"
      },
      note: "C",
      position: {
        solde: 6, autorisation: 0,
        creditAttendu: { libelle: "Salaire", montant: 2100, dansJours: 14 },
        debiteurDepuis: null
      },
      operations: [
        { id: "o1", type: "cheque", libelle: "Boulangerie du Marché – commande", detail: "Chèque n° 3618295, émis le {date}", joursAvant: 3, montant: 15,
          attendu: "payer",
          explication: "Chèque de 15,00 € exactement : le seuil de 15 € est atteint, le chèque ne peut pas être refusé. Il est débité et le compte passe à −9,00 €, sans autorisation." },
        { id: "o2", type: "cheque", libelle: "Pressing du Centre", detail: "Chèque n° 3618296, émis le {date}", joursAvant: 3, montant: 15.01,
          attendu: "rejeter",
          explication: "15,01 € : un centime au-dessus du seuil de 15 €, ce chèque peut être refusé. Le compte est déjà à −9,00 € et passerait à −24,01 €. Note C, 2 rejets sur 12 mois et salaire dans 14 jours : on ne creuse pas le débit. Frais de rejet : 30 € (chèque de 50 € ou moins)." }
      ],
      antecedents: [
        { type: "prelevement", montant: 41, joursAvant: 47, libelle: "Mutuelle Santé Plus" },
        { type: "prelevement", montant: 29.9, joursAvant: 170, libelle: "Opérateur mobile" }
      ],
      retenir: [
        "Chèque de 15 € ou moins : paiement obligatoire. Dès 15,01 €, le conseiller retrouve sa liberté de décision.",
        "Le chèque obligatoire peut mettre le compte à l'état des débiteurs : l'opération suivante se décide avec cette nouvelle position."
      ],
      argumentaire: [
        "Chèque de 15,00 € : paiement obligatoire, solde de −9,00 €",
        "Chèque de 15,01 € : supérieur au seuil, rejet possible",
        "Note C et 2 rejets sur 12 mois",
        "Salaire attendu seulement dans 14 jours"
      ]
    },

    {
      objectif: "Valider une opération par carte, puis protéger la position.",
      opportunite: { type: null,
        explication: "Alternante à 1 150 € de rémunération, avec un seul rejet sur 12 mois mais une note C : client à surveiller, pas encore « sain » (notes A et B). On ne propose aucun découvert pour l'instant." },
      client: {
        civilite: "Mme", prenom: "Chloé", nom: "DURAND", age: 22,
        profession: "Étudiante en alternance (BTS)", situation: "Célibataire",
        ancienneteAns: 3, revenus: 1150, revenusNote: "rémunération d'alternance",
        produits: ["Compte courant", "Carte Visa à débit immédiat"],
        fragile: false, compte: "00698 441 0927"
      },
      note: "C",
      position: {
        solde: 45, autorisation: 0,
        creditAttendu: { libelle: "Rémunération d'alternance", montant: 1150, dansJours: 21 },
        debiteurDepuis: null
      },
      operations: [
        { id: "o1", type: "carte", libelle: "Restaurant Chez Mamie – Paris 11e", detail: "Paiement par carte autorisé le {date}", joursAvant: 1, montant: 62,
          attendu: "payer",
          explication: "L'ordre de paiement par carte est irrévocable (art. L133-8 du Code monétaire et financier) : on valide, même si le compte passe à −17 € et à l'état des débiteurs." },
        { id: "o2", type: "cheque", libelle: "Association Les Foulées – cotisation", detail: "Chèque n° 2290317, émis le {date}", joursAvant: 3, montant: 40,
          attendu: "rejeter",
          explication: "Le compte est déjà à l'état des débiteurs à cause de la carte. Pas d'autorisation, note C, un rejet récent et aucun crédit avant 3 semaines : on ne creuse pas le débit. Le chèque dépasse 15 €, il peut être refusé." }
      ],
      antecedents: [
        { type: "prelevement", montant: 24.5, joursAvant: 150, libelle: "Abonnement salle de sport" }
      ],
      retenir: [
        "La carte se valide toujours : c'est l'ordre irrévocable du client.",
        "Le chèque ou le prélèvement qui suit peut être rejeté : le conseiller décide.",
        "Frais de rejet d'un chèque de 50 € ou moins : 30 € (art. D131-25 du CMF)."
      ],
      argumentaire: [
        "Carte irrévocable : solde de −17 €, état des débiteurs",
        "Pas d'autorisation, note C, 1 rejet sur 12 mois",
        "Aucun crédit attendu avant 21 jours",
        "Chèque de 40 € (plus de 15 €) : rejet possible, frais de 30 €"
      ]
    },

    {
      objectif: "Décider de tolérer un dépassement ponctuel pour un très bon client.",
      opportunite: { type: "decouvert",
        explication: "Cliente de note A, 15 ans d'ancienneté, salaire de 3 600 €, mais aucune autorisation : elle passe à −140 € sans découvert. Une autorisation adaptée lui évite l'état des débiteurs." },
      client: {
        civilite: "Mme", prenom: "Sophie", nom: "ROUX", age: 45,
        profession: "Directrice commerciale", situation: "Mariée, 1 enfant",
        ancienneteAns: 15, revenus: 3600, revenusNote: "salaire domicilié",
        produits: ["Compte courant", "Carte Visa Premier", "Assurance-vie", "Plan d'épargne logement", "Assurance habitation GS Habitat", "Assurance automobile GS Auto"],
        fragile: false, compte: "00231 905 3310"
      },
      note: "A",
      position: {
        solde: 120, autorisation: 0,
        creditAttendu: { libelle: "Salaire", montant: 3600, dansJours: 2 },
        debiteurDepuis: null
      },
      operations: [
        { id: "o1", type: "cheque", libelle: "Menuiserie Fabre – acompte travaux", detail: "Chèque n° 5518460, émis le {date}", joursAvant: 4, montant: 260,
          attendu: "payer", tolerance: true,
          explication: "Le chèque laisse le compte à −140 € sans autorisation : c'est l'état des débiteurs. Mais note A, aucun incident en 15 ans et salaire de 3 600 € dans 2 jours : on tolère ce passage." }
      ],
      antecedents: [],
      retenir: [
        "Passer à l'état des débiteurs n'oblige pas à rejeter : le conseiller apprécie le risque.",
        "Note A, aucun antécédent et crédit imminent : la tolérance se justifie. Une commission d'intervention peut s'appliquer (8 € par opération et 80 € par mois au maximum)."
      ],
      argumentaire: [
        "Solde projeté de −140 € sans autorisation : état des débiteurs",
        "Note A et aucun rejet sur 12 mois",
        "Salaire de 3 600 € attendu dans 2 jours",
        "Un rejet exposerait la cliente à des frais et, faute de régularisation, à une lettre d'injonction puis à une interdiction d'émettre des chèques, alors que son salaire arrive dans 2 jours"
      ]
    },

    {
      objectif: "Détecter un besoin de découvert chez un client qui passe en débit chaque mois avant son salaire.",
      opportunite: { type: "decouvert",
        explication: "Le compte passe à découvert chaque mois avant le salaire alors qu'il n'a aucune autorisation ; note B, salaire régulier de 1 850 € : mise en place d'un découvert." },
      client: {
        civilite: "M.", prenom: "Nicolas", nom: "CARON", age: 33,
        profession: "Aide-comptable (CDI)", situation: "Célibataire",
        ancienneteAns: 4, revenus: 1850, revenusNote: "salaire domicilié",
        produits: ["Compte courant", "Carte Visa Classic"],
        fragile: false, compte: "00927 164 0358"
      },
      observations: ["Le compte passe à découvert chaque mois, quelques jours avant le salaire"],
      note: "B",
      position: {
        solde: 25, autorisation: 0,
        creditAttendu: { libelle: "Salaire", montant: 1850, dansJours: 3 },
        debiteurDepuis: null
      },
      operations: [
        { id: "o1", type: "carte", libelle: "Boulangerie Les Délices – Paris 7e", detail: "Paiement par carte autorisé le {date}", joursAvant: 1, montant: 14.5,
          attendu: "payer",
          explication: "Une opération par carte se valide toujours. Le solde passe à 10,50 €." },
        { id: "o2", type: "prelevement", libelle: "Salle de sport Énergie – abonnement", detail: "Prélèvement SEPA, mandat n° SE-72045, présenté le {date}", joursAvant: 0, montant: 39.9,
          attendu: "payer", tolerance: true,
          explication: "Le solde passe à −29,40 € sans autorisation : état des débiteurs. Mais note B, un seul rejet ancien et un salaire de 1 850 € dans 3 jours : on tolère. Ce paiement en irrégularité donne lieu à une commission d'intervention de 8 € (80 € par mois au maximum)." }
      ],
      antecedents: [
        { type: "prelevement", montant: 38, joursAvant: 250, libelle: "Abonnement presse" }
      ],
      retenir: [
        "Un client sain qui passe à découvert chaque mois sans autorisation paie des commissions que l'on peut éviter.",
        "Revenus réguliers, note B, aucun rejet récent : mise en place d'un découvert."
      ],
      argumentaire: [
        "Solde de −29,40 € sans autorisation, salaire dans 3 jours",
        "Note B et un seul rejet ancien",
        "Passage à découvert chaque mois avant le salaire",
        "Opportunité : mise en place d'un découvert"
      ]
    },

    {
      objectif: "Tirer parti de rejets anciens dus à l'absence d'autorisation pour proposer un découvert.",
      opportunite: { type: "decouvert",
        explication: "Deux rejets sur les 12 derniers mois faute d'autorisation, salaire régulier de 1 900 €, note B : mise en place d'un découvert." },
      client: {
        civilite: "Mme", prenom: "Laura", nom: "GAUTHIER", age: 26,
        profession: "Éducatrice spécialisée (CDI)", situation: "Célibataire",
        ancienneteAns: 3, revenus: 1900, revenusNote: "salaire domicilié",
        produits: ["Compte courant", "Carte Visa Classic"],
        fragile: false, compte: "00346 827 9915"
      },
      observations: ["Deux rejets sur les 12 derniers mois faute d'autorisation de découvert, tous deux de plus de 7 mois"],
      note: "B",
      position: {
        solde: 240, autorisation: 0,
        creditAttendu: { libelle: "Salaire", montant: 1900, dansJours: 13 },
        debiteurDepuis: null
      },
      operations: [
        { id: "o1", type: "carte", libelle: "Supermarché Primeur & Co – Paris", detail: "Paiement par carte autorisé le {date}", joursAvant: 1, montant: 35,
          attendu: "payer",
          explication: "Une opération par carte se valide toujours. Le solde passe à 205 €." },
        { id: "o2", type: "cheque", libelle: "Garage du Marais – entretien", detail: "Chèque n° 5207316, émis le {date}", joursAvant: 3, montant: 120,
          attendu: "payer",
          explication: "Après ce chèque, le solde est de 85 € : le compte reste créditeur." },
        { id: "o3", type: "prelevement", libelle: "Assurances Mutuelle Nord – habitation", detail: "Prélèvement SEPA, mandat n° MN-33810, présenté le {date}", joursAvant: 0, montant: 160,
          attendu: "payer", acceptable: "rejeter", tolerance: true,
          explication: "Le solde passerait à −75 € sans autorisation : état des débiteurs. Note B, rejets anciens (plus de 7 mois), salaire de 1 900 € dans 13 jours et dépassement faible : on paie. Le rejet reste défendable. Frais de rejet : 20 € au maximum." }
      ],
      antecedents: [
        { type: "prelevement", montant: 55, joursAvant: 230, libelle: "Assurance auto" },
        { type: "cheque", montant: 90, joursAvant: 320, libelle: "Association sportive" }
      ],
      retenir: [
        "Des rejets répétés faute d'autorisation, chez un client sain aux revenus réguliers, justifient de proposer un découvert.",
        "Un dépassement faible et un salaire proche permettent de tolérer le paiement."
      ],
      argumentaire: [
        "Solde de −75 € sans autorisation : état des débiteurs",
        "Note B, 2 rejets sur 12 mois, tous anciens",
        "Salaire de 1 900 € attendu dans 13 jours",
        "Opportunité : mise en place d'un découvert"
      ]
    },

    {
      objectif: "Le cumul des opérations fait basculer le compte : l'ordre de traitement compte.",
      opportunite: { type: null,
        explication: "Note C, 2 rejets sur 12 mois et autorisation de 100 € seulement : aucune proposition commerciale." },
      client: {
        civilite: "Mme", prenom: "Émilie", nom: "BERNARD", age: 27,
        profession: "Vendeuse (CDI)", situation: "Célibataire",
        ancienneteAns: 2, revenus: 1480, revenusNote: "salaire domicilié",
        produits: ["Compte courant", "Carte Visa Classic", "Autorisation de découvert"],
        fragile: false, compte: "00923 148 5576"
      },
      note: "C",
      position: {
        solde: 380, autorisation: 100,
        creditAttendu: { libelle: "Salaire", montant: 1480, dansJours: 20 },
        debiteurDepuis: null
      },
      operations: [
        { id: "o1", type: "carte", libelle: "Boutique Mode & Co – Paris", detail: "Paiement par carte autorisé le {date}", joursAvant: 1, montant: 59,
          attendu: "payer",
          explication: "Une opération par carte se valide toujours. Le solde passe à 321 €." },
        { id: "o2", type: "cheque", libelle: "Garage Rapide – vidange", detail: "Chèque n° 4408213, émis le {date}", joursAvant: 3, montant: 140,
          attendu: "payer",
          explication: "Après ce chèque, le solde est de 181 € : le compte reste créditeur." },
        { id: "o3", type: "prelevement", libelle: "Électricité Verte – facture", detail: "Prélèvement SEPA, mandat n° EV-25518, présenté le {date}", joursAvant: 0, montant: 210,
          attendu: "payer",
          explication: "Le solde passe à −29 €, dans les 100 € d'autorisation : le compte est débiteur mais pas à l'état des débiteurs. On paie." },
        { id: "o4", type: "cheque", libelle: "Centre de formation Valmy – inscription", detail: "Chèque n° 4408301, émis le {date}", joursAvant: 1, montant: 120,
          attendu: "rejeter",
          explication: "Pris seul, ce chèque passerait : la provision totale est de 480 €. Mais après les opérations précédentes, le solde passerait à −149 € pour 100 € d'autorisation, soit un dépassement de 49 €. Note C, 2 rejets sur 12 mois et salaire dans 20 jours : on rejette. Frais de rejet : 50 € (chèque de plus de 50 €)." }
      ],
      antecedents: [
        { type: "cheque", montant: 75, joursAvant: 71, libelle: "Opticien" },
        { type: "prelevement", montant: 32, joursAvant: 200, libelle: "Abonnement streaming" }
      ],
      retenir: [
        "Une opération se juge avec le solde qui reste après les précédentes : chacune peut passer seule, et le cumul fait basculer.",
        "Dans l'autorisation, on paie. C'est la dernière opération, celle qui provoque le dépassement, qui se décide."
      ],
      argumentaire: [
        "Solde de −29 € après le prélèvement, dans l'autorisation de 100 €",
        "Chèque : solde de −149 €, dépassement de 49 €",
        "Note C et 2 rejets sur 12 mois",
        "Salaire attendu seulement dans 20 jours"
      ]
    },

    {
      objectif: "Tolérer un paiement quand le crédit arrive demain.",
      opportunite: { type: "decouvert",
        explication: "Client de note B, 12 ans d'ancienneté et salaire de 2 650 €, sans aucune autorisation : il passe à l'état des débiteurs avant le salaire. Une autorisation de découvert sécurise ses fins de mois." },
      client: {
        civilite: "M.", prenom: "Rémi", nom: "DUMAS", age: 47,
        profession: "Chef d'équipe (BTP)", situation: "Marié, 3 enfants",
        ancienneteAns: 12, revenus: 2650, revenusNote: "salaire domicilié",
        produits: ["Compte courant", "Carte Visa Premier", "Assurance habitation"],
        fragile: false, compte: "00608 377 4915"
      },
      note: "B",
      position: {
        solde: -60, autorisation: 0,
        creditAttendu: { libelle: "Salaire", montant: 2650, dansJours: 1 },
        debiteurDepuis: 2
      },
      operations: [
        { id: "o1", type: "carte", libelle: "Station Relais Est – carburant", detail: "Paiement par carte autorisé le {date}", joursAvant: 1, montant: 41,
          attendu: "payer",
          explication: "La carte se valide toujours, même sur un compte déjà à l'état des débiteurs. Le solde passe à −101 €." },
        { id: "o2", type: "prelevement", libelle: "Immobilière du Parc – loyer", detail: "Prélèvement SEPA, mandat n° IP-40716, présenté le {date}", joursAvant: 0, montant: 780,
          attendu: "payer", tolerance: true,
          explication: "Le compte passerait à −881 € sans autorisation. Mais note B, un seul rejet ancien, 12 ans de relation et un salaire de 2 650 € crédité demain, qui couvre largement le loyer : on tolère. Ce paiement en irrégularité donne lieu à une commission d'intervention de 8 €, comme la carte payée juste avant : 16 € au total (80 € par mois au maximum)." }
      ],
      antecedents: [
        { type: "prelevement", montant: 33, joursAvant: 280, libelle: "Abonnement internet" }
      ],
      retenir: [
        "Un crédit certain et très proche (demain) peut justifier la tolérance, surtout pour un client de note B et sans incident récent.",
        "Le paiement en irrégularité n'est pas gratuit : commission d'intervention de 8 € par opération, 80 € par mois au maximum."
      ],
      argumentaire: [
        "Solde de −881 € sans autorisation : état des débiteurs",
        "Salaire de 2 650 € crédité demain",
        "Note B, un seul rejet ancien, 12 ans de relation",
        "Commissions d'intervention : 8 € pour la carte et 8 € pour le loyer, soit 16 €"
      ]
    },

    {
      objectif: "Détecter qu'un découvert utilisé presque en permanence relève plutôt d'un crédit consommation.",
      opportunite: { type: "credit",
        explication: "Compte débiteur dans l'autorisation la plus grande partie de chaque mois depuis plus de 6 mois (−640 € pour 800 € aujourd'hui), salaire régulier de 1 950 €, note B : un crédit consommation permet de structurer ce besoin de trésorerie permanent." },
      client: {
        civilite: "M.", prenom: "Damien", nom: "COLLET", age: 40,
        profession: "Technicien (CDI)", situation: "Marié, 2 enfants",
        ancienneteAns: 9, revenus: 1950, revenusNote: "salaire domicilié",
        produits: ["Compte courant", "Carte Visa Classic", "Livret A", "Autorisation de découvert"],
        fragile: false, compte: "00871 305 4427"
      },
      observations: ["Compte débiteur dans l'autorisation la plus grande partie de chaque mois, depuis plus de 6 mois"],
      note: "B",
      position: {
        solde: -640, autorisation: 800,
        creditAttendu: { libelle: "Salaire", montant: 1950, dansJours: 10 },
        debiteurDepuis: null
      },
      operations: [
        { id: "o1", type: "carte", libelle: "Hypermarché Grand Marché – Paris", detail: "Paiement par carte autorisé le {date}", joursAvant: 1, montant: 85,
          attendu: "payer",
          explication: "Une opération par carte se valide toujours. Le solde passe à −725 €, dans l'autorisation." },
        { id: "o2", type: "prelevement", libelle: "Électricité Verte – facture", detail: "Prélèvement SEPA, mandat n° EV-83019, présenté le {date}", joursAvant: 0, montant: 70,
          attendu: "payer",
          explication: "Le solde passe à −795 € pour 800 € d'autorisation : le compte reste dans l'autorisation, on paie." },
        { id: "o3", type: "cheque", libelle: "Centre de loisirs – stage des enfants", detail: "Chèque n° 7021458, émis le {date}", joursAvant: 2, montant: 150,
          attendu: "payer", acceptable: "rejeter", tolerance: true,
          explication: "Le solde passerait à −945 € : dépassement de 145 € au-delà de l'autorisation. Note B, aucun rejet et salaire de 1 950 € dans 10 jours : on paie. Le rejet reste défendable, car le compte est déjà à la limite de son autorisation. Frais de rejet : 50 € (chèque de plus de 50 €)." }
      ],
      antecedents: [],
      retenir: [
        "Un client sain qui vit durablement dans son autorisation de découvert a un besoin de trésorerie permanent : un crédit consommation permet de le structurer.",
        "Le salaire proche et le faible dépassement permettent de tolérer le chèque."
      ],
      argumentaire: [
        "Solde de −945 € pour 800 € d'autorisation : dépassement de 145 €",
        "Note B, aucun rejet, 9 ans d'ancienneté",
        "Salaire de 1 950 € attendu dans 10 jours",
        "Opportunité : crédit consommation pour un besoin de trésorerie permanent"
      ]
    },

    {
      objectif: "Repérer un projet d'équipement à financer par un crédit consommation, sans payer tous les chèques.",
      opportunite: { type: "credit",
        explication: "Projet d'équipement de la maison (cuisine et électroménager), salaire régulier de 1 950 €, note B et aucun rejet : un crédit consommation peut financer ces achats." },
      client: {
        civilite: "Mme", prenom: "Élodie", nom: "PICARD", age: 37,
        profession: "Professeure des écoles", situation: "Mariée, 2 enfants",
        ancienneteAns: 8, revenus: 1950, revenusNote: "salaire domicilié",
        produits: ["Compte courant", "Carte Visa Classic", "Livret A"],
        fragile: false, compte: "00734 590 1862"
      },
      observations: ["Souhaite équiper sa maison : cuisine et électroménager"],
      note: "B",
      position: {
        solde: 1650, autorisation: 0,
        creditAttendu: { libelle: "Salaire", montant: 1950, dansJours: 17 },
        debiteurDepuis: null
      },
      operations: [
        { id: "o1", type: "cheque", libelle: "Cuisines Équipées Plus – acompte", detail: "Chèque n° 2290731, émis le {date}", joursAvant: 2, montant: 1400,
          attendu: "payer",
          explication: "Après cet acompte, le solde est de 250 € : le compte reste créditeur." },
        { id: "o2", type: "cheque", libelle: "Électro Dépôt – lave-linge", detail: "Chèque n° 2290732, émis le {date}", joursAvant: 1, montant: 480,
          attendu: "rejeter", acceptable: "payer",
          explication: "Le solde passerait à −230 € sans autorisation, et le salaire n'arrive que dans 17 jours : on rejette, après information de la cliente. Payer reste défendable (note B, aucun rejet). Frais de rejet : 50 € (chèque de plus de 50 €)." }
      ],
      antecedents: [],
      retenir: [
        "Des achats importants et enchaînés montrent un besoin de financement : un crédit consommation permet d'étaler la dépense.",
        "Rejeter le chèque qui crée le dépassement, puis proposer la solution de financement, est une pratique possible."
      ],
      argumentaire: [
        "Solde de −230 € sans autorisation si le chèque était payé",
        "Salaire de 1 950 € attendu seulement dans 17 jours",
        "Note B, aucun rejet, 8 ans d'ancienneté",
        "Opportunité : crédit consommation pour financer l'équipement"
      ]
    },

    {
      objectif: "Peser une décision nuancée : dépassement faible, cliente fragile, crédit imminent.",
      opportunite: { type: null,
        explication: "Cliente titulaire de l'offre clientèle fragile (OCF), note C : on ne propose ni découvert ni crédit." },
      client: {
        civilite: "Mme", prenom: "Aïcha", nom: "BENSAÏD", age: 52,
        profession: "Aide à domicile (temps partiel)", situation: "Divorcée, 2 enfants",
        ancienneteAns: 11, revenus: 1250, revenusNote: "salaire domicilié",
        produits: ["Compte courant", "Offre clientèle fragile (OCF)", "Carte à autorisation systématique", "Livret A", "Autorisation de découvert"],
        fragile: true, compte: "00372 518 9046"
      },
      note: "C",
      position: {
        solde: 95, autorisation: 150,
        creditAttendu: { libelle: "Salaire", montant: 1250, dansJours: 4 },
        debiteurDepuis: null
      },
      operations: [
        { id: "o1", type: "prelevement", libelle: "Énergie Citoyenne – électricité", detail: "Prélèvement SEPA, mandat n° EC-45012, présenté le {date}", joursAvant: 0, montant: 180,
          attendu: "payer",
          explication: "Après ce prélèvement, le solde est de −85 € pour 150 € d'autorisation : le compte reste dans l'autorisation, on paie." },
        { id: "o2", type: "cheque", libelle: "Centre de loisirs municipal – séjour enfants", detail: "Chèque n° 3307751, émis le {date}", joursAvant: 3, montant: 120,
          attendu: "payer", acceptable: "rejeter", tolerance: true,
          explication: "Le solde passe à −205 € : dépassement de 55 € au-delà de l'autorisation. Le salaire arrive dans 4 jours et le dépassement est faible : on paie plutôt que de déclencher un incident de chèque pour une cliente en situation de fragilité financière. Le rejet reste défendable (note C, 2 rejets sur 12 mois)." }
      ],
      antecedents: [
        { type: "prelevement", montant: 60, joursAvant: 57, libelle: "Assurance habitation" },
        { type: "prelevement", montant: 45, joursAvant: 190, libelle: "Cantine scolaire" }
      ],
      retenir: [
        "Cas limite : deux décisions peuvent se défendre, c'est l'argumentation qui compte.",
        "Pour un client titulaire de l'offre clientèle fragile (OCF), la commission d'intervention est de 4 € par opération (20 € par mois au maximum) et l'ensemble des frais d'incidents est plafonné à 20 € par mois."
      ],
      argumentaire: [
        "Prélèvement dans l'autorisation (−85 € pour 150 €)",
        "Chèque : dépassement de 55 € seulement",
        "Salaire de 1 250 € attendu dans 4 jours",
        "Cliente fragile, note C, 2 rejets sur 12 mois : arbitrage argumenté"
      ]
    },

    {
      objectif: "Décider pour une cliente OCF (offre clientèle fragile), dont les frais d'incidents sont plafonnés.",
      opportunite: { type: null,
        explication: "Cliente titulaire de l'offre clientèle fragile (OCF), revenus de 980 € et note C : on ne propose ni découvert ni crédit." },
      client: {
        civilite: "Mme", prenom: "Martine", nom: "GILLES", age: 58,
        profession: "Agent d'entretien (temps partiel)", situation: "Divorcée",
        ancienneteAns: 17, revenus: 980, revenusNote: "salaire et prime d'activité",
        produits: ["Compte courant", "Offre clientèle fragile (OCF)", "Carte à autorisation systématique", "Livret A"],
        fragile: true, compte: "00182 759 2204"
      },
      note: "C",
      position: {
        solde: 40, autorisation: 0,
        creditAttendu: { libelle: "Salaire et prime d'activité", montant: 980, dansJours: 6 },
        debiteurDepuis: null
      },
      operations: [
        { id: "o1", type: "carte", libelle: "Marché Frais – Paris", detail: "Paiement par carte autorisé le {date}", joursAvant: 1, montant: 36,
          attendu: "payer",
          explication: "Une opération par carte se valide toujours. Le solde passe de 40 € à 4 €." },
        { id: "o2", type: "prelevement", libelle: "Énergie Citoyenne – électricité", detail: "Prélèvement SEPA, mandat n° EC-71190, présenté le {date}", joursAvant: 0, montant: 58,
          attendu: "payer", acceptable: "rejeter", tolerance: true,
          explication: "Le solde passe à −54 € sans autorisation : état des débiteurs. Le salaire arrive dans 6 jours et il s'agit d'une facture d'énergie : on paie. Cliente titulaire de l'offre clientèle fragile (OCF) : la commission d'intervention est de 4 € par opération et l'ensemble de ses frais d'incidents est plafonné à 20 € par mois, que l'on paie ou que l'on rejette. Le rejet reste défendable (note C, 2 rejets sur 12 mois)." },
        { id: "o3", type: "cheque", libelle: "Pharmacie du Centre", detail: "Chèque n° 5560193, émis le {date}", joursAvant: 2, montant: 22,
          attendu: "payer", tolerance: true,
          explication: "Le chèque dépasse 15 € : il pourrait être refusé. Mais il laisse le compte à −76 € avec un salaire dans 6 jours, et un rejet coûterait jusqu'à 20 € de frais (plafond de l'offre clientèle fragile) pour un chèque de 22 € : on paie." }
      ],
      antecedents: [
        { type: "prelevement", montant: 31.5, joursAvant: 85, libelle: "Mutuelle Santé Plus" },
        { type: "cheque", montant: 40, joursAvant: 230, libelle: "Association de quartier" }
      ],
      retenir: [
        "Offre clientèle fragile (OCF) : commission d'intervention de 4 € par opération (20 € par mois au maximum) et ensemble des frais d'incidents plafonné à 20 € par mois.",
        "Pour une cliente OCF, les frais d'incidents sont plafonnés à 20 € par mois : rejeter un chèque de 22 € peut lui coûter presque autant que le chèque lui-même."
      ],
      argumentaire: [
        "Cliente OCF : frais d'incidents plafonnés à 20 € par mois",
        "Solde de −76 € sans autorisation, salaire dans 6 jours",
        "Note C et 2 rejets sur 12 mois",
        "Facture d'énergie et chèque de pharmacie : opérations courantes"
      ]
    },

    {
      objectif: "Un client en droit au compte (DAC) : services bancaires de base, carte à autorisation systématique, ni découvert ni chéquier.",
      opportunite: { type: null,
        explication: "Droit au compte (DAC) : les services bancaires de base n'incluent ni découvert ni chéquier, et la carte est à autorisation systématique. Le compte vient d'être ouvert : on s'en tient à ces services." },
      client: {
        civilite: "M.", prenom: "Éric", nom: "ROBIN", age: 51,
        profession: "Livreur (indépendant)", situation: "Divorcé",
        ancienneteAns: 0, ancienneteMois: 3, revenus: 1100, revenusNote: "variables",
        produits: ["Services bancaires de base", "Carte à autorisation systématique"],
        fragile: false, dac: true, compte: "00461 983 2205"
      },
      note: "C",
      position: {
        solde: 320, autorisation: 0,
        creditAttendu: null,
        debiteurDepuis: null
      },
      operations: [
        { id: "o1", type: "carte", libelle: "Station Relais Sud – carburant", detail: "Paiement par carte à autorisation systématique : solde vérifié le {date}", joursAvant: 1, montant: 47,
          attendu: "payer",
          explication: "La carte est à autorisation systématique : le solde est vérifié à chaque paiement, la carte ne peut pas rendre le compte débiteur. Elle se valide." },
        { id: "o2", type: "prelevement", libelle: "Mobilis – forfait", detail: "Prélèvement SEPA, mandat n° MB-20118, présenté le {date}", joursAvant: 0, montant: 19.99,
          attendu: "payer",
          explication: "Provision suffisante : le solde est de 253,01 € après ce prélèvement. On paie." },
        { id: "o3", type: "prelevement", libelle: "Immobilière du Marais – loyer", detail: "Prélèvement SEPA, mandat n° IM-48832, présenté le {date}", joursAvant: 0, montant: 480,
          attendu: "rejeter",
          explication: "Le solde passerait à −226,99 €. Les services bancaires de base n'incluent pas d'autorisation de découvert, le compte est récent et aucun crédit n'est attendu : on rejette. Frais de rejet : 20 € au maximum." }
      ],
      antecedents: [],
      retenir: [
        "DAC : la banque désignée au titre du droit au compte fournit les services bancaires de base, dont une carte à autorisation systématique. Ils n'incluent ni chéquier ni autorisation de découvert.",
        "Avec une carte à autorisation systématique, le débit vient des prélèvements, pas de la carte : ce sont eux qui se décident."
      ],
      argumentaire: [
        "Client en droit au compte (DAC) : services bancaires de base",
        "Carte à autorisation systématique : le solde est vérifié",
        "Prélèvement de loyer : solde de −226,99 €, aucune autorisation",
        "Aucune opportunité : ni découvert ni chéquier dans les services de base"
      ]
    },

    {
      objectif: "Le montant du dépassement compte autant que la note.",
      opportunite: { type: "credit",
        explication: "Besoin de financement de 4 800 € pour un véhicule, soit plus d'un mois et demi de salaire, avec une note B et aucun rejet : un crédit consommation est plus adapté qu'un découvert." },
      client: {
        civilite: "M.", prenom: "Olivier", nom: "PETIT", age: 38,
        profession: "Ingénieur", situation: "Marié, 1 enfant",
        ancienneteAns: 6, revenus: 2900, revenusNote: "salaire domicilié",
        produits: ["Compte courant", "Carte Visa Premier", "Livret A"],
        fragile: false, compte: "00845 203 7714"
      },
      note: "B",
      position: {
        solde: 300, autorisation: 0,
        creditAttendu: { libelle: "Salaire", montant: 2900, dansJours: 12 },
        debiteurDepuis: null
      },
      operations: [
        { id: "o1", type: "cheque", libelle: "Garage du Parc – véhicule d'occasion", detail: "Chèque n° 8814402, émis le {date}", joursAvant: 1, montant: 4800,
          attendu: "rejeter",
          explication: "Le compte passerait à −4 500 € sans autorisation, soit plus d'un mois et demi de revenus. Le salaire attendu ne suffirait pas (300 € + 2 900 € = 3 200 € pour un chèque de 4 800 €). Malgré une bonne note, le dépassement est disproportionné : rejet, après information du client." }
      ],
      antecedents: [],
      retenir: [
        "Une bonne note ne justifie pas de tout payer : comparer le dépassement aux revenus et au crédit attendu.",
        "Avant de rejeter un chèque sans provision, la banque informe le titulaire des conséquences et l'invite à approvisionner son compte (en pratique, 24 à 48 heures). Frais : 50 € pour un chèque de plus de 50 €.",
        "Piste commerciale : proposer un crédit consommation adapté (onglet Opportunité commerciale)."
      ],
      argumentaire: [
        "Solde projeté de −4 500 € sans autorisation",
        "Dépassement supérieur à 1,5 mois de revenus ; salaire attendu insuffisant (3 200 € pour 4 800 €)",
        "Note B et aucun rejet, mais montant disproportionné",
        "Information préalable du client, puis rejet ; piste commerciale : crédit"
      ]
    },

    {
      objectif: "Apprécier le risque d'un client dont les revenus sont variables et sans crédit programmé.",
      opportunite: { type: null,
        explication: "Revenus variables, note C, 2 rejets sur 12 mois et aucun crédit programmé : pas de proposition commerciale." },
      client: {
        civilite: "M.", prenom: "Hakim", nom: "FAURE", age: 35,
        profession: "Chauffeur VTC (indépendant)", situation: "Pacsé",
        ancienneteAns: 2, revenus: 1700, revenusNote: "variables, moyenne sur 6 mois",
        produits: ["Compte courant", "Carte Visa Classic", "Autorisation de découvert"],
        fragile: false, compte: "00376 482 9051"
      },
      note: "C",
      position: {
        solde: 210, autorisation: 150,
        creditAttendu: null,
        debiteurDepuis: null
      },
      operations: [
        { id: "o1", type: "prelevement", libelle: "URSSAF – cotisations", detail: "Prélèvement SEPA, mandat n° UR-18830, présenté le {date}", joursAvant: 0, montant: 300,
          attendu: "payer",
          explication: "Après ce prélèvement, le solde est de −90 € pour 150 € d'autorisation : le compte est débiteur mais dans l'autorisation. On paie." },
        { id: "o2", type: "cheque", libelle: "Garage Auto Plus – réparation", detail: "Chèque n° 6602741, émis le {date}", joursAvant: 2, montant: 240,
          attendu: "rejeter",
          explication: "Le solde passerait à −330 € : dépassement de 180 €. Revenus variables, aucun crédit programmé, note C et 2 rejets sur 12 mois : rien ne garantit le retour à une position régulière. On rejette. Frais de rejet : 50 € (chèque de plus de 50 €)." }
      ],
      antecedents: [
        { type: "prelevement", montant: 85, joursAvant: 90, libelle: "Assurance véhicule" },
        { type: "cheque", montant: 120, joursAvant: 240, libelle: "Concessionnaire" }
      ],
      retenir: [
        "Sans crédit programmé, il faut regarder la régularité des revenus : pour un indépendant, elle est moins certaine que pour un salarié.",
        "Le prélèvement qui reste dans l'autorisation se paie ; c'est le chèque suivant qui fait basculer le compte."
      ],
      argumentaire: [
        "Prélèvement : −90 € pour 150 € d'autorisation, on paie",
        "Chèque : dépassement de 180 €",
        "Revenus variables et aucun crédit programmé",
        "Note C et 2 rejets sur 12 mois"
      ]
    },

    {
      objectif: "Un client fiché au FICP (FCP) : la règle payer ou rejeter ne change pas, mais aucun crédit ne se propose.",
      opportunite: { type: null,
        explication: "Client fiché FICP (FCP) : la banque consulte le fichier avant tout crédit et l'inscription pèse lourdement dans la décision. On ne propose ni crédit consommation ni découvert." },
      client: {
        civilite: "M.", prenom: "Yannick", nom: "MARTINEZ", age: 43,
        profession: "Manutentionnaire (CDI)", situation: "Marié, 1 enfant",
        ancienneteAns: 6, revenus: 1650, revenusNote: "salaire domicilié",
        produits: ["Compte courant", "Carte Visa Classic", "Crédit à la consommation (incident de remboursement)"],
        fragile: false, ficp: true, compte: "00298 436 7701"
      },
      note: "D",
      position: {
        solde: 130, autorisation: 0,
        creditAttendu: { libelle: "Salaire", montant: 1650, dansJours: 11 },
        debiteurDepuis: null
      },
      operations: [
        { id: "o1", type: "carte", libelle: "Supermarché Marché Plus – Paris", detail: "Paiement par carte autorisé le {date}", joursAvant: 1, montant: 52,
          attendu: "payer",
          explication: "Une opération par carte se valide toujours. Le solde passe à 78 €." },
        { id: "o2", type: "prelevement", libelle: "Électricité Verte – facture", detail: "Prélèvement SEPA, mandat n° EV-55218, présenté le {date}", joursAvant: 0, montant: 65,
          attendu: "payer",
          explication: "Le fichage FICP ne change pas la règle : la provision est suffisante (il reste 13 € après ce prélèvement), on paie." },
        { id: "o3", type: "cheque", libelle: "Garage Occitan – réparation", detail: "Chèque n° 9015567, émis le {date}", joursAvant: 2, montant: 90,
          attendu: "rejeter",
          explication: "Le solde passerait à −77 € sans autorisation. Note D, client fiché FICP, 3 rejets sur 12 mois et salaire dans 11 jours seulement : on rejette. Frais de rejet : 50 € (chèque de plus de 50 €)." }
      ],
      antecedents: [
        { type: "prelevement", montant: 120, joursAvant: 50, libelle: "Conso Crédit – mensualité" },
        { type: "prelevement", montant: 120, joursAvant: 100, libelle: "Conso Crédit – mensualité" },
        { type: "cheque", montant: 60, joursAvant: 200, libelle: "Garage du Centre" }
      ],
      retenir: [
        "FCP : le client est fiché au FICP après des incidents de remboursement de crédit. Cela n'interdit ni le chéquier ni la carte, et la règle payer ou rejeter ne change pas.",
        "La banque consulte le FICP avant d'accorder un crédit, et l'inscription pèse lourdement dans sa décision : on ne propose ni crédit consommation ni découvert."
      ],
      argumentaire: [
        "Client fiché FICP (FCP) : incidents de remboursement de crédit",
        "Note D et 3 rejets sur 12 mois, dont 2 mensualités de crédit",
        "Chèque : solde de −77 € sans autorisation, salaire dans 11 jours",
        "Aucune opportunité : pas de crédit ni de découvert pour un client fiché"
      ]
    },

    {
      objectif: "Refuser d'aggraver une position déjà dégradée.",
      opportunite: { type: null,
        explication: "Note E, 5 rejets sur 12 mois et compte à l'état des débiteurs : aucune proposition commerciale." },
      client: {
        civilite: "M.", prenom: "Julien", nom: "MOREAU", age: 36,
        profession: "Intérimaire (missions irrégulières)", situation: "Célibataire",
        ancienneteAns: 2, revenus: 1300, revenusNote: "irréguliers, moyenne sur 6 mois",
        produits: ["Compte courant", "Carte Visa Classic", "Autorisation de découvert"],
        fragile: false, compte: "00903 677 1352"
      },
      note: "E",
      position: {
        solde: -310, autorisation: 200,
        creditAttendu: null,
        debiteurDepuis: 12
      },
      operations: [
        { id: "o1", type: "carte", libelle: "Station Voltaire – carburant", detail: "Paiement par carte autorisé le {date}", joursAvant: 1, montant: 28,
          attendu: "payer",
          explication: "La carte se valide toujours, même sur un compte déjà à l'état des débiteurs." },
        { id: "o2", type: "prelevement", libelle: "FINACRED – mensualité de crédit", detail: "Prélèvement SEPA, mandat n° FC-77302, présenté le {date}", joursAvant: 0, montant: 450,
          attendu: "rejeter",
          explication: "Compte à l'état des débiteurs depuis 12 jours, note E, 5 rejets sur 12 mois et aucun crédit prévu : payer 450 € aggraverait un risque déjà très élevé. Frais de rejet : 20 € au maximum." },
        { id: "o3", type: "cheque", libelle: "Garage Moderne – réparation", detail: "Chèque n° 4402718, émis le {date}", joursAvant: 2, montant: 85,
          attendu: "rejeter",
          explication: "Même raisonnement. Le chèque dépasse 15 € : il peut être refusé. Frais de rejet : 50 € (chèque de plus de 50 €)." }
      ],
      antecedents: [
        { type: "prelevement", montant: 450, joursAvant: 18, libelle: "FINACRED – mensualité de crédit" },
        { type: "prelevement", montant: 35, joursAvant: 48, libelle: "Assurance auto" },
        { type: "prelevement", montant: 450, joursAvant: 75, libelle: "FINACRED – mensualité de crédit" },
        { type: "prelevement", montant: 29.9, joursAvant: 130, libelle: "Opérateur mobile" },
        { type: "prelevement", montant: 35, joursAvant: 210, libelle: "Assurance auto" }
      ],
      retenir: [
        "Note E, antécédents répétés et aucun crédit attendu : on rejette ce qui peut l'être.",
        "La carte est validée même sur un compte déjà à l'état des débiteurs."
      ],
      argumentaire: [
        "Déjà à l'état des débiteurs : −310 € pour 200 € d'autorisation",
        "Note E, 5 rejets sur 12 mois",
        "Aucun crédit programmé (intérim)",
        "Carte validée, prélèvement et chèque rejetés"
      ]
    },

    {
      objectif: "Combiner carte, chèque de 15 € ou moins et frais de rejet d'un petit prélèvement.",
      opportunite: { type: null,
        explication: "Note D, 3 rejets sur 12 mois et compte à l'état des débiteurs : aucune proposition commerciale." },
      client: {
        civilite: "M.", prenom: "Mathieu", nom: "COLIN", age: 24,
        profession: "Serveur (CDD)", situation: "Célibataire",
        ancienneteAns: 2, revenus: 1250, revenusNote: "salaire domicilié",
        produits: ["Compte courant", "Carte Visa à débit immédiat"],
        fragile: false, compte: "00745 096 3318"
      },
      note: "D",
      position: {
        solde: 12, autorisation: 0,
        creditAttendu: { libelle: "Salaire", montant: 1250, dansJours: 15 },
        debiteurDepuis: null
      },
      operations: [
        { id: "o1", type: "carte", libelle: "Cinéma Le Rex – Paris 6e", detail: "Paiement par carte autorisé le {date}", joursAvant: 1, montant: 23,
          attendu: "payer",
          explication: "La carte se valide toujours : le solde passe à −11 € et le compte entre à l'état des débiteurs." },
        { id: "o2", type: "cheque", libelle: "Café de la Gare – ardoise", detail: "Chèque n° 7710482, émis le {date}", joursAvant: 4, montant: 9,
          attendu: "payer",
          explication: "Un chèque de 15 € ou moins ne peut pas être refusé, même sur un compte déjà à l'état des débiteurs. Le solde passe à −20 €." },
        { id: "o3", type: "prelevement", libelle: "Streamflix – abonnement", detail: "Prélèvement SEPA, mandat n° SF-90417, présenté le {date}", joursAvant: 0, montant: 13.99,
          attendu: "rejeter",
          explication: "Le compte est déjà à −20 € sans autorisation. Note D, 3 rejets sur 12 mois et salaire dans 15 jours : on rejette. Frais de rejet : 13,99 € seulement, car pour un prélèvement de moins de 20 € les frais ne peuvent pas dépasser le montant rejeté (art. D133-6 du CMF)." },
        { id: "o4", type: "cheque", libelle: "Auto-école Horizon", detail: "Chèque n° 7710577, émis le {date}", joursAvant: 2, montant: 65,
          attendu: "rejeter",
          explication: "Même raisonnement, et ce chèque dépasse 15 € : il peut être refusé. Frais de rejet : 50 € (chèque de plus de 50 €)." }
      ],
      antecedents: [
        { type: "prelevement", montant: 29.9, joursAvant: 46, libelle: "Salle de sport" },
        { type: "cheque", montant: 45, joursAvant: 110, libelle: "Association étudiante" },
        { type: "prelevement", montant: 15, joursAvant: 190, libelle: "Abonnement musique" }
      ],
      retenir: [
        "Carte et chèque de 15 € ou moins s'imposent au conseiller, même sur un compte déjà à l'état des débiteurs.",
        "Frais de rejet d'un prélèvement : 20 € au maximum, ou le montant du prélèvement s'il est inférieur à 20 €."
      ],
      argumentaire: [
        "Carte et chèque de 9 € : paiements obligatoires, solde de −20 €",
        "Déjà à l'état des débiteurs, sans autorisation",
        "Note D, 3 rejets sur 12 mois, salaire dans 15 jours",
        "Frais de rejet du prélèvement limités à 13,99 €"
      ]
    },

    {
      objectif: "Appliquer la règle du chèque de 15 € ou moins, même à un client de note E.",
      opportunite: { type: null,
        explication: "Note E, 4 rejets sur 12 mois et compte à l'état des débiteurs : aucune proposition commerciale." },
      client: {
        civilite: "M.", prenom: "Patrick", nom: "LEROY", age: 58,
        profession: "Demandeur d'emploi (ancien ouvrier)", situation: "Marié",
        ancienneteAns: 14, revenus: 1150, revenusNote: "allocation chômage",
        produits: ["Compte courant", "Carte Visa Classic", "Autorisation de découvert"],
        fragile: false, compte: "00219 654 7730"
      },
      note: "E",
      position: {
        solde: -240, autorisation: 150,
        creditAttendu: { libelle: "Allocation chômage", montant: 1150, dansJours: 12 },
        debiteurDepuis: 6
      },
      operations: [
        { id: "o1", type: "cheque", libelle: "Cantine municipale – régularisation", detail: "Chèque n° 2381176, émis le {date}", joursAvant: 3, montant: 14,
          attendu: "payer",
          explication: "Un chèque de 15 € ou moins ne peut pas être refusé : la note E du client n'y change rien. Le solde passe à −254 €." },
        { id: "o2", type: "cheque", libelle: "Centre technique Rivoli – contrôle", detail: "Chèque n° 2381190, émis le {date}", joursAvant: 2, montant: 90,
          attendu: "rejeter",
          explication: "À l'état des débiteurs depuis 6 jours (−254 € pour 150 € d'autorisation), note E, 4 rejets sur 12 mois et allocation attendue seulement dans 12 jours : on rejette. Frais de rejet : 50 € (chèque de plus de 50 €)." },
        { id: "o3", type: "prelevement", libelle: "Conso Crédit – mensualité", detail: "Prélèvement SEPA, mandat n° CC-66019, présenté le {date}", joursAvant: 0, montant: 32,
          attendu: "rejeter",
          explication: "Même raisonnement. Frais de rejet : 20 € au maximum, le prélèvement étant supérieur à 20 € (art. D133-6 du CMF)." }
      ],
      antecedents: [
        { type: "prelevement", montant: 32, joursAvant: 19, libelle: "Conso Crédit – mensualité" },
        { type: "cheque", montant: 60, joursAvant: 49, libelle: "Garage du Centre" },
        { type: "prelevement", montant: 78, joursAvant: 140, libelle: "Assurance auto" },
        { type: "prelevement", montant: 32, joursAvant: 210, libelle: "Conso Crédit – mensualité" }
      ],
      retenir: [
        "La règle du chèque de 15 € ou moins s'applique à tous les clients, quelle que soit la note Bâle.",
        "Pour les autres opérations, la note E, les rejets répétés et l'absence de crédit proche imposent la prudence."
      ],
      argumentaire: [
        "Chèque de 14 € : paiement obligatoire malgré la note E",
        "À l'état des débiteurs depuis 6 jours, −254 € pour 150 € d'autorisation",
        "Note E, 4 rejets sur 12 mois",
        "Allocation attendue seulement dans 12 jours"
      ]
    },

    {
      objectif: "Reconnaître un client en défaut.",
      opportunite: { type: null,
        explication: "Client en défaut, dossier suivi par le recouvrement : aucune proposition commerciale." },
      client: {
        civilite: "M.", prenom: "Franck", nom: "LEGRAND", age: 49,
        profession: "Sans emploi (ancien artisan)", situation: "Divorcé",
        ancienneteAns: 12, revenus: 780, revenusNote: "allocation chômage",
        produits: ["Compte courant", "Carte Visa Classic", "Autorisation de découvert"],
        fragile: false, compte: "00276 389 5518"
      },
      note: "Défaut",
      position: {
        solde: -1190, autorisation: 300,
        creditAttendu: { libelle: "Allocation chômage", montant: 780, dansJours: 9 },
        debiteurDepuis: 104
      },
      operations: [
        { id: "o1", type: "carte", libelle: "Pharmacie Centrale – Paris 12e", detail: "Paiement par carte autorisé le {date}", joursAvant: 1, montant: 22.5,
          attendu: "payer",
          explication: "La carte se valide toujours." },
        { id: "o2", type: "prelevement", libelle: "Assurances Solidaires – assurance auto", detail: "Prélèvement SEPA, mandat n° AS-90412, présenté le {date}", joursAvant: 0, montant: 95,
          attendu: "rejeter",
          explication: "Compte à l'état des débiteurs depuis 104 jours, note Défaut, 7 rejets sur 12 mois : aucune tolérance. Le dossier est suivi par le recouvrement. Frais de rejet : 20 € au maximum." }
      ],
      antecedents: [
        { type: "prelevement", montant: 95, joursAvant: 12, libelle: "Assurances Solidaires – assurance auto" },
        { type: "prelevement", montant: 62.5, joursAvant: 40, libelle: "Énergie Citoyenne – électricité" },
        { type: "prelevement", montant: 24.99, joursAvant: 70, libelle: "Opérateur mobile" },
        { type: "prelevement", montant: 95, joursAvant: 100, libelle: "Assurances Solidaires – assurance auto" },
        { type: "prelevement", montant: 62.5, joursAvant: 150, libelle: "Énergie Citoyenne – électricité" },
        { type: "prelevement", montant: 24.99, joursAvant: 220, libelle: "Opérateur mobile" },
        { type: "prelevement", montant: 41, joursAvant: 300, libelle: "Mutuelle Santé Plus" }
      ],
      retenir: [
        "Un impayé de plus de 90 jours est l'un des critères du défaut au sens de Bâle (article 178 du règlement CRR) : ici, 104 jours.",
        "Pour un client en défaut, pas de tolérance : on rejette ce qui peut l'être et le dossier est suivi par le recouvrement."
      ],
      argumentaire: [
        "À l'état des débiteurs depuis 104 jours (plus de 90 jours)",
        "Note Défaut, 7 rejets sur 12 mois",
        "Carte validée, prélèvement rejeté (frais de 20 € au maximum)",
        "Aucune tolérance : suivi par le recouvrement"
      ]
    }
  ];

  dossiers.forEach(function (d, i) { d.id = i + 1; });

  root.SGBF = root.SGBF || {};
  root.SGBF.banque = root.SGBF.banque || { nom: "GS Banque & Assurance" };   /* ne remplace pas l'API de banque.js quand elle est déjà chargée */
  root.SGBF.notes = notes;
  root.SGBF.dossiers = dossiers;
  if (typeof module !== "undefined" && module.exports) module.exports = { notes: notes, dossiers: dossiers };
})(typeof window !== "undefined" ? window : globalThis);
