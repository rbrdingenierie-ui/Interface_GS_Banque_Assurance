/* GS Banque & Assurance – procédure MURCEF du chèque présenté sans provision : information préalable du titulaire, mise en suspens du chèque, puis lettre d'injonction.
   Le rejet fait naître deux obligations pour la banque (Code monétaire et financier) : informer le titulaire « par tout moyen approprié » avant de rejeter le chèque (art. L131-73, sans délai fixé par la loi),
   puis, faute de régularisation, lui adresser une lettre d'injonction en recommandé avec avis de réception (art. R131-15) : interdiction d'émettre des chèques pendant cinq ans (art. L131-73), restitution des formules de chèques,
   moyens de régulariser, rappel des sanctions pénales (art. L163-2), inscription au fichier central des chèques (FCC) de la Banque de France.
   Règle de l'agence (la loi n'impose aucun délai) : le chèque est mis en suspens 5 jours ouvrés, hors week-end et jours fériés, jusqu'à 12 h le 5e jour ; le jour de la mise en suspens n'est pas compté.
   Ce module ne fait que PRÉPARER les lettres : l'information et l'envoi de l'injonction sont toujours validés par le conseiller (voir app.js), qui édite le PDF.
   La lettre tient sur deux pages A4 : la lettre (page 1), puis les dispositions de la loi et la déclaration de régularisation à faire remplir par le client (page 2).
   Elle porte le tampon de l'agence (daté du jour), la signature du conseiller (le nom de l'élève, inscrit à l'impression) et la date du jour (tampon.js, documents.js).
   Fonctions pures, testées avec Node : le texte de la lettre ne dépend que du dossier, de la décision prise et des choix du conseiller. */
(function (root) {
  "use strict";

  var R = (root && root.SGBF && root.SGBF.rules) || (typeof require === "function" ? require("./rules.js") : null);
  var D = (root && root.SGBF && root.SGBF.documents) || (typeof require === "function" ? require("./documents.js") : null);
  var B = (root && root.SGBF && root.SGBF.banque) || (typeof require === "function" ? require("./banque.js") : null);

  var AGENCE = ["GS Banque & Assurance", "Agence de Paris", "27 rue de Châteaudun", "75009 Paris"];
  var DUREE_INTERDICTION = "cinq ans";

  /* Qualité du destinataire (art. L131-80 pour un compte collectif) : choisie par le conseiller selon le dossier du compte. */
  var QUALITES = [
    { code: "individuel", libelle: "Titulaire individuel du compte" },
    { code: "cotitulaire", libelle: "Cotitulaire d'un compte collectif, sans responsable désigné" },
    { code: "responsable", libelle: "Responsable désigné d'un compte collectif (art. L131-80 du Code monétaire et financier)" }
  ];

  /* Vérifications que le conseiller atteste avant de valider l'envoi. */
  var VERIFICATIONS = [
    { id: "identite", libelle: "Le nom, l'adresse et le numéro de compte du destinataire sont exacts." },
    { id: "cheque", libelle: "Le numéro, le montant et la date de rejet du chèque correspondent à l'opération rejetée." },
    { id: "information", libelle: "Le titulaire a été informé avant le rejet et invité à approvisionner son compte." },
    { id: "delai", libelle: "Le chèque est resté en suspens jusqu'à l'échéance et le titulaire n'a pas régularisé sa situation." }
  ];

  /* Règle de l'agence : le chèque est mis en suspens 5 jours ouvrés (lundi au vendredi, hors jours fériés) ; le titulaire peut régulariser jusqu'à 12 h le 5e jour.
     Le jour de la mise en suspens (celui de l'information du titulaire) n'est pas compté. Ce n'est pas un délai de la loi, qui n'en fixe aucun. */
  var SUSPENS = { jours: 5, heure: 12 };
  /* Moyens d'informer le titulaire avant le rejet : la loi laisse le choix (« tout moyen approprié mis à disposition »). */
  var MOYENS = [
    { code: "courrier", libelle: "Courrier d'information", court: "courrier" },
    { code: "telephone", libelle: "Appel téléphonique au client", court: "appel téléphonique" },
    { code: "email", libelle: "E-mail au client", court: "e-mail" }
  ];
  /* Échéance : 12 h le 5e jour ouvré qui suit le jour de la mise en suspens (date). */
  function echeance(date) {
    var x = B.jour(date), n = 0;
    while (n < SUSPENS.jours) { x = B.plusJours(x, 1); if (B.estOuvre(x)) n++; }
    return new Date(x.getFullYear(), x.getMonth(), x.getDate(), SUSPENS.heure, 0, 0, 0);
  }
  function jourSemaine(d) { return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); }
  /* « mardi 17 novembre 2026 à 12 h » */
  function echeanceLongue(d) { return jourSemaine(d) + " à " + d.getHours() + " h"; }
  /* Dates enregistrées sous la forme « AAAA-MM-JJTHH:MM » (heure de Paris) : lisibles sans fuseau, comparables comme du texte. */
  function ecrireDate(d) { return B.ymd(d) + "T" + B.hhmm(d); }
  function lireDate(t) { var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(t == null ? "" : t)); return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], 0, 0) : null; }

  /* Adresse du destinataire : celle du client si le dossier en porte une, sinon une adresse parisienne imaginaire, toujours la même pour un même client (documents.js). */
  function adresse(client) { return D.adresse(client); }

  function arrondi(x) { return Math.round(x * 100) / 100; }
  function montant(x) { return D.montant(x); }
  function dateLongue(d) { return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function numeroCheque(op) { var m = /n°\s*([0-9]+)/.exec(op.detail || ""); return m ? m[1] : ""; }
  function feminin(client) { return client.civilite === "Mme" || client.civilite === "Mlle"; }
  function nomComplet(client) { return client.civilite + " " + client.prenom + " " + String(client.nom).toUpperCase(); }

  /* Le rejet est-il fondé sur un défaut de provision ? Seul cas où la lettre d'injonction existe :
     – l'opération est un chèque que le conseiller a rejeté, de plus de 15 € ;
     – le solde disponible (solde + autorisation de découvert), après les décisions précédentes, ne permettait pas de le payer. */
  function analyse(dossier, op, decisions) {
    if (!op || op.type !== "cheque") return { ok: false, raison: "Seul un chèque rejeté donne lieu à une lettre d'injonction." };
    if (R.estNonRejetable(op)) return { ok: false, raison: "Un chèque de 15 € ou moins ne peut pas être rejeté : il n'y a pas de lettre d'injonction." };
    if (!decisions || decisions[op.id] !== "rejeter") return { ok: false, raison: "Le chèque n'a pas été rejeté : il n'y a pas de lettre d'injonction." };
    var proj = R.projeter(dossier, decisions), ligne = null;
    proj.lignes.forEach(function (l) { if (l.op.id === op.id) ligne = l; });
    var aut = dossier.position.autorisation;
    var dispo = arrondi(ligne.soldeAvant + aut);
    var apres = R.etat(ligne.soldeAvant - op.montant, aut);
    if (apres.code !== "etat_debiteurs") {
      return { ok: false, raison: "La position du compte permettait de payer ce chèque (solde disponible de " + montant(Math.max(dispo, 0)) + " pour un chèque de " + montant(op.montant) +
        ") : un rejet pour défaut de provision n'est pas fondé, il n'y a donc pas de lettre d'injonction à envoyer." };
    }
    return { ok: true, soldeAvant: ligne.soldeAvant, disponible: Math.max(dispo, 0) };
  }

  /* Les données du chèque rejeté, telles qu'elles sont enregistrées avec la procédure : la lettre peut être éditée plus tard (les 5 jours passés), même si les dossiers du jour ont changé. */
  function instantane(dossier, op, decisions) {
    var a = analyse(dossier, op, decisions);
    if (!a.ok) return a;
    var c = dossier.client, adr = adresse(c);
    return {
      ok: true, dossier: dossier.id, operation: op.id,
      client: { civilite: c.civilite, prenom: c.prenom, nom: c.nom, compte: c.compte },
      adresse: { ligne1: adr.ligne1, ligne2: adr.ligne2 },
      cheque: numeroCheque(op), montantCheque: op.montant, disponible: a.disponible,
      frais: R.fraisRejetClient(dossier, op), beneficiaire: op.libelle
    };
  }
  /* Données d'un client de la banque, sans chèque : modèle de lettre à compléter à la main (Courriers et documents). client : { civilite, prenom, nom, compte, adresse }. */
  function modele(client) {
    var adr = adresse(client);
    return {
      ok: true, vierge: true, dossier: "", operation: "",
      client: { civilite: client.civilite, prenom: client.prenom, nom: client.nom, compte: client.compte },
      adresse: { ligne1: adr.ligne1, ligne2: adr.ligne2 },
      cheque: "", montantCheque: null, disponible: null, frais: null, beneficiaire: ""
    };
  }

  /* Contenu de la lettre d'injonction. opts : { date: Date, qualite, regularisation } ; le conseiller est l'élève : son nom s'inscrit à l'impression (signature et légende).
     regularisation (facultatif, voir regul.js) : { date, mode, moyen, montant, versement, preleve, bloque, paiement, declaree, levee, autres } : la déclaration de régularisation de la page 2 est alors complétée par la banque. */
  function lettreDepuis(inst, opts) {
    opts = opts || {};
    if (!inst || !inst.ok) return inst || { ok: false, raison: "Aucune donnée." };
    var c = inst.client, date = opts.date || new Date();
    var qualite = QUALITES.filter(function (q) { return q.code === opts.qualite; })[0] || QUALITES[0];
    return {
      ok: true, vierge: !!inst.vierge,
      dossier: inst.dossier,
      destinataire: { nom: nomComplet(c), ligne1: inst.adresse.ligne1, ligne2: inst.adresse.ligne2 },
      compte: c.compte, cheque: inst.cheque, montantCheque: inst.montantCheque, disponible: inst.disponible,
      frais: inst.frais,
      beneficiaire: inst.beneficiaire,
      fichier: D.fichier(opts.prefixe || (opts.regularisation ? "Lettre_injonction_completee" : "Lettre_injonction"), c, date),
      regul: opts.regularisation || null,
      date: dateLongue(date), dateObj: date, qualite: qualite.code, feminin: feminin(c),
      references: "Compte n° " + c.compte + (inst.vierge ? "" : " – chèque n° " + inst.cheque + " – dossier " + inst.dossier)
    };
  }
  function lettre(dossier, op, decisions, opts) {
    var inst = instantane(dossier, op, decisions);
    return inst.ok ? lettreDepuis(inst, opts) : inst;
  }
  /* Courrier d'information préalable : même données ; opts.suspens = date de la mise en suspens (par défaut la date du courrier), d'où l'échéance. */
  function information(inst, opts) {
    opts = opts || {};
    var l = lettreDepuis(inst, { date: opts.date, qualite: "individuel", prefixe: "Courrier_information_cheque" });
    if (!l.ok) return l;
    l.echeanceObj = echeance(opts.suspens || l.dateObj);
    l.echeance = echeanceLongue(l.echeanceObj);
    return l;
  }

  var PAIEMENTS_COURT = { virement: "par virement", especes: "en espèces", carte: "par carte bancaire", autre: "par un autre moyen de paiement" };
  function paiementCourt(code) { return PAIEMENTS_COURT[code] || "par un autre moyen de paiement"; }
  /* ---------- mise en page : deux pages A4 (la lettre, puis les dispositions de la loi et la déclaration de régularisation) ---------- */
  function puce(t) { return "<li>" + t + "</li>"; }
  /* Chèque non précisé (modèle à compléter à la main) : un trait à remplir à la place du numéro, du montant, de la date du rejet. */
  function chq(l) { return l.cheque ? esc(l.cheque) : D.trait(); }
  function mnt(x) { return x == null ? D.trait() : montant(x); }
  function dRejet(l) { return l.vierge ? D.trait() : esc(l.date); }

  /* Déclaration de régularisation de la page 2. Sans régularisation : à compléter à la main par le titulaire. Avec : la banque a coché le mode, inscrit la somme et le compte, daté la déclaration et rayé
     l'autre mention ; le titulaire n'a plus qu'à signer, et un cadre réservé à la banque constate la régularisation (déclaration à la Banque de France, mise à jour du fichier). */
  function barre(t) { return '<span class="dp-barre">' + t + "</span>"; }
  function declaration(l, e) {
    var rg = l.regul;
    var ouv = '<div class="dp-encadre dp-inj-decl' + (rg ? " dp-inj-decl-ok" : "") + '"><h2>Déclaration de régularisation de l\'incident</h2>' +
      "<p>Je soussigné" + e + " " + esc(l.destinataire.nom) + ", titulaire du compte n° " + esc(l.compte) + ", déclare :</p>";
    if (!rg) {
      return ouv +
        D.caseACocher("Avoir réglé le montant du chèque impayé (chèque n° " + chq(l) + "). Justificatif : chèque joint ou écriture en compte (*).") +
        D.caseACocher("Vouloir constituer une provision suffisante et disponible affectée au règlement du chèque et demander expressément le blocage de la somme de " + D.trait() + " qui va être virée sur mon compte n° " + D.trait() + " (*).") +
        '<p class="dp-lieu">À ' + D.trait() + ", le " + D.trait() + '</p><p class="dp-inj-sign">Signature du titulaire :</p><div class="dp-ligne-sign"></div>' +
        '<p class="dp-mention">(*) Rayer la mention inutile.</p></div>';
    }
    var cheque = rg.mode === "cheque", d = B.lireYmd(rg.date), tCheque, tProv;
    tCheque = "Avoir réglé le montant du chèque impayé (chèque n° " + chq(l) + ")" + (cheque ? ", " + esc(paiementCourt(rg.paiement)) + ", au bénéficiaire" + (l.beneficiaire ? " (" + esc(l.beneficiaire) + ")" : "") : "") + ". Justificatif : chèque joint ou écriture en compte (*).";
    tProv = "Vouloir constituer une provision suffisante et disponible affectée au règlement du chèque et demander expressément le blocage de la somme de " + (cheque ? D.trait() : "<strong>" + montant(rg.bloque) + "</strong>") +
      (cheque ? " qui va être virée" : rg.moyen === "virement" ? " virée" : " versée en espèces") + " sur mon compte n° " + (cheque ? D.trait() : "<strong>" + esc(l.compte) + "</strong>") + " (*).";
    var constat = [
      ["Régularisation constatée le", esc(dateLongue(d))],
      ["Mode de régularisation", cheque ? "Remise du chèque et paiement du bénéficiaire autrement" : rg.moyen === "virement" ? "Blocage de provision par virement" : "Blocage de provision en espèces"],
      ["Justificatif", cheque
        ? "Chèque n° " + chq(l) + " de " + mnt(l.montantCheque) + " remis à la banque ; bénéficiaire payé " + esc(paiementCourt(rg.paiement)) + "."
        : (rg.moyen === "virement"
          ? "Virement : somme de " + montant(rg.bloque) + " prélevée directement sur le compte du titulaire et bloquée au profit du bénéficiaire, dans l'attente d'une nouvelle présentation du chèque, pendant 1 an et 8 jours."
          : "Versement en espèces de " + montant(rg.versement) + " ; somme de " + montant(rg.bloque) + " bloquée au profit du bénéficiaire, dans l'attente d'une nouvelle présentation du chèque, pendant 1 an et 8 jours.")],
      ["Banque de France", "Régularisation déclarée à la Banque de France le " + esc(dateLongue(B.lireYmd(rg.declaree || rg.date))) + ", jour de la justification (la règle accorde 2 jours ouvrés au plus). Le fichier central des chèques est mis à jour dans le mois, d'ici le " + esc(dateLongue(B.lireYmd(rg.levee))) + "."]
    ];
    if (rg.autres > 0) constat.push(["Autres incidents", rg.autres + " autre" + (rg.autres > 1 ? "s" : "") + " incident" + (rg.autres > 1 ? "s" : "") + " de paiement à régulariser : l'interdiction d'émettre des chèques ne sera levée qu'une fois tous les incidents régularisés."]);
    return ouv +
      D.caseACocher(cheque ? tCheque : barre(tCheque), cheque) +
      D.caseACocher(cheque ? barre(tProv) : tProv, !cheque) +
      '<p class="dp-lieu">À Paris, le ' + esc(dateLongue(d)) + '</p><p class="dp-inj-sign">Signature du titulaire :</p><div class="dp-ligne-sign"></div>' +
      '<p class="dp-mention">(*) Rayer la mention inutile.</p></div>' +
      '<div class="dp-encadre dp-inj-banque"><h2>Cadre réservé à la banque</h2><div class="dp-inj-banque-corps">' + D.fiche(constat) + '<div class="dp-inj-banque-sign">' + D.signatures([D.signatureConseiller(d)]) + "</div></div></div>";
  }
  function corps(l) {
    var e = l.feminin ? "e" : "";
    var cher = l.feminin ? "Chère Cliente" : "Cher Client";
    var qual = {
      individuel: "individuellement titulaire du compte n° " + esc(l.compte) + " ouvert dans nos livres ;",
      cotitulaire: "cotitulaire du compte collectif n° " + esc(l.compte) + " ouvert dans nos livres, pour lequel il n'a été désigné aucun responsable en cas d'incident ;",
      responsable: "désigné" + e + ", en application de l'article L131-80 du Code monétaire et financier, responsable en cas d'incident sur le compte collectif n° " + esc(l.compte) + " ;"
    }[l.qualite];
    var h = '<div class="dp-lettre dp-inj"><section class="dp-inj-p1" aria-label="Lettre d\'injonction, page 1">' +
      '<p class="dp-lettre-envoi"><strong>Lettre recommandée avec avis de réception</strong></p>' +
      '<div class="dp-lettre-dest"><p><strong>' + esc(l.destinataire.nom) + "</strong><br>" + esc(l.destinataire.ligne1) + "<br>" + esc(l.destinataire.ligne2) + "</p></div>" +
      '<p class="dp-lettre-refs"><strong>Références :</strong> ' + esc(l.references) + "</p>" +
      '<p class="dp-lettre-date">Paris, le ' + esc(l.date) + "</p>" +
      '<p class="dp-lettre-objet"><strong>Objet :</strong> chèque n° ' + chq(l) + " rejeté pour défaut de provision – interdiction d'émettre des chèques</p>" +
      "<p>" + cher + ",</p>" +
      "<p>Vous êtes :</p><ul class=\"dp-liste\">" + puce(qual) + "</ul>" +
      "<p>Un chèque a été rejeté pour défaut de provision sur ce compte. En effet, la situation de votre compte, dont le solde disponible s'élevait à " + mnt(l.disponible) +
      ", n'a pas permis de payer le chèque n° " + chq(l) + " d'un montant de " + mnt(l.montantCheque) + ", qui a été rejeté le " + dRejet(l) + ".</p>" +
      '<p class="dp-inj-fort"><strong>Il vous est donc interdit d\'émettre des chèques pendant un délai de ' + DUREE_INTERDICTION + " à compter du " + esc(l.date) + ".</strong></p>" +
      "<p>En conséquence, vous ne devez plus émettre de chèques, quel que soit le compte sur lequel ils seraient tirés, sous peine de sanctions pénales, sauf s'il s'agit de chèques de retrait ou de chèques certifiés.</p>" +
      "<p>Vous devez restituer sans délai, à nous-mêmes ainsi qu'à tous vos autres banquiers (le terme « banquiers » désignant les établissements de crédit et les institutions, services ou personnes habilités à tenir des comptes sur lesquels des chèques peuvent être tirés), les carnets et formules de chèques en votre possession ou en possession de vos mandataires (personnes ayant la possibilité de tirer des chèques sur votre ou vos comptes).</p>" +
      "<p>De plus, si vous avez, sur ce compte ou sur d'autres comptes, un ou plusieurs mandataires en possession de carnets ou de formules de chèques, vous devez nous indiquer leurs nom et adresse dans les plus brefs délais.</p>" +
      "<p>Vous pouvez recouvrer la faculté d'émettre des chèques en régularisant votre situation de l'une des façons suivantes :</p><ul class=\"dp-liste\">" +
      puce("régler le montant du chèque impayé, soit entre les mains du bénéficiaire ou du porteur, soit par paiement en compte à l'occasion d'une nouvelle présentation du chèque, et nous en apporter la preuve dans le premier cas ;") +
      puce("ou déposer les fonds correspondants en nous demandant de les affecter au règlement du chèque, ce qui entraîne leur blocage dans l'attente d'une nouvelle présentation du chèque, pendant 1 an et 8 jours.") + "</ul>" +
      "<p>Nous vous informons que des moyens de paiement alternatifs au chèque (virement, prélèvement, carte de paiement à autorisation systématique) peuvent vous être proposés pour le règlement de vos dépenses, aux tarifs prévus dans les conditions générales de nos opérations. Nous vous invitons à prendre contact avec votre conseiller clientèle pour tout complément d'information.</p>" +
      "<p>Nous ne vous rétablirons dans la faculté d'émettre des chèques que si tous les incidents de paiement survenus sur ce compte sont régularisés et si vous n'êtes pas interdit" + e + " par ailleurs.</p>" +
      "<p>Conservez ce courrier : il devra nous être remis en cas de régularisation, accompagné des justificatifs de celle-ci (voir au verso).</p>" +
      "<p>Veuillez agréer, " + cher + ", l'expression de nos salutations distinguées.</p>" +
      D.signatures([D.signatureConseiller(l.dateObj)]) +
      "</section>";
    h += '<section class="dp-inj-p2' + (l.regul ? " dp-inj-p2-ok" : "") + '" aria-label="Lettre d\'injonction, page 2">' +
      "<h2>Précisions sur les principales dispositions de la loi</h2>" +
      "<h3>Interdiction d'émettre des chèques</h3><p>Elle est prononcée en application de l'article L131-73 du Code monétaire et financier.</p>" +
      "<h3>Violation de l'interdiction d'émettre des chèques</h3><p>Toute émission de chèque au mépris de l'interdiction qui vous est notifiée est passible d'un emprisonnement de cinq ans et d'une amende de 375 000 euros (article L163-2 du Code monétaire et financier).</p>" +
      "<h3>Frais</h3><p>Les frais de toute nature qu'occasionne le rejet d'un chèque sans provision sont à la charge du tireur (article L131-73 du Code monétaire et financier). Pour ce chèque, les frais de rejet s'élèvent à " + mnt(l.frais) + ".</p>" +
      "<h3>Vous êtes informé" + e + " des dispositions suivantes</h3><ol class=\"dp-liste dp-inj-num\">" +
      puce("Vous êtes inscrit" + e + " au fichier central des chèques (FCC) tenu par la Banque de France ; les références des comptes équipés de chéquiers dont vous êtes titulaire ou mandataire sont reportées au fichier national des chèques irréguliers (FNCI).") +
      puce("Vous disposez d'un droit d'accès et de rectification concernant les renseignements qui vous concernent dans ces fichiers.") +
      puce("Vous pouvez exercer ce droit d'accès auprès de la Banque de France et le droit de rectification auprès de vos établissements teneurs de comptes.") +
      puce("Si vous l'estimez nécessaire, vous pouvez obtenir de plus amples informations en vous adressant à votre agence.") + "</ol>" +
      declaration(l, e) + "</section></div>";
    return h;
  }
  function html(l) { return corps(l); }

  /* ---------- courrier d'information préalable (une page) ----------
     Envoyé avant le rejet : le chèque est présenté, le compte n'est pas assez approvisionné ; le titulaire peut régulariser par tout moyen avant l'échéance. Mentions de l'arrêté du 20 avril 2011 :
     numéro de compte, nom du titulaire, identification de la banque. La loi ne fixe aucun délai : les 5 jours ouvrés (jusqu'à 12 h) sont celui de l'agence. */
  function corpsInformation(l) {
    var e = l.feminin ? "e" : "";
    var ech = l.echeanceObj ? l.echeanceObj : null;
    var appel = l.feminin ? "Madame" : "Monsieur";
    var manque = l.montantCheque == null || l.disponible == null ? null : Math.max(arrondi(l.montantCheque - l.disponible), 0);
    var jourEch = ech ? echeanceLongue(ech) : "";
    /* encadré : la date limite de régularisation, calculée à partir de la date du courrier */
    var delai = '<div class="dp-encadre-delai" role="note"><p class="dp-delai-lib">Date limite de régularisation</p>' +
      '<p class="dp-delai-date">' + (ech ? esc(jourEch) : D.trait(true)) + "</p>" +
      '<p class="dp-delai-note">Chèque mis en suspens (en attente de paiement) pendant cinq jours ouvrés après la date de ce courrier, hors week-end et jours fériés, jusqu\'à 12 h le dernier jour.</p></div>';
    var fiche = D.fiche([
      ["Chèque n°", l.cheque ? "<strong>" + esc(l.cheque) + "</strong>" : D.trait()],
      ["Montant du chèque", l.montantCheque == null ? D.trait() : "<strong>" + montant(l.montantCheque) + "</strong>"],
      ["Émis au profit de", l.beneficiaire ? esc(l.beneficiaire) : D.trait(true)],
      ["Solde disponible de votre compte", mnt(l.disponible)],
      ["Somme à porter au crédit du compte", manque == null ? D.trait() : "<strong>" + montant(manque) + "</strong> au moins"]
    ]);
    return '<div class="dp-lettre dp-info">' +
      '<div class="dp-lettre-dest"><p><strong>' + esc(l.destinataire.nom) + "</strong><br>" + esc(l.destinataire.ligne1) + "<br>" + esc(l.destinataire.ligne2) + "</p></div>" +
      '<div class="dp-lettre-ligne"><p class="dp-lettre-refs"><strong>Références :</strong> ' + esc(l.references) + '</p><p class="dp-lettre-date">Paris, le ' + esc(l.date) + "</p></div>" +
      '<p class="dp-lettre-objet"><strong>Objet :</strong> chèque présenté sur votre compte – information avant rejet</p>' +
      "<p>" + appel + ",</p>" +
      "<p>Un chèque tiré sur votre compte a été présenté au paiement, mais le solde disponible ne permet pas de le régler. Conformément à l'article L131-73 du Code monétaire et financier, nous vous informons avant tout rejet pour que vous puissiez régulariser votre situation.</p>" +
      delai + fiche +
      '<p class="dp-sous-titre">Comment régulariser avant l\'échéance ?</p>' +
      D.liste([
        "créditez votre compte de la somme indiquée ci-dessus (versement d'espèces ou de chèques, virement) : le chèque sera alors payé ;",
        "ou contactez votre conseiller pour étudier avec lui une solution adaptée à votre situation."
      ]) +
      "<p><strong>À défaut de régularisation à l'échéance,</strong> nous serons contraints de rejeter ce chèque pour défaut de provision. Vous serez alors exposé" + e + " à :</p>" +
      D.liste([
        "des frais de rejet de " + mnt(l.frais) + " pour ce chèque ;",
        "une lettre d'injonction, adressée en recommandé avec avis de réception, vous interdisant d'émettre des chèques pendant cinq ans, auprès de tous vos banquiers ;",
        "votre inscription au fichier central des chèques (FCC) de la Banque de France."
      ]) +
      "<p>Votre conseiller vous reçoit à l'agence du mardi au vendredi (9 h-13 h et 14 h-18 h) et le samedi (9 h-13 h).</p>" +
      "<p>Nous vous prions d'agréer, " + appel + ", l'expression de nos salutations distinguées.</p>" +
      D.signatureBanque(null, l.dateObj) + "</div>";
  }
  function documentInformation(l) {
    return {
      id: "information_cheque", courrier: true, lettre: true,
      titre: "Courrier d'information préalable au rejet d'un chèque", sous: l.cheque ? "Chèque n° " + l.cheque + " mis en suspens" : "Chèque présenté sans provision",
      fichier: l.fichier,
      corps: corpsInformation(l)
    };
  }

  /* Document prêt pour impression.js : { id, titre, sous, fichier, courrier, corps }. */
  function document_(l) {
    return {
      id: "injonction", courrier: true, lettre: true,
      titre: "Lettre d'injonction", sous: l.cheque ? "Chèque n° " + l.cheque + " rejeté pour défaut de provision" : "Chèque rejeté pour défaut de provision",
      fichier: l.fichier,
      corps: corps(l)
    };
  }

  /* ---------- procédure enregistrée ----------
     procs : { clé : { inst (données du chèque), info : { date, moyens, echeance } | null, injonction : { date, qualite } | null } }, conservée dans la sauvegarde partagée de la banque.
     États : « a_informer » (rien d'enregistré), « en_suspens » (titulaire informé, échéance non atteinte), « a_valider » (échéance passée : le conseiller peut valider l'envoi de l'injonction), « envoyee ». */
  function etat(proc, now) {
    if (!proc || !proc.info) return "a_informer";
    if (proc.injonction) return "envoyee";
    var e = lireDate(proc.info.echeance);
    return e && now.getTime() >= e.getTime() ? "a_valider" : "en_suspens";
  }
  function informer(procs, cle, inst, moyens, now) {
    var codes = MOYENS.map(function (m) { return m.code; }).filter(function (c) { return (moyens || []).indexOf(c) >= 0; });
    if (!inst || !inst.ok) return { ok: false, erreur: "Aucun chèque rejeté pour défaut de provision." };
    if (!codes.length) return { ok: false, erreur: "Choisissez au moins un moyen d'informer le titulaire : la loi impose de l'informer avant le rejet du chèque." };
    if (procs[cle] && procs[cle].info) return { ok: false, erreur: "Le titulaire a déjà été informé de ce chèque." };
    procs[cle] = { inst: inst, info: { date: ecrireDate(now), moyens: codes, echeance: ecrireDate(echeance(now)) }, injonction: null };
    return { ok: true, proc: procs[cle] };
  }
  function valider(procs, cle, qualite, now) {
    var proc = procs[cle], et = etat(proc, now);
    if (et === "a_informer") return { ok: false, erreur: "Informez d'abord le titulaire du compte." };
    if (et === "envoyee") return { ok: false, erreur: "La lettre d'injonction de ce chèque est déjà envoyée." };
    if (et === "en_suspens") return { ok: false, erreur: "Le chèque reste en suspens jusqu'au " + echeanceLongue(lireDate(proc.info.echeance)) + " : l'envoi se valide à partir de cette échéance." };
    var q = QUALITES.filter(function (x) { return x.code === qualite; })[0] || QUALITES[0];
    proc.injonction = { date: ecrireDate(now), qualite: q.code };
    return { ok: true, proc: proc };
  }
  /* Libellé des moyens d'information : « courrier, appel téléphonique » */
  function moyensTexte(info) { return MOYENS.filter(function (m) { return info.moyens.indexOf(m.code) >= 0; }).map(function (m) { return m.court; }).join(", "); }

  var api = {
    AGENCE: AGENCE, QUALITES: QUALITES, VERIFICATIONS: VERIFICATIONS, SUSPENS: SUSPENS, MOYENS: MOYENS, adresse: adresse, analyse: analyse, instantane: instantane, modele: modele, lettreDepuis: lettreDepuis, lettre: lettre, information: information,
    html: html, document: document_, documentInformation: documentInformation, htmlInformation: corpsInformation, echeance: echeance, echeanceLongue: echeanceLongue, ecrireDate: ecrireDate, lireDate: lireDate, etat: etat, informer: informer, valider: valider, moyensTexte: moyensTexte, montant: montant, numeroCheque: numeroCheque, nomComplet: nomComplet
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.injonction = api; }
})(typeof window !== "undefined" ? window : null);
