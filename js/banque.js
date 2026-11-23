/* GS Banque & Assurance – fonctions communes : calendrier (jours ouvrés), formats, calculs de crédit, sauvegarde.
   Toutes les dates des données sont RELATIVES à la date de l'exercice (aujourd'hui) : « jours » = nombre de jours avant aujourd'hui. */
(function (root) {
  "use strict";

  var maintenantFixe = null;
  function setNow(d) { maintenantFixe = d ? new Date(d.getTime()) : null; }
  function maintenant() { return maintenantFixe ? new Date(maintenantFixe.getTime()) : new Date(); }
  /* Les dates sont manipulées à midi, heure locale, pour éviter les décalages d'heure d'été. */
  function D(y, m, d) { return new Date(y, m, d, 12, 0, 0, 0); }
  function jour(d) { return D(d.getFullYear(), d.getMonth(), d.getDate()); }
  function aujourdhui() { return jour(maintenant()); }
  function plusJours(d, n) { return D(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function ecartJours(a, b) { return Math.round((jour(a).getTime() - jour(b).getTime()) / 86400000); }
  function dernierJourDuMois(y, m) { return D(y, m + 1, 0).getDate(); }
  function indexMois(d) { return d.getFullYear() * 12 + d.getMonth(); }
  /* Date correspondant à l'indice de mois k et au jour j (le jour est ramené au dernier jour du mois si besoin). */
  function dateDuMois(k, j) {
    var y = Math.floor(k / 12), m = k - y * 12;
    return D(y, m, Math.min(j, dernierJourDuMois(y, m)));
  }

  /* Jours fériés en France métropolitaine (algorithme de Meeus pour Pâques). */
  function paques(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    var g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    var l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    var mois = Math.floor((h + l - 7 * m + 114) / 31), j = ((h + l - 7 * m + 114) % 31) + 1;
    return D(y, mois - 1, j);
  }
  var cacheFeries = {};
  function feries(y) {
    if (cacheFeries[y]) return cacheFeries[y];
    var p = paques(y), s = {};
    [D(y, 0, 1), plusJours(p, 1), D(y, 4, 1), D(y, 4, 8), plusJours(p, 39), plusJours(p, 50), D(y, 6, 14), D(y, 7, 15), D(y, 10, 1), D(y, 10, 11), D(y, 11, 25)].forEach(function (d) { s[ymd(d)] = true; });
    cacheFeries[y] = s;
    return s;
  }
  function ymd(d) { return d.getFullYear() + "-" + (d.getMonth() < 9 ? "0" : "") + (d.getMonth() + 1) + "-" + (d.getDate() < 10 ? "0" : "") + d.getDate(); }
  function estFerie(d) { return !!feries(d.getFullYear())[ymd(d)]; }
  function estOuvre(d) { var w = d.getDay(); return w !== 0 && w !== 6 && !estFerie(d); }
  function ouvrePrecedent(d) { var x = jour(d); while (!estOuvre(x)) x = plusJours(x, -1); return x; }
  function ouvreSuivant(d) { var x = jour(d); while (!estOuvre(x)) x = plusJours(x, 1); return x; }

  /* Date d'un événement survenu « jours » jours avant aujourd'hui, ramenée au jour ouvré précédent (négatif = futur). */
  function dateJours(n) { return plusJours(aujourdhui(), -n); }
  /* Ouverture de l'agence (convention de l'exercice) : du mardi au vendredi de 9 h à 13 h puis de 14 h à 18 h, samedi de 9 h à 13 h ; fermée le dimanche, le lundi (repos hebdomadaire) et les jours fériés.
     À ne pas confondre avec le « jour ouvré » bancaire ci-dessus (lundi au vendredi), qui sert aux dates de comptabilisation et de valeur. */
  var PLAGES_SEMAINE = [["09:00", "13:00"], ["14:00", "18:00"]], PLAGES_SAMEDI = [["09:00", "13:00"]];
  function plagesAgence(d) { var w = d.getDay(); if (w === 0 || w === 1 || estFerie(d)) return []; return w === 6 ? PLAGES_SAMEDI : PLAGES_SEMAINE; }
  function agenceOuverte(d) { return plagesAgence(d).length > 0; }
  function agenceSuivant(d) { var x = jour(d); while (!agenceOuverte(x)) x = plusJours(x, 1); return x; }
  function agencePrecedent(d) { var x = jour(d); while (!agenceOuverte(x)) x = plusJours(x, -1); return x; }
  /* Premier instant, à partir de d, où l'agence est ouverte (d lui-même si elle l'est déjà) : renvoie une date. Les heures d'ouverture sont celles de plagesAgence (pause de midi, nuit, dimanche, lundi et jours fériés exclus).
     Sert aux appels entrants et aux clients au distributeur : aucun n'arrive en dehors des heures d'ouverture. */
  function minutesDe(hm) { var p = hm.split(":"); return +p[0] * 60 + +p[1]; }
  function prochaineOuverture(d) {
    var x = new Date(d.getTime());
    for (var i = 0; i < 20; i++) {
      var t = x.getHours() * 60 + x.getMinutes(), pl = plagesAgence(x);
      for (var k = 0; k < pl.length; k++) {
        var a = minutesDe(pl[k][0]), b = minutesDe(pl[k][1]);
        if (t < b) return t >= a ? x : new Date(x.getFullYear(), x.getMonth(), x.getDate(), Math.floor(a / 60), a % 60, 0, 0);
      }
      x = new Date(x.getFullYear(), x.getMonth(), x.getDate() + 1, 0, 0, 0, 0);
    }
    return x;
  }
  function ouvertA(d) { return prochaineOuverture(d).getTime() === d.getTime(); }
  /* Plages réservées de l'agence, chaque jour d'ouverture (samedi compris) : aucun rendez-vous ne s'y place.
     - gestion des débiteurs, atypiques et GDI : 9 h 10 – 10 h ; proactivité : 11 h – 12 h ;
     - réunion d'équipe : le jeudi seulement, 14 h – 15 h (pas de réunion un jeudi férié : l'agence est fermée) ;
     - plage accueil : une heure pleine, tirée au sort pour chaque jour (toujours la même pour un jour donné), en dehors des plages ci-dessus. */
  var DUREE_PLAGE_ACCUEIL = 60;
  var PLAGE_GESTION = { id: "gestion", lib: "Gestion des débiteurs, atypiques et GDI", court: "Gestion", debut: "09:10", fin: "10:00" };
  var PLAGE_PROACTIVITE = { id: "proactivite", lib: "Proactivité", court: "Proactivité", debut: "11:00", fin: "12:00" };
  var PLAGE_REUNION = { id: "reunion", lib: "Réunion d'équipe", court: "Réunion", debut: "14:00", fin: "15:00" };
  var JOUR_REUNION = 4;   /* jeudi (Date.getDay) */
  function enMinutes(h) { var m = /^(\d{2}):(\d{2})$/.exec(String(h == null ? "" : h)); return m ? (+m[1]) * 60 + (+m[2]) : NaN; }
  function enHeure(n) { return (n < 600 ? "0" : "") + Math.floor(n / 60) + ":" + (n % 60 < 10 ? "0" : "") + (n % 60); }
  /* Nombre pseudo-aléatoire stable (0 à 2^32-1) tiré de la date : la plage accueil ne change pas quand on recharge la page. */
  function hasardJour(d) {
    var n = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000), x = Math.imul(n + 7919, 2654435761) >>> 0;
    x = Math.imul(x ^ (x >>> 15), 2246822519) >>> 0; x = Math.imul(x ^ (x >>> 13), 3266489917) >>> 0;
    return (x ^ (x >>> 16)) >>> 0;
  }
  /* Plages réservées d'un jour, dans l'ordre de la journée (liste vide si l'agence est fermée). */
  function plagesReservees(d) {
    var ouv = plagesAgence(d);
    if (!ouv.length) return [];
    var fixes = [PLAGE_GESTION, PLAGE_PROACTIVITE], cand = [];
    if (d.getDay() === JOUR_REUNION) fixes.push(PLAGE_REUNION);
    ouv.forEach(function (p) {
      for (var s = enMinutes(p[0]); s + DUREE_PLAGE_ACCUEIL <= enMinutes(p[1]); s += 60) {
        var libre = fixes.every(function (f) { return s + DUREE_PLAGE_ACCUEIL <= enMinutes(f.debut) || s >= enMinutes(f.fin); });
        if (libre) cand.push(s);
      }
    });
    var deb = cand[hasardJour(d) % cand.length];
    var acc = { id: "accueil", lib: "Plage accueil", court: "Accueil", debut: enHeure(deb), fin: enHeure(deb + DUREE_PLAGE_ACCUEIL) };
    return fixes.concat([acc]).map(function (x) { return Object.assign({}, x); }).sort(function (a, b) { return enMinutes(a.debut) - enMinutes(b.debut); });
  }
  /* Plage réservée que chevauche un élément de « duree » minutes commençant à « heure » (null si aucune). */
  function plageChevauchee(d, heure, duree) {
    var t = enMinutes(heure), res = null;
    if (isNaN(t)) return null;
    plagesReservees(d).forEach(function (p) { if (!res && t < enMinutes(p.fin) && t + (duree || 0) > enMinutes(p.debut)) res = p; });
    return res;
  }
  /* Heures de début possibles d'un rendez-vous d'une heure ce jour-là : heures d'ouverture moins plages réservées, de 60 minutes en 60 minutes. */
  function creneauxRdv(d) {
    var res = [], res_ = plagesReservees(d);
    plagesAgence(d).forEach(function (p) {
      var segs = [[enMinutes(p[0]), enMinutes(p[1])]];
      res_.forEach(function (r) {
        var a = enMinutes(r.debut), b = enMinutes(r.fin), suite = [];
        segs.forEach(function (sg) {
          if (b <= sg[0] || a >= sg[1]) { suite.push(sg); return; }
          if (a > sg[0]) suite.push([sg[0], a]);
          if (b < sg[1]) suite.push([b, sg[1]]);
        });
        segs = suite;
      });
      segs.forEach(function (sg) { for (var s = sg[0]; s + 60 <= sg[1]; s += 60) res.push(enHeure(s)); });
    });
    return res;
  }
  function dateOuvrable(n) { return ouvrePrecedent(dateJours(n)); }
  /* Date d'un contact avec le client (entretien en agence, appel, note du dossier) survenu « n » jours avant aujourd'hui : ramenée au jour d'ouverture de l'agence précédent (ni dimanche, ni lundi, ni jour férié). */
  function dateContact(n) { return agencePrecedent(dateJours(n)); }
  /* Nombre de jours (avant aujourd'hui) correspondant à une date. */
  function joursDepuis(d) { return ecartJours(aujourdhui(), d); }

  /* ---------- formats ---------- */
  var nfEur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
  var nfEur2 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var nfNb = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
  var nfPct = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 0 });
  function arrondi(x) { return Math.round(x * 100) / 100; }
  function eur(n) { return nfEur.format(Math.round(n)).replace("-", "−"); }
  /* Montant en milliers d'euros (K€), deux décimales : 25 000 € → « 25,00 K€ », 240 € → « 0,24 K€ ». */
  var nfK = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function eurK(n) { return nfK.format(Math.round(n / 10) / 100).replace("-", "−") + "\u00a0K€"; }
  function eur2(n) { return nfEur2.format(arrondi(n)).replace("-", "−"); }
  function nb(n) { return nfNb.format(n); }
  function pct(n) { return nfPct.format(n) + " %"; }
  function fmtDate(d) { return (d.getDate() < 10 ? "0" : "") + d.getDate() + "/" + (d.getMonth() < 9 ? "0" : "") + (d.getMonth() + 1) + "/" + d.getFullYear(); }
  /* Date saisie au format AAAA-MM-JJ (champ « date » d'un formulaire) → date à midi, ou null si elle n'existe pas (ex. 2026-02-30). */
  function lireYmd(t) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(t == null ? "" : t));
    if (!m) return null;
    var y = +m[1], mo = +m[2] - 1, j = +m[3], d = D(y, mo, j);
    return d.getFullYear() === y && d.getMonth() === mo && d.getDate() === j ? d : null;
  }
  function hhmm(d) { return (d.getHours() < 10 ? "0" : "") + d.getHours() + ":" + (d.getMinutes() < 10 ? "0" : "") + d.getMinutes(); }
  function fmtCourt(d) { return (d.getDate() < 10 ? "0" : "") + d.getDate() + "/" + (d.getMonth() < 9 ? "0" : "") + (d.getMonth() + 1); }
  var MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  var JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  function libMois(k) { var y = Math.floor(k / 12), m = k - y * 12; return MOIS[m].charAt(0).toUpperCase() + MOIS[m].slice(1) + " " + y; }
  function fmtLong(d) { return JOURS[d.getDay()] + " " + d.getDate() + (d.getDate() === 1 ? "er " : " ") + MOIS[d.getMonth()] + " " + d.getFullYear(); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /* ---------- crédit ---------- */
  function mensualite(capital, tauxPct, dureeMois) {
    var r = tauxPct / 1200;
    if (!r) return arrondi(capital / dureeMois);
    return arrondi(capital * r / (1 - Math.pow(1 + r, -dureeMois)));
  }
  function capitalRestant(capital, tauxPct, dureeMois, payees) {
    var r = tauxPct / 1200;
    if (payees <= 0) return capital;
    if (payees >= dureeMois) return 0;
    if (!r) return arrondi(capital * (1 - payees / dureeMois));
    return arrondi(capital * (Math.pow(1 + r, dureeMois) - Math.pow(1 + r, payees)) / (Math.pow(1 + r, dureeMois) - 1));
  }
  /* Mensualités déjà prélevées : la première échéance est prélevée le mois qui suit l'ouverture, au jour d'échéance. */
  function echeancesPayees(cre, auj) {
    auj = auj || aujourdhui();
    var o = dateJours(cre.ouvert), k0 = indexMois(o) + 1, k1 = indexMois(auj), n = 0;
    for (var k = k0; k <= k1; k++) { if (dateDuMois(k, cre.jEch) <= auj) n++; }
    return Math.min(n, cre.dur);
  }
  function crdAu(cre, auj) { return capitalRestant(cre.cap, cre.taux, cre.dur, echeancesPayees(cre, auj)); }

  /* ---------- sauvegarde locale partagée entre les outils ---------- */
  var CLE = "sgbf-banque-v1";
  var memoire = null;
  function neuf() { return { v: 1, eleve: { nom: "", classe: "" }, notes: {}, infos: {}, agenda: [], cibles: [], souscriptions: [], messages: [], campagnes: [], appels: [], contacts: [], bilans: {}, analyses: {}, montages: [], profils: {}, rapports: [], operations: [], reclamations: [] }; }
  function charger() {
    if (memoire) return memoire;
    try {
      var s = JSON.parse(localStorage.getItem(CLE) || "null");
      if (s && s.v === 1) { memoire = Object.assign(neuf(), s); return memoire; }
    } catch (e) { /* stockage indisponible : on repart de zéro */ }
    memoire = neuf();
    return memoire;
  }
  function sauver() { try { localStorage.setItem(CLE, JSON.stringify(memoire || neuf())); } catch (e) { /* ignoré */ } }
  function reinitialiser() { memoire = neuf(); sauver(); return memoire; }

  /* Mention pédagogique en tout petit au pied de chaque page, sauf l'accueil (hors impression) : ajoutée dans le pied de page existant, sinon dans un pied de page propre. */
  var MENTION_PEDAGO = "Situation fictive à des fins pédagogiques : agence, clients, produits et tarifs imaginaires.";
  function piedPedago() {
    var d = root && root.document;
    if (!d || !d.body || d.querySelector(".pied-pedago") || d.body.getAttribute("data-sans-mention-pedago") === "1") return;   /* l'accueil n'affiche pas la mention */
    var p = d.createElement("p");
    p.className = "pied-pedago";
    p.textContent = MENTION_PEDAGO;
    var pied = d.querySelector(".pied-site, .pied-connexion");
    if (pied) { pied.appendChild(p); return; }
    var f = d.createElement("footer");
    f.className = "pied-pedago-conteneur";
    f.appendChild(p);
    d.body.appendChild(f);
  }
  if (root && root.document) {
    if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", piedPedago);
    else piedPedago();
  }

  var api = {
    CLE: CLE, MENTION_PEDAGO: MENTION_PEDAGO, setNow: setNow, maintenant: maintenant, D: D, jour: jour, aujourdhui: aujourdhui, plusJours: plusJours, ecartJours: ecartJours,
    dernierJourDuMois: dernierJourDuMois, indexMois: indexMois, dateDuMois: dateDuMois, paques: paques, estFerie: estFerie, estOuvre: estOuvre, plagesAgence: plagesAgence, agenceOuverte: agenceOuverte, prochaineOuverture: prochaineOuverture, ouvertA: ouvertA, agenceSuivant: agenceSuivant, agencePrecedent: agencePrecedent, plagesReservees: plagesReservees, plageChevauchee: plageChevauchee, creneauxRdv: creneauxRdv,
    ouvrePrecedent: ouvrePrecedent, ouvreSuivant: ouvreSuivant, dateJours: dateJours, dateOuvrable: dateOuvrable, dateContact: dateContact, joursDepuis: joursDepuis, ymd: ymd, lireYmd: lireYmd, hhmm: hhmm,
    arrondi: arrondi, eur: eur, eur2: eur2, eurK: eurK, nb: nb, pct: pct, fmtDate: fmtDate, fmtCourt: fmtCourt, libMois: libMois, fmtLong: fmtLong, esc: esc, MOIS: MOIS, JOURS: JOURS,
    mensualite: mensualite, capitalRestant: capitalRestant, echeancesPayees: echeancesPayees, crdAu: crdAu,
    store: { charger: charger, sauver: sauver, reinitialiser: reinitialiser }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.banque = api; }
})(typeof window !== "undefined" ? window : null);
