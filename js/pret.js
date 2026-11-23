/* GS Banque & Assurance – simulateur de prêt : une calculatrice financière à trois touches.
   Les trois grandeurs : mensualité, capital à emprunter, durée. On en cherche une (l'inconnue) à partir des deux autres, avec un taux nominal annuel fixe.
   Prêt à mensualités constantes (seul mode de remboursement du catalogue) :
   - le taux mensuel est proportionnel au taux annuel : i = taux ÷ 12 ;
   - mensualité M = C × i ÷ [1 − (1 + i)^(−n)] (C capital emprunté, n nombre de mensualités) ;
   - chaque mois, les intérêts valent le capital restant dû × i, arrondis au centime ; le capital remboursé est la mensualité moins les intérêts.
   Conventions de calcul (voir le fichier README) : calcul hors assurance emprunteur et hors frais (intérêts seulement) ; mensualité arrondie au centime (à la moitié
   supérieure), la dernière mensualité solde le prêt ; capital à emprunter = M × [1 − (1 + i)^(−n)] ÷ i, arrondi au centime inférieur ; durée =
   nombre de mensualités nécessaires (la dernière, plus petite, solde le prêt) ; durée de 1 mois à 30 ans. Les calculs en centimes utilisent des entiers exacts (BigInt). */
(function (root) {
  "use strict";

  var B = root && root.SGBF ? root.SGBF.banque : require("./banque.js");
  var PR = root && root.SGBF ? root.SGBF.produits : require("./produits.js");
  var EL = root && root.SGBF ? root.SGBF.eligibilite : require("./eligibilite.js");

  var INCONNUES = { mensualite: "Mensualité", capital: "Capital à emprunter", duree: "Durée" };
  var ORDRE_INCONNUES = ["mensualite", "capital", "duree"];
  var PRODUITS_PRET = ["CIMMO", "CCONSO", "CAUTO", "CTRAV"];
  /* Bornes de saisie (conventions de l'outil). */
  var LIM = { capitalMin: 100, capitalMax: 5e6, mensualiteMin: 1, mensualiteMax: 1e5, dureeMax: 360, tauxMax: 20, decimalesTaux: 3 };
  /* Mention d'avertissement : texte en vigueur jusqu'au 19 novembre 2026, puis texte du crédit à la consommation à partir du 20 novembre 2026. */
  var MENTION = {
    avant: "Un crédit vous engage et doit être remboursé. Vérifiez vos capacités de remboursement avant de vous engager.",
    apres: "Attention ! Un crédit coûte de l'argent et doit être remboursé !",
    changement: [2026, 10, 20]
  };

  /* ---------- outils ---------- */
  function cents(x) { return Math.round(x * 100); }
  function deuxDecimales(x, d) { var f = Math.pow(10, d || 2); return Math.abs(x * f - Math.round(x * f)) < 1e-6; }
  function nf(x, d) { return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(x).replace("-", "−"); }
  function pct(x) { return nf(x, 2) + " %"; }
  /* Taux nominal : deux décimales, trois si besoin. */
  function pctTaux(x) { return nf(x, Math.abs(x * 100 - Math.round(x * 100)) < 1e-9 ? 2 : 3) + " %"; }
  function eur(x) { return B.eur2(x); }
  function pl(n, s, p) { return B.nb(n) + " " + (n > 1 ? p : s); }
  function nombreFr(t) { return parseFloat(String(t).replace(/\s/g, "").replace(",", ".")); }
  /* Lecture d'un nombre saisi à la française : « 1 234,56 » ou « 1234.56 ». Renvoie NaN si le texte n'est pas un nombre positif ou nul. */
  function lireNombre(t) {
    if (typeof t === "number") return isFinite(t) ? t : NaN;
    var s = String(t == null ? "" : t).replace(/\s/g, "").replace(",", ".");
    return /^\d+(\.\d+)?$/.test(s) ? parseFloat(s) : NaN;
  }
  function libDuree(mois) {
    var a = Math.floor(mois / 12), m = mois % 12, t = [];
    if (a) t.push(a + (a > 1 ? " ans" : " an"));
    if (m || !a) t.push(m + " mois");
    return t.join(" et ");
  }
  /* Taux annuel effectif équivalent à un taux nominal (mensualités, sans assurance ni frais) et, à l'inverse, taux nominal d'un TAEG sans assurance ni frais.
     Le TAEG est un taux actuariel calculé en mois normalisés d'un douzième d'année (article R314-3 du Code de la consommation). */
  function tauxEffectif(nominal) { return (Math.pow(1 + nominal / 1200, 12) - 1) * 100; }
  function nominalDepuisTaeg(taeg) { return 1200 * (Math.pow(1 + taeg / 100, 1 / 12) - 1); }

  /* ---------- produits du catalogue utilisables dans le simulateur ---------- */
  var cache = {};
  function norm(t) { return String(t == null ? "" : t).replace(/[\u00a0\u202f]/g, " "); }
  function produitPret(id) {
    var p = PR.parId[id];
    if (!p || PRODUITS_PRET.indexOf(id) < 0) return null;
    if (cache[id]) return cache[id];
    var o = { id: id, nom: p.nom, code: p.code, regle: p.reglementaire, nature: "nominal", grille: [], taeg: null, capitalMin: null, capitalMax: null, dureeMin: 1, dureeMax: LIM.dureeMax, fraisDossier: 0, usure: null }, m;
    var frais = norm((p.tarifs.filter(function (t) { return /^Frais de dossier/.test(t.lib); })[0] || {}).val);
    m = /(\d[\d\s]*)\s*€/.exec(frais); if (m) o.fraisDossier = parseInt(m[1].replace(/\s/g, ""), 10);
    if (id === "CIMMO") {
      var tx = norm((p.tarifs.filter(function (t) { return /^Taux fixe/.test(t.lib); })[0] || {}).val), re = /(\d+) ans\s*:\s*(\d+(?:,\d+)?)\s*%/g;
      while ((m = re.exec(tx))) o.grille.push({ mois: parseInt(m[1], 10) * 12, lib: "palier de " + m[1] + " ans", taux: nombreFr(m[2]) });
      m = /À partir de (\d[\d\s]*)\s*€/.exec(norm(p.cmp.ticket)); if (m) o.capitalMin = parseInt(m[1].replace(/\s/g, ""), 10);
      m = /Durée (\d+) ans/.exec(norm(p.cmp.plafond)); if (m) o.dureeMax = parseInt(m[1], 10) * 12;
      var u = norm(p.reglementaire.join(" "));
      m = /au (\d+e trimestre \d{4}), pour un prêt à taux fixe, moins de 10 ans (\d+,\d+)\s*%, de 10 à moins de 20 ans (\d+,\d+)\s*%, 20 ans et plus (\d+,\d+)\s*%/.exec(u);
      if (m) o.usure = { trimestre: m[1], paliers: [{ moisMax: 120, lib: "moins de 10 ans", taux: nombreFr(m[2]) }, { moisMax: 240, lib: "10 ans à moins de 20 ans", taux: nombreFr(m[3]) }, { moisMax: Infinity, lib: "20 ans et plus", taux: nombreFr(m[4]) }] };
    } else {
      o.nature = "taeg";
      m = /TAEG à partir de (\d+(?:,\d+)?)\s*%/.exec(norm(p.cmp.cout)); if (m) o.taeg = nombreFr(m[1]);
      m = /Montant de (\d[\d\s]*)\s*€ à (\d[\d\s]*)\s*€ ; durée de (\d+) à (\d+) mois/.exec(norm(p.eligibilite.join(" ")));
      if (m) { o.capitalMin = parseInt(m[1].replace(/\s/g, ""), 10); o.capitalMax = parseInt(m[2].replace(/\s/g, ""), 10); o.dureeMin = parseInt(m[3], 10); o.dureeMax = parseInt(m[4], 10); }
      o.grille = [{ mois: null, lib: "TAEG à partir de " + pct(o.taeg), taux: Math.round(nominalDepuisTaeg(o.taeg) * 1000) / 1000 }];
    }
    cache[id] = o;
    return o;
  }
  function produitsPret() { return PRODUITS_PRET.map(produitPret); }
  /* Taux nominal du catalogue pour une durée donnée : { taux, lib } ou null si la durée dépasse la grille. Sans durée, le palier du milieu (20 ans). */
  function tauxCatalogue(id, dureeMois) {
    var p = produitPret(id);
    if (!p) return null;
    if (p.nature === "taeg") return { taux: p.grille[0].taux, lib: p.grille[0].lib, taeg: p.taeg };
    var g = p.grille, i;
    if (!(dureeMois > 0)) return g[Math.floor(g.length / 2)];
    for (i = 0; i < g.length; i++) if (dureeMois <= g[i].mois) return g[i];
    return null;
  }
  function usurePour(p, dureeMois) {
    if (!p.usure) return null;
    return p.usure.paliers.filter(function (x) { return dureeMois < x.moisMax; })[0];
  }
  /* Mention d'avertissement : le texte change le 20 novembre 2026 pour la publicité sur le crédit à la consommation (ordonnance n° 2025-880 du 3 septembre 2025 ; service-public.fr).
     Pour le prêt immobilier, aucune source consultée n'indique ce changement : on garde la mention de sa fiche du catalogue, quelle que soit la date. Sans crédit choisi (taux libre), la règle du crédit à la consommation. */
  function mentionCredit(date, id) {
    if (id === "CIMMO") return MENTION.avant;
    var d = date || B.aujourdhui(), lim = new Date(MENTION.changement[0], MENTION.changement[1], MENTION.changement[2]);
    return d >= lim ? MENTION.apres : MENTION.avant;
  }

  /* ---------- contrôle de la saisie ---------- */
  function erreur(champ, texte) { return { ok: false, champ: champ, erreur: texte }; }
  var MSG = {
    capital: "Le capital à emprunter doit être un montant d'au moins " + LIM.capitalMin + " €, avec deux décimales au plus (exemple : 200 000 ou 15 000,50).",
    mensualite: "La mensualité doit être un montant d'au moins " + LIM.mensualiteMin + " €, avec deux décimales au plus (exemple : 1 200 ou 236,90).",
    duree: "La durée doit être un nombre entier de mois compris entre 1 mois et 30 ans (360 mois).",
    taux: "Le taux nominal annuel doit être compris entre 0 % et " + LIM.tauxMax + " %, avec trois décimales au plus (exemple : 3,6)."
  };
  /* Renvoie { ok: true, e } avec les valeurs normalisées, ou { ok: false, champ, erreur }. */
  function controler(s) {
    s = s || {};
    var e = { inconnue: s.inconnue, produit: s.produit || null, capital: null, mensualite: null, dureeMois: null, taux: null };
    if (ORDRE_INCONNUES.indexOf(e.inconnue) < 0) return erreur("inconnue", "Choisissez ce que vous voulez calculer.");
    if (e.produit && !produitPret(e.produit)) return erreur("produit", "Ce produit n'est pas disponible dans le simulateur.");
    var inc = e.inconnue, x;
    if (inc !== "capital") {
      x = lireNombre(s.capital);
      if (!(x >= LIM.capitalMin) || !deuxDecimales(x)) return erreur("capital", MSG.capital);
      if (x > LIM.capitalMax) return erreur("capital", "Le capital à emprunter ne peut pas dépasser 5 millions d'euros.");
      e.capital = x;
    }
    if (inc !== "mensualite") {
      x = lireNombre(s.mensualite);
      if (!(x >= LIM.mensualiteMin) || !deuxDecimales(x)) return erreur("mensualite", MSG.mensualite);
      if (x > LIM.mensualiteMax) return erreur("mensualite", "La mensualité ne peut pas dépasser 100 000 €.");
      e.mensualite = x;
    }
    if (inc !== "duree") {
      x = lireNombre(s.dureeMois);
      if (!(x >= 1) || x > LIM.dureeMax || x !== Math.floor(x)) return erreur("duree", MSG.duree);
      e.dureeMois = x;
    }
    x = lireNombre(s.taux);
    if (!(x >= 0) || x > LIM.tauxMax || !deuxDecimales(x, LIM.decimalesTaux)) return erreur("taux", MSG.taux);
    e.taux = x;
    return { ok: true, e: e };
  }

  /* ---------- calculs exacts en centimes ---------- */
  /* Intérêts d'un mois sur un capital restant dû (en centimes), taux en millièmes de point (3,6 % = 3 600), arrondis à la moitié supérieure. */
  function interet(crd, tm) { return Math.floor((crd * tm + 600000) / 1200000); }
  /* Puissances exactes du taux : i = p ÷ q avec q = 1 200 000 (taux en millièmes de point, divisé par 12 et par 100). a = (q + p)^n, b = q^n, donc (1 + i)^n = a ÷ b. */
  function puissances(tm, n) { var p = BigInt(tm), q = 1200000n; return { p: p, q: q, a: (q + p) ** BigInt(n), b: q ** BigInt(n) }; }
  /* Fonction « capital (centimes) → mensualité (centimes) » : C × i ÷ [1 − (1 + i)^(−n)] = C × p × a ÷ [q × (a − b)], arrondie à la moitié supérieure. */
  function fabriquePaiement(tm, n) {
    if (tm === 0) { var N = BigInt(n); return function (Cc) { return Number((2n * BigInt(Cc) + N) / (2n * N)); }; }
    var w = puissances(tm, n), den = w.q * (w.a - w.b), k = w.p * w.a;
    return function (Cc) { var num = BigInt(Cc) * k; return Number((2n * num + den) / (2n * den)); };
  }
  /* Tableau d'amortissement : mensualité M (centimes) pour les n − 1 premiers mois, la dernière solde le prêt. Renvoie null si un mois ne rembourse aucun capital
     ou si le prêt serait soldé avant la dernière échéance (capital trop faible pour la durée). */
  function echeancier(Cc, tm, n, M) {
    var crd = Cc, L = [], k, it, pay, cap;
    for (k = 1; k <= n; k++) {
      it = interet(crd, tm);
      pay = k < n ? M : crd + it;
      if (k < n && crd + it <= M) return null;
      cap = pay - it;
      if (cap <= 0) return null;
      crd -= cap;
      L.push({ k: k, pay: pay, int: it, cap: cap, crd: crd });
    }
    return L;
  }
  /* Capital (centimes) correspondant à une mensualité Mc : M × [1 − (1 + i)^(−n)] ÷ i = M × q × (a − b) ÷ (p × a), arrondi au centime inférieur. Renvoie un nombre (peut être très grand). */
  function capitalPour(Mc, tm, n) {
    if (tm === 0) return Mc * n;
    var w = puissances(tm, n);
    return Number((BigInt(Mc) * w.q * (w.a - w.b)) / (w.p * w.a));
  }
  /* Nombre de mensualités de Mc nécessaires pour rembourser Cc (la dernière, plus petite ou égale, solde le prêt). -1 si Mc ne couvre pas les intérêts, 0 si plus de 30 ans. */
  function dureeNecessaire(Cc, tm, Mc) {
    var crd = Cc, k, it;
    for (k = 1; k <= LIM.dureeMax; k++) {
      it = interet(crd, tm);
      if (crd + it <= Mc) return k;
      if (Mc - it <= 0) return -1;
      crd = crd + it - Mc;
    }
    return 0;
  }
  /* Mensualité (euros) d'un capital (euros), pour un taux nominal annuel (%) et une durée en mois. */
  function paiement(capital, taux, n) { return fabriquePaiement(Math.round(taux * 1000), n)(cents(capital)) / 100; }

  /* ---------- calcul ---------- */
  function exactes(e, inc) {
    var i = e.taux / 1200, n = e.dureeMois;
    var facteur = i === 0 ? n : (1 - Math.pow(1 + i, -n)) / i;
    if (inc === "mensualite") return { i: i, valeur: i === 0 ? e.capital / n : e.capital / facteur };
    if (inc === "capital") return { i: i, valeur: e.mensualite * facteur };
    var t = e.capital * i / e.mensualite;
    return { i: i, valeur: i === 0 ? e.capital / e.mensualite : (t < 1 ? -Math.log(1 - t) / Math.log(1 + i) : null) };
  }
  function calculer(saisie) {
    var r = controler(saisie);
    if (!r.ok) return r;
    var e = r.e, inc = e.inconnue, tm = Math.round(e.taux * 1000), Cc, Mc, n, L, res = { ok: true, inconnue: inc };
    if (inc === "mensualite") {
      Cc = cents(e.capital); n = e.dureeMois; Mc = fabriquePaiement(tm, n)(Cc);
    } else if (inc === "capital") {
      n = e.dureeMois; Mc = cents(e.mensualite); Cc = capitalPour(Mc, tm, n);
      if (Cc >= LIM.capitalMax * 100) return erreur("mensualite", "Avec cette mensualité, ce taux et cette durée, le capital dépasserait 5 millions d'euros : diminuez la mensualité ou la durée.");
      if (Cc < LIM.capitalMin * 100) return erreur("mensualite", "Avec cette mensualité, ce taux et cette durée, le capital à emprunter serait inférieur à " + LIM.capitalMin + " € : augmentez la mensualité ou la durée.");
    } else {
      Cc = cents(e.capital); Mc = cents(e.mensualite); n = dureeNecessaire(Cc, tm, Mc);
      if (n < 0) return erreur("mensualite", "Cette mensualité (" + eur(Mc / 100) + ") ne couvre pas les intérêts du premier mois (" + eur(interet(Cc, tm) / 100) + ") : le capital ne diminuerait jamais. Augmentez la mensualité ou diminuez le capital.");
      if (n === 0) return erreur("mensualite", "Il faudrait plus de 30 ans pour rembourser ce capital avec cette mensualité : augmentez la mensualité ou diminuez le capital.");
    }
    L = echeancier(Cc, tm, n, Mc);
    if (!L) return erreur(inc === "capital" ? "mensualite" : "capital", "Le capital est trop faible pour cette durée et ce taux : le premier mois ne rembourserait aucun capital au centime près.");
    e.capital = Cc / 100; e.mensualite = Mc / 100; e.dureeMois = n; res.e = e;
    res.valeur = inc === "mensualite" ? e.mensualite : inc === "capital" ? e.capital : n;
    res.mensualite = e.mensualite; res.capital = e.capital; res.dureeMois = n; res.nbEcheances = n;
    res.derniere = L[n - 1].pay / 100;
    var total = 0, i; for (i = 0; i < L.length; i++) total += L[i].pay;
    res.total = total / 100; res.interets = (total - Cc) / 100;
    res.echeances = L.map(function (l) { return { k: l.k, pay: l.pay / 100, int: l.int / 100, cap: l.cap / 100, crd: l.crd / 100 }; });
    res.lignes = [];
    var y, seg, sp, si, sc;
    for (y = 0; y * 12 < n; y++) {
      seg = L.slice(y * 12, y * 12 + 12); sp = 0; si = 0; sc = 0;
      seg.forEach(function (l) { sp += l.pay; si += l.int; sc += l.cap; });
      res.lignes.push({ an: y + 1, lib: "Année " + (y + 1) + (seg.length < 12 ? " (" + seg.length + " mois)" : ""), mois: seg.length, pay: sp / 100, int: si / 100, cap: sc / 100, crd: seg[seg.length - 1].crd / 100 });
    }
    res.tauxEffectif = tauxEffectif(e.taux);
    res.p = produitPret(e.produit);
    res.exact = exactes(e, inc);
    res.detail = detail(res, L, Cc, Mc);
    res.alertes = alertes(res);
    return res;
  }

  /* ---------- calcul détaillé (texte) ---------- */
  function detail(res, L, Cc, Mc) {
    var e = res.e, inc = res.inconnue, n = e.dureeMois, ex = res.exact, i = ex.i, T = [];
    T.push("Données : capital emprunté " + eur(e.capital) + ", mensualité " + eur(e.mensualite) + ", durée " + libDuree(n) + " (" + pl(n, "mensualité", "mensualités") + "), taux nominal annuel " + pctTaux(e.taux) + ".");
    T.push("Méthode : prêt à taux fixe remboursé par mensualités constantes. Le taux mensuel est proportionnel au taux annuel : i = " + pctTaux(e.taux) + " ÷ 12 = " + nf(i * 100, 4) + " % par mois (taux annuel effectif équivalent, sans assurance ni frais : " + pct(res.tauxEffectif) + ").");
    if (inc === "mensualite") {
      T.push(i === 0 ? "Taux nul : M = C ÷ n = " + eur(e.capital) + " ÷ " + n + " = " + nf(ex.valeur, 4) + " €, arrondie au centime : " + eur(e.mensualite) + "."
        : "Mensualité : M = C × i ÷ [1 − (1 + i)^(−n)] = " + eur(e.capital) + " × " + nf(i, 6) + " ÷ [1 − (1 + " + nf(i, 6) + ")^(−" + n + ")] = " + nf(ex.valeur, 4) + " €, arrondie au centime : " + eur(e.mensualite) + ".");
    } else if (inc === "capital") {
      T.push(i === 0 ? "Taux nul : C = M × n = " + eur(e.mensualite) + " × " + n + " = " + nf(ex.valeur, 4) + " €, arrondi au centime inférieur : " + eur(e.capital) + "."
        : "Formule inversée : C = M × [1 − (1 + i)^(−n)] ÷ i = " + eur(e.mensualite) + " × [1 − (1 + " + nf(i, 6) + ")^(−" + n + ")] ÷ " + nf(i, 6) + " = " + nf(ex.valeur, 4) + " €, arrondi au centime inférieur : " + eur(e.capital) + ".");
      var f = fabriquePaiement(Math.round(e.taux * 1000), n);
      T.push("Vérification : avec un capital de " + eur(e.capital) + ", la formule de la mensualité donne " + eur(f(Cc) / 100) + " (mensualité demandée : " + eur(e.mensualite) + ").");
    } else {
      var calcul = ex.valeur, sup = calcul === null ? null : Math.ceil(calcul - 1e-9);
      T.push((i === 0 ? "Taux nul : n = C ÷ M = " + eur(e.capital) + " ÷ " + eur(e.mensualite) + " = " + nf(calcul, 2) + " mois" : "Formule inversée : n = −ln(1 − C × i ÷ M) ÷ ln(1 + i) = −ln(1 − " + eur(e.capital) + " × " + nf(i, 6) + " ÷ " + eur(e.mensualite) + ") ÷ ln(1 + " + nf(i, 6) + ") = " + nf(calcul, 2) + " mois") +
        (sup === n ? ", arrondi au mois supérieur : " + pl(n, "mensualité", "mensualités") + " (la dernière est plus petite que les autres, sauf si le résultat tombe juste)." : ". Le calcul mois par mois, avec des intérêts arrondis au centime, donne " + pl(n, "mensualité", "mensualités") + "."));
      if (n > 1) T.push("Vérification : après " + pl(n - 1, "mensualité", "mensualités") + " de " + eur(e.mensualite) + ", le capital restant dû est de " + eur(L[n - 2].crd / 100) + " ; avec les intérêts du mois (" + eur(L[n - 1].int / 100) + "), la dernière mensualité est de " + eur(res.derniere) + ", au plus " + eur(e.mensualite) + ".");
    }
    T.push("Chaque mois : intérêts = capital restant dû × i, arrondis au centime ; capital remboursé = mensualité − intérêts ; le capital restant dû diminue d'autant." + (n > 1 && Math.abs(res.derniere - e.mensualite) > 1e-9 ? " La dernière mensualité solde le prêt : " + eur(res.derniere) + " au lieu de " + eur(e.mensualite) + "." : (n > 1 ? " Toutes les mensualités sont identiques." : "")));
    T.push("Coût du crédit (intérêts seulement) = total remboursé − capital emprunté = " + eur(res.total) + " − " + eur(e.capital) + " = " + eur(res.interets) + ".");
    return T;
  }

  /* ---------- points d'attention ---------- */
  function alertes(res) {
    var e = res.e, p = res.p, a = [], n = e.dureeMois;
    function add(niveau, t) { a.push({ n: niveau, t: t }); }
    if (p) {
      if (p.capitalMin && e.capital < p.capitalMin) add("attention", "Le capital emprunté (" + eur(e.capital) + ") est inférieur au minimum du " + p.code + " (" + eur(p.capitalMin) + ").");
      if (p.capitalMax && e.capital > p.capitalMax) add("attention", "Le capital emprunté (" + eur(e.capital) + ") dépasse le maximum du " + p.code + " (" + eur(p.capitalMax) + ").");
      if (n < p.dureeMin) add("attention", "La durée (" + libDuree(n) + ") est inférieure à la durée minimale du " + p.code + " (" + libDuree(p.dureeMin) + ").");
      if (n > p.dureeMax) add("attention", "La durée (" + libDuree(n) + ") dépasse la durée maximale du " + p.code + " (" + libDuree(p.dureeMax) + ")" + (p.id === "CIMMO" ? " ; le catalogue cite 27 ans avec un différé d'amortissement, que le simulateur ne traite pas" : "") + ".");
      var tc = tauxCatalogue(p.id, n);
      if (p.nature === "taeg") {
        add("info", "Le catalogue indique un TAEG « à partir de » " + pct(p.taeg) + " : c'est le taux le plus bas ; le taux proposé à un client dépend de son profil. Sans assurance ni frais, ce TAEG correspond à un taux nominal de " + pctTaux(tc.taux) + ".");
        if (e.taux < tc.taux - 5e-4) add("attention", "Le taux saisi (" + pctTaux(e.taux) + ") est inférieur au taux le plus bas du catalogue (" + pctTaux(tc.taux) + ") : la banque ne le propose pas.");
        else if (e.taux > tc.taux + 5e-4) add("info", "Le taux saisi (" + pctTaux(e.taux) + ") est supérieur au taux le plus bas du catalogue (" + pctTaux(tc.taux) + ").");
      } else {
        if (n < p.grille[0].mois) add("info", "Le catalogue ne donne pas de taux pour une durée inférieure à " + libDuree(p.grille[0].mois) + " : le " + p.grille[0].lib + " (" + pctTaux(p.grille[0].taux) + ") sert de repère.");
        if (tc && Math.abs(e.taux - tc.taux) > 5e-4) add("info", "Le taux saisi (" + pctTaux(e.taux) + ") n'est pas celui du catalogue pour cette durée (" + tc.lib + " : " + pctTaux(tc.taux) + ").");
      }
      if (p.usure) {
        var us = usurePour(p, n);
        if (res.tauxEffectif > us.taux) add("attention", "Le taux annuel effectif (" + pct(res.tauxEffectif) + "), sans assurance ni frais, dépasse déjà le taux d'usure du " + p.usure.trimestre + " pour un prêt immobilier à taux fixe de " + us.lib + " (" + pct(us.taux) + ") : l'offre serait refusée.");
        else add("info", "Le taux d'usure du " + p.usure.trimestre + " pour un prêt immobilier à taux fixe de " + us.lib + " est de " + pct(us.taux) + " (TAEG, assurance et frais compris). Ici, sans assurance ni frais, le taux annuel effectif est de " + pct(res.tauxEffectif) + " : le TAEG réel est plus élevé et doit rester au-dessous du seuil.");
      }
      if (p.id === "CIMMO") add("info", "Le calcul ne comprend ni l'assurance emprunteur, exigée en pratique, ni les frais de dossier (" + eur(p.fraisDossier) + "), ni les frais de garantie : la mensualité et le coût réels sont plus élevés.");
      else add("info", "Le calcul ne comprend pas l'assurance, facultative pour ce crédit : si le client la souscrit, la mensualité est plus élevée.");
    } else {
      add("info", "Le calcul ne comprend ni assurance ni frais : la mensualité et le coût réels d'un crédit sont plus élevés.");
    }
    if (n > 1 && Math.abs(res.derniere - e.mensualite) > 1e-9) add("info", "La dernière mensualité (" + eur(res.derniere) + ") est différente des autres (" + eur(e.mensualite) + ") : elle solde le prêt, les mensualités et les intérêts étant arrondis au centime.");
    return a;
  }

  /* ---------- endettement d'un client ---------- */
  /* Charge mensuelle des crédits en cours (crédits d'autres banques compris, assurance emprunteur comprise) et revenus du foyer : mêmes calculs que l'éligibilité du
     catalogue et que l'onglet Crédits de la fiche client. L'assurance du nouveau prêt n'est pas connue : la mensualité simulée est hors assurance. */
  function endettement(c, mensualite) {
    var foyer = c.pro.foyer || 0, avant = EL.mensualites(c), apres = avant + mensualite, seuil = EL.HCSF_TAUX;
    return { foyer: foyer, avant: avant, apres: apres, mensualite: mensualite, tauxAvant: foyer ? 100 * avant / foyer : null, tauxApres: foyer ? 100 * apres / foyer : null, seuil: seuil, marge: EL.margeMensuelle(c), depasse: foyer ? apres > seuil / 100 * foyer : null };
  }
  function alertesClient(res, c) {
    var d = endettement(c, res.mensualite), p = res.p, a = [];
    if (!d.foyer) return [{ n: "info", t: "Les revenus du foyer de ce client ne sont pas renseignés : le taux d'endettement ne peut pas être calculé." }];
    var base = "Avec ce prêt, le taux d'endettement du client passerait de " + pct(d.tauxAvant) + " à " + pct(d.tauxApres) + " des revenus du foyer (" + eur(d.foyer) + " par mois ; mensualités de crédit, assurance des crédits en cours comprise : " + eur(d.avant) + " avant, " + eur(d.apres) + " après)";
    if (p && p.id === "CIMMO") {
      if (d.depasse) a.push({ n: "attention", t: base + ", au-dessus de la limite de " + d.seuil + " % fixée par le HCSF pour un crédit immobilier. L'assurance du nouveau prêt, non comprise ici, augmenterait encore la mensualité." });
      else a.push({ n: "info", t: base + ", sous la limite de " + d.seuil + " % fixée par le HCSF pour un crédit immobilier. L'assurance du nouveau prêt, non comprise ici, s'ajoute à la mensualité : vérifiez que la limite est toujours respectée." });
    } else {
      a.push({ n: "info", t: base + ". La limite de " + d.seuil + " % du HCSF concerne les crédits immobiliers ; pour ce crédit, la banque apprécie la capacité de remboursement du client." });
    }
    return a;
  }

  var api = {
    INCONNUES: INCONNUES, ORDRE_INCONNUES: ORDRE_INCONNUES, LIM: LIM, MENTION: MENTION, PRODUITS_PRET: PRODUITS_PRET,
    lireNombre: lireNombre, libDuree: libDuree, pct: pct, pctTaux: pctTaux, tauxEffectif: tauxEffectif, nominalDepuisTaeg: nominalDepuisTaeg,
    produitPret: produitPret, produitsPret: produitsPret, tauxCatalogue: tauxCatalogue, usurePour: usurePour, mentionCredit: mentionCredit,
    controler: controler, calculer: calculer, paiement: paiement, interet: interet, echeancier: echeancier, capitalPour: capitalPour, dureeNecessaire: dureeNecessaire,
    exactes: exactes, endettement: endettement, alertesClient: alertesClient
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.pret = api; }
})(typeof window !== "undefined" ? window : null);
