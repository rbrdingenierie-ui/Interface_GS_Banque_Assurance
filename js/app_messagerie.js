/* GS Banque & Assurance – messagerie : signature de l'élève, e-mails types adressés aux clients, aperçu, copie, impression, journal des envois ; modification du texte d'un e-mail type avant l'envoi. */
(function () {
  "use strict";

  var B = window.SGBF.banque, MS = window.SGBF.messagerie, ICO = window.SGBF.icones, RECH = window.SGBF.recherche, IMP = window.SGBF.impression, CL = window.SGBF.clients, PR = window.SGBF.produits;
  var app = document.getElementById("app");
  var esc = B.esc;
  var CLIENT = {}; CL.forEach(function (c) { CLIENT[c.id] = c; });
  function store() { return B.store.charger(); }
  function pl(n, s, p) { return B.nb(n) + " " + (n > 1 ? p : s); }
  function nomCourt(c) { return c.prenom + " " + c.nom; }
  function nomListe(c) { return c.nom.toUpperCase() + " " + c.prenom; }
  function lienClient(c) { return "client.html?id=" + c.id; }
  function campagnesListe(st) { return Array.isArray(st.campagnes) ? st.campagnes : []; }
  function trouverCamp(id) { return campagnesListe(store()).filter(function (k) { return k.id === id; })[0] || null; }

  var params = new URLSearchParams(location.search);
  var PAGE = 30;
  var etat = { client: null, q: "", modele: "", champs: {}, mot: "", err: null, msg: "", camp: "", edition: null, supprimer: null, nbJournal: PAGE, identErr: null, identForm: false };

  /* ---------- signature ---------- */
  function signatureHtml(sig) {
    return '<div class="ms-sig"><p class="ms-sig-nom">' + esc(sig.corps[0]) + "</p>" + sig.corps.slice(1).map(function (l) { return "<p>" + esc(l) + "</p>"; }).join("") +
      '<div class="ms-sig-mentions">' + sig.mentions.concat(sig.legales).map(function (l) { return "<p>" + esc(l) + "</p>"; }).join("") + "</div></div>";
  }
  function identiteHtml() {
    var st = store(), sig = MS.signature(st), edition = !sig.ok || etat.identForm;
    if (!edition) {
      return '<div class="ms-ident-ok"><p>Votre signature, ajoutée à chaque e-mail :</p>' + signatureHtml(sig) + '<p><button type="button" class="btn-texte" data-act="modifier-nom">Modifier mon nom</button></p></div>';
    }
    return '<form class="formulaire ms-form-ident" id="form-ident" novalidate><p class="aide-champ">Indiquez votre prénom et votre nom : ils figurent dans la signature de chaque e-mail. Le téléphone, l\'adresse e-mail et les mentions légales sont ajoutés automatiquement.</p>' +
      '<div class="ligne ms-ligne"><div class="champ"><label for="ms-nom">Prénom et nom *</label><input id="ms-nom" maxlength="' + MS.MAX_NOM + '" autocomplete="name" value="' + esc(store().eleve.nom || "") + '"' + (etat.identErr ? ' aria-invalid="true" aria-describedby="ms-ident-err"' : "") + "></div>" +
      '<div class="champ"><label for="ms-classe">Classe <span class="aide-champ">(facultatif)</span></label><input id="ms-classe" maxlength="30" autocomplete="off" value="' + esc(store().eleve.classe || "") + '"></div></div>' +
      '<p class="msg-erreur" id="ms-ident-err" role="alert">' + (etat.identErr ? esc(etat.identErr) : "") + "</p>" +
      '<div class="pf-btns"><button type="submit" class="btn btn-principal">Enregistrer ma signature</button>' + (sig.ok ? '<button type="button" class="btn btn-secondaire" data-act="annuler-nom">Annuler</button>' : "") + "</div></form>";
  }
  function majIdentite() { document.getElementById("z-sig").innerHTML = identiteHtml(); majEcrire(); }

  /* ---------- écrire ---------- */
  function clientChoix() {
    var c = etat.client ? CLIENT[etat.client] : null, k = etat.camp ? trouverCamp(etat.camp) : null;
    var h = '<div class="champ ag-champ-client"><label for="ms-cq">Destinataire *</label>';
    if (c) h += '<p class="cl-choisi ag-cl-ok" id="ms-cl-ok"><span><strong>' + esc(nomCourt(c)) + "</strong> – " + c.age + " ans – " + esc(c.pro.prof) + " – " + esc(c.num) + '</span><button type="button" class="btn-texte" data-act="changer-client">Changer de client</button></p>';
    else h += '<input id="ms-cq" type="search" autocomplete="off" maxlength="60" aria-controls="ms-cres" placeholder="' + (k ? "Nom ou prénom d'un client de la campagne" : "Nom, prénom ou numéro du client") + '" value="' + esc(etat.q) + '"><ul id="ms-cres" class="cl-res" hidden></ul><p id="ms-cstatut" class="sr" role="status"></p>';
    return h + "</div>";
  }
  function campagneChip() {
    var k = etat.camp ? trouverCamp(etat.camp) : null;
    if (!k) return "";
    return '<p class="ms-camp"><span class="puce">Campagne</span> <strong>' + esc(k.nom) + '</strong> : le message sera rattaché à cette campagne. <button type="button" class="btn-texte" data-act="retirer-camp">Ne pas rattacher</button></p>';
  }
  function valeurDefaut(f, c) {
    var st = store();
    if (f.genre === "rdv") { var l = MS.rdvsClient(st, c.id); return l.length === 1 ? l[0].cle : ""; }
    if (f.genre === "souscription") { var s = MS.souscriptionsClient(st, c.id); return s.length === 1 ? s[0].id : ""; }
    if (f.genre === "choix") return f.options[0];
    if (f.genre === "case") return false;
    return "";
  }
  function initChamps() {
    var c = CLIENT[etat.client], m = MS.MODELE[etat.modele]; etat.champs = {};
    if (c && m) m.champs.forEach(function (f) { etat.champs[f.k] = valeurDefaut(f, c); });
  }
  function champHtml(f, c) {
    var st = store(), id = "ms-f-" + f.k, v = etat.champs[f.k] == null ? "" : etat.champs[f.k], inv = etat.err && etat.err.champ === f.k ? ' aria-invalid="true" aria-describedby="ms-err"' : "";
    if (f.genre === "case") {
      return '<div class="champ"><label class="pf-radio ms-case" for="' + id + '"><input type="checkbox" id="' + id + '"' + (v === true ? " checked" : "") + "> <span>" + esc(f.lib) + "</span></label></div>";
    }
    var h = '<div class="champ"><label for="' + id + '">' + esc(f.lib) + " *</label>";
    function opt(val, lib) { return '<option value="' + esc(val) + '"' + (v === val ? " selected" : "") + ">" + esc(lib) + "</option>"; }
    if (f.genre === "rdv") {
      h += '<select id="' + id + '"' + inv + ">" + opt("", "Choisir un rendez-vous") + MS.rdvsClient(st, c.id).map(function (e) {
        return opt(e.cle, MS.maj1(MS.libJour(e.date)) + " à " + MS.heureTxt(e.heure) + " – " + (e.kind === "agence" ? "rendez-vous de l'agence" : e.collegue ? "rendez-vous avec " + e.collegue.nom : "votre rendez-vous") + (e.canal ? ", " + e.canal.toLowerCase() : ""));
      }).join("") + "</select>";
    } else if (f.genre === "produit") {
      h += '<select id="' + id + '"' + inv + ">" + opt("", "Choisir un produit") + MS.proposables(st, c).map(function (p) { return opt(p.id, p.nom); }).join("") + "</select>" +
        '<p class="aide-champ">Seuls les produits auxquels ce client est éligible (ou « à examiner »), et qu\'il ne détient pas encore, sont proposés. Les crédits et l\'offre clientèle fragile sont exclus : pour un autre produit, utilisez l\'e-mail « Autre produit ».</p>';
    } else if (f.genre === "souscription") {
      h += '<select id="' + id + '"' + inv + ">" + opt("", "Choisir une souscription") + MS.souscriptionsClient(st, c.id).map(function (s) { return opt(s.id, PR.parId[s.p].nom + " – " + B.fmtDate(B.lireYmd(s.date))); }).join("") + "</select>";
    } else if (f.genre === "choix") {
      h += '<select id="' + id + '"' + inv + ">" + f.options.map(function (o) { return opt(o, o); }).join("") + "</select>";
    } else if (f.genre === "texte") {
      h += '<input id="' + id + '" type="text" maxlength="' + f.max + '" autocomplete="off" placeholder="' + esc(f.exemple || "") + '" value="' + esc(v) + '"' + inv + ">" +
        '<p class="aide-champ">Entre ' + f.min + " et " + f.max + " caractères.</p>";
    } else if (f.genre === "zone") {
      h += '<textarea id="' + id + '" rows="' + (f.lignes || 4) + '" maxlength="' + f.max + '" placeholder="' + esc(f.exemple || "") + '"' + inv + ">" + esc(v) + "</textarea>" +
        '<p class="aide-champ">Entre ' + f.min + " et " + f.max + " caractères.</p>";
    } else if (f.genre === "liste") {
      h += '<textarea id="' + id + '" rows="4" maxlength="' + (f.max * (f.maxLigne + 2)) + '"' + inv + ' placeholder="Exemple :\nDernier avis d\'imposition\nJustificatif de domicile">' + esc(v) + "</textarea>" +
        '<p class="aide-champ">Au plus ' + f.max + " pièces, une par ligne, " + f.maxLigne + " caractères par pièce.</p>";
    }
    return h + "</div>";
  }
  function modelesHtml(c) {
    var st = store();
    return '<fieldset class="pf-source ms-modeles"><legend>E-mail type *</legend>' + MS.MODELES.map(function (m) {
      var d = MS.disponibilite(st, c, m.id), id = "ms-m-" + m.id;
      return '<label class="pf-radio ms-radio' + (d.ok ? "" : " ms-indispo") + '"><input type="radio" name="ms-modele" value="' + m.id + '" id="' + id + '"' + (etat.modele === m.id ? " checked" : "") + (d.ok ? "" : ' disabled aria-describedby="' + id + '-d"') + ">" +
        '<span><strong>' + esc(m.titre) + "</strong>" + (m.commercial === true ? ' <span class="puce">Commercial</span>' : "") + '<span class="ag-sous ag-bloc">' + esc(m.quand) + "</span>" + (d.ok ? "" : '<span class="ms-raison" id="' + id + '-d">' + esc(d.raison) + "</span>") + "</span></label>";
    }).join("") + "</fieldset>";
  }
  function ecrireHtml() {
    var st = store(), sig = MS.signature(st);
    var h = '<section class="bloc ms-ecrire" id="bloc-ecrire" aria-labelledby="t-ecrire"><div class="bloc-tete"><h2 id="t-ecrire" tabindex="-1">Écrire à un client</h2><span class="sous">Les champs marqués d\'une étoile (*) sont obligatoires</span></div>';
    if (!sig.ok) return h + '<p class="vide-bloc">Renseignez d\'abord votre prénom et votre nom dans « Ma signature » : vous pourrez ensuite écrire aux clients.</p></section>';
    h += campagneChip() + '<form class="formulaire ms-form" id="form-ms" novalidate><fieldset class="ms-verrou"' + (etat.edition ? " disabled" : "") + ">" + clientChoix();
    var c = etat.client ? CLIENT[etat.client] : null, m = null;
    if (c) {
      h += modelesHtml(c);
      m = etat.modele ? MS.MODELE[etat.modele] : null;
      if (m) {
        h += m.champs.map(function (f) { return champHtml(f, c); }).join("");
        if (!m.sansMot) h += '<div class="champ"><label for="ms-mot">Votre mot personnel <span class="aide-champ">(facultatif, ' + MS.MAX_MOT + " caractères au plus : ajouté avant la formule de politesse)</span></label><textarea id=\"ms-mot\" rows=\"3\" maxlength=\"" + MS.MAX_MOT + "\">" + esc(etat.mot) + "</textarea></div>";
      } else h += '<p class="aide-champ">Choisissez un e-mail type pour continuer.</p>';
    }
    h += "</fieldset>";
    if (c && m) {
      h += '<div id="z-apercu"></div>';
      h += '<p class="msg-erreur" id="ms-err" role="alert">' + (etat.err ? esc(etat.err.erreur) : "") + "</p>" +
        '<div class="pf-btns"><button type="submit" class="btn btn-principal">Envoyer</button><button type="button" class="btn btn-secondaire" data-act="copier">Copier le message</button><button type="button" class="btn btn-secondaire" data-act="imprimer-msg">' + ICO.imprimante + "Imprimer</button></div>" +
        '<p class="mention">Aucun e-mail n\'est transmis à l\'extérieur : « Envoyer » enregistre le message dans le journal ci-dessous et dans la fiche du client.</p>';
    }
    return h + "</form></section>";
  }
  function majEcrire() { document.getElementById("z-ecrire").innerHTML = ecrireHtml(); majApercu(); }
  function valeursMsg() { return { client: etat.client, modele: etat.modele, champs: etat.champs, mot: etat.mot, campagne: etat.camp, edition: etat.edition }; }
  function enteteHtml(r, avecObjet) {
    return '<dl class="ms-entete"><div><dt>De</dt><dd>' + esc(r.de) + "</dd></div><div><dt>À</dt><dd>" + esc(r.client.civ + " " + r.client.prenom + " " + r.client.nom) + "</dd></div>" + (avecObjet ? "<div><dt>Objet</dt><dd>" + esc(r.objet) + "</dd></div>" : "") + "</dl>";
  }
  function fixeHtml(r, sig) { return signatureHtml(sig) + (r.pied ? '<p class="ms-pied">' + esc(r.pied) + "</p>" : ""); }
  function apercuHtml() {
    var m = etat.modele ? MS.MODELE[etat.modele] : null;
    if (etat.edition) {
      var rr = MS.composer(store(), Object.assign({}, valeursMsg(), { edition: null })), sg = MS.signature(store());
      if (!rr.ok) return '<div class="ms-apercu ms-apercu-vide"><p class="aide-champ">' + esc(rr.erreur) + "</p></div>";
      return '<div class="ms-apercu ms-edition"><h3 class="sous-titre">Modifier le message</h3>' +
        '<p class="aide-champ">Vous pouvez changer l\'objet et tout le texte. La signature et, pour un e-mail commercial, la ligne de désinscription sont ajoutées automatiquement.</p>' + enteteHtml(rr, false) +
        '<div class="champ"><label for="ms-eobjet">Objet *</label><input id="ms-eobjet" maxlength="' + MS.LIMITES.objetEdite[1] + '" autocomplete="off" value="' + esc(etat.edition.objet) + '"' + (etat.err && etat.err.champ === "objet-edite" ? ' aria-invalid="true" aria-describedby="ms-err"' : "") + "></div>" +
        '<div class="champ"><label for="ms-ecorps">Texte du message *</label><textarea id="ms-ecorps" rows="16" maxlength="' + MS.LIMITES.corpsEdite[1] + '"' + (etat.err && etat.err.champ === "corps-edite" ? ' aria-invalid="true" aria-describedby="ms-err"' : "") + ">" + esc(etat.edition.corps) + "</textarea></div>" +
        '<p><button type="button" class="btn btn-secondaire" data-act="annuler-edition">Revenir au texte type</button></p>' +
        '<p class="aide-champ">Ajouté automatiquement sous votre texte :</p>' + fixeHtml(rr, sg) + "</div>";
    }
    var r = MS.composer(store(), valeursMsg());
    if (!r.ok) return '<div class="ms-apercu ms-apercu-vide"><h3 class="sous-titre">Aperçu</h3><p class="aide-champ">' + (r.champ === "signature" ? esc(r.erreur) : "L'aperçu s'affiche dès que les champs obligatoires sont remplis. " + esc(r.erreur)) + "</p></div>";
    var sig = MS.signature(store());
    return '<div class="ms-apercu"><h3 class="sous-titre">Aperçu du message</h3>' + enteteHtml(r, true) +
      '<div class="ms-texte">' + esc(r.corps) + "</div>" + fixeHtml(r, sig) +
      (m && !m.sansEdition ? '<p class="ms-modifier"><button type="button" class="btn btn-secondaire" data-act="modifier-texte">Modifier le texte</button> <span class="aide-champ">Pour adapter le texte type avant l\'envoi.</span></p>' : "") + "</div>";
  }
  function majApercu() { var z = document.getElementById("z-apercu"); if (z) z.innerHTML = apercuHtml(); }

  function suggestions() {
    var z = document.getElementById("ms-cres"), s = document.getElementById("ms-cstatut");
    if (!z) return;
    var q = etat.q.trim();
    if (q.length < 2) { z.hidden = true; z.innerHTML = ""; s.textContent = ""; return; }
    var k = etat.camp ? trouverCamp(etat.camp) : null, base = k ? CL.filter(function (c) { return k.ids.indexOf(c.id) >= 0; }) : CL;
    var r = RECH.chercher(base, q, 8);
    z.innerHTML = r.length ? r.map(function (c) { return '<li><button type="button" data-act="choisir-client" data-id="' + c.id + '"><span class="rech-nom">' + esc(nomListe(c)) + '</span><span class="rech-sous">' + c.age + " ans – " + esc(c.pro.prof) + " – " + esc(c.num) + "</span></button></li>"; }).join("") : '<li class="rech-vide">Aucun client ne correspond à « ' + esc(q) + " »" + (k ? " dans cette campagne" : "") + ".</li>";
    s.textContent = r.length ? pl(r.length, "résultat", "résultats") : "Aucun résultat";
    z.hidden = false;
  }
  /* Relit les champs saisis dans l'état avant tout nouvel affichage. */
  function lireForm() {
    var m = etat.modele ? MS.MODELE[etat.modele] : null;
    if (m) m.champs.forEach(function (f) { var e = document.getElementById("ms-f-" + f.k); if (e) etat.champs[f.k] = e.type === "checkbox" ? e.checked : e.value; });
    var mo = document.getElementById("ms-mot"); if (mo) etat.mot = mo.value;
    if (etat.edition) {
      var eo = document.getElementById("ms-eobjet"), ec = document.getElementById("ms-ecorps");
      if (eo) etat.edition.objet = eo.value;
      if (ec) etat.edition.corps = ec.value;
    }
  }
  function majMsg() { var z = document.getElementById("z-msg"); if (z) z.innerHTML = etat.msg ? '<p class="ag-ok" id="ms-ok" tabindex="-1" role="status">' + esc(etat.msg) + "</p>" : ""; }

  /* ---------- journal ---------- */
  function journalHtml() {
    var st = store(), l = MS.journal(st);
    if (!l.length) return '<p class="vide-bloc">Aucun message envoyé pour le moment.</p>';
    var vus = l.slice(0, etat.nbJournal);
    return '<ul class="ms-journal">' + vus.map(function (x) {
      var c = CLIENT[x.c], m = MS.MODELE[x.m], k = x.camp ? trouverCamp(x.camp) : null, conf = etat.supprimer === x.id;
      return '<li class="ms-j"><div class="ms-j-tete"><strong>' + esc(B.fmtDate(B.lireYmd(x.date))) + " à " + esc(MS.heureTxt(x.heure)) + "</strong>" + (m ? ' <span class="puce">' + esc(m.titre) + "</span>" : "") + (x.mod ? ' <span class="puce">Texte modifié</span>' : "") + (k ? ' <span class="puce puce-ok">' + esc(k.nom) + "</span>" : "") + "</div>" +
        '<p class="ms-j-qui"><a href="' + lienClient(c) + '">' + esc(nomCourt(c)) + "</a> – " + esc(x.objet) + "</p>" +
        '<details class="ms-j-det"><summary>Lire le message</summary><div class="ms-texte">' + esc(x.corps) + '</div><div class="ms-sig ms-sig-txt">' + esc(x.signature) + "</div>" + (x.pied ? '<p class="ms-pied">' + esc(x.pied) + "</p>" : "") + "</details>" +
        '<p class="ag-liens">' + (conf ? '<button type="button" class="btn-texte" data-act="suppr-oui" data-id="' + x.id + '">Confirmer la suppression</button><button type="button" class="btn-texte" data-act="suppr-non">Garder</button>' :
          '<button type="button" class="btn-texte" data-act="suppr" data-id="' + x.id + '" aria-label="Supprimer le message du ' + esc(B.fmtDate(B.lireYmd(x.date))) + " à " + esc(nomCourt(c)) + '">Supprimer</button>') + "</p></li>";
    }).join("") + "</ul>" + (l.length > vus.length ? '<p><button type="button" class="btn btn-secondaire" data-act="plus">Voir les ' + Math.min(PAGE, l.length - vus.length) + " messages suivants (" + (l.length - vus.length) + " restants)</button></p>" : "");
  }
  function majJournal() {
    var z = document.getElementById("z-journal"), n = document.getElementById("ms-nb");
    if (z) z.innerHTML = journalHtml();
    if (n) { var k = MS.messages(store()).length; n.textContent = k ? pl(k, "message", "messages") : ""; }
  }

  /* ---------- actions ---------- */
  function texteBrut() { var r = MS.composer(store(), valeursMsg()); return r.ok ? r : null; }
  function copier() {
    lireForm();
    var r = texteBrut(), z = document.getElementById("ms-err");
    if (!r) { etat.err = MS.composer(store(), valeursMsg()); z.textContent = etat.err.erreur; return; }
    etat.err = null; z.textContent = "";
    var t = r.texte;
    function ok() { etat.msg = "Message copié : vous pouvez le coller dans votre messagerie."; majMsg(); var o = document.getElementById("ms-ok"); if (o) { o.scrollIntoView({ block: "center" }); o.focus(); } }
    function secours() {
      var ta = document.createElement("textarea"); ta.value = t; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;left:-9999px;top:0";
      document.body.appendChild(ta); ta.select();
      var bon = false; try { bon = document.execCommand("copy"); } catch (e) { bon = false; }
      document.body.removeChild(ta);
      if (bon) ok(); else { etat.msg = "La copie automatique n'a pas fonctionné : sélectionnez le texte de l'aperçu et copiez-le."; majMsg(); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, secours); else secours();
  }
  /* Passe en modification : le texte type devient un texte libre, et les champs au-dessus sont verrouillés jusqu'au retour au texte type. */
  function modifierTexte() {
    lireForm();
    var r = MS.composer(store(), Object.assign({}, valeursMsg(), { edition: null })), z = document.getElementById("ms-err");
    if (!r.ok) { etat.err = r; if (z) z.textContent = r.erreur; return; }
    etat.err = null; etat.edition = { objet: r.objet, corps: r.corps };
    majEcrire();
    var e = document.getElementById("ms-ecorps"); if (e) e.focus();
  }
  function annulerEdition() {
    etat.edition = null; etat.err = null;
    majEcrire();
    var b = app.querySelector('[data-act="modifier-texte"]'); if (b) b.focus();
  }
  function envoyer() {
    lireForm();
    var st = store(), r = MS.envoyer(st, valeursMsg());
    if (!r.ok) {
      etat.err = r; var z = document.getElementById("ms-err"); z.textContent = r.erreur;
      majEcrire();
      var e = document.getElementById(r.champ === "objet-edite" ? "ms-eobjet" : r.champ === "corps-edite" ? "ms-ecorps" : "ms-f-" + r.champ) || (r.champ === "client" ? document.getElementById("ms-cq") || document.getElementById("ms-cl-ok") : null) || document.getElementById(r.champ === "mot" ? "ms-mot" : "ms-err");
      if (e) { if (!e.hasAttribute("tabindex") && !/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(e.tagName)) e.setAttribute("tabindex", "-1"); e.focus(); }
      return;
    }
    B.store.sauver();
    var x = r.message, c = CLIENT[x.c];
    etat.msg = "Message envoyé à " + nomCourt(c) + " : « " + x.objet + " ». Il figure dans le journal ci-dessous et dans la fiche du client.";
    etat.err = null; etat.edition = null; etat.mot = ""; etat.nbJournal = Math.max(etat.nbJournal, PAGE); initChamps();
    majEcrire(); majJournal(); majMsg();
    var o = document.getElementById("ms-ok"); if (o) { o.scrollIntoView({ block: "center" }); o.focus(); }
  }
  function imprimer() {
    lireForm();
    var r = texteBrut();
    if (!r) { etat.err = MS.composer(store(), valeursMsg()); document.getElementById("ms-err").textContent = etat.err.erreur; return; }
    var c = r.client, corps = '<dl class="dp-mail-tete"><div><dt>De</dt><dd>' + esc(r.de) + '</dd></div><div><dt>À</dt><dd>' + esc(c.civ + " " + c.prenom + " " + c.nom) + '</dd></div><div><dt>Objet</dt><dd>' + esc(r.objet) + '</dd></div></dl><div class="dp-mail">' + esc(r.corps + "\n\n" + r.signature + (r.pied ? "\n\n" + r.pied : "")) + "</div>";
    IMP.imprimer(IMP.document({ titre: "E-mail à " + nomCourt(c), sous: r.modele.titre, corps: corps, courrier: true }), IMP.nomFichier("Email_" + c.nom + "_" + c.prenom + "_" + r.modele.id));
  }

  /* ---------- page ---------- */
  function render() {
    app.innerHTML = '<nav class="fil-ariane" aria-label="Fil d\'Ariane"><a href="index.html">' + ICO.retour + "Accueil</a><span aria-hidden=\"true\">/</span><span>Messagerie</span></nav>" +
      '<div class="page-titre"><h1>Messagerie</h1><p>' + esc(B.fmtLong(B.aujourdhui())) + " – e-mails types avec signature professionnelle</p></div>" +
      '<div id="z-msg"></div><div class="page-grille">' +
      '<section class="bloc" aria-labelledby="t-sig"><div class="bloc-tete"><h2 id="t-sig" tabindex="-1">Ma signature</h2></div><div id="z-sig"></div></section>' +
      '<div id="z-ecrire"></div>' +
      '<section class="bloc" aria-labelledby="t-journal"><div class="bloc-tete"><h2 id="t-journal" tabindex="-1">Messages envoyés</h2><span class="sous" id="ms-nb"></span></div><div id="z-journal"></div></section></div>' +
      '<p class="mention" style="margin-top:16px">Vos messages sont enregistrés dans ce navigateur, sur cet ordinateur.</p>';
    document.getElementById("z-sig").innerHTML = identiteHtml();
    majEcrire(); majJournal();
  }

  /* ---------- événements ---------- */
  app.addEventListener("input", function (e) {
    var t = e.target;
    if (t.id === "ms-cq") { etat.q = t.value; suggestions(); }
    else if (t.id === "ms-mot") { etat.mot = t.value; majApercu(); }
    else if (t.id === "ms-eobjet" && etat.edition) etat.edition.objet = t.value;
    else if (t.id === "ms-ecorps" && etat.edition) etat.edition.corps = t.value;
    else if (/^ms-f-/.test(t.id)) { etat.champs[t.id.slice(5)] = t.type === "checkbox" ? t.checked : t.value; majApercu(); }
  });
  app.addEventListener("change", function (e) {
    var t = e.target;
    if (t.name === "ms-modele") { lireForm(); etat.modele = t.value; etat.edition = null; etat.err = null; initChamps(); majEcrire(); var r = document.getElementById("ms-m-" + etat.modele); if (r) r.focus(); }
    else if (/^ms-f-/.test(t.id)) { etat.champs[t.id.slice(5)] = t.type === "checkbox" ? t.checked : t.value; etat.err = null; var z = document.getElementById("ms-err"); if (z) z.textContent = ""; majApercu(); }
  });
  app.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b) return;
    var act = b.getAttribute("data-act"), id = b.getAttribute("data-id"), st = store();
    if (act === "modifier-nom") { etat.identForm = true; etat.identErr = null; majIdentite(); var n = document.getElementById("ms-nom"); if (n) n.focus(); }
    else if (act === "annuler-nom") { etat.identForm = false; etat.identErr = null; majIdentite(); var t = document.getElementById("t-sig"); if (t) t.focus(); }
    else if (act === "changer-client") { lireForm(); etat.client = null; etat.edition = null; etat.q = ""; etat.modele = ""; etat.champs = {}; etat.err = null; majEcrire(); document.getElementById("ms-cq").focus(); }
    else if (act === "choisir-client") { etat.edition = null; etat.client = parseInt(id, 10); etat.q = ""; etat.err = null; etat.modele = ""; etat.champs = {}; majEcrire(); var g = document.querySelector('input[name="ms-modele"]:not([disabled])'); if (g) g.focus(); else { var tt = document.getElementById("t-ecrire"); if (tt) tt.focus(); } }
    else if (act === "retirer-camp") { etat.camp = ""; majEcrire(); var t2 = document.getElementById("t-ecrire"); if (t2) t2.focus(); }
    else if (act === "modifier-texte") modifierTexte();
    else if (act === "annuler-edition") annulerEdition();
    else if (act === "copier") copier();
    else if (act === "imprimer-msg") imprimer();
    else if (act === "plus") { etat.nbJournal += PAGE; majJournal(); }
    else if (act === "suppr") { etat.supprimer = id; majJournal(); var c1 = app.querySelector('[data-act="suppr-oui"]'); if (c1) c1.focus(); }
    else if (act === "suppr-non") { var ci = etat.supprimer; etat.supprimer = null; majJournal(); var b2 = app.querySelector('[data-act="suppr"][data-id="' + ci + '"]'); if (b2) b2.focus(); }
    else if (act === "suppr-oui") {
      if (MS.supprimer(st, id)) B.store.sauver();
      etat.supprimer = null; etat.msg = "Message supprimé du journal."; majJournal(); majMsg(); majEcrire();
      var ok = document.getElementById("ms-ok"); if (ok) ok.focus();
    }
  });
  app.addEventListener("submit", function (e) {
    if (e.target.id === "form-ms") { e.preventDefault(); envoyer(); }
    else if (e.target.id === "form-ident") {
      e.preventDefault();
      var r = MS.definirIdentite(store(), document.getElementById("ms-nom").value, document.getElementById("ms-classe").value);
      if (!r.ok) { etat.identErr = r.erreur; document.getElementById("ms-ident-err").textContent = r.erreur; var f = document.getElementById(r.champ === "classe" ? "ms-classe" : "ms-nom"); majIdentite(); f = document.getElementById(r.champ === "classe" ? "ms-classe" : "ms-nom"); if (f) f.focus(); return; }
      B.store.sauver(); if (window.SGBF.identite) window.SGBF.identite.confirmer(); etat.identForm = false; etat.identErr = null; etat.msg = "Signature enregistrée : " + r.nom + ".";
      majIdentite(); majMsg();
      var o = document.getElementById("ms-ok"); if (o) o.focus();
    }
  });

  RECH.init(CL, document.getElementById("rech"), document.getElementById("rech-res"), document.getElementById("rech-statut"));
  render();
  /* Paramètres d'adresse : ?client=ID&modele=ID&campagne=ID (depuis la fiche client, l'agenda ou une campagne). */
  var pc = parseInt(params.get("client"), 10), pm = params.get("modele"), pk = params.get("campagne");
  var kc = pk ? trouverCamp(pk) : null;
  if (kc) etat.camp = kc.id;
  if (CLIENT[pc] && (!kc || kc.ids.indexOf(pc) >= 0)) {
    etat.client = pc;
    if (pm && MS.MODELE[pm] && MS.disponibilite(store(), CLIENT[pc], pm).ok) { etat.modele = pm; initChamps(); }
  }
  if (kc || etat.client) { majEcrire(); }
  if (etat.client && MS.signature(store()).ok) { var foc = document.getElementById(etat.modele ? "ms-m-" + etat.modele : "t-ecrire"); if (foc) foc.focus(); }
})();
