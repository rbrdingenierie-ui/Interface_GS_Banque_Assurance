/* GS Banque & Assurance – dossiers « du jour » : professions, commerçants, bailleurs et autres libellés vraisemblables.
   Tout est inventé (enseignes et organismes imaginaires). */
(function (root) {
  "use strict";

  /* Professions : [masculin, féminin], statut, revenus mensuels nets (min, max), âges, libellé du crédit régulier, note sur les revenus. */
  var PROFESSIONS = [
    { k: "infirmier", m: "Infirmier (hôpital public)", f: "Infirmière (hôpital public)", st: "salarie", rev: [2000, 2500], age: [25, 55], cr: "Salaire", note: "salaire domicilié" },
    { k: "aide_soignant", m: "Aide-soignant (CDI)", f: "Aide-soignante (CDI)", st: "salarie", rev: [1650, 1950], age: [23, 58], cr: "Salaire", note: "salaire domicilié" },
    { k: "technicien", m: "Technicien de maintenance (CDI)", f: "Technicienne de maintenance (CDI)", st: "salarie", rev: [1900, 2500], age: [25, 58], cr: "Salaire", note: "salaire domicilié" },
    { k: "livreur_sal", m: "Chauffeur-livreur (salarié)", f: "Chauffeuse-livreuse (salariée)", st: "salarie", rev: [1700, 2100], age: [23, 58], cr: "Salaire", note: "salaire domicilié" },
    { k: "vendeur", m: "Vendeur (CDI)", f: "Vendeuse (CDI)", st: "salarie", rev: [1500, 1900], age: [21, 58], cr: "Salaire", note: "salaire domicilié" },
    { k: "employe_bureau", m: "Employé de bureau (CDI)", f: "Employée de bureau (CDI)", st: "salarie", rev: [1650, 2050], age: [24, 60], cr: "Salaire", note: "salaire domicilié" },
    { k: "accueil", m: "Agent d'accueil (CDI)", f: "Agente d'accueil (CDI)", st: "salarie", rev: [1500, 1800], age: [22, 60], cr: "Salaire", note: "salaire domicilié" },
    { k: "ouvrier_bat", m: "Ouvrier du bâtiment (CDI)", f: "Ouvrière du bâtiment (CDI)", st: "salarie", rev: [1700, 2200], age: [22, 58], cr: "Salaire", note: "salaire domicilié" },
    { k: "cadre_com", m: "Cadre commercial", f: "Cadre commerciale", st: "salarie", rev: [3000, 4200], age: [30, 58], cr: "Salaire", note: "salaire domicilié" },
    { k: "ingenieur", m: "Ingénieur", f: "Ingénieure", st: "salarie", rev: [3000, 4000], age: [27, 58], cr: "Salaire", note: "salaire domicilié" },
    { k: "prof_ecoles", m: "Professeur des écoles", f: "Professeure des écoles", st: "salarie", rev: [2000, 2600], age: [26, 60], cr: "Salaire", note: "salaire domicilié" },
    { k: "comptable", m: "Comptable (CDI)", f: "Comptable (CDI)", st: "salarie", rev: [2100, 2800], age: [26, 60], cr: "Salaire", note: "salaire domicilié" },
    { k: "cuisinier", m: "Cuisinier (CDI)", f: "Cuisinière (CDI)", st: "salarie", rev: [1700, 2100], age: [23, 56], cr: "Salaire", note: "salaire domicilié" },
    { k: "bus", m: "Conducteur de bus (CDI)", f: "Conductrice de bus (CDI)", st: "salarie", rev: [2000, 2400], age: [27, 60], cr: "Salaire", note: "salaire domicilié" },
    { k: "educateur", m: "Éducateur spécialisé", f: "Éducatrice spécialisée", st: "salarie", rev: [1800, 2200], age: [24, 58], cr: "Salaire", note: "salaire domicilié" },
    { k: "gardien", m: "Gardien d'immeuble", f: "Gardienne d'immeuble", st: "salarie", rev: [1500, 1800], age: [30, 62], cr: "Salaire", note: "salaire domicilié" },
    { k: "aide_dom", m: "Aide à domicile (temps partiel)", f: "Aide à domicile (temps partiel)", st: "salarie", rev: [1050, 1350], age: [28, 62], cr: "Salaire", note: "salaire domicilié" },
    { k: "entretien", m: "Agent d'entretien (temps partiel)", f: "Agente d'entretien (temps partiel)", st: "salarie", rev: [1000, 1300], age: [28, 62], cr: "Salaire", note: "salaire domicilié" },
    { k: "serveur", m: "Serveur (CDD)", f: "Serveuse (CDD)", st: "cdd", rev: [1150, 1450], age: [20, 40], cr: "Salaire", note: "salaire domicilié" },
    { k: "interim", m: "Intérimaire (missions régulières)", f: "Intérimaire (missions régulières)", st: "cdd", rev: [1300, 1700], age: [22, 50], cr: "Salaire", note: "salaires d'intérim, variables" },
    { k: "alternant", m: "Étudiant en alternance", f: "Étudiante en alternance", st: "alternance", rev: [900, 1250], age: [18, 25], cr: "Rémunération d'alternance", note: "rémunération d'alternance" },
    { k: "retraite_emp", m: "Retraité (ancien employé)", f: "Retraitée (ancienne employée)", st: "retraite", rev: [950, 1500], age: [63, 82], cr: "Pension de retraite", note: "pension de retraite" },
    { k: "retraite_ouv", m: "Retraité (ancien ouvrier)", f: "Retraitée (ancienne ouvrière)", st: "retraite", rev: [1050, 1700], age: [63, 82], cr: "Pension de retraite", note: "pension de retraite" },
    { k: "retraite_cadre", m: "Retraité (ancien cadre)", f: "Retraitée (ancienne cadre)", st: "retraite", rev: [2000, 2900], age: [63, 80], cr: "Pension de retraite", note: "pension de retraite" },
    { k: "chomage", m: "Demandeur d'emploi (ancien employé)", f: "Demandeuse d'emploi (ancienne employée)", st: "chomage", rev: [850, 1500], age: [27, 58], cr: "Allocation chômage", note: "allocation chômage" }
  ];

  var VILLES = ["Paris 1er", "Paris 2e", "Paris 3e", "Paris 4e", "Paris 5e", "Paris 6e", "Paris 7e", "Paris 8e", "Paris 9e", "Paris 10e", "Paris 11e", "Paris 12e", "Paris 13e", "Paris 14e", "Paris 15e", "Paris 16e", "Paris 17e", "Paris 18e", "Paris 19e", "Paris 20e"];
  var VILLES_PROCHES = ["Montreuil", "Vincennes", "Ivry-sur-Seine", "Saint-Denis", "Pantin", "Issy-les-Moulineaux", "Levallois-Perret", "Saint-Mandé"];

  /* Commerçants (paiements par carte) : [libellé, avec ville ?] */
  var CARTE_GROS = ["Supermarché Marché Plus", "Hypermarché Grand Marché", "Supermarché Frais & Co", "Primeur & Cie", "Marché Bio du Centre", "Hyper Express"];
  var CARTE_MOYEN = ["Station Relais Nord – carburant", "Station Relais Est – carburant", "Station Voltaire – carburant", "Pharmacie du Centre", "Pharmacie Centrale", "Restaurant Chez Mamie", "Brasserie du Coin", "Boutique Mode & Co", "Librairie Le Passage", "Magasin de sport Sportifs", "Droguerie du Centre", "Boucherie Martin & Fils", "Le Bistrot Lyonnais", "Jardinerie du Parc"];
  var CARTE_PETIT = ["Boulangerie du Marché", "Boulangerie Les Délices", "Café de la Gare", "Presse & Tabac du Coin", "Parking du Centre-ville", "Pâtisserie du Marché", "Kiosque à journaux", "Fleuriste Rose & Lys"];

  /* Achats importants par carte (250 € et plus) */
  var CARTE_BIG = ["High-Tech Store", "Électroménager Plus", "Mobilier Maison & Co", "Voyages Horizon – séjour", "Garage Moderne – réparation", "Centre Auto Pneus", "Bijouterie du Centre", "Bricol'Express – travaux", "Cycles & Mobilité"];

  /* Bailleurs et autres prélèvements : [libellé, préfixe de mandat, montant min, max] */
  var PRELEV_LOYER = [["Immobilière du Parc – loyer", "IP"], ["Résidence Les Lilas – loyer", "RL"], ["Immobilière du Marais – loyer", "IM"], ["Foncière Paris Est – loyer", "FE"], ["Habitat Capitale – loyer", "HC"], ["Gestion Locative Nation – loyer", "GN"], ["Agence du Faubourg – loyer", "AF"]];
  var PRELEV_ENERGIE = [["Électricité Verte – facture", "EV", 45, 140], ["Énergie Citoyenne – électricité", "EC", 40, 130], ["Gaz de Ville – facture", "GV", 35, 120]];
  var PRELEV_TEL = [["Mobilis – forfait", "MB", 12, 35], ["TELCOM+ – forfait mobile", "TC", 20, 60], ["Fibra – box internet", "FB", 25, 45], ["Opérateur mobile", "OM", 10, 30]];
  var PRELEV_ASSUR = [["Assurances Solidaires – assurance auto", "AS", 35, 110], ["Assur'Horizon – assurance habitation", "AH", 12, 40], ["Mutuelle Santé Plus", "MS", 28, 90], ["Prévoyance Famille – cotisation", "PF", 15, 45]];
  var PRELEV_DIVERS = [["Salle de sport Énergie – abonnement", "SE", 19.9, 39.9], ["Presse & Co – abonnement", "PC", 9.9, 24.9], ["Abonnement streaming", "AS", 7.99, 17.99], ["Cantine scolaire – régie", "CS", 25, 120], ["Crèche Les Petits Pas – participation", "CP", 60, 240], ["Association de quartier – cotisation", "AQ", 10, 30]];
  var PRELEV_CREDIT = [["Conso Crédit – mensualité", "CC", 90, 260], ["FINACRED – mensualité de crédit", "FC", 120, 380], ["Crédit Auto Sud – mensualité", "CA", 150, 340]];

  /* Chèques : [bénéficiaire, montant min, max] */
  var CHEQUE_COURANT = [["Auto-école Horizon – leçons", 100, 650], ["Garage Occitan – réparation", 90, 650], ["Garage Moderne – révision", 80, 420], ["Cantine scolaire – règlement", 30, 150], ["Association sportive – cotisation", 40, 150], ["Opticien du Centre – lunettes", 80, 420], ["Mairie – régie de recettes", 20, 220], ["Crèche Les Petits Pas – règlement", 80, 380], ["Artisan peintre – acompte", 150, 900], ["Dépannage plomberie Express", 90, 420], ["Syndic de copropriété – charges", 120, 700], ["Cabinet médical – honoraires", 30, 110], ["Centre de loisirs municipal – séjour enfants", 60, 280], ["Club de gym Équilibre – cotisation annuelle", 120, 420], ["Boutique Mode & Co – règlement", 40, 220], ["École de musique – trimestre", 90, 320]];
  var CHEQUE_PETIT = [["Club de pétanque Les Boules d'Or – cotisation", 8, 15], ["Association Les Foulées – cotisation", 8, 15], ["Cantine municipale – régularisation", 8, 15], ["Coopérative scolaire – participation", 8, 15], ["Kermesse de l'école – tombola", 8, 15], ["Association de quartier – adhésion", 8, 15]];
  var CHEQUE_PROJET = [["Cuisines & Co – cuisine équipée (acompte)", 1800, 4200, "équipement de la cuisine"], ["Électroménager Plus – lave-linge et réfrigérateur", 900, 1800, "équipement de la maison en électroménager"], ["Salle de bains Concept – travaux", 1500, 3800, "rénovation de la salle de bains"], ["Literie Confort – chambre complète", 700, 1500, "achat de mobilier (chambre)"], ["Menuiserie du Faubourg – fenêtres", 1600, 4000, "remplacement des fenêtres"]];
  var CHEQUE_VEHICULE = [["Garage Auto Sud – véhicule d'occasion", 3500, 8500, "l'achat d'un véhicule d'occasion"], ["Concessionnaire Citadine – acompte véhicule", 2800, 6500, "l'acompte d'un véhicule neuf"], ["Moto Express – deux-roues", 2500, 5500, "l'achat d'un deux-roues"]];

  /* Commerçant vraisemblable pour le montant d'un paiement par carte (les gros montants vont aux achats importants, pas à la boulangerie). */
  function carteSelon(r, m, ville) {
    var pool = m < 30 ? CARTE_PETIT : m < 110 ? CARTE_MOYEN.concat(CARTE_PETIT.slice(0, 2)) : m < 260 ? CARTE_GROS.concat(CARTE_MOYEN.slice(0, 3), ["Boutique Mode & Co", "Magasin de sport Sportifs", "Jardinerie du Parc"]) : CARTE_BIG;
    var nom = r.pick(pool);
    if (!/carburant|Voyages|Garage|Centre Auto/.test(nom) && ville && m < 260) nom += " – " + ville;
    return nom;
  }

  var api = {
    carteSelon: carteSelon, PROFESSIONS: PROFESSIONS, VILLES: VILLES, VILLES_PROCHES: VILLES_PROCHES, CARTE_GROS: CARTE_GROS, CARTE_MOYEN: CARTE_MOYEN, CARTE_PETIT: CARTE_PETIT, CARTE_BIG: CARTE_BIG,
    PRELEV_LOYER: PRELEV_LOYER, PRELEV_ENERGIE: PRELEV_ENERGIE, PRELEV_TEL: PRELEV_TEL, PRELEV_ASSUR: PRELEV_ASSUR, PRELEV_DIVERS: PRELEV_DIVERS, PRELEV_CREDIT: PRELEV_CREDIT,
    CHEQUE_COURANT: CHEQUE_COURANT, CHEQUE_PETIT: CHEQUE_PETIT, CHEQUE_PROJET: CHEQUE_PROJET, CHEQUE_VEHICULE: CHEQUE_VEHICULE
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.quotidienPools = api; }
})(typeof window !== "undefined" ? window : null);
