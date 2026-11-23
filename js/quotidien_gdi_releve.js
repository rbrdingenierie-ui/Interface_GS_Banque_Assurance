/* GS Banque & Assurance – dossiers « du jour » (gestion des incidents) : relevé des dernières semaines d'un compte à l'état débiteur.
   Le relevé est construit pour concorder avec le dossier : le compte est créditeur ou dans son autorisation de découvert avant le jour J – N,
   passe sous l'autorisation ce jour-là, puis ne remonte jamais jusqu'au solde actuel. Chaque prélèvement revient tous les 30 jours à la même date ;
   pendant le débit il est rejeté (frais de rejet). Les paiements par carte, qui ne se refusent pas, creusent le dépassement (commission d'intervention
   comprise). Un client en offre clientèle fragile n'a pas de paiement par carte hors autorisation : son débit vient de l'échéance de son crédit,
   prélevée par la banque elle-même, et ses frais d'incidents restent plafonnés. Les jours sont comptés en jours avant aujourd'hui (0 = aujourd'hui).
   Fonctions pures. */
(function (root) {
  "use strict";

  var Q = root && root.SGBF && root.SGBF.quotidienBase ? root.SGBF.quotidienBase : require("./quotidien_base.js");
  var P = root && root.SGBF && root.SGBF.quotidienPools ? root.SGBF.quotidienPools : require("./quotidien_pools.js");
  var r2 = Q.r2;

  var FENETRE_AVANT = 26;      /* jours affichés avant le premier jour de débit */
  var COMMISSION = 8, COMMISSION_FRAGILE = 4, PLAFOND_COMMISSIONS = 80;
  var BUDGET_FRAIS_FRAGILE = 10;   /* par tranche de 30 jours : deux tranches voisines restent sous le plafond de 20 € par mois */
  var TAUX_MENSUEL_AGIOS = 0.0145;   /* ordre de grandeur d'un taux débiteur annuel de 17,4 % */

  function sorte(a, b) { return b.j - a.j || a.ordre - b.ordre; }

  /* Jours (avant aujourd'hui) où revient un prélèvement : phase + 30 × i. */
  function occurrences(phase, borneHaute) { var l = [], j; for (j = phase; j <= borneHaute; j += 30) l.push(j); return l; }
  /* Date du mois (phase) qui évite les abords du basculement. */
  function phaseSure(r, jd) {
    var t, ph;
    for (t = 0; t < 40; t++) {
      ph = r.n(0, 29);
      var ok = true, j;
      for (j = ph; j <= jd + FENETRE_AVANT; j += 30) if (Math.abs(j - jd) <= 1) ok = false;
      if (ok) return ph;
    }
    return null;
  }

  /* ctx : { jd, aut, dep (dépassement final voulu, sauf client fragile), salaire ({montant, ago, lib} ou null), prelevs [{lib, m, mandat}],
             fragile, credit ({lib, m, mandat}, client fragile), ville }
     Renvoie { lignes, solde, dep, debut, frais, ouverture, rejets } ou null si le tirage ne convient pas. */
  function construire(r, ctx) {
    var jd = ctx.jd, aut = ctx.aut, i, fragile = !!ctx.fragile;
    var comm = fragile ? COMMISSION_FRAGILE : COMMISSION;
    var ordre = 0, post = [], pre = [], debut, b0, b1, e, D = ctx.dep, cartes = [];
    var pr = (ctx.prelevs || []).map(function (p) { var ph = phaseSure(r, jd); return ph === null ? null : { lib: p.lib, m: p.m, mandat: p.mandat, phase: ph }; });
    if (pr.some(function (p) { return !p; })) return null;

    /* ---- l'opération qui fait basculer le compte ---- */
    if (fragile) {
      var cr = ctx.credit;
      e = r.pas(10, 300, 10);
      b0 = r2(cr.m - aut - e);
      if (b0 < 30 || b0 > 700) return null;
      b1 = r2(-(aut + e));
      debut = { lib: cr.lib + " (échéance du crédit)", m: cr.m, type: "prelevement", mandat: cr.mandat };
    } else {
      e = Math.min(r.pas(10, 150, 10), D - 30);
      if (e < 10 || D < 40) return null;
      b1 = r2(-(aut + e)); b0 = r.n(30, 450);
      var a = r2(b0 - b1);
      debut = { lib: P.carteSelon(r, a, ctx.ville), m: a, type: "carte" };
    }
    debut.j = jd;

    /* ---- après le basculement ---- */
    var fraisTotal = 0, budget = {}, nbComm = 0, rejets = 0;
    function budgetFrais(j, m) {          /* client fragile : frais d'incidents plafonnés par tranche de 30 jours */
      if (!fragile) return m;
      var k = Math.floor(j / 30), reste = BUDGET_FRAIS_FRAGILE - (budget[k] || 0), x = Math.max(0, Math.min(m, reste));
      budget[k] = (budget[k] || 0) + x; return x;
    }
    pr.forEach(function (p) {
      occurrences(p.phase, jd - 2).forEach(function (jr) {
        post.push({ j: jr, lib: "Prélèvement rejeté (provision insuffisante) – " + p.lib, m: 0, type: "rejet", mandat: p.mandat, ordre: ordre++, montantRejete: p.m });
        rejets += 1;
        var fr = budgetFrais(jr, Math.min(20, p.m));
        if (fr > 0) { post.push({ j: jr, lib: "Frais de rejet de prélèvement", m: -fr, type: "frais", ordre: ordre++ }); fraisTotal += fr; }
      });
    });
    var variation = 0;     /* débits acceptés après le basculement, hors frais et hors cartes */
    if (fragile) {
      for (var jc = jd - 30; jc >= 0; jc -= 30) { post.push({ j: jc, lib: ctx.credit.lib + " (échéance du crédit)", m: -ctx.credit.m, type: "prelevement", mandat: ctx.credit.mandat, ordre: ordre++ }); variation += ctx.credit.m; }
    }
    /* agios : une fois par période de 30 jours de débit complète */
    var agiosJours = [], ja;
    for (ja = jd - 28; ja >= 0; ja -= 30) agiosJours.push(ja);
    var approx = fragile ? aut + e + variation / 2 : aut + e + (D - e) * 0.5, agios = 0;
    agiosJours.forEach(function (j2) { var m = r2(approx * TAUX_MENSUEL_AGIOS); agios += m; post.push({ j: j2, lib: "Intérêts débiteurs (agios)", m: -m, type: "frais", ordre: ordre++ }); });
    if (!fragile) {
      /* paiements par carte : leur total complète exactement le dépassement voulu */
      var nCartes = Math.max(1, Math.min(8, Math.round(jd / 12) + r.n(1, 3))), jours = [];
      for (i = 0; i < nCartes; i++) jours.push(r.n(0, jd - 1));
      jours.sort(function (x, y) { return y - x; });
      jours.forEach(function (j) {
        cartes.push({ j: j, ordre: ordre++ });
        if (r.chance(0.65) && (nbComm + 1) * comm <= PLAFOND_COMMISSIONS) { nbComm += 1; post.push({ j: j, lib: "Commission d'intervention", m: -comm, type: "frais", ordre: ordre++ }); fraisTotal += comm; }
      });
      var V = r2((D - e) - fraisTotal - agios);
      if (V < 7 * cartes.length || V > 380 * cartes.length) return null;
      var w = cartes.map(function () { return 0.5 + r.f() * 1.5; }), sw = w.reduce(function (s, x) { return s + x; }, 0), reste = V;
      cartes.forEach(function (c, ix) {
        var m = ix === cartes.length - 1 ? r2(reste) : Math.max(6, Math.round(V * w[ix] / sw * 100) / 100);
        reste = r2(reste - m); c.m = r2(m);
      });
      if (cartes.some(function (c) { return c.m < 6 || c.m > 420; })) return null;
      cartes.forEach(function (c) {
        var lib = c.m >= 30 && r.chance(0.12) ? "Retrait DAB" : P.carteSelon(r, c.m, ctx.ville);
        post.push({ j: c.j, lib: lib, m: -c.m, type: "carte", ordre: c.ordre });
      });
    }

    /* ---- avant le basculement ---- */
    var ouverture, somme = 0;
    if (ctx.salaire) {
      /* le salaire est versé dans la fenêtre puis dépensé (prélèvements, paiements par carte) jusqu'au solde b0 */
      var sa = ctx.salaire, hautS = sa.ago - 1, basS = jd + 1;
      if (hautS < basS + 1) return null;
      ouverture = r.n(20, 300);
      pre.push({ j: sa.ago, lib: sa.lib, m: sa.montant, type: "credit", ordre: ordre++ });
      var fixesPre = 0;
      pr.forEach(function (p) {
        occurrences(p.phase, hautS).forEach(function (jr) { if (jr >= basS + 1 && jr <= hautS) { pre.push({ j: jr, lib: p.lib, m: -p.m, type: "prelevement", mandat: p.mandat, ordre: ordre++ }); fixesPre += p.m; } });
      });
      var Vpre = r2(ouverture + sa.montant - fixesPre - b0), np = Math.max(3, Math.min(9, Math.ceil(Vpre / 160)));
      if (Vpre < 20 * np || Vpre > 420 * np) return null;
      var wp = [], swp = 0, restePre = Vpre, ip;
      for (ip = 0; ip < np; ip++) { wp.push(0.5 + r.f() * 1.5); swp += wp[ip]; }
      for (ip = 0; ip < np; ip++) {
        var mp = ip === np - 1 ? r2(restePre) : r2(Vpre * wp[ip] / swp);
        restePre = r2(restePre - mp);
        if (mp < 6 || mp > 450) return null;
        pre.push({ j: r.n(basS, hautS), lib: P.carteSelon(r, mp, ctx.ville), m: -mp, type: "carte", ordre: ordre++ });
      }
    } else {
      pr.forEach(function (p) {
        occurrences(p.phase, jd + FENETRE_AVANT - 1).forEach(function (jr) { if (jr >= jd + 2) { pre.push({ j: jr, lib: p.lib, m: -p.m, type: "prelevement", mandat: p.mandat, ordre: ordre++ }); somme -= p.m; } });
      });
      var nc = Math.max(2, 5 - pre.length), i2;
      for (i2 = 0; i2 < nc; i2++) { var mc = r.pas(12, 120, 1) + (r.chance(0.5) ? 0.5 : 0); pre.push({ j: r.n(jd + 1, jd + FENETRE_AVANT - 1), lib: P.carteSelon(r, mc, ctx.ville), m: -mc, type: "carte", ordre: ordre++ }); somme -= mc; }
      ouverture = r2(b0 - somme);
    }

    /* ---- assemblage et contrôle ---- */
    var seq = [];
    pre.sort(sorte); pre.forEach(function (x) { seq.push(x); });
    seq.push({ j: debut.j, lib: debut.lib, m: -debut.m, type: debut.type, mandat: debut.mandat, ordre: ordre++, debut: true });
    post.sort(sorte); post.forEach(function (x) { seq.push(x); });
    var bal = ouverture, lignes = [], ok = true;
    for (i = 0; i < seq.length; i++) {
      var x = seq[i];
      bal = r2(bal + x.m);
      if (!x.debut && x.j > jd && bal < -aut + 0.005) ok = false;                      /* avant le basculement : jamais sous l'autorisation */
      if (x.j < jd && bal > -aut - 0.005 && x.type !== "rejet") ok = false;             /* après : toujours sous l'autorisation */
      lignes.push({ j: x.j, lib: x.lib, m: x.m, solde: bal, type: x.type, mandat: x.mandat, montantRejete: x.montantRejete, debut: !!x.debut });
    }
    if (!ok) return null;
    if (ouverture < -aut + 0.5 || ouverture > 3500) return null;
    var depFinal = r2(-bal - aut);
    if (!fragile && Math.abs(bal - r2(-(aut + D))) > 0.02) return null;
    if (fragile && (depFinal < 60 || depFinal > 3600)) return null;
    var frais = 0;
    lignes.forEach(function (l) { if (l.type === "frais") frais = r2(frais - l.m); });
    return { lignes: lignes, solde: bal, dep: depFinal, debut: { j: debut.j, lib: debut.lib, m: debut.m, type: debut.type, mandat: debut.mandat || null }, frais: frais, ouverture: ouverture, rejets: rejets };
  }

  /* Contrôles indépendants du générateur (utilisés par les tests). Renvoie la liste des problèmes. */
  function controler(rel, aut, jd, soldeAttendu, fragile) {
    var pb = [], i, prev = null, premierNeg = null, dernier = null;
    if (!rel || !rel.length) return ["relevé vide"];
    for (i = 0; i < rel.length; i++) {
      var l = rel[i];
      if (prev !== null && Math.abs(r2(prev + l.m) - l.solde) > 0.011) pb.push("solde incohérent à la ligne " + (i + 1));
      if (i > 0 && l.j > rel[i - 1].j) pb.push("lignes non classées par date (ligne " + (i + 1) + ")");
      if (l.solde < -aut - 0.005 && premierNeg === null) premierNeg = l;
      if (premierNeg !== null && l.type !== "rejet" && l.solde > -aut - 0.005) pb.push("le compte redevient régulier à la ligne " + (i + 1));
      prev = l.solde; dernier = l;
    }
    if (premierNeg === null) pb.push("le compte ne passe jamais sous l'autorisation");
    else if (premierNeg.j !== jd) pb.push("le débit commence il y a " + premierNeg.j + " jours au lieu de " + jd);
    if (dernier && Math.abs(dernier.solde - soldeAttendu) > 0.011) pb.push("dernier solde " + dernier.solde + " différent du solde du dossier " + soldeAttendu);
    /* commissions d'intervention : au plus 8 € par opération (4 € pour un client fragile) et 80 € (20 €) au total sur la période */
    var comm = 0;
    rel.forEach(function (l) { if (l.lib === "Commission d'intervention") { comm -= l.m; if (-l.m > (fragile ? 4 : 8) + 0.001) pb.push("commission supérieure au plafond par opération"); } });
    if (comm > (fragile ? 20 : 80) + 0.001) pb.push("commissions d'intervention supérieures au plafond mensuel");
    /* client fragile : tous les frais d'incidents (rejets, commissions) restent sous 20 € par mois, soit 10 € par tranche de 30 jours */
    if (fragile) {
      var parTranche = {};
      rel.forEach(function (l) { if (l.type === "frais" && !/agios/.test(l.lib)) { var k = Math.floor(l.j / 30); parTranche[k] = (parTranche[k] || 0) - l.m; } });
      Object.keys(parTranche).forEach(function (k) { if (parTranche[k] > BUDGET_FRAIS_FRAGILE + 0.001) pb.push("frais d'incidents d'un client fragile supérieurs à 10 € sur 30 jours"); });
    }
    /* un prélèvement revient tous les 30 jours : même mandat, écart multiple de 30 */
    var parMandat = {};
    rel.forEach(function (l) { if (l.mandat) (parMandat[l.mandat] = parMandat[l.mandat] || []).push(l.j); });
    Object.keys(parMandat).forEach(function (k) {
      var js = parMandat[k].sort(function (a, b) { return b - a; });
      js.forEach(function (j, ix) { if (ix && (js[ix - 1] - j) % 30 !== 0) pb.push("prélèvement " + k + " non mensuel"); });
    });
    return pb;
  }

  var api = { construire: construire, controler: controler, FENETRE_AVANT: FENETRE_AVANT, COMMISSION: COMMISSION, PLAFOND_COMMISSIONS: PLAFOND_COMMISSIONS, BUDGET_FRAIS_FRAGILE: BUDGET_FRAIS_FRAGILE };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.quotidienGdiReleve = api; }
})(typeof window !== "undefined" ? window : null);
