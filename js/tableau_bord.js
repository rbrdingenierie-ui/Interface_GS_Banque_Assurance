/* GS Banque & Assurance – tableau de bord de l'agence : lire les résultats du mois écoulé (agence et cinq conseillers), repérer les écarts avec les objectifs, retenir les écarts prioritaires, en chercher les
   causes probables, proposer des actions correctives et noter les écarts à suivre par anticipation. Les chiffres sont dans data_tableau_bord.js.
   Référentiel et guide d'accompagnement pédagogique du BTS Banque (tâche A2.1 T1, « Analyse d'un tableau de bord commercial ») : comprendre les indicateurs quantitatifs (en nombre et en euros) et qualitatifs
   (taux de décroché, de transformation en rendez-vous, de réclamation, clients distanciés, revue des nouveaux clients à trois mois, satisfaction), repérer les écarts significatifs, en clarifier les causes
   probables (potentiel du fonds de commerce et du portefeuille, activité du conseiller, besoin de formation, conjoncture économique), sélectionner les écarts prioritaires, déterminer les écarts non
   significatifs à suivre par anticipation. Le PNB est la somme de la marge d'intermédiation et des commissions nettes (cours « Découvrez comment la banque fonctionne », OpenClassrooms, page consultée le
   17 novembre 2026 : source pédagogique, non réglementaire).
   Conventions de l'exercice (NON tirées d'un texte, à ne pas présenter comme la règle du métier) : un écart défavorable d'au moins 10 % de l'objectif est « significatif » ; de 5 % à moins de 10 % il est « à suivre »
   seulement si le résultat est inférieur à celui du mois précédent (dégradation) ; un écart favorable d'au moins 10 % est « favorable » ; le reste est « conforme ». Pour l'agence, un taux est calculé sur
   l'ensemble des clients ou des appels (somme des numérateurs sur somme des dénominateurs), non en faisant la moyenne des taux des conseillers ; son objectif et ses repères sont la moyenne pondérée de ceux des
   conseillers. Au plus trois écarts prioritaires, chacun justifié par un chiffre du tableau, avec une cause, une action et une échéance de 90 jours au plus. Ce module est pur : seul valider() écrit, dans st.tableauBord. */
(function (root) {
  "use strict";

  var R0 = root && root.SGBF ? root.SGBF : null;
  function mod(nom, fichier) { return R0 && R0[nom] ? R0[nom] : require("./" + fichier); }
  var B = mod("banque", "banque.js"), DATA = mod("dataTableauBord", "data_tableau_bord.js");
  var INDICATEURS = DATA.INDICATEURS, CONSEILLERS = DATA.CONSEILLERS, D = DATA.DONNEES, NB = " ";
  var SCOPES = ["agence"].concat(CONSEILLERS.map(function (c) { return c.id; }));
  var SEUILS = { significatif: 0.10, suivre: 0.05, prioMax: 3, justifMin: 40, syntheseMin: 80, syntheseMax: 800, echeanceMax: 90, eps: 1e-9 };

  var CAUSES = [
    { id: "fonds", lib: "Le potentiel du fonds de commerce de l'agence", sous: "Clientèle de la zone, concurrence, nombre de clients à équiper." },
    { id: "portefeuille", lib: "Le potentiel du portefeuille du conseiller", sous: "Taille, qualité, clients repris ou distanciés." },
    { id: "activite", lib: "L'activité du conseiller", sous: "Nombre de contacts, méthode d'appel, de vente et de suivi." },
    { id: "formation", lib: "Un besoin de formation du conseiller", sous: "Technique d'entretien, connaissance des produits." },
    { id: "absence", lib: "Une absence ou une charge de travail inhabituelle", sous: "Congés, arrêt, portefeuille ou missions repris." },
    { id: "procedure", lib: "Les procédures ou l'offre de la banque", sous: "Tarification, délais de traitement, organisation interne." },
    { id: "conjoncture", lib: "La conjoncture économique", sous: "Taux d'intérêt, octrois de crédits immobiliers, marché local." }
  ];
  var ACTIONS = [
    { id: "formation", lib: "Accompagner ou former le conseiller (observation d'entretiens, jeux de rôle)", href: "" },
    { id: "phoning", lib: "Organiser des séances d'appels ciblées sur de meilleurs créneaux", href: "phoning.html" },
    { id: "campagne", lib: "Lancer une campagne commerciale sur le segment concerné", href: "campagnes.html" },
    { id: "o2pc", lib: "Traiter chaque jour les opportunités détectées (O2PC)", href: "o2pc.html" },
    { id: "relance", lib: "Reprendre contact avec les clients distanciés (appels, rendez-vous)", href: "agenda.html" },
    { id: "revues", lib: "Planifier les revues à trois mois des nouveaux clients", href: "agenda.html" },
    { id: "reclamation", lib: "Analyser les réclamations et corriger leur origine (information du client, procédure)", href: "reclamation.html" },
    { id: "repartition", lib: "Répartir temporairement des rendez-vous ou des clients entre conseillers", href: "equipe.html" },
    { id: "objectifs", lib: "Réviser l'objectif ou le calendrier avec la directrice", href: "" },
    { id: "suivi", lib: "Suivre l'indicateur chaque semaine, sans autre action pour le moment", href: "" }
  ];

  function arr(x) { return Array.isArray(x) ? x : []; }
  function ind(id) { return INDICATEURS.filter(function (x) { return x.id === id; })[0] || null; }
  function cons(id) { return CONSEILLERS.filter(function (x) { return x.id === id; })[0] || null; }
  function facteur(i) { return i.unite === "pct" ? 100 : 1; }

  /* ---------- le mois affiché : le mois civil qui précède la date du jour ---------- */
  function periode(auj) {
    var k = B.indexMois(auj || B.aujourdhui()) - 1, y = Math.floor(k / 12), m = k - y * 12;
    var lib = B.libMois(k).charAt(0).toLowerCase() + B.libMois(k).slice(1);
    return { k: k, cle: y + "-" + (m < 9 ? "0" : "") + (m + 1), lib: lib, de: (/^[aeiouyéèàôû]/.test(lib) ? "d'" : "de ") + lib, libMaj: B.libMois(k) };
  }

  /* ---------- valeurs d'un indicateur pour l'agence ou pour un conseiller ---------- */
  function brut(scope, i) { return D[i.id][scope]; }
  function pond(i, f) {            /* moyenne pondérée par les dénominateurs du mois */
    var s = 0, n = 0; CONSEILLERS.forEach(function (c) { var t = brut(c.id, i); s += f(t) * t[2]; n += t[2]; }); return s / n;
  }
  function valeur(scope, indId) {
    var i = ind(indId); if (!i || SCOPES.indexOf(scope) < 0) return null;
    var f = facteur(i), v;
    if (i.type === "montant") {
      var cols = scope === "agence" ? CONSEILLERS.map(function (c) { return brut(c.id, i); }) : [brut(scope, i)];
      var s = [0, 0, 0, 0]; cols.forEach(function (t) { for (var k = 0; k < 4; k++) s[k] += t[k]; });
      v = { obj: s[0], reel: s[1], an1: s[2], prec: s[3] };
    } else if (scope === "agence") {
      var num = 0, den = 0; CONSEILLERS.forEach(function (c) { var t = brut(c.id, i); num += t[1]; den += t[2]; });
      v = { obj: pond(i, function (t) { return t[0]; }), num: num, den: den, reel: num / den * f, an1: pond(i, function (t) { return t[3]; }), prec: pond(i, function (t) { return t[4]; }) };
    } else {
      var t = brut(scope, i); v = { obj: t[0], num: t[1], den: t[2], reel: t[1] / t[2] * f, an1: t[3], prec: t[4] };
    }
    return v;
  }

  /* ---------- statut d'un écart ---------- */
  function defavorable(i, v) {     /* écart relatif à l'objectif, positif quand il est défavorable */
    if (!(v.obj > 0)) return 0;
    var e = i.sens === "hausse" ? (v.obj - v.reel) / v.obj : (v.reel - v.obj) / v.obj;
    return Math.round(e * 1e9) / 1e9;
  }
  function pire(i, v) { return i.sens === "hausse" ? v.reel < v.prec - SEUILS.eps : v.reel > v.prec + SEUILS.eps; }
  function statut(indId, v) {
    var i = ind(indId), d = defavorable(i, v), code;
    if (d >= SEUILS.significatif - SEUILS.eps) code = "significatif";
    else if (d >= SEUILS.suivre - SEUILS.eps && pire(i, v)) code = "asuivre";
    else if (d <= -SEUILS.significatif + SEUILS.eps) code = "favorable";
    else code = "conforme";
    return { code: code, defav: d, ecart: v.reel - v.obj, ecartRel: v.obj > 0 ? (v.reel - v.obj) / v.obj : 0, pire: pire(i, v) };
  }
  var STATUTS = { significatif: "Écart significatif", asuivre: "À suivre", conforme: "Conforme", favorable: "Favorable" };

  function cle(scope, indId) { return scope + ":" + indId; }
  function lire(c) { var m = /^([a-z]+):([a-z0-9]+)$/.exec(String(c || "")); return m ? { scope: m[1], ind: m[2] } : null; }
  function ligne(scope, indId) { var v = valeur(scope, indId); return v ? { scope: scope, ind: indId, cle: cle(scope, indId), v: v, s: statut(indId, v) } : null; }
  function lignes(scope) { return INDICATEURS.map(function (i) { return ligne(scope, i.id); }); }
  function toutes() { var l = []; SCOPES.forEach(function (s) { l = l.concat(lignes(s)); }); return l; }

  /* ---------- affichage des valeurs (espaces insécables) ---------- */
  function dec(x, n) {
    var neg = x < 0, s = Math.abs(x).toFixed(n), p = s.split("."), g = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, NB);
    return (neg ? "−" : "") + g + (p[1] ? "," + p[1] : "");
  }
  function fmt(indId, x) {
    var i = ind(indId);
    if (i.unite === "eur") return dec(Math.round(x), 0) + NB + "€";
    if (i.unite === "nb") return dec(Math.round(x), 0);
    if (i.unite === "pct") return dec(x, 1) + NB + "%";
    if (i.unite === "ratio") return dec(x, 2);
    return dec(x, 1) + NB + "sur" + NB + "10";
  }
  function fmtEcart(indId, v) {    /* écart absolu avec son signe, dans l'unité de l'indicateur ; « points » pour les taux en pourcentage */
    var i = ind(indId), e = v.reel - v.obj, sg = Math.abs(e) < 1e-9 ? "" : e > 0 ? "+" : "−", a = Math.abs(e);
    if (!sg) return "0";
    if (i.unite === "eur") return sg + dec(Math.round(a), 0) + NB + "€";
    if (i.unite === "nb") return sg + dec(Math.round(a), 0);
    if (i.unite === "pct") return sg + dec(a, 1) + NB + (a >= 2 ? "points" : "point");
    if (i.unite === "ratio") return sg + dec(a, 2);
    return sg + dec(a, 1) + NB + (a >= 2 ? "points" : "point");
  }
  function fmtRel(r) { if (Math.abs(r) < 0.0005) return "0" + NB + "%"; return (r > 0 ? "+" : "−") + dec(Math.abs(r) * 100, 1) + NB + "%"; }

  /* ---------- enregistrement de l'analyse ---------- */
  function E(champ, msg) { return { champ: champ, msg: msg }; }
  function propre(s) { return String(s == null ? "" : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\r\n?/g, "\n").trim(); }
  function analyse(st, c) { return st && st.tableauBord && st.tableauBord[c] ? st.tableauBord[c] : null; }
  function nomLigne(l) { var i = ind(l.ind); return i.lib + " (" + (l.scope === "agence" ? "agence" : l.scope) + ")"; }

  /* Points d'attention : jamais bloquants. */
  function coherence(prio) {
    var p = [];
    arr(prio).forEach(function (x, n) {
      var i = ind(x.ind), c = arr(x.causes), a = arr(x.actions), nom = "Écart " + (n + 1) + " (" + (i ? i.lib : x.ind) + ") : ";
      if (c.indexOf("formation") >= 0 && a.indexOf("formation") < 0) p.push(nom + "vous retenez un besoin de formation sans proposer d'accompagnement ou de formation.");
      if (c.indexOf("absence") >= 0 && a.indexOf("repartition") < 0 && a.indexOf("objectifs") < 0) p.push(nom + "une absence se traite en répartissant des rendez-vous ou en ajustant l'objectif avec la directrice.");
      if (c.length === 1 && c[0] === "conjoncture" && a.some(function (y) { return y !== "objectifs" && y !== "suivi"; })) p.push(nom + "la conjoncture ne se corrige pas par une action sur le conseiller : suivre l'indicateur ou revoir l'objectif avec la directrice est plus juste.");
      if (a.length && a.every(function (y) { return y === "suivi"; })) p.push(nom + "un écart significatif appelle une action corrective, pas seulement un suivi.");
      if (x.ind === "distancies" && a.indexOf("relance") < 0) p.push(nom + "pour des clients distanciés, la reprise de contact est l'action attendue.");
      if (x.ind === "reclamation" && a.indexOf("reclamation") < 0) p.push(nom + "pour un taux de réclamation, analyser les réclamations et leur origine est l'action attendue.");
      if (x.ind === "revue3m" && a.indexOf("revues") < 0) p.push(nom + "pour des revues à trois mois en retard, planifier ces revues est l'action attendue.");
      if ((x.ind === "decroche" || x.ind === "rdv") && c.indexOf("conjoncture") >= 0 && c.length === 1) p.push(nom + "un taux de décroché ou de transformation dépend d'abord de la façon d'appeler et de présenter le rendez-vous.");
    });
    return p;
  }

  function valider(st, s, ctx) {
    s = s || {}; ctx = ctx || {};
    var auj = B.aujourdhui(), per = periode(auj), er = [], prio = arr(s.prioritaires), suivre = arr(s.asuivre), syn = propre(s.synthese), vus = {}, aff = [];
    if (analyse(st, per.cle) && !ctx.remplacer) return { ok: false, erreurs: [E("analyse", "L'analyse " + per.de + " est déjà enregistrée : reprenez-la pour la modifier.")] };
    if (!prio.length) er.push(E("prio", "Retenez au moins un écart prioritaire."));
    else if (prio.length > SEUILS.prioMax) er.push(E("prio", "Retenez trois écarts prioritaires au plus : choisir, c'est hiérarchiser."));
    var min = B.ymd(auj), max = B.ymd(B.plusJours(auj, SEUILS.echeanceMax));
    prio.slice(0, 20).forEach(function (x, n) {
      x = x || {}; var l = ligne(x.scope, x.ind), p = "prio-" + n, causes = arr(x.causes), actions = arr(x.actions), j = propre(x.justification), nom = "Écart " + (n + 1) + " : ";
      if (!l) { er.push(E(p, nom + "ce couple conseiller / indicateur n'existe pas.")); return; }
      if (vus[l.cle]) { er.push(E(p, nom + "cet écart est déjà retenu.")); return; }
      vus[l.cle] = true;
      if (l.s.code !== "significatif") { er.push(E(p, nom + "« " + ind(l.ind).lib + " » (" + (l.scope === "agence" ? "agence" : l.scope) + ") n'est pas un écart significatif (" + STATUTS[l.s.code].toLowerCase() + ", écart défavorable de " + dec(Math.max(l.s.defav, 0) * 100, 1) + NB + "% pour un seuil de 10" + NB + "%) : il ne peut pas être prioritaire.")); return; }
      aff.push({ scope: l.scope, ind: l.ind, cle: l.cle, causes: causes.filter(function (c, k, t) { return t.indexOf(c) === k; }), justification: j, actions: actions.filter(function (c, k, t) { return t.indexOf(c) === k; }), echeance: String(x.echeance || "") });
      if (!causes.length) er.push(E(p + "-causes", nom + "choisissez au moins une cause probable."));
      else if (causes.some(function (c) { return !CAUSES.some(function (y) { return y.id === c; }); })) er.push(E(p + "-causes", nom + "cause inconnue."));
      if (j.length < SEUILS.justifMin) er.push(E(p + "-justif", nom + "justifiez votre analyse en une ou deux phrases (" + SEUILS.justifMin + " signes au moins)."));
      else if (!/\d/.test(j)) er.push(E(p + "-justif", nom + "appuyez la justification sur au moins un chiffre du tableau (écart, effectif, nombre de jours d'absence…)."));
      else if (j.length > 400) er.push(E(p + "-justif", nom + "la justification est limitée à 400 signes."));
      if (!actions.length) er.push(E(p + "-actions", nom + "proposez au moins une action corrective."));
      else if (actions.some(function (a) { return !ACTIONS.some(function (y) { return y.id === a; }); })) er.push(E(p + "-actions", nom + "action inconnue."));
      var d = B.lireYmd(String(x.echeance || ""));
      if (!d) er.push(E(p + "-echeance", nom + "indiquez l'échéance de l'action."));
      else if (String(x.echeance) < min) er.push(E(p + "-echeance", nom + "l'échéance ne peut pas être passée."));
      else if (String(x.echeance) > max) er.push(E(p + "-echeance", nom + "l'échéance est limitée à " + SEUILS.echeanceMax + " jours : au-delà, ce n'est plus une action corrective du mois."));
    });
    var vSuivre = [];
    suivre.forEach(function (c) {
      var r = lire(c), l = r ? ligne(r.scope, r.ind) : null;
      if (!l) { er.push(E("asuivre", "Écart à suivre inconnu.")); return; }
      if (vSuivre.indexOf(l.cle) >= 0) return;
      vSuivre.push(l.cle);
      if (l.s.code !== "asuivre") er.push(E("asuivre", "« " + ind(l.ind).lib + " » (" + (l.scope === "agence" ? "agence" : l.scope) + ") n'est pas un écart à suivre : il est " + STATUTS[l.s.code].toLowerCase() + "."));
    });
    if (syn.length < SEUILS.syntheseMin) er.push(E("synthese", "Rédigez la synthèse pour la directrice (" + SEUILS.syntheseMin + " signes au moins) : ce qui va mal, pourquoi, ce que vous proposez."));
    else if (syn.length > SEUILS.syntheseMax) er.push(E("synthese", "La synthèse est limitée à " + SEUILS.syntheseMax + " signes."));
    if (er.length) return { ok: false, erreurs: er };
    var now = B.maintenant();
    if (!st.tableauBord || typeof st.tableauBord !== "object" || Array.isArray(st.tableauBord)) st.tableauBord = {};
    var a = { cle: per.cle, prioritaires: aff, asuivre: vSuivre, synthese: syn, date: B.ymd(auj), heure: B.hhmm(now), par: (st.eleve && st.eleve.nom) || "", points: coherence(aff) };
    st.tableauBord[per.cle] = a;
    return { ok: true, analyse: a, points: a.points };
  }
  function remettre(st, c) {
    if (!analyse(st, c)) return { ok: false, erreur: "Aucune analyse enregistrée pour ce mois." };
    delete st.tableauBord[c]; return { ok: true };
  }

  var api = {
    INDICATEURS: INDICATEURS, CONSEILLERS: CONSEILLERS, SCOPES: SCOPES, SEUILS: SEUILS, CAUSES: CAUSES, ACTIONS: ACTIONS, STATUTS: STATUTS, CONJONCTURE: DATA.CONJONCTURE,
    periode: periode, indicateur: ind, conseiller: cons, valeur: valeur, defavorable: defavorable, statut: statut, cle: cle, lire: lire, ligne: ligne, lignes: lignes, toutes: toutes,
    fmt: fmt, fmtEcart: fmtEcart, fmtRel: fmtRel, analyse: analyse, coherence: coherence, valider: valider, remettre: remettre, nomLigne: nomLigne
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.tableauBord = api; }
})(typeof window !== "undefined" ? window : null);
