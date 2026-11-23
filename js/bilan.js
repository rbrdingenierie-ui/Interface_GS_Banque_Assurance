/* GS Banque & Assurance – résultats et bilan : indicateurs recalculés à chaque ouverture à partir de ce que l'élève a réellement fait dans les autres outils
   (appels du phoning, messages, rendez-vous de l'agenda, souscriptions du catalogue, refus des campagnes), sur le périmètre choisi : une période ou une campagne.
   Rien n'est saisi sauf l'analyse écrite par l'élève (store().bilans). Définitions :
   – clients contactés : clients ayant reçu un message, été joints par téléphone, obtenu un rendez-vous, refusé ou souscrit sur le périmètre (un appel sans réponse n'est pas un contact) ;
   – transformation : clients ayant souscrit ÷ clients contactés ;
   – joignabilité : appels aboutis ÷ appels passés ;
   – rendez-vous : rendez-vous créés sur la période (agenda) ; pour une campagne : rendez-vous rattachés à la campagne ;
   – contrats : souscriptions du catalogue datées de la période (pour une campagne : le produit de la campagne, clients de la cible, entre le début et la fin) ;
   – montant : somme des montants saisis à la souscription (versement initial d'un produit d'épargne, capital emprunté d'un crédit accordé dans « Montage de prêt » ; un contrat sans montant n'ajoute rien) ;
   – moyen : mailing (e-mails de la messagerie), appel téléphonique, entretien en rendez-vous, entretien à l'accueil. Un client est « touché » par un moyen s'il a reçu un e-mail,
     été joint par téléphone ou reçu en entretien, ou s'il a souscrit par ce moyen ; transformation d'un moyen : clients ayant souscrit par ce moyen ÷ clients touchés par ce moyen ;
   – taux de multiventes : clients ayant souscrit au moins deux produits ÷ clients ayant souscrit (pour une campagne : produits souscrits par les clients de la cible entre le début et la fin) ;
   – rebond commercial : autre produit proposé pendant un appel abouti ou un entretien (CRE) ; il a « abouti » si le client a souscrit ce produit depuis. */
(function (root) {
  "use strict";

  var B = root && root.SGBF ? root.SGBF.banque : require("./banque.js");
  var PR = root && root.SGBF ? root.SGBF.produits : require("./produits.js");
  var K = root && root.SGBF ? root.SGBF.catalogue : require("./catalogue.js");
  var AG = root && root.SGBF ? root.SGBF.agenda : require("./agenda.js");
  var CA = root && root.SGBF ? root.SGBF.campagnes : require("./campagnes.js");
  var PH = root && root.SGBF ? root.SGBF.phoning : require("./phoning.js");
  var CT = root && root.SGBF ? root.SGBF.contacts : require("./contacts.js");

  var MAX_TXT = 600, MIN_TXT = 20, DUREE_MAX = 366, PERIODES = [7, 30, 90];
  /* « act » : actions à décider, rédigées dans un encadré à part (auparavant « Axes d'amélioration et actions décidées » en une seule rubrique). */
  var CHAMPS = { pos: "Ce qui a bien fonctionné", neg: "Ce qui n'a pas fonctionné, et pourquoi", axes: "Axes d'amélioration", act: "Actions à décider pour la suite" };

  function err(champ, msg) { return { ok: false, champ: champ, erreur: msg }; }
  function pct(a, b) { return b > 0 ? Math.round(100 * a / b) : null; }
  function pl(n, s, p) { return n + " " + (n > 1 ? p : s); }
  function liste(st, c) { return (st && Array.isArray(st[c])) ? st[c] : []; }
  function propre(s) { return String(s == null ? "" : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\r\n?/g, "\n").split("\n").map(function (q) { return q.replace(/[ \t]+/g, " ").trim(); }).join("\n").replace(/\n{3,}/g, "\n\n").trim(); }
  function dans(x, du, au) { return x >= du && x <= au; }
  function nomProduit(pid) { return PR.parId[pid] ? PR.parId[pid].nom : pid; }

  /* ---------- périmètre ----------
     p = { type: "periode", jours: 7|30|90 } | { type: "periode", du, au } | { type: "campagne", id } */
  function perimetreDefaut() { return { type: "periode", jours: 30 }; }
  function bornes(p) {
    var auj = B.aujourdhui();
    if (p.type === "periode" && p.jours) return { du: B.ymd(B.plusJours(auj, -(p.jours - 1))), au: B.ymd(auj) };
    return { du: p.du, au: p.au };
  }
  function valider(st, p) {
    if (!p || (p.type !== "periode" && p.type !== "campagne")) return err("perimetre", "Choisissez ce que vous voulez analyser.");
    if (p.type === "campagne") return CA.trouver(st, p.id) ? { ok: true } : err("perimetre", "Cette campagne n'existe plus.");
    if (p.jours) return PERIODES.indexOf(p.jours) >= 0 ? { ok: true } : err("perimetre", "Période inconnue.");
    var d0 = B.lireYmd(p.du), d1 = B.lireYmd(p.au), auj = B.aujourdhui();
    if (!d0) return err("du", "Saisissez une date de début valide.");
    if (!d1) return err("au", "Saisissez une date de fin valide.");
    if (B.ecartJours(d1, auj) > 0) return err("au", "La fin ne peut pas être dans le futur : le bilan porte sur ce qui a déjà été fait.");
    if (B.ecartJours(d1, d0) < 0) return err("au", "La fin ne peut pas précéder le début.");
    if (B.ecartJours(d1, d0) + 1 > DUREE_MAX) return err("au", "Une période dure " + DUREE_MAX + " jours au plus : choisissez une fin au plus tard le " + B.fmtDate(B.plusJours(d0, DUREE_MAX - 1)) + ".");
    return { ok: true };
  }
  function cle(p) { return p.type === "campagne" ? "k:" + p.id : "p:" + (p.jours ? "j" + p.jours : p.du + "|" + p.au); }
  function libellePerimetre(st, p) {
    if (p.type === "campagne") { var k = CA.trouver(st, p.id); return k ? "Campagne « " + k.nom + " »" : "Campagne supprimée"; }
    var b = bornes(p);
    return "Activité commerciale du " + B.fmtDate(B.lireYmd(b.du)) + " au " + B.fmtDate(B.lireYmd(b.au));
  }

  /* ---------- calcul ---------- */
  function montant(subs) { return subs.reduce(function (t, s) { return t + (typeof s.montant === "number" && isFinite(s.montant) ? s.montant : 0); }, 0); }
  function semaines(du, au, st, appels, msgs, rdvs, subs, fac) {
    var d0 = B.lireYmd(du), d1 = B.lireYmd(au), l = [];
    for (var lundi = AG.lundiDe(d0); B.ecartJours(lundi, d1) <= 0; lundi = B.plusJours(lundi, 7)) {
      var a = B.ymd(lundi), z = B.ymd(B.plusJours(lundi, 6)), deb = a < du ? du : a, fin = z > au ? au : z;
      var ap = appels.filter(function (x) { return dans(x.date, deb, fin); });
      l.push({ lundi: a, du: deb, au: fin, appels: ap.length, joints: ap.filter(PH.joint).length, messages: msgs.filter(function (x) { return dans(x.date, deb, fin); }).length, face: fac.filter(function (x) { return dans(x.date, deb, fin); }).length,
        rdv: rdvs.filter(function (x) { return dans(String(x.cree || "").slice(0, 10), deb, fin); }).length, contrats: subs.filter(function (x) { return dans(x.date, deb, fin); }).length });
    }
    return l;
  }
  function parProduit(appels, subs, fac) {
    var m = {};
    function lg(pid) { return m[pid] || (m[pid] = { p: pid, appels: 0, joints: 0, face: 0, rdv: 0, refus: 0, contrats: 0, montant: 0 }); }
    fac.forEach(function (x) { var l = lg(x.prod); l.face++; if (x.res === "rdv") l.rdv++; if (x.res === "refus") l.refus++; });
    appels.forEach(function (a) { var x = lg(a.prod); x.appels++; if (PH.joint(a)) x.joints++; if (a.res === "rdv") x.rdv++; if (a.res === "refus" || a.res === "stop") x.refus++; });
    subs.forEach(function (s) { var x = lg(s.p); x.contrats++; x.montant += typeof s.montant === "number" ? s.montant : 0; });
    return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.contrats - a.contrats || b.appels - a.appels || (nomProduit(a.p) < nomProduit(b.p) ? -1 : 1); });
  }
  function compterMotifs(l) {
    var t = {}; CA.MOTIFS_REFUS.forEach(function (m) { t[m] = 0; });
    l.forEach(function (m) { if (t[m] !== undefined) t[m]++; });
    return t;
  }
  function calculer(st, p) {
    var v = valider(st, p); if (!v.ok) return v;
    var r = { ok: true, perimetre: p, cle: cle(p), type: p.type, titre: libellePerimetre(st, p) };
    var tousAppels = liste(st, "appels"), tousMsgs = liste(st, "messages"), tousRdv = AG.elements(st).filter(function (x) { return (x.type === "rdv" || x.type === "rdv_col") && x.statut !== "annule"; }), tousSubs = K.souscriptions(st), tousFac = liste(st, "contacts");
    var appels, msgs, rdvs, subs, fac, subsCible = null, motifs = [], clientsRefus = {}, contactes = {}, clientsContrat = {};
    if (p.type === "campagne") {
      var k = CA.trouver(st, p.id), dans0 = {}; k.ids.forEach(function (i) { dans0[i] = true; });
      appels = tousAppels.filter(function (a) { return a.camp === k.id; });
      msgs = tousMsgs.filter(function (m) { return m.camp === k.id; });
      rdvs = tousRdv.filter(function (x) { return x.camp === k.id; });
      subs = tousSubs.filter(function (s) { return s.p === k.produit && dans0[s.c] && dans(s.date, k.debut, k.fin); });
      fac = tousFac.filter(function (x) { return x.camp === k.id; });
      subsCible = tousSubs.filter(function (s) { return dans0[s.c] && dans(s.date, k.debut, k.fin); });
      var i = CA.indicateurs(st, k), suivi = CA.suivi(st, k);
      r.du = k.debut; r.au = k.fin;
      r.campagne = { id: k.id, nom: k.nom, produit: k.produit, cibles: i.cibles, objectif: k.objectif, atteinte: i.atteinte, resteAFaire: i.resteAFaire, aContacter: i.aContacter, tentatives: i.tentatives, statut: i.statut, rythme: i.rythme, jours: i.jours, detient: i.detient, tempsEcoule: i.tempsEcoule };
      r.etats = {}; Object.keys(CA.ETATS).forEach(function (e) { r.etats[e] = 0; }); suivi.forEach(function (x) { r.etats[x.etat]++; });
      suivi.forEach(function (x) {
        if (x.sub) clientsContrat[x.id] = true;
        if (x.sub || x.refus || x.rdv || x.msg || x.joints || x.face) contactes[x.id] = true;
        if (x.refus && !x.sub) { clientsRefus[x.id] = true; motifs.push(x.refus.motif); }
      });
    } else {
      var b = bornes(p);
      r.du = b.du; r.au = b.au;
      appels = tousAppels.filter(function (a) { return dans(a.date, b.du, b.au); });
      msgs = tousMsgs.filter(function (m) { return dans(m.date, b.du, b.au); });
      rdvs = tousRdv.filter(function (x) { return dans(String(x.cree || "").slice(0, 10), b.du, b.au); });
      subs = tousSubs.filter(function (s) { return dans(s.date, b.du, b.au); });
      fac = tousFac.filter(function (x) { return dans(x.date, b.du, b.au); });
      msgs.forEach(function (m) { contactes[m.c] = true; });
      fac.forEach(function (x) { contactes[x.c] = true; });
      appels.forEach(function (a) { if (PH.joint(a)) contactes[a.c] = true; });
      rdvs.forEach(function (x) { if (x.client) contactes[x.client] = true; });
      subs.forEach(function (s) { contactes[s.c] = true; clientsContrat[s.c] = true; });
      /* refus de la période : demandes de refus ou d'arrêt notées lors d'un appel, et refus notés dans les campagnes ; un client compte une fois, avec son motif le plus récent */
      var dernier = {};
      appels.forEach(function (a) { if ((a.res === "refus" || a.res === "stop") && !clientsContrat[a.c]) { var mo = a.res === "refus" ? a.motif : "Autre raison", cl = a.c; if (!dernier[cl] || dernier[cl].date <= a.date) dernier[cl] = { date: a.date, motif: mo }; } });
      fac.forEach(function (x) { if (x.res === "refus" && !clientsContrat[x.c]) { if (!dernier[x.c] || dernier[x.c].date <= x.date) dernier[x.c] = { date: x.date, motif: x.motif }; } });
      liste(st, "campagnes").forEach(function (kk) { Object.keys(kk.refus || {}).forEach(function (cid) { var x = kk.refus[cid]; if (dans(x.date, b.du, b.au) && !clientsContrat[cid]) { if (!dernier[cid] || dernier[cid].date <= x.date) dernier[cid] = { date: x.date, motif: x.motif }; } }); });
      Object.keys(dernier).forEach(function (cid) { clientsRefus[cid] = true; contactes[cid] = true; motifs.push(dernier[cid].motif); });
      r.semaines = B.ecartJours(B.lireYmd(b.au), B.lireYmd(b.du)) + 1 <= 100 ? semaines(b.du, b.au, st, appels, msgs, rdvs, subs, fac) : null;
      r.parProduit = parProduit(appels, subs, fac);
      r.campagnes = liste(st, "campagnes").filter(function (kk) { return kk.debut <= b.au && kk.fin >= b.du; }).map(function (kk) {
        var i2 = CA.indicateurs(st, kk); return { id: kk.id, nom: kk.nom, produit: kk.produit, statut: i2.statut, contrats: i2.contrats, objectif: kk.objectif, atteinte: i2.atteinte };
      });
    }
    var t = PH.totaux(appels);
    r.appels = t.appels; r.joints = t.joints; r.sansReponse = t.sansReponse; r.tauxJoint = t.tauxJoint; r.hors = t.hors; r.parResultat = t.parResultat; r.clientsAppeles = t.clients;
    r.messages = msgs.length; r.rdv = rdvs.length; r.rdvTel = t.parResultat.rdv;
    r.contrats = subs.length; r.montant = montant(subs); r.clientsContrat = Object.keys(clientsContrat).length;
    r.contactes = Object.keys(contactes).length; r.refus = Object.keys(clientsRefus).length;
    r.transformation = pct(r.clientsContrat, r.contactes);
    r.parMotif = compterMotifs(motifs);
    if (p.type === "campagne") r.parProduit = null;
    /* entretiens (CRE) */
    var tf = CT.totaux(fac);
    r.face = tf.contacts; r.faceClients = tf.clients; r.parResultatFace = tf.parResultat; r.parLieu = tf.parLieu; r.rdvFace = tf.parResultat.rdv;
    /* moyens : actions, clients touchés, rebonds, contrats, part et transformation de chacun */
    var S = {}, CC = {}, M = {}, reb = [], autre = { contrats: 0, montant: 0, clients: {} };
    K.ORDRE_MOYENS.forEach(function (m) {
      S[m] = {}; CC[m] = {};
      M[m] = { k: m, lib: K.MOYENS[m], actions: 0, touches: 0, rdv: m === "mail" ? null : 0, rebonds: m === "mail" ? null : 0, rebondsAboutis: m === "mail" ? null : 0, contrats: 0, clientsContrat: 0, montant: 0, part: null, transformation: null, prevu: null };
    });
    msgs.forEach(function (m) { S.mail[m.c] = true; }); M.mail.actions = msgs.length;
    appels.forEach(function (a) {
      M.appel.actions++;
      if (PH.joint(a)) { S.appel[a.c] = true; if (a.res === "rdv") M.appel.rdv++; if (a.rebond) reb.push({ m: "appel", c: a.c, p: a.rebond, date: a.date }); }
    });
    fac.forEach(function (x) {
      M[x.lieu].actions++; S[x.lieu][x.c] = true; if (x.res === "rdv") M[x.lieu].rdv++;
      if (x.rebond) reb.push({ m: x.lieu, c: x.c, p: x.rebond, date: x.date });
    });
    subs.forEach(function (s) {
      if (K.MOYENS[s.canal]) { S[s.canal][s.c] = true; CC[s.canal][s.c] = true; M[s.canal].contrats++; M[s.canal].montant += typeof s.montant === "number" && isFinite(s.montant) ? s.montant : 0; }
      else { autre.contrats++; autre.montant += typeof s.montant === "number" && isFinite(s.montant) ? s.montant : 0; autre.clients[s.c] = true; }
    });
    r.rebonds = reb.length; r.rebondsAboutis = 0;
    reb.forEach(function (e) {
      var ab = tousSubs.some(function (s) { return s.c === e.c && s.p === e.p && s.date >= e.date && s.date <= r.au; });
      M[e.m].rebonds++; if (ab) { M[e.m].rebondsAboutis++; r.rebondsAboutis++; }
    });
    r.tauxRebond = pct(r.rebondsAboutis, r.rebonds);
    r.contactsUtiles = r.joints + r.face;
    var prevus = p.type === "campagne" ? (CA.trouver(st, p.id).moyens || []) : null;
    K.ORDRE_MOYENS.forEach(function (m) {
      var x = M[m]; x.touches = Object.keys(S[m]).length; x.clientsContrat = Object.keys(CC[m]).length;
      x.part = pct(x.contrats, r.contrats); x.transformation = pct(x.clientsContrat, x.touches);
      if (prevus) x.prevu = prevus.indexOf(m) >= 0;
    });
    r.moyens = K.ORDRE_MOYENS.map(function (m) { return M[m]; });
    var residuel = Object.keys(contactes).filter(function (id) { return !K.ORDRE_MOYENS.some(function (m) { return S[m][id]; }); });
    r.autres = residuel.length || autre.contrats ? { touches: residuel.length, contrats: autre.contrats, montant: autre.montant, part: pct(autre.contrats, r.contrats) } : null;
    r.moyensPrevus = prevus;
    r.moyensNonUtilises = prevus ? prevus.filter(function (m) { return !M[m].actions && !M[m].touches; }) : [];
    /* multiventes : clients ayant souscrit au moins deux produits ÷ clients ayant souscrit */
    var parClient = {};
    (subsCible || subs).forEach(function (s) { parClient[s.c] = (parClient[s.c] || 0) + 1; });
    var acheteurs = Object.keys(clientsContrat), nbProd = 0;
    acheteurs.forEach(function (id) { nbProd += parClient[id] || 0; });
    r.acheteurs = acheteurs.length;
    r.multi = acheteurs.filter(function (id) { return (parClient[id] || 0) >= 2; }).length;
    r.tauxMulti = pct(r.multi, r.acheteurs);
    r.produitsParAcheteur = r.acheteurs ? Math.round(10 * nbProd / r.acheteurs) / 10 : null;
    r.ventesCompl = r.acheteurs ? nbProd - r.acheteurs : 0;
    r.constats = constats(r);
    r.pistes = pistes(r);
    r.activite = r.appels + r.messages + r.face + r.rdv + r.contrats + r.refus > 0;
    return r;
  }

  /* Constats chiffrés : des faits, sans interprétation (l'interprétation est le travail de l'élève). */
  function constats(r) {
    var l = [], c = r.campagne;
    if (c) {
      l.push("Objectif : " + pl(r.contrats, "contrat", "contrats") + " sur " + c.objectif + " visés (" + (c.atteinte === null ? 0 : c.atteinte) + " %).");
      if (c.resteAFaire > 0 && c.statut === "cours") l.push("Il reste " + pl(c.jours.restants, "jour ouvré", "jours ouvrés") + " pour obtenir " + pl(c.resteAFaire, "contrat", "contrats") + " de plus" + (c.rythme === "retard" ? " ; vous êtes en retard sur le rythme de la période (" + c.tempsEcoule + " % du temps écoulé)." : "."));
      else if (c.resteAFaire > 0 && c.statut === "terminee") l.push("La campagne est terminée : il manque " + pl(c.resteAFaire, "contrat", "contrats") + " pour atteindre l'objectif.");
      else if (c.resteAFaire > 0) l.push("La campagne n'a pas encore commencé.");
      else l.push("L'objectif est atteint.");
      if (c.aContacter > 0) l.push(pl(c.aContacter, "client de la cible reste", "clients de la cible restent") + " à contacter (dont " + pl(c.tentatives, "client appelé sans réponse", "clients appelés sans réponse") + ").");
    }
    if (r.appels > 0) l.push("Appels : " + pl(r.joints, "appel abouti", "appels aboutis") + " sur " + r.appels + " (" + r.tauxJoint + " %) ; " + pl(r.rdvTel, "rendez-vous obtenu", "rendez-vous obtenus") + " par téléphone, " + pl(r.parResultat.accord, "accord de principe", "accords de principe") + ".");
    if (r.face > 0) l.push("Entretiens (CRE) : " + pl(r.face, "compte rendu", "comptes rendus") + " (" + pl(r.parLieu.accueil, "à l'accueil", "à l'accueil") + ", " + pl(r.parLieu.rdv, "en rendez-vous", "en rendez-vous") + ") avec " + pl(r.faceClients, "client", "clients") + " ; " + pl(r.parResultatFace.souscrit, "client souscrit", "clients souscrivent") + ", " + pl(r.rdvFace, "rendez-vous pris", "rendez-vous pris") + ".");
    if (r.contactes > 0) l.push("Transformation : " + r.clientsContrat + " client" + (r.clientsContrat > 1 ? "s ont souscrit" : " a souscrit") + " sur " + r.contactes + " client" + (r.contactes > 1 ? "s contactés" : " contacté") + " (" + r.transformation + " %).");
    if (r.refus > 0) {
      var top = Object.keys(r.parMotif).sort(function (a, b) { return r.parMotif[b] - r.parMotif[a]; })[0];
      l.push(pl(r.refus, "client a refusé", "clients ont refusé") + " ; motif le plus fréquent : « " + top + " » (" + pl(r.parMotif[top], "fois", "fois") + ").");
    }
    r.moyens.forEach(function (x) {
      if (!x.actions && !x.contrats) return;
      var act = x.k === "mail" ? pl(x.actions, "e-mail envoyé", "e-mails envoyés") : x.k === "appel" ? pl(x.actions, "appel", "appels") : pl(x.actions, "contact", "contacts");
      l.push(x.lib + " : " + act + ", " + pl(x.touches, "client touché", "clients touchés") + ", " + pl(x.contrats, "contrat", "contrats") + (r.contrats ? " (" + x.part + " % des contrats)" : "") + (x.transformation !== null ? ", transformation " + x.transformation + " %" : "") + ".");
    });
    if (r.acheteurs > 0) l.push("Multiventes : " + r.multi + " client" + (r.multi > 1 ? "s" : "") + " sur " + r.acheteurs + (r.multi > 1 ? " ont souscrit" : " a souscrit") + " au moins deux produits (" + r.tauxMulti + " %), soit " + String(r.produitsParAcheteur).replace(".", ",") + " produit" + (r.produitsParAcheteur >= 2 ? "s" : "") + " par client ayant souscrit" + (c ? " (produits souscrits par les clients de la cible pendant la campagne)" : "") + ".");
    if (r.rebonds > 0) l.push("Rebonds commerciaux : " + pl(r.rebonds, "utilisé", "utilisés") + ", dont " + pl(r.rebondsAboutis, "abouti", "aboutis") + " à une souscription (" + r.tauxRebond + " %).");
    else if (r.contactsUtiles > 0) l.push("Rebonds commerciaux : aucun utilisé sur " + pl(r.contactsUtiles, "contact", "contacts") + " (appels aboutis et entretiens).");
    if (r.moyensNonUtilises && r.moyensNonUtilises.length) l.push((r.moyensNonUtilises.length > 1 ? "Moyens prévus mais non utilisés : " : "Moyen prévu mais non utilisé : ") + r.moyensNonUtilises.map(function (m) { return K.MOYENS[m].toLowerCase(); }).join(", ") + ".");
    if (r.hors > 0) l.push(pl(r.hors, "appel est signalé", "appels sont signalés") + " « hors créneau » : le démarchage ne se fait que " + PH.creneauLib() + ".");
    if (!l.length || !r.appels && !r.messages && !r.face && !r.rdv && !r.contrats && !r.refus) return ["Aucune activité enregistrée sur ce périmètre : passez des appels, envoyez des messages, rédigez des CRE ou enregistrez des souscriptions, puis revenez sur cette page."].concat(c ? l.slice(0, 2) : []);
    return l;
  }

  /* Pistes pour les axes d'amélioration : des questions déduites des chiffres (aucun seuil arbitraire : on compare ce qui a été fait), à se poser avant de rédiger l'analyse. */
  function pistes(r) {
    var l = [], c = r.campagne;
    if (!r.appels && !r.messages && !r.face && !r.rdv && !r.contrats && !r.refus) return l;
    if (r.appels > 0 && r.sansReponse > 0) l.push(pl(r.sansReponse, "appel est resté", "appels sont restés") + " sans réponse sur " + r.appels + " : à quels jours et à quelles heures rappeler ces clients ?");
    if (r.refus > 0) {
      var top = Object.keys(r.parMotif).sort(function (a, b) { return r.parMotif[b] - r.parMotif[a]; })[0];
      l.push("Le motif de refus le plus fréquent est « " + top + " » (" + pl(r.parMotif[top], "fois", "fois") + ") : quelle réponse préparer à cette objection ?");
    }
    if (r.hors > 0) l.push(pl(r.hors, "appel est hors créneau", "appels sont hors créneau") + " : comment organiser vos appels pour rester dans les jours et heures autorisés ?");
    var avec = r.moyens.filter(function (x) { return x.transformation !== null; });
    if (avec.length >= 2) {
      var meilleur = avec.slice().sort(function (a, b) { return b.transformation - a.transformation; })[0], pire = avec.slice().sort(function (a, b) { return a.transformation - b.transformation; })[0];
      if (meilleur.transformation !== pire.transformation) l.push("Le moyen le plus efficace est « " + meilleur.lib + " » (transformation " + meilleur.transformation + " %) et le moins efficace « " + pire.lib + " » (" + pire.transformation + " %) : comment vous appuyer sur ce qui fonctionne le mieux ?");
    }
    var mail = r.moyens[0];
    if (mail.actions > 0 && mail.contrats === 0) l.push(pl(mail.actions, "e-mail envoyé n'a", "e-mails envoyés n'ont") + " donné aucun contrat : faut-il relancer ces clients par téléphone ou leur proposer un rendez-vous ?");
    if (r.contactsUtiles > 0 && r.rebonds === 0) l.push("Aucun rebond commercial n'a été utilisé sur " + pl(r.contactsUtiles, "contact", "contacts") + " : quel autre produit pouvait être proposé à ces clients ?");
    if (r.rebonds > 0 && r.rebondsAboutis === 0) l.push(pl(r.rebonds, "rebond utilisé n'a", "rebonds utilisés n'ont") + " donné aucune souscription : l'autre produit répondait-il à un besoin exprimé par le client ?");
    if (r.acheteurs > 0 && r.multi === 0) l.push("Aucun client n'a souscrit plus d'un produit : quel produit complémentaire proposer à chaque nouveau souscripteur ?");
    if (r.contactes > 0 && r.contrats === 0) l.push("Aucun contrat sur " + pl(r.contactes, "client contacté", "clients contactés") + " : à quelle étape les clients ont-ils décroché (accroche, besoin, offre, conclusion) ?");
    if (c) {
      if (c.aContacter > 0) l.push(pl(c.aContacter, "client de la cible n'a", "clients de la cible n'ont") + " pas encore été contactés : par quel moyen les joindre en priorité ?");
      if (c.resteAFaire > 0 && c.statut === "terminee") l.push("Il manque " + pl(c.resteAFaire, "contrat", "contrats") + " pour atteindre l'objectif : quelle étape ou quel moyen a manqué ?");
      if (r.moyensNonUtilises.length) l.push((r.moyensNonUtilises.length > 1 ? "Des moyens prévus n'ont pas été utilisés" : "Un moyen prévu n'a pas été utilisé") + " (" + r.moyensNonUtilises.map(function (m) { return K.MOYENS[m].toLowerCase(); }).join(", ") + ") : pourquoi ne pas les avoir mobilisés ?");
    }
    return l;
  }

  /* ---------- analyse écrite par l'élève ---------- */
  function analyse(st, k) {
    var a = st && st.bilans && st.bilans[k];
    return a && typeof a === "object" ? { pos: a.pos || "", neg: a.neg || "", axes: a.axes || "", act: a.act || "", maj: a.maj || "" } : { pos: "", neg: "", axes: "", act: "", maj: "" };
  }
  function complete(a) { return ["pos", "neg", "axes", "act"].every(function (c) { return propre(a[c]).length >= MIN_TXT; }); }
  function enregistrerAnalyse(st, k, o) {
    var v = {};
    for (var c in CHAMPS) {
      var t = propre(o[c]);
      if (t.length > MAX_TXT) return err(c, "« " + CHAMPS[c] + " » est limité à " + MAX_TXT + " caractères.");
      if (t && t.length < MIN_TXT) return err(c, "« " + CHAMPS[c] + " » : développez un peu (" + MIN_TXT + " caractères au moins) ou laissez le champ vide.");
      v[c] = t;
    }
    if (!st.bilans || typeof st.bilans !== "object") st.bilans = {};
    v.maj = B.ymd(B.aujourdhui());
    st.bilans[k] = v;
    return { ok: true, analyse: v, complete: complete(v) };
  }

  var api = {
    MAX_TXT: MAX_TXT, MIN_TXT: MIN_TXT, DUREE_MAX: DUREE_MAX, PERIODES: PERIODES, CHAMPS: CHAMPS,
    perimetreDefaut: perimetreDefaut, bornes: bornes, valider: valider, cle: cle, libellePerimetre: libellePerimetre, calculer: calculer, constats: constats, pistes: pistes,
    analyse: analyse, complete: complete, enregistrerAnalyse: enregistrerAnalyse, pct: pct, pluriel: pl
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.bilan = api; }
})(typeof window !== "undefined" ? window : null);
