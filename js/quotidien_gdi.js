/* GS Banque & Assurance – dossiers « du jour » (gestion des incidents) : fabrique les comptes à l'état débiteur depuis 15, 30, 60 ou 90 jours.
   incidents(AAAA-MM-JJ) renvoie 5 à 14 dossiers (même liste pour toute la classe ce jour-là) : environ un quart de dossiers de référence (data_incidents.js),
   les autres fabriqués à partir de neuf scénarios (salaire à venir, épargne disponible, somme à recevoir, aide d'un proche, opportunité de crédit,
   difficultés durables, client fragile, injoignable, refus). Le palier (15, 30, 60, 90 jours) et le scénario déterminent ce que le client dit, les
   ressources réelles, la décision attendue et le courrier attendu. Chaque dossier est contrôlé ; un tirage qui ne convient pas est écarté. Fonctions pures. */
(function (root) {
  "use strict";

  var Q = root && root.SGBF && root.SGBF.quotidienBase ? root.SGBF.quotidienBase : require("./quotidien_base.js");
  var P = root && root.SGBF && root.SGBF.quotidienPools ? root.SGBF.quotidienPools : require("./quotidien_pools.js");
  var REL = root && root.SGBF && root.SGBF.quotidienGdiReleve ? root.SGBF.quotidienGdiReleve : require("./quotidien_gdi_releve.js");
  var G = root && root.SGBF && root.SGBF.gdi ? root.SGBF.gdi : require("./rules_incidents.js");
  var eur = Q.eur, r2 = Q.r2;

  var PART_REFERENCE = 0.25;
  var PALIERS = [15, 30, 60, 90];
  var POIDS_PALIER = [[15, 35], [30, 30], [60, 20], [90, 15]];

  /* Scénarios : poids par palier (0 ou absent : le scénario n'existe pas à ce palier). */
  var SC = {
    salaire:     { w: { 15: 6, 30: 2 }, plan: true },
    epargne:     { w: { 15: 4, 30: 3 }, plan: true },
    creance:     { w: { 15: 3, 30: 3, 60: 3 }, plan: true },
    proche:      { w: { 15: 2, 30: 2, 60: 1 }, plan: true },
    credit:      { w: { 15: 2, 30: 4, 60: 3 }, plan: true },
    difficultes: { w: { 15: 1, 30: 3, 60: 5, 90: 5 }, plan: false },
    fragile:     { w: { 30: 1, 60: 3, 90: 1 }, plan: false },
    injoignable: { w: { 15: 1, 30: 2, 60: 3, 90: 4 }, plan: false },
    refus:       { w: { 60: 1, 90: 4 }, plan: false }
  };
  var ORDRE = Object.keys(SC);

  /* Dépassement final (au-delà de l'autorisation) tiré selon le palier : [min, max]. */
  var DEP = { 15: [60, 700], 30: [150, 1300], 60: [400, 2200], 90: [700, 3600] };

  var CONTRAINTES = {
    salaire: { st: ["salarie"], rev: [1500, 3400], age: [24, 58] },
    epargne: { st: ["salarie", "retraite"], rev: [1500, 3500], age: [28, 78] },
    creance: { st: ["salarie", "retraite", "cdd"], rev: [1200, 3000], age: [24, 78] },
    proche: { st: ["alternance", "cdd", "salarie", "retraite"], rev: [800, 1700], age: [18, 80] },
    credit: { st: ["salarie"], rev: [1900, 3800], age: [28, 58] },
    difficultes: { st: ["chomage", "cdd", "salarie"], rev: [800, 1500], age: [24, 60] },
    fragile: { st: ["chomage", "salarie", "cdd"], rev: [800, 1300], age: [24, 62] },
    injoignable: { st: ["salarie", "cdd", "chomage", "alternance", "retraite"], rev: [900, 2600], age: [20, 78] },
    refus: { st: ["salarie", "cdd", "retraite"], rev: [1100, 2600], age: [28, 70] }
  };

  var RUES = [["rue de Charonne", "75011"], ["rue Oberkampf", "75011"], ["avenue Daumesnil", "75012"], ["rue de Tolbiac", "75013"], ["rue Daguerre", "75014"], ["rue de la Convention", "75015"],
    ["rue Legendre", "75017"], ["rue Ordener", "75018"], ["rue de Crimée", "75019"], ["rue des Pyrénées", "75020"], ["boulevard de Magenta", "75010"], ["rue des Martyrs", "75009"]];

  function sansAccent(s) { return String(s).normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function titre(n) { return String(n).toLowerCase().replace(/(^|[ -])([a-zà-ÿ])/g, function (m, a, b) { return a + b.toUpperCase(); }); }
  function civNom(c) { return c.civilite + " " + titre(c.nom); }
  function il(c) { return c.civilite === "Mme" ? "elle" : "il"; }
  function ceil500(x) { return Math.ceil(x / 500) * 500; }
  function arrondi10(x) { return Math.round(x / 10) * 10; }
  function pasPlus(x, pas) { return Math.ceil(x / pas) * pas; }

  /* ---------- profil du client (même méthode que les dossiers « débiteurs ») ---------- */
  function situation(r, age, f, st) {
    var e = f ? "e" : "";
    if (st === "alternance" || age < 24) return r.chance(0.9) ? "Célibataire" : "En couple";
    if (st === "retraite" && age >= 72 && r.chance(0.4)) return f ? "Veuve" : "Veuf";
    if (age < 40) return r.poids([["Célibataire", 3], ["Marié" + e + ", 1 enfant", 2], ["Marié" + e + ", 2 enfants", 2], ["Pacsé" + e, 1], ["Célibataire, 1 enfant", 1]]);
    return r.poids([["Célibataire", 2], ["Marié" + e, 2], ["Marié" + e + ", 2 enfants", 3], ["Divorcé" + e + ", 1 enfant", 2], ["Marié" + e + ", 3 enfants", 1], [f ? "Veuve" : "Veuf", age > 60 ? 1 : 0]]);
  }
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
  var CAT = { loyer: P.PRELEV_LOYER, energie: P.PRELEV_ENERGIE, tel: P.PRELEV_TEL, assur: P.PRELEV_ASSUR, divers: P.PRELEV_DIVERS };
  function prelev(r, kind, rev) {
    var t = r.pick(CAT[kind]), lo = t[2], hi = t[3], m;
    if (kind === "loyer") { lo = Math.max(380, Math.round(rev * 0.22 / 10) * 10); hi = Math.max(lo + 60, Math.round(rev * 0.4 / 10) * 10); m = r.pas(lo, hi, 5); }
    else m = Math.round((lo + r.f() * (hi - lo)) * 100) / 100;
    return { m: r2(m), lib: t[0], mandat: t[1] + "-" + r.n(10000, 99999), kind: kind };
  }

  /* ---------- paramètres du scénario ---------- */
  function autorisation(r, sc, c) {
    if (c.dac) return 0;
    if (sc === "credit") return r.pas(200, 800, 100);
    if (sc === "fragile") return r.pick([0, 0, 100, 200]);
    var plafond = Math.min(1200, Math.round(c.revenus * 0.3 / 100) * 100);
    return r.chance(0.4) ? 0 : Math.max(100, Math.min(plafond, r.pas(200, 800, 100)));
  }
  function depassement(r, sc, palier, c, aut) {
    var lim = DEP[palier], lo = lim[0], hi = lim[1];
    if (sc === "salaire") hi = Math.min(hi, Math.floor((c.revenus * 0.8 - aut) / 10) * 10);
    if (sc === "proche") hi = Math.min(hi, 1100);
    if (sc === "credit") { lo = Math.max(lo, 600); hi = Math.max(hi, 900); if (palier === 15) hi = Math.min(hi, 1500); }
    if (hi < lo) return null;
    return r.pas(lo, hi, 10);
  }

  /* ---------- contact : messages quand le client ne répond pas ---------- */
  var SANS_REPONSE = {
    mobile: "Le mobile sonne dans le vide, puis la messagerie : message laissé, pas de rappel.",
    fixe: "Personne ne répond sur la ligne fixe.",
    sms: "SMS envoyé et délivré : pas de réponse.",
    email: "E-mail envoyé : aucune réponse, aucun accusé de lecture.",
    courrier: "Courrier simple posté : le client ne pourra pas répondre aujourd'hui.",
    agence: "Convocation envoyée : le client ne s'est pas présenté au rendez-vous proposé."
  };

  /* ---------- textes selon le scénario ---------- */
  function causeDifficulte(r, c) {
    var e = c.civilite === "Mme" ? "e" : "";
    return r.pick([
      { echange: "J'ai perdu mon emploi à la fin de ma période d'essai. Mes droits au chômage sont en cours d'étude : je n'ai rien reçu depuis deux mois.", pro: "Sans emploi, droits au chômage en cours d'étude, aucun versement depuis deux mois" },
      { echange: "Je suis en arrêt maladie depuis plusieurs semaines. Les indemnités journalières n'ont pas encore été versées et mes charges n'ont pas changé.", pro: "Arrêt maladie, indemnités journalières non encore versées" },
      { echange: "Mon contrat s'est terminé et mes allocations ne sont pas encore versées. Je n'ai aucune rentrée avant plusieurs semaines.", pro: "Fin de contrat, allocations pas encore versées" },
      { echange: "Je me suis séparé" + e + " et je supporte seul" + e + " le loyer et les charges du logement. Je n'ai pas les moyens de rembourser pour l'instant.", pro: "Séparation récente, charges du foyer assumées seul" + e }
    ]);
  }
  var CREANCES = [
    "le remboursement de ma mutuelle", "mon remboursement d'impôt", "l'indemnité de mon assureur après un dégât des eaux",
    "le règlement de la vente de ma voiture", "mon solde de tout compte", "le remboursement d'un voyage annulé"
  ];
  var EMPLOYEURS_PRECEDENTS = ["l'ancien employeur", "mon ancienne entreprise"];

  /* Fabrique le dossier ; renvoie null si le tirage ne convient pas. */
  function tirer(r, palier, sc) {
    var cons = CONTRAINTES[sc], pf = profil(r, cons);
    if (!pf) return null;
    var c = pf.client, rev = c.revenus, f = pf.f, fragile = sc === "fragile";
    var plan = SC[sc].plan, ville = r.pick(P.VILLES);
    if (fragile) c.fragile = true;
    var aut = autorisation(r, sc, c);
    var dep = fragile ? null : depassement(r, sc, palier, c, aut);
    if (!fragile && dep == null) return null;

    /* ----- produits ----- */
    var carte = c.fragile ? "Carte à autorisation systématique" : (pf.prof.st === "alternance" || c.age < 23) ? "Carte Visa à débit immédiat" : rev >= 3300 ? "Carte Visa Premier" : "Carte Visa Classic";
    var prod = c.fragile ? ["Compte courant", "Offre clientèle fragile (OCF)", carte] : ["Compte courant", carte];
    if (aut > 0) prod.push("Autorisation de découvert de " + eur(aut));
    c.produits = prod;

    /* ----- coordonnées ----- */
    var rue = r.pick(RUES), xx = r.n(10, 99) + " " + r.n(10, 99), fixe = r.chance(0.5);
    c.coordonnees = {
      mobile: "06 39 98 " + xx, telephone: fixe ? "01 99 00 " + xx : null,
      email: sansAccent(c.prenom).toLowerCase() + "." + sansAccent(c.nom).toLowerCase().replace(/\s+/g, "-") + "@example.com",
      adresse: r.n(1, 64) + " " + rue[0] + ", " + rue[1] + " Paris"
    };

    /* ----- prélèvements actifs ----- */
    var kinds = r.melange(["loyer", "energie", "tel", "assur", "divers"]), nPrel = r.n(2, 4), prelevs = [], vus = {}, k;
    for (k = 0; k < kinds.length && prelevs.length < nPrel; k++) {
      var p = prelev(r, kinds[k], rev);
      if (vus[p.lib] || p.m > 0.6 * rev) continue;
      vus[p.lib] = 1; prelevs.push({ lib: p.lib, m: p.m, mandat: p.mandat });
    }
    if (prelevs.length < 2) return null;
    /* client fragile : son débit vient de l'échéance de son crédit, prélevée par la banque */
    var credit = null;
    if (fragile) {
      var cr = r.pick(P.PRELEV_CREDIT);
      credit = { lib: cr[0].replace(/ – mensualité$/, ""), m: r.pas(cr[2], cr[3], 5), mandat: cr[1] + "-" + r.n(10000, 99999) };
      c.produits.push("Crédit à la consommation GS (échéance de " + eur(credit.m) + " par mois)");
    }

    /* ----- relevé ----- */
    var n = null, salaireLedger = null;
    if (sc === "salaire") { n = palier === 15 ? r.n(4, 12) : r.n(3, 14); if (palier === 15) salaireLedger = { montant: rev, ago: 30 - n, lib: "Virement salaire" }; }
    var rel2 = null, essai;
    for (essai = 0; essai < 60 && !rel2; essai++) {
      var rr = Q.rng(r.n(0, 1e9) + "|rel" + essai);
      rel2 = REL.construire(rr, { jd: palier, aut: aut, dep: dep, salaire: salaireLedger, prelevs: prelevs, fragile: fragile, credit: credit, ville: ville });
    }
    if (!rel2) return null;
    var solde = rel2.solde, besoin = r2(-solde);
    dep = rel2.dep;
    var prelevements = prelevs.map(function (p, i) { return { id: "p" + (i + 1), libelle: p.lib + " (mandat " + p.mandat + ")", montant: p.m }; });

    /* ----- ressources et moyens réels ----- */
    var reels = {}, ressources = { revenuDomicilie: false, salaire: null, epargne: [], credits: [], notes: [] };
    var echange = [], maj = [], canaux = ["mobile", "sms", "email", "agence"].concat(fixe ? ["fixe"] : []);
    var nc = civNom(c);
    if (credit) ressources.credits.push({ libelle: credit.lib + " (crédit à la consommation GS)", mensualite: credit.m });
    c.revenusNote = "revenus non domiciliés (aucun versement régulier sur ce compte)";
    if (sc === "salaire") c.revenusNote = palier === 15 ? "salaire domicilié" : "nouvel employeur, premier salaire à venir";
    if (sc === "difficultes" || sc === "fragile") c.revenusNote = "revenus interrompus, aucun versement régulier sur ce compte";
    var ouverture = "Vous : « Bonjour " + nc + ", votre compte présente un solde débiteur de " + eur(besoin) + " depuis " + palier + " jours. Pouvons-nous trouver ensemble une solution pour le régulariser ? »";

    if (sc === "salaire") {
      if (palier === 15) {
        ressources.revenuDomicilie = true;
        ressources.salaire = { montant: rev, dans: n };
        echange = [ouverture, nc + " : « " + r.pick(["Oui, je l'ai vu. Mon salaire de " + eur(rev) + " est versé le {+" + n + "} : le compte sera de nouveau créditeur ce jour-là. J'ai eu un mois chargé avec les frais de rentrée.", "Je sais, j'ai eu des dépenses imprévues ce mois-ci. Ma paie de " + eur(rev) + " arrive le {+" + n + "}, c'est la date habituelle de virement de mon employeur."]) + " »", "Vous : « Je note le virement du {+" + n + "} sur ce compte. »"];
        maj = [{ rubrique: "Revenus", texte: "Salaire net de " + eur(rev) + " domicilié sur ce compte, prochain versement le {+" + n + "}" }];
      } else {
        ressources.revenuDomicilie = false;
        ressources.salaire = { montant: rev, dans: n, nouveau: true };
        echange = [ouverture, nc + " : « J'ai changé d'employeur le mois dernier. Mon premier salaire, " + eur(rev) + ", arrive le {+" + n + "}. " + r.pick(EMPLOYEURS_PRECEDENTS).replace(/^./, function (x) { return x.toUpperCase(); }) + " a tardé à me verser mon solde de tout compte et je me suis retrouvé" + (f ? "e" : "") + " à découvert. »", "Vous : « Je note le virement du {+" + n + "} sur ce compte. »"];
        maj = [{ rubrique: "Situation professionnelle", texte: "Nouvel employeur depuis le mois dernier" }, { rubrique: "Revenus", texte: "Premier salaire de " + eur(rev) + " attendu le {+" + n + "}, domicilié sur ce compte" }];
        c.professionnel = "Nouvel employeur depuis le mois dernier";
      }
      reels.salaire = { montant: rev, delai: G.delaiPour(n) };
    } else if (sc === "epargne") {
      var liv = r2(besoin + r.pas(50, 1200, 50)), d0 = r.pick([0, 0, 3]);
      ressources.epargne.push({ produit: "Livret A", solde: liv });
      echange = [ouverture, nc + " : « " + r.pick(["Je n'avais pas vu que j'étais à découvert ! J'ai de quoi couvrir sur mon Livret A, je fais le virement " + (d0 ? "d'ici trois jours" : "aujourd'hui") + ".", "Je pensais que mon compte était approvisionné. Je vire depuis mon Livret A " + (d0 ? "d'ici trois jours" : "aujourd'hui") + "."]) + " »"];
      maj = [{ rubrique: "Épargne", texte: "Livret A à GS Banque & Assurance : " + eur(liv) + " disponibles" }];
      reels.virement_epargne = { montant: liv, delai: d0 };
    } else if (sc === "creance") {
      var lib = r.pick(CREANCES), mC = pasPlus(besoin + r.pas(0, 600, 50), 10);
      n = palier === 15 ? r.n(3, 12) : palier === 30 ? r.n(5, 25) : r.n(8, 28);
      echange = [ouverture, nc + " : « J'attends " + lib + " : " + eur(mC) + ", qui doit être versé d'ici " + n + " jours. " + r.pick(["Je vous apporterai le chèque dès réception.", "Je l'ai fait virer sur ce compte."]) + " »", "Vous : « Je note la somme et le délai annoncés. »"];
      maj = [{ rubrique: "Somme à recevoir", texte: lib.replace(/^(le|la|l'|mon|ma)\s?/, "").replace(/^./, function (x) { return x.toUpperCase(); }) + " : " + eur(mC) + ", attendu dans " + n + " jours" }];
      reels.creance = { montant: mC, delai: G.delaiPour(n) };
    } else if (sc === "proche") {
      var qui = c.age < 30 ? "mes parents" : r.pick([f ? "mon fils" : "ma fille", "mon frère", "ma sœur"]), mP = pasPlus(besoin + r.pas(0, 150, 10), 10), dP = r.pick([3, 7]);
      echange = [ouverture, nc + " : « " + qui.replace(/^./, function (x) { return x.toUpperCase(); }) + " " + (/^mes/.test(qui) ? "vont" : "va") + " m'aider : un virement de " + eur(mP) + " " + (dP === 3 ? "d'ici trois jours" : "dans la semaine") + ". Je leur ai expliqué la situation. »", "Vous : « D'accord, je note l'aide de votre famille. »"];
      maj = [{ rubrique: "Aide d'un proche", texte: "Virement de " + eur(mP) + " annoncé " + (dP === 3 ? "d'ici trois jours" : "dans la semaine") }];
      reels.aide_proche = { montant: mP, delai: dP };
    } else if (sc === "credit") {
      var t = r.n(14, 28), pret = ceil500(besoin + 300), rel = r.pas(200, 400, 100);
      ressources.notes.push("Revenus domiciliés dans une autre banque : la domiciliation est à proposer.");
      echange = [ouverture, nc + " : « Depuis les travaux, je suis régulièrement à découvert et ça m'embête. Mon salaire est versé dans ma banque principale : ici, mon compte me sert surtout pour les prélèvements. Si vous avez une solution pour en finir avec ce découvert, je suis preneur. »", "Vous : « Je regarde ce que nous pouvons vous proposer. »"];
      maj = [{ rubrique: "Revenus", texte: eur(rev) + " nets par mois, domiciliés dans une autre banque" },
        { rubrique: "Endettement", texte: "Taux d'endettement d'environ " + t + " %, aucun incident de paiement, non inscrit au FICP" },
        { rubrique: "Capacité", texte: "Prêt personnel envisageable jusqu'à " + eur(pret) + " après étude ; relèvement de l'autorisation de découvert possible de " + eur(rel) + " au plus" }];
      reels.pret_substitution = { montant: pret, delai: 7 };
      reels.decouvert_autorise = { montant: rel, delai: 3 };
    } else if (sc === "difficultes" || sc === "fragile") {
      var cause = causeDifficulte(r, c), chg = arrondi10(rev * 0.9 + r.n(0, 200));
      echange = [ouverture, nc + " : « " + cause.echange + " »", "Vous : « Je comprends. Je note que vous n'avez pas de rentrée prévue à court terme. »"];
      maj = [{ rubrique: "Situation professionnelle", texte: cause.pro }, { rubrique: "Ressources", texte: "Aucune rentrée régulière actuellement ; charges fixes d'environ " + eur(chg) + " par mois" }];
      c.professionnel = cause.pro;
      if (sc === "fragile") maj.push({ rubrique: "Statut", texte: "Client titulaire de l'offre clientèle fragile (OCF) : frais d'incidents plafonnés" });
      if (credit) maj.push({ rubrique: "Crédit", texte: "Crédit à la consommation GS : échéance de " + eur(credit.m) + " prélevée chaque mois" });
      if (r.chance(0.2)) { var pp = r.pas(50, Math.max(60, Math.floor(besoin / 4 / 10) * 10), 10); reels.aide_proche = { montant: pp, delai: 7 }; echange.push(nc + " : « Ma famille peut peut-être m'avancer " + eur(pp) + " la semaine prochaine, mais pas plus. »"); maj.push({ rubrique: "Aide d'un proche", texte: "Avance possible de " + eur(pp) + " dans la semaine" }); }
    } else if (sc === "injoignable") {
      canaux = [];
      echange = [];
      maj = [{ rubrique: "Coordonnées", texte: "Client injoignable par téléphone, SMS et e-mail à la date du jour : coordonnées à vérifier" }];
    } else {
      echange = [ouverture, nc + " : « " + r.pick(["Ces frais sont abusifs, je ne vois pas pourquoi je devrais payer. Je ne ferai rien tant que la banque ne m'aura pas remboursé.", "Je n'ai pas l'intention de régulariser maintenant : la banque peut attendre.", "Je ne reconnais pas ce découvert, je conteste tout. Écrivez-moi si vous voulez."]) + " »", "Vous : « Je vous rappelle les conséquences d'un compte débiteur qui dure. »", nc + " : « Faites ce que vous voulez. »"];
      maj = [{ rubrique: "Position du client", texte: "Refuse de régulariser et ne propose aucune date" }];
    }

    /* épargne disponible en plus (petits montants), utilisable mais insuffisante */
    if (sc !== "epargne" && sc !== "injoignable" && sc !== "refus" && r.chance(0.22)) {
      var petit = r.pas(60, Math.max(70, Math.min(400, Math.floor(besoin / 5 / 10) * 10)), 10);
      ressources.epargne.push({ produit: "Livret A", solde: petit });
      reels.virement_epargne = { montant: petit, delai: 0 };
      maj.push({ rubrique: "Épargne", texte: "Livret A à GS Banque & Assurance : " + eur(petit) + " disponibles" });
    }

    /* ----- services à clôturer à J90 ----- */
    var services = [{ id: "carte", libelle: carte }];
    if (!c.fragile) services.push({ id: "chequier", libelle: "Chéquier" });
    services.push({ id: "bad", libelle: "Banque à distance (application et site internet)" });
    if (aut > 0) services.push({ id: "decouvert", libelle: "Autorisation de découvert de " + eur(aut) });

    /* ----- moyens réels, plan et décision attendue ----- */
    var total = 0, maxDelai = 0;
    Object.keys(reels).forEach(function (id) { total += reels[id].montant; if (reels[id].delai > maxDelai) maxDelai = reels[id].delai; });
    var pal = G.palier(palier);
    var planCalc = sc !== "credit" ? (total + 0.5 >= besoin && maxDelai <= pal.delaiMax) : (reels.pret_substitution.montant + 0.5 >= besoin);
    if (planCalc !== plan) return null;
    var sociaux = [];
    if (!plan && sc !== "injoignable" && sc !== "refus") sociaux = sc === "fragile" ? ["accompagnement"] : ["accompagnement", "surendettement"];
    var decision;
    if (palier === 15 || palier === 30) decision = plan ? "suivi" : "agence";
    else if (palier === 60) decision = plan || c.fragile ? "maintenir" : "cloturer";
    else decision = "sra";
    var courrier = palier === 15 ? (sc === "injoignable" ? "j15_info" : null) : palier === 30 ? "j30_depassement" : palier === 60 ? (decision === "cloturer" ? "j60_preavis" : "j60_relance") : "j90_sra";

    /* ----- historique des contacts ----- */
    var hist = [{ j: Math.min(palier - 1, 3), canal: "Système", texte: "SMS automatique d'alerte « compte débiteur » envoyé au client" }];
    if (palier >= 30) {
      var h15 = {
        salaire: "Appel – client joint : change d'employeur, premier salaire attendu à la fin du mois.",
        epargne: "Appel – client joint : dit qu'il va alimenter son compte, aucun virement reçu depuis.",
        creance: "Appel – client joint : attend une somme à recevoir, pas encore arrivée.",
        proche: "Appel – client joint : une aide de la famille est annoncée, pas encore reçue.",
        credit: "Appel – client joint : se dit intéressé par une solution durable, rendez-vous à fixer.",
        difficultes: "Appel – client joint : perte de revenus, aucune solution à court terme.",
        fragile: "Appel – client joint : perte de revenus, aucune solution à court terme.",
        injoignable: "Appel au mobile sans réponse, SMS laissé : pas de rappel.",
        refus: "Appel – client joint : refuse de régulariser."
      }[sc];
      hist.push({ j: 15, canal: "Appel", texte: h15 });
    }
    if (palier >= 60) hist.push({ j: 30, canal: "Courrier", texte: "Information écrite sur le dépassement envoyée au client (courrier simple)." });
    if (palier >= 90) {
      var preavis = !(plan || c.fragile);
      hist.push(preavis ? { j: 60, canal: "Lettre recommandée", texte: "Dénonciation de la convention de compte envoyée (préavis de 60 jours).", preavis: true } : { j: 60, canal: "Lettre recommandée", texte: "Dernière relance avant mesures envoyée au client." });
    }
    hist.sort(function (a, b) { return b.j - a.j; });

    /* ----- textes pédagogiques ----- */
    var objectifs = {
      salaire: "Un salaire attendu à une date précise : on enregistre le versement et on maintient le suivi.",
      epargne: "Le client a de l'épargne chez nous : le virement règle le débit tout de suite.",
      creance: "Une somme est à recevoir : on vérifie le montant et le délai avant le palier suivant.",
      proche: "Une aide familiale est annoncée : on note le montant et la date.",
      credit: "Un découvert récurrent : un prêt de substitution règle durablement le débit (opportunité commerciale), le relèvement de l'autorisation seul ne suffit pas.",
      difficultes: "Aucune ressource à court terme : pas de promesse à noter, une démarche d'accompagnement s'impose.",
      fragile: "Un client fragile : on accompagne avant toute clôture.",
      injoignable: "Client injoignable : plusieurs canaux, dont le courrier, avant de décider.",
      refus: "Un client qui refuse de régulariser : constat, courrier et suite de la procédure."
    };
    var retenir = [];
    if (palier === 15) retenir.push("À J15, le premier contact sert à comprendre l'origine du débit et à obtenir une date de régularisation.");
    if (palier === 30) retenir.push("À J30, après un mois de dépassement, le client doit recevoir une information écrite (montant, taux débiteur, frais).");
    if (palier === 60) retenir.push("À J60, la clôture devient possible : la banque dénonce la convention de compte avec un préavis de deux mois. Un client fragile se traite d'abord par l'accompagnement.");
    if (palier === 90) retenir.push("À J90, on clôture les services, on s'oppose aux prélèvements et on envoie le compte au service de recouvrement amiable.");
    if (plan) retenir.push("Le client a une solution réelle : seuls les moyens et les montants qu'il a annoncés se saisissent.");
    else if (sc === "injoignable") retenir.push("Un client injoignable se relance par plusieurs canaux ; le courrier laisse une trace écrite.");
    else retenir.push("Sans solution financière, on enregistre « aucun moyen » ou une démarche d'accompagnement, jamais une ressource inventée.");

    var d = {
      scenario: sc, palier: palier, objectif: objectifs[sc],
      client: c, note: null,
      compte: { solde: solde, autorisation: aut, debutJours: palier, frais: rel2.frais, origine: rel2.debut.lib },
      ressources: ressources,
      releve: rel2.lignes,
      historique: hist,
      services: services, prelevements: prelevements,
      contact: { canaux: canaux, echange: echange, maj: maj },
      regularisation: { plan: plan, reels: reels, sociaux: sociaux },
      attendu: { decision: decision, courrier: courrier },
      retenir: retenir
    };
    return d;
  }

  /* Contrôles de cohérence d'un dossier fabriqué. Renvoie la liste des problèmes. */
  function controler(d) {
    var pb = [], c = d && d.client;
    if (!d || !c) return ["dossier incomplet"];
    if (PALIERS.indexOf(d.palier) < 0) pb.push("palier inconnu");
    if (!(d.compte.solde < -d.compte.autorisation)) pb.push("le compte n'est pas à l'état débiteur");
    pb = pb.concat(REL.controler(d.releve, d.compte.autorisation, d.palier, d.compte.solde, !!c.fragile));
    var be = G.besoin(d);
    var total = 0, mx = 0;
    Object.keys(d.regularisation.reels).forEach(function (id) {
      var r = d.regularisation.reels[id], m = G.moyen(id);
      if (!m || m.genre !== "fonds") pb.push("moyen réel inconnu : " + id);
      if (!(r.montant > 0)) pb.push("montant réel nul : " + id);
      if (G.DELAIS.map(function (x) { return x.j; }).indexOf(r.delai) < 0) pb.push("délai non proposé : " + id);
      total += r.montant; if (r.delai > mx) mx = r.delai;
    });
    var p = G.palier(d.palier);
    if (d.regularisation.plan && d.scenario !== "credit" && !(total + 0.5 >= be && mx <= p.delaiMax)) pb.push("le plan annoncé ne couvre pas le débit dans le délai");
    if (!d.regularisation.plan && d.scenario !== "credit" && total + 0.5 >= be && mx <= p.delaiMax && Object.keys(d.regularisation.reels).some(function (id) { return id !== "virement_epargne" && id !== "aide_proche"; })) pb.push("des ressources réelles couvrent le débit alors que le plan est faux");
    if (d.palier === 90 && (!d.services.length || !d.prelevements.length)) pb.push("procédure J90 sans services ou sans prélèvements");
    var decisions = (G.DECISIONS[d.palier] || []).map(function (x) { return x.code; });
    if (decisions.indexOf(d.attendu.decision) < 0) pb.push("décision attendue inconnue");
    if (d.attendu.courrier && !G.courrier(d.attendu.courrier)) pb.push("courrier attendu inconnu");
    if (d.attendu.courrier && G.courrier(d.attendu.courrier).paliers.indexOf(d.palier) < 0) pb.push("courrier attendu étranger au palier");
    d.contact.canaux.forEach(function (x) { if (!G.canal(x)) pb.push("canal inconnu : " + x); });
    if (G.joignable(d) && !d.contact.echange.length) pb.push("client joignable sans échange");
    if (!d.contact.maj.length) pb.push("aucune mise à jour du dossier");
    if (/fictif|fictive/i.test(JSON.stringify(d))) pb.push("le mot « fictif » apparaît dans le dossier");
    return pb;
  }

  function fabriquer(graine, palier, sc) {
    var v, essai, r;
    for (v = 0; v < 120; v++) {
      r = Q.rng(graine + "|v" + v);
      essai = tirer(r, palier, sc);
      if (essai && !controler(essai).length) return { dossier: essai, problemes: [] };
    }
    throw new Error("impossible de fabriquer un dossier valide : " + sc + " J" + palier + " (" + graine + ")");
  }

  function scenariosPour(palier) { return ORDRE.filter(function (k) { return SC[k].w[palier]; }); }

  function refIncidents() {
    if (root && root.SGBF && root.SGBF.incidentsReference) return root.SGBF.incidentsReference;
    if (root && root.SGBF && root.SGBF.incidents) return root.SGBF.incidents;
    return require("./data_incidents.js").dossiers;
  }

  /* Dossiers d'un jour : au moins un dossier par palier. */
  function incidents(ymd) {
    var n = Q.nombreDuJour(ymd, "incidents"), r = Q.rng("incidents|" + ymd), ref = refIncidents();
    var nRef = Math.min(ref.length, Math.max(1, Math.round(n * PART_REFERENCE)));
    var ids = r.melange(ref.map(function (d) { return d.id; })).slice(0, nRef), liste = [], noms = {}, comptes = {};
    ids.forEach(function (id) {
      var d = ref.filter(function (x) { return x.id === id; })[0];
      noms[d.client.nom] = 1; comptes[d.client.compte] = 1;
      liste.push({ source: "reference", palier: d.palier, scenario: d.scenario, refId: id, d: d });
    });
    /* paliers des dossiers fabriqués : un de chaque palier d'abord (si la place le permet), puis tirage pondéré */
    var paliers = [], manque = PALIERS.filter(function (p) { return !liste.some(function (e) { return e.palier === p; }); });
    manque.forEach(function (p) { if (liste.length + paliers.length < n) paliers.push(p); });
    while (liste.length + paliers.length < n) paliers.push(r.poids(POIDS_PALIER));
    var compte = {};
    paliers.forEach(function (p, ix) {
      var cles = scenariosPour(p).filter(function (k) { return (compte[p + k] || 0) < 2; });
      var sc = r.poids(cles.map(function (k) { return [k, SC[k].w[p]]; }));
      compte[p + sc] = (compte[p + sc] || 0) + 1;
      var x = null, v;
      for (v = 0; v < 10; v++) {
        x = fabriquer(ymd + "|i" + ix + "|w" + v, p, sc);
        if (!noms[x.dossier.client.nom] && !comptes[x.dossier.client.compte]) break;
      }
      noms[x.dossier.client.nom] = 1; comptes[x.dossier.client.compte] = 1;
      liste.push({ source: "genere", palier: p, scenario: sc, d: x.dossier });
    });
    liste = Q.rng("ordre|incidents|" + ymd).melange(liste);
    var dossiers = [], composition = [];
    liste.forEach(function (e, ix) {
      var d = e.source === "reference" ? Object.assign({}, e.d) : e.d;
      d.id = ix + 1;
      dossiers.push(d);
      composition.push({ id: d.id, source: e.source, palier: e.palier, scenario: e.scenario, refId: e.refId || null });
    });
    return { dossiers: dossiers, composition: composition };
  }

  var api = { incidents: incidents, fabriquer: fabriquer, controler: controler, tirer: tirer, SC: SC, ORDRE: ORDRE, PALIERS: PALIERS, SANS_REPONSE: SANS_REPONSE, scenariosPour: scenariosPour, PART_REFERENCE: PART_REFERENCE };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.quotidienGdi = api; }
})(typeof window !== "undefined" ? window : null);
