/* GS Banque & Assurance – messages suspects reçus à l'agence de Paris, ou transmis par des clients (« Messages suspects »).
   Les 12 messages sont INVENTÉS, comme leurs expéditeurs : aucun nom d'entreprise réel n'est imité (« TransColis Nord » et « Mutuelle Cerisaie Santé » n'existent pas), les adresses
   utilisent le suffixe « .example » réservé aux exemples (RFC 2606), les numéros de téléphone sont dans les tranches 01 99 00 et 06 39 98 réservées à la fiction, et les IBAN cités sont
   fictifs. Les clients concernés sont des dossiers du site (identifiant « client »). « jours » = nombre de jours écoulés depuis la réception : les dates se calculent à partir d'aujourd'hui.
   Chaque message porte sa vérité (type, indices présents, situation du client) : c'est ce que l'outil compare au traitement de l'élève, jamais le contraire.
   Les contextes possibles sont : aucun (message authentique), recu (rien n'a été fait), clic (le client a ouvert le lien sans rien saisir), identifiants (identifiant et mot de passe de la banque
   à distance saisis), carte (données de carte saisies), code (un code de validation a été communiqué), virement (un virement a été fait), logiciel (un logiciel de prise en main à distance a
   été installé). */
(function (root) {
  "use strict";

  var MESSAGES = [
    { id: "MS-01", canal: "email", jours: 1, client: 5, via: "client", de: "GS Banque & Assurance", adresse: "securite@gs-banque-assurance-clients.example",
      objet: "Action requise : votre accès sera suspendu sous 24 heures",
      texte: "Cher client,\n\nNotre système a détecté une activité inhabituelle sur votre espace client. Pour éviter la suspension définitive de votre accès sous 24 heures, vous devez confirmer vos identifiants dès maintenant en cliquant sur le bouton ci-dessous.\n\n[ Confirmer mes identifiants ]\n\nSans action de votre part, votre compte sera bloqué et des frais de réactivation de 45 € seront appliqués.\n\nService Sécurité – GS Banque & Assurance",
      lien: { affiche: "Confirmer mes identifiants", cible: "https://gs-banque-assurance-verification.example/connexion" },
      contexte: "recu", situation: "Mme Vincent a transféré le message à l'agence et demande s'il faut répondre. Elle n'a pas cliqué sur le bouton.", echeance: "", urgent: false,
      type: "hameconnage", indices: ["urgence", "donnees", "lien", "expediteur"], destinataire: "client",
      explication: "L'adresse d'expéditeur (gs-banque-assurance-clients.example) n'est pas celle du domaine de l'agence (gs-banque-assurance.example) ; le bouton mène à un autre site ; le message réclame des identifiants et menace d'une suspension sous 24 heures. La banque ne demande jamais d'identifiants par message." },
    { id: "MS-02", canal: "sms", jours: 0, client: 7, via: "client", de: "Numéro mobile inconnu", adresse: "06 39 98 41 27", objet: "",
      texte: "GS Banque : un paiement de 489,90 € vient d'être bloqué. Si vous n'en êtes pas l'auteur, annulez-le immédiatement : https://gs-annulation-paiement.example/ref/48217 Sinon votre carte sera désactivée.",
      lien: { affiche: "https://gs-annulation-paiement.example/ref/48217", cible: "https://gs-annulation-paiement.example/ref/48217" },
      contexte: "clic", situation: "M. Ferreira a ouvert le lien : une page au logo de la banque lui demandait le numéro de sa carte. Il l'a fermée sans rien saisir et appelle l'agence pour savoir ce qu'il doit faire.", echeance: "", urgent: false,
      type: "hameconnage", indices: ["urgence", "lien", "numero"], destinataire: "client",
      explication: "Le SMS vient d'un numéro mobile quelconque, contient un lien cliquable vers un site qui n'est pas celui de la banque et menace de désactiver la carte. Heureusement, rien n'a été saisi : il reste à conserver le message, à le signaler et à rassurer le client." },
    { id: "MS-03", canal: "appel", jours: 0, client: 42, via: "client", de: "Se présente comme le « service anti-fraude »", adresse: "01 99 00 80 40", objet: "",
      texte: "— Bonjour madame Olivier, Julien Mercier, service anti-fraude de votre banque. Quelqu'un tente en ce moment un paiement de 1 250 € avec votre carte. Pour l'annuler, je vais vous envoyer un code par SMS : donnez-le-moi dès que vous le recevez.\n— D'accord… il vient d'arriver, c'est le…\n— Parfait. Surtout, ne dites rien à votre conseiller ni à votre famille : le fraudeur est peut-être dans l'agence. Je reste en ligne, ne raccrochez pas.",
      lien: null,
      contexte: "code", situation: "Le numéro affiché sur le téléphone de Mme Olivier était celui de l'agence, mais aucun conseiller ne l'a appelée. Elle a lu le code reçu par SMS. En consultant son compte, vous voyez qu'un nouveau bénéficiaire de virement vient d'être ajouté, sans virement exécuté pour l'instant.", echeance: "", urgent: true,
      type: "faux_conseiller", indices: ["urgence", "code", "secret"], destinataire: "client",
      explication: "Le numéro de l'agence peut être affiché par un escroc : il ne prouve rien. L'appelant presse la cliente, lui demande un code de validation reçu par SMS (le code sert à valider une opération, pas à s'identifier) et réclame le secret, y compris vis-à-vis de l'agence. Le code a validé l'ajout d'un bénéficiaire : il faut bloquer avant tout virement." },
    { id: "MS-04", canal: "appel", jours: 1, client: 3, via: "client", de: "Se présente comme le « service sécurité »", adresse: "Numéro masqué", objet: "",
      texte: "— Bonjour monsieur Martin, ici le service sécurité de GS Banque & Assurance. Des pirates ont accès à votre compte et vont le vider ce soir. Pour protéger vos économies, il faut les virer tout de suite sur un compte sécurisé que je vous communique. Notez l'IBAN : FR76 1234 5000 0100 0123 4567 890.\n— Je dois en parler à ma conseillère, non ?\n— Surtout pas : n'en parlez à personne, même à l'agence, pour ne pas alerter les pirates.",
      lien: null,
      contexte: "virement", situation: "M. Martin a viré 4 800 € vers cet IBAN hier en fin d'après-midi, depuis son application. Ce matin, un doute l'a poussé à venir à l'agence avec ses relevés.", echeance: "", urgent: true,
      type: "faux_conseiller", indices: ["urgence", "virement_secu", "secret", "numero"], destinataire: "client",
      explication: "Une banque ne demande jamais de virer de l'argent vers un « compte sécurisé ». L'appel est masqué, presse le client et exige le secret. Le virement est parti : plus il est signalé tôt, plus le retour des fonds est possible, d'où l'urgence du rappel de fonds." },
    { id: "MS-05", canal: "email", jours: 0, client: 11, via: "agence", de: "Antoine Durand", adresse: "antoine.durand.commerce@messagerie-libre.example",
      objet: "Virement urgent – fournisseur",
      texte: "Bonjour,\n\nJe suis en déplacement et je n'ai pas accès à mon application. Pouvez-vous effectuer aujourd'hui, depuis mon compte, un virement de 12 500 € vers mon nouveau fournisseur ? Voici son IBAN : FR76 4321 5000 0200 0765 4321 098.\n\nMerci de le faire sans passer par l'agence ni me rappeler : c'est confidentiel et il faut que ce soit parti avant 16 h. Je vous confirmerai plus tard.\n\nCordialement,\nAntoine Durand",
      lien: null,
      contexte: "recu", situation: "Le message est arrivé à 10 h 41 sur la messagerie de la conseillère. L'adresse d'expéditeur n'est pas celle enregistrée au dossier du client (antoine.durand@example.com). Aucun virement n'a été saisi.", echeance: "Ordre à exécuter avant 16 h, le jour même", urgent: true,
      type: "faux_ordre", indices: ["urgence", "secret", "nouvel_iban", "hors_procedure", "expediteur"], destinataire: "client",
      explication: "Un client ne donne pas d'ordre de virement par e-mail depuis une adresse différente de celle de son dossier, avec un IBAN nouveau, sans qu'on puisse le rappeler, et dans l'urgence. La demande se vérifie par un contre-appel au numéro enregistré au dossier, jamais à celui du message ; en attendant, rien n'est exécuté. Le vrai client est probablement victime d'un piratage de sa messagerie." },
    { id: "MS-06", canal: "email", jours: 0, client: null, via: "agence", de: "Hélène Delorme (directrice)", adresse: "h.delorme.direction@messagerie-libre.example",
      objet: "Urgent et confidentiel",
      texte: "Bonjour,\n\nJe suis en comité jusqu'à 17 h et injoignable. J'ai besoin d'un virement de 8 900 € vers un prestataire pour un dossier sensible de l'agence. IBAN : FR76 5678 5000 0300 0234 5678 901.\n\nFais-le tout de suite depuis ton poste et ne préviens personne : je te couvre. Je t'expliquerai.\n\nHélène",
      lien: null,
      contexte: "recu", situation: "Le message est arrivé à 14 h 05 sur la messagerie du conseiller. L'adresse d'expéditeur n'appartient pas au domaine de l'agence (gs-banque-assurance.example). Aucun virement n'a été saisi.", echeance: "Virement demandé « tout de suite »", urgent: true,
      type: "faux_ordre", indices: ["urgence", "secret", "nouvel_iban", "hors_procedure", "expediteur"], destinataire: "direction",
      explication: "C'est la fraude « au président » : un faux message de la direction réclame un virement urgent et confidentiel vers un IBAN inconnu, en contournant la procédure de validation hiérarchique. La directrice se joint par un moyen interne connu, jamais en répondant au message ; l'alerte est donnée à la vraie directrice, qui décide des suites." },
    { id: "MS-07", canal: "sms", jours: 2, client: 9, via: "client", de: "Numéro mobile inconnu", adresse: "06 39 98 70 12", objet: "",
      texte: "TransColis Nord : votre colis n° TC48-2291 n'a pas pu être livré. Réglez 1,99 € de frais de redistribution avant demain pour éviter son retour : https://transcolis-redistribution.example/p/TC4822",
      lien: { affiche: "https://transcolis-redistribution.example/p/TC4822", cible: "https://transcolis-redistribution.example/p/TC4822" },
      contexte: "carte", situation: "Mme Laurent a payé les frais sur la page : elle y a saisi le numéro, la date d'expiration et le cryptogramme de sa carte. Elle craint maintenant d'avoir été trompée. Aucune opération suspecte n'apparaît encore sur son compte.", echeance: "", urgent: true,
      type: "hameconnage", indices: ["urgence", "donnees", "lien", "numero"], destinataire: "client",
      explication: "Les frais de livraison de quelques centimes sont un classique : la page sert à voler les données de carte. Le SMS vient d'un numéro mobile, contient un lien cliquable et fixe un délai. Les données de carte ayant été saisies, l'opposition est immédiate, avant toute opération frauduleuse." },
    { id: "MS-08", canal: "email", jours: 1, client: 14, via: "client", de: "Nadia Benali – GS Banque & Assurance", adresse: "nadia.benali@gs-banque-assurance.example",
      objet: "Confirmation de votre rendez-vous de jeudi à 10 h",
      texte: "Bonjour Madame Joly,\n\nVotre rendez-vous avec votre conseillère est confirmé jeudi à 10 h, à l'agence de Paris (27 rue de Châteaudun, 75009 Paris). Merci d'apporter vos trois derniers bulletins de salaire.\n\nPour modifier ou annuler ce rendez-vous, appelez l'agence au 01 99 00 80 40.\n\nCordialement,\nNadia Benali\nConseillère clientèle particuliers",
      lien: null,
      contexte: "aucun", situation: "Mme Joly a pris rendez-vous par téléphone la semaine dernière. Elle voudrait seulement savoir si ce message vient bien de l'agence avant d'apporter ses bulletins de salaire.", echeance: "", urgent: false,
      type: "authentique", indices: [], destinataire: "client",
      explication: "L'adresse est celle du domaine de l'agence, la conseillère existe, le numéro est celui de l'agence, le message ne contient ni lien ni demande de code, d'identifiant ou de virement, et le rendez-vous figure à l'agenda. Aucun indice de fraude : une réponse de confirmation suffit." },
    { id: "MS-09", canal: "sms", jours: 1, client: 15, via: "client", de: "GS BANQUE", adresse: "Nom d'expéditeur : GS BANQUE", objet: "",
      texte: "GS Banque & Assurance : paiement par carte de 23,50 € hier à 8 h 12 chez BOULANGERIE DU MARCHE. Vous ne reconnaissez pas cette opération ? Appelez l'agence au 01 99 00 80 40. Ne communiquez jamais vos codes.",
      lien: null,
      contexte: "aucun", situation: "Mme Lacroix reconnaît cet achat : l'opération figure sur son compte, et l'alerte dans l'historique des notifications de son application. Elle s'étonne seulement de recevoir un SMS et demande s'il est authentique.", echeance: "", urgent: false,
      type: "authentique", indices: [], destinataire: "client",
      explication: "L'alerte correspond à une opération réelle, visible dans l'application, le numéro est celui de l'agence, le message ne contient aucun lien et ne demande rien (au contraire, il rappelle de ne jamais communiquer ses codes). Un nom d'expéditeur affiché dans un SMS ne suffit pas à lui seul à prouver l'origine : c'est la vérification de l'opération par un canal officiel qui lève le doute." },
    { id: "MS-10", canal: "email", jours: 2, client: 10, via: "client", de: "Espace client GS", adresse: "no-reply@gs-banque-assurance.espace-client.example",
      objet: "Mise à jour de votre profil de sécurité",
      texte: "Bonjour Claire Sanchez,\n\nPour répondre à la réglementation, vous devez mettre à jour votre profil de sécurité sous 48 heures. Connectez-vous avec vos identifiants à l'adresse ci-dessous. Passé ce délai, vos virements seront limités.\n\n[ Mettre à jour mon profil ]\n\nL'équipe sécurité",
      lien: { affiche: "Mettre à jour mon profil", cible: "https://gs-banque-assurance.espace-client.example/profil" },
      contexte: "identifiants", situation: "Mme Sanchez a saisi son identifiant et son mot de passe de banque à distance sur la page, puis s'est étonnée de ne recevoir aucune confirmation. Elle appelle l'agence.", echeance: "", urgent: true,
      type: "hameconnage", indices: ["urgence", "donnees", "lien", "expediteur"], destinataire: "client",
      explication: "L'adresse ressemble à celle de la banque, mais « gs-banque-assurance » n'est ici qu'un sous-domaine d'un autre site : le nom du site se lit à la fin de l'adresse, juste avant le suffixe (ici « espace-client.example »), et non au début. Le message réclame des identifiants sous 48 heures. Les identifiants ayant été saisis, ils doivent être changés tout de suite, avant que l'escroc ne s'en serve." },
    { id: "MS-11", canal: "appel", jours: 2, client: 32, via: "client", de: "Se présente comme le « service informatique »", adresse: "06 39 98 62 15", objet: "",
      texte: "— Bonjour, monsieur Fournier, service informatique de GS Banque & Assurance. Votre application présente une faille. Pour la corriger à distance, installez le programme d'assistance dont je vous donne le nom, puis donnez-moi le code qui s'affiche. Ne vous inquiétez pas, je m'occupe de tout : restez simplement devant votre écran.",
      lien: null,
      contexte: "logiciel", situation: "M. Fournier a installé le logiciel sur son ordinateur et donné le code d'accès. L'interlocuteur est resté connecté une vingtaine de minutes ; M. Fournier a ensuite éteint son ordinateur, inquiet. Il l'utilise pour consulter son compte en ligne.", echeance: "", urgent: true,
      type: "faux_conseiller", indices: ["logiciel", "numero"], destinataire: "client",
      explication: "Une banque ne demande jamais d'installer un logiciel de prise en main à distance. L'appel vient d'un numéro mobile quelconque. L'escroc a eu la main sur l'ordinateur pendant vingt minutes : le logiciel doit être désinstallé, l'appareil contrôlé et les accès changés depuis un appareil sûr." },
    { id: "MS-12", canal: "email", jours: 3, client: 12, via: "client", de: "Mutuelle Cerisaie Santé – Remboursements", adresse: "remboursements.sante.2026@messagerie-libre.example",
      objet: "Un remboursement de 214,60 € vous attend",
      texte: "Madame, Monsieur,\n\nUn remboursement de 214,60 € est en attente de versement sur votre compte. Pour le recevoir, complétez le formulaire en ligne (identité, adresse, numéro de carte bancaire) sous 5 jours.\n\n[ Accéder au formulaire ]\n\nService Remboursements",
      lien: { affiche: "Accéder au formulaire", cible: "https://cerisaie-sante-remboursement.example/formulaire" },
      contexte: "recu", situation: "M. Leroy n'a jamais eu de mutuelle de ce nom. Il a reçu le message, n'a rien fait et l'a montré à son conseiller lors de son passage à l'agence.", echeance: "", urgent: false,
      type: "hameconnage", indices: ["donnees", "lien", "expediteur", "urgence"], destinataire: "client",
      explication: "Le message promet un remboursement pour obtenir des données bancaires : la banque, comme toute organisation sérieuse, ne demande jamais de données de carte par un formulaire reçu par message. L'adresse est celle d'une messagerie grand public et le lien mène à un site sans rapport. Ce type de formulaire sert aussi à collecter des informations personnelles pour appeler ensuite la victime en se faisant passer pour son conseiller." }
  ];

  var api = { MESSAGES: MESSAGES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.dataMessages = api; }
})(typeof window !== "undefined" ? window : null);
