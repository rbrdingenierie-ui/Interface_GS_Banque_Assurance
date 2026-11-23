/* GS Banque & Assurance – page « Simulateur » : deux volets, le simulateur d'épargne et le simulateur de prêt (voir volets.js).
   Pour changer l'ordre des volets ou le volet ouvert par défaut, modifier la liste ci-dessous. */
(function () {
  "use strict";
  window.SGBF.volets.monter({
    titre: "Simulateur",
    aria: "Simulateur d'épargne et simulateur de prêt",
    sous: "Deux calculatrices financières : l'épargne et le crédit",
    volets: [
      { id: "epargne", lib: "Simulateur d'épargne", docTitre: "GS Banque & Assurance – Simulateur d'épargne", intro: "Une calculatrice financière : capital acquis, montant à placer, versement régulier, durée ou taux." },
      { id: "pret", lib: "Simulateur de prêt", docTitre: "GS Banque & Assurance – Simulateur de prêt", intro: "Une calculatrice de crédit : mensualité, capital à emprunter ou durée, avec le tableau d'amortissement." }
    ],
    defaut: "epargne"
  });
})();
