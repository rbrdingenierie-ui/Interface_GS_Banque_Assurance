/* GS Banque & Assurance – dossiers « du jour » : relevé de compte des trois derniers mois.
   Le relevé est fabriqué pour que tout soit cohérent : le solde actuel est exactement celui du dossier, les revenus arrivent à la date prévue,
   les prélèvements récurrents reviennent chaque mois au même montant, les rejets passés tombent un jour où la provision manquait vraiment
   et, pour un compte déjà à l'état des débiteurs, la durée d'irrégularité et les commissions d'intervention sont celles du dossier.
   Chaque ligne : [jours avant aujourd'hui, type, libellé, montant (− débit, + crédit), montant non débité (rejets)]. */
(function (root) {
  "use strict";

  var Q = root && root.SGBF && root.SGBF.quotidienBase ? root.SGBF.quotidienBase : require("./quotidien_base.js");
  var P = root && root.SGBF && root.SGBF.quotidienPools ? root.SGBF.quotidienPools : require("./quotidien_pools.js");
  var R = root && root.SGBF && root.SGBF.rules ? root.SGBF.rules : require("./rules.js");

  var JMAX = 90;
  var r2 = Q.r2;
  var TYPE_LIB = { prelevement: "prélèvement", cheque: "chèque" };

  function trier(l) { return l.slice().sort(function (a, b) { return b.j - a.j || a.ord - b.ord; }); }

  function libCarte(r, m, ville) { return "Paiement carte – " + P.carteSelon(r, m, ville); }

  /* Une tentative de relevé ; renvoie {ok, rel} ou {ok:false, why}. */
  function tenter(r, d, plan) {
    var pos = d.position, aut = pos.autorisation, cr = pos.creditAttendu, js = cr ? 30 - cr.dansJours : null;
    var jmax = plan.depart || JMAX, ouverture = !!plan.ouverture;
    var com = R.commissionClient(d), lignes = [], interdits = {}, paies = [], i, j, k;
    function add(l) { lignes.push(l); return l; }

    /* 1. revenus réguliers */
    if (cr) for (j = js; j <= jmax - 1; j += 30) { if (j >= 1) { add({ j: j, ord: 1, k: "virement", lib: "Virement reçu – " + cr.libelle, m: cr.montant, fixe: true }); paies.push(j); } }

    /* 2. rejets passés et frais de rejet (jour imposé par le dossier) */
    var rejets = [];
    d.antecedents.forEach(function (a) {
      if (a.joursAvant < 1 || a.joursAvant > jmax - 1) return;
      var frais = R.fraisRejetClient(d, a);
      add({ j: a.joursAvant, ord: 3, k: "rejet", lib: "Rejet de " + TYPE_LIB[a.type] + " – " + a.libelle + " (provision insuffisante)", m: 0, r: a.montant, fixe: true });
      add({ j: a.joursAvant, ord: 3.1, k: "frais", lib: "Frais de rejet de " + TYPE_LIB[a.type], m: -frais, fixe: true });
      interdits[a.joursAvant] = true;
      rejets.push({ j: a.joursAvant, montant: a.montant, frais: frais });
    });

    /* 3. prélèvements récurrents (mêmes libellé, montant et jour du cycle chaque mois) */
    var irr = plan.irreg || null;
    var jBloque = irr ? irr.N + 1 : 0;   /* à l'état des débiteurs depuis N jours : aucune opération récurrente après ce jour-là */
    (plan.recurrents || []).forEach(function (rc) {
      var j0 = cr ? (((js - rc.u) % 30) + 30) % 30 : (rc.j0 != null ? rc.j0 : 0), jj;
      for (jj = j0; jj <= jmax - 1; jj += 30) {
        if (jj < 1) continue;
        if (irr && jj <= jBloque) continue;
        if (interdits[jj]) { if (jj + 1 > jmax - 1) continue; jj0 = jj + 1; }
        var jj0 = interdits[jj] ? jj + 1 : jj;
        if (jj0 > jmax - 1 || interdits[jj0]) continue;
        add({ j: jj0, ord: 2 + r.f() * 0.5, k: rc.k, lib: rc.k === "prelevement" ? "Prélèvement " + rc.lib : rc.lib, m: -rc.m, fixe: true });
      }
    });

    /* 4. retraits et chèques à montants ronds */
    var rev = d.client.revenus || 1500;
    var rondes = rev < 1500 ? [20, 30, 40, 50] : rev < 3000 ? [30, 40, 50, 60, 80] : [50, 80, 100, 150];
    function jourLibre(lo, hi) {
      for (var t = 0; t < 80; t++) { var x = lo + Math.floor(r.f() * (hi - lo + 1)); if (!interdits[x] && paies.indexOf(x) < 0 && (!irr || x > jBloque)) return x; }
      return -1;
    }
    var nbRetraits = plan.retraits != null ? plan.retraits : 2, nbCheques = plan.cheques != null ? plan.cheques : 0, cheques = [], per;
    for (per = 0; per < 3; per++) {
      var lo = per * 30 + 1, hi = Math.min(per * 30 + 30, jmax - 1);
      if (lo > hi) continue;
      var frac = (hi - lo + 1) / 30, n1 = Math.round(nbRetraits * frac), n2 = Math.round(nbCheques * frac), t2;
      for (t2 = 0; t2 < n1; t2++) { j = jourLibre(Math.max(lo, irr ? jBloque + 1 : lo), hi); if (j > 0) add({ j: j, ord: 4 + r.f(), k: "retrait", lib: "Retrait au distributeur", m: -r.pick(rondes), fixe: true }); }
      for (t2 = 0; t2 < n2; t2++) {
        j = jourLibre(Math.max(lo, irr ? jBloque + 1 : lo), hi);
        if (j > 0) cheques.push(add({ j: j, ord: 4 + r.f(), k: "cheque", lib: null, m: -r.pick([18, 25, 30, 40, 45, 60, 80, 120]), fixe: true, benef: r.pick(P.CHEQUE_COURANT)[0].split(" – ")[0] }));
      }
    }
    var pend = d.operations.filter(function (o) { return o.type === "cheque"; }).map(function (o) { return parseInt((/n° (\d+)/.exec(o.detail) || [0, 0])[1], 10); }).filter(Boolean);
    cheques.sort(function (a, b) { return b.j - a.j || a.ord - b.ord; });
    var base = pend.length ? Math.min.apply(null, pend) - cheques.length - 2 : 2200000 + r.n(0, 9999);
    cheques.forEach(function (c, ix) { c.lib = "Chèque n° " + (base + ix + 1) + " – " + c.benef; });

    /* 5. compte déjà à l'état des débiteurs : paiement qui fait passer sous l'autorisation, puis commissions d'intervention */
    var bPre = null;
    if (irr) {
      bPre = r2(-aut + irr.x);
      var D = r2(-aut - pos.solde), extras = irr.extras || [], tot = 0, exj;
      extras.forEach(function (e) { tot += e.m + com.parOperation; });
      var ac = r2(D + irr.x - com.parOperation - tot);
      if (!(ac > irr.x + 5)) return { ok: false, why: "paiement déclencheur trop faible" };
      var c1 = add({ j: irr.N, ord: 5, k: "carte", lib: libCarte(r, ac, plan.ville), m: -ac, fixe: true });
      add({ j: irr.N, ord: 5.01, k: "commission", lib: "Commission d'intervention", m: -com.parOperation, fixe: true });
      extras.forEach(function (e, ix) {
        add({ j: e.j, ord: 5 + ix * 0.1, k: "carte", lib: libCarte(r, e.m, plan.ville), m: -e.m, fixe: true });
        add({ j: e.j, ord: 5.01 + ix * 0.1, k: "commission", lib: "Commission d'intervention", m: -com.parOperation, fixe: true });
      });
      interdits[irr.N] = true;
      exj = c1;
    }

    /* 6. repères de solde : la veille de chaque paie, la veille du paiement déclencheur, aujourd'hui */
    var ancres = [];
    paies.forEach(function (jp) { if (jp + 1 <= jmax - 1 || (!ouverture && jp + 1 <= jmax)) ancres.push({ j: jp + 1, b: null, rejet: null }); });
    rejets.forEach(function (rj) {
      var a = null;
      ancres.forEach(function (x) { if (x.j === rj.j) a = x; });
      if (a) a.rejet = rj;
      else if (cr) rj.sansAncre = true;
    });
    if (irr) ancres.push({ j: irr.N + 1, b: bPre, force: true });
    ancres.sort(function (a, b) { return b.j - a.j; });
    for (i = 1; i < ancres.length; i++) if (ancres[i].j === ancres[i - 1].j) return { ok: false, why: "ancres confondues" };
    if (!ancres.length || ancres[ancres.length - 1].j < 2) return { ok: false, why: "pas d'ancre" };
    ancres.push({ j: 1, b: pos.solde, force: true, final: true });
    var seg = ancres.map(function (a, ix) {
      var hi = ix === 0 ? jmax : ancres[ix - 1].j - 1, lo = a.j, s = 0, nbl = 0;
      lignes.forEach(function (l) { if (l.j >= lo && l.j <= hi) { s += l.m || 0; nbl++; } });
      return { a: a, lo: lo, hi: hi, jours: hi - lo + 1, S: r2(s), cards: 0 };
    });

    /* 7. passe arrière : du solde actuel vers le plus ancien repère */
    var minB = plan.minB != null ? plan.minB : 0, ratioLo = plan.ratioLo || 0.55, ratioHi = plan.ratioHi || 1.0;
    for (i = ancres.length - 1; i >= 1; i--) {
      var s = seg[i], bi = ancres[i].b, prev = ancres[i - 1], cartes, T;
      if (s.hi < s.lo) { s.cards = 0; if (prev.b == null) prev.b = r2(bi - s.S); continue; }
      if (irr && prev.force && prev.b != null && i === ancres.length - 1) {
        cartes = r2(prev.b + s.S - bi);
        if (Math.abs(cartes) > 0.005) return { ok: false, why: "segment explicite incohérent " + cartes };
        s.cards = 0; continue;
      }
      if (prev.force) {
        cartes = r2(prev.b + s.S - bi);
        if (cartes < 0.4 * Math.max(0, s.S) * 0 + 1 * s.jours * 0.0) return { ok: false, why: "cartes négatives" };
        s.cards = cartes;
        if (cartes < 3 * s.jours || cartes > 1.35 * Math.max(0, s.S) + 0.3 * Math.max(0, bi) + 60) return { ok: false, why: "cartes hors bande (repère imposé) " + cartes };
        continue;
      }
      var disp = Math.max(0, s.S);
      var ratio = ratioLo + r.f() * (ratioHi - ratioLo);
      cartes = disp * ratio;
      T = r2(bi - s.S + cartes);
      var maxB = Math.max(Math.abs(bi) * 1.25 + 120, 600);
      if (prev.rejet) maxB = Math.min(maxB, prev.rejet.montant - prev.rejet.frais - aut - 3);
      if (maxB < minB + 1) return { ok: false, why: "rejet impossible (capacité)" };
      if (T < minB) T = minB + r.f() * Math.min(120, maxB - minB);
      else if (T > maxB) T = maxB - r.f() * Math.min(120, maxB - minB);
      T = r2(T);
      if (!prev.rejet && plan.neg) T = -r2(plan.neg[0] + r.f() * (plan.neg[1] - plan.neg[0]));
      else if (!prev.rejet && plan.low) T = r2(plan.low[0] + r.f() * (plan.low[1] - plan.low[0]));
      if (prev.rejet) { T = r2(minB + r.f() * Math.min(Math.max(1, maxB - minB), 150)); if (T > maxB) T = maxB; }
      cartes = r2(T + s.S - bi);
      if (cartes < Math.max(3 * s.jours, 0.3 * disp) || cartes > 1.35 * disp + 0.3 * Math.max(0, bi) + 60) return { ok: false, why: "cartes hors bande " + cartes + " pour S=" + s.S };
      prev.b = T; s.cards = cartes;
    }
    /* segment le plus ancien : dépenses libres, solde d'ouverture déduit */
    var s0 = seg[0];
    if (s0.hi >= s0.lo) {
      var vol = Math.max(3 * s0.jours, (plan.cartes0 != null ? plan.cartes0 : (rev * (0.3 + r.f() * 0.15)) * s0.jours / 30));
      s0.cards = r2(Math.max(0, vol));
    }

    /* 8. répartition des paiements par carte dans chaque segment */
    var ticketMoyen = Math.max(24, Math.min(70, Math.round(rev / 55)));
    var cartesLignes = [];
    seg.forEach(function (sg, ix) {
      if (sg.cards <= 0.004) return;
      var nbp = Math.max(1, Math.min(Math.round(30 * sg.jours / 30 * 0.9), Math.round(sg.cards / ticketMoyen), 28)), jours = [], t3, tries;
      if (sg.jours < 8) nbp = Math.min(nbp, sg.jours);
      for (t3 = 0; t3 < nbp; t3++) {
        tries = 0; var jj;
        do { jj = sg.hi - Math.min(sg.jours - 1, Math.floor(sg.jours * Math.pow(r.f(), 1.3))); tries++; } while (tries < 40 && (interdits[jj] || (irr && jj <= jBloque)));
        if (interdits[jj] || (irr && jj <= jBloque)) continue;
        jours.push(jj);
      }
      if (!jours.length) return;
      var w = jours.map(function () { return 0.3 + 2.1 * Math.pow(r.f(), 2); }), sw = 0, m;
      w.forEach(function (x) { sw += x; });
      var montants = w.map(function (x) { return Math.floor((sg.cards * x / sw) * 100) / 100; }), tot2 = 0;
      montants.forEach(function (x) { tot2 += x; });
      var reste = r2(sg.cards - tot2), imax = montants.indexOf(Math.max.apply(null, montants));
      montants[imax] = r2(montants[imax] + reste);
      var ordre = montants.map(function (x, t) { return [x, t]; }).sort(function (a, b) { return b[0] - a[0]; }).map(function (x) { return x[1]; });
      jours.forEach(function (jd, t) {
        var rang = ordre.indexOf(t) / Math.max(1, montants.length - 1), tier = rang < 0.25 ? "gros" : rang < 0.65 ? "moyen" : "petit";
        if (montants[t] < 0.5) return;
        cartesLignes.push({ j: jd, ord: 6 + r.f(), k: "carte", lib: libCarte(r, montants[t], plan.ville), m: -montants[t], fill: true });
      });
      sg.placed = true;
    });
    for (i = 0; i < cartesLignes.length; i++) lignes.push(cartesLignes[i]);

    /* 9. versement initial (compte récent) */
    var tri = trier(lignes), somme = 0;
    tri.forEach(function (l) { somme += l.m || 0; });
    var ouv = r2(pos.solde - somme);
    if (ouverture) {
      var dep = { j: jmax, ord: 0, k: "ouverture", lib: "Ouverture du compte – versement initial", m: ouv };
      if (!(dep.m > 0)) return { ok: false, why: "versement initial négatif" };
      tri.unshift(dep);
    }

    /* 10. contrôles */
    var solde = ouverture ? 0 : ouv, min = Infinity, ordreOk = true;
    if (!ouverture && ouv < 0 && -ouv > aut) return { ok: false, why: "ouverture sous l'autorisation" };
    var avant, premierDeb = null, enCours = false;
    for (i = 0; i < tri.length; i++) {
      var l = tri[i];
      avant = solde;
      solde = r2(solde + (l.m || 0));
      min = Math.min(min, solde);
      var e = R.etat(solde, aut).code;
      if (l.k === "rejet" && !(r2(avant + aut) < l.r)) return { ok: false, why: "rejet sans insuffisance de provision j" + l.j };
      if (irr && l.j >= irr.N + 1 && e === "etat_debiteurs" && l.k !== "frais") return { ok: false, why: "état des débiteurs trop tôt j" + l.j };
      if (!irr && e === "etat_debiteurs") return { ok: false, why: "état des débiteurs dans le passé j" + l.j };
      if (irr && l.j === irr.N && l.k === "carte" && !(R.etat(avant, aut).code !== "etat_debiteurs" && e === "etat_debiteurs")) return { ok: false, why: "paiement déclencheur" };
    }
    if (Math.abs(solde - pos.solde) > 0.005) return { ok: false, why: "solde final " + solde };
    return { ok: true, rel: { depart: jmax, lignes: tri.map(function (l) { var a = [l.j, l.k, l.lib, l.m]; if (l.r != null) a.push(l.r); return a; }) }, min: min, ouverture: ouv };
  }

  function construire(graine, d, plan) {
    var essai, res = null, dernier = "";
    for (essai = 0; essai < 60; essai++) {
      var r = Q.rng(graine + "|releve|" + essai);
      res = tenter(r, d, plan);
      if (res.ok) return res.rel;
      dernier = res.why;
    }
    throw new Error("relevé impossible (" + dernier + ")");
  }

  var api = { construire: construire, JMAX: JMAX };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.quotidienReleve = api; }
})(typeof window !== "undefined" ? window : null);
