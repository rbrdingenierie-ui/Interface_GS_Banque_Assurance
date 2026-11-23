/* GS Banque & Assurance – accueil du conseiller : synthèse commerciale, opportunités, alertes, rendez-vous, outils. */
(function () {
  "use strict";

  var B = window.SGBF.banque, S = window.SGBF.synthese, PR = window.SGBF.produits, CL = window.SGBF.clients, ICO = window.SGBF.icones, RECH = window.SGBF.recherche, TR = window.SGBF.travail, PRO = window.SGBF.prospects;
  var app = document.getElementById("app");
  var esc = B.esc;
  var etat = { filtre: "tous", nbOpp: 8, alertes: {}, sem: 0, vueVentes: "total", oppOuvert: false, agLundi: null };
  var SEM_MAX = 11;

  var FILTRES = [
    { id: "tous", lib: "Toutes", codes: null },
    { id: "epargne", lib: "Épargne et placements", codes: ["PLAFOND", "LEP", "RETRAITE"] },
    { id: "projets", lib: "Projets et crédits", codes: ["PROJET", "FINCREDIT", "RENEGO"] },
    { id: "client", lib: "Vie du client", codes: ["NOUVEAU", "PEU", "MAJORITE", "CONTACT"] }
  ];
  var OUTILS = [
    { groupe: "Disponibles", items: [
      { nom: "Fiche client 360°", desc: "Identité, famille, comptes, relevé, épargne, crédits, assurances, notes et projets.", ico: "dossier", href: "client.html" },
      { nom: "Opérations de service", desc: "Virement, opposition ou contestation de carte, plafond, chéquier, chèque de banque, retrait d'espèces, devises, clôture de compte, désolidarisation d'un compte joint : réaliser l'opération pour un client sans ouvrir son dossier.", ico: "virement", href: "operations.html" },
      { nom: "Courriers et documents", desc: "Documents à remettre au client et à faire signer : liste des documents à fournir pour l'étude d'une demande de prêt immobilier (prêt relais compris) ou de crédit à la consommation (salarié en CDI), à imprimer ou enregistrer en PDF.", ico: "crayon", href: "courriers.html" },
      { nom: "Opérations débiteurs", desc: "Payer ou rejeter chèques et prélèvements, valider les paiements par carte.", ico: "prelevement", href: "debiteurs.html" },
      { nom: "Gestion des incidents", desc: "Comptes en incident : relances à 15, 30, 60 et 90 jours, courriers, engagement de régularisation, clôture, opposition ou service d'aide au retrait.", ico: "cloche", href: "incidents.html" },
      { nom: "Mouvements atypiques", desc: "Analyser une opération atypique, contacter le client, décider.", ico: "alerte", href: "atypiques.html" },
      { nom: "Portefeuille", desc: "Deux volets : l'analyse du portefeuille (répartition des clients par catégorie socioprofessionnelle et autres critères, lecture qualitative) et le portefeuille clients (recherche, filtres et tris, cibles enregistrées, impression).", ico: "groupe", href: "portefeuille.html" },
      { nom: "Catalogue de produits", desc: "59 produits illustrés, tarifs, éligibilité de chaque client avec justification, comparaison, souscription.", ico: "livre", href: "catalogue.html" },
      { nom: "Profil investisseur (MIFID)", desc: "Questionnaire obligatoire avant la souscription d'un produit boursier (assurance-vie, PEA, PER), puis rapport de conseil remis au client.", ico: "analyse", href: "mifid.html" },
      { nom: "Ouverture de compte", desc: "Pour un prospect ou un client : dossier, recommandation et parrainage, validation de la directrice d'agence, ouverture du compte puis équipement (carte, chéquier, banque à distance).", ico: "utilisateur", href: "prospect.html" },
      { nom: "Interro BDF", desc: "Interroger la Banque de France : fichier central des chèques (FCC, interdiction bancaire) et fichier des incidents de remboursement des crédits aux particuliers (FICP). Clé de recherche : date de naissance et cinq premières lettres du nom.", ico: "recherche", href: "interro_bdf.html" },
      { nom: "Saisies administratives (SATD)", desc: "Avis à tiers détenteur d'un comptable public : solde bancaire insaisissable laissé au client, blocage de 15 jours, frais de 10 % du montant dû (100 € au plus), versement au Trésor public, courriers et mainlevée.", ico: "frais", href: "satd.html" },
      { nom: "Régularisation FCC", desc: "Régulariser un chèque rejeté pour défaut de provision : blocage de provision en espèces ou remise du chèque, lettre d'injonction complétée, déclaration à la Banque de France (inscription mise à jour dans le mois).", ico: "cheque", href: "regularisation_fcc.html" },
      { nom: "Agenda commercial", desc: "Rendez-vous de l'agence, vos rendez-vous, relances et rappels, aux jours et heures d'ouverture de l'agence.", ico: "calendrier", href: "agenda.html" },
      { nom: "Agenda de l'équipe", desc: "Disponibilités des cinq collègues de l'agence (conseillers clientèle particuliers, privée et professionnelle, directrice) et prise de rendez-vous avec eux.", ico: "groupe", href: "equipe.html" },
      { nom: "Messagerie", desc: "E-mails types adressés aux clients, modifiables, avec signature professionnelle ; chaque envoi est enregistré dans la fiche du client.", ico: "courrier", href: "messagerie.html" },
      { nom: "Réclamations", desc: "Enregistrer la réclamation d'un client (ce qu'il reproche, d'où vient le problème, ce que vous proposez pour le calmer), la remettre au conseiller gestionnaire ou à la directrice d'agence et la suivre jusqu'à la clôture.", ico: "cloche", href: "reclamation.html" },
      { nom: "Avis clients en ligne", desc: "Les avis laissés sur la page de l'agence : les lire, les qualifier (compliment, réclamation, données personnelles, faux avis, fraude), décider des suites et rédiger une réponse publique contrôlée avant publication, dans le respect du secret professionnel.", ico: "megaphone", href: "avis_en_ligne.html" },
      { nom: "Messages suspects", desc: "E-mails, SMS et appels suspects signalés par les clients, demandes de virement inhabituelles : les examiner sans cliquer, relever les indices (hameçonnage, faux conseiller, faux ordre de virement), choisir les mesures selon ce que le client a fait et rédiger une réponse contrôlée avant envoi.", ico: "alerte", href: "messages_suspects.html" },
      { nom: "Campagnes commerciales", desc: "Objectif, cible, argumentaire, calendrier et indicateurs calculés.", ico: "megaphone", href: "campagnes.html" },
      { nom: "Phoning et prospection", desc: "Fiche d'appel, règles du démarchage, script, objections, résultat et suite donnée.", ico: "telephone", href: "phoning.html" },
      { nom: "O2PC : opportunités commerciales", desc: "La dizaine de clients à appeler chaque jour pendant la session de proactivité, selon douze thèmes (majorité, arrivée de fonds, plafond, échéances, crédits, assurances, PEA, assurance-vie).", ico: "recherche", href: "o2pc.html" },
      { nom: "Compte Rendu d'Entretien (CRE)", desc: "Fiche d'entretien en sept étapes, puis compte rendu d'entretien : produit abordé, rebond commercial, résultat.", ico: "groupe", href: "contacts.html" },
      { nom: "Résultats et bilan", desc: "Résultats par moyen (e-mail, appel, entretien), transformation, multiventes, rebonds, constats chiffrés et analyse.", ico: "graphique", href: "bilan.html" },
      { nom: "Tableau de bord de l'agence", desc: "Les résultats du mois écoulé de l'agence et de ses cinq conseillers (PNB, crédits, contrats, décroché, réclamations, clients distanciés, satisfaction) : repérer les écarts avec les objectifs, retenir les écarts prioritaires, en chercher les causes, proposer des actions et rédiger la synthèse pour la directrice.", ico: "analyse", href: "tableau_bord.html" },
      { nom: "Simulateur", desc: "Deux volets : le simulateur d'épargne (capital acquis, montant à placer, versement, durée ou taux ; intérêts simples, composés ou règle des quinzaines) et le simulateur de prêt (mensualité, capital à emprunter ou durée, tableau d'amortissement, endettement du client).", ico: "calculette", href: "simulateur.html" },
      { nom: "Montage de prêt", desc: "Dossier de crédit d'un client : plan de financement, garantie, assurance emprunteur, pièces, solvabilité, décision et offre.", ico: "credit", href: "montage.html" },
      { nom: "Suivi d'un crédit en cours", desc: "Un client qui a déjà un crédit : remboursement anticipé, renégociation du taux, rachat d'un prêt détenu dans une autre banque, regroupement de crédits, modulation ou report de mensualités, avec les règles, les coûts et la proposition remise au client.", ico: "credit", href: "suivi_credit.html" },
      { nom: "Ordres de bourse", desc: "Un client titulaire d'un PEA demande à acheter ou à vendre des titres : vérifier le compte, choisir le type d'ordre, la limite de prix et la durée de validité, puis confronter l'ordre au carnet d'ordres pour obtenir le prix d'exécution, les frais et la taxe sur les transactions financières (avis d'opéré simulé).", ico: "epargne", href: "ordres_bourse.html" },
      { nom: "Carte de visite", desc: "Votre carte de conseiller : aperçu recto et verso, impression d'une planche de dix cartes à découper.", ico: "utilisateur", href: "carte.html" }
    ] }
  ];

  function pl(n, s, p) { return n + " " + (n > 1 ? p : s); }
  function initiales(c) { return (c.prenom.charAt(0) + c.nom.charAt(0)).toUpperCase(); }
  function nomComplet(c) { return c.prenom + " " + c.nom; }
  function lienClient(c, tab) { return PRO && PRO.estProspect(c) ? PRO.lienClient(c) : "client.html?id=" + c.id + (tab ? "#" + tab : ""); }
  function nomPiste(p) { var x = PR.parId[p]; return x ? x.code : p; }

  /* ---------- blocs ---------- */
  function synthese(sy) {
    var lignes = sy.lignes.map(function (l) {
      var cls = l.atteinte >= 100 ? "ok" : l.atteinte >= 80 ? "warn" : "bad";
      var mot = l.atteinte >= 100 ? "Objectif atteint" : l.atteinte >= 80 ? "Presque atteint" : "En retard";
      return "<tr><th scope=\"row\">" + esc(l.nom) + "</th>" +
        '<td data-label="Clients équipés">' + B.pct(l.taux) + "</td>" +
        '<td data-label="30 jours">' + l.j30 + "</td>" +
        '<td data-label="90 jours">' + l.j90 + "</td>" +
        '<td data-label="12 mois">' + l.an + "</td>" +
        '<td data-label="Objectif annuel">' + l.objectif + "</td>" +
        '<td class="atteinte"><div class="atteinte-ligne"><span class="barre b-' + cls + '" aria-hidden="true"><span style="width:' + Math.min(100, Math.round(l.atteinte)) + '%"></span></span><span class="atteinte-val">' + Math.round(l.atteinte) + ' %</span><span class="etat etat-' + cls + '">' + mot + "</span></div></td></tr>";
    }).join("");
    var tot = '<tr><th scope="row">Ensemble</th><td data-label="Clients équipés">–</td><td data-label="30 jours">' + sy.total30 + '</td><td data-label="90 jours">' + sy.total90 + '</td><td data-label="12 mois">' + sy.total12 + '</td><td data-label="Objectif annuel">' + sy.objectif + '</td><td class="atteinte"><div class="atteinte-ligne"><span class="barre b-' + (sy.atteinte >= 100 ? "ok" : sy.atteinte >= 80 ? "warn" : "bad") + '" aria-hidden="true"><span style="width:' + Math.min(100, Math.round(sy.atteinte)) + '%"></span></span><span class="atteinte-val">' + Math.round(sy.atteinte) + " %</span></div></td></tr>";
    return '<section class="bloc" id="bloc-synthese" aria-labelledby="t-synthese">' +
      '<div class="bloc-tete"><h2 id="t-synthese">Synthèse commerciale</h2><span class="sous">Contrats ouverts par les clients du portefeuille</span></div>' +
      '<div class="synthese-textes"><p class="synthese-texte">' + esc(sy.texte) + "</p>" +
      (sy.alertesTexte ? '<p class="synthese-texte">' + esc(sy.alertesTexte) + "</p>" : "") + "</div>" +
      '<dl class="kpis">' +
        '<div class="kpi"><dt>Clients du portefeuille</dt><dd class="val">' + sy.equipement.nbClients + '</dd><dd class="det">Agence de Paris</dd></div>' +
        '<div class="kpi"><dt>Produits par client</dt><dd class="val">' + B.nb(Math.round(sy.equipement.moyenne * 10) / 10) + '</dd><dd class="det">' + pl(sy.equipement.peuEquipes, "client", "clients") + " avec compte et carte seulement</dd></div>" +
        '<div class="kpi"><dt>Contrats ouverts en 12 mois</dt><dd class="val">' + sy.total12 + '</dd><dd class="det">Objectif annuel : ' + sy.objectif + " (" + Math.round(sy.atteinte) + " %)</dd></div>" +
        '<div class="kpi"><dt>Contrats ouverts en 90 jours</dt><dd class="val">' + sy.total90 + '</dd><dd class="det">dont ' + sy.total30 + " en 30 jours</dd></div>" +
      "</dl>" +
      '<div class="tab-wrap"><table class="tab-ventes"><caption class="sr">Équipement et ventes par univers de produits</caption>' +
      '<thead><tr><th scope="col">Univers de produits</th><th scope="col">Clients équipés</th><th scope="col">30 jours</th><th scope="col">90 jours</th><th scope="col">12 mois</th><th scope="col">Objectif annuel</th><th scope="col">Atteinte de l\'objectif</th></tr></thead>' +
      "<tbody>" + lignes + "</tbody><tfoot>" + tot + "</tfoot></table></div>" +
      '<p class="note-pied">Client équipé : client qui détient au moins un produit de l\'univers. Les univers sont ceux du catalogue de produits. Les objectifs annuels sont fixés par la direction de l\'agence.</p>' +
      "</section>";
  }

  function opportunites() {
    var f = FILTRES.filter(function (x) { return x.id === etat.filtre; })[0];
    var tout = S.opportunitesSemaine(CL, 400);
    var liste = tout.items.filter(function (i) { return !f.codes || f.codes.indexOf(i.opp.code) >= 0; });
    var vus = liste.slice(0, etat.nbOpp);
    var puces = FILTRES.map(function (x) { return '<button type="button" class="filtre" aria-pressed="' + (x.id === etat.filtre) + '" data-act="filtre" data-f="' + x.id + '">' + esc(x.lib) + "</button>"; }).join("");
    var li = vus.map(function (i) {
      var c = i.client, o = i.opp;
      return '<li><span class="avatar" aria-hidden="true">' + esc(initiales(c)) + "</span>" +
        '<div class="opp-corps"><p class="opp-client"><a href="' + lienClient(c) + '">' + esc(nomComplet(c)) + '</a></p><p class="opp-qui">' + c.age + " ans – " + esc(c.pro.prof) + " – " + esc(c.adr.ville) + "</p>" +
        '<p class="opp-titre">' + esc(o.titre) + "</p>" +
        '<p class="opp-detail">' + esc(o.detail) + "</p>" +
        (o.pistes.length ? '<p class="opp-pistes"><span>Pistes :</span>' + o.pistes.map(function (p) { return '<span class="piste-chip">' + esc(nomPiste(p)) + "</span>"; }).join("") + "</p>" : "") +
        "</div>" +
        '<a class="lien-fiche" href="' + lienClient(c) + '" aria-label="Ouvrir la fiche de ' + esc(nomComplet(c)) + '">Ouvrir la fiche ' + ICO.ouvrir + "</a>" +
        "</li>";
    }).join("");
    var reste = liste.length - vus.length;
    return '<details class="bloc rep-bloc" id="bloc-opps"' + (etat.oppOuvert ? " open" : "") + '>' +
      '<summary><span class="bloc-tete"><h2 id="t-opps">Opportunités de la semaine</h2><span class="sous">Semaine ' + (tout.semaine % 100) + " – " + pl(tout.clients, "client concerné", "clients concernés") + " sur " + CL.length + "</span></span></summary>" +
      '<div class="filtres" role="group" aria-label="Filtrer par type d\'opportunité">' + puces + "</div>" +
      (liste.length ? '<ul class="opps">' + li + "</ul>" : '<p class="vide-bloc">Aucune opportunité de ce type cette semaine.</p>') +
      (reste > 0 ? '<div class="suite"><button type="button" class="btn btn-secondaire" data-act="plus-opp">Afficher ' + Math.min(reste, 10) + " de plus</button><span class=\"sous\">" + vus.length + " affichées sur " + liste.length + "</span></div>" : "") +
      '<p class="note-pied">Une opportunité est un point de départ pour un entretien : elle repose sur le dossier du client, jamais sur une obligation de vendre.</p>' +
      "</details>";
  }

  function alertes() {
    var al = S.listeAlertes(CL), large = !!(window.matchMedia && window.matchMedia("(min-width: 1001px)").matches);
    var defs = [
      { code: "DEBITEUR", titre: "Comptes en solde débiteur", cls: "bad", ico: "alerte", vide: "Aucun compte en solde débiteur." },
      { code: "CARTE", titre: "Cartes à renouveler", cls: "warn", ico: "carte", vide: "Aucune carte à renouveler dans les 60 jours." },
      { code: "KYC", titre: "Dossiers à actualiser", cls: "info", ico: "dossier", vide: "Tous les dossiers sont à jour." }
    ];
    var vides = [];
    var h = defs.map(function (d) {
      var l = al[d.code], tous = !!etat.alertes[d.code], vus = tous ? l : l.slice(0, 5);
      var ico = ICO[d.ico].replace("<svg ", '<svg class="alerte-ico" ');
      if (!l.length) { vides.push('<li class="alerte-vide alerte-' + d.cls + '">' + ico + "<span>" + d.vide + "</span></li>"); return ""; }
      var items = vus.map(function (x) { return '<li><a href="' + lienClient(x.client, d.code === "DEBITEUR" ? "compte" : "") + '">' + esc(nomComplet(x.client)) + "</a><span>" + esc(x.alerte.detail) + "</span></li>"; }).join("");
      return '<details class="alerte alerte-' + d.cls + '"' + (large || d.code === "DEBITEUR" ? " open" : "") + '><summary>' + ico + "<span>" + d.titre + '</span><span class="alerte-nb">' + l.length + "</span></summary>" +
        "<ul>" + items + "</ul>" + (l.length > 5 && !tous ? '<button type="button" class="btn-texte" data-act="alerte-tout" data-c="' + d.code + '">Afficher les ' + l.length + "</button>" : "") + "</details>";
    }).join("");
    var nbCol = defs.length - vides.length;
    return '<div class="alertes-bloc" id="bloc-alertes" role="group" aria-labelledby="t-alertes"><h3 id="t-alertes">Alertes</h3>' +
      (nbCol ? '<div class="alertes-liste" style="--n:' + nbCol + '">' + h + "</div>" : "") +
      (vides.length ? '<ul class="alertes-vides">' + vides.join("") + "</ul>" : "") + "</div>";
  }

  /* Rappel des éléments de l'agenda de l'étudiant (rendez-vous, relances, rappels) à faire aujourd'hui ou en retard. */
  function agendaPerso() {
    var AG = window.SGBF.agenda;
    if (!AG) return "";
    var a = AG.aFaire(B.store.charger()), n = a.retard.length + a.auj.length;
    if (!n) return "";
    var morceaux = [];
    if (a.auj.length) morceaux.push(pl(a.auj.length, "élément", "éléments") + " aujourd'hui");
    if (a.retard.length) morceaux.push(pl(a.retard.length, "élément en retard", "éléments en retard"));
    return '<p class="agenda-perso"><strong>Dans votre agenda :</strong> ' + morceaux.join(", ") + ". <a href=\"agenda.html#t-afaire\">Voir ce qui reste à faire</a>.</p>";
  }
  /* Agenda du conseiller : toute la semaine, jour par jour (mardi au samedi : l'agence est fermée le lundi), avec ce que contient l'agenda complet : rendez-vous de l'agence, éléments de l'élève (rendez-vous, relances, rappels,
     rendez-vous avec un collègue), plages réservées de l'agence (gestion, proactivité, réunion d'équipe du jeudi, accueil) et contacts déjà enregistrés. S'ouvre sur la semaine en cours (ou la prochaine semaine
     d'ouverture si l'agence est fermée aujourd'hui), avec les boutons « Semaine précédente / suivante » ; la saisie et la modification des éléments se font dans l'agenda commercial (agenda.html). */
  var NB_SEM_AGENDA = 12;
  function heureAg(h) { var m = /^(\d{2}):(\d{2})$/.exec(h || ""); return m ? (+m[1]) + " h" + (m[2] === "00" ? "" : " " + m[2]) : ""; }
  function libSemaineAg(lundi) {
    var AG = window.SGBF.agenda;
    var m = AG.debutSemaine(lundi), v = B.plusJours(lundi, AG.NB_JOURS_SEMAINE), a = m.getDate() + (m.getDate() === 1 ? "er" : "");
    return m.getMonth() !== v.getMonth() ? "du " + a + " " + B.MOIS[m.getMonth()] + " au " + v.getDate() + " " + B.MOIS[v.getMonth()] + " " + v.getFullYear() : "du " + a + " au " + v.getDate() + " " + B.MOIS[v.getMonth()] + " " + v.getFullYear();
  }
  function typeCourtAg(e, AG) {
    if (e.kind === "agence") return "RDV agence";
    if (e.kind === "plage") return "Plage réservée";
    if (e.kind === "contact") return "Dossier";
    return e.type === "interne" ? "RDV collègue" : e.type === "rdv_col" ? "RDV client – collègue" : (AG.TYPES[e.type] ? AG.TYPES[e.type].lib : "Agenda");
  }
  /* Légende des codes couleur de l'agenda (mêmes couleurs que dans l'agenda commercial). */
  function legendeAgenda(AG) {
    var g1 = AG.CODES.filter(function (c) { return c.groupe !== "Plages réservées de l'agence"; }), g2 = AG.CODES.filter(function (c) { return c.groupe === "Plages réservées de l'agence"; });
    function liste(l) { return l.map(function (c) { return '<li><span class="ag-sw ag-c-' + c.code + '" aria-hidden="true"></span>' + esc(c.lib) + "</li>"; }).join(""); }
    return '<details class="ag-legende ag-acc-legende"><summary>Codes couleur de l\'agenda</summary><div class="ag-leg-groupe"><p class="ag-leg-titre">Rendez-vous et éléments</p><ul>' + liste(g1) + '</ul></div><div class="ag-leg-groupe"><p class="ag-leg-titre">Plages réservées de l\'agence</p><ul>' + liste(g2) + "</ul></div></details>";
  }
  function entreeAgenda(e, AG) {
    if (e.kind === "plage") return '<li class="ag-acc-e ag-acc-e-plage ag-c-' + AG.codeCouleur(e) + (AG.passe(e.date, e.fin) ? " ag-acc-passe" : "") + '"><span class="rdv-h">' + esc(heureAg(e.heure)) + '</span><span class="rdv-qui"><span class="sr">Plage réservée : </span><span class="ag-acc-pl">' + esc(e.motif) + '</span><span class="rdv-motif">jusqu\'à ' + esc(heureAg(e.fin)) + "</span></span></li>";
    var c = e.client, passe = e.kind === "perso" ? (e.statut !== "afaire" || AG.passe(e.date, e.heure)) : e.kind === "contact" ? true : AG.passe(e.date, e.fin || e.heure);
    var puce = '<span class="puce ag-acc-type ag-acc-' + e.kind + '">' + esc(typeCourtAg(e, AG)) + "</span>" + (e.kind === "perso" && e.statut === "fait" ? ' <span class="puce puce-ok">Fait</span>' : e.kind === "perso" && e.statut === "annule" ? ' <span class="puce puce-bad">Annulé</span>' : "");
    var heure = e.heure ? esc(heureAg(e.heure)) : '<span class="sr">Sans heure précise</span><span aria-hidden="true">–</span>';
    var corps = '<span class="rdv-qui">' + puce + (c ? ' <a href="' + lienClient(c) + '">' + esc(nomComplet(c)) + "</a>" : "") +
      '<span class="rdv-motif">' + esc(e.motif || "") + (e.kind === "plage" ? " (de " + esc(heureAg(e.heure)) + " à " + esc(heureAg(e.fin)) + ")" : e.canal ? " – " + esc(String(e.canal).toLowerCase()) : "") + "</span></span>";
    return '<li class="ag-acc-e ag-acc-e-' + e.kind + " ag-c-" + AG.codeCouleur(e) + (passe ? " ag-acc-passe" : "") + '"><span class="rdv-h">' + heure + "</span>" + corps + "</li>";
  }
  function agendaBloc() {
    var AG = window.SGBF.agenda, st = B.store.charger();
    if (!AG) return '<section class="bloc" id="bloc-agenda" aria-labelledby="t-rdv"><div class="bloc-tete"><h2 id="t-rdv">Agenda du conseiller</h2></div><p class="vide-bloc">L\'agenda n\'est pas disponible.</p></section>';
    var base = AG.semaineParDefaut();
    if (!etat.agLundi) etat.agLundi = base;
    var lundi = etat.agLundi, s = AG.semaine(st, lundi), auj = B.aujourdhui(), n = 0, nA = 0;
    s.jours.forEach(function (j) { j.entrees.forEach(function (e) { if (e.kind !== "plage") n++; if (e.kind === "agence") nA++; }); });
    /* Même grille horaire que l'agenda commercial (agenda.js, grilleHtml), en lecture seule : les heures libres sont affichées, on planifie dans l'agenda commercial. */
    var h = AG.grilleHtml(s, { entree: function (e) { return entreeAgenda(e, AG); }, classeJour: "ag-acc-jour", classeAuj: "ag-acc-auj", chipAuj: false, planifier: false, ajout: false,
      libJourLong: function (d) { return B.fmtLong(d); },
      libJour: function (d) { var a = B.ecartJours(d, auj) === 0; return esc((a ? "Aujourd'hui" : B.JOURS[d.getDay()].charAt(0).toUpperCase() + B.JOURS[d.getDay()].slice(1)) + " " + d.getDate() + (d.getDate() === 1 ? "er " : " ") + B.MOIS[d.getMonth()]); },
      textes: { ferie: function (f) { return "Jour férié (" + f + ") : l'agence est fermée."; } } });
    var estBase = B.ymd(lundi) === B.ymd(base);
    return '<section class="bloc" id="bloc-agenda" aria-labelledby="t-rdv"><div class="bloc-tete"><h2 id="t-rdv">Agenda du conseiller</h2><span class="sous">Semaine ' + s.numero + " – " + esc(libSemaineAg(lundi)) + "</span></div>" +
      '<div class="sem-nav ag-acc-nav"><button type="button" class="btn btn-secondaire" data-act="ag-sem" data-d="-1"' + (B.ecartJours(lundi, base) <= -7 * NB_SEM_AGENDA ? " disabled" : "") + '>‹ Semaine précédente</button>' +
      '<button type="button" class="btn btn-secondaire" data-act="ag-sem" data-d="1"' + (B.ecartJours(lundi, base) >= 7 * NB_SEM_AGENDA ? " disabled" : "") + '>Semaine suivante ›</button>' +
      (estBase ? "" : '<button type="button" class="btn-texte" data-act="ag-sem" data-d="0">Revenir à ' + (B.ymd(base) === B.ymd(AG.lundiDe(auj)) ? "la semaine en cours" : "la prochaine semaine d'ouverture") + "</button>") + "</div>" +
      '<p class="sr" role="status" id="ag-acc-statut">Semaine ' + s.numero + ", " + esc(libSemaineAg(lundi)) + ". " + pl(nA, "rendez-vous de l'agence", "rendez-vous de l'agence") + ", " + pl(n, "élément", "éléments") + " dans l'agenda.</p>" +
      legendeAgenda(AG) + h +
      agendaPerso() + '<p class="note-pied">Tout l\'agenda de la semaine : rendez-vous de l\'agence, vos propres éléments (rendez-vous, relances, rappels) et les plages réservées de l\'agence (gestion, proactivité, réunion d\'équipe du jeudi, accueil). <a href="agenda.html">Ouvrir l\'agenda commercial</a> pour ajouter, modifier ou marquer un élément comme fait.</p></section>';
  }
  function rendezVous() { return agendaBloc(); }

  /* Campagnes en cours et appels : calculés à partir de ce que l'élève a fait dans les outils (rien n'est saisi ici). */
  function campagnes() {
    var CA = window.SGBF.campagnes, PH = window.SGBF.phoning;
    if (!CA || !PH) return "";
    var st = B.store.charger(), en = CA.campagnes(st).filter(function (k) { return CA.statut(k) === "cours"; });
    var h = en.length ? '<ul class="liste-simple camp-liste">' + en.slice(0, 4).map(function (k) {
      var i = CA.indicateurs(st, k), at = i.atteinte === null ? 0 : Math.min(100, i.atteinte);
      return '<li><span><strong><a href="campagnes.html?campagne=' + k.id + '">' + esc(k.nom) + '</a></strong><br><span class="mention">' + esc(nomPiste(k.produit)) + " – " + i.contrats + " / " + k.objectif + " contrat" + (k.objectif > 1 ? "s" : "") + " – " + pl(i.jours.restants, "jour ouvré restant", "jours ouvrés restants") + '</span></span><span class="droite">' + at + " %</span></li>";
    }).join("") + "</ul>" + (en.length > 4 ? '<p class="mention">+ ' + (en.length - 4) + " autre" + (en.length - 4 > 1 ? "s" : "") + " campagne" + (en.length - 4 > 1 ? "s" : "") + ".</p>" : "") :
      '<p class="vide-bloc">Aucune campagne en cours. Créez-en une dans l\'outil « Campagnes commerciales ».</p>';
    var CT = window.SGBF.contacts, auj = B.ymd(B.aujourdhui()), duF = CT ? CT.journal(st).filter(function (x) { return x.date === auj; }) : [], du = PH.journal(st).filter(function (a) { return a.date === auj; }), t = PH.totaux(du), rap = PH.rappelsAFaire(st).filter(function (e) { return AG_passeOuAuj(e); }).length;
    var notes = '<p class="agenda-perso ligne-phoning"><strong>Phoning :</strong> ' + (du.length ? pl(du.length, "appel aujourd'hui", "appels aujourd'hui") + " (" + t.joints + " abouti" + (t.joints > 1 ? "s" : "") + ")" : "aucun appel enregistré aujourd'hui") + (rap ? ", " + pl(rap, "rappel demandé à faire", "rappels demandés à faire") : "") + '. <a href="phoning.html">Ouvrir le phoning</a> – <a href="bilan.html">Voir le bilan</a>.</p>';
    if (CT) notes += '<p class="agenda-perso ligne-face"><strong>Entretiens :</strong> ' + (duF.length ? pl(duF.length, "entretien noté aujourd'hui", "entretiens notés aujourd'hui") : "aucun entretien noté aujourd'hui") + '. <a href="contacts.html">Rédiger un CRE</a>.</p>';
    h += '<div class="camp-notes">' + notes + "</div>";
    return '<section class="bloc" id="bloc-camp" aria-labelledby="t-camp"><div class="bloc-tete"><h2 id="t-camp">Campagnes commerciales</h2></div>' + h + "</section>";
  }
  function AG_passeOuAuj(e) { return window.SGBF.agenda.passe(e.date, e.heure) || B.ecartJours(e.date, B.aujourdhui()) === 0; }

  /* Les outils du conseiller : un menu déroulant (bouton qui ouvre la liste), les outils rangés par thème. Un outil qui ne serait dans aucun thème est repris à la fin, sous « Autres outils ». */
  var THEMES_OUTILS = [
    { lib: "Clients", noms: ["Fiche client 360°", "Opérations de service", "Courriers et documents", "Ouverture de compte", "Interro BDF", "Réclamations", "Avis clients en ligne"] },
    { lib: "Conseiller et vendre", noms: ["Catalogue de produits", "Profil investisseur (MIFID)", "Ordres de bourse", "Montage de prêt", "Suivi d'un crédit en cours", "Simulateur", "Compte Rendu d'Entretien (CRE)", "Messagerie"] },
    { lib: "Prospection et animation", noms: ["Campagnes commerciales", "Phoning et prospection", "O2PC : opportunités commerciales"] },
    { lib: "Gestion du risque", noms: ["Opérations débiteurs", "Régularisation FCC", "Saisies administratives (SATD)", "Gestion des incidents", "Mouvements atypiques", "Messages suspects"] },
    { lib: "Pilotage et organisation", noms: ["Portefeuille", "Résultats et bilan", "Tableau de bord de l'agence", "Agenda commercial", "Agenda de l'équipe", "Carte de visite"] }
  ];
  function lienOutil(o) {
    var corps = '<span class="outil-ico" aria-hidden="true">' + ICO[o.ico] + '</span><span>' + esc(o.nom) + "</span>";
    return o.href ? '<li><a class="outil-c" href="' + o.href + '" title="' + esc(o.desc) + '">' + corps + "</a></li>" : '<li><span class="outil-c outil-bientot">' + corps + " (bientôt disponible)</span></li>";
  }
  function outils() {
    var tous = [], par = {}, nb = 0;
    OUTILS.forEach(function (g) { g.items.forEach(function (o) { tous.push(o); par[o.nom] = o; }); });
    var vus = {}, themes = THEMES_OUTILS.map(function (t) {
      return { lib: t.lib, items: t.noms.map(function (n) { vus[n] = true; return par[n]; }).filter(Boolean) };
    });
    var autres = tous.filter(function (o) { return !vus[o.nom]; });
    if (autres.length) themes.push({ lib: "Autres outils", items: autres });
    var h = themes.map(function (t, i) {
      nb += t.items.length;
      return '<div class="om-cat"><button type="button" class="btn btn-principal om-btn" id="om-btn-' + i + '" data-act="menu-outils" data-i="' + i + '" aria-expanded="false" aria-controls="om-liste-' + i + '"><span>' + esc(t.lib) + "</span></button>" +
        '<div class="om-liste" id="om-liste-' + i + '" role="group" aria-label="' + esc(t.lib) + '" hidden><ul>' + t.items.map(lienOutil).join("") + "</ul></div></div>";
    }).join("");
    return '<section class="bloc" id="bloc-outils" aria-labelledby="t-outils"><div class="bloc-tete"><h2 id="t-outils">Les outils du conseiller</h2><span class="sous">' + nb + " outils, rangés par thème</span></div>" +
      '<div class="om" role="group" aria-label="Les outils du conseiller, par thème">' + h + "</div></section>";
  }
  /* Un thème = un bouton qui déroule la liste de ses outils ; un seul thème ouvert à la fois. menuOutils(i) bascule le thème i ; menuOutils() referme tout. */
  function menuOutils(i, ouvrir) {
    var boutons = document.querySelectorAll(".om-btn");
    Array.prototype.forEach.call(boutons, function (b, k) {
      var l = document.getElementById("om-liste-" + k); if (!l) return;
      var o = k === i ? (typeof ouvrir === "boolean" ? ouvrir : l.hidden) : false;
      l.hidden = !o; b.setAttribute("aria-expanded", o ? "true" : "false");
    });
  }
  function themeOuvert() { return document.querySelector(".om-liste:not([hidden])"); }
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var l = themeOuvert(); if (!l) return;
    var dedans = l.contains(document.activeElement); menuOutils();
    if (dedans) { var b = document.getElementById(l.id.replace("om-liste-", "om-btn-")); if (b) b.focus(); }
  });
  document.addEventListener("click", function (e) {
    if (!themeOuvert()) return;
    if (!e.target.closest || !e.target.closest(".om-cat")) menuOutils();
  });


  /* ---------- ventes de la semaine ---------- */
  var JC = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
  function jourCourt(d) { return JC[d.getDay()] + " " + B.fmtCourt(d); }
  function libLong(d) { return B.JOURS[d.getDay()] + " " + d.getDate() + (d.getDate() === 1 ? "er " : " ") + B.MOIS[d.getMonth()]; }
  function cn(o) { return o.n + " " + (o.n > 1 ? "contrats" : "contrat"); }
  /* « 2 – 5,52 K€ » : nombre de contrats puis montant en milliers d'euros ; « – » quand il n'y a aucune vente. */
  function nm(o) { return o.n ? '<span class="cn">' + o.n + "</span> – " + B.eurK(o.m) : "–"; }
  function ventesSemaine() {
    var st = B.store.charger(), v = S.ventesSemaine(CL, etat.sem, st.souscriptions, PRO ? PRO.clientsOuverts(st) : []), auj = B.aujourdhui(), t = v.total, univers = etat.vueVentes === "univers";
    var periode = v.enCours ? "du " + libLong(v.debut) + " à aujourd'hui" : "du " + libLong(v.debut) + " au " + libLong(B.plusJours(v.debut, 6));
    function cell(lib, o, fort) { var x = nm(o); return '<td data-label="' + lib + '">' + (fort ? "<strong>" + x + "</strong>" : x) + "</td>"; }
    var lj = v.jours.map(function (j) {
      var est = B.ecartJours(j.date, auj) === 0;
      return "<tr><th scope=\"row\">" + jourCourt(j.date) + (est ? " <span class=\"aujourdhui\">aujourd'hui</span>" : "") + "</th>" + cell("Brutes", j.brut) + cell("Annulées", j.ann) + cell("Nettes", j.net, true) + "</tr>";
    }).join("");
    var tot = '<tr><th scope="row">Total de la semaine</th>' + cell("Brutes", t.brut) + cell("Annulées", t.ann) + cell("Nettes", t.net) + "</tr>";
    var lf = v.parUnivers.map(function (f) {
      var h = "<tr class=\"univ\"><th scope=\"row\">" + esc(f.nom) + '</th><td data-label="Nature du montant" class="gauche">' + esc(f.nature) + "</td>" + cell("Brutes", f.brut) + cell("Annulées", f.ann) + cell("Nettes", f.net, true) + "</tr>";
      f.produits.forEach(function (p) {
        h += '<tr class="prod"><th scope="row"><span class="prod-nom">' + esc(p.nom) + '</span></th><td data-label="Nature du montant" class="gauche"></td>' + cell("Brutes", p.brut) + cell("Annulées", p.ann) + cell("Nettes", p.net) + "</tr>";
      });
      return h;
    }).join("");
    var lignes = [];
    v.jours.forEach(function (j) { j.lignes.forEach(function (l) { lignes.push({ j: j, l: l }); }); });
    var li = lignes.map(function (x) {
      var l = x.l, p = PR.parId[l.p];
      return '<li class="' + (l.annulee ? "vl-ann" : "") + '"><span class="vl-date">' + jourCourt(x.j.date) + '</span><span class="vl-corps"><a href="' + lienClient(l.client) + '">' + esc(nomComplet(l.client)) + "</a> – 1 contrat " + esc(p ? p.nom : l.p) + (l.eleve ? ' <span class="etat etat-ok">Votre vente</span>' : "") +
        '<span class="vl-montant">' + B.eurK(l.montant) + " <span class=\"vl-nature\">(" + esc(S.NATURE[l.famille]) + ")</span></span>" +
        (l.annulee ? '<span class="vl-motif"><span class="etat etat-bad">Annulée le ' + B.fmtCourt(l.annulee.date) + "</span> " + esc(l.annulee.motif) + "</span>" : "") + "</span></li>";
    }).join("");
    var tableau = univers
      ? '<div class="tab-wrap"><table class="tab-ventes tab-fam"><caption class="sr">Ventes de la semaine ' + (v.semaine % 100) + ' par univers de produits et par produit, en nombre de contrats et en K€</caption>' +
        '<thead><tr><th scope="col">Univers de produits</th><th scope="col">Nature du montant</th><th scope="col">Ventes brutes (contrats – K€)</th><th scope="col">Ventes annulées (contrats – K€)</th><th scope="col">Ventes nettes (contrats – K€)</th></tr></thead>' +
        "<tbody>" + lf + '</tbody><tfoot><tr><th scope="row">Total de la semaine</th><td class="gauche" data-label="Nature du montant">somme des univers</td>' + cell("Brutes", t.brut) + cell("Annulées", t.ann) + cell("Nettes", t.net) + "</tr></tfoot></table></div>"
      : '<div class="tab-wrap"><table class="tab-ventes tab-jours"><caption class="sr">Ventes brutes, annulées et nettes par jour, en nombre de contrats et en K€, semaine ' + (v.semaine % 100) + '</caption>' +
        '<thead><tr><th scope="col">Jour</th><th scope="col">Ventes brutes (contrats – K€)</th><th scope="col">Ventes annulées (contrats – K€)</th><th scope="col">Ventes nettes (contrats – K€)</th></tr></thead>' +
        "<tbody>" + lj + "</tbody><tfoot>" + tot + "</tfoot></table></div>";
    function vue(id, lib) { var actif = (id === "univers") === univers; return '<button type="button" class="mois' + (actif ? " est-actif" : "") + '" data-act="vue-ventes" data-v="' + id + '" aria-pressed="' + actif + '">' + lib + "</button>"; }
    return '<section class="bloc" id="bloc-ventes" aria-labelledby="t-ventes">' +
      '<div class="bloc-tete"><h2 id="t-ventes">Ventes de la semaine</h2><span class="sous">Semaine ' + (v.semaine % 100) + " – " + periode + "</span></div>" +
      '<div class="sem-nav"><button type="button" class="btn btn-secondaire" data-act="sem" data-d="1"' + (etat.sem >= SEM_MAX ? " disabled" : "") + '>' + "‹ Semaine précédente</button>" +
      '<button type="button" class="btn btn-secondaire" data-act="sem" data-d="-1"' + (etat.sem <= 0 ? " disabled" : "") + '>Semaine suivante ›</button>' +
      (etat.sem > 0 ? '<button type="button" class="btn-texte" data-act="sem" data-d="0">Revenir à la semaine en cours</button>' : '<span class="sous">Semaine en cours</span>') + "</div>" +
      '<dl class="kpis kpis-3">' +
        '<div class="kpi"><dt>Ventes brutes</dt><dd class="val">' + cn(t.brut) + '</dd><dd class="det">Montant : ' + B.eurK(t.brut.m) + "</dd></div>" +
        '<div class="kpi kpi-ann"><dt>Ventes annulées</dt><dd class="val">' + cn(t.ann) + '</dd><dd class="det">Montant : ' + B.eurK(t.ann.m) + "</dd></div>" +
        '<div class="kpi kpi-net"><dt>Ventes nettes</dt><dd class="val">' + cn(t.net) + '</dd><dd class="det">Montant : ' + B.eurK(t.net.m) + "</dd></div>" +
      "</dl>" +
      '<div class="rel-mois vue-ventes" role="group" aria-label="Vue des ventes"><span class="rel-mois-lib">Vue :</span>' + vue("total", "Total, jour par jour") + vue("univers", "Par univers de produits") + "</div>" +
      tableau +
      '<details class="detail-ventes"><summary>Liste des ventes de la semaine (' + lignes.length + ")</summary>" + (li ? '<ul class="ventes-liste">' + li + "</ul>" : '<p class="vide-bloc">Aucune vente cette semaine.</p>') + "</details>" +
      '<details class="detail-ventes"><summary>Définitions : vente brute, vente nette, montants</summary><p class="note-pied"><strong>Vente brute</strong> : contrat conclu dans la semaine, y compris s\'il a été annulé ensuite. <strong>Vente nette</strong> = vente brute – ventes annulées (rétractation, dossier refusé, saisie en double, éligibilité non justifiée…). Une annulation est comptée à la date de la vente d\'origine. ' +
      'Montants en K€ (milliers d\'euros) : <strong>encours</strong> (versement ou valeur du contrat) pour l\'épargne et les placements, capital emprunté pour un crédit, cotisation annuelle pour un compte, une carte ou une assurance. Le montant total est la somme de ces montants. Date d\'une vente : jour ouvré d\'ouverture du contrat. <strong>Vos souscriptions</strong> (catalogue, crédits accordés dans le montage de prêt) sont comptées comme des ventes, au jour de la souscription : versement initial ou capital emprunté s\'il est saisi, sinon cotisation annuelle du catalogue (pour une assurance : douze fois la cotisation mensuelle « à partir de »). Annuler une souscription la retire des ventes. Définition retenue par l\'agence : elle n\'est pas officielle.</p></details>' +
      "</section>";
  }

  /* ---------- à traiter : débiteurs et atypiques ---------- */
  function avancement(cle, liste, version) {
    var vus = null, lu = false;
    try {
      var s = JSON.parse(window.localStorage.getItem(cle) || "null"); lu = true;
      /* l'avancement n'est retenu que s'il date du même jour (et de la même version) : le lendemain, les dossiers sont d'autres dossiers */
      vus = (s && s.v === version && s.jour === TR.jour && s.valides) || {};
    } catch (e) { vus = {}; }
    var restants = liste.filter(function (d) { return !vus[d.id]; });
    return { total: liste.length, faits: liste.length - restants.length, restants: restants, lu: lu };
  }
  function libelleTravail() {
    if (TR.jour === "reference") return "Dossiers de référence (les mêmes tous les jours).";
    var j = window.SGBF.jourTravail && window.SGBF.jourTravail.maintenant ? window.SGBF.jourTravail.maintenant() : new Date();
    return "Dossiers du " + j.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) + " : les mêmes pour toute la classe, d'autres demain.";
  }
  function carteTravail(titre, ico, href, av, sous, o) {
    o = o || {};
    var nb = av.restants.length, pct = av.total ? Math.round(100 * av.faits / av.total) : 0, fait = o.fait || ["traité", "traités"];
    var prochains = av.restants.slice(0, 3).map(function (d) { return o.item ? o.item(d) : "<li>n° " + d.id + " – " + esc(d.nom) + "</li>"; }).join("");
    return '<li class="tache"><div class="tache-tete"><span class="outil-ico">' + ICO[ico] + '</span><div><p class="tache-titre">' + esc(titre) + '</p><p class="tache-sous">' + esc(sous) + "</p></div>" +
      '<span class="tache-nb' + (nb ? "" : " zero") + '"><span class="tache-val">' + nb + '</span><span class="tache-lib">' + (o.nbLib || "à traiter") + "</span></span></div>" +
      '<div class="tache-prog"><span class="barre ' + (nb ? "b-warn" : "b-ok") + '" aria-hidden="true"><span style="width:' + pct + '%"></span></span><span class="tache-txt">' + av.faits + " " + (av.faits > 1 ? fait[1] : fait[0]) + " sur " + av.total + "</span></div>" +
      (nb ? '<p class="tache-suite">' + (o.suite || "Prochains dossiers :") + '</p><ul class="tache-liste">' + prochains + "</ul>" : '<p class="tache-suite">' + (o.tout || "Tous les dossiers sont traités.") + "</p>") +
      '<a class="btn btn-secondaire" href="' + href + '">' + (av.faits ? "Reprendre l'outil" : "Ouvrir l'outil") + "</a></li>";
  }
  /* O2PC : la liste du jour se calcule en quelques centaines de millisecondes la première fois (les relevés de compte sont construits) : la carte s'affiche
     d'abord vide, puis se remplit une fois le tableau de bord à l'écran. */
  var o2pcPret = false;
  function etatO2pc() {
    var O = window.SGBF.o2pc;
    if (!O) return null;
    var l = O.liste(B.store.charger()), restants = l.items.filter(function (x) { return !x.appel; });
    return { total: l.total, faits: l.total - restants.length, restants: restants.map(function (x) { return { id: x.rang, nom: nomComplet(x.client) + " – " + x.themeLib }; }) };
  }
  function carteO2pc() {
    if (!window.SGBF.o2pc) return "";
    if (!o2pcPret) return '<li class="tache" id="tache-o2pc" aria-busy="true"><div class="tache-tete"><span class="outil-ico">' + ICO.recherche + '</span><div><p class="tache-titre">O2PC : opportunités commerciales</p><p class="tache-sous">Calcul de la liste du jour…</p></div></div></li>';
    var av = etatO2pc();
    return carteTravail("O2PC : opportunités commerciales", "recherche", "o2pc.html", av, "Clients à appeler pendant la session de proactivité", { item: function (d) { return "<li>" + esc(d.nom) + "</li>"; }, nbLib: "à appeler", fait: ["appelé", "appelés"], suite: "Prochains clients :", tout: "Tous les clients de la liste ont été appelés." }).replace('<li class="tache">', '<li class="tache" id="tache-o2pc">');
  }
  function majO2pc() {
    o2pcPret = true;
    var z = document.getElementById("tache-o2pc"); if (!z) return;
    z.outerHTML = carteO2pc();
    var n = document.getElementById("travail-nb"), av = etatO2pc();
    if (n && av) n.textContent = (parseInt(n.getAttribute("data-base"), 10) + av.restants.length) + " dossiers ou clients en attente";
  }
  /* Ouvertures de compte : la directrice a validé le dossier, le compte reste à ouvrir. La carte n'apparaît que lorsqu'au moins un dossier attend (rappel), et
     disparaît quand tous les comptes sont ouverts. L'état est calculé à partir des dossiers enregistrés dans ce navigateur (outil « Ouverture de compte »). */
  function etatOuvertures() {
    var PO = window.SGBF.prospects, st = null, now = B.maintenant();
    try { st = B.store.charger(); } catch (e) { st = null; }
    if (!PO || !st) return { total: 0, faits: 0, restants: [] };
    var ds = PO.dossiers(st), restants = [], faits = 0;
    ds.forEach(function (d) {
      var e = PO.etat(d, now);
      if (e.code === "ouvert") faits++;
      else if (e.code === "valide") restants.push({ id: d.id, ref: d.ref, nom: (d.fiche.nom || "").toUpperCase() + " " + (d.fiche.prenom || ""), client: !!d.fiche.client });
    });
    return { total: ds.length, faits: faits, restants: restants };
  }
  function carteOuvertures() {
    var o = etatOuvertures();
    if (!o.restants.length) return "";
    return carteTravail("Ouvertures de compte", "dossier", "prospect.html", o, "Dossiers validés par la directrice : le compte est à ouvrir", {
      item: function (d) { return '<li><a href="prospect.html?dossier=' + d.id + '">' + esc(d.ref) + " – " + esc(d.nom.trim()) + (d.client ? " (client)" : " (prospect)") + "</a></li>"; },
      nbLib: "à ouvrir", fait: ["ouvert", "ouverts"], suite: "Dossiers validés, comptes à ouvrir :"
    });
  }
  function aTraiter() {
    var d = avancement(TR.cles.debiteurs, TR.debiteurs, TR.versions.debiteurs), a = avancement(TR.cles.atypiques, TR.atypiques, TR.versions.atypiques), g = avancement(TR.cles.incidents, TR.incidents, TR.versions.incidents);
    var oc = etatOuvertures();
    var base = d.restants.length + g.restants.length + a.restants.length + oc.restants.length, av = o2pcPret ? etatO2pc() : null;
    return '<section class="bloc" id="bloc-travail" aria-labelledby="t-travail"><div class="bloc-tete"><h2 id="t-travail">À traiter</h2><span class="sous" id="travail-nb" data-base="' + base + '">' + (base + (av ? av.restants.length : 0)) + " dossiers" + (window.SGBF.o2pc ? " ou clients" : "") + " en attente</span></div>" +
      '<ul class="taches">' + carteTravail("Opérations débiteurs", "prelevement", "debiteurs.html", d, "Chèques, prélèvements et cartes à payer ou à rejeter") +
      carteTravail("Gestion des incidents", "cloche", "incidents.html", g, "Comptes en incident : relances, courriers, clôture ou opposition") +
      carteTravail("Mouvements atypiques", "alerte", "atypiques.html", a, "Opérations inhabituelles à analyser, contacter, décider") + carteOuvertures() + carteO2pc() + "</ul>" +
      '<p class="note-pied">' + libelleTravail() + ' L\'avancement est celui enregistré dans ce navigateur par les outils ; il repart de zéro le lendemain, si l\'on recommence un outil ou si l\'on efface les données du site. Pour O2PC, un client est « appelé » dès qu\'un appel le concernant est enregistré dans le journal du phoning.</p>' + alertes() + "</section>";
  }

  /* Heure affichée à côté de la date (se met à jour toute seule, sans que l'écran en soit modifié par ailleurs). */
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function heureTexte(d) { return d.getHours() + " h " + pad2(d.getMinutes()); }
  function heureHtml() { var d = B.maintenant(); return '<time id="heure-accueil" datetime="' + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + '">' + heureTexte(d) + "</time>"; }
  function majHeure() { var t = document.getElementById("heure-accueil"); if (!t) return; var d = B.maintenant(), x = heureTexte(d); if (t.textContent !== x) { t.textContent = x; t.setAttribute("datetime", pad2(d.getHours()) + ":" + pad2(d.getMinutes())); } }

  /* Sommaire : accès direct aux rubriques de la page (le tableau de bord est long) ; seules les rubriques présentes sont proposées. */
  var RUBRIQUES = [["bloc-outils", "Outils"], ["bloc-agenda", "Agenda"], ["bloc-travail", "À traiter"], ["bloc-alertes", "Alertes"], ["bloc-ventes", "Ventes"], ["bloc-synthese", "Synthèse"], ["bloc-camp", "Campagnes"], ["bloc-opps", "Opportunités"]];
  function sommaire() {
    var l = RUBRIQUES.filter(function (r) { return document.getElementById(r[0]); });
    return '<nav class="sommaire" aria-label="Aller à une rubrique du tableau de bord"><span class="sommaire-lib" aria-hidden="true">Aller à</span><ul>' + l.map(function (r) { return '<li><a href="#' + r[0] + '">' + esc(r[1]) + "</a></li>"; }).join("") + "</ul></nav>";
  }
  function render() {
    var sy = S.synthese(CL), auj = B.aujourdhui();
    app.innerHTML = '<div class="page-titre"><h1>Tableau de bord</h1><p>Agence de Paris – portefeuille n°3575 – ' + esc(B.fmtLong(auj)) + ", " + heureHtml() + "</p></div>" +
      '<div class="page-grille">' + outils() + rendezVous() + aTraiter() + ventesSemaine() + synthese(sy) + campagnes() + opportunites() +
      "</div>" +
      '<p class="mention" style="margin-top:20px">Les plafonds et taux réglementés cités sont ceux de l\'automne 2026.</p>';
    app.querySelector(".page-grille").insertAdjacentHTML("beforebegin", sommaire());
  }

  /* ---------- événements ---------- */
  app.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b) return;
    var act = b.getAttribute("data-act");
    if (act === "menu-outils") menuOutils(parseInt(b.getAttribute("data-i"), 10));
    else if (act === "sem") {
      var dd = parseInt(b.getAttribute("data-d"), 10);
      etat.sem = dd === 0 ? 0 : Math.max(0, Math.min(SEM_MAX, etat.sem + dd));
      var z = document.getElementById("bloc-ventes"); z.outerHTML = ventesSemaine();
      var cible = app.querySelector('#bloc-ventes [data-act="sem"]:not([disabled])') || app.querySelector("#bloc-ventes h2");
      var pref = app.querySelector('#bloc-ventes [data-act="sem"][data-d="' + (dd === 0 ? 1 : dd) + '"]:not([disabled])');
      (pref || cible).focus();
    }
    else if (act === "ag-sem") {
      var AGm = window.SGBF.agenda, dg = parseInt(b.getAttribute("data-d"), 10), bs = AGm.semaineParDefaut();
      etat.agLundi = dg === 0 ? bs : B.plusJours(etat.agLundi || bs, 7 * dg);
      document.getElementById("bloc-agenda").outerHTML = agendaBloc();
      var pg = app.querySelector('#bloc-agenda [data-act="ag-sem"][data-d="' + (dg === 0 ? 1 : dg) + '"]:not([disabled])') || app.querySelector('#bloc-agenda [data-act="ag-sem"]:not([disabled])') || app.querySelector("#bloc-agenda h2");
      if (pg) { if (!pg.hasAttribute("tabindex") && pg.tagName === "H2") pg.setAttribute("tabindex", "-1"); pg.focus(); }
    }
    else if (act === "vue-ventes") {
      etat.vueVentes = b.getAttribute("data-v") === "univers" ? "univers" : "total";
      document.getElementById("bloc-ventes").outerHTML = ventesSemaine();
      var vb = app.querySelector('#bloc-ventes [data-act="vue-ventes"][aria-pressed="true"]'); if (vb) vb.focus();
    }
    else if (act === "filtre") { etat.filtre = b.getAttribute("data-f"); etat.nbOpp = 8; render(); app.querySelector('[data-act="filtre"][data-f="' + etat.filtre + '"]').focus(); }
    else if (act === "plus-opp") { etat.nbOpp += 10; var n = etat.nbOpp; render(); var li = app.querySelectorAll(".opps > li"); if (li[n - 10]) li[n - 10].querySelector("a").focus(); }
    else if (act === "alerte-tout") { var c = b.getAttribute("data-c"); etat.alertes[c] = true; var ouverts = Array.prototype.map.call(app.querySelectorAll("details.alerte"), function (d) { return d.open; }); render(); app.querySelectorAll("details.alerte").forEach(function (d, i) { d.open = ouverts[i]; }); }
  });

  app.addEventListener("toggle", function (e) { if (e.target.id === "bloc-opps") etat.oppOuvert = e.target.open; }, true);

  RECH.init(CL, document.getElementById("rech"), document.getElementById("rech-res"), document.getElementById("rech-statut"));
  render();
  window.setTimeout(majO2pc, 0);
  window.setInterval(majHeure, 15000);
})();
