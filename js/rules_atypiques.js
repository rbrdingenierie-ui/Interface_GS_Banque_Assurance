/* GS Banque & Assurance – règles du parcours « mouvements atypiques ».
   Fonctions pures : utilisées par le navigateur et testées avec Node. */
(function (root) {
  "use strict";

  /* Communication systématique d'informations (COSI) : versements ou retraits d'espèces
     supérieurs à 10 000 € sur un mois civil, appréciés séparément (dépôts, retraits). */
  var SEUIL_COSI = 10000;

  /* Commentaire obligatoire : nombre minimal de caractères (hors espaces de début et de fin). */
  var COMMENTAIRE_MIN = 20;

  /* Justificatifs que le conseiller peut demander. « neutre » : jamais pénalisé. */
  var PIECES = [
    { id: "explication", libelle: "Explication écrite de l'origine des fonds et du motif de l'opération", neutre: true },
    { id: "bulletins", libelle: "Trois derniers bulletins de paie" },
    { id: "avis_impo", libelle: "Dernier avis d'imposition" },
    { id: "recettes", libelle: "Livre de recettes ou bordereaux de remise de l'activité" },
    { id: "factures", libelle: "Contrat, devis ou factures de la prestation" },
    { id: "acte_donation", libelle: "Acte de donation ou déclaration de don manuel" },
    { id: "attestation_notaire", libelle: "Attestation du notaire (succession)" },
    { id: "acte_vente_immo", libelle: "Acte ou compromis de vente d'un bien immobilier" },
    { id: "cession_vehicule", libelle: "Certificat de cession et facture ou contrat de vente du véhicule" },
    { id: "vente_bien", libelle: "Contrat ou facture de vente du bien, avec justificatif d'acquisition" },
    { id: "solde_tout_compte", libelle: "Solde de tout compte ou courrier de l'employeur (indemnités)" },
    { id: "avis_rachat", libelle: "Avis de rachat du contrat d'assurance-vie" },
    { id: "indemnite_assurance", libelle: "Courrier de l'assureur (indemnisation d'un sinistre)" },
    { id: "reconnaissance_dette", libelle: "Contrat de prêt ou reconnaissance de dette" },
    { id: "releves_autre_banque", libelle: "Relevés d'un autre établissement (compte ou épargne)" },
    { id: "attestation_honneur", libelle: "Attestation sur l'honneur du client" }
  ];

  var ISSUES = [
    { code: "coherent", libelle: "Valider l'opération comme cohérente", aide: "L'opération est cohérente avec la situation du client : l'alerte est clôturée et le dossier est mis à jour." },
    { code: "declaration", libelle: "Déclarer à la cellule TRACFIN de l'établissement", aide: "Signalement interne : le déclarant désigné décide de la déclaration de soupçon à TRACFIN. Le client n'en est pas informé." }
  ];

  var TYPES = {
    depot_especes: "Dépôt d'espèces",
    depot_cheque: "Dépôt de chèque",
    retrait_especes: "Retrait d'espèces",
    virement: "Virement"
  };

  function arrondi(x) { return Math.round(x * 100) / 100; }

  function piece(id) {
    return PIECES.filter(function (p) { return p.id === id; })[0] || null;
  }
  function libellePiece(id) { var p = piece(id); return p ? p.libelle : id; }
  function estNeutre(id) { var p = piece(id); return !!(p && p.neutre); }
  function libelleIssue(code) {
    var i = ISSUES.filter(function (x) { return x.code === code; })[0];
    return i ? i.libelle : "";
  }

  function sens(op) {
    if (op.sens) return op.sens;
    return op.type === "depot_especes" || op.type === "depot_cheque" ? "credit" : "debit";
  }
  function estEspeces(op) { return op.type === "depot_especes" || op.type === "retrait_especes"; }

  /* Espèces par mois civil (dépôts et retraits séparés) et dépassement du seuil COSI.
     Tri : du mois le plus ancien au plus récent. */
  function cumulEspeces(dossier) {
    var par = {};
    dossier.operations.forEach(function (op) {
      if (!estEspeces(op)) return;
      var m = par[op.mois] || (par[op.mois] = { mois: op.mois, depots: 0, retraits: 0 });
      if (op.type === "depot_especes") m.depots += op.montant; else m.retraits += op.montant;
    });
    return finirCumul(par);
  }
  /* Même cumul à partir des lignes d'un relevé : [mois, jour, type, libellé, montant (− débit, + crédit), opération]. */
  function cumulEspecesReleve(lignes) {
    var par = {};
    (lignes || []).forEach(function (l) {
      if (l[2] !== "depot_especes" && l[2] !== "retrait_especes") return;
      var m = par[l[0]] || (par[l[0]] = { mois: l[0], depots: 0, retraits: 0 });
      if (l[2] === "depot_especes") m.depots += l[4]; else m.retraits -= l[4];
    });
    return finirCumul(par);
  }
  function finirCumul(par) {
    return Object.keys(par).map(function (k) { return par[k]; })
      .sort(function (a, b) { return b.mois - a.mois; })
      .map(function (m) {
        m.depots = arrondi(m.depots);
        m.retraits = arrondi(m.retraits);
        m.cosiDepots = m.depots > SEUIL_COSI;
        m.cosiRetraits = m.retraits > SEUIL_COSI;
        return m;
      });
  }
  function cosiDeclenchee(dossier) {
    return cumulEspeces(dossier).some(function (m) { return m.cosiDepots || m.cosiRetraits; });
  }

  function operationsAtypiques(dossier) {
    return dossier.operations.filter(function (o) { return o.atypique; });
  }

  /* Étape 1 : chaque opération est classée « habituelle » ou « atypique » (1 point par opération bien classée). */
  function classementAttendu(op) { return op.atypique ? "atypique" : "habituelle"; }
  function classementComplet(dossier, choix) {
    return dossier.operations.every(function (o) { return choix && (choix[o.id] === "habituelle" || choix[o.id] === "atypique"); });
  }
  function noterClassement(dossier, choix) {
    var details = [];
    var total = 0;
    dossier.operations.forEach(function (op) {
      var c = (choix && choix[op.id]) || null;
      var attendu = classementAttendu(op);
      var ok = c === attendu;
      if (ok) total += 1;
      details.push({ id: op.id, choix: c, attendu: attendu, points: ok ? 1 : 0, verdict: ok ? "ok" : "ko" });
    });
    return { total: total, max: details.length, details: details };
  }

  /* Étape 2 : justificatifs demandés.
     1 point : toutes les pièces attendues et aucune pièce hors sujet.
     0,5 point : toutes les pièces attendues avec une ou deux pièces en trop,
                 ou demande incomplète mais sans pièce en trop et utile.
     0 sinon. */
  function noterPieces(dossier, selection) {
    var sel = [];
    (selection || []).forEach(function (id) { if (sel.indexOf(id) < 0) sel.push(id); });
    var att = dossier.pieces.attendues;
    var acc = dossier.pieces.acceptables || [];
    var manquantes = att.filter(function (id) { return sel.indexOf(id) < 0; });
    var enTrop = sel.filter(function (id) { return att.indexOf(id) < 0 && acc.indexOf(id) < 0 && !estNeutre(id); });
    var utiles = att.length - manquantes.length;
    var points = 0, verdict = "ko";
    if (!manquantes.length && !enTrop.length) { points = 1; verdict = "ok"; }
    else if (!manquantes.length && enTrop.length <= 2) { points = 0.5; verdict = "defendable"; }
    else if (!enTrop.length && utiles >= 1) { points = 0.5; verdict = "defendable"; }
    return { points: points, max: 1, verdict: verdict, manquantes: manquantes, enTrop: enTrop, selection: sel };
  }

  /* On ne peut contacter le client que si tout est classé, au moins une opération est jugée atypique
     et au moins un justificatif est demandé. */
  function peutContacter(dossier, choix, selection) {
    if (!classementComplet(dossier, choix)) return false;
    var auMoinsUne = dossier.operations.some(function (o) { return choix[o.id] === "atypique"; });
    return auMoinsUne && !!selection && selection.length >= 1;
  }

  /* Étape 3 : décision finale (1 point). */
  function noterIssue(dossier, decision) {
    var ok = !!decision && decision === dossier.issue;
    return { choix: decision || null, attendu: dossier.issue, points: ok ? 1 : 0, max: 1, verdict: ok ? "ok" : "ko" };
  }

  function scoreDossier(dossier, choix, selection, decision) {
    var cl = noterClassement(dossier, choix);
    var pi = noterPieces(dossier, selection);
    var is = noterIssue(dossier, decision);
    return { total: cl.total + pi.points + is.points, max: cl.max + 2, classement: cl, pieces: pi, issue: is };
  }

  function commentaireSuffisant(texte) {
    return String(texte || "").trim().length >= COMMENTAIRE_MIN;
  }

  var api = {
    SEUIL_COSI: SEUIL_COSI,
    COMMENTAIRE_MIN: COMMENTAIRE_MIN,
    PIECES: PIECES,
    ISSUES: ISSUES,
    TYPES: TYPES,
    arrondi: arrondi,
    piece: piece,
    libellePiece: libellePiece,
    estNeutre: estNeutre,
    libelleIssue: libelleIssue,
    sens: sens,
    estEspeces: estEspeces,
    cumulEspeces: cumulEspeces,
    cumulEspecesReleve: cumulEspecesReleve,
    cosiDeclenchee: cosiDeclenchee,
    operationsAtypiques: operationsAtypiques,
    classementAttendu: classementAttendu,
    classementComplet: classementComplet,
    noterClassement: noterClassement,
    noterPieces: noterPieces,
    peutContacter: peutContacter,
    noterIssue: noterIssue,
    scoreDossier: scoreDossier,
    commentaireSuffisant: commentaireSuffisant
  };

  root.SGBF = root.SGBF || {};
  root.SGBF.atyp = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
