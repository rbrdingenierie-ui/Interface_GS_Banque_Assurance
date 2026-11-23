/* GS Banque & Assurance – portefeuille clients : une ligne par client avec ses indicateurs, filtres, tris, résumé d'un résultat et cibles enregistrées.
   Tout est calculé à partir des dossiers (clients fictifs) et de la date de connexion à l'outil ; rien n'est figé : l'âge, l'éligibilité, le dernier contact
   ou les opportunités d'une cible enregistrée sont recalculés à chaque ouverture. Les cibles et les notes de l'élève viennent de la sauvegarde du navigateur. */
(function (root) {
  "use strict";

  var B = root && root.SGBF ? root.SGBF.banque : require("./banque.js");
  var PR = root && root.SGBF ? root.SGBF.produits : require("./produits.js");
  var S = root && root.SGBF ? root.SGBF.synthese : require("./synthese.js");
  var A = root && root.SGBF ? root.SGBF.analyse : require("./analyse.js");
  var E = root && root.SGBF ? root.SGBF.eligibilite : require("./eligibilite.js");
  var M = root && root.SGBF ? root.SGBF.mouvements : require("./mouvements.js");
  var CL = root && root.SGBF ? root.SGBF.clients : require("./data_clients.js").clients;

  /* icc.js et catalogue.js peuvent être chargés après ce module : on les cherche au moment de s'en servir. */
  function module_(nom) { return root && root.SGBF && root.SGBF[nom] ? root.SGBF[nom] : (typeof require === "function" ? require("./" + nom + ".js") : null); }
  /* Niveaux de l'ICC (Indice de Commercialité Client) : valeur du filtre, code de icc.js, libellé. Un test compare cette liste à icc.js. */
  var ICC = [
    { v: "rouge", code: "rouge", rang: 0, lib: "ICC rouge" }, { v: "orange", code: "orange", rang: 1, lib: "ICC orange" }, { v: "jaune", code: "jaune", rang: 2, lib: "ICC jaune" },
    { v: "vert", code: "vert", rang: 3, lib: "ICC vert" }, { v: "vertplus", code: "vert+", rang: 4, lib: "ICC vert+" }
  ];
  var ICC_PAR_CODE = {}; ICC.forEach(function (n) { ICC_PAR_CODE[n.code] = n; });

  var MAX_CIBLES = 30, MAX_NOM = 60, MAX_NOTE = 300;
  var DIM = {};
  A.DIMENSIONS.forEach(function (d) { DIM[d.id] = d; });

  function norm(s) { return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[-'’]/g, " ").replace(/\s+/g, " ").trim(); }
  function nomListe(c) { return c.nom.toUpperCase() + " " + c.prenom; }

  /* ---------- une ligne par client ---------- */
  /* Partie qui ne dépend que de la date : calculée une fois par jour. */
  var cacheBase = null, cleBase = null;
  function base() {
    var cle = B.ymd(B.aujourdhui()) + "|" + CL.length;
    if (cacheBase && cleBase === cle) return cacheBase;
    var ind = A.tous(CL), an = S.analyser(CL);
    cacheBase = ind.map(function (x) {
      var c = x.c;
      return {
        c: c, id: c.id, nom: nomListe(c), age: c.age, pcs: A.pcs(c), arr: parseInt(c.adr.cp.slice(3), 10), foyer: c.pro.foyer || 0,
        revDom: E.revenusDomicilies(c), nbProduits: x.nbProduits, encours: x.encours, projet: x.projet,
        opps: an.opp[c.id], alertes: an.alt[c.id], depuis: c.depuis, solde: M.resume(c, 90).solde,
        contactDossier: x.dernierContact
      };
    });
    cleBase = cle;
    return cacheBase;
  }
  function viderCache() { cacheBase = null; cleBase = null; cacheElig = {}; }
  /* Dernier contact : notes du dossier (banque) et notes ajoutées par l'élève dans la fiche client. Renvoie le nombre de jours écoulés et la date
     telle que la fiche client l'affiche (jour ouvré), ou null s'il n'y a aucun contact. */
  function dernierContact(r, st) {
    var auj = B.aujourdhui(), res = r.contactDossier === null ? null : { j: r.contactDossier, date: B.dateContact(r.contactDossier) };
    ((st && st.notes && st.notes[r.id]) || []).forEach(function (n) {
      var d = B.lireYmd(n.d);
      if (!d) return;
      var j = Math.max(0, B.ecartJours(auj, d));
      if (res === null || j < res.j) res = { j: j, date: d };
    });
    return res;
  }
  function lignes(st) {
    /* Produits souscrits par l'élève dans l'exercice (catalogue), par client : ils comptent comme « déjà détenus » pour le filtre d'éligibilité. */
    var sous = {};
    ((st && st.souscriptions) || []).forEach(function (x) { (sous[x.c] = sous[x.c] || {})[x.p] = true; });
    var I = module_("icc");
    return base().map(function (r) {
      var o = Object.create(r), d = dernierContact(r, st);
      o.dernier = d ? d.j : null; o.dernierDate = d ? d.date : null; o.souscrits = sous[r.id] || null;
      /* ICC du client avec ses produits souscrits dans l'exercice (même calcul que la fiche client 360) */
      var n = I ? I.depuisClient(r.c, st) : null;
      o.icc = n ? n.code : null; o.iccRang = n ? n.rang : -1; o.societaire = n ? n.faits.societaire : null;
      return o;
    });
  }

  /* ---------- filtres ---------- */
  var OPP = [
    { v: "PLAFOND", lib: "Livret A proche du plafond" }, { v: "LEP", lib: "Éligible au LEP, non détenu" }, { v: "PROJET", lib: "Projet connu à relancer" },
    { v: "FINCREDIT", lib: "Crédit bientôt soldé" }, { v: "RENEGO", lib: "Prêt immobilier au-dessus du marché" }, { v: "MAJORITE", lib: "Bientôt majeur(e)" },
    { v: "RETRAITE", lib: "Approche de la retraite" }, { v: "NOUVEAU", lib: "Nouveau client" }, { v: "PEU", lib: "Client peu équipé" }, { v: "CONTACT", lib: "Contact ancien ou absent" }
  ];
  var ALERTES = [{ v: "DEBITEUR", lib: "Solde débiteur" }, { v: "CARTE", lib: "Carte à renouveler" }, { v: "KYC", lib: "Dossier à actualiser" }];
  var SITUATIONS = [
    { v: "eligible", lib: "Éligibles" }, { v: "possible", lib: "Éligibles ou à examiner" }, { v: "examiner", lib: "À examiner" },
    { v: "non", lib: "Non éligibles" }, { v: "detenu", lib: "Détenant déjà le produit" }
  ];
  var CONTACTS = [
    { v: "recent", lib: "Dans les 3 derniers mois" }, { v: "moyen", lib: "Il y a 3 à 12 mois" },
    { v: "ancien", lib: "Il y a plus d'un an" }, { v: "jamais", lib: "Aucun contact enregistré" }
  ];
  function optionsDim(id) { return DIM[id].segments.map(function (lib, i) { return { v: String(i), lib: lib }; }); }
  var STATUTS = ["salarie", "fonctionnaire", "independant", "apprenti", "chomage", "etudiant", "retraite", "foyer"];
  var cacheElig = {};
  function verdict(c, pid) {
    var cle = B.ymd(B.aujourdhui()) + "|" + pid, t = cacheElig[cle];
    if (!t) { t = cacheElig[cle] = {}; CL.forEach(function (x) { t[x.id] = E.evaluer(x, pid).verdict; }); }
    return t[c.id];
  }
  function dimTest(id) { return function (r, v) { return DIM[id].classer(r.c) === parseInt(v, 10); }; }

  /* Critères sous forme de listes déroulantes. « v » vide = pas de filtre. */
  var CRITERES = [
    { id: "pcs", lib: "Catégorie socioprofessionnelle", options: A.GROUPES.map(function (g) { return { v: String(g.id), lib: g.court }; }), test: function (r, v) { return r.pcs === parseInt(v, 10); } },
    { id: "statut", lib: "Situation professionnelle", options: STATUTS.map(function (k) { return { v: k, lib: S.LIB_STATUT[k] }; }), test: function (r, v) { return r.c.pro.statut === v; } },
    { id: "age", lib: "Tranche d'âge", options: optionsDim("age"), test: dimTest("age") },
    { id: "arrondissement", lib: "Arrondissement", options: optionsDim("arrondissement"), test: dimTest("arrondissement") },
    { id: "famille", lib: "Situation familiale", options: optionsDim("famille"), test: dimTest("famille") },
    { id: "logement", lib: "Logement", options: optionsDim("logement"), test: dimTest("logement") },
    { id: "revenu", lib: "Revenus mensuels du foyer", options: optionsDim("revenu"), test: dimTest("revenu") },
    { id: "equipement", lib: "Nombre de produits à GS", options: optionsDim("equipement"), test: dimTest("equipement") },
    { id: "anciennete", lib: "Ancienneté de la relation", options: optionsDim("anciennete"), test: dimTest("anciennete") },
    { id: "icc", lib: "Indice de commercialité client (ICC)", options: ICC.map(function (n) { return { v: n.v, lib: n.lib }; }), test: function (r, v) { return r.icc !== null && r.icc === ICC.filter(function (n) { return n.v === v; })[0].code; } },
    { id: "societaire", lib: "Sociétaire (parts sociales)", options: [{ v: "oui", lib: "Sociétaires" }, { v: "non", lib: "Non sociétaires" }], test: function (r, v) { return v === "oui" ? r.societaire === true : r.societaire === false; } },
    { id: "opp", lib: "Opportunité détectée", options: [{ v: "any", lib: "Au moins une opportunité" }, { v: "none", lib: "Aucune opportunité" }].concat(OPP),
      test: function (r, v) { return v === "any" ? r.opps.length > 0 : v === "none" ? r.opps.length === 0 : r.opps.some(function (o) { return o.code === v; }); } },
    { id: "alerte", lib: "Alerte de gestion", options: [{ v: "any", lib: "Au moins une alerte" }, { v: "none", lib: "Aucune alerte" }].concat(ALERTES),
      test: function (r, v) { return v === "any" ? r.alertes.length > 0 : v === "none" ? r.alertes.length === 0 : r.alertes.some(function (o) { return o.code === v; }); } },
    { id: "projet", lib: "Projet noté dans le dossier", options: [{ v: "oui", lib: "Avec un projet" }, { v: "non", lib: "Sans projet" }], test: function (r, v) { return v === "oui" ? r.projet : !r.projet; } },
    { id: "contact", lib: "Dernier contact", options: CONTACTS,
      test: function (r, v) { var j = r.dernier; return v === "jamais" ? j === null : j === null ? false : v === "recent" ? j <= 90 : v === "moyen" ? j > 90 && j <= 365 : j > 365; } }
  ];
  var CRIT = {};
  CRITERES.forEach(function (k) { CRIT[k.id] = k; });

  function filtresVides() {
    var f = { q: "", produit: "", situation: "eligible" };
    CRITERES.forEach(function (k) { f[k.id] = ""; });
    return f;
  }
  function valideChoix(id, v) { return CRIT[id].options.some(function (o) { return o.v === v; }) ? v : ""; }
  /* Remet en ordre des filtres venus d'une adresse ou d'une sauvegarde : toute valeur inconnue est ignorée. */
  function nettoyer(f) {
    var o = filtresVides();
    f = f || {};
    o.q = String(f.q || "").slice(0, 80);
    CRITERES.forEach(function (k) { o[k.id] = valideChoix(k.id, String(f[k.id] == null ? "" : f[k.id])); });
    o.produit = PR.parId[f.produit] ? f.produit : "";
    o.situation = SITUATIONS.some(function (s) { return s.v === f.situation; }) ? f.situation : "eligible";
    return o;
  }
  function nbFiltres(f) { var n = f.q.trim() ? 1 : 0; CRITERES.forEach(function (k) { if (f[k.id]) n++; }); if (f.produit) n++; return n; }

  function texteCherche(r) { var c = r.c; return norm(c.prenom + " " + c.nom + " " + c.nom + " " + c.prenom + " " + c.num + " " + c.pro.prof + " " + c.adr.ville + " " + c.adr.cp); }
  function correspond(r, f, mots) {
    for (var i = 0; i < CRITERES.length; i++) { var k = CRITERES[i]; if (f[k.id] && !k.test(r, f[k.id])) return false; }
    if (f.produit) {
      var vd = verdict(r.c, f.produit);
      if (vd !== "detenu" && r.souscrits && r.souscrits[f.produit]) vd = "detenu";
      if (f.situation === "possible" ? !(vd === "eligible" || vd === "examiner") : vd !== f.situation) return false;
    }
    if (mots.length) { var t = texteCherche(r); for (var j = 0; j < mots.length; j++) if (t.indexOf(mots[j]) < 0) return false; }
    return true;
  }
  function filtrer(rows, f) {
    var q = norm(f.q), mots = q ? q.split(" ") : [];
    return rows.filter(function (r) { return correspond(r, f, mots); });
  }
  /* Phrases décrivant les filtres actifs (puces, impression, mémo d'une cible). */
  function decrire(f) {
    var l = [];
    if (f.q.trim()) l.push({ id: "q", txt: "Recherche : « " + f.q.trim() + " »" });
    CRITERES.forEach(function (k) {
      if (!f[k.id]) return;
      var o = k.options.filter(function (x) { return x.v === f[k.id]; })[0];
      l.push({ id: k.id, txt: k.lib + " : " + o.lib });
    });
    if (f.produit) { var s = SITUATIONS.filter(function (x) { return x.v === f.situation; })[0]; l.push({ id: "produit", txt: s.lib + " : " + PR.parId[f.produit].nom }); }
    return l;
  }

  /* ---------- tris ---------- */
  var TRIS = [
    { id: "nom", lib: "Nom", val: function (r) { return norm(r.nom); }, sens: 1 },
    { id: "age", lib: "Âge", val: function (r) { return r.age; }, sens: 1 },
    { id: "foyer", lib: "Revenus mensuels du foyer", val: function (r) { return r.foyer; }, sens: -1 },
    { id: "revDom", lib: "Revenus domiciliés à GS", val: function (r) { return r.revDom; }, sens: -1 },
    { id: "icc", lib: "Indice de commercialité (ICC)", val: function (r) { return r.iccRang; }, sens: -1 },
    { id: "nbProduits", lib: "Nombre de produits", val: function (r) { return r.nbProduits; }, sens: -1 },
    { id: "encours", lib: "Encours d'épargne et de placements", val: function (r) { return r.encours; }, sens: -1 },
    { id: "solde", lib: "Solde du compte courant", val: function (r) { return r.solde; }, sens: -1 },
    { id: "opps", lib: "Nombre d'opportunités", val: function (r) { return r.opps.length; }, sens: -1 },
    { id: "dernier", lib: "Dernier contact", val: function (r) { return r.dernier === null ? Infinity : r.dernier; }, sens: -1 },
    { id: "anciennete", lib: "Ancienneté de la relation", val: function (r) { return r.depuis; }, sens: -1 },
    { id: "arr", lib: "Arrondissement", val: function (r) { return r.arr; }, sens: 1 }
  ];
  var TRI = {};
  TRIS.forEach(function (t) { TRI[t.id] = t; });
  /* sens : 1 = croissant, -1 = décroissant. Égalités départagées par le nom puis le numéro du client : l'ordre ne bouge pas d'un affichage à l'autre. */
  function trier(rows, id, sens) {
    var t = TRI[id] || TRI.nom, s = sens === -1 ? -1 : 1;
    return rows.slice().sort(function (p, q) {
      var a = t.val(p), b = t.val(q);
      if (a !== b) return (a < b ? -1 : 1) * s;
      var na = norm(p.nom), nb = norm(q.nom);
      return na < nb ? -1 : na > nb ? 1 : p.id - q.id;
    });
  }

  /* ---------- résumé d'un ensemble de clients ---------- */
  function resume(rows) {
    var n = rows.length;
    function moy(f) { return n ? rows.reduce(function (t, r) { return t + f(r); }, 0) / n : 0; }
    return {
      n: n, age: moy(function (r) { return r.age; }), foyer: moy(function (r) { return r.foyer; }),
      encours: moy(function (r) { return r.encours; }), encoursTotal: rows.reduce(function (t, r) { return t + r.encours; }, 0),
      produits: moy(function (r) { return r.nbProduits; }),
      avecOpp: rows.filter(function (r) { return r.opps.length > 0; }).length,
      sansContactAn: rows.filter(function (r) { return r.dernier === null || r.dernier > 365; }).length
    };
  }

  /* ---------- cibles enregistrées (sauvegarde du navigateur) ---------- */
  function cibles(st) { return (st && Array.isArray(st.cibles)) ? st.cibles : []; }
  function trouverCible(st, id) { return cibles(st).filter(function (c) { return c.id === id; })[0] || null; }
  function idsValides(ids) { var vus = {}, ok = {}; CL.forEach(function (c) { ok[c.id] = true; }); return (ids || []).filter(function (i) { if (!ok[i] || vus[i]) return false; vus[i] = true; return true; }); }
  function nomLibre(st, nom, sauf) { var n = norm(nom); return !cibles(st).some(function (c) { return c.id !== sauf && norm(c.nom) === n; }); }
  function uid() { return "t" + B.maintenant().getTime().toString(36) + Math.random().toString(36).slice(2, 6); }
  function verifierNomNote(st, nom, note, sauf) {
    nom = String(nom == null ? "" : nom).replace(/\s+/g, " ").trim(); note = String(note == null ? "" : note).trim();
    if (!nom) return "Donnez un nom à la cible, par exemple « Retraités à rencontrer ».";
    if (nom.length > MAX_NOM) return "Le nom est limité à " + MAX_NOM + " caractères.";
    if (note.length > MAX_NOTE) return "La note est limitée à " + MAX_NOTE + " caractères.";
    if (!nomLibre(st, nom, sauf)) return "Une cible porte déjà ce nom : choisissez-en un autre.";
    return null;
  }
  /* Crée une cible : « ids » = clients retenus, « criteres » = phrases décrivant comment ils ont été choisis (mémoire du choix, à la date de création). */
  function creerCible(st, o) {
    var err = verifierNomNote(st, o.nom, o.note, null);
    if (err) return { ok: false, erreur: err };
    var ids = idsValides(o.ids);
    if (!ids.length) return { ok: false, erreur: "La cible ne contient aucun client : affinez les filtres ou cochez des clients." };
    if (cibles(st).length >= MAX_CIBLES) return { ok: false, erreur: "Vous avez déjà " + MAX_CIBLES + " cibles : supprimez-en une avant d'en créer une autre." };
    var now = B.maintenant();
    var c = { id: uid(), nom: String(o.nom).replace(/\s+/g, " ").trim(), note: String(o.note || "").trim(), creee: B.ymd(B.aujourdhui()), heure: B.hhmm(now), ids: ids, criteres: (o.criteres || []).slice(0, 20).map(String), mode: o.mode === "coches" ? "coches" : "resultat" };
    if (!Array.isArray(st.cibles)) st.cibles = [];
    st.cibles.push(c);
    return { ok: true, cible: c };
  }
  function modifierCible(st, id, nom, note) {
    var c = trouverCible(st, id);
    if (!c) return { ok: false, erreur: "Cette cible n'existe plus." };
    var err = verifierNomNote(st, nom, note, id);
    if (err) return { ok: false, erreur: err };
    c.nom = String(nom).replace(/\s+/g, " ").trim(); c.note = String(note || "").trim();
    return { ok: true, cible: c };
  }
  function supprimerCible(st, id) {
    var n = cibles(st).length;
    st.cibles = cibles(st).filter(function (c) { return c.id !== id; });
    return st.cibles.length < n;
  }
  /* Les clients d'une cible, avec leurs indicateurs du jour. */
  function lignesCible(st, cible) {
    var ids = {}; cible.ids.forEach(function (i) { ids[i] = true; });
    return lignes(st).filter(function (r) { return ids[r.id]; });
  }

  var api = {
    MAX_CIBLES: MAX_CIBLES, MAX_NOM: MAX_NOM, MAX_NOTE: MAX_NOTE, CRITERES: CRITERES, ICC: ICC, ICC_PAR_CODE: ICC_PAR_CODE, SITUATIONS: SITUATIONS, TRIS: TRIS, OPP: OPP, ALERTES: ALERTES, CONTACTS: CONTACTS,
    norm: norm, nomListe: nomListe, lignes: lignes, viderCache: viderCache, filtresVides: filtresVides, nettoyer: nettoyer, nbFiltres: nbFiltres, filtrer: filtrer, decrire: decrire,
    trier: trier, resume: resume, dernierContact: dernierContact,
    cibles: cibles, trouverCible: trouverCible, creerCible: creerCible, modifierCible: modifierCible, supprimerCible: supprimerCible, lignesCible: lignesCible, verdict: verdict
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.portefeuille = api; }
})(typeof window !== "undefined" ? window : null);
