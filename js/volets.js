/* GS Banque & Assurance – pages à volets : une même page réunit deux outils (« Portefeuille » : analyse et clients ; « Simulateur » : épargne et prêt).
   Un seul volet est affiché à la fois ; l'autre garde son état (saisies, résultats, filtres) quand on revient dessus.
   Ce fichier monte l'entête de la page (fil d'Ariane, titre), la barre de volets (onglets accessibles au clavier) et un emplacement par volet ;
   chaque outil (app_*.js) se monte ensuite dans son emplacement. Voir page_portefeuille.js et page_simulateur.js pour la liste des volets. */
(function (root) {
  "use strict";
  var SG = root.SGBF = root.SGBF || {};

  /* Volet à ouvrir. Ordre : paramètre ?volet=, puis volet propre à la page (attribut data-volet de <body> : anciennes adresses analyse.html,
     epargne.html, pret.html), puis détection d'après les autres paramètres de l'adresse (anciens liens du catalogue), puis volet par défaut. */
  function choisir(cfg, params, voletPage) {
    var ids = cfg.volets.map(function (v) { return v.id; });
    var v = params.get("volet");
    if (ids.indexOf(v) >= 0) return v;
    if (ids.indexOf(voletPage) >= 0) return voletPage;
    if (cfg.detecter) { var d = cfg.detecter(params); if (ids.indexOf(d) >= 0) return d; }
    return ids.indexOf(cfg.defaut) >= 0 ? cfg.defaut : ids[0];
  }

  var page = null;

  function monter(cfg) {
    var doc = root.document, B = SG.banque, ICO = SG.icones, esc = B.esc;
    var app = cfg.app || doc.getElementById("app");
    var query = new URLSearchParams(root.location.search);
    var cible = choisir(cfg, query, doc.body.getAttribute("data-volet"));
    var propres = new URLSearchParams(root.location.search); propres.delete("volet");
    page = { cfg: cfg, actif: cible, cible: cible, params: propres, etats: {} };

    var onglets = cfg.volets.map(function (v) {
      var a = v.id === cible;
      return '<button type="button" role="tab" class="onglet" id="tab-v-' + v.id + '" aria-selected="' + a + '" aria-controls="volet-' + v.id + '" tabindex="' + (a ? 0 : -1) + '" data-volet="' + v.id + '">' + esc(v.lib) + "</button>";
    }).join("");
    var panneaux = cfg.volets.map(function (v) {
      return '<div class="volet" role="tabpanel" id="volet-' + v.id + '" aria-labelledby="tab-v-' + v.id + '"' + (v.id === cible ? "" : " hidden") + '><p class="volet-intro">' + esc(v.intro) + '</p><div class="volet-corps" id="volet-corps-' + v.id + '"></div></div>';
    }).join("");
    app.innerHTML = '<nav class="fil-ariane" aria-label="Fil d\'Ariane"><a href="index.html">' + ICO.retour + "Accueil</a><span aria-hidden=\"true\">/</span><span>" + esc(cfg.titre) + "</span></nav>" +
      '<div class="page-titre"><h1>' + esc(cfg.titre) + "</h1><p>" + esc(cfg.sous) + "</p></div>" +
      '<div class="onglets volets-onglets" role="tablist" aria-label="' + esc(cfg.aria) + '">' + onglets + "</div>" + panneaux;

    function volet(id) { return cfg.volets.filter(function (v) { return v.id === id; })[0]; }
    function activer(id, focus) {
      if (!volet(id)) return;
      page.actif = id;
      cfg.volets.forEach(function (v) {
        var t = doc.getElementById("tab-v-" + v.id), p = doc.getElementById("volet-" + v.id), a = v.id === id;
        t.setAttribute("aria-selected", String(a)); t.setAttribute("tabindex", a ? "0" : "-1"); p.hidden = !a;
      });
      doc.title = volet(id).docTitre;
      majUrl(id);
      if (focus) doc.getElementById("tab-v-" + id).focus();
    }
    var liste = app.querySelector(".volets-onglets");
    liste.addEventListener("click", function (e) {
      var b = e.target.closest("[data-volet]"); if (b) activer(b.getAttribute("data-volet"), false);
    });
    liste.addEventListener("keydown", function (e) {
      var ids = cfg.volets.map(function (v) { return v.id; }), i = ids.indexOf(page.actif), n = ids.length, j = -1;
      if (e.key === "ArrowRight") j = (i + 1) % n; else if (e.key === "ArrowLeft") j = (i + n - 1) % n; else if (e.key === "Home") j = 0; else if (e.key === "End") j = n - 1;
      if (j < 0) return;
      e.preventDefault(); activer(ids[j], true);
    });
    doc.title = volet(cible).docTitre;

    /* La recherche de l'en-tête est commune à toute la page : elle n'est branchée qu'une fois. */
    if (SG.recherche && SG.clients) SG.recherche.init(SG.clients, doc.getElementById("rech"), doc.getElementById("rech-res"), doc.getElementById("rech-statut"));
    return { actif: function () { return page.actif; }, activer: activer };
  }

  /* Emplacement d'un volet : l'outil s'y monte comme il le ferait dans toute la page. */
  function panneau(id) { return root.document.getElementById("volet-corps-" + id); }
  /* Paramètres de l'adresse destinés à un volet : seul le volet visé par l'adresse les reçoit (les deux outils d'une page n'ont pas à se les partager). */
  function params(id) { return page && page.cible === id ? new URLSearchParams(page.params.toString()) : new URLSearchParams(""); }
  /* Un outil indique les paramètres qui décrivent son état (par exemple le critère d'analyse) ; ils sont recopiés dans l'adresse quand son volet est affiché. */
  function enregistrer(id, f) { if (page) page.etats[id] = f; }
  function majUrl(id) {
    if (!page || page.actif !== id) return;
    var o = { volet: id }, f = page.etats[id];
    if (f) { var x = f(); Object.keys(x).forEach(function (k) { o[k] = x[k]; }); }
    try { root.history.replaceState(null, "", "?" + new URLSearchParams(o).toString()); } catch (e) { /* ignoré */ }
  }

  var api = { monter: monter, choisir: choisir, panneau: panneau, params: params, enregistrer: enregistrer, majUrl: majUrl };
  SG.volets = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
