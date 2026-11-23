/* GS Banque & Assurance – catalogue des produits.
   Les tarifs, taux et conditions commerciales sont ceux de la banque. Les plafonds et règles réglementaires cités
   (Livret A, LDDS, LEP, Livret jeune, PEA, frais d'incidents, HCSF, taux d'usure) sont ceux en vigueur à l'automne 2026
   et doivent être revérifiés avant un nouveau cours. */
(function (root) {
  "use strict";

  var R = root && root.SGBF ? root.SGBF.risque : require("./risque.js");
  var PL = root && root.SGBF ? root.SGBF.placements : require("./placements.js");

  /* ---------- prix à l'unité des services et conventions de compte (offres groupées de services) ---------- */
  function eu(n) { return (Math.round(n * 100) / 100).toFixed(2).replace(".", ",") + " €"; }
  function eu0(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " €"; }
  function pct1(n) { return String(n).replace(".", ",") + " %"; }

  /* Prix à l'unité, par an (sauf mention), des services que les conventions regroupent. Tarifs de la banque (imaginaires), repris dans les fiches des cartes et du compte courant. */
  var TARIFS_UNITAIRES = {
    tenue: { lib: "Tenue de compte (compte courant Équilibre)", an: 24, unite: "2,00 € par mois" },
    VJEU: { lib: "Carte Visa Classic Jeune", an: 20, unite: "20,00 € par an" },
    VCLA: { lib: "Carte Visa Classic", an: 45, unite: "45,00 € par an" },
    VMIN: { lib: "Carte de paiement à autorisation systématique (12-17 ans)", an: 20, unite: "20,00 € par an" },
    sms: { lib: "GS Alertes : alertes par SMS sur le solde et les opérations", an: 18, unite: "1,50 € par mois" },
    connect: { lib: "Banque à distance GS Connect", an: 36, unite: "3,00 € par mois" },
    assurance: { lib: "Assurance perte et vol des moyens de paiement", an: 24, unite: "2,00 € par mois" },
    cheque: { lib: "Chèque de banque", an: 25, unite: "25,00 € le chèque" },
    instantane: { lib: "Virement instantané", an: 0.9, unite: "0,90 € le virement" },
    releve: { lib: "Relevé de compte papier mensuel", an: 18, unite: "1,50 € par relevé" }
  };
  /* Conventions : [service, quantité par an]. Le total à l'unité compte le prix de chaque service multiplié par la quantité. */
  var CONVENTIONS = [
    /* Convention des 12-17 ans : souscrite par le représentant légal pour chaque enfant mineur. Le compte du mineur n'a pas de frais de tenue (rien n'est compté pour lui à l'unité) ; la carte est à autorisation systématique, sans chéquier ni découvert.
       Le prix (2,00 € par mois), le prix à l'unité de la carte (20 €) et la liste des services sont ceux de la banque (imaginaires) ; l'offre s'inspire d'une offre jeune de banque de réseau consultée en novembre 2026. */
    { id: "CVM", nom: "Convention GS Junior – offre groupée de services (12-17 ans)", code: "Convention Junior", ageMin: 12, ageMax: 17, mensuel: 2, carte: null, mineur: true,
      services: [["VMIN", 1], ["sms", 1], ["assurance", 1]],
      accroche: "Les premiers services bancaires d'un adolescent, sous le contrôle de ses parents, réunis dans une seule cotisation.",
      public: "Enfants de 12 à 17 ans dont le représentant légal (parent ou tuteur) est client de la banque : il souscrit et signe la convention." },
    { id: "CVJ", nom: "Convention GS Avenir – offre groupée de services (18-25 ans)", code: "Convention Avenir", ageMin: 18, ageMax: 25, mensuel: 2.9, carte: "VJEU",
      services: [["tenue", 1], ["VJEU", 1], ["connect", 1], ["sms", 1], ["assurance", 1], ["instantane", 12]],
      accroche: "Les services du quotidien des 18-25 ans réunis dans une seule cotisation, sans frais de tenue de compte.",
      public: "Clients de 18 à 25 ans titulaires d'un compte courant Équilibre ou du compte Jeune." },
    { id: "CVA", nom: "Convention GS Horizon – offre groupée de services (26-59 ans)", code: "Convention Horizon", ageMin: 26, ageMax: 59, mensuel: 8.9, carte: "VCLA",
      services: [["tenue", 1], ["VCLA", 1], ["connect", 1], ["sms", 1], ["assurance", 1], ["cheque", 2], ["instantane", 12]],
      accroche: "La carte et les services de la vie active dans une seule cotisation, sans frais de tenue de compte.",
      public: "Clients de 26 à 59 ans titulaires d'un compte courant Équilibre." },
    { id: "CVS", nom: "Convention GS Sérénité – offre groupée de services (60 ans et plus)", code: "Convention Sérénité", ageMin: 60, ageMax: 120, mensuel: 7.9, carte: "VCLA",
      services: [["tenue", 1], ["VCLA", 1], ["connect", 1], ["sms", 1], ["assurance", 1], ["releve", 1], ["cheque", 2]],
      accroche: "La carte, les relevés papier et la tranquillité des 60 ans et plus dans une seule cotisation, sans frais de tenue de compte.",
      public: "Clients de 60 ans et plus titulaires d'un compte courant Équilibre." }
  ];
  /* Valeur à l'unité d'une convention : avec un compte Équilibre (tenue de compte facturée 24 €) ou avec le compte Jeune (tenue gratuite). */
  function valeurUnitaire(cv, compte) {
    var t = 0;
    cv.services.forEach(function (s) { if (s[0] === "tenue" && compte === "JEUNE") return; t += TARIFS_UNITAIRES[s[0]].an * s[1]; });
    return Math.round(t * 100) / 100;
  }
  /* Économie d'une convention selon les services que le client utilise réellement (clés des services de la fiche) : la tenue de compte est toujours exonérée.
     compte : « CPT » (tenue facturée 24 € à l'unité) ou « JEUNE » (tenue gratuite). Plus le client prend de services, plus la réduction est forte. */
  function economieConvention(conv, utilises, compte) {
    var unite = 0, nb = 0, total = 0;
    conv.services.forEach(function (x) {
      if (x.k === "tenue") { if (compte !== "JEUNE") unite += x.valeur; return; }
      total++;
      if (utilises.indexOf(x.k) >= 0) { unite += x.valeur; nb++; }
    });
    unite = Math.round(unite * 100) / 100;
    var eco = Math.round((unite - conv.cotisationAn) * 100) / 100;
    return { unite: unite, cotisation: conv.cotisationAn, economie: eco, pct: unite > 0 ? Math.round(100 * eco / unite) : 0, nb: nb, total: total };
  }
  function conventionFiche(cv) {
    var an = Math.round(cv.mensuel * 12 * 100) / 100, comptes = cv.id === "CVJ" ? ["CPT", "JEUNE"] : ["CPT"];
    var inclus = cv.services.map(function (s) {
      var t = TARIFS_UNITAIRES[s[0]], q = s[1], valeur = Math.round(t.an * q * 100) / 100;
      return { k: s[0], lib: s[0] === "tenue" ? "Tenue de compte : exonérée" : t.lib + (q > 1 ? " (" + q + " par an)" : ""), quantite: q, valeur: valeur, unite: t.unite };
    });
    var avec = {}; comptes.forEach(function (c) { avec[c] = valeurUnitaire(cv, c); });
    return { an: an, inclus: inclus, avec: avec, comptes: comptes };
  }

  /* ---------- grilles de cotisations des assurances de personnes (tarifs de la banque, imaginaires) ---------- */
  /* Clé : âge atteint à la souscription ; la cotisation de la tranche s'applique jusqu'à l'âge suivant de la grille. */
  var GRILLE_DECES = { 18: 5.5, 25: 6.5, 30: 7.5, 35: 9.5, 40: 14, 45: 21, 50: 33, 55: 52, 60: 80, 65: 120 };      /* € par mois pour 100 000 € de capital */
  var GRILLE_DEPENDANCE = { 50: 14, 55: 20, 60: 29, 65: 43, 70: 65, 75: 98 };                                          /* € par mois pour 1 000 € de rente mensuelle */
  var GRILLE_OBSEQUES = { 40: 11, 45: 14, 50: 18, 55: 24, 60: 33, 65: 46, 70: 66, 75: 98, 80: 148 };                   /* € par mois (cotisation viagère) pour 5 000 € de capital */
  var COEF_UNIQUE_OBSEQUES = { 40: 0.48, 45: 0.52, 50: 0.56, 55: 0.6, 60: 0.66, 65: 0.72, 70: 0.78, 75: 0.84, 80: 0.88 };  /* prime unique = capital × coefficient */
  function tranche(grille, age) { var ks = Object.keys(grille).map(Number).sort(function (a, b) { return a - b; }), k = ks[0]; ks.forEach(function (x) { if (age >= x) k = x; }); return grille[k]; }
  var FRAIS_DECES = 1.5;      /* € par mois, frais de gestion du contrat */
  var CAPITAUX_DECES = [30000, 50000, 100000, 150000, 200000, 300000, 500000];
  var RENTES_DEPENDANCE = [500, 800, 1000, 1500, 2000, 3000];
  var CAPITAUX_OBSEQUES = [3000, 4000, 5000, 7500, 10000, 15000];
  /* Cotisation indicative d'une assurance de personnes. mode : « mensuel » (cotisation mensuelle) ; pour les obsèques, « unique » (versement unique). Renvoie un nombre en euros ou NaN. */
  function cotisation(pid, age, montant, mode) {
    if (pid === "DECES") return Math.round((tranche(GRILLE_DECES, age) * montant / 100000 + FRAIS_DECES) * 100) / 100;
    if (pid === "DEP") return Math.round(tranche(GRILLE_DEPENDANCE, age) * montant / 1000 * 100) / 100;
    if (pid === "OBSQ") return mode === "unique" ? Math.round(tranche(COEF_UNIQUE_OBSEQUES, age) * montant * 100) / 100 : Math.round(tranche(GRILLE_OBSEQUES, age) * montant / 5000 * 100) / 100;
    return NaN;
  }

  /* Prix « à partir de » des assurances de biens et de la protection juridique (€ par mois) : tarifs de la banque, imaginaires. Les fiches et la souscription les lisent ici. */
  var PRIMES = {
    MOTO: { cyclo: { tiers: 21, inter: 28, tous: 38 }, c125: { tiers: 24, inter: 31, tous: 46 }, plus: { tiers: 34, inter: 45, tous: 72 } },
    CCAR: { tiers: 17, etendu: 29, tous: 44 },
    VSP: { tiers: 39, tous: 68 },
    PJ: { ess: 5.5, comp: 9.9 },
    APN: { ess: 4.9, plus: 7.9, pro: 1.5, remise: { ess: 0.5, plus: 1 } },   /* € par mois : formule Essentielle ou Plus ; option usage professionnel (+) ; remise (−) du client qui a une assurance habitation GS */
    GALE: { alerte: 1.5, complete: 2.5 },    /* € par mois : alerte de compte seule (18 € par an, comme le prix à l'unité des conventions), ou alerte de compte et mini-relevé hebdomadaire */
    MPAY: { banque: 2, multi: 2.5 }          /* € par mois : moyens de paiement de la banque seulement (24 € par an, comme le tarif à l'unité des conventions) ou de plusieurs banques */
  };
  function prix(n) { return (n % 1 === 0 ? String(n) : n.toFixed(2).replace(".", ",")) + " €"; }
  /* Prime d'une souscription d'assurance, selon les options choisies : { mois, an, unique } en euros (unique : versement unique des obsèques). Âge atteint du client pour les assurances de personnes. */
  function prime(pid, o, age) {
    o = o || {};
    var mois = NaN, unique = null;
    if (pid === "DECES" || pid === "DEP") mois = cotisation(pid, age, o.capital || o.rente);
    else if (pid === "OBSQ") { mois = cotisation(pid, age, o.capital, "mensuel"); unique = cotisation(pid, age, o.capital, "unique"); }
    else if (pid === "MOTO") mois = (PRIMES.MOTO[o.cylindree] || {})[o.formule];
    else if (pid === "CCAR" || pid === "VSP" || pid === "PJ" || pid === "MPAY" || pid === "GALE") mois = PRIMES[pid][o.formule];
    else if (pid === "APN") { var base = PRIMES.APN[o.formule]; mois = base === undefined ? undefined : Math.round((base + (o.usage === "pro" ? PRIMES.APN.pro : 0) - (o.remiseHabitation ? PRIMES.APN.remise[o.formule] : 0)) * 100) / 100; }
    if (mois === undefined || isNaN(mois)) return null;
    return { mois: mois, an: Math.round(mois * 12 * 100) / 100, unique: unique };
  }

  /* ---------- compte à terme : grille de taux fixée par la banque (imaginaire), taux brut annuel selon la durée en mois ---------- */
  var CAT_TAUX = { 3: 1.5, 6: 1.7, 12: 1.95, 24: 2.1, 36: 2.25, 48: 2.35, 60: 2.45 };
  var CAT_MIN = 1000;
  var PFU = "prélèvement forfaitaire unique de 31,4 % (12,8 % d'impôt sur le revenu et 18,6 % de prélèvements sociaux)";
  var MENTION_TITRES = "Les titres et espèces déposés sont couverts par le fonds de garantie des dépôts et de résolution, dans les limites prévues par la loi (70 000 € par client pour les titres, 100 000 € pour les espèces).";
  var MENTION_MIFID = "Produit soumis au devoir de conseil : le questionnaire profil investisseur est obligatoire avant la souscription et le rapport de conseil est remis au client. Ce n'est pas un placement garanti.";
  var MENTION_DICI = "Le document d'informations clés (DICI) est remis au client avant toute souscription ; il est téléchargeable depuis la fiche du produit.";

  /* Les taux qui évoluent (livrets réglementés, rendement du fonds en euros) ne sont écrits nulle part dans le logiciel : ils sont révisés
     deux fois par an ou chaque année, et la banque les communique dans sa newsletter. Les fiches renvoient donc à la newsletter, ce qui évite
     de modifier le logiciel à chaque révision. Seuls les taux fixés par la banque (Livret Jeune, Livret Projets, crédits) sont écrits dans les fiches. */
  var TAUX_NEWSLETTER = "Taux en vigueur communiqué dans la newsletter";
  /* Produits dont le taux évolue (renvoi à la newsletter) ; le Livret Jeune et le Livret Projets ont un taux fixé par la banque. */
  var TAUX_EVOLUTIF = ["LA", "LDDS", "LEP"];
  var PLAFOND = { LA: 22950, LDDS: 12000, LEP: 10000, LJ: 1600 };
  /* Plafonds de revenu fiscal de référence applicables en 2026 pour le LEP : 1 part, 1,5 part, 2 parts, 2,5 parts, 3 parts, puis +6 149 € par demi-part. */
  var LEP_RFR = [23028, 29177, 35326, 41475, 47624];
  var LEP_RFR_DEMI = 6149;

  var FAMILLES = [
    { id: "compte", nom: "Comptes", court: "Compte" },
    { id: "carte", nom: "Cartes", court: "Cartes" },
    { id: "epargne", nom: "Épargne bancaire", court: "Épargne" },
    { id: "placement", nom: "Placements et retraite", court: "Placements" },
    { id: "credit", nom: "Crédits", court: "Crédits" },
    { id: "assurance", nom: "Assurances", court: "Assurances" },
    { id: "mobile", nom: "Mobile et internet", court: "Mobile" }
  ];
  /* Univers du catalogue : regroupement des familles de produits tel que le client les comprend (banque au quotidien, épargne, placements, crédits, assurances, mobile et internet).
     Chaque produit garde sa famille ; l'univers sert à ranger et à filtrer le catalogue et la situation d'un client. */
  var UNIVERS = [
    { id: "quotidien", nom: "Banque au quotidien", familles: ["compte", "carte"], sous: "Comptes, conventions de services, cartes bancaires, banque à distance (GS Connect) et alertes (GS Alertes)." },
    { id: "epargne", nom: "Épargne", familles: ["epargne"], sous: "Livrets réglementés et bancaires, compte à terme : une épargne disponible ou garantie." },
    { id: "placement", nom: "Placements et retraite", familles: ["placement"], sous: "Assurance-vie, gestion pilotée, PEA, PER, compte-titres et épargne automatique : une épargne à long terme, avec un risque à adapter au client." },
    { id: "credit", nom: "Prêts et crédits", familles: ["credit"], sous: "Prêt immobilier, prêt personnel, crédit auto, prêt travaux, découvert autorisé et crédit renouvelable." },
    { id: "assurance", nom: "Assurances", familles: ["assurance"], sous: "Habitation, auto et deux-roues, protection de la famille, prévoyance, dépendance, obsèques, moyens de paiement et appareils nomades." },
    { id: "mobile", nom: "Mobile et internet", familles: ["mobile"], sous: "Forfait mobile, box internet fibre, pack mobile et box, eSIM pour voyager." }
  ];
  var UNIVERS_DE_FAMILLE = {}; UNIVERS.forEach(function (u) { u.familles.forEach(function (f) { UNIVERS_DE_FAMILLE[f] = u; }); });
  function universDe(p) { return UNIVERS_DE_FAMILLE[p.famille] || null; }

  var MENTION_CREDIT = "Un crédit vous engage et doit être remboursé. Vérifiez vos capacités de remboursement avant de vous engager.";
  var MENTION_CREDIT_CONSO = "Mention d'avertissement dans la publicité : « Un crédit vous engage et doit être remboursé. Vérifiez vos capacités de remboursement avant de vous engager. » jusqu'au 19 novembre 2026 ; à partir du 20 novembre 2026, « Attention ! Un crédit coûte de l'argent et doit être remboursé ! » (ordonnance n° 2025-880 du 3 septembre 2025).";
  var MENTION_ASSUR = "Contrat d'assurance proposé par GS Banque & Assurance, intermédiaire en assurance. Le conseiller remet la fiche d'information et recueille les besoins avant toute proposition (devoir de conseil).";
  var MURCEF_OFFRE_GROUPEE = "Loi MURCEF du 11 décembre 2001 (article L. 312-1-2 du Code monétaire et financier) : une offre groupée de services n'est permise que si chaque service qu'elle comprend peut aussi être acheté séparément ; le client reste libre de la souscrire ou non.";
  var MENTION_DEPOTS = "Les dépôts sont couverts par le fonds de garantie des dépôts et de résolution, dans les limites prévues par la loi (100 000 € par déposant et par établissement).";

  var PRODUITS = [
    /* ---------- comptes ---------- */
    {
      id: "CPT", famille: "compte", nom: "Compte courant Équilibre", code: "Équilibre",
      accroche: "Le compte de dépôt standard, avec virements SEPA gratuits ; la banque à distance s'ajoute avec GS Connect.",
      public: "Toute personne majeure ou mineure émancipée, résidente en France.",
      eligibilite: ["Pièce d'identité en cours de validité et justificatif de domicile.", "Une inscription au fichier central des chèques (FCC) ou une interdiction bancaire n'empêche pas d'ouvrir un compte (droit au compte) : elle interdit seulement d'émettre des chèques.", "Autorisation de découvert : étude du dossier et de la capacité de remboursement."],
      caracteristiques: ["Tenue de compte et relevés de compte ; banque à distance en option avec GS Connect (" + eu(3) + " par mois, gratuite avec une convention de compte).", "Virements SEPA et prélèvements : illimités.", "Chéquier sur demande (sauf interdiction).", "Autorisation de découvert possible, après étude du dossier."],
      tarifs: [{ lib: "Tenue de compte", val: "2,00 € par mois" }, { lib: "Virement SEPA", val: "Gratuit (en ligne avec GS Connect, ou en agence)" }, { lib: "Commission d'intervention", val: "8 € par opération, 80 € par mois au maximum" }, { lib: "Retrait aux distributeurs d'autres banques (zone euro)", val: "1 € à partir du 4e retrait du mois" }],
      avantages: ["Compte de base de la relation : il reçoit les revenus et sert aux paiements du quotidien.", "Domiciliation des revenus : porte d'entrée vers les autres produits."],
      risques: ["Un solde débiteur non autorisé entraîne des frais d'incident et peut conduire à des mesures de rigueur.", "Le découvert coûte cher s'il devient permanent."],
      reglementaire: ["Droit au compte (article L312-1 du Code monétaire et financier) : une personne qui s'est vu refuser l'ouverture d'un compte peut demander à la Banque de France de désigner un établissement.", "Frais d'incidents plafonnés : commissions d'intervention limitées à 8 € par opération et 80 € par mois pour un client non fragile.", MENTION_DEPOTS],
      cmp: { cout: "2,00 € / mois", liquidite: "Immédiate", rendement: "Aucun", risque: "Aucun sur le capital", fisc: "Sans objet", ticket: "Aucun dépôt minimum", plafond: "Aucun" }
    },
    {
      id: "JEUNE", famille: "compte", nom: "Compte Jeune 18-25 ans", code: "Jeune",
      accroche: "Un compte sans frais de tenue pour les premières années de vie active ou d'études.",
      public: "Clients de 18 à 25 ans (jusqu'au jour des 26 ans).",
      eligibilite: ["Avoir entre 18 et 25 ans.", "Justificatif d'études, d'apprentissage ou d'activité conseillé pour l'octroi d'un découvert."],
      caracteristiques: ["Tenue de compte gratuite jusqu'à 25 ans révolus.", "Carte Visa Classic Jeune à débit immédiat.", "Virements et prélèvements illimités.", "Découvert limité (jusqu'à 200 €) sous conditions."],
      tarifs: [{ lib: "Tenue de compte", val: "Gratuite jusqu'à 25 ans" }, { lib: "Carte Visa Classic Jeune", val: "20 € par an" }, { lib: "Commission d'intervention", val: "8 € par opération, 80 € par mois au maximum" }],
      avantages: ["Aucun frais de tenue de compte.", "Offre qui évolue naturellement vers le Compte courant Équilibre à 26 ans."],
      risques: ["Le client doit prendre un nouveau contrat au-delà de 25 ans : la tarification change.", "Première expérience de budget : risque de découvert mal maîtrisé."],
      reglementaire: ["Les jeunes majeurs ont droit au compte comme tout client.", MENTION_DEPOTS],
      cmp: { cout: "0 € / mois", liquidite: "Immédiate", rendement: "Aucun", risque: "Aucun sur le capital", fisc: "Sans objet", ticket: "Aucun dépôt minimum", plafond: "Aucun" }
    },
    {
      id: "OCF", famille: "compte", nom: "Offre Clientèle Fragile", code: "OCF",
      accroche: "Une offre spécifique, au tarif limité, pour les clients en situation de fragilité financière.",
      public: "Clients identifiés par la banque comme financièrement fragiles, ou qui en font la demande avec leur conseiller.",
      eligibilite: ["Situation de fragilité détectée par la banque (incidents de paiement répétés, surendettement, etc.) ou demande du client.", "Aucune condition de revenu fixée par la banque."],
      caracteristiques: ["Carte de paiement à autorisation systématique (le solde est vérifié à chaque paiement).", "Services de base inclus : retraits, virements SEPA (nombre limité par mois), prélèvements, chèques de banque.", "Alertes sur le niveau du solde."],
      tarifs: [{ lib: "Cotisation de l'offre", val: "1,00 € par mois (plafond réglementaire : 3 € par mois)" }, { lib: "Frais d'incidents", val: "20 € par mois et 200 € par an au maximum" }, { lib: "Commission d'intervention", val: "4 € par opération, 20 € par mois au maximum" }],
      avantages: ["Frais d'incidents fortement plafonnés.", "Aide le client à retrouver un budget équilibré."],
      risques: ["Moyens de paiement limités : carte à autorisation systématique, services de base en nombre limité.", "Le client peut mal vivre l'étiquette « fragile » : il faut expliquer l'offre avec tact."],
      reglementaire: ["Les établissements doivent détecter les clients en situation de fragilité financière et leur proposer l'offre spécifique.", "Tarif de l'offre plafonné à 3 € par mois ; frais d'incidents plafonnés à 20 € par mois et 200 € par an pour ses titulaires (25 € par mois pour les clients fragiles sans l'offre).", MENTION_DEPOTS],
      cmp: { cout: "1,00 € / mois", liquidite: "Immédiate", rendement: "Aucun", risque: "Aucun sur le capital", fisc: "Sans objet", ticket: "Aucun dépôt minimum", plafond: "Frais d'incidents : 20 € / mois" }
    },

    /* ---------- cartes ---------- */
    {
      id: "VCLA", famille: "carte", nom: "Carte Visa Classic", code: "Visa Classic",
      accroche: "La carte de paiement et de retrait du quotidien.",
      public: "Clients majeurs titulaires d'un compte courant.",
      eligibilite: ["Titulaire d'un compte courant Équilibre ou d'un compte Jeune.", "Absence d'incident de paiement grave."],
      caracteristiques: ["Débit immédiat ou différé, au choix.", "Plafond de paiement : 2 500 € par 30 jours ; retraits : 500 € par 7 jours.", "Paiement sans contact et mobile, opposition 24 h sur 24.", "Assurance et assistance de base."],
      tarifs: [{ lib: "Cotisation annuelle", val: "45 €" }, { lib: "Retrait distributeur GS Banque & Assurance", val: "Gratuit" }],
      avantages: ["Carte acceptée dans le monde entier.", "Maîtrise du budget grâce au débit immédiat."],
      risques: ["Perte ou vol : faire opposition sans délai ; la responsabilité du client est limitée dans les conditions prévues par la loi.", "Débit différé : risque d'oublier le montant à débiter en fin de mois."],
      reglementaire: ["Opposition en cas de perte, vol ou utilisation frauduleuse : le client doit agir sans tarder et contester l'opération dans les 13 mois.", "En cas d'incidents ou d'interdiction bancaire, la banque peut remplacer la carte par une carte à autorisation systématique."],
      cmp: { cout: "45 € / an", liquidite: "Immédiate", rendement: "Aucun", risque: "Sans objet", fisc: "Sans objet", ticket: "Sans objet", plafond: "2 500 € / 30 jours" }
    },
    {
      id: "VPRE", famille: "carte", nom: "Carte Visa Premier", code: "Visa Premier",
      accroche: "Une carte haut de gamme avec assurances voyage et plafonds élevés.",
      public: "Clients dont les revenus sont domiciliés ou dont la relation est solide.",
      eligibilite: ["Revenus nets mensuels d'au moins 2 000 € domiciliés à GS Banque & Assurance, ou encours d'épargne suffisant.", "Compte fonctionnant sans incident."],
      caracteristiques: ["Plafond de paiement : 6 000 € par 30 jours ; retraits : 1 000 € par 7 jours.", "Assurance voyage et assistance étendues, garanties achats.", "Débit immédiat ou différé."],
      tarifs: [{ lib: "Cotisation annuelle", val: "138 €" }, { lib: "Retrait distributeur GS Banque & Assurance", val: "Gratuit" }],
      avantages: ["Plafonds élevés pour les gros achats et les voyages.", "Assurances et assistance incluses."],
      risques: ["Coût élevé : à justifier par un usage réel des garanties.", "Le client peut avoir déjà les mêmes garanties par ailleurs."],
      reglementaire: ["Mêmes règles d'opposition et de contestation que pour toute carte de paiement.", "Les garanties d'assurance sont décrites dans la notice remise au client."],
      cmp: { cout: "138 € / an", liquidite: "Immédiate", rendement: "Aucun", risque: "Sans objet", fisc: "Sans objet", ticket: "Sans objet", plafond: "6 000 € / 30 jours" }
    },
    {
      id: "VJEU", famille: "carte", nom: "Carte Visa Classic Jeune", code: "Visa Jeune",
      accroche: "La carte à débit immédiat des 18-25 ans.",
      public: "Clients de 18 à 25 ans.",
      eligibilite: ["Avoir entre 18 et 25 ans.", "Titulaire du compte Jeune."],
      caracteristiques: ["Débit immédiat uniquement.", "Plafond de paiement : 1 000 € par 30 jours ; retraits : 300 € par 7 jours.", "Paiement sans contact et mobile."],
      tarifs: [{ lib: "Cotisation annuelle", val: "20 €" }],
      avantages: ["Tarif réduit.", "Plafonds adaptés à un petit budget."],
      risques: ["Plafonds bas : peuvent gêner pour un achat important.", "La carte est remplacée à 26 ans."],
      reglementaire: ["Mêmes règles d'opposition et de contestation que pour toute carte de paiement."],
      cmp: { cout: "20 € / an", liquidite: "Immédiate", rendement: "Aucun", risque: "Sans objet", fisc: "Sans objet", ticket: "Sans objet", plafond: "1 000 € / 30 jours" }
    },
    {
      id: "VELE", famille: "carte", controleSolde: true, nom: "Carte Visa Electron (à contrôle de solde)", code: "Visa Electron",
      accroche: "Une carte de paiement qui vérifie le solde à chaque achat : on ne dépense que ce qu'il y a sur le compte.",
      public: "Clients majeurs qui veulent maîtriser leur budget, ou à qui une carte classique n'est pas proposée (incidents de paiement, fragilité financière).",
      eligibilite: ["Être majeur et titulaire d'un compte courant (Équilibre, Jeune ou offre clientèle fragile).", "Aucune condition de revenus ni d'ancienneté."],
      caracteristiques: ["Carte à contrôle de solde (autorisation systématique) : à chaque paiement et à chaque retrait, la banque vérifie que le solde du compte couvre le montant ; sinon l'opération est refusée.", "Débit immédiat uniquement : pas de débit différé.", "Plafond de paiement : 1 000 € par 30 jours ; retraits : 500 € par 7 jours.", "Elle ne peut pas rendre le compte débiteur, même si le client a une autorisation de découvert.", "Paiement sans contact et mobile, opposition 24 h sur 24."],
      tarifs: [{ lib: "Cotisation annuelle", val: "35 €" }, { lib: "Retrait distributeur GS Banque & Assurance", val: "Gratuit" }],
      avantages: ["Maîtrise du budget : impossible de dépenser plus que le solde du compte.", "Moins chère que la Visa Classic (35 € par an contre 45 €).", "Peut être proposée à un client à qui la banque ne souhaite pas remettre de carte à débit différé."],
      risques: ["Un paiement est refusé dès que le solde est insuffisant, même de quelques euros : le client doit approvisionner son compte avant d'acheter.", "Certains commerçants (location de véhicule, hôtel, réservation en ligne) peuvent la refuser parce qu'ils demandent une garantie que ce type de carte ne donne pas toujours.", "Perte ou vol : faire opposition sans délai ; la responsabilité du client est limitée dans les conditions prévues par la loi."],
      reglementaire: ["Mêmes règles d'opposition et de contestation que pour toute carte de paiement : le client conteste les opérations frauduleuses dans les 13 mois.", "La carte à contrôle de solde ne remplace pas la carte de retrait : elle permet de payer chez les commerçants, la carte de retrait non.", "En cas d'incidents de paiement ou d'interdiction bancaire, la banque peut remplacer une carte à débit différé par une carte à autorisation systématique : le choix lui appartient."],
      cmp: { cout: "35 € / an", liquidite: "Immédiate", rendement: "Aucun", risque: "Sans objet", fisc: "Sans objet", ticket: "Sans objet", plafond: "1 000 € / 30 jours" }
    },
    {
      id: "CRET", famille: "carte", nom: "Carte de retrait", code: "Retrait",
      accroche: "Retraits aux distributeurs uniquement, sans paiement chez les commerçants.",
      public: "Clients interdits bancaires ou qui ne souhaitent pas de carte de paiement.",
      eligibilite: ["Titulaire d'un compte courant.", "Aucune condition particulière."],
      caracteristiques: ["Retraits aux distributeurs, plafond 500 € par 7 jours.", "Aucun paiement chez les commerçants."],
      tarifs: [{ lib: "Cotisation annuelle", val: "12 €" }],
      avantages: ["Accessible à tous.", "Pas de risque de dépense en carte."],
      risques: ["Pas de paiement en ligne ni chez les commerçants : le client utilise surtout des espèces."],
      reglementaire: ["Elle peut être délivrée à un client interdit bancaire."],
      cmp: { cout: "12 € / an", liquidite: "Immédiate", rendement: "Aucun", risque: "Sans objet", fisc: "Sans objet", ticket: "Sans objet", plafond: "500 € / 7 jours" }
    },

    /* ---------- épargne bancaire ---------- */
    {
      id: "LA", famille: "epargne", nom: "Livret A", code: "Livret A",
      accroche: "L'épargne de précaution, disponible à tout moment, non imposable.",
      public: "Toute personne, y compris les mineurs ; un seul Livret A par personne.",
      eligibilite: ["Une seule détention par personne dans tout le système bancaire.", "Dépôt initial : 10 € minimum."],
      caracteristiques: [TAUX_NEWSLETTER + " (taux net, fixé par les pouvoirs publics).", "Plafond de dépôts : 22 950 € (hors intérêts capitalisés).", "Intérêts calculés par quinzaine, capitalisés au 31 décembre."],
      tarifs: [{ lib: "Frais de tenue", val: "Aucun" }, { lib: "Taux annuel", val: TAUX_NEWSLETTER }],
      avantages: ["Capital garanti, disponibilité immédiate.", "Intérêts exonérés d'impôt sur le revenu et de prélèvements sociaux."],
      risques: ["Rendement faible : il peut être inférieur à l'inflation.", "Plafond : au-delà, il faut un autre support."],
      reglementaire: ["Taux fixé par les pouvoirs publics, révisé deux fois par an (1er février et 1er août).", "Intérêts exonérés d'impôt sur le revenu et de prélèvements sociaux.", MENTION_DEPOTS],
      cmp: { cout: "Gratuit", liquidite: "Immédiate", rendement: TAUX_NEWSLETTER, risque: "Aucun sur le capital", fisc: "Exonéré", ticket: "10 €", plafond: "22 950 €" }
    },
    {
      id: "LDDS", famille: "epargne", nom: "Livret de développement durable et solidaire", code: "LDDS",
      accroche: "Un livret réglementé complémentaire du Livret A.",
      public: "Personnes majeures, résidentes fiscales en France ; un seul LDDS par personne.",
      eligibilite: ["Avoir 18 ans révolus et résider fiscalement en France.", "Un majeur rattaché au foyer fiscal de ses parents ne peut pas détenir de LDDS (à vérifier avec le client).", "Dépôt initial : 10 € minimum (minimum habituellement demandé par les banques)."],
      caracteristiques: [TAUX_NEWSLETTER + " (taux net, identique à celui du Livret A).", "Plafond de dépôts : 12 000 €.", "Disponibilité immédiate."],
      tarifs: [{ lib: "Frais de tenue", val: "Aucun" }, { lib: "Taux annuel", val: TAUX_NEWSLETTER }],
      avantages: ["Capital garanti, disponibilité immédiate.", "Intérêts exonérés d'impôt sur le revenu et de prélèvements sociaux.", "Permet d'augmenter l'épargne de précaution au-delà du Livret A."],
      risques: ["Rendement faible : il peut être inférieur à l'inflation."],
      reglementaire: ["Un seul LDDS par personne ; un couple peut en avoir deux (un chacun).", "Intérêts exonérés d'impôt sur le revenu et de prélèvements sociaux.", MENTION_DEPOTS],
      cmp: { cout: "Gratuit", liquidite: "Immédiate", rendement: TAUX_NEWSLETTER, risque: "Aucun sur le capital", fisc: "Exonéré", ticket: "10 €", plafond: "12 000 €" }
    },
    {
      id: "LEP", famille: "epargne", nom: "Livret d'épargne populaire", code: "LEP",
      accroche: "Le livret réglementé le mieux rémunéré, réservé aux foyers modestes.",
      public: "Personnes dont le revenu fiscal de référence ne dépasse pas un plafond selon le nombre de parts.",
      eligibilite: ["Revenu fiscal de référence (année N-2 ou N-1 selon la date d'ouverture) inférieur ou égal au plafond applicable en 2026 : 23 028 € pour 1 part, 29 177 € pour 1,5 part, 35 326 € pour 2 parts, 41 475 € pour 2,5 parts, 47 624 € pour 3 parts, puis 6 149 € par demi-part supplémentaire.", "Un seul LEP par personne ; un majeur rattaché au foyer fiscal de ses parents ne peut pas en détenir (à vérifier avec le client).", "Dépôt initial : 30 € minimum."],
      caracteristiques: [TAUX_NEWSLETTER + " (taux net, fixé par les pouvoirs publics).", "Plafond de dépôts : 10 000 €.", "Disponibilité immédiate."],
      tarifs: [{ lib: "Frais de tenue", val: "Aucun" }, { lib: "Taux annuel", val: TAUX_NEWSLETTER }],
      avantages: ["Meilleur taux des livrets réglementés.", "Intérêts exonérés d'impôt sur le revenu et de prélèvements sociaux."],
      risques: ["Les conditions de revenu sont contrôlées chaque année : le livret est clôturé après deux années consécutives de dépassement du plafond de revenu fiscal de référence."],
      reglementaire: ["Le client doit présenter son avis d'imposition ; la banque vérifie l'éligibilité chaque année.", "Intérêts exonérés d'impôt sur le revenu et de prélèvements sociaux.", MENTION_DEPOTS],
      cmp: { cout: "Gratuit", liquidite: "Immédiate", rendement: TAUX_NEWSLETTER, risque: "Aucun sur le capital", fisc: "Exonéré", ticket: "30 €", plafond: "10 000 €" }
    },
    {
      id: "LJ", famille: "epargne", nom: "Livret Jeune", code: "Livret Jeune",
      accroche: "Un premier livret pour les 12-25 ans, avec un taux fixé par la banque.",
      public: "Jeunes de 12 à 25 ans résidant en France ; un seul livret jeune par personne.",
      eligibilite: ["Avoir entre 12 et 25 ans.", "Résider en France.", "Dépôt initial : 10 € minimum."],
      caracteristiques: ["Taux fixé par la banque, au moins égal à celui du Livret A : 2,00 % net.", "Plafond de dépôts : 1 600 € (hors intérêts).", "Disponibilité immédiate."],
      tarifs: [{ lib: "Frais de tenue", val: "Aucun" }, { lib: "Taux annuel", val: "2,00 % net" }],
      avantages: ["Capital garanti, disponibilité immédiate.", "Intérêts exonérés d'impôt sur le revenu et de prélèvements sociaux."],
      risques: ["Plafond bas.", "Le livret est clôturé au plus tard le 31 décembre de l'année des 25 ans."],
      reglementaire: ["Le taux ne peut pas être inférieur à celui du Livret A.", "Intérêts exonérés d'impôt sur le revenu et de prélèvements sociaux.", MENTION_DEPOTS],
      cmp: { cout: "Gratuit", liquidite: "Immédiate", rendement: "2,00 % net", risque: "Aucun sur le capital", fisc: "Exonéré", ticket: "10 €", plafond: "1 600 €" }
    },
    {
      id: "LBR", famille: "epargne", nom: "Livret Projets", code: "Livret Projets",
      accroche: "Un livret non réglementé, sans plafond, pour mettre de côté au-delà des livrets réglementés.",
      public: "Toute personne majeure.",
      eligibilite: ["Être majeur.", "Dépôt initial : 100 € minimum."],
      caracteristiques: ["Taux brut de 1,40 % par an, fixé par la banque et révisable.", "Aucun plafond de dépôts.", "Disponibilité immédiate."],
      tarifs: [{ lib: "Frais de tenue", val: "Aucun" }, { lib: "Taux annuel", val: "1,40 % brut" }],
      avantages: ["Pas de plafond.", "Disponibilité immédiate, capital garanti."],
      risques: ["Les intérêts sont soumis à la fiscalité des revenus de capitaux mobiliers : le rendement net est inférieur au taux brut.", "Le taux peut être révisé par la banque à tout moment."],
      reglementaire: ["Intérêts imposables (voir la notice fiscale remise au client).", MENTION_DEPOTS],
      cmp: { cout: "Gratuit", liquidite: "Immédiate", rendement: "1,40 % brut", risque: "Aucun sur le capital", fisc: "Intérêts imposables", ticket: "100 €", plafond: "Aucun" }
    },

    /* ---------- placements et retraite ---------- */
    {
      id: "AV", famille: "placement", nom: "GS Vie Patrimoine – assurance-vie multisupport", code: "Assurance-vie",
      accroche: "Un contrat d'épargne à moyen et long terme, avec un fonds en euros et des unités de compte.",
      public: "Personnes majeures, pour constituer un capital ou préparer une transmission.",
      eligibilite: ["Être majeur et capable.", "Versement initial minimum : 500 €.", "Questionnaire de connaissance et d'expérience obligatoire avant tout investissement en unités de compte."],
      caracteristiques: ["Fonds en euros et unités de compte (actions, obligations, immobilier…).", "Épargne disponible à tout moment (rachat partiel ou total).", "Clause bénéficiaire pour la transmission du capital au décès."],
      tarifs: [{ lib: "Frais sur versements", val: "2,00 % (négociable)" }, { lib: "Frais de gestion annuels sur le fonds en euros", val: "0,80 %" }, { lib: "Frais de gestion annuels sur les unités de compte", val: "0,95 %" }, { lib: "Rendement du fonds en euros du dernier exercice", val: TAUX_NEWSLETTER + " (net de frais de gestion ; les performances passées ne préjugent pas des performances futures)" }],
      avantages: ["Fiscalité allégée après 8 ans : abattement annuel de 4 600 € sur les gains pour une personne seule, 9 200 € pour un couple.", "Transmission : cadre fiscal avantageux pour les bénéficiaires.", "Choix entre sécurité (fonds en euros) et performance potentielle (unités de compte)."],
      risques: ["Sur les unités de compte, le capital n'est pas garanti : perte possible.", "Frais à comparer avec le rendement attendu.", "Fiscalité des retraits moins favorable avant 8 ans."],
      reglementaire: ["Les gains sont imposables au moment des rachats, après abattement si le contrat a plus de 8 ans.", "Garantie des assureurs en cas de défaillance, dans les limites prévues par la loi (voir la notice).", "Devoir de conseil et profil investisseur obligatoires. Ce n'est pas un placement garanti : la valeur des unités de compte peut varier à la hausse comme à la baisse."],
      cmp: { cout: "Frais sur versements 2,00 %, gestion 0,80 à 0,95 % / an", liquidite: "Rachat possible à tout moment", rendement: "Fonds en euros : " + TAUX_NEWSLETTER.toLowerCase() + " ; UC variable", risque: "Faible (fonds en euros) à élevé (unités de compte)", fisc: "Avantageuse après 8 ans", ticket: "500 €", plafond: "Aucun" }
    },
    {
      id: "PEA", famille: "placement", nom: "GS PEA Actions", code: "PEA",
      accroche: "Un plan d'épargne pour investir en actions européennes avec une fiscalité avantageuse à long terme.",
      public: "Personnes majeures, domiciliées fiscalement en France ; un PEA par personne.",
      eligibilite: ["Être majeur, domicilié fiscalement en France.", "Un seul PEA par personne.", "Versement initial minimum : 300 €.", "Questionnaire de connaissance et d'expérience obligatoire."],
      caracteristiques: ["Plafond de versements : 150 000 €.", "Investissement en actions de sociétés de l'Union européenne ou de l'Espace économique européen.", "Compte espèces associé obligatoire."],
      tarifs: [{ lib: "Droits de garde", val: "0,30 % par an du portefeuille" }, { lib: "Frais de courtage", val: "0,60 % par ordre, minimum 2,50 €" }],
      avantages: ["Après 5 ans : gains exonérés d'impôt sur le revenu (restent soumis aux prélèvements sociaux).", "Possibilité de rachat partiel après 5 ans sans clôturer le plan."],
      risques: ["Le capital n'est pas garanti : les actions peuvent perdre de la valeur.", "Retrait avant 5 ans : clôture du plan, avec fiscalité des gains.", "Concentration sur les marchés européens."],
      reglementaire: ["Plafond de versements : 150 000 €.", "Gains exonérés d'impôt sur le revenu après 5 ans, hors prélèvements sociaux.", "Investir en actions comporte un risque de perte en capital."],
      cmp: { cout: "Garde 0,30 % / an, courtage 0,60 %", liquidite: "Possible, mais fiscalité pénalisante avant 5 ans", rendement: "Variable, non garanti", risque: "Élevé (actions)", fisc: "Exonération d'impôt sur le revenu après 5 ans", ticket: "300 €", plafond: "150 000 €" }
    },
    {
      id: "PER", famille: "placement", nom: "GS PER Individuel", code: "PER",
      accroche: "Un plan d'épargne pour préparer la retraite, avec un avantage fiscal à l'entrée.",
      public: "Personnes majeures qui souhaitent préparer leur retraite, surtout si elles sont imposables.",
      eligibilite: ["Être majeur.", "Versement initial minimum : 300 € ; versements libres ensuite.", "Questionnaire de connaissance et d'expérience obligatoire."],
      caracteristiques: ["Versements libres ou programmés, déductibles du revenu imposable dans la limite d'un plafond.", "Épargne bloquée jusqu'à la retraite, sauf cas de déblocage anticipé prévus par la loi.", "Sortie en capital, en rente ou en combinant les deux."],
      tarifs: [{ lib: "Frais sur versements", val: "2,00 %" }, { lib: "Frais de gestion annuels", val: "0,85 %" }],
      avantages: ["Versements déductibles du revenu imposable : intéressant pour un client à tranche marginale élevée.", "Épargne protégée des dépenses courantes."],
      risques: ["Épargne bloquée jusqu'à la retraite.", "Les sommes sont imposées à la sortie.", "Unités de compte : perte en capital possible."],
      reglementaire: ["Déblocage anticipé possible notamment pour l'achat de la résidence principale, l'invalidité, le décès du conjoint, la fin de droits au chômage, le surendettement.", "Le plafond de déduction dépend des revenus professionnels de l'année précédente (voir la notice).", "Ce n'est pas un placement garanti."],
      cmp: { cout: "Versements 2,00 %, gestion 0,85 % / an", liquidite: "Bloqué jusqu'à la retraite (sauf cas légaux)", rendement: "Variable, non garanti", risque: "Faible à élevé selon les supports", fisc: "Versements déductibles, sorties imposées", ticket: "300 €", plafond: "Aucun plafond de dépôt (plafond de déduction)" }
    },

    /* ---------- crédits ---------- */
    {
      id: "CIMMO", famille: "credit", nom: "Prêt immobilier GS", code: "Prêt immobilier",
      accroche: "Un prêt à taux fixe pour acheter ou construire une résidence principale.",
      public: "Particuliers majeurs qui achètent, construisent ou rénovent un logement.",
      eligibilite: ["Taux d'endettement après prêt limité à 35 % des revenus nets, assurance emprunteur comprise (décision du HCSF).", "Durée maximale : 25 ans (27 ans avec différé d'amortissement pour un achat sur plan ou avec gros travaux).", "Apport personnel conseillé d'au moins 10 % du prix.", "Revenus stables et dossier sans incident ; consultation du fichier des incidents de remboursement (FICP)."],
      caracteristiques: ["Taux fixe : 15 ans, 3,45 % ; 20 ans, 3,60 % ; 25 ans, 3,70 % hors assurance.", "Remboursement par mensualités constantes.", "Garantie : caution ou hypothèque.", "Assurance emprunteur exigée en pratique : décès, invalidité (délégation possible chez un autre assureur)."],
      tarifs: [{ lib: "Frais de dossier", val: "750 €" }, { lib: "Taux fixe", val: "15 ans : 3,45 % – 20 ans : 3,60 % – 25 ans : 3,70 %" }, { lib: "Indemnité de remboursement anticipé", val: "Au plus le plus faible de deux montants : 6 mois d'intérêts ou 3 % du capital restant dû (plafond légal) ; cas d'exonération (mutation professionnelle, perte d'emploi, décès)" }],
      avantages: ["Mensualité fixe : le budget est prévisible.", "Le client devient propriétaire de sa résidence principale."],
      risques: ["Engagement sur 15 à 25 ans.", "Si le client perd son revenu, le remboursement peut devenir difficile.", "Le bien peut être saisi en cas de défaillance (hypothèque)."],
      reglementaire: [MENTION_CREDIT, "Délai de réflexion de 10 jours après réception de l'offre de prêt avant de pouvoir l'accepter.", "Le TAEG doit rester inférieur au taux d'usure : au 4e trimestre 2026, pour un prêt à taux fixe, moins de 10 ans 4,09 %, de 10 à moins de 20 ans 4,68 %, 20 ans et plus 5,40 %.", "Assurance emprunteur : le client peut la résilier à tout moment et changer de contrat (loi Lemoine)."],
      cmp: { cout: "Frais de dossier 750 € ; taux 3,45 à 3,70 %", liquidite: "Sans objet", rendement: "Sans objet", risque: "Engagement long, hypothèque", fisc: "Sans objet", ticket: "À partir de 50 000 €", plafond: "Durée 25 ans (27 ans avec différé)" }
    },
    {
      id: "CCONSO", famille: "credit", nom: "Prêt personnel GS", code: "Prêt personnel",
      accroche: "Un crédit à la consommation pour financer un projet sans justificatif d'achat.",
      public: "Particuliers majeurs, avec des revenus réguliers.",
      eligibilite: ["Revenus stables et capacité de remboursement démontrée.", "Montant de 1 500 € à 75 000 € ; durée de 12 à 84 mois.", "Consultation du fichier des incidents de remboursement (FICP)."],
      caracteristiques: ["Taux fixe : TAEG à partir de 5,90 % ; exemple : 10 000 € sur 48 mois à TAEG 6,50 %.", "Mensualités constantes ; déblocage sur le compte.", "Assurance facultative (décès, invalidité)."],
      tarifs: [{ lib: "Frais de dossier", val: "Aucun" }, { lib: "TAEG", val: "À partir de 5,90 %" }, { lib: "Remboursement anticipé", val: "Indemnité encadrée par la loi : au plus 1 % du capital remboursé par anticipation (0,5 % si le délai restant est d'un an au plus), sans dépasser les intérêts restant dus ; cas d'exonération" }],
      avantages: ["Montant disponible rapidement.", "Mensualité fixe."],
      risques: ["Surendettement si les mensualités sont trop lourdes.", "Coût total du crédit à comparer avec l'épargne disponible."],
      reglementaire: [MENTION_CREDIT_CONSO, "Délai de rétractation de 14 jours après la signature du contrat.", "Le TAEG doit rester inférieur au taux d'usure."],
      cmp: { cout: "TAEG à partir de 5,90 %", liquidite: "Sans objet", rendement: "Sans objet", risque: "Surendettement possible", fisc: "Sans objet", ticket: "1 500 €", plafond: "75 000 €" }
    },
    {
      id: "CAUTO", famille: "credit", nom: "Crédit auto GS", code: "Crédit auto",
      accroche: "Un crédit affecté à l'achat d'un véhicule.",
      public: "Particuliers majeurs qui achètent un véhicule neuf ou d'occasion.",
      eligibilite: ["Bon de commande ou facture du véhicule.", "Revenus stables et capacité de remboursement démontrée.", "Montant de 3 000 € à 50 000 € ; durée de 12 à 84 mois."],
      caracteristiques: ["TAEG à partir de 5,50 % ; le véhicule est financé directement chez le vendeur.", "Mensualités constantes.", "Assurance facultative (décès, invalidité)."],
      tarifs: [{ lib: "Frais de dossier", val: "Aucun" }, { lib: "TAEG", val: "À partir de 5,50 %" }],
      avantages: ["Taux souvent plus bas que celui d'un prêt personnel.", "Crédit lié à l'achat : si l'achat est annulé, le crédit l'est aussi."],
      risques: ["Le véhicule perd de la valeur plus vite que le crédit ne se rembourse.", "Surendettement si les mensualités sont trop lourdes."],
      reglementaire: [MENTION_CREDIT_CONSO, "Délai de rétractation de 14 jours ; crédit affecté : le contrat de vente est lié au crédit."],
      cmp: { cout: "TAEG à partir de 5,50 %", liquidite: "Sans objet", rendement: "Sans objet", risque: "Surendettement possible", fisc: "Sans objet", ticket: "3 000 €", plafond: "50 000 €" }
    },
    {
      id: "CTRAV", famille: "credit", nom: "Prêt travaux GS", code: "Prêt travaux",
      accroche: "Un crédit pour financer des travaux de rénovation ou d'amélioration du logement.",
      public: "Propriétaires et locataires qui réalisent des travaux.",
      eligibilite: ["Devis ou factures des travaux.", "Revenus stables et capacité de remboursement démontrée.", "Montant de 2 000 € à 75 000 € ; durée de 12 à 120 mois."],
      caracteristiques: ["TAEG à partir de 5,70 %.", "Mensualités constantes ; déblocage sur présentation des factures.", "Assurance facultative."],
      tarifs: [{ lib: "Frais de dossier", val: "Aucun" }, { lib: "TAEG", val: "À partir de 5,70 %" }],
      avantages: ["Financement adapté à des travaux d'amélioration ou d'économie d'énergie.", "Mensualité fixe."],
      risques: ["Les devis peuvent être dépassés : prévoir une marge.", "Surendettement si les mensualités sont trop lourdes."],
      reglementaire: [MENTION_CREDIT_CONSO, "Délai de rétractation de 14 jours."],
      cmp: { cout: "TAEG à partir de 5,70 %", liquidite: "Sans objet", rendement: "Sans objet", risque: "Surendettement possible", fisc: "Sans objet", ticket: "2 000 €", plafond: "75 000 €" }
    },

    {
      id: "DECOUV", famille: "credit", horsMontage: true, nom: "Autorisation de découvert GS", code: "Découvert autorisé",
      accroche: "Une marge de manœuvre sur le compte courant pour passer un cap de trésorerie de courte durée.",
      public: "Clients majeurs titulaires d'un compte courant, dont les revenus sont domiciliés à la banque et qui ne sont pas fichés au FICP.",
      eligibilite: ["Être majeur et titulaire d'un compte courant à GS Banque & Assurance.", "Revenus domiciliés à GS Banque & Assurance : la banque évalue la capacité de remboursement du client avant d'accorder l'autorisation (art. L312-16 du Code de la consommation).", "Absence de fichage au FICP (fichier des incidents de remboursement des crédits aux particuliers), à vérifier par une consultation de la Banque de France.", "Montant autorisé : de 100 € à 2 000 €, sans dépasser 50 % des revenus nets mensuels versés sur le compte (règle de la banque)."],
      caracteristiques: ["Un plafond fixé dans la convention de compte ou dans un avenant, pour une durée déterminée ou indéterminée.", "Le client l'utilise quand il en a besoin, sans nouvelle demande : le compte peut passer en négatif jusqu'au plafond.", "Taux débiteur de 17,40 % par an (1,45 % par mois), appliqué aux seuls montants et aux seuls jours où le compte est débiteur : ce sont les agios.", "Pas d'échéancier : le découvert se résorbe quand de l'argent est versé sur le compte (salaire, virement). Les intérêts (agios) et les commissions sont prélevés sur le compte chaque trimestre ; le relevé de compte mensuel indique les agios (art. L312-88)."],
      tarifs: [{ lib: "Taux débiteur", val: "17,40 % par an, soit 1,45 % par mois" }, { lib: "Frais de dossier", val: "Aucun" }, { lib: "Commission d'intervention (paiement en irrégularité)", val: "8 € par opération, 80 € par mois" }],
      avantages: ["Une marge disponible sans nouvelle demande à chaque besoin.", "Pas de remboursement à planifier, pas de frais de dossier.", "Les intérêts ne courent que les jours où le compte est débiteur."],
      risques: ["Un crédit cher : 17,40 % par an, bien plus qu'un prêt personnel (à partir de 5,90 %).", "Un découvert qui dure signale un budget déséquilibré : les agios s'accumulent.", "Au-delà du plafond : frais d'incidents (commission d'intervention, rejets) ; un incident de remboursement non régularisé peut mener à une inscription au FICP."],
      reglementaire: [MENTION_CREDIT_CONSO, "Opérations de découvert en compte : articles L312-88 à L312-95 du Code de la consommation (relevé mensuel, autorisation à durée indéterminée ou déterminée, dépassement).", "Le TAEG doit rester inférieur au taux d'usure fixé chaque trimestre par la Banque de France.", "Délai de rétractation de 14 jours calendaires après l'acceptation du contrat de crédit (art. L312-19).", "Si le compte reste à découvert au-delà de l'autorisation pendant plus de 3 mois, la banque doit proposer au client un autre type de crédit, remboursable par mensualités (art. L312-93).", "Réforme du crédit à la consommation à partir du 20 novembre 2026 (ordonnance n° 2025-880 du 3 septembre 2025) : la solvabilité est évaluée même pour un petit découvert ; une autorisation à durée indéterminée ne peut être réduite ou supprimée qu'avec un préavis de 2 mois au moins (30 jours au moins pour une autorisation à durée déterminée), sauf motif objectivement justifié ; le client rembourse alors l'excédent en 12 mensualités égales, sans frais supplémentaires (art. L312-90 et L312-91)."],
      cmp: { cout: "Taux débiteur 17,40 % par an, sans frais de dossier", liquidite: "Disponible tout de suite, dans la limite du plafond", rendement: "Sans objet", risque: "Dette coûteuse si elle dure ; frais en cas de dépassement", fisc: "Sans objet", ticket: "100 €", plafond: "2 000 € (au plus 50 % des revenus)" }
    },
    {
      id: "CREV", famille: "credit", horsMontage: true, nom: "Crédit renouvelable GS", code: "Crédit renouvelable",
      accroche: "Une réserve d'argent qui se reconstitue à mesure que le client la rembourse.",
      public: "Particuliers majeurs dont les revenus sont domiciliés à la banque et qui ne sont pas fichés au FICP, pour des dépenses imprévues ou de petits achats.",
      eligibilite: ["Être majeur ; revenus domiciliés à GS Banque & Assurance et capacité de remboursement démontrée.", "Montant de la réserve de 500 € à 6 000 € (règle de la banque).", "Absence de fichage au FICP (fichier des incidents de remboursement des crédits aux particuliers), à vérifier par une consultation de la Banque de France avant la signature, puis chaque année avant la reconduction du contrat."],
      caracteristiques: ["Une réserve d'argent à disposition : le client l'utilise en une ou plusieurs fois, et elle se reconstitue à mesure des remboursements.", "Les intérêts ne portent que sur les sommes utilisées ; chaque mensualité comprend des intérêts et une part de capital.", "Contrat conclu pour un an et reconduit chaque année ; le client est informé des conditions de la reconduction 3 mois avant l'échéance.", "Durée de remboursement : 36 mois au plus pour une réserve de 3 000 € ou moins, 60 mois au plus au-delà."],
      tarifs: [{ lib: "Frais de dossier", val: "Aucun" }, { lib: "TAEG", val: "14,90 % (taux fixe)" }, { lib: "Réserve", val: "De 500 € à 6 000 €" }],
      avantages: ["Une réserve disponible sans nouvelle demande à chaque besoin.", "Les intérêts ne portent que sur la somme utilisée.", "Le client peut réduire la réserve, suspendre son utilisation ou résilier le contrat quand il le souhaite (le capital utilisé reste à rembourser)."],
      risques: ["Un coût bien plus élevé qu'un prêt personnel : TAEG de 14,90 % contre à partir de 5,90 %.", "La réserve qui se reconstitue incite à emprunter encore : la dette peut durer longtemps (risque de surendettement).", "Si le client ne rembourse que le minimum, les intérêts pèsent lourd dans chaque mensualité."],
      reglementaire: [MENTION_CREDIT_CONSO, "Crédit renouvelable : articles L312-57 à L312-83 du Code de la consommation.", "Au-delà de 1 000 €, le prêteur propose aussi un crédit amortissable, pour que le client compare (information précontractuelle, art. L312-62 et L312-63).", "Délai de rétractation de 14 jours calendaires après l'acceptation de l'offre (art. L312-19).", "Contrat conclu pour un an et reconductible : le prêteur consulte le FICP avant chaque reconduction et vérifie la solvabilité tous les 3 ans.", "Le TAEG doit rester inférieur au taux d'usure fixé chaque trimestre par la Banque de France.", "À partir du 20 novembre 2026 (ordonnance n° 2025-880 du 3 septembre 2025) : la solvabilité est aussi réévaluée avant une hausse significative de la réserve ; en cas d'impayé, le prêteur laisse un délai raisonnable avant toute procédure et propose, s'il y a lieu, un arrangement ; les fonds peuvent être versés dès l'acceptation de l'offre (le délai de 7 jours disparaît)."],
      cmp: { cout: "TAEG 14,90 %, sans frais de dossier", liquidite: "Réserve disponible à tout moment", rendement: "Sans objet", risque: "Surendettement possible", fisc: "Sans objet", ticket: "500 €", plafond: "6 000 €" }
    },

    /* ---------- assurances ---------- */
    {
      id: "MRH", famille: "assurance", nom: "GS Habitat – assurance habitation", code: "Habitation",
      accroche: "L'assurance multirisque habitation, locataire ou propriétaire occupant.",
      public: "Locataires (obligatoire) et propriétaires occupants.",
      eligibilite: ["Résider dans le logement assuré.", "Questionnaire de risque : surface, nombre de pièces, valeur du mobilier."],
      caracteristiques: ["Incendie, dégâts des eaux, vol, bris de glace, responsabilité civile.", "Formules locataire ou propriétaire occupant.", "Assistance (serrurerie, plomberie) incluse."],
      tarifs: [{ lib: "Cotisation locataire (à partir de)", val: "9 € par mois" }, { lib: "Cotisation propriétaire occupant (à partir de)", val: "18 € par mois" }, { lib: "Franchise générale", val: "150 €" }],
      avantages: ["Protection du logement et du mobilier.", "Un seul interlocuteur pour la banque et l'assurance."],
      risques: ["Sous-évaluation du mobilier : l'indemnisation serait réduite.", "Exclusions et franchises à lire avec le client."],
      reglementaire: ["Le locataire doit être assuré : il remet une attestation à son propriétaire chaque année.", MENTION_ASSUR],
      cmp: { cout: "À partir de 9 € / mois", liquidite: "Sans objet", rendement: "Sans objet", risque: "Sans objet", fisc: "Sans objet", ticket: "Sans objet", plafond: "Selon la formule" }
    },
    {
      id: "AUTO", famille: "assurance", nom: "GS Auto – assurance automobile", code: "Auto",
      accroche: "L'assurance du véhicule : tiers, tiers étendu ou tous risques.",
      public: "Propriétaires d'un véhicule terrestre à moteur (responsabilité civile obligatoire).",
      eligibilite: ["Carte grise et permis de conduire en cours de validité.", "Relevé d'information de l'assureur précédent."],
      caracteristiques: ["Responsabilité civile obligatoire, options vol, incendie, bris de glace, dommages tous accidents.", "Assistance 24 h sur 24.", "Bonus-malus selon l'historique du conducteur."],
      tarifs: [{ lib: "Formule au tiers (à partir de)", val: "25 € par mois" }, { lib: "Formule tous risques (à partir de)", val: "38 € par mois" }],
      avantages: ["Un seul interlocuteur pour la banque et l'assurance.", "Formules adaptées à l'âge et à la valeur du véhicule."],
      risques: ["Franchises et exclusions : à expliquer au client.", "Une fausse déclaration peut entraîner la nullité du contrat."],
      reglementaire: ["L'assurance de responsabilité civile est obligatoire pour tout véhicule.", MENTION_ASSUR],
      cmp: { cout: "À partir de 25 € / mois", liquidite: "Sans objet", rendement: "Sans objet", risque: "Sans objet", fisc: "Sans objet", ticket: "Sans objet", plafond: "Selon la formule" }
    },
    {
      id: "GAV", famille: "assurance", nom: "GS Protection Famille – garantie des accidents de la vie", code: "Accidents de la vie",
      accroche: "Une indemnisation en cas d'accident de la vie privée avec séquelles.",
      public: "Particuliers et familles.",
      eligibilite: ["Être majeur ; la garantie peut couvrir toute la famille.", "Questionnaire de santé simplifié."],
      caracteristiques: ["Indemnisation des dommages corporels subis lors d'accidents de la vie privée.", "Formules individuelle ou familiale."],
      tarifs: [{ lib: "Cotisation individuelle (à partir de)", val: "6 € par mois" }, { lib: "Cotisation familiale (à partir de)", val: "9,90 € par mois" }],
      avantages: ["Couvre des accidents que d'autres assurances n'indemnisent pas.", "Cotisation modérée."],
      risques: ["Seuil d'invalidité pour être indemnisé.", "Exclusions : certains accidents du travail ou de la route."],
      reglementaire: [MENTION_ASSUR],
      cmp: { cout: "À partir de 6 € / mois", liquidite: "Sans objet", rendement: "Sans objet", risque: "Sans objet", fisc: "Sans objet", ticket: "Sans objet", plafond: "Selon la formule" }
    },
    {
      id: "PREV", famille: "assurance", nom: "GS Prévoyance – décès et invalidité", code: "Prévoyance",
      accroche: "Un capital ou une rente pour protéger la famille en cas de décès ou d'invalidité.",
      public: "Actifs avec des proches à charge ou un crédit en cours.",
      eligibilite: ["Avoir entre 18 et 65 ans.", "Questionnaire de santé."],
      caracteristiques: ["Capital en cas de décès ou rente en cas d'invalidité, au choix du client.", "Cotisation selon l'âge, la profession et le capital."],
      tarifs: [{ lib: "Cotisation (à partir de)", val: "12 € par mois (capital de 50 000 €, client de 40 ans)" }],
      avantages: ["Protège le niveau de vie de la famille.", "Complète les garanties de l'employeur."],
      risques: ["Questionnaire de santé : une fausse déclaration entraîne la nullité.", "Cotisation qui augmente avec l'âge."],
      reglementaire: [MENTION_ASSUR],
      cmp: { cout: "À partir de 12 € / mois", liquidite: "Sans objet", rendement: "Sans objet", risque: "Sans objet", fisc: "Sans objet", ticket: "Sans objet", plafond: "Selon le capital choisi" }
    }
  ];

  /* ====================================================================================================================================================
     Produits ajoutés à l'étape 5 : conventions de compte, cartes haut de gamme, compte à terme, placements, assurances.
     Chaque produit est inséré dans son univers à la suite d'un produit existant (voir inserer).
     ==================================================================================================================================================== */
  function inserer(apres, liste) {
    var i = -1; PRODUITS.forEach(function (p, k) { if (p.id === apres) i = k; });
    if (i < 0) throw new Error("produit introuvable : " + apres);
    Array.prototype.splice.apply(PRODUITS, [i + 1, 0].concat(liste));
  }

  /* ---------- GS Connect : banque à distance (abonnement mensuel, compris dans les conventions de compte) ---------- */
  var GCON_MOIS = 3;     /* € par mois hors convention (36 € par an, comme le prix à l'unité des conventions) */
  var GCON = {
    id: "GCON", famille: "compte", nom: "GS Connect", code: "GS Connect",
    accroche: "La banque à distance : consulter ses comptes et gérer ses opérations depuis l'application mobile ou l'espace client en ligne, " + eu(GCON_MOIS) + " par mois, gratuit avec une convention de compte.",
    public: "Clients majeurs titulaires d'un compte courant de la banque.",
    eligibilite: ["Être majeur et titulaire d'un compte courant à GS Banque & Assurance (Équilibre, Jeune ou Offre Clientèle Fragile).", "Un mobile et une adresse e-mail à jour dans le dossier : le client y reçoit ses codes de sécurité.", "Contrat d'abonnement à signer par le client.", "Gratuit pour le titulaire d'une convention de compte (Avenir, Horizon ou Sérénité) : GS Connect est alors compris dans la cotisation de la convention, sans abonnement séparé."],
    caracteristiques: ["Accès sécurisé à l'espace bancaire sur ordinateur (espace client en ligne) et sur mobile (application), avec identifiants personnels et authentification forte.", "Consultation à distance des comptes : soldes, opérations, relevés de compte en ligne et RIB.", "Virements SEPA et virements instantanés depuis l'application ou l'espace client, et gestion des bénéficiaires.", "Simulation de crédit et taux de change consultables en ligne.", "Abonnement sans engagement, résiliable à tout moment."],
    tarifs: [
      { lib: "Abonnement GS Connect", val: eu(GCON_MOIS) + " par mois (" + eu(GCON_MOIS * 12) + " par an), prélevé sur le compte courant" },
      { lib: "Avec une convention de compte (Avenir, Horizon, Sérénité)", val: "Gratuit : GS Connect est compris dans la cotisation de la convention, qui exonère aussi les frais de tenue de compte" },
      { lib: "Virement instantané", val: "0,90 € le virement (12 virements par an compris dans les conventions Avenir et Horizon)" },
      { lib: "Engagement", val: "Aucun" }
    ],
    avantages: ["Le client suit ses comptes et fait ses virements à toute heure, sans passer par l'agence.", "Gratuit avec une convention de compte, qui exonère en plus les frais de tenue de compte.", "Un abonnement simple, sans engagement, résiliable à tout moment.", "Les relevés de compte et le RIB sont disponibles en ligne."],
    risques: ["Un abonnement de " + eu(GCON_MOIS * 12) + " par an qui n'a d'intérêt que si le client s'en sert réellement : un client qui vient surtout à l'agence peut s'en passer.", "Le client doit protéger ses identifiants et ses codes de sécurité : la banque ne les demande jamais par e-mail, SMS ou téléphone (hameçonnage).", "Sans mobile ni adresse e-mail à jour, l'authentification forte est impossible : à vérifier avant la souscription.", "Une panne du service ou du réseau empêche temporairement de consulter ses comptes : le client garde l'agence et les distributeurs."],
    reglementaire: ["Accès au compte et validation des opérations sensibles par authentification forte du client (directive européenne sur les services de paiement).", "Opération de paiement non autorisée : le client la conteste dans les 13 mois suivant le débit, après avoir informé sans tarder la banque en cas de perte ou de vol de ses identifiants.", "Le service est facultatif : le client peut le résilier à tout moment sans frais.", MENTION_DEPOTS],
    cmp: { cout: eu(GCON_MOIS) + " / mois (gratuit avec une convention)", liquidite: "Sans objet", rendement: "Sans objet", risque: "Sans objet", fisc: "Sans objet", ticket: "Sans objet", plafond: "Sans objet" }
  };

  /* ---------- GS Alertes : alertes par SMS (abonnement mensuel, compris dans les conventions de compte) ---------- */
  var GALE_MOIS = PRIMES.GALE.alerte;     /* € par mois hors convention (18 € par an, comme le prix à l'unité des conventions) */
  var GALE = {
    id: "GALE", famille: "compte", nom: "GS Alertes", code: "GS Alertes",
    accroche: "Suivre ses comptes par SMS : une alerte quand le solde passe sous un seuil ou qu'une opération importante est débitée, et un mini-relevé en option, " + eu(GALE_MOIS) + " par mois, gratuit avec une convention de compte.",
    public: "Clients majeurs titulaires d'un compte courant de la banque, avec un numéro de mobile à jour dans le dossier.",
    eligibilite: ["Être majeur et titulaire d'un compte courant à GS Banque & Assurance (Équilibre, Jeune ou Offre Clientèle Fragile).", "Un numéro de mobile à jour dans le dossier : les SMS y sont envoyés. Le téléphone doit être allumé et dans une zone couverte par l'opérateur.", "Contrat d'abonnement à signer par le client.", "Gratuit pour le titulaire d'une convention de compte (Avenir, Horizon ou Sérénité) : l'alerte de compte est alors comprise dans la cotisation de la convention, sans abonnement séparé."],
    caracteristiques: ["Alerte de compte : le client fixe un seuil de solde minimum ; dès que le solde passe sous ce seuil, il reçoit un SMS.", "Alerte sur les opérations importantes : un SMS est envoyé pour tout débit égal ou supérieur au montant choisi par le client.", "Mini-relevé de compte (formule complète) : chaque semaine, le solde et les quatre dernières opérations par SMS. Un SMS n'est envoyé que s'il y a eu un mouvement depuis le précédent ; sans mouvement, il part au bout de 7 jours.", "Envoi du mardi au samedi, à l'heure choisie : 8 h, 10 h, 14 h ou 18 h. Les opérations sont reprises sous des libellés abrégés (CB, VIR, PRV, CHQ…).", "Seuils et numéro de mobile modifiables en agence, avec le conseiller ; abonnement sans engagement, résiliable à tout moment."],
    tarifs: [
      { lib: "Alerte de compte", val: eu(GALE_MOIS) + " par mois (" + eu(GALE_MOIS * 12) + " par an), prélevé sur le compte courant" },
      { lib: "Alerte de compte et mini-relevé hebdomadaire", val: eu(PRIMES.GALE.complete) + " par mois (" + eu(PRIMES.GALE.complete * 12) + " par an)" },
      { lib: "Avec une convention de compte (Avenir, Horizon, Sérénité)", val: "Gratuit : l'alerte de compte est comprise dans la cotisation de la convention, qui exonère aussi les frais de tenue de compte" },
      { lib: "SMS reçus", val: "Aucun frais d'envoi : les SMS sont compris dans l'abonnement (le coût de réception dépend de l'opérateur du client)" },
      { lib: "Engagement", val: "Aucun" }
    ],
    avantages: ["Le client est averti tout de suite d'un solde bas ou d'un gros débit, sans avoir à se connecter : il évite un découvert non voulu et repère plus vite une opération qu'il ne reconnaît pas.", "Des seuils choisis par le client et une heure d'envoi qui lui convient.", "Gratuit avec une convention de compte, qui exonère en plus les frais de tenue de compte.", "Un abonnement simple, sans engagement, résiliable à tout moment."],
    risques: ["Le seuil d'alerte n'est ni le découvert autorisé ni le solde du client : le client doit le choisir avec soin, sinon il reçoit trop de SMS ou n'est pas prévenu à temps.", "Les SMS n'arrivent que si le téléphone est allumé, dans une zone couverte, et si le numéro du dossier est à jour : tout changement de numéro se fait en agence.", "Les SMS sont envoyés du mardi au samedi : une opération du dimanche ou du lundi n'est signalée que le mardi.", "Les SMS d'alerte ne remplacent pas la surveillance du compte : seul le relevé de compte fait foi. La banque ne demande jamais de code ni d'identifiant par SMS (hameçonnage)."],
    reglementaire: ["Le service est facultatif : le client peut le résilier à tout moment sans frais.", "Les SMS sont des informations de suivi : ils ne valent pas relevé de compte. Une opération non autorisée se conteste dans les 13 mois suivant le débit, après avoir informé sans tarder la banque.", "Le numéro de mobile du client n'est utilisé que pour l'envoi de ces SMS d'information ; le client dispose d'un droit d'accès et de rectification auprès de son agence.", MENTION_DEPOTS],
    cmp: { cout: eu(GALE_MOIS) + " / mois (gratuit avec une convention)", liquidite: "Sans objet", rendement: "Sans objet", risque: "Sans objet", fisc: "Sans objet", ticket: "Sans objet", plafond: "Sans objet" }
  };

  /* ---------- conventions de compte ---------- */
  /* Début de phrase en minuscule, sauf pour un sigle (« GS Alertes ») */
  function debutMinuscule(l) { return /^[A-ZÀ-Ý]{2}/.test(l) ? l : l.charAt(0).toLowerCase() + l.slice(1); }
  function produitConvention(cv) {
    if (cv.mineur) return produitConventionMineur(cv);
    var f = conventionFiche(cv), carte = TARIFS_UNITAIRES[cv.carte].lib, ageTxt = cv.ageMax >= 120 ? cv.ageMin + " ans et plus" : "entre " + cv.ageMin + " et " + cv.ageMax + " ans";
    var tot = f.avec.CPT, eco = Math.round((tot - f.an) * 100) / 100;
    var noms = cv.services.filter(function (s) { return s[0] !== "tenue"; }).map(function (s) { var t = TARIFS_UNITAIRES[s[0]]; return debutMinuscule(t.lib) + (s[1] > 1 ? " (" + s[1] + " par an)" : ""); });
    return {
      id: cv.id, famille: "compte", nom: cv.nom, code: cv.code, accroche: cv.accroche, public: cv.public,
      eligibilite: ["Avoir " + ageTxt + " à la date de souscription.", cv.id === "CVJ" ? "Titulaire d'un compte courant Équilibre ou du compte Jeune." : "Titulaire d'un compte courant Équilibre.", "Une seule convention de compte par client : elle est remplacée par celle de la tranche d'âge suivante.", "Aucune condition de revenu."],
      caracteristiques: ["Offre groupée de services : plusieurs services bancaires réunis dans une cotisation mensuelle unique, prélevée sur le compte courant.", "Tenue de compte exonérée.", "Services inclus : " + noms.join(", ") + ".", "Résiliable à tout moment, sans frais : le client conserve alors son compte et paie les services à l'unité."],
      tarifs: conventionTarifs(cv, f),
      avantages: ["Frais de tenue de compte exonérés.", "Les mêmes services coûtent " + eu(eco) + " de moins par an qu'à l'unité avec un compte Équilibre (" + eu(tot) + " à l'unité, " + eu(f.an) + " avec la convention).", "Un seul prélèvement mensuel, un tarif stable."],
      risques: ["L'intérêt de la convention dépend de l'usage réel des services : un client qui n'utilise pas la carte ou les alertes peut payer plus qu'à l'unité.", "La convention ne donne pas droit à un découvert : l'autorisation de découvert est étudiée à part.", "Elle ne s'applique que dans sa tranche d'âge : le client doit changer de convention quand il change de tranche."],
      reglementaire: [MURCEF_OFFRE_GROUPEE, "Une offre groupée de services est facultative : le client peut la résilier sans motif.", "Bon réflexe du conseiller : une convention n'a d'intérêt pour le client que si sa cotisation est inférieure au total des mêmes services pris à l'unité ; le panier de services le lui montre.", MENTION_DEPOTS],
      cmp: { cout: eu(cv.mensuel) + " / mois (" + eu(f.an) + " / an)", liquidite: "Sans objet", rendement: "Sans objet", risque: "Sans objet", fisc: "Sans objet", ticket: "Sans objet", plafond: "Une convention par client" },
      convention: { cotisationMois: cv.mensuel, cotisationAn: f.an, services: f.inclus, avec: f.avec, carte: cv.carte, ageMin: cv.ageMin, ageMax: cv.ageMax, comptes: f.comptes }
    };
  }
  /* Convention des mineurs : le représentant légal la souscrit pour un enfant de 12 à 17 ans ; le compte du mineur est sans frais de tenue, la carte est à autorisation systématique, sans chéquier ni découvert. */
  function produitConventionMineur(cv) {
    var f = conventionFiche(cv), tot = f.avec.CPT, eco = Math.round((tot - f.an) * 100) / 100;
    var noms = cv.services.map(function (s) { var t = TARIFS_UNITAIRES[s[0]]; return debutMinuscule(t.lib); });
    var tarifs = conventionTarifs(cv, f);
    tarifs.splice(1, 0, { lib: "Tenue du compte du mineur", val: "Gratuite : rien n'est compté pour la tenue de compte, ni à l'unité ni dans la convention" });
    return {
      id: cv.id, famille: "compte", nom: cv.nom, code: cv.code, accroche: cv.accroche, public: cv.public,
      eligibilite: ["Enfant ayant entre " + cv.ageMin + " et " + cv.ageMax + " ans à la date de souscription (jusqu'à la veille de ses 18 ans).", "Souscrite par son représentant légal (parent ou tuteur) : majeur, client de la banque et titulaire d'un compte de dépôt, qui justifie de l'autorité parentale.", "Une convention par enfant : elle prend fin à la majorité de l'enfant, qui passe alors à la convention GS Avenir (18-25 ans).", "Aucune condition de revenu."],
      caracteristiques: ["Offre groupée de services pour un mineur : le compte du mineur, sa carte, des alertes par SMS (GS Alertes) et l'assurance des moyens de paiement dans une cotisation mensuelle unique, prélevée sur le compte courant du représentant légal.", "Compte du mineur ouvert et géré par le représentant légal, sans frais de tenue de compte ; ni chéquier ni découvert autorisé.", "Carte de paiement à autorisation systématique : chaque paiement et chaque retrait est autorisé en temps réel, et seulement si le solde du compte le permet. Plafonds réduits, que le représentant légal peut modifier sur demande.", "Services inclus : " + noms.join(", ") + ".", "Alertes par SMS sur le solde et les opérations, envoyées au mobile de l'enfant et à celui du représentant légal.", "Résiliable à tout moment, sans frais : le représentant légal paie alors les services à l'unité."],
      tarifs: tarifs,
      avantages: ["Cotisation de " + eu(cv.mensuel) + " par mois pour l'ensemble, tenue de compte du mineur gratuite.", "Les mêmes services coûtent " + eu(eco) + " de moins par an qu'à l'unité (" + eu(tot) + " à l'unité, " + eu(f.an) + " avec la convention).", "Une carte à autorisation systématique : l'enfant ne peut jamais dépenser plus que son solde.", "Le représentant légal garde la main : il fixe les plafonds, reçoit les alertes et suit les opérations."],
      risques: ["Ni découvert ni chéquier : un paiement ou un retrait est refusé si le solde est insuffisant, ce qui peut gêner l'enfant en voyage ou lors d'un achat en ligne.", "L'intérêt de la convention dépend de l'usage réel : si l'enfant n'utilise ni la carte ni les alertes, le représentant légal peut payer moins cher en prenant seulement ce qui sert.", "Le mineur n'est pas autonome sur le plan juridique : toute modification importante du compte (changement de convention, clôture) est faite par le représentant légal.", "À 18 ans, la convention prend fin : le client doit en changer (convention GS Avenir) pour ne pas payer les services à l'unité."],
      reglementaire: ["Un mineur non émancipé ne peut pas signer seul un contrat : le représentant légal souscrit et signe. La banque peut demander l'accord de l'autre parent, ou la preuve de l'autorité parentale exclusive (jugement, acte d'état civil), selon la situation familiale.", MURCEF_OFFRE_GROUPEE, "Une offre groupée de services est facultative : le représentant légal peut la résilier sans motif.", "Bon réflexe du conseiller : une convention n'a d'intérêt pour la famille que si sa cotisation est inférieure au total des mêmes services pris à l'unité ; le panier de services le montre.", "Les dépôts du mineur sont couverts par le fonds de garantie des dépôts et de résolution, dans les limites prévues par la loi (100 000 € par déposant et par établissement).", MENTION_ASSUR],
      cmp: { cout: eu(cv.mensuel) + " / mois (" + eu(f.an) + " / an)", liquidite: "Sans objet", rendement: "Sans objet", risque: "Sans objet", fisc: "Sans objet", ticket: "Sans objet", plafond: "Une convention par enfant" },
      convention: { cotisationMois: cv.mensuel, cotisationAn: f.an, services: f.inclus, avec: f.avec, carte: null, ageMin: cv.ageMin, ageMax: cv.ageMax, comptes: f.comptes, mineur: true }
    };
  }
  function conventionTarifs(cv, f) {
    var t = [{ lib: "Cotisation de la convention", val: eu(cv.mensuel) + " par mois (" + eu(f.an) + " par an), prélevée sur le compte" }];
    /* le prix à l'unité de chaque service est dans le tableau « Services inclus et économie » de la fiche (convention.services) */
    f.comptes.forEach(function (c) {
      var tot = f.avec[c], eco = Math.round((tot - f.an) * 100) / 100, suf = cv.id === "CVJ" ? (c === "JEUNE" ? " (avec le compte Jeune, tenue gratuite)" : " (avec le compte Équilibre)") : "";
      t.push({ lib: "Total des mêmes services à l'unité" + suf, val: eu(tot) + " par an" });
      t.push({ lib: "Économie avec la convention" + suf, val: eu(eco) + " par an (" + Math.round(100 * eco / tot) + " % de moins)" });
    });
    return t;
  }

  /* ---------- cartes haut de gamme ---------- */
  var CARTES_HG = [
    {
      id: "PLAT", famille: "carte", nom: "Carte Visa Platinum", code: "Visa Platinum",
      accroche: "Une carte haut de gamme avec assurances voyage étendues, assistant personnel et plafonds élevés.",
      public: "Clients dont les revenus sont domiciliés à GS Banque & Assurance ou dont l'encours d'épargne est important.",
      eligibilite: ["Être majeur.", "Revenus nets mensuels d'au moins 3 000 € domiciliés à GS Banque & Assurance, ou encours d'épargne d'au moins 50 000 €.", "Compte fonctionnant sans incident."],
      caracteristiques: ["Plafond de paiement : 8 000 € par 30 jours ; retraits : 2 000 € par 7 jours.", "Assurance et assistance voyage étendues : annulation de voyage, bagages, frais médicaux et rapatriement à l'étranger, véhicule de location, garanties achats.", "Assistant personnel pour les réservations et les démarches (la conciergerie 24 h sur 24 est réservée aux cartes du niveau supérieur).", "Débit immédiat ou différé, au choix ; paiement sans contact et mobile ; opposition 24 h sur 24."],
      tarifs: [{ lib: "Cotisation annuelle", val: "205 €" }, { lib: "Retrait distributeur GS Banque & Assurance", val: "Gratuit" }, { lib: "Retrait aux distributeurs d'autres banques (zone euro)", val: "Gratuit" }],
      avantages: ["Plafonds élevés pour les gros achats et les voyages.", "Assurances et assistance voyage plus étendues que la Visa Premier.", "Retraits gratuits dans toute la zone euro."],
      risques: ["Coût élevé (205 € par an contre 138 € pour la Visa Premier) : à justifier par un usage réel des garanties.", "Le client peut déjà bénéficier des mêmes garanties par ailleurs (assurance voyage, banque d'entreprise).", "Perte ou vol : faire opposition sans délai ; la responsabilité du client est limitée dans les conditions prévues par la loi."],
      reglementaire: ["Mêmes règles d'opposition et de contestation que pour toute carte de paiement : le client conteste les opérations frauduleuses dans les 13 mois.", "Les garanties d'assurance sont décrites dans la notice remise au client ; elles ont des plafonds et des exclusions.", "Les seuils de revenus et d'encours sont des conditions commerciales de la banque."],
      cmp: { cout: "205 € / an", liquidite: "Immédiate", rendement: "Aucun", risque: "Sans objet", fisc: "Sans objet", ticket: "Sans objet", plafond: "8 000 € / 30 jours" }
    },
    {
      id: "WELI", famille: "carte", nom: "Carte Mastercard World Elite", code: "World Elite",
      accroche: "La carte la plus haut de gamme de la banque : plafonds très élevés, conciergerie 24 h sur 24 et accès aux salons d'aéroport.",
      public: "Clients à hauts revenus ou à fort patrimoine financier, qui voyagent régulièrement.",
      eligibilite: ["Être majeur.", "Revenus nets mensuels d'au moins 4 500 € domiciliés à GS Banque & Assurance, ou encours d'épargne d'au moins 100 000 €.", "Compte fonctionnant sans incident."],
      caracteristiques: ["Plafond de paiement : 20 000 € par 30 jours ; retraits : 3 000 € par 7 jours.", "Conciergerie 24 h sur 24 (réservations, démarches, recommandations).", "Accès aux salons d'aéroport dans le monde et garantie de retard d'avion.", "Assurance et assistance voyage renforcées : annulation et interruption de voyage, assistance médicale et rapatriement, véhicule de location, hospitalisation, assistance juridique à l'étranger.", "Débit immédiat ou différé, au choix ; paiement sans contact et mobile ; opposition 24 h sur 24."],
      tarifs: [{ lib: "Cotisation annuelle", val: "295 €" }, { lib: "Retrait distributeur GS Banque & Assurance", val: "Gratuit" }, { lib: "Retrait aux distributeurs d'autres banques (zone euro et hors zone euro)", val: "Gratuit" }],
      avantages: ["Plafonds très élevés pour les achats importants et les voyages.", "Conciergerie, salons d'aéroport et assurances renforcées.", "Retraits gratuits dans le monde entier."],
      risques: ["Coût élevé (295 € par an) : réservé aux clients qui utilisent réellement les services.", "Les garanties ont des plafonds et des exclusions : le client doit lire la notice.", "Perte ou vol : faire opposition sans délai ; la responsabilité du client est limitée dans les conditions prévues par la loi."],
      reglementaire: ["Mêmes règles d'opposition et de contestation que pour toute carte de paiement : le client conteste les opérations frauduleuses dans les 13 mois.", "Les garanties d'assurance sont décrites dans la notice remise au client.", "Les seuils de revenus et d'encours sont des conditions commerciales de la banque."],
      cmp: { cout: "295 € / an", liquidite: "Immédiate", rendement: "Aucun", risque: "Sans objet", fisc: "Sans objet", ticket: "Sans objet", plafond: "20 000 € / 30 jours" }
    }
  ];

  /* ---------- compte à terme ---------- */
  var CAT = {
    id: "CAT", famille: "epargne", nom: "Compte à terme GS", code: "Compte à terme",
    accroche: "Un dépôt à taux fixe connu à l'avance, bloqué pendant la durée choisie, de 3 mois à 5 ans.",
    public: "Personnes majeures, résidentes en France, qui peuvent immobiliser une somme pendant une durée précise.",
    eligibilite: ["Être majeur.", "Dépôt initial minimum : 1 000 €.", "Durée choisie à la souscription : 3, 6, 12, 24, 36, 48 ou 60 mois."],
    caracteristiques: ["Taux fixe connu à la souscription et garanti pendant toute la durée (grille de la banque).", "Capital garanti : le dépôt est remboursé à l'échéance avec les intérêts.", "Intérêts versés à l'échéance (chaque année pour les durées de 24 mois et plus).", "À l'échéance, les fonds sont reversés sur le compte courant, sauf instruction contraire du client (nouveau dépôt)."],
    tarifs: [{ lib: "Dépôt minimum", val: "1 000 €" }].concat(Object.keys(CAT_TAUX).map(Number).sort(function (a, b) { return a - b; }).map(function (m) { return { lib: "Taux fixe brut annuel – " + (m < 12 ? m + " mois" : m / 12 + (m === 12 ? " an" : " ans")), val: pct1(CAT_TAUX[m]) }; }))
      .concat([{ lib: "Remboursement anticipé", val: "Possible avec l'accord de la banque : intérêts recalculés à 50 % du taux initial, sans pénalité sur le capital" }, { lib: "Frais de tenue", val: "Aucun" }]),
    avantages: ["Rendement connu à l'avance, quoi qu'il arrive sur les marchés.", "Capital garanti : aucun risque de perte en capital.", "Plusieurs durées au choix pour caler le placement sur un projet."],
    risques: ["Fonds bloqués jusqu'à l'échéance : un retrait anticipé réduit fortement les intérêts.", "Le taux est fixe : si les taux montent, le client ne profite pas de la hausse.", "Intérêts imposables (contrairement au Livret A), au prélèvement forfaitaire unique de 31,4 %."],
    reglementaire: ["Intérêts soumis au " + PFU + ", ou, sur option, au barème de l'impôt sur le revenu.", "Dispense possible de l'acompte de 12,8 % si le revenu fiscal de référence est inférieur à 25 000 € (personne seule) ou 50 000 € (couple) : demande sur l'honneur avant le 30 novembre de l'année précédente.", MENTION_DEPOTS],
    cmp: { cout: "Gratuit", liquidite: "Bloqué jusqu'à l'échéance (remboursement anticipé avec intérêts réduits)", rendement: "Taux fixe de " + pct1(CAT_TAUX[3]) + " (3 mois) à " + pct1(CAT_TAUX[60]) + " (60 mois), brut par an", risque: "Aucun sur le capital", fisc: "Prélèvement forfaitaire unique de 31,4 %", ticket: "1 000 €", plafond: "Aucun" }
  };

  /* ---------- placements et retraite ---------- */
  var FISC_AV = "Prélèvements sociaux de 17,2 % sur les gains (taux maintenu pour l'assurance-vie malgré la hausse de la CSG sur les autres revenus du capital en 2026).";
  var FISC_AV_TRANSMISSION = "Transmission : le capital versé aux bénéficiaires au décès bénéficie, hors succession, d'un abattement de 152 500 € par bénéficiaire pour les primes versées avant 70 ans (article 990 I du Code général des impôts).";
  var PLACEMENTS_NOUVEAUX = [
    {
      id: "AVP", famille: "placement", nom: "GS Vie Premium – assurance-vie haut de gamme", code: "Assurance-vie Premium",
      accroche: "Un contrat d'assurance-vie de banque privée : frais réduits, fonds en euros Premium et unités de compte non cotées.",
      public: "Clients de la banque privée qui placent un capital d'au moins 30 000 € pour le valoriser et le transmettre.",
      eligibilite: ["Être majeur et capable.", "Versement initial minimum : 30 000 €.", "Questionnaire profil investisseur obligatoire avant tout investissement.", "Suivi par un conseiller de clientèle privée."],
      caracteristiques: ["Fonds en euros Premium et unités de compte (actions, obligations, immobilier, actifs non cotés).", "Gestion libre ou mandat de gestion pilotée (profils Sécuritaire, Équilibre ou Dynamique).", "Épargne disponible à tout moment (rachat partiel ou total) ; rachats partiels programmés possibles.", "Conseiller privé dédié ; arbitrages gratuits.", "Clause bénéficiaire pour la transmission du capital au décès."],
      tarifs: [{ lib: "Frais sur versements", val: "1,00 % (négociable)" }, { lib: "Frais de gestion annuels sur le fonds en euros Premium", val: "0,70 %" }, { lib: "Frais de gestion annuels sur les unités de compte", val: "0,80 %" }, { lib: "Arbitrages", val: "Gratuits" }, { lib: "Rendement du fonds en euros Premium du dernier exercice", val: TAUX_NEWSLETTER + " (net de frais de gestion ; les performances passées ne préjugent pas des performances futures)" }],
      avantages: ["Frais réduits par rapport à GS Vie Patrimoine (1,00 % sur versements au lieu de 2,00 % ; gestion de 0,70 % et 0,80 % au lieu de 0,80 % et 0,95 %).", "Accès à des supports réservés à la clientèle privée, dont des unités de compte non cotées.", "Fiscalité allégée après 8 ans : abattement annuel de 4 600 € sur les gains pour une personne seule, 9 200 € pour un couple.", "Transmission : cadre fiscal avantageux pour les bénéficiaires."],
      risques: ["Sur les unités de compte, le capital n'est pas garanti : perte possible, et les actifs non cotés peuvent être peu liquides.", "Versement initial élevé : le client ne doit pas concentrer l'essentiel de son épargne sur un seul contrat.", "Fiscalité des retraits moins favorable avant 8 ans."],
      reglementaire: [FISC_AV, FISC_AV_TRANSMISSION, "Garantie des assureurs en cas de défaillance : 70 000 € par assuré et par assureur, dans les limites prévues par la loi.", "Devoir de conseil et profil investisseur obligatoires : le document d'informations clés (DICI) est remis avant la souscription. Ce n'est pas un placement garanti."],
      cmp: { cout: "Frais sur versements 1,00 %, gestion 0,70 à 0,80 % / an", liquidite: "Rachat possible à tout moment", rendement: "Fonds en euros Premium : " + TAUX_NEWSLETTER.toLowerCase() + " ; UC variable", risque: "", fisc: "Avantageuse après 8 ans", ticket: "30 000 €", plafond: "Aucun" }
    },
    {
      id: "AVE", famille: "placement", nom: "GS Vie Enfant – assurance-vie pour un enfant mineur", code: "Assurance-vie Enfant",
      accroche: "Une épargne à long terme pour un enfant, avec une part d'unités de compte réduite à l'approche de sa majorité.",
      public: "Parents ou représentants légaux d'un enfant mineur, pour financer ses études, son permis ou son premier logement.",
      eligibilite: ["Souscripteur majeur, représentant légal d'un enfant mineur.", "Enfant mineur à la souscription, résident fiscal en France.", "Versement initial minimum : 100 € ; versements programmés possibles dès 30 € par mois.", "Questionnaire profil investisseur obligatoire, rempli par le représentant légal."],
      caracteristiques: ["Contrat au nom de l'enfant, géré par son représentant légal jusqu'à ses 18 ans : à sa majorité, l'enfant prend la main sur son contrat.", "Fonds en euros et unités de compte ; la part d'unités de compte est réduite progressivement à l'approche de la majorité.", "Les rachats sont demandés par le représentant légal, dans l'intérêt de l'enfant (autorisation du juge des tutelles pour certains actes lorsque la loi l'exige).", "Clause bénéficiaire possible."],
      tarifs: [{ lib: "Frais sur versements", val: "1,00 % (négociable)" }, { lib: "Frais de gestion annuels sur le fonds en euros", val: "0,70 %" }, { lib: "Frais de gestion annuels sur les unités de compte", val: "0,85 %" }, { lib: "Versements programmés", val: "À partir de 30 € par mois, sans frais supplémentaires" }, { lib: "Rendement du fonds en euros du dernier exercice", val: TAUX_NEWSLETTER + " (net de frais de gestion ; les performances passées ne préjugent pas des performances futures)" }],
      avantages: ["Une épargne qui grandit avec l'enfant, sur un horizon long.", "Abattement annuel de 4 600 € sur les gains après 8 ans, appliqué au nom de l'enfant.", "Frais réduits sur les versements (1,00 %).", "L'enfant découvre la gestion de son épargne à sa majorité."],
      risques: ["Sur les unités de compte, le capital n'est pas garanti : perte possible.", "Les rachats avant la majorité sont encadrés : l'épargne n'est pas disponible comme sur un livret.", "Fiscalité des retraits moins favorable avant 8 ans."],
      reglementaire: [FISC_AV, "Le contrat est soumis au régime de la minorité : les actes de gestion sont accomplis par le représentant légal, qui doit agir dans l'intérêt de l'enfant.", "Garantie des assureurs en cas de défaillance : 70 000 € par assuré et par assureur, dans les limites prévues par la loi.", "Devoir de conseil et profil investisseur obligatoires : le document d'informations clés (DICI) est remis avant la souscription."],
      cmp: { cout: "Frais sur versements 1,00 %, gestion 0,70 à 0,85 % / an", liquidite: "Rachat par le représentant légal, dans l'intérêt de l'enfant", rendement: "Fonds en euros : " + TAUX_NEWSLETTER.toLowerCase() + " ; UC variable", risque: "", fisc: "Avantageuse après 8 ans", ticket: "100 €", plafond: "Aucun" }
    },
    {
      id: "MGS", famille: "placement", nom: "Mandat de gestion pilotée GS Vie – profil Sécuritaire", code: "Mandat Sécuritaire",
      accroche: "Confier la gestion de son assurance-vie à l'assureur avec une orientation prudente : environ 80 % en fonds en euros, 20 % en unités de compte.",
      public: "Titulaires d'un contrat GS Vie Patrimoine ou Premium qui veulent déléguer la gestion en gardant une forte part de sécurité.",
      eligibilite: ["Détenir un contrat d'assurance-vie GS Vie Patrimoine ou GS Vie Premium (à souscrire avant le mandat).", "Être majeur et capable.", "Versement minimum sur le mandat : 5 000 €.", "Questionnaire profil investisseur obligatoire : le profil du client doit correspondre à l'orientation choisie."],
      caracteristiques: ["Gestion déléguée : l'assureur répartit le capital et sélectionne les unités de compte selon l'orientation retenue ; des gestionnaires financiers mandatés par l'assureur réalisent les arbitrages.", "Composition cible : environ 80 % de fonds en euros et 20 % d'unités de compte (obligations et actions).", "Le client peut changer d'orientation ou reprendre la gestion libre à tout moment, sans frais.", "Les frais et la fiscalité sont ceux du contrat d'assurance-vie, auxquels s'ajoutent les frais du mandat."],
      tarifs: [{ lib: "Frais du mandat", val: "0,40 % par an de l'épargne gérée" }, { lib: "Frais sur versements", val: "Ceux du contrat : 2,00 % (GS Vie Patrimoine) ou 1,00 % (GS Vie Premium)" }, { lib: "Frais de gestion du contrat", val: "Ceux du contrat : 0,80 % sur le fonds en euros, 0,95 % sur les unités de compte (GS Vie Patrimoine)" }, { lib: "Arbitrages réalisés par le gestionnaire", val: "Gratuits" }],
      avantages: ["Le client n'a pas à choisir les supports ni à suivre les marchés.", "Forte part de sécurité : la majorité de l'épargne reste sur le fonds en euros.", "Réversible : le client peut reprendre la gestion libre à tout moment."],
      risques: ["Les unités de compte (environ 20 %) ne sont pas garanties : une perte est possible.", "Les frais du mandat s'ajoutent à ceux du contrat.", "Le gestionnaire peut s'écarter de la composition cible selon les marchés."],
      reglementaire: ["Le mandat est une option de gestion du contrat d'assurance-vie : même fiscalité que le contrat.", "Devoir de conseil et profil investisseur obligatoires ; le document d'informations clés (DICI) est remis avant la souscription.", MENTION_MIFID],
      cmp: { cout: "Contrat + mandat 0,40 % / an", liquidite: "Rachat possible à tout moment", rendement: "Variable, non garanti", risque: "", fisc: "Celle de l'assurance-vie", ticket: "5 000 €", plafond: "Aucun" }
    },
    {
      id: "MGE", famille: "placement", nom: "Mandat de gestion pilotée GS Vie – profil Équilibre", code: "Mandat Équilibre",
      accroche: "Confier la gestion de son assurance-vie à l'assureur avec une orientation équilibrée : environ 50 % en fonds en euros, 50 % en unités de compte.",
      public: "Titulaires d'un contrat GS Vie Patrimoine ou Premium qui veulent déléguer la gestion et accepter une part de risque.",
      eligibilite: ["Détenir un contrat d'assurance-vie GS Vie Patrimoine ou GS Vie Premium (à souscrire avant le mandat).", "Être majeur et capable.", "Versement minimum sur le mandat : 5 000 €.", "Questionnaire profil investisseur obligatoire : le profil du client doit correspondre à l'orientation choisie."],
      caracteristiques: ["Gestion déléguée : l'assureur répartit le capital et sélectionne les unités de compte selon l'orientation retenue ; des gestionnaires financiers mandatés par l'assureur réalisent les arbitrages.", "Composition cible : environ 50 % de fonds en euros et 50 % d'unités de compte (obligations, actions, dont au moins 5 % d'actifs non cotés).", "Le client peut changer d'orientation ou reprendre la gestion libre à tout moment, sans frais.", "Les frais et la fiscalité sont ceux du contrat d'assurance-vie, auxquels s'ajoutent les frais du mandat."],
      tarifs: [{ lib: "Frais du mandat", val: "0,50 % par an de l'épargne gérée" }, { lib: "Frais sur versements", val: "Ceux du contrat : 2,00 % (GS Vie Patrimoine) ou 1,00 % (GS Vie Premium)" }, { lib: "Frais de gestion du contrat", val: "Ceux du contrat : 0,80 % sur le fonds en euros, 0,95 % sur les unités de compte (GS Vie Patrimoine)" }, { lib: "Arbitrages réalisés par le gestionnaire", val: "Gratuits" }],
      avantages: ["Le client n'a pas à choisir les supports ni à suivre les marchés.", "Équilibre entre sécurité (fonds en euros) et performance potentielle (unités de compte).", "Réversible : le client peut reprendre la gestion libre à tout moment."],
      risques: ["Les unités de compte (environ 50 %) ne sont pas garanties : une perte importante est possible.", "Les actifs non cotés peuvent être peu liquides.", "Les frais du mandat s'ajoutent à ceux du contrat."],
      reglementaire: ["Le mandat est une option de gestion du contrat d'assurance-vie : même fiscalité que le contrat.", "Devoir de conseil et profil investisseur obligatoires ; le document d'informations clés (DICI) est remis avant la souscription.", MENTION_MIFID],
      cmp: { cout: "Contrat + mandat 0,50 % / an", liquidite: "Rachat possible à tout moment", rendement: "Variable, non garanti", risque: "", fisc: "Celle de l'assurance-vie", ticket: "5 000 €", plafond: "Aucun" }
    },
    {
      id: "MGD", famille: "placement", nom: "Mandat de gestion pilotée GS Vie – profil Dynamique", code: "Mandat Dynamique",
      accroche: "Confier la gestion de son assurance-vie à l'assureur avec une orientation dynamique : environ 20 % en fonds en euros, 80 % en unités de compte.",
      public: "Titulaires d'un contrat GS Vie Patrimoine ou Premium qui veulent déléguer la gestion et visent la performance à long terme.",
      eligibilite: ["Détenir un contrat d'assurance-vie GS Vie Patrimoine ou GS Vie Premium (à souscrire avant le mandat).", "Être majeur et capable.", "Versement minimum sur le mandat : 5 000 €.", "Questionnaire profil investisseur obligatoire : le profil du client doit correspondre à l'orientation choisie."],
      caracteristiques: ["Gestion déléguée : l'assureur répartit le capital et sélectionne les unités de compte selon l'orientation retenue ; des gestionnaires financiers mandatés par l'assureur réalisent les arbitrages.", "Composition cible : environ 20 % de fonds en euros et 80 % d'unités de compte (surtout des actions, dont au moins 8 % d'actifs non cotés).", "Le client peut changer d'orientation ou reprendre la gestion libre à tout moment, sans frais.", "Les frais et la fiscalité sont ceux du contrat d'assurance-vie, auxquels s'ajoutent les frais du mandat."],
      tarifs: [{ lib: "Frais du mandat", val: "0,60 % par an de l'épargne gérée" }, { lib: "Frais sur versements", val: "Ceux du contrat : 2,00 % (GS Vie Patrimoine) ou 1,00 % (GS Vie Premium)" }, { lib: "Frais de gestion du contrat", val: "Ceux du contrat : 0,80 % sur le fonds en euros, 0,95 % sur les unités de compte (GS Vie Patrimoine)" }, { lib: "Arbitrages réalisés par le gestionnaire", val: "Gratuits" }],
      avantages: ["Le client n'a pas à choisir les supports ni à suivre les marchés.", "Potentiel de performance à long terme grâce à la forte part d'actions.", "Réversible : le client peut reprendre la gestion libre à tout moment."],
      risques: ["Les unités de compte (environ 80 %) ne sont pas garanties : la valeur peut varier fortement et le client peut perdre une partie du capital.", "Les actifs non cotés peuvent être peu liquides.", "Les frais du mandat s'ajoutent à ceux du contrat."],
      reglementaire: ["Le mandat est une option de gestion du contrat d'assurance-vie : même fiscalité que le contrat.", "Devoir de conseil et profil investisseur obligatoires ; le document d'informations clés (DICI) est remis avant la souscription.", MENTION_MIFID],
      cmp: { cout: "Contrat + mandat 0,60 % / an", liquidite: "Rachat possible à tout moment", rendement: "Variable, non garanti", risque: "", fisc: "Celle de l'assurance-vie", ticket: "5 000 €", plafond: "Aucun" }
    },
    {
      id: "PEAJ", famille: "placement", nom: "GS PEA Jeunes", code: "PEA Jeunes",
      accroche: "Le PEA des jeunes rattachés au foyer fiscal de leurs parents, pour se familiariser avec les marchés financiers.",
      public: "Majeurs de moins de 21 ans, ou de moins de 25 ans s'ils sont étudiants, rattachés au foyer fiscal de leurs parents.",
      eligibilite: ["Être majeur et avoir moins de 21 ans (moins de 25 ans pour un étudiant).", "Être rattaché au foyer fiscal de ses parents.", "Un seul PEA par personne : ne pas déjà détenir un PEA.", "Versement initial minimum : 300 €.", "Questionnaire de connaissance et d'expérience obligatoire."],
      caracteristiques: ["Plafond de versements : 20 000 € (la valeur du plan peut le dépasser grâce aux gains).", "Investissement en actions de sociétés de l'Union européenne ou de l'Espace économique européen, directement ou par des fonds.", "Compte espèces associé obligatoire.", "Le PEA Jeunes devient automatiquement un PEA classique (plafond de versements de 150 000 €) quand le titulaire n'est plus rattaché au foyer fiscal de ses parents."],
      tarifs: [{ lib: "Droits de garde", val: "0,15 % par an du portefeuille (tarif jeune)" }, { lib: "Frais de courtage", val: "0,60 % par ordre, minimum 2,50 €" }],
      avantages: ["Une première expérience des marchés financiers avec un plafond de versements adapté.", "Après 5 ans : gains exonérés d'impôt sur le revenu (restent soumis aux prélèvements sociaux, 18,6 % en 2026).", "Droits de garde réduits."],
      risques: ["Le capital n'est pas garanti : les actions peuvent perdre de la valeur.", "Retrait avant 5 ans : clôture du plan, avec fiscalité des gains.", "Le PEA n'est pas une première épargne : il suppose d'avoir d'abord une épargne de précaution."],
      reglementaire: ["Plafond de versements : 20 000 € ; au-delà du rattachement, le plan devient un PEA classique.", "Gains exonérés d'impôt sur le revenu après 5 ans, hors prélèvements sociaux (18,6 % en 2026).", "Un seul PEA par personne ; investir en actions comporte un risque de perte en capital.", MENTION_DICI],
      cmp: { cout: "Garde 0,15 % / an, courtage 0,60 %", liquidite: "Possible, mais fiscalité pénalisante avant 5 ans", rendement: "Variable, non garanti", risque: "", fisc: "Exonération d'impôt sur le revenu après 5 ans", ticket: "300 €", plafond: "20 000 €" }
    },
    {
      id: "PEAPME", famille: "placement", nom: "GS PEA-PME-ETI", code: "PEA-PME-ETI",
      accroche: "Un plan d'épargne pour investir dans les petites et moyennes entreprises européennes, avec la fiscalité du PEA.",
      public: "Personnes majeures, domiciliées fiscalement en France, qui acceptent un risque plus élevé que sur les grandes valeurs.",
      eligibilite: ["Être majeur, domicilié fiscalement en France.", "Un seul PEA-PME-ETI par personne (il peut être détenu en plus d'un PEA classique).", "Versement initial minimum : 500 €.", "Questionnaire de connaissance et d'expérience obligatoire."],
      caracteristiques: ["Plafond de versements : 225 000 € (le total des versements PEA et PEA-PME-ETI est limité à 225 000 €).", "Investissement en actions de PME et d'ETI de l'Union européenne ou de l'Espace économique européen : moins de 5 000 salariés et moins de 1,5 milliard d'euros de chiffre d'affaires ou 2 milliards d'euros de total de bilan.", "Compte espèces associé obligatoire."],
      tarifs: [{ lib: "Droits de garde", val: "0,35 % par an du portefeuille" }, { lib: "Frais de courtage", val: "0,70 % par ordre, minimum 3,50 €" }],
      avantages: ["Après 5 ans : gains exonérés d'impôt sur le revenu (restent soumis aux prélèvements sociaux, 18,6 % en 2026).", "Permet de financer des entreprises de taille moyenne et de diversifier un PEA classique.", "Plafond de versements plus élevé en cumul."],
      risques: ["Le capital n'est pas garanti : les petites et moyennes valeurs sont plus volatiles et parfois moins faciles à revendre.", "Retrait avant 5 ans : clôture du plan, avec fiscalité des gains.", "Concentration sur des entreprises de taille modeste."],
      reglementaire: ["Plafond de versements : 225 000 € tous PEA confondus.", "Gains exonérés d'impôt sur le revenu après 5 ans, hors prélèvements sociaux (18,6 % en 2026).", "Titres éligibles : PME et ETI européennes ; investir en actions comporte un risque de perte en capital.", MENTION_DICI],
      cmp: { cout: "Garde 0,35 % / an, courtage 0,70 %", liquidite: "Possible, mais fiscalité pénalisante avant 5 ans", rendement: "Variable, non garanti", risque: "", fisc: "Exonération d'impôt sur le revenu après 5 ans", ticket: "500 €", plafond: "225 000 € (PEA et PEA-PME-ETI cumulés)" }
    },
    {
      id: "CTO", famille: "placement", nom: "GS Compte-Titres", code: "Compte-titres",
      accroche: "Un compte pour investir en actions, obligations et fonds, sans plafond ni condition de durée.",
      public: "Personnes majeures qui veulent investir en bourse sans les contraintes du PEA, ou au-delà de son plafond.",
      eligibilite: ["Être majeur.", "Compte courant à GS Banque & Assurance (compte espèces associé).", "Versement initial minimum : 300 €.", "Questionnaire de connaissance et d'expérience obligatoire."],
      caracteristiques: ["Actions, obligations et fonds (OPCVM, ETF) français, européens ou internationaux.", "Aucun plafond de versements, aucune condition de durée : titres disponibles à tout moment.", "Compte espèces associé obligatoire ; compte individuel, joint ou en indivision.", "Plan d'épargne automatique AUTOMATIZ possible pour investir régulièrement."],
      tarifs: [{ lib: "Droits de garde", val: "0,40 % par an du portefeuille, minimum 12 €" }, { lib: "Frais de courtage", val: "0,60 % par ordre, minimum 8 €" }, { lib: "Tenue du compte-titres", val: "Gratuite" }],
      avantages: ["Liberté totale : tous les titres, aucun plafond, aucune durée minimale.", "Les moins-values sont imputables sur les plus-values des 10 années suivantes.", "Convient pour investir au-delà du plafond du PEA ou hors Europe."],
      risques: ["Le capital n'est pas garanti : une perte, même totale sur un titre, est possible.", "Fiscalité moins favorable que celle du PEA et de l'assurance-vie : prélèvement forfaitaire unique de 31,4 %.", "Frais de courtage et droits de garde à comparer avec le rendement attendu."],
      reglementaire: ["Dividendes et plus-values imposés au " + PFU + ", ou, sur option globale, au barème de l'impôt sur le revenu (abattement de 40 % sur les dividendes).", MENTION_TITRES, "Devoir de conseil et profil investisseur obligatoires pour les produits conseillés ; le document d'informations clés (DICI) est remis avant la souscription."],
      cmp: { cout: "Garde 0,40 % / an, courtage 0,60 %", liquidite: "Titres disponibles à tout moment", rendement: "Variable, non garanti", risque: "", fisc: "Prélèvement forfaitaire unique de 31,4 %", ticket: "300 €", plafond: "Aucun" }
    },
    {
      id: "PSOC", famille: "placement", nom: "Parts sociales GS Banque & Assurance", code: "Parts sociales",
      accroche: "Devenir sociétaire de la banque : une part de son capital, une voix à l'assemblée générale et un intérêt annuel.",
      public: "Clients de la banque, titulaires d'un compte-titres ordinaire ou d'un PEA, qui veulent s'associer à son capital.",
      eligibilite: ["Être majeur.", "Détenir un compte-titres ordinaire, un PEA ou un PEA Jeunes, où les parts s'inscrivent (à ouvrir avant la souscription).", "Souscription minimum : une part ; maximum : 50 000 € par personne physique.", "Questionnaire de connaissance et d'expérience obligatoire."],
      caracteristiques: ["Valeur de la part au 1er juin 2026 : 11,40 €.", "Le client devient sociétaire : il vote à l'assemblée générale et participe à la désignation du conseil d'administration (une voix par sociétaire, quel que soit le nombre de parts).", "Intérêt annuel voté par l'assemblée générale dans la limite d'un plafond légal ; il n'est pas garanti.", "Parts non cotées : le remboursement se fait à la valeur nominale, après agrément du conseil d'administration."],
      tarifs: [{ lib: "Valeur d'une part au 1er juin 2026", val: "11,40 €" }, { lib: "Frais de souscription, de remboursement et droits de garde", val: "Aucun" }, { lib: "Rémunération annuelle", val: TAUX_NEWSLETTER + " (intérêt voté par l'assemblée générale, plafonné par la loi)" }, { lib: "Plafond de souscription par personne physique", val: "50 000 €" }],
      avantages: ["Le client est associé à la vie de sa banque coopérative.", "Valeur nominale stable et intérêt annuel, sans frais.", "Parts inscrites sur le compte-titres ou le PEA du client."],
      risques: ["Le capital n'est pas garanti : les parts supportent les pertes de la banque, et la perte peut être totale.", "Aucune liquidité garantie : la cession nécessite l'agrément du conseil d'administration et peut prendre plusieurs mois.", "L'intérêt n'est pas garanti : il peut être réduit, différé ou supprimé.", "La banque est à la fois émettrice et distributrice des parts (conflit d'intérêts potentiel)."],
      reglementaire: ["Les parts sociales ne sont couvertes par aucun fonds de garantie des titres ni des dépôts.", "Sur un compte-titres ordinaire, l'intérêt est imposé comme un dividende (prélèvement forfaitaire unique de 31,4 %) ; sur un PEA, les gains sont exonérés d'impôt sur le revenu après 5 ans.", "Cessions possibles avant 3 mois dans des cas dérogatoires : décès, invalidité, divorce, licenciement, fin de droits au chômage, surendettement, rupture de la relation bancaire.", MENTION_DICI],
      cmp: { cout: "Aucun frais", liquidite: "Non garantie : agrément du conseil d'administration", rendement: TAUX_NEWSLETTER, risque: "", fisc: "Dividende : PFU 31,4 % (CTO) ; exonération d'IR après 5 ans (PEA)", ticket: "1 part (11,40 €)", plafond: "50 000 € par personne" }
    },
    {
      id: "AUTZ", famille: "placement", nom: "AUTOMATIZ – plan d'épargne automatique", code: "AUTOMATIZ",
      accroche: "Investir un petit montant chaque mois ou chaque trimestre dans un fonds, sans y penser, avec des versements modifiables à tout moment.",
      public: "Personnes majeures titulaires d'un compte-titres ordinaire ou d'un PEA, qui veulent investir régulièrement.",
      eligibilite: ["Être majeur.", "Détenir un compte-titres ordinaire, un PEA, un PEA Jeunes ou un PEA-PME-ETI à GS Banque & Assurance (à ouvrir avant la souscription).", "Versement programmé minimum : 30 € par mois ou 90 € par trimestre.", "Questionnaire de connaissance et d'expérience obligatoire."],
      caracteristiques: ["Versements programmés prélevés sur le compte courant, chaque mois ou chaque trimestre, et investis dans le fonds (FCP ou SICAV) choisi parmi la sélection de la banque.", "Montant, périodicité et fonds modifiables ; versements suspendus ou arrêtés à tout moment, sans frais.", "Cinq fonds au choix, de l'indicateur de risque 1 (monétaire) à 5 (actions de pays émergents et petites capitalisations).", "Investissement progressif : le prix d'achat est lissé dans le temps."],
      tarifs: [{ lib: "Droits d'entrée sur les versements programmés", val: "Aucun" }, { lib: "Frais de gestion annuels du fonds", val: "1,00 % en moyenne (voir le document d'informations clés du fonds)" }, { lib: "Mise en place, modification, suspension et arrêt du plan", val: "Gratuits" }, { lib: "Droits de garde", val: "Ceux du compte-titres ordinaire ou du PEA" }],
      avantages: ["Une épargne régulière sans y penser, dès 30 € par mois.", "Le prix d'achat est lissé : le client évite de mal choisir le moment d'investir.", "Souple : montant, fonds et périodicité modifiables sans frais."],
      risques: ["Le capital n'est pas garanti : le fonds peut perdre de la valeur, même avec des versements réguliers.", "Lisser les achats ne garantit pas un gain : sur un marché qui baisse longtemps, la perte reste possible.", "Les frais de gestion du fonds sont prélevés chaque année."],
      reglementaire: ["Les fonds sont soumis à la fiscalité de l'enveloppe qui les porte : compte-titres ordinaire (PFU de 31,4 %) ou PEA (exonération d'impôt sur le revenu après 5 ans).", MENTION_TITRES, "Devoir de conseil et profil investisseur obligatoires ; le document d'informations clés (DICI) est remis avant la souscription."],
      cmp: { cout: "Aucun droit d'entrée, gestion du fonds 1,00 % / an", liquidite: "Fonds disponibles à tout moment ; plan arrêtable sans frais", rendement: "Variable, non garanti", risque: "", fisc: "Celle du compte-titres ou du PEA", ticket: "30 € par mois", plafond: "Aucun" }
    }
  ];

  /* ---------- assurances de personnes, de biens et de protection juridique (tarifs de la banque, imaginaires, calculés par cotisation() quand une grille existe) ---------- */
  var ASSURANCES_NOUVELLES = [
    {
      id: "DEP", famille: "assurance", nom: "GS Autonomie – assurance dépendance", code: "Dépendance",
      accroche: "Une rente mensuelle pour financer l'aide à domicile ou l'hébergement en cas de perte d'autonomie.",
      public: "Personnes de 50 à 75 ans qui veulent protéger leurs proches et leur patrimoine des coûts de la dépendance.",
      eligibilite: ["Avoir entre 50 et 75 ans à la souscription.", "Questionnaire de santé à remplir avec le client (une fausse déclaration entraîne la nullité du contrat).", "Rente mensuelle choisie de 500 € à 3 000 €.", "Délais de carence et franchise à expliquer avant la signature."],
      caracteristiques: ["Rente mensuelle versée à vie dès que l'assuré est reconnu dépendant : GIR 1 ou 2 (dépendance totale) = 100 % de la rente ; GIR 3 ou 4 (dépendance partielle) = 50 % de la rente. Le niveau de dépendance est évalué par la grille nationale AGGIR.", "Délai de carence : aucun en cas d'accident ; 1 an en cas de maladie ; 3 ans en cas de maladie neurodégénérative (maladie d'Alzheimer, par exemple).", "Franchise de 90 jours : la rente est due à compter du 91e jour de dépendance.", "Exonération des cotisations pendant le service de la rente.", "Services d'assistance : aide à domicile, aide aux aidants, conseil pour le choix d'un établissement."],
      tarifs: [
        { lib: "Rente mensuelle choisie", val: "De " + eu0(500) + " à " + eu0(3000) },
        { lib: "Cotisation mensuelle pour une rente de 1 000 €", val: "À 50 ans : " + eu(cotisation("DEP", 50, 1000)) + " ; à 60 ans : " + eu(cotisation("DEP", 60, 1000)) + " ; à 70 ans : " + eu(cotisation("DEP", 70, 1000)) },
        { lib: "Cotisation mensuelle minimale (à partir de)", val: eu(cotisation("DEP", 50, 500)) + " (rente de 500 €, assuré de 50 ans)" },
        { lib: "Frais de dossier", val: "Aucun" }
      ],
      avantages: ["Une rente qui s'ajoute aux pensions pour payer l'aide à domicile ou l'EHPAD.", "Protège les enfants de la charge financière de la dépendance d'un parent.", "Rente exonérée d'impôt sur le revenu."],
      risques: ["Contrat « à fonds perdu » : les cotisations versées ne sont pas remboursées si l'assuré ne devient jamais dépendant.", "Les cotisations peuvent être revalorisées par l'assureur (selon le contrat) et ne sont pas déductibles du revenu.", "Délais de carence et franchise : aucune rente avant leur terme.", "Exclusions à lire avec le client ; la rente n'est pas versée pour un état antérieur déclaré à tort."],
      reglementaire: ["Rente dépendance d'un contrat individuel : exonérée d'impôt sur le revenu et de prélèvements sociaux ; cotisations non déductibles.", "L'état de dépendance est apprécié selon la grille AGGIR ; le médecin-conseil de l'assureur peut demander des justificatifs.", "Faculté de renonciation de 30 jours calendaires révolus à compter de la conclusion du contrat.", MENTION_ASSUR],
      cmp: { cout: "À partir de " + eu(cotisation("DEP", 50, 500)) + " / mois (50 ans, rente de 500 €)", liquidite: "Sans objet", rendement: "Sans objet", risque: "Sans objet", fisc: "Rente exonérée d'impôt sur le revenu", ticket: "Sans objet", plafond: "Rente de 500 à 3 000 € par mois" }
    },
    {
      id: "DECES", famille: "assurance", nom: "GS Décès – assurance décès temporaire", code: "Assurance décès",
      accroche: "Un capital versé aux proches en cas de décès, pour les protéger financièrement.",
      public: "Actifs de 18 à 65 ans avec des proches à charge, un crédit en cours ou un projet à sécuriser.",
      eligibilite: ["Avoir entre 18 et 65 ans à la souscription.", "Questionnaire de santé à remplir avec le client.", "Capital choisi de 30 000 € à 500 000 €.", "Désignation d'un ou plusieurs bénéficiaires (clause bénéficiaire)."],
      caracteristiques: ["Contrat temporaire annuel renouvelable jusqu'aux 70 ans de l'assuré : le capital est versé aux bénéficiaires désignés en cas de décès, quelle qu'en soit la cause (sauf exclusions).", "Seul le décès est garanti. Pour couvrir aussi l'invalidité, voir GS Prévoyance.", "La cotisation est fixée à la souscription selon l'âge de l'assuré et le capital choisi, puis ajustée à chaque changement de tranche d'âge.", "Le client peut modifier le capital ou résilier à chaque échéance annuelle."],
      tarifs: [
        { lib: "Capital garanti", val: "De " + eu0(30000) + " à " + eu0(500000) },
        { lib: "Cotisation mensuelle pour un capital de 100 000 €", val: "À 30 ans : " + eu(cotisation("DECES", 30, 100000)) + " ; à 40 ans : " + eu(cotisation("DECES", 40, 100000)) + " ; à 50 ans : " + eu(cotisation("DECES", 50, 100000)) + " ; à 60 ans : " + eu(cotisation("DECES", 60, 100000)) },
        { lib: "Cotisation mensuelle minimale (à partir de)", val: eu(cotisation("DECES", 18, 30000)) + " (capital de 30 000 €, assuré de 18 à 24 ans)" },
        { lib: "Frais de gestion inclus dans la cotisation", val: eu(FRAIS_DECES) + " par mois" }
      ],
      avantages: ["Un capital connu à l'avance pour la famille, versé hors succession.", "Cotisation modérée pour un capital élevé : c'est une assurance « pure », sans épargne.", "Abattement fiscal de 152 500 € par bénéficiaire sur les capitaux transmis."],
      risques: ["Contrat « à fonds perdu » : les cotisations ne sont pas restituées si l'assuré survit.", "Exclusions : suicide la première année, fait intentionnel du bénéficiaire, guerre dans certaines conditions.", "Une fausse déclaration sur le questionnaire de santé entraîne la nullité du contrat.", "Pas de garantie invalidité : ne pas confondre avec GS Prévoyance."],
      reglementaire: ["Capital versé hors succession aux bénéficiaires : abattement de 152 500 € par bénéficiaire pour les primes versées avant 70 ans (article 990 I du Code général des impôts) ; au-delà, prélèvement de 20 % jusqu'à 700 000 € puis de 31,25 %.", "Faculté de renonciation de 30 jours calendaires révolus à compter de la conclusion du contrat.", "Vérifier avec le client qu'il ne détient pas déjà une garantie décès (GS Prévoyance, assurance emprunteur, prévoyance de l'employeur) avant d'ajouter ce contrat.", MENTION_ASSUR],
      cmp: { cout: "À partir de " + eu(cotisation("DECES", 18, 30000)) + " / mois (capital de 30 000 €)", liquidite: "Sans objet", rendement: "Sans objet", risque: "Sans objet", fisc: "Capital transmis : abattement de 152 500 € par bénéficiaire", ticket: "Sans objet", plafond: "Capital de 30 000 à 500 000 €" }
    },
    {
      id: "OBSQ", famille: "assurance", nom: "GS Obsèques – garantie obsèques", code: "Garantie obsèques",
      accroche: "Financer ses obsèques à l'avance, pour ses proches : un capital versé le moment venu, sans avance de frais.",
      public: "Personnes de 40 à 80 ans qui veulent organiser et financer leurs obsèques pour soulager leurs proches.",
      eligibilite: ["Avoir entre 40 et 80 ans à la souscription.", "Capital choisi de 3 000 € à 15 000 €.", "Désignation du bénéficiaire (un proche ou une entreprise de pompes funèbres).", "Questionnaire de santé simplifié ; délai de carence en cas de décès par maladie."],
      caracteristiques: ["Capital destiné à financer les obsèques, versé au bénéficiaire désigné (un proche ou l'entreprise de pompes funèbres choisie par le client).", "Deux modes de paiement : cotisation mensuelle viagère ou versement unique à la souscription.", "Le client peut consigner ses volontés (inhumation ou crémation, cérémonie, musique) pour guider ses proches.", "Délai de carence de 12 mois en cas de décès par maladie ; aucun en cas de décès accidentel."],
      tarifs: [
        { lib: "Capital choisi", val: "De " + eu0(3000) + " à " + eu0(15000) },
        { lib: "Cotisation mensuelle viagère pour un capital de 5 000 €", val: "À 50 ans : " + eu(cotisation("OBSQ", 50, 5000, "mensuel")) + " ; à 60 ans : " + eu(cotisation("OBSQ", 60, 5000, "mensuel")) + " ; à 70 ans : " + eu(cotisation("OBSQ", 70, 5000, "mensuel")) },
        { lib: "Versement unique pour un capital de 5 000 €", val: "À 60 ans : " + eu0(cotisation("OBSQ", 60, 5000, "unique")) + " ; à 70 ans : " + eu0(cotisation("OBSQ", 70, 5000, "unique")) },
        { lib: "Frais de dossier", val: "Aucun" }
      ],
      avantages: ["Les proches n'ont pas à avancer le coût des obsèques.", "Le client choisit à l'avance le type de cérémonie et son budget.", "Le capital est garanti : il ne dépend pas de l'évolution des prix des obsèques à la date du décès (revalorisation annuelle du capital selon les conditions du contrat)."],
      risques: ["Les cotisations versées ne sont pas restituées sauf rachat prévu au contrat : un rachat anticipé peut être inférieur aux sommes versées.", "En cas de décès par maladie avant la fin du délai de carence, seules les cotisations versées sont remboursées.", "Cotisations viagères : elles continuent d'être versées jusqu'au décès, sauf option de durée limitée.", "Le capital peut être insuffisant si le coût des obsèques augmente plus vite que sa revalorisation."],
      reglementaire: ["Contrat d'assurance en cas de décès destiné à financer les obsèques ; le capital est versé au bénéficiaire désigné ou à l'entreprise de pompes funèbres.", "Faculté de renonciation de 30 jours calendaires révolus à compter de la conclusion du contrat.", "Les cotisations ne sont pas déductibles du revenu imposable.", MENTION_ASSUR],
      cmp: { cout: "À partir de " + eu(cotisation("OBSQ", 40, 3000, "mensuel")) + " / mois (40 ans, capital de 3 000 €)", liquidite: "Selon les conditions de rachat du contrat", rendement: "Sans objet", risque: "Sans objet", fisc: "Cotisations non déductibles", ticket: "Sans objet", plafond: "Capital de 3 000 à 15 000 €" }
    },
    {
      id: "MOTO", famille: "assurance", nom: "GS Moto – assurance deux-roues motorisés", code: "Assurance 2 roues",
      accroche: "L'assurance obligatoire de la moto, du scooter ou du cyclomoteur, avec l'équipement du conducteur.",
      public: "Propriétaires d'un deux-roues à moteur : cyclomoteur (50 cm³ et moins), scooter ou moto.",
      eligibilite: ["Carte grise (certificat d'immatriculation) du deux-roues.", "Permis ou brevet adapté à la cylindrée : AM (BSR) pour un cyclomoteur, A1 ou A2 ou A selon la puissance.", "Relevé d'information de l'assureur précédent (bonus-malus).", "Pour la garantie vol : antivol homologué (marque NF ou certifié SRA)."],
      caracteristiques: ["Trois formules : au tiers (responsabilité civile obligatoire, défense et recours), intermédiaire (tiers + vol, incendie, bris de glace) et tous risques (tiers + dommages tous accidents).", "Garantie du conducteur, incluse dans toutes les formules.", "Équipement du motard (casque, gants, blouson) en option, jusqu'à 1 000 €.", "Assistance 24 h sur 24 incluse, y compris à 0 km.", "Coefficient de réduction-majoration (bonus-malus) selon l'historique du conducteur."],
      tarifs: [
        { lib: "Cyclomoteur (50 cm³ et moins) – au tiers / intermédiaire / tous risques (à partir de)", val: prix(PRIMES.MOTO.cyclo.tiers) + " / " + prix(PRIMES.MOTO.cyclo.inter) + " / " + prix(PRIMES.MOTO.cyclo.tous) + " par mois" },
        { lib: "Scooter ou moto de 51 à 125 cm³ – au tiers / intermédiaire / tous risques (à partir de)", val: prix(PRIMES.MOTO.c125.tiers) + " / " + prix(PRIMES.MOTO.c125.inter) + " / " + prix(PRIMES.MOTO.c125.tous) + " par mois" },
        { lib: "Moto de plus de 125 cm³ – au tiers / intermédiaire / tous risques (à partir de)", val: prix(PRIMES.MOTO.plus.tiers) + " / " + prix(PRIMES.MOTO.plus.inter) + " / " + prix(PRIMES.MOTO.plus.tous) + " par mois" },
        { lib: "Franchise sur les dommages et le vol", val: "150 € (jeune conducteur : 300 €)" }
      ],
      avantages: ["Un seul interlocuteur pour la banque et l'assurance.", "L'équipement du motard peut être garanti.", "Assistance 0 km : dépannage même devant chez soi."],
      risques: ["Garantie vol refusée si l'antivol homologué n'est pas utilisé.", "Primes plus élevées pour les jeunes conducteurs et les motos puissantes.", "Franchises et exclusions : à expliquer au client.", "Une fausse déclaration peut entraîner la nullité du contrat."],
      reglementaire: ["L'assurance de responsabilité civile est obligatoire pour tout véhicule terrestre à moteur, y compris les deux-roues (article L. 211-1 du Code des assurances).", "Conduire sans assurance expose à une amende, à la saisie du véhicule et au paiement par le conducteur des dommages causés.", MENTION_ASSUR],
      cmp: { cout: "À partir de " + prix(PRIMES.MOTO.cyclo.tiers) + " / mois (cyclomoteur au tiers)", liquidite: "Sans objet", rendement: "Sans objet", risque: "Sans objet", fisc: "Sans objet", ticket: "Sans objet", plafond: "Selon la formule" }
    },
    {
      id: "CCAR", famille: "assurance", nom: "GS Camping-car – assurance camping-car et van aménagé", code: "Assurance camping-car",
      accroche: "L'assurance du camping-car, avec le contenu, les aménagements et l'assistance en voyage.",
      public: "Propriétaires d'un camping-car, d'un van aménagé ou d'un fourgon aménagé pour un usage de loisirs.",
      eligibilite: ["Carte grise (certificat d'immatriculation) du véhicule, catégorie « véhicule de loisirs ».", "Permis de conduire adapté : le permis B suffit jusqu'à 3,5 t de PTAC ; au-delà, permis C1.", "Relevé d'information de l'assureur précédent (bonus-malus).", "Le véhicule ne doit pas servir de résidence principale."],
      caracteristiques: ["Trois formules : au tiers, tiers étendu (vol, incendie, bris de glace, événements climatiques) et tous risques.", "Garantie des aménagements et du contenu (équipements, vélos, mobilier, effets personnels).", "Valeur à neuf pendant 24 mois en formule tous risques.", "Assistance 0 km, rapatriement des occupants et du véhicule en France et en Europe.", "Garantie du conducteur incluse."],
      tarifs: [
        { lib: "Formule au tiers (à partir de)", val: prix(PRIMES.CCAR.tiers) + " par mois" },
        { lib: "Formule tiers étendu (à partir de)", val: prix(PRIMES.CCAR.etendu) + " par mois" },
        { lib: "Formule tous risques (à partir de)", val: prix(PRIMES.CCAR.tous) + " par mois" },
        { lib: "Franchise sur les dommages et le vol", val: "300 €" }
      ],
      avantages: ["Les aménagements et le contenu sont garantis, ce que ne fait pas toujours une assurance auto classique.", "Assistance en voyage adaptée aux séjours en camping-car.", "Un seul interlocuteur pour la banque et l'assurance."],
      risques: ["Le véhicule doit être déclaré avec ses aménagements : une sous-déclaration réduit l'indemnisation.", "Le vol est refusé si les moyens de protection exigés (antivol, parking) ne sont pas respectés.", "Franchises et exclusions : à expliquer au client.", "Si le véhicule sert de résidence principale, le contrat est inadapté."],
      reglementaire: ["L'assurance de responsabilité civile est obligatoire pour tout véhicule terrestre à moteur (article L. 211-1 du Code des assurances).", "Au-delà de 3,5 t de PTAC, le permis C1 est nécessaire pour conduire le véhicule.", MENTION_ASSUR],
      cmp: { cout: "À partir de " + prix(PRIMES.CCAR.tiers) + " / mois (au tiers)", liquidite: "Sans objet", rendement: "Sans objet", risque: "Sans objet", fisc: "Sans objet", ticket: "Sans objet", plafond: "Selon la formule" }
    },
    {
      id: "VSP", famille: "assurance", nom: "GS Mobilité – assurance voiture sans permis", code: "Voiture sans permis",
      accroche: "L'assurance obligatoire de la voiture sans permis (quadricycle léger à moteur), accessible dès 14 ans.",
      public: "Conducteurs d'une voiture sans permis, y compris les adolescents dès 14 ans titulaires du permis AM (BSR), par l'intermédiaire de leur représentant légal.",
      eligibilite: ["Carte grise (certificat d'immatriculation) de la voiture sans permis.", "Conducteur né avant le 1er janvier 1988 : aucun permis exigé ; né à partir de 1988 : permis AM (BSR) ou permis B.", "Conducteur de 14 à 17 ans : contrat souscrit et signé par le représentant légal.", "Relevé d'information de l'assureur précédent, le cas échéant."],
      caracteristiques: ["Deux formules : au tiers (responsabilité civile obligatoire, défense et recours) et tous risques (tiers + dommages tous accidents, vol, incendie).", "Garantie du conducteur incluse.", "Assistance 24 h sur 24, y compris à 0 km.", "Le conducteur désigné au contrat doit être le conducteur habituel."],
      tarifs: [
        { lib: "Formule au tiers (à partir de)", val: prix(PRIMES.VSP.tiers) + " par mois" },
        { lib: "Formule tous risques (à partir de)", val: prix(PRIMES.VSP.tous) + " par mois" },
        { lib: "Franchise sur les dommages et le vol", val: "250 € (conducteur de moins de 21 ans : 400 €)" }
      ],
      avantages: ["Une assurance adaptée à ce type de véhicule, pour les conducteurs sans permis B.", "Accessible aux jeunes conducteurs dès 14 ans.", "Un seul interlocuteur pour la banque et l'assurance."],
      risques: ["Les primes sont plus élevées que pour une voiture classique, surtout pour les moins de 21 ans.", "Vitesse limitée à 45 km/h : le véhicule n'est pas autorisé sur les voies rapides.", "Franchises et exclusions : à expliquer au client.", "Une fausse déclaration peut entraîner la nullité du contrat."],
      reglementaire: ["L'assurance de responsabilité civile est obligatoire pour tout véhicule terrestre à moteur, y compris les voitures sans permis (article L. 211-1 du Code des assurances).", "Un mineur ne peut pas signer seul un contrat : le représentant légal souscrit et signe.", MENTION_ASSUR],
      cmp: { cout: "À partir de " + prix(PRIMES.VSP.tiers) + " / mois (au tiers)", liquidite: "Sans objet", rendement: "Sans objet", risque: "Sans objet", fisc: "Sans objet", ticket: "Sans objet", plafond: "Selon la formule" }
    },
    {
      id: "PJ", famille: "assurance", nom: "GS Protection juridique", code: "Protection juridique",
      accroche: "Être conseillé et défendu en cas de litige de la vie courante, avec prise en charge des frais d'avocat et de procédure.",
      public: "Particuliers et familles : litiges de consommation, de voisinage, de logement, de travail, avec l'administration ou après un accident.",
      eligibilite: ["Être majeur ; la garantie peut couvrir toute la famille vivant au foyer.", "Le litige doit naître après la souscription et après le délai de carence.", "Pas de questionnaire de santé."],
      caracteristiques: ["Information juridique par téléphone, aide à la rédaction de courriers, recherche d'une solution amiable.", "Si le litige n'est pas réglé à l'amiable : prise en charge des frais d'avocat, d'huissier, d'expert et de procédure dans la limite des plafonds du contrat.", "Libre choix de l'avocat par le client.", "Deux formules : Essentielle (litiges de consommation, de voisinage, de logement et avec l'administration) et Complète (ajoute le droit du travail, la santé et l'e-réputation).", "Seuil d'intervention : litige d'un enjeu d'au moins 300 € ; délai de carence de 3 mois."],
      tarifs: [
        { lib: "Formule Essentielle", val: prix(PRIMES.PJ.ess) + " par mois – plafond de 15 000 € par litige" },
        { lib: "Formule Complète", val: prix(PRIMES.PJ.comp) + " par mois – plafond de 30 000 € par litige" },
        { lib: "Seuil d'intervention", val: "300 € d'enjeu" },
        { lib: "Délai de carence", val: "3 mois" }
      ],
      avantages: ["Une aide concrète pour faire valoir ses droits, sans avancer tous les frais.", "Libre choix de l'avocat.", "Cotisation modérée."],
      risques: ["Les litiges nés avant la souscription ou pendant le délai de carence ne sont pas pris en charge.", "Plafond de prise en charge : une procédure longue peut le dépasser.", "Exclusions : litiges entre assurés du même contrat, droit fiscal des revenus, certains litiges familiaux."],
      reglementaire: ["Le client choisit librement son avocat (article L. 127-3 du Code des assurances) ; en cas de désaccord avec l'assureur sur la suite à donner au litige, une procédure d'arbitrage est prévue.", MENTION_ASSUR],
      cmp: { cout: "À partir de " + prix(PRIMES.PJ.ess) + " / mois", liquidite: "Sans objet", rendement: "Sans objet", risque: "Sans objet", fisc: "Sans objet", ticket: "Sans objet", plafond: "15 000 à 30 000 € par litige" }
    },
    {
      id: "MPAY", famille: "assurance", nom: "GS Assurance moyens de paiement", code: "Moyens de paiement",
      accroche: "Protéger ses cartes, ses chéquiers, ses espèces retirées, ses papiers d'identité et ses clés en cas de perte, de vol ou d'agression.",
      public: "Clients titulaires d'une carte ou d'un chéquier GS Banque & Assurance ; la garantie s'étend à leur conjoint ou partenaire.",
      eligibilite: ["Être majeur et titulaire d'un compte de dépôt à GS Banque & Assurance, avec au moins une carte de paiement ou de retrait.", "Une seule assurance des moyens de paiement par client : elle est déjà comprise dans les conventions de compte (Junior, Avenir, Horizon et Sérénité), dont le titulaire n'a pas à la souscrire en plus.", "Aucun questionnaire de santé, aucune condition de revenu."],
      caracteristiques: ["Garantit les conséquences d'une perte, d'un vol ou d'une agression : opérations frauduleuses avec les cartes et les chéquiers avant la mise en opposition, espèces volées, papiers d'identité et clés perdus ou volés.", "Utilisation frauduleuse des cartes et des chéquiers, avant la mise en opposition : jusqu'à 3 050 € par année d'assurance.", "Espèces volées lors d'une agression, dans les 24 heures qui suivent un retrait avec une carte GS : jusqu'à 500 €.", "Perte ou vol des papiers d'identité du client, de son conjoint et de ses enfants : frais de remplacement jusqu'à 350 €, dont 50 € au plus pour la maroquinerie.", "Perte ou vol des clés du domicile et du véhicule : jusqu'à 350 €.", "Garantie des achats : vol ou casse d'un bien neuf dans les 7 jours qui suivent l'achat (jusqu'à 3 050 €) ; achat en ligne non livré ou non conforme (jusqu'à 750 € par année d'assurance).", "Les plafonds valent par année d'assurance et par adhésion, quel nombre de personnes soit assuré.", "Deux formules : moyens de paiement de la banque seulement, ou moyens de paiement détenus dans plusieurs banques."],
      tarifs: [
        { lib: "Formule moyens de paiement de la banque", val: eu(PRIMES.MPAY.banque) + " par mois (" + eu(PRIMES.MPAY.banque * 12) + " par an)" },
        { lib: "Formule moyens de paiement de plusieurs banques", val: eu(PRIMES.MPAY.multi) + " par mois (" + eu(PRIMES.MPAY.multi * 12) + " par an)" },
        { lib: "Utilisation frauduleuse (avant opposition)", val: "3 050 € par année d'assurance" },
        { lib: "Espèces volées lors d'une agression (24 h après un retrait)", val: "500 €" },
        { lib: "Papiers d'identité (dont 50 € de maroquinerie) / clés", val: "350 € / 350 €" },
        { lib: "Garantie des achats (bien neuf, 7 jours) / achats en ligne", val: "3 050 € / 750 € par année d'assurance" }
      ],
      avantages: ["Une protection concrète au quotidien pour " + eu(PRIMES.MPAY.banque) + " par mois.", "Les garanties couvrent aussi les espèces, les papiers et les clés, que la loi ne protège pas.", "Le conjoint ou partenaire est couvert sans supplément.", "Déjà comprise, sans frais en plus, dans les conventions de compte."],
      risques: ["La loi protège déjà le client : après l'opposition il ne supporte plus rien, et avant l'opposition il supporte au plus 50 € (hors fraude ou négligence grave). L'intérêt de l'assurance est donc surtout dans les garanties complémentaires (espèces, papiers, clés, achats) : à expliquer au client avant de la vendre.", "Les opérations frauduleuses ne sont couvertes que si elles ont eu lieu avant la mise en opposition : le client doit faire opposition sans délai, 24 heures sur 24.", "La garantie des espèces est limitée à 500 € et à 24 heures après un retrait ; elle ne joue pas si l'agression a lieu plus tard.", "Chaque garantie a des plafonds, des délais de déclaration et des exclusions, indiqués dans la notice d'information remise avant la souscription."],
      reglementaire: ["En cas de perte ou de vol d'une carte, le client fait opposition sans délai ; pour une opération non autorisée faite avant l'opposition, il supporte au plus 50 € (article L. 133-19 du Code monétaire et financier), sauf agissement frauduleux ou négligence grave de sa part ; après l'opposition, il ne supporte plus aucune perte, sauf agissement frauduleux de sa part.", "Il conteste une opération non autorisée dans les 13 mois suivant le débit.", "L'assurance est facultative : la banque ne peut pas la rendre obligatoire pour ouvrir un compte ou délivrer une carte. Le client peut la résilier à tout moment après la première année, sans frais ni pénalité.", MENTION_ASSUR],
      cmp: { cout: eu(PRIMES.MPAY.banque) + " / mois (" + eu(PRIMES.MPAY.banque * 12) + " / an)", liquidite: "Sans objet", rendement: "Sans objet", risque: "Sans objet", fisc: "Sans objet", ticket: "Sans objet", plafond: "3 050 € de fraude par année" }
    },
    {
      id: "APN", famille: "assurance", nom: "GS Assurance appareils nomades", code: "Appareils nomades",
      accroche: "Protéger les smartphones, tablettes et ordinateurs portables du foyer contre la casse, l'oxydation et le vol, sans franchise.",
      public: "Clients majeurs qui utilisent un smartphone, une tablette ou un ordinateur portable pour un usage privé ; tous les appareils mobiles du foyer sont couverts par une seule cotisation.",
      eligibilite: ["Être majeur.", "Posséder au moins un appareil mobile (smartphone, tablette tactile ou ordinateur portable) dont la facture d'achat est au nom du client.", "Usage privé de l'appareil : un usage professionnel ou commercial n'est couvert qu'avec l'option usage professionnel.", "Aucun questionnaire de santé, aucune condition de revenu, aucune limite d'ancienneté de l'appareil : les appareils déjà détenus sont couverts dès la souscription."],
      caracteristiques: ["Couvre tous les appareils mobiles du foyer, sans limite de nombre, pour une cotisation unique : smartphones, tablettes tactiles, ordinateurs portables.", "Casse et dommages accidentels : détérioration ou destruction de l'appareil, y compris par maladresse.", "Oxydation : dégâts causés par un liquide, quelle qu'en soit la cause, y compris par maladresse.", "Vol : avec agression, avec effraction, à la tire ou à la sauvette ; utilisation frauduleuse des communications passées par un tiers après le vol du téléphone.", "Accessoires (casque, écouteurs, stylet, étui, coque, chargeur) couverts en cas de vol ou d'utilisation frauduleuse.", "Réparation en priorité par un réparateur agréé ; si l'appareil ne peut pas être réparé, remplacement par un appareil équivalent ; à défaut, indemnité financière.", "Option usage professionnel : l'appareil privé reste couvert quand le sinistre survient dans le cadre d'une activité professionnelle."],
      tarifs: [
        { lib: "Formule Essentielle", val: eu(PRIMES.APN.ess) + " par mois (" + eu(PRIMES.APN.ess * 12) + " par an)" },
        { lib: "Formule Plus", val: eu(PRIMES.APN.plus) + " par mois (" + eu(PRIMES.APN.plus * 12) + " par an)" },
        { lib: "Option usage professionnel", val: "+ " + eu(PRIMES.APN.pro) + " par mois" },
        { lib: "Remise pour le client qui a une assurance habitation GS", val: "− " + eu(PRIMES.APN.remise.ess) + " par mois (Essentielle) ou − " + eu(PRIMES.APN.remise.plus) + " par mois (Plus)" },
        { lib: "Plafond par année d'assurance – Essentielle", val: "600 € par téléphone ; 1 000 € par tablette ou ordinateur portable" },
        { lib: "Plafond par année d'assurance – Plus", val: "900 € par téléphone ; 1 500 € par tablette ou ordinateur portable" },
        { lib: "Base d'indemnisation", val: "Essentielle : valeur d'achat déduite de la vétusté ; Plus : valeur d'achat pendant les 12 mois qui suivent l'achat, puis valeur d'achat déduite de la vétusté" },
        { lib: "Franchise", val: "Aucune, ni seuil minimum d'intervention" },
        { lib: "Limite de sinistres", val: "2 sinistres par année d'assurance, sur 4 appareils au plus" }
      ],
      avantages: ["Une cotisation unique pour tous les appareils mobiles du foyer, présents et futurs.", "Aucune franchise : le client n'avance rien en cas de sinistre pris en charge.", "Les appareils achetés avant la souscription sont couverts, sans limite d'ancienneté.", "Réparation ou remplacement par l'assureur : le client retrouve un appareil en état de marche.", "Remise sur la cotisation pour le client qui a déjà une assurance habitation GS."],
      risques: ["La panne n'est pas couverte (ni la perte, l'oubli ou la disparition inexpliquée) : en cas de panne, le client s'adresse d'abord au vendeur au titre de la garantie légale de conformité (2 ans pour un appareil neuf) ou à la garantie du constructeur.", "Le vol simple, sans agression, sans effraction et sans geste à la tire ou à la sauvette, n'est pas couvert.", "Les plafonds s'appliquent par année d'assurance et par type d'appareil ; au-delà de 2 sinistres dans l'année, plus aucun sinistre n'est pris en charge.", "La facture d'origine doit être au nom de l'assuré : sans facture, pas d'indemnisation.", "Un appareil acheté d'occasion ou ancien est remboursé sur sa valeur d'achat, vétusté déduite : l'indemnité peut être inférieure au prix d'un appareil neuf.", "Beaucoup de clients sont déjà couverts en partie par leur assurance habitation, leur carte bancaire ou la garantie du vendeur : à vérifier avant de vendre."],
      reglementaire: [MENTION_ASSUR, "Le document d'information sur le produit d'assurance (DIPA) est remis au client avant la souscription ; il présente les garanties, les exclusions et les plafonds.", "Contrat conclu à distance (mailing, appel) : délai de rétractation de 14 jours calendaires ; contrat conclu en agence : les conditions générales indiquent les modalités de renonciation.", "L'assurance est facultative : la banque ne peut pas la rendre obligatoire pour accorder un crédit ou ouvrir un compte."],
      cmp: { cout: eu(PRIMES.APN.ess) + " / mois (" + eu(PRIMES.APN.ess * 12) + " / an), formule Essentielle", liquidite: "Sans objet", rendement: "Sans objet", risque: "Sans objet", fisc: "Sans objet", ticket: "Sans objet", plafond: "600 € par téléphone (Essentielle)" }
    }
  ];

  /* ====================================================================================================================================================
     Univers « Mobile et internet » (livraison 6) : forfait mobile, box internet fibre, pack forfait + box, eSIM voyage.
     Les prix, débits, volumes de données, frais et conditions des forfaits, des box et des packs sont ceux de l'offre « Mobile et internet » qu'une grande banque de réseau
     affichait en octobre 2026 (relevé du 12/11/2026 sur son site public) ; seuls les noms commerciaux sont ceux de GS Banque & Assurance, et l'opérateur partenaire n'est pas nommé.
     La grille de l'eSIM voyage est inventée (la banque de référence n'affichait aucun prix). Les offres ne sont jamais vendues sans que le conseiller confirme les points à vérifier.
     ==================================================================================================================================================== */
  var MOBILE = {
    remiseBox: 3,            /* € par mois sur le forfait quand le client a une box GS (perdue en cas de résiliation de la box) */
    sim: 10,                 /* carte SIM, une fois */
    resiliationMobile: 5,    /* frais de résiliation du forfait */
    miseEnService: 48,       /* frais de mise en service de la box (hors migration d'un client déjà en ADSL vers la fibre) */
    resiliationBox: 69,      /* frais de résiliation de la box */
    engagementBox: 12,       /* mois */
    esimGo: 1,               /* Go offerts aux clients sur chaque eSIM voyage */
    ordreForfaits: ["mini", "50", "150", "250"],     /* ordre d'affichage (les clés numériques seraient sinon rangées avant « mini ») */
    /* Forfaits : clé de l'option « forfait ». « prixBox » : tarif quand le client a une box GS (le Mini n'a pas de remise de 3 € mais un tarif propre). */
    forfaits: {
      mini: { lib: "Mini 5 Go", go: 5, europe: 5, prix: 10.99, prixBox: 4.99, cinqG: false },
      "50": { lib: "50 Go", go: 50, europe: 20, prix: 11.99, cinqG: true },
      "150": { lib: "150 Go", go: 150, europe: 25, prix: 14.99, cinqG: true },
      "250": { lib: "250 Go", go: 250, europe: 40, prix: 20.99, cinqG: true }
    },
    /* Box fibre (FTTH), engagement de 12 mois, location de la box incluse. Offre « Optimal » : prix catalogue (la promotion de l'été 2026 est terminée). */
    box: {
      essentiel: { lib: "Essentiel", prix: 30.99, wifi: "Wi-Fi 6", down: "1 Gb/s", up: "700 Mb/s", tv: "Pas de télévision" },
      optimal: { lib: "Optimal", prix: 35.99, wifi: "Wi-Fi 7", down: "2 Gb/s", up: "900 Mb/s", tv: "Plus de 180 chaînes, décodeur 4K" },
      integral: { lib: "Intégral", prix: 44.99, wifi: "Wi-Fi 7", down: "jusqu'à 8 Gb/s selon l'éligibilité du logement (2 Gb/s sinon)", up: "1 Gb/s (900 Mb/s sans l'éligibilité)", tv: "Plus de 180 chaînes, deux décodeurs, 5 accès simultanés à la télévision sur écrans" }
    },
    /* eSIM voyage (grille inventée) : prix pour 7 jours selon la zone et le volume, puis supplément selon la durée de validité. */
    esimZones: [{ v: "europe", lib: "Europe" }, { v: "amerique", lib: "Amérique du Nord" }, { v: "asie", lib: "Asie et Océanie" }, { v: "afrique", lib: "Afrique et Moyen-Orient" }, { v: "monde", lib: "Monde entier" }],
    esimVolumes: [3, 10, 20],
    esimDurees: [7, 15, 30],
    esimPrix7: { europe: { 3: 5.9, 10: 11.9, 20: 19.9 }, amerique: { 3: 9.9, 10: 19.9, 20: 29.9 }, asie: { 3: 9.9, 10: 18.9, 20: 28.9 }, afrique: { 3: 12.9, 10: 24.9, 20: 36.9 }, monde: { 3: 14.9, 10: 29.9, 20: 44.9 } },
    esimSupplement: { 7: 0, 15: 4, 30: 9 }
  };
  function arrondi2(n) { return Math.round(n * 100) / 100; }
  var PACK_BOX = "optimal";           /* le pack comprend toujours la box Optimal */
  /* Mensualité du forfait mobile : avecBox = le client a (ou prend en même temps) une box GS. */
  function mensualiteForfait(cle, avecBox) {
    var f = MOBILE.forfaits[cle];
    if (!f) return NaN;
    if (cle === "mini") return avecBox ? f.prixBox : f.prix;
    return arrondi2(f.prix - (avecBox ? MOBILE.remiseBox : 0));
  }
  /* Prix de l'eSIM voyage (une fois) pour une zone, un volume en Go et une durée en jours. */
  function prixEsim(zone, go, jours) {
    var z = MOBILE.esimPrix7[zone], s = MOBILE.esimSupplement[jours];
    if (!z || z[go] === undefined || s === undefined) return NaN;
    return arrondi2(z[go] + s);
  }
  /* Abonnement d'une souscription « Mobile et internet » selon les options choisies :
     { mois, an, unique, remise } en euros — mois : mensualité ; unique : paiement unique (eSIM voyage) ; remise : remise box déjà déduite de la mensualité du forfait. null si les options sont incomplètes. */
  function abonnement(pid, o, avecBox) {
    o = o || {};
    if (pid === "MOB") {
      var m = mensualiteForfait(o.forfait, !!avecBox);
      return isNaN(m) ? null : { mois: m, an: arrondi2(m * 12), unique: null, remise: o.forfait !== "mini" && avecBox ? MOBILE.remiseBox : 0 };
    }
    if (pid === "BOX") {
      var b = MOBILE.box[o.offre];
      return b ? { mois: b.prix, an: arrondi2(b.prix * 12), unique: null, remise: 0 } : null;
    }
    if (pid === "PACK") {
      var mf = mensualiteForfait(o.forfait, true);
      if (isNaN(mf) || o.forfait === "mini") return null;
      var t = arrondi2(MOBILE.box[PACK_BOX].prix + mf);
      return { mois: t, an: arrondi2(t * 12), unique: null, remise: MOBILE.remiseBox };
    }
    if (pid === "ESIM") {
      var u = prixEsim(o.zone, +o.volume, +o.duree);
      return isNaN(u) ? null : { mois: null, an: null, unique: u, remise: 0 };
    }
    return null;
  }
  var MENTION_TELECOM = "Offre de communications électroniques proposée par GS Banque & Assurance, qui distribue les offres de son opérateur partenaire : le contrat est conclu avec l'opérateur, la banque ne fournit pas le service. Le conseiller remet la fiche d'information standardisée avant la signature.";
  var RETRACTATION_TELECOM = "Contrat conclu à distance (mailing, appel) : délai de rétractation de 14 jours calendaires révolus (article L. 221-18 du Code de la consommation) ; un contrat conclu en agence n'ouvre pas ce délai. Le client qui demande une mise en service immédiate paie les services déjà consommés.";
  var MEDIATION_TELECOM = "En cas de litige, le client écrit d'abord au service client de l'opérateur ; sans réponse satisfaisante, il peut saisir gratuitement le médiateur des communications électroniques.";

  var MOBILE_NOUVEAUX = [
    {
      id: "MOB", famille: "mobile", nom: "GS Mobile – forfait mobile sans engagement", code: "Forfait mobile",
      accroche: "Un forfait mobile sans engagement avec appels, SMS et MMS illimités et de 5 à 250 Go de données, réservé aux clients de la banque.",
      public: "Clients majeurs de GS Banque & Assurance, titulaires d'un compte courant, qui veulent un forfait mobile sans engagement ; remise de 3 € par mois sur le forfait avec une box GS.",
      eligibilite: ["Être majeur et titulaire d'un compte de dépôt à GS Banque & Assurance (offre réservée aux clients de la banque).", "Choisir l'un des quatre forfaits : Mini (5 Go), 50 Go, 150 Go ou 250 Go.", "Mobile compatible 5G pour profiter de la 5G (forfaits de 50 Go et plus).", "Pour conserver son numéro : relevé d'identité opérateur (RIO) obtenu en appelant le 3179 depuis la ligne concernée."],
      caracteristiques: ["Sans engagement : le client résilie quand il le souhaite (frais de résiliation de 5 €).", "Appels, SMS et MMS illimités en France métropolitaine, en Europe et dans les DOM.", "Données en 5G en France métropolitaine (forfaits de 50 Go et plus), dont une partie utilisable en Europe et dans les DOM : 20 Go avec le 50 Go, 25 Go avec le 150 Go, 40 Go à l'international avec le 250 Go.", "150 Go : appels illimités vers les DOM et vers les fixes de 120 destinations. 250 Go : appels illimités aussi vers la Suisse, les États-Unis et le Canada.", "Conservation gratuite du numéro (portabilité) : l'opérateur se charge de la résiliation de l'ancien contrat.", "Carte SIM facturée 10 €."],
      tarifs: [
        { lib: "Mini 5 Go (5 Go en France, 5 Go en Europe et DOM)", val: eu(MOBILE.forfaits.mini.prix) + " par mois ; " + eu(MOBILE.forfaits.mini.prixBox) + " avec une box GS" },
        { lib: "50 Go en 5G (dont 20 Go en Europe et DOM)", val: eu(MOBILE.forfaits["50"].prix) + " par mois ; " + eu(mensualiteForfait("50", true)) + " avec une box GS" },
        { lib: "150 Go en 5G (dont 25 Go en Europe et DOM)", val: eu(MOBILE.forfaits["150"].prix) + " par mois ; " + eu(mensualiteForfait("150", true)) + " avec une box GS" },
        { lib: "250 Go en 5G (dont 40 Go à l'international)", val: eu(MOBILE.forfaits["250"].prix) + " par mois ; " + eu(mensualiteForfait("250", true)) + " avec une box GS" },
        { lib: "Carte SIM", val: eu0(MOBILE.sim) },
        { lib: "Frais de résiliation", val: eu0(MOBILE.resiliationMobile) },
        { lib: "Remise avec une box GS", val: eu0(MOBILE.remiseBox) + " par mois sur les forfaits de 50 à 250 Go (perdue si la box est résiliée) ; le Mini passe à " + eu(MOBILE.forfaits.mini.prixBox) }
      ],
      avantages: ["Aucun engagement : le forfait se résilie à tout moment pour 5 €.", "Une offre réservée aux clients de la banque, avec un seul interlocuteur pour la banque et le mobile.", "Jusqu'à 3 € par mois de remise quand le client prend aussi la box.", "Numéro conservé gratuitement."],
      risques: ["Forfait Mini : les données au-delà des 5 Go sont facturées au tarif en vigueur, à expliquer au client.", "La 5G dépend de la couverture et du mobile du client : le déploiement est progressif.", "La remise de 3 € disparaît si le client résilie sa box.", "Le tarif de 4,99 € du forfait Mini suppose que le client ait une box GS et un autre forfait de l'opérateur ; sinon le Mini est facturé " + eu(MOBILE.forfaits.mini.prix) + " par mois."],
      reglementaire: ["La conservation du numéro est gratuite et le client la demande avec son relevé d'identité opérateur (RIO) ; l'opérateur gère la résiliation de l'ancien contrat.", RETRACTATION_TELECOM, MEDIATION_TELECOM, MENTION_TELECOM],
      cmp: { cout: "À partir de " + eu(MOBILE.forfaits.mini.prix) + " / mois (Mini 5 Go)", liquidite: "Sans engagement, résiliation à 5 €", rendement: "Sans objet", risque: "Sans objet", fisc: "Sans objet", ticket: "Carte SIM : " + eu0(MOBILE.sim), plafond: "De 5 à 250 Go de données" }
    },
    {
      id: "BOX", famille: "mobile", nom: "GS Box – box internet fibre", code: "Box internet",
      accroche: "Une box internet très haut débit en fibre optique, avec Wi-Fi 6 ou 7, appels illimités et, selon l'offre, la télévision.",
      public: "Clients majeurs de GS Banque & Assurance dont le logement est raccordable à la fibre optique et qui acceptent un engagement de 12 mois.",
      eligibilite: ["Être majeur et titulaire d'un compte de dépôt à GS Banque & Assurance.", "Logement raccordable à la fibre optique jusqu'au domicile (test d'éligibilité à l'adresse du client).", "Locataire ou copropriétaire : accord du propriétaire ou du syndic pour le raccordement, si l'immeuble n'est pas déjà fibré.", "Accepter un engagement de 12 mois."],
      caracteristiques: ["Trois offres : Essentiel (1 Gb/s en réception, Wi-Fi 6), Optimal (2 Gb/s, Wi-Fi 7, plus de 180 chaînes avec un décodeur 4K) et Intégral (jusqu'à 8 Gb/s selon l'éligibilité du logement, Wi-Fi 7, deux décodeurs, répéteur Wi-Fi).", "Location de la box incluse dans le prix mensuel.", "Appels illimités vers les fixes de France et de plus de 110 pays ; vers les mobiles de France avec Optimal et Intégral, et d'Europe avec Intégral.", "Internet garanti : en cas de panne ou avant l'activation de la box, une clé 4G est prêtée au client.", "Engagement de 12 mois.", "Prix révisé chaque année selon l'indice ICHTrev-TS de l'INSEE."],
      tarifs: [
        { lib: "Essentiel – 1 Gb/s en réception, 700 Mb/s en émission, Wi-Fi 6", val: eu(MOBILE.box.essentiel.prix) + " par mois" },
        { lib: "Optimal – 2 Gb/s, 900 Mb/s, Wi-Fi 7, télévision 4K", val: eu(MOBILE.box.optimal.prix) + " par mois" },
        { lib: "Intégral – jusqu'à 8 Gb/s selon l'éligibilité, Wi-Fi 7, deux décodeurs", val: eu(MOBILE.box.integral.prix) + " par mois" },
        { lib: "Engagement", val: MOBILE.engagementBox + " mois" },
        { lib: "Frais de mise en service", val: eu0(MOBILE.miseEnService) + " (hors migration d'un client déjà raccordé en ADSL vers la fibre)" },
        { lib: "Frais de résiliation", val: eu0(MOBILE.resiliationBox) },
        { lib: "Location de la box", val: "Incluse" }
      ],
      avantages: ["Un très haut débit pour toute la famille (télévision, télétravail, jeux).", "Location de la box comprise : aucune mauvaise surprise sur le matériel.", "Clé 4G prêtée en cas de coupure : le client reste connecté.", "Une remise de " + eu0(MOBILE.remiseBox) + " par mois sur le forfait mobile GS."],
      risques: ["Engagement de 12 mois : en cas de résiliation anticipée, le client perd ses remises et règle les mensualités restantes au tarif sans promotion (hors location de la box).", "Frais de mise en service de " + eu0(MOBILE.miseEnService) + " et frais de résiliation de " + eu0(MOBILE.resiliationBox) + ".", "Le prix peut être révisé chaque année avec l'indice ICHTrev-TS.", "Les débits annoncés sont des maximums « jusqu'à » : le débit réel dépend de l'éligibilité du logement."],
      reglementaire: ["Le client reçoit avant la signature la fiche d'information standardisée de l'offre, avec le prix, la durée d'engagement et les frais.", RETRACTATION_TELECOM, MEDIATION_TELECOM, MENTION_TELECOM],
      cmp: { cout: "À partir de " + eu(MOBILE.box.essentiel.prix) + " / mois", liquidite: "Engagement de 12 mois, résiliation à " + eu0(MOBILE.resiliationBox), rendement: "Sans objet", risque: "Sans objet", fisc: "Sans objet", ticket: "Mise en service : " + eu0(MOBILE.miseEnService), plafond: "De 1 à 8 Gb/s selon l'offre" }
    },
    {
      id: "PACK", famille: "mobile", nom: "GS Pack – forfait mobile + box internet", code: "Forfait + Box",
      accroche: "La box Optimal en fibre et un forfait mobile de 50, 150 ou 250 Go réunis, avec 3 € de remise par mois sur le forfait.",
      public: "Clients majeurs de GS Banque & Assurance qui prennent en même temps une box internet fibre et un forfait mobile.",
      eligibilite: ["Être majeur et titulaire d'un compte de dépôt à GS Banque & Assurance.", "Ne pas déjà avoir de box GS ni de forfait mobile GS (le pack se souscrit en une fois).", "Logement raccordable à la fibre optique jusqu'au domicile (test d'éligibilité à l'adresse du client).", "Accepter l'engagement de 12 mois de la box ; le forfait mobile reste sans engagement."],
      caracteristiques: ["Composition : la box Optimal (fibre jusqu'à 2 Gb/s, Wi-Fi 7, plus de 180 chaînes avec un décodeur 4K, appels illimités) et un forfait mobile de 50, 150 ou 250 Go.", "Remise de " + eu0(MOBILE.remiseBox) + " par mois sur le forfait mobile, appliquée dès la souscription simultanée de la box et du forfait (le prix barré est le prix sans cette remise).", "Engagement de 12 mois pour la box ; forfait mobile sans engagement.", "Une seule facture, un seul interlocuteur."],
      tarifs: [
        { lib: "Pack 50 Go (box Optimal + forfait 50 Go)", val: eu(arrondi2(MOBILE.box.optimal.prix + mensualiteForfait("50", true))) + " par mois (" + eu(arrondi2(MOBILE.box.optimal.prix + MOBILE.forfaits["50"].prix)) + " sans la remise)" },
        { lib: "Pack 150 Go (box Optimal + forfait 150 Go)", val: eu(arrondi2(MOBILE.box.optimal.prix + mensualiteForfait("150", true))) + " par mois (" + eu(arrondi2(MOBILE.box.optimal.prix + MOBILE.forfaits["150"].prix)) + " sans la remise)" },
        { lib: "Pack 250 Go (box Optimal + forfait 250 Go)", val: eu(arrondi2(MOBILE.box.optimal.prix + mensualiteForfait("250", true))) + " par mois (" + eu(arrondi2(MOBILE.box.optimal.prix + MOBILE.forfaits["250"].prix)) + " sans la remise)" },
        { lib: "Frais de mise en service de la box", val: eu0(MOBILE.miseEnService) },
        { lib: "Carte SIM", val: eu0(MOBILE.sim) },
        { lib: "Frais de résiliation", val: "Box : " + eu0(MOBILE.resiliationBox) + " ; forfait : " + eu0(MOBILE.resiliationMobile) }
      ],
      avantages: ["Une remise de " + eu0(MOBILE.remiseBox) + " par mois sur le forfait mobile, tant que la box est conservée.", "Une box très haut débit avec la télévision 4K et un forfait mobile avec 5G.", "Le forfait reste sans engagement."],
      risques: ["Si le client résilie la box, il perd la remise de " + eu0(MOBILE.remiseBox) + " sur le forfait mobile.", "Résiliation de la box avant 12 mois : le client règle les mensualités restantes au tarif sans promotion (hors location de la box).", "Frais de mise en service de " + eu0(MOBILE.miseEnService) + " et frais de résiliation à prévoir."],
      reglementaire: ["Le client reçoit avant la signature les fiches d'information standardisées de la box et du forfait.", RETRACTATION_TELECOM, MEDIATION_TELECOM, MENTION_TELECOM],
      cmp: { cout: "À partir de " + eu(arrondi2(MOBILE.box.optimal.prix + mensualiteForfait("50", true))) + " / mois (pack 50 Go)", liquidite: "Box : engagement de 12 mois ; forfait sans engagement", rendement: "Sans objet", risque: "Sans objet", fisc: "Sans objet", ticket: "Mise en service : " + eu0(MOBILE.miseEnService), plafond: "Forfait de 50 à 250 Go" }
    },
    {
      id: "ESIM", famille: "mobile", nom: "GS eSIM Voyage – internet mobile à l'étranger", code: "eSIM voyage",
      accroche: "Une eSIM à installer sur le téléphone avant le départ pour garder une connexion à l'étranger sans frais d'itinérance.",
      public: "Clients majeurs de GS Banque & Assurance qui voyagent hors de France et possèdent un téléphone compatible eSIM.",
      eligibilite: ["Être majeur et titulaire d'un compte de dépôt à GS Banque & Assurance (offre réservée aux clients).", "Téléphone compatible eSIM et non verrouillé par un opérateur (en général un téléphone de moins de cinq ans) : le client le vérifie avec le code de vérification de son téléphone, qui affiche un numéro EID.", "Adresse e-mail du client pour recevoir le QR code d'installation."],
      caracteristiques: ["Le client choisit à l'achat la destination, la durée de séjour et le volume de données.", "Plus de 200 destinations dans le monde (Europe, Afrique, Amérique du Nord et du Sud, Asie, Caraïbes, Moyen-Orient, Océanie), sans frais d'itinérance.", "1 Go de données offert aux clients de la banque sur chaque eSIM.", "Le client reçoit un e-mail avec un QR code à scanner ; il installe l'eSIM avant le départ ou à l'arrivée, puis se connecte.", "Le numéro habituel est conservé : le client continue à recevoir ses appels et SMS sur sa ligne (sélection de la ligne dans les réglages du téléphone) ; partage de connexion possible.", "Service client disponible 24 h sur 24."],
      tarifs: [
        { lib: "Europe – 3 Go, 7 jours", val: "À partir de " + eu(prixEsim("europe", 3, 7)) },
        { lib: "Amérique du Nord – 10 Go, 7 jours", val: eu(prixEsim("amerique", 10, 7)) },
        { lib: "Asie et Océanie – 10 Go, 7 jours", val: eu(prixEsim("asie", 10, 7)) },
        { lib: "Monde entier – 20 Go, 30 jours", val: eu(prixEsim("monde", 20, 30)) },
        { lib: "Supplément de durée", val: "15 jours : + " + eu(MOBILE.esimSupplement[15]) + " ; 30 jours : + " + eu(MOBILE.esimSupplement[30]) + " (volumes de 3, 10 ou 20 Go)" },
        { lib: "Données offertes", val: MOBILE.esimGo + " Go de plus sur chaque eSIM" },
        { lib: "Engagement", val: "Aucun : paiement unique à l'achat" }
      ],
      avantages: ["Pas de frais d'itinérance, ni de mauvaise surprise sur la facture au retour.", "Aucune carte SIM à changer : le client garde sa ligne et son numéro.", "Achat à la carte, pour un séjour précis.", "Installation par QR code, avant le départ ou à l'arrivée."],
      risques: ["Le téléphone doit être compatible eSIM et débloqué : à vérifier avant la vente.", "Le volume de données, la destination et la durée sont fixés à l'achat : le conseiller les fait choisir avec le client d'après son séjour.", "Les appels et SMS sur la ligne habituelle peuvent être facturés selon le forfait et l'opérateur du client ; les appels par internet (applications) évitent ces frais.", "La couverture et la qualité dépendent des réseaux partenaires de chaque pays."],
      reglementaire: ["Offre réservée aux clients de la banque. Les réseaux partenaires sont choisis sur des critères de qualité ; la couverture varie selon les destinations.", RETRACTATION_TELECOM + "", MEDIATION_TELECOM, MENTION_TELECOM],
      cmp: { cout: "À partir de " + eu(prixEsim("europe", 3, 7)) + " (Europe, 3 Go, 7 jours)", liquidite: "Aucun engagement", rendement: "Sans objet", risque: "Sans objet", fisc: "Sans objet", ticket: "Aucun", plafond: "20 Go (+ 1 Go offert)" }
    }
  ];

  /* ---------- insertion des nouveaux produits dans l'ordre du catalogue ---------- */
  function parIds(liste, ids) { return ids.map(function (id) { return liste.filter(function (p) { return p.id === id; })[0]; }); }
  var DAC = {
    /* Convention de droit au compte : fiche d'information. Elle n'est pas souscrite depuis le catalogue : elle s'applique à l'ouverture d'un compte « DAC » (dossier d'ouverture de compte,
       question posée au conseiller), la mention DAC étant posée à l'ouverture du compte et non à la souscription d'une convention. */
    id: "DAC", famille: "compte", horsMontage: true, nom: "Convention de compte – droit au compte (services bancaires de base)", code: "Droit au compte",
    motifFiche: "La convention de droit au compte n'est pas souscrite depuis le catalogue : elle s'applique à l'ouverture d'un compte « droit au compte » (DAC), dans le dossier d'ouverture de compte, sur désignation de la Banque de France.",
    motifProspection: "La convention de droit au compte n'est pas un produit qu'on vend : elle s'applique à la personne que la Banque de France a désignée pour lui ouvrir un compte.",
    accroche: "Les services bancaires de base, gratuits, pour la personne à qui la Banque de France a désigné la banque.",
    public: "Personnes sans compte de dépôt en France à qui une banque a refusé l'ouverture d'un compte et que la Banque de France a désignée pour le leur ouvrir.",
    eligibilite: ["Être majeur, domicilié en France (ou résider légalement dans l'Union européenne) et ne détenir aucun compte de dépôt en France : déclaration sur l'honneur du demandeur.", "Avoir été désigné par la Banque de France, qui a été saisie après le refus de la banque de son choix.", "La désignation reste valable six mois : au-delà, le demandeur doit saisir de nouveau la Banque de France."],
    caracteristiques: ["Services bancaires de base (article D312-5-1 du Code monétaire et financier) : ouverture, tenue et clôture du compte ; changement d'adresse une fois par an ; relevés d'identité bancaire ; domiciliation de virements ; relevé mensuel des opérations ; encaissement de chèques et de virements ; dépôts et retraits d'espèces au guichet ; paiements par prélèvement et par virement SEPA ; consultation du solde à distance ; deux chèques de banque par mois.", "Carte de paiement à autorisation systématique : le solde est vérifié à chaque paiement.", "Ni chéquier ni découvert autorisé.", "Le compte porte la mention DAC (droit au compte), posée à l'ouverture du compte, pas à la souscription de la convention."],
    tarifs: [{ lib: "Services bancaires de base", val: "Gratuits" }, { lib: "Tenue de compte", val: "Gratuite" }],
    avantages: ["Le client dispose d'un compte et des moyens de paiement essentiels, sans frais.", "Le compte peut recevoir un salaire ou une prestation et payer les dépenses courantes."],
    risques: ["Moyens de paiement limités : carte à autorisation systématique, ni chéquier ni découvert.", "Le client peut demander à tout moment d'autres services, payants : la banque n'est pas tenue de les lui accorder."],
    reglementaire: ["Article L312-1 du Code monétaire et financier : toute personne dépourvue de compte de dépôt a droit à l'ouverture d'un compte ; en cas de refus, la Banque de France désigne un établissement.", "L'établissement désigné ne peut pas refuser : il notifie les pièces à fournir dans les trois jours ouvrés de la désignation et ouvre le compte dans les trois jours ouvrés de leur réception (articles L312-1 et R312-7).", "Les services bancaires de base sont fournis gratuitement (article D312-5-1).", MENTION_DEPOTS],
    cmp: { cout: "Gratuit", liquidite: "Immédiate", rendement: "Aucun", risque: "Aucun sur le capital", fisc: "Sans objet", ticket: "Aucun dépôt minimum", plafond: "Ni découvert ni chéquier" }
  };
  inserer("OCF", [GCON, GALE].concat(CONVENTIONS.map(produitConvention), [DAC]));
  inserer("VPRE", CARTES_HG);
  inserer("LBR", [CAT]);
  inserer("AV", parIds(PLACEMENTS_NOUVEAUX, ["AVP", "AVE", "MGS", "MGE", "MGD"]));
  inserer("PEA", parIds(PLACEMENTS_NOUVEAUX, ["PEAJ", "PEAPME"]));
  inserer("PER", parIds(PLACEMENTS_NOUVEAUX, ["CTO", "PSOC", "AUTZ"]));
  inserer("AUTO", parIds(ASSURANCES_NOUVELLES, ["MOTO", "CCAR", "VSP"]));
  inserer("GAV", parIds(ASSURANCES_NOUVELLES, ["PJ", "MPAY", "APN"]));
  inserer("PREV", parIds(ASSURANCES_NOUVELLES, ["DECES", "DEP", "OBSQ"]));
  Array.prototype.push.apply(PRODUITS, MOBILE_NOUVEAUX);     /* univers « Mobile et internet » : à la suite du catalogue */

  /* ---------- échelle de risque et document d'informations clés : calculés depuis la composition (placements.js), jamais saisis ---------- */
  PRODUITS.forEach(function (p) {
    var pl = PL.P[p.id];
    if (!pl) return;
    var g = PL.plage(p.id);
    p.sri = { min: g.min, max: g.max };
    p.dici = "assets/dici/DICI_" + p.id + ".pdf";
    p.cmp.risque = R.libelleFiche(g.min, g.max, pl.supports.length > 1 || (pl.gamme && pl.gamme.length) ? "selon les supports" : "");
  });


  var PAR_ID = {};
  PRODUITS.forEach(function (p) { PAR_ID[p.id] = p; });

  /* Éligibilité LEP : revenu fiscal de référence et nombre de parts (ex. 1, 1.5, 2, 2.5, 3, 3.5…). */
  function plafondLEP(parts) {
    var i = Math.round((parts - 1) * 2);
    if (i < 0) i = 0;
    if (i < LEP_RFR.length) return LEP_RFR[i];
    return LEP_RFR[LEP_RFR.length - 1] + (i - (LEP_RFR.length - 1)) * LEP_RFR_DEMI;
  }

  var api = { familles: FAMILLES, univers: UNIVERS, universDe: universDe, tarifsUnitaires: TARIFS_UNITAIRES, conventions: CONVENTIONS, conventionFiche: conventionFiche, economieConvention: economieConvention, valeurUnitaire: valeurUnitaire, cotisation: cotisation, prime: prime, primes: PRIMES, gconMois: GCON_MOIS, galeMois: GALE_MOIS, prix: prix, grilleDeces: GRILLE_DECES, capitauxDeces: CAPITAUX_DECES, rentesDependance: RENTES_DEPENDANCE, capitauxObseques: CAPITAUX_OBSEQUES, catTaux: CAT_TAUX, catMin: CAT_MIN, produits: PRODUITS, parId: PAR_ID, tauxNewsletter: TAUX_NEWSLETTER, tauxEvolutif: TAUX_EVOLUTIF, plafond: PLAFOND, plafondLEP: plafondLEP, mobile: MOBILE, abonnement: abonnement, mensualiteForfait: mensualiteForfait, prixEsim: prixEsim, packBox: PACK_BOX };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.produits = api; }
})(typeof window !== "undefined" ? window : null);
