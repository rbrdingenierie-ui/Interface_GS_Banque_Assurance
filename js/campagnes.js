/* GS Banque & Assurance – campagnes commerciales : une campagne vise la souscription d'UN produit (hors crédits et hors offre clientèle fragile) par les clients d'une cible, pendant une période de jours ouvrés.
   Les indicateurs ne sont jamais saisis : ils sont recalculés à chaque ouverture à partir de ce que l'élève a réellement fait dans les autres outils
   (messages envoyés, appels enregistrés dans « Phoning et prospection », rendez-vous planifiés, souscriptions du catalogue) et des refus qu'il note ici ou lors d'un appel. Conventions de l'exercice : 20 campagnes au plus, 90 jours au plus,
   un contrat compte s'il est daté entre le début et la fin de la campagne. Les campagnes sont enregistrées dans le navigateur (store().campagnes). */
(function (root) {
  "use strict";

  var B = root && root.SGBF ? root.SGBF.banque : require("./banque.js");
  var PR = root && root.SGBF ? root.SGBF.produits : require("./produits.js");
  var K = root && root.SGBF ? root.SGBF.catalogue : require("./catalogue.js");
  var P = root && root.SGBF ? root.SGBF.portefeuille : require("./portefeuille.js");
  var AG = root && root.SGBF ? root.SGBF.agenda : require("./agenda.js");
  var CL = root && root.SGBF ? root.SGBF.clients : require("./data_clients.js").clients;
  var CLIENT = {}; CL.forEach(function (c) { CLIENT[c.id] = c; });

  var MAX_CAMPAGNES = 20, MAX_NOM = 60, MAX_ARG = 200, MAX_ARGS = 5, DUREE_MAX = 90, HORIZON = 365;
  var MOTIFS_REFUS = ["Pas intéressé", "Déjà équipé ailleurs", "Pas le moment", "Autre raison"];
  var ETATS = { souscrit: "Contrat souscrit", detient: "Détient déjà le produit", refus: "Refus", rdv: "Rendez-vous pris", face: "Reçu en entretien", appel: "Appelé et joint", message: "Message envoyé", tentative: "Appel sans réponse", a_contacter: "À contacter" };
  var STATUTS = { avenir: "À venir", cours: "En cours", terminee: "Terminée" };

  function err(champ, msg) { return { ok: false, champ: champ, erreur: msg }; }
  function espaces(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); }
  function pl(n, s, p) { return n + " " + (n > 1 ? p : s); }
  function campagnes(st) { return (st && Array.isArray(st.campagnes)) ? st.campagnes : []; }
  function trouver(st, id) { return campagnes(st).filter(function (k) { return k.id === id; })[0] || null; }
  function uid() { return "k" + B.maintenant().getTime().toString(36) + Math.random().toString(36).slice(2, 6); }
  function libJour(d) { return B.fmtLong(d); }

  /* ---------- produit et cible ---------- */
  /* Produits qu'une campagne peut viser : tous sauf les crédits (un crédit se monte dans « Montage de prêt » : aucun contrat ne serait mesurable)
     et l'offre clientèle fragile (la banque ne la vend pas : elle la propose aux clients qu'elle repère comme fragiles). */
  function produitsPossibles() { return PR.produits.filter(K.prospectionPossible); }
  /* Arguments proposés à partir de la fiche du produit (ceux qui s'adressent au client, pas au conseiller). */
  function argumentsSuggeres(pid) {
    var p = PR.parId[pid]; if (!p) return [];
    return (p.avantages || []).filter(function (a) { return !/\bclient/i.test(a); }).slice(0, 3);
  }
  /* Clients retenus pour la campagne : ceux de la source qui sont éligibles ou « à examiner » pour le produit. Les autres (non éligibles, ou qui le détiennent déjà) sont écartés. */
  function cibleChoisie(st, pid, source) {
    var p = PR.parId[pid];
    if (!p) return err("produit", "Choisissez un produit.");
    if (!K.prospectionPossible(p)) return err("produit", p.famille === "credit" ? "Choisissez un autre produit : les crédits ne peuvent pas faire l'objet d'une campagne (ils se montent dans « Montage de prêt »)." : "Choisissez un autre produit : " + K.raisonHorsProspection(p));
    var ids, nom;
    if (source && source.type === "cible") {
      var c = P.trouverCible(st, source.id);
      if (!c) return err("source", "Choisissez une de vos cibles : celle-ci n'existe plus.");
      ids = c.ids.slice(); nom = c.nom;
    } else if (source && source.type === "eligibles") { ids = CL.map(function (x) { return x.id; }); nom = "Clients éligibles au produit"; }
    else return err("source", "Choisissez la cible de la campagne.");
    var compte = { eligible: 0, examiner: 0, non: 0, detenu: 0 }, retenus = [];
    ids.forEach(function (i) {
      var v = K.verdictClient(CLIENT[i], pid, st).verdict;
      compte[v]++;
      if (v === "eligible" || v === "examiner") retenus.push(i);
    });
    retenus.sort(function (a, b) { return a - b; });
    if (!retenus.length) return err("source", "Aucun client de cette cible ne peut se voir proposer ce produit (non éligibles ou détenteurs). Changez de produit ou de cible.");
    return { ok: true, retenus: retenus, compte: compte, total: ids.length, nomSource: nom };
  }

  /* ---------- calendrier ---------- */
  function ouvres(d0, d1) { var n = 0; for (var d = d0; B.ecartJours(d, d1) <= 0; d = B.plusJours(d, 1)) if (B.estOuvre(d)) n++; return n; }
  /* Jours ouvrés de la période : total, écoulés (strictement avant aujourd'hui) et restants (aujourd'hui compris, s'il est ouvré). */
  function jours(k) {
    var d0 = B.lireYmd(k.debut), d1 = B.lireYmd(k.fin), auj = B.aujourdhui();
    var total = ouvres(d0, d1), ecoules = 0;
    if (B.ecartJours(auj, d0) > 0) ecoules = ouvres(d0, B.ecartJours(auj, d1) > 0 ? d1 : B.plusJours(auj, -1));
    return { total: total, ecoules: ecoules, restants: total - ecoules };
  }
  function statut(k) {
    var a = B.ymd(B.aujourdhui());
    return a < k.debut ? "avenir" : a > k.fin ? "terminee" : "cours";
  }
  function nieme(d0, n) { var d = d0; for (var i = 0; i < n; i++) d = B.ouvreSuivant(B.plusJours(d, 1)); return d; }
  var JALONS = {
    lancement: "lancer la campagne", relance: "relancer les clients sans réponse", bilan: "faire le bilan"
  };
  var JALONS_LONGS = {
    lancement: "Lancer la campagne : envoyer le message de présentation aux clients de la cible",
    relance: "Relancer les clients qui n'ont pas répondu", bilan: "Faire le point sur la campagne et noter les résultats"
  };
  /* Jalons conseillés : le début, le milieu de la période (s'il est distinct du début et de la fin) et la fin. Un jalon est un rappel de l'agenda : il se place un jour d'ouverture de l'agence
     (une campagne qui commence ou finit un lundi, jour de fermeture, a son jalon le mardi). */
  function jalons(k) {
    var d0 = B.lireYmd(k.debut), t = jours(k).total, l = [{ k: "lancement", date: d0 }];
    var mid = Math.floor((t - 1) / 2);
    if (mid > 0 && mid < t - 1) l.push({ k: "relance", date: nieme(d0, mid) });
    if (t > 1) l.push({ k: "bilan", date: B.lireYmd(k.fin) });
    return l.map(function (j) { return { k: j.k, date: B.agenceSuivant(j.date), lib: JALONS_LONGS[j.k], objet: "Campagne « " + k.nom + " » : " + JALONS[j.k] }; });
  }
  function jalonDansAgenda(st, k, j) {
    return AG.elements(st).some(function (x) { return x.camp === k.id && x.objet === j.objet && x.date === B.ymd(j.date) && x.statut !== "annule"; });
  }
  /* Ajoute un jalon à l'agenda de l'élève sous forme de rappel rattaché à la campagne. */
  function ajouterJalon(st, id, cle) {
    var k = trouver(st, id);
    if (!k) return err("", "Cette campagne n'existe plus.");
    var j = jalons(k).filter(function (x) { return x.k === cle; })[0];
    if (!j) return err("", "Jalon inconnu.");
    if (jalonDansAgenda(st, k, j)) return err("", "Ce jalon figure déjà dans votre agenda.");
    var r = AG.creer(st, { type: "rappel", objet: j.objet, date: B.ymd(j.date), heure: "", client: null, note: "", camp: id });
    return r.ok ? { ok: true, element: r.element, jalon: j } : r;
  }

  /* ---------- création et modification ---------- */
  function verifierArguments(a) {
    var l = (a || []).map(espaces).filter(Boolean);
    if (!l.length) return err("args", "Notez au moins un argument pour convaincre le client.");
    if (l.length > MAX_ARGS) return err("args", "Au plus " + MAX_ARGS + " arguments.");
    if (l.some(function (t) { return t.length > MAX_ARG; })) return err("args", "Chaque argument est limité à " + MAX_ARG + " caractères.");
    return { ok: true, args: l };
  }
  function verifierNom(st, nom, sauf) {
    var n = espaces(nom);
    if (n.length < 3) return err("nom", "Donnez un nom à la campagne (3 caractères au moins), par exemple « Le LEP pour les retraités ».");
    if (n.length > MAX_NOM) return err("nom", "Le nom est limité à " + MAX_NOM + " caractères.");
    if (campagnes(st).some(function (k) { return k.id !== sauf && P.norm(k.nom) === P.norm(n); })) return err("nom", "Une campagne porte déjà ce nom : choisissez-en un autre.");
    return { ok: true, nom: n };
  }
  function verifierObjectif(v, max) {
    var t = String(v == null ? "" : v).trim();
    if (!/^\d{1,3}$/.test(t) || +t < 1) return err("objectif", "Indiquez le nombre de contrats visés : un nombre entier d'au moins 1.");
    if (+t > max) return err("objectif", "L'objectif ne peut pas dépasser le nombre de clients retenus (" + max + ") : chaque client souscrit ce produit une seule fois.");
    return { ok: true, objectif: +t };
  }
  /* Moyens prévus pour la campagne : au moins un parmi mailing, appel, entretien en rendez-vous, entretien à l'accueil. */
  function verifierMoyens(m) {
    var l = Array.isArray(m) ? m : [], vus = {};
    l.forEach(function (k) { if (K.MOYENS[k]) vus[k] = true; });
    var r = K.ORDRE_MOYENS.filter(function (k) { return vus[k]; });
    if (!r.length) return err("moyens", "Choisissez au moins un moyen pour mener la campagne : mailing, appel ou entretien.");
    return { ok: true, moyens: r };
  }
  function moyensTexte(k) { return (k.moyens || []).map(function (m) { return K.MOYENS[m]; }).filter(Boolean).join(", "); }
  function verifierFin(d0, d1txt) {
    var d1 = B.lireYmd(d1txt);
    if (!d1) return err("fin", "Saisissez une date de fin valide.");
    if (!B.estOuvre(d1)) return err("fin", libJour(d1) + " n'est pas un jour ouvré. Prochain jour ouvré : " + libJour(B.ouvreSuivant(d1)) + ".");
    if (B.ecartJours(d1, d0) < 0) return err("fin", "La fin ne peut pas précéder le début.");
    if (B.ecartJours(d1, d0) > DUREE_MAX) return err("fin", "Une campagne dure " + DUREE_MAX + " jours au plus (règle de l'agence) : choisissez une date de fin au plus tard le " + B.fmtDate(B.plusJours(d0, DUREE_MAX)) + ".");
    return { ok: true, fin: B.ymd(d1) };
  }
  /* o = { nom, produit, source: { type: "cible", id } | { type: "eligibles" }, objectif, debut, fin, args }. */
  function creer(st, o) {
    var n = verifierNom(st, o.nom, null); if (!n.ok) return n;
    var c = cibleChoisie(st, o.produit, o.source); if (!c.ok) return c;
    var ob = verifierObjectif(o.objectif, c.retenus.length); if (!ob.ok) return ob;
    var d0 = B.lireYmd(o.debut), auj = B.aujourdhui();
    if (!d0) return err("debut", "Saisissez une date de début valide.");
    if (B.ecartJours(d0, auj) < 0) return err("debut", "Le début ne peut pas être dans le passé : choisissez aujourd'hui ou plus tard.");
    if (B.ecartJours(d0, auj) > HORIZON) return err("debut", "On ne programme pas à plus d'un an : choisissez une date au plus tard le " + B.fmtDate(B.plusJours(auj, HORIZON)) + ".");
    if (!B.estOuvre(d0)) return err("debut", libJour(d0) + " n'est pas un jour ouvré. Prochain jour ouvré : " + libJour(B.ouvreSuivant(d0)) + ".");
    var f = verifierFin(d0, o.fin); if (!f.ok) return f;
    var a = verifierArguments(o.args); if (!a.ok) return a;
    var mo = verifierMoyens(o.moyens); if (!mo.ok) return mo;
    if (campagnes(st).length >= MAX_CAMPAGNES) return err("", "Vous avez déjà " + MAX_CAMPAGNES + " campagnes : supprimez-en une avant d'en créer une autre.");
    var k = { id: uid(), nom: n.nom, produit: o.produit, source: c.nomSource, sourceType: o.source.type, ids: c.retenus, ecartes: c.total - c.retenus.length, compte: c.compte, total: c.total,
      objectif: ob.objectif, debut: B.ymd(d0), fin: f.fin, args: a.args, moyens: mo.moyens, creee: B.ymd(auj), refus: {} };
    if (!Array.isArray(st.campagnes)) st.campagnes = [];
    st.campagnes.push(k);
    return { ok: true, campagne: k };
  }
  /* On peut modifier le nom, l'objectif, la fin, l'argumentaire et les moyens ; le produit, la cible et le début restent ceux du lancement. */
  function modifier(st, id, o) {
    var k = trouver(st, id);
    if (!k) return err("", "Cette campagne n'existe plus.");
    var n = verifierNom(st, o.nom, id); if (!n.ok) return n;
    var ob = verifierObjectif(o.objectif, k.ids.length); if (!ob.ok) return ob;
    var f = verifierFin(B.lireYmd(k.debut), o.fin); if (!f.ok) return f;
    var a = verifierArguments(o.args); if (!a.ok) return a;
    var mo = verifierMoyens(o.moyens === undefined ? k.moyens : o.moyens); if (!mo.ok) return mo;
    k.nom = n.nom; k.objectif = ob.objectif; k.fin = f.fin; k.args = a.args; k.moyens = mo.moyens;
    return { ok: true, campagne: k };
  }
  function supprimer(st, id) { var n = campagnes(st).length; st.campagnes = campagnes(st).filter(function (k) { return k.id !== id; }); return st.campagnes.length < n; }

  /* ---------- suivi : état de chaque client et indicateurs ---------- */
  function drapeaux(st, k) {
    var f = {}, dans = {};
    k.ids.forEach(function (i) { dans[i] = true; f[i] = { sub: null, detient: false, refus: (k.refus && k.refus[i]) || null, rdv: 0, msg: 0, appels: 0, joints: 0, face: 0 }; });
    K.souscriptions(st).forEach(function (s) {
      if (s.p !== k.produit || !dans[s.c]) return;
      if (s.date >= k.debut && s.date <= k.fin) f[s.c].sub = s; else f[s.c].detient = true;
    });
    AG.elements(st).forEach(function (x) { if (x.camp === k.id && (x.type === "rdv" || x.type === "rdv_col") && x.statut !== "annule" && x.client && dans[x.client]) f[x.client].rdv++; });
    (Array.isArray(st.messages) ? st.messages : []).forEach(function (m) { if (m.camp === k.id && dans[m.c]) f[m.c].msg++; });
    /* appels enregistrés dans « Phoning et prospection » depuis la campagne : « nr » = pas de réponse (le client n'a pas été joint) */
    (Array.isArray(st.appels) ? st.appels : []).forEach(function (a) { if (a.camp === k.id && dans[a.c]) { f[a.c].appels++; if (a.res !== "nr") f[a.c].joints++; } });
    /* entretiens (accueil ou rendez-vous) notés dans « Compte Rendu d'Entretien (CRE) » depuis la campagne */
    (Array.isArray(st.contacts) ? st.contacts : []).forEach(function (x) { if (x.camp === k.id && dans[x.c]) f[x.c].face++; });
    return f;
  }
  function etatDe(d) { return d.sub ? "souscrit" : d.detient ? "detient" : d.refus ? "refus" : d.rdv ? "rdv" : d.face ? "face" : d.joints ? "appel" : d.msg ? "message" : d.appels ? "tentative" : "a_contacter"; }
  /* Une ligne par client de la campagne, avec son état. */
  function suivi(st, k) {
    var f = drapeaux(st, k);
    return k.ids.map(function (i) { var d = f[i]; return { client: CLIENT[i], id: i, etat: etatDe(d), sub: d.sub, refus: d.refus, rdv: d.rdv, msg: d.msg, appels: d.appels, joints: d.joints, face: d.face }; });
  }
  function pct(a, b) { return b > 0 ? Math.round(100 * a / b) : null; }
  function indicateurs(st, k) {
    var l = suivi(st, k), n = l.length, r = { cibles: n, objectif: k.objectif, contrats: 0, contactes: 0, rdv: 0, refus: 0, detient: 0, aContacter: 0, tentatives: 0, messages: 0, appels: 0, joints: 0, face: 0 };
    l.forEach(function (x) {
      if (x.sub) r.contrats++;
      if (x.sub || x.refus || x.rdv || x.msg || x.joints || x.face) r.contactes++;
      if (x.face) r.face++;
      if (x.rdv) r.rdv++;
      if (x.refus && !x.sub) r.refus++;
      if (x.etat === "detient") r.detient++;
      if (x.etat === "a_contacter" || x.etat === "tentative") r.aContacter++;
      if (x.etat === "tentative") r.tentatives++;
      r.messages += x.msg; r.appels += x.appels; if (x.joints) r.joints++;
    });
    r.tauxContact = pct(r.contactes, n); r.tauxTransformation = pct(r.contrats, r.contactes); r.atteinte = pct(r.contrats, k.objectif);
    r.jours = jours(k); r.statut = statut(k);
    r.tempsEcoule = r.jours.total ? Math.round(100 * r.jours.ecoules / r.jours.total) : null;
    r.rythme = r.statut === "cours" && r.tempsEcoule !== null ? (r.atteinte >= r.tempsEcoule ? "ok" : "retard") : null;
    r.resteAFaire = Math.max(0, k.objectif - r.contrats);
    return r;
  }
  /* Noter qu'un client refuse : impossible s'il a déjà souscrit dans la campagne. */
  function refuser(st, id, cid, motif) {
    var k = trouver(st, id);
    if (!k) return err("", "Cette campagne n'existe plus.");
    if (k.ids.indexOf(cid) < 0) return err("", "Ce client ne fait pas partie de la cible de la campagne.");
    if (MOTIFS_REFUS.indexOf(motif) < 0) return err("motif", "Choisissez un motif dans la liste.");
    var d = drapeaux(st, k)[cid];
    if (d.sub) return err("", "Ce client a déjà souscrit dans le cadre de la campagne.");
    if (!k.refus) k.refus = {};
    k.refus[cid] = { date: B.ymd(B.aujourdhui()), motif: motif };
    return { ok: true };
  }
  function annulerRefus(st, id, cid) {
    var k = trouver(st, id);
    if (!k || !k.refus || !k.refus[cid]) return false;
    delete k.refus[cid];
    return true;
  }
  /* Campagnes qui concernent un client (pour sa fiche). */
  function duClient(st, cid) {
    return campagnes(st).filter(function (k) { return k.ids.indexOf(cid) >= 0; }).map(function (k) {
      var d = drapeaux(st, k)[cid];
      return { campagne: k, etat: etatDe(d), statut: statut(k) };
    });
  }

  var api = {
    MAX_CAMPAGNES: MAX_CAMPAGNES, MAX_NOM: MAX_NOM, MAX_ARG: MAX_ARG, MAX_ARGS: MAX_ARGS, DUREE_MAX: DUREE_MAX, HORIZON: HORIZON, MOTIFS_REFUS: MOTIFS_REFUS, ETATS: ETATS, STATUTS: STATUTS, JALONS: JALONS,
    verifierMoyens: verifierMoyens, moyensTexte: moyensTexte,
    campagnes: campagnes, trouver: trouver, produitsPossibles: produitsPossibles, argumentsSuggeres: argumentsSuggeres, cibleChoisie: cibleChoisie,
    ouvres: ouvres, jours: jours, statut: statut, jalons: jalons, jalonDansAgenda: jalonDansAgenda, ajouterJalon: ajouterJalon,
    creer: creer, modifier: modifier, supprimer: supprimer, suivi: suivi, indicateurs: indicateurs, refuser: refuser, annulerRefus: annulerRefus, duClient: duClient, pluriel: pl
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.campagnes = api; }
})(typeof window !== "undefined" ? window : null);
