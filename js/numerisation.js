/* GS Banque & Assurance – numérisation d'une pièce justificative (bouton « Scanner ou importer un document »).
   Utilisé à l'ouverture de compte (pièce d'identité, justificatif de domicile, justificatif de revenus) et à l'étape 2 du Montage de prêt (pièces à réunir).
   Le conseiller numérise la pièce remise par le client de l'une de deux façons :
     – « Scanner » : simulation du scanner de l'agence (une page, enregistrée avec la date et l'heure) ;
     – « Importer un fichier » : un fichier PDF, JPG ou PNG de l'ordinateur (5 Mo au plus) ; seuls son nom, son format et sa taille sont retenus (le fichier n'est pas conservé).
   Il vérifie ensuite la pièce : lisible, à jour, au nom du client. Un document n'est enregistré que si les trois vérifications sont cochées.
   Ce module contient les règles (testées sous Node) et la fenêtre de saisie ; les pages ne font que l'ouvrir et retenir le document renvoyé. */
(function (root) {
  "use strict";

  var B = root && root.SGBF ? root.SGBF.banque : require("./banque.js");

  var FORMATS = ["pdf", "jpg", "jpeg", "png"];
  var TAILLE_MAX = 5 * 1024 * 1024;       /* 5 Mo */
  var CONTROLES = [
    { id: "lisible", lib: "Le document est lisible : rien de flou, de coupé ni de caché." },
    { id: "jour", lib: "Le document est à jour." },
    { id: "nom", lib: "Le document est au nom du client." }
  ];

  var COURT = { lisible: "lisible", jour: "à jour", nom: "au nom du client" };

  /* ---------- règles ---------- */
  function e1(n) { return String(Math.round(n * 10) / 10).replace(".", ","); }
  /* Taille lisible : « 812 octets », « 245 Ko », « 1,2 Mo ». */
  function taille(n) {
    if (typeof n !== "number" || !isFinite(n) || n < 0) return "";
    if (n < 1024) return n + (n > 1 ? " octets" : " octet");
    if (n < 1024 * 1024) return Math.round(n / 1024) + " Ko";
    return e1(n / (1024 * 1024)) + " Mo";
  }
  function extension(nom) { var m = /\.([A-Za-z0-9]+)$/.exec(String(nom || "")); return m ? m[1].toLowerCase() : ""; }
  function formatDe(nom) { var e = extension(nom); return e === "jpeg" ? "JPG" : e.toUpperCase(); }
  function ascii(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  /* Nom de pièce pour un fichier : minuscules, sans accent, mots reliés par « _ », 30 caractères au plus et jamais coupé au milieu d'un mot. */
  function slug(s) {
    var t = ascii(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    if (t.length > 30) { t = t.slice(0, 31); var i = t.lastIndexOf("_"); t = i > 0 ? t.slice(0, i) : t.slice(0, 30); }
    return t || "piece";
  }
  function horodatage(now) { return B.ymd(now) + "T" + B.hhmm(now); }
  function ecrireDate(t) { var m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(String(t || "")); return m ? B.fmtDate(B.lireYmd(m[1])) + " à " + m[2] : ""; }
  /* Nom du fichier produit par le scanner : « Scan_<pièce>_AAAAMMJJ_HHMM.pdf ». */
  function nomScan(lib, now) { return "Scan_" + slug(lib) + "_" + B.ymd(now).replace(/-/g, "") + "_" + B.hhmm(now).replace(":", "") + ".pdf"; }
  function scanner(lib, now) { return { source: "scan", nom: nomScan(lib, now), format: "PDF", pages: 1, taille: null, date: horodatage(now) }; }
  /* Fichier choisi dans l'ordinateur : { name, size } → { ok, doc } ou { ok:false, erreur }. */
  function importer(fichier, now) {
    if (!fichier || !fichier.name) return { ok: false, erreur: "Choisissez un fichier à importer." };
    if (FORMATS.indexOf(extension(fichier.name)) < 0) return { ok: false, erreur: "Format non accepté : importez un fichier PDF, JPG ou PNG." };
    if (!(fichier.size > 0)) return { ok: false, erreur: "Le fichier est vide : choisissez un autre fichier." };
    if (fichier.size > TAILLE_MAX) return { ok: false, erreur: "Le fichier est trop lourd (" + taille(fichier.size) + ") : 5 Mo au plus." };
    return { ok: true, doc: { source: "import", nom: String(fichier.name).slice(0, 80), format: formatDe(fichier.name), pages: null, taille: fichier.size, date: horodatage(now) } };
  }
  /* Les trois vérifications du conseiller. precision : ce qu'« à jour » veut dire pour cette pièce (« en cours de validité », « de moins de 3 mois »…). */
  function controles(precision) {
    return CONTROLES.map(function (c) { return { id: c.id, lib: c.id === "jour" && precision ? "Le document est à jour (" + precision + ")." : c.lib }; });
  }
  /* Enregistre le document avec ses vérifications : toutes cochées, sinon refus. coches : { lisible, jour, nom } */
  function enregistrer(doc, coches) {
    if (!doc || !doc.nom) return { ok: false, erreur: "Scannez ou importez d'abord le document.", champ: "document" };
    var manque = CONTROLES.filter(function (c) { return !(coches && coches[c.id]); });
    if (manque.length) {
      var noms = manque.map(function (c) { return COURT[c.id]; }), liste = noms.length > 1 ? noms.slice(0, -1).join(", ") + " et " + noms[noms.length - 1] : noms[0];
      return { ok: false, erreur: manque.length === CONTROLES.length ? "Cochez les " + CONTROLES.length + " vérifications : " + noms.join(", ") + "." : manque.length === 1 ? "Cochez la vérification manquante : " + liste + "." : "Cochez les " + manque.length + " vérifications manquantes : " + liste + ".", champ: manque[0].id };
    }
    var o = {}; Object.keys(doc).forEach(function (k) { o[k] = doc[k]; });
    o.controles = { lisible: true, jour: true, nom: true };
    return { ok: true, doc: o };
  }
  /* Un document enregistré est complet : les trois vérifications y sont. */
  function valide(doc) { return !!(doc && doc.nom && doc.controles && CONTROLES.every(function (c) { return doc.controles[c.id] === true; })); }
  /* Texte court : « Scan du 10/11/2026 à 10:30 » ou « Fichier « quittance.pdf » (245 Ko) du 10/11/2026 à 10:30 ». */
  function libelle(doc) {
    if (!doc) return "";
    return doc.source === "scan" ? "Scan du " + ecrireDate(doc.date) : "Fichier « " + doc.nom + " » (" + taille(doc.taille) + "), importé le " + ecrireDate(doc.date);
  }

  /* Le même texte, commençant par une minuscule : à placer après un tiret ou entre parenthèses (« – scan du 10/11/2026 à 10:30 »). */
  function libelleMin(doc) { var t = libelle(doc); return t ? t.charAt(0).toLowerCase() + t.slice(1) : ""; }

  var api = { FORMATS: FORMATS, TAILLE_MAX: TAILLE_MAX, CONTROLES: CONTROLES, taille: taille, extension: extension, formatDe: formatDe, slug: slug, nomScan: nomScan, scanner: scanner, importer: importer, controles: controles, enregistrer: enregistrer, valide: valide, libelle: libelle, libelleMin: libelleMin, ecrireDate: ecrireDate };

  /* ---------- fenêtre de saisie (navigateur seulement) ---------- */
  if (typeof document !== "undefined") {
    var esc = B.esc, dlg = null, ctx = null, url = null;
    var maintenant = function () { return B.maintenant ? B.maintenant() : new Date(); };

    var liberer = function () { if (url) { try { URL.revokeObjectURL(url); } catch (e) { /* ignoré */ } url = null; } };
    var erreur = function (msg, champ) {
      var e = document.getElementById("num-err"); e.textContent = msg || "";
      if (msg && champ) champ.focus();
    };
    var apercuScan = function (doc, piece) {
      var barres = "";
      [[28, 150], [44, 190], [60, 120], [76, 170], [92, 140]].forEach(function (b) { barres += '<rect x="26" y="' + (b[0] + 62) + '" width="' + b[1] + '" height="7" rx="3" fill="#d5dee7"/>'; });
      return '<svg class="num-scan" viewBox="0 0 240 300" role="img" aria-label="Aperçu de la copie numérisée : ' + esc(piece) + ', ' + esc(ecrireDate(doc.date)) + '">' +
        '<rect x="2" y="2" width="236" height="296" rx="6" fill="#ffffff" stroke="#b9c6d2" stroke-width="2"/>' +
        '<rect x="26" y="24" width="64" height="40" rx="4" fill="#e4f3fb"/><rect x="100" y="28" width="110" height="9" rx="4" fill="#1b3a57"/><rect x="100" y="46" width="80" height="7" rx="3" fill="#9fb4c6"/>' +
        barres + '<rect x="26" y="206" width="188" height="44" rx="4" fill="#f3f6f9" stroke="#d5dee7"/>' +
        '<text x="120" y="233" font-size="13" font-weight="700" font-family="Segoe UI, Arial, sans-serif" text-anchor="middle" fill="#1b3a57">COPIE NUMÉRISÉE</text>' +
        '<text x="120" y="280" font-size="11" font-family="Segoe UI, Arial, sans-serif" text-anchor="middle" fill="#4f5f6e">' + esc(ecrireDate(doc.date)) + "</text></svg>";
    };
    var apercu = function (doc, piece, fichier) {
      var z = document.getElementById("num-apercu"); if (!z) return;
      if (!doc) { z.innerHTML = '<p class="num-vide">Aucun document pour le moment.</p>'; return; }
      var infos = '<dl class="num-infos"><div><dt>Nom</dt><dd>' + esc(doc.nom) + "</dd></div><div><dt>Format</dt><dd>" + esc(doc.format) + (doc.pages ? ", " + doc.pages + " page" : "") + "</dd></div>" +
        (doc.taille ? "<div><dt>Taille</dt><dd>" + esc(taille(doc.taille)) + "</dd></div>" : "") + "<div><dt>" + (doc.source === "scan" ? "Scanné" : "Importé") + "</dt><dd>le " + esc(ecrireDate(doc.date)) + "</dd></div></dl>";
      var vue;
      if (doc.source === "scan") vue = apercuScan(doc, piece);
      else if (fichier && /^image\//.test(fichier.type || "") && root.URL && URL.createObjectURL) { liberer(); url = URL.createObjectURL(fichier); vue = '<img class="num-img" src="' + url + '" alt="Aperçu du fichier importé : ' + esc(doc.nom) + '">'; }
      else vue = '<div class="num-fichier" aria-hidden="true"><span>' + esc(doc.format) + "</span></div>";
      z.innerHTML = '<div class="num-vue">' + vue + "</div>" + infos;
    };
    var ouvrir = function (o) {
      /* o : { piece, precision, doc, ouvreur, focusId, apres(doc), retirer() } */
      ctx = { o: o, doc: o.doc ? o.doc : null, fichier: null };
      if (!dlg) {
        dlg = document.createElement("dialog"); dlg.id = "dlg-num"; dlg.className = "num-dlg"; dlg.setAttribute("aria-labelledby", "num-titre");
        document.body.appendChild(dlg);
        dlg.addEventListener("close", function () {
          liberer();
          var c = ctx && ctx.o, cible = c && ((c.focusId && document.getElementById(c.focusId)) || (c.ouvreur && document.contains(c.ouvreur) ? c.ouvreur : null));
          if (cible) { try { cible.focus(); } catch (e) { /* ignoré */ } }
        });
        dlg.addEventListener("click", function (ev) { if (ev.target === dlg) dlg.close(); });
        dlg.addEventListener("change", function (ev) {
          var t = ev.target;
          if (t.name === "num-mode") { document.getElementById("num-mode-scan").hidden = t.value !== "scan"; document.getElementById("num-mode-import").hidden = t.value !== "import"; erreur(""); }
          else if (t.id === "num-fichier") {
            erreur(""); var f = t.files && t.files[0];
            if (!f) return;
            var r = importer({ name: f.name, size: f.size }, maintenant());
            if (!r.ok) { ctx.doc = null; ctx.fichier = null; liberer(); apercu(null); erreur(r.erreur, t); t.value = ""; return; }
            ctx.doc = r.doc; ctx.fichier = f; apercu(ctx.doc, ctx.o.piece, f);
          } else if (t.name === "num-ctrl") erreur("");
        });
        dlg.addEventListener("click", function (ev) {
          var b = ev.target.closest && ev.target.closest("[data-num]"); if (!b) return;
          var a = b.getAttribute("data-num");
          if (a === "fermer") dlg.close();
          else if (a === "scanner") { erreur(""); ctx.fichier = null; ctx.doc = scanner(ctx.o.piece, maintenant()); apercu(ctx.doc, ctx.o.piece); var st = document.getElementById("num-statut"); if (st) st.textContent = "Scan terminé : " + ctx.doc.nom + " (1 page)."; }
          else if (a === "retirer") { var r = ctx.o.retirer; dlg.close(); if (r) r(); }
        });
        dlg.addEventListener("submit", function (ev) {
          if (!ev.target || ev.target.id !== "num-form") return;
          ev.preventDefault();
          var coches = {}; CONTROLES.forEach(function (c) { var i = dlg.querySelector('input[name="num-ctrl"][value="' + c.id + '"]'); coches[c.id] = !!(i && i.checked); });
          var r = enregistrer(ctx.doc, coches);
          if (!r.ok) {
            var cible = r.champ === "document" ? (dlg.querySelector('input[name="num-mode"]:checked').value === "scan" ? dlg.querySelector('[data-num="scanner"]') : document.getElementById("num-fichier")) : dlg.querySelector('input[name="num-ctrl"][value="' + r.champ + '"]');
            erreur(r.erreur, cible); return;
          }
          var apres = ctx.o.apres; dlg.close(); if (apres) apres(r.doc);
        });
      }
      var ex = ctx.doc, mode = ex && ex.source === "import" ? "import" : "scan", lib = o.piece;
      var verifs = controles(o.precision).map(function (c) {
        return '<li><label class="num-verif"><input type="checkbox" name="num-ctrl" value="' + c.id + '"' + (ex && valide(ex) ? " checked" : "") + "> <span>" + esc(c.lib) + "</span></label></li>";
      }).join("");
      dlg.innerHTML = '<form class="num-corps" id="num-form" novalidate>' +
        '<div class="num-tete"><h2 id="num-titre">Scanner ou importer un document</h2><button type="button" class="btn btn-secondaire btn-petit" data-num="fermer">Fermer</button></div>' +
        '<p class="num-piece"><strong>Pièce :</strong> ' + esc(lib) + "</p>" +
        '<fieldset class="num-choix"><legend>Comment numérisez-vous la pièce ?</legend>' +
        '<label class="num-opt"><input type="radio" name="num-mode" value="scan"' + (mode === "scan" ? " checked" : "") + "><span>Scanner la pièce (scanner de l'agence)</span></label>" +
        '<label class="num-opt"><input type="radio" name="num-mode" value="import"' + (mode === "import" ? " checked" : "") + "><span>Importer un fichier de l'ordinateur</span></label></fieldset>" +
        '<div class="num-mode" id="num-mode-scan"' + (mode === "scan" ? "" : " hidden") + '><p class="aide-champ">Posez la pièce sur la vitre du scanner, puis lancez le scan : la copie est enregistrée avec la date et l\'heure.</p>' +
        '<button type="button" class="btn btn-secondaire" data-num="scanner">Lancer le scan</button><p class="sr" id="num-statut" role="status"></p></div>' +
        '<div class="num-mode" id="num-mode-import"' + (mode === "import" ? "" : " hidden") + '><div class="champ"><label for="num-fichier">Fichier à importer</label><input id="num-fichier" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" aria-describedby="num-fichier-aide"><span class="aide-champ" id="num-fichier-aide">PDF, JPG ou PNG, 5 Mo au plus.</span></div></div>' +
        '<div class="num-apercu" id="num-apercu" role="group" aria-label="Aperçu du document" aria-live="polite"></div>' +
        '<fieldset class="num-verifs"><legend>Vérifications du conseiller</legend><ul>' + verifs + "</ul></fieldset>" +
        '<p class="msg-erreur" id="num-err" role="alert"></p>' +
        '<div class="num-btns"><button type="submit" class="btn btn-principal">Enregistrer le document</button><button type="button" class="btn btn-secondaire" data-num="fermer">Annuler</button>' +
        (ex && o.retirer ? '<button type="button" class="btn btn-secondaire num-retirer" data-num="retirer">Retirer le document</button>' : "") + "</div></form>";
      apercu(ex, lib);
      if (dlg.showModal) { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute("open", "");
      var p1 = dlg.querySelector('input[name="num-mode"]:checked'); if (p1) p1.focus();
    };

    /* Bouton et état à placer en face d'une pièce. id : identifiant de la pièce ; doc : document enregistré ou null ; desactive : dossier verrouillé (état seul, sans bouton). */
    var bouton = function (id, lib, doc, desactive) {
      /* dossier verrouillé (desactive) : plus de bouton, seul l'état du document reste affiché. */
      if (desactive && !doc) return "";
      return '<div class="num-zone">' + (desactive ? "" : '<button type="button" class="btn btn-secondaire btn-petit num-btn" id="num-' + esc(id) + '" data-act="num" data-id="' + esc(id) + '" aria-label="Scanner ou importer un document : ' + esc(lib) + '"' + (doc ? ' aria-describedby="num-etat-' + esc(id) + '"' : "") + '>Scanner ou importer un document</button>') +
        (doc ? '<span class="num-etat" id="num-etat-' + esc(id) + '">Numérisé : ' + esc(libelle(doc)) + "</span>" : "") + "</div>";
    };
    api.ouvrir = ouvrir; api.bouton = bouton;
  }

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.numerisation = api; }
})(typeof window !== "undefined" ? window : null);
