/* GS Banque & Assurance – alertes du poste du conseiller : appels entrants et clients au distributeur (règles de l'exercice, sans écran ; l'affichage est dans app_appels.js).
   Un appel arrive sur le poste du conseiller à intervalles aléatoires : il sonne (30 secondes par défaut), puis il est décroché, refusé (raccroché sans avoir décroché)
   ou manqué. Le conseiller peut se mettre « indisponible » : plus aucun appel n'arrive tant qu'il n'est pas redevenu disponible.
   L'appelant est un client du portefeuille (680 clients) ou, de temps en temps, un appelant non client (numéro hors portefeuille).
   Simulations d'appels (scénarios de l'enseignant, voir scenarios_appels.js) : un appel programmé sonne cinq secondes plus tard avec le client voulu ; il ne sonne pas si le conseiller est indisponible.
   Aucun réglage à faire pour l'enseignant : les valeurs ci-dessous sont celles de l'exercice. Elles ne sont modifiables que par programme (window.SGBF_APPELS, utilisé par les essais) :
   actif, delaiMin et delaiMax (secondes entre deux appels : 120 à 360), sonnerie (30 secondes), partNonClient (15 %), horaires (appels et clients au distributeur seulement aux heures d'ouverture de l'agence : oui ; « false » les envoie à toute heure),
   son (sonnerie de téléphone : oui) et volume (50 sur 100), dab (clients au distributeur : oui), dabMin et dabMax (secondes entre deux clients au distributeur : 90 à 300) et repondeur (répondeur IA : oui).
   Le flux est celui d'une agence qui vit : en moyenne un appel toutes les quatre minutes et un client au distributeur toutes les trois minutes et demie, aux heures d'ouverture.

   Répondeur IA : un appel manqué (la sonnerie s'arrête sans que le conseiller décroche) ou refusé (il raccroche ou se met indisponible pendant la sonnerie) bascule sur le répondeur. L'appelant laisse un message, que le répondeur retranscrit à l'écrit
   (texte fictif fabriqué ici d'après le dossier du client : carte, rendez-vous, virement, épargne, prêt, assurance, découvert, coordonnées, fraude ; un appelant non client demande des renseignements). 50 messages au plus sont gardés ;
   un message est « non lu » tant que le conseiller n'a pas ouvert le répondeur, puis « traité » quand il l'a rappelé. Les appels des simulations de l'enseignant ne laissent pas de message.

   Client au distributeur (DAB/GAB) : un client du portefeuille utilise le distributeur de l'agence ; une fenêtre indique son nom et ce qu'il fait (retrait, consultation du solde, remise de chèque) ou le problème qu'il rencontre
   (retrait refusé, carte avalée). Le conseiller peut aller l'accueillir ou ignorer l'alerte ; le client repart au bout d'une à trois minutes. Le client est tiré parmi les 680 ; son solde est celui de son compte courant.
   Conventions de l'exercice (aucune règle officielle) : les plafonds de retrait de la carte (par 7 jours) sont ceux des fiches produits (operations_service.js) ; un retrait est refusé si le montant demandé dépasse le solde ou ce plafond ;
   la carte est avalée après trois codes confidentiels erronés ; un client déjà vu parmi les 15 derniers n'est pas rappelé tout de suite.
   Conventions de l'exercice (aucune règle officielle) : 100 appels au plus gardés dans le journal ; un client déjà appelé parmi les 15 derniers appels n'est pas rappelé tout de suite ;
   les numéros des appelants non clients sont dans la plage 06 39 98 90 00 à 06 39 98 99 99, réservée par l'Arcep aux fictions (comme les numéros des clients). */
(function (root) {
  "use strict";

  var CLE = "sgbf-appels-v1";
  var MAX_JOURNAL = 100, RECENTS = 15, PERIME = 120000, MAX_MESSAGES = 50;
  var ISSUES = { pris: "Pris", refuse: "Refusé", manque: "Manqué" };
  /* Sécuriser l'appel : à la prise d'appel d'un client, le conseiller pose des questions dont la réponse figure au dossier ; trois réponses exactes au moins identifient l'appelant.
     (Convention de l'exercice : aucune règle officielle. Les clés sont celles de operations_service.js : l'opposition de carte reprend l'identification faite pendant l'appel ; un test compare les deux listes.) */
  var SECU_MIN = 3;
  var QUESTIONS = [
    { k: "naissance", q: "Quelle est votre date de naissance ?", lib: "Date de naissance" },
    { k: "adresse", q: "Quelle est votre adresse ?", lib: "Adresse postale complète" },
    { k: "paiement", q: "Quel est votre dernier paiement par carte (commerçant, montant, date) ?", lib: "Dernier paiement par carte (commerçant, montant et date)" },
    { k: "numero", q: "Quel est votre numéro de client ?", lib: "Numéro de client" },
    { k: "mail", q: "Quelle est l'adresse e-mail que vous nous avez donnée ?", lib: "Adresse e-mail du dossier" },
    { k: "profession", q: "Quelle est votre profession ?", lib: "Profession déclarée à la banque" }
  ];
  var CLES_SECU = QUESTIONS.map(function (q) { return q.k; });

  function num(v, d, mini, maxi) { var n = Number(v); if (v === null || v === "" || !isFinite(n)) return d; return Math.min(maxi, Math.max(mini, n)); }
  function reglages(conf) {
    conf = conf && typeof conf === "object" ? conf : {};
    var r = {
      actif: conf.actif !== false,
      delaiMin: num(conf.delaiMin, 120, 5, 86400),
      delaiMax: num(conf.delaiMax, 360, 5, 86400),
      sonnerie: num(conf.sonnerie, 30, 5, 120),
      partNonClient: num(conf.partNonClient, 15, 0, 100),
      horaires: conf.horaires !== false,
      son: conf.son !== false,
      volume: num(conf.volume, 50, 0, 100),
      dab: conf.dab !== false,
      dabMin: num(conf.dabMin, 90, 5, 86400),
      dabMax: num(conf.dabMax, 300, 5, 86400),
      repondeur: conf.repondeur !== false
    };
    if (r.delaiMax < r.delaiMin) r.delaiMax = r.delaiMin;
    if (r.dabMax < r.dabMin) r.dabMax = r.dabMin;
    return r;
  }

  function dabNeuf() { return { prochain: null, courant: null, journal: [], seq: 0, vu: 0 }; }
  function repNeuf() { return { messages: [], seq: 0, vu: 0 }; }
  function neuf() { return { v: 1, dispo: true, son: true, prochain: null, lance: null, courant: null, journal: [], seq: 0, vu: 0, dab: dabNeuf(), rep: repNeuf() }; }
  function texte(x, max) { return typeof x === "string" ? x.replace(/[\u0000-\u001F\u007F]/g, "").slice(0, max) : ""; }
  function entier(x, d) { return typeof x === "number" && isFinite(x) ? Math.round(x) : d; }
  /* Remet en forme un état relu du navigateur (peut avoir été modifié ou abîmé) : ce qui n'est pas valable est écarté. */
  function secuValide(l) { var r = []; (Array.isArray(l) ? l : []).forEach(function (k) { if (CLES_SECU.indexOf(k) >= 0 && r.indexOf(k) < 0) r.push(k); }); return r; }
  function appel(a) {
    if (!a || typeof a !== "object") return null;
    var ok = a.etat === "sonne" || a.etat === "en_cours";
    if (!ok || typeof a.debut !== "number" || !isFinite(a.debut)) return null;
    return { id: entier(a.id, 0), c: typeof a.c === "number" && a.c > 0 ? Math.round(a.c) : null, nom: texte(a.nom, 80), tel: texte(a.tel, 20), etat: a.etat, debut: a.debut,
      decroche: a.etat === "en_cours" && typeof a.decroche === "number" && isFinite(a.decroche) ? a.decroche : (a.etat === "en_cours" ? a.debut : null), quand: texte(a.quand, 20), sc: texte(a.sc, 60),
      secu: typeof a.c === "number" && a.c > 0 && a.etat === "en_cours" ? secuValide(a.secu) : [] };
  }
  var GENRES = { retrait: "Retrait", solde: "Consultation du solde", cheque: "Remise de chèque", refus: "Retrait refusé", avalee: "Carte avalée" };
  var ISSUES_DAB = { accueilli: "Accueilli", ignore: "Ignoré", parti: "Parti sans être accueilli" };
  function dabEvenement(a) {
    if (!a || typeof a !== "object" || !GENRES[a.genre] || typeof a.debut !== "number" || !isFinite(a.debut) || typeof a.depart !== "number" || !isFinite(a.depart)) return null;
    return { id: entier(a.id, 0), c: typeof a.c === "number" && a.c > 0 ? Math.round(a.c) : null, nom: texte(a.nom, 80), genre: a.genre, detail: texte(a.detail, 160),
      solde: typeof a.solde === "number" && isFinite(a.solde) ? a.solde : null, probleme: a.genre === "refus" || a.genre === "avalee", debut: a.debut, depart: a.depart, quand: texte(a.quand, 20) };
  }
  function dabValider(d) {
    var e = dabNeuf();
    if (!d || typeof d !== "object") return e;
    e.prochain = typeof d.prochain === "number" && isFinite(d.prochain) ? d.prochain : null;
    e.seq = Math.max(0, entier(d.seq, 0)); e.vu = Math.max(0, entier(d.vu, 0));
    e.courant = dabEvenement(d.courant);
    e.journal = (Array.isArray(d.journal) ? d.journal : []).filter(function (j) { return j && typeof j === "object" && ISSUES_DAB[j.issue] && GENRES[j.genre]; }).slice(-MAX_JOURNAL).map(function (j) {
      return { id: entier(j.id, 0), c: typeof j.c === "number" && j.c > 0 ? Math.round(j.c) : null, nom: texte(j.nom, 80), genre: j.genre, detail: texte(j.detail, 160), issue: j.issue, quand: texte(j.quand, 20) };
    });
    e.seq = Math.max(e.seq, e.journal.reduce(function (m, j) { return Math.max(m, j.id); }, 0), e.courant ? e.courant.id : 0);
    return e;
  }
  /* Appel programmé depuis la fenêtre « Simulations d'appels » : il sonnera à l'heure « at » (c : numéro du client, 0 pour un appelant non client). */
  function lanceValide(l) {
    if (!l || typeof l !== "object" || typeof l.at !== "number" || !isFinite(l.at) || typeof l.c !== "number" || !isFinite(l.c) || l.c < 0) return null;
    return { at: l.at, c: Math.round(l.c), sc: texte(l.sc, 60), tel: texte(l.tel, 20) };
  }
  function valider(s) {
    var e = neuf();
    if (!s || typeof s !== "object" || s.v !== 1) return e;
    e.dispo = s.dispo !== false;
    e.son = s.son !== false;
    e.prochain = typeof s.prochain === "number" && isFinite(s.prochain) ? s.prochain : null;
    e.seq = Math.max(0, entier(s.seq, 0)); e.vu = Math.max(0, entier(s.vu, 0));
    e.courant = appel(s.courant);
    e.lance = lanceValide(s.lance);
    e.journal = (Array.isArray(s.journal) ? s.journal : []).filter(function (j) { return j && typeof j === "object" && ISSUES[j.issue]; }).slice(-MAX_JOURNAL).map(function (j) {
      return { id: entier(j.id, 0), c: typeof j.c === "number" && j.c > 0 ? Math.round(j.c) : null, nom: texte(j.nom, 80), tel: texte(j.tel, 20), issue: j.issue, duree: Math.max(0, entier(j.duree, 0)), quand: texte(j.quand, 20), sc: texte(j.sc, 60), ident: j.ident === "oui" || j.ident === "non" ? j.ident : "" };
    });
    e.seq = Math.max(e.seq, e.journal.reduce(function (m, j) { return Math.max(m, j.id); }, 0), e.courant ? e.courant.id : 0);
    if (e.courant && !e.dispo && e.courant.etat === "sonne") e.courant = null;
    if (!e.dispo) e.lance = null;
    e.dab = dabValider(s.dab);
    if (!e.dispo) e.dab.courant = null;
    e.rep = repValider(s.rep);
    return e;
  }

  /* ---------- répondeur IA : le message du client, retranscrit à l'écrit ---------- */
  var CAUSES = { manque: "Appel manqué", refuse: "Appel refusé" };
  /* Thèmes des messages : poids relatif, urgence (fraude, carte bloquée) et variantes de la demande. « nom » reçoit les coordonnées du client quand elles sont connues. */
  var THEMES_REP = [
    { k: "rdv", lib: "Rendez-vous", poids: 18, corps: ["j'aimerais prendre rendez-vous avec vous pour faire le point sur ma situation, plutôt en fin de journée si c'est possible", "je voudrais un rendez-vous à l'agence pour parler de mes projets et de mon épargne", "pouvez-vous me proposer un créneau cette semaine ? Je souhaite revoir mes comptes avec vous"] },
    { k: "carte", lib: "Carte bancaire", poids: 14, corps: ["ma carte bancaire a été refusée ce matin chez un commerçant alors que mon compte est approvisionné, pouvez-vous regarder ce qui se passe", "je n'arrive plus à retirer de l'argent avec ma carte, le distributeur me la refuse", "je voudrais relever le plafond de ma carte pour un achat important la semaine prochaine"] },
    { k: "virement", lib: "Virement", poids: 12, corps: ["j'ai fait un virement hier et le bénéficiaire ne l'a pas encore reçu, pouvez-vous me dire où il en est", "je voudrais faire un virement important et je ne sais pas si mon plafond le permet", "je dois régler une facture à l'étranger, quelles sont les modalités et les frais pour un virement"] },
    { k: "epargne", lib: "Épargne", poids: 12, corps: ["je voudrais placer une somme qui dort sur mon compte, que me conseillez-vous", "j'aimerais savoir où en est mon livret A et s'il me reste de la place avant le plafond", "je viens de recevoir un héritage et je souhaite savoir comment le placer"] },
    { k: "pret", lib: "Projet de prêt", poids: 10, corps: ["j'ai un projet d'achat immobilier et je voudrais savoir quelles sont mes possibilités d'emprunt", "je souhaite renégocier mon prêt en cours car j'ai vu que les taux avaient baissé", "je voudrais un crédit pour financer des travaux, pouvez-vous me rappeler pour m'expliquer ce qui est possible"] },
    { k: "decouvert", lib: "Compte à découvert", poids: 8, corps: ["j'ai reçu un message m'indiquant que mon compte est à découvert, pouvez-vous me rappeler pour que nous trouvions une solution", "mon salaire a du retard et je crains un rejet de prélèvement, pouvez-vous m'aider"] },
    { k: "assurance", lib: "Assurance", poids: 8, corps: ["j'ai eu un sinistre à mon domicile et je voudrais savoir comment le déclarer", "je voudrais résilier un contrat d'assurance et comprendre les démarches", "pouvez-vous me rappeler au sujet de mon assurance habitation, je voudrais revoir mes garanties"] },
    { k: "coordonnees", lib: "Coordonnées", poids: 7, corps: ["j'ai changé d'adresse et je voudrais mettre mon dossier à jour", "je souhaite modifier mon numéro de téléphone et mon adresse e-mail dans votre base", "j'ai besoin d'un RIB et d'une attestation de domiciliation, pouvez-vous me les envoyer"] },
    { k: "fraude", lib: "Fraude possible", urgent: true, poids: 6, corps: ["j'ai vu sur mon compte un paiement que je ne reconnais pas, je pense que ma carte a été piratée, rappelez-moi vite", "j'ai reçu un SMS qui prétend venir de la banque et j'ai peur d'avoir donné des informations, pouvez-vous me rappeler dès que possible"] },
    { k: "carte_perdue", lib: "Carte perdue ou volée", urgent: true, poids: 5, corps: ["je ne retrouve plus ma carte bancaire, je crois me l'être fait voler, il faut la bloquer rapidement", "ma carte a été avalée hier soir par un distributeur et j'en ai besoin, que dois-je faire"] }
  ];
  var THEMES_NC = [
    { k: "info", lib: "Renseignements", poids: 1, corps: ["je ne suis pas encore client chez vous et je voudrais des renseignements pour ouvrir un compte", "je suis de passage dans votre quartier et je souhaiterais savoir si vous pouvez m'accueillir pour un projet de prêt immobilier", "on m'a recommandé votre agence, j'aimerais connaître vos offres pour les jeunes actifs"] }
  ];
  var DEBUTS = ["Bonjour, c'est ", "Bonjour, ici ", "Bonjour, je suis "];
  var FINS = ["Rappelez-moi au ", "Vous pouvez me joindre au ", "Je suis joignable au "];
  var SALUTS = ["Merci, bonne journée.", "Merci beaucoup, à bientôt.", "Je vous remercie, au revoir."];
  function choix(l, rng) { return l[Math.min(l.length - 1, Math.floor(rng() * l.length))]; }
  function themeTire(themes, rng) {
    var tot = themes.reduce(function (n, t) { return n + t.poids; }, 0), x = rng() * tot;
    for (var i = 0; i < themes.length; i++) { x -= themes[i].poids; if (x < 0) return themes[i]; }
    return themes[themes.length - 1];
  }
  /* Le texte que le répondeur a retranscrit. c : le client (ou null pour un appelant non client). Renvoie { theme, lib, urgent, texte, duree }. */
  function messageRepondeur(c, tel, rng) {
    var t = themeTire(c ? THEMES_REP : THEMES_NC, rng), corps = choix(t.corps, rng), nom = c ? [c.prenom, String(c.nom || "").toUpperCase()].filter(Boolean).join(" ") : "";
    var texte = (c ? choix(DEBUTS, rng) + nom + ". " : "Bonjour. ") + corps.charAt(0).toUpperCase() + corps.slice(1) + (/(pouvez-vous [^,]*|que dois-je faire|que me conseillez-vous|quelles sont les modalités et les frais pour un virement)$/.test(corps) ? " ?" : ".") + " " + choix(FINS, rng) + tel + ". " + choix(SALUTS, rng);
    var mots = texte.split(/\s+/).length;
    return { theme: t.k, lib: t.lib, urgent: !!t.urgent, texte: texte, duree: Math.max(8, Math.round(mots / 2.4)) };
  }
  function repValider(r) {
    var e = repNeuf();
    if (!r || typeof r !== "object") return e;
    e.seq = Math.max(0, entier(r.seq, 0)); e.vu = Math.max(0, entier(r.vu, 0));
    e.messages = (Array.isArray(r.messages) ? r.messages : []).filter(function (m) { return m && typeof m === "object" && CAUSES[m.cause] && typeof m.texte === "string" && m.texte; }).slice(-MAX_MESSAGES).map(function (m) {
      return { id: entier(m.id, 0), c: typeof m.c === "number" && m.c > 0 ? Math.round(m.c) : null, nom: texte(m.nom, 80), tel: texte(m.tel, 20), cause: m.cause, quand: texte(m.quand, 20), theme: texte(m.theme, 20), lib: texte(m.lib, 40),
        urgent: !!m.urgent, texte: texte(m.texte, 600), duree: Math.max(1, entier(m.duree, 10)), traite: !!m.traite };
    });
    e.seq = Math.max(e.seq, e.messages.reduce(function (n, m) { return Math.max(n, m.id); }, 0));
    return e;
  }
  /* L'appel a basculé sur le répondeur : le message retranscrit est déposé (sauf pour un appel de simulation de l'enseignant). */
  function deposer(st, a, cause, ctx) {
    if (!ctx || !ctx.reg || !ctx.reg.repondeur || !a || a.sc || !CAUSES[cause]) return false;
    var c = a.c && Array.isArray(ctx.clients) ? ctx.clients.filter(function (x) { return x.id === a.c; })[0] : null;
    var m = messageRepondeur(c || null, a.tel, ctx.rng);
    st.rep.seq += 1;
    st.rep.messages.push({ id: st.rep.seq, c: a.c, nom: a.nom, tel: a.tel, cause: cause, quand: a.quand, theme: m.theme, lib: m.lib, urgent: m.urgent, texte: m.texte, duree: m.duree, traite: false });
    if (st.rep.messages.length > MAX_MESSAGES) st.rep.messages = st.rep.messages.slice(-MAX_MESSAGES);
    return true;
  }
  function repResume(st) {
    var r = { total: st.rep.messages.length, nonLus: 0, traites: 0, urgents: 0 };
    st.rep.messages.forEach(function (m) { if (m.id > st.rep.vu && !m.traite) r.nonLus++; if (m.traite) r.traites++; if (m.urgent && !m.traite) r.urgents++; });
    return r;
  }
  /* Le conseiller a ouvert le répondeur : tous les messages sont « lus ». */
  function repLire(st) { if (st.rep.vu === st.rep.seq) return false; st.rep.vu = st.rep.seq; return true; }
  function repTraiter(st, id, traite) {
    var m = st.rep.messages.filter(function (x) { return x.id === id; })[0];
    if (!m) return false;
    traite = traite !== false;
    if (m.traite === traite) return false;
    m.traite = traite;
    return true;
  }
  function repSupprimer(st, id) {
    var n = st.rep.messages.length;
    st.rep.messages = st.rep.messages.filter(function (x) { return x.id !== id; });
    return st.rep.messages.length < n;
  }

  function zero(n, l) { var s = String(n); while (s.length < l) s = "0" + s; return s; }
  function nomAffiche(c) { return [c.civ, c.prenom, String(c.nom || "").toUpperCase()].filter(Boolean).join(" "); }
  function telClient(c) { return String(c.mob || c.tel || ""); }

  /* Choisit l'appelant. rng() renvoie un nombre dans [0 ; 1[. */
  function tirerAppelant(clients, st, rng, reg) {
    var liste = Array.isArray(clients) ? clients : [];
    if (!liste.length || rng() * 100 < reg.partNonClient) {
      var n = 9000 + Math.floor(rng() * 1000), s = zero(n, 4);
      return { c: null, nom: "Appelant non client", tel: "06 39 98 " + s.slice(0, 2) + " " + s.slice(2) };
    }
    var recents = {};
    st.journal.slice(-RECENTS).forEach(function (j) { if (j.c) recents[j.c] = true; });
    var c = null, i = 0;
    for (var essai = 0; essai < 60; essai++) {
      i = Math.min(liste.length - 1, Math.floor(rng() * liste.length));
      c = liste[i];
      if (!recents[c.id]) break;
    }
    return { c: c.id, nom: nomAffiche(c), tel: telClient(c) };
  }

  /* Heures d'ouverture : ctx.ouvre(ms) renvoie le premier instant, à partir de ms, où l'agence est ouverte (ms lui-même si elle l'est). Hors des heures d'ouverture (nuit, pause de midi, dimanche, lundi, jours fériés),
     aucun appel ni aucun client au distributeur n'arrive : le prochain événement est tiré à partir de la réouverture. Sans ctx.ouvre, aucune contrainte. */
  function dans(reg, ctx) { return reg.horaires && ctx && typeof ctx.ouvre === "function" ? ctx.ouvre : null; }
  /* Instant du prochain événement : le délai tiré, à partir de maintenant si l'agence est ouverte (ou de sa réouverture si elle est fermée) ; si ce délai tombe après la fermeture, il est repris à partir de la réouverture
     (pas de sonnerie à 9 h pile, ni de client collé à la fermeture). */
  function aPartirDe(ouvre, nowMs, delaiMs) {
    if (!ouvre) return nowMs + delaiMs;
    var cible = ouvre(nowMs) + delaiMs, o = ouvre(cible);
    return o === cible ? cible : ouvre(o + delaiMs);
  }
  function fermeA(reg, ctx, ms) { var o = dans(reg, ctx); return !!o && o(ms) !== ms; }
  function planifier(st, nowMs, rng, reg, ctx) { st.prochain = aPartirDe(dans(reg, ctx), nowMs, Math.round(1000 * (reg.delaiMin + rng() * (reg.delaiMax - reg.delaiMin)))); return st; }

  function terminer(st, nowMs, issue, ctx) {
    var a = st.courant;
    if (!a) return false;
    st.seq += 1;
    st.journal.push({ id: st.seq, c: a.c, nom: a.nom, tel: a.tel, issue: issue, duree: issue === "pris" && a.decroche ? Math.max(0, Math.round((nowMs - a.decroche) / 1000)) : 0, quand: a.quand, sc: a.sc || "",
      ident: issue === "pris" && a.c ? (secuNb(a) >= SECU_MIN ? "oui" : "non") : "" });
    if (st.journal.length > MAX_JOURNAL) st.journal = st.journal.slice(-MAX_JOURNAL);
    if (issue === "manque" || issue === "refuse") deposer(st, a, issue, ctx);
    st.courant = null;
    if (st.dispo) planifier(st, nowMs, ctx.rng, ctx.reg, ctx); else st.prochain = null;
    return true;
  }

  /* Fait avancer l'horloge des appels. ctx : { rng, reg, clients, ouvert, quand }.
     Renvoie { changed, evt } ; evt vaut « sonne » (un appel arrive), « manque » (la sonnerie s'est arrêtée) ou « clients » (la liste des clients doit d'abord être chargée). */
  function avancer(st, nowMs, ctx) {
    var reg = ctx.reg;
    if (!reg.actif) return { changed: false, evt: null };
    if (st.lance) {
      if (!st.dispo) { st.lance = null; return { changed: true, evt: null }; }
      if (nowMs >= st.lance.at) {
        if (st.courant) { st.lance.at = nowMs + 10000; return { changed: true, evt: null }; }
        if (st.lance.c && !Array.isArray(ctx.clients)) return { changed: false, evt: "clients" };
        var l = st.lance; st.lance = null;
        return sonner(st, nowMs, ctx, l.c, { titre: l.sc, tel: l.tel });
      }
    }
    var a = st.courant;
    if (a) {
      if (a.etat === "sonne" && nowMs - a.debut >= reg.sonnerie * 1000) { terminer(st, nowMs, "manque", ctx); return { changed: true, evt: "manque" }; }
      return { changed: false, evt: null };
    }
    if (!st.dispo) {
      if (st.prochain !== null) { st.prochain = null; return { changed: true, evt: null }; }
      return { changed: false, evt: null };
    }
    if (st.prochain === null || nowMs - st.prochain > PERIME) { planifier(st, nowMs, ctx.rng, reg, ctx); return { changed: true, evt: null }; }
    if (nowMs < st.prochain) return { changed: false, evt: null };
    if (fermeA(reg, ctx, nowMs)) { planifier(st, nowMs, ctx.rng, reg, ctx); return { changed: true, evt: null }; }   /* l'agence a fermé entre-temps : le prochain appel est tiré à partir de la réouverture */
    if (!Array.isArray(ctx.clients)) return { changed: false, evt: "clients" };
    return sonner(st, nowMs, ctx, null);
  }

  /* Fait sonner un appel tout de suite (appelant tiré au sort, ou le client dont on donne le numéro d'identifiant ; 0 pour un non-client). Sans effet si le conseiller est indisponible ou déjà en ligne. */
  function sonner(st, nowMs, ctx, idClient, scen) {
    if (st.courant || !st.dispo || !ctx.reg.actif) return { changed: false, evt: null };
    var qui;
    if (idClient === 0) qui = tirerAppelant([], st, ctx.rng, ctx.reg);
    else if (idClient) {
      var c = (ctx.clients || []).filter(function (x) { return x.id === idClient; })[0];
      qui = c ? { c: c.id, nom: nomAffiche(c), tel: telClient(c) } : tirerAppelant(ctx.clients, st, ctx.rng, ctx.reg);
    } else qui = tirerAppelant(ctx.clients, st, ctx.rng, ctx.reg);
    if (scen && scen.tel && !qui.c) qui.tel = texte(scen.tel, 20);
    st.seq += 1;
    st.courant = { id: st.seq, c: qui.c, nom: qui.nom, tel: qui.tel, etat: "sonne", debut: nowMs, decroche: null, quand: texte(ctx.quand, 20), sc: scen ? texte(scen.titre, 60) : "", secu: [] };
    st.prochain = null;
    return { changed: true, evt: "sonne" };
  }
  /* Programme un appel de simulation (fenêtre « Simulations d'appels ») : il sonnera dans quelques secondes, le temps de refermer la fenêtre. Refusé si le conseiller est indisponible ou déjà en ligne. */
  var DELAI_LANCEMENT = 5000;
  function programmer(st, nowMs, idClient, scen) {
    if (!st.dispo || st.courant || st.lance || typeof idClient !== "number" || idClient < 0) return false;
    st.lance = { at: nowMs + DELAI_LANCEMENT, c: Math.round(idClient), sc: texte(scen && scen.titre, 60), tel: texte(scen && scen.tel, 20) };
    return true;
  }
  function annulerLance(st) { if (!st.lance) return false; st.lance = null; return true; }

  function decrocher(st, nowMs) {
    if (!st.courant || st.courant.etat !== "sonne") return false;
    st.courant.etat = "en_cours"; st.courant.decroche = nowMs;
    return true;
  }
  /* ---------- sécuriser l'appel ---------- */
  function secuNb(a) { return a && Array.isArray(a.secu) ? a.secu.length : 0; }
  function identifie(a) { return secuNb(a) >= SECU_MIN; }
  /* Coche ou décoche une réponse exacte (appel d'un client, décroché). */
  function secuBasculer(st, cle, valeur) {
    var a = st.courant;
    if (!a || a.etat !== "en_cours" || !a.c || CLES_SECU.indexOf(cle) < 0) return false;
    var i = a.secu.indexOf(cle), voulu = typeof valeur === "boolean" ? valeur : i < 0;
    if (voulu && i < 0) { a.secu.push(cle); return true; }
    if (!voulu && i >= 0) { a.secu.splice(i, 1); return true; }
    return false;
  }
  function naissanceTxt(c, auj) {
    var mois = c.nai[0], jour = c.nai[1], y = auj.getFullYear() - c.age; /* c.nai = [mois, jour], comme dans synthese.js */
    if (mois > auj.getMonth() + 1 || (mois === auj.getMonth() + 1 && jour > auj.getDate())) y -= 1;
    return zero(jour, 2) + "/" + zero(mois, 2) + "/" + y;
  }
  function jmy(ymd) { return ymd.slice(8, 10) + "/" + ymd.slice(5, 7) + "/" + ymd.slice(0, 4); }
  /* Dernier paiement par carte parmi les lignes du relevé (ou null). */
  function dernierPaiementCarte(lignes) {
    var l = (Array.isArray(lignes) ? lignes : []).filter(function (x) { return x.kind === "carte" && x.m < 0; });
    return l.length ? l[l.length - 1] : null;
  }
  function paiementTxt(x) { return x ? x.lib.replace(/^Paiement carte – /, "") + " – " + eurTxt(-x.m) + " – " + jmy(x.ymd) : ""; }
  /* Les questions de sécurité d'un client avec la réponse du dossier : [{ k, q, rep }]. ctx : { auj, lignes(client) }. Une question sans réponse au dossier n'est pas posée. */
  function questionsSecurite(c, ctx) {
    var auj = ctx && ctx.auj instanceof Date ? ctx.auj : new Date(), rep = {}, lg = [];
    try { lg = ctx && typeof ctx.lignes === "function" ? (ctx.lignes(c) || []) : []; } catch (e) { lg = []; }
    try { rep.naissance = naissanceTxt(c, auj); } catch (e1) { /* pas de date de naissance */ }
    try { rep.adresse = c.adr.rue + ", " + c.adr.cp + " " + c.adr.ville; } catch (e2) { /* pas d'adresse */ }
    rep.paiement = paiementTxt(dernierPaiementCarte(lg));
    rep.numero = c.num ? String(c.num) : "";
    rep.mail = c.mail ? String(c.mail) : "";
    rep.profession = c.pro && c.pro.prof ? String(c.pro.prof) : "";
    return QUESTIONS.filter(function (q) { return rep[q.k]; }).map(function (q) { return { k: q.k, q: q.q, lib: q.lib, rep: rep[q.k] }; });
  }

  /* Raccrocher : sans avoir décroché, l'appel est « refusé » ; après avoir décroché, il est « pris » (avec sa durée). */
  function raccrocher(st, nowMs, ctx) {
    if (!st.courant) return false;
    return terminer(st, nowMs, st.courant.etat === "sonne" ? "refuse" : "pris", ctx);
  }
  /* Disponible / indisponible. Un appel qui sonne est refusé ; un appel en cours continue jusqu'à ce que le conseiller raccroche. */
  function basculer(st, dispo, nowMs, ctx) {
    dispo = !!dispo;
    if (st.dispo === dispo) return false;
    st.dispo = dispo;
    if (!dispo) {
      if (st.courant && st.courant.etat === "sonne") terminer(st, nowMs, "refuse", ctx);
      st.prochain = null; st.lance = null;
      if (st.dab.courant) dabTerminer(st, nowMs, "ignore", ctx);
      st.dab.prochain = null;
    } else {
      if (!st.courant) planifier(st, nowMs, ctx.rng, ctx.reg, ctx);
      dabPlanifier(st, nowMs, ctx.rng, ctx.reg, ctx);
    }
    return true;
  }

  /* ---------- client au distributeur (DAB/GAB) ---------- */
  var PLAFOND_RETRAIT = { VJEU: 300, VCLA: 500, VPRE: 1000, PLAT: 2000, WELI: 3000, VELE: 500, CRET: 500 };   /* par 7 jours ; mêmes valeurs que PLAFONDS_CARTE de operations_service.js (un test le vérifie) */
  var MONTANTS = [20, 30, 40, 50, 60, 80, 100, 150, 200, 300];
  var PRESENCE = { retrait: [50, 70], solde: [25, 40], cheque: [60, 90], refus: [90, 120], avalee: [120, 180] };   /* secondes passées au distributeur */
  function eurTxt(n) { var s = (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, "").replace(".", ","); return s.replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f") + "\u00a0€"; }
  function plafondDe(c) { var p = c && c.cartes && c.cartes[0] && c.cartes[0].p; return PLAFOND_RETRAIT[p] || 500; }
  function dabPlanifier(st, nowMs, rng, reg, ctx) { st.dab.prochain = reg.dab ? aPartirDe(dans(reg, ctx), nowMs, Math.round(1000 * (reg.dabMin + rng() * (reg.dabMax - reg.dabMin)))) : null; return st; }

  /* Tire le client et ce qu'il fait. ctx.solde(client) renvoie le solde du compte courant (ou null s'il est inconnu : le client ne fait alors rien qui dépende du solde). */
  function dabTirer(clients, st, rng, ctx) {
    var r = rng() * 100, genre = r < 48 ? "retrait" : r < 70 ? "solde" : r < 84 ? "cheque" : r < 94 ? "refus" : "avalee";
    var recents = {};
    st.dab.journal.slice(-RECENTS).forEach(function (j) { if (j.c) recents[j.c] = true; });
    st.journal.slice(-RECENTS).forEach(function (j) { if (j.c) recents[j.c] = true; });
    var c = null;
    for (var essai = 0; essai < 60; essai++) {
      c = clients[Math.min(clients.length - 1, Math.floor(rng() * clients.length))];
      if (!recents[c.id]) break;
    }
    var solde = typeof ctx.solde === "function" ? ctx.solde(c) : null;
    if (typeof solde !== "number" || !isFinite(solde)) solde = null;
    var plafond = plafondDe(c), detail = "";
    if (solde === null && (genre === "retrait" || genre === "refus")) genre = "solde";
    if (genre === "retrait") {
      var ok = MONTANTS.filter(function (m) { return m <= solde && m <= plafond; });
      if (!ok.length) genre = "solde";
      else { var m = ok[Math.min(ok.length - 1, Math.floor(rng() * ok.length))]; detail = "Retrait de " + eurTxt(m) + " en cours"; }
    }
    if (genre === "refus") {
      var plus = MONTANTS.filter(function (m) { return m > solde && m <= plafond; });
      if (solde >= 0 && solde < plafond && plus.length) detail = "Retrait de " + eurTxt(plus[0]) + " refusé : solde insuffisant";
      else detail = "Retrait de " + eurTxt(plafond + (rng() < 0.5 ? 100 : 200)) + " refusé : plafond de retrait de la carte dépassé (" + eurTxt(plafond) + " par 7 jours)";
    }
    if (genre === "solde") detail = "Consultation du solde";
    if (genre === "cheque") detail = "Remise de chèque : dépôt en cours";
    if (genre === "avalee") detail = "Carte avalée par le distributeur : code confidentiel erroné trois fois";
    var pr = PRESENCE[genre], duree = pr[0] + Math.round(rng() * (pr[1] - pr[0]));
    return { c: c.id, nom: nomAffiche(c), genre: genre, detail: detail, solde: solde, probleme: genre === "refus" || genre === "avalee", duree: duree };
  }
  function dabArriver(st, nowMs, ctx, idClient, genreVoulu) {
    if (st.dab.courant || !st.dispo || !ctx.reg.dab) return { changed: false, evt: null };
    var qui;
    if (idClient) {
      var c = (ctx.clients || []).filter(function (x) { return x.id === idClient; })[0];
      if (c) {
        var forcer = ctx.rng, genres = ["retrait", "solde", "cheque", "refus", "avalee"], i = genres.indexOf(genreVoulu);
        var seuil = i < 0 ? null : [24, 59, 77, 89, 97][i];
        var rngF = seuil === null ? forcer : (function () { var n = 0; return function () { n++; return n === 1 ? seuil / 100 : forcer(); }; })();
        qui = dabTirer([c], st, rngF, ctx);
      }
    }
    if (!qui) qui = dabTirer(ctx.clients, st, ctx.rng, ctx);
    st.dab.seq += 1;
    st.dab.courant = { id: st.dab.seq, c: qui.c, nom: qui.nom, genre: qui.genre, detail: qui.detail, solde: qui.solde, probleme: qui.probleme, debut: nowMs, depart: nowMs + qui.duree * 1000, quand: texte(ctx.quand, 20) };
    st.dab.prochain = null;
    return { changed: true, evt: "dab" };
  }
  function dabTerminer(st, nowMs, issue, ctx) {
    var a = st.dab.courant;
    if (!a) return false;
    st.dab.seq += 1;
    st.dab.journal.push({ id: st.dab.seq, c: a.c, nom: a.nom, genre: a.genre, detail: a.detail, issue: issue, quand: a.quand });
    if (st.dab.journal.length > MAX_JOURNAL) st.dab.journal = st.dab.journal.slice(-MAX_JOURNAL);
    st.dab.courant = null;
    if (st.dispo) dabPlanifier(st, nowMs, ctx.rng, ctx.reg, ctx); else st.dab.prochain = null;
    return true;
  }
  /* Fait avancer l'horloge du distributeur (comme avancer pour les appels). evt : « dab » (un client arrive), « parti » (il est reparti sans être accueilli) ou « clients » (liste des clients à charger). */
  function dabAvancer(st, nowMs, ctx) {
    var reg = ctx.reg, d = st.dab;
    if (!reg.actif || !reg.dab) return { changed: false, evt: null };
    if (d.courant) {
      if (nowMs >= d.courant.depart) { dabTerminer(st, nowMs, "parti", ctx); return { changed: true, evt: "parti" }; }
      return { changed: false, evt: null };
    }
    if (!st.dispo) { if (d.prochain !== null) { d.prochain = null; return { changed: true, evt: null }; } return { changed: false, evt: null }; }
    if (d.prochain === null || nowMs - d.prochain > PERIME) { dabPlanifier(st, nowMs, ctx.rng, reg, ctx); return { changed: true, evt: null }; }
    if (nowMs < d.prochain) return { changed: false, evt: null };
    if (fermeA(reg, ctx, nowMs)) { dabPlanifier(st, nowMs, ctx.rng, reg, ctx); return { changed: true, evt: null }; }
    if (st.courant) { d.prochain = nowMs + 20000; return { changed: true, evt: null }; }   /* pas de client au distributeur pendant qu'un appel sonne ou est en cours */
    if (!Array.isArray(ctx.clients) || ctx.donnees === false) return { changed: false, evt: "clients" };
    if (!ctx.clients.length) { d.prochain = nowMs + 60000; return { changed: true, evt: null }; }
    return dabArriver(st, nowMs, ctx, null, null);
  }
  /* Le conseiller va accueillir le client (il reste dans le journal) ; renvoie l'événement pour afficher la suite. */
  function dabAccueillir(st, nowMs, ctx) { var a = st.dab.courant; return a && dabTerminer(st, nowMs, "accueilli", ctx) ? a : null; }
  function dabIgnorer(st, nowMs, ctx) { return dabTerminer(st, nowMs, "ignore", ctx); }
  function dabResume(st) {
    var r = { accueilli: 0, ignore: 0, parti: 0, total: st.dab.journal.length, nonVus: 0 };
    st.dab.journal.forEach(function (j) { r[j.issue]++; if (j.issue === "parti" && j.id > st.dab.vu) r.nonVus++; });
    return r;
  }

  /* Sonnerie du poste activée ou coupée (préférence du conseiller, gardée dans le navigateur). */
  function basculerSon(st, son) { son = !!son; if (st.son === son) return false; st.son = son; return true; }

  function resume(st) {
    var r = { pris: 0, refuse: 0, manque: 0, total: st.journal.length, nonVus: 0 };
    st.journal.forEach(function (j) { r[j.issue]++; if (j.issue === "manque" && j.id > st.vu) r.nonVus++; });
    return r;
  }
  function dureeLib(s) { s = Math.max(0, Math.round(s)); var m = Math.floor(s / 60); return m ? m + " min " + zero(s % 60, 2) + " s" : s + " s"; }
  function minuteur(s) { s = Math.max(0, Math.round(s)); return zero(Math.floor(s / 60), 2) + ":" + zero(s % 60, 2); }

  var api = { PLAFOND_RETRAIT: PLAFOND_RETRAIT, MONTANTS: MONTANTS, GENRES: GENRES, ISSUES_DAB: ISSUES_DAB, eurTxt: eurTxt, plafondDe: plafondDe, dabNeuf: dabNeuf, dabTirer: dabTirer, dabPlanifier: dabPlanifier, dabArriver: dabArriver, dabAvancer: dabAvancer,
    dabAccueillir: dabAccueillir, dabIgnorer: dabIgnorer, dabTerminer: dabTerminer, dabResume: dabResume, CLE: CLE, MAX_JOURNAL: MAX_JOURNAL, RECENTS: RECENTS, PERIME: PERIME, ISSUES: ISSUES, reglages: reglages, neuf: neuf, valider: valider, nomAffiche: nomAffiche, telClient: telClient, tirerAppelant: tirerAppelant,
    planifier: planifier, avancer: avancer, sonner: sonner, programmer: programmer, annulerLance: annulerLance, DELAI_LANCEMENT: DELAI_LANCEMENT, decrocher: decrocher, raccrocher: raccrocher, basculer: basculer, basculerSon: basculerSon, resume: resume, dureeLib: dureeLib, minuteur: minuteur,
    CAUSES: CAUSES, THEMES_REP: THEMES_REP, MAX_MESSAGES: MAX_MESSAGES, messageRepondeur: messageRepondeur, repValider: repValider, deposer: deposer, repResume: repResume, repLire: repLire, repTraiter: repTraiter, repSupprimer: repSupprimer,
    SECU_MIN: SECU_MIN, QUESTIONS: QUESTIONS, secuBasculer: secuBasculer, secuNb: secuNb, identifie: identifie, questionsSecurite: questionsSecurite, naissanceTxt: naissanceTxt, dernierPaiementCarte: dernierPaiementCarte, paiementTxt: paiementTxt, jmy: jmy };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.appels = api; }
})(typeof window !== "undefined" ? window : globalThis);
