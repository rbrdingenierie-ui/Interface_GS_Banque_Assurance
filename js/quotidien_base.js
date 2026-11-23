/* GS Banque & Assurance – dossiers « du jour » : outils communs (tirage reproductible, formats, noms, calendrier).
   Les dossiers « du jour » des outils « Opérations débiteurs » et « Mouvements atypiques » sont fabriqués à partir de la date seule :
   le même jour, toute la classe reçoit la même liste ; le lendemain, une autre. Fonctions pures, sans dépendance au navigateur. */
(function (root) {
  "use strict";

  var B = root && root.SGBF && root.SGBF.banque ? root.SGBF.banque : require("./banque.js");

  /* ---------- tirage reproductible ---------- */
  function hachage(s) {
    var h = 1779033703 ^ s.length, i;
    for (i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function rng(graine) {
    var a = hachage(String(graine)) >>> 0;
    function f() {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    var o = {
      f: f,
      /* entier de lo à hi inclus */
      n: function (lo, hi) { return lo + Math.floor(f() * (hi - lo + 1)); },
      /* nombre arrondi au pas donné, de lo à hi inclus */
      pas: function (lo, hi, pas) { return lo + pas * Math.floor(f() * (Math.floor((hi - lo) / pas) + 1)); },
      pick: function (t) { return t[Math.floor(f() * t.length)]; },
      chance: function (p) { return f() < p; },
      melange: function (t) {
        var r = t.slice(), i, j, x;
        for (i = r.length - 1; i > 0; i--) { j = Math.floor(f() * (i + 1)); x = r[i]; r[i] = r[j]; r[j] = x; }
        return r;
      },
      /* tirage pondéré : [[valeur, poids], …] */
      poids: function (t) {
        var s = 0, i, x;
        for (i = 0; i < t.length; i++) s += t[i][1];
        x = f() * s;
        for (i = 0; i < t.length; i++) { x -= t[i][1]; if (x < 0) return t[i][0]; }
        return t[t.length - 1][0];
      }
    };
    return o;
  }

  /* ---------- formats ---------- */
  function r2(x) { return Math.round(x * 100) / 100; }
  function groupes(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }
  /* « 2 350 € », « 135,80 € », « −881 € » : espace ordinaire, virgule décimale, vrai signe moins. */
  function eur(x) {
    var v = r2(x), neg = v < 0, a = Math.abs(v), ent = Math.floor(a + 1e-9), cts = Math.round((a - ent) * 100), s;
    if (cts === 100) { ent += 1; cts = 0; }
    s = groupes(ent) + (cts ? "," + (cts < 10 ? "0" : "") + cts : "");
    return (neg ? "−" : "") + s + " €";
  }
  /* idem, mais toujours avec deux décimales (« 0,00 € ») */
  function eur2(x) {
    var v = r2(x), neg = v < 0, a = Math.abs(v), ent = Math.floor(a + 1e-9), cts = Math.round((a - ent) * 100);
    if (cts === 100) { ent += 1; cts = 0; }
    return (neg && (ent || cts) ? "−" : "") + groupes(ent) + "," + (cts < 10 ? "0" : "") + cts + " €";
  }
  function nb(x) { return groupes(x); }
  function pl(n, s, p) { return n + " " + (n > 1 ? p : s); }
  function maj1(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  /* « le 12 novembre 2026 » à partir d'AAAA-MM-JJ */
  var MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  function dateLongue(ymd) { var p = ymd.split("-"); return (+p[2] === 1 ? "1er" : +p[2]) + " " + MOIS[+p[1] - 1] + " " + p[0]; }

  /* ---------- calendrier ---------- */
  function lireYmd(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0, 0);
    return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d : null;
  }

  /* Nombre de dossiers à traiter un jour donné, entre 5 et 20 pour chacun des deux outils (5 à 14 pour la gestion des incidents : plus nombreux le lundi et en début de mois).
     Débiteurs : plus de comptes à l'état des débiteurs le lundi (opérations du week-end), en début de mois (loyers, assurances, abonnements)
     et un peu en fin de mois (soldes bas avant les salaires).
     Atypiques : plus de remises et de retraits d'espèces le vendredi et en fin de mois.
     Un jour non ouvré, la banque est fermée : le minimum, 5. */
  function nombreDuJour(ymd, outil) {
    var d = lireYmd(ymd);
    if (!d) throw new Error("date invalide : " + ymd);
    var r = rng("nombre|" + outil + "|" + ymd), j = d.getDate(), w = d.getDay(), n;
    if (!B.estOuvre(d)) return 5;
    if (outil === "incidents") {
      n = 7 + r.n(-2, 3);
      if (w === 1) n += 2;
      if (j <= 5) n += 1;
      return Math.max(5, Math.min(14, n));
    }
    if (outil === "debiteurs") {
      n = 8 + r.n(-3, 3);
      if (w === 1) n += 4;
      if (j <= 5) n += 5; else if (j >= 26) n += 2;
    } else {
      n = 7 + r.n(-2, 3);
      if (w === 5) n += 2;
      if (j >= 27) n += 3; else if (j <= 5) n += 1;
    }
    return Math.max(5, Math.min(20, n));
  }

  /* ---------- identités ---------- */
  var PRENOMS_F = {
    jeune: ["Léa", "Emma", "Chloé", "Inès", "Manon", "Camille", "Sarah", "Lola", "Jade", "Louane", "Lina", "Anaïs", "Clémence", "Maëlle", "Océane", "Eva", "Margaux", "Romane", "Noémie", "Yasmine"],
    adulte: ["Sophie", "Aurélie", "Céline", "Julie", "Émilie", "Stéphanie", "Marion", "Laëtitia", "Amandine", "Élodie", "Mélanie", "Sandrine", "Virginie", "Audrey", "Nadège", "Karine", "Cécile", "Aïcha", "Fatima", "Sabrina", "Laurence", "Delphine", "Magali"],
    senior: ["Monique", "Françoise", "Nicole", "Martine", "Jacqueline", "Colette", "Josiane", "Danielle", "Brigitte", "Annie", "Michèle", "Odile", "Gisèle", "Huguette", "Paulette", "Lucette", "Denise", "Yvonne"]
  };
  var PRENOMS_M = {
    jeune: ["Lucas", "Hugo", "Théo", "Nathan", "Enzo", "Tom", "Maxime", "Rayan", "Noah", "Ilyès", "Axel", "Baptiste", "Clément", "Kylian", "Mathéo", "Yanis", "Bastien", "Adrien", "Sofiane", "Dylan"],
    adulte: ["Julien", "Sébastien", "Guillaume", "Nicolas", "David", "Cédric", "Mickaël", "Anthony", "Jérôme", "Stéphane", "Fabien", "Samir", "Rachid", "Yann", "Damien", "Ludovic", "Bruno", "Franck", "Xavier", "Mohamed", "Vincent", "Grégory"],
    senior: ["Gérard", "Michel", "Alain", "Daniel", "Bernard", "Claude", "Roger", "Jean-Claude", "Pierre", "Jacques", "Marcel", "Gilbert", "Raymond", "Lucien", "Maurice", "Serge", "Henri", "Guy"]
  };
  /* Noms de famille propres aux dossiers « du jour » : aucun n'est porté par un client du portefeuille, un collègue de l'agence
     ou un dossier rédigé à la main (contrôlé par les tests). */
  var NOMS = ["Aubry", "Baudouin", "Bazin", "Beaumont", "Bellanger", "Bénard", "Berthelot", "Besnard", "Bigot", "Blot", "Bonneau", "Bouchet", "Boulanger", "Bourdon", "Bouvet", "Brault", "Breton", "Lacour", "Buisson", "Cabanis",
    "Carpentier", "Cassard", "Chabert", "Chapuis", "Charrier", "Chartier", "Chesnais", "Cochet", "Collignon", "Combes", "Cordier", "Couturier", "Daubigny", "Delaunay", "Delattre", "Deschamps", "Desmarais", "Devaux", "Drouet", "Dubreuil",
    "Dufresne", "Dugas", "Dupré", "Durieux", "Escudier", "Fauchon", "Fayolle", "Ferrand", "Foucher", "Fradet", "Gaillot", "Garcin", "Gaspard", "Gendre", "Gilbert", "Godard", "Granger", "Guerrier", "Guichard", "Hardouin",
    "Hébert", "Houdin", "Huet", "Jacquet", "Jouanneau", "Julliard", "Klein", "Lacombe", "Lagrange", "Lambin", "Langlois", "Lebon", "Leclercq", "Lecomte", "Lefort", "Legendre", "Lemaitre", "Lenoir", "Leprince", "Lesage",
    "Letellier", "Maillet", "Mallet", "Marchetti", "Marquet", "Mauger", "Maurel", "Mercadier", "Millet", "Monnier", "Montagne", "Morvan", "Navarro", "Normand", "Olivares", "Pagès", "Paillard", "Parent", "Pelletier", "Gentil",
    "Peyrot", "Pichon", "Pinto", "Prévost", "Quéré", "Ramos", "Raynaud", "Rey", "Riviere", "Roubaud", "Rocher", "Rouault", "Sabatier", "Salmon", "Samson", "Sauvage", "Schmitt", "Seguin", "Tanguy", "Tellier",
    "Texier", "Thibault", "Tixier", "Traoré", "Turpin", "Vaillant", "Valentin", "Varin", "Vasselin", "Verdier", "Vernet", "Vial", "Villard", "Weber", "Yildiz", "Zimmermann", "Benhamou", "Benmoussa", "Bouzid", "Chaabane",
    "Cissé", "Doukouré", "Bouaziz", "Ferhat", "Ghezali", "Hadjadj", "Idrissi", "Jaffar", "Kaddouri", "Lahbabi", "Mansouri", "Nasri", "Ouedraogo", "Pham", "Rahmani", "Saidi", "Tounkara", "Vo", "Zerrouki", "Nowak",
    "Wozniak", "Dąbrowski", "Silva-Marques", "Teixeira", "Carvalho", "Moreira", "Cardoso", "Gonçalves", "Santos", "Almeida", "Rossetti", "Bianchi", "Conti", "Greco", "Moretti", "Demirci", "Kaya", "Özdemir", "Arslan", "Sahin"];

  function tranche(age) { return age < 31 ? "jeune" : age < 56 ? "adulte" : "senior"; }
  function prenomPour(r, f, age) { return r.pick((f ? PRENOMS_F : PRENOMS_M)[tranche(age)]); }
  function nomMajuscule(n) { return n.toUpperCase(); }

  /* Numéro de compte « 00412 375 6621 » */
  function numeroCompte(r) {
    function ch(n) { var s = "", i; for (i = 0; i < n; i++) s += r.n(0, 9); return s; }
    return "00" + r.n(2, 9) + r.n(10, 99) + " " + r.n(100, 999) + " " + ch(4);
  }

  var api = {
    hachage: hachage, rng: rng, r2: r2, eur: eur, eur2: eur2, nb: nb, pl: pl, maj1: maj1, dateLongue: dateLongue, MOIS: MOIS,
    lireYmd: lireYmd, nombreDuJour: nombreDuJour, NOMS: NOMS, PRENOMS_F: PRENOMS_F, PRENOMS_M: PRENOMS_M,
    tranche: tranche, prenomPour: prenomPour, nomMajuscule: nomMajuscule, numeroCompte: numeroCompte
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.quotidienBase = api; }
})(typeof window !== "undefined" ? window : null);
