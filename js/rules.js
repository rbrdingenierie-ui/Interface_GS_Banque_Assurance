/* GS Banque & Assurance – règles de calcul du simulateur.
   Fonctions pures : utilisées par le navigateur et testées avec Node. */
(function (root) {
  "use strict";

  /* Un chèque de 15 € ou moins ne peut pas être refusé, même sans provision. */
  var SEUIL_CHEQUE_NON_REJETABLE = 15;

  /* Commission d'intervention : 8 € par opération, 80 € par mois au maximum.
     Offre clientèle fragile (OCF) : 4 € par opération, 20 € par mois au maximum,
     et 20 € par mois pour l'ensemble des frais d'incidents (Banque de France). */
  var COMMISSION_PAR_OPERATION = 8;
  var COMMISSION_PAR_MOIS = 80;
  var COMMISSION_OCF_PAR_OPERATION = 4;
  var COMMISSION_OCF_PAR_MOIS = 20;
  var PLAFOND_OCF_PAR_MOIS = 20;

  /* Commentaire obligatoire : nombre minimal de caractères (hors espaces de début et de fin). */
  var COMMENTAIRE_MIN = 20;

  /* Opportunités commerciales à détecter ("aucune" est une réponse à part entière). */
  var OPPORTUNITES = [
    { code: "carte", libelle: "Montée en gamme de carte bancaire" },
    { code: "decouvert", libelle: "Mise en place d'un découvert" },
    { code: "augmentation", libelle: "Augmentation du découvert" },
    { code: "credit", libelle: "Mise en place d'un crédit consommation" },
    { code: "aucune", libelle: "Aucune opportunité commerciale" }
  ];

  function arrondi(x) {
    return Math.round(x * 100) / 100;
  }

  /* Carte : ordre de paiement irrévocable. Chèque ≤ 15 € : paiement obligatoire. */
  function estNonRejetable(op) {
    return op.type === "carte" || (op.type === "cheque" && op.montant <= SEUIL_CHEQUE_NON_REJETABLE);
  }

  /* Position du compte :
     - crediteur : solde ≥ 0
     - autorise : solde négatif mais dans l'autorisation de découvert
     - etat_debiteurs : solde négatif au-delà de l'autorisation (ou sans autorisation) */
  function etat(solde, autorisation) {
    var s = arrondi(solde);
    if (s >= 0) return { code: "crediteur", depassement: 0 };
    if (s >= -autorisation) return { code: "autorise", depassement: 0 };
    return { code: "etat_debiteurs", depassement: arrondi(-s - autorisation) };
  }

  /* Frais de rejet plafonnés (art. D131-25 et D133-6 du CMF). */
  function fraisRejet(op) {
    if (op.type === "cheque") return op.montant <= 50 ? 30 : 50;
    if (op.type === "prelevement") return Math.min(20, op.montant);
    return 0;
  }

  /* Frais de rejet pour ce client : OCF, 20 € par mois au maximum pour l'ensemble des frais d'incidents. */
  function fraisRejetClient(dossier, op) {
    var f = fraisRejet(op);
    return dossier.client.fragile ? Math.min(f, PLAFOND_OCF_PAR_MOIS) : f;
  }

  /* Commission d'intervention applicable au client (OCF ou offre classique). */
  function commissionClient(dossier) {
    return dossier.client.fragile
      ? { parOperation: COMMISSION_OCF_PAR_OPERATION, parMois: COMMISSION_OCF_PAR_MOIS }
      : { parOperation: COMMISSION_PAR_OPERATION, parMois: COMMISSION_PAR_MOIS };
  }

  function decisionEffective(op, decisions) {
    if (estNonRejetable(op)) return "payer";
    return (decisions && decisions[op.id]) || null;
  }

  /* Applique les décisions dans l'ordre de présentation des opérations. */
  function projeter(dossier, decisions) {
    var solde = dossier.position.solde;
    var aut = dossier.position.autorisation;
    var lignes = [];
    var enAttente = 0;
    dossier.operations.forEach(function (op) {
      var d = decisionEffective(op, decisions);
      var avant = solde;
      var appliquee = false;
      if (d === "payer") {
        solde = arrondi(solde - op.montant);
        appliquee = true;
      } else if (d === null) {
        enAttente += 1;
      }
      lignes.push({
        op: op,
        decision: d,
        appliquee: appliquee,
        soldeAvant: arrondi(avant),
        soldeApres: arrondi(solde),
        etat: etat(solde, aut)
      });
    });
    return { lignes: lignes, soldeFinal: arrondi(solde), etat: etat(solde, aut), enAttente: enAttente };
  }

  function toutPayer(dossier) {
    var dec = {};
    dossier.operations.forEach(function (o) { dec[o.id] = "payer"; });
    return projeter(dossier, dec);
  }

  function decisionsAttendues(dossier) {
    var dec = {};
    dossier.operations.forEach(function (o) { dec[o.id] = o.attendu; });
    return dec;
  }

  function operationsADecider(dossier) {
    return dossier.operations.filter(function (o) { return !estNonRejetable(o); });
  }

  /* 1 point si la décision est celle attendue, 0,5 si elle est défendable, 0 sinon.
     Seules les opérations que le conseiller peut rejeter sont notées. */
  function noter(dossier, decisions) {
    var details = [];
    var total = 0;
    operationsADecider(dossier).forEach(function (op) {
      var d = decisions[op.id] || null;
      var verdict = "ko";
      var points = 0;
      if (d === op.attendu) { verdict = "ok"; points = 1; }
      else if (d && op.acceptable && d === op.acceptable) { verdict = "defendable"; points = 0.5; }
      total += points;
      details.push({ id: op.id, decision: d, points: points, verdict: verdict });
    });
    return { total: total, max: details.length, details: details };
  }

  /* Frais d'incidents engendrés par un jeu de décisions :
     - commission d'intervention pour chaque opération payée alors que le compte est à l'état des débiteurs ;
     - frais de rejet (plafonds réglementaires) pour chaque opération rejetée.
     Offre clientèle fragile (OCF) : commission de 4 € (20 € par mois), total limité à 20 € par mois. */
  function fraisDossier(dossier, decisions) {
    var proj = projeter(dossier, decisions);
    var nbIrreg = 0;
    var nbRejets = 0;
    var rejets = 0;
    proj.lignes.forEach(function (l) {
      if (l.decision === "payer" && l.etat.code === "etat_debiteurs") nbIrreg += 1;
      if (l.decision === "rejeter") { nbRejets += 1; rejets += fraisRejet(l.op); }
    });
    var com = commissionClient(dossier);
    var commission = Math.min(nbIrreg * com.parOperation, com.parMois);
    var total = arrondi(commission + rejets);
    var fragile = !!dossier.client.fragile;
    return {
      fragile: fragile,
      nbIrregularites: nbIrreg,
      commissionUnitaire: com.parOperation,
      commissionMensuelleMax: com.parMois,
      commission: commission,
      nbRejets: nbRejets,
      rejets: arrondi(rejets),
      total: total,
      totalPlafonne: fragile ? Math.min(total, PLAFOND_OCF_PAR_MOIS) : total
    };
  }

  /* Opportunité commerciale : 1 point si le choix correspond à l'opportunité attendue
     (une absence d'opportunité s'écrit "aucune"). */
  function opportuniteAttendue(dossier) {
    return (dossier.opportunite && dossier.opportunite.type) || "aucune";
  }
  function noterOpportunite(dossier, choix) {
    var attendu = opportuniteAttendue(dossier);
    var ok = !!choix && choix === attendu;
    return { choix: choix || null, attendu: attendu, points: ok ? 1 : 0, max: 1, verdict: ok ? "ok" : "ko" };
  }
  function libelleOpportunite(code) {
    var o = OPPORTUNITES.filter(function (x) { return x.code === code; })[0];
    return o ? o.libelle : "";
  }

  /* Score d'un dossier : décisions payer/rejeter + opportunité commerciale. */
  function scoreDossier(dossier, decisions, choix) {
    var ops = noter(dossier, decisions);
    var opp = noterOpportunite(dossier, choix);
    return { total: ops.total + opp.points, max: ops.max + opp.max, ops: ops, opp: opp };
  }

  /* Commentaire obligatoire : au moins COMMENTAIRE_MIN caractères. */
  function commentaireSuffisant(texte) {
    return String(texte || "").trim().length >= COMMENTAIRE_MIN;
  }

  function syntheseAntecedents(dossier) {
    var frais = 0;
    dossier.antecedents.forEach(function (a) { frais += fraisRejetClient(dossier, a); });
    return { nombre: dossier.antecedents.length, frais: arrondi(frais) };
  }

  var api = {
    SEUIL_CHEQUE_NON_REJETABLE: SEUIL_CHEQUE_NON_REJETABLE,
    COMMISSION_PAR_OPERATION: COMMISSION_PAR_OPERATION,
    COMMISSION_PAR_MOIS: COMMISSION_PAR_MOIS,
    COMMISSION_OCF_PAR_OPERATION: COMMISSION_OCF_PAR_OPERATION,
    COMMISSION_OCF_PAR_MOIS: COMMISSION_OCF_PAR_MOIS,
    PLAFOND_OCF_PAR_MOIS: PLAFOND_OCF_PAR_MOIS,
    COMMENTAIRE_MIN: COMMENTAIRE_MIN,
    OPPORTUNITES: OPPORTUNITES,
    arrondi: arrondi,
    estNonRejetable: estNonRejetable,
    etat: etat,
    fraisRejet: fraisRejet,
    fraisRejetClient: fraisRejetClient,
    commissionClient: commissionClient,
    decisionEffective: decisionEffective,
    projeter: projeter,
    toutPayer: toutPayer,
    decisionsAttendues: decisionsAttendues,
    operationsADecider: operationsADecider,
    noter: noter,
    opportuniteAttendue: opportuniteAttendue,
    noterOpportunite: noterOpportunite,
    libelleOpportunite: libelleOpportunite,
    scoreDossier: scoreDossier,
    commentaireSuffisant: commentaireSuffisant,
    fraisDossier: fraisDossier,
    syntheseAntecedents: syntheseAntecedents
  };

  root.SGBF = root.SGBF || {};
  root.SGBF.rules = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
