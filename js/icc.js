/* GS Banque & Assurance – Indice de Commercialité Client (ICC).
   Notation interne de la banque qui mesure le taux d'équipement d'un client à GS (et non son risque : la note Bâle s'en charge).
   Cinq niveaux, du plus faible au plus élevé :
     rouge  : salaire non domicilié et/ou compte non équipé ;
     orange : salaire domicilié et compte partiellement équipé (banque au quotidien OU épargne) ;
     jaune  : salaire domicilié, compte équipé (banque au quotidien ET épargne), sans assurance ;
     vert   : salaire domicilié, compte équipé, au moins 1 assurance ;
     vert+  : salaire domicilié, compte équipé, au moins 2 assurances et client sociétaire.
   Ce module est pur (aucun accès à la page) : il classe des « faits » { salaire, quotidien, epargne, assurances, societaire }.
   Deux fonctions les déduisent des données : depuisClient (fiche client 360, contrats souscrits pendant l'exercice compris) et depuisDossier (dossier d'un outil d'état débiteur). */
(function (root) {
  "use strict";

  /* ---------- les niveaux ---------- */
  var NIVEAUX = [
    { code: "rouge", rang: 0, nom: "Rouge", lib: "ICC rouge", classe: "icc-rouge",
      def: "Salaire non domicilié et/ou compte non équipé.",
      lecture: "Le client n'a pas fait de GS sa banque principale, ou son compte ne porte aucun produit d'usage ni d'épargne.",
      action: "Obtenir la domiciliation du salaire et équiper le compte (carte bancaire, livret)." },
    { code: "orange", rang: 1, nom: "Orange", lib: "ICC orange", classe: "icc-orange",
      def: "Salaire domicilié et compte partiellement équipé (banque au quotidien ou épargne).",
      lecture: "Le salaire arrive à GS mais le client n'a que l'un des deux piliers : l'usage quotidien du compte ou l'épargne.",
      action: "Compléter l'autre pilier : carte ou convention de services s'il manque la banque au quotidien, livret ou assurance-vie s'il manque l'épargne." },
    { code: "jaune", rang: 2, nom: "Jaune", lib: "ICC jaune", classe: "icc-jaune",
      def: "Salaire domicilié et compte équipé, sans assurance.",
      lecture: "Le compte est bien équipé en banque au quotidien et en épargne, mais le client n'a aucune assurance à GS.",
      action: "Proposer une première assurance : habitation, automobile, protection de la famille ou prévoyance." },
    { code: "vert", rang: 3, nom: "Vert", lib: "ICC vert", classe: "icc-vert",
      def: "Salaire domicilié et compte équipé, avec au moins 1 assurance.",
      lecture: "Le client est équipé en banque, en épargne et en assurance.",
      action: "Viser une deuxième assurance et proposer de devenir sociétaire (parts sociales)." },
    { code: "vert+", rang: 4, nom: "Vert+", lib: "ICC vert+", classe: "icc-vertplus",
      def: "Salaire domicilié et compte équipé, avec au moins 2 assurances, et client sociétaire.",
      lecture: "Niveau le plus élevé : client entièrement équipé et sociétaire de la banque.",
      action: "Entretenir la relation : bilan régulier, besoins nouveaux (projets, retraite, transmission)." }
  ];
  var PAR_CODE = {}; NIVEAUX.forEach(function (n) { PAR_CODE[n.code] = n; });

  /* ---------- ce qui compte dans chaque rubrique ---------- */
  var CARTES_PAIEMENT = ["VCLA", "VPRE", "PLAT", "WELI", "VJEU", "VELE"];          /* la carte de retrait seule n'est pas de la banque au quotidien */
  var COMPTES_SERVICES = ["JEUNE", "OCF", "DAC"];                                   /* ces comptes incluent une carte et des services */
  var CONVENTIONS = ["CVJ", "CVA", "CVS"];
  var SEUIL_ASSURANCES_VERT = 1, SEUIL_ASSURANCES_VERT_PLUS = 2;

  var DEFINITIONS = [
    ["Salaire domicilié", "Les revenus propres du client (salaire, pension de retraite, règlements de clients pour un indépendant) sont virés sur son compte à GS. Les virements reçus d'une autre banque, les allocations et la participation du conjoint ne comptent pas."],
    ["Banque au quotidien", "Une carte de paiement GS (Visa Classic, Premier, Platinum, Mastercard World Elite, carte jeune), une convention de compte (offre groupée de services), le compte jeune ou l'offre clientèle fragile. La carte de retrait seule ne compte pas."],
    ["Épargne", "Un livret (Livret A, LDDS, LEP, Livret Jeune, Livret Projets), un compte à terme, une assurance-vie, un mandat de gestion, un PEA, un compte-titres, un PER ou un plan d'épargne automatique. Les parts sociales ne comptent pas comme épargne : elles servent à repérer les sociétaires."],
    ["Assurance", "Un contrat d'assurance de personnes ou de biens souscrit à GS : habitation, automobile, deux-roues, camping-car, voiture sans permis, protection de la famille, protection juridique, prévoyance, décès, dépendance, obsèques. L'assurance-vie est de l'épargne ; l'assurance d'un prêt n'est pas comptée."],
    ["Sociétaire", "Le client détient des parts sociales de GS Banque & Assurance."]
  ];

  /* ---------- la règle ---------- */
  /* faits : { salaire: bool, quotidien: bool, epargne: bool, assurances: nombre, societaire: bool } */
  function classer(faits) {
    var f = {
      salaire: !!faits.salaire, quotidien: !!faits.quotidien, epargne: !!faits.epargne,
      assurances: Math.max(0, parseInt(faits.assurances, 10) || 0), societaire: !!faits.societaire
    };
    var equipe = f.quotidien && f.epargne, nonEquipe = !f.quotidien && !f.epargne, code;
    if (!f.salaire || nonEquipe) code = "rouge";
    else if (!equipe) code = "orange";
    else if (f.assurances < SEUIL_ASSURANCES_VERT) code = "jaune";
    else if (f.assurances >= SEUIL_ASSURANCES_VERT_PLUS && f.societaire) code = "vert+";
    else code = "vert";
    var niveau = PAR_CODE[code];
    return { code: code, rang: niveau.rang, niveau: niveau, faits: f, criteres: criteres(f), pourProgresser: pourProgresser(code, f) };
  }

  /* Les critères lus un par un : { lib, ok, detail } */
  function criteres(f) {
    return [
      { cle: "salaire", lib: "Salaire domicilié", ok: f.salaire, detail: f.salaire ? "Les revenus du client sont virés à GS." : "Pas de salaire (ou de revenu principal) domicilié à GS." },
      { cle: "quotidien", lib: "Banque au quotidien", ok: f.quotidien, detail: f.quotidien ? "Carte de paiement ou convention de compte." : "Aucune carte de paiement ni convention de compte." },
      { cle: "epargne", lib: "Épargne", ok: f.epargne, detail: f.epargne ? "Au moins un produit d'épargne à GS." : "Aucun produit d'épargne à GS." },
      { cle: "assurances", lib: "Assurance", ok: f.assurances >= SEUIL_ASSURANCES_VERT, detail: f.assurances === 0 ? "Aucune assurance à GS." : f.assurances === 1 ? "1 assurance à GS." : f.assurances + " assurances à GS." },
      { cle: "societaire", lib: "Sociétaire", ok: f.societaire, detail: f.societaire ? "Détient des parts sociales." : "Ne détient pas de parts sociales." }
    ];
  }

  /* Ce qu'il manque pour atteindre le niveau suivant. */
  function pourProgresser(code, f) {
    var l = [];
    if (code === "rouge") {
      if (!f.salaire) l.push("Obtenir la domiciliation du salaire (ou du revenu principal) à GS.");
      if (!f.quotidien && !f.epargne) l.push("Équiper le compte : une carte de paiement ou une convention de compte, et un produit d'épargne.");
      else if (!f.quotidien) l.push("Ajouter la banque au quotidien : carte de paiement ou convention de compte.");
      else if (!f.epargne) l.push("Ajouter un produit d'épargne : livret, assurance-vie…");
    } else if (code === "orange") {
      if (!f.quotidien) l.push("Ajouter la banque au quotidien : carte de paiement ou convention de compte.");
      if (!f.epargne) l.push("Ajouter un produit d'épargne : livret, assurance-vie…");
    } else if (code === "jaune") {
      l.push("Proposer une première assurance : habitation, automobile, protection de la famille, prévoyance…");
    } else if (code === "vert") {
      if (f.assurances < SEUIL_ASSURANCES_VERT_PLUS) l.push("Proposer une deuxième assurance.");
      if (!f.societaire) l.push("Proposer de devenir sociétaire (parts sociales).");
    }
    return l;
  }

  /* ---------- lecture des données ---------- */
  var PLACEMENTS_EPARGNE = ["AV", "AVP", "AVE", "MGS", "MGE", "MGD", "PEA", "PEAJ", "PEAPME", "PER", "CTO", "AUTZ"];
  var REVENUS_DOMICILIES = ["salaire", "clients", "pension", "pension2", "reversion"];   /* même convention que le moteur d'éligibilité */

  function nombreAssurances(c) {
    var vus = {}; (c.ass || []).forEach(function (a) { vus[a.p] = true; });
    return Object.keys(vus).length;
  }
  /* Fiche client 360 : c doit être le client « augmenté » des contrats souscrits dans l'exercice (catalogue.contexte(c, store)). */
  function faitsClient(c) {
    var rev = (c.m && c.m.rev || []).reduce(function (t, l) { return t + (REVENUS_DOMICILIES.indexOf(l.k) >= 0 ? l.m : 0); }, 0);
    var carte = (c.cartes || []).some(function (x) { return CARTES_PAIEMENT.indexOf(x.p) >= 0; });
    var conv = !!c.conv && CONVENTIONS.indexOf(c.conv) >= 0;
    var compte = !!(c.cpt && COMPTES_SERVICES.indexOf(c.cpt.p) >= 0);
    var epargne = (c.epa || []).length > 0 || (c.plc || []).some(function (x) { return PLACEMENTS_EPARGNE.indexOf(x.p) >= 0; });
    var soc = (c.plc || []).some(function (x) { return x.p === "PSOC"; });
    return { salaire: rev > 0, quotidien: carte || conv || compte, epargne: epargne, assurances: nombreAssurances(c), societaire: soc };
  }
  function depuisClient(c, st) {
    var K = root && root.SGBF ? root.SGBF.catalogue : null;
    if (!K) { try { K = require("./catalogue.js"); } catch (e) { K = null; } }
    var aug = K && K.contexte ? K.contexte(c, st) : c;
    return classer(faitsClient(aug));
  }

  /* Dossier d'un outil d'état débiteur : le client est décrit par du texte (revenusNote, produits). */
  var RE_SALAIRE = /domicili|pension de retraite|alternance|prime d'activit/i;
  var RE_CARTE = /^Carte |Offre clientèle fragile|Services bancaires de base|Compte jeune|Convention/i;
  var RE_EPARGNE = /Livret|Plan d'épargne|Assurance-vie|PEA|PER\b|Compte à terme|Compte-titres|Mandat/i;
  var RE_ASSURANCE = /^Assurance (?!-?vie|emprunteur)|Garantie des accidents|Protection (famille|juridique)|Prévoyance|Assurance décès|Obsèques|Dépendance/i;
  var RE_SOCIETAIRE = /Parts sociales|sociétaire/i;
  function faitsDossier(client) {
    var p = client.produits || [];
    return {
      salaire: RE_SALAIRE.test(client.revenusNote || ""),
      quotidien: p.some(function (x) { return RE_CARTE.test(x); }),
      epargne: p.some(function (x) { return RE_EPARGNE.test(x); }),
      assurances: p.filter(function (x) { return RE_ASSURANCE.test(x); }).length,
      societaire: p.some(function (x) { return RE_SOCIETAIRE.test(x); })
    };
  }
  function depuisDossier(d) { return classer(faitsDossier(d.client || d)); }

  /* Enrichissement des dossiers générés chaque jour : le tirage ne passe pas par le générateur aléatoire du jour (il ne décale donc rien) mais par une empreinte du numéro de compte.
     Répartition visée parmi les clients « ordinaires » : environ 1 sur 3 a une assurance, 1 sur 8 deux assurances, et un client sur 12 est sociétaire. */
  function empreinte(t) { var h = 2166136261; t = String(t); for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function completerProduits(client, graine) {
    if (!client || !client.produits || client.fragile) return client;
    if (client.produits.some(function (x) { return /Services bancaires de base/.test(x); })) return client;
    var h = empreinte((graine || "") + "|" + client.compte), a = h % 100, b = (h >>> 8) % 100, c = (h >>> 16) % 100, d = (h >>> 24) % 100;
    var p = client.produits;
    if (a < 34 && !p.some(function (x) { return RE_ASSURANCE.test(x); })) p.push((client.age || 40) >= 24 && b < 40 ? "Assurance automobile GS Auto" : "Assurance habitation GS Habitat");
    if (a < 13) p.push(p.some(function (x) { return /habitation/i.test(x); }) ? "Assurance automobile GS Auto" : "Assurance habitation GS Habitat");
    if (c < 30 && !p.some(function (x) { return RE_EPARGNE.test(x); })) p.push("Livret A");
    if (d < 8 && p.some(function (x) { return RE_ASSURANCE.test(x); })) p.push("Parts sociales GS Banque & Assurance");
    return client;
  }

  var api = {
    NIVEAUX: NIVEAUX, PAR_CODE: PAR_CODE, DEFINITIONS: DEFINITIONS, classer: classer, criteres: criteres, pourProgresser: pourProgresser,
    faitsClient: faitsClient, depuisClient: depuisClient, faitsDossier: faitsDossier, depuisDossier: depuisDossier, completerProduits: completerProduits
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.icc = api; }
})(typeof window !== "undefined" ? window : null);
