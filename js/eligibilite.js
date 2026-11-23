/* GS Banque & Assurance – éligibilité d'un client à un produit du catalogue.
   Chaque règle traduit en test sur le dossier une condition écrite dans la fiche du produit (js/produits.js). Les conditions qui ne se vérifient pas
   dans un dossier (pièces d'identité, fichiers FCC et FICP, questionnaires, dépôt minimum…) sont listées « à vérifier avec le client » et ne changent pas le verdict.
   Verdicts : « detenu » (déjà détenu à GS Banque & Assurance), « non » (une condition vérifiable n'est pas remplie), « examiner » (aucune condition n'est refusée mais
   une ne peut pas être tranchée par l'outil), « eligible » (toutes les conditions vérifiables sont remplies).
   Tout est calculé à la date de l'exercice (âge, ancienneté, plafonds du jour). */
(function (root) {
  "use strict";

  var B = root && root.SGBF ? root.SGBF.banque : require("./banque.js");
  var PR = root && root.SGBF ? root.SGBF.produits : require("./produits.js");
  var S = root && root.SGBF ? root.SGBF.synthese : require("./synthese.js");

  var VERDICTS = { eligible: "Éligible", examiner: "À examiner", non: "Non éligible", detenu: "Déjà détenu" };
  var DECOUV_MAX = 2000; /* autorisation de découvert GS : 100 € à 2 000 €, sans dépasser 50 % des revenus nets mensuels versés sur le compte (règle de la banque) */
  var HCSF_TAUX = 35; /* taux d'effort maximal, assurance comprise (HCSF, maintenu le 15/09/2026 – notes/reperes_reels.md) */
  var REVENUS_DOMICILIES = ["salaire", "clients", "pension", "pension2", "reversion"]; /* revenus propres du client virés sur son compte à GS (hors aides, participation du conjoint, virements depuis une autre banque) */

  function e2(n) { return Math.abs(n - Math.round(n)) < 1e-9 ? B.eur(n) : B.eur2(n); }
  function pl(n, s, p) { return B.nb(n) + " " + (n > 1 ? p : s); }
  function ligne(ok, lib, detail, info) { return { ok: ok, lib: lib, detail: detail || "", info: !!info }; }

  /* ---------- mesures sur le dossier ---------- */
  /* Détention à GS Banque & Assurance : un crédit d'une autre banque (ext) ne compte pas ; le compte courant et les cartes sont lus dans leur rubrique. */
  var CARTES_PAIEMENT = ["VCLA", "VPRE", "PLAT", "WELI", "VJEU", "VELE"];
  var CONVENTIONS = ["CVJ", "CVA", "CVS"], MANDATS = ["MGS", "MGE", "MGD"], CONTRATS_VIE = ["AV", "AVP"];
  var TITRES_PARTS = ["CTO", "PEA", "PEAJ"], TITRES_PLAN = ["CTO", "PEA", "PEAJ", "PEAPME"];
  function enfantsMineurs(c) { return (c.fam.enf || []).filter(function (e) { return e.age < 18; }); }
  function enfantCouvert(c, e) { return c.plc.some(function (x) { return x.p === "AVE" && x.enfant === e.prenom; }); }
  /* Convention des 12-17 ans : une par enfant, souscrite par le représentant légal. Les enfants couverts sont ceux que l'élève a fait souscrire (c.convEnfants, voir catalogue.contexte). */
  function enfantsJunior(c) { return (c.fam.enf || []).filter(function (e) { return e.age >= 12 && e.age < 18; }); }
  function enfantAvecConvention(c, e) { return (c.convEnfants || []).indexOf(e.prenom) >= 0; }
  function detient(c, id) {
    if (id === "CVM") { var j = enfantsJunior(c); return j.length > 0 && j.every(function (e) { return enfantAvecConvention(c, e); }); }   /* une convention par enfant de 12 à 17 ans */
    if (c.conv === id) return true;                                   /* convention de compte (offre groupée de services) */
    if (id === "GALE") return !!c.alertes || CONVENTIONS.indexOf(c.conv) >= 0;   /* GS Alertes : abonnement souscrit, ou compris dans la convention de compte */
    if (id === "GCON") return !!c.connect || CONVENTIONS.indexOf(c.conv) >= 0;   /* GS Connect : abonnement souscrit, ou compris dans la convention de compte (Avenir, Horizon, Sérénité) */
    if (id === "AVE") { var m = enfantsMineurs(c); return m.length > 0 && m.every(function (e) { return enfantCouvert(c, e); }); }   /* un contrat par enfant mineur */
    if (id === "ESIM") return false;                                    /* l'eSIM voyage s'achète à chaque voyage : jamais « déjà détenue » */
    if ((c.telecom || []).some(function (e) { return e.p === id; })) return true;   /* mobile et internet : seulement ce que l'élève a fait souscrire (« mob » est déjà le téléphone mobile du client) */
    if (id === "DECOUV") return (c.cpt.dec || 0) > 0;                   /* autorisation de découvert en cours sur le compte courant */
    if (c.cpt.p === id) return true;
    if (c.epa.some(function (e) { return e.p === id; }) || c.plc.some(function (e) { return e.p === id; }) || c.cartes.some(function (e) { return e.p === id; })) return true;
    if (c.cre.some(function (e) { return e.p === id && !e.ext; })) return true;
    return c.ass.some(function (e) { return e.p === id; });
  }
  function revenusDomicilies(c) {
    return c.m.rev.reduce(function (t, l) { return t + (REVENUS_DOMICILIES.indexOf(l.k) >= 0 ? l.m : 0); }, 0);
  }
  /* Mensualités de crédit en cours (crédits d'autres banques compris : le client les a déclarés) et taux d'endettement actuel sur les revenus du foyer. */
  /* Charge mensuelle des crédits en cours (toutes banques), assurance emprunteur comprise comme dans le calcul du HCSF et dans l'onglet Crédits de la fiche client. */
  function mensualites(c) { return c.cre.reduce(function (t, x) { return t + (B.echeancesPayees(x) < x.dur ? x.mens + (x.assM || 0) : 0); }, 0); }
  function tauxEndettement(c) { var r = c.pro.foyer || 0; return r ? 100 * mensualites(c) / r : 0; }
  function margeMensuelle(c) { return Math.max(0, HCSF_TAUX / 100 * (c.pro.foyer || 0) - mensualites(c)); }
  /* « Revenus stables » : traduction de la situation professionnelle (convention de l'exercice, voir le README). */
  function revenusStables(c) {
    var st = c.pro.statut, ctr = c.pro.ctr || "", lib = S.LIB_STATUT[st] || st;
    if (st === "retraite") return ligne(true, "Revenus stables", "Retraité(e) : pension de " + B.eur(c.pro.rev) + " par mois.");
    if (st === "fonctionnaire" && /Titulaire/.test(ctr)) return ligne(true, "Revenus stables", "Fonctionnaire titulaire.");
    if (st === "salarie" && ctr === "CDI") return ligne(true, "Revenus stables", "Salarié(e) en CDI, ancienneté " + pl(c.pro.anc || 0, "an", "ans") + ".");
    if (st === "salarie") return ligne(null, "Revenus stables", "Salarié(e) en " + ctr + " : la stabilité est à apprécier.");
    if (st === "fonctionnaire") return ligne(null, "Revenus stables", "Fonctionnaire contractuel(le) : la stabilité est à apprécier.");
    if (st === "independant") return ligne(null, "Revenus stables", "Travailleur indépendant depuis " + pl(c.pro.anc || 0, "an", "ans") + " : bilans à examiner.");
    if (st === "apprenti") return ligne(null, "Revenus stables", "Apprenti(e) : rémunération limitée à la durée du contrat.");
    if (st === "chomage") return ligne(false, "Revenus stables", "Demandeur d'emploi : pas de revenus du travail réguliers.");
    if (st === "etudiant") return ligne(false, "Revenus stables", "Étudiant(e) : pas de revenus du travail réguliers.");
    if (st === "foyer") return c.fam.conj && c.fam.conj.rev > 0 ? ligne(null, "Revenus stables", "Sans activité professionnelle : revenus du conjoint à examiner.") : ligne(false, "Revenus stables", "Sans activité professionnelle et sans revenu dans le foyer.");
    return ligne(null, "Revenus stables", lib + " : à apprécier.");
  }
  function ageEntre(c, min, max, lib) {
    var ok = c.age >= min && c.age <= max;
    return ligne(ok, lib, c.age + " ans" + (ok ? "." : " : hors de la tranche " + min + " à " + max + " ans."));
  }
  function majeur(c) { return ligne(c.age >= 18, "Être majeur", c.age + " ans."); }
  function france(c) { return ligne(true, "Résider en France", "Domicilié(e) à " + c.adr.ville + " (" + c.adr.cp + ")."); }
  /* Client inscrit au FICP à l'ouverture de son compte (dossier d'ouverture : c.restr.credit) : ni découvert autorisé ni crédit renouvelable. Aucune ligne pour les autres clients. */
  function ficpOuvert(c) { return c.restr && c.restr.credit ? [ligne(false, "Absence de fichage au FICP", "Le client est inscrit au FICP (consultation de la Banque de France à l'ouverture du compte) : ni découvert autorisé ni crédit renouvelable.")] : []; }
  /* Client inscrit au FCC à l'ouverture de son compte (dossier d'ouverture : c.restr.cheque) : pas de chéquier et pas de prêt. Aucune ligne pour les autres clients. */
  function fccOuvert(c) { return c.restr && c.restr.cheque ? [ligne(false, "Absence d'inscription au FCC", "Le client est interdit bancaire, inscrit au FCC (consultation de la Banque de France à l'ouverture du compte) : ni chéquier ni prêt.")] : []; }
  function endettementInfo(c) {
    return ligne(null, "Endettement actuel", "Mensualités de crédit, assurance comprise : " + B.eur(mensualites(c)) + " par mois, soit " + B.pct(Math.round(tauxEndettement(c) * 10) / 10) + " des revenus du foyer (" + B.eur(c.pro.foyer) + ").", true);
  }

  /* ---------- à vérifier avec le client (ne change pas le verdict) ---------- */
  var VERIF = {
    identite: "Pièce d'identité en cours de validité et justificatif de domicile.",
    fcc: "Absence d'inscription au fichier central des chèques (FCC) et d'interdiction bancaire.",
    ficp: "Consultation du fichier des incidents de remboursement des crédits aux particuliers (FICP).",
    absenceFicp: "Absence de fichage au FICP (fichier des incidents de remboursement des crédits aux particuliers) : à vérifier par une consultation de la Banque de France (outil Interro BDF).",
    unique: "Déclaration du client : il ne possède pas déjà ce produit dans un autre établissement (un seul par personne).",
    rattache: "Déclaration du client : il n'est pas rattaché au foyer fiscal de ses parents (imposition séparée) ; sinon il ne peut pas ouvrir ce livret.",
    questionnaire: "Questionnaire de connaissance et d'expérience avant tout investissement en unités de compte ou en titres.",
    sante: "Questionnaire de santé, à remplir avec le client lors de la souscription.",
    santeSimple: "Questionnaire de santé simplifié, à remplir avec le client lors de la souscription."
  };
  function depot(min) { return "Dépôt ou versement initial d'au moins " + B.eur(min) + "."; }

  /* ---------- règles par produit : { verif: [...conditions vérifiables], aVerifier: [...] } ---------- */
  var REGLES = {
    CPT: function (c) { return { verif: [majeur(c), ligne(null, "Compte actuel", PR.parId[c.cpt.p].nom + (c.cpt.p === "JEUNE" ? " : passage au compte Équilibre à prévoir au plus tard à 26 ans." : c.cpt.p === "OCF" ? " : l'offre clientèle fragile se poursuit tant que le client en relève." : "."), true)], aVerifier: [VERIF.identite, VERIF.fcc, "Autorisation de découvert : étude du dossier et de la capacité de remboursement."] }; },
    JEUNE: function (c) { return { verif: [ageEntre(c, 18, 25, "Avoir entre 18 et 25 ans")], aVerifier: ["Justificatif d'études, d'apprentissage ou d'activité conseillé pour l'octroi d'un découvert."] }; },
    OCF: function (c) {
      var n = c.inc.length;
      return { verif: [ligne(null, "Fragilité financière", n ? pl(n, "incident de fonctionnement recensé", "incidents de fonctionnement recensés") + " dans le dossier." : "Aucun incident de fonctionnement recensé : la fragilité éventuelle se détecte avec le client.")], aVerifier: ["Situation de fragilité détectée par la banque (incidents de paiement répétés, surendettement…) ou demande du client."] };
    },
    /* Convention de droit au compte : réservée à une personne sans compte de dépôt, désignée par la Banque de France ; elle s'applique à l'ouverture du compte (dossier d'ouverture de compte). */
    DAC: function (c) {
      return { verif: [majeur(c), ligne(false, "Aucun compte de dépôt en France", "Le client détient déjà un compte à l'agence : le droit au compte ne s'applique pas.")],
        aVerifier: ["Désignation de la Banque de France (ou attestation de refus d'une autre banque).", "Déclaration sur l'honneur : le demandeur ne détient aucun compte de dépôt en France."] };
    },
    VCLA: function (c) {
      var ok = c.cpt.p === "CPT" || c.cpt.p === "JEUNE";
      return { verif: [majeur(c), ligne(ok, "Compte courant Équilibre ou compte Jeune", PR.parId[c.cpt.p].nom + (ok ? "." : " : cette offre a sa propre carte."))], aVerifier: ["Absence d'incident de paiement grave."] };
    },
    VPRE: function (c) {
      var dom = revenusDomicilies(c), sans = !c.inc.some(function (i) { return i.j <= 365; });
      return { verif: [
        dom >= 2000 ? ligne(true, "Revenus nets d'au moins 2 000 € par mois domiciliés à GS", "Revenus domiciliés : " + B.eur(dom) + " par mois.")
          : ligne(null, "Revenus nets d'au moins 2 000 € par mois domiciliés à GS", "Revenus domiciliés : " + B.eur(dom) + " par mois, en dessous du seuil. La fiche prévoit aussi un « encours d'épargne suffisant » dont le seuil n'est pas fixé : à examiner."),
        ligne(sans, "Compte fonctionnant sans incident", sans ? "Aucun incident de fonctionnement sur les 12 derniers mois (règle de l'agence)." : "Incident de fonctionnement sur les 12 derniers mois.")
      ], aVerifier: [] };
    },
    VJEU: function (c) { var ok = c.cpt.p === "JEUNE" || c.conv === "CVJ"; return { verif: [ageEntre(c, 18, 25, "Avoir entre 18 et 25 ans"), ligne(ok, "Titulaire du compte Jeune ou de la convention Avenir", PR.parId[c.cpt.p].nom + (ok ? (c.conv === "CVJ" ? ", avec la convention GS Avenir." : ".") : " : la carte est réservée au compte Jeune et à la convention GS Avenir."))], aVerifier: [] }; },
    /* Carte à contrôle de solde (Visa Electron) : majeur, compte courant (Équilibre, Jeune ou offre clientèle fragile) ; ni revenus ni ancienneté exigés. Elle peut remplacer une carte à débit différé. */
    VELE: function (c) {
      var ok = c.cpt.p === "CPT" || c.cpt.p === "JEUNE" || c.cpt.p === "OCF", det = c.cartes.filter(function (x) { return CARTES_PAIEMENT.indexOf(x.p) >= 0 && x.p !== "VELE"; });
      return { verif: [majeur(c), ligne(ok, "Compte courant Équilibre, compte Jeune ou offre clientèle fragile", PR.parId[c.cpt.p].nom + (ok ? "." : " : cette offre a sa propre carte.")),
        det.length ? ligne(null, "Carte actuelle", "Le client détient " + PR.parId[det[0].p].nom + " : la carte à contrôle de solde la remplace (résiliation de la carte actuelle à prévoir).", true) : ligne(null, "Carte actuelle", "Aucune carte de paiement détenue.", true)],
        aVerifier: ["Le client a compris que chaque paiement est refusé si le solde est insuffisant, et que certains commerçants (location de véhicule, hôtel) peuvent la refuser.", "Si le client est en incident de paiement ou interdit bancaire : la décision de lui remettre une carte appartient à la banque."] };
    },
    CRET: function () { return { verif: [ligne(true, "Titulaire d'un compte courant", "Compte courant ouvert.")], aVerifier: ["Clients interdits bancaires ou qui ne souhaitent pas de carte de paiement : à confirmer avec le client."] }; },
    LA: function () { return { verif: [], aVerifier: [VERIF.unique, depot(10)] }; },
    LDDS: function (c) { return { verif: [ligne(c.age >= 18, "Avoir 18 ans révolus", c.age + " ans."), france(c)], aVerifier: [VERIF.unique, VERIF.rattache, depot(10)] }; },
    LEP: function (c) {
      var plaf = PR.plafondLEP(c.pro.parts), part = String(c.pro.parts).replace(".", ",") + (c.pro.parts > 1 ? " parts" : " part");
      return { verif: [majeur(c), ligne(c.rfr <= plaf, "Revenu fiscal de référence inférieur ou égal au plafond", "Revenu fiscal de référence : " + B.eur(c.rfr) + " ; plafond pour " + part + " : " + B.eur(plaf) + ".")], aVerifier: [VERIF.unique, VERIF.rattache, depot(30), "Avis d'imposition de l'avant-dernière année."] };
    },
    LJ: function (c) { return { verif: [ageEntre(c, 12, 25, "Avoir entre 12 et 25 ans"), france(c)], aVerifier: [VERIF.unique, depot(10)] }; },
    LBR: function (c) { return { verif: [majeur(c)], aVerifier: [depot(100)] }; },
    AV: function (c) { return { verif: [majeur(c)], aVerifier: [depot(500), VERIF.questionnaire] }; },
    PEA: function (c) { return { verif: [majeur(c), ligne(true, "Domicilié fiscalement en France", "Domicilié(e) à " + c.adr.ville + ".")], aVerifier: [VERIF.unique, depot(300), VERIF.questionnaire] }; },
    PER: function (c) { return { verif: [majeur(c)], aVerifier: [depot(300), VERIF.questionnaire] }; },
    CIMMO: function (c) {
      var t = tauxEndettement(c), marge = margeMensuelle(c);
      return { verif: [
        majeur(c)].concat(fccOuvert(c), [
        ligne(t < HCSF_TAUX, "Taux d'endettement avant projet inférieur à " + HCSF_TAUX + " %", "Mensualités de crédit, assurance comprise : " + B.eur(mensualites(c)) + " par mois, soit " + B.pct(Math.round(t * 10) / 10) + " des revenus du foyer (" + B.eur(c.pro.foyer) + ")."),
        revenusStables(c),
        ligne(null, "Marge d'endettement", "Mensualité supplémentaire possible, assurance comprise : " + B.eur(marge) + " par mois au maximum (" + HCSF_TAUX + " % des revenus du foyer moins les mensualités en cours, assurance comprise). Durée maximale : 25 ans.", true)
      ]), aVerifier: [VERIF.ficp, "Apport personnel conseillé d'au moins 10 % du prix.", "Compromis de vente ou devis de construction."] };
    },
    CCONSO: function (c) { return { verif: [majeur(c)].concat(fccOuvert(c), [revenusStables(c), endettementInfo(c)]), aVerifier: [VERIF.ficp, "Montant de 1 500 € à 75 000 € ; durée de 12 à 84 mois."] }; },
    DECOUV: function (c) {
      var rd = revenusDomicilies(c);
      return { verif: [majeur(c)].concat(ficpOuvert(c), [ligne(rd > 0, "Revenus domiciliés à GS", rd > 0 ? "Revenus domiciliés : " + B.eur(rd) + " par mois, soit une autorisation de " + B.eur(Math.min(DECOUV_MAX, Math.floor(rd / 2))) + " au plus." : "Aucun revenu domicilié à GS : pas de capacité de remboursement visible."), endettementInfo(c)]),
        aVerifier: [VERIF.absenceFicp, "Montant de 100 € à 2 000 €, sans dépasser 50 % des revenus nets mensuels versés sur le compte.", "Avenant à la convention de compte (durée déterminée ou indéterminée) et fiche d'information précontractuelle remise au client."] };
    },
    CREV: function (c) {
      var rd = revenusDomicilies(c);
      return { verif: [majeur(c)].concat(ficpOuvert(c), [ligne(rd > 0, "Revenus domiciliés à GS", rd > 0 ? "Revenus domiciliés : " + B.eur(rd) + " par mois." : "Aucun revenu domicilié à GS : pas de capacité de remboursement visible."), endettementInfo(c)]), aVerifier: [VERIF.absenceFicp, "Réserve de 500 € à 6 000 € ; au-delà de 1 000 €, offre de crédit amortissable remise pour comparaison.", "Solvabilité vérifiée (revenus et charges) et fiche d'information précontractuelle remise au client."] }; },
    CAUTO: function (c) { return { verif: [majeur(c)].concat(fccOuvert(c), [revenusStables(c), endettementInfo(c), ligne(null, "Véhicule actuel", c.veh ? "Un véhicule est repéré dans le dossier (assurance automobile en cours)." : "Aucun véhicule repéré dans le dossier.", true)]), aVerifier: ["Bon de commande ou facture du véhicule.", "Montant de 3 000 € à 50 000 € ; durée de 12 à 84 mois."] }; },
    CTRAV: function (c) {
      var h = c.log.st === "heberge";
      return { verif: [majeur(c)].concat(fccOuvert(c), [revenusStables(c), endettementInfo(c), ligne(h ? null : true, "Propriétaire ou locataire", S.LIB_LOGEMENT[c.log.st] + (h ? " : le propriétaire du logement doit autoriser les travaux." : "."))]), aVerifier: ["Devis ou factures des travaux.", "Montant de 2 000 € à 75 000 € ; durée de 12 à 120 mois."] };
    },
    MRH: function (c) {
      var h = c.log.st === "heberge", ext = c.m.fx.some(function (x) { return x.t === "mrh_ext"; });
      return { verif: [ligne(h ? null : true, "Résider dans le logement assuré", S.LIB_LOGEMENT[c.log.st] + (h ? " : l'assurance de la personne qui héberge peut déjà couvrir le client." : ".")),
        ligne(null, "Assurance habitation ailleurs", ext ? "Un prélèvement d'assurance habitation d'un autre assureur est repéré sur le compte." : "Aucun prélèvement d'assurance habitation externe repéré sur le compte.", true)],
        aVerifier: ["Questionnaire de risque : surface, nombre de pièces, valeur du mobilier."] };
    },
    AUTO: function (c) {
      var ext = c.m.fx.some(function (x) { return x.t === "auto_ext"; });
      return { verif: [ligne(!!c.veh, "Propriétaire d'un véhicule terrestre à moteur", c.veh ? "Un véhicule est repéré dans le dossier (assurance automobile en cours)." : "Aucun véhicule repéré dans le dossier."),
        ligne(null, "Assurance automobile ailleurs", ext ? "Un prélèvement d'assurance automobile d'un autre assureur est repéré sur le compte." : "Aucun prélèvement d'assurance automobile externe repéré sur le compte.", true)],
        aVerifier: ["Carte grise et permis de conduire en cours de validité.", "Relevé d'information de l'assureur précédent."] };
    },
    GAV: function (c) { return { verif: [majeur(c)], aVerifier: [VERIF.santeSimple] }; },
    PREV: function (c) {
      var charges = c.fam.nbCharge > 0 || c.cre.some(function (x) { return !x.ext; });
      return { verif: [ageEntre(c, 18, 65, "Avoir entre 18 et 65 ans"),
        ligne(null, "Proches à charge ou crédit en cours", (c.fam.nbCharge ? pl(c.fam.nbCharge, "personne à charge", "personnes à charge") : "Aucune personne à charge") + (c.cre.some(function (x) { return !x.ext; }) ? ", crédit en cours chez GS." : ", aucun crédit en cours chez GS.") + (charges ? "" : " Le besoin est à confirmer."), true)],
        aVerifier: [VERIF.sante] };
    }
  };

  /* ---------- produits ajoutés à l'étape 5 ---------- */
  function nomsDetenus(c, ids) { return ids.filter(function (i) { return detient(c, i); }).map(function (i) { return PR.parId[i].nom; }); }
  function encours(c) { return c.epa.concat(c.plc).reduce(function (t, x) { return t + (x.solde || 0); }, 0); }
  function sansIncident(c) { return !c.inc.some(function (i) { return i.j <= 365; }); }

  /* Conventions de compte : tranche d'âge, compte courant, une seule convention, carte incluse, économie par rapport aux services pris à l'unité. */
  function regleConvention(id) {
    return function (c) {
      var p = PR.parId[id], cv = p.convention, autre = CONVENTIONS.filter(function (i) { return i !== id && detient(c, i); });
      var compteOk = id === "CVJ" ? (c.cpt.p === "CPT" || c.cpt.p === "JEUNE") : c.cpt.p === "CPT";
      var ageLib = cv.ageMax >= 120 ? "Avoir " + cv.ageMin + " ans ou plus" : "Avoir entre " + cv.ageMin + " et " + cv.ageMax + " ans";
      var carteDetenue = c.cartes.filter(function (x) { return CARTES_PAIEMENT.indexOf(x.p) >= 0; })[0], nomCarte = PR.parId[cv.carte].nom;
      var ligneCarte = !carteDetenue ? ligne(null, "Carte de la convention", "Aucune carte de paiement détenue : " + nomCarte + " est délivrée avec la convention.", true)
        : carteDetenue.p === cv.carte || (id === "CVJ" && carteDetenue.p === "VJEU") ? ligne(null, "Carte de la convention", "Le client détient déjà " + nomCarte + " : elle est incluse dans la cotisation de la convention.", true)
        : ligne(null, "Carte de paiement", "Le client détient déjà " + PR.parId[carteDetenue.p].nom + ", alors que la convention inclut " + nomCarte + " : à examiner avec le client (changement de carte, ou convention sans la carte incluse).");
      var eco = Math.round((cv.avec[c.cpt.p === "JEUNE" ? "JEUNE" : "CPT"] - cv.cotisationAn) * 100) / 100;
      return { verif: [
        ligne(c.age >= cv.ageMin && c.age <= cv.ageMax, ageLib, c.age + " ans" + (c.age >= cv.ageMin && c.age <= cv.ageMax ? "." : " : hors de la tranche de la convention.")),
        ligne(compteOk, id === "CVJ" ? "Titulaire d'un compte courant Équilibre ou du compte Jeune" : "Titulaire d'un compte courant Équilibre", PR.parId[c.cpt.p].nom + (compteOk ? "." : " : la convention ne s'applique pas à ce compte.")),
        ligne(!autre.length, "Une seule convention de compte par client", autre.length ? "Le client détient déjà " + PR.parId[autre[0]].nom + " : la résilier avant d'en souscrire une autre." : "Aucune convention détenue."),
        ligneCarte,
        detient(c, "MPAY") ? ligne(null, "Assurance des moyens de paiement déjà détenue", "Le client détient déjà GS Assurance moyens de paiement : elle est comprise dans la convention, et sa cotisation séparée est à résilier pour ne pas payer deux fois.", true) : ligne(null, "Assurance des moyens de paiement", "Comprise dans la cotisation de la convention (2,00 € par mois à l'unité).", true),
        c.connect ? ligne(null, "GS Connect déjà souscrit", "Le client a déjà GS Connect : il est compris dans la convention, et l'abonnement séparé (3,00 € par mois) est à résilier pour ne pas payer deux fois.", true) : ligne(null, "GS Connect (banque à distance)", "Compris dans la cotisation de la convention (3,00 € par mois à l'unité).", true),
        c.alertes ? ligne(null, "GS Alertes déjà souscrit", "Le client a déjà GS Alertes : l'alerte de compte est comprise dans la convention, et l'abonnement séparé (1,50 € par mois) est à résilier pour ne pas payer deux fois.", true) : ligne(null, "GS Alertes (alertes par SMS)", "Comprises dans la cotisation de la convention (1,50 € par mois à l'unité).", true),
        ligne(null, "Économie par rapport aux services à l'unité", "Les mêmes services coûtent " + e2(cv.avec[c.cpt.p === "JEUNE" ? "JEUNE" : "CPT"]) + " par an à l'unité, contre " + e2(cv.cotisationAn) + " avec la convention : " + (eco > 0 ? "économie de " + e2(eco) + " par an" : "aucune économie") + " avec son compte actuel.", true)
      ], aVerifier: ["Accord du client pour le prélèvement mensuel de la cotisation sur son compte courant.", "Le client utilise réellement les services inclus (carte, GS Connect, GS Alertes, virements instantanés…) : sinon la convention peut coûter plus cher qu'à l'unité."] };
    };
  }
  /* Cartes haut de gamme : revenus domiciliés ou encours d'épargne, compte sans incident. */
  function regleCarteHG(id, revMin, encMin) {
    return function (c) {
      var dom = revenusDomicilies(c), enc = encours(c), ok = dom >= revMin || enc >= encMin, det = c.cartes.filter(function (x) { return CARTES_PAIEMENT.indexOf(x.p) >= 0 && x.p !== id; });
      return { verif: [majeur(c),
        ligne(ok, "Revenus nets d'au moins " + B.eur(revMin) + " par mois domiciliés à GS, ou encours d'épargne d'au moins " + B.eur(encMin), "Revenus domiciliés : " + B.eur(dom) + " par mois ; encours d'épargne et de placements à GS : " + B.eur(enc) + (ok ? "." : " : aucun des deux seuils n'est atteint.")),
        ligne(sansIncident(c), "Compte fonctionnant sans incident", sansIncident(c) ? "Aucun incident de fonctionnement sur les 12 derniers mois (règle de l'agence)." : "Incident de fonctionnement sur les 12 derniers mois."),
        det.length ? ligne(null, "Carte actuelle", "Le client détient " + PR.parId[det[0].p].nom + " : la nouvelle carte la remplace (résiliation de la carte actuelle à prévoir).", true) : ligne(null, "Carte actuelle", "Aucune autre carte de paiement détenue.", true)
      ], aVerifier: ["Compte non débiteur de façon durable, ni incident de paiement grave."] };
    };
  }
  /* Mandat de gestion pilotée : contrat d'assurance-vie détenu, un seul mandat. */
  function regleMandat(id) {
    return function (c) {
      var vie = nomsDetenus(c, CONTRATS_VIE), autre = MANDATS.filter(function (i) { return i !== id && detient(c, i); });
      return { verif: [majeur(c),
        ligne(vie.length > 0, "Détenir un contrat d'assurance-vie GS Vie Patrimoine ou GS Vie Premium", vie.length ? "Contrat détenu : " + vie.join(", ") + "." : "Aucun contrat d'assurance-vie détenu à GS : en souscrire un avant le mandat."),
        ligne(!autre.length, "Un seul mandat de gestion par contrat", autre.length ? "Le client détient déjà " + PR.parId[autre[0]].nom + " : il peut changer d'orientation sans frais mais ne cumule pas deux mandats." : "Aucun mandat détenu.")
      ], aVerifier: [depot(5000), VERIF.questionnaire, "L'orientation du mandat doit correspondre au profil investisseur du client (rapport de conseil)."] };
    };
  }
  function ouvert(c, ids, lib) {
    var n = nomsDetenus(c, ids);
    return ligne(n.length > 0, lib, n.length ? "Détenu : " + n.join(", ") + "." : "Aucun compte-titres ni PEA détenu à GS : en ouvrir un avant la souscription.");
  }
  REGLES.CVJ = regleConvention("CVJ"); REGLES.CVA = regleConvention("CVA"); REGLES.CVS = regleConvention("CVS");
  REGLES.PLAT = regleCarteHG("PLAT", 3000, 50000); REGLES.WELI = regleCarteHG("WELI", 4500, 100000);
  REGLES.CAT = function (c) { return { verif: [majeur(c)], aVerifier: [depot(PR.catMin), "Durée de placement choisie : 3, 6, 12, 24, 36, 48 ou 60 mois.", "Le client a bien compris que les fonds sont bloqués jusqu'à l'échéance."] }; };
  REGLES.AVP = function (c) { return { verif: [majeur(c), ligne(null, "Encours à GS", "Encours d'épargne et de placements à GS : " + B.eur(encours(c)) + ". Le versement initial de 30 000 € peut venir d'ailleurs.", true)], aVerifier: [depot(30000), "Suivi par un conseiller de clientèle privée.", VERIF.questionnaire] }; };
  REGLES.AVE = function (c) {
    var m = enfantsMineurs(c), libres = m.filter(function (e) { return !enfantCouvert(c, e); });
    return { verif: [majeur(c),
      ligne(m.length > 0, "Représentant légal d'un enfant mineur", m.length ? "Enfant" + (m.length > 1 ? "s mineurs" : " mineur") + " : " + m.map(function (e) { return e.prenom + " (" + e.age + " ans)"; }).join(", ") + "." : "Aucun enfant mineur dans le dossier."),
      ligne(null, "Enfants sans contrat", libres.length ? "Un contrat par enfant : " + libres.map(function (e) { return e.prenom; }).join(", ") + " n'en a pas encore." : "Tous les enfants mineurs ont déjà un contrat.", true)
    ], aVerifier: [depot(100), "Le client est bien le représentant légal de l'enfant (autorité parentale).", VERIF.questionnaire] };
  };
  REGLES.MGS = regleMandat("MGS"); REGLES.MGE = regleMandat("MGE"); REGLES.MGD = regleMandat("MGD");
  REGLES.PEAJ = function (c) {
    var etu = c.pro.statut === "etudiant", ok = c.age >= 18 && (c.age <= 20 || (c.age <= 24 && etu)), pea = detient(c, "PEA");
    return { verif: [
      ligne(ok, "Majeur de moins de 21 ans (moins de 25 ans pour un étudiant)", c.age + " ans" + (etu ? ", étudiant(e)" : "") + (ok ? "." : " : hors des limites d'âge du PEA Jeunes.")),
      ligne(!pea, "Ne pas déjà détenir un PEA", pea ? "Le client détient déjà un PEA : un seul PEA par personne." : "Aucun PEA classique détenu à GS.")
    ], aVerifier: ["Rattachement du client au foyer fiscal de ses parents (dernier avis d'imposition).", VERIF.unique, depot(300), VERIF.questionnaire] };
  };
  REGLES.PEAPME = function (c) { return { verif: [majeur(c), ligne(true, "Domicilié fiscalement en France", "Domicilié(e) à " + c.adr.ville + ".")], aVerifier: ["Un seul PEA-PME-ETI par personne.", depot(500), "Total des versements PEA et PEA-PME-ETI limité à 225 000 €.", VERIF.questionnaire] }; };
  REGLES.CTO = function (c) { return { verif: [majeur(c)], aVerifier: [depot(300), VERIF.questionnaire, "Compte espèces associé : le compte courant du client."] }; };
  REGLES.PSOC = function (c) { return { verif: [majeur(c), ouvert(c, TITRES_PARTS, "Détenir un compte-titres ordinaire, un PEA ou un PEA Jeunes")], aVerifier: ["Souscription minimum : une part (11,40 €) ; maximum : 50 000 € par personne physique.", VERIF.questionnaire, "Le client sait que les parts ne sont pas garanties et que leur cession est soumise à l'agrément du conseil d'administration."] }; };
  REGLES.AUTZ = function (c) { return { verif: [majeur(c), ouvert(c, TITRES_PLAN, "Détenir un compte-titres ordinaire, un PEA, un PEA Jeunes ou un PEA-PME-ETI")], aVerifier: ["Versement programmé minimum : 30 € par mois ou 90 € par trimestre.", VERIF.questionnaire, "Le client a pris connaissance du document d'informations clés du fonds choisi."] }; };
  var peaBase = REGLES.PEA;
  REGLES.PEA = function (c) {
    var x = peaBase(c), j = detient(c, "PEAJ");
    x.verif.push(ligne(!j, "Ne pas détenir un PEA Jeunes", j ? "Le client détient un PEA Jeunes : il devient automatiquement un PEA classique quand le client n'est plus rattaché au foyer fiscal de ses parents." : "Aucun PEA Jeunes détenu."));
    return x;
  };
  REGLES.MOTO = function (c) { return { verif: [majeur(c), ligne(null, "Deux-roues à assurer", c.veh ? "Le dossier mentionne un véhicule (assurance automobile) ; le deux-roues motorisé est à confirmer avec le client." : "Le dossier ne mentionne pas de véhicule ; le deux-roues motorisé est à confirmer avec le client.", true)], aVerifier: ["Carte grise du deux-roues et permis adapté à la cylindrée (AM, A1, A2 ou A).", "Relevé d'information de l'assureur précédent.", "Antivol homologué (garantie vol)."] }; };
  REGLES.CCAR = function (c) { return { verif: [majeur(c), ligne(null, "Camping-car à assurer", "Le dossier ne dit pas si le client possède un camping-car : à confirmer avec le client.", true)], aVerifier: ["Carte grise (véhicule de loisirs) et permis adapté au PTAC (B jusqu'à 3,5 t, C1 au-delà).", "Le véhicule n'est pas la résidence principale du client.", "Relevé d'information de l'assureur précédent."] }; };
  REGLES.VSP = function (c) { return { verif: [majeur(c), ligne(null, "Voiture sans permis à assurer", "Le dossier ne dit pas si le client possède ou conduit une voiture sans permis : à confirmer avec le client.", true)], aVerifier: ["Carte grise de la voiture sans permis.", "Conducteur né depuis 1988 : permis AM (BSR) ou permis B ; conducteur mineur : contrat signé par le représentant légal.", "Relevé d'information de l'assureur précédent."] }; };
  REGLES.GCON = function (c) {
    var conv = CONVENTIONS.indexOf(c.conv) >= 0;
    return { verif: [majeur(c),
      ligne(true, "Titulaire d'un compte courant", PR.parId[c.cpt.p] ? PR.parId[c.cpt.p].nom + "." : "Compte courant."),
      ligne(null, "GS Connect compris dans une convention de compte", conv ? "Le client a " + PR.parId[c.conv].nom + " : GS Connect est compris dans sa cotisation, sans supplément." : "Aucune convention de compte : GS Connect coûte " + PR.gconMois.toFixed(2).replace(".", ",") + " € par mois ; une convention le rend gratuit et exonère les frais de tenue de compte.", true)
    ], aVerifier: ["Un mobile et une adresse e-mail à jour dans le dossier, pour l'envoi des codes de sécurité.", "Le client sait que la banque ne lui demande jamais ses identifiants ni ses codes (hameçonnage).", "Contrat d'abonnement signé ; abonnement résiliable à tout moment, sans frais."] };
  };
  REGLES.GALE = function (c) {
    var conv = CONVENTIONS.indexOf(c.conv) >= 0, mob = c.mob;
    return { verif: [majeur(c),
      ligne(true, "Titulaire d'un compte courant", PR.parId[c.cpt.p] ? PR.parId[c.cpt.p].nom + "." : "Compte courant."),
      ligne(!!mob, "Numéro de mobile dans le dossier", mob ? "Mobile du dossier : " + mob + "." : "Aucun mobile dans le dossier : à demander au client avant la souscription."),
      ligne(null, "GS Alertes comprises dans une convention de compte", conv ? "Le client a " + PR.parId[c.conv].nom + " : l'alerte de compte est comprise dans sa cotisation, sans supplément." : "Aucune convention de compte : GS Alertes coûte " + PR.galeMois.toFixed(2).replace(".", ",") + " € par mois ; une convention les rend gratuites et exonère les frais de tenue de compte.", true)
    ], aVerifier: ["Le numéro de mobile du dossier est celui sur lequel le client veut recevoir les SMS (changement de numéro : à faire au contrat).", "Les seuils d'alerte sont choisis avec le client : solde minimum, et montant à partir duquel un débit est signalé. Ils ne correspondent pas à son découvert autorisé.", "Le client sait que les SMS sont envoyés du mardi au samedi et que la banque ne lui demande jamais ses codes par SMS."] };
  };
  REGLES.APN = function (c) {
    var mrh = detient(c, "MRH");
    return { verif: [majeur(c),
      ligne(null, "Assurance habitation GS", mrh ? "Le client a une assurance habitation GS : remise de " + PR.primes.APN.remise.ess.toFixed(2).replace(".", ",") + " € (formule Essentielle) ou " + PR.primes.APN.remise.plus.toFixed(2).replace(".", ",") + " € (formule Plus) par mois." : "Pas d'assurance habitation GS : pas de remise sur la cotisation.", true)
    ], aVerifier: ["Le client possède au moins un smartphone, une tablette ou un ordinateur portable, dont la facture d'achat est à son nom.", "Usage privé de l'appareil ; l'option usage professionnel est à choisir si le client s'en sert pour son activité.", "Le client sait que la panne, la perte et le vol simple ne sont pas couverts : vérifier la garantie du vendeur, de la carte bancaire et de l'assurance habitation.", "Document d'information sur le produit d'assurance (DIPA) remis avant la souscription."] };
  };
  REGLES.PJ = function (c) { return { verif: [majeur(c)], aVerifier: ["Absence de litige déjà né : la garantie ne couvre que les litiges nés après la souscription et le délai de carence de 3 mois."] }; };
  REGLES.DEP = function (c) { return { verif: [ageEntre(c, 50, 75, "Avoir entre 50 et 75 ans")], aVerifier: [VERIF.sante, "Rente mensuelle choisie : de 500 € à 3 000 €.", "Délais de carence (maladie : 1 an ; maladie neurodégénérative : 3 ans) et franchise de 90 jours expliqués au client."] }; };
  REGLES.DECES = function (c) {
    var prev = detient(c, "PREV"), charges = c.fam.nbCharge > 0 || c.cre.some(function (x) { return !x.ext; });
    return { verif: [ageEntre(c, 18, 65, "Avoir entre 18 et 65 ans"),
      ligne(null, "Proches à charge ou crédit en cours", (c.fam.nbCharge ? pl(c.fam.nbCharge, "personne à charge", "personnes à charge") : "Aucune personne à charge") + (c.cre.some(function (x) { return !x.ext; }) ? ", crédit en cours chez GS." : ", aucun crédit en cours chez GS.") + (charges ? "" : " Le besoin est à confirmer."), true),
      ligne(null, "Garantie décès déjà détenue", prev ? "Le client détient déjà GS Prévoyance (décès et invalidité) : vérifier le besoin d'un capital décès supplémentaire." : "Aucun contrat de prévoyance détenu à GS.", true)],
      aVerifier: [VERIF.sante, "Capital choisi : de 30 000 € à 500 000 €."] };
  };
  REGLES.OBSQ = function (c) { return { verif: [ageEntre(c, 40, 80, "Avoir entre 40 et 80 ans")], aVerifier: [VERIF.santeSimple, "Délai de carence de 12 mois en cas de décès par maladie expliqué au client.", "Capital choisi : de 3 000 € à 15 000 €."] }; };

  /* ---------- assurance des moyens de paiement et convention des 12-17 ans (livraison 6) ---------- */
  REGLES.MPAY = function (c) {
    var carte = c.cartes.length > 0, conv = !!c.conv && CONVENTIONS.indexOf(c.conv) >= 0;
    return { verif: [majeur(c),
      ligne(carte, "Détenir une carte de paiement ou de retrait", carte ? PR.parId[c.cartes[0].p].nom + "." : "Aucune carte détenue : l'assurance protège les cartes et les chéquiers du client."),
      ligne(!conv, "Assurance pas déjà comprise dans une convention de compte", conv ? "Le client a " + PR.parId[c.conv].nom + " : l'assurance des moyens de paiement est déjà comprise dans sa cotisation." : "Aucune convention de compte détenue.")
    ], aVerifier: ["Le conjoint ou partenaire est couvert sans supplément : lui demander s'il détient aussi des cartes dans d'autres banques (formule « plusieurs banques »).", "Le client sait qu'il doit faire opposition sans délai en cas de perte ou de vol, et déposer plainte pour un vol ou une agression.", "Fiche d'information et notice remises avant la souscription (plafonds, délais de déclaration, exclusions)."] };
  };
  REGLES.CVM = function (c) {
    var m = enfantsJunior(c), tous = enfantsMineurs(c), libres = m.filter(function (e) { return !enfantAvecConvention(c, e); });
    return { verif: [majeur(c),
      ligne(m.length > 0, "Représentant légal d'un enfant de 12 à 17 ans", m.length ? (m.length > 1 ? "Enfants de 12 à 17 ans : " : "Enfant de 12 à 17 ans : ") + m.map(function (e) { return e.prenom + " (" + e.age + " ans)"; }).join(", ") + "." : tous.length ? "Les enfants mineurs du dossier ont moins de 12 ans (" + tous.map(function (e) { return e.prenom + ", " + e.age + " ans"; }).join(" ; ") + ") : la convention est réservée aux 12-17 ans." : "Aucun enfant mineur dans le dossier."),
      ligne(null, "Enfants sans convention", libres.length ? "Une convention par enfant : " + libres.map(function (e) { return e.prenom; }).join(", ") + " n'en a pas encore." : "Tous les enfants de 12 à 17 ans ont déjà une convention.", true),
      ligne(null, "Client titulaire d'un compte de dépôt à GS", PR.parId[c.cpt.p].nom + " : la cotisation de la convention est prélevée sur ce compte.", true)
    ], aVerifier: ["Le client est bien le représentant légal de l'enfant (autorité parentale) : livret de famille ou acte de naissance de l'enfant ; la banque peut demander l'accord de l'autre parent.", "Pièce d'identité du représentant légal en cours de validité.", "Accord du représentant légal pour le prélèvement mensuel de la cotisation sur son compte courant.", "L'enfant utilisera réellement la carte et les alertes : sinon la convention peut coûter plus cher qu'à l'unité."] };
  };

  /* ---------- mobile et internet : forfait, box fibre, pack, eSIM voyage ---------- */
  function compteGS(c) { return ligne(true, "Titulaire d'un compte de dépôt à GS Banque & Assurance", PR.parId[c.cpt.p].nom + "."); }
  /* Raccordement à la fibre : l'adresse se teste auprès de l'opérateur ; le dossier dit seulement si le client occupe le logement à son propre titre. */
  function logementFibre(c) {
    var st = c.log && c.log.st, lib = S.LIB_LOGEMENT[st] || st || "Logement non renseigné";
    return st === "heberge"
      ? ligne(null, "Logement dont le client peut demander le raccordement", lib + " : l'accord de la personne qui héberge le client est nécessaire, et le contrat peut devoir être souscrit à son nom.")
      : ligne(true, "Logement dont le client peut demander le raccordement", lib + ".");
  }
  var VERIF_TELECOM = {
    identite: "Pièce d'identité en cours de validité et justificatif de domicile ; coordonnées bancaires pour le prélèvement mensuel.",
    fibre: "Test d'éligibilité à la fibre optique avec l'adresse complète du client (immeuble raccordé ou raccordable).",
    accord: "Locataire ou copropriétaire d'un immeuble pas encore fibré : accord du propriétaire ou du syndic pour le raccordement.",
    engagement: "Engagement de 12 mois de la box, frais de mise en service (48 €) et de résiliation (69 €) expliqués au client."
  };
  REGLES.MOB = function (c) {
    var pack = detient(c, "PACK");
    return { verif: [majeur(c), compteGS(c), ligne(!pack, "Pas de forfait déjà compris dans un pack GS", pack ? "Le client détient déjà le pack forfait + box GS : son forfait mobile est inclus dans le pack." : "Aucun pack forfait + box détenu.")],
      aVerifier: [VERIF_TELECOM.identite, "Forfait choisi avec le client : Mini (5 Go), 50, 150 ou 250 Go ; mobile compatible 5G pour les forfaits de 50 Go et plus.", "Si le client garde son numéro : relevé d'identité opérateur (RIO), obtenu en appelant le 3179 depuis la ligne concernée.", "Forfait Mini à 4,99 € : box GS et un autre forfait de l'opérateur, sinon il est facturé 10,99 € par mois."] };
  };
  REGLES.BOX = function (c) {
    var pack = detient(c, "PACK");
    return { verif: [majeur(c), compteGS(c), logementFibre(c), ligne(!pack, "Pas de box déjà comprise dans un pack GS", pack ? "Le client détient déjà le pack forfait + box GS : sa box est comprise dans le pack." : "Aucun pack forfait + box détenu.")],
      aVerifier: [VERIF_TELECOM.identite, VERIF_TELECOM.fibre, VERIF_TELECOM.accord, VERIF_TELECOM.engagement] };
  };
  REGLES.PACK = function (c) {
    var box = detient(c, "BOX"), mob = detient(c, "MOB");
    return { verif: [majeur(c), compteGS(c), logementFibre(c),
      ligne(!box, "Pas encore de box GS", box ? "Le client a déjà une box GS : lui proposer plutôt le forfait mobile seul, qui bénéficie de la remise de 3 € par mois." : "Aucune box GS détenue."),
      ligne(!mob, "Pas encore de forfait mobile GS", mob ? "Le client a déjà un forfait mobile GS : lui proposer plutôt la box seule, qui lui donne la remise de 3 € par mois sur son forfait." : "Aucun forfait mobile GS détenu.")],
      aVerifier: [VERIF_TELECOM.identite, VERIF_TELECOM.fibre, VERIF_TELECOM.accord, VERIF_TELECOM.engagement, "Forfait mobile du pack choisi avec le client : 50, 150 ou 250 Go ; relevé d'identité opérateur (RIO) s'il garde son numéro."] };
  };
  REGLES.ESIM = function (c) {
    return { verif: [majeur(c), compteGS(c)],
      aVerifier: ["Téléphone compatible eSIM et non verrouillé par un opérateur : le client compose le code de vérification de son téléphone, qui doit afficher un numéro EID.", "Adresse e-mail du client, pour lui envoyer le QR code d'installation.", "Destination, durée de séjour et volume de données choisis avec le client d'après son voyage.", "L'eSIM s'achète pour un voyage : le client peut en acheter une autre pour un autre séjour."] };
  };

  /* ---------- évaluation ---------- */
  function evaluer(c, id) {
    var p = PR.parId[id], r = REGLES[id];
    if (!p || !r) return null;
    var x = r(c), det = detient(c, id), verifiables = x.verif.filter(function (l) { return !l.info; });
    var verdict = det ? "detenu" : verifiables.some(function (l) { return l.ok === false; }) ? "non" : verifiables.some(function (l) { return l.ok === null; }) ? "examiner" : "eligible";
    var motifs = verifiables.filter(function (l) { return l.ok === false; }).map(function (l) { return l.detail; });
    var doutes = verifiables.filter(function (l) { return l.ok === null; }).map(function (l) { return l.detail; });
    return { id: id, produit: p, verdict: verdict, libelle: VERDICTS[verdict], detenu: det, verifiees: x.verif, aVerifier: x.aVerifier, motifs: motifs, doutes: doutes };
  }
  function evaluerTous(c) { var o = {}; PR.produits.forEach(function (p) { o[p.id] = evaluer(c, p.id); }); return o; }
  /* Clients qui remplissent toutes les conditions vérifiables et ne détiennent pas encore le produit. */
  function eligibles(clients, id) { return clients.filter(function (c) { return evaluer(c, id).verdict === "eligible"; }); }
  function compter(clients, id) {
    var r = { eligible: 0, examiner: 0, non: 0, detenu: 0 };
    clients.forEach(function (c) { r[evaluer(c, id).verdict]++; });
    return r;
  }

  var api = { VERDICTS: VERDICTS, HCSF_TAUX: HCSF_TAUX, detient: detient, revenusDomicilies: revenusDomicilies, mensualites: mensualites, tauxEndettement: tauxEndettement, margeMensuelle: margeMensuelle,
    revenusStables: revenusStables, enfantsMineurs: enfantsMineurs, enfantsJunior: enfantsJunior, encours: encours, CARTES_PAIEMENT: CARTES_PAIEMENT, CONVENTIONS: CONVENTIONS, MANDATS: MANDATS, evaluer: evaluer, evaluerTous: evaluerTous, eligibles: eligibles, compter: compter, REGLES: REGLES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.eligibilite = api; }
})(typeof window !== "undefined" ? window : null);
