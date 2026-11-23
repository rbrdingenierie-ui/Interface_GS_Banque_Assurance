/* GS Banque & Assurance – courriers d'une saisie administrative à tiers détenteur (SATD) : la réponse de la banque au comptable public, la lettre d'information du client et celle de chaque cotitulaire d'un compte joint.
   Ce module ne fabrique que le texte (HTML) : l'impression se fait avec impression.js. Chaque document est { id, titre, sous, fichier, courrier, lettre, corps }.
   Les règles et les montants viennent de satd.js (calcul enregistré avec la saisie). Textes vérifiés (novembre 2026) : service-public.gouv.fr (fiche F31716), impots.gouv.fr, Banque de France,
   Livre des procédures fiscales (article L262, articles L281 à L283). Fonctions pures, testées avec Node. */
(function (root) {
  "use strict";

  var D = (root && root.SGBF && root.SGBF.documents) || require("./documents.js");
  var B = (root && root.SGBF && root.SGBF.banque) || require("./banque.js");
  var S = (root && root.SGBF && root.SGBF.satd) || require("./satd.js");
  var RIB = (root && root.SGBF && root.SGBF.rib) || require("./rib.js");

  var e = D.esc;
  function ymd(t) { return B.lireYmd(t); }
  function dl(t) { return D.dateLongue(ymd(t)); }
  function eur(x) { return D.montant(x); }
  function nomComplet(p) { return p.civ + " " + p.prenom + " " + String(p.nom).toUpperCase(); }
  function feminin(p) { return p.civ === "Mme" || p.civ === "Mlle"; }
  function appel(p) { return feminin(p) ? "Madame" : "Monsieur"; }
  function destinataire(p) { return '<div class="dp-lettre-dest"><p><strong>' + e(nomComplet(p)) + "</strong><br>" + e(p.rue || "") + "<br>" + e((p.cp ? p.cp + " " : "") + (p.ville || "")) + "</p></div>"; }
  function entete(date, refs, objet, envoi) {
    return (envoi ? '<p class="dp-lettre-envoi"><strong>' + e(envoi) + "</strong></p>" : "") + '<p class="dp-lettre-refs"><strong>Références :</strong> ' + e(refs) + "</p>" +
      '<p class="dp-lettre-date">Paris, le ' + e(D.dateLongue(date)) + "</p>" + '<p class="dp-lettre-objet"><strong>Objet :</strong> ' + e(objet) + "</p>";
  }
  function formule(appelTxt, date) { return "<p>Veuillez agréer, " + appelTxt + ", l'expression de nos salutations distinguées.</p>" + D.signatureBanque(null, date); }
  function fin(p, date) { return formule(appel(p), date); }
  /* Personne d'après un client de l'agence (même forme que la personne d'un dossier d'ouverture) */
  function personne(c) { return { civ: c.civ, prenom: c.prenom, nom: c.nom, naissance: "", rue: c.adr ? c.adr.rue : "", cp: c.adr ? c.adr.cp : "", ville: c.adr ? c.adr.ville : "" }; }
  /* Ce que la saisie concerne : « Impôt sur le revenu, 300 € » */
  function creance(r) { return S.lib(S.NATURES, r.nature) + ", montant dû : " + eur(r.du); }
  function explication(k) {
    if (k.aVerser > 0) return "Les comptes sont bloqués du " + dl(k.recu) + " au " + dl(k.versement) + " (15 jours) : " +
      (k.mode === "tous" ? "tous vos comptes, la dette étant de 2 000 € ou plus, à l'exception du solde bancaire insaisissable de " + eur(k.sbi) + " laissé à votre disposition" : "seule la somme due de " + eur(k.aVerser) + " est bloquée") + ".";
    return k.raison === "debiteur" ? "Vos comptes sont débiteurs : la somme due ne peut pas y être prélevée." : "Les sommes disponibles sur vos comptes ne dépassent pas le solde bancaire insaisissable de " + eur(k.sbi) + " : elles restent à votre disposition.";
  }
  function fraisTexte(k, r) {
    return "Conformément à la réglementation, la banque peut facturer des frais pour le traitement d'une saisie administrative à tiers détenteur : au plus 10 % du montant dû, dans la limite de 100 € TTC. Ils s'élèvent ici à " + eur(k.frais) +
      (k.plafonne ? " (10 % de " + eur(r.du) + " dépasseraient 100 €)" : " (10 % de " + eur(r.du) + ")") + " et sont débités de votre compte courant le " + dl(k.recu) + ".";
  }
  function tableauComptes(k) {
    var lignes = k.comptes.map(function (x) { return [e(x.nom), eur(Math.max(0, x.solde)) + (x.solde < 0 ? " (compte débiteur : " + eur(x.solde) + ")" : ""), eur(x.credit), eur(x.garde), eur(x.saisissable)]; });
    return D.tableau(["Compte", "Solde", "Solde créditeur pris en compte", "Laissé à disposition (SBI)", "Saisissable"], lignes.concat([["<strong>Total</strong>", "", "<strong>" + eur(k.total) + "</strong>", "<strong>" + eur(k.gardeSbi) + "</strong>", "<strong>" + eur(k.saisissable) + "</strong>"]]));
  }
  /* Compte joint ou indivis : les autres titulaires sont informés de la saisie */
  function formeCompte(c) {
    var rb = RIB.rib(c);
    if (!rb.joint) return "";
    return "<p>Votre compte est un " + (rb.forme === "indivis" ? "compte indivis" : "compte joint") + " : " + (rb.coTitulaires.length > 1 ? "les autres titulaires sont informés" : "l'autre titulaire est informé") + " de la saisie, et le compte est saisi dans les mêmes conditions. Il peut demander la mainlevée au juge de l'exécution pour les fonds qui lui appartiennent.</p>";
  }
  function ref(c, r) { return "Avis à tiers détenteur n° " + r.avis + " du " + S.lib(S.SERVICES, r.service) + " – notre dossier " + r.ref; }

  /* Réponse de la banque au comptable public : situation des comptes à la date de réception, somme qui sera versée, frais. */
  function reponseTresor(c, r, redevable) {
    var k = r.calcul, date = ymd(k.recu), p = redevable;
    var corps = '<div class="dp-lettre dp-satd">' +
      '<div class="dp-lettre-dest"><p><strong>' + e(S.lib(S.SERVICES, r.service)) + "</strong><br>Comptable public – adresse indiquée sur l'avis</p></div>" +
      entete(date, ref(c, r), "réponse de la banque, tiers détenteur, à l'avis de saisie administrative à tiers détenteur n° " + r.avis, "Réponse transmise sans délai à réception de l'avis") +
      "<p>Madame, Monsieur,</p>" +
      "<p>Nous avons reçu le " + e(dl(k.recu)) + " l'avis de saisie administrative à tiers détenteur n° <strong>" + e(r.avis) + "</strong> (article L262 du Livre des procédures fiscales) visant <strong>" + e(nomComplet(p)) + "</strong>" +
      (p.naissance ? ", né" + (feminin(p) ? "e" : "") + " le " + e(dl(p.naissance)) : "") + ", demeurant " + e((p.rue || "") + ", " + (p.cp || "") + " " + (p.ville || "")) + ", pour la créance suivante : <strong>" + e(creance(r)) + "</strong>.</p>" +
      "<h3>Situation des comptes à la date de réception de l'avis</h3>" + tableauComptes(k) +
      "<p>Le solde bancaire insaisissable (" + e(eur(k.sbi)) + ", montant du revenu de solidarité active pour une personne seule) est laissé à la disposition du redevable.</p>" +
      "<h3>Suite donnée à l'avis</h3>" +
      (k.aVerser > 0 ? D.liste(["Somme versée au Trésor public : <strong>" + e(eur(k.aVerser)) + "</strong>, le <strong>" + e(dl(k.versement)) + "</strong> à l'issue du blocage de 15 jours, dans le délai de 30 jours (au plus tard le " + e(dl(k.limite)) + ").",
        k.reste > 0 ? "Reste dû après ce versement : " + e(eur(k.reste)) + " (la somme disponible est insuffisante pour couvrir la créance) ; nous restons à la disposition de l'administration pour un nouvel avis." : "La créance est couverte en totalité.",
        k.mode === "tous" ? "Tous les comptes du redevable sont bloqués pendant 15 jours (dette de 2 000 € ou plus), à l'exception du solde bancaire insaisissable." : "Seule la somme due est bloquée pendant 15 jours."]) :
        "<p>" + e(k.raison === "debiteur" ? "Les comptes du redevable sont débiteurs : aucune somme ne peut être prélevée." : "Les sommes disponibles ne dépassent pas le solde bancaire insaisissable : aucune somme ne peut être prélevée.") + " Aucun versement ne sera effectué.</p>") +
      "<p>Le redevable a été informé de l'avis par courrier de ce jour. Les frais bancaires de traitement (10 % du montant dû, 100 € TTC au plus) sont à sa charge : " + e(eur(k.frais)) + ".</p>" +
      formule("Madame, Monsieur", date) +
      "</div>";
    return { id: "satd_tresor", titre: "Réponse au comptable public – saisie administrative à tiers détenteur", sous: String(p.nom).toUpperCase() + " " + p.prenom + " – avis " + r.avis + " – saisie du " + D.dateCourte(date),
      fichier: D.fichier("SATD_Reponse_Tresor", { nom: p.nom, prenom: p.prenom }, date), courrier: false, lettre: true, corps: corps };
  }

  /* Lettre d'information du redevable (le client) : l'avis, le blocage, les sommes laissées à disposition, le versement, les frais, ses droits. */
  function infoClient(c, r, redevable) {
    var k = r.calcul, date = ymd(k.recu), p = redevable;
    var corps = '<div class="dp-lettre dp-satd">' + destinataire(p) +
      entete(date, ref(c, r), "saisie administrative à tiers détenteur – avis n° " + r.avis + (k.aVerser > 0 ? " – blocage de vos comptes" : ""), "Lettre recommandée avec accusé de réception") +
      "<p>" + appel(p) + ",</p>" +
      "<p>Le " + e(dl(k.recu)) + ", nous avons reçu du <strong>" + e(S.lib(S.SERVICES, r.service)) + "</strong> un avis de saisie administrative à tiers détenteur (article L262 du Livre des procédures fiscales) pour la créance suivante : <strong>" + e(creance(r)) + "</strong>. " +
      "Cet avis vous a été notifié en même temps qu'à nous. La banque est tenue de l'appliquer.</p>" +
      "<h3>Ce que cela change pour vos comptes</h3>" +
      D.liste([e(explication(k)),
        k.aVerser > 0 ? "Somme qui sera versée au Trésor public : <strong>" + e(eur(k.aVerser)) + "</strong>, le <strong>" + e(dl(k.versement)) + "</strong> (nous disposons de 30 jours pour la verser, soit au plus tard le " + e(dl(k.limite)) + ")." : "Aucune somme n'est versée au Trésor public : l'administration peut adresser un nouvel avis.",
        k.aVerser > 0 && k.reste > 0 ? "Après ce versement, il reste " + e(eur(k.reste)) + " à régler directement à l'administration." : "",
        "Un solde bancaire insaisissable de <strong>" + e(eur(k.sbi)) + "</strong>, équivalent au montant du RSA pour une personne seule, reste à votre disposition pour vos besoins courants : vos prélèvements et vos achats courants peuvent continuer dans cette limite.",
        e(fraisTexte(k, r))].filter(Boolean)) +
      "<h3>Vos droits</h3>" +
      D.liste(["<strong>Sommes insaisissables.</strong> Si votre compte contient des prestations qui ne peuvent pas être saisies (RSA, prime d'activité, allocations familiales, allocation aux adultes handicapés…), vous pouvez nous demander de vous les restituer dans les 15 jours suivant la notification de l'avis, en justifiant leur origine.",
        "<strong>Contestation.</strong> Vous pouvez contester la saisie, par écrit et avec vos justificatifs, dans un délai de 2 mois, auprès de la direction départementale des finances publiques (DDFIP) du département où la saisie a été décidée : avis irrégulier, dette contestée, montant tenant compte de vos paiements, somme non exigible (délai de paiement accordé et non échu). L'administration vous accuse réception et dispose de 2 mois pour répondre ; sans réponse, la contestation est réputée rejetée. Vous pouvez alors saisir le juge dans un délai de 2 mois (juge de l'exécution pour l'irrégularité de l'avis ; tribunal administratif ou judiciaire selon l'impôt).",
        "<strong>Mainlevée.</strong> Seul le service qui a émis l'avis peut décider de lever la saisie (paiement de la dette, délai de paiement accordé, contestation acceptée). Il la notifie à la banque, qui rétablit alors le fonctionnement normal de vos comptes dans les plus brefs délais.",
        "Pour toute question sur la dette elle-même, contactez le service qui a émis l'avis (coordonnées sur l'avis) ou votre espace particulier sur impots.gouv.fr."]) +
      formeCompte(c) +
      fin(p, date) + D.p("Pièce jointe : copie de l'avis à tiers détenteur n° " + e(r.avis) + ".", "dp-lettre-pj") + "</div>";
    return { id: "satd_client", titre: "Lettre d'information du client – saisie administrative à tiers détenteur", sous: String(p.nom).toUpperCase() + " " + p.prenom + " – avis " + r.avis + " – saisie du " + D.dateCourte(date),
      fichier: D.fichier("SATD_Information_client", { nom: p.nom, prenom: p.prenom }, date), courrier: false, lettre: true, corps: corps };
  }

  /* Lettre à un cotitulaire d'un compte joint : le compte est saisi pour la dette de l'autre titulaire ; il peut demander la mainlevée pour les fonds qui lui appartiennent. */
  function infoCotitulaire(c, r, redevable, cotitulaire) {
    var k = r.calcul, date = ymd(k.recu), p = redevable, t = Object.assign({ rue: p.rue, cp: p.cp, ville: p.ville }, cotitulaire);
    var corps = '<div class="dp-lettre dp-satd">' + destinataire(t) +
      entete(date, ref(c, r), "compte joint – saisie administrative à tiers détenteur visant " + nomComplet(p) + " – avis n° " + r.avis, "Lettre recommandée avec accusé de réception") +
      "<p>" + appel(t) + ",</p>" +
      "<p>Le " + e(dl(k.recu)) + ", nous avons reçu du " + e(S.lib(S.SERVICES, r.service)) + " un avis de saisie administrative à tiers détenteur visant <strong>" + e(nomComplet(p)) + "</strong>, avec lequel vous êtes cotitulaire d'un compte joint, pour la créance suivante : " + e(creance(r)) + ".</p>" +
      "<p>Un compte joint peut être saisi pour la dette de l'un de ses titulaires. " + e(explication(k)) + (k.aVerser > 0 ? " Une somme de " + e(eur(k.aVerser)) + " sera versée au Trésor public le " + e(dl(k.versement)) + "." : "") + "</p>" +
      "<p><strong>Vos droits.</strong> Si vous n'êtes pas concerné(e) par cette dette, vous pouvez demander au juge de l'exécution la mainlevée de la saisie pour les fonds qui vous appartiennent, en justifiant de leur origine. Vous pouvez aussi contester la saisie dans les mêmes conditions que le redevable (contestation écrite dans les 2 mois auprès de la DDFIP).</p>" +
      fin(t, date) + "</div>";
    return { id: "satd_cotitulaire", titre: "Lettre d'information du cotitulaire – saisie administrative à tiers détenteur", sous: String(t.nom).toUpperCase() + " " + t.prenom + " – avis " + r.avis + " – saisie du " + D.dateCourte(date),
      fichier: D.fichier("SATD_Information_cotitulaire", { nom: t.nom, prenom: t.prenom }, date), courrier: false, lettre: true, corps: corps };
  }

  var api = { personne: personne, reponseTresor: reponseTresor, infoClient: infoClient, infoCotitulaire: infoCotitulaire };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.documentsSatd = api; }
})(typeof window !== "undefined" ? window : null);
