/* GS Banque & Assurance – documents des opérations de service.
   Pour chaque opération (virement, opposition, plafond de carte, chèque de banque…), un document que le client lit, date et signe ; la banque en garde un exemplaire.
   Un seul modèle de mise en page : le client (identité, compte), l'opération (le récapitulatif contrôlé par operations_service.js), les déclarations du client, ce qu'il doit savoir.
   Un autre document, à part : la lettre de désistement, formulaire à faire remplir par le bénéficiaire d'un chèque (ce n'est pas une opération de service).
   document(op, c) et desistement(c, opts) renvoient { id, titre, sous, fichier, courrier, corps } ; le corps se place dans impression.document().
   Les mots « fictif » et le mot de passe des exercices n'apparaissent jamais dans ces textes. Fonctions pures, testées avec Node. */
(function (root) {
  "use strict";

  var D = (root && root.SGBF && root.SGBF.documents) || require("./documents.js");
  var OS = (root && root.SGBF && root.SGBF.operations) || require("./operations_service.js");
  var B = (root && root.SGBF && root.SGBF.banque) || require("./banque.js");
  var RIB = (root && root.SGBF && root.SGBF.rib) || require("./rib.js");
  var PR = (root && root.SGBF && root.SGBF.produits) || require("./produits.js");

  var PREFIXES = {
    virement_interne: "Virement_interne", virement_sepa: "Virement_SEPA", virement_intl: "Virement_international", opposition_carte: "Opposition_carte", contestation_carte: "Kit_contestation_carte", plafond_carte: "Plafond_carte",
    montee_gamme: "Montee_en_gamme_carte", cheque_banque: "Cheque_de_banque", commande_chequier: "Commande_chequier", opposition_cheque: "Opposition_cheque",
    rejet_prelevement: "Rejet_prelevement", retrait_espece: "Retrait_especes", achat_devises: "Achat_devises", vente_devises: "Vente_devises", cloture_compte: "Demande_cloture_compte", desolidarisation_compte: "Demande_desolidarisation_compte"
  };
  var MENTIONS_SIGNATURE = {
    virement_interne: "Lu et approuvé, bon pour ordre de virement", virement_sepa: "Lu et approuvé, bon pour ordre de virement", virement_intl: "Lu et approuvé, bon pour ordre de virement",
    opposition_carte: "Lu et approuvé, bon pour opposition", contestation_carte: "Lu et approuvé, je conteste et déclare sur l'honneur", opposition_cheque: "Lu et approuvé, bon pour opposition", plafond_carte: "Lu et approuvé, bon pour accord",
    montee_gamme: "Lu et approuvé, bon pour accord", cheque_banque: "Lu et approuvé, bon pour réception du chèque", commande_chequier: "Lu et approuvé, bon pour accord",
    rejet_prelevement: "Lu et approuvé, bon pour demande de remboursement", retrait_espece: "Lu et approuvé, bon pour reçu de la carte et des fonds",
    achat_devises: "Lu et approuvé, bon pour réception des billets", vente_devises: "Lu et approuvé, bon pour remise des billets", cloture_compte: "Lu et approuvé, bon pour clôture et pour versement du solde", desolidarisation_compte: "Lu et approuvé, bon pour désolidarisation et transformation du compte"
  };

  function e(s) { return D.esc(s); }
  function cl(c) {
    return { civilite: c.civ, prenom: c.prenom, nom: c.nom, compte: RIB.rib(c).compte, adresse: { ligne1: c.adr.rue, ligne2: c.adr.cp + " " + c.adr.ville } };
  }
  function dateDe(ymd) { return B.lireYmd(ymd) || new Date(); }
  function eur(x) { return D.montant(x); }
  function feminin(c) { return c.sexe === "F"; }
  function soussigne(c) { return "Je soussigné" + (feminin(c) ? "e" : "") + " <strong>" + e(D.nomComplet(cl(c))) + "</strong>"; }

  /* Bloc « Le client » : identité, adresse, numéro de compte, IBAN, co-titulaire éventuel. */
  function blocClient(c, op) {
    var r = RIB.rib(c), a = D.adresse(cl(c));
    var l = [["Client", e(D.nomComplet(cl(c))) + " (n° client " + e(c.num) + ")"], ["Adresse", e(a.ligne1) + ", " + e(a.ligne2)]];
    var piece = op.v && op.v.idverif === "oui" ? OS.PIECES_ID.filter(function (z) { return z.v === op.v.idpiece; })[0] : null;
    if (piece) l.push(["Identité contrôlée", e(piece.lib) + " en cours de validité – photographie et signature comparées par le conseiller"]);
    if (op.v && op.v.idverif === "tel") {
      var qs = OS.QUESTIONS_SECURITE.filter(function (q) { return Array.isArray(op.v.idtel) && op.v.idtel.indexOf(q.v) >= 0; }).map(function (q) { return q.lib.toLowerCase(); });
      l.push(["Identification", "Client identifié par téléphone le " + e(D.dateLongue(dateDe(op.date))) + " à " + e(op.heure) + " – questions de sécurité réussies : " + e(qs.join(", "))]);
    }
    l.push(["Compte courant", "n° " + e(r.compte) + " – IBAN " + e(r.ibanLisible)]);
    if (op.type === "desolidarisation_compte" && op.desol) l.push(["Cotitulaire du compte joint", e(D.nomComplet({ civilite: op.desol.cotitulaire.civ, prenom: op.desol.cotitulaire.prenom, nom: op.desol.cotitulaire.nom }))]);
    else if (r.joint && r.coTitulaire) l.push([(r.coTitulaires.length > 1 ? "Co-titulaires du " : "Co-titulaire du ") + RIB.libCompte(r), e(r.coTitulaires.map(function (t) { return t.civ + " " + t.nom.toUpperCase() + " " + t.prenom; }).join(" ; "))]);
    l.push(["Référence de l'opération", e(op.ref) + " – préparée le " + e(D.dateLongue(dateDe(op.date))) + " à " + e(op.heure)]);
    return D.titre("Le client") + D.fiche(l);
  }
  function blocOperation(op) {
    return D.titre("L'opération") + D.fiche(op.resume.filter(function (l) { return l[0] !== "Identité du client"; }).map(function (l) { return [l[0], e(l[1])]; }));
  }
  function bloc(titre, items) { return items && items.length ? D.titre(titre) + D.liste(items) : ""; }

  /* ---------- contenu propre à chaque opération : déclarations du client, informations remises ---------- */
  var TEXTES = {};
  TEXTES.virement_interne = function (op, c) {
    return {
      intro: soussigne(c) + ", titulaire du compte n° " + e(RIB.rib(c).compte) + " ouvert à l'agence de Paris de GS Banque &amp; Assurance, donne l'ordre à la banque d'exécuter le virement interne décrit ci-dessus.",
      declarations: ["Je confirme l'exactitude des informations ci-dessus, en particulier le compte à créditer.", "Je demande l'exécution immédiate du virement.", "Je reconnais que mon compte est débité du montant du virement et des frais éventuels indiqués."],
      infos: ["Un virement interne est gratuit et immédiat : le montant est porté sur le compte à créditer le jour même.", "Une fois exécuté, l'ordre ne peut plus être révoqué ; en cas d'erreur, le client doit demander la restitution au bénéficiaire.",
        op.v.dest === "gs" ? "Le nom du titulaire du compte à créditer a été comparé à l'IBAN saisi : il correspond." : "Les virements vers un livret d'épargne respectent le plafond de dépôts de ce livret."]
    };
  };
  TEXTES.virement_sepa = function (op, c) {
    var vop = op.vop, d = [], mode = op.v.mode;
    d.push("Je confirme l'exactitude des informations ci-dessus, en particulier l'IBAN et le nom du bénéficiaire que j'ai fournis.");
    if (vop === "proche") d.push("J'ai été informé(e) que le nom indiqué est proche, sans être identique, de celui du titulaire du compte ; je confirme le nom du bénéficiaire.");
    if (vop === "non") d.push("J'ai été informé(e) que le nom indiqué ne correspond pas au titulaire du compte. Je maintiens malgré tout mon ordre et j'en assume seul(e) la responsabilité : si l'IBAN est erroné, les fonds peuvent être versés à une autre personne.");
    if (vop === "impossible") d.push("J'ai été informé(e) que la banque du bénéficiaire n'a pas pu confirmer le titulaire du compte. Je maintiens mon ordre et j'en assume seul(e) la responsabilité.");
    d.push("Je reconnais que mon compte est débité du montant du virement et des frais indiqués.");
    var infos = [
      mode === "instantane" ? "Un virement instantané est exécuté en quelques secondes, à toute heure : il est irrévocable dès que la banque l'a reçu." : mode === "differe" ? "Un virement différé peut être annulé au plus tard la veille ouvrable de sa date d'exécution, en prévenant l'agence ; il est ensuite irrévocable." : "Un virement standard est irrévocable dès que la banque l'a reçu ; le compte du bénéficiaire est crédité au plus tard le jour ouvrable suivant.",
      "La vérification du bénéficiaire compare le nom saisi au nom du titulaire du compte, auprès de la banque du bénéficiaire.",
      "Méfiance : la banque ne demande jamais de faire un virement « pour sécuriser » un compte. Un nouveau RIB reçu par e-mail ou par message doit être vérifié par téléphone avec le bénéficiaire."
    ];
    return { intro: soussigne(c) + ", titulaire du compte n° " + e(RIB.rib(c).compte) + " ouvert à l'agence de Paris de GS Banque &amp; Assurance, donne l'ordre à la banque d'exécuter le virement en euros décrit ci-dessus.", declarations: d, infos: infos };
  };
  TEXTES.virement_intl = function (op, c) {
    return {
      intro: soussigne(c) + ", titulaire du compte n° " + e(RIB.rib(c).compte) + " ouvert à l'agence de Paris de GS Banque &amp; Assurance, donne l'ordre à la banque d'exécuter le virement international décrit ci-dessus.",
      declarations: ["Je confirme l'exactitude des informations ci-dessus : identité et adresse du bénéficiaire, numéro de compte, BIC, montant et devise.", "J'ai pris connaissance du cours de change appliqué, communiqué dans la newsletter de la banque, et des frais indiqués.",
        "J'autorise la banque à communiquer les informations de ce virement aux banques intermédiaires et aux autorités compétentes, comme la loi l'impose pour lutter contre le blanchiment de capitaux et le financement du terrorisme.", "Je déclare que l'opération correspond au motif économique indiqué."],
      infos: ["La banque peut demander des justificatifs, retarder ou refuser un virement vers un pays étranger (contrôles de conformité et sanctions internationales).", "Le virement est irrévocable une fois exécuté. Le délai d'arrivée dépend du pays et des banques intermédiaires : de 2 à 4 jours ouvrés en général.",
        "Avec des frais partagés (SHA), la banque du bénéficiaire et les banques intermédiaires peuvent prélever leurs propres frais sur le montant reçu.", "Le cours de change n'est pas garanti : il est celui du jour de l'ordre."]
    };
  };
  TEXTES.retrait_espece = function (op, c) {
    return {
      intro: soussigne(c) + ", titulaire du compte n° " + e(RIB.rib(c).compte) + " ouvert à l'agence de Paris de GS Banque &amp; Assurance, reconnais avoir reçu ce jour la carte de retrait de l'agence n° <strong>" + e(op.carteAgence || "") + "</strong>, rechargée de <strong>" + e(eur(op.montant)) + "</strong>.",
      declarations: ["Je reconnais que mon compte a été débité de ce montant.", "Je m'engage à retirer les espèces au distributeur de l'agence, avec le code confidentiel qui m'est communiqué séparément, puis à rendre la carte à l'agence aujourd'hui.", "Jusqu'à la restitution de la carte, je suis seul(e) responsable de la carte et des espèces retirées."],
      infos: ["La carte de retrait de l'agence ne sert qu'à retirer ce montant : elle ne permet aucun paiement.", "Si je retire moins que la somme chargée, le reste est recrédité sur mon compte courant à la restitution de la carte.", "Retirer ou déposer beaucoup d'espèces fait l'objet d'une vigilance : au-delà de 10 000 € par mois, la banque déclare les opérations à Tracfin, comme la loi l'y oblige."]
    };
  };
  TEXTES.achat_devises = function (op, c) {
    var v = op.v, stock = v.remise === "stock", domicile = v.remise === "domicile", m = OS.lireM(v.montant);
    return {
      intro: soussigne(c) + ", titulaire du compte n° " + e(RIB.rib(c).compte) + " ouvert à l'agence de Paris de GS Banque &amp; Assurance, " + (stock ? "reconnais avoir reçu ce jour, en main propre, les billets décrits ci-dessus." : "demande l'achat des billets décrits ci-dessus."),
      declarations: ["J'ai pris connaissance du cours de change appliqué (cours de la newsletter de la banque, majoré de la marge de la banque) et de la commission de change, et je les accepte.", "Je reconnais que mon compte est débité de la contre-valeur en euros, de la commission et des frais éventuels indiqués.",
        stock ? "J'ai compté les billets en présence du conseiller et je reconnais les avoir reçus." : domicile ? "J'accepte que les billets me soient envoyés à domicile en envoi sécurisé avec valeur déclarée, et que les frais d'envoi soient débités de mon compte." : "Je retirerai mes billets en main propre à l'agence, muni(e) d'une pièce d'identité, et je signerai le reçu à la remise.",
        "Je déclare que ces billets sont destinés au voyage indiqué ci-dessus."],
      infos: ["Le cours des billets est moins favorable que le cours des virements : la banque applique une marge, et le cours d'achat est le cours du jour de la commande.", "Les billets non utilisés au retour peuvent être revendus à la banque, au cours du jour, moins sa marge et sa commission.",
        "En cas de perte ou de vol, des billets ne sont ni remboursés ni remplaçables : n'en emportez pas plus que nécessaire et privilégiez la carte bancaire pour les paiements.",
        m && op.montant >= OS.SEUILS.douane ? "Sortir de l'Union européenne avec 10 000 € ou plus en espèces doit être déclaré à la douane (règlement (UE) 2018/1672)." : "À partir de 10 000 € en espèces, la sortie de l'Union européenne doit être déclarée à la douane."].filter(Boolean)
    };
  };
  TEXTES.vente_devises = function (op, c) {
    return {
      intro: soussigne(c) + ", titulaire du compte n° " + e(RIB.rib(c).compte) + " ouvert à l'agence de Paris de GS Banque &amp; Assurance, vends à la banque les billets étrangers décrits ci-dessus.",
      declarations: ["Je déclare que ces billets m'appartiennent et que leur origine est licite : " + ({ reliquat: "ils sont le reliquat d'un voyage", cadeau: "ils m'ont été remis par une personne vivant à l'étranger", autre: "leur origine est justifiée par les documents que j'ai présentés" }[op.v.origine] || "origine indiquée ci-dessus") + ".",
        "J'ai pris connaissance du cours de change appliqué (cours de la newsletter de la banque, minoré de la marge de la banque) et de la commission de change, et je les accepte.", "Je reconnais que les billets ont été comptés et contrôlés devant moi, et que mon compte est crédité de la contre-valeur en euros, moins la commission."],
      infos: ["La banque ne reprend que des billets en bon état et encore en circulation : les billets déchirés, scotchés ou d'une série retirée sont refusés.", "Le cours de rachat des billets est moins favorable que le cours des virements : la banque applique une marge.",
        "Pour lutter contre le blanchiment de capitaux, la banque vérifie l'identité du client et, au-delà d'un certain montant, l'origine des billets ; elle peut déclarer certaines opérations à Tracfin."]
    };
  };
  TEXTES.rejet_prelevement = function (op, c) {
    var v = op.v, consenti = v.consenti === "oui";
    var d = consenti ? ["Je demande à la banque de me rembourser le prélèvement indiqué ci-dessus. Ce prélèvement était autorisé par un mandat ; ma demande est faite dans le délai de 8 semaines suivant le débit.", "Je reconnais que je reste redevable de la somme envers le créancier si elle lui est due : je règlerai ce litige directement avec lui."]
      : ["Je déclare sur l'honneur que je n'avais pas autorisé ce prélèvement (" + ({ sans_mandat: "aucun mandat n'a été signé", mandat_revoque: "le mandat avait été révoqué avant le prélèvement", montant: "le prélèvement ne respecte pas le mandat signé" }[v.motif] || "motif à préciser") + ") et je demande à la banque de me rembourser.", "Je suis informé(e) que la banque peut demander au créancier la copie du mandat, et qu'une fausse déclaration m'expose à des poursuites."];
    if (v.opposition === true || v.opposition === "1") d.push("Je demande à la banque de rejeter les prochains prélèvements de ce créancier.");
    return {
      intro: soussigne(c) + ", titulaire du compte n° " + e(RIB.rib(c).compte) + " ouvert à l'agence de Paris de GS Banque &amp; Assurance, demande le remboursement du prélèvement SEPA décrit ci-dessus.",
      declarations: d,
      infos: ["Un prélèvement autorisé peut être contesté pendant 8 semaines à compter du débit, sans avoir à justifier la demande ; un prélèvement non autorisé, pendant 13 mois.", "Le compte est recrédité du montant à la date du débit initial : il n'y a pas de frais pour cette demande.", "Pour ne plus être prélevé, le client peut aussi révoquer son mandat auprès du créancier et de la banque, au plus tard la veille du prochain prélèvement."]
    };
  };
  TEXTES.cloture_compte = function (op, c) {
    var k = op.cloture || {}, eps = k.epargnes || [], cpt = k.compte || {}, co = k.cotitulaireNom;
    var vers = k.mode === "cheque" ? "par un chèque de banque n° " + e(k.cheque) + " établi à mon ordre" + (k.commission ? ", d'un montant de " + e(eur(k.verse)) + " (solde de " + e(eur(k.total)) + " diminué de la commission de " + e(eur(k.commission)) + " du chèque de banque)" : "") + ", que je reçois contre ma signature"
      : "par virement sur le compte " + e(k.ibanDestLisible) + ", ouvert à mon nom auprès d'une autre banque (RIB remis à la banque)";
    var d = [
      "Je demande la clôture de " + (co ? "notre compte joint" : "mon compte courant") + " n° " + e(cpt.compte) + (eps.length ? " et, avec lui, des comptes d'épargne suivants : " + eps.map(function (z) { return e(z.nom); }).join(", ") : "") +
        ", à la date de ce jour. Cette clôture est faite à ma demande ; elle ne donne lieu à aucun frais" + (k.commission ? ", hormis la commission de " + e(eur(k.commission)) + " du chèque de banque, retenue sur le solde" : "") + ".",
      "Je confirme avoir restitué à la banque, pour résiliation, " + ((k.cartes || []).length ? "ma carte bancaire (" + e((k.cartes || []).join(", ")) + ")" : "mes moyens de paiement") + " et mes chéquiers non utilisés.",
      "Je confirme que mes chèques émis ont été pointés avec la banque : je sais que tout chèque présenté après la clôture sera rejeté. Je déclare n'avoir aucun incident de paiement de chèque non régularisé.",
      "J'ai résilié les services liés à ce compte (banque à distance, alertes, abonnements) et j'ai été informé(e) que je dois transférer mes prélèvements, mes virements permanents et mes revenus vers mon nouveau compte."
    ];
    if (k.total > 0) d.push("Je demande que le solde de ces comptes, soit <strong>" + e(eur(k.total)) + "</strong>, me soit versé " + vers + ".");
    else d.push("Je reconnais que ces comptes ne présentent aucun solde à me verser.");
    var infos = ["Une fois la clôture exécutée, aucune opération n'est plus possible sur ces comptes : les prélèvements et les chèques présentés ensuite sont rejetés.",
      "Une attestation de clôture du compte et des épargnes est remise au client par la banque, signée et datée.",
      "La clôture d'un compte à la demande du client est gratuite."];
    if (co) infos.push(RIB.rib(c).forme === "indivis" ? "Le compte est indivis : la demande est signée par tous les titulaires." : "Le compte est joint : la demande est signée par les deux cotitulaires.");
    if ((k.gardees || []).length) infos.push("Les épargnes qui ne sont pas clôturées restent ouvertes : " + e(k.gardees.map(function (z) { return z.nom; }).join(", ")) + ".");
    return { intro: soussigne(c) + ", titulaire du compte n° " + e(RIB.rib(c).compte) + " ouvert à l'agence de Paris de GS Banque &amp; Assurance, déclare ce qui suit.", declarations: d, infos: infos };
  };
  /* Deux signataires : les cotitulaires parlent à la première personne du pluriel. Le texte repose sur op.desol (l'état du compte au moment de la demande), pas sur le RIB du jour : une fois l'opération exécutée, le compte est individuel. */
  function nomPers(p) { return D.nomComplet({ civilite: p.civ, prenom: p.prenom, nom: p.nom }); }
  TEXTES.desolidarisation_compte = function (op, c) {
    var k = op.desol || { compte: {}, client: c, cotitulaire: {}, cartes: [] }, cpt = k.compte || {}, garde = k.conserve === "client" ? k.client : k.cotitulaire, part = k.conserve === "client" ? k.cotitulaire : k.client;
    var d = [
      "Nous demandons la désolidarisation de notre compte joint n° " + e(cpt.compte) + " : la solidarité entre nous, cotitulaires, prend fin pour l'avenir à compter de ce jour.",
      "Nous demandons que ce compte soit transformé, à la même date, en compte individuel au seul nom de <strong>" + e(nomPers(garde)) + "</strong>, qui en devient le seul titulaire. Le compte garde son numéro et son IBAN. <strong>" + e(nomPers(part)) + "</strong> cesse d'être titulaire du compte.",
      "<strong>" + e(nomPers(garde)) + "</strong> accepte d'être le seul titulaire et le seul responsable du compte : opérations à venir, moyens de paiement, services" + (k.decouvert > 0 ? ", découvert autorisé (réexaminé pour son seul compte)" : "") + (k.repriseDebit ? ", et reprend à son seul nom le solde débiteur de " + e(eur(-k.solde)) + "" : "") + ".",
      "<strong>" + e(nomPers(part)) + "</strong> reconnaît rester tenu" + (part.sexe === "F" ? "e" : "") + " envers la banque des dettes nées avant ce jour (solde débiteur, chèques et paiements par carte pas encore débités), jusqu'à leur paiement. " + (part.sexe === "F" ? "Elle" : "Il") + " restitue ses cartes bancaires" + (k.conserve === "cotitulaire" && (k.cartes || []).length ? " (" + e(k.cartes.join(", ")) + ")" : "") + " et ses chéquiers ; " + (part.sexe === "F" ? "elle" : "il") + " fait virer ses revenus, ses prélèvements et ses virements permanents sur son propre compte."
    ];
    if (k.solde > 0.005) d.push("Nous convenons que le solde créditeur du compte, soit <strong>" + e(eur(k.solde)) + "</strong>, reste sur le compte, au titulaire conservé : le titulaire qui part a reçu sa part ou y renonce.");
    d.push("Motif de la demande : " + e((k.motifLib || "").charAt(0).toLowerCase() + (k.motifLib || "").slice(1)) + ".");
    var infos = [
      "À la réception de la lettre signée de chacun des deux cotitulaires (remise à l'agence contre récépissé, ou envoyée en recommandé avec avis de réception), le compte joint est bloqué : plus aucune opération à une seule signature. Il est transformé en compte individuel le jour de l'opération.",
      "La désolidarisation vaut pour l'avenir : le titulaire qui quitte le compte reste tenu des dettes nées avant ce jour, jusqu'à leur paiement.",
      "L'intitulé du compte, le RIB et les relevés sont désormais établis au seul nom du titulaire conservé ; le numéro de compte et l'IBAN ne changent pas.",
      "Cette opération est gratuite. Une attestation de désolidarisation est remise aux deux titulaires par la banque, signée et datée."
    ];
    if (k.decouvert > 0) infos.push("Le découvert autorisé de " + e(eur(k.decouvert)) + " était accordé aux deux cotitulaires : il est réexaminé pour le seul titulaire conservé, et supprimé s'il n'est pas reconduit.");
    if (k.conserve === "cotitulaire") infos.push("À l'issue de l'opération, " + e(nomPers(k.client)) + " n'est plus titulaire d'aucun compte courant à GS Banque &amp; Assurance (ses épargnes restent ouvertes) : s'il le souhaite, il ouvre un compte à son nom.");
    return { intro: "Nous soussignés <strong>" + e(nomPers(k.client)) + "</strong> et <strong>" + e(nomPers(k.cotitulaire)) + "</strong>, cotitulaires du compte joint n° " + e(cpt.compte) + " ouvert à l'agence de Paris de GS Banque &amp; Assurance, déclarons ce qui suit.", declarations: d, infos: infos };
  };
  TEXTES.opposition_carte = function (op, c) {
    var v = op.v, motif = { perte: "la perte", vol: "le vol", fraude: "l'utilisation frauduleuse", abusive: "l'utilisation abusive" }[v.motif] || "";
    var tel = v.idverif === "tel";
    var d = [tel ? "Je confirme par écrit l'opposition que j'ai demandée par téléphone à la banque le " + e(D.dateLongue(dateDe(op.date))) + " à " + e(op.heure) + " pour " + motif + " de la carte indiquée ci-dessus."
      : "Je confirme par écrit l'opposition que je demande à la banque pour " + motif + " de la carte indiquée ci-dessus, et je demande son blocage immédiat.", "Je m'engage à ne plus utiliser cette carte. Si je la retrouve, je la détruirai (ou je la rendrai à l'agence).", "Je certifie que les circonstances décrites ci-dessus sont exactes."];
    if (v.motif === "vol" || v.motif === "fraude") d.push("Je m'engage à déposer plainte et à remettre le récépissé à la banque sous 48 heures.");
    if (v.motif === "abusive") d.push("Je suis informé(e) que l'opposition pour utilisation abusive entraîne mon inscription au fichier central des chèques (FCC) de la Banque de France (fichier des retraits de cartes bancaires), pendant 2 ans.");
    if (v.nouvelle === "oui" && v.remise !== "domicile") d.push("Je serai informé par la banque de la mise à disposition de ma nouvelle carte à l'agence, où je viendrai la retirer en main propre contre signature.");
    if (v.nouvelle === "oui" && v.remise === "domicile") d.push("J'accepte que la nouvelle carte me soit envoyée en lettre recommandée et que les frais d'envoi soient débités de mon compte.");
    return {
      intro: soussigne(c) + ", titulaire du compte n° " + e(RIB.rib(c).compte) + " ouvert à l'agence de Paris de GS Banque &amp; Assurance, fais opposition à ma carte bancaire dans les conditions ci-dessous.",
      declarations: d,
      infos: (tel ? ["La carte a été bloquée dès l'appel du client, après son identification par des questions de sécurité. Le client confirme son opposition par écrit en signant ce document à l'agence, sur présentation de sa pièce d'identité."] : []).concat(["Jusqu'à l'opposition, en cas de perte ou de vol, le client supporte les pertes dans la limite de 50 € (sauf agissement frauduleux ou négligence grave de sa part) ; après l'opposition, il ne supporte plus aucune perte.",
        "L'opposition bloque la carte mais ne rembourse rien : les opérations que le client ne reconnaît pas se contestent dans les 13 mois, avec un autre document, le kit de contestation, signé à l'agence ; la banque rembourse alors le client sans délai, sauf soupçon de fraude de sa part.", v.nouvelle !== "oui" ? "Aucune nouvelle carte n'est commandée : le client peut en demander une à tout moment." : v.remise === "domicile" ? "Une nouvelle carte est fabriquée et envoyée à domicile en lettre recommandée sous 7 à 9 jours ouvrés (frais indiqués ci-dessus), avec un nouveau numéro ; le code confidentiel part par un courrier séparé." : "Une nouvelle carte est fabriquée : elle est à retirer en main propre à l'agence sous 5 à 7 jours ouvrés, avec un nouveau numéro ; le code confidentiel part par un courrier séparé.", "Les paiements récurrents et abonnements réglés avec l'ancienne carte devront être mis à jour avec la nouvelle."])
    };
  };
  TEXTES.opposition_cheque = function (op, c) {
    var v = op.v, motif = { perte: "la perte", vol: "le vol", fraude: "l'utilisation frauduleuse", collective: "la procédure collective du bénéficiaire (redressement ou liquidation judiciaire)" }[v.motif] || "";
    var d = ["Je confirme par écrit l'opposition que je demande à la banque, pour " + motif + ", sur " + (v.portee === "chequier" ? "les formules de chèques indiquées ci-dessus" : "le chèque indiqué ci-dessus") + ".", "Je certifie que les circonstances décrites ci-dessus sont exactes.",
      "Je suis informé(e) que l'opposition n'est permise que pour perte, vol, utilisation frauduleuse du chèque ou procédure collective du bénéficiaire (article L131-35 du Code monétaire et financier) ; une opposition faite pour un autre motif, par exemple un litige avec le bénéficiaire, est une infraction punie de cinq ans d'emprisonnement et de 375 000 € d'amende (article L163-2)."];
    if (v.motif === "vol" || v.motif === "fraude") d.push("Je m'engage à déposer plainte et à remettre le récépissé à la banque.");
    return {
      intro: soussigne(c) + ", titulaire du compte n° " + e(RIB.rib(c).compte) + " ouvert à l'agence de Paris de GS Banque &amp; Assurance, fais opposition au paiement du chèque ou des formules décrits ci-dessus.",
      declarations: d,
      infos: ["La banque refusera le paiement du chèque s'il lui est présenté, en indiquant « opposition » comme motif.", "Si le chèque avait été perdu par son bénéficiaire, celui-ci peut remplir une lettre de désistement : il y déclare renoncer à l'encaisser et s'engage à le restituer s'il le retrouve.", "Un nouveau chéquier peut être commandé à l'agence ; il faut, si besoin, refaire le chèque au bénéficiaire."]
    };
  };
  TEXTES.plafond_carte = function (op, c) {
    var temp = op.v.duree !== "permanent";
    return {
      intro: soussigne(c) + ", titulaire du compte n° " + e(RIB.rib(c).compte) + " ouvert à l'agence de Paris de GS Banque &amp; Assurance, demande le relèvement des plafonds de ma carte dans les conditions ci-dessus.",
      declarations: ["J'ai conscience qu'un plafond plus élevé augmente le montant que l'on peut dépenser avec ma carte si elle est perdue, volée ou utilisée frauduleusement.", "Je m'engage à surveiller mon compte et à faire opposition sans délai en cas de perte ou de vol.", temp ? "J'ai noté que mes plafonds reviendront automatiquement à leur niveau habituel à la date de fin du relèvement." : "Je demande que ce nouveau plafond soit appliqué en permanence."],
      infos: ["La banque peut refuser ou réduire le relèvement si le compte présente un incident ou si les opérations paraissent inhabituelles.", "Les plafonds sont des limites : ils ne donnent pas droit à un découvert. Le compte doit être approvisionné.", "Le relèvement est gratuit."]
    };
  };
  TEXTES.montee_gamme = function (op, c) {
    var v = op.v;
    return {
      intro: soussigne(c) + ", titulaire du compte n° " + e(RIB.rib(c).compte) + " ouvert à l'agence de Paris de GS Banque &amp; Assurance, demande le remplacement de ma <strong>" + e(PR.parId[v.carte].nom) + "</strong> par la <strong>" + e(PR.parId[v.vers].nom) + "</strong>.",
      declarations: ["J'ai reçu la fiche de la nouvelle carte (plafonds, assurances, tarif) et je l'accepte.", "J'accepte que la cotisation annuelle de la nouvelle carte soit débitée de mon compte, et que la cotisation déjà payée pour mon ancienne carte me soit remboursée au prorata des mois non utilisés.", v.remise === "domicile" ? "Je m'engage à détruire mon ancienne carte dès que j'ai reçu la nouvelle." : "Je m'engage à détruire mon ancienne carte dès que j'ai retiré la nouvelle à l'agence.", "J'ai bien compris que les garanties d'assurance de la nouvelle carte sont décrites dans la notice remise avec la carte, avec leurs plafonds et leurs exclusions."],
      infos: [v.remise === "domicile" ? "La nouvelle carte est envoyée à domicile en lettre recommandée sous 7 à 9 jours ouvrés (frais indiqués ci-dessus), avec un nouveau numéro ; le code confidentiel part par un courrier séparé. Les paiements récurrents (abonnements) sont à mettre à jour."
          : "La nouvelle carte est à retirer en main propre à l'agence sous 5 à 7 jours ouvrés, avec un nouveau numéro ; le code confidentiel part par un courrier séparé. Les paiements récurrents (abonnements) sont à mettre à jour.", "Le changement de carte est une souscription : elle figure dans le dossier du client.", v.vers === "VJEU" ? "" : "Le type de débit (immédiat ou différé) est celui choisi ci-dessus."].filter(Boolean)
    };
  };
  TEXTES.cheque_banque = function (op, c) {
    return {
      intro: soussigne(c) + ", titulaire du compte n° " + e(RIB.rib(c).compte) + " ouvert à l'agence de Paris de GS Banque &amp; Assurance, demande l'émission du chèque de banque décrit ci-dessus.",
      declarations: ["Je reconnais que mon compte est débité du montant du chèque et de la commission indiquée.", "Je reconnais avoir reçu ce jour le chèque de banque n° <strong>" + e(op.numeroCheque || "") + "</strong>, d'un montant de <strong>" + e(eur(op.montant)) + "</strong>, établi à l'ordre de <strong>" + e(op.v.nom) + "</strong>.", "Je déclare que l'objet du chèque est celui indiqué ci-dessus."],
      infos: ["Un chèque de banque est un chèque émis par la banque elle-même : la banque garantit son paiement parce que la somme est bloquée dès l'émission.", "Il est payable pendant un an et huit jours à compter de son émission. En cas de perte ou de vol, une opposition est possible, dans les cas que prévoit la loi.", "Le bénéficiaire peut en demander l'encaissement auprès de sa banque ; le chèque ne se renouvelle pas automatiquement."]
    };
  };
  TEXTES.commande_chequier = function (op, c) {
    var mode = op.v.remise, domicile = mode === "domicile", stock = mode === "stock";
    return {
      intro: soussigne(c) + ", titulaire du compte n° " + e(RIB.rib(c).compte) + " ouvert à l'agence de Paris de GS Banque &amp; Assurance, " + (stock ? "reconnais avoir reçu ce jour, en main propre, un chéquier de dépannage dans les conditions ci-dessus." : "demande la remise d'un chéquier dans les conditions ci-dessus."),
      declarations: ["Je déclare ne pas être frappé(e) d'une interdiction d'émettre des chèques et ne pas être inscrit(e) au fichier central des chèques.", "Je m'engage à conserver le chéquier avec soin et à prévenir immédiatement la banque en cas de perte ou de vol.",
        stock ? "Je reconnais avoir reçu ce jour, en main propre, les " + op.v.nb + " formules numérotées de " + (op.formules ? op.formules[0] + " à " + op.formules[1] : "la plage indiquée ci-dessus") + "." : domicile ? "J'accepte que le chéquier me soit envoyé en lettre recommandée et que les frais d'envoi soient débités de mon compte." : "Je retirerai mon chéquier en main propre à l'agence, muni(e) d'une pièce d'identité, et je signerai le reçu à la remise."],
      infos: ["Les formules sont préimprimées « barrées » : elles ne peuvent être payées que sur un compte.", "Émettre un chèque sans provision suffisante entraîne des frais, puis, si la situation n'est pas régularisée, une interdiction d'émettre des chèques pendant cinq ans.", "Un chèque doit être rempli à l'encre, daté, signé, avec le montant en chiffres et en lettres.",
        stock ? "Un chéquier de dépannage est remis tout de suite pour parer à un besoin urgent ; il compte moins de formules qu'un chéquier ordinaire." : domicile ? "Le chéquier est envoyé en lettre recommandée : le client doit être présent ou retirer le pli au bureau de poste. Si le pli n'est pas retiré, il revient à l'agence." : "Le chéquier est tenu à la disposition du client à l'agence pendant 2 mois ; au-delà, il est détruit."].filter(Boolean)
    };
  };


  /* ---------- kit de contestation d'opérations par carte ----------
     Même rubriques que les kits de contestation des banques : page de garde (mode d'emploi, titulaire, numéro de carte, RIB, situation de la carte), annexe 1 (carte perdue ou volée)
     ou annexe 2 (cas 2 : carte en possession du client, opérations jamais faites ni autorisées), annexe 3 au-delà de 10 opérations (jusqu'à 47). Le client date et signe chaque annexe.
     Le service et le courriel sont inventés (le courriel est sous le domaine réservé « .example »). */
  var COURRIEL_SERVICE = "contestation-cb@gs-banque-assurance.example";
  /* totaux : [ [libellé, montant], … ] – lignes de total sous le détail (Total (I), Total (II), TOTAL (I + II)). */
  function lignesTab(lignes, debut, totaux) {
    var t = D.tableau(["N°", "Date de la transaction", "Libellé de l'opération par carte (commerçant ou distributeur)", "Montant"],
      lignes.map(function (z, i) { return [String(debut + i), e(B.fmtDate(B.lireYmd(z.ymd))), e(z.lib), e(B.eur2(-z.m))]; }));
    var pied = (totaux || []).map(function (x) { return '<tr class="dp-total"><td colspan="3">' + e(x[0]) + '</td><td class="g">' + e(B.eur2(x[1])) + "</td></tr>"; }).join("");
    return t.replace("</tbody>", pied + "</tbody>");
  }
  function total(lignes) { return Math.round(lignes.reduce(function (t, z) { return t - z.m; }, 0) * 100) / 100; }
  function signatureKit(op, c, jour) {
    return D.lieuDate(jour) + D.signatures([{ titre: "Le titulaire de la carte", nom: D.nomComplet(cl(c)), mention: "Date et signature du titulaire de la carte (obligatoire)" }, D.signatureConseiller(jour)]);
  }
  function kit(op, c, o) {
    var v = op.v, r = RIB.rib(c), a = D.adresse(cl(c)), lignes = op.lignes || [], perdVol = v.situation === "perdue" || v.situation === "volee", nom = (PR.parId[v.carte] || {}).nom || v.carte;
    var date = (o && o.date) || dateDe(op.date);
    var jour = (o && o.jour) || (op.statut === "executee" && op.dateExec ? dateDe(op.dateExec) : B.aujourdhui());
    var opp = o && o.st ? OS.oppositionDe(o.st, c.id, v.carte) : null;        /* opposition connue au moment du kit, ou faite depuis (carte en main) */
    var refOpp = op.opposition || (opp ? opp.ref : "");
    var ymdOpp = op.oppositionDate || (opp ? opp.dateExec : "");
    var dateOpp = ymdOpp ? D.dateCourte(dateDe(ymdOpp)) : "";
    var l1 = lignes.slice(0, OS.LIGNES_PAGE1), l2 = lignes.slice(OS.LIGNES_PAGE1), t1 = total(l1), t2 = total(l2);
    var plainte = v.situation === "volee";
    var p1 = '<div class="dp-lettre dp-signer dp-kit">' +
      D.p("<strong>Service Moyens de Paiement</strong>", "dp-kit-service") + D.p("Madame, Monsieur,") +
      D.p("Vous avez constaté sur votre relevé de compte le débit d'opérations par carte bancaire que vous n'avez ni effectuées ni autorisées, et vous souhaitez les contester. Il est indispensable de compléter avec soin toutes les rubriques pour nous permettre de vous répondre rapidement. Tout dossier incomplet ne peut pas être traité : il vous est retourné.") +
      D.titre("Mode d'emploi") +
      D.liste(["<strong>Pièces à renseigner et à retourner :</strong> la présente page et " + (perdVol ? "l'annexe 1" : "l'annexe 2") + (lignes.length > OS.LIGNES_PAGE1 ? ", avec l'annexe 3 (suite du détail des opérations)," : "") + " dûment complétée" + (lignes.length > OS.LIGNES_PAGE1 ? "s" : "") + " et signée" + (lignes.length > OS.LIGNES_PAGE1 ? "s" : "") + "." +
          (plainte ? " <strong>En cas de vol de votre carte</strong>, joignez la copie du dépôt de plainte effectué par vos soins au commissariat de police ou à la gendarmerie de votre lieu de résidence." : ""),
        "<strong>Transmission :</strong> par courriel à " + e(COURRIEL_SERVICE) + " ; à défaut, sous pli affranchi à : " + e(D.AGENCE[0]) + ", Service Moyens de Paiement, " + e(D.AGENCE[1]) + ", " + e(D.AGENCE[2]) + ", " + e(D.AGENCE[3]) + "."]) +
      D.titre("Titulaire de la carte bancaire") +
      D.fiche([["Nom", e(String(c.nom).toUpperCase())], ["Prénom", e(c.prenom)], ["Adresse", e(a.ligne1)], ["Code postal et ville", e(a.ligne2)], ["E-mail", e(c.mail || "")],
        ["Numéro de la carte", e(OS.numeroCarte(c, v.carte)) + ' <span class="dp-mention">(6 premiers et 4 derniers chiffres de la carte : ' + e(nom) + ")</span>"],
        ["RIB", "Code banque " + e(r.banque) + " – code guichet " + e(r.guichet) + " – compte n° " + e(r.compte) + " – clé " + e(r.cle)]]) +
      D.titre("Ma carte est") +
      D.caseACocher("<strong>Perdue / volée</strong> – compléter l'annexe 1 uniquement" + (perdVol ? " (" + (v.situation === "volee" ? "volée" : "perdue") + ")" : ""), perdVol) +
      D.caseACocher("<strong>En ma possession</strong> – compléter l'annexe 2 uniquement", !perdVol) +
      D.p("GS Banque &amp; Assurance traite les données de ce dossier pour instruire la contestation et protéger le titulaire ; elles sont conservées le temps nécessaire à ce traitement et à ses suites. Le titulaire dispose d'un droit d'accès, de rectification et d'opposition, qu'il exerce auprès de son agence.", "dp-mention") +
      D.p("Référence de l'opération : " + e(op.ref) + " – kit préparé le " + e(D.dateLongue(dateDe(op.date))) + " à " + e(op.heure) + ".", "dp-mention") + "</div>";
    var annexe;
    if (perdVol) {
      annexe = '<div class="dp-lettre dp-signer dp-kit">' + D.titre("Annexe 1 – Votre carte est perdue ou a été volée") +
        D.fiche([["Confirmation de l'opposition", "Date à laquelle j'ai fait opposition : <strong>" + e(dateOpp || "") + "</strong>" + (refOpp ? " (" + e(refOpp) + ")" : "")],
          ["La carte a été", "<strong>" + (v.situation === "volee" ? "Volée" : "Perdue") + "</strong>"], ["Où se trouvait le code confidentiel", e(v.pin)],
          ["Date de constat de la perte ou du vol", e(v.constat ? B.fmtDate(B.lireYmd(v.constat)) : "")],
          ["Dernière opération effectuée par mes soins avant la perte ou le vol", e(v.derniere === "aucune" ? "Aucune opération récente" : derniereTexte(v, c))],
          ["Déclaration détaillée des circonstances", e(v.circonstances)]]) +
        D.p("<strong>Je conteste et déclare sur l'honneur n'avoir jamais effectué avec ma carte bancaire la ou les opérations précisées dans le détail ci-dessous.</strong>") +
        D.titre("Détail des opérations") + lignesTab(l1, 1, [["Total (I)", t1]]) +
        (l2.length ? D.p("Plus de 10 opérations contestées : suite du détail dans l'annexe 3.", "dp-mention") : "") +
        '<div class="dp-fin">' + (l2.length ? "" : D.p("Document établi en deux exemplaires : un pour le client, un pour la banque, qui le transmet au Service Moyens de Paiement. " + e(OS.PAR_ID[op.type].doc) + " – opération " + e(op.ref) + ".", "dp-mention")) + signatureKit(op, c, jour) + "</div></div>";
    } else {
      annexe = '<div class="dp-lettre dp-signer dp-kit">' + D.titre("Annexe 2 – Votre carte est en votre possession") +
        D.caseACocher("<strong>Cas 1</strong> – je reconnais avoir effectué le paiement, mais il a été débité plusieurs fois, son montant est erroné ou le service n'a pas été rendu : <em>non concerné par ce kit</em>", false) +
        D.caseACocher("<strong>Cas 2</strong> – je conteste et déclare sur l'honneur n'avoir jamais effectué avec ma carte bancaire, ni autorisé, la ou les opérations précisées dans le détail ci-dessous", true) +
        D.fiche([["Opposition", dateOpp ? "Date à laquelle j'ai fait opposition : <strong>" + e(dateOpp) + "</strong>" + (refOpp ? " (" + e(refOpp) + ")" : "") : "Opposition pour utilisation frauduleuse enregistrée avec ce kit (opération « Opposition sur une carte »)"],
          ["Résidence à l'étranger durant les 6 derniers mois", v.etranger === "oui" ? "<strong>Oui</strong>, du " + e(v.etrDu ? B.fmtDate(B.lireYmd(v.etrDu)) : "") + " au " + e(v.etrAu ? B.fmtDate(B.lireYmd(v.etrAu)) : "") + " – pays : " + e(v.etrPays) : "<strong>Non</strong>"],
          ["Déclaration détaillée des circonstances", e(v.circonstances)]]) +
        D.titre("Détail des opérations") + lignesTab(l1, 1, [["Total (I)", t1]]) +
        (l2.length ? D.p("Plus de 10 opérations contestées : suite du détail dans l'annexe 3.", "dp-mention") : "") +
        '<div class="dp-fin">' + (l2.length ? "" : D.p("Document établi en deux exemplaires : un pour le client, un pour la banque, qui le transmet au Service Moyens de Paiement. " + e(OS.PAR_ID[op.type].doc) + " – opération " + e(op.ref) + ".", "dp-mention")) + signatureKit(op, c, jour) + "</div></div>";
    }
    var corps = p1 + '<hr class="dp-saut">' + annexe;
    if (l2.length) {
      corps += '<hr class="dp-saut"><div class="dp-lettre dp-signer dp-kit">' + D.titre("Annexe 3 – Suite du détail des opérations (plus de 10 opérations)") +
        lignesTab(l2, OS.LIGNES_PAGE1 + 1, [["Total (II)", t2], ["TOTAL (I + II)", t1 + t2]]) +
        '<div class="dp-fin">' + D.p("Document établi en deux exemplaires : un pour le client, un pour la banque, qui le transmet au Service Moyens de Paiement. " + e(OS.PAR_ID[op.type].doc) + " – opération " + e(op.ref) + ".", "dp-mention") + signatureKit(op, c, jour) + "</div></div>";
    }
    return { id: op.type, titre: OS.PAR_ID[op.type].doc, sous: "Kit à signer par le client – " + op.ref, courrier: false, signataire: "client", fichier: D.fichier(PREFIXES[op.type], cl(c), date), corps: corps };
  }
  /* La dernière opération faite par le client est enregistrée par sa clé (date, montant, libellé) : le texte du kit en reprend les trois éléments. */
  function derniereTexte(v, c) {
    var p = String(v.derniere || "").split("|");
    return p.length >= 3 ? B.fmtDate(B.lireYmd(p[0])) + " – " + p.slice(2).join("|") + " – " + eur(-parseFloat(p[1])) : "";
  }

  function pied(op) {
    var t = OS.PAR_ID[op.type];
    return '<p class="dp-mention">Document établi en deux exemplaires : un pour ' + (op.type === "desolidarisation_compte" ? "les cotitulaires" : "le client") + ", un pour la banque. " + e(t.doc) + " – opération " + e(op.ref) + ".</p>";
  }

  /* Cadres de signature : le client ; pour la clôture d'un compte joint, le cotitulaire aussi ; puis la banque. */
  function cadresSignature(op, c, jour) {
    var l = [{ titre: "Le client", nom: D.nomComplet(cl(c)), mention: MENTIONS_SIGNATURE[op.type] + " (mention manuscrite et signature)" }];
    if (op.type === "desolidarisation_compte" && op.desol) l.push({ titre: "Le cotitulaire du compte joint", nom: nomPers(op.desol.cotitulaire), mention: MENTIONS_SIGNATURE[op.type] + " (mention manuscrite et signature)", legende: "Signature du cotitulaire" });
    if (op.type === "cloture_compte" && op.cloture && op.cloture.cotitulaireNom) l.push({ titre: "Le cotitulaire du compte joint", nom: op.cloture.cotitulaireNom, mention: "Lu et approuvé, bon pour clôture (mention manuscrite et signature)", legende: "Signature du cotitulaire" });
    l.push(D.signatureConseiller(jour));
    return l;
  }

  /* Document à signer par le client pour une opération de service. */
  function document(op, c, o) {
    if (op.type === "contestation_carte") return kit(op, c, o);
    var t = OS.PAR_ID[op.type], date = (o && o.date) || dateDe(op.date), tx = TEXTES[op.type](op, c);
    /* Jour de la signature : celui de l'exécution si l'opération est exécutée, sinon le jour même (le client signe quand la banque lui remet le document). */
    var jourSignature = (o && o.jour) || (op.statut === "executee" && op.dateExec ? dateDe(op.dateExec) : B.aujourdhui());
    var corps = '<div class="dp-lettre dp-signer">' +
      blocClient(c, op) + blocOperation(op) +
      D.titre(op.type === "desolidarisation_compte" ? "Déclaration des deux cotitulaires" : "Déclaration du client") + D.p(tx.intro) + D.liste(tx.declarations) +
      '<div class="dp-fin">' + bloc(op.type === "desolidarisation_compte" ? "Ce que les cotitulaires doivent savoir" : "Ce que le client doit savoir", tx.infos) + pied(op) + D.lieuDate(jourSignature) +
      D.signatures(cadresSignature(op, c, jourSignature)) + "</div></div>";
    return { id: op.type, titre: t.doc, sous: "Document à signer par le client – " + op.ref, courrier: false, signataire: "client", fichier: D.fichier(PREFIXES[op.type], cl(c), date), corps: corps };
  }


  /* ---------- attestation de clôture du compte et des épargnes ----------
     Remise au client par la banque une fois la clôture exécutée : elle atteste que le compte courant (et les livrets clôturés avec lui) sont clôturés et soldés, indique comment le solde a été versé
     et que les moyens de paiement sont résiliés. Datée, tamponnée et signée par le conseiller. Les numéros des livrets sont imaginaires (déduits du numéro de client). */
  function numEpargne(c, p) { var h = 7, t = c.num + "|epa|" + p, i; for (i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 1000003; return "EP" + ("000000000" + ((h * 977) % 1000000000)).slice(-9); }
  function attestation(op, c, o) {
    if (op.type === "desolidarisation_compte") return attestationDesol(op, c, o);
    var k = op.cloture || { compte: {}, epargnes: [], gardees: [], cartes: [] }, jour = dateDe(op.dateExec || op.date), eps = k.epargnes || [], co = k.cotitulaireNom;
    var lignes = [["Compte courant", "n° " + e(k.compte.compte) + "<br>IBAN " + e(k.compte.ibanLisible), e(eur(k.compte.solde))]].concat(eps.map(function (z) {
      return [e(z.nom), "n° " + e(numEpargne(c, z.p)), e(eur(z.solde))];
    }));
    var titre = "Attestation de clôture de compte" + (eps.length ? " et d'épargne" + (eps.length > 1 ? "s" : "") : "");
    var versement = k.total > 0 ? (k.mode === "cheque" ? "Le solde de ces comptes, soit <strong>" + e(eur(k.total)) + "</strong>, a été remis au client le " + e(D.dateLongue(jour)) + " sous la forme d'un chèque de banque n° " + e(k.cheque) + " établi à son ordre" + (k.commission ? ", d'un montant de <strong>" + e(eur(k.verse)) + "</strong> après déduction de la commission de " + e(eur(k.commission)) + " du chèque de banque" : "") + "."
      : "Le solde de ces comptes, soit <strong>" + e(eur(k.total)) + "</strong>, a été versé le " + e(D.dateLongue(jour)) + " par virement sur le compte " + e(k.ibanDestLisible) + ", ouvert au nom de " + e(k.titulaireDest) + " auprès d'une autre banque.")
      : "Ces comptes ne présentaient aucun solde à verser.";
    var gardees = (k.gardees || []).length ? D.p("Ne sont pas concernés par cette attestation et restent ouverts : " + e(k.gardees.map(function (z) { return z.nom; }).join(", ")) + ".", "dp-mention") : "";
    var corps = '<div class="dp-lettre dp-attestation">' +
      D.p("<strong>GS Banque &amp; Assurance – Agence de Paris</strong>, 27 rue de Châteaudun, 75009 Paris, atteste que :", "dp-att-intro") +
      D.fiche([["Titulaire" + (co ? "s" : ""), e(D.nomComplet(cl(c))) + (co ? " et " + e(co) : "") + " (n° client " + e(c.num) + ")"], ["Adresse", e(D.adresse(cl(c)).ligne1) + ", " + e(D.adresse(cl(c)).ligne2)]]) +
      D.p("a demandé la clôture " + (co ? "du compte joint" : "du compte courant") + (eps.length ? " et " + (eps.length > 1 ? "des comptes d'épargne" : "du compte d'épargne") : "") + " ci-dessous, <strong>clôturé" + (eps.length ? "s" : "") + " le " + e(D.dateLongue(jour)) + "</strong>.") +
      D.tableau(["Compte clôturé", "Numéro", "Solde versé au client"], lignes) +
      D.p(versement) +
      D.titre("Moyens de paiement et services") +
      D.liste(["Cartes bancaires restituées et résiliées" + ((k.cartes || []).length ? " : " + e(k.cartes.join(", ")) : "") + " ; chéquiers non utilisés restitués.", "Services liés au compte résiliés (banque à distance, alertes, abonnements).",
        "Chèques émis pointés avec le client ; aucun incident de paiement de chèque à régulariser."]) +
      D.p("À la date de la présente attestation, " + (eps.length ? "ces comptes sont clôturés et ne présentent plus aucun solde" : "ce compte est clôturé et ne présente plus aucun solde") + ". Plus aucune opération n'y est possible : les prélèvements et les chèques présentés ensuite sont rejetés.") +
      gardees +
      D.p("La présente attestation est établie à la demande du client, pour servir et valoir ce que de droit.") +
      '<div class="dp-fin">' + D.lieuDate(jour) + D.signatures([D.signatureConseiller(jour)]) +
      '<p class="dp-mention">' + e(titre) + " – opération " + e(op.ref) + ".</p></div></div>";
    return { id: "attestation_cloture", titre: titre, sous: "Attestation remise au client – " + op.ref, courrier: false, signataire: "banque", fichier: D.fichier("Attestation_cloture_compte", cl(c), (o && o.date) || jour), corps: corps };
  }

  /* ---------- attestation de désolidarisation d'un compte joint ----------
     Remise aux deux titulaires par la banque une fois l'opération exécutée : la solidarité a pris fin, le compte est devenu le compte individuel de l'un d'eux, l'autre n'en est plus titulaire. */
  function attestationDesol(op, c, o) {
    var k = op.desol || { compte: {}, client: c, cotitulaire: {}, cartes: [] }, cpt = k.compte || {}, jour = dateDe(op.dateExec || op.date), dj = D.dateLongue(jour);
    var garde = k.conserve === "client" ? k.client : k.cotitulaire, part = k.conserve === "client" ? k.cotitulaire : k.client;
    var corps = '<div class="dp-lettre dp-attestation">' +
      D.p("<strong>GS Banque &amp; Assurance – Agence de Paris</strong>, 27 rue de Châteaudun, 75009 Paris, atteste que :", "dp-att-intro") +
      D.fiche([["Anciens cotitulaires", e(nomPers(k.client)) + " (n° client " + e(c.num) + ") et " + e(nomPers(k.cotitulaire))], ["Adresse", e(D.adresse(cl(c)).ligne1) + ", " + e(D.adresse(cl(c)).ligne2)]]) +
      D.p("ont demandé ensemble, par lettre signée de chacun, la désolidarisation du compte joint ci-dessous. <strong>La solidarité entre les cotitulaires a pris fin le " + e(dj) + "</strong>, et le compte a été transformé à la même date en compte individuel.") +
      D.tableau(["Compte", "Numéro et IBAN", "Titulaire depuis le " + e(B.fmtDate(jour))], [["Compte courant", "n° " + e(cpt.compte) + "<br>IBAN " + e(cpt.ibanLisible), "<strong>" + e(nomPers(garde)) + "</strong>"]]) +
      D.p("<strong>" + e(nomPers(garde)) + "</strong> est désormais le seul titulaire de ce compte. <strong>" + e(nomPers(part)) + "</strong> n'en est plus titulaire.") +
      D.titre("Ce que change la désolidarisation") +
      D.liste(["Le numéro de compte et l'IBAN ne changent pas ; l'intitulé du compte, le RIB et les relevés sont établis au seul nom de " + e(nomPers(garde)) + ".",
        e(nomPers(part)) + " reste tenu envers la banque des dettes nées avant le " + e(B.fmtDate(jour)) + " (solde débiteur, chèques et paiements par carte pas encore débités), jusqu'à leur paiement.",
        "Les cartes bancaires et les chéquiers de " + e(nomPers(part)) + " sont restitués et résiliés" + (k.conserve === "cotitulaire" && (k.cartes || []).length ? " : " + e(k.cartes.join(", ")) : "") + ".",
        k.repriseDebit ? "Le solde débiteur du compte à cette date, soit " + e(eur(-k.solde)) + ", est repris par " + e(nomPers(garde)) + "." : (k.solde > 0.005 ? "Le solde créditeur du compte à cette date, soit " + e(eur(k.solde)) + ", reste sur le compte, au nom de " + e(nomPers(garde)) + "." : "Le compte présente un solde nul à cette date."),
        k.decouvert > 0 ? "Le découvert autorisé de " + e(eur(k.decouvert)) + " est réexaminé pour le seul titulaire conservé." : "Aucun découvert n'était autorisé sur ce compte."]) +
      D.p("La présente attestation est établie à la demande des deux titulaires, pour servir et valoir ce que de droit.") +
      '<div class="dp-fin">' + D.lieuDate(jour) + D.signatures([D.signatureConseiller(jour)]) +
      '<p class="dp-mention">Attestation de désolidarisation de compte joint – opération ' + e(op.ref) + ".</p></div></div>";
    return { id: "attestation_desolidarisation", titre: "Attestation de désolidarisation de compte joint", sous: "Attestation remise aux deux titulaires – " + op.ref, courrier: false, signataire: "banque", fichier: D.fichier("Attestation_desolidarisation_compte", cl(c), (o && o.date) || jour), corps: corps };
  }

  /* ---------- lettre de désistement : à remplir par le bénéficiaire du chèque ----------
     Le bénéficiaire d'un chèque qu'il a perdu écrit à l'émetteur (le client de la banque) : il renonce à l'encaisser et s'engage à le restituer s'il le retrouve.
     Le formulaire est remis tel quel : l'émetteur (le client) est pré-rempli ; les champs du bénéficiaire restent à remplir à la main. Si un chèque est déjà connu (opposition),
     son numéro, son montant, sa date d'émission et son bénéficiaire sont repris. */
  function desistement(c, o) {
    o = o || {};
    var date = o.date || B.aujourdhui(), a = D.adresse(cl(c)), ch = o.cheque || {}, t = D.trait;
    var corps = '<div class="dp-lettre dp-remplir">' +
      '<p class="dp-mention"><strong>Document à faire remplir par le bénéficiaire du chèque.</strong> Le bénéficiaire le complète à la main, le date, le signe et l\'adresse à l\'émetteur, de préférence en lettre recommandée avec accusé de réception.</p>' +
      D.titre("Le bénéficiaire du chèque (à remplir)") +
      D.fiche([["Nom ou raison sociale", ch.beneficiaire ? "<strong>" + e(ch.beneficiaire) + "</strong>" : t(true)], ["Adresse", t(true)], ["Téléphone et e-mail", t(true)], ["Qualité du signataire (si société)", t(true)]]) +
      D.titre("L'émetteur du chèque") +
      D.fiche([["Nom", e(D.nomComplet(cl(c)))], ["Adresse", e(a.ligne1) + ", " + e(a.ligne2)]]) +
      '<p class="dp-lieu">Fait à ' + t() + ", le " + t() + "</p>" +
      '<p class="dp-lettre-objet"><strong>Objet :</strong> désistement du chèque n° ' + (ch.numero ? "<strong>" + e(ch.numero) + "</strong>" : t()) + "</p>" +
      D.p("Madame, Monsieur,") +
      D.p("Je soussigné(e) " + t(true) + ", bénéficiaire du chèque dont les références figurent ci-dessous, déclare renoncer à l'encaisser.") +
      D.fiche([["Numéro du chèque", ch.numero ? "<strong>" + e(ch.numero) + "</strong>" : t()], ["Banque tirée (banque de l'émetteur)", "GS Banque &amp; Assurance – Agence de Paris"], ["Date d'émission", ch.emission ? "<strong>" + e(ch.emission) + "</strong>" : t()], ["Montant", ch.montant ? "<strong>" + e(ch.montant) + "</strong>" : t()],
        ["Facture ou contrat réglé par ce chèque (numéro)", t(true)]]) +
      D.p("Ce chèque (cocher la case qui convient) :") +
      D.caseACocher("ne m'est jamais parvenu ;", false) + D.caseACocher("a été perdu.", false) +
      D.p("Je m'engage à ne pas l'encaisser. Si je le retrouve, je m'engage à vous le restituer sans délai.") +
      D.p("Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.") +
      D.signatures([{ titre: "Le bénéficiaire du chèque", mention: "Nom, qualité, date et signature" }]) +
      '<p class="dp-mention">Cette lettre ne remplace pas l\'opposition, qui est une autre démarche faite par l\'émetteur auprès de sa banque dans les seuls cas de perte, de vol, d\'utilisation frauduleuse ou de procédure collective du bénéficiaire (article L131-35 du Code monétaire et financier). Elle sert de preuve si le chèque est encaissé frauduleusement.</p>' +
      "</div>";
    return { id: "desistement", titre: "Lettre de désistement d'un chèque", sous: "Document à faire remplir par le bénéficiaire du chèque", courrier: false, signataire: "beneficiaire", fichier: D.fichier("Lettre_de_desistement", cl(c), date), corps: corps };
  }

  /* ---------- procédure MURCEF du chèque sans provision : les deux courriers de la banque ----------
     Modèles pour un client de la banque : identité, adresse et numéro de compte sont remplis, la date limite de régularisation est calculée toute seule à partir de la date du courrier
     (5 jours ouvrés, hors week-end et jours fériés, jusqu'à 12 h) ; le numéro et le montant du chèque, le solde et la date du rejet restent à compléter à la main (injonction.js : modele). */
  function injonction() { return (root && root.SGBF && root.SGBF.injonction) || (typeof require === "function" ? require("./injonction.js") : null); }
  function courrierInformation(c, o) {
    o = o || {};
    var I = injonction(), l = I.information(I.modele(cl(c)), { date: o.date || B.aujourdhui() });
    return I.documentInformation(l);
  }
  function lettreInjonction(c, o) {
    o = o || {};
    var I = injonction(), l = I.lettreDepuis(I.modele(cl(c)), { date: o.date || B.aujourdhui(), qualite: o.qualite });
    return I.document(l);
  }

  var api = { document: document, attestation: attestation, desistement: desistement, courrierInformation: courrierInformation, lettreInjonction: lettreInjonction, TEXTES: TEXTES, PREFIXES: PREFIXES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.documentsService = api; }
})(typeof window !== "undefined" ? window : null);
