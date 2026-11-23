/* GS Banque & Assurance – catalogue de produits : nature des tarifs (fictifs ou réglementés), comparaison de produits, éligibilité d'un client à tous les produits.
   Les calculs d'éligibilité sont ceux de js/eligibilite.js ; ce module ne fait que les présenter. */
(function (root) {
  "use strict";

  var B = root && root.SGBF ? root.SGBF.banque : require("./banque.js");
  var PR = root && root.SGBF ? root.SGBF.produits : require("./produits.js");
  var E = root && root.SGBF ? root.SGBF.eligibilite : require("./eligibilite.js");
  var PL = root && root.SGBF ? root.SGBF.placements : require("./placements.js");
  /* Modules chargés à la demande (MIFID, contrats) : le catalogue sert aussi sur des pages qui n'en ont pas besoin. */
  function module_(nom) { return root && root.SGBF && root.SGBF[nom] ? root.SGBF[nom] : (typeof require === "function" ? require("./" + nom + ".js") : null); }

  /* Tarifs dont le montant est fixé ou plafonné par la réglementation (repères vérifiés, notes/reperes_reels.md) : taux des livrets réglementés,
     plafonds des frais d'incidents et des commissions d'intervention. Tout autre tarif de la banque est fictif. */
  var REGLEMENTES = {
    CPT: ["Commission d'intervention"], JEUNE: ["Commission d'intervention"], OCF: ["Frais d'incidents", "Commission d'intervention"],
    LA: ["Taux annuel"], LDDS: ["Taux annuel"], LEP: ["Taux annuel"]
  };
  var RE_LEGAL = /plafond légal|encadrée par la loi/;
  /* « reglemente » : montant réel imposé par la loi ; « fictif » : tarif imaginaire de la banque. */
  function natureTarif(p, t) {
    if ((REGLEMENTES[p.id] || []).indexOf(t.lib) >= 0 || RE_LEGAL.test(t.val)) return "reglemente";
    return "fictif";
  }
  var NATURES = { reglemente: "Réglementé", fictif: "Banque" };

  /* Moyens commerciaux : par quel moyen un contact a eu lieu et une vente a été réalisée. Le mailing est l'envoi d'e-mails de la messagerie ;
     les deux moyens d'entretien se distinguent par le lieu (à l'accueil de l'agence, ou lors d'un rendez-vous). */
  var MOYENS = { mail: "Mailing (e-mail)", appel: "Appel téléphonique", rdv: "Entretien en rendez-vous", accueil: "Entretien à l'accueil" };
  var ORDRE_MOYENS = ["mail", "appel", "rdv", "accueil"];

  var CMP_LIGNES = [
    { k: "cout", lib: "Coût" }, { k: "liquidite", lib: "Disponibilité des fonds" }, { k: "rendement", lib: "Rendement" }, { k: "risque", lib: "Risque" },
    { k: "fisc", lib: "Fiscalité" }, { k: "ticket", lib: "Dépôt ou montant minimum" }, { k: "plafond", lib: "Plafond" }
  ];
  /* Tableau comparatif : une ligne par critère, une valeur par produit (2 ou 3 produits). */
  function comparer(ids) {
    var l = ids.filter(function (i) { return PR.parId[i]; }).slice(0, 3), produits = l.map(function (i) { return PR.parId[i]; });
    var lignes = [{ lib: "Univers", vals: produits.map(function (p) { return PR.universDe(p).nom; }) }, { lib: "Pour qui", vals: produits.map(function (p) { return p.public; }) }];
    CMP_LIGNES.forEach(function (c) { lignes.push({ lib: c.lib, vals: produits.map(function (p) { return p.cmp[c.k]; }) }); });
    return { produits: produits, lignes: lignes };
  }

  /* Phrase de synthèse d'un verdict (justification lisible). */
  function pluriel(n, s, p) { return n + " " + (n > 1 ? p : s); }
  function phrase(ev) {
    if (ev.verdict === "detenu") return "Le client détient déjà ce produit chez GS Banque & Assurance.";
    if (ev.verdict === "non") return "Au moins une condition n'est pas remplie : " + ev.motifs.join(" ");
    if (ev.verdict === "examiner") return "Aucune condition n'est refusée, mais " + (ev.doutes.length > 1 ? "plusieurs points ne peuvent" : "un point ne peut") + " pas être tranché" + (ev.doutes.length > 1 ? "s" : "") + " avec le dossier : " + ev.doutes.join(" ");
    return "Toutes les conditions vérifiables dans le dossier sont remplies. Reste à vérifier avec le client les points listés ci-dessous.";
  }
  /* Raison courte, pour un tableau. */
  function pourquoi(ev) {
    if (ev.verdict === "detenu") return "Détient déjà ce produit chez GS.";
    if (ev.verdict === "non") return ev.motifs[0] + (ev.motifs.length > 1 ? " (+ " + pluriel(ev.motifs.length - 1, "autre condition", "autres conditions") + ")" : "");
    if (ev.verdict === "examiner") return ev.doutes[0] + (ev.doutes.length > 1 ? " (+ " + pluriel(ev.doutes.length - 1, "autre point", "autres points") + ")" : "");
    return "Conditions vérifiables remplies.";
  }
  /* Tous les produits, regroupés par univers, avec le verdict pour un client. */
  function parClient(c) {
    return PR.univers.map(function (f) {
      return { famille: f, items: PR.produits.filter(function (p) { return PR.universDe(p) === f; }).map(function (p) { var ev = E.evaluer(c, p.id); return { produit: p, ev: ev, pourquoi: pourquoi(ev) }; }) };
    });
  }
  function compterClient(c) {
    var r = { eligible: 0, examiner: 0, non: 0, detenu: 0 };
    PR.produits.forEach(function (p) { r[E.evaluer(c, p.id).verdict]++; });
    return r;
  }
  /* ---------- souscription (enregistrée dans le navigateur de l'élève, jamais dans les dossiers de la banque) ---------- */
  /* Versement initial minimum (conditions de la fiche produit) et plafond de dépôts réglementaire pour les produits qui en ont un. */
  var MONTANTS = {
    LA: { min: 10, max: PR.plafond.LA }, LDDS: { min: 10, max: PR.plafond.LDDS }, LEP: { min: 30, max: PR.plafond.LEP }, LJ: { min: 10, max: PR.plafond.LJ },
    LBR: { min: 100, max: null }, AV: { min: 500, max: null }, PEA: { min: 300, max: null }, PER: { min: 300, max: null },
    CAT: { min: PR.catMin, max: null }, AVP: { min: 30000, max: null }, AVE: { min: 100, max: null }, MGS: { min: 5000, max: null }, MGE: { min: 5000, max: null }, MGD: { min: 5000, max: null },
    PEAJ: { min: 300, max: 20000 }, PEAPME: { min: 500, max: 225000 }, CTO: { min: 300, max: null }, PSOC: { min: 11.4, max: 50000, pas: 11.4 }, AUTZ: { min: 30, max: null }
  };
  /* Libellés du montant saisi à la souscription (le « versement initial » n'a pas le même sens pour tous les produits). */
  var LIB_MONTANT = { AUTZ: "Versement programmé (en euros)", PSOC: "Montant des parts souscrites (en euros, multiple de 11,40 €)" };
  function e2(n) { return Math.abs(n - Math.round(n)) < 1e-9 ? B.eur(n) : B.eur2(n); }   /* euros, avec les centimes quand il y en a */
  function souscriptions(st) { return (st && Array.isArray(st.souscriptions)) ? st.souscriptions : []; }
  /* Le client a-t-il été contacté par ce moyen ? (un e-mail envoyé, un appel abouti, un entretien enregistré dans le CRE) : sert à avertir l'élève, sans le bloquer. */
  function contactParMoyen(st, cid, canal) {
    function l(k) { return (st && Array.isArray(st[k])) ? st[k] : []; }
    if (canal === "mail") return l("messages").some(function (m) { return m.c === cid; });
    if (canal === "appel") return l("appels").some(function (a) { return a.c === cid && a.res !== "nr"; });
    return l("contacts").some(function (x) { return x.c === cid && x.lieu === canal; });
  }
  function souscrit(st, cid, pid) { return souscriptions(st).filter(function (x) { return x.c === cid && x.p === pid; })[0] || null; }
  /* Verdict du moteur d'éligibilité, complété par les souscriptions de l'élève : un produit souscrit dans l'exercice est « déjà détenu ». */
  /* Dossier du client augmenté de ce que l'élève lui a fait souscrire : un produit souscrit compte comme détenu pour les règles des autres produits
     (mandat de gestion ⇒ assurance-vie souscrite avant ; parts sociales et AUTOMATIZ ⇒ compte-titres ou PEA ; carte de la convention ; un PEA Jeunes exclut un PEA…).
     Les crédits ne sont pas ajoutés : leur dossier de montage a déjà tenu compte de l'endettement. */
  function contexte(c, st) {
    var l = souscriptions(st).filter(function (x) { return x.c === c.id && PR.parId[x.p] && PR.parId[x.p].famille !== "credit"; });
    if (!l.length) return c;
    var x = Object.create(c);
    x.cartes = c.cartes.slice(); x.epa = c.epa.slice(); x.plc = c.plc.slice(); x.ass = c.ass.slice();  x.telecom = (c.telecom || []).slice(); x.convEnfants = (c.convEnfants || []).slice(); x.connect = !!c.connect; x.alertes = !!c.alertes;
    l.forEach(function (k) {
      var f = PR.parId[k.p].famille, h = { p: k.p, ouvert: 0, solde: k.montant || 0, uc: 0, prime: 0, enfant: k.options && k.options.enfant };
      if (f === "carte") x.cartes.push(h); else if (f === "epargne") x.epa.push(h); else if (f === "placement") x.plc.push(h); else if (f === "assurance") x.ass.push(h); else if (f === "mobile") x.telecom.push(h);
      else if (k.p === "GCON") x.connect = true;
      else if (k.p === "GALE") x.alertes = true;       /* GS Alertes : abonnement aux alertes par SMS */       /* GS Connect : abonnement de banque à distance */
      else if (f === "compte" && PR.parId[k.p].convention) { if (PR.parId[k.p].convention.mineur) x.convEnfants.push(k.options && k.options.enfant); else x.conv = k.p; }   /* la convention des 12-17 ans est celle de l'enfant : elle ne change pas la convention du client */
    });
    return x;
  }
  /* Client sous mesure de protection (protection.js) : pour une assurance-vie, un point de plus à confirmer avant de souscrire, en tête de liste (le protecteur intervient, la copie du jugement est au dossier). */
  function avecProtection(ev, c, pid) {
    var PT = module_("protection");
    if (!ev || !PT || !PT.concerne(c, pid) || (ev.verdict !== "eligible" && ev.verdict !== "examiner")) return ev;
    var o = Object.create(ev); o.aVerifier = [PT.confirmation(c, pid)].concat(ev.aVerifier); return o;
  }
  function verdictClient(c, pid, st) {
    var ev = E.evaluer(contexte(c, st), pid), s = souscrit(st, c.id, pid);
    if (s && ev.verdict !== "detenu" && pid !== "AVE" && pid !== "CVM" && pid !== "ESIM") { var o = Object.create(ev); o.verdict = "detenu"; o.libelle = E.VERDICTS.detenu; o.detenu = true; o.souscription = s; return o; }
    return avecProtection(ev, c, pid);
  }
  /* Points à confirmer avec le client avant de souscrire : les doutes du moteur, puis les conditions « à vérifier avec le client » de la fiche. */
  function aConfirmer(ev) { return ev.doutes.concat(ev.aVerifier); }
  /* Possibilité de souscrire pour ce client : { ok } ou { ok: false, raison: "detenu" | "non" | "credit" }. */
  function possibilite(ev, p) {
    if (p.famille === "credit" && !p.horsMontage) return { ok: false, raison: "credit" };
    if (ev.verdict === "detenu") return { ok: false, raison: "detenu" };
    if (ev.verdict === "non") return { ok: false, raison: "non" };
    if (p.horsMontage) return { ok: false, raison: "fiche" };   /* découvert autorisé, crédit renouvelable : fiche et éligibilité seulement, ni souscription ni Montage de prêt */
    /* Assurance avec questionnaire de santé (sante.js) : la ligne « Questionnaire de santé » de la fiche se remplit à la souscription, elle ne se coche plus. */
    var SA = module_("sante"), code = SA && SA.estQuestionne(p.id) ? p.id : null, conf = aConfirmer(ev);
    /* Contrat qui verse un capital au décès (assurance-vie, GS Décès, GS Obsèques) : la clause bénéficiaire se rédige à la souscription (beneficiaires.js). */
    var BE = module_("beneficiaires");
    return { ok: true, montant: MONTANTS[p.id] || null, confirmations: code ? conf.filter(function (t) { return !/^Questionnaire de santé/.test(t); }) : conf, sante: code, clause: !!(BE && BE.estConcerne(p.id)) };
  }
  function lireMontant(v) {
    var t = String(v == null ? "" : v).replace(/[\s\u00a0]/g, "").replace(",", ".");
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return NaN;
    return Math.round(parseFloat(t) * 100) / 100;
  }
  /* ---------- options de souscription propres à chaque produit ---------- */
  /* Descripteurs des champs à renseigner (durée du compte à terme, formule des assurances, enfant de l'assurance-vie enfant…) ; la fiche de souscription les affiche
     et la souscription les contrôle. Les prix viennent de produits.js (une seule source avec les fiches). */
  function libDuree(m) { return m < 12 ? m + " mois" : m % 12 ? m + " mois" : (m / 12) + (m === 12 ? " an" : " ans"); }
  function pct(n) { return String(n).replace(".", ",") + " %"; }
  function pct2(n) { return n.toFixed(2).replace(".", ",") + " €"; }
  var FORMULES = {
    MOTO: [{ v: "tiers", lib: "Au tiers" }, { v: "inter", lib: "Intermédiaire (tiers + vol, incendie, bris de glace)" }, { v: "tous", lib: "Tous risques" }],
    CCAR: [{ v: "tiers", lib: "Au tiers" }, { v: "etendu", lib: "Tiers étendu (vol, incendie, bris de glace, événements climatiques)" }, { v: "tous", lib: "Tous risques" }],
    VSP: [{ v: "tiers", lib: "Au tiers" }, { v: "tous", lib: "Tous risques" }],
    PJ: [{ v: "ess", lib: "Essentielle (plafond de 15 000 € par litige)" }, { v: "comp", lib: "Complète (plafond de 30 000 € par litige)" }],
    MPAY: [{ v: "banque", lib: "Moyens de paiement de la banque (2,00 € par mois)" }, { v: "multi", lib: "Moyens de paiement de plusieurs banques (2,50 € par mois)" }],
    GALE: [{ v: "alerte", lib: "Alerte de compte (1,50 € par mois)" }, { v: "complete", lib: "Alerte de compte et mini-relevé hebdomadaire (2,50 € par mois)" }],
    APN: [{ v: "ess", lib: "Essentielle (plafond de 600 € par téléphone, 1 000 € par tablette ou ordinateur portable)" }, { v: "plus", lib: "Plus (plafond de 900 € par téléphone, 1 500 € par tablette ou ordinateur portable ; valeur d'achat pendant 12 mois)" }]
  };
  var CYLINDREES = [{ v: "cyclo", lib: "Cyclomoteur (50 cm³ et moins)" }, { v: "c125", lib: "Scooter ou moto de 51 à 125 cm³" }, { v: "plus", lib: "Moto de plus de 125 cm³" }];
  function listeMontants(l) { return l.map(function (n) { return { v: String(n), lib: B.eur(n) }; }); }
  function descripteurs(pid, c, st) {
    var d = [];
    if (pid === "CAT") d.push({ k: "duree", lib: "Durée du placement", choix: Object.keys(PR.catTaux).map(Number).sort(function (a, b) { return a - b; }).map(function (m) { return { v: String(m), lib: libDuree(m) + " – taux fixe brut " + pct(PR.catTaux[m]) + " par an" }; }) });
    if (pid === "CVM") {
      var ctxm = contexte(c, st), libresm = E.enfantsJunior(c).filter(function (e) { return (ctxm.convEnfants || []).indexOf(e.prenom) < 0; });
      d.push({ k: "enfant", lib: "Enfant titulaire de la convention", choix: libresm.map(function (e) { return { v: e.prenom, lib: e.prenom + " (" + e.age + " ans)" }; }) });
    }
    if (pid === "AVE") {
      var ctx = contexte(c, st), libres = E.enfantsMineurs(c).filter(function (e) { return !ctx.plc.some(function (x) { return x.p === "AVE" && x.enfant === e.prenom; }); });
      d.push({ k: "enfant", lib: "Enfant titulaire du contrat", choix: libres.map(function (e) { return { v: e.prenom, lib: e.prenom + " (" + e.age + " ans)" }; }) });
    }
    if (pid === "AUTZ") {
      d.push({ k: "periodicite", lib: "Périodicité des versements", choix: [{ v: "mensuel", lib: "Mensuelle (à partir de 30 €)" }, { v: "trimestriel", lib: "Trimestrielle (à partir de 90 €)" }] });
      d.push({ k: "support", lib: "Fonds choisi", choix: PL.supports("AUTZ").map(function (x) { return { v: x.id, lib: x.nom + " – indicateur de risque " + x.sri + " sur 7" }; }) });
    }
    if (pid === "DEP") d.push({ k: "rente", lib: "Rente mensuelle garantie", choix: listeMontants(PR.rentesDependance) });
    if (pid === "DECES") d.push({ k: "capital", lib: "Capital garanti en cas de décès", choix: listeMontants(PR.capitauxDeces) });
    if (pid === "OBSQ") { d.push({ k: "capital", lib: "Capital destiné aux obsèques", choix: listeMontants(PR.capitauxObseques) }); d.push({ k: "mode", lib: "Paiement", choix: [{ v: "mensuel", lib: "Cotisation mensuelle viagère" }, { v: "unique", lib: "Versement unique à la souscription" }] }); }
    if (pid === "MOTO") d.push({ k: "cylindree", lib: "Deux-roues", choix: CYLINDREES });
    if (FORMULES[pid]) d.push({ k: "formule", lib: "Formule", choix: FORMULES[pid] });
    if (pid === "GALE") {
      d.push({ k: "heure", lib: "Heure d'envoi des SMS", choix: [{ v: "8", lib: "8 h" }, { v: "10", lib: "10 h" }, { v: "14", lib: "14 h" }, { v: "18", lib: "18 h" }] });
      d.push({ k: "seuilSolde", lib: "Alerte quand le solde passe sous", choix: [{ v: "0", lib: "0 € (compte à découvert)" }, { v: "100", lib: "100 €" }, { v: "250", lib: "250 €" }, { v: "500", lib: "500 €" }, { v: "1000", lib: "1 000 €" }] });
      d.push({ k: "seuilDebit", lib: "Alerte pour tout débit d'au moins", choix: [{ v: "50", lib: "50 €" }, { v: "100", lib: "100 €" }, { v: "200", lib: "200 €" }, { v: "500", lib: "500 €" }, { v: "1000", lib: "1 000 €" }] });
    }
    if (pid === "APN") d.push({ k: "usage", lib: "Usage des appareils", choix: [{ v: "prive", lib: "Usage privé uniquement" }, { v: "pro", lib: "Usage privé et professionnel (option : + " + pct2(PR.primes.APN.pro) + " par mois)" }] });
    if (PR.parId[pid] && PR.parId[pid].famille === "mobile") descripteursMobile(pid, c, st, d);
    return d;
  }
  /* ---------- mobile et internet ---------- */
  /* La remise de 3 € par mois sur le forfait suppose une box GS : détenue (ou souscrite dans l'exercice), ou prise en même temps dans le pack. */
  function avecBox(c, st, pid) { if (pid === "PACK") return true; var ctx = contexte(c, st); return E.detient(ctx, "BOX") || E.detient(ctx, "PACK"); }
  var UNITES_FORFAIT = { mini: "Mini : 5 Go en France, 5 Go en Europe et DOM", "50": "50 Go en 5G, dont 20 Go en Europe et DOM", "150": "150 Go en 5G, dont 25 Go en Europe et DOM", "250": "250 Go en 5G, dont 40 Go à l'international" };
  function descripteursMobile(pid, c, st, d) {
    var M = PR.mobile, box = avecBox(c, st, pid);
    function forfaits(sansMini) {
      return M.ordreForfaits.filter(function (k) { return !(sansMini && k === "mini"); }).map(function (k) {
        var mois = PR.mensualiteForfait(k, box);
        if (pid === "PACK") return { v: k, lib: UNITES_FORFAIT[k] + " – pack à " + e2(PR.abonnement("PACK", { forfait: k }).mois) + " par mois (box Optimal comprise, remise de " + e2(M.remiseBox) + " déduite)", court: UNITES_FORFAIT[k] };
        return { v: k, lib: UNITES_FORFAIT[k] + " – " + e2(mois) + " par mois" + (box && k !== "mini" ? " (remise box de " + e2(M.remiseBox) + " déduite)" : box ? " (tarif avec une box GS)" : ""), court: UNITES_FORFAIT[k] };
      });
    }
    if (pid === "MOB") d.push({ k: "forfait", lib: "Forfait mobile", choix: forfaits(false) });
    if (pid === "PACK") d.push({ k: "forfait", lib: "Forfait mobile du pack (avec la box Optimal)", choix: forfaits(true) });
    if (pid === "BOX") d.push({ k: "offre", lib: "Offre de box", choix: Object.keys(M.box).map(function (k) {
      var b = M.box[k]; return { v: k, lib: b.lib + " – " + b.wifi + " – " + e2(b.prix) + " par mois", court: b.lib + " – " + b.wifi + ", débit en réception : " + b.down };
    }) });
    if (pid === "ESIM") {
      d.push({ k: "zone", lib: "Destination", choix: M.esimZones.map(function (z) { return { v: z.v, lib: z.lib }; }) });
      d.push({ k: "volume", lib: "Volume de données", choix: M.esimVolumes.map(function (g) { return { v: String(g), lib: g + " Go (+ " + M.esimGo + " Go offert)" }; }) });
      d.push({ k: "duree", lib: "Durée de validité", choix: M.esimDurees.map(function (j) { return { v: String(j), lib: j + " jours" }; }) });
    }
  }
  /* Prime estimée d'après les options déjà choisies (null tant qu'elles sont incomplètes). */
  function primeEstimee(pid, c, o, st) {
    if (PR.parId[pid] && PR.parId[pid].famille === "mobile") return PR.abonnement(pid, o || {}, avecBox(c, st, pid));
    var oo = o || {};
    if (pid === "APN") { oo = Object.assign({}, oo, { remiseHabitation: E.detient(contexte(c, st), "MRH") }); }
    return PR.prime(pid, oo, c.age);
  }
  function libChoix(desc, v) { var x = desc.choix.filter(function (y) { return y.v === String(v); })[0]; return x ? (x.court || x.lib) : ""; }
  /* Options d'une souscription « Mobile et internet » : tarif calculé à la souscription et lignes du contrat (engagement, frais). */
  function resumeMobile(pid, c, st, res, resume) {
    var M = PR.mobile, ab = PR.abonnement(pid, res, avecBox(c, st, pid));
    if (pid === "ESIM") {
      res.volume = +res.volume; res.duree = +res.duree; res.prixUnique = ab.unique;
      resume.push(["Prix (payé une seule fois à l'achat)", e2(ab.unique)], ["Engagement", "Aucun"]);
      return;
    }
    res.cotisationMois = ab.mois; res.cotisationAn = ab.an; res.remiseBox = ab.remise;
    resume.push(["Mensualité", e2(ab.mois) + " par mois (" + e2(ab.an) + " par an)" + (ab.remise ? ", remise box de " + e2(ab.remise) + " par mois déduite" : "")]);
    if (pid === "MOB") resume.push(["Engagement", "Sans engagement"], ["Carte SIM", e2(M.sim) + ", facturée une fois"], ["Frais de résiliation", e2(M.resiliationMobile)]);
    if (pid === "BOX") resume.push(["Engagement", M.engagementBox + " mois"], ["Location de la box", "Incluse dans la mensualité"], ["Frais de mise en service", e2(M.miseEnService)], ["Frais de résiliation", e2(M.resiliationBox)]);
    if (pid === "PACK") resume.push(["Box comprise dans le pack", "Box " + M.box[PR.packBox].lib + " – " + M.box[PR.packBox].wifi + ", " + M.box[PR.packBox].down + " en réception"], ["Engagement", "Box : " + M.engagementBox + " mois ; forfait mobile : sans engagement"], ["Frais de mise en service de la box", e2(M.miseEnService)], ["Carte SIM", e2(M.sim) + ", facturée une fois"], ["Frais de résiliation", "Box : " + e2(M.resiliationBox) + " ; forfait : " + e2(M.resiliationMobile)]);
  }
  /* Panier de services d'une convention : le conseiller choisit, parmi les services inclus, ceux que le client prendra ; plus il en prend, plus la réduction (prix à l'unité moins cotisation) augmente.
     La carte de la convention est toujours délivrée : elle est toujours dans le panier. Sans choix (appel direct, ouverture de compte), tous les services sont pris. */
  var CLES_CARTES = ["VJEU", "VCLA", "VMIN"];
  function cleCarteConvention(cv) { var l = cv.services.filter(function (x) { return CLES_CARTES.indexOf(x.k) >= 0; })[0]; return l ? l.k : null; }
  function panierConvention(cv, c, services, compteDemande) {
    var cles = cv.services.filter(function (x) { return x.k !== "tenue"; }).map(function (x) { return x.k; }), fixe = cleCarteConvention(cv);
    var pris = Array.isArray(services) ? services.filter(function (k) { return cles.indexOf(k) >= 0; }) : cles.slice();
    if (fixe && pris.indexOf(fixe) < 0) pris.push(fixe);
    pris = cles.filter(function (k) { return pris.indexOf(k) >= 0; });
    /* compteDemande : compte que l'on ouvre en même temps que la convention (ouverture de compte) ; sinon, le compte du client */
    var compte = cv.mineur ? "CPT" : ((compteDemande || (c && c.cpt && c.cpt.p)) === "JEUNE" ? "JEUNE" : "CPT");
    /* Une convention regroupe au moins deux services (la carte et un autre) : avec un seul, ce n'est pas une offre groupée. */
    return { cles: pris, fixe: fixe, compte: compte, eco: PR.economieConvention(cv, pris, compte), minimum: MIN_SERVICES, ok: pris.length >= MIN_SERVICES };
  }
  var MIN_SERVICES = 2;
  var MSG_MIN_SERVICES = "Une convention regroupe au moins deux services : la carte de la convention et au moins un autre service. Ajoutez un service au panier.";
  /* Contrôle les options saisies (o = { clé: valeur }) et construit l'objet conservé dans la souscription, avec un résumé imprimé dans le contrat. */
  function validerOptions(pid, c, st, o) {
    var d = descripteurs(pid, c, st), res = {}, resume = [];
    o = o || {};
    for (var i = 0; i < d.length; i++) {
      var v = String(o[d[i].k] == null ? "" : o[d[i].k]);
      if (!d[i].choix.some(function (y) { return y.v === v; }) && d[i].k === "enfant" && d[i].choix.length && E.enfantsMineurs(c).some(function (e) { return e.prenom === v; })) return { ok: false, champ: "opt_enfant", erreur: v + " a déjà " + (pid === "CVM" ? "une convention" : "un contrat") + "." };
      if (!d[i].choix.some(function (y) { return y.v === v; })) return { ok: false, champ: "opt_" + d[i].k, erreur: d[i].k === "enfant" && !d[i].choix.length ? (pid === "CVM" ? "Tous les enfants de 12 à 17 ans du dossier ont déjà une convention." : "Tous les enfants mineurs du dossier ont déjà un contrat.") : "Renseignez : " + d[i].lib.charAt(0).toLowerCase() + d[i].lib.slice(1) + "." };
      res[d[i].k] = v;
      resume.push([d[i].lib, libChoix(d[i], v).replace(/ – taux fixe brut.*$/, "")]);
    }
    if (pid === "CVM") { var ej = E.enfantsJunior(c).filter(function (e) { return e.prenom === res.enfant; })[0]; res.enfantAge = ej ? ej.age : null; }
    if (pid === "CAT") { res.duree = +res.duree; res.taux = PR.catTaux[res.duree]; resume.push(["Taux fixe brut annuel garanti", pct(res.taux)]); }
    if (pid === "AUTZ") { res.support = res.support; }
    if (PR.parId[pid].famille === "mobile") { resumeMobile(pid, c, st, res, resume); res.resume = resume; return { ok: true, options: res }; }
    if (pid === "APN") {      /* remise du client qui a une assurance habitation GS (détenue ou souscrite dans l'exercice) */
      res.remiseHabitation = E.detient(contexte(c, st), "MRH");
      if (res.remiseHabitation) resume.push(["Remise assurance habitation GS", "− " + pct2(PR.primes.APN.remise[res.formule]) + " par mois"]);
    }
    var pr = PR.prime(pid, res, c.age);
    if (pr) {
      res.cotisationMois = pr.mois; res.cotisationAn = pr.an;
      if (pid === "OBSQ" && res.mode === "unique") { res.versementUnique = pr.unique; resume.push(["Versement unique", e2(pr.unique)]); }
      else resume.push(["Cotisation mensuelle", e2(pr.mois)]);
    }
    if (pid === "GALE") {
      res.seuilSolde = +res.seuilSolde; res.seuilDebit = +res.seuilDebit;
      resume.push(["Jours d'envoi", "Du mardi au samedi"], ["Engagement", "Aucun : résiliable à tout moment, sans frais"]);
    }
    if (pid === "GCON") {
      res.cotisationMois = PR.gconMois; res.cotisationAn = Math.round(PR.gconMois * 12 * 100) / 100;
      resume.push(["Abonnement mensuel", B.eur2(PR.gconMois) + " par mois (" + B.eur2(res.cotisationAn) + " par an), prélevés sur le compte courant"], ["Engagement", "Aucun : résiliable à tout moment, sans frais"]);
    }
    if (PR.parId[pid].convention) {
      var cv = PR.parId[pid].convention;
      res.cotisationMois = cv.cotisationMois; res.cotisationAn = cv.cotisationAn;
      resume.push(["Cotisation mensuelle de la convention", B.eur2(cv.cotisationMois) + " (" + B.eur2(cv.cotisationAn) + " par an), prélevée sur le compte courant" + (cv.mineur ? " du représentant légal" : "")]);
      resume.push(["Services compris dans la cotisation", cv.services.map(function (x) { return x.k === "tenue" ? "tenue de compte exonérée" : x.lib; }).join(" ; ")]);
      var pan = panierConvention(cv, c, o.services, o.compte);
      if (!pan.ok) return { ok: false, champ: "panier", erreur: MSG_MIN_SERVICES };
      res.services = pan.cles; res.economie = { unite: pan.eco.unite, cotisation: pan.eco.cotisation, economie: pan.eco.economie, pct: pan.eco.pct };
      if (cv.services.some(function (x) { return x.k === "tenue"; })) resume.push(["Tenue de compte", pan.compte === "JEUNE" ? "Gratuite avec le compte Jeune" : "Exonérée avec la convention (" + B.eur2(24) + " par an à l'unité)"]);
      var tous = cv.services.filter(function (x) { return x.k !== "tenue"; }), reste = tous.filter(function (x) { return pan.cles.indexOf(x.k) < 0; });
      resume.push(["Services pris par le client", pan.cles.map(function (k) { return tous.filter(function (x) { return x.k === k; })[0].lib; }).join(" ; ")]);
      if (reste.length) resume.push(["Services non retenus pour l'instant", reste.map(function (x) { return x.lib; }).join(" ; ") + ". Ils restent compris dans la cotisation : le client peut les demander à tout moment, sans changer le prix de la convention."]);
      resume.push(
        ["Prix à l'unité de ces services", B.eur2(pan.eco.unite) + " par an"],
        ["Réduction obtenue avec la convention", pan.eco.economie > 0 ? B.eur2(pan.eco.economie) + " par an (" + pan.eco.pct + " % de moins)" : "Aucune réduction avec ces seuls services : la convention coûte " + B.eur2(-pan.eco.economie) + " de plus par an qu'à l'unité"]);
    }
    res.resume = resume;
    return { ok: true, options: res };
  }
  /* ---------- identité du client et remise des cartes et chéquiers ----------
     Une vente faite en face à face (rendez-vous ou accueil) suppose un contrôle d'identité : pièce officielle en cours de validité avec photographie. Une carte bancaire n'est jamais remise depuis un stock : elle est commandée (fabriquée), puis le client vient la retirer à l'agence ou la reçoit à domicile en recommandé (avec frais).
     Seul le chéquier de dépannage se remet tout de suite, depuis le stock de l'agence (client présent) ; sinon le chéquier se commande comme la carte. Ces valeurs (stock de départ, frais, délais) sont inventées ;
     operations_service.js les reprend pour les opérations de service : une seule source. */
  var PRESENTIEL = { rdv: true, accueil: true };
  function presentiel(canal) { return !!PRESENTIEL[canal]; }
  var STOCK = { chequier: 30 };                                              /* stock de départ de l'agence : chéquiers de dépannage uniquement (les cartes sont toujours commandées) */
  var CHEQUIER_STOCK_NB = 10;                                                /* un chéquier de dépannage compte 10 formules */
  var FRAIS_ENVOI = { carte: 7, chequier: 5.5 };                             /* envoi à domicile en recommandé */
  var PIECES_ID = [{ v: "cni", lib: "Carte nationale d'identité" }, { v: "passeport", lib: "Passeport" }, { v: "sejour", lib: "Titre de séjour" }, { v: "permis", lib: "Permis de conduire" }];
  /* Article du stock pris par une opération de service préparée ou exécutée. */
  function articleOperation(op) {
    var v = op.v || {};
    return op.type === "commande_chequier" ? "chequier" : op.type === "opposition_carte" ? v.carte : op.type === "montee_gamme" ? v.vers : null;
  }
  /* Stock restant d'un article : le stock de départ moins les opérations de service et les chéquiers d'ouvertures de compte déjà remis depuis le stock (une opération ou une souscription annulée rend le sien). */
  function stockRestant(st, article) {
    var n = STOCK[article];
    if (n == null) return 0;
    ((st && st.operations) || []).forEach(function (o) { if (o.statut !== "annulee" && o.v && o.v.remise === "stock" && articleOperation(o) === article) n--; });
    ((st && st.souscriptions) || []).forEach(function (x) {
      if (x.remise === "stock" && x.p === article) n--;
      if (article === "chequier" && x.options && x.options.remiseCheque === "stock") n--;
    });
    return Math.max(0, n);
  }
  function remisesCarte(st, pid, canal) {
    /* Une carte est toujours commandée : retrait à l'agence ou envoi à domicile. */
    return [{ v: "agence", lib: "Carte commandée – à retirer à l'agence sous 5 à 7 jours ouvrés – gratuit" },
      { v: "domicile", lib: "Carte commandée – envoyée à domicile en recommandé sous 7 à 9 jours ouvrés – " + e2(FRAIS_ENVOI.carte) }];
  }
  function remisesChequier(st, canal) {
    var o = [], rest = stockRestant(st, "chequier");
    if (presentiel(canal) && rest > 0) o.push({ v: "stock", lib: "Remise immédiate en main propre – chéquier de dépannage de " + CHEQUIER_STOCK_NB + " formules (" + rest + " en stock) – gratuit" });
    o.push({ v: "agence", lib: "Commande – retrait en main propre à l'agence sous 5 jours ouvrés – gratuit" });
    o.push({ v: "domicile", lib: "Commande – envoi à domicile en recommandé sous 5 jours ouvrés – " + e2(FRAIS_ENVOI.chequier) });
    return o;
  }
  function libRemise(mode, article) {
    var chq = article === "chequier";
    return mode === "stock" && chq ? "remise immédiate en main propre (chéquier de dépannage de " + CHEQUIER_STOCK_NB + " formules, stock de l'agence)"
      : mode === "domicile" ? (chq ? "envoi à domicile en recommandé sous 5 jours ouvrés – " + e2(FRAIS_ENVOI.chequier) : "carte commandée, envoyée à domicile en recommandé sous 7 à 9 jours ouvrés – " + e2(FRAIS_ENVOI.carte))
      : (chq ? "à retirer en main propre à l'agence sous 5 jours ouvrés" : "carte commandée, à retirer à l'agence sous 5 à 7 jours ouvrés");
  }
  /* Contrôle de la remise d'une carte ou d'un chéquier : { ok, mode, resume, frais } ou { ok: false, champ, erreur }. */
  function controleRemise(st, article, canal, mode, champ) {
    champ = champ || "remise";
    var chq = article === "chequier", l = chq ? remisesChequier(st, canal) : remisesCarte(st, article, canal), quoi = chq ? "du chéquier" : "de la carte";
    if (!mode) return { ok: false, champ: champ, erreur: chq ? "Choisissez le mode de remise du chéquier : remise immédiate depuis le stock (client présent), retrait en main propre à l'agence ou envoi à domicile avec frais." : "Choisissez le mode de remise de la carte : elle est commandée, puis retirée à l'agence ou envoyée à domicile avec frais." };
    if (["stock", "agence", "domicile"].indexOf(mode) < 0) return { ok: false, champ: champ, erreur: "Mode de remise " + quoi + " inconnu." };
    if (!l.some(function (x) { return x.v === mode; })) return { ok: false, champ: champ, erreur: !chq ? "Une carte n'est jamais remise depuis un stock : elle est commandée, puis retirée à l'agence ou envoyée à domicile." : !presentiel(canal) ? "La remise immédiate suppose que le client soit présent à l'agence : choisissez le retrait en main propre ou l'envoi à domicile." : "Le stock de l'agence est épuisé pour les chéquiers de dépannage : commandez le chéquier." };
    return { ok: true, mode: mode, frais: mode === "domicile" ? (chq ? FRAIS_ENVOI.chequier : FRAIS_ENVOI.carte) : 0, resume: [[chq ? "Remise du chéquier" : "Carte bancaire", libRemise(mode, article)]] };
  }
  /* Contrôle d'identité d'une vente en face à face : { ok, resume, identite } ; sans objet quand la vente se fait à distance (mailing, appel). */
  function controleIdentite(canal, o) {
    if (!presentiel(canal)) return { ok: true, resume: [], identite: null };
    var v = String(o.idverif == null ? "" : o.idverif);
    if (v === "") return { ok: false, champ: "idverif", erreur: "Indiquez si l'identité du client a été vérifiée : aucune vente en face à face ne se fait sans contrôle d'identité." };
    if (v !== "oui") return { ok: false, champ: "idverif", erreur: "Identité non vérifiée : la souscription est impossible. Demandez au client une pièce officielle en cours de validité avec photographie (carte d'identité, passeport, titre de séjour ou permis de conduire), comparez la photographie et la signature, puis répondez « Oui »." };
    var pc = PIECES_ID.filter(function (x) { return x.v === o.idpiece; })[0];
    if (!pc) return { ok: false, champ: "idpiece", erreur: "Choisissez la pièce d'identité présentée par le client." };
    return { ok: true, resume: [["Identité du client contrôlée", "Oui – " + pc.lib]], identite: { piece: pc.v } };
  }
  /* Carte que cette souscription remet au client : la carte elle-même, ou la carte incluse dans une convention de compte quand le client n'a aucune carte de paiement. */
  function carteDeConvention(st, c, convention) {
    var cv = PR.parId[convention] && PR.parId[convention].convention;
    if (!cv || !cv.carte) return null;        /* la convention des 12-17 ans n'ajoute pas de carte au client : la carte est celle de l'enfant */
    var ctx = contexte(c, st);
    if (ctx.cartes.some(function (x) { return E.CARTES_PAIEMENT.indexOf(x.p) >= 0; })) return null;
    var ev = verdictClient(c, cv.carte, st);
    /* La carte Jeune n'est accessible qu'avec le compte Jeune ou la convention Avenir : avant la souscription de la convention, son verdict est « non » sans que cela empêche de la délivrer. */
    if (ev.verdict === "detenu" || (ev.verdict === "non" && convention !== "CVJ")) return null;
    return cv.carte;
  }
  function carteLivree(st, c, pid) {
    var p = PR.parId[pid];
    if (!p) return null;
    return p.famille === "carte" ? pid : carteDeConvention(st, c, pid);
  }
  /* Identité puis remise, avec ce que la souscription en conserve. */
  function controleAccueil(st, c, pid, canal, o) {
    var id = controleIdentite(canal, o); if (!id.ok) return id;
    var carte = carteLivree(st, c, pid), rem = null;
    if (carte) { rem = controleRemise(st, carte, canal, o.remise); if (!rem.ok) return rem; }
    return { ok: true, identite: id.identite, resumeId: id.resume, carte: carte, remise: rem };
  }

  /* Carte incluse dans une convention de compte : délivrée avec la convention quand le client n'a aucune carte de paiement. */
  function carteConvention(st, c, convention, canal, acc) {
    var cv = PR.parId[convention] && PR.parId[convention].convention, carte = carteDeConvention(st, c, convention);
    if (!cv || !carte) return null;
    var op = { debit: "immediat", parConvention: convention, resume: [["Carte incluse dans la convention", PR.parId[convention].nom]] };
    if (acc && acc.remise) { op.remise = acc.remise.mode; if (acc.remise.frais) op.fraisEnvoi = acc.remise.frais; op.resume = op.resume.concat(acc.remise.resume); }
    if (acc && acc.identite) { op.identite = acc.identite; op.resume = op.resume.concat(acc.resumeId); }
    return enregistrer(st, c, cv.carte, null, canal, "Carte incluse dans la convention de compte.", null, op);
  }

  /* Enregistre la souscription. o = { montant, confirmees (nombre de points cochés), note }. Renvoie { ok, souscription } ou { ok: false, erreur }. */
  function souscrire(st, c, pid, o) {
    var p = PR.parId[pid];
    if (!c || !p) return { ok: false, erreur: "Client ou produit inconnu." };
    var ev = verdictClient(c, pid, st), pos = possibilite(ev, p);
    if (!pos.ok) return { ok: false, erreur: pos.raison === "credit" ? "Un crédit se monte dans l'outil « Montage de prêt »." : pos.raison === "fiche" ? (p.motifFiche || "Ce produit n'est pas souscrit dans l'outil : la fiche et l'éligibilité servent à le présenter au client, et sa mise en place passe par un contrat de crédit signé avec lui.") : pos.raison === "detenu" ? "Le client détient déjà ce produit." : "Le client n'est pas éligible à ce produit : " + ev.motifs.join(" ") };
    if ((o.confirmees | 0) < pos.confirmations.length) return { ok: false, erreur: pos.confirmations.length === 1 ? "Confirmez le point à vérifier avec le client avant de souscrire." : "Confirmez chacun des " + pos.confirmations.length + " points à vérifier avec le client avant de souscrire." };
    /* Questionnaire de santé : toutes les questions ont une réponse et la décision est « accepté ». Les réponses ne sont pas conservées, seulement la décision. */
    var sante = null, SA = pos.sante ? module_("sante") : null;
    if (SA) {
      var es = SA.evaluer(pos.sante, o.sante || {});
      if (!es.complet) return { ok: false, champ: "sante", erreur: es.erreurs.mesure || "Répondez à chacune des " + SA.questionnaire(pos.sante).questions.length + " questions du questionnaire de santé avant de souscrire." };
      if (es.verdict !== "accepte") return { ok: false, champ: "sante", erreur: SA.libelle(es.verdict) + " : " + SA.phrase(pos.sante, es.verdict) };
      sante = { date: B.ymd(B.ouvrePrecedent(B.aujourdhui())), verdict: es.verdict };
    }
    var options = null, vo = validerOptions(pid, c, st, o.options || {});
    if (!vo.ok) return vo;
    if (vo.options.resume.length || Object.keys(vo.options).length > 1) options = vo.options;
    var montant = null;
    if (pos.montant) {
      var mini = pos.montant.min, libM = pid === "AUTZ" ? "Le versement programmé" : pid === "PSOC" ? "La souscription" : "Le versement initial";
      if (pid === "AUTZ" && vo.options.periodicite === "trimestriel") mini = 90;
      montant = lireMontant(o.montant);
      if (isNaN(montant)) return { ok: false, champ: "montant", erreur: "Saisissez le montant en euros, par exemple 500 ou 250,50." };
      if (montant < mini - 1e-9) return { ok: false, champ: "montant", erreur: libM + " doit être d'au moins " + e2(mini) + (pid === "AUTZ" ? (vo.options.periodicite === "trimestriel" ? " par trimestre." : " par mois.") : ".") };
      if (pos.montant.max && montant > pos.montant.max) return { ok: false, champ: "montant", erreur: (pid === "PEAJ" ? "Le plafond de versements du PEA Jeunes" : pid === "PEAPME" ? "Le plafond de versements du PEA-PME-ETI" : "Le plafond de ce produit") + " est de " + e2(pos.montant.max) + "." };
      if (pos.montant.pas) {
        var nb = montant / pos.montant.pas;
        if (Math.abs(nb - Math.round(nb)) > 1e-6) return { ok: false, champ: "montant", erreur: "Le montant doit correspondre à un nombre entier de parts de " + e2(pos.montant.pas) + " (par exemple " + e2(Math.round(pos.montant.pas * 10 * 100) / 100) + " pour 10 parts)." };
        options = options || {}; options.parts = Math.round(nb); options.resume = (options.resume || []).concat([["Nombre de parts", String(Math.round(nb)) + " à " + e2(pos.montant.pas)]]);
      }
      if (pid === "AUTZ") options.resume.push(["Versement programmé", e2(montant) + (vo.options.periodicite === "trimestriel" ? " par trimestre" : " par mois")]);
    }
    var note = String(o.note || "").trim();
    if (note.length > 300) return { ok: false, erreur: "La remarque est limitée à 300 caractères." };
    var canal = String(o.canal || "");
    if (!MOYENS[canal]) return { ok: false, champ: "canal", erreur: "Indiquez le moyen par lequel la vente a été réalisée : mailing, appel, entretien en rendez-vous ou entretien à l'accueil." };
    var acc = controleAccueil(st, c, pid, canal, o);     /* identité (vente en face à face), puis remise de la carte */
    if (!acc.ok) return acc;
    /* Produit boursier (assurance-vie, PEA, PER) : le questionnaire profil investisseur doit avoir donné lieu à un rapport de conseil mis à disposition du client (valable 30 jours),
       établi pour ce client, ce produit et le même moyen ; le versement ne peut pas dépasser le montant annoncé dans le questionnaire. */
    var MI = module_("mifid"), rapport = null;
    if (MI && MI.estBoursier(pid)) {
      var rp = MI.rapport(st, o.rapport);
      if (!rp) return { ok: false, champ: "rapport", erreur: "Produit boursier : remplissez d'abord le questionnaire profil investisseur (MIFID) et mettez le rapport de conseil à disposition du client." };
      var ut = MI.utilisable(st, rp, c.id, pid, B.aujourdhui());
      if (!ut.ok) return { ok: false, champ: "rapport", erreur: { autre: "Ce rapport de conseil n'est pas celui de ce client et de ce produit.", non_dispo: "Le rapport de conseil n'est pas encore mis à disposition du client : mettez-le à disposition avant la souscription.", utilise: "Ce rapport de conseil a déjà servi à une souscription : refaites le questionnaire.", perime: "Le rapport de conseil a plus de " + MI.VALIDITE_RAPPORT + " jours : refaites le questionnaire.", non_adapte: "Le contrat n'est pas adapté au profil du client : proposez un produit adapté ou faites confirmer qu'il maintient sa demande à son initiative." }[ut.raison] || "Rapport de conseil inutilisable." };
      if (canal !== rp.canal) return { ok: false, champ: "canal", erreur: "Le conseil a été donné par « " + MOYENS[rp.canal].toLowerCase() + " » : la vente se fait par le même moyen. Pour un autre moyen, refaites le questionnaire." };
      if (pid === "AUTZ" && !rp.maintien && rp.conseil.verdict === "adapte") {
        var fonds = PL.supports("AUTZ").filter(function (x) { return x.id === vo.options.support; })[0];
        if (fonds && fonds.risque > rp.conseil.support.risque) return { ok: false, champ: "opt_support", erreur: "Le fonds choisi est plus risqué (indicateur " + fonds.sri + " sur 7) que le support adapté au profil du client (« " + rp.conseil.support.nom + " »). Choisissez un fonds moins risqué ou refaites le questionnaire." };
      }
      if (montant !== null && montant > rp.montant + 0.005) return { ok: false, champ: "montant", erreur: "Le versement initial dépasse le montant du questionnaire (" + B.eur(rp.montant) + ") : le conseil ne vaut que pour ce montant. Refaites le questionnaire pour un montant plus élevé." };
      rapport = rp;
    }
    /* Clause bénéficiaire (assurance-vie, GS Décès, GS Obsèques) : le bénéficiaire de premier rang et, au besoin, celui « à défaut » ; la clause rédigée est conservée avec la souscription. */
    var clause = null, BE = pos.clause ? module_("beneficiaires") : null;
    if (BE) {
      var vc = BE.valider(pid, c, o.clause || {});
      if (!vc.ok) return { ok: false, champ: vc.champ, erreur: vc.erreur };
      clause = vc.clause;
    }
    /* Ce que la vente conserve de l'identité et de la remise : lignes du contrat et, pour une carte, mode de remise (le stock se décompte sur la souscription de la carte). */
    var ajout = (acc.identite ? acc.resumeId : []).concat(acc.remise ? (p.famille === "carte" ? acc.remise.resume : [["Remise de la carte incluse dans la convention", libRemise(acc.remise.mode, acc.carte)]]) : []);
    if (ajout.length || acc.identite) {
      options = options || { resume: [] };
      options.resume = (options.resume || []).concat(ajout);
      if (acc.identite) options.identite = acc.identite;
      if (acc.remise && p.famille === "carte") { options.remise = acc.remise.mode; if (acc.remise.frais) options.fraisEnvoi = acc.remise.frais; }
    }
    if (clause) {
      options = options || { resume: [] };
      options.resume = (options.resume || []).concat([["Clause bénéficiaire", clause.texte]]);
      options.clause = clause;
    }
    var PT = module_("protection");
    if (PT && PT.concerne(c, pid)) {
      options = options || { resume: [] };
      options.resume = (options.resume || []).concat([PT.mention(c, pid)]);
      options.protection = PT.mesure(c).regime;
    }
    if (sante) {
      options = options || { resume: [] };
      options.resume = (options.resume || []).concat([["Questionnaire de santé", "Rempli avec le client le " + B.fmtDate(B.lireYmd(sante.date)) + " : accepté aux conditions standard"]]);
      options.sante = sante;
    }
    var r = enregistrer(st, c, pid, montant, canal, note, rapport, options);
    if (r.ok && PR.parId[pid].convention) { var cr = carteConvention(st, c, pid, canal, acc); if (cr && cr.ok) r.carte = cr.souscription; }
    return r;
  }
  /* Crée et enregistre la souscription (contrat compris). */
  function enregistrer(st, c, pid, montant, canal, note, rapport, options) {
    var now = B.maintenant();
    /* Convention de l'exercice : comme les ventes du portefeuille, un contrat est daté du jour ouvré d'ouverture (la veille ouvrée si l'on est un week-end ou un jour férié). */
    var s = { id: "s" + now.getTime().toString(36) + Math.random().toString(36).slice(2, 6), c: c.id, p: pid, date: B.ymd(B.ouvrePrecedent(B.aujourdhui())), heure: B.hhmm(now), montant: montant, canal: canal, note: note, par: (st.eleve && st.eleve.nom) || "" };
    if (rapport) s.rapport = rapport.id;
    if (options) s.options = options;
    if (options && options.identite) s.identite = options.identite.piece;                                   /* pièce d'identité contrôlée (vente en face à face) */
    if (options && options.remise && PR.parId[pid].famille === "carte") { s.remise = options.remise; if (options.fraisEnvoi) s.fraisEnvoi = options.fraisEnvoi; }   /* mode de remise d'une carte ; le stock et le relevé s'en servent */     /* services de la convention de compte, type de débit de la carte, dossier d'ouverture */
    var CT = module_("contrats");
    if (CT) s.contrat = CT.nouveau(s);     /* signature électronique à distance, ou contrat à imprimer en agence : voir contrats.js */
    if (!Array.isArray(st.souscriptions)) st.souscriptions = [];
    st.souscriptions.push(s);
    if (s.fraisEnvoi || (s.options && s.options.fraisChequier)) { var MV = module_("mouvements"); if (MV && MV.viderCache) MV.viderCache(); }     /* les frais d'envoi s'ajoutent au relevé du client */
    return { ok: true, souscription: s };
  }
  /* Compte ouvert par le dossier d'ouverture de compte (prospects.js) : le dossier validé par la directrice a déjà tenu lieu de contrôle d'éligibilité. o = { canal, note, options }. */
  function souscrireCompte(st, c, pid, o) {
    var p = PR.parId[pid];
    if (!c || !p || p.famille !== "compte") return { ok: false, erreur: "Client ou compte inconnu." };
    if (!MOYENS[String(o.canal || "")]) return { ok: false, champ: "canal", erreur: "Indiquez le moyen par lequel le compte est ouvert." };
    var opts = o.options || null;
    if (opts && opts.cheque) {      /* chéquier demandé à l'ouverture : mode de remise (stock, agence ou domicile avec frais) */
      var rc = controleRemise(st, "chequier", o.canal, opts.remiseCheque, "remiseCheque"); if (!rc.ok) return rc;
      opts.remiseCheque = rc.mode; if (rc.frais) opts.fraisChequier = rc.frais; else delete opts.fraisChequier;
      opts.resume = (opts.resume || []).concat(rc.resume);
    }
    return enregistrer(st, c, pid, null, o.canal, String(o.note || "").slice(0, 300), null, opts);
  }
  /* Carte demandée en même temps que le compte : le moteur d'éligibilité s'applique (une carte déjà détenue ou refusée par ses conditions n'est pas souscrite). o = { canal, note, options }. */
  function souscrireEquipement(st, c, pid, o) {
    var p = PR.parId[pid];
    if (!c || !p || p.famille !== "carte") return { ok: false, erreur: "Client ou carte inconnu." };
    if (!MOYENS[String(o.canal || "")]) return { ok: false, champ: "canal", erreur: "Indiquez le moyen par lequel la carte est souscrite." };
    var ev = verdictClient(c, pid, st);
    if (ev.verdict === "detenu") return { ok: false, erreur: "Le client détient déjà " + p.nom + "." };
    if (ev.verdict === "non") return { ok: false, erreur: p.nom + " : " + ev.motifs.join(" ") };
    var opts = {}, k, src = o.options || {};
    for (k in src) opts[k] = src[k];
    if (!o.parOperation) {      /* carte demandée à l'ouverture d'un compte : remise (stock, agence ou domicile avec frais). Une opération de service (montée en gamme) a déjà contrôlé et décompté la sienne. */
      var rem = controleRemise(st, pid, o.canal, o.remise); if (!rem.ok) return rem;
      opts.remise = rem.mode; if (rem.frais) opts.fraisEnvoi = rem.frais;
      opts.resume = (opts.resume || []).concat(rem.resume);
    }
    return enregistrer(st, c, pid, null, o.canal, String(o.note || "").slice(0, 300), null, opts);
  }
  /* Crédit accordé dans l'outil « Montage de prêt » : enregistre la souscription du crédit (montant = capital emprunté). o = { montant, canal, note, dossier }.
     Même règles que les autres produits (client non éligible ou détenant déjà le crédit : refus), mais sans versement initial ni points à confirmer : le dossier de montage les a traités. */
  function souscrireCredit(st, c, pid, o) {
    var p = PR.parId[pid];
    if (!c || !p || p.famille !== "credit") return { ok: false, erreur: "Client ou crédit inconnu." };
    var PTC = module_("protection"), refus = PTC ? PTC.refusCredit(c) : null;
    if (refus) return { ok: false, champ: "protection", erreur: refus };   /* client sous mesure de protection : le crédit n'est pas enregistré dans l'exercice */
    var ev = verdictClient(c, pid, st);
    if (ev.verdict === "detenu") return { ok: false, erreur: "Le client détient déjà ce crédit." };
    if (ev.verdict === "non") return { ok: false, erreur: "Le client n'est pas éligible à ce crédit : " + ev.motifs.join(" ") };
    if (!(o.montant > 0)) return { ok: false, erreur: "Le montant du crédit est invalide." };
    if (!MOYENS[String(o.canal || "")]) return { ok: false, champ: "canal", erreur: "Indiquez le moyen par lequel la vente a été réalisée : mailing, appel, entretien en rendez-vous ou entretien à l'accueil." };
    var now = B.maintenant();
    var s = { id: "s" + now.getTime().toString(36) + Math.random().toString(36).slice(2, 6), c: c.id, p: pid, date: B.ymd(B.ouvrePrecedent(B.aujourdhui())), heure: B.hhmm(now), montant: Math.round(o.montant * 100) / 100, canal: o.canal, note: String(o.note || "").slice(0, 300), par: (st.eleve && st.eleve.nom) || "", dossier: o.dossier || null };
    if (!Array.isArray(st.souscriptions)) st.souscriptions = [];
    st.souscriptions.push(s);
    return { ok: true, souscription: s };
  }
  function annulerSouscription(st, id) {
    var n = souscriptions(st).length, cible = souscriptions(st).filter(function (x) { return x.id === id; })[0];
    st.souscriptions = souscriptions(st).filter(function (x) { return x.id !== id && !(cible && PR.parId[cible.p] && PR.parId[cible.p].convention && x.c === cible.c && x.options && x.options.parConvention === cible.p); });
    var MV = module_("mouvements"); if (MV && MV.viderCache) MV.viderCache();
    return st.souscriptions.length < n;
  }

  /* ---------- tous les produits pour un client, et nombre de clients par verdict ---------- */
  function parClient(c, st) {
    return PR.univers.map(function (f) {
      return { famille: f, items: PR.produits.filter(function (p) { return PR.universDe(p) === f; }).map(function (p) { var ev = verdictClient(c, p.id, st); return { produit: p, ev: ev, pourquoi: pourquoi(ev), possible: possibilite(ev, p) }; }) };
    });
  }
  function compterClient(c, st) {
    var r = { eligible: 0, examiner: 0, non: 0, detenu: 0 };
    PR.produits.forEach(function (p) { r[verdictClient(c, p.id, st).verdict]++; });
    return r;
  }
  var cacheCompte = {};
  function compterProduit(clients, id, st) {
    var cle = B.ymd(B.aujourdhui()) + "|" + id + "|" + clients.length;
    if (!cacheCompte[cle]) cacheCompte[cle] = E.compter(clients, id);
    var r = Object.assign({}, cacheCompte[cle]);
    var vus = {};
    souscriptions(st).forEach(function (s) {
      if (s.p !== id || vus[s.c]) return;
      vus[s.c] = true;
      var c = clients.filter(function (x) { return x.id === s.c; })[0];
      if (!c) return;
      var v = E.evaluer(c, id).verdict;
      if (v !== "detenu") { r[v]--; r.detenu++; }
    });
    return r;
  }
  function viderCache() { cacheCompte = {}; }

  /* Produits qu'on ne présente pas dans une démarche de vente (e-mail de présentation, campagne commerciale) : les crédits (ils se montent dans « Montage de prêt »)
     et l'offre clientèle fragile (la banque la propose aux clients qu'elle repère comme fragiles financièrement, elle ne la prospecte pas). Ils restent dans le catalogue et peuvent être souscrits. */
  var HORS_PROSPECTION = {
    OCF: "L'offre clientèle fragile n'est pas un produit qu'on vend : la banque la propose aux clients qu'elle repère comme fragiles financièrement.",
    DAC: "La convention de droit au compte n'est pas un produit qu'on vend : elle s'applique à la personne que la Banque de France a désignée pour lui ouvrir un compte."
  };
  function prospectionPossible(p) { return !!p && p.famille !== "credit" && !Object.prototype.hasOwnProperty.call(HORS_PROSPECTION, p.id); }
  /* Pourquoi ce produit ne se présente pas en prospection ("" s'il le peut). */
  function raisonHorsProspection(p) {
    if (!p || prospectionPossible(p)) return "";
    return p.horsMontage ? (p.motifProspection || "Ce produit n'est pas proposé dans une campagne ni dans un appel : la fiche sert à le présenter au client en entretien.") : p.famille === "credit" ? "Un crédit ne se présente pas ici : il se monte dans « Montage de prêt »." : HORS_PROSPECTION[p.id];
  }

  var api = { contexte: contexte, panierConvention: panierConvention, MIN_SERVICES: MIN_SERVICES, MSG_MIN_SERVICES: MSG_MIN_SERVICES, cleCarteConvention: cleCarteConvention, descripteurs: descripteurs, validerOptions: validerOptions, primeEstimee: primeEstimee, carteConvention: carteConvention, carteLivree: carteLivree, controleRemise: controleRemise, controleIdentite: controleIdentite, remisesCarte: remisesCarte, remisesChequier: remisesChequier, libRemise: libRemise, stockRestant: stockRestant, presentiel: presentiel, STOCK: STOCK, CHEQUIER_STOCK_NB: CHEQUIER_STOCK_NB, FRAIS_ENVOI: FRAIS_ENVOI, PIECES_ID: PIECES_ID, articleOperation: articleOperation, LIB_MONTANT: LIB_MONTANT, FORMULES: FORMULES, CYLINDREES: CYLINDREES, souscrireCompte: souscrireCompte, souscrireEquipement: souscrireEquipement, REGLEMENTES: REGLEMENTES, NATURES: NATURES, MOYENS: MOYENS, ORDRE_MOYENS: ORDRE_MOYENS, contactParMoyen: contactParMoyen, CMP_LIGNES: CMP_LIGNES, MONTANTS: MONTANTS, natureTarif: natureTarif, comparer: comparer, phrase: phrase, pourquoi: pourquoi,
    souscriptions: souscriptions, souscrit: souscrit, verdictClient: verdictClient, aConfirmer: aConfirmer, possibilite: possibilite, lireMontant: lireMontant, souscrire: souscrire, souscrireCredit: souscrireCredit, annulerSouscription: annulerSouscription,
    parClient: parClient, compterClient: compterClient, compterProduit: compterProduit, viderCache: viderCache,
    HORS_PROSPECTION: HORS_PROSPECTION, prospectionPossible: prospectionPossible, raisonHorsProspection: raisonHorsProspection };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.catalogue = api; }
})(typeof window !== "undefined" ? window : null);
