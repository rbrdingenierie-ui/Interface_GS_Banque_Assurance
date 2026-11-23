/* GS Banque & Assurance – interface du parcours « mouvements atypiques » (JavaScript sans dépendance). */
(function () {
  "use strict";

  var R = window.SGBF.atyp;
  var SG = window.SGBF.signalement, SU = window.SGBF.signalementUI;   /* fiche de signalement à la cellule TRACFIN */
  var DOS = window.SGBF.atypiques;
  var REL = window.SGBF.relevesAtyp || {};
  var KEY = "sgbf-atypiques-v1";
  /* Dossiers du jour : la liste change chaque jour (voir quotidien_charge.js) ; la progression est remise à zéro quand le jour change. */
  var JT = window.SGBF.jourTravail || null;
  var JOUR = JT && JT.ymd ? JT.ymd : "reference";
  function maintenant() { return JT && JT.maintenant ? JT.maintenant() : new Date(); }
  function libelleJour() {
    if (JOUR === "reference") return "Dossiers de référence (les mêmes tous les jours)";
    var t = maintenant().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    return "Dossiers du " + t;
  }
  var MAX_COM = 1200;

  var app = document.getElementById("app");
  var progression = document.getElementById("progression");
  var boiteAide = document.getElementById("aide");
  var btnRecommencer = document.getElementById("btn-recommencer");

  /* ---------- état et sauvegarde ---------- */
  function neuf() {
    return { v: 2, jour: JOUR, screen: "accueil", idx: 0, classement: {}, pieces: {}, contacts: {}, decisions: {}, comments: {}, valides: {}, checks: {}, signal: {}, eleve: { nom: "", classe: "" }, onglet: "operations", releveMois: 1 };
  }
  function charger() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { s = null; /* stockage indisponible : on repart de zéro */ }
    if (s && s.v === 2 && s.jour === JOUR && typeof s.idx === "number" && s.idx >= 0 && s.idx < DOS.length) {
      if (["operations", "justificatifs", "decision", "releve"].indexOf(s.onglet) < 0) s.onglet = "operations";
      if ([1, 2, 3].indexOf(s.releveMois) < 0) s.releveMois = 1;
      if (!s.signal || typeof s.signal !== "object" || Array.isArray(s.signal)) s.signal = {};   /* progression enregistrée avant l'ajout de la fiche de signalement */
      return s;
    }
    var n = neuf();
    if (s && s.eleve && typeof s.eleve.nom === "string" && typeof s.eleve.classe === "string") n.eleve = { nom: s.eleve.nom, classe: s.eleve.classe };   /* le nom et la classe sont conservés d'un jour à l'autre */
    return n;
  }
  function sauver() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignoré */ }
  }
  var state = charger();

  /* ---------- outils ---------- */
  var nfEur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 2 });
  var nfPts = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  function eur(n) { return nfEur.format(n).replace("-", "−"); }
  var nfEur2 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function eur2(n) { return nfEur2.format(n).replace("-", "−"); }
  function pts(n) { return nfPts.format(n); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function pl(n, s, p) { return n + " " + (n > 1 ? p : s); }
  function initiales(c) { return (c.prenom.charAt(0) + c.nom.charAt(0)).toUpperCase(); }
  /* Les dates sont toujours dans le passé : « mois » = nombre de mois civils écoulés, « jour » = jour du mois (1 à 28). */
  function dateOp(op) {
    var d = maintenant();
    d.setDate(1);
    d.setMonth(d.getMonth() - op.mois);
    d.setDate(op.jour);
    return d;
  }
  function libMois(mois) {
    var d = maintenant();
    d.setDate(1);
    d.setMonth(d.getMonth() - mois);
    var s = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function aujourdhui() { return maintenant().toLocaleDateString("fr-FR"); }
  function fmtDate(d) { return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }); }
  function arrondi(x) { return Math.round(x * 100) / 100; }

  var ICON = {
    depot_especes: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="6.5" width="19" height="11" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 12h.01M18 12h.01"/></svg>',
    depot_cheque: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="6" width="19" height="12" rx="1.5"/><path d="M6 10h8M6 13.5h5"/><path d="M14 16c1-2.2 2-2.2 2.6-.6s1.4 1 2-.6"/></svg>',
    retrait_especes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14.5v-11"/><path d="M7.5 8 12 3.5 16.5 8"/><path d="M4 19h16"/></svg>',
    prelevement: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5v11"/><path d="M7.5 10.5 12 15l4.5-4.5"/><path d="M4 19h16"/></svg>',
    virement: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h14"/><path d="M14 4l4 4-4 4"/><path d="M20 16H6"/><path d="M10 12l-4 4 4 4"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    alert: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 21 20H3L12 4z"/><path d="M12 10v4M12 17h.01"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    cross: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h3l1.5 4-2 1.3a11 11 0 0 0 5.2 5.2l1.3-2 4 1.5v3a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z"/></svg>',
    mobile: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/></svg>',
    mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>',
    user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/></svg>',
    briefcase: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7.5" width="18" height="12" rx="2"/><path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5"/><path d="M3 12.5h18"/></svg>',
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11 12 4l8 7"/><path d="M6 10v9.5h12V10"/><path d="M10 19.5v-5h4v5"/></svg>',
    card: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5.5" width="19" height="13" rx="2"/><path d="M2.5 10h19M6 15h4"/></svg>',
    chart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20h18"/><path d="M6 20v-7M11 20V6M16 20v-10"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    doc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M9.5 12h5M9.5 15.5h5"/></svg>',
    flag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V4"/><path d="M6 4.5h11l-2 4 2 4H6"/></svg>',
    shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5.5c0 4.3 2.9 7.6 7 9.5 4.1-1.9 7-5.2 7-9.5V6l-7-3z"/><path d="m8.8 12 2.4 2.4 4-4.4"/></svg>',
    bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 21h4"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>'
  };

  function dossierCourant() { return DOS[state.idx]; }
  function classementDe(d) { if (!state.classement[d.id]) state.classement[d.id] = {}; return state.classement[d.id]; }
  function piecesDe(d) { if (!state.pieces[d.id]) state.pieces[d.id] = []; return state.pieces[d.id]; }
  function estContacte(d) { return !!state.contacts[d.id]; }
  function estValide(d) { return !!state.valides[d.id]; }
  function decisionDe(d) { return state.decisions[d.id] || null; }
  function commentaireOk(d) { return R.commentaireSuffisant(state.comments[d.id]); }
  function pretContact(d) { return R.peutContacter(d, classementDe(d), piecesDe(d)); }
  /* fiche de signalement à la cellule TRACFIN : exigée quand la décision est « déclarer » */
  function ficheDe(d) {
    var f = state.signal[d.id];
    if (!f || typeof f !== "object" || Array.isArray(f)) f = state.signal[d.id] = SG.defaut(d, classementDe(d));
    if (!Array.isArray(f.ops)) f.ops = [];
    return f;
  }
  function ctxSignal(d) { return { now: maintenant(), nom: state.eleve.nom, pieces: piecesDe(d), commentaire: state.comments[d.id] || "", classement: classementDe(d), valide: estValide(d) }; }
  function controleSignal(d) { return SG.controle(d, ficheDe(d), ctxSignal(d)); }
  function signalOk(d) { return decisionDe(d) !== "declaration" || controleSignal(d).ok; }
  function signalManque(d) { return decisionDe(d) === "declaration" ? controleSignal(d).erreurs.filter(function (e) { return e.champ !== "analyse"; }).length : 0; }
  function pretValider(d) { return estContacte(d) && !!decisionDe(d) && commentaireOk(d) && signalOk(d); }
  function scoreDe(d) { return R.scoreDossier(d, classementDe(d), piecesDe(d), decisionDe(d)); }
  function totalMax() { return DOS.reduce(function (t, d) { return t + d.operations.length + 2; }, 0); }
  function totalPoints() { return DOS.reduce(function (t, d) { return t + (estValide(d) ? scoreDe(d).total : 0); }, 0); }
  var TABS = ["operations", "justificatifs", "decision", "releve"];
  function compteurTexte(n) {
    return n < R.COMMENTAIRE_MIN
      ? n + " caractères : encore " + (R.COMMENTAIRE_MIN - n) + " pour pouvoir valider (minimum " + R.COMMENTAIRE_MIN + ")."
      : n + " sur " + MAX_COM + " caractères.";
  }
  function operationsTriees(d) {
    return d.operations.slice().sort(function (a, b) { return b.mois - a.mois || a.jour - b.jour; });
  }
  function canalTexte(d) {
    var co = d.client.coordonnees;
    if (d.contact.canal === "mobile") return "appel téléphonique au mobile du dossier (" + co.mobile + ")";
    if (d.contact.canal === "telephone") return "appel téléphonique au numéro fixe du dossier (" + co.telephone + ")";
    return "appels (" + co.mobile + " et " + co.telephone + "), courrier à l'adresse du dossier, e-mail (" + co.email + ") et convocation en agence";
  }

  /* ---------- accueil ---------- */
  function vueAccueil() {
    var enCours = state.idx > 0 || Object.keys(state.valides).length > 0 || Object.keys(state.contacts).length > 0;
    var h = '<section class="accueil" aria-labelledby="t-accueil">' +
      '<h1 id="t-accueil">Opération atypique : cohérente ou à déclarer ?</h1>' +
      '<p class="chapeau">Vous êtes Conseiller Clientèle Particuliers à GS Banque & Assurance. L\'outil de surveillance vous signale des mouvements inhabituels : dépôts d\'espèces, dépôts de chèques, retraits. Vous vérifiez s\'ils sont cohérents avec la situation personnelle, professionnelle et patrimoniale du client.</p>' +
      '<ol class="etapes">' +
      '<li><span class="et-ico" aria-hidden="true">' + ICON.search + '</span><p><strong>Analysez le dossier et classez les opérations.</strong> Comparez chaque opération au profil du client, puis choisissez Habituelle ou Atypique. Le relevé de compte des trois derniers mois reste consultable dans le dernier onglet.</p></li>' +
      '<li><span class="et-ico" aria-hidden="true">' + ICON.doc + '</span><p><strong>Choisissez les justificatifs à demander</strong>, puis contactez le client avec les coordonnées du dossier.</p></li>' +
      '<li><span class="et-ico" aria-hidden="true">' + ICON.phone + '</span><p><strong>Lisez le compte rendu du contact.</strong> Le dossier client est mis à jour avec les explications du client et les pièces reçues.</p></li>' +
      '<li><span class="et-ico" aria-hidden="true">' + ICON.shield + '</span><p><strong>Décidez.</strong> Validez l\'opération comme cohérente, ou déclarez-la à la cellule TRACFIN de l\'établissement. Le commentaire est obligatoire.</p></li>' +
      "</ol>" +
      '<form class="identite-form" data-form="eleve" autocomplete="off">' +
      '<div class="champ"><label for="nom">Nom et prénom</label><input id="nom" name="nom" type="text" maxlength="60" value="' + esc(state.eleve.nom) + '"></div>' +
      '<div class="champ"><label for="classe">Classe</label><input id="classe" name="classe" type="text" maxlength="30" value="' + esc(state.eleve.classe) + '"></div>' +
      '<p class="mention champ-large">Facultatif : ces informations apparaissent sur le bilan imprimé. Elles restent sur cet appareil.</p>' +
      "</form>" +
      '<div class="accueil-actions">' +
      '<button type="button" class="btn btn-principal" data-act="demarrer">' + (enCours ? "Reprendre au dossier " + (state.idx + 1) : "Commencer") + "</button>" +
      "</div>" +
      '<p class="mention">' + libelleJour() + " : " + DOS.length + " dossiers, " + totalMax() + " points à gagner : un point par opération bien classée, un point pour les justificatifs demandés et un point pour la décision.</p>" +
      "</section>";
    app.innerHTML = h;
  }

  /* ---------- dossier : bandeau client et colonne de gauche ---------- */
  function bandeauClient(d) {
    var c = d.client;
    var depuis = c.ancienneteMois ? pl(c.ancienneteMois, "mois", "mois") : pl(c.ancienneteAns, "an", "ans");
    return '<section class="client-bandeau" aria-labelledby="h-client">' +
      '<div class="cb-id"><span class="avatar avatar-lg" aria-hidden="true">' + esc(initiales(c)) + "</span><div>" +
      '<h2 id="h-client" class="cb-nom">' + esc(c.civilite + " " + c.prenom + " " + c.nom) + "</h2>" +
      '<p class="cb-sous">' + c.age + " ans, " + esc(c.profession) + "</p></div></div>" +
      '<dl class="cb-chiffres">' +
      "<div><dt>Revenus mensuels</dt><dd>" + eur(c.revenus) + '</dd><dd class="cb-note">' + esc(c.revenusNote) + "</dd></div>" +
      "<div><dt>Client depuis</dt><dd>" + depuis + "</dd></div>" +
      "<div><dt>Compte n°</dt><dd>" + esc(c.compte) + "</dd></div></dl>" +
      '<div class="cb-bas">' +
      '<ul class="cb-produits" aria-label="Produits détenus">' + c.produits.map(function (p) { return '<li class="chip chip-produit">' + ICON.card + esc(p) + "</li>"; }).join("") + "</ul>" +
      '<p class="cb-alerte">' + ICON.bell + "<span><strong>Alerte de l'outil de surveillance :</strong> " + pl(d.operations.length, "opération signalée", "opérations signalées") + "</span></p>" +
      "</div></section>";
  }
  function pfBloc(ico, titre, corps, classe) {
    return '<div class="pf' + (classe ? " " + classe : "") + '"><span class="pf-ico" aria-hidden="true">' + ICON[ico] + '</span><div class="pf-corps"><h3 class="pf-titre">' + titre + "</h3>" + corps + "</div></div>";
  }
  function blocProfil(d) {
    var c = d.client;
    var maj = estContacte(d)
      ? "Aujourd'hui (mis à jour après le contact)"
      : "Il y a " + c.miseAJourMois + " mois";
    return '<section class="bloc bloc-profil" aria-labelledby="h-profil"><h2 id="h-profil">Profil du client</h2>' +
      pfBloc("user", "Situation personnelle", "<p>" + esc(c.situation) + "</p>") +
      pfBloc("briefcase", "Situation professionnelle", "<p>" + esc(c.professionnel) + "</p>") +
      pfBloc("home", "Situation patrimoniale", '<ul class="liste-patrimoine">' + c.patrimoine.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>") +
      (d.observations ? pfBloc("info", "Observations", d.observations.map(function (o) { return "<p>" + esc(o) + "</p>"; }).join("")) : "") +
      '<p class="pf-maj">' + ICON.clock + "<span>Dernière mise à jour du dossier : <strong>" + maj + "</strong></span></p></section>";
  }
  function blocCoordonnees(d) {
    var co = d.client.coordonnees;
    function ligne(ico, lib, val) {
      return '<li><span class="co-ico" aria-hidden="true">' + ICON[ico] + '</span><div><span class="co-lib">' + lib + '</span><span class="co-val">' + esc(val) + "</span></div></li>";
    }
    return '<section class="bloc bloc-coord" aria-labelledby="h-coord"><h2 id="h-coord">Coordonnées du client</h2>' +
      '<ul class="co-liste">' + ligne("mobile", "Mobile", co.mobile) + ligne("phone", "Téléphone fixe", co.telephone) + ligne("mail", "E-mail", co.email) + ligne("pin", "Adresse", co.adresse) + "</ul>" +
      '</section>';
  }
  function blocMaj(d) {
    if (!estContacte(d)) return "";
    return '<section class="bloc bloc-maj" aria-labelledby="h-maj"><h2 id="h-maj">' + ICON.check + "Dossier mis à jour</h2>" +
      '<p class="mention">Mise à jour du ' + aujourdhui() + ", après le contact avec le client.</p>" +
      '<ul class="maj-liste">' + d.contact.maj.map(function (m) {
        return '<li><span class="maj-rub">' + esc(m.rubrique) + "</span><span>" + esc(m.texte) + "</span></li>";
      }).join("") + "</ul></section>";
  }
  function colonneGauche(d) { return blocMaj(d) + blocProfil(d) + blocCoordonnees(d); }

  /* ---------- dossier : espèces par mois civil (barres et seuil COSI) ---------- */
  function blocEspeces(d) {
    var cum = REL[d.id] ? R.cumulEspecesReleve(REL[d.id].lignes) : R.cumulEspeces(d);
    var h = '<section class="bloc bloc-especes" aria-labelledby="h-esp"><h2 id="h-esp">Espèces par mois civil</h2>';
    if (!cum.length) return h + '<p class="mention">Aucune opération en espèces sur les trois derniers mois.</p></section>';
    var max = R.SEUIL_COSI * 1.5;
    cum.forEach(function (m) { max = Math.max(max, m.depots * 1.05, m.retraits * 1.05); });
    var seuil = ((R.SEUIL_COSI / max) * 100).toFixed(1);
    function barre(v, cosi) {
      return '<span class="cosi-barre' + (cosi ? " cosi-depasse" : "") + '" aria-hidden="true"><span class="cosi-rempli" style="width:' + Math.min(100, (v / max) * 100).toFixed(1) + '%"></span><span class="cosi-seuil" style="left:' + seuil + '%"></span></span>';
    }
    h += '<table class="cosi-table"><caption class="sr">Dépôts et retraits d\'espèces cumulés par mois civil</caption>' +
      '<thead><tr><th scope="col">Mois</th><th scope="col">Dépôts</th><th scope="col">Retraits</th></tr></thead><tbody>';
    cum.forEach(function (m) {
      h += '<tr><th scope="row">' + esc(libMois(m.mois)) + "</th>" +
        '<td><span class="cosi-val">' + eur(m.depots) + "</span>" + (m.cosiDepots ? ' <span class="chip chip-warn">' + ICON.alert + "COSI</span>" : "") + barre(m.depots, m.cosiDepots) + "</td>" +
        '<td><span class="cosi-val">' + eur(m.retraits) + "</span>" + (m.cosiRetraits ? ' <span class="chip chip-warn">' + ICON.alert + "COSI</span>" : "") + barre(m.retraits, m.cosiRetraits) + "</td></tr>";
    });
    return h + "</tbody></table>" +
      '<p class="cosi-legende" aria-hidden="true"><span class="cosi-trait"></span>Seuil COSI : ' + eur(R.SEUIL_COSI) + " par mois civil</p>" +
      '<p class="mention">COSI : au-delà de ' + eur(R.SEUIL_COSI) + " d'espèces dans le mois civil (dépôts et retraits comptés séparément), la banque communique systématiquement l'information à TRACFIN. Ce n'est pas une déclaration de soupçon.</p></section>";
  }

  /* ---------- onglet 1 : opérations à examiner ---------- */
  function boutonClasse(o, valeur, libelle, actuel, fige) {
    var actif = actuel === valeur;
    return '<button type="button" class="choix choix-' + (valeur === "habituelle" ? "hab" : "aty") + (actif ? " est-actif" : "") + '" aria-pressed="' + actif + '" data-act="classer" data-op="' + o.id + '" data-c="' + valeur + '"' + (fige ? " disabled" : "") + ">" +
      (valeur === "habituelle" ? ICON.check : ICON.alert) + "<span>" + libelle + "</span></button>";
  }
  function dateCourte(op) {
    var d = dateOp(op);
    var mm = d.getMonth() + 1, jj = d.getDate();
    return {
      jm: (jj < 10 ? "0" : "") + jj + "/" + (mm < 10 ? "0" : "") + mm,
      an: d.getFullYear(),
      iso: d.getFullYear() + "-" + (mm < 10 ? "0" : "") + mm + "-" + (jj < 10 ? "0" : "") + jj
    };
  }
  function ligneOperation(o, d, notation) {
    var fige = estContacte(d);
    var actuel = classementDe(d)[o.id] || null;
    var credit = R.sens(o) === "credit";
    var dc = dateCourte(o);
    var h = '<li class="op op-at' + (actuel === "habituelle" ? " est-hab" : actuel === "atypique" ? " est-aty" : "") + '" data-op="' + o.id + '">' +
      '<time class="op-date" datetime="' + dc.iso + '"><span class="op-j">' + dc.jm + '</span><span class="op-m">' + dc.an + "</span></time>" +
      '<span class="op-ico ' + (credit ? "op-ico-credit" : "op-ico-debit") + '" aria-hidden="true">' + ICON[o.type] + "</span>" +
      '<div class="op-corps"><p class="op-lib">' + esc(o.libelle) + '</p><p class="op-det"><span class="op-tag">' + esc(R.TYPES[o.type]) + "</span> " + esc(o.detail) + "</p></div>" +
      '<p class="op-montant ' + (credit ? "entree" : "sortie") + '">' + (credit ? "+" : "−") + eur(o.montant) + "</p>" +
      '<div class="op-choix" role="group" aria-label="Classement : ' + esc(o.libelle) + '">' +
      boutonClasse(o, "habituelle", "Habituelle", actuel, fige) + boutonClasse(o, "atypique", "Atypique", actuel, fige) + "</div>";
    if (notation) {
      var det = notation.details.filter(function (x) { return x.id === o.id; })[0];
      var lib = det.attendu === "atypique" ? "atypique" : "habituelle";
      h += det.verdict === "ok"
        ? '<p class="verdict verdict-ok">' + ICON.check + "Bien classée (1 point)</p>"
        : '<p class="verdict verdict-ko">' + ICON.cross + "À revoir (0 point). Attendu : " + lib + "</p>";
      h += '<p class="op-expl">' + esc(o.explication) + "</p>";
    }
    return h + "</li>";
  }
  function operationsHtml(d) {
    var notation = estValide(d) ? R.noterClassement(d, classementDe(d)) : null;
    var fige = estContacte(d);
    return '<p class="com-aide">' + (fige
      ? "Votre analyse est figée : le client a été contacté."
      : "Comparez chaque opération au profil du client (situation, revenus, patrimoine) et aux habitudes que montre son relevé de compte (dernier onglet, trois derniers mois), puis classez-la : Habituelle ou Atypique.") + "</p>" +
      '<ul class="ops">' + operationsTriees(d).map(function (o) { return ligneOperation(o, d, notation); }).join("") + "</ul>";
  }

  /* ---------- onglet « Relevé de compte » ---------- */
  /* Les lignes du relevé (releves_atypiques.js) sont datées comme les opérations : mois civils écoulés et jour du mois.
     Le solde de chaque ligne est calculé à partir du solde d'ouverture. */
  var ICONREL = { carte: ICON.card, prelevement: ICON.prelevement, cheque: ICON.depot_cheque, virement: ICON.virement, depot_cheque: ICON.depot_cheque, depot_especes: ICON.depot_especes, retrait_especes: ICON.retrait_especes, ouverture: ICON.info };
  function releveCalcul(d) {
    var r = REL[d.id];
    if (!r) return null;
    var solde = r.ouverture;
    var lignes = r.lignes.map(function (l) {
      solde = arrondi(solde + l[4]);
      return { mois: l[0], jour: l[1], k: l[2], lib: l[3], m: l[4], op: l[5] || null, solde: solde };
    });
    return { ouverture: r.ouverture, depart: r.depart, lignes: lignes };
  }
  function debutMois(mois) {
    var d = maintenant();
    d.setDate(1);
    d.setMonth(d.getMonth() - mois);
    return d;
  }
  function finDeMois(mois) { var d = debutMois(mois); return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
  function ligneReleve(l) {
    var cls = "rel-ligne rel-" + l.k + (l.op ? " rel-signalee" : "");
    var montant = l.m < 0 ? eur2(l.m) : "+" + eur2(l.m);
    return '<tr class="' + cls + '"><td class="rel-date">' + fmtDate(dateOp(l)) + "</td>" +
      '<td class="rel-lib"><span class="rel-ico">' + (ICONREL[l.k] || "") + "</span><span>" + esc(l.lib) + "</span>" +
      (l.op ? ' <span class="chip chip-sign">' + ICON.flag + "Signalée</span>" : "") +
      '<span class="rel-mob">' + esc(montant) + " · Solde " + eur2(l.solde) + "</span></td>" +
      '<td class="rel-debit">' + (l.m < 0 ? eur2(-l.m) : "") + "</td>" +
      '<td class="rel-credit">' + (l.m > 0 ? eur2(l.m) : "") + "</td>" +
      '<td class="rel-solde">' + eur2(l.solde) + "</td></tr>";
  }
  function releveContenu(rc, m) {
    var du = fmtDate(debutMois(m)), au = fmtDate(finDeMois(m));
    if (rc.depart && m > rc.depart.mois) {
      return '<h3 class="rel-titre">Relevé du ' + du + " au " + au + "</h3>" +
        '<p class="rel-vide">Le compte a été ouvert le ' + fmtDate(dateOp(rc.depart)) + " : il n'y a aucune opération avant cette date.</p>";
    }
    var lignes = rc.lignes.filter(function (l) { return l.mois === m; });
    var avant = rc.lignes.filter(function (l) { return l.mois > m; });
    var debut = avant.length ? avant[avant.length - 1].solde : rc.ouverture;
    var fin = lignes.length ? lignes[lignes.length - 1].solde : debut;
    var deb = 0, cre = 0;
    lignes.forEach(function (l) { if (l.m < 0) deb -= l.m; else cre += l.m; });
    var ouvert = rc.depart && rc.depart.mois === m;
    var h = '<h3 class="rel-titre">Relevé du ' + du + " au " + au + "</h3>" +
      '<p class="sr" role="status">Relevé affiché : ' + esc(libMois(m)) + ", du " + du + " au " + au + ".</p>" +
      '<dl class="rel-synthese">' +
      "<div><dt>" + (ouvert ? "Ouverture du compte" : "Solde au " + fmtDate(finDeMois(m + 1))) + "</dt><dd>" + eur2(debut) + "</dd></div>" +
      "<div><dt>Total des débits</dt><dd>" + eur2(arrondi(deb)) + "</dd></div>" +
      "<div><dt>Total des crédits</dt><dd>" + eur2(arrondi(cre)) + "</dd></div>" +
      "<div><dt>Solde au " + au + "</dt><dd>" + eur2(fin) + "</dd></div>" +
      "</dl>" +
      '<div class="rel-tableau"><table class="rel-table"><caption class="sr">Opérations du ' + du + " au " + au + ", de la plus ancienne à la plus récente</caption>" +
      '<thead><tr><th scope="col">Date</th><th scope="col">Opération</th><th scope="col" class="rel-debit">Débit</th><th scope="col" class="rel-credit">Crédit</th><th scope="col" class="rel-solde">Solde</th></tr></thead><tbody>';
    lignes.forEach(function (l) { h += ligneReleve(l); });
    if (!lignes.length) h += '<tr><td colspan="5" class="rel-vide">Aucune opération sur cette période.</td></tr>';
    return h + "</tbody></table></div>";
  }
  function releveHtml(d) {
    var rc = releveCalcul(d);
    if (!rc) return '<p class="mention">Le relevé de ce compte n\'est pas disponible.</p>';
    var m = state.releveMois || 1;
    var b = "";
    [3, 2, 1].forEach(function (mo) {
      b += '<button type="button" class="mois' + (mo === m ? " est-actif" : "") + '" aria-pressed="' + (mo === m) + '" data-act="mois-releve" data-m="' + mo + '">' + esc(libMois(mo)) + "</button>";
    });
    return '<div class="releve">' +
      '<p class="com-aide" id="rel-aide">Relevé du compte courant sur les trois derniers mois civils écoulés, de la ligne la plus ancienne à la plus récente. Les lignes marquées « Signalée » sont les opérations de l\'onglet « Opérations à examiner ».</p>' +
      '<div class="rel-mois" role="group" aria-label="Mois du relevé" aria-describedby="rel-aide">' + b + "</div>" +
      releveContenu(rc, m) +
      '</div>';
  }

  /* ---------- onglet 2 : justificatifs ---------- */
  function piecesVerdictHtml(d) {
    var n = R.noterPieces(d, piecesDe(d));
    var h;
    if (n.verdict === "ok") h = '<p class="verdict verdict-ok">' + ICON.check + "Bonne demande (1 point)</p>";
    else if (n.verdict === "defendable") h = '<p class="verdict verdict-def">' + ICON.info + "Demande défendable (0,5 point)</p>";
    else h = '<p class="verdict verdict-ko">' + ICON.cross + "À revoir (0 point)</p>";
    var det = [];
    if (n.manquantes.length) det.push("Pièces attendues non demandées : " + n.manquantes.map(R.libellePiece).join(" ; ") + ".");
    if (n.enTrop.length) det.push("Pièces demandées hors sujet : " + n.enTrop.map(R.libellePiece).join(" ; ") + ".");
    if (!det.length) det.push("Vous avez demandé exactement les pièces attendues.");
    return h + '<p class="op-expl">' + det.map(esc).join(" ") + "</p>";
  }
  function justificatifsHtml(d) {
    var valide = estValide(d);
    var fige = estContacte(d);
    var sel = piecesDe(d);
    var att = d.pieces.attendues;
    var co = d.client.coordonnees;
    var h = '<fieldset class="opp pieces"><legend>Quels justificatifs demandez-vous au client ?</legend>' +
      '<p class="com-aide" id="pieces-aide">' + (fige
        ? "Votre demande est envoyée : elle ne peut plus être modifiée."
        : "Cochez les pièces à demander, en fonction de ce que le dossier laisse penser de l'origine des fonds. Une explication écrite est toujours possible. Au moins une pièce est nécessaire pour contacter le client.") + "</p>" +
      '<div class="opp-liste pieces-liste">';
    R.PIECES.forEach(function (p) {
      var actif = sel.indexOf(p.id) >= 0;
      h += '<label class="opp-choix piece-carte' + (actif ? " est-actif" : "") + (valide && att.indexOf(p.id) >= 0 ? " opp-attendue" : "") + '">' +
        '<input type="checkbox" name="piece" value="' + p.id + '" data-piece="' + p.id + '"' + (actif ? " checked" : "") + (fige ? " disabled" : "") + ' aria-describedby="pieces-aide">' +
        '<span class="piece-ico" aria-hidden="true">' + ICON.doc + '</span><span class="piece-lib">' + esc(p.libelle) + "</span></label>";
    });
    h += "</div></fieldset>";
    h += '<div class="contact-prevu"><span class="contact-ico" aria-hidden="true">' + ICON.phone + '</span><div class="cp-corps">' +
      '<p class="cp-titre"><strong>Contact prévu :</strong> ' + esc(d.client.civilite + " " + d.client.prenom + " " + d.client.nom) + "</p>" +
      '<ul class="cp-liste"><li>' + ICON.mobile + "<span>Mobile " + esc(co.mobile) + "</span></li>" +
      "<li>" + ICON.phone + "<span>Fixe " + esc(co.telephone) + "</span></li>" +
      "<li>" + ICON.mail + "<span>" + esc(co.email) + "</span></li>" +
      "<li>" + ICON.pin + "<span>" + esc(co.adresse) + "</span></li></ul></div></div>";
    if (valide) h += '<div class="opp-correction">' + piecesVerdictHtml(d) + "</div>";
    return h;
  }

  /* ---------- onglet 3 : contact et décision ---------- */
  var ICON_CANAL = { mobile: "mobile", telephone: "phone", courrier: "mail" };
  function contactHtml(d) {
    var sel = piecesDe(d);
    return '<section class="contact-rec" id="contact-rec" tabindex="-1" aria-labelledby="h-contact">' +
      '<div class="cr-tete"><span class="contact-ico contact-ico-lg" aria-hidden="true">' + ICON[ICON_CANAL[d.contact.canal] || "phone"] + "</span><div>" +
      '<h3 id="h-contact">Compte rendu du contact</h3>' +
      '<p class="cr-meta"><strong>Date :</strong> ' + aujourdhui() + ". <strong>Canal :</strong> " + esc(canalTexte(d)) + ".</p></div></div>" +
      '<div class="cr-bloc"><p class="cr-titre">Votre demande</p><ul class="demande">' +
      sel.map(function (id) { return '<li class="chip chip-doc">' + ICON.doc + esc(R.libellePiece(id)) + "</li>"; }).join("") + "</ul></div>" +
      '<div class="cr-bloc"><p class="cr-titre">Échange avec le client</p><div class="echange">' + d.contact.echange.map(function (x) { return "<p>" + esc(x) + "</p>"; }).join("") + "</div></div>" +
      '<div class="cr-bloc"><p class="cr-titre">Pièces reçues</p><ul class="recues">' +
      d.contact.recues.map(function (x) { return '<li><span class="rc-ico" aria-hidden="true">' + ICON.doc + "</span><span>" + esc(x) + "</span></li>"; }).join("") + "</ul></div>" +
      '<p class="mention">Le dossier client a été mis à jour : voir le bloc « Dossier mis à jour » en haut de page.</p></section>';
  }
  function decisionFieldset(d) {
    var valide = estValide(d);
    var dec = decisionDe(d);
    var h = '<fieldset class="opp decision"><legend>Votre décision</legend>' +
      '<p class="com-aide" id="decision-aide">Au vu des explications du client, des pièces reçues et de son profil, l\'opération est-elle cohérente ?</p>' +
      '<div class="opp-liste">';
    R.ISSUES.forEach(function (i) {
      var actif = dec === i.code;
      h += '<label class="opp-choix choix-decision' + (actif ? " est-actif" : "") + (valide && i.code === d.issue ? " opp-attendue" : "") + '">' +
        '<input type="radio" name="decision" value="' + i.code + '" data-decision="' + i.code + '"' + (actif ? " checked" : "") + (valide ? " disabled" : "") + ' aria-describedby="decision-aide">' +
        '<span class="dec-ico" aria-hidden="true">' + (i.code === "declaration" ? ICON.flag : ICON.shield) + "</span>" +
        '<span class="dec-txt"><span class="decision-lib">' + esc(i.libelle) + '</span><span class="decision-aide">' + esc(i.aide) + "</span></span></label>";
    });
    return h + "</div></fieldset>";
  }
  function tuileScore(lib, ico, val, etat) {
    return '<li class="st st-' + etat + '"><span class="st-ico">' + ICON[ico] + '</span><span class="st-lib">' + lib + '</span><span class="st-val">' + val + "</span></li>";
  }
  /* Correction de la fiche de signalement (non notée) : seulement quand la décision attendue était bien « déclarer ». */
  function signalCorrectionHtml(d) {
    if (decisionDe(d) !== "declaration" || d.issue !== "declaration") return "";
    var c = SG.correction(d, ficheDe(d));
    function liste(ids) { return SG.lignes(d, ids, maintenant()).map(function (r) { return r.dateTxt + " (" + eur(r.montant) + ")"; }).join(", "); }
    return '<h4>Fiche de signalement</h4><ul class="sg-corr">' +
      "<li>" + (c.opsOk ? "Opérations signalées : celles que le dossier désigne comme atypiques, ni plus ni moins."
        : "Opérations signalées : à revoir." + (c.manquantes.length ? " Manquantes : " + esc(liste(c.manquantes)) + "." : "") + (c.enTrop.length ? " En trop, car habituelles : " + esc(liste(c.enTrop)) + "." : "")) + "</li>" +
      "<li>" + (c.casOk ? "Cas de déclaration : cas I, le cas général." : "Cas de déclaration : le cas I était attendu, car aucun dossier de l'outil ne relève de la fraude fiscale.") + "</li>" +
      "<li>Exécution : les opérations d'un dossier sont déjà inscrites au compte, donc exécutées (convention de l'outil).</li></ul>" +
      '<p class="mention">La fiche n\'est pas notée : elle réunit les mentions que la déclaration devra contenir.</p>';
  }
  function correctionHtml(d) {
    var sc = scoreDe(d);
    var piecesAtt = d.pieces.attendues;
    var sel = piecesDe(d);
    var etatClassement = sc.classement.total === sc.classement.max ? "ok" : sc.classement.total === 0 ? "ko" : "def";
    var etatPieces = sc.pieces.verdict === "ok" ? "ok" : sc.pieces.verdict === "defendable" ? "def" : "ko";
    var h = '<section class="correction" id="correction" tabindex="-1" aria-labelledby="h-corr">' +
      '<h3 id="h-corr">Correction du dossier</h3>' +
      '<p class="score">Vous obtenez <strong>' + pts(sc.total) + " sur " + sc.max + "</strong> points : repérage " + sc.classement.total + " sur " + sc.classement.max +
      ", justificatifs " + pts(sc.pieces.points) + " sur 1, décision " + sc.issue.points + " sur 1.</p>" +
      '<ul class="score-tuiles" aria-hidden="true">' +
      tuileScore("Repérage", "search", sc.classement.total + " / " + sc.classement.max, etatClassement) +
      tuileScore("Justificatifs", "doc", pts(sc.pieces.points) + " / 1", etatPieces) +
      tuileScore("Décision", "shield", sc.issue.points + " / 1", sc.issue.verdict === "ok" ? "ok" : "ko") + "</ul>" +
      "<p><strong>Objectif du dossier.</strong> " + esc(d.objectif) + "</p>" +
      "<p><strong>Décision attendue.</strong> " + esc(R.libelleIssue(d.issue)) + ". Votre décision : " + esc(decisionDe(d) ? R.libelleIssue(decisionDe(d)) : "aucune") + ".</p>" +
      (sc.issue.verdict === "ok"
        ? '<p class="verdict verdict-ok">' + ICON.check + "Bonne décision (1 point)</p>"
        : '<p class="verdict verdict-ko">' + ICON.cross + "À revoir (0 point)</p>") +
      "<p>" + esc(d.explication) + "</p>" +
      "<p><strong>Appréciation des pièces reçues.</strong> " + esc(d.contact.appreciation) + "</p>" +
      "<h4>Justificatifs attendus</h4><ul>" + piecesAtt.map(function (id) {
        return "<li>" + esc(R.libellePiece(id)) + (sel.indexOf(id) >= 0 ? " (demandé)" : " (non demandé)") + "</li>";
      }).join("") + "</ul>" +
      (R.cosiDeclenchee(d) ? '<p class="rappel">' + ICON.info + "<span>Le seuil de " + eur(R.SEUIL_COSI) + " d'espèces dans le mois est dépassé : la communication systématique (COSI) à TRACFIN est automatique. Ce n'est pas une déclaration de soupçon et elle ne dépend pas de votre décision.</span></p>" : "") +
      (d.issue === "declaration" ? '<p class="rappel">' + ICON.lock + "<span>La déclaration est confidentielle : ne la révélez ni au client, ni à des tiers (art. L561-18 du Code monétaire et financier).</span></p>" : "") +
      signalCorrectionHtml(d) + "<h4>À retenir</h4><ul>" + d.retenir.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></section>";
    return h;
  }
  function decisionZone(d) {
    if (!estContacte(d)) {
      return '<div class="verrou-msg">' + ICON.lock + "<p>Cette étape s'ouvre après le contact avec le client. Classez les opérations (onglet « Opérations à examiner »), choisissez les justificatifs à demander (onglet « Justificatifs »), puis cliquez sur « Contacter le client ».</p></div>";
    }
    return (estValide(d) ? correctionHtml(d) : "") + contactHtml(d) + decisionFieldset(d) + '<div id="signal-zone">' + signalHtml(d) + "</div>";
  }
  function signalHtml(d) { return decisionDe(d) === "declaration" ? SU.html(d, ficheDe(d), ctxSignal(d)) : ""; }
  /* La fiche suit la décision : elle apparaît quand on choisit « déclarer », sans toucher au reste de l'onglet. */
  function majSignalZone() {
    var z = document.getElementById("signal-zone");
    if (z) z.innerHTML = signalHtml(dossierCourant());
  }
  function signalSaisie(t) {
    var d = dossierCourant();
    if (estValide(d) || decisionDe(d) !== "declaration") return;
    var f = ficheDe(d), r = SU.saisir(f, t);
    if (r === "choix") SU.redessiner(d, f, ctxSignal(d), t.id);
    else if (r) SU.maj(d, f, ctxSignal(d));
    sauver();
    majActions();
  }
  function autoEvalHtml(d) {
    if (!estValide(d)) return "";
    var coches = state.checks[d.id] || [];
    var n = coches.filter(Boolean).length;
    var h = '<section class="autoeval" aria-labelledby="h-auto"><h3 id="h-auto">Auto-évaluation</h3>' +
      "<p>Voici les éléments attendus dans un bon commentaire. Cochez ceux que le vôtre mentionne.</p><ul>";
    d.argumentaire.forEach(function (x, i) {
      h += '<li><label><input type="checkbox" data-check="' + i + '"' + (coches[i] ? " checked" : "") + "> " + esc(x) + "</label></li>";
    });
    return h + '</ul><p class="autoeval-total" id="autoeval-total">' + n + " élément" + (n > 1 ? "s" : "") + " sur " + d.argumentaire.length + " mentionné" + (n > 1 ? "s" : "") + ".</p></section>";
  }

  /* ---------- barre d'actions ---------- */
  function aideActions(d) {
    if (estValide(d)) return "Dossier validé. Passez au suivant quand vous êtes prêt.";
    if (!estContacte(d)) {
      var cl = classementDe(d);
      var reste = d.operations.filter(function (o) { return !cl[o.id]; }).length;
      if (reste) return "Classez " + (reste > 1 ? "les " + reste + " opérations restantes" : "l'opération restante") + " : Habituelle ou Atypique.";
      if (!d.operations.some(function (o) { return cl[o.id] === "atypique"; })) return "Aucune opération n'est jugée atypique alors que l'outil de surveillance a signalé ce dossier. Relisez le profil du client.";
      if (!piecesDe(d).length) return "Choisissez au moins un justificatif à demander dans l'onglet « Justificatifs ».";
      return "Prêt : cliquez sur « Contacter le client ». Il répondra avec les éléments du compte rendu.";
    }
    if (!decisionDe(d)) return "Choisissez votre décision dans l'onglet « Contact et décision ».";
    if (signalManque(d)) return "Complétez la fiche de signalement à la cellule TRACFIN : " + pl(signalManque(d), "mention manquante", "mentions manquantes") + ".";
    if (!commentaireOk(d)) return "Rédigez votre commentaire : il est obligatoire (au moins " + R.COMMENTAIRE_MIN + " caractères).";
    return "Tout est prêt : validez pour voir la correction.";
  }
  function actionsHtml(d) {
    var valide = estValide(d);
    var contacte = estContacte(d);
    var dernier = state.idx === DOS.length - 1;
    var principal;
    if (!contacte) principal = '<button type="button" class="btn btn-secondaire" id="btn-contacter" data-act="contacter" aria-describedby="actions-aide"' + (pretContact(d) ? "" : " disabled") + ">Contacter le client</button>";
    else principal = '<button type="button" class="btn btn-secondaire" id="btn-valider" data-act="valider" aria-describedby="actions-aide"' + (valide || !pretValider(d) ? " disabled" : "") + ">" + (valide ? "Validé" : "Valider") + "</button>";
    return '<p class="actions-aide" id="actions-aide">' + aideActions(d) + "</p>" +
      '<div class="actions-boutons">' + principal +
      '<button type="button" class="btn btn-principal" id="btn-suivant" data-act="suivant" aria-describedby="actions-aide"' + (valide ? "" : " disabled") + ">" + (dernier ? "Voir le bilan" : "Suivant") + "</button>" +
      "</div>";
  }

  var ETAPES = [["operations", "Opérations à examiner"], ["justificatifs", "Justificatifs"], ["decision", "Contact et décision"]];
  function etapesEtat(d) {
    var cl = classementDe(d);
    var n = d.operations.filter(function (o) { return cl[o.id]; }).length;
    var tot = d.operations.length;
    var np = piecesDe(d).length;
    var contacte = estContacte(d);
    var valide = estValide(d);
    return {
      operations: { fait: contacte || n === tot, texte: contacte ? "Analyse figée" : n + " sur " + tot + (tot > 1 ? " classées" : " classée") },
      justificatifs: { fait: contacte || np > 0, texte: contacte ? "Demande envoyée" : np ? pl(np, "pièce demandée", "pièces demandées") : "Aucune pièce choisie" },
      decision: { fait: valide, texte: valide ? "Dossier validé" : !contacte ? "Après le contact" : !decisionDe(d) ? "À décider" : signalManque(d) ? "Fiche à compléter" : !commentaireOk(d) ? "Commentaire à rédiger" : "Prêt à valider" }
    };
  }
  function ongletInterieur(libelle, e, rang) {
    return '<span class="etape-num" aria-hidden="true">' + (e.fait ? ICON.check : rang) + '</span><span class="etape-txt"><span class="etape-lib">' + libelle + '</span><span class="etape-etat">' + esc(e.texte) + "</span></span>";
  }
  function ongletHtml(nom, libelle, rang, e) {
    var actif = state.onglet === nom;
    return '<button type="button" role="tab" id="tab-' + nom + '" class="onglet' + (e.fait ? " etape-fait" : "") + '" aria-controls="panneau-' + nom + '" aria-selected="' + actif + '" tabindex="' + (actif ? 0 : -1) + '" data-act="onglet" data-tab="' + nom + '">' + ongletInterieur(libelle, e, rang) + "</button>";
  }
  function ongletReleve() {
    var actif = state.onglet === "releve";
    return '<button type="button" role="tab" id="tab-releve" class="onglet onglet-releve" aria-controls="panneau-releve" aria-selected="' + actif + '" tabindex="' + (actif ? 0 : -1) + '" data-act="onglet" data-tab="releve">' +
      '<span class="etape-num" aria-hidden="true">' + ICON.doc + '</span><span class="etape-txt"><span class="etape-lib">Relevé de compte</span><span class="etape-etat">3 derniers mois</span></span></button>';
  }
  function majEtapes() {
    var e = etapesEtat(dossierCourant());
    ETAPES.forEach(function (t, i) {
      var tab = document.getElementById("tab-" + t[0]);
      if (!tab) return;
      tab.classList.toggle("etape-fait", e[t[0]].fait);
      tab.innerHTML = ongletInterieur(t[1], e[t[0]], i + 1);
    });
  }

  function vueDossier() {
    var d = dossierCourant();
    var com = state.comments[d.id] || "";
    var et = etapesEtat(d);
    var h = '<div class="poste">' +
      '<h1 class="titre-poste">Opérations atypiques<span>Dossier ' + (state.idx + 1) + " sur " + DOS.length + "</span></h1>" +
      bandeauClient(d) +
      '<div class="poste-grille">' +
      '<div class="col-gauche" id="col-gauche">' + colonneGauche(d) + "</div>" +
      '<div class="col-droite">' +
      blocEspeces(d) +
      '<section class="bloc bloc-travail">' +
      '<div class="onglets onglets-etapes" role="tablist" aria-label="Étapes du dossier">' +
      ETAPES.map(function (t, i) { return ongletHtml(t[0], t[1], i + 1, et[t[0]]); }).join("") + ongletReleve() +
      "</div>" +
      '<div role="tabpanel" id="panneau-operations" class="panneau" aria-labelledby="tab-operations"' + (state.onglet === "operations" ? "" : " hidden") + ">" + operationsHtml(d) + "</div>" +
      '<div role="tabpanel" id="panneau-justificatifs" class="panneau" aria-labelledby="tab-justificatifs"' + (state.onglet === "justificatifs" ? "" : " hidden") + ">" + justificatifsHtml(d) + "</div>" +
      '<div role="tabpanel" id="panneau-decision" class="panneau" aria-labelledby="tab-decision"' + (state.onglet === "decision" ? "" : " hidden") + ">" +
      '<div id="decision-zone">' + decisionZone(d) + "</div>" +
      '<div id="decision-com"' + (estContacte(d) ? "" : " hidden") + ">" +
      '<label class="com-label" for="commentaire">Commentaire du conseiller (obligatoire)</label>' +
      '<p class="com-aide" id="com-aide">Consignez votre analyse : opérations atypiques, comparaison avec la situation du client, pièces reçues et leur concordance, décision. Le commentaire est obligatoire pour valider le dossier.</p>' +
      '<textarea id="commentaire" rows="8" maxlength="' + MAX_COM + '" aria-required="true" aria-describedby="com-aide com-compteur">' + esc(com) + "</textarea>" +
      '<p class="com-compteur" id="com-compteur">' + compteurTexte(com.trim().length) + "</p>" +
      '<div id="autoeval">' + autoEvalHtml(d) + "</div></div>" +
      "</div>" +
      '<div role="tabpanel" id="panneau-releve" class="panneau" aria-labelledby="tab-releve"' + (state.onglet === "releve" ? "" : " hidden") + ">" + releveHtml(d) + "</div>" +
      '<div class="actions" id="actions">' + actionsHtml(d) + "</div>" +
      "</section></div></div></div>";
    app.innerHTML = h;
  }

  /* mises à jour partielles : on garde le texte du commentaire et le focus */
  function rafraichir() {
    var d = dossierCourant();
    var g = document.getElementById("col-gauche");
    if (g) g.innerHTML = colonneGauche(d);
    var ops = document.getElementById("panneau-operations");
    if (ops) ops.innerHTML = operationsHtml(d);
    var pi = document.getElementById("panneau-justificatifs");
    if (pi) pi.innerHTML = justificatifsHtml(d);
    var dz = document.getElementById("decision-zone");
    if (dz) dz.innerHTML = decisionZone(d);
    var dc = document.getElementById("decision-com");
    if (dc) dc.hidden = !estContacte(d);
    majActions();
    var ae = document.getElementById("autoeval");
    if (ae) ae.innerHTML = autoEvalHtml(d);
  }
  function majActions() {
    var d = dossierCourant();
    var act = document.getElementById("actions");
    if (act) act.innerHTML = actionsHtml(d);
    majEtapes();
  }

  /* ---------- bilan ---------- */
  /* En-tête réservé à l'impression du bilan : logo de la banque, nom de l'agence et nom de l'outil (l'en-tête de l'écran est masqué à l'impression). */
  function enteteImpression(outil) {
    var im = document.querySelector(".logo-tuile img"), src = im ? im.getAttribute("src") : "assets/logo.png";
    return '<div class="imprime-entete"><img src="' + esc(src) + '" width="56" height="56" alt=""><div><p class="imprime-banque">GS Banque & Assurance</p><p class="imprime-agence">Agence de Paris – ' + esc(outil) + '</p></div></div>';
  }
  function vueBilan() {
    var total = totalPoints();
    var max = totalMax();
    var pc = max ? Math.round((total / max) * 100) : 0;
    var h = '<section class="bilan" aria-labelledby="t-bilan">' + enteteImpression("Mouvements atypiques") + '<h1 id="t-bilan">Bilan de la séance</h1>' +
      '<form class="identite-form identite-bilan" data-form="eleve" autocomplete="off">' +
      '<div class="champ"><label for="nom">Nom et prénom</label><input id="nom" name="nom" type="text" maxlength="60" value="' + esc(state.eleve.nom) + '"></div>' +
      '<div class="champ"><label for="classe">Classe</label><input id="classe" name="classe" type="text" maxlength="30" value="' + esc(state.eleve.classe) + '"></div>' +
      "</form>" +
      '<p class="imprime-id" id="imprime-id"></p>' +
      '<div class="bilan-tete"><div class="anneau" style="--p:' + pc + '" aria-hidden="true"><span>' + pc + ' %</span></div>' +
      '<p class="bilan-score"><strong>' + pts(total) + " sur " + max + "</strong> points, soit " + pc + " %</p></div>" +
      '<table class="bilan-table"><caption class="sr">Résultats par dossier</caption><thead><tr><th scope="col">Dossier</th><th scope="col">Client</th><th scope="col">Votre analyse</th><th scope="col">Points</th></tr></thead><tbody>';
    DOS.forEach(function (d) {
      var sc = scoreDe(d);
      var traite = estValide(d);
      var lst = "Repérage des opérations : " + sc.classement.total + " sur " + sc.classement.max + " bien classées<br>" +
        "Justificatifs demandés : " + (piecesDe(d).length ? piecesDe(d).map(function (id) { return esc(R.libellePiece(id)); }).join(" ; ") : "aucun") +
        " (" + (sc.pieces.verdict === "ok" ? "juste" : sc.pieces.verdict === "defendable" ? "défendable" : "à revoir") + ")<br>" +
        "Décision : " + (decisionDe(d) ? esc(R.libelleIssue(decisionDe(d))) : "non prise") + " (" + (sc.issue.verdict === "ok" ? "juste" : "à revoir") + ")" +
        (traite && decisionDe(d) === "declaration" ? "<br>Fiche de signalement : " + pl(controleSignal(d).totaux.n, "opération signalée", "opérations signalées") + " pour " + eur(controleSignal(d).totaux.total) : "");
      var coches = (state.checks[d.id] || []).filter(Boolean).length;
      var com = (state.comments[d.id] || "").trim();
      h += '<tr><th scope="row">' + d.id + "</th><td>" + esc(d.client.civilite + " " + d.client.nom) + "</td><td>" + (traite ? lst : "non traité") + "</td><td>" + (traite ? '<span class="chip ' + (sc.total === sc.max ? "chip-ok" : sc.total === 0 ? "chip-bad" : "chip-warn") + '">' + pts(sc.total) + " / " + sc.max + "</span>" : "non traité") + "</td></tr>";
      h += '<tr class="bilan-com"><td></td><td colspan="3"><strong>Commentaire :</strong> ' + (com ? esc(com).replace(/\n/g, "<br>") : "<em>aucun</em>") +
        (traite ? '<br><span class="bilan-auto">Éléments attendus mentionnés : ' + coches + " sur " + d.argumentaire.length + "</span>" : "") + "</td></tr>";
    });
    h += "</tbody></table>" +
      '<div class="bilan-actions"><button type="button" class="btn btn-principal" data-act="imprimer">Imprimer / enregistrer en PDF</button>' +
      '<button type="button" class="btn btn-secondaire" data-act="recommencer">Recommencer</button></div>' +
      '<p class="mention">Astuce : dans la fenêtre d\'impression, choisissez « Enregistrer au format PDF » pour remettre votre bilan.</p></section>';
    app.innerHTML = h;
    majIdentiteImprimee();
  }
  function majIdentiteImprimee() {
    var p = document.getElementById("imprime-id");
    if (!p) return;
    var parts = [];
    if (state.eleve.nom) parts.push(state.eleve.nom);
    if (state.eleve.classe) parts.push(state.eleve.classe);
    parts.push(maintenant().toLocaleDateString("fr-FR"));
    p.textContent = parts.join(", ");
  }

  /* ---------- en-tête ---------- */
  function majEntete() {
    if (state.screen === "dossier") {
      var h = '<p class="progression-texte">Dossier ' + (state.idx + 1) + " sur " + DOS.length + '</p><ol class="ticks" aria-label="Progression">';
      DOS.forEach(function (d, i) {
        var cls = estValide(d) ? "tick-fait" : i === state.idx ? "tick-courant" : "";
        h += '<li class="tick ' + cls + '"><span class="sr">Dossier ' + d.id + (estValide(d) ? " terminé" : i === state.idx ? " en cours" : " à venir") + "</span></li>";
      });
      h += '</ol><p class="progression-pts">' + pts(totalPoints()) + " point" + (totalPoints() > 1 ? "s" : "") + "</p>";
      progression.innerHTML = h;
      progression.hidden = false;
    } else {
      progression.hidden = true;
    }
    btnRecommencer.hidden = state.screen === "accueil" && state.idx === 0 && !Object.keys(state.valides).length && !Object.keys(state.contacts).length;
  }

  function render(focusMain) {
    if (state.screen === "dossier") vueDossier();
    else if (state.screen === "bilan") vueBilan();
    else vueAccueil();
    majEntete();
    sauver();
    if (focusMain) { app.focus({ preventScroll: true }); window.scrollTo(0, 0); }
  }

  /* ---------- actions ---------- */
  function contacter() {
    var d = dossierCourant();
    if (estContacte(d) || !pretContact(d)) return;
    state.contacts[d.id] = true;
    state.onglet = "decision";
    sauver();
    rafraichir();
    activerOnglet("decision", false);
    var c = document.getElementById("contact-rec");
    if (c) { c.focus({ preventScroll: true }); c.scrollIntoView({ block: "start", behavior: "smooth" }); }
  }
  function validerDossier() {
    var d = dossierCourant();
    if (estValide(d) || !pretValider(d)) return;
    state.valides[d.id] = true;
    sauver();
    rafraichir();
    majEntete();
    activerOnglet("decision", false);
    var c = document.getElementById("correction");
    if (c) { c.focus({ preventScroll: true }); c.scrollIntoView({ block: "start", behavior: "smooth" }); }
  }
  function suivant() {
    var d = dossierCourant();
    if (!estValide(d)) return;
    if (state.idx < DOS.length - 1) { state.idx += 1; state.onglet = "operations"; render(true); }
    else { state.screen = "bilan"; render(true); }
  }
  function activerOnglet(nom, focus) {
    state.onglet = nom;
    TABS.forEach(function (t) {
      var tab = document.getElementById("tab-" + t);
      var pan = document.getElementById("panneau-" + t);
      if (!tab || !pan) return;
      var actif = t === nom;
      tab.setAttribute("aria-selected", String(actif));
      tab.tabIndex = actif ? 0 : -1;
      pan.hidden = !actif;
      if (actif && focus) tab.focus();
    });
    sauver();
  }
  function recommencer() {
    if (!window.confirm("Effacer votre progression et recommencer au premier dossier ?")) return;
    var eleve = state.eleve;
    state = neuf();
    state.eleve = eleve;
    render(true);
  }
  function majGroupe(nom) {
    var radios = app.querySelectorAll('input[name="' + nom + '"]');
    for (var i = 0; i < radios.length; i++) {
      var lab = radios[i].closest("label");
      if (lab) lab.classList.toggle("est-actif", radios[i].checked);
    }
  }

  document.addEventListener("click", function (ev) {
    var t = ev.target.closest("[data-act]");
    if (!t || t.disabled) return;
    var act = t.getAttribute("data-act");
    if (act === "demarrer") { state.screen = "dossier"; render(true); }
    else if (act === "classer") {
      var d = dossierCourant();
      if (estContacte(d)) return;
      classementDe(d)[t.getAttribute("data-op")] = t.getAttribute("data-c");
      sauver();
      var ops = document.getElementById("panneau-operations");
      if (ops) ops.innerHTML = operationsHtml(d);
      majActions();
      var again = app.querySelector('[data-act="classer"][data-op="' + t.getAttribute("data-op") + '"][data-c="' + t.getAttribute("data-c") + '"]');
      if (again) again.focus();
    }
    else if (act === "contacter") contacter();
    else if (act === "valider") validerDossier();
    else if (act === "suivant") suivant();
    else if (act === "onglet") activerOnglet(t.getAttribute("data-tab"), false);
    else if (act === "mois-releve") {
      state.releveMois = parseInt(t.getAttribute("data-m"), 10);
      sauver();
      var pr = document.getElementById("panneau-releve");
      if (pr) pr.innerHTML = releveHtml(dossierCourant());
      var bm = app.querySelector('[data-act="mois-releve"][data-m="' + state.releveMois + '"]');
      if (bm) bm.focus();
    }
    else if (act === "aide") { if (boiteAide.showModal) boiteAide.showModal(); else boiteAide.setAttribute("open", ""); }
    else if (act === "fermer-aide") { if (boiteAide.close) boiteAide.close(); else boiteAide.removeAttribute("open"); }
    else if (act === "recommencer") recommencer();
    else if (act === "imprimer") window.print();
  });

  boiteAide.addEventListener("click", function (ev) {
    if (ev.target === boiteAide && boiteAide.close) boiteAide.close();
  });

  document.addEventListener("keydown", function (ev) {
    var tab = ev.target.closest && ev.target.closest('[role="tab"]');
    if (!tab) return;
    if (ev.key === "ArrowRight" || ev.key === "ArrowLeft" || ev.key === "Home" || ev.key === "End") {
      ev.preventDefault();
      var i = TABS.indexOf(tab.getAttribute("data-tab"));
      if (ev.key === "ArrowRight") i = (i + 1) % TABS.length;
      else if (ev.key === "ArrowLeft") i = (i + TABS.length - 1) % TABS.length;
      else if (ev.key === "Home") i = 0;
      else i = TABS.length - 1;
      activerOnglet(TABS[i], true);
    }
  });

  document.addEventListener("input", function (ev) {
    var t = ev.target;
    if (t.id === "commentaire") {
      var d = dossierCourant();
      state.comments[d.id] = t.value;
      var cpt = document.getElementById("com-compteur");
      if (cpt) cpt.textContent = compteurTexte(t.value.trim().length);
      if (!estValide(d)) majActions();
      if (decisionDe(d) === "declaration" && !estValide(d)) SU.maj(d, ficheDe(d), ctxSignal(d));
      sauver();
    } else if (t.hasAttribute && t.hasAttribute("data-sg")) {
      signalSaisie(t);
    } else if (t.form && t.form.getAttribute("data-form") === "eleve") {
      state.eleve[t.name] = t.value;
      sauver();
      majIdentiteImprimee();
    }
  });

  document.addEventListener("change", function (ev) {
    var t = ev.target;
    if (!t.hasAttribute) return;
    var d = dossierCourant();
    if (t.hasAttribute("data-sg")) { if (t.type !== "text") signalSaisie(t); return; }   /* un champ texte est lu à chaque frappe (événement « input ») : son événement « change », lancé à la sortie du champ, ne doit pas ressusciter une valeur effacée par un nouveau dessin */
    if (t.hasAttribute("data-piece")) {
      if (estContacte(d)) return;
      var liste = piecesDe(d);
      var id = t.getAttribute("data-piece");
      var pos = liste.indexOf(id);
      if (t.checked && pos < 0) liste.push(id);
      if (!t.checked && pos >= 0) liste.splice(pos, 1);
      var lab = t.closest("label");
      if (lab) lab.classList.toggle("est-actif", t.checked);
      sauver();
      majActions();
      return;
    }
    if (t.hasAttribute("data-decision")) {
      if (estValide(d) || !estContacte(d)) return;
      state.decisions[d.id] = t.getAttribute("data-decision");
      sauver();
      majGroupe("decision");
      majSignalZone();
      majActions();
      return;
    }
    if (t.hasAttribute("data-check")) {
      var arr = state.checks[d.id] || [];
      arr[parseInt(t.getAttribute("data-check"), 10)] = t.checked;
      for (var i = 0; i < d.argumentaire.length; i++) arr[i] = !!arr[i];
      state.checks[d.id] = arr;
      var n = arr.filter(Boolean).length;
      var tot = document.getElementById("autoeval-total");
      if (tot) tot.textContent = n + " élément" + (n > 1 ? "s" : "") + " sur " + d.argumentaire.length + " mentionné" + (n > 1 ? "s" : "") + ".";
      sauver();
    }
  });

  window.addEventListener("beforeprint", majIdentiteImprimee);

  render(false);
})();
