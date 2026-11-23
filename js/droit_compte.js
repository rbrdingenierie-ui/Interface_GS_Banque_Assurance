/* GS Banque & Assurance – lettre de refus d'ouverture de compte et droit au compte (article L312-1 du Code monétaire et financier).
   Quand la banque refuse d'ouvrir un compte de dépôt, elle remet gratuitement et sans délai au demandeur une attestation de refus, qui indique le motif du refus
   et l'informe qu'il peut saisir la Banque de France pour qu'elle lui désigne un établissement ; la banque lui propose aussi de transmettre sa demande en son nom et pour son compte.
   Ce module ne fabrique que le texte de la lettre (HTML) : deux pages A4.
     – page 1 : la lettre (références, objet, motif du refus, droit au compte, deux façons de saisir la Banque de France, pièces à joindre, signature de l'agence) ;
     – page 2 : la suite de la procédure (délais), les services bancaires de base gratuits, le mandat de transmission à la Banque de France (à cocher et signer par le demandeur) et les textes applicables.
   lettre(personne, opts) renvoie { id, titre, sous, fichier, courrier, lettre, corps } ; le corps se place dans impression.document({ lettre: true }).
   personne : { civ, prenom, nom, naissance (AAAA-MM-JJ, facultatif), rue, cp, ville }.
   opts : { date: Date, ref: référence du dossier (facultatif), demande: date de la demande AAAA-MM-JJ (facultatif), motifs: ["fcc"], ["ficp"] ou ["fcc_ficp"] (vide : cases à cocher), appreciation: motif de l'appréciation de l'agence (facultatif), interrogation: date de la consultation de la Banque de France AAAA-MM-JJ (facultatif) }.
   Textes vérifiés (novembre 2026) : service-public.gouv.fr (fiche F2417), formulaire de demande de droit au compte de la Banque de France, décret n° 2022-347 du 11 mars 2022 (articles R312-6 à R312-8-1),
   article L312-1 du Code monétaire et financier. Fonctions pures, testées avec Node. */
(function (root) {
  "use strict";

  var D = (root && root.SGBF && root.SGBF.documents) || require("./documents.js");

  var BANQUE_DE_FRANCE = { adresse: "Banque de France – TSA 50120 – 75035 Paris Cedex 01", enLigne: "accueil.banque-france.fr", rendezVous: "3414" };
  var TEXTES = [
    ["L312-1", "droit au compte, attestation de refus, désignation d'un établissement par la Banque de France"],
    ["R312-6-1", "attestation de refus : motif du refus et possibilité de saisir la Banque de France"],
    ["R312-7 et R312-7-1", "notification des pièces à fournir par l'établissement désigné, caducité de la désignation"],
    ["D312-5-1", "services bancaires de base"]
  ];
  /* Services bancaires de base, fournis gratuitement par l'établissement désigné (article D312-5-1). */
  var SERVICES_DE_BASE = [
    "l'ouverture, la tenue et la clôture du compte ;",
    "un changement d'adresse par an ;",
    "la délivrance de relevés d'identité bancaire (RIB) ;",
    "la domiciliation de virements bancaires ;",
    "l'envoi mensuel d'un relevé des opérations effectuées sur le compte ;",
    "l'encaissement de chèques et de virements bancaires ;",
    "les dépôts et les retraits d'espèces au guichet de l'organisme teneur du compte ;",
    "les paiements par prélèvement et par virement bancaire (SEPA) ;",
    "des moyens de consultation à distance du solde du compte ;",
    "une carte de paiement dont chaque utilisation est autorisée par la banque (autorisation systématique) ;",
    "deux formules de chèques de banque par mois, ou moyens de paiement équivalents offrant les mêmes services."
  ];
  /* Motifs d'un refus : l'inscription aux fichiers de la Banque de France est examinée par l'agence (aucun refus automatique) ; le motif de l'appréciation figure sous la liste (opts.appreciation). */
  function constat(o, fichier) { return o.interrogation ? ", constatée lors de la consultation " + fichier + " le " + D.dateLongue(lire(o.interrogation)) : ""; }
  var MOTIFS = {
    fcc: function (o) {
      return "Votre inscription au fichier central des chèques (FCC) de la Banque de France (interdiction d'émettre des chèques)" + constat(o, "du fichier") + ", examinée par l'agence, ne nous permet pas d'ouvrir le compte demandé.";
    },
    ficp: function (o) {
      return "Votre inscription au fichier des incidents de remboursement des crédits aux particuliers (FICP) de la Banque de France" + constat(o, "du fichier") + ", examinée par l'agence, ne nous permet pas d'ouvrir le compte demandé.";
    },
    fcc_ficp: function (o) {
      return "Votre inscription au fichier central des chèques (FCC, interdiction d'émettre des chèques) et au fichier des incidents de remboursement des crédits aux particuliers (FICP) de la Banque de France" + constat(o, "des fichiers") + ", examinée par l'agence, ne nous permet pas d'ouvrir le compte demandé.";
    }
  };

  function e(s) { return D.esc(s); }
  function lire(ymd) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || "")); return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : new Date(NaN); }
  function dateOk(ymd) { return !isNaN(lire(ymd).getTime()); }
  function feminin(p) { return p.civ === "Mme" || p.civ === "Mlle"; }
  function nomComplet(p) { return p.civ + " " + p.prenom + " " + String(p.nom).toUpperCase(); }
  function souligne(c) { return feminin(c) ? "e" : ""; }

  /* Motifs affichés : ceux du dossier, ou les cases à cocher d'un modèle à compléter. */
  function motifsHtml(p, o) {
    var codes = (o.motifs || []).filter(function (k) { return MOTIFS[k]; });
    if (codes.length) return "<ul class=\"dp-liste\">" + codes.map(function (k) { return "<li>" + e(MOTIFS[k](o)) + "</li>"; }).join("") + (o.appreciation ? "<li>Appréciation de l'agence : " + e(o.appreciation) + "</li>" : "") + "</ul>";
    return D.caseACocher("Inscription au fichier central des chèques (FCC) de la Banque de France.") +
      D.caseACocher("Pièces justificatives non fournies ou non conformes.") +
      D.caseACocher("Autre motif : " + D.trait(true));
  }

  function lettre(p, opts) {
    opts = opts || {};
    var date = opts.date || new Date(), a = souligne(p), appel = feminin(p) ? "Madame" : "Monsieur";
    var ligneAdresse2 = (p.cp ? p.cp + " " : "") + (p.ville || "");
    var refs = "Demande d'ouverture de compte de dépôt" + (opts.demande && dateOk(opts.demande) ? " du " + D.dateCourte(lire(opts.demande)) : "") + (opts.ref ? " – dossier " + opts.ref : "");
    var demande = opts.demande && dateOk(opts.demande) ? " le " + D.dateLongue(lire(opts.demande)) : "";

    var p1 = '<section class="dp-dac-p1" aria-label="Attestation de refus, page 1">' +
      '<p class="dp-lettre-envoi"><strong>Remise en main propre contre signature</strong></p>' +
      '<div class="dp-lettre-dest"><p><strong>' + e(nomComplet(p)) + "</strong><br>" + e(p.rue || "") + "<br>" + e(ligneAdresse2) + "</p></div>" +
      '<p class="dp-lettre-refs"><strong>Références :</strong> ' + e(refs) + "</p>" +
      '<p class="dp-lettre-date">Paris, le ' + e(D.dateLongue(date)) + "</p>" +
      '<p class="dp-lettre-objet"><strong>Objet :</strong> attestation de refus d\'ouverture de compte de dépôt – droit au compte (article L312-1 du Code monétaire et financier)</p>' +
      "<p>" + appel + ",</p>" +
      "<p>Vous avez demandé à GS Banque &amp; Assurance, agence de Paris, l'ouverture d'un compte de dépôt" + e(demande) + ". Nous vous informons que nous ne pouvons pas donner suite à votre demande.</p>" +
      '<h3>Motif du refus</h3>' + motifsHtml(p, opts) +
      '<h3>Votre droit au compte</h3>' +
      "<p>Ce refus ne vous prive pas de votre droit au compte. En application de l'article L312-1 du Code monétaire et financier, toute personne domiciliée en France qui n'est titulaire d'aucun compte de dépôt en France a droit à l'ouverture d'un tel compte. " +
      "Vous pouvez demander à la <strong>Banque de France</strong> de vous <strong>désigner un établissement de crédit</strong>, situé à proximité de votre domicile ou de votre lieu de travail, qui sera tenu de vous ouvrir un compte et de vous fournir <strong>gratuitement les services bancaires de base</strong> (page suivante). " +
      "Cette démarche reste ouverte aux personnes inscrites au fichier central des chèques ou au fichier des incidents de remboursement des crédits aux particuliers.</p>" +
      "<p>Cette attestation vous est remise gratuitement et sans délai. Conservez-la : elle doit être jointe à votre demande auprès de la Banque de France.</p>" +
      '<h3>Deux façons de faire votre demande</h3><ul class="dp-liste">' +
      "<li><strong>Nous transmettons votre demande.</strong> Nous vous proposons d'agir en votre nom et pour votre compte et de transmettre gratuitement votre demande à la Banque de France, avec les informations et pièces qu'elle exige. Si vous êtes d'accord, cochez la première case du mandat de transmission (page suivante), puis datez et signez.</li>" +
      "<li><strong>Vous saisissez vous-même la Banque de France</strong> : en ligne (" + e(BANQUE_DE_FRANCE.enLigne) + "), par courrier (" + e(BANQUE_DE_FRANCE.adresse) + ") ou à un guichet de la Banque de France, sur rendez-vous (" + e(BANQUE_DE_FRANCE.rendezVous) + ").</li></ul>" +
      "<p><strong>Pièces à joindre :</strong> le formulaire de demande de droit au compte de la Banque de France, qui comporte votre déclaration sur l'honneur de n'être titulaire d'aucun compte de dépôt en France ; une pièce d'identité en cours de validité ; un justificatif de domicile de moins de trois mois ; la présente attestation de refus.</p>" +
      "<p>Veuillez agréer, " + appel + ", l'expression de nos salutations distinguées.</p>" +
      D.signatures([D.signatureConseiller(date)]) +
      "</section>";

    var p2 = '<section class="dp-dac-p2" aria-label="Attestation de refus, page 2">' +
      "<h2>La suite de votre demande</h2>" +
      '<ul class="dp-liste">' +
      "<li>La Banque de France désigne un établissement dans un délai d'<strong>un jour ouvré</strong> à compter de la réception des pièces demandées, et vous en informe par courrier (article L312-1).</li>" +
      "<li>L'établissement désigné vous indique, dans un délai de <strong>trois jours ouvrés</strong>, les pièces nécessaires à l'ouverture du compte et les coordonnées de l'agence (article R312-7). Si vous ne donnez pas suite dans les <strong>six mois</strong>, la désignation devient caduque (article R312-7-1).</li>" +
      "<li>Il ouvre le compte dans un délai de <strong>trois jours ouvrés</strong> à compter de la réception de l'ensemble des pièces (article L312-1).</li></ul>" +
      "<h3>Services bancaires de base, fournis gratuitement par l'établissement désigné</h3>" +
      D.liste(SERVICES_DE_BASE.map(e)) +
      "<p>Le chéquier et l'autorisation de découvert ne font pas partie des services bancaires de base (articles L312-1 et D312-5-1).</p>" +
      '<div class="dp-encadre dp-dac-mandat"><h2>Mandat de transmission à la Banque de France</h2>' +
      "<p>Je soussigné" + a + " <strong>" + e(nomComplet(p)) + "</strong>" + (p.naissance && dateOk(p.naissance) ? ", né" + a + " le " + e(D.dateLongue(lire(p.naissance))) : "") + ", demeurant " + e((p.rue ? p.rue + ", " : "") + ligneAdresse2) + ", " +
      "déclare sur l'honneur n'être titulaire d'aucun compte de dépôt en France, et :</p>" +
      D.caseACocher("<strong>donne mandat</strong> à GS Banque &amp; Assurance – agence de Paris d'agir en mon nom et pour mon compte pour transmettre gratuitement à la Banque de France ma demande de désignation d'un établissement de crédit, avec les informations et les pièces qu'elle exige (article L312-1).") +
      D.caseACocher("<strong>ne souhaite pas</strong> que l'agence transmette ma demande : je saisis moi-même la Banque de France.") +
      "<p>Établissement souhaité ou non souhaité (facultatif) : " + D.trait(true) + "</p>" +
      "<p class=\"dp-dac-pieces\">Pièces remises à l'agence :</p>" + D.caseACocher("pièce d'identité en cours de validité") + D.caseACocher("justificatif de domicile de moins de trois mois") + D.caseACocher("présente attestation de refus d'ouverture de compte") +
      '<p class="dp-lieu">Fait à ' + D.trait() + ", le " + D.trait() + '</p><p class="dp-dac-sign">Lu et approuvé – signature du demandeur :</p><div class="dp-ligne-sign"></div></div>' +
      '<p class="dp-dac-textes"><strong>Textes applicables (Code monétaire et financier) :</strong> ' + TEXTES.map(function (t) { return "article " + e(t[0]) + " (" + e(t[1]) + ")"; }).join(" ; ") + ".</p>" +
      "</section>";

    var nom = String(p.nom).toUpperCase() + " " + p.prenom;
    return {
      id: "droit_compte",
      titre: "Lettre de refus d'ouverture de compte – droit au compte",
      sous: nom + " – " + (opts.ref ? "dossier " + opts.ref + " – " : "") + "refus du " + D.dateCourte(date),
      fichier: D.fichier("Refus_ouverture_compte", { nom: p.nom, prenom: p.prenom }, date),
      courrier: false, lettre: true,
      corps: '<div class="dp-lettre dp-dac">' + p1 + p2 + "</div>"
    };
  }

  /* Personne d'un client de l'agence ou d'un dossier d'ouverture (fiche du dossier). */
  function personneClient(c) { return { civ: c.civ, prenom: c.prenom, nom: c.nom, naissance: "", rue: c.adr ? c.adr.rue : "", cp: c.adr ? c.adr.cp : "", ville: c.adr ? c.adr.ville : "" }; }
  function personneFiche(f) { return { civ: f.civ, prenom: f.prenom, nom: f.nom, naissance: f.naissance || "", rue: f.rue, cp: f.cp, ville: f.ville }; }

  /* Lettre d'un dossier d'ouverture refusé : d = le dossier (prospects.js), refus = l'entrée de la personne refusée donnée par prospects.refusDe(d) { cle, p (la personne : fiche ou titulaire), par, motif, fcc, ficp },
     date = date de remise (celle du refus). Chaque personne refusée reçoit sa lettre, à son nom et à son adresse ; le motif est celui du conseiller ou de la directrice. */
  function depuisDossier(d, refus, date) {
    var f = d.fiche, p = refus.p, bdf = p.bdf, code = refus.fcc && refus.ficp ? "fcc_ficp" : refus.ficp ? "ficp" : "fcc";
    return lettre(personneFiche(p), { date: date, ref: d.ref, demande: d.soumis && d.soumis[0] ? d.soumis[0].date : (d.conseiller && d.conseiller.date) || "", motifs: [code], appreciation: refus.motif, interrogation: bdf && bdf.date ? bdf.date : "" });
  }

  var api = { lettre: lettre, depuisDossier: depuisDossier, personneClient: personneClient, personneFiche: personneFiche, SERVICES_DE_BASE: SERVICES_DE_BASE, TEXTES: TEXTES, BANQUE_DE_FRANCE: BANQUE_DE_FRANCE, MOTIFS: Object.keys(MOTIFS) };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.droitCompte = api; }
})(typeof window !== "undefined" ? window : null);
