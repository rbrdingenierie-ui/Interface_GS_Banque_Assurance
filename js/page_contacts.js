/* GS Banque & Assurance – page « Compte Rendu d'Entretien (CRE) » : deux volets, rédiger le compte rendu d'un entretien avec un client et la fiche d'entretien (voir volets.js).
   Pour changer l'ordre des volets ou le volet ouvert par défaut, modifier la liste ci-dessous.
   Les anciens liens (campagnes, fiche client) arrivent sur le volet par défaut, « Rédiger un CRE », avec ?client= et ?campagne=. */
(function () {
  "use strict";
  var B = window.SGBF.banque;
  window.SGBF.volets.monter({
    titre: "Compte Rendu d'Entretien (CRE)",
    aria: "Rédiger un CRE et fiche d'entretien",
    sous: B.fmtLong(B.aujourdhui()) + " – accueillir un client, mener l'entretien, puis noter ce qu'il a décidé",
    volets: [
      { id: "contact", lib: "Rédiger un CRE", docTitre: "GS Banque & Assurance – Compte Rendu d'Entretien (CRE)", intro: "Rédiger le compte rendu d'un client reçu à l'accueil ou en rendez-vous : produit abordé, rebond commercial, résultat." },
      { id: "entretien", lib: "Fiche d'entretien", docTitre: "GS Banque & Assurance – Fiche d'entretien client", intro: "Mener l'entretien en sept étapes (préparation, accueil, découverte, accord, proposition, argumentation, conclusion), puis mettre à jour le dossier du client." }
    ],
    defaut: "contact"
  });
})();
