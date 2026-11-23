/* GS Banque & Assurance – page « Réclamations » : le conseiller note la réclamation d'un client en mots simples (ce que reproche le client, d'où vient le problème, ce que le client attend,
   ce qu'il propose pour calmer la situation) et la remet au conseiller gestionnaire et/ou à la directrice d'agence ; la liste de suivi (app_reclamations.js) montre toutes les réclamations.
   Chaque champ a son aide et un exemple. Les règles de contrôle sont dans reclamations.js. */
(function () {
  "use strict";

  var W = window.SGBF, B = W.banque, RC = W.reclamations, E = W.equipe, RUI = W.reclamationsUI, ICO = W.icones, RECH = W.recherche, CL = W.clients;
  var app = document.getElementById("app"), esc = B.esc;
  var CLIENT = {}; CL.forEach(function (c) { CLIENT[c.id] = c; });
  function store() { return B.store.charger(); }
  function nomCourt(c) { return c.prenom + " " + c.nom; }
  function de(nom) { return /^[AEIOUYÀÂÉÈÊÎÔÛH]/i.test(nom) ? "d'" + nom : "de " + nom; }
  function nomListe(c) { return c.nom.toUpperCase() + " " + c.prenom; }
  function min1(s) { return s.charAt(0).toLowerCase() + s.slice(1); }
  function pl(n, s, p) { return B.nb(n) + " " + (n > 1 ? p : s); }
  function el(id) { return document.getElementById(id); }

  var etat = { client: null, q: "", err: null, ok: null };

  /* ---------- explication des mots ---------- */
  function motsHtml() {
    var m = [
      ["Réclamation", "Un client dit qu'il n'est pas content de la banque : des frais qu'il conteste, une carte refusée, une erreur, une longue attente… Il le dit à l'oral (à l'agence, au téléphone) ou à l'écrit (courrier, e-mail, message). Une simple question ou une demande de renseignement n'est pas une réclamation : il faut que le client exprime un mécontentement."],
      ["Conseiller gestionnaire", "Le conseiller qui suit le client au quotidien. Il connaît son dossier, ses comptes et son historique : c'est lui qui prépare la réponse. Dans l'agence, les clients particuliers sont suivis par un conseiller clientèle particuliers (ce peut être vous), les clients au patrimoine important par la clientèle privée, les professionnels par le conseiller clientèle professionnelle."],
      ["Directrice d'agence", "Le responsable de l'agence. Il traite les situations qui dépassent ce qu'un conseiller peut décider seul. Vous le prévenez dès que la situation est sérieuse, et toujours quand le client menace d'aller plus loin."],
      ["Geste commercial", "Un avantage que la banque accorde pour calmer un client mécontent : remboursement de frais, cotisation de carte offerte pendant quelques mois… Vous le proposez ; le conseiller gestionnaire ou la directrice décide."],
      ["Service réclamations", "Le service de la banque qui traite les réclamations que l'agence n'a pas pu régler. Le client lui écrit s'il n'est pas satisfait de la réponse de l'agence. Vous ne lui transmettez rien depuis cet écran : ici, la réclamation reste à l'agence."],
      ["Médiateur", "Une personne indépendante de la banque, que le client peut saisir gratuitement s'il n'est toujours pas satisfait après la réponse de la banque. Il propose une solution ; son avis ne s'impose ni au client ni à la banque. Vous n'avez pas à le contacter : vous pouvez seulement rappeler au client qu'il existe."]
    ];
    return '<section class="bloc rec-mots" aria-labelledby="t-mots"><details open><summary><h2 id="t-mots">Ces mots, en clair</h2></summary><dl class="rec-glossaire">' +
      m.map(function (x) { return "<div><dt>" + esc(x[0]) + "</dt><dd>" + esc(x[1]) + "</dd></div>"; }).join("") + "</dl></details></section>";
  }

  /* ---------- formulaire ---------- */
  function invalide(champ) { return etat.err && etat.err.champ === champ ? ' aria-invalid="true" aria-describedby="rc-err"' : ""; }
  function zoneClient() {
    var c = etat.client ? CLIENT[etat.client] : null;
    if (c) return '<p class="cl-choisi rec-cl-ok" id="rc-cl-ok" tabindex="-1"><span><strong>' + esc(nomCourt(c)) + "</strong> – " + c.age + " ans – " + esc(c.pro.prof) + " – client n° " + esc(c.num) + '</span><button type="button" class="btn-texte" data-act="changer-client">Changer de client</button></p>';
    return '<input id="rc-cq" type="search" autocomplete="off" maxlength="60" aria-controls="rc-cres" placeholder="Nom, prénom ou numéro du client" value="' + esc(etat.q) + '"' + invalide("client") + '><ul id="rc-cres" class="cl-res" hidden></ul><p id="rc-cstatut" class="sr" role="status"></p>';
  }
  function radios(nom, liste, avecEx, champ) {
    return liste.map(function (x, i) {
      return '<label class="pf-radio rec-radio"><input type="radio" name="' + nom + '" value="' + x.id + '"' + (i === 0 ? invalide(champ) : "") + '><span><span class="rec-r-lib">' + esc(x.lib) + "</span>" + (avecEx && x.ex ? '<span class="aide-champ rec-r-ex"> ' + esc(x.ex) + "</span>" : "") + "</span></label>";
    }).join("");
  }
  function formHtml() {
    var auj = B.aujourdhui(), jAuj = B.ymd(auj), jMin = B.ymd(B.plusJours(auj, -RC.ANCIENNETE_MAX)), jMax = B.ymd(B.plusJours(auj, RC.HORIZON_RETOUR));
    var dir = RC.directeur(), st = store();
    var h = '<section class="bloc" aria-labelledby="t-form" id="bloc-form"><div class="bloc-tete"><h2 id="t-form" tabindex="-1">Enregistrer une réclamation</h2><span class="sous">Les champs marqués d\'une étoile (*) sont obligatoires</span></div>' +
      '<p class="rec-intro">Un client vous dit qu\'il n\'est pas content. Notez ce qu\'il vous dit, cherchez d\'où vient le problème, proposez de quoi le calmer, puis remettez la réclamation au conseiller gestionnaire et/ou à la directrice d\'agence : ce sont eux qui la traitent.</p>' +
      '<form class="formulaire rec-form" id="form-rec" novalidate>' +
      /* 1. le client et la réclamation */
      '<fieldset class="rec-fs"><legend>Le client et sa réclamation</legend>' +
      '<div class="champ ag-champ-client"><label for="rc-cq">Client *</label><div id="rc-zone-client">' + zoneClient() + "</div></div>" +
      '<div class="ligne rec-ligne2"><div class="champ"><label for="rc-date">Date à laquelle le client s\'est plaint *</label><input id="rc-date" type="date" min="' + jMin + '" max="' + jAuj + '" value="' + jAuj + '"' + invalide("date") + '><p class="aide-champ">Le jour où il a exprimé son mécontentement : aujourd\'hui s\'il est devant vous.</p></div>' +
      '<div class="champ"><label for="rc-canal">Comment s\'est-il manifesté ? *</label><select id="rc-canal"' + invalide("canal") + ">" + RC.CANAUX.map(function (x) { return '<option value="' + x.id + '">' + esc(x.lib + " (" + x.sous + ")") + "</option>"; }).join("") + '</select><p class="aide-champ">Un client qui vous parle à l\'agence ou au téléphone s\'exprime à l\'oral.</p></div></div>' +
      '<div class="champ"><label for="rc-theme">Sur quoi porte sa réclamation ? *</label><select id="rc-theme"' + invalide("theme") + ' aria-describedby="rc-theme-ex"><option value="">Choisir le sujet</option>' + RC.THEMES.map(function (x) { return '<option value="' + x.id + '">' + esc(x.lib) + "</option>"; }).join("") + '</select><p class="aide-champ" id="rc-theme-ex" aria-live="polite">Choisissez le sujet qui s\'en rapproche le plus.</p></div>' +
      '<div class="champ"><label for="rc-faits">Ce que reproche le client *</label><textarea id="rc-faits" rows="4" maxlength="' + RC.LIMITES.faits[1] + '"' + invalide("faits") + ' placeholder="Exemple : Mme Martin a été prélevée de 8 € de frais pour un prélèvement rejeté le 5 novembre. Elle dit que son salaire est arrivé avec trois jours de retard et que personne ne l\'a prévenue."></textarea>' +
      '<p class="aide-champ">Écrivez ce que le client vous dit, avec ses mots : ce qui s\'est passé, quand, pour quel montant. Ne cherchez pas encore la cause ni la solution.</p></div></fieldset>' +
      /* 2. d'où vient le problème */
      '<fieldset class="rec-fs"><legend>D\'où vient le problème ? *</legend><p class="aide-champ">Cherchez ce qui a provoqué le problème, pas seulement ce que le client constate. Exemple : le client constate un prélèvement rejeté ; ce qui l\'a provoqué, c\'est un virement de salaire arrivé en retard. Regardez le dossier du client si besoin.</p>' +
      radios("rc-origine", RC.ORIGINES, true, "origine") +
      '<p class="rec-note" id="rc-origine-note" aria-live="polite"></p>' +
      '<div class="champ"><label for="rc-origine-txt">Expliquez en une phrase *</label><input id="rc-origine-txt" maxlength="' + RC.LIMITES.origineTxt[1] + '" autocomplete="off"' + invalide("origineTxt") + ' placeholder="Exemple : le virement de salaire est arrivé trois jours plus tard que d\'habitude, après la date du prélèvement."><p class="aide-champ">Si vous ne savez pas encore, écrivez ce que vous allez vérifier.</p></div></fieldset>' +
      /* 3. ce que le client attend */
      '<fieldset class="rec-fs"><legend>Ce que le client attend et comment il réagit</legend>' +
      '<div class="ligne rec-ligne2"><div class="champ"><label for="rc-attente">Ce que le client demande *</label><select id="rc-attente"' + invalide("attente") + '><option value="">Choisir</option>' + RC.ATTENTES.map(function (x) { return '<option value="' + x.id + '">' + esc(x.lib) + "</option>"; }).join("") + '</select></div>' +
      '<div class="champ"><label for="rc-attente-txt">Précisions sur sa demande <span class="aide-champ">(obligatoire pour « Autre demande »)</span></label><input id="rc-attente-txt" maxlength="' + RC.LIMITES.attenteTxt[1] + '" autocomplete="off"' + invalide("attenteTxt") + ' placeholder="Exemple : que les 8 € lui soient rendus"></div></div>' +
      '<fieldset class="pf-source rec-sous-fs"><legend>Comment réagit-il ? *</legend>' + radios("rc-niveau", RC.NIVEAUX, true, "niveau") + '<p class="rec-note" id="rc-niveau-note" aria-live="polite"></p></fieldset>' +
      '<div class="champ rec-court"><label for="rc-montant">Somme en jeu pour le client <span class="aide-champ">(facultatif, en euros)</span></label><input id="rc-montant" inputmode="decimal" maxlength="12" autocomplete="off"' + invalide("montant") + ' placeholder="Exemple : 8"><p class="aide-champ">Le montant que le client conteste ou qu\'il estime avoir perdu, s\'il y en a un.</p></div>' +
      '<div class="champ"><label for="rc-deja">Ce que vous avez déjà fait ou dit au client <span class="aide-champ">(facultatif)</span></label><textarea id="rc-deja" rows="2" maxlength="' + RC.LIMITES.deja[1] + '"' + invalide("deja") + ' placeholder="Exemple : j\'ai vérifié le compte avec lui et confirmé que le virement est arrivé le 8 novembre."></textarea></div></fieldset>' +
      /* 4. ce que vous proposez */
      '<fieldset class="rec-fs"><legend>Ce que vous proposez pour calmer la situation *</legend><p class="aide-champ">Cochez ce que vous proposez au client. Vous proposez, le conseiller gestionnaire ou la directrice décide : un remboursement ou un geste commercial ne s\'accorde pas seul.</p>' +
      RC.MESURES.map(function (x, i) { return '<label class="pf-radio rec-radio"><input type="checkbox" name="rc-mesure" value="' + x.id + '"' + (i === 0 ? invalide("mesures") : "") + "><span>" + esc(x.lib) + "</span></label>"; }).join("") +
      '<div class="champ"><label for="rc-mesures-txt">Détaillez ce que vous proposez *</label><textarea id="rc-mesures-txt" rows="3" maxlength="' + RC.LIMITES.mesuresTxt[1] + '"' + invalide("mesuresTxt") + ' placeholder="Exemple : rembourser les 8 € de frais, expliquer au client comment prévenir la banque quand son salaire est en retard, et proposer une alerte par SMS sur le solde."></textarea></div>' +
      '<div class="ligne rec-ligne2"><div class="champ"><label for="rc-geste">Montant du remboursement ou du geste proposé <span class="aide-champ">(facultatif, en euros)</span></label><input id="rc-geste" inputmode="decimal" maxlength="12" autocomplete="off"' + invalide("geste") + ' placeholder="Exemple : 8"></div>' +
      '<div class="champ"><label for="rc-retour">Quand le client aura-t-il des nouvelles ? *</label><input id="rc-retour" type="date" min="' + jAuj + '" max="' + jMax + '"' + invalide("retour") + '><p class="aide-champ">Un jour d\'ouverture de l\'agence. Donnez une date précise au client et tenez-la.</p></div></div></fieldset>' +
      /* 5. à qui remettre */
      '<fieldset class="rec-fs" id="rc-dest"><legend>À qui remettre la réclamation ? *</legend><p class="aide-champ">Choisissez la personne qui la traite : le conseiller gestionnaire du client, la directrice d\'agence, ou les deux. Un client très mécontent ou qui menace d\'aller plus loin se signale aussi à la directrice.</p>' +
      '<label class="pf-radio rec-radio"><input type="checkbox" id="rc-dest-gest"' + invalide("dest") + '><span>Le conseiller gestionnaire du client</span></label>' +
      '<div class="champ rec-gest"><label for="rc-gest">Quel conseiller gestionnaire ?</label><select id="rc-gest" disabled' + invalide("gest") + '><option value="">Choisir le conseiller</option>' +
      RC.gestionnaires().map(function (c) { return '<option value="' + c.id + '">' + esc(c.moi ? "Moi : je suis le conseiller gestionnaire de ce client" : c.prenom + " " + c.nom + " – " + E.posteLib(c)) + "</option>"; }).join("") + '</select><p class="aide-champ">Les agendas et les fonctions de chacun sont dans <a href="equipe.html">l\'agenda de l\'équipe</a>.</p></div>' +
      '<label class="pf-radio rec-radio"><input type="checkbox" id="rc-dest-dir"><span>La directrice d\'agence : ' + esc(E.nomComplet(dir, st)) + "</span></label>" +
      '<div class="champ"><label for="rc-autres">Autres informations utiles <span class="aide-champ">(facultatif)</span></label><textarea id="rc-autres" rows="3" maxlength="' + RC.LIMITES.autres[1] + '"' + invalide("autres") + ' placeholder="Exemple : cliente depuis 12 ans, très attachée à son conseiller ; elle demande une réponse écrite ; justificatif de la date du virement à lui demander."></textarea>' +
      '<p class="aide-champ">Tout ce qui aide celui qui reprend le dossier : ancienneté du client, autres produits, pièces à demander, ce que le client souhaite ou refuse.</p></div></fieldset>' +
      '<p class="msg-erreur" id="rc-err" role="alert">' + (etat.err ? esc(etat.err.erreur) : "") + "</p>" +
      '<div class="pf-btns"><button type="submit" class="btn btn-principal">Transmettre la réclamation</button><button type="button" class="btn btn-secondaire" data-act="effacer">Effacer le formulaire</button></div></form></section>';
    return h;
  }

  /* ---------- lecture du formulaire ---------- */
  function val(id) { var e = el(id); return e ? e.value : ""; }
  function radio(nom) { var e = app.querySelector('input[name="' + nom + '"]:checked'); return e ? e.value : ""; }
  function saisie() {
    var gestOn = el("rc-dest-gest") && el("rc-dest-gest").checked;
    return {
      client: etat.client, date: val("rc-date"), canal: val("rc-canal"), theme: val("rc-theme"), faits: val("rc-faits"), origine: radio("rc-origine"), origineTxt: val("rc-origine-txt"),
      attente: val("rc-attente"), attenteTxt: val("rc-attente-txt"), niveau: radio("rc-niveau"), montant: val("rc-montant"), deja: val("rc-deja"),
      mesures: [].slice.call(app.querySelectorAll('input[name="rc-mesure"]:checked')).map(function (x) { return x.value; }), mesuresTxt: val("rc-mesures-txt"), geste: val("rc-geste"), retour: val("rc-retour"),
      gest: gestOn ? val("rc-gest") : "", dir: !!(el("rc-dest-dir") && el("rc-dest-dir").checked), autres: val("rc-autres"),
      _gestCoche: !!gestOn
    };
  }
  var CIBLE = { client: "rc-cq", date: "rc-date", canal: "rc-canal", theme: "rc-theme", faits: "rc-faits", origineTxt: "rc-origine-txt", attente: "rc-attente", attenteTxt: "rc-attente-txt", montant: "rc-montant", deja: "rc-deja",
    mesuresTxt: "rc-mesures-txt", geste: "rc-geste", retour: "rc-retour", autres: "rc-autres", gest: "rc-gest", dest: "rc-dest-gest", dir: "rc-dest-dir" };
  function cibleErreur(champ) {
    if (champ === "origine") return app.querySelector('input[name="rc-origine"]');
    if (champ === "niveau") return app.querySelector('input[name="rc-niveau"]');
    if (champ === "mesures") return app.querySelector('input[name="rc-mesure"]');
    if (champ === "client") return el("rc-cq") || el("rc-cl-ok");
    return el(CIBLE[champ] || "rc-err") || el("rc-err");
  }
  function marquer(champ) {
    app.querySelectorAll("[aria-invalid]").forEach(function (e) { e.removeAttribute("aria-invalid"); if (e.getAttribute("aria-describedby") === "rc-err") e.removeAttribute("aria-describedby"); });
    var c = cibleErreur(champ);
    if (c && c.id !== "rc-err") { c.setAttribute("aria-invalid", "true"); c.setAttribute("aria-describedby", "rc-err"); }
    return c;
  }

  /* ---------- confirmation ---------- */
  function okHtml() {
    var o = etat.ok; if (!o) return "";
    var r = RC.trouver(store(), o), c = r ? CLIENT[r.client] : null;
    if (!r || !c) return "";
    var st = store(), dests = RC.destinataires(r, st);
    var liens = dests.filter(function (d) { return !d.moi; }).map(function (d) { return '<a class="btn-texte" href="agenda.html?client=' + c.id + "&amp;type=rdv_col&amp;avec=" + d.id + '">Prendre rendez-vous pour le client avec ' + esc(d.nom) + "</a>"; }).join("") +
      '<a class="btn-texte" href="agenda.html?client=' + c.id + "&amp;type=relance&amp;date=" + esc(r.retour) + '">Programmer le rappel du client</a><a class="btn-texte" href="client.html?id=' + c.id + '#reclamations">Ouvrir le dossier du client</a>' +
      (W.impression ? '<button type="button" class="btn-texte btn-impr" data-act="imprimer-ok" data-id="' + esc(r.id) + '">' + ICO.imprimante + "<span>Imprimer la fiche</span></button>" : "");
    return '<div class="rec-ok" id="rec-ok" role="status" tabindex="-1"><p><strong>Réclamation ' + esc(r.ref) + " transmise.</strong> Elle est remise à : " + esc(RC.listeNoms(dests)) + ". Elle figure dans le dossier " + esc(de(nomCourt(c))) + " (onglet « Réclamations »).</p>" +
      "<p>Et maintenant :</p><p class=\"rec-ok-liens\">" + liens + "</p></div>";
  }
  function majOk() { var z = el("z-ok"); if (z) z.innerHTML = okHtml(); }

  /* ---------- synthèse ---------- */
  function synthese() {
    var st = store(), ouv = RC.ouvertes(st), ret = RC.enRetard(st), tot = RC.elements(st).length;
    if (!tot) return "Aucune réclamation enregistrée pour le moment.";
    return pl(ouv.length, "réclamation à suivre", "réclamations à suivre") + (ret.length ? ", dont " + pl(ret.length, "pour laquelle le client attend des nouvelles depuis plus longtemps que promis", "pour lesquelles le client attend des nouvelles depuis plus longtemps que promis") : "") + " ; " + pl(tot, "réclamation enregistrée en tout", "réclamations enregistrées en tout") + ".";
  }
  function majSynthese() { var z = el("rec-synthese"); if (z) z.textContent = synthese(); }

  /* ---------- page ---------- */
  function render() {
    app.innerHTML = '<nav class="fil-ariane" aria-label="Fil d\'Ariane"><a href="index.html">' + ICO.retour + "Accueil</a><span aria-hidden=\"true\">/</span><span>Réclamations</span></nav>" +
      '<div class="page-titre"><h1>Réclamations</h1><p id="rec-synthese" role="status">' + esc(synthese()) + "</p></div>" +
      '<div id="z-ok"></div><div class="page-grille">' + motsHtml() + '<div id="z-form">' + formHtml() + "</div>" +
      '<section class="bloc" aria-labelledby="t-suivi"><div class="bloc-tete"><h2 id="t-suivi" tabindex="-1">Suivi des réclamations</h2><span class="sous">Ouvrez une réclamation pour la lire, noter une suite, enregistrer la réponse donnée au client ou la clôturer</span></div>' + RUI.html(null) + "</section></div>";
    majOk();
  }
  function majForm() { el("z-form").innerHTML = formHtml(); }
  function suggestions() {
    var z = el("rc-cres"), s = el("rc-cstatut"); if (!z) return;
    var q = etat.q.trim();
    if (q.length < 2) { z.hidden = true; z.innerHTML = ""; s.textContent = ""; return; }
    var r = RECH.chercher(CL, q, 8);
    z.innerHTML = r.length ? r.map(function (c) { return '<li><button type="button" data-act="choisir-client" data-id="' + c.id + '"><span class="rech-nom">' + esc(nomListe(c)) + '</span><span class="rech-sous">' + c.age + " ans – " + esc(c.pro.prof) + " – " + esc(c.num) + "</span></button></li>"; }).join("") : '<li class="rech-vide">Aucun client ne correspond à « ' + esc(q) + " ».</li>";
    s.textContent = r.length ? pl(r.length, "résultat", "résultats") : "Aucun résultat";
    z.hidden = false;
  }
  function transmettre() {
    var o = saisie(), st = store(), r = RC.valider(st, o);
    /* « Le conseiller gestionnaire » coché sans que le conseiller soit choisi : on le dit, au lieu de l'ignorer */
    if ((r.ok || r.champ === "dest") && o._gestCoche && !o.gest) r = { ok: false, champ: "gest", erreur: "Vous avez coché « Le conseiller gestionnaire du client » : choisissez lequel dans la liste." };
    if (r.ok) r = RC.creer(st, o);
    if (!r.ok) {
      etat.err = r; el("rc-err").textContent = r.erreur;
      var c = marquer(r.champ); if (c) { if (!c.hasAttribute("tabindex") && !/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(c.tagName)) c.setAttribute("tabindex", "-1"); c.focus(); }
      return;
    }
    B.store.sauver();
    etat.err = null; etat.ok = r.reclamation.id; etat.client = null; etat.q = "";
    majForm(); majOk(); RUI.montrer(r.reclamation.id); majSynthese();
    var ok = el("rec-ok"); if (ok) { ok.scrollIntoView({ block: "center" }); ok.focus(); }
  }

  /* ---------- événements ---------- */
  app.addEventListener("input", function (e) {
    var t = e.target;
    if (t.id === "rc-cq") { etat.q = t.value; suggestions(); return; }
    if (t.hasAttribute && t.getAttribute("aria-invalid") === "true") { t.removeAttribute("aria-invalid"); t.removeAttribute("aria-describedby"); }
  });
  app.addEventListener("change", function (e) {
    var t = e.target;
    if (t.id === "rc-theme") {
      var th = RC.PAR.theme[t.value];
      el("rc-theme-ex").textContent = th ? "Exemple : " + th.ex : "Choisissez le sujet qui s'en rapproche le plus.";
    } else if (t.name === "rc-origine") {
      var og = RC.PAR.origine[t.value], n = el("rc-origine-note");
      n.textContent = !og ? "" : og.id === "fraude" ? "Fraude : protégez d'abord le client (par exemple en faisant opposition à sa carte si elle est concernée), puis enregistrez la réclamation." :
        og.banque ? "La banque semble en cause : pensez à corriger ce qui peut l'être et, si le client a subi un coût, à proposer le remboursement ou un geste commercial." :
          og.id === "regle" ? "Le client conteste une règle, pas une erreur : expliquez-la clairement et voyez avec le conseiller gestionnaire si un geste est possible." : "";
    } else if (t.name === "rc-niveau") {
      var nn = el("rc-niveau-note");
      if (t.value === "menace") { el("rc-dest-dir").checked = true; nn.textContent = "Le client menace d'aller plus loin : la directrice d'agence doit être prévenue : sa case est donc cochée pour la remise de la réclamation."; }
      else nn.textContent = t.value === "fache" ? "Un client très mécontent : prévenez au moins son conseiller gestionnaire, et la directrice si la situation ne se calme pas." : "";
    } else if (t.id === "rc-dest-gest") {
      el("rc-gest").disabled = !t.checked;
      if (!t.checked) el("rc-gest").value = "";
    }
    if (t.getAttribute && t.getAttribute("aria-invalid") === "true") { t.removeAttribute("aria-invalid"); t.removeAttribute("aria-describedby"); }
  });
  app.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    var act = b.getAttribute("data-act");
    if (act === "choisir-client") { etat.client = parseInt(b.getAttribute("data-id"), 10); etat.q = ""; el("rc-zone-client").innerHTML = zoneClient(); var d = el("rc-date"); if (d) d.focus(); }
    else if (act === "changer-client") { etat.client = null; etat.q = ""; el("rc-zone-client").innerHTML = zoneClient(); el("rc-cq").focus(); }
    else if (act === "effacer") { etat.err = null; etat.client = null; etat.q = ""; majForm(); var t = el("t-form"); if (t) t.focus(); }
    else if (act === "imprimer-ok") RUI.imprimer(b.getAttribute("data-id"));
  });
  app.addEventListener("submit", function (e) { if (e.target.id === "form-rec") { e.preventDefault(); transmettre(); } });
  document.addEventListener("sgbf:reclamations", majSynthese);

  RECH.init(CL, el("rech"), el("rech-res"), el("rech-statut"));
  var pc = parseInt(new URLSearchParams(location.search).get("client"), 10);
  if (CLIENT[pc]) etat.client = pc;
  render();
  var pk = new URLSearchParams(location.search).get("canal"), sk = el("rc-canal");        /* ?canal=avis : ouvert depuis « Avis clients en ligne » */
  if (sk && pk && RC.PAR.canal[pk]) sk.value = pk;
  if (CLIENT[pc]) { var d0 = el("rc-theme"); if (d0) d0.focus(); }
})();
