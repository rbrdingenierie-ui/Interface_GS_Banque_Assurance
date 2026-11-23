/* GS Banque & Assurance – « Courriers et documents » : les documents que le conseiller remet au client et fait signer.
   Les documents, choisis par un bouton au-dessus de l'aperçu :
     – « Justificatifs à fournir pour l'ouverture d'un compte courant » (compte individuel, joint ou indivis) : pièce d'identité, justificatif de domicile, justificatifs de revenus ; 1 page ;
     – « Documents à fournir pour l'étude de votre demande de prêt » (financement d'un prêt immobilier, prêt relais compris) : 2 pages ;
     – « Documents à fournir pour l'étude de votre demande de crédit à la consommation » (prêt personnel, crédit auto, prêt travaux), limité à la situation d'un salarié en CDI : 1 page.
     – « Lettre de désistement d'un chèque » : formulaire à faire remplir par le bénéficiaire d'un chèque perdu (émetteur pré-rempli ; chèque pré-rempli quand le client a fait opposition, ?doc=desistement&cheque=…).
     – « Courrier d'information préalable au rejet d'un chèque » et « Lettre d'injonction MURCEF » : les deux courriers de la procédure MURCEF du chèque sans provision (modèles à compléter à la main : chèque, solde ; la date limite de régularisation est calculée toute seule) ;
     – « Lettre de refus d'ouverture de compte (droit au compte) » : l'attestation de refus à remettre au demandeur (motif du refus, droit au compte, saisine de la Banque de France, mandat de transmission) ; pour un dossier d'ouverture refusé
       (liste « Dossier d'ouverture refusé »), la lettre reprend l'identité du demandeur et le motif du refus ; sans dossier, le modèle porte les coordonnées du client et des cases à cocher pour le motif.
   Chacun est affiché à l'écran tel qu'il sera imprimé (cases Client et GS, cadre « Date et signatures des candidats emprunteurs ») et imprimable ou enregistrable en PDF.
   Même écran dans l'onglet « Courriers et documents » de la fiche client et dans la page « Courriers et documents » de l'accueil (courriers.html).
   Sous le choix du document, la rubrique « Autres documents » : le conseiller ajoute (ou retire) les documents qu'il attend en plus de la liste ; ils sont enregistrés pour ce client et ce document,
   figurent dans l'aperçu et dans le PDF (cases Client et GS) et à l'étape 2 du Montage de prêt.
   html(c) renvoie le HTML du volet ; lier(racine) branche les boutons une seule fois. Le document affiché peut être imposé par l'adresse (?doc=conso). */
(function () {
  "use strict";

  var SG = window.SGBF, B = SG.banque, DP = SG.documentsPret, IMP = SG.impression, ICO = SG.icones, MT = SG.montage, DS = SG.documentsService, OS = SG.operations;
  var esc = B.esc;
  var CLIENT = {}; SG.clients.forEach(function (c) { CLIENT[c.id] = c; });
  var LIB_PRODUIT = { CIMMO: "Prêt immobilier", CCONSO: "Prêt personnel", CAUTO: "Crédit auto", CTRAV: "Prêt travaux" };

  var MURCEF = !!(DS && SG.injonction);
  var DC = SG.droitCompte, PRO = SG.prospects, DAC = !!(DC && PRO);
  var DOCS = DP.LISTE.concat(DS ? [{ id: "desistement", lib: "Lettre de désistement d'un chèque" }] : []).concat(MURCEF ? [{ id: "info_cheque", lib: "Courrier d'information préalable au rejet d'un chèque" }, { id: "injonction", lib: "Lettre d'injonction MURCEF" }] : [])
    .concat(DAC ? [{ id: "droit_compte", lib: "Lettre de refus d'ouverture de compte (droit au compte)" }] : []);
  var docId = "immo", chequeId = "", refusId = "", refusQui = "";
  try {
    var q = new URLSearchParams(location.search), dq = q.get("doc");
    if (dq === "conso" || dq === "ouverture" || (dq === "desistement" && DS) || ((dq === "info_cheque" || dq === "injonction") && MURCEF) || (dq === "droit_compte" && DAC)) docId = dq;
    chequeId = q.get("cheque") || ""; refusId = q.get("dossier") || ""; refusQui = q.get("qui") || "";
  } catch (e) { /* adresse illisible : prêt immobilier */ }
  function conso() { return docId === "conso"; }
  function ouv() { return docId === "ouverture"; }
  function desist() { return docId === "desistement"; }
  function murcef() { return docId === "info_cheque" || docId === "injonction"; }
  function droit() { return docId === "droit_compte"; }
  function autres(c) { return DP.autresDe(B.store.charger(), DP.cleClient(c), docId); }
  function infos() { return DP.LISTE.filter(function (x) { return x.id === docId; })[0]; }

  /* Dossiers de prêt de ce client, du type du document affiché, qui ne sont pas encore accordés (la liste des pièces se coche à l'étape 2 du Montage de prêt). */
  function dossiersEnCours(c) {
    if (!MT) return [];
    var st = B.store.charger(), produits = infos().produits;
    return MT.dossiersClient(st, c.id).filter(function (d) { return produits.indexOf(d.p) >= 0 && MT.statutAffiche(st, d) === "brouillon"; });
  }
  function choix() {
    return '<div class="cd-choix" role="group" aria-labelledby="cd-choix-t"><span class="cd-choix-lib" id="cd-choix-t">Document à remettre</span>' + DOCS.map(function (x) {
      return '<button type="button" class="cd-choix-btn" data-cd-doc="' + x.id + '" aria-pressed="' + (x.id === docId ? "true" : "false") + '">' + esc(x.lib) + "</button>";
    }).join("") + "</div>";
  }
  function liensMontage(c) {
    var dos = dossiersEnCours(c), h = '<p class="cd-btns">';
    h += boutonImprimer();
    if (ouv()) h += '<a class="btn btn-secondaire" href="prospect.html?client=' + c.id + '">Ouvrir un compte pour ce client</a>';
    else if (MT) h += '<a class="btn btn-secondaire" href="montage.html?client=' + c.id + (conso() ? "&amp;produit=CCONSO" : "") + '">Monter un ' + (conso() ? "crédit" : "prêt") + " pour ce client</a>";
    h += "</p>";
    if (dos.length) h += '<ul class="liste-simple cd-dossiers" aria-label="Dossiers en cours">' + dos.map(function (d) {
      return '<li><span><strong>' + esc(LIB_PRODUIT[d.p] || "Prêt") + '</strong> – dossier en cours (étape ' + d.etape + ' sur 4) : les pièces se cochent à l\'étape 2</span><span class="droite"><a class="btn-texte" href="montage.html?dossier=' + esc(d.id) + '">Ouvrir le dossier</a></span></li>';
    }).join("") + "</ul>";
    return h;
  }
  function consigne(c) {
    if (ouv()) {
      return '<p class="mention" style="margin-top:0">Document à remettre au client qui souhaite ouvrir un compte courant (compte individuel, compte joint ou compte indivis) : il y trouve les pièces à présenter au rendez-vous. ' +
        "<strong>Chaque titulaire fournit ses propres pièces.</strong> Vous les contrôlez, les scannez ou les importez dans le dossier d'ouverture de compte ; les documents que vous attendez en plus s'ajoutent ci-dessous.</p>";
    }
    if (!conso()) {
      return '<p class="mention" style="margin-top:0">Document à remettre au client qui prépare un prêt immobilier (acquisition, travaux, construction, rachat de créance, prêt à taux zéro, prêt relais) : il le lit, coche les pièces qu\'il apporte, puis date et signe. ' +
        "Les pièces en gras sont indispensables à l'évaluation de sa solvabilité. Vous cochez les pièces reçues à l'étape 2 du Montage de prêt.</p>";
    }
    var h = '<p class="mention" style="margin-top:0">Document à remettre au client qui prépare un crédit à la consommation (prêt personnel, crédit auto, prêt travaux) : il le lit, coche les pièces qu\'il apporte, puis date et signe. ' +
      "La liste est celle d'un salarié en CDI ; les pièces en gras sont indispensables à l'évaluation de sa solvabilité. Vous cochez les pièces reçues à l'étape 2 du Montage de prêt.</p>";
    if (!DP.estCDI(c)) {
      h += '<p class="mention cd-attention" role="note"><strong>Ce document ne traite que le salarié en CDI.</strong> Situation professionnelle de ce client : ' + esc(c.pro.ctr || c.pro.prof || "non renseignée") +
        ". Les justificatifs de revenus sont à adapter ; à l'étape 2 du Montage de prêt, la liste suit sa situation.</p>";
    }
    return h;
  }
  /* Les documents ajoutés par le conseiller, avec un retrait par ligne, et le champ pour en ajouter un. */
  function autresHtml(c) {
    var l = autres(c), plein = l.length >= DP.AUTRES.MAX;
    return '<div class="cd-autres" role="group" aria-labelledby="cd-autres-t"><h3 class="sous-titre" id="cd-autres-t">Autres documents</h3>' +
      '<p class="mention" style="margin-top:0">Ajoutez les documents que vous attendez en plus de la liste. Ils sont enregistrés pour ce client et figurent dans la rubrique « Autres documents » du document imprimé' + (ouv() ? "." : " ; ils se cochent à l\'étape 2 du Montage de prêt.") + '</p>' +
      (l.length ? '<ul class="liste-simple cd-autres-liste" aria-label="Documents ajoutés">' + l.map(function (t) {
        return '<li><span>' + esc(t) + '</span><span class="droite"><button type="button" class="btn-texte" data-cd-autre-retrait="' + esc(DP.idAutre(t)) + '" aria-label="Retirer de la liste : ' + esc(t) + '">Retirer</button></span></li>';
      }).join("") + "</ul>" : '<p class="vide-bloc cd-autres-vide">Aucun document ajouté pour le moment.</p>') +
      '<form class="cd-autre-form" data-cd-autre-form novalidate><div class="champ"><label for="cd-autre">Document à ajouter</label><input id="cd-autre" type="text" maxlength="' + DP.AUTRES.LONGUEUR + '" autocomplete="off"' + (plein ? " disabled" : "") + ' aria-describedby="cd-autre-aide cd-autre-err" placeholder="Exemple : Attestation de l\'employeur"><span class="aide-champ" id="cd-autre-aide">' +
      (plein ? "La rubrique est pleine (" + DP.AUTRES.MAX + " documents au plus)." : l.length + " sur " + DP.AUTRES.MAX + " documents au plus.") + '</span></div>' +
      '<button type="submit" class="btn btn-secondaire"' + (plein ? " disabled" : "") + '>Ajouter à la liste</button><p class="msg-erreur" id="cd-autre-err" role="alert"></p></form></div>';
  }
  /* ---------- lettre de désistement : chèques du client en opposition, aperçu, consigne ---------- */
  function chequesClient(c) {
    if (!OS) return [];
    return OS.liste(B.store.charger(), c.id).filter(function (o) { return o.type === "opposition_cheque" && o.v && o.v.portee === "cheque" && o.statut !== "annulee"; });
  }
  function chequeChoisi(c) { return chequesClient(c).filter(function (o) { return o.id === chequeId; })[0] || null; }
  function infosCheque(op) {
    var ch = {};
    if (!op || !op.v) return ch;
    ch.numero = op.v.numero; ch.beneficiaire = op.v.beneficiaire;
    if (op.v.montant) ch.montant = B.eur2(OS.lireM(op.v.montant) || 0);
    if (op.v.emission) { var d = B.lireYmd(op.v.emission); if (d) ch.emission = B.fmtDate(d); }
    return ch;
  }
  function libCheque(o) {
    return "N° " + (o.v.numero || "non précisé") + (o.v.beneficiaire ? " – " + o.v.beneficiaire : "") + (o.v.montant ? " – " + B.eur2(OS.lireM(o.v.montant) || 0) : "") + " (opposition du " + B.fmtDate(B.lireYmd(o.date)) + ")";
  }
  function consigneDesist(c) {
    var l = chequesClient(c), op = chequeChoisi(c);
    var h = '<p class="mention" style="margin-top:0">Document à faire remplir par le <strong>bénéficiaire d\'un chèque perdu</strong> : il écrit à l\'émetteur (le client) pour renoncer à l\'encaisser et s\'engager à le restituer s\'il le retrouve. ' +
      "Ce n'est pas une opération de service : le formulaire est remis au client, qui le transmet au bénéficiaire ; le client n'a pas à le signer.</p>";
    if (!l.length) return h + '<p class="vide-bloc">Aucune opposition sur chèque enregistrée pour ce client : le formulaire est remis vierge, le bénéficiaire le remplit à la main. L\'opposition se fait dans « Opérations de service ».</p>';
    return h + '<div class="champ cd-cheque"><label for="cd-cheque">Chèque concerné</label><select id="cd-cheque" aria-describedby="cd-cheque-aide"><option value="">Aucun : formulaire vierge, à remplir à la main</option>' + l.map(function (o) {
      return '<option value="' + esc(o.id) + '"' + (op && op.id === o.id ? " selected" : "") + ">" + esc(libCheque(o)) + "</option>";
    }).join("") + '</select><span class="aide-champ" id="cd-cheque-aide">Choisissez le chèque pour reprendre son numéro, son montant, sa date d\'émission et son bénéficiaire dans le formulaire.</span></div>';
  }
  function documentAffiche(c) {
    if (desist()) return DS.desistement(c, { cheque: infosCheque(chequeChoisi(c)) });
    if (docId === "info_cheque") return DS.courrierInformation(c, { date: B.aujourdhui() });
    if (docId === "injonction") return DS.lettreInjonction(c, { date: B.aujourdhui() });
    if (droit()) { var dr = dossierRefus(); return dr ? lettreDossier(dr) : lettreClient(c); }
    return DP.documentPour(docId, c, B.aujourdhui(), autres(c));
  }
  /* Procédure MURCEF : consigne du courrier, avec la règle de délai de l'agence et le renvoi vers l'outil « Payer ou rejeter » qui reprend les données du chèque. */
  function consigneMurcef() {
    var info = docId === "info_cheque";
    return '<p class="mention" style="margin-top:0">' + (info
      ? "Courrier à adresser au titulaire d'un compte <strong>avant de rejeter un chèque sans provision</strong> (procédure MURCEF, art. L131-73 du Code monétaire et financier) : le chèque est mis en suspens et le titulaire peut régulariser. "
      : "Lettre à adresser en <strong>recommandé avec avis de réception</strong> au titulaire dont le chèque est rejeté pour défaut de provision, s'il n'a pas régularisé sa situation avant l'échéance (procédure MURCEF, art. L131-73 et R131-15 du Code monétaire et financier). ") +
      "La <strong>date limite de régularisation</strong> " + (info ? "est calculée toute seule sur le courrier" : "figure sur le courrier d'information qui précède") + " : 5 jours ouvrés après la date du courrier, hors week-end et jours fériés, jusqu'à 12 h le dernier jour. Ce délai est celui de l'agence : la loi n'en fixe pas. " +
      "Le numéro et le montant du chèque, le solde et la date du rejet sont à compléter à la main ; l'outil « Payer ou rejeter » les reprend du dossier et conduit la procédure complète (information, suspens, validation de l'envoi).</p>" +
      '<p class="cd-btns">' + boutonImprimer() + '<a class="btn btn-secondaire" href="debiteurs.html">Ouvrir l\'outil « Payer ou rejeter »</a></p>';
  }
  /* ---------- lettre de refus d'ouverture de compte (droit au compte) ---------- */
  function dossiersRefuses() { return DAC ? PRO.dossiers(B.store.charger()).filter(function (d) { return PRO.etat(d).code === "refuse"; }) : []; }
  function dossierRefus() { return dossiersRefuses().filter(function (d) { return String(d.id) === String(refusId); })[0] || null; }
  function nomRefuse(r) { return r.p.civ + " " + r.p.prenom + " " + r.p.nom.toUpperCase(); }
  /* Une lettre par personne refusée : le demandeur, et le second titulaire d'un compte joint ou indivis s'il est lui-même refusé. */
  function refusDuDossier(d) { return PRO.refusDe(d); }
  function libRefus(d, r) { return d.ref + " – " + nomRefuse(r) + (r.cle === "principal" && !d.fiche.client ? " (prospect)" : "") + ", refusé" + (r.par === "conseiller" ? " par le conseiller" : " par la directrice") + " le " + B.fmtDate(PRO.dateRefus(d)); }
  /* La lettre d'un dossier refusé est datée du jour du refus (elle est remise sans délai) ; le modèle d'un client est daté du jour. */
  function refusChoisi(d, qui) { var l = refusDuDossier(d); return l.filter(function (r) { return r.cle === qui; })[0] || l[0]; }
  function lettreDossier(d, qui) { return DC.depuisDossier(d, refusChoisi(d, qui === undefined ? refusQui : qui), PRO.dateRefus(d)); }
  function lettreClient(c) { return DC.lettre(DC.personneClient(c), { date: B.aujourdhui(), motifs: [] }); }
  function consigneDroit(c) {
    var l = dossiersRefuses(), dos = dossierRefus();
    var h = '<p class="mention" style="margin-top:0">Lettre à remettre en main propre à la personne dont la banque refuse d\'ouvrir un compte de dépôt : elle indique le <strong>motif du refus</strong>, rappelle son <strong>droit au compte</strong> (article L312-1 du Code monétaire et financier) ' +
      "et explique que la <strong>Banque de France désignera un établissement</strong> qui devra lui ouvrir un compte et lui fournir gratuitement les services bancaires de base. La banque la remet gratuitement et sans délai, et propose de transmettre la demande à la Banque de France au nom du demandeur (mandat en page 2).</p>";
    if (!l.length) return h + '<p class="vide-bloc">Aucun dossier d\'ouverture refusé : le modèle ci-dessous porte les coordonnées du client, avec des cases à cocher pour le motif du refus. Un dossier refusé dans « Ouverture de compte » apparaît ici avec son motif.</p>';
    return h + '<div class="champ cd-refus"><label for="cd-refus">Dossier d\'ouverture refusé</label><select id="cd-refus" aria-describedby="cd-refus-aide"><option value="">Aucun : modèle à compléter</option>' + l.map(function (d) {
      var rs = refusDuDossier(d), ch = dos && dos.id === d.id ? refusChoisi(d, refusQui) : null;
      return rs.map(function (r) { return '<option value="' + d.id + ":" + r.cle + '"' + (ch && ch.cle === r.cle ? " selected" : "") + ">" + esc(libRefus(d, r)) + "</option>"; }).join("");
    }).join("") + '</select><span class="aide-champ" id="cd-refus-aide">Choisissez le dossier pour reprendre l\'identité du demandeur, la date de sa demande et le motif du refus dans la lettre.</span></div>';
  }
  function apercuHtml(d) {
    if (d.lettre) return '<div class="apercu-doc" role="region" tabindex="0" aria-label="Aperçu du document : ' + esc(d.titre) + '">' + IMP.enteteLettre() + d.corps + "</div>";
    return '<div class="apercu-doc" role="region" tabindex="0" aria-label="Aperçu du document : ' + esc(d.titre) + '">' +
      '<div class="cd-ap-marque"><img src="assets/logo.png" width="52" height="52" alt=""><p><strong>' + esc(DP.AGENCE[0]) + "</strong><br>" + esc(DP.AGENCE[1]) + "</p></div>" +
      '<h2 class="cd-ap-titre">' + esc(d.titre) + '</h2><p class="cd-ap-sous">' + esc(d.sous) + "</p>" + d.corps + "</div>";
  }
  function boutonImprimer() { return '<button type="button" class="btn btn-principal btn-impr" data-cd="imprimer">' + (ICO && ICO.imprimante ? ICO.imprimante : "") + "<span>Imprimer le document (PDF)</span></button>"; }
  function htmlDesist(c) {
    return '<div class="cd-zone" data-cd-client="' + c.id + '" data-cd-document="desistement">' +
      '<section class="bloc" aria-labelledby="cd-t"><div class="bloc-tete"><h2 id="cd-t" tabindex="-1">Courriers et documents</h2></div>' +
      choix() + consigneDesist(c) + '<p class="cd-btns">' + boutonImprimer() + "</p>" + apercuHtml(documentAffiche(c)) + "</section></div>";
  }
  function htmlMurcef(c) {
    return '<div class="cd-zone" data-cd-client="' + c.id + '" data-cd-document="' + docId + '">' +
      '<section class="bloc" aria-labelledby="cd-t"><div class="bloc-tete"><h2 id="cd-t" tabindex="-1">Courriers et documents</h2></div>' +
      choix() + consigneMurcef() + apercuHtml(documentAffiche(c)) + "</section></div>";
  }
  function htmlDroit(c) {
    return '<div class="cd-zone" data-cd-client="' + c.id + '" data-cd-document="droit_compte">' +
      '<section class="bloc" aria-labelledby="cd-t"><div class="bloc-tete"><h2 id="cd-t" tabindex="-1">Courriers et documents</h2></div>' +
      choix() + consigneDroit(c) + '<p class="cd-btns">' + boutonImprimer() + (PRO ? '<a class="btn btn-secondaire" href="prospect.html">Ouverture de compte</a>' : "") + "</p>" + apercuHtml(documentAffiche(c)) + "</section></div>";
  }
  /* Même lettre pour un dossier refusé dont le demandeur n'est pas un client de l'agence (page « Courriers et documents » ouverte depuis le dossier) : pas de choix de client. */
  function htmlDossier(d) {
    var doc = lettreDossier(d);
    return '<div class="cd-zone" data-cd-dossier="' + d.id + '" data-cd-document="droit_compte">' +
      '<section class="bloc" aria-labelledby="cd-t"><div class="bloc-tete"><h2 id="cd-t" tabindex="-1">Courriers et documents</h2></div>' +
      '<p class="mention" style="margin-top:0">Lettre de refus d\'ouverture de compte (droit au compte) du dossier <strong>' + esc(d.ref) + "</strong> : " + esc(nomRefuse(refusChoisi(d, refusQui))) + (refusChoisi(d, refusQui).cle === "principal" ? ", prospect" : ", second titulaire") + ". " +
      "Elle est remise en main propre, avec le motif du refus, et propose de transmettre la demande à la Banque de France.</p>" +
      '<p class="cd-btns">' + boutonImprimer() + '<a class="btn btn-secondaire" href="prospect.html?dossier=' + d.id + '">Ouvrir le dossier</a></p>' + apercuHtml(doc) + "</section></div>";
  }
  function html(c) {
    if (droit()) return htmlDroit(c);
    if (desist()) return htmlDesist(c);
    if (murcef()) return htmlMurcef(c);
    var d = DP.documentPour(docId, c, B.aujourdhui(), autres(c));
    return '<div class="cd-zone" data-cd-client="' + c.id + '" data-cd-document="' + docId + '">' +
      '<section class="bloc" aria-labelledby="cd-t"><div class="bloc-tete"><h2 id="cd-t" tabindex="-1">Courriers et documents</h2></div>' +
      choix() + consigne(c) + autresHtml(c) + liensMontage(c) +
      apercuHtml(d) + "</section></div>";
  }
  function imprimerDossier(d) {
    var doc = lettreDossier(d);
    IMP.imprimer(IMP.document({ titre: doc.titre, sous: doc.sous, corps: doc.corps, courrier: false, lettre: true }), doc.fichier);
  }
  function imprimer(c) {
    var d = documentAffiche(c);
    IMP.imprimer(IMP.document({ titre: d.titre, sous: d.sous, corps: d.corps, courrier: !!d.courrier, lettre: !!d.lettre }), d.fichier);
  }
  /* L'adresse garde le document choisi (?doc=conso), sans toucher au reste (client, onglet). */
  function majAdresse() {
    try {
      var u = new URL(location.href);
      if (docId !== "immo") u.searchParams.set("doc", docId); else u.searchParams.delete("doc");
      if (desist() && chequeId) u.searchParams.set("cheque", chequeId); else u.searchParams.delete("cheque");
      if (droit() && refusId) { u.searchParams.set("dossier", refusId); if (refusQui) u.searchParams.set("qui", refusQui); else u.searchParams.delete("qui"); } else { u.searchParams.delete("dossier"); u.searchParams.delete("qui"); }
      history.replaceState(null, "", u.pathname + u.search + u.hash);
    } catch (e) { /* adresse non modifiable : sans importance */ }
  }
  function suffixeAdresse() { return docId !== "immo" ? "&doc=" + docId + (desist() && chequeId ? "&cheque=" + encodeURIComponent(chequeId) : "") + (droit() && refusId ? "&dossier=" + encodeURIComponent(refusId) + (refusQui ? "&qui=" + encodeURIComponent(refusQui) : "") : "") : ""; }
  function lier(racine) {
    brancherAjout(racine);
    racine.addEventListener("change", function (e) {
      if (e.target && e.target.id === "cd-refus") {
        var zd = e.target.closest("[data-cd-client]"), cd = zd ? CLIENT[parseInt(zd.getAttribute("data-cd-client"), 10)] : null; if (!cd) return;
        var vr = String(e.target.value).split(":"); refusId = vr[0]; refusQui = vr[1] || ""; majAdresse(); zd.outerHTML = html(cd);
        var nr = racine.querySelector("#cd-refus"); if (nr) nr.focus();
        return;
      }
      if (!e.target || e.target.id !== "cd-cheque") return;
      var z = e.target.closest("[data-cd-client]"), cl = z ? CLIENT[parseInt(z.getAttribute("data-cd-client"), 10)] : null; if (!cl) return;
      chequeId = e.target.value; majAdresse(); z.outerHTML = html(cl);
      var n = racine.querySelector("#cd-cheque"); if (n) n.focus();
    });
    racine.addEventListener("click", function (e) {
      var cible = e.target.closest ? e.target : null; if (!cible) return;
      var ch = cible.closest('[data-cd-doc]');
      if (ch) {
        var zone = ch.closest("[data-cd-client]"), cl = zone ? CLIENT[parseInt(zone.getAttribute("data-cd-client"), 10)] : null, nouveau = ch.getAttribute("data-cd-doc");
        if (!cl || nouveau === docId) return;
        docId = nouveau; majAdresse();
        zone.outerHTML = html(cl);
        var bouton = racine.querySelector('[data-cd-doc="' + docId + '"]'); if (bouton) bouton.focus();
        return;
      }
      var rt = cible.closest('[data-cd-autre-retrait]');
      if (rt) {
        var zr = rt.closest("[data-cd-client]"), cr = zr ? CLIENT[parseInt(zr.getAttribute("data-cd-client"), 10)] : null; if (!cr) return;
        var st = B.store.charger(), res = DP.retirerAutre(st, DP.cleClient(cr), docId, rt.getAttribute("data-cd-autre-retrait"));
        if (res.ok) B.store.sauver();
        zr.outerHTML = html(cr);
        var champ = racine.querySelector("#cd-autre"); if (champ && !champ.disabled) champ.focus();
        return;
      }
      var b = cible.closest('[data-cd="imprimer"]'); if (!b) return;
      var zp = b.closest("[data-cd-dossier]");
      if (zp && PRO) { var dp = PRO.dossier(B.store.charger(), parseInt(zp.getAttribute("data-cd-dossier"), 10)); if (dp) imprimerDossier(dp); return; }
      var z = b.closest("[data-cd-client]"), c = z ? CLIENT[parseInt(z.getAttribute("data-cd-client"), 10)] : null;
      if (c) imprimer(c);
    });
  }
  /* Ajout d'un document (touche Entrée ou bouton) : contrôle sur place, le texte saisi reste en cas d'erreur. */
  function brancherAjout(racine) {
    racine.addEventListener("submit", function (e) {
      var f = e.target.closest ? e.target.closest("[data-cd-autre-form]") : null; if (!f) return;
      e.preventDefault();
      var z = f.closest("[data-cd-client]"), c = z ? CLIENT[parseInt(z.getAttribute("data-cd-client"), 10)] : null; if (!c) return;
      var champ = f.querySelector("#cd-autre"), msg = f.querySelector("#cd-autre-err"), st = B.store.charger(), r = DP.ajouterAutre(st, DP.cleClient(c), docId, champ.value);
      if (!r.ok) { champ.setAttribute("aria-invalid", "true"); msg.textContent = r.erreur; champ.focus(); return; }
      B.store.sauver(); z.outerHTML = html(c);
      var n = racine.querySelector("#cd-autre"); if (n) n.focus();
    });
    racine.addEventListener("input", function (e) {
      if (!e.target || e.target.id !== "cd-autre") return;
      e.target.removeAttribute("aria-invalid"); var m = racine.querySelector("#cd-autre-err"); if (m) m.textContent = "";
    });
  }
  /* Dossier refusé d'un demandeur qui n'est pas client (adresse ?doc=droit_compte&dossier=…) : sa lettre, sans choix de client ; null si le dossier n'existe pas ou n'est pas refusé. */
  function dossierSansClient(id) {
    if (!DAC) return null;
    var d = PRO.dossier(B.store.charger(), parseInt(id, 10));
    return d && !d.fiche.client && PRO.etat(d).code === "refuse" ? d : null;
  }
  SG.courriersUI = { html: html, htmlDossier: htmlDossier, dossierSansClient: dossierSansClient, lier: lier, imprimer: imprimer, suffixeAdresse: suffixeAdresse };
})();
