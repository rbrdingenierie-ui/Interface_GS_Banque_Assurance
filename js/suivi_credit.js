/* GS Banque & Assurance – suivi d'un crédit en cours : remboursement anticipé, renégociation du taux, rachat d'un prêt immobilier détenu dans une autre banque, regroupement de crédits,
   modulation ou report de mensualité. Les calculs partent des crédits de la fiche du client (capital restant dû, mensualité, échéances restantes : mêmes chiffres que l'onglet Crédits de la
   fiche client) et utilisent le moteur du simulateur de prêt (pret.js : intérêts mensuels arrondis au centime, taux en millièmes de point).
   Règles reprises (textes consultés le 17 novembre 2026) :
     – Crédit immobilier, remboursement anticipé : l'emprunteur peut toujours rembourser en partie ou en totalité ; le contrat peut refuser un remboursement partiel égal ou inférieur à 10 % du
       capital initial, sauf pour solder (Code de la consommation, article L313-47). Indemnité au plus égale à six mois d'intérêts sur le capital remboursé, au taux moyen du prêt, et à 3 % du
       capital restant dû avant le remboursement (article R313-25 ; service-public.gouv.fr, fiche F1669). Aucune indemnité si le remboursement fait suite à la vente du logement motivée par un
       changement du lieu de travail, la cessation forcée de l'activité professionnelle (licenciement notamment) ou le décès de l'emprunteur ou de son conjoint (article L313-48).
     – Crédit à la consommation, remboursement anticipé : droit de rembourser en tout ou partie (article L312-34) ; indemnité au plus égale à 1 % du montant remboursé s'il reste plus d'un an
       avant la fin du contrat, 0,5 % sinon, jamais supérieure aux intérêts qui auraient été payés jusqu'au terme ; due seulement si les remboursements anticipés dépassent 10 000 € sur douze mois
       (article D312-15). À partir du 20 novembre 2026, pour les contrats dont l'offre est émise à partir de cette date (ordonnance n° 2025-880 du 3 septembre 2025, article 99 pour les contrats
       en cours), la réduction du coût total est proportionnelle à la durée restante et tient compte de tous les frais imposés par le prêteur (frais de dossier payés d'avance compris).
     – Regroupement de crédits : si les crédits immobiliers pèsent au moins 60 % du montant total de l'opération, celle-ci relève du crédit immobilier ; sinon du crédit à la consommation
       (Code de la consommation, article R314-18, création du décret n° 2016-884 du 29 juin 2016).
     – Repères du métier pour juger d'une renégociation (Pretto, « Quand renégocier son prêt immobilier ? », mise à jour du 13 novembre 2026) : écart de taux d'au moins 0,7 à 1 point, capital restant
       dû d'au moins 70 000 €, économies supérieures aux coûts. Frais d'avenant : de 150 à 1 000 € ou de 0,5 % à 3 % du capital restant dû selon la banque (Cafpi, mise à jour du 27 mai 2024).
     – Modulation et report d'échéances : une clause du contrat de prêt, dont les limites sont fixées par la banque (La finance pour tous, mise à jour du 8 avril 2025) ; pendant un report, les intérêts
       continuent de courir et s'ajoutent au capital.
   Conventions de l'exercice (NON tirées d'un texte, à ne pas présenter comme la loi) : GS applique l'indemnité maximale prévue par la loi ; frais d'avenant de 0,5 % du capital restant dû
   (150 € au moins, 1 000 € au plus), payés à la signature ; frais de dossier et de garantie du nouveau prêt = ceux du catalogue et du montage de prêt, financés dans le nouveau prêt ; modulation
   de 20 % au plus, après douze échéances payées, au plus une aménagement par crédit à la fois ; report de 1 à 12 mois ; durée totale d'un prêt immobilier limitée à 25 ans ; la cotisation
   d'assurance emprunteur reste due pendant un report et cesse au remboursement total ; pour un remboursement partiel, la cotisation (calculée sur le capital initial) est maintenue.
   Ce module est pur (aucun accès à la page) : les fonctions de calcul ne modifient ni la fiche du client ni la sauvegarde ; creer() et decider() travaillent sur st.suivis.
   Un montant d'euros s'écrit à la française (« 12 000 » ou « 12000,50 »). Tous les calculs internes sont en centimes entiers. */
(function (root) {
  "use strict";

  var R0 = root && root.SGBF ? root.SGBF : null;
  function mod(nom, fichier) { return R0 && R0[nom] ? R0[nom] : require("./" + fichier); }
  var B = mod("banque", "banque.js"), P = mod("pret", "pret.js"), EL = mod("eligibilite", "eligibilite.js"), MT = mod("montage", "montage.js");

  /* ---------- règles ---------- */
  var REFORME = "2026-11-20";                                              /* entrée en vigueur de la réforme du crédit à la consommation (ordonnance 2025-880) */
  var CONSO = { taux: 1, tauxCourt: 0.5, seuil: 10000 };                   /* L312-34 et D312-15 : 1 % (0,5 % s'il reste un an ou moins) ; au-delà de 10 000 € sur douze mois */
  var IMMO = { moisInterets: 6, crdPct: 3, partielPct: 10 };               /* L313-47, R313-25 */
  var SEUIL_REGROUPEMENT = 60;                                             /* R314-18 : part des crédits immobiliers, en % du montant total de l'opération */
  var REPERES = { ecart: 0.7, crd: 70000 };                                /* reperes du métier (Pretto) : écart de taux en points, capital restant dû en euros */
  var AVENANT = { pct: 0.5, min: 150, max: 1000 };                         /* convention GS, dans les fourchettes de Cafpi (150 à 1 000 € ; 0,5 % à 3 %) */
  var AMENAGEMENT = { apres: 12, pctMax: 20, reportMax: 12, dureeMax: 300 }; /* convention GS : échéances payées avant l'aménagement, modulation maximale en %, report maximal en mois, durée totale maximale */
  var DUREE_NOUVEAU = { min: 12, max: 300 };                               /* durée d'un nouveau prêt immobilier : de 1 à 25 ans (catalogue) */
  var EXONERATIONS = [
    ["mutation", "Vente du logement suite à un changement du lieu d'activité professionnelle de l'emprunteur ou de son conjoint"],
    ["cessation", "Vente du logement suite à la cessation forcée de l'activité professionnelle de l'emprunteur ou de son conjoint (licenciement notamment)"],
    ["deces", "Vente du logement suite au décès de l'emprunteur ou de son conjoint"]
  ];
  var OPERATIONS = [
    ["remboursement", "Remboursement anticipé"],
    ["renegociation", "Renégociation du taux"],
    ["rachat", "Rachat d'un prêt détenu dans une autre banque"],
    ["regroupement", "Regroupement de crédits"],
    ["modulation", "Modulation de la mensualité"],
    ["report", "Report de mensualités"]
  ];
  var LIVRETS = ["LA", "LDDS", "LEP", "LJ", "LBR"];

  function lib(liste, k) { var x = liste.filter(function (y) { return y[0] === k; })[0]; return x ? x[1] : ""; }
  function cents(x) { return Math.round(x * 100 + (x >= 0 ? 1e-9 : -1e-9)); }
  function eu(c) { return c / 100; }
  function r2(n) { return Math.round(n * 100 + (n >= 0 ? 1e-9 : -1e-9)) / 100; }
  function E(champ, msg) { return { champ: champ, msg: msg }; }
  function eur(n) { return B.eur2(n); }
  function pct(n) { return P.pctTaux(n); }
  function pl(n, s, p) { return n + " " + (n > 1 ? p : s); }
  function ko(erreurs) { return { ok: false, erreurs: erreurs }; }
  function nomProduit(id) { var p = P.produitPret(id); return p ? p.nom : id; }

  /* ---------- situation d'un crédit à une date ---------- */
  /* Intérêts, nombre d'échéances et dernière échéance d'un capital Cc (centimes) remboursé par mensualités Mc (centimes) à un taux nominal annuel (%). nMax : nombre d'échéances imposé (la dernière solde).
     Renvoie null si la mensualité ne couvre pas les intérêts. */
  function plan(Cc, taux, Mc, nMax) {
    var tm = Math.round(taux * 1000), crd = Cc, k = 0, ints = 0, it, limite = nMax || 720;
    if (Cc <= 0) return { n: 0, interets: 0, derniere: 0, total: 0 };
    while (k < limite) {
      k++; it = P.interet(crd, tm); ints += it;
      if (crd + it <= Mc || k === nMax) return { n: k, interets: ints, derniere: crd + it, total: (k - 1) * Mc + crd + it };
      if (Mc - it <= 0) return null;
      crd = crd + it - Mc;
    }
    return null;
  }
  function k0(x) { return B.indexMois(B.dateJours(x.ouvert)) + 1; }
  function dateEcheance(x, rang) { return B.ymd(B.dateDuMois(k0(x) + rang - 1, x.jEch)); }  /* rang 1 = première échéance du contrat */
  /* Fin d'un nouveau prêt de n mensualités mis en place à la date auj (première échéance un mois plus tard, même quantième). */
  function finNouveau(n, auj) { return B.ymd(B.dateDuMois(B.indexMois(auj) + n, auj.getDate())); }

  function situation(x, auj) {
    auj = auj || B.aujourdhui();
    var payees = B.echeancesPayees(x, auj), reste = Math.max(0, x.dur - payees), crd = B.crdAu(x, auj), crdC = cents(crd), mensC = cents(x.mens);
    var pl0 = reste > 0 ? plan(crdC, x.taux, mensC, reste) : { n: 0, interets: 0, derniere: 0, total: 0 };
    if (!pl0) pl0 = { n: reste, interets: Math.max(0, reste * mensC - crdC), derniere: mensC, total: reste * mensC };
    return {
      x: x, produit: x.p, nom: nomProduit(x.p), ext: x.ext || "", immo: x.p === "CIMMO", payees: payees, reste: reste, crd: crd, crdC: crdC, mens: x.mens, mensC: mensC, assM: x.assM || 0, taux: x.taux,
      prochaine: reste > 0 ? dateEcheance(x, payees + 1) : null, fin: dateEcheance(x, x.dur), interets: eu(pl0.interets), interetsC: pl0.interets, assurance: r2((x.assM || 0) * reste),
      dateOuverture: B.ymd(B.dateJours(x.ouvert)), apres20nov: B.ymd(B.dateJours(x.ouvert)) >= REFORME
    };
  }
  function situations(c, auj) { return c.cre.map(function (x, i) { var s = situation(x, auj); s.k = i; return s; }); }

  function etatPlan(s) { return { capital: s.crd, mensualite: s.mens, assurance: s.assM, reste: s.reste, fin: s.fin, interets: s.interets, taux: s.taux, coutAssurance: s.assurance }; }
  function etatNouveau(capC, taux, mensC, n, interetsC, finYmd, assM, dernierC) {
    return { capital: eu(capC), mensualite: eu(mensC), assurance: assM || 0, reste: n, fin: finYmd, interets: eu(interetsC), taux: taux, coutAssurance: r2((assM || 0) * n), derniere: eu(dernierC || mensC) };
  }

  /* ---------- lecture des saisies ---------- */
  function lireMontant(t) {
    var n = P.lireNombre(t);
    if (isNaN(n)) return NaN;
    return Math.abs(n * 100 - Math.round(n * 100)) < 1e-6 ? n : NaN;
  }
  function lireEntier(t) {
    var s = String(t == null ? "" : t).replace(/\s/g, "");
    return /^\d+$/.test(s) ? parseInt(s, 10) : NaN;
  }
  function lireTaux(t) {
    var n = P.lireNombre(t);
    if (isNaN(n)) return NaN;
    return Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-6 ? n : NaN;
  }

  /* ---------- indemnités de remboursement anticipé ---------- */
  /* Prêt immobilier : plus petit des deux plafonds (six mois d'intérêts sur le capital remboursé au taux du prêt ; 3 % du capital restant dû), nulle dans les cas de l'article L313-48. */
  function iraImmo(s, rembourse, motif) {
    var semestre = r2(rembourse * s.taux / 100 * IMMO.moisInterets / 12), plafond = r2(s.crd * IMMO.crdPct / 100);
    var exo = motif ? lib(EXONERATIONS, motif) : "";
    return { montant: exo ? 0 : Math.min(semestre, plafond), semestre: semestre, plafond: plafond, retenu: semestre <= plafond ? "semestre" : "plafond", exoneration: exo, motif: motif || "" };
  }
  /* Crédit à la consommation : 1 % (0,5 % s'il reste un an ou moins avant la fin du contrat) du montant remboursé, si les remboursements des douze derniers mois dépassent 10 000 € ; au plus les
     intérêts qui auraient été payés jusqu'au terme (interetsEco). */
  function plusUnAn(auj) { return B.ymd(new Date(auj.getFullYear() + 1, auj.getMonth(), auj.getDate())); }
  function iraConso(s, rembourse, deja, interetsEco, auj) {
    var cumul = r2(deja + rembourse), due = cumul > CONSO.seuil, longue = s.fin > plusUnAn(auj), taux = longue ? CONSO.taux : CONSO.tauxCourt, brut = r2(rembourse * taux / 100);
    return { montant: due ? Math.min(brut, Math.max(0, interetsEco)) : 0, due: due, cumul: cumul, seuil: CONSO.seuil, taux: taux, brut: brut, plafondInterets: Math.max(0, interetsEco), plusUnAn: longue };
  }
  /* Régime applicable à un crédit à la consommation selon la date de l'offre (la date d'ouverture tient lieu de date d'offre dans les dossiers de l'agence). */
  function regimeConso(s) {
    return s.apres20nov
      ? "Contrat conclu à partir du 20 novembre 2026 : la réduction du coût total du crédit est proportionnelle à la durée restante et tient compte de tous les frais imposés par le prêteur, frais de dossier payés d'avance compris (article L312-34 dans sa rédaction issue de l'ordonnance n° 2025-880)."
      : "Contrat conclu avant le 20 novembre 2026 : article L312-34 dans sa rédaction applicable aux contrats en cours à cette date ; les intérêts et frais correspondant à la durée restant à courir ne sont pas dus (ordonnance n° 2025-880, article 99).";
  }

  /* ---------- aides communes ---------- */
  function epargneDispo(c) { return r2((c.epa || []).filter(function (e) { return LIVRETS.indexOf(e.p) >= 0; }).reduce(function (t, e) { return t + (e.solde || 0); }, 0)); }
  /* Taux d'endettement du foyer (mensualités de crédit, assurance comprise) avant et après une opération qui retire des crédits (indices dans c.cre) et ajoute une mensualité. */
  function endettement(c, retirer, ajout, auj) {
    var foyer = c.pro && c.pro.foyer ? c.pro.foyer : 0, avant = EL.mensualites(c), retire = 0;
    (retirer || []).forEach(function (i) { var x = c.cre[i]; if (x && B.echeancesPayees(x, auj) < x.dur) retire += x.mens + (x.assM || 0); });
    var apres = r2(Math.max(0, avant - retire) + (ajout || 0));
    return { foyer: foyer, avant: r2(avant), apres: apres, tauxAvant: foyer ? 100 * avant / foyer : null, tauxApres: foyer ? 100 * apres / foyer : null, seuil: EL.HCSF_TAUX };
  }
  function alerteEndettement(d, immo, prefixe) {
    if (!d.foyer) return { n: "info", interne: true, t: "Les revenus du foyer ne sont pas renseignés : le taux d'endettement ne peut pas être calculé." };
    var base = prefixe + "taux d'endettement du client : " + pct(d.tauxAvant) + " avant, " + pct(d.tauxApres) + " après l'opération (mensualités de crédit, assurance comprise, rapportées aux revenus du foyer de " + eur(d.foyer) + " par mois)";
    if (immo && d.tauxApres > d.seuil) return { n: "attention", interne: true, t: base + ", au-dessus de la limite de " + d.seuil + " % fixée par le HCSF pour un crédit immobilier." };
    return { n: "info", interne: true, t: base + (immo ? ", sous la limite de " + d.seuil + " % fixée par le HCSF pour un crédit immobilier." : ".") };
  }
  function usureControle(taux, dureeMois) {
    var p = P.produitPret("CIMMO"), u = P.usurePour(p, dureeMois);
    if (!u) return { ok: true };
    return { ok: taux < u.taux, usure: u.taux, lib: u.lib, trimestre: p.usure.trimestre };
  }
  function tauxCatalogueImmo(dureeMois) {
    var g = P.tauxCatalogue("CIMMO", dureeMois);
    if (g) return g;
    var gr = P.produitPret("CIMMO").grille;
    return dureeMois > gr[gr.length - 1].mois ? null : gr[0];
  }
  function verdictGain(gain, repOk) {
    if (gain <= 0) return { code: "peu_interessant", libelle: "Peu intéressant : le coût de l'opération n'est pas couvert par l'économie." };
    return repOk ? { code: "interessant", libelle: "Intéressant : l'économie dépasse les coûts, et les reperes du métier sont atteints." } : { code: "a_etudier", libelle: "À étudier : l'économie dépasse les coûts, mais un repère du métier n'est pas atteint." };
  }
  function reperesRenego(s, ecartPoints) {
    return [
      { ok: ecartPoints >= REPERES.ecart - 1e-9, lib: "Écart de taux d'au moins " + String(REPERES.ecart).replace(".", ",") + " point", detail: "Écart : " + String(Math.round(ecartPoints * 1000) / 1000).replace(".", ",") + " point" + (ecartPoints >= 2 ? "s" : "") + "." },
      { ok: s.crd >= REPERES.crd, lib: "Capital restant dû d'au moins " + eur(REPERES.crd), detail: "Capital restant dû : " + eur(s.crd) + "." }
    ];
  }

  /* ========== remboursement anticipé ========== */
  /* o : { mode: "partiel" | "total", montant, effet: "duree" | "mensualite", motif (prêt immobilier : "", "mutation", "cessation", "deces"), deja (crédit à la consommation : remboursements anticipés
     déjà faits sur les douze derniers mois, en euros) }. */
  function rembourser(c, k, o, auj) {
    auj = auj || B.aujourdhui(); o = o || {};
    var x = c.cre[k], err = [];
    if (!x) return ko([E("credit", "Choisissez le crédit.")]);
    var s = situation(x, auj), total = o.mode === "total", montant, deja = 0;
    if (s.ext) return ko([E("credit", "Ce crédit est détenu dans une autre banque : seule la banque prêteuse peut le rembourser. Pour le reprendre à GS, utilisez le rachat de prêt.")]);
    if (s.reste < 1) return ko([E("credit", "Ce crédit est déjà soldé : il ne reste aucune échéance.")]);
    if (o.mode !== "total" && o.mode !== "partiel") err.push(E("mode", "Choisissez un remboursement partiel ou total."));
    if (!total && o.mode === "partiel") {
      montant = lireMontant(o.montant);
      if (isNaN(montant) || montant <= 0) err.push(E("montant", "Saisissez le montant remboursé, en euros (par exemple 12 000 ou 12 000,50)."));
      else if (cents(montant) >= s.crdC) err.push(E("montant", "Le montant doit être inférieur au capital restant dû (" + eur(s.crd) + "). Pour solder le crédit, choisissez le remboursement total."));
      else if (s.immo && cents(montant) <= Math.round(x.cap * IMMO.partielPct)) err.push(E("montant", "Le contrat de prêt immobilier de GS refuse un remboursement partiel égal ou inférieur à " + IMMO.partielPct + " % du capital emprunté (" + eur(x.cap * IMMO.partielPct / 100) + "), sauf pour solder le prêt (article L313-47)."));
      if (o.effet !== "duree" && o.effet !== "mensualite") err.push(E("effet", "Choisissez l'effet du remboursement partiel : raccourcir la durée ou baisser la mensualité."));
    }
    if (total) montant = s.crd;
    if (s.immo) { if (o.motif && !lib(EXONERATIONS, o.motif)) err.push(E("motif", "Motif du remboursement inconnu.")); }
    else if (o.deja !== undefined && o.deja !== "") {
      deja = lireMontant(o.deja);
      if (isNaN(deja)) err.push(E("deja", "Saisissez le montant déjà remboursé par anticipation sur les douze derniers mois (0 s'il n'y en a pas)."));
    }
    if (err.length) return ko(err);
    var mC = cents(montant), reste2C = s.crdC - mC, ap, regles = [], alertes = [], ira, avant = etatPlan(s), M;
    var interetsEco;
    if (total) ap = etatNouveau(0, s.taux, 0, 0, 0, null, 0, 0);
    else if (o.effet === "duree") {
      var p1 = plan(reste2C, s.taux, s.mensC);
      ap = etatNouveau(reste2C, s.taux, s.mensC, p1.n, p1.interets, dateEcheance(x, s.payees + p1.n), s.assM, p1.derniere);
    } else {
      M = cents(P.paiement(eu(reste2C), s.taux, s.reste));
      var p2 = plan(reste2C, s.taux, M, s.reste);
      ap = etatNouveau(reste2C, s.taux, M, s.reste, p2.interets, s.fin, s.assM, p2.derniere);
    }
    interetsEco = r2(avant.interets - ap.interets);
    if (s.immo) {
      ira = iraImmo(s, montant, o.motif);
      regles.push("Prêt immobilier (articles L313-47 et R313-25 du Code de la consommation) : l'indemnité ne peut dépasser le plus petit de deux plafonds, six mois d'intérêts sur le capital remboursé au taux du prêt (" + eur(montant) + " × " + pct(s.taux) + " ÷ 2 = " + eur(ira.semestre) + ") et 3 % du capital restant dû avant le remboursement (" + eur(s.crd) + " × 3 % = " + eur(ira.plafond) + "). Plafond retenu : " + (ira.retenu === "semestre" ? "six mois d'intérêts" : "3 % du capital restant dû") + ".");
      if (ira.exoneration) regles.push("Aucune indemnité (article L313-48) : " + ira.exoneration.charAt(0).toLowerCase() + ira.exoneration.slice(1) + ". Le remboursement doit suivre la vente du logement ; le justificatif (acte de vente, avis de décès, attestation de l'employeur) est à demander au client.");
      if (!total) regles.push("Le contrat de GS refuse un remboursement partiel égal ou inférieur à " + IMMO.partielPct + " % du capital emprunté (" + eur(x.cap * IMMO.partielPct / 100) + ") : le montant demandé le dépasse (article L313-47).");
    } else {
      ira = iraConso(s, montant, deja, interetsEco, auj);
      regles.push("Crédit à la consommation (article L312-34 du Code de la consommation, article D312-15) : une indemnité n'est due que si les remboursements anticipés dépassent " + eur(CONSO.seuil) + " sur douze mois. Ici : " + eur(deja) + " déjà remboursés + " + eur(montant) + " = " + eur(ira.cumul) + (ira.due ? ", au-delà du seuil." : ", le seuil n'est pas dépassé : aucune indemnité."));
      if (ira.due) regles.push("Indemnité plafonnée à " + String(ira.taux).replace(".", ",") + " % du montant remboursé (" + (ira.plusUnAn ? "il reste plus d'un an avant la fin du contrat" : "il reste un an ou moins avant la fin du contrat") + ") soit " + eur(ira.brut) + ", et aux intérêts qui auraient été payés jusqu'au terme (" + eur(ira.plafondInterets) + ") : l'indemnité est de " + eur(ira.montant) + ".");
      regles.push(regimeConso(s));
    }
    var frais = [{ cle: "ira", lib: "Indemnité de remboursement anticipé", montant: ira.montant }], totalFrais = ira.montant;
    var assEco = r2(avant.coutAssurance - ap.coutAssurance), gain = r2(interetsEco + assEco - totalFrais);
    if (total) { regles.push("Remboursement total : le crédit est soldé, le contrat d'assurance emprunteur prend fin" + (s.assM ? " (cotisation de " + eur(s.assM) + " par mois en moins)" : "") + (s.immo ? " et la garantie (caution, hypothèque ou privilège de prêteur de deniers) doit être levée : mainlevée, frais à prévoir selon la garantie." : ".")); }
    else regles.push("Remboursement partiel : " + (o.effet === "duree" ? "la mensualité reste " + eur(s.mens) + " et la durée se raccourcit" : "la durée reste la même et la mensualité baisse") + " ; la cotisation d'assurance emprunteur (calculée sur le capital initial) est maintenue.");
    regles.push("Convention de calcul : le remboursement est calculé sur le capital restant dû du jour, sans les intérêts courus depuis la dernière échéance, que le décompte de gestion du crédit ajoute.");
    var ep = epargneDispo(c);
    alertes.push({ n: "info", interne: true, t: "Le client détient " + eur(ep) + " sur ses livrets à GS. Avant de rembourser, vérifier qu'il garde une épargne de précaution et l'origine des fonds" + (montant > ep ? " (le montant dépasse l'épargne détenue à GS)" : "") + "." });
    if (gain <= 0) alertes.push({ n: "attention", t: "Après indemnité, le remboursement ne fait pas économiser d'argent : " + (ira.montant > 0 ? "l'indemnité (" + eur(ira.montant) + ") absorbe l'économie d'intérêts." : "l'économie est nulle.") });
    var dt = endettement(c, total ? [k] : [], total ? 0 : 0, auj);
    var mensApres = total ? 0 : (ap.mensualite - s.mens);
    var dApres = { foyer: dt.foyer, avant: dt.avant, apres: r2(dt.apres + mensApres), tauxAvant: dt.tauxAvant, tauxApres: dt.foyer ? 100 * (dt.apres + mensApres) / dt.foyer : null, seuil: dt.seuil };
    if (total || o.effet === "mensualite") alertes.push(alerteEndettement(dApres, false, "Après l'opération, "));
    return {
      ok: true, op: "remboursement", titre: lib(OPERATIONS, "remboursement") + (total ? " total" : " partiel"), credits: [k], mode: total ? "total" : "partiel", effet: total ? "" : o.effet, motif: o.motif || "", montant: montant, deja: deja,
      avant: avant, apres: ap, frais: frais, totalFrais: totalFrais, interetsEco: interetsEco, assuranceEco: assEco, gain: gain, ira: ira, regles: regles, alertes: alertes, endettement: dApres,
      verdict: gain > 0 ? { code: "interessant", libelle: "Économie nette de " + eur(gain) + " (intérêts" + (assEco ? " et assurance" : "") + " évités, indemnité déduite)." } : { code: "peu_interessant", libelle: "Aucune économie nette : l'indemnité compense l'intérêt évité." },
      reperes: [], date: B.ymd(auj)
    };
  }

  /* ========== renégociation du taux (prêt immobilier de GS, par avenant) ========== */
  /* o : { taux, effet: "duree" (même durée, mensualité plus basse) | "mensualite" (même mensualité, durée plus courte) } */
  function renegocier(c, k, o, auj) {
    auj = auj || B.aujourdhui(); o = o || {};
    var x = c.cre[k], err = [];
    if (!x) return ko([E("credit", "Choisissez le crédit.")]);
    var s = situation(x, auj);
    if (s.ext) return ko([E("credit", "Ce crédit est détenu dans une autre banque : GS ne peut pas modifier son taux. Pour le reprendre, utilisez le rachat de prêt.")]);
    if (!s.immo) return ko([E("credit", "La renégociation du taux concerne ici les prêts immobiliers. Un crédit à la consommation à taux fixe ne se renégocie pas : étudier le remboursement anticipé ou le regroupement.")]);
    if (s.reste < 1) return ko([E("credit", "Ce crédit est déjà soldé : il ne reste aucune échéance.")]);
    var t = lireTaux(o.taux);
    if (isNaN(t) || t <= 0) err.push(E("taux", "Saisissez le nouveau taux nominal annuel, en pourcentage (par exemple 3,40)."));
    else if (t >= s.taux) err.push(E("taux", "Le nouveau taux doit être inférieur au taux actuel du prêt (" + pct(s.taux) + ")."));
    else { var u = usureControle(t, s.reste); if (!u.ok) err.push(E("taux", "Le taux proposé atteint le seuil de l'usure du " + u.trimestre + " (" + pct(u.usure) + ", " + u.lib + ") : il doit rester inférieur.")); }
    if (o.effet !== "duree" && o.effet !== "mensualite") err.push(E("effet", "Choisissez ce que devient le prêt : même durée avec une mensualité plus basse, ou même mensualité avec une durée plus courte."));
    if (err.length) return ko(err);
    var avant = etatPlan(s), regles = [], alertes = [], ap, M;
    if (o.effet === "duree") {
      M = cents(P.paiement(s.crd, t, s.reste));
      var p1 = plan(s.crdC, t, M, s.reste);
      ap = etatNouveau(s.crdC, t, M, s.reste, p1.interets, s.fin, s.assM, p1.derniere);
    } else {
      var p2 = plan(s.crdC, t, s.mensC);
      ap = etatNouveau(s.crdC, t, s.mensC, p2.n, p2.interets, dateEcheance(x, s.payees + p2.n), s.assM, p2.derniere);
    }
    var fa = r2(Math.min(AVENANT.max, Math.max(AVENANT.min, s.crd * AVENANT.pct / 100)));
    var frais = [{ cle: "avenant", lib: "Frais d'avenant", montant: fa }], totalFrais = fa;
    var interetsEco = r2(avant.interets - ap.interets), assEco = r2(avant.coutAssurance - ap.coutAssurance), gain = r2(interetsEco + assEco - totalFrais);
    var ecart = r2(s.taux - t), rep = reperesRenego(s, ecart);
    var eco = r2(avant.mensualite - ap.mensualite), pm = null;
    if (o.effet === "duree" && eco > 0) pm = Math.ceil(totalFrais / eco - 1e-9);
    regles.push("La renégociation se fait avec la banque qui a accordé le prêt, par un avenant au contrat : elle n'est pas un droit, la banque n'est pas tenue d'accepter. Pas d'indemnité de remboursement anticipé : le prêt n'est pas remboursé.");
    regles.push("Frais d'avenant (convention de GS, dans la fourchette de 150 à 1 000 € ou de 0,5 % à 3 % du capital restant dû relevée par Cafpi) : " + String(AVENANT.pct).replace(".", ",") + " % du capital restant dû, " + eur(AVENANT.min) + " au moins, " + eur(AVENANT.max) + " au plus, payés à la signature : " + eur(fa) + ".");
    regles.push("Règle de calcul : économie = intérêts avant − intérêts après (+ assurance évitée si la durée raccourcit) ; l'opération est rentable si l'économie dépasse les frais.");
    var u2 = usureControle(t, ap.reste);
    alertes.push({ n: "info", t: "Le taux proposé (" + pct(t) + ", hors assurance) est sous le seuil de l'usure du " + u2.trimestre + " (" + pct(u2.usure) + " pour " + u2.lib + "), qui s'apprécie sur le TAEG, assurance et frais compris." });
    var gc = tauxCatalogueImmo(s.reste);
    if (gc) alertes.push({ n: "info", t: "Taux du catalogue pour " + P.libDuree(s.reste) + " : " + pct(gc.taux) + " (" + gc.lib + ")." });
    alertes.push({ n: "info", t: "Le prêt garde son contrat d'assurance emprunteur et sa garantie : seul le taux change." });
    var avecPm = pm !== null ? "Les frais sont amortis en " + pl(pm, "mois", "mois") + " d'économie de mensualité" + (pm > s.reste ? ", donc jamais avant la fin du prêt." : ".") : "Le client garde sa mensualité : l'économie vient de la durée plus courte (" + pl(s.reste - ap.reste, "mois", "mois") + " de moins).";
    alertes.push({ n: pm !== null && pm > s.reste ? "attention" : "info", t: avecPm });
    var repOk = rep.every(function (r) { return r.ok; });
    return { ok: true, op: "renegociation", titre: lib(OPERATIONS, "renegociation"), credits: [k], effet: o.effet, nouveauTaux: t, ecart: ecart, avant: avant, apres: ap, frais: frais, totalFrais: totalFrais, interetsEco: interetsEco, assuranceEco: assEco, gain: gain,
      pointMort: pm, reperes: rep, verdict: verdictGain(gain, repOk), regles: regles, alertes: alertes, date: B.ymd(auj) };
  }

  /* ========== rachat par GS d'un prêt immobilier détenu dans une autre banque ========== */
  /* Coûts financés dans le nouveau prêt : indemnité de l'ancienne banque (au maximum légal), frais de dossier du catalogue, frais de garantie du montage de prêt (société de cautionnement mutuel). */
  function financement(baseC, garantiePct) {
    var g = garantiePct / 100, capC = Math.ceil(baseC / (1 - g) - 1e-9), fgC = Math.round(capC * g);
    while (capC - fgC < baseC) { capC++; fgC = Math.round(capC * g); }
    return { capC: capC, fgC: fgC };
  }
  /* o : { duree (mois) } */
  function racheter(c, k, o, auj) {
    auj = auj || B.aujourdhui(); o = o || {};
    var x = c.cre[k], err = [];
    if (!x) return ko([E("credit", "Choisissez le crédit.")]);
    var s = situation(x, auj);
    if (!s.ext) return ko([E("credit", "Ce prêt est déjà à GS : pour baisser son taux, utilisez la renégociation.")]);
    if (!s.immo) return ko([E("credit", "Le rachat d'un prêt par GS porte ici sur un prêt immobilier. Pour un crédit à la consommation détenu ailleurs, étudier le regroupement de crédits.")]);
    if (s.reste < 1) return ko([E("credit", "Ce prêt est déjà soldé : il ne reste aucune échéance.")]);
    var n = o.duree === undefined || o.duree === "" ? Math.max(DUREE_NOUVEAU.min, Math.min(s.reste, DUREE_NOUVEAU.max)) : lireEntier(o.duree);
    if (isNaN(n) || n < DUREE_NOUVEAU.min || n > DUREE_NOUVEAU.max) err.push(E("duree", "Saisissez la durée du nouveau prêt en mois, de " + DUREE_NOUVEAU.min + " (1 an) à " + DUREE_NOUVEAU.max + " (25 ans)."));
    if (err.length) return ko(err);
    var g = tauxCatalogueImmo(n), prod = P.produitPret("CIMMO"), taux = g.taux, sur = MT.SURETES.scm.taux;
    var u = usureControle(taux, n);
    if (!u.ok) return ko([E("duree", "Le taux du catalogue (" + pct(taux) + ") atteint le seuil de l'usure du " + u.trimestre + " (" + pct(u.usure) + ") : le prêt ne peut pas être proposé.")]);
    var ira = iraImmo(s, s.crd, ""), dossier = prod.fraisDossier;
    var fin = financement(s.crdC + cents(ira.montant) + cents(dossier), sur), capC = fin.capC, fg = eu(fin.fgC);
    var M = cents(P.paiement(eu(capC), taux, n)), pn = plan(capC, taux, M, n), avant = etatPlan(s);
    avant.coutAssurance = 0; avant.assurance = 0;
    var ap = etatNouveau(capC, taux, M, n, pn.interets, finNouveau(n, auj), 0, pn.derniere);
    var frais = [{ cle: "ira", lib: "Indemnité de remboursement anticipé de l'ancienne banque (maximum légal)", montant: ira.montant }, { cle: "dossier", lib: "Frais de dossier du prêt immobilier GS", montant: dossier }, { cle: "garantie", lib: "Frais de garantie (société de cautionnement mutuel, " + String(sur).replace(".", ",") + " % du nouveau prêt)", montant: fg }];
    var totalFrais = r2(ira.montant + dossier + fg), coutApres = r2(ap.interets + totalFrais), gain = r2(avant.interets - coutApres), ecart = r2(s.taux - taux), rep = reperesRenego(s, ecart);
    var Mhf = P.paiement(s.crd, taux, n), eco = r2(s.mens - Mhf), pm = eco > 0 ? Math.ceil(totalFrais / eco - 1e-9) : null;
    var regles = [
      "Rachat de prêt : un autre établissement reprend le prêt, l'ancien est remboursé par anticipation. L'ancienne banque peut réclamer une indemnité au plus égale à six mois d'intérêts sur le capital remboursé (" + eur(s.crd) + " × " + pct(s.taux) + " ÷ 2 = " + eur(ira.semestre) + ") et à 3 % du capital restant dû (" + eur(ira.plafond) + ") : " + eur(ira.montant) + " (articles L313-47 et R313-25). Une absence d'indemnité négociée dans le contrat ne vaut pas forcément pour un rachat.",
      "Coûts financés dans le nouveau prêt : indemnité, frais de dossier de " + eur(dossier) + " (catalogue), frais de garantie de " + String(sur).replace(".", ",") + " % du prêt (montage de prêt) : capital du nouveau prêt = " + eur(eu(capC)) + ". Les frais de mainlevée de l'ancienne garantie ne sont pas chiffrés.",
      "Comparaison : intérêts restants à payer à l'ancienne banque (" + eur(avant.interets) + ") contre intérêts du nouveau prêt (" + eur(ap.interets) + ") et coûts financés (" + eur(totalFrais) + "). L'assurance emprunteur est laissée de côté dans les deux cas (le nouveau contrat n'est pas chiffré)."
    ];
    var d = endettement(c, [k], ap.mensualite, auj), alertes = [alerteEndettement(d, true, "Après le rachat, ")];
    alertes.push({ n: "info", t: "Taux du catalogue GS pour " + P.libDuree(n) + " : " + pct(taux) + " (" + g.lib + "), sous le seuil de l'usure du " + u.trimestre + " (" + pct(u.usure) + ", " + u.lib + ") qui s'apprécie sur le TAEG." });
    alertes.push({ n: "info", interne: true, t: "Prêt déclaré par le client : le capital restant dû, le taux et la mensualité sont à confirmer avec l'offre de prêt et le dernier tableau d'amortissement. La banque actuelle doit fournir gratuitement un décompte chiffré du remboursement anticipé (article L313-47)." });
    if (pm !== null) alertes.push({ n: pm > s.reste ? "attention" : "info", t: "Les coûts sont amortis en " + pl(pm, "mois", "mois") + " d'économie de mensualité (hors coûts financés)" + (pm > s.reste ? ", donc jamais avant la fin du prêt." : ".") });
    if (n > s.reste) alertes.push({ n: "attention", t: "Le nouveau prêt est plus long que l'ancien (" + P.libDuree(n) + " contre " + P.libDuree(s.reste) + " restants) : la mensualité baisse en partie parce que la durée s'allonge." });
    return { ok: true, op: "rachat", titre: lib(OPERATIONS, "rachat"), credits: [k], duree: n, nouveauTaux: taux, ecart: ecart, avant: avant, apres: ap, frais: frais, totalFrais: totalFrais, capitalNouveau: eu(capC), interetsEco: r2(avant.interets - ap.interets),
      gain: gain, ira: ira, pointMort: pm, reperes: rep, verdict: verdictGain(gain, rep.every(function (r) { return r.ok; })), regles: regles, alertes: alertes, endettement: d, date: B.ymd(auj) };
  }

  /* ========== regroupement de crédits ========== */
  /* o : { credits: [indices dans c.cre], duree (mois) }. Le nouveau prêt est un prêt immobilier si les crédits immobiliers pèsent au moins 60 % de l'opération, un prêt personnel sinon. */
  function regrouper(c, indices, o, auj) {
    auj = auj || B.aujourdhui(); o = o || {};
    var err = [], ids = (indices || []).filter(function (v, i, a) { return a.indexOf(v) === i; });
    if (ids.length < 2) return ko([E("credits", "Choisissez au moins deux crédits à regrouper.")]);
    var sit = [];
    ids.forEach(function (i) {
      var x = c.cre[i];
      if (!x) err.push(E("credits", "Crédit inconnu."));
      else { var s = situation(x, auj); s.k = i; if (s.reste < 1) err.push(E("credits", "Le crédit " + s.nom + " est déjà soldé.")); else sit.push(s); }
    });
    if (err.length) return ko(err);
    var totalCrd = sit.reduce(function (t, s) { return t + s.crdC; }, 0), iras = sit.map(function (s) { return s.immo ? iraImmo(s, s.crd, "") : iraConso(s, s.crd, 0, s.interets, auj); });
    var iraC = iras.map(function (r) { return cents(r.montant); }), totalIra = iraC.reduce(function (t, v) { return t + v; }, 0);
    var immoC = 0; sit.forEach(function (s, i) { if (s.immo) immoC += s.crdC + iraC[i]; });
    var operationC = totalCrd + totalIra, part = operationC ? 100 * immoC / operationC : 0, immo = part >= SEUIL_REGROUPEMENT - 1e-9;
    var maxReste = Math.max.apply(null, sit.map(function (s) { return s.reste; }));
    var produit = immo ? "CIMMO" : "CCONSO", prod = P.produitPret(produit);
    var n = o.duree === undefined || o.duree === "" ? Math.max(immo ? DUREE_NOUVEAU.min : prod.dureeMin, Math.min(maxReste, immo ? DUREE_NOUVEAU.max : prod.dureeMax)) : lireEntier(o.duree);
    if (isNaN(n) || n < (immo ? DUREE_NOUVEAU.min : prod.dureeMin) || n > (immo ? DUREE_NOUVEAU.max : prod.dureeMax)) return ko([E("duree", "Saisissez la durée du nouveau prêt en mois, " + (immo ? "de " + DUREE_NOUVEAU.min + " à " + DUREE_NOUVEAU.max : "de " + prod.dureeMin + " à " + prod.dureeMax) + " (" + nomProduit(produit) + ").")]);
    var g = immo ? tauxCatalogueImmo(n) : prod.grille[0], taux = g.taux, dossier = prod.fraisDossier, sur = immo ? MT.SURETES.scm.taux : 0;
    if (immo) { var u = usureControle(taux, n); if (!u.ok) return ko([E("duree", "Le taux du catalogue (" + pct(taux) + ") atteint le seuil de l'usure du " + u.trimestre + " : le prêt ne peut pas être proposé.")]); }
    var fin = financement(totalCrd + totalIra + cents(dossier), sur), capC = fin.capC, fg = eu(fin.fgC);
    if (!immo && (eu(capC) < prod.capitalMin || eu(capC) > prod.capitalMax)) return ko([E("credits", "Le capital du nouveau prêt (" + eur(eu(capC)) + ") doit être compris entre " + eur(prod.capitalMin) + " et " + eur(prod.capitalMax) + " pour un " + prod.nom + ".")]);
    var M = cents(P.paiement(eu(capC), taux, n)), pn = plan(capC, taux, M, n);
    var avInt = sit.reduce(function (t, s) { return t + s.interets; }, 0), avMens = sit.reduce(function (t, s) { return t + s.mens; }, 0);
    var avant = { capital: eu(totalCrd), mensualite: r2(avMens), assurance: 0, reste: maxReste, fin: sit.reduce(function (m, s) { return s.fin > m ? s.fin : m; }, ""), interets: r2(avInt), taux: null, coutAssurance: 0 };
    var ap = etatNouveau(capC, taux, M, n, pn.interets, finNouveau(n, auj), 0, pn.derniere);
    var totalFrais = r2(eu(totalIra) + dossier + fg), coutApres = r2(ap.interets + totalFrais), gain = r2(avant.interets - coutApres);
    var frais = [{ cle: "ira", lib: "Indemnités de remboursement anticipé des crédits regroupés (maximum légal)", montant: eu(totalIra) }, { cle: "dossier", lib: "Frais de dossier du " + prod.nom, montant: dossier }];
    if (sur) frais.push({ cle: "garantie", lib: "Frais de garantie (société de cautionnement mutuel, " + String(sur).replace(".", ",") + " % du nouveau prêt)", montant: fg });
    var regles = [
      "Regroupement : un seul crédit remplace plusieurs crédits, avec une seule mensualité. Qualification : part des crédits immobiliers dans le montant total de l'opération (capital restant dû et indemnités : " + eur(eu(operationC)) + ") = " + pct(Math.round(part * 100) / 100) + ". Le seuil est de " + SEUIL_REGROUPEMENT + " % (article R314-18 du Code de la consommation) : " + (immo ? "l'opération relève du crédit immobilier." : "l'opération relève du crédit à la consommation."),
      immo ? "Crédit immobilier : l'offre est remise au client, qui dispose de 10 jours de réflexion avant de l'accepter ; elle reste valable 30 jours au moins." : "Crédit à la consommation : le client dispose de 14 jours pour se rétracter après avoir accepté l'offre. À partir du 20 novembre 2026, le déblocage des fonds d'un regroupement de crédit à la consommation n'intervient qu'après un délai de 7 jours (réforme issue de l'ordonnance n° 2025-880, source secondaire : à vérifier dans le texte).",
      "La banque doit indiquer au client si l'opération allonge la durée de remboursement ou augmente le coût total, et lui remettre un tableau comparant ses dettes actuelles et le nouveau crédit. Les crédits renouvelables regroupés sont remboursés directement à leur prêteur et le client doit être informé de son droit de les résilier."
    ];
    var alertes = [], dRe = endettement(c, ids, ap.mensualite, auj);
    alertes.push(alerteEndettement(dRe, immo, "Après le regroupement, "));
    if (ap.reste > maxReste) alertes.push({ n: "attention", t: "Le regroupement allonge la durée de remboursement : " + P.libDuree(ap.reste) + " contre " + P.libDuree(maxReste) + " pour le crédit le plus long." });
    if (gain < 0) alertes.push({ n: "attention", t: "Le regroupement augmente le coût total : " + eur(-gain) + " de plus que de garder les crédits actuels (intérêts restants et coûts de l'opération). Une mensualité plus basse ne veut pas dire un crédit moins cher." });
    alertes.push({ n: "info", t: "Assurance emprunteur laissée de côté dans la comparaison : le nouveau contrat n'est pas chiffré. Les crédits regroupés restent à rembourser jusqu'à la signature du nouveau prêt." });
    var gar = sit.some(function (s) { return s.ext; }) ? "Les crédits détenus dans une autre banque sont déclarés par le client : leurs chiffres sont à confirmer avec les décomptes de remboursement anticipé de chaque prêteur." : "";
    if (gar) alertes.push({ n: "info", interne: true, t: gar });
    var verdict = gain > 0 ? { code: "interessant", libelle: "Économie de " + eur(gain) + " sur le coût total restant, coûts de l'opération compris." } : { code: "peu_interessant", libelle: "Le coût total augmente de " + eur(-gain) + " : à proposer seulement pour soulager le budget du client, en l'en informant." };
    return { ok: true, op: "regroupement", titre: lib(OPERATIONS, "regroupement"), credits: ids.slice(), details: sit.map(function (s, i) { return { k: s.k, nom: s.nom, ext: s.ext, crd: s.crd, mens: s.mens, reste: s.reste, taux: s.taux, interets: s.interets, ira: eu(iraC[i]) }; }),
      produit: produit, partImmo: Math.round(part * 100) / 100, immo: immo, duree: n, nouveauTaux: taux, capitalNouveau: eu(capC), avant: avant, apres: ap, frais: frais, totalFrais: totalFrais, interetsEco: r2(avant.interets - ap.interets), gain: gain,
      verdict: verdict, reperes: [], regles: regles, alertes: alertes, endettement: dRe, date: B.ymd(auj) };
  }

  /* ========== modulation de la mensualité et report de mensualités (prêt immobilier de GS, clause du contrat) ========== */
  function controleAmenagement(c, k, s, st) {
    var err = [];
    if (s.ext) err.push(E("credit", "Ce crédit est détenu dans une autre banque : seule la banque prêteuse peut aménager ses échéances."));
    else if (!s.immo) err.push(E("credit", "La modulation et le report de mensualités sont prévus par les prêts immobiliers de GS ; les crédits à la consommation n'ont pas cette clause."));
    else if (s.reste < 1) err.push(E("credit", "Ce crédit est déjà soldé : il ne reste aucune échéance."));
    else if (s.payees < AMENAGEMENT.apres) err.push(E("credit", "La clause du contrat joue après " + AMENAGEMENT.apres + " échéances payées : ce prêt n'en compte que " + s.payees + "."));
    return err;
  }
  /* o : { variation: pourcentage de la mensualité, de −20 à +20, sans 0 } */
  function moduler(c, k, o, auj) {
    auj = auj || B.aujourdhui(); o = o || {};
    var x = c.cre[k];
    if (!x) return ko([E("credit", "Choisissez le crédit.")]);
    var s = situation(x, auj), err = controleAmenagement(c, k, s);
    if (err.length) return ko(err);
    var tv = String(o.variation == null ? "" : o.variation).replace(/\s/g, "").replace("\u2212", "-").replace(",", "."), v = /^[+-]?\d+(\.\d{1,2})?$/.test(tv) ? parseFloat(tv) : NaN;
    if (isNaN(v) || v === 0) return ko([E("variation", "Saisissez la variation de la mensualité en pourcentage, par exemple 10 ou −10.")]);
    if (Math.abs(v) > AMENAGEMENT.pctMax) return ko([E("variation", "La clause de GS limite la modulation à " + AMENAGEMENT.pctMax + " % de la mensualité, dans un sens ou dans l'autre.")]);
    var M = Math.round(s.mensC * (1 + v / 100)), pn = plan(s.crdC, s.taux, M);
    if (!pn) return ko([E("variation", "La mensualité de " + eur(eu(M)) + " ne couvre pas les intérêts du capital restant dû.")]);
    var total = s.payees + pn.n;
    if (total > AMENAGEMENT.dureeMax) return ko([E("variation", "Avec cette mensualité, le prêt durerait " + P.libDuree(total) + " au total : la durée d'un prêt immobilier est limitée à 25 ans.")]);
    var avant = etatPlan(s), ap = etatNouveau(s.crdC, s.taux, M, pn.n, pn.interets, dateEcheance(x, s.payees + pn.n), s.assM, pn.derniere);
    var interetsEco = r2(avant.interets - ap.interets), assEco = r2(avant.coutAssurance - ap.coutAssurance), gain = r2(interetsEco + assEco);
    var d = endettement(c, [k], ap.mensualite + s.assM, auj);
    var regles = ["Modulation : clause du contrat de prêt, dont les limites sont fixées par la banque (La finance pour tous). Clause de GS : variation de la mensualité de " + AMENAGEMENT.pctMax + " % au plus, après " + AMENAGEMENT.apres + " échéances payées, le taux restant inchangé.",
      "Nouvelle mensualité : " + eur(s.mens) + " × (1 " + (v > 0 ? "+" : "−") + " " + String(Math.abs(v)).replace(".", ",") + " %) = " + eur(eu(M)) + " ; la dernière échéance solde le prêt."];
    var alertes = [alerteEndettement(d, true, "Après la modulation, ")];
    if (v < 0) alertes.push({ n: "attention", t: "Baisser la mensualité allonge le prêt de " + pl(pn.n - s.reste, "mois", "mois") + " et augmente le coût total de " + eur(-gain) + " (intérêts et assurance emprunteur)." });
    else alertes.push({ n: "info", t: "Augmenter la mensualité raccourcit le prêt de " + pl(s.reste - pn.n, "mois", "mois") + " et réduit le coût total de " + eur(gain) + " (intérêts et assurance emprunteur) : vérifier la capacité de remboursement du client." });
    return { ok: true, op: "modulation", titre: lib(OPERATIONS, "modulation"), credits: [k], variation: v, avant: avant, apres: ap, frais: [], totalFrais: 0, interetsEco: interetsEco, assuranceEco: assEco, gain: gain, endettement: d,
      verdict: v > 0 ? { code: "interessant", libelle: "Le prêt se termine plus tôt et coûte moins cher (" + eur(gain) + " d'économie)." } : { code: "cout", libelle: "Soulage le budget mensuel, mais le prêt coûte " + eur(-gain) + " de plus." }, reperes: [], regles: regles, alertes: alertes, date: B.ymd(auj) };
  }
  /* o : { mois: nombre de mensualités reportées, de 1 à 12 } */
  function reporter(c, k, o, auj) {
    auj = auj || B.aujourdhui(); o = o || {};
    var x = c.cre[k];
    if (!x) return ko([E("credit", "Choisissez le crédit.")]);
    var s = situation(x, auj), err = controleAmenagement(c, k, s);
    if (err.length) return ko(err);
    var m = lireEntier(o.mois);
    if (isNaN(m) || m < 1 || m > AMENAGEMENT.reportMax) return ko([E("mois", "Saisissez le nombre de mensualités à reporter, de 1 à " + AMENAGEMENT.reportMax + ".")]);
    var tm = Math.round(s.taux * 1000), crdC = s.crdC, i, capitalise = 0;
    for (i = 0; i < m; i++) { var it = P.interet(crdC, tm); crdC += it; capitalise += it; }
    var pn = plan(crdC, s.taux, s.mensC);
    if (!pn) return ko([E("mois", "La mensualité ne couvre pas les intérêts du capital restant dû après le report.")]);
    var total = s.payees + m + pn.n;
    if (total > AMENAGEMENT.dureeMax) return ko([E("mois", "Avec ce report, le prêt durerait " + P.libDuree(total) + " au total : la durée d'un prêt immobilier est limitée à 25 ans.")]);
    var avant = etatPlan(s), reste2 = m + pn.n, ap = etatNouveau(crdC, s.taux, s.mensC, reste2, capitalise + pn.interets, dateEcheance(x, s.payees + reste2), s.assM, pn.derniere);
    ap.reporte = m; ap.apresReport = pn.n;
    var interetsEco = r2(avant.interets - ap.interets), assEco = r2(avant.coutAssurance - ap.coutAssurance), gain = r2(interetsEco + assEco);
    var regles = ["Report : clause du contrat de prêt, dont les limites sont fixées par la banque. Clause de GS : report de 1 à " + AMENAGEMENT.reportMax + " mensualités, après " + AMENAGEMENT.apres + " échéances payées.",
      "Pendant le report, le client ne paie pas la mensualité, mais les intérêts continuent de courir : ils s'ajoutent au capital (" + eur(eu(capitalise)) + " pour " + pl(m, "mois", "mois") + "), de sorte que le capital restant dû passe de " + eur(s.crd) + " à " + eur(eu(crdC)) + ". La mensualité reprend ensuite au même montant.",
      "Convention de GS : la cotisation d'assurance emprunteur reste due pendant le report (" + eur(s.assM) + " par mois)."];
    var alertes = [{ n: "attention", t: "Le report prolonge le prêt de " + pl(reste2 - s.reste, "mois", "mois") + " et coûte " + eur(-gain) + " de plus (intérêts capitalisés et assurance emprunteur). À réserver à une gêne passagère." }];
    return { ok: true, op: "report", titre: lib(OPERATIONS, "report"), credits: [k], mois: m, avant: avant, apres: ap, frais: [], totalFrais: 0, interetsEco: interetsEco, assuranceEco: assEco, gain: gain, interetsCapitalises: eu(capitalise),
      verdict: { code: "cout", libelle: "Soulage le budget pendant " + pl(m, "mois", "mois") + ", mais le prêt coûte " + eur(-gain) + " de plus." }, reperes: [], regles: regles, alertes: alertes, date: B.ymd(auj) };
  }

  /* ========== enregistrement : proposition au client, puis décision ========== */
  function listeSuivis(st, cid) { return (st && Array.isArray(st.suivis) ? st.suivis : []).filter(function (s) { return cid == null || s.c === cid; }); }
  function trouver(st, id) { return listeSuivis(st).filter(function (s) { return s.id === id || s.ref === id; })[0] || null; }
  /* Une proposition en attente ou acceptée verrouille les crédits qu'elle concerne : les nouvelles conditions ne sont pas reprises dans la fiche du client, on ne simule pas une deuxième
     opération par-dessus. Le client qui renonce libère le crédit. */
  function verrou(st, cid, k) { return listeSuivis(st, cid).filter(function (s) { return (s.statut === "propose" || s.statut === "accepte") && s.credits.indexOf(k) >= 0; })[0] || null; }
  function calculer(c, o, auj) {
    var op = o && o.op;
    if (op === "remboursement") return rembourser(c, o.k, o, auj);
    if (op === "renegociation") return renegocier(c, o.k, o, auj);
    if (op === "rachat") return racheter(c, o.k, o, auj);
    if (op === "regroupement") return regrouper(c, o.credits, o, auj);
    if (op === "modulation") return moduler(c, o.k, o, auj);
    if (op === "report") return reporter(c, o.k, o, auj);
    return ko([E("op", "Choisissez l'opération demandée par le client.")]);
  }
  function creer(st, c, o) {
    var auj = B.aujourdhui(), r = calculer(c, o, auj);
    if (!r.ok) return r;
    var bloque = null;
    r.credits.forEach(function (k) { var v = verrou(st, c.id, k); if (v && !bloque) bloque = { k: k, v: v }; });
    if (bloque) return ko([E("credit", "Ce crédit fait déjà l'objet du dossier " + bloque.v.ref + " (" + (bloque.v.statut === "accepte" ? "acceptée par le client" : "proposition en attente de la réponse du client") + ") : " + (bloque.v.statut === "accepte" ? "l'opération acceptée n'est pas encore reprise dans la fiche du client, aucune autre opération n'est simulée par-dessus." : "enregistrez la réponse du client avant d'en simuler une autre.") )]);
    if (!Array.isArray(st.suivis)) st.suivis = [];
    var an = String(auj.getFullYear()), n = st.suivis.filter(function (s) { return s.ref.indexOf("SC-" + an) === 0; }).length + 1, now = B.maintenant();
    var s = { id: "sc" + now.getTime().toString(36) + Math.random().toString(36).slice(2, 5), ref: "SC-" + an + "-" + (n < 10 ? "000" : n < 100 ? "00" : "0") + n, c: c.id, date: B.ymd(auj), heure: B.hhmm(now), par: (st.eleve && st.eleve.nom) || "",
      op: r.op, credits: r.credits.slice(), statut: "propose", calcul: r, decision: null };
    st.suivis.push(s);
    return { ok: true, suivi: s, calcul: r };
  }
  function decider(st, id, decision) {
    var s = trouver(st, id), auj = B.aujourdhui();
    if (!s) return { ok: false, erreur: "Dossier introuvable." };
    if (s.statut !== "propose") return { ok: false, erreur: "La réponse du client est déjà enregistrée pour ce dossier." };
    if (decision !== "accepte" && decision !== "renonce") return { ok: false, erreur: "Réponse inconnue." };
    s.statut = decision; s.decision = { date: B.ymd(auj), heure: B.hhmm(B.maintenant()) };
    return { ok: true, suivi: s };
  }
  function etat(s) {
    if (s.statut === "accepte") return { code: "accepte", libelle: "Acceptée par le client le " + B.fmtDate(B.lireYmd(s.decision.date)), ton: "ok" };
    if (s.statut === "renonce") return { code: "renonce", libelle: "Le client a renoncé le " + B.fmtDate(B.lireYmd(s.decision.date)), ton: "info" };
    return { code: "propose", libelle: "Proposition remise au client, en attente de sa réponse", ton: "warn" };
  }

  var api = {
    REFORME: REFORME, CONSO: CONSO, IMMO: IMMO, SEUIL_REGROUPEMENT: SEUIL_REGROUPEMENT, REPERES: REPERES, AVENANT: AVENANT, AMENAGEMENT: AMENAGEMENT, DUREE_NOUVEAU: DUREE_NOUVEAU, EXONERATIONS: EXONERATIONS, OPERATIONS: OPERATIONS,
    lib: lib, plan: plan, situation: situation, situations: situations, iraImmo: iraImmo, iraConso: iraConso, regimeConso: regimeConso, endettement: endettement, epargneDispo: epargneDispo, tauxCatalogueImmo: tauxCatalogueImmo,
    lireMontant: lireMontant, rembourser: rembourser, renegocier: renegocier, racheter: racheter, regrouper: regrouper, moduler: moduler, reporter: reporter, calculer: calculer,
    liste: listeSuivis, trouver: trouver, verrou: verrou, creer: creer, decider: decider, etat: etat, financement: financement
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.suiviCredit = api; }
})(typeof window !== "undefined" ? window : null);
