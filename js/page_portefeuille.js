/* GS Banque & Assurance – page « Portefeuille » : deux volets, l'analyse du portefeuille et la liste des clients (voir volets.js).
   Pour changer l'ordre des volets ou le volet ouvert par défaut, modifier la liste ci-dessous. */
(function () {
  "use strict";
  var B = window.SGBF.banque, CL = window.SGBF.clients;
  window.SGBF.volets.monter({
    titre: "Portefeuille",
    aria: "Analyse du portefeuille et portefeuille clients",
    sous: "Agence de Paris – " + CL.length + " clients – " + B.fmtLong(B.aujourdhui()),
    volets: [
      { id: "analyse", lib: "Analyse du portefeuille", docTitre: "GS Banque & Assurance – Analyse du portefeuille", intro: "Répartition des clients par catégorie socioprofessionnelle et autres critères, indicateurs par segment, lecture qualitative, impression." },
      { id: "clients", lib: "Portefeuille clients", docTitre: "GS Banque & Assurance – Portefeuille clients", intro: "Recherche, filtres et tris, éligibilité à un produit, sélection d'une cible enregistrée, impression." }
    ],
    defaut: "analyse",
    /* Anciens liens vers le portefeuille clients (catalogue, campagnes) : filtres ou cible dans l'adresse. */
    detecter: function (p) { var autre = false; p.forEach(function (v, k) { if (k !== "critere" && k !== "volet") autre = true; }); return autre ? "clients" : null; }
  });
})();
