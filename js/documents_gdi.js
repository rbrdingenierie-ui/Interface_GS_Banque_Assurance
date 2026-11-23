/* GS Banque & Assurance – documents de la gestion des incidents (GDI).
   Cinq courriers de la banque au client, selon le palier (15, 30, 60 et 90 jours à l'état débiteur), et un document à signer par le client : l'engagement de régularisation.
   courrier(id, dossier, { date }) et engagement(dossier, moyens, { date }) renvoient { id, titre, sous, fichier, courrier, corps }.
   Les dates sont calculées à partir de la date de l'exercice (le jour de l'envoi) : le débit a commencé « palier » jours plus tôt.
   Rappels de droit repris dans les textes (sans numéro d'article du Code de la consommation, dont la numérotation change avec la réforme du crédit à la consommation de novembre 2026) :
   – information écrite du client en cas de dépassement significatif de plus d'un mois ;
   – résiliation d'un compte de dépôt à l'initiative de la banque : préavis de deux mois (art. L312-1-1 du Code monétaire et financier) ;
   – droit au compte auprès de la Banque de France (art. L312-1 du Code monétaire et financier). */
(function (root) {
  "use strict";

  var D = (root && root.SGBF && root.SGBF.documents) || require("./documents.js");
  var G = (root && root.SGBF && root.SGBF.gdi) || require("./rules_incidents.js");

  var LRAR = "Lettre recommandée avec accusé de réception";
  var TAUX_MOIS = "1,45 %", TAUX_AN = "17,40 %";

  function refs(d, date) { return "compte n° " + d.client.compte + " – dossier GDI " + d.id + " du " + D.dateCourte(date); }
  function debutDe(d, date) { return D.plusJours(date, -d.palier); }
  function autorisation(d) {
    return d.compte.autorisation > 0 ? "une autorisation de découvert de " + D.montant(d.compte.autorisation) : "aucune autorisation de découvert";
  }

  /* Tableau récapitulatif de la situation du compte, commun aux courriers. */
  function situation(d, date) {
    var dep = G.depassement(d), be = G.besoin(d);
    return D.fiche([
      ["Compte", D.esc(d.client.compte)],
      ["À l'état débiteur depuis le", D.esc(D.dateLongue(debutDe(d, date))) + " (" + d.palier + " jours)"],
      ["Solde au " + D.dateCourte(date), "<strong>" + D.esc(D.montant(d.compte.solde)) + "</strong>"],
      ["Autorisation de découvert", d.compte.autorisation > 0 ? D.esc(D.montant(d.compte.autorisation)) : "aucune"],
      dep > 0 ? ["Dépassement de l'autorisation", D.esc(D.montant(dep))] : null,
      ["Frais et intérêts prélevés depuis le début du débit", D.esc(D.montant(d.compte.frais))],
      ["Somme à verser pour retrouver un solde créditeur", "<strong>" + D.esc(D.montant(be)) + "</strong>"]
    ]);
  }

  function fraisIncidents(d) {
    var base = "intérêts débiteurs au taux de " + TAUX_MOIS + " par mois (" + TAUX_AN + " par an), commissions d'intervention de 8 € par opération (80 € par mois au plus) et frais de rejet de prélèvement ou de chèque";
    if (d.client.fragile) return base + ". Votre offre pour la clientèle fragile limite les frais d'incidents à 20 € par mois et à 4 € par opération";
    return base;
  }

  var MODELES = {
    j15_info: function (d, date) {
      return {
        titre: "Information : compte à l'état débiteur", envoi: "Courrier simple",
        objet: "votre compte n° " + d.client.compte + " est à l'état débiteur",
        corps:
          D.p("Nous constatons que votre compte présente un solde débiteur depuis le " + D.esc(D.dateLongue(debutDe(d, date))) + ", alors que vous disposez de " + D.esc(autorisation(d)) + ". Voici sa situation à la date de ce courrier :") +
          situation(d, date) +
          D.p("Un compte débiteur entraîne des frais : " + D.esc(fraisIncidents(d)) + ". Pour éviter qu'ils ne s'accumulent, nous vous invitons à approvisionner votre compte <strong>sous quinze jours</strong>, soit avant le " + D.esc(D.dateLongue(D.plusJours(date, 15))) + ".") +
          D.p("Votre conseiller reste à votre écoute pour étudier avec vous la solution la mieux adaptée à votre situation : date de versement de vos revenus, virement depuis un compte d'épargne, échelonnement… Vous pouvez le contacter en agence ou par la messagerie de votre espace de banque à distance. Si vous avez déjà régularisé votre compte, nous vous remercions de ne pas tenir compte de ce courrier.")
      };
    },
    j30_depassement: function (d, date) {
      var dep = G.depassement(d);
      return {
        titre: "Information écrite : dépassement de l'autorisation de découvert", envoi: "Courrier simple",
        objet: "votre compte n° " + d.client.compte + " est à l'état débiteur depuis plus d'un mois",
        corps:
          D.p("Votre compte présente un solde débiteur depuis plus d'un mois, soit depuis le " + D.esc(D.dateLongue(debutDe(d, date))) + (dep > 0 ? ", avec un dépassement de votre autorisation de découvert" : "") + ". En application du Code de la consommation, nous vous informons par écrit de sa situation :") +
          situation(d, date) +
          D.p("<strong>Taux débiteur applicable :</strong> " + TAUX_MOIS + " par mois, soit " + TAUX_AN + " par an. S'y ajoutent, selon les cas : commissions d'intervention de 8 € par opération (80 € par mois au plus) et frais de rejet de prélèvement ou de chèque." +
            (d.client.fragile ? " Votre offre pour la clientèle fragile limite les frais d'incidents à 20 € par mois et à 4 € par opération." : "")) +
          D.p("Cette situation ne peut pas durer : un découvert prolongé coûte cher et fragilise votre dossier. Nous vous demandons d'approvisionner votre compte <strong>sous trente jours</strong>, soit avant le " + D.esc(D.dateLongue(D.plusJours(date, 30))) + ". Si le dépassement se prolongeait, la loi nous oblige à vous proposer une solution de crédit mieux adaptée à votre besoin.") +
          D.p("Nous vous invitons à prendre rendez-vous avec votre conseiller, en agence, pour étudier votre situation et trouver ensemble une solution durable. À défaut de régularisation ou de contact de votre part, nous serions conduits à envisager des mesures sur votre compte et sur vos moyens de paiement.")
      };
    },
    j60_relance: function (d, date) {
      return {
        titre: "Dernière relance avant mesures", envoi: LRAR,
        objet: "dernière relance – votre compte n° " + d.client.compte + " est à l'état débiteur depuis deux mois",
        corps:
          D.p("Malgré nos précédents courriers et nos échanges, votre compte reste à l'état débiteur depuis le " + D.esc(D.dateLongue(debutDe(d, date))) + ". Sa situation à ce jour est la suivante :") +
          situation(d, date) +
          D.p("Nous vous demandons de régulariser cette situation <strong>sous trente jours</strong>, soit avant le " + D.esc(D.dateLongue(D.plusJours(date, 30))) + ". Votre compte reste ouvert et vos moyens de paiement restent en service pendant ce délai.") +
          D.p("À défaut de régularisation, nous serons contraints de mettre fin à la convention de compte en respectant un préavis de deux mois, de retirer vos moyens de paiement et de confier le recouvrement de la somme due à notre service de recouvrement amiable.") +
          D.p("Votre conseiller reste à votre disposition pour étudier toute solution : versement de vos revenus, épargne disponible, échelonnement, crédit adapté" + (d.client.fragile ? ", accompagnement budgétaire proposé aux clients en situation de fragilité financière" : "") + ". Prenez contact avec lui sans attendre.")
      };
    },
    j60_preavis: function (d, date) {
      var fin = D.plusJours(date, 60);
      return {
        titre: "Dénonciation de la convention de compte", envoi: LRAR,
        objet: "résiliation de la convention de compte de dépôt n° " + d.client.compte + " – préavis de soixante jours",
        corps:
          D.p("Votre compte est à l'état débiteur depuis le " + D.esc(D.dateLongue(debutDe(d, date))) + " et les démarches engagées auprès de vous n'ont pas permis de le régulariser. Sa situation à ce jour est la suivante :") +
          situation(d, date) +
          D.p("En conséquence, conformément à la convention de compte et à l'article L312-1-1 du Code monétaire et financier, nous vous notifions par le présent courrier la <strong>résiliation de la convention de compte de dépôt</strong> à notre initiative. Elle prendra effet à l'expiration d'un préavis de <strong>deux mois</strong> à compter de l'envoi de cette lettre, soit le <strong>" + D.esc(D.dateLongue(fin)) + "</strong>.") +
          D.p("Pendant le préavis, votre compte reste ouvert. Nous vous demandons :") +
          D.liste([
            "de rembourser le solde débiteur, augmenté des frais et intérêts qui continueront de courir jusqu'à la clôture ;",
            "de restituer à cette date les cartes bancaires et les formules de chèques en votre possession ;",
            "de faire domicilier vos revenus, vos virements et vos prélèvements sur un autre compte et d'en informer vos créanciers."
          ]) +
          D.p("À la clôture, si le solde n'est pas remboursé, il deviendra immédiatement exigible et son recouvrement sera poursuivi, y compris par voie judiciaire.") +
          D.p("Vous pouvez demander à la Banque de France de vous désigner un établissement de crédit pour vous ouvrir un compte (droit au compte, article L312-1 du Code monétaire et financier). En cas de désaccord, vous pouvez adresser une réclamation à votre agence, puis saisir le médiateur dont les coordonnées figurent dans vos conditions générales. Votre conseiller reste à votre disposition pour étudier une régularisation avant l'échéance.")
      };
    },
    j90_sra: function (d, date) {
      var avisEnvoye = (d.historique || []).filter(function (h) { return h.preavis; })[0];
      /* « j » d'un événement de l'historique = jour du débit auquel il a eu lieu (J60 : soixantième jour) */
      var envoiAvis = avisEnvoye ? D.plusJours(date, -(d.palier - avisEnvoye.j)) : null;
      var fin = envoiAvis ? D.plusJours(envoiAvis, 60) : D.plusJours(date, 60);
      var services = (d.services || []).map(function (s) { return s.libelle; });
      var prelevs = (d.prelevements || []).map(function (x) { return x.libelle + " – " + D.montant(x.montant); });
      return {
        titre: "Clôture des services et transmission au recouvrement amiable", envoi: LRAR,
        objet: "compte n° " + d.client.compte + " – clôture de vos services bancaires et transmission de votre dossier au service de recouvrement amiable",
        corps:
          D.p("Votre compte est à l'état débiteur depuis le " + D.esc(D.dateLongue(debutDe(d, date))) + ", soit depuis 90 jours, et vous n'avez pas régularisé sa situation malgré nos relances. Elle est la suivante à ce jour :") +
          situation(d, date) +
          D.p("Nous avons donc pris les mesures suivantes :") +
          "<p><strong>1. Clôture de vos services.</strong> Sont clôturés à compter de ce jour :</p>" + D.liste(services.map(D.esc)) +
          "<p><strong>2. Opposition aux prélèvements.</strong> Nous nous opposons au paiement des prélèvements présentés sur votre compte. Il vous appartient d'en informer vos créanciers et de leur proposer un autre moyen de paiement. Prélèvements concernés :</p>" + D.liste(prelevs.map(D.esc)) +
          "<p><strong>3. Transmission au service de recouvrement amiable.</strong> Votre dossier est confié au service de recouvrement amiable de GS Banque &amp; Assurance, qui vous contactera pour convenir des modalités de remboursement de la somme due. Vous pouvez éviter des frais supplémentaires en versant dès maintenant le solde débiteur sur votre compte.</p>" +
          D.p(avisEnvoye
            ? "<strong>Compte.</strong> Le préavis de deux mois qui vous a été notifié par lettre recommandée le " + D.esc(D.dateLongue(envoiAvis)) + " court jusqu'au <strong>" + D.esc(D.dateLongue(fin)) + "</strong>, date à laquelle votre compte sera clôturé. Le solde non remboursé deviendra alors immédiatement exigible."
            : "<strong>Compte.</strong> Nous vous notifions par le présent courrier la résiliation de votre convention de compte de dépôt (article L312-1-1 du Code monétaire et financier). Elle prendra effet à l'expiration d'un préavis de deux mois, soit le <strong>" + D.esc(D.dateLongue(fin)) + "</strong>. Le solde non remboursé deviendra alors immédiatement exigible.") +
          D.p("Vous devez restituer votre carte bancaire et les formules de chèques en votre possession. Vous pouvez demander à la Banque de France de vous désigner un établissement de crédit pour vous ouvrir un compte (droit au compte, article L312-1 du Code monétaire et financier). En cas de désaccord, vous pouvez adresser une réclamation à votre agence, puis saisir le médiateur dont les coordonnées figurent dans vos conditions générales.")
      };
    }
  };

  /* Courrier de la banque : id parmi G.COURRIERS. */
  function courrier(id, d, opts) {
    opts = opts || {};
    var date = opts.date || new Date(), m = MODELES[id];
    if (!m) throw new Error("courrier inconnu : " + id);
    var x = m(d, date);
    return {
      id: id, titre: x.titre, sous: x.envoi, courrier: true, signataire: "banque",
      fichier: D.fichier("Courrier_" + id, d.client, date),
      corps: D.lettre({ client: d.client, date: date, refs: refs(d, date), objet: x.objet, envoi: x.envoi, corps: x.corps })
    };
  }

  /* Engagement de régularisation, à faire signer par le client. moyens : [{ id, montant, delai }] (delai en jours à compter de la date). */
  function engagement(d, moyens, opts) {
    opts = opts || {};
    var date = opts.date || new Date(), c = d.client, fem = D.feminin(c);
    var fonds = (moyens || []).filter(function (m) { var x = G.moyen(m.id); return x && x.genre === "fonds"; });
    var sociaux = (moyens || []).filter(function (m) { var x = G.moyen(m.id); return x && x.genre === "social"; });
    var total = fonds.reduce(function (s, m) { return s + m.montant; }, 0), be = G.besoin(d), dep = G.depassement(d);
    var corps =
      D.p("Je soussigné" + (fem ? "e" : "") + " <strong>" + D.esc(D.nomComplet(c)) + "</strong>, titulaire du compte n° " + D.esc(c.compte) + " ouvert à l'agence de Paris de GS Banque &amp; Assurance, reconnais que ce compte présente, au " + D.esc(D.dateLongue(date)) +
        ", un solde débiteur de <strong>" + D.esc(D.montant(-d.compte.solde)) + "</strong>" + (d.compte.autorisation > 0 ? ", pour une autorisation de découvert de " + D.esc(D.montant(d.compte.autorisation)) + " (dépassement de " + D.esc(D.montant(dep)) + ")" : ", alors que je ne dispose d'aucune autorisation de découvert") + ".") +
      (fonds.length ? D.p("Pour retrouver un solde créditeur, je m'engage à alimenter mon compte de la façon suivante :") +
        D.tableau(["Moyen de régularisation", "Montant", "Au plus tard le"], fonds.map(function (m) {
          return [D.esc(G.libelleMoyen(m.id)), D.esc(D.montant(m.montant)), D.esc(D.dateLongue(D.plusJours(date, m.delai)))];
        }).concat([["<strong>Total annoncé</strong>", "<strong>" + D.esc(D.montant(total)) + "</strong>", ""]]), "dp-tab") +
        D.p("Somme nécessaire pour redevenir créditeur : " + D.esc(D.montant(be)) + (total + 0.5 < be ? ". Les ressources annoncées ne suffisent pas encore : je m'engage à rencontrer mon conseiller pour trouver une solution pour le complément." : ".")) : "") +
      (sociaux.length ? D.p("Compte tenu de ma situation, je demande à bénéficier de : " + sociaux.map(function (m) { return D.esc(G.libelleMoyen(m.id).toLowerCase()); }).join(" ; ") + ".") : "") +
      D.p("J'ai bien noté que :") +
      D.liste([
        "cet engagement ne vaut pas accord de la banque pour un découvert supplémentaire et ne suspend ni les frais, ni les intérêts débiteurs, qui continuent de courir tant que le compte est débiteur ;",
        "si les sommes annoncées ne sont pas versées aux dates indiquées, la banque pourra prendre les mesures prévues par la convention de compte : retrait des moyens de paiement, résiliation de la convention de compte avec un préavis de deux mois, transmission du dossier au service de recouvrement amiable ;",
        "mon conseiller me recontactera à l'approche de chaque échéance."
      ]) +
      D.lieuDate(date) +
      D.signatures([{ titre: "Le client", nom: D.nomComplet(c), mention: "Lu et approuvé, bon pour engagement (mention manuscrite et signature)" }, D.signatureConseiller(date)]);
    return {
      id: "engagement", titre: "Engagement de régularisation du compte", sous: "Document à signer par le client", courrier: false, signataire: "client",
      fichier: D.fichier("Engagement_regularisation", c, date), corps: '<div class="dp-lettre dp-signer">' + corps + "</div>"
    };
  }

  var api = { LRAR: LRAR, MODELES: Object.keys(MODELES), courrier: courrier, engagement: engagement, situation: situation };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.documentsGdi = api; }
})(typeof window !== "undefined" ? window : null);
