/* GS Banque & Assurance – parcours « mouvements atypiques ».
   Banque, clients, coordonnées et montants sont imaginaires.
   Téléphones : plages réservées à la fiction (01 99 00, 02 61 91, 03 53 01, 04 65 71, 05 36 49, 06 39 98).
   Courriels en @example.com (domaine réservé aux exemples).

   Modèle d'un dossier :
     objectif      : ce que le dossier enseigne
     client        : identité, coordonnees { telephone, mobile, email, adresse }, situation personnelle
                     (situation), professionnelle (profession, professionnel, revenus), patrimoniale
                     (patrimoine), miseAJourMois (âge de la dernière
                     mise à jour du dossier), ancienneteAns ou ancienneteMois
     observations  : facultatif, remarques du conseiller
     operations    : id, type "depot_especes" | "depot_cheque" | "retrait_especes" | "virement",
                     libelle, detail, montant, mois (1 à 3 : mois civils écoulés), jour (1 à 28),
                     sens "credit" | "debit" (facultatif, déduit du type sauf pour « virement »),
                     atypique (true | false), explication
     pieces        : attendues (justificatifs à demander) et acceptables (demande utile sans être
                     indispensable). La liste des pièces possibles est dans js/rules_atypiques.js.
     contact       : canal "mobile" | "telephone" | "courrier", echange (récit), recues (pièces reçues),
                     appreciation (affichée dans la correction), maj [{ rubrique, texte }] (mise à jour du dossier)
     issue         : "coherent" (valider l'opération) | "declaration" (cellule TRACFIN de l'établissement)
     explication, retenir, argumentaire : texte de la correction et auto-évaluation du commentaire
     L'identifiant (id) est attribué automatiquement : c'est le rang du dossier dans la liste. */
(function (root) {
  "use strict";
  var dossiers = [
  {
    "objectif": "Un dépôt d'espèces élevé n'est pas un soupçon : un commerçant peut le justifier avec son livre de recettes.",
    "client": {
      "civilite": "M.",
      "prenom": "Joseph",
      "nom": "ALBERT",
      "age": 54,
      "profession": "Commerçant sur les marchés (primeur)",
      "situation": "Marié, 2 enfants",
      "ancienneteAns": 14,
      "revenus": 2600,
      "revenusNote": "bénéfices moyens de l'activité",
      "compte": "00531 220 4417",
      "produits": [
        "Compte courant",
        "Carte Visa Classic",
        "Crédit immobilier"
      ],
      "coordonnees": {
        "telephone": "01 99 00 10 01",
        "mobile": "06 39 98 10 01",
        "email": "joseph.albert@example.com",
        "adresse": "14 rue de Charonne, 75011 Paris"
      },
      "professionnel": "Entreprise individuelle, stand sur trois marchés de l'agglomération depuis 2009.",
      "patrimoine": [
        "Résidence principale en cours d'achat (crédit immobilier)",
        "Livret A : 12 000 €"
      ],
      "miseAJourMois": 11
    },
    "operations": [
      {
        "id": "o1",
        "type": "depot_especes",
        "libelle": "Remises d'espèces hebdomadaires (4 remises)",
        "detail": "Recettes des marchés, de 1 400 à 1 700 € par semaine",
        "montant": 6100,
        "mois": 1,
        "jour": 25,
        "atypique": false,
        "explication": "Habituelle : même rythme et mêmes montants que d'habitude, en rapport avec l'activité de commerçant."
      },
      {
        "id": "o2",
        "type": "depot_especes",
        "libelle": "Remise d'espèces au guichet",
        "detail": "Déposée en une seule fois, en agence",
        "montant": 8400,
        "mois": 1,
        "jour": 27,
        "atypique": true,
        "explication": "Atypique : un seul dépôt plus de cinq fois supérieur aux remises habituelles. Il porte les espèces du mois à 14 500 €."
      },
      {
        "id": "o3",
        "type": "depot_cheque",
        "libelle": "Remise de chèques de clients",
        "detail": "Chèques de petits montants, remis avec les espèces",
        "montant": 1350,
        "mois": 1,
        "jour": 26,
        "atypique": false,
        "explication": "Habituelle : remise de chèques courante pour un commerçant."
      },
      {
        "id": "o4",
        "type": "retrait_especes",
        "libelle": "Retrait au distributeur",
        "detail": "Retrait habituel",
        "montant": 300,
        "mois": 1,
        "jour": 12,
        "atypique": false,
        "explication": "Habituelle : retrait mensuel de 300 €, comme d'habitude."
      }
    ],
    "pieces": {
      "attendues": [
        "recettes"
      ],
      "acceptables": [
        "avis_impo",
        "explication"
      ]
    },
    "contact": {
      "canal": "mobile",
      "echange": [
        "M. ALBERT explique qu'il a tenu un stand pendant trois semaines à une foire régionale, avec des recettes bien supérieures à l'ordinaire. Il n'avait pas pu déposer les espèces avant son retour.",
        "Il propose spontanément de montrer son livre de recettes et les tickets de la foire."
      ],
      "recues": [
        "Livre de recettes du mois : 14 500 € de recettes en espèces, dont 8 400 € pour la foire",
        "Bordereau de réservation du stand de la foire régionale"
      ],
      "appreciation": "Le livre de recettes concorde avec les montants et les dates des dépôts.",
      "maj": [
        {
          "rubrique": "Situation professionnelle",
          "texte": "Participe chaque année à une foire régionale : recettes saisonnières supplémentaires jusqu'à 8 500 €."
        },
        {
          "rubrique": "Fonctionnement du compte",
          "texte": "Un dépôt d'espèces élevé peut survenir à l'issue de la foire."
        }
      ]
    },
    "issue": "coherent",
    "explication": "Le dépôt est justifié par le livre de recettes et la foire, et il correspond à l'activité connue du client. L'opération est cohérente avec sa situation : on la valide et on met le dossier à jour. Le dépassement de 10 000 € d'espèces dans le mois déclenche une communication systématique à TRACFIN (COSI), mais ce n'est pas une déclaration de soupçon et elle ne dépend pas de la décision du conseiller.",
    "retenir": [
      "Un montant inhabituel n'est pas un soupçon : il appelle d'abord une explication.",
      "Pour un commerçant, un livre de recettes concordant justifie des espèces.",
      "Plus de 10 000 € d'espèces dans le mois civil : communication systématique à TRACFIN (COSI), indépendante de la décision du conseiller."
    ],
    "argumentaire": [
      "Rapprocher le dépôt de 8 400 € de l'activité du client (commerçant sur les marchés)",
      "Citer la pièce reçue (livre de recettes) et sa concordance avec les montants et les dates",
      "Conclure : opération cohérente, pas de déclaration",
      "Mentionner la mise à jour du dossier (recettes saisonnières de la foire)"
    ]
  },
  {
    "objectif": "Un chèque de notaire de 42 300 € sur le compte d'une retraitée : l'attestation du notaire explique l'origine des fonds.",
    "client": {
      "civilite": "Mme",
      "prenom": "Odette",
      "nom": "MARTINEAU",
      "age": 68,
      "profession": "Retraitée (ancienne institutrice)",
      "situation": "Veuve, 2 enfants",
      "ancienneteAns": 31,
      "revenus": 1650,
      "revenusNote": "pensions de retraite",
      "compte": "00531 118 2093",
      "produits": [
        "Compte courant",
        "Carte Visa Classic",
        "Livret A",
        "Assurance-vie"
      ],
      "coordonnees": {
        "telephone": "01 99 00 20 02",
        "mobile": "06 39 98 20 02",
        "email": "odette.martineau@example.com",
        "adresse": "8 rue Monge, 75005 Paris"
      },
      "professionnel": "Retraitée depuis 2015.",
      "patrimoine": [
        "Résidence principale (propriétaire, sans crédit)",
        "Livret A : 14 800 €",
        "Assurance-vie : 22 000 €"
      ],
      "miseAJourMois": 26
    },
    "operations": [
      {
        "id": "o1",
        "type": "virement",
        "libelle": "Pensions de retraite",
        "detail": "Virement mensuel des caisses de retraite",
        "montant": 1650,
        "mois": 1,
        "jour": 5,
        "atypique": false,
        "explication": "Habituelle : pension reçue chaque mois.",
        "sens": "credit"
      },
      {
        "id": "o2",
        "type": "depot_cheque",
        "libelle": "Chèque de l'étude notariale Vasseur & Associés",
        "detail": "Libellé : « règlement de succession »",
        "montant": 42300,
        "mois": 1,
        "jour": 17,
        "atypique": true,
        "explication": "Atypique : montant très supérieur aux flux habituels de la cliente, sans lien avec sa situation connue."
      },
      {
        "id": "o3",
        "type": "retrait_especes",
        "libelle": "Retraits hebdomadaires au distributeur (4 retraits)",
        "detail": "Retraits habituels de 200 € chaque semaine",
        "montant": 800,
        "mois": 1,
        "jour": 28,
        "atypique": false,
        "explication": "Habituelle : quatre retraits hebdomadaires de 200 € (800 € dans le mois)."
      }
    ],
    "pieces": {
      "attendues": [
        "attestation_notaire"
      ],
      "acceptables": [
        "explication"
      ]
    },
    "contact": {
      "canal": "telephone",
      "echange": [
        "Mme MARTINEAU explique que sa sœur aînée est décédée en début d'année. Elle est l'une de ses deux héritières : le notaire vient de lui remettre sa part par chèque.",
        "Elle se montre disponible et transmet le courrier de l'étude."
      ],
      "recues": [
        "Attestation du notaire : succession de Mme Colette BERTIN, part revenant à Mme MARTINEAU : 42 300 €"
      ],
      "appreciation": "L'attestation du notaire correspond au chèque (émetteur, montant, date).",
      "maj": [
        {
          "rubrique": "Situation patrimoniale",
          "texte": "Succession de sa sœur : 42 300 € reçus. Avoirs financiers portés à environ 79 100 €."
        },
        {
          "rubrique": "Situation personnelle",
          "texte": "Décès de sa sœur aînée en début d'année."
        }
      ]
    },
    "issue": "coherent",
    "explication": "Le chèque vient d'un notaire et l'attestation confirme une succession. Le montant est élevé, mais il est expliqué et justifié par un document fiable : l'opération est cohérente et le dossier est mis à jour.",
    "retenir": [
      "Un chèque de notaire accompagné d'une attestation de succession est un justificatif fiable.",
      "Le dossier client doit être mis à jour : la situation patrimoniale a changé.",
      "L'examen d'une opération atypique est consigné par écrit dans le dossier."
    ],
    "argumentaire": [
      "Comparer le chèque de 42 300 € aux revenus et aux flux habituels de la cliente",
      "Citer l'attestation du notaire et vérifier émetteur, montant et date",
      "Conclure : opération cohérente, pas de déclaration",
      "Mentionner la mise à jour de la situation patrimoniale"
    ]
  },
  {
    "objectif": "Quatre dépôts d'espèces juste sous 10 000 € au total, sans rapport avec les revenus : l'explication change et rien n'est justifié.",
    "client": {
      "civilite": "M.",
      "prenom": "Kevin",
      "nom": "MAILLARD",
      "age": 22,
      "profession": "Étudiant en alternance (BTS)",
      "situation": "Célibataire, vit chez ses parents",
      "ancienneteAns": 4,
      "revenus": 1050,
      "revenusNote": "rémunération d'alternance",
      "compte": "00531 774 3306",
      "produits": [
        "Compte courant",
        "Carte Visa Classic",
        "Livret A"
      ],
      "coordonnees": {
        "telephone": "01 99 00 30 03",
        "mobile": "06 39 98 30 03",
        "email": "kevin.maillard@example.com",
        "adresse": "27 rue de Bagnolet, 75020 Paris"
      },
      "professionnel": "Alternance en entreprise depuis septembre, en parallèle d'un BTS.",
      "patrimoine": [
        "Livret A : 800 €",
        "Aucun bien"
      ],
      "miseAJourMois": 18
    },
    "operations": [
      {
        "id": "o1",
        "type": "virement",
        "libelle": "Rémunération d'alternance",
        "detail": "Virement mensuel de l'employeur",
        "montant": 1050,
        "mois": 1,
        "jour": 28,
        "atypique": false,
        "explication": "Habituelle : rémunération reçue chaque mois.",
        "sens": "credit"
      },
      {
        "id": "o2",
        "type": "depot_especes",
        "libelle": "Dépôt d'espèces en agence",
        "detail": "Premier dépôt",
        "montant": 2400,
        "mois": 1,
        "jour": 4,
        "atypique": true,
        "explication": "Atypique : le client n'avait jamais déposé d'espèces et la somme représente plus de deux mois de revenus."
      },
      {
        "id": "o3",
        "type": "depot_especes",
        "libelle": "Dépôt d'espèces en agence",
        "detail": "Deuxième dépôt, même montant",
        "montant": 2400,
        "mois": 1,
        "jour": 9,
        "atypique": true,
        "explication": "Atypique : même montant exact, cinq jours plus tard."
      },
      {
        "id": "o4",
        "type": "depot_especes",
        "libelle": "Dépôt d'espèces en agence",
        "detail": "Troisième dépôt, même montant",
        "montant": 2400,
        "mois": 1,
        "jour": 15,
        "atypique": true,
        "explication": "Atypique : troisième dépôt identique."
      },
      {
        "id": "o5",
        "type": "depot_especes",
        "libelle": "Dépôt d'espèces en agence",
        "detail": "Quatrième dépôt, même montant",
        "montant": 2400,
        "mois": 1,
        "jour": 21,
        "atypique": true,
        "explication": "Atypique : quatre dépôts de 2 400 € en 17 jours, soit 9 600 €, juste sous le seuil de 10 000 € d'espèces par mois."
      },
      {
        "id": "o6",
        "type": "retrait_especes",
        "libelle": "Retrait au distributeur",
        "detail": "Retrait habituel",
        "montant": 80,
        "mois": 1,
        "jour": 12,
        "atypique": false,
        "explication": "Habituelle : retrait courant de 80 €."
      }
    ],
    "pieces": {
      "attendues": [
        "explication"
      ],
      "acceptables": [
        "avis_impo",
        "releves_autre_banque",
        "bulletins"
      ]
    },
    "contact": {
      "canal": "mobile",
      "echange": [
        "M. MAILLARD dit d'abord qu'il s'agit de ses économies, puis d'argent « confié par un ami » qu'il ne veut pas nommer.",
        "Il refuse de fournir des documents (« pas la peine de justifier ») et remet seulement une attestation sur l'honneur manuscrite : « fonds m'appartenant »."
      ],
      "recues": [
        "Attestation sur l'honneur manuscrite, sans autre document"
      ],
      "appreciation": "L'attestation sur l'honneur, seule, ne corrobore rien : aucune pièce ne permet de remonter à l'origine des fonds.",
      "maj": [
        {
          "rubrique": "Origine des fonds",
          "texte": "Non justifiée. Explications successives : ses économies, puis de l'argent confié par un ami non nommé."
        },
        {
          "rubrique": "Contact client",
          "texte": "Le client refuse de fournir des pièces justificatives."
        }
      ]
    },
    "issue": "declaration",
    "explication": "Les dépôts sont sans rapport avec les revenus et les habitudes du client, ils sont fractionnés juste sous 10 000 €, l'explication change et rien n'est justifié (une attestation sur l'honneur seule ne suffit pas). Le doute n'est pas levé après l'examen renforcé : le conseiller signale le dossier à la cellule TRACFIN de l'établissement, sans rien dire au client.",
    "retenir": [
      "Des montants identiques répétés juste sous un seuil sont un signal d'alerte.",
      "Une attestation sur l'honneur seule ne suffit pas à justifier l'origine des fonds.",
      "Si le doute n'est pas levé après l'examen renforcé, la déclaration s'impose. Le client n'en est pas informé (art. L561-18)."
    ],
    "argumentaire": [
      "Rapprocher les 9 600 € déposés des revenus de 1 050 € et des habitudes du client",
      "Relever le fractionnement (quatre dépôts identiques) et le seuil de 10 000 €",
      "Citer les explications contradictoires et l'absence de pièces (attestation seule)",
      "Conclure : déclaration à la cellule TRACFIN, sans informer le client"
    ]
  },
  {
    "objectif": "Un chèque de 30 000 € du père d'une jeune infirmière : l'acte de donation justifie l'opération.",
    "client": {
      "civilite": "Mme",
      "prenom": "Inès",
      "nom": "CARON",
      "age": 27,
      "profession": "Infirmière (hôpital public)",
      "situation": "Célibataire",
      "ancienneteAns": 5,
      "revenus": 2050,
      "revenusNote": "salaire domicilié",
      "compte": "00531 905 6618",
      "produits": [
        "Compte courant",
        "Carte Visa Classic",
        "Livret A"
      ],
      "coordonnees": {
        "telephone": "01 99 00 40 04",
        "mobile": "06 39 98 40 04",
        "email": "ines.caron@example.com",
        "adresse": "5 rue Ordener, 75018 Paris"
      },
      "professionnel": "Infirmière en CDI depuis 5 ans.",
      "patrimoine": [
        "Livret A : 3 200 €",
        "Locataire, aucun bien immobilier"
      ],
      "miseAJourMois": 15
    },
    "operations": [
      {
        "id": "o1",
        "type": "virement",
        "libelle": "Salaire",
        "detail": "Virement mensuel de l'employeur",
        "montant": 2050,
        "mois": 1,
        "jour": 28,
        "atypique": false,
        "explication": "Habituelle : salaire reçu chaque mois.",
        "sens": "credit"
      },
      {
        "id": "o2",
        "type": "depot_cheque",
        "libelle": "Chèque de M. Gilles CARON",
        "detail": "Chèque de 30 000 € tiré par un particulier",
        "montant": 30000,
        "mois": 1,
        "jour": 9,
        "atypique": true,
        "explication": "Atypique : montant égal à plus de 14 mois de salaire, sans lien avec la situation connue de la cliente."
      },
      {
        "id": "o3",
        "type": "retrait_especes",
        "libelle": "Retrait au distributeur",
        "detail": "Retrait habituel",
        "montant": 150,
        "mois": 1,
        "jour": 14,
        "atypique": false,
        "explication": "Habituelle : retrait courant de 150 €."
      }
    ],
    "pieces": {
      "attendues": [
        "acte_donation"
      ],
      "acceptables": [
        "explication"
      ]
    },
    "contact": {
      "canal": "mobile",
      "echange": [
        "Mme CARON explique que son père, M. Gilles CARON, lui fait une donation pour l'aider à acheter sa résidence principale. Un compromis de vente est en cours.",
        "Elle transmet l'acte et indique le nom de l'agence immobilière."
      ],
      "recues": [
        "Acte de donation établi par un notaire : don de 30 000 € de M. Gilles CARON à sa fille"
      ],
      "appreciation": "L'acte de donation correspond à l'émetteur du chèque, au montant et à la date.",
      "maj": [
        {
          "rubrique": "Projet",
          "texte": "Achat de sa résidence principale ; apport de 30 000 € provenant d'une donation de son père."
        },
        {
          "rubrique": "Situation patrimoniale",
          "texte": "Donation de 30 000 € reçue."
        }
      ]
    },
    "issue": "coherent",
    "explication": "Le chèque vient du père de la cliente et un acte notarié de donation le justifie. Le montant est élevé par rapport aux revenus, mais l'origine est établie et le projet d'achat est cohérent : l'opération est cohérente et le dossier est mis à jour.",
    "retenir": [
      "Un don familial se justifie par un acte de donation ou une déclaration de don manuel.",
      "Le lien entre le tireur du chèque et la cliente doit apparaître dans la pièce.",
      "Le dossier client est mis à jour : projet d'achat et patrimoine."
    ],
    "argumentaire": [
      "Comparer 30 000 € au salaire de 2 050 € et à l'épargne de la cliente",
      "Citer l'acte de donation et vérifier tireur, montant et date",
      "Conclure : opération cohérente, pas de déclaration",
      "Mentionner la mise à jour du dossier (projet d'achat, donation)"
    ]
  },
  {
    "objectif": "Quatre retraits d'espèces élevés sur le compte d'une cliente âgée et isolée, au profit d'un tiers : aucune justification.",
    "client": {
      "civilite": "Mme",
      "prenom": "Simone",
      "nom": "VASSEUR",
      "age": 88,
      "profession": "Retraitée",
      "situation": "Veuve, vit seule",
      "ancienneteAns": 52,
      "revenus": 1450,
      "revenusNote": "pensions de retraite",
      "compte": "00531 062 8841",
      "produits": [
        "Compte courant",
        "Carte de retrait",
        "Livret A",
        "Assurance-vie"
      ],
      "coordonnees": {
        "telephone": "01 99 00 50 05",
        "mobile": "06 39 98 50 05",
        "email": "simone.vasseur@example.com",
        "adresse": "3 rue Daguerre, 75014 Paris"
      },
      "professionnel": "Retraitée depuis 1998.",
      "patrimoine": [
        "Résidence principale (propriétaire, sans crédit)",
        "Livret A : 18 000 €",
        "Assurance-vie : 35 000 €"
      ],
      "miseAJourMois": 30
    },
    "observations": [
      "Vit seule. Une aide à domicile intervient chez elle depuis huit mois.",
      "Retraits récents effectués au guichet, la cliente étant accompagnée."
    ],
    "operations": [
      {
        "id": "o1",
        "type": "virement",
        "libelle": "Pensions de retraite",
        "detail": "Virement mensuel des caisses de retraite",
        "montant": 1450,
        "mois": 1,
        "jour": 5,
        "atypique": false,
        "explication": "Habituelle : pension reçue chaque mois.",
        "sens": "credit"
      },
      {
        "id": "o2",
        "type": "retrait_especes",
        "libelle": "Retrait d'espèces au guichet",
        "detail": "Première semaine du mois",
        "montant": 3000,
        "mois": 1,
        "jour": 3,
        "atypique": true,
        "explication": "Atypique : quinze fois le retrait habituel de 200 €."
      },
      {
        "id": "o3",
        "type": "retrait_especes",
        "libelle": "Retrait d'espèces au guichet",
        "detail": "Deuxième semaine",
        "montant": 3500,
        "mois": 1,
        "jour": 10,
        "atypique": true,
        "explication": "Atypique : retrait répété, montant en hausse."
      },
      {
        "id": "o4",
        "type": "retrait_especes",
        "libelle": "Retrait d'espèces au guichet",
        "detail": "Troisième semaine",
        "montant": 4000,
        "mois": 1,
        "jour": 17,
        "atypique": true,
        "explication": "Atypique : troisième retrait, montant en hausse."
      },
      {
        "id": "o5",
        "type": "retrait_especes",
        "libelle": "Retrait d'espèces au guichet",
        "detail": "Quatrième semaine",
        "montant": 4500,
        "mois": 1,
        "jour": 24,
        "atypique": true,
        "explication": "Atypique : 15 000 € retirés en quatre semaines, soit plus de dix mois de pension."
      },
      {
        "id": "o6",
        "type": "retrait_especes",
        "libelle": "Retraits hebdomadaires au distributeur (4 retraits)",
        "detail": "Retraits habituels de 200 € chaque semaine",
        "montant": 800,
        "mois": 1,
        "jour": 28,
        "atypique": false,
        "explication": "Habituelle : quatre retraits hebdomadaires de 200 € (800 € dans le mois)."
      }
    ],
    "pieces": {
      "attendues": [
        "explication"
      ],
      "acceptables": [
        "releves_autre_banque",
        "factures"
      ]
    },
    "contact": {
      "canal": "telephone",
      "echange": [
        "C'est M. Alain TESSIER, qui se présente comme son aide à domicile, qui décroche et répond le plus souvent à la place de Mme VASSEUR.",
        "Mme VASSEUR confirme à voix basse qu'elle « aide ce monsieur » mais ne sait pas dire à quoi servent les sommes ni pourquoi elles sont si élevées."
      ],
      "recues": [
        "Aucune pièce : ni facture, ni contrat, ni procuration"
      ],
      "appreciation": "Aucun justificatif, une explication confuse, et un tiers sans lien familial qui semble bénéficier des fonds.",
      "maj": [
        {
          "rubrique": "Bénéficiaire probable des fonds",
          "texte": "Tiers sans lien familial (aide à domicile)."
        },
        {
          "rubrique": "Situation personnelle",
          "texte": "Cliente isolée, très âgée, accompagnée lors des retraits."
        }
      ]
    },
    "issue": "declaration",
    "explication": "15 000 € retirés en quatre semaines par une cliente de 88 ans qui retire d'habitude 200 € par semaine, sans motif connu, avec un tiers qui répond à sa place et semble profiter des fonds. Aucune pièce ne justifie ces retraits : le doute n'est pas levé et le conseiller signale le dossier à la cellule TRACFIN de l'établissement. Les retraits de plus de 10 000 € dans le mois font en outre l'objet de la communication systématique (COSI).",
    "retenir": [
      "Des retraits d'espèces répétés, très supérieurs aux habitudes, sans motif connu, sont un signal d'alerte.",
      "Une cliente âgée ou vulnérable demande une attention particulière.",
      "La déclaration est confidentielle : on ne l'annonce ni à la cliente, ni à la personne qui l'accompagne."
    ],
    "argumentaire": [
      "Rapprocher les 15 000 € retirés de la pension de 1 450 € et des retraits habituels de 200 €",
      "Relever l'âge de la cliente, son isolement et le tiers qui répond à sa place",
      "Constater l'absence de toute pièce justificative",
      "Conclure : déclaration à la cellule TRACFIN, sans informer la cliente"
    ]
  },
  {
    "objectif": "Un chèque de banque de 7 500 € : la vente d'un véhicule entre particuliers se justifie avec le certificat de cession.",
    "client": {
      "civilite": "M.",
      "prenom": "Mehdi",
      "nom": "LAURENT",
      "age": 38,
      "profession": "Technicien de maintenance",
      "situation": "Marié, 1 enfant",
      "ancienneteAns": 9,
      "revenus": 2350,
      "revenusNote": "salaire domicilié",
      "compte": "00531 340 7752",
      "produits": [
        "Compte courant",
        "Carte Visa Classic",
        "Livret A"
      ],
      "coordonnees": {
        "telephone": "01 99 00 60 06",
        "mobile": "06 39 98 60 06",
        "email": "mehdi.laurent@example.com",
        "adresse": "19 avenue Daumesnil, 75012 Paris"
      },
      "professionnel": "Technicien en CDI depuis 9 ans.",
      "patrimoine": [
        "Livret A : 5 600 €",
        "Deux véhicules",
        "Locataire"
      ],
      "miseAJourMois": 13
    },
    "operations": [
      {
        "id": "o1",
        "type": "virement",
        "libelle": "Salaire",
        "detail": "Virement mensuel de l'employeur",
        "montant": 2350,
        "mois": 1,
        "jour": 28,
        "atypique": false,
        "explication": "Habituelle : salaire reçu chaque mois.",
        "sens": "credit"
      },
      {
        "id": "o2",
        "type": "depot_cheque",
        "libelle": "Chèque de banque de M. Anthony BERNARD",
        "detail": "Chèque de banque de 7 500 €",
        "montant": 7500,
        "mois": 1,
        "jour": 16,
        "atypique": true,
        "explication": "Atypique : montant supérieur à trois mois de salaire, émetteur inconnu."
      },
      {
        "id": "o3",
        "type": "retrait_especes",
        "libelle": "Retrait au distributeur",
        "detail": "Retrait habituel",
        "montant": 150,
        "mois": 1,
        "jour": 10,
        "atypique": false,
        "explication": "Habituelle : retrait courant de 150 €."
      }
    ],
    "pieces": {
      "attendues": [
        "cession_vehicule"
      ],
      "acceptables": [
        "explication"
      ]
    },
    "contact": {
      "canal": "mobile",
      "echange": [
        "M. LAURENT explique qu'il a vendu sa berline à un particulier, M. BERNARD, qui l'a payé par chèque de banque. Le couple a désormais un seul véhicule."
      ],
      "recues": [
        "Certificat de cession du véhicule daté du jour du chèque",
        "Facture de vente de 7 500 € signée par les deux parties"
      ],
      "appreciation": "Les pièces correspondent au chèque : acheteur, montant et date.",
      "maj": [
        {
          "rubrique": "Situation patrimoniale",
          "texte": "Vente d'un véhicule pour 7 500 € ; le foyer ne possède plus qu'un véhicule."
        }
      ]
    },
    "issue": "coherent",
    "explication": "Le chèque de banque correspond à la vente d'un véhicule, prouvée par le certificat de cession et la facture. L'opération est cohérente avec la situation du client et le dossier est mis à jour.",
    "retenir": [
      "Une vente de véhicule entre particuliers se prouve par le certificat de cession et la facture.",
      "Vérifier la concordance : acheteur, montant, date.",
      "L'analyse et la mise à jour du dossier sont consignées par écrit."
    ],
    "argumentaire": [
      "Rapprocher 7 500 € du salaire de 2 350 € et du patrimoine connu",
      "Citer le certificat de cession et la facture, et vérifier la concordance",
      "Conclure : opération cohérente, pas de déclaration",
      "Mentionner la mise à jour du dossier (véhicule vendu)"
    ]
  },
  {
    "objectif": "Quatre chèques de particuliers différents sur le compte d'un demandeur d'emploi : une activité non déclarée, aucune facture.",
    "client": {
      "civilite": "M.",
      "prenom": "Yanis",
      "nom": "COLLIN",
      "age": 31,
      "profession": "Demandeur d'emploi",
      "situation": "Célibataire",
      "ancienneteAns": 6,
      "revenus": 1050,
      "revenusNote": "allocation chômage",
      "compte": "00531 586 9921",
      "produits": [
        "Compte courant",
        "Carte Visa Classic"
      ],
      "coordonnees": {
        "telephone": "01 99 00 70 07",
        "mobile": "06 39 98 70 07",
        "email": "yanis.collin@example.com",
        "adresse": "62 rue de Crimée, 75019 Paris"
      },
      "professionnel": "Sans emploi depuis 14 mois.",
      "patrimoine": [
        "Aucun placement",
        "Locataire"
      ],
      "miseAJourMois": 16
    },
    "operations": [
      {
        "id": "o1",
        "type": "virement",
        "libelle": "Allocation chômage",
        "detail": "Virement mensuel",
        "montant": 1050,
        "mois": 1,
        "jour": 3,
        "atypique": false,
        "explication": "Habituelle : allocation reçue chaque mois.",
        "sens": "credit"
      },
      {
        "id": "o2",
        "type": "depot_cheque",
        "libelle": "Chèque de M. Quentin LEROUX",
        "detail": "Particulier",
        "montant": 1900,
        "mois": 1,
        "jour": 2,
        "atypique": true,
        "explication": "Atypique : le client ne recevait jamais de chèque ; tireur sans lien connu."
      },
      {
        "id": "o3",
        "type": "depot_cheque",
        "libelle": "Chèque de Mme Sabrina TOURNIER",
        "detail": "Autre particulier",
        "montant": 2100,
        "mois": 1,
        "jour": 9,
        "atypique": true,
        "explication": "Atypique : tireur différent, même profil d'opération."
      },
      {
        "id": "o4",
        "type": "depot_cheque",
        "libelle": "Chèque de M. Maxime DELATTRE",
        "detail": "Autre particulier",
        "montant": 1800,
        "mois": 1,
        "jour": 16,
        "atypique": true,
        "explication": "Atypique : troisième tireur différent."
      },
      {
        "id": "o5",
        "type": "depot_cheque",
        "libelle": "Chèque de M. Cédric PAGNON",
        "detail": "Autre particulier",
        "montant": 2250,
        "mois": 1,
        "jour": 23,
        "atypique": true,
        "explication": "Atypique : 8 050 € de chèques de quatre particuliers en un mois pour un demandeur d'emploi."
      },
      {
        "id": "o6",
        "type": "retrait_especes",
        "libelle": "Retrait au distributeur",
        "detail": "Retrait habituel",
        "montant": 100,
        "mois": 1,
        "jour": 14,
        "atypique": false,
        "explication": "Habituelle : retrait courant de 100 €."
      }
    ],
    "pieces": {
      "attendues": [
        "factures"
      ],
      "acceptables": [
        "avis_impo",
        "explication"
      ]
    },
    "contact": {
      "canal": "mobile",
      "echange": [
        "M. COLLIN reconnaît qu'il « dépanne » en achetant et en revendant des voitures d'occasion à des particuliers. Les chèques sont des paiements d'acheteurs.",
        "Il n'a ni statut d'entrepreneur, ni facture, ni certificat de cession à présenter, et affirme que « tout se fait de la main à la main »."
      ],
      "recues": [
        "Aucune facture, aucun certificat de cession, aucun document de vente"
      ],
      "appreciation": "Une activité de vente exercée à titre habituel et non déclarée, sans aucun justificatif.",
      "maj": [
        {
          "rubrique": "Situation professionnelle",
          "texte": "Activité de vente de véhicules d'occasion exercée sans déclaration, en plus de l'allocation chômage."
        },
        {
          "rubrique": "Revenus",
          "texte": "Revenus de cette activité non déclarés et non justifiés."
        }
      ]
    },
    "issue": "declaration",
    "explication": "Quatre chèques de quatre particuliers différents (8 050 €) sur le compte d'un demandeur d'emploi qui reconnaît une activité de revente non déclarée et ne peut produire aucun document. Les flux ne correspondent pas à la situation déclarée et ne sont pas justifiés : le conseiller signale le dossier à la cellule TRACFIN de l'établissement.",
    "retenir": [
      "Des chèques de tiers multiples, sans rapport avec la situation du client, appellent un examen renforcé.",
      "Une activité professionnelle non déclarée est incohérente avec le profil et sans justification possible.",
      "Si le doute n'est pas levé, la déclaration est faite sans délai et reste confidentielle."
    ],
    "argumentaire": [
      "Rapprocher les 8 050 € de chèques de la situation de demandeur d'emploi",
      "Relever la multiplicité des tireurs, sans lien connu avec le client",
      "Citer l'aveu d'une activité non déclarée et l'absence de toute pièce",
      "Conclure : déclaration à la cellule TRACFIN, sans informer le client"
    ]
  },
  {
    "objectif": "Un chèque de 38 500 € de l'ancien employeur d'un salarié licencié : le solde de tout compte l'explique.",
    "client": {
      "civilite": "M.",
      "prenom": "Thierry",
      "nom": "BLONDEL",
      "age": 49,
      "profession": "Cadre logistique",
      "situation": "Divorcé, 1 enfant",
      "ancienneteAns": 17,
      "revenus": 3600,
      "revenusNote": "salaire domicilié",
      "compte": "00531 411 3350",
      "produits": [
        "Compte courant",
        "Carte Visa Premier",
        "Livret A",
        "Crédit immobilier"
      ],
      "coordonnees": {
        "telephone": "01 99 00 80 08",
        "mobile": "06 39 98 80 08",
        "email": "thierry.blondel@example.com",
        "adresse": "11 rue Lecourbe, 75015 Paris"
      },
      "professionnel": "Cadre logistique salarié de la société TRANSLOG Sud depuis 12 ans.",
      "patrimoine": [
        "Résidence principale (crédit immobilier en cours)",
        "Livret A : 9 500 €"
      ],
      "miseAJourMois": 22
    },
    "operations": [
      {
        "id": "o1",
        "type": "virement",
        "libelle": "Salaire",
        "detail": "Dernier virement de l'employeur",
        "montant": 3600,
        "mois": 1,
        "jour": 28,
        "atypique": false,
        "explication": "Habituelle : salaire reçu chaque mois.",
        "sens": "credit"
      },
      {
        "id": "o2",
        "type": "depot_cheque",
        "libelle": "Chèque de la société TRANSLOG Sud",
        "detail": "Libellé : « solde de tout compte »",
        "montant": 38500,
        "mois": 1,
        "jour": 15,
        "atypique": true,
        "explication": "Atypique : montant égal à plus de dix mois de salaire, hors des flux habituels."
      },
      {
        "id": "o3",
        "type": "retrait_especes",
        "libelle": "Retrait au distributeur",
        "detail": "Retrait habituel",
        "montant": 300,
        "mois": 1,
        "jour": 10,
        "atypique": false,
        "explication": "Habituelle : retrait courant de 300 €."
      }
    ],
    "pieces": {
      "attendues": [
        "solde_tout_compte"
      ],
      "acceptables": [
        "bulletins",
        "explication"
      ]
    },
    "contact": {
      "canal": "mobile",
      "echange": [
        "M. BLONDEL explique qu'il a été licencié pour motif économique en septembre. Le chèque correspond à ses indemnités. Il est inscrit comme demandeur d'emploi."
      ],
      "recues": [
        "Solde de tout compte signé : indemnités de licenciement et congés payés, 38 500 €",
        "Lettre de licenciement pour motif économique"
      ],
      "appreciation": "Le solde de tout compte correspond au chèque : émetteur, montant et date.",
      "maj": [
        {
          "rubrique": "Situation professionnelle",
          "texte": "Licencié pour motif économique en septembre ; demandeur d'emploi."
        },
        {
          "rubrique": "Revenus",
          "texte": "Plus de salaire ; allocation chômage à venir. Surveiller le crédit immobilier."
        }
      ]
    },
    "issue": "coherent",
    "explication": "Le chèque vient de l'ancien employeur et correspond aux indemnités de licenciement, prouvées par le solde de tout compte et la lettre de licenciement. L'opération est cohérente et le dossier est mis à jour : la situation professionnelle a changé.",
    "retenir": [
      "Un chèque de l'employeur accompagné du solde de tout compte est un justificatif fiable.",
      "La mise à jour du dossier peut révéler un changement de situation à suivre (ici, la perte de revenus et le crédit immobilier).",
      "L'analyse est consignée par écrit."
    ],
    "argumentaire": [
      "Comparer 38 500 € au salaire de 3 600 € et à l'employeur connu",
      "Citer le solde de tout compte et la lettre de licenciement, et vérifier la concordance",
      "Conclure : opération cohérente, pas de déclaration",
      "Mentionner la mise à jour de la situation professionnelle"
    ]
  },
  {
    "objectif": "Deux dépôts de 7 000 € en espèces pour « des bijoux de famille » : la facture fournie ne correspond ni aux montants ni aux dates.",
    "client": {
      "civilite": "Mme",
      "prenom": "Aurélie",
      "nom": "PERRET",
      "age": 36,
      "profession": "Assistante RH",
      "situation": "Pacsée",
      "ancienneteAns": 6,
      "revenus": 1900,
      "revenusNote": "salaire domicilié",
      "compte": "00531 628 1047",
      "produits": [
        "Compte courant",
        "Carte Visa Classic",
        "Livret A"
      ],
      "coordonnees": {
        "telephone": "01 99 00 90 09",
        "mobile": "06 39 98 90 09",
        "email": "aurelie.perret@example.com",
        "adresse": "33 rue des Martyrs, 75009 Paris"
      },
      "professionnel": "Assistante RH en CDI depuis 6 ans.",
      "patrimoine": [
        "Livret A : 2 400 €",
        "Locataire"
      ],
      "miseAJourMois": 12
    },
    "observations": [
      "Au guichet, la cliente a dit déposer « le produit de la vente de bijoux de famille »."
    ],
    "operations": [
      {
        "id": "o1",
        "type": "virement",
        "libelle": "Salaire",
        "detail": "Virement mensuel de l'employeur",
        "montant": 1900,
        "mois": 1,
        "jour": 28,
        "atypique": false,
        "explication": "Habituelle : salaire reçu chaque mois.",
        "sens": "credit"
      },
      {
        "id": "o2",
        "type": "depot_especes",
        "libelle": "Dépôt d'espèces en agence",
        "detail": "Premier dépôt",
        "montant": 7000,
        "mois": 1,
        "jour": 7,
        "atypique": true,
        "explication": "Atypique : somme égale à près de quatre mois de salaire, première opération en espèces du dossier."
      },
      {
        "id": "o3",
        "type": "depot_especes",
        "libelle": "Dépôt d'espèces en agence",
        "detail": "Lendemain, même montant",
        "montant": 7000,
        "mois": 1,
        "jour": 8,
        "atypique": true,
        "explication": "Atypique : même montant le lendemain ; les deux dépôts totalisent 14 000 €, au-delà du seuil de 10 000 € du mois."
      },
      {
        "id": "o4",
        "type": "retrait_especes",
        "libelle": "Retrait au distributeur",
        "detail": "Retrait habituel",
        "montant": 100,
        "mois": 1,
        "jour": 15,
        "atypique": false,
        "explication": "Habituelle : retrait courant de 100 €."
      }
    ],
    "pieces": {
      "attendues": [
        "vente_bien"
      ],
      "acceptables": [
        "explication"
      ]
    },
    "contact": {
      "canal": "mobile",
      "echange": [
        "Mme PERRET dit avoir vendu les bijoux de sa grand-mère à un acheteur rencontré par une annonce, payé en espèces.",
        "Elle envoie une facture de 10 500 €, sans nom d'acheteur ni description des bijoux."
      ],
      "recues": [
        "Facture de 10 500 €, datée de trois semaines après les dépôts, sans acheteur identifié ni description des bijoux"
      ],
      "appreciation": "La facture ne correspond ni au montant déposé (14 000 €) ni aux dates (postérieure aux dépôts) et n'identifie aucun acheteur : elle ne justifie rien.",
      "maj": [
        {
          "rubrique": "Origine des fonds",
          "texte": "Vente alléguée de bijoux de famille. Facture de 10 500 € datée de trois semaines après les dépôts, qui totalisent 14 000 €."
        }
      ]
    },
    "issue": "declaration",
    "explication": "La cliente produit une facture qui ne correspond ni aux montants (10 500 € contre 14 000 € déposés), ni aux dates (postérieure aux dépôts), sans acheteur identifié. Une pièce incohérente ne lève pas le doute : le conseiller signale le dossier à la cellule TRACFIN de l'établissement.",
    "retenir": [
      "Vérifier la concordance des pièces avec l'opération : montant, date, identité de la contrepartie.",
      "Une pièce qui contredit l'opération ne justifie rien et peut aggraver le doute.",
      "Si le doute n'est pas levé après l'examen renforcé, la déclaration est obligatoire."
    ],
    "argumentaire": [
      "Rapprocher les 14 000 € déposés du salaire de 1 900 € et de l'absence d'historique d'espèces",
      "Relever l'écart entre la facture (10 500 €, date postérieure) et les dépôts",
      "Constater qu'aucun acheteur n'est identifié",
      "Conclure : déclaration à la cellule TRACFIN, sans informer la cliente"
    ]
  },
  {
    "objectif": "Un chèque d'assureur de 30 000 € sur le compte d'un retraité : le rachat partiel de son assurance-vie, déjà connue au dossier.",
    "client": {
      "civilite": "M.",
      "prenom": "Gérard",
      "nom": "LAMY",
      "age": 66,
      "profession": "Retraité (ancien technicien)",
      "situation": "Marié",
      "ancienneteAns": 28,
      "revenus": 2400,
      "revenusNote": "pensions de retraite",
      "compte": "00531 297 5508",
      "produits": [
        "Compte courant",
        "Carte Visa Classic",
        "Livret A"
      ],
      "coordonnees": {
        "telephone": "01 99 00 10 10",
        "mobile": "06 39 98 10 10",
        "email": "gerard.lamy@example.com",
        "adresse": "24 rue Raymond Losserand, 75014 Paris"
      },
      "professionnel": "Retraité depuis 2020.",
      "patrimoine": [
        "Résidence principale (propriétaire, sans crédit)",
        "Livret A : 16 000 €",
        "Assurance-vie auprès d'un assureur extérieur : environ 60 000 € (déclarée à l'ouverture du dossier)"
      ],
      "miseAJourMois": 20
    },
    "operations": [
      {
        "id": "o1",
        "type": "virement",
        "libelle": "Pensions de retraite",
        "detail": "Virement mensuel des caisses de retraite",
        "montant": 2400,
        "mois": 1,
        "jour": 5,
        "atypique": false,
        "explication": "Habituelle : pension reçue chaque mois.",
        "sens": "credit"
      },
      {
        "id": "o2",
        "type": "depot_cheque",
        "libelle": "Chèque de la compagnie d'assurance Mutuelle du Sud",
        "detail": "Libellé : « rachat partiel »",
        "montant": 30000,
        "mois": 1,
        "jour": 18,
        "atypique": true,
        "explication": "Atypique : montant égal à plus de douze mois de pension, hors des flux habituels."
      },
      {
        "id": "o3",
        "type": "retrait_especes",
        "libelle": "Retrait au distributeur",
        "detail": "Retrait habituel",
        "montant": 250,
        "mois": 1,
        "jour": 11,
        "atypique": false,
        "explication": "Habituelle : retrait courant de 250 €."
      }
    ],
    "pieces": {
      "attendues": [
        "avis_rachat"
      ],
      "acceptables": [
        "releves_autre_banque",
        "explication"
      ]
    },
    "contact": {
      "canal": "telephone",
      "echange": [
        "M. LAMY explique qu'il a racheté une partie de son contrat d'assurance-vie pour financer l'isolation de sa maison. Les travaux démarrent le mois prochain."
      ],
      "recues": [
        "Avis de rachat partiel du contrat : 30 000 € versés par chèque",
        "Devis de l'entreprise de travaux d'isolation"
      ],
      "appreciation": "L'avis de rachat correspond au chèque et au contrat déjà connu au dossier.",
      "maj": [
        {
          "rubrique": "Situation patrimoniale",
          "texte": "Rachat partiel de 30 000 € ; assurance-vie ramenée à environ 30 000 €."
        },
        {
          "rubrique": "Projet",
          "texte": "Travaux d'isolation de la résidence principale à venir."
        }
      ]
    },
    "issue": "coherent",
    "explication": "Le chèque vient de l'assureur et correspond au rachat partiel d'un contrat que le dossier mentionnait déjà. Le projet de travaux est cohérent avec la situation du client : l'opération est cohérente et le dossier est mis à jour.",
    "retenir": [
      "Un patrimoine déjà connu au dossier facilite l'examen : le rachat d'un contrat connu est cohérent.",
      "Un avis de rachat est un justificatif fiable.",
      "Si le dossier contient déjà des informations à jour, un contact n'est pas toujours nécessaire."
    ],
    "argumentaire": [
      "Rapprocher le chèque de 30 000 € de l'assurance-vie déjà connue au dossier",
      "Citer l'avis de rachat et le devis de travaux, et vérifier la concordance",
      "Conclure : opération cohérente, pas de déclaration",
      "Mentionner la mise à jour du patrimoine et du projet"
    ]
  },
  {
    "objectif": "Un crédit débloqué puis retiré en espèces en trois jours sur un compte récent : l'usage des fonds n'est pas justifié.",
    "client": {
      "civilite": "M.",
      "prenom": "Dylan",
      "nom": "MARCHAL",
      "age": 26,
      "profession": "Intérimaire (manutention)",
      "situation": "Célibataire",
      "ancienneteMois": 2,
      "revenus": 1500,
      "revenusNote": "missions d'intérim, variables",
      "compte": "00531 833 2260",
      "produits": [
        "Compte courant",
        "Carte Visa Classic",
        "Crédit à la consommation"
      ],
      "coordonnees": {
        "telephone": "01 99 00 11 11",
        "mobile": "06 39 98 11 11",
        "email": "dylan.marchal@example.com",
        "adresse": "9 rue Oberkampf, 75011 Paris"
      },
      "professionnel": "Missions d'intérim depuis un an, dans plusieurs entreprises.",
      "patrimoine": [
        "Aucun placement",
        "Locataire"
      ],
      "miseAJourMois": 2
    },
    "operations": [
      {
        "id": "o1",
        "type": "virement",
        "libelle": "Paie d'intérim",
        "detail": "Virement de l'agence d'intérim",
        "montant": 1500,
        "mois": 2,
        "jour": 28,
        "atypique": false,
        "explication": "Habituelle : paie reçue chaque mois.",
        "sens": "credit"
      },
      {
        "id": "o2",
        "type": "virement",
        "libelle": "Déblocage du crédit à la consommation",
        "detail": "Crédit de 15 000 € accordé par GS Banque & Assurance, motif « projet personnel »",
        "montant": 15000,
        "mois": 1,
        "jour": 3,
        "atypique": false,
        "explication": "Habituelle : opération connue de la banque, qui a accordé le crédit. Ce qui compte, c'est l'usage qui en est fait.",
        "sens": "credit"
      },
      {
        "id": "o3",
        "type": "retrait_especes",
        "libelle": "Retrait d'espèces au guichet",
        "detail": "Le lendemain du déblocage",
        "montant": 4900,
        "mois": 1,
        "jour": 4,
        "atypique": true,
        "explication": "Atypique : retrait presque égal à trois fois la paie mensuelle, juste sous 5 000 €."
      },
      {
        "id": "o4",
        "type": "retrait_especes",
        "libelle": "Retrait d'espèces au guichet",
        "detail": "Deuxième retrait, même montant",
        "montant": 4900,
        "mois": 1,
        "jour": 5,
        "atypique": true,
        "explication": "Atypique : même montant le jour suivant."
      },
      {
        "id": "o5",
        "type": "retrait_especes",
        "libelle": "Retrait d'espèces au guichet",
        "detail": "Troisième retrait, même montant",
        "montant": 4900,
        "mois": 1,
        "jour": 6,
        "atypique": true,
        "explication": "Atypique : 14 700 € retirés en espèces en trois jours, soit presque tout le crédit, sur un compte ouvert depuis deux mois."
      }
    ],
    "pieces": {
      "attendues": [
        "cession_vehicule"
      ],
      "acceptables": [
        "explication",
        "releves_autre_banque"
      ]
    },
    "contact": {
      "canal": "mobile",
      "echange": [
        "M. MARCHAL répète ce qu'il avait dit au guichet : il veut « acheter une voiture à un particulier ». Il ne peut ni nommer le vendeur, ni décrire le véhicule.",
        "Il explique que l'accord est « verbal », que le vendeur ne veut pas de papiers, et demande si tout cela est « vraiment nécessaire »."
      ],
      "recues": [
        "Aucune pièce : pas de promesse de vente, ni certificat de cession, ni facture"
      ],
      "appreciation": "Aucun justificatif, un vendeur inconnu et un usage des fonds invérifiable.",
      "maj": [
        {
          "rubrique": "Usage des fonds",
          "texte": "Achat allégué d'un véhicule à un particulier ; vendeur non identifié, aucune pièce."
        },
        {
          "rubrique": "Ancienneté",
          "texte": "Compte ouvert depuis deux mois ; 14 700 € retirés en espèces en trois jours après le déblocage du crédit."
        }
      ]
    },
    "issue": "declaration",
    "explication": "Presque tout le crédit est retiré en espèces en trois jours, sur un compte ouvert depuis deux mois, pour un achat dont ni le vendeur ni le véhicule ne peuvent être décrits, et sans aucune pièce. Les retraits dépassent aussi 10 000 € dans le mois (COSI). Le doute n'est pas levé : le conseiller signale le dossier à la cellule TRACFIN de l'établissement.",
    "retenir": [
      "Un crédit à la consommation suivi de retraits en espèces est un schéma à surveiller.",
      "Un compte récent, un vendeur inconnu et un accord verbal : l'usage des fonds ne peut pas être vérifié.",
      "Le déblocage d'un crédit accordé par la banque n'est pas en soi atypique : c'est l'usage qui l'est."
    ],
    "argumentaire": [
      "Rapprocher les 14 700 € retirés du crédit et de la paie de 1 500 €",
      "Relever l'ancienneté de deux mois et la rapidité des retraits",
      "Constater l'absence de pièce et l'impossibilité d'identifier le vendeur",
      "Conclure : déclaration à la cellule TRACFIN, sans informer le client"
    ]
  },
  {
    "objectif": "Deux dépôts d'espèces de 2 500 € : le fractionnement est expliqué par le remboursement d'un prêt familial documenté.",
    "client": {
      "civilite": "Mme",
      "prenom": "Sandrine",
      "nom": "MOREL",
      "age": 41,
      "profession": "Aide-soignante",
      "situation": "Divorcée, 2 enfants",
      "ancienneteAns": 11,
      "revenus": 1850,
      "revenusNote": "salaire domicilié",
      "compte": "00531 754 6693",
      "produits": [
        "Compte courant",
        "Carte Visa Classic",
        "Livret A"
      ],
      "coordonnees": {
        "telephone": "01 99 00 12 12",
        "mobile": "06 39 98 12 12",
        "email": "sandrine.morel@example.com",
        "adresse": "7 avenue d'Italie, 75013 Paris"
      },
      "professionnel": "Aide-soignante en CDI dans un établissement de santé depuis 11 ans.",
      "patrimoine": [
        "Livret A : 2 100 €",
        "Locataire"
      ],
      "miseAJourMois": 17
    },
    "observations": [
      "Historique du compte : virement sortant de 5 000 € libellé « prêt à Thomas » il y a trois ans."
    ],
    "operations": [
      {
        "id": "o1",
        "type": "virement",
        "libelle": "Salaire",
        "detail": "Virement mensuel de l'employeur",
        "montant": 1850,
        "mois": 1,
        "jour": 28,
        "atypique": false,
        "explication": "Habituelle : salaire reçu chaque mois.",
        "sens": "credit"
      },
      {
        "id": "o2",
        "type": "depot_especes",
        "libelle": "Dépôt d'espèces en agence",
        "detail": "Premier dépôt",
        "montant": 2500,
        "mois": 1,
        "jour": 6,
        "atypique": true,
        "explication": "Atypique : première opération en espèces du dossier, montant supérieur à un mois de salaire."
      },
      {
        "id": "o3",
        "type": "depot_especes",
        "libelle": "Dépôt d'espèces en agence",
        "detail": "Deuxième dépôt, dix jours plus tard",
        "montant": 2500,
        "mois": 1,
        "jour": 16,
        "atypique": true,
        "explication": "Atypique : même montant. Total des deux dépôts : 5 000 €, sous le seuil de 10 000 € du mois."
      },
      {
        "id": "o4",
        "type": "retrait_especes",
        "libelle": "Retrait au distributeur",
        "detail": "Retrait habituel",
        "montant": 150,
        "mois": 1,
        "jour": 12,
        "atypique": false,
        "explication": "Habituelle : retrait courant de 150 €."
      }
    ],
    "pieces": {
      "attendues": [
        "reconnaissance_dette"
      ],
      "acceptables": [
        "releves_autre_banque",
        "explication"
      ]
    },
    "contact": {
      "canal": "mobile",
      "echange": [
        "Mme MOREL explique que son frère Thomas lui rembourse en deux fois les 5 000 € qu'elle lui avait prêtés il y a trois ans. Il lui a remis les espèces de la main à la main.",
        "Elle retrouve et transmet la reconnaissance de dette."
      ],
      "recues": [
        "Reconnaissance de dette de 5 000 € signée par M. Thomas MOREL, datée d'il y a trois ans",
        "Le virement de 5 000 € de la même période figure dans l'historique du compte"
      ],
      "appreciation": "La reconnaissance de dette et l'ancien virement correspondent exactement au total des deux dépôts.",
      "maj": [
        {
          "rubrique": "Situation patrimoniale",
          "texte": "Prêt familial de 5 000 € à son frère, intégralement remboursé."
        }
      ]
    },
    "issue": "coherent",
    "explication": "Deux dépôts en espèces, mais leur total (5 000 €) est exactement le prêt que la cliente avait consenti à son frère, prouvé par une reconnaissance de dette et par un virement déjà visible dans l'historique du compte. Le fractionnement seul n'est pas un indice de blanchiment quand il est expliqué et justifié : l'opération est cohérente.",
    "retenir": [
      "Le fractionnement en deux dépôts n'est pas suffisant pour déclarer : il faut le rapprocher des explications et des pièces.",
      "L'historique du compte est une pièce du dossier : il peut corroborer un justificatif.",
      "Le total des dépôts (5 000 €) doit correspondre au montant justifié."
    ],
    "argumentaire": [
      "Rapprocher les deux dépôts de 2 500 € (5 000 € au total) du salaire et du patrimoine de la cliente",
      "Citer la reconnaissance de dette et l'ancien virement de 5 000 € dans l'historique",
      "Conclure : opération cohérente, pas de déclaration",
      "Mentionner la mise à jour du dossier (prêt familial remboursé)"
    ]
  },
  {
    "objectif": "Des remises d'espèces bien supérieures aux recettes du livre : un écart de 17 600 € que le restaurateur ne peut pas expliquer.",
    "client": {
      "civilite": "M.",
      "prenom": "Laurent",
      "nom": "BONNET",
      "age": 44,
      "profession": "Restaurateur (entreprise individuelle)",
      "situation": "Marié, 3 enfants",
      "ancienneteAns": 12,
      "revenus": 2900,
      "revenusNote": "bénéfices moyens de l'activité",
      "compte": "00531 169 4472",
      "produits": [
        "Compte courant",
        "Carte Visa Premier",
        "Crédit professionnel",
        "Livret A"
      ],
      "coordonnees": {
        "telephone": "01 99 00 13 13",
        "mobile": "06 39 98 13 13",
        "email": "laurent.bonnet@example.com",
        "adresse": "45 rue Saint-Antoine, 75004 Paris"
      },
      "professionnel": "Restaurant de 40 couverts en centre-ville, exploité depuis 12 ans.",
      "patrimoine": [
        "Fonds de commerce (crédit professionnel en cours)",
        "Livret A : 6 000 €"
      ],
      "miseAJourMois": 9
    },
    "operations": [
      {
        "id": "o1",
        "type": "depot_especes",
        "libelle": "Remises d'espèces hebdomadaires (4 remises)",
        "detail": "Recettes du restaurant, de 1 000 à 1 800 € par semaine",
        "montant": 5600,
        "mois": 1,
        "jour": 26,
        "atypique": false,
        "explication": "Habituelle : rythme et montants habituels, en rapport avec l'activité."
      },
      {
        "id": "o2",
        "type": "depot_especes",
        "libelle": "Remise d'espèces au guichet",
        "detail": "Remise exceptionnelle",
        "montant": 9500,
        "mois": 1,
        "jour": 12,
        "atypique": true,
        "explication": "Atypique : montant plus de cinq fois supérieur aux remises habituelles."
      },
      {
        "id": "o3",
        "type": "depot_especes",
        "libelle": "Remise d'espèces au guichet",
        "detail": "Seconde remise exceptionnelle",
        "montant": 11800,
        "mois": 1,
        "jour": 24,
        "atypique": true,
        "explication": "Atypique : les espèces du mois atteignent 26 900 €, soit plus de quatre fois le niveau habituel."
      },
      {
        "id": "o4",
        "type": "depot_cheque",
        "libelle": "Remise de chèques de clients",
        "detail": "Groupe de chèques habituels",
        "montant": 1200,
        "mois": 1,
        "jour": 25,
        "atypique": false,
        "explication": "Habituelle : remise de chèques courante pour un restaurant."
      }
    ],
    "pieces": {
      "attendues": [
        "recettes"
      ],
      "acceptables": [
        "avis_impo",
        "explication"
      ]
    },
    "contact": {
      "canal": "telephone",
      "echange": [
        "M. BONNET parle d'un mois d'activité exceptionnel, sans pouvoir le chiffrer. Il propose de montrer son livre de recettes.",
        "Le livre est transmis : il ne peut pas expliquer l'écart avec les espèces remises et finit par dire qu'il « verra avec son comptable »."
      ],
      "recues": [
        "Livre de recettes du mois : 9 300 € de recettes au total"
      ],
      "appreciation": "Les recettes enregistrées (9 300 €) sont très inférieures aux espèces remises (26 900 €) : écart de 17 600 € sans explication.",
      "maj": [
        {
          "rubrique": "Situation professionnelle",
          "texte": "Recettes du mois inscrites au livre : 9 300 €. Espèces remises dans le mois : 26 900 €."
        },
        {
          "rubrique": "Fonctionnement du compte",
          "texte": "Remises exceptionnelles de 9 500 € et 11 800 € en plus des remises hebdomadaires."
        }
      ]
    },
    "issue": "declaration",
    "explication": "Le livre de recettes ne couvre pas les remises : 9 300 € de recettes pour 26 900 € d'espèces déposées, soit un écart de 17 600 € que le client ne peut pas expliquer. Des dépôts d'espèces non justifiés par le niveau d'activité sont un indicateur de soupçon : le conseiller signale le dossier à la cellule TRACFIN de l'établissement. Le seuil de 10 000 € d'espèces du mois est dépassé (COSI), mais la décision repose sur l'écart, pas sur le seuil.",
    "retenir": [
      "Un livre de recettes justifie des espèces seulement s'il couvre les montants déposés.",
      "Comparer toujours les justificatifs aux montants : ici l'écart est de 17 600 €.",
      "Le dépassement du seuil COSI ne suffit ni à déclarer ni à classer : c'est la cohérence avec l'activité qui décide."
    ],
    "argumentaire": [
      "Rapprocher les 26 900 € d'espèces des remises habituelles (5 600 € environ)",
      "Comparer les recettes du livre (9 300 €) aux espèces remises et calculer l'écart (17 600 €)",
      "Relever que le client ne peut pas expliquer l'écart",
      "Conclure : déclaration à la cellule TRACFIN, sans informer le client"
    ]
  },
  {
    "objectif": "Un retrait de 7 000 € en espèces pour acheter une moto à un particulier : un client aisé, une vente documentée.",
    "client": {
      "civilite": "M.",
      "prenom": "Aziz",
      "nom": "CHARPENTIER",
      "age": 57,
      "profession": "Chef de chantier",
      "situation": "Marié, 3 enfants",
      "ancienneteAns": 22,
      "revenus": 3200,
      "revenusNote": "salaire domicilié",
      "compte": "00531 502 1184",
      "produits": [
        "Compte courant",
        "Carte Visa Premier",
        "Livret A",
        "Assurance-vie"
      ],
      "coordonnees": {
        "telephone": "01 99 00 14 14",
        "mobile": "06 39 98 14 14",
        "email": "aziz.charpentier@example.com",
        "adresse": "18 rue de Charenton, 75012 Paris"
      },
      "professionnel": "Chef de chantier en CDI depuis 22 ans dans la même entreprise.",
      "patrimoine": [
        "Résidence principale (propriétaire, sans crédit)",
        "Livret A : 25 000 €",
        "Assurance-vie : 40 000 €"
      ],
      "miseAJourMois": 14
    },
    "observations": [
      "Au guichet, le client a indiqué qu'il voulait « acheter un véhicule à un particulier »."
    ],
    "operations": [
      {
        "id": "o1",
        "type": "virement",
        "libelle": "Salaire",
        "detail": "Virement mensuel de l'employeur",
        "montant": 3200,
        "mois": 1,
        "jour": 28,
        "atypique": false,
        "explication": "Habituelle : salaire reçu chaque mois.",
        "sens": "credit"
      },
      {
        "id": "o2",
        "type": "retrait_especes",
        "libelle": "Retrait d'espèces au guichet",
        "detail": "Retrait demandé en agence",
        "montant": 7000,
        "mois": 1,
        "jour": 14,
        "atypique": true,
        "explication": "Atypique : somme plus de vingt fois supérieure aux retraits habituels de 300 €."
      },
      {
        "id": "o3",
        "type": "retrait_especes",
        "libelle": "Retrait au distributeur",
        "detail": "Retrait habituel",
        "montant": 300,
        "mois": 1,
        "jour": 6,
        "atypique": false,
        "explication": "Habituelle : retrait mensuel de 300 €."
      }
    ],
    "pieces": {
      "attendues": [
        "cession_vehicule"
      ],
      "acceptables": [
        "explication"
      ]
    },
    "contact": {
      "canal": "mobile",
      "echange": [
        "M. CHARPENTIER explique qu'il a acheté une moto ancienne à un particulier, rencontré dans un club. Le vendeur souhaitait être payé en espèces, remises en main propre.",
        "Il transmet le certificat de cession signé et la facture du vendeur."
      ],
      "recues": [
        "Certificat de cession de la moto, signé des deux parties, daté du jour du retrait",
        "Facture du vendeur de 7 000 €"
      ],
      "appreciation": "Le certificat et la facture correspondent au retrait : montant et date.",
      "maj": [
        {
          "rubrique": "Situation patrimoniale",
          "texte": "Achat d'une moto ancienne pour 7 000 €, financé par les économies du client."
        },
        {
          "rubrique": "Centres d'intérêt",
          "texte": "Passionné de motos anciennes ; membre d'un club."
        }
      ]
    },
    "issue": "coherent",
    "explication": "Le retrait est élevé par rapport aux habitudes, mais le client dispose d'une épargne largement suffisante (65 000 €), il avait annoncé le motif au guichet et il produit un certificat de cession et une facture correspondant au montant et à la date. L'opération est cohérente avec sa situation et le dossier est mis à jour.",
    "retenir": [
      "Un retrait atypique peut être cohérent quand le client a les moyens et un justificatif concordant.",
      "Le motif annoncé au guichet est un indice à rapprocher des pièces.",
      "Les retraits d'espèces ne peuvent pas, à eux seuls, justifier une déclaration : on regarde la cohérence d'ensemble."
    ],
    "argumentaire": [
      "Rapprocher le retrait de 7 000 € des revenus de 3 200 € et de l'épargne de 65 000 €",
      "Citer le certificat de cession et la facture, et vérifier la concordance avec le retrait",
      "Conclure : opération cohérente, pas de déclaration",
      "Mentionner la mise à jour du dossier (achat de la moto)"
    ]
  },
  {
    "objectif": "Des dépôts d'espèces suivis de retraits presque identiques le lendemain : un compte de passage pour un tiers, contre rémunération.",
    "client": {
      "civilite": "Mme",
      "prenom": "Nathalie",
      "nom": "GIRAUD",
      "age": 52,
      "profession": "Agent d'entretien (temps partiel)",
      "situation": "Divorcée",
      "ancienneteAns": 8,
      "revenus": 1250,
      "revenusNote": "salaire domicilié",
      "compte": "00531 718 3306",
      "produits": [
        "Compte courant",
        "Carte de retrait",
        "Livret A"
      ],
      "coordonnees": {
        "telephone": "01 99 00 15 15",
        "mobile": "06 39 98 15 15",
        "email": "nathalie.giraud@example.com",
        "adresse": "21 rue des Pyrénées, 75020 Paris"
      },
      "professionnel": "Agent d'entretien à temps partiel depuis 8 ans.",
      "patrimoine": [
        "Livret A : 600 €",
        "Locataire"
      ],
      "miseAJourMois": 19
    },
    "operations": [
      {
        "id": "o1",
        "type": "virement",
        "libelle": "Salaire",
        "detail": "Virement mensuel de l'employeur",
        "montant": 1250,
        "mois": 1,
        "jour": 28,
        "atypique": false,
        "explication": "Habituelle : salaire reçu chaque mois.",
        "sens": "credit"
      },
      {
        "id": "o2",
        "type": "depot_especes",
        "libelle": "Dépôt d'espèces en agence",
        "detail": "Premier dépôt",
        "montant": 3000,
        "mois": 1,
        "jour": 5,
        "atypique": true,
        "explication": "Atypique : somme égale à plus de deux mois de salaire, première opération en espèces du dossier."
      },
      {
        "id": "o3",
        "type": "retrait_especes",
        "libelle": "Retrait d'espèces au guichet",
        "detail": "Le lendemain du dépôt",
        "montant": 2950,
        "mois": 1,
        "jour": 6,
        "atypique": true,
        "explication": "Atypique : retrait presque égal au dépôt, moins de 24 heures plus tard."
      },
      {
        "id": "o4",
        "type": "depot_especes",
        "libelle": "Dépôt d'espèces en agence",
        "detail": "Second dépôt, neuf jours plus tard",
        "montant": 3000,
        "mois": 1,
        "jour": 14,
        "atypique": true,
        "explication": "Atypique : même montant exact."
      },
      {
        "id": "o5",
        "type": "retrait_especes",
        "libelle": "Retrait d'espèces au guichet",
        "detail": "Le lendemain du dépôt",
        "montant": 2950,
        "mois": 1,
        "jour": 15,
        "atypique": true,
        "explication": "Atypique : même schéma, soit 6 000 € déposés et 5 900 € retirés en dix jours."
      }
    ],
    "pieces": {
      "attendues": [
        "explication"
      ],
      "acceptables": [
        "releves_autre_banque"
      ]
    },
    "contact": {
      "canal": "mobile",
      "echange": [
        "Mme GIRAUD explique qu'elle « rend service à un cousin » qui n'a pas de compte : il lui remet des espèces, qu'elle dépose, puis elle les retire le lendemain pour les lui rendre.",
        "Elle garde 50 € à chaque fois. Elle ne donne que son prénom (Franck), ne sait pas d'où viennent les espèces et ne fournit aucun document."
      ],
      "recues": [
        "Aucune pièce"
      ],
      "appreciation": "Le compte sert d'intermédiaire à un tiers non identifié, contre rémunération, sans justification de l'origine des fonds.",
      "maj": [
        {
          "rubrique": "Utilisation du compte",
          "texte": "Les espèces déposées sont remises par un tiers (cousin « Franck ») puis reprises par lui le lendemain, contre 50 € par opération."
        },
        {
          "rubrique": "Origine des fonds",
          "texte": "Inconnue ; le tiers n'est connu que par son prénom."
        }
      ]
    },
    "issue": "declaration",
    "explication": "Les dépôts d'espèces sont retirés presque à l'identique dès le lendemain : le compte sert de compte de passage pour un tiers, contre rémunération, sans que l'origine des fonds ni le bénéficiaire ne soient connus. Cela n'a aucun rapport avec la situation de la cliente : le conseiller signale le dossier à la cellule TRACFIN de l'établissement.",
    "retenir": [
      "Un dépôt suivi d'un retrait presque identique dans les 24 heures est un schéma de compte de passage.",
      "Le bénéficiaire effectif d'une opération doit être identifié.",
      "Rendre service à un tiers avec son compte ne justifie pas l'opération : la déclaration reste obligatoire."
    ],
    "argumentaire": [
      "Rapprocher les 6 000 € déposés du salaire de 1 250 € et des habitudes de la cliente",
      "Relever les retraits presque identiques aux dépôts, le lendemain",
      "Citer l'explication (service rendu à un cousin, 50 € de commission) et l'absence de pièce",
      "Conclure : déclaration à la cellule TRACFIN, sans informer la cliente"
    ]
  },
  {
    "objectif": "Un chèque de 18 000 € pour la vente d'une montre de famille : des justificatifs partiels qui couvrent l'essentiel peuvent suffire.",
    "client": {
      "civilite": "Mme",
      "prenom": "Hélène",
      "nom": "DUBOIS",
      "age": 46,
      "profession": "Responsable comptable",
      "situation": "Mariée, 2 enfants",
      "ancienneteAns": 15,
      "revenus": 3900,
      "revenusNote": "salaire domicilié",
      "compte": "00531 044 7821",
      "produits": [
        "Compte courant",
        "Carte Visa Premier",
        "Livret A",
        "Crédit immobilier"
      ],
      "coordonnees": {
        "telephone": "01 99 00 16 16",
        "mobile": "06 39 98 16 16",
        "email": "helene.dubois@example.com",
        "adresse": "12 rue Legendre, 75017 Paris"
      },
      "professionnel": "Responsable comptable en CDI depuis 15 ans.",
      "patrimoine": [
        "Résidence principale (crédit immobilier en cours)",
        "Livret A : 15 000 €",
        "Collection de montres reçue de son père (mentionnée au dossier)"
      ],
      "miseAJourMois": 21
    },
    "operations": [
      {
        "id": "o1",
        "type": "virement",
        "libelle": "Salaire",
        "detail": "Virement mensuel de l'employeur",
        "montant": 3900,
        "mois": 1,
        "jour": 28,
        "atypique": false,
        "explication": "Habituelle : salaire reçu chaque mois.",
        "sens": "credit"
      },
      {
        "id": "o2",
        "type": "depot_cheque",
        "libelle": "Chèque de M. Laurent PERRIN",
        "detail": "Chèque de 18 000 € tiré par un particulier",
        "montant": 18000,
        "mois": 1,
        "jour": 11,
        "atypique": true,
        "explication": "Atypique : montant supérieur à quatre mois de salaire, tireur inconnu."
      },
      {
        "id": "o3",
        "type": "retrait_especes",
        "libelle": "Retrait au distributeur",
        "detail": "Retrait habituel",
        "montant": 200,
        "mois": 1,
        "jour": 9,
        "atypique": false,
        "explication": "Habituelle : retrait courant de 200 €."
      }
    ],
    "pieces": {
      "attendues": [
        "vente_bien"
      ],
      "acceptables": [
        "explication"
      ]
    },
    "contact": {
      "canal": "mobile",
      "echange": [
        "Mme DUBOIS explique qu'elle a vendu une montre de collection héritée de son père à un collectionneur, M. PERRIN, par l'intermédiaire d'un expert horloger.",
        "Elle ne retrouve pas la facture d'achat d'origine : la montre venait de la succession de son père."
      ],
      "recues": [
        "Contrat de vente signé de 18 000 € entre Mme DUBOIS et M. PERRIN",
        "Certificat de l'expert horloger (authenticité et estimation)"
      ],
      "appreciation": "Le contrat et le certificat correspondent au chèque. La facture d'origine manque, mais la collection figurait déjà au dossier et vient d'une succession : les pièces couvrent l'essentiel de l'opération.",
      "maj": [
        {
          "rubrique": "Situation patrimoniale",
          "texte": "Vente d'une montre de collection : 18 000 € reçus."
        },
        {
          "rubrique": "Origine du bien",
          "texte": "Bien reçu de son père (succession), déjà mentionné au dossier ; facture d'origine introuvable."
        }
      ]
    },
    "issue": "coherent",
    "explication": "Il manque la facture d'achat d'origine, mais le contrat de vente et le certificat de l'expert correspondent au chèque, et la collection venait d'une succession déjà connue au dossier. Des justificatifs partiels peuvent suffire lorsqu'ils couvrent l'essentiel de l'opération : elle est cohérente et le dossier est mis à jour.",
    "retenir": [
      "Des justificatifs partiels peuvent suffire s'ils couvrent l'essentiel de l'opération.",
      "Un bien déjà mentionné au dossier rend le justificatif plus crédible.",
      "Il faut tout de même consigner par écrit ce qui manque et pourquoi on l'accepte."
    ],
    "argumentaire": [
      "Rapprocher le chèque de 18 000 € du salaire et du patrimoine connu (collection de montres)",
      "Citer le contrat de vente et le certificat de l'expert, et relever la pièce manquante",
      "Expliquer pourquoi les pièces reçues suffisent : elles couvrent l'essentiel de l'opération",
      "Conclure : opération cohérente, pas de déclaration"
    ]
  },
  {
    "objectif": "Un chèque de 19 500 € d'une société sur le compte d'un retraité : des « commissions » sans contrat ni facture.",
    "client": {
      "civilite": "M.",
      "prenom": "Claude",
      "nom": "BRIAND",
      "age": 70,
      "profession": "Retraité (ancien employé municipal)",
      "situation": "Marié",
      "ancienneteAns": 35,
      "revenus": 1380,
      "revenusNote": "pensions de retraite",
      "compte": "00531 380 2915",
      "produits": [
        "Compte courant",
        "Carte Visa Classic",
        "Livret A"
      ],
      "coordonnees": {
        "telephone": "01 99 00 17 17",
        "mobile": "06 39 98 17 17",
        "email": "claude.briand@example.com",
        "adresse": "6 rue du Château d'Eau, 75010 Paris"
      },
      "professionnel": "Retraité depuis 2016. Aucune activité déclarée depuis.",
      "patrimoine": [
        "Résidence principale (propriétaire, sans crédit)",
        "Livret A : 9 000 €"
      ],
      "miseAJourMois": 27
    },
    "operations": [
      {
        "id": "o1",
        "type": "virement",
        "libelle": "Pensions de retraite",
        "detail": "Virement mensuel des caisses de retraite",
        "montant": 1380,
        "mois": 1,
        "jour": 5,
        "atypique": false,
        "explication": "Habituelle : pension reçue chaque mois.",
        "sens": "credit"
      },
      {
        "id": "o2",
        "type": "depot_cheque",
        "libelle": "Chèque de la SARL Horizon Négoce",
        "detail": "Libellé : « commission »",
        "montant": 19500,
        "mois": 1,
        "jour": 13,
        "atypique": true,
        "explication": "Atypique : montant supérieur à 14 mois de pension, venant d'une société sans lien connu avec le client."
      },
      {
        "id": "o3",
        "type": "retrait_especes",
        "libelle": "Retrait au distributeur",
        "detail": "Retrait habituel",
        "montant": 200,
        "mois": 1,
        "jour": 10,
        "atypique": false,
        "explication": "Habituelle : retrait courant de 200 €."
      }
    ],
    "pieces": {
      "attendues": [
        "factures"
      ],
      "acceptables": [
        "explication"
      ]
    },
    "contact": {
      "canal": "telephone",
      "echange": [
        "M. BRIAND dit avoir « rendu service » en mettant en relation deux entreprises, et que la société l'a remercié par une commission.",
        "Il n'a signé aucun contrat, n'a pas établi de facture, ne connaît pas le gérant de la société et ne sait pas dire comment il a été contacté."
      ],
      "recues": [
        "Aucun contrat, aucune facture, aucun échange écrit"
      ],
      "appreciation": "Une rémunération importante, sans prestation identifiable ni document, venant d'une société sans lien connu avec un retraité sans activité déclarée.",
      "maj": [
        {
          "rubrique": "Situation professionnelle",
          "texte": "Aucune activité déclarée ; commission alléguée pour une mise en relation, sans contrat ni facture."
        },
        {
          "rubrique": "Origine des fonds",
          "texte": "Aucun document fourni."
        }
      ]
    },
    "issue": "declaration",
    "explication": "Un retraité sans activité déclarée reçoit 19 500 € d'une société qu'il ne connaît pas, pour une « commission » sans contrat, sans facture et sans prestation décrite. L'opération n'a pas de justification économique apparente : le doute n'est pas levé et le conseiller signale le dossier à la cellule TRACFIN de l'établissement.",
    "retenir": [
      "Une opération sans justification économique apparente relève de l'examen renforcé.",
      "Une prestation se justifie par un contrat, un devis ou une facture, ce que le client n'a pas.",
      "Le client n'est jamais informé de la déclaration (art. L561-18)."
    ],
    "argumentaire": [
      "Rapprocher les 19 500 € de la pension de 1 380 € et de l'absence d'activité déclarée",
      "Relever que la société n'a aucun lien connu avec le client",
      "Constater l'absence de contrat, de facture et de prestation décrite",
      "Conclure : déclaration à la cellule TRACFIN, sans informer le client"
    ]
  },
  {
    "objectif": "Un chèque d'assureur de 21 000 € sur le compte d'un artisan dont l'atelier a brûlé : le courrier de l'assureur le justifie.",
    "client": {
      "civilite": "M.",
      "prenom": "Frédéric",
      "nom": "LEMAIRE",
      "age": 43,
      "profession": "Artisan menuisier (entreprise individuelle)",
      "situation": "Marié, 2 enfants",
      "ancienneteAns": 13,
      "revenus": 2800,
      "revenusNote": "bénéfices moyens de l'activité",
      "compte": "00531 906 3340",
      "produits": [
        "Compte courant",
        "Carte Visa Classic",
        "Crédit professionnel",
        "Livret A"
      ],
      "coordonnees": {
        "telephone": "01 99 00 18 18",
        "mobile": "06 39 98 18 18",
        "email": "frederic.lemaire@example.com",
        "adresse": "2 rue Crozatier, 75012 Paris"
      },
      "professionnel": "Menuiserie en entreprise individuelle, atelier en zone artisanale.",
      "patrimoine": [
        "Atelier (propriétaire, crédit professionnel en cours)",
        "Livret A : 4 000 €"
      ],
      "miseAJourMois": 10
    },
    "operations": [
      {
        "id": "o1",
        "type": "depot_cheque",
        "libelle": "Remise de chèques de clients",
        "detail": "Trois chèques de clients",
        "montant": 2400,
        "mois": 1,
        "jour": 20,
        "atypique": false,
        "explication": "Habituelle : remise de chèques courante pour un artisan."
      },
      {
        "id": "o2",
        "type": "depot_cheque",
        "libelle": "Chèque de l'assureur",
        "detail": "Libellé : « indemnité sinistre »",
        "montant": 21000,
        "mois": 1,
        "jour": 19,
        "atypique": true,
        "explication": "Atypique : montant égal à plus de sept mois de revenus, venant d'un émetteur qui n'a jamais figuré au compte."
      },
      {
        "id": "o3",
        "type": "retrait_especes",
        "libelle": "Retrait au distributeur",
        "detail": "Retrait habituel",
        "montant": 300,
        "mois": 1,
        "jour": 8,
        "atypique": false,
        "explication": "Habituelle : retrait courant de 300 €."
      }
    ],
    "pieces": {
      "attendues": [
        "indemnite_assurance"
      ],
      "acceptables": [
        "factures",
        "explication"
      ]
    },
    "contact": {
      "canal": "mobile",
      "echange": [
        "M. LEMAIRE explique que son atelier a été partiellement détruit par un incendie en juin. L'assureur lui verse une indemnité pour remplacer le matériel détruit.",
        "Il transmet le courrier de l'assureur et le devis de remplacement."
      ],
      "recues": [
        "Courrier de l'assureur : indemnité de 21 000 € pour le sinistre « incendie atelier »",
        "Devis de remplacement du matériel de 22 400 €"
      ],
      "appreciation": "Le courrier de l'assureur correspond au chèque (émetteur, montant). Le devis de remplacement est du même ordre de grandeur.",
      "maj": [
        {
          "rubrique": "Situation professionnelle",
          "texte": "Atelier sinistré par un incendie en juin ; indemnité de 21 000 € pour le remplacement du matériel."
        },
        {
          "rubrique": "Projet",
          "texte": "Rachat de matériel pour environ 22 400 €."
        }
      ]
    },
    "issue": "coherent",
    "explication": "Le chèque vient d'un assureur et le courrier d'indemnisation le justifie, avec un devis de remplacement du même ordre de grandeur. L'opération est cohérente avec la situation de l'artisan et le dossier est mis à jour.",
    "retenir": [
      "Une indemnité d'assurance se justifie par le courrier de l'assureur.",
      "Le devis de remplacement renforce la cohérence de l'opération.",
      "La mise à jour du dossier consigne le sinistre et le projet qui en découle."
    ],
    "argumentaire": [
      "Rapprocher le chèque de 21 000 € de l'activité de l'artisan et de l'incendie évoqué",
      "Citer le courrier de l'assureur et le devis, et vérifier la concordance",
      "Conclure : opération cohérente, pas de déclaration",
      "Mentionner la mise à jour du dossier (sinistre, projet de remplacement)"
    ]
  },
  {
    "objectif": "Trois dépôts de 2 900 € le même jour dans trois agences, et un client injoignable : le doute ne peut pas être levé.",
    "client": {
      "civilite": "M.",
      "prenom": "Jonathan",
      "nom": "GILLET",
      "age": 34,
      "profession": "Serveur (restauration)",
      "situation": "Célibataire",
      "ancienneteAns": 7,
      "revenus": 1650,
      "revenusNote": "salaire domicilié, hors pourboires",
      "compte": "00531 215 8870",
      "produits": [
        "Compte courant",
        "Carte Visa Classic",
        "Livret A"
      ],
      "coordonnees": {
        "telephone": "01 99 00 19 19",
        "mobile": "06 39 98 19 19",
        "email": "jonathan.gillet@example.com",
        "adresse": "40 rue de Ménilmontant, 75020 Paris"
      },
      "professionnel": "Serveur en CDI dans un restaurant depuis 5 ans.",
      "patrimoine": [
        "Livret A : 1 100 €",
        "Locataire"
      ],
      "miseAJourMois": 24
    },
    "operations": [
      {
        "id": "o1",
        "type": "virement",
        "libelle": "Salaire",
        "detail": "Virement mensuel de l'employeur",
        "montant": 1650,
        "mois": 1,
        "jour": 28,
        "atypique": false,
        "explication": "Habituelle : salaire reçu chaque mois.",
        "sens": "credit"
      },
      {
        "id": "o2",
        "type": "depot_especes",
        "libelle": "Dépôt d'espèces, agence de Paris-Bastille",
        "detail": "Le même jour, premier dépôt",
        "montant": 2900,
        "mois": 1,
        "jour": 10,
        "atypique": true,
        "explication": "Atypique : plus de dix fois les dépôts habituels de moins de 200 €."
      },
      {
        "id": "o3",
        "type": "depot_especes",
        "libelle": "Dépôt d'espèces, agence de Paris-République",
        "detail": "Le même jour, deuxième dépôt",
        "montant": 2900,
        "mois": 1,
        "jour": 10,
        "atypique": true,
        "explication": "Atypique : même montant, dans une autre agence, le même jour."
      },
      {
        "id": "o4",
        "type": "depot_especes",
        "libelle": "Dépôt d'espèces, agence de Blagnac",
        "detail": "Le même jour, troisième dépôt",
        "montant": 2900,
        "mois": 1,
        "jour": 10,
        "atypique": true,
        "explication": "Atypique : trois dépôts identiques dans trois agences, 8 700 € au total, sous le seuil de 10 000 € du mois."
      },
      {
        "id": "o5",
        "type": "retrait_especes",
        "libelle": "Retrait au distributeur",
        "detail": "Retrait habituel",
        "montant": 120,
        "mois": 1,
        "jour": 15,
        "atypique": false,
        "explication": "Habituelle : retrait courant de 120 €."
      }
    ],
    "pieces": {
      "attendues": [
        "explication"
      ],
      "acceptables": [
        "avis_impo",
        "bulletins"
      ]
    },
    "contact": {
      "canal": "courrier",
      "echange": [
        "Trois appels sur le mobile et le fixe, restés sans réponse, puis un courrier à l'adresse du dossier et un e-mail : aucune réponse au bout de dix jours.",
        "Le client n'a pas non plus répondu à une convocation en agence."
      ],
      "recues": [
        "Aucune réponse du client, aucune pièce"
      ],
      "appreciation": "Le client n'explique rien et ne justifie rien. L'absence de réponse seule ne suffit pas à déclarer, mais elle s'ajoute à d'autres indices : dépôts identiques dans trois agences le même jour, juste sous le seuil.",
      "maj": [
        {
          "rubrique": "Contact client",
          "texte": "Client injoignable : 3 appels, 1 courrier, 1 e-mail et 1 convocation sans réponse en dix jours."
        },
        {
          "rubrique": "Origine des fonds",
          "texte": "Inconnue ; aucune justification."
        }
      ]
    },
    "issue": "declaration",
    "explication": "Trois dépôts identiques de 2 900 € le même jour dans trois agences (8 700 €, juste sous 10 000 €) ne correspondent ni au salaire ni aux pourboires habituels, et le client reste injoignable. Le refus de répondre ne suffit pas à lui seul à déclarer, mais combiné au fractionnement géographique et à l'absence de toute justification il ne permet pas de lever le doute : le conseiller signale le dossier à la cellule TRACFIN de l'établissement.",
    "retenir": [
      "Un client qui ne répond pas ne justifie rien : le doute n'est pas levé.",
      "L'absence de réponse seule ne suffit pas à déclarer ; ici elle s'ajoute au fractionnement dans trois agences le même jour.",
      "Les démarches de contact (appels, courrier, convocation) sont tracées dans le dossier."
    ],
    "argumentaire": [
      "Rapprocher les 8 700 € déposés du salaire de 1 650 € et des dépôts habituels de pourboires",
      "Relever les trois dépôts identiques dans trois agences le même jour, sous le seuil",
      "Décrire les démarches de contact et l'absence de réponse",
      "Conclure : déclaration à la cellule TRACFIN, sans informer le client"
    ]
  },
  {
    "objectif": "Un dépôt de 15 000 € en espèces par une étudiante, justifié par une simple attestation du père : sans élément corroborant, elle ne suffit pas.",
    "client": {
      "civilite": "Mme",
      "prenom": "Lucie",
      "nom": "FAIVRE",
      "age": 20,
      "profession": "Étudiante (licence)",
      "situation": "Célibataire",
      "ancienneteAns": 3,
      "revenus": 650,
      "revenusNote": "aide familiale et petit emploi étudiant",
      "compte": "00531 647 2203",
      "produits": [
        "Compte courant",
        "Carte de retrait",
        "Livret A"
      ],
      "coordonnees": {
        "telephone": "01 99 00 20 20",
        "mobile": "06 39 98 20 20",
        "email": "lucie.faivre@example.com",
        "adresse": "4 rue Claude Bernard, 75005 Paris"
      },
      "professionnel": "Étudiante en licence, petit emploi étudiant quelques heures par semaine.",
      "patrimoine": [
        "Livret A : 400 €",
        "Aucun bien"
      ],
      "miseAJourMois": 14
    },
    "observations": [
      "Au guichet, la cliente a dit que l'argent venait de son père."
    ],
    "operations": [
      {
        "id": "o1",
        "type": "virement",
        "libelle": "Aide mensuelle de la famille",
        "detail": "Virement mensuel",
        "montant": 450,
        "mois": 1,
        "jour": 3,
        "atypique": false,
        "explication": "Habituelle : aide reçue chaque mois.",
        "sens": "credit"
      },
      {
        "id": "o2",
        "type": "depot_especes",
        "libelle": "Dépôt d'espèces en agence",
        "detail": "Dépôt unique de 15 000 €",
        "montant": 15000,
        "mois": 1,
        "jour": 9,
        "atypique": true,
        "explication": "Atypique : somme égale à plus de deux ans de revenus, première opération en espèces du dossier. Les espèces du mois dépassent 10 000 € (COSI)."
      },
      {
        "id": "o3",
        "type": "retrait_especes",
        "libelle": "Retrait au distributeur",
        "detail": "Retrait habituel",
        "montant": 60,
        "mois": 1,
        "jour": 17,
        "atypique": false,
        "explication": "Habituelle : retrait courant de 60 €."
      }
    ],
    "pieces": {
      "attendues": [
        "acte_donation"
      ],
      "acceptables": [
        "releves_autre_banque",
        "explication"
      ]
    },
    "contact": {
      "canal": "mobile",
      "echange": [
        "Mme FAIVRE explique que son père lui a remis les espèces « pour l'aider à acheter un petit studio ». Elle ne sait pas d'où viennent ces espèces.",
        "Elle transmet une attestation sur l'honneur signée de son père et une copie de sa pièce d'identité, et rien d'autre."
      ],
      "recues": [
        "Attestation sur l'honneur du père (une page) et copie de sa pièce d'identité"
      ],
      "appreciation": "Aucun acte de donation, aucun relevé du père : l'attestation sur l'honneur n'est corroborée par aucun élément. L'origine des espèces détenues par le père n'est pas établie.",
      "maj": [
        {
          "rubrique": "Origine des fonds",
          "texte": "Don allégué du père (15 000 €), attesté par le père seul ; aucun acte ni relevé. Père non client de l'établissement."
        },
        {
          "rubrique": "Projet",
          "texte": "Achat d'un studio évoqué, sans compromis ni projet précis."
        }
      ]
    },
    "issue": "declaration",
    "explication": "Une simple attestation sur l'honneur, sans acte de donation ni relevé bancaire du père, ne justifie pas 15 000 € d'espèces déposés par une étudiante dont les revenus sont de 650 € par mois. L'origine des fonds reste inconnue et aucun élément ne corrobore le don : le conseiller signale le dossier à la cellule TRACFIN de l'établissement.",
    "retenir": [
      "Une attestation sur l'honneur seule, sans élément corroborant, n'est pas un justificatif probant.",
      "Comparer avec le dossier de donation cohérent : là, un acte notarié justifiait le don.",
      "Le dépôt dépasse 10 000 € d'espèces dans le mois : communication systématique (COSI), sans effet sur la décision du conseiller."
    ],
    "argumentaire": [
      "Rapprocher les 15 000 € des revenus de 650 € et de l'absence d'historique d'espèces",
      "Constater qu'aucun acte de donation ni relevé n'est fourni : l'attestation sur l'honneur est seule",
      "Relever que l'origine des espèces détenues par le père n'est pas établie",
      "Conclure : déclaration à la cellule TRACFIN, sans informer la cliente"
    ]
  }
];

  dossiers.forEach(function (d, i) { d.id = i + 1; });

  root.SGBF = root.SGBF || {};
  root.SGBF.atypiques = dossiers;
  if (typeof module !== "undefined" && module.exports) module.exports = { dossiers: dossiers };
})(typeof window !== "undefined" ? window : globalThis);
