/* GS Banque & Assurance – questionnaire « profil investisseur » (MIFID) et rapport de conseil : règles de contenu et de calcul (sans affichage).
   Le questionnaire suit la structure des questionnaires des banques : « Revenus et patrimoine » et « Connaissance et expérience » (propres au client, réutilisés tant que le profil est à jour),
   puis « Appétence au risque », « Finance durable » et « Stratégie » (propres au contrat envisagé). Il est obligatoire avant la souscription d'un produit boursier
   (assurance-vie GS Vie Patrimoine, Premium et Enfant, mandats de gestion pilotée, PEA, PEA Jeunes, PEA-PME-ETI, PER, compte-titres, parts sociales, plan d'épargne automatique AUTOMATIZ : le capital n'est pas toujours garanti). Il aboutit à un rapport de conseil, mis à disposition du client avant la souscription.
   Le barème (niveaux, seuils, supports) est une CONVENTION DE L'EXERCICE : aucune règle officielle ne fixe de barème, la réglementation (directive MIF II, règlement délégué 2017/565,
   Code des assurances pour le devoir de conseil) impose de recueillir ces informations et de remettre une déclaration d'adéquation écrite. Les clients, la banque et ses supports sont fictifs. */
(function (root) {
  "use strict";

  var B = root && root.SGBF ? root.SGBF.banque : require("./banque.js");
  var PR = root && root.SGBF ? root.SGBF.produits : require("./produits.js");
  var PL = root && root.SGBF ? root.SGBF.placements : require("./placements.js");
  var R = root && root.SGBF ? root.SGBF.risque : require("./risque.js");

  /* Produits boursiers : le capital n'y est pas toujours garanti. Le conseil examine leurs supports (placements.js), dont le niveau de risque est celui du produit et ne dépend pas des réponses du client. */
  var BOURSIERS = ["AV", "AVP", "AVE", "MGS", "MGE", "MGD", "PEA", "PEAJ", "PEAPME", "PER", "CTO", "PSOC", "AUTZ"];
  var PEAS = ["PEA", "PEAJ", "PEAPME"], ASSURANCES_VIE = ["AV", "AVP", "AVE", "MGS", "MGE", "MGD"];
  var VALIDITE_PROFIL = 365, VALIDITE_RAPPORT = 30;   /* jours (conventions de l'exercice) */
  function estBoursier(pid) { return BOURSIERS.indexOf(pid) >= 0; }

  /* ---------- le questionnaire ---------- */
  function o(v, t) { return { v: v, t: t }; }
  var VF = [o("vrai", "Vrai"), o("faux", "Faux")];
  var SECTIONS = [
    { id: "patrimoine", titre: "Revenus et patrimoine", portee: "client" },
    { id: "connaissance", titre: "Connaissance et expérience", portee: "client" },
    { id: "appetence", titre: "Appétence au risque", portee: "contrat" },
    { id: "durable", titre: "Finance durable", portee: "contrat" },
    { id: "strategie", titre: "Stratégie", portee: "contrat" }
  ];
  var QUESTIONS = [
    { id: "revenus", s: "patrimoine", type: "choix", texte: "Quels sont vos revenus moyens mensuels nets (revenus du foyer) ?",
      options: [o("r1", "Moins de 1 800 €"), o("r2", "Entre 1 801 € et 3 500 €"), o("r3", "Entre 3 501 € et 6 000 €"), o("r4", "Plus de 6 000 €")] },
    { id: "patrimoine", s: "patrimoine", type: "choix", texte: "Quelle est l'estimation de votre patrimoine net (épargne, placements, immobilier, moins les dettes) ?",
      options: [o("p1", "Moins de 25 000 €"), o("p2", "Entre 25 000 € et 100 000 €"), o("p3", "Entre 100 001 € et 300 000 €"), o("p4", "Plus de 300 000 €")] },
    { id: "epargne", s: "patrimoine", type: "choix", texte: "Quelle est votre capacité d'épargne mensuelle ?",
      options: [o("e1", "Moins de 100 €"), o("e2", "Entre 100 € et 250 €"), o("e3", "Entre 251 € et 500 €"), o("e4", "Entre 501 € et 1 000 €"), o("e5", "Plus de 1 000 €")] },
    { id: "csp", s: "patrimoine", type: "choix", texte: "Quelle est votre catégorie socioprofessionnelle ?",
      options: [o("agri", "Agriculteur exploitant"), o("chef", "Artisan, commerçant ou chef d'entreprise"), o("cadre", "Cadre ou profession intellectuelle supérieure"), o("interm", "Profession intermédiaire"),
        o("employe", "Employé"), o("ouvrier", "Ouvrier"), o("retraite", "Retraité"), o("etudiant", "Étudiant ou apprenti"), o("sans", "Sans activité professionnelle ou en recherche d'emploi")] },
    { id: "transactions", s: "connaissance", type: "choix", texte: "Combien de transactions (actions, obligations, parts de fonds…) avez-vous réalisées sur les marchés financiers au cours des 12 derniers mois ?",
      options: [o("t0", "Aucune"), o("t1", "Entre 1 et 5"), o("t2", "Entre 6 et 20"), o("t3", "Plus de 20")] },
    { id: "finance", s: "connaissance", type: "choix", texte: "Exercez-vous, ou avez-vous exercé au cours des 10 dernières années, une profession dans la finance ou en rapport avec des produits financiers ?",
      options: [o("oui", "Oui"), o("non", "Non")] },
    { id: "kv1", s: "connaissance", type: "vf", bonne: "vrai", texte: "La valeur d'une action peut baisser jusqu'à vous faire perdre la totalité de la somme investie.", options: VF },
    { id: "kv2", s: "connaissance", type: "vf", bonne: "faux", texte: "Les parts de fonds de placement (OPCVM) sont toutes des instruments financiers à capital garanti.", options: VF },
    { id: "kv3", s: "connaissance", type: "vf", bonne: "vrai", texte: "Un fonds indiciel coté (ETF) cherche à reproduire les variations d'un indice de marché, à la hausse comme à la baisse.", options: VF },
    { id: "kv4", s: "connaissance", type: "vf", bonne: "faux", texte: "Répartir mes placements sur plusieurs supports et plusieurs types d'actifs supprime totalement le risque de perte.", options: VF },
    { id: "kv5", s: "connaissance", type: "vf", bonne: "vrai", texte: "La durée de placement (court, moyen ou long terme) est un élément essentiel du choix d'un placement.", options: VF },
    { id: "kv6", s: "connaissance", type: "vf", bonne: "vrai", texte: "Un placement dont le rendement espéré est de 6 % par an est généralement plus risqué qu'un placement à 4 % par an sur la même durée.", options: VF },
    { id: "sensibilite", s: "appetence", type: "choix", texte: "Quelle est votre sensibilité au risque pour ce placement ?",
      options: [o("s1", "Prudent : je veux avant tout protéger mon capital, quitte à accepter un rendement faible."),
        o("s2", "Modéré : j'accepte une petite part de supports plus risqués pour viser un rendement un peu supérieur."),
        o("s3", "Dynamique : j'accepte des variations importantes de la valeur de mon placement pour viser un rendement supérieur."),
        o("s4", "Offensif : j'accepte de perdre une part importante de mon capital pour viser le meilleur rendement.")] },
    { id: "perte", s: "appetence", type: "choix", texte: "Quelle perte maximale seriez-vous prêt(e) à supporter sur ce placement, sans désinvestir ?",
      options: [o("l0", "Aucune perte"), o("l1", "Jusqu'à 10 % du capital investi"), o("l2", "Jusqu'à 25 % du capital investi"), o("l3", "Plus de 25 % du capital investi")] },
    { id: "durable", s: "durable", type: "choix", texte: "En matière de finance durable, quelle approche correspond le mieux à vos attentes pour ce placement ?",
      options: [o("d0", "Aucune préférence en matière de durabilité"), o("d1", "Approche durable modérée : prise en compte de critères environnementaux, sociaux et de gouvernance"),
        o("d2", "Approche durable forte : une part significative des sommes investie dans des activités durables")] },
    { id: "approche", s: "durable", type: "choix", conditionnelle: true, texte: "Parmi ces approches durables, laquelle vous correspond le plus ?",
      options: [o("a1", "L'approche durable de GS Banque & Assurance, où les critères de durabilité sont choisis par la banque"), o("a2", "Mes propres critères (environnement, social, gouvernance)")] },
    { id: "horizon", s: "strategie", type: "choix", texte: "Quel est votre horizon de placement pour ce contrat ?",
      options: [o("h1", "Court terme (moins de 2 ans)"), o("h2", "Moyen terme (de 2 à 8 ans)"), o("h3", "Long terme (plus de 8 ans)")] },
    { id: "objectif", s: "strategie", type: "choix", texte: "Quel est votre principal objectif de placement pour ce contrat ?",
      options: [o("o1", "Préserver mon capital"), o("o2", "Valoriser un capital"), o("o3", "Préparer ma retraite"), o("o4", "Transmettre un capital"), o("o5", "Obtenir des revenus complémentaires")] },
    { id: "liquidite", s: "strategie", type: "choix", texte: "Pensez-vous avoir besoin de retirer facilement et rapidement les sommes investies ?",
      options: [o("q1", "Oui, je peux avoir besoin de récupérer rapidement ces sommes"), o("q0", "Non, je dispose par ailleurs d'économies rapidement disponibles")] },
    { id: "montant", s: "strategie", type: "montant", texte: "Quel montant envisagez-vous d'investir sur ce contrat (en euros) ?" }
  ];
  var PAR_ID = {}; QUESTIONS.forEach(function (q) { PAR_ID[q.id] = q; });
  function question(id) { return PAR_ID[id] || null; }
  function questions(portee) { return QUESTIONS.filter(function (q) { var s = SECTIONS.filter(function (x) { return x.id === q.s; })[0]; return !portee || s.portee === portee; }); }
  function texteOption(q, v) { var l = (q.options || []).filter(function (x) { return x.v === v; })[0]; return l ? l.t : ""; }
  var IDS_CLIENT = questions("client").map(function (q) { return q.id; }), IDS_CONTRAT = questions("contrat").map(function (q) { return q.id; });

  /* ---------- lecture d'un montant ---------- */
  function lireMontant(v) {
    var t = String(v == null ? "" : v).replace(/[\s  ]/g, "").replace(",", ".");
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return NaN;
    return Math.round(parseFloat(t) * 100) / 100;
  }
  var MONTANT_MAX = 100000000;

  /* Contrôle des réponses : toutes les questions applicables doivent avoir une réponse valide.
     Renvoie { ok: true, rep } (réponses nettoyées) ou { ok: false, champ, erreur }. */
  function controler(rep) {
    rep = rep || {}; var net = {};
    for (var i = 0; i < QUESTIONS.length; i++) {
      var q = QUESTIONS[i];
      if (q.conditionnelle && (net.durable === "d0" || net.durable === undefined)) continue;
      var v = rep[q.id];
      if (q.type === "montant") {
        var m = lireMontant(v);
        if (isNaN(m) || !(m > 0)) return { ok: false, champ: q.id, erreur: "Indiquez le montant envisagé en euros (par exemple 5 000 ou 2 500,50)." };
        if (m > MONTANT_MAX) return { ok: false, champ: q.id, erreur: "Le montant envisagé est trop élevé pour être saisi ici." };
        net[q.id] = m; continue;
      }
      if (!q.options.some(function (x) { return x.v === v; })) return { ok: false, champ: q.id, erreur: "Répondez à la question : « " + q.texte + " »" };
      net[q.id] = v;
    }
    return { ok: true, rep: net };
  }

  /* Contrôle des seules questions du client (revenus et patrimoine, connaissance et expérience), celles qui se rangent dans son profil : utilisé par la fiche d'entretien.
     Renvoie { ok: true, rep } ou { ok: false, champ, erreur }. */
  function controlerClient(rep) {
    rep = rep || {}; var net = {};
    var qs = questions("client");
    for (var i = 0; i < qs.length; i++) {
      var q = qs[i], v = rep[q.id];
      if (!q.options.some(function (x) { return x.v === v; })) return { ok: false, champ: q.id, erreur: "Répondez à la question : « " + q.texte + " »" };
      net[q.id] = v;
    }
    return { ok: true, rep: net };
  }
  /* Enregistre le profil du client (revenus, patrimoine, connaissance et expérience) sans produit : à la différence d'un rapport de conseil, aucun produit n'est examiné.
     Le profil, daté d'aujourd'hui, est valable 12 mois et sert ensuite au questionnaire d'un produit boursier. */
  function enregistrerProfil(st, c, rep) {
    var k = controlerClient(rep); if (!k.ok) return k;
    if (!st.profils) st.profils = {};
    st.profils[c.id] = { date: B.ymd(B.aujourdhui()), rep: k.rep, par: (st.eleve && st.eleve.nom) || "" };
    return { ok: true, profil: st.profils[c.id] };
  }

  /* ---------- profil : niveaux ---------- */
  function rang(v) { return parseInt(String(v).slice(1), 10); }   /* r2 → 2, p3 → 3, s4 → 4, h1 → 1, l0 → 0 */
  var NIV_PATRIMOINE = ["Faible", "Moyen", "Élevé"], NIV_PERTES = ["Faible", "Moyenne", "Élevée"], NIV_CONN = ["Novice", "Initié", "Confirmé", "Expert"], NIV_APPETENCE = ["Prudente", "Modérée", "Dynamique", "Offensive"];
  var PAR_PERTES = { Faible: 2, Moyenne: 3, "Élevée": 4 };   /* risque maximal d'un support qu'un client peut supporter selon sa capacité à subir des pertes */
  /* Revenus et patrimoine : revenus (1 à 4) + patrimoine (1 à 4) → ≤ 3 faible, 4 à 5 moyen, ≥ 6 élevé. */
  function niveauPatrimoine(rep) { var s = rang(rep.revenus) + rang(rep.patrimoine); return s <= 3 ? "Faible" : s <= 5 ? "Moyen" : "Élevé"; }
  /* Capacité à subir des pertes : revenus + patrimoine + capacité d'épargne (3 à 13) → ≤ 4 faible, 5 à 7 moyenne, ≥ 8 élevée. */
  function capacitePertes(rep) { var s = rang(rep.revenus) + rang(rep.patrimoine) + rang(rep.epargne); return s <= 4 ? "Faible" : s <= 7 ? "Moyenne" : "Élevée"; }
  /* Connaissance et expérience : bonnes réponses aux six questions + expérience (0 à 3) + profession de la finance (2) → ≤ 3 novice, 4 à 6 initié, 7 à 8 confirmé, ≥ 9 expert. */
  function pointsConnaissance(rep) {
    var n = 0; QUESTIONS.forEach(function (q) { if (q.type === "vf" && rep[q.id] === q.bonne) n++; });
    return n + rang(rep.transactions) + (rep.finance === "oui" ? 2 : 0);
  }
  function niveauConnaissance(rep) { var p = pointsConnaissance(rep); return p <= 3 ? "Novice" : p <= 6 ? "Initié" : p <= 8 ? "Confirmé" : "Expert"; }
  function bonnesReponses(rep) { var n = 0; QUESTIONS.forEach(function (q) { if (q.type === "vf" && rep[q.id] === q.bonne) n++; }); return n; }
  /* Appétence au risque : la plus prudente de la sensibilité (1 à 4) et de la perte acceptée (0 à 3, +1). */
  function appetence(rep) { return Math.min(rang(rep.sensibilite), rang(rep.perte) + 1); }
  function rangNiveau(liste, n) { return liste.indexOf(n) + 1; }

  /* ---------- supports conseillés ---------- */
  /* Les supports de chaque produit, leur composition et leur indicateur de risque (de 1 à 7) sont dans placements.js et risque.js : le niveau de risque est celui du SUPPORT, jamais celui du client.
     Échelle de conseil à 4 niveaux (regroupement de l'indicateur de 1 à 7) : 1 très faible (indicateur 1), 2 modéré (2 et 3), 3 élevé (4 et 5), 4 très élevé (6 et 7) ;
     conn : niveau de connaissance minimal (1 novice à 4 expert) ; hor : horizon minimal (1 court, 2 moyen, 3 long). */
  var NOMS_RISQUE = R.NOMS_NIVEAU;
  var SUPPORTS = {};
  BOURSIERS.forEach(function (pid) { SUPPORTS[pid] = PL.supports(pid); });
  function indic(sup) { return "indicateur de risque " + sup.sri + " sur 7"; }
  var CONTRAT_NOM = { AV: "Assurance-vie GS Vie Patrimoine", AVP: "Assurance-vie GS Vie Premium", AVE: "Assurance-vie GS Vie Enfant", MGS: "Mandat de gestion pilotée – profil Sécuritaire", MGE: "Mandat de gestion pilotée – profil Équilibre", MGD: "Mandat de gestion pilotée – profil Dynamique",
    PEA: "GS PEA Actions", PEAJ: "GS PEA Jeunes", PEAPME: "GS PEA-PME-ETI", PER: "GS PER Individuel", CTO: "GS Compte-Titres", PSOC: "Parts sociales GS Banque & Assurance", AUTZ: "Plan d'épargne automatique AUTOMATIZ" };

  function euros(n) { return B.eur(n); }
  function plafondPatrimoine(v) { return { p1: 25000, p2: 100000, p3: 300000, p4: null }[v]; }

  /* Contrôles d'adéquation d'un support : liste { ok, texte }. */
  function criteres(pid, sup, pc, rep) {
    var L = [], cap = PAR_PERTES[pc.capacite], app = pc.appetence, conn = rangNiveau(NIV_CONN, pc.connaissance), hor = rang(rep.horizon);
    L.push({ cle: "situation", ok: sup.risque <= cap, texte: sup.risque <= cap
      ? "Votre situation financière (capacité à subir des pertes « " + pc.capacite.toLowerCase() + " ») permet d'envisager ce type d'investissement : le support présente un risque « " + NOMS_RISQUE[sup.risque].toLowerCase() + " » (" + indic(sup) + ")."
      : "Votre capacité à subir des pertes (« " + pc.capacite.toLowerCase() + " ») ne permet pas d'envisager ce support, dont le risque est « " + NOMS_RISQUE[sup.risque].toLowerCase() + " » (" + indic(sup) + ")." });
    L.push({ cle: "connaissance", ok: conn >= sup.conn, texte: conn >= sup.conn
      ? (sup.conn <= 1 ? "Ce support est adapté à tout niveau de connaissance et d'expérience." : "Votre niveau de connaissance et d'expérience (« " + pc.connaissance.toLowerCase() + " ») est suffisant pour ce support.")
      : "Votre niveau de connaissance et d'expérience (« " + pc.connaissance.toLowerCase() + " ») est insuffisant : ce support suppose au moins un niveau « " + NIV_CONN[sup.conn - 1].toLowerCase() + " »." });
    L.push({ cle: "risque", ok: sup.risque <= app, texte: sup.risque <= app
      ? "Le risque de perte en capital du support (« " + NOMS_RISQUE[sup.risque].toLowerCase() + " », " + indic(sup) + ") respecte votre appétence au risque (« " + NIV_APPETENCE[app - 1].toLowerCase() + " ») et votre sensibilité à la volatilité des marchés."
      : "Le risque de perte en capital du support (« " + NOMS_RISQUE[sup.risque].toLowerCase() + " », " + indic(sup) + ") dépasse votre appétence au risque (« " + NIV_APPETENCE[app - 1].toLowerCase() + " »)." });
    var horOk = hor >= sup.hor;
    L.push({ cle: "horizon", ok: horOk, texte: horOk
      ? "Ce support est adapté pour une durée de placement de « " + sup.duree + " », ce qui est aligné avec votre horizon de placement."
      : "Ce support suppose une durée de placement de « " + sup.duree + " », ce qui n'est pas aligné avec votre horizon de placement." });
    var obj = rep.objectif, objOk = true, objTxt;
    if (pid === "PER") { objOk = obj === "o3"; objTxt = objOk ? "Le PER est cohérent avec votre objectif : préparer votre retraite." : "Le PER sert à préparer la retraite : il ne correspond pas à votre objectif de placement."; }
    else if (obj === "o1") { objOk = !!sup.garanti; objTxt = objOk ? "Ce support est cohérent avec votre objectif de préserver votre capital (capital garanti nets de frais)." : "Vous souhaitez préserver votre capital : un support dont le capital n'est pas garanti ne correspond pas à cet objectif."; }
    else objTxt = "Ce conseil est en cohérence avec votre objectif de placement : « " + texteOption(PAR_ID.objectif, obj).toLowerCase() + " ».";
    L.push({ cle: "objectif", ok: objOk, texte: objTxt });
    if (pid === "PER") L.push({ cle: "liquidite", ok: rep.liquidite === "q0", texte: rep.liquidite === "q0" ? "Vous disposez par ailleurs d'économies rapidement disponibles : le blocage de l'épargne jusqu'à la retraite est compatible avec votre situation." : "Vous pouvez avoir besoin de récupérer rapidement les sommes investies : l'épargne du PER est bloquée jusqu'à la retraite (sauf cas de déblocage anticipé prévus par la loi)." });
    return L;
  }

  /* Messages d'information, qui ne bloquent pas le conseil. */
  function messages(pid, sup, pc, rep, c) {
    var M = [], m = rep.montant, pl = plafondPatrimoine(rep.patrimoine);
    if (pid !== "PER" && rep.liquidite === "q1") M.push(PEAS.indexOf(pid) >= 0 ? "Vous pouvez avoir besoin de récupérer rapidement les sommes investies : un retrait du plan avant 5 ans entraîne en principe sa clôture et la perte de l'avantage fiscal."
      : ASSURANCES_VIE.indexOf(pid) >= 0 ? "Vous pouvez avoir besoin de récupérer rapidement les sommes investies : l'assurance-vie reste disponible (rachat possible à tout moment), mais la valeur des unités de compte peut être inférieure à la somme investie au moment du rachat."
      : pid === "PSOC" ? "Vous pouvez avoir besoin de récupérer rapidement les sommes investies : les parts sociales ne sont pas cotées, leur remboursement est soumis à l'agrément du conseil d'administration et peut prendre plusieurs mois."
      : "Vous pouvez avoir besoin de récupérer rapidement les sommes investies : les titres peuvent être revendus à tout moment, mais leur valeur peut être inférieure à la somme investie au moment de la vente.");
    if (pl && m > pl / 2) M.push("Le montant envisagé (" + euros(m) + ") représente plus de la moitié du patrimoine net que vous avez déclaré (moins de " + euros(pl) + ") : il convient de ne pas concentrer vos placements sur un seul contrat.");
    if (sup.uc > 0) M.push("Sur les unités de compte, le capital n'est pas garanti : vous pouvez perdre une partie ou la totalité des sommes investies. Les performances passées ne préjugent pas des performances futures.");
    if (rang(rep.sensibilite) >= 3 && rang(rep.perte) === 0) M.push("Vos réponses sur la sensibilité au risque et sur la perte acceptée ne sont pas cohérentes : le profil retenu est le plus prudent des deux.");
    if (rep.durable && rep.durable !== "d0") {
      var ok = rang(sup.durable) >= rang(rep.durable);
      M.push(ok ? "Nous vous informons que notre conseil peut porter sur des investissements durables inhérents à la gamme de produits proposés par GS Banque & Assurance, en cohérence avec votre préférence."
        : "Votre préférence en matière de durabilité (« " + texteOption(PAR_ID.durable, rep.durable).split(" :")[0].toLowerCase() + " ») ne peut être pleinement satisfaite par ce support : la gamme de GS Banque & Assurance ne propose pas, pour ce contrat, une approche durable aussi poussée. Vous pouvez adapter cette préférence ou renoncer à ce support.");
    }
    if (PEAS.indexOf(pid) >= 0) M.push((pid === "PEAPME" ? "Le PEA-PME-ETI est limité aux titres de petites et moyennes entreprises et d'entreprises de taille intermédiaire européennes, avec un plafond de versements de 225 000 € tous PEA confondus" : pid === "PEAJ" ? "Le PEA Jeunes est limité à des titres de sociétés européennes et à 20 000 € de versements" : "Le PEA est limité à des titres de sociétés européennes et à un plafond de versements de 150 000 €") + " ; l'avantage fiscal suppose de conserver le plan au moins 5 ans.");
    if (pid === "PSOC") M.push("Les parts sociales supportent les pertes de la banque : le capital n'est pas garanti, la rémunération est votée chaque année par l'assemblée générale et aucune liquidité n'est garantie.");
    if (ASSURANCES_VIE.slice(3).indexOf(pid) >= 0) M.push("Le mandat est une option de gestion d'un contrat d'assurance-vie : vous confiez la répartition de l'épargne à l'assureur, qui applique l'orientation choisie ; le contrat reste soumis à ses propres frais, auxquels s'ajoutent les frais du mandat.");
    return M;
  }

  /* Conseil pour un produit boursier : { verdict: "adapte" | "non_adapte", support, criteres, messages, alternatives, profil }. */
  function conseil(pid, rep, c) {
    if (!estBoursier(pid)) return null;
    var pc = { patrimoine: niveauPatrimoine(rep), capacite: capacitePertes(rep), connaissance: niveauConnaissance(rep), appetence: appetence(rep) };
    var cap = PAR_PERTES[pc.capacite], plafond = Math.min(pc.appetence, cap), sups = SUPPORTS[pid];
    var retenu = null;
    sups.forEach(function (s) {
      var l = criteres(pid, s, pc, rep);
      if (l.every(function (x) { return x.ok; }) && (!retenu || s.risque > retenu.risque)) retenu = s;
    });
    var verdict = retenu ? "adapte" : "non_adapte", support = retenu || sups[0];
    var cr = criteres(pid, support, pc, rep);
    var alt = [];
    if (!retenu) {
      if (pid !== "AV") { var av = conseil("AV", rep, c); if (av && av.verdict === "adapte") alt.push("L'assurance-vie GS Vie Patrimoine, avec le support « " + av.support.nom + " », est adaptée à votre profil."); }
      alt.push("L'épargne bancaire (Livret A, LDDS, Livret Projets), dont le capital est garanti, reste adaptée à votre situation.");
    }
    return { verdict: verdict, produit: pid, support: support, profil: pc, plafondRisque: plafond, criteres: cr, messages: messages(pid, support, pc, rep, c), alternatives: alt };
  }

  /* ---------- profil enregistré du client ---------- */
  function ajouterJours(d, n) { return B.plusJours(d, n); }
  function profilStocke(st, cid) { return st && st.profils && st.profils[cid] ? st.profils[cid] : null; }
  /* Profil à jour ? (convention : valable 12 mois) */
  function etatProfil(p, auj) {
    if (!p) return { etat: "aucun" };
    var d = B.lireYmd(p.date), fin = ajouterJours(d, VALIDITE_PROFIL);
    return { etat: auj <= fin ? "valable" : "perime", date: d, fin: fin };
  }

  /* Graine stable tirée d'un texte. */
  function graine(s) { var h = 5381; s = String(s); for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h; }
  function tranche(n, bornes) { for (var i = 0; i < bornes.length; i++) if (n <= bornes[i]) return i + 1; return bornes.length + 1; }
  /* Profil que le dossier d'un client détenteur de produits boursiers permet de reconstituer : il a rempli un questionnaire à l'ouverture de son contrat le plus récent
     (revenus, patrimoine et épargne d'après son dossier, connaissances en rapport avec ses placements). Sans produit boursier : aucun profil. */
  function profilInitial(c) {
    var plc = (c.plc || []).filter(function (x) { return estBoursier(x.p); });
    if (!plc.length) return null;
    var g = graine(c.id + "|mifid"), foyer = (c.pro && (c.pro.foyer || c.pro.rev)) || 0;
    var fin = 0; (c.epa || []).forEach(function (e) { fin += e.solde; }); (c.plc || []).forEach(function (e) { fin += e.solde; });
    var proprio = c.log && c.log.st === "proprietaire";
    var rev = tranche(foyer, [1800, 3500, 6000]), pat = Math.min(4, tranche(fin, [25000, 100000, 300000]) + (proprio ? 1 : 0));
    var ep = foyer < 1800 ? 1 : foyer < 3500 ? 2 : foyer < 6000 ? 3 : 4;
    var st = c.pro && c.pro.statut, cat = c.pro && c.pro.cat, csp = st === "retraite" ? "retraite" : (st === "chomage" || st === "foyer") ? "sans" : (st === "etudiant" || st === "apprenti") ? "etudiant" : ({ indep: "chef", profint: "interm", cadre: "cadre", employe: "employe", ouvrier: "ouvrier" }[cat] || "employe");
    var pea = plc.some(function (x) { return x.p === "PEA"; }), uc = plc.some(function (x) { return x.uc > 0 || x.p === "PEA"; });
    var tr = pea ? 2 : uc ? 1 : 0, cible = (pea ? 6 : uc ? 5 : 3) + (g % 2);
    var bonnes = Math.max(0, Math.min(6, cible - tr)), ordre = QUESTIONS.filter(function (q) { return q.type === "vf"; }).map(function (q, i) { return { q: q, k: (g >>> (i * 3)) % 97 + i / 10 }; }).sort(function (a, b) { return a.k - b.k; });
    var rep = { revenus: "r" + rev, patrimoine: "p" + pat, epargne: "e" + ep, csp: csp, transactions: "t" + tr, finance: "non" };
    ordre.forEach(function (x, i) { rep[x.q.id] = i < bonnes ? x.q.bonne : (x.q.bonne === "vrai" ? "faux" : "vrai"); });
    var jours = Math.min.apply(null, plc.map(function (x) { return x.ouvert; }));
    return { date: B.ymd(B.dateJours(jours)), rep: rep, origine: "dossier" };
  }

  /* Profil du client à utiliser : celui qu'a enregistré l'élève, à défaut celui reconstitué d'après le dossier. */
  function profilClient(st, c) {
    var p = profilStocke(st, c.id);
    if (p) return { date: p.date, rep: p.rep, origine: "eleve" };
    return profilInitial(c);
  }

  /* Suggestions tirées du dossier pour préremplir (à confirmer avec le client) : revenus, patrimoine financier détenu, catégorie socioprofessionnelle. */
  function suggestions(c) {
    var foyer = (c.pro && (c.pro.foyer || c.pro.rev)) || 0, fin = 0;
    (c.epa || []).forEach(function (e) { fin += e.solde; }); (c.plc || []).forEach(function (e) { fin += e.solde; });
    var pi = profilInitial({ id: c.id, plc: [{ p: "AV", ouvert: 0, uc: 0 }], pro: c.pro, epa: c.epa, log: c.log });
    return { revenus: "r" + tranche(foyer, [1800, 3500, 6000]), csp: pi.rep.csp, epargneDetenue: fin, foyer: foyer };
  }

  /* ---------- rapports de conseil ---------- */
  function rapports(st) { return st && Array.isArray(st.rapports) ? st.rapports : []; }
  function rapport(st, id) { return rapports(st).filter(function (r) { return r.id === id; })[0] || null; }
  /* Souscription déjà faite avec ce rapport ? */
  function utilise(st, id) { return ((st && st.souscriptions) || []).some(function (s) { return s.rapport === id; }); }
  /* Rapport utilisable pour souscrire : mis à disposition, de ce client et de ce produit, valable 30 jours, pas déjà utilisé ; adapté, ou non adapté mais maintenu à l'initiative du client. */
  function utilisable(st, r, cid, pid, auj) {
    if (!r || r.c !== cid || r.p !== pid) return { ok: false, raison: "autre" };
    if (!r.dispo) return { ok: false, raison: "non_dispo" };
    if (utilise(st, r.id)) return { ok: false, raison: "utilise" };
    var d = B.lireYmd(r.date);
    if (!d || auj > ajouterJours(d, VALIDITE_RAPPORT)) return { ok: false, raison: "perime" };
    if (r.conseil.verdict !== "adapte" && !r.maintien) return { ok: false, raison: "non_adapte" };
    return { ok: true };
  }
  function rapportsUtilisables(st, cid, pid, auj) { return rapports(st).filter(function (r) { return utilisable(st, r, cid, pid, auj).ok; }); }

  /* Crée le rapport de conseil à partir des réponses (déjà contrôlées) et enregistre le profil du client.
     o = { canal } ; le rapport n'est pas encore mis à disposition. */
  function creerRapport(st, c, pid, rep, o) {
    if (!estBoursier(pid)) return { ok: false, erreur: "Le questionnaire ne concerne que les produits boursiers : assurance-vie, mandats de gestion, PEA, PER, compte-titres, parts sociales et épargne automatique." };
    var k = controler(rep); if (!k.ok) return k;
    o = o || {};
    var cn = conseil(pid, k.rep, c), now = B.maintenant(), auj = B.ymd(B.aujourdhui());
    var client = {}; IDS_CLIENT.forEach(function (id) { client[id] = k.rep[id]; });
    if (!st.profils) st.profils = {};
    st.profils[c.id] = { date: auj, rep: client, par: (st.eleve && st.eleve.nom) || "" };
    if (!Array.isArray(st.rapports)) st.rapports = [];
    var r = { id: "m" + now.getTime().toString(36) + Math.random().toString(36).slice(2, 6), c: c.id, p: pid, date: auj, heure: B.hhmm(now), canal: o.canal || "", rep: k.rep, conseil: cn,
      montant: k.rep.montant, par: (st.eleve && st.eleve.nom) || "", dispo: null, maintien: false };
    st.rapports.push(r);
    return { ok: true, rapport: r };
  }
  /* Mise à disposition du client : en ligne (espace client) si l'échange est à distance, remise en agence sinon. Le rapport non adapté ne peut être mis à disposition que
     si le client maintient sa demande malgré la mise en garde (opération à son initiative). */
  function mettreADisposition(st, id, o) {
    var r = rapport(st, id); if (!r) return { ok: false, erreur: "Rapport inconnu." };
    if (r.dispo) return { ok: false, erreur: "Ce rapport est déjà à la disposition du client." };
    o = o || {};
    if (r.conseil.verdict !== "adapte") {
      if (!o.maintien) return { ok: false, erreur: "Le produit n'est pas adapté au profil du client : le client doit confirmer qu'il maintient sa demande malgré la mise en garde, ou un autre produit doit lui être proposé." };
      r.maintien = true;
    }
    var now = B.maintenant();
    r.dispo = { date: B.ymd(B.aujourdhui()), heure: B.hhmm(now), mode: (r.canal === "rdv" || r.canal === "accueil") ? "agence" : "ligne" };
    return { ok: true, rapport: r };
  }
  function supprimerRapport(st, id) {
    if (utilise(st, id)) return false;
    var n = rapports(st).length; st.rapports = rapports(st).filter(function (r) { return r.id !== id; }); return st.rapports.length < n;
  }

  /* ---------- texte du rapport de conseil (affichage et impression) ---------- */
  var MOYEN_LIB = { mail: "par échange d'e-mails (mailing)", appel: "par téléphone", rdv: "lors d'un entretien en rendez-vous", accueil: "lors d'un entretien à l'accueil de l'agence" };
  function minuscule(t) { return String(t).charAt(0).toLowerCase() + String(t).slice(1); }
  function courtDurable(v) { return texteOption(PAR_ID.durable, v).split(" :")[0]; }
  /* Renvoie le contenu du rapport sous forme de données : { civilite, intro, adequation, recap, resultat, questionnaire, dispo }. */
  function textes(r, c) {
    var rep = r.rep, cn = r.conseil, pc = cn.profil, q = function (id) { return texteOption(PAR_ID[id], rep[id]); };
    var civ = (c.civ === "Mme" ? "Madame " : "Monsieur ") + c.prenom + " " + c.nom.toUpperCase();
    var nomContrat = CONTRAT_NOM[r.p];
    var adapte = cn.verdict === "adapte";
    var t = { civilite: civ, contrat: nomContrat, verdict: cn.verdict };
    t.intro = ["Dans le cadre de votre adhésion à un contrat « " + nomContrat + " », vous avez répondu à un certain nombre de questions " + (MOYEN_LIB[r.canal] || "") + ", qui nous ont permis de déterminer votre profil investisseur.".replace("  ", " "),
      "Notre conseil est fondé sur vos besoins et exigences, notamment en termes de :"];
    t.besoins = ["objectifs poursuivis (dont préférence en matière de durabilité) ;", "horizon de placement envisagé ;", "profil de risque et capacité à supporter d'éventuelles pertes ;", "situation patrimoniale et financière."];
    t.limite = "Le conseil fourni est limité au périmètre des éléments que vous nous avez déclarés et aux caractéristiques des produits et services proposés par GS Banque & Assurance. Il ne constitue pas un conseil indépendant et n'implique pas une analyse exhaustive de l'ensemble des produits disponibles sur le marché.";
    t.adequation = adapte
      ? "Sous réserve de l'exactitude et de l'exhaustivité des informations recueillies, le contrat conseillé est considéré comme approprié à vos besoins et exigences, tels qu'exprimés à ce jour. Vous trouverez ci-dessous les raisons justifiant ce caractère adapté ainsi que nos éventuels messages d'information :"
      : "Au vu des informations recueillies, le contrat demandé n'est pas considéré comme adapté à vos besoins et exigences, tels qu'exprimés à ce jour : nous ne pouvons pas vous le conseiller. Vous trouverez ci-dessous les raisons de ce constat, nos messages d'information et, le cas échéant, les produits qui seraient adaptés à votre profil." + (r.maintien ? " Vous avez toutefois indiqué souhaiter maintenir votre demande, à votre initiative, malgré cette mise en garde : l'opération n'est alors pas réalisée sur notre conseil." : "");
    var bonnes = bonnesReponses(rep);
    t.recap = {
      client: [
        { titre: "Revenus et patrimoine", niveau: pc.patrimoine, texte: "Concernant votre situation financière et patrimoniale, vous disposez de revenus mensuels nets de « " + q("revenus") + " » et d'un patrimoine net estimé à « " + q("patrimoine") + " »." },
        { titre: "Capacité à subir des pertes", niveau: pc.capacite, texte: "Vos réponses sur vos revenus, votre patrimoine et votre capacité d'épargne (« " + q("epargne") + " par mois ») permettent d'évaluer votre capacité à subir des pertes : « " + pc.capacite.toLowerCase() + " ». Elle correspond au niveau de pertes potentielles que vous pouvez assumer dans le cadre de vos investissements." },
        { titre: "Connaissance et expérience", niveau: pc.connaissance, texte: "Au regard de vos connaissances (" + bonnes + " bonne" + (bonnes > 1 ? "s" : "") + " réponse" + (bonnes > 1 ? "s" : "") + " sur 6 aux questions de connaissance) et de votre expérience en matière d'investissement (transactions au cours des 12 derniers mois : « " + minuscule(q("transactions")) + " »" + (rep.finance === "oui" ? " ; profession exercée dans la finance" : "") + "), nous avons déterminé que vous disposez d'un profil « " + pc.connaissance.toLowerCase() + " »." }
      ],
      contrat: [
        { titre: "Appétence au risque", niveau: NIV_APPETENCE[pc.appetence - 1], texte: "Compte tenu de vos réponses sur votre sensibilité au risque et sur la perte maximale que vous acceptez de supporter (« " + minuscule(q("perte")) + " »), nous avons déterminé que votre appétence au risque est « " + NIV_APPETENCE[pc.appetence - 1].toLowerCase() + " », ce qui traduit le niveau de risque global que vous êtes disposé(e) à prendre." + (cn.plafondRisque < pc.appetence ? " Elle est limitée par votre capacité à subir des pertes : le risque du support conseillé ne peut pas dépasser le niveau « " + NOMS_RISQUE[cn.plafondRisque].toLowerCase() + " »." : "") },
        { titre: "Horizon et objectif", niveau: "", texte: "Pour cet investissement, vous souhaitez investir sur un horizon : « " + minuscule(q("horizon")) + " ». Votre objectif de placement pour ce contrat : « " + minuscule(q("objectif")) + " »." },
        { titre: "Finance durable", niveau: "", texte: rep.durable === "d0" ? "Vous n'avez pas de préférence en matière de durabilité." : "Votre préférence : « " + minuscule(courtDurable(rep.durable)) + " » ; approche retenue : « " + minuscule(q("approche")) + " »." }
      ]
    };
    t.resultat = { titre: adapte ? "Conseil GS Banque & Assurance" : "Conseil GS Banque & Assurance : contrat non adapté", support: adapte ? cn.support.nom : "Aucun support de ce contrat n'est adapté à votre profil",
      risque: NOMS_RISQUE[cn.support.risque], sri: cn.support.sri, presentation: adapte ? cn.support.presentation : [], supportExamine: cn.support.nom,
      explication: cn.criteres.map(function (x) { return { ok: x.ok, texte: x.texte }; }), messages: cn.messages, alternatives: cn.alternatives,
      intro: adapte ? "D'après les éléments recueillis dans votre profil investisseur, le support « " + cn.support.nom + " » du contrat « " + nomContrat + " » est adapté à votre profil car :" : "D'après les éléments recueillis dans votre profil investisseur, le contrat « " + nomContrat + " » n'est pas adapté à votre profil car (support examiné : « " + cn.support.nom + " ») :" };
    t.questionnaire = SECTIONS.map(function (s) {
      return { id: s.id, titre: s.titre, portee: s.portee, lignes: QUESTIONS.filter(function (x) { return x.s === s.id && rep[x.id] !== undefined; }).map(function (x) {
        return { q: x.texte, r: x.type === "montant" ? euros(rep[x.id]) : texteOption(x, rep[x.id]) };
      }) };
    });
    t.dispo = r.dispo ? (r.dispo.mode === "agence" ? "Rapport remis au client en agence (exemplaire imprimé), le " : "Rapport mis à disposition du client dans son espace client en ligne, avec une notification par e-mail, le ") + B.fmtDate(B.lireYmd(r.dispo.date)) + " à " + r.dispo.heure.replace(":", " h ") + "." : "";
    return t;
  }

  var api = {
    BOURSIERS: BOURSIERS, VALIDITE_PROFIL: VALIDITE_PROFIL, VALIDITE_RAPPORT: VALIDITE_RAPPORT, SECTIONS: SECTIONS, QUESTIONS: QUESTIONS, SUPPORTS: SUPPORTS, CONTRAT_NOM: CONTRAT_NOM, NOMS_RISQUE: NOMS_RISQUE,
    NIV_PATRIMOINE: NIV_PATRIMOINE, NIV_PERTES: NIV_PERTES, NIV_CONN: NIV_CONN, NIV_APPETENCE: NIV_APPETENCE, IDS_CLIENT: IDS_CLIENT, IDS_CONTRAT: IDS_CONTRAT,
    estBoursier: estBoursier, controlerClient: controlerClient, enregistrerProfil: enregistrerProfil, question: question, questions: questions, texteOption: texteOption, lireMontant: lireMontant, controler: controler, niveauPatrimoine: niveauPatrimoine, capacitePertes: capacitePertes,
    niveauConnaissance: niveauConnaissance, pointsConnaissance: pointsConnaissance, bonnesReponses: bonnesReponses, appetence: appetence, conseil: conseil, criteres: criteres, profilInitial: profilInitial,
    profilClient: profilClient, profilStocke: profilStocke, etatProfil: etatProfil, suggestions: suggestions, rapports: rapports, rapport: rapport, utilise: utilise, utilisable: utilisable,
    rapportsUtilisables: rapportsUtilisables, textes: textes, MOYEN_LIB: MOYEN_LIB, creerRapport: creerRapport, mettreADisposition: mettreADisposition, supprimerRapport: supprimerRapport
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.mifid = api; }
})(typeof window !== "undefined" ? window : null);
