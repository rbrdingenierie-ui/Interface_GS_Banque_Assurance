/* GS Banque & Assurance – interface du parcours « Gestion des incidents » (JavaScript sans dépendance).
   Cinq étapes par dossier : le compte et son relevé, le contact avec le client, les moyens de régularisation, la suite à donner (décision ou procédure J90),
   puis le courrier, qui n'est proposé qu'après la validation du conseiller. */
(function () {
  "use strict";

  var G = window.SGBF.gdi;
  var DOS = window.SGBF.incidents;
  var QG = window.SGBF.quotidienGdi;
  var DG = window.SGBF.documentsGdi;
  var IMP = window.SGBF.impression;
  var KEY = "sgbf-gdi-v1";
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
  var TABS = ["compte", "contact", "moyens", "suite", "courrier"];
  function neuf() {
    return { v: 1, jour: JOUR, screen: "accueil", idx: 0, onglet: "compte", tentatives: {}, moyens: {}, decisions: {}, procedure: {}, comments: {}, valides: {}, checks: {}, courriers: {}, choixCourrier: {}, eleve: { nom: "", classe: "" } };
  }
  function charger() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { s = null; /* stockage indisponible : on repart de zéro */ }
    if (s && s.v === 1 && s.jour === JOUR && typeof s.idx === "number" && s.idx >= 0 && s.idx < DOS.length) {
      if (TABS.indexOf(s.onglet) < 0) s.onglet = "compte";
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
  var nfEur2 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var nfPts = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  function eur(n) { return nfEur.format(n).replace("-", "−"); }
  function eur2(n) { return nfEur2.format(n).replace("-", "−"); }
  function pts(n) { return nfPts.format(n); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function pl(n, s, p) { return n + " " + (n > 1 ? p : s); }
  function initiales(c) { return (c.prenom.charAt(0) + c.nom.charAt(0)).toUpperCase(); }
  function plusJours(n) { var d = maintenant(); d.setDate(d.getDate() + n); return d; }
  function fmtDate(d) { return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }); }
  function fmtLong(d) { return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }); }
  function aujourdhui() { return fmtDate(maintenant()); }
  /* Les textes des dossiers écrivent les dates à venir « {+7} » : date du jour + 7 jours. */
  function texte(s) { return esc(s).replace(/\{\+(\d+)\}/g, function (m, n) { return esc(fmtLong(plusJours(parseInt(n, 10)))); }); }
  function arrondi(x) { return Math.round(x * 100) / 100; }

  var ICON = {
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    alert: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 21 20H3L12 4z"/><path d="M12 10v4M12 17h.01"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    cross: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h3l1.5 4-2 1.3a11 11 0 0 0 5.2 5.2l1.3-2 4 1.5v3a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z"/></svg>',
    mobile: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/></svg>',
    sms: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v10H9l-4 3.5v-3.5H4z"/><path d="M8 9h8M8 12h5"/></svg>',
    mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>',
    user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/></svg>',
    briefcase: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7.5" width="18" height="12" rx="2"/><path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5"/><path d="M3 12.5h18"/></svg>',
    card: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5.5" width="19" height="13" rx="2"/><path d="M2.5 10h19M6 15h4"/></svg>',
    coins: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="6.5" rx="7" ry="3"/><path d="M5 6.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/><path d="M5 11.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    doc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M9.5 12h5M9.5 15.5h5"/></svg>',
    flag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V4"/><path d="M6 4.5h11l-2 4 2 4H6"/></svg>',
    shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5.5c0 4.3 2.9 7.6 7 9.5 4.1-1.9 7-5.2 7-9.5V6l-7-3z"/><path d="m8.8 12 2.4 2.4 4-4.4"/></svg>',
    bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 21h4"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>',
    print: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8V3.5h10V8"/><rect x="3.5" y="8" width="17" height="8" rx="1.5"/><path d="M7 14h10v6.5H7z"/></svg>'
  };
  var ICON_CANAL = { mobile: "mobile", fixe: "phone", sms: "sms", email: "mail", courrier: "mail", agence: "pin" };

  /* ---------- accès au dossier courant et à sa saisie ---------- */
  function dossierCourant() { return DOS[state.idx]; }
  function liste(table, d) { if (!state[table][d.id]) state[table][d.id] = []; return state[table][d.id]; }
  function tent(d) { return liste("tentatives", d); }
  function moy(d) { return liste("moyens", d); }
  function proc(d) { if (!state.procedure[d.id]) state.procedure[d.id] = {}; return state.procedure[d.id]; }
  function estValide(d) { return !!state.valides[d.id]; }
  function decisionDe(d) { return state.decisions[d.id] || null; }
  function commentaireOk(d) { return G.commentaireSuffisant(state.comments[d.id]); }
  function contactOk(d) { return G.contactTermine(d, tent(d)); }
  function atteint(d) { return G.atteint(d, tent(d)); }
  function courrierEnvoye(d) { var c = state.courriers[d.id]; return c && c.modele ? { modele: c.modele } : null; }
  function courrierRepondu(d) { return !!state.courriers[d.id]; }
  function ctx(d) { return { tentatives: tent(d), moyens: moy(d), decision: decisionDe(d), procedure: proc(d), commentaire: state.comments[d.id] || "", courrier: courrierEnvoye(d) }; }
  /* Les lignes « fonds » doivent avoir un montant et un délai avant de passer à la suite. */
  function moyensCompletes(d) {
    var m = moy(d);
    return m.length > 0 && m.every(function (x) {
      var def = G.moyen(x.id);
      return def && (def.genre !== "fonds" || (x.montant > 0 && typeof x.delai === "number"));
    });
  }
  function pretValider(d) { return contactOk(d) && moyensCompletes(d) && G.pretValider(d, ctx(d)); }
  function scoreDe(d) { return G.scoreDossier(d, ctx(d)); }
  function totalMax() { return DOS.reduce(function (t, d) { return t + G.maxDossier(d); }, 0); }
  function totalPoints() { return DOS.reduce(function (t, d) { return t + (estValide(d) ? scoreDe(d).total : 0); }, 0); }
  function compteurTexte(n) {
    return n < G.COMMENTAIRE_MIN
      ? n + " caractères : encore " + (G.COMMENTAIRE_MIN - n) + " pour pouvoir valider (minimum " + G.COMMENTAIRE_MIN + ")."
      : n + " sur " + MAX_COM + " caractères.";
  }
  /* Date d'un événement du compte : « j » jours avant aujourd'hui. */
  function dateJ(j) { return plusJours(-j); }
  /* Date d'un événement de l'historique : « j » est le jour du débit auquel il a eu lieu. */
  function dateHisto(d, j) { return plusJours(-(d.palier - j)); }
  function nomClient(c) { return c.civilite + " " + c.prenom + " " + c.nom; }
  function argumentaire(d) {
    var a = ["La situation du compte : solde, durée du débit, somme à verser", "Le résultat du contact : canal utilisé et réponse du client", "Les moyens de régularisation annoncés, avec montants et dates", "La décision prise au regard du palier de " + d.palier + " jours"];
    a.push(d.palier === 90 ? "Les services clôturés, les prélèvements opposés et l'envoi au service de recouvrement amiable" : "Le courrier ou la relance prévus");
    return a;
  }

  /* ---------- accueil ---------- */
  function vueAccueil() {
    var enCours = state.idx > 0 || Object.keys(state.valides).length > 0 || Object.keys(state.tentatives).length > 0;
    var h = '<section class="accueil" aria-labelledby="t-accueil">' +
      '<h1 id="t-accueil">Compte débiteur : quelle solution trouver ?</h1>' +
      '<p class="chapeau">Vous êtes Conseiller Clientèle Particuliers à GS Banque & Assurance. Après vos décisions sur les opérations débiteurs, certains comptes restent à l\'état débiteur. À 15, 30, 60 et 90 jours, ils remontent dans cet outil : vous contactez le client pour qu\'il redevienne créditeur.</p>' +
      '<ol class="etapes">' +
      '<li><span class="et-ico" aria-hidden="true">' + ICON.search + '</span><p><strong>Lisez le dossier.</strong> Solde, durée du débit, relevé des dernières semaines, ressources connues et historique des contacts.</p></li>' +
      '<li><span class="et-ico" aria-hidden="true">' + ICON.phone + '</span><p><strong>Contactez le client</strong> : mobile, fixe, SMS, e-mail, courrier ou convocation. Le dossier est mis à jour avec ce qu\'il vous dit.</p></li>' +
      '<li><span class="et-ico" aria-hidden="true">' + ICON.coins + '</span><p><strong>Enregistrez les moyens de régularisation</strong> annoncés par le client, avec le montant et le délai. Puis décidez de la suite selon le palier.</p></li>' +
      '<li><span class="et-ico" aria-hidden="true">' + ICON.mail + '</span><p><strong>Validez, puis envoyez le courrier</strong> adapté : vous contrôlez le texte avant d\'éditer le PDF.</p></li>' +
      "</ol>" +
      '<form class="identite-form" data-form="eleve" autocomplete="off">' +
      '<div class="champ"><label for="nom">Nom et prénom</label><input id="nom" name="nom" type="text" maxlength="60" value="' + esc(state.eleve.nom) + '"></div>' +
      '<div class="champ"><label for="classe">Classe</label><input id="classe" name="classe" type="text" maxlength="30" value="' + esc(state.eleve.classe) + '"></div>' +
      '<p class="mention champ-large">Facultatif : ces informations apparaissent sur le bilan imprimé. Elles restent sur cet appareil.</p>' +
      "</form>" +
      '<div class="accueil-actions">' +
      '<button type="button" class="btn btn-principal" data-act="demarrer">' + (enCours ? "Reprendre au dossier " + (state.idx + 1) : "Commencer") + "</button>" +
      "</div>" +
      '<p class="mention">' + libelleJour() + " : " + DOS.length + " dossiers, " + totalMax() + " points à gagner : un point pour le contact, un pour les moyens de régularisation, un pour la suite donnée et un pour le courrier lorsqu'il est attendu.</p>" +
      "</section>";
    app.innerHTML = h;
  }

  /* ---------- dossier : bandeau client et colonne de gauche ---------- */
  function bandeauClient(d) {
    var c = d.client, be = G.besoin(d), dep = G.depassement(d), p = G.palier(d.palier);
    return '<section class="client-bandeau" aria-labelledby="h-client">' +
      '<div class="cb-id"><span class="avatar avatar-lg" aria-hidden="true">' + esc(initiales(c)) + "</span><div>" +
      '<h2 id="h-client" class="cb-nom">' + esc(nomClient(c)) + "</h2>" +
      '<p class="cb-sous">' + c.age + " ans, " + esc(c.profession) + ". Client depuis " + pl(c.ancienneteAns, "an", "ans") + "</p></div></div>" +
      '<dl class="cb-chiffres">' +
      '<div><dt>Solde du compte</dt><dd class="neg">' + eur2(d.compte.solde) + '</dd><dd class="cb-note">Compte n° ' + esc(c.compte) + "</dd></div>" +
      "<div><dt>Autorisation de découvert</dt><dd>" + (d.compte.autorisation > 0 ? eur(d.compte.autorisation) : "aucune") + '</dd><dd class="cb-note">' + (dep > 0 ? "Dépassement : " + eur2(dep) : "Dans l'autorisation") + "</dd></div>" +
      "<div><dt>Somme à verser</dt><dd>" + eur2(be) + '</dd><dd class="cb-note">pour redevenir créditeur</dd></div></dl>' +
      '<div class="cb-bas">' +
      '<ul class="cb-produits" aria-label="Produits détenus">' + c.produits.map(function (x) { return '<li class="chip chip-produit">' + ICON.card + esc(x) + "</li>"; }).join("") + "</ul>" +
      '<p class="cb-alerte">' + ICON.bell + "<span><strong>Palier " + p.court + " :</strong> à l'état débiteur depuis " + d.palier + " jours</span></p>" +
      "</div></section>";
  }
  function pfBloc(ico, titre, corps) {
    return '<div class="pf"><span class="pf-ico" aria-hidden="true">' + ICON[ico] + '</span><div class="pf-corps"><h3 class="pf-titre">' + titre + "</h3>" + corps + "</div></div>";
  }
  function blocProfil(d) {
    var c = d.client, r = d.ressources;
    var h = '<section class="bloc bloc-profil" aria-labelledby="h-profil"><h2 id="h-profil">Profil du client</h2>' +
      pfBloc("user", "Situation personnelle", "<p>" + esc(c.situation) + "</p>") +
      pfBloc("briefcase", "Situation professionnelle", "<p>" + esc(c.professionnel) + "</p>") +
      pfBloc("coins", "Revenus", "<p>" + eur(c.revenus) + " par mois : " + esc(c.revenusNote) + ".</p>");
    var res = [];
    (r.epargne || []).forEach(function (e) { res.push(esc(e.produit) + " à GS Banque & Assurance : " + eur(e.solde)); });
    (r.credits || []).forEach(function (k) { res.push(esc(k.libelle) + " : " + eur2(k.mensualite) + " par mois"); });
    (r.notes || []).forEach(function (n) { res.push(esc(n)); });
    h += pfBloc("info", "Ressources et charges connues", res.length ? '<ul class="liste-patrimoine">' + res.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul>" : "<p>Aucune épargne ni charge particulière dans le dossier.</p>");
    return h + "</section>";
  }
  function blocCoordonnees(d) {
    var co = d.client.coordonnees;
    function ligne(ico, lib, val) {
      return '<li><span class="co-ico" aria-hidden="true">' + ICON[ico] + '</span><div><span class="co-lib">' + lib + '</span><span class="co-val">' + esc(val) + "</span></div></li>";
    }
    return '<section class="bloc bloc-coord" aria-labelledby="h-coord"><h2 id="h-coord">Coordonnées du client</h2>' +
      '<ul class="co-liste">' + (co.mobile ? ligne("mobile", "Mobile", co.mobile) : "") + (co.telephone ? ligne("phone", "Téléphone fixe", co.telephone) : "") + (co.email ? ligne("mail", "E-mail", co.email) : "") + ligne("pin", "Adresse", co.adresse) + "</ul></section>";
  }
  function blocHistorique(d) {
    return '<section class="bloc bloc-histo" aria-labelledby="h-histo"><h2 id="h-histo">Historique des contacts</h2><ol class="histo">' +
      d.historique.slice().sort(function (a, b) { return a.j - b.j; }).map(function (x) {
        return '<li><span class="histo-date">' + fmtDate(dateHisto(d, x.j)) + '</span><span class="histo-canal">' + esc(x.canal) + "</span><span>" + esc(x.texte) + "</span></li>";
      }).join("") + "</ol></section>";
  }
  function blocMaj(d) {
    if (!atteint(d)) return "";
    return '<section class="bloc bloc-maj" aria-labelledby="h-maj"><h2 id="h-maj">' + ICON.check + "Dossier mis à jour</h2>" +
      '<p class="mention">Mise à jour du ' + aujourdhui() + ", après le contact avec le client.</p>" +
      '<ul class="maj-liste">' + d.contact.maj.map(function (m) {
        return '<li><span class="maj-rub">' + esc(m.rubrique) + "</span><span>" + texte(m.texte) + "</span></li>";
      }).join("") + "</ul></section>";
  }
  function colonneGauche(d) { return blocMaj(d) + blocProfil(d) + blocCoordonnees(d) + blocHistorique(d); }

  /* ---------- onglet « Compte » : relevé des dernières semaines ---------- */
  var ICONREL = { carte: ICON.card, prelevement: ICON.info, rejet: ICON.alert, frais: ICON.coins, credit: ICON.coins, cheque: ICON.doc };
  function ligneReleve(l) {
    var neg = l.solde < 0;
    var cls = "rel-ligne rel-" + l.type + (l.debut ? " rel-debut" : "") + (l.type === "rejet" ? " rel-rejet" : "");
    var montant = l.m < 0 ? eur2(l.m) : l.m > 0 ? "+" + eur2(l.m) : eur2(0);
    var libelle = l.type === "rejet" && l.montantRejete ? esc(l.lib) + " (" + eur2(l.montantRejete) + " non payés)" : esc(l.lib);
    return '<tr class="' + cls + '"><td class="rel-date">' + fmtDate(dateJ(l.j)) + "</td>" +
      '<td class="rel-lib"><span class="rel-ico">' + (ICONREL[l.type] || "") + "</span><span>" + libelle + "</span>" +
      (l.debut ? ' <span class="chip chip-warn">' + ICON.alert + "Début du débit</span>" : "") +
      '<span class="rel-mob">' + esc(montant) + " · Solde " + eur2(l.solde) + "</span></td>" +
      '<td class="rel-debit">' + (l.m < 0 ? eur2(-l.m) : "") + "</td>" +
      '<td class="rel-credit">' + (l.m > 0 ? eur2(l.m) : "") + "</td>" +
      '<td class="rel-solde' + (neg ? " neg" : "") + '">' + eur2(l.solde) + "</td></tr>";
  }
  function compteHtml(d) {
    var dep = G.depassement(d);
    var fr = d.releve.filter(function (l) { return l.type === "frais" || l.type === "rejet"; });
    var h = '<p class="com-aide">Le relevé montre comment le compte est devenu débiteur et ce qu\'il a coûté. Les prélèvements rejetés ne sont pas payés : ils ne creusent pas le débit, mais ils entraînent des frais.</p>' +
      '<dl class="rel-synthese">' +
      "<div><dt>À l'état débiteur depuis le</dt><dd>" + fmtDate(plusJours(-d.palier)) + "</dd></div>" +
      "<div><dt>Origine du débit</dt><dd>" + esc(d.compte.origine) + "</dd></div>" +
      "<div><dt>Frais et intérêts depuis le début</dt><dd>" + eur2(d.compte.frais) + "</dd></div>" +
      "<div><dt>Dépassement de l'autorisation</dt><dd>" + eur2(dep) + "</dd></div></dl>" +
      '<div class="rel-tableau"><table class="rel-table"><caption class="sr">Opérations du compte, de la plus ancienne à la plus récente</caption>' +
      '<thead><tr><th scope="col">Date</th><th scope="col">Opération</th><th scope="col" class="rel-debit">Débit</th><th scope="col" class="rel-credit">Crédit</th><th scope="col" class="rel-solde">Solde</th></tr></thead><tbody>' +
      d.releve.map(ligneReleve).join("") + "</tbody></table></div>" +
      '<p class="mention">' + pl(fr.length, "ligne de frais ou de rejet", "lignes de frais ou de rejet") + " sur la période. Prélèvements en cours sur le compte : " +
      (d.prelevements.length ? d.prelevements.map(function (p) { return esc(p.libelle) + " (" + eur2(p.montant) + ")"; }).join(" ; ") : "aucun") + ".</p>";
    return h;
  }

  /* ---------- onglet « Contact » ---------- */
  function coordonneeCanal(d, id) {
    var co = d.client.coordonnees;
    if (id === "mobile" || id === "sms") return co.mobile || "";
    if (id === "fixe") return co.telephone || "";
    if (id === "email") return co.email || "";
    return co.adresse || "";
  }
  function boutonCanal(d, c) {
    var coord = coordonneeCanal(d, c.id), fait = tent(d).indexOf(c.id) >= 0, absent = !coord;
    return '<button type="button" class="canal' + (fait ? " est-fait" : "") + '" data-act="canal" data-canal="' + c.id + '"' + (fait || absent || estValide(d) ? " disabled" : "") + ">" +
      '<span class="canal-ico" aria-hidden="true">' + ICON[ICON_CANAL[c.id]] + '</span><span class="canal-txt"><span class="canal-lib">' + esc(c.libelle) + '</span><span class="canal-val">' + (absent ? "pas dans le dossier" : fait ? "déjà tenté" : esc(coord)) + "</span></span></button>";
  }
  function resultatHtml(d, id) {
    var res = G.resultatTentative(d, id), c = G.canal(id);
    var coord = coordonneeCanal(d, id);
    var h = '<li class="tent tent-' + res + '"><span class="tent-ico" aria-hidden="true">' + ICON[ICON_CANAL[id]] + '</span><div><p class="tent-titre"><strong>' + esc(c.libelle) + "</strong> – " + esc(coord) + "</p>";
    if (res === "reponse") h += '<p class="tent-res tent-ok">' + ICON.check + "Le client répond.</p>";
    else if (res === "attente") h += '<p class="tent-res">' + ICON.clock + esc(QG.SANS_REPONSE.courrier) + "</p>";
    else h += '<p class="tent-res tent-ko">' + ICON.cross + esc(QG.SANS_REPONSE[id]) + "</p>";
    return h + "</div></li>";
  }
  function aideContact(d) {
    var t = tent(d), diff = t.filter(function (c, i) { return t.indexOf(c) === i; });
    if (!t.length) return "Choisissez un canal pour joindre le client. Vous pouvez en essayer plusieurs.";
    if (atteint(d)) return "Le client a répondu : lisez le compte rendu, puis passez à l'onglet « Moyens de régularisation ».";
    if (diff.length < 2) return "Pas de réponse. Essayez un autre canal.";
    return "Le client n'a pas répondu à deux canaux différents. Vous pouvez passer à la suite, ou le relancer par un autre canal.";
  }
  function compteRenduHtml(d) {
    if (!atteint(d)) return "";
    return '<section class="contact-rec" id="contact-rec" tabindex="-1" aria-labelledby="h-contact">' +
      '<div class="cr-tete"><span class="contact-ico contact-ico-lg" aria-hidden="true">' + ICON.phone + "</span><div>" +
      '<h3 id="h-contact">Compte rendu du contact</h3>' +
      '<p class="cr-meta"><strong>Date :</strong> ' + aujourdhui() + ". <strong>Client :</strong> " + esc(nomClient(d.client)) + ".</p></div></div>" +
      '<div class="cr-bloc"><p class="cr-titre">Échange avec le client</p><div class="echange">' + d.contact.echange.map(function (x) { return "<p>" + texte(x) + "</p>"; }).join("") + "</div></div>" +
      '<p class="mention">Le dossier client a été mis à jour : voir le bloc « Dossier mis à jour » en haut de page.</p></section>';
  }
  function contactHtml(d) {
    var t = tent(d);
    return '<fieldset class="opp canaux"><legend>Comment joindre le client ?</legend>' +
      '<p class="com-aide" id="contact-aide">' + aideContact(d) + "</p>" +
      '<div class="canaux-liste">' + G.CANAUX.map(function (c) { return boutonCanal(d, c); }).join("") + "</div></fieldset>" +
      (t.length ? '<ol class="tentatives" aria-label="Tentatives de contact">' + t.map(function (id) { return resultatHtml(d, id); }).join("") + "</ol>" : "") +
      compteRenduHtml(d);
  }

  /* ---------- onglet « Moyens de régularisation » ---------- */
  function totalSaisi(d) {
    return arrondi(moy(d).reduce(function (s, x) { var def = G.moyen(x.id); return s + (def && def.genre === "fonds" ? (+x.montant || 0) : 0); }, 0));
  }
  function totauxHtml(d) {
    var be = G.besoin(d), tot = totalSaisi(d), reste = arrondi(Math.max(0, be - tot)), p = G.palier(d.palier);
    return "<div><dt>Somme à verser</dt><dd>" + eur2(be) + "</dd></div><div><dt>Total annoncé par le client</dt><dd>" + eur2(tot) + "</dd></div><div><dt>Reste à trouver</dt><dd>" + eur2(reste) + "</dd></div>" +
      (p.delaiMax != null ? '<div><dt>Délai avant le palier suivant</dt><dd>' + p.delaiMax + " jours</dd></div>" : "");
  }
  function ligneMoyen(d, m) {
    var sel = moy(d).filter(function (x) { return x.id === m.id; })[0], valide = estValide(d);
    var h = '<div class="moyen' + (sel ? " est-actif" : "") + '"><label class="opp-choix moyen-choix' + (sel ? " est-actif" : "") + '">' +
      '<input type="checkbox" data-moyen="' + m.id + '"' + (sel ? " checked" : "") + (valide ? " disabled" : "") + ' aria-describedby="moyens-aide">' +
      '<span class="moyen-txt"><span class="decision-lib">' + esc(m.libelle) + '</span><span class="decision-aide">' + esc(m.aide) + "</span></span></label>";
    if (sel && m.genre === "fonds") {
      h += '<div class="moyen-champs"><label class="champ-m">Montant annoncé (€)<input type="number" inputmode="decimal" min="0" step="10" data-champ="montant" data-moyen="' + m.id + '" value="' + (sel.montant > 0 ? sel.montant : "") + '"' + (valide ? " disabled" : "") + '></label>' +
        '<label class="champ-m">Délai annoncé<select data-champ="delai" data-moyen="' + m.id + '"' + (valide ? " disabled" : "") + '><option value="">Choisir…</option>' +
        G.DELAIS.map(function (x) { return '<option value="' + x.j + '"' + (typeof sel.delai === "number" && sel.delai === x.j ? " selected" : "") + ">" + esc(x.libelle) + "</option>"; }).join("") + "</select></label></div>";
    }
    return h + "</div>";
  }
  function moyensHtml(d) {
    if (!contactOk(d)) {
      return '<div class="verrou-msg">' + ICON.lock + "<p>Cette étape s'ouvre après le contact avec le client. Choisissez un canal dans l'onglet « Contact » : le client répond, ou reste injoignable après deux canaux différents.</p></div>";
    }
    var parGenre = function (g) { return G.MOYENS.filter(function (m) { return m.genre === g; }); };
    var h = '<fieldset class="opp moyens"><legend>Quels moyens de régularisation le client annonce-t-il ?</legend>' +
      '<p class="com-aide" id="moyens-aide">' + (estValide(d) ? "Votre saisie est figée : le dossier est validé." : "Cochez ce que le client a réellement annoncé, puis indiquez le montant et le délai. Une ressource qu'il n'a pas citée ne se saisit pas. Sans solution, cochez une démarche d'accompagnement ou « aucun moyen ».") + "</p>" +
      '<h4 class="moyens-titre">Ressources financières</h4>' + parGenre("fonds").map(function (m) { return ligneMoyen(d, m); }).join("") +
      '<h4 class="moyens-titre">Démarches d\'accompagnement</h4>' + parGenre("social").map(function (m) { return ligneMoyen(d, m); }).join("") +
      '<h4 class="moyens-titre">Aucune solution</h4>' + parGenre("aucun").map(function (m) { return ligneMoyen(d, m); }).join("") +
      "</fieldset>" +
      '<dl class="moyens-totaux" id="moyens-totaux">' + totauxHtml(d) + "</dl>";
    var fonds = moy(d).filter(function (x) { var def = G.moyen(x.id); return def && def.genre === "fonds"; });
    if (fonds.length && moyensCompletes(d)) {
      h += '<div class="engagement"><p><strong>Engagement de régularisation.</strong> Si le client est en agence ou prêt à signer, éditez le document qui reprend ses montants et ses dates : il le lit, le date et le signe.</p>' +
        '<button type="button" class="btn btn-secondaire btn-impr" data-act="engagement">' + ICON.print + "<span>Éditer l'engagement de régularisation (à signer par le client)</span></button></div>";
    }
    if (estValide(d)) h += '<div class="opp-correction">' + moyensVerdictHtml(d) + "</div>";
    return h;
  }
  function moyensVerdictHtml(d) {
    var n = G.noterMoyens(d, moy(d));
    var h = n.verdict === "ok" ? '<p class="verdict verdict-ok">' + ICON.check + "Bonne saisie (1 point)</p>"
      : n.verdict === "defendable" ? '<p class="verdict verdict-def">' + ICON.info + "Saisie incomplète (0,5 point)</p>"
        : '<p class="verdict verdict-ko">' + ICON.cross + "À revoir (0 point)</p>";
    return h + '<p class="op-expl">' + esc(n.motif) + "</p>";
  }

  /* ---------- onglet « Suite à donner » ---------- */
  function decisionFieldset(d) {
    var valide = estValide(d), dec = decisionDe(d), p = G.palier(d.palier);
    var h = '<fieldset class="opp decision"><legend>Votre décision au palier ' + p.court + "</legend>" +
      '<p class="com-aide" id="decision-aide">' + esc(p.objet) + "</p><div class=\"opp-liste\">";
    G.DECISIONS[d.palier].forEach(function (i) {
      var actif = dec === i.code;
      h += '<label class="opp-choix choix-decision' + (actif ? " est-actif" : "") + (valide && i.code === d.attendu.decision ? " opp-attendue" : "") + '">' +
        '<input type="radio" name="decision" value="' + i.code + '" data-decision="' + i.code + '"' + (actif ? " checked" : "") + (valide ? " disabled" : "") + ' aria-describedby="decision-aide">' +
        '<span class="dec-ico" aria-hidden="true">' + (i.code === "cloturer" ? ICON.flag : ICON.shield) + "</span>" +
        '<span class="dec-txt"><span class="decision-lib">' + esc(i.libelle) + '</span><span class="decision-aide">' + esc(i.aide) + "</span></span></label>";
    });
    return h + "</div></fieldset>";
  }
  function procedureFieldset(d) {
    var valide = estValide(d), c = proc(d), el = G.elementsProcedure(d);
    function groupe(titre, genre) {
      var l = el.filter(function (e) { return e.genre === genre; });
      if (!l.length) return "";
      return '<h4 class="moyens-titre">' + titre + "</h4>" + l.map(function (e) {
        var actif = !!c[e.cle];
        return '<label class="opp-choix choix-proc' + (actif ? " est-actif" : "") + '"><input type="checkbox" data-proc="' + esc(e.cle) + '"' + (actif ? " checked" : "") + (valide ? " disabled" : "") + ' aria-describedby="proc-aide">' +
          '<span class="dec-txt"><span class="decision-lib">' + esc(e.libelle) + (e.montant ? " – " + eur2(e.montant) : "") + "</span></span></label>";
      }).join("");
    }
    return '<fieldset class="opp decision"><legend>Procédure J90</legend>' +
      '<p class="com-aide" id="proc-aide">' + esc(G.palier(90).objet) + " Cochez chaque action une fois réalisée.</p>" +
      groupe("1. Clôturer les services", "service") + groupe("2. Opposer les prélèvements", "prelevement") + groupe("3. Envoyer le compte au service de recouvrement amiable", "sra") + "</fieldset>";
  }
  function tuileScore(lib, ico, val, etat) {
    return '<li class="st st-' + etat + '"><span class="st-ico">' + ICON[ico] + '</span><span class="st-lib">' + lib + '</span><span class="st-val">' + val + "</span></li>";
  }
  function correctionHtml(d) {
    var sc = scoreDe(d), dec = G.libelleDecision(d.palier, d.attendu.decision);
    var eC = sc.contact.verdict === "ok" ? "ok" : "ko", eM = sc.moyens.verdict === "ok" ? "ok" : sc.moyens.verdict === "defendable" ? "def" : "ko", eS = sc.suite.verdict === "ok" ? "ok" : sc.suite.verdict === "defendable" ? "def" : "ko";
    var h = '<section class="correction" id="correction" tabindex="-1" aria-labelledby="h-corr"><h3 id="h-corr">Correction du dossier</h3>' +
      '<p class="score">Contact, moyens et suite : <strong>' + pts(sc.contact.points + sc.moyens.points + sc.suite.points) + " sur 3</strong> points." + (d.attendu.courrier ? " Le courrier se note après son envoi (onglet « Courrier »)." : "") + "</p>" +
      '<ul class="score-tuiles" aria-hidden="true">' +
      tuileScore("Contact", "phone", sc.contact.points + " / 1", eC) + tuileScore("Moyens", "coins", pts(sc.moyens.points) + " / 1", eM) + tuileScore("Suite", "shield", pts(sc.suite.points) + " / 1", eS) + "</ul>" +
      "<p><strong>Objectif du dossier.</strong> " + esc(d.objectif) + "</p>" +
      (sc.contact.verdict === "ok" ? '<p class="verdict verdict-ok">' + ICON.check + "Contact réussi (1 point)</p>" : '<p class="verdict verdict-ko">' + ICON.cross + "Contact à revoir (0 point)</p>") +
      "<p>" + (sc.contact.joignable ? "Le client était joignable : il fallait obtenir sa réponse." : "Le client était injoignable : un client qui ne répond pas se relance par au moins deux canaux différents, dont le courrier, qui laisse une trace écrite.") + "</p>" +
      moyensVerdictHtml(d);
    if (d.palier === 90) {
      var np = sc.suite;
      h += (np.verdict === "ok" ? '<p class="verdict verdict-ok">' + ICON.check + "Procédure J90 complète (1 point)</p>" : np.verdict === "defendable" ? '<p class="verdict verdict-def">' + ICON.info + "Procédure incomplète (0,5 point)</p>" : '<p class="verdict verdict-ko">' + ICON.cross + "Procédure à revoir (0 point)</p>");
      if (np.manquants && np.manquants.length) h += "<p>Actions non cochées : " + np.manquants.map(function (m) { return esc(m.libelle); }).join(" ; ") + ".</p>";
    } else {
      h += "<p><strong>Décision attendue.</strong> " + esc(dec) + ". Votre décision : " + esc(decisionDe(d) ? G.libelleDecision(d.palier, decisionDe(d)) : "aucune") + ".</p>" +
        (sc.suite.verdict === "ok" ? '<p class="verdict verdict-ok">' + ICON.check + "Bonne décision (1 point)</p>" : '<p class="verdict verdict-ko">' + ICON.cross + "À revoir (0 point)</p>");
    }
    h += "<h4>À retenir</h4><ul>" + d.retenir.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></section>";
    return h;
  }
  function suiteZone(d) {
    if (!contactOk(d) || !moyensCompletes(d)) {
      return '<div class="verrou-msg">' + ICON.lock + "<p>Cette étape s'ouvre après le contact avec le client et l'enregistrement des moyens de régularisation (onglets « Contact » puis « Moyens de régularisation »).</p></div>";
    }
    return (estValide(d) ? correctionHtml(d) : "") + (d.palier === 90 ? procedureFieldset(d) : decisionFieldset(d));
  }
  function suiteOuverte(d) { return contactOk(d) && moyensCompletes(d); }
  function autoEvalHtml(d) {
    if (!estValide(d)) return "";
    var coches = state.checks[d.id] || [], a = argumentaire(d), n = coches.filter(Boolean).length;
    var h = '<section class="autoeval" aria-labelledby="h-auto"><h3 id="h-auto">Auto-évaluation</h3>' +
      "<p>Voici les éléments attendus dans un bon commentaire. Cochez ceux que le vôtre mentionne.</p><ul>";
    a.forEach(function (x, i) { h += '<li><label><input type="checkbox" data-check="' + i + '"' + (coches[i] ? " checked" : "") + "> " + esc(x) + "</label></li>"; });
    return h + '</ul><p class="autoeval-total" id="autoeval-total">' + n + " élément" + (n > 1 ? "s" : "") + " sur " + a.length + " mentionné" + (n > 1 ? "s" : "") + ".</p></section>";
  }

  /* ---------- onglet « Courrier » ---------- */
  function apercuCourrier(d, modele) {
    var doc = DG.courrier(modele, d, { date: maintenant() });
    return '<div class="apercu-doc" role="region" aria-label="Aperçu du courrier : ' + esc(doc.titre) + '">' + doc.corps + "</div>";
  }
  function courrierHtml(d) {
    if (!estValide(d)) {
      return '<div class="verrou-msg">' + ICON.lock + "<p>Le courrier s'envoie une fois le dossier validé. Terminez les étapes précédentes, rédigez votre commentaire, puis cliquez sur « Valider ».</p></div>";
    }
    var rep = state.courriers[d.id], choix = state.choixCourrier[d.id] || (rep && rep.modele) || (rep && rep.aucun ? "aucun" : "");
    var h = '<fieldset class="opp courrier"><legend>Quel courrier envoyer au client ?</legend>' +
      '<p class="com-aide" id="courrier-aide">' + (rep ? "Votre choix est enregistré." : "Choisissez le courrier adapté au palier de " + d.palier + " jours, contrôlez-le, puis validez l'envoi : le PDF s'édite pour être posté. Si aucun courrier n'est nécessaire, indiquez-le.") + "</p><div class=\"opp-liste\">";
    G.courriersDuPalier(d.palier).forEach(function (c) {
      var actif = choix === c.id;
      h += '<label class="opp-choix choix-courrier' + (actif ? " est-actif" : "") + '"><input type="radio" name="courrier" value="' + c.id + '" data-courrier="' + c.id + '"' + (actif ? " checked" : "") + (rep ? " disabled" : "") + ' aria-describedby="courrier-aide">' +
        '<span class="dec-ico" aria-hidden="true">' + ICON.mail + '</span><span class="dec-txt"><span class="decision-lib">' + esc(c.libelle) + '</span><span class="decision-aide">' + esc(c.envoi) + " – " + esc(c.aide) + "</span></span></label>";
    });
    h += '<label class="opp-choix choix-courrier' + (choix === "aucun" ? " est-actif" : "") + '"><input type="radio" name="courrier" value="aucun" data-courrier="aucun"' + (choix === "aucun" ? " checked" : "") + (rep ? " disabled" : "") + ' aria-describedby="courrier-aide">' +
      '<span class="dec-ico" aria-hidden="true">' + ICON.check + '</span><span class="dec-txt"><span class="decision-lib">Aucun courrier à envoyer</span><span class="decision-aide">Le suivi se poursuit sans écrit.</span></span></label></div></fieldset>';
    if (choix && choix !== "aucun") {
      h += '<div class="apercu-tete"><h3>Aperçu du courrier</h3><p class="mention">Relisez le texte : nom, adresse, montants et dates doivent correspondre au dossier.</p></div>' + apercuCourrier(d, choix);
    }
    h += boutonEnvoi(d);
    if (rep) {
      var n = G.noterCourrier(d, courrierEnvoye(d));
      h += '<div class="opp-correction">';
      if (!d.attendu.courrier) h += rep.modele ? '<p class="verdict verdict-def">' + ICON.info + "Courrier non nécessaire (0 point, sans pénalité)</p><p class=\"op-expl\">À ce palier, ce dossier ne demandait pas de courrier : le client a déjà un échange en cours.</p>" : '<p class="verdict verdict-ok">' + ICON.check + "Pas de courrier : le dossier n'en demandait pas.</p>";
      else if (n.verdict === "ok") h += '<p class="verdict verdict-ok">' + ICON.check + "Bon courrier (1 point)</p><p class=\"op-expl\">" + esc(G.courrier(d.attendu.courrier).libelle) + " : " + esc(G.courrier(d.attendu.courrier).aide) + "</p>";
      else h += '<p class="verdict verdict-ko">' + ICON.cross + "À revoir (0 point)</p><p class=\"op-expl\">Courrier attendu : " + esc(G.courrier(d.attendu.courrier).libelle) + ". " + esc(G.courrier(d.attendu.courrier).aide) + "</p>";
      if (rep.modele) h += '<button type="button" class="btn btn-secondaire btn-impr" data-act="reediter">' + ICON.print + "<span>Éditer de nouveau le PDF</span></button>";
      h += "</div>";
    }
    return h;
  }
  function imprimerDocument(doc) {
    IMP.imprimer(IMP.document({ titre: doc.titre, sous: doc.sous, corps: doc.corps, courrier: doc.courrier }), doc.fichier);
  }

  /* ---------- barre d'actions ---------- */
  function aideActions(d) {
    if (estValide(d)) {
      if (!courrierRepondu(d)) return "Dossier validé. Choisissez le courrier à envoyer dans l'onglet « Courrier », ou indiquez qu'aucun courrier n'est nécessaire.";
      return "Dossier terminé. Passez au suivant quand vous êtes prêt.";
    }
    if (!contactOk(d)) return "Contactez le client dans l'onglet « Contact ».";
    if (!moyensCompletes(d)) return moy(d).length ? "Complétez le montant et le délai de chaque ressource financière dans l'onglet « Moyens de régularisation »." : "Enregistrez les moyens de régularisation dans l'onglet « Moyens de régularisation ».";
    if (!G.decisionPrise(d, ctx(d))) return d.palier === 90 ? "Cochez toutes les actions de la procédure J90 dans l'onglet « Suite à donner »." : "Choisissez votre décision dans l'onglet « Suite à donner ».";
    if (!commentaireOk(d)) return "Rédigez votre commentaire : il est obligatoire (au moins " + G.COMMENTAIRE_MIN + " caractères).";
    return "Tout est prêt : validez pour voir la correction, puis envoyez le courrier.";
  }
  function actionsHtml(d) {
    var valide = estValide(d), dernier = state.idx === DOS.length - 1;
    return '<p class="actions-aide" id="actions-aide">' + aideActions(d) + "</p>" +
      '<div class="actions-boutons"><button type="button" class="btn btn-secondaire" id="btn-valider" data-act="valider" aria-describedby="actions-aide"' + (valide || !pretValider(d) ? " disabled" : "") + ">" + (valide ? "Validé" : "Valider") + "</button>" +
      '<button type="button" class="btn btn-principal" id="btn-suivant" data-act="suivant" aria-describedby="actions-aide"' + (valide && courrierRepondu(d) ? "" : " disabled") + ">" + (dernier ? "Voir le bilan" : "Suivant") + "</button></div>";
  }

  var ETAPES = [["compte", "Compte et relevé"], ["contact", "Contact"], ["moyens", "Moyens de régularisation"], ["suite", "Suite à donner"], ["courrier", "Courrier"]];
  function etapesEtat(d) {
    var t = tent(d).length, valide = estValide(d), cr = courrierRepondu(d);
    return {
      compte: { fait: t > 0, texte: "À lire d'abord" },
      contact: { fait: contactOk(d), texte: contactOk(d) ? (atteint(d) ? "Client joint" : "Client injoignable") : t ? pl(t, "tentative", "tentatives") : "À faire" },
      moyens: { fait: contactOk(d) && moyensCompletes(d), texte: !contactOk(d) ? "Après le contact" : moyensCompletes(d) ? pl(moy(d).length, "moyen saisi", "moyens saisis") : "À saisir" },
      suite: { fait: valide, texte: valide ? "Dossier validé" : !suiteOuverte(d) ? "Après les moyens" : !G.decisionPrise(d, ctx(d)) ? (d.palier === 90 ? "Procédure à réaliser" : "À décider") : !commentaireOk(d) ? "Commentaire à rédiger" : "Prêt à valider" },
      courrier: { fait: cr, texte: cr ? (state.courriers[d.id].modele ? "Envoyé" : "Aucun courrier") : valide ? "À choisir" : "Après validation" }
    };
  }
  function ongletInterieur(libelle, e, rang) {
    return '<span class="etape-num" aria-hidden="true">' + (e.fait ? ICON.check : rang) + '</span><span class="etape-txt"><span class="etape-lib">' + libelle + '</span><span class="etape-etat">' + esc(e.texte) + "</span></span>";
  }
  function ongletHtml(nom, libelle, rang, e) {
    var actif = state.onglet === nom;
    return '<button type="button" role="tab" id="tab-' + nom + '" class="onglet' + (e.fait ? " etape-fait" : "") + '" aria-controls="panneau-' + nom + '" aria-selected="' + actif + '" tabindex="' + (actif ? 0 : -1) + '" data-act="onglet" data-tab="' + nom + '">' + ongletInterieur(libelle, e, rang) + "</button>";
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
    var d = dossierCourant(), com = state.comments[d.id] || "", et = etapesEtat(d);
    function panneau(nom, contenu) { return '<div role="tabpanel" id="panneau-' + nom + '" class="panneau" aria-labelledby="tab-' + nom + '"' + (state.onglet === nom ? "" : " hidden") + ">" + contenu + "</div>"; }
    var h = '<div class="poste">' +
      '<h1 class="titre-poste">Gestion des incidents<span>Dossier ' + (state.idx + 1) + " sur " + DOS.length + "</span></h1>" +
      bandeauClient(d) +
      '<div class="poste-grille"><div class="col-gauche" id="col-gauche">' + colonneGauche(d) + "</div>" +
      '<div class="col-droite"><section class="bloc bloc-travail">' +
      '<div class="onglets onglets-etapes onglets-gdi" role="tablist" aria-label="Étapes du dossier">' + ETAPES.map(function (t, i) { return ongletHtml(t[0], t[1], i + 1, et[t[0]]); }).join("") + "</div>" +
      panneau("compte", '<div id="zone-compte">' + compteHtml(d) + "</div>") +
      panneau("contact", '<div id="zone-contact">' + contactHtml(d) + "</div>") +
      panneau("moyens", '<div id="zone-moyens">' + moyensHtml(d) + "</div>") +
      panneau("suite", '<div id="zone-suite">' + suiteZone(d) + "</div>" +
        '<div id="decision-com"' + (suiteOuverte(d) ? "" : " hidden") + ">" +
        '<label class="com-label" for="commentaire">Commentaire du conseiller (obligatoire)</label>' +
        '<p class="com-aide" id="com-aide">Consignez votre analyse : situation du compte, échange avec le client, moyens de régularisation et leurs dates, décision et suite prévue. Le commentaire est obligatoire pour valider le dossier.</p>' +
        '<textarea id="commentaire" rows="8" maxlength="' + MAX_COM + '" aria-required="true" aria-describedby="com-aide com-compteur">' + esc(com) + "</textarea>" +
        '<p class="com-compteur" id="com-compteur">' + compteurTexte(com.trim().length) + "</p>" +
        '<div id="autoeval">' + autoEvalHtml(d) + "</div></div>") +
      panneau("courrier", '<div id="zone-courrier">' + courrierHtml(d) + "</div>") +
      '<div class="actions" id="actions">' + actionsHtml(d) + "</div>" +
      "</section></div></div></div>";
    app.innerHTML = h;
  }

  /* mises à jour partielles : on garde le texte du commentaire et le focus */
  function rafraichir() {
    var d = dossierCourant();
    function mettre(id, html) { var z = document.getElementById(id); if (z) z.innerHTML = html; }
    mettre("col-gauche", colonneGauche(d));
    mettre("zone-contact", contactHtml(d));
    mettre("zone-moyens", moyensHtml(d));
    mettre("zone-suite", suiteZone(d));
    mettre("zone-courrier", courrierHtml(d));
    var dc = document.getElementById("decision-com");
    if (dc) dc.hidden = !suiteOuverte(d);
    mettre("autoeval", autoEvalHtml(d));
    majActions();
  }
  function majActions() {
    var d = dossierCourant(), act = document.getElementById("actions");
    if (act) act.innerHTML = actionsHtml(d);
    majEtapes();
  }

  /* ---------- bilan ---------- */
  function enteteImpression(outil) {
    var im = document.querySelector(".logo-tuile img"), src = im ? im.getAttribute("src") : "assets/logo.png";
    return '<div class="imprime-entete"><img src="' + esc(src) + '" width="56" height="56" alt=""><div><p class="imprime-banque">GS Banque & Assurance</p><p class="imprime-agence">Agence de Paris – ' + esc(outil) + "</p></div></div>";
  }
  function resumeDossier(d) {
    var sc = scoreDe(d), t = tent(d).map(function (id) { return G.canal(id).court; });
    var rep = state.courriers[d.id];
    var l = "Contact : " + (t.length ? t.join(", ") : "aucun") + " (" + (sc.contact.verdict === "ok" ? "juste" : "à revoir") + ")<br>" +
      "Moyens : " + (moy(d).length ? moy(d).map(function (x) { return esc(G.libelleMoyen(x.id)) + (x.montant ? " " + eur(x.montant) : ""); }).join(" ; ") : "aucun") + " (" + (sc.moyens.verdict === "ok" ? "juste" : sc.moyens.verdict === "defendable" ? "défendable" : "à revoir") + ")<br>" +
      "Suite : " + (d.palier === 90 ? "procédure J90, " + sc.suite.faits + " action" + (sc.suite.faits > 1 ? "s" : "") + " sur " + sc.suite.total : esc(decisionDe(d) ? G.libelleDecision(d.palier, decisionDe(d)) : "non prise")) + " (" + (sc.suite.verdict === "ok" ? "juste" : sc.suite.verdict === "defendable" ? "défendable" : "à revoir") + ")<br>" +
      "Courrier : " + (rep && rep.modele ? esc(G.courrier(rep.modele).libelle) : "aucun") + (d.attendu.courrier ? " (" + (sc.courrier.verdict === "ok" ? "juste" : "à revoir") + ")" : "");
    return l;
  }
  function vueBilan() {
    var total = totalPoints(), max = totalMax(), pc = max ? Math.round((total / max) * 100) : 0;
    var h = '<section class="bilan" aria-labelledby="t-bilan">' + enteteImpression("Gestion des incidents") + '<h1 id="t-bilan">Bilan de la séance</h1>' +
      '<form class="identite-form identite-bilan" data-form="eleve" autocomplete="off">' +
      '<div class="champ"><label for="nom">Nom et prénom</label><input id="nom" name="nom" type="text" maxlength="60" value="' + esc(state.eleve.nom) + '"></div>' +
      '<div class="champ"><label for="classe">Classe</label><input id="classe" name="classe" type="text" maxlength="30" value="' + esc(state.eleve.classe) + '"></div>' +
      "</form>" +
      '<p class="imprime-id" id="imprime-id"></p>' +
      '<div class="bilan-tete"><div class="anneau" style="--p:' + pc + '" aria-hidden="true"><span>' + pc + ' %</span></div>' +
      '<p class="bilan-score"><strong>' + pts(total) + " sur " + max + "</strong> points, soit " + pc + " %</p></div>" +
      '<table class="bilan-table"><caption class="sr">Résultats par dossier</caption><thead><tr><th scope="col">Dossier</th><th scope="col">Client</th><th scope="col">Votre analyse</th><th scope="col">Points</th></tr></thead><tbody>';
    DOS.forEach(function (d) {
      var sc = scoreDe(d), traite = estValide(d), mx = G.maxDossier(d);
      var coches = (state.checks[d.id] || []).filter(Boolean).length, com = (state.comments[d.id] || "").trim();
      h += '<tr><th scope="row">' + d.id + "</th><td>" + esc(d.client.civilite + " " + d.client.nom) + " (J" + d.palier + ")</td><td>" + (traite ? resumeDossier(d) : "non traité") + "</td><td>" +
        (traite ? '<span class="chip ' + (sc.total === mx ? "chip-ok" : sc.total === 0 ? "chip-bad" : "chip-warn") + '">' + pts(sc.total) + " / " + mx + "</span>" : "non traité") + "</td></tr>";
      h += '<tr class="bilan-com"><td></td><td colspan="3"><strong>Commentaire :</strong> ' + (com ? esc(com).replace(/\n/g, "<br>") : "<em>aucun</em>") +
        (traite ? '<br><span class="bilan-auto">Éléments attendus mentionnés : ' + coches + " sur " + argumentaire(d).length + "</span>" : "") + "</td></tr>";
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
    btnRecommencer.hidden = state.screen === "accueil" && state.idx === 0 && !Object.keys(state.valides).length && !Object.keys(state.tentatives).length;
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
  function activerOnglet(nom, focus) {
    state.onglet = nom;
    TABS.forEach(function (t) {
      var tab = document.getElementById("tab-" + t), pan = document.getElementById("panneau-" + t);
      if (!tab || !pan) return;
      var actif = t === nom;
      tab.setAttribute("aria-selected", String(actif));
      tab.tabIndex = actif ? 0 : -1;
      pan.hidden = !actif;
      if (actif && focus) tab.focus();
    });
    sauver();
  }
  function essayerCanal(id) {
    var d = dossierCourant();
    if (estValide(d) || tent(d).indexOf(id) >= 0 || !coordonneeCanal(d, id)) return;
    tent(d).push(id);
    sauver();
    rafraichir();
    var c = document.getElementById("contact-rec");
    if (c && atteint(d)) { c.focus({ preventScroll: true }); c.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
  }
  function basculerMoyen(id, coche) {
    var d = dossierCourant(), m = moy(d), pos = -1, i;
    if (estValide(d)) return;
    for (i = 0; i < m.length; i++) if (m[i].id === id) pos = i;
    if (coche && pos < 0) {
      if (id === "aucun") m.length = 0;
      else for (i = m.length - 1; i >= 0; i--) if (m[i].id === "aucun") m.splice(i, 1);
      m.push({ id: id, montant: 0, delai: null });
    }
    if (!coche && pos >= 0) m.splice(pos, 1);
    sauver();
    rafraichir();
    var again = app.querySelector('[data-moyen="' + id + '"]');
    if (again && again.type === "checkbox") again.focus();
  }
  function valider() {
    var d = dossierCourant();
    if (estValide(d) || !pretValider(d)) return;
    state.valides[d.id] = true;
    sauver();
    rafraichir();
    majEntete();
    activerOnglet("suite", false);
    var c = document.getElementById("correction");
    if (c) { c.focus({ preventScroll: true }); c.scrollIntoView({ block: "start", behavior: "smooth" }); }
  }
  function suivant() {
    var d = dossierCourant();
    if (!estValide(d) || !courrierRepondu(d)) return;
    if (state.idx < DOS.length - 1) { state.idx += 1; state.onglet = "compte"; render(true); }
    else { state.screen = "bilan"; render(true); }
  }
  function envoyerCourrier() {
    var d = dossierCourant(), choix = state.choixCourrier[d.id];
    if (!estValide(d) || courrierRepondu(d) || !choix) return;
    if (choix === "aucun") { state.courriers[d.id] = { aucun: true }; }
    else {
      state.courriers[d.id] = { modele: choix, date: fmtDate(maintenant()) };
      imprimerDocument(DG.courrier(choix, d, { date: maintenant() }));
    }
    sauver();
    rafraichir();
    majEntete();
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
    var act = t.getAttribute("data-act"), d;
    if (act === "demarrer") { state.screen = "dossier"; render(true); }
    else if (act === "canal") essayerCanal(t.getAttribute("data-canal"));
    else if (act === "valider") valider();
    else if (act === "suivant") suivant();
    else if (act === "onglet") activerOnglet(t.getAttribute("data-tab"), false);
    else if (act === "engagement") { d = dossierCourant(); imprimerDocument(DG.engagement(d, moy(d), { date: maintenant() })); }
    else if (act === "envoyer") envoyerCourrier();
    else if (act === "reediter") { d = dossierCourant(); var c = state.courriers[d.id]; if (c && c.modele) imprimerDocument(DG.courrier(c.modele, d, { date: maintenant() })); }
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
      sauver();
    } else if (t.hasAttribute && t.getAttribute("data-champ") === "montant") {
      var dd = dossierCourant(), ligne = moy(dd).filter(function (x) { return x.id === t.getAttribute("data-moyen"); })[0];
      if (ligne && !estValide(dd)) {
        ligne.montant = Math.max(0, parseFloat(String(t.value).replace(",", ".")) || 0);
        var tot = document.getElementById("moyens-totaux");
        if (tot) tot.innerHTML = totauxHtml(dd);
        sauver();
        majActions();
      }
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
    if (t.hasAttribute("data-moyen") && t.type === "checkbox") { basculerMoyen(t.getAttribute("data-moyen"), t.checked); return; }
    if (t.getAttribute("data-champ") === "delai") {
      var ligne = moy(d).filter(function (x) { return x.id === t.getAttribute("data-moyen"); })[0];
      if (ligne && !estValide(d)) { ligne.delai = t.value === "" ? null : parseInt(t.value, 10); sauver(); rafraichir(); }
      return;
    }
    if (t.getAttribute("data-champ") === "montant") { sauver(); rafraichir(); return; }
    if (t.hasAttribute("data-decision")) {
      if (estValide(d) || !suiteOuverte(d)) return;
      state.decisions[d.id] = t.getAttribute("data-decision");
      sauver(); majGroupe("decision"); majActions();
      return;
    }
    if (t.hasAttribute("data-proc")) {
      if (estValide(d) || !suiteOuverte(d)) return;
      proc(d)[t.getAttribute("data-proc")] = t.checked;
      var lab = t.closest("label");
      if (lab) lab.classList.toggle("est-actif", t.checked);
      sauver(); majActions();
      return;
    }
    if (t.hasAttribute("data-courrier")) {
      if (!estValide(d) || courrierRepondu(d)) return;
      state.choixCourrier[d.id] = t.getAttribute("data-courrier");
      sauver();
      var z = document.getElementById("zone-courrier");
      if (z) z.innerHTML = courrierHtml(d);
      return;
    }
    if (t.hasAttribute("data-check")) {
      var a = argumentaire(d), arr = state.checks[d.id] || [];
      arr[parseInt(t.getAttribute("data-check"), 10)] = t.checked;
      for (var i = 0; i < a.length; i++) arr[i] = !!arr[i];
      state.checks[d.id] = arr;
      var n = arr.filter(Boolean).length, tot = document.getElementById("autoeval-total");
      if (tot) tot.textContent = n + " élément" + (n > 1 ? "s" : "") + " sur " + a.length + " mentionné" + (n > 1 ? "s" : "") + ".";
      sauver();
    }
  });

  /* Bouton d'envoi : sous l'aperçu (ou seul pour « aucun courrier ») tant que le choix n'est pas enregistré. */
  function boutonEnvoi(d) {
    var choix = state.choixCourrier[d.id];
    if (!choix || courrierRepondu(d)) return "";
    return '<div class="actions-courrier"><button type="button" class="btn btn-principal btn-impr" data-act="envoyer">' + (choix === "aucun" ? "Confirmer : aucun courrier" : ICON.print + "<span>Valider l'envoi et éditer le PDF</span>") + "</button></div>";
  }

  window.addEventListener("beforeprint", majIdentiteImprimee);

  render(false);
})();
