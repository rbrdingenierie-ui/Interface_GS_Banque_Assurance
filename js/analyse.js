/* GS Banque & Assurance – analyse du portefeuille : classement des clients (PCS et autres critères), indicateurs par segment, lecture qualitative.
   Tout est calculé à partir des données du portefeuille (clients fictifs) et de la date de l'exercice. */
(function (root) {
  "use strict";

  var B = root && root.SGBF ? root.SGBF.banque : require("./banque.js");
  var PR = root && root.SGBF ? root.SGBF.produits : require("./produits.js");
  var S = root && root.SGBF ? root.SGBF.synthese : require("./synthese.js");

  /* ---------- catégories socioprofessionnelles ---------- */
  /* Huit groupes : les six groupes de la nomenclature PCS 2020 de l'Insee, plus « Retraités » et « Autres personnes sans activité professionnelle »
     (regroupement en huit postes). Le classement des cas particuliers est une CONVENTION de l'exercice (voir CONVENTIONS). */
  var GROUPES = [
    { id: 1, lib: "Agriculteurs exploitants", court: "Agriculteurs" },
    { id: 2, lib: "Artisans, commerçants et chefs d'entreprise", court: "Artisans, commerçants, chefs d'entreprise" },
    { id: 3, lib: "Cadres et professions intellectuelles supérieures", court: "Cadres et prof. intellectuelles sup." },
    { id: 4, lib: "Professions intermédiaires", court: "Professions intermédiaires" },
    { id: 5, lib: "Employés", court: "Employés" },
    { id: 6, lib: "Ouvriers", court: "Ouvriers" },
    { id: 7, lib: "Retraités", court: "Retraités" },
    { id: 8, lib: "Autres personnes sans activité professionnelle", court: "Sans activité professionnelle" }
  ];
  /* Actifs en emploi de 15 à 64 ans, part de chaque groupe (en %), recensement 2021, au lieu de résidence (Insee Flash Île-de-France n° 95, octobre 2024). */
  var REF = {
    source: "Insee, recensement de la population 2021 (lieu de résidence), actifs en emploi de 15 à 64 ans – Insee Flash Île-de-France n° 95, « Ville de Paris : un portrait de ses habitants », 31 octobre 2024",
    url: "https://www.insee.fr/fr/statistiques/8274695",
    paris: { 1: 0.0, 2: 5.6, 3: 49.9, 4: 22.0, 5: 16.8, 6: 5.7 },
    france: { 1: 1.4, 2: 6.8, 3: 19.1, 4: 26.4, 5: 26.6, 6: 19.7 }
  };
  var CONVENTIONS = [
    "Salariés et fonctionnaires : classés d'après leur profession (cadre → groupe 3, profession intermédiaire → 4, employé → 5, ouvrier → 6).",
    "Indépendants : artisans, commerçants, chauffeurs de taxi, coiffeurs indépendants et auto-entrepreneurs de services → groupe 2 ; avocats, médecins libéraux, architectes libéraux et consultants indépendants → groupe 3 (professions libérales) ; infirmiers et kinésithérapeutes libéraux → groupe 4 (professions intermédiaires de la santé).",
    "Demandeurs d'emploi : classés d'après leur dernière profession (classement retenu pour cette analyse).",
    "Apprentis : classés d'après le métier appris (mécanique, cuisine → ouvriers ; vente, comptabilité, commerce, banque → employés).",
    "Retraités : groupe 7 ; leur ancienne profession est donnée à part (classement retenu pour cette analyse).",
    "Étudiants et personnes au foyer : groupe 8."
  ];
  var CAT_GROUPE = { employe: 5, ouvrier: 6, profint: 4, cadre: 3 };
  function ancienneProf(c) {
    var t = String(c.pro.prof || "").toLowerCase();
    if (/cadre/.test(t)) return 3;
    if (/artisan|commer[cç]ant/.test(t)) return 2;
    if (/employ|agente? territorial|administratif/.test(t)) return 5;
    if (/ouvrier|chauffeur/.test(t)) return 6;
    if (/enseignant|technicien|infirmi/.test(t)) return 4;
    return 5;
  }
  function pcs(c) {
    var p = c.pro, st = p.statut;
    if (st === "retraite") return 7;
    if (st === "etudiant" || st === "foyer") return 8;
    if (st === "apprenti") return /mécanique|cuisine/i.test(p.prof) ? 6 : 5;
    if (st === "independant") {
      if (/avocat|architecte|médecin|consultant/i.test(p.prof)) return 3;
      if (/infirmi|kinésith/i.test(p.prof)) return 4;
      return 2;
    }
    return CAT_GROUPE[p.cat] || 8;
  }
  function enEmploi(c) { return ["salarie", "fonctionnaire", "independant", "apprenti"].indexOf(c.pro.statut) >= 0 && c.age <= 64; }

  /* ---------- critères de classement ---------- */
  function tranche(x, bornes, libs) { for (var i = 0; i < bornes.length; i++) if (x <= bornes[i]) return i; return bornes.length; }
  var AGES = ["18 à 24 ans", "25 à 34 ans", "35 à 44 ans", "45 à 54 ans", "55 à 64 ans", "65 à 74 ans", "75 ans et plus"];
  var REVENUS = ["Moins de 1 500 €", "1 500 à 2 499 €", "2 500 à 3 499 €", "3 500 à 4 999 €", "5 000 € et plus"];
  var ANCIENNETES = ["Moins de 1 an", "1 à 4 ans", "5 à 9 ans", "10 à 19 ans", "20 ans et plus"];
  var EQUIP = ["2 à 3 produits", "4 à 5 produits", "6 à 7 produits", "8 produits et plus"];
  var FAMILLES = ["Personne seule, sans enfant à charge", "Personne seule, avec enfant(s) à charge", "Couple, sans enfant à charge", "Couple, avec enfant(s) à charge"];
  var LOGEMENTS = ["Locataire (parc privé)", "Locataire (logement social)", "Propriétaire", "Propriétaire avec crédit en cours", "Hébergé à titre gratuit"];
  var ARR = [];
  for (var i = 1; i <= 20; i++) ARR.push(i === 1 ? "Paris 1er" : "Paris " + i + "e");

  var DIMENSIONS = [
    { id: "pcs", lib: "Catégorie socioprofessionnelle (PCS)", court: "PCS", segments: GROUPES.map(function (g) { return g.court; }), classer: function (c) { return pcs(c) - 1; } },
    { id: "age", lib: "Tranche d'âge", court: "Âge", segments: AGES, classer: function (c) { return tranche(c.age, [24, 34, 44, 54, 64, 74]); } },
    { id: "famille", lib: "Situation familiale", court: "Famille", segments: FAMILLES, classer: function (c) { var couple = !!c.fam.conj; return (couple ? 2 : 0) + (c.fam.nbCharge > 0 ? 1 : 0); } },
    { id: "logement", lib: "Logement", court: "Logement", segments: LOGEMENTS, classer: function (c) { var s = c.log.st; return s === "locataire" ? (c.log.social ? 1 : 0) : s === "proprietaire" ? 2 : s === "accedant" ? 3 : 4; } },
    { id: "arrondissement", lib: "Arrondissement de résidence", court: "Arrondissement", segments: ARR, classer: function (c) { return parseInt(c.adr.cp.slice(3), 10) - 1; } },
    { id: "revenu", lib: "Revenus mensuels du foyer", court: "Revenus", segments: REVENUS, classer: function (c) { return tranche(c.pro.foyer, [1499, 2499, 3499, 4999]); } },
    { id: "equipement", lib: "Équipement à GS Banque & Assurance", court: "Équipement", segments: EQUIP, classer: function (c) { var n = S.contrats(c).length; return n <= 3 ? 0 : n <= 5 ? 1 : n <= 7 ? 2 : 3; } },
    { id: "anciennete", lib: "Ancienneté de la relation", court: "Ancienneté", segments: ANCIENNETES, classer: function (c) { return tranche(c.depuis / 365.25, [0.9999, 4.9999, 9.9999, 19.9999]); } }
  ];
  var DIM = {};
  DIMENSIONS.forEach(function (d) { DIM[d.id] = d; });

  /* ---------- indicateurs ---------- */
  var cacheInd = null, cleCache = null;
  function indicateursClient(c) {
    var cs = S.contrats(c), fam = {}, enc = 0;
    cs.forEach(function (x) { fam[x.famille] = 1; });
    c.epa.forEach(function (e) { enc += e.solde; }); c.plc.forEach(function (e) { enc += e.solde; });
    var opps = S.opportunites(c);
    var dernier = c.not.length ? Math.min.apply(null, c.not.map(function (n) { return n.j; })) : null;
    return { c: c, nbProduits: cs.length, fam: fam, encours: enc, credit: c.cre.some(function (x) { return !x.ext; }), opps: opps, projet: c.prj.length > 0, dernierContact: dernier };
  }
  function tous(clients) {
    var cle = B.ymd(B.aujourdhui()) + "|" + clients.length;
    if (cacheInd && cleCache === cle) return cacheInd;
    cleCache = cle;
    cacheInd = clients.map(indicateursClient);
    return cacheInd;
  }
  function viderCache() { cacheInd = null; cleCache = null; }
  function moy(l, f) { return l.length ? l.reduce(function (t, x) { return t + f(x); }, 0) / l.length : 0; }
  function med(l, f) { if (!l.length) return 0; var a = l.map(f).sort(function (x, y) { return x - y; }), m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
  function part(l, f) { return l.length ? 100 * l.filter(f).length / l.length : 0; }
  function mesures(l) {
    return {
      n: l.length,
      age: moy(l, function (x) { return x.c.age; }),
      foyer: moy(l, function (x) { return x.c.pro.foyer; }),
      foyerMed: med(l, function (x) { return x.c.pro.foyer; }),
      produits: moy(l, function (x) { return x.nbProduits; }),
      epargne: part(l, function (x) { return x.fam.epargne; }),
      placement: part(l, function (x) { return x.fam.placement; }),
      credit: part(l, function (x) { return x.fam.credit; }),
      assurance: part(l, function (x) { return x.fam.assurance; }),
      encours: moy(l, function (x) { return x.encours; }),
      opp: part(l, function (x) { return x.opps.length > 0; }),
      projet: part(l, function (x) { return x.projet; }),
      sansNote: part(l, function (x) { return x.dernierContact === null; }),
      proprio: part(l, function (x) { return x.c.log.st === "proprietaire" || x.c.log.st === "accedant"; })
    };
  }
  /* Classe les clients selon un critère : { dimension, segments: [{ i, lib, clients, m }], ensemble } */
  function analyser(clients, dimId) {
    var d = DIM[dimId] || DIM.pcs, all = tous(clients), segs = d.segments.map(function (lib, i) { return { i: i, lib: lib, ind: [] }; });
    all.forEach(function (x) { var i = d.classer(x.c); if (segs[i]) segs[i].ind.push(x); });
    segs.forEach(function (s) { s.m = mesures(s.ind); s.clients = s.ind.map(function (x) { return x.c; }); s.pct = 100 * s.m.n / clients.length; });
    return { dimension: d, segments: segs, ensemble: mesures(all), total: clients.length };
  }
  /* Comparaison des actifs en emploi du portefeuille avec Paris et la France (groupes 1 à 6). */
  function comparaisonPCS(clients) {
    var act = clients.filter(enEmploi), n = act.length, res = [];
    for (var g = 1; g <= 6; g++) {
      var k = act.filter(function (c) { return pcs(c) === g; }).length;
      res.push({ id: g, lib: GROUPES[g - 1].lib, n: k, pct: n ? 100 * k / n : 0, paris: REF.paris[g], france: REF.france[g] });
    }
    return { n: n, lignes: res, source: REF.source };
  }
  /* Retraités classés par ancienne profession (groupes 2 à 6). */
  function retraitesParAncienne(clients) {
    var ret = clients.filter(function (c) { return c.pro.statut === "retraite"; }), res = {};
    ret.forEach(function (c) { var g = ancienneProf(c); res[g] = (res[g] || 0) + 1; });
    return { n: ret.length, parGroupe: [2, 3, 4, 5, 6].map(function (g) { return { id: g, lib: GROUPES[g - 1].court, n: res[g] || 0 }; }) };
  }

  /* ---------- lecture qualitative ---------- */
  function ecart(v, ref, seuil) { var r = ref ? (v - ref) / ref : 0; return r > seuil ? "supérieur" : r < -seuil ? "inférieur" : "proche"; }
  function libProjet(l) { return /^Études supérieures/.test(l) ? "Études supérieures d'un enfant" : l; }
  function compter(l, f) { var m = {}; l.forEach(function (x) { f(x).forEach(function (k) { m[k] = (m[k] || 0) + 1; }); }); return Object.keys(m).map(function (k) { return { lib: k, n: m[k] }; }).sort(function (a, b) { return b.n - a.n || (a.lib < b.lib ? -1 : 1); }); }
  var FAM_LIB = { epargne: "épargne bancaire", placement: "placements et retraite", credit: "crédits", assurance: "assurances" };
  function portrait(seg, ens, dimId) {
    var m = seg.m, e = ens, out = { phrases: [], ecarts: [], projets: [], opportunites: [], reserve: null };
    if (!m.n) { out.phrases.push("Aucun client dans ce segment."); return out; }
    if (m.n < 10) out.reserve = "Ce segment compte moins de 10 clients : les pourcentages bougent beaucoup pour un seul client en plus ou en moins. Il faut éviter d'en tirer une règle générale.";
    out.phrases.push("« " + seg.lib + " » : " + B.nb(m.n) + (m.n > 1 ? " clients" : " client") + ", soit " + B.pct(Math.round(seg.pct * 10) / 10) + " du portefeuille.");
    out.phrases.push("Âge moyen : " + B.nb(Math.round(m.age)) + " ans (ensemble : " + B.nb(Math.round(e.age)) + " ans). Revenu mensuel moyen du foyer : " + B.eur(m.foyer) + ", " + ecart(m.foyer, e.foyer, 0.1) + " à celui de l'ensemble (" + B.eur(e.foyer) + "), médiane " + B.eur(m.foyerMed) + ".");
    out.phrases.push("Produits GS par client : " + B.nb(Math.round(m.produits * 10) / 10) + " (ensemble : " + B.nb(Math.round(e.produits * 10) / 10) + "). Encours moyen d'épargne et de placements à GS : " + B.eur(m.encours) + " (ensemble : " + B.eur(e.encours) + ").");
    if (dimId !== "logement") out.phrases.push(B.pct(Math.round(m.proprio)) + " des clients sont propriétaires (ensemble : " + B.pct(Math.round(e.proprio)) + ").");
    ["epargne", "placement", "credit", "assurance"].forEach(function (f) { var d = m[f] - e[f]; if (Math.abs(d) >= 5) out.ecarts.push({ lib: FAM_LIB[f], seg: Math.round(m[f]), ens: Math.round(e[f]), ecart: Math.round(d) }); });
    out.ecarts.sort(function (a, b) { return a.ecart - b.ecart; });
    out.projets = compter(seg.ind, function (x) { return x.c.prj.map(function (p) { return libProjet(p.lib); }); }).slice(0, 4);
    out.nbProjets = seg.ind.filter(function (x) { return x.projet; }).length;
    out.opportunites = compter(seg.ind, function (x) { var v = {}; x.opps.forEach(function (o) { v[o.titre] = 1; }); return Object.keys(v); }).slice(0, 3);
    out.nbOpp = seg.ind.filter(function (x) { return x.opps.length > 0; }).length;
    out.professions = compter(seg.ind, function (x) { return [x.c.pro.prof]; }).slice(0, 4);
    out.typique = typique(seg.ind, dimId);
    out.contact = { sansNote: Math.round(m.sansNote), nbSansNote: seg.ind.filter(function (x) { return x.dernierContact === null; }).length, anciens: seg.ind.filter(function (x) { return x.dernierContact !== null && x.dernierContact > 365; }).length };
    return out;
  }
  /* Modalité la plus fréquente de chaque autre critère de classement (description du segment, sans interprétation). */
  function typique(ind, dimId) {
    return DIMENSIONS.filter(function (d) { return d.id !== dimId && ["age", "famille", "logement", "revenu"].indexOf(d.id) >= 0; }).map(function (d) {
      var n = d.segments.map(function () { return 0; });
      ind.forEach(function (x) { n[d.classer(x.c)]++; });
      var im = 0; n.forEach(function (v, i) { if (v > n[im]) im = i; });
      return { dim: d.court, lib: d.segments[im], n: n[im], pct: ind.length ? Math.round(100 * n[im] / ind.length) : 0 };
    });
  }
  /* Questions d'analyse proposées à l'étudiant (aucune réponse n'est donnée). */
  var QUESTIONS = {
    pcs: [
      "Quels groupes sont plus ou moins nombreux dans le portefeuille que parmi les actifs de Paris ? Qu'est-ce qui peut l'expliquer (clientèle d'une banque, âge, quartier) ?",
      "Quel groupe est le moins équipé en épargne, en placements ou en assurances ? S'agit-il d'un manque de besoin, de revenus, d'information ou de contact ?",
      "Quel groupe concentre le plus d'opportunités commerciales ? Comment hiérarchiser les clients à contacter en premier ?",
      "Les retraités et les personnes sans activité ne sont pas classés par profession dans ce tableau. Quelle information perd-on, et comment la retrouver dans la fiche client ?"
    ],
    age: ["Quelle tranche d'âge détient le plus d'épargne ? Quelle tranche est la moins équipée ?", "Quels besoins diffèrent selon l'âge (premier logement, famille, retraite, transmission) ?"],
    famille: ["Quels besoins de protection (assurances, prévoyance) diffèrent entre une personne seule et une famille ?", "Quel segment a le plus de projets notés ? Lesquels ?"],
    logement: ["Quels produits proposer en priorité à un locataire, à un propriétaire, à un accédant ?", "À Paris, la part de propriétaires est plus faible que dans le reste de la France : qu'est-ce que cela change pour l'activité de crédit ?"],
    arrondissement: ["Les clients sont-ils répartis également dans Paris ? Quels arrondissements sont les mieux représentés, et pourquoi ?", "Le niveau de revenu varie-t-il selon l'arrondissement ? Peut-on en déduire un niveau d'équipement ?"],
    revenu: ["Le taux d'équipement augmente-t-il avec les revenus ? Pour quels produits ?", "Quels clients à revenus modestes ont droit à des produits réglementés (LEP, offre clientèle fragile) ?"],
    equipement: ["Les clients les moins équipés sont-ils les plus récents ? Quel plan d'action proposer ?", "Un client très équipé est-il un client sans potentiel ?"],
    anciennete: ["Les clients les plus anciens sont-ils les plus équipés ? Est-ce un atout pour la fidélisation ?", "Que faire des clients récents peu équipés ?"]
  };

  var api = {
    GROUPES: GROUPES, REF: REF, CONVENTIONS: CONVENTIONS, DIMENSIONS: DIMENSIONS, QUESTIONS: QUESTIONS,
    pcs: pcs, enEmploi: enEmploi, ancienneProf: ancienneProf, analyser: analyser, comparaisonPCS: comparaisonPCS, retraitesParAncienne: retraitesParAncienne,
    portrait: portrait, viderCache: viderCache, mesures: mesures, tous: tous
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.analyse = api; }
})(typeof window !== "undefined" ? window : null);
