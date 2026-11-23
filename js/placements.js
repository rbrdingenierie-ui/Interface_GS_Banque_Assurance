/* GS Banque & Assurance – données des produits d'investissement (assurance-vie, PEA, PER, compte-titres, parts sociales, mandats de gestion, épargne automatique).
   C'est la source unique de leur composition : chaque support a une composition (part de fonds en euros, d'obligations, d'actions…) dont le module risque.js tire l'indicateur de risque de 1 à 7.
   La fiche du catalogue (produits.js), le document d'informations clés téléchargeable (DICI, généré par build/dici.py d'après ces données) et le rapport de conseil MIFID (mifid.js) lisent ces données :
   les trois ne peuvent donc pas se contredire. Les frais sont ceux des fiches (tarifs de la banque, imaginaires) ; les paramètres de risque sont des conventions de l'exercice (voir risque.js).
   Support : { id, nom, compo, conn (niveau de connaissance minimal, 1 novice à 4 expert), hor (horizon minimal, 1 court, 2 moyen, 3 long), duree (texte), durable (d0 à d2), presentation[] }. */
(function (root) {
  "use strict";

  var R = root && root.SGBF ? root.SGBF.risque : require("./risque.js");

  var AGENCE = "GS Banque & Assurance – 27 rue de Châteaudun, 75009 Paris";
  var ASSUREUR = "GS Vie, société anonyme au capital de 120 000 000 €, entreprise régie par le Code des assurances, 27 rue de Châteaudun, 75009 Paris, supervisée par l'Autorité de contrôle prudentiel et de résolution (ACPR), 4 place de Budapest, CS 92459, 75436 Paris Cedex 09";
  var BANQUE = "GS Banque & Assurance, société anonyme au capital de 250 000 000 €, 27 rue de Châteaudun, 75009 Paris, supervisée par l'Autorité de contrôle prudentiel et de résolution (ACPR) et, pour les services d'investissement, par l'Autorité des marchés financiers (AMF)";
  var MAJ = "9 novembre 2026";

  /* ---------- compositions types ---------- */
  var C = {
    EURO: { EURO: 100 },
    PRUDENT: { EURO: 70, OBLIG: 10, ACT: 20 },         /* 70 % fonds en euros, 30 % unités de compte */
    EQUILIBRE: { EURO: 50, OBLIG: 10, ACT: 40 },       /* 50 % / 50 % */
    DYNAMIQUE: { EURO: 20, OBLIG: 10, ACT: 70 },       /* 20 % / 80 % */
    OFFENSIF: { ACT: 60, ACTEM: 25, NONCOTE: 15 },     /* 100 % unités de compte */
    MG_SECURITAIRE: { EURO: 80, OBLIG: 8, ACT: 12 },   /* 80 % fonds en euros, 20 % unités de compte */
    MG_EQUILIBRE: { EURO: 50, OBLIG: 10, ACT: 35, NONCOTE: 5 },
    MG_DYNAMIQUE: { EURO: 20, OBLIG: 8, ACT: 64, NONCOTE: 8 },
    ACTIONS: { ACT: 100 }, ACTIONS_PME: { ACTEM: 100 }, MONETAIRE: { MONET: 100 }, OBLIGATIONS: { OBLIG: 100 }, MIXTE: { OBLIG: 50, ACT: 50 }, PARTS: { PARTS: 100 }
  };

  var TEXTE_UC = "Le capital investi en unités de compte n'est pas garanti : une perte est possible.";
  var BLOQUE_PER = "L'épargne est bloquée jusqu'à la retraite, sauf cas de déblocage anticipé prévus par la loi.";

  /* ---------- supports de conseil et caractéristiques par produit ---------- */
  var P = {
    AV: {
      emetteur: ASSUREUR, nomDoc: "GS Vie Patrimoine", type: "assurance", duree: 8, retractation: 30, selon: "selon les supports",
      couts: { entree: 2, gestionEuro: 0.80, gestionUC: 0.95, transaction: 0.15, sortie: 0 },
      gamme: [C.ACTIONS, C.ACTIONS_PME],
      supports: [
        { id: "AV1", nom: "Fonds en euros", compo: C.EURO, conn: 1, hor: 2, duree: "4 ans minimum conseillés (8 ans recommandés)", durable: "d1",
          presentation: ["Le fonds en euros sécurise l'épargne investie : il comporte une garantie en capital égale aux sommes nettes investies, déduction faite des frais du contrat.", "Son rendement dépend de celui des actifs qui le composent (principalement des obligations) et de la participation aux bénéfices du contrat."] },
        { id: "AV2", nom: "Allocation prudente : 70 % fonds en euros, 30 % unités de compte", compo: C.PRUDENT, conn: 2, hor: 2, duree: "4 ans minimum conseillés (8 ans recommandés)", durable: "d1",
          presentation: ["Environ 70 % de l'épargne est placée sur le fonds en euros (capital garanti nets de frais) et 30 % sur des unités de compte, dont la valeur varie à la hausse comme à la baisse.", TEXTE_UC] },
        { id: "AV3", nom: "Allocation équilibrée : 50 % fonds en euros, 50 % unités de compte", compo: C.EQUILIBRE, conn: 2, hor: 3, duree: "8 ans recommandés", durable: "d2",
          presentation: ["La moitié de l'épargne est placée sur le fonds en euros (capital garanti nets de frais), l'autre moitié sur des unités de compte (actions, obligations).", "Le capital investi en unités de compte n'est pas garanti : une perte importante est possible."] },
        { id: "AV4", nom: "Allocation dynamique : 20 % fonds en euros, 80 % unités de compte", compo: C.DYNAMIQUE, conn: 3, hor: 3, duree: "8 ans recommandés", durable: "d2",
          presentation: ["Environ 80 % de l'épargne est placée sur des unités de compte, surtout des actions : la valeur peut varier fortement et le capital n'est pas garanti.", "Ce support vise la performance à long terme et convient à un client qui accepte des pertes importantes."] }
      ]
    },
    AVP: {
      emetteur: ASSUREUR, nomDoc: "GS Vie Premium", type: "assurance", duree: 8, retractation: 30, selon: "selon les supports",
      couts: { entree: 1, gestionEuro: 0.70, gestionUC: 0.80, transaction: 0.15, sortie: 0 },
      gamme: [C.ACTIONS, C.ACTIONS_PME],
      supports: [
        { id: "AVP1", nom: "Fonds en euros Premium", compo: C.EURO, conn: 1, hor: 2, duree: "4 ans minimum conseillés (8 ans recommandés)", durable: "d1",
          presentation: ["Le fonds en euros Premium sécurise l'épargne investie : il comporte une garantie en capital égale aux sommes nettes investies, déduction faite des frais du contrat.", "Son rendement dépend de celui des actifs qui le composent et de la participation aux bénéfices du contrat."] },
        { id: "AVP2", nom: "Allocation prudente : 70 % fonds en euros, 30 % unités de compte", compo: C.PRUDENT, conn: 2, hor: 2, duree: "4 ans minimum conseillés (8 ans recommandés)", durable: "d1",
          presentation: ["Environ 70 % de l'épargne est placée sur le fonds en euros Premium et 30 % sur des unités de compte sélectionnées par la banque privée.", TEXTE_UC] },
        { id: "AVP3", nom: "Allocation équilibrée : 50 % fonds en euros, 50 % unités de compte", compo: C.EQUILIBRE, conn: 2, hor: 3, duree: "8 ans recommandés", durable: "d2",
          presentation: ["La moitié de l'épargne est placée sur le fonds en euros Premium, l'autre moitié sur des unités de compte (actions, obligations).", "Le capital investi en unités de compte n'est pas garanti : une perte importante est possible."] },
        { id: "AVP4", nom: "Allocation dynamique : 20 % fonds en euros, 80 % unités de compte", compo: C.DYNAMIQUE, conn: 3, hor: 3, duree: "8 ans recommandés", durable: "d2",
          presentation: ["Environ 80 % de l'épargne est placée sur des unités de compte, surtout des actions : la valeur peut varier fortement et le capital n'est pas garanti.", "Ce support vise la performance à long terme et convient à un client qui accepte des pertes importantes."] },
        { id: "AVP5", nom: "Allocation offensive : 100 % unités de compte, dont petites capitalisations et actifs non cotés", compo: C.OFFENSIF, conn: 3, hor: 3, duree: "8 ans recommandés au minimum", durable: "d2",
          presentation: ["L'épargne est entièrement placée sur des unités de compte : actions, dont petites capitalisations et pays émergents, et une part d'actifs non cotés (capital-investissement).", "Le capital n'est pas garanti : la valeur peut varier fortement et le client peut perdre une partie importante des sommes investies. Les actifs non cotés peuvent être moins liquides."] }
      ]
    },
    AVE: {
      emetteur: ASSUREUR, nomDoc: "GS Vie Enfant", type: "assurance", duree: 8, retractation: 30, selon: "selon les supports",
      couts: { entree: 1, gestionEuro: 0.70, gestionUC: 0.85, transaction: 0.15, sortie: 0 },
      gamme: [],
      supports: [
        { id: "AVE1", nom: "Fonds en euros", compo: C.EURO, conn: 1, hor: 2, duree: "8 ans recommandés", durable: "d1",
          presentation: ["Le fonds en euros sécurise l'épargne de l'enfant : il comporte une garantie en capital égale aux sommes nettes investies, déduction faite des frais du contrat.", "Son rendement dépend de celui des actifs qui le composent et de la participation aux bénéfices du contrat."] },
        { id: "AVE2", nom: "Allocation prudente : 70 % fonds en euros, 30 % unités de compte", compo: C.PRUDENT, conn: 2, hor: 2, duree: "8 ans recommandés", durable: "d1",
          presentation: ["Environ 70 % de l'épargne de l'enfant est placée sur le fonds en euros et 30 % sur des unités de compte, dont la valeur varie à la hausse comme à la baisse.", TEXTE_UC] },
        { id: "AVE3", nom: "Allocation équilibrée : 50 % fonds en euros, 50 % unités de compte", compo: C.EQUILIBRE, conn: 2, hor: 3, duree: "8 ans recommandés", durable: "d2",
          presentation: ["La moitié de l'épargne est placée sur le fonds en euros, l'autre moitié sur des unités de compte ; la part d'unités de compte est réduite à l'approche de la majorité de l'enfant.", "Le capital investi en unités de compte n'est pas garanti : une perte importante est possible."] },
        { id: "AVE4", nom: "Allocation dynamique : 20 % fonds en euros, 80 % unités de compte", compo: C.DYNAMIQUE, conn: 3, hor: 3, duree: "8 ans recommandés", durable: "d2",
          presentation: ["Environ 80 % de l'épargne est placée sur des unités de compte, surtout des actions, tant que l'enfant est loin de sa majorité ; la part d'unités de compte est ensuite réduite.", "Le capital n'est pas garanti : la valeur peut varier fortement."] }
      ]
    },
    MGS: {
      emetteur: ASSUREUR, nomDoc: "Mandat de gestion pilotée GS Vie – profil Sécuritaire", type: "mandat", duree: 5, retractation: 30, selon: "",
      couts: { entree: 2, gestionEuro: 0.80, gestionUC: 0.95, transaction: 0.15, sortie: 0, mandat: 0.40 }, gamme: [],
      supports: [
        { id: "MGS1", nom: "Mandat profil Sécuritaire : 80 % fonds en euros, 20 % unités de compte", compo: C.MG_SECURITAIRE, conn: 2, hor: 2, duree: "5 ans recommandés", durable: "d1",
          presentation: ["Vous confiez à l'assureur la répartition du capital et la sélection des supports : 80 % de l'épargne est investie sur le fonds en euros (capital garanti nets de frais) et 20 % sur des unités de compte.", TEXTE_UC] }
      ]
    },
    MGE: {
      emetteur: ASSUREUR, nomDoc: "Mandat de gestion pilotée GS Vie – profil Équilibre", type: "mandat", duree: 8, retractation: 30, selon: "",
      couts: { entree: 2, gestionEuro: 0.80, gestionUC: 0.95, transaction: 0.15, sortie: 0, mandat: 0.50 }, gamme: [],
      supports: [
        { id: "MGE1", nom: "Mandat profil Équilibre : 50 % fonds en euros, 50 % unités de compte", compo: C.MG_EQUILIBRE, conn: 2, hor: 3, duree: "8 ans recommandés", durable: "d2",
          presentation: ["Vous confiez à l'assureur la répartition du capital et la sélection des supports : 50 % de l'épargne est investie sur le fonds en euros (capital garanti nets de frais) et 50 % sur des unités de compte, dont une part d'actifs non cotés.", "Le capital investi en unités de compte n'est pas garanti : une perte importante est possible."] }
      ]
    },
    MGD: {
      emetteur: ASSUREUR, nomDoc: "Mandat de gestion pilotée GS Vie – profil Dynamique", type: "mandat", duree: 10, retractation: 30, selon: "",
      couts: { entree: 2, gestionEuro: 0.80, gestionUC: 0.95, transaction: 0.15, sortie: 0, mandat: 0.60 }, gamme: [],
      supports: [
        { id: "MGD1", nom: "Mandat profil Dynamique : 20 % fonds en euros, 80 % unités de compte", compo: C.MG_DYNAMIQUE, conn: 3, hor: 3, duree: "10 ans recommandés", durable: "d2",
          presentation: ["Vous confiez à l'assureur la répartition du capital et la sélection des supports : 20 % de l'épargne est investie sur le fonds en euros et 80 % sur des unités de compte, surtout des actions, dont une part d'actifs non cotés.", "Le capital n'est pas garanti : la valeur peut varier fortement et le client peut perdre une partie des sommes investies."] }
      ]
    },
    PEA: {
      emetteur: BANQUE, nomDoc: "GS PEA Actions", type: "titres", duree: 5, retractation: 0, selon: "selon les titres détenus",
      couts: { entree: 0.60, gestionEuro: 0, gestionUC: 0.30, transaction: 0, sortie: 0.60 },
      gamme: [C.ACTIONS_PME, C.PARTS],
      supports: [
        { id: "PEA1", nom: "PEA – actions européennes", compo: C.ACTIONS, conn: 2, hor: 2, duree: "5 ans minimum conseillés pour l'avantage fiscal", durable: "d0",
          presentation: ["Le PEA permet d'investir en actions de sociétés européennes, directement ou par des fonds. La valeur des actions varie à la hausse comme à la baisse et le capital n'est pas garanti.", "Un retrait avant 5 ans entraîne en principe la clôture du plan et la perte de l'avantage fiscal."] }
      ]
    },
    PEAJ: {
      emetteur: BANQUE, nomDoc: "GS PEA Jeunes", type: "titres", duree: 5, retractation: 0, selon: "selon les titres détenus",
      couts: { entree: 0.60, gestionEuro: 0, gestionUC: 0.15, transaction: 0, sortie: 0.60 },
      gamme: [C.ACTIONS_PME, C.PARTS],
      supports: [
        { id: "PEAJ1", nom: "PEA Jeunes – actions européennes", compo: C.ACTIONS, conn: 2, hor: 2, duree: "5 ans minimum conseillés pour l'avantage fiscal", durable: "d0",
          presentation: ["Le PEA Jeunes permet d'investir en actions de sociétés européennes, directement ou par des fonds, dans la limite de 20 000 € de versements. La valeur des actions varie à la hausse comme à la baisse et le capital n'est pas garanti.", "Un retrait avant 5 ans entraîne en principe la clôture du plan et la perte de l'avantage fiscal."] }
      ]
    },
    PEAPME: {
      emetteur: BANQUE, nomDoc: "GS PEA-PME-ETI", type: "titres", duree: 8, retractation: 0, selon: "selon les titres détenus",
      couts: { entree: 0.70, gestionEuro: 0, gestionUC: 0.35, transaction: 0, sortie: 0.70 },
      gamme: [],
      supports: [
        { id: "PEAPME1", nom: "PEA-PME-ETI – actions de petites et moyennes entreprises européennes", compo: C.ACTIONS_PME, conn: 3, hor: 3, duree: "8 ans conseillés (5 ans minimum pour l'avantage fiscal)", durable: "d0",
          presentation: ["Le PEA-PME-ETI permet d'investir dans des actions de petites et moyennes entreprises et d'entreprises de taille intermédiaire européennes, souvent moins liquides et plus volatiles que les grandes valeurs.", "Le capital n'est pas garanti : une perte importante est possible. Un retrait avant 5 ans entraîne en principe la clôture du plan."] }
      ]
    },
    PER: {
      emetteur: ASSUREUR, nomDoc: "GS PER Individuel", type: "assurance", duree: 10, retractation: 30, selon: "selon les supports",
      couts: { entree: 2, gestionEuro: 0.85, gestionUC: 0.85, transaction: 0.15, sortie: 0 },
      gamme: [C.ACTIONS, C.ACTIONS_PME],
      supports: [
        { id: "PER1", nom: "PER – fonds en euros", compo: C.EURO, conn: 1, hor: 3, duree: "jusqu'à la retraite", durable: "d1",
          presentation: ["Le fonds en euros du PER comporte une garantie en capital égale aux sommes nettes investies, déduction faite des frais du contrat.", BLOQUE_PER] },
        { id: "PER2", nom: "PER – gestion pilotée prudente", compo: C.PRUDENT, conn: 2, hor: 3, duree: "jusqu'à la retraite", durable: "d1",
          presentation: ["La gestion pilotée répartit l'épargne entre fonds en euros et unités de compte, avec une part d'unités de compte de 30 % environ, réduite à l'approche de la retraite.", TEXTE_UC + " " + BLOQUE_PER] },
        { id: "PER3", nom: "PER – gestion pilotée équilibrée", compo: C.EQUILIBRE, conn: 2, hor: 3, duree: "jusqu'à la retraite", durable: "d2",
          presentation: ["La gestion pilotée place environ la moitié de l'épargne en unités de compte, part réduite à l'approche de la retraite.", TEXTE_UC + " " + BLOQUE_PER] },
        { id: "PER4", nom: "PER – gestion pilotée dynamique", compo: C.DYNAMIQUE, conn: 3, hor: 3, duree: "jusqu'à la retraite", durable: "d2",
          presentation: ["La gestion pilotée place environ 80 % de l'épargne en unités de compte, part réduite à l'approche de la retraite : la valeur peut varier fortement.", TEXTE_UC + " " + BLOQUE_PER] }
      ]
    },
    CTO: {
      emetteur: BANQUE, nomDoc: "GS Compte-Titres", type: "titres", duree: 5, retractation: 0, selon: "selon les instruments détenus",
      couts: { entree: 0.60, gestionEuro: 0, gestionUC: 0.40, transaction: 0, sortie: 0.60 },
      gamme: [C.ACTIONS_PME, { LEVIER: 100 }],
      supports: [
        { id: "CTO1", nom: "Compte-titres – fonds monétaires et obligations à court terme", compo: C.MONETAIRE, conn: 1, hor: 1, duree: "3 mois à 2 ans", durable: "d0",
          presentation: ["Le compte-titres permet de placer une trésorerie sur des fonds monétaires ou obligataires à court terme, dont la valeur varie peu mais n'est pas garantie.", "Même un fonds très peu risqué peut enregistrer une perte : le capital n'est jamais garanti sur un compte-titres."] },
        { id: "CTO2", nom: "Compte-titres – fonds obligataires", compo: C.OBLIGATIONS, conn: 2, hor: 2, duree: "3 ans minimum conseillés", durable: "d0",
          presentation: ["Le compte-titres permet d'investir en fonds obligataires : leur valeur varie avec les taux d'intérêt et la qualité des émetteurs.", "Le capital n'est pas garanti : une perte est possible."] },
        { id: "CTO3", nom: "Compte-titres – fonds diversifiés (50 % obligations, 50 % actions)", compo: C.MIXTE, conn: 2, hor: 2, duree: "5 ans minimum conseillés", durable: "d0",
          presentation: ["Le compte-titres permet d'investir en fonds diversifiés, répartis à parts égales entre obligations et actions : la valeur varie à la hausse comme à la baisse.", "Le capital n'est pas garanti : une perte est possible."] },
        { id: "CTO4", nom: "Compte-titres – actions et fonds actions", compo: C.ACTIONS, conn: 2, hor: 3, duree: "5 ans minimum conseillés", durable: "d0",
          presentation: ["Le compte-titres permet d'investir en actions françaises, européennes ou internationales, directement ou par des fonds. La valeur des actions varie à la hausse comme à la baisse.", "Le capital n'est pas garanti : une perte importante est possible."] },
        { id: "CTO5", nom: "Compte-titres – actions de petites capitalisations et de pays émergents", compo: C.ACTIONS_PME, conn: 3, hor: 3, duree: "8 ans conseillés", durable: "d0",
          presentation: ["Le compte-titres permet d'investir en actions de petites capitalisations ou de pays émergents, plus volatiles et parfois moins faciles à revendre.", "Le capital n'est pas garanti : une perte importante est possible."] }
      ]
    },
    PSOC: {
      emetteur: BANQUE, nomDoc: "Parts sociales GS Banque & Assurance", type: "parts", duree: 2, retractation: 0, selon: "",
      couts: { entree: 0, gestionEuro: 0, gestionUC: 0, transaction: 0, sortie: 0 }, gamme: [],
      supports: [
        { id: "PSOC1", nom: "Parts sociales de GS Banque & Assurance", compo: C.PARTS, conn: 1, hor: 2, duree: "2 ans conseillés", durable: "d0",
          presentation: ["Les parts sociales représentent une part du capital de la banque : le client devient sociétaire et vote à l'assemblée générale. Leur valeur est stable mais le capital n'est pas garanti : une perte, même totale, est possible.", "Les parts ne sont pas cotées : leur cession nécessite l'agrément du conseil d'administration et aucune liquidité n'est garantie. La rémunération n'est pas garantie."] }
      ]
    },
    AUTZ: {
      emetteur: BANQUE, nomDoc: "AUTOMATIZ", type: "titres", duree: 5, retractation: 0, selon: "selon le fonds choisi",
      couts: { entree: 0, gestionEuro: 0, gestionUC: 1.0, transaction: 0.10, sortie: 0 }, gamme: [],
      supports: [
        { id: "AUTZ1", nom: "AUTOMATIZ – fonds monétaire", compo: C.MONETAIRE, conn: 1, hor: 1, duree: "3 mois à 2 ans", durable: "d0",
          presentation: ["Les versements programmés sont placés sur un fonds monétaire, dont la valeur varie peu mais n'est pas garantie.", "Le capital n'est pas garanti : une perte est possible, même faible."] },
        { id: "AUTZ2", nom: "AUTOMATIZ – fonds obligataire", compo: C.OBLIGATIONS, conn: 2, hor: 2, duree: "3 ans minimum conseillés", durable: "d1",
          presentation: ["Les versements programmés sont placés sur un fonds obligataire : sa valeur varie avec les taux d'intérêt et la qualité des émetteurs.", "Le capital n'est pas garanti : une perte est possible."] },
        { id: "AUTZ3", nom: "AUTOMATIZ – fonds diversifié (50 % obligations, 50 % actions)", compo: C.MIXTE, conn: 2, hor: 2, duree: "5 ans minimum conseillés", durable: "d1",
          presentation: ["Les versements programmés sont placés sur un fonds diversifié réparti à parts égales entre obligations et actions.", "Le capital n'est pas garanti : une perte est possible."] },
        { id: "AUTZ4", nom: "AUTOMATIZ – fonds actions européennes", compo: C.ACTIONS, conn: 2, hor: 3, duree: "5 ans minimum conseillés", durable: "d1",
          presentation: ["Les versements programmés sont placés sur un fonds d'actions européennes : lisser les achats dans le temps réduit le risque de mal choisir le moment, sans supprimer le risque de perte.", "Le capital n'est pas garanti : une perte importante est possible."] },
        { id: "AUTZ5", nom: "AUTOMATIZ – fonds actions de pays émergents et petites capitalisations", compo: C.ACTIONS_PME, conn: 3, hor: 3, duree: "8 ans conseillés", durable: "d1",
          presentation: ["Les versements programmés sont placés sur un fonds d'actions de pays émergents et de petites capitalisations, plus volatiles que les grandes valeurs.", "Le capital n'est pas garanti : une perte importante est possible."] }
      ]
    }
  };

  /* Compléments : durée de vie, objectifs, investisseurs visés, garanties, sortie. Textes des documents d'informations clés. */
  var D = {
    AV: { vie: "Le contrat est un contrat d'assurance-vie multisupport de droit français, régi par le Code des assurances (branche 20 pour le fonds en euros, branche 22 pour les unités de compte). Sa durée est viagère : il prend fin au décès de l'assuré ou lors du rachat total. GS Vie ne peut pas mettre fin unilatéralement au contrat.",
      objectifs: ["Constituer ou valoriser un capital à moyen et long terme, et le transmettre à des bénéficiaires désignés.", "Le client choisit entre le fonds en euros, qui garantit le capital net de frais, et des unités de compte, dont la valeur n'est pas garantie. L'assureur ne s'engage que sur le nombre d'unités de compte, pas sur leur valeur."],
      vises: ["Personnes physiques majeures et capables, résidentes fiscales en France.", "Titulaires d'un compte à GS Banque & Assurance.", "Disposant d'un minimum à investir de 500 €, ayant répondu au questionnaire profil investisseur et reçu un rapport de conseil."],
      versements: 500 },
    AVP: { vie: "Le contrat est un contrat d'assurance-vie multisupport haut de gamme de droit français, régi par le Code des assurances. Sa durée est viagère : il prend fin au décès de l'assuré ou lors du rachat total. GS Vie ne peut pas mettre fin unilatéralement au contrat.",
      objectifs: ["Constituer, valoriser et transmettre un patrimoine important, avec un accès à des supports réservés à la clientèle privée (fonds en euros Premium, unités de compte non cotées, gestion pilotée).", "Le client choisit entre le fonds en euros Premium, qui garantit le capital net de frais, et des unités de compte, dont la valeur n'est pas garantie."],
      vises: ["Personnes physiques majeures et capables, résidentes fiscales en France.", "Clients de la banque privée de GS Banque & Assurance, ayant répondu au questionnaire profil investisseur et reçu un rapport de conseil.", "Disposant d'un minimum à investir de 30 000 €."],
      versements: 30000 },
    AVE: { vie: "Le contrat est un contrat d'assurance-vie multisupport de droit français, régi par le Code des assurances, souscrit au nom d'un enfant mineur et représenté par son représentant légal. Sa durée est viagère : l'enfant devient pleinement titulaire du contrat à sa majorité.",
      objectifs: ["Constituer une épargne pour un enfant (études, permis de conduire, premier logement) avec une prise en main du contrat par l'enfant à sa majorité.", "La part d'unités de compte est réduite progressivement à l'approche de la majorité de l'enfant."],
      vises: ["Représentants légaux (parents) d'un enfant mineur, résidents fiscaux en France.", "Titulaires d'un compte à GS Banque & Assurance, ayant répondu au questionnaire profil investisseur et reçu un rapport de conseil.", "Disposant d'un minimum à investir de 100 €."],
      versements: 100 },
    MGS: { vie: "Le mandat est une option de gestion d'un contrat d'assurance-vie GS Vie : le souscripteur confie à GS Vie, qui a mandaté un gestionnaire financier, la répartition de l'épargne entre fonds en euros et unités de compte. Le souscripteur peut y mettre fin à tout moment.",
      objectifs: ["Valoriser une épargne d'assurance-vie sans choisir soi-même les supports : le gestionnaire applique une orientation « Sécuritaire », avec environ 80 % en fonds en euros et 20 % en unités de compte.", "La répartition peut évoluer autour de cette orientation selon les marchés."],
      vises: ["Titulaires d'un contrat d'assurance-vie GS Vie Patrimoine ou Premium, résidents fiscaux en France.", "Ayant répondu au questionnaire profil investisseur et reçu un rapport de conseil adapté à l'orientation Sécuritaire.", "Disposant d'un minimum à investir de 5 000 €."],
      versements: 5000 },
    MGE: { vie: "Le mandat est une option de gestion d'un contrat d'assurance-vie GS Vie : le souscripteur confie à GS Vie, qui a mandaté un gestionnaire financier, la répartition de l'épargne entre fonds en euros et unités de compte. Le souscripteur peut y mettre fin à tout moment.",
      objectifs: ["Valoriser une épargne d'assurance-vie sans choisir soi-même les supports : le gestionnaire applique une orientation « Équilibre », avec environ 50 % en fonds en euros et 50 % en unités de compte, dont au moins 5 % d'actifs non cotés.", "La répartition peut évoluer autour de cette orientation selon les marchés."],
      vises: ["Titulaires d'un contrat d'assurance-vie GS Vie Patrimoine ou Premium, résidents fiscaux en France.", "Ayant répondu au questionnaire profil investisseur et reçu un rapport de conseil adapté à l'orientation Équilibre.", "Disposant d'un minimum à investir de 5 000 €."],
      versements: 5000 },
    MGD: { vie: "Le mandat est une option de gestion d'un contrat d'assurance-vie GS Vie : le souscripteur confie à GS Vie, qui a mandaté un gestionnaire financier, la répartition de l'épargne entre fonds en euros et unités de compte. Le souscripteur peut y mettre fin à tout moment.",
      objectifs: ["Valoriser une épargne d'assurance-vie sans choisir soi-même les supports : le gestionnaire applique une orientation « Dynamique », avec environ 20 % en fonds en euros et 80 % en unités de compte, dont au moins 8 % d'actifs non cotés.", "La répartition peut évoluer autour de cette orientation selon les marchés."],
      vises: ["Titulaires d'un contrat d'assurance-vie GS Vie Patrimoine ou Premium, résidents fiscaux en France.", "Ayant répondu au questionnaire profil investisseur et reçu un rapport de conseil adapté à l'orientation Dynamique.", "Disposant d'un minimum à investir de 5 000 €."],
      versements: 5000 },
    PEA: { vie: "Le PEA est un plan d'épargne en actions de droit français (articles L221-30 et suivants du Code monétaire et financier), composé d'un compte-titres et d'un compte espèces. Sa durée est illimitée ; le retrait avant 5 ans entraîne la clôture du plan.",
      objectifs: ["Investir en actions de sociétés de l'Union européenne ou de l'Espace économique européen, directement ou par des fonds, dans la limite de 150 000 € de versements, avec une exonération d'impôt sur le revenu des gains après 5 ans.", "Le PEA peut aussi contenir des parts sociales de la banque, au profil de risque très différent des actions."],
      vises: ["Personnes physiques majeures, domiciliées fiscalement en France ; un seul PEA par personne.", "Ayant répondu au questionnaire profil investisseur et reçu un rapport de conseil.", "Disposant d'un minimum à investir de 300 €."],
      versements: 300 },
    PEAJ: { vie: "Le PEA Jeunes est un plan d'épargne en actions de droit français ouvert aux jeunes majeurs rattachés au foyer fiscal de leurs parents. Il devient un PEA classique lorsque le titulaire quitte ce foyer ; le retrait avant 5 ans entraîne la clôture du plan.",
      objectifs: ["Se familiariser avec les marchés financiers en investissant en actions de sociétés de l'Union européenne ou de l'Espace économique européen, dans la limite de 20 000 € de versements.", "Après 5 ans, les gains sont exonérés d'impôt sur le revenu."],
      vises: ["Personnes majeures de moins de 21 ans, ou de moins de 25 ans si elles sont étudiantes, rattachées au foyer fiscal de leurs parents.", "Ayant répondu au questionnaire profil investisseur et reçu un rapport de conseil.", "Disposant d'un minimum à investir de 300 €."],
      versements: 300 },
    PEAPME: { vie: "Le PEA-PME-ETI est un plan d'épargne en actions de droit français réservé aux titres de petites et moyennes entreprises et d'entreprises de taille intermédiaire. Sa durée est illimitée ; le retrait avant 5 ans entraîne la clôture du plan.",
      objectifs: ["Investir dans des actions de PME et d'ETI européennes (moins de 5 000 salariés et moins de 1,5 milliard d'euros de chiffre d'affaires ou 2 milliards d'euros de total de bilan), dans la limite de 225 000 € de versements, tous PEA confondus.", "Après 5 ans, les gains sont exonérés d'impôt sur le revenu."],
      vises: ["Personnes physiques majeures, domiciliées fiscalement en France ; un seul PEA-PME-ETI par personne.", "Ayant répondu au questionnaire profil investisseur et reçu un rapport de conseil.", "Disposant d'un minimum à investir de 500 €."],
      versements: 500 },
    PER: { vie: "Le PER individuel est un plan d'épargne retraite de droit français, souscrit sous la forme d'un contrat d'assurance de groupe, régi par le Code monétaire et financier et le Code des assurances. Il prend fin à la liquidation de l'épargne, à la retraite.",
      objectifs: ["Préparer sa retraite en constituant une épargne, avec des versements volontaires déductibles du revenu imposable dans la limite d'un plafond annuel.", "Le client choisit entre le fonds en euros et la gestion pilotée, dont la part d'unités de compte est réduite à l'approche de la retraite."],
      vises: ["Personnes physiques majeures, résidentes fiscales en France.", "Ayant répondu au questionnaire profil investisseur et reçu un rapport de conseil.", "Disposant d'un minimum à investir de 300 €."],
      versements: 300 },
    CTO: { vie: "Le compte-titres ordinaire est un compte d'instruments financiers lié à un compte espèces. Sa durée est illimitée et les titres sont disponibles à tout moment.",
      objectifs: ["Investir en actions, obligations et fonds français, européens ou internationaux, sans plafond de versements ni condition de durée.", "Le niveau de risque dépend des instruments détenus : de la classe 1 pour un fonds monétaire à la classe 6 pour des instruments à effet de levier."],
      vises: ["Personnes physiques majeures, résidentes ou non en France ; comptes individuels, joints ou en indivision.", "Ayant répondu au questionnaire profil investisseur et reçu un rapport de conseil pour les produits conseillés.", "Disposant d'un minimum à investir de 300 €."],
      versements: 300 },
    PSOC: { vie: "Les parts sociales sont des titres de capital de GS Banque & Assurance, banque coopérative. Leur durée est illimitée : le remboursement se fait à la valeur nominale, après agrément du conseil d'administration.",
      objectifs: ["Devenir sociétaire de la banque, participer à ses assemblées générales et percevoir un intérêt annuel voté par l'assemblée générale dans la limite d'un plafond légal.", "Les parts sociales supportent les pertes de la banque : leur valeur est stable en temps normal mais le capital n'est pas garanti."],
      vises: ["Personnes physiques majeures, clientes de GS Banque & Assurance, titulaires d'un compte-titres ordinaire ou d'un PEA.", "Disposant d'un minimum à investir d'une part ; le plafond est de 50 000 € par personne physique."],
      versements: 11.4 },
    AUTZ: { vie: "AUTOMATIZ est un service de versements programmés qui investit régulièrement, chaque mois ou chaque trimestre, dans un fonds choisi parmi une sélection, sur un compte-titres ordinaire ou un PEA du client. Sa durée est illimitée ; le client peut l'arrêter, le modifier ou le suspendre à tout moment, sans frais.",
      objectifs: ["Investir progressivement et régulièrement, en lissant le prix d'achat dans le temps, sans avoir à choisir le bon moment.", "Le niveau de risque dépend du fonds choisi : de la classe 1 pour un fonds monétaire à la classe 5 pour un fonds d'actions de pays émergents."],
      vises: ["Personnes physiques majeures titulaires d'un compte-titres ordinaire ou d'un PEA à GS Banque & Assurance.", "Ayant répondu au questionnaire profil investisseur et reçu un rapport de conseil.", "Disposant de 30 € par mois ou 90 € par trimestre à investir."],
      versements: 30 }
  };

  /* Supports de conseil de chaque produit, avec l'indicateur de risque et le niveau de l'échelle de conseil calculés à partir de la composition. */
  function supports(pid) {
    var d = P[pid];
    return d ? d.supports.map(function (s) {
      var sri = R.sri(s.compo);
      return Object.assign({}, s, { sri: sri, risque: R.niveau(sri), uc: R.partUC(s.compo), garanti: R.capitalGaranti(s.compo) });
    }) : [];
  }
  /* Plage de l'indicateur d'un produit : tous ses supports de conseil et les compositions de sa gamme (gestion libre). */
  function plage(pid) {
    var d = P[pid]; if (!d) return null;
    var l = d.supports.map(function (s) { return R.sri(s.compo); }).concat((d.gamme || []).map(R.sri));
    return { min: Math.min.apply(null, l), max: Math.max.apply(null, l) };
  }
  function productIds() { return Object.keys(P); }
  /* Paramètres de coûts du produit : durée recommandée et frais (voir risque.couts et risque.scenarios). */
  function paramsCouts(pid) { var d = P[pid]; return Object.assign({ duree: d.duree }, d.couts); }
  /* Composition de référence du produit pour les coûts et les scénarios du DICI : celle de son support de conseil le plus représentatif (le moins risqué qui contient des unités de compte, sinon l'unique support). */
  function compoReference(pid) {
    var s = supports(pid), un = s.filter(function (x) { return x.uc > 0 && x.uc < 100; });
    if (s.length === 1) return s[0].compo;
    return (un.length ? un[Math.floor((un.length - 1) / 2)] : s[s.length - 1]).compo;
  }

  var api = { C: C, P: P, D: D, MAJ: MAJ, AGENCE: AGENCE, ASSUREUR: ASSUREUR, BANQUE: BANQUE, supports: supports, plage: plage, productIds: productIds, paramsCouts: paramsCouts, compoReference: compoReference };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.placements = api; }
})(typeof window !== "undefined" ? window : null);
