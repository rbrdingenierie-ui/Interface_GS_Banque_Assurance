/* GS Banque & Assurance – dossiers « du jour » des outils « Opérations débiteurs », « Mouvements atypiques » et « Gestion des incidents » (noms seulement).
   Sert à l'accueil pour afficher le nombre de dossiers restant à traiter. La liste est celle du jour (voir quotidien.js et quotidien_charge.js) : elle est la
   même pour toute la classe et change chaque jour. L'avancement est lu dans l'espace de stockage du navigateur (clés des deux outils) ; il n'est retenu que s'il
   a été enregistré le même jour (une nouvelle journée repart de zéro). */
(function (root) {
  "use strict";

  var navigateur = !!(root && root.SGBF);
  var cles = { debiteurs: "sgbf-simulateur-v3", atypiques: "sgbf-atypiques-v1", incidents: "sgbf-gdi-v1" };
  var versions = { debiteurs: 4, atypiques: 2, incidents: 1 };

  function nom(c) { return [c.civilite, c.prenom, c.nom].filter(Boolean).join(" "); }
  function noms(dossiers) { return (dossiers || []).map(function (d) { return { id: d.id, nom: nom(d.client) }; }); }

  var api = { cles: cles, versions: versions, jour: "reference", debiteurs: [], atypiques: [], incidents: [] };

  if (navigateur) {
    /* page : la liste du jour est déjà en place (quotidien_charge.js) */
    api.jour = root.SGBF.jourTravail ? root.SGBF.jourTravail.ymd : "reference";
    api.debiteurs = noms(root.SGBF.dossiers);
    api.atypiques = noms(root.SGBF.atypiques);
    api.incidents = noms(root.SGBF.incidents);
  } else {
    /* Node (tests) : dossiers de référence ; pourJour(ymd) donne la liste d'une date */
    api.debiteurs = noms(require("./data.js").dossiers);
    api.atypiques = noms(require("./data_atypiques.js").dossiers);
    api.incidents = noms(require("./data_incidents.js").dossiers);
    api.pourJour = function (ymd) {
      var j = require("./quotidien.js").jour(ymd);
      return { jour: ymd, debiteurs: noms(j.debiteurs.dossiers), atypiques: noms(j.atypiques.dossiers), incidents: noms(j.incidents.dossiers) };
    };
  }

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.travail = api; }
})(typeof window !== "undefined" ? window : null);
