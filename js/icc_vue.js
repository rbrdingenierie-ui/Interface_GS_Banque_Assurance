/* GS Banque & Assurance – affichage de l'ICC (Indice de Commercialité Client) : un seul bloc, utilisé sous la note Bâle des dossiers et dans la fiche client 360.
   Reçoit le résultat de icc.classer(…) et renvoie du HTML ; ne touche pas à la page. */
(function (root) {
  "use strict";
  var ICC = root && root.SGBF && root.SGBF.icc ? root.SGBF.icc : require("./icc.js");

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var OUI = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var NON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

  /* r : résultat de classer ; o : { id (préfixe des identifiants), sous (texte sous le titre) } */
  function bloc(r, o) {
    o = o || {};
    var id = o.id || "icc", n = r.niveau;
    var echelle = ICC.NIVEAUX.map(function (x) {
      var actif = x.code === r.code;
      return '<li class="icc-cran ' + x.classe + (actif ? " icc-cran-actif" : "") + '"' + (actif ? ' aria-current="true"' : "") + ">" + esc(x.nom) + "</li>";
    }).join("");
    var crit = r.criteres.map(function (c) {
      var lib = c.cle === "assurances" ? "Assurance (1 pour le vert, 2 pour le vert+)" : c.lib;
      return '<li class="' + (c.ok ? "icc-ok" : "icc-ko") + '">' + (c.ok ? OUI : NON) + '<span><strong>' + esc(lib) + "</strong> : " + (c.ok ? "oui" : "non") + ' <span class="icc-detail">– ' + esc(c.detail) + "</span></span></li>";
    }).join("");
    var prog = r.pourProgresser.length
      ? '<p class="icc-action"><strong>Pour passer au niveau suivant :</strong></p><ul class="icc-pistes">' + r.pourProgresser.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>"
      : '<p class="icc-action"><strong>Niveau maximal.</strong> ' + esc(n.action) + "</p>";
    var defs = ICC.DEFINITIONS.map(function (d) { return "<dt>" + esc(d[0]) + "</dt><dd>" + esc(d[1]) + "</dd>"; }).join("");
    var niv = ICC.NIVEAUX.map(function (x) { return '<li><span class="icc-puce ' + x.classe + '">' + esc(x.nom) + "</span> " + esc(x.def) + "</li>"; }).join("");
    return '<section class="' + (o.classe || "bloc") + ' icc-bloc" aria-labelledby="h-' + id + '"><h2 id="h-' + id + '">' + (o.icone || "") + 'ICC – Indice de Commercialité Client</h2>' +
      '<div class="bale-ligne"><span class="icc-grand ' + n.classe + '">' + esc(n.nom) + '</span><div><p class="bale-lib">' + esc(n.lib) + '</p><p class="bale-desc">' + esc(n.lecture) + "</p></div></div>" +
      '<ol class="icc-echelle" aria-label="Échelle de l\'ICC, du rouge au vert+">' + echelle + "</ol>" +
      '<ul class="icc-criteres">' + crit + "</ul>" + prog +
      '<details class="icc-aide"><summary>Comment l\'ICC est-il calculé ?</summary><ol class="icc-niveaux">' + niv + "</ol><dl>" + defs + "</dl></details>" +
      '<p class="mention">' + esc(o.sous || "Notation interne de GS Banque & Assurance : elle mesure l'équipement du client, pas son risque.") + "</p></section>";
  }

  var api = { bloc: bloc };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.iccVue = api; }
})(typeof window !== "undefined" ? window : null);
