/* GS Banque & Assurance – synthèse commerciale du portefeuille : équipement, ventes, opportunités, alertes, rendez-vous.
   Tout est calculé à partir des données du portefeuille (clients fictifs) et de la date de l'exercice. */
(function (root) {
  "use strict";

  var B = root && root.SGBF ? root.SGBF.banque : require("./banque.js");
  var PR = root && root.SGBF ? root.SGBF.produits : require("./produits.js");
  var M = root && root.SGBF ? root.SGBF.mouvements : require("./mouvements.js");

  var VALIDITE_CARTE = 1095; /* jours : validité de 3 ans (hypothèse pédagogique) */
  var KYC_MAX = 1826;        /* jours : dossier à actualiser au bout de 5 ans (règle interne fictive) */
  var MARCHE_IMMO = { 15: 3.50, 20: 3.66, 25: 3.75 }; /* octobre 2026, taux moyens du marché (sources : notes/reperes_reels.md) */

  var LIB_STATUT = { salarie: "Salarié(e)", fonctionnaire: "Fonctionnaire", apprenti: "Apprenti(e)", independant: "Travailleur indépendant", etudiant: "Étudiant(e)", chomage: "Demandeur d'emploi", foyer: "Au foyer", retraite: "Retraité(e)" };
  var LIB_SITUATION = { marie: "Marié(e)", pacse: "Pacsé(e)", concubinage: "En concubinage", celibataire: "Célibataire", divorce: "Divorcé(e)", veuf: "Veuf / veuve" };
  var LIB_LOGEMENT = { locataire: "Locataire", proprietaire: "Propriétaire", accedant: "Propriétaire (crédit en cours)", heberge: "Hébergé(e) à titre gratuit" };

  /* ---------- contrats ---------- */
  function famille(p) { var x = PR.parId[p]; return x ? x.famille : "autre"; }
  /* Montant d'un contrat vendu (convention de l'outil) : cotisation annuelle du catalogue pour les comptes et les cartes, versement ou encours
     pour l'épargne et les placements, capital emprunté pour les crédits, cotisation annuelle (12 mensualités de prime) pour les assurances. */
  var ANNUEL = { CPT: 24, JEUNE: 0, OCF: 12, DAC: 0, GCON: PR.gconMois * 12, GALE: PR.galeMois * 12, VCLA: 45, VPRE: 138, VJEU: 20, VELE: 35, CRET: 12, PLAT: 205, WELI: 295 };
  PR.conventions.forEach(function (cv) { ANNUEL[cv.id] = Math.round(cv.mensuel * 12 * 100) / 100; });   /* cotisation de la convention de compte */
  /* Cotisation annuelle d'une assurance souscrite par l'élève (le catalogue ne demande pas de prime à la souscription) : 12 fois la cotisation mensuelle « à partir de » de la fiche produit. */
  var ANNUEL_ASSURANCE = { MRH: 108, AUTO: 300, GAV: 72, PREV: 144,
    MOTO: 12 * PR.primes.MOTO.cyclo.tiers, CCAR: 12 * PR.primes.CCAR.tiers, VSP: 12 * PR.primes.VSP.tiers, PJ: 12 * PR.primes.PJ.ess, MPAY: 12 * PR.primes.MPAY.banque, APN: 12 * PR.primes.APN.ess,
    DECES: 12 * PR.cotisation("DECES", 18, 30000), DEP: 12 * PR.cotisation("DEP", 50, 500), OBSQ: 12 * PR.cotisation("OBSQ", 40, 3000, "mensuel") };
  /* conventions de compte : 12 × cotisation mensuelle ; montants arrondis au centime (12 × 3,15 donnerait 37,800000000000004) */
  PR.conventions.forEach(function (cv) { ANNUEL[cv.id] = Math.round(cv.mensuel * 12 * 100) / 100; });
  Object.keys(ANNUEL_ASSURANCE).forEach(function (k) { ANNUEL_ASSURANCE[k] = Math.round(ANNUEL_ASSURANCE[k] * 100) / 100; });
  /* Mobile et internet : abonnement annuel d'entrée de gamme (12 mensualités du forfait 50 Go, de la box Essentiel, du pack 50 Go) ; eSIM : prix de l'offre Europe 3 Go, 7 jours. Sert quand une souscription n'a pas d'options. */
  var ANNUEL_MOBILE = { MOB: PR.abonnement("MOB", { forfait: "50" }, false).an, BOX: PR.abonnement("BOX", { offre: "essentiel" }).an, PACK: PR.abonnement("PACK", { forfait: "50" }).an, ESIM: PR.prixEsim("europe", 3, 7) };
  var NATURE = { compte: "cotisation annuelle", carte: "cotisation annuelle", epargne: "versement (encours)", placement: "versement (encours)", credit: "capital emprunté", assurance: "cotisation annuelle", mobile: "abonnement annuel" };
  function contrats(c) {
    var l = [{ p: c.cpt.p, ouvert: c.cpt.ouvert, montant: ANNUEL[c.cpt.p] || 0 }];
    c.cartes.forEach(function (x) { l.push({ p: x.p, ouvert: x.ouvert, montant: ANNUEL[x.p] || 0 }); });
    c.epa.forEach(function (x) { l.push({ p: x.p, ouvert: x.ouvert, montant: x.solde || 0 }); });
    c.plc.forEach(function (x) { l.push({ p: x.p, ouvert: x.ouvert, montant: x.solde || 0 }); });
    c.cre.forEach(function (x) { if (!x.ext) l.push({ p: x.p, ouvert: x.ouvert, montant: x.cap || 0 }); });
    c.ass.forEach(function (x) { l.push({ p: x.p, ouvert: x.ouvert, montant: Math.round(x.prime * 120) / 10 }); });
    l.forEach(function (x) { x.famille = famille(x.p); });
    return l;
  }

  /* ---------- équipement ---------- */
  function equipement(clients) {
    var parFam = {}, total = 0;
    PR.familles.forEach(function (f) { parFam[f.id] = { id: f.id, nom: f.nom, court: f.court, clients: 0, contrats: 0 }; });
    var peuEquipes = 0;
    clients.forEach(function (c) {
      var cs = contrats(c), vus = {};
      cs.forEach(function (x) { if (parFam[x.famille]) { parFam[x.famille].contrats++; vus[x.famille] = 1; } });
      Object.keys(vus).forEach(function (f) { parFam[f].clients++; });
      total += cs.length;
      if (cs.length <= 2) peuEquipes++;
    });
    var liste = PR.familles.map(function (f) { var x = parFam[f.id]; x.taux = 100 * x.clients / clients.length; return x; });
    /* Par univers du catalogue (une ou plusieurs familles) : client équipé = client qui détient au moins un contrat de l'univers */
    var parUniv = {}; PR.univers.forEach(function (u) { parUniv[u.id] = { id: u.id, nom: u.nom, clients: 0, contrats: 0 }; });
    clients.forEach(function (c) {
      var vusU = {};
      contrats(c).forEach(function (x) { var u = PR.universDe({ famille: x.famille }); if (u) { parUniv[u.id].contrats++; vusU[u.id] = 1; } });
      Object.keys(vusU).forEach(function (k) { parUniv[k].clients++; });
    });
    var listeU = PR.univers.map(function (u) { var x = parUniv[u.id]; x.taux = 100 * x.clients / clients.length; return x; });
    return { nbClients: clients.length, familles: liste, univers: listeU, contrats: total, moyenne: total / clients.length, peuEquipes: peuEquipes };
  }

  /* ---------- ventes ---------- */
  function ventes(clients, jours) {
    var parFam = {}, parProd = {}, tot = 0;
    PR.familles.forEach(function (f) { parFam[f.id] = 0; });
    clients.forEach(function (c) {
      contrats(c).forEach(function (x) {
        if (x.ouvert <= jours) { parFam[x.famille] = (parFam[x.famille] || 0) + 1; parProd[x.p] = (parProd[x.p] || 0) + 1; tot++; }
      });
    });
    var parUniv = {}; PR.univers.forEach(function (u) { parUniv[u.id] = u.familles.reduce(function (t, f) { return t + (parFam[f] || 0); }, 0); });
    return { total: tot, parFamille: parFam, parUnivers: parUniv, parProduit: parProd };
  }
  /* Montant d'une souscription de l'élève, selon la même convention que les contrats du portefeuille : versement initial (épargne, placements) ou capital emprunté (crédits)
     quand il est saisi, sinon cotisation annuelle du catalogue (comptes et cartes : ANNUEL ; assurances : ANNUEL_ASSURANCE). */
  function montantSouscription(x) {
    if (famille(x.p) === "assurance" && x.options && x.options.cotisationAn > 0) return x.options.cotisationAn;      /* cotisation annuelle d'après les options choisies */
    if (famille(x.p) === "compte" && x.options && x.options.cotisationAn > 0) return x.options.cotisationAn;
    if (famille(x.p) === "mobile" && x.options) return x.options.cotisationAn > 0 ? x.options.cotisationAn : (x.options.prixUnique > 0 ? x.options.prixUnique : ANNUEL_MOBILE[x.p] || 0);      /* abonnement annuel (12 mensualités) ou prix de l'eSIM payé une fois */
    if (typeof x.montant === "number" && x.montant > 0) return x.montant;
    return famille(x.p) === "assurance" ? (ANNUEL_ASSURANCE[x.p] || 0) : famille(x.p) === "mobile" ? (ANNUEL_MOBILE[x.p] || 0) : (ANNUEL[x.p] || 0);
  }
  /* ---------- ventes de la semaine : brutes, annulées, nettes ---------- */
  function lundiDe(d) { var x = B.jour(d); return B.plusJours(x, -((x.getDay() + 6) % 7)); }
  function vide() { return { n: 0, m: 0 }; }
  /* decalage : 0 = semaine en cours (du lundi à aujourd'hui), 1 = semaine précédente, etc.
     Date de vente d'un contrat = jour ouvré de son ouverture. Vente brute = tous les contrats conclus (y compris ceux annulés depuis) ;
     vente annulée = contrat conclu puis annulé ; vente nette = brute – annulée. Une annulation est rattachée au jour de la vente d'origine.
     « souscriptions » (facultatif) : celles que l'élève a enregistrées (catalogue, crédits accordés dans le montage de prêt, store().souscriptions) : chacune est une vente brute
     au jour de sa souscription, repérée par « eleve: true » (y compris pour un client créé à l'ouverture d'un compte : « autres ») ; annuler une souscription la supprime, elle ne devient donc pas une vente annulée. */
  function ventesSemaine(clients, decalage, souscriptions, autres) {
    decalage = decalage || 0;
    var auj = B.aujourdhui(), lundi = B.plusJours(lundiDe(auj), -7 * decalage), dim = B.plusJours(lundi, 6), fin = dim > auj ? auj : dim;
    var jours = [], idx = {}, d = lundi;
    while (d <= fin) {
      if (B.estOuvre(d)) { var j = { date: d, brut: vide(), ann: vide(), net: vide(), lignes: [] }; jours.push(j); idx[B.ymd(d)] = j; }
      d = B.plusJours(d, 1);
    }
    var total = { brut: vide(), ann: vide(), net: vide() }, parFam = {}, parProd = {};
    PR.familles.forEach(function (f) { parFam[f.id] = { id: f.id, nom: f.nom, nature: NATURE[f.id], brut: vide(), ann: vide(), net: vide() }; });
    function ajouter(c, p, fam, montant, ouvert, a, eleve) {
      var j = idx[B.ymd(B.dateOuvrable(ouvert))];
      if (!j) return;
      if (!parProd[p]) { var pr = PR.parId[p] || {}; parProd[p] = { p: p, code: pr.code || p, nom: pr.nom || p, famille: fam, brut: vide(), ann: vide(), net: vide() }; }
      var cibles = [j, total, parFam[fam], parProd[p]];
      cibles.forEach(function (t) { t.brut.n++; t.brut.m += montant; if (a) { t.ann.n++; t.ann.m += montant; } });
      j.lignes.push({ client: c, p: p, famille: fam, montant: montant, annulee: a ? { date: B.dateOuvrable(a.annule), motif: a.motif } : null, eleve: !!eleve });
    }
    clients.forEach(function (c) {
      contrats(c).forEach(function (x) { ajouter(c, x.p, x.famille, x.montant, x.ouvert, null); });
      (c.ann || []).forEach(function (a) { ajouter(c, a.p, famille(a.p), a.montant, a.vente, a); });
    });
    /* « autres » : clients créés pendant l'exercice (ouverture de compte d'un prospect) : leurs souscriptions sont des ventes, mais ils n'ont pas de contrat historique à compter */
    var parClient = {}; clients.concat(Array.isArray(autres) ? autres : []).forEach(function (c) { parClient[c.id] = c; });
    (Array.isArray(souscriptions) ? souscriptions : []).forEach(function (x) {
      var c = parClient[x.c], d = B.lireYmd(x.date);
      if (c && d && PR.parId[x.p]) ajouter(c, x.p, famille(x.p), montantSouscription(x), B.ecartJours(auj, d), null, true);
    });
    var tous = jours.concat([total]).concat(Object.keys(parFam).map(function (k) { return parFam[k]; })).concat(Object.keys(parProd).map(function (k) { return parProd[k]; }));
    tous.forEach(function (t) { t.brut.m = Math.round(t.brut.m * 100) / 100; t.ann.m = Math.round(t.ann.m * 100) / 100; t.net.n = t.brut.n - t.ann.n; t.net.m = Math.round((t.brut.m - t.ann.m) * 100) / 100; });
    /* produits vendus dans la semaine, rangés par univers (famille), puis par nombre de contrats, puis par nom */
    Object.keys(parProd).forEach(function (k) { parFam[parProd[k].famille].produits = (parFam[parProd[k].famille].produits || []).concat([parProd[k]]); });
    PR.familles.forEach(function (f) {
      var l = parFam[f.id].produits = parFam[f.id].produits || [];
      l.sort(function (x, y) { return y.brut.n - x.brut.n || (x.nom < y.nom ? -1 : x.nom > y.nom ? 1 : 0); });
    });
    jours.forEach(function (j) { j.lignes.sort(function (x, y) { return x.client.nom < y.client.nom ? -1 : x.client.nom > y.client.nom ? 1 : 0; }); });
    /* Même vue regroupée par univers du catalogue (celle que l'on lit à l'accueil) : sommes des familles de l'univers, produits vendus rangés par nombre de contrats puis par nom */
    var parUniv = PR.univers.map(function (u) {
      var fs = u.familles.map(function (f) { return parFam[f]; }), r = { id: u.id, nom: u.nom, nature: "", brut: vide(), ann: vide(), net: vide(), produits: [] };
      var natures = []; fs.forEach(function (f) { if (natures.indexOf(f.nature) < 0) natures.push(f.nature); r.nature = natures.join(" ; "); ["brut", "ann", "net"].forEach(function (k) { r[k].n += f[k].n; r[k].m = Math.round((r[k].m + f[k].m) * 100) / 100; }); r.produits = r.produits.concat(f.produits); });
      r.produits.sort(function (x, y) { return y.brut.n - x.brut.n || (x.nom < y.nom ? -1 : x.nom > y.nom ? 1 : 0); });
      return r;
    });
    return { decalage: decalage, debut: lundi, fin: fin, fin7: dim, semaine: numeroSemaine(lundi), jours: jours, total: total, parFamille: PR.familles.map(function (f) { return parFam[f.id]; }), parUnivers: parUniv, enCours: decalage === 0 };
  }
  /* Objectifs annuels fixés par la direction (imaginaires) : réalisé sur 12 mois ÷ taux d'atteinte voulu pour la famille. */
  var ATTEINTE = { compte: 1.04, carte: 0.97, epargne: 0.88, placement: 0.67, credit: 0.8, assurance: 0.92 };
  /* Univers ajouté au catalogue après l'ouverture des dossiers : aucun client n'a de contrat dans les données de départ. Il n'a donc ni objectif annuel ni ligne dans la synthèse commerciale du portefeuille (un « 0 % en retard » serait artificiel et ferait baisser l'objectif global de l'agence) ; ses ventes comptent dans « Ventes de la semaine ». */
  var HORS_SYNTHESE = { mobile: true };
  function famillesSynthese() { return PR.familles.filter(function (f) { return !HORS_SYNTHESE[f.id]; }); }
  function objectifs(clients) {
    var r = ventes(clients, 365).parFamille, obj = {};
    famillesSynthese().forEach(function (f) { obj[f.id] = Math.max(1, Math.round(r[f.id] / (ATTEINTE[f.id] || 1))); });
    return obj;
  }

  /* ---------- âge et anniversaire ---------- */
  function prochainAnniversaire(c) {
    var auj = B.aujourdhui(), y = auj.getFullYear();
    var d = B.D(y, c.nai[0] - 1, c.nai[1]);
    if (d < auj) d = B.D(y + 1, c.nai[0] - 1, c.nai[1]);
    return d;
  }
  /* Date de naissance cohérente avec l'âge affiché (l'âge reste celui de l'exercice). */
  function naissance(c) {
    var auj = B.aujourdhui(), y = auj.getFullYear();
    var cetteAnnee = B.D(y, c.nai[0] - 1, c.nai[1]);
    var an = cetteAnnee <= auj ? y - c.age : y - c.age - 1;
    return B.D(an, c.nai[0] - 1, c.nai[1]);
  }

  /* ---------- situation du jour ---------- */
  function etatCompte(c) { return M.resume(c, 90); }
  function derniereNote(c) { return c.not.length ? Math.min.apply(null, c.not.map(function (n) { return n.j; })) : null; }
  function echeancesRestantes(x) { return Math.max(0, x.dur - B.echeancesPayees(x)); }
  function detient(c, p) { return c.epa.some(function (e) { return e.p === p; }) || c.plc.some(function (e) { return e.p === p; }) || c.cartes.some(function (e) { return e.p === p; }) || c.cre.some(function (e) { return e.p === p; }) || c.ass.some(function (e) { return e.p === p; }); }
  function sansDeja(c, ids) { return ids.filter(function (p) { return PR.parId[p] && !detient(c, p); }); }
  function revenu(c) { return c.pro.foyer || c.pro.rev || 0; }

  var PISTES_PROJET = { travaux: ["CTRAV"], voyage: ["CCONSO", "LDDS"], etudes: ["CCONSO", "LDDS"], immo: ["CIMMO", "MRH"], retraite: ["PER", "AV"], auto: ["CAUTO", "AUTO"], logement: ["CIMMO", "MRH"], mariage: ["CCONSO", "GAV"], permis: ["LJ", "CCONSO"] };

  /* Opportunités commerciales détectées à partir de règles simples sur le dossier. */
  function opportunites(c) {
    var o = [], auj = B.aujourdhui(), etat = null;
    function ajouter(code, titre, detail, pistes, poids, rdv) { o.push({ code: code, titre: titre, detail: detail, pistes: pistes, poids: poids, rdv: !!rdv }); }
    function compte() { if (!etat) etat = etatCompte(c); return etat; }
    var nbc = contrats(c).length;

    /* Livret A proche du plafond */
    c.epa.forEach(function (e) {
      if (e.p === "LA" && e.solde >= 0.95 * PR.plafond.LA) ajouter("PLAFOND", "Livret A proche du plafond", "Solde : " + B.eur(e.solde) + " pour un plafond de " + B.eur(PR.plafond.LA) + ".", sansDeja(c, ["LDDS", "AV", "PEA", "PER"]).slice(0, 3), 2, true);
    });
    /* éligibilité au LEP */
    var la = c.epa.filter(function (e) { return e.p === "LA"; })[0];
    if (c.age >= 18 && !detient(c, "LEP") && c.rfr && c.pro.parts && c.rfr <= PR.plafondLEP(c.pro.parts) && la && la.solde >= 1500) {
      ajouter("LEP", "Éligible au LEP, non détenu", "Revenu fiscal de référence : " + B.eur(c.rfr) + " (plafond pour " + String(c.pro.parts).replace(".", ",") + " part" + (c.pro.parts > 1 ? "s" : "") + " : " + B.eur(PR.plafondLEP(c.pro.parts)) + "). Livret A : " + B.eur(la.solde) + ".", ["LEP"], 2, true);
    }
    /* projet connu à relancer */
    c.prj.forEach(function (p) {
      if (p.dans <= 150) ajouter("PROJET", "Projet connu à relancer", p.lib + (p.dans <= 0 ? "." : " : dans environ " + (p.dans < 60 ? p.dans + " jours" : Math.round(p.dans / 30.4) + " mois") + ".") + (p.detail ? " " + p.detail.charAt(0).toUpperCase() + p.detail.slice(1) + "." : ""), sansDeja(c, PISTES_PROJET[p.t] || []).slice(0, 3), 3, true);
    });
    /* crédit à la consommation bientôt soldé / prêt immobilier au-dessus du marché */
    c.cre.forEach(function (x) {
      if (x.ext) return;
      var reste = echeancesRestantes(x);
      if (x.p !== "CIMMO" && reste >= 1 && reste <= 6) ajouter("FINCREDIT", "Crédit bientôt soldé", PR.parId[x.p].code + " : plus que " + reste + " échéance" + (reste > 1 ? "s" : "") + " de " + B.eur(x.mens) + ".", sansDeja(c, ["LA", "CCONSO"]).slice(0, 2), 2, false);
      if (x.p === "CIMMO") {
        var crd = B.crdAu(x), an = reste / 12;
        var ref = an >= 22 ? MARCHE_IMMO[25] : an >= 17 ? MARCHE_IMMO[20] : MARCHE_IMMO[15];
        if (x.taux >= ref + 0.5 && crd >= 60000 && an >= 8) ajouter("RENEGO", "Prêt immobilier à un taux supérieur au marché", "Taux du client : " + String(x.taux).replace(".", ",") + " %. Taux moyens du marché en octobre 2026 (source : Selectra) : " + String(MARCHE_IMMO[15]).replace(".", ",") + " % à 15 ans, " + String(MARCHE_IMMO[20]).replace(".", ",") + " % à 20 ans, " + String(MARCHE_IMMO[25]).replace(".", ",") + " % à 25 ans. Capital restant dû : " + B.eur(crd) + ".", ["CIMMO"], 3, true);
      }
    });
    /* âges clés */
    if (c.age === 17) {
      var j18 = B.ecartJours(prochainAnniversaire(c), auj);
      if (j18 <= 90) ajouter("MAJORITE", "Bientôt majeur(e)", "Fête ses 18 ans dans " + j18 + " jour" + (j18 > 1 ? "s" : "") + " (" + B.fmtCourt(prochainAnniversaire(c)) + ").", sansDeja(c, ["CPT", "LJ"]).slice(0, 2), 2, false);
    }
    if (["salarie", "fonctionnaire", "independant"].indexOf(c.pro.statut) >= 0 && c.age >= 58 && c.age <= 63) {
      ajouter("RETRAITE", "Approche de la retraite", c.age + " ans, " + c.pro.prof.toLowerCase() + ".", sansDeja(c, ["PER", "AV"]).slice(0, 2), 2, true);
    }
    /* nouveau client et client peu équipé */
    if (c.depuis <= 120) ajouter("NOUVEAU", "Nouveau client", "Client depuis " + c.depuis + " jours : faire le point sur ses besoins.", sansDeja(c, ["LA", "MRH"]).slice(0, 2), 2, true);
    else if (nbc <= 2 && c.depuis > 365 && c.age >= 25 && c.age <= 70 && revenu(c) >= 1800) {
      ajouter("PEU", "Client peu équipé", "Compte et carte seulement, client depuis " + Math.floor(c.depuis / 365) + " an" + (c.depuis >= 730 ? "s" : "") + ", revenus du foyer de " + B.eur(revenu(c)) + " par mois.", sansDeja(c, ["LA", "MRH", "AV"]).slice(0, 3), 2, true);
    }
    /* contact ancien */
    var dn = derniereNote(c);
    if (dn === null || dn > 365) ajouter("CONTACT", dn === null ? "Aucun contact enregistré" : "Dernier contact ancien", dn === null ? "Aucune note de rendez-vous dans le dossier." : "Dernière note du dossier il y a " + Math.round(dn / 30.4) + " mois.", [], 1, false);
    return o;
  }

  /* Alertes de gestion (régularisation, conformité, renouvellement). */
  function alertes(c) {
    var o = [], etat = etatCompte(c);
    if (etat.solde < 0) o.push({ code: "DEBITEUR", titre: "Solde débiteur", detail: "Solde du compte courant : " + B.eur2(etat.solde) + (c.cpt.dec ? " (découvert autorisé : " + B.eur(c.cpt.dec) + ")." : " (aucun découvert autorisé).") });
    c.cartes.forEach(function (x) {
      var dans = VALIDITE_CARTE - x.emis;
      if (dans <= 60) o.push({ code: "CARTE", titre: dans < 0 ? "Carte arrivée à échéance" : "Carte à renouveler", detail: PR.parId[x.p].code + " : échéance estimée le " + B.fmtDate(B.plusJours(B.aujourdhui(), dans)) + " (validité de 3 ans)." });
    });
    if (c.kyc > KYC_MAX) o.push({ code: "KYC", titre: "Dossier à actualiser", detail: "Dernière mise à jour du dossier le " + B.fmtDate(B.dateJours(c.kyc)) + " (plus de 5 ans)." });
    return o;
  }

  function potentiel(c) {
    var p = opportunites(c).reduce(function (t, x) { return t + x.poids; }, 0);
    return p;
  }

  /* ---------- semaine ---------- */
  function numeroSemaine(d) {
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7) + 3);
    var j4 = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
    var sem = 1 + Math.round(((t - j4) / 86400000 - 3 + ((j4.getUTCDay() + 6) % 7)) / 7);
    return t.getUTCFullYear() * 100 + sem;
  }
  function aleaClient(c, graine) { return M.h32(c.id, graine, 5) / 4294967296; }

  /* Tout le portefeuille analysé une seule fois. */
  var cacheAnalyse = null, cleAnalyse = null;
  function analyser(clients) {
    var cle = B.ymd(B.aujourdhui()) + "|" + clients.length;
    if (cacheAnalyse && cleAnalyse === cle) return cacheAnalyse;
    var opp = {}, alt = {}, pot = {};
    clients.forEach(function (c) { opp[c.id] = opportunites(c); alt[c.id] = alertes(c); pot[c.id] = opp[c.id].reduce(function (t, x) { return t + x.poids; }, 0); });
    cacheAnalyse = { opp: opp, alt: alt, pot: pot };
    cleAnalyse = cle;
    return cacheAnalyse;
  }
  function viderCache() { cacheAnalyse = null; cleAnalyse = null; }

  /* Opportunités de la semaine : les plus fortes, avec un tirage qui change d'une semaine à l'autre. */
  function opportunitesSemaine(clients, n) {
    var an = analyser(clients), sem = numeroSemaine(B.aujourdhui()), liste = [];
    clients.forEach(function (c) {
      an.opp[c.id].forEach(function (x, i) { liste.push({ client: c, opp: x, score: x.poids + 1.6 * aleaClient(c, sem + i * 31) }); });
    });
    liste.sort(function (p, q) { return q.score - p.score || p.client.id - q.client.id; });
    var vus = {}, res = [];
    for (var i = 0; i < liste.length && res.length < n; i++) { if (!vus[liste[i].client.id]) { vus[liste[i].client.id] = 1; res.push(liste[i]); } }
    return { semaine: sem, items: res, total: liste.length, clients: Object.keys(an.opp).filter(function (k) { return an.opp[k].length; }).length };
  }

  /* Rendez-vous de la semaine : tirés parmi les clients qui ont une raison de venir, répartis sur les prochains jours d'ouverture de l'agence
     (mardi au samedi hors jours fériés). Chaque rendez-vous dure une heure et se termine avant la fermeture : pas de rendez-vous entre 13 h et 14 h,
     le samedi seulement le matin, ni sur les plages réservées de la journée (gestion 9 h 10 – 10 h, proactivité 11 h – 12 h, réunion d'équipe le jeudi 14 h – 15 h, plage accueil : voir banque.js). */
  function rendezVous(clients, nbJours) {
    nbJours = nbJours || 5;
    var an = analyser(clients), auj = B.aujourdhui(), jours = [], d = B.agenceSuivant(auj);
    while (jours.length < nbJours) { jours.push(d); d = B.agenceSuivant(B.plusJours(d, 1)); }
    var sem = numeroSemaine(auj), pool = [];
    clients.forEach(function (c) { an.opp[c.id].forEach(function (x) { if (x.rdv) pool.push({ client: c, opp: x }); }); });
    pool.sort(function (p, q) { return aleaClient(p.client, sem + 7) - aleaClient(q.client, sem + 7) || p.client.id - q.client.id; });
    var utilises = {}, res = [], idx = 0;
    jours.forEach(function (j, ij) {
      /* Les rendez-vous de l'agence se placent hors des plages réservées (gestion, proactivité, réunion d'équipe du jeudi, accueil) : on tire au sort, parmi les heures libres du jour, celles qui sont occupées. */
      var libres = B.creneauxRdv(j), nb = Math.min(libres.length, 2 + Math.floor(aleaClient({ id: ij + 900 }, sem) * 3)), pris = 0;
      var heures = libres.map(function (h, k) { return { h: h, a: aleaClient({ id: ij * 40 + k + 1000 }, sem) }; }).sort(function (x, y) { return x.a - y.a || (x.h < y.h ? -1 : 1); }).slice(0, nb).map(function (x) { return x.h; }).sort();
      while (pris < nb && idx < pool.length) {
        var p = pool[idx++];
        if (utilises[p.client.id]) continue;
        utilises[p.client.id] = 1;
        res.push({ date: j, heure: heures[pris], client: p.client, motif: p.opp.titre, canal: aleaClient(p.client, sem + 3) < 0.7 ? "En agence" : "Par téléphone" });
        pris++;
      }
    });
    return res;
  }

  /* ---------- synthèse en clair ---------- */
  function pluriel(n, s, p) { return n + " " + (n > 1 ? p : s); }
  function synthese(clients) {
    var eq = equipement(clients), v365 = ventes(clients, 365), v90 = ventes(clients, 90), v30 = ventes(clients, 30), obj = objectifs(clients), an = analyser(clients);
    var objTotal = 0;
    /* Une ligne par univers du catalogue (comptes et cartes réunis dans « Banque au quotidien ») ; un univers sans objectif (mobile et internet) n'a pas de ligne. */
    var lignes = [];
    PR.univers.forEach(function (u) {
      var fs = u.familles.filter(function (f) { return !HORS_SYNTHESE[f]; });
      if (!fs.length) return;
      var somme = function (m) { return fs.reduce(function (t, f) { return t + m[f]; }, 0); };
      var o = somme(obj), r = somme(v365.parFamille), taux = 100 * r / o;
      objTotal += o;
      lignes.push({ id: u.id, nom: u.nom, court: u.nom, taux: eq.univers.filter(function (x) { return x.id === u.id; })[0].taux, j30: somme(v30.parFamille), j90: somme(v90.parFamille), an: r, objectif: o, atteinte: taux, ecart: r - o });
    });
    var atteinteGlobale = 100 * v365.total / objTotal;
    var enRetard = lignes.filter(function (l) { return l.atteinte < 80; }).sort(function (x, y) { return x.atteinte - y.atteinte; });
    var aObjectif = lignes.filter(function (l) { return l.atteinte >= 100; });
    var nbDeb = 0, nbCartes = 0, nbKyc = 0;
    clients.forEach(function (c) { an.alt[c.id].forEach(function (x) { if (x.code === "DEBITEUR") nbDeb++; if (x.code === "CARTE") nbCartes++; if (x.code === "KYC") nbKyc++; }); });
    var phr = [];
    phr.push("Sur les 12 derniers mois, l'agence a ouvert " + pluriel(v365.total, "contrat", "contrats") + " pour son portefeuille de " + clients.length + " clients, soit " + Math.round(atteinteGlobale) + " % de l'objectif annuel (" + objTotal + " contrats).");
    if (aObjectif.length) phr.push("L'objectif annuel est atteint pour " + (aObjectif.length > 1 ? "les univers " : "l'univers ") + aObjectif.map(function (l) { return l.nom; }).join(" et ") + ".");
    if (enRetard.length) phr.push((enRetard.length > 1 ? "Les univers les plus en retard sont " : "L'univers le plus en retard est ") + enRetard.slice(0, 2).map(function (l) { return l.nom + " (" + Math.round(l.atteinte) + " %)"; }).join(" et ") + ".");
    phr.push("Sur les 90 derniers jours, " + pluriel(v90.total, "contrat a été ouvert", "contrats ont été ouverts") + " dont " + pluriel(v90.parFamille.credit, "crédit", "crédits") + " et " + pluriel(v90.parFamille.placement, "placement", "placements") + ".");
    phr.push("Le portefeuille détient en moyenne " + B.nb(Math.round(eq.moyenne * 10) / 10) + " produits par client ; " + pluriel(eq.peuEquipes, "client n'a", "clients n'ont") + " que le compte et la carte.");
    var alertesTxt = [];
    if (nbDeb) alertesTxt.push(pluriel(nbDeb, "client en solde débiteur", "clients en solde débiteur"));
    if (nbCartes) alertesTxt.push(pluriel(nbCartes, "carte à renouveler", "cartes à renouveler"));
    if (nbKyc) alertesTxt.push(pluriel(nbKyc, "dossier à actualiser", "dossiers à actualiser"));
    return { texte: phr.join(" "), alertesTexte: alertesTxt.length ? "À traiter : " + alertesTxt.join(", ") + "." : "", equipement: eq, lignes: lignes, total12: v365.total, total90: v90.total, total30: v30.total, objectif: objTotal, atteinte: atteinteGlobale, alertes: { debiteurs: nbDeb, cartes: nbCartes, kyc: nbKyc } };
  }

  /* Liste des alertes avec le client concerné (pour l'accueil). */
  function listeAlertes(clients) {
    var an = analyser(clients), res = { DEBITEUR: [], CARTE: [], KYC: [] };
    clients.forEach(function (c) { an.alt[c.id].forEach(function (x) { if (res[x.code]) res[x.code].push({ client: c, alerte: x }); }); });
    res.CARTE.sort(function (p, q) { return p.client.cartes.reduce(function (m, x) { return Math.max(m, x.emis); }, 0) < q.client.cartes.reduce(function (m, x) { return Math.max(m, x.emis); }, 0) ? 1 : -1; });
    res.KYC.sort(function (p, q) { return q.client.kyc - p.client.kyc; });
    return res;
  }

  var api = {
    VALIDITE_CARTE: VALIDITE_CARTE, KYC_MAX: KYC_MAX, MARCHE_IMMO: MARCHE_IMMO, LIB_STATUT: LIB_STATUT, LIB_SITUATION: LIB_SITUATION, LIB_LOGEMENT: LIB_LOGEMENT,
    contrats: contrats, equipement: equipement, ventes: ventes, ventesSemaine: ventesSemaine, lundiDe: lundiDe, NATURE: NATURE, ANNUEL: ANNUEL, ANNUEL_ASSURANCE: ANNUEL_ASSURANCE, montantSouscription: montantSouscription, objectifs: objectifs, naissance: naissance, prochainAnniversaire: prochainAnniversaire,
    opportunites: opportunites, alertes: alertes, potentiel: potentiel, analyser: analyser, viderCache: viderCache, numeroSemaine: numeroSemaine,
    opportunitesSemaine: opportunitesSemaine, rendezVous: rendezVous, synthese: synthese, listeAlertes: listeAlertes, echeancesRestantes: echeancesRestantes, detient: detient, famille: famille
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.synthese = api; }
})(typeof window !== "undefined" ? window : null);
