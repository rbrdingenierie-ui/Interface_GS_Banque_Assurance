/* GS Banque & Assurance – montage de prêt : constituer le dossier de crédit d'un client, de la demande à l'offre.
   Quatre étapes : 1. Projet et financement (plan de financement, prêt, garantie, assurance emprunteur) ; 2. Pièces justificatives ; 3. Analyse de la solvabilité ;
   4. Décision et offre (outil d'aide à la décision, avis du conseiller, accord ou refus). Ce module ne fait que des calculs (aucun accès à la page) :
   la saisie et l'affichage sont dans js/app_montage.js. Le calcul du prêt est celui du simulateur (js/pret.js).

   Conventions de calcul (détail dans le README) :
   - toutes les sommes d'argent sont calculées en centimes entiers ; le prêt est à taux fixe, à mensualités constantes, la dernière mensualité solde le prêt ;
   - plan de financement : total des emplois = apport + prêt ; dans le prêt immobilier, les frais de dossier (750 €) et de garantie (pourcentage du prêt) sont inclus dans le
     prêt ; les frais de garantie, qui dépendent du prêt, sont calculés par une formule exacte (prêt = emplois hors frais de garantie − apport + frais de garantie) ;
   - assurance emprunteur : cotisation constante, calculée sur le capital initial, par garantie et par emprunteur, au prorata de la quotité ; tarif fictif de la banque ;
   - TAEG : taux actuariel en mois d'un douzième d'année ; flux = mensualités (+ cotisations d'assurance) ; montant net reçu = capital − frais de dossier − frais de garantie ;
   - TAEA = TAEG avec l'assurance − TAEG sans l'assurance (décret n° 2014-1190 du 15 octobre 2014) ;
   - endettement : mensualités de crédit en cours (toutes banques) + mensualité du nouveau prêt, assurance comprise, sur les revenus du foyer. */
(function (root) {
  "use strict";

  var B = root && root.SGBF ? root.SGBF.banque : require("./banque.js");
  var PR = root && root.SGBF ? root.SGBF.produits : require("./produits.js");
  var EL = root && root.SGBF ? root.SGBF.eligibilite : require("./eligibilite.js");
  var S = root && root.SGBF ? root.SGBF.synthese : require("./synthese.js");
  var R = root && root.SGBF ? root.SGBF.pret : require("./pret.js");
  var K = root && root.SGBF ? root.SGBF.catalogue : require("./catalogue.js");
  var SA = root && root.SGBF ? root.SGBF.sante : require("./sante.js");   /* questionnaire de santé de l'assurance emprunteur ; absent d'une page : retour à la simple pièce à cocher */

  /* Mesure de protection juridique du client (protection.js) : chargée à la demande, absente d'une page qui n'en a pas besoin. */
  function protection() { return root && root.SGBF && root.SGBF.protection ? root.SGBF.protection : (typeof require === "function" ? require("./protection.js") : null); }

  var PRODUITS = R.PRODUITS_PRET.slice();
  var ETAPES = [{ n: 1, lib: "Projet et financement" }, { n: 2, lib: "Pièces justificatives" }, { n: 3, lib: "Analyse de la solvabilité" }, { n: 4, lib: "Décision et offre" }];
  var OBJETS = {
    ancien: "Acquisition de la résidence principale – bien ancien",
    neuf: "Acquisition de la résidence principale – bien neuf (achat sur plan)",
    construction: "Construction de la résidence principale"
  };
  var DUREE_DEFAUT = { CIMMO: 240, CCONSO: 48, CAUTO: 60, CTRAV: 60 };
  var MONTANT_MAX = 10000000; /* par ligne du plan, en euros */
  /* Frais d'acquisition (« frais de notaire ») : ordres de grandeur seulement, l'élève saisit le montant. */
  var FRAIS_NOTAIRE = { ancien: 7.5, neuf: 2.5 };
  var HCSF = EL.HCSF_TAUX;
  var DELAI_REFLEXION = 10, VALIDITE_OFFRE = 30, RETRACTATION = 14;

  /* ---------- plan de financement : lignes par crédit ---------- */
  var LIGNES = {
    CIMMO: [{ k: "bien", lib: "Bien financé", req: true }, { k: "travaux", lib: "Travaux" }, { k: "notaire", lib: "Frais de notaire" }, { auto: "dossier", lib: "Frais de dossier" }, { auto: "garantie", lib: "Frais de garantie" }, { k: "agence", lib: "Frais d'agence" }, { k: "courtage", lib: "Frais de courtage" }],
    CAUTO: [{ k: "bien", lib: "Prix du véhicule", req: true }, { k: "autres", lib: "Autres frais (carte grise, options…)" }],
    CTRAV: [{ k: "travaux", lib: "Travaux (montant des devis)", req: true }, { k: "autres", lib: "Autres frais" }],
    CCONSO: [{ k: "bien", lib: "Projet à financer", req: true }]
  };

  /* ---------- garanties du prêt (sûretés) ---------- */
  /* Coût en pourcentage du prêt : milieu des fourchettes publiées (caution mutuelle 1 % à 1,5 % ; hypothèque 1,5 % à 2 % ; PPD 0,5 % à 1 %) ; tarifs fictifs de la banque. */
  var SURETES = {
    scm: { lib: "Société de cautionnement mutuel", taux: 1.25, pour: ["CIMMO"], couvre: "tout" },
    hyp: { lib: "Hypothèque", taux: 1.75, pour: ["CIMMO"], couvre: "bien" },
    ppd: { lib: "Privilège de prêteur de deniers (PPD)", taux: 0.75, pour: ["CIMMO"], objets: ["ancien"], couvre: "bien" },
    cs: { lib: "Caution personnelle simple", taux: 0, pour: ["CCONSO", "CAUTO", "CTRAV"], couvre: "engagement" },
    csol: { lib: "Caution personnelle solidaire", taux: 0, pour: ["CCONSO", "CAUTO", "CTRAV"], couvre: "engagement" },
    aucune: { lib: "Aucune garantie", taux: 0, pour: ["CCONSO", "CAUTO", "CTRAV"], couvre: "rien" }
  };
  var ORDRE_SURETES = ["scm", "hyp", "ppd", "cs", "csol", "aucune"];
  var SURETE_DEFAUT = { CIMMO: "scm", CCONSO: "aucune", CAUTO: "aucune", CTRAV: "aucune" };
  function suretesPossibles(p, objet) {
    return ORDRE_SURETES.filter(function (id) { var s = SURETES[id]; return s.pour.indexOf(p) >= 0 && (!s.objets || s.objets.indexOf(objet) >= 0); });
  }

  /* ---------- assurance emprunteur ---------- */
  var ROWS_ASS = [
    { k: "socle", lib: "Décès et PTIA", gar: ["Décès", "PTIA"], detail: "Décès et perte totale et irréversible d'autonomie (PTIA) : garanties minimales, exigées en pratique pour un prêt immobilier." },
    { k: "ipt", lib: "IPT", gar: ["IPT"], detail: "Invalidité permanente totale : taux d'invalidité d'au moins 66 %." },
    { k: "ipp", lib: "IPP", gar: ["IPP"], detail: "Invalidité permanente partielle : taux d'invalidité de 33 % à 66 %." },
    { k: "pe", lib: "Perte d'emploi", gar: ["Perte d'emploi"], detail: "Prise en charge d'une partie des mensualités en cas de licenciement d'un salarié en CDI, hors période d'essai." }
  ];
  var ROW_PAR_ID = {}; ROWS_ASS.forEach(function (r) { ROW_PAR_ID[r.k] = r; });
  /* Tarif fictif de la banque, en pourcentage du capital initial par an, pour 100 % de quotité ; ordre de grandeur calibré sur l'assurance des crédits des dossiers clients (0,23 % à 0,33 %). */
  var TARIF_SOCLE = [{ ageMax: 29, taux: 0.04 }, { ageMax: 39, taux: 0.06 }, { ageMax: 49, taux: 0.09 }, { ageMax: 59, taux: 0.14 }, { ageMax: Infinity, taux: 0.25 }];
  var TARIF_OPT = { ipt: 0.05, ipp: 0.06, pe: 0.08 };
  function tauxAssurance(k, age) {
    if (k === "socle") return TARIF_SOCLE.filter(function (x) { return age <= x.ageMax; })[0].taux;
    return TARIF_OPT[k];
  }
  var AGE_FIN_GARANTIES = 65; /* les garanties d'invalidité et la PTIA cessent souvent à 65 ans (parfois 70 ans pour la PTIA), selon les contrats */
  var SANTE = { capitalMax: 200000, ageMax: 60 }; /* loi Lemoine : pas de questionnaire de santé jusqu'à 200 000 € assurés par personne si le prêt prend fin avant les 60 ans */

  /* ---------- taux d'usure du crédit à la consommation (4e trimestre 2026) ---------- */
  var USURE_CONSO = { trimestre: "4e trimestre 2026", paliers: [{ montantMax: 3000, lib: "jusqu'à 3 000 €", taux: 23.60 }, { montantMax: 6000, lib: "de plus de 3 000 € à 6 000 €", taux: 15.76 }, { montantMax: Infinity, lib: "plus de 6 000 €", taux: 8.56 }] };
  function usureConso(capital) { return USURE_CONSO.paliers.filter(function (x) { return capital <= x.montantMax; })[0]; }

  /* ---------- outils ---------- */
  function pl(n, s, p) { return B.nb(n) + " " + (n > 1 ? p : s); }
  function eur(x) { return B.eur2(x); }
  function nomFull(c) { return c.civ + " " + c.prenom + " " + c.nom.toUpperCase(); }
  /* Montant saisi → centimes. { vide: true } si vide, { err: true } si ce n'est pas un montant en euros (deux décimales au plus). */
  function lireCentimes(t) {
    var s = String(t == null ? "" : t).replace(/[\s  ]/g, "").replace(",", ".");
    if (s === "") return { vide: true, c: 0 };
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return { err: true, c: 0 };
    return { c: Math.round(parseFloat(s) * 100) };
  }
  function demi(num, den) { return Math.floor((2 * num + den) / (2 * den)); } /* num ÷ den arrondi à la moitié supérieure (entiers positifs) */
  function ymdOk(t) { return B.lireYmd(t); }
  function ajoutJours(d, n) { return B.plusJours(d, n); }

  /* ---------- création et enregistrement du dossier ---------- */
  function nouvelId() { return "m" + B.maintenant().getTime().toString(36) + Math.random().toString(36).slice(2, 6); }
  function nouveau(c, pid) {
    var j = B.ymd(B.aujourdhui());
    return {
      id: nouvelId(), c: c.id, p: pid, statut: "brouillon", etape: 1, cree: j, maj: j,
      objet: pid === "CIMMO" ? "ancien" : "", libelle: "", compromis: "", condSusp: "", reiteration: "", notaire: "",
      plan: { bien: "", travaux: "", notaire: "", agence: "", courtage: "", autres: "", apport: "" },
      dureeMois: DUREE_DEFAUT[pid], taux: "", garantie: SURETE_DEFAUT[pid], engagement: "", co: false, rachat: false, ptz: false, relais: false,
      assurance: { souscrite: true, q: { socle: [100, 0], ipt: [0, 0], ipp: [0, 0], pe: [0, 0] } },
      pieces: {}, scans: {}, sante: {}, bale: "",
      avis: "", motivation: "", contreparties: [], canal: "", passeOutre: false,
      decision: null, offre: null
    };
  }
  function dossiers(st) { return (st && Array.isArray(st.montages)) ? st.montages : []; }
  function trouver(st, id) { return dossiers(st).filter(function (d) { return d.id === id; })[0] || null; }
  function dossiersClient(st, cid) { return dossiers(st).filter(function (d) { return d.c === cid; }); }
  function enregistrer(st, d) {
    if (!Array.isArray(st.montages)) st.montages = [];
    d.maj = B.ymd(B.aujourdhui());
    var i = st.montages.map(function (x) { return x.id; }).indexOf(d.id);
    if (i >= 0) st.montages[i] = d; else st.montages.push(d);
    return d;
  }
  function supprimer(st, id) { var n = dossiers(st).length; st.montages = dossiers(st).filter(function (d) { return d.id !== id; }); return st.montages.length < n; }
  /* Un dossier « accordé » dont la souscription a été annulée (catalogue, « Mes souscriptions ») est un dossier annulé. */
  function statutAffiche(st, d) {
    if (d.statut === "accorde") return K.souscriptions(st).some(function (s) { return s.dossier === d.id; }) ? "accorde" : "annule";
    return d.statut;
  }
  function rouvrir(st, d) {
    if (statutAffiche(st, d) !== "annule") return false;
    d.statut = "brouillon"; d.etape = 4; d.decision = null; d.offre = null; d.avis = ""; d.motivation = ""; d.passeOutre = false;
    return true;
  }

  /* ---------- emprunteurs ---------- */
  var LIB_CONJ = { marie: { M: "époux", F: "épouse" }, pacse: { M: "partenaire de PACS", F: "partenaire de PACS" }, concubinage: { M: "concubin", F: "concubine" } };
  function conjoint(c) { return c.fam && c.fam.conj ? c.fam.conj : null; }
  function personnes(d, c) {
    var P = [{ role: "Emprunteur", nom: nomFull(c), age: c.age, statut: c.pro.statut, ctr: c.pro.ctr || "", client: true }];
    var cj = conjoint(c);
    if (d.co && cj) {
      var lib = (LIB_CONJ[c.fam.sit] || { M: "conjoint", F: "conjointe" })[cj.sexe] || "conjoint(e)";
      P.push({ role: "Co-emprunteur", nom: cj.prenom + " (" + lib + " de " + c.prenom + ")", age: cj.age, statut: cj.statut, ctr: "", client: false });
    }
    return P;
  }
  function perteEmploiPossible(p) { return p.client ? (p.statut === "salarie" && p.ctr === "CDI") : p.statut === "salarie"; }

  /* ---------- TAEG : taux actuariel mensuel puis annuel ---------- */
  /* flux : montants versés à la fin de chaque mois (centimes), net : montant reçu (centimes). Renvoie le taux annuel effectif en %, ou null. */
  function taegDepuis(flux, net) {
    if (!(net > 0)) return null;
    var tot = 0, i; for (i = 0; i < flux.length; i++) tot += flux[i];
    if (tot < net) return null;
    function f(r) { var v = 0, a = 1 / (1 + r), p = 1; for (var k = 0; k < flux.length; k++) { p *= a; v += flux[k] * p; } return v - net; }
    var lo = 0, hi = 1, m, it;
    for (it = 0; it < 200; it++) { m = (lo + hi) / 2; if (f(m) > 0) lo = m; else hi = m; }
    return (Math.pow(1 + (lo + hi) / 2, 12) - 1) * 100;
  }

  /* ---------- plan de financement et prêt ---------- */
  function erreur(champ, msg) { return { champ: champ, msg: msg }; }
  function planFinancement(d, c, E) {
    var p = d.p, prod = R.produitPret(p), L = LIGNES[p], lignes = [], somme = 0, dossier = prod.fraisDossier ? prod.fraisDossier * 100 : 0, i, x, ok = true;
    var vals = {};
    L.forEach(function (l) {
      if (l.auto) return;
      x = lireCentimes(d.plan[l.k]);
      if (x.err || x.c > MONTANT_MAX * 100) { E.push(erreur("plan-" + l.k, l.lib + " : saisissez un montant en euros, avec deux décimales au plus (exemple : 167 500 ou 2 080,50).")); ok = false; vals[l.k] = 0; return; }
      if (l.req && (x.vide || x.c <= 0)) { E.push(erreur("plan-" + l.k, l.lib + " : ce montant est obligatoire.")); ok = false; }
      vals[l.k] = x.c; somme += x.c;
    });
    var ap = lireCentimes(d.plan.apport);
    if (ap.err || ap.c > MONTANT_MAX * 100) { E.push(erreur("plan-apport", "Apport personnel : saisissez un montant en euros (0 si le client n'apporte rien).")); ok = false; ap = { c: 0 }; }
    var apport = ap.c, s = SURETES[d.garantie], bp = s ? Math.round(s.taux * 100) : 0;
    if (!ok) return null;
    var base = somme + dossier;
    if (apport >= base) { E.push(erreur("plan-apport", "L'apport personnel doit rester inférieur au total des dépenses : sinon le client n'a pas besoin de crédit.")); return null; }
    /* Frais de garantie inclus dans le prêt : fg = (base − apport) × p ÷ (1 − p), arrondi au centime, donc prêt = base − apport + fg et fg ≈ p × prêt. */
    var fg = p === "CIMMO" && bp ? demi((base - apport) * bp, 10000 - bp) : 0;
    L.forEach(function (l) {
      if (l.auto === "dossier") { if (dossier) lignes.push({ k: "dossier", lib: l.lib, montant: dossier / 100, auto: true }); }
      else if (l.auto === "garantie") { if (p === "CIMMO") lignes.push({ k: "garantie", lib: l.lib, montant: fg / 100, auto: true }); }
      else lignes.push({ k: l.k, lib: l.lib, montant: vals[l.k] / 100, auto: false });
    });
    var pret = base - apport + fg, emplois = base + fg;
    return { lignes: lignes, emplois: emplois / 100, apport: apport / 100, pret: pret / 100, ressources: (apport + pret) / 100, fraisDossier: dossier / 100, fraisGarantie: fg / 100, tauxGarantie: s ? s.taux : 0,
      partApport: emplois ? 100 * apport / emplois : 0, prix: (vals.bien || 0) / 100, travaux: (vals.travaux || 0) / 100, centimes: { pret: pret, apport: apport, fg: fg, dossier: dossier, emplois: emplois } };
  }

  /* ---------- garantie du prêt : coût et risque ---------- */
  function garantie(d, plan, E) {
    var s = SURETES[d.garantie];
    if (!s || suretesPossibles(d.p, d.objet).indexOf(d.garantie) < 0) { E.push(erreur("garantie", "Choisissez une garantie parmi celles proposées pour ce crédit.")); return null; }
    var capital = plan ? plan.pret : 0, couvert = 0, eng = null;
    if (s.couvre === "tout") couvert = capital;
    else if (s.couvre === "bien") couvert = plan ? Math.min(capital, plan.prix + plan.travaux) : 0;
    else if (s.couvre === "engagement") {
      var x = lireCentimes(d.engagement);
      if (x.err || x.vide || x.c <= 0) { E.push(erreur("engagement", "Montant garanti par la caution : saisissez un montant en euros, supérieur à 0.")); return null; }
      if (plan && x.c / 100 > plan.pret + 1e-9) { E.push(erreur("engagement", "Le montant garanti par la caution ne peut pas dépasser le prêt (" + eur(plan.pret) + ").")); return null; }
      eng = x.c / 100; couvert = eng;
    }
    var frais = plan ? plan.fraisGarantie : 0;
    return { id: d.garantie, lib: s.lib, tauxFrais: s.taux, frais: frais, nominal: capital, couvert: couvert, residuel: Math.max(0, Math.round((capital - couvert) * 100) / 100), engagement: eng, typeCouverture: s.couvre };
  }

  /* ---------- assurance emprunteur ---------- */
  function lireQuotite(v) {
    if (v === "" || v == null) return 0;
    var n = Number(v);
    return isFinite(n) && n === Math.round(n) ? n : NaN;
  }
  /* Calcule la cotisation et contrôle les quotités. capital en euros, n = durée en mois. */
  function assurance(d, c, capital, n, E) {
    var P = personnes(d, c), co = P.length > 1, souscrite = d.p === "CIMMO" ? true : !!(d.assurance && d.assurance.souscrite);
    var res = { souscrite: souscrite, personnes: P, lignes: [], mensuel: 0, annuel: 0, total: 0, tauxAnnuel: 0, avertissements: [], notes: [] };
    if (!souscrite) return res;
    var Cc = Math.round(capital * 100), den = 12 * 1000000, mensC = 0, rows = [];
    ROWS_ASS.forEach(function (row) {
      var qs = P.map(function (p, i) { var q = lireQuotite(d.assurance && d.assurance.q && d.assurance.q[row.k] ? d.assurance.q[row.k][i] : 0); return q; });
      var bad = qs.some(function (q) { return isNaN(q) || q < 0 || q > 100 || q % 10 !== 0; });
      if (bad) { E.push(erreur("ass-" + row.k, row.lib + " : la quotité de chaque emprunteur est un multiple de 10 %, de 0 % à 100 %.")); return; }
      var somme = qs.reduce(function (t, q) { return t + q; }, 0), couverte = somme > 0;
      if (!co && couverte && qs[0] !== 100) E.push(erreur("ass-" + row.k, row.lib + " : un emprunteur seul est assuré à 100 %."));
      if (row.k === "socle" && somme < 100) E.push(erreur("ass-socle", "Décès et PTIA : les quotités de l'ensemble des emprunteurs doivent totaliser au moins 100 % pour couvrir le prêt." + (d.p === "CIMMO" ? " Ces garanties sont exigées pour un prêt immobilier." : "")));
      else if (couverte && somme < 100) E.push(erreur("ass-" + row.k, row.lib + " : si cette garantie est choisie, les quotités doivent totaliser au moins 100 % du prêt."));
      var par = P.map(function (p, i) {
        var q = qs[i], tx = tauxAssurance(row.k, p.age), m = q ? demi(Cc * Math.round(tx * 100) * q, den) : 0;
        if (q && row.k === "pe" && !perteEmploiPossible(p)) E.push(erreur("ass-pe", "Perte d'emploi : " + p.nom + " n'est pas assurable (garantie réservée aux salariés en CDI)."));
        var ageTerme = p.age + n / 12;
        if (q && row.k === "socle" && ageTerme > AGE_FIN_GARANTIES) res.avertissements.push(p.nom + " aura " + Math.floor(ageTerme) + " ans à la fin du prêt : la PTIA cesse souvent à " + AGE_FIN_GARANTIES + " ou 70 ans, selon les contrats.");
        else if (q && (row.k === "ipt" || row.k === "ipp") && ageTerme > AGE_FIN_GARANTIES) res.avertissements.push(p.nom + " aura " + Math.floor(ageTerme) + " ans à la fin du prêt : la garantie " + row.lib + " cesse souvent à " + AGE_FIN_GARANTIES + " ans, selon les contrats.");
        return { q: q, taux: tx, mens: m / 100 };
      });
      var mrow = par.reduce(function (t, x) { return t + Math.round(x.mens * 100); }, 0);
      mensC += mrow;
      rows.push({ k: row.k, lib: row.lib, gar: row.gar, detail: row.detail, couverte: couverte, somme: somme, par: par, mensuel: mrow / 100 });
    });
    res.lignes = rows;
    res.mensuel = mensC / 100; res.annuel = mensC * 12 / 100; res.total = mensC * n / 100;
    res.tauxAnnuel = Cc ? 100 * (mensC * 12) / Cc : 0;
    /* Questionnaire de santé : plus exigé pour un prêt immobilier si le capital assuré par personne est d'au plus 200 000 € et si le prêt prend fin avant les 60 ans. */
    res.sante = P.map(function (p, i) {
      var assure = Math.max.apply(null, [0].concat(rows.filter(function (r) { return r.par[i] && r.par[i].q > 0; }).map(function (r) { return capital * r.par[i].q / 100; })));
      var ageTerme = p.age + n / 12, nonAssure = assure <= 0, dispense = nonAssure || (d.p === "CIMMO" && assure <= SANTE.capitalMax && ageTerme < SANTE.ageMax);
      return { i: i, nom: p.nom, assure: assure, dispense: dispense, nonAssure: nonAssure, ageTerme: ageTerme, aeras: SA ? SA.aeras(assure, ageTerme) : true };
    });
    var gars = []; rows.forEach(function (r) { if (r.couverte) gars = gars.concat(r.gar); });
    res.garanties = gars;
    return res;
  }
  /* Phrase qui résume les garanties et quotités, pour le dossier imprimé et l'offre. */
  function resumeAssurance(a) {
    if (!a.souscrite) return "Pas d'assurance emprunteur.";
    var seul = a.personnes.length === 1;
    return a.lignes.filter(function (r) { return r.couverte; }).map(function (r) {
      return r.gar.join(", ") + " : " + (seul ? "100 %" : a.personnes.map(function (p, i) { return (r.par[i].q || 0) + " % (" + p.role.toLowerCase() + ")"; }).join(" et "));
    }).join(" ; ");
  }

  /* ---------- évaluation complète du dossier ---------- */
  function etatSaisie(d, c, st) {
    var E = [], p = R.produitPret(d.p), a = { d: d, c: c, p: p, erreurs: E, plan: null, pret: null, garantie: null, assurance: null, couts: null };
    if (!c || !p) { E.push(erreur("client", "Client ou crédit inconnu.")); a.etape1Ok = false; return a; }
    if (d.p === "CIMMO") {
      if (!OBJETS[d.objet]) E.push(erreur("objet", "Choisissez l'objet du financement."));
      if (d.objet !== "construction") {
        var dc = ymdOk(d.compromis), ds = ymdOk(d.condSusp), dr = ymdOk(d.reiteration);
        var nomPiece = d.objet === "neuf" ? "du contrat de réservation" : "du compromis de vente";
        if (!dc) E.push(erreur("compromis", "Date " + nomPiece + " : saisissez une date valide."));
        if (!ds) E.push(erreur("condSusp", "Date limite d'obtention du prêt : saisissez une date valide."));
        else if (dc && ds < dc) E.push(erreur("condSusp", "La date limite d'obtention du prêt ne peut pas être antérieure à la signature."));
        if (!dr) E.push(erreur("reiteration", "Date de signature de l'acte authentique : saisissez une date valide."));
        else if (dc && dr < dc) E.push(erreur("reiteration", "La date de signature de l'acte authentique ne peut pas être antérieure à la signature " + nomPiece + "."));
      }
    }
    if (!String(d.libelle || "").trim()) E.push(erreur("libelle", d.p === "CIMMO" ? "Décrivez le bien financé (adresse, surface…)." : d.p === "CAUTO" ? "Indiquez le véhicule financé (marque, modèle, neuf ou occasion)." : d.p === "CTRAV" ? "Indiquez la nature des travaux." : "Indiquez l'objet du crédit."));
    if (String(d.libelle || "").length > 200) E.push(erreur("libelle", "Le texte est limité à 200 caractères."));
    var cj = conjoint(c);
    if (d.co && !cj) E.push(erreur("co", "Ce client n'a pas de conjoint ou partenaire dans son dossier."));
    var plan = planFinancement(d, c, E);
    a.plan = plan;
    /* durée et taux */
    var n = Number(d.dureeMois), duree = isFinite(n) && n === Math.round(n) ? n : NaN, tc = null, taux = null;
    if (!(duree >= p.dureeMin) || duree > p.dureeMax) E.push(erreur("duree", "La durée doit être comprise entre " + R.libDuree(p.dureeMin) + " et " + R.libDuree(p.dureeMax) + " pour ce crédit."));
    else {
      tc = R.tauxCatalogue(d.p, duree);
      if (!tc) E.push(erreur("duree", "Le catalogue ne donne pas de taux pour cette durée."));
      else {
        var t = String(d.taux == null ? "" : d.taux).trim();
        if (t === "") taux = tc.taux;
        else {
          taux = R.lireNombre(t);
          if (isNaN(taux) || taux > R.LIM.tauxMax || Math.abs(taux * 1000 - Math.round(taux * 1000)) > 1e-6) { E.push(erreur("taux", "Le taux doit être compris entre 0 % et " + R.LIM.tauxMax + " %, avec trois décimales au plus.")); taux = null; }
          else if (taux < tc.taux - 5e-4) { E.push(erreur("taux", "Le taux proposé ne peut pas être inférieur à celui du catalogue (" + R.pctTaux(tc.taux) + ").")); taux = null; }
        }
      }
    }
    a.dureeMois = duree; a.tauxCatalogue = tc; a.taux = taux;
    if (plan) {
      if (p.capitalMin && plan.pret < p.capitalMin) E.push(erreur("plan-apport", "Le prêt (" + eur(plan.pret) + ") est inférieur au minimum du " + p.nom + " (" + eur(p.capitalMin) + ")."));
      if (p.capitalMax && plan.pret > p.capitalMax) E.push(erreur("plan-apport", "Le prêt (" + eur(plan.pret) + ") dépasse le maximum du " + p.nom + " (" + eur(p.capitalMax) + ")."));
    }
    a.garantie = garantie(d, plan, E);
    if (plan && duree >= p.dureeMin && duree <= p.dureeMax && !isNaN(duree)) a.assurance = assurance(d, c, plan.pret, duree, E);
    a.etape1Ok = !E.length;
    return a;
  }

  function calculPret(a) {
    var d = a.d, plan = a.plan, r = R.calculer({ inconnue: "mensualite", produit: d.p, capital: plan.pret, dureeMois: a.dureeMois, taux: a.taux });
    if (!r.ok) { a.erreurs.push(erreur("plan-apport", r.erreur)); a.etape1Ok = false; return; }
    var as = a.assurance, prime = as.souscrite ? Math.round(as.mensuel * 100) : 0, n = r.nbEcheances;
    var net = Math.round(plan.pret * 100) - Math.round(plan.fraisDossier * 100) - Math.round(plan.fraisGarantie * 100);
    var fluxSans = r.echeances.map(function (l) { return Math.round(l.pay * 100); }), fluxAvec = fluxSans.map(function (x) { return x + prime; });
    var taegSans = taegDepuis(fluxSans, net), taegAvec = prime ? taegDepuis(fluxAvec, net) : taegSans;
    var obligatoire = d.p === "CIMMO"; /* l'assurance entre dans le TAEG quand elle est exigée pour obtenir le crédit */
    var taeg = obligatoire ? taegAvec : taegSans, taea = prime ? taegAvec - taegSans : null;
    var us = d.p === "CIMMO" ? R.usurePour(a.p, n) : usureConso(plan.pret), tr = d.p === "CIMMO" ? a.p.usure.trimestre : USURE_CONSO.trimestre;
    var taeg2 = Math.round(taeg * 100) / 100;
    a.pret = { res: r, capital: plan.pret, dureeMois: n, taux: a.taux, mensualite: r.mensualite, derniere: r.derniere, interets: r.interets, totalRembourse: r.total, echeances: r.echeances, lignes: r.lignes, tauxEffectif: r.tauxEffectif };
    a.couts = {
      prime: prime / 100, mensualiteAC: (Math.round(r.mensualite * 100) + prime) / 100, derniereAC: (Math.round(r.derniere * 100) + prime) / 100,
      taeg: taeg, taegSans: taegSans, taegAvec: taegAvec, taea: taea, taegObligatoire: obligatoire,
      fraisDossier: plan.fraisDossier, fraisGarantie: plan.fraisGarantie, coutAssurance: as.souscrite ? as.total : 0,
      /* coût total du crédit : intérêts + frais de dossier + frais de garantie + assurance (obligatoire pour le prêt immobilier ; facultative sinon, donnée à part) */
      coutTotal: (Math.round(r.interets * 100) + Math.round(plan.fraisDossier * 100) + Math.round(plan.fraisGarantie * 100) + (obligatoire ? Math.round(as.total * 100) : 0)) / 100,
      montantTotalDu: (Math.round(r.total * 100) + Math.round(plan.fraisDossier * 100) + Math.round(plan.fraisGarantie * 100) + (as.souscrite ? Math.round(as.total * 100) : 0)) / 100,
      usure: us ? { trimestre: tr, lib: us.lib, taux: us.taux, depasse: taeg2 > us.taux, taeg2: taeg2 } : null
    };
  }

  /* ---------- pièces justificatives ---------- */
  /* Prêt immobilier : les pièces sont celles du document « Documents à fournir pour l'étude de votre demande de prêt » (js/documents_pret.js, même texte que dans
     « Courriers et documents »), choisies selon le projet (acquisition, travaux, construction), les options cochées à l'étape 1 (rachat de créance, prêt à taux zéro,
     prêt relais) et la situation du client. Les pièces que le document ne réclame que dans un cas particulier (« cond ») se cochent mais ne comptent pas parmi les pièces manquantes. */
  function documentsPret() { return root ? root.SGBF.documentsPret : require("./documents_pret.js"); }
  function groupesImmo(d, c, a, P) {
    var DP = documentsPret(), G = [], co = P.length > 1, nom0 = co ? P[0].nom : "";
    function pc(id, nom, suffixeId) {
      var x = DP.PAR_ID[id], suf = nom ? " – " + nom : "";
      var seg = Array.isArray(x.lib) ? x.lib.map(function (m) { return [m[0], !!m[1]]; }) : [[x.lib, x.gras]];
      if (suf) seg.push([suf, false]);
      return { id: id + (suffixeId || ""), lib: DP.texte(x) + suf, gras: seg.some(function (m) { return m[1]; }), cond: x.cond, seg: seg };
    }
    function parPersonne(id, garde) { return P.reduce(function (l, x, i) { return garde(x) ? l.concat(pc(id, co ? x.nom : "", i ? "_co" : "")) : l; }, []); }
    function groupe(rid, items) { if (items.length) G.push({ lib: DP.titreCourt(DP.RUBRIQUE_PAR_ID[rid]), rubrique: rid, items: items }); }
    var sit = c.fam.sit, enf = c.fam.enf && c.fam.enf.length, projetOk = a && a.plan, travaux = projetOk && a.plan.travaux > 0, caf = c.m && c.m.rev && c.m.rev.some(function (x) { return x.k === "caf"; });
    var ec = [pc("cni", nom0)];
    if (co) ec.push(pc("cni", P[1].nom, "_co"));
    ec.push(pc("dom"));
    if (enf || sit === "marie") ec.push(pc("livret"));
    if (sit === "marie" || sit === "pacse") ec.push(pc("couple"));
    if (sit === "divorce") ec.push(pc("divorce"));
    if (sit === "marie") ec.push(pc("instance"));
    groupe("etat_civil", ec);
    groupe("pro", [].concat(parPersonne("bulletins", function (x) { return x.statut !== "independant"; }), [pc("avis")], parPersonne("contrat", function (x) { return x.statut === "salarie"; }),
      caf ? [pc("caf")] : [], parPersonne("liasses", function (x) { return x.statut === "independant"; }), [pc("locatif")]));
    groupe("finance", [].concat(c.cre && c.cre.length ? [pc("echeanciers")] : [], projetOk && a.plan.apport > 0 ? [pc("epargne")] : [], [pc("releves"), pc("rib"), pc("pel"), pc("cession")]));
    if (d.objet !== "construction") groupe("acquisition", [pc("compromis")]);
    if (d.objet !== "construction" && travaux) groupe("travaux", [pc("acte_travaux"), pc("autorisation")]);
    if (d.objet === "construction") groupe("construction", ["terrain", "permis", "plans", "contrat_construction", "devis", "materiaux"].map(function (id) { return pc(id); }));
    if (d.rachat) groupe("rachat", ["offre_rachat", "tableaux", "acte_acquisition", "taxe"].map(function (id) { return pc(id); }));
    if (d.ptz) groupe("ptz", ["location", "quittance", "avis_occupants"].map(function (id) { return pc(id); }));
    if (d.relais) groupe("relais", ["mandat", "avis_valeur"].map(function (id) { return pc(id); }));
    return G;
  }
  /* Crédit à la consommation (prêt personnel, crédit auto, prêt travaux) d'un emprunteur salarié en CDI : les pièces sont celles du document « Documents à fournir pour l'étude de votre demande de
     crédit à la consommation » (js/documents_pret.js, même texte que dans « Courriers et documents »). Un justificatif de financement est exigé pour tout prêt de plus de 15 000 € : pour un crédit auto ou un
     prêt travaux, le bon de commande ou le devis signé en tient lieu. Les autres emprunteurs (CDD, fonctionnaire, retraité, indépendant…) gardent la liste ci-dessous adaptée à leur situation. */
  function groupesConso(d, c, a, P, notes) {
    var DP = documentsPret(), X = DP.CONSO, G = [], co = P.length > 1, nom0 = co ? P[0].nom : "", pret = a && a.plan ? a.plan.pret : 0;
    function pc(id, nom, suffixeId, cond) {
      var x = X.PAR_ID[id], suf = nom ? " – " + nom : "";
      var seg = Array.isArray(x.lib) ? x.lib.map(function (m) { return [m[0], !!m[1]]; }) : [[x.lib, x.gras]];
      if (suf) seg.push([suf, false]);
      return { id: id + (suffixeId || ""), lib: DP.texte(x) + suf, gras: seg.some(function (m) { return m[1]; }), cond: cond === undefined ? x.cond : cond, seg: seg };
    }
    function groupe(rid, items) { if (items.length) G.push({ lib: DP.titreCourt(X.RUBRIQUE_PAR_ID[rid]), rubrique: rid, items: items }); }
    var ident = [pc("cni", nom0)];
    if (co) ident.push(pc("cni", P[1].nom, "_co"));
    ident.push(pc("dom"));
    groupe("identite", ident);
    var pro = [pc("bulletins", nom0)];
    if (co) revenusPiece(P[1].statut, "", "– " + P[1].nom).forEach(function (x, i) { pro.push({ id: "revco" + i, lib: x.lib, gras: false, cond: false }); });
    var contrat = pc("contrat", nom0); contrat.lib = "Contrat de travail" + (nom0 ? " – " + nom0 : ""); contrat.seg = [[contrat.lib, false]]; /* « si concerné » est ajouté à l'écran */
    pro.push(pc("avis"), contrat);
    groupe("pro", pro);
    groupe("comptes", [pc("releves"), pc("rib")]);
    var projet = [];
    if (d.p === "CAUTO") projet.push(pc("bon_commande", "", "", false));
    else if (d.p === "CTRAV") projet.push(pc("devis_travaux", "", "", false));
    else if (pret > X.SEUIL_JUSTIFICATIF) projet.push(pc("justif_financement", "", "", false));
    groupe("credit", projet);
    if (d.p === "CCONSO" && pret <= X.SEUIL_JUSTIFICATIF) notes.push("Prêt personnel jusqu'à " + B.eur(X.SEUIL_JUSTIFICATIF) + " : aucun justificatif de dépense n'est demandé.");
    if (d.p !== "CCONSO" && pret > X.SEUIL_JUSTIFICATIF) notes.push("Prêt de plus de " + B.eur(X.SEUIL_JUSTIFICATIF) + " : le " + (d.p === "CAUTO" ? "bon de commande" : "devis signé") + " tient lieu de justificatif de financement.");
    var autres = [];
    if (c.cre && c.cre.length) autres.push({ id: "credits", lib: "Offres et tableaux d'amortissement des crédits en cours (autres banques comprises)" });
    if (a && a.plan && a.plan.apport > 0) autres.push({ id: "apport", lib: "Justificatifs de l'apport personnel (relevés de comptes d'épargne, attestation de don ou de vente…)" });
    if (autres.length) G.push({ lib: "Crédits en cours et apport", items: autres });
    return G;
  }
  function revenusPiece(statut, ctr, suj) {
    var u = suj ? " " + suj : "";
    if (statut === "salarie" && ctr === "CDI") return [{ lib: "3 derniers bulletins de salaire" + u }];
    if (statut === "salarie") return [{ lib: "6 derniers bulletins de salaire" + u + " et contrats successifs" }];
    if (statut === "fonctionnaire") return [{ lib: "3 derniers bulletins de salaire" + u }];
    if (statut === "independant") return [{ lib: "3 derniers avis d'imposition" + u }, { lib: "Derniers bilans et liasses fiscales" + u }, { lib: "Extrait Kbis de moins de 3 mois" + u }];
    if (statut === "retraite") return [{ lib: "Relevé de pension ou attestation fiscale de pension" + u }];
    return [{ lib: "Justificatifs des ressources (notification d'allocation, contrat d'apprentissage, attestation de scolarité…)" + u }];
  }
  /* Questionnaire de santé d'un emprunteur : le dossier ne garde que la décision de l'assureur (jamais les réponses). La décision est périmée si la convention AERAS ne s'applique
     plus de la même façon (capital assuré ou durée modifiés après le questionnaire). */
  function decisionSante(d, id, aerasNow) {
    var x = d && d.sante && d.sante[id];
    return x ? { date: x.date, verdict: x.verdict, aeras: x.aeras, obsolete: x.aeras !== aerasNow } : null;
  }
  /* Une pièce est « reçue » quand elle est cochée ; le questionnaire de santé l'est quand l'assureur l'a accepté (et que la décision n'est pas périmée). */
  function pieceRecue(d, x) {
    if (x.sante) return !!(x.sante.decision && !x.sante.decision.obsolete && x.sante.decision.verdict === "accepte");
    return !!(d && d.pieces && d.pieces[x.id]);
  }
  /* Liste des pièces à réunir, par groupe. Chaque pièce a un identifiant stable (état « reçue et vérifiée » dans le dossier). */
  /* st : l'enregistrement (facultatif) ; il porte les « Autres documents » que le conseiller a ajoutés pour ce client. */
  function listePieces(d, c, a, st) {
    var cimmo = d.p === "CIMMO", G = [], P = personnes(d, c), co = P.length > 1, notes = [], doc = null;
    function groupe(lib, items) { G.push({ lib: lib, items: items }); }
    function it(id, lib) { return { id: id, lib: lib }; }
    if (cimmo) { G = groupesImmo(d, c, a, P); doc = "immo"; }
    else if (documentsPret().estCDI(c)) { G = groupesConso(d, c, a, P, notes); doc = "conso"; }
    else {
      var ident = [it("cni", "Pièce d'identité en cours de validité (carte nationale d'identité ou passeport)" + (co ? " – " + P[0].nom : ""))];
      if (co) ident.push(it("cni_co", "Pièce d'identité en cours de validité – " + P[1].nom));
      ident.push(it("dom", "Justificatif de domicile de moins de 3 mois"));
      if (c.log.st === "locataire") ident.push(it("log", "Contrat de bail"));
      else if (c.log.st === "proprietaire" || c.log.st === "accedant") ident.push(it("log", "Attestation de propriété du logement actuel"));
      else if (c.log.st === "heberge") ident.push(it("log", "Attestation de l'hébergeur et copie de sa pièce d'identité"));
      groupe("Identité et domicile", ident);
      var rev = revenusPiece(c.pro.statut, c.pro.ctr, co ? "– " + P[0].nom : "").map(function (x, i) { return it("rev" + i, x.lib); });
      if (co) revenusPiece(P[1].statut, "", "– " + P[1].nom).forEach(function (x, i) { rev.push(it("revco" + i, x.lib)); });
      rev.push(it("avis", "Dernier avis d'imposition"));
      groupe("Revenus", rev);
      var cpt = [it("releves", "3 derniers relevés de chacun des comptes bancaires du foyer (GS Banque & Assurance et autres banques)"), it("rib", "RIB pour le prélèvement des mensualités")];
      if (c.cre && c.cre.length) cpt.push(it("credits", "Offres et tableaux d'amortissement des crédits en cours (autres banques comprises)"));
      if (a && a.plan && a.plan.apport > 0) cpt.push(it("apport", "Justificatifs de l'apport personnel (relevés de comptes d'épargne, attestation de don ou de vente…)"));
      groupe("Comptes, charges et apport", cpt);
      var proj = [];
      if (d.p === "CAUTO") proj.push(it("projet", "Bon de commande du véhicule (nécessaire pour débloquer les fonds)"));
      else if (d.p === "CTRAV") proj.push(it("projet", "Devis signé des travaux (nécessaire pour débloquer les fonds)"));
      if (proj.length) groupe("Projet financé", proj);
    }
    if (cimmo && d.objet === "neuf") groupe("Garanties du promoteur", [it("garantie_achevement", "Garantie d'achèvement et garantie de remboursement en cas d'inachèvement")]);
    if (a && a.assurance && a.assurance.souscrite) {
      var sante = [];
      a.assurance.sante.forEach(function (s) {
        var id = s.i === 0 ? "sante" : "sante_co";
        if (s.nonAssure) notes.push("Questionnaire de santé de " + s.nom + " : non demandé (quotité de 0 % : cet emprunteur n'est pas assuré).");
        else if (s.dispense) notes.push("Questionnaire de santé de " + s.nom + " : non exigé (capital assuré d'au plus " + B.eur(SANTE.capitalMax) + " et prêt terminé avant les " + SANTE.ageMax + " ans de l'assuré).");
        else {
          var x = it(id, "Questionnaire de santé de " + s.nom);
          if (SA) x.sante = { i: s.i, nom: s.nom, aeras: s.aeras, decision: decisionSante(d, id, s.aeras) };
          sante.push(x);
        }
      });
      if (sante.length) groupe("Assurance emprunteur", sante);
    }
    groupe("Vérifications du dossier", [it("ficp", "Interrogation du fichier des incidents de remboursement des crédits aux particuliers (FICP) : aucune inscription"), it("fcc", "Interrogation du fichier central des chèques (FCC) : aucune inscription")]);
    var autres = documentsPret().autresDe(st, documentsPret().cleClient(c), cimmo ? "immo" : "conso");
    if (autres.length) G.splice(Math.max(0, G.length - 1), 0, { lib: "Autres documents demandés", rubrique: "autres", autres: true, items: autres.map(function (t) { return { id: documentsPret().idAutre(t), lib: t, gras: false, cond: false }; }) });
    var total = 0, recues = 0, manquantes = [];
    G.forEach(function (g) { g.items.forEach(function (x) { if (x.cond) return; total++; if (pieceRecue(d, x)) recues++; else manquantes.push(x); }); });
    return { groupes: G, total: total, recues: recues, manquantes: manquantes, complet: total === recues, notes: notes, doc: doc };
  }

  /* ---------- analyse de la solvabilité ---------- */
  /* Crédits déjà accordés dans cet outil pour ce client (autres dossiers) : leur mensualité compte dans l'endettement. */
  function creditsAccordes(st, c, d) {
    return dossiersClient(st, c.id).filter(function (x) { return x.id !== d.id && x.offre && statutAffiche(st, x) === "accorde"; });
  }
  function solvabilite(d, c, a, st) {
    var foyer = c.pro.foyer || 0, couts = a.couts, mensNouv = couts.mensualiteAC;
    var acc = creditsAccordes(st, c, d), mensAcc = acc.reduce(function (t, x) { return t + Math.round(x.offre.mensualiteAC * 100); }, 0) / 100;
    var avant = Math.round((EL.mensualites(c) + mensAcc) * 100) / 100;
    var apres = Math.round((avant + mensNouv) * 100) / 100, loyer = d.p !== "CIMMO" && c.log.st === "locataire" && c.log.loyer ? c.log.loyer : 0;
    var taux = function (x) { return foyer ? 100 * x / foyer : null; };
    var limite = foyer ? HCSF / 100 * foyer : 0;
    var enCours = c.cre.filter(function (x) { return B.echeancesPayees(x) < x.dur; }).map(function (x) {
      return { p: x.p, ext: x.ext || "", mens: Math.round((x.mens + (x.assM || 0)) * 100) / 100, restant: Math.max(0, x.dur - B.echeancesPayees(x)) };
    }).concat(acc.map(function (x) { return { p: x.p, ext: "", accorde: true, mens: x.offre.mensualiteAC, restant: x.offre.dureeMois }; }));
    return {
      foyer: foyer, avant: avant, mensNouv: mensNouv, apres: apres, loyer: loyer,
      tauxAvant: taux(avant), tauxApres: taux(apres), limite: limite, marge: Math.max(0, limite - avant), depasse: foyer ? apres > limite + 1e-9 : null,
      resteAvant: Math.round((foyer - avant - loyer) * 100) / 100, resteApres: Math.round((foyer - apres - loyer) * 100) / 100,
      creditsEnCours: enCours
    };
  }

  /* ---------- outil d'aide à la décision ---------- */
  function critere(id, ok, lib, detail, bloquant) { return { id: id, ok: ok, lib: lib, detail: detail, bloquant: !!bloquant }; }
  function aideDecision(d, c, st, a) {
    var C = [], sv = a.solva, pr = listePieces(d, c, a, st), ev = K.verdictClient(c, d.p, st), cimmo = d.p === "CIMMO";
    if (ev.verdict === "eligible") C.push(critere("elig", true, "Éligibilité au crédit", "Toutes les conditions vérifiables dans le dossier du client sont remplies."));
    else if (ev.verdict === "examiner") C.push(critere("elig", null, "Éligibilité au crédit", "À examiner : " + ev.doutes.join(" ")));
    else if (ev.verdict === "non") C.push(critere("elig", false, "Éligibilité au crédit", "Non éligible : " + ev.motifs.join(" "), true));
    else C.push(critere("elig", false, "Éligibilité au crédit", "Le client détient déjà ce crédit chez GS Banque & Assurance.", true));
    var PT = protection();
    if (PT && PT.mesure(c)) C.push(critere("protection", false, "Mesure de protection du client", PT.refusCredit(c), true));   /* le crédit d'un client protégé n'est pas enregistré dans l'exercice */
    C.push(critere("pieces", pr.complet, "Pièces justificatives et vérifications", pr.complet ? "Les " + pr.total + " éléments sont reçus et vérifiés." : pr.recues + " éléments sur " + pr.total + " : il manque " + pr.manquantes.map(function (x) { return x.lib; }).slice(0, 3).join(" ; ") + (pr.manquantes.length > 3 ? " ; …" : "") + ".", true));
    /* Questionnaire de santé : « étude par l'assureur » attend sa décision (dossier incomplet) ; « refus » empêche l'accord. Le dossier ne dit pas pourquoi : secret médical. */
    var qs = []; pr.groupes.forEach(function (g) { g.items.forEach(function (x) { var dc = x.sante && x.sante.decision; if (dc && !dc.obsolete && dc.verdict !== "accepte") qs.push({ nom: x.sante.nom, verdict: dc.verdict }); }); });
    qs.forEach(function (q) {
      C.push(critere("sante", q.verdict === "refus" ? false : null, "Questionnaire de santé de " + q.nom, "Décision de l'assureur – " + SA.libelle(q.verdict).toLowerCase() + " : " + SA.phrase("EMPRUNTEUR", q.verdict) + (personnes(d, c).length > 1 ? " Piste : assurer l'autre emprunteur à 100 % (étape 1, quotités)." : ""), q.verdict === "refus"));
    });
    if (sv.foyer) {
      var t = sv.tauxApres, txt = "Taux d'endettement de " + B.pct(Math.round(t * 10) / 10) + " avec le prêt, assurance comprise (limite de " + HCSF + " %" + (cimmo ? " fixée par le HCSF" : " : repère, la règle du HCSF concerne les crédits immobiliers") + ").";
      C.push(critere("endettement", sv.depasse ? (cimmo ? false : null) : true, "Taux d'endettement", txt + (sv.depasse && cimmo ? " Au-dessus de la limite : il faut une justification (marge de flexibilité du HCSF)." : "")));
      C.push(critere("reste", sv.resteApres > 0, "Reste à vivre", "Reste à vivre de " + eur(sv.resteApres) + " par mois après le prêt (revenus du foyer − mensualités de crédit" + (sv.loyer ? " − loyer" : "") + ").", true));
    } else {
      C.push(critere("endettement", null, "Taux d'endettement", "Les revenus du foyer ne sont pas renseignés : le taux d'endettement ne peut pas être calculé."));
    }
    var us = a.couts.usure;
    C.push(critere("usure", !us.depasse, "Taux d'usure", "TAEG de " + R.pct(us.taeg2) + " pour un seuil de " + R.pct(us.taux) + " (" + us.trimestre + ", " + us.lib + ")." + (us.depasse ? " L'offre serait refusée : le TAEG dépasse le taux d'usure." : ""), true));
    if (cimmo) {
      var ap = a.plan.prix ? 100 * a.plan.apport / a.plan.prix : 0;
      C.push(critere("apport", ap >= 10, "Apport personnel", "Apport de " + eur(a.plan.apport) + ", soit " + R.pct(ap) + " du prix du bien (apport conseillé : au moins 10 %)."));
    }
    var g = a.garantie;
    C.push(critere("garantie", g.residuel <= 0.004, "Garantie du prêt", g.lib + " : risque résiduel de " + eur(g.residuel) + " sur un risque nominal de " + eur(g.nominal) + "."));
    if (a.assurance.avertissements.length) C.push(critere("assurance", null, "Assurance emprunteur", a.assurance.avertissements.join(" ")));
    else C.push(critere("assurance", true, "Assurance emprunteur", a.assurance.souscrite ? "Garanties et quotités conformes : " + resumeAssurance(a.assurance) + "." : "Pas d'assurance : le client supporte seul le risque (décès, invalidité)."));
    if (cimmo && d.objet !== "construction") {
      var cs = ymdOk(d.condSusp), em = B.aujourdhui(), tot = ajoutJours(em, DELAI_REFLEXION + 1);
      if (cs) C.push(critere("calendrier", tot <= cs, "Calendrier de l'achat", tot <= cs ? "Le client pourra accepter l'offre (délai de réflexion de " + DELAI_REFLEXION + " jours) avant la date limite d'obtention du prêt (" + B.fmtDate(cs) + ")." : "La date limite d'obtention du prêt (" + B.fmtDate(cs) + ") arrive avant la fin du délai de réflexion de " + DELAI_REFLEXION + " jours : le client ne pourra pas accepter l'offre à temps."));
    }
    var bloquants = C.filter(function (x) { return x.ok === false && x.bloquant && x.id !== "pieces"; }), reserves = C.filter(function (x) { return x.ok !== true && !(x.ok === false && x.bloquant); });
    var verdict = bloquants.length ? "defavorable" : !pr.complet ? "incomplet" : reserves.filter(function (x) { return x.id !== "pieces"; }).length ? "examiner" : "favorable";
    var LIB = { favorable: "Avis favorable", examiner: "À examiner", defavorable: "Avis défavorable", incomplet: "Dossier incomplet" };
    var impossible = C.filter(function (x) { return x.ok === false && x.bloquant; });
    return { verdict: verdict, libelle: LIB[verdict], criteres: C, impossible: impossible, accordPossible: !impossible.length, pieces: pr };
  }

  /* Évaluation complète : saisie contrôlée, prêt, coûts, solvabilité, aide à la décision.
     Le prêt et ses coûts sont calculés dès que le plan de financement, la durée, le taux, la garantie et l'assurance sont corrects (même si d'autres champs de l'étape 1 sont à compléter) ;
     l'aide à la décision attend que toute l'étape 1 soit correcte. */
  function evaluer(d, c, st) {
    var a = etatSaisie(d, c, st);
    var bloque = a.erreurs.some(function (e) { return /^(plan|duree|taux|garantie|engagement|ass-)/.test(e.champ); });
    if (a.plan && a.assurance && a.garantie && a.taux != null && !bloque) calculPret(a);
    if (a.pret) a.solva = solvabilite(d, c, a, st);
    a.pieces = listePieces(d, c, a, st);
    if (a.etape1Ok && a.pret) a.aide = aideDecision(d, c, st, a);
    return a;
  }


  /* ---------- situation du client, pour le dossier (rédigée à partir de la fiche client) ---------- */
  var SITS = { celibataire: ["célibataire", "célibataire"], marie: ["marié", "mariée"], pacse: ["pacsé", "pacsée"], concubinage: ["en concubinage", "en concubinage"], divorce: ["divorcé", "divorcée"], veuf: ["veuf", "veuve"] };
  function fem(c, m, f) { return c.sexe === "F" ? f : m; }
  function maj1(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function situation(c) {
    var cj = conjoint(c), enf = c.fam.enf || [], pro = c.pro, P = [], il = fem(c, "Il", "Elle"), s1 = SITS[c.fam.sit] || ["", ""];
    var t = nomFull(c) + ", " + c.age + " ans, est " + fem(c, s1[0], s1[1]) + ".";
    if (cj) { var lc = (LIB_CONJ[c.fam.sit] || { M: "conjoint", F: "conjointe" })[cj.sexe]; t += " " + ((cj.sexe === "F" && !/^[aeiouyéèêh]/i.test(lc)) ? "Sa" : "Son") + " " + lc + ", " + cj.prenom + " (" + cj.age + " ans), est " + (cj.prof || "").toLowerCase() + (cj.rev ? ", pour un revenu de " + B.eur(cj.rev) + " par mois" : "") + "."; }
    if (enf.length) t += " Le foyer compte " + pl(enf.length, "enfant", "enfants") + " (" + enf.map(function (x) { return x.age + " ans"; }).join(", ") + ")" + (c.fam.nbCharge ? ", dont " + c.fam.nbCharge + " à charge" : "") + ".";
    else t += " " + il + " n'a pas d'enfant à charge.";
    P.push(t);
    var h = "";
    if (pro.statut === "salarie") h = il + " est " + pro.prof.toLowerCase() + " au sein de la société " + pro.emp + ", en " + pro.ctr + (pro.tp ? " à temps partiel" : "") + (pro.anc ? ", depuis " + pl(pro.anc, "an", "ans") : "") + ", pour un revenu net de " + B.eur(pro.rev) + " par mois.";
    else if (pro.statut === "fonctionnaire") h = il + " est " + pro.prof.toLowerCase() + " (" + pro.emp + "), " + String(pro.ctr || "").toLowerCase() + (pro.anc ? ", depuis " + pl(pro.anc, "an", "ans") : "") + ", pour un revenu net de " + B.eur(pro.rev) + " par mois.";
    else if (pro.statut === "independant") h = il + " est travailleur" + fem(c, "", "se") + " indépendant" + fem(c, "", "e") + " (" + pro.prof.toLowerCase() + ")" + (pro.anc ? " depuis " + pl(pro.anc, "an", "ans") : "") + ", pour un revenu de " + B.eur(pro.rev) + " par mois.";
    else if (pro.statut === "retraite") h = il + " est retraité" + fem(c, "", "e") + " (" + pro.prof.replace(/^Retrait[ée]e? – /, "") + "), avec une pension de " + B.eur(pro.rev) + " par mois.";
    else h = il + " est " + (S.LIB_STATUT[pro.statut] || pro.statut).toLowerCase() + (pro.rev ? ", avec des ressources de " + B.eur(pro.rev) + " par mois" : "") + ".";
    var lg = c.log;
    if (lg.st === "locataire") h += " " + il + " est locataire de son logement, " + c.adr.rue + ", " + c.adr.ville + " (" + c.adr.cp + "), pour un loyer de " + B.eur(lg.loyer) + " par mois" + (lg.depuis ? ", depuis " + pl(lg.depuis, "an", "ans") : "") + ".";
    else if (lg.st === "proprietaire") h += " " + il + " est propriétaire de sa résidence principale, " + c.adr.rue + ", " + c.adr.ville + " (" + c.adr.cp + ").";
    else if (lg.st === "accedant") h += " " + il + " est propriétaire de sa résidence principale (" + c.adr.rue + ", " + c.adr.ville + ", " + c.adr.cp + "), acquise avec un crédit encore en cours.";
    else h += " " + il + " est hébergé" + fem(c, "", "e") + " à titre gratuit (" + c.adr.ville + ", " + c.adr.cp + ").";
    P.push(h);
    var depuis = B.dateJours(c.depuis), dom = EL.revenusDomicilies(c), inc = c.inc ? c.inc.length : 0;
    var r = "Cli" + fem(c, "ent", "ente") + " de l'agence depuis le " + B.fmtDate(depuis) + ". " + (dom > 0 ? "Revenus domiciliés à GS Banque & Assurance : " + B.eur(dom) + " par mois (revenus du foyer : " + B.eur(pro.foyer) + ")." : "Aucun revenu domicilié à GS Banque & Assurance.") + " " + (inc ? "Le compte a connu " + pl(inc, "incident de fonctionnement", "incidents de fonctionnement") + "." : "Le compte fonctionne sans incident de fonctionnement recensé.");
    P.push(r);
    var eq = []; if (c.cartes.length) eq.push("équipé" + fem(c, "", "e")); if (c.ass.length) eq.push("assuré" + fem(c, "", "e")); if (c.epa.length || c.plc.length) eq.push("épargnant" + fem(c, "", "e"));
    var rows = [];
    c.epa.forEach(function (x) { rows.push({ cat: PR.parId[x.p] ? PR.parId[x.p].nom : x.p, montant: x.solde }); });
    c.plc.forEach(function (x) { rows.push({ cat: PR.parId[x.p] ? PR.parId[x.p].nom : x.p, montant: x.solde }); });
    var sansPrev = !c.ass.some(function (x) { return x.p === "PREV" || x.p === "GAV"; }), sansRet = !c.plc.some(function (x) { return x.p === "PER"; });
    var com = !sansPrev && !sansRet ? "Le client dispose de produits de prévoyance et de préparation à la retraite." : sansPrev && sansRet ? "Le client ne dispose pas de produits de prévoyance ni de préparation à la retraite." : sansPrev ? "Le client ne dispose pas de produit de prévoyance." : "Le client ne dispose pas de produit de préparation à la retraite.";
    return { personnelle: P, depuis: depuis, statutClient: eq.length ? maj1(eq.join(", ")) : "Client sans produit complémentaire", patrimoine: rows, commentairePatrimoine: com, nom: nomFull(c) };
  }

  /* ---------- décision ---------- */
  function contrepartiesPossibles(c, st) {
    return PR.produits.filter(function (p) { return K.prospectionPossible(p); }).map(function (p) { return { produit: p, ev: K.verdictClient(c, p.id, st) }; }).filter(function (x) { return x.ev.verdict === "eligible" || x.ev.verdict === "examiner"; });
  }
  var MIN_MOTIVATION = 20;
  /* Contrôle de la décision. o = { avis, motivation, canal, passeOutre, contreparties }. Renvoie { ok } ou { ok: false, champ, erreur }. */
  function controlerDecision(a, o) {
    if (!a.etape1Ok || !a.pret || !a.aide) return { ok: false, champ: "avis", erreur: "Le dossier n'est pas complet : terminez d'abord l'étape 1." };
    if (o.avis !== "favorable" && o.avis !== "defavorable") return { ok: false, champ: "avis", erreur: "Indiquez votre avis : favorable ou défavorable." };
    var m = String(o.motivation || "").trim();
    if (m.length < MIN_MOTIVATION) return { ok: false, champ: "motivation", erreur: "Motivez votre avis en quelques phrases (au moins " + MIN_MOTIVATION + " caractères)." };
    if (m.length > 1200) return { ok: false, champ: "motivation", erreur: "La motivation est limitée à 1 200 caractères." };
    if (o.avis === "favorable") {
      if (!a.aide.accordPossible) return { ok: false, champ: "avis", erreur: "L'accord est impossible : " + a.aide.impossible.map(function (x) { return x.lib.toLowerCase(); }).join(", ") + "." };
      if (!K.MOYENS[o.canal]) return { ok: false, champ: "canal", erreur: "Indiquez le moyen par lequel le crédit a été vendu : mailing, appel, entretien en rendez-vous ou à l'accueil." };
      if (a.aide.verdict !== "favorable" && !o.passeOutre) return { ok: false, champ: "passeOutre", erreur: "L'outil d'aide à la décision signale des points d'attention : cochez la case pour confirmer votre décision en connaissance de cause." };
    }
    return { ok: true };
  }
  /* Chiffres du contrat figés au moment de l'accord. */
  function figer(a, o) {
    var cts = a.couts, pr = a.pret, as = a.assurance, plan = a.plan, g = a.garantie;
    return {
      emission: B.ymd(B.aujourdhui()), capital: pr.capital, dureeMois: pr.dureeMois, taux: pr.taux, mensualite: pr.mensualite, derniere: pr.derniere, interets: pr.interets,
      prime: cts.prime, mensualiteAC: cts.mensualiteAC, derniereAC: cts.derniereAC, taeg: cts.taeg, taegSans: cts.taegSans, taegAvec: cts.taegAvec, taea: cts.taea, taegObligatoire: cts.taegObligatoire,
      fraisDossier: cts.fraisDossier, fraisGarantie: cts.fraisGarantie, coutAssurance: cts.coutAssurance, coutTotal: cts.coutTotal, montantTotalDu: cts.montantTotalDu,
      assurance: { souscrite: as.souscrite, resume: resumeAssurance(as), lignes: as.lignes.filter(function (r) { return r.couverte; }).map(function (r) { return { lib: r.lib, gar: r.gar, mensuel: r.mensuel, par: r.par }; }), mensuel: as.mensuel, annuel: as.annuel, total: as.total, tauxAnnuel: as.tauxAnnuel },
      garantie: { lib: g.lib, frais: g.frais, nominal: g.nominal, residuel: g.residuel }, apport: plan.apport, emplois: plan.emplois
    };
  }
  /* Accorde le crédit : enregistre la souscription du crédit (visible dans la fiche client, « Mes souscriptions » du catalogue et le bilan) et fige l'offre. */
  function accorder(st, c, d, o) {
    var a = evaluer(d, c, st), v = controlerDecision(a, Object.assign({}, o, { avis: "favorable" }));
    if (!v.ok) return v;
    var r = K.souscrireCredit(st, c, d.p, { montant: a.pret.capital, canal: o.canal, dossier: d.id, note: "Crédit accordé après montage du dossier : " + eur(a.pret.capital) + " sur " + R.libDuree(a.pret.dureeMois) + " à " + R.pctTaux(a.pret.taux) + "." });
    if (!r.ok) return { ok: false, champ: "avis", erreur: r.erreur };
    d.avis = "favorable"; d.motivation = String(o.motivation).trim(); d.canal = o.canal; d.passeOutre = !!o.passeOutre; d.contreparties = (o.contreparties || []).slice();
    d.statut = "accorde"; d.etape = 4;
    d.decision = { type: "accord", date: r.souscription.date, heure: r.souscription.heure, souscription: r.souscription.id, aide: a.aide.libelle };
    d.offre = figer(a, o);
    enregistrer(st, d);
    return { ok: true, souscription: r.souscription };
  }
  function refuser(st, c, d, o) {
    var a = evaluer(d, c, st), v = controlerDecision(a, Object.assign({}, o, { avis: "defavorable" }));
    if (!v.ok) return v;
    d.avis = "defavorable"; d.motivation = String(o.motivation).trim(); d.contreparties = []; d.canal = "";
    d.statut = "refuse"; d.etape = 4;
    d.decision = { type: "refus", date: B.ymd(B.ouvrePrecedent(B.aujourdhui())), heure: B.hhmm(B.maintenant()), aide: a.aide.libelle };
    enregistrer(st, d);
    return { ok: true };
  }

  /* Questionnaire de santé de l'emprunteur « id » (« sante » ou « sante_co ») : évalue les réponses saisies et ne garde que la décision de l'assureur dans le dossier, jamais les réponses.
     a : évaluation du dossier (etat.a). Renvoie { ok, verdict } ou { ok: false, erreur }. */
  function questionnaireSante(d, a, id, rep) {
    var s = a && a.assurance && a.assurance.sante ? a.assurance.sante.filter(function (x) { return (x.i === 0 ? "sante" : "sante_co") === id && !x.dispense; })[0] : null;
    if (!SA || !s) return { ok: false, erreur: "Ce questionnaire de santé n'est pas demandé pour ce dossier." };
    var ev = SA.evaluer("EMPRUNTEUR", rep, { aeras: s.aeras });
    if (!ev.complet) return { ok: false, erreur: ev.erreurs.mesure || "Répondez à chacune des " + SA.questionnaire("EMPRUNTEUR").questions.length + " questions du questionnaire de santé.", manquantes: ev.manquantes };
    if (!d.sante) d.sante = {};
    d.sante[id] = { date: B.ymd(B.ouvrePrecedent(B.aujourdhui())), verdict: ev.verdict, aeras: s.aeras };
    return { ok: true, verdict: ev.verdict };
  }
  /* Efface la décision (pour refaire le questionnaire). */
  function effacerSante(d, id) { if (d && d.sante) delete d.sante[id]; }

  /* Délais de l'offre, pour l'affichage et l'impression (dates à partir de l'émission). */
  function delaisOffre(pid, emission) {
    var e = typeof emission === "string" ? B.lireYmd(emission) : emission;
    if (pid === "CIMMO") return { reflexion: DELAI_REFLEXION, validite: VALIDITE_OFFRE, finValidite: ajoutJours(e, VALIDITE_OFFRE), finReflexion: ajoutJours(e, DELAI_REFLEXION), quatreMois: true };
    return { retractation: RETRACTATION, limiteRetractation: ajoutJours(e, RETRACTATION) };
  }

  var api = {
    PRODUITS: PRODUITS, ETAPES: ETAPES, OBJETS: OBJETS, LIGNES: LIGNES, SURETES: SURETES, ORDRE_SURETES: ORDRE_SURETES, ROWS_ASS: ROWS_ASS, TARIF_SOCLE: TARIF_SOCLE, TARIF_OPT: TARIF_OPT,
    USURE_CONSO: USURE_CONSO, FRAIS_NOTAIRE: FRAIS_NOTAIRE, HCSF: HCSF, SANTE: SANTE, questionnaireSante: questionnaireSante, effacerSante: effacerSante, decisionSante: decisionSante, pieceRecue: pieceRecue, AGE_FIN_GARANTIES: AGE_FIN_GARANTIES, DELAI_REFLEXION: DELAI_REFLEXION, VALIDITE_OFFRE: VALIDITE_OFFRE, RETRACTATION: RETRACTATION,
    SEUIL_JUSTIFICATIF: 15000, MIN_MOTIVATION: MIN_MOTIVATION, DUREE_DEFAUT: DUREE_DEFAUT, SURETE_DEFAUT: SURETE_DEFAUT,
    nouveau: nouveau, dossiers: dossiers, trouver: trouver, dossiersClient: dossiersClient, enregistrer: enregistrer, supprimer: supprimer, statutAffiche: statutAffiche, rouvrir: rouvrir,
    personnes: personnes, conjoint: conjoint, suretesPossibles: suretesPossibles, tauxAssurance: tauxAssurance, usureConso: usureConso, perteEmploiPossible: perteEmploiPossible,
    lireCentimes: lireCentimes, taegDepuis: taegDepuis, planFinancement: planFinancement, assurance: assurance, resumeAssurance: resumeAssurance,
    listePieces: listePieces, solvabilite: solvabilite, aideDecision: aideDecision, evaluer: evaluer, contrepartiesPossibles: contrepartiesPossibles,
    situation: situation, controlerDecision: controlerDecision, accorder: accorder, refuser: refuser, delaisOffre: delaisOffre, nomFull: nomFull
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.montage = api; }
})(typeof window !== "undefined" ? window : null);
