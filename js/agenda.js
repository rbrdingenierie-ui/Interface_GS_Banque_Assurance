/* GS Banque & Assurance – agenda commercial : rendez-vous de l'agence (fictifs, ceux de l'accueil), rendez-vous, relances et rappels créés par l'élève,
   contacts déjà enregistrés dans les dossiers. Tout est placé sur les jours d'ouverture de l'agence (dimanche, lundi et jours fériés exclus) à partir de la date de connexion à l'outil.
   Horaires de l'agence : mardi au vendredi de 9 h à 13 h puis de 14 h à 18 h, samedi de 9 h à 13 h ; fermée le lundi (repos hebdomadaire), le dimanche et les jours fériés. L'agenda affiche donc cinq jours par semaine, du mardi au samedi.
   Plages réservées chaque jour d'ouverture (samedi compris) : gestion des débiteurs, atypiques et GDI (9 h 10 – 10 h), proactivité (11 h – 12 h) et plage accueil (une heure tirée au sort pour chaque jour), plus la réunion d'équipe le jeudi (14 h – 15 h) ;
   aucun rendez-vous ne s'y place (la relance et le rappel restent possibles). Les plages sont calculées dans banque.js.
   Conventions de l'exercice (aucune règle officielle) : un rendez-vous occupe 1 h et doit se terminer avant la fermeture (dernier départ à 12 h le matin et le samedi, à 17 h l'après-midi) ;
   on ne planifie que d'aujourd'hui à un an. Les éléments de l'élève sont enregistrés dans le navigateur (store().agenda).
   Rendez-vous d'un client avec un autre conseiller (type « rdv_col ») : le collègue doit être libre (equipe.js) ; l'étudiant n'y assiste pas et reste libre ; le client ne peut pas avoir deux rendez-vous qui se chevauchent. */
(function (root) {
  "use strict";

  var B = root && root.SGBF ? root.SGBF.banque : require("./banque.js");
  var S = root && root.SGBF ? root.SGBF.synthese : require("./synthese.js");
  var CL = root && root.SGBF ? root.SGBF.clients : require("./data_clients.js").clients;
  var E = root && root.SGBF ? root.SGBF.equipe : require("./equipe.js");
  var CLIENT = {}; CL.forEach(function (c) { CLIENT[c.id] = c; });

  var HEURE_MIN = "09:00", HEURE_RDV_MAX = "17:00", HEURE_MAX = "18:00", DUREE_RDV = 60, NB_JOURS_AGENCE = 15, HORIZON = 365, MAX_OBJET = 120, MAX_NOTE = 300, MAX_ELEMENTS = 200;
  var TYPES = {
    rdv: { lib: "Rendez-vous", client: true, heure: true, hmax: HEURE_RDV_MAX, canaux: ["En agence", "Par téléphone"] },
    relance: { lib: "Relance", client: true, heure: true, hmax: HEURE_MAX, canaux: ["Par téléphone", "Par e-mail"] },
    rappel: { lib: "Rappel", client: false, heure: false, hmax: HEURE_MAX, canaux: [] },
    /* rendez-vous interne avec un collègue de l'agence (voir equipe.js) : une heure, le collègue doit être libre en même temps que l'étudiant */
    interne: { lib: "Rendez-vous avec un collègue", client: false, heure: true, hmax: HEURE_RDV_MAX, canaux: ["En agence", "Par téléphone"] },
    /* rendez-vous d'un client avec un autre conseiller de l'agence : le client est reçu par le collègue seul (l'étudiant n'y assiste pas) ; seule la disponibilité du collègue compte */
    rdv_col: { lib: "Rendez-vous du client avec un collègue", client: true, heure: true, hmax: HEURE_RDV_MAX, canaux: ["En agence", "Par téléphone"] }
  };
  var STATUTS = { afaire: "À faire", fait: "Fait", annule: "Annulé" };
  var HORAIRES_LIB = "du mardi au vendredi de 9 h à 13 h et de 14 h à 18 h, le samedi de 9 h à 13 h (fermée le lundi, le dimanche et les jours fériés)";

  function hTxt(h) { var m = /^(\d{2}):(\d{2})$/.exec(h || ""); return m ? (+m[1]) + " h" + (m[2] === "00" ? "" : " " + m[2]) : ""; }
  function minutes(h) { var m = /^(\d{2}):(\d{2})$/.exec(String(h == null ? "" : h)); if (!m) return NaN; var H = +m[1], M = +m[2]; return H > 23 || M > 59 ? NaN : H * 60 + M; }
  function propre(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); }
  function pl(n, s, p) { return n + " " + (n > 1 ? p : s); }

  /* ---------- calendrier ---------- */
  function nomFerie(d) {
    var y = d.getFullYear(), p = B.paques(y), k = B.ymd(d), t = {};
    t[B.ymd(B.D(y, 0, 1))] = "Jour de l'an"; t[B.ymd(B.plusJours(p, 1))] = "Lundi de Pâques"; t[B.ymd(B.D(y, 4, 1))] = "Fête du Travail"; t[B.ymd(B.D(y, 4, 8))] = "Victoire 1945";
    t[B.ymd(B.plusJours(p, 39))] = "Ascension"; t[B.ymd(B.plusJours(p, 50))] = "Lundi de Pentecôte"; t[B.ymd(B.D(y, 6, 14))] = "Fête nationale"; t[B.ymd(B.D(y, 7, 15))] = "Assomption";
    t[B.ymd(B.D(y, 10, 1))] = "Toussaint"; t[B.ymd(B.D(y, 10, 11))] = "Armistice 1918"; t[B.ymd(B.D(y, 11, 25))] = "Noël";
    return t[k] || null;
  }
  /* Jours et heures d'ouverture de l'agence (définis dans banque.js). */
  function ouverte(d) { return B.agenceOuverte(d); }
  function plages(d) { return B.plagesAgence(d); }
  /* Une heure convient si l'élément (de « duree » minutes) tient dans une plage d'ouverture ; pour une durée nulle, l'heure de fermeture est admise. */
  function heureOuverte(d, h, duree) {
    var m = minutes(h), ok = false;
    plages(d).forEach(function (p) { if (m >= minutes(p[0]) && m + (duree || 0) <= minutes(p[1])) ok = true; });
    return ok;
  }
  function lundiDe(d) { var x = B.jour(d); return B.plusJours(x, -((x.getDay() + 6) % 7)); }
  /* La semaine est repérée par son lundi (numérotation habituelle des semaines) mais l'agenda n'en montre que les jours d'ouverture : du mardi au samedi. */
  var NB_JOURS_SEMAINE = 5;
  function debutSemaine(lundi) { return B.plusJours(lundiDe(lundi), 1); }
  /* Semaine affichée par défaut : celle du prochain jour d'ouverture (le dimanche et le lundi, on voit la semaine qui commence le mardi). */
  function semaineParDefaut() { return lundiDe(B.agenceSuivant(B.aujourdhui())); }
  function minutesMaintenant() { var n = B.maintenant(); return n.getHours() * 60 + n.getMinutes(); }
  /* Un élément est passé si sa date est antérieure à aujourd'hui, ou si c'est aujourd'hui et que son heure est dépassée. */
  function passe(date, heure) {
    var e = B.ecartJours(date, B.aujourdhui());
    if (e < 0) return true;
    if (e > 0) return false;
    return !!heure && minutes(heure) < minutesMaintenant();
  }

  /* ---------- rendez-vous de l'agence (ceux de l'accueil) ---------- */
  var cacheAgence = null, cleAgence = null;
  function agence() {
    var cle = B.ymd(B.aujourdhui()) + "|" + CL.length;
    if (cacheAgence && cleAgence === cle) return cacheAgence;
    var l = S.rendezVous(CL, NB_JOURS_AGENCE).map(function (r) { return { kind: "agence", date: r.date, heure: r.heure, client: r.client, motif: r.motif, canal: r.canal }; });
    var dernier = l.length ? l[l.length - 1].date : null;
    cacheAgence = { liste: l, fin: dernier };
    cleAgence = cle;
    return cacheAgence;
  }
  function viderCache() { cacheAgence = null; cleAgence = null; cacheContacts = null; cleContacts = null; }

  /* ---------- contacts déjà enregistrés (notes du dossier) ---------- */
  var cacheContacts = null, cleContacts = null;
  function contactsDossier() {
    var cle = B.ymd(B.aujourdhui()) + "|" + CL.length;
    if (cacheContacts && cleContacts === cle) return cacheContacts;
    var m = {};
    CL.forEach(function (c) {
      c.not.forEach(function (n) {
        var d = B.dateContact(n.j), k = B.ymd(d);
        (m[k] = m[k] || []).push({ kind: "contact", date: d, heure: "", client: c, motif: n.objet, canal: n.canal === "agence" ? "En agence" : "Par téléphone" });
      });
    });
    cacheContacts = m; cleContacts = cle;
    return m;
  }

  /* ---------- éléments de l'élève ---------- */
  function elements(st) { return (st && Array.isArray(st.agenda)) ? st.agenda : []; }
  function trouver(st, id) { return elements(st).filter(function (x) { return x.id === id; })[0] || null; }
  function uid() { return "a" + B.maintenant().getTime().toString(36) + Math.random().toString(36).slice(2, 6); }
  function err(champ, msg) { return { ok: false, champ: champ, erreur: msg }; }
  function libJour(d) { return B.fmtLong(d); }

  /* Un rendez-vous occupe une heure : il ne peut pas en chevaucher un autre (de l'agence ou de l'élève) le même jour. */
  function conflit(st, date, heure, sauf) {
    var k = B.ymd(date), t = minutes(heure), res = null;
    var pc = B.plageChevauchee(date, heure, DUREE_RDV);
    if (pc) return "Ce rendez-vous empiéterait sur la plage réservée « " + pc.lib + " » (" + hTxt(pc.debut) + " à " + hTxt(pc.fin) + ") : aucun rendez-vous n'est possible sur une plage réservée. Plages réservées ce jour-là : " +
      B.plagesReservees(date).map(function (p) { return p.lib + " de " + hTxt(p.debut) + " à " + hTxt(p.fin); }).join(" ; ") + ".";
    agence().liste.forEach(function (r) { if (!res && B.ymd(r.date) === k && Math.abs(minutes(r.heure) - t) < DUREE_RDV) res = "Un rendez-vous de l'agence est déjà prévu à " + r.heure + " avec " + r.client.prenom + " " + r.client.nom + "."; });
    elements(st).forEach(function (x) { if (!res && (x.type === "rdv" || x.type === "interne") && x.statut === "afaire" && x.id !== sauf && x.date === k && Math.abs(minutes(x.heure) - t) < DUREE_RDV) res = "Un de vos rendez-vous est déjà prévu à " + x.heure + "."; });
    return res ? res + " Laissez au moins " + DUREE_RDV / 60 + " h entre deux rendez-vous." : null;
  }
  /* Un client ne peut pas être à deux rendez-vous à la fois : celui de l'agence, les rendez-vous de l'élève et ceux pris avec un collègue (une heure chacun). */
  function conflitClient(st, cid, date, heure, sauf) {
    if (!cid) return null;
    var k = B.ymd(date), t = minutes(heure), res = null, c = CLIENT[cid], nom = c ? c.prenom + " " + c.nom : "Ce client";
    agence().liste.forEach(function (r) { if (!res && r.client.id === cid && B.ymd(r.date) === k && Math.abs(minutes(r.heure) - t) < DUREE_RDV) res = nom + " a déjà un rendez-vous à l'agence à " + hTxt(r.heure) + "."; });
    elements(st).forEach(function (x) {
      if (!res && (x.type === "rdv" || x.type === "rdv_col") && x.statut === "afaire" && x.client === cid && x.id !== sauf && x.date === k && Math.abs(minutes(x.heure) - t) < DUREE_RDV)
        { var cl = x.type === "rdv_col" ? E.collab(x.avec) : null; res = nom + " a déjà un rendez-vous à " + hTxt(x.heure) + (x.type === "rdv_col" ? " avec " + (cl && !cl.moi ? cl.prenom + " " + cl.nom : "un collègue") : " avec vous") + "."; }
    });
    return res ? res + " Laissez au moins " + DUREE_RDV / 60 + " h entre deux rendez-vous d'un même client." : null;
  }
  /* Contrôle d'un élément saisi. « sauf » = élément modifié (ses contrôles de date et d'heure ne se refont que si la date ou l'heure change). */
  function valider(st, o, sauf) {
    var T = TYPES[o.type];
    if (!T) return err("type", "Choisissez ce que vous planifiez : un rendez-vous, un rendez-vous du client avec un collègue, une relance, un rappel ou un rendez-vous avec un collègue.");
    var objet = propre(o.objet), note = String(o.note == null ? "" : o.note).trim();
    if (!objet) return err("objet", o.type === "rappel" ? "Indiquez ce dont il faut se souvenir." : "Indiquez l'objet : par exemple « Bilan épargne » ou « Relance du devis ».");
    if (objet.length > MAX_OBJET) return err("objet", "L'objet est limité à " + MAX_OBJET + " caractères.");
    if (note.length > MAX_NOTE) return err("note", "La remarque est limitée à " + MAX_NOTE + " caractères.");
    var avec = "";
    if (o.type === "interne" || o.type === "rdv_col") {
      avec = o.avec === undefined ? (sauf && sauf.avec ? sauf.avec : "") : String(o.avec || "");
      var col = E.collab(avec);
      if (!col || col.moi) return err("avec", o.type === "rdv_col" ? "Choisissez le collègue qui recevra le client." : "Choisissez le collègue avec qui vous prenez rendez-vous.");
    }
    var cid = o.client == null || o.client === "" ? null : parseInt(o.client, 10);
    if (T.client && !CLIENT[cid]) return err("client", "Choisissez le client concerné.");
    if (cid !== null && !CLIENT[cid]) return err("client", "Ce client n'existe pas dans le portefeuille.");
    /* Campagne commerciale à laquelle l'élément se rattache (facultatif) : elle doit exister. */
    var camp = o.camp === undefined ? (sauf && sauf.camp ? sauf.camp : "") : String(o.camp || "");
    var kc = camp ? (Array.isArray(st.campagnes) ? st.campagnes : []).filter(function (k) { return k.id === camp; })[0] : null;
    if (camp && !kc && o.camp === undefined) camp = ""; /* campagne supprimée depuis : l'élément reste modifiable, sans rattachement */
    if (camp) {
      if (!kc) return err("camp", "Cette campagne n'existe plus.");
      if (cid !== null && kc.ids.indexOf(cid) < 0) return err("camp", "Ce client ne fait pas partie de la cible de cette campagne.");
    }
    var d = B.lireYmd(o.date);
    if (!d) return err("date", "Saisissez une date valide.");
    var statut = o.statut || (sauf ? sauf.statut : "afaire");
    if (!STATUTS[statut]) return err("statut", "Statut inconnu.");
    var heure = propre(o.heure), unHeure = o.type === "rdv" || o.type === "interne" || o.type === "rdv_col";
    var dateChangee = !sauf || sauf.date !== B.ymd(d), heureChangee = !sauf || (sauf.heure || "") !== heure;
    if (T.heure && !heure) return err("heure", "Indiquez l'heure, pendant les heures d'ouverture de l'agence.");
    if (heure) {
      var m = minutes(heure);
      if (isNaN(m)) return err("heure", "Saisissez une heure valide, par exemple 14:30.");
      if ((heureChangee || dateChangee) && ouverte(d) && !heureOuverte(d, heure, unHeure ? DUREE_RDV : 0)) return err("heure", "L'agence est ouverte " + HORAIRES_LIB + " (règle de l'agence)" + (unHeure ? " ; un rendez-vous dure une heure et doit se terminer avant la fermeture (dernier rendez-vous à 12 h le matin et le samedi, à 17 h l'après-midi)." : "."));
    }
    var auj = B.aujourdhui();
    if (dateChangee) {
      if (B.ecartJours(d, auj) < 0) return err("date", "Cette date est passée. Pour garder la trace d'un contact déjà eu, ajoutez une note dans la fiche du client.");
      if (B.ecartJours(d, auj) > HORIZON) return err("date", "On ne planifie pas à plus d'un an : choisissez une date au plus tard le " + B.fmtDate(B.plusJours(auj, HORIZON)) + ".");
      if (!ouverte(d)) {
        var f = B.estFerie(d) ? nomFerie(d) : null;
        return err("date", libJour(d) + (f ? " est un jour férié (" + f + ")" : " tombe un " + B.JOURS[d.getDay()]) + " : l'agence est fermée. Prochain jour d'ouverture : " + libJour(B.agenceSuivant(d)) + ".");
      }
    }
    if (heure && (dateChangee || heureChangee) && B.ecartJours(d, auj) === 0 && minutes(heure) < minutesMaintenant()) return err("heure", "Cette heure est déjà passée aujourd'hui (il est " + B.hhmm(B.maintenant()) + ").");
    var avecChange = (o.type === "interne" || o.type === "rdv_col") && sauf && sauf.avec !== avec;
    if (unHeure && statut === "afaire" && (dateChangee || heureChangee || (sauf && sauf.statut !== "afaire") || avecChange)) {
      /* l'étudiant doit être libre, sauf pour le rendez-vous d'un client avec un collègue : il n'y assiste pas */
      var c = o.type === "rdv_col" ? null : conflit(st, d, heure, sauf ? sauf.id : null);
      if (c) return err("heure", c);
      /* le collègue doit être libre à ce moment-là (ses rendez-vous, ses plages, ses absences) */
      var ind = o.type === "interne" || o.type === "rdv_col" ? E.indisponibilite(st, avec, d, heure, sauf ? sauf.id : null) : null;
      if (ind) return err("heure", ind);
    }
    if ((o.type === "rdv" || o.type === "rdv_col") && statut === "afaire" && (dateChangee || heureChangee || (sauf && (sauf.statut !== "afaire" || sauf.client !== cid)))) {
      var cc = conflitClient(st, cid, d, heure, sauf ? sauf.id : null);
      if (cc) return err("heure", cc);
    }
    var canal = propre(o.canal);
    if (T.canaux.length) { if (!canal) canal = T.canaux[0]; if (T.canaux.indexOf(canal) < 0) return err("canal", "Canal inconnu."); } else canal = "";
    return { ok: true, valeurs: { type: o.type, client: cid, date: B.ymd(d), heure: heure, canal: canal, objet: objet, note: note, statut: statut, camp: camp, avec: avec } };
  }
  function creer(st, o) {
    var v = valider(st, o, null);
    if (!v.ok) return v;
    if (elements(st).length >= MAX_ELEMENTS) return err("", "L'agenda contient déjà " + MAX_ELEMENTS + " éléments : supprimez-en avant d'en ajouter.");
    var x = Object.assign({ id: uid(), cree: B.ymd(B.aujourdhui()) + " " + B.hhmm(B.maintenant()), reporte: false }, v.valeurs);
    x.statut = "afaire";
    if (!Array.isArray(st.agenda)) st.agenda = [];
    st.agenda.push(x);
    return { ok: true, element: x };
  }
  function modifier(st, id, o) {
    var x = trouver(st, id);
    if (!x) return err("", "Cet élément n'existe plus.");
    var v = valider(st, o, x);
    if (!v.ok) return v;
    var change = x.date !== v.valeurs.date || (x.heure || "") !== v.valeurs.heure;
    Object.assign(x, v.valeurs);
    if (change) x.reporte = true;
    return { ok: true, element: x };
  }
  function changerStatut(st, id, statut) {
    var x = trouver(st, id);
    if (!x || !STATUTS[statut]) return false;
    if (statut === "afaire" && x.type === "rdv") { var c = conflit(st, B.lireYmd(x.date), x.heure, x.id); if (c) return { ok: false, erreur: c }; }
    if (statut === "afaire" && x.statut !== "afaire" && (x.type === "rdv" || x.type === "rdv_col")) { var cc = conflitClient(st, x.client, B.lireYmd(x.date), x.heure, x.id); if (cc) return { ok: false, erreur: cc }; }
    if (statut === "afaire" && x.statut !== "afaire" && (x.type === "interne" || x.type === "rdv_col")) { var ind = E.indisponibilite(st, x.avec, B.lireYmd(x.date), x.heure, x.id); if (ind) return { ok: false, erreur: ind }; }
    x.statut = statut;
    return { ok: true, element: x };
  }
  function supprimer(st, id) { var n = elements(st).length; st.agenda = elements(st).filter(function (x) { return x.id !== id; }); return st.agenda.length < n; }

  /* ---------- lecture ---------- */
  function persoEntree(x) { return { kind: "perso", id: x.id, type: x.type, date: B.lireYmd(x.date), heure: x.heure || "", client: x.client ? CLIENT[x.client] : null, motif: x.objet, note: x.note, canal: x.canal, statut: x.statut, reporte: !!x.reporte, camp: x.camp || "", avec: x.avec || "" }; }
  function trier(l) { return l.sort(function (a, b) { var ta = a.heure ? minutes(a.heure) : 1e5, tb = b.heure ? minutes(b.heure) : 1e5; return ta - tb || (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0); }); }
  /* Tout ce qui figure dans l'agenda un jour donné. */
  function jour(st, d) {
    var k = B.ymd(d), l = [];
    agence().liste.forEach(function (r) { if (B.ymd(r.date) === k) l.push(r); });
    elements(st).forEach(function (x) { if (x.date === k) l.push(persoEntree(x)); });
    B.plagesReservees(d).forEach(function (p) { l.push({ kind: "plage", id: p.id, date: d, heure: p.debut, fin: p.fin, motif: p.lib, court: p.court }); });
    if (B.ecartJours(d, B.aujourdhui()) <= 0) {
      (contactsDossier()[k] || []).forEach(function (r) { l.push(r); });
      /* notes ajoutées par l'élève dans la fiche client : rangées le jour d'ouverture de l'agence (le dimanche, le samedi précédent) */
      Object.keys(st.notes || {}).forEach(function (cid) { (st.notes[cid] || []).forEach(function (n) { var dd = B.lireYmd(n.d); if (dd && B.ymd(B.agencePrecedent(dd)) === k && CLIENT[cid]) l.push({ kind: "contact", date: dd, heure: "", client: CLIENT[cid], motif: n.objet, canal: /agence/i.test(n.canal || "") ? "En agence" : /t[ée]l[ée]phone/i.test(n.canal || "") ? "Par téléphone" : n.canal || "", moi: true, reelle: dd }); }); });
    }
    return trier(l);
  }
  function semaine(st, lundi) {
    var l0 = lundiDe(lundi), auj = B.aujourdhui(), jours = [];
    for (var i = 1; i <= NB_JOURS_SEMAINE; i++) {
      var d = B.plusJours(l0, i), f = B.estFerie(d) ? nomFerie(d) : null;
      jours.push({ date: d, ferie: f, auj: B.ecartJours(d, auj) === 0, entrees: f ? [] : jour(st, d) });
    }
    return { lundi: l0, debut: B.plusJours(l0, 1), fin: B.plusJours(l0, NB_JOURS_SEMAINE), numero: S.numeroSemaine(l0) % 100, jours: jours, finAgence: agence().fin };
  }
  /* Éléments de l'élève encore à faire : en retard, aujourd'hui, à venir. */
  function aFaire(st) {
    var r = { retard: [], auj: [], avenir: [] }, auj = B.aujourdhui();
    elements(st).filter(function (x) { return x.statut === "afaire"; }).map(persoEntree).forEach(function (e) {
      var ec = B.ecartJours(e.date, auj);
      if (passe(e.date, e.heure)) r.retard.push(e); else if (ec === 0) r.auj.push(e); else r.avenir.push(e);
    });
    [r.retard, r.auj, r.avenir].forEach(function (l) { l.sort(function (a, b) { return a.date - b.date || (a.heure ? minutes(a.heure) : 1e5) - (b.heure ? minutes(b.heure) : 1e5); }); });
    return r;
  }
  function termines(st) {
    return elements(st).filter(function (x) { return x.statut !== "afaire"; }).map(persoEntree).sort(function (a, b) { return b.date - a.date; });
  }
  /* Ce qui concerne un client : éléments de l'élève à faire et rendez-vous de l'agence prévus (pour la fiche client). */
  function duClient(st, cid) {
    var perso = elements(st).filter(function (x) { return x.client === cid && x.statut === "afaire"; }).map(persoEntree);
    var ag = agence().liste.filter(function (r) { return r.client.id === cid; });
    return perso.concat(ag).sort(function (a, b) { return a.date - b.date || (a.heure ? minutes(a.heure) : 1e5) - (b.heure ? minutes(b.heure) : 1e5); });
  }

  /* Codes couleur de l'agenda (agenda commercial, agenda du conseiller de l'accueil, agenda de l'équipe) : une couleur par sorte d'élément, toujours accompagnée de son nom écrit.
     Le code d'un élément : son type pour un élément de l'élève (rdv, relance, rappel, interne, rdv_col), « agence » pour un rendez-vous de l'agence, « contact » pour une note ou un dossier,
     l'identifiant de la plage pour une plage réservée (gestion, proactivite, reunion, accueil). */
  var CODES = [
    { code: "agence", lib: "Rendez-vous de l'agence", groupe: "Rendez-vous et éléments" },
    { code: "rdv", lib: "Votre rendez-vous", groupe: "Rendez-vous et éléments" },
    { code: "relance", lib: "Votre relance", groupe: "Rendez-vous et éléments" },
    { code: "rappel", lib: "Votre rappel", groupe: "Rendez-vous et éléments" },
    { code: "interne", lib: "Rendez-vous avec un collègue", groupe: "Rendez-vous et éléments" },
    { code: "rdv_col", lib: "Rendez-vous du client avec un collègue", groupe: "Rendez-vous et éléments" },
    { code: "contact", lib: "Note ou dossier", groupe: "Rendez-vous et éléments" },
    { code: "gestion", lib: "Gestion des débiteurs, atypiques et GDI", groupe: "Plages réservées de l'agence" },
    { code: "proactivite", lib: "Proactivité", groupe: "Plages réservées de l'agence" },
    { code: "reunion", lib: "Réunion d'équipe", groupe: "Plages réservées de l'agence" },
    { code: "accueil", lib: "Accueil", groupe: "Plages réservées de l'agence" }
  ];
  function codeCouleur(e) { return e.kind === "perso" ? e.type : e.kind === "plage" ? e.id : e.kind; }

  /* ---------- grille horaire d'une semaine (agenda commercial et agenda de l'accueil) ----------
     Une colonne par jour, une ligne par heure de 9 h à 18 h : une heure sans rien est affichée « Libre » (avec, si o.planifier, un bouton pour y placer un rendez-vous).
     Les heures où l'agence est fermée (pause de 13 h à 14 h, samedi après-midi, jour férié) sont hachurées. Sur ordinateur, les traits de la grille sont tracés (axe des heures,
     trait de l'heure actuelle) ; sur téléphone, chaque jour est une liste d'heures (voir agenda.css).
     o : entree(e, jourDate) → <li> d'un élément ; libJour(d), libJourLong(d) ; classeJour (classe ajoutée à chaque jour), classeAuj (jour courant) ;
         planifier (bouton « Planifier » sur les heures libres à venir) ; ajout (bouton « Ajouter un élément » en bas de chaque jour) ; textes (message jour férié, jour sans rien). */
  var H_PREMIERE = 9, H_DERNIERE = 17;
  function heureLigne(e) { var h = parseInt(e.heure, 10); return h < H_PREMIERE ? H_PREMIERE : h > H_DERNIERE ? H_DERNIERE : h; }
  function grilleHtml(sem, o) {
    var auj = B.aujourdhui(), esc = B.esc, iso = B.ymd;
    var sans = sem.jours.some(function (j) { return j.entrees.some(function (e) { return !e.heure; }); });
    var r9 = 2 + (sans ? 1 : 0), nl = r9 + (H_DERNIERE - H_PREMIERE + 1), rangH = function (hh) { return r9 + (hh - H_PREMIERE); };
    var maintenant = B.maintenant(), minNow = maintenant.getHours() * 60 + maintenant.getMinutes();
    var axe = '<li class="ag-axe" aria-hidden="true" style="--n: ' + nl + '"><span class="ag-axe-h ag-axe-tete" style="--r: 1">Heure</span>' +
      (sans ? '<span class="ag-axe-h ag-axe-sans" style="--r: 2">Sans heure</span>' : "");
    for (var hh = H_PREMIERE; hh <= H_DERNIERE; hh++) axe += '<span class="ag-axe-h" style="--r: ' + rangH(hh) + '">' + hh + " h</span>";
    axe += '<span class="ag-axe-h ag-axe-pied" style="--r: ' + nl + '"></span></li>';
    var t = o.textes || {};
    return '<ol class="ag-semaine">' + axe + sem.jours.map(function (j) {
      var d = j.date, ecart = B.ecartJours(d, auj), passeJour = ecart < 0, peutAjouter = !j.ferie && ecart >= 0;
      var cls = "ag-jour" + (o.classeJour ? " " + o.classeJour : "") + (j.auj ? " ag-auj" + (o.classeAuj ? " " + o.classeAuj : "") : "") + (j.ferie ? " ag-ferie" : "") + (passeJour ? " ag-jpasse" : "");
      var ouv = j.ferie ? [] : B.plagesAgence(d), cases = {};
      j.entrees.forEach(function (e) { var k = e.heure ? heureLigne(e) : 0; (cases[k] = cases[k] || []).push(e); });
      function ouvert(x) { return ouv.some(function (p) { return x * 60 >= minutes(p[0]) && x * 60 < minutes(p[1]); }); }
      var lignes = "";
      if (sans) lignes += cases[0] ? '<li class="ag-hr ag-hr-sans" style="--r: 2"><ul class="ag-hr-liste">' + cases[0].map(function (e) { return o.entree(e, d); }).join("") + "</ul></li>" : '<li class="ag-hr ag-hr-vide" style="--r: 2" aria-hidden="true"></li>';
      for (var x = H_PREMIERE; x <= H_DERNIERE; x++) {
        var r = rangH(x), lib = x + " h", maint = j.auj && ouvert(x) && minNow >= x * 60 && minNow < (x + 1) * 60;
        var now = maint ? "; --t: " + Math.round((minNow - x * 60) / 60 * 100) + "%" : "";
        if (cases[x]) {
          lignes += '<li class="ag-hr' + (ouvert(x) ? "" : " ag-hr-ferme") + (maint ? " ag-hr-now" : "") + '" style="--r: ' + r + now + '"><span class="ag-hr-h" aria-hidden="true">' + lib + '</span><ul class="ag-hr-liste">' + cases[x].map(function (e) { return o.entree(e, d); }).join("") + "</ul></li>";
        } else if (!ouvert(x)) {
          lignes += '<li class="ag-hr ag-hr-vide ag-hr-ferme" style="--r: ' + r + '" aria-hidden="true"></li>';
        } else {
          var finie = ecart < 0 || (ecart === 0 && minNow >= (x + 1) * 60);
          lignes += '<li class="ag-hr ag-hr-libre' + (maint ? " ag-hr-now" : "") + '" style="--r: ' + r + now + '"><span class="ag-hr-h" aria-hidden="true">' + lib + '</span><div class="ag-libre"><span>Libre</span>' +
            (finie ? '<span class="ag-libre-sous">Heure passée</span>' : o.planifier ? '<button type="button" class="btn-texte" data-act="ajout-heure" data-d="' + iso(d) + '" data-h="' + (x < 10 ? "0" : "") + x + ':00" aria-label="Planifier le ' + esc(o.libJourLong(d)) + " à " + lib + '">Planifier</button>' : "") + "</div></li>";
        }
      }
      var vide = j.ferie ? '<p class="ag-vide ag-vide-ferie" style="--r: ' + rangH(H_PREMIERE) + '">' + esc(t.ferie ? t.ferie(j.ferie) : "Jour férié : " + j.ferie + ". Agence fermée.") + "</p>" :
        t.vide && !j.entrees.some(function (e) { return e.kind !== "plage"; }) ? '<p class="ag-vide">' + esc(t.vide(passeJour)) + "</p>" : "";
      var contenuPied = (j.ferie ? "" : vide) + (o.ajout && peutAjouter ? '<p class="ag-ajout"><button type="button" class="btn-texte" data-act="ajout-jour" data-d="' + iso(d) + '" aria-label="Ajouter un élément le ' + esc(o.libJourLong(d)) + '">Ajouter un élément</button></p>' : "");
      var pied = contenuPied ? '<div class="ag-pied" style="--r: ' + nl + '">' + contenuPied + "</div>" : "";
      return '<li class="' + cls + '" style="--n: ' + nl + '"><h3>' + o.libJour(d) + (j.auj && o.chipAuj !== false ? ' <span class="chip chip-ctrl">Aujourd\'hui</span>' : "") + "</h3>" +
        '<ul class="ag-liste">' + lignes + "</ul>" + (j.ferie ? vide : "") + pied + "</li>";
    }).join("") + "</ol>";
  }

  var api = {
    CODES: CODES, codeCouleur: codeCouleur,
    HEURE_MIN: HEURE_MIN, HEURE_RDV_MAX: HEURE_RDV_MAX, HEURE_MAX: HEURE_MAX, DUREE_RDV: DUREE_RDV, NB_JOURS_AGENCE: NB_JOURS_AGENCE, HORIZON: HORIZON, MAX_OBJET: MAX_OBJET, MAX_NOTE: MAX_NOTE, MAX_ELEMENTS: MAX_ELEMENTS,
    TYPES: TYPES, STATUTS: STATUTS, HORAIRES_LIB: HORAIRES_LIB, ouverte: ouverte, plages: plages, plagesReservees: B.plagesReservees, heureOuverte: heureOuverte, minutes: minutes, nomFerie: nomFerie, lundiDe: lundiDe, debutSemaine: debutSemaine, NB_JOURS_SEMAINE: NB_JOURS_SEMAINE, semaineParDefaut: semaineParDefaut, passe: passe, agence: agence, viderCache: viderCache,
    elements: elements, trouver: trouver, conflit: conflit, conflitClient: conflitClient, client: function (id) { return CLIENT[id] || null; }, valider: valider, creer: creer, modifier: modifier, changerStatut: changerStatut, supprimer: supprimer,
    jour: jour, semaine: semaine, grilleHtml: grilleHtml, aFaire: aFaire, termines: termines, duClient: duClient
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.agenda = api; }
})(typeof window !== "undefined" ? window : null);
