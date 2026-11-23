/* GS Banque & Assurance – ouverture de compte pour un prospect ou pour un client de l'agence : dossier d'entrée en relation (identité, situation, connaissance du client, pièces),
   recommandation d'un client et offre de parrainage, validation par la directrice d'agence, ouverture du compte (numéro de client, compte, RIB) avec son équipement « banque au quotidien »
   (carte, chéquier, banque à distance, alertes SMS, tous repris dans la convention de compte), puis équipement complémentaire dans le catalogue. Aucun affichage ici.
   Conventions de l'exercice : la directrice étudie le dossier après un délai stable (de quelques heures à un jour ouvré) ; il demande un complément ou refuse d'après des règles de connaissance client
   (résidence fiscale, personne politiquement exposée, interdiction bancaire, doublon). Les personnes, numéros et adresses sont fictifs. */
(function (root) {
  "use strict";

  var B = root && root.SGBF ? root.SGBF.banque : require("./banque.js");
  var PR = root && root.SGBF ? root.SGBF.produits : require("./produits.js");
  function mod(nom) { return root && root.SGBF && root.SGBF[nom] ? root.SGBF[nom] : (typeof require === "function" ? require("./" + nom + ".js") : null); }

  var ID_DEBUT = 100001;                /* identifiants des clients créés pendant l'exercice (les clients du portefeuille ont les plus petits) */
  var PREFIXE_NUM = 4200000;            /* « GS-42xxxxx » : numéros distincts de ceux du portefeuille */
  var COMPTES = ["CPT", "JEUNE"];
  /* Droit au compte : la désignation de la Banque de France reste valable six mois (article R312-7-1 du Code monétaire et financier). */
  var DAC_DELAI_MOIS = 6;
  var CIVS = ["M.", "Mme"];
  var SITUATIONS = [["celibataire", "Célibataire"], ["marie", "Marié(e)"], ["pacse", "Pacsé(e)"], ["concubinage", "En concubinage"], ["divorce", "Divorcé(e)"], ["veuf", "Veuf(ve)"]];
  var LOGEMENTS = [["locataire", "Locataire"], ["proprietaire", "Propriétaire"], ["accedant", "Propriétaire accédant"], ["heberge", "Hébergé(e)"]];
  var STATUTS = [["salarie", "Salarié(e)", "cadre", "CDI"], ["fonctionnaire", "Fonctionnaire", "employe", "Titulaire de la fonction publique"], ["independant", "Indépendant(e)", "indep", "Indépendant"], ["retraite", "Retraité(e)", "retraite", "Retraite"],
    ["etudiant", "Étudiant(e)", "Étudiant", "Étudiant"], ["apprenti", "Apprenti(e)", "Apprenti", "Contrat d'apprentissage"], ["chomage", "Demandeur d'emploi", "employe", "Demandeur d'emploi"], ["foyer", "Sans activité professionnelle", "employe", "Sans activité professionnelle"]];
  var PIECES_IDENTITE = [["cni", "Carte nationale d'identité"], ["passeport", "Passeport"], ["sejour", "Titre de séjour"]];
  /* Conventions de compte (offres groupées) proposables à l'ouverture, selon l'âge du titulaire et le compte demandé : Avenir (18-25 ans, compte Équilibre ou Jeune), Horizon (26-59 ans) et Sérénité (60 ans et plus), ces deux-là avec un compte Équilibre. */
  var CONVENTIONS = ["CVJ", "CVA", "CVS"];
  function conventionsProposees(compte, age) {
    return CONVENTIONS.filter(function (id) {
      var cv = PR.parId[id] && PR.parId[id].convention;
      return cv && age >= cv.ageMin && age <= cv.ageMax && (id === "CVJ" ? (compte === "CPT" || compte === "JEUNE") : compte === "CPT");
    });
  }
  var ORIGINES = [["salaire", "Revenus d'activité (salaires, honoraires)"], ["retraite", "Pension de retraite"], ["epargne", "Épargne personnelle"], ["aides", "Allocations et aides"], ["famille", "Don ou aide de la famille"], ["heritage", "Héritage ou donation"], ["autre", "Autre origine"]];
  var OBJETS = [["principal", "Compte principal : domiciliation des revenus"], ["secondaire", "Compte secondaire"], ["jeune", "Premier compte : autonomie financière"]];
  var RESIDENCES = [["france", "France uniquement"], ["autre", "France et un autre pays"]];
  /* Forme du compte : individuel, joint (« ou » : chaque titulaire agit seul et engage les autres) ou indivis (« et » : tous les titulaires signent chaque opération). Un compte indivis est
     un compte d'indivisaires (« Indivision X ») ou le compte d'une succession (« Succession de M. X ») ouvert par les héritiers. Lien du second titulaire avec le premier. */
  var FORMES = [["individuel", "Compte individuel"], ["joint", "Compte joint – « ou » : chaque titulaire peut agir seul"], ["indivis", "Compte indivis – « et » : tous les titulaires signent chaque opération"]];
  var LIENS = [["couple", "Conjoint, partenaire de PACS ou concubin"], ["famille", "Parent, enfant majeur ou autre membre de la famille"], ["autre", "Autre personne (colocataire, associé, ami…)"]];
  var RANGS = ["Premier titulaire", "Second titulaire", "Troisième titulaire", "Quatrième titulaire", "Cinquième titulaire"];
  var INDIVISIONS = [["indivision", "Indivision (indivisaires, par exemple après un achat à plusieurs)"], ["succession", "Succession (compte ouvert par les héritiers au nom du défunt)"]];
  /* Équipement « banque au quotidien » proposé à l'ouverture. Une carte est une souscription à part (son contrat suit le moyen d'ouverture) ; chéquier, banque à distance et alertes SMS
     sont des services de la convention de compte. */
  var CARTES = ["CRET", "VELE", "VCLA", "VJEU", "VPRE", "PLAT", "WELI"];
  var CARTES_PAIEMENT = ["VCLA", "VJEU", "VELE", "VPRE", "PLAT", "WELI"];
  var CARTES_A_DEBIT = ["VCLA", "VPRE", "PLAT", "WELI"];     /* cartes dont le client choisit le type de débit */
  var SEUILS_CARTE = { VPRE: 2000, PLAT: 3000, WELI: 4500 };  /* revenus nets mensuels domiciliés exigés (fiches produits) */
  var DEBITS = [["immediat", "Débit immédiat"], ["differe", "Débit différé (prélevé en fin de mois)"]];
  var SEUIL_PREMIER = 2000;             /* revenus nets mensuels domiciliés exigés pour la Visa Premier (fiche produit) */
  /* Offre de parrainage (conventions de l'exercice, montants imaginaires) : un client de l'agence recommande une personne qui n'est pas encore cliente. */
  var PARRAINAGE = { primeParrain: 50, primeFilleul: 50, delaiMois: 3, ancienneteJours: 180, plafond: 5, fenetreJours: 365 };

  function lib(l, v) { var x = l.filter(function (a) { return a[0] === v; })[0]; return x ? x[1] : ""; }
  function trim(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); }
  function empreinte(t) { var h = 2166136261; t = String(t); for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function norm(s) { return trim(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function ageAu(ymd, auj) { var n = B.lireYmd(ymd); if (!n) return NaN; var a = auj.getFullYear() - n.getFullYear(); if (auj.getMonth() < n.getMonth() || (auj.getMonth() === n.getMonth() && auj.getDate() < n.getDate())) a--; return a; }
  function directeur() { var E = mod("equipe"); return E ? E.COLLABS.filter(function (c) { return c.poste === "dir"; })[0] : { civ: "Mme", prenom: "Hélène", nom: "Delorme" }; }

  function plusMois(d, n) { var x = new Date(d.getFullYear(), d.getMonth() + n, 1, 12), dm = new Date(x.getFullYear(), x.getMonth() + 1, 0, 12).getDate(); return new Date(x.getFullYear(), x.getMonth(), Math.min(d.getDate(), dm), 12); }
  /* Clients du portefeuille (la page ou le test les fournit déjà ; sinon on les charge). */
  function portefeuille() {
    if (root && root.SGBF && root.SGBF.clients) return root.SGBF.clients;
    try { return require("./data_clients.js").clients; } catch (e) { return []; }
  }
  function client(base, id) { return (base || []).filter(function (c) { return c.id === id; })[0] || null; }
  function naissanceClient(c) { var S = mod("synthese"), n = S && S.naissance ? S.naissance(c) : null; return n ? B.ymd(n) : ""; }
  function adresseNorm(a) { return norm((a.rue || "") + " " + (a.cp || "") + " " + (a.ville || "")); }
  function nomClient(c) { return c.civ + " " + c.prenom + " " + c.nom.toUpperCase(); }
  /* Le client qui recommande : par numéro de client (GS-41…) ou par nom et prénom. */
  function trouverParrain(ref, base) {
    var t = trim(ref); if (!t) return null;
    var m = /GS-?\s?(\d{7})/i.exec(t);
    if (m) return (base || []).filter(function (c) { return c.num === "GS-" + m[1]; })[0] || null;
    var k = norm(t.replace(/^(m\.|mme|monsieur|madame)\s+/i, "")), l = (base || []).filter(function (c) { return norm(c.nom + " " + c.prenom) === k || norm(c.prenom + " " + c.nom) === k; });
    return l.length === 1 ? l[0] : null;
  }

  /* ---------- contrôle de la saisie ---------- */
  var RE_MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function mobile(v) { var t = String(v || "").replace(/[\s.\-]/g, ""); if (/^\+33/.test(t)) t = "0" + t.slice(3); return /^0[67]\d{8}$/.test(t) ? t.replace(/(\d{2})(?=\d)/g, "$1 ") : null; }
  function nombre(v) { var t = String(v == null ? "" : v).replace(/[\s  ]/g, "").replace(",", "."); return t !== "" && /^\d+(\.\d{1,2})?$/.test(t) ? parseFloat(t) : NaN; }
  function erreur(champ, texte) { return { ok: false, champ: champ, erreur: texte }; }
  /* Documents numérisés (bouton « Scanner ou importer un document ») : seuls ceux dont les trois vérifications ont été faites sont retenus.
     Un client de l'agence n'a qu'une pièce d'identité à présenter ; un prospect fournit en plus un justificatif de domicile et, s'il a des revenus, un justificatif de revenus. */
  var PIECES_SCAN = ["identite", "domicile", "revenus"];
  /* w : préfixe du titulaire dans le formulaire (« s_ » pour le second titulaire, « u3_ » pour le troisième…), vide pour le premier. */
  function scansDe(f, client, w) {
    var N = mod("numerisation"), src = (f && f.scans) || {}, r = {};
    PIECES_SCAN.forEach(function (k) { if (client && k !== "identite") return; if (N && N.valide(src[(w || "") + k])) r[k] = src[(w || "") + k]; });
    return r;
  }

  /* Interrogation de la Banque de France (outil « Interro BDF ») : obligatoire avant la validation du dossier, pour l'identité saisie (nom, nom de jeune fille, date de naissance), les deux fichiers (FCC et FICP),
     et le jour même de la validation. Elle donne l'interdiction bancaire (fcc) et l'inscription au FICP (ficp) du dossier. Renvoie une erreur, ou null si tout est en ordre. */
  function controlerBdf(o, f, auj, qui) {
    var X = mod("bdf"), t = f.bdf, saisie = { nom: o.nom, nomNaissance: trim(f.nomNaissance), naissance: o.naissance };
    var s = X.controlerSaisie(saisie); if (!s.ok && s.champ === "nomNaissance") return erreur("nomNaissance", s.erreur);
    var manque = "Interrogez la Banque de France (fichier central des chèques et FICP) avant de valider le dossier : bouton « Interroger la Banque de France ». La consultation est obligatoire à chaque ouverture de compte.";
    if (!t || typeof t !== "object") return erreur("bdf", manque);
    if (!X.complete(t)) return erreur("bdf", "L'interrogation de la Banque de France est incomplète : les deux fichiers (FCC et FICP) doivent être interrogés.");
    if (!X.correspond(t, saisie)) return erreur("bdf", "L'interrogation de la Banque de France ne correspond plus à l'identité saisie (nom, nom de jeune fille ou date de naissance modifiés depuis) : interrogez-la de nouveau.");
    if (t.date !== B.ymd(auj)) return erreur("bdf", "L'interrogation de la Banque de France date du " + B.fmtDate(B.lireYmd(t.date)) + " : elle doit être faite le jour où le dossier est validé. Interrogez-la de nouveau.");
    o.nomNaissance = saisie.nomNaissance;
    o.bdf = { date: t.date, heure: t.heure, cle: t.cle, cleNaissance: t.cleNaissance || "", nom: t.nom, nomNaissance: t.nomNaissance || "", naissance: t.naissance, fcc: t.fcc, ficp: t.ficp,
      fccIncidents: t.fccIncidents || 0, ficpIncidents: t.ficpIncidents || 0, surendettement: !!t.surendettement };
    o.fcc = t.fcc === "interdit" ? "oui" : "non";
    o.ficp = t.ficp === "inscrit" ? "oui" : "non";
    return null;
  }

  /* Décision du conseiller pour une personne inscrite au FCC ou au FICP. Une inscription n'interdit pas l'ouverture à elle seule : c'est à l'agence d'apprécier le risque.
     d : { choix: « ouvrir » (avis favorable : la directrice décide) | « refuser » (la lettre de refus est remise au demandeur), motif } ; le motif est obligatoire dans les deux cas.
     champs : [champ du choix, champ du motif] dans le formulaire ; sujet : début de la phrase d'erreur. Renseigne q.decision (null si la personne n'est inscrite à aucun fichier). */
  var DECISION_MOTIF_MIN = 5, DECISION_MOTIF_MAX = 300;
  function inscription(q) { return q.fcc === "oui" && q.ficp === "oui" ? "inscrit au FCC et au FICP" : q.fcc === "oui" ? "interdit bancaire (inscrit au FCC)" : "inscrit au FICP"; }
  function controlerDecision(q, d, champs, sujet) {
    if (q.fcc !== "oui" && q.ficp !== "oui") { q.decision = null; return null; }
    d = d || {}; var choix = d.choix, motif = trim(d.motif);
    if (choix !== "ouvrir" && choix !== "refuser") return erreur(champs[0], sujet + " est " + inscription(q) + " : décidez d'ouvrir le compte (avis favorable, la directrice prend la décision finale) ou de refuser l'ouverture.");
    if (motif.length < DECISION_MOTIF_MIN) return erreur(champs[1], "Indiquez le motif de votre décision (" + DECISION_MOTIF_MIN + " caractères au moins) : il est transmis à la directrice" + (choix === "refuser" ? " et figure sur la lettre de refus." : "."));
    if (motif.length > DECISION_MOTIF_MAX) return erreur(champs[1], "Le motif est limité à " + DECISION_MOTIF_MAX + " caractères (" + motif.length + " saisis).");
    q.decision = { choix: choix, motif: motif };
    return null;
  }

  var RE_NOM = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ' \-]{0,38}$/;
  /* Titulaires d'un compte joint (le premier et un second) ou indivis (le premier et un à quatre autres) : chacun est une personne à part entière, avec sa propre connaissance client, ses pièces, sa propre
     consultation de la Banque de France (FCC et FICP) et, s'il est inscrit à l'un des fichiers, la décision du conseiller. f.second : le second titulaire ; f.autres : les troisième, quatrième et cinquième
     titulaires d'une indivision. Champs d'un titulaire : { civ, nom, prenom, nomNaissance, naissance, lieuNaissance, nationalite, lien, memeAdresse, rue, cp, ville, mob, mail, statut, profession, revenus,
     residence, autocertification, ppe, origineJustifiee, identite, pieceIdentite, pieceDomicile, bdf, decision, client }. Dans le formulaire ils portent le préfixe de leur rang : « s_nom », « u3_nom »…
     Un titulaire peut être client de l'agence (champ client : son numéro ou son nom) : identité, coordonnées et activité sont alors reprises de sa fiche client. */
  var PREFIXES_CO = ["s_", "u3_", "u4_", "u5_"], CO_MAX = PREFIXES_CO.length;
  function controlerCotitulaire(o, s, w, rang, auj, clients, vus) {
    s = s || {};
    var E = function (champ, texte) { return erreur(champ, RANGS[rang] + " : " + texte); };
    var ref = trim(s.client), cl = null;
    if (ref) {
      cl = trouverParrain(ref, clients);
      if (!cl) return E(w + "client", "client de l'agence introuvable : saisissez son numéro de client (GS-41…) ou son nom et son prénom, ou laissez le champ vide s'il n'est pas client.");
      if (o.client && cl.id === o.client) return E(w + "client", "c'est le client pour lequel le compte est ouvert : saisissez une autre personne.");
      if (cl.kyc > mod("synthese").KYC_MAX) return E(w + "client", nomClient(cl) + " : le dossier client n'a pas été actualisé depuis plus de 5 ans. Actualisez-le lors d'un entretien (fiche client) avant de l'inscrire comme titulaire.");
    }
    var memeAdresse = s.memeAdresse !== false, q;
    if (cl) {
      memeAdresse = adresseNorm(cl.adr) === adresseNorm({ rue: o.rue, cp: o.cp, ville: o.ville });
      q = { client: cl.id, civ: cl.civ, nom: cl.nom, prenom: cl.prenom, nomNaissance: trim(s.nomNaissance), naissance: naissanceClient(cl), lieuNaissance: "", nationalite: "", lien: s.lien, memeAdresse: memeAdresse,
        rue: cl.adr.rue, cp: cl.adr.cp, ville: cl.adr.ville, mob: cl.mob || "", mail: cl.mail || "", statut: cl.pro.statut, profession: cl.pro.prof, revenus: cl.pro.rev || 0,
        residence: s.residence, autocertification: !!s.autocertification, ppe: s.ppe, origineJustifiee: !!s.origineJustifiee, identite: s.identite, pieceIdentite: !!s.pieceIdentite, pieceDomicile: false, fcc: "", ficp: "" };
    } else {
      q = { client: 0, civ: s.civ, nom: trim(s.nom), prenom: trim(s.prenom), nomNaissance: trim(s.nomNaissance), naissance: trim(s.naissance), lieuNaissance: trim(s.lieuNaissance), nationalite: trim(s.nationalite), lien: s.lien, memeAdresse: memeAdresse,
        rue: memeAdresse ? o.rue : trim(s.rue), cp: memeAdresse ? o.cp : trim(s.cp), ville: memeAdresse ? o.ville : trim(s.ville), mob: "", mail: trim(s.mail).toLowerCase(), statut: s.statut, profession: trim(s.profession), revenus: 0,
        residence: s.residence, autocertification: !!s.autocertification, ppe: s.ppe, origineJustifiee: !!s.origineJustifiee, identite: s.identite, pieceIdentite: !!s.pieceIdentite, pieceDomicile: !!s.pieceDomicile, fcc: "", ficp: "" };
      if (CIVS.indexOf(q.civ) < 0) return E(w + "civ", "choisissez la civilité : Monsieur ou Madame.");
      if (!RE_NOM.test(q.nom)) return E(w + "nom", "saisissez le nom de famille (lettres, espaces, traits d'union et apostrophes).");
      if (!RE_NOM.test(q.prenom)) return E(w + "prenom", "saisissez le prénom (lettres, espaces, traits d'union et apostrophes).");
      if (!B.lireYmd(q.naissance)) return E(w + "naissance", "saisissez la date de naissance (jour, mois, année).");
    }
    var age = ageAu(q.naissance, auj);
    if (age < 0 || age > 110) return E(w + "naissance", "cette date de naissance n'est pas plausible.");
    if (age < 18) return E(w + "naissance", "il a " + age + " an" + (age > 1 ? "s" : "") + " : il est mineur. Un mineur ne peut pas être titulaire d'un compte joint ou indivis dans cet exercice.");
    if (!cl) {
      if (!q.lieuNaissance) return E(w + "lieuNaissance", "saisissez la commune de naissance (ou le pays s'il est né à l'étranger).");
      if (!q.nationalite) return E(w + "nationalite", "saisissez la nationalité.");
    }
    if (!lib(LIENS, q.lien)) return E(w + "lien", "indiquez le lien avec le premier titulaire.");
    if (q.lien === "couple" && ["marie", "pacse", "concubinage"].indexOf(o.situation) < 0) return E(w + "lien", "le lien « conjoint, partenaire de PACS ou concubin » suppose que le premier titulaire soit marié(e), pacsé(e) ou en concubinage : corrigez sa situation familiale ou le lien.");
    if (!cl) {
      if (!memeAdresse) {
        if (!/^\d{1,3} ?(bis|ter)?[ ,]/i.test(q.rue + " ") || q.rue.length < 6) return E(w + "rue", "saisissez l'adresse : numéro et nom de la voie, par exemple 12 rue des Lilas.");
        if (!/^\d{5}$/.test(q.cp)) return E(w + "cp", "le code postal comporte 5 chiffres.");
        if (!q.ville) return E(w + "ville", "saisissez la ville.");
      }
      if (trim(s.mob) !== "") { var m = mobile(s.mob); if (!m) return E(w + "mob", "saisissez un numéro de mobile français : 06 ou 07 suivi de huit chiffres, ou laissez le champ vide."); q.mob = m; }
      if (q.mail !== "" && !RE_MAIL.test(q.mail)) return E(w + "mail", "saisissez une adresse e-mail valide, ou laissez le champ vide.");
      if (!STATUTS.filter(function (x) { return x[0] === q.statut; })[0]) return E(w + "statut", "choisissez la situation professionnelle.");
      if (!q.profession || q.profession.length > 60) return E(w + "profession", "indiquez la profession (ou « sans emploi », « étudiant »…), 60 caractères au plus.");
      var rev = nombre(s.revenus);
      if (isNaN(rev)) return E(w + "revenus", "saisissez ses revenus mensuels nets en euros (0 s'il n'y en a pas), par exemple 1800.");
      if (rev > 100000) return E(w + "revenus", "ce revenu mensuel n'est pas plausible : vérifiez le montant.");
      q.revenus = rev;
    }
    if (!lib(RESIDENCES, q.residence)) return E(w + "residence", "indiquez la résidence fiscale.");
    if (q.ppe !== "oui" && q.ppe !== "non") return E(w + "ppe", "indiquez s'il est une personne politiquement exposée (PPE) ou proche d'une PPE.");
    /* même personne qu'un autre titulaire, ou déjà cliente de l'agence sans que son numéro ait été indiqué */
    var k = norm(q.nom) + "|" + norm(q.prenom);
    if ((vus || []).indexOf(k + "|" + q.naissance) >= 0) return E(w + (cl ? "client" : "nom"), "c'est la même personne qu'un autre titulaire : saisissez une autre personne.");
    if (!cl) {
      var dej = (clients || []).filter(function (c) { return norm(c.nom) + "|" + norm(c.prenom) === k && c.age === age; })[0];
      if (dej) return { ok: false, champ: w + "client", erreur: RANGS[rang] + " : " + q.civ + " " + q.prenom + " " + q.nom.toUpperCase() + " est déjà client de l'agence (" + dej.num + "). Indiquez son numéro de client dans le champ « Client de l'agence » : ses données sont reprises de sa fiche client.", client: dej.id };
    }
    var eb = controlerBdf(q, { bdf: s.bdf, nomNaissance: q.nomNaissance }, auj);
    if (eb) return E(eb.champ === "nomNaissance" ? w + "nomNaissance" : w + "bdf", eb.erreur.charAt(0).toLowerCase() + eb.erreur.slice(1));
    var ed = controlerDecision(q, s.decision, [w + "decision", w + "decisionMotif"], "il"); if (ed) return E(ed.champ, ed.erreur);
    if (!lib(PIECES_IDENTITE, q.identite)) return E(w + "identite", "choisissez le type de pièce d'identité présentée.");
    if (!q.pieceIdentite) return E(w + "pieceIdentite", "cochez la pièce d'identité : elle est obligatoire (original en cours de validité, copie conservée).");
    if (!cl && !memeAdresse && !q.pieceDomicile) return E(w + "pieceDomicile", "cochez le justificatif de domicile de moins de 3 mois : l'adresse est différente de celle du premier titulaire.");
    q.age = age; q.scans = scansDe({ scans: s.scans }, !!cl, "");
    vus.push(k + "|" + q.naissance);
    return { ok: true, q: q };
  }
  /* Les titulaires autres que le premier, d'après la forme du compte : un second titulaire pour un compte joint, un à quatre autres titulaires pour un compte indivis. */
  function controlerCotitulaires(o, f, auj, clients) {
    var liste = [f.second || {}];
    if (o.forme === "indivis") liste = liste.concat(Array.isArray(f.autres) ? f.autres : []);
    if (liste.length > CO_MAX) return erreur("forme", "Un compte indivis compte cinq titulaires au plus.");
    var vus = [norm(o.nom) + "|" + norm(o.prenom) + "|" + o.naissance], res = [];
    for (var i = 0; i < liste.length; i++) {
      var r = controlerCotitulaire(o, liste[i], PREFIXES_CO[i], i + 1, auj, clients, vus);
      if (!r.ok) return r;
      res.push(r.q);
    }
    o.second = res[0]; o.autres = res.slice(1);
    return null;
  }
  /* Indivision : « Indivision X » (indivisaires) ou « Succession de M. X » (héritiers) ; pièce justificative obligatoire. */
  function controlerIndivision(o, f, auj) {
    var i = f.indivision || {}, r = { type: i.type, defunt: null, dateDeces: "", piece: !!i.piece };
    if (!lib(INDIVISIONS, r.type)) return erreur("indType", "Précisez la nature de l'indivision : indivision ou succession.");
    if (r.type === "succession") {
      var d = i.defunt || {}, dd = B.lireYmd(trim(i.dateDeces));
      r.defunt = { civ: d.civ, nom: trim(d.nom), prenom: trim(d.prenom) };
      if (CIVS.indexOf(r.defunt.civ) < 0) return erreur("defCiv", "Succession : choisissez la civilité du défunt.");
      if (!RE_NOM.test(r.defunt.nom)) return erreur("defNom", "Succession : saisissez le nom de famille du défunt.");
      if (!RE_NOM.test(r.defunt.prenom)) return erreur("defPrenom", "Succession : saisissez le prénom du défunt.");
      if (!dd) return erreur("dateDeces", "Succession : saisissez la date du décès (jour, mois, année).");
      r.dateDeces = trim(i.dateDeces);
      if (r.dateDeces > B.ymd(auj)) return erreur("dateDeces", "Succession : la date du décès ne peut pas être postérieure à aujourd'hui.");
      if (r.dateDeces < "1990-01-01") return erreur("dateDeces", "Succession : cette date de décès n'est pas plausible.");
      if (!r.piece) return erreur("pieceIndivision", "Succession : cochez l'acte de décès et l'acte de notoriété (ou l'attestation du notaire) : ils désignent les héritiers et sont obligatoires.");
    } else if (!r.piece) return erreur("pieceIndivision", "Indivision : cochez le justificatif de l'indivision (titre de propriété détenu en indivision, acte d'acquisition en indivision, convention d'indivision…) : il est obligatoire.");
    o.indivision = r;
    return null;
  }

  /* clients : le portefeuille (pour repérer un doublon). Renvoie { ok, fiche } avec la fiche normalisée, ou { ok: false, champ, erreur }. */
  function controler(f, clients, auj, st) {
    auj = auj || B.aujourdhui(); f = f || {};
    if (f.titulaire === "client") return controlerClient(f, clients, auj, st);
    var o = { civ: f.civ, nom: trim(f.nom), prenom: trim(f.prenom), naissance: trim(f.naissance), lieuNaissance: trim(f.lieuNaissance), nationalite: trim(f.nationalite), rue: trim(f.rue), cp: trim(f.cp), ville: trim(f.ville),
      mob: "", mail: trim(f.mail).toLowerCase(), situation: f.situation, enfants: 0, logement: f.logement, statut: f.statut, profession: trim(f.profession), revenus: 0,
      residence: f.residence, autocertification: !!f.autocertification, ppe: f.ppe, origine: f.origine, origineJustifiee: !!f.origineJustifiee, fcc: "", ficp: "", objet: f.objet, identite: f.identite, pieceIdentite: !!f.pieceIdentite, pieceDomicile: !!f.pieceDomicile, pieceRevenus: !!f.pieceRevenus, scans: scansDe(f, false),
      compte: f.compte, dac: f.dac, dacDate: trim(f.dacDate), dacDeclaration: !!f.dacDeclaration, canal: f.canal, note: trim(f.note), titulaire: "prospect", reco: f.reco === "oui" ? "oui" : "non", parrainRef: trim(f.parrainRef), parrain: null, carte: f.carte || "", debit: f.debit || "immediat", cheque: !!f.cheque, remise: f.remise || "", remiseCheque: f.remiseCheque || "", convention: f.convention || "", distance: !!f.distance, sms: !!f.sms, services: Array.isArray(f.services) ? f.services.filter(function (k) { return typeof k === "string"; }) : undefined };
    var NOM = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ' \-]{0,38}$/;
    if (CIVS.indexOf(o.civ) < 0) return erreur("civ", "Choisissez la civilité : Monsieur ou Madame.");
    if (!NOM.test(o.nom)) return erreur("nom", "Saisissez le nom de famille (lettres, espaces, traits d'union et apostrophes).");
    if (!NOM.test(o.prenom)) return erreur("prenom", "Saisissez le prénom (lettres, espaces, traits d'union et apostrophes).");
    var n = B.lireYmd(o.naissance);
    if (!n) return erreur("naissance", "Saisissez la date de naissance (jour, mois, année).");
    var age = ageAu(o.naissance, auj);
    if (age < 0 || age > 110) return erreur("naissance", "Cette date de naissance n'est pas plausible.");
    if (age < 18) return erreur("naissance", "Le prospect a " + age + " an" + (age > 1 ? "s" : "") + " : il est mineur. L'ouverture d'un compte à un mineur passe par ses représentants légaux et n'est pas traitée dans cet exercice.");
    if (!o.lieuNaissance) return erreur("lieuNaissance", "Saisissez la commune de naissance (ou le pays si le prospect est né à l'étranger).");
    if (!o.nationalite) return erreur("nationalite", "Saisissez la nationalité.");
    if (!/^\d{1,3} ?(bis|ter)?[ ,]/i.test(o.rue + " ") || o.rue.length < 6) return erreur("rue", "Saisissez l'adresse : numéro et nom de la voie, par exemple 12 rue des Lilas.");
    if (!/^\d{5}$/.test(o.cp)) return erreur("cp", "Le code postal comporte 5 chiffres.");
    if (!o.ville) return erreur("ville", "Saisissez la ville.");
    var m = mobile(f.mob); if (!m) return erreur("mob", "Saisissez un numéro de mobile français : 06 ou 07 suivi de huit chiffres.");
    o.mob = m;
    if (!RE_MAIL.test(o.mail)) return erreur("mail", "Saisissez une adresse e-mail valide, par exemple prenom.nom@example.com.");
    if (!lib(SITUATIONS, o.situation)) return erreur("situation", "Choisissez la situation familiale.");
    var e = f.enfants === "" || f.enfants == null ? NaN : Number(f.enfants);
    if (!(e >= 0 && e <= 8 && e === Math.floor(e))) return erreur("enfants", "Indiquez le nombre d'enfants à charge, de 0 à 8.");
    o.enfants = e;
    if (!lib(LOGEMENTS, o.logement)) return erreur("logement", "Choisissez la situation de logement.");
    if (!STATUTS.filter(function (x) { return x[0] === o.statut; })[0]) return erreur("statut", "Choisissez la situation professionnelle.");
    if (!o.profession || o.profession.length > 60) return erreur("profession", "Indiquez la profession (ou « sans emploi », « étudiant »…), 60 caractères au plus.");
    var rev = nombre(f.revenus);
    if (isNaN(rev)) return erreur("revenus", "Saisissez les revenus mensuels nets en euros (0 s'il n'y en a pas), par exemple 2100.");
    if (rev > 100000) return erreur("revenus", "Ce revenu mensuel n'est pas plausible : vérifiez le montant.");
    o.revenus = rev;
    if (!lib(RESIDENCES, o.residence)) return erreur("residence", "Indiquez la résidence fiscale du prospect.");
    if (o.ppe !== "oui" && o.ppe !== "non") return erreur("ppe", "Indiquez si le prospect est une personne politiquement exposée (PPE) ou proche d'une PPE.");
    if (!lib(ORIGINES, o.origine)) return erreur("origine", "Choisissez l'origine principale des fonds qui alimenteront le compte.");
    var eb = controlerBdf(o, f, auj); if (eb) return eb;
    if (!lib(OBJETS, o.objet)) return erreur("objet", "Choisissez l'objet de la relation.");
    if (!lib(PIECES_IDENTITE, o.identite)) return erreur("identite", "Choisissez le type de pièce d'identité présentée.");
    if (!o.pieceIdentite) return erreur("pieceIdentite", "Cochez la pièce d'identité : elle est obligatoire (original en cours de validité, copie conservée).");
    if (!o.pieceDomicile) return erreur("pieceDomicile", "Cochez le justificatif de domicile de moins de 3 mois : il est obligatoire.");
    if (["salarie", "fonctionnaire", "retraite", "independant"].indexOf(o.statut) >= 0 && rev > 0 && !o.pieceRevenus) return erreur("pieceRevenus", "Cochez le justificatif de revenus (bulletin de salaire, avis de pension ou bilan) : le prospect déclare des revenus.");
    if (o.reco === "oui") {
      var pa = trouverParrain(o.parrainRef, clients);
      if (!pa) return erreur("parrainRef", "Indiquez le client qui a recommandé le prospect : son numéro de client (GS-41…) ou son nom et son prénom. Il doit être client de l'agence.");
      o.parrain = { id: pa.id, num: pa.num, civ: pa.civ, nom: pa.nom, prenom: pa.prenom };
    } else o.parrainRef = "";
    if (o.dac !== "oui" && o.dac !== "non") return erreur("dac", "Demandez au prospect si le compte est ouvert dans le cadre du droit au compte (désignation par la Banque de France) et répondez par oui ou par non.");
    if (o.dac === "oui") {
      /* droit au compte : le compte est le compte « DAC » (services bancaires de base) ; ni convention, ni carte au choix, ni chéquier, ni autre service à l'ouverture */
      var dd = B.lireYmd(o.dacDate);
      if (!dd) return erreur("dacDate", "Saisissez la date à laquelle la Banque de France a désigné la banque (jour, mois, année).");
      if (o.dacDate > B.ymd(auj)) return erreur("dacDate", "La date de désignation ne peut pas être postérieure à aujourd'hui.");
      if (o.dacDate < B.ymd(plusMois(auj, -DAC_DELAI_MOIS))) return erreur("dacDate", "La désignation date de plus de " + DAC_DELAI_MOIS + " mois : elle est caduque. Le prospect doit saisir de nouveau la Banque de France.");
      if (!o.dacDeclaration) return erreur("dacDeclaration", "Cochez la déclaration sur l'honneur : le prospect ne détient aucun compte de dépôt en France (condition du droit au compte).");
      o.compte = "DAC"; o.carte = ""; o.debit = "immediat"; o.cheque = false; o.remise = ""; o.remiseCheque = ""; o.convention = ""; o.distance = false; o.sms = false; o.services = undefined;
    } else { o.dacDate = ""; o.dacDeclaration = false; }
    /* inscrit au FCC ou au FICP : le conseiller décide (sauf droit au compte : la banque est désignée par la Banque de France) */
    if (o.dac === "oui") o.decision = null;
    else { var ed = controlerDecision(o, f.decision, ["decision", "decisionMotif"], "Le prospect"); if (ed) return ed; }
    if (o.dac !== "oui" && COMPTES.indexOf(o.compte) < 0) return erreur("compte", "Choisissez le compte à ouvrir.");
    if (o.compte === "JEUNE" && (age < 18 || age > 25)) return erreur("compte", "Le Compte Jeune s'adresse aux 18-25 ans : le prospect a " + age + " ans. Choisissez le compte courant Équilibre.");
    if (!mod("catalogue").MOYENS[o.canal]) return erreur("canal", "Indiquez le moyen par lequel le compte est ouvert : mailing, appel, entretien en rendez-vous ou entretien à l'accueil.");
    /* forme du compte : individuel, joint ou indivis (second titulaire à part entière) */
    o.forme = f.forme === "joint" || f.forme === "indivis" ? f.forme : "individuel"; o.second = null; o.autres = []; o.indivision = null;
    if (o.forme !== "individuel") {
      if (o.dac === "oui") return erreur("forme", "Le droit au compte donne un compte individuel : la désignation de la Banque de France est personnelle. Choisissez « compte individuel ».");
      if (o.compte === "JEUNE") return erreur("forme", "Le Compte Jeune est un compte individuel (18-25 ans) : choisissez le compte courant Équilibre pour un compte " + (o.forme === "joint" ? "joint" : "indivis") + ".");
      var e2 = controlerCotitulaires(o, f, auj, clients); if (e2) return e2;
      if (o.forme === "indivis") { var e3 = controlerIndivision(o, f, auj); if (e3) return e3; }
    }
    if (o.dac !== "oui") { var eq = controlerEquipement(o, clientTemp(o, auj), auj, null, st); if (!eq.ok) return eq; }
    if (o.note.length > 300) return erreur("note", "La remarque est limitée à 300 caractères.");
    /* doublon : le prospect est peut-être déjà client (même nom, même prénom, même âge) ou déjà en cours d'ouverture */
    var k = norm(o.nom) + "|" + norm(o.prenom), dej = (clients || []).filter(function (c) { return norm(c.nom) + "|" + norm(c.prenom) === k && c.age === age; })[0];
    if (dej) return { ok: false, champ: "nom", erreur: o.civ + " " + o.prenom + " " + o.nom.toUpperCase() + " est déjà client de l'agence (" + dej.num + ") : ouvrez sa fiche client plutôt que de créer un nouveau dossier.", client: dej.id };
    var enCours = ((st && st.prospects) || []).filter(function (d) { return d.id !== f.dossier && norm(d.fiche.nom) + "|" + norm(d.fiche.prenom) === k && d.fiche.naissance === o.naissance; })[0];
    if (enCours) return { ok: false, champ: "nom", erreur: "Un dossier d'ouverture existe déjà pour ce prospect (" + enCours.ref + ") : ouvrez-le dans la liste des dossiers.", dossier: enCours.id };
    /* complément d'un dossier : la directrice attend les éléments qu'il a demandés, on ne retransmet pas à vide */
    if (dejaSoumis(st, f.dossier)) { var av = avis(o); if (av.code === "complement") return erreur(av.complements[0].cle, "La directrice attend encore : " + av.complements[0].texte + " Cochez la case correspondante une fois l'élément obtenu."); }
    o.age = age;
    return { ok: true, fiche: o };
  }

  /* Équipement demandé à l'ouverture : carte (éligibilité du moteur du catalogue, Visa Premier : revenus domiciliés), type de débit, chéquier, banque à distance, alertes SMS. c : le client (réel ou « neuf »). */
  function controlerEquipement(o, c, auj, base, st) {
    /* Convention de compte : la carte qu'elle inclut est délivrée avec elle, on ne choisit donc pas d'autre carte. */
    var conv = o.convention || "";
    if (conv) {
      var KC = mod("catalogue"), pc = PR.parId[conv];
      if (CONVENTIONS.indexOf(conv) < 0 || !pc) return erreur("convention", "Choisissez la convention parmi celles proposées.");
      if (conventionsProposees(o.compte, c.age).indexOf(conv) < 0) return erreur("convention", pc.nom + " : réservée " + (pc.convention.ageMax >= 120 ? "aux " + pc.convention.ageMin + " ans et plus" : "aux " + pc.convention.ageMin + " à " + pc.convention.ageMax + " ans") + ", avec " + (conv === "CVJ" ? "un compte courant Équilibre ou le compte Jeune" : "un compte courant Équilibre") + ".");
      var pos = KC.possibilite(KC.verdictClient(c, conv, st || {}), pc);
      if (!pos.ok) return erreur("convention", pc.nom + " : " + (pos.raison === "detenu" ? "le client détient déjà cette convention." : "le client n'y est pas éligible."));
      o.carte = "";
      if (Array.isArray(o.services)) {
        /* panier de services : le conseiller a composé la convention du client ; on ne retient que les services de la convention (la carte y est toujours). GS Connect et GS Alertes ne sont activés que s'ils sont dans le panier. */
        var panier = KC.panierConvention(pc.convention, { cpt: { p: o.compte } }, o.services, o.compte);
        if (!panier.ok) return erreur("panier", KC.MSG_MIN_SERVICES);
        o.services = panier.cles;
        o.distance = panier.cles.indexOf("connect") >= 0;
        o.sms = panier.cles.indexOf("sms") >= 0;
      } else o.distance = true;   /* dossier sans panier : tous les services de la convention, dont GS Connect */
    } else delete o.services;
    if (o.carte !== "" && CARTES.indexOf(o.carte) < 0) return erreur("carte", "Choisissez la carte parmi celles proposées.");
    if (o.carte === "") o.debit = "immediat";
    else if (CARTES_A_DEBIT.indexOf(o.carte) >= 0) { if (!lib(DEBITS, o.debit)) return erreur("debit", "Choisissez le type de débit de la carte : immédiat ou différé."); }
    else o.debit = "immediat";
    if (o.carte) {
      var E = mod("eligibilite"), ev = E.evaluer(c, o.carte), p = PR.parId[o.carte];
      if (ev.verdict === "detenu") return erreur("carte", "Le client détient déjà " + p.nom + ".");
      var seuil = SEUILS_CARTE[o.carte];
      /* Prospect : ses revenus sont ceux qu'il déclare (contrôlés ci-dessous) ; le moteur du catalogue juge les autres conditions. */
      var motifs = (seuil && o.titulaire !== "client") ? ev.verifiees.filter(function (l) { return l.ok === false && !/^Revenus nets/.test(l.lib); }).map(function (l) { return l.detail; }) : (ev.verdict === "non" ? ev.motifs : []);
      if (motifs.length) return erreur("carte", p.nom + " : " + motifs.join(" "));
      if (seuil && o.titulaire !== "client" && (o.revenus < seuil || o.objet !== "principal")) return erreur("carte", p.nom + " : revenus nets d'au moins " + B.eur(seuil) + " par mois domiciliés à GS Banque & Assurance. Le prospect déclare " + B.eur(o.revenus) + (o.objet !== "principal" ? " et n'ouvre pas ce compte pour y domicilier ses revenus (objet : « " + lib(OBJETS, o.objet).toLowerCase() + " »)." : "."));
    }
    /* Remise de la carte (toujours commandée : retrait à l'agence ou envoi à domicile avec frais) et du chéquier (stock de dépannage de l'agence, retrait en main propre ou envoi à domicile avec frais). */
    var KK = mod("catalogue");
    var carteRemise = conv ? (KK.carteLivree(st || {}, c, conv) || "") : o.carte;
    if (carteRemise) { var rc = KK.controleRemise(st || {}, carteRemise, o.canal, o.remise); if (!rc.ok) return erreur("remise", rc.erreur); } else o.remise = "";
    if (o.cheque && restrictions(o).cheque) return erreur("cheque", "Chéquier impossible : un titulaire est inscrit au fichier central des chèques (FCC). Le compte est ouvert sans chéquier.");
    if (o.cheque) { var rq = KK.controleRemise(st || {}, "chequier", o.canal, o.remiseCheque, "remiseCheque"); if (!rq.ok) return erreur("remiseCheque", rq.erreur); } else o.remiseCheque = "";
    return { ok: true };
  }
  /* Client « neuf » provisoire (avant l'ouverture) pour évaluer l'éligibilité des cartes sur le compte demandé. */
  function clientTemp(o, auj) {
    var c = clientDe({ id: 0, ref: "", fiche: Object.assign({}, o, { age: ageAu(o.naissance, auj) }), ouvert: { date: B.ymd(auj), heure: "00:00", num: "GS-4299999" } }, auj);
    c.cpt.ouvert = 0; return c;
  }

  /* Ouverture d'un compte supplémentaire pour un client de l'agence (le compte du portefeuille reste ouvert) : le dossier reprend l'identité du client, on confirme la connaissance client,
     la pièce d'identité, le compte, le moyen et l'équipement. */
  function controlerClient(f, clients, auj, st) {
    var c = client(clients, Number(f.client)), S = mod("synthese"), K = mod("catalogue");
    if (!c) return erreur("client", "Choisissez le client pour lequel le compte est ouvert.");
    var o = { titulaire: "client", client: c.id, civ: c.civ, nom: c.nom, prenom: c.prenom, naissance: naissanceClient(c), age: c.age, rue: c.adr.rue, cp: c.adr.cp, ville: c.adr.ville, mob: c.mob || "", mail: c.mail || "",
      situation: c.fam && c.fam.sit, logement: c.log && c.log.st, statut: c.pro.statut, profession: c.pro.prof, revenus: c.pro.rev || 0, enfants: (c.fam && c.fam.nbCharge) || 0,
      residence: f.residence, autocertification: !!f.autocertification, ppe: f.ppe, origine: f.origine, origineJustifiee: !!f.origineJustifiee, fcc: "", ficp: "", objet: f.objet, identite: f.identite, pieceIdentite: !!f.pieceIdentite, scans: scansDe(f, true),
      compte: f.compte, dac: "non", canal: f.canal, note: trim(f.note), reco: "non", parrainRef: "", parrain: null, carte: f.carte || "", debit: f.debit || "immediat", cheque: !!f.cheque, remise: f.remise || "", remiseCheque: f.remiseCheque || "", convention: f.convention || "", distance: !!f.distance, sms: !!f.sms, services: Array.isArray(f.services) ? f.services.filter(function (k) { return typeof k === "string"; }) : undefined, pieceDomicile: false, pieceRevenus: false };
    if (c.kyc > S.KYC_MAX) return erreur("client", nomClient(c) + " : le dossier client n'a pas été actualisé depuis plus de 5 ans. Actualisez-le lors d'un entretien (fiche client) avant d'ouvrir un compte.");
    if (!lib(RESIDENCES, o.residence)) return erreur("residence", "Indiquez la résidence fiscale du client.");
    if (o.ppe !== "oui" && o.ppe !== "non") return erreur("ppe", "Indiquez si le client est une personne politiquement exposée (PPE) ou proche d'une PPE.");
    if (!lib(ORIGINES, o.origine)) return erreur("origine", "Choisissez l'origine principale des fonds qui alimenteront le compte.");
    var eb = controlerBdf(o, f, auj); if (eb) return eb;
    var ed = controlerDecision(o, f.decision, ["decision", "decisionMotif"], "Le client"); if (ed) return ed;
    if (!lib(OBJETS, o.objet)) return erreur("objet", "Choisissez l'objet du compte.");
    if (!lib(PIECES_IDENTITE, o.identite)) return erreur("identite", "Choisissez le type de pièce d'identité présentée.");
    if (!o.pieceIdentite) return erreur("pieceIdentite", "Cochez la pièce d'identité : elle est vérifiée à chaque ouverture de compte (original en cours de validité, copie conservée).");
    if (COMPTES.indexOf(o.compte) < 0) return erreur("compte", "Choisissez le compte à ouvrir.");
    var deja = K.verdictClient(c, o.compte, st || {});
    if (deja.verdict === "non") return erreur("compte", PR.parId[o.compte].nom + " : " + deja.motifs.join(" "));
    if (o.compte === "JEUNE") {
      if (c.age < 18 || c.age > 25) return erreur("compte", "Le Compte Jeune s'adresse aux 18-25 ans : le client a " + c.age + " ans. Choisissez le compte courant Équilibre.");
      if (deja.verdict === "detenu") return erreur("compte", nomClient(c) + " détient déjà un Compte Jeune.");
    } else if (deja.verdict === "detenu" && o.objet !== "secondaire") return erreur("objet", nomClient(c) + " détient déjà un compte courant Équilibre : le nouveau compte est un compte secondaire (objet : « compte secondaire »).");
    if (!mod("catalogue").MOYENS[o.canal]) return erreur("canal", "Indiquez le moyen par lequel le compte est ouvert : mailing, appel, entretien en rendez-vous ou entretien à l'accueil.");
    /* forme du compte : individuel, joint ou indivis (les autres titulaires sont des personnes à part entière, clientes de l'agence ou non) */
    o.forme = f.forme === "joint" || f.forme === "indivis" ? f.forme : "individuel"; o.second = null; o.autres = []; o.indivision = null;
    if (o.forme !== "individuel") {
      if (o.compte === "JEUNE") return erreur("forme", "Le Compte Jeune est un compte individuel (18-25 ans) : choisissez le compte courant Équilibre pour un compte " + (o.forme === "joint" ? "joint" : "indivis") + ".");
      var e2c = controlerCotitulaires(o, f, auj, clients); if (e2c) return e2c;
      if (o.forme === "indivis") { var e3c = controlerIndivision(o, f, auj); if (e3c) return e3c; }
    }
    var eq = controlerEquipement(o, c, auj, null, st); if (!eq.ok) return eq;
    if (o.note.length > 300) return erreur("note", "La remarque est limitée à 300 caractères.");
    var enCours = dossiers(st).filter(function (d) { return d.id !== f.dossier && d.fiche.client === c.id && d.fiche.compte === o.compte && avis(d.fiche).code !== "refuse"; })[0];
    if (enCours) return { ok: false, champ: "client", erreur: "Un dossier d'ouverture de ce compte existe déjà pour ce client (" + enCours.ref + ") : ouvrez-le dans la liste des dossiers.", dossier: enCours.id };
    if (dejaSoumis(st, f.dossier)) { var av = avis(o); if (av.code === "complement") return erreur(av.complements[0].cle, "La directrice attend encore : " + av.complements[0].texte + " Cochez la case correspondante une fois l'élément obtenu."); }
    return { ok: true, fiche: o };
  }

  /* ---------- dossiers ---------- */
  function dossiers(st) { return st && Array.isArray(st.prospects) ? st.prospects : []; }
  function dossier(st, id) { return dossiers(st).filter(function (d) { return d.id === id || d.ref === id; })[0] || null; }
  function stamp(now) { return { date: B.ymd(now), heure: B.hhmm(now) }; }
  function instant(o) { var d = B.lireYmd(o.date), m = /^(\d{2}):(\d{2})$/.exec(o.heure || ""); return d && m ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), +m[1], +m[2]) : null; }

  /* Circuit d'un dossier : 1. le conseiller le constitue et le valide (« Validation du conseiller »), 2. il le soumet à validation de la directrice avec un commentaire facultatif
     (le dossier et la convention de compte demandée partent ensemble), 3. la directrice valide, demande un complément ou refuse, 4. le conseiller ouvre le compte.
     d.etat : « conseiller » (validé par le conseiller, pas encore soumis) ou « soumis ». d.conseiller : { date, heure, nom } de la dernière validation du conseiller.
     d.soumis : une entrée { date, heure, commentaire } par soumission à validation (une de plus après chaque complément). */
  var COMMENTAIRE_MAX = 300;
  function statutDe(d) { return d.etat || (d.soumis && d.soumis.length ? "soumis" : "conseiller"); }
  function dejaSoumis(st, id) { var d = id ? dossier(st || {}, id) : null; return !!(d && d.soumis && d.soumis.length); }
  function nomConseiller(st) { return (st && st.eleve && st.eleve.nom) || ""; }
  function validerConseiller(st, d, now) { var s = stamp(now); d.conseiller = { date: s.date, heure: s.heure, nom: nomConseiller(st) }; d.etat = avis(d.fiche).par === "conseiller" ? "refuse" : "conseiller"; }
  /* Crée le dossier : validé par le conseiller, pas encore soumis à la directrice. */
  function creer(st, fiche, now) {
    now = now || B.maintenant();
    var l = dossiers(st), id = ID_DEBUT + l.length;
    while (l.some(function (d) { return d.id === id; })) id++;
    var d = { id: id, ref: "OC-" + now.getFullYear() + "-" + String(l.length + 1).padStart(4, "0"), fiche: fiche, soumis: [], etat: "conseiller", conseiller: null, ouvert: null, par: nomConseiller(st) };
    validerConseiller(st, d, now);
    if (!Array.isArray(st.prospects)) st.prospects = [];
    st.prospects.push(d);
    return d;
  }
  /* Modification d'un dossier (complément demandé, ou correction avant la soumission) : nouvelle validation du conseiller, à soumettre de nouveau. */
  function reviser(st, id, fiche, now) {
    var d = dossier(st, id); if (!d || d.ouvert) return null;
    d.fiche = fiche; validerConseiller(st, d, now || B.maintenant());
    return d;
  }
  /* Soumet le dossier à validation de la directrice. commentaire : facultatif, 300 caractères au plus. Renvoie { ok, dossier } ou { ok: false, erreur }. */
  function soumettre(st, id, commentaire, now) {
    var d = dossier(st, id);
    if (!d) return { ok: false, erreur: "Dossier inconnu." };
    if (d.ouvert) return { ok: false, erreur: "Le compte est déjà ouvert." };
    if (statutDe(d) === "refuse") return { ok: false, erreur: "Le dossier est refusé par le conseiller : il ne peut pas être soumis à validation." };
    if (statutDe(d) !== "conseiller") return { ok: false, erreur: "Le dossier est déjà soumis à validation." };
    var c = trim(commentaire);
    if (c.length > COMMENTAIRE_MAX) return { ok: false, champ: "commentaire", erreur: "Le commentaire est limité à " + COMMENTAIRE_MAX + " caractères (" + c.length + " saisis)." };
    var s = stamp(now || B.maintenant()); s.commentaire = c;
    d.soumis.push(s); d.etat = "soumis";
    return { ok: true, dossier: d };
  }
  /* Raccourcis : validation du conseiller puis soumission dans la foulée (jeux d'essai, reprise de dossiers). */
  function deposer(st, fiche, now, commentaire) { var d = creer(st, fiche, now); soumettre(st, d.id, commentaire, now); return d; }
  function resoumettre(st, id, fiche, now, commentaire) { var d = reviser(st, id, fiche, now); if (!d) return null; soumettre(st, id, commentaire, now); return d; }
  function dateCreation(d) { return (d.soumis && d.soumis[0] ? d.soumis[0].date : d.conseiller ? d.conseiller.date : ""); }

  /* Instant où la directrice étudie la dernière soumission : même jour ouvré si le dossier arrive avant 16 h 30, sinon le jour ouvré suivant ; entre 1 h et 3 h après l'arrivée ou à partir de 9 h. */
  function revueAt(d, i) {
    if (!d.soumis || !d.soumis.length) return null;
    var s = d.soumis[i === undefined ? d.soumis.length - 1 : i], base = instant(s), h = empreinte(d.ref + "|revue|" + (i === undefined ? d.soumis.length - 1 : i));
    if (!base) return null;
    var minutes = 60 + (h >>> 3) % 130;
    if (B.estOuvre(B.jour(base)) && base.getHours() * 60 + base.getMinutes() < 16 * 60 + 30) return new Date(base.getTime() + minutes * 60000);
    var x = B.ouvreSuivant(B.plusJours(B.jour(base), B.estOuvre(B.jour(base)) && base.getHours() * 60 + base.getMinutes() >= 16 * 60 + 30 ? 1 : 0));
    var mn = 9 * 60 + (h >>> 3) % 150;
    return new Date(x.getFullYear(), x.getMonth(), x.getDate(), Math.floor(mn / 60), mn % 60);
  }
  /* Titulaires du compte, dans l'ordre : le premier titulaire (le demandeur), le second, puis les autres indivisaires s'il y en a.
     { cle: "principal" | "second" | "autre3"…, w: préfixe des champs du formulaire, rang, p: la personne (fiche, second titulaire ou indivisaire), nom }. */
  function titulaires(f) {
    var l = [{ cle: "principal", w: "", rang: 0, p: f }];
    if (f.second) l.push({ cle: "second", w: "s_", rang: 1, p: f.second });
    (f.autres || []).forEach(function (a, i) { l.push({ cle: "autre" + (i + 3), w: "u" + (i + 3) + "_", rang: i + 2, p: a }); });
    return l.map(function (t) { t.nom = t.p.civ + " " + t.p.prenom + " " + String(t.p.nom).toUpperCase(); return t; });
  }
  /* Risque présenté par une personne au vu de sa consultation de la Banque de France (règle de la directrice : bdf.js, risque). */
  function risqueDe(p) {
    var X = mod("bdf"), t = p && p.bdf ? p.bdf : { fcc: p && p.fcc === "oui" ? "interdit" : "aucun", ficp: p && p.ficp === "oui" ? "inscrit" : "aucun" };
    return X.risque(t);
  }
  /* Titulaires inscrits au FCC ou au FICP, avec leur risque (le demandeur au titre du droit au compte est désigné par la Banque de France : la banque doit ouvrir, il n'est pas apprécié). */
  function fiches(f) {
    return titulaires(f).filter(function (t) { return !(t.cle === "principal" && f.dac === "oui"); }).map(function (t) { t.risque = risqueDe(t.p); return t; }).filter(function (t) { return t.risque.niveau !== "aucun"; });
  }
  function dit(r) { return r.fcc && r.ficp ? "inscrit au FCC et au FICP" : r.fcc ? "interdit bancaire (inscrit au FCC)" : "inscrit au FICP"; }
  function citer(t) { return t.p.decision && t.p.decision.motif ? " (« " + t.p.decision.motif + " »)" : ""; }
  /* Restrictions du compte ouvert à des titulaires inscrits : pas de chéquier ni de prêt si l'un est inscrit au FCC ; ni découvert autorisé ni crédit renouvelable si l'un est inscrit au FICP. */
  function restrictions(f) {
    var r = { cheque: false, credit: false, liste: [], textes: [] };
    fiches(f).forEach(function (t) {
      if (t.risque.niveau !== "modere") return;
      if (t.risque.fcc) r.cheque = true;
      if (t.risque.ficp) r.credit = true;
      r.liste.push({ cle: t.cle, nom: t.nom, restrictions: t.risque.restrictions.slice() });
    });
    if (r.cheque) r.textes.push("pas de chéquier ni de prêt");
    if (r.credit) r.textes.push("ni découvert autorisé ni crédit renouvelable");
    return r;
  }
  /* Ce que le dossier devient : refus du conseiller (une personne inscrite au FCC ou au FICP pour laquelle il a choisi « refuser »), refus de la directrice (risque élevé), compléments, ou validation
     (avec restrictions si un titulaire est inscrit à un seul fichier pour un seul incident). Une inscription n'entraîne jamais un refus automatique : le risque s'apprécie, la directrice décide en dernier.
     Renvoie { code: refuse|complement|valide, par: conseiller|directrice (refus), motif, complements[], motifs[] (clés des personnes refusées), refus[], restrictions }. */
  function avis(f) {
    var fs = fiches(f), cons = fs.filter(function (t) { return t.p.decision && t.p.decision.choix === "refuser"; });
    function entree(t, par, motif) { return { cle: t.cle, nom: t.nom, p: t.p, par: par, motif: motif, fcc: t.risque.fcc, ficp: t.risque.ficp }; }
    if (cons.length) {
      var rc = cons.map(function (t) { return entree(t, "conseiller", t.p.decision.motif); });
      return { code: "refuse", par: "conseiller", motif: cons.map(function (t) { return t.nom + " est " + dit(t.risque) + " : le conseiller refuse l'ouverture (« " + t.p.decision.motif + " »)."; }).join(" "), motifs: cons.map(function (t) { return t.cle; }), refus: rc, complements: [], restrictions: restrictions(f) };
    }
    var el = fs.filter(function (t) { return t.risque.niveau === "eleve"; });
    if (el.length) {
      var rd = el.map(function (t) { return entree(t, "directrice", "Risque trop élevé : " + t.risque.raisons.join(", ") + "."); });
      var suit = fs.filter(function (t) { return t.p.decision && t.p.decision.choix === "ouvrir"; });
      return { code: "refuse", par: "directrice", complements: [], motifs: el.map(function (t) { return t.cle; }), refus: rd, restrictions: restrictions(f),
        motif: el.map(function (t) { return t.nom + " est " + dit(t.risque) + " : " + t.risque.raisons.join(", ") + ". Le risque est trop élevé pour ouvrir un compte."; }).join(" ") +
          (suit.length ? " La directrice ne suit pas l'avis favorable du conseiller" + suit.map(citer).join("") + "." : "") +
          " Le demandeur peut saisir la Banque de France pour qu'elle lui désigne un établissement (droit au compte)." };
    }
    var c = [];
    if (f.residence === "autre" && !f.autocertification) c.push({ cle: "autocertification", texte: "Résidence fiscale hors de France : faire remplir et signer l'auto-certification de résidence fiscale (échange automatique d'informations)." });
    if ((f.ppe === "oui" || f.origine === "autre") && !f.origineJustifiee) c.push({ cle: "origineJustifiee", texte: f.ppe === "oui" ? "Personne politiquement exposée : obtenir un justificatif de l'origine du patrimoine et des fonds (mesure de vigilance renforcée)." : "Origine des fonds « autre » : obtenir un justificatif de l'origine des fonds." });
    titulaires(f).slice(1).forEach(function (t) {
      var s = t.p, qui = t.rang === 1 ? "Second titulaire" : RANGS[t.rang], w = t.w, tete = qui + " (" + t.nom + ") : ";
      if (s.residence === "autre" && !s.autocertification) c.push({ cle: w + "autocertification", texte: tete + "résidence fiscale hors de France : faire remplir et signer l'auto-certification de résidence fiscale (échange automatique d'informations)." });
      if (s.ppe === "oui" && !s.origineJustifiee) c.push({ cle: w + "origineJustifiee", texte: tete + "personne politiquement exposée : obtenir un justificatif de l'origine du patrimoine et des fonds (mesure de vigilance renforcée)." });
    });
    var rs = restrictions(f);
    if (c.length) return { code: "complement", motif: "La directrice demande des éléments avant de valider.", complements: c, motifs: [], refus: [], restrictions: rs };
    var note = fs.map(function (t) { return t.nom + " est " + dit(t.risque) + " (" + t.risque.raisons.join(", ") + ") : la directrice suit l'avis favorable du conseiller" + citer(t) + " et autorise l'ouverture" + (t.risque.restrictions.length ? " avec restrictions (" + t.risque.restrictions.join(" ; ") + ")" : "") + "."; }).join(" ");
    return { code: "valide", motif: "Dossier complet et conforme." + (note ? " " + note : ""), note: note, complements: [], motifs: [], refus: [], restrictions: rs };
  }
  /* État affiché du dossier : { code: conseiller|attente|complement|refuse|valide|ouvert, libelle, detail, ton, actions[], complements[] }. */
  function etat(d, now) {
    now = now || B.maintenant();
    var dir = directeur(), nomDir = dir.civ + " " + dir.prenom + " " + dir.nom.toUpperCase();
    var r = { code: "", libelle: "", detail: "", ton: "info", actions: [], complements: [], revue: null, par: "", refus: [], restrictions: null };
    if (d.ouvert) { r.code = "ouvert"; r.libelle = "Compte ouvert"; r.ton = "ok"; r.detail = "Compte ouvert le " + B.fmtDate(B.lireYmd(d.ouvert.date)) + " (client " + d.ouvert.num + ")."; r.actions = ["equiper"]; return r; }
    if (statutDe(d) === "refuse") {
      var ar = avis(d.fiche), cr = d.conseiller || {};
      r.code = "refuse"; r.par = "conseiller"; r.libelle = "Refusé par le conseiller"; r.ton = "bad"; r.refus = ar.refus;
      r.detail = (cr.nom || "Le conseiller") + " refuse l'ouverture" + (cr.date ? " le " + B.fmtDate(B.lireYmd(cr.date)) : "") + ". " + ar.motif + " La lettre de refus d'ouverture de compte est à remettre au demandeur.";
      return r;
    }
    if (statutDe(d) === "conseiller") {
      var cv = d.conseiller || {}, ancien = d.soumis && d.soumis.length;
      r.code = "conseiller"; r.libelle = "Validé par le conseiller – à soumettre à validation"; r.ton = "info"; r.actions = ["soumettre", "modifier"];
      r.detail = "Dossier validé par " + (cv.nom || "le conseiller") + (cv.date ? " le " + B.fmtDate(B.lireYmd(cv.date)) + " à " + String(cv.heure || "").replace(":", " h ") : "") + ". Il reste à le soumettre à validation de " + nomDir + (ancien ? " (nouvelle soumission après le complément demandé)." : ".");
      return r;
    }
    var rev = revueAt(d), a = avis(d.fiche);
    if (!rev || rev > now) {
      r.code = "attente"; r.libelle = "En attente de validation de la directrice"; r.revue = rev;
      r.detail = "Dossier transmis à " + nomDir + " le " + B.fmtDate(instant(d.soumis[d.soumis.length - 1])) + " à " + d.soumis[d.soumis.length - 1].heure.replace(":", " h ") + ". " + (d.fiche.convention ? "La convention de compte demandée est soumise avec le dossier. " : "") + (rev ? "Réponse attendue " + (B.jour(rev).getTime() === B.jour(now).getTime() ? "aujourd'hui" : "le " + B.fmtDate(rev)) + "." : "");
      return r;
    }
    if (a.code === "refuse") { r.code = "refuse"; r.par = "directrice"; r.libelle = "Refusé par la directrice"; r.ton = "bad"; r.refus = a.refus; r.detail = nomDir + " refuse l'ouverture le " + B.fmtDate(rev) + " : " + a.motif; return r; }
    if (a.code === "complement") { r.code = "complement"; r.libelle = "Complément demandé par la directrice"; r.ton = "warn"; r.complements = a.complements; r.actions = ["completer"]; r.detail = nomDir + " a étudié le dossier le " + B.fmtDate(rev) + " : " + a.complements.length + " élément" + (a.complements.length > 1 ? "s" : "") + " à fournir avant validation."; return r; }
    r.code = "valide"; r.libelle = "Validé par la directrice"; r.ton = "ok"; r.actions = ["ouvrir"]; r.revue = rev; r.restrictions = a.restrictions;
    r.detail = nomDir + " a validé le dossier le " + B.fmtDate(rev) + " à " + B.hhmm(rev).replace(":", " h ") + "." + (a.note ? " " + a.note : "") + (d.fiche.dac === "oui" ? " Compte « droit au compte » (DAC) : services bancaires de base gratuits ; la mention DAC est posée à l'ouverture du compte." : "") + (d.fiche.convention ? " La convention de compte demandée est validée avec le dossier." : "") + " Le compte peut être ouvert.";
    return r;
  }

  /* Date du refus d'un dossier refusé : celle du conseiller, ou celle de la réponse de la directrice (la lettre de refus est remise sans délai). */
  function dateRefus(d) {
    if (statutDe(d) === "refuse") return d.conseiller && d.conseiller.date ? B.lireYmd(d.conseiller.date) : B.aujourdhui();
    var rv = revueAt(d); return rv ? B.jour(rv) : null;
  }
  /* Personnes refusées d'un dossier refusé (une lettre de refus chacune) : [{ cle, nom, p, par, motif, fcc, ficp }], vide si le dossier n'est pas refusé. */
  function refusDe(d, now) { var e = etat(d, now); return e.code === "refuse" ? e.refus : []; }

  /* ---------- ouverture du compte ---------- */
  function numeroClient(st, d) {
    if (d.fiche && d.fiche.client) { var c = client(portefeuille(), d.fiche.client); return c ? c.num : ""; }
    var n = PREFIXE_NUM + 1 + (d.id - ID_DEBUT);
    return "GS-" + n;
  }
  /* Rang du compte ouvert dans les RIB du client : 2 pour un compte supplémentaire d'un client du portefeuille, 1 pour un nouveau client. */
  function rangCompte(d) { return d && d.fiche && d.fiche.client ? 2 : 1; }
  /* Ouvre le compte : numéro de client, souscription du compte dans le catalogue (convention de compte à signer selon le moyen, avec les services choisis), puis la carte demandée
     (contrat de carte, même moyen). Renvoie { ok, dossier, souscription, carte } ou { ok: false, erreur }. */
  function ouvrir(st, id, now) {
    var d = dossier(st, id); if (!d) return { ok: false, erreur: "Dossier inconnu." };
    now = now || B.maintenant();
    var e = etat(d, now);
    if (e.code === "ouvert") return { ok: false, erreur: "Le compte est déjà ouvert." };
    if (e.code !== "valide") return { ok: false, erreur: "La directrice n'a pas encore validé le dossier : l'ouverture n'est possible qu'après sa validation." };
    var f = d.fiche, K = mod("catalogue");
    d.ouvert = { date: B.ymd(now), heure: B.hhmm(now), num: numeroClient(st, d) };
    var c = clientDe(d, now);
    if (f.dac === "oui") {
      /* compte « droit au compte » (DAC) : services bancaires de base gratuits, carte à autorisation systématique incluse, ni chéquier ni découvert ; la mention DAC est posée ici, à l'ouverture */
      var rd = K.souscrireCompte(st, c, "DAC", { note: "Ouverture d'un compte droit au compte (dossier " + d.ref + ")", canal: f.canal, options: { dossier: d.ref, dac: true, designation: f.dacDate, resume: [
        ["Mention du compte", "DAC – droit au compte"], ["Désignation de la Banque de France", B.fmtDate(B.lireYmd(f.dacDate))],
        ["Services", "Services bancaires de base, gratuits (article D312-5-1 du Code monétaire et financier)"], ["Carte", "Carte de paiement à autorisation systématique, commandée et à retirer à l'agence"],
        ["Chéquier et découvert", "Aucun : deux chèques de banque par mois, ou moyen de paiement équivalent"]] } });
      if (!rd.ok) { d.ouvert = null; return rd; }
      d.ouvert.souscription = rd.souscription.id; d.ouvert.dac = true;
      return { ok: true, dossier: d, souscription: rd.souscription, carte: null, convention: null, connect: null, alertes: null, dac: true };
    }
    var svcConv = f.convention ? PR.parId[f.convention].convention.services : [];
    function inclus(k) { return svcConv.some(function (x) { return x.k === k; }); }
    var r = K.souscrireCompte(st, c, f.compte, { note: "Ouverture de compte (dossier " + d.ref + ")", canal: f.canal, options: { cheque: !!f.cheque, remiseCheque: f.remiseCheque || "", distance: !!f.distance, connectInclus: inclus("connect"), alertesInclus: inclus("sms"), sms: !!f.sms, rang: rangCompte(d), dossier: d.ref, titulaires: titulairesCompte(f) } });
    if (!r.ok) { d.ouvert = null; return r; }
    d.ouvert.souscription = r.souscription.id;
    var carte = null, convention = null, connect = null, alertes = null;
    function defaire() { K.annulerSouscription(st, r.souscription.id); if (connect && connect.ok) K.annulerSouscription(st, connect.souscription.id); if (alertes && alertes.ok) K.annulerSouscription(st, alertes.souscription.id); d.ouvert = null; }
    if (f.distance && !f.convention) {
      /* GS Connect hors convention : abonnement de 3 € par mois, avec son propre contrat ; avec une convention, il est compris dans la cotisation */
      var pieceC = K.PIECES_ID.some(function (x) { return x.v === f.identite; }) ? f.identite : "cni";
      connect = K.souscrire(st, c, "GCON", { canal: f.canal, confirmees: 99, idverif: "oui", idpiece: pieceC, note: "GS Connect demandé à l'ouverture du compte (dossier " + d.ref + ")", options: { dossier: d.ref } });
      if (!connect.ok) { defaire(); return connect; }
      d.ouvert.connect = connect.souscription.id;
    }
    if (f.sms && !f.convention) {
      /* GS Alertes hors convention : abonnement de 1,50 € par mois, avec son propre contrat (réglage standard, modifiable ensuite en agence) ; avec une convention, l'alerte de compte est comprise dans la cotisation */
      var pieceA = K.PIECES_ID.some(function (x) { return x.v === f.identite; }) ? f.identite : "cni";
      alertes = K.souscrire(st, c, "GALE", { canal: f.canal, confirmees: 99, idverif: "oui", idpiece: pieceA, note: "GS Alertes demandé à l'ouverture du compte (dossier " + d.ref + ")", options: { formule: "alerte", heure: "10", seuilSolde: "100", seuilDebit: "200" } });
      if (!alertes.ok) { defaire(); return alertes; }
      d.ouvert.alertes = alertes.souscription.id;
    }
    if (f.convention) {
      /* la convention délivre sa carte (remise choisie dans le dossier) ; l'identité du client a été contrôlée à l'entrée en relation */
      var pieceId = K.PIECES_ID.some(function (x) { return x.v === f.identite; }) ? f.identite : "cni";
      convention = K.souscrire(st, c, f.convention, { canal: f.canal, confirmees: 99, remise: f.remise, idverif: "oui", idpiece: pieceId, note: "Convention de compte choisie à l'ouverture (dossier " + d.ref + ")", options: { dossier: d.ref, services: f.services, compte: f.compte } });
      if (!convention.ok) { defaire(); return convention; }
      d.ouvert.convention = convention.souscription.id;
      if (convention.carte) { carte = convention.carte; d.ouvert.carte = carte.id; }
    }
    else if (f.carte) {
      var rc = K.souscrireEquipement(st, c, f.carte, { note: "Carte demandée à l'ouverture du compte (dossier " + d.ref + ")", canal: f.canal, remise: f.remise, options: { debit: f.debit, dossier: d.ref } });
      if (!rc.ok) { defaire(); return rc; }
      carte = rc.souscription; d.ouvert.carte = carte.id;
    }
    return { ok: true, dossier: d, souscription: r.souscription, carte: carte, convention: convention ? convention.souscription : null, connect: connect ? connect.souscription : null, alertes: alertes ? alertes.souscription : null };
  }

  /* Client reconnu par le reste de l'application (catalogue, questionnaire MIFID, contrats). Dossier d'un client de l'agence : le client du portefeuille lui-même.
     Dossier d'un prospect : client « neuf », mêmes champs qu'un client du portefeuille, sans produits ni mouvements. */
  /* Famille du client créé par un dossier : celle du dossier, complétée par la fiche client une fois le compte ouvert (d.complement : situation, conjoint, enfants). Le second titulaire d'un compte
     joint ou indivis qui est le conjoint, le partenaire ou le concubin du client figure aussi comme conjoint. */
  function famille(d) {
    var f = d.fiche, comp = d.complement || null, s = f.second, auj = B.aujourdhui();
    var fam = { sit: comp ? comp.sit : f.situation, conj: null, enf: [], nbCharge: comp ? comp.enf.filter(function (e) { return e.charge; }).length : f.enfants };
    if (comp) fam.enf = comp.enf.map(function (e) { return { prenom: e.prenom, age: ageAu(e.naissance, auj), sexe: e.sexe }; });
    var cj = comp ? comp.conj : null;
    if (!cj && !comp && s && s.lien === "couple" && ["marie", "pacse", "concubinage"].indexOf(fam.sit) >= 0) cj = { civ: s.civ, prenom: s.prenom, nom: s.nom, naissance: s.naissance, statut: s.statut, prof: s.profession, rev: 0, banque: "GS" };
    if (cj) fam.conj = { prenom: cj.prenom, nom: cj.nom, age: ageAu(cj.naissance, auj), sexe: cj.civ === "Mme" ? "F" : "M", banque: cj.banque || "ext", statut: cj.statut, rev: cj.rev || 0, prof: cj.prof };
    return fam;
  }
  /* Titulaires du compte autres que le premier : [{ civ, prenom, nom }], vide pour un compte individuel. */
  function coTitulaires(f) { return titulaires(f).slice(1).map(function (t) { return { civ: t.p.civ, prenom: t.p.prenom, nom: t.p.nom }; }); }
  /* Description du compte ouvert (forme, titulaires autres que le premier, indivision) conservée avec la souscription : le RIB et le contrat en dépendent, y compris pour le compte supplémentaire d'un client. */
  function titulairesCompte(f) { var co = coTitulaires(f); return co.length ? { forme: f.forme === "indivis" ? "indivis" : "joint", coTits: co, indivision: f.forme === "indivis" ? f.indivision || null : null } : null; }
  function clientDe(d, now) {
    now = now || B.maintenant();
    var f = d.fiche;
    if (f.client) return client(portefeuille(), f.client);
    var n = B.lireYmd(f.naissance), st0 = STATUTS.filter(function (x) { return x[0] === f.statut; })[0], jours = d.ouvert ? Math.max(0, B.ecartJours(B.aujourdhui(), B.lireYmd(d.ouvert.date))) : 0, fam = famille(d);
    return {
      id: d.id, num: d.ouvert ? d.ouvert.num : "En cours d'ouverture", prospect: d.id, civ: f.civ, sexe: f.civ === "M." ? "M" : "F", prenom: f.prenom, nom: f.nom, age: ageAu(f.naissance, B.aujourdhui()), nai: [n.getMonth() + 1, n.getDate()], naissance: f.naissance,
      pro: { statut: f.statut, autres: [], rev: f.revenus, emp: f.profession, ctr: st0[3], prof: f.profession, cat: st0[2], anc: 0, parts: 1 + (fam.sit === "marie" || fam.sit === "pacse" ? 1 : 0) + fam.nbCharge * 0.5, foyer: f.revenus },
      fam: fam, rfr: Math.round(f.revenus * 12 * 0.9), adr: { rue: f.rue, cp: f.cp, ville: f.ville },
      formeCompte: f.second ? f.forme : "individuel", coTit: f.second ? { civ: f.second.civ, prenom: f.second.prenom, nom: f.second.nom } : null, coTits: coTitulaires(f), indivision: f.second && f.forme === "indivis" ? f.indivision : null,
      log: { st: f.logement, loyer: 0, bailleur: "", social: false, depuis: 0, jLoy: 5 }, cre: [], depuis: jours, cpt: { p: f.compte || "CPT", ouvert: jours, dec: 0 }, dac: f.dac === "oui", restr: (function () { var r = restrictions(f); return { cheque: r.cheque, credit: r.credit }; })(), epa: [], plc: [], cartes: [], veh: false, ass: [],
      m: { fx: [], ev: [], inc: [], sc: "", vext: [], vextMontant: 0, rev: [], s: 0, fl: 0, am: 0 }, inc: [], kyc: 0, prj: [], not: [], tel: "", mob: f.mob, mail: f.mail
    };
  }
  /* Fiche client complétée après l'ouverture du compte : situation familiale, conjoint, enfants. saisie : { sit, conj: { civ, prenom, nom, naissance, statut, profession, revenus } | null,
     enfants: [{ prenom, naissance, sexe: "M"|"F", charge: bool }] }. Le second titulaire lié au client comme conjoint, partenaire ou concubin reste son conjoint. Renvoie { ok, dossier } ou { ok: false, champ, erreur }. */
  function completer(st, id, saisie, now) {
    var d = dossier(st, id), E = erreur;
    if (!d) return E("", "Dossier inconnu.");
    if (d.fiche.client) return E("", "La fiche d'un client de l'agence se complète par un entretien (fiche client), pas par ce dossier.");
    if (!d.ouvert) return E("", "Le compte n'est pas encore ouvert : la fiche client se complète après l'ouverture.");
    now = now || B.maintenant(); saisie = saisie || {};
    var f = d.fiche, auj = B.jour(now), s = f.second, couple = ["marie", "pacse", "concubinage"];
    if (!lib(SITUATIONS, saisie.sit)) return E("fc-sit", "Choisissez la situation familiale.");
    var liee = s && s.lien === "couple";
    if (liee && couple.indexOf(saisie.sit) < 0) return E("fc-sit", "Le second titulaire du compte, " + s.civ + " " + s.prenom + " " + s.nom.toUpperCase() + ", est son conjoint, son partenaire ou son concubin : la situation familiale reste « marié(e) », « pacsé(e) » ou « en concubinage ».");
    var conj = null;
    if (couple.indexOf(saisie.sit) >= 0) {
      var c = liee ? { civ: s.civ, prenom: s.prenom, nom: s.nom, naissance: s.naissance, statut: s.statut, prof: s.profession, rev: 0, banque: "GS" } : saisie.conj || {};
      if (!liee) {
        var rv = c.revenus;
        c = { civ: c.civ, prenom: trim(c.prenom), nom: trim(c.nom), naissance: trim(c.naissance), statut: c.statut, prof: trim(c.profession), rev: 0, banque: "ext" };
        if (CIVS.indexOf(c.civ) < 0) return E("fc-conj-civ", "Conjoint : choisissez la civilité.");
        if (!RE_NOM.test(c.prenom)) return E("fc-conj-prenom", "Conjoint : saisissez le prénom.");
        if (!RE_NOM.test(c.nom)) return E("fc-conj-nom", "Conjoint : saisissez le nom de famille.");
        if (!B.lireYmd(c.naissance) || ageAu(c.naissance, auj) < 18 || ageAu(c.naissance, auj) > 110) return E("fc-conj-naissance", "Conjoint : saisissez une date de naissance plausible (la personne doit être majeure).");
        if (!STATUTS.filter(function (x) { return x[0] === c.statut; })[0]) return E("fc-conj-statut", "Conjoint : choisissez la situation professionnelle.");
        if (!c.prof || c.prof.length > 60) return E("fc-conj-profession", "Conjoint : indiquez la profession (60 caractères au plus).");
        var rev = nombre(rv === undefined ? "0" : rv); if (isNaN(rev) || rev > 100000) return E("fc-conj-revenus", "Conjoint : saisissez ses revenus mensuels nets en euros (0 s'il n'y en a pas).");
        c.rev = rev;
      }
      conj = c;
    }
    var enf = Array.isArray(saisie.enfants) ? saisie.enfants : [], liste = [];
    if (enf.length > 8) return E("fc-enfants", "Huit enfants au plus.");
    for (var i = 0; i < enf.length; i++) {
      var e = enf[i] || {}, pr = trim(e.prenom), nai = trim(e.naissance), n = i + 1;
      if (!RE_NOM.test(pr)) return E("fc-enf-prenom-" + n, "Enfant " + n + " : saisissez le prénom.");
      if (!B.lireYmd(nai) || nai > B.ymd(auj) || ageAu(nai, auj) > 40) return E("fc-enf-naissance-" + n, "Enfant " + n + " : saisissez une date de naissance plausible.");
      if (e.sexe !== "M" && e.sexe !== "F") return E("fc-enf-sexe-" + n, "Enfant " + n + " : précisez s'il s'agit d'une fille ou d'un garçon.");
      liste.push({ prenom: pr, naissance: nai, sexe: e.sexe, charge: !!e.charge });
    }
    var s0 = stamp(now);
    d.complement = { sit: saisie.sit, conj: conj, enf: liste, date: s0.date, heure: s0.heure, par: nomConseiller(st) };
    return { ok: true, dossier: d };
  }
  /* Clients créés pendant l'exercice dont le compte est ouvert (les clients du portefeuille qui ont ouvert un compte supplémentaire y sont déjà). */
  function clientsOuverts(st) { return dossiers(st).filter(function (d) { return d.ouvert && !d.fiche.client; }).map(function (d) { return clientDe(d); }); }
  function tousClients(base, st) { return base.concat(clientsOuverts(st)); }
  function estProspect(c) { return !!(c && c.prospect); }
  function lienClient(c) { return estProspect(c) ? "prospect.html?dossier=" + c.prospect : "client.html?id=" + c.id; }
  function dossierDeClient(st, cid) { return dossiers(st).filter(function (d) { return d.id === cid && !d.fiche.client; })[0] || null; }
  /* Dossiers d'ouverture d'un client du portefeuille. */
  function dossiersDuClient(st, cid) { return dossiers(st).filter(function (d) { return d.fiche.client === cid; }); }

  /* ---------- recommandation et offre de parrainage ---------- */
  /* Situation de l'offre de parrainage d'un dossier recommandé par un client : conditions du parrain (ancienneté, foyer, plafond de filleuls), puis conditions du filleul
     (compte ouvert, carte de paiement souscrite dans le délai). Renvoie null s'il n'y a pas de recommandation. */
  function parrainage(st, d, now, base) {
    var f = d && d.fiche; if (!f || f.reco !== "oui" || !f.parrain) return null;
    now = now || B.maintenant(); base = base || portefeuille();
    var pa = client(base, f.parrain.id), motifs = [];
    var r = { parrain: f.parrain, primeParrain: PARRAINAGE.primeParrain, primeFilleul: PARRAINAGE.primeFilleul, applicable: false, motifs: motifs, statut: "", libelle: "", detail: "", versement: null, limite: null };
    if (!pa) motifs.push("Le client qui recommande n'est pas retrouvé dans le portefeuille.");
    else {
      if (pa.depuis < PARRAINAGE.ancienneteJours) motifs.push("Le parrain est client depuis " + pa.depuis + " jours seulement : l'offre exige au moins " + Math.round(PARRAINAGE.ancienneteJours / 30) + " mois d'ancienneté.");
      if (pa.adr && adresseNorm(pa.adr) === adresseNorm({ rue: f.rue, cp: f.cp, ville: f.ville })) motifs.push("Le parrain et le filleul habitent à la même adresse : l'offre ne s'applique pas au sein d'un même foyer.");
      var avant = dossiers(st).filter(function (x) { return x.id < d.id && x.fiche.reco === "oui" && x.fiche.parrain && x.fiche.parrain.id === pa.id && avis(x.fiche).code !== "refuse" && B.ecartJours(B.lireYmd(x.soumis[0].date), B.lireYmd(d.soumis[0].date)) >= -PARRAINAGE.fenetreJours; }).length;
      if (avant >= PARRAINAGE.plafond) motifs.push("Le parrain a déjà " + avant + " filleuls sur 12 mois : le plafond de " + PARRAINAGE.plafond + " filleuls est atteint.");
    }
    if (avis(f).code === "refuse") motifs.push("Le dossier du filleul est refusé.");
    var det = PARRAINAGE.primeParrain + " € pour le parrain et " + PARRAINAGE.primeFilleul + " € pour le filleul, versés " + PARRAINAGE.delaiMois + " mois après l'ouverture du compte si le filleul a souscrit une carte bancaire de paiement";
    if (motifs.length) { r.statut = "inapplicable"; r.libelle = "Offre de parrainage non applicable"; r.detail = motifs.join(" "); return r; }
    r.applicable = true;
    if (!d.ouvert) { r.statut = "attente"; r.libelle = "Offre de parrainage applicable"; r.detail = "Primes de " + det + " dans ce délai. Elles ne sont dues qu'après l'ouverture du compte."; return r; }
    var ouv = B.lireYmd(d.ouvert.date), fin = plusMois(ouv, PARRAINAGE.delaiMois); r.limite = fin;
    var carte = ((st && st.souscriptions) || []).filter(function (x) { return x.c === d.id && CARTES_PAIEMENT.indexOf(x.p) >= 0; })[0];
    if (carte) {
      r.versement = fin;
      r.statut = B.jour(now) >= B.jour(fin) ? "verse" : "acquise";
      r.libelle = r.statut === "verse" ? "Primes de parrainage versées" : "Offre de parrainage acquise";
      r.detail = (r.statut === "verse" ? "Primes versées le " : "Conditions remplies : primes versées le ") + B.fmtDate(fin) + " (" + PARRAINAGE.primeParrain + " € au parrain, " + PARRAINAGE.primeFilleul + " € au filleul).";
    } else if (B.jour(now) > B.jour(fin)) { r.statut = "perdue"; r.libelle = "Offre de parrainage perdue"; r.detail = "Aucune carte bancaire de paiement n'a été souscrite avant le " + B.fmtDate(fin) + " : les primes ne sont pas versées."; }
    else { r.statut = "carte"; r.libelle = "Offre de parrainage : carte à souscrire"; r.detail = "Pour que les primes soient versées, le filleul doit souscrire une carte bancaire de paiement avant le " + B.fmtDate(fin) + "."; }
    return r;
  }
  /* Filleuls d'un client du portefeuille : { dossier, parrainage }. */
  function parrainagesDe(st, cid, now, base) {
    return dossiers(st).filter(function (d) { return d.fiche.reco === "oui" && d.fiche.parrain && d.fiche.parrain.id === cid; }).map(function (d) { return { dossier: d, parrainage: parrainage(st, d, now, base) }; });
  }

  var api = { titulaires: titulaires, coTitulaires: coTitulaires, titulairesCompte: titulairesCompte, PREFIXES_CO: PREFIXES_CO, CO_MAX: CO_MAX, risqueDe: risqueDe, restrictions: restrictions, dateRefus: dateRefus, refusDe: refusDe, RANGS: RANGS, DECISION_MOTIF_MAX: DECISION_MOTIF_MAX, DECISION_MOTIF_MIN: DECISION_MOTIF_MIN, ID_DEBUT: ID_DEBUT, COMPTES: COMPTES, CIVS: CIVS, SITUATIONS: SITUATIONS, LOGEMENTS: LOGEMENTS, STATUTS: STATUTS, PIECES_IDENTITE: PIECES_IDENTITE, ORIGINES: ORIGINES, OBJETS: OBJETS, RESIDENCES: RESIDENCES,
    lib: lib, mobile: mobile, scansDe: scansDe, PIECES_SCAN: PIECES_SCAN, controler: controler, dossiers: dossiers, dossier: dossier, creer: creer, reviser: reviser, soumettre: soumettre, deposer: deposer, resoumettre: resoumettre, statutDe: statutDe, dateCreation: dateCreation, COMMENTAIRE_MAX: COMMENTAIRE_MAX, revueAt: revueAt, avis: avis, etat: etat, ouvrir: ouvrir, clientDe: clientDe, clientsOuverts: clientsOuverts,
    tousClients: tousClients, estProspect: estProspect, lienClient: lienClient, dossierDeClient: dossierDeClient, directeur: directeur, ageAu: ageAu, numeroClient: numeroClient,
    CONVENTIONS: CONVENTIONS, conventionsProposees: conventionsProposees, CARTES: CARTES, CARTES_PAIEMENT: CARTES_PAIEMENT, DEBITS: DEBITS, SEUIL_PREMIER: SEUIL_PREMIER, SEUILS_CARTE: SEUILS_CARTE, CARTES_A_DEBIT: CARTES_A_DEBIT, PARRAINAGE: PARRAINAGE, parrainage: parrainage, parrainagesDe: parrainagesDe, trouverParrain: trouverParrain, rangCompte: rangCompte,
    FORMES: FORMES, LIENS: LIENS, INDIVISIONS: INDIVISIONS, completer: completer, famille: famille,
    dossiersDuClient: dossiersDuClient, portefeuille: portefeuille, nomClient: nomClient };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.prospects = api; }
})(typeof window !== "undefined" ? window : null);
