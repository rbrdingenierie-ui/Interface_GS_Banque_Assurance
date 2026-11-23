/* GS Banque & Assurance – protection des majeurs : huit clients du portefeuille (fictifs) font l'objet d'une mesure de protection judiciaire (curatelle simple, curatelle renforcée, tutelle,
   habilitation familiale). Le module dit qui ils sont, qui est leur protecteur, et ce que la mesure change pour les trois actes que l'outil permet d'accomplir : souscrire une assurance-vie,
   emprunter, ouvrir ou gérer un compte. Fonctions pures, utilisables dans le navigateur et sous Node.

   Sources : pages de service-public.gouv.fr « Curatelle d'une personne majeure » (page F2094, vérifiée par le site le 29 juillet 2026), « Tutelle d'un majeur » (actualité A16377) et « Habilitation familiale »
   (page F33367, vérifiée par le site le 19 juin 2026), consultées le 17 novembre 2026. Légifrance n'a pas pu être consulté : les articles du Code civil sont ceux que ces pages citent (articles 425 à 427, 440,
   467 à 472 pour la curatelle ; 457-1 à 463 pour la tutelle ; 494-1 à 494-12 pour l'habilitation familiale) et sont à revérifier avant tout usage hors de l'exercice. Ce que les pages disent, et rien d'autre :
   - curatelle simple : la personne accomplit seule les actes d'administration et les actes conservatoires ; pour les actes de disposition (emprunt, vente d'un bien immobilier, donation…), le curateur l'assiste ;
     elle perçoit seule son argent sur un compte à son nom mentionnant la curatelle et gère seule ses comptes ; souscrire ou modifier une assurance-vie est un acte de disposition qui exige l'assistance du curateur ;
   - curatelle renforcée : la personne ne peut s'engager qu'avec l'assistance de son curateur, qui cosigne ; le curateur perçoit les revenus, règle les dépenses et remet le reliquat ; la personne garde un compte
     à son nom, que le curateur gère ; le juge peut autoriser une carte de retrait plafonnée ;
   - tutelle : le tuteur représente la personne ; il agit seul pour l'administration (ouvrir un livret, placer des fonds, régler les dépenses courantes, souscrire une assurance) ; il faut l'autorisation du juge
     pour les actes de disposition, dont contracter un crédit et souscrire ou modifier une assurance-vie ;
   - habilitation familiale : un proche, habilité par le juge, représente ou assiste la personne ; l'habilitation peut être générale ou limitée à certains actes ; sauf décision contraire du juge, la personne
     habilitée agit seule sur les comptes et livrets, peut en clôturer ou en ouvrir ailleurs ; l'étendue des pouvoirs dépend du jugement.
   Hors de ces pages : la curatelle aménagée (le juge fixe la liste des actes) et la sauvegarde de justice ne sont pas représentées ; pour l'habilitation familiale, les pages ne disent rien de l'assurance-vie
   ni du crédit : la règle renvoie au jugement. Conventions de l'exercice, qui ne viennent d'aucun texte : (1) les huit mesures, les dates de jugement et les protecteurs sont inventés ; (2) la copie du jugement et
   l'identité du protecteur se vérifient avant tout acte (pratique de l'agence) ; (3) l'outil n'enregistre pas de crédit accordé à un client protégé ; (4) les mineurs ne relèvent pas de ce module (convention
   de compte des 12-17 ans, assurance-vie au nom d'un enfant : produits propres, signés par le représentant légal). */
(function (root) {
  "use strict";

  /* Typographie française : espace insécable avant « : ; ! ? % € » », dans les nombres et après « «  ». */
  function tp(s) { return String(s).replace(/ +([:;!?%€»])/g, " $1").replace(/« +/g, "« "); }

  var REGIMES = [
    { v: "curatelle_simple", lib: "Curatelle simple", protecteur: "curateur", def: "Le client accomplit seul les actes d'administration et les actes conservatoires ; pour les actes de disposition, son curateur l'assiste." },
    { v: "curatelle_renforcee", lib: "Curatelle renforcée", protecteur: "curateur", def: "Le client ne peut s'engager qu'avec l'assistance de son curateur, qui cosigne ; le curateur perçoit les revenus, règle les dépenses et remet le reliquat au client." },
    { v: "tutelle", lib: "Tutelle", protecteur: "tuteur", def: "Le tuteur représente le client dans les actes de sa vie civile : il agit seul pour l'administration du patrimoine, avec l'autorisation du juge pour les actes de disposition." },
    { v: "habilitation", lib: "Habilitation familiale", protecteur: "habilite", def: "Un proche, habilité par le juge, représente ou assiste le client ; l'étendue de ses pouvoirs dépend du jugement (habilitation générale ou limitée à certains actes)." }
  ];
  var ACTES = [
    { v: "assurance_vie", lib: "Souscrire une assurance-vie", court: "Assurance-vie" },
    { v: "credit", lib: "Emprunter", court: "Crédit" },
    { v: "compte", lib: "Ouvrir ou gérer un compte, un livret", court: "Compte et livrets" }
  ];
  /* modes : « assiste » (le client agit avec son protecteur, qui cosigne), « represente » (le protecteur agit pour le client), « seul » (le client agit seul), « gere » (le protecteur gère le compte),
     « jugement » (tout dépend du jugement). juge : l'autorisation du juge est exigée (true), non exigée (false) ou non dite par la source (null). */
  var REGLES = {
    curatelle_simple: {
      assurance_vie: { mode: "assiste", juge: null, texte: "Souscrire ou modifier une assurance-vie est un acte de disposition : le curateur assiste le client." },
      credit: { mode: "assiste", juge: null, texte: "Emprunter est un acte de disposition : le curateur assiste le client." },
      compte: { mode: "seul", juge: null, texte: "Le client perçoit seul son argent et gère seul ses comptes, sur un compte à son nom qui mentionne la curatelle." }
    },
    curatelle_renforcee: {
      assurance_vie: { mode: "assiste", juge: null, texte: "Le client ne peut s'engager qu'avec l'assistance de son curateur, qui cosigne : souscrire ou modifier une assurance-vie est un acte de disposition." },
      credit: { mode: "assiste", juge: null, texte: "Emprunter est un acte de disposition : le client ne peut s'engager qu'avec l'assistance de son curateur, qui cosigne." },
      compte: { mode: "gere", juge: null, texte: "Le client garde un compte à son nom, que le curateur gère : le curateur perçoit les revenus et règle les dépenses. Le juge peut autoriser une carte de retrait plafonnée." }
    },
    tutelle: {
      assurance_vie: { mode: "represente", juge: true, texte: "Souscrire ou modifier une assurance-vie est un acte de disposition : le tuteur agit pour le client avec l'autorisation du juge." },
      credit: { mode: "represente", juge: true, texte: "Contracter un crédit est un acte de disposition : le tuteur agit pour le client avec l'autorisation du juge." },
      compte: { mode: "represente", juge: false, texte: "Ouvrir un livret, placer des fonds ou régler les dépenses courantes relève de l'administration : le tuteur agit seul pour le client." }
    },
    habilitation: {
      assurance_vie: { mode: "jugement", juge: null, texte: "Les pages consultées ne disent rien de l'assurance-vie : l'étendue des pouvoirs de la personne habilitée dépend du jugement (représentation ou assistance, habilitation générale ou limitée)." },
      credit: { mode: "jugement", juge: null, texte: "Les pages consultées ne disent rien du crédit : l'étendue des pouvoirs de la personne habilitée dépend du jugement (représentation ou assistance, habilitation générale ou limitée)." },
      compte: { mode: "represente", juge: false, texte: "Sauf décision contraire du juge, la personne habilitée agit seule sur les comptes et livrets du client." }
    }
  };
  /* Produits de l'exercice qui sont des assurances-vie (GS Vie, GS Vie Premium). Les autres assurances (GS Décès, GS Obsèques…) ne sont pas des actes de disposition dans les pages consultées. */
  var ACTE_DU_PRODUIT = { AV: "assurance_vie", AVP: "assurance_vie" };

  /* Les huit clients : numéro dans le portefeuille, mesure, protecteur. « enfant » : le premier enfant du dossier ; « conjoint » : le conjoint du dossier ; « mandataire » : un mandataire judiciaire à la protection
     des majeurs (personne inventée). j : le jugement date de j jours avant la date de l'exercice. */
  var MESURES = [
    { id: 159, regime: "tutelle", j: 760, lien: "enfant" },
    { id: 354, regime: "tutelle", j: 1210, lien: "enfant" },
    { id: 165, regime: "curatelle_renforcee", j: 540, lien: "mandataire", mandataire: { civ: "Mme", prenom: "Évelyne", nom: "Hamon" } },
    { id: 181, regime: "curatelle_renforcee", j: 980, lien: "mandataire", mandataire: { civ: "M.", prenom: "Bertrand", nom: "Lemaître" } },
    { id: 4, regime: "curatelle_simple", j: 431, lien: "mandataire", mandataire: { civ: "Mme", prenom: "Sophie", nom: "Grenier" } },
    { id: 270, regime: "curatelle_simple", j: 1481, lien: "enfant" },
    { id: 58, regime: "habilitation", j: 650, lien: "conjoint" },
    { id: 59, regime: "habilitation", j: 880, lien: "enfant" }
  ];

  function opt(liste, v) { return liste.filter(function (x) { return x.v === v; })[0] || null; }
  var QUALITES = { curateur: ["curateur", "curatrice"], tuteur: ["tuteur", "tutrice"], habilite: ["personne habilitée", "personne habilitée"] };
  function majNom(n) { return String(n).toUpperCase(); }

  /* Le protecteur du client : civilité, prénom, nom, qualité (« curatrice », « tuteur », « personne habilitée »…) et lien avec le client. */
  function protecteurDe(c, m) {
    var rg = opt(REGIMES, m.regime), p, lien;
    if (m.lien === "mandataire") { p = m.mandataire; lien = "mandataire judiciaire à la protection des majeurs"; }
    else if (m.lien === "conjoint") { var cj = c.fam.conj; p = { civ: cj.sexe === "F" ? "Mme" : "M.", prenom: cj.prenom, nom: cj.nom }; lien = cj.sexe === "F" ? "son épouse" : "son époux"; }
    else { var e = c.fam.enf[0]; p = { civ: e.sexe === "F" ? "Mme" : "M.", prenom: e.prenom, nom: c.nom }; lien = e.sexe === "F" ? "sa fille" : "son fils"; }
    var f = p.civ === "Mme", q = QUALITES[rg.protecteur][f ? 1 : 0];
    return { civ: p.civ, prenom: p.prenom, nom: p.nom, nomComplet: p.civ + " " + p.prenom + " " + majNom(p.nom), qualite: q, titre: (rg.protecteur === "habilite" || f ? "la " : "le ") + q, lien: lien };
  }

  /* La mesure du client : null s'il n'en a pas. */
  function mesure(c) {
    if (!c) return null;
    var m = MESURES.filter(function (x) { return x.id === c.id; })[0];
    if (!m) return null;
    var rg = opt(REGIMES, m.regime);
    return { regime: m.regime, lib: rg.lib, def: rg.def, j: m.j, juridiction: "Tribunal judiciaire de Paris", protecteur: protecteurDe(c, m) };
  }
  function regle(regime, acte) { return REGLES[regime] && REGLES[regime][acte] ? REGLES[regime][acte] : null; }

  /* Ce que la mesure change, acte par acte, pour la fiche du client. */
  function lignes(c) {
    var m = mesure(c);
    if (!m) return [];
    return ACTES.map(function (a) { var r = regle(m.regime, a.v); return { acte: a.v, lib: a.court, mode: r.mode, juge: r.juge, texte: tp(r.texte) }; });
  }

  /* L'acte de la souscription d'un produit, s'il est concerné par la mesure du client. */
  function concerne(c, pid) { return !!(mesure(c) && ACTE_DU_PRODUIT[pid]); }

  /* Le point à confirmer avec le client avant de souscrire (ajouté aux points à vérifier de la fiche du produit). */
  function confirmation(c, pid) {
    var m = mesure(c), a = ACTE_DU_PRODUIT[pid];
    if (!m || !a) return "";
    var r = regle(m.regime, a), p = m.protecteur, qui = p.titre + ", " + p.nomComplet + " (" + p.lien + ")", t;
    if (r.mode === "assiste") t = "Client sous " + m.lib.toLowerCase() + " : " + qui + ", assiste le client et cosigne le contrat ; la copie du jugement est au dossier et l'identité du protecteur est vérifiée.";
    else if (r.mode === "represente") t = "Client sous " + m.lib.toLowerCase() + " : " + qui + ", signe pour le client ; la copie du jugement et l'autorisation du juge pour cette souscription sont au dossier, et l'identité du protecteur est vérifiée.";
    else t = "Client sous " + m.lib.toLowerCase() + " : la copie du jugement a été demandée, " + qui + ", a le pouvoir de souscrire ce contrat pour le client, et son identité est vérifiée.";
    return tp(t);
  }
  /* La ligne que la souscription conserve (résumé du contrat). */
  function mention(c, pid) {
    var m = mesure(c), a = ACTE_DU_PRODUIT[pid];
    if (!m || !a) return null;
    var r = regle(m.regime, a), p = m.protecteur;
    return [tp("Mesure de protection du client"), tp(m.lib + " : " + (r.mode === "assiste" ? "contrat cosigné par " : r.mode === "represente" ? "contrat signé par " : "pouvoirs vérifiés de ") + p.titre + ", " + p.nomComplet + (r.juge ? ", avec l'autorisation du juge" : ""))];
  }
  /* Crédit : refus motivé, le crédit d'un client protégé n'étant pas enregistré dans l'exercice. null si le client n'a pas de mesure. */
  function refusCredit(c) {
    var m = mesure(c);
    if (!m) return null;
    var r = regle(m.regime, "credit"), p = m.protecteur;
    return tp("Le client est sous " + m.lib.toLowerCase() + " (" + p.qualite + " : " + p.nomComplet + ", " + p.lien + "). " + r.texte + " L'outil n'enregistre pas de crédit accordé à un client protégé : jouez la scène avec le protecteur, hors de l'outil.");
  }
  /* Les huit clients, pour les contrôles : { id, regime }. */
  function liste() { return MESURES.map(function (m) { return { id: m.id, regime: m.regime }; }); }

  var api = { REGIMES: REGIMES, ACTES: ACTES, ACTE_DU_PRODUIT: ACTE_DU_PRODUIT, mesure: mesure, regle: regle, lignes: lignes, concerne: concerne, confirmation: confirmation, mention: mention, refusCredit: refusCredit, liste: liste, tp: tp };

  root.SGBF = root.SGBF || {};
  root.SGBF.protection = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
