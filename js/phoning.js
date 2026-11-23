/* GS Banque & Assurance – phoning et prospection : l'élève appelle des clients de SON portefeuille (aucun client virtuel) et enregistre lui-même le résultat de chaque appel.
   L'outil contrôle ce que la réglementation demande avant d'appeler (fondement de l'appel, jours et heures, nombre d'appels), fournit un script et des réponses aux objections,
   puis relie le résultat à l'agenda (rendez-vous, rappel), aux campagnes (refus, suivi) et au catalogue (souscription). Les appels sont enregistrés dans le navigateur (store().appels).
   Repères réglementaires repris dans l'outil (vérifiés sur service-public.fr, rubrique Entreprendre, fiche A19003, et sur des sites d'information secondaires) :
   – depuis le 11 août 2026, le démarchage téléphonique est interdit sans accord préalable du consommateur (accord valable un an au plus, retrait possible à tout moment, y compris à l'oral),
     sauf appel lié à l'objet d'un contrat en cours ;
   – appels autorisés du lundi au vendredi, de 10 h à 13 h et de 14 h à 20 h, hors jours fériés ;
   – quatre appels au plus par période de 30 jours pour un même consommateur (article D223-9 : « contacter ou tenter de contacter », donc les tentatives sans réponse comptent).
   Règles de l'agence : un appel commencé à 13 h 00 ou à 20 h 00 pile est hors créneau ;
   l'accord du client et le lien avec un contrat sont déclarés par l'élève (le portefeuille fictif ne contient pas cette information) ; un appel hors créneau est enregistré mais signalé. */
(function (root) {
  "use strict";

  var B = root && root.SGBF ? root.SGBF.banque : require("./banque.js");
  var PR = root && root.SGBF ? root.SGBF.produits : require("./produits.js");
  var K = root && root.SGBF ? root.SGBF.catalogue : require("./catalogue.js");
  var AG = root && root.SGBF ? root.SGBF.agenda : require("./agenda.js");
  var CA = root && root.SGBF ? root.SGBF.campagnes : require("./campagnes.js");
  var CL = root && root.SGBF ? root.SGBF.clients : require("./data_clients.js").clients;
  var CLIENT = {}; CL.forEach(function (c) { CLIENT[c.id] = c; });

  var MAX_APPELS = 500, MAX_NOTE = 300, MAX_LIEN = 200, MIN_LIEN = 10, MIN_NOTE = 10, QUOTA = 4, FENETRE = 30, PASSE_MAX = 90, VALIDITE_ACCORD = 365;
  var CRENEAUX = [["10:00", "13:00"], ["14:00", "20:00"]];
  var BASES = {
    consentement: { lib: "Le client a donné son accord pour être appelé", court: "Accord du client", demarchage: true },
    contrat: { lib: "Le produit proposé est lié à un contrat que le client détient déjà", court: "Contrat en cours", demarchage: true },
    demande: { lib: "Le client a demandé à être appelé ou rappelé", court: "À la demande du client", demarchage: false }
  };
  var RESULTATS = {
    nr: { lib: "Pas de réponse", aide: "Le client ne décroche pas ou la ligne est occupée. La tentative compte dans les quatre appels autorisés sur 30 jours.", contact: false },
    doc: { lib: "Souhaite de la documentation", aide: "Le client veut d'abord lire : envoyez-lui un e-mail depuis la messagerie.", contact: true },
    rappel: { lib: "Demande à être rappelé", aide: "Le client n'a pas le temps maintenant : convenez d'une date et d'une heure, un rappel est ajouté à votre agenda.", contact: true, suite: "relance" },
    rdv: { lib: "Rendez-vous obtenu", aide: "Le client accepte un rendez-vous : il est ajouté à votre agenda.", contact: true, suite: "rdv" },
    accord: { lib: "Accord de principe", aide: "Le client veut souscrire : le contrat s'enregistre dans le catalogue, après vérification des points à confirmer avec lui.", contact: true },
    refus: { lib: "Refus", aide: "Le client ne veut pas du produit : indiquez le motif.", contact: true, motif: true },
    stop: { lib: "Demande à ne plus être appelé", aide: "Le client retire son accord : vous ne pouvez plus le démarcher par téléphone, sauf s'il le demande lui-même ou donne un nouvel accord.", contact: true }
  };
  var ORDRE_RESULTATS = ["nr", "doc", "rappel", "rdv", "accord", "refus", "stop"];
  var CANAUX_RDV = ["En agence", "Par téléphone"];

  function err(champ, msg) { return { ok: false, champ: champ, erreur: msg }; }
  function propre(s) { return String(s == null ? "" : s).replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, ""); }
  function espaces(s) { return propre(s).replace(/\s+/g, " ").trim(); }
  function pl(n, s, p) { return n + " " + (n > 1 ? p : s); }
  function maj1(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function appels(st) { return (st && Array.isArray(st.appels)) ? st.appels : []; }
  function trouver(st, id) { return appels(st).filter(function (a) { return a.id === id; })[0] || null; }
  function uid() { return "p" + B.maintenant().getTime().toString(36) + Math.random().toString(36).slice(2, 6); }
  function demarchage(base) { return !!(BASES[base] && BASES[base].demarchage); }
  function nomProduit(pid) { return PR.parId[pid] ? PR.parId[pid].nom : pid; }
  function heureLib(h) { var m = /^(\d{2}):(\d{2})$/.exec(h || ""); return m ? (+m[1]) + " h" + (m[2] === "00" ? "" : " " + m[2]) : ""; }
  function quand(a) { return B.fmtDate(B.lireYmd(a.date)) + " à " + heureLib(a.heure); }

  /* ---------- jours et heures autorisés ---------- */
  function creneauLib() { return "du lundi au vendredi, de 10 h à 13 h et de 14 h à 20 h, hors jours fériés"; }
  /* { ok, raison } : le démarchage est-il permis à cette date et à cette heure ? */
  function creneau(ymd, heure) {
    var d = B.lireYmd(ymd), m = AG.minutes(heure);
    if (!d || isNaN(m)) return { ok: false, raison: "Date ou heure invalide." };
    if (!B.estOuvre(d)) {
      var f = B.estFerie(d) ? AG.nomFerie(d) : null;
      return { ok: false, raison: B.fmtLong(d) + (f ? " est un jour férié (" + f + ")" : " tombe un week-end") + " : le démarchage téléphonique n'est autorisé que " + creneauLib() + "." };
    }
    var ok = CRENEAUX.some(function (c) { return m >= AG.minutes(c[0]) && m < AG.minutes(c[1]); });
    return ok ? { ok: true, raison: "" } : { ok: false, raison: "À " + heureLib(heure) + ", l'appel est hors des heures autorisées (" + creneauLib() + ")." };
  }

  /* ---------- quatre appels au plus par période de 30 jours ---------- */
  function datesDemarchage(st, cid, sauf) {
    return appels(st).filter(function (a) { return a.c === cid && demarchage(a.base) && a.id !== sauf; }).map(function (a) { return B.lireYmd(a.date); }).filter(Boolean).sort(function (x, y) { return x - y; });
  }
  /* Vrai s'il existe cinq appels (ou plus) dans une même période de 30 jours consécutifs. */
  function quotaDepasse(dates) {
    var l = dates.slice().sort(function (x, y) { return x - y; });
    for (var i = 0; i + QUOTA < l.length; i++) if (B.ecartJours(l[i + QUOTA], l[i]) <= FENETRE - 1) return true;
    return false;
  }
  function peutAjouter(dates, d) { return !quotaDepasse(dates.concat([d])); }
  /* Premier jour (à partir de d) où un nouvel appel de démarchage redevient possible. */
  function prochaineDate(dates, d) {
    var x = d;
    for (var i = 0; i < 400; i++) { if (peutAjouter(dates, x)) return x; x = B.plusJours(x, 1); }
    return x;
  }
  /* Appels de démarchage faits au cours des 30 jours qui se terminent à la date donnée (la date comprise). */
  function dansFenetre(st, cid, ymd) {
    var d = B.lireYmd(ymd); if (!d) return [];
    return appels(st).filter(function (a) { var e = B.ecartJours(d, B.lireYmd(a.date)); return a.c === cid && demarchage(a.base) && e >= 0 && e <= FENETRE - 1; });
  }
  /* Situation d'un client au regard du quota, à la date du jour : nombre d'appels sur les 30 derniers jours et prochain appel possible. */
  function quotaClient(st, cid, ymd) {
    var d = B.lireYmd(ymd || B.ymd(B.aujourdhui())), dates = datesDemarchage(st, cid);
    var n = dansFenetre(st, cid, B.ymd(d)).length, libre = peutAjouter(dates, d);
    return { n: n, max: QUOTA, possible: libre, prochaine: libre ? d : prochaineDate(dates, d) };
  }

  /* ---------- « ne plus appeler » ---------- */
  function dernierStop(st, cid) {
    var l = appels(st).filter(function (a) { return a.c === cid && a.res === "stop"; }).sort(function (x, y) { return x.date + x.heure < y.date + y.heure ? 1 : -1; });
    return l[0] || null;
  }

  /* ---------- produit, campagne ---------- */
  /* Appels ouverts depuis la liste O2PC : les deux thèmes « crédit » (réserve d'argent, rachat) permettent de parler d'un prêt, jamais de le conclure par téléphone. */
  var O2PC_THEMES = ["majeur", "flux", "plafond", "cat", "renouvelable", "pret", "iard", "enfant", "lj", "concurrence", "pea", "av"];
  var CREDITS_O2PC = ["CCONSO", "CIMMO"];
  function modO2pc() {
    if (typeof window !== "undefined") return window.SGBF && window.SGBF.o2pc ? window.SGBF.o2pc : null;
    try { return require("./o2pc.js"); } catch (e) { return null; }
  }
  function themeO2pc(id) { return O2PC_THEMES.indexOf(id) >= 0 ? id : ""; }
  function creditO2pc(o, pid) { return !!(o && themeO2pc(o.o2pc) && CREDITS_O2PC.indexOf(pid) >= 0); }
  function produitPermis(p, o2pc) { return !!p && (K.prospectionPossible(p) || (!!o2pc && CREDITS_O2PC.indexOf(p.id) >= 0)); }
  function produitsPossibles(o2pc) { return PR.produits.filter(function (p) { return produitPermis(p, !!o2pc); }); }
  function verdictProduit(st, c, pid) { return K.verdictClient(c, pid, st).verdict; }
  /* Campagnes qui concernent le client et dont la période comprend la date. */
  function campagnesDuClient(st, cid, ymd) {
    return CA.campagnes(st).filter(function (k) { return k.ids.indexOf(cid) >= 0 && (!ymd || (ymd >= k.debut && ymd <= k.fin)); });
  }
  function detenus(st, c) { return PR.produits.filter(function (p) { return verdictProduit(st, c, p.id) === "detenu"; }); }

  /* ---------- contrôle d'un appel ----------
     o = { client, date, heure, base, baseDate, lien, camp, prod, rebond, res, motif, note, suiteDate, suiteHeure, suiteCanal, relance }
     Renvoie { bloquants: [{champ, msg}], alertes: [msg], demarchage, quota }. Un blocage empêche l'enregistrement ; une alerte le permet. */
  function controleAppel(st, o) {
    var bl = [], al = [], c = CLIENT[parseInt(o.client, 10)] || null, cid = c ? c.id : null;
    var GROUPES = { client: "client", date: "moment", heure: "moment", base: "base", baseDate: "base", lien: "base", camp: "produit", prod: "produit" };
    function bloque(champ, msg, groupe) { bl.push({ champ: champ, msg: msg, groupe: groupe || GROUPES[champ] || champ }); }
    if (!c) { bloque("client", "Choisissez le client à appeler."); return { bloquants: bl, alertes: al, demarchage: false, quota: null }; }
    var auj = B.aujourdhui(), d = B.lireYmd(o.date), h = espaces(o.heure), m = AG.minutes(h);
    if (!d) bloque("date", "Saisissez la date de l'appel.");
    else if (B.ecartJours(d, auj) > 0) bloque("date", "L'appel ne peut pas être daté du futur : enregistrez-le une fois passé.");
    else if (B.ecartJours(auj, d) > PASSE_MAX) bloque("date", "L'appel date de plus de " + PASSE_MAX + " jours : choisissez une date plus récente.");
    if (!h) bloque("heure", "Indiquez l'heure de l'appel, par exemple 14:30.");
    else if (isNaN(m)) bloque("heure", "Saisissez une heure valide, par exemple 14:30.");
    else if (d && B.ecartJours(d, auj) === 0 && m > B.maintenant().getHours() * 60 + B.maintenant().getMinutes()) bloque("heure", "Cette heure n'est pas encore arrivée (il est " + B.hhmm(B.maintenant()) + ").");
    var base = BASES[o.base] ? o.base : "", dem = demarchage(base);
    if (!base) bloque("base", "Indiquez sur quel fondement vous appelez ce client : son accord, un contrat en cours ou sa demande.");
    if (base === "consentement") {
      var bd = B.lireYmd(o.baseDate);
      if (!bd) bloque("baseDate", "Indiquez la date à laquelle le client a donné son accord.");
      else if (d && B.ecartJours(bd, d) > 0) bloque("baseDate", "L'accord ne peut pas être postérieur à l'appel.");
      else if (d && B.ecartJours(d, bd) > VALIDITE_ACCORD) bloque("baseDate", "L'accord date de plus d'un an : il faut le recueillir de nouveau avant d'appeler (par exemple lors d'un rendez-vous ou par e-mail).");
    }
    if (base === "contrat") {
      var lien = espaces(o.lien);
      if (lien.length < MIN_LIEN) bloque("lien", "Indiquez le contrat que détient le client et le lien précis avec le produit proposé (" + MIN_LIEN + " caractères au moins). Sans lien avec l'objet du contrat, l'exception ne s'applique pas.");
      else if (lien.length > MAX_LIEN) bloque("lien", "Le lien avec le contrat est limité à " + MAX_LIEN + " caractères.");
    }
    var stop = dernierStop(st, cid);
    if (stop && dem && d && stop.date + " " + stop.heure <= o.date + " " + h) {
      var nouvel = base === "consentement" && B.lireYmd(o.baseDate) && o.baseDate > stop.date;
      if (!nouvel) bloque("base", "Ce client a demandé à ne plus être appelé le " + quand(stop) + " : vous ne pouvez plus le démarcher par téléphone. Un appel redevient possible s'il le demande lui-même ou s'il donne un nouvel accord (date postérieure à sa demande).");
    }
    var quota = null;
    if (dem && d) {
      var dates = datesDemarchage(st, cid, o.sauf || null);
      quota = quotaClient(st, cid, B.ymd(d));
      if (!peutAjouter(dates, d)) bloque("date", "Ce client a déjà été appelé " + QUOTA + " fois au cours des 30 derniers jours (tentatives sans réponse comprises) : un nouvel appel de démarchage est possible à partir du " + B.fmtDate(prochaineDate(dates, d)) + ".", "quota");
      if (d && !isNaN(m)) { var cr = creneau(B.ymd(d), h); if (!cr.ok) al.push(cr.raison + " L'appel est enregistré avec la mention « hors créneau »."); }
    }
    /* produit et campagne */
    var pid = o.prod || "", kamp = o.camp ? CA.trouver(st, o.camp) : null;
    if (o.camp && !kamp) bloque("camp", "Cette campagne n'existe plus.");
    else if (kamp) {
      if (kamp.ids.indexOf(cid) < 0) bloque("camp", "Ce client ne fait pas partie de la cible de cette campagne.");
      else if (d && (B.ymd(d) < kamp.debut || B.ymd(d) > kamp.fin)) bloque("camp", "La date de l'appel est en dehors de la période de la campagne (du " + B.fmtDate(B.lireYmd(kamp.debut)) + " au " + B.fmtDate(B.lireYmd(kamp.fin)) + ").");
      pid = kamp.produit;
    }
    if (!pid) bloque("prod", "Choisissez le produit que vous proposez.");
    else if (!PR.parId[pid] || !produitPermis(PR.parId[pid], !!themeO2pc(o.o2pc))) bloque("prod", PR.parId[pid] && PR.parId[pid].famille === "credit" ? "Les crédits ne se proposent pas ici : ils se montent dans « Montage de prêt »." : "Ce produit ne peut pas être proposé par téléphone : " + (PR.parId[pid] ? K.raisonHorsProspection(PR.parId[pid]) : "produit inconnu") + ".");
    else if (creditO2pc(o, pid)) {
      /* crédit évoqué depuis une opportunité O2PC : le client peut déjà en détenir un autre (rachat, réserve d'argent) ; la décision se prend au rendez-vous */
      if (verdictProduit(st, c, pid) === "non") al.push("D'après son dossier, ce client ne paraît pas pouvoir emprunter aujourd'hui (endettement, revenus ou incidents) : ne promettez rien, l'étude se fera en rendez-vous dans « Montage de prêt ».");
    } else {
      var v = verdictProduit(st, c, pid);
      if (v === "detenu") bloque("prod", "Ce client détient déjà ce produit : il est inutile de le lui proposer.");
      else if (v === "non") bloque("prod", "Ce client n'est pas éligible à ce produit : choisissez-en un autre.");
    }
    return { bloquants: bl, alertes: al, demarchage: dem, quota: quota, produit: pid };
  }

  /* Valeurs du rendez-vous ou du rappel à ajouter à l'agenda selon le résultat. */
  function suiteAgenda(o, pid) {
    var r = RESULTATS[o.res];
    if (!r || !r.suite) return null;
    var nom = nomProduit(pid);
    var base = { client: parseInt(o.client, 10), date: o.suiteDate, heure: espaces(o.suiteHeure), camp: o.camp || "" };
    if (r.suite === "rdv") return Object.assign(base, { type: "rdv", objet: "Rendez-vous : " + nom, canal: o.suiteCanal || CANAUX_RDV[0], note: "Obtenu par téléphone le " + B.fmtDate(B.lireYmd(o.date)) + "." });
    return Object.assign(base, { type: "relance", objet: "Rappeler : " + nom, canal: "Par téléphone", note: "Rappel demandé par le client lors de l'appel du " + B.fmtDate(B.lireYmd(o.date)) + "." });
  }
  /* Première heure pleine libre d'un jour pour un rendez-vous (de 9 h à 17 h) ; 10:00 si aucune ne l'est. */
  function heureLibre(st, cid, ymd) {
    for (var h = 9; h <= 17; h++) {
      var t = (h < 10 ? "0" : "") + h + ":00";
      if (AG.valider(st, { type: "rdv", client: cid, objet: "Rendez-vous", date: ymd, heure: t, canal: CANAUX_RDV[0] }, null).ok) return t;
    }
    return "10:00";
  }
  function controleResultat(st, o, pid) {
    var r = RESULTATS[o.res], note = espaces(o.note);
    if (!r) return err("res", "Choisissez le résultat de l'appel.");
    if (r.motif && CA.MOTIFS_REFUS.indexOf(o.motif) < 0) return err("motif", "Choisissez le motif du refus.");
    if (note.length > MAX_NOTE) return err("note", "Le compte rendu est limité à " + MAX_NOTE + " caractères.");
    if (o.res !== "nr" && note.length < MIN_NOTE) return err("note", "Résumez l'échange en quelques mots (" + MIN_NOTE + " caractères au moins) : ce que le client a dit, ce qui a été convenu.");
    if (o.res === "accord" && PR.parId[pid] && PR.parId[pid].famille === "credit") return err("res", "Un crédit ne se conclut pas par téléphone : proposez un rendez-vous pour étudier le projet (« Montage de prêt »).");
    if (o.rebond) {
      var c = CLIENT[parseInt(o.client, 10)], pr = PR.parId[o.rebond];
      if (o.res === "nr") return err("rebond", "Il n'y a pas de rebond sans échange avec le client : l'appel est resté sans réponse.");
      if (o.rebond === pid) return err("rebond", "Le rebond doit porter sur un autre produit que celui de l'appel.");
      if (!pr || !K.prospectionPossible(pr)) return err("rebond", pr && pr.famille === "credit" ? "Un crédit ne se propose pas ici : il se monte dans « Montage de prêt »." : "Ce produit ne peut pas être proposé : " + (pr ? K.raisonHorsProspection(pr) : "choisissez un produit de la liste."));
      var vr = verdictProduit(st, c, o.rebond);
      if (vr === "detenu") return err("rebond", "Ce client détient déjà ce produit : il est inutile de le lui proposer en rebond.");
      if (vr === "non") return err("rebond", "Ce client n'est pas éligible à ce produit : choisissez-en un autre pour le rebond.");
    }
    if (r.suite) {
      var s = suiteAgenda(o, pid);
      if (!o.suiteDate) return err("suiteDate", r.suite === "rdv" ? "Indiquez la date du rendez-vous obtenu." : "Indiquez la date à laquelle le client veut être rappelé.");
      var v = AG.valider(st, s, null);
      if (!v.ok) return err(v.champ === "date" ? "suiteDate" : v.champ === "heure" ? "suiteHeure" : v.champ === "canal" ? "suiteCanal" : v.champ, (r.suite === "rdv" ? "Rendez-vous : " : "Rappel : ") + v.erreur);
    }
    return { ok: true };
  }

  /* ---------- enregistrement ---------- */
  function enregistrer(st, o) {
    var ct = controleAppel(st, o);
    if (ct.bloquants.length) return err(ct.bloquants[0].champ, ct.bloquants[0].msg);
    if (appels(st).length >= MAX_APPELS) return err("", "Le journal contient déjà " + MAX_APPELS + " appels : supprimez-en avant d'en ajouter.");
    var pid = ct.produit, cr = controleResultat(st, o, pid);
    if (!cr.ok) return cr;
    var cid = parseInt(o.client, 10), d = B.lireYmd(o.date), r = RESULTATS[o.res];
    var a = { id: uid(), c: cid, date: B.ymd(d), heure: espaces(o.heure), prod: pid, camp: o.camp || "", base: o.base,
      baseDate: o.base === "consentement" ? o.baseDate : "", lien: o.base === "contrat" ? espaces(o.lien) : "",
      res: o.res, motif: r.motif ? o.motif : "", rebond: o.res === "nr" ? "" : (o.rebond || ""), note: espaces(o.note), suite: null, rel: "", refusCamp: false, o2pc: themeO2pc(o.o2pc),
      cree: B.ymd(B.aujourdhui()) + " " + B.hhmm(B.maintenant()), par: (st.eleve && st.eleve.nom) || "" };
    /* rendez-vous ou rappel dans l'agenda (déjà contrôlé : la création ne peut pas échouer) */
    if (r.suite) {
      var ag = AG.creer(st, suiteAgenda(o, pid));
      if (!ag.ok) return err(ag.champ === "date" ? "suiteDate" : ag.champ === "heure" ? "suiteHeure" : ag.champ, ag.erreur);
      a.suite = { type: ag.element.type, id: ag.element.id, date: ag.element.date, heure: ag.element.heure, canal: ag.element.canal };
    }
    /* refus : noté dans la campagne si l'appel s'y rattache */
    if ((o.res === "refus" || o.res === "stop") && a.camp) {
      var rr = CA.refuser(st, a.camp, cid, o.res === "refus" ? o.motif : "Autre raison");
      a.refusCamp = !!rr.ok;
    }
    /* rappel demandé par le client puis effectué : la relance de l'agenda est terminée */
    if (o.relance) {
      var x = AG.trouver(st, o.relance);
      if (x && x.client === cid && x.type === "relance" && x.statut === "afaire") { AG.changerStatut(st, o.relance, "fait"); a.rel = o.relance; }
    }
    if (!Array.isArray(st.appels)) st.appels = [];
    st.appels.push(a);
    return { ok: true, appel: a, hors: demarchage(a.base) && !creneau(a.date, a.heure).ok };
  }
  /* Supprime un appel et ce qu'il avait créé : rendez-vous ou rappel encore à faire, refus noté dans la campagne, relance terminée. */
  function supprimer(st, id) {
    var a = trouver(st, id);
    if (!a) return { ok: false };
    var retire = [];
    if (a.suite && a.suite.id) { var x = AG.trouver(st, a.suite.id); if (x && x.statut === "afaire" && AG.supprimer(st, a.suite.id)) retire.push(a.suite.type === "rdv" ? "le rendez-vous" : "le rappel"); }
    if (a.refusCamp && a.camp && CA.annulerRefus(st, a.camp, a.c)) retire.push("le refus noté dans la campagne");
    if (a.rel) { var y = AG.trouver(st, a.rel); if (y && y.statut === "fait") { AG.changerStatut(st, a.rel, "afaire"); retire.push("la clôture du rappel (il redevient à faire)"); } }
    st.appels = appels(st).filter(function (p) { return p.id !== id; });
    return { ok: true, retire: retire };
  }

  /* ---------- lecture ---------- */
  function trier(l) { return l.slice().sort(function (x, y) { return x.date + x.heure < y.date + y.heure ? 1 : x.date + x.heure > y.date + y.heure ? -1 : x.id < y.id ? 1 : -1; }); }
  function journal(st) { return trier(appels(st)); }
  function duClient(st, cid) { return trier(appels(st).filter(function (a) { return a.c === cid; })); }
  function horsCreneau(a) { return demarchage(a.base) && !creneau(a.date, a.heure).ok; }
  function joint(a) { return !!(RESULTATS[a.res] && RESULTATS[a.res].contact); }
  /* Totaux d'une liste d'appels. */
  function totaux(l) {
    var t = { appels: l.length, joints: 0, sansReponse: 0, clients: 0, jointsClients: 0, hors: 0, rebonds: 0, parResultat: {}, parMotif: {}, parBase: {} }, cl = {}, jc = {};
    ORDRE_RESULTATS.forEach(function (k) { t.parResultat[k] = 0; });
    CA.MOTIFS_REFUS.forEach(function (m) { t.parMotif[m] = 0; });
    Object.keys(BASES).forEach(function (k) { t.parBase[k] = 0; });
    l.forEach(function (a) {
      t.parResultat[a.res] = (t.parResultat[a.res] || 0) + 1;
      if (joint(a)) { t.joints++; jc[a.c] = true; if (a.rebond) t.rebonds++; } else t.sansReponse++;
      cl[a.c] = true;
      if (horsCreneau(a)) t.hors++;
      if (a.res === "refus" && a.motif) t.parMotif[a.motif]++;
      t.parBase[a.base] = (t.parBase[a.base] || 0) + 1;
    });
    t.clients = Object.keys(cl).length; t.jointsClients = Object.keys(jc).length;
    t.tauxJoint = t.appels ? Math.round(100 * t.joints / t.appels) : null;
    return t;
  }

  /* ---------- file d'appels ---------- */
  /* Rappels à faire : relances par téléphone de l'agenda (en retard, aujourd'hui, à venir). */
  function rappelsAFaire(st) {
    var r = AG.aFaire(st), l = [].concat(r.retard, r.auj, r.avenir);
    return l.filter(function (e) { return e.type === "relance" && e.canal === "Par téléphone" && e.client; });
  }
  /* Situation d'un client pour l'appeler maintenant : peut-on le démarcher, et sur quelle base ? */
  function situation(st, cid) {
    var q = quotaClient(st, cid), stop = dernierStop(st, cid), cr = creneau(B.ymd(B.aujourdhui()), B.hhmm(B.maintenant()));
    return { quota: q, stop: stop, creneauOk: cr.ok, creneau: cr };
  }

  /* ---------- script d'appel et réponses aux objections ---------- */
  var QUESTIONS = {
    compte: ["Comment utilisez-vous votre compte au quotidien ?", "Quels moyens de paiement utilisez-vous le plus ?", "Y a-t-il un frais ou un service qui ne vous convient pas ?"],
    carte: ["Comment utilisez-vous votre carte (achats, retraits, voyages) ?", "Le plafond actuel vous convient-il ?", "Voyagez-vous à l'étranger ?"],
    epargne: ["Pour quel projet épargnez-vous (précaution, achat, retraite) ?", "Sur quelle durée ?", "Avez-vous besoin de pouvoir récupérer cet argent à tout moment ?"],
    placement: ["Quel est votre objectif (retraite, projet à long terme, transmission) ?", "Quel horizon de placement envisagez-vous ?", "Quelle part de risque acceptez-vous de prendre ?"],
    credit: ["Avez-vous un projet qui demande un financement, ou l'envie de disposer d'une réserve d'argent pour les imprévus ?", "Avez-vous des crédits en cours, dans quel établissement, avec quelle mensualité ?", "Quelle mensualité pourriez-vous supporter sans changer votre budget ?"],
    assurance: ["Quels contrats d'assurance avez-vous déjà, et auprès de quel assureur ?", "Qu'est-ce qui vous préoccupe le plus (logement, santé, véhicule, proches) ?", "À quelle date arrivent vos échéances ?"],
    mobile: ["Quel opérateur avez-vous pour votre mobile et pour votre box internet, et pour quel prix par mois ?", "Êtes-vous engagé, et jusqu'à quelle date ? Quel volume de données consommez-vous ?", "Voyagez-vous à l'étranger, et votre logement est-il raccordé à la fibre ?"]
  };
  var OBJECTIONS = [
    { q: "« Je n'ai pas le temps. »", r: "Je comprends tout à fait, je ne vous retiens pas. À quel moment puis-je vous rappeler ?", note: "Notez le résultat « Demande à être rappelé », avec la date et l'heure convenues." },
    { q: "« Cela ne m'intéresse pas. »", r: "Je vous remercie de votre franchise. Puis-je vous demander ce qui ne vous convient pas, afin de ne pas vous proposer ce qui ne répond pas à votre besoin ?", note: "Notez le résultat « Refus » et le motif donné par le client." },
    { q: "« J'ai déjà ce produit dans une autre banque. »", r: "Vous avez bien fait de vous équiper. Si vous le souhaitez, nous pouvons comparer simplement les conditions lors d'un rendez-vous, sans aucun engagement de votre part.", note: "Si le client accepte : notez le résultat « Rendez-vous obtenu »." },
    { q: "« C'est trop cher. »", r: "Je comprends. Reprenons ensemble ce que ce produit vous apporte et ce qu'il vous coûte, poste par poste. Souhaitez-vous que je vous envoie le détail des tarifs afin de comparer ?", note: "Si le client le demande : notez le résultat « Souhaite de la documentation »." },
    { q: "« Je dois réfléchir, en parler à mon conjoint. »", r: "Bien sûr, c'est une décision qui se prend à deux. Je peux vous envoyer une documentation à lire ensemble et convenir d'un rendez-vous dans quelques jours, si vous le souhaitez.", note: "Selon la réponse : « Souhaite de la documentation » ou « Rendez-vous obtenu »." },
    { q: "« Envoyez-moi plutôt un e-mail. »", r: "Volontiers. À quelle adresse dois-je vous écrire ? Je vous envoie le message dès la fin de cet appel.", note: "Notez le résultat « Souhaite de la documentation », puis écrivez au client depuis la messagerie." },
    { q: "« Comment avez-vous eu mon numéro ? »", r: "Vous êtes client de l'agence : votre numéro figure dans votre dossier. Je vous appelle {fondement}. Vous pouvez à tout moment me dire que vous ne souhaitez plus être appelé, et j'en tiendrai compte immédiatement.", note: "" },
    { q: "« Ne m'appelez plus. »", r: "C'est entendu, j'en prends note immédiatement : vous ne serez plus appelé pour des propositions commerciales. Je vous souhaite une bonne journée.", note: "Notez le résultat « Demande à ne plus être appelé » : l'outil bloquera tout nouvel appel de démarchage." }
  ];
  function fondementPhrase(o) {
    if (o && o.base === "consentement") return "parce que vous avez accepté que la banque vous contacte par téléphone";
    if (o && o.base === "contrat") return "au sujet d'un contrat que vous détenez déjà chez nous";
    if (o && o.base === "demande") return "parce que vous avez demandé à être appelé";
    return "en tant que client de l'agence";
  }
  /* Script en cinq étapes, construit à partir de la fiche du produit, du dossier du client et de la campagne éventuelle.
     « texte » : ce que l'on dit au client (modifiable) ; « note » : la consigne pour le conseiller (non modifiable). */
  function script(st, o) {
    var c = CLIENT[parseInt(o.client, 10)], p = o.prod && PR.parId[o.prod] ? PR.parId[o.prod] : null, k = o.camp ? CA.trouver(st, o.camp) : null;
    if (!c) return [];
    if (k) p = PR.parId[k.produit];
    var nomC = (c.civ === "Mme" ? "Madame " : "Monsieur ") + c.nom, moi = (st.eleve && st.eleve.nom) ? st.eleve.nom : "(votre nom)";
    var det = detenus(st, c).map(function (x) { return x.nom; });
    var arg = k ? k.args.slice() : p ? (p.avantages || []).slice(0, 3) : [];
    var O = themeO2pc(o.o2pc) ? modO2pc() : null, opp = O ? O.opportunite(st, c.id, o.o2pc) : null, credit = !!(p && p.famille === "credit");
    var etapes = [];
    etapes.push({ titre: "1. Se présenter", texte: ["Bonjour " + nomC + ", je suis " + moi + ", de GS Banque & Assurance, agence de Paris. Je vous appelle pour vous faire une proposition commerciale" + (p ? " concernant : " + p.nom : "") + ". Avez-vous quelques minutes à m'accorder ?"], note: "Au début de l'appel, annoncez votre identité, celle de la banque et le but commercial de l'appel." });
    etapes.push({ titre: "2. Dire pourquoi vous appelez", texte: [o && o.base ? "Je vous appelle " + fondementPhrase(o) + ". Si vous ne souhaitez plus être appelé, dites-le-moi : j'en tiendrai compte immédiatement." : "Choisissez d'abord le fondement de l'appel (avant d'appeler)."], note: "Rappelez au client qu'il peut à tout moment ne plus souhaiter être appelé." + (opp ? " Opportunité O2PC « " + opp.theme.lib + " » : " + opp.motif : "") });
    var q = (p && QUESTIONS[p.famille]) || [];
    etapes.push({ titre: "3. Découvrir sa situation", texte: [det.length ? "Je vois dans votre dossier que vous détenez chez nous : " + det.join(", ") + "." : "Je vois que vous n'avez pas encore de produit chez nous."].concat(q), liste: true, note: "Écoutez avant de proposer : notez ses réponses dans le compte rendu." + (opp ? " Ce que dit le dossier : " + opp.details.join(" ") : "") });
    var presenter = p ? [p.accroche].concat(arg.length ? ["Ce que cela vous apporte : " + arg.join(" ")] : []) : [];
    var risques = p && p.risques ? p.risques.slice(0, 2) : [];
    etapes.push({ titre: "4. Présenter le produit", texte: presenter.length ? presenter : ["Choisissez d'abord le produit à proposer."], note: risques.length ? "Point d'attention à annoncer : " + risques.join(" ") : "" });
    if (credit) etapes.push({ titre: "5. Conclure", texte: ["Je ne peux pas vous accorder de crédit par téléphone, mais je peux étudier votre projet avec vous lors d'un rendez-vous à l'agence, sans engagement de votre part. Quand seriez-vous disponible ?", "Je vous remercie de votre temps. Bonne journée."], note: "Un crédit ne se conclut jamais par téléphone : proposez un rendez-vous (résultat « Rendez-vous obtenu »), puis montez le dossier dans « Montage de prêt ». Le taux est celui en vigueur, communiqué dans la newsletter." });
    else etapes.push({ titre: "5. Conclure", texte: ["Souhaitez-vous que nous convenions d'un rendez-vous ? Je peux aussi vous envoyer une documentation par e-mail ou, si vous êtes décidé, préparer votre souscription.", "Je vous remercie de votre temps. Bonne journée."], note: "Notez ensuite le résultat de l'appel et la suite donnée." });
    return etapes;
  }
  function objections(o) { var f = fondementPhrase(o); return OBJECTIONS.map(function (x) { return { q: x.q, r: x.r.replace("{fondement}", f), note: x.note || "" }; }); }

  /* ---------- texte modifié par l'élève ---------- */
  /* La modification vaut pour un client, un produit, une campagne et un fondement d'appel donnés : cleScript les identifie. */
  var MAX_LIGNE_SCRIPT = 800, MAX_LIGNES_ETAPE = 12, MAX_REPONSE = 600;
  function cleScript(o) { return [o.client, o.prod || "", o.camp || "", o.base || "", themeO2pc(o.o2pc)].join("|"); }
  function sansNumero(t) { return String(t).replace(/^\d+\.\s*/, ""); }
  /* textes : une chaîne par étape, une ligne par phrase (à l'étape 3, une ligne par question). */
  function controleScript(etapes, textes) {
    var res = [];
    for (var i = 0; i < etapes.length; i++) {
      var nom = "« " + sansNumero(etapes[i].titre) + " »";
      var lignes = propre(textes && textes[i] != null ? textes[i] : "").split("\n").map(function (x) { return x.replace(/\s+/g, " ").trim(); }).filter(function (x) { return x; });
      if (!lignes.length) return err("sc" + i, "L'étape " + nom + " est vide : écrivez au moins une phrase, ou revenez au script type.");
      if (lignes.length > MAX_LIGNES_ETAPE) return err("sc" + i, "L'étape " + nom + " compte plus de " + MAX_LIGNES_ETAPE + " lignes : gardez l'essentiel.");
      if (lignes.some(function (x) { return x.length > MAX_LIGNE_SCRIPT; })) return err("sc" + i, "Une ligne de l'étape " + nom + " dépasse " + MAX_LIGNE_SCRIPT + " caractères : coupez-la en deux phrases.");
      res.push(lignes);
    }
    return { ok: true, textes: res };
  }
  /* Remplace, étape par étape, le texte type par le texte de l'élève (textes = résultat de controleScript). */
  function appliquerScript(etapes, textes) {
    return etapes.map(function (x, i) { var y = {}; Object.keys(x).forEach(function (k) { y[k] = x[k]; }); if (textes && textes[i] && textes[i].length) y.texte = textes[i].slice(); return y; });
  }
  function controleObjections(liste, textes) {
    var res = [];
    for (var i = 0; i < liste.length; i++) {
      var t = espaces(textes && textes[i] != null ? textes[i] : "");
      if (!t) return err("ob" + i, "La réponse à " + liste[i].q + " est vide : écrivez une réponse, ou revenez aux réponses types.");
      if (t.length > MAX_REPONSE) return err("ob" + i, "La réponse à " + liste[i].q + " dépasse " + MAX_REPONSE + " caractères : raccourcissez-la.");
      res.push(t);
    }
    return { ok: true, reponses: res };
  }
  function appliquerObjections(liste, reponses) {
    return liste.map(function (x, i) { return { q: x.q, r: reponses && reponses[i] ? reponses[i] : x.r, note: x.note }; });
  }

  var api = {
    MAX_APPELS: MAX_APPELS, MAX_NOTE: MAX_NOTE, MAX_LIEN: MAX_LIEN, MIN_LIEN: MIN_LIEN, MIN_NOTE: MIN_NOTE, QUOTA: QUOTA, FENETRE: FENETRE, PASSE_MAX: PASSE_MAX, VALIDITE_ACCORD: VALIDITE_ACCORD,
    CRENEAUX: CRENEAUX, BASES: BASES, RESULTATS: RESULTATS, ORDRE_RESULTATS: ORDRE_RESULTATS, CANAUX_RDV: CANAUX_RDV, QUESTIONS: QUESTIONS, OBJECTIONS: OBJECTIONS,
    appels: appels, trouver: trouver, demarchage: demarchage, creneau: creneau, creneauLib: creneauLib, quotaDepasse: quotaDepasse, peutAjouter: peutAjouter, prochaineDate: prochaineDate,
    datesDemarchage: datesDemarchage, dansFenetre: dansFenetre, quotaClient: quotaClient, dernierStop: dernierStop, produitsPossibles: produitsPossibles, verdictProduit: verdictProduit, themeO2pc: themeO2pc, O2PC_THEMES: O2PC_THEMES, CREDITS_O2PC: CREDITS_O2PC,
    campagnesDuClient: campagnesDuClient, detenus: detenus, controleAppel: controleAppel, controleResultat: controleResultat, heureLibre: heureLibre, suiteAgenda: suiteAgenda, enregistrer: enregistrer, supprimer: supprimer,
    journal: journal, duClient: duClient, horsCreneau: horsCreneau, joint: joint, totaux: totaux, rappelsAFaire: rappelsAFaire, situation: situation, script: script, objections: objections, cleScript: cleScript, controleScript: controleScript, appliquerScript: appliquerScript, controleObjections: controleObjections, appliquerObjections: appliquerObjections,
    MAX_LIGNE_SCRIPT: MAX_LIGNE_SCRIPT, MAX_LIGNES_ETAPE: MAX_LIGNES_ETAPE, MAX_REPONSE: MAX_REPONSE,
    heureLib: heureLib, quand: quand, pluriel: pl, maj1: maj1
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.phoning = api; }
})(typeof window !== "undefined" ? window : null);
