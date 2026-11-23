/* GS Banque & Assurance – carte de visite : formulaire (civilité, fonction, numéros), aperçu recto et verso, impression d'une planche A4 de dix cartes à découper.
   Le prénom et le nom sont ceux de l'élève (identite.js), les mêmes que la signature des e-mails et l'identité portée par les documents imprimés ; les règles de contenu sont dans carte.js. */
(function () {
  "use strict";

  var B = window.SGBF.banque, CV = window.SGBF.carte, ID = window.SGBF.identite, IMP = window.SGBF.impression, ICO = window.SGBF.icones, RECH = window.SGBF.recherche, CL = window.SGBF.clients;
  var app = document.getElementById("app"), esc = B.esc;
  function store() { return B.store.charger(); }

  var etat = { f: null, err: null, msg: "", verso: true };

  /* ---------- état du formulaire ---------- */
  function nomEnregistre() { var st = store(); return ID.nomCourant() || (st.eleve && typeof st.eleve.nom === "string" ? st.eleve.nom : ""); }
  function formInitial() {
    var nom = nomEnregistre(), d = CV.defauts(nom), c = store().carte;
    var f = { nom: nom, civ: d.civ, fonction: d.fonction, direct: d.direct, mobile: d.mobile };
    if (c && typeof c === "object") {
      if (CV.CIVILITES[c.civ]) f.civ = c.civ;
      if (CV.FONCTIONS[c.fonction]) f.fonction = c.fonction;
      if (typeof c.direct === "string") f.direct = c.direct;
      if (typeof c.mobile === "string") f.mobile = c.mobile;
    }
    return f;
  }

  /* ---------- dessin de la carte ---------- */
  function classeNom(nom) { return nom.length > 34 ? " cv-tres-long" : nom.length > 24 ? " cv-long" : ""; }
  function rectoHtml(c) {
    return '<div class="cv cv-recto"><div class="cv-in"><div class="cv-marque"><img src="assets/logo.png" alt=""><div><p class="cv-banque">GS Banque &amp; Assurance</p><p class="cv-agence">' + esc(c.agence) + "</p></div></div>" +
      '<p class="cv-nom' + classeNom(c.nom) + '">' + esc(c.nom) + '</p><p class="cv-fonction">' + esc(c.fonction) + "</p>" +
      '<dl class="cv-coord"><div><dt>Direct</dt><dd>' + esc(c.direct) + "</dd></div>" + (c.mobile ? "<div><dt>Mobile</dt><dd>" + esc(c.mobile) + "</dd></div>" : "") +
      "<div><dt>E-mail</dt><dd class=\"cv-mail\">" + esc(c.mail) + "</dd></div></dl>" +
      '<p class="cv-pied">' + esc(c.adresse.join(", ")) + "</p></div></div>";
  }
  function versoHtml(c) {
    return '<div class="cv cv-verso"><div class="cv-in"><img src="assets/logo.png" alt=""><div><p class="cv-banque">GS Banque &amp; Assurance</p><p class="cv-agence">' + esc(c.agence) + "</p></div>" +
      '<p class="cv-horaires">' + c.horaires.map(esc).join("<br>") + '</p><p class="cv-adresse">' + esc(c.adresse.join(", ")) + "<br>Tél. : " + esc(c.tel) + "<br>" + esc(c.site) + "</p></div></div>";
  }
  function planche(html) { var l = []; for (var i = 0; i < CV.FORMAT.parPlanche; i++) l.push(html); return '<div class="cv-planche">' + l.join("") + "</div>"; }
  function planchesHtml(c, avecVerso) { return '<div class="cv-planches">' + planche(rectoHtml(c)) + (avecVerso ? planche(versoHtml(c)) : "") + "</div>"; }

  /* ---------- formulaire ---------- */
  function erreurChamp(champ) { return etat.err && etat.err.champ === champ ? ' aria-invalid="true" aria-describedby="cv-err"' : ""; }
  function optionsFonction(f) {
    return CV.ORDRE_FONCTIONS.map(function (id) { return '<option value="' + id + '"' + (f.fonction === id ? " selected" : "") + ">" + esc(CV.fonctionLib(id, f.civ)) + "</option>"; }).join("");
  }
  function formHtml() {
    var f = etat.f;
    return '<form class="formulaire cv-form" id="form-cv" novalidate>' +
      '<div class="champ champ-nom"><label for="cv-nom">Prénom et nom *</label><input id="cv-nom" type="text" maxlength="' + ID.MAX_NOM + '" autocomplete="name" value="' + esc(f.nom) + '"' + erreurChamp("nom") + ">" +
      '<p class="aide-champ">Le même que dans la signature de vos e-mails et en haut de vos documents.</p></div>' +
      '<div class="ligne"><div class="champ"><label for="cv-civ">Civilité *</label><select id="cv-civ"' + erreurChamp("civ") + ">" + Object.keys(CV.CIVILITES).map(function (k) { return '<option value="' + esc(k) + '"' + (f.civ === k ? " selected" : "") + ">" + esc(k) + "</option>"; }).join("") + "</select></div>" +
      '<div class="champ" style="grid-column: span 2"><label for="cv-fonction">Fonction dans l\'agence *</label><select id="cv-fonction"' + erreurChamp("fonction") + ">" + optionsFonction(f) + "</select></div></div>" +
      '<div class="ligne"><div class="champ"><label for="cv-direct">Ligne directe *</label><input id="cv-direct" type="text" inputmode="tel" value="' + esc(f.direct) + '"' + erreurChamp("direct") + ' autocomplete="off"></div>' +
      '<div class="champ"><label for="cv-mobile">Mobile (facultatif)</label><input id="cv-mobile" type="text" inputmode="tel" value="' + esc(f.mobile) + '"' + erreurChamp("mobile") + ' autocomplete="off"></div></div>' +
      '<p class="aide-champ cv-aide-num">Numéros fictifs : ligne directe en 01 99 00 xx xx, mobile en 06 39 98 xx xx (tranches réservées à la fiction). L\'adresse e-mail est celle de votre signature : ' + esc(CV.mail(f.nom) || "prénom.nom@" + CV.DOMAINE) + ".</p>" +
      '<p class="msg-erreur" id="cv-err" role="alert">' + (etat.err ? esc(etat.err.erreur) : "") + "</p>" +
      '<div class="cv-options"><label class="pf-radio" for="cv-verso"><input type="checkbox" id="cv-verso"' + (etat.verso ? " checked" : "") + "> <span>Imprimer aussi le verso (deuxième page de la planche)</span></label></div>" +
      '<div class="pf-btns"><button type="submit" class="btn btn-principal" data-act="enregistrer">Enregistrer ma carte</button><button type="button" class="btn btn-secondaire" data-act="imprimer">' + ICO.imprimante + "Imprimer la planche de 10 cartes</button>" +
      '<button type="button" class="btn-texte" data-act="proposes">Rétablir les numéros proposés</button></div></form>';
  }
  function apercuHtml() {
    var r = CV.valider(etat.f);
    if (!r.ok) return '<p class="cv-apercu-msg">L\'aperçu apparaît dès que le formulaire est complet : ' + esc(r.erreur) + "</p>";
    return '<div class="cv-cartes"><figure><div>' + rectoHtml(r.carte) + "</div><figcaption>Recto</figcaption></figure><figure><div>" + versoHtml(r.carte) + "</div><figcaption>Verso</figcaption></figure></div>" +
      '<p class="mention" style="margin-top:12px">Format 85 × 55 mm. L\'impression place dix cartes sur une page A4 (deux colonnes, cinq rangées), avec un contour en pointillés pour la découpe. Choisissez « Enregistrer au format PDF » pour garder un fichier.</p>';
  }
  function render() {
    app.innerHTML = '<nav class="fil-ariane" aria-label="Fil d\'Ariane"><a href="index.html">' + ICO.retour + "Accueil</a><span aria-hidden=\"true\">/</span><span>Carte de visite</span></nav>" +
      '<div class="page-titre"><h1>Carte de visite</h1><p>Votre carte de conseiller, prête à imprimer et à découper</p></div>' +
      '<div class="cv-page"><section class="bloc" aria-labelledby="t-carte"><div class="bloc-tete"><h2 id="t-carte" tabindex="-1">Ma carte</h2><span class="sous">Les champs marqués d\'une étoile sont obligatoires.</span></div>' +
      '<p class="cv-ok" id="cv-ok" role="status" tabindex="-1"></p><div id="z-form"></div></section>' +
      '<section class="bloc" aria-labelledby="t-apercu"><div class="bloc-tete"><h2 id="t-apercu" tabindex="-1">Aperçu</h2></div><div id="z-apercu"></div></section></div>';
    majForm(); majApercu(); majMsg();
  }
  function majForm() { document.getElementById("z-form").innerHTML = formHtml(); }
  function majApercu() { document.getElementById("z-apercu").innerHTML = apercuHtml(); }
  function majMsg() { document.getElementById("cv-ok").textContent = etat.msg; }
  function lire() {
    var f = etat.f, g = function (id) { var e = document.getElementById(id); return e ? e.value : ""; };
    f.nom = g("cv-nom"); f.civ = g("cv-civ"); f.fonction = g("cv-fonction"); f.direct = g("cv-direct"); f.mobile = g("cv-mobile");
    etat.verso = !!(document.getElementById("cv-verso") || {}).checked;
  }
  function focusErreur(r) {
    var champs = { nom: "cv-nom", civ: "cv-civ", fonction: "cv-fonction", direct: "cv-direct", mobile: "cv-mobile" }, e = document.getElementById(champs[r.champ]);
    if (e) e.focus();
  }

  /* ---------- actions ---------- */
  /* Valide la saisie ; si elle est correcte, enregistre le nom (identité partagée) et les réglages de la carte. */
  function enregistrer() {
    lire();
    var r = CV.valider(etat.f);
    if (!r.ok) { etat.err = r; etat.msg = ""; majForm(); majApercu(); majMsg(); focusErreur(r); return null; }
    var id = ID.enregistrer(etat.f.nom);
    if (!id.ok) { etat.err = id; majForm(); focusErreur(id); return null; }
    var st = store();
    st.carte = { civ: etat.f.civ, fonction: etat.f.fonction, direct: r.carte.direct, mobile: r.carte.mobile };
    B.store.sauver();
    etat.f.nom = r.carte.nom; etat.f.direct = r.carte.direct; etat.f.mobile = r.carte.mobile; etat.err = null;
    return r.carte;
  }
  app.addEventListener("submit", function (e) {
    e.preventDefault();
    var c = enregistrer();
    if (!c) return;
    etat.msg = "Carte enregistrée pour " + c.nom + ".";
    majForm(); majApercu(); majMsg();
    var ok = document.getElementById("cv-ok"); if (ok) ok.focus();
  });
  app.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b) return;
    var act = b.getAttribute("data-act");
    if (act === "imprimer") {
      var c = enregistrer();
      if (!c) return;
      IMP.imprimer(planchesHtml(c, etat.verso), IMP.nomFichier("Carte_de_visite_" + c.nom));
    } else if (act === "proposes") {
      lire();
      var d = CV.defauts(etat.f.nom);
      etat.f.direct = d.direct; etat.f.mobile = d.mobile; etat.err = null; etat.msg = "";
      majForm(); majApercu(); majMsg();
      var i = document.getElementById("cv-direct"); if (i) i.focus();
    }
  });
  /* Saisie : l'aperçu suit le formulaire. Une nouvelle civilité change la forme de la fonction ; un nouveau nom propose de nouveaux numéros tant qu'ils n'ont pas été modifiés. */
  app.addEventListener("input", function (e) {
    var t = e.target, avant = { nom: etat.f.nom, direct: etat.f.direct, mobile: etat.f.mobile }, defAvant = CV.defauts(avant.nom);
    lire();
    if (t.id === "cv-nom") {
      var d = CV.defauts(etat.f.nom);
      if (avant.direct === defAvant.direct || !avant.direct) { etat.f.direct = d.direct; var a = document.getElementById("cv-direct"); if (a) a.value = d.direct; }
      if (avant.mobile === defAvant.mobile || !avant.mobile) { etat.f.mobile = d.mobile; var m = document.getElementById("cv-mobile"); if (m) m.value = d.mobile; }
      var aide = app.querySelector(".cv-aide-num"); if (aide) aide.textContent = "Numéros fictifs : ligne directe en 01 99 00 xx xx, mobile en 06 39 98 xx xx (tranches réservées à la fiction). L'adresse e-mail est celle de votre signature : " + (CV.mail(etat.f.nom) || "prénom.nom@" + CV.DOMAINE) + ".";
    }
    if (etat.err) { etat.err = null; var er = document.getElementById("cv-err"); if (er) er.textContent = ""; [].slice.call(app.querySelectorAll("[aria-invalid]")).forEach(function (x) { x.removeAttribute("aria-invalid"); }); }
    majApercu();
  });
  app.addEventListener("change", function (e) {
    if (e.target.id === "cv-civ") { lire(); var s = document.getElementById("cv-fonction"); if (s) s.innerHTML = optionsFonction(etat.f); s.value = etat.f.fonction; lire(); majApercu(); }
    else if (e.target.id === "cv-fonction") { lire(); majApercu(); }
  });

  RECH.init(CL, document.getElementById("rech"), document.getElementById("rech-res"), document.getElementById("rech-statut"));
  etat.f = formInitial();
  render();
})();
