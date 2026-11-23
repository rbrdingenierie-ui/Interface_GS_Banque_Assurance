/* GS Banque & Assurance – scénarios d'appels entrants : l'enseignant joue le client, l'élève répond.
   Chaque scénario donne : la demande du client (ce que dit l'enseignant en décrochant), ce que le client sait et répond aux questions du conseiller,
   les étapes attendues du conseiller, la façon de finir l'appel et les points de vigilance. Rien à paramétrer : le client est choisi parmi les 680 clients
   selon le profil du scénario, les chiffres du script sont ceux du dossier de ce client et des règles de la banque (un test le vérifie).
   Un appel fait par un client est une demande. Le conseiller identifie d'abord l'appelant par les questions de sécurité de la fenêtre « Sécuriser l'appel » (trois réponses exactes au moins).
   Seule l'opposition sur une carte s'enregistre tout de suite par téléphone (puis le client confirme par écrit à l'agence) ; les autres opérations s'enregistrent à l'agence,
   en présence du client et après contrôle de sa pièce d'identité. Le script le rappelle à chaque fois.
   Conventions de l'exercice (aucune règle officielle) : les questions de sécurité sont celles de appels.js (date de naissance, adresse, dernier paiement par carte, numéro de client, e-mail, profession) ;
   les montants des demandes (achat à 3 600 €, virement de 1 200 €, somme à placer de 12 000 €) et les détails de la vie du client (lieu de la perte de carte, résiliation d'un abonnement…) sont ceux du scénario. */
(function (root) {
  "use strict";

  var A = root && root.SGBF && root.SGBF.appels ? root.SGBF.appels : require("./appels.js");

  /* Valeurs reprises de operations_service.js (un test compare les deux) */
  var TARIF = { carteRefabrication: 12, carteEnvoi: 7, chequierEnvoi: 5.5, intlTaux: 0.001, intlMin: 15, intlMax: 100, intlSwift: 12, intlOur: 25, chequeBanque: 25, chequiersDepannage: 10, franchisePerteVol: 50 };
  var PLAFOND_PAI = { VJEU: 1000, VCLA: 2500, VPRE: 6000, PLAT: 8000, WELI: 20000, VELE: 1000, CRET: 0 };
  var COEF = { temporaire: 2, permanent: 1.5 };
  var EPARGNES = { LJ: "Livret Jeune", LA: "Livret A", LEP: "Livret d'épargne populaire", CAT: "Compte à terme GS", LDDS: "Livret de développement durable et solidaire", LBR: "Livret Projets" };
  var CREDITS = { CTRAV: "Prêt travaux GS", CAUTO: "Crédit auto GS", CCONSO: "Prêt personnel GS", CIMMO: "Prêt immobilier GS" };
  var CARTES = { VJEU: "Carte Visa Classic Jeune", VCLA: "Carte Visa Classic", VPRE: "Carte Visa Premier", PLAT: "Carte Visa Platinum", WELI: "Carte Mastercard World Elite", VELE: "Carte Visa Electron (à contrôle de solde)", CRET: "Carte de retrait" };
  var BENEFICIAIRE_MAROC = { nom: "M. BENALI Yassine", adresse: "12 rue Hassan II, Casablanca", iban: "MA89 0117 8000 0012 3456 7890 1234", bic: "QXBKMAMCXXX" };
  /* Appelant non client du scénario « ouverture de compte » : numéro dans la plage réservée aux fictions (06 39 98 90 00 à 06 39 98 99 99) */
  var PROSPECT = { civ: "Mme", prenom: "Sacha", nom: "Delorme", age: 27, tel: "06 39 98 94 27" };

  function p2(n) { return (n < 10 ? "0" : "") + n; }
  function E(n) { return A.eurTxt(n); }
  function jmy(ymd) { return ymd.slice(8, 10) + "/" + ymd.slice(5, 7) + "/" + ymd.slice(0, 4); }
  function ymdDe(d) { return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()); }
  function plusJ(ymd, n) { return ymdDe(new Date(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)) + n)); }
  function fe(c, m, f) { return c.sexe === "F" ? f : m; }
  /* Accords du client selon son sexe : mis à jour avant chaque construction de script (voir construire) */
  var PN = { Il: "Il", il: "il", qil: "qu'il", Cl: "Le client", cl: "le client" };
  function pronoms(c) { var f = c && c.sexe === "F"; PN.Il = f ? "Elle" : "Il"; PN.il = f ? "elle" : "il"; PN.qil = f ? "qu'elle" : "qu'il"; PN.Cl = f ? "La cliente" : "Le client"; PN.cl = f ? "la cliente" : "le client"; }
  function nomComplet(c) { return c.civ + " " + c.prenom + " " + c.nom.toUpperCase(); }
  function minuscule(s) { return String(s).charAt(0).toLowerCase() + String(s).slice(1); }
  function arrondiSup(n, pas) { return Math.ceil(n / pas) * pas; }
  function lignes(c, ctx) { try { return ctx && typeof ctx.lignes === "function" ? (ctx.lignes(c) || []) : []; } catch (e) { return []; } }
  function soldeDe(c, ctx) { try { var s = ctx && typeof ctx.solde === "function" ? ctx.solde(c) : null; return typeof s === "number" && isFinite(s) ? s : null; } catch (e) { return null; } }
  function libEpargne(x) { return (EPARGNES[x.p] || "Épargne") + " " + E(x.solde); }
  function auj(ctx) { return ctx && ctx.auj instanceof Date ? ctx.auj : new Date(); }

  function naissance(c, ctx) { return A.naissanceTxt(c, auj(ctx)); }
  function derniereCarte(c, ctx) { return A.dernierPaiementCarte(lignes(c, ctx)); }
  function depensesCarte30j(c, ctx) {
    var limite = plusJ(ymdDe(auj(ctx)), -30), s = 0;
    lignes(c, ctx).forEach(function (x) { if (x.kind === "carte" && x.m < 0 && x.ymd > limite) s += -x.m; });
    return Math.round(s * 100) / 100;
  }
  function identiteClient(c, ctx) {
    var id = [["Numéro de client", c.num], ["Nom et prénom", c.civ + " " + c.nom.toUpperCase() + " " + c.prenom], ["Date de naissance", naissance(c, ctx)],
      ["Adresse", c.adr.rue + ", " + c.adr.cp + " " + c.adr.ville], ["Téléphone mobile", c.mob], ["E-mail", c.mail], ["Profession", c.pro.prof],
      ["Client depuis le", jmy(plusJ(ymdDe(auj(ctx)), -c.depuis))]];
    var dc = derniereCarte(c, ctx);
    if (dc) id.push(["Dernier paiement par carte", A.paiementTxt(dc)]);
    return id;
  }
  function lien(href, lib) { return { href: href, lib: lib }; }
  function etape(t, l) { return l ? { t: t, lien: l } : { t: t, lien: null }; }
  function fiche(c, onglet) { return lien("client.html?id=" + c.id + (onglet ? "#" + onglet : ""), onglet === "operations" ? "Fiche client, onglet Opérations" : onglet === "compte" ? "Fiche client, onglet Compte courant" : onglet === "epargne" ? "Fiche client, onglet Épargne et placements" : "Fiche client"); }
  function cre(c) { return lien("contacts.html?client=" + c.id, "Compte rendu d'entretien"); }

  var ETAPE_ACCUEIL = "Décrocher, se présenter (GS Banque & Assurance, agence de Paris, son prénom et son nom), puis laisser le client expliquer sa demande sans l'interrompre.";
  var ETAPE_IDENT = "Sécuriser l'appel : la fiche du client s'ouvre à la prise d'appel, avec la liste des questions de sécurité. Poser au moins trois questions (date de naissance, adresse, dernier paiement par carte, numéro de client, e-mail, profession), comparer chaque réponse avec le dossier et la cocher si elle est exacte. Tant que l'appelant n'est pas identifié, ne donner aucune information. Ne jamais demander le code confidentiel, le code reçu par SMS, le numéro complet de la carte ni le cryptogramme.";
  var ETAPE_RDV_AGENCE = "Cette opération se fait à l'agence, en présence du client et après contrôle de sa pièce d'identité en cours de validité (carte nationale d'identité, passeport, titre de séjour ou permis de conduire) : la banque ne l'enregistre pas sur un simple appel téléphonique. Fixer avec le client le moment où il viendra, puis noter le rendez-vous dans l'agenda.";
  var ETAPE_CRE = "Après l'appel : noter un compte rendu d'entretien (canal « Appel téléphonique ») avec la demande du client et la suite convenue.";
  function rdv() { return lien("agenda.html", "Agenda commercial"); }

  /* ---------- les scénarios ---------- */
  var LISTE = [
    {
      id: "opposition_carte", titre: "Carte bancaire perdue ou volée", theme: "Cartes", duree: "8 à 12 minutes", niveau: "Facile",
      resume: "Un client ne retrouve plus sa carte et demande de la bloquer tout de suite.",
      profil: "Client titulaire d'une carte Visa Classic ou Visa Premier, 25 à 75 ans.",
      critere: function (c, ctx) { return (c.cartes[0].p === "VCLA" || c.cartes[0].p === "VPRE") && c.age >= 25 && c.age <= 75 && !!derniereCarte(c, ctx); },
      construire: function (c, ctx) {
        var carte = CARTES[c.cartes[0].p], dc = derniereCarte(c, ctx), dernier = dc ? dc.lib.replace(/^Paiement carte – /, "") + " (" + E(-dc.m) + ", le " + jmy(dc.ymd) + ")" : "";
        return {
          accroche: "Bonjour, c'est " + c.prenom + " " + c.nom + ". Je ne retrouve plus ma carte bancaire : je pense qu'on me l'a volée dans le métro hier. Il faut la bloquer tout de suite, je suis très " + fe(c, "inquiet", "inquiète") + ".",
          infos: [
            "La carte concernée est sa seule carte : " + carte + ".",
            PN.Il + " s'en est aperçu" + fe(c, "", "e") + " hier soir vers 19 h, à la caisse d'un magasin à Paris. " + PN.Il + " l'avait encore le matin ; " + PN.il + " a pris le métro (ligne 4) dans la journée.",
            "Le dernier paiement " + PN.qil + " reconnaît : " + dernier + ".",
            PN.Il + " n'a pas encore regardé ses comptes en ligne ni déposé plainte ; " + PN.il + " compte aller au commissariat dans la journée.",
            PN.Il + " ne sait pas si des paiements ont eu lieu depuis : " + PN.il + " demande au conseiller de regarder avec " + fe(c, "lui", "elle") + "."
          ],
          repliques: [
            ["Quand et où vous en êtes-vous aperçu ?", "Hier vers 19 h, à la caisse d'un magasin à Paris. Je l'avais encore le matin, donc c'est sûrement dans le métro ou dans la rue."],
            ["Avez-vous déposé plainte ?", "Pas encore, j'y vais dans la journée."],
            ["Voyez-vous des paiements que vous ne reconnaissez pas ?", "Je n'ai rien regardé. Vous pouvez vérifier ? (Si le conseiller lit les derniers paiements : le client les reconnaît tous. L'enseignant peut ajouter une opération inconnue pour tester la réaction de l'élève.)"],
            ["Voulez-vous une nouvelle carte ? Comment la recevoir ?", "Oui, évidemment. Je préfère la retirer à l'agence. Si c'est payant, ça va."],
            ["Avez-vous votre carte sous la main pour me lire les chiffres ?", "Non, je ne l'ai plus. (Le conseiller n'a de toute façon pas à les demander.)"]
          ],
          questions: [
            ["Ma carte est bloquée tout de suite ? Je peux encore payer avec ?", "Dès que l'opposition est enregistrée, la carte est bloquée et plus aucun paiement n'est possible."],
            ["Combien de temps pour avoir une nouvelle carte, et combien ça coûte ?", "5 à 7 jours ouvrés ; " + E(TARIF.carteRefabrication) + " en cas de perte ou de vol ; retrait à l'agence gratuit, ou envoi à domicile en recommandé pour " + E(TARIF.carteEnvoi) + "."],
            ["Si des paiements ont été faits avec ma carte avant que vous la bloquiez, je serai remboursé ?", "Oui, s'ils n'ont pas été faits par le client : ils se contestent à l'agence, dans les 13 mois, avec un kit de contestation que le client signe (et la copie de son dépôt de plainte en cas de vol). Le remboursement est immédiat. En cas de perte ou de vol, au plus " + E(TARIF.franchisePerteVol) + " restent à la charge du client pour les paiements faits avant l'opposition ; rien après."]
          ],
          etapes: [
            etape(ETAPE_ACCUEIL), etape(ETAPE_IDENT, fiche(c)),
            etape("Rassurer le client : la carte va être bloquée. Poser les questions utiles : quand, où, circonstances, plainte déposée ou non."),
            etape("Regarder avec le client les derniers paiements par carte pour repérer ceux qu'il ne reconnaît pas.", fiche(c, "compte")),
            etape("Enregistrer tout de suite l'opération « Opposition sur une carte », pendant l'appel : identité « identifiée par téléphone » (les questions de sécurité réussies sont reprises de l'appel), carte, motif « vol », date et lieu, circonstances, plainte (déposée ou sous 48 heures), nouvelle carte. Nouvelle carte : " + E(TARIF.carteRefabrication) + " en cas de perte ou de vol (gratuite en cas d'utilisation frauduleuse), reçue en 5 à 7 jours ouvrés ; retrait à l'agence gratuit ou envoi à domicile en recommandé pour " + E(TARIF.carteEnvoi) + ". La carte est bloquée dès l'enregistrement.", fiche(c, "operations")),
            etape("Annoncer au client que sa carte est bloquée et que son opposition doit être confirmée par écrit : il signera le document à l'agence, avec sa pièce d'identité. Fixer le moment avec lui et noter le rendez-vous dans l'agenda.", rdv()),
            etape("Si le client découvre des paiements qu'il n'a pas faits : l'opposition ne les rembourse pas. Ils se contestent dans une opération à part, « Contestation d'opérations par carte » (kit de contestation à faire signer à l'agence, avec la copie du dépôt de plainte en cas de vol), après l'opposition. Le noter dans le compte rendu et fixer la date de passage avec le client."),
            etape(ETAPE_CRE, cre(c))
          ],
          fin: "L'appel se termine par : la carte bloquée pendant l'appel, les conseils au client (déposer plainte, vérifier ses comptes), le choix de la remise de la nouvelle carte, la confirmation écrite à signer à l'agence avec la pièce d'identité, et un compte rendu.",
          vigilance: [
            "Une opposition ne se retarde jamais : une fois l'appelant identifié par les questions de sécurité, elle est enregistrée pendant l'appel et la carte est bloquée tout de suite. Ne pas faire attendre le client jusqu'à son passage à l'agence.",
            "Ne jamais demander le code confidentiel, le code reçu par SMS ni le cryptogramme.",
            "La confirmation écrite se signe ensuite à l'agence, sur présentation de la pièce d'identité : la rappeler au client.",
            "En cas de vol, rappeler au client de déposer plainte sous 48 heures : la copie du dépôt de plainte est à joindre au kit de contestation des paiements frauduleux.",
            "Ne pas promettre la nouvelle carte avant 5 à 7 jours ouvrés : les cartes sont fabriquées sur commande."
          ]
        };
      }
    },
    {
      id: "rejet_prelevement", titre: "Prélèvement contesté après résiliation", theme: "Prélèvements", duree: "10 à 15 minutes", niveau: "Moyen",
      resume: "Un client est prélevé pour un abonnement qu'il avait résilié et veut être remboursé.",
      profil: "Client prélevé d'un abonnement vidéo en ligne ou d'une salle de sport dans les 8 dernières semaines.",
      critere: function (c, ctx) { return !!prelevementAbo(c, ctx); },
      construire: function (c, ctx) {
        var l = prelevementAbo(c, ctx), objet = minuscule(l.lib.replace(/^Prélèvement /, "")), dateRes = jmy(plusJ(l.ymd, -12));
        return {
          accroche: "Bonjour, c'est " + c.prenom + " " + c.nom + ". Je vois sur mon compte un prélèvement de " + E(-l.m) + " le " + jmy(l.ymd) + " pour mon " + objet + ". Mais j'avais résilié : je veux être " + fe(c, "remboursé", "remboursée") + " et que ça s'arrête.",
          infos: [
            "Le prélèvement contesté : " + l.lib + ", " + E(-l.m) + ", le " + jmy(l.ymd) + ".",
            PN.Cl + " avait signé un mandat de prélèvement à la souscription. " + PN.Il + " a résilié l'abonnement le " + dateRes + " (un e-mail de confirmation de résiliation est arrivé) et a demandé l'arrêt du prélèvement le même jour.",
            PN.Il + " n'a pas encore écrit au créancier depuis. " + PN.Il + " veut que ce prélèvement lui soit remboursé et que le prochain n'ait pas lieu.",
            PN.Il + " ne conteste aucun autre prélèvement."
          ],
          repliques: [
            ["Aviez-vous autorisé ce prélèvement ?", "J'avais signé un mandat au début. Mais j'ai résilié l'abonnement avant ce prélèvement, donc il n'avait plus lieu d'être."],
            ["Quand avez-vous résilié ?", "Le " + dateRes + ". J'ai l'e-mail de confirmation."],
            ["Pouvez-vous me montrer cet e-mail ?", "Oui, je l'apporterai à l'agence."],
            ["Voulez-vous empêcher les prochains prélèvements de ce créancier ?", "Oui, je ne veux plus rien leur payer."],
            ["Y a-t-il d'autres prélèvements que vous ne reconnaissez pas ?", "Non, seulement celui-là."]
          ],
          questions: [
            ["Je serai remboursé quand ?", "Dès que l'opération est enregistrée à l'agence : le compte est recrédité tout de suite."],
            ["J'ai encore le droit de contester, j'ai déjà attendu quelques semaines ?", "Oui : un prélèvement non autorisé se conteste pendant 13 mois."]
          ],
          etapes: [
            etape(ETAPE_ACCUEIL), etape(ETAPE_IDENT, fiche(c)),
            etape("Retrouver le prélèvement dans le compte courant (type « Prélèvements ») et le lire au client pour s'assurer qu'il s'agit bien de la bonne ligne.", fiche(c, "compte")),
            etape("Établir si le prélèvement était autorisé : le client avait signé un mandat, mais il l'a révoqué avant la date du prélèvement. La règle bancaire distingue le délai de 8 semaines (prélèvement autorisé) du délai de 13 mois (prélèvement non autorisé, y compris mandat révoqué avant le prélèvement)."),
            etape(ETAPE_RDV_AGENCE, rdv()), etape("Conseiller au client de garder la preuve de résiliation et de prévenir aussi le créancier.", null), etape(ETAPE_CRE, cre(c)),
            etape("Au rendez-vous, à l'agence, avec la pièce d'identité du client : enregistrer l'opération « Rejet d'un prélèvement après son débit » : choisir la ligne, répondre « Non, il ne l'avait pas autorisé », motif « Le mandat avait été révoqué avant le prélèvement », et cocher l'empêchement des prochains prélèvements du créancier (à demander au plus tard la veille du prélèvement suivant). Le compte est recrédité tout de suite.", fiche(c, "operations"))
          ],
          fin: "L'appel se termine par : le prélèvement identifié, le délai applicable expliqué (13 mois), le rendez-vous à l'agence pour enregistrer la demande avec la pièce d'identité, l'e-mail de résiliation à apporter, et un compte rendu.",
          vigilance: [
            "Ne pas confondre « prélèvement autorisé » (8 semaines) et « non autorisé » (13 mois) : la révocation du mandat avant le prélèvement le rend non autorisé.",
            "Demander les dates précises : date du prélèvement, date de résiliation, date de révocation du mandat.",
            "Le compte est recrédité dès l'enregistrement de l'opération ; cela ne dispense pas le client de prévenir le créancier."
          ]
        };
      }
    },
    {
      id: "plafond_carte", titre: "Plafond de carte à relever pour un achat", theme: "Cartes", duree: "8 à 12 minutes", niveau: "Moyen",
      resume: "Un client veut payer 3 600 € par carte et son plafond de paiement est trop bas.",
      profil: "Client titulaire d'une carte Visa Classic, avec au moins 4 500 € sur son compte courant et peu de paiements par carte ces 30 derniers jours.",
      critere: function (c, ctx) {
        if (c.cartes[0].p !== "VCLA" || c.age < 25 || c.age > 70) return false;
        var s = soldeDe(c, ctx);
        return s !== null && s >= 4500 && besoinPlafond(c, ctx) <= PLAFOND_PAI.VCLA * COEF.temporaire;
      },
      construire: function (c, ctx) {
        var pai = PLAFOND_PAI[c.cartes[0].p], dep = depensesCarte30j(c, ctx), besoin = besoinPlafond(c, ctx), s = soldeDe(c, ctx), fin = jmy(plusJ(ymdDe(auj(ctx)), 14));
        return {
          accroche: "Bonjour, c'est " + c.prenom + " " + c.nom + ". La semaine prochaine, j'achète un canapé à 3 600 € et je veux le payer par carte. Mais mon plafond est trop bas, le magasin m'a dit que ça ne passerait pas. Vous pouvez le relever ?",
          infos: [
            "Carte : " + CARTES[c.cartes[0].p] + ", plafond de paiement de " + E(pai) + " par 30 jours.",
            "Paiements par carte des 30 derniers jours : " + E(dep) + ". Avec l'achat de 3 600 €, il lui faut donc un plafond d'au moins " + E(besoin) + " (arrondi à la centaine supérieure).",
            PN.Il + " veut le relèvement pour deux semaines, jusqu'au " + fin + ", puis revenir au plafond habituel. L'achat est un canapé, dans un magasin de meubles, payé en une fois.",
            "Son compte courant présente " + E(s) + " : " + PN.il + " a de quoi payer. " + PN.Il + " ne veut pas toucher au plafond de retrait."
          ],
          repliques: [
            ["Quelle somme voulez-vous payer, et quand ?", "3 600 € la semaine prochaine, un canapé, par carte en une seule fois."],
            ["Pour combien de temps voulez-vous le relèvement ?", "Deux semaines suffisent, jusqu'au " + fin + "."],
            ["Avez-vous de quoi couvrir cet achat sur votre compte ?", "Oui, j'ai " + E(s) + " sur mon compte courant."],
            ["Le magasin accepte-t-il un autre moyen de paiement ?", "Non, uniquement la carte, ou un chèque de banque. Je préfère la carte."],
            ["Voulez-vous aussi relever le plafond de retrait ?", "Non, seulement le paiement."]
          ],
          questions: [
            ["Et après le " + fin + ", mon plafond revient comment ?", "Il revient au plafond habituel de " + E(pai) + " à la fin du relèvement."],
            ["Ça va me coûter quelque chose ?", "Aucun frais n'est prévu pour un relèvement de plafond."]
          ],
          etapes: [
            etape(ETAPE_ACCUEIL), etape(ETAPE_IDENT, fiche(c)),
            etape("Faire préciser le besoin : montant de l'achat, date, durée du relèvement. Regarder le plafond actuel de la carte et les paiements déjà faits sur les 30 derniers jours.", fiche(c, "compte")),
            etape("Choisir le type de relèvement : temporaire (30 jours au plus, jusqu'à " + COEF.temporaire + " fois les plafonds standards, soit " + E(pai * COEF.temporaire) + " ici) ou permanent (jusqu'à 1,5 fois, soit " + E(pai * COEF.permanent) + " ici : insuffisant pour ce besoin).", null),
            etape(ETAPE_RDV_AGENCE, rdv()), etape(ETAPE_CRE, cre(c)),
            etape("Au rendez-vous, à l'agence, avec la pièce d'identité du client : enregistrer l'opération « Augmentation du plafond d'une carte » : carte, relèvement temporaire, nouveau plafond de paiement (" + E(besoin) + " au moins), fin du relèvement, raison « Achat important ».", fiche(c, "operations"))
          ],
          fin: "L'appel se termine par : le relèvement temporaire retenu et sa date de fin, le rendez-vous à l'agence avec la pièce d'identité, et un compte rendu. Le client est prévenu que le plafond redevient normal à la fin du relèvement.",
          vigilance: [
            "Un plafond n'est pas une autorisation de découvert : vérifier que le compte est approvisionné.",
            "Ne pas dépasser " + COEF.temporaire + " fois le plafond standard pour un relèvement temporaire, ni 30 jours.",
            "Compter les paiements déjà faits sur les 30 derniers jours : le plafond se calcule sur 30 jours glissants."
          ]
        };
      }
    },
    {
      id: "commande_chequier", titre: "Commande d'un chéquier", theme: "Chèques", duree: "8 à 10 minutes", niveau: "Facile",
      resume: "Un client n'a presque plus de chèques et veut un nouveau chéquier, avec un chèque à faire dès demain.",
      profil: "Client avec un compte courant Équilibre, majeur, qui n'est pas en offre clientèle fragile.",
      critere: function (c) { return c.cpt.p === "CPT" && c.age >= 30 && c.age <= 80; },
      construire: function (c, ctx) {
        return {
          accroche: "Bonjour, c'est " + c.prenom + " " + c.nom + ". Il ne me reste que deux chèques dans mon chéquier. Je voudrais en commander un nouveau. Et j'ai un chèque à faire demain pour une cotisation, c'est un peu urgent.",
          infos: [
            PN.Cl + " n'a commandé aucun chéquier depuis plus d'un an.",
            PN.Il + " doit faire un chèque dès demain (cotisation d'association) : il lui reste deux formules, mais " + PN.il + " veut être tranquille.",
            PN.Il + " préférerait venir chercher le chéquier à l'agence, sans frais. " + PN.Il + " accepte aussi un envoi à domicile si ce n'est pas trop cher.",
            PN.Il + " n'a jamais eu d'incident de chèque et ne se souvient d'aucun refus de chéquier."
          ],
          repliques: [
            ["Combien de formules voulez-vous ?", "25, comme d'habitude."],
            ["Voulez-vous le retirer à l'agence ou le recevoir chez vous ?", "À l'agence, sans frais. Je passerai cette semaine."],
            ["Avez-vous déjà commandé un chéquier récemment ?", "Non, le dernier date de plus d'un an."],
            ["Il vous faut un chèque rapidement : un chéquier de dépannage vous irait-il ?", "Oui, s'il est gratuit, parfait pour demain. Je commanderai le grand chéquier ensuite."],
            ["Savez-vous si vous avez déjà eu un incident de chèque ?", "Jamais, c'est la première fois que je demande ça en urgence."]
          ],
          questions: [
            ["Ça coûte combien ?", "Gratuit en retrait à l'agence (dépannage ou commande) ; " + E(TARIF.chequierEnvoi) + " pour un envoi à domicile en recommandé."],
            ["Je peux l'avoir demain ?", "Un chéquier de dépannage de " + TARIF.chequiersDepannage + " formules peut être remis tout de suite à l'agence, tant qu'il en reste en stock."]
          ],
          etapes: [
            etape(ETAPE_ACCUEIL), etape(ETAPE_IDENT, fiche(c)),
            etape("Vérifier dans la fiche qu'aucun chéquier n'a été commandé dans les 30 derniers jours (un nouveau chéquier ne peut pas être commandé avant).", fiche(c, "operations")),
            etape("Présenter les modes de remise : chéquier de dépannage de " + TARIF.chequiersDepannage + " formules remis tout de suite à l'agence (gratuit, dans la limite du stock) ; commande de 25 ou 50 formules retirées en main propre à l'agence sous 5 jours ouvrés (gratuit) ; envoi à domicile en recommandé (" + E(TARIF.chequierEnvoi) + ")."),
            etape(ETAPE_RDV_AGENCE, rdv()), etape(ETAPE_CRE, cre(c)),
            etape("Au rendez-vous, à l'agence, avec la pièce d'identité du client : enregistrer l'opération « Commande de chéquier » : mode de remise, nombre de formules, et obligatoirement la consultation du fichier central des chèques (le client ne doit pas y être inscrit).", fiche(c, "operations"))
          ],
          fin: "L'appel se termine par : le mode de remise choisi, le rendez-vous à l'agence avec la pièce d'identité (le chéquier se remet en main propre contre signature, ou par envoi en recommandé) et un compte rendu.",
          vigilance: [
            "Consulter le fichier central des chèques avant toute remise de formules, même pour un client connu.",
            "Un chéquier ne s'envoie jamais par courrier simple : recommandé avec frais, ou remise en main propre.",
            "Le stock de chéquiers de dépannage est limité : s'il est épuisé, il faut commander."
          ]
        };
      }
    },
    {
      id: "cheque_offre_fragile", titre: "Chéquier demandé en offre clientèle fragile", theme: "Chèques", duree: "8 à 10 minutes", niveau: "Moyen",
      resume: "Un client dont l'offre ne comprend pas de chéquier en demande un : il faut lui proposer autre chose.",
      profil: "Client en offre clientèle fragile.",
      critere: function (c) { return c.cpt.p === "OCF"; },
      construire: function (c, ctx) {
        return {
          accroche: "Bonjour, c'est " + c.prenom + " " + c.nom + ". Je voudrais un chéquier : j'ai une caution à payer pour un nouveau logement et quelques factures à régler.",
          infos: [
            PN.Cl + " est en offre clientèle fragile ; " + PN.il + " ne le dit pas, c'est dans son dossier.",
            PN.Il + " doit verser une caution de 700 € à un bailleur, qui n'accepte que les chèques. " + PN.Il + " a aussi deux ou trois petites factures.",
            PN.Il + " n'a jamais utilisé de chèque de banque et ne sait pas ce que c'est.",
            PN.Il + " accepte de passer à l'agence pour la caution, s'il le faut."
          ],
          repliques: [
            ["Pour quel usage avez-vous besoin de chèques ?", "Une caution de 700 € pour un nouveau logement, plus quelques petites factures."],
            ["Savez-vous ce qu'est un chèque de banque ?", "Non, c'est comme un chèque normal ?"],
            ["Les factures peuvent-elles être payées autrement (virement, prélèvement) ?", "Je peux essayer par virement si vous m'expliquez comment."],
            ["Pouvez-vous passer à l'agence ?", "Oui, demain matin."]
          ],
          questions: [
            ["Pourquoi je n'ai pas droit à un chéquier ?", "Votre offre ne comprend pas de chéquier, mais elle comprend 2 chèques de banque par mois, sans commission : c'est une solution adaptée pour une caution."],
            ["Un chèque de banque, c'est sûr pour mon propriétaire ?", "Oui : le montant est débité de votre compte tout de suite, le bailleur est certain d'être payé."]
          ],
          etapes: [
            etape(ETAPE_ACCUEIL), etape(ETAPE_IDENT, fiche(c)),
            etape("Repérer dans la fiche l'offre du client (offre clientèle fragile) : elle ne comprend pas de chéquier mais prévoit 2 chèques de banque par mois, sans commission.", fiche(c)),
            etape("Expliquer sans dramatiser : pas de chéquier dans cette offre ; pour la caution, un chèque de banque (le compte est débité tout de suite du montant) ; pour les factures, un virement ou un prélèvement. Ne pas laisser croire qu'il s'agit d'un refus de service."),
            etape(ETAPE_RDV_AGENCE, rdv()), etape(ETAPE_CRE, cre(c)),
            etape("Au rendez-vous, à l'agence, avec la pièce d'identité du client : préparer l'opération « Chèque de banque » : bénéficiaire, montant (700 €), objet « Dépôt de garantie ou caution d'un logement » ; vérifier que le solde le permet. Commission " + E(TARIF.chequeBanque) + " seulement au-delà des 2 chèques inclus chaque mois.", fiche(c, "operations"))
          ],
          fin: "L'appel se termine par : l'explication claire de l'offre du client, la solution retenue (chèque de banque pour la caution, virements pour les factures), le rendez-vous à l'agence avec la pièce d'identité et un compte rendu.",
          vigilance: [
            "L'offre clientèle fragile ne comprend pas de chéquier : la commande d'un chéquier n'est pas possible. Proposer le chèque de banque, pas un refus sec.",
            "Soigner le ton : le client ne doit pas se sentir jugé sur sa situation.",
            "Un chèque de banque débite le compte immédiatement : vérifier le solde avant."
          ]
        };
      }
    },
    {
      id: "virement_intl", titre: "Virement vers le Maroc", theme: "Virements", duree: "10 à 15 minutes", niveau: "Difficile",
      resume: "Un client veut envoyer 1 200 € à un proche au Maroc pour des frais de santé.",
      profil: "Client avec au moins 1 500 € sur son compte courant.",
      critere: function (c, ctx) { var s = soldeDe(c, ctx); return c.age >= 25 && c.age <= 80 && c.cpt.p === "CPT" && s !== null && s >= 1500; },
      construire: function (c, ctx) {
        var m = 1200, com = fraisIntl(m, false), comOur = fraisIntl(m, true), s = soldeDe(c, ctx);
        return {
          accroche: "Bonjour, c'est " + c.prenom + " " + c.nom + ". Je voudrais envoyer 1 200 euros à mon cousin Yassine, au Maroc, pour l'aider à payer des frais de santé. Comment on fait ?",
          infos: [
            "Bénéficiaire : " + BENEFICIAIRE_MAROC.nom + ", " + BENEFICIAIRE_MAROC.adresse + ".",
            "IBAN : " + BENEFICIAIRE_MAROC.iban + ". BIC : " + BENEFICIAIRE_MAROC.bic + ".",
            "Montant : 1 200 € (" + PN.cl + " veut que son cousin reçoive la somme en dirhams ; la conversion est faite par la banque du bénéficiaire). Motif : frais de santé d'un proche ; une facture n'est pas demandée à ce montant.",
            PN.Il + " ne sait pas ce qu'est un virement « partagé » ou « à la charge du client » : " + PN.il + " veut payer le moins cher possible mais que le cousin reçoive la somme entière si possible. " + PN.Il + " hésite, puis accepte les frais partagés.",
            "Son compte courant présente " + E(s) + ". " + PN.Il + " voudrait que l'argent parte vite."
          ],
          repliques: [
            ["Dans quelle devise voulez-vous envoyer ?", "En euros : je ne sais pas ce que ça donne en dirhams, c'est sa banque qui convertira."],
            ["Avez-vous l'IBAN, le BIC et l'adresse du bénéficiaire ?", "Oui : " + BENEFICIAIRE_MAROC.iban + ", BIC " + BENEFICIAIRE_MAROC.bic + ", " + BENEFICIAIRE_MAROC.adresse + "."],
            ["Qui paie les frais de la banque du bénéficiaire ?", "Partagés, alors. Je paie les vôtres, il paie ceux de sa banque."],
            ["Quel est le lien avec le bénéficiaire ?", "C'est mon cousin."],
            ["Quel est le motif de l'envoi ?", "Les frais de santé de mon cousin, ce sont des soins qu'il doit payer."]
          ],
          questions: [
            ["Il arrive quand ? Mon cousin en a besoin cette semaine.", "Le bénéficiaire est crédité sous 2 à 4 jours ouvrés selon le pays : on ne peut pas garantir « cette semaine »."],
            ["Ça me coûte combien en tout ?", "1 200 € plus " + E(com) + " de frais si les frais sont partagés (" + E(comOur) + " si vous prenez aussi les frais de la banque du bénéficiaire)."]
          ],
          etapes: [
            etape(ETAPE_ACCUEIL), etape(ETAPE_IDENT, fiche(c)),
            etape("Faire préciser le besoin : pays, bénéficiaire, montant, devise, motif. Vérifier que le Maroc n'est pas un pays refusé par la banque (il ne l'est pas) et que ce n'est pas un virement SEPA (virement hors zone SEPA : « virement international »)."),
            etape("Recueillir les coordonnées : nom et adresse complète du bénéficiaire, IBAN, BIC. Le BIC est obligatoire ; ses lettres 5 et 6 doivent être le code du pays de la banque (MA).", null),
            etape(ETAPE_RDV_AGENCE, rdv()), etape(ETAPE_CRE, cre(c)),
            etape("Au rendez-vous, à l'agence, avec la pièce d'identité du client : enregistrer l'opération « Virement international » : pays Maroc, devise euro, montant 1 200 €, frais « partagés (SHA) », motif « Frais de santé ». Commission : " + E(com) + " (0,10 % du montant, 15 € au minimum, plus 12 € de frais SWIFT) ; " + E(comOur) + " si les frais du bénéficiaire sont à la charge du client (OUR). Le bénéficiaire est crédité sous 2 à 4 jours ouvrés.", fiche(c, "operations"))
          ],
          fin: "L'appel se termine par : le coût total annoncé (1 200 € plus " + E(com) + " de frais), le délai de 2 à 4 jours ouvrés, la liste des éléments à avoir sous la main (IBAN, BIC, adresse), le rendez-vous à l'agence avec la pièce d'identité et un compte rendu.",
          vigilance: [
            "Annoncer le coût avant de faire l'opération : commission et frais SWIFT, plus 25 € si le client choisit de payer aussi les frais de la banque du bénéficiaire (OUR).",
            "Contrôler l'IBAN et le BIC ; recopier les coordonnées sans erreur : une erreur retarde ou bloque le virement.",
            "Au-delà de 10 000 €, un justificatif est exigé ; ce n'est pas le cas ici, mais l'élève doit savoir le dire.",
            "Certains pays sont refusés par la banque (sanctions internationales) : vérifier toujours le pays."
          ]
        };
      }
    },
    {
      id: "projet_travaux", titre: "Projet de travaux à financer", theme: "Crédits", duree: "12 à 18 minutes", niveau: "Moyen",
      resume: "Un client a un projet de travaux de rénovation et demande ce que la banque peut lui proposer.",
      profil: "Client propriétaire (ou accédant) avec un projet de travaux de rénovation chiffré dans son dossier et sans prêt travaux en cours.",
      critere: function (c) { return !!projetTravaux(c) && !c.cre.some(function (x) { return x.p === "CTRAV"; }) && c.age >= 25 && c.age <= 70 && (c.log.st === "proprietaire" || c.log.st === "accedant"); },
      construire: function (c, ctx) {
        var pj = projetTravaux(c), budget = budgetDe(pj), mois = Math.max(1, Math.round(pj.dans / 30)), foyer = c.pro.foyer, maxMens = Math.max(50, Math.round(foyer * 0.1 / 10) * 10);
        var cr = c.cre.map(function (x) { return x.mens ? (CREDITS[x.p] || "Crédit") + " (" + E(x.mens) + " par mois)" : ""; }).filter(Boolean);
        var epa = c.epa.length ? c.epa.map(libEpargne).join(", ") : "";
        return {
          accroche: "Bonjour, c'est " + c.prenom + " " + c.nom + ". J'ai un projet de travaux de rénovation, " + minuscule(pj.detail) + ". Je voudrais savoir ce que la banque peut me proposer pour le financer.",
          infos: [
            "Projet : " + pj.lib + " (" + pj.detail + "), à démarrer dans environ " + mois + " mois.",
            "Revenus nets mensuels du foyer : " + E(foyer) + ". " + (c.log.st === "proprietaire" ? PN.Cl + " est propriétaire de son logement." : PN.Cl + " est accédant" + fe(c, "", "e") + " à la propriété : " + PN.il + " rembourse encore l'achat de son logement."),
            cr.length ? "Crédits en cours chez GS : " + cr.join(", ") + "." : "Aucun crédit en cours chez GS.",
            epa ? "Épargne disponible chez GS : " + epa + ". " + PN.Il + " préfère la garder pour les imprévus." : "Pas d'épargne à mettre dans le projet.",
            PN.Il + " ne voudrait pas dépasser " + E(maxMens) + " de mensualité par mois (c'est sa limite)."
          ],
          repliques: [
            ["Quel est le montant total des travaux ?", "Environ " + E(budget) + ", d'après les devis en cours."],
            ["Quand doivent-ils commencer ?", "Dans environ " + mois + " mois."],
            ["Avez-vous des devis signés ?", "Pas encore, des devis en cours. Je peux vous les envoyer."],
            ["Voulez-vous utiliser une partie de votre épargne ?", epa ? "Non, je préfère la garder. Peut-être un petit apport, on verra." : "Je n'ai pas d'épargne à mettre."],
            ["Quelle mensualité pouvez-vous supporter ?", "Pas plus de " + E(maxMens) + " par mois."]
          ],
          questions: [
            ["Vous pouvez me dire tout de suite si vous êtes d'accord ?", "Non : seule l'étude du dossier décide ; aujourd'hui, on simule pour voir ce qui est possible."],
            ["C'est combien par mois pour " + E(budget) + " ?", "Cela dépend de la durée et du taux : à simuler ensemble dans le simulateur de prêt."]
          ],
          etapes: [
            etape(ETAPE_ACCUEIL), etape(ETAPE_IDENT, fiche(c)),
            etape("Faire découvrir le projet : nature des travaux, montant, calendrier, apport, mensualité souhaitée. Regarder dans la fiche les revenus du foyer, les charges et les crédits en cours.", fiche(c)),
            etape("Simuler le prêt avec le client en direct : montant, durée, taux ; lire la mensualité obtenue et le taux d'endettement avant et après le prêt, avec le message d'alerte éventuel du simulateur.", lien("pret.html", "Simulateur de prêt")),
            etape("Si le client veut avancer : expliquer le déroulement (devis signés, justificatifs de revenus, assurance emprunteur) et lancer le montage du dossier avec le client lors du rendez-vous.", lien("montage.html", "Montage de prêt")),
            etape("Fixer un rendez-vous à l'agence pour constituer le dossier (devis, justificatifs). Si le montant ou la situation du client dépasse ce que le conseiller peut décider, prévoir de le présenter à la directrice d'agence (comité de crédit, mardi et vendredi)."),
            etape(ETAPE_CRE, cre(c))
          ],
          fin: "L'appel se termine par : une simulation chiffrée donnée au client (mensualité, durée, taux d'endettement), la liste des pièces à apporter, le rendez-vous fixé et un compte rendu précisant le projet.",
          vigilance: [
            "Ne jamais promettre un accord de prêt au téléphone : seule la suite du dossier (étude, comité de crédit) décide.",
            "Toujours exprimer le coût du crédit (taux, assurance, coût total), pas seulement la mensualité.",
            "Respecter la mensualité maximum voulue par le client : c'est sa contrainte."
          ]
        };
      }
    },
    {
      id: "placement", titre: "Somme reçue à placer", theme: "Épargne", duree: "12 à 18 minutes", niveau: "Moyen",
      resume: "Un client reçoit 12 000 € et demande où les placer.",
      profil: "Client de 35 à 75 ans ayant déjà de l'épargne chez GS.",
      critere: function (c) { return c.epa.length > 0 && c.age >= 35 && c.age <= 75; },
      construire: function (c, ctx) {
        var epa = c.epa.map(libEpargne).join(", ");
        return {
          accroche: "Bonjour, c'est " + c.prenom + " " + c.nom + ". Je viens de recevoir 12 000 euros : un héritage d'un oncle. Je ne sais pas quoi en faire. Je ne veux pas tout perdre, mais je voudrais que ça rapporte un peu plus que mon livret.",
          infos: [
            "Épargne actuelle chez GS : " + epa + ".",
            "Somme à placer : 12 000 € (un héritage), qui arrivera sur son compte courant cette semaine.",
            PN.Il + " n'aura pas besoin de cet argent avant 5 ans, mais veut pouvoir en récupérer une partie (3 000 €) en cas d'imprévu.",
            PN.Il + " n'a jamais investi en bourse. " + PN.Il + " accepte de prendre un peu de risque, à condition de comprendre. " + PN.Il + " ne voudrait pas perdre plus de 10 % de la somme."
          ],
          repliques: [
            ["Pour combien de temps pouvez-vous placer cet argent ?", "Au moins 5 ans, mais je veux garder 3 000 € disponibles."],
            ["Avez-vous déjà investi, en bourse ou en assurance-vie ?", "Jamais. Je ne connais que le livret."],
            ["Quelle perte pourriez-vous accepter ?", "Pas plus de 10 %, ça m'inquiéterait."],
            ["Qu'attendez-vous de ce placement ?", "Que ça rapporte plus que le livret, sans que ce soit compliqué."],
            ["Avez-vous besoin de cet argent pour un projet ?", "Pas dans l'immédiat. Peut-être aider mon fils plus tard."]
          ],
          questions: [
            ["Je peux perdre mon argent ?", "Sur un livret ou un compte à terme, non ; sur l'assurance-vie, selon les supports choisis, il y a un risque de perte en capital. Le profil investisseur sert à choisir."],
            ["Je peux récupérer 3 000 € si j'en ai besoin ?", "À voir selon le produit : un livret reste disponible ; un compte à terme est bloqué jusqu'à son échéance."]
          ],
          etapes: [
            etape(ETAPE_ACCUEIL), etape(ETAPE_IDENT, fiche(c)),
            etape("Regarder l'épargne et les placements déjà détenus par le client.", fiche(c, "epargne")),
            etape("Découvrir le besoin : horizon, somme disponible en cas d'imprévu, tolérance à la perte, connaissance des produits. Ne rien proposer avant d'avoir cerné le profil.", null),
            etape("Faire passer le questionnaire de profil investisseur : il est obligatoire avant de proposer un placement financier.", lien("mifid.html", "Profil investisseur (MIFID)")),
            etape("Simuler avec le client plusieurs répartitions (livret, compte à terme, assurance-vie) et lui lire les hypothèses.", lien("epargne.html", "Simulateur d'épargne")),
            etape("Proposer un rendez-vous pour finaliser : à l'agence avec le conseiller, ou avec le conseiller clientèle privée si le client souhaite un conseil patrimonial plus approfondi (agenda de l'équipe).", lien("equipe.html", "Agenda de l'équipe")),
            etape(ETAPE_CRE, cre(c))
          ],
          fin: "L'appel se termine par : le profil du client cerné, une ou deux pistes présentées avec leurs avantages et leurs risques, un rendez-vous pour finaliser et un compte rendu.",
          vigilance: [
            "Ne jamais garantir un rendement sur un produit risqué ; expliquer le risque de perte en capital.",
            "Respecter la limite de perte du client (10 %) et sa liquidité (3 000 € disponibles).",
            "Le conseil est adapté au profil investisseur : le questionnaire passe avant toute proposition."
          ]
        };
      }
    },
    {
      id: "ouverture_compte", titre: "Appelant non client : ouverture d'un compte", theme: "Entrée en relation", duree: "8 à 12 minutes", niveau: "Facile", nonClient: true,
      resume: "Une personne qui n'est pas cliente demande comment ouvrir un compte et domicilier son salaire.",
      profil: "Appelant qui ne figure pas parmi les clients de l'agence (la fenêtre d'appel indique « Appelant non client »).",
      tel: PROSPECT.tel,
      critere: function () { return true; },
      construire: function (c, ctx) {
        return {
          accroche: "Bonjour, je m'appelle " + PROSPECT.prenom + " " + PROSPECT.nom + ". Je viens de signer un CDI et je voudrais ouvrir un compte chez vous pour y domicilier mon salaire. Comment ça se passe ?",
          infos: [
            "Appelante : " + PROSPECT.civ + " " + PROSPECT.prenom + " " + PROSPECT.nom.toUpperCase() + ", " + PROSPECT.age + " ans, salariée en CDI (assistante comptable), célibataire, sans enfant, locataire à Paris.",
            "Revenus nets mensuels : 2 150 €. Résidence fiscale : France. Elle n'est pas une personne politiquement exposée.",
            "Elle n'est ni interdite bancaire ni fichée : elle ne se souvient d'aucun incident de paiement.",
            "Elle veut un compte courant, une carte bancaire et un moyen de payer par internet. Elle vient de quitter sa banque actuelle, qu'elle trouve trop chère.",
            "L'argent qui alimentera le compte : son salaire. Elle peut passer à l'agence cette semaine."
          ],
          repliques: [
            ["Êtes-vous interdite bancaire ?", "Non, jamais."],
            ["Vous avez quel âge et quelle situation ?", PROSPECT.age + " ans, salariée en CDI, célibataire."],
            ["Quelle est votre adresse et votre situation de logement ?", "Je suis locataire, dans le 19e arrondissement de Paris."],
            ["Quand pouvez-vous venir ?", "Jeudi ou vendredi matin."]
          ],
          questions: [
            ["Qu'est-ce que je dois amener ?", "Une pièce d'identité en cours de validité (original), un justificatif de domicile de moins de 3 mois et un justificatif de revenus (bulletin de salaire)."],
            ["Je peux tout faire par internet, sans venir ?", "Non : les pièces d'identité et de domicile se contrôlent à l'agence pour ouvrir le compte."]
          ],
          etapes: [
            etape(ETAPE_ACCUEIL),
            etape("L'appelante n'est pas cliente : le conseiller ne peut donner aucune information sur un compte. Présenter les comptes proposés (compte courant Équilibre ; Compte Jeune pour les 18-25 ans) et les cartes disponibles."),
            etape("Annoncer les pièces à apporter : pièce d'identité en cours de validité (original), justificatif de domicile de moins de 3 mois, et justificatif de revenus (bulletin de salaire) puisqu'elle déclare des revenus de salarié."),
            etape("Poser les questions de l'ouverture de compte à venir : situation familiale, logement, profession, revenus, résidence fiscale, personne politiquement exposée, interdit bancaire (consultation du fichier central des chèques obligatoire), origine des fonds, objet de la relation.", lien("prospect.html", "Ouverture de compte")),
            etape("Convenir d'un rendez-vous à l'agence pour constituer le dossier : un rendez-vous client ne peut pas être noté pour un non-client, il faut donc le noter dans l'agenda comme un « Rappel » dont l'objet indique le nom de la personne et la date du rendez-vous.", lien("agenda.html", "Agenda commercial"))
          ],
          fin: "L'appel se termine par : les pièces à apporter, le rendez-vous fixé, l'ouverture de compte à faire à l'agence avec la pièce d'identité, et une note dans l'agenda.",
          vigilance: [
            "Ne pas ouvrir de compte par téléphone : les pièces d'identité et de domicile sont obligatoires et se contrôlent à l'agence.",
            "Ne pas demander d'informations bancaires secrètes (code, mot de passe) à une personne qui n'est pas encore cliente.",
            "Vérifier avant l'ouverture que la personne n'est pas déjà cliente de l'agence : la banque contrôle les doublons : un client existant ne doit pas être enregistré une seconde fois."
          ]
        };
      }
    }
  ];

  /* ---------- aides propres aux scénarios ---------- */
  function prelevementAbo(c, ctx) {
    var limite = plusJ(ymdDe(auj(ctx)), -56), r = null;
    lignes(c, ctx).forEach(function (x) { if (x.kind === "prelevement" && x.m < 0 && x.ymd > limite && /abonnement (vidéo en ligne|salle de sport)/.test(x.lib)) r = x; });
    return r;
  }
  function besoinPlafond(c, ctx) { return arrondiSup(depensesCarte30j(c, ctx) + 3600, 100); }
  function projetTravaux(c) {
    var r = null;
    (c.prj || []).forEach(function (p) { if (!r && p.t === "travaux" && budgetDe(p) > 0) r = p; });
    return r;
  }
  function budgetDe(p) {
    var m = /budget d'environ ([\d   ]+)\s?€/.exec(p.detail || "");
    return m ? Number(m[1].replace(/[^\d]/g, "")) : 0;
  }
  function fraisIntl(m, our) {
    var c = Math.min(TARIF.intlMax, Math.max(TARIF.intlMin, m * TARIF.intlTaux)) + TARIF.intlSwift;
    return Math.round((c + (our ? TARIF.intlOur : 0)) * 100) / 100;
  }

  var PAR_ID = {};
  LISTE.forEach(function (s) { PAR_ID[s.id] = s; });

  /* Clients qui correspondent au profil du scénario, par numéro d'identifiant croissant (au plus « max » ; 12 par défaut). Un scénario d'appelant non client renvoie [0]. */
  function candidats(sc, clients, ctx, max) {
    var s = typeof sc === "string" ? PAR_ID[sc] : sc;
    if (!s) return [];
    if (s.nonClient) return [0];
    var res = [], liste = Array.isArray(clients) ? clients : [], n = max > 0 ? max : 12;
    for (var i = 0; i < liste.length && res.length < n; i++) {
      var c = liste[i];
      try { if (s.critere(c, ctx)) res.push(c.id); } catch (e) { /* client écarté */ }
    }
    return res;
  }

  /* Script complet pour un client (ou pour l'appelante du scénario « ouverture de compte »). */
  function construire(sc, c, ctx) {
    var s = typeof sc === "string" ? PAR_ID[sc] : sc;
    if (!s) return null;
    pronoms(c);
    var corps = s.construire(c, ctx || {});
    var identite = s.nonClient ? [["Nom et prénom", PROSPECT.civ + " " + PROSPECT.prenom + " " + PROSPECT.nom.toUpperCase()], ["Âge", PROSPECT.age + " ans"], ["Téléphone", PROSPECT.tel], ["Adresse", "Rue des Fêtes, 75019 Paris"], ["Profession", "Assistante comptable"]] : identiteClient(c, ctx || {});
    return { id: s.id, titre: s.titre, theme: s.theme, duree: s.duree, niveau: s.niveau, resume: s.resume, profil: s.profil, nonClient: !!s.nonClient,
      client: c ? { id: c.id, nom: nomComplet(c), tel: A.telClient(c) } : null, tel: s.tel || (c ? A.telClient(c) : ""), identite: identite,
      accroche: corps.accroche, infos: corps.infos, repliques: corps.repliques, questions: corps.questions || [], etapes: corps.etapes, fin: corps.fin, vigilance: corps.vigilance };
  }

  var api = { LISTE: LISTE, PAR_ID: PAR_ID, TARIF: TARIF, PLAFOND_PAI: PLAFOND_PAI, COEF: COEF, CARTES: CARTES, EPARGNES: EPARGNES, CREDITS: CREDITS, BENEFICIAIRE_MAROC: BENEFICIAIRE_MAROC, PROSPECT: PROSPECT, candidats: candidats, construire: construire,
    fraisIntl: fraisIntl, besoinPlafond: besoinPlafond, depensesCarte30j: depensesCarte30j, naissance: naissance };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.scenarios = api; }
})(typeof window !== "undefined" ? window : globalThis);
