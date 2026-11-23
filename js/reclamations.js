/* GS Banque & Assurance – réclamations des clients, au niveau de l'agence.
   Une réclamation est « l'expression d'un mécontentement envers un professionnel » (recommandation 2022-R-01 de l'ACPR) : à l'oral ou à l'écrit, quel que soit le service concerné ;
   une simple demande de service, d'information ou d'avis n'en est pas une. Ici, le conseiller (l'élève) reçoit le client, note le problème en mots simples, propose de quoi calmer la situation,
   puis remet la réclamation au conseiller gestionnaire du client et/ou à la directrice d'agence, qui la traitent. Le service réclamations de la banque et le médiateur ne sont pas des étapes
   de cet outil : ils ne sont cités que comme suite possible si le client n'est pas satisfait de la réponse de l'agence.
   Conventions de l'exercice (aucune règle officielle) : numéro de dossier « REC-année-numéro », six canaux de réception, onze sujets, huit origines possibles, trois niveaux de mécontentement,
   neuf moyens de calmer la situation ; un client qui menace d'aller plus loin (médiateur, avocat, tribunal, avis public) est toujours signalé à la directrice d'agence ; la date de retour au client
   est choisie par l'élève (jour d'ouverture, au plus tard 60 jours après aujourd'hui) ; une réclamation reçue il y a plus d'un an ne s'enregistre pas ; 100 réclamations au plus.
   Les réclamations sont enregistrées dans le navigateur (store().reclamations). */
(function (root) {
  "use strict";

  var B = root && root.SGBF ? root.SGBF.banque : require("./banque.js");
  var E = root && root.SGBF ? root.SGBF.equipe : require("./equipe.js");
  var CL = root && root.SGBF ? root.SGBF.clients : require("./data_clients.js").clients;
  var CLIENT = {}; CL.forEach(function (c) { CLIENT[c.id] = c; });

  var MAX_RECLAMATIONS = 100, MAX_SUIVI = 60, HORIZON_RETOUR = 60, ANCIENNETE_MAX = 365;
  var L = { faits: [10, 1000], origineTxt: [5, 500], mesuresTxt: [10, 1000], autres: [0, 500], deja: [0, 500], attenteTxt: [0, 200], suite: [3, 500], reponse: [10, 800], cloture: [0, 500] };
  var MONTANT_MAX = 100000, GESTE_MAX = 10000;

  /* Comment le client s'est manifesté. */
  var CANAUX = [
    { id: "agence", lib: "En venant à l'agence", sous: "à l'oral" },
    { id: "telephone", lib: "Par téléphone", sous: "à l'oral" },
    { id: "courrier", lib: "Par courrier", sous: "par écrit" },
    { id: "mail", lib: "Par e-mail", sous: "par écrit" },
    { id: "appli", lib: "Par un message depuis l'application ou le site de la banque", sous: "par écrit" },
    { id: "avis", lib: "Par un avis ou un message public sur Internet", sous: "par écrit" }
  ];
  /* Sur quoi porte la réclamation. */
  var THEMES = [
    { id: "paiement", lib: "Un paiement ou une opération contestée (carte, virement, prélèvement)", ex: "Un paiement par carte que le client ne reconnaît pas, un prélèvement pris deux fois." },
    { id: "frais", lib: "Des frais ou des commissions prélevés", ex: "Des frais de rejet de prélèvement, une cotisation de carte, des agios." },
    { id: "carte", lib: "La carte bancaire elle-même (commande, réception, plafond, carte avalée)", ex: "Une carte commandée et jamais reçue, une carte avalée par le distributeur." },
    { id: "cheque", lib: "Un chèque ou un chéquier", ex: "Un chèque rejeté, un chéquier non reçu." },
    { id: "compte", lib: "Le fonctionnement du compte (découvert, blocage, clôture, interdiction bancaire)", ex: "Un compte bloqué sans prévenir le client." },
    { id: "credit", lib: "Un crédit (refus, délai, remboursement, assurance de l'emprunteur)", ex: "Un prêt refusé sans explication, un dossier de crédit qui traîne." },
    { id: "epargne", lib: "L'épargne ou un placement (information, délai, résultat)", ex: "Un retrait sur un livret qui tarde, un placement qui a perdu de la valeur." },
    { id: "assurance", lib: "Un contrat d'assurance (souscription, sinistre, remboursement)", ex: "Un sinistre déclaré et pas encore indemnisé." },
    { id: "accueil", lib: "L'accueil ou le conseil (attente, information donnée, attitude)", ex: "Une longue attente, un renseignement faux donné par un conseiller." },
    { id: "numerique", lib: "L'application, le site ou le distributeur (panne, accès impossible)", ex: "L'application qui ne s'ouvre plus, un distributeur en panne." },
    { id: "autre", lib: "Autre sujet", ex: "Tout ce qui n'entre dans aucune des lignes précédentes." }
  ];
  /* D'où vient le problème, en mots simples (« banque » : la banque semble en cause). */
  var ORIGINES = [
    { id: "erreur", lib: "Une erreur de la banque", ex: "Une saisie fausse, un oubli, un document perdu, un retard de traitement.", banque: true },
    { id: "info", lib: "Le client n'avait pas été bien informé", ex: "Les frais, les délais ou les conditions ne lui avaient pas été expliqués, ou pas assez clairement.", banque: true },
    { id: "technique", lib: "Un incident technique", ex: "Une panne de l'application, du distributeur ou d'un système de la banque.", banque: true },
    { id: "regle", lib: "Une règle ou un tarif de la banque, appliqué normalement", ex: "Le client conteste le principe lui-même, pas une erreur : « Je ne savais pas que c'était payant ».", banque: false },
    { id: "situation", lib: "La situation du client", ex: "Un découvert, un virement de salaire arrivé en retard, un changement de situation non signalé à la banque.", banque: false },
    { id: "tiers", lib: "Une autre personne ou entreprise", ex: "Un commerçant, une autre banque, l'employeur, un organisme.", banque: false },
    { id: "fraude", lib: "Une fraude ou une usurpation", ex: "Une carte volée, un faux virement, une arnaque.", banque: false },
    { id: "inconnue", lib: "Je ne sais pas encore : il faut vérifier", ex: "Vous irez regarder le dossier du client avant de conclure. Écrivez ce que vous allez vérifier.", banque: false }
  ];
  /* Ce que le client demande. */
  var ATTENTES = [
    { id: "rembourse", lib: "Qu'on lui rembourse ou qu'on annule des frais" },
    { id: "corrige", lib: "Qu'on corrige une erreur" },
    { id: "explique", lib: "Qu'on lui explique ce qui s'est passé" },
    { id: "geste", lib: "Un geste commercial" },
    { id: "excuses", lib: "Des excuses" },
    { id: "responsable", lib: "Parler à un responsable (son conseiller gestionnaire ou la directrice)" },
    { id: "partir", lib: "Fermer ses comptes ou quitter la banque" },
    { id: "autre", lib: "Autre demande" }
  ];
  /* Niveau de mécontentement. */
  var NIVEAUX = [
    { id: "calme", lib: "Mécontent mais calme", ex: "Il explique son problème et attend une solution." },
    { id: "fache", lib: "Très mécontent", ex: "Il hausse le ton ou parle de quitter la banque." },
    { id: "menace", lib: "Il menace d'aller plus loin", ex: "Il parle du médiateur, d'un avocat, du tribunal, d'une plainte ou de publier son avis." }
  ];
  /* Ce que le conseiller propose pour calmer la situation. */
  var MESURES = [
    { id: "ecoute", lib: "L'écouter jusqu'au bout et reformuler son problème avec ses mots" },
    { id: "explique", lib: "Lui expliquer clairement ce qui s'est passé" },
    { id: "corrige", lib: "Corriger tout de suite ce qui peut l'être" },
    { id: "rembourse", lib: "Proposer le remboursement ou l'annulation de frais" },
    { id: "geste", lib: "Proposer un geste commercial" },
    { id: "rdv", lib: "Proposer un rendez-vous avec son conseiller gestionnaire ou la directrice" },
    { id: "rappel", lib: "Le rappeler pour lui donner des nouvelles à la date prévue" },
    { id: "solution", lib: "Proposer une solution pour que cela ne se reproduise pas (alerte par SMS, autre carte, autre offre…)" },
    { id: "recours", lib: "Lui indiquer comment aller plus loin s'il n'est pas satisfait de la réponse de l'agence" }
  ];
  var STATUTS = { transmise: "À traiter", repondue: "Réponse donnée", close: "Clôturée" };
  var ISSUES = [
    { id: "satisfait", lib: "Réglée : le client est satisfait" },
    { id: "partiel", lib: "Réglée en partie : le client accepte, sans être pleinement satisfait" },
    { id: "non_satisfait", lib: "Le client n'est pas satisfait : il peut écrire au service réclamations de la banque" },
    { id: "sans_suite", lib: "Sans suite : le client ne donne plus de nouvelles ou retire sa réclamation" }
  ];
  function index(l) { var m = {}; l.forEach(function (x) { m[x.id] = x; }); return m; }
  var PAR = { canal: index(CANAUX), theme: index(THEMES), origine: index(ORIGINES), attente: index(ATTENTES), niveau: index(NIVEAUX), mesure: index(MESURES), issue: index(ISSUES) };

  /* ---------- outils ---------- */
  function propre(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); }
  function texte(s) { return String(s == null ? "" : s).replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n").trim(); }
  function err(champ, msg) { return { ok: false, champ: champ, erreur: msg }; }
  function elements(st) { return (st && Array.isArray(st.reclamations)) ? st.reclamations : []; }
  function trouver(st, id) { return elements(st).filter(function (x) { return x.id === id; })[0] || null; }
  function pad(n, l) { var s = String(n); while (s.length < l) s = "0" + s; return s; }
  function longueur(champ, s, lib) {
    var m = L[champ];
    if (s.length < m[0]) return "« " + lib + " » : au moins " + m[0] + " caractères.";
    if (s.length > m[1]) return "« " + lib + " » : " + m[1] + " caractères au plus (vous en avez écrit " + s.length + ").";
    return null;
  }
  function nombre(v) {
    var s = String(v == null ? "" : v).replace(/[\s  ]/g, "").replace(",", ".");
    if (!s) return null;
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
    return Math.round(parseFloat(s) * 100) / 100;
  }
  function uid() { return "r" + B.maintenant().getTime().toString(36) + Math.random().toString(36).slice(2, 6); }
  function reference(st) {
    var an = B.aujourdhui().getFullYear(), n = 0;
    elements(st).forEach(function (x) { var m = /^REC-(\d{4})-(\d+)$/.exec(x.ref || ""); if (m && +m[1] === an && +m[2] > n) n = +m[2]; });
    return "REC-" + an + "-" + pad(n + 1, 3);
  }

  /* Collègues qui peuvent être gestionnaires : tous sauf la directrice (l'élève lui-même compris). */
  function gestionnaires() { return E.COLLABS.filter(function (c) { return c.poste !== "dir"; }); }
  function directeur() { return E.COLLABS.filter(function (c) { return c.poste === "dir"; })[0]; }
  function nomDe(id, st) { var c = E.collab(id); return c ? E.nomComplet(c, st) : "Collègue"; }
  /* Destinataires d'une réclamation : [{ id, role, nom, poste }]. */
  function destinataires(r, st) {
    var l = [];
    if (r.gest) { var g = E.collab(r.gest); if (g) l.push({ id: g.id, role: "Conseiller gestionnaire", nom: nomDe(g.id, st), poste: E.posteLib(g), moi: !!g.moi }); }
    if (r.dir) { var d = directeur(); l.push({ id: d.id, role: "Directrice d'agence", nom: nomDe(d.id, st), poste: E.posteLib(d), moi: false }); }
    return l;
  }
  function listeNoms(l) { return l.map(function (x) { return x.moi ? "vous (conseiller gestionnaire)" : x.role.toLowerCase() + " " + x.nom; }).join(" et "); }

  /* ---------- contrôle de la saisie ---------- */
  function valider(st, o) {
    var cid = o.client == null || o.client === "" ? null : parseInt(o.client, 10), auj = B.aujourdhui();
    if (!cid || !CLIENT[cid]) return err("client", "Choisissez le client qui fait la réclamation.");
    var d = B.lireYmd(o.date);
    if (!d) return err("date", "Indiquez la date à laquelle le client a fait savoir son mécontentement.");
    if (B.ecartJours(d, auj) > 0) return err("date", "Cette date est dans le futur : indiquez le jour où le client a exprimé son mécontentement (au plus tard aujourd'hui).");
    if (B.ecartJours(auj, d) > ANCIENNETE_MAX) return err("date", "Cette date remonte à plus d'un an : on n'enregistre pas une réclamation aussi ancienne.");
    if (!PAR.canal[o.canal]) return err("canal", "Choisissez comment le client s'est manifesté.");
    if (!PAR.theme[o.theme]) return err("theme", "Choisissez le sujet de la réclamation.");
    var faits = texte(o.faits), e = longueur("faits", faits, "Ce que reproche le client");
    if (e) return err("faits", e);
    if (!PAR.origine[o.origine]) return err("origine", "Choisissez d'où vient le problème, ou « Je ne sais pas encore ».");
    var ot = propre(o.origineTxt); e = longueur("origineTxt", ot, "Expliquez en une phrase");
    if (e) return err("origineTxt", o.origine === "inconnue" ? "Écrivez ce que vous allez vérifier pour trouver l'origine du problème (au moins " + L.origineTxt[0] + " caractères)." : e);
    if (!PAR.attente[o.attente]) return err("attente", "Choisissez ce que le client demande.");
    var at = propre(o.attenteTxt);
    if (o.attente === "autre" && !at) return err("attenteTxt", "Précisez la demande du client.");
    e = longueur("attenteTxt", at, "Précisions sur sa demande"); if (e) return err("attenteTxt", e);
    if (!PAR.niveau[o.niveau]) return err("niveau", "Indiquez le niveau de mécontentement du client.");
    var montant = nombre(o.montant);
    if (montant !== null && (isNaN(montant) || montant > MONTANT_MAX)) return err("montant", "Somme en jeu : un montant en euros (par exemple 45 ou 45,50), au plus " + B.nb(MONTANT_MAX) + " €. Laissez vide s'il n'y en a pas.");
    var deja = texte(o.deja); e = longueur("deja", deja, "Ce que vous avez déjà fait ou dit"); if (e) return err("deja", e);
    var mesures = Array.isArray(o.mesures) ? o.mesures.filter(function (m, i, a) { return PAR.mesure[m] && a.indexOf(m) === i; }) : [];
    if (!mesures.length) return err("mesures", "Cochez au moins une chose que vous proposez pour calmer la situation.");
    var mt = texte(o.mesuresTxt); e = longueur("mesuresTxt", mt, "Détaillez ce que vous proposez");
    if (e) return err("mesuresTxt", e);
    var geste = nombre(o.geste);
    if (geste !== null && (isNaN(geste) || geste > GESTE_MAX)) return err("geste", "Montant du geste proposé : un montant en euros (par exemple 20 ou 20,50), au plus " + B.nb(GESTE_MAX) + " €. Laissez vide s'il n'y en a pas.");
    var retour = B.lireYmd(o.retour);
    if (!retour) return err("retour", "Indiquez la date à laquelle le client aura des nouvelles.");
    if (B.ecartJours(retour, auj) < 0) return err("retour", "Cette date est passée : choisissez un jour à venir, ou aujourd'hui.");
    if (B.ecartJours(retour, auj) > HORIZON_RETOUR) return err("retour", "Donnez des nouvelles au client au plus tard le " + B.fmtLong(B.plusJours(auj, HORIZON_RETOUR)) + " : au-delà de " + HORIZON_RETOUR + " jours, c'est trop tard pour un client mécontent.");
    if (!B.agenceOuverte(retour)) return err("retour", B.fmtLong(retour) + " : l'agence est fermée. Choisissez un jour d'ouverture (du mardi au samedi, hors jours fériés).");
    if (B.ecartJours(retour, d) < 0) return err("retour", "La date de retour ne peut pas être avant la date de la réclamation.");
    var autres = texte(o.autres); e = longueur("autres", autres, "Autres informations utiles"); if (e) return err("autres", e);
    var gest = o.gest ? String(o.gest) : "", dir = o.dir === true || o.dir === "true" || o.dir === "on";
    if (gest) { var g = E.collab(gest); if (!g || g.poste === "dir") return err("gest", "Choisissez le conseiller gestionnaire du client parmi l'équipe de l'agence."); }
    if (!gest && !dir) return err("dest", "Choisissez à qui remettre la réclamation : le conseiller gestionnaire, la directrice d'agence, ou les deux.");
    if (o.niveau === "menace" && !dir) return err("dir", "Un client qui menace d'aller plus loin (médiateur, avocat, tribunal, avis public) doit toujours être signalé à la directrice d'agence : cochez la directrice.");
    if (elements(st).length >= MAX_RECLAMATIONS) return err("", "Le suivi contient déjà " + MAX_RECLAMATIONS + " réclamations : supprimez-en avant d'en ajouter.");
    return { ok: true, valeurs: { client: cid, date: B.ymd(d), canal: o.canal, theme: o.theme, faits: faits, origine: o.origine, origineTxt: ot, attente: o.attente, attenteTxt: at, niveau: o.niveau,
      montant: montant, deja: deja, mesures: mesures, mesuresTxt: mt, geste: geste, retour: B.ymd(retour), autres: autres, gest: gest, dir: dir } };
  }
  function horodatage() { return { d: B.ymd(B.aujourdhui()), h: B.hhmm(B.maintenant()) }; }
  function creer(st, o) {
    var v = valider(st, o);
    if (!v.ok) return v;
    var h = horodatage(), r = Object.assign({ id: uid(), ref: reference(st), cree: h.d + " " + h.h, statut: "transmise", reponse: null, cloture: null, suivi: [] }, v.valeurs);
    r.suivi.push({ d: h.d, h: h.h, txt: "Réclamation enregistrée et remise à : " + listeNoms(destinataires(r, st)) + ".", auto: true });
    if (!Array.isArray(st.reclamations)) st.reclamations = [];
    st.reclamations.push(r);
    return { ok: true, reclamation: r };
  }

  /* ---------- suite donnée ---------- */
  function ouverte(r) { return !!r && r.statut !== "close"; }
  function noterSuite(st, id, txt) {
    var r = trouver(st, id);
    if (!r) return err("", "Cette réclamation n'existe plus.");
    if (!ouverte(r)) return err("suite", "Cette réclamation est clôturée : rouvrez-la pour y ajouter une suite.");
    var t = texte(txt), e = longueur("suite", t, "Suite donnée");
    if (e) return err("suite", e);
    if (r.suivi.length >= MAX_SUIVI) return err("suite", "Le suivi de cette réclamation contient déjà " + MAX_SUIVI + " lignes.");
    var h = horodatage(); r.suivi.push({ d: h.d, h: h.h, txt: t });
    return { ok: true, reclamation: r };
  }
  function donnerReponse(st, id, o) {
    var r = trouver(st, id);
    if (!r) return err("", "Cette réclamation n'existe plus.");
    if (!ouverte(r)) return err("texte", "Cette réclamation est clôturée : rouvrez-la d'abord.");
    var d = B.lireYmd(o.date), auj = B.aujourdhui();
    if (!d) return err("date", "Indiquez la date de la réponse donnée au client.");
    if (B.ecartJours(d, auj) > 0) return err("date", "Cette date est dans le futur : indiquez le jour où vous avez répondu au client.");
    if (B.ecartJours(d, B.lireYmd(r.date)) < 0) return err("date", "La réponse ne peut pas être antérieure à la réclamation (" + B.fmtLong(B.lireYmd(r.date)) + ").");
    var t = texte(o.texte), e = longueur("reponse", t, "Réponse donnée au client");
    if (e) return err("texte", e);
    r.reponse = { date: B.ymd(d), texte: t, recours: o.recours === true || o.recours === "on" || o.recours === "true" };
    r.statut = "repondue";
    var h = horodatage(); r.suivi.push({ d: h.d, h: h.h, txt: "Réponse donnée au client le " + B.fmtLong(d) + (r.reponse.recours ? " (avec l'indication de la suite possible s'il n'est pas satisfait)" : "") + "." , auto: true });
    return { ok: true, reclamation: r };
  }
  function cloturer(st, id, o) {
    var r = trouver(st, id);
    if (!r) return err("", "Cette réclamation n'existe plus.");
    if (!ouverte(r)) return err("issue", "Cette réclamation est déjà clôturée.");
    if (!PAR.issue[o.issue]) return err("issue", "Choisissez comment la réclamation s'est terminée.");
    var n = texte(o.note), e = longueur("cloture", n, "Remarque");
    if (e) return err("note", e);
    var h = horodatage();
    r.cloture = { date: h.d, issue: o.issue, note: n };
    r.statut = "close";
    r.suivi.push({ d: h.d, h: h.h, txt: "Réclamation clôturée : " + PAR.issue[o.issue].lib.charAt(0).toLowerCase() + PAR.issue[o.issue].lib.slice(1) + (n ? ". " + n : "."), auto: true });
    return { ok: true, reclamation: r };
  }
  function rouvrir(st, id) {
    var r = trouver(st, id);
    if (!r || r.statut !== "close") return false;
    r.statut = r.reponse ? "repondue" : "transmise";
    r.cloture = null;
    var h = horodatage(); r.suivi.push({ d: h.d, h: h.h, txt: "Réclamation rouverte.", auto: true });
    return true;
  }
  function supprimer(st, id) { var n = elements(st).length; st.reclamations = elements(st).filter(function (x) { return x.id !== id; }); return st.reclamations.length < n; }

  /* ---------- lecture ---------- */
  /* Retour au client : date promise, jours d'ouverture restants (négatif : en retard), « retard » seulement tant qu'aucune réponse n'a été donnée. */
  function retour(r) {
    var d = B.lireYmd(r.retour), auj = B.aujourdhui(), ec = B.ecartJours(d, auj);
    return { date: d, ecart: ec, retard: r.statut === "transmise" && ec < 0, aujourdhui: r.statut === "transmise" && ec === 0 };
  }
  function trier(l) {
    return l.slice().sort(function (a, b) {
      var oa = ouverte(a) ? 0 : 1, ob = ouverte(b) ? 0 : 1;
      if (oa !== ob) return oa - ob;
      if (oa === 0) return (a.retour < b.retour ? -1 : a.retour > b.retour ? 1 : 0) || (a.cree < b.cree ? -1 : 1);
      return a.cree < b.cree ? 1 : a.cree > b.cree ? -1 : 0;
    });
  }
  function duClient(st, cid) { return trier(elements(st).filter(function (x) { return x.client === cid; })); }
  function ouvertesDuClient(st, cid) { return duClient(st, cid).filter(ouverte); }
  function ouvertes(st) { return elements(st).filter(ouverte); }
  function enRetard(st) { return ouvertes(st).filter(function (r) { return retour(r).retard; }); }
  function libelle(type, id) { var x = PAR[type] && PAR[type][id]; return x ? x.lib : ""; }

  var api = {
    MAX_RECLAMATIONS: MAX_RECLAMATIONS, MAX_SUIVI: MAX_SUIVI, HORIZON_RETOUR: HORIZON_RETOUR, ANCIENNETE_MAX: ANCIENNETE_MAX, LIMITES: L, MONTANT_MAX: MONTANT_MAX, GESTE_MAX: GESTE_MAX,
    CANAUX: CANAUX, THEMES: THEMES, ORIGINES: ORIGINES, ATTENTES: ATTENTES, NIVEAUX: NIVEAUX, MESURES: MESURES, STATUTS: STATUTS, ISSUES: ISSUES, PAR: PAR,
    elements: elements, trouver: trouver, valider: valider, creer: creer, noterSuite: noterSuite, donnerReponse: donnerReponse, cloturer: cloturer, rouvrir: rouvrir, supprimer: supprimer,
    ouverte: ouverte, retour: retour, trier: trier, duClient: duClient, ouvertesDuClient: ouvertesDuClient, ouvertes: ouvertes, enRetard: enRetard,
    gestionnaires: gestionnaires, directeur: directeur, destinataires: destinataires, listeNoms: listeNoms, libelle: libelle, reference: reference
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.reclamations = api; }
})(typeof window !== "undefined" ? window : null);
