/* GS Banque & Assurance – données du « Tableau de bord de l'agence » : résultats du mois écoulé des cinq conseillers de l'agence de Paris (l'étudiant et ses quatre collègues). Les chiffres sont INVENTÉS pour
   l'exercice : ils racontent une histoire que l'étudiant doit retrouver en lisant les écarts (une absence longue, un portefeuille repris avec beaucoup de clients distanciés, un conseiller en début de poste,
   une tarification qui fait monter les réclamations, un marché du crédit immobilier en baisse). Le mois affiché est toujours le mois civil qui précède la date du jour : l'exercice reste d'actualité.
   Montants (PNB, crédits, contrats) : [objectif, réalisé, même mois de l'an dernier, mois précédent].
   Taux : [objectif, numérateur, dénominateur, même mois de l'an dernier, mois précédent] ; objectif et repères sont exprimés dans l'unité de l'indicateur (pourcentage, produits par client, note sur 10).
   Le dénominateur du taux de transformation en rendez-vous est le numérateur du taux de décroché : un client n'est « joint » que si l'appel a abouti. */
(function (root) {
  "use strict";

  /* sens : « hausse » si un résultat plus élevé est favorable, « baisse » dans le cas contraire. type : « montant » (additif) ou « taux » (numérateur / dénominateur). */
  var INDICATEURS = [
    { id: "pnb", lib: "PNB du mois", famille: "quantitatif", type: "montant", unite: "eur", sens: "hausse", def: "Produit net bancaire : marge d'intermédiation (intérêts perçus moins intérêts payés) et commissions nettes générées par les clients du portefeuille, sur le mois." },
    { id: "credits", lib: "Production de crédits", famille: "quantitatif", type: "montant", unite: "eur", sens: "hausse", def: "Montant des crédits débloqués dans le mois (immobilier, consommation, professionnels)." },
    { id: "contrats", lib: "Contrats vendus", famille: "quantitatif", type: "montant", unite: "nb", sens: "hausse", def: "Nombre de contrats souscrits dans le mois (assurances, cartes, épargne, services), hors crédits." },
    { id: "equipement", lib: "Taux d'équipement", famille: "quantitatif", type: "taux", unite: "ratio", sens: "hausse", num: "Produits et services détenus", den: "Clients du portefeuille", def: "Nombre moyen de produits et services détenus par client du portefeuille." },
    { id: "decroche", lib: "Taux de décroché", famille: "qualitatif", type: "taux", unite: "pct", sens: "hausse", num: "Appels aboutis", den: "Appels passés", def: "Part des appels sortants qui aboutissent à une conversation avec le client." },
    { id: "rdv", lib: "Taux de transformation en rendez-vous", famille: "qualitatif", type: "taux", unite: "pct", sens: "hausse", num: "Rendez-vous obtenus", den: "Clients joints", def: "Part des clients joints par téléphone qui acceptent un rendez-vous." },
    { id: "reclamation", lib: "Taux de réclamation", famille: "qualitatif", type: "taux", unite: "pct", sens: "baisse", num: "Réclamations reçues", den: "Clients du portefeuille", def: "Nombre de réclamations reçues dans le mois pour 100 clients du portefeuille." },
    { id: "distancies", lib: "Clients distanciés", famille: "qualitatif", type: "taux", unite: "pct", sens: "baisse", num: "Clients distanciés", den: "Clients du portefeuille", def: "Part des clients du portefeuille sans aucun contact commercial depuis plus de douze mois (durée fixée par GS pour l'exercice)." },
    { id: "revue3m", lib: "Revues à trois mois des nouveaux clients", famille: "qualitatif", type: "taux", unite: "pct", sens: "hausse", num: "Revues réalisées", den: "Nouveaux clients entrés il y a trois mois", def: "Part des clients entrés il y a trois mois qui ont eu leur rendez-vous de revue." },
    { id: "satisfaction", lib: "Satisfaction des clients", famille: "qualitatif", type: "taux", unite: "note", sens: "hausse", num: "Somme des notes (sur 10)", den: "Clients ayant répondu à l'enquête", def: "Note moyenne sur 10 donnée par les clients qui ont répondu à l'enquête de satisfaction du mois." }
  ];

  /* « moi » est l'étudiant ; les autres identifiants sont ceux de equipe.js (nb, tl, ca, kh). */
  var CONSEILLERS = [
    { id: "moi", clients: 140, absences: 1, poste: "En poste depuis huit mois", contexte: "Premier portefeuille en autonomie. Les appels sont passés surtout en fin de matinée." },
    { id: "nb", clients: 150, absences: 0, poste: "En poste depuis six ans", contexte: "Reçoit depuis septembre les clients qui contestent des frais, depuis la nouvelle tarification des incidents de paiement." },
    { id: "tl", clients: 120, absences: 9, poste: "En poste depuis quatre ans", contexte: "Absent neuf jours ouvrés ce mois-ci (congés et arrêt), sans que ses rendez-vous aient été repris par un collègue." },
    { id: "ca", clients: 130, absences: 2, poste: "En poste depuis trois ans", contexte: "A repris en septembre le portefeuille d'une conseillère partie : de nombreux clients n'ont plus été contactés depuis plus d'un an." },
    { id: "kh", clients: 140, absences: 1, poste: "En poste depuis sept ans", contexte: "Clientèle de professionnels : marché local dynamique et rendez-vous de bilan annuel bien suivis." }
  ];

  var D = {
    pnb: { moi: [6000, 5520, 5700, 5650], nb: [7000, 7560, 6900, 7300], tl: [13500, 10800, 13200, 13100], ca: [14000, 13500, 13500, 13900], kh: [12500, 12800, 12100, 12400] },
    credits: { moi: [120000, 95000, 150000, 105000], nb: [150000, 138000, 190000, 160000], tl: [300000, 195000, 360000, 310000], ca: [320000, 298000, 380000, 300000], kh: [200000, 224000, 190000, 205000] },
    contrats: { moi: [30, 24, 28, 27], nb: [32, 33, 30, 31], tl: [22, 17, 23, 23], ca: [24, 23, 25, 24], kh: [26, 30, 25, 27] },
    equipement: { moi: [3.2, 413, 140, 2.9, 2.97], nb: [3.3, 510, 150, 3.35, 3.38], tl: [4.2, 462, 120, 4.0, 3.9], ca: [4.2, 520, 130, 4.05, 4.02], kh: [4.3, 616, 140, 4.3, 4.35] },
    decroche: { moi: [60, 72, 160, 50, 47], nb: [60, 91, 140, 64, 65], tl: [60, 52, 80, 63, 65], ca: [60, 72, 120, 59, 60], kh: [60, 66, 110, 61, 60] },
    rdv: { moi: [30, 14, 72, 25, 24], nb: [30, 31, 91, 31, 32], tl: [30, 15, 52, 30, 29], ca: [30, 20, 72, 30, 29], kh: [30, 22, 66, 31, 32] },
    reclamation: { moi: [1, 1, 140, 1.2, 1.0], nb: [1, 4, 150, 0.8, 1.0], tl: [1, 1, 120, 1.0, 0.9], ca: [1, 1, 130, 0.9, 0.8], kh: [1, 1, 140, 0.7, 0.8] },
    distancies: { moi: [10, 14, 140, 11, 10], nb: [10, 12, 150, 9, 8], tl: [10, 11, 120, 10, 9], ca: [10, 26, 130, 18, 19], kh: [10, 13, 140, 9, 9] },
    revue3m: { moi: [90, 5, 8, 70, 72], nb: [90, 9, 10, 88, 90], tl: [90, 6, 7, 86, 83], ca: [90, 8, 9, 87, 89], kh: [90, 5, 5, 95, 100] },
    satisfaction: { moi: [8.0, 105, 14, 7.6, 7.8], nb: [8.0, 154, 20, 8.0, 8.0], tl: [8.0, 98, 12, 8.2, 8.1], ca: [8.0, 140, 18, 7.9, 7.8], kh: [8.0, 215, 25, 8.5, 8.6] }
  };

  /* Le contexte de marché, commun à l'agence. */
  var CONJONCTURE = "Les taux des crédits immobiliers restent élevés et les demandes baissent dans tout le secteur : dans l'exercice, la production de crédits de l'agence est inférieure d'un quart à celle du même mois de l'an dernier.";

  var api = { INDICATEURS: INDICATEURS, CONSEILLERS: CONSEILLERS, DONNEES: D, CONJONCTURE: CONJONCTURE };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.dataTableauBord = api; }
})(typeof window !== "undefined" ? window : null);
