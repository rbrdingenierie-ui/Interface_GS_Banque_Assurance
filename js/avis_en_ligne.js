/* GS Banque & Assurance – avis clients en ligne : qualifier un avis laissé sur la page de l'agence (site d'avis ou réseau social), décider de la suite, rédiger la réponse publique et la faire contrôler
   avant publication. Les 24 avis sont dans data_avis.js.
   Règles reprises (textes consultés le 17 novembre 2026) :
     – Secret professionnel : toute personne employée par un établissement de crédit y est tenue (Code monétaire et financier, article L511-33, I) ; la révélation d'une information secrète par une
       personne qui en est dépositaire est punie d'un an d'emprisonnement et de 15 000 € d'amende (Code pénal, article 226-13). Confirmer en public qu'un auteur est client, ou citer un détail de sa
       relation avec la banque, y compris quand l'auteur l'a dit lui-même, est donc interdit : un avis publié sous un prénom ou un pseudonyme ne prouve ni l'identité ni l'accord de la personne.
     – Réclamation : « expression d'un mécontentement envers un professionnel » (recommandation 2022-R-01 de l'ACPR), quel que soit le canal : un grief précis sur ses propres opérations publié sur
       Internet est une réclamation, à enregistrer comme telle (canal « avis ou message public en ligne »).
     – Avis en ligne : toute personne qui collecte, modère ou diffuse des avis doit informer sur les modalités de publication et de traitement, dire si les avis sont contrôlés, afficher leur date,
       expliquer un refus de publication et offrir, gratuitement, un moyen de signaler un doute motivé sur l'authenticité d'un avis (Code de la consommation, article L111-7-2). Sont des pratiques
       commerciales trompeuses en toutes circonstances le fait d'affirmer que des avis sont diffusés par des consommateurs sans avoir vérifié (L121-4, 27°) et de diffuser ou de faire diffuser de
       faux avis (L121-4, 28°) : deux ans d'emprisonnement et 300 000 € d'amende, cinq ans et 750 000 € si la pratique passe par un service en ligne (article L132-2, version en vigueur depuis le
       12 mai 2024). L'agence ne publie donc jamais d'avis sous un faux nom et ne demande pas à ses collaborateurs ou à ses proches d'en publier.
     – Diffamation : « toute allégation ou imputation d'un fait qui porte atteinte à l'honneur ou à la considération » (loi du 29 juillet 1881, article 29 : texte confirmé par une source secondaire,
       la page de Légifrance n'ayant pas pu être lue) ; action publique et civile prescrites au bout de trois mois (article 65, lu sur Légifrance). Une critique de l'accueil ou de l'attente n'est pas
       une diffamation : elle ne justifie pas un signalement pour ce motif.
   Conventions de l'exercice (NON tirées d'un texte, à ne pas présenter comme la loi) : réponse sous deux jours ouvrés ; de 15 à 120 mots, 1 000 signes au plus ; salutation, remerciement, excuses,
   contact et signature attendus selon le type d'avis ; aucun montant ni numéro dans une réponse publique, hors le numéro public de l'agence ; aucune promesse (remboursement, geste commercial) en
   public ; aucun nom de collaborateur ni de client ; pas de publicité dans une réponse ; la directrice est prévenue dès qu'un avis est diffamatoire, menaçant ou met en cause un collaborateur.
   Ce module est pur : il ne touche ni la page ni la sauvegarde, sauf valider() et remettre() qui travaillent sur st.avis (un enregistrement par avis). */
(function (root) {
  "use strict";

  var R0 = root && root.SGBF ? root.SGBF : null;
  function mod(nom, fichier) { return R0 && R0[nom] ? R0[nom] : require("./" + fichier); }
  var B = mod("banque", "banque.js"), CARTE = mod("carte", "carte.js"), DATA = mod("dataAvis", "data_avis.js");
  var AVIS = DATA.AVIS, TEL = CARTE.TEL_AGENCE, MAIL_DOMAINE = CARTE.DOMAINE;

  var CANAUX = { site: "Site d'avis", reseau: "Réseau social" };
  var CONV = { delaiOuvres: 2, motsMin: 15, motsMax: 120, signesMax: 1000, noteMax: 5 };
  /* Le type d'avis, la procédure conseillée par GS (convention) et les suites habituelles. */
  var NATURES = [
    { id: "compliment", lib: "Compliment", sous: "L'auteur remercie ou recommande l'agence.",
      procedure: "Remercier en une ou deux phrases, sans rien révéler de la relation de l'auteur avec la banque. Transmettre le compliment à l'équipe sans nommer le collaborateur en public.", habituelles: ["repondre"] },
    { id: "service", lib: "Remarque sur l'accueil, l'attente, les horaires ou les locaux", sous: "Aucun dossier personnel n'est en jeu : une remarque générale sur l'agence.",
      procedure: "Répondre en public avec des informations publiques (horaires, numéro de l'agence), reconnaître le désagrément, annoncer que la remarque est transmise à la directrice. Si une information publiée est fausse, la corriger.", habituelles: ["repondre"] },
    { id: "reclamation", lib: "Réclamation : un grief sur les opérations ou le contrat de l'auteur", sous: "L'auteur décrit un problème précis sur son propre compte, ses frais, sa carte, son crédit ou un virement.",
      procedure: "Réponse publique courte, sans détail ni confirmation que l'auteur est client, qui propose un contact privé. Identifier l'auteur dans les dossiers, le contacter en privé et enregistrer la réclamation. Prévenir la directrice si le client menace d'aller plus loin.", habituelles: ["repondre", "prive", "reclamation"] },
    { id: "donnees", lib: "Données personnelles publiées", sous: "L'avis contient un IBAN, un numéro de carte ou de téléphone, ou nomme un collaborateur.",
      procedure: "Signaler l'avis à la plateforme pour qu'elle le retire et prévenir la directrice. Si ce sont les données bancaires d'un client, le contacter en privé pour les protéger. Ne jamais reprendre la donnée dans une réponse.", habituelles: ["signaler", "direction"] },
    { id: "faux", lib: "Avis diffamatoire, faux ou sans lien avec l'agence", sous: "L'auteur impute un fait grave sans élément, n'a manifestement jamais été client ou publie pour nuire.",
      procedure: "Ne pas polémiquer. Signaler l'avis à la plateforme en expliquant le doute, puis prévenir la directrice, qui décide d'une suite juridique (la diffamation se prescrit par trois mois).", habituelles: ["signaler", "direction"] },
    { id: "spam", lib: "Publicité, insultes sans contenu ou hors sujet", sous: "Parrainage, promotion d'un concurrent, injures sans information exploitable.",
      procedure: "Signaler l'avis à la plateforme et ne pas répondre : une réponse donnerait de la visibilité au message.", habituelles: ["signaler"] },
    { id: "fraude", lib: "Client victime d'une fraude", sous: "L'auteur dit avoir été victime d'un hameçonnage ou d'un faux conseiller et demande de l'aide.",
      procedure: "Réponse publique immédiate et brève demandant d'appeler l'agence tout de suite, sans aucun détail. Contacter le client en privé le jour même pour bloquer ses moyens de paiement, enregistrer la réclamation et prévenir la directrice.", habituelles: ["repondre", "prive", "reclamation", "direction"] }
  ];
  var SUITES = [
    { id: "repondre", lib: "Répondre publiquement à l'avis" },
    { id: "prive", lib: "Contacter l'auteur en privé (message privé ou appel), une fois identifié" },
    { id: "reclamation", lib: "Enregistrer une réclamation" },
    { id: "signaler", lib: "Signaler l'avis à la plateforme" },
    { id: "direction", lib: "Prévenir la directrice d'agence" },
    { id: "aucune", lib: "Aucune suite (à justifier dans la note interne)" }
  ];
  var REGLES = [
    { id: "secret", titre: "Secret professionnel", texte: "Les salariés d'un établissement de crédit sont tenus au secret professionnel (article L511-33 du Code monétaire et financier). Le révéler est puni d'un an d'emprisonnement et de 15 000 € d'amende (article 226-13 du Code pénal). Une réponse publique ne confirme jamais que l'auteur est client et ne cite aucun détail de son compte, même si l'auteur l'a écrit lui-même." },
    { id: "reclamation", titre: "Un grief personnel est une réclamation", texte: "Une réclamation est « l'expression d'un mécontentement envers un professionnel » (recommandation 2022-R-01 de l'ACPR). Le canal n'importe pas : un grief précis publié sur Internet s'enregistre comme une réclamation, dans l'outil « Réclamations »." },
    { id: "avis", titre: "Avis en ligne et faux avis", texte: "La plateforme doit informer sur le traitement des avis et offrir gratuitement un moyen de signaler un doute motivé sur l'authenticité d'un avis (article L111-7-2 du Code de la consommation). Diffuser ou faire diffuser de faux avis est une pratique commerciale trompeuse (article L121-4, 27° et 28°) : deux ans d'emprisonnement et 300 000 € d'amende, cinq ans et 750 000 € si elle passe par un service en ligne (article L132-2). L'agence ne publie jamais d'avis sous un faux nom." },
    { id: "diffamation", titre: "Critique ou diffamation", texte: "La diffamation est l'allégation ou l'imputation d'un fait qui porte atteinte à l'honneur ou à la considération (article 29 de la loi du 29 juillet 1881) ; l'action est prescrite au bout de trois mois (article 65). Une critique de l'attente ou de l'accueil n'en est pas une : elle appelle une réponse, pas un signalement." },
    { id: "conv", titre: "Conventions de GS (aucune règle officielle)", texte: "Réponse sous deux jours ouvrés ; de 15 à 120 mots ; salutation, remerciement ou excuses, contact et signature ; aucun montant ni numéro hors le numéro public de l'agence ; aucune promesse ; pas de publicité ; la directrice est prévenue pour un avis diffamatoire, menaçant ou qui met en cause un collaborateur." }
  ];

  /* ---------- texte : normalisation et contrôles ---------- */
  function norm(s) { return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[‘’ʼ]/g, "'").toLowerCase().replace(/[\s ]+/g, " ").trim(); }
  function mots(s) { var t = String(s == null ? "" : s).trim(); return t ? t.split(/\s+/).length : 0; }
  var POSSESSIF = /\b(votre|vos) (compte(?! rendu)|comptes|pret|prets|credit|credits|carte|cartes|decouvert|dossier|dossiers|epargne|livret|livrets|contrat|contrats|assurance|assurances|operation|operations|releve|releves|prelevement|prelevements|virement|virements|cheque|cheques|conseiller|conseillere|banque|demande|demandes|situation|solde|iban|rib|mensualite|mensualites|frais|prime|primes)\b/;
  var STATUT = /\b(en tant que client|vous etes (notre |une? )?(client|cliente)|vous etiez (notre )?(client|cliente)|(cher|chere) (client|cliente)|(client|cliente) chez nous|votre statut de client|notre (client|cliente)\b)/;
  var SITUATION = /\b(decouvert|interdit bancaire|interdiction bancaire|fichee?|fcc|ficp|incidents? de paiement|impayes?|rejets?|rejetee?s?|surendettement|refus de (credit|pret)|(credit|pret) refuse|retard de paiement|dettes?|solde)\b/;
  var ENGAGEMENT = /\b(rembours|garantissons|garantirons|indemnis|dedommag|geste commercial|annulerons|nous allons annuler|nous vous offrons|vous serez (credite|rembourse)|sans frais|gratuit)/;
  var HOSTILE = /(menteur|mensonge|mentez|diffam|calomn|\bavocat|\bplaintes?\b|tribunal|poursuites|en justice|procureur|faux avis|n'importe quoi|ridicule|incompetent|arnaque|escroc|voleur|stupide|idiot|imbecile|honte)/;
  var MAIL = /[a-z0-9._%+-]+@([a-z0-9.-]+\.[a-z]{2,})/g;
  var EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  var SALUT = /^(bonjour|bonsoir|madame|monsieur|merci)\b/;
  var MERCI = /(merci|remerci)/;
  var EXCUSE = /(desole|excuse|regrett|navre|comprenons|comprendre|compatissons)/;
  var COMMERCIAL = /\b(offre|offres|promotion|promo|profitez|decouvrez|souscri\w+|taeg|taux)\b/;
  var TELCOMPACT = String(TEL).replace(/\D/g, "");

  /* Même normalisation que norm(), faite caractère par caractère pour garder, pour chaque signe du texte normalisé, sa place dans le texte d'origine : les extraits affichés à l'élève
     reprennent ainsi ce qu'il a écrit (accents et majuscules compris), non la version sans accent qui sert aux recherches. */
  function normIdx(s) {
    var str = String(s == null ? "" : s), out = "", idx = [], i, k, d, sp = true;
    for (i = 0; i < str.length; i++) {
      d = str.charAt(i).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[‘’ʼ]/g, "'").toLowerCase();
      if (/^[\s\u00a0]+$/.test(d)) { if (!sp) { out += " "; idx.push(i); sp = true; } continue; }
      for (k = 0; k < d.length; k++) { out += d.charAt(k); idx.push(i); }
      if (d.length) sp = false;
    }
    if (out.charAt(out.length - 1) === " ") { out = out.slice(0, -1); idx.pop(); }
    return { n: out, idx: idx, t: str };
  }
  function trouvailles(rx, N, max) {
    var l = [], m, g = new RegExp(rx.source, "g" + (rx.flags || "").replace("g", ""));
    var L = /[\p{L}\p{N}]/u, a0, a1;       /* un radical (« rembours ») est repris en mot entier */
    while ((m = g.exec(N.n)) && l.length < (max || 3)) {
      a0 = N.idx[m.index]; a1 = N.idx[m.index + m[0].length - 1] + 1;
      while (a1 < N.t.length && L.test(N.t.charAt(a1)) && L.test(N.t.charAt(a1 - 1))) a1++;
      l.push(N.t.slice(a0, a1)); if (m.index === g.lastIndex) g.lastIndex++;
    }
    return l;
  }
  function extraits(l) { return l.map(function (x) { return "« " + x + " »"; }).join(", "); }

  /* Contrôle d'une réponse avant publication. ctx : { nature, suites[], noms[] (noms de famille à ne pas citer : client rapproché, collaborateurs) }.
     Les points « bloquants » empêchent la publication ; les « avertissements » la permettent mais sont signalés. */
  function controler(texte, ctx) {
    ctx = ctx || {}; var t = String(texte == null ? "" : texte), N = normIdx(t), n = N.n, blo = [], av = [], nb = mots(t), suites = ctx.suites || [], nat = ctx.nature || "";
    function B1(code, titre, detail, ex) { blo.push({ code: code, titre: titre, detail: detail, extrait: ex || "" }); }
    function A1(code, titre, detail) { av.push({ code: code, titre: titre, detail: detail }); }
    if (!t.trim()) { B1("vide", "Réponse vide", "Rédigez la réponse qui sera publiée."); return { ok: false, bloquants: blo, avertissements: av, mots: 0, signes: 0 }; }
    if (t.length > CONV.signesMax) B1("longueur_max", "Réponse trop longue", "Elle compte " + t.length + " signes ; la limite fixée par GS est de " + CONV.signesMax + ".");
    var a = trouvailles(POSSESSIF, N).concat(trouvailles(STATUT, N));
    if (a.length) B1("client", "La réponse confirme ou suppose que l'auteur est client", "Secret professionnel (L511-33, 226-13) : ne dites rien de la relation de l'auteur avec la banque, même s'il l'a écrit lui-même. Reformulez sans « votre compte », « votre prêt », « votre conseiller »… Repéré : " + extraits(a) + ".", a[0]);
    var comp = n.replace(/(\d)[\s.\-](?=\d)/g, "$1"), chiffres = (comp.match(/\d{10,}/g) || []).filter(function (x) { return x !== TELCOMPACT; }), mails = [], mm;
    MAIL.lastIndex = 0; while ((mm = MAIL.exec(n))) { if (mm[1] !== MAIL_DOMAINE) mails.push(mm[0]); }
    if (/\bfr\d{2}/.test(comp) || chiffres.length || mails.length) B1("donnees", "Un numéro ou une adresse personnelle figure dans la réponse", "Aucun IBAN, numéro de compte, de carte ou de téléphone, aucune adresse e-mail personnelle en public. Seul le numéro de l'agence (" + TEL + ") peut être cité.", chiffres[0] || mails[0] || "");
    var eu = trouvailles(/\d+(?:[\s.,]\d+)*\s?(?:€|eur\b|euros?\b)/, N);
    if (eu.length) B1("montant", "Un montant figure dans la réponse", "Une réponse publique ne cite aucun montant lié à l'auteur. Un tarif général se renvoie à la brochure tarifaire, sans le relier à l'auteur. Repéré : " + extraits(eu) + ".", eu[0]);
    var si = trouvailles(SITUATION, N);
    if (si.length) B1("situation", "La réponse évoque une situation financière", "Découvert, incident, rejet, refus de crédit, dette… relèvent du secret professionnel. Repéré : " + extraits(si) + ".", si[0]);
    var en = trouvailles(ENGAGEMENT, N);
    if (en.length) B1("engagement", "La réponse contient une promesse", "Remboursement, geste commercial, annulation de frais… ne se promettent pas en public : ils se décident après examen du dossier, avec le client, en privé. Repéré : " + extraits(en) + ".", en[0]);
    var ho = trouvailles(HOSTILE, N);
    if (ho.length) B1("hostilite", "Le ton ou le vocabulaire est polémique ou menaçant", "Pas de polémique, d'accusation ni de menace en public : un signalement à la plateforme se fait par son formulaire, pas dans la réponse. Repéré : " + extraits(ho) + ".", ho[0]);
    var cites = (ctx.noms || []).filter(function (x) { x = norm(x); return x && new RegExp("\\b" + x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(n); });
    if (cites.length) B1("nom", "Un nom de famille est cité", "Ne nommez ni le client rapproché des dossiers ni un collaborateur : " + extraits(cites) + ".", cites[0]);
    /* avertissements */
    if (nb < CONV.motsMin) A1("longueur", "Réponse très courte", "Elle compte " + nb + " mots ; la convention de GS est de " + CONV.motsMin + " à " + CONV.motsMax + " mots.");
    else if (nb > CONV.motsMax) A1("longueur", "Réponse longue", "Elle compte " + nb + " mots ; la convention de GS est de " + CONV.motsMin + " à " + CONV.motsMax + " mots.");
    if (!SALUT.test(n)) A1("salutation", "Pas de salutation", "Commencez par « Bonjour » (ou « Madame, Monsieur » si l'auteur est anonyme).");
    if (nat === "compliment" && !MERCI.test(n)) A1("remerciement", "Pas de remerciement", "Un compliment appelle un remerciement.");
    if ((nat === "service" || nat === "reclamation" || nat === "fraude") && !EXCUSE.test(n)) A1("excuses", "Pas d'excuses ni de reconnaissance du ressenti", "Reconnaissez le désagrément (« nous sommes désolés », « nous comprenons ») sans reconnaître de faute.");
    if ((nat === "service" || nat === "reclamation" || nat === "fraude" || suites.indexOf("prive") >= 0) && !(comp.indexOf(TELCOMPACT) >= 0 || /(message prive|nous (contacter|joindre|appeler|ecrire)|contactez-nous|appelez-nous|ecrivez-nous|venir nous voir)/.test(n))) A1("contact", "Aucun moyen de contact proposé", "Indiquez comment poursuivre : le numéro de l'agence (" + TEL + ") ou un message privé.");
    if (!/(cordialement|bonne journee|bonne soiree|bien a vous|l'equipe de l'agence|agence de paris)/.test(n.slice(-80))) A1("signature", "Pas de formule de fin ni de signature", "Terminez par « Cordialement, L'équipe de l'agence de Paris » : la réponse engage l'agence, pas une personne.");
    if ((t.match(/!/g) || []).length > 2 || /!{2,}/.test(t) || (t.match(/\b[A-ZÀ-Ý]{3,}\b/g) || []).length >= 3 || /\b(tu|toi|ton|ta|tes)\b/.test(n) || EMOJI.test(t)) A1("ton", "Ton à revoir", "Pas de majuscules criées, de points d'exclamation répétés, d'émojis ni de tutoiement : le ton reste posé et professionnel.");
    var co = trouvailles(COMMERCIAL, N);
    if (co.length) A1("commercial", "Une réponse n'est pas une publicité", "Ne présentez ni offre ni taux ni produit dans la réponse. Repéré : " + extraits(co) + ".");
    if (nat === "faux" || nat === "spam") A1("polemique", "Répondre à ce type d'avis le met en valeur", "Mieux vaut le signaler à la plateforme et prévenir la directrice que de répondre en public.");
    return { ok: blo.length === 0, bloquants: blo, avertissements: av, mots: nb, signes: t.length };
  }

  /* ---------- rapprochement avec les dossiers (usage interne) ---------- */
  var FORME_NOM = /^(\S.*?)\s+([A-ZÀ-ÝÉÈ])\.$/;
  function identifiable(auteur) { return FORME_NOM.test(String(auteur || "").trim()); }       /* « Prénom X. » : seule forme qui permette un rapprochement ; un pseudonyme n'en permet aucun */
  function candidats(auteur, clients) {
    var m = FORME_NOM.exec(String(auteur || "").trim());
    if (!m) return [];
    var p = norm(m[1]), i = norm(m[2]);
    return (clients || []).filter(function (c) { return norm(c.prenom) === p && norm(c.nom).charAt(0) === i; });
  }

  /* ---------- liste, dates, bilan ---------- */
  function dateAvis(a, auj) { return B.ymd(B.plusJours(auj || B.aujourdhui(), -a.jours)); }
  function ouvres(a, auj) { var d = auj || B.aujourdhui(), n = 0, i; for (i = 0; i < a.jours; i++) { if (B.estOuvre(B.plusJours(d, -i))) n++; } return n; }
  function enRetard(a, st, auj) { return !traitement(st, a.id) && ouvres(a, auj) > CONV.delaiOuvres; }
  function trouver(id) { return AVIS.filter(function (a) { return a.id === id; })[0] || null; }
  function traitement(st, id) { return st && st.avis && st.avis[id] ? st.avis[id] : null; }
  function liste() { return AVIS.slice().sort(function (a, b) { return a.jours - b.jours || (a.id < b.id ? -1 : 1); }); }
  function bilan(st, auj) {
    var n = AVIS.length, traites = AVIS.filter(function (a) { return traitement(st, a.id); }).length, rep = [0, 0, 0, 0, 0, 0], somme = 0;
    AVIS.forEach(function (a) { rep[a.note]++; somme += a.note; });
    return { total: n, traites: traites, atraiter: n - traites, retard: AVIS.filter(function (a) { return enRetard(a, st, auj); }).length, moyenne: Math.round(somme / n * 10) / 10, repartition: rep,
      repondus: AVIS.filter(function (a) { var t = traitement(st, a.id); return t && t.suites.indexOf("repondre") >= 0; }).length, signales: AVIS.filter(function (a) { var t = traitement(st, a.id); return t && t.suites.indexOf("signaler") >= 0; }).length };
  }

  /* ---------- cohérence entre la nature choisie et les suites (points d'attention, jamais bloquants) ---------- */
  function coherence(a, s) {
    var p = [], su = s.suites || [], nat = s.nature, has = function (x) { return su.indexOf(x) >= 0; };
    if (nat === "compliment" && a.note <= 2) p.push("La note est de " + a.note + " sur 5 alors que vous classez l'avis comme un compliment : relisez-le.");
    if ((nat === "reclamation" || nat === "fraude") && !has("reclamation")) p.push("Un grief sur les opérations ou le contrat de l'auteur est une réclamation : pensez à l'enregistrer.");
    if (nat === "reclamation" && !has("repondre")) p.push("Une réponse publique brève montre que l'agence a lu l'avis et propose un contact privé.");
    if (nat === "reclamation" && !has("prive")) p.push("Le contact privé est la seule façon de traiter le grief sans rien révéler en public.");
    if (nat === "donnees" && !has("signaler")) p.push("Des données personnelles publiées doivent être retirées : signalez l'avis à la plateforme.");
    if ((nat === "faux" || nat === "donnees") && !has("direction")) p.push("La directrice décide de la suite (diffamation : trois mois pour agir) : prévenez-la.");
    if ((nat === "faux" || nat === "spam") && has("repondre")) p.push("Répondre à ce type d'avis le met en valeur et nourrit la polémique.");
    if (nat === "fraude" && !has("prive")) p.push("Une fraude en cours demande un contact rapide : le délai compte pour bloquer les moyens de paiement.");
    if (nat === "fraude" && !has("direction")) p.push("Une fraude est signalée à la directrice le jour même.");
    if ((nat === "compliment" || nat === "service") && has("signaler")) p.push("Un avis qui critique ou félicite n'est pas un motif de signalement : la plateforme le refusera (une critique n'est pas une diffamation).");
    if (nat === "service" && a.note <= 2 && !has("repondre")) p.push("Un avis de " + a.note + " sur 5 sans réponse publique abîme l'image de l'agence : une réponse est conseillée.");
    return p;
  }

  /* ---------- enregistrement du traitement ---------- */
  function E(champ, msg) { return { champ: champ, msg: msg }; }
  function ko(erreurs) { return { ok: false, erreurs: erreurs }; }
  function valider(st, id, s, ctx) {
    s = s || {}; ctx = ctx || {};
    var a = trouver(id), er = [], suites = Array.isArray(s.suites) ? s.suites.filter(function (x, i, l) { return l.indexOf(x) === i; }) : [], rep = String(s.reponse == null ? "" : s.reponse).trim(), note = String(s.note == null ? "" : s.note).trim();
    if (!a) return ko([E("avis", "Avis introuvable.")]);
    if (traitement(st, id)) return ko([E("avis", "Cet avis est déjà traité : remettez-le à traiter pour le reprendre.")]);
    var nat = NATURES.filter(function (x) { return x.id === s.nature; })[0];
    if (!nat) er.push(E("nature", "Choisissez le type de l'avis."));
    if (!suites.length) er.push(E("suites", "Choisissez au moins une suite, ou « Aucune suite »."));
    else if (suites.some(function (x) { return !SUITES.some(function (y) { return y.id === x; }); })) er.push(E("suites", "Suite inconnue."));
    else if (suites.indexOf("aucune") >= 0 && suites.length > 1) er.push(E("suites", "« Aucune suite » ne se combine pas avec une autre suite."));
    if (note.length > 300) er.push(E("note", "La note interne est limitée à 300 signes."));
    if (suites.indexOf("aucune") >= 0 && suites.length === 1) {
      if (note.length < 10) er.push(E("note", "Justifiez en quelques mots, dans la note interne, pourquoi l'avis n'appelle aucune suite."));
      if (nat && (nat.id === "reclamation" || nat.id === "donnees" || nat.id === "fraude")) er.push(E("suites", "Ce type d'avis ne peut pas rester sans suite : " + (nat.id === "reclamation" ? "une réclamation s'enregistre et se traite" : nat.id === "donnees" ? "des données personnelles publiées se font retirer" : "un client victime d'une fraude doit être aidé tout de suite") + "."));
    }
    var repond = suites.indexOf("repondre") >= 0, controle = null;
    if (repond) {
      controle = controler(rep, { nature: nat && nat.id, suites: suites, noms: ctx.noms || [] });
      if (!controle.ok) er.push(E("reponse", "La réponse ne peut pas être publiée : " + controle.bloquants.map(function (x) { return x.titre.toLowerCase(); }).join(" ; ") + "."));
    } else if (rep) er.push(E("reponse", "Cochez « Répondre publiquement à l'avis » pour publier cette réponse, ou videz le champ."));
    if (er.length) return { ok: false, erreurs: er, controle: controle };
    var now = B.maintenant();
    if (!st.avis || typeof st.avis !== "object" || Array.isArray(st.avis)) st.avis = {};
    var t = { nature: nat.id, suites: suites, reponse: repond ? rep : "", note: note, date: B.ymd(B.aujourdhui()), heure: B.hhmm(now), par: (st.eleve && st.eleve.nom) || "",
      avertissements: controle ? controle.avertissements.map(function (x) { return x.code; }) : [], points: coherence(a, { nature: nat.id, suites: suites }) };
    st.avis[id] = t;
    return { ok: true, traitement: t, controle: controle, points: t.points };
  }
  function remettre(st, id) {
    if (!trouver(id)) return { ok: false, erreur: "Avis introuvable." };
    if (!traitement(st, id)) return { ok: false, erreur: "Cet avis n'est pas traité." };
    delete st.avis[id]; return { ok: true };
  }

  var api = {
    AVIS: AVIS, CANAUX: CANAUX, CONV: CONV, NATURES: NATURES, SUITES: SUITES, REGLES: REGLES, TEL: TEL,
    norm: norm, normIdx: normIdx, mots: mots, controler: controler, identifiable: identifiable, candidats: candidats, dateAvis: dateAvis, ouvres: ouvres, enRetard: enRetard, trouver: trouver, traitement: traitement, liste: liste, bilan: bilan,
    coherence: coherence, valider: valider, remettre: remettre
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.avisEnLigne = api; }
})(typeof window !== "undefined" ? window : null);
