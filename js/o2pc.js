/* GS Banque & Assurance – O2PC : opportunités commerciales à saisir pendant la séance de proactivité (11 h – 12 h).
   Chaque jour, l'outil propose une dizaine de clients à appeler, repérés à partir de douze thèmes lus dans le portefeuille :
   client devenu majeur, arrivée de fonds exceptionnelle, épargne proche du plafond, compte à terme à échéance, client sans crédit renouvelable, prêt qui se termine,
   client qui n'a qu'un contrat d'IARD, enfant qui va avoir 12 ans, Livret Jeune à clôturer, prêt détenu dans une autre banque, PEA avec beaucoup d'espèces,
   assurance-vie investie seulement en fonds en euros.
   Ce module est pur : il détecte, classe et choisit. L'écran est dans app_o2pc.js ; l'appel se fait dans l'outil « Phoning et prospection » (phoning.js).
   La liste d'un jour ne dépend que de la date et des appels déjà faits les jours précédents : elle reste la même toute la journée, quel que soit le nombre de connexions. */
(function (root) {
  "use strict";

  var B = root && root.SGBF ? root.SGBF.banque : require("./banque.js");
  var PR = root && root.SGBF ? root.SGBF.produits : require("./produits.js");
  var S = root && root.SGBF ? root.SGBF.synthese : require("./synthese.js");
  var E = root && root.SGBF ? root.SGBF.eligibilite : require("./eligibilite.js");
  var K = root && root.SGBF ? root.SGBF.catalogue : require("./catalogue.js");
  var PH = root && root.SGBF ? root.SGBF.phoning : require("./phoning.js");
  var ICC = root && root.SGBF ? root.SGBF.icc : require("./icc.js");
  var CL = root && root.SGBF ? root.SGBF.clients : require("./data_clients.js").clients;

  var TAILLE = 10;                 /* clients proposés chaque jour */
  var PAUSE_JOURS = 14;            /* un client déjà appelé dans les 14 derniers jours n'est pas reproposé */
  var IARD = ["MRH", "AUTO", "MOTO", "CCAR", "VSP", "PJ"];
  var PLAFONDS = { LA: 22950, LDDS: 12000, LEP: 10000, LJ: 1600 };
  var SEUIL_PLAFOND = 0.9;         /* épargne « arrivant à plafond » : au moins 90 % du plafond */
  var FENETRE = { majeur: 180, flux: 50, cat: 45, pret: 60, enfant: 90, lj: 90, ljRetard: 60 };   /* jours */
  var SEUIL_ESPECES = { min: 3000, part: 0.25 };   /* PEA « largement créditeur » : au moins 3 000 € d'espèces et 25 % du PEA */

  function esc(s) { return String(s == null ? "" : s); }
  function pl(n, s, p) { return n + " " + (n > 1 ? p : s); }
  function eur(n) { return B.eur(n); }
  function nomProd(pid) { return PR.parId[pid] ? PR.parId[pid].nom : pid; }
  function il(c) { return c.sexe === "F" ? "elle" : "il"; }
  function Il(c) { return c.sexe === "F" ? "Elle" : "Il"; }
  function jours(n) { return n <= 0 ? "aujourd'hui" : n === 1 ? "demain" : "dans " + n + " jours"; }
  function empreinte(t) { var h = 2166136261; t = String(t); for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function alea(seed, cle) { return (empreinte(seed + "|" + cle) % 100000) / 100000; }
  function ligneLib(c, p) { return PR.parId[p] ? PR.parId[p].nom : p; }

  /* ---------- les douze thèmes ---------- */
  /* base : fondement de l'appel proposé (voir phoning.js) – « contrat » quand l'appel porte sur un contrat en cours, « consentement » sinon.
     urgent : le thème a une date limite (le client perd l'occasion si on attend). */
  var THEMES = [
    { id: "majeur", lib: "Client devenu majeur", court: "Majeur", base: "contrat", urgent: true,
      def: "Client de 18 ans dont l'anniversaire date de moins de 6 mois.",
      argu: "Féliciter le client, faire le point sur son compte, sa carte et son épargne maintenant qu'il est majeur : compte jeune, carte, Livret A, convention de services.",
      pistes: ["JEUNE", "CVJ", "LA", "LJ"] },
    { id: "flux", lib: "Collecte de flux exceptionnel", court: "Arrivée de fonds", base: "consentement", urgent: true,
      def: "Virement exceptionnel reçu depuis moins de 50 jours (succession, vente, capital d'assurance-vie, indemnité), dont une partie peut avoir quitté la banque.",
      argu: "Demander au client s'il a un projet pour ces fonds et lui proposer un entretien : placement, assurance-vie, épargne de précaution. Si une partie est partie vers un autre établissement, comprendre pourquoi.",
      pistes: ["AV", "AVP", "CAT", "LA", "PEA"] },
    { id: "plafond", lib: "Épargne arrivant à plafond", court: "Plafond", base: "contrat", urgent: false,
      def: "Livret A, LDDS, LEP ou Livret Jeune rempli à 90 % du plafond ou plus.",
      argu: "Expliquer que le livret ne pourra bientôt plus recevoir de versements et proposer de diriger l'épargne vers un autre support adapté à son horizon.",
      pistes: { LA: ["LDDS", "AV", "CAT", "PEA", "PER"], LDDS: ["AV", "CAT", "PEA", "PER"], LEP: ["AV", "CAT"], LJ: ["LA"] } },
    { id: "cat", lib: "CAT arrivant à échéance", court: "CAT à échéance", base: "contrat", urgent: true,
      def: "Compte à terme qui arrive à échéance dans les 45 jours.",
      argu: "Prévenir le client que son compte à terme se termine et lui présenter les solutions de réemploi des fonds (nouveau dépôt, assurance-vie, livret) avant que l'argent ne retombe sur le compte courant.",
      pistes: ["AV", "LA", "PEA", "PER", "AVP"] },
    { id: "renouvelable", lib: "Client non détenteur d'un crédit renouvelable", court: "Crédit renouvelable", base: "consentement", urgent: false,
      def: "Client de 25 à 64 ans, revenus domiciliés et stables, bien noté, endettement raisonnable, qui ne détient pas de crédit renouvelable.",
      argu: "Présenter une réserve d'argent pour les dépenses imprévues et fixer un rendez-vous : le crédit se monte dans « Montage de prêt », il ne se conclut pas par téléphone.",
      pistes: ["CCONSO"], credit: true },
    { id: "pret", lib: "Prêt arrivant à échéance dans 2 mois", court: "Prêt qui se termine", base: "contrat", urgent: true,
      def: "Prêt de la banque dont il reste deux échéances ou moins.",
      argu: "Féliciter le client pour le remboursement de son prêt, lui faire remarquer que sa mensualité se libère et l'interroger sur ses projets : épargne régulière ou nouveau financement.",
      pistes: ["AUTZ", "LA", "AV", "PEA"] },
    { id: "iard", lib: "Client ne détenant qu'un produit d'IARD", court: "IARD seul", base: "consentement", urgent: false,
      def: "Client dont le seul contrat d'assurance à la banque est un contrat de dommages (habitation, auto, deux-roues…).",
      argu: "Faire le point sur ses protections : compléter l'assurance de ses biens par une protection de la famille ou une prévoyance.",
      pistes: ["GAV", "PREV", "MRH", "AUTO", "PJ", "DECES"] },
    { id: "enfant", lib: "Enfant arrivant à l'âge de 12 ans", court: "Enfant de 12 ans", base: "consentement", urgent: true,
      def: "Client dont un enfant fête ses 12 ans dans les 90 jours.",
      argu: "À 12 ans, l'enfant peut ouvrir un Livret Jeune. Proposer au parent de préparer l'avenir de son enfant : assurance-vie pour enfant, premier livret.",
      pistes: ["AVE", "LA"] },
    { id: "lj", lib: "Livret Jeune arrivant à échéance", court: "Livret Jeune", base: "contrat", urgent: true,
      def: "Titulaire d'un Livret Jeune qui doit le clôturer au plus tard le 31 décembre de l'année de ses 25 ans.",
      argu: "Rappeler que le Livret Jeune se clôture au plus tard le 31 décembre de l'année des 25 ans et proposer où placer l'épargne : Livret A, LDDS, assurance-vie, PEA Jeunes.",
      pistes: ["LA", "LDDS", "PEAJ", "AV"] },
    { id: "concurrence", lib: "Prêt détenu à la concurrence", court: "Prêt ailleurs", base: "consentement", urgent: false,
      def: "Échéance de prêt prélevée par un autre établissement, repérée sur le relevé ou déclarée par le client.",
      argu: "Proposer d'étudier un rachat : comparer les conditions du moment (taux en vigueur communiqué dans la newsletter) et regrouper les mensualités. Le rendez-vous se prépare dans « Montage de prêt ».",
      pistes: ["CCONSO", "CIMMO"], credit: true },
    { id: "pea", lib: "PEA avec compte espèces largement créditeur", court: "PEA : espèces", base: "contrat", urgent: false,
      def: "PEA dont les espèces non investies atteignent au moins 3 000 € et 25 % de la valeur du plan.",
      argu: "Les espèces d'un PEA ne rapportent rien : demander au client s'il souhaite les investir et proposer un investissement régulier ou un rendez-vous pour choisir les supports.",
      pistes: ["AUTZ", "MGE", "PER"] },
    { id: "av", lib: "Assurance-vie détenue exclusivement en fonds euro", court: "AV en fonds euro", base: "contrat", urgent: false,
      def: "Contrat d'assurance-vie sans aucune unité de compte.",
      argu: "Rappeler que le fonds en euros est sûr mais peu dynamique et proposer de diversifier une partie du contrat, par une gestion pilotée adaptée à son profil.",
      pistes: ["MGE", "MGS", "MGD", "PER"] }
  ];
  var PAR_ID = {}; THEMES.forEach(function (t) { PAR_ID[t.id] = t; });

  /* ---------- aides de lecture ---------- */
  function naissanceEnfant(c, e) {
    /* date de naissance d'un enfant : l'âge est connu, le jour est tiré de façon stable (même enfant, même date) ; l'âge reste celui de l'exercice. */
    var auj = B.aujourdhui(), y = auj.getFullYear(), t = Math.floor(alea(c.id + "|" + e.prenom, "enf-nais") * 365);   /* jours écoulés depuis le dernier anniversaire */
    var dernier = B.plusJours(auj, -t);
    return B.D(dernier.getFullYear() - e.age, dernier.getMonth(), dernier.getDate());
  }
  function prochainAnniv(naiss, age) { return B.D(naiss.getFullYear() + age + 1, naiss.getMonth(), naiss.getDate()); }
  function d0(x) { return x.ouvert ? B.dateOuvrable(x.ouvert) : null; }
  function dernierJourAnnee(y) { return B.D(y, 11, 31); }

  /* ---------- détection : un client, un thème ---------- */
  /* ctx : { auj, st, sans } ; renvoie null ou { score, urgent, motif, details[], produit?(après tri), ref } */
  var DETECTEURS = {
    majeur: function (c, ctx) {
      if (c.age !== 18) return null;
      var naiss = S.naissance(c), an18 = B.D(naiss.getFullYear() + 18, naiss.getMonth(), naiss.getDate()), j = B.ecartJours(ctx.auj, an18);
      if (j < 0 || j > FENETRE.majeur) return null;
      var det = ["Né" + (c.sexe === "F" ? "e" : "") + " le " + B.fmtDate(naiss) + " : a eu 18 ans le " + B.fmtDate(an18) + "."];
      det.push("Compte : " + nomProd(c.cpt.p) + (c.cartes.length ? " ; carte : " + c.cartes.map(function (x) { return ligneLib(c, x.p); }).join(", ") : " ; aucune carte") + ".");
      det.push(c.epa.length ? "Épargne : " + c.epa.map(function (x) { return ligneLib(c, x.p); }).join(", ") + "." : "Aucune épargne à la banque.");
      return { score: 100 - j / 2, urgent: j <= 45, motif: "A eu 18 ans le " + B.fmtDate(an18) + " (il y a " + pl(j, "jour", "jours") + ").", details: det };
    },
    flux: function (c, ctx) {
      var best = null;
      (c.m.ev || []).forEach(function (ev) {
        if (ev.k !== "heritage" || ev.j > FENETRE.flux || ev.j < 0 || (best && best.j < ev.j)) return;
        best = ev;
      });
      if (!best) return null;
      var ext = 0, banques = [], gs = 0;
      best.parts.forEach(function (p) { if (p.k === "EXT" || p.k === "EXT2") { ext += p.m; var m = /Virement émis – (.+?) – compte/.exec(p.lib || ""); if (m && banques.indexOf(m[1]) < 0) banques.push(m[1]); } else gs += p.m; });
      var date = B.dateJours(best.j);
      var det = ["Virement de " + eur(best.m) + " reçu le " + B.fmtDate(date) + " de « " + best.notaire + " » (" + (best.motif || "règlement de succession") + ")."];
      if (gs) det.push(eur(gs) + " sont restés à la banque (assurance-vie, Livret A).");
      if (ext) det.push(eur(ext) + " ont été virés vers " + (banques.length ? banques.join(", ") : "un autre établissement") + ".");
      return { score: 50 + Math.min(40, best.m / 4000) + (ext ? 25 : 0) - best.j / 3, urgent: best.j <= 30, motif: "A reçu " + eur(best.m) + " le " + B.fmtDate(date) + (ext ? ", dont " + eur(ext) + " sont repartis vers une autre banque" : "") + ".", details: det, ref: { montant: best.m, externe: ext } };
    },
    plafond: function (c, ctx) {
      var best = null;
      c.epa.forEach(function (e) {
        var pf = PLAFONDS[e.p]; if (!pf) return;
        var r = e.solde / pf; if (r < SEUIL_PLAFOND) return;
        if (!best || r > best.r) best = { e: e, pf: pf, r: r };
      });
      if (!best) return null;
      var e = best.e, reste = Math.max(0, best.pf - e.solde), det = [nomProd(e.p) + " : " + eur(e.solde) + " pour un plafond de " + eur(best.pf) + " (" + Math.round(best.r * 100) + " %), il reste " + eur(reste) + " de capacité."];
      var mois = null;
      if (e.vm) { mois = reste <= 0 ? 0 : Math.ceil(reste / e.vm); det.push("Virement permanent de " + eur(e.vm) + " le " + e.jv + " de chaque mois : plafond atteint dans " + (mois <= 0 ? "l'immédiat" : pl(mois, "mois", "mois")) + "."); }
      return { score: 40 + best.r * 40 - (mois != null ? Math.min(mois, 12) : 6), urgent: mois != null && mois <= 3, motif: nomProd(e.p) + " rempli à " + Math.round(best.r * 100) + " % du plafond" + (mois != null ? " (plafond atteint " + (mois <= 0 ? "maintenant" : "dans " + pl(mois, "mois", "mois")) + ")" : "") + ".", details: det, ref: { produit: e.p } };
    },
    cat: function (c, ctx) {
      var best = null;
      c.epa.forEach(function (e) { if (e.p === "CAT" && e.dans <= FENETRE.cat && e.dans >= 0 && (!best || e.dans < best.dans)) best = e; });
      if (!best) return null;
      var ech = B.plusJours(ctx.auj, best.dans);
      var det = ["Compte à terme de " + eur(best.solde) + " sur " + (best.dur % 12 === 0 ? (best.dur / 12) + (best.dur === 12 ? " an" : " ans") : best.dur + " mois") + " au taux de " + String(best.taux).replace(".", ",") + " %."];
      det.push("Échéance le " + B.fmtDate(ech) + " (" + jours(best.dans) + ") : les fonds seront reversés sur le compte courant sauf instruction contraire.");
      return { score: 60 + best.solde / 2000 - best.dans, urgent: best.dans <= 20, motif: "Compte à terme de " + eur(best.solde) + " qui arrive à échéance le " + B.fmtDate(ech) + " (" + jours(best.dans) + ").", details: det, ref: { montant: best.solde } };
    },
    renouvelable: function (c, ctx) {
      if (c.age < 25 || c.age > 64 || c.cpt.p === "OCF") return null;
      var rev = E.revenusDomicilies(c); if (rev < 1800) return null;
      if (["salarie", "fonctionnaire", "retraite"].indexOf(c.pro.statut) < 0) return null;
      if (c.pro.statut === "salarie" && c.pro.ctr && c.pro.ctr !== "CDI") return null;
      var gs = c.cre.filter(function (x) { return !x.ext; });
      if (gs.some(function (x) { return x.p === "CCONSO"; })) return null;     /* déjà un crédit à la consommation en cours */
      var taux = E.tauxEndettement(c); if (taux > 30) return null;
      if (S.alertes(c).some(function (a) { return a.code === "DEBITEUR"; })) return null;
      var det = ["Revenus domiciliés : " + eur(rev) + " par mois (" + (c.pro.statut === "retraite" ? "pension" : c.pro.ctr || "salaire") + ").", "Taux d'endettement actuel : " + String(Math.round(taux * 10) / 10).replace(".", ",") + " % (limite de 35 %).", "Aucun crédit renouvelable à la banque."];
      return { score: 20 + Math.min(25, rev / 200) - taux / 2, urgent: false, motif: "Revenus stables de " + eur(rev) + " par mois, endettement de " + String(Math.round(taux)).replace(".", ",") + " %, aucun crédit renouvelable.", details: det, ref: { revenus: rev } };
    },
    pret: function (c, ctx) {
      var best = null;
      c.cre.forEach(function (x) {
        if (x.ext) return;
        var reste = S.echeancesRestantes(x); if (reste < 1 || reste > 2) return;
        if (!best || reste < best.reste) best = { x: x, reste: reste };
      });
      if (!best) return null;
      var x = best.x, k0 = B.indexMois(B.dateJours(x.ouvert)) + 1, fin = B.dateDuMois(k0 + x.dur - 1, x.jEch);
      var det = [nomProd(x.p) + " de " + eur(x.cap) + " sur " + pl(x.dur, "mois", "mois") + " : plus que " + pl(best.reste, "échéance", "échéances") + " de " + B.eur2(x.mens) + ".", "Dernière échéance le " + B.fmtDate(fin) + ", soit " + B.eur2(x.mens) + " de mensualité libérés chaque mois."];
      return { score: 55 + x.mens / 40 - best.reste * 3, urgent: true, motif: nomProd(x.p) + " : dernière échéance le " + B.fmtDate(fin) + " (" + pl(best.reste, "échéance restante", "échéances restantes") + ").", details: det, ref: { mensualite: x.mens } };
    },
    iard: function (c, ctx) {
      if (c.ass.length !== 1 || IARD.indexOf(c.ass[0].p) < 0) return null;
      var a = c.ass[0];
      var det = ["Seul contrat d'assurance à la banque : " + nomProd(a.p) + " (prime de " + B.eur2(a.prime) + " par mois).", "Aucune protection des personnes (famille, prévoyance, décès) à la banque."];
      return { score: 30 + (c.age >= 30 && c.age <= 60 ? 10 : 0) + (c.fam.enf && c.fam.enf.length ? 8 : 0) + Math.min(10, E.revenusDomicilies(c) / 500), urgent: false, motif: "Un seul contrat d'IARD : " + nomProd(a.p) + ".", details: det, ref: { contrat: a.p } };
    },
    enfant: function (c, ctx) {
      var best = null;
      (c.fam.enf || []).forEach(function (e) {
        if (e.age !== 11) return;
        var naiss = naissanceEnfant(c, e), an = prochainAnniv(naiss, 11), j = B.ecartJours(an, ctx.auj);
        if (j < 0 || j > FENETRE.enfant) return;
        if (!best || j < best.j) best = { e: e, an: an, j: j };
      });
      if (!best) return null;
      var det = [best.e.prenom + " aura 12 ans le " + B.fmtDate(best.an) + " (" + jours(best.j) + ") : il peut alors ouvrir un Livret Jeune."];
      det.push(c.plc.some(function (p) { return p.p === "AVE"; }) ? "Un contrat GS Vie Enfant existe déjà pour l'un de ses enfants." : "Aucun contrat d'épargne n'est ouvert à son nom à la banque.");
      return { score: 45 + (90 - best.j) / 3, urgent: best.j <= 30, motif: best.e.prenom + " fête ses 12 ans le " + B.fmtDate(best.an) + " (" + jours(best.j) + ").", details: det, ref: { enfant: best.e.prenom } };
    },
    lj: function (c, ctx) {
      var lj = c.epa.filter(function (e) { return e.p === "LJ"; })[0];
      if (!lj || c.age < 24) return null;
      var naiss = S.naissance(c), an25 = B.D(naiss.getFullYear() + 25, naiss.getMonth(), naiss.getDate()), limite = dernierJourAnnee(an25.getFullYear());
      var j = B.ecartJours(limite, ctx.auj);
      if (j > FENETRE.lj || j < -FENETRE.ljRetard) return null;       /* plus de deux mois de retard : le livret est supposé déjà traité */
      var det = ["Livret Jeune de " + eur(lj.solde) + ". A (ou aura) 25 ans le " + B.fmtDate(an25) + "."];
      det.push(j >= 0 ? "Clôture obligatoire au plus tard le " + B.fmtDate(limite) + " (" + jours(j) + ")." : "Date limite de clôture dépassée depuis le " + B.fmtDate(limite) + " : le livret doit être clôturé sans attendre.");
      return { score: 70 - Math.max(0, j) / 3 + (j < 0 ? 20 : 0), urgent: j <= 45, motif: j >= 0 ? "Livret Jeune à clôturer avant le " + B.fmtDate(limite) + " (" + jours(j) + ")." : "Livret Jeune toujours ouvert après la date limite du " + B.fmtDate(limite) + ".", details: det, ref: { montant: lj.solde } };
    },
    concurrence: function (c, ctx) {
      var ext = c.cre.filter(function (x) { return x.ext; })[0] || null, pre = c.m.extCre && c.m.extCre[0] || null;
      if (!ext && !pre) return null;
      if (S.alertes(c).some(function (a) { return a.code === "DEBITEUR"; })) return null;
      var det = [];
      if (ext) det.push("Crédit détenu chez « " + ext.ext + " » (" + nomProd(ext.p) + ") : mensualité de " + B.eur2(ext.mens) + ", taux de " + String(ext.taux).replace(".", ",") + " %, " + pl(Math.max(0, ext.dur - B.echeancesPayees(ext)), "échéance restante", "échéances restantes") + ".");
      if (pre) det.push("Sur le relevé de compte : prélèvement de " + B.eur2(pre.mens) + " par mois au profit de « " + pre.etab + " » (" + (pre.objet || "prêt").toLowerCase() + ", taux de " + String(pre.taux).replace(".", ",") + " %).");
      var mens = ext ? ext.mens : pre.mens, taux = ext ? ext.taux : pre.taux, etab = ext ? ext.ext : pre.etab;
      return { score: 25 + Math.min(20, mens / 30) + Math.min(15, Math.max(0, taux - 4) * 4), urgent: false, motif: "Échéance de " + B.eur2(mens) + " par mois prélevée par " + etab + " (taux de " + String(taux).replace(".", ",") + " %).", details: det, ref: { mensualite: mens, hypotheque: ext && ext.p === "CIMMO" } };
    },
    pea: function (c, ctx) {
      var best = null;
      c.plc.forEach(function (p) {
        if (["PEA", "PEAJ", "PEAPME"].indexOf(p.p) < 0 || p.esp == null) return;
        if (p.esp >= SEUIL_ESPECES.min && p.esp / p.solde >= SEUIL_ESPECES.part && (!best || p.esp > best.esp)) best = p;
      });
      if (!best) return null;
      var part = Math.round(100 * best.esp / best.solde);
      return { score: 35 + Math.min(30, best.esp / 700) + part / 4, urgent: false, motif: "Espèces non investies de " + eur(best.esp) + " sur un PEA de " + eur(best.solde) + " (" + part + " %).", details: [nomProd(best.p) + " : " + eur(best.solde) + " au total, dont " + eur(best.esp) + " en espèces (" + part + " %) et " + eur(best.solde - best.esp) + " investis en titres."], ref: { montant: best.esp } };
    },
    av: function (c, ctx) {
      var best = null;
      c.plc.forEach(function (p) { if ((p.p === "AV" || p.p === "AVP") && p.uc === 0 && (!best || p.solde > best.solde)) best = p; });
      if (!best) return null;
      return { score: 30 + Math.min(35, best.solde / 2500) + (c.age <= 55 ? 8 : 0), urgent: false, motif: nomProd(best.p) + " de " + eur(best.solde) + " investie à 100 % en fonds en euros.", details: [nomProd(best.p) + " ouvert le " + B.fmtDate(B.dateOuvrable(best.ouvert)) + " : " + eur(best.solde) + ", aucune unité de compte."], ref: { montant: best.solde } };
    }
  };

  /* ---------- produit à proposer ---------- */
  /* Premier produit de la liste que le client peut encore souscrire (ni détenu, ni inéligible), selon l'état du jour. */
  function choisirProduit(c, st, theme, ref) {
    var l = theme.pistes;
    if (!Array.isArray(l)) l = (ref && ref.produit && l[ref.produit]) || [];
    for (var i = 0; i < l.length; i++) {
      var p = PR.parId[l[i]]; if (!p) continue;
      if (p.famille === "credit") { if (!theme.credit) continue; return theme.id === "concurrence" ? (ref && ref.hypotheque ? "CIMMO" : "CCONSO") : p.id; }
      if (!K.prospectionPossible(p)) continue;
      var v = K.verdictClient(c, p.id, st).verdict;
      if (v === "eligible" || v === "examiner") return p.id;
    }
    return "";
  }
  /* Texte de lien avec le contrat, pour l'exception au démarchage (voir phoning.js) : rempli à l'avance quand l'appel porte sur un contrat en cours. */
  function lienContrat(theme, d) {
    var m = { majeur: "Le client vient d'avoir 18 ans : adaptation de son compte et de ses moyens de paiement à sa majorité.", plafond: "Épargne proche du plafond du livret détenu : proposer un placement complémentaire.",
      cat: "Compte à terme détenu qui arrive à échéance : réemploi des fonds.", pret: "Prêt détenu qui se termine : utilisation de la mensualité libérée.", lj: "Livret Jeune détenu à clôturer : réemploi de l'épargne.",
      pea: "PEA détenu avec des espèces non investies : proposer de les investir.", av: "Assurance-vie détenue en fonds en euros : proposer une diversification." };
    return m[theme.id] || "";
  }

  /* ---------- toutes les opportunités du jour ---------- */
  function dernierAppel(st, cid) {
    var l = (st && Array.isArray(st.appels) ? st.appels : []).filter(function (a) { return a.c === cid; }).sort(function (x, y) { return x.date + x.heure < y.date + y.heure ? 1 : -1; });
    return l[0] || null;
  }
  /* Détection brute : { themeId: [ { c, d } ] } pour les clients appelables aujourd'hui. */
  function detecter(st, auj) {
    var ctx = { auj: auj, st: st }, ymd = B.ymd(auj), res = {};
    THEMES.forEach(function (t) { res[t.id] = []; });
    CL.forEach(function (c) {
      var ap = dernierAppel(st, c.id);
      if (ap && ap.date < ymd && B.ecartJours(auj, B.lireYmd(ap.date)) < PAUSE_JOURS) return;       /* appelé récemment */
      var stop = (st && Array.isArray(st.appels) ? st.appels : []).filter(function (a) { return a.c === c.id && a.res === "stop" && a.date < ymd; });
      if (stop.length) return;                                                                         /* a demandé à ne plus être appelé (un « stop » d'aujourd'hui reste affiché, avec son état) */
      THEMES.forEach(function (t) {
        var d = DETECTEURS[t.id](c, ctx);
        if (d) res[t.id].push({ c: c, d: d });
      });
    });
    return res;
  }

  /* Liste du jour : au plus TAILLE clients, un seul thème par client, des thèmes variés. */
  function liste(st, auj) {
    auj = auj || B.aujourdhui();
    var ymd = B.ymd(auj), brut = detecter(st, auj), pool = {}, tri = {}, pris = {}, items = [];
    THEMES.forEach(function (t) {
      pool[t.id] = brut[t.id].length;
      tri[t.id] = brut[t.id].slice().sort(function (a, b) { return (b.d.score + 6 * alea(ymd, b.c.id + t.id)) - (a.d.score + 6 * alea(ymd, a.c.id + t.id)); });
    });
    function prendre(t) {
      var l = tri[t.id];
      while (l.length) { var x = l.shift(); if (pris[x.c.id]) continue; pris[x.c.id] = true; return { t: t, x: x }; }
      return null;
    }
    function ajouter(p) {
      if (!p || items.length >= TAILLE) return false;
      items.push(p); return true;
    }
    /* 1) un client par thème ayant une opportunité qui ne peut pas attendre, 2) un client par thème, dans un ordre qui change chaque jour, 3) le reste, à tour de rôle */
    var ordre = THEMES.slice().sort(function (a, b) { return alea(ymd, a.id) - alea(ymd, b.id); });
    ordre.forEach(function (t) { if (items.length < TAILLE && tri[t.id].some(function (x) { return x.d.urgent && !pris[x.c.id]; })) { var u = tri[t.id].filter(function (x) { return x.d.urgent && !pris[x.c.id]; })[0]; tri[t.id].splice(tri[t.id].indexOf(u), 1); pris[u.c.id] = true; ajouter({ t: t, x: u }); } });
    ordre.forEach(function (t) { if (items.length < TAILLE) ajouter(prendre(t)); });
    var restant = true;
    while (items.length < TAILLE && restant) {
      restant = false;
      ordre.forEach(function (t) { if (items.length < TAILLE) { var p = prendre(t); if (p) { ajouter(p); restant = true; } } });
    }
    /* présentation : tri par score décroissant, puis résolution du produit et de l'appel du jour */
    items.sort(function (a, b) { return b.x.d.score - a.x.d.score || a.x.c.id - b.x.c.id; });
    var sortie = items.map(function (p, i) {
      var c = p.x.c, d = p.x.d, cc = K.contexte(c, st), t = p.t;
      var autres = THEMES.filter(function (u) { return u.id !== t.id && brut[u.id].some(function (y) { return y.c.id === c.id; }); }).map(function (u) { return u.id; });
      var prod = choisirProduit(cc, st, t, d.ref);
      var today = (st && Array.isArray(st.appels) ? st.appels : []).filter(function (a) { return a.c === c.id && a.date === ymd; }).sort(function (x, y) { return x.heure < y.heure ? 1 : -1; });
      var sit = PH.situation(st, c.id);
      return { rang: i + 1, client: c, theme: t.id, themeLib: t.lib, score: Math.round(d.score), urgent: !!d.urgent, motif: d.motif, details: d.details, produit: prod, base: t.base, lien: t.base === "contrat" ? lienContrat(t, d) : "",
        autres: autres, icc: ICC.depuisClient(c, st), appel: today[0] || null, quota: sit.quota, stop: sit.stop };
    });
    return { ymd: ymd, taille: TAILLE, items: sortie, pool: pool, total: sortie.length };
  }

  /* L'opportunité d'un thème pour un client donné (fiche d'appel ouverte depuis la liste) : null si elle n'existe plus. */
  var PAR_CLIENT = null;
  function opportunite(st, cid, themeId, auj) {
    var t = PAR_ID[themeId]; if (!t) return null;
    if (!PAR_CLIENT) { PAR_CLIENT = {}; CL.forEach(function (c) { PAR_CLIENT[c.id] = c; }); }
    var c = PAR_CLIENT[cid]; if (!c) return null;
    var d = DETECTEURS[themeId](c, { auj: auj || B.aujourdhui(), st: st });
    return d ? { theme: t, motif: d.motif, details: d.details, urgent: !!d.urgent, ref: d.ref || null } : null;
  }

  /* Avancement pour l'écran « À traiter » : clients de la liste du jour déjà appelés (tentative sans réponse comprise). */
  function avancement(st, auj) {
    var l = liste(st, auj), faits = l.items.filter(function (x) { return !!x.appel; }).length;
    return { total: l.total, faits: faits, reste: l.total - faits, ymd: l.ymd };
  }

  var api = {
    TAILLE: TAILLE, PAUSE_JOURS: PAUSE_JOURS, FENETRE: FENETRE, PLAFONDS: PLAFONDS, SEUIL_PLAFOND: SEUIL_PLAFOND, SEUIL_ESPECES: SEUIL_ESPECES, IARD: IARD,
    THEMES: THEMES, PAR_ID: PAR_ID, DETECTEURS: DETECTEURS, detecter: detecter, liste: liste, opportunite: opportunite, avancement: avancement, choisirProduit: choisirProduit, lienContrat: lienContrat, naissanceEnfant: naissanceEnfant, dernierAppel: dernierAppel
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.o2pc = api; }
})(typeof window !== "undefined" ? window : null);
