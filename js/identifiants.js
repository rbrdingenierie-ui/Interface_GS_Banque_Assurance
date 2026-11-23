/* GS Banque & Assurance – accès au site. Ce fichier ne contient ni l'identifiant ni le mot de passe en clair : seulement leur empreinte.
   Ne pas modifier ce fichier à la main. */
(function (root) {
  "use strict";
  root.SGBF = root.SGBF || {};
  root.SGBF.identifiants = { sel: "5b819ac4a1aef146f1e04287139d7c2e", tours: 60000, empreinte: "6c70151aba1ad6a4e993ada4daf19b4ad51e6c27041292e251010ee5c6ebe9ac" };
  if (typeof module !== "undefined" && module.exports) module.exports = root.SGBF.identifiants;
})(typeof window !== "undefined" ? window : globalThis);
