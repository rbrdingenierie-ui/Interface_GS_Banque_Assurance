/* GS Banque & Assurance – règles du parcours « Gestion des incidents » (GDI).
   Un compte reste à l'état débiteur : à 15, 30, 60 et 90 jours, le dossier remonte dans l'outil. Le conseiller contacte le client, enregistre les moyens
   de régularisation, décide de la suite selon le palier (suivi, convocation, clôture, recouvrement amiable) puis, après validation, peut envoyer un courrier.
   Fonctions pures : utilisées par le navigateur et testées avec Node. */
(function (root) {
  "use strict";

  /* Paliers : nombre de jours à l'état débiteur, et délai maximal raisonnable pour régulariser avant le palier suivant. */
  var PALIERS = [
    { j: 15, code: "j15", court: "J15", titre: "15 jours à l'état débiteur", delaiMax: 15, suivant: 30,
      objet: "Premier contact : comprendre l'origine du débit et obtenir une régularisation rapide." },
    { j: 30, code: "j30", court: "J30", titre: "30 jours à l'état débiteur", delaiMax: 30, suivant: 60,
      objet: "Un mois de débit : information écrite du client et solution datée, sinon rendez-vous en agence." },
    { j: 60, code: "j60", court: "J60", titre: "60 jours à l'état débiteur", delaiMax: 30, suivant: 90,
      objet: "Deux mois de débit : la clôture du compte devient possible (préavis de 60 jours)." },
    { j: 90, code: "j90", court: "J90", titre: "90 jours à l'état débiteur", delaiMax: null, suivant: null,
      objet: "Trois mois de débit : clôture des services, opposition aux prélèvements, envoi du compte au service de recouvrement amiable (SRA)." }
  ];

  /* Canaux de contact. Le courrier simple ne donne jamais de réponse immédiate. */
  var CANAUX = [
    { id: "mobile", libelle: "Appel au mobile", court: "Mobile" },
    { id: "fixe", libelle: "Appel au téléphone fixe", court: "Téléphone fixe" },
    { id: "sms", libelle: "SMS", court: "SMS" },
    { id: "email", libelle: "E-mail", court: "E-mail" },
    { id: "courrier", libelle: "Courrier simple", court: "Courrier" },
    { id: "agence", libelle: "Convocation en agence", court: "Convocation" }
  ];

  /* Moyens de régularisation. « fonds » : une somme qui ramène le compte à zéro ; « social » : une démarche d'accompagnement ; « aucun » : rien d'obtenu. */
  var MOYENS = [
    { id: "salaire", genre: "fonds", libelle: "Versement du salaire ou du revenu attendu", aide: "Salaire, pension ou allocation à venir, domicilié sur le compte." },
    { id: "virement_epargne", genre: "fonds", libelle: "Virement depuis l'épargne détenue à GS Banque & Assurance", aide: "Livret A, LDDS… disponibles chez nous." },
    { id: "virement_externe", genre: "fonds", libelle: "Virement depuis un compte détenu dans une autre banque", aide: "Le client alimente son compte avec ses avoirs ailleurs." },
    { id: "creance", genre: "fonds", libelle: "Remise de chèque ou somme due à encaisser", aide: "Remboursement, indemnité, vente d'un bien, solde de tout compte…" },
    { id: "aide_proche", genre: "fonds", libelle: "Aide d'un proche", aide: "Virement ou chèque d'un membre de la famille." },
    { id: "rachat_av", genre: "fonds", libelle: "Rachat partiel d'une assurance-vie", aide: "Si le client détient un contrat disponible." },
    { id: "decouvert_autorise", genre: "fonds", libelle: "Autorisation de découvert à mettre en place ou à relever", aide: "Crédit : étude de solvabilité, offre écrite, délai de rétractation." },
    { id: "pret_substitution", genre: "fonds", libelle: "Prêt personnel de substitution", aide: "Un crédit amortissable remplace le découvert (opportunité commerciale)." },
    { id: "accompagnement", genre: "social", libelle: "Accompagnement budgétaire", aide: "Rendez-vous budget, offre pour la clientèle fragile, dispositif d'accompagnement de la banque." },
    { id: "surendettement", genre: "social", libelle: "Orientation vers la commission de surendettement", aide: "Situation durablement déséquilibrée : dossier à déposer à la Banque de France." },
    { id: "aucun", genre: "aucun", libelle: "Aucun moyen de régularisation obtenu", aide: "Le client ne propose rien de réaliste ou refuse." }
  ];

  /* Délais proposés pour chaque moyen (nombre de jours à partir d'aujourd'hui). */
  var DELAIS = [
    { j: 0, libelle: "Aujourd'hui" }, { j: 3, libelle: "Sous 3 jours" }, { j: 7, libelle: "Sous 7 jours" },
    { j: 15, libelle: "Sous 15 jours" }, { j: 30, libelle: "Sous 30 jours" }, { j: 60, libelle: "Sous 60 jours" }
  ];

  /* Décisions possibles selon le palier (J90 : une procédure, voir procedure). */
  var DECISIONS = {
    15: [
      { code: "suivi", libelle: "Maintenir le suivi", aide: "Le client a une solution datée : vous le relancez à l'échéance convenue." },
      { code: "agence", libelle: "Convoquer le client en agence", aide: "Aucune solution datée : un rendez-vous permet d'étudier sa situation." }
    ],
    30: [
      { code: "suivi", libelle: "Maintenir le suivi", aide: "Le client a une solution datée : vous le relancez à l'échéance convenue." },
      { code: "agence", libelle: "Convoquer le client en agence", aide: "Aucune solution datée : un rendez-vous permet d'étudier sa situation." }
    ],
    60: [
      { code: "maintenir", libelle: "Maintenir le compte et renforcer le suivi", aide: "Une solution datée existe, ou le client est fragile : on accompagne avant toute clôture." },
      { code: "cloturer", libelle: "Lancer la clôture du compte (préavis de 60 jours)", aide: "Aucune solution crédible : la banque dénonce la convention de compte avec un préavis de deux mois." }
    ],
    90: [
      { code: "sra", libelle: "Appliquer la procédure J90", aide: "Clôturer les services, opposer les prélèvements et envoyer le compte au service de recouvrement amiable." }
    ]
  };

  /* Courriers. Le conseiller choisit le modèle après avoir validé son dossier ; l'envoi est validé par lui, avec édition du PDF. */
  var COURRIERS = [
    { id: "j15_info", paliers: [15, 30], libelle: "Information : compte à l'état débiteur", envoi: "Courrier simple", aide: "Rappelle le solde, la date du débit et invite le client à régulariser." },
    { id: "j30_depassement", paliers: [30], libelle: "Information écrite sur le dépassement du découvert", envoi: "Courrier simple", aide: "Après un mois de dépassement : montant, taux débiteur, frais, solution à étudier." },
    { id: "j60_relance", paliers: [60], libelle: "Dernière relance avant mesures (lettre recommandée)", envoi: "Lettre recommandée avec accusé de réception", aide: "Le compte reste ouvert : le client doit régulariser sous 30 jours." },
    { id: "j60_preavis", paliers: [60], libelle: "Dénonciation de la convention de compte (préavis de 60 jours)", envoi: "Lettre recommandée avec accusé de réception", aide: "La banque met fin à la convention de compte : préavis de deux mois." },
    { id: "j90_sra", paliers: [90], libelle: "Clôture des services et transmission au service de recouvrement amiable", envoi: "Lettre recommandée avec accusé de réception", aide: "Notifie la clôture des services, l'opposition aux prélèvements et la transmission du dossier au SRA." }
  ];

  var COMMENTAIRE_MIN = 20;

  function arrondi(x) { return Math.round(x * 100) / 100; }
  function palier(j) { return PALIERS.filter(function (p) { return p.j === j; })[0] || null; }
  function moyen(id) { return MOYENS.filter(function (m) { return m.id === id; })[0] || null; }
  function canal(id) { return CANAUX.filter(function (c) { return c.id === id; })[0] || null; }
  function courrier(id) { return COURRIERS.filter(function (c) { return c.id === id; })[0] || null; }
  function libelleMoyen(id) { var m = moyen(id); return m ? m.libelle : id; }
  function libelleDecision(j, code) { var l = (DECISIONS[j] || []).filter(function (d) { return d.code === code; })[0]; return l ? l.libelle : ""; }
  function delaiLibelle(j) { var d = DELAIS.filter(function (x) { return x.j === j; })[0]; return d ? d.libelle : "Sous " + j + " jours"; }
  /* Plus petit délai proposé qui couvre un nombre de jours donné. */
  function delaiPour(n) {
    var i;
    for (i = 0; i < DELAIS.length; i++) if (DELAIS[i].j >= n) return DELAIS[i].j;
    return DELAIS[DELAIS.length - 1].j;
  }

  /* ---------- le compte ---------- */
  /* Somme à apporter pour que le compte redevienne créditeur. */
  function besoin(d) { return arrondi(Math.max(0, -d.compte.solde)); }
  /* Part du débit qui dépasse l'autorisation de découvert (dépassement). */
  function depassement(d) { return arrondi(Math.max(0, -d.compte.solde - d.compte.autorisation)); }
  function commentaireSuffisant(texte) { return String(texte || "").trim().length >= COMMENTAIRE_MIN; }

  /* ---------- étape 1 : contact ---------- */
  /* tentatives : liste des canaux essayés, dans l'ordre. */
  function joignable(d) { return !!(d.contact && d.contact.canaux && d.contact.canaux.length); }
  function atteint(d, tentatives) {
    return (tentatives || []).some(function (c) { return joignable(d) && d.contact.canaux.indexOf(c) >= 0; });
  }
  /* Résultat d'une tentative : "reponse" (le client répond), "sans_reponse", "attente" (courrier : pas de réponse immédiate). */
  function resultatTentative(d, c) {
    if (c === "courrier") return "attente";
    return joignable(d) && d.contact.canaux.indexOf(c) >= 0 ? "reponse" : "sans_reponse";
  }
  /* Le contact est terminé quand le client a répondu ou, s'il est injoignable, après deux tentatives par des canaux différents. */
  function contactTermine(d, tentatives) {
    var t = tentatives || [], diff = t.filter(function (c, i) { return t.indexOf(c) === i; });
    if (atteint(d, t)) return true;
    return diff.length >= 2;
  }
  function noterContact(d, tentatives) {
    var t = tentatives || [], diff = t.filter(function (c, i) { return t.indexOf(c) === i; });
    var ok;
    if (joignable(d)) ok = atteint(d, t);
    else ok = diff.length >= 2 && diff.indexOf("courrier") >= 0;
    return { points: ok ? 1 : 0, max: 1, verdict: ok ? "ok" : "ko", joignable: joignable(d), tentatives: t.length, canaux: diff.length };
  }

  /* ---------- étape 2 : moyens de régularisation ---------- */
  /* saisie : [{ id, montant, delai }] */
  function analyseMoyens(d, saisie) {
    var reels = (d.regularisation && d.regularisation.reels) || {}, p = palier(d.palier), parMoyen = [], total = 0, invalides = [], tard = false;
    (saisie || []).forEach(function (s) {
      var m = moyen(s.id), r = reels[s.id], ligne = { id: s.id, montant: +s.montant || 0, delai: s.delai, genre: m ? m.genre : "", ok: true, motif: "" };
      if (!m || m.genre === "aucun") { parMoyen.push(ligne); return; }
      if (m.genre === "fonds") {
        if (!r) { ligne.ok = false; ligne.motif = "le client n'a pas cette ressource"; }
        else if (!(ligne.montant > 0)) { ligne.ok = false; ligne.motif = "montant à renseigner"; }
        else if (ligne.montant > r.montant + 0.005) { ligne.ok = false; ligne.motif = "montant supérieur à la ressource du client"; }
        else if (typeof s.delai !== "number" || s.delai < r.delai) { ligne.ok = false; ligne.motif = "délai plus court que celui du client"; }
        if (ligne.ok) { total += ligne.montant; if (p && p.delaiMax != null && s.delai > p.delaiMax) tard = true; }
        else invalides.push(ligne);
      }
      parMoyen.push(ligne);
    });
    return { lignes: parMoyen, total: arrondi(total), couvre: total + 0.5 >= besoin(d), invalides: invalides, tard: tard };
  }
  function moyensSaisis(saisie) { return !!saisie && saisie.length >= 1; }
  /* 1 point : régularisation complète et dans les temps (ou, sans solution réelle, démarche d'accompagnement) ; 0,5 : incomplète ; 0 : ressource inventée ou rien. */
  function noterMoyens(d, saisie) {
    var a = analyseMoyens(d, saisie), reg = d.regularisation || { plan: false, reels: {}, sociaux: [] };
    var fonds = a.lignes.filter(function (l) { return l.genre === "fonds"; }), sociaux = a.lignes.filter(function (l) { return l.genre === "social"; });
    var aucun = a.lignes.some(function (l) { return l.id === "aucun"; });
    var points = 0, verdict = "ko", motif = "";
    if (!a.lignes.length) { motif = "Aucun moyen enregistré."; }
    else if (a.invalides.length) { motif = "Un moyen ne correspond pas à ce que le client a dit : " + a.invalides.map(function (l) { return libelleMoyen(l.id) + " (" + l.motif + ")"; }).join(" ; ") + "."; }
    else if (reg.plan) {
      if (!fonds.length) { motif = "Le client avait une solution réelle, vous ne l'avez pas retenue."; }
      else if (a.couvre && !a.tard) { points = 1; verdict = "ok"; motif = "Régularisation complète et dans le délai."; }
      else if (a.couvre) { points = 0.5; verdict = "defendable"; motif = "La somme couvre le débit mais le délai est trop long avant le palier suivant."; }
      else { points = 0.5; verdict = "defendable"; motif = "La somme réunie (" + a.total + " €) ne couvre pas tout le débit (" + besoin(d) + " €)."; }
    } else {
      var attendus = reg.sociaux || [];
      var bonne = sociaux.some(function (l) { return attendus.indexOf(l.id) >= 0 || !attendus.length; });
      if (bonne && !(a.couvre && fonds.length)) { points = 1; verdict = "ok"; motif = "Pas de solution financière réaliste : la démarche d'accompagnement est la bonne."; }
      else if (aucun && !attendus.length) { points = 1; verdict = "ok"; motif = "Aucun moyen réaliste : le constat est exact."; }
      else if (aucun || sociaux.length || fonds.length) { points = 0.5; verdict = "defendable"; motif = attendus.length ? "Constat juste, mais une démarche d'accompagnement était attendue." : "Moyen partiel, sans solution complète."; }
    }
    return { points: points, max: 1, verdict: verdict, motif: motif, analyse: a };
  }

  /* ---------- étape 3 : décision selon le palier ---------- */
  function noterDecision(d, choix) {
    var ok = !!choix && choix === d.attendu.decision;
    return { choix: choix || null, attendu: d.attendu.decision, points: ok ? 1 : 0, max: 1, verdict: ok ? "ok" : "ko" };
  }
  /* Procédure J90 : chaque service à clôturer, chaque prélèvement à opposer, l'envoi au SRA. */
  function elementsProcedure(d) {
    var l = [];
    (d.services || []).forEach(function (s) { l.push({ cle: "service:" + s.id, genre: "service", libelle: s.libelle }); });
    (d.prelevements || []).forEach(function (p) { l.push({ cle: "prelevement:" + p.id, genre: "prelevement", libelle: p.libelle, montant: p.montant }); });
    l.push({ cle: "sra", genre: "sra", libelle: "Envoyer le compte au service de recouvrement amiable (SRA)" });
    return l;
  }
  function procedureTerminee(d, coches) {
    var c = coches || {};
    return elementsProcedure(d).every(function (e) { return !!c[e.cle]; });
  }
  function noterProcedure(d, coches) {
    var c = coches || {}, el = elementsProcedure(d), faits = el.filter(function (e) { return !!c[e.cle]; });
    var part = el.length ? faits.length / el.length : 0, pts = faits.length === el.length ? 1 : (c.sra && part >= 2 / 3) ? 0.5 : 0;
    return { points: pts, max: 1, verdict: pts === 1 ? "ok" : pts > 0 ? "defendable" : "ko", faits: faits.length, total: el.length, manquants: el.filter(function (e) { return !c[e.cle]; }) };
  }
  function decisionPrise(d, ctx) {
    if (d.palier === 90) return procedureTerminee(d, ctx.procedure);
    return !!ctx.decision;
  }
  function noterSuite(d, ctx) {
    if (d.palier === 90) { var n = noterProcedure(d, ctx.procedure); n.choix = "sra"; n.attendu = "sra"; return n; }
    return noterDecision(d, ctx.decision);
  }

  /* ---------- étape 4 : courrier ---------- */
  /* envoi : { modele } si le conseiller a validé l'envoi, sinon null. */
  function noterCourrier(d, envoi) {
    var att = d.attendu.courrier;
    if (!att) return { points: 0, max: 0, verdict: "facultatif", attendu: null, choix: envoi ? envoi.modele : null };
    var ok = !!envoi && envoi.modele === att;
    return { points: ok ? 1 : 0, max: 1, verdict: ok ? "ok" : "ko", attendu: att, choix: envoi ? envoi.modele : null };
  }
  function courriersDuPalier(j) { return COURRIERS.filter(function (c) { return c.paliers.indexOf(j) >= 0; }); }

  /* ---------- validation et score ---------- */
  function pretValider(d, ctx) {
    return contactTermine(d, ctx.tentatives) && moyensSaisis(ctx.moyens) && decisionPrise(d, ctx) && commentaireSuffisant(ctx.commentaire);
  }
  function scoreDossier(d, ctx) {
    var c = noterContact(d, ctx.tentatives), m = noterMoyens(d, ctx.moyens), s = noterSuite(d, ctx), k = noterCourrier(d, ctx.courrier);
    return { total: c.points + m.points + s.points + k.points, max: c.max + m.max + s.max + k.max, contact: c, moyens: m, suite: s, courrier: k };
  }
  function maxDossier(d) { return 3 + (d.attendu.courrier ? 1 : 0); }

  var api = {
    PALIERS: PALIERS, CANAUX: CANAUX, MOYENS: MOYENS, DELAIS: DELAIS, DECISIONS: DECISIONS, COURRIERS: COURRIERS, COMMENTAIRE_MIN: COMMENTAIRE_MIN,
    arrondi: arrondi, palier: palier, moyen: moyen, canal: canal, courrier: courrier, libelleMoyen: libelleMoyen, libelleDecision: libelleDecision, delaiLibelle: delaiLibelle, delaiPour: delaiPour,
    besoin: besoin, depassement: depassement, commentaireSuffisant: commentaireSuffisant,
    joignable: joignable, atteint: atteint, resultatTentative: resultatTentative, contactTermine: contactTermine, noterContact: noterContact,
    analyseMoyens: analyseMoyens, moyensSaisis: moyensSaisis, noterMoyens: noterMoyens,
    noterDecision: noterDecision, elementsProcedure: elementsProcedure, procedureTerminee: procedureTerminee, noterProcedure: noterProcedure, decisionPrise: decisionPrise, noterSuite: noterSuite,
    noterCourrier: noterCourrier, courriersDuPalier: courriersDuPalier, pretValider: pretValider, scoreDossier: scoreDossier, maxDossier: maxDossier
  };
  root.SGBF = root.SGBF || {};
  root.SGBF.gdi = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
