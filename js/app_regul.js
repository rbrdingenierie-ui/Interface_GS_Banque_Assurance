/* GS Banque & Assurance – page « Régularisation FCC » : régulariser un chèque rejeté pour défaut de provision dont la lettre d'injonction a été envoyée (le titulaire est interdit bancaire).
   Le conseiller choisit le chèque, le mode de régularisation (blocage de provision, par versement d'espèces ou par virement prélevé directement sur le compte, ou remise du chèque et paiement du bénéficiaire autrement), atteste ses vérifications, puis valide :
   la lettre d'injonction est complétée (déclaration de régularisation, cadre de la banque) et remise au titulaire, la régularisation est déclarée aussitôt à la Banque de France (la règle accorde 2 jours ouvrés au plus)
   et la Banque de France met son fichier à jour dans le mois. Les règles sont dans regul.js ; l'état « déclarée, mise à jour en cours » ne s'affiche qu'ici, jamais dans « Interro BDF ».
   Adresse : regularisation_fcc.html?cle=… ouvre directement le panneau de régularisation d'un chèque. */
(function () {
  "use strict";

  var SG = window.SGBF, B = SG.banque, RG = SG.regul, INJ = SG.injonction, IMP = SG.impression, ID = SG.identite, X = SG.bdf, ICO = SG.icones, app = document.getElementById("app");
  var esc = B.esc;
  var etat = { cle: null, saisie: { mode: "", moyen: "", versement: "", paiement: "", verifs: [] }, err: null, fait: null };
  var params = new URLSearchParams(location.search);

  function st() { return B.store.charger(); }
  function nomEleve() { var s = st(); return (s.eleve && s.eleve.nom) || ""; }
  function dateLongue(ymd) { var d = B.lireYmd(ymd); return d ? d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : ""; }
  function euros(n) { return B.eur2(n).replace(/,00(\s| )€/, "$1€"); }
  function titulaire(c) { return c.civilite + " " + c.prenom + " " + String(c.nom).toUpperCase(); }
  function cleBdf(d) { return X.cle(d.identite.naissance, d.identite.nom); }
  function lienBdf(d) { return "interro_bdf.html?nom=" + encodeURIComponent(d.identite.nom) + "&naissance=" + d.identite.naissance + "&fichier=fcc"; }
  function ouvert() { return etat.cle ? RG.dossier(st(), etat.cle, B.maintenant()) : null; }

  /* ---------- déroulé ---------- */
  function deroule() {
    var e = [
      ["Le titulaire se présente", "Avec sa lettre d'injonction : il souhaite lever son interdiction d'émettre des chèques."],
      ["La régularisation", "Blocage de provision (espèces ou virement), ou remise du chèque et paiement du bénéficiaire autrement."],
      ["La lettre complétée", "La déclaration de régularisation est complétée, signée par le titulaire et remise avec le cadre de la banque."],
      ["La Banque de France", "La banque déclare la régularisation aussitôt (la règle lui accorde " + RG.JOURS_DECLARATION + " jours ouvrés au plus) ; le fichier est mis à jour dans le mois."]
    ];
    return '<ol class="op-deroule regul-deroule" aria-label="Déroulé d\'une régularisation">' + e.map(function (x, i) {
      return '<li><span class="op-deroule-num" aria-hidden="true">' + (i + 1) + '</span><span class="op-deroule-txt"><strong>' + esc(x[0]) + "</strong><span>" + esc(x[1]) + "</span></span></li>";
    }).join("") + "</ol>";
  }

  /* ---------- bilan ---------- */
  function bilan(ds) {
    function n(e) { return ds.filter(function (d) { return d.etat === e; }).length; }
    var l = [["À régulariser", n("a_regulariser"), "regul-b-warn"], ["Régularisation déclarée, mise à jour du fichier en cours", n("declaree"), "regul-b-info"], ["Fichier de la Banque de France à jour", n("levee"), "regul-b-ok"]];
    return '<dl class="regul-bilan" aria-label="Bilan des régularisations">' + l.map(function (x) { return '<div class="regul-b ' + x[2] + '"><dt>' + esc(x[0]) + "</dt><dd>" + x[1] + "</dd></div>"; }).join("") + "</dl>";
  }

  /* ---------- liste des chèques ---------- */
  function puceEtat(d) {
    if (d.etat === "a_regulariser") return '<span class="chip chip-warn">' + ICO.alerte + "À régulariser</span>";
    if (d.etat === "declaree") return '<span class="chip chip-ctrl">' + ICO.info + "Régularisation déclarée, mise à jour en cours</span>";
    return '<span class="chip chip-ok">' + ICO.check + "Incident régularisé, fichier à jour</span>";
  }
  function suivi(d) {
    var r = d.regul; if (!r) return "";
    var mode = r.mode !== "provision" ? "remise du chèque, bénéficiaire payé " + RG.libPaiement(r.paiement)
      : r.moyen === "virement" ? "blocage de provision par virement (" + euros(r.bloque) + " prélevés directement sur le compte et bloqués)"
      : "blocage de provision en espèces (" + euros(r.bloque) + " bloqués, " + euros(r.versement) + " versés)";
    var h = "<strong>Régularisation du " + esc(dateLongue(r.date)) + " :</strong> " + esc(mode) + ". ";
    if (d.etat === "declaree") h += "Déclarée à la Banque de France le " + esc(dateLongue(r.declaree)) + " ; mise à jour du fichier central des chèques attendue dans le mois, d'ici le " + esc(dateLongue(r.levee)) + ".";
    else h += "Le fichier central des chèques est à jour depuis le " + esc(dateLongue(r.levee)) + ".";
    return '<p class="regul-suivi regul-suivi-' + (d.etat === "declaree" ? "cours" : "fait") + '">' + h + "</p>";
  }
  function noteAutres(d) {
    if (!d.autresNonRegularises) return "";
    var n = d.autresNonRegularises;
    return '<p class="regul-note">' + ICO.info + "<span>Ce titulaire a " + n + " autre" + (n > 1 ? "s" : "") + " chèque" + (n > 1 ? "s" : "") + " impayé" + (n > 1 ? "s" : "") + " à régulariser : l'interdiction d'émettre des chèques ne sera levée qu'une fois tous les incidents régularisés.</span></p>";
  }
  function carte(d) {
    var i = d.identite, c = d.client;
    var h = '<li class="regul-carte regul-carte-' + d.etat + '" id="regul-' + esc(d.cle.replace(/[^A-Za-z0-9]+/g, "-")) + '"><div class="regul-carte-tete"><div><h3 class="regul-nom">' + esc(titulaire(c)) + '</h3><p class="regul-sous">Compte n° ' + esc(d.compte) + "</p></div>" + puceEtat(d) + "</div>" +
      '<dl class="regul-donnees">' +
      "<div><dt>Chèque impayé</dt><dd>n° " + esc(d.cheque) + " – <strong>" + esc(euros(d.montant)) + "</strong></dd></div>" +
      "<div><dt>Bénéficiaire</dt><dd>" + esc(d.beneficiaire || "–") + "</dd></div>" +
      "<div><dt>Lettre d'injonction</dt><dd>envoyée le " + esc(dateLongue(d.dateInjonction)) + "</dd></div>" +
      "<div><dt>Inscription au FCC</dt><dd>" + esc(i.nom + " " + i.prenoms.split(" ")[0].charAt(0) + i.prenoms.split(" ")[0].slice(1).toLowerCase()) + ", né" + (i.sexe === "F" ? "e" : "") + " le " + esc(X.point(i.naissance)) + " à " + esc(i.lieu) + " – clé <code>" + esc(cleBdf(d)) + "</code></dd></div></dl>" +
      suivi(d) + noteAutres(d) + '<div class="regul-actions">';
    if (d.etat === "a_regulariser") h += '<button type="button" class="btn btn-principal" data-act="ouvrir" data-cle="' + esc(d.cle) + '">Régulariser ce chèque</button>';
    else h += '<button type="button" class="btn btn-secondaire" data-act="lettre" data-cle="' + esc(d.cle) + '">Lettre d\'injonction complétée' + ICO.imprimante + "</button>";
    h += '<a class="btn-texte" href="' + esc(lienBdf(d)) + '">Interroger la Banque de France</a></div></li>';
    return h;
  }
  function liste(ds) {
    if (!ds.length) {
      return '<section class="bloc" aria-labelledby="regul-t-liste"><div class="bloc-tete"><h2 id="regul-t-liste">Chèques impayés inscrits au FCC</h2></div>' +
        '<p class="vide-bloc">Aucun chèque à régulariser pour le moment. Un chèque apparaît ici lorsque sa lettre d\'injonction a été envoyée : voir la procédure MURCEF dans <a href="debiteurs.html">Opérations débiteurs</a>.</p></section>';
    }
    return '<section class="bloc" aria-labelledby="regul-t-liste"><div class="bloc-tete"><h2 id="regul-t-liste">Chèques impayés inscrits au FCC</h2><span class="sous">' + ds.length + " chèque" + (ds.length > 1 ? "s" : "") + ", du plus récent au plus ancien</span></div>" +
      bilan(ds) + '<ul class="regul-liste">' + ds.map(carte).join("") + "</ul></section>";
  }

  /* ---------- panneau de régularisation ---------- */
  function panneau(d) {
    var s = etat.saisie, m = s.mode, err = etat.err;
    function invalide(champ) { return err && err.champ === champ ? ' aria-invalid="true" aria-describedby="regul-err"' : ""; }
    var modes = RG.MODES.map(function (x) {
      return '<label class="regul-mode"><input type="radio" name="regul-mode" id="regul-mode-' + x.code + '" value="' + x.code + '"' + (m === x.code ? " checked" : "") + (err && err.champ === "mode" ? ' aria-invalid="true" aria-describedby="regul-err"' : "") + '>' +
        '<span class="regul-mode-t">' + esc(x.libelle) + '</span><span class="regul-mode-a">' + esc(x.aide) + "</span></label>";
    }).join("");
    var detail = "";
    if (m === "provision") {
      var moyens = RG.MOYENS_PROVISION.map(function (x) {
        return '<label class="regul-mode"><input type="radio" name="regul-moyen" id="regul-moyen-' + x.code + '" value="' + x.code + '"' + (s.moyen === x.code ? " checked" : "") + (err && err.champ === "moyen" ? ' aria-invalid="true" aria-describedby="regul-err"' : "") + '>' +
          '<span class="regul-mode-t">' + esc(x.libelle) + '</span><span class="regul-mode-a">' + esc(x.aide) + "</span></label>";
      }).join("");
      detail = '<fieldset class="op-radio regul-moyens"><legend>Comment la provision est-elle constituée ? *</legend><div class="regul-modes">' + moyens + "</div></fieldset>";
    }
    if (m === "provision" && s.moyen === "virement") {
      detail += '<p class="regul-prelevement" id="regul-prelevement">' + ICO.info + "<span>Par virement, la somme est prélevée <strong>directement sur le compte n° " + esc(d.compte) + "</strong> : <strong>" + esc(euros(d.montant)) +
        "</strong> sont bloqués au profit du bénéficiaire, qui peut représenter le chèque pendant 1 an et 8 jours. Aucun versement d'espèces n'est à saisir ; le solde disponible du compte doit couvrir cette somme.</span></p>";
    } else if (m === "provision" && s.moyen === "especes") {
      detail += '<div class="champ regul-champ"><label for="regul-versement">Somme versée en espèces (€) *</label><input id="regul-versement" type="text" inputmode="decimal" autocomplete="off" value="' + esc(s.versement) + '"' + invalide("versement") + ' aria-describedby="regul-aide-versement' + (err && err.champ === "versement" ? " regul-err" : "") + '">' +
        '<span class="aide-champ" id="regul-aide-versement">Au moins ' + esc(euros(d.montant)) + ", le montant du chèque : cette somme est bloquée au profit du bénéficiaire, qui peut représenter le chèque pendant 1 an et 8 jours. Le surplus éventuel reste disponible sur le compte.</span></div>";
    } else if (m === "cheque") {
      detail = '<div class="champ regul-champ"><label for="regul-paiement">Le titulaire a payé le bénéficiaire *</label><select id="regul-paiement"' + invalide("paiement") + '><option value="">Choisir le moyen de paiement</option>' +
        RG.PAIEMENTS.map(function (x) { return '<option value="' + x.code + '"' + (s.paiement === x.code ? " selected" : "") + ">" + esc(x.libelle) + "</option>"; }).join("") + "</select>" +
        '<span class="aide-champ">Le chèque impayé n° ' + esc(d.cheque) + " est remis à la banque ; le bénéficiaire ne peut pas être payé par un autre chèque.</span></div>";
    }
    var verifs = "";
    if (m === "cheque" || (m === "provision" && s.moyen)) {
      verifs = '<fieldset class="op-section regul-verifs"' + (err && err.champ === "verifs" ? ' aria-invalid="true"' : "") + '><legend>Vérifications du conseiller *</legend>' + RG.verificationsDe(m, s.moyen).map(function (v) {
        return '<label class="op-case"><input type="checkbox" name="regul-verif" id="regul-verif-' + v.id + '" value="' + v.id + '"' + (s.verifs.indexOf(v.id) >= 0 ? " checked" : "") + "><span>" + esc(v.libelle) + "</span></label>";
      }).join("") + "</fieldset>";
    }
    return '<section class="bloc regul-panneau" id="regul-panneau" aria-labelledby="regul-t-pan"><div class="bloc-tete"><h2 id="regul-t-pan" tabindex="-1">Régulariser le chèque n° ' + esc(d.cheque) + '</h2><span class="sous">' + esc(titulaire(d.client)) + " – compte n° " + esc(d.compte) + "</span></div>" +
      '<dl class="op-fiche regul-fiche"><div><dt>Chèque impayé</dt><dd>n° ' + esc(d.cheque) + " de <strong>" + esc(euros(d.montant)) + "</strong>" + (d.beneficiaire ? ", émis au profit de " + esc(d.beneficiaire) : "") + "</dd></div>" +
      "<div><dt>Frais de rejet</dt><dd>" + esc(euros(d.frais)) + " (restent dus par le titulaire, en plus du montant du chèque)</dd></div>" +
      "<div><dt>Lettre d'injonction</dt><dd>envoyée le " + esc(dateLongue(d.dateInjonction)) + "</dd></div></dl>" +
      '<form class="formulaire op-form regul-form" id="regul-form" novalidate><fieldset class="op-radio"><legend>Mode de régularisation *</legend><div class="regul-modes">' + modes + "</div></fieldset>" + detail + verifs +
      '<p class="msg-erreur" id="regul-err" role="alert">' + (err ? esc(err.erreur) : "") + "</p>" +
      '<div class="regul-btns"><button type="submit" class="btn btn-principal">Valider la régularisation</button><button type="button" class="btn btn-secondaire" data-act="annuler">Annuler</button></div></form></section>';
  }
  /* ---------- confirmation ---------- */
  function confirmation(d) {
    var r = d.regul;
    return '<section class="bloc regul-ok" id="regul-ok" aria-labelledby="regul-t-ok"><div class="bloc-tete"><h2 id="regul-t-ok" tabindex="-1">' + ICO.check + 'Régularisation enregistrée</h2><span class="sous">' + esc(titulaire(d.client)) + " – chèque n° " + esc(d.cheque) + "</span></div>" +
      '<ul class="regul-ok-liste"><li>La déclaration de régularisation de la lettre d\'injonction est complétée : à faire dater et signer par le titulaire, puis à lui remettre.</li>' +
      "<li>La régularisation est déclarée à la Banque de France <strong>aujourd'hui, le " + esc(dateLongue(r.declaree)) + "</strong> (la règle accorde " + RG.JOURS_DECLARATION + " jours ouvrés au plus).</li>" +
      "<li>La Banque de France met son fichier à jour dans le mois, d'ici le <strong>" + esc(dateLongue(r.levee)) + "</strong> : jusque-là, une interrogation du FCC montre encore l'inscription.</li>" +
      (d.autresNonRegularises ? "<li>Le titulaire a encore " + d.autresNonRegularises + " autre" + (d.autresNonRegularises > 1 ? "s" : "") + " chèque" + (d.autresNonRegularises > 1 ? "s" : "") + " impayé" + (d.autresNonRegularises > 1 ? "s" : "") + " : l'interdiction ne sera levée qu'une fois tous les incidents régularisés.</li>" : "") + "</ul>" +
      '<div class="regul-btns"><button type="button" class="btn btn-principal" data-act="lettre" data-cle="' + esc(d.cle) + '">Imprimer la lettre d\'injonction complétée' + ICO.imprimante + '</button><button type="button" class="btn btn-secondaire" data-act="fermer-ok">Fermer</button></div></section>';
  }

  function render(focus) {
    document.title = "GS Banque & Assurance – Régularisation FCC";
    var ds = RG.dossiers(st(), B.maintenant()), ouv = ouvert(), fait = etat.fait ? RG.dossier(st(), etat.fait, B.maintenant()) : null;
    app.innerHTML = '<nav class="fil-ariane" aria-label="Fil d\'Ariane"><a href="index.html">' + ICO.retour + 'Accueil</a></nav>' +
      '<div class="page-titre"><h1>Régularisation FCC</h1><p>Régulariser un chèque rejeté pour défaut de provision : le titulaire est interdit bancaire tant que tous ses incidents ne sont pas régularisés.</p></div>' +
      deroule() + (fait && fait.regul ? confirmation(fait) : "") + (ouv && ouv.etat === "a_regulariser" ? panneau(ouv) : "") + liste(ds);
    if (focus) { var n = document.getElementById(focus); if (n) { try { n.focus(); } catch (e) { /* ignoré */ } if (/^regul-t-/.test(focus) && n.scrollIntoView) n.scrollIntoView({ block: "start" }); } }
  }

  /* ---------- saisie ---------- */
  function lire() {
    var f = document.getElementById("regul-form"); if (!f) return;
    var r = f.querySelector('input[name="regul-mode"]:checked'); etat.saisie.mode = r ? r.value : "";
    var y = f.querySelector('input[name="regul-moyen"]:checked'); etat.saisie.moyen = y ? y.value : "";
    var v = document.getElementById("regul-versement"); if (v) etat.saisie.versement = v.value;
    var p = document.getElementById("regul-paiement"); if (p) etat.saisie.paiement = p.value;
    etat.saisie.verifs = [].map.call(f.querySelectorAll('input[name="regul-verif"]:checked'), function (n) { return n.value; });
  }
  function ouvrirPanneau(cle) { etat.cle = cle; etat.fait = null; etat.err = null; etat.saisie = { mode: "", moyen: "", versement: "", paiement: "", verifs: [] }; render("regul-t-pan"); }
  function fermerPanneau() { var cle = etat.cle; etat.cle = null; etat.err = null; render(); var b = cle && document.querySelector('[data-act="ouvrir"][data-cle="' + cle.replace(/"/g, '\\"') + '"]'); if (b) b.focus(); }

  function imprimerLettre(cle) {
    var s = st(), d = RG.dossier(s, cle, B.maintenant()), p = s.murcef && s.murcef[cle];
    if (!d || !d.regul || !p || !IMP) return;
    var rg = {}; Object.keys(d.regul).forEach(function (k) { rg[k] = d.regul[k]; }); rg.autres = d.autresNonRegularises;
    var l = INJ.lettreDepuis(p.inst, { date: INJ.lireDate(p.injonction.date), qualite: p.injonction.qualite, regularisation: rg });
    if (!l.ok) return;
    if (ID && !ID.nomCourant() && nomEleve() && ID.nomValide(nomEleve()).ok) { ID.definir(B.store.charger(), nomEleve()); B.store.sauver(); }
    var doc = INJ.document(l);
    IMP.imprimer(IMP.document(doc), doc.fichier);
  }
  function valider() {
    lire();
    var r = RG.regulariser(st(), etat.cle, etat.saisie, B.maintenant(), nomEleve());
    if (!r.ok) {
      etat.err = { champ: r.champ, erreur: r.erreur };
      var manque = RG.verificationsDe(etat.saisie.mode, etat.saisie.moyen).filter(function (v) { return etat.saisie.verifs.indexOf(v.id) < 0; })[0];
      render(r.champ === "verifs" && manque ? "regul-verif-" + manque.id : r.champ === "versement" ? "regul-versement" : r.champ === "paiement" ? "regul-paiement" : r.champ === "mode" ? "regul-mode-provision" : r.champ === "moyen" ? "regul-moyen-especes" : "regul-err");
      return;
    }
    B.store.sauver();
    var cle = etat.cle; etat.fait = cle; etat.cle = null; etat.err = null;
    render("regul-t-ok");
    imprimerLettre(cle);
  }

  app.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-act]") : null; if (!b) return;
    var act = b.getAttribute("data-act"), cle = b.getAttribute("data-cle");
    if (act === "ouvrir") ouvrirPanneau(cle);
    else if (act === "annuler") fermerPanneau();
    else if (act === "lettre") imprimerLettre(cle);
    else if (act === "fermer-ok") { etat.fait = null; render("regul-t-liste"); }
  });
  app.addEventListener("submit", function (e) { if (e.target.id === "regul-form") { e.preventDefault(); valider(); } });
  app.addEventListener("change", function (e) {
    if (!e.target.closest || !e.target.closest("#regul-form")) return;
    var avant = etat.saisie.mode, avantMoyen = etat.saisie.moyen; lire(); etat.err = null;
    if (e.target.name === "regul-mode" && etat.saisie.mode !== avant) { etat.saisie.verifs = []; etat.saisie.moyen = ""; render("regul-mode-" + etat.saisie.mode); }
    else if (e.target.name === "regul-moyen" && etat.saisie.moyen !== avantMoyen) { etat.saisie.verifs = []; render("regul-moyen-" + etat.saisie.moyen); }
  });
  app.addEventListener("input", function (e) { if (e.target.id === "regul-versement") { etat.saisie.versement = e.target.value; } });

  if (SG.recherche) SG.recherche.init(SG.clients, document.getElementById("rech"), document.getElementById("rech-res"), document.getElementById("rech-statut"));

  var cleUrl = params.get("cle");
  if (cleUrl && RG.dossier(st(), cleUrl, B.maintenant()) && RG.dossier(st(), cleUrl, B.maintenant()).etat === "a_regulariser") { etat.cle = cleUrl; render("regul-t-pan"); } else render();
})();
