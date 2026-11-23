/* GS Banque & Assurance – messages suspects : qualifier un message reçu à l'agence ou transmis par un client (e-mail, SMS, appel), relever les indices, choisir les mesures selon ce que le
   client a fait, rédiger la réponse et la faire contrôler avant envoi. Les 12 messages sont dans data_messages.js.
   Règles reprises (textes consultés le 17 novembre 2026) :
     – Ce qu'une banque ne demande jamais (site Les clés de la banque, page « Fraude au faux conseiller ») : code secret de la carte, cryptogramme, identifiants de connexion ; code de validation
       reçu par SMS ; virement vers un « compte de sécurité » ou validation d'un nouveau bénéficiaire ; installation d'un logiciel de prise en main à distance. L'escroc affiche parfois le numéro
       de l'agence. Réflexe : raccrocher, puis rappeler soi-même le numéro officiel (site, application, carte). Victime : agir sans délai (opposition, signalement des opérations, changement des
       codes), conserver les preuves, signaler (internet-signalement.gouv.fr ; SMS au 33700), Info Escroqueries (0 805 805 817), plainte, demande de remboursement écrite, puis médiateur en cas de refus.
     – Hameçonnage (Cybermalveillance.gouv.fr, fiche réflexe « Hameçonnage ») : ne rien fournir, fermer la page, joindre l'organisme sans passer par les coordonnées du message ; mot de passe
       communiqué : le changer tout de suite, partout où il sert ; moyens de paiement communiqués : opposition immédiate ; signaler à Signal Spam (e-mail) et à Phishing Initiative (site) ; plainte.
     – Faux ordre de virement (Cybermalveillance.gouv.fr, fiche réflexe « Faux ordres de virement » ; direction générale des collectivités locales) : demande « urgente et confidentielle », nouvel IBAN,
       virement imprévu ; procédure de validation hiérarchique sans exception ; rappel de l'auteur supposé à des coordonnées issues d'une source fiable, jamais celles du message (consigne de la seconde
       source seulement : la première ne parle pas de contre-appel) ; virement pas encore exécuté : suspendre la demande ; exécuté : alerter la banque au plus vite pour obtenir le retour des fonds.
     – Opérations de paiement non autorisées (Code monétaire et financier) : signalement sans tarder et au plus tard treize mois après le débit, sous peine de forclusion (article L133-24) ; c'est à la
       banque de prouver que l'opération a été authentifiée et enregistrée, et l'utilisation de l'instrument de paiement ne suffit pas nécessairement à prouver l'autorisation ni la négligence grave
       (article L133-23) ; le payeur supporte les pertes en cas d'agissement frauduleux ou de manquement intentionnel ou par négligence grave à ses obligations (article L133-19, IV) ; principe du
       remboursement de l'opération non autorisée (article L133-18, dont la version en vigueur depuis 2022 n'a pas pu être relue : seul le principe est repris, sans délai chiffré).
   Conventions de l'exercice (NON tirées d'un texte, à ne pas présenter comme la loi) : réponse au client de 40 à 180 mots, 1 500 signes au plus ; note à la directrice de 20 à 120 mots ; aucun lien dans
   une réponse ; aucune promesse ni refus de remboursement avant examen ; aucune appréciation de la « négligence » du client ; ni IBAN ni numéro de carte ; seul le numéro de l'agence est cité ;
   la directrice est alertée dès qu'une opération est partie, qu'un ordre suspect est reçu ou que des moyens d'accès sont compromis.
   Ce module est pur : il ne touche ni la page ni la sauvegarde, sauf valider() et remettre() qui travaillent sur st.messagesSuspects (un traitement par message). */
(function (root) {
  "use strict";

  var R0 = root && root.SGBF ? root.SGBF : null;
  function mod(nom, fichier) { return R0 && R0[nom] ? R0[nom] : require("./" + fichier); }
  var B = mod("banque", "banque.js"), CARTE = mod("carte", "carte.js"), DATA = mod("dataMessages", "data_messages.js");
  var MESSAGES = DATA.MESSAGES, TEL = CARTE.TEL_AGENCE, DOMAINE = CARTE.DOMAINE;

  var CANAUX = { email: "E-mail", sms: "SMS", appel: "Appel téléphonique" };
  var CONV = { client: { motsMin: 40, motsMax: 180, signesMax: 1500 }, direction: { motsMin: 20, motsMax: 120, signesMax: 1000 }, noteMax: 300 };

  /* ---------- les types de message, avec la procédure conseillée par GS (convention) ---------- */
  var TYPES = [
    { id: "authentique", lib: "Message authentique", sous: "Il vient bien de l'agence ou de la banque, et ne demande rien de ce qu'une banque ne demande jamais.",
      procedure: "Vérifier l'authenticité par un canal officiel (opération visible dans l'application, rendez-vous à l'agenda, adresse du domaine de l'agence), puis répondre au client sans l'alarmer et lui rappeler les bons réflexes. Aucune mesure d'urgence." },
    { id: "hameconnage", lib: "Hameçonnage", sous: "E-mail ou SMS qui imite une organisation pour obtenir des identifiants, des données de carte ou un paiement, souvent par un lien.",
      procedure: "Ne pas cliquer, conserver le message, le signaler à la plateforme adaptée, joindre l'organisme par un canal officiel. Selon ce que le client a fait : changer ses accès s'il a saisi ses identifiants, faire opposition à la carte s'il a saisi les données de sa carte." },
    { id: "faux_conseiller", lib: "Faux conseiller ou faux service anti-fraude", sous: "Appel ou message d'une personne qui se fait passer pour la banque (le numéro de l'agence peut être affiché) et pousse à donner un code, valider, virer ou installer un logiciel.",
      procedure: "Rappeler qu'une banque ne demande jamais de code, d'identifiant, de virement vers un compte sécurisé ni de logiciel à distance : le client raccroche et rappelle lui-même un numéro officiel. Agir sans délai sur ce qui a été validé, viré ou installé." },
    { id: "faux_ordre", lib: "Faux ordre de virement", sous: "Demande de virement urgente et confidentielle, ou changement de coordonnées bancaires, au nom d'un client ou de la direction.",
      procedure: "Ne rien exécuter. Vérifier la demande auprès de son auteur supposé par un contre-appel à un numéro connu, informer la directrice, conserver les preuves. Si un virement est parti, demander sans délai le retour des fonds." }
  ];

  /* ---------- les indices que l'élève peut relever dans un message ---------- */
  var INDICES = [
    { id: "urgence", lib: "Urgence, menace ou autorité excessive", sous: "Suspension sous 24 heures, « tout de suite », frais de réactivation, carte désactivée." },
    { id: "secret", lib: "Demande de secret", sous: "Ne rien dire à son conseiller, à l'agence ou à ses proches." },
    { id: "donnees", lib: "Demande de données bancaires ou de mots de passe", sous: "Identifiants, numéro de carte, cryptogramme, paiement de « frais »." },
    { id: "code", lib: "Demande d'un code de validation", sous: "Code reçu par SMS à lire ou à saisir, validation d'une opération sur l'application." },
    { id: "virement_secu", lib: "Virement vers un « compte sécurisé » ou validation d'un bénéficiaire", sous: "Mettre l'argent « à l'abri » en le virant à un inconnu." },
    { id: "logiciel", lib: "Installation d'un logiciel de prise en main à distance", sous: "Programme « d'assistance » à installer, code d'accès à communiquer." },
    { id: "lien", lib: "Lien dont l'adresse n'est pas celle de la banque", sous: "L'adresse réelle diffère de l'adresse affichée, ou ressemble à la vraie." },
    { id: "expediteur", lib: "Adresse d'expéditeur d'un autre domaine, ou d'une messagerie grand public", sous: "Le nom affiché peut être celui de la banque : c'est l'adresse qui compte." },
    { id: "numero", lib: "Numéro d'expéditeur ou d'appelant inconnu ou masqué", sous: "Un numéro affiché ne prouve rien : il peut être usurpé." },
    { id: "nouvel_iban", lib: "Nouvel IBAN ou changement de coordonnées bancaires", sous: "Bénéficiaire inconnu, IBAN donné dans le message." },
    { id: "hors_procedure", lib: "Ordre donné par message, hors procédure, sans pouvoir rappeler son auteur", sous: "On demande de contourner la validation habituelle ou de ne pas rappeler." }
  ];

  /* ---------- ce que le client a fait ---------- */
  var CONTEXTES = {
    aucun: "message authentique", recu: "message reçu, rien de cliqué ni de communiqué", clic: "lien ouvert, rien de saisi", identifiants: "identifiants ou mot de passe saisis",
    carte: "données de carte saisies", code: "code de validation communiqué", virement: "virement effectué", logiciel: "logiciel de prise en main à distance installé"
  };

  /* ---------- les mesures : groupe, libellé, raison d'être (« quand ») ou raison de refus (« pourquoi », mesures à proscrire) ---------- */
  var GROUPES = [["message", "Sur le message"], ["paiement", "Moyens de paiement et comptes"], ["client", "Auprès du client"], ["agence", "Au sein de l'agence"]];
  var ACTIONS = [
    { id: "authentifier", groupe: "message", lib: "Vérifier l'authenticité du message sans cliquer (adresse de l'expéditeur, numéro, existence de l'opération ou du rendez-vous dans les outils de l'agence)", quand: "on ne peut qualifier un message qu'après l'avoir comparé aux coordonnées et aux opérations réelles" },
    { id: "conserver", groupe: "message", lib: "Conserver le message ou noter l'appel (capture d'écran, expéditeur, date, heure, numéro) comme preuve", quand: "sans preuve, la plainte, le signalement et la contestation des opérations sont affaiblis" },
    { id: "ne_pas_cliquer", groupe: "message", lib: "Ne pas cliquer sur le lien et n'ouvrir aucune page à partir du message", quand: "l'adresse réelle d'un lien se lit sans cliquer, et ouvrir la page expose l'appareil" },
    { id: "signaler", groupe: "message", lib: "Signaler le message à la plateforme adaptée (SMS : 33700 ; e-mail : Signal Spam ; site : Phishing Initiative ; ou internet-signalement.gouv.fr)", quand: "les plateformes font fermer les sites et bloquer les expéditeurs" },
    { id: "rep_expediteur", groupe: "message", lib: "Répondre à l'expéditeur pour lui demander des précisions", piege: true,
      pourquoi: "Répondre indique à l'escroc que l'adresse est active et lui donne la main sur la suite. On vérifie auprès de l'organisme par un canal officiel, pas en répondant au message (règle de l'exercice, qui reprend la consigne de joindre l'organisme sans passer par les coordonnées du message)." },
    { id: "rappeler_numero", groupe: "message", lib: "Rappeler le numéro indiqué dans le message ou affiché par l'appelant", piege: true,
      pourquoi: "Ce numéro peut mener à l'escroc, ou être celui de l'agence usurpé. On rappelle un numéro officiel (site, application, carte), jamais celui du message (Les clés de la banque ; Cybermalveillance)." },
    { id: "ouvrir_lien", groupe: "message", lib: "Ouvrir le lien depuis un poste de l'agence pour voir de quoi il s'agit", piege: true,
      pourquoi: "Ouvrir le lien expose le poste de l'agence et ne prouve rien : l'adresse se lit en survolant le lien sans cliquer (Cybermalveillance)." },
    { id: "supprimer", groupe: "message", lib: "Supprimer le message sans le conserver ni le signaler", piege: true,
      pourquoi: "Sans le message, il ne reste aucune preuve pour le signalement, la plainte et la contestation des opérations (Les clés de la banque ; Cybermalveillance : conserver les preuves)." },
    { id: "opposition", groupe: "paiement", lib: "Faire opposition à la carte", quand: "des données de carte ont pu être captées : l'opposition est immédiate (Cybermalveillance)", sansObjet: "aucune donnée de carte n'est en jeu dans ce message" },
    { id: "codes", groupe: "paiement", lib: "Faire changer sans délai l'identifiant et le mot de passe de la banque à distance, depuis un appareil sûr", quand: "un mot de passe communiqué se change tout de suite (Cybermalveillance)", sansObjet: "aucun identifiant, mot de passe ni code n'a été communiqué" },
    { id: "annuler", groupe: "paiement", lib: "Bloquer ou annuler les opérations en attente (bénéficiaire ajouté, virements en cours ou programmés)", quand: "un code ou un accès communiqué permet d'ajouter un bénéficiaire ou de lancer des virements", sansObjet: "aucun code ni accès n'a été communiqué : il n'y a rien à bloquer" },
    { id: "rappel", groupe: "paiement", lib: "Demander sans délai le retour des fonds (rappel du virement) à la banque du bénéficiaire", quand: "plus le signalement est rapide, plus le retour des fonds est possible", sansObjet: "aucun virement n'est parti" },
    { id: "verifier", groupe: "paiement", lib: "Examiner avec le client les dernières connexions et opérations du compte", quand: "il faut repérer toute opération ou connexion que le client ne reconnaît pas" },
    { id: "contester", groupe: "paiement", lib: "Faire contester par écrit les opérations non autorisées, en notant la date du signalement", quand: "le signalement doit être fait sans tarder et au plus tard dans les treize mois du débit (article L133-24)", sansObjet: "aucune opération non autorisée n'est à craindre" },
    { id: "canal_officiel", groupe: "client", lib: "Inviter le client à ne passer que par un canal officiel (numéro de l'agence, application, site saisi à la main), jamais par les coordonnées du message", quand: "c'est le réflexe qui protège le client la prochaine fois" },
    { id: "rappel_regles", groupe: "client", lib: "Rappeler ce que la banque ne demande jamais (codes, identifiants, virement vers un compte sécurisé, logiciel à distance)", quand: "le client doit reconnaître seul la prochaine tentative" },
    { id: "desinstaller", groupe: "client", lib: "Faire désinstaller le logiciel de prise en main à distance et contrôler l'appareil avant toute nouvelle connexion", quand: "l'escroc a pu garder la main sur l'appareil", sansObjet: "aucun logiciel n'a été installé" },
    { id: "plainte", groupe: "client", lib: "Conseiller de déposer plainte, en conservant toutes les preuves", quand: "une plainte est demandée pour les fraudes, et la banque peut l'exiger pour tenter de récupérer les fonds" },
    { id: "assistance", groupe: "client", lib: "Indiquer l'aide gratuite d'Info Escroqueries : 0 805 805 817", quand: "le client peut y trouver conseil et accompagnement" },
    { id: "demander_code", groupe: "client", lib: "Demander au client son code ou son mot de passe pour « vérifier »", piege: true,
      pourquoi: "Un conseiller ne demande jamais un mot de passe ni un code reçu par SMS : le demander à un client, c'est lui apprendre le contraire de ce qu'on lui recommande." },
    { id: "promettre", groupe: "client", lib: "Assurer au client qu'il sera remboursé, avant tout examen du dossier", piege: true,
      pourquoi: "Le remboursement d'une opération non autorisée suit les règles du Code monétaire et financier et dépend de l'examen du dossier (négligence grave, article L133-19 ; preuve, article L133-23) : un conseiller ne le promet ni ne le refuse avant cet examen (convention de l'exercice)." },
    { id: "alerte", groupe: "agence", lib: "Alerter la directrice, qui fait suivre au service sécurité de la banque (procédure interne de cybersécurité)", quand: "le protocole de l'établissement veut que toute fraude constatée ou tout ordre suspect remonte immédiatement" },
    { id: "contre_appel", groupe: "agence", lib: "Vérifier la demande auprès de son auteur supposé par un contre-appel à un numéro connu (dossier, annuaire interne), jamais celui du message", quand: "c'est la seule façon de savoir si la demande vient bien de son auteur apparent", sansObjet: "aucun ordre n'est à vérifier" },
    { id: "ne_pas_executer", groupe: "agence", lib: "Ne rien exécuter tant que la demande n'est pas confirmée", quand: "un ordre non vérifié ne s'exécute pas : une fois parti, le retour des fonds n'est pas garanti", sansObjet: "aucun ordre n'est à exécuter" },
    { id: "executer", groupe: "agence", lib: "Exécuter l'ordre en urgence et vérifier ensuite", piege: true,
      pourquoi: "Un ordre non vérifié ne s'exécute pas : une fois le virement parti, le retour des fonds n'est pas garanti. Tant que la demande n'est pas confirmée, on la suspend (Cybermalveillance)." },
    { id: "aucune", groupe: "agence", lib: "Aucune mesure (le message est authentique)", quand: "un message authentique n'appelle aucune mesure de sécurité" }
  ];

  /* Mesures indispensables (« urgentes » : l'enregistrement est refusé sans elles), à envisager (« recommandees » : point d'attention), utiles (sans reproche) – selon ce que le client a fait.
     Toute autre mesure, hors mesures à proscrire, est signalée comme sans objet. */
  var ATTENDU = {
    aucun: { urgentes: [], recommandees: ["authentifier"], utiles: ["canal_officiel", "rappel_regles", "aucune"] },
    recu: { urgentes: [], recommandees: ["authentifier", "conserver", "signaler", "canal_officiel"], utiles: ["rappel_regles", "ne_pas_cliquer", "alerte", "plainte", "assistance", "verifier"] },
    clic: { urgentes: [], recommandees: ["authentifier", "conserver", "signaler", "canal_officiel", "verifier"], utiles: ["rappel_regles", "ne_pas_cliquer", "codes", "alerte", "plainte", "assistance"] },
    identifiants: { urgentes: ["codes"], recommandees: ["verifier", "conserver", "signaler", "alerte"], utiles: ["authentifier", "canal_officiel", "rappel_regles", "annuler", "contester", "plainte", "assistance", "ne_pas_cliquer"] },
    carte: { urgentes: ["opposition"], recommandees: ["verifier", "conserver", "signaler", "alerte"], utiles: ["authentifier", "canal_officiel", "rappel_regles", "contester", "plainte", "assistance", "codes", "ne_pas_cliquer"] },
    code: { urgentes: ["annuler", "codes"], recommandees: ["verifier", "contester", "conserver", "signaler", "alerte"], utiles: ["authentifier", "canal_officiel", "rappel_regles", "opposition", "plainte", "assistance"] },
    virement: { urgentes: ["rappel"], recommandees: ["verifier", "contester", "conserver", "signaler", "plainte", "alerte"], utiles: ["authentifier", "canal_officiel", "rappel_regles", "annuler", "codes", "assistance"] },
    logiciel: { urgentes: ["desinstaller", "codes"], recommandees: ["verifier", "conserver", "signaler", "plainte", "alerte"], utiles: ["authentifier", "canal_officiel", "rappel_regles", "annuler", "opposition", "contester", "assistance"] }
  };
  var FAUX_ORDRE = { urgentes: ["ne_pas_executer", "contre_appel"], recommandees: ["authentifier", "conserver", "alerte"], utiles: ["plainte", "signaler", "canal_officiel", "rappel_regles"] };

  var REGLES = [
    { id: "jamais", titre: "Ce qu'une banque ne demande jamais", texte: "D'après le site Les clés de la banque (page « Fraude au faux conseiller ») : une banque ne demande jamais le code secret de la carte, le cryptogramme ni les identifiants de connexion ; ni un code de validation reçu par SMS, qui sert à valider une opération et non à s'identifier ; ni un virement pour « protéger » l'argent, ni la validation d'un nouveau bénéficiaire ; ni l'installation d'un logiciel de prise en main à distance. L'escroc affiche parfois le numéro de l'agence : un numéro affiché ne prouve rien. Le bon réflexe est de raccrocher, puis de rappeler soi-même le numéro officiel (site, application, carte) ou de passer par la messagerie sécurisée." },
    { id: "hameconnage", titre: "Hameçonnage : les réflexes", texte: "D'après la fiche réflexe « Hameçonnage » de Cybermalveillance.gouv.fr : une organisation sérieuse ne demande jamais de données bancaires ni de mot de passe par message ou par téléphone ; l'adresse d'un lien se lit en le survolant, sans cliquer, et un seul caractère peut être modifié. Si l'on n'a rien fait : signaler le message (Signal Spam pour un e-mail, Phishing Initiative pour l'adresse d'un site) et le conserver. Si l'on a cliqué : ne rien fournir, fermer la page, joindre l'organisme sans passer par les coordonnées du message. Si l'on a communiqué un mot de passe : le changer immédiatement, ainsi que partout où il sert. Si l'on a communiqué ses moyens de paiement : faire opposition immédiatement. Selon le préjudice, porter plainte en joignant les preuves." },
    { id: "faux_ordre", titre: "Faux ordre de virement", texte: "D'après la fiche réflexe « Faux ordres de virement » de Cybermalveillance.gouv.fr : la fraude consiste à pousser la victime à faire un virement non prévu en usurpant un dirigeant, un fournisseur ou un salarié ; les signes sont une demande « urgente et confidentielle », un nouvel IBAN, un virement imprévu, des pressions. La prévention repose sur une procédure de vérification et de validation hiérarchique, sans exception, pour les virements imprévus et les changements de coordonnées. Si le virement n'est pas exécuté, on suspend la demande ; s'il l'est, on alerte la banque au plus vite pour demander le retour des fonds, on informe la hiérarchie, on conserve les preuves et on porte plainte sans tarder. Le rappel de l'auteur supposé à des coordonnées issues d'une source fiable, jamais celles du message, est la consigne de la direction générale des collectivités locales : la fiche de Cybermalveillance ne parle pas de contre-appel." },
    { id: "paiement", titre: "Opération non autorisée : preuve, remboursement, délai", texte: "Code monétaire et financier : le client signale sans tarder une opération non autorisée, et au plus tard dans les treize mois suivant le débit, sous peine de forclusion (article L133-24). Il appartient à la banque de prouver que l'opération a été authentifiée et enregistrée ; l'utilisation de l'instrument de paiement ne suffit pas nécessairement à prouver que le client l'a autorisée ou qu'il a commis une négligence grave (article L133-23). Le client supporte les pertes s'il a agi frauduleusement ou n'a pas respecté ses obligations intentionnellement ou par négligence grave (article L133-19, IV). Le principe est le remboursement de l'opération non autorisée (article L133-18) ; la version de ce texte en vigueur depuis 2022 n'a pas pu être relue : aucun délai n'est donc donné ici. Le conseiller n'apprécie pas la négligence grave et ne promet pas de remboursement : le dossier est examiné." },
    { id: "signaler", titre: "Où signaler et qui contacter", texte: "SMS frauduleux : les transférer au 33700. E-mail d'hameçonnage : Signal Spam. Adresse d'un site d'hameçonnage : Phishing Initiative. Tout contenu ou escroquerie en ligne : internet-signalement.gouv.fr. Conseil gratuit : Info Escroqueries, 0 805 805 817 ; aide aux victimes : France Victimes, 116 006. Plainte : commissariat, gendarmerie, procureur de la République ; plateforme Perceval pour une fraude à la carte bancaire. Remboursement : demande écrite à la banque, puis médiateur bancaire en cas de refus (Les clés de la banque ; Cybermalveillance)." },
    { id: "conv", titre: "Conventions de GS (aucune règle officielle)", texte: "Réponse au client de 40 à 180 mots et 1 500 signes au plus ; note à la directrice de 20 à 120 mots ; aucun lien dans une réponse, un message de la banque qui contient un lien étant précisément ce qu'imitent les fraudeurs ; aucune promesse ni refus de remboursement avant examen ; aucune appréciation de la négligence du client ; ni IBAN ni numéro de carte, seul le numéro de l'agence est cité ; la directrice est alertée dès qu'une opération est partie, qu'un ordre suspect est reçu ou que des moyens d'accès sont compromis." }
  ];

  function lib(liste, id) { var x = liste.filter(function (y) { return y.id === id; })[0]; return x ? x.lib : id; }
  function action(id) { return ACTIONS.filter(function (x) { return x.id === id; })[0] || null; }
  function typeLib(id) { return lib(TYPES, id); }
  function indiceLib(id) { return lib(INDICES, id); }

  /* ---------- ce qu'il faut faire, selon le type réel du message et ce que le client a fait ---------- */
  function attendu(m) {
    var a, r;
    if (m.type === "faux_ordre") a = FAUX_ORDRE;
    else a = ATTENDU[m.contexte] || ATTENDU.recu;
    r = { urgentes: a.urgentes.slice(), recommandees: a.recommandees.slice(), utiles: a.utiles.slice() };
    if (m.type === "faux_conseiller") { r.recommandees.push("rappel_regles"); r.utiles = r.utiles.filter(function (x) { return x !== "rappel_regles"; }); }
    if (m.lien && r.recommandees.indexOf("ne_pas_cliquer") < 0) { r.recommandees.push("ne_pas_cliquer"); r.utiles = r.utiles.filter(function (x) { return x !== "ne_pas_cliquer"; }); }
    return r;
  }

  /* ---------- texte : normalisation et contrôles ---------- */
  function norm(s) { return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[‘’ʼ]/g, "'").toLowerCase().replace(/[\s ]+/g, " ").trim(); }
  function mots(s) { var t = String(s == null ? "" : s).trim(); return t ? t.split(/\s+/).length : 0; }
  var TELCOMPACT = String(TEL).replace(/\D/g, ""), INFO_ESCROQUERIES = "0805805817";
  var SALUT = /^(bonjour|bonsoir|madame|monsieur|merci)\b/;
  var SIGNATURE = /(cordialement|bonne journee|bonne soiree|bien a vous|l'equipe de l'agence|agence de paris)/;
  var TUTOIEMENT = /\b(tu|toi|ton|ta|tes)\b/;
  var SIGLES = /\b(SMS|IBAN|CVV|RIB|ACPR|CMF|URL|SEPA|FR)\b/g;
  function crie(t) { return /!{2,}/.test(t) || (t.replace(SIGLES, " ").match(/\b[A-ZÀ-Ý]{3,}\b/g) || []).length >= 3; }
  var PREVENTION = /(\bne (cliquez|communiquez|donnez|repondez|validez|rappelez|transmettez|saisissez|devez)|\bjamais\b)/;
  var SIGNALER = /(33700|signal spam|phishing initiative|signaler|signalement|plateforme)/;
  var EMPATHIE = /(comprenons|desole|rassur|regrett|navre|pas de panique|ne vous inquietez)/;
  var CONTACT = /(application|espace client|numero (officiel|de l'agence)|nous (contacter|joindre|appeler|ecrire)|contactez-nous|appelez-nous|venir nous voir|l'agence au|\\b(appelez|joignez|contactez)\\b)/;
  var MESURE = {
    carte: /(opposition|bloqu\w* (votre |la )?carte)/,
    identifiants: /((mot de passe|identifiant)\b[^.!?]{0,70}(chang|modifi|renouvel|reinitialis)|(chang|modifi|renouvel|reinitialis)\w*[^.!?]{0,70}(mot de passe|identifiant))/,
    code: /(annul|bloqu|suspend|contest|opposition)/,
    virement: /(rappel|retour des fonds|recuper|bloqu|contest|banque du beneficiaire)/,
    logiciel: /(desinstall|supprim|retir|ordinateur|appareil)/
  };
  /* Demande adressée au client : verbe à l'impératif ou à l'infinitif (« communiquez », « merci de nous communiquer »), non au participe passé, pour qu'un récit (« la page où vous avez saisi vos identifiants ») ne soit pas pris pour une demande. */
  var DEMANDE = /\b(communiquez|donnez|envoyez|transmettez|indiquez|confirmez|fournissez|saisissez|renseignez|dictez|lisez|communiquer|donner|envoyer|transmettre|indiquer|confirmer|fournir|saisir|renseigner|dicter|lire)\b[^.!?]{0,60}\b(code|mot de passe|identifiant|cryptogramme|numero de (votre )?carte|iban|date d'expiration)/;
  var PROMESSE = /(vous serez (integralement |entierement |totalement )?rembours|vous sera (integralement |entierement )?rembours|nous (vous )?rembourserons|remboursement (est |sera )?(garanti|assure|certain|automatique))/;
  var REFUS = /(vous ne serez pas (integralement )?rembours|nous ne vous rembourserons pas|pas de remboursement possible|vous ne serez pas indemnis)/;
  var ACCUSATION = /(votre faute|par votre faute|vous etes (responsable|fautif|en tort)|vous avez commis|negligence|vous auriez du|imprudence|vous avez ete (imprudent|negligent))/;
  var EXECUTION = /(nous (allons |avons |venons d')?(execut|effectu|realis)\w* (le |la |l'|votre |cet? |cette )?(virement|ordre|operation))/;
  /* Une phrase qui nie (« ne communiquez jamais »), ou qui met en garde contre une demande hypothétique (« si l'on vous demande de lire un code »), n'est pas une demande. */
  var NEGATION = /(\bn'|\bne\b|\bjamais\b|\bsurtout pas\b|\baucun|\bsans\b|\bquiconque\b|\bsi (on|l'on|quelqu'un|un inconnu|une personne|un appelant|l'appelant|l'interlocuteur|un interlocuteur)\b)/;
  var URL = /(https?:\/\/|\bwww\.|\b[a-z0-9-]+(\.[a-z0-9-]+)*\.(fr|com|net|org|eu|info|io|xyz|example|gouv)\b)/i;
  /* Adresse repérée, en entier (et non le seul « https:// »), sans la ponctuation qui la suit dans la phrase. */
  var URL_ENTIERE = /(https?:\/\/|\bwww\.|\b[a-z0-9-]+(\.[a-z0-9-]+)*\.(fr|com|net|org|eu|info|io|xyz|example|gouv)\b)\S*/i;
  function premierLien(t) { var m = URL_ENTIERE.exec(t); return m ? (m[0].replace(/[.,;:!?)\]»"']+$/, "") || m[0]) : ""; }
  var MAIL = /[a-z0-9._%+-]+@([a-z0-9.-]+\.[a-z]{2,})/g;

  function normIdx(s) {
    var str = String(s == null ? "" : s), out = "", idx = [], i, k, d, sp = true;
    for (i = 0; i < str.length; i++) {
      d = str.charAt(i).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[‘’ʼ]/g, "'").toLowerCase();
      if (/^[\s ]+$/.test(d)) { if (!sp) { out += " "; idx.push(i); sp = true; } continue; }
      for (k = 0; k < d.length; k++) { out += d.charAt(k); idx.push(i); }
      if (d.length) sp = false;
    }
    if (out.charAt(out.length - 1) === " ") { out = out.slice(0, -1); idx.pop(); }
    return { n: out, idx: idx, t: str };
  }
  /* Texte repéré tel que l'élève l'a écrit (accents et majuscules compris), à partir de sa place dans la version normalisée. Un radical est repris en mot entier. */
  function original(N, i0, i1) {
    var a0 = N.idx[i0], a1 = N.idx[i1 - 1] + 1, L = /[\p{L}\p{N}]/u;
    while (a1 < N.t.length && L.test(N.t.charAt(a1)) && L.test(N.t.charAt(a1 - 1))) a1++;
    return N.t.slice(a0, a1);
  }
  /* Première correspondance de rx dans une phrase qui ne nie pas et ne met pas en garde (voir NEGATION) : une phrase est une suite de mots entre deux signes de ponctuation forte ou deux
     conjonctions (« mais », « puis », « et »). Renvoie le texte de l'élève, ou null. Sans « nier » (nier = false), la négation n'est pas examinée. */
  function trouve(rx, N, nier) {
    var n = N.n, coupe = /[.!?\n;]+|\b(?:mais|puis|et)\b/g, d = 0, m, fin, cl, r;
    do {
      m = coupe.exec(n); fin = m ? m.index : n.length; cl = n.slice(d, fin); r = rx.exec(cl);
      if (r && !(nier !== false && NEGATION.test(cl))) return original(N, d + r.index, d + r.index + r[0].length);
      if (m) { d = m.index + m[0].length; if (m[0].length === 0) coupe.lastIndex++; }
    } while (m);
    return null;
  }

  /* Contrôle d'un message à envoyer. ctx : { type (verdict de l'élève), contexte, destinataire : « client » ou « direction » }.
     Les points « bloquants » empêchent l'enregistrement ; les « avertissements » le permettent mais sont signalés. */
  function controler(texte, ctx) {
    ctx = ctx || {};
    var t = String(texte == null ? "" : texte), N = normIdx(t), n = N.n, blo = [], av = [], nb = mots(t), dest = ctx.destinataire === "direction" ? "direction" : "client", cv = CONV[dest], ver = ctx.type || "", cx = ctx.contexte || "";
    function B1(code, titre, detail, ex) { blo.push({ code: code, titre: titre, detail: detail, extrait: ex || "" }); }
    function A1(code, titre, detail) { av.push({ code: code, titre: titre, detail: detail }); }
    if (!t.trim()) { B1("vide", dest === "client" ? "Message vide" : "Note vide", dest === "client" ? "Rédigez la réponse qui sera envoyée au client." : "Rédigez la note destinée à la directrice."); return { ok: false, bloquants: blo, avertissements: av, mots: 0, signes: 0 }; }
    if (t.length > cv.signesMax) B1("longueur_max", "Message trop long", "Il compte " + t.length + " signes ; la limite fixée par GS est de " + cv.signesMax + ".");
    var sansMail = t.replace(MAIL, " "), liens = dest === "client" ? (URL.test(sansMail) ? [premierLien(sansMail)] : []) : (/(https?:\/\/|\bwww\.)\S+/i.test(sansMail) ? [sansMail.match(/(https?:\/\/|\bwww\.)\S+/i)[0]] : []);
    if (liens.length) B1("lien", "Un lien ou une adresse de site figure dans le message", "Aucun lien dans un message de la banque : un lien est précisément ce qu'imitent les fraudeurs. Nommez la plateforme ou le service sans donner d'adresse. Repéré : « " + liens[0] + " ».", liens[0]);
    if (dest === "client") {
      var comp = n.replace(/(\d)[\s.\-](?=\d)/g, "$1"), chiffres = (comp.match(/\d{10,}/g) || []).filter(function (x) { return x !== TELCOMPACT && x !== INFO_ESCROQUERIES; }), mails = [], mm;
      MAIL.lastIndex = 0; while ((mm = MAIL.exec(n))) { if (mm[1] !== DOMAINE) mails.push(mm[0]); }
      if (/\bfr\d{2}/.test(comp) || chiffres.length || mails.length) B1("donnees", "Un IBAN, un numéro de carte, de téléphone ou une adresse personnelle figure dans le message", "Ne reprenez jamais l'IBAN du fraudeur, ni un numéro de carte ou de compte : ils restent dans le dossier. Seul le numéro de l'agence (" + TEL + ") peut être cité.", chiffres[0] || mails[0] || "IBAN");
      var d = trouve(DEMANDE, N);
      if (d) B1("demande", "Le message demande un code, un mot de passe ou une donnée bancaire", "Une banque ne demande jamais ces éléments par message : demander au client de les communiquer, c'est lui apprendre le contraire de ce qu'on lui recommande. Repéré : « " + d + " ».", d);
      var pr = trouve(PROMESSE, N) || trouve(REFUS, N, false);
      if (pr) B1("promesse", "Un remboursement est promis ou refusé avant examen", "Le remboursement d'une opération non autorisée dépend de l'examen du dossier (négligence grave, article L133-19 ; preuve, article L133-23) : on ne le promet ni ne le refuse dans un message. Dites que le dossier sera examiné. Repéré : « " + pr + " ».", pr);
      var ac = trouve(ACCUSATION, N);
      if (ac) B1("accusation", "Le message apprécie la responsabilité du client", "Le conseiller n'apprécie pas la négligence grave du client dans un message : le dossier est examiné. Écrivez que le client n'a pas à se reprocher d'avoir été trompé, sans qualifier son comportement. Repéré : « " + ac + " ».", ac);
    }
    var ex = trouve(EXECUTION, N);
    if (ex) B1("execution", "Le message annonce l'exécution d'un ordre suspect", "Un ordre non confirmé ne s'exécute pas : n'écrivez pas que le virement est fait ou va l'être. Repéré : « " + ex + " ».", ex);
    /* avertissements */
    if (nb < cv.motsMin) A1("longueur", "Message très court", "Il compte " + nb + " mots ; la convention de GS est de " + cv.motsMin + " à " + cv.motsMax + " mots.");
    else if (nb > cv.motsMax) A1("longueur", "Message long", "Il compte " + nb + " mots ; la convention de GS est de " + cv.motsMin + " à " + cv.motsMax + " mots.");
    if (!SALUT.test(n)) A1("salutation", "Pas de salutation", dest === "client" ? "Commencez par « Bonjour » suivi de la civilité et du nom du client." : "Commencez par « Bonjour Madame la directrice ».");
    if (!SIGNATURE.test(n.slice(-100))) A1("signature", "Pas de formule de fin ni de signature", "Terminez par « Cordialement » suivi de votre nom et de votre fonction.");
    if (TUTOIEMENT.test(n) || crie(t)) A1("ton", "Ton à revoir", "Pas de tutoiement, de majuscules criées ni de points d'exclamation répétés : le ton reste posé et professionnel.");
    if (dest === "client") {
      if (!(comp.indexOf(TELCOMPACT) >= 0 || CONTACT.test(n))) A1("contact", "Aucun canal officiel proposé", "Indiquez le numéro de l'agence (" + TEL + ") ou l'application de la banque : le client doit savoir par où passer.");
      if (ver && ver !== "authentique" && !PREVENTION.test(n)) A1("prevention", "Pas de conseil de prévention", "Rappelez ce qu'il ne faut jamais faire : cliquer sur le lien, communiquer un code ou un mot de passe, valider une opération qu'on n'a pas lancée, virer vers un compte « sécurisé ».");
      if ((ver === "hameconnage" || ver === "faux_conseiller") && cx !== "aucun" && !SIGNALER.test(n)) A1("signalement", "Le signalement du message n'est pas évoqué", "Dites que le message est signalé ou invitez le client à le signaler (33700 pour un SMS, Signal Spam pour un e-mail), sans donner d'adresse.");
      if (MESURE[cx] && !MESURE[cx].test(n)) A1("mesure", "La mesure à prendre n'est pas expliquée", "Le client a besoin de savoir ce qui est fait ou ce qu'il doit faire, par exemple : " + ({ carte: "l'opposition à la carte.", identifiants: "le changement de l'identifiant et du mot de passe.", code: "le blocage des opérations et l'annulation du bénéficiaire.", virement: "la demande de retour des fonds.", logiciel: "la désinstallation du logiciel et le contrôle de l'ordinateur." }[cx] || "la suite donnée."));
      if (cx && cx !== "aucun" && cx !== "recu" && !EMPATHIE.test(n)) A1("empathie", "Pas de mot pour rassurer le client", "Un client trompé est souvent inquiet ou honteux : un mot pour le rassurer (« vous n'êtes pas seul », « nous sommes là ») fait partie du service.");
    } else {
      if (!/(\d ?h|\bheure|\bce matin|\bcet apres-midi|\bhier|\bdate|\bjour)/.test(n) || !/(adresse|expediteur|domaine|de la part|provenant|message de|mail)/.test(n)) A1("faits", "Les faits ne sont pas précisés", "Indiquez à quelle heure le message est arrivé et l'adresse d'où il vient.");
      if (!/(pas (ete )?(execut|effectu|saisi)|n'a pas ete|aucun virement|rien (n'a|a) ete|non execut|suspendu)/.test(n)) A1("statut", "Le sort de l'ordre n'est pas précisé", "Dites clairement que le virement n'a pas été exécuté (ou, s'il l'a été, dans quelles conditions).");
      if (!/(contre-appel|rappel|joindre|joint|confirm|verifi)/.test(n)) A1("verification", "La vérification n'est pas évoquée", "Dites comment la demande sera vérifiée : contre-appel à un numéro connu, jamais en répondant au message.");
    }
    return { ok: blo.length === 0, bloquants: blo, avertissements: av, mots: nb, signes: t.length };
  }

  /* ---------- liste, urgence, bilan ---------- */
  function trouver(id) { return MESSAGES.filter(function (m) { return m.id === id; })[0] || null; }
  function traitement(st, id) { return st && st.messagesSuspects && st.messagesSuspects[id] ? st.messagesSuspects[id] : null; }
  function liste() { return MESSAGES.slice().sort(function (a, b) { return (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0) || a.jours - b.jours || (a.id < b.id ? -1 : 1); }); }
  function dateMessage(m, auj) { return B.ymd(B.plusJours(auj || B.aujourdhui(), -m.jours)); }
  /* Écarts entre le traitement de l'élève et la vérité du message : type, indices manquants, indices en trop. */
  function ecarts(m, s) {
    var ind = Array.isArray(s.indices) ? s.indices : [], manquants = m.indices.filter(function (x) { return ind.indexOf(x) < 0; }), enTrop = ind.filter(function (x) { return m.indices.indexOf(x) < 0; });
    var tOk = s.type === m.type;
    return { type: { retenu: s.type, attendu: m.type, ok: tOk }, manquants: manquants, enTrop: enTrop, n: (tOk ? 0 : 1) + manquants.length + enTrop.length };
  }
  function bilan(st) {
    var tr = MESSAGES.filter(function (m) { return traitement(st, m.id); });
    return { total: MESSAGES.length, traites: tr.length, atraiter: MESSAGES.length - tr.length, urgents: MESSAGES.filter(function (m) { return m.urgent && !traitement(st, m.id); }).length,
      frauduleux: tr.filter(function (m) { return traitement(st, m.id).type !== "authentique"; }).length, conformes: tr.filter(function (m) { return ecarts(m, traitement(st, m.id)).n === 0; }).length };
  }

  /* ---------- points d'attention : mesures à envisager ou sans objet (jamais bloquants) ---------- */
  function coherence(m, s) {
    var p = [], a = attendu(m), ch = Array.isArray(s.actions) ? s.actions : [], u = a.urgentes.concat(a.recommandees, a.utiles);
    if (m.type === "authentique") {
      var dispro = ch.filter(function (x) { var ac = action(x); return ac && !ac.piege && u.indexOf(x) < 0; });
      if (dispro.length) p.push("Le message est authentique : ces mesures sont disproportionnées et inquiètent le client pour rien : " + dispro.map(function (x) { return "« " + action(x).lib + " »"; }).join(" ; ") + ".");
    } else {
      a.recommandees.forEach(function (x) { var ac = action(x); if (ch.indexOf(x) < 0 && ac) p.push("Mesure à envisager : « " + ac.lib + " » – " + ac.quand + "."); });
      ch.forEach(function (x) { var ac = action(x); if (ac && !ac.piege && u.indexOf(x) < 0 && x !== "aucune") p.push("« " + ac.lib + " » ne se justifie pas ici : " + (ac.sansObjet || "cette mesure n'a pas d'objet dans cette situation") + "."); });
    }
    return p;
  }

  /* ---------- enregistrement du traitement ---------- */
  function E(champ, msg) { return { champ: champ, msg: msg }; }
  function ko(erreurs) { return { ok: false, erreurs: erreurs }; }
  function valider(st, id, s) {
    s = s || {};
    var m = trouver(id), er = [], indices = Array.isArray(s.indices) ? s.indices.filter(function (x, i, l) { return l.indexOf(x) === i; }) : [], actions = Array.isArray(s.actions) ? s.actions.filter(function (x, i, l) { return l.indexOf(x) === i; }) : [];
    var rep = String(s.reponse == null ? "" : s.reponse).trim(), note = String(s.note == null ? "" : s.note).trim();
    if (!m) return ko([E("message", "Message introuvable.")]);
    if (traitement(st, id)) return ko([E("message", "Ce message est déjà traité : remettez-le à traiter pour le reprendre.")]);
    var typ = TYPES.filter(function (x) { return x.id === s.type; })[0];
    if (!typ) er.push(E("type", "Choisissez le type du message."));
    if (indices.some(function (x) { return !INDICES.some(function (y) { return y.id === x; }); })) er.push(E("indices", "Indice inconnu."));
    else if (typ && typ.id === "authentique" && indices.length) er.push(E("indices", "Vous avez relevé des indices de fraude : le message ne peut pas être classé comme authentique. Décochez-les, ou revoyez le type du message."));
    else if (typ && typ.id !== "authentique" && !indices.length) er.push(E("indices", "Relevez au moins un indice qui justifie de classer le message comme frauduleux."));
    if (!actions.length) er.push(E("actions", "Choisissez au moins une mesure, ou « Aucune mesure »."));
    else if (actions.some(function (x) { return !action(x); })) er.push(E("actions", "Mesure inconnue."));
    else {
      if (actions.indexOf("aucune") >= 0 && actions.length > 1) er.push(E("actions", "« Aucune mesure » ne se combine pas avec une autre mesure."));
      if (actions.indexOf("aucune") >= 0 && actions.length === 1 && typ && typ.id !== "authentique") er.push(E("actions", "Un message classé comme frauduleux appelle des mesures : « Aucune mesure » ne convient qu'à un message authentique."));
      actions.forEach(function (x) { var ac = action(x); if (ac.piege) er.push(E("actions", "« " + ac.lib + " » est à proscrire. " + ac.pourquoi)); });
      attendu(m).urgentes.forEach(function (x) { if (actions.indexOf(x) < 0) er.push(E("actions", "Situation : " + CONTEXTES[m.contexte] + ". La mesure suivante est indispensable avant d'enregistrer : « " + action(x).lib + " ».")); });
    }
    if (note.length > CONV.noteMax) er.push(E("note", "La note interne est limitée à " + CONV.noteMax + " signes."));
    var controle = controler(rep, { type: typ && typ.id, contexte: m.contexte, destinataire: m.destinataire });
    if (!controle.ok) er.push(E("reponse", "Le message ne peut pas être enregistré : " + controle.bloquants.map(function (x) { return x.titre.toLowerCase(); }).join(" ; ") + "."));
    if (er.length) return { ok: false, erreurs: er, controle: controle };
    var now = B.maintenant();
    if (!st.messagesSuspects || typeof st.messagesSuspects !== "object" || Array.isArray(st.messagesSuspects)) st.messagesSuspects = {};
    var t = { type: typ.id, indices: indices, actions: actions, reponse: rep, note: note, date: B.ymd(B.aujourdhui()), heure: B.hhmm(now), par: (st.eleve && st.eleve.nom) || "",
      avertissements: controle.avertissements.map(function (x) { return x.code; }), points: coherence(m, { type: typ.id, actions: actions }) };
    st.messagesSuspects[id] = t;
    return { ok: true, traitement: t, controle: controle, points: t.points, ecarts: ecarts(m, t) };
  }
  function remettre(st, id) {
    if (!trouver(id)) return { ok: false, erreur: "Message introuvable." };
    if (!traitement(st, id)) return { ok: false, erreur: "Ce message n'est pas traité." };
    delete st.messagesSuspects[id]; return { ok: true };
  }

  var api = {
    MESSAGES: MESSAGES, CANAUX: CANAUX, CONV: CONV, TYPES: TYPES, INDICES: INDICES, CONTEXTES: CONTEXTES, GROUPES: GROUPES, ACTIONS: ACTIONS, ATTENDU: ATTENDU, FAUX_ORDRE: FAUX_ORDRE, REGLES: REGLES, TEL: TEL,
    norm: norm, mots: mots, action: action, typeLib: typeLib, indiceLib: indiceLib, attendu: attendu, controler: controler, trouver: trouver, traitement: traitement, liste: liste, dateMessage: dateMessage,
    ecarts: ecarts, bilan: bilan, coherence: coherence, valider: valider, remettre: remettre
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.messagesSuspects = api; }
})(typeof window !== "undefined" ? window : null);
