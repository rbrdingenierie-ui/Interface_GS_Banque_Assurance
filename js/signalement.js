/* GS Banque & Assurance – fiche de signalement à la cellule TRACFIN de l'établissement (parcours « mouvements atypiques »).
   Quand le conseiller décide de « déclarer », il n'envoie pas lui-même la déclaration de soupçon à TRACFIN : il signale le dossier à la cellule de l'établissement
   (le déclarant désigné), qui décide et déclare. La fiche reprend les mentions que la déclaration devra contenir et que le déclarant ne peut pas reconstituer seul :
   le cas de déclaration, les opérations en cause, l'état d'exécution, le bénéficiaire effectif, les éléments d'analyse. Fonctions pures, utilisables dans le navigateur et sous Node.

   Sources : lignes directrices conjointes ACPR–Tracfin sur la déclaration de soupçon (édition de 2018 : contenu, délais, confidentialité) et sur la vigilance et l'information à Tracfin (édition du 22 janvier 2025,
   textes en vigueur au 1er septembre 2024 : cas I et II, analyse des faits au 5° du III de l'article R. 561-31, déclaration « sans délai »), consultées le 17 novembre 2026. Légifrance n'a pas pu être consulté :
   les numéros d'articles sont ceux de ces lignes directrices (explicatives, non contraignantes) et sont à revérifier sur Légifrance avant tout usage hors de l'exercice.
   - article L. 561-15 I : sommes ou opérations dont l'organisme sait, soupçonne ou a de bonnes raisons de soupçonner qu'elles proviennent d'une infraction passible d'une peine privative de liberté
     supérieure à un an, ou qu'elles participent au financement du terrorisme ; II : fraude fiscale, lorsqu'au moins un critère fixé par décret est présent ;
   - article R. 561-31 : la déclaration est écrite et établie au moyen d'un formulaire (I) ; mentions du III « à peine d'irrecevabilité » : profession et coordonnées du déclarant, cas de déclaration,
     identité du client et, le cas échéant, du bénéficiaire effectif avec l'objet et la nature de la relation d'affaires, descriptif de l'opération et éléments d'analyse, délai d'exécution si l'opération
     n'est pas encore réalisée (6° du III) ; le IV prévoit « toute pièce utile à son exploitation » ; une déclaration irrecevable est sans valeur et le déclarant perd l'exonération de responsabilité de l'article L. 561-22 ;
   - article L. 561-16 : déclaration avant l'exécution, sauf impossibilité de surseoir, report nuisible aux investigations ou soupçon apparu après l'opération ; alors « sans délai » ;
   - article L. 561-18 : interdiction de révéler l'existence ou le contenu de la déclaration au client ou à des tiers ; article L. 574-1 : sanction.
   Conventions de l'exercice, qui ne viennent d'aucun texte : (1) la fiche interne n'a pas de forme légale, ses rubriques reprennent les mentions de la déclaration ; (2) toutes les opérations d'un dossier de l'outil
   sont déjà inscrites au compte, donc exécutées ; (3) aucun dossier de l'outil ne relève de la fraude fiscale ; (4) les précisions libres doivent compter au moins 10 caractères. */
(function (root) {
  "use strict";

  var R = root && root.SGBF && root.SGBF.atyp ? root.SGBF.atyp : require("./rules_atypiques.js");

  var TEXTE_MIN = 10;

  var CAS = [
    { v: "I", lib: "Cas I : origine possiblement illicite des fonds, ou financement du terrorisme",
      aide: "Cas général (article L. 561-15 I) : sommes ou opérations dont l'organisme sait, soupçonne ou a de bonnes raisons de soupçonner qu'elles proviennent d'une infraction passible d'une peine privative de liberté supérieure à un an, ou qu'elles participent au financement du terrorisme. Il n'est pas nécessaire de qualifier l'infraction : il faut exposer les éléments d'analyse qui motivent le soupçon." },
    { v: "II", lib: "Cas II : fraude fiscale (au moins un critère fixé par décret)",
      aide: "Régime propre à la fraude fiscale (article L. 561-15 II) : la déclaration est due quand au moins un critère fixé par décret est présent. La fiche doit nommer le critère retenu, dans la liste de l'article D. 561-32-1." }
  ];
  var EXECUTION = [
    { v: "executees", lib: "Toutes les opérations signalées sont déjà exécutées",
      aide: "La déclaration est alors faite sans délai, après analyse (article L. 561-16, 2e alinéa)." },
    { v: "attente", lib: "Une opération signalée n'est pas encore exécutée",
      aide: "En principe la déclaration précède l'exécution, et la déclaration indique le délai d'exécution (6° du III de l'article R. 561-31)." }
  ];
  var BENEF = [
    { v: "client", lib: "Le client agit pour son propre compte",
      aide: "Rien dans le dossier ni dans l'échange ne laisse penser que les fonds appartiennent à une autre personne." },
    { v: "tiers", lib: "Le client semble agir pour le compte d'un tiers",
      aide: "Par exemple des fonds « confiés » par une autre personne : la déclaration indique l'identité du bénéficiaire effectif s'il y en a un." }
  ];
  var CHAMPS = ["cas", "critere", "ops", "exec", "benef", "tiers", "nondiv", "analyse"];

  function arrondi(x) { return Math.round(x * 100) / 100; }
  function opt(liste, v) { return liste.filter(function (x) { return x.v === v; })[0] || null; }
  function texte(x) { return typeof x === "string" ? x.trim() : ""; }
  var nfEur = typeof Intl !== "undefined" ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 2 }) : null;
  function eur(n) { return nfEur ? nfEur.format(n).replace("-", "−") : n + " €"; }
  function dateOp(op, now) { var d = new Date(now.getTime()); d.setDate(1); d.setMonth(d.getMonth() - op.mois); d.setDate(op.jour); return d; }
  function fmtDate(d) { return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }); }
  function libMois(mois, now) {
    var d = new Date(now.getTime()); d.setDate(1); d.setMonth(d.getMonth() - mois);
    return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  }
  function opDe(d, id) { return d.operations.filter(function (o) { return o.id === id; })[0] || null; }
  function lib(op) { return R.TYPES[op.type] ? R.TYPES[op.type] : op.libelle; }

  /* Fiche vierge : les opérations jugées atypiques par le conseiller sont déjà cochées (il peut les modifier). */
  function defaut(d, classement) {
    return { cas: "", critere: "", ops: d.operations.filter(function (o) { return classement && classement[o.id] === "atypique"; }).map(function (o) { return o.id; }),
      exec: "", benef: "", tiers: "", nondiv: false };
  }
  /* Remet une fiche relue du navigateur sous sa forme sûre : valeurs inconnues vidées, opérations inconnues retirées, sans doublon. */
  function normaliser(d, s) {
    s = s && typeof s === "object" ? s : {};
    var ops = [];
    (Array.isArray(s.ops) ? s.ops : []).forEach(function (id) { if (typeof id === "string" && opDe(d, id) && ops.indexOf(id) < 0) ops.push(id); });
    return {
      cas: opt(CAS, s.cas) ? s.cas : "", critere: typeof s.critere === "string" ? s.critere : "", ops: ops,
      exec: opt(EXECUTION, s.exec) ? s.exec : "", benef: opt(BENEF, s.benef) ? s.benef : "", tiers: typeof s.tiers === "string" ? s.tiers : "", nondiv: s.nondiv === true
    };
  }

  /* Les opérations signalées, de la plus ancienne à la plus récente. */
  function lignes(d, ids, now) {
    return d.operations.filter(function (o) { return ids.indexOf(o.id) >= 0; }).map(function (o) {
      var dt = dateOp(o, now), sens = R.sens(o);
      return { id: o.id, date: dt, dateTxt: fmtDate(dt), type: o.type, lib: lib(o), libelle: o.libelle, detail: o.detail || "", sens: sens, montant: o.montant };
    }).sort(function (a, b) { return a.date - b.date; });
  }
  function totaux(rows) {
    var cr = 0, de = 0;
    rows.forEach(function (r) { if (r.sens === "credit") cr += r.montant; else de += r.montant; });
    return { n: rows.length, credits: arrondi(cr), debits: arrondi(de), total: arrondi(cr + de), debut: rows.length ? rows[0].dateTxt : "", fin: rows.length ? rows[rows.length - 1].dateTxt : "" };
  }

  /* Ce que la fiche reprend du dossier : rien à saisir. */
  function faits(d, ctx) {
    var c = d.client, now = ctx.now, cum = R.cumulEspeces(d).filter(function (m) { return m.cosiDepots || m.cosiRetraits; });
    return {
      declarant: "Conseiller Clientèle Particuliers, agence de Paris, GS Banque & Assurance" + (ctx.nom ? " (" + ctx.nom + ")" : ""),
      date: fmtDate(now),
      client: c.civilite + " " + c.prenom + " " + c.nom + ", " + c.age + " ans, " + c.profession,
      situation: c.situation,
      compte: "Compte n° " + c.compte,
      relation: "Client depuis " + (c.ancienneteMois ? c.ancienneteMois + " mois" : c.ancienneteAns + " an" + (c.ancienneteAns > 1 ? "s" : "")) + " ; produits : " + c.produits.join(", ") + ". Revenus : " + eur(c.revenus) + " par mois (" + c.revenusNote + ").",
      patrimoine: c.patrimoine.join(" ; "),
      pieces: (ctx.pieces || []).map(function (id) { return R.libellePiece(id); }),
      recues: d.contact.recues.slice(),
      echange: d.contact.echange.slice(),
      cosi: cum.map(function (m) {
        var q = [];
        if (m.cosiDepots) q.push("dépôts d'espèces de " + eur(m.depots));
        if (m.cosiRetraits) q.push("retraits d'espèces de " + eur(m.retraits));
        return q.join(" et ") + " en " + libMois(m.mois, now);
      })
    };
  }

  /* Le contrôle de la fiche : mentions manquantes (qui empêchent de valider) et points d'attention (qui n'empêchent rien).
     ctx : { commentaire, classement (choix du conseiller : « habituelle » ou « atypique » par opération), now }. */
  function controle(d, saisie, ctx) {
    ctx = ctx || {};
    var s = normaliser(d, saisie), now = ctx.now || new Date(), er = [], pt = [];
    function E(champ, msg) { er.push({ champ: champ, msg: msg }); }
    if (!s.cas) E("cas", "Choisissez le cas de déclaration (I ou II) : la déclaration doit le mentionner.");
    else if (s.cas === "II" && texte(s.critere).length < TEXTE_MIN) E("critere", "Cas II : nommez le critère retenu (au moins " + TEXTE_MIN + " caractères).");
    if (!s.ops.length) E("ops", "Cochez au moins une opération à signaler.");
    if (!s.exec) E("exec", "Indiquez si les opérations signalées sont déjà exécutées.");
    else if (s.exec === "attente") E("exec", "Les opérations de ce dossier sont déjà inscrites au compte : elles sont exécutées. Il n'y a pas de délai d'exécution à indiquer.");
    if (!s.benef) E("benef", "Indiquez si le client agit pour son propre compte ou pour celui d'un tiers.");
    else if (s.benef === "tiers" && texte(s.tiers).length < TEXTE_MIN) E("tiers", "Précisez ce que le client a dit du tiers (au moins " + TEXTE_MIN + " caractères).");
    if (!s.nondiv) E("nondiv", "Confirmez que le client n'est pas informé du signalement (article L. 561-18).");
    if (!R.commentaireSuffisant(ctx.commentaire)) E("analyse", "Les éléments d'analyse manquent : rédigez votre commentaire (au moins " + R.COMMENTAIRE_MIN + " caractères).");

    var cl = ctx.classement || {};
    d.operations.forEach(function (o) {
      var dans = s.ops.indexOf(o.id) >= 0, nom = "l'opération du " + fmtDate(dateOp(o, now)) + " (" + eur(o.montant) + ")";
      if (dans && cl[o.id] === "habituelle") pt.push("Vous avez classé " + nom + " comme habituelle : elle figure pourtant dans la fiche.");
      if (!dans && cl[o.id] === "atypique") pt.push("Vous avez classé " + nom + " comme atypique : elle ne figure pas dans la fiche.");
    });
    if (s.cas === "II") pt.push("Le cas II suppose qu'un critère fixé par décret soit présent. Rien dans ce dossier n'évoque une fraude fiscale : relisez le cas retenu.");
    var rows = lignes(d, s.ops, now);
    return { ok: er.length === 0, erreurs: er, points: pt, saisie: s, now: now, rows: rows, totaux: totaux(rows) };
  }

  /* Correction, après validation du dossier : les opérations attendues dans la fiche sont celles que le dossier désigne comme atypiques. */
  function correction(d, saisie) {
    var s = normaliser(d, saisie), att = d.operations.filter(function (o) { return o.atypique; }).map(function (o) { return o.id; });
    var manquantes = att.filter(function (id) { return s.ops.indexOf(id) < 0; });
    var enTrop = s.ops.filter(function (id) { return att.indexOf(id) < 0; });
    return { attendues: att, manquantes: manquantes, enTrop: enTrop, opsOk: manquantes.length === 0 && enTrop.length === 0,
      casAttendu: "I", casOk: s.cas === "I", exec: s.exec === "executees", saisie: s };
  }

  /* Le texte de la fiche, pour l'impression du bilan et pour les tests. */
  function resume(d, saisie, ctx) {
    var c = controle(d, saisie, ctx), s = c.saisie, t = c.totaux, f = faits(d, ctx);
    var cas = opt(CAS, s.cas), ex = opt(EXECUTION, s.exec), be = opt(BENEF, s.benef);
    return [
      ["Signalé par", f.declarant], ["Date", f.date], ["Client", f.client], ["Cas de déclaration", cas ? cas.lib + (s.cas === "II" ? " – critère : " + texte(s.critere) : "") : "non choisi"],
      ["Opérations signalées", t.n + " opération" + (t.n > 1 ? "s" : "") + (t.n ? ", du " + t.debut + " au " + t.fin + ", pour " + eur(t.total) : "")],
      ["État d'exécution", ex ? ex.lib : "non indiqué"], ["Bénéficiaire effectif", be ? be.lib + (s.benef === "tiers" ? " : " + texte(s.tiers) : "") : "non indiqué"]
    ];
  }

  var api = {
    TEXTE_MIN: TEXTE_MIN, CAS: CAS, EXECUTION: EXECUTION, BENEF: BENEF, CHAMPS: CHAMPS,
    defaut: defaut, normaliser: normaliser, lignes: lignes, totaux: totaux, faits: faits, controle: controle, correction: correction, resume: resume,
    dateOp: dateOp, fmtDate: fmtDate, eur: eur
  };

  root.SGBF = root.SGBF || {};
  root.SGBF.signalement = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
