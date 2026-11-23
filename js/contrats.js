/* GS Banque & Assurance – contrats des souscriptions : signature électronique à distance (vente par mailing ou par appel) ou contrat imprimé à faire signer en agence
   (entretien en rendez-vous ou à l'accueil), état du contrat, délai de rétractation, contenu du contrat à imprimer et de l'e-mail d'envoi. Aucun affichage ici.
   La signature du client à distance est SIMULÉE : elle arrive après un délai qui dépend, de façon stable, de la souscription (le client signe vite, plus tard, ou doit être relancé).
   Les délais de rétractation sont ceux du droit français : 14 jours calendaires pour les contrats de services financiers conclus à distance, 30 jours calendaires pour l'assurance-vie
   (Code des assurances, art. L132-5-1) et le plan d'épargne retraite individuel, quel que soit le moyen. Banque, contrats, numéros et clients sont fictifs. */
(function (root) {
  "use strict";

  var B = root && root.SGBF ? root.SGBF.banque : require("./banque.js");
  var PR = root && root.SGBF ? root.SGBF.produits : require("./produits.js");

  var DISTANCE = { mail: true, appel: true, rdv: false, accueil: false };
  var VALIDITE_LIEN = 30;    /* jours : au-delà, le lien de signature n'est plus valable et il faut renvoyer le contrat */
  var JOURS_RELANCE = 3;     /* jours ouvrés sans signature avant de proposer une relance */
  var JOURS_RETRACTATION = { AV: 30, AVP: 30, AVE: 30, MGS: 30, MGE: 30, MGD: 30, PER: 30, DECES: 30, DEP: 30, OBSQ: 30 };
  var JOURS_RETRACTATION_DISTANCE = 14;

  var DOCUMENTS = { compte: "Convention de compte de dépôt", carte: "Contrat porteur de carte bancaire", epargne: "Conditions particulières du livret", credit: "Offre de contrat de crédit", assurance: "Conditions particulières du contrat d'assurance" };
  var DOCUMENTS_PRODUIT = { AV: "Bulletin de souscription du contrat d'assurance-vie", PEA: "Convention de plan d'épargne en actions (compte-titres et compte espèces)", PER: "Bulletin d'adhésion au plan d'épargne retraite individuel",
    AVP: "Bulletin de souscription du contrat d'assurance-vie GS Vie Premium", AVE: "Bulletin de souscription du contrat d'assurance-vie au nom d'un enfant mineur",
    MGS: "Avenant au contrat d'assurance-vie – mandat de gestion pilotée", MGE: "Avenant au contrat d'assurance-vie – mandat de gestion pilotée", MGD: "Avenant au contrat d'assurance-vie – mandat de gestion pilotée",
    PEAJ: "Convention de PEA Jeunes (compte-titres et compte espèces)", PEAPME: "Convention de PEA-PME-ETI (compte-titres et compte espèces)", CTO: "Convention de compte-titres ordinaire et de compte espèces associé",
    PSOC: "Bulletin de souscription de parts sociales", AUTZ: "Mandat de versements programmés AUTOMATIZ", CAT: "Conditions particulières du compte à terme",
    CVM: "Contrat d'offre groupée de services pour un mineur (convention de compte)", DAC: "Convention de compte de dépôt – droit au compte (services bancaires de base)", MPAY: "Conditions particulières du contrat d'assurance des moyens de paiement",
    GCON: "Contrat d'abonnement à GS Connect (banque à distance)", GALE: "Contrat d'abonnement à GS Alertes (alertes par SMS)", APN: "Conditions particulières du contrat d'assurance des appareils nomades",
    CVJ: "Contrat d'offre groupée de services (convention de compte)", CVA: "Contrat d'offre groupée de services (convention de compte)", CVS: "Contrat d'offre groupée de services (convention de compte)",
    DEP: "Conditions particulières du contrat d'assurance dépendance", DECES: "Conditions particulières du contrat d'assurance décès", OBSQ: "Conditions particulières du contrat de garantie obsèques",
    MOB: "Contrat d'abonnement au forfait mobile", BOX: "Contrat d'abonnement à la box internet fibre", PACK: "Contrat d'abonnement au pack forfait mobile et box internet", ESIM: "Bon de commande de l'eSIM voyage" };
  function nomDocument(pid) { var p = PR.parId[pid]; return DOCUMENTS_PRODUIT[pid] || (p && DOCUMENTS[p.famille]) || "Contrat"; }

  function aDistance(canal) { return !!DISTANCE[canal]; }
  function mode(canal) { return aDistance(canal) ? "esign" : "papier"; }

  /* Empreinte stable d'un texte (même résultat à chaque ouverture : le comportement du client simulé ne change pas au rechargement de la page). */
  function empreinte(t) { var h = 2166136261; t = String(t); for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function instant(o) { /* { date: "AAAA-MM-JJ", heure: "HH:MM" } -> Date */
    var d = B.lireYmd(o.date), m = /^(\d{2}):(\d{2})$/.exec(o.heure || "");
    return d && m ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), +m[1], +m[2]) : null;
  }
  function stamp(d) { return { date: B.ymd(d), heure: B.hhmm(d) }; }
  function ouvresEcoulees(depuis, jusqu) { /* jours ouvrés entiers entre deux dates */
    var n = 0, x = B.jour(depuis), fin = B.jour(jusqu);
    for (var i = 0; i < 120 && x < fin; i++) { x = B.plusJours(x, 1); if (B.estOuvre(x)) n++; }
    return n;
  }

  /* ---------- création ---------- */
  function reference(s) {
    var d = String(s.date || "").replace(/-/g, "");
    return "CT-" + d + "-" + String(1000 + empreinte("ref|" + s.id) % 9000);
  }
  function nouveau(s) {
    return { ref: reference(s), doc: nomDocument(s.p), mode: mode(s.canal), envois: [], genere: null, signe: null };
  }
  function contrat(s) { return s && s.contrat && typeof s.contrat === "object" ? s.contrat : null; }

  /* ---------- signature simulée du client (à distance) ---------- */
  /* Instant de signature du client pour l'envoi d'indice i : null si le client ne signera pas sans relance. */
  function signatureAt(s, i) {
    var ct = contrat(s), e = ct && ct.envois[i]; if (!e) return null;
    var h = empreinte(s.id + "|signature|" + i), k = i === 0 ? h % 6 : h % 5, base = instant(e);
    if (!base) return null;
    if (k === 5) return null;                                   /* premier envoi : le client ne répond pas (1 cas sur 6) */
    var jours = [0, 0, 1, 1, 2][k], d;
    if (jours === 0) {
      d = new Date(base.getTime() + (35 + (h >>> 4) % 90) * 60000);
      if (d.getHours() >= 21 || d.getHours() < 7) { var n = B.ouvreSuivant(B.plusJours(B.jour(base), base.getHours() >= 21 ? 1 : 0)); d = new Date(n.getFullYear(), n.getMonth(), n.getDate(), 8, 30 + (h >>> 4) % 30); }
      return d;
    }
    var x = B.jour(base);
    for (var j = 0; j < jours; j++) x = B.ouvreSuivant(B.plusJours(x, 1));
    var minutes = 8 * 60 + 30 + (h >>> 4) % 600;
    return new Date(x.getFullYear(), x.getMonth(), x.getDate(), Math.floor(minutes / 60), minutes % 60);
  }

  /* ---------- état du contrat ---------- */
  var LIB = {
    a_envoyer: "À envoyer pour signature électronique", envoye: "Envoyé : en attente de la signature du client", relancer: "Sans réponse : à relancer", expire: "Lien expiré : à renvoyer", signe_ligne: "Signé électroniquement",
    a_generer: "À générer et à faire signer en agence", genere: "Remis au client : en attente de signature", signe_agence: "Signé en agence"
  };
  /* { code, libelle, detail, ton, signe: Date|null, actions[] } ; null si la souscription n'a pas de contrat (souscription antérieure à cette fonction). */
  function etat(s, now) {
    var ct = contrat(s); if (!ct) return null;
    now = now || B.maintenant();
    var r = { code: "", libelle: "", detail: "", ton: "info", signe: null, actions: [] };
    if (ct.mode === "esign") {
      var n = ct.envois.length;
      if (!n) { r.code = "a_envoyer"; r.libelle = LIB.a_envoyer; r.ton = "warn"; r.actions = ["envoyer"]; r.detail = "Le client recevra un e-mail avec un lien et un code à usage unique par SMS pour signer."; return r; }
      var dernier = ct.envois[n - 1], sg = signatureAt(s, n - 1), depuis = instant(dernier);
      if (sg && sg <= now) { r.code = "signe"; r.libelle = LIB.signe_ligne; r.ton = "ok"; r.signe = sg; r.detail = "Signé par le client le " + B.fmtDate(sg) + " à " + B.hhmm(sg).replace(":", " h ") + " (signature électronique, code reçu par SMS)."; return r; }
      var ouvres = ouvresEcoulees(depuis, now), jours = B.ecartJours(now, depuis);
      if (jours >= VALIDITE_LIEN) { r.code = "expire"; r.libelle = LIB.expire; r.ton = "bad"; r.actions = ["envoyer"]; r.detail = "Le lien envoyé le " + B.fmtDate(depuis) + " n'est plus valable (" + VALIDITE_LIEN + " jours)."; return r; }
      if (ouvres >= JOURS_RELANCE) { r.code = "relancer"; r.libelle = LIB.relancer; r.ton = "warn"; r.actions = ["envoyer"]; r.detail = "Envoyé le " + B.fmtDate(depuis) + " : le client n'a pas signé après " + ouvres + " jours ouvrés. Relancez-le par téléphone, puis renvoyez le lien."; return r; }
      r.code = "envoye"; r.libelle = LIB.envoye; r.detail = "Envoyé le " + B.fmtDate(depuis) + " à " + dernier.heure.replace(":", " h ") + " par e-mail" + (n > 1 ? " (" + n + "e envoi)" : "") + ". La signature n'est pas encore reçue."; return r;
    }
    if (ct.signe) { var sd = instant(ct.signe); r.code = "signe"; r.libelle = LIB.signe_agence; r.ton = "ok"; r.signe = sd; r.detail = "Signé par le client en agence le " + B.fmtDate(sd) + " à " + ct.signe.heure.replace(":", " h ") + "."; return r; }
    if (!ct.genere) { r.code = "a_generer"; r.libelle = LIB.a_generer; r.ton = "warn"; r.actions = ["generer"]; r.detail = "Le contrat s'imprime en deux exemplaires : le client le lit, le date et le signe devant vous."; return r; }
    r.code = "genere"; r.libelle = LIB.genere; r.actions = ["generer", "signer"]; r.detail = "Contrat généré le " + B.fmtDate(instant(ct.genere)) + " à " + ct.genere.heure.replace(":", " h ") + ". Quand le client l'a signé, enregistrez-le."; return r;
  }
  function signe(s, now) { var e = etat(s, now); return !!(e && e.code === "signe"); }

  /* ---------- rétractation ---------- */
  /* { jours, fin, texte } : jours = null quand la loi ne prévoit pas de délai (souscription en agence d'un produit autre que l'assurance-vie et le PER). */
  function retractation(s, now) {
    var ct = contrat(s); if (!ct) return null;
    now = now || B.maintenant();
    var j = JOURS_RETRACTATION[s.p] || (ct.mode === "esign" ? JOURS_RETRACTATION_DISTANCE : null), e = etat(s, now);
    if (!j) return { jours: null, fin: null, enCours: false, texte: "Souscription en agence : pas de délai légal de rétractation pour ce produit (les conditions du contrat peuvent en prévoir un)." };
    if (!e || e.code !== "signe") return { jours: j, fin: null, enCours: false, texte: "Délai de rétractation de " + j + " jours calendaires à compter de la signature." };
    var fin = B.plusJours(B.jour(e.signe), j), enCours = B.jour(now) <= fin;
    return { jours: j, fin: fin, enCours: enCours, texte: enCours ? "Rétractation possible jusqu'au " + B.fmtDate(fin) + " inclus (" + j + " jours calendaires)." : "Délai de rétractation de " + j + " jours écoulé le " + B.fmtDate(fin) + "." };
  }

  /* ---------- actions ---------- */
  function trouver(st, id) { return ((st && st.souscriptions) || []).filter(function (x) { return x.id === id; })[0] || null; }
  function envoyer(st, id, now) {
    var s = trouver(st, id), ct = contrat(s);
    if (!s || !ct) return { ok: false, erreur: "Souscription ou contrat inconnu." };
    if (ct.mode !== "esign") return { ok: false, erreur: "Ce contrat se signe en agence : il ne s'envoie pas à distance." };
    var e = etat(s, now);
    if (e.code === "signe") return { ok: false, erreur: "Le contrat est déjà signé." };
    if (e.code === "envoye") return { ok: false, erreur: "Le contrat est déjà envoyé : attendez la signature du client." };
    var env = stamp(now || B.maintenant());
    ct.envois.push(env);
    return { ok: true, envoi: env, souscription: s, relance: ct.envois.length > 1 };
  }
  function generer(st, id, now) {
    var s = trouver(st, id), ct = contrat(s);
    if (!s || !ct) return { ok: false, erreur: "Souscription ou contrat inconnu." };
    if (ct.mode !== "papier") return { ok: false, erreur: "Ce contrat s'envoie à distance pour signature électronique." };
    if (ct.signe) return { ok: false, erreur: "Le contrat est déjà signé." };
    ct.genere = stamp(now || B.maintenant());
    return { ok: true, souscription: s };
  }
  function signerEnAgence(st, id, now) {
    var s = trouver(st, id), ct = contrat(s);
    if (!s || !ct) return { ok: false, erreur: "Souscription ou contrat inconnu." };
    if (ct.mode !== "papier") return { ok: false, erreur: "Ce contrat se signe électroniquement : la signature arrive du client." };
    if (ct.signe) return { ok: false, erreur: "Le contrat est déjà signé." };
    if (!ct.genere) return { ok: false, erreur: "Générez d'abord le contrat pour le faire signer au client." };
    ct.signe = stamp(now || B.maintenant());
    return { ok: true, souscription: s };
  }

  /* ---------- contenus ---------- */
  var RANGS_TITULAIRE = ["Premier titulaire", "Second titulaire", "Troisième titulaire", "Quatrième titulaire", "Cinquième titulaire"];
  var BANQUE = "GS Banque & Assurance", AGENCE = "Agence de Paris", SIEGE = "27 rue de Châteaudun, 75009 Paris";
  var LEGALES = ["GS Banque & Assurance, société anonyme au capital de 250 000 000 €, siège social : 27 rue de Châteaudun, 75009 Paris, RCS Paris 412 308 976, immatriculée à l'ORIAS sous le numéro 09 047 361, soumise au contrôle de l'ACPR."];
  function epure(t) { return String(t == null ? "" : t).replace(/(t)aux en vigueur communiqué dans la newsletter/gi, function (m) { return (m.charAt(0) === "T" ? "T" : "t") + "aux en vigueur à la date de souscription, confirmé par le conseiller"; }).replace(/\s*\((?:[^()]*\s)?fictifs?\)/gi, "").replace(/\s+([.,])/g, "$1"); }
  /* Date de naissance du client « JJ/MM/AAAA » : date complète d'un client créé pendant l'exercice, sinon année déduite de l'âge et du jour d'anniversaire (le portefeuille ne stocke que le jour et le mois). */
  function naissanceDe(c) {
    function p2(n) { return (n < 10 ? "0" : "") + n; }
    if (c.naissance) { var d = B.lireYmd(c.naissance); if (d) return p2(d.getDate()) + "/" + p2(d.getMonth() + 1) + "/" + d.getFullYear(); }
    if (!c.nai || c.nai.length < 2 || typeof c.age !== "number") return "";
    var auj = B.aujourdhui(), m = c.nai[0], j = c.nai[1], passe = m < auj.getMonth() + 1 || (m === auj.getMonth() + 1 && j <= auj.getDate());
    return p2(j) + "/" + p2(m) + "/" + (auj.getFullYear() - c.age - (passe ? 0 : 1));
  }
  function ribModule() { if (root && root.SGBF && root.SGBF.rib) return root.SGBF.rib; try { return require("./rib.js"); } catch (e) { return null; } }
  function adresseClient(c) { return c && c.adr ? c.adr.rue + ", " + c.adr.cp + " " + c.adr.ville : ""; }
  function eur(n) { return B.eur2 ? B.eur2(n) : String(n); }

  /* E-mail simulé adressé au client avec le lien de signature (aperçu après l'envoi). */
  function emailEnvoi(s, c, relance) {
    var ct = contrat(s), p = PR.parId[s.p];
    var civ = c.civ === "M." ? "Monsieur" : "Madame";
    var corps = [civ + " " + c.nom.toUpperCase() + ",", "",
      relance ? "Je me permets de vous relancer : votre " + ct.doc.toLowerCase() + " (" + p.nom + ") n'est pas encore signé." : "Suite à notre échange, je vous adresse votre " + ct.doc.toLowerCase() + " (" + p.nom + ") pour signature électronique.", "",
      "Pour le signer, cliquez sur le lien sécurisé ci-dessous, relisez le document, puis saisissez le code à usage unique qui vous sera envoyé par SMS au numéro se terminant par " + String(c.mob || "").replace(/\D/g, "").slice(-2) + ".",
      "Lien de signature (valable " + VALIDITE_LIEN + " jours) : https://signature.gs-banque.example/contrat/" + ct.ref.toLowerCase(), "",
      (JOURS_RETRACTATION[s.p] ? "Vous disposez d'un délai de rétractation de " + JOURS_RETRACTATION[s.p] + " jours calendaires à compter de la signature." : "Vous disposez d'un délai de rétractation de " + JOURS_RETRACTATION_DISTANCE + " jours calendaires à compter de la signature."), "",
      "Je reste à votre disposition pour toute question.", "Cordialement,"];
    return { a: c.mail, objet: (relance ? "Rappel – " : "") + "Votre contrat à signer : " + p.nom + " (réf. " + ct.ref + ")", corps: corps };
  }

  /* Contenu du contrat à imprimer : { titre, sous, parties[], lignes[{lib,val}], tarifs[{lib,val}], clauses[], retractation, signature } */
  function contenu(s, c, st) {
    var ct = contrat(s), p = PR.parId[s.p], rap = null, MI = root && root.SGBF ? root.SGBF.mifid : null;
    if (s.rapport && MI) rap = MI.rapport(st, s.rapport);
    var lignes = [["Référence du contrat", ct.ref], ["Produit", p.nom], ["Souscrit le", B.fmtDate(B.lireYmd(s.date))], ["Moyen de souscription", { mail: "Mailing (e-mail)", appel: "Appel téléphonique", rdv: "Entretien en rendez-vous", accueil: "Entretien à l'accueil" }[s.canal] || ""]];
    if (s.montant != null) lignes.push([p.famille === "credit" ? "Capital emprunté" : "Versement initial", eur(s.montant)]);
    if (s.note) lignes.push(["Remarque", s.note]);
    /* Convention de compte : numéro de compte et services choisis à l'ouverture ; carte : type de débit. */
    var op = s.options, mineur = !!(p.convention && p.convention.mineur);
    if (mineur && op) { lignes.push(["Compte et carte du mineur", "Compte sans frais de tenue, carte à autorisation systématique, sans chéquier ni découvert ; compte géré par le représentant légal"]); }
    if (op && p.famille === "compte" && !mineur) {
      var RB = ribModule();
      if (RB) { var rb = RB.rib(c, op.rang || 1); lignes.push(["Numéro de compte (IBAN)", rb.ibanLisible]); lignes.push(["BIC", rb.bicLisible]); }
      if ((op.rang || 1) > 1) lignes.push(["Nature du compte", "Compte supplémentaire : le compte déjà ouvert à l'agence est conservé"]);
      if (p.convention) { /* convention : les services du contrat sont ceux du panier du client (lignes « Services pris par le client », ci-dessous) */ }
      else {
      lignes.push(["Relevés de compte", "Relevés en ligne, consultables dans l'espace client"]);
      lignes.push(["Banque à distance (GS Connect)", op.distance ? (op.connectInclus ? "Comprise dans la convention de compte : espace client et application mobile, avec identifiants personnels, sans supplément" : "Souscrite : espace client et application mobile, avec identifiants personnels (3,00 € par mois, contrat d'abonnement distinct)") : (op.connectInclus ? "Comprise dans la convention de compte, non demandée pour l'instant : le client peut l'activer à tout moment, sans supplément" : "Non souscrite")]);
      lignes.push(["Chéquier", op.cheque ? "Demandé : délivré sous réserve de l'absence d'interdiction d'émettre des chèques" : "Non demandé"]);
      lignes.push(["Alertes par SMS (GS Alertes)", op.sms ? (op.alertesInclus ? "Comprises dans la convention de compte : alerte de compte envoyée au mobile du client, sans supplément" : "Souscrites : alerte de compte envoyée au mobile du client (1,50 € par mois, contrat d'abonnement distinct)") : (op.alertesInclus ? "Comprises dans la convention de compte, non demandées pour l'instant : le client peut les activer à tout moment, sans supplément" : "Non souscrites")]);
      }
    }
    if (op && p.famille === "carte" && s.p !== "CRET" && op.debit) lignes.push(["Type de débit", op.debit === "differe" ? "Débit différé : les paiements sont prélevés en fin de mois" : "Débit immédiat : chaque paiement est débité à la date de l'opération"]);
    if (op && op.dossier) lignes.push(["Dossier d'ouverture de compte", op.dossier]);
    if (op && op.resume) op.resume.forEach(function (x) { lignes.push([x[0], x[1]]); });   /* options choisies à la souscription (formule, durée, enfant, mandat…), figées dans le contrat */
    /* convention d'un compte joint ou indivis : les deux titulaires sont parties au contrat et le signent */
    var joint = null; if (op && p.famille === "compte" && !mineur) { var RJ = ribModule(); if (RJ) { var rj = RJ.rib(c, op.rang || 1, op.titulaires || null); if (rj.joint) joint = rj; } }
    var r = retractation(s, B.maintenant());
    var clauses = [
      joint ? "Les titulaires reconnaissent avoir reçu, avant la signature, les informations précontractuelles, la fiche d'information sur le produit et les conditions tarifaires en vigueur."
        : "Le client reconnaît avoir reçu, avant la signature, les informations précontractuelles, la fiche d'information sur le produit et les conditions tarifaires en vigueur.",
      "Les conditions générales du produit font partie du contrat et sont remises " + (joint ? "à chaque titulaire" : "au client") + " avec ce document."];
    if (rap) clauses.push("Produit boursier : le client a répondu au questionnaire profil investisseur le " + B.fmtDate(B.lireYmd(rap.date)) + " et a reçu le rapport de conseil correspondant avant la souscription (" + (rap.conseil.verdict === "adapte" ? "contrat adapté à son profil" : "contrat non adapté à son profil, souscrit à l'initiative du client après mise en garde") + ").");
    if (s.options && s.options.clause) clauses.push("La clause bénéficiaire ci-dessus a été rédigée avec le conseiller d'après la situation du client. Tant que le bénéficiaire n'a pas accepté le bénéfice du contrat, le client peut la modifier ; une fois l'acceptation donnée, la modification suppose l'accord du bénéficiaire.");
    if (p.dici) clauses.push("Le client reconnaît avoir reçu le document d'informations clés (DICI) du produit avant la souscription ; il est également téléchargeable depuis le catalogue.");
    if ((s.p === "DEP" || s.p === "DECES" || s.p === "OBSQ" || s.p === "PREV" || s.p === "GAV")) clauses.push("Le client a répondu avec son conseiller au questionnaire de santé ; il reconnaît qu'une réponse inexacte peut entraîner la nullité du contrat ou la réduction de l'indemnité.");
    if (p.famille === "mobile") clauses.push("Le contrat de communications électroniques est conclu avec l'opérateur partenaire de la banque, qui fournit le service et le facture ; GS Banque & Assurance agit comme distributeur de l'offre. Le client a reçu la fiche d'information standardisée de l'offre avant de signer" + (s.p === "ESIM" ? "." : " et connaît la durée d'engagement, les frais de mise en service et de résiliation qui y figurent."));
    if (JOURS_RETRACTATION[s.p] === 30 && p.famille === "placement") clauses.push("Le client reconnaît avoir reçu la notice d'information du contrat, qui précise les garanties et leurs modalités d'entrée en vigueur.");
    if (mineur) clauses.push("Le contrat est souscrit et signé par le représentant légal de l'enfant mineur, qui déclare exercer l'autorité parentale et avoir qualité pour l'engager. La convention prend fin à la majorité de l'enfant ; la banque propose alors la convention de la tranche d'âge suivante.");
    if (s.p === "GCON") clauses.push("Le client s'engage à garder secrets ses identifiants et ses codes de sécurité, à ne les communiquer à personne (la banque ne les demande jamais) et à prévenir sans délai son agence en cas de perte, de vol ou d'utilisation frauduleuse. L'abonnement est sans engagement ; il est résiliable à tout moment, sans frais, et prend fin avec la clôture du compte courant.");
    if (s.p === "GALE") clauses.push("Le client confirme que le numéro de mobile du dossier est le sien et accepte de recevoir les SMS d'information de son compte. Il sait que ces SMS, envoyés du mardi au samedi, ne remplacent pas le relevé de compte, que la banque ne lui demande jamais de code ni d'identifiant par SMS, et que tout changement de numéro ou de seuil se fait en agence. L'abonnement est sans engagement ; il est résiliable à tout moment, sans frais, et prend fin avec la clôture du compte courant.");
    if (s.p === "APN") clauses.push("Le client reconnaît avoir reçu le document d'information sur le produit d'assurance (DIPA) et la notice d'information, qui précisent les appareils et les garanties couverts, les plafonds, les exclusions (panne, perte, vol simple) et la démarche en cas de sinistre. Il déclare utiliser les appareils assurés pour un usage privé, sauf s'il a choisi l'option usage professionnel, et conserver les factures d'achat à son nom.");
    if (s.p === "MPAY") clauses.push("Le client reconnaît avoir reçu la notice d'information, qui précise les garanties, leurs plafonds, les délais de déclaration d'un sinistre et les exclusions. Il sait qu'il doit faire opposition sans délai en cas de perte ou de vol d'un moyen de paiement.");
    clauses.push(joint ? "Les données personnelles des titulaires sont traitées par la banque pour la gestion du contrat ; chaque titulaire dispose d'un droit d'accès, de rectification et d'opposition auprès de son agence."
      : "Les données personnelles du client sont traitées par la banque pour la gestion du contrat ; le client dispose d'un droit d'accès, de rectification et d'opposition auprès de son agence.");
    clauses.push(joint ? "En cas de désaccord, les titulaires s'adressent d'abord à leur conseiller, puis au service réclamations de la banque ; ils peuvent ensuite saisir le médiateur désigné dans les conditions générales."
      : "En cas de désaccord, le client s'adresse d'abord à son conseiller, puis au service réclamations de la banque ; il peut ensuite saisir le médiateur désigné dans les conditions générales.");
    return {
      titre: ct.doc, sous: p.nom + " – réf. " + ct.ref,
      parties: [
        { lib: "La banque", val: BANQUE + " – " + AGENCE + " – " + SIEGE },
        { lib: mineur ? "Le représentant légal (souscripteur)" : joint ? "Le premier titulaire" : "Le client", val: c.civ + " " + c.prenom + " " + c.nom.toUpperCase() + ", né" + (c.sexe === "F" ? "e" : "") + " le " + naissanceDe(c) + " – " + adresseClient(c) + " – n° client " + c.num }]
        .concat(joint ? joint.coTitulaires.map(function (t, i) { return { lib: "Le " + RANGS_TITULAIRE[i + 1].toLowerCase(), val: t.civ + " " + t.prenom + " " + t.nom.toUpperCase() }; }).concat([{ lib: "Forme du compte", val: joint.forme === "indivis" ? "Compte indivis (« et ») : toute opération exige la signature de tous les titulaires – " + joint.intitule : "Compte joint (« ou ») : chaque titulaire peut agir seul et engage l'autre – " + joint.intitule }]) : []),
      lignes: lignes.map(function (x) { return { lib: x[0], val: x[1] }; }),
      caracteristiques: p.caracteristiques.map(epure),
      tarifs: p.tarifs.map(function (t) { return { lib: epure(t.lib), val: epure(t.val) }; }),
      clauses: clauses,
      retractation: r.jours ? (joint ? "Les titulaires disposent d'un délai de rétractation de " + r.jours + " jours calendaires à compter de la signature du présent contrat, qu'ils peuvent exercer par lettre adressée à leur agence." : "Le client dispose d'un délai de rétractation de " + r.jours + " jours calendaires à compter de la signature du présent contrat, qu'il peut exercer par lettre adressée à son agence.") : "Souscrit en agence : ce produit ne bénéficie pas d'un délai légal de rétractation ; les conditions générales indiquent les modalités de résiliation.",
      signature: ct.mode === "esign", signataire: mineur ? "Le représentant légal" : joint ? "Le premier titulaire" : "Le client", cosignataire: joint ? "Le second titulaire" : "", cosignataires: joint ? joint.coTitulaires.map(function (t, i) { return "Le " + RANGS_TITULAIRE[i + 1].toLowerCase(); }) : [],
      legales: LEGALES[0]
    };
  }

  var api = { DISTANCE: DISTANCE, VALIDITE_LIEN: VALIDITE_LIEN, JOURS_RELANCE: JOURS_RELANCE, JOURS_RETRACTATION: JOURS_RETRACTATION, JOURS_RETRACTATION_DISTANCE: JOURS_RETRACTATION_DISTANCE, LIB: LIB, DOCUMENTS: DOCUMENTS, DOCUMENTS_PRODUIT: DOCUMENTS_PRODUIT,
    nomDocument: nomDocument, aDistance: aDistance, mode: mode, reference: reference, nouveau: nouveau, contrat: contrat, signatureAt: signatureAt, etat: etat, signe: signe, retractation: retractation,
    envoyer: envoyer, generer: generer, signerEnAgence: signerEnAgence, emailEnvoi: emailEnvoi, contenu: contenu, epure: epure };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.contrats = api; }
})(typeof window !== "undefined" ? window : this);
