/* GS Banque & Assurance – opérations de service : ce que l'on fait pour un client à l'accueil, hors vente.
   Quinze opérations, chacune avec ses contrôles, son document à faire signer par le client et ses effets sur le compte :
     virements (interne, Europe SEPA, international), retrait d'espèces avec une carte de retrait rechargée, rejet d'un prélèvement après son débit, opposition sur une carte,
     contestation d'opérations par carte (kit de contestation), opposition sur un chèque ou un chéquier, augmentation du plafond d'une carte, montée en gamme d'une carte, chèque de banque, commande de chéquier, achat et vente de devises (billets).
   Toute opération faite à l'accueil commence par la vérification d'identité du client (pièce officielle en cours de validité, photographie, signature). Une carte n'est jamais remise depuis un stock : elle est commandée, puis retirée
   à l'agence ou envoyée à domicile (avec frais). Un chéquier se remet de trois façons : tout de suite depuis le stock de chéquiers de dépannage de l'agence, en main propre après commande, ou par envoi à domicile (avec frais).
   Une opération suit toujours le même parcours : préparée par l'élève (statut « à signer », document généré) → signée par le client → exécutée (le compte et les cartes changent) ; ou annulée.
   Ce module est pur (aucun accès à la page) : formulaire(), controler(), creer(), executer(), annuler(), revoquer() travaillent sur la sauvegarde st.operations.
   Les mouvements d'une opération exécutée sont ajoutés au relevé du client par mouvements.js. Le document imprimable est fabriqué par documents_service.js.
   Règles réelles reprises : IBAN (clé modulo 97, longueur par pays), vérification du bénéficiaire (VoP) avant un virement SEPA, droit au remboursement d'un prélèvement SEPA (8 semaines s'il est autorisé,
   13 mois s'il ne l'est pas), motifs d'opposition à un chèque (article L131-35 du Code monétaire et financier), opposition à une carte (perte, vol, détournement), contestation des opérations par carte que le client n'a pas faites (articles L133-18 à L133-24 du Code monétaire
   et financier : remboursement immédiat, franchise de 50 € avant l'opposition en cas de perte ou de vol seulement, 13 mois pour contester),
   consultation du fichier central des chèques avant de remettre un chéquier, vigilance sur les retraits d'espèces (déclaration systématique à Tracfin au-delà de 10 000 € par mois),
   clôture du compte et des épargnes (vérifications avant clôture, versement du solde par virement ou chèque de banque, attestation de clôture remise au client).
   Les tarifs, plafonds et seuils propres à la banque (TARIFS, PLAFONDS_CARTE, SEUILS) sont inventés : ils figurent dans le rapport de livraison. */
(function (root) {
  "use strict";

  var R = root && root.SGBF ? root.SGBF : null;
  function mod(nom, fichier) { return R && R[nom] ? R[nom] : require("./" + fichier); }
  var B = mod("banque", "banque.js"), PR = mod("produits", "produits.js"), M = mod("mouvements", "mouvements.js"), RIB = mod("rib", "rib.js"), K = mod("catalogue", "catalogue.js");
  var CL = R && R.clients ? R.clients : require("./data_clients.js").clients;

  /* ---------- paramètres de la banque (inventés) ---------- */
  var TARIFS = {
    virementInterne: 0, virementSepa: 3.5, virementInstantane: 0.9,
    intlTaux: 0.001, intlMin: 15, intlMax: 100, intlSwift: 12, intlOur: 25,
    chequeBanque: (PR.tarifsUnitaires && PR.tarifsUnitaires.cheque && PR.tarifsUnitaires.cheque.an) || 25,   /* commission d'un chèque de banque : 25 € (sauf s'il est financé par un prêt de la banque ; compris dans la convention ou l'offre clientèle fragile selon le quota) */
    chequierEnvoi: K.FRAIS_ENVOI.chequier, oppositionCheque: 15, refabricationCarte: 12,
    carteEnvoi: K.FRAIS_ENVOI.carte,                          /* envoi à domicile d'une carte, en recommandé (le code confidentiel part par un courrier séparé) */
    changeCommission: 3, changeEnvoi: 15,   /* change de billets : commission fixe par opération ; envoi sécurisé à domicile (valeur déclarée) */
    margeBillets: 0.03                      /* marge de la banque sur le cours de la newsletter, pour les billets (achat comme vente) */
  };
  var SEUILS = {
    justificatif: 10000,        /* au-delà : justificatif de l'opération (vigilance LCB-FT de la banque) */
    directeur: 50000,           /* au-delà : accord de la directrice d'agence */
    instantaneMax: 100000,      /* plafond d'un virement instantané */
    differeMois: 12,            /* date d'exécution d'un virement différé : 12 mois au plus */
    retraitJour: 1000,          /* retrait avec la carte de retrait rechargée : 1 000 € par jour */
    retraitMin: 20,
    tracfinMois: 10000,         /* retraits d'espèces cumulés sur un mois : déclaration systématique à Tracfin */
    balancePaiements: 50000,    /* virement vers l'étranger : déclaration de balance des paiements */
    chequeBanqueMax: 500000,
    chequierDelaiJours: 30,     /* pas de nouveau chéquier dans les 30 jours */
    devisesStockMax: 1500,      /* billets remis tout de suite depuis le stock de l'agence : 1 500 € au plus (dollar, livre sterling, franc suisse) */
    devisesJustif: 5000,        /* achat de billets : justificatif du voyage au-delà de 5 000 € */
    devisesMax: 15000,          /* achat de billets : 15 000 € au plus par opération */
    douane: 10000,              /* sortir de l'Union européenne avec 10 000 € ou plus en espèces : déclaration à la douane (règlement (UE) 2018/1672) */
    devisesVenteJustif: 3000,   /* vente de billets à la banque : justificatif de l'origine des fonds au-delà de 3 000 € */
    devisesVenteMax: 10000      /* vente de billets : accord de la directrice au-delà de 10 000 € */
  };
  /* Stock de l'agence (inventé) : chéquiers de dépannage seulement. Toutes les cartes sont fabriquées sur commande. */
  var STOCK = K.STOCK;            /* stock de l'agence : défini dans catalogue.js (les ventes de cartes du catalogue et les ouvertures de compte le décomptent aussi) */
  var CHEQUIER_STOCK_NB = K.CHEQUIER_STOCK_NB;      /* un chéquier de dépannage compte 10 formules */
  var DELAI_CARTE = { agence: 7, domicile: 9 };     /* jours ouvrés (borne haute du délai annoncé : « 5 à 7 » pour un retrait à l'agence, « 7 à 9 » pour un envoi à domicile) */
  /* Date atteinte après n jours ouvrés (lundi au vendredi hors jours fériés) : le jour de la commande ne compte pas. */
  function plusOuvres(d, n) { var x = d; while (n > 0) { x = B.plusJours(x, 1); if (B.estOuvre(x)) n--; } return x; }
  /* Plafonds standards des cartes : paiement par 30 jours, retrait par 7 jours. Ils reprennent le texte des fiches produits (produits.js) ; un test le vérifie. */
  var PLAFONDS_CARTE = { VJEU: { pai: 1000, ret: 300 }, VCLA: { pai: 2500, ret: 500 }, VPRE: { pai: 6000, ret: 1000 }, PLAT: { pai: 8000, ret: 2000 }, WELI: { pai: 20000, ret: 3000 }, VELE: { pai: 1000, ret: 500 }, CRET: { pai: 0, ret: 500 } };
  var GAMME = ["VJEU", "VCLA", "VPRE", "PLAT", "WELI"];
  var COEF = { temporaire: 2, permanent: 1.5 };      /* relèvement possible : jusqu'à 2 fois le plafond standard pour 30 jours, 1,5 fois en permanence */
  var DUREE_TEMP_MAX = 30;

  /* ---------- outils ---------- */
  function txt(v) { return String(v == null ? "" : v).replace(/\s+/g, " ").trim(); }
  function r2(x) { return Math.round(x * 100) / 100; }
  function lireM(v) {
    var t = String(v == null ? "" : v).replace(/[\s ]/g, "").replace(",", ".");
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return NaN;
    return Math.round(parseFloat(t) * 100) / 100;
  }
  function lireCours(v) {
    var t = String(v == null ? "" : v).replace(/[\s ]/g, "").replace(",", ".");
    if (!/^\d+(\.\d{1,6})?$/.test(t)) return NaN;
    return parseFloat(t);
  }
  function norm(s) { return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").replace(/\s+/g, " ").trim(); }
  function eur(x) { return B.eur2(x); }
  function sansEspaces(s) { return String(s == null ? "" : s).replace(/[\s ]/g, "").toUpperCase(); }
  function empreinte(t) { var h = 7, i; t = String(t); for (i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 1000003; return h; }
  function pl(n, s, p) { return n + " " + (n > 1 ? p : s); }
  function dateOp() { return B.ouvrePrecedent(B.aujourdhui()); }      /* jour ouvré de l'opération (la veille ouvrée un week-end ou un jour férié) */
  function lireDate(v) { var s = txt(v); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? B.lireYmd(s) : null; }
  function nomCourtProduit(pid) { return PR.parId[pid] ? PR.parId[pid].nom : pid; }
  function cotisationCarte(pid) {
    var p = PR.parId[pid], t = p && p.tarifs ? p.tarifs.filter(function (x) { return /cotisation/i.test(x.lib); })[0] : null;
    var m = t ? /(\d+(?:[.,]\d+)?)/.exec(t.val) : null;
    return m ? parseFloat(m[1].replace(",", ".")) : 0;
  }

  /* ---------- les opérations ---------- */
  var GROUPES = [
    { id: "virements", lib: "Virements" },
    { id: "cartes", lib: "Cartes" },
    { id: "cheques", lib: "Chèques" },
    { id: "devises", lib: "Change de devises (billets)" },
    { id: "autres", lib: "Prélèvements et espèces" },
    { id: "compte", lib: "Clôture et désolidarisation du compte" }
  ];
  var TYPES = [
    { id: "virement_interne", groupe: "virements", lib: "Virement interne", court: "Interne", doc: "Ordre de virement interne",
      aide: "Vers un compte d'épargne du client ou vers le compte d'un autre client de GS Banque & Assurance. Gratuit, exécuté tout de suite." },
    { id: "virement_sepa", groupe: "virements", lib: "Virement en Europe (SEPA)", court: "Europe", doc: "Ordre de virement SEPA",
      aide: "Virement en euros vers un IBAN de la zone SEPA. Vérification du bénéficiaire obligatoire ; standard, instantané ou différé." },
    { id: "virement_intl", groupe: "virements", lib: "Virement international", court: "International", doc: "Ordre de virement international",
      aide: "Virement hors zone SEPA, ou dans une devise autre que l'euro. BIC obligatoire, cours de change de la newsletter, frais partagés ou à la charge du client." },
    { id: "opposition_carte", groupe: "cartes", lib: "Opposition sur une carte", court: "Opposition carte", doc: "Demande d'opposition sur carte bancaire",
      aide: "Perte, vol, utilisation frauduleuse ou utilisation abusive (cette dernière entraîne l'inscription du titulaire au fichier central des chèques, FCC, pendant 2 ans). La carte est bloquée tout de suite ; une nouvelle carte peut être commandée. Les paiements que le client ne reconnaît pas se contestent à part (contestation d'opérations par carte)." },
    { id: "contestation_carte", groupe: "cartes", lib: "Contestation d'opérations par carte", court: "Contestation CB", doc: "Kit de contestation d'opérations par carte bancaire",
      aide: "Le client ne reconnaît pas des paiements ou des retraits faits avec sa carte (carte perdue ou volée, ou fraude avec la carte en sa possession). Kit à faire signer ; les opérations contestées sont remboursées tout de suite. Distincte de l'opposition, mais liée à elle." },
    { id: "plafond_carte", groupe: "cartes", lib: "Augmentation du plafond d'une carte", court: "Plafond carte", doc: "Demande de relèvement du plafond de carte",
      aide: "Relèvement temporaire (30 jours au plus) ou permanent des plafonds de paiement et de retrait." },
    { id: "montee_gamme", groupe: "cartes", lib: "Montée en gamme d'une carte", court: "Montée en gamme", doc: "Demande de changement de carte vers une gamme supérieure",
      aide: "Le client passe à une carte de gamme supérieure. Son éligibilité est contrôlée ; la nouvelle carte compte comme une souscription." },
    { id: "cheque_banque", groupe: "cheques", lib: "Chèque de banque", court: "Chèque de banque", doc: "Demande de chèque de banque",
      aide: "Le compte du client est débité tout de suite du montant et de la commission ; le chèque est remis au client." },
    { id: "commande_chequier", groupe: "cheques", lib: "Commande de chéquier", court: "Chéquier", doc: "Demande de chéquier",
      aide: "Consultation du fichier central des chèques obligatoire avant la remise. Chéquier de dépannage remis tout de suite (stock), retrait en main propre sur commande, ou envoi à domicile avec frais." },
    { id: "opposition_cheque", groupe: "cheques", lib: "Opposition sur un chèque ou un chéquier", court: "Opposition chèque", doc: "Opposition au paiement d'un chèque ou d'un chéquier",
      aide: "Seulement dans les cas permis par la loi : perte, vol, utilisation frauduleuse, procédure collective du bénéficiaire." },
    { id: "rejet_prelevement", groupe: "autres", lib: "Rejet d'un prélèvement après son débit", court: "Rejet prélèvement", doc: "Demande de remboursement d'un prélèvement SEPA",
      aide: "Prélèvement autorisé : 8 semaines pour le contester. Prélèvement non autorisé : 13 mois. Le compte est recrédité tout de suite." },
    { id: "retrait_espece", groupe: "autres", lib: "Retrait d'espèces avec une carte rechargée", court: "Retrait espèces", doc: "Reçu de remise d'une carte de retrait rechargée",
      aide: "Le compte est débité ; la carte de retrait de l'agence est rechargée du montant, que le client retire au distributeur." },
    { id: "achat_devises", groupe: "devises", lib: "Achat de devises (billets)", court: "Achat devises", doc: "Bordereau d'achat de devises étrangères",
      aide: "Le client achète des billets en devises pour un voyage. Cours de la newsletter, marge et commission de la banque ; remise tout de suite (dollar, livre, franc suisse), en main propre sur commande ou à domicile avec frais." },
    { id: "vente_devises", groupe: "devises", lib: "Vente de devises (billets)", court: "Vente devises", doc: "Bordereau de vente de devises étrangères",
      aide: "Le client revend à la banque des billets étrangers non utilisés. Billets contrôlés, cours de la newsletter moins la marge de la banque ; le compte est crédité." },
    { id: "cloture_compte", groupe: "compte", lib: "Clôture du compte et des épargnes", court: "Clôture", doc: "Demande de clôture de compte et d'épargnes",
      aide: "Le client quitte l'agence. Vérifications avant la clôture (chèques émis pointés, chèques impayés régularisés, moyens de paiement récupérés et résiliés, services résiliés), puis solde versé par virement sur le RIB du client ou par chèque de banque. Une attestation de clôture du compte et des épargnes lui est remise." },
    { id: "desolidarisation_compte", groupe: "compte", lib: "Désolidarisation d'un compte joint", court: "Désolidarisation", doc: "Demande de désolidarisation d'un compte joint",
      aide: "Les deux cotitulaires demandent ensemble que le compte joint devienne le compte individuel de l'un d'eux. L'autre cesse d'être titulaire ; le compte garde son numéro. Lettre signée de chacun, accord du titulaire conservé, reprise d'un éventuel solde débiteur. Une attestation est remise aux deux titulaires." }
  ];
  var PAR_ID = {}; TYPES.forEach(function (t) { PAR_ID[t.id] = t; });

  var STATUTS = { asigner: "À signer", executee: "Exécutée", annulee: "Annulée" };

  /* ---------- IBAN, SEPA, pays ---------- */
  var SEPA = {
    AD: [24, "Andorre"], AT: [20, "Autriche"], BE: [16, "Belgique"], BG: [22, "Bulgarie"], CH: [21, "Suisse"], CY: [28, "Chypre"], CZ: [24, "Tchéquie"], DE: [22, "Allemagne"], DK: [18, "Danemark"],
    EE: [20, "Estonie"], ES: [24, "Espagne"], FI: [18, "Finlande"], FR: [27, "France"], GB: [22, "Royaume-Uni"], GI: [23, "Gibraltar"], GR: [27, "Grèce"], HR: [21, "Croatie"], HU: [28, "Hongrie"],
    IE: [22, "Irlande"], IS: [26, "Islande"], IT: [27, "Italie"], LI: [21, "Liechtenstein"], LT: [20, "Lituanie"], LU: [20, "Luxembourg"], LV: [21, "Lettonie"], MC: [27, "Monaco"], MT: [31, "Malte"],
    NL: [18, "Pays-Bas"], NO: [15, "Norvège"], PL: [28, "Pologne"], PT: [25, "Portugal"], RO: [24, "Roumanie"], SE: [24, "Suède"], SI: [19, "Slovénie"], SK: [24, "Slovaquie"], SM: [27, "Saint-Marin"], VA: [22, "Vatican"]
  };
  /* Pays hors SEPA : pays, devise habituelle, longueur de l'IBAN (0 : le pays n'utilise pas l'IBAN, on saisit un numéro de compte). */
  var PAYS = [
    { c: "MA", lib: "Maroc", dev: "MAD", iban: 28 }, { c: "TN", lib: "Tunisie", dev: "TND", iban: 24 }, { c: "DZ", lib: "Algérie", dev: "DZD", iban: 26 }, { c: "TR", lib: "Turquie", dev: "TRY", iban: 26 },
    { c: "SN", lib: "Sénégal", dev: "XOF", iban: 28 }, { c: "CI", lib: "Côte d'Ivoire", dev: "XOF", iban: 28 }, { c: "CM", lib: "Cameroun", dev: "XAF", iban: 27 }, { c: "MG", lib: "Madagascar", dev: "MGA", iban: 27 },
    { c: "EG", lib: "Égypte", dev: "EGP", iban: 29 }, { c: "LB", lib: "Liban", dev: "USD", iban: 28 }, { c: "IL", lib: "Israël", dev: "ILS", iban: 23 }, { c: "AE", lib: "Émirats arabes unis", dev: "AED", iban: 23 },
    { c: "SA", lib: "Arabie saoudite", dev: "SAR", iban: 24 }, { c: "BR", lib: "Brésil", dev: "BRL", iban: 29 }, { c: "US", lib: "États-Unis", dev: "USD", iban: 0 }, { c: "CA", lib: "Canada", dev: "CAD", iban: 0 },
    { c: "MX", lib: "Mexique", dev: "MXN", iban: 0 }, { c: "JP", lib: "Japon", dev: "JPY", iban: 0 }, { c: "CN", lib: "Chine", dev: "CNY", iban: 0 }, { c: "IN", lib: "Inde", dev: "INR", iban: 0 },
    { c: "SG", lib: "Singapour", dev: "SGD", iban: 0 }, { c: "AU", lib: "Australie", dev: "AUD", iban: 0 }, { c: "ZA", lib: "Afrique du Sud", dev: "ZAR", iban: 0 },
    { c: "GB", lib: "Royaume-Uni", dev: "GBP", iban: 22, sepa: true }, { c: "CH", lib: "Suisse", dev: "CHF", iban: 21, sepa: true }
  ];
  var PAYS_REFUSES = { KP: "Corée du Nord", IR: "Iran", SY: "Syrie", CU: "Cuba", RU: "Russie", BY: "Biélorussie" };
  var PAYS_PAR = {}; PAYS.forEach(function (p) { PAYS_PAR[p.c] = p; });
  /* Devises : nombre de devises pour 1 €, bornes de vraisemblance (pour repérer un cours écrit à l'envers). */
  var DEVISES = {
    EUR: { lib: "Euro" }, USD: { lib: "Dollar américain", min: 0.6, max: 1.8 }, GBP: { lib: "Livre sterling", min: 0.5, max: 1.2 }, CHF: { lib: "Franc suisse", min: 0.7, max: 1.3 },
    CAD: { lib: "Dollar canadien", min: 1, max: 2.2 }, JPY: { lib: "Yen", min: 100, max: 260 }, MAD: { lib: "Dirham marocain", min: 8, max: 13 }, TND: { lib: "Dinar tunisien", min: 2.4, max: 4.2 },
    DZD: { lib: "Dinar algérien", min: 100, max: 220 }, TRY: { lib: "Livre turque", min: 10, max: 200 }, XOF: { lib: "Franc CFA (BCEAO)", fixe: 655.957 }, XAF: { lib: "Franc CFA (BEAC)", fixe: 655.957 },
    MGA: { lib: "Ariary malgache", min: 3000, max: 8000 }, EGP: { lib: "Livre égyptienne", min: 20, max: 120 }, ILS: { lib: "Shekel", min: 2.5, max: 5.5 }, AED: { lib: "Dirham des Émirats", min: 2.5, max: 5.5 },
    SAR: { lib: "Riyal saoudien", min: 2.7, max: 5.8 }, BRL: { lib: "Réal brésilien", min: 3.5, max: 9.5 }, MXN: { lib: "Peso mexicain", min: 12, max: 32 }, CNY: { lib: "Yuan", min: 5, max: 10 },
    INR: { lib: "Roupie indienne", min: 60, max: 140 }, SGD: { lib: "Dollar de Singapour", min: 1, max: 2 }, AUD: { lib: "Dollar australien", min: 1.1, max: 2.4 }, ZAR: { lib: "Rand", min: 12, max: 30 }
  };
  /* Billets étrangers : « stock » = disponibles tout de suite à l'agence (jusqu'à un certain montant), « commande » = commandés à la centrale de billets (3 jours ouvrés), « non » = monnaie non convertible
     ou dont l'exportation est limitée : la banque ne la vend pas et ne la rachète pas. `pas` : plus petite coupure (le montant est un multiple). */
  var BILLETS = { USD: "stock", GBP: "stock", CHF: "stock", CAD: "commande", JPY: "commande", AUD: "commande", SGD: "commande", CNY: "commande", AED: "commande", SAR: "commande", ILS: "commande",
    TRY: "commande", ZAR: "commande", MXN: "commande", BRL: "commande", INR: "commande", XOF: "commande", XAF: "commande", MAD: "non", TND: "non", DZD: "non", EGP: "non", MGA: "non" };
  var PAS_BILLETS = { JPY: 1000, INR: 100, MXN: 20, ILS: 20, XOF: 1000, XAF: 1000 };
  var MOTIFS_INTL = [
    { v: "famille", lib: "Aide à un membre de la famille" }, { v: "achat", lib: "Paiement d'un achat ou d'une facture" }, { v: "etudes", lib: "Frais de scolarité ou d'études" },
    { v: "sante", lib: "Frais de santé" }, { v: "immo", lib: "Acquisition ou travaux immobiliers" }, { v: "autre", lib: "Autre motif (à préciser)" }
  ];

  function nettoyerIban(s) { return sansEspaces(s); }
  function ibanLisible(s) { return nettoyerIban(s).replace(/(.{4})(?=.)/g, "$1 "); }
  function bicValide(s) { return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(sansEspaces(s)); }
  /* Contrôle d'un IBAN : forme, longueur du pays, clé modulo 97. */
  function controleIban(s, attendu) {
    var i = nettoyerIban(s);
    if (!i) return { ok: false, msg: "Saisissez l'IBAN du bénéficiaire." };
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(i)) return { ok: false, msg: "Un IBAN commence par deux lettres (le pays) et deux chiffres, puis contient des chiffres et des lettres sans signe de ponctuation." };
    var pays = i.slice(0, 2), lg = SEPA[pays] ? SEPA[pays][0] : PAYS_PAR[pays] && PAYS_PAR[pays].iban ? PAYS_PAR[pays].iban : 0;
    if (lg && i.length !== lg) return { ok: false, msg: "Un IBAN " + (SEPA[pays] ? "de " + SEPA[pays][1] : "de ce pays") + " compte " + lg + " caractères ; celui-ci en compte " + i.length + "." };
    if (RIB.mod97(i.slice(4) + i.slice(0, 4)) !== 1) return { ok: false, msg: "La clé de contrôle de l'IBAN est fausse : une erreur de frappe est probable. Relisez l'IBAN avec le client." };
    if (attendu && pays !== attendu) return { ok: false, msg: "Cet IBAN est celui d'un autre pays (" + pays + ")." };
    return { ok: true, iban: i, pays: pays };
  }
  function construireIban(pays, bban) { var k = 98 - RIB.mod97(bban + pays + "00"); return pays + (k < 10 ? "0" : "") + k + bban; }

  /* IBAN d'exercice (banques et titulaires imaginaires) : ils servent à s'entraîner et à la vérification du bénéficiaire. */
  function bbanFr(banque, guichet, compte) { return banque + guichet + compte + RIB.cleRib(banque, guichet, compte); }
  var EXEMPLES = [
    { id: "fr1", lib: "France – Banque du Littoral", iban: construireIban("FR", bbanFr("30047", "01230", "00040123456")), bic: "BDLIFRPPXXX", titulaires: ["Mme MARTIN Élise"] },
    { id: "fr2", lib: "France – Caisse Rhodanienne", iban: construireIban("FR", bbanFr("17806", "00231", "00250461789")), bic: "CRHOFR2AXXX", titulaires: ["M. LEFEBVRE Antoine"] },
    { id: "fr3", lib: "France – association (compte d'une association)", iban: construireIban("FR", bbanFr("42559", "00018", "21023118465")), bic: "BDLIFRPPXXX", titulaires: ["ASSOCIATION SPORTIVE DU QUARTIER"] },
    { id: "de", lib: "Allemagne", iban: construireIban("DE", "100200300012345678"), bic: "RHBKDEFFXXX", titulaires: ["M. WEBER Lukas"] },
    { id: "es", lib: "Espagne", iban: construireIban("ES", "01820012340201234567"), bic: "BCNAESMMXXX", titulaires: ["Mme GARCIA Lucía"] },
    { id: "it", lib: "Italie", iban: construireIban("IT", "Z0300203280000400123456"), bic: "BNMIITMMXXX", titulaires: ["M. ROSSI Marco"] },
    { id: "be", lib: "Belgique", iban: construireIban("BE", "001234567890"), bic: "BKBRBEBBXXX", titulaires: ["M. JANSSENS Pieter"] },
    { id: "ma", lib: "Maroc (virement international)", iban: construireIban("MA", "011780000012345678901234"), bic: "QXBKMAMCXXX", titulaires: ["M. BENALI Yassine"] },
    { id: "tn", lib: "Tunisie (virement international)", iban: construireIban("TN", "08006000012345678912"), bic: "QXBKTNTTXXX", titulaires: ["Mme TRABELSI Sonia"] },
    { id: "tr", lib: "Turquie (virement international)", iban: construireIban("TR", "0006100519786457841326"), bic: "QXBKTRISXXX", titulaires: ["M. YILMAZ Emre"] }
  ];
  EXEMPLES.forEach(function (e) { e.pays = e.iban.slice(0, 2); });

  /* ---------- vérification du bénéficiaire (VoP) ---------- */
  var indexIban = null;
  function indexer() {
    if (indexIban) return indexIban;
    indexIban = {};
    CL.forEach(function (c) { var r = RIB.rib(c); indexIban[r.iban] = { client: c, titulaires: r.titulaires }; });
    EXEMPLES.forEach(function (e) { indexIban[e.iban] = { client: null, titulaires: e.titulaires }; });
    return indexIban;
  }
  function clientParIban(iban) { var x = indexer()[nettoyerIban(iban)]; return x ? x.client : null; }
  function mots(s) { return norm(s).split(" ").filter(function (w) { return w && ["M", "MR", "MME", "MLLE", "MLE", "MONSIEUR", "MADAME", "DR"].indexOf(w) < 0; }); }
  function lev(a, b) {
    var i, j, d = [];
    for (i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (j = 1; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
    return d[a.length][b.length];
  }
  /* Résultat : { code: "ok" | "proche" | "non" | "impossible", titulaire (nom communiqué en cas de correspondance proche) }. */
  function verifierBeneficiaire(iban, nomSaisi) {
    var x = indexer()[nettoyerIban(iban)];
    if (!x) return { code: "impossible" };
    var saisi = mots(nomSaisi), cle = saisi.slice().sort().join(" "), meilleur = null;
    x.titulaires.forEach(function (t) {
      var m = mots(t), k = m.slice().sort().join(" "), d = lev(k, cle);
      if (!meilleur || d < meilleur.d) meilleur = { d: d, t: t, m: m, k: k };
    });
    if (!meilleur || !saisi.length) return { code: "non" };
    if (meilleur.k === cle) return { code: "ok" };
    var inclus = saisi.every(function (w) { return meilleur.m.some(function (h) { return h === w || (w.length === 1 && h.charAt(0) === w); }); });
    if (meilleur.d <= 3 || inclus) return { code: "proche", titulaire: meilleur.t };
    return { code: "non" };
  }

  /* ---------- le contexte d'un client ---------- */
  function operations(st, cid) { return (st && Array.isArray(st.operations) ? st.operations : []).filter(function (o) { return cid == null || o.c === cid; }); }
  /* Saisie administrative à tiers détenteur (satd.js) : somme bloquée sur le compte courant du client aujourd'hui, du jour de la réception de l'avis au jour du versement au Trésor public (exclu). */
  function satdBloque(st, cid) {
    var y = B.ymd(B.aujourdhui()), r = { montant: 0, tous: false, jusqu: "", avis: [] };
    (st && Array.isArray(st.satd) ? st.satd : []).forEach(function (s) {
      if (s.c !== cid || s.statut !== "bloque" || y < s.debut || y >= s.versement) return;
      r.montant = r2(r.montant + (s.calcul.bloqueCourant || 0)); r.tous = r.tous || s.calcul.mode === "tous"; r.avis.push(s.avis); if (s.versement > r.jusqu) r.jusqu = s.versement;
    });
    return r;
  }
  function compte(c, st) {
    var res = M.resume(c, 30), dec = (c.cpt && c.cpt.dec) || 0, rib = RIB.rib(c), sb = satdBloque(st, c.id);
    return { solde: res.solde, decouvert: dec, bloque: sb.montant, satd: sb, dispo: r2(res.solde + dec - sb.montant), rib: rib, iban: rib.iban, ibanLisible: rib.ibanLisible, bic: rib.bic, titulaire: rib.titulaire, joint: rib.joint };
  }
  function ctxDe(c, st) { return { c: c, st: st, auj: B.aujourdhui(), cpt: compte(c, st) }; }
  /* Le relevé sur 14 mois ; les lignes ajoutées par des opérations de service (champ « operation ») n'en font pas partie. */
  function lignesReleve(c) { return M.releve(c, 14).lignes.filter(function (l) { return !l.operation; }); }
  function cleLigne(l) { return l.ymd + "|" + l.m.toFixed(2) + "|" + l.lib; }

  /* ---------- les cartes du client et leur état ---------- */
  function rangGamme(pid) { return GAMME.indexOf(pid); }
  /* État des cartes : détenues au dossier + souscrites pendant l'exercice, puis effet des opérations exécutées (opposition, plafond, changement de gamme). */
  function cartes(c, st) {
    var ctx = K.contexte(c, st), auj = B.aujourdhui(), ops = operations(st, c.id).filter(function (o) { return o.statut === "executee"; });
    var liste = ctx.cartes.map(function (x, i) {
      var std = PLAFONDS_CARTE[x.p] || { pai: 0, ret: 0 };
      return { p: x.p, nom: nomCourtProduit(x.p), sys: !!x.sys || !!(PR.parId[x.p] && PR.parId[x.p].controleSolde), rang: i, etat: "active", etatLib: "Active", pai: std.pai, ret: std.ret, std: std, temp: null, note: "" };
    });
    function trouver(pid, etats) { return liste.filter(function (k) { return k.p === pid && etats.indexOf(k.etat) >= 0; })[0]; }
    ops.forEach(function (o) {
      var k, v = o.v || {}, d = o.dateOp ? B.lireYmd(o.dateOp) : null;
      if (o.type === "montee_gamme") {
        k = trouver(v.carte, ["active"]);
        if (k) { k.etat = "remplacee"; k.etatLib = "Remplacée par " + nomCourtProduit(v.vers); k.note = v.remise === "domicile" ? "À détruire dès la réception de la nouvelle carte." : "À détruire dès la remise de la nouvelle carte à l'agence."; }
      } else if (o.type === "opposition_carte") {
        k = trouver(v.carte, ["active", "remplacee"]);
        if (k) {
          /* délai annoncé au client : « 5 à 7 jours ouvrés » (retrait à l'agence) ou « 7 à 9 jours ouvrés » (envoi à domicile) ; la carte est considérée comme disponible à la fin du délai annoncé */
          var delai = v.remise === "domicile" ? DELAI_CARTE.domicile : DELAI_CARTE.agence;
          var dispo = v.nouvelle === "oui" && d ? plusOuvres(d, delai) : null;
          if (dispo && dispo <= auj) { k.etat = "active"; k.etatLib = "Active (carte renouvelée)"; k.note = "Nouvelle carte " + (v.remise === "domicile" ? "envoyée à domicile, reçue au plus tard le " : "disponible à l'agence au plus tard le ") + B.fmtDate(dispo) + "."; }
          else { k.etat = "opposee"; k.etatLib = "Opposée"; k.note = dispo ? "Nouvelle carte attendue au plus tard le " + B.fmtDate(dispo) + (v.remise === "domicile" ? " (envoi à domicile)." : " (à retirer à l'agence).") : "Aucune nouvelle carte commandée."; }
        }
      } else if (o.type === "cloture_compte") {
        liste.forEach(function (z) { z.etat = "resiliee"; z.etatLib = "Résiliée (clôture du compte)"; z.note = "Carte restituée et détruite lors de la clôture du compte, le " + B.fmtDate(B.lireYmd(o.dateOp || o.date)) + "."; });
      } else if (o.type === "desolidarisation_compte" && o.desol && o.desol.conserve === "cotitulaire") {
        liste.forEach(function (z) { z.etat = "resiliee"; z.etatLib = "Résiliée (désolidarisation du compte)"; z.note = "Carte restituée et détruite : le client n'est plus titulaire du compte depuis le " + B.fmtDate(B.lireYmd(o.dateOp || o.date)) + "."; });
      } else if (o.type === "plafond_carte") {
        k = trouver(v.carte, ["active"]);
        if (k) {
          var pai = lireM(v.pai), ret = lireM(v.ret);
          if (v.duree === "permanent") { k.pai = pai; k.ret = ret; k.temp = null; }
          else { var fin = lireDate(v.fin); if (fin && fin >= auj) k.temp = { pai: pai, ret: ret, fin: fin }; }
        }
      }
    });
    liste.forEach(function (k) { if (k.temp) { k.paiEff = Math.max(k.pai, k.temp.pai); k.retEff = Math.max(k.ret, k.temp.ret); } else { k.paiEff = k.pai; k.retEff = k.ret; } });
    return liste;
  }

  /* Numéro d'une carte : le kit de contestation ne demande que les 6 premiers et les 4 derniers chiffres (le reste est masqué). Numéro inventé, fixe pour un client et une carte
     (début imaginaire par gamme : 4974xx pour les cartes Visa, 5294xx pour la Mastercard). */
  var DEBUT_CARTE = { VJEU: "497410", VCLA: "497411", VPRE: "497412", PLAT: "497413", WELI: "529410", VELE: "497414", CRET: "497419" };
  function numeroCarte(c, pid) {
    var n = (empreinte(c.num + "|" + pid) * 7 + c.id * 13) % 10000;
    return (DEBUT_CARTE[pid] || "497400") + " XX XXXX " + (n < 10 ? "000" : n < 100 ? "00" : n < 1000 ? "0" : "") + n;
  }
  /* Dernière opposition exécutée sur cette carte : l'opération (avec sa date d'exécution), ou null. */
  function oppositionDe(st, cid, pid) {
    var l = operations(st, cid).filter(function (o) { return o.type === "opposition_carte" && o.statut === "executee" && o.v && o.v.carte === pid; });
    l.sort(function (a, b) { return (a.dateExec + (a.heureExec || "")) < (b.dateExec + (b.heureExec || "")) ? -1 : 1; });
    return l.length ? l[l.length - 1] : null;
  }

  /* ---------- champs ---------- */
  function ch(id, lib, type, extra) { var f = { id: id, lib: lib, type: type }, k; for (k in (extra || {})) f[k] = extra[k]; return f; }
  function vide(v, id) { return txt(v[id]) === ""; }
  function coche(v, id) { return v[id] === true || v[id] === "1" || v[id] === "on" || v[id] === "oui"; }
  function opt(v, lib, extra) { var o = { v: v, lib: lib }, k; for (k in (extra || {})) o[k] = extra[k]; return o; }

  /* ---------- vérification d'identité : première étape de toute opération ---------- */
  /* Au guichet : pièce d'identité contrôlée. Une seule exception : l'opposition sur une carte, qui peut être enregistrée par téléphone après identification de l'appelant
     par des questions de sécurité (blocage immédiat de la carte ; le client confirme ensuite par écrit à l'agence). */
  var PIECES_ID = K.PIECES_ID.map(function (z) { return opt(z.v, z.lib); });
  var QUESTIONS_SECURITE = [opt("naissance", "Date de naissance"), opt("adresse", "Adresse postale complète"), opt("paiement", "Dernier paiement par carte (commerçant, montant et date)"),
    opt("numero", "Numéro de client"), opt("mail", "Adresse e-mail du dossier"), opt("profession", "Profession déclarée à la banque")];
  var QUESTIONS_MIN = 3;
  function champsIdentite(v, id) {
    var tel = id === "opposition_carte";
    var os = [opt("oui", "Oui – pièce d'identité contrôlée devant le client")];
    if (tel) os.push(opt("tel", "Oui – client identifié par téléphone (questions de sécurité)"));
    os.push(opt("non", "Non – pas encore vérifiée"));
    var f = [ch("idverif", "L'identité du client a-t-elle été vérifiée ?", "select", { requis: true, groupe: "identite", recalc: true, vide: "Répondre", options: os,
      aide: tel ? "Client à l'agence : demandez une pièce officielle en cours de validité avec photographie, comparez la photographie avec le client et la signature avec le spécimen du dossier. Client au téléphone : l'opposition peut être enregistrée tout de suite, après les questions de sécurité."
        : "Avant toute opération, demandez une pièce officielle en cours de validité avec photographie. Comparez la photographie avec le client et la signature avec le spécimen du dossier." })];
    if (v.idverif === "oui") f.push(ch("idpiece", "Pièce d'identité présentée", "select", { requis: true, groupe: "identite", vide: "Choisir la pièce", options: PIECES_ID }));
    if (tel && v.idverif === "tel") f.push(ch("idtel", "Questions de sécurité auxquelles l'appelant a répondu correctement", "coches", { requis: true, groupe: "identite", options: QUESTIONS_SECURITE,
      aide: "Posez au moins " + QUESTIONS_MIN + " questions dont la réponse figure dans le dossier, puis cochez celles que l'appelant a réussies. Ne demandez jamais le code confidentiel, le code reçu par SMS, le cryptogramme ni le numéro complet de la carte." }));
    return f;
  }
  function controleIdentite(v, o, id) {
    var piece = PIECES_ID.filter(function (z) { return z.v === v.idpiece; })[0];
    if (vide(v, "idverif")) o.erreurs.push(E("idverif", "Indiquez si l'identité du client a été vérifiée : aucune opération ne se fait sans contrôle d'identité."));
    else if (v.idverif === "non") o.erreurs.push(E("idverif", "Identité non vérifiée : " + (id === "opposition_carte" ? "l'opposition ne peut pas être enregistrée. Si le client appelle, identifiez-le par téléphone avec les questions de sécurité ; s'il est à l'agence, demandez-lui" : "l'opération ne peut pas être faite. Demandez au client") + " une pièce officielle en cours de validité avec photographie (carte nationale d'identité, passeport, titre de séjour ou permis de conduire), contrôlez la photographie et comparez la signature avec le spécimen du dossier."));
    else if (v.idverif === "tel") {
      if (id !== "opposition_carte") o.erreurs.push(E("idverif", "L'identification par téléphone n'est acceptée que pour une opposition sur une carte. Cette opération se fait à l'agence, avec la pièce d'identité du client."));
      else {
        var ok = QUESTIONS_SECURITE.filter(function (q) { return Array.isArray(v.idtel) && v.idtel.indexOf(q.v) >= 0; });
        if (ok.length < QUESTIONS_MIN) o.erreurs.push(E("idtel", "Identification par téléphone insuffisante : posez au moins " + QUESTIONS_MIN + " questions de sécurité et cochez celles dont la réponse est exacte (" + ok.length + " cochée" + (ok.length > 1 ? "s" : "") + ")."));
        else o.resume.push(["Identité du client", "Identifiée par téléphone – questions de sécurité réussies : " + ok.map(function (q) { return q.lib.toLowerCase(); }).join(", ")]);
      }
    }
    else if (piece) o.resume.push(["Identité du client", "Vérifiée – " + piece.lib + " en cours de validité ; photographie et signature contrôlées"]);
  }

  /* ---------- stock de l'agence et modes de remise (chéquiers, cartes) ---------- */
  /* Stock restant d'un article : le stock de départ moins ce que les opérations (à signer ou exécutées), les cartes vendues et les ouvertures de compte en ont déjà pris (catalogue.js). */
  function stockRestant(st, article) { return K.stockRestant(st, article); }
  /* Remise d'une carte : toujours commandée (fabriquée), puis retirée à l'agence ou envoyée à domicile en recommandé (avec frais). Aucun stock de cartes à l'agence. */
  function champRemiseCarte(x, pid, quoi) {
    var o = [opt("agence", "Carte commandée – à retirer à l'agence sous 5 à 7 jours ouvrés – gratuit"),
      opt("domicile", "Carte commandée – envoyée à domicile en recommandé sous 7 à 9 jours ouvrés – " + eur(TARIFS.carteEnvoi))];
    return ch("remise", "Remise " + quoi, "select", { requis: true, vide: "Choisir le mode de remise", options: o,
      aide: "La carte " + nomCourtProduit(pid) + " est fabriquée sur commande : le client la retire à l'agence ou la reçoit à domicile." });
  }
  function libRemiseCarte(mode) {
    return mode === "domicile" ? "carte commandée, envoyée à domicile en recommandé sous 7 à 9 jours ouvrés – " + eur(TARIFS.carteEnvoi) : "carte commandée, à retirer à l'agence sous 5 à 7 jours ouvrés";
  }
  /* Espèces sorties du compte pendant le mois de l'opération : retraits du relevé, retraits avec la carte rechargée et achats de billets déjà exécutés. */
  function especesMois(x, op) {
    var mois = B.indexMois(op), cumul = lignesReleve(x.c).filter(function (l) { return l.kind === "retrait" && l.m < 0 && B.indexMois(l.date) === mois; }).reduce(function (t, l) { return t - l.m; }, 0);
    operations(x.st, x.c.id).forEach(function (z) { if ((z.type === "retrait_espece" || z.type === "achat_devises") && z.statut === "executee" && B.indexMois(B.lireYmd(z.dateOp)) === mois) cumul += z.montant || 0; });
    return cumul;
  }

  function epargnesVirables(c, st) {
    var ctx = K.contexte(c, st), res = [];
    ctx.epa.forEach(function (e, i) {
      if (["LA", "LDDS", "LEP", "LJ", "LBR"].indexOf(e.p) < 0) return;
      var plaf = PR.plafond[e.p] || 0;
      res.push({ p: e.p, nom: nomCourtProduit(e.p), solde: soldeEpargne(c, st, e.p, e.solde || 0), plafond: plaf });
    });
    return res;
  }
  /* Solde d'un livret : solde du dossier + virements exécutés depuis le compte courant. */
  function soldeEpargne(c, st, pid, base) {
    var clo = clotureDe(st, c.id);
    if (clo && clo.cloture && clo.cloture.epargnes.some(function (z) { return z.p === pid; })) return 0;      /* livret clôturé avec le compte : soldé */
    var s = base;
    if (base == null) { var e = c.epa.filter(function (x) { return x.p === pid; })[0]; s = e ? e.solde || 0 : 0; }
    operations(st, c.id).forEach(function (o) { if (o.statut === "executee" && o.type === "virement_interne" && o.v && o.v.dest === "epa:" + pid) s += lireM(o.v.montant) || 0; });
    /* versements au Trésor public prélevés sur le livret par une saisie administrative à tiers détenteur (à partir du jour du versement) */
    var yy = B.ymd(B.aujourdhui());
    (st && Array.isArray(st.satd) ? st.satd : []).forEach(function (z) { if (z.c === c.id && z.statut === "bloque") (z.mvEp || []).forEach(function (m) { if (m.p === pid && m.ymd <= yy) s += m.m; }); });
    return r2(s);
  }

  var CHAMPS = {};

  CHAMPS.virement_interne = function (x, v) {
    var ep = epargnesVirables(x.c, x.st), f = [];
    var dests = ep.map(function (e) { return opt("epa:" + e.p, e.nom + " du client – solde " + eur(e.solde) + (e.plafond ? " (plafond " + eur(e.plafond) + ")" : "")); });
    dests.push(opt("gs", "Compte d'un autre client de GS Banque & Assurance"));
    f.push(ch("dest", "Compte à créditer", "select", { options: dests, recalc: true, requis: true }));
    if (v.dest === "gs") { f.push(ch("iban", "IBAN du compte à créditer", "iban", { requis: true, aide: "IBAN commençant par FR76 99830 : compte d'un autre client de l'agence." })); f.push(ch("nom", "Nom du titulaire du compte à créditer", "texte", { requis: true })); }
    f.push(ch("montant", "Montant (€)", "montant", { requis: true, recalc: true }));
    f.push(ch("libelle", "Motif du virement", "texte", { max: 140, requis: true, aide: "Ce motif apparaît sur le relevé du bénéficiaire." }));
    var m = lireM(v.montant);
    if (m > SEUILS.justificatif) f.push(ch("justif", "Le client a présenté un justificatif de l'opération (au-delà de " + B.eur(SEUILS.justificatif) + ")", "case", { requis: true }));
    return f;
  };
  CHAMPS.virement_sepa = function (x, v) {
    var f = [];
    f.push(ch("nom", "Nom du bénéficiaire", "texte", { requis: true, aide: "Exactement comme sur le RIB du bénéficiaire : il est comparé au nom du titulaire par sa banque (vérification du bénéficiaire)." }));
    f.push(ch("iban", "IBAN du bénéficiaire", "iban", { requis: true, recalc: true }));
    f.push(ch("bic", "BIC du bénéficiaire (facultatif en zone SEPA)", "texte", { max: 11 }));
    f.push(ch("montant", "Montant (€)", "montant", { requis: true, recalc: true }));
    f.push(ch("libelle", "Motif du virement", "texte", { max: 140, requis: true }));
    f.push(ch("mode", "Exécution", "select", { requis: true, recalc: true, def: "standard", options: [
      opt("standard", "Standard – compte du bénéficiaire crédité au plus tard le jour ouvrable suivant (" + eur(TARIFS.virementSepa) + ")"),
      opt("instantane", "Instantané – en quelques secondes, 24 h sur 24 (" + eur(TARIFS.virementInstantane) + ")"),
      opt("differe", "Différé – à une date choisie par le client (" + eur(TARIFS.virementSepa) + ")")] }));
    if (v.mode === "differe") f.push(ch("date", "Date d'exécution", "date", { requis: true }));
    var vop = v.iban && controleIban(v.iban).ok && !vide(v, "nom") ? verifierBeneficiaire(v.iban, v.nom) : null;
    if (vop && vop.code === "proche") f.push(ch("vopOk", "Le client confirme le nom communiqué par la banque du bénéficiaire (« " + vop.titulaire + " »)", "case", { requis: true }));
    if (vop && (vop.code === "non" || vop.code === "impossible")) f.push(ch("vopOk", vop.code === "non" ? "Le client maintient son ordre malgré l'absence de correspondance du nom et en assume la responsabilité" : "Le client maintient son ordre alors que la vérification du bénéficiaire n'a pas pu être faite", "case", { requis: true }));
    var m = lireM(v.montant);
    if (m > SEUILS.justificatif) f.push(ch("justif", "Le client a présenté un justificatif de l'opération (au-delà de " + B.eur(SEUILS.justificatif) + ")", "case", { requis: true }));
    if (m > SEUILS.directeur) f.push(ch("directeur", "La directrice d'agence a donné son accord (au-delà de " + B.eur(SEUILS.directeur) + ")", "case", { requis: true }));
    return f;
  };
  CHAMPS.virement_intl = function (x, v) {
    var f = [], pays = PAYS_PAR[v.pays] || null, devs = [];
    var po = PAYS.map(function (p) { return opt(p.c, p.lib); });
    Object.keys(PAYS_REFUSES).forEach(function (k) { po.push(opt(k, PAYS_REFUSES[k] + " (pays sous sanctions)")); });
    f.push(ch("pays", "Pays du bénéficiaire", "select", { options: po, recalc: true, requis: true, vide: "Choisir le pays" }));
    f.push(ch("nom", "Nom du bénéficiaire", "texte", { requis: true }));
    f.push(ch("adresse", "Adresse du bénéficiaire (rue, ville)", "texte", { max: 70, requis: true, aide: "Obligatoire pour un virement hors zone SEPA." }));
    f.push(ch("compte", pays && pays.iban ? "IBAN du bénéficiaire" : "Numéro de compte du bénéficiaire", pays && pays.iban ? "iban" : "texte", { requis: true, max: 34 }));
    f.push(ch("bic", "BIC / SWIFT de la banque du bénéficiaire", "texte", { max: 11, requis: true, aide: "8 ou 11 caractères ; les lettres 5 et 6 sont le code du pays de la banque." }));
    if (pays) { devs.push(pays.dev); if (devs.indexOf("EUR") < 0) devs.push("EUR"); if (devs.indexOf("USD") < 0) devs.push("USD"); }
    f.push(ch("devise", "Devise du virement", "select", { options: (devs.length ? devs : ["EUR"]).map(function (d) { return opt(d, d + " – " + DEVISES[d].lib); }), recalc: true, requis: true, def: pays ? pays.dev : "EUR" }));
    f.push(ch("montant", "Montant dans la devise du virement", "montant", { requis: true, recalc: true }));
    if (v.devise && v.devise !== "EUR") f.push(ch("cours", "Cours de change du jour (devises pour 1 €)", "cours", { requis: true, recalc: true, aide: "Le cours en vigueur est communiqué dans la newsletter. Exemple : 1,08 pour 1 € = 1,08 dollar." }));
    f.push(ch("frais", "Frais de la banque du bénéficiaire", "select", { requis: true, def: "SHA", options: [opt("SHA", "Partagés (SHA) – le client paie les frais de GS, le bénéficiaire ceux de sa banque"), opt("OUR", "À la charge du client (OUR) – supplément de " + eur(TARIFS.intlOur))] }));
    f.push(ch("motif", "Motif économique", "select", { requis: true, options: MOTIFS_INTL, vide: "Choisir le motif", recalc: true }));
    if (v.motif === "autre" || lireM(v.montant) * 1 > 0) f.push(ch("precision", "Précision sur l'opération (facture, contrat, lien avec le bénéficiaire)", "texte", { max: 140, requis: v.motif === "autre" || eqEuro(v) > SEUILS.justificatif }));
    var eq = eqEuro(v);
    if (eq > SEUILS.justificatif) f.push(ch("justif", "Le client a présenté un justificatif (facture, contrat…) – au-delà de " + B.eur(SEUILS.justificatif), "case", { requis: true }));
    if (eq > SEUILS.directeur) f.push(ch("directeur", "La directrice d'agence a donné son accord (au-delà de " + B.eur(SEUILS.directeur) + ")", "case", { requis: true }));
    return f;
  };
  function eqEuro(v) {
    var m = lireM(v.montant);
    if (!(m > 0)) return 0;
    if (v.devise === "EUR" || !v.devise) return m;
    var c = lireCours(v.cours);
    return c > 0 ? r2(m / c) : 0;
  }
  CHAMPS.retrait_espece = function (x, v) {
    return [
      ch("montant", "Montant à charger sur la carte (€)", "montant", { requis: true, aide: "Multiple de 10 €, de " + B.eur(SEUILS.retraitMin) + " à " + B.eur(SEUILS.retraitJour) + " par jour." })
    ];
  };
  CHAMPS.rejet_prelevement = function (x, v) {
    var l = lignesRejetables(x.c, x.st), auj = x.auj;
    var o = l.map(function (z) { return opt(cleLigne(z), B.fmtDate(z.date) + " – " + z.lib + " – " + eur(-z.m)); });
    var f = [ch("ligne", "Prélèvement contesté", "select", { options: o, requis: true, recalc: true, vide: "Choisir le prélèvement" })];
    f.push(ch("consenti", "Le client avait-il autorisé ce prélèvement (mandat signé) ?", "select", { requis: true, recalc: true, options: [opt("oui", "Oui, il avait signé un mandat – délai de 8 semaines"), opt("non", "Non, il ne l'avait pas autorisé – délai de 13 mois")], vide: "Choisir" }));
    if (v.consenti === "non") f.push(ch("motif", "Pourquoi n'était-il pas autorisé ?", "select", { requis: true, options: [opt("sans_mandat", "Aucun mandat n'a jamais été signé"), opt("mandat_revoque", "Le mandat avait été révoqué avant le prélèvement"), opt("montant", "Le prélèvement ne respecte pas le mandat (montant, créancier)")], vide: "Choisir le motif" }));
    f.push(ch("opposition", "Le client demande aussi d'empêcher les prochains prélèvements de ce créancier", "case", { aide: "Révocation du mandat : elle doit être demandée au plus tard la veille du prélèvement suivant." }));
    return f;
  };
  /* Prélèvements débités dans les 13 derniers mois et pas encore remboursés par une opération de l'élève. */
  function lignesRejetables(c, st) {
    var pris = {};
    operations(st, c.id).forEach(function (o) { if (o.type === "rejet_prelevement" && o.statut !== "annulee" && o.v) pris[o.v.ligne] = true; });
    var limite = new Date(B.aujourdhui().getFullYear(), B.aujourdhui().getMonth() - 13, B.aujourdhui().getDate());
    return lignesReleve(c).filter(function (l) { return l.kind === "prelevement" && l.m < 0 && l.date >= limite && !pris[cleLigne(l)]; }).sort(function (a, b) { return b.date - a.date; });
  }

  CHAMPS.opposition_carte = function (x, v) {
    var ks = cartes(x.c, x.st).filter(function (k) { return k.etat !== "opposee"; });
    var f = [ch("carte", "Carte à bloquer", "select", { requis: true, options: ks.map(function (k) { return opt(k.p, k.nom + (k.etat === "remplacee" ? " (remplacée)" : "")); }), recalc: true, vide: ks.length ? "Choisir la carte" : "Aucune carte à bloquer", def: ks.length === 1 ? ks[0].p : "" })];
    f.push(ch("motif", "Motif de l'opposition", "select", { requis: true, recalc: true, vide: "Choisir le motif", options: [
      opt("perte", "Perte – le client ne retrouve plus sa carte"), opt("vol", "Vol – la carte lui a été volée"),
      opt("fraude", "Utilisation frauduleuse – la carte (ou ses données) a servi à son insu"), opt("abusive", "Utilisation abusive – un proche à qui la carte a été confiée en abuse (fichage au FCC pendant 2 ans)")], aide: v.motif === "abusive" ? "Attention : une opposition pour utilisation abusive entraîne l'inscription du titulaire au fichier central des chèques (FCC) pendant 2 ans. Prévenez le client avant de valider." : undefined }));
    f.push(ch("quand", "Date où le client s'en est aperçu", "date", { requis: true }));
    f.push(ch("lieu", "Lieu (ville ou site internet)", "texte", { max: 80, requis: true }));
    f.push(ch("circonstances", "Circonstances racontées par le client", "texte", { max: 300, requis: true }));
    if (v.motif === "vol" || v.motif === "fraude") f.push(ch("plainte", "Le client a déposé plainte (ou le fera sous 48 heures)", "case", { aide: "La copie du dépôt de plainte est à joindre au kit de contestation en cas de vol." }));
    f.push(ch("nouvelle", "Nouvelle carte", "select", { requis: true, def: "oui", recalc: true, options: [opt("oui", "Commander une nouvelle carte (reçue en 5 à 7 jours ouvrés)" + (v.motif === "fraude" ? " – gratuite" : " – " + eur(TARIFS.refabricationCarte))), opt("non", "Ne pas commander de nouvelle carte")] }));
    if (v.nouvelle === "oui" && v.carte) f.push(champRemiseCarte(x, v.carte, "de la nouvelle carte"));
    return f;
  };

  /* ---------- contestation d'opérations par carte ---------- */
  var MOIS_CONTESTATION = 13;       /* délai pour contester une opération non autorisée (article L133-24 du Code monétaire et financier) */
  var LIGNES_KIT = 47, LIGNES_PAGE1 = 10;   /* le kit détaille 10 opérations dans l'annexe 1 ou 2, 37 de plus dans l'annexe 3 */
  var FRANCHISE_PERTE_VOL = 50;     /* article L133-19 : perte ou vol, avant l'opposition seulement */
  var SITUATIONS_CONTESTATION = { perdue: "Carte perdue", volee: "Carte volée", possession: "Carte en possession du client" };
  var MOTIFS_OPPOSITION = { perte: "perte", vol: "vol", fraude: "utilisation frauduleuse", abusive: "utilisation abusive" };
  /* Paiements et retraits par carte des 13 derniers mois, pas encore contestés (par une contestation à signer ou exécutée), les plus récents d'abord. */
  function lignesContestables(c, st) {
    var pris = {};
    operations(st, c.id).forEach(function (o) { if (o.type === "contestation_carte" && o.statut !== "annulee" && o.v && Array.isArray(o.v.contestees)) o.v.contestees.forEach(function (k) { pris[k] = true; }); });
    var auj = B.aujourdhui(), limite = new Date(auj.getFullYear(), auj.getMonth() - MOIS_CONTESTATION, auj.getDate());
    return lignesReleve(c).filter(function (l) { return (l.kind === "carte" || l.kind === "retrait") && l.m < 0 && l.date >= limite && l.date <= auj && !pris[cleLigne(l)]; })
      .sort(function (a, b) { return b.date - a.date; }).slice(0, 80);
  }
  function libLigne(z) { return B.fmtDate(z.date) + " – " + z.lib + " – " + eur(-z.m); }
  CHAMPS.contestation_carte = function (x, v) {
    var ks = cartes(x.c, x.st), opp = v.carte ? oppositionDe(x.st, x.c.id, v.carte) : null, perdVol = v.situation === "perdue" || v.situation === "volee";
    var f = [ch("carte", "Carte concernée", "select", { requis: true, recalc: true, vide: ks.length ? "Choisir la carte" : "Aucune carte", def: ks.length === 1 ? ks[0].p : "",
      options: ks.map(function (k) { return opt(k.p, k.nom + " – n° " + numeroCarte(x.c, k.p) + (k.etat === "opposee" ? " (opposée)" : k.etat === "remplacee" ? " (remplacée)" : "")); }) })];
    f.push(ch("situation", "Situation de la carte", "select", { requis: true, recalc: true, vide: "Choisir la situation", options: [
      opt("perdue", "Perdue – annexe 1 du kit"), opt("volee", "Volée – annexe 1 du kit"), opt("possession", "En possession du client – annexe 2 du kit (opérations qu'il n'a jamais faites ni autorisées)")],
      aide: "Si le client a fait lui-même le paiement (débité deux fois, montant erroné, service non rendu), ce n'est pas une opération non autorisée : cette contestation ne s'applique pas." }));
    if (v.carte) {
      var etat = opp ? "Carte en opposition depuis le " + B.fmtDate(B.lireYmd(opp.dateExec)) + " (" + opp.ref + ", motif : " + MOTIFS_OPPOSITION[opp.v.motif] + ")."
        : perdVol ? "Cette carte n'est pas en opposition : une carte perdue ou volée doit d'abord être mise en opposition (opération « Opposition sur une carte »), dont la date figure sur le kit."
        : "Cette carte n'est pas en opposition. Pour une fraude avec la carte en main, on conteste d'abord les opérations, puis on fait opposition pour utilisation frauduleuse (opération liée).";
      f.push(ch("etat_opposition", "Opposition sur la carte", "info", { texte: etat }));
    }
    if (perdVol) {
      var d = lireDate(v.constat);
      f.push(ch("pin", "Où se trouvait le code confidentiel au moment des faits ?", "texte", { max: 120, requis: true, aide: "Réponse du client, notée telle quelle sur le kit (par exemple « dans ma tête » ou « noté sur un papier, à la maison »)." }));
      f.push(ch("constat", v.situation === "volee" ? "Date à laquelle le client a constaté le vol" : "Date à laquelle le client a constaté la perte", "date", { requis: true, recalc: true, def: opp && opp.v && opp.v.quand ? opp.v.quand : "" }));
      var avant = lignesReleve(x.c).filter(function (l) { return (l.kind === "carte" || l.kind === "retrait") && l.m < 0 && (!d || l.date <= d); }).sort(function (a, b) { return b.date - a.date; }).slice(0, 12);
      f.push(ch("derniere", "Dernière opération faite par le client avant la " + (v.situation === "volee" ? "vol" : "perte"), "select", { requis: true, vide: "Choisir l'opération",
        options: avant.map(function (l) { return opt(cleLigne(l), libLigne(l)); }).concat([opt("aucune", "Aucune opération récente faite par le client avec cette carte")]) }));
      if (v.situation === "volee") f.push(ch("plainte", "Le client remet la copie de son dépôt de plainte (commissariat ou gendarmerie de son lieu de résidence)", "case", { requis: true, aide: "Pièce obligatoire du kit en cas de vol." }));
    } else if (v.situation === "possession") {
      f.push(ch("etranger", "Le client a-t-il résidé dans un pays étranger durant les 6 derniers mois ?", "select", { requis: true, recalc: true, vide: "Répondre", options: [opt("non", "Non"), opt("oui", "Oui")] }));
      if (v.etranger === "oui") {
        f.push(ch("etrDu", "Séjour à l'étranger : du", "date", { requis: true }));
        f.push(ch("etrAu", "Séjour à l'étranger : au", "date", { requis: true }));
        f.push(ch("etrPays", "Pays", "texte", { max: 60, requis: true }));
      }
      f.push(ch("plainte", "Le client a déposé plainte (conseillé)", "case"));
    }
    if (v.situation) {
      f.push(ch("circonstances", "Déclaration détaillée des circonstances", "texte", { max: 400, requis: true, aide: "Ce que le client raconte : quand et comment il s'est aperçu des opérations, ce qui s'est passé." }));
      var cont = lignesContestables(x.c, x.st);
      f.push(ch("contestees", "Opérations que le client conteste (" + LIGNES_KIT + " au plus)", "coches", { requis: true, options: cont.map(function (z) { return opt(cleLigne(z), libLigne(z)); }),
        aide: cont.length ? "Paiements et retraits par carte des 13 derniers mois que le client n'a pas déjà contestés (les " + cont.length + " plus récents). Au-delà de 10 opérations, le kit comprend l'annexe 3." : "Aucun paiement ni retrait par carte à contester dans les 13 derniers mois." }));
      f.push(ch("honneur", "Le client déclare sur l'honneur n'avoir jamais effectué avec sa carte, ni autorisé, les opérations cochées", "case", { requis: true }));
    }
    return f;
  };

  CHAMPS.opposition_cheque = function (x, v) {
    var f = [];
    f.push(ch("portee", "Opposition sur", "select", { requis: true, recalc: true, def: "cheque", options: [opt("cheque", "Un chèque émis"), opt("chequier", "Un chéquier ou plusieurs formules")] }));
    if (v.portee === "chequier") {
      f.push(ch("premier", "Numéro de la première formule", "texte", { max: 7, requis: true }));
      f.push(ch("dernier", "Numéro de la dernière formule", "texte", { max: 7, requis: true }));
    } else {
      f.push(ch("numero", "Numéro du chèque", "texte", { max: 7, requis: true, aide: "7 chiffres, en bas du chèque ou sur le talon du chéquier." }));
      f.push(ch("montant", "Montant du chèque (€)", "montant"));
      f.push(ch("beneficiaire", "Bénéficiaire du chèque", "texte", { max: 70 }));
      f.push(ch("emission", "Date d'émission", "date"));
    }
    f.push(ch("motif", "Motif de l'opposition", "select", { requis: true, recalc: true, vide: "Choisir le motif", options: [
      opt("perte", "Perte du chèque (ou du chéquier)"), opt("vol", "Vol du chèque (ou du chéquier)"), opt("fraude", "Utilisation frauduleuse (chèque falsifié ou contrefait)"),
      opt("collective", "Procédure collective du bénéficiaire (redressement ou liquidation judiciaire)"), opt("litige", "Litige avec le bénéficiaire (marchandise non livrée, désaccord…)")] }));
    f.push(ch("quand", "Date où le client s'en est aperçu", "date", { requis: true }));
    f.push(ch("circonstances", "Circonstances racontées par le client", "texte", { max: 300, requis: true }));
    if (v.motif === "vol" || v.motif === "fraude") f.push(ch("plainte", "Le client a déposé plainte (ou le fera sous 48 heures)", "case"));
    return f;
  };

  CHAMPS.plafond_carte = function (x, v) {
    var ks = cartes(x.c, x.st).filter(function (k) { return k.etat === "active"; });
    var k = ks.filter(function (z) { return z.p === v.carte; })[0] || null;
    var f = [ch("carte", "Carte", "select", { requis: true, recalc: true, vide: ks.length ? "Choisir la carte" : "Aucune carte active", def: ks.length === 1 ? ks[0].p : "", options: ks.map(function (z) { return opt(z.p, z.nom + " – paiement " + B.eur(z.paiEff) + " par 30 jours, retrait " + B.eur(z.retEff) + " par 7 jours"); }) })];
    f.push(ch("duree", "Relèvement", "select", { requis: true, recalc: true, def: "temporaire", options: [opt("temporaire", "Temporaire – jusqu'à " + DUREE_TEMP_MAX + " jours, plafonds jusqu'à " + COEF.temporaire + " fois les plafonds standards"), opt("permanent", "Permanent – plafonds jusqu'à " + String(COEF.permanent).replace(".", ",") + " fois les plafonds standards")] }));
    f.push(ch("pai", "Nouveau plafond de paiement par 30 jours (€)", "montant", { requis: true, def: k ? String(k.pai) : "" }));
    f.push(ch("ret", "Nouveau plafond de retrait par 7 jours (€)", "montant", { requis: true, def: k ? String(k.ret) : "" }));
    if (v.duree !== "permanent") f.push(ch("fin", "Fin du relèvement", "date", { requis: true }));
    f.push(ch("raison", "Raison de la demande", "select", { requis: true, vide: "Choisir la raison", options: [opt("voyage", "Voyage"), opt("achat", "Achat important"), opt("travaux", "Travaux ou déménagement"), opt("autre", "Autre (à préciser avec le client)")] }));
    return f;
  };

  function cibleGamme(c, st, pid) {
    var r = rangGamme(pid), res = [];
    GAMME.forEach(function (g, i) {
      if (i <= r) return;
      var ev = K.verdictClient(c, g, st);
      res.push({ p: g, ev: ev, cotisation: cotisationCarte(g) });
    });
    return res;
  }
  CHAMPS.montee_gamme = function (x, v) {
    var ks = cartes(x.c, x.st).filter(function (k) { return k.etat === "active" && rangGamme(k.p) >= 0 && !k.sys; });
    var f = [ch("carte", "Carte actuelle du client", "select", { requis: true, recalc: true, vide: ks.length ? "Choisir la carte" : "Aucune carte concernée", def: ks.length === 1 ? ks[0].p : "", options: ks.map(function (k) { return opt(k.p, k.nom + " – cotisation " + B.eur(cotisationCarte(k.p)) + " par an"); }) })];
    if (v.carte && rangGamme(v.carte) >= 0) {
      var cibles = cibleGamme(x.c, x.st, v.carte);
      f.push(ch("vers", "Carte demandée", "select", { requis: true, recalc: true, vide: cibles.length ? "Choisir la carte" : "Aucune gamme supérieure", options: cibles.map(function (z) {
        var ok = z.ev.verdict !== "non" && z.ev.verdict !== "detenu";
        return opt(z.p, nomCourtProduit(z.p) + " – " + B.eur(z.cotisation) + " par an – " + z.ev.libelle, { desactive: !ok });
      }) }));
      if (v.vers && GAMME.indexOf(v.vers) > rangGamme(v.carte)) {
        var ev = K.verdictClient(x.c, v.vers, x.st), conf = K.aConfirmer(ev);
        if (ev.verdict === "non") f.push(ch("_non", "Non éligible", "info", { texte: ev.motifs.join(" ") }));
        else if (conf.length) f.push(ch("confirmees", "Points confirmés avec le client", "coches", { requis: true, options: conf.map(function (t, i) { return opt(String(i), t); }) }));
        if (v.vers !== "VJEU") f.push(ch("debit", "Type de débit", "select", { requis: true, def: "immediat", options: [opt("immediat", "Débit immédiat"), opt("differe", "Débit différé (en fin de mois)")] }));
        if (ev.verdict !== "non" && ev.verdict !== "detenu") f.push(champRemiseCarte(x, v.vers, "de la nouvelle carte"));
      }
    }
    return f;
  };

  CHAMPS.cheque_banque = function (x, v) {
    var m = lireM(v.montant), f = [
      ch("nom", "Nom du bénéficiaire (à l'ordre de)", "texte", { requis: true, max: 70 }),
      ch("montant", "Montant (€)", "montant", { requis: true, recalc: true }),
      ch("objet", "Objet du chèque", "select", { requis: true, vide: "Choisir l'objet", options: [opt("vehicule", "Achat d'un véhicule"), opt("caution", "Dépôt de garantie ou caution d'un logement"), opt("acompte", "Acompte (travaux, déménagement…)"), opt("scolarite", "Frais de scolarité"), opt("immo", "Achat immobilier (acompte, frais de notaire)"), opt("autre", "Autre objet (à préciser avec le client)")] })
    ];
    if (m > SEUILS.justificatif) f.push(ch("justif", "Le client a présenté un justificatif (compromis, facture…) – au-delà de " + B.eur(SEUILS.justificatif), "case", { requis: true }));
    if (x.c.cre && x.c.cre.length) f.push(ch("pret", "Le chèque de banque est financé par un prêt de GS Banque & Assurance (déblocage des fonds) : la commission de " + B.eur(TARIFS.chequeBanque) + " n'est pas perçue", "case", {}));
    return f;
  };
  CHAMPS.commande_chequier = function (x, v) {
    var rest = stockRestant(x.st, "chequier"), stock = v.remise === "stock", o = [];
    if (rest > 0) o.push(opt("stock", "Remise immédiate en main propre – chéquier de dépannage de " + CHEQUIER_STOCK_NB + " formules (" + rest + " en stock) – gratuit"));
    o.push(opt("agence", "Commande – retrait en main propre à l'agence sous 5 jours ouvrés – gratuit"));
    o.push(opt("domicile", "Commande – envoi à domicile en recommandé – " + eur(TARIFS.chequierEnvoi)));
    return [
      ch("remise", "Remise du chéquier", "select", { requis: true, recalc: true, vide: "Choisir le mode de remise", options: o, aide: rest > 0 ? "" : "Le stock de chéquiers de dépannage de l'agence est épuisé : le chéquier doit être commandé." }),
      ch("nb", "Nombre de formules", "select", { requis: true, def: stock ? String(CHEQUIER_STOCK_NB) : "25", options: stock ? [opt(String(CHEQUIER_STOCK_NB), CHEQUIER_STOCK_NB + " formules (chéquier de dépannage)")] : [opt("25", "25 formules"), opt("50", "50 formules")] }),
      ch("fcc", "Le fichier central des chèques a été consulté : le client n'est pas inscrit", "case", { requis: true, aide: "Obligatoire avant de remettre des formules de chèques." })
    ];
  };

  /* ---------- change de devises : achat et vente de billets ---------- */
  function libDevise(d) { return d + " – " + DEVISES[d].lib; }
  function devisesBillets() { return Object.keys(DEVISES).filter(function (d) { return d !== "EUR" && BILLETS[d]; }); }
  function pasBillets(d) { return PAS_BILLETS[d] || 10; }
  function pourcent(x) { return String(Math.round(x * 1000) / 10).replace(".", ",") + " %"; }
  /* Cours appliqué aux billets = cours de la newsletter ± la marge de la banque : à l'achat le client reçoit moins de devises pour 1 €, à la vente moins d'euros pour une devise. */
  function coursBillets(cours, sens) { return Math.round(cours * (sens === "achat" ? 1 - TARIFS.margeBillets : 1 + TARIFS.margeBillets) * 10000) / 10000; }
  function eqBillets(v, sens) {
    var m = lireM(v.montant), c = lireCours(v.cours);
    if (!(m > 0) || !(c > 0)) return 0;
    var cb = coursBillets(c, sens);
    return cb > 0 ? r2(m / cb) : 0;
  }
  function fmtCours(c) { var t = String(c), d = t.indexOf("."); if (d < 0) t += ".00"; else if (t.length - d - 1 < 2) t += "0"; return t.replace(".", ","); }
  function champDevise(sens) {
    return ch("devise", sens === "achat" ? "Devise demandée par le client" : "Devise des billets remis par le client", "select", { requis: true, recalc: true, vide: "Choisir la devise",
      options: devisesBillets().map(function (d) { return opt(d, libDevise(d) + (BILLETS[d] === "non" ? " – non disponible en France" : sens === "achat" ? (BILLETS[d] === "stock" ? " – en stock à l'agence" : " – sur commande") : "")); }) });
  }
  function champsBillets(v, sens) {
    var dev = v.devise;
    if (!dev || !BILLETS[dev] || BILLETS[dev] === "non") return [];
    return [
      ch("montant", sens === "achat" ? "Montant demandé en " + dev : "Montant des billets remis en " + dev, "montant", { requis: true, recalc: true, aide: "Multiple de " + B.nb(pasBillets(dev)) + " " + dev + " (plus petite coupure)." }),
      ch("cours", "Cours du jour de la newsletter (" + dev + " pour 1 €)", "cours", { requis: true, recalc: true, aide: "Le cours en vigueur est communiqué dans la newsletter. La banque applique sa marge de " + pourcent(TARIFS.margeBillets) + " (cours de la newsletter " + (sens === "achat" ? "moins" : "plus") + " la marge)." })
    ];
  }
  CHAMPS.achat_devises = function (x, v) {
    var f = [champDevise("achat")], dev = v.devise;
    if (!dev || !BILLETS[dev] || BILLETS[dev] === "non") return f;
    f = f.concat(champsBillets(v, "achat"));
    var eq = eqBillets(v, "achat"), o = [];
    if (BILLETS[dev] === "stock" && (eq === 0 || eq <= SEUILS.devisesStockMax)) o.push(opt("stock", "Remise immédiate en main propre – stock de l'agence (jusqu'à " + B.eur(SEUILS.devisesStockMax) + ") – gratuit"));
    o.push(opt("agence", "Commande – billets à retirer en main propre à l'agence sous 3 jours ouvrés – gratuit"));
    o.push(opt("domicile", "Commande – envoi sécurisé à domicile (valeur déclarée) sous 3 à 5 jours ouvrés – " + eur(TARIFS.changeEnvoi)));
    f.push(ch("remise", "Remise des billets", "select", { requis: true, vide: "Choisir le mode de remise", options: o,
      aide: BILLETS[dev] === "stock" ? "Le dollar, la livre sterling et le franc suisse sont en stock à l'agence jusqu'à " + B.eur(SEUILS.devisesStockMax) + " ; au-delà, les billets se commandent." : "Cette devise n'est pas en stock à l'agence : les billets se commandent à la centrale de billets." }));
    f.push(ch("destination", "Pays de destination", "texte", { requis: true, max: 40 }));
    f.push(ch("objet", "Motif du voyage", "select", { requis: true, vide: "Choisir le motif", options: [opt("tourisme", "Voyage d'agrément"), opt("pro", "Voyage professionnel"), opt("etudes", "Séjour d'études ou stage"), opt("autre", "Autre motif")] }));
    if (eq > SEUILS.devisesJustif) f.push(ch("justif", "Le client a présenté un justificatif du voyage (billet, réservation…) – au-delà de " + B.eur(SEUILS.devisesJustif), "case", { requis: true }));
    return f;
  };
  CHAMPS.vente_devises = function (x, v) {
    var f = [champDevise("vente")], dev = v.devise;
    if (!dev || !BILLETS[dev] || BILLETS[dev] === "non") return f;
    f = f.concat(champsBillets(v, "vente"));
    var eq = eqBillets(v, "vente");
    f.push(ch("billets", "Les billets ont été comptés et contrôlés devant le client (authenticité ; ni déchirés, ni retirés de la circulation)", "case", { requis: true }));
    f.push(ch("origine", "Origine des billets", "select", { requis: true, vide: "Choisir l'origine", options: [opt("reliquat", "Reliquat d'un voyage (billets achetés ou retirés avant le départ)"), opt("cadeau", "Billets reçus de l'étranger (cadeau, famille…)"), opt("autre", "Autre origine (à justifier)")] }));
    if (eq > SEUILS.devisesVenteJustif || v.origine === "autre") f.push(ch("justif", "Le client a justifié l'origine des billets (relevés de retraits à l'étranger, tickets de change…)" + (eq > SEUILS.devisesVenteJustif ? " – au-delà de " + B.eur(SEUILS.devisesVenteJustif) : ""), "case", { requis: true }));
    if (eq > SEUILS.devisesVenteMax) f.push(ch("directeur", "La directrice d'agence a donné son accord (au-delà de " + B.eur(SEUILS.devisesVenteMax) + ")", "case", { requis: true }));
    return f;
  };

  /* Les champs d'une opération : d'abord la vérification d'identité (toujours), puis ceux de l'opération. */
  function champsOp(id, x, v) { return champsIdentite(v, id).concat(CHAMPS[id](x, v)); }

  /* ---------- formulaire ---------- */
  function formulaire(id, c, st, v) {
    var t = PAR_ID[id];
    if (!t) return null;
    v = v || {};
    var x = ctxDe(c, st), champs = champsOp(id, x, v);
    return { type: t, champs: champs, compte: x.cpt };
  }

  /* ---------- contrôles ---------- */
  var CONTROLES = {};
  function E(champ, msg) { return { champ: champ, msg: msg }; }
  function oblig(champs, v, erreurs) {
    champs.forEach(function (f) {
      if (!f.requis) return;
      if (f.type === "case") { if (!coche(v, f.id)) erreurs.push(E(f.id, "Cochez cette case pour continuer.")); }
      else if (f.type === "coches") { if (!Array.isArray(v[f.id]) || !v[f.id].length) erreurs.push(E(f.id, "Cochez au moins un point.")); }
      else if (vide(v, f.id)) erreurs.push(E(f.id, "Renseignez ce champ : " + f.lib.charAt(0).toLowerCase() + f.lib.slice(1) + "."));
    });
  }
  /* Contrôles communs à tous les formulaires : longueur maximale des textes, valeur choisie parmi les propositions des listes. */
  function verifierChamps(champs, v, erreurs) {
    champs.forEach(function (f) {
      var val = v[f.id];
      if ((f.type === "texte" || f.type === "iban") && f.max && txt(val).length > f.max) erreurs.push(E(f.id, "Ce champ est limité à " + f.max + " caractères."));
      else if (f.type === "select" && f.options && !vide(v, f.id) && !f.options.some(function (o) { return String(o.v) === String(val); })) erreurs.push(E(f.id, "Choisissez une des propositions de la liste."));
    });
  }
  function montantOk(v, id, erreurs, mini) {
    var m = lireM(v[id]);
    if (vide(v, id)) return NaN;
    if (isNaN(m)) { erreurs.push(E(id, "Saisissez le montant en euros, par exemple 250 ou 1 250,50.")); return NaN; }
    if (m <= 0) { erreurs.push(E(id, "Le montant doit être supérieur à zéro.")); return NaN; }
    if (mini && m < mini) { erreurs.push(E(id, "Le montant doit être d'au moins " + eur(mini) + ".")); return NaN; }
    return m;
  }
  function resteDispo(x, total, erreurs, champ, sansDecouvert) {
    var bq = x.cpt.bloque || 0, dispo = sansDecouvert ? x.cpt.solde - bq : x.cpt.dispo;
    if (total > dispo + 0.005) erreurs.push(E(champ, "Provision insuffisante : le compte permet de " + (sansDecouvert ? "payer au plus " : "débiter au plus ") + eur(Math.max(0, dispo)) + " (solde " + eur(x.cpt.solde) + (sansDecouvert ? "" : ", découvert autorisé " + eur(x.cpt.decouvert)) + (bq ? ", dont " + eur(bq) + " bloqués par une saisie administrative à tiers détenteur jusqu'au " + B.fmtDate(B.lireYmd(x.cpt.satd.jusqu)) + " (avis " + x.cpt.satd.avis.join(", ") + ")" : "") + ").") );
  }
  function libCourt(s, n) { s = txt(s); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
  function libTitulaire(c) { return c.civ + " " + c.nom.toUpperCase() + " " + c.prenom; }
  /* Nom d'usage, comme dans les documents (« M. Olivier SANCHEZ ») : civilité, prénom, NOM. */
  function nomUsuel(p) { return p.civ + " " + p.prenom + " " + String(p.nom).toUpperCase(); }

  CONTROLES.virement_interne = function (x, v, f, o) {
    var e = o.erreurs, m = montantOk(v, "montant", e), op = dateOp(), ymd = B.ymd(op), r = o.resume;
    var frais = TARIFS.virementInterne, mv = [];
    if (v.dest && v.dest.indexOf("epa:") === 0) {
      var pid = v.dest.slice(4), ep = epargnesVirables(x.c, x.st).filter(function (k) { return k.p === pid; })[0];
      if (!ep) { e.push(E("dest", "Ce compte d'épargne n'est pas ouvert au nom du client.")); }
      else {
        if (!isNaN(m) && ep.plafond && ep.solde + m > ep.plafond + 0.005) e.push(E("montant", "Le plafond de dépôts du " + ep.nom + " serait dépassé : il reste " + eur(Math.max(0, ep.plafond - ep.solde)) + " de place (plafond " + eur(ep.plafond) + ", solde " + eur(ep.solde) + ")."));
        r.push(["Compte débité", "Compte courant n° " + x.cpt.rib.compte + " – IBAN " + x.cpt.ibanLisible]);
        r.push(["Compte crédité", ep.nom + " du client – solde actuel " + eur(ep.solde)]);
        if (!isNaN(m)) mv.push({ ymd: ymd, kind: "virement", lib: "Virement vers " + ep.nom + " – " + libCourt(v.libelle, 40), m: -m });
      }
    } else if (v.dest === "gs") {
      var ci = controleIban(v.iban, "FR");
      if (!ci.ok) e.push(E("iban", ci.msg));
      else if (ci.iban.slice(4, 9) !== RIB.CODE_BANQUE) e.push(E("iban", "Cet IBAN n'est pas celui d'un compte de GS Banque & Assurance : faites un virement SEPA."));
      else {
        var cible = clientParIban(ci.iban);
        if (!cible) e.push(E("iban", "Aucun compte de l'agence ne correspond à cet IBAN. Relisez-le avec le client."));
        else if (cible.id === x.c.id) e.push(E("iban", "C'est le compte courant du client lui-même : choisissez un de ses comptes d'épargne."));
        else {
          var vop = verifierBeneficiaire(ci.iban, v.nom);
          if (vop.code === "non") e.push(E("nom", "Le nom ne correspond pas au titulaire de ce compte. Vérifiez l'IBAN et le nom avec le client."));
          else if (vop.code === "proche") e.push(E("nom", "Le nom est proche mais pas identique à celui du titulaire (« " + vop.titulaire + " »). Faites confirmer l'orthographe par le client et corrigez-la."));
          else {
            o.cible = cible.id;
            r.push(["Compte débité", "Compte courant n° " + x.cpt.rib.compte + " – IBAN " + x.cpt.ibanLisible]);
            r.push(["Compte crédité", "IBAN " + ibanLisible(ci.iban) + " – " + RIB.rib(cible).titulaire + " (client de l'agence)"]);
            if (!isNaN(m)) {
              mv.push({ ymd: ymd, kind: "virement", lib: "Virement émis à " + libTitulaire(cible) + " – " + libCourt(v.libelle, 40), m: -m });
              o.mv2 = [{ ymd: ymd, kind: "virement", lib: "Virement reçu de " + libTitulaire(x.c) + " – " + libCourt(v.libelle, 40), m: m }];
            }
          }
        }
      }
    }
    if (!isNaN(m)) { resteDispo(x, m + frais, e, "montant"); r.push(["Montant", eur(m)]); }
    r.push(["Motif", txt(v.libelle)]); r.push(["Exécution", "Immédiate – le " + B.fmtDate(op)]); r.push(["Frais", frais ? eur(frais) : "Gratuit"]);
    o.frais = frais; o.mv = mv; o.montant = isNaN(m) ? 0 : m;
    if (!isNaN(m) && m > SEUILS.justificatif) o.alertes.push("Au-delà de " + B.eur(SEUILS.justificatif) + " : le justificatif de l'opération est conservé dans le dossier (vigilance contre le blanchiment).");
  };

  CONTROLES.virement_sepa = function (x, v, f, o) {
    var e = o.erreurs, r = o.resume, m = montantOk(v, "montant", e), op = dateOp(), mode = v.mode || "standard";
    var ci = controleIban(v.iban);
    if (!vide(v, "iban")) {
      if (!ci.ok) e.push(E("iban", ci.msg));
      else if (!SEPA[ci.pays]) e.push(E("iban", "Ce pays n'est pas dans la zone SEPA : faites un virement international."));
      else if (ci.pays === "FR" && ci.iban.slice(4, 9) === RIB.CODE_BANQUE) e.push(E("iban", "C'est un compte de GS Banque & Assurance : faites un virement interne (gratuit)."));
      else if (ci.iban === x.cpt.iban) e.push(E("iban", "C'est l'IBAN du compte à débiter."));
    }
    if (!vide(v, "bic") && !bicValide(v.bic)) e.push(E("bic", "Un BIC compte 8 ou 11 caractères (lettres et chiffres), par exemple BDLIFRPPXXX."));
    if (!vide(v, "nom") && mots(v.nom).length < 1) e.push(E("nom", "Saisissez le nom du bénéficiaire."));
    var frais = mode === "instantane" ? TARIFS.virementInstantane : TARIFS.virementSepa, ymd = B.ymd(op), quand = op, statutExec = "Standard – exécuté le " + B.fmtDate(op);
    if (mode === "differe") {
      var d = lireDate(v.date), auj = B.aujourdhui();
      if (!d) { if (!vide(v, "date")) e.push(E("date", "Date d'exécution invalide.")); }
      else if (d <= auj) e.push(E("date", "La date d'exécution doit être postérieure à aujourd'hui. Pour un virement tout de suite, choisissez « Standard »."));
      else if (d > new Date(auj.getFullYear(), auj.getMonth() + SEUILS.differeMois, auj.getDate())) e.push(E("date", "Un virement différé ne peut pas être programmé à plus de " + SEUILS.differeMois + " mois."));
      else { quand = B.estOuvre(d) ? d : B.ouvreSuivant(d); ymd = B.ymd(quand); statutExec = "Différé – exécuté le " + B.fmtDate(quand) + (quand.getTime() !== d.getTime() ? " (jour ouvré suivant la date demandée)" : ""); }
    } else if (mode === "instantane") {
      if (!isNaN(m) && m > SEUILS.instantaneMax) e.push(E("montant", "Un virement instantané est limité à " + eur(SEUILS.instantaneMax) + "."));
      statutExec = "Instantané – exécuté en quelques secondes, le " + B.fmtDate(op);
    }
    var vop = ci.ok && !vide(v, "nom") ? verifierBeneficiaire(ci.iban, v.nom) : null;
    if (vop) {
      if (vop.code === "proche" && !coche(v, "vopOk")) e.push(E("vopOk", "La banque du bénéficiaire propose « " + vop.titulaire + " ». Faites confirmer le nom par le client, puis cochez la case (ou corrigez le nom)."));
      if ((vop.code === "non" || vop.code === "impossible") && !coche(v, "vopOk")) e.push(E("vopOk", vop.code === "non" ? "Le nom ne correspond pas au titulaire du compte. Relisez l'IBAN et le nom avec le client ; il peut maintenir son ordre en le déclarant par écrit." : "La banque du bénéficiaire n'a pas pu confirmer le titulaire. Le client peut maintenir son ordre en le déclarant par écrit."));
      o.vop = vop.code;
    }
    var total = (isNaN(m) ? 0 : m) + frais;
    if (!isNaN(m) && mode !== "differe") resteDispo(x, total, e, "montant");
    if (!isNaN(m) && mode === "differe" && m > x.cpt.dispo + 0.005) o.alertes.push("Le solde actuel (" + eur(x.cpt.solde) + ") ne couvre pas ce virement : le client doit approvisionner son compte avant le " + B.fmtDate(quand) + ".");
    if (vop && vop.code === "proche") o.alertes.push("Correspondance proche : le nom communiqué par la banque du bénéficiaire est « " + vop.titulaire + " ».");
    if (!isNaN(m) && m > SEUILS.justificatif) o.alertes.push("Au-delà de " + B.eur(SEUILS.justificatif) + " : conservez le justificatif de l'opération dans le dossier.");
    r.push(["Compte débité", "Compte courant n° " + x.cpt.rib.compte + " – IBAN " + x.cpt.ibanLisible]);
    r.push(["Bénéficiaire", txt(v.nom)]); r.push(["IBAN du bénéficiaire", ci.ok ? ibanLisible(ci.iban) + (SEPA[ci.pays] ? " (" + SEPA[ci.pays][1] + ")" : "") : txt(v.iban)]);
    if (!vide(v, "bic")) r.push(["BIC", sansEspaces(v.bic)]);
    if (!isNaN(m)) r.push(["Montant", eur(m)]);
    r.push(["Motif", txt(v.libelle)]); r.push(["Exécution", statutExec]);
    if (vop) r.push(["Vérification du bénéficiaire", vop.code === "ok" ? "Correspondance du nom : le titulaire du compte est bien le bénéficiaire" : vop.code === "proche" ? "Correspondance proche (« " + vop.titulaire + " ») – confirmée par le client" : vop.code === "non" ? "Aucune correspondance – ordre maintenu par le client" : "Vérification impossible – ordre maintenu par le client"]);
    r.push(["Frais", eur(frais)]);
    o.frais = frais; o.montant = isNaN(m) ? 0 : m; o.dateOp = ymd;
    if (!isNaN(m)) o.mv = [{ ymd: ymd, kind: "virement", lib: "Virement émis à " + txt(v.nom).toUpperCase() + " – " + libCourt(v.libelle, 40), m: -m }, { ymd: ymd, kind: "frais", lib: "Frais de virement " + (mode === "instantane" ? "instantané" : "SEPA"), m: -frais }];
  };

  CONTROLES.virement_intl = function (x, v, f, o) {
    var e = o.erreurs, r = o.resume, op = dateOp(), ymd = B.ymd(op);
    if (PAYS_REFUSES[v.pays]) { e.push(E("pays", "Opération refusée : la banque n'exécute pas de virement vers ce pays (sanctions internationales). Informez le client et le service conformité.")); return; }
    var pays = PAYS_PAR[v.pays] || null, dev = v.devise || "EUR";
    if (pays && pays.sepa && dev === "EUR") e.push(E("devise", "Un virement en euros vers ce pays est un virement SEPA : faites un « virement en Europe »."));
    if (!vide(v, "adresse") && txt(v.adresse).length < 8) e.push(E("adresse", "Indiquez l'adresse complète du bénéficiaire (rue et ville)."));
    var cpt = sansEspaces(v.compte);
    if (pays && !vide(v, "compte")) {
      if (pays.iban) { var ci = controleIban(v.compte, pays.c); if (!ci.ok) e.push(E("compte", ci.msg)); else cpt = ci.iban; }
      else if (!/^[A-Z0-9]{4,34}$/.test(cpt)) e.push(E("compte", "Le numéro de compte compte 4 à 34 caractères (lettres et chiffres, sans espace ni signe)."));
    }
    if (!vide(v, "bic")) {
      if (!bicValide(v.bic)) e.push(E("bic", "Un BIC compte 8 ou 11 caractères, par exemple QXBKMAMCXXX."));
      else if (pays && sansEspaces(v.bic).slice(4, 6) !== pays.c) e.push(E("bic", "Les lettres 5 et 6 du BIC doivent être le code du pays de la banque (" + pays.c + ")."));
    }
    var m = montantOk(v, "montant", e), cours = NaN, eq = 0;
    if (dev === "EUR") eq = isNaN(m) ? 0 : m;
    else if (!vide(v, "cours")) {
      cours = lireCours(v.cours);
      var d = DEVISES[dev];
      if (isNaN(cours) || cours <= 0) e.push(E("cours", "Saisissez le cours en nombre, par exemple 1,08."));
      else if (d && d.fixe && Math.abs(cours - d.fixe) > 0.001) e.push(E("cours", "Le " + d.lib + " a une parité fixe avec l'euro : 1 € = " + String(d.fixe).replace(".", ",") + " " + dev + "."));
      else if (d && d.min && (cours < d.min || cours > d.max)) e.push(E("cours", "Ce cours paraît faux : le cours se lit en " + dev + " pour 1 € (entre " + String(d.min).replace(".", ",") + " et " + String(d.max).replace(".", ",") + "). Relisez la newsletter."));
      else if (!isNaN(m)) eq = r2(m / cours);
    }
    var eqOk = eq > 0, commission = 0, supplement = v.frais === "OUR" ? TARIFS.intlOur : 0;
    if (eqOk) commission = r2(Math.min(TARIFS.intlMax, Math.max(TARIFS.intlMin, eq * TARIFS.intlTaux)) + TARIFS.intlSwift);
    var frais = r2(commission + supplement), total = r2(eq + frais);
    if (eqOk) resteDispo(x, total, e, "montant");
    if (eqOk && eq > SEUILS.justificatif && vide(v, "precision")) e.push(E("precision", "Précisez l'opération (facture, contrat, lien avec le bénéficiaire) : un justificatif est exigé au-delà de " + B.eur(SEUILS.justificatif) + "."));
    if (v.motif === "autre" && vide(v, "precision")) e.push(E("precision", "Précisez le motif de l'opération."));
    if (eqOk && eq > SEUILS.balancePaiements) o.alertes.push("Au-delà de " + B.eur(SEUILS.balancePaiements) + " : l'opération est déclarée par la banque à la Banque de France (balance des paiements).");
    if (eqOk && eq > SEUILS.justificatif) o.alertes.push("Conservez le justificatif dans le dossier du client.");
    r.push(["Compte débité", "Compte courant n° " + x.cpt.rib.compte + " – IBAN " + x.cpt.ibanLisible]);
    r.push(["Bénéficiaire", txt(v.nom) + (txt(v.adresse) ? " – " + txt(v.adresse) : "") + (pays ? ", " + pays.lib : "")]);
    r.push([pays && pays.iban ? "IBAN du bénéficiaire" : "Compte du bénéficiaire", pays && pays.iban ? ibanLisible(cpt) : cpt]);
    r.push(["BIC / SWIFT", sansEspaces(v.bic)]);
    if (!isNaN(m)) r.push(["Montant à transmettre", B.nb(m).replace(/ /g, " ") + " " + dev]);
    if (dev !== "EUR" && !isNaN(cours) && cours > 0) r.push(["Cours de change appliqué", "1 € = " + String(cours).replace(".", ",") + " " + dev + " (newsletter du jour)"]);
    if (eqOk) r.push(["Contre-valeur débitée", eur(eq)]);
    r.push(["Frais de la banque du bénéficiaire", v.frais === "OUR" ? "À la charge du client (OUR)" : "Partagés (SHA)"]);
    r.push(["Commission et frais de GS Banque & Assurance", eqOk ? eur(frais) : "—"]);
    var mo = MOTIFS_INTL.filter(function (z) { return z.v === v.motif; })[0];
    r.push(["Motif économique", (mo ? mo.lib : "") + (txt(v.precision) ? " – " + txt(v.precision) : "")]);
    r.push(["Exécution", "Le " + B.fmtDate(op) + " ; le bénéficiaire est crédité sous 2 à 4 jours ouvrés selon le pays"]);
    o.frais = frais; o.montant = eq; o.dateOp = ymd; o.devise = dev; o.montantDevise = isNaN(m) ? 0 : m;
    if (eqOk) o.mv = [{ ymd: ymd, kind: "virement", lib: "Virement international à " + txt(v.nom).toUpperCase() + " (" + (isNaN(m) ? "" : B.nb(m).replace(/ /g, " ") + " ") + dev + ")", m: -eq }, { ymd: ymd, kind: "frais", lib: "Commission de virement international", m: -frais }];
  };

  CONTROLES.retrait_espece = function (x, v, f, o) {
    var e = o.erreurs, r = o.resume, m = montantOk(v, "montant", e, SEUILS.retraitMin), op = dateOp(), ymd = B.ymd(op);
    if (!isNaN(m)) {
      if (m % 10 !== 0) e.push(E("montant", "Le montant doit être un multiple de 10 € (billets de 10, 20 et 50 €)."));
      var dejaJour = operations(x.st, x.c.id).filter(function (z) { return z.type === "retrait_espece" && z.statut !== "annulee" && z.dateOp === ymd; }).reduce(function (t, z) { return t + (z.montant || 0); }, 0);
      if (m + dejaJour > SEUILS.retraitJour + 0.005) e.push(E("montant", "Le retrait avec la carte rechargée est limité à " + eur(SEUILS.retraitJour) + " par jour" + (dejaJour ? " (déjà " + eur(dejaJour) + " aujourd'hui)" : "") + "."));
      resteDispo(x, m, e, "montant");
      var cumul = especesMois(x, op);
      if (cumul + m > SEUILS.tracfinMois) o.alertes.push("Les retraits d'espèces de ce mois atteindraient " + eur(cumul + m) + " : au-delà de " + B.eur(SEUILS.tracfinMois) + " par mois, la banque déclare l'opération à Tracfin.");
    }
    var numero = "CR-" + String(1000 + empreinte(x.c.num + "|" + B.ymd(op)) % 9000);
    r.push(["Compte débité", "Compte courant n° " + x.cpt.rib.compte]);
    if (!isNaN(m)) r.push(["Montant chargé sur la carte", eur(m)]);
    r.push(["Carte de retrait de l'agence", numero + " (à rendre à l'agence après le retrait)"]);
    r.push(["Frais", "Gratuit (distributeur de GS Banque & Assurance)"]);
    o.frais = 0; o.montant = isNaN(m) ? 0 : m; o.dateOp = ymd; o.carteAgence = numero;
    if (!isNaN(m)) o.mv = [{ ymd: ymd, kind: "retrait", lib: "Retrait d'espèces au distributeur – carte de retrait de l'agence " + numero, m: -m }];
  };

  CONTROLES.rejet_prelevement = function (x, v, f, o) {
    var e = o.erreurs, r = o.resume, lignes = lignesRejetables(x.c, x.st), l = lignes.filter(function (z) { return cleLigne(z) === v.ligne; })[0], auj = B.aujourdhui();
    if (!vide(v, "ligne") && !l) { e.push(E("ligne", "Ce prélèvement n'est plus contestable (déjà remboursé, ou débité il y a plus de 13 mois).")); return; }
    if (!l) return;
    var jours = B.ecartJours(auj, l.date);
    if (v.consenti === "oui") {
      if (jours > 56) e.push(E("consenti", "Le délai de 8 semaines pour contester un prélèvement autorisé est dépassé (débité il y a " + jours + " jours, le " + B.fmtDate(l.date) + "). Le client doit s'adresser directement au créancier."));
    } else if (v.consenti === "non") {
      var lim = new Date(l.date.getFullYear(), l.date.getMonth() + 13, l.date.getDate());
      if (auj > lim) e.push(E("consenti", "Le délai de 13 mois pour contester un prélèvement non autorisé est dépassé."));
    }
    var motifs = { sans_mandat: "aucun mandat signé", mandat_revoque: "mandat révoqué avant le prélèvement", montant: "prélèvement non conforme au mandat" };
    r.push(["Compte concerné", "Compte courant n° " + x.cpt.rib.compte + " – IBAN " + x.cpt.ibanLisible]);
    r.push(["Prélèvement contesté", B.fmtDate(l.date) + " – " + l.lib + " – " + eur(-l.m)]);
    r.push(["Autorisation", v.consenti === "oui" ? "Prélèvement autorisé par un mandat – demande dans les 8 semaines (débité il y a " + pl(jours, "jour", "jours") + ")" : v.consenti === "non" ? "Prélèvement non autorisé (" + (motifs[v.motif] || "motif à préciser") + ") – demande dans les 13 mois" : ""]);
    r.push(["Remboursement", "Le compte est recrédité de " + eur(-l.m) + " (valeur du jour du débit)"]);
    if (coche(v, "opposition")) r.push(["Prélèvements à venir", "Opposition : les prochains prélèvements de ce créancier seront rejetés"]);
    if (v.consenti === "oui") o.alertes.push("Le client reste redevable de la somme envers le créancier : la banque rembourse, le litige se règle avec le créancier.");
    if (v.consenti === "non") o.alertes.push("Prélèvement non autorisé : conservez la déclaration du client ; la banque peut demander une copie du mandat au créancier.");
    o.frais = 0; o.montant = -l.m; o.dateOp = B.ymd(dateOp());
    o.mv = [{ ymd: B.ymd(dateOp()), kind: "prelevement", lib: "Remboursement du prélèvement du " + B.fmtDate(l.date) + " – " + l.lib, m: -l.m }];
  };

  CONTROLES.opposition_carte = function (x, v, f, o) {
    var e = o.erreurs, r = o.resume, ks = cartes(x.c, x.st), k = ks.filter(function (z) { return z.p === v.carte && z.etat !== "opposee"; })[0], op = dateOp(), ymd = B.ymd(op), auj = B.aujourdhui();
    if (!vide(v, "carte") && !k) { e.push(E("carte", "Cette carte est déjà en opposition ou n'est pas détenue par le client.")); return; }
    var quand = lireDate(v.quand);
    if (!vide(v, "quand")) { if (!quand) e.push(E("quand", "Date invalide.")); else if (quand > auj) e.push(E("quand", "La date ne peut pas être dans le futur.")); }
    if (!vide(v, "circonstances") && txt(v.circonstances).length < 10) e.push(E("circonstances", "Décrivez les circonstances en une phrase au moins."));
    var motifs = { perte: "Perte", vol: "Vol", fraude: "Utilisation frauduleuse", abusive: "Utilisation abusive" };
    var fabrication = v.nouvelle === "oui" ? (v.motif === "fraude" ? 0 : TARIFS.refabricationCarte) : 0;
    var remise = v.nouvelle === "oui" ? v.remise : "", envoi = remise === "domicile" ? TARIFS.carteEnvoi : 0;
    if (k && remise === "stock") e.push(E("remise", "Une carte n'est jamais remise depuis un stock : elle est commandée, puis retirée à l'agence ou envoyée à domicile."));
    var mv = [];
    if (k) {
      r.push(["Carte bloquée", k.nom]);
      r.push(["Motif", motifs[v.motif] || ""]);
      if (v.motif === "abusive") r.push(["Fichage", "Inscription au FCC (retrait de carte pour utilisation abusive) pendant 2 ans"]);
      r.push(["Constaté le", quand ? B.fmtDate(quand) + " – " + txt(v.lieu) : ""]);
      r.push(["Circonstances", txt(v.circonstances)]);
      if (v.motif === "vol" || v.motif === "fraude") r.push(["Plainte", coche(v, "plainte") ? "Déposée, ou à déposer sous 48 heures" : "Non déposée"]);
      r.push(["Nouvelle carte", v.nouvelle === "oui" ? ("Commandée – " + libRemiseCarte(remise)) + (fabrication ? " – fabrication " + eur(fabrication) : " – gratuite") : "Non commandée"]);
      if (fabrication) mv.push({ ymd: ymd, kind: "frais", lib: "Frais de refabrication de carte – " + k.nom, m: -fabrication });
      if (envoi) mv.push({ ymd: ymd, kind: "frais", lib: "Envoi à domicile de la nouvelle carte en recommandé", m: -envoi });
    }
    if (v.motif === "vol" && !coche(v, "plainte")) o.alertes.push("Vol : demandez au client de déposer plainte et de remettre le récépissé sous 48 heures : la copie de la plainte est à joindre au kit de contestation.");
    if (v.motif === "fraude" && !coche(v, "plainte")) o.alertes.push("Fraude : le dépôt de plainte est conseillé au client.");
    if (v.motif === "abusive") o.alertes.push("Utilisation abusive : l'opposition entraîne l'inscription du titulaire au fichier central des chèques (FCC) de la Banque de France (fichier des retraits de cartes bancaires), pendant 2 ans. Informez-en le client avant de valider : la banque l'avertit aussi par écrit.");
    if (v.motif === "abusive") o.alertes.push("Utilisation abusive : les opérations faites par une personne à qui le client a confié sa carte et son code restent en principe à sa charge ; elles ne se contestent pas. La carte est bloquée pour éviter de nouvelles opérations.");
    else if (v.motif) o.alertes.push("L'opposition bloque la carte mais ne rembourse rien : les paiements ou retraits que le client ne reconnaît pas se contestent par une autre opération, liée à celle-ci (« Contestation d'opérations par carte », avec le kit signé par le client).");
    o.frais = r2(fabrication + envoi); o.montant = 0; o.dateOp = ymd; o.mv = mv;
  };

  CONTROLES.contestation_carte = function (x, v, f, o) {
    var e = o.erreurs, r = o.resume, ymd = B.ymd(dateOp()), auj = B.aujourdhui(), perdVol = v.situation === "perdue" || v.situation === "volee";
    var k = cartes(x.c, x.st).filter(function (z) { return z.p === v.carte; })[0];
    if (!vide(v, "carte") && !k) { e.push(E("carte", "Cette carte n'est pas détenue par le client.")); return; }
    var opp = k ? oppositionDe(x.st, x.c.id, k.p) : null, dOpp = opp ? B.lireYmd(opp.dateExec) : null;
    if (k && perdVol && !opp) e.push(E("carte", "La carte n'est pas en opposition : faites d'abord l'opposition (perte ou vol). La date d'opposition figure sur le kit."));
    if (opp && opp.v.motif === "abusive") e.push(E("carte", "La carte a été mise en opposition pour utilisation abusive (un proche à qui le client l'avait confiée) : ces opérations ne se contestent pas."));
    var constat = lireDate(v.constat);
    if (perdVol && !vide(v, "constat")) {
      if (!constat) e.push(E("constat", "Date invalide."));
      else if (constat > auj) e.push(E("constat", "La date ne peut pas être dans le futur."));
      else if (dOpp && constat > dOpp) e.push(E("constat", "La date du constat (" + B.fmtDate(constat) + ") est postérieure à l'opposition du " + B.fmtDate(dOpp) + " : relisez les dates avec le client."));
    }
    if (!vide(v, "circonstances") && txt(v.circonstances).length < 10) e.push(E("circonstances", "Décrivez les circonstances en une phrase au moins."));
    if (v.situation === "possession" && v.etranger === "oui") {
      var du = lireDate(v.etrDu), au = lireDate(v.etrAu);
      if (!vide(v, "etrDu") && !du) e.push(E("etrDu", "Date invalide."));
      if (!vide(v, "etrAu") && !au) e.push(E("etrAu", "Date invalide."));
      if (du && au && au < du) e.push(E("etrAu", "La fin du séjour ne peut pas précéder son début."));
      if (au && au > auj) e.push(E("etrAu", "La date ne peut pas être dans le futur."));
    }
    var cles = Array.isArray(v.contestees) ? v.contestees : [], poss = lignesContestables(x.c, x.st), cont = poss.filter(function (z) { return cles.indexOf(cleLigne(z)) >= 0; });
    if (cles.length > LIGNES_KIT) e.push(E("contestees", "Le kit ne détaille que " + LIGNES_KIT + " opérations : faites deux contestations (" + cles.length + " cochées)."));
    else if (cles.length && cont.length !== cles.length) e.push(E("contestees", "Une des opérations cochées ne peut plus être contestée : déjà contestée, ou faite il y a plus de " + MOIS_CONTESTATION + " mois."));
    if (perdVol && v.derniere && v.derniere !== "aucune" && cles.indexOf(v.derniere) >= 0) e.push(E("contestees", "La dernière opération faite par le client ne peut pas figurer parmi les opérations qu'il conteste."));
    var total = r2(cont.reduce(function (t, z) { return t - z.m; }, 0)), franchise = 0, avantOpp = 0;
    if (perdVol && cont.length) {
      avantOpp = r2(cont.filter(function (z) { return !dOpp || z.date <= dOpp; }).reduce(function (t, z) { return t - z.m; }, 0));
      franchise = Math.min(FRANCHISE_PERTE_VOL, avantOpp);       /* franchise légale : perte ou vol, opérations faites avant l'opposition seulement */
    }
    var derniere = perdVol && v.derniere && v.derniere !== "aucune" ? lignesReleve(x.c).filter(function (l) { return cleLigne(l) === v.derniere; })[0] : null;
    if (derniere) {
      var anterieures = cont.filter(function (z) { return z.date < derniere.date; });
      if (anterieures.length) e.push(E("contestees", "L'opération du " + B.fmtDate(anterieures[0].date) + " est antérieure à la dernière opération faite par le client (" + B.fmtDate(derniere.date) + ") : elle ne peut pas avoir été faite par la personne qui a pris ou trouvé la carte."));
    }
    if (k) {
      r.push(["Carte", k.nom + " n° " + numeroCarte(x.c, k.p)]);
      r.push(["Situation", SITUATIONS_CONTESTATION[v.situation] || ""]);
      r.push(["Opposition", opp ? "Enregistrée le " + B.fmtDate(dOpp) + " (" + opp.ref + ", motif : " + MOTIFS_OPPOSITION[opp.v.motif] + ")" : "Pas encore enregistrée – à faire pour utilisation frauduleuse"]);
      if (perdVol) {
        r.push(["Constaté le", constat ? B.fmtDate(constat) : ""]);
        r.push(["Code confidentiel", txt(v.pin)]);
        r.push(["Dernière opération du client", v.derniere === "aucune" ? "Aucune opération récente" : derniere ? libLigne(derniere) : ""]);
      }
      if (v.situation === "possession" && v.etranger) r.push(["Séjour à l'étranger (6 derniers mois)", v.etranger === "oui" ? "Oui – du " + (lireDate(v.etrDu) ? B.fmtDate(lireDate(v.etrDu)) : "…") + " au " + (lireDate(v.etrAu) ? B.fmtDate(lireDate(v.etrAu)) : "…") + " – " + txt(v.etrPays) : "Non"]);
      if (v.situation) {
        r.push(["Circonstances", txt(v.circonstances)]);
        r.push(["Plainte", coche(v, "plainte") ? "Copie du dépôt de plainte " + (v.situation === "volee" ? "jointe au kit" : "déposée") : v.situation === "volee" ? "" : "Non déposée"]);
      }
      if (cont.length) {
        r.push(["Opérations contestées", pl(cont.length, "opération", "opérations") + " pour " + eur(total) + (cont.length > LIGNES_PAGE1 ? " – kit avec l'annexe 3" : "")]);
        r.push(["Remboursement au client", eur(total - franchise) + (franchise ? " (" + eur(total) + " moins la franchise légale de " + eur(franchise) + ")" : "")]);
      }
      r.push(["Déclaration sur l'honneur", coche(v, "honneur") ? "Le client n'a ni effectué ni autorisé ces opérations" : ""]);
    }
    cont.forEach(function (z) { o.mv.push({ ymd: ymd, kind: "carte", lib: "Remboursement opération contestée du " + B.fmtDate(z.date) + " – " + z.lib, m: -z.m }); });
    if (franchise) o.mv.push({ ymd: ymd, kind: "carte", lib: "Franchise légale sur opérations par carte perdue ou volée (avant opposition)", m: -franchise });
    if (cont.length) {
      o.alertes.push("Remboursement immédiat, et au plus tard à la fin du premier jour ouvrable suivant (article L133-18 du Code monétaire et financier), sauf si la banque a de bonnes raisons de soupçonner une fraude du client : elle le signale alors par écrit à la Banque de France.");
      if (perdVol) o.alertes.push(franchise ? "Carte " + (v.situation === "volee" ? "volée" : "perdue") + " : avant l'opposition, le client supporte les pertes dans la limite de " + eur(FRANCHISE_PERTE_VOL) + " (franchise de " + eur(franchise) + " sur " + eur(avantOpp) + " d'opérations faites avant l'opposition) ; après l'opposition, il ne supporte plus rien."
        : "Toutes les opérations contestées sont postérieures à l'opposition : aucune franchise, le client est remboursé en totalité.");
      else o.alertes.push("Carte en possession du client : pas de franchise de " + eur(FRANCHISE_PERTE_VOL) + " (elle ne concerne que la perte et le vol).");
      if (cont.length > LIGNES_PAGE1) o.alertes.push("Plus de " + LIGNES_PAGE1 + " opérations : le kit comprend l'annexe 3 (suite du détail des opérations), à signer aussi.");
    }
    var pinTxt = txt(v.pin).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (perdVol && /carte|portefeuille|sac|papier|note|ecrit|telephone|portable/.test(pinTxt) && !/jamais|nulle part|tete|memoire|memoris|pas note|pas ecrit/.test(pinTxt)) o.alertes.push("Le code confidentiel était noté ou rangé avec la carte : la banque peut y voir une négligence grave, mais c'est à elle de la prouver. Le dossier est instruit par le Service Moyens de Paiement ; consignez la réponse du client telle quelle.");
    if (v.situation === "possession" && !opp) o.alertes.push("La carte n'est pas encore bloquée : après cette contestation, enregistrez l'opposition pour utilisation frauduleuse (opération « Opposition sur une carte »).");
    if (v.situation === "possession" && !coche(v, "plainte")) o.alertes.push("Fraude : le dépôt de plainte est conseillé (il n'est pas exigé par le kit).");
    if (cont.length) o.alertes.push("Le kit signé" + (v.situation === "volee" ? ", avec la copie de la plainte," : "") + " est transmis au Service Moyens de Paiement par courriel ou par courrier : un dossier incomplet est retourné.");
    o.frais = 0; o.montant = r2(total - franchise); o.dateOp = ymd;
    o.lignes = cont.map(function (z) { return { ymd: z.ymd, lib: z.lib, m: z.m }; });
    o.opposition = opp ? opp.ref : ""; o.oppositionDate = opp ? opp.dateExec : "";
  };

  CONTROLES.opposition_cheque = function (x, v, f, o) {
    var e = o.erreurs, r = o.resume, op = dateOp(), ymd = B.ymd(op), auj = B.aujourdhui(), motifs = { perte: "Perte", vol: "Vol", fraude: "Utilisation frauduleuse", collective: "Procédure collective du bénéficiaire" };
    if (v.motif === "litige") { e.push(E("motif", "Opposition refusée : un litige avec le bénéficiaire n'est pas un motif d'opposition permis par la loi (article L131-35 du Code monétaire et financier). Faire opposition pour ce motif est une infraction (article L163-2). Le client doit régler le litige avec le bénéficiaire.")); }
    var quand = lireDate(v.quand);
    if (!vide(v, "quand")) { if (!quand) e.push(E("quand", "Date invalide.")); else if (quand > auj) e.push(E("quand", "La date ne peut pas être dans le futur.")); }
    if (!vide(v, "circonstances") && txt(v.circonstances).length < 10) e.push(E("circonstances", "Décrivez les circonstances en une phrase au moins."));
    var chiffres = /^\d{7}$/;
    if (v.portee === "chequier") {
      if (!vide(v, "premier") && !chiffres.test(txt(v.premier))) e.push(E("premier", "Le numéro de formule compte 7 chiffres."));
      if (!vide(v, "dernier") && !chiffres.test(txt(v.dernier))) e.push(E("dernier", "Le numéro de formule compte 7 chiffres."));
      if (chiffres.test(txt(v.premier)) && chiffres.test(txt(v.dernier)) && +v.dernier < +v.premier) e.push(E("dernier", "La dernière formule doit être postérieure à la première."));
      if (chiffres.test(txt(v.premier)) && chiffres.test(txt(v.dernier)) && +v.dernier - +v.premier >= 100) e.push(E("dernier", "Une opposition porte sur 100 formules au plus : faites-en une seconde."));
    } else {
      if (!vide(v, "numero") && !chiffres.test(txt(v.numero))) e.push(E("numero", "Le numéro du chèque compte 7 chiffres."));
      if (!vide(v, "montant")) { var mt = lireM(v.montant); if (isNaN(mt) || mt <= 0) e.push(E("montant", "Montant invalide.")); }
      if (!vide(v, "emission") && !lireDate(v.emission)) e.push(E("emission", "Date invalide."));
    }
    /* Un chèque (ou une formule d'un chéquier) déjà frappé d'opposition ne l'est pas deux fois. */
    function plage(z) { return z.portee === "chequier" ? [+txt(z.premier), +txt(z.dernier)] : [+txt(z.numero), +txt(z.numero)]; }
    if (chiffres.test(v.portee === "chequier" ? txt(v.premier) : txt(v.numero))) {
      var mienne = plage(v);
      operations(x.st, x.c.id).filter(function (z) { return z.type === "opposition_cheque" && z.statut !== "annulee" && z.v; }).forEach(function (z) {
        var autre = plage(z.v);
        if (mienne[0] <= autre[1] && autre[0] <= mienne[1]) e.push(E(v.portee === "chequier" ? "premier" : "numero", "Ce chèque est déjà frappé d'opposition (opération " + z.ref + ")."));
      });
    }
    var frais = v.motif === "fraude" ? 0 : TARIFS.oppositionCheque;
    r.push(["Compte concerné", "Compte courant n° " + x.cpt.rib.compte]);
    r.push([v.portee === "chequier" ? "Formules bloquées" : "Chèque bloqué", v.portee === "chequier" ? "n° " + txt(v.premier) + " à " + txt(v.dernier) : "n° " + txt(v.numero) + (txt(v.montant) ? " – " + eur(lireM(v.montant) || 0) : "") + (txt(v.beneficiaire) ? " – à l'ordre de " + txt(v.beneficiaire) : "") + (lireDate(v.emission) ? " – émis le " + B.fmtDate(lireDate(v.emission)) : "")]);
    r.push(["Motif", motifs[v.motif] || ""]); r.push(["Constaté le", quand ? B.fmtDate(quand) : ""]); r.push(["Circonstances", txt(v.circonstances)]);
    if (v.motif === "vol" || v.motif === "fraude") r.push(["Plainte", coche(v, "plainte") ? "Déposée, ou à déposer sous 48 heures" : "Non déposée"]);
    r.push(["Frais d'opposition", frais ? eur(frais) : "Gratuit"]);
    if (v.motif === "vol" && !coche(v, "plainte")) o.alertes.push("Vol : demandez au client de déposer plainte et de remettre le récépissé.");
    if (v.motif === "perte") o.alertes.push("Si le chèque a été perdu par son bénéficiaire, le client peut lui faire remplir une lettre de désistement (document à remplir, dans « Courriers et documents »).");
    if (v.motif === "collective") o.alertes.push("Procédure collective : demandez la copie du jugement d'ouverture ; l'opposition est confirmée par écrit.");
    o.frais = frais; o.dateOp = ymd; o.montant = 0;
    o.mv = frais ? [{ ymd: ymd, kind: "frais", lib: "Frais d'opposition sur chèque", m: -frais }] : [];
  };

  CONTROLES.plafond_carte = function (x, v, f, o) {
    var e = o.erreurs, r = o.resume, k = cartes(x.c, x.st).filter(function (z) { return z.p === v.carte && z.etat === "active"; })[0], auj = B.aujourdhui();
    if (!vide(v, "carte") && !k) { e.push(E("carte", "Cette carte n'est pas active : le plafond ne peut pas être relevé.")); return; }
    if (!k) return;
    if (k.sys) { e.push(E("carte", "Cette carte est à autorisation systématique (" + (rangGamme(k.p) < 0 && k.p === "VELE" ? "carte à contrôle de solde" : "offre clientèle fragile") + ") : ses plafonds ne se relèvent pas.")); return; }
    if (k.p === "CRET" && !vide(v, "pai") && lireM(v.pai) > 0) e.push(E("pai", "La carte de retrait ne permet pas de payer chez les commerçants : le plafond de paiement reste à zéro."));
    var pai = lireM(v.pai), ret = lireM(v.ret), temp = v.duree !== "permanent", coef = temp ? COEF.temporaire : COEF.permanent;
    if (!vide(v, "pai")) { if (isNaN(pai) || pai < 0) e.push(E("pai", "Saisissez un montant en euros.")); else if (pai > k.std.pai * coef + 0.005) e.push(E("pai", "Le plafond de paiement ne peut pas dépasser " + eur(k.std.pai * coef) + " (" + String(coef).replace(".", ",") + " fois " + eur(k.std.pai) + ")."));
      else if (pai < k.paiEff && k.p !== "CRET") e.push(E("pai", "Le nouveau plafond doit être supérieur au plafond actuel (" + eur(k.paiEff) + ").")); }
    if (!vide(v, "ret")) { if (isNaN(ret) || ret < 0) e.push(E("ret", "Saisissez un montant en euros.")); else if (ret > k.std.ret * coef + 0.005) e.push(E("ret", "Le plafond de retrait ne peut pas dépasser " + eur(k.std.ret * coef) + " (" + String(coef).replace(".", ",") + " fois " + eur(k.std.ret) + ")."));
      else if (ret < k.retEff) e.push(E("ret", "Le nouveau plafond doit être supérieur au plafond actuel (" + eur(k.retEff) + ").")); }
    if (!isNaN(pai) && !isNaN(ret) && pai <= k.paiEff && ret <= k.retEff && k.p !== "CRET") e.push(E("pai", "Augmentez au moins un des deux plafonds."));
    if (temp) {
      var fin = lireDate(v.fin);
      if (!vide(v, "fin")) {
        if (!fin) e.push(E("fin", "Date invalide."));
        else if (fin <= auj) e.push(E("fin", "La fin du relèvement doit être postérieure à aujourd'hui."));
        else if (B.ecartJours(fin, auj) > DUREE_TEMP_MAX) e.push(E("fin", "Un relèvement temporaire dure " + DUREE_TEMP_MAX + " jours au plus (jusqu'au " + B.fmtDate(B.plusJours(auj, DUREE_TEMP_MAX)) + ")."));
      }
    } else {
      var inc = x.c.inc.filter(function (i) { return i.j <= 365; });
      if (inc.length) e.push(E("duree", "Un relèvement permanent suppose un compte sans incident depuis 12 mois : ce n'est pas le cas. Un relèvement temporaire reste possible."));
      if (x.c.cpt.p === "OCF") e.push(E("duree", "Clients de l'offre clientèle fragile : pas de relèvement permanent."));
    }
    var raisons = { voyage: "Voyage", achat: "Achat important", travaux: "Travaux ou déménagement", autre: "Autre" };
    r.push(["Carte", k.nom]);
    r.push(["Plafond de paiement (30 jours)", eur(k.paiEff) + " → " + (isNaN(pai) ? "?" : eur(pai))]);
    r.push(["Plafond de retrait (7 jours)", eur(k.retEff) + " → " + (isNaN(ret) ? "?" : eur(ret))]);
    r.push(["Durée", temp ? "Temporaire – jusqu'au " + (lireDate(v.fin) ? B.fmtDate(lireDate(v.fin)) : "?") + ", puis retour aux plafonds habituels" : "Permanent"]);
    r.push(["Raison", raisons[v.raison] || ""]);
    r.push(["Frais", "Gratuit"]);
    if (temp) o.alertes.push("Les plafonds reviennent automatiquement aux niveaux habituels à la fin du relèvement.");
    o.frais = 0; o.montant = 0; o.dateOp = B.ymd(dateOp()); o.mv = [];
  };

  CONTROLES.montee_gamme = function (x, v, f, o) {
    var e = o.erreurs, r = o.resume, k = cartes(x.c, x.st).filter(function (z) { return z.p === v.carte && z.etat === "active"; })[0];
    if (!vide(v, "carte") && !k) { e.push(E("carte", "Cette carte n'est pas active chez le client.")); return; }
    if (!k) return;
    if (rangGamme(k.p) < 0 || k.sys) { e.push(E("carte", "Cette carte n'a pas de gamme supérieure.")); return; }
    if (x.c.conv) { e.push(E("carte", "La carte fait partie de la convention de compte du client : le changement de carte passe par un avenant à la convention (voir la directrice).")); return; }
    if (vide(v, "vers")) return;
    if (!(rangGamme(v.vers) > rangGamme(k.p))) { e.push(E("vers", "Choisissez une carte de gamme supérieure à la carte actuelle.")); return; }
    var ev = K.verdictClient(x.c, v.vers, x.st), conf = K.aConfirmer(ev);
    if (ev.verdict === "detenu") e.push(E("vers", "Le client détient déjà " + nomCourtProduit(v.vers) + "."));
    else if (ev.verdict === "non") e.push(E("vers", "Le client n'est pas éligible à " + nomCourtProduit(v.vers) + " : " + ev.motifs.join(" ")));
    else if (conf.length) {
      var ok = Array.isArray(v.confirmees) ? v.confirmees.length : 0;
      if (ok < conf.length) e.push(E("confirmees", "Confirmez chacun des " + conf.length + " points avec le client."));
    }
    var nouvelle = cotisationCarte(v.vers), ancienne = cotisationCarte(k.p), ymd = B.ymd(dateOp());
    var remise = v.remise, envoi = remise === "domicile" ? TARIFS.carteEnvoi : 0;
    if (remise === "stock") e.push(E("remise", "Une carte n'est jamais remise depuis un stock : elle est commandée, puis retirée à l'agence ou envoyée à domicile."));
    /* Cotisation de l'ancienne carte remboursée au prorata des mois entiers restants (mois depuis le dernier anniversaire de la carte). */
    var ouvDays = (x.c.cartes.filter(function (z) { return z.p === k.p; })[0] || {}).ouvert;
    var restants = 0;
    if (ouvDays != null) { var depuis = ouvDays % 365; restants = Math.max(0, 12 - Math.floor(depuis / 30.4375) - 1); }
    else restants = 12;
    var rembourse = r2(ancienne * restants / 12);
    var mv = [{ ymd: ymd, kind: "frais", lib: "Cotisation annuelle " + nomCourtProduit(v.vers), m: -nouvelle }];
    if (rembourse > 0) mv.push({ ymd: ymd, kind: "frais", lib: "Remboursement de cotisation " + nomCourtProduit(k.p) + " (" + pl(restants, "mois restant", "mois restants") + ")", m: rembourse });
    if (envoi) mv.push({ ymd: ymd, kind: "frais", lib: "Envoi à domicile de la nouvelle carte en recommandé", m: -envoi });
    resteDispo(x, nouvelle - rembourse + envoi, e, "vers");
    r.push(["Carte actuelle", k.nom + " – cotisation " + eur(ancienne) + " par an"]);
    r.push(["Carte demandée", nomCourtProduit(v.vers) + " – cotisation " + eur(nouvelle) + " par an"]);
    r.push(["Plafonds de la nouvelle carte", "Paiement " + eur(PLAFONDS_CARTE[v.vers].pai) + " par 30 jours, retrait " + eur(PLAFONDS_CARTE[v.vers].ret) + " par 7 jours"]);
    if (v.vers !== "VJEU") r.push(["Débit", v.debit === "differe" ? "Différé (en fin de mois)" : "Immédiat"]);
    r.push(["Cotisation débitée", eur(nouvelle)]);
    if (rembourse > 0) r.push(["Remboursement de l'ancienne cotisation", eur(rembourse) + " (" + pl(restants, "mois entier restant", "mois entiers restants") + " sur 12)"]);
    r.push(["Remise de la nouvelle carte", remise === "domicile" ? "Carte commandée, envoyée à domicile en recommandé sous 7 à 9 jours ouvrés – " + eur(envoi) + " ; l'ancienne carte est à détruire dès la réception de la nouvelle" : "Carte commandée, à retirer à l'agence sous 5 à 7 jours ouvrés – gratuit ; l'ancienne carte est à détruire dès la remise de la nouvelle"]);
    o.alertes.push("La montée en gamme est enregistrée comme une souscription (vente à l'accueil).");
    o.frais = r2(nouvelle - rembourse + envoi); o.montant = 0; o.dateOp = ymd; o.mv = mv; o.verdictCarte = ev.verdict;
  };

  /* Chèques de banque compris dans l'offre du client : convention (quantité par an) ou offre clientèle fragile (2 par mois). */
  function chequesInclus(c, st) {
    var ctx = K.contexte(c, st), auj = B.aujourdhui(), utilises = 0, quota = 0, lib = "";
    if (c.cpt.p === "OCF") {
      quota = 2; lib = "offre clientèle fragile : 2 chèques de banque par mois";
      operations(st, c.id).forEach(function (o) { if (o.type === "cheque_banque" && o.statut === "executee" && B.indexMois(B.lireYmd(o.dateOp)) === B.indexMois(auj)) utilises++; });
    } else if (ctx.conv) {
      var cv = PR.conventions.filter(function (z) { return z.id === ctx.conv; })[0], sv = cv ? cv.services.filter(function (z) { return z[0] === "cheque"; })[0] : null;
      if (sv) {
        quota = sv[1]; lib = "convention : " + sv[1] + " chèques de banque par an";
        operations(st, c.id).forEach(function (o) { if (o.type === "cheque_banque" && o.statut === "executee" && B.lireYmd(o.dateOp).getFullYear() === auj.getFullYear()) utilises++; });
      }
    }
    return { quota: quota, utilises: utilises, restant: Math.max(0, quota - utilises), lib: lib };
  }
  CONTROLES.cheque_banque = function (x, v, f, o) {
    var e = o.erreurs, r = o.resume, m = montantOk(v, "montant", e, 1), ymd = B.ymd(dateOp()), inc = chequesInclus(x.c, x.st);
    if (!isNaN(m) && m > SEUILS.chequeBanqueMax) e.push(E("montant", "Au-delà de " + eur(SEUILS.chequeBanqueMax) + ", utilisez un virement."));
    if (!vide(v, "nom") && mots(v.nom).length < 1) e.push(E("nom", "Saisissez le nom du bénéficiaire."));
    var pret = coche(v, "pret");
    if (pret && !(x.c.cre && x.c.cre.length)) e.push(E("pret", "Le client n'a pas de prêt en cours chez GS Banque & Assurance : la commission de " + eur(TARIFS.chequeBanque) + " est due."));
    var frais = inc.restant > 0 || (pret && x.c.cre && x.c.cre.length) ? 0 : TARIFS.chequeBanque;
    if (!isNaN(m)) resteDispo(x, m + frais, e, "montant", true);
    var numero = "CB" + String(1000000 + empreinte(x.c.num + "|" + (v.nom || "") + "|" + (v.montant || "") + "|" + ymd) % 9000000).slice(-7);
    r.push(["Compte débité", "Compte courant n° " + x.cpt.rib.compte]);
    r.push(["À l'ordre de", txt(v.nom)]);
    if (!isNaN(m)) r.push(["Montant", eur(m)]);
    var objets = { vehicule: "Achat d'un véhicule", caution: "Dépôt de garantie ou caution", acompte: "Acompte", scolarite: "Frais de scolarité", immo: "Achat immobilier", autre: "Autre" };
    r.push(["Objet", objets[v.objet] || ""]);
    r.push(["Chèque n°", numero]);
    r.push(["Commission", frais ? eur(frais) : pret && inc.restant <= 0 ? "Non perçue : chèque financé par un prêt de la banque" : "Comprise dans l'offre du client (" + inc.lib + ")"]);
    r.push(["Validité", "Payable pendant 1 an et 8 jours à compter de l'émission"]);
    if (inc.quota) o.alertes.push("Offre du client : " + inc.lib + " – " + inc.restant + " restant" + (inc.restant > 1 ? "s" : "") + " avant celui-ci.");
    o.frais = frais; o.montant = isNaN(m) ? 0 : m; o.dateOp = ymd; o.numeroCheque = numero;
    if (!isNaN(m)) { o.mv = [{ ymd: ymd, kind: "cheque", lib: "Chèque de banque n° " + numero + " – à l'ordre de " + txt(v.nom).toUpperCase(), m: -m }]; if (frais) o.mv.push({ ymd: ymd, kind: "frais", lib: "Commission de chèque de banque", m: -frais }); }
  };

  CONTROLES.commande_chequier = function (x, v, f, o) {
    var e = o.erreurs, r = o.resume, ymd = B.ymd(dateOp()), auj = B.aujourdhui();
    if (x.c.cpt.p === "OCF") e.push(E("nb", "L'offre clientèle fragile ne comprend pas de chéquier (elle prévoit des chèques de banque) : proposez un chèque de banque."));
    if (x.c.cpt.p === "DAC" || x.c.dac) e.push(E("nb", "Le compte droit au compte (DAC) ne comprend pas de chéquier (les services bancaires de base prévoient des chèques de banque) : proposez un chèque de banque."));
    else if (x.c.cpt.p !== "CPT" && x.c.cpt.p !== "JEUNE" && x.c.cpt.p !== "OCF") e.push(E("nb", "Ce compte ne permet pas de chéquier."));
    if (x.c.age < 18) e.push(E("nb", "Le client est mineur : pas de chéquier."));
    if (x.c.restr && x.c.restr.cheque) e.push(E("nb", "Le client est inscrit au fichier central des chèques (consultation de la Banque de France faite à l'ouverture de son compte) : aucun chéquier ne peut lui être remis ; proposez un chèque de banque."));
    var recents = operations(x.st, x.c.id).filter(function (z) { return z.type === "commande_chequier" && z.statut !== "annulee" && B.ecartJours(auj, B.lireYmd(z.date)) < SEUILS.chequierDelaiJours; });
    if (recents.length) e.push(E("nb", "Un chéquier a déjà été commandé le " + B.fmtDate(B.lireYmd(recents[0].date)) + ". Un nouveau chéquier ne peut pas être commandé dans les " + SEUILS.chequierDelaiJours + " jours."));
    var mode = v.remise, frais = mode === "domicile" ? TARIFS.chequierEnvoi : 0, nb = mode === "stock" ? CHEQUIER_STOCK_NB : (+v.nb || 25);
    if (mode === "stock" && stockRestant(x.st, "chequier") < 1) e.push(E("remise", "Le stock de chéquiers de dépannage de l'agence est épuisé : commandez le chéquier (retrait en main propre ou envoi à domicile)."));
    if (frais) resteDispo(x, frais, e, "remise");
    var debut = 1000000 + empreinte(x.c.num + "|chequier|" + ymd) % 8000000, fin = debut + nb - 1;
    r.push(["Compte", "Compte courant n° " + x.cpt.rib.compte]);
    r.push(["Chéquier", pl(nb, "formule", "formules") + " n° " + debut + " à " + fin + ", préimprimées « barrées » (paiement sur un compte uniquement)"]);
    r.push(["Remise", mode === "stock" ? "Immédiate, en main propre contre signature – chéquier de dépannage pris dans le stock de l'agence – gratuit" : mode === "domicile" ? "Envoi à domicile en lettre recommandée – " + eur(frais) : "Commandé – retrait en main propre à l'agence sous 5 jours ouvrés, contre signature – gratuit"]);
    r.push(["Fichier central des chèques", coche(v, "fcc") ? "Consulté : le client n'est pas inscrit" : "Non consulté"]);
    o.alertes.push(mode === "stock" ? "Chéquier de dépannage de " + CHEQUIER_STOCK_NB + " formules remis tout de suite. Après cette remise, il en reste " + Math.max(0, stockRestant(x.st, "chequier") - 1) + " en stock à l'agence."
      : "Un chéquier se remet en main propre contre signature, ou par envoi recommandé (avec frais).");
    o.frais = frais; o.montant = 0; o.dateOp = ymd; o.formules = [debut, fin];
    o.mv = frais ? [{ ymd: ymd, kind: "frais", lib: "Frais d'envoi de chéquier en recommandé", m: -frais }] : [];
  };

  /* Cours de la newsletter pour des billets : mêmes contrôles de vraisemblance que pour un virement international. */
  function verifierCoursBillets(v, dev, e) {
    if (vide(v, "cours")) return NaN;
    var c = lireCours(v.cours), d = DEVISES[dev];
    if (isNaN(c) || c <= 0) { e.push(E("cours", "Saisissez le cours en nombre, par exemple 1,08.")); return NaN; }
    if (d && d.fixe && Math.abs(c - d.fixe) > 0.001) { e.push(E("cours", "Le " + d.lib + " a une parité fixe avec l'euro : 1 € = " + String(d.fixe).replace(".", ",") + " " + dev + ".")); return NaN; }
    if (d && d.min && (c < d.min || c > d.max)) { e.push(E("cours", "Ce cours paraît faux : le cours se lit en " + dev + " pour 1 € (entre " + String(d.min).replace(".", ",") + " et " + String(d.max).replace(".", ",") + "). Relisez la newsletter.")); return NaN; }
    return c;
  }
  /* Contrôles communs à l'achat et à la vente : devise, montant (multiple de la plus petite coupure), cours. Renvoie { dev, m, cours, cc, eq } ou null si la devise n'est pas utilisable. */
  function controleBillets(x, v, o, sens) {
    var e = o.erreurs, dev = v.devise, d = DEVISES[dev];
    if (vide(v, "devise")) return null;
    if (!d || dev === "EUR" || !BILLETS[dev]) { e.push(E("devise", "Choisissez une devise de la liste.")); return null; }
    if (BILLETS[dev] === "non") {
      e.push(E("devise", "La monnaie choisie (" + d.lib + ") " + (sens === "achat" ? "ne s'achète pas" : "n'est pas rachetée") + " en France : c'est une monnaie non convertible ou dont l'exportation est limitée." + (sens === "achat" ? " Conseillez au client de partir avec des euros (ou des dollars) et de changer sur place." : " Le client doit la changer dans le pays d'émission.")));
      return null;
    }
    var pas = pasBillets(dev), m = montantOk(v, "montant", e), cours = verifierCoursBillets(v, dev, e);
    if (!isNaN(m) && m % pas !== 0) e.push(E("montant", "Les billets se comptent par coupures : le montant doit être un multiple de " + B.nb(pas) + " " + dev + "."));
    var cc = isNaN(cours) ? NaN : coursBillets(cours, sens), eq = !isNaN(m) && !isNaN(cc) && cc > 0 ? r2(m / cc) : 0;
    return { dev: dev, d: d, m: m, cours: cours, cc: cc, eq: eq };
  }
  function lignesCours(r, b, sens) {
    if (isNaN(b.cours)) return;
    r.push(["Cours de la newsletter", "1 € = " + fmtCours(b.cours) + " " + b.dev]);
    r.push(["Cours appliqué (marge de la banque : " + pourcent(TARIFS.margeBillets) + ")", "1 € = " + fmtCours(b.cc) + " " + b.dev]);
  }
  CONTROLES.achat_devises = function (x, v, f, o) {
    var e = o.erreurs, r = o.resume, op = dateOp(), ymd = B.ymd(op), b = controleBillets(x, v, o, "achat");
    if (!b) return;
    var eq = b.eq, commission = TARIFS.changeCommission, envoi = v.remise === "domicile" ? TARIFS.changeEnvoi : 0, frais = r2(commission + envoi), total = r2(eq + frais);
    if (eq > SEUILS.devisesMax) e.push(E("montant", "La banque remet au plus " + eur(SEUILS.devisesMax) + " de billets par opération. Pour une somme plus importante, conseillez un virement dans la devise du pays."));
    if (v.remise === "stock") {
      if (BILLETS[b.dev] !== "stock") e.push(E("remise", "Cette devise n'est pas en stock à l'agence : les billets se commandent (retrait en main propre ou envoi à domicile)."));
      else if (eq > SEUILS.devisesStockMax) e.push(E("remise", "Le stock de l'agence permet de remettre au plus " + eur(SEUILS.devisesStockMax) + " de billets tout de suite : commandez les billets."));
    }
    if (eq > 0) resteDispo(x, total, e, "montant");
    var cumul = especesMois(x, op);
    if (eq >= SEUILS.douane) o.alertes.push("Sortir de l'Union européenne avec " + B.eur(SEUILS.douane) + " ou plus en espèces oblige le client à le déclarer à la douane (règlement (UE) 2018/1672). Prévenez-le.");
    if (eq > 0 && cumul + eq > SEUILS.tracfinMois) o.alertes.push("Les retraits d'espèces de ce mois atteindraient " + eur(cumul + eq) + " : au-delà de " + B.eur(SEUILS.tracfinMois) + " par mois, la banque déclare l'opération à Tracfin.");
    if (v.remise && v.remise !== "stock") o.alertes.push("Les billets sont commandés à la centrale de billets de la banque : ils arrivent sous 3 jours ouvrés. Le compte est débité dès aujourd'hui, le cours appliqué est celui du jour de la commande.");
    var mo = { tourisme: "Voyage d'agrément", pro: "Voyage professionnel", etudes: "Séjour d'études ou stage", autre: "Autre motif" }[v.objet] || "";
    r.push(["Compte débité", "Compte courant n° " + x.cpt.rib.compte]);
    if (!isNaN(b.m)) r.push(["Billets remis au client", B.nb(b.m).replace(/ /g, " ") + " " + b.dev + " (" + b.d.lib + ")"]);
    lignesCours(r, b, "achat");
    if (eq > 0) r.push(["Contre-valeur en euros", eur(eq)]);
    r.push(["Commission de change", eur(commission)]);
    if (envoi) r.push(["Envoi sécurisé à domicile", eur(envoi)]);
    if (eq > 0) r.push(["Total débité du compte", eur(total)]);
    r.push(["Remise des billets", v.remise === "stock" ? "Immédiate, en main propre contre signature (stock de l'agence)" : v.remise === "domicile" ? "Envoi sécurisé à domicile sous 3 à 5 jours ouvrés" : v.remise === "agence" ? "Commande – retrait en main propre à l'agence sous 3 jours ouvrés, contre signature" : ""]);
    r.push(["Voyage", txt(v.destination) ? txt(v.destination) + (mo ? " – " + mo : "") : ""]);
    o.frais = frais; o.montant = eq; o.dateOp = ymd; o.devise = b.dev; o.montantDevise = isNaN(b.m) ? 0 : b.m; o.coursBillets = isNaN(b.cc) ? 0 : b.cc;
    if (eq > 0) {
      o.mv = [{ ymd: ymd, kind: "retrait", lib: "Achat de devises – " + B.nb(b.m).replace(/ /g, " ") + " " + b.dev + " (billets)", m: -eq }, { ymd: ymd, kind: "frais", lib: "Commission de change (achat de devises)", m: -commission }];
      if (envoi) o.mv.push({ ymd: ymd, kind: "frais", lib: "Envoi sécurisé de devises à domicile", m: -envoi });
    }
  };
  CONTROLES.vente_devises = function (x, v, f, o) {
    var e = o.erreurs, r = o.resume, ymd = B.ymd(dateOp()), b = controleBillets(x, v, o, "vente");
    if (!b) return;
    var eq = b.eq, commission = TARIFS.changeCommission, net = r2(eq - commission);
    if (eq > 0 && net <= 0) e.push(E("montant", "Le montant est trop faible : la commission de change (" + eur(commission) + ") dépasse la contre-valeur."));
    var origines = { reliquat: "Reliquat d'un voyage", cadeau: "Billets reçus de l'étranger", autre: "Autre origine, justifiée par le client" };
    if (eq > SEUILS.devisesVenteJustif) o.alertes.push("Au-delà de " + B.eur(SEUILS.devisesVenteJustif) + " de billets, conservez la justification de l'origine des fonds dans le dossier du client (vigilance contre le blanchiment).");
    if (eq > SEUILS.devisesVenteMax) o.alertes.push("Au-delà de " + B.eur(SEUILS.devisesVenteMax) + ", l'accord de la directrice d'agence est nécessaire et l'opération fait l'objet d'un examen renforcé.");
    r.push(["Compte crédité", "Compte courant n° " + x.cpt.rib.compte]);
    if (!isNaN(b.m)) r.push(["Billets remis par le client", B.nb(b.m).replace(/ /g, " ") + " " + b.dev + " (" + b.d.lib + ")"]);
    lignesCours(r, b, "vente");
    if (eq > 0) { r.push(["Contre-valeur en euros", eur(eq)]); r.push(["Commission de change", eur(commission)]); r.push(["Montant crédité sur le compte", eur(net)]); }
    r.push(["Contrôle des billets", coche(v, "billets") ? "Billets comptés et contrôlés devant le client" : "Non contrôlés"]);
    r.push(["Origine des billets", origines[v.origine] || ""]);
    o.frais = commission; o.montant = eq; o.dateOp = ymd; o.devise = b.dev; o.montantDevise = isNaN(b.m) ? 0 : b.m; o.coursBillets = isNaN(b.cc) ? 0 : b.cc;
    if (eq > 0 && net > 0) o.mv = [{ ymd: ymd, kind: "change", lib: "Vente de devises – " + B.nb(b.m).replace(/ /g, " ") + " " + b.dev + " (billets)", m: eq }, { ymd: ymd, kind: "frais", lib: "Commission de change (vente de devises)", m: -commission }];
  };

  /* ---------- clôture du compte et des épargnes ----------
     Le client quitte l'agence (ou ferme son compte). La clôture à sa demande est gratuite. Le conseiller atteste les vérifications faites avant de clôturer :
     chèques émis pointés, chèques impayés régularisés, moyens de paiement (cartes, chéquiers) récupérés et résiliés, services résiliés. Le solde du compte courant et des livrets clôturés est versé
     par virement sur le RIB du nouveau compte du client (à son nom) ou par chèque de banque. À l'exécution : cartes résiliées, livrets soldés, relevé du compte soldé, et une attestation de clôture
     du compte et des épargnes est remise au client (documents_service.js). Règles de l'agence (inventées) : compte débiteur, opérations en attente de signature et virements différés programmés
     empêchent la clôture ; le compte à terme n'est pas clôturé ici ; les placements (PEA, PER, assurance vie, parts sociales) ne sont pas concernés. */
  /* La clôture exécutée du client, ou de son conjoint avec qui il partage le compte joint ; sinon null. */
  function clotureDe(st, cid) {
    var l = operations(st).filter(function (o) { return o.type === "cloture_compte" && o.statut === "executee" && (o.c === cid || (o.cloture && o.cloture.cotitulaire === cid)); });
    return l.length ? l[l.length - 1] : null;
  }
  /* Désolidarisation exécutée après laquelle le compte appartient à l'ancien cotitulaire seul : le client n'en est plus titulaire ; sinon null. */
  function departDe(st, cid) {
    var l = operations(st, cid).filter(function (o) { return o.type === "desolidarisation_compte" && o.statut === "executee" && o.desol && o.desol.conserve === "cotitulaire"; });
    return l.length ? l[l.length - 1] : null;
  }
  /* Compte courant que le client a quitté : clôturé, ou devenu le compte individuel de son ancien cotitulaire (désolidarisation) ; sinon null. */
  function compteQuitteDe(st, cid) { return clotureDe(st, cid) || departDe(st, cid); }
  /* Phrase qui dit pourquoi plus aucune opération n'est possible sur le compte. */
  function messageQuitte(op) {
    var j = B.fmtDate(B.lireYmd(op.dateExec || op.date));
    return op.type === "desolidarisation_compte" ? "Ce client n'est plus titulaire du compte courant depuis le " + j + " : il est devenu le compte individuel de " + op.desol.conserveNom
      : "Le compte courant de ce client est clôturé depuis le " + j;
  }
  /* Épargnes du client : celles que l'on peut clôturer avec le compte, et celles qui restent (le compte à terme reste ouvert jusqu'à son échéance). */
  function epargnesCloturables(c, st) {
    var ctx = K.contexte(c, st), cl = [], reste = [];
    ctx.epa.forEach(function (e) {
      var z = { p: e.p, nom: nomCourtProduit(e.p), solde: soldeEpargne(c, st, e.p, e.solde || 0) };
      if (e.p === "CAT") { z.raison = "il reste ouvert jusqu'à son échéance (une clôture anticipée relève des conditions du contrat)"; reste.push(z); } else cl.push(z);
    });
    return { cloturables: cl, restent: reste };
  }
  /* Total versé au client : solde du compte courant (s'il est créditeur) et soldes des livrets clôturés. */
  function totalCloture(x, v) {
    var ch = Array.isArray(v.epargnes) ? v.epargnes : [], t = Math.max(0, x.cpt.solde);
    epargnesCloturables(x.c, x.st).cloturables.forEach(function (e) { if (ch.indexOf(e.p) >= 0) t += e.solde; });
    return r2(t);
  }
  /* RIB d'un compte du client dans une autre banque (banque et numéro imaginaires, IBAN valide), pour s'entraîner : le solde est versé sur un compte ouvert à son nom. */
  function ribEntrainement(c) {
    var h = empreinte("rib-cloture|" + c.num), lit = h % 2 === 0, banque = lit ? "30047" : "17806", guichet = lit ? "01230" : "00231";
    var iban = construireIban("FR", bbanFr(banque, guichet, String(10000000000 + (h * 7919) % 89999999999)));
    return { iban: iban, ibanLisible: ibanLisible(iban), bic: lit ? "BDLIFRPPXXX" : "CRHOFR2AXXX", banque: lit ? "Banque du Littoral" : "Caisse Rhodanienne", titulaire: libTitulaire(c) };
  }
  /* Le nom saisi (titulaire du RIB) est celui du client ou de son conjoint cotitulaire : tous les mots du nom et du prénom y figurent (une initiale suffit pour le prénom). */
  function estLeClient(c, nom) {
    var s = mots(nom), cands = [libTitulaire(c)].concat(RIB.rib(c).coTitulaires.map(libTitulaire));
    if (!s.length) return false;
    return cands.some(function (t) { return mots(t).every(function (w) { return s.some(function (h) { return h === w || (h.length === 1 && w.charAt(0) === h); }); }); });
  }
  /* Vérifications que le conseiller atteste avant de clôturer (toutes obligatoires). Certaines dépendent du client : crédit, compte joint, mineur. */
  function verifsCloture(x) {
    var c = x.c, rib = x.cpt.rib, ctx = K.contexte(c, x.st), cs = cartes(c, x.st).filter(function (k) { return k.etat !== "resiliee"; });
    var l = [
      { id: "v_cheques", court: "chèques émis pointés", lib: "Chèques émis pointés : le client n'a plus de chèque en circulation (tous ont été débités), ou il sait que ceux présentés après la clôture seront rejetés." },
      { id: "v_impayes", court: "chèques impayés régularisés", lib: "Chèques impayés régularisés : aucun incident de paiement de chèque n'est à régulariser (le fichier central des chèques se consulte dans « Interro BDF »)." },
      { id: "v_moyens", court: "moyens de paiement récupérés et résiliés", lib: "Moyens de paiement récupérés et résiliés : " + (cs.length ? cs.map(function (k) { return "carte " + k.nom; }).join(", ") + " restituée" + (cs.length > 1 ? "s" : "") + " et détruite" + (cs.length > 1 ? "s" : "") : "aucune carte à restituer") + ", chéquiers non utilisés restitués." },
      { id: "v_services", court: "services résiliés", lib: "Services résiliés : " + ((ctx.connect || ctx.alertes) ? [ctx.connect ? "GS Connect (banque à distance)" : "", ctx.alertes ? "GS Alertes (SMS)" : ""].filter(Boolean).join(" et ") + ", puis " : "") + "tout autre service lié au compte. Le client sait qu'il doit transférer ses prélèvements, ses virements permanents et ses revenus vers son nouveau compte." }
    ];
    if (c.cre && c.cre.length) l.push({ id: "v_credit", court: "domiciliation du crédit", lib: "Crédit en cours (" + c.cre.map(function (k) { return nomCourtProduit(k.p); }).join(", ") + ") : le prélèvement des échéances est domicilié sur le nouveau compte du client (nouvelle autorisation de prélèvement signée)." });
    var autres = rib.joint ? rib.coTitulaires.map(nomUsuel) : [], listeAutres = autres.length > 1 ? autres.slice(0, -1).join(", ") + " et " + autres[autres.length - 1] : autres[0];
    if (rib.joint) l.push(rib.forme === "indivis" ? { id: "v_joint", court: "signature de tous les titulaires", lib: "Compte indivis avec " + listeAutres + " : tous les titulaires ont signé la demande de clôture." } :
      { id: "v_joint", court: "signature des deux cotitulaires", lib: "Compte joint avec " + listeAutres + " : les deux cotitulaires ont signé la demande de clôture. À savoir : si un seul cotitulaire veut se retirer, on ne clôture pas le compte, on le désolidarise (opération « Désolidarisation d'un compte joint » : lettre signée de chaque cotitulaire, remise à l'agence ou envoyée en recommandé avec avis de réception), puis on le transforme en compte à un seul titulaire." });
    if (c.age < 18) l.push({ id: "v_mineur", court: "représentant légal", lib: "Client mineur : le représentant légal est présent, son identité est vérifiée et il signe la demande." });
    return l;
  }
  CHAMPS.cloture_compte = function (x, v) {
    var f = [], ep = epargnesCloturables(x.c, x.st), tot = totalCloture(x, v);
    f.push(ch("info_cloture", "", "info", { texte: "Clôture à la demande du client : gratuite. Cartes et chéquiers sont restitués, les livrets cochés sont soldés avec le compte, et une attestation de clôture du compte et des épargnes est remise au client." }));
    if (ep.cloturables.length) f.push(ch("epargnes", "Épargnes clôturées en même temps que le compte", "coches", { recalc: true, options: ep.cloturables.map(function (e) { return opt(e.p, e.nom + " – solde " + eur(e.solde)); }),
      aide: "Cochez les livrets que le client clôture aussi : leur solde est versé avec celui du compte. Les livrets non cochés restent ouverts." }));
    verifsCloture(x).forEach(function (z) { f.push(ch(z.id, z.lib, "case", { requis: true, groupe: "verifs" })); });
    if (tot > 0) {
      f.push(ch("mode", "Versement du solde (" + eur(tot) + ")", "select", { requis: true, recalc: true, groupe: "versement", vide: "Choisir", options: [opt("virement", "Virement sur le RIB du nouveau compte du client"), opt("cheque", "Chèque de banque à l'ordre du client")],
        aide: "Le solde n'est jamais versé à un tiers : le RIB doit être au nom du client." }));
      if (v.mode === "virement") {
        f.push(ch("rib_nom", "Titulaire du compte, comme sur le RIB", "texte", { requis: true, groupe: "versement", aide: "Le titulaire du RIB doit être le client (ou son cotitulaire)." }));
        f.push(ch("iban", "IBAN du nouveau compte du client", "iban", { requis: true, groupe: "versement" }));
        f.push(ch("bic", "BIC (facultatif en zone SEPA)", "texte", { max: 11, groupe: "versement" }));
        f.push(ch("v_rib", "Le RIB du nouveau compte a été remis par le client et contrôlé : l'IBAN et le titulaire correspondent.", "case", { requis: true, groupe: "versement" }));
      } else if (v.mode === "cheque") f.push(ch("v_cheque", "Le chèque de banque est établi à l'ordre du client ; il lui sera remis contre sa signature de la demande.", "case", { requis: true, groupe: "versement" }));
    } else f.push(ch("info_versement", "", "info", { texte: "Aucun solde à verser : le compte courant est à zéro et aucun livret n'est clôturé avec un solde." }));
    return f;
  };
  CONTROLES.cloture_compte = function (x, v, f, o) {
    var e = o.erreurs, r = o.resume, c = x.c, st = x.st, ymd = B.ymd(dateOp()), solde = x.cpt.solde, rib = x.cpt.rib;
    var eps = epargnesCloturables(c, st), choisies = Array.isArray(v.epargnes) ? v.epargnes : [], co = rib.coTitulaire || null;
    if (solde < -0.005) e.push(E("", "Le compte courant est débiteur de " + eur(-solde) + " : le solde doit être au moins égal à zéro avant la clôture. Le client doit d'abord approvisionner son compte."));
    var attente = operations(st, c.id).filter(function (z) { return z.statut === "asigner"; });
    if (attente.length) e.push(E("", pl(attente.length, "opération est", "opérations sont") + " en attente de signature pour ce client : exécutez-" + (attente.length > 1 ? "les" : "la") + " ou annulez-" + (attente.length > 1 ? "les" : "la") + " avant la clôture."));
    operations(st, c.id).filter(revocable).forEach(function (z) { e.push(E("", "Un virement différé est programmé le " + B.fmtDate(B.lireYmd(z.mv[0].ymd)) + " (" + z.ref + ") : révoquez-le avant la clôture.")); });
    choisies.forEach(function (p) { if (!eps.cloturables.some(function (z) { return z.p === p; })) e.push(E("epargnes", "Ce livret ne peut pas être clôturé ici.")); });
    var verifs = verifsCloture(x);
    verifs.forEach(function (z) { if (!coche(v, z.id)) e.push(E(z.id, "Vérification à faire avant la clôture : " + z.court + ".")); });
    var closes = eps.cloturables.filter(function (z) { return choisies.indexOf(z.p) >= 0; }), gardees = eps.cloturables.filter(function (z) { return choisies.indexOf(z.p) < 0; }).concat(eps.restent);
    var total = totalCloture(x, v), mode = v.mode, numero = "", comm = total > 0 && mode === "cheque" ? TARIFS.chequeBanque : 0;
    var ci = null;
    if (total > 0) {
      if (vide(v, "mode")) e.push(E("mode", "Choisissez comment le solde est versé : virement sur le RIB du client, ou chèque de banque."));
      else if (mode === "virement") {
        ci = controleIban(v.iban);
        if (vide(v, "iban")) e.push(E("iban", "Saisissez l'IBAN du nouveau compte du client (figurant sur son RIB)."));
        else if (!ci.ok) e.push(E("iban", ci.msg.replace("du bénéficiaire", "du client")));
        else if (!SEPA[ci.pays]) e.push(E("iban", "Le solde est versé sur un compte de la zone SEPA : cet IBAN n'en fait pas partie."));
        else if (ci.pays === "FR" && ci.iban.slice(4, 9) === RIB.CODE_BANQUE) e.push(E("iban", "C'est un compte de GS Banque & Assurance : le solde se verse sur le compte que le client ouvre dans une autre banque."));
        else if (ci.iban === x.cpt.iban) e.push(E("iban", "C'est l'IBAN du compte qui est clôturé."));
        if (!vide(v, "bic") && !bicValide(v.bic)) e.push(E("bic", "Un BIC compte 8 ou 11 caractères (lettres et chiffres), par exemple BDLIFRPPXXX."));
        if (!vide(v, "rib_nom") && !estLeClient(c, v.rib_nom)) e.push(E("rib_nom", "Le titulaire du RIB (« " + txt(v.rib_nom) + " ») n'est pas le client : le solde d'un compte clôturé n'est versé qu'au client lui-même, jamais à un tiers."));
        if (!coche(v, "v_rib")) e.push(E("v_rib", "Vérification à faire : le RIB du nouveau compte a été remis et contrôlé."));
      } else if (mode === "cheque") {
        numero = "CB" + String(1000000 + empreinte(c.num + "|cloture|" + ymd) % 9000000).slice(-7);
        if (total <= comm) e.push(E("mode", "Le solde à verser (" + eur(total) + ") ne dépasse pas la commission du chèque de banque (" + eur(comm) + ") : choisissez le virement sur le RIB du client."));
        if (!coche(v, "v_cheque")) e.push(E("v_cheque", "Vérification à faire : le chèque de banque est établi à l'ordre du client."));
      }
    }
    var cs = cartes(c, st), ctx = K.contexte(c, st);
    var placements = ctx.plc.concat(ctx.ass).map(function (z) { return nomCourtProduit(z.p); });
    r.push(["Compte clôturé", "Compte courant n° " + rib.compte + " – IBAN " + x.cpt.ibanLisible]);
    r.push(["Épargnes clôturées", closes.length ? closes.map(function (z) { return z.nom + " (solde " + eur(z.solde) + ")"; }).join(", ") : "Aucune"]);
    if (gardees.length) r.push(["Épargnes conservées", gardees.map(function (z) { return z.nom + " (solde " + eur(z.solde) + (z.raison ? " – " + z.raison : "") + ")"; }).join(", ")]);
    r.push(["Solde du compte courant", eur(Math.max(0, solde))]);
    var verse = r2(total - comm);
    if (comm) { r.push(["Solde des comptes", eur(total)]); r.push(["Commission du chèque de banque", eur(comm)]); }
    r.push(["Total versé au client", eur(verse)]);
    if (total > 0 && mode === "virement") r.push(["Versement", "Virement sur le compte de " + txt(v.rib_nom) + " – IBAN " + (ci && ci.ok ? ibanLisible(ci.iban) : txt(v.iban)) + (vide(v, "bic") ? "" : " – BIC " + sansEspaces(v.bic))]);
    if (total > 0 && mode === "cheque") r.push(["Versement", "Chèque de banque n° " + numero + " de " + eur(verse) + " à l'ordre de " + libTitulaire(c).replace(/^(M\.|Mme)\s+/, "")]);
    r.push(["Cartes résiliées", cs.length ? cs.map(function (k) { return k.nom; }).join(", ") : "Aucune carte"]);
    r.push(["Vérifications faites", verifs.map(function (z) { return z.court; }).join(" ; ")]);
    r.push(["Date de clôture", B.fmtDate(B.lireYmd(ymd))]);
    if (gardees.length) o.alertes.push("Les épargnes non clôturées restent ouvertes : elles ne figurent pas sur l'attestation de clôture.");
    if (placements.length) o.alertes.push("Non concernés par cette clôture : " + placements.join(", ") + ". Le client les transfère ou les clôture séparément.");
    if (co) o.alertes.push("Compte joint : " + nomUsuel(co) + " est cotitulaire ; sa fiche est clôturée avec celle-ci.");
    o.frais = comm; o.montant = total; o.dateOp = ymd; if (numero) o.numeroCheque = numero;
    if (comm) o.alertes.push("Commission du chèque de banque : " + eur(comm) + ", retenue sur le solde ; le client reçoit un chèque de " + eur(verse) + ". Le virement sur son nouveau compte est gratuit.");
    var mv = [];
    closes.forEach(function (z) { if (z.solde > 0) mv.push({ ymd: ymd, kind: "virement", lib: "Clôture du " + z.nom + " – solde viré sur le compte courant", m: z.solde }); });
    if (total > 0 && mode) mv.push({ ymd: ymd, kind: mode === "cheque" ? "cheque" : "virement", lib: mode === "cheque" ? "Clôture du compte – chèque de banque n° " + numero : "Clôture du compte – virement du solde vers " + (ci && ci.ok ? ibanLisible(ci.iban) : txt(v.iban)), m: -verse });
    if (comm) mv.push({ ymd: ymd, kind: "frais", lib: "Commission de chèque de banque (clôture du compte)", m: -comm });
    o.mv = mv;
    o.cloture = { date: ymd, compte: { compte: rib.compte, iban: x.cpt.iban, ibanLisible: x.cpt.ibanLisible, solde: Math.max(0, solde) }, epargnes: closes.map(function (z) { return { p: z.p, nom: z.nom, solde: z.solde }; }),
      gardees: gardees.map(function (z) { return { p: z.p, nom: z.nom, solde: z.solde }; }), total: total, commission: comm, verse: verse, mode: total > 0 ? mode : "", ibanDest: ci && ci.ok ? ci.iban : "", ibanDestLisible: ci && ci.ok ? ibanLisible(ci.iban) : "", titulaireDest: txt(v.rib_nom), bic: sansEspaces(v.bic || ""),
      cheque: numero, cartes: cs.map(function (k) { return k.nom; }), verifs: verifs.map(function (z) { return z.court; }), cotitulaire: co ? co.id : null, cotitulaireNom: co ? nomUsuel(co) : "" };
  };

  /* ---------- désolidarisation d'un compte joint ----------
     Les deux cotitulaires demandent ensemble que le compte joint devienne le compte individuel de l'un d'eux : lettre signée de chacun (remise à l'agence contre récépissé, ou envoyée en recommandé avec avis de réception).
     À la réception de la lettre le compte joint est bloqué (plus d'opération à une seule signature) ; il est transformé en compte individuel le jour de l'opération. Le compte garde son numéro et son IBAN.
     La solidarité cesse pour l'avenir : le titulaire qui quitte le compte reste tenu des dettes nées avant ce jour ; le titulaire conservé reprend seul le compte, y compris un éventuel solde débiteur.
     Règles de l'agence (inventées) : seul un compte joint (deux cotitulaires) se désolidarise (un compte indivis se règle par la clôture) ; opérations en attente de signature, virements différés programmés
     et saisie administrative en cours l'empêchent ; l'opération est gratuite ; l'accord écrit des deux cotitulaires est obligatoire (sans accord, on ne transforme pas le compte).
     Le cotitulaire n'a pas de fiche client sur le site : s'il garde le compte, le RIB porte son nom et la fiche du client n'a plus de compte courant (plus aucune opération n'y est possible, ses cartes sont résiliées). */
  var MOTIFS_DESOL = [
    opt("separation", "Séparation du couple (rupture de PACS ou de concubinage)"),
    opt("divorce", "Divorce ou séparation de corps"),
    opt("autonomie", "Souhait d'autonomie financière"),
    opt("desaccord", "Désaccord sur la gestion du compte"),
    opt("autre", "Autre motif")
  ];
  function libMotifDesol(m) { var o = MOTIFS_DESOL.filter(function (z) { return z.v === m; })[0]; return o ? o.lib : ""; }
  function personne(p) { return { civ: p.civ, prenom: p.prenom, nom: p.nom, sexe: p.civ === "Mme" ? "F" : "M" }; }
  /* Vérifications que le conseiller atteste avant de désolidariser (toutes obligatoires) ; certaines dépendent du compte (solde) et du titulaire conservé. */
  function verifsDesol(x, v) {
    var c = x.c, rib = x.cpt.rib, co = rib.coTitulaire, solde = x.cpt.solde, conserve = v && v.conserve;
    if (!co) return [];
    var cs = cartes(c, x.st).filter(function (k) { return k.etat !== "resiliee"; });
    var l = [
      { id: "d_lettre", court: "lettre signée de chaque cotitulaire", lib: "La lettre de désolidarisation est signée de " + nomUsuel(c) + " et de " + nomUsuel(co) + " (remise à l'agence contre récépissé, ou reçue en recommandé avec avis de réception) ; leurs pièces d'identité sont contrôlées." },
      { id: "d_accord", court: "accord du titulaire conservé", lib: "Le titulaire qui garde le compte accepte d'en être le seul titulaire et le seul responsable : opérations à venir, cartes, chéquiers, services et découvert éventuel." },
      { id: "d_sortant", court: "information du titulaire qui quitte le compte", lib: "Le titulaire qui quitte le compte sait que la désolidarisation vaut pour l'avenir : il reste tenu des dettes nées avant ce jour (solde débiteur, chèques et paiements par carte pas encore débités)." },
      { id: "d_moyens", court: "moyens de paiement du titulaire sortant restitués", lib: "Cartes bancaires et chéquiers du titulaire qui quitte le compte récupérés et résiliés" + (conserve === "cotitulaire" && cs.length ? " (" + cs.map(function (k) { return "carte " + k.nom; }).join(", ") + ")" : "") + "." },
      { id: "d_prelev", court: "revenus et prélèvements redirigés", lib: "Le titulaire qui quitte le compte fait virer ses revenus, ses prélèvements et ses virements permanents sur son propre compte." }
    ];
    if (conserve === "cotitulaire" && c.cre && c.cre.length) l.push({ id: "d_credit", court: "domiciliation du crédit", lib: "Crédit en cours (" + c.cre.map(function (k) { return nomCourtProduit(k.p); }).join(", ") + ") : le client ne garde pas ce compte, le prélèvement des échéances est domicilié sur un autre compte à son nom (nouvelle autorisation de prélèvement signée)." });
    if (solde < -0.005) l.push({ id: "d_reprise", court: "reprise du solde débiteur", lib: "Compte débiteur de " + eur(-solde) + " : le titulaire conservé reprend seul ce solde et s'engage à l'apurer ; le titulaire qui part en reste tenu envers la banque tant qu'il n'est pas remboursé." });
    else if (solde > 0.005) l.push({ id: "d_solde", court: "sort du solde créditeur", lib: "Solde créditeur de " + eur(solde) + " : les deux cotitulaires conviennent qu'il reste sur le compte, au titulaire conservé (le titulaire qui part a reçu sa part ou y renonce)." });
    return l;
  }
  CHAMPS.desolidarisation_compte = function (x, v) {
    var rib = x.cpt.rib, co = rib.coTitulaire, c = x.c, f = [];
    if (rib.forme !== "joint" || !co) {
      f.push(ch("info_desol", "", "info", { texte: rib.forme === "indivis" ? "Ce compte est indivis : il n'y a pas de désolidarisation. Chaque indivisaire signe toutes les opérations, et la sortie d'un indivisaire passe par la clôture du compte."
        : "Ce compte est individuel : il n'a qu'un seul titulaire, il n'y a rien à désolidariser. Cette opération concerne un compte joint." }));
      return f;
    }
    f.push(ch("info_desol", "", "info", { texte: "Compte joint de " + nomUsuel(c) + " et de " + nomUsuel(co) + " : chacun est tenu de toutes les dettes du compte. Opération gratuite ; le compte garde son numéro et son IBAN." }));
    f.push(ch("motif", "Motif de la désolidarisation", "select", { requis: true, vide: "Choisir", options: MOTIFS_DESOL }));
    f.push(ch("conserve", "Titulaire qui garde le compte", "select", { requis: true, recalc: true, vide: "Choisir", options: [opt("client", nomUsuel(c) + " (le client)"), opt("cotitulaire", nomUsuel(co) + " (le cotitulaire)")],
      aide: "Le compte devient le compte individuel de ce titulaire. L'autre cesse d'être titulaire : il reste tenu des dettes nées avant ce jour." }));
    verifsDesol(x, v).forEach(function (z) { f.push(ch(z.id, z.lib, "case", { requis: true, groupe: "verifsdesol" })); });
    return f;
  };
  CONTROLES.desolidarisation_compte = function (x, v, f, o) {
    var e = o.erreurs, r = o.resume, c = x.c, st = x.st, rib = x.cpt.rib, co = rib.coTitulaire, ymd = B.ymd(dateOp()), solde = x.cpt.solde, conserve = txt(v.conserve);
    var attente = operations(st, c.id).filter(function (z) { return z.statut === "asigner"; });
    if (attente.length) e.push(E("", pl(attente.length, "opération est", "opérations sont") + " en attente de signature pour ce client : exécutez-" + (attente.length > 1 ? "les" : "la") + " ou annulez-" + (attente.length > 1 ? "les" : "la") + " avant la désolidarisation."));
    operations(st, c.id).filter(revocable).forEach(function (z) { e.push(E("", "Un virement différé est programmé le " + B.fmtDate(B.lireYmd(z.mv[0].ymd)) + " (" + z.ref + ") : révoquez-le avant la désolidarisation.")); });
    var verifs = verifsDesol(x, v);
    verifs.forEach(function (z) { if (!coche(v, z.id)) e.push(E(z.id, "Vérification à faire avant la désolidarisation : " + z.court + ".")); });
    if (conserve !== "client" && conserve !== "cotitulaire") return;
    var garde = conserve === "client" ? personne(c) : personne(co), part = conserve === "client" ? personne(co) : personne(c);
    var cs = cartes(c, st).filter(function (k) { return k.etat !== "resiliee"; }), cartesRes = conserve === "cotitulaire" ? cs.map(function (k) { return k.nom; }) : [];
    var nouvel = libTitulaire(garde);
    r.push(["Compte joint concerné", "Compte n° " + rib.compte + " – IBAN " + x.cpt.ibanLisible + " – " + rib.intitule]);
    r.push(["Motif", libMotifDesol(v.motif)]);
    r.push(["Titulaire qui garde le compte", nomUsuel(garde) + (conserve === "client" ? " (le client)" : " (le cotitulaire)")]);
    r.push(["Titulaire qui quitte le compte", nomUsuel(part) + (conserve === "client" ? " (le cotitulaire)" : " (le client)")]);
    r.push(["Nouveau compte", "Compte individuel au nom de " + nomUsuel(garde) + " – même numéro, même IBAN"]);
    r.push(["Solde du compte", eur(solde) + (solde < -0.005 ? " (débiteur : repris par le titulaire conservé)" : "")]);
    if (cartesRes.length) r.push(["Cartes résiliées", cartesRes.join(", ")]);
    r.push(["Vérifications faites", verifs.map(function (z) { return z.court; }).join(" ; ")]);
    r.push(["Date de la désolidarisation", B.fmtDate(B.lireYmd(ymd))]);
    r.push(["Frais", "Gratuit"]);
    o.alertes.push("À la réception de la lettre, le compte joint est bloqué ; il est transformé en compte individuel le jour de l'opération. La solidarité cesse pour l'avenir : " + nomUsuel(part) + " reste tenu des dettes nées avant le " + B.fmtDate(B.lireYmd(ymd)) + ".");
    if (x.cpt.decouvert > 0) o.alertes.push("Le découvert autorisé de " + eur(x.cpt.decouvert) + " était accordé aux deux cotitulaires : il est réexaminé pour le seul titulaire conservé (ses revenus), et supprimé s'il n'est pas reconduit.");
    if (conserve === "cotitulaire") o.alertes.push("Le cotitulaire n'a pas de fiche client dans cet outil : le compte est désormais le sien, la fiche de " + nomUsuel(c) + " n'a plus de compte courant. Ses épargnes restent ouvertes ; s'il veut un compte à son nom, il en ouvre un (page « Prospects »).");
    o.frais = 0; o.montant = 0; o.dateOp = ymd; o.mv = [];
    o.desol = { date: ymd, conserve: conserve, motif: txt(v.motif), motifLib: libMotifDesol(v.motif), conserveNom: nomUsuel(garde), partantNom: nomUsuel(part), client: personne(c), cotitulaire: personne(co),
      ancienIntitule: rib.intitule, nouvelIntitule: nouvel, compte: { compte: rib.compte, iban: x.cpt.iban, ibanLisible: x.cpt.ibanLisible }, solde: solde, decouvert: x.cpt.decouvert || 0, repriseDebit: solde < -0.005, cartes: cartesRes, verifs: verifs.map(function (z) { return z.court; }) };
  };

  /* controler(id, c, st, v) → { ok, erreurs: [{champ, msg}], alertes, resume: [[lib, valeur]], frais, montant, mv, ... }. */
  function controler(id, c, st, v) {
    var t = PAR_ID[id];
    v = v || {};
    var o = { type: id, ok: false, erreurs: [], alertes: [], resume: [], frais: 0, montant: 0, mv: [] };
    if (!t) { o.erreurs.push(E("", "Opération inconnue.")); return o; }
    var clo = compteQuitteDe(st, c.id);
    if (clo) {
      o.erreurs.push(E("", clo.type === "desolidarisation_compte" ? messageQuitte(clo) + " : plus aucune opération n'est possible sur ce compte."
        : id === "cloture_compte" ? "Le compte de ce client est déjà clôturé depuis le " + B.fmtDate(B.lireYmd(clo.dateExec || clo.date)) + "."
        : "Le compte courant de ce client est clôturé depuis le " + B.fmtDate(B.lireYmd(clo.dateExec || clo.date)) + " : plus aucune opération n'est possible."));
      return o;
    }
    var x = ctxDe(c, st), champs = champsOp(id, x, v);
    if ((id === "cloture_compte" || id === "desolidarisation_compte") && x.cpt.satd.avis.length) {
      o.erreurs.push(E("", "Une saisie administrative à tiers détenteur est en cours sur les comptes de ce client (avis " + x.cpt.satd.avis.join(", ") + ") : les comptes sont bloqués jusqu'au " + B.fmtDate(B.lireYmd(x.cpt.satd.jusqu)) + ". " + (id === "cloture_compte" ? "La clôture" : "La désolidarisation") + " est impossible avant le versement des sommes au Trésor public."));
      return o;
    }
    if (id === "desolidarisation_compte" && (x.cpt.rib.forme !== "joint" || !x.cpt.rib.coTitulaire)) {
      o.erreurs.push(E("", x.cpt.rib.forme === "indivis" ? "Ce compte est indivis : il ne se désolidarise pas (chaque indivisaire signe toutes les opérations). La sortie d'un indivisaire passe par la clôture du compte."
        : x.cpt.rib.desolidarisation ? "Ce compte a déjà été désolidarisé le " + B.fmtDate(B.lireYmd(x.cpt.rib.desolidarisation.date)) + " : c'est un compte individuel."
        : "Ce compte est individuel : il n'a qu'un seul titulaire, il n'y a rien à désolidariser. Cette opération concerne un compte joint."));
      return o;
    }
    oblig(champs, v, o.erreurs);
    verifierChamps(champs, v, o.erreurs);
    CONTROLES[id](x, v, champs, o);
    controleIdentite(v, o, id);
    /* une seule erreur par champ : la plus précise (la dernière ajoutée par le contrôle l'emporte sur « champ à renseigner ») */
    var vus = {}, uniques = [];
    o.erreurs.slice().reverse().forEach(function (er) { if (er.champ && vus[er.champ]) return; vus[er.champ] = true; uniques.unshift(er); });
    /* la vérification d'identité passe toujours en premier */
    o.erreurs = uniques.filter(function (er) { return er.champ === "idverif" || er.champ === "idpiece"; }).concat(uniques.filter(function (er) { return er.champ !== "idverif" && er.champ !== "idpiece"; }));
    o.resume = o.resume.filter(function (l) { return l[1] !== "" && l[1] != null; });
    o.ok = o.erreurs.length === 0;
    return o;
  }

  /* ---------- cycle de vie ---------- */
  function copie(v) { var o = {}; Object.keys(v || {}).forEach(function (k) { o[k] = Array.isArray(v[k]) ? v[k].slice() : (typeof v[k] === "boolean" ? v[k] : txt(v[k])); }); return o; }
  function numeroOrdre(st, ymd) { return operations(st).filter(function (o) { return o.date === ymd; }).length + 1; }
  /* Crée l'opération « à signer ». Renvoie { ok, operation } ou { ok: false, erreurs }. */
  function creer(st, c, id, v) {
    var ctl = controler(id, c, st, v);
    if (!ctl.ok) return { ok: false, erreurs: ctl.erreurs, controle: ctl };
    if (!Array.isArray(st.operations)) st.operations = [];
    var now = B.maintenant(), ymd = B.ymd(B.aujourdhui()), n = numeroOrdre(st, ymd);
    var op = {
      id: "o" + now.getTime().toString(36) + Math.random().toString(36).slice(2, 6), ref: "OS-" + ymd.replace(/-/g, "") + "-" + (n < 10 ? "00" : n < 100 ? "0" : "") + n,
      c: c.id, type: id, date: ymd, heure: B.hhmm(now), par: (st.eleve && st.eleve.nom) || "", statut: "asigner", v: copie(v),
      resume: ctl.resume, alertes: ctl.alertes, frais: ctl.frais, montant: ctl.montant, mv: ctl.mv, dateOp: ctl.dateOp || ymd
    };
    ["cible", "mv2", "devise", "montantDevise", "coursBillets", "vop", "carteAgence", "numeroCheque", "formules", "lignes", "opposition", "oppositionDate", "cloture", "desol"].forEach(function (k) { if (ctl[k] != null) op[k] = ctl[k]; });
    st.operations.push(op);
    if (id === "opposition_carte" && op.v.idverif === "tel") {
      /* opposition par téléphone : la carte est bloquée tout de suite ; le client confirmera par écrit à l'agence */
      var ex = executer(st, c, op.id);
      if (!ex.ok) { st.operations.pop(); return { ok: false, erreurs: [E("", ex.erreur)], controle: ctl }; }
      op.confirmation = "attendue";
      return { ok: true, operation: op, controle: ctl, immediate: true };
    }
    return { ok: true, operation: op, controle: ctl };
  }
  function trouver(st, id) { return operations(st).filter(function (o) { return o.id === id; })[0] || null; }
  /* Le client a signé : l'opération est exécutée (nouveau contrôle, car le compte a pu changer depuis la préparation). */
  function executer(st, c, id) {
    var op = trouver(st, id);
    if (!op) return { ok: false, erreur: "Opération introuvable." };
    if (op.statut !== "asigner") return { ok: false, erreur: "Cette opération n'est plus à signer (" + STATUTS[op.statut].toLowerCase() + ")." };
    var sans = st.operations.filter(function (o) { return o.id !== op.id; }), copieSt = Object.assign({}, st, { operations: sans });
    var ctl = controler(op.type, c, copieSt, op.v);
    if (!ctl.ok) return { ok: false, erreur: ctl.erreurs[0].msg, erreurs: ctl.erreurs };
    if (op.type === "montee_gamme") {
      var s = K.souscrireEquipement(st, c, op.v.vers, { canal: "accueil", parOperation: true, note: "Montée en gamme depuis " + nomCourtProduit(op.v.carte) + " (opération de service " + op.ref + ").", options: { debit: op.v.debit === "differe" ? "differe" : "immediat", resume: [["Montée en gamme", nomCourtProduit(op.v.carte) + " → " + nomCourtProduit(op.v.vers)]] } });
      if (!s.ok) return { ok: false, erreur: s.erreur };
      op.souscription = s.souscription.id;
    }
    if (ctl.cloture) { op.cloture = ctl.cloture; op.numeroCheque = ctl.numeroCheque || op.numeroCheque; }
    if (ctl.desol) op.desol = ctl.desol;
    op.mv = ctl.mv; op.mv2 = ctl.mv2 || op.mv2; if (ctl.lignes) { op.lignes = ctl.lignes; op.opposition = ctl.opposition; op.oppositionDate = ctl.oppositionDate; op.montant = ctl.montant; } op.frais = ctl.frais; op.resume = ctl.resume; op.dateOp = ctl.dateOp || op.dateOp;
    op.statut = "executee"; op.dateExec = B.ymd(B.aujourdhui()); op.heureExec = B.hhmm(B.maintenant());
    M.viderCache();
    return { ok: true, operation: op };
  }
  function annuler(st, id) {
    var op = trouver(st, id);
    if (!op || op.statut !== "asigner") return false;
    op.statut = "annulee"; op.dateAnnul = B.ymd(B.aujourdhui());
    return true;
  }
  /* Révoque un virement différé exécuté mais pas encore débité (le client change d'avis avant la date). */
  function revocable(op) {
    if (!op || op.statut !== "executee" || (op.type !== "virement_sepa" && op.type !== "virement_interne")) return false;
    return !!(op.mv && op.mv.length && op.mv[0].ymd > B.ymd(B.aujourdhui()));
  }
  function revoquer(st, id) {
    var op = trouver(st, id);
    if (!revocable(op)) return false;
    op.statut = "annulee"; op.dateAnnul = B.ymd(B.aujourdhui()); op.revoque = true;
    M.viderCache();
    return true;
  }
  function liste(st, cid) { return operations(st, cid).slice().sort(function (a, b) { return (b.date + b.heure) < (a.date + a.heure) ? -1 : 1; }); }
  /* Opposition enregistrée par téléphone : le client doit la confirmer par écrit (document signé à l'agence). */
  function confirmerEcrit(st, id) {
    var op = trouver(st, id);
    if (!op || op.statut !== "executee" || op.confirmation !== "attendue") return false;
    op.confirmation = "recue"; op.dateConf = B.ymd(B.aujourdhui());
    return true;
  }
  function aConfirmer(st, cid) { return operations(st, cid).filter(function (o) { return o.statut === "executee" && o.confirmation === "attendue"; }); }
  /* Contestation exécutée pour une carte en possession du client, sans opposition enregistrée sur cette carte : l'opposition pour utilisation frauduleuse reste à faire. */
  function aOpposer(st, cid) {
    return operations(st, cid).filter(function (o) { return o.type === "contestation_carte" && o.statut === "executee" && o.v && o.v.situation === "possession" && !oppositionDe(st, cid, o.v.carte); });
  }
  /* Opérations en attente de signature (rappel pour l'élève). */
  function aSigner(st, cid) { return operations(st, cid).filter(function (o) { return o.statut === "asigner"; }); }

  /* ---------- lettre de désistement : document à remplir par le bénéficiaire d'un chèque ---------- */
  var DESISTEMENT_CHAMPS = ["Nom ou raison sociale du bénéficiaire", "Adresse", "Téléphone / e-mail", "Numéro du chèque", "Banque tirée", "Date d'émission", "Montant", "Facture ou contrat réglé par ce chèque"];

  var api = {
    TARIFS: TARIFS, SEUILS: SEUILS, PLAFONDS_CARTE: PLAFONDS_CARTE, GAMME: GAMME, COEF: COEF, DUREE_TEMP_MAX: DUREE_TEMP_MAX, TYPES: TYPES, PAR_ID: PAR_ID, GROUPES: GROUPES, STATUTS: STATUTS,
    STOCK: STOCK, CHEQUIER_STOCK_NB: CHEQUIER_STOCK_NB, PIECES_ID: PIECES_ID, BILLETS: BILLETS, PAS_BILLETS: PAS_BILLETS, stockRestant: stockRestant, coursBillets: coursBillets, eqBillets: eqBillets,
    SEPA: SEPA, PAYS: PAYS, PAYS_REFUSES: PAYS_REFUSES, DEVISES: DEVISES, MOTIFS_INTL: MOTIFS_INTL, EXEMPLES: EXEMPLES, DESISTEMENT_CHAMPS: DESISTEMENT_CHAMPS,
    controleIban: controleIban, construireIban: construireIban, ibanLisible: ibanLisible, bicValide: bicValide, verifierBeneficiaire: verifierBeneficiaire, clientParIban: clientParIban,
    compte: compte, cartes: cartes, soldeEpargne: soldeEpargne, clotureDe: clotureDe, compteQuitteDe: compteQuitteDe, messageQuitte: messageQuitte, departDe: departDe, MOTIFS_DESOL: MOTIFS_DESOL, epargnesCloturables: epargnesCloturables, ribEntrainement: ribEntrainement, estLeClient: estLeClient, chequesInclus: chequesInclus, lignesRejetables: lignesRejetables, cotisationCarte: cotisationCarte,
    formulaire: formulaire, controler: controler, creer: creer, executer: executer, annuler: annuler, revoquer: revoquer, revocable: revocable, liste: liste, aSigner: aSigner, aConfirmer: aConfirmer, aOpposer: aOpposer, oppositionDe: oppositionDe, numeroCarte: numeroCarte, lignesContestables: lignesContestables,
    MOIS_CONTESTATION: MOIS_CONTESTATION, LIGNES_KIT: LIGNES_KIT, LIGNES_PAGE1: LIGNES_PAGE1, FRANCHISE_PERTE_VOL: FRANCHISE_PERTE_VOL, SITUATIONS_CONTESTATION: SITUATIONS_CONTESTATION, MOTIFS_OPPOSITION: MOTIFS_OPPOSITION, confirmerEcrit: confirmerEcrit, QUESTIONS_SECURITE: QUESTIONS_SECURITE, QUESTIONS_MIN: QUESTIONS_MIN, trouver: trouver,
    lireM: lireM, lireCours: lireCours, eqEuro: eqEuro, cleLigne: cleLigne
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.operations = api; }
})(typeof window !== "undefined" ? window : null);
