/* GS Banque & Assurance – dossiers « du jour » (mouvements atypiques) : familles de cas COHÉRENTS.
   Une opération inhabituelle par son montant, mais expliquée et justifiée par une pièce qui correspond exactement : le bon réflexe est de valider.
   Chaque famille tire ses chiffres au hasard, puis rédige les textes à partir de ces chiffres (aucun montant écrit « en dur »). Fonctions pures. */
(function (root) {
  "use strict";

  var Q = root && root.SGBF && root.SGBF.quotidienBase ? root.SGBF.quotidienBase : require("./quotidien_base.js");
  var B = root && root.SGBF && root.SGBF.quotidienAtypBase ? root.SGBF.quotidienAtypBase : require("./quotidien_atyp_base.js");
  var RL = root && root.SGBF && root.SGBF.quotidienAtypReleve ? root.SGBF.quotidienAtypReleve : require("./quotidien_atyp_releve.js");
  var eur = Q.eur, r2 = Q.r2;

  var NOTAIRES = ["Étude Lavergne-Colin", "Étude Rousselot", "Étude Marchand & Delorme", "Étude Pellerin", "Étude Fournel", "Étude Boissier", "Étude Castaing", "Étude Valmont & Associés"];
  var ASSUREURS = ["Mutuelle Avenir Vie", "Prévoyance Atlantique", "Assurances Solidaires", "Compagnie du Nord – Assurance-vie", "Horizon Assurances"];
  var ASSUREURS_IARD = ["Assurances Solidaires", "Mutuelle Assur'Horizon", "Compagnie Assurante du Nord", "Assurances Régionales de l'Ouest", "Groupe Assur Prévoyance"];
  var ENTREPRISES = ["TRANSLOG Sud", "Établissements Duvivier", "Groupe Marnière", "SODEXPRESS", "Atelier Cormier & Fils", "Ciments Lagarde", "Distribution Nord-Est", "Société Belcourt"];
  function veh(art, nom) { return { l: art + " " + nom, d: (art === "le" ? "du " : "de la ") + nom }; }
  var VEHICULES = [veh("la", "berline Solana de 2014"), veh("la", "citadine Lumi de 2017"), veh("le", "break Torino de 2013"), veh("le", "SUV Kordo de 2018"), veh("le", "monospace Vexa de 2012"), veh("la", "citadine Orlo de 2016")];
  var DEUX_ROUES = [veh("la", "moto Rovex 650 de 2015"), veh("le", "scooter Zenit 125 de 2019"), veh("la", "moto Tarko 500 de 2012")];
  var BIENS = [
    { lib: "une montre de collection", d: "d'une montre de collection", acq: "la facture d'achat d'origine et le certificat d'authenticité", pat: "Montre de collection (mentionnée au dossier)" },
    { lib: "un tableau ancien", d: "d'un tableau ancien", acq: "l'acte de donation de ses parents, qui mentionne le tableau", pat: "Tableau ancien reçu en famille (mentionné au dossier)" },
    { lib: "un piano droit", d: "d'un piano droit", acq: "la facture d'achat du piano", pat: "Piano (mentionné au dossier)" },
    { lib: "une collection de timbres", d: "d'une collection de timbres", acq: "le catalogue de la collection et l'attestation d'un expert", pat: "Collection de timbres (mentionnée au dossier)" },
    { lib: "un mobilier ancien (buffet et commode)", d: "d'un mobilier ancien (buffet et commode)", acq: "l'attestation de succession mentionnant les meubles", pat: "Mobilier ancien reçu en famille (mentionné au dossier)" }
  ];

  function cheque(op) { return Object.assign({ type: "depot_cheque" }, op); }
  function jour(r, lo, hi) { return r.n(lo, hi); }
  function arrondi(x, p) { return Math.round(x / p) * p; }

  var F = {};

  /* ---------- 1. Commerçant : remise d'espèces exceptionnelle, justifiée par le livre de recettes ---------- */
  F.recettes = function (r) {
    var I = B.ident(r, { st: ["independant"], typ: "esp" }), p = I.p, g = B.G(I), W = r.pas(1000, 1800, 50), sem = [], i, H, E1, E2, evt = r.pick(p.evts), deux = r.chance(0.4);
    for (i = 0; i < 4; i++) sem.push(Math.round(W * (0.88 + r.f() * 0.24) / 50) * 50);
    H = B.somme(sem);
    var maxSem = Math.max.apply(null, sem), minSem = Math.min.apply(null, sem);
    E1 = arrondi(maxSem * r.pas(36, 62, 2) / 10, 100);
    E2 = deux ? arrondi(maxSem * r.pas(30, 52, 2) / 10, 100) : 0;
    var T = H + E1 + E2, L = arrondi(T + r.pas(150, 650, 50), 50), chq = arrondi(I.revenus * r.pas(40, 60, 5) / 100, 50);
    var j1 = jour(r, 9, 15), j2 = j1 + r.n(5, 9);
    var jours = [4, 11, 18, 25], agM = {}, mm;
    [3, 2, 1].forEach(function (mo) { var s = mo === 1 ? sem : RL.repartir(r, arrondi(H * (0.9 + r.f() * 0.2), 50), 4); agM[mo] = s; });
    var ops = [{ k: "rem", type: "depot_especes", libelle: "Remises d'espèces hebdomadaires (4 remises)", detail: p.remDet + ", de " + eur(minSem) + " à " + eur(maxSem) + " par semaine", montant: H, mois: 1, jour: 25, atypique: false, explication: "Habituelle : rythme et montants habituels, en rapport avec l'activité." },
      { k: "chq", type: "depot_cheque", libelle: "Remise de chèques de clients", detail: "Groupe de chèques habituels", montant: chq, mois: 1, jour: 26, atypique: false, explication: "Habituelle : remise de chèques courante pour " + p.act + "." },
      { k: "e1", type: "depot_especes", libelle: "Remise d'espèces au guichet", detail: "Remise exceptionnelle (" + evt + ")", montant: E1, mois: 1, jour: j1, atypique: true, explication: "Atypique : montant égal à " + B.foisDe(E1, maxSem) + " la plus forte remise hebdomadaire habituelle (" + eur(maxSem) + ")." }];
    if (deux) ops.push({ k: "e2", type: "depot_especes", libelle: "Remise d'espèces au guichet", detail: "Seconde remise exceptionnelle", montant: E2, mois: 1, jour: j2, atypique: true, explication: "Atypique : les espèces du mois atteignent " + eur(T) + ", soit " + B.foisDe(T, H) + " le niveau habituel de " + eur(H) + "." });
    else ops[2].explication += " Les espèces du mois atteignent " + eur(T) + " au lieu de " + eur(H) + " d'habitude.";
    var cp = [{ rubrique: "Situation professionnelle", texte: "Recettes du mois inscrites au livre : " + eur(L) + " en espèces. Remises d'espèces du mois : " + eur(T) + "." }, { rubrique: "Fonctionnement du compte", texte: "Remise exceptionnelle de " + eur(E1) + (deux ? " puis de " + eur(E2) : "") + ", liée " + B.aEvt(evt) + "." }];
    var spec = {
      objectif: (deux ? "Deux remises" : "Une remise") + " d'espèces exceptionnelle" + (deux ? "s" : "") + " sur le compte " + (I.f ? "d'une" : "d'un") + " " + I.profession.toLowerCase().replace(/ \(.*\)/, "") + " : le livre de recettes " + (deux ? "les" : "la") + " justifie.",
      ops: ops, ret: 0, sansRetrait: true,
      pieces: { attendues: ["recettes"], acceptables: ["avis_impo", "explication"] },
      contact: B.contactDe(r, null, [g.nomC + " explique que le mois a été exceptionnel à cause " + B.deEvt(evt) + ", sans pouvoir donner les chiffres de tête. " + g.Il + " propose de montrer son livre de recettes.", "Le livre est transmis : les recettes en espèces du mois y sont inscrites jour par jour, y compris " + (deux ? "les deux journées exceptionnelles." : "la journée exceptionnelle.")],
        ["Livre de recettes du mois : " + eur(L) + " de recettes en espèces"],
        "Les recettes du livre (" + eur(L) + ") couvrent les espèces déposées dans le mois (" + eur(T) + ") : la remise exceptionnelle correspond à une activité réelle.", cp),
      issue: "coherent",
      explication: "Un dépôt d'espèces élevé n'est pas un soupçon pour " + (I.f ? "une" : "un") + " commerçant" + (I.f ? "e" : "") + " : ici le livre de recettes (" + eur(L) + ") couvre le total des espèces déposées (" + eur(T) + "), et l'écart avec le niveau habituel (" + eur(H) + ") s'explique par " + evt + ". L'opération est cohérente avec l'activité.",
      retenir: ["Pour un commerçant, un dépôt d'espèces élevé se justifie par le livre de recettes, à condition qu'il couvre le total des espèces du mois.", "Comparer toujours les justificatifs aux montants : ici " + eur(L) + " de recettes pour " + eur(T) + " déposés.", "Un événement ponctuel (" + evt + ") explique une hausse d'activité sans changer le profil du client."],
      argumentaire: ["Rapprocher les remises exceptionnelles du rythme habituel (" + eur(H) + " par mois environ)", "Comparer les recettes du livre (" + eur(L) + ") aux espèces déposées (" + eur(T) + ")", "Relever que l'activité explique la hausse (" + evt + ")", "Conclure : opération cohérente, pas de déclaration, dossier mis à jour"],
      plan: null
    };
    /* relevé d'un indépendant : recettes en espèces, chèques, fournisseurs et charges ; le solde reste positif */
    var credits = [3, 2, 1].map(function (mo) { return B.somme(agM[mo]) + chq; });
    spec.plan = B.planIndependant(r, I, { cmin: Math.min.apply(null, credits), extra: { agreges: { rem: { jours: jours, lib: p.rem, m: agM } }, variantes: { chq: { 3: arrondi(chq * 0.92, 50), 2: arrondi(chq * 1.06, 50) } } } });
    return B.assembler(r, I, spec);
  };

  /* ---------- 2. Chèque de notaire : part de succession ---------- */
  F.succession = function (r) {
    var I = B.ident(r, { st: ["retraite", "salarie"], age: [42, 66], rev: [1200, 2800], logement: r.pick(["proprio", "locataire", "credit"]) }), g = B.G(I);
    var S = arrondi(Math.max(I.revenus * r.pas(30, 140, 5) / 10, 7000), 500), not = r.pick(NOTAIRES), who = r.pick(["sa mère", "son père", "sa tante", "son oncle"]), nbH = r.n(2, 4), mois = r.n(4, 11);
    var def = who === "sa mère" ? "sa mère" : who;
    var spec = {
      objectif: "Un chèque de notaire de " + eur(S) + " sur le compte " + (I.f ? "d'une " : "d'un ") + I.profession.toLowerCase().replace(/ \(.*\)/, "") + " : l'attestation du notaire explique l'origine des fonds.",
      ops: [cheque({ k: "chq", libelle: "Chèque de l'" + not + " (notaire)", detail: "Règlement d'une succession", montant: S, mois: 1, jour: jour(r, 8, 24), atypique: true, explication: "Atypique : somme égale à " + B.dureeDe(S, I.revenus, I.revNom) + ", versée par un notaire alors que " + g.cl + " ne reçoit habituellement que " + I.revPos + "." })],
      pieces: { attendues: ["attestation_notaire"], acceptables: ["explication"] },
      contact: B.contactDe(r, null, [g.nomC + " explique qu'" + g.il + " a hérité de " + def + ", décédé" + (def === "sa mère" || def === "sa tante" ? "e" : "") + " il y a " + B.mots(mois) + " mois, et que la succession vient d'être réglée par le notaire.", g.Il + " transmet l'attestation du notaire : la succession est partagée entre " + B.mots(nbH) + " héritiers et la part " + (I.f ? "de la cliente" : "du client") + " est de " + eur(S) + "."],
        ["Attestation du notaire (" + not + ") : part de " + eur(S) + " revenant à " + g.nomC + " dans la succession de " + def],
        "L'attestation du notaire correspond exactement au montant du chèque (" + eur(S) + ") : l'origine des fonds est établie.",
        [{ rubrique: "Situation patrimoniale", texte: "Succession de " + def + " : part de " + eur(S) + " perçue par chèque du notaire." }, { rubrique: "Situation personnelle", texte: "Décès de " + def + " il y a " + B.mots(mois) + " mois." }]),
      issue: "coherent",
      explication: "Le chèque de " + eur(S) + " émane d'un notaire et correspond à la part de succession " + (I.f ? "de la cliente" : "du client") + ", établie par l'attestation du notaire. Le montant est inhabituel par rapport aux revenus (" + eur(I.revenus) + " par mois) mais il est justifié par un événement familial documenté : l'opération est cohérente.",
      retenir: ["Un chèque de notaire s'explique par l'attestation du notaire (succession, vente immobilière).", "Vérifier que le montant de l'attestation correspond au chèque déposé : ici " + eur(S) + ".", "Un montant élevé et inhabituel n'est pas un soupçon quand il est justifié par une pièce probante."],
      argumentaire: ["Rapprocher le chèque de " + eur(S) + " des revenus (" + eur(I.revenus) + " par mois) et du patrimoine du dossier", "Demander l'attestation du notaire et vérifier qu'elle correspond au montant", "Relever la cohérence avec la situation familiale (décès de " + def + ")", "Conclure : opération cohérente, dossier mis à jour (succession)"]
    };
    return B.particulier(r, I, spec);
  };

  /* ---------- 3. Don familial : acte de donation ---------- */
  F.donation = function (r) {
    var I = B.ident(r, { st: ["salarie", "alternance"], age: [22, 38], rev: [1500, 2700], logement: "locataire", sexe: r.pick(["f", "m"]) }), g = B.G(I);
    var D = r.pas(Math.max(12, Math.ceil(I.revenus * 5 / 1000)), 30, 1) * 1000;
    var don = r.chance(0.5), parent = r.chance(0.5) ? "père" : "mère", pr = B.personne(r, parent === "père" ? "m" : "f", I.age + 28), proj = r.pick(["l'apport de l'achat de sa résidence principale", "l'apport de l'achat d'un premier appartement", "son projet d'achat immobilier"]);
    var acte = don ? "Déclaration de don manuel de " + eur(D) + " enregistrée au service des impôts, signée par " + pr.civilite + " " + pr.prenom + " " + I.nom : "Acte de donation notarié de " + eur(D) + " signé par " + pr.civilite + " " + pr.prenom + " " + I.nom + " au profit " + (I.f ? "de sa fille" : "de son fils");
    var spec = {
      objectif: "Un chèque de " + eur(D) + " du " + (parent === "père" ? "père" : "de la mère") + " d'" + (I.f ? "une jeune " : "un jeune ") + I.profession.toLowerCase().replace(/ \(.*\)/, "") + " : " + (don ? "la déclaration de don manuel" : "l'acte de donation") + " justifie l'opération.",
      ops: [cheque({ k: "chq", libelle: "Chèque de " + pr.civilite + " " + pr.prenom + " " + I.nom, detail: "Chèque de " + (parent === "père" ? "son père" : "sa mère"), montant: D, mois: 1, jour: jour(r, 6, 22), atypique: true, explication: "Atypique : somme égale à " + B.dureeDe(D, I.revenus, I.revNom) + ", versée par un particulier alors que " + g.cl + " ne reçoit jamais de chèque." })],
      pieces: { attendues: ["acte_donation"], acceptables: ["explication"] },
      contact: B.contactDe(r, null, [g.nomC + " explique que " + (parent === "père" ? "son père" : "sa mère") + " lui fait un don pour financer " + proj + ".", g.Il + " transmet " + (don ? "la déclaration de don manuel" : "l'acte de donation") + " : le don est déclaré et le montant correspond au chèque."],
        [acte],
        (don ? "La déclaration de don manuel" : "L'acte de donation") + " correspond exactement au chèque (" + eur(D) + ") et le donateur est un parent : l'origine des fonds est établie.",
        [{ rubrique: "Projet", texte: "Achat immobilier en préparation, financé en partie par le don de " + (parent === "père" ? "son père" : "sa mère") + "." }, { rubrique: "Situation patrimoniale", texte: "Don de " + eur(D) + " de " + (parent === "père" ? "son père" : "sa mère") + ", déclaré." }]),
      issue: "coherent",
      explication: "Un chèque de " + eur(D) + " d'un parent est inhabituel pour " + (I.f ? "une cliente" : "un client") + " qui gagne " + eur(I.revenus) + " par mois, mais " + (don ? "la déclaration de don manuel" : "l'acte de donation") + " en justifie l'origine et le montant, et le projet d'achat est plausible. L'opération est cohérente.",
      retenir: ["Un don familial se justifie par un acte de donation ou une déclaration de don manuel.", "Le donateur est un proche et le montant de l'acte correspond au chèque (" + eur(D) + ") : l'origine des fonds est établie.", "Mettre à jour le dossier : projet et patrimoine."],
      argumentaire: ["Rapprocher le chèque de " + eur(D) + " des revenus (" + eur(I.revenus) + " par mois)", "Demander l'acte de donation ou la déclaration de don manuel", "Vérifier que le montant et le donateur correspondent", "Conclure : opération cohérente, dossier mis à jour (projet immobilier)"]
    };
    return B.particulier(r, I, spec);
  };

  /* ---------- 4. Vente d'un véhicule entre particuliers : chèque de banque ---------- */
  F.vente_vehicule = function (r) {
    var I = B.ident(r, { st: ["salarie"], age: [28, 62], rev: [1600, 3000] }), g = B.G(I);
    var V = arrondi(Math.max(3500, I.revenus * 1.4) + r.n(0, 80) * 100, 100), veh = r.pick(VEHICULES), ach = B.personne(r, null, 40);
    I.patrimoine = I.patrimoine.concat(["Deux véhicules"]);
    var spec = {
      objectif: "Un chèque de banque de " + eur(V) + " : la vente d'un véhicule entre particuliers se justifie avec le certificat de cession.",
      ops: [cheque({ k: "chq", libelle: "Chèque de banque de " + B.nomComplet(ach), detail: "Chèque de banque d'un particulier", montant: V, mois: 1, jour: jour(r, 6, 24), atypique: true, explication: "Atypique : somme supérieure à " + B.moisDe(V, I.revenus, I.revNom) + ", versée par un particulier sans lien connu." })],
      pieces: { attendues: ["cession_vehicule"], acceptables: ["explication"] },
      contact: B.contactDe(r, null, [g.nomC + " explique qu'" + g.il + " a vendu l'un des deux véhicules du foyer (" + veh.l + ") à un particulier, " + g.il + " n'en avait plus l'usage.", g.Il + " transmet le certificat de cession et la facture de vente, signés par l'acheteur."],
        ["Certificat de cession et facture de vente " + veh.d + " pour " + eur(V) + ", signés par " + B.nomComplet(ach)],
        "Le prix inscrit sur le certificat de cession et la facture (" + eur(V) + ") correspond exactement au chèque de banque.",
        [{ rubrique: "Situation patrimoniale", texte: "Vente d'un véhicule pour " + eur(V) + " ; le foyer garde un véhicule." }]),
      issue: "coherent",
      explication: "Le chèque de banque de " + eur(V) + " correspond au prix de vente d'un véhicule d'occasion entre particuliers, prouvé par le certificat de cession et la facture. Le dossier mentionne deux véhicules : la vente de l'un d'eux est cohérente. L'opération est cohérente.",
      retenir: ["La vente d'un véhicule entre particuliers se justifie par le certificat de cession et la facture ou le contrat de vente.", "Le prix de vente doit correspondre au montant du chèque : ici " + eur(V) + ".", "Le patrimoine du dossier (deux véhicules) rend l'explication plausible."],
      argumentaire: ["Rapprocher le chèque de " + eur(V) + " des revenus (" + eur(I.revenus) + " par mois) et du patrimoine (deux véhicules)", "Demander le certificat de cession et la facture de vente", "Vérifier que le prix correspond au chèque", "Conclure : opération cohérente, dossier mis à jour"]
    };
    return B.particulier(r, I, spec);
  };

  /* ---------- 5. Solde de tout compte : chèque de l'ancien employeur ---------- */
  F.solde_tout_compte = function (r) {
    var I = B.ident(r, { st: ["salarie"], age: [40, 58], rev: [2400, 4000], aise: true }), g = B.G(I), ent = r.pick(ENTREPRISES), anc = 0, motif = r.pick(["licenciement économique", "rupture conventionnelle", "licenciement"]);
    anc = r.n(9, Math.max(10, Math.min(24, I.age - 24)));
    var A = arrondi(Math.min(62000, I.revenus * (anc * 0.3 + 1.2 + r.f() * 1.6)), 100);
    I.professionnel = I.profession.replace(/ \(CDI\)/, "") + " salarié" + (I.f ? "e" : "") + " de la société " + ent + " depuis " + anc + " ans.";
    var spec = {
      objectif: "Un chèque de " + eur(A) + " de l'ancien employeur d'un" + (I.f ? "e salariée" : " salarié") + " qui quitte son entreprise : le solde de tout compte l'explique.",
      ops: [cheque({ k: "chq", libelle: "Chèque de la société " + ent, detail: "Libellé : « solde de tout compte »", montant: A, mois: 1, jour: jour(r, 8, 24), atypique: true, explication: "Atypique : somme égale à " + B.dureeDe(A, I.revenus, I.revNom) + ", versée par l'employeur sous un libellé jamais vu sur le compte." })],
      pieces: { attendues: ["solde_tout_compte"], acceptables: ["bulletins", "explication"] },
      contact: B.contactDe(r, null, [g.nomC + " explique qu'" + g.il + " quitte l'entreprise (" + motif + ") après " + anc + " ans d'ancienneté et que ce chèque règle les indemnités et les congés payés.", g.Il + " transmet le solde de tout compte signé et le dernier bulletin de paie."],
        ["Solde de tout compte de la société " + ent + " : " + eur(A) + " (indemnités, congés payés et préavis)"],
        "Le solde de tout compte (" + eur(A) + ") correspond exactement au chèque, et l'ancienneté de " + anc + " ans rend ce montant plausible.",
        [{ rubrique: "Situation professionnelle", texte: "Départ de l'entreprise " + ent + " (" + motif + ") après " + anc + " ans." }, { rubrique: "Revenus", texte: "Indemnités perçues : " + eur(A) + ". Le salaire n'est plus versé à l'issue du préavis." }]),
      issue: "coherent",
      explication: "Un chèque de " + eur(A) + " de l'ancien employeur s'explique par le solde de tout compte (indemnités, congés payés, préavis) d'" + (I.f ? "une salariée" : "un salarié") + " de " + anc + " ans d'ancienneté, ici prouvé par le document signé. Le montant est cohérent avec le salaire mensuel (" + eur(I.revenus) + ") : l'opération est cohérente.",
      retenir: ["Un solde de tout compte explique le chèque d'un ancien employeur.", "Comparer le montant à l'ancienneté et au salaire : " + anc + " ans à " + eur(I.revenus) + " par mois.", "Après un départ, penser à mettre à jour les revenus du dossier."],
      argumentaire: ["Rapprocher le chèque de " + eur(A) + " du salaire (" + eur(I.revenus) + " par mois)", "Demander le solde de tout compte et vérifier qu'il correspond au chèque", "Relever la cohérence avec l'ancienneté de " + anc + " ans", "Conclure : opération cohérente, dossier mis à jour (situation professionnelle)"]
    };
    return B.particulier(r, I, spec);
  };

  /* ---------- 6. Rachat partiel d'une assurance-vie ---------- */
  F.rachat_av = function (r) {
    var I = B.ident(r, { st: ["retraite", "salarie"], age: [56, 76], rev: [1800, 3000], logement: "proprio", av: true }), g = B.G(I), ass = r.pick(ASSUREURS);
    var X = r.pas(40, 90, 5) * 1000, R = arrondi(Math.max(I.revenus * 3, X * r.pas(20, 45, 5) / 100), 1000), projs = r.pick([["des travaux dans sa résidence principale", "Travaux dans sa résidence principale"], ["l'achat d'un véhicule", "Achat d'un véhicule"], ["l'aide à un enfant pour un apport immobilier", "Aide à un enfant pour un apport immobilier"], ["le remplacement de sa toiture", "Remplacement de la toiture de sa résidence"]]), proj = projs[0];
    I.patrimoine = I.patrimoine.concat(["Assurance-vie auprès d'un assureur extérieur : environ " + eur(X) + " (déclarée à l'ouverture du dossier)"]);
    var spec = {
      objectif: "Un chèque d'assureur de " + eur(R) + " sur le compte " + (I.f ? "d'une" : "d'un") + " " + (I.st === "retraite" ? (I.f ? "retraitée" : "retraité") : I.profession.toLowerCase().replace(/ \(.*\)/, "")) + " : le rachat partiel de son assurance-vie, déjà connue au dossier.",
      ops: [cheque({ k: "chq", libelle: "Chèque de l'assureur " + ass, detail: "Rachat partiel d'assurance-vie", montant: R, mois: 1, jour: jour(r, 8, 24), atypique: true, explication: "Atypique : somme égale à " + B.dureeDe(R, I.revenus, I.revNom) + ", versée par un assureur sans lien avec les opérations habituelles." })],
      pieces: { attendues: ["avis_rachat"], acceptables: ["releves_autre_banque", "explication"] },
      contact: B.contactDe(r, null, [g.nomC + " explique qu'" + g.il + " a demandé un rachat partiel de son contrat d'assurance-vie pour financer " + proj + ".", g.Il + " transmet l'avis de rachat de l'assureur : il porte sur " + eur(R) + " et le contrat était bien déclaré au dossier."],
        ["Avis de rachat partiel de " + eur(R) + " du contrat d'assurance-vie " + ass],
        "L'avis de rachat (" + eur(R) + ") correspond exactement au chèque, et le contrat (environ " + eur(X) + ") figurait déjà au patrimoine du dossier.",
        [{ rubrique: "Situation patrimoniale", texte: "Rachat partiel de " + eur(R) + " sur le contrat d'assurance-vie (environ " + eur(X) + " avant rachat)." }, { rubrique: "Projet", texte: projs[1] + " : projet financé par ce rachat." }]),
      issue: "coherent",
      explication: "Le chèque de " + eur(R) + " est le rachat partiel d'une assurance-vie déjà connue au dossier (environ " + eur(X) + "), prouvé par l'avis de rachat de l'assureur. Le projet " + (I.f ? "de la cliente" : "du client") + " est plausible : l'opération est cohérente.",
      retenir: ["Un rachat d'assurance-vie se justifie par l'avis de rachat de l'assureur.", "Le contrat figurait déjà au dossier : l'historique du dossier est un élément de cohérence.", "Vérifier que le montant du rachat correspond au chèque : ici " + eur(R) + "."],
      argumentaire: ["Rapprocher le chèque de " + eur(R) + " des revenus (" + eur(I.revenus) + " par mois) et du patrimoine (assurance-vie d'environ " + eur(X) + ")", "Demander l'avis de rachat de l'assureur", "Vérifier que le montant correspond au chèque", "Conclure : opération cohérente, dossier mis à jour"]
    };
    return B.particulier(r, I, spec);
  };

  /* ---------- 7. Prêt familial remboursé en espèces ---------- */
  F.pret_familial = function (r) {
    var I = B.ident(r, { st: ["salarie"], age: [30, 56], rev: [1500, 2600], livretNon: false }), g = B.G(I);
    var L = arrondi(Math.max(5000, I.revenus * r.pas(26, 48, 2) / 10), 500), moitie = L / 2, ans = r.n(2, 5), lien = I.f ? r.pick(["son frère", "sa sœur"]) : r.pick(["son frère", "sa sœur"]);
    var emp = lien === "son frère" ? B.personne(r, "m", I.age) : B.personne(r, "f", I.age);
    emp.nom = I.nom;
    var j1 = jour(r, 4, 14), j2 = j1 + r.n(7, 12);
    var dep = function (k, jj, det) { return { k: k, type: "depot_especes", libelle: "Dépôt d'espèces en agence", detail: det, montant: moitie, mois: 1, jour: jj, atypique: true }; };
    var o1 = dep("d1", j1, "Premier dépôt"), o2 = dep("d2", j2, "Deuxième dépôt, " + B.mots(j2 - j1) + " jours plus tard");
    o1.explication = "Atypique : première opération en espèces du dossier, montant supérieur à " + (moitie > I.revenus ? "un mois" : "la moitié d'un mois") + " de " + I.revNom + ".";
    o2.explication = "Atypique : même montant. Total des deux dépôts : " + eur(L) + ", sous le seuil de " + eur(10000) + " du mois.";
    var spec = {
      objectif: "Deux dépôts d'espèces de " + eur(moitie) + " : le fractionnement est expliqué par le remboursement d'un prêt familial documenté.",
      ops: [o1, o2],
      observations: ["Historique du compte : virement sortant de " + eur(L) + " libellé « prêt à " + emp.prenom + " » il y a " + B.mots(ans) + " ans."],
      pieces: { attendues: ["reconnaissance_dette"], acceptables: ["releves_autre_banque", "explication"] },
      contact: B.contactDe(r, null, [g.nomC + " explique que " + lien + " " + emp.prenom + " lui rembourse en deux fois les " + eur(L) + " qu'" + g.il + " lui avait prêtés il y a " + B.mots(ans) + " ans. " + (emp.f ? "Elle" : "Il") + " lui a remis les espèces de la main à la main.", g.Il + " retrouve et transmet la reconnaissance de dette."],
        ["Reconnaissance de dette de " + eur(L) + " signée par " + B.nomComplet(emp) + ", datée d'il y a " + B.mots(ans) + " ans", "Le virement de " + eur(L) + " de la même période figure dans l'historique du compte"],
        "La reconnaissance de dette et l'ancien virement correspondent exactement au total des deux dépôts.",
        [{ rubrique: "Situation patrimoniale", texte: "Prêt familial de " + eur(L) + " à " + lien + ", intégralement remboursé." }]),
      issue: "coherent",
      explication: "Deux dépôts en espèces, mais leur total (" + eur(L) + ") est exactement le prêt que " + (I.f ? "la cliente" : "le client") + " avait consenti à " + lien + ", prouvé par une reconnaissance de dette et par un virement déjà visible dans l'historique du compte. Le fractionnement seul n'est pas un indice de blanchiment quand il est expliqué et justifié : l'opération est cohérente.",
      retenir: ["Le fractionnement en deux dépôts n'est pas suffisant pour déclarer : il faut le rapprocher des explications et des pièces.", "L'historique du compte est une pièce du dossier : il peut corroborer un justificatif.", "Le total des dépôts (" + eur(L) + ") doit correspondre au montant justifié."],
      argumentaire: ["Rapprocher les deux dépôts de " + eur(moitie) + " (" + eur(L) + " au total) du " + I.revNom + " et du patrimoine " + (I.f ? "de la cliente" : "du client"), "Citer la reconnaissance de dette et l'ancien virement de " + eur(L) + " dans l'historique", "Conclure : opération cohérente, dossier mis à jour (prêt familial remboursé)"]
    };
    return B.particulier(r, I, spec);
  };

  /* ---------- 8. Retrait en espèces pour acheter un véhicule à un particulier ---------- */
  F.achat_vehicule_cash = function (r) {
    var I = B.ident(r, { st: ["salarie"], age: [38, 60], rev: [3000, 4200], aise: true, av: true, logement: "proprio" }), g = B.G(I), ret = B.retraitHab(r, I);
    var Rt = arrondi(Math.max(5000, I.revenus * 1.4), 500) + r.n(0, 4) * 500;
    Rt = Math.min(Rt, 9500);
    var deuxR = r.chance(0.3), veh = deuxR ? r.pick(DEUX_ROUES) : r.pick(VEHICULES), ven = B.personne(r, null, 45);
    I.patrimoine = I.patrimoine.concat(["Assurance-vie : " + eur(r.pas(40, 70, 5) * 1000)]);
    I.produits = I.produits.concat(["Assurance-vie"]);
    var spec = {
      objectif: "Un retrait de " + eur(Rt) + " en espèces pour acheter " + (deuxR ? "un deux-roues" : "un véhicule") + " à un particulier : " + (I.f ? "une cliente aisée" : "un client aisé") + ", une vente documentée.",
      ops: [{ k: "retr", type: "retrait_especes", libelle: "Retrait d'espèces au guichet", detail: "Retrait exceptionnel", montant: Rt, mois: 1, jour: jour(r, 8, 24), atypique: true, explication: "Atypique : retrait égal à " + B.foisDe(Rt, ret) + " le retrait habituel de " + eur(ret) + "." }],
      ret: ret,
      observations: ["Au guichet, " + (I.f ? "la cliente" : "le client") + " a indiqué qu'" + g.il + " voulait « acheter " + (deuxR ? "un deux-roues" : "un véhicule") + " à un particulier »."],
      pieces: { attendues: ["cession_vehicule"], acceptables: ["explication"] },
      contact: B.contactDe(r, null, [g.nomC + " confirme l'achat " + veh.d + " à un particulier, payé en espèces à la remise des clés.", g.Il + " transmet le certificat de cession signé et la facture de vente, au prix de " + eur(Rt) + "."],
        ["Certificat de cession et facture de vente " + veh.d + " pour " + eur(Rt) + ", signés par " + B.nomComplet(ven)],
        "Le prix du certificat de cession (" + eur(Rt) + ") correspond exactement au retrait, et " + (I.f ? "la cliente" : "le client") + " a les moyens de cet achat.",
        [{ rubrique: "Situation patrimoniale", texte: "Achat d'un véhicule pour " + eur(Rt) + " payé en espèces." }, { rubrique: "Centres d'intérêt", texte: "Projet d'achat annoncé au guichet : " + (deuxR ? "un deux-roues" : "un véhicule") + "." }]),
      issue: "coherent",
      explication: "Le retrait de " + eur(Rt) + " correspond à l'achat annoncé au guichet, prouvé par le certificat de cession et la facture au même prix. " + (I.f ? "La cliente" : "Le client") + " a des revenus de " + eur(I.revenus) + " par mois et un patrimoine qui permettent cet achat : l'opération est cohérente.",
      retenir: ["Un retrait d'espèces élevé peut être cohérent quand le client l'annonce et le justifie : l'observation du guichet est un élément du dossier.", "Comparer le profil financier (revenus, épargne, assurance-vie) au montant : " + eur(Rt) + " reste en rapport avec la situation.", "Le certificat de cession prouve le prix payé."],
      argumentaire: ["Rapprocher le retrait de " + eur(Rt) + " du retrait habituel (" + eur(ret) + ") et du patrimoine", "Relever l'observation du guichet (achat annoncé)", "Demander le certificat de cession et vérifier le prix", "Conclure : opération cohérente, dossier mis à jour"]
    };
    return B.particulier(r, I, spec);
  };

  /* ---------- 9. Vente d'un bien de valeur : chèque de l'acheteur ---------- */
  F.vente_bien = function (r) {
    var I = B.ident(r, { st: ["salarie"], age: [34, 62], rev: [1900, 3900] }), g = B.G(I), bien = r.pick(BIENS), ach = B.personne(r, null, 45);
    var V = arrondi(Math.max(3500, I.revenus * 1.5) + r.n(0, 90) * 100, 100);
    I.patrimoine = I.patrimoine.concat([bien.pat]);
    var spec = {
      objectif: "Un chèque de " + eur(V) + " pour la vente " + bien.d + " : la facture de vente et le justificatif d'acquisition suffisent.",
      ops: [cheque({ k: "chq", libelle: "Chèque de " + B.nomComplet(ach), detail: "Vente " + bien.d, montant: V, mois: 1, jour: jour(r, 6, 24), atypique: true, explication: "Atypique : somme supérieure à " + B.moisDe(V, I.revenus, I.revNom) + ", versée par un particulier sans lien connu." })],
      pieces: { attendues: ["vente_bien"], acceptables: ["explication"] },
      contact: B.contactDe(r, null, [g.nomC + " explique qu'" + g.il + " a vendu " + bien.lib + " à un particulier rencontré par une annonce, payé par chèque.", g.Il + " transmet la facture de vente, avec " + bien.acq + "."],
        ["Facture de vente " + bien.d + " pour " + eur(V) + ", au nom de " + B.nomComplet(ach), "Justificatif d'acquisition : " + bien.acq],
        "La facture (" + eur(V) + ") correspond au chèque, l'acheteur est identifié et le justificatif d'acquisition établit que le bien appartenait " + (I.f ? "à la cliente" : "au client") + ".",
        [{ rubrique: "Situation patrimoniale", texte: "Vente " + bien.d + " pour " + eur(V) + "." }, { rubrique: "Origine du bien", texte: "Bien acquis légitimement : " + bien.acq + "." }]),
      issue: "coherent",
      explication: "Le chèque de " + eur(V) + " correspond à la vente " + bien.d + ", mentionnée au patrimoine du dossier. La facture est au même montant, l'acheteur est identifié et le justificatif d'acquisition prouve la propriété du bien : l'opération est cohérente.",
      retenir: ["Une vente de bien se justifie par une facture ou un contrat de vente, avec un justificatif d'acquisition.", "L'acheteur doit être identifié et le montant de la facture correspondre au chèque (" + eur(V) + ").", "Le bien figurait déjà au patrimoine du dossier : l'historique du dossier est un élément de cohérence."],
      argumentaire: ["Rapprocher le chèque de " + eur(V) + " des revenus (" + eur(I.revenus) + " par mois) et du patrimoine mentionné au dossier", "Demander la facture de vente et le justificatif d'acquisition", "Vérifier que le montant et l'acheteur sont cohérents", "Conclure : opération cohérente, dossier mis à jour"]
    };
    return B.particulier(r, I, spec);
  };

  /* ---------- 10. Indemnité d'assurance après sinistre ---------- */
  F.sinistre = function (r) {
    var pro = r.chance(0.5), ass = r.pick(ASSUREURS_IARD), I, g, S, sin, spec;
    if (pro) {
      I = B.ident(r, { st: ["independant"], typ: "art" }); g = B.G(I);
      sin = I.p.sinistre; S = arrondi(Math.max(6000, I.revenus * r.pas(30, 85, 5) / 10), 500);
      var C = arrondi(I.revenus * r.pas(190, 260, 5) / 100, 50);
      spec = {
        ops: [{ k: "chq", type: "depot_cheque", libelle: "Remise de chèques de clients", detail: "Chèques habituels de la clientèle", montant: C, mois: 1, jour: jour(r, 22, 26), atypique: false, explication: "Habituelle : remise de chèques courante pour l'activité." }, cheque({ k: "sin", libelle: "Chèque de l'assureur " + ass, detail: "Indemnisation d'un sinistre", montant: S, mois: 1, jour: jour(r, 8, 20), atypique: true, explication: "Atypique : somme égale à " + B.dureeDe(S, I.revenus, "revenus") + ", versée par un assureur alors que " + g.cl + " ne reçoit habituellement que les chèques de ses clients." })],
        ret: 0, sansRetrait: true, motifTxt: sin, pieces: { attendues: ["indemnite_assurance"], acceptables: ["factures", "explication"] }
      };
    } else {
      I = B.ident(r, { st: ["salarie", "retraite"], age: [38, 72], rev: [1700, 3200], logement: "proprio" }); g = B.G(I);
      sin = r.pick(["un dégât des eaux important", "un incendie dans la cuisine", "un cambriolage"]); S = arrondi(Math.max(6000, I.revenus * r.pas(30, 85, 5) / 10), 500);
      spec = {
        ops: [cheque({ k: "sin", libelle: "Chèque de l'assureur " + ass, detail: "Indemnisation d'un sinistre", montant: S, mois: 1, jour: jour(r, 8, 24), atypique: true, explication: "Atypique : somme égale à " + B.dureeDe(S, I.revenus, I.revNom) + ", versée par un assureur sans lien avec les opérations habituelles." })],
        pieces: { attendues: ["indemnite_assurance"], acceptables: ["factures", "explication"] }
      };
    }
    spec.objectif = "Un chèque d'assureur de " + eur(S) + " sur le compte " + (pro ? (I.f ? "d'une artisane" : "d'un artisan") : (I.f ? "d'une cliente" : "d'un client")) + " victime d'un sinistre : le courrier de l'assureur le justifie.";
    spec.contact = B.contactDe(r, null, [g.nomC + " explique qu'" + g.il + " a subi " + sin + " et que l'assureur règle l'indemnité.", g.Il + " transmet le courrier de l'assureur : il fixe l'indemnité à " + eur(S) + "."],
      ["Courrier de l'assureur " + ass + " : indemnité de " + eur(S) + " pour " + sin],
      "Le courrier de l'assureur (" + eur(S) + ") correspond exactement au chèque et le sinistre est cohérent avec la situation " + (I.f ? "de la cliente" : "du client") + ".",
      [{ rubrique: pro ? "Situation professionnelle" : "Situation patrimoniale", texte: "Sinistre : " + sin + ". Indemnité de " + eur(S) + " versée par l'assureur." }, { rubrique: "Projet", texte: pro ? "Remise en état de l'outil de travail et reprise de l'activité." : "Remise en état du logement." }]);
    spec.issue = "coherent";
    spec.explication = "Le chèque de " + eur(S) + " est l'indemnité d'un assureur pour un sinistre, prouvée par le courrier de l'assureur au même montant. L'opération est inhabituelle par sa taille mais elle est expliquée par un événement précis et cohérent avec la situation " + (I.f ? "de la cliente" : "du client") + " : l'opération est cohérente.";
    spec.retenir = ["Une indemnité d'assurance se justifie par le courrier de l'assureur (sinistre, montant).", "Le montant du courrier doit correspondre au chèque : ici " + eur(S) + ".", "Mettre à jour le dossier : sinistre et remise en état."];
    spec.argumentaire = ["Rapprocher le chèque de " + eur(S) + " des revenus (" + eur(I.revenus) + " par mois) et des opérations habituelles", "Demander le courrier de l'assureur", "Vérifier que le sinistre et le montant sont cohérents", "Conclure : opération cohérente, dossier mis à jour"];
    if (pro) {
      var C2 = spec.ops[0].montant;
      spec.plan = B.planIndependant(r, I, { cmin: C2 * 0.94, extra: { variantes: { chq: { 3: arrondi(C2 * 0.94, 50), 2: arrondi(C2 * 1.05, 50) } } } });
      return B.assembler(r, I, spec);
    }
    return B.particulier(r, I, spec);
  };

  /* ---------- 11. Vente d'un bien immobilier : virement du notaire ---------- */
  F.vente_immo = function (r) {
    var I = B.ident(r, { st: ["salarie", "retraite"], age: [45, 74], rev: [1900, 3600], logement: r.pick(["proprio", "credit"]) }), g = B.G(I), not = r.pick(NOTAIRES);
    var V = r.pas(85, 210, 5) * 1000, ans = r.n(6, 20), bienI = r.pick([["un studio", "d'un studio", "Studio"], ["un deux-pièces", "d'un deux-pièces", "Deux-pièces"], ["un petit appartement", "d'un petit appartement", "Petit appartement"]]), bien = bienI[0];
    I.patrimoine = I.patrimoine.concat([bienI[2] + " loué (mis en vente)"]);
    var spec = {
      objectif: "Un virement de notaire de " + eur(V) + " : la vente d'un bien immobilier, documentée par l'acte de vente.",
      ops: [{ k: "vir", type: "virement", libelle: "Virement de l'" + not + " (notaire)", detail: "Prix de vente d'un bien immobilier", montant: V, mois: 1, jour: jour(r, 8, 24), atypique: true, sens: "credit", explication: "Atypique : somme égale à " + B.dureeDe(V, I.revenus, I.revNom) + ", versée par un notaire alors que " + g.cl + " ne reçoit habituellement que " + I.revPos + "." }],
      pieces: { attendues: ["acte_vente_immo"], acceptables: ["explication"] },
      contact: B.contactDe(r, null, [g.nomC + " explique qu'" + g.il + " a vendu " + bien + " qu'" + g.il + " louait depuis " + B.mots(ans) + " ans et dont " + g.il + " ne voulait plus s'occuper.", g.Il + " transmet l'acte de vente signé devant notaire."],
        ["Acte de vente " + bienI[1] + " signé devant notaire (" + not + ") : prix de " + eur(V)],
        "Le prix de l'acte de vente (" + eur(V) + ") correspond exactement au virement du notaire, et le bien figurait au patrimoine du dossier.",
        [{ rubrique: "Situation patrimoniale", texte: "Vente " + bienI[1] + " pour " + eur(V) + ", acquis il y a " + B.mots(ans) + " ans." }, { rubrique: "Projet", texte: "Placement du produit de la vente à étudier avec le conseiller." }]),
      issue: "coherent",
      explication: "Le virement de " + eur(V) + " du notaire est le prix de vente d'un bien immobilier déjà connu au patrimoine du dossier, prouvé par l'acte de vente signé devant notaire. Le montant est élevé par rapport aux revenus (" + eur(I.revenus) + " par mois) mais il est parfaitement documenté : l'opération est cohérente, et c'est l'occasion de proposer un placement.",
      retenir: ["Un virement de notaire s'explique par un acte (vente immobilière, succession).", "Le bien vendu figurait au patrimoine du dossier : c'est un élément de cohérence.", "Après une vente, proposer un placement du produit : un rendez-vous commercial."],
      argumentaire: ["Rapprocher le virement de " + eur(V) + " des revenus (" + eur(I.revenus) + " par mois) et du patrimoine mentionné au dossier", "Demander l'acte de vente et vérifier le prix", "Relever la cohérence avec le bien loué, mis en vente", "Conclure : opération cohérente, dossier mis à jour, proposer un placement"]
    };
    return B.particulier(r, I, spec);
  };

  /* ---------- 12. Artisan : gros chèque d'un client pour un chantier ---------- */
  F.prestation_pro = function (r) {
    var I = B.ident(r, { st: ["independant"], typ: "art" }), p = I.p, g = B.G(I), chant = {
      menuisier: "la fabrication et la pose des menuiseries d'un petit immeuble", plombier: "la rénovation de la chaufferie collective d'une copropriété", peintre: "le ravalement et la peinture des parties communes d'un immeuble", electricien: "la mise aux normes électriques des parties communes d'une copropriété"
    }[p.k], cli = r.pick(["la copropriété Résidence Les Tilleuls", "la copropriété Résidence du Parc", "la société immobilière Foncière du Faubourg", "la copropriété Résidence Les Acacias"]);
    var C = arrondi(I.revenus * r.pas(190, 260, 5) / 100, 50), P2 = arrondi(r.pas(Math.ceil(Math.max(9000, C * 2.2) / 500), 60, 1) * 500, 500);
    var spec = {
      objectif: "Un chèque de " + eur(P2) + " d'un gros client sur le compte " + (I.f ? "d'une artisane" : "d'un artisan") + " : le devis signé et la facture justifient le chantier.",
      ops: [{ k: "chq", type: "depot_cheque", libelle: "Remise de chèques de clients", detail: "Chèques habituels de la clientèle", montant: C, mois: 1, jour: jour(r, 22, 26), atypique: false, explication: "Habituelle : remise de chèques courante pour l'activité." },
        cheque({ k: "gros", libelle: "Chèque de " + cli, detail: "Règlement d'un chantier", montant: P2, mois: 1, jour: jour(r, 8, 20), atypique: true, explication: "Atypique : chèque égal à " + B.foisDe(P2, C) + " la remise habituelle de " + eur(C) + "." })],
      ret: 0, sansRetrait: true,
      pieces: { attendues: ["factures"], acceptables: ["avis_impo", "explication"] },
      contact: B.contactDe(r, null, [g.nomC + " explique qu'il s'agit du règlement " + B.deEvt(chant) + ", un chantier de plusieurs semaines pour " + cli + ".", g.Il + " transmet le devis signé et la facture finale."],
        ["Devis signé et facture de " + eur(P2) + " pour " + chant + ", au nom de " + cli],
        "La facture (" + eur(P2) + ") correspond exactement au chèque et le donneur d'ordre est identifié : le chantier est cohérent avec l'activité.",
        [{ rubrique: "Situation professionnelle", texte: "Chantier réalisé pour " + cli + " : " + chant + ". Règlement de " + eur(P2) + "." }, { rubrique: "Fonctionnement du compte", texte: "Chèque exceptionnel de " + eur(P2) + " en plus des remises habituelles de " + eur(C) + "." }]),
      issue: "coherent",
      explication: "Le chèque de " + eur(P2) + " règle " + chant + " : le devis et la facture, au même montant, le prouvent, et le chantier est cohérent avec le métier " + (I.f ? "de la cliente" : "du client") + ". L'opération est cohérente.",
      retenir: ["Pour un artisan, un gros chèque de client se justifie par le devis et la facture du chantier.", "Le montant de la facture doit correspondre au chèque : ici " + eur(P2) + ".", "Identifier le donneur d'ordre et vérifier la cohérence avec l'activité."],
      argumentaire: ["Rapprocher le chèque de " + eur(P2) + " des remises habituelles (" + eur(C) + ")", "Demander le devis signé et la facture", "Vérifier que le montant et le donneur d'ordre sont cohérents", "Conclure : opération cohérente, dossier mis à jour"]
    };
    spec.plan = B.planIndependant(r, I, { cmin: C * 0.94, extra: { variantes: { chq: { 3: arrondi(C * 0.94, 50), 2: arrondi(C * 1.05, 50) } } } });
    return B.assembler(r, I, spec);
  };

  var api = { familles: F, NOTAIRES: NOTAIRES, ASSUREURS: ASSUREURS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.quotidienAtypCoherent = api; }
})(typeof window !== "undefined" ? window : null);
