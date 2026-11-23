/* GS Banque & Assurance – dossiers « du jour » : opérations débiteurs.
   Chaque dossier est tiré d'un scénario (compte sain, tolérance, carte puis rejet, chèque de 15 €, compte sous contrôle, offre clientèle fragile, FICP, droit au compte,
   compte débiteur depuis N jours, client en défaut, gros chèque). Les chiffres sont tirés au hasard (graine = date + rang), puis :
   - la décision attendue de chaque opération est calculée par la politique de l'exercice (quotidien_deb_textes.js) ;
   - le relevé des trois derniers mois est construit pour que tout concorde (quotidien_releve.js) ;
   - les textes (explications, observations, opportunité) ne citent que des chiffres du dossier ou du relevé.
   Le même dossier est reconstruit à l'identique pour une même graine. Fonctions pures. */
(function (root) {
  "use strict";

  var Q = root && root.SGBF && root.SGBF.quotidienBase ? root.SGBF.quotidienBase : require("./quotidien_base.js");
  var P = root && root.SGBF && root.SGBF.quotidienPools ? root.SGBF.quotidienPools : require("./quotidien_pools.js");
  var R = root && root.SGBF && root.SGBF.rules ? root.SGBF.rules : require("./rules.js");
  var T = root && root.SGBF && root.SGBF.quotidienDebTextes ? root.SGBF.quotidienDebTextes : require("./quotidien_deb_textes.js");
  var REL = root && root.SGBF && root.SGBF.quotidienReleve ? root.SGBF.quotidienReleve : require("./quotidien_releve.js");
  var eur = Q.eur, r2 = Q.r2;

  /* ---------- profil du client ---------- */
  function situation(r, age, f, st) {
    var e = f ? "e" : "";
    if (st === "alternance" || age < 24) return r.chance(0.9) ? "Célibataire" : "En couple";
    if (st === "retraite" && age >= 72 && r.chance(0.4)) return f ? "Veuve" : "Veuf";
    if (age < 40) return r.poids([["Célibataire", 3], ["Marié" + e + ", 1 enfant", 2], ["Marié" + e + ", 2 enfants", 2], ["Pacsé" + e, 1], ["Célibataire, 1 enfant", 1]]);
    return r.poids([["Célibataire", 2], ["Marié" + e, 2], ["Marié" + e + ", 2 enfants", 3], ["Divorcé" + e + ", 1 enfant", 2], ["Marié" + e + ", 3 enfants", 1], [f ? "Veuve" : "Veuf", age > 60 ? 1 : 0]]);
  }

  /* c : { st: statuts permis, rev: [min, max], age: [min, max] } */
  function profil(r, c) {
    var liste = P.PROFESSIONS.filter(function (p) {
      return p.k !== "interim" && (!c.st || c.st.indexOf(p.st) >= 0) && (!c.rev || (p.rev[1] >= c.rev[0] && p.rev[0] <= c.rev[1])) && (!c.age || (p.age[1] >= c.age[0] && p.age[0] <= c.age[1]));
    });
    if (!liste.length) return null;
    var p = r.pick(liste), f = r.chance(0.5);
    var lo = Math.max(p.rev[0], c.rev ? c.rev[0] : 0), hi = Math.min(p.rev[1], c.rev ? c.rev[1] : 1e9);
    var alo = Math.max(p.age[0], c.age ? c.age[0] : 0), ahi = Math.min(p.age[1], c.age ? c.age[1] : 99);
    var age = r.n(alo, ahi), rev = r.pas(lo, hi, 10);
    var anc = Math.max(1, Math.min(r.n(2, 22), age - 18));
    if (p.st === "alternance" || p.st === "cdd") anc = r.n(1, Math.min(4, age - 17));
    return {
      prof: p, f: f,
      client: { civilite: f ? "Mme" : "M.", prenom: Q.prenomPour(r, f, age), nom: Q.nomMajuscule(r.pick(Q.NOMS)), age: age, profession: f ? p.f : p.m, situation: situation(r, age, f, p.st),
        ancienneteAns: anc, revenus: rev, revenusNote: p.note, produits: [], fragile: false, compte: Q.numeroCompte(r) }
    };
  }

  /* ---------- opérations ---------- */
  function carteOp(r, ville, m) { return P.carteSelon(r, m, ville); }
  var CAT = { loyer: P.PRELEV_LOYER, energie: P.PRELEV_ENERGIE, tel: P.PRELEV_TEL, assur: P.PRELEV_ASSUR, divers: P.PRELEV_DIVERS, credit: P.PRELEV_CREDIT };
  function prelev(r, kind, rev, mmin, mmax) {
    var t = r.pick(CAT[kind]), lo = t[2] || mmin, hi = t[3] || mmax, m;
    if (kind === "loyer") { lo = Math.max(380, Math.round(rev * 0.22 / 10) * 10); hi = Math.max(lo + 60, Math.round(rev * 0.4 / 10) * 10); m = r.pas(lo, hi, 5); }
    else m = Math.round((lo + r.f() * (hi - lo)) * 100) / 100;
    if (mmin != null) m = Math.max(m, mmin);
    if (mmax != null) m = Math.min(m, mmax);
    return { t: "prelevement", m: r2(m), lib: t[0], mandat: t[1] + "-" + r.n(10000, 99999), kind: kind };
  }
  function cheque(r, pool, mmin, mmax) {
    var t = r.pick(pool), lo = Math.max(t[1], mmin || 0), hi = Math.min(t[2], mmax || 1e9), m;
    if (hi < lo) { lo = mmin || t[1]; hi = mmax || (lo + 30); }
    m = r.pas(Math.ceil(lo / 5) * 5, Math.max(Math.ceil(lo / 5) * 5, Math.floor(hi / 5) * 5), 5);
    if (m === 50) m = 55;
    return { t: "cheque", m: m, lib: t[0], kind: "cheque", motif: t[3] || null };
  }
  /* Prélèvement dont le montant est imposé : la nature du prélèvement est choisie d'après le montant (pas de forfait mobile à 279 €). */
  function prelevExact(r, m, rev) {
    var kinds = [];
    if (m <= 60) kinds = ["tel", "divers", "assur"];
    else if (m <= 140) kinds = ["energie", "assur", "divers", "credit"];
    else if (m <= 380) kinds = ["credit", "divers", "assur", "energie"];
    else kinds = ["loyer"];
    var kind = r.pick(kinds), t = r.pick(CAT[kind]);
    if (kind === "divers" && m > 240) { kind = "credit"; t = r.pick(CAT.credit); }
    if (kind === "energie" && m > 140) { kind = "credit"; t = r.pick(CAT.credit); }
    if (kind === "assur" && m > 110) { kind = "credit"; t = r.pick(CAT.credit); }
    if (kind === "tel" && m > 60) { kind = "divers"; t = r.pick(CAT.divers); }
    return { t: "prelevement", m: r2(m), lib: t[0], mandat: t[1] + "-" + r.n(10000, 99999), kind: kind };
  }
  /* Chèque dont le montant est imposé : bénéficiaire choisi parmi ceux dont la fourchette de montants convient. */
  function chequeExact(r, m) {
    var tous = P.CHEQUE_COURANT.concat(P.CHEQUE_PROJET, P.CHEQUE_VEHICULE), ok = tous.filter(function (t) { return t[1] <= m && m <= t[2]; });
    if (!ok.length) { var best = null, bd = 1e12; tous.forEach(function (t) { var dd = m < t[1] ? t[1] - m : m - t[2]; if (dd < bd) { bd = dd; best = t; } }); ok = [best]; }
    var t = r.pick(ok);
    return { lib: t[0], motif: t[3] || null };
  }
  function opFinale(r, s, i) {
    var o = { id: "o" + (i + 1), type: s.t, libelle: s.lib, montant: r2(s.m) };
    if (s.t === "carte") { o.detail = "Paiement par carte autorisé le {date}"; o.joursAvant = s.ja != null ? s.ja : r.n(0, 2); }
    else if (s.t === "prelevement") { o.detail = "Prélèvement SEPA, mandat n° " + s.mandat + ", présenté le {date}"; o.joursAvant = s.ja != null ? s.ja : r.n(0, 1); }
    else { o.detail = "Chèque n° " + s.num + ", émis le {date}"; o.joursAvant = s.ja != null ? s.ja : r.n(2, 6); }
    return o;
  }

  /* ---------- antécédents (rejets des 12 derniers mois) ---------- */
  function antecedents(r, n, recents, d) {
    var jours = [], essais = 0, out = [];
    while (jours.length < n && essais < 400) {
      essais++;
      var j = jours.length < recents ? r.n(25, 175) : r.n(185, 350);
      if (j >= 88 && j <= 92) continue;
      if (jours.every(function (x) { return Math.abs(x - j) >= 14; })) jours.push(j);
    }
    if (jours.length < n) return null;
    jours.sort(function (a, b) { return a - b; });
    jours.forEach(function (j) {
      if (r.chance(0.55)) { var p = prelev(r, r.pick(["divers", "assur", "tel", "energie"]), 1500); out.push({ type: "prelevement", montant: p.m, joursAvant: j, libelle: p.lib }); }
      else { var c = cheque(r, P.CHEQUE_COURANT, 20, 400); out.push({ type: "cheque", montant: c.m, joursAvant: j, libelle: c.lib }); }
    });
    return out;
  }

  /* ---------- scénarios ---------- */
  /* Chaque scénario renvoie { note, aut, solde, cr: délai ou null, ops: [spécifications], rejets: [nombre, dont récents], flags… }.
     « exige » : contrôle de l'intention du scénario sur les décisions calculées. */
  function creditDe(pf, delai) {
    if (delai == null) return null;
    var p = pf.prof, rev = pf.client.revenus;
    return { libelle: (p.st === "salarie" && rev < 1350 && p.k !== "interim" && /Salaire/.test(p.cr) && false) ? "Salaire et prime d'activité" : p.cr, montant: rev, dansJours: delai };
  }
  function ajouterAutres(r, pf, spec, lo, hi) {
    return spec;
  }
  function cartes(r, solde, n, tot) { return null; }

  var SC = {
    /* compte sain : toutes les opérations passent */
    sain: { w: 4, prof: { st: ["salarie", "retraite", "cdd"], rev: [1700, 4200], age: [25, 70] },
      tirer: function (r, pf) {
        var rev = pf.client.revenus, aut = rev < 1900 ? r.poids([[0, 3], [300, 2], [500, 2]]) : r.poids([[0, 3], [300, 2], [500, 3], [800, 1], [1000, 1]]);
        var solde = r.pas(250, Math.min(2800, Math.round(rev * 1.1)), 10), n = r.n(2, 3), ops = [];
        var dans = r.chance(0.35) && aut > 0, total = dans ? solde + r.pas(20, Math.round(aut * 0.7), 5) : r.pas(Math.round(solde * 0.35), solde - 30, 5);
        var types = r.melange(["prelevement", "cheque"]).slice(0, n - 1), reste = total;
        types.forEach(function (t) {
          var s = t === "prelevement" ? prelev(r, r.pick(["loyer", "energie", "assur", "tel", "divers"]), rev, null, Math.round(total * 0.5)) : cheque(r, P.CHEQUE_COURANT, 30, Math.round(total * 0.45));
          reste -= s.m; ops.push(s);
        });
        if (reste < 8) return null;
        ops.push({ t: "carte", m: r2(reste), lib: null });
        return { note: r.pick(["A", "A", "B"]), aut: aut, solde: solde, cr: r.n(2, 25), ops: r.melange(ops), rej: [r.pick([0, 0, 0, 1]), 0], opp: "libre", intensif: false, obj: "sain" };
      },
      exige: function (pol) { return pol.every(function (s) { return s.att === "payer" && !s.tol; }); } },

    /* carte qui crée l'état des débiteurs, puis opération à rejeter */
    carte_rejet: { w: 4, prof: { st: ["salarie", "cdd", "retraite", "chomage", "alternance"], rev: [900, 2200], age: [20, 75] },
      tirer: function (r, pf) {
        var rev = pf.client.revenus, aut = r.poids([[0, 4], [100, 1], [150, 1], [300, 1]]), solde = r.pas(30, 380, 5), dep1 = r.pas(15, 160, 5);
        var carte = solde + aut + dep1, m = r.pas(30, 420, 5), kind = r.chance(0.5) ? "cheque" : "prelevement", ops = [{ t: "carte", m: carte, lib: null }];
        ops.push(kind === "cheque" ? cheque(r, P.CHEQUE_COURANT, 20, 420) : prelev(r, r.pick(["energie", "assur", "divers", "tel"]), rev, 20, 420));
        var note = r.poids([["C", 5], ["D", 3]]);
        return { note: note, aut: aut, solde: solde, cr: r.n(15, 26), ops: ops, rej: note === "C" ? [r.n(1, 2), 1] : [r.n(3, 4), 2], opp: null, obj: "carte_rejet" };
      },
      exige: function (pol) { return pol[0].cas === "carte" && pol.some(function (s) { return s.att === "rejeter"; }); } },

    /* opération rejetée seule (autorisation déjà utilisée) */
    chq_rejet: { w: 2, prof: { st: ["salarie", "cdd", "retraite", "chomage"], rev: [1000, 2300], age: [22, 75] },
      tirer: function (r, pf) {
        var rev = pf.client.revenus, aut = r.poids([[0, 2], [100, 2], [150, 1], [300, 2]]), solde = r.pas(100, 500, 10), pre = solde + aut - r.pas(0, 40, 5) - r.pas(10, 60, 5);
        var ops = [];
        var a = r.chance(0.5) ? prelev(r, r.pick(["loyer", "energie", "assur"]), rev, null, Math.max(30, pre)) : cheque(r, P.CHEQUE_COURANT, 30, Math.max(40, pre));
        if (a.m > pre + solde * 0.5) return null;
        ops.push(a);
        var b = cheque(r, P.CHEQUE_COURANT, 80, 350);
        ops.push(b);
        var note = r.poids([["C", 5], ["D", 2]]);
        return { note: note, aut: aut, solde: solde, cr: r.n(14, 24), ops: ops, rej: note === "C" ? [r.n(1, 2), 1] : [r.n(3, 4), 2], opp: null, obj: "chq_rejet" };
      },
      exige: function (pol) { return pol.some(function (s) { return s.att === "rejeter"; }); } },

    /* client sain, crédit certain proche : tolérance (ou rejet défendable) */
    tolerance: { w: 5, prof: { st: ["salarie", "retraite"], rev: [1700, 4000], age: [26, 68] },
      tirer: function (r, pf) {
        var rev = pf.client.revenus, aut = r.poids([[0, 4], [300, 2], [500, 2], [800, 1]]), solde = r.pas(60, 700, 10), dep = r.pas(25, 420, 5);
        var delai = r.poids([[r.n(1, 6), 4], [r.n(7, 13), 3], [r.n(15, 21), 2]]);
        var petit = r.pas(12, Math.min(160, solde - 20), 1);
        var ops = [{ t: "carte", m: petit, lib: null }], reste = solde - petit, m = reste + aut + dep;
        ops.push(r.chance(0.5) ? cheque(r, P.CHEQUE_COURANT, 150, 2500) : prelev(r, r.pick(["loyer", "assur", "energie", "credit"]), rev, 40, 2500));
        ops[1].m = ops[1].t === "cheque" ? Math.round(m / 5) * 5 : r2(m);
        if (ops[1].t === "cheque" && ops[1].m === 50) return null;
        return { note: r.poids([["A", 3], ["B", 3]]), aut: aut, solde: solde, cr: delai, ops: ops, rej: [r.pick([0, 0, 1]), 0], anciens: true, opp: "libre", obj: "tolerance" };
      },
      exige: function (pol) { return pol.some(function (s) { return s.tol || s.acc === "payer"; }); } },

    /* seuil de 15 € */
    cheque15: { w: 2, prof: { st: ["salarie", "cdd", "retraite", "chomage", "alternance"], rev: [900, 1900], age: [20, 75] },
      tirer: function (r, pf) {
        var solde = r.pas(0, 30, 1), mx = r.poids([[15, 3], [r.pas(6, 14, 1) + (r.chance(0.5) ? 0.5 : 0), 4]]), ops = [{ t: "cheque", m: mx, lib: null }];
        var mode = r.pick(["prelevement", "cheque", "cheque15"]);
        if (mode === "cheque15") ops.push({ t: "cheque", m: 15.01, lib: null }); else ops.push(mode === "cheque" ? cheque(r, P.CHEQUE_COURANT, 20, 90) : prelev(r, r.pick(["tel", "divers", "assur"]), 1500, 9, 60));
        var note = r.poids([["C", 4], ["D", 3]]);
        ops[0].petit = true; if (mode === "cheque15") ops[1].petit = true;
        return { note: note, aut: 0, solde: solde, cr: r.n(5, 26), ops: ops, rej: note === "C" ? [r.n(1, 2), 1] : [r.n(3, 4), 2], opp: null, obj: "cheque15", tolere: false };
      },
      exige: function (pol) { return pol[0].cas === "chq15" && pol.some(function (s) { return s.att === "rejeter"; }); } },

    /* compte sous contrôle (SC) */
    controle: { w: 2, prof: { st: ["salarie", "retraite", "cdd"], rev: [1500, 3800], age: [24, 70] },
      tirer: function (r, pf) {
        var rev = pf.client.revenus, ouv = r.chance(0.5), solde = r.pas(1500, 4500, 10), ops = [];
        var total = r.pas(Math.round(solde * 0.3), Math.round(solde * 0.85), 10);
        var gros = cheque(r, P.CHEQUE_COURANT, 300, Math.round(total * 0.6));
        var a = ouv ? cheque(r, P.CHEQUE_PROJET, 700, Math.round(total * 0.7)) : gros;
        ops.push(a);
        var b = prelev(r, r.pick(["loyer", "assur", "energie"]), rev, 40, Math.round(total * 0.3));
        ops.push(b);
        var reste = total - a.m - b.m;
        if (reste < 8) return null;
        ops.push({ t: "carte", m: r2(reste), lib: null });
        return { note: ouv ? "C" : r.pick(["B", "C"]), aut: 0, solde: solde, cr: r.n(3, 25), ops: r.melange(ops), rej: [0, 0], controle: ouv ? "ouverture" : "fraude", opp: null, obj: "controle", ancMois: ouv ? r.n(1, 5) : null };
      },
      exige: function (pol) { return pol.every(function (s) { return s.att === "payer"; }); } },

    /* offre clientèle fragile (OCF) */
    ocf: { w: 3, prof: { st: ["salarie", "cdd", "chomage", "retraite"], rev: [900, 1500], age: [24, 72] },
      tirer: function (r, pf) {
        var rev = pf.client.revenus, aut = r.poids([[0, 3], [150, 2], [200, 1]]), solde = r.pas(40, 160, 5), carte = r.pas(10, solde + aut - 5, 1), delai = r.n(2, 14);
        var ops = [{ t: "carte", m: carte, lib: null }], av = solde - carte;
        var a = r.chance(0.5) ? prelev(r, r.pick(["energie", "tel", "assur"]), rev, 20, 120) : cheque(r, P.CHEQUE_COURANT, 25, 130);
        a.m = Math.max(a.m, av + aut + r.pas(20, 80, 5)); if (a.t === "cheque") a.m = Math.ceil(a.m / 5) * 5; if (a.m === 50) a.m = 55;
        ops.push(a);
        if (r.chance(0.6)) ops.push(cheque(r, P.CHEQUE_COURANT, 16, 40));
        return { note: "C", aut: aut, solde: solde, cr: delai, ops: ops, rej: [r.n(1, 2), 1], fragile: true, opp: null, obj: "ocf" };
      },
      exige: function (pol) { return pol.some(function (s) { return s.tol || s.att === "rejeter"; }); } },

    /* client fiché au FICP (FCP) */
    ficp: { w: 2, prof: { st: ["salarie", "cdd", "retraite", "chomage"], rev: [1100, 2300], age: [26, 70] },
      tirer: function (r, pf) {
        var rev = pf.client.revenus, solde = r.pas(60, 300, 10), carte = r.pas(15, Math.round(solde * 0.6), 1), ops = [{ t: "carte", m: carte, lib: null }];
        var av = solde - carte, a = r.chance(0.5) ? cheque(r, P.CHEQUE_COURANT, 40, 240) : prelev(r, r.pick(["assur", "divers", "energie", "tel"]), rev, 30, 240);
        a.m = Math.max(a.m, av + r.pas(20, 120, 5)); if (a.t === "cheque") a.m = Math.ceil(a.m / 5) * 5; if (a.m === 50) a.m = 55;
        ops.push(a);
        return { note: "D", aut: 0, solde: solde, cr: r.n(9, 20), ops: ops, rej: [r.n(3, 4), 2], ficp: true, opp: null, obj: "ficp" };
      },
      exige: function (pol) { return pol.some(function (s) { return s.att === "rejeter"; }); } },

    /* droit au compte (DAC) */
    dac: { w: 2, prof: { st: ["chomage", "salarie", "cdd", "retraite", "interim"], rev: [850, 1500], age: [22, 70] },
      tirer: function (r, pf) {
        var rev = pf.client.revenus, solde = r.pas(150, 450, 5), carte = r.pas(20, Math.round(solde * 0.5), 1), ops = [{ t: "carte", m: carte, lib: null }];
        var av = solde - carte, a = prelev(r, r.pick(["loyer", "energie", "assur", "tel"]), rev, 30, 700);
        a.m = r2(Math.max(a.m, av + r.pas(30, 250, 1)));
        ops.push(a);
        if (r.chance(0.5)) ops.push(prelev(r, "tel", rev, 12, Math.max(15, Math.round(av * 0.5))));
        return { note: "C", aut: 0, solde: solde, cr: r.n(12, 26), ops: ops, rej: [0, 0], dac: true, opp: null, obj: "dac", ancMois: r.n(2, 10) };
      },
      exige: function (pol, d) { return pol.some(function (s) { return s.att === "rejeter"; }) && d.operations.every(function (o) { return o.type !== "cheque"; }); } },

    /* compte à l'état des débiteurs depuis N jours */
    debiteur: { w: 3, prof: { st: ["salarie", "cdd", "retraite", "chomage", "interim"], rev: [900, 1900], age: [24, 72] },
      tirer: function (r, pf) {
        var rev = pf.client.revenus, aut = r.poids([[0, 3], [100, 1], [150, 2], [200, 1]]), delai = r.n(12, 20), dd = r.n(3, 29 - delai), dep = r.pas(60, 640, 5), solde = -aut - dep;
        var ops = [{ t: "carte", m: r.pas(10, 90, 1), lib: null }];
        var a = prelev(r, r.pick(["loyer", "energie", "assur", "credit", "divers"]), rev, 25, 520);
        ops.push(a);
        if (r.chance(0.7)) ops.push(cheque(r, P.CHEQUE_COURANT, 40, 300));
        var note = r.poids([["D", 2], ["E", 5]]);
        return { note: note, aut: aut, solde: solde, cr: delai, ops: ops, rej: note === "D" ? [r.n(3, 4), 2] : [r.n(4, 6), 3], dd: dd, dep: dep, opp: null, obj: "debiteur" };
      },
      exige: function (pol) { return pol.slice(1).every(function (s) { return s.att === "rejeter"; }); } },

    /* client en défaut (plus de 90 jours) */
    defaut: { w: 1, prof: { st: ["salarie", "cdd", "chomage", "interim"], rev: [900, 1700], age: [24, 62] },
      tirer: function (r, pf) {
        var rev = pf.client.revenus, aut = r.poids([[0, 2], [200, 1], [300, 2]]), dd = r.n(91, 220), dep = r.pas(500, 1500, 5), ops = [{ t: "carte", m: r.pas(10, 40, 1), lib: null }];
        ops.push(prelev(r, r.pick(["credit", "loyer", "assur"]), rev, 40, 400));
        return { note: "Défaut", aut: aut, solde: -aut - dep, cr: null, ops: ops, rej: [r.n(6, 8), 4], dd: dd, dep: dep, opp: null, obj: "defaut" };
      },
      exige: function (pol) { return pol.slice(1).every(function (s) { return s.att === "rejeter"; }); } },

    /* gros chèque que le salaire attendu ne couvre pas */
    gros_cheque: { w: 2, prof: { st: ["salarie"], rev: [2200, 4000], age: [28, 60] },
      tirer: function (r, pf) {
        var rev = pf.client.revenus, solde = r.pas(300, 2500, 10), dep = r.pas(Math.round(rev * 1.15 / 100) * 100, Math.round(rev * 2 / 100) * 100, 100);
        var v = r.pick(P.CHEQUE_VEHICULE.concat(P.CHEQUE_PROJET)), m = solde + dep;
        var ch = { t: "cheque", m: Math.round(m / 10) * 10, lib: v[0], kind: "cheque", motif: v[3] };
        return { note: r.poids([["A", 1], ["B", 3]]), aut: 0, solde: solde, cr: r.n(3, 12), ops: [ch], rej: [0, 0], opp: "credit", obj: "gros_cheque", projet: v[3] };
      },
      exige: function (pol) { return pol[0].att === "rejeter"; } }
  };

  var ORDRE = ["sain", "carte_rejet", "chq_rejet", "tolerance", "cheque15", "controle", "ocf", "ficp", "dac", "debiteur", "defaut", "gros_cheque"];

  var api = { prelevExact: prelevExact, chequeExact: chequeExact, SC: SC, ORDRE: ORDRE, profil: profil, antecedents: antecedents, opFinale: opFinale, carteOp: carteOp, creditDe: creditDe, prelev: prelev, cheque: cheque };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.quotidienDeb = api; }
})(typeof window !== "undefined" ? window : null);
