/* GS Banque & Assurance – simulateur d'épargne : une calculatrice financière à cinq touches.
   Les cinq grandeurs : capital acquis (valeur acquise), capital de départ (montant à placer), versement régulier, durée, taux.
   On en cherche une (l'inconnue) à partir des quatre autres, avec l'une des trois méthodes d'intérêts :
   - intérêts simples : les intérêts ne produisent pas d'intérêts ;
   - intérêts composés : taux annuel effectif, taux équivalent pour les périodes plus courtes que l'année ;
   - règle des quinzaines (livrets) : un dépôt porte intérêt à partir du 1er ou du 16 qui suit le jour du dépôt, un retrait cesse d'en porter à la fin de la
     quinzaine qui le précède, chaque quinzaine rapporte 1/24 de l'intérêt annuel, les intérêts de l'année s'ajoutent au capital le 31 décembre
     (art. R221-4 du Code monétaire et financier pour le Livret A ; décision de caractère général n° 69-02 du Conseil national du crédit, art. 2 B, pour les livrets bancaires).
   Conventions de calcul (voir le fichier README) : taux constant sur toute la durée ; intérêts bruts, avant impôts ; durée en mois entiers, multiple de la périodicité
   des versements ; versement à la fin ou au début de chaque période ; règle des quinzaines : versements le même jour du mois que le dépôt de départ, totalité retirée
   à la date de fin avec les intérêts acquis de l'année en cours, intérêts de l'année arrondis au centime lors de leur crédit (la règle ne fixe pas d'arrondi). */
(function (root) {
  "use strict";

  var B = root && root.SGBF ? root.SGBF.banque : require("./banque.js");
  var PR = root && root.SGBF ? root.SGBF.produits : require("./produits.js");

  var INCONNUES = { capitalAcquis: "Capital acquis", capitalDepart: "Capital de départ", versement: "Versement régulier", duree: "Durée", taux: "Taux" };
  var ORDRE_INCONNUES = ["capitalAcquis", "capitalDepart", "versement", "duree", "taux"];
  var METHODES = { simple: "Intérêts simples", compose: "Intérêts composés", quinzaines: "Règle des quinzaines" };
  var ORDRE_METHODES = ["simple", "compose", "quinzaines"];
  var PERIODES = {
    mensuelle: { lib: "Chaque mois", mois: 1, adj: "mensuel", nom: "mois", noms: "mois" },
    trimestrielle: { lib: "Chaque trimestre", mois: 3, adj: "trimestriel", nom: "trimestre", noms: "trimestres" },
    annuelle: { lib: "Chaque année", mois: 12, adj: "annuel", nom: "année", noms: "années" }
  };
  var ORDRE_PERIODES = ["mensuelle", "trimestrielle", "annuelle"];
  var MOMENTS = { fin: "À la fin de chaque période", debut: "Au début de chaque période" };
  /* Bornes de saisie (conventions de l'outil) et seuil d'alerte sur le taux. */
  var LIM = { capitalAcquisMax: 1e9, capitalDepartMax: 1e7, versementMax: 1e6, dureeMax: 600, tauxMax: 30, tauxAlerte: 6, anneeMin: 2000, anneeMax: 2100 };
  /* Prélèvement forfaitaire unique 2026 sur les intérêts imposables : 12,8 % d'impôt + 18,6 % de prélèvements sociaux. */
  var PFU = 31.4;
  var PRODUITS_EPARGNE = ["LA", "LDDS", "LEP", "LJ", "LBR", "CAT"];

  /* ---------- outils ---------- */
  function cents(x) { return Math.round(x * 100); }
  function deuxDecimales(x, d) { var f = Math.pow(10, d || 2); return Math.abs(x * f - Math.round(x * f)) < 1e-6; }
  function nf(x, d) { return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(x).replace("-", "−"); }
  function pct(x) { return nf(x, 2) + " %"; }
  function eur(x) { return B.eur2(x); }
  function pl(n, s, p) { return B.nb(n) + " " + (n > 1 ? p : s); }
  function atteint(cap, cible) { return cents(cap) >= cents(cible); }
  function avec(e, ch) { var r = {}, k; for (k in e) r[k] = e[k]; for (k in ch) r[k] = ch[k]; return r; }
  /* Lecture d'un nombre saisi à la française : « 1 234,56 » ou « 1234.56 ». Renvoie NaN si le texte n'est pas un nombre positif ou nul. */
  function lireNombre(t) {
    if (typeof t === "number") return isFinite(t) ? t : NaN;
    var s = String(t == null ? "" : t).replace(/[\s  ]/g, "").replace(",", ".");
    return /^\d+(\.\d+)?$/.test(s) ? parseFloat(s) : NaN;
  }
  function libDuree(mois) {
    var a = Math.floor(mois / 12), m = mois % 12, t = [];
    if (a) t.push(a + (a > 1 ? " ans" : " an"));
    if (m || !a) t.push(m + " mois");
    return t.join(" et ");
  }
  /* Date de départ : texte AAAA-MM-JJ ou objet Date → { y, m (0 à 11), j }, ou null. */
  function lireDate(t) {
    var d = t instanceof Date ? t : B.lireYmd(t);
    return d ? { y: d.getFullYear(), m: d.getMonth(), j: d.getDate() } : null;
  }

  /* ---------- produits du catalogue utilisables dans le simulateur ---------- */
  function produitEpargne(id) {
    var p = PR.parId[id];
    if (!p || PRODUITS_EPARGNE.indexOf(id) < 0) return null;
    var t = /(\d[\d\s  ]*)\s*€/.exec(p.cmp.ticket);
    /* Le taux n'est jamais repris du catalogue : le simulateur n'a qu'un taux libre (évolutif = taux à lire dans la newsletter). */
    return {
      id: id, nom: p.nom, code: p.code, evolutif: PR.tauxEvolutif.indexOf(id) >= 0,
      plafond: PR.plafond[id] || null, minimum: t ? parseInt(t[1].replace(/\D/g, ""), 10) : 0,
      exonere: /^Exon/.test(p.cmp.fisc), regle: p.reglementaire,
      /* Compte à terme : taux fixe de la grille de la banque selon la durée ; intérêts simples, versés à l'échéance (chaque année dès 24 mois) et jamais capitalisés. */
      cat: id === "CAT", grille: id === "CAT" ? PR.catTaux : null
    };
  }
  function produitsEpargne() { return PRODUITS_EPARGNE.map(produitEpargne); }

  /* ---------- contrôle de la saisie ---------- */
  function erreur(champ, texte) { return { ok: false, champ: champ, erreur: texte }; }
  var MSG = {
    capitalAcquis: "Le capital à obtenir doit être un montant supérieur à 0 €, avec deux décimales au plus (exemple : 10 000 ou 10 000,50).",
    capitalDepart: "Le capital de départ doit être un montant positif ou nul, avec deux décimales au plus (0 si vous partez de rien).",
    versement: "Le versement régulier doit être un montant positif ou nul, avec deux décimales au plus (0 s'il n'y en a pas).",
    taux: "Le taux annuel doit être compris entre 0 % et " + LIM.tauxMax + " %, avec deux décimales au plus (exemple : 1,7)."
  };
  /* Renvoie { ok: true, e } avec les valeurs normalisées, ou { ok: false, champ, erreur }. */
  function controler(s) {
    s = s || {};
    var e = { inconnue: s.inconnue, methode: s.methode, periodicite: s.periodicite || "mensuelle", moment: s.moment || "fin", produit: s.produit || null,
      capitalAcquis: null, capitalDepart: null, versement: null, dureeMois: null, taux: null, dateDepart: null };
    if (ORDRE_INCONNUES.indexOf(e.inconnue) < 0) return erreur("inconnue", "Choisissez ce que vous voulez calculer.");
    if (!METHODES[e.methode]) return erreur("methode", "Choisissez une méthode de calcul des intérêts.");
    if (!PERIODES[e.periodicite]) return erreur("periodicite", "Choisissez la périodicité des versements.");
    if (!MOMENTS[e.moment]) return erreur("moment", "Choisissez le moment du versement dans la période.");
    if (e.produit && !produitEpargne(e.produit)) return erreur("produit", "Ce produit n'est pas disponible dans le simulateur.");
    var inc = e.inconnue, x;
    if (inc !== "capitalAcquis") {
      x = lireNombre(s.capitalAcquis);
      if (!(x > 0) || !deuxDecimales(x)) return erreur("capitalAcquis", MSG.capitalAcquis);
      if (x > LIM.capitalAcquisMax) return erreur("capitalAcquis", "Le capital à obtenir ne peut pas dépasser 1 milliard d'euros.");
      e.capitalAcquis = x;
    }
    if (inc !== "capitalDepart") {
      x = lireNombre(s.capitalDepart);
      if (!(x >= 0) || !deuxDecimales(x)) return erreur("capitalDepart", MSG.capitalDepart);
      if (x > LIM.capitalDepartMax) return erreur("capitalDepart", "Le capital de départ ne peut pas dépasser 10 millions d'euros.");
      e.capitalDepart = x;
    }
    if (inc !== "versement") {
      x = lireNombre(s.versement);
      if (!(x >= 0) || !deuxDecimales(x)) return erreur("versement", MSG.versement);
      if (x > LIM.versementMax) return erreur("versement", "Le versement régulier ne peut pas dépasser 1 million d'euros.");
      e.versement = x;
    }
    if (inc !== "taux") {
      x = lireNombre(s.taux);
      if (!(x >= 0) || x > LIM.tauxMax || !deuxDecimales(x)) return erreur("taux", MSG.taux);
      e.taux = x;
    }
    if (inc !== "duree") {
      x = lireNombre(s.dureeMois);
      if (!(x >= 1) || x > LIM.dureeMax || x !== Math.floor(x)) return erreur("duree", "La durée doit être un nombre entier de mois compris entre 1 mois et 50 ans (600 mois).");
      e.dureeMois = x;
    }
    if (inc === "capitalAcquis" || inc === "duree" || inc === "taux") {
      if (!(e.capitalDepart > 0) && !(e.versement > 0)) return erreur("capitalDepart", "Indiquez un capital de départ ou un versement régulier supérieur à 0 €.");
    }
    var pas = PERIODES[e.periodicite].mois;
    if (inc !== "duree" && (e.versement > 0 || inc === "versement") && e.dureeMois % pas !== 0) {
      return erreur("duree", "La durée doit être un multiple de la périodicité des versements (" + pl(pas, "mois", "mois") + " pour des versements " + PERIODES[e.periodicite].adj + "s) : " + libDuree(Math.ceil(e.dureeMois / pas) * pas) + " convient par exemple.");
    }
    if (e.methode === "quinzaines") {
      var d = lireDate(s.dateDepart);
      if (!d || d.y < LIM.anneeMin || d.y > LIM.anneeMax) return erreur("date", "Indiquez la date du dépôt de départ (jour, mois et année existants, entre 2000 et 2100).");
      e.dateDepart = B.ymd(B.D(d.y, d.m, d.j));
    }
    return { ok: true, e: e };
  }

  /* ---------- intérêts composés (formules) ---------- */
  function tauxPeriodique(i, m) { return Math.pow(1 + i, m / 12) - 1; }
  function facteurRente(ip, N) { return ip === 0 ? N : (Math.pow(1 + ip, N) - 1) / ip; }
  function nbVersements(e) { return e.versement > 0 ? e.dureeMois / PERIODES[e.periodicite].mois : 0; }
  function fvCompose(e) {
    var i = e.taux / 100, m = PERIODES[e.periodicite].mois, N = nbVersements(e), ip = tauxPeriodique(i, m);
    var rente = e.versement * facteurRente(ip, N) * (e.moment === "debut" ? 1 + ip : 1);
    return e.capitalDepart * Math.pow(1 + i, e.dureeMois / 12) + rente;
  }
  /* Intérêts simples : chaque somme rapporte taux × temps de placement, sans capitalisation. */
  function sommeDurees(e, N) { return e.moment === "debut" ? N * (N + 1) / 2 : N * (N - 1) / 2; }
  function fvSimple(e) {
    var i = e.taux / 100, m = PERIODES[e.periodicite].mois, N = nbVersements(e), k = i * m / 12;
    return e.capitalDepart * (1 + i * e.dureeMois / 12) + e.versement * (N + k * sommeDurees(e, N));
  }

  /* ---------- règle des quinzaines ----------
     Indice de quinzaine : 2 × (année × 12 + mois) + (0 du 1er au 15, 1 du 16 à la fin du mois). Tous les mouvements ont lieu le même jour du mois que le dépôt de départ.
     Un dépôt du jour d'indice h porte intérêt à partir de la quinzaine h + 1 ; un retrait du jour d'indice h cesse d'en porter à la fin de la quinzaine h − 1.
     Calcul en centimes avec des entiers exacts (BigInt) : l'intérêt d'une quinzaine est solde × taux ÷ 24 ; les intérêts de l'année, cumulés sans arrondi,
     sont arrondis au centime (à la moitié supérieure) quand ils s'ajoutent au capital, le 31 décembre ou à la date de fin. */
  function quinzaine(d) { return 2 * (d.y * 12 + d.m) + (d.j > 15 ? 1 : 0); }
  function dateQuinzaineDebut(h) { /* 1er jour de la quinzaine d'indice h */
    var k = Math.floor(h / 2), demi = h - 2 * k;
    return B.dateDuMois(k, demi ? 16 : 1);
  }
  function dateQuinzaineFin(h) { /* dernier jour de la quinzaine d'indice h */
    var k = Math.floor(h / 2), demi = h - 2 * k;
    return demi ? B.dateDuMois(k, 31) : B.dateDuMois(k, 15);
  }
  function simulerQuinzaines(e, avecLignes) {
    var d0 = lireDate(e.dateDepart), h0 = quinzaine(d0), m0 = d0.y * 12 + d0.m;
    var D = e.dureeMois, m = PERIODES[e.periodicite].mois;
    var c0 = BigInt(cents(e.capitalDepart)), pm = BigInt(cents(e.versement)), bp = BigInt(Math.round(e.taux * 100));
    var dep = [], k;
    if (c0 > 0n) dep.push({ t: 0, a: c0 });
    if (pm > 0n) {
      var N = D / m, k0 = e.moment === "debut" ? 0 : 1;
      for (k = k0; k < k0 + N; k++) dep.push({ t: k * m, a: pm });
    }
    var totalVerse = 0n;
    dep.forEach(function (x) { totalVerse += x.a; });
    var qFin = h0 + 2 * D - 1, bal = 0n, acc = 0n, cred = 0n, idx = 0, lignes = [], q, c;
    function verseAvant(limiteMois) { var s = 0n; dep.forEach(function (x) { if (m0 + x.t <= limiteMois) s += x.a; }); return s; }
    for (q = h0 + 1; q <= qFin; q++) {
      while (idx < dep.length && h0 + 2 * dep[idx].t + 1 <= q) { bal += dep[idx].a; idx++; }
      acc += bal * bp;
      if (q % 24 === 23) {
        c = (acc + 120000n) / 240000n;
        bal += c; cred += c; acc = 0n;
        if (avecLignes) {
          var an = Math.floor(q / 24), vv = verseAvant(an * 12 + 11);
          lignes.push({ lib: "Au 31/12/" + an, verses: Number(vv) / 100, interets: Number(cred) / 100, capital: Number(vv + cred) / 100 });
        }
      }
    }
    while (idx < dep.length) { bal += dep[idx].a; idx++; }
    if (acc > 0n) { c = (acc + 120000n) / 240000n; bal += c; cred += c; }
    var fin = B.dateDuMois(m0 + D, d0.j);
    if (avecLignes) {
      var der = lignes[lignes.length - 1];
      if (der && der.capital === Number(bal) / 100 && der.verses === Number(totalVerse) / 100) lignes.pop(); /* le 31 décembre et la date de fin ne font qu'une seule ligne */
      lignes.push({ lib: "Au " + B.fmtDate(fin) + " (fin)", verses: Number(totalVerse) / 100, interets: Number(cred) / 100, capital: Number(bal) / 100, fin: true });
    }
    var hFin = quinzaine({ y: fin.getFullYear(), m: fin.getMonth(), j: fin.getDate() });
    return {
      capital: Number(bal) / 100, verses: Number(totalVerse) / 100, interets: Number(cred) / 100, lignes: lignes,
      dates: { depart: B.dateDuMois(m0, d0.j), debutInterets: dateQuinzaineDebut(h0 + 1), fin: fin, finInterets: dateQuinzaineFin(hFin - 1), quinzaines: 2 * D - 1 }
    };
  }

  /* ---------- valeur acquise, quelle que soit la méthode ---------- */
  function lignesAnnuelles(e) {
    var D = e.dureeMois, t, l = [];
    function ligne(mois) {
      var r = fv(avec(e, { dureeMois: mois }));
      return { lib: "Après " + libDuree(mois), verses: r.verses, interets: r.interets, capital: r.capital, fin: mois === D };
    }
    for (t = 12; t < D; t += 12) l.push(ligne(t));
    l.push(ligne(D));
    return l;
  }
  function fv(e, avecLignes) {
    if (e.methode === "quinzaines") return simulerQuinzaines(e, avecLignes);
    var cap = e.methode === "simple" ? fvSimple(e) : fvCompose(e);
    var verses = cents(e.capitalDepart) / 100 + cents(e.versement) * nbVersements(e) / 100;
    cap = cents(cap) / 100;
    var r = { capital: cap, verses: verses, interets: cents(cap - verses) / 100 };
    if (avecLignes) r.lignes = lignesAnnuelles(e);
    return r;
  }

  /* Plus petit entier n ≥ 0 tel que ok(n) (ok croît avec n), en partant de « depart » et sans dépasser « max » ; null si ok(max) est faux. */
  function plusPetit(ok, depart, max) {
    var lo = 0, hi = Math.min(max, Math.max(1, depart || 1)), mid;
    while (!ok(hi)) { if (hi >= max) return null; lo = hi + 1; hi = Math.min(max, hi * 2); }
    while (lo < hi) { mid = Math.floor((lo + hi) / 2); if (ok(mid)) hi = mid; else lo = mid + 1; }
    return hi;
  }

  /* Valeurs exactes données par les formules (intérêts composés et simples), avant arrondi : servent au calcul détaillé et au recoupement des tests. */
  function exactes(e) {
    var i = e.taux === null ? null : e.taux / 100, m = e.versement > 0 || e.inconnue === "versement" ? PERIODES[e.periodicite].mois : 1, N = nbVersements(e), r = {};
    if (e.methode === "compose") {
      if (i === null) return r;
      var ip = tauxPeriodique(i, m), A = facteurRente(ip, N) * (e.moment === "debut" ? 1 + ip : 1), g = Math.pow(1 + i, e.dureeMois === null ? 0 : e.dureeMois / 12);
      r.ip = ip; r.A = A; r.g = g;
      if (e.inconnue === "capitalDepart") r.valeur = (e.capitalAcquis - e.versement * A) / g;
      if (e.inconnue === "versement" && A > 0) r.valeur = (e.capitalAcquis - e.capitalDepart * g) / A;
      if (e.inconnue === "duree" && e.versement > 0 && ip !== 0) {
        var k = e.moment === "debut" ? 1 + ip : 1, u = e.versement * k / ip;
        r.valeur = Math.log((e.capitalAcquis + u) / (e.capitalDepart + u)) / Math.log(1 + ip);
      } else if (e.inconnue === "duree" && e.versement > 0) r.valeur = (e.capitalAcquis - e.capitalDepart) / e.versement;
      else if (e.inconnue === "duree" && ip !== 0) r.valeur = Math.log(e.capitalAcquis / e.capitalDepart) / Math.log(1 + ip);
    } else if (e.methode === "simple") {
      if (i === null) return r;
      var kk = i * m / 12, S = N + kk * sommeDurees(e, N), f = 1 + i * (e.dureeMois === null ? 0 : e.dureeMois) / 12;
      r.S = S; r.f = f; r.kk = kk;
      if (e.inconnue === "capitalDepart") r.valeur = (e.capitalAcquis - e.versement * S) / f;
      if (e.inconnue === "versement" && S > 0) r.valeur = (e.capitalAcquis - e.capitalDepart * f) / S;
      if (e.inconnue === "duree") {
        var a = e.versement * kk / 2, b = e.capitalDepart * kk + e.versement * (1 + (e.moment === "debut" ? 1 : -1) * kk / 2), c = e.capitalDepart - e.capitalAcquis;
        if (e.versement > 0) r.valeur = a > 0 ? (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a) : -c / b; /* nombre de périodes */
        else if (kk > 0) r.valeur = ((e.capitalAcquis / e.capitalDepart - 1) / (kk)); /* périodes de m mois */
      }
    }
    return r;
  }

  /* ---------- calcul ---------- */
  function calculer(saisie) {
    var v = controler(saisie);
    if (!v.ok) return v;
    var e = v.e, inc = e.inconnue, cible = e.capitalAcquis, m = PERIODES[e.periodicite].mois, ex, r, n, bp, c;
    if (inc === "capitalDepart") {
      if (atteint(fv(avec(e, { capitalDepart: 0 })).capital, cible)) return erreur("versement", "Les versements réguliers suffisent déjà à obtenir " + eur(cible) + " : aucun capital de départ n'est nécessaire.");
      c = plusPetit(function (x) { return atteint(fv(avec(e, { capitalDepart: x / 100 })).capital, cible); }, cents(cible), cents(cible));
      e.capitalDepart = c / 100;
    } else if (inc === "versement") {
      if (atteint(fv(avec(e, { versement: 0 })).capital, cible)) return erreur("capitalDepart", "Le capital de départ suffit déjà à obtenir " + eur(cible) + " : aucun versement régulier n'est nécessaire.");
      c = plusPetit(function (x) { return atteint(fv(avec(e, { versement: x / 100 })).capital, cible); }, cents(cible), cents(cible));
      e.versement = c / 100;
    } else if (inc === "duree") {
      if (atteint(e.capitalDepart, cible)) return erreur("capitalDepart", "Le capital de départ atteint déjà " + eur(cible) + " : aucune durée n'est nécessaire.");
      var pas = e.versement > 0 ? m : 1, nMax = Math.floor(LIM.dureeMax / pas);
      n = plusPetit(function (x) { return atteint(fv(avec(e, { dureeMois: x * pas })).capital, cible); }, 1, nMax);
      if (n === null) return erreur("duree", "Avec ces données, l'objectif de " + eur(cible) + " n'est pas atteint au bout de 50 ans. Augmentez le capital de départ, le versement ou le taux.");
      e.dureeMois = n * pas;
    } else if (inc === "taux") {
      if (atteint(fv(avec(e, { taux: 0 })).capital, cible)) return erreur("capitalDepart", "L'objectif de " + eur(cible) + " est déjà atteint sans aucun intérêt (taux de 0 %).");
      bp = plusPetit(function (x) { return atteint(fv(avec(e, { taux: x / 100 })).capital, cible); }, 3000, LIM.tauxMax * 100);
      if (bp === null) return erreur("taux", "Avec ces données, l'objectif de " + eur(cible) + " demanderait un taux supérieur à " + LIM.tauxMax + " % par an. Augmentez la durée, le capital de départ ou le versement.");
      e.taux = bp / 100;
    }
    r = fv(e, true);
    if (inc === "capitalAcquis") e.capitalAcquis = r.capital;
    var res = { ok: true, e: e, inconnue: inc, valeur: null, capitalObtenu: r.capital, verses: r.verses, interets: r.interets, lignes: r.lignes, dates: r.dates || null };
    res.valeur = inc === "capitalAcquis" ? r.capital : inc === "capitalDepart" ? e.capitalDepart : inc === "versement" ? e.versement : inc === "duree" ? e.dureeMois : e.taux;
    res.nbVersements = nbVersements(e);
    ex = exactes(avec(e, { inconnue: inc, capitalAcquis: inc === "capitalAcquis" ? null : e.capitalAcquis }));
    res.exact = ex.valeur === undefined ? null : ex.valeur;
    res.p = produitEpargne(e.produit);
    res.net = res.p && !res.p.exonere ? cents(r.verses + r.interets * (1 - PFU / 100)) / 100 : null;
    res.detail = detail(res, ex);
    res.alertes = alertes(res);
    return res;
  }

  /* ---------- calcul détaillé (texte) ---------- */
  function detail(res, ex) {
    var e = res.e, inc = res.inconnue, L = [], i = e.taux / 100, m = PERIODES[e.periodicite].mois, per = PERIODES[e.periodicite], N = res.nbVersements, D = e.dureeMois;
    var fin = e.moment === "debut" ? "au début" : "à la fin";
    L.push("Données : capital de départ " + eur(e.capitalDepart) + ", " + (e.versement > 0 ? "versement " + per.adj + " de " + eur(e.versement) + " " + fin + " de chaque période" : "aucun versement régulier") + ", durée " + libDuree(D) + ", taux annuel " + pct(e.taux) + ".");
    if (e.methode === "compose") {
      L.push("Méthode : intérêts composés. Le taux annuel i = " + nf(i, 4) + " est un taux effectif" + (e.versement > 0 ? " ; pour une période de " + pl(m, "mois", "mois") + ", on utilise le taux équivalent i_p = (1 + i)^(" + m + "/12) − 1 = " + nf(ex.ip, 6) + " (" + pct(ex.ip * 100) + ")." : "."));
      L.push("Valeur acquise du capital de départ : C0 × (1 + i)^(D/12) = " + eur(e.capitalDepart) + " × (1 + " + nf(i, 4) + ")^(" + D + "/12) = " + eur(e.capitalDepart * ex.g) + ".");
      if (e.versement > 0) L.push("Valeur acquise des " + pl(N, "versement", "versements") + " : V × [(1 + i_p)^N − 1] ÷ i_p" + (e.moment === "debut" ? " × (1 + i_p)" : "") + " = " + eur(e.versement) + " × " + nf(ex.A, 4) + " = " + eur(e.versement * ex.A) + ".");
      if (inc === "capitalDepart") L.push("Formule inversée : C0 = (capital visé − valeur acquise des versements) ÷ (1 + i)^(D/12) = (" + eur(e.capitalAcquis) + " − " + eur(e.versement * ex.A) + ") ÷ " + nf(ex.g, 6) + " = " + nf(res.exact, 4) + " €, arrondi au centime supérieur : " + eur(e.capitalDepart) + ".");
      if (inc === "versement") L.push("Formule inversée : V = (capital visé − valeur acquise du capital de départ) ÷ facteur de rente = (" + eur(e.capitalAcquis) + " − " + eur(e.capitalDepart * ex.g) + ") ÷ " + nf(ex.A, 4) + " = " + nf(res.exact, 4) + " €, arrondi au centime supérieur : " + eur(e.versement) + ".");
      if (inc === "duree" && res.exact !== null) L.push("Formule inversée : N = ln[(capital visé + V × k ÷ i_p) ÷ (C0 + V × k ÷ i_p)] ÷ ln(1 + i_p)" + (e.versement > 0 ? " (k = " + (e.moment === "debut" ? "1 + i_p" : "1") + ")" : "") + " = " + nf(res.exact, 2) + " " + (e.versement > 0 ? per.noms : "mois") + ". Les versements se font par périodes entières : on arrondit à l'entier supérieur, soit " + libDuree(D) + ".");
    } else if (e.methode === "simple") {
      L.push("Méthode : intérêts simples. Les intérêts sont proportionnels à la durée de placement et ne produisent pas d'intérêts : intérêts = somme × taux × durée en années.");
      L.push("Intérêts du capital de départ : " + eur(e.capitalDepart) + " × " + pct(e.taux) + " × " + D + " ÷ 12 = " + eur(e.capitalDepart * i * D / 12) + ".");
      if (e.versement > 0) L.push("Intérêts des " + pl(N, "versement", "versements") + " : chaque versement rapporte selon le temps qui lui reste jusqu'à la fin ; la somme des durées de placement est " + B.nb(sommeDurees(e, N)) + " périodes de " + pl(m, "mois", "mois") + ", d'où " + eur(e.versement) + " × " + pct(e.taux) + " × " + m + "/12 × " + B.nb(sommeDurees(e, N)) + " = " + eur(e.versement * ex.kk * sommeDurees(e, N)) + ".");
      if (inc === "capitalDepart") L.push("Formule inversée : C0 = (capital visé − versements − leurs intérêts) ÷ (1 + i × D/12) = " + nf(res.exact, 4) + " €, arrondi au centime supérieur : " + eur(e.capitalDepart) + ".");
      if (inc === "versement") L.push("Formule inversée : V = (capital visé − capital de départ avec ses intérêts) ÷ (N + i × m/12 × somme des durées) = " + nf(res.exact, 4) + " €, arrondi au centime supérieur : " + eur(e.versement) + ".");
      if (inc === "duree" && res.exact !== null) L.push("Équation de la durée (second degré lorsqu'il y a des versements) : N = " + nf(res.exact, 2) + " " + (e.versement > 0 ? per.noms : "périodes d'un mois") + ", arrondi à l'entier supérieur : " + libDuree(D) + ".");
    } else {
      var d = res.dates, q = e.capitalDepart > 0 ? e.capitalDepart : e.versement;
      L.push("Méthode : règle des quinzaines. Un dépôt porte intérêt à partir du 1er ou du 16 qui suit le jour du dépôt ; un retrait cesse d'en porter à la fin de la quinzaine qui précède le retrait ; chaque quinzaine rapporte 1/24 de l'intérêt annuel ; les intérêts de l'année s'ajoutent au capital le 31 décembre.");
      L.push("Dépôt de départ le " + B.fmtDate(d.depart) + " : intérêts à partir du " + B.fmtDate(d.debutInterets) + ". Retrait le " + B.fmtDate(d.fin) + " : intérêts jusqu'au " + B.fmtDate(d.finInterets) + " inclus. Une somme déposée au départ rapporte donc " + pl(d.quinzaines, "quinzaine", "quinzaines") + " au lieu de " + (2 * D) + ".");
      L.push("Intérêt d'une quinzaine sur " + eur(q) + " : " + eur(q) + " × " + pct(e.taux) + " ÷ 24 = " + nf(q * i / 24, 4) + " €.");
      L.push("Les intérêts de chaque année, cumulés quinzaine après quinzaine, sont arrondis au centime au moment où ils s'ajoutent au capital (31 décembre, puis date de fin) ; ils produisent ensuite eux-mêmes des intérêts.");
      if (e.versement > 0) L.push("Les versements ont lieu le même jour du mois que le dépôt de départ (" + (e.moment === "debut" ? "le premier avec le capital de départ" : "le premier une période après le départ, le dernier le jour du retrait : il ne rapporte rien") + ").");
    }
    if (inc !== "capitalAcquis") {
      if (e.methode === "quinzaines" || inc === "taux" || (e.methode !== "quinzaines" && res.exact === null)) L.push("Recherche par essais successifs, comme sur une calculatrice financière : on retient " + (inc === "taux" ? "le plus petit taux (au centième de point)" : inc === "duree" ? "la plus petite durée" : "la plus petite valeur (au centime)") + " qui permet d'atteindre le capital visé.");
      L.push("Vérification : avec " + (inc === "capitalDepart" ? "un capital de départ de " + eur(e.capitalDepart) : inc === "versement" ? "un versement de " + eur(e.versement) : inc === "duree" ? "une durée de " + libDuree(D) : "un taux de " + pct(e.taux)) + ", le capital acquis est de " + eur(res.capitalObtenu) + " (objectif : " + eur(e.capitalAcquis) + ").");
    }
    L.push("Capital acquis = versements (" + eur(res.verses) + ") + intérêts (" + eur(res.interets) + ") = " + eur(res.capitalObtenu) + ".");
    if (res.p && res.p.cat && e.methode === "simple" && e.versement === 0) L.push("Compte à terme : intérêts = capital × taux × durée ÷ 12 = " + eur(e.capitalDepart) + " × " + pct(e.taux) + " × " + D + " ÷ 12 = " + eur(e.capitalDepart * i * D / 12) + " brut. Après le prélèvement forfaitaire unique de " + nf(PFU, 1) + " % : " + eur(cents(res.interets * (1 - PFU / 100)) / 100) + " net.");
    return L;
  }

  /* ---------- compte à terme ---------- */
  function libGrille(g) {
    return Object.keys(g).map(Number).sort(function (a, b) { return a - b; }).map(function (m) { return libDuree(m) + " : " + pct(g[m]); }).join(" ; ");
  }
  function alertesCat(res, add) {
    var e = res.e, p = res.p, g = p.grille, inc = res.inconnue, tg = g[e.dureeMois];
    if (e.versement > 0 && inc !== "versement") add("attention", "Un compte à terme est un dépôt unique, fait à la souscription : il n'y a pas de versement régulier. Mettez le versement à 0 (ou ouvrez un second compte à terme).");
    if (inc === "versement") add("attention", "Un compte à terme n'a pas de versement régulier : choisissez de calculer une autre grandeur.");
    if (e.methode !== "simple") add("attention", "Les intérêts d'un compte à terme ne sont pas ajoutés au capital : ils sont versés à l'échéance (chaque année dès 24 mois). Choisissez la méthode « Intérêts simples ».");
    if (!tg) add("attention", "La durée (" + libDuree(e.dureeMois) + ") ne figure pas dans la grille de la banque. Durées possibles : 3, 6, 12, 24, 36, 48 ou 60 mois.");
    else if (inc !== "taux" && Math.abs(e.taux - tg) > 0.004) add("attention", "Le taux saisi (" + pct(e.taux) + ") n'est pas celui de la grille pour " + libDuree(e.dureeMois) + " (" + pct(tg) + ") : le taux d'un compte à terme est fixé par la banque à la souscription.");
    else if (inc !== "taux") add("info", "Taux de la grille pour " + libDuree(e.dureeMois) + " : " + pct(tg) + " brut par an, fixe et garanti pendant toute la durée.");
    if (inc === "taux") add("info", "Le taux nécessaire est de " + pct(res.valeur) + "." + (tg ? " La grille de la banque donne " + pct(tg) + " pour " + libDuree(e.dureeMois) + " : " + (res.valeur > tg + 0.004 ? "ce taux est supérieur à la grille, l'objectif n'est pas atteint avec un compte à terme sur cette durée." : "la grille suffit pour atteindre l'objectif.") : ""));
    add("info", "Grille des taux fixes bruts : " + libGrille(g) + ".");
    add("info", e.dureeMois >= 24 ? "Durée de 24 mois ou plus : les intérêts sont versés chaque année sur le compte courant (environ " + eur(res.interets / (e.dureeMois / 12)) + " brut par an), le capital est rendu à l'échéance." : "Durée inférieure à 24 mois : tous les intérêts sont versés à l'échéance, avec le capital.");
    add("info", "Dispense possible de l'acompte de 12,8 % si le revenu fiscal de référence est inférieur à 25 000 € (personne seule) ou 50 000 € (couple) : demande sur l'honneur avant le 30 novembre de l'année précédente.");
    add("info", "Retrait avant l'échéance : possible avec l'accord de la banque ; les intérêts sont alors recalculés à 50 % du taux initial, sans pénalité sur le capital.");
  }

  /* ---------- points d'attention ---------- */
  function alertes(res) {
    var e = res.e, p = res.p, a = [], inc = res.inconnue;
    function add(n, t) { a.push({ n: n, t: t }); }
    /* Le taux étant toujours libre, ces deux contrôles valent avec ou sans produit du catalogue. */
    if (e.taux > LIM.tauxAlerte && inc !== "taux") add("attention", "Un taux supérieur à " + LIM.tauxAlerte + " % par an ne peut pas être garanti par un livret ou un fonds en euros : c'est une hypothèse de calcul, pas un rendement certain.");
    if (inc === "taux" && res.valeur > LIM.tauxAlerte) add("attention", "Le taux nécessaire (" + pct(res.valeur) + ") est supérieur à ce que peut garantir un livret ou un fonds en euros : revoyez l'objectif, la durée ou les versements.");
    if (p) {
      if (p.plafond && res.verses > p.plafond) add("attention", "Le total des versements (" + eur(res.verses) + ") dépasse le plafond de dépôts du " + p.code + " (" + eur(p.plafond) + ") : ce plan n'est pas réalisable sur ce livret.");
      else if (p.plafond && res.capitalObtenu > p.plafond) add("info", "Le capital acquis (" + eur(res.capitalObtenu) + ") dépasse le plafond du " + p.code + " (" + eur(p.plafond) + ") : c'est possible, car seuls les versements sont plafonnés ; les intérêts capitalisés ne comptent pas dans le plafond.");
      var premier = e.capitalDepart > 0 ? e.capitalDepart : e.versement;
      if (p.minimum && premier < p.minimum) add("attention", "Le premier dépôt (" + eur(premier) + ") est inférieur au dépôt minimum du " + p.code + " (" + eur(p.minimum) + ").");
      if (p.cat) alertesCat(res, add);
      else if (e.methode !== "quinzaines") add("info", "Pour le " + p.code + ", la banque calcule les intérêts par quinzaine : le résultat avec cette méthode est indicatif.");
      if (inc !== "taux" && !p.cat) add("info", "Le taux utilisé (" + pct(e.taux) + ") est celui que vous avez saisi : " + (p.evolutif ? "le taux en vigueur du " + p.code + " est communiqué dans la newsletter." : "le taux du " + p.code + " est fixé par la banque et indiqué dans sa fiche produit."));
      if (inc === "taux" && !p.cat) add("info", "Le taux nécessaire est de " + pct(res.valeur) + " : comparez-le " + (p.evolutif ? "au taux en vigueur du " + p.code + " communiqué dans la newsletter" : "au taux du " + p.code + " indiqué dans sa fiche produit") + " pour savoir si ce livret suffit pour atteindre l'objectif dans ces conditions.");
      if (p.exonere) add("info", "Intérêts exonérés d'impôt sur le revenu et de prélèvements sociaux : le taux net est égal au taux indiqué.");
      else add("info", "Intérêts imposables : le calcul donne des intérêts bruts. Après le prélèvement forfaitaire unique de " + nf(PFU, 1) + " % (12,8 % d'impôt et 18,6 % de prélèvements sociaux en 2026), le capital serait d'environ " + eur(res.net) + " (estimation).");
      if (p.cat) { /* taux fixe : voir alertesCat */ }
      else if (p.evolutif) add("info", "Le taux est fixé par les pouvoirs publics et révisé le 1er février et le 1er août ; le calcul suppose le taux saisi constant sur toute la durée.");
      else add("info", "Le taux est fixé par la banque et peut être révisé ; le calcul suppose le taux saisi constant sur toute la durée.");
      if (p.id === "LEP") add("info", "Le LEP est réservé aux clients dont le revenu fiscal de référence ne dépasse pas le plafond de leur foyer.");
      if (p.id === "LJ") add("info", "Le Livret Jeune est réservé aux 12-25 ans et clôturé au plus tard le 31 décembre de l'année des 25 ans.");
      if (p.id === "LBR" && e.methode === "quinzaines") add("info", "Le catalogue ne précise pas le mode de calcul du Livret Projets : on applique par convention la règle des quinzaines des livrets bancaires (décision n° 69-02 du Conseil national du crédit).");
    } else {
      add("info", "Taux annuel supposé constant sur toute la durée, intérêts bruts avant impôts et prélèvements sociaux.");
      if (e.methode === "quinzaines") add("info", "La règle des quinzaines s'applique aux livrets réglementés (Livret A, LDDS, LEP, Livret Jeune) et, d'après la décision n° 69-02 du Conseil national du crédit, aux comptes sur livret des banques.");
    }
    if (e.methode === "simple" && e.dureeMois > 12 && !(p && p.cat)) add("info", "Les intérêts simples s'utilisent pour des placements de moins d'un an ; au-delà, les produits d'épargne capitalisent leurs intérêts (intérêts composés).");
    if (e.methode === "quinzaines" && e.dureeMois < 2) add("info", "Sur une durée aussi courte, la règle des quinzaines fait perdre une quinzaine à l'entrée et une à la sortie : les intérêts sont très faibles.");
    return a;
  }

  /* Même calcul avec les trois méthodes (pour comparer). */
  function comparer(saisie) {
    return ORDRE_METHODES.map(function (mt) {
      var r = calculer(avec(saisie, { methode: mt }));
      return { methode: mt, ok: r.ok, erreur: r.ok ? null : r.erreur, champ: r.ok ? null : r.champ, valeur: r.ok ? r.valeur : null, interets: r.ok ? r.interets : null, verses: r.ok ? r.verses : null, capital: r.ok ? r.capitalObtenu : null };
    });
  }

  var api = {
    INCONNUES: INCONNUES, ORDRE_INCONNUES: ORDRE_INCONNUES, METHODES: METHODES, ORDRE_METHODES: ORDRE_METHODES, PERIODES: PERIODES, ORDRE_PERIODES: ORDRE_PERIODES, MOMENTS: MOMENTS, LIM: LIM, PFU: PFU, PRODUITS_EPARGNE: PRODUITS_EPARGNE,
    lireNombre: lireNombre, libDuree: libDuree, produitEpargne: produitEpargne, produitsEpargne: produitsEpargne, controler: controler, calculer: calculer, comparer: comparer, fv: fv, exactes: exactes,
    quinzaine: quinzaine, simulerQuinzaines: simulerQuinzaines, pct: pct
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.epargne = api; }
})(typeof window !== "undefined" ? window : null);
