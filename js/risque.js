/* GS Banque & Assurance – échelle de risque des produits d'investissement : UNE SEULE SOURCE pour la fiche du catalogue, le document d'informations clés (DICI) et le rapport de conseil MIFID.
   Le niveau de risque est une caractéristique du PRODUIT (ou du support) : il se calcule à partir de sa composition (part de fonds en euros, d'obligations, d'actions…) et ne dépend jamais
   des réponses du client au questionnaire. Le questionnaire donne le profil du client ; le conseil compare ensuite le profil du client au niveau de risque du support.

   Indicateur synthétique de risque (SRI, échelle de 1 à 7) : méthode simplifiée de l'exercice, fondée sur les classes de risque de marché du règlement délégué (UE) 2017/653 (volatilité annualisée
   du produit : moins de 0,5 % classe 1 ; 0,5 à 5 % classe 2 ; 5 à 12 % classe 3 ; 12 à 20 % classe 4 ; 20 à 30 % classe 5 ; 30 à 80 % classe 6 ; plus de 80 % classe 7).
   La volatilité de chaque classe d'actifs est une hypothèse de l'exercice (ordre de grandeur des marchés) ; la volatilité d'une composition est la somme pondérée (corrélation prudente de 1).
   Les scénarios de performance et les coûts du DICI sont calculés avec les mêmes paramètres : tout est cohérent, rien n'est saisi à la main. */
(function (root) {
  "use strict";

  /* Classes d'actifs : volatilité annualisée en %, rendements annuels des scénarios (avant frais du contrat) à 1 an et sur la durée recommandée. */
  var CLASSES = {
    EURO:    { lib: "Fonds en euros",                                   vol: 0.3,  garanti: true,  s1: [0.0, 0.5, 2.0, 3.0],    sh: [0.0, 0.8, 2.4, 3.0] },
    MONET:   { lib: "Fonds monétaires",                                 vol: 0.3,  garanti: false, s1: [-0.3, 0.0, 1.8, 2.8],   sh: [-0.1, 0.5, 1.9, 2.6] },
    PARTS:   { lib: "Parts sociales",                                   vol: 0.3,  garanti: false, s1: [-1.0, 0.0, 2.0, 2.8],   sh: [-0.5, 0.2, 2.0, 2.8] },
    OBLIG:   { lib: "Obligations",                                      vol: 4.0,  garanti: false, s1: [-6.0, -2.0, 2.5, 5.0],  sh: [-2.0, 0.5, 2.8, 4.5] },
    ACT:     { lib: "Actions",                                          vol: 18.0, garanti: false, s1: [-32.0, -12.0, 5.0, 22.0], sh: [-9.0, -1.0, 5.5, 11.0] },
    ACTEM:   { lib: "Actions de petites capitalisations ou de pays émergents", vol: 24.0, garanti: false, s1: [-40.0, -15.0, 6.0, 28.0], sh: [-12.0, -2.0, 6.0, 13.0] },
    NONCOTE: { lib: "Actifs non cotés",                                 vol: 25.0, garanti: false, s1: [-30.0, -10.0, 5.0, 18.0], sh: [-8.0, 0.0, 6.5, 11.0] },
    LEVIER:  { lib: "Instruments à effet de levier",                    vol: 40.0, garanti: false, s1: [-60.0, -25.0, 5.0, 40.0], sh: [-20.0, -5.0, 6.0, 18.0] }
  };
  var SEUILS = [0.5, 5, 12, 20, 30, 80];   /* bornes des classes 1 à 7 (volatilité en %) */
  var SCENARIOS = ["Scénario de tensions", "Scénario défavorable", "Scénario intermédiaire", "Scénario favorable"];

  function arr(x) { return Math.round(x * 100) / 100; }
  /* Normalise une composition { CLASSE: pourcentage } : la somme doit faire 100. */
  function total(compo) { var t = 0; Object.keys(compo).forEach(function (k) { t += compo[k]; }); return t; }
  function valide(compo) {
    var ok = Math.abs(total(compo) - 100) < 1e-9;
    Object.keys(compo).forEach(function (k) { if (!CLASSES[k] || !(compo[k] >= 0)) ok = false; });
    return ok;
  }
  /* Volatilité annualisée (%) d'une composition. */
  function volatilite(compo) { var v = 0; Object.keys(compo).forEach(function (k) { v += compo[k] / 100 * CLASSES[k].vol; }); return arr(v); }
  /* Indicateur synthétique de risque, de 1 à 7. */
  function sri(compo) {
    var v = volatilite(compo), c = 1;
    for (var i = 0; i < SEUILS.length; i++) { if (v >= SEUILS[i]) c = i + 2; }
    return c;
  }
  /* Part de la composition qui n'est pas en fonds en euros (« part d'unités de compte »), en %. */
  function partUC(compo) { return arr(100 - (compo.EURO || 0)); }
  /* Le capital est-il intégralement garanti (net de frais) ? Seulement un fonds en euros à 100 %. */
  function capitalGaranti(compo) { return (compo.EURO || 0) >= 100; }

  /* Échelle de conseil de l'exercice (rapport MIFID), à 4 niveaux : chaque niveau regroupe des classes de l'indicateur de 1 à 7.
     1 très faible (SRI 1) ; 2 modéré (SRI 2 et 3) ; 3 élevé (SRI 4 et 5) ; 4 très élevé (SRI 6 et 7). */
  var NIVEAU_PAR_SRI = [0, 1, 2, 2, 3, 3, 4, 4];
  var NOMS_NIVEAU = ["", "Très faible", "Modéré", "Élevé", "Très élevé"];
  function niveau(s) { return NIVEAU_PAR_SRI[s]; }

  /* Libellés de l'indicateur, dans les termes des documents d'informations clés. */
  var CLASSE_LIB = ["", "la classe de risque la plus basse", "une classe de risque basse", "une classe de risque moyenne-basse", "une classe de risque moyenne", "une classe de risque moyenne-élevée", "une classe de risque élevée", "la classe de risque la plus élevée"];
  var PERTES_LIB = ["", "très faible", "faible", "moyen-bas", "moyen", "moyen-élevé", "élevé", "très élevé"];
  /* Texte d'un indicateur (une classe ou une plage min-max). */
  function texteIndicateur(min, max) {
    if (min === max) return "Nous avons classé ce produit dans la classe de risque " + min + " sur 7, qui est " + CLASSE_LIB[min] + ". Autrement dit, les pertes potentielles liées aux futurs résultats du produit se situent à un niveau " + PERTES_LIB[min] + ".";
    return "Nous avons classé ce produit dans la classe de risque de " + min + " à " + max + " sur 7, qui est une échelle allant de " + CLASSE_LIB[min] + " à " + CLASSE_LIB[max] + ". Autrement dit, les pertes potentielles liées aux futurs résultats du produit se situent d'un niveau " + PERTES_LIB[min] + " à un niveau " + PERTES_LIB[max] + ".";
  }
  /* Libellé court pour la fiche du catalogue : « 3 sur 7 » ou « De 1 à 4 sur 7 selon les supports ». */
  function libelleFiche(min, max, selon) { return min === max ? min + " sur 7" : "De " + min + " à " + max + " sur 7" + (selon ? " " + selon : ""); }

  /* ---------- scénarios de performance et coûts (pour 10 000 € investis) ---------- */
  /* params : { entree % (sur le versement), gestionEuro %, gestionUC %, transaction % (sur la part hors fonds en euros), mandat % par an (mandat de gestion pilotée, sur l'ensemble), duree (années) } */
  function fraisAnnuels(compo, p) {
    var e = (compo.EURO || 0) / 100, u = 1 - e;
    return { gestion: arr(e * (p.gestionEuro || 0) + u * (p.gestionUC || 0)), transaction: arr(u * (p.transaction || 0)), mandat: arr(p.mandat || 0) };
  }
  /* Rendement annuel brut d'un scénario (i = 0 à 3) à l'horizon « h » (0 : un an ; 1 : durée recommandée). */
  function rendementScenario(compo, i, h) {
    var r = 0; Object.keys(compo).forEach(function (k) { r += compo[k] / 100 * CLASSES[k][h ? "sh" : "s1"][i]; });
    return r;
  }
  function scenarios(compo, p, montant) {
    montant = montant || 10000;
    var f = fraisAnnuels(compo, p), uc = partUC(compo) / 100, H = p.duree || 5, out = [];
    SCENARIOS.forEach(function (nom, i) {
      /* rendement annuel du portefeuille moins les frais de gestion et de transaction (ceux du fonds en euros sont déjà inclus dans son taux net) */
      var apresEntree = montant * (1 - (p.entree || 0) / 100);
      var fUC = uc * ((p.gestionUC || 0) + (p.transaction || 0));
      var net1 = apresEntree * (1 + (rendementScenario(compo, i, 0) - fUC) / 100);
      var netH = apresEntree * Math.pow(Math.max(1 + (rendementScenario(compo, i, 1) - fUC) / 100, 0), H);
      /* le capital placé en fonds en euros est garanti net de frais : plancher = part garantie du capital investi après frais d'entrée */
      var plancher = apresEntree * (compo.EURO || 0) / 100;
      net1 = Math.max(net1, plancher); netH = Math.max(netH, plancher);
      /* frais du mandat de gestion pilotée : prélevés chaque année sur l'ensemble de l'épargne gérée, y compris la part en fonds en euros */
      net1 = net1 * (1 - f.mandat / 100); netH = netH * Math.pow(1 - f.mandat / 100, H);
      out.push({ nom: nom, un: { montant: Math.round(net1), rendement: arr((net1 / montant - 1) * 100) }, duree: { montant: Math.round(netH), rendement: arr((Math.pow(Math.max(netH, 1e-9) / montant, 1 / H) - 1) * 100) } });
    });
    return out;
  }
  /* Coûts au fil du temps : coûts totaux en euros et incidence annuelle (réduction du rendement), si l'on sort après un an ou à la fin de la durée recommandée. */
  function couts(compo, p, montant) {
    montant = montant || 10000;
    var f = fraisAnnuels(compo, p), H = p.duree || 5, entree = montant * (p.entree || 0) / 100, sortie = montant * (p.sortie || 0) / 100;
    var annuel = montant * (f.gestion + f.transaction + f.mandat) / 100;
    var un = entree + annuel + sortie, hh = entree + annuel * H + sortie;
    return { un: { total: Math.round(un), incidence: arr(un / montant * 100) }, duree: { total: Math.round(hh), incidence: arr(hh / montant * 100 / H) },
      composition: { entree: arr((p.entree || 0) / H), sortie: arr(p.sortie || 0 ? p.sortie / H : 0), transaction: f.transaction, gestion: f.gestion, mandat: f.mandat } };
  }

  var api = { CLASSES: CLASSES, SEUILS: SEUILS, SCENARIOS: SCENARIOS, NIVEAU_PAR_SRI: NIVEAU_PAR_SRI, NOMS_NIVEAU: NOMS_NIVEAU, valide: valide, total: total, volatilite: volatilite, sri: sri, partUC: partUC, capitalGaranti: capitalGaranti,
    niveau: niveau, texteIndicateur: texteIndicateur, libelleFiche: libelleFiche, CLASSE_LIB: CLASSE_LIB, PERTES_LIB: PERTES_LIB, fraisAnnuels: fraisAnnuels, scenarios: scenarios, couts: couts };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.risque = api; }
})(typeof window !== "undefined" ? window : null);
