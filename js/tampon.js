/* GS Banque & Assurance – tampon de l'agence, signature du conseiller et date du jour des documents à faire signer.
   Ce module ne fabrique que du texte (HTML), comme documents.js, dont il est une brique : il sert aussi au contrat de souscription et à l'offre de crédit.
   Sur un document à signer, la banque « signe » avec :
     – le tampon de l'agence, daté du jour (tampon dateur) ;
     – la signature du conseiller : le prénom et le nom de l'élève, inscrits à l'impression (identite.js) à la place de l'élément [data-eleve] ;
     – la date du jour dans « Fait à Paris, le … ».
   La signature du client, elle, reste à faire à la main. Fonctions pures, testées avec Node. */
(function (root) {
  "use strict";

  var AGENCE = { banque: "GS Banque & Assurance", agence: "Agence de Paris", rue: "27 rue de Châteaudun", ville: "75009 Paris" };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function dateLongue(d) { return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }); }
  function dateCourte(d) { return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }); }

  /* Le tampon dateur de l'agence (dessiné en CSS : aucune image). */
  function tampon(date) {
    var d = dateCourte(date);
    return '<div class="dp-tampon" role="img" aria-label="Tampon de l\'agence de Paris, daté du ' + esc(d) + '">' +
      "<span>" + esc(AGENCE.banque) + "</span><span>" + esc(AGENCE.agence) + "</span><span>" + esc(AGENCE.rue + " – " + AGENCE.ville) + '</span><span class="dp-tampon-date">' + esc(d) + "</span></div>";
  }
  /* Zone de signature de la banque : le tampon recouvre en partie la signature (le nom de l'élève, en écriture manuscrite) posée sur la ligne ;
     sous la ligne, le nom et la qualité du signataire. Sans nom d'élève, signature et légende sont retirées à l'impression (identite.remplir). */
  function zoneBanque(date) {
    return '<div class="dp-zone-cachet">' + tampon(date) + '<p class="dp-signature" data-auteur><span data-eleve></span></p></div>' +
      '<p class="dp-legende" data-auteur><span data-eleve></span>, conseiller clientèle particuliers</p>';
  }
  /* « Fait à Paris, le 11 novembre 2026 » : la date du jour s'inscrit toute seule. */
  function faitA(date) { return "Fait à Paris, le " + dateLongue(date); }

  var api = { AGENCE: AGENCE, tampon: tampon, zoneBanque: zoneBanque, faitA: faitA, dateLongue: dateLongue, dateCourte: dateCourte };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.tampon = api; }
})(typeof window !== "undefined" ? window : null);
