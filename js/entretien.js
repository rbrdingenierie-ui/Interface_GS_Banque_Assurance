/* GS Banque & Assurance – fiche d'entretien client : aide au conseiller pour mener un entretien de découverte, en sept étapes
   (Préparation, Accueil, Découverte, Accord de découverte, Proposition, Argumentation, Conclusion), d'après la fiche « Entretien client » de l'enseignant.
   Ce fichier contient le contenu de la fiche, les calculs de l'étape « Découverte » (taux d'endettement, capacité d'emprunt, capacité d'épargne),
   les données déjà connues du client (étape « Préparation »), l'enregistrement des notes et la mise à jour du dossier. L'affichage est dans ui_entretien.js.
   La « grille » de l'entretien : chaque question de la découverte s'accompagne de zones à remplir par le conseiller (coordonnées, adresse, famille, profession, patrimoine, véhicule…), préremplies avec le dossier ;
   à la validation de l'entretien, ce qui a changé met le dossier du client à jour et les autres renseignements (loisirs, patrimoine, épargne chez des confrères, véhicule, situation financière) rejoignent le dossier.
   Règles de l'exercice : le taux d'endettement maximal de référence est celui de la fiche (33 % des ressources) ; pour un crédit immobilier, l'outil « Montage de prêt »
   applique la limite du HCSF (35 %, assurance comprise). Les saisies sont enregistrées dans le navigateur (store().entretiens[client]). */
(function (root) {
  "use strict";

  var B = root && root.SGBF ? root.SGBF.banque : require("./banque.js");
  var PR = root && root.SGBF ? root.SGBF.produits : require("./produits.js");
  var S = root && root.SGBF ? root.SGBF.synthese : require("./synthese.js");
  var EL = root && root.SGBF ? root.SGBF.eligibilite : require("./eligibilite.js");
  var DO = root && root.SGBF ? root.SGBF.dossier : require("./dossier.js");
  var RIB = root && root.SGBF ? root.SGBF.rib : require("./rib.js");

  var TAUX_REF = 33;       /* % des ressources : règle de la fiche */
  var MAX_TXT = 1500;      /* caractères par zone de notes */
  var MAX_NOTE = 2000;     /* longueur d'une note de rendez-vous du dossier (comme dans la fiche client) */
  var MAX_MONTANT = 1000000;
  var MAX_CHAMP = 400;     /* caractères par zone de la grille */

  /* ---------- contenu de la fiche ---------- */
  var ETAPES = [
    { id: "prep", n: 1, lettre: "P", reste: "réparation du rendez-vous", court: "Préparation" },
    { id: "accueil", n: 2, lettre: "A", reste: "ccueil", court: "Accueil" },
    { id: "decouverte", n: 3, lettre: "D", reste: "écouverte", court: "Découverte" },
    { id: "accord", n: 4, lettre: "A", reste: "ccord de découverte", court: "Accord de découverte" },
    { id: "proposition", n: 5, lettre: "P", reste: "roposition", court: "Proposition" },
    { id: "argumentation", n: 6, lettre: "A", reste: "rgumentation", court: "Argumentation" },
    { id: "conclusion", n: 7, lettre: "C", reste: "onclusion", court: "Conclusion" }
  ];
  /* Questions de l'étape « Découverte » : chaque entrée est une question, avec éventuellement des sous-questions. */
  var BLOCS = [
    { id: "perso", lib: "Personnel et professionnel", questions: [
      { t: "État civil et coordonnées : comment souhaitez-vous que l'on travaille ensemble ; par mail ou téléphone ?" },
      { t: "Situation familiale et maritale :", sous: ["Toujours célibataire ?", "Marié sous quel régime ?", "Enfants (demander l'âge, le niveau d'étude, la partie du budget consacrée)."] },
      { t: "Situation professionnelle :", sous: ["Êtes-vous toujours … ?", "Y a-t-il des possibilités d'évolution ?", "Y a-t-il des particularités ?"] },
      { t: "Avez-vous des loisirs ?" }
    ] },
    { id: "fin", lib: "Financier", questions: [
      { t: "Revenus :", sous: ["Salaire fixe, variable, 13e mois, primes.", "Loyers perçus.", "Prestations sociales.", "Rentes et pensions alimentaires perçues."] },
      { t: "Loyer, mensualités de crédit, pensions versées." },
      { t: "Calculer le taux d'endettement (charges / ressources × 100)." },
      { t: "Capacité d'épargne à calculer et questionnaire MIF." },
      { t: "Capacité d'emprunt : ressources × 33 % − prêts − loyer." }
    ] },
    { id: "patri", lib: "Patrimonial", questions: [
      { t: "Êtes-vous toujours locataire, voulez-vous devenir propriétaire ?" },
      { t: "Vous êtes propriétaire :", sous: ["Depuis quand ?", "Mensualité.", "RP / RL / RS ?", "Où ?"] },
      { t: "Je vois que vous avez …, vous l'avez ouvert dans quel but ?" },
      { t: "Afin de mieux vous conseiller, j'ai besoin de savoir si vous disposez d'une épargne chez des confrères ?", sous: ["Montant.", "Versement.", "Fréquence."] },
      { t: "Avez-vous une voiture ?", sous: ["Kilométrage.", "Âge du véhicule."] }
    ] },
    { id: "projets", lib: "Projets", questions: [{ t: "Quoi ?" }, { t: "Où ?" }, { t: "Quand ?" }, { t: "Comment ?" }] }
  ];
  /* Zones de notes (identifiant → libellé) : une par bloc de découverte, le rebond commercial, puis les étapes 4 à 7. */
  var NOTES = {
    perso: "Notes – personnel et professionnel", fin: "Notes – financier", patri: "Notes – patrimonial", projets: "Notes – projets",
    rebond: "Besoin ou produit repéré", accord: "Votre reformulation des besoins", proposition: "Solution proposée au client", argu_car: "Deux ou trois caractéristiques", argu_av: "Avantages pour le client", conclusion: "Choix du client et suite à donner"
  };
  var ORDRE_NOTES = ["perso", "fin", "patri", "projets", "rebond", "accord", "proposition", "argu_car", "argu_av", "conclusion"];
  /* Lignes de la calculette de l'étape « Découverte » : clé, libellé, groupe (r : ressources, c : charges, d : dépenses). */
  var LIGNES = [
    { k: "salaire", lib: "Salaire fixe, variable, 13e mois, primes", g: "r" },
    { k: "loyersPercus", lib: "Loyers perçus", g: "r" },
    { k: "prestations", lib: "Prestations sociales", g: "r" },
    { k: "rentes", lib: "Rentes et pensions alimentaires perçues", g: "r" },
    { k: "loyer", lib: "Loyer ou mensualité du logement", g: "c" },
    { k: "credits", lib: "Mensualités de crédit", g: "c" },
    { k: "pensions", lib: "Pensions versées", g: "c" },
    { k: "depenses", lib: "Dépenses courantes (alimentation, transports, loisirs…)", g: "d" }
  ];
  var CLES = LIGNES.map(function (l) { return l.k; });

  /* ---------- la grille : zones à remplir par le conseiller ----------
     Chaque entrée est une question de la découverte (« bloc-numéro ») ; ses zones sont soit des informations du dossier (dossier : true : coordonnées, adresse, famille, profession, revenu), préremplies avec le dossier et reportées
     dans le dossier à la validation, soit des renseignements recueillis (loisirs, patrimoine, véhicule…) qui rejoignent le dossier tels quels. si : zone affichée seulement selon une autre réponse. */
  var OUINON = [["", "Choisir"], ["oui", "Oui"], ["non", "Non"]];
  var OPTIONS = {
    regime: [["", "Choisir"], ["communaute", "Communauté réduite aux acquêts (régime légal)"], ["separation", "Séparation de biens"], ["participation", "Participation aux acquêts"], ["universelle", "Communauté universelle"]],
    logement: [["", "Choisir"], ["locataire", "Locataire"], ["proprietaire", "Propriétaire"], ["accedant", "Propriétaire (crédit en cours)"], ["heberge", "Hébergé(e) à titre gratuit"]],
    projetProprio: [["", "Choisir"], ["oui", "Oui, il le souhaite"], ["reflexion", "Il y réfléchit"], ["non", "Non"]],
    bienNature: [["", "Choisir"], ["RP", "Résidence principale (RP)"], ["RL", "Résidence locative (RL)"], ["RS", "Résidence secondaire (RS)"]],
    confFrequence: [["", "Choisir"], ["mensuel", "Chaque mois"], ["trimestriel", "Chaque trimestre"], ["annuel", "Chaque année"], ["ponctuel", "De façon ponctuelle"]],
    vehicule: OUINON,
    conjSexe: [["", "Choisir"], ["F", "Une femme"], ["M", "Un homme"]]
  };
  function z(k, lib, type, x) { var o = { k: k, lib: lib, type: type }; for (var i in x) o[i] = x[i]; return o; }
  var COUPLE = { k: "sit", v: ["marie", "pacse", "concubinage"] }, PROPRIO = { k: "logement", v: ["proprietaire", "accedant"] }, LOCATAIRE = { k: "logement", v: ["locataire", "heberge"] };
  var GRILLE = {
    "perso-0": [z("mob", "Mobile *", "tel", { dossier: true, max: 20 }), z("tel", "Téléphone fixe", "tel", { dossier: true, max: 20, aide: "facultatif" }), z("mail", "E-mail *", "mail", { dossier: true, max: DO.MAX_MAIL }), z("pref", "Mode de contact souhaité", "sel", { dossier: true }),
      z("rue", "Adresse *", "text", { dossier: true, max: 80, large: true }), z("cp", "Code postal *", "text", { dossier: true, max: 5, mode: "numeric" }), z("ville", "Commune *", "text", { dossier: true, max: 40 })],
    "perso-1": [z("sit", "Situation familiale *", "sel", { dossier: true }), z("regime", "Régime matrimonial", "sel", { si: { k: "sit", v: ["marie"] } }), z("nbCharge", "Enfants à charge", "text", { dossier: true, max: 1, mode: "numeric" }),
      z("enfants", "Enfants", "area", { dossier: true, max: 400, large: true, aide: "un par ligne : prénom, âge ; par exemple Louise, 12" }), z("etudesEnfants", "Niveau d'études et part du budget consacrée aux enfants", "text", { max: 150, large: true }),
      z("conjPrenom", "Prénom *", "text", { dossier: true, max: 30, groupe: "conj", si: COUPLE }), z("conjNom", "Nom *", "text", { dossier: true, max: 40, groupe: "conj", si: COUPLE }), z("conjSexe", "Femme ou homme *", "sel", { dossier: true, groupe: "conj", si: COUPLE }),
      z("conjAge", "Âge *", "text", { dossier: true, max: 3, mode: "numeric", groupe: "conj", si: COUPLE }), z("conjProf", "Profession", "text", { dossier: true, max: 50, groupe: "conj", si: COUPLE }), z("conjRev", "Revenu net mensuel (€)", "num", { dossier: true, mode: "decimal", groupe: "conj", si: COUPLE })],
    "perso-2": [z("prof", "Profession *", "text", { dossier: true, max: 60 }), z("emp", "Employeur", "text", { dossier: true, max: 60, si: { contrats: true } }), z("ctr", "Contrat de travail *", "sel", { dossier: true, si: { contrats: true } }), z("rev", "Revenu net mensuel (€) *", "num", { dossier: true, mode: "decimal" }),
      z("evolution", "Possibilités d'évolution", "text", { max: 150, large: true }), z("particularites", "Particularités", "text", { max: 150, large: true })],
    "perso-3": [z("loisirs", "Loisirs", "text", { max: 150, large: true })],
    "patri-0": [z("logement", "Logement actuel", "sel", {}), z("projetProprio", "Souhaite devenir propriétaire ?", "sel", { si: LOCATAIRE })],
    "patri-1": [z("bienDepuis", "Depuis quand ?", "text", { max: 40, si: PROPRIO, ctx: "Bien immobilier" }), z("bienMensualite", "Mensualité (€)", "num", { si: PROPRIO, ctx: "Bien immobilier" }), z("bienNature", "RP / RL / RS ?", "sel", { si: PROPRIO, ctx: "Bien immobilier" }), z("bienLieu", "Où ?", "text", { max: 60, si: PROPRIO, ctx: "Bien immobilier" })],
    "patri-2": [z("butProduits", "But de l'ouverture des produits détenus", "text", { max: 200, large: true })],
    "patri-3": [z("confEtab", "Établissement", "text", { max: 60, ctx: "Épargne chez des confrères" }), z("confMontant", "Montant (€)", "num", { ctx: "Épargne chez des confrères" }), z("confVersement", "Versement (€)", "num", { ctx: "Épargne chez des confrères" }), z("confFrequence", "Fréquence", "sel", { ctx: "Épargne chez des confrères" })],
    "patri-4": [z("vehicule", "Véhicule", "sel", {}), z("vehiculeKm", "Kilométrage (km)", "num", { ctx: "Véhicule", entier: true, unite: "km", maxVal: 1000000, si: { k: "vehicule", v: ["oui"] } }), z("vehiculeAge", "Âge du véhicule (ans)", "num", { ctx: "Véhicule", entier: true, unite: "ans", maxVal: 60, si: { k: "vehicule", v: ["oui"] } })]
  };
  var TITRES_BLOCS = { perso: "Personnel et professionnel", patri: "Patrimonial" };
  var LISTE = [];
  Object.keys(GRILLE).forEach(function (q) { GRILLE[q].forEach(function (f) { f.q = q; f.bloc = q.split("-")[0]; LISTE.push(f); }); });
  function champDe(k) { return LISTE.filter(function (f) { return f.k === k; })[0] || null; }
  function champsDe(q) { return GRILLE[q] || []; }
  function options(k, c) {
    if (k === "pref") return DO.ORDRE_PREFS.map(function (x) { return [x, DO.PREFS[x]]; });
    if (k === "sit") return DO.ORDRE_SIT.map(function (x) { return [x, DO.SITUATIONS[x].replace(/\(e\)/g, c && c.sexe === "F" ? "e" : "")]; });
    if (k === "ctr") { var l = c ? DO.contratsDe(c) : null; return l ? l.map(function (x) { return [x, x]; }) : null; }
    return OPTIONS[k] || null;
  }
  /* Libellé lisible hors de la grille (résumé, dossier, impression) : sans astérisque ni point d'interrogation, précédé de sa rubrique s'il y a lieu. */
  function libCourt(f) {
    var l = f.lib.replace(/ \*$/, "").replace(/ \?$/, "");
    if (f.ctx) l = f.ctx + " – " + (/^[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]/.test(l) ? l.charAt(0).toLowerCase() + l.slice(1) : l);
    return l;
  }
  function visible(f, vals, c) {
    if (!f.si) return true;
    if (f.si.contrats) return !!(c && DO.contratsDe(c));
    return f.si.v.indexOf(vals[f.si.k]) >= 0;
  }

  /* ---------- outils de texte ---------- */
  function propre(s) { return String(s == null ? "" : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ""); }
  function espaces(s) { return propre(s).replace(/\s+/g, " ").trim(); }
  function pl(n, s, p) { return n + " " + (n > 1 ? p : s); }
  function nomProduit(pid) { return PR.parId[pid] ? PR.parId[pid].nom : pid; }
  function accorder(txt, fem) { return String(txt).replace(/\(e\)/g, fem ? "e" : ""); }
  function libSituation(c) { var l = S.LIB_SITUATION[c.fam.sit] || c.fam.sit; return l === "Veuf / veuve" ? (c.sexe === "F" ? "Veuve" : "Veuf") : accorder(l, c.sexe === "F"); }
  /* Montant saisi : « 2 150,50 », « 2150.5 », « 800 » ; renvoie un nombre (arrondi au centime), null si vide, NaN si invalide. */
  function nombre(s) {
    var t = String(s == null ? "" : s).replace(/[\s\u00A0\u202F]/g, "").replace(/€$/, "").replace(",", ".");
    if (t === "") return null;
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return NaN;
    var n = Math.round(parseFloat(t) * 100) / 100;
    return n > MAX_MONTANT ? NaN : n;
  }

  /* ---------- état enregistré ---------- */
  function vide() { return { notes: {}, coches: {}, val: {}, grille: {}, maj: "", note: "" }; }
  function lire(st, cid) {
    var e = st && st.entretiens && st.entretiens[cid], r = vide();
    if (!e) return r;
    ORDRE_NOTES.forEach(function (k) { if (e.notes && typeof e.notes[k] === "string") r.notes[k] = e.notes[k].slice(0, MAX_TXT); });
    Object.keys(e.coches || {}).forEach(function (k) { if (e.coches[k] === true && cocheValide(k)) r.coches[k] = true; });
    CLES.forEach(function (k) { if (e.val && typeof e.val[k] === "string") r.val[k] = e.val[k].slice(0, 20); });
    Object.keys(e.grille || {}).forEach(function (k) { if (typeof e.grille[k] === "string" && champDe(k)) r.grille[k] = e.grille[k].slice(0, MAX_CHAMP); });
    r.maj = e.maj || ""; r.note = e.note || "";
    return r;
  }
  function cible(st, cid) {
    if (!st.entretiens || typeof st.entretiens !== "object" || Array.isArray(st.entretiens)) st.entretiens = {};
    if (!st.entretiens[cid]) st.entretiens[cid] = { notes: {}, coches: {}, val: {}, grille: {}, maj: "", note: "" };
    var e = st.entretiens[cid]; e.notes = e.notes || {}; e.coches = e.coches || {}; e.val = e.val || {}; e.grille = e.grille || {};
    return e;
  }
  function noteValide(k) { return ORDRE_NOTES.indexOf(k) >= 0; }
  function cocheValide(k) {
    var m = /^([a-z]+)-(\d+)(?:-(\d+))?$/.exec(k);
    if (!m) return false;
    var b = BLOCS.filter(function (x) { return x.id === m[1]; })[0];
    if (!b) return false;
    var q = b.questions[+m[2]];
    if (!q) return false;
    if (q.sous) return m[3] !== undefined && q.sous[+m[3]] !== undefined;
    return m[3] === undefined;
  }
  function ecrireNote(st, cid, k, txt) { if (!noteValide(k)) return false; var t = propre(txt).slice(0, MAX_TXT); cible(st, cid).notes[k] = t; return true; }
  function cocher(st, cid, k, oui) { if (!cocheValide(k)) return false; var e = cible(st, cid); if (oui) e.coches[k] = true; else delete e.coches[k]; return true; }
  function ecrireValeur(st, cid, k, txt) { if (CLES.indexOf(k) < 0) return false; cible(st, cid).val[k] = String(txt == null ? "" : txt).slice(0, 20); return true; }
  function effacer(st, cid) { if (st.entretiens) delete st.entretiens[cid]; }
  /* Questions abordées / questions de la fiche (une question avec sous-questions compte pour la somme de ses sous-questions). */
  function cles() {
    var l = [];
    BLOCS.forEach(function (b) { b.questions.forEach(function (q, i) { if (q.sous) q.sous.forEach(function (x, j) { l.push(b.id + "-" + i + "-" + j); }); else l.push(b.id + "-" + i); }); });
    return l;
  }
  function avancement(e) {
    var tous = cles();
    return { abordees: tous.filter(function (k) { return e.coches[k]; }).length, total: tous.length };
  }

  /* ---------- calculs de l'étape « Découverte » ---------- */
  function arrondi2(x) { return Math.round(x * 100) / 100; }
  /* v : montants mensuels (nombres ou null). Renvoie les ressources, les charges, le taux d'endettement (%), la capacité d'emprunt (mensualité maximale d'un nouveau crédit)
     et la capacité d'épargne (null tant que les dépenses courantes ne sont pas indiquées). */
  function calculs(v) {
    function n(k) { var x = v && v[k]; return typeof x === "number" && isFinite(x) ? x : 0; }
    var ress = arrondi2(n("salaire") + n("loyersPercus") + n("prestations") + n("rentes"));
    var charges = arrondi2(n("loyer") + n("credits") + n("pensions"));
    var r = { ressources: ress, charges: charges, taux: null, depasse: null, capaciteEmprunt: null, capaciteBrute: null, capaciteEpargne: null };
    if (ress > 0) {
      r.taux = Math.round(charges / ress * 1000) / 10;
      r.depasse = r.taux > TAUX_REF + 1e-9;
      r.capaciteBrute = arrondi2(ress * TAUX_REF / 100 - n("credits") - n("loyer"));
      r.capaciteEmprunt = Math.max(0, r.capaciteBrute);
    }
    if (v && typeof v.depenses === "number" && isFinite(v.depenses)) r.capaciteEpargne = arrondi2(ress - charges - v.depenses);
    return r;
  }
  /* Montants proposés au départ, d'après les données de la banque (à confirmer avec le client) : revenus du foyer selon le statut, loyer, mensualités de crédit en cours. */
  function defauts(c) {
    var d = { salaire: null, loyersPercus: null, prestations: null, rentes: null, loyer: null, credits: null, pensions: null, depenses: null };
    var foyer = c.pro && c.pro.foyer ? c.pro.foyer : 0;
    if (foyer > 0) { if (c.pro.statut === "retraite") d.rentes = foyer; else if (c.pro.statut === "chomage") d.prestations = foyer; else d.salaire = foyer; }
    if (c.log && c.log.st === "locataire" && c.log.loyer) d.loyer = c.log.loyer;
    var m = arrondi2(EL.mensualites(c));
    if (m > 0) d.credits = m;
    return d;
  }
  /* Valeurs utilisées pour le calcul : ce que le conseiller a saisi, sinon les données de la banque. Renvoie { val: {clé: nombre|null}, saisi: {clé: bool}, invalides: [clés] }. */
  function valeurs(c, e) {
    var def = defauts(c), val = {}, saisi = {}, inval = [];
    CLES.forEach(function (k) {
      var brut = e && e.val ? e.val[k] : undefined;
      if (brut !== undefined) {
        var x = nombre(brut);
        saisi[k] = true;
        if (x !== x) { inval.push(k); val[k] = null; } else val[k] = x;
      } else { val[k] = def[k]; saisi[k] = false; }
    });
    return { val: val, saisi: saisi, invalides: inval };
  }

  /* ---------- la grille : valeurs, aperçu des changements, validation ---------- */
  function ecrireGrille(st, cid, k, txt) { if (!champDe(k)) return false; cible(st, cid).grille[k] = propre(txt).replace(/[\r\n]+/g, champDe(k).type === "area" ? "\n" : " ").slice(0, MAX_CHAMP); return true; }
  /* Valeurs du dossier au format de la grille (coordonnées, adresse, famille, profession, revenu). */
  function baseDossier(c, st) {
    var v = DO.valeursDecl(c); v.tel = c.tel || ""; v.mob = c.mob || ""; v.mail = c.mail || ""; v.pref = DO.pref(st, c.id);
    return v;
  }
  function enregistre(st, cid) { var i = st && st.infos && st.infos[cid]; return i && i.entretien && i.entretien.champs ? i.entretien.champs : {}; }
  function valeursGrille(c, st) {
    var e = lire(st, c.id), b = baseDossier(c, st), s = enregistre(st, c.id), d = { logement: c.log && c.log.st ? c.log.st : "", vehicule: c.veh ? "oui" : "non" }, r = {};
    LISTE.forEach(function (f) {
      var k = f.k;
      if (e.grille[k] !== undefined) r[k] = e.grille[k];
      else if (f.dossier) r[k] = b[k] == null ? "" : String(b[k]);
      else r[k] = s[k] !== undefined ? s[k] : (d[k] !== undefined ? d[k] : "");
    });
    return r;
  }
  /* Texte à afficher pour la valeur d'une zone (libellé d'une liste, montant, unité). */
  function affiche(f, v, c) {
    v = String(v == null ? "" : v);
    if (v === "") return "";
    if (f.type === "sel") { var o = options(f.k, c) || [], x = o.filter(function (y) { return y[0] === v; })[0]; return x ? x[1] : v; }
    if (f.type === "num") { var n = nombre(v); if (n !== n || n == null) return v; return f.unite ? String(n).replace(".", ",") + " " + f.unite : B.eur2(n); }
    return v;
  }
  /* Contrôle des renseignements recueillis (zones qui ne sont pas des informations du dossier) : renvoie { ok, champs } ou { ok: false, champ, erreur }. */
  function controleInfos(vals, c) {
    var champs = {};
    for (var i = 0; i < LISTE.length; i++) {
      var f = LISTE[i];
      if (f.dossier || !visible(f, vals, c)) continue;
      var v = espaces(vals[f.k]);
      if (v === "") continue;
      if (f.type === "sel") { if (!(options(f.k, c) || []).some(function (o) { return o[0] === v; })) return { ok: false, champ: f.k, erreur: "Choisissez « " + f.lib.replace(/ \*$/, "") + " » dans la liste." }; }
      else if (f.type === "num") {
        var n = nombre(v);
        if (n !== n || n == null) return { ok: false, champ: f.k, erreur: "« " + f.lib.replace(/ \*$/, "") + " » : saisissez un nombre" + (f.entier ? " entier" : " en euros, par exemple 850,50") + "." };
        if (f.entier && (n % 1 !== 0 || n > f.maxVal)) return { ok: false, champ: f.k, erreur: "« " + f.lib.replace(/ \*$/, "") + " » : un nombre entier de 0 à " + f.maxVal + "." };
        v = String(n);
      } else if (v.length > f.max) return { ok: false, champ: f.k, erreur: "« " + f.lib.replace(/ \*$/, "") + " » est limité à " + f.max + " caractères." };
      champs[f.k] = v;
    }
    return { ok: true, champs: champs };
  }
  /* Renseignements à verser au dossier : ceux que le conseiller a saisis ou que le dossier contenait déjà (les valeurs seulement préremplies, logement et véhicule, ne comptent pas tant qu'on n'y touche pas). */
  function retenus(c, st, champs) {
    var e = lire(st, c.id), s = enregistre(st, c.id), r = {};
    Object.keys(champs).forEach(function (k) { if (e.grille[k] !== undefined || s[k] !== undefined) r[k] = champs[k]; });
    return r;
  }
  /* Ce que la validation va changer dans le dossier : une ligne par rubrique modifiée (avant → après). */
  var RUBRIQUES = [["Mobile", ["mob"]], ["Téléphone fixe", ["tel"]], ["E-mail", ["mail"]], ["Mode de contact souhaité", ["pref"]], ["Adresse", ["rue", "cp", "ville"]], ["Situation familiale", ["sit"]],
    ["Conjoint ou partenaire", ["conjPrenom", "conjNom", "conjSexe", "conjAge", "conjProf", "conjRev"]], ["Enfants", ["enfants", "nbCharge"]], ["Profession et employeur", ["prof", "emp", "ctr"]], ["Revenu net mensuel", ["rev"]]];
  function resume(vals, ks, c) {
    return ks.map(function (k) { var f = champDe(k), v = String(vals[k] == null ? "" : vals[k]).trim(); return f && f.type === "sel" ? affiche(f, v, c) : f && f.type === "num" && v ? B.eur2(nombre(v) || 0) : v.replace(/\n/g, " ; "); }).filter(Boolean).join(", ");
  }
  function apercu(c, st) {
    var vals = valeursGrille(c, st), base = baseDossier(c, st), couple = !!DO.COUPLES[vals.sit], ch = [];
    RUBRIQUES.forEach(function (r) {
      var ks = r[1].filter(function (k) { var f = champDe(k); return f && visible(f, vals, c); }), disparait = r[0] === "Conjoint ou partenaire" && !couple && !!DO.COUPLES[base.sit];
      if (!ks.length && !disparait) return;
      var diff = disparait || ks.some(function (k) { return String(vals[k] == null ? "" : vals[k]).trim() !== String(base[k] == null ? "" : base[k]).trim(); });
      if (diff) ch.push({ lib: r[0], avant: resume(base, r[1], c) || "non renseigné", apres: resume(couple || r[0] !== "Conjoint ou partenaire" ? vals : {}, r[1], c) || "non renseigné" });
    });
    var inf = controleInfos(vals, c), infos = [];
    if (inf.ok) inf.champs = retenus(c, st, inf.champs);
    if (inf.ok) LISTE.forEach(function (f) { if (inf.champs[f.k] !== undefined) infos.push({ k: f.k, lib: f.lib, val: affiche(f, inf.champs[f.k], c), bloc: f.bloc }); });
    var e = lire(st, c.id), v = valeurs(c, e), saisi = Object.keys(v.saisi).some(function (x) { return v.saisi[x]; });
    return { changements: ch, infos: infos, erreurInfos: inf.ok ? null : inf, finances: saisi && calculs(v.val).ressources > 0 };
  }
  /* Situation financière retenue à la validation (montants saisis ou confirmés pendant l'entretien et résultats) ; null si rien n'a été saisi. */
  function finances(c, e) {
    var v = valeurs(c, e), k = calculs(v.val), saisi = Object.keys(v.saisi).some(function (x) { return v.saisi[x]; });
    if (!saisi || !(k.ressources > 0)) return null;
    var m = {}; CLES.forEach(function (x) { if (v.val[x] != null) m[x] = v.val[x]; });
    return { montants: m, ressources: k.ressources, charges: k.charges, taux: k.taux, capaciteEmprunt: k.capaciteEmprunt, capaciteEpargne: k.capaciteEpargne };
  }
  /* Ce que l'entretien a versé au dossier du client : { date, par, champs, finances } ou null. */
  function entretienDe(st, cid) { var i = st && st.infos && st.infos[cid]; return i && i.entretien && i.entretien.date ? i.entretien : null; }
  /* Renseignements du dossier, par rubrique : [{ titre, lignes: [{ lib, val }] }]. */
  function lignesDossier(c, st) {
    var x = entretienDe(st, c.id), g = [];
    if (!x) return g;
    Object.keys(TITRES_BLOCS).forEach(function (b) {
      var l = LISTE.filter(function (f) { return f.bloc === b && !f.dossier && x.champs[f.k] !== undefined; }).map(function (f) { return { lib: libCourt(f), val: affiche(f, x.champs[f.k], c) }; });
      if (l.length) g.push({ titre: TITRES_BLOCS[b], lignes: l });
    });
    if (x.finances) {
      var f = x.finances, l2 = [{ lib: "Ressources mensuelles", val: B.eur2(f.ressources) }, { lib: "Charges mensuelles", val: B.eur2(f.charges) }, { lib: "Taux d'endettement", val: B.pct(f.taux) }, { lib: "Capacité d'emprunt", val: B.eur2(f.capaciteEmprunt) + " par mois" }];
      if (f.capaciteEpargne != null) l2.push({ lib: "Capacité d'épargne", val: B.eur2(f.capaciteEpargne) + " par mois" });
      g.push({ titre: "Financier", lignes: l2 });
    }
    return g;
  }
  /* Validation de l'entretien : met le dossier à jour avec ce qui a changé dans la grille, y verse les renseignements recueillis et la situation financière, et (option) ajoute le résumé aux notes.
     Rien n'est enregistré tant que tout n'est pas valide. options : { note: true }. */
  function valider(st, c, options) {
    var o = options || {}, vals = valeursGrille(c, st), ie = controleInfos(vals, c);
    if (!ie.ok) return ie;
    ie.champs = retenus(c, st, ie.champs);
    var saisie = { tel: vals.tel, mob: vals.mob, mail: vals.mail, pref: vals.pref, decl: {} };
    Object.keys(DO.valeursDecl(c)).forEach(function (k) { saisie.decl[k] = vals[k]; });
    var e0 = lire(st, c.id), fin = finances(c, e0), typees = LISTE.filter(function (f) { return !f.dossier && e0.grille[f.k] !== undefined && ie.champs[f.k] !== undefined; }).length;
    var r = mettreAJour(st, c, saisie, { note: o.note });
    if (!r.ok) return r;
    if (!st.infos[c.id]) st.infos[c.id] = {};
    st.infos[c.id].entretien = { date: B.ymd(B.aujourdhui()), par: (st.eleve && st.eleve.nom) || "", champs: ie.champs, finances: fin };
    var e = cible(st, c.id); e.grille = {};   /* les zones reflètent désormais le dossier */
    r.infos = Object.keys(ie.champs).length; r.finances = !!fin; r.typees = typees;
    return r;
  }

  /* ---------- étape 1 : ce que la banque sait déjà ---------- */
  function datePhrase(j) { return B.fmtDate(B.dateJours(j)); }
  function donneesConnues(c, st) {
    var fem = c.sexe === "F", f = c.fam, p = c.pro, g = [];
    var fam = [libSituation(c)];
    if (f.conj) fam.push((f.sit === "marie" ? (f.conj.sexe === "F" ? "épouse" : "époux") : f.sit === "pacse" ? "partenaire de PACS" : (f.conj.sexe === "F" ? "compagne" : "compagnon")) + " : " + f.conj.prenom + " " + RIB.coTitulaire(c).nom.toUpperCase() + ", " + f.conj.age + " ans, " + f.conj.prof + (f.conj.rev ? " (" + B.eur(f.conj.rev) + " net par mois)" : ""));
    fam.push(f.enf.length ? pl(f.enf.length, "enfant", "enfants") + " : " + f.enf.map(function (x) { return x.prenom + " (" + (x.age === 0 ? "moins d'un an" : pl(x.age, "an", "ans")) + ")"; }).join(", ") + (f.nbCharge ? ", dont " + f.nbCharge + " à charge" : "") : "pas d'enfant");
    g.push({ id: "famille", titre: "Famille", lignes: fam });
    var stat = accorder(S.LIB_STATUT[p.statut] || p.statut, fem), pro = [p.prof.toLowerCase().indexOf(stat.slice(0, 5).toLowerCase()) === 0 ? p.prof : stat + " – " + p.prof];
    if (["salarie", "fonctionnaire", "apprenti", "independant"].indexOf(p.statut) >= 0) pro.push((p.statut === "independant" ? "Activité" : "Employeur") + " : " + p.emp + (p.ctr ? " (" + p.ctr + ")" : ""));
    pro.push("Revenus du foyer : " + (p.foyer ? B.eur(p.foyer) + " par mois" : "non renseignés"));
    g.push({ id: "pro", titre: "Situation professionnelle et revenus", lignes: pro });
    var lg = c.log || {}, log = [accorder(S.LIB_LOGEMENT[lg.st] || lg.st, fem)];
    if (lg.st === "locataire" && lg.loyer) log.push("loyer de " + B.eur(lg.loyer) + " par mois");
    if (lg.st === "accedant" && lg.bien) log.push("bien acheté " + B.eur(lg.bien));
    log.push(c.veh ? "possède un véhicule" : "pas de véhicule connu");
    g.push({ id: "logement", titre: "Logement et véhicule", lignes: [log.join(", ")] });
    var pro2 = [];
    pro2.push(nomProduit(c.cpt.p) + (f.conj ? " (compte joint avec " + f.conj.prenom + ")" : "") + (c.cpt.dec ? ", découvert autorisé de " + B.eur(c.cpt.dec) : ""));
    c.cartes.forEach(function (x) { pro2.push(nomProduit(x.p)); });
    c.epa.forEach(function (x) { pro2.push(nomProduit(x.p) + " : " + B.eur(x.solde)); });
    c.plc.forEach(function (x) { pro2.push(nomProduit(x.p) + " : " + B.eur(x.solde)); });
    c.cre.forEach(function (x) { pro2.push(nomProduit(x.p) + " : " + B.eur2(x.mens) + " par mois" + (x.ext ? " (chez " + x.ext + ")" : "")); });
    c.ass.forEach(function (x) { pro2.push(nomProduit(x.p)); });
    g.push({ id: "produits", titre: "Produits détenus", lignes: pro2 });
    var prj = c.prj.map(function (x) { return x.lib + (x.detail ? " (" + x.detail + ")" : ""); });
    ((st && st.infos && st.infos[c.id] && st.infos[c.id].projets) || []).forEach(function (x) { prj.push(x.lib + (x.ech ? " – " + x.ech : "") + (x.detail ? " (" + x.detail + ")" : "")); });
    g.push({ id: "projets", titre: "Projets connus", lignes: prj.length ? prj : ["Aucun projet connu"] });
    var pts = S.alertes(c).map(function (a) { return a.titre; });
    S.opportunites(c).slice(0, 3).forEach(function (o) { pts.push(o.titre); });
    g.push({ id: "points", titre: "Points d'attention et opportunités", lignes: pts.length ? pts : ["Aucun point d'attention ni opportunité détectée"] });
    var nts = c.not.map(function (n) { return { d: B.dateContact(n.j), t: n.objet + " : " + n.txt }; });
    ((st && st.notes && st.notes[c.id]) || []).forEach(function (n) { nts.push({ d: B.lireYmd(n.d), t: n.objet + " : " + n.txt }); });
    nts.sort(function (a, b) { return b.d - a.d; });
    g.push({ id: "note", titre: "Dernière note du dossier", lignes: nts.length ? [B.fmtDate(nts[0].d) + " – " + (nts[0].t.length > 260 ? nts[0].t.slice(0, 257) + "…" : nts[0].t)] : ["Aucune note dans le dossier"] });
    return g;
  }

  /* ---------- résumé de l'entretien (note du dossier) ---------- */
  function compteRendu(c, st, modifies) {
    var e = lire(st, c.id), v = valeurs(c, e), k = calculs(v.val), t = [];
    var saisiCalc = Object.keys(v.saisi).some(function (x) { return v.saisi[x]; });
    var vg = valeursGrille(c, st), typees = LISTE.filter(function (f) { return !f.dossier && e.grille[f.k] !== undefined && espaces(e.grille[f.k]) && visible(f, vg, c); });
    if (!saisiCalc && !typees.length && !ORDRE_NOTES.some(function (x) { return espaces(e.notes[x]); })) return "";
    function ajoute(lib, txt) { txt = espaces(txt); if (txt) t.push(lib + " : " + txt); }
    ajoute("Personnel et professionnel", e.notes.perso);
    ajoute("Renseignements recueillis", typees.map(function (f) { return libCourt(f) + " : " + affiche(f, vg[f.k], c); }).join(" ; "));
    if (modifies && modifies.length) ajoute("Dossier mis à jour", modifies.join(", "));
    var fin = espaces(e.notes.fin), chiffres = "";
    if (saisiCalc && k.ressources > 0) chiffres = "ressources " + B.eur2(k.ressources) + ", charges " + B.eur2(k.charges) + ", taux d'endettement " + B.pct(k.taux) + ", capacité d'emprunt " + B.eur2(k.capaciteEmprunt) + " par mois" + (k.capaciteEpargne != null ? ", capacité d'épargne " + B.eur2(k.capaciteEpargne) + " par mois" : "");
    ajoute("Financier", (chiffres ? chiffres + (fin ? ". " : "") : "") + fin);
    ajoute("Patrimonial", e.notes.patri);
    ajoute("Projets", e.notes.projets);
    ajoute("Rebond commercial", e.notes.rebond);
    ajoute("Accord de découverte", e.notes.accord);
    ajoute("Proposition", e.notes.proposition);
    var arg = [espaces(e.notes.argu_car), espaces(e.notes.argu_av)].filter(Boolean).join(" ; ");
    ajoute("Argumentation", arg);
    ajoute("Conclusion", e.notes.conclusion);
    var s = t.join(". ").replace(/\.\./g, ".");
    return s.length > MAX_NOTE ? s.slice(0, MAX_NOTE - 1).replace(/\s+\S*$/, "") + "…" : s;
  }
  function uid() { return "e" + B.maintenant().getTime().toString(36) + Math.random().toString(36).slice(2, 6); }
  /* Ajoute le résumé aux notes de rendez-vous du dossier ; une seule note d'entretien par jour et par client (elle est remplacée si on enregistre de nouveau). */
  function enregistrerNote(st, c, modifies) {
    var txt = compteRendu(c, st, modifies);
    if (txt.length < 5) return { ok: false, champ: "note", erreur: "Rien à ajouter aux notes du dossier : remplissez au moins une zone de notes ou un montant de l'entretien." };
    var auj = B.ymd(B.aujourdhui());
    if (!st.notes[c.id]) st.notes[c.id] = [];
    var l = st.notes[c.id], ex = l.filter(function (n) { return n.src === "entretien" && n.d === auj; })[0], par = (st.eleve && st.eleve.nom) || "";
    if (ex) { ex.txt = txt; ex.par = par; return { ok: true, note: ex, remplacee: true }; }
    var n = { id: uid(), d: auj, canal: "Entretien en agence", objet: "Entretien client – découverte", txt: txt, par: par, src: "entretien" };
    l.push(n);
    return { ok: true, note: n, remplacee: false };
  }
  /* ---------- projets du dossier ---------- */
  function ajouterProjet(st, cid, p) {
    var quoi = espaces(p && p.quoi), ou = espaces(p && p.ou), quand = espaces(p && p.quand), comment = espaces(p && p.comment);
    if (quoi.length < 3) return { ok: false, champ: "quoi", erreur: "Indiquez le projet (3 caractères au moins), par exemple « Achat de la résidence principale »." };
    if (quoi.length > 120) return { ok: false, champ: "quoi", erreur: "Le projet est limité à 120 caractères." };
    if (quand.length > 60) return { ok: false, champ: "quand", erreur: "L'échéance est limitée à 60 caractères." };
    var det = [ou ? "où : " + ou : "", comment ? "comment : " + comment : ""].filter(Boolean).join(" ; ");
    if (det.length > 200) return { ok: false, champ: "comment", erreur: "Le lieu et les modalités sont limités à 200 caractères au total." };
    if (!st.infos[cid]) st.infos[cid] = {};
    if (!st.infos[cid].projets) st.infos[cid].projets = [];
    var x = { id: uid(), lib: quoi, ech: quand, detail: det ? det.charAt(0).toUpperCase() + det.slice(1) : "" };
    st.infos[cid].projets.push(x);
    return { ok: true, projet: x };
  }
  /* ---------- mise à jour du dossier à l'issue de l'entretien ----------
     saisie = { tel, mob, mail, pref, decl } (decl : informations déclarées, voir dossier.js ; facultatif) ; options = { note: true pour ajouter le résumé aux notes de rendez-vous }. */
  function mettreAJour(st, c, saisie, options) {
    var o = options || {}, r = DO.controle(saisie);
    if (!r.ok) return r;
    if (saisie && saisie.decl) { var dd = DO.controleDecl(saisie.decl, c); if (!dd.ok) return dd; }   /* rien n'est enregistré tant que tout n'est pas valide */
    var n = null, noteVide = false;
    var m = DO.maj(st, c, saisie);
    if (!m.ok) return m;
    if (o.note) { n = enregistrerNote(st, c, m.modifies); if (!n.ok) { n = null; noteVide = true; } }   /* fiche vide : pas de note, mais le dossier est quand même mis à jour ; le résumé reprend les informations mises à jour */
    var e = cible(st, c.id); e.maj = m.date; e.note = n ? n.note.id : e.note;
    return { ok: true, date: m.date, modifies: m.modifies, note: n, noteVide: noteVide, kycEfface: true };
  }

  var api = {
    TAUX_REF: TAUX_REF, MAX_TXT: MAX_TXT, MAX_NOTE: MAX_NOTE, MAX_MONTANT: MAX_MONTANT, ETAPES: ETAPES, BLOCS: BLOCS, NOTES: NOTES, ORDRE_NOTES: ORDRE_NOTES, LIGNES: LIGNES,
    nombre: nombre, lire: lire, ecrireNote: ecrireNote, cocher: cocher, ecrireValeur: ecrireValeur, effacer: effacer, cles: cles, avancement: avancement,
    calculs: calculs, defauts: defauts, valeurs: valeurs, donneesConnues: donneesConnues, compteRendu: compteRendu, enregistrerNote: enregistrerNote,
    ajouterProjet: ajouterProjet, mettreAJour: mettreAJour, libSituation: libSituation,
    GRILLE: GRILLE, ZONES: LISTE, OPTIONS: OPTIONS, MAX_CHAMP: MAX_CHAMP, TITRES_BLOCS: TITRES_BLOCS, champDe: champDe, champsDe: champsDe, options: options, visible: visible, libCourt: libCourt, ecrireGrille: ecrireGrille, valeursGrille: valeursGrille, baseDossier: baseDossier, affiche: affiche,
    controleInfos: controleInfos, retenus: retenus, apercu: apercu, finances: finances, entretienDe: entretienDe, lignesDossier: lignesDossier, valider: valider
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.entretien = api; }
})(typeof window !== "undefined" ? window : null);
