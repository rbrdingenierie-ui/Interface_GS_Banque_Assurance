/* GS Banque & Assurance – dossiers « du jour » (mouvements atypiques) : identités, textes et assemblage commun.
   Une « famille » (quotidien_atyp_coherent.js, quotidien_atyp_declaration.js) décrit un cas type : opérations, pièces, échange avec le client, décision.
   Ce fichier fournit à toutes les familles : le client (profession, revenus, situation, patrimoine, coordonnées), les formulations chiffrées
   (« plus de deux mois de salaire »), le plan du relevé de compte et l'assemblage du dossier complet. Fonctions pures. */
(function (root) {
  "use strict";

  var Q = root && root.SGBF && root.SGBF.quotidienBase ? root.SGBF.quotidienBase : require("./quotidien_base.js");
  var P = root && root.SGBF && root.SGBF.quotidienPools ? root.SGBF.quotidienPools : require("./quotidien_pools.js");
  var A = root && root.SGBF && root.SGBF.atyp ? root.SGBF.atyp : require("./rules_atypiques.js");
  var RL = root && root.SGBF && root.SGBF.quotidienAtypReleve ? root.SGBF.quotidienAtypReleve : require("./quotidien_atyp_releve.js");
  var eur = Q.eur, r2 = Q.r2;

  /* ---------- formulations ---------- */
  var UNITES = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
  var DIZAINES = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante-dix"];
  /* Nombre en lettres de 0 à 99 (au-delà : chiffres). */
  function mots(n) {
    var d, u;
    if (n < 20) return UNITES[n];
    if (n > 99) return String(n);
    if (n >= 80) return n === 80 ? "quatre-vingts" : "quatre-vingt-" + (n < 90 ? UNITES[n - 80] : UNITES[n - 80]);
    d = Math.floor(n / 10); u = n % 10;
    if (u === 0) return DIZAINES[d];
    if (d === 7 || d === 9) return mots(n - n % 10 + (n % 10 >= 0 ? -10 : 0)).replace(/s$/, "") + (u === 1 && d === 7 ? " et " : "-") + UNITES[10 + u];
    return DIZAINES[d] + (u === 1 ? " et un" : "-" + UNITES[u]);
  }
  function de(nom) { return /^[aeiouyhéèêà]/i.test(nom) ? "d'" + nom : "de " + nom; }
  /* « plus de deux mois de salaire », « près de quatre mois de salaire », « plus d'un an de pension » */
  function dureeDe(m, rev, nom) {
    var x = m / rev, n, f;
    if (x >= 24) return "plus de " + mots(Math.floor(x / 12)) + " ans " + de(nom);
    if (x >= 12) return "plus d'un an " + de(nom);
    n = Math.floor(x); f = x - n;
    if (f < 1e-9) return n === 1 ? "un mois " + de(nom) : mots(n) + " mois " + de(nom);
    if (f >= 0.8) return "près de " + mots(n + 1) + " mois " + de(nom);
    return n === 1 ? "plus d'un mois " + de(nom) : "plus de " + mots(n) + " mois " + de(nom);
  }
  /* « deux mois de salaire » (partie entière du rapport) : « une somme supérieure à deux mois de salaire » */
  function moisDe(m, rev, nom) {
    var x = Math.floor(m / rev);
    if (x >= 24) return mots(Math.floor(x / 12)) + " ans " + de(nom);
    if (x >= 12) return "un an " + de(nom);
    return x <= 1 ? "un mois " + de(nom) : mots(x) + " mois " + de(nom);
  }
  /* « quinze fois le retrait habituel » : plus de N fois */
  function foisDe(m, h) {
    var x = m / h, n = Math.floor(x), f = x - n;
    if (f < 1e-9) return mots(n) + " fois";
    return f >= 0.8 ? "près de " + mots(n + 1) + " fois" : "plus de " + mots(n) + " fois";
  }
  /* « du salaire », « de la pension », « de l'allocation chômage »… et « le salaire est », « les revenus sont » */
  var REV_ART = { salaire: ["du salaire", "le salaire est"], "rémunération": ["de la rémunération", "la rémunération est"], pension: ["de la pension", "la pension est"], "allocation chômage": ["de l'allocation chômage", "l'allocation chômage est"], "aide familiale": ["de l'aide familiale", "l'aide familiale est"], revenus: ["des revenus", "les revenus sont"] };
  function duRev(I) { return REV_ART[I.revNom][0]; }
  function leRevEst(I) { return REV_ART[I.revNom][1]; }
  /* « le marché de Noël » → « du marché de Noël » / « au marché de Noël » ; « un banquet » → « d'un banquet » / « à un banquet » */
  function deEvt(e) { return e.replace(/^le /, "du ").replace(/^les /, "des ").replace(/^la /, "de la ").replace(/^l'/, "de l'").replace(/^un /, "d'un ").replace(/^une /, "d'une "); }
  function aEvt(e) { return e.replace(/^le /, "au ").replace(/^les /, "aux ").replace(/^la /, "à la ").replace(/^l'/, "à l'").replace(/^un /, "à un ").replace(/^une /, "à une "); }
  function liste(t) { return t.length < 2 ? t.join("") : t.slice(0, -1).join(", ") + " et " + t[t.length - 1]; }
  function somme(t) { return r2(t.reduce(function (a, b) { return a + b; }, 0)); }
  function sansAccent(s) { return s.normalize("NFD").replace(/[̀-ͯ]/g, ""); }

  /* ---------- adresses (rue, code postal) ---------- */
  var RUES = [["rue de Charonne", "75011"], ["rue Oberkampf", "75011"], ["rue de la Roquette", "75011"], ["boulevard Voltaire", "75011"], ["rue Monge", "75005"], ["rue Mouffetard", "75005"], ["rue Claude Bernard", "75005"], ["rue Lacépède", "75005"],
    ["rue de Bagnolet", "75020"], ["rue des Pyrénées", "75020"], ["rue de Ménilmontant", "75020"], ["rue des Orteaux", "75020"], ["rue Ordener", "75018"], ["rue Marcadet", "75018"], ["rue Caulaincourt", "75018"], ["rue des Poissonniers", "75018"],
    ["rue Daguerre", "75014"], ["rue Raymond Losserand", "75014"], ["rue d'Alésia", "75014"], ["avenue du Maine", "75014"], ["avenue Daumesnil", "75012"], ["rue de Charenton", "75012"], ["rue Crozatier", "75012"], ["rue de Reuilly", "75012"],
    ["rue de Crimée", "75019"], ["rue de Belleville", "75019"], ["rue Manin", "75019"], ["avenue Secrétan", "75019"], ["rue Lecourbe", "75015"], ["rue de Vaugirard", "75015"], ["rue de la Convention", "75015"], ["rue Cambronne", "75015"],
    ["rue des Martyrs", "75009"], ["rue de Maubeuge", "75009"], ["rue Condorcet", "75009"], ["rue du Château d'Eau", "75010"], ["rue du Faubourg Saint-Denis", "75010"], ["rue des Vinaigriers", "75010"], ["quai de Jemmapes", "75010"],
    ["avenue d'Italie", "75013"], ["rue de la Butte-aux-Cailles", "75013"], ["rue Nationale", "75013"], ["boulevard Auguste Blanqui", "75013"], ["rue Legendre", "75017"], ["rue de Lévis", "75017"], ["avenue de Clichy", "75017"], ["rue Nollet", "75017"],
    ["rue Saint-Antoine", "75004"], ["rue de Rivoli", "75004"], ["rue des Archives", "75003"], ["rue de Bretagne", "75003"], ["rue Saint-Dominique", "75007"], ["rue de Passy", "75016"], ["avenue Mozart", "75016"], ["rue de la Pompe", "75016"],
    ["rue Montorgueil", "75002"], ["rue Réaumur", "75002"], ["rue de Sèvres", "75006"], ["rue du Cherche-Midi", "75006"]];

  /* ---------- professions ---------- */
  /* Indépendants : typ « esp » (activité qui encaisse des espèces) ou « art » (artisan, clients payant par chèque ou virement). */
  var INDEP = [
    { k: "primeur", typ: "esp", m: "Commerçant sur les marchés (primeur)", f: "Commerçante sur les marchés (primeur)", rev: [2200, 3300], age: [34, 62], act: "son activité sur les marchés", rem: "Remise d'espèces – recettes des marchés", remDet: "Recettes des marchés",
      pro: function (r, a) { return "Entreprise individuelle, stand sur " + mots(r.n(2, 4)) + " marchés de l'agglomération depuis " + a + " ans."; }, frn: "Virement émis – grossiste fruits et légumes", evts: ["le marché de Noël", "la foire annuelle de la ville", "une grande braderie de quartier"] },
    { k: "boulanger", typ: "esp", m: "Boulanger-pâtissier (entreprise individuelle)", f: "Boulangère-pâtissière (entreprise individuelle)", rev: [2300, 3400], age: [34, 62], act: "sa boulangerie", rem: "Remise d'espèces – recettes de la boulangerie", remDet: "Recettes de la boulangerie",
      pro: function (r, a) { return "Boulangerie-pâtisserie en entreprise individuelle depuis " + a + " ans, dans le quartier."; }, frn: "Virement émis – minoterie et fournisseurs", evts: ["la galette et les fêtes de fin d'année", "une commande exceptionnelle pour une fête de quartier"] },
    { k: "coiffeur", typ: "esp", m: "Coiffeur (salon en nom propre)", f: "Coiffeuse (salon en nom propre)", rev: [2000, 3000], age: [30, 60], act: "son salon", rem: "Remise d'espèces – recettes du salon", remDet: "Recettes du salon",
      pro: function (r, a) { return "Salon de coiffure de " + mots(r.n(3, 6)) + " fauteuils, exploité depuis " + a + " ans."; }, frn: "Virement émis – grossiste produits capillaires", evts: ["la saison des mariages", "les fêtes de fin d'année"] },
    { k: "restaurateur", typ: "esp", m: "Restaurateur (entreprise individuelle)", f: "Restauratrice (entreprise individuelle)", rev: [2500, 3600], age: [34, 62], act: "son restaurant", rem: "Remise d'espèces – recettes du restaurant", remDet: "Recettes du restaurant",
      pro: function (r, a) { return "Restaurant de " + (r.n(3, 7) * 10) + " couverts en centre-ville, exploité depuis " + a + " ans."; }, frn: "Virement émis – fournisseurs (boissons et produits frais)", evts: ["un banquet de mariage", "un repas d'entreprise de fin d'année", "le week-end d'un grand salon professionnel"] },
    { k: "fleuriste", typ: "esp", m: "Fleuriste (entreprise individuelle)", f: "Fleuriste (entreprise individuelle)", rev: [2000, 2900], age: [30, 62], act: "sa boutique", rem: "Remise d'espèces – recettes de la boutique", remDet: "Recettes de la boutique",
      pro: function (r, a) { return "Boutique de fleurs en entreprise individuelle depuis " + a + " ans."; }, frn: "Virement émis – grossiste horticole", evts: ["la Fête des mères", "la Toussaint"] },
    { k: "menuisier", typ: "art", m: "Artisan menuisier (entreprise individuelle)", f: "Artisane menuisière (entreprise individuelle)", rev: [2400, 3500], age: [32, 62], act: "son atelier", rem: null,
      pro: function (r, a) { return "Menuiserie en entreprise individuelle depuis " + a + " ans, atelier en zone artisanale."; }, frn: "Virement émis – fournisseur de bois et quincaillerie", sinistre: "un incendie dans l'atelier", evts: [] },
    { k: "plombier", typ: "art", m: "Plombier-chauffagiste (entreprise individuelle)", f: "Plombière-chauffagiste (entreprise individuelle)", rev: [2400, 3500], age: [30, 60], act: "son activité", rem: null, soloM: true,
      pro: function (r, a) { return "Plomberie et chauffage en entreprise individuelle depuis " + a + " ans, clients particuliers et copropriétés."; }, frn: "Virement émis – fournisseur de matériel sanitaire", sinistre: "la destruction de la camionnette d'intervention et de son outillage par un incendie", evts: [] },
    { k: "peintre", typ: "art", m: "Peintre en bâtiment (entreprise individuelle)", f: "Peintre en bâtiment (entreprise individuelle)", rev: [2200, 3200], age: [30, 60], act: "son activité", rem: null,
      pro: function (r, a) { return "Peinture et décoration en entreprise individuelle depuis " + a + " ans, clients particuliers et syndics."; }, frn: "Virement émis – fournisseur de peintures", sinistre: "un dégât des eaux dans le local de stockage", evts: [] },
    { k: "electricien", typ: "art", m: "Électricien (entreprise individuelle)", f: "Électricienne (entreprise individuelle)", rev: [2400, 3400], age: [30, 60], act: "son activité", rem: null, soloM: true,
      pro: function (r, a) { return "Électricité générale en entreprise individuelle depuis " + a + " ans, particuliers et petites entreprises."; }, frn: "Virement émis – grossiste en matériel électrique", sinistre: "un cambriolage du local professionnel", evts: [] }
  ];
  /* Salariés à revenus élevés */
  var AISES = [
    { k: "chef_chantier", m: "Chef de chantier (CDI)", f: "Cheffe de chantier (CDI)", st: "salarie", rev: [2900, 3600], age: [38, 60], cr: "Salaire", note: "salaire domicilié" },
    { k: "resp_compta", m: "Responsable comptable (CDI)", f: "Responsable comptable (CDI)", st: "salarie", rev: [3000, 4000], age: [34, 60], cr: "Salaire", note: "salaire domicilié" },
    { k: "cadre_logistique", m: "Cadre logistique (CDI)", f: "Cadre logistique (CDI)", st: "salarie", rev: [3000, 4200], age: [36, 60], cr: "Salaire", note: "salaire domicilié" },
    { k: "pharmacien", m: "Pharmacien adjoint (CDI)", f: "Pharmacienne adjointe (CDI)", st: "salarie", rev: [3200, 4200], age: [30, 60], cr: "Salaire", note: "salaire domicilié" },
    { k: "ingenieur2", m: "Ingénieur en bureau d'études (CDI)", f: "Ingénieure en bureau d'études (CDI)", st: "salarie", rev: [3000, 4200], age: [30, 58], cr: "Salaire", note: "salaire domicilié" }
  ];
  var ETUDES = ["licence de droit", "licence d'économie", "licence de lettres", "BTS", "licence de sciences", "master de gestion", "licence de langues"];

  var REV_NOM = { salarie: "salaire", cdd: "salaire", alternance: "rémunération", retraite: "pension", chomage: "allocation chômage", etudiant: "aide familiale", independant: "revenus" };

  /* ---------- identité complète d'un client ---------- */
  /* c : { st:[statuts], rev:[min,max], age:[min,max], sexe:"f"|"m"|null, logement:"locataire"|"proprio"|"credit"|"parents", livret:[min,max], av:bool, aise:bool, typ:"esp"|"art", nom:"…" } */
  function situationDe(r, age, f, st) {
    var e = f ? "e" : "";
    if (st === "etudiant" || st === "alternance" || age < 24) return "Célibataire";
    if (st === "retraite" && age >= 72 && r.chance(0.5)) return f ? "Veuve" : "Veuf";
    if (st === "retraite") return r.poids([["Marié" + e, 3], [f ? "Veuve" : "Veuf", 1], ["Célibataire", 1], ["Marié" + e + ", 2 enfants", 2]]);
    if (age < 40) return r.poids([["Célibataire", 3], ["Marié" + e + ", 1 enfant", 2], ["Marié" + e + ", 2 enfants", 2], ["Pacsé" + e, 1], ["Célibataire, 1 enfant", 1]]);
    return r.poids([["Célibataire", 2], ["Marié" + e, 2], ["Marié" + e + ", 2 enfants", 3], ["Divorcé" + e + ", 1 enfant", 2], ["Marié" + e + ", 3 enfants", 1]]);
  }

  function ident(r, c) {
    var f = c.sexe ? c.sexe === "f" : r.chance(0.5), st = r.pick(c.st), p, age, rev, anc, I;
    var lst;
    if (st === "independant") {
      lst = INDEP.filter(function (x) { return (!c.typ || x.typ === c.typ) && (!c.k || x.k === c.k) && (c.rev ? x.rev[1] >= c.rev[0] && x.rev[0] <= c.rev[1] : true); });
      if (!lst.length) lst = INDEP.filter(function (x) { return (!c.typ || x.typ === c.typ) && (!c.k || x.k === c.k); });
      p = r.pick(lst);
      if (p.soloM) f = false;
    } else if (st === "etudiant") {
      p = { k: "etudiant", m: "Étudiant (" + r.pick(ETUDES) + ")", rev: [450, 900], age: [19, 25] };
      p.f = p.m.replace("Étudiant", "Étudiante");
    } else {
      lst = (c.aise ? AISES : P.PROFESSIONS).filter(function (x) {
        return x.k !== "interim" && x.st === st && (!c.rev || (x.rev[1] >= c.rev[0] && x.rev[0] <= c.rev[1])) && (!c.age || (x.age[1] >= c.age[0] && x.age[0] <= c.age[1]));
      });
      if (!lst.length && c.aise) lst = AISES;
      if (!lst.length) lst = P.PROFESSIONS.filter(function (x) { return x.k !== "interim" && x.st === st && (!c.age || (x.age[1] >= c.age[0] && x.age[0] <= c.age[1])); });
      if (!lst.length) lst = P.PROFESSIONS.filter(function (x) { return x.k !== "interim" && x.st === st; });
      p = r.pick(lst);
    }
    var lo = Math.max(p.rev[0], c.rev ? c.rev[0] : 0), hi = Math.min(p.rev[1], c.rev ? c.rev[1] : 1e9);
    if (hi < lo) { lo = p.rev[0]; hi = p.rev[1]; }
    var alo = Math.max(p.age[0], c.age ? c.age[0] : 0), ahi = Math.min(p.age[1], c.age ? c.age[1] : 99);
    if (ahi < alo) { alo = p.age[0]; ahi = p.age[1]; }
    age = r.n(alo, ahi); rev = r.pas(lo, hi, 10);
    anc = Math.max(1, Math.min(r.n(2, 25), age - 18));
    if (st === "alternance" || st === "cdd") anc = r.n(1, Math.min(4, age - 17));
    if (st === "etudiant") anc = r.n(1, Math.min(4, age - 17));
    var civ = f ? "Mme" : "M.";
    I = { f: f, st: st, k: p.k, civilite: civ, prenom: Q.prenomPour(r, f, age), nom: Q.nomMajuscule(c.nom || r.pick(Q.NOMS)), age: age, revenus: rev, revNom: REV_NOM[st], indep: st === "independant", p: p };
    I.profession = f ? p.f : p.m;
    I.situation = situationDe(r, age, f, st);
    I.ancienneteAns = anc;

    /* revenus : libellé du virement habituel */
    if (st === "salarie" || st === "cdd") { I.revenusNote = p.note || "salaire domicilié"; I.revLib = p.cr || "Salaire"; I.revDet = "Virement mensuel de l'employeur"; I.jourRev = 28; I.revHab = "salaire"; }
    else if (st === "alternance") { I.revenusNote = "rémunération d'alternance"; I.revLib = "Rémunération d'alternance"; I.revDet = "Virement mensuel de l'employeur"; I.jourRev = 28; I.revHab = "rémunération"; }
    else if (st === "retraite") { I.revenusNote = "pension de retraite"; I.revLib = "Pensions de retraite"; I.revDet = "Virement mensuel des caisses de retraite"; I.jourRev = 5; I.revHab = "pension"; }
    else if (st === "chomage") { I.revenusNote = "allocation chômage"; I.revLib = "Allocation chômage"; I.revDet = "Virement mensuel"; I.jourRev = 3; I.revHab = "allocation"; }
    else if (st === "etudiant") { I.revenusNote = "aide mensuelle de la famille"; I.revLib = "Aide mensuelle de la famille"; I.revDet = "Virement mensuel"; I.jourRev = 3; I.revHab = "aide"; }
    else { I.revenusNote = "bénéfices moyens de l'activité"; I.revLib = null; I.revHab = "revenus"; }

    I.revPos = { salaire: "son salaire", "rémunération": "sa rémunération", pension: "sa pension", allocation: "son allocation", aide: "son aide familiale", revenus: "ses revenus" }[I.revHab];

    /* logement et patrimoine */
    var lg = c.logement;
    if (!lg) {
      if (st === "etudiant" || st === "alternance") lg = "parents";
      else if (st === "retraite") lg = r.poids([["proprio", 6], ["locataire", 3]]);
      else if (age < 30) lg = r.poids([["locataire", 5], ["parents", 1]]);
      else if (rev >= 2300) lg = r.poids([["locataire", 3], ["credit", 4], ["proprio", 1]]);
      else lg = r.poids([["locataire", 6], ["proprio", 1]]);
      if (st === "chomage" && lg === "credit") lg = "locataire";
    }
    if (st === "retraite" && lg === "credit") lg = "proprio";
    I.logement = lg;
    I.situation = lg === "parents" ? "Célibataire, vit chez ses parents" : I.situation;
    var pat = [], prod = ["Compte courant"];
    if (lg === "locataire") pat.push(r.chance(0.5) ? "Locataire" : "Locataire, aucun bien immobilier");
    else if (lg === "proprio") pat.push("Résidence principale (propriétaire, sans crédit)");
    else if (lg === "credit") { pat.push("Résidence principale (crédit immobilier en cours)"); prod.push("Crédit immobilier"); }
    else pat.push("Aucun bien");
    /* carte */
    var carteRetrait = !c.aise && rev < 1400 && r.chance(0.35);
    prod.splice(1, 0, carteRetrait ? "Carte de retrait" : (rev >= 3000 || c.aise ? "Carte Visa Premier" : "Carte Visa Classic"));
    /* épargne */
    var lv = c.livret || (c.aise ? [12000, 22000] : st === "retraite" ? [4000, 18000] : st === "etudiant" ? [200, 900] : st === "chomage" ? [0, 1200] : [600, Math.min(14000, rev * 4)]);
    I.livret = lv[1] > 0 ? r.pas(Math.max(100, Math.ceil(lv[0] / 100) * 100), Math.max(100, Math.floor(lv[1] / 100) * 100), 100) : 0;
    if (I.livret > 0 && c.livretNon !== true) { prod.push("Livret A"); pat.unshift("Livret A : " + eur(I.livret)); }
    else pat.unshift("Aucun placement");
    if (c.av) { I.avExt = true; }
    I.produits = prod; I.patrimoine = pat;

    /* texte « situation professionnelle » */
    I.ancPro = Math.max(1, Math.min(anc, age - 22));
    if (st === "cdd" || /CDD/.test(I.profession)) I.professionnel = I.profession.replace(/ \((CDI|CDD|temps partiel)\)/, "") + " en CDD depuis " + mots(r.n(3, 14)) + " mois.";
    else if (st === "salarie" || st === "cdd") I.professionnel = I.profession.replace(/ \((CDI|CDD|temps partiel)\)/, "") + (/CDI/.test(I.profession) ? " en CDI" : "") + " depuis " + I.ancPro + (I.ancPro > 1 ? " ans." : " an.");
    else if (st === "alternance") I.professionnel = "Alternance en entreprise depuis " + mots(r.n(2, 9)) + " mois, en parallèle d'une formation.";
    else if (st === "retraite") I.professionnel = (f ? "Retraitée" : "Retraité") + " depuis " + Math.max(1, Math.min(age - 60, r.n(2, 18))) + " ans. Aucune activité déclarée depuis.";
    else if (st === "chomage") I.professionnel = "Sans emploi depuis " + mots(r.n(5, age >= 55 ? 26 : age >= 53 ? 21 : 18)) + " mois.";
    else if (st === "etudiant") I.professionnel = (f ? "Étudiante" : "Étudiant") + " en " + I.profession.replace(/^.*\(/, "").replace(/\)$/, "") + ", petit emploi étudiant quelques heures par semaine.";
    else { I.professionnel = p.pro(r, I.ancPro); }
    if (st === "independant") { I.produits.push("Crédit professionnel"); I.patrimoine.push(p.typ === "esp" ? "Fonds de commerce (crédit professionnel en cours)" : "Matériel professionnel (crédit professionnel en cours)"); I.creditPro = true; }

    /* indépendants : le logement ne compte pas comme patrimoine du fonds */
    I.compte = Q.numeroCompte(r);
    var rue = r.pick(RUES), xx = r.n(10, 99) + " " + r.n(10, 99);
    I.coordonnees = {
      telephone: "01 99 00 " + xx, mobile: "06 39 98 " + xx,
      email: sansAccent(I.prenom).toLowerCase() + "." + sansAccent(I.nom).toLowerCase().replace(/\s+/g, "-") + "@example.com",
      adresse: r.n(1, 64) + " " + rue[0] + ", " + rue[1] + " Paris"
    };
    I.miseAJourMois = r.n(8, 30);
    return I;
  }

  function clientDe(I, extra) {
    var c = {
      civilite: I.civilite, prenom: I.prenom, nom: I.nom, age: I.age, profession: I.profession, situation: I.situation,
      ancienneteAns: I.ancienneteAns, revenus: I.revenus, revenusNote: I.revenusNote, compte: I.compte, produits: I.produits.slice(),
      coordonnees: I.coordonnees, professionnel: I.professionnel, patrimoine: I.patrimoine.slice(), miseAJourMois: I.miseAJourMois
    };
    if (extra) Object.keys(extra).forEach(function (k) { c[k] = extra[k]; });
    return c;
  }

  /* Formulations liées au genre du client */
  function G(I) {
    var f = I.f;
    return { nomC: I.civilite + " " + I.nom, cl: f ? "la cliente" : "le client", Cl: f ? "La cliente" : "Le client", il: f ? "elle" : "il", Il: f ? "Elle" : "Il", e: f ? "e" : "", son: "son", lui: "lui", pere: "père" };
  }

  /* ---------- opérations de base ---------- */
  function opRevenu(I) {
    if (I.indep) return null;
    return { k: "rev", type: "virement", libelle: I.revLib, detail: I.revDet, montant: I.revenus, mois: 1, jour: I.jourRev, atypique: false, explication: "Habituelle : " + I.revHab + " reçu" + (I.revHab === "salaire" || I.revHab === "revenus" ? "" : "e") + " chaque mois.", sens: "credit" };
  }
  function opRetrait(I, m, j) {
    return { k: "ret", type: "retrait_especes", libelle: "Retrait au distributeur", detail: "Retrait habituel", montant: m, mois: 1, jour: j, atypique: false, explication: "Habituelle : retrait courant de " + eur(m) + "." };
  }
  /* Montant d'un retrait habituel adapté au revenu */
  function retraitHab(r, I) {
    var m = I.revenus < 800 ? r.pas(40, 80, 10) : I.revenus < 1400 ? r.pas(60, 150, 10) : I.revenus < 2400 ? r.pas(100, 250, 10) : r.pas(150, 350, 50);
    return m;
  }

  /* ---------- plan du relevé : charges fixes et cartes ---------- */
  function jourLibre(r, pris, lo, hi) {
    var j, k = 0;
    do { j = r.n(lo, hi); k++; } while (pris.indexOf(j) >= 0 && k < 30);
    pris.push(j);
    return j;
  }
  function planParticulier(r, I, o) {
    var rev = I.revenus, fixes = [], total = 0, pris = [I.jourRev], t, j, m, lg = I.logement, ret = o.retrait || 0;
    function add(lib, mt, jlo, jhi, kind) { j = jourLibre(r, pris, jlo || 3, jhi || 25); fixes.push([j, (kind === "virement" ? "" : "Prélèvement ") + lib, -r2(mt), kind || "prelevement"]); total += mt; }
    if (lg === "locataire") { t = r.pick(P.PRELEV_LOYER); m = Math.max(380, Math.round(rev * r.pas(24, 34, 2) / 100 / 5) * 5); add(t[0], m, 3, 8); }
    if (lg === "credit") { m = Math.max(650, Math.round(rev * r.pas(24, 32, 2) / 100 / 5) * 5); add("crédit immobilier – GS Banque & Assurance", m, 4, 10); add("taxe foncière – mensualisation", r.pas(60, 130, 5), 5, 12); }
    if (lg === "proprio") add("taxe foncière – mensualisation", r.pas(70, 150, 5), 5, 12);
    if (lg !== "parents") { t = P.PRELEV_ASSUR[1]; add(t[0], r.pas(12, 40, 1), 8, 20); t = r.pick(P.PRELEV_ENERGIE); add(t[0], r.pas(Math.round(t[2]), Math.round(t[3]), 1), 14, 24); }
    t = r.pick(P.PRELEV_TEL); add(t[0], Math.round((t[2] + r.f() * (t[3] - t[2])) * 100) / 100, 15, 22);
    if (I.age >= 25 && I.st !== "etudiant") { t = P.PRELEV_ASSUR[2]; add(t[0], r.pas(30, 100, 1), 10, 16); }
    if (I.st === "salarie" || I.st === "cdd" || I.st === "alternance" || I.st === "etudiant") add("abonnement transports en commun", 90.8, 6, 20);
    if (o.credit) add(o.credit[0], o.credit[1], 6, 18);
    /* épargne mensuelle pour les revenus confortables */
    var extras = [];
    if (rev >= 2800 && r.chance(0.7)) { var ep = r.pas(250, 500, 50); extras.push([r.n(6, 9), "virement", "Virement émis – épargne Livret A", [-ep, -ep, -ep]]); total += ep; }
    /* paiements par carte : le compte ne doit pas se vider d'un mois sur l'autre */
    var marge = Math.max(0, rev * 0.9 - total - ret), cible = Math.min(rev * r.pas(20, 30, 1) / 100, marge);
    cible = Math.max(cible, Math.min(90, marge), 60);
    var n = Math.max(4, Math.min(13, Math.round(cible / 55)));
    return { fixes: fixes, extras: extras, cartes: [n, Math.round(cible * 0.9), Math.round(cible * 1.05)], plancher: Math.max(200, Math.round(rev * 0.4 / 100) * 100), total: total };
  }

  /* ---------- assemblage ---------- */
  /* spec : { objectif, ops:[{k,…}], pieces:{attendues,acceptables}, contact, issue, explication, retenir, argumentaire, observations, plan, clientExtra }
     Les clés « k » des opérations deviennent des identifiants o1, o2… (dans l'ordre) ; le plan du relevé les utilise. */
  function assembler(r, I, spec) {
    var idDe = {}, ops = spec.ops.map(function (o, i) { var x = {}, id = "o" + (i + 1); idDe[o.k] = id; Object.keys(o).forEach(function (kk) { if (kk !== "k") x[kk] = o[kk]; }); x.id = id; return reordonner(x); });
    var plan = Object.assign({}, spec.plan || {});
    ["agreges", "variantes", "repete"].forEach(function (cle) {
      if (!plan[cle]) return;
      var out = {};
      Object.keys(plan[cle]).forEach(function (k) { out[idDe[k] || k] = plan[cle][k]; });
      plan[cle] = out;
    });
    var d = {
      objectif: spec.objectif, client: clientDe(I, spec.clientExtra), operations: ops, pieces: spec.pieces, contact: spec.contact,
      issue: spec.issue, explication: spec.explication, retenir: spec.retenir, argumentaire: spec.argumentaire
    };
    if (spec.observations && spec.observations.length) d.observations = spec.observations;
    /* Seuil COSI (10 000 € d'espèces dans le mois) : toujours rappelé dans la correction quand il est dépassé */
    var cp = cosiPhrase(d, d.issue === "coherent"), cr = cosiRetenir(d);
    if (cp) d.explication += cp;
    if (cr) d.retenir = d.retenir.concat([cr]);
    var rel = RL.construire(r, d, plan), essais = 0;
    if (plan.ouverture) {
      /* compte ouvert récemment : le versement initial est relevé tant que le solde passerait sous zéro */
      while (essais < 8 && minSolde(rel) < 0) { plan.ouverture = { mois: plan.ouverture.mois, jour: plan.ouverture.jour, versement: plan.ouverture.versement + 100 }; rel = RL.construire(r, d, plan); essais++; }
    }
    return { dossier: d, releve: rel };
  }
  function minSolde(rel) {
    var s = rel.ouverture, min = s;
    rel.lignes.forEach(function (l) { s = r2(s + l[4]); if (s < min) min = s; });
    return min;
  }
  function reordonner(o) {
    var out = { id: o.id, type: o.type, libelle: o.libelle, detail: o.detail, montant: o.montant, mois: o.mois, jour: o.jour, atypique: o.atypique, explication: o.explication };
    if (o.sens) out.sens = o.sens;
    return out;
  }



  /* Relevé d'un indépendant : recettes (remises, chèques), fournisseurs, cotisations ; le solde reste positif d'un mois sur l'autre.
     o : { cmin : crédits du mois le plus faible, extra : { agreges, variantes } } */
  function planIndependant(r, I, o) {
    var perso = planParticulier(r, Object.assign({}, I, { logement: I.logement === "parents" ? "locataire" : I.logement }), { retrait: 0 });
    var cotis = Math.round(I.revenus * 0.22 / 10) * 10, assur = r.pas(60, 140, 5), charges = perso.total + cotis + assur;
    var cartesMax = perso.cartes[2], frn = Math.max(500, Math.round((o.cmin - charges - cartesMax - I.revenus * 0.47) / 50) * 50);
    var plan = {
      fixes: perso.fixes.concat([[r.n(8, 10), I.p.frn, -frn, "virement"], [20, "Prélèvement cotisations sociales indépendants", -cotis], [22, "Prélèvement assurance professionnelle", -assur]]),
      extras: perso.extras, cartes: [perso.cartes[0], Math.round(cartesMax * 0.85), cartesMax], plancher: Math.max(300, Math.round(I.revenus * 0.4 / 100) * 100)
    };
    Object.keys(o.extra || {}).forEach(function (k) { plan[k] = o.extra[k]; });
    return plan;
  }

  /* Tiers (acheteur, donateur, payeur…) : « M. Quentin LEROUX ». */
  function personne(r, sexe, age) {
    var f = sexe ? sexe === "f" : r.chance(0.5);
    return { f: f, civilite: f ? "Mme" : "M.", prenom: Q.prenomPour(r, f, age || 40), nom: Q.nomMajuscule(r.pick(Q.NOMS)) };
  }
  function nomComplet(p) { return p.civilite + " " + p.prenom + " " + p.nom; }

  /* Dossier d'un particulier salarié, retraité, étudiant… : revenu habituel, retrait habituel, charges fixes et cartes du relevé.
     spec.ops : opérations propres au cas (avec clé « k »). spec.ret : retrait habituel (montant) ; spec.sansRetrait pour n'en avoir aucun. */
  function particulier(r, I, spec) {
    var ret = spec.sansRetrait ? 0 : (spec.ret != null ? spec.ret : retraitHab(r, I)), ops = [], rv = opRevenu(I);
    if (rv && spec.revMois) rv.mois = spec.revMois;
    if (rv) ops.push(rv);
    ops = ops.concat(spec.ops);
    if (ret) ops.push(opRetrait(I, ret, spec.jourRetrait || r.n(6, 20)));
    var pl = planParticulier(r, I, { retrait: ret + (spec.retraitExtra || 0), credit: spec.credit });
    var plan = { fixes: pl.fixes, extras: pl.extras, cartes: pl.cartes, plancher: pl.plancher };
    if (spec.plan) Object.keys(spec.plan).forEach(function (k) { plan[k] = spec.plan[k]; });
    spec.ops = ops; spec.plan = plan;
    return assembler(r, I, spec);
  }
  function contactDe(r, canal, echange, recues, appreciation, maj) {
    return { canal: canal || r.poids([["mobile", 3], ["telephone", 2]]), echange: echange, recues: recues, appreciation: appreciation, maj: maj };
  }

  /* Phrases communes sur le seuil COSI (10 000 € d'espèces dans un mois civil). */
  function cosiPhrase(d, coherent) {
    var cum = A.cumulEspeces(d).filter(function (m) { return m.cosiDepots || m.cosiRetraits; });
    if (!cum.length) return "";
    var m = cum[0], sens = m.cosiDepots ? "dépôts" : "retraits", tot = m.cosiDepots ? m.depots : m.retraits;
    return coherent
      ? " Les " + sens + " d'espèces du mois atteignent " + eur(tot) + " : le seuil de " + eur(A.SEUIL_COSI) + " (COSI) est dépassé, mais la communication systématique est automatique et la décision repose sur les justificatifs, pas sur le seuil."
      : " Les " + sens + " d'espèces du mois atteignent " + eur(tot) + " : le seuil de " + eur(A.SEUIL_COSI) + " (COSI) est dépassé, mais la décision repose sur l'absence de justification, pas sur le seuil.";
  }
  function cosiRetenir(d) {
    return A.cosiDeclenchee(d) ? "Le dépassement du seuil COSI ne suffit ni à déclarer ni à classer : c'est la cohérence avec la situation du client et les justificatifs qui décident." : null;
  }

  var api = {
    mots: mots, de: de, deEvt: deEvt, aEvt: aEvt, duRev: duRev, leRevEst: leRevEst, dureeDe: dureeDe, moisDe: moisDe, foisDe: foisDe, liste: liste, somme: somme, sansAccent: sansAccent, INDEP: INDEP, AISES: AISES, RUES: RUES, REV_NOM: REV_NOM,
    ident: ident, clientDe: clientDe, G: G, opRevenu: opRevenu, opRetrait: opRetrait, retraitHab: retraitHab, planParticulier: planParticulier, planIndependant: planIndependant, jourLibre: jourLibre,
    assembler: assembler, particulier: particulier, personne: personne, nomComplet: nomComplet, contactDe: contactDe, cosiPhrase: cosiPhrase, cosiRetenir: cosiRetenir
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.quotidienAtypBase = api; }
})(typeof window !== "undefined" ? window : null);
