/* GS Banque & Assurance – générateur de l'historique de mouvements d'un client (données imaginaires).
   Principe : le compte est découpé en « cycles de paie » (du jour où arrive le revenu principal au jour précédent le suivant).
   Le solde juste avant le revenu de chaque cycle (« ancre ») ne dépend que du client et du mois : il garantit un historique
   cohérent d'un jour à l'autre. Les revenus, charges fixes, mouvements ponctuels (dépense inhabituelle, succession…) sont
   posés à leur date ; les dépenses courantes (carte, retraits, chèques) complètent exactement la différence entre deux ancres.
   Rien n'indique à l'élève la signification des mouvements : il doit les interpréter. */
(function (root) {
  "use strict";

  var B = root && root.SGBF ? root.SGBF.banque : require("./banque.js");

  /* ---------- aléa déterministe ---------- */
  function h32(a, b, c) {
    var h = (Math.imul(a | 0, 0x9E3779B1) ^ Math.imul(b | 0, 0x85EBCA6B) ^ Math.imul(c | 0, 0xC2B2AE35)) >>> 0;
    h ^= h >>> 16; h = Math.imul(h, 0x7feb352d) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x846ca68b) >>> 0; h ^= h >>> 16;
    return h >>> 0;
  }
  function hash01(a, b, c) { return h32(a, b, c) / 4294967296; }
  function rng(seed) {
    var a = seed >>> 0;
    return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function gauss(r) { var u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  var r2 = B.arrondi;

  var LIB_CRE = { CIMMO: "prêt immobilier", CCONSO: "prêt personnel", CAUTO: "crédit auto", CTRAV: "prêt travaux" };
  var LIB_ASS = { MRH: "GS Habitat – assurance habitation", AUTO: "GS Auto – assurance automobile", GAV: "GS Protection Famille – accidents de la vie", PREV: "GS Prévoyance – décès et invalidité",
    DECES: "GS Décès – assurance décès temporaire", DEP: "GS Autonomie – assurance dépendance", OBSQ: "GS Obsèques – garantie obsèques", MOTO: "GS Moto – assurance deux-roues", CCAR: "GS Camping-car – assurance camping-car",
    VSP: "GS Mobilité – assurance voiture sans permis", PJ: "GS Protection juridique", APN: "GS Nomade – assurance appareils nomades" };
  var LIB_LIVRET = { LA: "Livret A", LDDS: "LDDS" };
  var COM = {
    courses: ["Supermarché Grand Marché", "Supermarché Express Centre", "Supermarché Marché Plus"],
    carburant: ["Station Relais Nord – carburant", "Station Relais Est – carburant", "Station Relais Porte – carburant"],
    restauration: ["Restaurant Chez Mamie", "Pizzeria Il Sole", "Brasserie de la Gare", "Café de la Gare", "Crêperie du Canal", "Snack Le Comptoir"],
    sante: ["Pharmacie du Centre", "Pharmacie Saint-Michel", "Cabinet médical – honoraires", "Optique du Centre"],
    loisirs: ["Cinéma Le Select", "Librairie Le Passage", "Magasin de sport Sportifs", "Jardinerie Les Saisons", "Billetterie spectacle"],
    habillement: ["Boutique Mode & Co", "Prêt-à-porter Élégance", "Chaussures du Centre", "Magasin Mode Enfants"],
    maison: ["Droguerie du Centre", "Bricolage Bricol'Maison", "Meubles & Décor", "Électroménager Pro"],
    quotidien: ["Boulangerie du Marché", "Presse & Tabac du Coin", "Boulangerie Les Délices", "Pâtisserie du Marché", "Parking du Centre-ville", "Primeur & Co", "Marché Frais", "Boucherie Lemoine", "Épicerie Bio du Centre"],
    web: ["Boutique en ligne Mondial Achat", "Boutique en ligne Maison Plus", "Plateforme de livraison repas", "Boutique en ligne Mode Express"],
    transport: ["Billet train grandes lignes", "Titre de transport – Île-de-France Mobilités", "Péage autoroute – Sud"]
  };
  var CLIENTS_IND = ["Atelier Morel", "SARL Bertin", "Mme Lefort", "Cabinet Rolland", "Établissements Jouan", "M. Dubois", "Mairie – facture", "SCI Les Pins", "Société Pellerin", "Association Les Roseaux"];

  /* ---------- cycles de paie ---------- */
  function debutCycle(c, k) { return B.ouvrePrecedent(B.dateDuMois(k, c.m.s === 0 ? 31 : c.m.s)); }
  function finCycle(c, k) { return B.plusJours(debutCycle(c, k + 1), -1); }
  function cycleDe(c, d) {
    var k = B.indexMois(d) + 1;
    while (debutCycle(c, k) > d) k--;
    return k;
  }
  /* Plancher que le solde ne doit jamais franchir en cours de mois (selon la situation du client). */
  function plancher(c) {
    var dec = c.cpt.dec || 0, fl = c.m.fl, sc = String(c.m.sc).split(",");
    if (sc.indexOf("S8a") >= 0) return -dec + 10;
    if (sc.indexOf("S8b") >= 0 || sc.indexOf("S1") >= 0) return fl;
    return fl > 0 ? Math.round(0.6 * fl) : fl;
  }
  /* Profil du solde : amplitude des variations d'un mois à l'autre (jamais supérieure à ce que permet la marge du client,
     sinon les dépenses courantes d'un mois deviendraient négatives) et relèvement éventuel, quand une grosse charge tombe
     avant l'arrivée d'un revenu (le solde de départ du mois doit alors être plus élevé). */
  var cacheProfil = {};
  function profil(c) {
    var cle = c.id + "|" + B.ymd(B.aujourdhui());
    if (cacheProfil[cle]) return cacheProfil[cle];
    var kf = cycleDe(c, B.aujourdhui()), kd = cycleDe(c, ouverture(c)), mini = Infinity, creux = 0, pl = plancher(c);
    for (var k = Math.max(kd, kf - 16); k <= kf; k++) {
      var cy = cycle(c, k, true);
      if (cy.vide) continue;
      var t = cy.lignes.reduce(function (a, l) { return a + l.m; }, 0);
      if (t < mini) mini = t;
      var tri = cy.lignes.slice().sort(function (x, y) { return x.date - y.date || x.ord - y.ord; }), cum = 0;
      tri.forEach(function (l) { cum += l.m; if (cum < creux) creux = cum; });
    }
    var res = {
      amp: mini === Infinity ? c.m.am : Math.max(0, Math.min(c.m.am, mini - 170)),
      lift: Math.max(0, Math.ceil(pl - (c.m.fl + creux)))
    };
    cacheProfil[cle] = res;
    return res;
  }
  function ancre(c, k) { var p = profil(c); return r2(c.m.fl + p.lift + p.amp * hash01(c.id, k, 11)); }
  /* Date d'ouverture effective : premier jour ouvré, et au plus tôt le premier jour du cycle qui suit si l'ouverture tombe en toute fin de cycle. */
  function ouverture(c) {
    var raw = B.dateJours(c.cpt.ouvert), O = B.ouvreSuivant(raw), k = cycleDe(c, raw);
    return O > finCycle(c, k) ? debutCycle(c, k + 1) : O;
  }

  function actif(item, ref) {
    if (item.from != null && ref < B.dateJours(item.from)) return false;
    if (item.to != null && ref >= B.dateJours(item.to)) return false;
    return true;
  }
  /* Date d'exécution du prélèvement mensuel (jour d du mois) rattaché au cycle k : une seule fois par cycle.
     Si le jour du prélèvement est avant le jour de paie, c'est celui du mois suivant (il tombe avant la fin du cycle).
     Le prélèvement est exécuté le jour ouvré suivant la date, sans jamais sortir du cycle. */
  function occurrence(c, k, d, debut, suivant) {
    var s = c.m.s === 0 ? 31 : c.m.s;
    var mm = d >= s ? k : k + 1;
    var ex = B.ouvreSuivant(B.dateDuMois(mm, d));
    if (ex >= suivant) ex = B.ouvrePrecedent(B.plusJours(suivant, -1));
    if (ex < debut) ex = debut;
    return { date: ex, mm: mm };
  }
  var ORD = { revenu: 0, fixe: 1, evenement: 2, variable: 3 };
  function ligne(date, ord, kind, lib, m, extra) {
    var l = { date: date, ord: ord, kind: kind, lib: lib, m: r2(m) };
    if (extra) for (var p in extra) l[p] = extra[p];
    return l;
  }
  function numCheque(r) { return String(3000000 + Math.floor(r() * 5000000)); }
  function ville(c) { return c.adr.ville; }

  /* Groupe de mouvements d'un événement : dates de départ, ramenées dans un seul cycle. */
  function datesEvenement(c, ev, nbJours) {
    var F = B.ouvrePrecedent(B.dateJours(ev.j + 1));
    var k = cycleDe(c, F), fin = finCycle(c, k);
    var E = B.ouvreSuivant(B.plusJours(F, 1)), last = E;
    for (var i = 1; i < nbJours; i++) last = B.ouvreSuivant(B.plusJours(last, 1));
    if (last > fin) { F = B.ouvreSuivant(debutCycle(c, k + 1)); k = k + 1; }
    return { F: F, k: k };
  }
  function avancer(d, n) { var x = d; for (var i = 0; i < n; i++) x = B.ouvreSuivant(B.plusJours(x, 1)); return x; }

  /* ---------- un cycle ---------- */
  function cycle(c, k, base) {
    var debut = debutCycle(c, k), suivant = debutCycle(c, k + 1), fin = B.plusJours(suivant, -1);
    var open = ouverture(c);
    if (fin < open) return { k: k, debut: debut, fin: fin, lignes: [], vide: true, B0: 0, B1: 0 };
    var r = rng(h32(c.id, k, 7));
    var m = c.m, lignes = [];
    var jours = B.ecartJours(suivant, debut);
    var apresOuv = null;

    /* revenus */
    m.rev.forEach(function (l) {
      if (l.k === "clients") {
        if (!actif(l, debut)) return;
        var n = l.n, parts = [], tot = 0, i;
        for (i = 0; i < n; i++) { var w = i === 0 ? 2.2 + r() : 0.6 + r(); parts.push(w); tot += w; }
        var amounts = parts.map(function (w) { return Math.round(l.m * w / tot / 10) * 10; });
        amounts[0] += Math.round(l.m - amounts.reduce(function (a, b) { return a + b; }, 0));
        amounts.forEach(function (a, j) {
          var o = j === 0 ? Math.floor(r() * 3) : 3 + Math.floor(r() * Math.max(2, jours - 14));
          var date = B.ouvrePrecedent(B.plusJours(debut, o)); if (date < debut) date = debut;
          lignes.push(ligne(date, ORD.revenu, "virement", "Virement reçu – règlement client – " + CLIENTS_IND[Math.floor(r() * CLIENTS_IND.length)], a));
        });
        return;
      }
      var date = B.ouvrePrecedent(B.plusJours(debut, l.o || 0));
      if (date < debut) date = debut;
      if (!actif(l, date)) return;
      lignes.push(ligne(date, ORD.revenu, "virement", l.lib, l.m));
    });

    /* charges fixes */
    var fixes = [];
    function fixe(d, lib, montant, kind, from, to, apres, extra) { fixes.push({ d: d, lib: lib, m: montant, kind: kind, from: from, to: to, apres: apres, extra: extra }); }
    m.fx.forEach(function (x) { fixe(x.d, x.lib, x.m, x.k, x.from, x.to, null, null); });
    if (c.log.st === "locataire") fixe(c.log.jLoy, "Prélèvement loyer – " + c.log.bailleur, c.log.loyer, "prelevement", null, null, null, null);
    c.cre.forEach(function (x) {
      if (x.ext) return; /* prêt d'un autre établissement : remboursé depuis le compte tenu là-bas */
      var o = B.dateJours(x.ouvert), k0 = B.indexMois(o) + 1;
      var lib = "Prélèvement échéance " + LIB_CRE[x.p] + " – GS Banque & Assurance";
      fixes.push({ d: x.jEch, lib: lib, m: x.mens + (x.assM || 0), kind: "prelevement", k0: k0, dur: x.dur });
    });
    (m.extCre || []).forEach(function (x) {
      var o = B.dateJours(x.ouvert), k0 = B.indexMois(o) + 1;
      fixes.push({ d: x.jEch, lib: "Prélèvement " + String(x.objet).toLowerCase() + " – " + x.etab, m: x.mens, kind: "prelevement", k0: k0, dur: x.dur });
    });
    c.ass.forEach(function (a) { fixe(a.jd, "Prélèvement " + LIB_ASS[a.p], a.prime, "prelevement", null, null, B.dateJours(a.ouvert), null); });
    c.epa.forEach(function (e) { if (e.vm) fixe(e.jv, "Virement permanent – " + LIB_LIVRET[e.p], e.vm, "virement", null, null, B.dateJours(e.ouvert), null); });
    c.plc.forEach(function (e) { if (e.vp) fixe(e.jv, "Versement programmé – assurance-vie GS Vie Patrimoine", e.vp, "virement", null, null, B.dateJours(e.ouvert), null); });
    if (m.vers) fixe(m.vers.d, m.vers.lib, m.vers.m, "virement", null, null, null, null);
    fixes.forEach(function (x) {
      var o = occurrence(c, k, x.d, debut, suivant);
      if (x.apres && o.date <= x.apres) return;
      if (x.from != null && o.date < B.dateJours(x.from)) return;
      if (x.to != null && o.date >= B.dateJours(x.to)) return;
      if (x.k0 != null && (o.mm < x.k0 || o.mm - x.k0 + 1 > x.dur)) return;
      lignes.push(ligne(o.date, ORD.fixe, x.kind, x.lib, -x.m));
    });
    if (base) return { k: k, lignes: lignes, vide: false };
    var B0 = ancre(c, k), B1 = ancre(c, k + 1);
    /* intérêts débiteurs (découvert utilisé) */
    var ag = r2(Math.max(0, -B1) * 0.0042);
    if (ag >= 0.5) lignes.push(ligne(B.ouvrePrecedent(B.plusJours(fin, -1)), ORD.fixe, "frais", "Intérêts débiteurs – découvert autorisé", -ag, { frais: true }));

    /* mouvements ponctuels */
    (m.ev || []).forEach(function (ev) {
      if (ev.k === "dep") {
        var g = datesEvenement(c, ev, 2);
        if (g.k !== k) return;
        var F = g.F, E = B.ouvreSuivant(B.plusJours(F, 1));
        var src = ev.fund === "LA" || ev.fund === "LDDS" ? "Virement reçu – " + LIB_LIVRET[ev.fund]
          : ev.fund === "AV" ? "Virement reçu – rachat partiel assurance-vie GS Vie Patrimoine"
          : ev.fund === "CRED_SG" ? "Déblocage du prêt – " + LIB_CRE[c.cre[ev.cre].p] + " GS Banque & Assurance"
          : "Virement reçu – " + ev.etab + " – déblocage de crédit";
        lignes.push(ligne(F, ORD.evenement, "virement", src, ev.m, { evenement: true }));
        var nom = ev.lib.replace(/^Paiement – /, "").replace(/^Virement émis – /, "");
        if (ev.pay === "carte") lignes.push(ligne(E, ORD.evenement, "carte", "Paiement carte – " + nom, -ev.m, { evenement: true }));
        else if (ev.pay === "cheque") lignes.push(ligne(E, ORD.evenement, "cheque", "Chèque n° " + numCheque(r) + " – " + nom, -ev.m, { evenement: true }));
        else lignes.push(ligne(E, ORD.evenement, "virement", "Virement émis – " + nom, -ev.m, { evenement: true }));
      } else if (ev.k === "heritage") {
        var g2 = datesEvenement(c, ev, 1 + ev.parts.length * 2);
        if (g2.k !== k) return;
        lignes.push(ligne(g2.F, ORD.evenement, "virement", "Virement reçu – " + ev.notaire + " – " + (ev.motif || "règlement de succession"), ev.m, { evenement: true }));
        var d = g2.F;
        ev.parts.forEach(function (p) {
          d = avancer(d, 2);
          var lib = p.k === "AV" ? "Versement assurance-vie – souscription GS Vie Patrimoine" : p.k === "LA" ? "Virement émis – Livret A" : p.lib;
          lignes.push(ligne(d, ORD.evenement, "virement", lib, -p.m, { evenement: true }));
        });
      }
    });

    /* ouverture du compte pendant le cycle */
    var connu = lignes.reduce(function (t, l) { return t + l.m; }, 0), avertissement = null;
    var depart = debut;
    var ouvLigne = null;
    if (cycleDe(c, open) === k) {
      var O = open;
      lignes = lignes.filter(function (l) { return l.date >= O; });
      connu = lignes.reduce(function (t, l) { return t + l.m; }, 0);
      depart = O;
      var restant = Math.max(1, B.ecartJours(suivant, O)) / jours;
      var typ = Math.max(80, (c.m.rev.filter(function (l) { return actif(l, debut); }).reduce(function (t, l) { return t + l.m; }, 0) - fixes.length * 40) * 0.45);
      /* la dépense attendue sur les jours restants ne doit jamais tomber sous le minimum du cycle (compte ouvert la veille de la fin du cycle) */
      var attendue = Math.max(typ * restant, 4 * Math.min(Math.max(1, B.ecartJours(suivant, O)), 28) + 12);
      var depot = Math.max(100, Math.round((B1 - connu + attendue) / 10) * 10);
      ouvLigne = ligne(O, ORD.revenu, "ouverture", "Ouverture du compte – versement initial", depot);
      lignes.push(ouvLigne);
      B0 = 0;
      connu += depot;
    }

    /* dépenses courantes : elles complètent exactement la différence entre les deux ancres */
    var V = r2(connu - (B1 - B0));
    var dep = depart;
    var jRest = Math.max(1, B.ecartJours(suivant, dep));
    var Vmin = 4 * Math.min(jRest, 28);
    if (V < Vmin) avertissement = "dépenses courantes trop faibles (" + V + ")";
    var cartes = c.cartes[0];
    var sansPaiement = cartes.p === "CRET";
    var age = c.age, revCycle = c.m.rev.filter(function (l) { return actif(l, debut); }).reduce(function (t, l) { return t + l.m; }, 0);
    var partEsp = sansPaiement ? 0.7 : age >= 65 ? 0.14 : age >= 50 ? 0.09 : 0.06;
    var cash = Math.min(V, Math.round(V * partEsp * (0.7 + 0.6 * r()) / 10) * 10);
    var nCh = (sansPaiement || (age >= 55 && r() < 0.5)) ? 1 + Math.floor(r() * 2) : 0;
    var cheques = [];
    for (var i = 0; i < nCh; i++) cheques.push(r2(Math.min(V * 0.12, 25 + r() * 150)));
    var totCh = cheques.reduce(function (a, b) { return a + b; }, 0);
    if (sansPaiement) {
      var maxEsp = V - totCh; cash = Math.max(0, Math.min(maxEsp, Math.floor(maxEsp / 10) * 10));
      if (cheques.length) cheques[cheques.length - 1] = r2(cheques[cheques.length - 1] + (V - cash - totCh)); /* le reliquat va sur un chèque */
      totCh = cheques.reduce(function (a, b) { return a + b; }, 0);
    }
    var vCarte = r2(V - cash - totCh);
    if (vCarte < 0) { cash = Math.max(0, cash + Math.floor(vCarte / 10) * 10); vCarte = r2(V - cash - totCh); }

    var pending = [];
    /* retraits */
    var nW = cash <= 0 ? 0 : Math.max(1, Math.min(5, Math.round(cash / 55)));
    if (sansPaiement && cash > 0) nW = Math.max(2, nW);
    var restCash = cash;
    for (var w = 0; w < nW; w++) {
      var part = w === nW - 1 ? restCash : Math.max(10, Math.round(restCash / (nW - w) * (0.6 + 0.8 * r()) / 10) * 10);
      part = Math.min(part, restCash);
      if (part <= 0) continue;
      restCash -= part;
      pending.push({ a: part, kind: "retrait", lib: "Retrait distributeur – " + (r() < 0.8 ? "GS Banque & Assurance" : "autre banque") });
    }
    /* chèques */
    cheques.forEach(function (a) { pending.push({ a: a, kind: "cheque", lib: "Chèque n° " + numCheque(r) + " – " + COM[r() < 0.5 ? "sante" : "quotidien"][Math.floor(r() * 3)] }); });
    /* paiements par carte */
    if (vCarte > 0.01 && !sansPaiement) {
      var ticket = 28 + 0.011 * revCycle;
      var n = Math.max(4, Math.min(26, Math.round(vCarte / ticket)));
      var wts = [], sw = 0;
      for (var q = 0; q < n; q++) { var ww = Math.exp(0.9 * gauss(r)); wts.push(ww); sw += ww; }
      var mts = wts.map(function (ww) { return r2(vCarte * ww / sw); });
      var diff = r2(vCarte - mts.reduce(function (a, b) { return a + b; }, 0));
      var imax = mts.indexOf(Math.max.apply(null, mts)); mts[imax] = r2(mts[imax] + diff);
      var ordre = mts.map(function (a, i) { return [a, i]; }).sort(function (a, b) { return b[0] - a[0]; });
      var vehicule = c.veh, enfants = c.fam.nbCharge > 0;
      ordre.forEach(function (pair, rang) {
        var amt = pair[0], frac = rang / n, cat;
        var u = r();
        if (frac < 0.2) cat = u < 0.62 ? "courses" : u < 0.78 ? "maison" : (vehicule ? "carburant" : "web");
        else if (frac < 0.6) cat = u < 0.25 ? "restauration" : u < 0.42 ? "sante" : u < 0.58 ? "loisirs" : u < 0.74 ? "habillement" : (vehicule ? "carburant" : "courses");
        else cat = u < 0.45 ? "quotidien" : u < 0.7 ? "web" : u < 0.85 ? "restauration" : "transport";
        if (enfants && cat === "loisirs" && u < 0.2) cat = "habillement";
        var pool = COM[cat], nom = pool[Math.floor(r() * pool.length)];
        var lib = "Paiement carte – " + nom + (/en ligne|Billet|Titre|Péage|Plateforme|Billetterie/.test(nom) ? "" : " – " + ville(c));
        pending.push({ a: amt, kind: "carte", lib: lib });
      });
    }

    /* placement des dépenses courantes : une date au hasard, repoussée si le solde passerait sous le plancher */
    var nbJ = B.ecartJours(fin, depart) + 1, bal = [], jourD = [], ouvrable = [], parJour = [], suf = [], plan = plancher(c), j;
    for (j = 0; j < nbJ; j++) { jourD.push(B.plusJours(depart, j)); ouvrable.push(B.estOuvre(jourD[j])); parJour.push(0); }
    lignes.forEach(function (l) { var ix = B.ecartJours(l.date, depart); if (ix >= 0 && ix < nbJ) parJour[ix] += l.m; });
    var courant = B0;
    for (j = 0; j < nbJ; j++) { courant += parJour[j]; bal.push(courant); }
    function recalc() { var mn = Infinity; for (var z = nbJ - 1; z >= 0; z--) { if (bal[z] < mn) mn = bal[z]; suf[z] = mn; } }
    recalc();
    var dernierOuvre = nbJ - 1; while (dernierOuvre > 0 && !ouvrable[dernierOuvre]) dernierOuvre--;
    var tri = pending.map(function (p, ix) { return { p: p, ix: ix }; }).sort(function (x, y) { return y.p.a - x.p.a || x.ix - y.ix; });
    tri.forEach(function (t) {
      var a = t.p.a, ix = Math.min(nbJ - 1, Math.floor(r() * jRest));
      while (ix < dernierOuvre && (!ouvrable[ix] || suf[ix] - a < plan)) ix++;
      if (ix > dernierOuvre) ix = dernierOuvre;
      for (var z = ix; z < nbJ; z++) bal[z] = r2(bal[z] - a);
      recalc();
      lignes.push(ligne(jourD[ix], ORD.variable, t.p.kind, t.p.lib, -a));
    });

    lignes.forEach(function (l, i) { l.n = i; });
    lignes.sort(function (a, b) { return a.date - b.date || a.ord - b.ord || a.n - b.n; });
    return { k: k, debut: debut, fin: fin, lignes: lignes, B0: B0, B1: B1, avertissement: avertissement, V: V, ouvLigne: ouvLigne, vide: false };
  }

  /* ---------- opérations de service exécutées par l'élève (operations_service.js) ----------
     Chaque opération exécutée porte ses mouvements : { ymd, kind, lib, m }. Ils s'ajoutent au relevé du client à leur date (jamais dans le futur) et le solde est recalculé. */
  function lignesOperations(c) {
    var st = B.store && B.store.charger ? B.store.charger() : null, auj = B.aujourdhui(), res = [];
    if (!st) return res;
    /* frais d'envoi à domicile d'une carte vendue ou d'un chéquier remis à l'ouverture d'un compte (souscriptions du catalogue) */
    (Array.isArray(st.souscriptions) ? st.souscriptions : []).forEach(function (s) {
      if (s.c !== c.id) return;
      var d = B.lireYmd ? B.lireYmd(s.date) : null;
      if (!d || d > auj) return;
      if (s.fraisEnvoi) res.push({ date: d, ymd: s.date, kind: "frais", lib: "Envoi à domicile de la carte en recommandé", m: r2(-s.fraisEnvoi), evenement: false, operation: s.id, ordre: 0 });
      if (s.options && s.options.fraisChequier) res.push({ date: d, ymd: s.date, kind: "frais", lib: "Envoi à domicile du chéquier en recommandé", m: r2(-s.options.fraisChequier), evenement: false, operation: s.id, ordre: 1 });
    });
    (Array.isArray(st.operations) ? st.operations : []).forEach(function (o) {
      if (o.statut !== "executee") return;
      var mvs = o.c === c.id ? o.mv : (o.cible === c.id ? o.mv2 : null);      /* mv2 : mouvements du client destinataire d'un virement interne */
      if (!Array.isArray(mvs)) return;
      mvs.forEach(function (x, i) {
        var d = B.lireYmd ? B.lireYmd(x.ymd) : null;
        if (d && d <= auj) res.push({ date: d, ymd: x.ymd, kind: x.kind, lib: x.lib, m: r2(x.m), evenement: false, operation: o.id, ordre: i });
      });
    });
    /* saisies administratives à tiers détenteur (satd.js) : frais le jour de la réception de l'avis, versement au Trésor public le jour de la fin du blocage */
    (Array.isArray(st.satd) ? st.satd : []).forEach(function (z) {
      if (z.c !== c.id || !Array.isArray(z.mv)) return;
      z.mv.forEach(function (x, i) {
        var d = B.lireYmd ? B.lireYmd(x.ymd) : null;
        if (d && d <= auj) res.push({ date: d, ymd: x.ymd, kind: x.kind, lib: x.lib, m: r2(x.m), evenement: false, operation: z.id, ordre: i });
      });
    });
    return res;
  }
  function triDate(l) { return l.map(function (x, i) { return [x, i]; }).sort(function (a, b) { return (a[0].date - b[0].date) || (a[1] - b[1]); }).map(function (p) { return p[0]; }); }

  /* ---------- relevé ---------- */
  var cache = {};
  function cleCache(c) { return c.id + "|" + B.ymd(B.aujourdhui()); }
  function categorie(l) {
    if (l.kind === "carte") return "carte";
    if (l.kind === "retrait") return "retrait";
    if (l.kind === "cheque") return "cheque";
    if (l.kind === "frais") return "frais";
    if (l.kind === "ouverture") return "ouverture";
    if (l.kind === "prelevement") return "prelevement";
    return l.m > 0 ? "virement_recu" : "virement_emis";
  }
  /* Relevé des 12 derniers mois pleins et du mois en cours jusqu'à aujourd'hui, avec le solde après chaque mouvement. */
  function releve(c, nbMois) {
    nbMois = nbMois || 12;
    var cle = cleCache(c) + "|" + nbMois;
    if (cache[cle]) return cache[cle];
    var auj = B.aujourdhui();
    var premier = B.dateDuMois(B.indexMois(auj) - nbMois, 1);
    var open = ouverture(c);
    var kd = cycleDe(c, premier), kf = cycleDe(c, auj);
    var lignes = [], bal = null, soldeDebut = null, cycles = [];
    for (var k = kd; k <= kf; k++) {
      var cy = cycle(c, k);
      cycles.push(cy);
      if (cy.vide) continue;
      /* solde avant le premier mouvement connu : il sert d'ancien solde au premier mois si aucun mouvement ne précède la période */
      if (bal === null) { bal = cy.B0; soldeDebut = bal; }
      cy.lignes.forEach(function (l) {
        if (l.date > auj) return;
        bal = r2(bal + l.m);
        var x = { date: l.date, ymd: B.ymd(l.date), kind: l.kind, cat: null, lib: l.lib, m: l.m, solde: bal, evenement: !!l.evenement };
        x.cat = categorie(x);
        if (l.date >= premier) lignes.push(x);
        else soldeDebut = bal;
      });
    }
    var extra = lignesOperations(c).filter(function (x) { return x.date >= premier; });
    if (extra.length) {
      var tous = triDate(lignes.concat(extra.map(function (x) { var y = { date: x.date, ymd: x.ymd, kind: x.kind, cat: null, lib: x.lib, m: x.m, solde: 0, evenement: false, operation: x.operation }; y.cat = categorie(y); return y; })));
      /* les lignes du relevé gardent leur solde (décalé de ce qui s'est ajouté avant elles) ; une opération de service prend le solde précédent plus son montant */
      var cum = 0, dernier = lignes.length ? r2(lignes[0].solde - lignes[0].m) : (soldeDebut == null ? 0 : soldeDebut);
      tous.forEach(function (x) {
        if (x.operation) { cum = r2(cum + x.m); dernier = r2(dernier + x.m); x.solde = dernier; }
        else { x.solde = r2(x.solde + cum); dernier = x.solde; }
      });
      lignes = tous; bal = r2((bal === null ? 0 : bal) + cum);
    }
    var res = { lignes: lignes, debut: premier, ouvertureCompte: open, soldeDebut: soldeDebut == null ? 0 : soldeDebut, solde: bal === null ? 0 : bal, cycles: cycles, premierCycle: kd, dernierCycle: kf };
    cache[cle] = res;
    return res;
  }
  /* Solde actuel et solde moyen sur les derniers jours (calcul léger, sur les 3 ou 4 derniers cycles). */
  function resume(c, nbJours) {
    nbJours = nbJours || 90;
    var cle = "r" + cleCache(c) + "|" + nbJours;
    if (cache[cle]) return cache[cle];
    var auj = B.aujourdhui(), depuis = B.plusJours(auj, -nbJours + 1);
    var kd = cycleDe(c, depuis), kf = cycleDe(c, auj);
    var bal = null, somme = 0, nb = 0, cur = null, min = Infinity, max = -Infinity, lignes = [];
    for (var k = kd; k <= kf; k++) {
      var cy = cycle(c, k);
      if (cy.vide) continue;
      if (bal === null) bal = cy.B0;
      lignes = lignes.concat(cy.lignes);
    }
    var ex2 = lignesOperations(c).filter(function (x) { return x.date >= depuis; });
    if (ex2.length) lignes = triDate(lignes.concat(ex2));
    var idx = 0;
    for (var d = depuis; d <= auj; d = B.plusJours(d, 1)) {
      /* appliquer les mouvements jusqu'à la fin de la journée d */
      while (idx < lignes.length && lignes[idx].date <= d) { if (bal !== null) bal = r2(bal + lignes[idx].m); idx++; }
      if (bal === null) continue;
      somme += bal; nb++; if (bal < min) min = bal; if (bal > max) max = bal;
    }
    var res = { solde: bal === null ? 0 : r2(bal), moyen: nb ? r2(somme / nb) : 0, min: min === Infinity ? 0 : min, max: max === -Infinity ? 0 : max, jours: nb };
    cache[cle] = res;
    return res;
  }
  function viderCache() { cache = {}; cacheProfil = {}; }

  var api = { releve: releve, resume: resume, cycle: cycle, ancre: ancre, debutCycle: debutCycle, finCycle: finCycle, cycleDe: cycleDe, categorie: categorie, viderCache: viderCache, h32: h32 };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.mouvements = api; }
})(typeof window !== "undefined" ? window : null);
