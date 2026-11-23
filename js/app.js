/* GS Banque & Assurance – interface du simulateur (JavaScript sans dépendance). */
(function () {
  "use strict";

  var R = window.SGBF.rules;
  var B = window.SGBF.banque;
  var DOS = window.SGBF.dossiers;
  var REL = window.SGBF.releves || {};
  var NOTES = window.SGBF.notes;
  var INJ = window.SGBF.injonction, IMP = window.SGBF.impression, ID = window.SGBF.identite;
  var KEY = "sgbf-simulateur-v3";
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
    return { v: 4, jour: JOUR, screen: "accueil", idx: 0, decisions: {}, opps: {}, comments: {}, valides: {}, checks: {}, eleve: { nom: "", classe: "" }, onglet: "operations", mois: 0 };
  }
  function charger() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { s = null; /* stockage indisponible : on repart de zéro */ }
    if (s && s.v === 4 && s.jour === JOUR && typeof s.idx === "number" && s.idx >= 0 && s.idx < DOS.length) {
      if (typeof s.mois !== "number" || s.mois < 0 || s.mois > 2) s.mois = 0;
      if (["operations", "releve", "opportunite", "commentaire"].indexOf(s.onglet) < 0) s.onglet = "operations";
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
  var nfEur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
  var nfPts = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  function eur(n) { return nfEur.format(n).replace("-", "−"); }
  function pts(n) { return nfPts.format(n); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function dateDecalee(jours) {
    var d = maintenant();
    d.setDate(d.getDate() + jours);
    return d.toLocaleDateString("fr-FR");
  }
  function pl(n, s, p) { return n + " " + (n > 1 ? p : s); }
  /* Date réelle d'une opération à valider : « {date} » est remplacé par le jour de l'exercice moins joursAvant. */
  function detailOperation(o) {
    var t = o.detail || "";
    if (typeof o.joursAvant === "number") t = t.replace("{date}", dateDecalee(-o.joursAvant));
    return t;
  }
  function dansJours(n) { return n === 1 ? "demain" : "dans " + n + " jours"; }
  function initiales(c) { return (c.prenom.charAt(0) + c.nom.charAt(0)).toUpperCase(); }
  function noteInfo(code) { return NOTES.filter(function (n) { return n.code === code; })[0]; }
  function noteClasse(code) { return code === "Défaut" ? "defaut" : code.toLowerCase(); }
  var TYPES = { carte: "Carte", cheque: "Chèque", prelevement: "Prélèvement" };

  var ICON = {
    carte: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6 15h4"/></svg>',
    cheque: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="6" width="19" height="12" rx="1.5"/><path d="M6 10h8M6 13.5h5"/><path d="M14 16c1-2.2 2-2.2 2.6-.6s1.4 1 2-.6"/></svg>',
    prelevement: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5v11"/><path d="M7.5 10.5 12 15l4.5-4.5"/><path d="M4 19h16"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    alert: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 21 20H3L12 4z"/><path d="M12 10v4M12 17h.01"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    cross: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/></svg>'
  };

  function dossierCourant() { return DOS[state.idx]; }
  function decisionsDe(d) {
    if (!state.decisions[d.id]) state.decisions[d.id] = {};
    return state.decisions[d.id];
  }
  function estValide(d) { return !!state.valides[d.id]; }
  function toutDecide(d) {
    var dec = decisionsDe(d);
    return R.operationsADecider(d).every(function (o) { return !!dec[o.id]; });
  }
  function choixOpp(d) { return (state.opps && state.opps[d.id]) || null; }
  function commentaireOk(d) { return R.commentaireSuffisant(state.comments[d.id]); }
  /* Valider n'est possible que si tout est décidé, l'opportunité choisie et le commentaire rédigé. */
  function pret(d) { return toutDecide(d) && !!choixOpp(d) && commentaireOk(d); }
  function scoreDe(d) { return R.scoreDossier(d, decisionsDe(d), choixOpp(d)); }
  function totalMax() {
    return DOS.reduce(function (t, d) { return t + R.operationsADecider(d).length + 1; }, 0);
  }
  function totalPoints() {
    return DOS.reduce(function (t, d) { return t + (estValide(d) ? scoreDe(d).total : 0); }, 0);
  }
  var TABS = ["operations", "releve", "opportunite", "commentaire"];
  function compteurTexte(n) {
    return n < R.COMMENTAIRE_MIN
      ? n + " caractères : encore " + (R.COMMENTAIRE_MIN - n) + " pour pouvoir valider (minimum " + R.COMMENTAIRE_MIN + ")."
      : n + " sur " + MAX_COM + " caractères.";
  }

  /* ---------- éléments d'interface ---------- */
  function chipEtat(e) {
    if (e.code === "crediteur") return '<span class="chip chip-ok">' + ICON.check + "Compte créditeur</span>";
    if (e.code === "autorise") return '<span class="chip chip-warn">' + ICON.info + "Débiteur dans l'autorisation</span>";
    return '<span class="chip chip-bad">' + ICON.alert + "État des débiteurs, dépassement de " + eur(e.depassement) + "</span>";
  }
  function classeMontant(solde) { return solde < 0 ? "neg" : "pos"; }

  /* s1 = solde projeté, uniquement fourni après validation du dossier (sinon null) */
  function jauge(s0, s1, aut) {
    var apres = s1 !== null && s1 !== undefined;
    var lo = Math.min(s0, apres ? s1 : s0, -aut);
    var hi = Math.max(s0, apres ? s1 : s0, 0);
    var pad = Math.max((hi - lo) * 0.12, 40);
    lo -= pad; hi += pad;
    function p(x) { return ((x - lo) / (hi - lo)) * 100; }
    function bornee(x) { return Math.min(Math.max(p(x), 10), 90); }
    var pAut = p(-aut), pZero = p(0);
    var seg = '<span class="zone zone-bad" style="left:0;width:' + pAut.toFixed(2) + '%"></span>';
    if (aut > 0) seg += '<span class="zone zone-warn" style="left:' + pAut.toFixed(2) + '%;width:' + (pZero - pAut).toFixed(2) + '%"></span>';
    seg += '<span class="zone zone-ok" style="left:' + pZero.toFixed(2) + '%;width:' + (100 - pZero).toFixed(2) + '%"></span>';
    var texte = "Solde actuel " + eur(s0) + (apres ? ", solde après vos décisions " + eur(s1) : "") + (aut > 0 ? ", autorisation de découvert " + eur(aut) : ", pas d'autorisation de découvert") + ".";
    var leg = '<li class="leg leg-ok">Créditeur : solde de 0 € ou plus</li>';
    if (aut > 0) leg += '<li class="leg leg-warn">Dans l\'autorisation : jusqu\'à ' + eur(-aut) + "</li>";
    leg += '<li class="leg leg-bad">État des débiteurs : ' + (aut > 0 ? "au-delà de " + eur(-aut) : "dès que le solde est négatif") + "</li>";
    return '<div class="jauge" role="img" aria-label="' + esc(texte) + '">' +
      '<div class="jauge-haut"><span class="rep rep-now" style="left:' + bornee(s0).toFixed(2) + '%">Maintenant</span></div>' +
      '<div class="piste">' + seg +
      '<span class="marque-pos marque-now" style="left:' + p(s0).toFixed(2) + '%"></span>' +
      (apres ? '<span class="marque-pos marque-apres" style="left:' + p(s1).toFixed(2) + '%"></span>' : "") + "</div>" +
      (apres ? '<div class="jauge-bas"><span class="rep rep-apres" style="left:' + bornee(s1).toFixed(2) + '%">Après vos décisions</span></div>' : "") +
      "</div>" +
      '<ul class="legende">' + leg + "</ul>";
  }

  /* ---------- accueil ---------- */
  function vueAccueil() {
    var enCours = state.idx > 0 || Object.keys(state.valides).length > 0;
    var h = '<section class="accueil" aria-labelledby="t-accueil">' +
      '<h1 id="t-accueil">Payer ou rejeter ?</h1>' +
      '<p class="chapeau">Vous êtes Conseiller Clientèle Particuliers à GS Banque & Assurance. Chaque jour, des chèques, des prélèvements et des paiements par carte se présentent sur les comptes de vos clients. Vous décidez de ce qui est payé et de ce qui est rejeté.</p>' +
      '<ol class="etapes">' +
      "<li><strong>Analysez le dossier.</strong> Lisez la fiche du client, sa note Bâle, la position du compte, ses rejets des 12 derniers mois et, dans l'onglet « Relevé de compte », ses opérations des trois derniers mois.</li>" +
      "<li><strong>Décidez.</strong> Pour chaque chèque et chaque prélèvement, choisissez Payer ou Rejeter. Un paiement par carte ne se rejette pas : il se valide.</li>" +
      "<li><strong>Détectez l'opportunité commerciale.</strong> Dans l'onglet du même nom, choisissez : montée en gamme de carte bancaire, mise en place d'un découvert, augmentation du découvert, mise en place d'un crédit consommation, ou aucune opportunité.</li>" +
      "<li><strong>Motivez, validez, passez au suivant.</strong> Le commentaire est obligatoire. Rédigez-le, cliquez sur Valider pour voir la correction, puis sur Suivant.</li>" +
      "</ol>" +
      '<form class="identite-form" data-form="eleve" autocomplete="off">' +
      '<div class="champ"><label for="nom">Nom et prénom</label><input id="nom" name="nom" type="text" maxlength="60" value="' + esc(state.eleve.nom) + '"></div>' +
      '<div class="champ"><label for="classe">Classe</label><input id="classe" name="classe" type="text" maxlength="30" value="' + esc(state.eleve.classe) + '"></div>' +
      '<p class="mention champ-large">Facultatif : ces informations apparaissent sur le bilan imprimé. Elles restent sur cet appareil.</p>' +
      "</form>" +
      suspensHtml() +
      '<div class="accueil-actions">' +
      '<button type="button" class="btn btn-principal" data-act="demarrer">' + (enCours ? "Reprendre au dossier " + (state.idx + 1) : "Commencer") + "</button>" +
      "</div>" +
      '<p class="mention">' + libelleJour() + " : " + DOS.length + " dossiers, " + totalMax() + " points à gagner : une décision par chèque ou prélèvement, plus une opportunité commerciale par dossier.</p>" +
      "</section>";
    app.innerHTML = h;
  }

  /* ---------- dossier ---------- */
  /* Mentions du dossier : OCF, SC, FCP, DAC */
  function mentionsHtml(d) {
    var c = d.client, li = [];
    if (c.fragile) li.push('<li><span class="code code-ocf">OCF</span><span><strong>Offre clientèle fragile.</strong> Commission d\'intervention de ' + eur(R.COMMISSION_OCF_PAR_OPERATION) + " par opération (" + eur(R.COMMISSION_OCF_PAR_MOIS) + " par mois au maximum), ensemble des frais d'incidents plafonné à " + eur(R.PLAFOND_OCF_PAR_MOIS) + " par mois.</span></li>");
    if (d.controle) li.push('<li><span class="code code-sc">SC</span><span><strong>Compte sous contrôle</strong> : ' + esc(d.controle.motif) + ". Le compte n'est pas à l'état des débiteurs : le conseiller le surveille.</span></li>");
    if (c.ficp) li.push('<li><span class="code code-fcp">FCP</span><span><strong>Client fiché au FICP</strong> (fichier des incidents de remboursement des crédits aux particuliers).</span></li>');
    if (c.dac) li.push('<li><span class="code code-dac">DAC</span><span><strong>Droit au compte.</strong> Services bancaires de base : carte à autorisation systématique, ni découvert ni chéquier.</span></li>');
    return li.length ? '<ul class="mentions" aria-label="Mentions du dossier">' + li.join("") + "</ul>" : "";
  }
  function codesDe(d) {
    var k = [];
    if (d.client.fragile) k.push("OCF");
    if (d.controle) k.push("SC");
    if (d.client.ficp) k.push("FCP");
    if (d.client.dac) k.push("DAC");
    return k;
  }

  function blocClient(d) {
    var c = d.client;
    var depuis = c.ancienneteMois ? pl(c.ancienneteMois, "mois", "mois") : pl(c.ancienneteAns, "an", "ans");
    var h = '<section class="bloc" aria-labelledby="h-client"><h2 id="h-client">Dossier client</h2>' +
      '<div class="identite"><span class="avatar" aria-hidden="true">' + esc(initiales(c)) + "</span><div>" +
      '<p class="nom">' + esc(c.civilite + " " + c.prenom + " " + c.nom) + "</p>" +
      '<p class="sous">' + c.age + " ans, " + esc(c.profession) + "</p></div></div>" +
      mentionsHtml(d) +
      '<dl class="fiche">' +
      "<dt>Situation</dt><dd>" + esc(c.situation) + "</dd>" +
      "<dt>Client depuis</dt><dd>" + depuis + "</dd>" +
      "<dt>Revenus mensuels</dt><dd>" + eur(c.revenus) + " (" + esc(c.revenusNote) + ")</dd>" +
      "<dt>Produits</dt><dd>" + esc(c.produits.join(", ")) + "</dd>" +
      "<dt>Compte n°</dt><dd>" + esc(c.compte) + "</dd>" +
      (d.observations ? "<dt>Observations</dt><dd>" + d.observations.map(esc).join("<br>") + "</dd>" : "") +
      "</dl>" +
      "</section>";
    return h;
  }

  function blocBale(d) {
    var n = noteInfo(d.note);
    var echelle = NOTES.map(function (x) {
      var actif = x.code === d.note;
      return '<li class="cran note-' + noteClasse(x.code) + (actif ? " cran-actif" : "") + '"' + (actif ? ' aria-current="true"' : "") + ">" + esc(x.code) + "</li>";
    }).join("");
    return '<section class="bloc" aria-labelledby="h-bale"><h2 id="h-bale">Note Bâle</h2>' +
      '<div class="bale-ligne"><span class="note-grande note-' + noteClasse(d.note) + '">' + esc(d.note) + "</span><div>" +
      '<p class="bale-lib">' + esc(n.libelle) + '</p><p class="bale-desc">' + esc(n.description) + "</p></div></div>" +
      '<ol class="echelle" aria-label="Échelle de la note Bâle, de A à Défaut">' + echelle + "</ol>" +
      '<p class="mention">Échelle interne de GS Banque & Assurance.</p></section>';
  }

  /* ICC (Indice de Commercialité Client) : sous la note Bâle ; il se lit sur les produits du dossier. */
  function blocIcc(d) {
    var I = window.SGBF.icc, V = window.SGBF.iccVue;
    return I && V ? V.bloc(I.depuisDossier(d), { id: "icc" }) : "";
  }

  function blocAntecedents(d) {
    var syn = R.syntheseAntecedents(d);
    var h = '<section class="bloc" aria-labelledby="h-ant"><h2 id="h-ant">Rejets sur 12 mois</h2>';
    if (!syn.nombre) {
      return h + '<p class="ant-vide">' + ICON.check + "Aucun rejet sur les 12 derniers mois.</p></section>";
    }
    h += '<p class="ant-resume"><strong>' + pl(syn.nombre, "rejet", "rejets") + "</strong>, frais de rejet cumulés : " + eur(syn.frais) + "</p>";
    h += '<ul class="ant-liste">';
    d.antecedents.slice().sort(function (a, b) { return a.joursAvant - b.joursAvant; }).forEach(function (a) {
      h += "<li><span class=\"ant-date\">" + dateDecalee(-a.joursAvant) + "</span>" +
        '<span class="ant-lib"><strong>' + TYPES[a.type] + "</strong> de " + eur(a.montant) + "<br>" + esc(a.libelle) + "</span>" +
        '<span class="ant-motif">Provision insuffisante. Frais : ' + eur(R.fraisRejetClient(d, a)) + "</span></li>";
    });
    return h + '</ul><p class="mention">Frais calculés au plafond réglementaire' + (d.client.fragile ? " ; offre clientèle fragile : " + eur(R.PLAFOND_OCF_PAR_MOIS) + " par mois au maximum pour l'ensemble des frais d'incidents" : "") + ".</p></section>";
  }

  /* Avant validation, aucune projection n'est affichée : l'élève calcule lui-même. */
  function blocPosition(d) {
    var valide = estValide(d);
    var proj = valide ? R.projeter(d, decisionsDe(d)) : null;
    var sim = valide ? R.toutPayer(d) : null;
    var p = d.position;
    var e0 = R.etat(p.solde, p.autorisation);
    var dispo = R.arrondi(p.solde + p.autorisation);
    var credit = p.creditAttendu
      ? esc(p.creditAttendu.libelle) + " de " + eur(p.creditAttendu.montant) + " le " + dateDecalee(p.creditAttendu.dansJours) + " (" + dansJours(p.creditAttendu.dansJours) + ")"
      : "Aucun crédit attendu";
    var h = '<h2 id="h-pos">Position du compte</h2>' +
      '<dl class="chiffres">' +
      '<div><dt>Solde actuel</dt><dd class="' + classeMontant(p.solde) + '">' + eur(p.solde) + "</dd></div>" +
      "<div><dt>Autorisation de découvert</dt><dd>" + (p.autorisation > 0 ? eur(p.autorisation) : "Aucune") + "</dd></div>" +
      "<div><dt>Disponible</dt><dd class=\"" + classeMontant(dispo) + '">' + eur(dispo) + "</dd></div>" +
      "</dl>" +
      '<p class="credit">' + ICON.info + "<span><strong>Crédit attendu :</strong> " + credit + "</span></p>" +
      (p.debiteurDepuis ? '<p class="depuis">' + ICON.alert + "À l'état des débiteurs depuis " + pl(p.debiteurDepuis, "jour", "jours") + "</p>" : "") +
      '<div class="etat-actuel">Position actuelle : ' + chipEtat(e0) +
        (d.controle ? ' <span class="chip chip-ctrl">' + ICON.eye + "Compte sous contrôle (SC)</span>" : "") + "</div>" +
      jauge(p.solde, valide ? proj.soldeFinal : null, p.autorisation) +
      (valide
        ? '<div class="apres">' +
          '<p class="apres-ligne"><span>Solde après vos décisions</span> <strong class="montant-grand ' + classeMontant(proj.soldeFinal) + '">' + eur(proj.soldeFinal) + "</strong></p>" +
          "<p>" + chipEtat(proj.etat) + "</p>" +
          '<p class="sim">Si tout avait été payé : ' + eur(sim.soldeFinal) + " (" + etatTexte(sim.etat) + ").</p>" +
          "</div>"
        : "");
    return h;
  }
  function etatTexte(e) {
    if (e.code === "crediteur") return "compte créditeur";
    if (e.code === "autorise") return "dans l'autorisation";
    return "état des débiteurs";
  }

  function ligneOperation(l, d, valide, notation) {
    var o = l.op;
    var forcee = R.estNonRejetable(o);
    var dec = decisionsDe(d)[o.id] || null;
    var h = '<li class="op' + (l.decision === "rejeter" ? " op-rejetee" : "") + '" data-op="' + o.id + '">' +
      '<div class="op-type"><span class="op-ico">' + ICON[o.type] + "</span>" + TYPES[o.type] + "</div>" +
      '<div class="op-corps"><p class="op-lib">' + esc(o.libelle) + '</p><p class="op-det">' + esc(detailOperation(o)) + "</p></div>" +
      '<p class="op-montant">' + "−" + eur(o.montant) + "</p>";
    if (forcee) {
      var motif = o.type === "carte" ? "Carte : ordre irrévocable, à valider" : "Chèque de 15 € ou moins : paiement obligatoire";
      h += '<p class="op-verrou">' + ICON.lock + (o.type === "carte" ? "Validée" : "Payée") + '<span class="op-verrou-motif">' + motif + "</span></p>";
    } else {
      h += '<div class="op-choix" role="group" aria-label="Décision pour ' + esc(o.libelle) + '">' +
        bouton(o, "payer", "Payer", dec, valide) + bouton(o, "rejeter", "Rejeter", dec, valide) + "</div>";
    }
    // suite : effet sur le solde, affiché seulement dans la correction
    var suite = "";
    if (!valide) {
      suite = "";
    } else if (l.decision === "payer") {
      suite = "Solde après l'opération : <strong class=\"" + classeMontant(l.soldeApres) + '">' + eur(l.soldeApres) + "</strong> " + chipEtat(l.etat);
      if (l.etat.code === "etat_debiteurs") {
        var com = R.commissionClient(d);
        suite += '<br><span class="op-frais">Paiement en irrégularité : commission d\'intervention de ' + eur(com.parOperation) + " (" + eur(com.parMois) + " par mois au maximum)" +
          (d.client.fragile ? ", offre clientèle fragile : ensemble des frais d'incidents plafonné à " + eur(R.PLAFOND_OCF_PAR_MOIS) + " par mois" : "") + ".</span>";
      }
    } else if (l.decision === "rejeter") {
      suite = "Opération rejetée : le solde reste " + "<strong class=\"" + classeMontant(l.soldeApres) + '">' + eur(l.soldeApres) + "</strong>. Frais de rejet : " + eur(R.fraisRejetClient(d, o)) + (o.type === "cheque" && !d.client.fragile ? "" : " au maximum") +
        (d.client.fragile ? " (offre clientèle fragile : ensemble des frais d'incidents plafonné à " + eur(R.PLAFOND_OCF_PAR_MOIS) + " par mois)" : "") + ".";
    } else {
      suite = "Aucune décision enregistrée.";
    }
    if (suite) h += '<p class="op-suite">' + suite + "</p>";
    if (valide) {
      if (!forcee) {
        var det = notation.details.filter(function (x) { return x.id === o.id; })[0];
        if (det.verdict === "ok") h += '<p class="verdict verdict-ok">' + ICON.check + "Bonne décision (1 point)</p>";
        else if (det.verdict === "defendable") h += '<p class="verdict verdict-def">' + ICON.info + "Décision défendable (0,5 point). Attendu : " + (o.attendu === "payer" ? "payer" : "rejeter") + "</p>";
        else h += '<p class="verdict verdict-ko">' + ICON.cross + "À revoir (0 point). Attendu : " + (o.attendu === "payer" ? "payer" : "rejeter") + "</p>";
      }
      h += '<p class="op-expl">' + esc(o.explication) + "</p>";
      if (l.decision === "rejeter" && !forcee) h += blocInjonction(d, o);
    }
    return h + "</li>";
  }

  /* ---------- procédure MURCEF : information du titulaire, chèque en suspens, lettre d'injonction ----------
     Un chèque rejeté pour défaut de provision (compte à l'état des débiteurs) suit la procédure MURCEF ; si la position du compte permettait de le payer, le rejet n'est pas fondé et aucune procédure n'existe.
     1. le conseiller informe le titulaire avant le rejet (courrier, appel téléphonique ou e-mail) ; 2. le chèque est mis en suspens 5 jours ouvrés, jusqu'à 12 h le dernier jour (règle de l'agence, la loi n'en fixe pas) ;
     3. faute de régularisation, la lettre d'injonction part en recommandé : le conseiller en valide l'envoi une fois l'échéance atteinte.
     La procédure est enregistrée dans la sauvegarde partagée de la banque, pas dans celle de l'exercice du jour : l'échéance tombe un autre jour de travail (injonction.js : etat, informer, valider). */
  function procs() { var st = B.store.charger(); if (!st.murcef || typeof st.murcef !== "object" || Array.isArray(st.murcef)) st.murcef = {}; return st.murcef; }
  function cleProc(inst) { return JOUR + ":" + inst.dossier + ":" + inst.operation; }
  function dateFr(t) { var d = INJ.lireDate(t); return d ? d.toLocaleDateString("fr-FR") : ""; }
  function echeanceDe(proc) { return INJ.echeanceLongue(INJ.lireDate(proc.info.echeance)); }
  function aMoyen(proc, code) { return proc.info.moyens.indexOf(code) >= 0; }
  function qualiteLibelle(code) { var q = INJ.QUALITES.filter(function (x) { return x.code === code; })[0]; return q ? q.libelle : ""; }

  function blocInjonction(d, o) {
    if (!INJ || o.type !== "cheque") return "";
    var inst = INJ.instantane(d, o, decisionsDe(d));
    if (!inst.ok) return '<p class="inj-note">' + ICON.info + "<span><strong>Pas de procédure MURCEF.</strong> " + esc(inst.raison) + "</span></p>";
    var cle = cleProc(inst), proc = procs()[cle], et = INJ.etat(proc, maintenant()), num = esc(inst.cheque);
    var h = '<div class="inj-bloc" role="group" aria-label="Procédure MURCEF du chèque ' + num + '">' +
      "<p><strong>Procédure MURCEF : chèque rejeté pour défaut de provision.</strong> La banque informe le titulaire avant de rejeter le chèque ; sans régularisation, elle lui notifie par lettre d'injonction l'interdiction d'émettre des chèques pendant cinq ans et l'inscrit au fichier central des chèques (FCC) de la Banque de France.</p>" +
      '<ol class="inj-etapes">';
    /* 1. information du titulaire */
    h += '<li class="inj-etape' + (proc ? " inj-fait" : "") + '"><p class="inj-etape-t"><strong>1. Informer le titulaire.</strong> ' +
      (proc ? "Titulaire informé le " + esc(dateFr(proc.info.date)) + " (" + esc(INJ.moyensTexte(proc.info)) + ")." : "À faire : la loi impose d'informer le titulaire avant le rejet, par courrier, appel téléphonique ou e-mail, au choix du conseiller.") + "</p>" +
      '<div class="inj-btns">' +
      (proc ? (aMoyen(proc, "courrier") ? '<button type="button" class="btn btn-secondaire" data-act="inf-pdf" data-cle="' + esc(cle) + '">Éditer à nouveau le courrier d\'information</button>' : "")
            : '<button type="button" class="btn btn-principal" data-act="inf-ouvrir" data-op="' + esc(o.id) + '">Informer le titulaire</button>') + "</div></li>";
    /* 2. chèque en suspens */
    h += '<li class="inj-etape' + (et === "en_suspens" ? " inj-encours" : proc ? " inj-fait" : "") + '"><p class="inj-etape-t"><strong>2. Chèque en suspens.</strong> ' +
      (proc ? (et === "en_suspens" ? "Le titulaire peut régulariser jusqu'au <strong>" + esc(echeanceDe(proc)) + "</strong>." : "Échéance atteinte : " + esc(echeanceDe(proc)) + ".")
            : "Après l'information, le chèque est mis en suspens 5 jours ouvrés (hors week-end et jours fériés), jusqu'à 12 h le dernier jour. Ce délai est celui de l'agence : la loi n'en fixe pas.") + "</p></li>";
    /* 3. lettre d'injonction */
    var texte3, btn3 = "";
    if (et === "envoyee") {
      texte3 = "Envoi validé le " + esc(dateFr(proc.injonction.date)) + " – " + esc(qualiteLibelle(proc.injonction.qualite)) + ".";
      btn3 = '<button type="button" class="btn btn-secondaire" data-act="injonction" data-cle="' + esc(cle) + '">Éditer à nouveau le PDF</button>';
    } else if (et === "a_valider") {
      texte3 = "L'échéance est passée : si le titulaire n'a pas régularisé sa situation, validez l'envoi de la lettre.";
      btn3 = '<button type="button" class="btn btn-principal" data-act="injonction" data-cle="' + esc(cle) + '">Visualiser la lettre d\'injonction</button>';
    } else if (et === "en_suspens") {
      texte3 = "Cette lettre est envoyée si le titulaire ne régularise pas sa situation avant le " + esc(echeanceDe(proc)) + ". Vous pourrez en valider l'envoi à partir de cette échéance.";
      btn3 = '<button type="button" class="btn btn-secondaire" data-act="injonction" data-cle="' + esc(cle) + '">Visualiser la lettre d\'injonction</button>';
    } else {
      texte3 = "Cette lettre est envoyée en recommandé avec avis de réception si le titulaire ne régularise pas sa situation avant l'échéance. Elle se visualise une fois le titulaire informé.";
    }
    h += '<li class="inj-etape' + (et === "envoyee" ? " inj-fait" : "") + '"><p class="inj-etape-t"><strong>3. Lettre d\'injonction MURCEF.</strong> ' + texte3 + "</p>" + (btn3 ? '<div class="inj-btns">' + btn3 + "</div>" : "") + "</li>";
    return h + "</ol></div>";
  }

  var dlgInj = null, injCtx = null, injOuvreur = null;
  function dossierDe(id) { return DOS.filter(function (x) { return x.id === id; })[0]; }
  /* Aperçu à l'écran : la signature de la lettre porte le nom de l'élève s'il est connu (à l'impression, identite.js l'inscrit au même endroit). */
  function habiller(html) {
    var n = ID && ID.nomCourant ? ID.nomCourant() : "";
    return html.replace(/<span data-eleve><\/span>/g, n ? esc(n) : '<span class="inj-nom-vide">votre nom</span>');
  }
  /* En-tête du courrier à l'écran : le papier à en-tête du PDF (logo, nom de la banque, adresse de l'agence), le même que dans « Courriers et documents ». */
  function enteteCourrier() { return IMP && IMP.enteteLettre ? IMP.enteteLettre() : ""; }
  function apercuInjonction() {
    var proc = procs()[injCtx.cle], q = document.getElementById("inj-qualite");
    var l = INJ.lettreDepuis(proc.inst, { date: injCtx.dateEnvoi, qualite: q ? q.value : "individuel" });
    return l.ok ? enteteCourrier() + habiller(INJ.document(l).corps) : "";
  }
  function fermerInjonction() {
    if (!dlgInj) return;
    if (dlgInj.open) { if (dlgInj.close) dlgInj.close(); else dlgInj.removeAttribute("open"); }
  }
  function erreurInjonction(msg, champ) {
    var e = document.getElementById("inj-err");
    e.textContent = msg || "";
    if (msg && champ) champ.focus();
  }
  function fenetre(ouvreur) {
    injOuvreur = ouvreur;
    if (!dlgInj) {
      dlgInj = document.createElement("dialog");
      dlgInj.id = "dlg-injonction"; dlgInj.className = "inj-dlg";
      dlgInj.setAttribute("aria-labelledby", "inj-titre");
      document.body.appendChild(dlgInj);
      dlgInj.addEventListener("close", function () { if (injOuvreur && document.contains(injOuvreur)) { try { injOuvreur.focus(); } catch (e) { /* ignoré */ } } });
      dlgInj.addEventListener("click", function (ev) { if (ev.target === dlgInj) fermerInjonction(); });
    }
    return dlgInj;
  }
  function montrer() { if (dlgInj.showModal) { if (!dlgInj.open) dlgInj.showModal(); } else dlgInj.setAttribute("open", ""); }
  function resumeCheque(l) {
    return "Chèque n° " + esc(l.cheque) + " de " + esc(INJ.montant(l.montantCheque)) + " (" + esc(l.beneficiaire) + "). Solde disponible du compte : " + esc(INJ.montant(l.disponible)) + ". Frais de rejet : " + esc(INJ.montant(l.frais)) + ".";
  }
  /* Rappel de la règle de délai, avec la date calculée toute seule. */
  function rappelDelai(echeance, passee) {
    return '<p class="inj-delai" role="note"><strong>' + (passee ? "Échéance atteinte : " : "Date limite de régularisation : ") + esc(INJ.echeanceLongue(echeance)) + ".</strong> Le chèque est mis en suspens 5 jours ouvrés (hors week-end et jours fériés), jusqu'à 12 h le dernier jour ; le jour de l'information n'est pas compté. Ce délai est celui de l'agence : la loi n'en fixe pas.</p>";
  }

  /* --- étape 1 : information du titulaire --- */
  function ouvrirInformation(d, o, ouvreur) {
    var inst = INJ.instantane(d, o, decisionsDe(d));
    if (!inst.ok) return;
    var now = maintenant(), l = INJ.information(inst, { date: now });
    injCtx = { type: "info", cle: cleProc(inst), inst: inst };
    var moyens = INJ.MOYENS.map(function (m) { return '<li><label class="inj-verif"><input type="checkbox" name="inf-moyen" value="' + m.code + '"> <span>' + esc(m.libelle) + "</span></label></li>"; }).join("");
    fenetre(ouvreur).innerHTML = '<form class="inj-corps" id="inj-form" novalidate>' +
      '<div class="inj-tete"><h2 id="inj-titre">Informer le titulaire – ' + esc(l.destinataire.nom) + '</h2><button type="button" class="btn btn-secondaire btn-petit" data-inj="fermer">Fermer</button></div>' +
      '<p class="inj-resume">' + resumeCheque(l) + "</p>" + rappelDelai(l.echeanceObj, false) +
      '<fieldset class="inj-verifs"><legend>Comment informez-vous le titulaire ? Cochez au moins un moyen.</legend><ul>' + moyens + "</ul>" +
      '<p class="aide-champ" id="inf-aide">La loi laisse le choix du moyen (« tout moyen approprié »). Le courrier est édité en PDF à la validation ; un appel ou un e-mail est noté dans la procédure.</p></fieldset>' +
      '<p class="msg-erreur" id="inj-err" role="alert"></p>' +
      '<div class="inj-btns"><button type="submit" class="btn btn-principal">Valider l\'information du titulaire</button><button type="button" class="btn btn-secondaire" data-inj="fermer">Annuler</button></div>' +
      '<h3 class="inj-apercu-titre" id="inj-apercu-titre">Courrier d\'information (1 page)</h3>' +
      '<div class="apercu-doc inj-apercu" id="inj-apercu" role="region" tabindex="0" aria-labelledby="inj-apercu-titre">' + enteteCourrier() + habiller(INJ.htmlInformation(l)) + "</div></form>";
    var f = document.getElementById("inj-form");
    f.addEventListener("submit", function (ev) { ev.preventDefault(); validerInformation(); });
    f.addEventListener("click", function (ev) { var b = ev.target.closest("[data-inj]"); if (b) fermerInjonction(); });
    f.addEventListener("change", function () { if (document.getElementById("inj-err").textContent) erreurInjonction(""); });
    montrer();
    document.querySelector('#inj-form input[name="inf-moyen"]').focus();
  }
  function validerInformation() {
    var cases = [].slice.call(document.querySelectorAll('#inj-form input[name="inf-moyen"]'));
    var choisis = cases.filter(function (c) { return c.checked; }).map(function (c) { return c.value; });
    var r = INJ.informer(procs(), injCtx.cle, injCtx.inst, choisis, maintenant());
    if (!r.ok) { erreurInjonction(r.erreur, cases[0]); return; }
    B.store.sauver();
    var cle = injCtx.cle;
    fermerInjonction();
    majProcedures();
    if (r.proc.info.moyens.indexOf("courrier") >= 0) editerInformation(cle);
    var b = app.querySelector('[data-act="injonction"][data-cle="' + cle + '"], [data-act="inf-pdf"][data-cle="' + cle + '"]');
    if (b) b.focus();
  }

  /* --- étape 3 : lettre d'injonction --- */
  function ouvrirInjonction(cle, ouvreur) {
    var proc = procs()[cle];
    if (!proc || !proc.info) return;
    var now = maintenant(), ech = INJ.lireDate(proc.info.echeance), due = INJ.etat(proc, now) === "a_valider";
    var l = INJ.lettreDepuis(proc.inst, { date: due ? now : ech, qualite: "individuel" });
    if (!l.ok) return;
    /* l'aperçu porte la date prévue de l'envoi : l'échéance tant qu'elle n'est pas atteinte, puis le jour même */
    injCtx = { type: "inj", cle: cle, dateEnvoi: due ? now : ech };
    var opts = INJ.QUALITES.map(function (q) { return '<option value="' + q.code + '">' + esc(q.libelle) + "</option>"; }).join("");
    var verifs = INJ.VERIFICATIONS.map(function (v) { return '<li><label class="inj-verif"><input type="checkbox" name="inj-verif" value="' + v.id + '"> <span>' + esc(v.libelle) + "</span></label></li>"; }).join("");
    fenetre(ouvreur).innerHTML = '<form class="inj-corps" id="inj-form" novalidate>' +
      '<div class="inj-tete"><h2 id="inj-titre">Lettre d\'injonction MURCEF – ' + esc(l.destinataire.nom) + '</h2><button type="button" class="btn btn-secondaire btn-petit" data-inj="fermer">Fermer</button></div>' +
      '<p class="inj-resume">' + resumeCheque(l) + " Titulaire informé le " + esc(dateFr(proc.info.date)) + " (" + esc(INJ.moyensTexte(proc.info)) + ").</p>" +
      '<p class="inj-delai" role="note"><strong>' + (due ? "L'échéance est atteinte (" + esc(echeanceDe(proc)) + "). " : "Cette lettre est envoyée si le titulaire ne régularise pas sa situation avant le " + esc(echeanceDe(proc)) + ". ") + "</strong>" +
        (due ? "Si le titulaire n'a pas régularisé sa situation, validez l'envoi : la lettre part en recommandé avec avis de réception."
             : "Le chèque est en suspens jusqu'à cette échéance (5 jours ouvrés, hors week-end et jours fériés, jusqu'à 12 h). Vous pourrez valider l'envoi à partir de ce moment ; l'aperçu porte la date prévue d'envoi.") + "</p>" +
      '<div class="champ"><label for="inj-qualite">Qualité du destinataire</label><select id="inj-qualite" aria-describedby="inj-qualite-aide">' + opts + "</select>" +
      '<p class="aide-champ" id="inj-qualite-aide">Titulaire seul, cotitulaire sans responsable désigné, ou responsable désigné d\'un compte collectif : le texte de la lettre s\'adapte.</p></div>' +
      (due ? '<fieldset class="inj-verifs"><legend>Avant d\'envoyer, vérifiez et cochez :</legend><ul>' + verifs + "</ul></fieldset>" : "") +
      '<p class="msg-erreur" id="inj-err" role="alert"></p>' +
      '<div class="inj-btns">' + (due ? '<button type="submit" class="btn btn-principal">Valider l\'envoi et éditer le PDF</button><button type="button" class="btn btn-secondaire" data-inj="fermer">Annuler</button>'
                                      : '<button type="button" class="btn btn-secondaire" data-inj="fermer">Fermer</button>') + "</div>" +
      '<h3 class="inj-apercu-titre" id="inj-apercu-titre">Aperçu de la lettre (2 pages)</h3>' +
      '<div class="apercu-doc inj-apercu" id="inj-apercu" role="region" tabindex="0" aria-labelledby="inj-apercu-titre">' + apercuInjonction() + "</div></form>";
    var f = document.getElementById("inj-form");
    f.addEventListener("submit", function (ev) { ev.preventDefault(); if (due) validerInjonction(); });
    f.addEventListener("click", function (ev) { var b = ev.target.closest("[data-inj]"); if (b) fermerInjonction(); });
    document.getElementById("inj-qualite").addEventListener("change", function () { document.getElementById("inj-apercu").innerHTML = apercuInjonction(); });
    f.addEventListener("change", function (ev) { if (ev.target.name === "inj-verif" && document.getElementById("inj-err").textContent) erreurInjonction(""); });
    montrer();
    document.getElementById("inj-qualite").focus();
  }
  function validerInjonction() {
    var cases = [].slice.call(document.querySelectorAll('#inj-form input[name="inj-verif"]'));
    var manque = cases.filter(function (c) { return !c.checked; });
    if (manque.length) {
      erreurInjonction("Cochez " + (manque.length > 1 ? "les " + manque.length + " vérifications restantes" : "la vérification restante") + " avant de valider l'envoi : une lettre d'injonction engage la banque.", manque[0]);
      return;
    }
    var cle = injCtx.cle, r = INJ.valider(procs(), cle, document.getElementById("inj-qualite").value, maintenant());
    if (!r.ok) { erreurInjonction(r.erreur); return; }
    B.store.sauver();
    fermerInjonction();
    majProcedures();
    editerInjonction(cle);
    var b = app.querySelector('[data-act="injonction"][data-cle="' + cle + '"], [data-act="proc-ouvrir"][data-cle="' + cle + '"]');
    if (b) b.focus();
  }
  /* Le prénom et le nom saisis à l'accueil de l'outil sont proposés dans la fenêtre d'identité (jamais repris sans être montrés : impression.js demande la confirmation à chaque connexion). */
  function imprimerDocument(doc) {
    if (!IMP) return;
    if (ID && !ID.nomCourant() && state.eleve.nom && ID.nomValide(state.eleve.nom).ok) { ID.definir(B.store.charger(), state.eleve.nom); B.store.sauver(); }
    IMP.imprimer(IMP.document(doc), doc.fichier);
  }
  function editerInjonction(cle) {
    var proc = procs()[cle];
    if (!proc || !proc.injonction) return;
    var l = INJ.lettreDepuis(proc.inst, { date: INJ.lireDate(proc.injonction.date), qualite: proc.injonction.qualite });
    if (l.ok) imprimerDocument(INJ.document(l));
  }
  function editerInformation(cle) {
    var proc = procs()[cle];
    if (!proc || !proc.info) return;
    var l = INJ.information(proc.inst, { date: INJ.lireDate(proc.info.date) });
    if (l.ok) imprimerDocument(INJ.documentInformation(l));
  }
  /* Met à jour l'écran qui montre les procédures : le dossier (correction) ou l'accueil de l'outil. */
  function majProcedures() {
    if (state.screen === "dossier") rafraichir();
    else render(false);
  }

  /* Accueil : chèques déjà mis en suspens (aujourd'hui ou un autre jour de travail) dont la lettre n'est pas envoyée, et lettres envoyées à rééditer. */
  function suspensHtml() {
    if (!INJ) return "";
    var P = procs(), cles = Object.keys(P).filter(function (k) { return P[k] && P[k].info && P[k].inst && P[k].inst.ok; });
    if (!cles.length) return "";
    cles.sort(function (a, b) { return P[a].info.date < P[b].info.date ? 1 : P[a].info.date > P[b].info.date ? -1 : 0; });
    var now = maintenant();
    var h = '<section class="inj-suspens" aria-labelledby="t-suspens"><h2 id="t-suspens">Chèques en suspens (procédure MURCEF)</h2>' +
      '<p class="mention">Titulaires informés avant le rejet. La lettre d\'injonction se valide une fois l\'échéance atteinte : 5 jours ouvrés, hors week-end et jours fériés, jusqu\'à 12 h le dernier jour.</p><ul class="liste-simple">';
    cles.forEach(function (k) {
      var pr = P[k], et = INJ.etat(pr, now), i = pr.inst, nom = i.client.civilite + " " + i.client.prenom + " " + String(i.client.nom).toUpperCase();
      var etat = et === "envoyee" ? '<span class="chip chip-ok">' + ICON.check + "Lettre envoyée le " + esc(dateFr(pr.injonction.date)) + "</span>"
        : et === "a_valider" ? '<span class="chip chip-bad">' + ICON.alert + "Échéance atteinte : envoi à valider</span>"
        : '<span class="chip chip-warn">' + ICON.info + "En suspens jusqu'au " + esc(echeanceDe(pr)) + "</span>";
      h += '<li><span><strong>Chèque n° ' + esc(i.cheque) + "</strong> de " + esc(INJ.montant(i.montantCheque)) + " – " + esc(nom) + ", mis en suspens le " + esc(dateFr(pr.info.date)) + "<br>" + etat + '</span><span class="droite">' +
        '<button type="button" class="btn btn-secondaire" data-act="proc-ouvrir" data-cle="' + esc(k) + '">' + (et === "envoyee" ? "Éditer à nouveau le PDF" : "Visualiser la lettre d'injonction") + "</button></span></li>";
    });
    return h + "</ul></section>";
  }
  function bouton(o, valeur, libelle, dec, valide) {
    var actif = dec === valeur;
    return '<button type="button" class="choix choix-' + valeur + (actif ? " est-actif" : "") + '" aria-pressed="' + actif + '" data-act="choisir" data-op="' + o.id + '" data-d="' + valeur + '"' + (valide ? " disabled" : "") + ">" + libelle + "</button>";
  }

  /* Frais d'incidents engendrés par les décisions de l'étudiant */
  function fraisHtml(d) {
    var f = R.fraisDossier(d, decisionsDe(d));
    var li = [];
    li.push("<li>Commission d'intervention : " + (f.nbIrregularites ? pl(f.nbIrregularites, "paiement", "paiements") + " en irrégularité × " + eur(f.commissionUnitaire) + " = <strong>" + eur(f.commission) + "</strong>" : "aucun paiement en irrégularité, <strong>" + eur(0) + "</strong>") + " (" + eur(f.commissionMensuelleMax) + " par mois au maximum).</li>");
    /* « au maximum » seulement si un prélèvement (20 € au plus) ou un client en offre fragile (plafond mensuel) est en jeu : un chèque rejeté coûte 30 € ou 50 €, montants fixes. */
    var dec = decisionsDe(d), variable = R.operationsADecider(d).some(function (o) { return dec[o.id] === "rejeter" && !(o.type === "cheque" && !d.client.fragile); });
    li.push("<li>Frais de rejet : " + (f.nbRejets ? pl(f.nbRejets, "rejet", "rejets") + ", <strong>" + eur(f.rejets) + "</strong>" + (variable ? " au maximum" : "") : "aucun rejet, <strong>" + eur(0) + "</strong>") + ".</li>");
    if (f.fragile) li.push("<li>Offre clientèle fragile (OCF) : l'ensemble des frais d'incidents est plafonné à " + eur(R.PLAFOND_OCF_PAR_MOIS) + " par mois. Total retenu : <strong>" + eur(f.totalPlafonne) + "</strong>" + (f.total > f.totalPlafonne ? " au lieu de " + eur(f.total) : "") + ".</li>");
    return "<h4>Frais engendrés par vos décisions</h4><ul>" + li.join("") + "</ul>";
  }

  function oppVerdictHtml(d) {
    var n = R.noterOpportunite(d, choixOpp(d));
    var att = R.libelleOpportunite(n.attendu);
    var h = n.verdict === "ok"
      ? '<p class="verdict verdict-ok">' + ICON.check + "Bonne détection (1 point)</p>"
      : '<p class="verdict verdict-ko">' + ICON.cross + "À revoir (0 point). Attendu : " + esc(att) + "</p>";
    return h + '<p class="op-expl">' + esc(d.opportunite.explication) + "</p>";
  }

  function correctionHtml(d) {
    var sc = scoreDe(d);
    var att = R.projeter(d, R.decisionsAttendues(d));
    var h = '<section class="correction" id="correction" tabindex="-1" aria-labelledby="h-corr">' +
      '<h3 id="h-corr">Correction du dossier</h3>' +
      '<p class="score">Vous obtenez <strong>' + pts(sc.total) + " sur " + sc.max + "</strong> " + (sc.max > 1 ? "points" : "point") +
        " : décisions " + pts(sc.ops.total) + " sur " + sc.ops.max + ", opportunité commerciale " + sc.opp.points + " sur 1.</p>" +
      "<p><strong>Objectif du dossier.</strong> " + esc(d.objectif) + "</p>" +
      "<p><strong>Position finale attendue.</strong> " + eur(att.soldeFinal) + " (" + etatTexte(att.etat) + ").</p>" +
      "<p><strong>Opportunité commerciale attendue.</strong> " + esc(R.libelleOpportunite(R.opportuniteAttendue(d))) + ". Votre choix : " + esc(choixOpp(d) ? R.libelleOpportunite(choixOpp(d)) : "aucun") + ".</p>" +
      fraisHtml(d) +
      "<h4>À retenir</h4><ul>" + d.retenir.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></section>";
    return h;
  }

  function actionsHtml(d) {
    var valide = estValide(d);
    var dernier = state.idx === DOS.length - 1;
    var aide;
    if (valide) aide = "Dossier validé. Passez au suivant quand vous êtes prêt.";
    else if (!toutDecide(d)) {
      var reste = R.operationsADecider(d).filter(function (o) { return !decisionsDe(d)[o.id]; }).length;
      aide = "Choisissez Payer ou Rejeter pour " + (reste > 1 ? "les " + reste + " opérations restantes" : "l'opération restante") + ".";
    } else if (!choixOpp(d)) aide = "Choisissez une opportunité commerciale dans l'onglet « Opportunité commerciale » (« aucune » est une réponse possible).";
    else if (!commentaireOk(d)) aide = "Rédigez votre commentaire dans l'onglet Commentaire : il est obligatoire (au moins " + R.COMMENTAIRE_MIN + " caractères).";
    else aide = "Tout est prêt : validez pour voir la correction.";
    return '<p class="actions-aide" id="actions-aide">' + aide + "</p>" +
      '<div class="actions-boutons">' +
      '<button type="button" class="btn btn-secondaire" id="btn-valider" data-act="valider" aria-describedby="actions-aide"' + (valide || !pret(d) ? " disabled" : "") + ">" + (valide ? "Validé" : "Valider") + "</button>" +
      '<button type="button" class="btn btn-principal" id="btn-suivant" data-act="suivant" aria-describedby="actions-aide"' + (valide ? "" : " disabled") + ">" + (dernier ? "Voir le bilan" : "Suivant") + "</button>" +
      "</div>";
  }

  /* ---------- Onglet « Relevé de compte » ---------- */
  /* Les opérations passées sont des données fictives (releves.js), exprimées en jours avant aujourd'hui.
     Le solde de chaque ligne est recalculé à partir du solde actuel du dossier. */
  var PERIODES = [
    { de: 1, a: 30, nom: "Dernier mois" },
    { de: 31, a: 60, nom: "Mois précédent" },
    { de: 61, a: 90, nom: "Il y a deux mois" }
  ];
  function arrondi(x) { return Math.round(x * 100) / 100; }
  function dateCourte(jours) {
    var d = maintenant();
    d.setDate(d.getDate() + jours);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  var ICONREL = { carte: ICON.carte, cheque: ICON.cheque, prelevement: ICON.prelevement, rejet: ICON.cross, frais: ICON.alert, commission: ICON.alert, info: ICON.info };
  function releveCalcul(d) {
    var r = REL[d.id];
    if (!r) return null;
    var total = 0;
    r.lignes.forEach(function (l) { total += l[3]; });
    var solde = arrondi(d.position.solde - total);
    var ouverture = solde;
    var lignes = r.lignes.map(function (l) {
      solde = arrondi(solde + l[3]);
      return { j: l[0], k: l[1], lib: l[2], m: l[3], r: l[4], solde: solde };
    });
    return { depart: r.depart, ouverture: ouverture, lignes: lignes };
  }
  function periodeCalcul(rc, p) {
    var lignes = rc.lignes.filter(function (l) { return l.j >= p.de && l.j <= p.a; });
    var avant = rc.lignes.filter(function (l) { return l.j > p.a; });
    var debut = avant.length ? avant[avant.length - 1].solde : rc.ouverture;
    var fin = lignes.length ? lignes[lignes.length - 1].solde : debut;
    var deb = 0, cre = 0;
    lignes.forEach(function (l) { if (l.m < 0) deb -= l.m; else if (l.m > 0) cre += l.m; });
    return { lignes: lignes, debut: debut, fin: fin, debits: arrondi(deb), credits: arrondi(cre) };
  }
  function ligneReleve(l) {
    var rejet = l.k === "rejet";
    var cls = "rel-ligne rel-" + l.k;
    var montant = rejet ? "Non débité : " + eur(l.r) : (l.m < 0 ? eur(l.m) : l.m > 0 ? "+" + eur(l.m) : "");
    var h = '<tr class="' + cls + '"><td class="rel-date">' + dateCourte(-l.j) + "</td>" +
      '<td class="rel-lib">' + (ICONREL[l.k] ? '<span class="rel-ico">' + ICONREL[l.k] + "</span>" : "") + "<span>" + esc(l.lib) + "</span>" +
      '<span class="rel-mob">' + (montant ? esc(montant) + " · " : "") + "Solde " + eur(l.solde) + "</span></td>";
    if (rejet) h += '<td class="rel-debit"><s>' + eur(l.r) + '</s><span class="sr"> non débité</span></td>';
    else h += '<td class="rel-debit">' + (l.m < 0 ? eur(-l.m) : "") + "</td>";
    h += '<td class="rel-credit">' + (l.m > 0 ? eur(l.m) : "") + "</td>" +
      '<td class="rel-solde ' + classeMontant(l.solde) + '">' + eur(l.solde) + "</td></tr>";
    return h;
  }
  function releveContenu(d, rc, m) {
    var p = PERIODES[m];
    var du = dateDecalee(-p.a), au = dateDecalee(-p.de);
    if (p.de > rc.depart) {
      return '<h3 class="rel-titre">Relevé du ' + du + " au " + au + "</h3>" +
        '<p class="rel-vide">Le compte a été ouvert le ' + dateDecalee(-rc.depart) + " : il n'y a aucune opération avant cette date.</p>";
    }
    var c = periodeCalcul(rc, p);
    var debutLib = rc.depart >= p.de && rc.depart <= p.a ? "Ouverture du compte" : "Solde au " + dateDecalee(-p.a - 1);
    var finLib = m === 0 ? "Solde actuel" : "Solde au " + dateDecalee(-p.de);
    var h = '<h3 class="rel-titre">Relevé du ' + du + " au " + au + "</h3>" +
      '<p class="sr" role="status">Relevé affiché : ' + esc(p.nom) + ", du " + du + " au " + au + ".</p>" +
      '<dl class="rel-synthese">' +
      "<div><dt>" + debutLib + '</dt><dd class="' + classeMontant(c.debut) + '">' + eur(c.debut) + "</dd></div>" +
      "<div><dt>Total des débits</dt><dd>" + eur(c.debits) + "</dd></div>" +
      "<div><dt>Total des crédits</dt><dd>" + eur(c.credits) + "</dd></div>" +
      "<div><dt>" + finLib + '</dt><dd class="' + classeMontant(c.fin) + '">' + eur(c.fin) + "</dd></div>" +
      "</dl>";
    h += '<div class="rel-tableau"><table class="rel-table"><caption class="sr">Opérations du ' + du + " au " + au + ", de la plus ancienne à la plus récente</caption>" +
      '<thead><tr><th scope="col">Date</th><th scope="col">Opération</th><th scope="col" class="rel-debit">Débit</th><th scope="col" class="rel-credit">Crédit</th><th scope="col" class="rel-solde">Solde</th></tr></thead><tbody>';
    c.lignes.forEach(function (l) { h += ligneReleve(l); });
    if (!c.lignes.length) h += '<tr><td colspan="5" class="rel-vide">Aucune opération sur cette période.</td></tr>';
    return h + "</tbody></table></div>";
  }
  function releveHtml(d) {
    var rc = releveCalcul(d);
    if (!rc) return '<p class="mention">Le relevé de ce compte n\'est pas disponible.</p>';
    var m = state.mois || 0;
    var b = "";
    PERIODES.forEach(function (p, i) {
      b += '<button type="button" class="mois' + (i === m ? " est-actif" : "") + '" aria-pressed="' + (i === m) + '" data-act="mois" data-m="' + i + '">' + p.nom + "</button>";
    });
    return '<div class="releve">' +
      '<p class="com-aide" id="rel-aide">Opérations passées sur le compte au cours des trois derniers mois, comme sur un relevé. Les opérations à décider (onglet « Opérations à valider ») ne sont pas encore passées.</p>' +
      '<div class="rel-mois" role="group" aria-label="Période du relevé" aria-describedby="rel-aide">' + b + "</div>" +
      releveContenu(d, rc, m) +
      '</div>';
  }

  /* Onglet « Opportunité commerciale » */
  function oppHtml(d) {
    var valide = estValide(d);
    var choix = choixOpp(d);
    var att = R.opportuniteAttendue(d);
    var h = '<fieldset class="opp"><legend>Quelle opportunité commerciale détectez-vous sur ce dossier ?</legend>' +
      '<p class="com-aide" id="opp-aide">Appuyez-vous sur le dossier client, la position du compte et les opérations. Une seule réponse ; « aucune » est possible.</p>' +
      '<div class="opp-liste">';
    R.OPPORTUNITES.forEach(function (o) {
      var actif = choix === o.code;
      h += '<label class="opp-choix' + (actif ? " est-actif" : "") + (valide && o.code === att ? " opp-attendue" : "") + '">' +
        '<input type="radio" name="opp" value="' + o.code + '" data-opp="' + o.code + '"' + (actif ? " checked" : "") + (valide ? " disabled" : "") + ' aria-describedby="opp-aide">' +
        "<span>" + esc(o.libelle) + "</span></label>";
    });
    h += "</div></fieldset>";
    if (valide) h += '<div class="opp-correction">' + oppVerdictHtml(d) + "</div>";
    return h;
  }

  function operationsHtml(d) {
    var valide = estValide(d);
    var proj = R.projeter(d, decisionsDe(d));
    var notation = valide ? R.noter(d, decisionsDe(d)) : null;
    return (valide ? correctionHtml(d) : "") +
      '<ul class="ops">' + proj.lignes.map(function (l) { return ligneOperation(l, d, valide, notation); }).join("") + "</ul>";
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

  function ongletHtml(nom, libelle, extra) {
    var actif = state.onglet === nom;
    return '<button type="button" role="tab" id="tab-' + nom + '" class="onglet" aria-controls="panneau-' + nom + '" aria-selected="' + actif + '" tabindex="' + (actif ? 0 : -1) + '" data-act="onglet" data-tab="' + nom + '">' + libelle + (extra || "") + "</button>";
  }

  function vueDossier() {
    var d = dossierCourant();
    var com = state.comments[d.id] || "";
    var h = '<div class="poste">' +
      '<h1 class="titre-poste">Opérations à valider<span>Dossier ' + (state.idx + 1) + " sur " + DOS.length + "</span></h1>" +
      '<div class="poste-grille">' +
      '<div class="col-gauche">' + blocClient(d) + blocBale(d) + blocIcc(d) + blocAntecedents(d) + "</div>" +
      '<div class="col-droite">' +
      '<section class="bloc bloc-position" id="bloc-position" aria-labelledby="h-pos">' + blocPosition(d) + "</section>" +
      '<section class="bloc bloc-travail">' +
      '<div class="onglets onglets-4" role="tablist" aria-label="Zone de travail">' +
      ongletHtml("operations", "Opérations à valider", ' <span class="badge" id="badge-ops">' + d.operations.length + "</span>") +
      ongletHtml("releve", "Relevé de compte") +
      ongletHtml("opportunite", "Opportunité commerciale", ' <span class="pastille" id="pastille-opp"' + (choixOpp(d) ? "" : " hidden") + '><span class="sr">choisie</span></span>') +
      ongletHtml("commentaire", "Commentaire", ' <span class="pastille" id="pastille-com"' + (commentaireOk(d) ? "" : " hidden") + '><span class="sr">rédigé</span></span>') +
      "</div>" +
      '<div role="tabpanel" id="panneau-operations" class="panneau" aria-labelledby="tab-operations"' + (state.onglet === "operations" ? "" : " hidden") + ">" + operationsHtml(d) + "</div>" +
      '<div role="tabpanel" id="panneau-releve" class="panneau" aria-labelledby="tab-releve"' + (state.onglet === "releve" ? "" : " hidden") + ">" + releveHtml(d) + "</div>" +
      '<div role="tabpanel" id="panneau-opportunite" class="panneau" aria-labelledby="tab-opportunite"' + (state.onglet === "opportunite" ? "" : " hidden") + ">" + oppHtml(d) + "</div>" +
      '<div role="tabpanel" id="panneau-commentaire" class="panneau" aria-labelledby="tab-commentaire"' + (state.onglet === "commentaire" ? "" : " hidden") + ">" +
      '<label class="com-label" for="commentaire">Commentaire du conseiller (obligatoire)</label>' +
      '<p class="com-aide" id="com-aide">Motivez vos décisions : note Bâle, rejets des 12 derniers mois, montant du dépassement, crédit attendu, règle applicable, opportunité commerciale. Le commentaire est obligatoire pour valider le dossier.</p>' +
      '<textarea id="commentaire" rows="8" maxlength="' + MAX_COM + '" aria-required="true" aria-describedby="com-aide com-compteur"' + (estValide(d) ? "" : "") + ">" + esc(com) + "</textarea>" +
      '<p class="com-compteur" id="com-compteur">' + compteurTexte(com.trim().length) + "</p>" +
      '<div id="autoeval">' + autoEvalHtml(d) + "</div>" +
      "</div>" +
      '<div class="actions" id="actions">' + actionsHtml(d) + "</div>" +
      "</section></div></div></div>";
    app.innerHTML = h;
  }

  /* mises à jour partielles : on garde le texte du commentaire et le focus */
  function rafraichir() {
    var d = dossierCourant();
    var pos = document.getElementById("bloc-position");
    if (pos) pos.innerHTML = blocPosition(d);
    var ops = document.getElementById("panneau-operations");
    if (ops) ops.innerHTML = operationsHtml(d);
    var opp = document.getElementById("panneau-opportunite");
    if (opp) opp.innerHTML = oppHtml(d);
    majActions();
    var ae = document.getElementById("autoeval");
    if (ae) ae.innerHTML = autoEvalHtml(d);
  }
  /* Bouton Valider, message d'aide et pastilles des onglets */
  function majActions() {
    var d = dossierCourant();
    var act = document.getElementById("actions");
    if (act) act.innerHTML = actionsHtml(d);
    var po = document.getElementById("pastille-opp");
    if (po) po.hidden = !choixOpp(d);
    var pc = document.getElementById("pastille-com");
    if (pc) pc.hidden = !commentaireOk(d);
  }

  /* ---------- bilan ---------- */
  /* En-tête réservé à l'impression du bilan : logo de la banque, nom de l'agence et nom de l'outil (l'en-tête de l'écran est masqué à l'impression). */
  function enteteImpression(outil) {
    var im = document.querySelector(".logo-tuile img"), src = im ? im.getAttribute("src") : "assets/logo.png";
    return '<div class="imprime-entete"><img src="' + esc(src) + '" width="56" height="56" alt=""><div><p class="imprime-banque">GS Banque & Assurance</p><p class="imprime-agence">Agence de Paris – ' + esc(outil) + '</p></div></div>';
  }
  /* Bilan : une ligne par chèque rejeté pour défaut de provision, pour que le professeur voie où en est la procédure MURCEF : titulaire informé (moyens, date), échéance, lettre d'injonction. */
  function lettresBilan(d) {
    if (!INJ) return "";
    var dec = decisionsDe(d), h = "", now = maintenant();
    R.operationsADecider(d).forEach(function (o) {
      if (o.type !== "cheque" || dec[o.id] !== "rejeter" || !INJ.analyse(d, o, dec).ok) return;
      var proc = procs()[cleProc({ dossier: d.id, operation: o.id })], et = INJ.etat(proc, now);
      h += "<br>Procédure MURCEF du chèque n° " + esc(INJ.numeroCheque(o)) + " : ";
      if (!proc || !proc.info) h += "titulaire non informé";
      else {
        h += "titulaire informé le " + esc(dateFr(proc.info.date)) + " (" + esc(INJ.moyensTexte(proc.info)) + "), chèque en suspens jusqu'au " + esc(echeanceDe(proc)) + " ; lettre d'injonction : " +
          (et === "envoyee" ? "envoi validé le " + esc(dateFr(proc.injonction.date)) : et === "a_valider" ? "échéance atteinte, envoi à valider" : "envoi à valider à partir de l'échéance");
      }
    });
    return h;
  }
  function vueBilan() {
    var total = totalPoints();
    var max = totalMax();
    var pc = max ? Math.round((total / max) * 100) : 0;
    var h = '<section class="bilan" aria-labelledby="t-bilan">' + enteteImpression("Poste du conseiller clientèle : mouvements débiteurs") + '<h1 id="t-bilan">Bilan de la séance</h1>' +
      '<form class="identite-form identite-bilan" data-form="eleve" autocomplete="off">' +
      '<div class="champ"><label for="nom">Nom et prénom</label><input id="nom" name="nom" type="text" maxlength="60" value="' + esc(state.eleve.nom) + '"></div>' +
      '<div class="champ"><label for="classe">Classe</label><input id="classe" name="classe" type="text" maxlength="30" value="' + esc(state.eleve.classe) + '"></div>' +
      "</form>" +
      '<p class="imprime-id" id="imprime-id"></p>' +
      '<p class="bilan-score"><strong>' + pts(total) + " sur " + max + "</strong> points, soit " + pc + " %</p>" +
      '<table class="bilan-table"><caption class="sr">Résultats par dossier</caption><thead><tr><th scope="col">Dossier</th><th scope="col">Client et note</th><th scope="col">Vos décisions</th><th scope="col">Points</th></tr></thead><tbody>';
    DOS.forEach(function (d) {
      var n = R.noter(d, decisionsDe(d));
      var sc = scoreDe(d);
      var dec = decisionsDe(d);
      var lst = R.operationsADecider(d).map(function (o) {
        var det = n.details.filter(function (x) { return x.id === o.id; })[0];
        var mark = det.verdict === "ok" ? "juste" : det.verdict === "defendable" ? "défendable" : "à revoir";
        return esc(o.libelle) + " : " + (dec[o.id] === "payer" ? "payé" : dec[o.id] === "rejeter" ? "rejeté" : "non décidé") + " (" + mark + ")";
      }).join("<br>");
      lst += lettresBilan(d);
      lst += "<br>Opportunité : " + (choixOpp(d) ? esc(R.libelleOpportunite(choixOpp(d))) : "non choisie") + " (" + (sc.opp.verdict === "ok" ? "juste" : "à revoir") + ")";
      var coches = (state.checks[d.id] || []).filter(Boolean).length;
      var com = (state.comments[d.id] || "").trim();
      var codes = codesDe(d);
      h += "<tr><th scope=\"row\">" + d.id + "</th><td>" + esc(d.client.civilite + " " + d.client.nom) + "<br>Note " + esc(d.note) + (codes.length ? "<br>" + codes.join(", ") : "") + "</td><td>" + lst + "</td><td>" + (estValide(d) ? pts(sc.total) + " / " + sc.max : "non traité") + "</td></tr>";
      h += '<tr class="bilan-com"><td></td><td colspan="3"><strong>Commentaire :</strong> ' + (com ? esc(com).replace(/\n/g, "<br>") : "<em>aucun</em>") +
        (estValide(d) ? '<br><span class="bilan-auto">Éléments attendus mentionnés : ' + coches + " sur " + d.argumentaire.length + "</span>" : "") + "</td></tr>";
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
    btnRecommencer.hidden = state.screen === "accueil" && state.idx === 0 && !Object.keys(state.valides).length;
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
  function validerDossier() {
    var d = dossierCourant();
    if (estValide(d) || !pret(d)) return;
    state.valides[d.id] = true;
    sauver();
    rafraichir();
    majEntete();
    state.onglet = "operations";
    var tabOps = document.getElementById("tab-operations");
    if (tabOps) activerOnglet("operations", false);
    var c = document.getElementById("correction");
    if (c) { c.focus({ preventScroll: true }); c.scrollIntoView({ block: "start", behavior: "smooth" }); }
  }
  function suivant() {
    var d = dossierCourant();
    if (!estValide(d)) return;
    if (state.idx < DOS.length - 1) { state.idx += 1; state.onglet = "operations"; state.mois = 0; render(true); }
    else { state.screen = "bilan"; render(true); }
  }
  function activerOnglet(nom, focus) {
    state.onglet = nom;
    TABS.forEach(function (t) {
      var tab = document.getElementById("tab-" + t);
      var pan = document.getElementById("panneau-" + t);
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
    var eleve = state.eleve, P = procs();
    Object.keys(P).forEach(function (k) { if (k.indexOf(JOUR + ":") === 0) delete P[k]; });   /* les chèques mis en suspens pendant cet exercice repartent avec lui */
    B.store.sauver();
    state = neuf();
    state.eleve = eleve;
    render(true);
  }

  document.addEventListener("click", function (ev) {
    var t = ev.target.closest("[data-act]");
    if (!t || t.disabled) return;
    var act = t.getAttribute("data-act");
    if (act === "demarrer") { state.screen = "dossier"; render(true); }
    else if (act === "choisir") {
      var d = dossierCourant();
      if (estValide(d)) return;
      decisionsDe(d)[t.getAttribute("data-op")] = t.getAttribute("data-d");
      sauver();
      rafraichir();
      var again = app.querySelector('[data-act="choisir"][data-op="' + t.getAttribute("data-op") + '"][data-d="' + t.getAttribute("data-d") + '"]');
      if (again) again.focus();
    }
    else if (act === "mois") {
      state.mois = parseInt(t.getAttribute("data-m"), 10) || 0;
      sauver();
      var pr = document.getElementById("panneau-releve");
      if (pr) pr.innerHTML = releveHtml(dossierCourant());
      var bm = app.querySelector('[data-act="mois"][data-m="' + state.mois + '"]');
      if (bm) bm.focus();
    }
    else if (act === "valider") validerDossier();
    else if (act === "suivant") suivant();
    else if (act === "onglet") activerOnglet(t.getAttribute("data-tab"), false);
    else if (act === "aide") { if (boiteAide.showModal) boiteAide.showModal(); else boiteAide.setAttribute("open", ""); }
    else if (act === "fermer-aide") { if (boiteAide.close) boiteAide.close(); else boiteAide.removeAttribute("open"); }
    else if (act === "recommencer") recommencer();
    else if (act === "inf-ouvrir") {
      var di = dossierCourant(), oi = R.operationsADecider(di).filter(function (x) { return x.id === t.getAttribute("data-op"); })[0];
      if (!oi || !estValide(di)) return;
      ouvrirInformation(di, oi, t);
    }
    else if (act === "inf-pdf") editerInformation(t.getAttribute("data-cle"));
    else if (act === "injonction" || act === "proc-ouvrir") {
      var cle = t.getAttribute("data-cle"), pr = procs()[cle];
      if (!pr) return;
      if (pr.injonction) editerInjonction(cle); else ouvrirInjonction(cle, t);
    }
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
      sauver();
    } else if (t.form && t.form.getAttribute("data-form") === "eleve") {
      state.eleve[t.name] = t.value;
      sauver();
      majIdentiteImprimee();
    }
  });

  document.addEventListener("change", function (ev) {
    var t = ev.target;
    if (t.hasAttribute && t.hasAttribute("data-opp")) {
      var dd = dossierCourant();
      if (estValide(dd)) return;
      state.opps[dd.id] = t.getAttribute("data-opp");
      sauver();
      var po = document.getElementById("panneau-opportunite");
      if (po) po.innerHTML = oppHtml(dd);
      majActions();
      var coche = app.querySelector('input[name="opp"]:checked');
      if (coche) coche.focus();
      return;
    }
    if (t.hasAttribute && t.hasAttribute("data-check")) {
      var d = dossierCourant();
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
