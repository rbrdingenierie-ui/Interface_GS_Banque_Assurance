/* GS Banque & Assurance – messagerie : e-mails types adressés aux clients, signature professionnelle, journal des envois.
   Aucun e-mail n'est transmis à l'extérieur : un « envoi » enregistre le message dans le navigateur de l'élève (store().messages) et dans la fiche du client.
   Les coordonnées de la signature sont inventées : domaine « .example », réservé aux exemples (RFC 2606), téléphone dans la tranche 01 99 00 xx xx réservée aux
   œuvres audiovisuelles (hors des numéros des clients), numéro RCS qui ne passe pas la clé de contrôle des numéros SIREN (il ne peut donc pas être celui d'une vraie
   société) ; l'élève peut modifier le texte de chaque e-mail avant l'envoi. */
(function (root) {
  "use strict";

  var B = root && root.SGBF ? root.SGBF.banque : require("./banque.js");
  var PR = root && root.SGBF ? root.SGBF.produits : require("./produits.js");
  var K = root && root.SGBF ? root.SGBF.catalogue : require("./catalogue.js");
  var AG = root && root.SGBF ? root.SGBF.agenda : require("./agenda.js");
  var EQ = root && root.SGBF ? root.SGBF.equipe : require("./equipe.js");
  var CL = root && root.SGBF ? root.SGBF.clients : require("./data_clients.js").clients;
  var ID = root && root.SGBF ? root.SGBF.identite : require("./identite.js");
  var CLIENT = {}; CL.forEach(function (c) { CLIENT[c.id] = c; });

  var MAX_MESSAGES = 300, MAX_MOT = 500, MAX_NOM = ID.MAX_NOM, MAX_PIECES = 8, MAX_PIECE = 100;
  var FONCTION = "Conseiller Clientèle Particuliers", AGENCE = "GS Banque & Assurance – Agence de Paris", TEL = "01 99 00 80 40", DOMAINE = "gs-banque-assurance.example";
  /* Mentions de bas de message d'une banque (confidentialité, sécurité). */
  var MENTIONS = [
    "Ce message est confidentiel et destiné exclusivement à son destinataire. Si vous l'avez reçu par erreur, merci d'en informer l'expéditeur et de le supprimer.",
    "Pour votre sécurité, GS Banque & Assurance ne vous demande jamais vos codes ni vos identifiants par e-mail."
  ];
  /* Rubriques d'une signature d'entreprise ; capital, adresse du siège, numéros RCS et ORIAS sont inventés. */
  var MENTIONS_LEGALES = [
    "Forme et capital : société anonyme au capital de 250 000 000 €",
    "Siège social : 27 rue de Châteaudun, 75009 Paris",
    "RCS Paris 412 308 976 – ORIAS 09 047 361",
    "Autorité de contrôle : ACPR"
  ];
  var PIED_COMMERCIAL = "Vous pouvez à tout moment vous opposer à la réception de nos propositions commerciales par e-mail : répondez à ce message en écrivant « désinscription », votre demande sera prise en compte.";
  /* Mention légale obligatoire dans toute publicité pour un crédit : même texte que celui des fiches de crédit du catalogue. */
  var MENTION_CREDIT = "Un crédit vous engage et doit être remboursé. Vérifiez vos capacités de remboursement avant de vous engager.";
  /* À partir du 20 novembre 2026, la publicité pour un crédit à la consommation porte une nouvelle mention (ordonnance n° 2025-880 du 3 septembre 2025 ; service-public.fr).
     Aucune source consultée n'indique ce changement pour le crédit immobilier : sa mention reste celle de sa fiche du catalogue, à toute date. */
  var MENTION_CREDIT_NOUVELLE = "Attention ! Un crédit coûte de l'argent et doit être remboursé !", CHANGEMENT_MENTION = [2026, 10, 20];
  /* Nature du produit présenté dans l'e-mail « Autre produit » : elle décide de la mention de crédit à ajouter. */
  var NATURES = ["Produit ou service qui n'est pas un crédit", "Crédit à la consommation (prêt personnel, crédit auto, prêt travaux)", "Crédit immobilier"];
  function mentionCreditEmail(nature, date) {
    if (nature === NATURES[1]) {
      var d = date || B.aujourdhui();
      return d >= new Date(CHANGEMENT_MENTION[0], CHANGEMENT_MENTION[1], CHANGEMENT_MENTION[2]) ? MENTION_CREDIT_NOUVELLE : MENTION_CREDIT;
    }
    return nature === NATURES[2] ? MENTION_CREDIT : "";
  }
  var LIMITES = { nomProduit: [3, 80], descr: [10, 600], objet: [3, 100], texte: [10, 1500], objetEdite: [3, 150], corpsEdite: [20, 5000] };

  function err(champ, msg) { return { ok: false, champ: champ, erreur: msg }; }
  /* Retire les caractères de contrôle (sauf retour à la ligne et tabulation) avant tout traitement d'un texte saisi. */
  function propre(s) { return String(s == null ? "" : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ""); }
  /* Texte multi-lignes saisi : retours à la ligne normalisés, espaces compactés, au plus une ligne vide entre deux paragraphes. */
  function nettoyerCorps(v) { return propre(v).replace(/\r\n?/g, "\n").split("\n").map(function (q) { return q.replace(/[ \t]+/g, " ").trim(); }).join("\n").replace(/\n{3,}/g, "\n\n").trim(); }
  function espaces(s) { return propre(s).replace(/\s+/g, " ").trim(); }
  function maj1(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function heureTxt(h) { var m = /^(\d{2}):(\d{2})$/.exec(h || ""); return m ? (+m[1]) + " h" + (m[2] === "00" ? "" : " " + m[2]) : ""; }
  function libJour(d) { return B.JOURS[d.getDay()] + " " + d.getDate() + (d.getDate() === 1 ? "er " : " ") + B.MOIS[d.getMonth()]; }
  function formule(c) { return (c.civ === "Mme" ? "Madame " : "Monsieur ") + c.nom; }
  /* Formule d'appel et formule de politesse d'un e-mail à un client. */
  function appel(c) { return formule(c) + ","; }
  function cloture(c) { return "Je vous prie d'agréer, " + (c.civ === "Mme" ? "Madame" : "Monsieur") + ", l'expression de mes salutations distinguées."; }
  /* Retire d'un texte du catalogue les indications entre parenthèses sur le caractère fictif d'une valeur : le message s'adresse au client. */
  /* Dans un e-mail au client, « taux en vigueur communiqué dans la newsletter » (renvoi interne des fiches produits) devient une phrase adressée au client : le conseiller lui confirme le taux. */
  function auClient(t) { return String(t == null ? "" : t).replace(/(t)aux en vigueur communiqué dans la newsletter/gi, function (m) { return (m.charAt(0) === "T" ? "T" : "t") + "aux en vigueur, que je vous confirmerai lors de notre échange"; }); }
  function sansFictif(t) { return String(t == null ? "" : t).replace(/\s*\((?:[^()]*\s)?fictifs?\)/gi, "").replace(/\s+([.,])/g, "$1"); }
  function milliers(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }
  function pluriel(n, s, p) { return n + " " + (n > 1 ? p : s); }

  /* ---------- signature ---------- */
  /* Le nom de l'élève : au moins deux mots (prénom et nom), lettres, espaces, traits d'union et apostrophes. */
  /* Prénom et nom : même règle que le nom inscrit sur les documents (identite.js). */
  function nomValide(v) { return ID.nomValide(v); }
  function ascii(s) { return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9-]/g, ""); }
  /* Adresse de la signature : premier mot . dernier mot, sans accents ni apostrophes, sur le domaine réservé « .example ». */
  function adresse(nom) {
    var t = espaces(nom).split(" "), p = ascii(t[0] || ""), n = ascii(t[t.length - 1] || "");
    return p && n && t.length >= 2 ? p + "." + n + "@" + DOMAINE : null;
  }
  function nomEleve(st) { return st && st.eleve && typeof st.eleve.nom === "string" ? st.eleve.nom : ""; }
  function signature(st) {
    var v = nomValide(nomEleve(st));
    if (!v.ok) return { ok: false, erreur: "Renseignez d'abord votre prénom et votre nom : ils figurent dans la signature des e-mails." };
    var corps = [v.nom, FONCTION, AGENCE, "Tél. : " + TEL, adresse(v.nom)];
    return { ok: true, nom: v.nom, corps: corps, mentions: MENTIONS.slice(), legales: MENTIONS_LEGALES.slice(), texte: corps.join("\n") + "\n\n" + MENTIONS.join("\n") + "\n" + MENTIONS_LEGALES.join("\n") };
  }
  /* Enregistre le nom (et la classe, facultative) de l'élève dans la sauvegarde partagée. */
  function definirIdentite(st, nom, classe) {
    var v = nomValide(nom);
    if (!v.ok) return err("nom", v.erreur);
    var cl = espaces(classe);
    if (cl.length > 30) return err("classe", "La classe est limitée à 30 caractères.");
    if (!st.eleve || typeof st.eleve !== "object") st.eleve = { nom: "", classe: "" };
    st.eleve.nom = v.nom; st.eleve.classe = cl;
    return { ok: true, nom: v.nom };
  }

  /* ---------- données du client utilisées par les e-mails ---------- */
  /* Rendez-vous à venir avec un client : ceux de l'agence, ceux planifiés par l'élève et ceux pris avec un autre conseiller de l'agence (le client y est reçu par le collègue), hors passés. */
  function rdvsClient(st, cid) {
    return AG.duClient(st, cid).filter(function (e) { return (e.kind === "agence" || (e.kind === "perso" && (e.type === "rdv" || e.type === "rdv_col"))) && !AG.passe(e.date, e.heure); }).map(function (e) {
      var col = e.type === "rdv_col" ? EQ.collab(e.avec) : null;
      return { cle: e.kind === "agence" ? "agence|" + B.ymd(e.date) + "|" + e.heure : "perso|" + e.id, kind: e.kind, date: e.date, heure: e.heure, canal: e.canal, theme: e.kind === "perso" ? e.motif : "",
        collegue: col && !col.moi ? { nom: col.prenom + " " + col.nom, poste: EQ.posteLib(col), prenom: col.prenom } : null };
    });
  }
  /* Produits que le catalogue permet de présenter à ce client : éligible ou à examiner, non détenu, hors crédits et hors offre clientèle fragile (voir K.prospectionPossible). */
  function proposables(st, c) {
    return PR.produits.filter(function (p) { if (!K.prospectionPossible(p)) return false; var v = K.verdictClient(c, p.id, st).verdict; return v === "eligible" || v === "examiner"; });
  }
  function souscriptionsClient(st, cid) { return K.souscriptions(st).filter(function (x) { return x.c === cid; }); }

  /* ---------- e-mails types ---------- */
  var RELANCES = {
    "Notre dernier échange": { objet: "Suite à notre dernier échange", texte: "Suite à notre dernier échange, je me permets de revenir vers vous afin de connaître la suite que vous souhaitez y donner." },
    "Ma proposition": { objet: "Relance : ma proposition", texte: "Je me permets de revenir vers vous au sujet de la proposition que je vous ai présentée. Souhaitez-vous que nous en reparlions, ou avez-vous besoin d'informations complémentaires ?" },
    "Les documents demandés": { objet: "Relance : documents à nous remettre", texte: "Je me permets de vous relancer au sujet des documents que je vous ai demandés et qui sont nécessaires à la poursuite de l'étude de votre dossier. Vous pouvez les remettre à l'agence." }
  };
  var REMERCIEMENTS = {
    "Notre rendez-vous": { objet: "Suite à notre rendez-vous", texte: "pour le temps que vous m'avez consacré lors de notre rendez-vous" },
    "Notre échange téléphonique": { objet: "Suite à notre échange téléphonique", texte: "pour le temps que vous m'avez consacré lors de notre échange téléphonique" },
    "Votre confiance": { objet: "Remerciements", texte: "pour la confiance que vous nous accordez" }
  };
  var MOTIFS_RELANCE = Object.keys(RELANCES), MOTIFS_MERCI = Object.keys(REMERCIEMENTS);
  var RESERVE = "Cette présentation est donnée à titre d'information : elle ne constitue pas une offre ferme. La souscription reste subordonnée à l'étude de votre situation et à l'acceptation des conditions du contrat.";
  var MODELES = [
    {
      id: "rdv", titre: "Confirmation de rendez-vous", quand: "Après avoir fixé un rendez-vous avec le client.", commercial: false,
      champs: [{ k: "rdv", genre: "rdv", lib: "Rendez-vous à confirmer" }],
      objet: function (x) { return "Confirmation de votre rendez-vous du " + libJour(x.rdv.date) + " à " + heureTxt(x.rdv.heure); },
      corps: function (x) {
        var agence = x.rdv.canal === "En agence", col = x.rdv.collegue;
        if (col) return ["Je vous confirme le rendez-vous que nous avons convenu avec " + col.nom + ", " + col.poste.charAt(0).toLowerCase() + col.poste.slice(1) + " de l'agence, qui vous recevra :\n– Date : " + libJour(x.rdv.date) + "\n– Heure : " + heureTxt(x.rdv.heure) + "\n– Modalité : " + (agence ? "entretien à l'agence de Paris de GS Banque & Assurance, avec " + col.nom : "entretien par téléphone ; " + col.prenom + " vous appellera à l'heure convenue") + (x.rdv.theme ? "\n– Thème : " + x.rdv.theme : ""),
          "Si ce créneau ne vous convient plus, je vous remercie de me l'indiquer par retour de message : nous conviendrons d'une autre date."];
        return ["Je vous confirme le rendez-vous que nous avons convenu :\n– Date : " + libJour(x.rdv.date) + "\n– Heure : " + heureTxt(x.rdv.heure) + "\n– Modalité : " + (agence ? "entretien à l'agence de Paris de GS Banque & Assurance" : "entretien par téléphone ; je vous appellerai à l'heure convenue") + (x.rdv.theme ? "\n– Thème : " + x.rdv.theme : ""),
          "Si ce créneau ne vous convient plus, je vous remercie de me l'indiquer par retour de message : nous conviendrons d'une autre date."];
      }
    },
    {
      id: "relance", titre: "Relance", quand: "Quand le client n'a pas encore répondu à un échange, une proposition ou une demande de documents.", commercial: false,
      champs: [{ k: "motif", genre: "choix", lib: "Objet de la relance", options: MOTIFS_RELANCE }],
      objet: function (x) { return RELANCES[x.motif].objet; },
      corps: function (x) {
        return [RELANCES[x.motif].texte,
          "Pour convenir d'un rendez-vous, en agence ou par téléphone, il vous suffit de répondre à ce message en m'indiquant vos disponibilités."];
      }
    },
    {
      id: "bilan", titre: "Invitation à un bilan", quand: "Pour proposer au client de faire le point sur sa situation.", commercial: true, champs: [],
      objet: function () { return "Proposition d'un bilan de votre situation"; },
      corps: function () {
        return ["Dans le cadre du suivi de notre relation, je vous propose un entretien afin de faire le point sur votre situation : budget, épargne, projets et protection. Cet entretien dure environ une heure, en agence ou par téléphone, et se fait sans engagement de votre part.",
          "Si cette proposition vous convient, je vous remercie de répondre à ce message en m'indiquant vos disponibilités : je vous proposerai un créneau."];
      }
    },
    {
      id: "produit", titre: "Présentation d'un produit", quand: "Pour présenter au client un produit auquel il est éligible, ou qui reste à examiner, d'après le catalogue.", commercial: true,
      champs: [{ k: "produit", genre: "produit", lib: "Produit à présenter" }],
      objet: function (x) { return "Proposition de votre conseiller : " + x.produit.nom; },
      corps: function (x) {
        var p = x.produit, l = [], av = (p.avantages || []).filter(function (a) { return !/\bclient/i.test(a); }), bref = [];
        K.CMP_LIGNES.forEach(function (c) { var v = p.cmp && p.cmp[c.k]; if (v && v !== "Sans objet") bref.push("– " + c.lib + " : " + auClient(sansFictif(v))); });
        l.push("Au vu de votre dossier, vous pourriez être éligible au produit suivant, sous réserve de la vérification de votre situation : " + p.nom + ".");
        l.push(auClient(sansFictif(p.accroche)));
        if (av.length) l.push("Ce qu'il vous apporterait :\n" + av.slice(0, 3).map(function (a) { return "– " + auClient(sansFictif(a)); }).join("\n"));
        if (bref.length) l.push("En bref :\n" + bref.join("\n"));
        l.push(RESERVE);
        l.push("Si ce produit vous intéresse, je vous propose d'en parler lors d'un rendez-vous, en agence ou par téléphone. Je vous remercie de répondre à ce message en m'indiquant vos disponibilités.");
        return l;
      }
    },
    {
      id: "autre", titre: "Autre produit", quand: "Pour présenter un produit ou un service qui n'est pas dans le catalogue (ou un crédit), que vous décrivez vous-même.", commercial: true,
      champs: [
        { k: "nomProduit", genre: "texte", lib: "Nom du produit ou du service", min: LIMITES.nomProduit[0], max: LIMITES.nomProduit[1], exemple: "Exemple : Assurance habitation" },
        { k: "descr", genre: "zone", lib: "Ce que vous présentez au client", min: LIMITES.descr[0], max: LIMITES.descr[1], lignes: 4, exemple: "Exemple : une couverture qui protège votre logement et vos biens, avec une assistance en cas de sinistre." },
        { k: "nature", genre: "choix", lib: "Nature du produit (pour un crédit, la mention légale est ajoutée)", options: NATURES, facultatif: true }
      ],
      objet: function (x) { return "Proposition de votre conseiller : " + x.nomProduit; },
      corps: function (x) {
        var l = ["Je souhaite vous présenter le produit suivant, qui pourrait vous intéresser : " + x.nomProduit + ".", x.descr];
        if (mentionCreditEmail(x.nature)) l.push(mentionCreditEmail(x.nature));
        l.push(RESERVE);
        l.push("Si ce produit vous intéresse, je vous propose d'en parler lors d'un rendez-vous, en agence ou par téléphone. Je vous remercie de répondre à ce message en m'indiquant vos disponibilités.");
        return l;
      }
    },
    {
      id: "bienvenue", titre: "Confirmation de souscription", quand: "Après une souscription faite dans le catalogue de produits, ou un crédit accordé dans « Montage de prêt ».", commercial: false,
      champs: [{ k: "souscription", genre: "souscription", lib: "Souscription à confirmer" }],
      objet: function (x) { return "Confirmation de votre souscription : " + x.souscription.produit.nom; },
      corps: function (x) {
        var s = x.souscription;
        var mt = s.montant !== null && s.montant !== undefined ? (s.montant % 1 === 0 ? B.eur(s.montant) : B.eur2(s.montant)) : "";
        if (s.produit.famille === "credit") return ["Je vous confirme l'accord de votre " + s.produit.nom + " le " + libJour(B.lireYmd(s.date)) + (mt ? ", pour un capital emprunté de " + mt : "") + ". Vous allez recevoir l'offre de crédit : le délai de réflexion ou de rétractation prévu par la loi vous permettra de l'examiner en toute sérénité.",
          "Je vous remercie de la confiance que vous nous accordez et reste à votre disposition pour toute question relative à votre crédit."];
        return ["Je vous confirme la souscription de votre " + s.produit.nom + " le " + libJour(B.lireYmd(s.date)) + (mt ? ", avec un versement initial de " + mt : "") + ".",
          "Je vous remercie de la confiance que vous nous accordez et reste à votre disposition pour toute question relative au fonctionnement de ce produit."];
      }
    },
    {
      id: "pieces", titre: "Pièces à fournir", quand: "Quand il manque des documents pour poursuivre l'étude du dossier.", commercial: false,
      champs: [{ k: "pieces", genre: "liste", lib: "Pièces à fournir (une par ligne)", max: MAX_PIECES, maxLigne: MAX_PIECE }],
      objet: function () { return "Pièces à nous remettre pour votre dossier"; },
      corps: function (x) {
        return ["Afin de poursuivre l'étude de votre dossier, je vous remercie de bien vouloir me remettre les pièces suivantes :\n" + x.pieces.map(function (p) { return "– " + p; }).join("\n"),
          "Vous pouvez les remettre à l'agence. Dès réception de l'ensemble des pièces, je poursuivrai l'étude de votre dossier.",
          "Pour votre sécurité, ne m'envoyez jamais vos identifiants ni vos codes par e-mail."];
      }
    },
    {
      id: "merci", titre: "Remerciement", quand: "Après un contact avec le client.", commercial: false,
      champs: [{ k: "motif", genre: "choix", lib: "Ce que vous remerciez", options: MOTIFS_MERCI }],
      objet: function (x) { return REMERCIEMENTS[x.motif].objet; },
      corps: function (x) {
        return ["Je tiens à vous remercier " + REMERCIEMENTS[x.motif].texte + ".", "Je reste à votre disposition pour toute question ou pour tout nouveau projet : n'hésitez pas à me répondre à ce message."];
      }
    },
    {
      id: "libre", titre: "Message libre", quand: "Pour écrire un message sur mesure, avec votre objet et votre texte. Cochez la case si vous y présentez un produit ou une offre.", commercial: function (x) { return !!x.commercial; }, sansMot: true, sansEdition: true,
      champs: [
        { k: "objet", genre: "texte", lib: "Objet du message", min: LIMITES.objet[0], max: LIMITES.objet[1], exemple: "Exemple : Votre rendez-vous de la semaine prochaine" },
        { k: "texte", genre: "zone", lib: "Votre message", min: LIMITES.texte[0], max: LIMITES.texte[1], lignes: 7, exemple: "Écrivez ici votre message. La formule d'appel (« Madame Martin, ») et la formule de politesse sont ajoutées automatiquement." },
        { k: "commercial", genre: "case", lib: "Ce message présente un produit ou une offre (la ligne de désinscription sera ajoutée)" }
      ],
      objet: function (x) { return x.objet; },
      corps: function (x) { return x.texte.split(/\n{2,}/); }
    }
  ];
  var MODELE = {}; MODELES.forEach(function (m) { MODELE[m.id] = m; });

  /* Les e-mails types sont-ils utilisables pour ce client ? { ok } ou { ok: false, raison } (explication affichée à l'élève). */
  function disponibilite(st, c, mid) {
    if (mid === "rdv" && !rdvsClient(st, c.id).length) return { ok: false, raison: "Aucun rendez-vous à venir avec ce client : planifiez-en un dans l'agenda." };
    if (mid === "produit" && !proposables(st, c).length) return { ok: false, raison: "Aucun produit à présenter : ce client détient déjà tous les produits présentables (hors crédits et hors offre clientèle fragile) auxquels il est éligible, ou n'y est pas éligible." };
    if (mid === "bienvenue" && !souscriptionsClient(st, c.id).length) return { ok: false, raison: "Ce client n'a encore souscrit aucun produit : souscrivez-en un dans le catalogue." };
    return { ok: true };
  }

  /* Valeurs choisies pour les champs de l'e-mail type : contrôle et résolution. */
  function resoudre(st, c, m, vals) {
    var x = {};
    for (var i = 0; i < m.champs.length; i++) {
      var f = m.champs[i], v = vals[f.k];
      if (f.genre === "rdv") {
        var l = rdvsClient(st, c.id);
        if (!l.length) return err(f.k, "Aucun rendez-vous à venir avec ce client : planifiez-en un dans l'agenda.");
        var r = l.filter(function (e) { return e.cle === v; })[0];
        if (!r) return err(f.k, "Choisissez le rendez-vous à confirmer.");
        x.rdv = r;
      } else if (f.genre === "produit") {
        var p = proposables(st, c).filter(function (q) { return q.id === v; })[0];
        if (!p) return err(f.k, "Choisissez un produit parmi ceux que ce client peut se voir proposer.");
        x.produit = p;
      } else if (f.genre === "souscription") {
        var s = souscriptionsClient(st, c.id).filter(function (q) { return q.id === v; })[0];
        if (!s) return err(f.k, "Choisissez la souscription à confirmer.");
        x.souscription = Object.assign({}, s, { produit: PR.parId[s.p] });
      } else if (f.genre === "choix") {
        if (f.facultatif && (v === undefined || v === null || v === "")) v = f.options[0];
        if (f.options.indexOf(v) < 0) return err(f.k, "Choisissez une des propositions de la liste.");
        x[f.k] = v;
      } else if (f.genre === "texte") {
        var t = typeof v === "string" ? espaces(v) : "";
        if (t.length < f.min) return err(f.k, f.lib + " : au moins " + f.min + " caractères.");
        if (t.length > f.max) return err(f.k, f.lib + " : " + f.max + " caractères au plus.");
        x[f.k] = t;
      } else if (f.genre === "zone") {
        var z = nettoyerCorps(typeof v === "string" ? v : "");
        if (z.length < f.min) return err(f.k, f.lib + " : au moins " + f.min + " caractères.");
        if (z.length > f.max) return err(f.k, f.lib + " : " + f.max + " caractères au plus.");
        x[f.k] = z;
      } else if (f.genre === "case") {
        x[f.k] = v === true || v === "true";
      } else if (f.genre === "liste") {
        var lignes = String(v == null ? "" : v).split(/\r?\n/).map(espaces).filter(Boolean);
        if (!lignes.length) return err(f.k, "Indiquez au moins une pièce à fournir.");
        if (lignes.length > f.max) return err(f.k, "Au plus " + f.max + " pièces, à raison d'une par ligne.");
        if (lignes.some(function (t) { return t.length > f.maxLigne; })) return err(f.k, "Chaque pièce est limitée à " + f.maxLigne + " caractères.");
        x[f.k] = lignes;
      }
    }
    return { ok: true, x: x };
  }

  /* Un e-mail commercial porte la ligne de désinscription. Pour le message libre, c'est l'élève qui l'indique (case à cocher). */
  function commercialDe(m, x) { return typeof m.commercial === "function" ? !!m.commercial(x || {}) : !!m.commercial; }
  /* Compose l'e-mail : objet, corps, signature et, pour un e-mail commercial, la ligne de désinscription.
     o = { client, modele, champs, mot, edition (facultatif : { objet, corps } = texte modifié par l'élève, qui remplace le texte type) }. */
  function composer(st, o) {
    var c = CLIENT[parseInt(o.client, 10)];
    if (!c) return err("client", "Choisissez le client destinataire.");
    var m = MODELE[o.modele];
    if (!m) return err("modele", "Choisissez un e-mail type.");
    var sig = signature(st);
    if (!sig.ok) return err("signature", sig.erreur);
    var mot = m.sansMot ? "" : propre(o.mot).trim();
    if (mot.length > MAX_MOT) return err("mot", "Votre mot personnel est limité à " + MAX_MOT + " caractères.");
    var r = resoudre(st, c, m, o.champs || {});
    if (!r.ok) return r;
    var x = r.x, objet = m.objet(x);
    var para = [appel(c)].concat(m.corps(x));
    if (mot) para.push(mot);
    para.push(cloture(c));
    var corps = para.join("\n\n"), pied = commercialDe(m, x) ? PIED_COMMERCIAL : "", modifie = false;
    if (o.edition) {
      var eo = typeof o.edition.objet === "string" ? espaces(o.edition.objet) : "", ec = typeof o.edition.corps === "string" ? nettoyerCorps(o.edition.corps) : "";
      if (eo.length < LIMITES.objetEdite[0] || eo.length > LIMITES.objetEdite[1]) return err("objet-edite", "Objet du message : entre " + LIMITES.objetEdite[0] + " et " + LIMITES.objetEdite[1] + " caractères.");
      if (ec.length < LIMITES.corpsEdite[0] || ec.length > LIMITES.corpsEdite[1]) return err("corps-edite", "Texte du message : entre " + LIMITES.corpsEdite[0] + " et " + milliers(LIMITES.corpsEdite[1]) + " caractères.");
      modifie = eo !== espaces(objet) || ec !== nettoyerCorps(corps);
      objet = eo; corps = ec;
    }
    var d = { ok: true, client: c, modele: m, objet: objet, corps: corps, signature: sig.texte, pied: pied, de: sig.nom + " <" + sig.corps[4] + ">", modifie: modifie };
    d.texte = texteMessage(d);
    return d;
  }
  function texteMessage(m) { return "Objet : " + m.objet + "\n\n" + m.corps + "\n\n" + m.signature + (m.pied ? "\n\n" + m.pied : ""); }

  /* ---------- journal des envois ---------- */
  function messages(st) { return (st && Array.isArray(st.messages)) ? st.messages : []; }
  function uid() { return "m" + B.maintenant().getTime().toString(36) + Math.random().toString(36).slice(2, 6); }
  /* Enregistre l'envoi. o = { client, modele, champs, mot, edition (facultatif), campagne (facultatif) }. */
  function envoyer(st, o) {
    var d = composer(st, o);
    if (!d.ok) return d;
    var camp = o.campagne ? String(o.campagne) : "";
    if (camp) {
      var kc = (Array.isArray(st.campagnes) ? st.campagnes : []).filter(function (k) { return k.id === camp; })[0];
      if (!kc) return err("campagne", "Cette campagne n'existe plus.");
      if (kc.ids.indexOf(d.client.id) < 0) return err("campagne", "Ce client ne fait pas partie de la cible de cette campagne.");
    }
    var auj = B.ymd(B.aujourdhui());
    if (messages(st).some(function (x) { return x.c === d.client.id && x.date === auj && x.objet === d.objet && x.corps === d.corps; })) return err("", "Ce message a déjà été envoyé aujourd'hui à ce client.");
    if (messages(st).length >= MAX_MESSAGES) return err("", "Le journal contient déjà " + MAX_MESSAGES + " messages : supprimez-en avant d'en envoyer d'autres.");
    var now = B.maintenant();
    var x = { id: uid(), c: d.client.id, m: d.modele.id, objet: d.objet, corps: d.corps, signature: d.signature, pied: d.pied, date: auj, heure: B.hhmm(now), par: nomEleve(st), camp: camp, mod: !!d.modifie };
    if (!Array.isArray(st.messages)) st.messages = [];
    st.messages.push(x);
    return { ok: true, message: x };
  }
  /* Du plus récent au plus ancien : date, heure, puis ordre d'enregistrement (deux messages envoyés dans la même minute restent dans l'ordre d'envoi). */
  function trier(l) {
    return l.map(function (x, i) { return { x: x, i: i }; }).sort(function (a, b) { return a.x.date < b.x.date ? 1 : a.x.date > b.x.date ? -1 : a.x.heure < b.x.heure ? 1 : a.x.heure > b.x.heure ? -1 : b.i - a.i; }).map(function (e) { return e.x; });
  }
  function duClient(st, cid) { return trier(messages(st).filter(function (x) { return x.c === cid; })); }
  function journal(st) { return trier(messages(st)); }
  function supprimer(st, id) { var n = messages(st).length; st.messages = messages(st).filter(function (x) { return x.id !== id; }); return st.messages.length < n; }

  var api = {
    MAX_MESSAGES: MAX_MESSAGES, MAX_MOT: MAX_MOT, MAX_NOM: MAX_NOM, FONCTION: FONCTION, AGENCE: AGENCE, TEL: TEL, DOMAINE: DOMAINE, MENTIONS: MENTIONS, MENTIONS_LEGALES: MENTIONS_LEGALES, PIED_COMMERCIAL: PIED_COMMERCIAL, appel: appel, cloture: cloture, sansFictif: sansFictif, auClient: auClient, nettoyerCorps: nettoyerCorps,
    MENTION_CREDIT: MENTION_CREDIT, MENTION_CREDIT_NOUVELLE: MENTION_CREDIT_NOUVELLE, NATURES: NATURES, mentionCreditEmail: mentionCreditEmail, LIMITES: LIMITES, commercialDe: commercialDe, MODELES: MODELES, MODELE: MODELE, nomValide: nomValide, adresse: adresse, signature: signature, definirIdentite: definirIdentite, nomEleve: nomEleve,
    rdvsClient: rdvsClient, proposables: proposables, souscriptionsClient: souscriptionsClient, disponibilite: disponibilite, composer: composer, texteMessage: texteMessage,
    messages: messages, envoyer: envoyer, duClient: duClient, journal: journal, supprimer: supprimer, heureTxt: heureTxt, libJour: libJour, formule: formule, pluriel: pluriel, maj1: maj1
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.messagerie = api; }
})(typeof window !== "undefined" ? window : null);
