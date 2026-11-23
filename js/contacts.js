/* GS Banque & Assurance – Compte Rendu d'Entretien (CRE) : le conseiller rédige le compte rendu d'un entretien avec un client à l'accueil de l'agence ou lors d'un rendez-vous
   (produit abordé, rebond commercial éventuel, résultat), comme il note ses appels dans « Phoning et prospection ». Ces contacts alimentent
   l'agenda (rendez-vous pris, rendez-vous tenu), les campagnes (refus, suivi), le catalogue (souscription à enregistrer) et le bilan (résultats par moyen).
   Conventions de l'exercice (aucune règle officielle) : l'agence est ouverte du mardi au vendredi de 9 h à 13 h et de 14 h à 18 h, le samedi de 9 h à 13 h, fermée le lundi, le dimanche et les jours fériés (comme l'agenda) ;
   un contact se note au plus 90 jours après coup et jamais avant d'avoir eu lieu ; 500 contacts au plus. Les contacts sont enregistrés dans le navigateur (store().contacts). */
(function (root) {
  "use strict";

  var B = root && root.SGBF ? root.SGBF.banque : require("./banque.js");
  var PR = root && root.SGBF ? root.SGBF.produits : require("./produits.js");
  var K = root && root.SGBF ? root.SGBF.catalogue : require("./catalogue.js");
  var AG = root && root.SGBF ? root.SGBF.agenda : require("./agenda.js");
  var CA = root && root.SGBF ? root.SGBF.campagnes : require("./campagnes.js");
  var CL = root && root.SGBF ? root.SGBF.clients : require("./data_clients.js").clients;
  var CLIENT = {}; CL.forEach(function (c) { CLIENT[c.id] = c; });

  var MAX_CONTACTS = 500, MAX_NOTE = 300, MIN_NOTE = 10, PASSE_MAX = 90;
  var LIEUX = {
    accueil: { lib: "À l'accueil de l'agence", court: "Accueil", aide: "Le client s'est présenté à l'agence sans rendez-vous, ou vous l'avez abordé à l'accueil." },
    rdv: { lib: "Lors d'un rendez-vous", court: "Rendez-vous", aide: "Le client a été reçu en entretien, sur rendez-vous." }
  };
  var ORDRE_LIEUX = ["accueil", "rdv"];
  var RESULTATS = {
    souscrit: { lib: "Le client souscrit", aide: "Le client choisit le produit : enregistrez ensuite la souscription dans le catalogue, avec les points à confirmer (le contrat compte alors dans les résultats)." },
    rdv: { lib: "Rendez-vous pris", aide: "Le client accepte un rendez-vous pour poursuivre : il est ajouté à votre agenda.", suite: true },
    reflexion: { lib: "Le client veut réfléchir", aide: "Pas de décision pour le moment : notez ce que vous avez convenu (documentation remise, nouvelle prise de contact…)." },
    refus: { lib: "Refus", aide: "Le client ne veut pas du produit : indiquez le motif.", motif: true }
  };
  var ORDRE_RESULTATS = ["souscrit", "rdv", "reflexion", "refus"];
  var CANAUX_RDV = ["En agence", "Par téléphone"];

  function err(champ, msg) { return { ok: false, champ: champ, erreur: msg }; }
  function propre(s) { return String(s == null ? "" : s).replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, ""); }
  function espaces(s) { return propre(s).replace(/\s+/g, " ").trim(); }
  function pl(n, s, p) { return n + " " + (n > 1 ? p : s); }
  function contacts(st) { return (st && Array.isArray(st.contacts)) ? st.contacts : []; }
  function trouver(st, id) { return contacts(st).filter(function (x) { return x.id === id; })[0] || null; }
  function uid() { return "f" + B.maintenant().getTime().toString(36) + Math.random().toString(36).slice(2, 6); }
  function nomProduit(pid) { return PR.parId[pid] ? PR.parId[pid].nom : pid; }
  function heureLib(h) { var m = /^(\d{2}):(\d{2})$/.exec(h || ""); return m ? (+m[1]) + " h" + (m[2] === "00" ? "" : " " + m[2]) : ""; }
  function quand(x) { return B.fmtDate(B.lireYmd(x.date)) + " à " + heureLib(x.heure); }
  function verdict(st, c, pid) { return K.verdictClient(c, pid, st).verdict; }
  function produitsPossibles() { return PR.produits.filter(K.prospectionPossible); }
  /* Campagnes qui concernent le client et dont la période comprend la date. */
  function campagnesDuClient(st, cid, ymd) {
    return CA.campagnes(st).filter(function (k) { return k.ids.indexOf(cid) >= 0 && (!ymd || (ymd >= k.debut && ymd <= k.fin)); });
  }
  /* Rendez-vous de l'agenda de l'élève que ce contact peut clôturer : encore « à faire » et déjà arrivés (date passée ou jour même). */
  function rendezVousATenir(st, cid, ymd) {
    var d = B.lireYmd(ymd); if (!d) return [];
    return AG.elements(st).filter(function (x) { return x.type === "rdv" && x.statut === "afaire" && x.client === cid && B.ecartJours(B.lireYmd(x.date), d) <= 0; });
  }

  /* ---------- contrôle ----------
     o = { client, lieu, date, heure, camp, prod, rebond, rdvLie, res, motif, suiteDate, suiteHeure, suiteCanal, note }
     Renvoie { ok: true, produit } ou { ok: false, champ, erreur } (première erreur). */
  function controle(st, o) {
    var c = CLIENT[parseInt(o.client, 10)] || null;
    if (!c) return err("client", "Choisissez le client reçu.");
    if (!LIEUX[o.lieu]) return err("lieu", "Indiquez où a eu lieu l'entretien : à l'accueil ou lors d'un rendez-vous.");
    var auj = B.aujourdhui(), d = B.lireYmd(o.date), h = espaces(o.heure), m = AG.minutes(h);
    if (!d) return err("date", "Saisissez la date de l'entretien.");
    if (B.ecartJours(d, auj) > 0) return err("date", "L'entretien ne peut pas être daté du futur : rédigez le CRE une fois qu'il a eu lieu.");
    if (B.ecartJours(auj, d) > PASSE_MAX) return err("date", "L'entretien date de plus de " + PASSE_MAX + " jours : choisissez une date plus récente.");
    if (!AG.ouverte(d)) {
      var f = B.estFerie(d) ? AG.nomFerie(d) : null;
      return err("date", B.fmtLong(d) + (f ? " est un jour férié (" + f + ")" : " tombe un " + B.JOURS[d.getDay()]) + " : l'agence est fermée, aucun entretien n'a pu avoir lieu ce jour-là.");
    }
    if (!h) return err("heure", "Indiquez l'heure de l'entretien, par exemple 14:30.");
    if (isNaN(m)) return err("heure", "Saisissez une heure valide, par exemple 14:30.");
    if (!AG.heureOuverte(d, h, 0)) return err("heure", "L'agence est ouverte " + AG.HORAIRES_LIB + " (règle de l'agence) : choisissez une heure dans ces horaires.");
    if (B.ecartJours(d, auj) === 0 && m > B.maintenant().getHours() * 60 + B.maintenant().getMinutes()) return err("heure", "Cette heure n'est pas encore arrivée (il est " + B.hhmm(B.maintenant()) + ").");
    var ymd = B.ymd(d), pid = o.prod || "", kamp = o.camp ? CA.trouver(st, o.camp) : null;
    if (o.camp && !kamp) return err("camp", "Cette campagne n'existe plus.");
    if (kamp) {
      if (kamp.ids.indexOf(c.id) < 0) return err("camp", "Ce client ne fait pas partie de la cible de cette campagne.");
      if (ymd < kamp.debut || ymd > kamp.fin) return err("camp", "La date de l'entretien est en dehors de la période de la campagne (du " + B.fmtDate(B.lireYmd(kamp.debut)) + " au " + B.fmtDate(B.lireYmd(kamp.fin)) + ").");
      pid = kamp.produit;
    }
    function verifierProduit(id, champ, article) {
      var p = PR.parId[id];
      if (!p || !K.prospectionPossible(p)) return err(champ, p && p.famille === "credit" ? "Un crédit ne se propose pas ici : il se monte dans « Montage de prêt »." : p ? "Ce produit ne peut pas être proposé : " + K.raisonHorsProspection(p) : "Choisissez un produit de la liste.");
      var v = verdict(st, c, id);
      if (v === "detenu") return err(champ, "Ce client détient déjà " + article + " : il est inutile de le lui proposer.");
      if (v === "non") return err(champ, "Ce client n'est pas éligible à " + article + " : choisissez-en un autre.");
      return null;
    }
    if (!pid) return err("prod", "Choisissez le produit abordé avec le client.");
    var e1 = verifierProduit(pid, "prod", "ce produit"); if (e1) return e1;
    if (o.rebond) {
      if (o.rebond === pid) return err("rebond", "Le rebond doit porter sur un autre produit que celui de l'entretien.");
      var e2 = verifierProduit(o.rebond, "rebond", "ce produit"); if (e2) return e2;
    }
    if (o.rdvLie) {
      if (o.lieu !== "rdv") return err("rdvLie", "Un rendez-vous de l'agenda ne se rattache qu'à un entretien tenu lors d'un rendez-vous.");
      var x = AG.trouver(st, o.rdvLie);
      if (!x || x.type !== "rdv" || x.client !== c.id || x.statut !== "afaire") return err("rdvLie", "Ce rendez-vous n'est plus à faire dans votre agenda : choisissez-en un autre ou aucun.");
      if (B.ecartJours(B.lireYmd(x.date), d) > 0) return err("rdvLie", "Ce rendez-vous est prévu après la date de l'entretien.");
    }
    var r = RESULTATS[o.res], note = espaces(o.note);
    if (!r) return err("res", "Choisissez le résultat de l'entretien.");
    if (r.motif && CA.MOTIFS_REFUS.indexOf(o.motif) < 0) return err("motif", "Choisissez le motif du refus.");
    if (note.length < MIN_NOTE) return err("note", "Résumez l'échange en quelques mots (" + MIN_NOTE + " caractères au moins) : ce que le client a dit, ce qui a été convenu.");
    if (note.length > MAX_NOTE) return err("note", "Le compte rendu est limité à " + MAX_NOTE + " caractères.");
    if (r.suite) {
      if (!o.suiteDate) return err("suiteDate", "Indiquez la date du rendez-vous pris.");
      var v2 = AG.valider(st, suiteAgenda(o, pid), null);
      if (!v2.ok) return err(v2.champ === "date" ? "suiteDate" : v2.champ === "heure" ? "suiteHeure" : v2.champ === "canal" ? "suiteCanal" : v2.champ, "Rendez-vous : " + v2.erreur);
    }
    return { ok: true, produit: pid };
  }
  function suiteAgenda(o, pid) {
    return { type: "rdv", client: parseInt(o.client, 10), date: o.suiteDate, heure: espaces(o.suiteHeure), canal: o.suiteCanal || CANAUX_RDV[0], camp: o.camp || "",
      objet: "Rendez-vous : " + nomProduit(pid), note: "Pris " + (o.lieu === "accueil" ? "à l'accueil" : "lors d'un rendez-vous") + " le " + B.fmtDate(B.lireYmd(o.date)) + "." };
  }

  /* ---------- enregistrement ---------- */
  function enregistrer(st, o) {
    var ct = controle(st, o);
    if (!ct.ok) return ct;
    if (contacts(st).length >= MAX_CONTACTS) return err("", "Le journal contient déjà " + MAX_CONTACTS + " comptes rendus : supprimez-en avant d'en ajouter.");
    var cid = parseInt(o.client, 10), d = B.lireYmd(o.date), r = RESULTATS[o.res];
    var x = { id: uid(), c: cid, lieu: o.lieu, date: B.ymd(d), heure: espaces(o.heure), prod: ct.produit, camp: o.camp || "", rebond: o.rebond || "", res: o.res, motif: r.motif ? o.motif : "",
      note: espaces(o.note), suite: null, rdvLie: "", refusCamp: false, cree: B.ymd(B.aujourdhui()) + " " + B.hhmm(B.maintenant()), par: (st.eleve && st.eleve.nom) || "" };
    if (r.suite) {
      var ag = AG.creer(st, suiteAgenda(o, ct.produit));
      if (!ag.ok) return err(ag.champ === "date" ? "suiteDate" : ag.champ === "heure" ? "suiteHeure" : ag.champ, ag.erreur);
      x.suite = { id: ag.element.id, date: ag.element.date, heure: ag.element.heure, canal: ag.element.canal };
    }
    if (o.res === "refus" && x.camp) { var rr = CA.refuser(st, x.camp, cid, o.motif); x.refusCamp = !!rr.ok; }
    if (o.rdvLie) { var s = AG.changerStatut(st, o.rdvLie, "fait"); if (s && s.ok) x.rdvLie = o.rdvLie; }
    if (!Array.isArray(st.contacts)) st.contacts = [];
    st.contacts.push(x);
    return { ok: true, contact: x };
  }
  /* Supprime un contact et ce qu'il avait créé : rendez-vous encore à faire, refus noté dans la campagne, rendez-vous de l'agenda redevenu « à faire ». */
  function supprimer(st, id) {
    var x = trouver(st, id);
    if (!x) return { ok: false };
    var retire = [], garde = [];
    if (x.suite && x.suite.id) { var a = AG.trouver(st, x.suite.id); if (a && a.statut === "afaire" && AG.supprimer(st, x.suite.id)) retire.push("le rendez-vous pris"); }
    if (x.refusCamp && x.camp && CA.annulerRefus(st, x.camp, x.c)) retire.push("le refus noté dans la campagne");
    if (x.rdvLie) { var y = AG.trouver(st, x.rdvLie); if (y && y.statut === "fait") { var s = AG.changerStatut(st, x.rdvLie, "afaire"); if (s && s.ok) retire.push("la clôture du rendez-vous (il redevient à faire)"); else garde.push("le rendez-vous de votre agenda reste marqué « Fait » : son créneau est occupé, il ne peut pas redevenir « à faire »"); } }
    st.contacts = contacts(st).filter(function (p) { return p.id !== id; });
    return { ok: true, retire: retire, garde: garde };
  }

  /* ---------- lecture ---------- */
  function trier(l) { return l.slice().sort(function (x, y) { return x.date + x.heure < y.date + y.heure ? 1 : x.date + x.heure > y.date + y.heure ? -1 : x.id < y.id ? 1 : -1; }); }
  function journal(st) { return trier(contacts(st)); }
  function duClient(st, cid) { return trier(contacts(st).filter(function (x) { return x.c === cid; })); }
  /* Souscription enregistrée dans le catalogue à la suite d'un contact « le client souscrit » : même client, même produit, datée du jour du contact ou après. */
  function souscriptionLiee(st, x) {
    if (x.res !== "souscrit") return null;
    var s = K.souscrit(st, x.c, x.prod);
    return s && s.date >= x.date ? s : null;
  }
  function totaux(l) {
    var t = { contacts: l.length, clients: 0, parLieu: {}, parResultat: {}, rebonds: 0 }, cl = {};
    ORDRE_LIEUX.forEach(function (k) { t.parLieu[k] = 0; });
    ORDRE_RESULTATS.forEach(function (k) { t.parResultat[k] = 0; });
    l.forEach(function (x) { t.parLieu[x.lieu] = (t.parLieu[x.lieu] || 0) + 1; t.parResultat[x.res] = (t.parResultat[x.res] || 0) + 1; cl[x.c] = true; if (x.rebond) t.rebonds++; });
    t.clients = Object.keys(cl).length;
    return t;
  }

  var api = {
    MAX_CONTACTS: MAX_CONTACTS, MAX_NOTE: MAX_NOTE, MIN_NOTE: MIN_NOTE, PASSE_MAX: PASSE_MAX, LIEUX: LIEUX, ORDRE_LIEUX: ORDRE_LIEUX, RESULTATS: RESULTATS, ORDRE_RESULTATS: ORDRE_RESULTATS, CANAUX_RDV: CANAUX_RDV,
    contacts: contacts, trouver: trouver, produitsPossibles: produitsPossibles, verdictProduit: verdict, campagnesDuClient: campagnesDuClient, rendezVousATenir: rendezVousATenir,
    controle: controle, enregistrer: enregistrer, supprimer: supprimer, journal: journal, duClient: duClient, souscriptionLiee: souscriptionLiee, totaux: totaux, quand: quand, heureLib: heureLib, pluriel: pl
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.contacts = api; }
})(typeof window !== "undefined" ? window : null);
