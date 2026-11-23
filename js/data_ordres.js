/* GS Banque & Assurance – données de l'outil « Ordres de bourse » : 9 valeurs cotées et 12 demandes de clients.
   TOUT EST INVENTÉ : les sociétés, les fonds, les codes ISIN (non valides), les cours et les carnets d'ordres. Les clients, eux, sont ceux des dossiers du site (clients titulaires d'un PEA) : le solde du PEA
   (« solde ») et les espèces du PEA (« esp ») viennent de leur dossier ; les titres détenus ci-dessous sont à l'intérieur de ce solde (vérifié par les tests).
   Les cours et les carnets sont ceux de la séance du 17 novembre 2026 vers 15 h : un carnet donne, du meilleur prix au moins bon, [prix en euros, quantité de titres]. Le pas de cotation est de 0,01 € (convention de l'exercice).
   Valeur : { id, nom, isin, type ("action" ou "etf"), siege (pays du siège), capi (capitalisation au 1er décembre 2025, en millions d'euros), liquidite ("elevee", "moyenne", "faible"), cours (dernier cours),
              pea: { eligible, motif }, carnet: { achats[], ventes[] } }.
   Demande : { id, client (n° du dossier), recu (heure de réception), canal, citation (les mots du client), sens ("achat" ou "vente"), valeur, quantite (souhaitée), detient (titres de cette valeur déjà dans le PEA),
               cto (le client a-t-il un compte-titres ordinaire ?), consigne (ce que le client a exigé, voir ordres_bourse.js), explication }. */
(function (root) {
  "use strict";

  var VALEURS = [
    { id: "V1", nom: "Verrerie Saint-Ambroise", isin: "FRFICT000011", type: "action", siege: "FR", capi: 3200, liquidite: "elevee", cours: 12.34,
      pea: { eligible: true, motif: "Société dont le siège est en France." },
      carnet: { achats: [[12.34, 1200], [12.33, 2000], [12.32, 1800], [12.30, 2500], [12.28, 900]], ventes: [[12.35, 900], [12.36, 1500], [12.38, 2100], [12.40, 1800], [12.45, 2600]] } },
    { id: "V2", nom: "Thalassa Énergies", isin: "FRFICT000029", type: "action", siege: "FR", capi: 8700, liquidite: "elevee", cours: 48.20,
      pea: { eligible: true, motif: "Société dont le siège est en France." },
      carnet: { achats: [[48.20, 500], [48.18, 650], [48.15, 800], [48.10, 1200], [48.05, 900]], ventes: [[48.22, 350], [48.24, 420], [48.26, 700], [48.30, 900], [48.35, 1000]] } },
    { id: "V3", nom: "Atelier Lumière", isin: "FRFICT000037", type: "action", siege: "FR", capi: 280, liquidite: "faible", cours: 21.60,
      pea: { eligible: true, motif: "Société dont le siège est en France." },
      carnet: { achats: [[21.60, 10], [21.00, 30], [20.00, 25], [19.00, 40], [17.50, 50]], ventes: [[21.80, 15], [22.40, 25], [23.50, 20], [25.00, 40], [27.00, 60]] } },
    { id: "V4", nom: "Nordwind Maschinenbau AG", isin: "DEFICT000046", type: "action", siege: "DE", capi: 5400, liquidite: "elevee", cours: 64.10,
      pea: { eligible: true, motif: "Société dont le siège est en Allemagne, dans l'Union européenne." },
      carnet: { achats: [[64.10, 240], [64.08, 300], [64.05, 500], [64.00, 800], [63.90, 600]], ventes: [[64.12, 200], [64.15, 260], [64.20, 400], [64.30, 600], [64.40, 500]] } },
    { id: "V5", nom: "Pacific Rail Corporation", isin: "USFICT000053", type: "action", siege: "US", capi: 41000, liquidite: "elevee", cours: 88.40,
      pea: { eligible: false, motif: "Société dont le siège est aux États-Unis : le PEA n'accueille que des titres de sociétés ayant leur siège dans l'Union européenne ou dans l'Espace économique européen (Islande, Norvège, Liechtenstein)." },
      carnet: { achats: [[88.40, 900], [88.38, 1200]], ventes: [[88.42, 800], [88.45, 1500]] } },
    { id: "V6", nom: "Lumen Santé", isin: "FRFICT000062", type: "action", siege: "FR", capi: 1600, liquidite: "elevee", cours: 33.50,
      pea: { eligible: true, motif: "Société dont le siège est en France." },
      carnet: { achats: [[33.50, 150], [33.45, 200], [33.40, 260], [33.30, 300], [33.00, 500]], ventes: [[33.55, 120], [33.60, 180], [33.70, 250], [33.90, 300], [34.20, 400]] } },
    { id: "V7", nom: "Fonds indiciel GS Europe (ETF)", isin: "FRFICT000070", type: "etf", siege: "FR", capi: 0, liquidite: "elevee", cours: 41.80,
      pea: { eligible: true, motif: "Fonds coté investi à plus de 75 % en actions de sociétés de l'Union européenne ou de l'Espace économique européen." },
      carnet: { achats: [[41.80, 900], [41.78, 1600], [41.76, 2200], [41.74, 2500], [41.70, 3000]], ventes: [[41.82, 800], [41.84, 1500], [41.86, 2200], [41.88, 2600], [41.92, 3000]] } },
    { id: "V8", nom: "Brasserie Morel-Lacroix", isin: "FRFICT000088", type: "action", siege: "FR", capi: 640, liquidite: "moyenne", cours: 76.00,
      pea: { eligible: true, motif: "Société dont le siège est en France." },
      carnet: { achats: [[76.00, 35], [75.60, 60], [75.00, 50], [74.00, 40], [72.00, 80]], ventes: [[76.40, 40], [76.80, 60], [77.50, 50], [78.50, 40], [80.00, 80]] } }
  ];

  var DEMANDES = [
    { id: "OB-01", client: 20, recu: "09:10", canal: "agence", sens: "achat", valeur: "V1", quantite: 80, detient: 0, cto: false,
      citation: "Je voudrais acheter 80 actions Verrerie Saint-Ambroise sur mon PEA, mais je ne veux pas payer plus de 12,40 € l'action.",
      consigne: { quantiteExacte: true, prixMax: 12.40 },
      explication: "Le client fixe un prix maximum : seul un ordre qui porte une limite de prix le garantit (ordre à cours limité). Au marché ou à la meilleure limite, le prix n'est pas maîtrisé (AMF). La limite est un plafond : l'ordre s'exécute aux prix offerts dans le carnet, tant qu'ils ne dépassent pas 12,40 €. La taxe sur les transactions financières s'ajoute, car l'émetteur est une société française de plus d'un milliard d'euros de capitalisation." },
    { id: "OB-02", client: 37, recu: "09:42", canal: "agence", sens: "achat", valeur: "V1", quantite: 40, detient: 0, cto: false,
      citation: "J'aimerais acheter 40 actions Verrerie Saint-Ambroise sur mon PEA, dès que possible.",
      consigne: { immediat: true },
      explication: "Le compte espèces du PEA ne peut pas être débiteur : l'achat doit être couvert en totalité, courtage et taxe sur les transactions financières compris. Avec 350 € d'espèces, le client ne peut pas acheter 40 titres. On réduit la quantité au maximum couvert et on le dit au client, plutôt que de refuser la demande." },
    { id: "OB-03", client: 47, recu: "10:05", canal: "telephone", sens: "achat", valeur: "V3", quantite: 20, detient: 0, cto: false,
      citation: "Je veux 20 actions Atelier Lumière, au prix du marché, tout de suite.",
      consigne: { quantiteExacte: true, immediat: true },
      explication: "Atelier Lumière est peu liquide : le carnet est mince, l'écart entre l'offre et la demande est large. Un ordre au marché consommerait plusieurs niveaux de prix, donc paierait plus cher que le dernier cours (l'AMF prévient que l'ordre au marché n'offre aucune maîtrise du prix). GS refuse l'ordre au marché sur les valeurs peu liquides (convention de l'exercice) : on propose un ordre à cours limité, avec une limite réaliste." },
    { id: "OB-04", client: 90, recu: "10:30", canal: "agence", sens: "vente", valeur: "V2", quantite: 60, detient: 60, cto: false,
      citation: "J'ai 60 actions Thalassa Énergies. Si le cours passe sous 44 €, je veux tout vendre, pour limiter la casse.",
      consigne: { quantiteExacte: true, declenchement: 44 },
      explication: "Le client ne veut pas vendre maintenant : il veut une protection. C'est l'ordre à déclenchement (ordre « stop ») : la vente n'intervient que si le cours passe sous le seuil (AMF). Un ordre à cours limité de vente à 44 € serait exécuté aussitôt, au meilleur prix offert par les acheteurs (48,20 €), puisque le cours est bien au-dessus du seuil. À seuil de déclenchement, l'ordre devient un ordre au marché : le prix d'exécution n'est pas maîtrisé ; à plage de déclenchement, il devient un ordre à cours limité et peut ne pas être exécuté." },
    { id: "OB-05", client: 105, recu: "11:15", canal: "agence", sens: "vente", valeur: "V4", quantite: 150, detient: 150, cto: false,
      citation: "Je veux vendre mes 150 actions Nordwind, mais pas en dessous de 66 €, et je veux laisser l'ordre jusqu'à fin décembre.",
      consigne: { quantiteExacte: true, prixMin: 66, jusquau: "2026-12-31" },
      explication: "La limite de 66 € est au-dessus du cours : l'ordre ne sera pas exécuté aujourd'hui, il reste dans le carnet. Avec la validité « jour », il disparaîtrait ce soir : le client veut le maintenir jusqu'au 31 décembre, donc une validité à date déterminée (ou à révocation, valable 365 jours). L'ordre à cours limité garantit le prix minimum, mais pas l'exécution (AMF)." },
    { id: "OB-06", client: 116, recu: "11:40", canal: "messagerie", sens: "achat", valeur: "V7", quantite: 20, detient: 0, cto: false,
      citation: "Je voudrais acheter 20 parts du fonds indiciel GS Europe, sur mon PEA.",
      consigne: { quantiteExacte: true },
      explication: "Un fonds coté (ETF) investi à plus de 75 % en actions européennes est éligible au PEA. La taxe sur les transactions financières ne le concerne pas : elle vise des actions de sociétés, et il s'agit ici de parts de fonds (convention de l'exercice). La couverture est serrée : le courtage compte. Sur une valeur très liquide, l'ordre à la meilleure limite ou un ordre à cours limité convient." },
    { id: "OB-07", client: 285, recu: "13:20", canal: "agence", sens: "vente", valeur: "V6", quantite: 200, detient: 150, cto: false,
      citation: "Vendez-moi 200 actions Lumen Santé, s'il vous plaît.",
      consigne: {},
      explication: "Le client ne détient que 150 titres : on ne peut pas en vendre 200. Dans un PEA, la vente à découvert et le service à règlement différé (SRD) ne sont pas possibles (AMF). On transmet un ordre pour 150 titres au plus et on prévient le client." },
    { id: "OB-08", client: 398, recu: "13:50", canal: "agence", sens: "achat", valeur: "V5", quantite: 30, detient: 0, cto: false,
      citation: "Je veux acheter 30 actions Pacific Rail Corporation, sur mon PEA.",
      consigne: {},
      explication: "Pacific Rail est une société américaine : ses actions ne sont pas éligibles au PEA, réservé aux titres de sociétés de l'Union européenne ou de l'Espace économique européen. Le client n'a pas de compte-titres ordinaire : l'ordre ne peut pas être transmis. On ne laisse pas le client sans réponse : on lui propose d'ouvrir un compte-titres ordinaire (convention, questionnaire de connaissance et d'expérience) ou un titre éligible." },
    { id: "OB-09", client: 507, recu: "14:10", canal: "telephone", sens: "achat", valeur: "V2", quantite: 400, detient: 0, cto: false,
      citation: "Je souhaite acheter 400 actions Thalassa Énergies sur mon PEA, sans dépasser 48,50 €.",
      consigne: { quantiteExacte: true, prixMax: 48.50 },
      explication: "Ordre important mais couvert : le calcul de couverture inclut le courtage et la taxe sur les transactions financières, due ici car Thalassa Énergies est une société française de plus d'un milliard d'euros de capitalisation. Le carnet est profond : l'ordre à cours limité à 48,50 € est exécuté en totalité, au meilleur prix offert puis au suivant." },
    { id: "OB-10", client: 555, recu: "14:25", canal: "agence", sens: "achat", valeur: "V8", quantite: 50, detient: 0, cto: false,
      citation: "Je veux acheter 50 actions Brasserie Morel-Lacroix, sans dépasser 77 € l'action.",
      consigne: { quantiteExacte: true, prixMax: 77 },
      explication: "Le carnet est peu profond : les 50 titres sont servis sur deux niveaux de prix (76,40 € puis 76,80 €), tous deux sous la limite. L'émetteur, une société française, est sous le seuil d'un milliard d'euros de capitalisation : pas de taxe sur les transactions financières." },
    { id: "OB-11", client: 532, recu: "14:40", canal: "agence", sens: "achat", valeur: "V6", quantite: 100, detient: 0, cto: false,
      citation: "Si Lumen Santé monte au-dessus de 34 €, je veux en acheter 100, mais sans payer plus de 34,50 €.",
      consigne: { quantiteExacte: true, prixMax: 34.50, declenchement: 34 },
      explication: "Le client veut déclencher l'achat à 34 € et maîtriser le prix : c'est l'ordre à plage de déclenchement. Le seuil (34 €) est le prix qui déclenche l'ordre ; la limite (34,50 €) est le prix maximum payé une fois l'ordre déclenché. Un ordre à seuil de déclenchement deviendrait un ordre au marché : le prix ne serait plus maîtrisé (AMF)." },
    { id: "OB-12", client: 33, recu: "14:55", canal: "agence", sens: "vente", valeur: "V1", quantite: 90, detient: 90, cto: false,
      citation: "Je veux vendre mes 90 actions Verrerie Saint-Ambroise rapidement, au mieux.",
      consigne: { quantiteExacte: true, immediat: true },
      explication: "Le client veut vendre vite sur une valeur très liquide : un ordre au marché ou à la meilleure limite est adapté, au prix de ne pas maîtriser le prix. À la vente, la taxe sur les transactions financières ne s'applique pas : elle frappe l'acquisition. Le produit de la vente n'est disponible qu'au règlement-livraison, au plus tard deux jours de négociation après l'exécution." }
  ];

  var api = { VALEURS: VALEURS, DEMANDES: DEMANDES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.dataOrdres = api; }
})(typeof window !== "undefined" ? window : null);
