/* GS Banque & Assurance – recherche de l'en-tête : un client (nom, prénom, numéro, ou IBAN / RIB / numéro de compte), un produit du catalogue (nom, code, famille, mot courant) ou un outil
   (nom ou mot-clé : « rdv », « mensualité », « bilan »…). Les résultats sont groupés ; le groupe le plus pertinent passe en premier ;
   Entrée ouvre le premier résultat. Pour ajouter un mot-clé à un outil ou à un produit, modifier OUTILS ou MOTS_PRODUITS ci-dessous.
   Le mot « simulation », tapé seul, propose l'écran « Simulations d'appels » de l'enseignant (commande à part : voir COMMANDE_SIMULATIONS). */
(function (root) {
  "use strict";
  var B = root && root.SGBF ? root.SGBF.banque : require("./banque.js");
  function produits() {
    var P = root && root.SGBF && root.SGBF.produits ? root.SGBF.produits : (typeof require !== "undefined" ? require("./produits.js") : null);
    return P || { produits: [], familles: [] };
  }

  function norm(s) { return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[-']/g, " ").replace(/\s+/g, " ").trim(); }

  /* ---------- clients ---------- */
  var index = null;
  function construire(clients) {
    index = clients.map(function (c) { return { c: c, t: norm(c.prenom + " " + c.nom + " " + c.nom + " " + c.prenom + " " + c.num) }; });
  }
  /* ---------- IBAN, RIB et numéro de compte ----------
     L'IBAN d'un client se calcule à partir de son numéro (rib.js) : on retrouve donc un client en collant son IBAN (avec ou sans espaces), son RIB (code banque, code guichet,
     numéro de compte, clé) ou seulement son numéro de compte. Il faut au moins 11 caractères : en dessous, la saisie est traitée comme un nom ou un numéro de client. */
  function ribModule() { return root && root.SGBF && root.SGBF.rib ? root.SGBF.rib : (typeof require !== "undefined" ? require("./rib.js") : null); }
  var MIN_IBAN = 11, cacheIban = {};
  function compact(requete) { return norm(requete).replace(/ /g, ""); }
  function estIban(requete) { var k = compact(requete); return k.length >= MIN_IBAN && /^[0-9a-z]+$/.test(k) && (/^fr\d/.test(k) || /^\d+$/.test(k)); }
  /* IBAN du compte courant de rang "rang" d'un client (ou d'une fiche d'ouverture : seuls le numéro et le nom servent) ; null si le calcul est impossible. */
  function ibanDe(c, rang) {
    var R = ribModule(), cle = c.id + "|" + c.num + "|" + (rang || 1);
    if (!R) return null;
    if (cacheIban[cle] !== undefined) return cacheIban[cle];
    var r = null;
    try { r = R.rib({ num: c.num, civ: c.civ || "", nom: c.nom, prenom: c.prenom, adr: c.adr || { rue: "", cp: "", ville: "" }, fam: c.fam || null }, rang || 1); } catch (e) { r = null; }
    return (cacheIban[cle] = r ? { iban: r.iban, lisible: r.ibanLisible, compte: r.compte, rang: rang || 1 } : null);
  }
  /* Comptes courants supplémentaires ouverts pendant l'exercice pour un client existant (rang 2) : { c, iban }. */
  function comptesSupplementaires(clients) {
    var st; try { st = B.store && B.store.charger(); } catch (e) { return []; }
    var ds = st && Array.isArray(st.prospects) ? st.prospects.filter(function (d) { return d && d.ouvert && d.fiche && d.fiche.client; }) : [], res = [];
    ds.forEach(function (d) {
      var c = clients.filter(function (x) { return x.id === d.fiche.client; })[0], i = c ? ibanDe(c, 2) : null;
      if (i) res.push({ c: c, i: i });
    });
    return res;
  }
  /* Clients dont un compte contient la saisie : [{ c, i }] (i : { iban, lisible, compte, rang }). */
  function chercherIban(clients, requete) {
    if (!estIban(requete)) return [];
    var k = compact(requete), res = [];
    clients.forEach(function (c) { var i = ibanDe(c, 1); if (i && i.iban.toLowerCase().indexOf(k) >= 0) res.push({ c: c, i: i }); });
    comptesSupplementaires(clients).forEach(function (x) { if (x.i.iban.toLowerCase().indexOf(k) >= 0) res.push(x); });
    return res;
  }

  function chercher(clients, requete, max) {
    if (!index || index.length !== clients.length) construire(clients);
    var par = chercherIban(clients, requete);
    if (par.length) return par.map(function (x) { return x.c; }).slice(0, max || 8);
    var q = norm(requete);
    if (q.length < 2) return [];
    var mots = q.split(" ");
    var res = index.filter(function (x) { return mots.every(function (m) { return x.t.indexOf(m) >= 0; }); }).map(function (x) { return x.c; });
    res.sort(function (a, b) {
      var an = norm(a.nom).indexOf(mots[0]) === 0 ? 0 : 1, bn = norm(b.nom).indexOf(mots[0]) === 0 ? 0 : 1;
      return an - bn || a.nom.localeCompare(b.nom, "fr") || a.prenom.localeCompare(b.prenom, "fr");
    });
    return res.slice(0, max || 8);
  }
  function lien(c) { return c.prospect ? "prospect.html?dossier=" + c.id : "client.html?id=" + c.id; }
  /* Les clients dont le compte a été ouvert pendant l'exercice (ouverture de compte pour un prospect) se retrouvent comme les autres. */
  function avecOuverts(clients) {
    var st; try { st = B.store && B.store.charger(); } catch (e) { return clients; }
    var ds = st && Array.isArray(st.prospects) ? st.prospects.filter(function (d) { return d && d.ouvert && d.fiche && !d.fiche.client; }) : [];
    if (!ds.length) return clients;
    var auj = B.aujourdhui();
    return clients.concat(ds.map(function (d) {
      var f = d.fiche, n = B.lireYmd(f.naissance), age = n ? auj.getFullYear() - n.getFullYear() - ((auj.getMonth() < n.getMonth() || (auj.getMonth() === n.getMonth() && auj.getDate() < n.getDate())) ? 1 : 0) : f.age;
      return { id: d.id, prenom: f.prenom, nom: f.nom, num: d.ouvert.num, age: age, pro: { prof: f.profession }, prospect: d.id };
    }));
  }

  /* ---------- outils : raccourcis par mot-clé ---------- */
  /* nom : libellé affiché ; sous : une ligne d'explication ; href : page (et volet) ouverte ; mots : mots-clés, sans souci d'accent ni de majuscule.
     Une requête trouve un outil si chacun de ses mots commence un mot du nom ou d'un mot-clé. */
  var OUTILS = [
    { nom: "Accueil – tableau de bord", sous: "Ventes de la semaine, rendez-vous, alertes, opportunités", href: "index.html",
      mots: ["accueil", "tableau de bord", "synthese commerciale", "ventes de la semaine", "ventes", "objectifs", "opportunites", "alertes", "a traiter"] },
    { nom: "Fiche client 360°", sous: "Comptes, relevés, épargne, crédits, assurances, notes, opérations de service", href: "client.html",
      mots: ["fiche client", "fiche", "dossier client", "dossier", "client", "360", "releve", "releves", "compte courant", "identite", "coordonnees", "operations de service", "virement", "virement sepa", "virement international", "virement interne", "opposition carte", "contestation carte", "contestation cb", "contester une operation par carte", "contester un paiement par carte", "kit de contestation", "operation non reconnue", "paiement non reconnu", "paiement frauduleux", "fraude carte", "carte volee", "carte perdue", "opposition cheque", "chequier", "commande de chequier", "cheque de banque", "plafond de carte", "montee en gamme", "retrait d especes", "carte rechargee", "rejet de prelevement", "devises", "achat de devises", "vente de devises", "change", "change manuel", "billets", "dollars", "verification d identite", "piece d identite", "remise en main propre", "envoi a domicile", "stock", "chequier de depannage", "carte instantanee"] },
    { nom: "Opérations de service", sous: "Virement, carte, chéquier, espèces, devises, clôture et désolidarisation de compte", href: "operations.html",
      mots: ["operations de service", "operation de service", "operation", "operations", "tuile operation", "virement", "virement sepa", "virement international", "virement interne", "opposition carte", "opposition cheque", "contestation carte", "plafond carte", "montee en gamme", "cheque de banque", "chequier", "commande de chequier", "rejet de prelevement", "retrait d especes", "devises", "change", "achat de devises", "vente de devises", "guichet", "accueil client", "cloture de compte", "cloture du compte", "desolidarisation", "desolidariser un compte joint", "compte joint", "compte monotitulaire", "compte individuel"] },
    { nom: "Courriers et documents", sous: "Pièces à fournir, désistement d'un chèque, courriers MURCEF, lettre de droit au compte", href: "courriers.html",
      mots: ["courriers et documents", "courrier", "courriers", "document", "documents", "documents a fournir", "liste des documents", "pieces justificatives", "pieces a fournir", "document a signer", "desistement", "lettre de desistement", "desistement cheque", "cheque perdu", "beneficiaire du cheque", "document a faire signer", "signature", "murcef", "procedure murcef", "courrier d information", "information prealable", "date limite de regularisation", "papier a en tete", "pret immobilier", "credit immobilier", "pret relais", "mandat de vente", "avis de valeur", "acquisition", "construction", "rachat de creance", "pret a taux zero", "ptz", "etat civil", "justificatif de domicile", "avis d imposition", "bulletins de salaire", "credit a la consommation", "credit consommation", "pret a la consommation", "pret personnel", "credit auto", "pret travaux", "cdi", "salarie en cdi", "contrat de travail", "releves de compte", "rib", "bon de commande", "devis signe", "justificatif de financement", "15 000", "ouverture de compte", "ouverture de compte courant", "justificatifs ouverture de compte", "justificatifs a fournir", "piece d identite", "carte d identite", "passeport", "justificatif de revenus", "justificatifs de revenus", "compte joint", "compte indivis", "attestation d hebergement", "taxe fonciere", "hebergement", "droit au compte", "lettre de droit au compte", "refus d ouverture de compte", "refus d ouverture", "attestation de refus", "lettre de refus", "mandat de transmission", "services bancaires de base"] },
    { nom: "Opérations débiteurs", sous: "Payer ou rejeter chèques, prélèvements, cartes ; procédure MURCEF", href: "debiteurs.html",
      mots: ["debiteur", "debiteurs", "operations", "cheque", "cheques", "prelevement", "prelevements", "rejet", "rejeter", "payer", "paiement par carte", "decouvert", "solde debiteur", "cheque sans provision", "defaut de provision", "murcef", "procedure murcef", "cheque en suspens", "mise en suspens", "informer le titulaire", "date limite de regularisation", "regularisation", "courrier d information", "lettre d injonction", "injonction", "interdiction bancaire", "interdit bancaire", "interdiction d emettre des cheques", "fcc", "fichier central des cheques"] },
    { nom: "Gestion des incidents", sous: "Comptes en incident : relances à 15, 30, 60 et 90 jours, courriers, clôture, opposition", href: "incidents.html",
      mots: ["incident", "incidents", "gestion des incidents", "gdi", "decouvert non autorise", "compte debiteur", "relance", "relances", "mise en demeure", "engagement", "regularisation", "cloture du compte", "service d aide au retrait", "sra", "fichage", "ficp", "fcc", "j15", "j30", "j60", "j90", "courrier au client"] },
    { nom: "Mouvements atypiques", sous: "Analyser une opération atypique, contacter le client, décider", href: "atypiques.html",
      mots: ["atypique", "atypiques", "mouvement", "mouvements", "operation inhabituelle", "justificatif", "justificatifs", "cosi", "decision"] },
    { nom: "Analyse du portefeuille", sous: "Répartition des clients par catégorie socioprofessionnelle et autres critères", href: "portefeuille.html?volet=analyse",
      mots: ["analyse", "portefeuille", "pcs", "csp", "categorie socioprofessionnelle", "repartition", "segment", "segments", "tranche d age", "comparaison avec paris", "insee", "statistiques"] },
    { nom: "Portefeuille clients", sous: "Recherche, filtres, tris, cibles enregistrées", href: "portefeuille.html?volet=clients",
      mots: ["portefeuille", "clients", "liste des clients", "liste", "filtre", "filtres", "tri", "cible", "cibles", "ciblage", "selection"] },
    { nom: "Catalogue de produits", sous: "59 produits : tarifs, éligibilité, comparaison, souscription", href: "catalogue.html",
      mots: ["catalogue", "produit", "produits", "tarif", "tarifs", "eligibilite", "eligible", "souscription", "souscrire", "comparer", "comparaison", "offre", "contrat", "contrats", "signature", "signature electronique", "signer", "envoyer le contrat", "generer le contrat", "retractation"] },
    { nom: "Agenda commercial", sous: "Rendez-vous, relances et rappels", href: "agenda.html",
      mots: ["agenda", "rdv", "rendez vous", "relance", "relances", "rappel", "rappels", "planning", "calendrier", "semaine", "plage reservee", "plages reservees"] },
    { nom: "Messagerie", sous: "E-mails types adressés aux clients", href: "messagerie.html",
      mots: ["messagerie", "mail", "mails", "email", "e mail", "courriel", "message", "messages", "courrier", "signature", "envoyer"] },
    { nom: "Campagnes commerciales", sous: "Objectif, cible, argumentaire, calendrier, indicateurs", href: "campagnes.html",
      mots: ["campagne", "campagnes", "mailing", "objectif", "argumentaire", "cible", "action commerciale"] },
    { nom: "Phoning et prospection", sous: "Fiche d'appel, règles du démarchage, script, objections", href: "phoning.html",
      mots: ["phoning", "appel", "appels", "telephone", "telephoner", "prospection", "demarchage", "script", "objections", "rappel"] },
    { nom: "O2PC : opportunités commerciales", sous: "La dizaine de clients à appeler chaque jour pendant la session de proactivité", href: "o2pc.html",
      mots: ["o2pc", "opportunite", "opportunites", "opportunites commerciales", "proactivite", "session de proactivite", "clients a appeler", "liste du jour", "devenu majeur", "majorite", "flux exceptionnel", "arrivee de fonds", "plafond", "cat a echeance", "credit renouvelable", "pret a echeance", "iard", "enfant 12 ans", "livret jeune", "pret concurrence", "rachat de credit", "ouverture de pea", "assurance vie fonds euro"] },
    { nom: "Compte Rendu d'Entretien (CRE)", sous: "Noter un client reçu à l'accueil ou en rendez-vous", href: "contacts.html",
      mots: ["cre", "compte rendu", "comptes rendus", "compte rendu d entretien", "contact", "contacts", "face a face", "accueil", "rebond", "rebonds", "client recu", "rendez vous en agence"] },
    { nom: "Fiche d'entretien client", sous: "Les 7 étapes de l'entretien, calcul d'endettement, mise à jour du dossier", href: "contacts.html?volet=entretien",
      mots: ["entretien", "entretien client", "decouverte", "accord de decouverte", "argumentation", "proposition", "conclusion", "endettement", "capacite d emprunt", "capacite d epargne", "mise a jour", "actualiser", "dossier a actualiser", "kyc", "mif", "questionnaire mif", "situation familiale", "patrimoine", "projets"] },
    { nom: "Résultats et bilan", sous: "Résultats par moyen, transformation, multiventes, rebonds", href: "bilan.html",
      mots: ["bilan", "resultat", "resultats", "transformation", "multivente", "multiventes", "rebonds", "indicateurs", "performance"] },
    { nom: "Simulateur d'épargne", sous: "Capital acquis, montant à placer, versement, durée ou taux", href: "simulateur.html?volet=epargne",
      mots: ["simulateur", "epargne", "epargner", "placement", "livret", "interets", "interets composes", "interets simples", "capital acquis", "quinzaines", "versement", "taux"] },
    { nom: "Simulateur de prêt", sous: "Mensualité, capital à emprunter ou durée, tableau d'amortissement", href: "simulateur.html?volet=pret",
      mots: ["simulateur", "pret", "credit", "emprunt", "emprunter", "mensualite", "amortissement", "tableau d amortissement", "endettement", "taux"] },
    { nom: "Profil investisseur (MIFID)", sous: "Questionnaire avant un produit boursier, rapport de conseil à remettre au client", href: "mifid.html",
      mots: ["mifid", "mif", "mif 2", "profil investisseur", "questionnaire", "questionnaire mifid", "rapport de conseil", "rapport", "devoir de conseil", "adequation", "conseil", "produit boursier", "produits boursiers", "connaissance et experience", "appetence au risque", "finance durable"] },
    { nom: "Ouverture de compte", sous: "Prospect ou client : dossier, validation de la directrice, ouverture et équipement", href: "prospect.html",
      mots: ["ouverture de compte", "ouvrir un compte", "ouvrir compte", "prospect", "prospects", "nouveau client", "entree en relation", "creation de compte", "dossier d ouverture", "kyc", "connaissance client", "validation de la directrice", "validation du conseiller", "soumettre a validation", "validation du manager", "equiper", "equipement", "recommandation", "recommande", "parrainage", "parrain", "filleul", "offre de parrainage", "compte supplementaire", "compte secondaire", "ouvrir un compte pour un client", "droit au compte", "refus d ouverture de compte", "carte bancaire", "cheque", "chequier", "banque au quotidien", "convention de compte", "banque a distance", "alertes sms"] },
    { nom: "Interro BDF", sous: "Interroger la Banque de France : FCC (interdit bancaire) et FICP (incidents de crédit)", href: "interro_bdf.html",
      mots: ["interro bdf", "interrogation bdf", "interrogation de la banque de france", "interroger la banque de france", "banque de france", "bdf", "fcc", "ficp", "fichier central des cheques", "interdit bancaire", "interdiction bancaire", "interdit de cheque", "fichage", "fiche", "incidents de remboursement", "surendettement", "cle de recherche", "interro ficp", "interro fcc", "consultation fcc", "consultation ficp"] },
    { nom: "Saisies administratives (SATD)", sous: "Avis à tiers détenteur : blocage des comptes, versement au Trésor public, mainlevée", href: "satd.html",
      mots: ["satd", "saisie administrative", "saisie administrative a tiers detenteur", "saisies administratives", "avis a tiers detenteur", "ati", "tiers detenteur", "saisie", "saisie du tresor", "saisie des impots", "saisie fiscale", "tresor public", "comptable public", "tresorerie", "service des impots", "sip", "dette fiscale", "impots impayes", "amende impayee", "blocage du compte", "compte bloque", "solde bancaire insaisissable", "sbi", "insaisissable", "mainlevee", "levee de saisie", "frais de saisie", "frais satd", "frais saisie administrative", "versement au tresor", "opposition administrative", "saisie sur compte"] },
    { nom: "Régularisation FCC", sous: "Régulariser un chèque impayé : blocage de provision ou remise du chèque", href: "regularisation_fcc.html",
      mots: ["regularisation fcc", "regularisation", "regulariser", "regulariser un cheque", "regulariser le fcc", "regularisation du fcc", "regularisation d un cheque", "regularisation cheque", "levee d interdiction", "levee de l interdiction bancaire", "lever l interdiction bancaire", "sortir du fcc", "blocage de provision", "provision bloquee", "bloquer la provision", "remise du cheque", "payer le beneficiaire", "lettre d injonction completee", "declaration de regularisation", "declarer la regularisation", "interdit bancaire", "interdiction bancaire", "fcc", "fichier central des cheques"] },
    { nom: "Suivi d'un crédit en cours", sous: "Remboursement anticipé, renégociation, rachat, regroupement, report de mensualités", href: "suivi_credit.html",
      mots: ["suivi d un credit", "suivi de credit", "suivi du credit", "suivi credit", "credit en cours", "credits en cours", "remboursement anticipe", "rembourser par anticipation", "remboursement par anticipation", "solder un credit", "solder un pret", "ira", "indemnite de remboursement anticipe", "indemnites de remboursement anticipe", "penalite de remboursement", "renegociation", "renegocier", "renegocier un pret", "renegociation de taux", "baisse de taux", "baisser le taux", "avenant", "frais d avenant", "rachat de pret", "rachat de credit", "rachat de credits", "racheter un pret", "pret dans une autre banque", "regroupement de credits", "regrouper des credits", "regroupement", "regle des 60", "regle des 60 pourcent", "modulation", "modulation de mensualite", "moduler", "report de mensualite", "report de mensualites", "report d echeance", "reporter une mensualite", "capital restant du", "pret qui se termine", "fin de pret", "gestion du credit", "vie du credit"] },
    { nom: "Agenda de l'équipe", sous: "Disponibilités des collègues, rendez-vous avec un collègue ou la directrice", href: "equipe.html",
      mots: ["equipe", "agenda de l equipe", "agenda partage", "agendas partages", "collegue", "collegues", "collaborateur", "collaborateurs", "disponibilite", "disponibilites", "directeur", "directrice", "directeur d agence", "conseiller prive", "conseiller clientele privee", "conseiller professionnel", "clientele privee", "clientele professionnelle", "reunion d equipe", "annuaire", "nadia benali", "benali", "thomas lefevre", "lefevre", "claire aubert", "aubert", "karim haddad", "haddad", "helene delorme", "delorme", "nadia", "thomas", "claire", "karim", "helene"] },
    { nom: "Avis clients en ligne", sous: "Qualifier un avis public, décider des suites, répondre sans rien révéler du client", href: "avis_en_ligne.html",
      mots: ["avis clients en ligne", "avis client en ligne", "avis en ligne", "avis clients", "avis client", "avis internet", "avis google", "avis public", "avis publics", "avis negatif", "avis negatifs", "mauvais avis", "faux avis", "avis diffamatoire", "avis diffamatoires", "fausse note", "note de l agence", "notes de l agence", "etoiles", "commentaire en ligne", "commentaires en ligne", "e reputation", "reputation de l agence", "image de l agence", "reseau social", "reseaux sociaux", "site d avis", "repondre a un avis", "reponse a un avis", "reponse publique", "signaler un avis", "diffamation", "droit de reponse", "secret professionnel en ligne", "donnees personnelles publiees", "iban publie", "client victime d une fraude", "hameconnage avis"] },
    { nom: "Tableau de bord de l'agence", sous: "Résultats du mois, écarts avec les objectifs, écarts prioritaires, causes et actions", href: "tableau_bord.html",
      mots: ["tableau de bord de l agence", "tableau de bord agence", "tableau de bord commercial", "tableau de bord mensuel", "analyse du tableau de bord", "analyse d un tableau de bord", "tableau de bord du mois", "resultats de l agence", "resultats du mois", "resultats mensuels", "indicateurs", "indicateurs commerciaux", "indicateurs quantitatifs", "indicateurs qualitatifs", "ecart", "ecarts", "ecart significatif", "ecarts significatifs", "ecarts prioritaires", "ecart prioritaire", "ecarts a suivre", "analyse des ecarts", "objectifs commerciaux", "objectif commercial", "realisation", "realisations", "pnb", "produit net bancaire", "production de credits", "contrats vendus", "taux d equipement", "taux de decroche", "decroche", "transformation en rendez vous", "taux de transformation", "taux de reclamation", "clients distancies", "distancies", "revue a trois mois", "revues a trois mois", "nouveaux clients", "satisfaction", "note de satisfaction", "synthese pour la directrice", "causes probables", "actions correctives", "pilotage commercial", "performance de l agence", "performance commerciale", "a2.1 t1"] },
    { nom: "Messages suspects", sous: "Examiner un e-mail, un SMS ou un appel suspect, relever les indices, décider des mesures", href: "messages_suspects.html",
      mots: ["messages suspects", "message suspect", "mail suspect", "mails suspects", "e mail suspect", "sms suspect", "sms suspects", "appel suspect", "appels suspects", "message frauduleux", "messages frauduleux", "sms frauduleux", "mail frauduleux", "appel frauduleux", "hameconnage", "phishing", "smishing", "vishing", "faux conseiller", "faux conseiller bancaire", "faux service anti fraude", "faux service de securite", "faux ordre de virement", "faux ordres de virement", "fovi", "fraude au president", "changement de rib", "changement d iban", "compte securise", "virement vers un compte securise", "logiciel de prise en main a distance", "prise en main a distance", "usurpation", "usurpation de numero", "numero usurpe", "spoofing", "escroquerie", "arnaque", "arnaques", "fraude", "fraudes", "cybersecurite", "cybermalveillance", "signal spam", "phishing initiative", "33700", "info escroqueries", "contre appel", "code recu par sms", "code de validation", "identifiants voles", "opposition carte", "rappel de fonds", "retour des fonds", "operation non autorisee", "operations non autorisees", "a1.4 t2", "a1.4 t4", "a4.2 t3"] },
    { nom: "Ordres de bourse", sous: "Ordre d'un client titulaire d'un PEA : type, limite, validité, carnet d'ordres, frais", href: "ordres_bourse.html",
      mots: ["ordres de bourse", "ordre de bourse", "ordres de bourse pea", "ordre", "ordres", "bourse", "bourse de paris", "passer un ordre", "passer un ordre de bourse", "acheter des actions", "vendre des actions", "achat d actions", "vente d actions", "action", "actions", "titres", "valeurs mobilieres", "plan d epargne en actions", "carnet d ordres", "carnet d ordre", "ordre au marche", "ordre a cours limite", "cours limite", "limite de prix", "meilleure limite", "ordre a la meilleure limite", "ordre a seuil de declenchement", "ordre a plage de declenchement", "seuil de declenchement", "plage de declenchement", "ordre stop", "stop", "validite d un ordre", "duree de validite", "ordre a revocation", "a revocation", "ordre aberrant", "ordre jour", "taxe sur les transactions financieres", "ttf", "taxe tobin", "courtage", "frais de courtage", "avis d opere", "avis d execution", "etf", "fonds cote", "fonds indiciel", "tracker", "reglement livraison", "reglement livraison t+2", "tick", "pas de cotation", "execution partielle", "valeur peu liquide", "liquidite", "titre eligible au pea", "eligibilite pea", "vente a decouvert", "srd", "verrerie saint ambroise", "thalassa energies", "atelier lumiere", "nordwind", "pacific rail", "lumen sante", "brasserie morel lacroix", "fonds indiciel gs europe"] },
    { nom: "Réclamations", sous: "Enregistrer une réclamation, la remettre au conseiller gestionnaire ou à la directrice", href: "reclamation.html",
      mots: ["reclamation", "reclamations", "reclamation client", "mecontentement", "client mecontent", "plainte", "litige", "insatisfaction", "contestation", "contester des frais", "remboursement de frais", "geste commercial", "mediateur", "conseiller gestionnaire", "directeur d agence", "transmettre une reclamation", "enregistrer une reclamation", "suivi des reclamations"] },
    { nom: "Carte de visite", sous: "Aperçu recto et verso, impression de dix cartes à découper", href: "carte.html",
      mots: ["carte de visite", "cartes de visite", "carte visite", "visite", "business card", "coordonnees", "fonction", "mon nom", "numero de ligne directe", "ligne directe", "mobile", "planche de cartes", "imprimer ma carte"] },
    { nom: "Montage de prêt", sous: "Dossier de crédit : plan de financement, garantie, assurance emprunteur, décision", href: "montage.html",
      mots: ["montage", "pret", "credit", "dossier de credit", "plan de financement", "garantie", "assurance emprunteur", "solvabilite", "offre de pret", "taeg", "decision"] }
  ];

  /* ---------- commande de l'enseignant : « simulation » ----------
     Ce n'est ni un outil de la liste ci-dessus (pas de tuile, pas de bouton dans l'en-tête) ni un mot-clé d'un autre outil : le mot « simulation » (ou « simulations d'appels »), tapé seul,
     propose l'écran « Simulations d'appels ». « simul », « simulateur » ou « simulation de prêt » ne le proposent pas. L'écran est ouvert par app_appels.js (SGBF.alertes.simulations) :
     la commande n'est offerte que sur les pages où ce fichier est chargé (pas dans les paquets d'un outil seul). */
  var COMMANDE_SIMULATIONS = { nom: "Simulations d'appels", sous: "Clients qui appellent : scénarios et script de l'enseignant", href: "#simulations-appels", action: "simulations" };
  function estCommandeSimulations(requete) { return /^simulations?( d appels?)?$/.test(norm(requete)); }
  function commandeDisponible() { return !!(root && root.SGBF && root.SGBF.alertes && typeof root.SGBF.alertes.simulations === "function"); }

  /* mots courants pour retrouver un produit, en plus de son nom, de son code et de sa famille */
  var MOTS_FAMILLE = {
    compte: ["compte", "compte courant", "compte bancaire"], carte: ["carte", "cartes", "carte bancaire", "cb"], epargne: ["epargne", "livret", "livrets"],
    placement: ["placement", "placements", "investissement"], credit: ["credit", "pret", "emprunt"], assurance: ["assurance", "assurances", "protection"], mobile: ["mobile", "internet", "telecom", "telephonie"]
  };
  var VEHICULE = ["vehicule", "vehicule a moteur", "assurance vehicule", "assurance vehicule a moteur"];
  var TELECOM = ["mobile et internet", "telecom", "telephonie", "operateur"];
  var CONVENTION = ["convention", "convention de compte", "offre groupee", "offre groupee de services", "forfait", "package", "services"];
  var MOTS_PRODUITS = {
    AV: ["assurance vie", "vie", "av", "patrimoine", "epargne retraite"], PEA: ["pea", "bourse", "actions", "plan d epargne en actions", "pea classique"], PER: ["retraite", "per", "plan d epargne retraite"],
    CIMMO: ["immobilier", "pret immobilier"], CAUTO: ["auto", "voiture", "financement vehicule"], CTRAV: ["travaux"], DECOUV: ["decouvert", "decouvert autorise", "autorisation de decouvert", "agios", "compte a decouvert"], CREV: ["renouvelable", "credit renouvelable", "revolving", "reserve d argent", "reserve"], MRH: ["habitation", "mrh", "logement"], AUTO: ["auto", "voiture", "assurance auto", "assurance automobile"].concat(VEHICULE),
    GAV: ["gav", "accidents de la vie"], PREV: ["deces", "invalidite", "prevoyance"], JEUNE: ["jeune", "jeunes"], OCF: ["fragile", "clientele fragile"], DAC: ["dac", "droit au compte", "services bancaires de base", "convention droit au compte", "compte gratuit", "banque de france", "designation"], LDDS: ["ldds", "developpement durable"], LEP: ["lep", "populaire"], LBR: ["projets"],
    CVM: CONVENTION.concat(["junior", "gs junior", "mineur", "enfant", "adolescent", "12 17 ans", "12 ans", "compte mineur", "compte enfant", "compte ado"]),
    CVJ: CONVENTION.concat(["avenir", "gs avenir"]), CVA: CONVENTION.concat(["horizon", "gs horizon"]), CVS: CONVENTION.concat(["serenite", "gs serenite"]),
    VPRE: ["gold", "carte gold", "premier", "mastercard gold"], PLAT: ["platinum", "visa platinum", "carte haut de gamme"], WELI: ["world elite", "mastercard", "carte haut de gamme", "conciergerie"],
    VELE: ["electron", "visa electron", "carte electron", "controle de solde", "carte a controle de solde", "autorisation systematique", "carte a autorisation systematique"],
    CAT: ["compte a terme", "cat", "depot a terme", "placement a terme", "epargne bloquee"],
    AVP: ["assurance vie premium", "premium", "banque privee", "haut de gamme", "assurance vie haut de gamme"], AVE: ["assurance vie enfant", "assurance vie pour enfant", "enfant", "mineur", "epargne enfant"],
    MGS: ["mandat", "mandat de gestion", "gestion pilotee", "gestion deleguee", "securitaire", "prudent"], MGE: ["mandat", "mandat de gestion", "gestion pilotee", "gestion deleguee", "equilibre"],
    MGD: ["mandat", "mandat de gestion", "gestion pilotee", "gestion deleguee", "dynamique"], PEAJ: ["pea jeunes", "pea jeune", "bourse jeune"], PEAPME: ["pea pme", "pea pme eti", "pme", "eti"],
    CTO: ["compte titres", "cto", "bourse", "titres", "compte titre ordinaire"], PSOC: ["parts sociales", "part sociale", "societaire", "parts", "capital de la banque"],
    AUTZ: ["automatiz", "epargne automatique", "plan d epargne automatique", "versements programmes", "investissement programme"],
    DEP: ["dependance", "autonomie", "perte d autonomie", "rente dependance"], DECES: ["deces", "assurance deces", "capital deces", "deces temporaire"], OBSQ: ["obseques", "garantie obseques", "frais d obseques", "funeraire", "funerailles"],
    MOTO: ["moto", "scooter", "deux roues", "2 roues", "cyclomoteur", "assurance moto", "assurance deux roues", "assurance 2 roues"].concat(VEHICULE),
    CCAR: ["camping car", "van", "vehicule de loisirs", "caravane", "fourgon amenage", "assurance camping car"].concat(VEHICULE),
    VSP: ["voiture sans permis", "vsp", "quadricycle", "microcar", "assurance voiture sans permis"].concat(VEHICULE), PJ: ["protection juridique", "juridique", "avocat", "litige", "defense juridique"],
    GALE: ["gs alertes", "alertes", "alerte sms", "alertes sms", "sms", "alerte de compte", "alerte solde", "solde par sms", "mini releve", "mini-releve", "seuil", "decouvert", "prevenir le client", "notification"],
    GCON: ["gs connect", "connect", "banque a distance", "banque en ligne", "application mobile", "appli", "application", "espace client", "consultation de compte", "gestion de compte a distance", "virement en ligne", "abonnement"],
    APN: ["appareils nomades", "appareil nomade", "apn", "assurance telephone", "assurance smartphone", "assurance portable", "assurance tablette", "assurance ordinateur portable", "casse", "oxydation", "vol de telephone", "telephone casse", "ecran casse", "smartphone", "tablette", "ordinateur portable"],
    MPAY: ["assurance moyens de paiement", "assurance des moyens de paiement", "moyens de paiement", "perte et vol", "assurance perte et vol", "vol d especes", "agression", "papiers d identite", "cles"],
    MOB: ["forfait mobile", "forfait", "mobile", "telephone", "portable", "sim", "puce", "5g", "portabilite", "sans engagement", "data", "forfait sans engagement"].concat(TELECOM),
    BOX: ["box", "box internet", "internet", "fibre", "wifi", "ftth", "television", "tv", "adsl", "fibre optique"].concat(TELECOM),
    PACK: ["pack", "forfait box", "forfait et box", "forfait + box", "box et mobile", "pack internet mobile"].concat(TELECOM),
    ESIM: ["esim", "e sim", "esim voyage", "voyage", "etranger", "itinerance", "roaming", "data voyage", "internet a l etranger"].concat(TELECOM)
  };

  /* Note d'une requête (mots séparés) pour un libellé et des mots-clés : 0 = ne correspond pas. */
  function mots(s) { return s.split(" "); }
  function chaqueMotCommence(qm, texte) { var tm = mots(texte); return qm.every(function (m) { return tm.some(function (t) { return t.indexOf(m) === 0; }); }); }
  function note(q, qm, nom, cles) {
    var n = 0, nn = norm(nom);
    if (nn === q) n = 100;
    else if (nn.indexOf(q) === 0) n = 90;
    else if (chaqueMotCommence(qm, nn)) n = 70;
    for (var i = 0; i < cles.length; i++) {
      var k = cles[i], v = 0;
      if (k === q) v = 80; else if (k.indexOf(q) === 0) v = 60; else if (chaqueMotCommence(qm, k)) v = 40;
      if (v > n) n = v;
    }
    return n;
  }
  function trier(liste, max) {
    /* t (facultatif) départage les résultats d'un même groupe sans changer la note n, qui sert à ranger les groupes entre eux */
    return liste.map(function (x, i) { return { x: x.x, n: x.n, t: x.t || x.n, i: i }; }).filter(function (x) { return x.n > 0; })
      .sort(function (a, b) { return b.t - a.t || a.i - b.i; }).slice(0, max);
  }
  function requeteNorm(r) { var q = norm(r); return q.length < 2 ? null : q; }

  var OUTILS_N = OUTILS.map(function (o) { return { o: o, cles: o.mots.map(norm) }; });
  function chercherOutils(requete, max) {
    var q = requeteNorm(requete); if (!q) return [];
    var qm = mots(q);
    return trier(OUTILS_N.map(function (e) { return { x: e.o, n: note(q, qm, e.o.nom, e.cles) }; }), max || 4);
  }
  function chercherProduits(requete, max) {
    var q = requeteNorm(requete); if (!q) return [];
    var qm = mots(q), P = produits(), fam = {};
    P.familles.forEach(function (f) { fam[f.id] = f; });
    return trier(P.produits.map(function (p) {
      var f = fam[p.famille] || { nom: "", court: "" }, un = P.universDe ? P.universDe(p) : null;
      var cles = [p.id, p.code, f.nom, f.court, un ? un.nom : ""].concat(MOTS_FAMILLE[p.famille] || [], MOTS_PRODUITS[p.id] || [], p.dici ? ["dici", "document d informations cles"] : []).map(norm);
      var n = note(q, qm, p.nom, cles);
      /* à note égale, le produit dont l'identifiant, le code ou un mot-clé est exactement le mot tapé passe avant celui dont le nom commence seulement par ce mot (« auto » : GS Auto avant AUTOMATIZ) */
      return { x: p, n: n, t: norm(p.id) === q ? 120 : cles.indexOf(q) >= 0 ? n + 15 : n };
    }), max || 6);
  }
  function lienProduit(p) { return "catalogue.html?produit=" + encodeURIComponent(p.id); }
  function libFamille(p) { var P = produits(), u = P.universDe ? P.universDe(p) : null; return u ? u.nom : ""; }   /* univers du catalogue (« Banque au quotidien »…) */

  /* Tous les résultats, par groupe : { groupes: [{ id, titre, lignes: [{ href, nom, sous }] }], total }. Les groupes sont rangés du plus pertinent au moins pertinent
     (à égalité : outils, produits, clients). Une ligne client garde le format d'origine (nom en majuscules, âge, profession, numéro). */
  function rechercher(clients, requete, avecCommande) {
    clients = avecOuverts(clients);
    var q = requeteNorm(requete);
    if (!q) return { groupes: [], total: 0 };
    var qm = mots(q), cmd = (avecCommande === undefined ? commandeDisponible() : !!avecCommande) && estCommandeSimulations(requete);
    var o = chercherOutils(requete, 4), p = chercherProduits(requete, 8), par = chercherIban(clients, requete), c = par.length ? par.slice(0, 8).map(function (x) { return x.c; }) : chercher(clients, requete, 8);
    /* Un client dont le nom ou le prénom est exactement le mot tapé passe avant tout ; un début de nom compte un peu moins qu'un produit ou un outil trouvé par son nom. */
    var noteClient = !c.length ? 0 : par.length ? 100 : c.some(function (x) { var mn = mots(norm(x.nom)).concat(mots(norm(x.prenom))); return qm.every(function (m) { return mn.indexOf(m) >= 0; }); }) ? 100
      : c.some(function (x) { return norm(x.nom).indexOf(qm[0]) === 0 || norm(x.prenom).indexOf(qm[0]) === 0; }) ? 70 : 40;
    var groupes = [
      { id: "outils", titre: "Outils", ordre: 0, n: cmd ? 100 : o.length ? o[0].n : 0, un: "outil", pl: "outils",
        lignes: (cmd ? [{ href: COMMANDE_SIMULATIONS.href, nom: COMMANDE_SIMULATIONS.nom, sous: COMMANDE_SIMULATIONS.sous, action: COMMANDE_SIMULATIONS.action }] : []).concat(o.map(function (r) { return { href: r.x.href, nom: r.x.nom, sous: r.x.sous }; })) },
      { id: "produits", titre: "Produits", ordre: 1, n: p.length ? p[0].n : 0, un: "produit", pl: "produits", lignes: p.map(function (r) { return { href: lienProduit(r.x), nom: r.x.nom, sous: libFamille(r.x) + " – fiche du catalogue" }; }) },
      { id: "clients", titre: "Clients", ordre: 2, n: noteClient, un: "client", pl: "clients", lignes: par.length ? par.slice(0, 8).map(function (x) { return { href: lien(x.c), nom: x.c.nom.toUpperCase() + " " + x.c.prenom, sous: (x.i.rang > 1 ? "Compte courant n° 2" : "Compte courant") + " – IBAN " + x.i.lisible + " – " + x.c.num }; })
        : c.map(function (x) { return { href: lien(x), nom: x.nom.toUpperCase() + " " + x.prenom, sous: x.age + " ans – " + x.pro.prof + " – " + x.num }; }) }
    ].filter(function (g) { return g.lignes.length; }).sort(function (a, b) { return b.n - a.n || a.ordre - b.ordre; });
    return { groupes: groupes, total: groupes.reduce(function (s, g) { return s + g.lignes.length; }, 0) };
  }
  function resume(r) {
    if (!r.total) return "Aucun résultat";
    return r.groupes.map(function (g) { return g.lignes.length + " " + (g.lignes.length > 1 ? g.pl : g.un); }).join(", ");
  }
  function groupeHtml(g) {
    return '<li class="rech-bloc"><p class="rech-titre" id="rech-g-' + g.id + '">' + g.titre + '</p><ul aria-labelledby="rech-g-' + g.id + '">' + g.lignes.map(function (l) {
      return '<li><a href="' + B.esc(l.href) + '"' + (l.action ? ' data-action="' + B.esc(l.action) + '"' : "") + '><span class="rech-nom">' + B.esc(l.nom) + '</span><span class="rech-sous">' + B.esc(l.sous) + "</span></a></li>";
    }).join("") + "</ul></li>";
  }

  /* Branche le champ de recherche : résultats groupés sous le champ, flèches haut/bas, Entrée (premier résultat), Échap pour fermer. */
  function init(clients, champ, liste, statut) {
    function fermer() { liste.hidden = true; liste.innerHTML = ""; }
    function afficher() {
      var q = champ.value.trim();
      if (q.length < 2) { fermer(); statut.textContent = ""; return; }
      var r = rechercher(clients, q);
      if (!r.total) {
        liste.innerHTML = '<li class="rech-vide">Aucun client, produit ni outil ne correspond à « ' + B.esc(q) + " ».</li>";
        statut.textContent = "Aucun résultat";
      } else {
        liste.innerHTML = r.groupes.map(groupeHtml).join("");
        statut.textContent = resume(r);
      }
      liste.hidden = false;
      /* la liste part du bord gauche du champ ; si elle dépasse à droite de la fenêtre (champ placé à droite de l'en-tête), elle s'aligne sur le bord droit du champ */
      liste.style.left = ""; liste.style.right = "";
      var bord = liste.getBoundingClientRect();
      if (bord.right > document.documentElement.clientWidth - 4) { liste.style.left = "auto"; liste.style.right = "0"; }
    }
    /* Raccourci : la touche « / » met le curseur dans la recherche (sauf quand on est déjà en train de saisir du texte). */
    document.addEventListener("keydown", function (e) {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      var t = e.target, nom = t && t.tagName ? t.tagName.toLowerCase() : "";
      if (nom === "input" || nom === "textarea" || nom === "select" || (t && t.isContentEditable)) return;
      e.preventDefault(); champ.focus(); champ.select();
    });
    /* Une ligne « action » (écran des simulations) n'ouvre pas de page : le champ est vidé, la liste se ferme et l'écran s'ouvre. */
    function executer(action) {
      if (action !== "simulations" || !commandeDisponible()) return false;
      champ.value = ""; fermer(); statut.textContent = "";
      root.SGBF.alertes.simulations();
      return true;
    }
    liste.addEventListener("click", function (e) {
      var a = e.target && e.target.closest ? e.target.closest("a[data-action]") : null;
      if (a && executer(a.getAttribute("data-action"))) e.preventDefault();
    });
    champ.addEventListener("input", afficher);
    champ.addEventListener("focus", function () { if (champ.value.trim().length >= 2) afficher(); });
    champ.addEventListener("keydown", function (e) {
      var liens = liste.querySelectorAll("a");
      if (e.key === "ArrowDown" && liens.length) { e.preventDefault(); liens[0].focus(); }
      else if (e.key === "Enter") {
        var r = rechercher(clients, champ.value);
        if (r.total) { e.preventDefault(); var l = r.groupes[0].lignes[0]; if (!(l.action && executer(l.action))) location.href = l.href; }
      }
      else if (e.key === "Escape") { fermer(); }
    });
    liste.addEventListener("keydown", function (e) {
      var liens = Array.prototype.slice.call(liste.querySelectorAll("a")), i = liens.indexOf(document.activeElement);
      if (e.key === "ArrowDown") { e.preventDefault(); if (i < liens.length - 1) liens[i + 1].focus(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); if (i > 0) liens[i - 1].focus(); else champ.focus(); }
      else if (e.key === "Escape") { champ.focus(); fermer(); }
    });
    document.addEventListener("click", function (e) { if (!liste.hidden && !e.target.closest(".recherche")) fermer(); });
    document.addEventListener("focusin", function (e) { if (!liste.hidden && !e.target.closest(".recherche")) fermer(); });
  }
  var api = { chercher: chercher, chercherOutils: chercherOutils, chercherProduits: chercherProduits, rechercher: rechercher, chercherIban: chercherIban, estIban: estIban, ibanDe: ibanDe, init: init, norm: norm, lien: lien, lienProduit: lienProduit, OUTILS: OUTILS, estCommandeSimulations: estCommandeSimulations, COMMANDE_SIMULATIONS: COMMANDE_SIMULATIONS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.recherche = api; }
})(typeof window !== "undefined" ? window : null);
