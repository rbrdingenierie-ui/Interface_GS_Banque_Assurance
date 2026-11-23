/* GS Banque & Assurance – onglet « Opérations de service » de la fiche client 360°.
   Ce que l'on fait pour un client à l'accueil : virements, oppositions, contestation d'opérations par carte, plafond et montée en gamme de carte, chèque de banque, chéquier, rejet de prélèvement, retrait d'espèces, achat et vente de devises.
   Chaque formulaire commence par la vérification d'identité du client (sans elle, pas d'opération).
   Parcours d'une opération : choisir l'opération → remplir le formulaire (contrôles en direct) → « Préparer le document à signer » → impression du document, signé par le client →
   « Le client a signé : exécuter l'opération » (le compte et les cartes changent) ou « Annuler ». La lettre de désistement d'un chèque se trouve dans « Courriers et documents » (le journal y renvoie, chèque prérempli).
   Les règles et les contrôles sont dans operations_service.js ; les documents dans documents_service.js. Utilisation : html(c) renvoie l'onglet ; l'écran se rafraîchit seul. */
(function () {
  "use strict";

  var SG = window.SGBF, B = SG.banque, OS = SG.operations, DS = SG.documentsService, IMP = SG.impression, ICO = SG.icones, PR = SG.produits, CL = SG.clients, RIB = SG.rib;
  var esc = B.esc;
  var CLIENT = {}; CL.forEach(function (c) { CLIENT[c.id] = c; });
  var etat = { cid: null, type: null, v: {}, err: null, apercu: null, vue: null, msg: null, annuler: null };

  function store() { return B.store.charger(); }
  function eur(x) { return B.eur2(x); }
  function pl(n, s, p) { return n + " " + (n > 1 ? p : s); }
  function zone() { return document.getElementById("op-zone"); }
  function clientCourant() { return CLIENT[etat.cid]; }

  /* ---------- bloc du haut : compte et cartes ---------- */
  function kpis(c) {
    var cpt = OS.compte(c, store()), nb = OS.aSigner(store(), c.id).length;
    function k(lib, val, det) { return '<div class="kpi"><dt>' + esc(lib) + '</dt><dd class="val">' + esc(val) + "</dd>" + (det ? '<dd class="det">' + esc(det) + "</dd>" : "") + "</div>"; }
    return '<dl class="kpis kpis-3 op-kpis">' + k("Solde du compte courant", eur(cpt.solde), "compte n° " + cpt.rib.compte) + k("Disponible", eur(cpt.dispo), cpt.decouvert ? "découvert autorisé de " + eur(cpt.decouvert) + " compris" : "aucun découvert autorisé") +
      k("Opérations à signer", String(nb), nb ? "à faire signer ou à annuler" : "aucune en attente") + "</dl>";
  }
  function cartesBloc(c) {
    var ks = OS.cartes(c, store());
    if (!ks.length) return '<section class="bloc" aria-labelledby="op-t-cartes"><div class="bloc-tete"><h2 id="op-t-cartes">Cartes du client</h2></div><p class="vide-bloc">Le client n\'a aucune carte.</p></section>';
    var cls = { active: "puce-ok", opposee: "puce-bad", remplacee: "puce-warn", resiliee: "puce-bad" };
    return '<section class="bloc" aria-labelledby="op-t-cartes"><div class="bloc-tete"><h2 id="op-t-cartes">Cartes du client</h2></div><div class="tab-wrap" tabindex="0" role="region" aria-label="Cartes du client et plafonds"><table class="tab-ventes op-tab"><thead><tr><th scope="col" class="gauche">Carte</th><th scope="col" class="gauche">État</th><th scope="col">Paiement (30 jours)</th><th scope="col">Retrait (7 jours)</th></tr></thead><tbody>' +
      ks.map(function (k) {
        var pai = k.p === "CRET" ? "Aucun paiement" : esc(eur(k.paiEff)) + (k.temp ? ' <span class="mention">(jusqu\'au ' + esc(B.fmtDate(k.temp.fin)) + ")</span>" : "");
        return '<tr><th scope="row" class="gauche">' + esc(k.nom) + (k.sys ? ' <span class="mention">(autorisation systématique)</span>' : "") + '</th><td class="gauche"><span class="puce ' + (cls[k.etat] || "") + '">' + esc(k.etatLib) + "</span>" + (k.note ? '<br><span class="mention">' + esc(k.note) + "</span>" : "") + "</td><td>" + pai + "</td><td>" + esc(eur(k.retEff)) + "</td></tr>";
      }).join("") + "</tbody></table></div></section>";
  }

  /* ---------- choix de l'opération ---------- */
  function choixBloc() {
    return '<section class="bloc" aria-labelledby="op-t-choix"><div class="bloc-tete"><h2 id="op-t-choix">Que veut faire le client ?</h2></div>' + OS.GROUPES.map(function (g) {
      return '<h3 class="sous-titre">' + esc(g.lib) + '</h3><ul class="op-tuiles">' + OS.TYPES.filter(function (t) { return t.groupe === g.id; }).map(function (t) {
        var sel = etat.type === t.id;
        return '<li><button type="button" class="op-tuile' + (sel ? " op-tuile-sel" : "") + '" data-op="nouveau" data-type="' + t.id + '" aria-pressed="' + sel + '"><strong>' + esc(t.lib) + "</strong><span>" + esc(t.aide) + "</span></button></li>";
      }).join("") + "</ul>";
    }).join("") + "</section>";
  }

  /* ---------- formulaire ---------- */
  /* Valeurs proposées d'office (type d'exécution, durée…) ; elles peuvent en faire apparaître d'autres (plafond de la carte choisie) : on recommence jusqu'à ce que plus rien ne change. */
  function appliquerDefauts(id, c) {
    var f, i, change;
    for (i = 0; i < 4; i++) {
      f = OS.formulaire(id, c, store(), etat.v); change = false;
      f.champs.forEach(function (x) {
        if (x.def == null || x.def === "") return;
        var cur = etat.v[x.id];
        if (cur === undefined) { etat.v[x.id] = x.def; change = true; }
        else if (x.type === "select" && x.options && cur !== "" && !x.options.some(function (o) { return String(o.v) === String(cur); })) { etat.v[x.id] = x.def; change = true; }   /* le choix précédent n'est plus proposé */
      });
      if (!change) break;
    }
    return f;
  }
  function erreurDe(id) { var l = (etat.err || []).filter(function (e) { return e.champ === id; })[0]; return l ? l.msg : ""; }
  function champHtml(f) {
    var v = etat.v[f.id], err = erreurDe(f.id), cid = "op-f-" + f.id, d = err ? ' aria-invalid="true" aria-describedby="op-e-' + f.id + '"' : (f.aide ? ' aria-describedby="op-a-' + f.id + '"' : "");
    var aide = f.aide ? '<span class="aide-champ" id="op-a-' + f.id + '">' + esc(f.aide) + "</span>" : "";
    var msg = '<span class="msg-erreur" id="op-e-' + f.id + '" role="alert">' + esc(err) + "</span>";
    var ast = f.requis && f.type !== "case" ? " *" : "";
    if (f.type === "info") return '<p class="op-info" id="op-f-' + f.id + '">' + esc(f.texte) + "</p>";
    if (f.type === "case") {
      return '<div class="champ op-champ-case"><label class="op-case" for="' + cid + '"><input type="checkbox" id="' + cid + '" name="' + f.id + '"' + (f.recalc ? ' data-recalc="1"' : "") + (v === true ? " checked" : "") + d + "><span>" + esc(f.lib) + "</span></label>" + aide + msg + "</div>";
    }
    if (f.type === "coches") {
      var sel = Array.isArray(v) ? v : [];
      return '<fieldset class="champ op-coches"><legend>' + esc(f.lib) + ast + "</legend>" + aide + '<div class="op-coches-liste">' + f.options.map(function (o, i) {
        return '<label class="op-case" for="' + cid + "-" + i + '"><input type="checkbox" id="' + cid + "-" + i + '" name="' + f.id + '" data-multi="1"' + (f.recalc ? ' data-recalc="1"' : "") + ' value="' + esc(o.v) + '"' + (sel.indexOf(o.v) >= 0 ? " checked" : "") + "><span>" + esc(o.lib) + "</span></label>";
      }).join("") + "</div>" + msg + "</fieldset>";
    }
    var champ;
    if (f.type === "select") {
      champ = '<select id="' + cid + '" name="' + f.id + '"' + (f.recalc ? ' data-recalc="1"' : "") + d + ">" + (f.vide ? '<option value="">' + esc(f.vide) + "</option>" : "") + f.options.map(function (o) {
        return '<option value="' + esc(o.v) + '"' + (String(v) === String(o.v) ? " selected" : "") + (o.desactive ? " disabled" : "") + ">" + esc(o.lib) + "</option>";
      }).join("") + "</select>";
    } else if (f.type === "date") champ = '<input type="date" id="' + cid + '" name="' + f.id + '" value="' + esc(v || "") + '" min="2000-01-01" max="2100-12-31"' + (f.recalc ? ' data-recalc="1"' : "") + d + ">";
    else champ = '<input type="text" id="' + cid + '" name="' + f.id + '" value="' + esc(v == null ? "" : v) + '" autocomplete="off" spellcheck="false"' + (f.max ? ' maxlength="' + f.max + '"' : "") + (f.type === "montant" || f.type === "cours" ? ' inputmode="decimal"' : "") + (f.recalc ? ' data-recalc="1"' : "") + d + ">";
    return '<div class="champ"><label for="' + cid + '">' + esc(f.lib) + ast + "</label>" + champ + aide + msg + "</div>";
  }
  var LEGENDES = { identite: "Vérification d'identité", verifs: "Vérifications à faire avant la clôture", verifsdesol: "Vérifications à faire avant la désolidarisation", versement: "Versement du solde au client" };
  /* Les champs d'un même groupe (la vérification d'identité) sont encadrés ensemble. */
  function champsHtml(champs) {
    var h = "", ouvert = null;
    champs.forEach(function (f) {
      if (f.groupe !== ouvert) {
        if (ouvert) h += "</fieldset>";
        if (f.groupe) h += '<fieldset class="op-groupe op-groupe-' + f.groupe + '"><legend>' + esc(LEGENDES[f.groupe] || "") + "</legend>";
        ouvert = f.groupe || null;
      }
      h += champHtml(f);
    });
    return h + (ouvert ? "</fieldset>" : "");
  }
  /* Clôture : le client verse son solde sur le RIB d'un nouveau compte ouvert à son nom dans une autre banque ; on propose un RIB d'exercice. */
  function exempleRibCloture(c) {
    var r = OS.ribEntrainement(c);
    return '<details class="op-exemples"><summary>RIB pour s\'entraîner</summary><p class="mention">Compte du client dans une autre banque (imaginaire). Si le solde est versé par virement, saisissez ce titulaire et cet IBAN.</p><div class="tab-wrap" tabindex="0" role="region" aria-label="RIB d\'exercice du client"><table class="tab-ventes op-tab"><thead><tr><th scope="col" class="gauche">Banque</th><th scope="col" class="gauche">Titulaire</th><th scope="col" class="gauche">IBAN</th><th scope="col" class="gauche">BIC</th></tr></thead><tbody><tr><th scope="row" class="gauche">' + esc(r.banque) + '</th><td class="gauche">' + esc(r.titulaire) + '</td><td class="gauche"><code>' + esc(r.ibanLisible) + '</code></td><td class="gauche"><code>' + esc(r.bic) + "</code></td></tr></tbody></table></div></details>";
  }
  function exemplesIban(c, type) {
    if (type === "cloture_compte") return exempleRibCloture(c);
    if (["virement_sepa", "virement_intl", "virement_interne"].indexOf(type) < 0) return "";
    var ex = OS.EXEMPLES.filter(function (e) { return type === "virement_intl" ? !OS.SEPA[e.pays] : type === "virement_sepa" ? !!OS.SEPA[e.pays] : false; });
    var autres = CL.filter(function (x) { return x.id !== c.id && x.cpt.p === "CPT"; }).slice(0, 3).map(function (x) { var r = RIB.rib(x); return { lib: "Client de l'agence", iban: r.iban, nom: r.titulaire }; });
    var lignes = type === "virement_interne" ? autres : ex.map(function (e) { return { lib: e.lib, iban: e.iban, nom: e.titulaires[0] }; });
    return '<details class="op-exemples"><summary>IBAN pour s\'entraîner</summary><p class="mention">Comptes d\'exercice, avec leur titulaire (le nom saisi est comparé au titulaire par la vérification du bénéficiaire).</p><div class="tab-wrap" tabindex="0" role="region" aria-label="IBAN d\'exercice"><table class="tab-ventes op-tab"><thead><tr><th scope="col" class="gauche">Compte</th><th scope="col" class="gauche">Titulaire</th><th scope="col" class="gauche">IBAN</th></tr></thead><tbody>' +
      lignes.map(function (l) { return '<tr><th scope="row" class="gauche">' + esc(l.lib) + '</th><td class="gauche">' + esc(l.nom) + '</td><td class="gauche"><code>' + esc(OS.ibanLisible(l.iban)) + "</code></td></tr>"; }).join("") + "</tbody></table></div></details>";
  }
  function apercuControle() {
    var r = etat.apercu;
    if (!r || !r.ok) return "";
    return '<div class="op-apercu" role="status"><h3>Contrôles réussis</h3><dl class="op-resume">' + r.resume.map(function (l) { return "<dt>" + esc(l[0]) + "</dt><dd>" + esc(l[1]) + "</dd>"; }).join("") + "</dl>" +
      (r.alertes.length ? '<ul class="op-alertes">' + r.alertes.map(function (t) { return '<li><span class="op-al-ico" aria-hidden="true">' + ICO.info + '</span><span><strong>À savoir : </strong>' + esc(t) + "</span></li>"; }).join("") + "</ul>" : "") + "</div>";
  }
  function resumeErreurs() {
    if (!etat.err || !etat.err.length) return '<div id="op-err" class="msg-erreur" role="alert" tabindex="-1"></div>';
    return '<div id="op-err" class="op-erreurs" role="alert" tabindex="-1"><strong>' + pl(etat.err.length, "point à corriger", "points à corriger") + " :</strong><ul>" + etat.err.map(function (e) {
      return "<li>" + (e.champ ? '<a href="#op-f-' + e.champ + '" data-op="aller" data-champ="' + e.champ + '">' + esc(e.msg) + "</a>" : esc(e.msg)) + "</li>";
    }).join("") + "</ul></div>";
  }
  function formBloc(c) {
    var t = OS.PAR_ID[etat.type], f = appliquerDefauts(etat.type, c);
    etat.sig = JSON.stringify(f.champs);
    return '<section class="bloc op-form-bloc" aria-labelledby="op-t-form"><div class="bloc-tete"><h2 id="op-t-form" tabindex="-1">' + esc(t.lib) + '</h2><button type="button" class="btn btn-secondaire" data-op="fermer">Fermer</button></div><p class="mention">' + esc(t.aide) + "</p>" +
      exemplesIban(c, etat.type) + '<form id="op-form" class="formulaire op-form" novalidate>' + resumeErreurs() + '<div class="op-champs">' + champsHtml(f.champs) + "</div>" + apercuControle() +
      '<div class="pf-btns"><button type="submit" class="btn btn-principal">' + (etat.type === "opposition_carte" && etat.v.idverif === "tel" ? "Enregistrer l\'opposition : la carte est bloquée tout de suite" : etat.type === "contestation_carte" ? "Préparer le kit de contestation à signer" : etat.type === "cloture_compte" ? "Préparer la demande de clôture à signer" : "Préparer le document à signer") + '</button> <button type="button" class="btn btn-secondaire" data-op="controler">Contrôler seulement</button></div></form></section>';
  }

  /* ---------- document préparé ---------- */
  /* Contestation exécutée avec la carte en main, sans opposition enregistrée depuis : le client doit encore faire opposition (utilisation frauduleuse). */
  function aOpposer(op) { return op.type === "contestation_carte" && OS.aOpposer(store(), op.c).some(function (x) { return x.id === op.id; }); }
  /* Situation à proposer pour contester après une opposition : le motif de l'opposition donne la situation de la carte. */
  function situationApres(opp) { return opp.v.motif === "vol" ? "volee" : opp.v.motif === "perte" ? "perdue" : "possession"; }
  function puceStatut(op) {
    var prog = op.statut === "executee" && op.mv && op.mv.length && op.mv[0].ymd > B.ymd(B.aujourdhui());
    var cls = { asigner: "puce-warn", executee: "puce-ok", annulee: "" }[op.statut];
    var conf = op.statut === "executee" && op.confirmation === "attendue" ? " – confirmation écrite attendue" : op.statut === "executee" && op.confirmation === "recue" ? " – confirmée par écrit" : "";
    if (conf) cls = op.confirmation === "attendue" ? "puce-warn" : "puce-ok";
    if (aOpposer(op)) { cls = "puce-warn"; conf += " – opposition pour fraude à faire"; }
    return '<span class="puce ' + cls + '">' + esc(OS.STATUTS[op.statut]) + (prog ? " – programmée le " + esc(B.fmtDate(B.lireYmd(op.mv[0].ymd))) : "") + esc(conf) + "</span>";
  }
  /* À l'écran, la signature du conseiller porte le nom de l'élève (celui qu'il a saisi) ; à l'impression, identite.js l'inscrit au même endroit. */
  function habiller(corpsHtml) {
    var n = SG.identite && SG.identite.nomCourant ? SG.identite.nomCourant() : "";
    return corpsHtml.replace(/<span data-eleve><\/span>/g, n ? esc(n) : '<span class="op-nom-vide">votre nom</span>');
  }
  /* Opposition et contestation sont deux opérations distinctes, liées : on conteste les opérations que le client ne reconnaît pas, on fait opposition à la carte pour l'empêcher de resservir. */
  function liens(op) {
    if (op.type === "opposition_carte" && op.statut === "executee" && op.v.motif !== "abusive")
      return '<button type="button" class="btn btn-principal" data-op="contester" data-id="' + op.id + '">Contester des opérations par carte</button> ';
    if (aOpposer(op)) return '<button type="button" class="btn btn-principal" data-op="opposer" data-id="' + op.id + '">Faire opposition pour fraude</button> ';
    return "";
  }
  /* Opérations qui produisent une attestation remise au client une fois exécutées : libellés des boutons et des titres. */
  var ATTESTATIONS = {
    cloture_compte: { bouton: "Imprimer l'attestation de clôture (PDF)", demande: "Imprimer la demande de clôture (PDF)", titreDemande: "Demande de clôture signée par le client", titre: "Attestation de clôture remise au client" },
    desolidarisation_compte: { bouton: "Imprimer l'attestation de désolidarisation (PDF)", demande: "Imprimer la demande de désolidarisation (PDF)", titreDemande: "Demande de désolidarisation signée par les deux cotitulaires", titre: "Attestation de désolidarisation remise aux deux titulaires" }
  };
  /* Clôture ou désolidarisation exécutée : l'attestation remise au client (aux deux titulaires pour une désolidarisation). */
  function attestationApercu(op, c) {
    var a = DS.attestation(op, c, { st: store() });
    return '<h3 class="sous-titre">' + esc(ATTESTATIONS[op.type].titre) + '</h3><div class="apercu-doc" role="region" tabindex="0" aria-label="Aperçu du document : ' + esc(a.titre) + '">' + habiller(a.corps) + "</div>";
  }
  function vueBloc(c) {
    var op = OS.trouver(store(), etat.vue);
    if (!op) return "";
    var d = DS.document(op, c, { st: store() }), t = OS.PAR_ID[op.type], btn = "", clo = op.statut === "executee" ? ATTESTATIONS[op.type] || null : null;
    if (op.statut === "asigner") {
      btn = '<button type="button" class="btn btn-secondaire" data-op="imprimer" data-id="' + op.id + '">Imprimer le document (PDF)</button> <button type="button" class="btn btn-principal" data-op="executer" data-id="' + op.id + '">Le client a signé : exécuter l\'opération</button> ' +
        (etat.annuler === op.id ? '<span class="op-conf" role="group" aria-label="Confirmer l\'annulation">Annuler cette opération ? <button type="button" class="btn btn-danger" data-op="annuler" data-id="' + op.id + '">Oui, annuler</button> <button type="button" class="btn btn-secondaire" data-op="garder">Non, la garder</button></span>'
          : '<button type="button" class="btn btn-secondaire" data-op="demander-annuler" data-id="' + op.id + '">Annuler l\'opération</button>');
    } else if (op.statut === "executee") {
      btn = (clo ? '<button type="button" class="btn btn-principal" data-op="attestation" data-id="' + op.id + '">' + esc(clo.bouton) + "</button> " : "") +
        '<button type="button" class="btn btn-secondaire" data-op="imprimer" data-id="' + op.id + '">' + (clo ? esc(clo.demande) : "Imprimer le document (PDF)") + "</button> " +
        (op.confirmation === "attendue" ? '<button type="button" class="btn btn-principal" data-op="confirmer" data-id="' + op.id + '">Le client a confirmé par écrit</button> ' : "") +
        liens(op) + '<button type="button" class="btn btn-secondaire" data-op="releve">Voir le relevé du compte</button>';
    }
    return '<section class="bloc op-vue" aria-labelledby="op-t-vue"><div class="bloc-tete"><h2 id="op-t-vue" tabindex="-1">' + esc(t.lib) + " – " + esc(op.ref) + '</h2><span>' + puceStatut(op) + '</span></div>' +
      '<p class="mention">' + (op.statut === "asigner" ? "Relisez le document avec le client : nom, montant et références doivent être exacts. Imprimez-le, faites-le signer, puis exécutez l'opération." : op.statut === "executee" ? "Opération exécutée le " + esc(B.fmtDate(B.lireYmd(op.dateExec))) + " à " + esc(op.heureExec) + "." + (op.confirmation === "attendue" ? " Le client a été identifié par téléphone : la carte est bloquée, mais il doit confirmer son opposition par écrit. Imprimez le document : il le signera à l'agence, avec sa pièce d'identité." : op.confirmation === "recue" ? " Confirmation écrite reçue le " + esc(B.fmtDate(B.lireYmd(op.dateConf))) + "." : "") + (op.type === "contestation_carte" ? " Le kit signé part au Service Moyens de Paiement ; les opérations contestées sont recréditées sur le compte." + (aOpposer(op) ? " La carte est encore en circulation : faites l'opposition pour utilisation frauduleuse." : "") : "") + (op.type === "cloture_compte" ? " Le compte est clôturé : cartes résiliées, livrets soldés, solde versé au client. Remettez-lui l'attestation de clôture du compte et des épargnes." : "") + (op.type === "desolidarisation_compte" ? " Le compte est devenu le compte individuel de " + esc(op.desol.conserveNom) + " : " + esc(op.desol.partantNom) + " n'en est plus titulaire. Remettez l'attestation de désolidarisation aux deux titulaires." : "") : "Opération annulée.") + "</p>" +
      '<div class="pf-btns">' + btn + ' <button type="button" class="btn btn-secondaire" data-op="fermer-vue">Fermer</button></div>' +
      (clo ? '<h3 class="sous-titre">' + esc(clo.titreDemande) + "</h3>" : "") +
      '<div class="apercu-doc" role="region" tabindex="0" aria-label="Aperçu du document : ' + esc(d.titre) + '">' + habiller(d.corps) + "</div>" +
      (clo ? attestationApercu(op, c) : "") + "</section>";
  }

  /* ---------- journal ---------- */
  function sommeMv(op) { return (op.mv || []).reduce(function (t, m) { return t + m.m; }, 0); }
  function journalBloc(c) {
    var l = OS.liste(store(), c.id);
    if (!l.length) return '<section class="bloc" aria-labelledby="op-t-j"><div class="bloc-tete"><h2 id="op-t-j">Opérations de ce client</h2></div><p class="vide-bloc">Aucune opération de service pour ce client.</p></section>';
    return '<section class="bloc" aria-labelledby="op-t-j"><div class="bloc-tete"><h2 id="op-t-j">Opérations de ce client</h2><span class="sous">' + pl(l.length, "opération", "opérations") + '</span></div><div class="tab-wrap" tabindex="0" role="region" aria-label="Opérations de service du client"><table class="tab-ventes op-tab"><thead><tr><th scope="col" class="gauche">Référence</th><th scope="col" class="gauche">Opération</th><th scope="col" class="gauche">Détail</th><th scope="col">Effet sur le compte</th><th scope="col" class="gauche">État</th><th scope="col" class="gauche">Actions</th></tr></thead><tbody>' +
      l.map(function (op) {
        var t = OS.PAR_ID[op.type], effet = op.statut === "annulee" ? "–" : sommeMv(op) ? eur(sommeMv(op)) : "aucun", resume = op.resume.filter(function (z) { return ["Compte débité", "Compte crédité", "Compte concerné", "Compte", "Compte clôturé", "Client", "Identité du client"].indexOf(z[0]) < 0; }).slice(0, 3).map(function (z) { return z[0] + " : " + z[1]; }).join(" – ");
        if (op.type === "cloture_compte") resume = op.resume.filter(function (z) { return ["Épargnes clôturées", "Total versé au client", "Versement"].indexOf(z[0]) >= 0; }).map(function (z) { return z[0] + " : " + z[1]; }).join(" – ");
        if (op.type === "desolidarisation_compte") resume = op.resume.filter(function (z) { return ["Titulaire qui garde le compte", "Titulaire qui quitte le compte"].indexOf(z[0]) >= 0; }).map(function (z) { return z[0] + " : " + z[1]; }).join(" – ");
        var act = '<button type="button" class="btn btn-secondaire btn-petit" data-op="voir" data-id="' + op.id + '">Voir</button>';
        if (op.statut === "asigner") act += ' <button type="button" class="btn btn-principal btn-petit" data-op="executer" data-id="' + op.id + '">Exécuter</button>';
        if (op.statut === "executee" && op.confirmation === "attendue") act += ' <button type="button" class="btn btn-principal btn-petit" data-op="confirmer" data-id="' + op.id + '">Confirmation reçue</button>';
        if (op.type === "opposition_carte" && op.statut === "executee" && op.v.motif !== "abusive") act += ' <button type="button" class="btn btn-secondaire btn-petit" data-op="contester" data-id="' + op.id + '">Contester des opérations</button>';
        if (aOpposer(op)) act += ' <button type="button" class="btn btn-principal btn-petit" data-op="opposer" data-id="' + op.id + '">Faire opposition</button>';
        if (OS.revocable(op)) act += ' <button type="button" class="btn btn-secondaire btn-petit" data-op="revoquer" data-id="' + op.id + '">Révoquer</button>';
        if (op.type === "opposition_cheque" && op.v.portee === "cheque" && op.statut !== "annulee") act += ' <a class="btn btn-secondaire btn-petit" href="courriers.html?client=' + c.id + '&amp;doc=desistement&amp;cheque=' + encodeURIComponent(op.id) + '">Lettre de désistement<span class="sr"> (dans Courriers et documents)</span></a>';
        return '<tr><th scope="row" class="gauche"><span class="op-ref">' + esc(op.ref) + '</span><br><span class="mention">' + esc(B.fmtDate(B.lireYmd(op.date))) + " à " + esc(op.heure) + '</span></th><td class="gauche">' + esc(t.lib) + '</td><td class="gauche op-detail">' + esc(resume) + "</td><td>" + esc(effet) + '</td><td class="gauche">' + puceStatut(op) + '</td><td class="gauche op-actions">' + act + "</td></tr>";
      }).join("") + "</tbody></table></div></section>";
  }
  function messageHtml() {
    if (!etat.msg) return '<div id="op-msg" class="op-msg" role="status" tabindex="-1"></div>';
    return '<div id="op-msg" class="op-msg ' + (etat.msg.ok ? "op-msg-ok" : "op-msg-ko") + '" role="status" tabindex="-1">' + esc(etat.msg.texte) + "</div>";
  }
  function corps(c) {
    return messageHtml() + kpis(c) + cartesBloc(c) + (etat.vue ? vueBloc(c) : etat.type ? formBloc(c) : "") + choixBloc() + journalBloc(c);
  }
  /* Saisie administrative à tiers détenteur en cours : les comptes sont bloqués, les opérations sont contrôlées sur le disponible restant. */
  function noteSatd(c) {
    var k = OS.compte(c, B.store.charger()), sd = k.satd;
    if (!sd || !sd.avis.length) return "";
    return '<p class="op-info op-satd" role="status"><strong>Saisie administrative à tiers détenteur en cours</strong> (avis ' + esc(sd.avis.join(", ")) + ") : " + (sd.tous ? "tous les comptes sont bloqués" : "une partie du compte courant est bloquée") + " jusqu'au " + esc(B.fmtDate(B.lireYmd(sd.jusqu))) +
      ". Somme indisponible sur le compte courant : " + esc(eur(sd.montant)) + " ; disponible pour les opérations : " + esc(eur(k.dispo)) + ". <a href=\"satd.html\">Saisies administratives</a></p>";
  }
  function html(c) {
    if (etat.cid !== c.id) { etat = { cid: c.id, type: null, v: {}, err: null, apercu: null, vue: null, msg: null, annuler: null }; }
    return '<div id="op-zone" class="op-zone"><p class="intro op-intro">Opérations que le conseiller réalise à l\'accueil pour ce client. Chaque opération commence par la vérification d\'identité du client, est contrôlée, donne un document à faire signer au client, puis s\'exécute. Seule exception : un client qui appelle pour faire opposition à sa carte peut être identifié par téléphone (questions de sécurité) ; la carte est alors bloquée tout de suite et le client confirme ensuite par écrit à l\'agence.</p>' + noteSatd(c) + corps(c) + "</div>";
  }
  function rafraichir(focus) {
    var z = zone(), c = clientCourant();
    if (!z || !c) return;
    z.innerHTML = '<p class="intro op-intro">Opérations que le conseiller réalise à l\'accueil pour ce client. Chaque opération commence par la vérification d\'identité du client, est contrôlée, donne un document à faire signer au client, puis s\'exécute. Seule exception : un client qui appelle pour faire opposition à sa carte peut être identifié par téléphone (questions de sécurité) ; la carte est alors bloquée tout de suite et le client confirme ensuite par écrit à l\'agence.</p>' + noteSatd(c) + corps(c);
    var f = focus && document.getElementById(focus); if (f) f.focus();
  }

  /* ---------- saisie ---------- */
  function lire() {
    var f = document.getElementById("op-form"); if (!f) return;
    var v = {}, multi = {};
    Array.prototype.forEach.call(f.elements, function (el) {
      if (!el.name) return;
      if (el.type === "checkbox") {
        if (el.getAttribute("data-multi")) { multi[el.name] = multi[el.name] || []; if (el.checked) multi[el.name].push(el.value); } else v[el.name] = el.checked;
      } else v[el.name] = el.value;
    });
    Object.keys(multi).forEach(function (k) { v[k] = multi[k]; });
    etat.v = v;
  }
  /* Ne garde que les champs affichés (un choix qui change fait disparaître des champs : leurs anciennes valeurs ne servent plus). */
  function elaguer(c) {
    var ids = {}; OS.formulaire(etat.type, c, store(), etat.v).champs.forEach(function (x) { ids[x.id] = true; });
    Object.keys(etat.v).forEach(function (k) { if (!ids[k]) delete etat.v[k]; });
  }
  function ouvrir(type, pre) {
    var c = clientCourant();
    etat.type = type; etat.v = {}; etat.err = null; etat.apercu = null; etat.vue = null; etat.msg = null; etat.annuler = null;
    /* Opposition de carte pendant un appel : le client déjà identifié par les questions de sécurité de l'appel n'a pas à l'être une seconde fois. */
    var al = SG.alertes && SG.alertes.etat ? SG.alertes.etat() : null, ap = al && al.courant;
    if (type === "opposition_carte" && ap && ap.etat === "en_cours" && c && ap.c === c.id && Array.isArray(ap.secu) && ap.secu.length >= OS.QUESTIONS_MIN) etat.v = { idverif: "tel", idtel: ap.secu.slice() };
    if (pre) Object.keys(pre).forEach(function (k) { etat.v[k] = pre[k]; });
    rafraichir("op-t-form");
    var h = document.getElementById("op-t-form"); if (h) h.scrollIntoView({ block: "start" });
  }
  function controlerSeulement() {
    var c = clientCourant(); lire(); elaguer(c);
    var r = OS.controler(etat.type, c, store(), etat.v);
    etat.err = r.ok ? null : r.erreurs; etat.apercu = r; etat.msg = null;
    rafraichir(r.ok ? null : "op-err");
    if (r.ok) { var a = document.querySelector(".op-apercu"); if (a) a.scrollIntoView({ block: "nearest" }); }
  }
  function preparer() {
    var c = clientCourant(); lire(); elaguer(c);
    var r = OS.creer(store(), c, etat.type, etat.v);
    if (!r.ok) { etat.err = r.erreurs; etat.apercu = null; rafraichir("op-err"); return; }
    B.store.sauver();
    etat.err = null; etat.apercu = null; etat.type = null; etat.vue = r.operation.id; etat.annuler = null;
    etat.msg = r.immediate ? { ok: true, texte: "Opposition enregistrée (" + r.operation.ref + ") : la carte est bloquée. Le client doit la confirmer par écrit : imprimez le document, il le signera à l'agence." }
      : { ok: true, texte: "Document prêt : " + OS.PAR_ID[r.operation.type].doc + " (" + r.operation.ref + "). Faites-le relire et signer par le client, puis exécutez l'opération." };
    document.dispatchEvent(new CustomEvent("sgbf:operation", { detail: { cid: c.id } }));
    rafraichir("op-t-vue");
  }
  function executer(id) {
    var c = clientCourant(), r = OS.executer(store(), c, id);
    if (!r.ok) { etat.msg = { ok: false, texte: "L'opération ne peut pas être exécutée : " + r.erreur }; rafraichir("op-msg"); return; }
    B.store.sauver();
    etat.vue = id; etat.annuler = null;
    etat.msg = { ok: true, texte: r.operation.type === "desolidarisation_compte" ? "Compte désolidarisé (" + r.operation.ref + ") : c'est désormais le compte individuel de " + r.operation.desol.conserveNom + ". Imprimez l'attestation de désolidarisation et remettez-la aux deux titulaires."
      : r.operation.type === "cloture_compte" ? "Compte clôturé (" + r.operation.ref + ") : cartes résiliées, livrets soldés, solde versé au client. Imprimez l'attestation de clôture et remettez-la au client."
      : "Opération " + r.operation.ref + " exécutée : le relevé du compte et l'état des cartes sont à jour." };
    document.dispatchEvent(new CustomEvent("sgbf:operation", { detail: { cid: c.id } }));
    rafraichir("op-msg");
  }
  function annuler(id) {
    if (OS.annuler(store(), id)) { B.store.sauver(); etat.msg = { ok: true, texte: "Opération annulée : rien n'a été exécuté." }; etat.vue = null; etat.annuler = null; document.dispatchEvent(new CustomEvent("sgbf:operation", { detail: { cid: etat.cid } })); }
    rafraichir("op-msg");
  }
  function imprimer(op, c, attestation) {
    var d = attestation ? DS.attestation(op, c, { st: store() }) : DS.document(op, c, { st: store() });
    IMP.imprimer(IMP.document({ titre: d.titre, sous: d.sous, corps: d.corps, courrier: false }), d.fichier);
  }
  /* ---------- événements (une seule fois, sur le document) ---------- */
  document.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-op]") : null;
    if (!b || !zone() || !zone().contains(b)) return;
    var a = b.getAttribute("data-op"), id = b.getAttribute("data-id"), c = clientCourant(), op = id ? OS.trouver(store(), id) : null;
    if (a === "aller") { e.preventDefault(); var f = document.getElementById("op-f-" + b.getAttribute("data-champ")) || document.getElementById("op-f-" + b.getAttribute("data-champ") + "-0"); if (f) f.focus(); return; }
    if (a === "nouveau") ouvrir(b.getAttribute("data-type"));
    else if (a === "fermer") { etat.type = null; etat.err = null; etat.apercu = null; rafraichir("op-t-choix"); }
    else if (a === "fermer-vue") { etat.vue = null; etat.msg = null; etat.annuler = null; rafraichir("op-t-j"); }
    else if (a === "controler") controlerSeulement();
    else if (a === "voir" && op) { etat.vue = op.id; etat.type = null; etat.msg = null; etat.annuler = null; rafraichir("op-t-vue"); var h = document.getElementById("op-t-vue"); if (h) h.scrollIntoView({ block: "start" }); }
    else if (a === "contester" && op) ouvrir("contestation_carte", { carte: op.v.carte, situation: situationApres(op) });
    else if (a === "opposer" && op) ouvrir("opposition_carte", { carte: op.v.carte, motif: "fraude" });
    else if (a === "executer") executer(id);
    else if (a === "demander-annuler") { etat.annuler = id; rafraichir(); var n = zone().querySelector('[data-op="annuler"]'); if (n) n.focus(); }
    else if (a === "garder") { etat.annuler = null; rafraichir(); }
    else if (a === "annuler") annuler(id);
    else if (a === "confirmer") { if (OS.confirmerEcrit(store(), id)) { B.store.sauver(); etat.msg = { ok: true, texte: "Confirmation écrite du client enregistrée." }; } rafraichir("op-msg"); }
    else if (a === "revoquer") { if (OS.revoquer(store(), id)) { B.store.sauver(); etat.msg = { ok: true, texte: "Virement révoqué : il ne sera pas exécuté à la date prévue." }; document.dispatchEvent(new CustomEvent("sgbf:operation", { detail: { cid: etat.cid } })); } rafraichir("op-msg"); }
    else if (a === "imprimer" && op) imprimer(op, c);
    else if (a === "attestation" && op) imprimer(op, c, true);
    else if (a === "releve") { var t = document.getElementById("tab-compte"); if (t) t.click(); }
  });
  /* Le résumé des contrôles réussis devient faux dès qu'on modifie une valeur : il disparaît tout de suite. */
  function effacerApercu() { if (etat.apercu) { etat.apercu = null; var a = document.querySelector(".op-apercu"); if (a && a.parentNode) a.parentNode.removeChild(a); } }
  document.addEventListener("input", function (e) { if (e.target.closest && e.target.closest("#op-form")) effacerApercu(); });
  /* Un champ qui commande la suite du formulaire (compte à créditer, portée de l'opposition, montant, carte…) : si les champs affichés changent, ils sont redessinés
     après le changement de focus, et le focus revient sur le champ où se trouve l'élève. Seuls les champs sont redessinés (jamais les boutons : un clic en cours ne se perd pas),
     et rien n'est redessiné si les champs sont les mêmes (la saisie en cours n'est jamais interrompue). */
  document.addEventListener("change", function (e) {
    var t = e.target;
    if (!t.closest || !t.closest("#op-form")) return;
    effacerApercu();
    if (!t.getAttribute("data-recalc")) return;
    setTimeout(function () {
      var c = clientCourant(), form = document.getElementById("op-form"), zc = form && form.querySelector(".op-champs");
      if (!c || !zc) return;
      var act = document.activeElement, fid = act && act.id && form.contains(act) && zc.contains(act) ? act.id : null, pos = act && fid && act.type === "text" ? [act.selectionStart, act.selectionEnd] : null;
      lire(); elaguer(c);
      var f = appliquerDefauts(etat.type, c), sig = JSON.stringify(f.champs);
      if (sig === etat.sig) return;
      etat.sig = sig; etat.err = null;
      zc.innerHTML = champsHtml(f.champs);
      var ze = document.getElementById("op-err"); if (ze) ze.outerHTML = resumeErreurs();
      var n = fid && document.getElementById(fid);
      if (n) { n.focus(); if (pos) { try { n.setSelectionRange(pos[0], pos[1]); } catch (x) { /* champ sans sélection */ } } }
    }, 0);
  });
  document.addEventListener("submit", function (e) {
    if (e.target.id !== "op-form") return;
    e.preventDefault(); preparer();
  });

  SG.operationsUI = { html: html, etat: function () { return etat; } };
})();
