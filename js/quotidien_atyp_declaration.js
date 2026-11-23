/* GS Banque & Assurance – dossiers « du jour » (mouvements atypiques) : familles de cas À DÉCLARER.
   Des opérations qui ne correspondent ni au profil du client ni aux pièces fournies (ou à aucune pièce) : le doute n'est pas levé après l'examen renforcé,
   le conseiller signale le dossier à la cellule TRACFIN de l'établissement, sans informer le client. Fonctions pures. */
(function (root) {
  "use strict";

  var Q = root && root.SGBF && root.SGBF.quotidienBase ? root.SGBF.quotidienBase : require("./quotidien_base.js");
  var B = root && root.SGBF && root.SGBF.quotidienAtypBase ? root.SGBF.quotidienAtypBase : require("./quotidien_atyp_base.js");
  var RL = root && root.SGBF && root.SGBF.quotidienAtypReleve ? root.SGBF.quotidienAtypReleve : require("./quotidien_atyp_releve.js");
  var eur = Q.eur;

  var SOCIETES = ["la SARL Horizon Négoce", "la SAS Valdor Conseil", "la SARL Medius Import", "l'EURL Altair Services", "la SAS Lumen Trading", "la SARL Nordal Distribution"];
  var AGENCES = ["Paris-Bastille", "Paris-République", "Paris-Nation", "Paris-Montparnasse", "Paris-Opéra", "Boulogne-Billancourt", "Créteil", "Montreuil"];
  var VILLES_ETR = ["Lisbonne", "Dublin", "Bucarest", "Casablanca", "Istanbul", "Varsovie", "Dubaï"];
  var ORD = ["Premier", "Deuxième", "Troisième", "Quatrième", "Cinquième"];
  function arrondi(x, p) { return Math.round(x / p) * p; }
  function cloture(g) { return " Le doute n'est pas levé après l'examen renforcé : le conseiller signale le dossier à la cellule TRACFIN de l'établissement, sans rien dire " + (g.cl === "la cliente" ? "à la cliente" : "au client") + "."; }
  var RET_FIN = "Si le doute n'est pas levé après l'examen renforcé, la déclaration s'impose. Le client n'en est pas informé (art. L561-18).";
  function concl(g) { return "Conclure : déclaration à la cellule TRACFIN, sans informer " + (g.cl === "la cliente" ? "la cliente" : "le client"); }
  function opDep(k, lib, det, m, jr, exp) { return { k: k, type: "depot_especes", libelle: lib, detail: det, montant: m, mois: 1, jour: jr, atypique: true, explication: exp }; }
  function opRet(k, lib, det, m, jr, exp) { return { k: k, type: "retrait_especes", libelle: lib, detail: det, montant: m, mois: 1, jour: jr, atypique: true, explication: exp }; }
  function opChq(k, lib, det, m, jr, exp) { return { k: k, type: "depot_cheque", libelle: lib, detail: det, montant: m, mois: 1, jour: jr, atypique: true, explication: exp }; }
  function opVir(k, lib, det, m, jr, sens, exp) { return { k: k, type: "virement", libelle: lib, detail: det, montant: m, mois: 1, jour: jr, atypique: true, sens: sens, explication: exp }; }

  var F = {};

  /* ---------- 1. Dépôts d'espèces fractionnés juste sous 10 000 €, explications qui changent ---------- */
  F.fractionnement = function (r) {
    var I = B.ident(r, { st: ["etudiant", "alternance", "salarie", "cdd", "chomage"], age: [19, 36], rev: [450, 1900] }), g = B.G(I), rev = I.revenus;
    var n = r.n(3, 5), T = r.pas(90, 99, 1) * 100, X = Math.floor(T / n / 100) * 100;
    if (X < rev * 1.2) { n = 3; X = Math.floor(T / n / 100) * 100; }
    T = n * X;
    var j0 = r.n(2, 7), jours = [j0], i, gaps = [];
    for (i = 1; i < n; i++) { gaps.push(r.n(3, 5)); jours.push(jours[i - 1] + gaps[i - 1]); }
    var diff = jours[n - 1] - jours[0];
    var ops = jours.map(function (j, ix) {
      var exp = ix === 0 ? "Atypique : " + g.cl + " n'avait jamais déposé d'espèces et la somme représente " + B.dureeDe(X, rev, I.revNom) + "." : ix === n - 1 ? "Atypique : " + B.mots(n) + " dépôts de " + eur(X) + " en " + B.mots(diff) + " jours, soit " + eur(T) + ", sous le seuil de " + eur(10000) + " d'espèces par mois." : "Atypique : même montant exact, " + B.mots(gaps[ix - 1]) + " jours plus tard.";
      return opDep("d" + (ix + 1), "Dépôt d'espèces en agence", ORD[ix] + " dépôt" + (ix ? ", même montant" : ""), X, j, exp);
    });
    var hist = r.pick([
      [" dit d'abord qu'il s'agit de ses économies, puis d'argent « confié par un ami » qu'" + g.il + " ne veut pas nommer.", "ses économies, puis de l'argent confié par un ami non nommé"],
      [" parle d'abord d'un héritage, puis d'un « cadeau d'un proche » dont " + g.il + " ne veut pas dire le nom.", "un héritage, puis un cadeau d'un proche non nommé"],
      [" affirme d'abord que ce sont les gains « d'une vente de matériel », puis qu'" + g.il + " garde l'argent « pour un ami ».", "une vente de matériel, puis de l'argent gardé pour un ami"]
    ]);
    var acc = ["avis_impo", "releves_autre_banque"].concat(I.st === "salarie" || I.st === "cdd" || I.st === "alternance" ? ["bulletins"] : []);
    var spec = {
      objectif: B.mots(n).replace(/^./, function (c) { return c.toUpperCase(); }) + " dépôts d'espèces identiques, " + eur(T) + " au total, sans rapport avec les revenus : l'explication change et rien n'est justifié.",
      ops: ops,
      pieces: { attendues: ["explication"], acceptables: acc },
      contact: B.contactDe(r, null, [g.nomC + hist[0], g.Il + " refuse de fournir des documents (« pas la peine de justifier ») et remet seulement une attestation sur l'honneur manuscrite : « fonds m'appartenant »."],
        ["Attestation sur l'honneur manuscrite, sans autre document"],
        "L'attestation sur l'honneur, seule, ne corrobore rien : aucune pièce ne permet de remonter à l'origine des fonds.",
        [{ rubrique: "Origine des fonds", texte: "Non justifiée. Explications successives : " + hist[1] + "." }, { rubrique: "Contact client", texte: (g.cl === "la cliente" ? "La cliente refuse" : "Le client refuse") + " de fournir des pièces justificatives." }]),
      issue: "declaration",
      explication: "Les dépôts (" + eur(T) + ") sont sans rapport avec les revenus (" + eur(rev) + " par mois) et les habitudes " + (I.f ? "de la cliente" : "du client") + ", ils sont fractionnés sous le seuil de " + eur(10000) + ", l'explication change et rien n'est justifié (une attestation sur l'honneur seule ne suffit pas)." + cloture(g),
      retenir: ["Des montants identiques répétés pour rester sous un seuil sont un signal d'alerte.", "Une attestation sur l'honneur seule ne suffit pas à justifier l'origine des fonds.", "Des explications successives qui changent affaiblissent la crédibilité " + (I.f ? "de la cliente" : "du client") + ".", RET_FIN],
      argumentaire: ["Rapprocher les " + eur(T) + " déposés des revenus (" + eur(rev) + " par mois) et de l'absence d'historique d'espèces", "Relever les " + B.mots(n) + " dépôts identiques de " + eur(X) + ", fractionnés sous le seuil de " + eur(10000), "Noter que l'explication change et qu'aucune pièce n'est fournie", concl(g)]
    };
    return B.particulier(r, I, spec);
  };

  /* ---------- 2. Retraits d'espèces croissants d'une personne âgée isolée, au profit d'un tiers ---------- */
  F.abus_faiblesse = function (r) {
    var I = B.ident(r, { st: ["retraite"], age: [78, 92], rev: [1000, 1700], logement: "proprio", livret: [8000, 22000] }), g = B.G(I), rev = I.revenus;
    I.situation = I.f ? "Veuve, vit seule" : "Veuf, vit seul";
    var w = r.pick([50, 60, 80, 100].filter(function (x) { return 4 * x <= 0.3 * rev; })), B0 = r.pas(20, 30, 5) * 100, ret = [B0, B0 + 500, B0 + 1000, B0 + 1500], T = B.somme(ret), j0 = r.n(2, 4), jr = [j0, j0 + 7, j0 + 14, j0 + 21];
    var tiers = B.personne(r, null, 45), q = r.pick(["aide à domicile", "voisin de palier", "nouvel ami"]), tf = tiers.f;
    var qualite = q === "aide à domicile" ? "se présente comme son aide à domicile" : q === "voisin de palier" ? "se présente comme " + (tf ? "sa voisine" : "son voisin") + " de palier" : "se présente comme " + (tf ? "une amie récente" : "un ami récent");
    var obs = [q === "aide à domicile" ? "Vit seul" + (I.f ? "e" : "") + ". Une aide à domicile intervient chez " + (I.f ? "elle" : "lui") + " depuis " + B.mots(r.n(4, 14)) + " mois." : q === "voisin de palier" ? "Vit seul" + (I.f ? "e" : "") + ". " + (tf ? "Une voisine" : "Un voisin") + " de palier, " + B.nomComplet(tiers) + ", passe presque tous les jours." : "Vit seul" + (I.f ? "e" : "") + ". " + (tf ? "Une nouvelle amie" : "Un nouvel ami") + ", " + B.nomComplet(tiers) + ", rencontré" + (tf ? "e" : "") + " il y a quelques mois, l'accompagne souvent.", "Retraits récents effectués au guichet, " + (I.f ? "la cliente" : "le client") + " étant accompagné" + (I.f ? "e" : "") + "."];
    var ops = ret.map(function (m, ix) {
      var exp = ix === 0 ? "Atypique : " + B.foisDe(m, w) + " le retrait hebdomadaire habituel de " + eur(w) + "." : ix === 3 ? "Atypique : " + eur(T) + " retirés en quatre semaines, soit " + B.dureeDe(T, rev, "pension") + "." : "Atypique : retrait répété, montant en hausse.";
      return opRet("r" + (ix + 1), "Retrait d'espèces au guichet", ["Première semaine du mois", "Deuxième semaine", "Troisième semaine", "Quatrième semaine"][ix], m, jr[ix], exp);
    });
    ops.push({ k: "hab", type: "retrait_especes", libelle: "Retraits hebdomadaires au distributeur (4 retraits)", detail: "Retraits habituels de " + eur(w) + " chaque semaine", montant: 4 * w, mois: 1, jour: 28, atypique: false, explication: "Habituelle : quatre retraits hebdomadaires de " + eur(w) + " (" + eur(4 * w) + " dans le mois)." });
    var m3 = {}; [3, 2, 1].forEach(function (mo) { m3[mo] = [w, w, w, w]; });
    var spec = {
      objectif: "Quatre retraits d'espèces élevés sur le compte " + (I.f ? "d'une cliente âgée et isolée" : "d'un client âgé et isolé") + ", au profit d'un tiers : aucune justification.",
      ops: ops, sansRetrait: true, retraitExtra: 4 * w, observations: obs,
      pieces: { attendues: ["explication"], acceptables: ["releves_autre_banque", "factures"] },
      contact: B.contactDe(r, "telephone", ["C'est " + B.nomComplet(tiers) + ", qui " + qualite + ", qui décroche et répond le plus souvent à la place de " + g.nomC + ".", g.nomC + " confirme à voix basse qu'" + g.il + " « aide cette personne » mais ne sait pas dire à quoi servent les sommes ni pourquoi elles sont si élevées."],
        ["Aucune pièce : ni facture, ni contrat, ni procuration"],
        "Aucun justificatif, une explication confuse, et un tiers sans lien familial qui semble bénéficier des fonds.",
        [{ rubrique: "Bénéficiaire probable des fonds", texte: "Tiers sans lien familial (" + (q === "aide à domicile" ? "aide à domicile" : q === "voisin de palier" ? (tf ? "voisine de palier" : "voisin de palier") : (tf ? "amie récente" : "ami récent")) + ")." }, { rubrique: "Situation personnelle", texte: (I.f ? "Cliente isolée, très âgée, accompagnée" : "Client isolé, très âgé, accompagné") + " lors des retraits." }]),
      issue: "declaration",
      explication: eur(T) + " retirés en quatre semaines par " + (I.f ? "une cliente" : "un client") + " de " + I.age + " ans qui retire d'habitude " + eur(w) + " par semaine, sans motif connu, avec un tiers qui répond à sa place et semble profiter des fonds. Aucune pièce ne justifie ces retraits : le doute n'est pas levé et le conseiller signale le dossier à la cellule TRACFIN de l'établissement.",
      retenir: ["Des retraits d'espèces répétés, très supérieurs aux habitudes, sans motif connu, sont un signal d'alerte, surtout pour une personne âgée et isolée.", "Un tiers sans lien familial qui répond à la place du client est un indice d'abus de faiblesse.", RET_FIN],
      argumentaire: ["Rapprocher les " + eur(T) + " retirés de la pension de " + eur(rev) + " et des retraits habituels (" + eur(w) + " par semaine)", "Relever la hausse régulière des montants et l'âge " + (I.f ? "de la cliente" : "du client") + " (" + I.age + " ans)", "Constater l'absence de justificatif et le rôle du tiers", concl(g)],
      plan: { agreges: { hab: { jours: [7, 14, 21, 28], lib: "Retrait au distributeur", m: m3 } } }
    };
    return B.particulier(r, I, spec);
  };

  /* ---------- 3. Chèques de plusieurs particuliers : activité non déclarée ---------- */
  F.cheques_tiers = function (r) {
    var I = B.ident(r, { st: ["chomage", "etudiant", "retraite"], age: [21, 66], rev: [650, 1600] }), g = B.G(I), rev = I.revenus, n = 4, X = [], i, payeurs = [], act;
    if (I.st === "etudiant") act = { txt: "des cours particuliers et du soutien scolaire", att: "factures", rec: "Aucun contrat, aucune facture, aucun reçu de cours", pro: "Cours particuliers donnés sans déclaration" };
    else act = r.pick([{ txt: "des petits travaux de rénovation chez des particuliers", att: "factures", rec: "Aucun devis, aucune facture, aucun document de chantier", pro: "Petits travaux de rénovation exercés sans déclaration" },
      { txt: "l'achat et la revente de voitures d'occasion à des particuliers", att: "cession_vehicule", rec: "Aucun certificat de cession, aucune facture, aucun document de vente", pro: "Activité de vente de véhicules d'occasion exercée sans déclaration" }]);
    for (i = 0; i < n; i++) { X.push(r.pas(1500, 2400, 50)); payeurs.push(B.personne(r, null, 40)); }
    var T = B.somme(X), j0 = r.n(2, 6), sit = I.st === "chomage" ? (I.f ? "une demandeuse d'emploi" : "un demandeur d'emploi") : I.st === "etudiant" ? (I.f ? "une étudiante" : "un étudiant") : (I.f ? "une retraitée" : "un retraité");
    var ops = X.map(function (m, ix) {
      var exp = ix === 0 ? "Atypique : " + g.cl + " ne recevait jamais de chèque ; tireur sans lien connu." : ix === 1 ? "Atypique : tireur différent, même profil d'opération." : ix === 2 ? "Atypique : troisième tireur différent." : "Atypique : " + eur(T) + " de chèques de quatre particuliers en un mois pour " + sit + ".";
      return opChq("c" + (ix + 1), "Chèque de " + B.nomComplet(payeurs[ix]), ix === 0 ? "Particulier" : "Autre particulier", m, j0 + 7 * ix, exp);
    });
    var spec = {
      objectif: "Quatre chèques de particuliers différents sur le compte " + (I.st === "chomage" ? (I.f ? "d'une demandeuse d'emploi" : "d'un demandeur d'emploi") : I.st === "etudiant" ? (I.f ? "d'une étudiante" : "d'un étudiant") : (I.f ? "d'une retraitée" : "d'un retraité")) + " : une activité non déclarée, aucune facture.",
      ops: ops,
      pieces: { attendues: [act.att], acceptables: act.att === "cession_vehicule" ? ["factures", "avis_impo", "explication"] : ["avis_impo", "explication"] },
      contact: B.contactDe(r, null, [g.nomC + " reconnaît qu'" + g.il + " « dépanne » en proposant " + act.txt + ". Les chèques sont des paiements de clients.", g.Il + " n'a ni statut d'entrepreneur, ni facture, ni document à présenter, et affirme que « ça se passe entre particuliers, sans papiers »."],
        [act.rec], "Une activité exercée à titre habituel et non déclarée, sans aucun justificatif.",
        [{ rubrique: "Situation professionnelle", texte: act.pro + ", en plus de " + I.revPos.replace(/^s[ao]n? /, "l'").replace("l'aide familiale", "l'aide familiale") + "." }, { rubrique: "Revenus", texte: "Revenus de cette activité non déclarés et non justifiés." }]),
      issue: "declaration",
      explication: "Quatre chèques de quatre particuliers différents (" + eur(T) + ") sur le compte " + (I.st === "chomage" ? (I.f ? "d'une demandeuse d'emploi" : "d'un demandeur d'emploi") : I.st === "etudiant" ? (I.f ? "d'une étudiante" : "d'un étudiant") : (I.f ? "d'une retraitée" : "d'un retraité")) + " qui reconnaît une activité non déclarée et ne peut produire aucun document. Les flux ne correspondent pas à la situation déclarée et ne sont pas justifiés : le conseiller signale le dossier à la cellule TRACFIN de l'établissement.",
      retenir: ["Des chèques de tiers multiples, sans rapport avec la situation du client, appellent un examen renforcé.", "Une activité professionnelle non déclarée est incohérente avec le profil et sans justification possible.", "Si le doute n'est pas levé, la déclaration est faite sans délai et reste confidentielle."],
      argumentaire: ["Rapprocher les " + eur(T) + " de chèques de la situation " + (I.st === "chomage" ? "de demandeur d'emploi" : I.st === "etudiant" ? "d'étudiant" : "de retraité") + " (" + eur(rev) + " par mois)", "Relever la multiplicité des tireurs, sans lien connu avec " + (I.f ? "la cliente" : "le client"), "Citer l'aveu d'une activité non déclarée et l'absence de toute pièce", concl(g)]
    };
    return B.particulier(r, I, spec);
  };

  /* ---------- 4. Vente alléguée : la facture ne correspond ni aux montants ni aux dates ---------- */
  F.facture_incoherente = function (r) {
    var I = B.ident(r, { st: ["salarie"], age: [28, 55], rev: [1500, 2400] }), g = B.G(I), rev = I.revenus;
    var bien = r.pick([["bijoux de famille", "les bijoux de sa grand-mère", "de bijoux"], ["tableaux de famille", "des tableaux hérités de ses parents", "de tableaux"], ["ma collection de montres", "sa collection de montres", "de montres"], ["l'argenterie de famille", "l'argenterie de sa grand-mère", "d'argenterie"]]);
    var D = r.pas(40, 80, 5) * 100, T = 2 * D, F2 = arrondi(T * r.pas(65, 85, 5) / 100, 500), sem = r.pick(["deux", "trois"]), j1 = r.n(5, 20);
    if (F2 >= T) F2 = T - 500;
    var spec = {
      objectif: "Deux dépôts de " + eur(D) + " en espèces pour la vente alléguée de « " + bien[0].replace(/^ma /, "ma ") + " » : la facture fournie ne correspond ni aux montants ni aux dates.",
      ops: [opDep("d1", "Dépôt d'espèces en agence", "Premier dépôt", D, j1, "Atypique : somme égale à " + B.dureeDe(D, rev, I.revNom) + ", première opération en espèces du dossier."), opDep("d2", "Dépôt d'espèces en agence", "Lendemain, même montant", D, j1 + 1, "Atypique : même montant le lendemain ; les deux dépôts totalisent " + eur(T) + (T > 10000 ? ", au-delà du seuil de " + eur(10000) + " du mois." : ", sous le seuil de " + eur(10000) + " du mois."))],
      observations: ["Au guichet, " + (I.f ? "la cliente" : "le client") + " a dit déposer « le produit de la vente de " + bien[0] + " »."],
      pieces: { attendues: ["vente_bien"], acceptables: ["explication"] },
      contact: B.contactDe(r, null, [g.nomC + " dit avoir vendu " + bien[1] + " à un acheteur rencontré par une annonce, payé en espèces.", g.Il + " envoie une facture de " + eur(F2) + ", sans nom d'acheteur ni description des objets vendus."],
        ["Facture de " + eur(F2) + ", établie " + sem + " semaines après les dépôts, sans acheteur identifié ni description des objets vendus"],
        "La facture ne correspond ni au montant déposé (" + eur(T) + ") ni aux dates (postérieure aux dépôts) et n'identifie aucun acheteur : elle ne justifie rien.",
        [{ rubrique: "Origine des fonds", texte: "Vente alléguée " + bien[2] + ". Facture de " + eur(F2) + " établie " + sem + " semaines après les dépôts, qui totalisent " + eur(T) + "." }]),
      issue: "declaration",
      explication: (I.f ? "La cliente" : "Le client") + " produit une facture qui ne correspond ni aux montants (" + eur(F2) + " contre " + eur(T) + " déposés), ni aux dates (postérieure aux dépôts), sans acheteur identifié. Une pièce incohérente ne lève pas le doute : le conseiller signale le dossier à la cellule TRACFIN de l'établissement.",
      retenir: ["Vérifier la concordance des pièces avec l'opération : montant, date, identité de la contrepartie.", "Une pièce qui contredit l'opération ne justifie rien et peut aggraver le doute.", "Si le doute n'est pas levé après l'examen renforcé, la déclaration est obligatoire."],
      argumentaire: ["Rapprocher les " + eur(T) + " déposés du salaire de " + eur(rev) + " et de l'absence d'historique d'espèces", "Relever l'écart entre la facture (" + eur(F2) + ", date postérieure) et les dépôts", "Constater qu'aucun acheteur n'est identifié", concl(g)]
    };
    return B.particulier(r, I, spec);
  };

  /* ---------- 5. Crédit débloqué puis retiré en espèces sur un compte récent ---------- */
  F.credit_retire = function (r) {
    var I = B.ident(r, { st: ["salarie"], age: [24, 34], rev: [1400, 2000], logement: "locataire", livretNon: true }), g = B.G(I), rev = I.revenus;
    var C = r.pas(90, 150, 10) * 100, X = Math.floor(C * 0.97 / 3 / 100) * 100, T = 3 * X, variante = r.pick(["voiture", "travaux"]);
    I.produits = ["Compte courant", I.produits[1], "Crédit à la consommation"]; I.patrimoine = ["Aucun placement", "Locataire"]; I.miseAJourMois = 2;
    I.professionnel = I.profession.replace(/ \((CDI|CDD|temps partiel)\)/, "") + (/CDI/.test(I.profession) ? " en CDI" : "") + " depuis " + (I.ancPro > 1 ? B.mots(I.ancPro) + " ans." : "un an.");
    var ver = r.pas(4, 6, 1) * 100;
    
    var usage = variante === "voiture" ? { guichet: "vouloir « acheter une voiture à un particulier »", e1: " veut « acheter une voiture à un particulier ». " + g.Il + " ne peut ni nommer le vendeur, ni décrire le véhicule.", e2: g.Il + " explique que l'accord est « verbal », que le vendeur ne veut pas de papiers, et demande si tout cela est « vraiment nécessaire ».", att: "cession_vehicule", rec: "Aucune pièce : pas de promesse de vente, ni certificat de cession, ni facture", mu: "Achat allégué d'un véhicule à un particulier ; vendeur non identifié, aucune pièce.", ex: "pour un achat dont ni le vendeur ni le véhicule ne peuvent être décrits, et sans aucune pièce", app: "Aucun justificatif, un vendeur inconnu et un usage des fonds invérifiable." }
      : { guichet: "devoir « payer des travaux »", e1: " doit « payer des travaux » chez un proche. " + g.Il + " ne peut ni nommer l'entreprise, ni décrire les travaux.", e2: g.Il + " explique que l'artisan est « payé de la main à la main », qu'il n'y a « ni devis ni facture », et demande si tout cela est « vraiment nécessaire ».", att: "factures", rec: "Aucune pièce : ni devis, ni facture, ni nom d'entreprise", mu: "Travaux allégués chez un proche ; entreprise non identifiée, aucune pièce.", ex: "pour des travaux dont ni l'entreprise ni la nature ne peuvent être décrites, et sans aucun devis ni facture", app: "Aucun justificatif, une entreprise inconnue et un usage des fonds invérifiable." };
    var ops = [
      { k: "cred", type: "virement", libelle: "Déblocage du crédit à la consommation", detail: "Crédit de " + eur(C) + " accordé par GS Banque & Assurance, motif « projet personnel »", montant: C, mois: 1, jour: 3, atypique: false, sens: "credit", explication: "Habituelle : opération connue de la banque, qui a accordé le crédit. Ce qui compte, c'est l'usage qui en est fait." },
      opRet2("r1", "Le lendemain du déblocage", X, 4, "Atypique : retrait égal à " + B.dureeDe(X, rev, I.revNom) + "."),
      opRet2("r2", "Deuxième retrait, même montant", X, 5, "Atypique : même montant le jour suivant."),
      opRet2("r3", "Troisième retrait, même montant", X, 6, "Atypique : " + eur(T) + " retirés en espèces en trois jours, soit presque tout le crédit, sur un compte ouvert depuis deux mois.")];
    function opRet2(k, det, m, j, exp) { return opRet(k, "Retrait d'espèces au guichet", det, m, j, exp); }
    var spec = {
      objectif: "Un crédit débloqué puis retiré en espèces en trois jours sur un compte récent : l'usage des fonds n'est pas justifié.",
      ops: ops, sansRetrait: true, revMois: 2, ancMois: 2,
      observations: ["Au guichet, " + (I.f ? "la cliente" : "le client") + " a dit " + usage.guichet + "."],
      pieces: { attendues: [usage.att], acceptables: ["explication", "releves_autre_banque"] },
      contact: B.contactDe(r, null, [g.nomC + " répète ce qu'" + g.il + " avait dit au guichet : " + g.il + usage.e1, usage.e2],
        [usage.rec], usage.app,
        [{ rubrique: "Usage des fonds", texte: usage.mu }, { rubrique: "Ancienneté", texte: "Compte ouvert depuis deux mois ; " + eur(T) + " retirés en espèces en trois jours après le déblocage du crédit." }]),
      issue: "declaration",
      explication: "Presque tout le crédit est retiré en espèces en trois jours, sur un compte ouvert depuis deux mois, " + usage.ex + "." + cloture(g),
      retenir: ["Un crédit à la consommation suivi de retraits en espèces est un schéma à surveiller.", "Un compte récent et un usage des fonds invérifiable : l'opération ne peut pas être vérifiée.", "Le déblocage d'un crédit accordé par la banque n'est pas en soi atypique : c'est l'usage qui l'est.", RET_FIN],
      argumentaire: ["Rapprocher les " + eur(T) + " retirés du crédit (" + eur(C) + ") et de la paie de " + eur(rev), "Relever l'ancienneté de deux mois et la rapidité des retraits", "Constater l'absence de pièce et l'impossibilité d'identifier le destinataire des fonds", concl(g)],
      plan: { ouverture: { mois: 2, jour: 12, versement: ver }, repete: { cred: false }, cartesMois: { 2: [3, 80, 130, 13, 27] }, cartes: [8, 200, 300] }
    };
    var x = B.particulier(r, I, spec);
    delete x.dossier.client.ancienneteAns; x.dossier.client.ancienneteMois = 2;
    return x;
  };

  /* ---------- 6. Commerçant : remises d'espèces très supérieures aux recettes du livre ---------- */
  F.ecart_recettes = function (r) {
    var I = B.ident(r, { st: ["independant"], typ: "esp" }), p = I.p, g = B.G(I), W = r.pas(1000, 1800, 50), sem = [], i;
    for (i = 0; i < 4; i++) sem.push(Math.round(W * (0.88 + r.f() * 0.24) / 50) * 50);
    var H = B.somme(sem), maxSem = Math.max.apply(null, sem), minSem = Math.min.apply(null, sem), E1 = r.pas(60, 110, 5) * 100, E2 = r.pas(80, 130, 5) * 100, T = H + E1 + E2;
    var L = arrondi(H * r.pas(100, 160, 5) / 100, 100), ecart = T - L, chq = arrondi(I.revenus * r.pas(40, 60, 5) / 100, 50), j1 = r.n(8, 12), j2 = r.n(20, 24);
    var hist = r.pick([
      [g.nomC + " parle d'un mois d'activité exceptionnel, sans pouvoir le chiffrer. " + g.Il + " propose de montrer son livre de recettes.", "Le livre est transmis : " + g.il + " ne peut pas expliquer l'écart avec les espèces remises et finit par dire qu'" + g.il + " « verra avec son comptable »."],
      [g.nomC + " dit que les remises viennent de « ventes d'avant » qu'" + g.il + " n'avait pas encore déposées, sans pouvoir les dater ni les chiffrer.", "Le livre ne les mentionne pas : " + g.il + " propose de « régulariser plus tard » et ne peut pas expliquer l'écart."],
      [g.nomC + " affirme qu'il s'agit d'« espèces gardées de côté » sur la saison précédente.", "Le livre de recettes du mois est transmis : il ne contient aucune de ces sommes et " + g.il + " ne peut pas expliquer l'écart."]]);
    var jours = [5, 12, 19, 26], agM = {};
    [3, 2, 1].forEach(function (mo) { agM[mo] = mo === 1 ? sem : RL.repartir(r, arrondi(H * (0.9 + r.f() * 0.2), 50), 4); });
    var ops = [{ k: "rem", type: "depot_especes", libelle: "Remises d'espèces hebdomadaires (4 remises)", detail: p.remDet + ", de " + eur(minSem) + " à " + eur(maxSem) + " par semaine", montant: H, mois: 1, jour: 26, atypique: false, explication: "Habituelle : rythme et montants habituels, en rapport avec l'activité." },
      { k: "chq", type: "depot_cheque", libelle: "Remise de chèques de clients", detail: "Groupe de chèques habituels", montant: chq, mois: 1, jour: 27, atypique: false, explication: "Habituelle : remise de chèques courante pour " + p.act + "." },
      opDep("e1", "Remise d'espèces au guichet", "Remise exceptionnelle", E1, j1, "Atypique : montant égal à " + B.foisDe(E1, maxSem) + " la plus forte remise hebdomadaire habituelle (" + eur(maxSem) + ")."),
      opDep("e2", "Remise d'espèces au guichet", "Seconde remise exceptionnelle", E2, j2, "Atypique : les espèces du mois atteignent " + eur(T) + ", soit " + B.foisDe(T, H) + " le niveau habituel de " + eur(H) + ".")];
    var spec = {
      objectif: "Des remises d'espèces bien supérieures aux recettes du livre : un écart de " + eur(ecart) + " que " + (I.f ? "la commerçante" : "le commerçant") + " ne peut pas expliquer.",
      ops: ops,
      pieces: { attendues: ["recettes"], acceptables: ["avis_impo", "explication"] },
      contact: B.contactDe(r, null, hist, ["Livre de recettes du mois : " + eur(L) + " de recettes en espèces"],
        "Les recettes en espèces du livre (" + eur(L) + ") sont très inférieures aux espèces remises (" + eur(T) + ") : écart de " + eur(ecart) + " sans explication.",
        [{ rubrique: "Situation professionnelle", texte: "Recettes du mois inscrites au livre : " + eur(L) + " en espèces. Remises d'espèces dans le mois : " + eur(T) + "." }, { rubrique: "Fonctionnement du compte", texte: "Remises exceptionnelles de " + eur(E1) + " et " + eur(E2) + " en plus des remises hebdomadaires." }]),
      issue: "declaration",
      explication: "Le livre de recettes ne couvre pas les remises : " + eur(L) + " de recettes en espèces pour " + eur(T) + " d'espèces déposées, soit un écart de " + eur(ecart) + " que " + (I.f ? "la cliente" : "le client") + " ne peut pas expliquer. Des dépôts d'espèces non justifiés par le niveau d'activité sont un indicateur de soupçon : le conseiller signale le dossier à la cellule TRACFIN de l'établissement.",
      retenir: ["Un livre de recettes justifie des espèces seulement s'il couvre les montants déposés.", "Comparer toujours les justificatifs aux montants : ici l'écart est de " + eur(ecart) + ".", RET_FIN],
      argumentaire: ["Rapprocher les " + eur(T) + " d'espèces des remises habituelles (" + eur(H) + " environ)", "Comparer les recettes en espèces du livre (" + eur(L) + ") aux espèces remises et calculer l'écart (" + eur(ecart) + ")", "Relever que " + (I.f ? "la cliente" : "le client") + " ne peut pas expliquer l'écart", concl(g)]
    };
    var credits = [3, 2, 1].map(function (mo) { return B.somme(agM[mo]) + chq; });
    spec.plan = B.planIndependant(r, I, { cmin: Math.min.apply(null, credits), extra: { agreges: { rem: { jours: jours, lib: p.rem, m: agM } }, variantes: { chq: { 3: arrondi(chq * 0.92, 50), 2: arrondi(chq * 1.06, 50) } } } });
    return B.assembler(r, I, spec);
  };

  /* ---------- 7. Compte de passage : dépôts retirés presque à l'identique le lendemain ---------- */
  F.compte_passage = function (r) {
    var I = B.ident(r, { st: ["salarie", "cdd"], age: [25, 58], rev: [1000, 1900] }), g = B.G(I), rev = I.revenus;
    var n = r.n(2, 3), X = r.pas(20, 45, 5) * 100, c = r.pick([50, 100]), d0 = r.n(3, 6), lien = r.pick(["un cousin", "un ami", "un ancien collègue", "un voisin"]), prenom = Q.prenomPour(r, false, 35);
    var ops = [], i, Td = n * X, Tr = n * (X - c);
    for (i = 0; i < n; i++) {
      var jd = d0 + 9 * i;
      ops.push(opDep("d" + (i + 1), "Dépôt d'espèces en agence", i === 0 ? "Premier dépôt" : "Dépôt n° " + (i + 1) + ", neuf jours plus tard", X, jd, i === 0 ? "Atypique : somme égale à " + B.dureeDe(X, rev, I.revNom) + ", première opération en espèces du dossier." : "Atypique : même montant exact."));
      ops.push(opRet("t" + (i + 1), "Retrait d'espèces au guichet", "Le lendemain du dépôt", X - c, jd + 1, i === n - 1 ? "Atypique : même schéma, soit " + eur(Td) + " déposés et " + eur(Tr) + " retirés en " + B.mots(jd + 1 - d0 + 1) + " jours." : "Atypique : retrait presque égal au dépôt, moins de 24 heures plus tard."));
    }
    var spec = {
      objectif: "Des dépôts d'espèces suivis de retraits presque identiques le lendemain : un compte de passage pour un tiers, contre rémunération.",
      ops: ops,
      pieces: { attendues: ["explication"], acceptables: ["releves_autre_banque"] },
      contact: B.contactDe(r, null, [g.nomC + " explique qu'" + g.il + " « rend service à " + lien + " » qui n'a pas de compte : il lui remet des espèces, qu'" + g.il + " dépose, puis " + g.il + " les retire le lendemain pour les lui rendre.", g.Il + " garde " + eur(c) + " à chaque fois. " + g.Il + " ne donne que son prénom (" + prenom + "), ne sait pas d'où viennent les espèces et ne fournit aucun document."],
        ["Aucune pièce"], "Le compte sert d'intermédiaire à un tiers non identifié, contre rémunération, sans justification de l'origine des fonds.",
        [{ rubrique: "Utilisation du compte", texte: "Les espèces déposées sont remises par un tiers (" + lien + " « " + prenom + " ») puis reprises par lui le lendemain, contre " + eur(c) + " par opération." }, { rubrique: "Origine des fonds", texte: "Inconnue ; le tiers n'est connu que par son prénom." }]),
      issue: "declaration",
      explication: "Les dépôts d'espèces sont retirés presque à l'identique dès le lendemain : le compte sert de compte de passage pour un tiers, contre rémunération, sans que l'origine des fonds ni le bénéficiaire ne soient connus. Cela n'a aucun rapport avec la situation " + (I.f ? "de la cliente" : "du client") + " : le conseiller signale le dossier à la cellule TRACFIN de l'établissement.",
      retenir: ["Un dépôt suivi d'un retrait presque identique dans les 24 heures est un schéma de compte de passage.", "Le bénéficiaire effectif d'une opération doit être identifié.", "Rendre service à un tiers avec son compte ne justifie pas l'opération : la déclaration reste obligatoire."],
      argumentaire: ["Rapprocher les " + eur(Td) + " déposés du salaire de " + eur(rev) + " et des habitudes " + (I.f ? "de la cliente" : "du client"), "Relever les retraits presque identiques aux dépôts, le lendemain", "Citer l'explication (service rendu à " + lien + ", " + eur(c) + " de commission) et l'absence de pièce", concl(g)]
    };
    return B.particulier(r, I, spec);
  };

  /* ---------- 8. Chèque d'une société pour une « commission » sans contrat ni facture ---------- */
  F.commission_fictive = function (r) {
    var I = B.ident(r, { st: ["retraite", "chomage"], age: [32, 78], rev: [1000, 2100] }), g = B.G(I), rev = I.revenus, A = r.pas(24, 60, 2) * 500, soc = r.pick(SOCIETES);
    var hist = r.pick([
      { lib: "commission", obj: "une « commission »", e1: " dit avoir « rendu service » en mettant en relation deux entreprises, et que la société l'a remercié par une commission.", e2: " n'a signé aucun contrat, n'a pas établi de facture, ne connaît pas le gérant de la société et ne sait pas dire comment il a été contacté.", mu: "commission alléguée pour une mise en relation", ex: "une « commission »" },
      { lib: "honoraires", obj: "des « honoraires »", e1: " dit avoir fait du « conseil » pour la société pendant ses loisirs.", e2: " n'a ni lettre de mission, ni facture, ne peut pas décrire la mission et ne connaît aucun salarié de la société.", mu: "honoraires de « conseil » allégués", ex: "des « honoraires de conseil »" },
      { lib: "gardiennage", obj: "un « gardiennage de marchandises »", e1: " dit que la société lui paie le « gardiennage de marchandises » dans son garage.", e2: " n'a ni contrat, ni facture, ne peut pas décrire les marchandises et ne connaît aucun salarié de la société.", mu: "gardiennage de marchandises allégué", ex: "un « gardiennage de marchandises »" }]);
    var spec = {
      objectif: "Un chèque de " + eur(A) + " d'une société sur le compte " + (I.st === "retraite" ? (I.f ? "d'une retraitée" : "d'un retraité") : (I.f ? "d'une demandeuse d'emploi" : "d'un demandeur d'emploi")) + " : " + hist.obj + " sans contrat ni facture.",
      ops: [opChq("chq", "Chèque de " + soc, "Libellé : « " + hist.lib + " »", A, r.n(8, 24), "Atypique : somme égale à " + B.dureeDe(A, rev, I.revNom) + ", versée par une société sans lien connu avec " + g.cl + ".")],
      pieces: { attendues: ["factures"], acceptables: ["explication"] },
      contact: B.contactDe(r, null, [g.nomC + hist.e1, g.Il + hist.e2], ["Aucun contrat, aucune facture, aucun échange écrit"],
        "Une rémunération importante, sans prestation identifiable ni document, venant d'une société sans lien connu avec " + g.cl + ".",
        [{ rubrique: "Situation professionnelle", texte: "Aucune activité déclarée ; " + hist.mu + ", sans contrat ni facture." }, { rubrique: "Origine des fonds", texte: "Aucun document fourni." }]),
      issue: "declaration",
      explication: "Un" + (I.f ? "e" : "") + " " + (I.st === "retraite" ? (I.f ? "retraitée" : "retraité") : (I.f ? "demandeuse d'emploi" : "demandeur d'emploi")) + " sans activité déclarée reçoit " + eur(A) + " d'une société qu'" + g.il + " ne connaît pas, pour " + hist.ex + " sans contrat, sans facture et sans prestation décrite. L'opération n'a pas de justification économique apparente : le doute n'est pas levé et le conseiller signale le dossier à la cellule TRACFIN de l'établissement.",
      retenir: ["Une opération sans justification économique apparente relève de l'examen renforcé.", "Une prestation se justifie par un contrat, un devis ou une facture, ce que " + g.cl + " n'a pas.", "Le client n'est jamais informé de la déclaration (art. L561-18)."],
      argumentaire: ["Rapprocher les " + eur(A) + " de " + I.revPos + " de " + eur(rev) + " et de l'absence d'activité déclarée", "Relever que la société n'a aucun lien connu avec " + g.cl, "Constater l'absence de contrat, de facture et de prestation décrite", concl(g)]
    };
    return B.particulier(r, I, spec);
  };

  /* ---------- 9. Dépôts identiques le même jour dans plusieurs agences, client injoignable ---------- */
  F.multi_agences = function (r) {
    var I = B.ident(r, { st: ["salarie", "cdd"], age: [24, 52], rev: [1400, 2100] }), g = B.G(I), rev = I.revenus, X = r.pas(26, 33, 1) * 100, T = 3 * X, jj = r.n(5, 22);
    var ag = r.melange(AGENCES).slice(0, 3);
    var ops = ag.map(function (a, ix) {
      var exp = ix === 0 ? "Atypique : somme égale à " + B.dureeDe(X, rev, I.revNom) + ", première opération en espèces du dossier." : ix === 1 ? "Atypique : même montant, dans une autre agence, le même jour." : "Atypique : trois dépôts identiques dans trois agences, " + eur(T) + " au total, sous le seuil de " + eur(10000) + " d'espèces du mois.";
      return opDep("d" + (ix + 1), "Dépôt d'espèces, agence de " + a, "Le même jour, " + ORD[ix].toLowerCase() + " dépôt", X, jj, exp);
    });
    var spec = {
      objectif: "Trois dépôts de " + eur(X) + " le même jour dans trois agences, et " + (I.f ? "une cliente injoignable" : "un client injoignable") + " : le doute ne peut pas être levé.",
      ops: ops,
      pieces: { attendues: ["explication"], acceptables: ["avis_impo", "bulletins"] },
      contact: B.contactDe(r, "courrier", ["Trois appels sur le mobile et le fixe, restés sans réponse, puis un courrier à l'adresse du dossier et un e-mail : aucune réponse au bout de dix jours.", (I.f ? "La cliente" : "Le client") + " n'a pas non plus répondu à une convocation en agence."],
        ["Aucune réponse " + (I.f ? "de la cliente" : "du client") + ", aucune pièce"],
        (I.f ? "La cliente" : "Le client") + " n'explique rien et ne justifie rien. L'absence de réponse seule ne suffit pas à déclarer, mais elle s'ajoute à d'autres indices : trois dépôts identiques dans trois agences le même jour, sous le seuil de " + eur(10000) + ".",
        [{ rubrique: "Contact client", texte: (I.f ? "Cliente injoignable" : "Client injoignable") + " : 3 appels, 1 courrier, 1 e-mail et 1 convocation sans réponse en dix jours." }, { rubrique: "Origine des fonds", texte: "Inconnue ; aucune justification." }]),
      issue: "declaration",
      explication: "Trois dépôts identiques de " + eur(X) + " le même jour dans trois agences (" + eur(T) + ", sous le seuil de " + eur(10000) + ") ne correspondent ni à " + I.revPos + " (" + eur(rev) + " par mois) ni aux habitudes " + (I.f ? "de la cliente" : "du client") + ", et " + g.il + " reste injoignable. L'absence de réponse ne suffit pas à elle seule à déclarer, mais combinée au fractionnement entre agences et à l'absence de toute justification elle ne permet pas de lever le doute : le conseiller signale le dossier à la cellule TRACFIN de l'établissement.",
      retenir: ["Un client qui ne répond pas ne justifie rien : le doute n'est pas levé.", "L'absence de réponse seule ne suffit pas à déclarer ; ici elle s'ajoute au fractionnement dans trois agences le même jour.", "Les démarches de contact (appels, courrier, convocation) sont tracées dans le dossier."],
      argumentaire: ["Rapprocher les " + eur(T) + " déposés " + B.duRev(I) + " (" + eur(rev) + " par mois) et des habitudes " + (I.f ? "de la cliente" : "du client"), "Relever les trois dépôts identiques dans trois agences le même jour, sous le seuil de " + eur(10000), "Décrire les démarches de contact et l'absence de réponse", concl(g)]
    };
    return B.particulier(r, I, spec);
  };

  /* ---------- 10. Gros dépôt d'espèces d'un jeune, justifié par une simple attestation du parent ---------- */
  F.attestation_seule = function (r) {
    var I = B.ident(r, { st: ["etudiant", "alternance", "cdd"], age: [19, 27], rev: [450, 1300], livret: [200, 900] }), g = B.G(I), rev = I.revenus, E = r.pas(21, 40, 1) * 500, parent = r.chance(0.5) ? "père" : "mère";
    var proj = r.pick([["acheter un petit studio", "Achat d'un studio évoqué, sans compromis ni projet précis."], ["acheter une voiture", "Achat d'une voiture évoqué, sans devis ni projet précis."], ["financer ses études à l'étranger", "Études à l'étranger évoquées, sans inscription ni budget précis."]]);
    var spec = {
      objectif: "Un dépôt de " + eur(E) + " en espèces par " + (I.f ? "une jeune cliente" : "un jeune client") + ", justifié par une simple attestation " + (parent === "père" ? "du père" : "de la mère") + " : sans élément corroborant, elle ne suffit pas.",
      ops: [opDep("d1", "Dépôt d'espèces en agence", "Dépôt unique de " + eur(E), E, r.n(6, 22), "Atypique : somme égale à " + B.dureeDe(E, rev, I.revNom) + ", première opération en espèces du dossier.")],
      observations: ["Au guichet, " + (I.f ? "la cliente" : "le client") + " a dit que l'argent venait de " + (parent === "père" ? "son père" : "sa mère") + "."],
      pieces: { attendues: ["acte_donation"], acceptables: ["releves_autre_banque", "explication"] },
      contact: B.contactDe(r, null, [g.nomC + " explique que " + (parent === "père" ? "son père" : "sa mère") + " lui a remis les espèces « pour l'aider à " + proj[0] + " ». " + g.Il + " ne sait pas d'où viennent ces espèces.", g.Il + " transmet une attestation sur l'honneur signée " + (parent === "père" ? "de son père" : "de sa mère") + " et une copie de sa pièce d'identité, et rien d'autre."],
        ["Attestation sur l'honneur " + (parent === "père" ? "du père" : "de la mère") + " (une page) et copie de sa pièce d'identité"],
        "Aucun acte de donation, aucun relevé " + (parent === "père" ? "du père" : "de la mère") + " : l'attestation sur l'honneur n'est corroborée par aucun élément. L'origine des espèces détenues par " + (parent === "père" ? "le père" : "la mère") + " n'est pas établie.",
        [{ rubrique: "Origine des fonds", texte: "Don allégué " + (parent === "père" ? "du père" : "de la mère") + " (" + eur(E) + "), attesté par " + (parent === "père" ? "le père seul" : "la mère seule") + " ; aucun acte ni relevé. " + (parent === "père" ? "Père" : "Mère") + " non cliente de l'établissement.".replace("non cliente", parent === "père" ? "non client" : "non cliente") }, { rubrique: "Projet", texte: proj[1] }]),
      issue: "declaration",
      explication: "Une simple attestation sur l'honneur, sans acte de donation ni relevé bancaire " + (parent === "père" ? "du père" : "de la mère") + ", ne justifie pas " + eur(E) + " d'espèces déposés par " + (I.st === "etudiant" ? (I.f ? "une étudiante" : "un étudiant") : (I.f ? "une jeune cliente" : "un jeune client")) + " dont les revenus sont de " + eur(rev) + " par mois. L'origine des fonds reste inconnue et aucun élément ne corrobore le don : le conseiller signale le dossier à la cellule TRACFIN de l'établissement.",
      retenir: ["Une attestation sur l'honneur seule, sans élément corroborant, n'est pas un justificatif probant.", "Un don de cette importance se prouve par un acte de donation ou une déclaration de don manuel, pas par une simple attestation.", RET_FIN],
      argumentaire: ["Rapprocher les " + eur(E) + " des revenus de " + eur(rev) + " et de l'absence d'historique d'espèces", "Constater qu'aucun acte de donation ni relevé n'est fourni : l'attestation sur l'honneur est seule", "Relever que l'origine des espèces détenues par " + (parent === "père" ? "le père" : "la mère") + " n'est pas établie", concl(g)]
    };
    return B.particulier(r, I, spec);
  };

  /* ---------- 11. Virements reçus de l'étranger puis renvoyés presque intégralement ---------- */
  F.virements_etranger = function (r) {
    var I = B.ident(r, { st: ["salarie", "cdd", "chomage"], age: [26, 55], rev: [1200, 2200] }), g = B.G(I), rev = I.revenus, n = 3, X = [], pay = [], i, villes = r.melange(VILLES_ETR);
    for (i = 0; i < n; i++) { X.push(r.pas(20, 48, 1) * 100); pay.push(B.personne(r, null, 40)); }
    var pre = r.pick([{ e: "fait de l'achat-revente de téléphones avec des fournisseurs à l'étranger", m: "Achat-revente de téléphones allégué et non déclaré" }, { e: "fait des « prestations de traduction » pour des clients à l'étranger", m: "Prestations de traduction alléguées et non déclarées" }, { e: "vend des vêtements en ligne à des clients à l'étranger", m: "Vente de vêtements en ligne alléguée et non déclarée" }]);
    var Tin = B.somme(X), out = arrondi(Tin * r.pas(88, 95, 1) / 100, 100), pct = Math.round(out / Tin * 100), dest = B.personne(r, null, 40), j0 = r.n(3, 8), jr = [j0], jOut;
    for (i = 1; i < n; i++) jr.push(jr[i - 1] + r.n(3, 5));
    jOut = jr[n - 1] + r.n(1, 3);
    var ops = X.map(function (m, ix) {
      var exp = ix === 0 ? "Atypique : somme égale à " + B.dureeDe(m, rev, I.revNom) + ", venant d'un donneur d'ordre étranger inconnu du dossier." : ix === 1 ? "Atypique : autre donneur d'ordre, autre pays, même profil." : "Atypique : troisième donneur d'ordre étranger, " + eur(Tin) + " reçus en " + B.mots(jr[n - 1] - jr[0] + 1) + " jours.";
      return opVir("v" + (ix + 1), "Virement international reçu de " + B.nomComplet(pay[ix]) + " (" + villes[ix] + ")", "Donneur d'ordre à l'étranger", m, jr[ix], "credit", exp);
    });
    ops.push(opVir("out", "Virement international émis vers " + B.nomComplet(dest) + " (" + villes[3] + ")", "Bénéficiaire à l'étranger", out, jOut, "debit", "Atypique : " + eur(out) + " renvoyés vers l'étranger " + B.mots(jOut - jr[n - 1]) + (jOut - jr[n - 1] > 1 ? " jours" : " jour") + " après la dernière réception, soit " + pct + " % des sommes reçues."));
    var spec = {
      objectif: "Trois virements reçus de l'étranger puis renvoyés presque intégralement vers un autre pays : un compte relais, sans contrat ni facture.",
      ops: ops,
      pieces: { attendues: ["factures"], acceptables: ["avis_impo", "explication"] },
      contact: B.contactDe(r, null, [g.nomC + " explique qu'" + g.il + " " + pre.e + " et qu'" + g.il + " reverse une partie des sommes à un « associé » rencontré sur internet.", g.Il + " n'a ni contrat, ni facture, ni statut d'entrepreneur, et dit que « tout se fait par messagerie »."],
        ["Aucun contrat, aucune facture, aucun statut d'entrepreneur"],
        "Des fonds reçus de trois donneurs d'ordre étrangers puis renvoyés presque intégralement vers l'étranger, sans prestation identifiable : le compte sert de relais.",
        [{ rubrique: "Situation professionnelle", texte: pre.m + ", sans contrat ni facture." }, { rubrique: "Utilisation du compte", texte: "Fonds reçus de l'étranger (" + eur(Tin) + ") puis renvoyés (" + eur(out) + ") vers un tiers à l'étranger." }]),
      issue: "declaration",
      explication: eur(Tin) + " reçus de trois donneurs d'ordre étrangers en quelques jours, puis " + eur(out) + " renvoyés vers un autre pays : le compte sert de relais, sans prestation identifiable ni aucun justificatif, pour " + (I.f ? "une cliente" : "un client") + " dont " + B.leRevEst(I) + " de " + eur(rev) + " par mois. Le doute n'est pas levé : le conseiller signale le dossier à la cellule TRACFIN de l'établissement.",
      retenir: ["Des virements entrants de l'étranger puis renvoyés presque intégralement sont un schéma de compte relais.", "Une activité alléguée sans contrat, sans facture et sans statut n'explique rien.", RET_FIN],
      argumentaire: ["Rapprocher les " + eur(Tin) + " reçus " + B.duRev(I) + " (" + eur(rev) + " par mois) et de l'absence d'activité déclarée", "Relever les " + eur(out) + " renvoyés vers l'étranger peu après, soit " + pct + " % des sommes reçues", "Constater l'absence de contrat, de facture et de statut d'entrepreneur", concl(g)]
    };
    return B.particulier(r, I, spec);
  };

  /* ---------- 12. Virements de particuliers puis retraits d'espèces au guichet ---------- */
  F.virements_particuliers = function (r) {
    var I = B.ident(r, { st: ["etudiant", "alternance", "cdd", "salarie"], age: [19, 30], rev: [600, 1500] }), g = B.G(I), rev = I.revenus, n = 4, X = [], pay = [], i;
    for (i = 0; i < n; i++) { X.push(r.pas(6, 14, 1) * 100); if (X[i] === rev) X[i] += 50; pay.push(B.personne(r, null, 25)); }
    var Tin = B.somme(X), r1 = arrondi(Tin * 0.5, 100), r2 = arrondi(Tin * 0.45, 100), R = r1 + r2, j0 = r.n(3, 10), jv = [j0, j0 + 1, j0 + 2, j0 + 3], hist = r.pick([["revente de baskets", "d'une revente de baskets de collection"], ["paris sportifs", "de paris sportifs entre amis"], ["revente de places de concert", "d'une revente de places de concert"]]);
    var ops = X.map(function (m, ix) {
      var exp = ix === 0 ? "Atypique : " + g.cl + " ne reçoit habituellement que " + I.revPos + " ; virement d'un particulier sans lien connu." : ix === 1 ? "Atypique : autre particulier, même profil." : ix === 2 ? "Atypique : troisième particulier différent." : "Atypique : quatre virements de quatre particuliers différents, " + eur(Tin) + " en quatre jours.";
      return opVir("v" + (ix + 1), "Virement reçu de " + B.nomComplet(pay[ix]), "Particulier", m, jv[ix], "credit", exp);
    });
    ops.push(opRet("r1", "Retrait d'espèces au guichet", "Le lendemain du dernier virement", r1, j0 + 4, "Atypique : retrait de la moitié des sommes reçues, au guichet."));
    ops.push(opRet("r2", "Retrait d'espèces au guichet", "Le surlendemain", r2, j0 + 5, "Atypique : " + eur(R) + " retirés en espèces sur " + eur(Tin) + " reçus en six jours."));
    var spec = {
      objectif: "Quatre virements de particuliers puis des retraits d'espèces au guichet : le compte sert à encaisser et à sortir de l'argent pour des inconnus.",
      ops: ops,
      pieces: { attendues: ["explication"], acceptables: ["releves_autre_banque", "factures"] },
      contact: B.contactDe(r, null, [g.nomC + " explique qu'" + g.il + " « aide des amis » à encaisser des paiements issus " + hist[1] + ". " + g.Il + " ne connaît pas vraiment les payeurs.", g.Il + " ne peut produire ni échange, ni facture, ni justificatif, et dit qu'" + g.il + " garde « une petite part » sur les retraits."],
        ["Aucune pièce : ni échange écrit, ni facture, ni justificatif"],
        "Des virements de particuliers inconnus aussitôt retirés en espèces, sans aucun justificatif : le compte sert d'intermédiaire.",
        [{ rubrique: "Utilisation du compte", texte: "Virements de quatre particuliers (" + eur(Tin) + ") aussitôt retirés en espèces (" + eur(R) + ")." }, { rubrique: "Origine des fonds", texte: "Activité de " + hist[0] + " alléguée, sans justificatif." }]),
      issue: "declaration",
      explication: eur(Tin) + " reçus de quatre particuliers sans lien connu, puis " + eur(R) + " retirés en espèces au guichet en deux jours : le compte sert d'intermédiaire pour des tiers, sans aucun justificatif, pour " + (I.f ? "une cliente" : "un client") + " dont " + B.leRevEst(I) + " de " + eur(rev) + " par mois. Le doute n'est pas levé : le conseiller signale le dossier à la cellule TRACFIN de l'établissement.",
      retenir: ["Des virements de particuliers inconnus aussitôt retirés en espèces sont un schéma de compte intermédiaire.", "Prêter son compte à des tiers expose le client à des poursuites : la déclaration reste obligatoire.", RET_FIN],
      argumentaire: ["Rapprocher les " + eur(Tin) + " reçus " + B.duRev(I) + " (" + eur(rev) + " par mois)", "Relever les retraits d'espèces de " + eur(R) + " juste après les virements", "Constater l'absence de justificatif et de lien avec les payeurs", concl(g)]
    };
    return B.particulier(r, I, spec);
  };

  var api = { familles: F };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.quotidienAtypDeclaration = api; }
})(typeof window !== "undefined" ? window : null);
