/* GS Banque & Assurance – « Documents à fournir pour l'étude de votre demande de prêt » (financement d'un prêt immobilier).
   Un seul texte de référence, deux usages :
     – le document que le conseiller remet au client et fait signer (onglet « Courriers et documents » de la fiche client et page « Courriers et documents » de l'accueil) :
       document(client) renvoie { id, titre, sous, fichier, courrier, corps } ; le corps se place dans impression.document() ;
     – la liste des pièces à réunir à l'étape 2 du Montage de prêt (montage.js) : mêmes rubriques, mêmes libellés, mêmes pièces en gras.
   Les pièces en gras sont celles que le candidat emprunteur doit fournir pour que la banque puisse évaluer sa solvabilité ; les autres dépendent de la situation et du projet.
   La rubrique « Dans le cas d'un prêt relais » (mandat de vente, avis de valeur) complète la liste habituelle.
   Second document, même mise en page : « Documents à fournir pour l'étude de votre demande de crédit à la consommation » (prêt personnel, crédit auto, prêt travaux), limité à la situation
   d'un salarié en CDI : pièce d'identité, justificatif de domicile, relevés de compte et RIB, trois derniers bulletins de salaire, dernier avis d'imposition, puis bon de commande ou devis signé
   pour un crédit affecté, et justificatif de financement pour tout prêt supérieur à 15 000 €. Il est exposé sous « CONSO » (mêmes fonctions que le document immobilier) ; documentPour(id, client, date) choisit l'un ou l'autre.
   Les mots « fictif » et le mot de passe des exercices n'apparaissent jamais dans ces textes. Fonctions pures, testées avec Node. */
(function (root) {
  "use strict";

  var D = (root && root.SGBF && root.SGBF.documents) || require("./documents.js");
  var esc = D.esc;

  /* Une pièce : { id, lib, gras, cond } ; lib est un texte, ou une suite de morceaux [texte, gras] quand une partie seulement de la ligne est en gras ;
     cond signale une pièce que le document réclame seulement dans un cas particulier (« Si divorce… », « si revenus locatifs », « si travaux seuls »…) : à l'étape 2 du Montage de prêt,
     elle se coche si le client la fournit mais ne compte pas parmi les pièces manquantes. */
  function p(id, lib, gras, cond) { return { id: id, lib: lib, gras: !!gras, cond: !!cond }; }
  var RUBRIQUES = [
    { id: "etat_civil", titre: "ÉTAT CIVIL", pieces: [
      p("cni", "Carte d'identité, passeport en cours de validité", true),
      p("dom", "Justificatif de domicile (facture d'eau, de gaz, d'électricité)"),
      p("livret", "Livret de famille"),
      p("couple", "Contrat de mariage / enregistrement PACS"),
      p("divorce", "Si divorce < 3 ans, jugement de divorce avec convention définitive"),
      p("instance", "Si instance de divorce, convention réglant les conséquences financières du divorce signée des avocats des 2 parties", false, true)
    ] },
    { id: "pro", titre: "SITUATION PROFESSIONNELLE", pieces: [
      p("bulletins", "Trois derniers bulletins de salaire/pension + décembre N-1", true),
      p("avis", "Avis d'imposition N-1 et N-2 (ou trois derniers si non salarié)", true),
      p("contrat", "Contrat de travail"),
      p("caf", "Justificatif CAF"),
      p("liasses", "Si profession non salariée : 3 dernières liasses fiscales (document remis au centre des impôts) en fonction du régime fiscal", true),
      p("locatif", [["Contrat de bail", 0], [" / déclaration 2044 (si revenus locatifs)", 1]], false, true)
    ] },
    { id: "finance", titre: "SITUATION FINANCIÈRE", pieces: [
      p("echeanciers", "Échéanciers des prêts immobiliers et de consommation en cours", true),
      p("epargne", "Justificatifs d'épargne détenue (hors GS) et des dons", true),
      p("releves", "Trois derniers mois d'extraits de compte courant (hors GS)", true),
      p("rib", "RIB"),
      p("pel", "Attestation originale des droits à prêts PEL / CEL", false, true),
      p("cession", "Cession de droits PEL / CEL, justificatif du lien familial", false, true)
    ] },
    { id: "acquisition", titre: "DANS LE CAS D'UNE ACQUISITION", pieces: [
      p("compromis", [["Promesse, compromis, contrat de réservation", 1], [" (désignation, détail du prix, références cadastrales)", 0]])
    ] },
    { id: "travaux", titre: "DANS LE CAS DE TRAVAUX SEULS OU EN COMPLÉMENT À L'ACQUISITION", pieces: [
      p("acte_travaux", "Acte notarié de propriété (si travaux seuls)", false, true),
      p("autorisation", "Autorisation administrative, permis, récépissé de demande, plans")
    ] },
    { id: "construction", titre: "DANS LE CAS D'UNE CONSTRUCTION", saut: true, pieces: [
      p("terrain", "Acte notarié de propriété, promesse, compromis de vente du terrain", true),
      p("permis", "Permis de construire ou récépissé de demande de permis"),
      p("plans", "Plans complets avec tableau des surfaces"),
      p("contrat_construction", "Contrat de construction avec notice descriptive"),
      p("devis", [["Devis descriptifs", 1], [" et attestations d'assurance décennale", 0]]),
      p("materiaux", "Devis de matériaux (pour travaux auto-réalisés)", true, true)
    ] },
    { id: "rachat", titre: "DANS LE CAS D'UN RACHAT DE CRÉANCE", pieces: [
      p("offre_rachat", "Offre de prêt", true),
      p("tableaux", "Tableau(x) d'amortissement définitif(s)", true),
      p("acte_acquisition", "Acte notarié d'acquisition / justificatif de construction (désignation, détail du prix, références cadastrales)"),
      p("taxe", "Taxe foncière")
    ] },
    { id: "ptz", titre: "DANS LE CAS D'UN PRÊT À TAUX ZÉRO", pieces: [
      p("location", "Contrat de location (sur 2 ans)"),
      p("quittance", "Dernière quittance de loyer"),
      p("avis_occupants", "Avis d'imposition des personnes destinées à occuper le bien")
    ] },
    { id: "relais", titre: "DANS LE CAS D'UN PRÊT RELAIS", pieces: [
      p("mandat", "Mandat de vente exclusif ou 2 mandats de vente exclusifs", true),
      p("avis_valeur", "Deux avis de valeur émanant de deux agences immobilières distinctes", true)
    ] }
  ];
  var PAR_ID = {}, RUBRIQUE_PAR_ID = {};
  RUBRIQUES.forEach(function (r) { RUBRIQUE_PAR_ID[r.id] = r; r.pieces.forEach(function (x) { PAR_ID[x.id] = x; x.rubrique = r.id; }); });

  /* ---------- crédit à la consommation (prêt personnel, crédit auto, prêt travaux) : salarié en CDI ---------- */
  var RUBRIQUES_CONSO = [
    { id: "identite", titre: "IDENTITÉ ET DOMICILE", court: "Identité et domicile", pieces: [
      p("cni", "Carte nationale d'identité (recto verso) ou passeport en cours de validité", true),
      p("dom", "Justificatif de domicile de moins de 3 mois (facture d'électricité, de gaz, d'eau, de téléphone ou d'accès à Internet, quittance de loyer)", true)
    ] },
    { id: "pro", titre: "SITUATION PROFESSIONNELLE : SALARIÉ EN CONTRAT À DURÉE INDÉTERMINÉE (CDI)", court: "Situation professionnelle : salarié en CDI", pieces: [
      p("bulletins", "Trois derniers bulletins de salaire", true),
      p("avis", "Dernier avis d'imposition complet", true),
      p("contrat", "Contrat de travail (si votre conseiller vous le demande)", false, true)
    ] },
    { id: "comptes", titre: "COMPTES BANCAIRES", court: "Comptes bancaires", pieces: [
      p("releves", "Trois derniers relevés de compte bancaire, y compris ceux des comptes ouverts dans une autre banque", true),
      p("rib", "RIB pour le prélèvement des mensualités", true)
    ] },
    { id: "credit", titre: "SELON LE CRÉDIT DEMANDÉ ET SON MONTANT", court: "Justificatif du projet financé", pieces: [
      p("bon_commande", "Crédit auto (véhicule, équipement) : bon de commande signé", true, true),
      p("devis_travaux", "Prêt travaux : devis signé des travaux", true, true),
      p("justif_financement", "Tout prêt supérieur à 15 000 € : justificatif de financement (devis, facture ou bon de commande du projet financé)", true, true)
    ], notes: ["Prêt personnel jusqu'à 15 000 € : aucun justificatif de dépense n'est demandé."] }
  ];
  var PAR_ID_CONSO = {}, RUBRIQUE_PAR_ID_CONSO = {};
  RUBRIQUES_CONSO.forEach(function (r) { RUBRIQUE_PAR_ID_CONSO[r.id] = r; r.pieces.forEach(function (x) { PAR_ID_CONSO[x.id] = x; x.rubrique = r.id; }); });

  /* ---------- ouverture d'un compte courant : pièce d'identité, justificatif de domicile, justificatifs de revenus ----------
     Liste inspirée du document « Justificatifs pour l'ouverture d'un compte courant » d'une banque de réseau, réécrite pour GS (sans nom de banque) et mise à jour :
     la taxe d'habitation sur les résidences principales n'existe plus (ni son avis), le RMI est devenu le RSA, la prime pour l'emploi la prime d'activité, l'ASSEDIC France Travail. */
  function inter(t) { return { intertitre: t }; }
  var RUBRIQUES_OUV = [
    { id: "identite", titre: "UNE PIÈCE D'IDENTITÉ EN COURS DE VALIDITÉ", court: "Pièce d'identité", pieces: [
      inter("L'une des pièces suivantes est à présenter :"),
      p("cni", "La carte nationale d'identité ou la carte d'identité délivrée par une autorité officielle de l'un des pays membres de l'Union européenne ou assimilé*"),
      p("passeport", "Le passeport officiel délivré par un pays membre de l'Union européenne ou assimilé*"),
      inter("Dans les cas suivants, vous devez fournir :"),
      p("etranger", "Si vous êtes de nationalité étrangère (hors Union européenne ou assimilé*) : la carte de résident, le certificat de résidence d'Algérien, la carte de séjour temporaire, le récépissé de demande de renouvellement de carte de séjour accompagné de l'ancienne carte de séjour, le passeport si la vignette « carte de séjour temporaire » est collée dessus, ou l'attestation de fonction ou le titre de séjour spécial pour les membres d'un corps diplomatique ou consulaire ou d'une organisation internationale", false, true),
      p("mineur", "Pour l'ouverture d'un compte à un mineur : la pièce d'identité du représentant légal et l'extrait d'acte de naissance du mineur ou le livret de famille ; ou une pièce d'identité au nom du mineur (parmi les documents cités ci-dessus ou le titre d'identité républicain pour étranger mineur né en France), accompagnée, le cas échéant, de la copie du jugement désignant le représentant légal", false, true)
    ], notes: ["* Andorre, Islande, Liechtenstein, Monaco, Norvège, Saint-Marin, Suisse."] },
    { id: "domicile", titre: "UN JUSTIFICATIF DE DOMICILE", court: "Justificatif de domicile", pieces: [
      inter("L'un des documents suivants est à présenter :"),
      p("fact_energie", "Une facture (de moins de 6 mois) ou un échéancier (établi pour l'année en cours) d'électricité, de gaz ou d'eau"),
      p("fact_tel", "Une facture de téléphone fixe (de moins de 3 mois)"),
      p("fact_tv", "Une facture d'opérateur de télévision par câble ou par satellite (de moins de 3 mois)"),
      p("fact_internet", "Une facture d'abonnement Internet ou de forfait multimédia intégrant une offre de téléphonie fixe, d'accès à Internet ou de chaînes télévisées (de moins de 3 mois)"),
      p("quittance", "Une quittance de loyer émise par un organisme locatif officiel, par exemple un office de HLM (de moins de 3 mois)"),
      p("avis_impot", "Le dernier avis d'imposition ou de non-imposition"),
      p("taxe_fonciere", "Le dernier avis de taxe foncière"),
      inter("Dans les cas suivants, vous devez fournir :"),
      p("emmenage", "Si vous venez d'emménager : l'attestation notariale du contrat d'achat du logement pour les propriétaires, le contrat de bail pour les locataires ou le contrat d'assurance du logement", false, true),
      p("chez_parents", "Si vous êtes mineur non émancipé et habitez chez vos parents ou tuteurs : une attestation d'hébergement (signée et datée du mois en cours), accompagnée de l'un des justificatifs de domicile cités ci-dessus à leur nom", false, true),
      p("etablissement", "Si vous demeurez dans un établissement scolaire, un pensionnat ou un foyer d'étudiants : un certificat d'hébergement du directeur de l'établissement pour l'année scolaire en cours", false, true),
      p("heberge", "Si vous êtes hébergé à titre gratuit chez un tiers : une attestation d'hébergement signée par le tiers et datée du mois en cours, accompagnée d'un justificatif du domicile du tiers et de sa pièce d'identité", false, true)
    ] },
    { id: "revenus", titre: "LE(S) DERNIER(S) JUSTIFICATIF(S) DE REVENUS", court: "Justificatifs de revenus", pieces: [
      inter("Selon votre situation, une ou plusieurs des pièces suivantes peuvent être présentées :"),
      p("rev_salarie", "Si vous êtes salarié(e) ou retraité(e) : le dernier bulletin de salaire (de moins de 2 mois) ou, à défaut, une attestation de votre employeur ou votre contrat de travail précisant la rémunération (de moins de 2 mois) ; le dernier bulletin de retraite ou relevé de caisse de retraite ; le dernier avis d'imposition"),
      p("rev_independant", "Si vous bénéficiez de revenus liés à une activité non salariée : la liasse fiscale n° 2035", false, true),
      p("rev_patrimoine", "Si vous bénéficiez de revenus du patrimoine : pour un patrimoine locatif, la dernière déclaration de revenus fonciers (liasse fiscale n° 2044) ou les baux de location pour les personnes ayant opté pour le régime du micro-foncier ; pour des placements, l'imprimé fiscal unique (IFU), relevé fiscal annuel adressé par les banques et établissements financiers en début d'année", false, true),
      p("rev_prestations", "Si vous bénéficiez de prestations sociales, vous pouvez présenter le ou les derniers justificatifs en votre possession : justificatif de perception du revenu de solidarité active (RSA), des allocations familiales, des allocations chômage ou de la prime d'activité", false, true),
      p("rev_autres", "Selon les cas, vous pouvez présenter le ou les derniers justificatifs suivants : perception d'une pension alimentaire ; perception d'une pension d'invalidité ; notification d'attribution définitive de bourse scolaire ou étudiante ; déclaration fiscale envoyée en début d'année par la compagnie d'assurance pour les clients percevant une rente", false, true),
      p("rev_tout", "Ou tout autre document justifiant d'un revenu", false, true)
    ] }
  ];
  var PAR_ID_OUV = {}, RUBRIQUE_PAR_ID_OUV = {};
  RUBRIQUES_OUV.forEach(function (r) { RUBRIQUE_PAR_ID_OUV[r.id] = r; r.pieces.forEach(function (x) { if (x.id) { PAR_ID_OUV[x.id] = x; x.rubrique = r.id; } }); });

  /* Titre d'une rubrique en minuscules avec majuscule initiale, pour les listes à cocher du Montage de prêt (« ÉTAT CIVIL » → « État civil »). */
  function titreCourt(r) { if (r.court) return r.court; var t = String(r.titre).toLocaleLowerCase("fr"); return t.charAt(0).toLocaleUpperCase("fr") + t.slice(1); }

  var TITRE = "Documents à fournir pour l'étude de votre demande de prêt *";
  /* Au-delà de ce montant emprunté, tout prêt exige un justificatif de financement (devis, facture, bon de commande du projet). */
  var SEUIL_JUSTIFICATIF = 15000;
  var TITRE_CONSO = "Documents à fournir pour l'étude de votre demande de crédit à la consommation *";
  var TITRE_OUV = "Justificatifs à fournir pour l'ouverture d'un compte courant";
  var AGENCE = D.AGENCE;

  /* Texte brut d'une pièce (recherche, tests) et HTML avec les parties en gras. */
  function texte(x) { return Array.isArray(x.lib) ? x.lib.map(function (m) { return m[0]; }).join("") : x.lib; }
  function html(x) {
    if (Array.isArray(x.lib)) return x.lib.map(function (m) { return m[1] ? "<strong>" + esc(m[0]) + "</strong>" : esc(m[0]); }).join("");
    return x.gras ? "<strong>" + esc(x.lib) + "</strong>" : esc(x.lib);
  }

  /* Une rubrique du document : bandeau (titre, colonnes Client et GS), une ligne par pièce, deux cases à cocher par ligne (le client, puis la banque). */
  function rubrique(r) {
    return '<section class="dp-rub' + (r.saut ? " dp-rub-saut" : "") + '"><table class="dp-rub-tab"><thead><tr><th scope="col" class="dp-rub-nom">' + esc(r.titre) + '</th><th scope="col" class="dp-rub-col">Client</th><th scope="col" class="dp-rub-col">GS</th></tr></thead><tbody>' +
      r.pieces.map(function (x) {
        if (x.intertitre) return '<tr class="dp-rub-inter"><td class="dp-rub-lib" colspan="3">' + esc(x.intertitre) + "</td></tr>";
        return '<tr><td class="dp-rub-lib">' + html(x) + '</td><td class="dp-rub-case"><span class="dp-boite" aria-hidden="true"></span></td><td class="dp-rub-case"><span class="dp-boite" aria-hidden="true"></span></td></tr>';
      }).join("") + (r.notes || []).map(function (t) {
        return '<tr class="dp-rub-remarque"><td class="dp-rub-lib" colspan="3">' + esc(t) + "</td></tr>";
      }).join("") + "</tbody></table></section>";
  }

  /* ---------- « Autres documents » : les pièces que le conseiller ajoute à la liste du client ---------- */
  var AUTRES = { MAX: 8, LONGUEUR: 120, MIN: 3 };
  function propreAutre(t) { return String(t == null ? "" : t).replace(/\s+/g, " ").trim(); }
  function sansAccent(t) { return propreAutre(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’‘]/g, "'").toLowerCase(); }
  function empreinte(t) { var h = 2166136261; t = String(t); for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  /* Identifiant stable d'un document ajouté (il ne change pas quand on en retire un autre : les cases cochées du Montage de prêt restent cochées). */
  function idAutre(t) { return "autre_" + empreinte(sansAccent(t)).toString(16); }
  /* Contrôle d'une ligne à ajouter : { ok, texte } ou { ok: false, erreur }. existantes : les lignes déjà ajoutées. */
  function controlerAutre(texte, existantes) {
    var t = propreAutre(texte), l = existantes || [];
    if (!t) return { ok: false, erreur: "Saisissez le document à demander au client." };
    if (t.length < AUTRES.MIN) return { ok: false, erreur: "Décrivez le document en quelques mots (au moins " + AUTRES.MIN + " caractères)." };
    if (t.length > AUTRES.LONGUEUR) return { ok: false, erreur: "Le libellé est limité à " + AUTRES.LONGUEUR + " caractères (" + t.length + " saisis)." };
    if (l.some(function (x) { return sansAccent(x) === sansAccent(t); })) return { ok: false, erreur: "Ce document figure déjà dans la rubrique « Autres documents »." };
    if (l.length >= AUTRES.MAX) return { ok: false, erreur: "La rubrique « Autres documents » est limitée à " + AUTRES.MAX + " lignes : retirez-en une avant d'en ajouter." };
    return { ok: true, texte: t };
  }
  /* La rubrique « AUTRES DOCUMENTS » : une ligne par document ajouté (en texte simple : ce ne sont pas des pièces indispensables à la solvabilité, mais le conseiller les attend). */
  function rubriqueAutres(lignes) {
    return { id: "autres", titre: "AUTRES DOCUMENTS", court: "Autres documents demandés", autres: true, pieces: (lignes || []).map(function (t) { return p(idAutre(t), t, false, false); }) };
  }
  /* Clé du client dans l'enregistrement : « c » + numéro pour un client du portefeuille, « p » + numéro de dossier pour un prospect dont le compte est ouvert. */
  function cleClient(c) { return c ? (c.prospect ? "p" + c.prospect : "c" + c.id) : ""; }
  /* Lignes ajoutées pour un client et un document (st.autresDocs[cle][document]). */
  function autresDe(st, cle, doc) {
    var a = st && st.autresDocs && st.autresDocs[cle] && st.autresDocs[cle][doc];
    return Array.isArray(a) ? a.map(propreAutre).filter(Boolean).slice(0, AUTRES.MAX) : [];
  }
  function enregistrerAutres(st, cle, doc, liste) {
    if (!st.autresDocs || typeof st.autresDocs !== "object") st.autresDocs = {};
    if (!st.autresDocs[cle] || typeof st.autresDocs[cle] !== "object") st.autresDocs[cle] = {};
    if (liste.length) st.autresDocs[cle][doc] = liste; else delete st.autresDocs[cle][doc];
  }
  function ajouterAutre(st, cle, doc, texte) {
    var l = autresDe(st, cle, doc), r = controlerAutre(texte, l); if (!r.ok) return r;
    l.push(r.texte); enregistrerAutres(st, cle, doc, l); return { ok: true, liste: l, id: idAutre(r.texte) };
  }
  function retirerAutre(st, cle, doc, id) {
    var l = autresDe(st, cle, doc), n = l.filter(function (t) { return idAutre(t) !== id; });
    if (n.length === l.length) return { ok: false, erreur: "Ce document n'est plus dans la liste." };
    enregistrerAutres(st, cle, doc, n); return { ok: true, liste: n };
  }
  function avecAutres(b, autres) { return autres && autres.length ? b + rubrique(rubriqueAutres(autres)) : b; }

  /* Le paragraphe sur les données personnelles et l'adresse de l'agence, identique dans les deux documents. */
  function rgpd() {
    return '<p class="dp-rgpd">En application de la loi n° 78-17 du 6 janvier 1978 modifiée, les données à caractère personnel recueillies sont obligatoires pour la gestion de votre demande et feront l\'objet d\'un traitement dont le responsable est ' + esc(AGENCE[0]) +
      ". Ces données pourront être utilisées pour la gestion des opérations effectuées en exécution de votre demande par " + esc(AGENCE[0]) + ", ses filiales, ses partenaires et prestataires. Elles pourront également être communiquées à des tiers afin de satisfaire aux obligations légales et réglementaires, en particulier en matière de fraude, de lutte contre le blanchiment de capitaux et le financement du terrorisme. " +
      "Les personnes sur lesquelles portent les données disposent d'un droit d'accès, de rectification et d'opposition pour motifs légitimes, qu'elles peuvent exercer en s'adressant à " + esc(AGENCE[0]) + ", " + esc(AGENCE[1]) + ", " + esc(AGENCE[2]) + ", " + esc(AGENCE[3]) + ".</p>";
  }

  /* Le corps du document, identique pour tous les clients : le candidat emprunteur date et signe en bas de la page 2. */
  function corps(autres) {
    var b = '<div class="dp-pret dp-signer">';
    b += '<div class="dp-encadre"><p>Les candidats emprunteurs doivent fournir les éléments exacts et complets figurant <strong>en caractères gras</strong> sur la liste ci-dessous afin que ' + esc(AGENCE[0]) + " puisse procéder à l'évaluation de solvabilité appropriée.</p>" +
      "<p><strong>Ces documents devront parvenir au Conseiller au plus tard le jour de la signature de la demande de prêt.</strong></p>" +
      "<p>À défaut, " + esc(AGENCE[0]) + " ne sera pas en mesure de procéder à l'évaluation de la solvabilité des candidats emprunteurs.</p></div>";
    RUBRIQUES.forEach(function (r, i) {
      if (r.saut) b += '<hr class="dp-saut">';
      b += rubrique(r);
    });
    b = avecAutres(b, autres);
    b += '<p class="dp-note-pret">* Liste de pièces justificatives non exhaustive susceptible d\'évoluer en fonction de votre situation personnelle, du projet et de l\'étude de votre dossier de demande de prêt.</p>';
    b += rgpd();
    b += '<div class="dp-sign-pret"><p>Date et signatures des candidats emprunteurs</p></div>';
    return b + "</div>";
  }

  /* Le corps du document « crédit à la consommation » : même présentation, une seule page. */
  function corpsConso(autres) {
    var b = '<div class="dp-pret dp-signer dp-conso">';
    b += '<div class="dp-encadre"><p>Les candidats emprunteurs doivent fournir les éléments exacts et complets figurant <strong>en caractères gras</strong> sur la liste ci-dessous afin que ' + esc(AGENCE[0]) + " puisse procéder à l'évaluation de solvabilité appropriée.</p>" +
      "<p><strong>Ces documents devront parvenir au Conseiller au plus tard le jour de la signature de la demande de crédit.</strong></p>" +
      "<p>À défaut, " + esc(AGENCE[0]) + " ne sera pas en mesure de procéder à l'évaluation de la solvabilité des candidats emprunteurs.</p>" +
      "<p>Cette liste concerne les candidats emprunteurs salariés en contrat à durée indéterminée (CDI).</p></div>";
    RUBRIQUES_CONSO.forEach(function (r) { b += rubrique(r); });
    b = avecAutres(b, autres);
    b += '<p class="dp-note-pret">* Liste de pièces justificatives non exhaustive susceptible d\'évoluer en fonction de votre situation personnelle, du projet financé et de l\'étude de votre dossier de demande de crédit.</p>';
    b += rgpd();
    b += '<div class="dp-sign-pret"><p>Date et signatures des candidats emprunteurs</p></div>';
    return b + "</div>";
  }

  function identite(client) {
    var c = client || {};
    return c.nom ? (c.civ ? c.civ + " " : "") + c.prenom + " " + String(c.nom).toUpperCase() : "";
  }
  function documentConso(client, date, autres) {
    var c = client || {}, nom = identite(c);
    return {
      id: "documents_conso", titre: TITRE_CONSO, sous: nom ? nom + (c.num ? " – n° " + c.num : "") : "Prêt personnel, crédit auto, prêt travaux",
      fichier: nom ? D.fichier("Documents_a_fournir_credit_consommation", { nom: c.nom, prenom: c.prenom }, date || new Date()) : "Documents_a_fournir_credit_consommation",
      courrier: false, corps: corpsConso(autres)
    };
  }
  /* Le client est-il un salarié en CDI ? (le document « crédit à la consommation » ne traite que ce cas) */
  function estCDI(client) { return !!(client && client.pro && client.pro.statut === "salarie" && client.pro.ctr === "CDI"); }

  var LISTE = [
    { id: "immo", lib: "Prêt immobilier", titre: TITRE.replace(/ \*$/, ""), produits: ["CIMMO"] },
    { id: "conso", lib: "Crédit à la consommation", titre: TITRE_CONSO.replace(/ \*$/, ""), produits: ["CCONSO", "CAUTO", "CTRAV"] },
    { id: "ouverture", lib: "Ouverture de compte courant", titre: TITRE_OUV, produits: [] }
  ];
  /* Le corps du document « ouverture d'un compte courant » : cadre « Votre conseiller », mot d'accueil, rappel « chaque titulaire fournit ses propres pièces », trois rubriques, « Autres documents ». */
  function corpsOuv(autres) {
    var b = '<div class="dp-pret dp-ouv">';
    b += '<div class="dp-conseiller"><p><strong>Votre conseiller :</strong> M. / Mme <span class="dp-ligne dp-ligne-long"></span></p><p>Tél. <span class="dp-ligne dp-ligne-long"></span></p>' +
      '<p><strong>Rendez-vous le</strong> <span class="dp-ligne dp-ligne-court"></span> à <span class="dp-ligne dp-ligne-court"></span></p></div>';
    b += '<p class="dp-texte">Vous souhaitez ouvrir un compte courant à ' + esc(AGENCE[0]) + " et nous vous remercions de votre confiance. Lors de notre rencontre, nous établirons ensemble votre demande d'ouverture. Je vous remercie de vous munir des documents suivants :</p>";
    b += '<div class="dp-encadre"><p><strong>Chaque titulaire fournit ses propres pièces</strong> : pour un compte joint ou un compte indivis, la pièce d\'identité, le justificatif de domicile et le justificatif de revenus sont demandés à chacun des titulaires.</p></div>';
    RUBRIQUES_OUV.forEach(function (r) { b += rubrique(r); });
    b = avecAutres(b, autres);
    b += '<p class="dp-note-pret">Liste de pièces justificatives non exhaustive, susceptible d\'évoluer en fonction de votre situation personnelle. Les pièces sont vérifiées sur l\'original ; une copie est conservée dans votre dossier.</p>';
    b += rgpd();
    return b + "</div>";
  }
  function documentOuv(client, date, autres) {
    var c = client || {}, nom = identite(c);
    return {
      id: "documents_ouverture", titre: TITRE_OUV, sous: nom ? nom + (c.num ? " – n° " + c.num : "") : "Compte courant, compte joint ou compte indivis",
      fichier: nom ? D.fichier("Justificatifs_ouverture_compte", { nom: c.nom, prenom: c.prenom }, date || new Date()) : "Justificatifs_ouverture_compte",
      courrier: false, corps: corpsOuv(autres)
    };
  }
  function documentPour(id, client, date, autres) { return id === "conso" ? documentConso(client, date, autres) : id === "ouverture" ? documentOuv(client, date, autres) : document_(client, date, autres); }

  function document_(client, date, autres) {
    var c = client || {}, nom = identite(c);
    return {
      id: "documents_pret", titre: TITRE, sous: nom ? nom + (c.num ? " – n° " + c.num : "") : "Financement d'un prêt immobilier",
      fichier: client && client.nom ? D.fichier("Documents_a_fournir_pret", { nom: c.nom, prenom: c.prenom }, date || new Date()) : "Documents_a_fournir_pret",
      courrier: false, corps: corps(autres)
    };
  }

  var api = { TITRE: TITRE, AGENCE: AGENCE, RUBRIQUES: RUBRIQUES, PAR_ID: PAR_ID, RUBRIQUE_PAR_ID: RUBRIQUE_PAR_ID, titreCourt: titreCourt, texte: texte, html: html, rubrique: rubrique, corps: corps, document: document_,
    CONSO: { TITRE: TITRE_CONSO, SEUIL_JUSTIFICATIF: SEUIL_JUSTIFICATIF, RUBRIQUES: RUBRIQUES_CONSO, PAR_ID: PAR_ID_CONSO, RUBRIQUE_PAR_ID: RUBRIQUE_PAR_ID_CONSO, corps: corpsConso, document: documentConso },
    OUV: { TITRE: TITRE_OUV, RUBRIQUES: RUBRIQUES_OUV, PAR_ID: PAR_ID_OUV, RUBRIQUE_PAR_ID: RUBRIQUE_PAR_ID_OUV, corps: corpsOuv, document: documentOuv },
    LISTE: LISTE, documentPour: documentPour, estCDI: estCDI,
    AUTRES: AUTRES, idAutre: idAutre, controlerAutre: controlerAutre, rubriqueAutres: rubriqueAutres, cleClient: cleClient, autresDe: autresDe, ajouterAutre: ajouterAutre, retirerAutre: retirerAutre };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.documentsPret = api; }
})(typeof window !== "undefined" ? window : null);
