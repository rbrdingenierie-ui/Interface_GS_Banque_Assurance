/* GS Banque & Assurance – ouverture de compte pour un prospect ou pour un client : liste des dossiers, saisie du dossier d'entrée en relation, recommandation et parrainage, équipement du compte,
   transmission à la directrice d'agence, compléments, ouverture du compte et équipement dans le catalogue. Les règles sont dans prospects.js ; cette page ne fait que saisir et présenter. */
(function () {
  "use strict";

  var B = window.SGBF.banque, P = window.SGBF.prospects, K = window.SGBF.catalogue, PR = window.SGBF.produits, CT = window.SGBF.contrats, UC = window.SGBF.uiContrats, IMP = window.SGBF.impression,
    ICO = window.SGBF.icones, RECH = window.SGBF.recherche, RIB = window.SGBF.rib, CL = window.SGBF.clients, PUI = window.SGBF.panierUI, NUM = window.SGBF.numerisation, DC = window.SGBF.droitCompte, X = window.SGBF.bdf, ID = window.SGBF.identite;
  var app = document.getElementById("app"), esc = B.esc;
  function store() { return B.store.charger(); }
  function fmt(ymd) { return B.fmtDate(B.lireYmd(ymd)); }
  function nomP(f) { return f.civ + " " + f.prenom + " " + f.nom.toUpperCase(); }
  function estClient(f) { return f && f.titulaire === "client"; }
  /* Rang d'un titulaire d'après le préfixe de ses champs : « s_ » → second titulaire, « u3_ » → troisième… ; libellé « le second titulaire ». */
  function rangDe(w) { return w ? PREFIXES.indexOf(w) + 1 : 0; }
  function libRang(w) { var r = P.RANGS[rangDe(w)] || "Titulaire"; return r.charAt(0).toLowerCase() + r.slice(1); }
  function clientCo(w) { var r = String(etat.f[w + "client"] || "").trim(); return r ? P.trouverParrain(r, CL) || null : null; }
  function clientDuForm() { return etat.f.titulaire === "client" ? CL.filter(function (c) { return c.id === Number(etat.f.client); })[0] || null : null; }
  var S = window.SGBF.synthese;
  var CHIP = { ok: "chip-ok", warn: "chip-warn", bad: "chip-bad", info: "chip-ctrl" };

  var params = new URLSearchParams(location.search);
  var VIDE = { convention: "", civ: "", nom: "", prenom: "", naissance: "", lieuNaissance: "", nationalite: "Française", rue: "", cp: "", ville: "", mob: "", mail: "", situation: "", enfants: "0", logement: "", statut: "", profession: "", revenus: "",
    residence: "france", autocertification: false, ppe: "", origine: "", origineJustifiee: false, nomNaissance: "", bdf: null, objet: "", identite: "", pieceIdentite: false, pieceDomicile: false, pieceRevenus: false, compte: "", dac: "", dacDate: "", dacDeclaration: false, canal: "", note: "", remise: "", remiseCheque: "",
    titulaire: "prospect", client: "", reco: "non", parrainRef: "", carte: "", debit: "immediat", cheque: false, distance: false, sms: false, services: [],
    /* compte joint ou indivis : forme, indivision ; les titulaires autres que le premier portent un préfixe (« s_ », « u3_ »… : voir CHAMPS_CO) */
    forme: "individuel", decision: "", decisionMotif: "", nbCo: 1, indType: "", defCiv: "", defNom: "", defPrenom: "", dateDeces: "", pieceIndivision: false };
  /* Champs d'un titulaire autre que le premier, avec leur valeur initiale : dans le formulaire « s_nom », « u3_nom »…, dans la fiche second.nom, autres[0].nom… */
  var CHAMPS_CO = { client: "", civ: "", nom: "", prenom: "", nomNaissance: "", naissance: "", lieuNaissance: "", nationalite: "Française", lien: "", meme: true, rue: "", cp: "", ville: "", mob: "", mail: "", statut: "", profession: "", revenus: "",
    residence: "france", autocertification: false, ppe: "", origineJustifiee: false, identite: "", pieceIdentite: false, pieceDomicile: false, bdf: null, decision: "", decisionMotif: "" };
  var PREFIXES = P.PREFIXES_CO;
  PREFIXES.forEach(function (w) { Object.keys(CHAMPS_CO).forEach(function (k) { VIDE[w + k] = CHAMPS_CO[k]; }); });
  var etat = { vue: "liste", dossier: null, f: Object.assign({}, VIDE), err: null, edition: null, msg: null, apercu: false, commentaire: "", bdfErr: "", bdfConsult: null, bdfErrCo: {}, bdfConsultCo: {}, famille: null };
  /* Champs d'un titulaire autre que le premier tels qu'ils sont dans la fiche (le formulaire les préfixe : « s_nom »). */
  var CHAMPS_FICHE_CO = ["client", "civ", "nom", "prenom", "nomNaissance", "naissance", "lieuNaissance", "nationalite", "lien", "rue", "cp", "ville", "mob", "mail", "statut", "profession", "revenus", "residence", "autocertification", "ppe", "origineJustifiee", "identite", "pieceIdentite", "pieceDomicile", "bdf"];
  var PIECES_CO = ["identite", "domicile"];
  /* Nombre de titulaires autres que le premier : un pour un compte joint, un à quatre pour un compte indivis. */
  function nbCo(f) { return f.forme === "indivis" ? Math.max(1, Math.min(P.CO_MAX, Number(f.nbCo) || 1)) : f.forme === "joint" ? 1 : 0; }
  function titulaireDuFormulaire(f, w) {
    var q = { memeAdresse: !!f[w + "meme"], decision: { choix: f[w + "decision"], motif: f[w + "decisionMotif"] }, scans: {} };
    CHAMPS_FICHE_CO.forEach(function (k) { q[k] = f[w + k]; });
    PIECES_CO.forEach(function (k) { var d = (f.scans || {})[w + k]; if (d) q.scans[k] = d; });
    return q;
  }
  function ficheDuFormulaire(f, edit) {
    var o = Object.assign({}, f, { dossier: edit, second: undefined, autres: undefined, indivision: undefined, decision: { choix: f.decision, motif: f.decisionMotif } });
    var n = nbCo(f);
    if (n > 0) {
      o.second = titulaireDuFormulaire(f, PREFIXES[0]); o.autres = [];
      for (var i = 1; i < n; i++) o.autres.push(titulaireDuFormulaire(f, PREFIXES[i]));
      if (f.forme === "indivis") o.indivision = { type: f.indType, defunt: { civ: f.defCiv, nom: f.defNom, prenom: f.defPrenom }, dateDeces: f.dateDeces, piece: !!f.pieceIndivision };
    } else o.forme = "individuel";
    return o;
  }
  function formulaireDeLaFiche(fiche) {
    var o = { forme: fiche.forme || "individuel", decision: fiche.decision ? fiche.decision.choix : "", decisionMotif: fiche.decision ? fiche.decision.motif : "", scans: Object.assign({}, fiche.scans), nbCo: 1 };
    var co = [fiche.second].concat(fiche.autres || []).filter(Boolean);
    co.forEach(function (q, i) {
      var w = PREFIXES[i];
      o[w + "decision"] = q.decision ? q.decision.choix : ""; o[w + "decisionMotif"] = q.decision ? q.decision.motif : "";
      CHAMPS_FICHE_CO.forEach(function (k) { if (q[k] !== undefined) o[w + k] = q[k]; });
      var cc = q.client ? CL.filter(function (c) { return c.id === q.client; })[0] : null;
      o[w + "client"] = cc ? cc.num : "";
      o[w + "revenus"] = q.client ? "" : String(q.revenus == null ? "" : q.revenus).replace(".", ",");
      o[w + "meme"] = q.memeAdresse !== false;
      PIECES_CO.forEach(function (k) { var d = q.scans && q.scans[k]; if (d) o.scans[w + k] = d; });
    });
    o.nbCo = Math.max(1, co.length);
    if (fiche.indivision) { var i = fiche.indivision; o.indType = i.type; o.pieceIndivision = !!i.piece; o.dateDeces = i.dateDeces || ""; if (i.defunt) { o.defCiv = i.defunt.civ; o.defNom = i.defunt.nom; o.defPrenom = i.defunt.prenom; } }
    return o;
  }

  function dossierCourant() { return etat.dossier ? P.dossier(store(), etat.dossier) : null; }

  function PRO_NUM(d) { return d.ouvert ? d.ouvert.num : (CL.filter(function (c) { return c.id === d.fiche.client; })[0] || {}).num || ""; }
  /* ---------- liste des dossiers ---------- */
  function listeHtml() {
    var st = store(), l = P.dossiers(st).slice().reverse();
    var h = '<section class="bloc" aria-labelledby="t-liste"><div class="bloc-tete"><h2 id="t-liste" tabindex="-1">Dossiers d\'ouverture de compte</h2><span class="sous">' + (l.length ? l.length + (l.length > 1 ? " dossiers" : " dossier") : "") + "</span></div>";
    h += '<div class="pf-btns"><button type="button" class="btn btn-principal" data-act="nouveau">Ouvrir un compte pour un prospect</button><button type="button" class="btn btn-secondaire" data-act="nouveau-client">Ouvrir un compte pour un client</button></div>';
    h += '<ol class="op-deroule" aria-label="Déroulé d\'une ouverture de compte">' + [["Constituer et valider le dossier", "Identité, situation et équipement demandé, puis « Validation du conseiller »."], ["Soumettre à validation", "Le dossier et la convention de compte demandée partent ensemble : la directrice valide, demande un complément ou refuse."], ["Ouvrir le compte", "Numéro de client, compte et contrat de la convention de compte."], ["Équiper le client", "Suite dans le catalogue : carte, assurances, épargne."]].map(function (e, i) { return '<li><span class="op-deroule-num" aria-hidden="true">' + (i + 1) + '</span><span class="op-deroule-txt"><strong>' + e[0] + "</strong><span>" + e[1] + "</span></span></li>"; }).join("") + "</ol>";
    if (!l.length) return h + '<p class="vide-bloc">Aucun dossier pour le moment. Un prospect est une personne qui n\'est pas encore cliente : vous constituez son dossier d\'entrée en relation, vous le validez puis le soumettez à la directrice, et après sa validation vous ouvrez le compte et vous l\'équipez. Pour un client de l\'agence, le dossier reprend son identité et ouvre un compte supplémentaire.</p></section>';
    h += '<div class="tab-wrap"><table class="tab-ventes op-liste"><caption class="sr">Dossiers d\'ouverture de compte</caption><thead><tr><th scope="col">Dossier</th><th scope="col">Titulaire</th><th scope="col">Compte</th><th scope="col">Situation</th><th scope="col"><span class="sr">Action</span></th></tr></thead><tbody>' + l.map(function (d) {
      var e = P.etat(d);
      return '<tr><th scope="row">' + esc(d.ref) + '<span class="pf-sous">' + esc(fmt(P.dateCreation(d))) + '</span></th><td data-label="Titulaire">' + esc(nomP(d.fiche)) + '<span class="pf-sous">' + (estClient(d.fiche) ? "Client " + esc(PRO_NUM(d)) : "Prospect") + (d.fiche.reco === "oui" ? " – recommandé" : "") + (d.fiche.second ? " – compte " + (d.fiche.forme === "indivis" ? "indivis" : "joint") + " avec " + esc(P.coTitulaires(d.fiche).map(nomP).join(", ")) : "") + '</span></td><td data-label="Compte">' + esc(PR.parId[d.fiche.compte].nom) + '</td><td data-label="Situation"><span class="chip ' + CHIP[e.ton] + '">' + esc(e.libelle) + '</span></td>' +
        '<td class="cp-act"><button type="button" class="btn-texte" data-act="ouvrir-dossier" data-id="' + d.id + '" aria-label="Ouvrir le dossier ' + esc(d.ref) + " : " + esc(nomP(d.fiche)) + '">Ouvrir le dossier</button></td></tr>';
    }).join("") + "</tbody></table></div></section>";
    return h;
  }

  /* ---------- formulaire ---------- */
  function err(champ) { return etat.err && etat.err.champ === champ; }
  function champTexte(id, lib, o) {
    o = o || {};
    var e = err(id), v = etat.f[id];
    return '<div class="champ' + (o.large ? " op-large" : "") + '"><label for="op-' + id + '">' + esc(lib) + (o.fac ? ' <span class="aide-champ">(facultatif)</span>' : " *") + '</label><input id="op-' + id + '" type="' + (o.type || "text") + '"' + (o.mode ? ' inputmode="' + o.mode + '"' : "") + (o.list ? ' list="' + o.list + '"' : "") + ' autocomplete="off" maxlength="' + (o.max || 60) + '" value="' + esc(v) + '"' +
      (o.type === "date" ? ' min="1900-01-01" max="' + B.ymd(B.aujourdhui()) + '"' : "") + (o.aide ? ' aria-describedby="op-aide-' + id + '"' : "") + (e ? ' aria-invalid="true" aria-describedby="op-err' + (o.aide ? " op-aide-" + id : "") + '"' : "") + ">" + (o.aide ? '<span class="aide-champ" id="op-aide-' + id + '">' + esc(o.aide) + "</span>" : "") + "</div>";
  }
  function champChoix(id, lib, liste, o) {
    o = o || {}; var e = err(id), v = etat.f[id];
    return '<div class="champ' + (o.large ? " op-large" : "") + '"><label for="op-' + id + '">' + esc(lib) + ' *</label><select id="op-' + id + '"' + (e ? ' aria-invalid="true" aria-describedby="op-err"' : "") + '><option value="">Choisir…</option>' + liste.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (v === x[0] ? " selected" : "") + ">" + esc(x[1]) + "</option>"; }).join("") + "</select></div>";
  }
  function champRadio(id, lib, liste) {
    var e = err(id), v = etat.f[id];
    return '<fieldset class="op-radio"' + (e ? ' aria-invalid="true"' : "") + "><legend>" + esc(lib) + ' *</legend><div class="op-opts">' + liste.map(function (x, i) {
      return '<label class="op-opt"><input type="radio" name="op-' + id + '" value="' + esc(x[0]) + '"' + (v === x[0] ? " checked" : "") + (e && i === 0 ? ' aria-describedby="op-err"' : "") + "><span>" + esc(x[1]) + "</span></label>";
    }).join("") + "</div></fieldset>";
  }
  function champCase(id, lib) {
    var e = err(id);
    return '<label class="op-case"><input type="checkbox" id="op-' + id + '"' + (etat.f[id] ? " checked" : "") + (e ? ' aria-invalid="true" aria-describedby="op-err"' : "") + "><span>" + esc(lib) + "</span></label>";
  }
  /* Pièces qui se numérisent : [nom de la pièce, ce que « à jour » veut dire, case cochée automatiquement]. Chaque titulaire a les siennes : « identite » pour le premier, « s_identite » pour le second, « u3_identite »… */
  var PIECES_SCAN = { identite: ["Pièce d'identité", "en cours de validité", "pieceIdentite"], domicile: ["Justificatif de domicile", "de moins de 3 mois", "pieceDomicile"], revenus: ["Justificatif de revenus", "le plus récent", "pieceRevenus"] };
  /* Une clé de pièce (« u3_domicile ») : préfixe du titulaire et nom de la pièce. */
  function cleScan(k) { var m = /^((?:s|u\d)_)?(\w+)$/.exec(k); return { w: m && m[1] ? m[1] : "", piece: m ? m[2] : k }; }
  function zoneScan(k) { var c = cleScan(k); return NUM && PIECES_SCAN[c.piece] ? NUM.bouton(k, PIECES_SCAN[c.piece][0] + (c.w ? " (" + libRang(c.w) + ")" : ""), (etat.f.scans || {})[k]) : ""; }
  function numeriser(b) {
    var k = b.getAttribute("data-id"), c = cleScan(k), def = PIECES_SCAN[c.piece]; if (!NUM || !def) return;
    lire(); if (!etat.f.scans) etat.f.scans = {};
    NUM.ouvrir({
      piece: def[0] + (c.w ? " (" + libRang(c.w) + ")" : ""), precision: def[1], doc: etat.f.scans[k] || null, ouvreur: b, focusId: "num-" + k,
      apres: function (doc) { etat.f.scans[k] = doc; etat.f[c.w + def[2]] = true; refaireForm("num-" + k); },
      retirer: function () { delete etat.f.scans[k]; refaireForm("num-" + k); }
    });
  }
  function refaireForm(idFocus) {
    var f = document.getElementById("op-form"); if (!f) return;
    etat.err = null; f.innerHTML = formHtml();   /* l'état a été lu à l'ouverture de la fenêtre (modale : rien ne change entre-temps) */
    var el = document.getElementById(idFocus); if (el) el.focus();
  }
  /* Aide sous le choix du compte : dépend de l'âge du titulaire et du moyen choisi. Mise à jour sur place (sans refaire le formulaire, pour ne pas déplacer le focus). */
  function aideCompte() {
    var f = etat.f, cl = clientDuForm(), age = cl ? cl.age : P.ageAu(f.naissance, B.aujourdhui()), qui = cl ? "Le client" : "Le prospect";
    return (age >= 18 && age <= 25 ? qui + " a " + age + " ans : le Compte Jeune (18-25 ans) est possible." : age > 25 ? qui + " a " + age + " ans : le Compte Jeune est réservé aux 18-25 ans, proposez le compte courant Équilibre." : "Le Compte Jeune est réservé aux 18-25 ans.") + " " +
      (f.canal ? "Convention de compte : " + (CT.aDistance(f.canal) ? "envoyée au " + (cl ? "client" : "prospect") + " pour signature électronique." : "imprimée et signée par le " + (cl ? "client" : "prospect") + " devant vous.") : "");
  }
  function aideCompteDac() {
    var f = etat.f;
    return "Compte droit au compte (DAC)." + (f.canal ? " Convention de compte : " + (CT.aDistance(f.canal) ? "envoyée au prospect pour signature électronique." : "imprimée et signée par le prospect devant vous.") : "");
  }
  /* Compte DAC : l'équipement n'est pas au choix, les services bancaires de base sont gratuits. */
  function sectionDac() {
    var D = window.SGBF.droitCompte, liste = D ? D.SERVICES_DE_BASE : [];
    return '<fieldset class="op-section"><legend>Équipement du compte droit au compte</legend><p class="op-aide">Le compte porte la mention DAC. Il comprend les services bancaires de base, gratuits (article D312-5-1 du Code monétaire et financier). Aucune convention ni aucun autre service n\'est ajouté à l\'ouverture : le prospect pourra en demander plus tard, aux tarifs de l\'agence.</p>' +
      '<ul class="op-liste-dac">' + liste.map(function (x) { return "<li>" + esc(x.replace(/ ?;$/, "").replace(/\.$/, "")) + "</li>"; }).join("") + "</ul>" +
      '<p class="op-aide">Pas de chéquier ni de découvert autorisé. La carte est commandée : le prospect la retire à l\'agence.</p></fieldset>';
  }
  var CONDITIONS_PARRAINAGE = function () {
    var g = P.PARRAINAGE;
    return "Offre de parrainage : " + g.primeParrain + " € pour le parrain et " + g.primeFilleul + " € pour le filleul, versés " + g.delaiMois + " mois après l'ouverture du compte si le filleul a souscrit une carte bancaire de paiement. Conditions : le parrain est client depuis au moins " + Math.round(g.ancienneteJours / 30) +
      " mois, il n'habite pas à la même adresse que le filleul et il n'a pas plus de " + g.plafond + " filleuls sur 12 mois. La recommandation est enregistrée dans tous les cas ; l'offre est examinée à la transmission du dossier.";
  };
  function listeParrains(id) { return '<datalist id="' + (id || "op-parrains") + '">' + CL.map(function (c) { return '<option value="' + esc(c.num + " – " + c.nom.toUpperCase() + " " + c.prenom) + '"></option>'; }).join("") + "</datalist>"; }
  function sectionReco() {
    var e = err("parrainRef");
    return '<fieldset class="op-section"><legend>Recommandation</legend>' + champRadio("reco", "Le prospect a-t-il été recommandé par un client de l'agence ?", [["non", "Non"], ["oui", "Oui, par un client"]]) +
      (etat.f.reco === "oui" ? '<div class="champ op-large"><label for="op-parrainRef">Client qui recommande *</label><input id="op-parrainRef" type="text" list="op-parrains" autocomplete="off" maxlength="80" value="' + esc(etat.f.parrainRef) + '" aria-describedby="op-aide-parrainRef' + (e ? " op-err" : "") + '"' + (e ? ' aria-invalid="true"' : "") + ">" +
        '<span class="aide-champ" id="op-aide-parrainRef">Numéro de client (GS-41…) ou nom et prénom : commencez à écrire pour choisir dans la liste.</span></div>' + listeParrains() : "") +
      '<p class="op-aide">' + esc(CONDITIONS_PARRAINAGE()) + "</p></fieldset>";
  }
  function libCarte(id) {
    var p = PR.parId[id], t = p.tarifs.filter(function (x) { return /^Cotisation/.test(x.lib); })[0];
    return p.nom + (t ? " (" + t.val + " par an)" : "");
  }
  function sectionEquipement() {
    var f = etat.f, cl = clientDuForm(), carte = f.carte;
    /* Offre groupée (convention GS Avenir, Horizon ou Sérénité) selon l'âge et le compte demandé : elle inclut une carte, qui est alors délivrée avec elle. */
    var age = cl ? cl.age : P.ageAu(f.naissance, B.aujourdhui()), convs = isNaN(age) ? [] : P.conventionsProposees(f.compte, age);
    if (f.convention && convs.indexOf(f.convention) < 0) f.convention = "";
    var conv = f.convention, convCarte = conv ? (cl ? K.carteLivree(store(), cl, conv) : PR.parId[conv].convention.carte) : null, carteAff = conv ? convCarte : carte;
    var h = '<fieldset class="op-section"><legend>Équipement du compte (banque au quotidien)</legend><p class="op-aide">Équipez le compte dès l\'ouverture : la carte fait l\'objet d\'un contrat distinct, les services sont repris dans la convention d\'ouverture de compte. D\'autres produits (épargne, assurances…) se souscrivent ensuite dans le catalogue.</p><div class="op-grille">';
    if (convs.length) h += '<div class="champ"><label for="op-convention">Offre groupée de services (convention de compte)</label><select id="op-convention"' + (err("convention") ? ' aria-invalid="true" aria-describedby="op-err"' : "") + '><option value="">Aucune offre groupée</option>' + convs.map(function (id) { var cv = PR.parId[id].convention; return '<option value="' + id + '"' + (conv === id ? " selected" : "") + ">" + esc(PR.parId[id].nom.replace(/ – offre groupée.*$/, "") + " – " + B.eur2(cv.cotisationMois) + " par mois") + "</option>"; }).join("") + "</select></div>";
    if (!conv) h += '<div class="champ"><label for="op-carte">Carte bancaire</label><select id="op-carte"' + (err("carte") ? ' aria-invalid="true" aria-describedby="op-err"' : "") + '><option value="">Aucune carte pour le moment</option>' + P.CARTES.filter(function (id) { return id !== "VJEU" || f.compte === "JEUNE" || !f.compte; }).map(function (id) { return '<option value="' + id + '"' + (carte === id ? " selected" : "") + ">" + esc(libCarte(id)) + "</option>"; }).join("") + "</select></div>";
    if (!conv && P.CARTES_A_DEBIT.indexOf(carte) >= 0) h += '<div class="champ"><label for="op-debit">Type de débit *</label><select id="op-debit"' + (err("debit") ? ' aria-invalid="true" aria-describedby="op-err"' : "") + ">" + P.DEBITS.map(function (x) { return '<option value="' + x[0] + '"' + (f.debit === x[0] ? " selected" : "") + ">" + esc(x[1]) + "</option>"; }).join("") + "</select></div>";
    h += "</div>";
    if (carteAff) {
      var rc = K.remisesCarte(store(), carteAff, f.canal);
      if (f.remise && !rc.some(function (x) { return x.v === f.remise; })) f.remise = "";      /* le mode choisi n'est plus proposé (autre carte ou autre moyen d'ouverture) */
      h = h.replace(/<\/div>$/, "") + champChoix("remise", "Remise de la carte", rc.map(function (x) { return [x.v, x.lib]; })) + "</div>";
    }
    if (conv) h += '<p class="op-aide" id="op-aide-carte">' + esc(PR.parId[conv].accroche + " " + (convCarte ? libCarte(convCarte) + " est incluse dans la cotisation et délivrée avec la convention : on ne choisit donc pas d'autre carte." : "Le client garde sa carte actuelle, incluse dans la cotisation de la convention.") + " Le client accepte le prélèvement mensuel de la cotisation sur son compte courant.") + "</p>";
    else if (carte) h += '<p class="op-aide" id="op-aide-carte">' + esc(PR.parId[carte].caracteristiques.slice(0, 2).join(" ")) + (P.SEUILS_CARTE[carte] ? " Revenus nets d'au moins " + B.eur(P.SEUILS_CARTE[carte]) + " par mois à domicilier à GS Banque & Assurance." : "") + "</p>";
    h += champCase("cheque", "Chéquier : délivré sur demande, sauf interdiction d'émettre des chèques.");
    if (f.cheque) {
      var rq = K.remisesChequier(store(), f.canal);
      if (f.remiseCheque && !rq.some(function (x) { return x.v === f.remiseCheque; })) f.remiseCheque = "";
      h += '<div class="op-grille">' + champChoix("remiseCheque", "Remise du chéquier", rq.map(function (x) { return [x.v, x.lib]; })) + "</div>";
    }
    if (conv) {
      /* panier de services : GS Connect, GS Alertes et les autres services de la convention se choisissent ici, avec la réduction obtenue */
      var cvx = PR.parId[conv].convention;
      f.services = K.panierConvention(cvx, panierClient(), f.services, f.compte).cles;
      h += PUI.html(cvx, panierClient(), f.services, "op");
    } else {
      h += champCase("distance", "GS Connect : banque à distance, espace client en ligne et application mobile (identifiants personnels envoyés après l'ouverture). " + B.eur2(PR.gconMois) + " par mois, gratuit avec une convention de compte.") +
        champCase("sms", "GS Alertes : alertes par SMS au numéro de mobile du dossier (solde sous 100 € ou débit de 200 € et plus, réglage standard modifiable ensuite en agence). " + B.eur2(PR.galeMois) + " par mois, gratuit avec une convention de compte.");
    }
    return h + "</fieldset>";
  }
  /* Le compte que l'on ouvre détermine la tenue de compte (gratuite avec le compte Jeune) : le panier calcule la réduction avec ce compte. */
  function panierClient() { return { cpt: { p: etat.f.compte || "CPT" } }; }
  function conventionCourante() { var f = etat.f; return f.convention && PR.parId[f.convention] ? PR.parId[f.convention].convention : null; }
  function majPanier(services) { var cv = conventionCourante(); if (cv) etat.f.services = PUI.maj(cv, panierClient(), services, "op"); }
  function blocClient(c) {
    var jours = c.depuis, an = Math.floor(jours / 365);
    return '<fieldset class="op-section"><legend>Client</legend><dl class="op-fiche">' + ligne("Identité", c.civ + " " + c.prenom + " " + c.nom.toUpperCase() + ", " + c.age + " ans") + ligne("Numéro de client", c.num + " – client depuis " + (an >= 1 ? an + " an" + (an > 1 ? "s" : "") : jours + " jours")) +
      ligne("Adresse", c.adr.rue + ", " + c.adr.cp + " " + c.adr.ville) + ligne("Contact", (c.mob || "") + (c.mail ? " – " + c.mail : "")) + ligne("Activité", c.pro.prof + " – " + B.eur(c.pro.rev || 0) + " nets par mois") + ligne("Compte actuel", PR.parId[c.cpt.p].nom) + "</dl>" +
      '<p class="op-aide">L\'identité et les coordonnées sont celles de la fiche client. Le nouveau compte s\'ajoute à son compte actuel : un client qui détient déjà un compte courant Équilibre ouvre un compte secondaire.</p></fieldset>';
  }
  /* ---------- consultation de la Banque de France (FCC et FICP) ----------
     Obligatoire à chaque ouverture de compte, le jour de la validation du dossier, pour l'identité saisie (nom, nom de naissance, date de naissance). La réponse (interdiction bancaire, inscription au FICP)
     alimente le dossier ; elle est aussi notée dans le journal de l'outil « Interro BDF ». */
  /* w : "" pour le premier titulaire, « s_ », « u3_ »… pour les autres titulaires d'un compte joint ou indivis (chacun a sa consultation). Un titulaire déjà client est interrogé d'après sa fiche client. */
  function identiteBdf(w) {
    var f = etat.f, cl = w ? clientCo(w) : clientDuForm(), n = cl && S.naissance ? S.naissance(cl) : null;
    return { nom: cl ? cl.nom : f[w + "nom"], nomNaissance: f[w + "nomNaissance"], naissance: cl ? (n ? B.ymd(n) : "") : f[w + "naissance"] };
  }
  function bdfEtatHtml(w) {
    w = w || "";
    var t = etat.f[w + "bdf"], s = identiteBdf(w), auj = B.ymd(B.aujourdhui()), h = "", cl = w ? null : clientDuForm(), qui = w ? "le " + libRang(w) : cl ? "le client" : "le prospect", erreurBdf = w ? etat.bdfErrCo[w] : etat.bdfErr, consult = w ? etat.bdfConsultCo[w] : etat.bdfConsult;
    if (erreurBdf) return '<p class="op-bdf-etat op-bdf-ko" role="alert"><strong>Interrogation impossible.</strong> ' + esc(erreurBdf) + "</p>";
    if (!t || typeof t !== "object") return '<p class="op-bdf-etat op-bdf-attente" role="status">Aucune interrogation pour l\'instant : la validation du dossier n\'est possible qu\'après la consultation de la Banque de France.</p>';
    if (!X.correspond(t, s)) return '<p class="op-bdf-etat op-bdf-ko" role="status"><strong>Identité modifiée.</strong> L\'interrogation du ' + esc(fmt(t.date)) + " à " + esc(t.heure) + " (" + esc(t.nom + (t.nomNaissance ? ", né" + " " + t.nomNaissance : "")) + ") ne correspond plus à l\'identité saisie : interrogez de nouveau.</p>";
    if (t.date !== auj) return '<p class="op-bdf-etat op-bdf-ko" role="status"><strong>Interrogation périmée.</strong> Elle date du ' + esc(fmt(t.date)) + " : elle doit être faite le jour où le dossier est validé. Interrogez de nouveau.</p>";
    var fcc = t.fcc === "interdit", ficp = t.ficp === "inscrit";
    h += '<div class="op-bdf-etat op-bdf-' + (fcc || ficp ? "alerte" : "ok") + '" role="status"><p><strong>Réponse de la Banque de France du ' + esc(fmt(t.date)) + " à " + esc(t.heure) + "</strong> (clé " + esc(t.cle) + (t.cleNaissance ? " et " + esc(t.cleNaissance) : "") + ")</p><ul>" +
      '<li><span class="puce ' + (fcc ? "puce-bad" : "puce-ok") + '">' + (fcc ? "Interdit bancaire" : "Aucune inscription") + "</span> Fichier central des chèques (FCC)</li>" +
      '<li><span class="puce ' + (ficp ? "puce-warn" : "puce-ok") + '">' + (ficp ? "Inscrit" : "Aucune inscription") + "</span> Fichier des incidents de remboursement des crédits aux particuliers (FICP)</li></ul>";
    var droitCompte = !w && etat.f.dac === "oui";
    if (fcc) h += "<p>" + (droitCompte ? "Le compte est ouvert dans le cadre du droit au compte : l'interdiction bancaire ne s'oppose pas à l'ouverture." : "Interdit bancaire (FCC) : ce n'est pas un refus automatique, l'agence apprécie le risque (nature et nombre des incidents). Si le compte est ouvert, il l'est sans chéquier.") + "</p>";
    if (ficp) h += "<p>Inscrit au FICP : ce n'est pas un refus automatique, l'agence apprécie le risque. Si le compte est ouvert, il l'est sans découvert autorisé ni crédit renouvelable.</p>";
    if ((fcc || ficp) && !droitCompte) h += decisionHtml(w, qui);
    if (consult && consult.date === t.date && consult.heure.slice(0, 5) === t.heure) h += '<details class="op-bdf-ecrans"><summary>Voir les écrans de réponse</summary><div class="bdf-ecrans">' + X.ecrans(consult) + '</div><p class="bdf-simu">' + esc(X.MENTION_SIMULATION) + "</p></details>";
    return h + "</div>";
  }
  /* Décision du conseiller pour une personne inscrite au FCC ou au FICP : ouvrir (avis favorable) ou refuser, avec le motif ; la directrice prend la décision finale. */
  function decisionHtml(w, qui) {
    var f = etat.f, m = w + "decisionMotif", e = err(m);
    return '<div class="op-decision">' + champRadio(w + "decision", "Votre décision pour " + qui, [["ouvrir", "Ouvrir le compte (avis favorable : la directrice d'agence prend la décision finale)"], ["refuser", "Refuser l'ouverture (la lettre de refus est remise au demandeur)"]]) +
      '<div class="champ op-large"><label for="op-' + m + '">Motif de votre décision *</label><textarea id="op-' + m + '" maxlength="' + P.DECISION_MOTIF_MAX + '" style="min-height:64px"' + (e ? ' aria-invalid="true" aria-describedby="op-err"' : "") + ">" + esc(f[m]) + "</textarea>" +
      '<span class="aide-champ">Obligatoire, ' + P.DECISION_MOTIF_MAX + " caractères au plus. Il est transmis à la directrice, et figure sur la lettre de refus si vous refusez.</span></div></div>";
  }
  function blocBdf(cl, w) {
    w = w || "";
    var qui = w ? libRang(w) : "";
    return '<fieldset class="op-section op-bdf' + (w ? " op-second" : "") + '"><legend>' + (w ? "Consultation de la Banque de France du " + qui : "Consultation de la Banque de France") + '</legend><p class="op-aide">' + (w ? "Chaque titulaire est consulté séparément, le jour de la validation du dossier : " : "Obligatoire à chaque ouverture de compte, le jour de la validation du dossier : ") + 'fichier central des chèques (FCC) et fichier des incidents de remboursement des crédits aux particuliers (FICP).</p>' +
      '<div class="op-grille">' + champTexte(w + "nomNaissance", "Nom de naissance", { fac: true, max: 40, aide: "À renseigner s'il est différent du nom d'usage (nom de jeune fille) : il est interrogé aussi." }) + "</div>" +
      '<div class="pf-btns"><button type="button" class="btn btn-secondaire" data-act="bdf"' + (w ? ' data-w="' + w + '"' : "") + ">Interroger la Banque de France" + (w ? " (" + qui + ")" : "") + '</button></div><div id="op-' + w + 'bdf-zone">' + bdfEtatHtml(w) + "</div></fieldset>";
  }
  function majBdf(w) { w = w || ""; var z = document.getElementById("op-" + w + "bdf-zone"); if (z) z.innerHTML = bdfEtatHtml(w); }
  function interrogerBdf(w) {
    w = w || "";
    lire(); etat.err = null;
    var s = identiteBdf(w), r = X.interroger(s, null, B.maintenant(), store());
    if (!r.ok) { if (w) etat.bdfErrCo[w] = r.erreur; else etat.bdfErr = r.erreur; majBdf(w); var el = r.champ && document.getElementById("op-" + (w ? w + r.champ : (r.champ === "nom" && clientDuForm() ? "" : r.champ))); if (el) el.focus(); return; }
    var cl = w ? clientCo(w) : clientDuForm();
    X.noter(store(), r, { par: ID && ID.nomCourant ? ID.nomCourant() : "", client: cl ? cl.id : 0 }); B.store.sauver();
    if (w) { etat.bdfErrCo[w] = ""; etat.bdfConsultCo[w] = r; } else { etat.bdfErr = ""; etat.bdfConsult = r; }
    etat.f[w + "bdf"] = X.trace(r); majBdf(w);
    var z = document.getElementById("op-" + w + "bdf-zone"); if (z) { var e = z.querySelector(".op-bdf-etat"); if (e) { e.setAttribute("tabindex", "-1"); e.focus(); } }
  }
  /* ---------- compte joint ou indivis : forme du compte et second titulaire ---------- */
  function sectionForme() {
    var f = etat.f;
    return champRadio("forme", "Forme du compte", P.FORMES) +
      '<p class="op-aide">' + (f.forme === "joint" ? "Compte joint : chaque titulaire peut faire seul toutes les opérations et engage l'autre (solidarité). Le relevé et le RIB portent « M. X ou Mme Y »." :
        f.forme === "indivis" ? "Compte indivis : toutes les opérations exigent la signature de tous les titulaires (de deux à cinq). Le relevé et le RIB portent « Indivision X » ou « Succession de M. X »." :
        "Pour un compte joint ou indivis, les autres titulaires sont des personnes majeures, clientes de l'agence ou non : chacune a son propre dossier, ses pièces numérisées et sa propre consultation de la Banque de France. Le compte est alors un compte courant Équilibre.") + "</p>";
  }
  function sectionIndivision() {
    var f = etat.f, h = '<fieldset class="op-section op-indivision"><legend>Indivision</legend>' + champRadio("indType", "Nature de l'indivision", P.INDIVISIONS);
    if (f.indType === "succession") h += '<div class="op-grille">' + champRadio("defCiv", "Civilité du défunt", [["M.", "Monsieur"], ["Mme", "Madame"]]) + champTexte("defNom", "Nom du défunt", { max: 40 }) + champTexte("defPrenom", "Prénom du défunt", { max: 40 }) +
      champTexte("dateDeces", "Date du décès", { type: "date" }) + "</div>" + champCase("pieceIndivision", "Acte de décès et acte de notoriété (ou attestation du notaire) : originaux vus, copies conservées.") +
      '<p class="op-aide">Le compte est ouvert au nom du défunt (« Succession de … ») par les héritiers désignés dans l\'acte de notoriété : les titulaires sont des héritiers, de deux à cinq.</p>';
    else if (f.indType === "indivision") h += champCase("pieceIndivision", "Justificatif de l'indivision (titre de propriété détenu en indivision, acte d'acquisition en indivision, convention d'indivision…) : vu, copie conservée.") +
      '<p class="op-aide">Le compte est ouvert au nom de l\'indivision (« Indivision X ») par les indivisaires : les titulaires sont les indivisaires, de deux à cinq.</p>';
    return h + "</fieldset>";
  }
  /* Titulaire autre que le premier (préfixe w : « s_ », « u3_ »…) : identité (ou fiche client s'il est déjà client de l'agence), revenus, connaissance client, Banque de France et décision, pièces numérisées. */
  function sectionTitulaire(w) {
    var f = etat.f, R = P.RANGS[rangDe(w)], cc = clientCo(w), cl0 = clientDuForm(), meme = !!f[w + "meme"];
    var adr = cl0 ? cl0.adr.rue + ", " + cl0.adr.cp + " " + cl0.adr.ville : f.rue ? f.rue + ", " + f.cp + " " + f.ville : "adresse non encore saisie";
    var h = '<fieldset class="op-section op-second" id="op-bloc-' + w + '"><legend>' + R + " : identité et coordonnées</legend>" +
      '<div class="op-grille">' + champTexte(w + "client", "Client de l'agence", { fac: true, large: true, max: 60, list: "op-clients-co", aide: "Si cette personne est déjà cliente : numéro de client (GS-41…) ou nom et prénom, à choisir dans la liste. Ses données sont reprises de sa fiche client. Sinon, laissez le champ vide." }) + "</div>";
    if (cc) {
      h += '<dl class="op-fiche">' + ligne("Client", cc.civ + " " + cc.prenom + " " + cc.nom.toUpperCase() + ", " + cc.age + " ans – " + cc.num) + ligne("Adresse", cc.adr.rue + ", " + cc.adr.cp + " " + cc.adr.ville) +
        ligne("Contact", (cc.mob || "") + (cc.mail ? " – " + cc.mail : "")) + ligne("Activité", cc.pro.prof + " – " + B.eur(cc.pro.rev || 0) + " nets par mois") + "</dl>" +
        '<div class="op-grille">' + champChoix(w + "lien", "Lien avec le premier titulaire", P.LIENS, { large: true }) + "</div>";
    } else {
      h += '<div class="op-grille">' + champRadio(w + "civ", "Civilité", [["M.", "Monsieur"], ["Mme", "Madame"]]) + champTexte(w + "nom", "Nom de famille", { max: 40 }) + champTexte(w + "prenom", "Prénom", { max: 40 }) +
        champTexte(w + "naissance", "Date de naissance", { type: "date", aide: "Le titulaire doit être majeur." }) + champTexte(w + "lieuNaissance", "Commune de naissance", { max: 50 }) + champTexte(w + "nationalite", "Nationalité", { max: 40 }) +
        champChoix(w + "lien", "Lien avec le premier titulaire", P.LIENS, { large: true }) + "</div>" + champCase(w + "meme", "Il habite à la même adresse que le premier titulaire (" + adr + ").");
      if (!meme) h += '<div class="op-grille">' + champTexte(w + "rue", "Adresse (numéro et voie)", { large: true, max: 80, aide: "Exemple : 12 rue des Lilas" }) + champTexte(w + "cp", "Code postal", { mode: "numeric", max: 5 }) + champTexte(w + "ville", "Ville", { max: 50 }) + "</div>";
      h += '<div class="op-grille">' + champTexte(w + "mob", "Téléphone mobile", { type: "tel", mode: "tel", max: 20, fac: true, aide: "06 ou 07 suivi de 8 chiffres." }) + champTexte(w + "mail", "Adresse e-mail", { type: "email", max: 80, fac: true }) +
        champChoix(w + "statut", "Situation professionnelle", P.STATUTS) + champTexte(w + "profession", "Profession", { max: 60 }) + champTexte(w + "revenus", "Revenus mensuels nets (€)", { mode: "decimal", max: 8, aide: "0 s'il n'y a pas de revenus." }) + "</div>";
    }
    h += "</fieldset>";
    h += '<fieldset class="op-section op-second"><legend>' + R + ' : connaissance client</legend><div class="op-grille">' + champRadio(w + "residence", "Résidence fiscale", P.RESIDENCES) +
      champRadio(w + "ppe", "Personne politiquement exposée (PPE) ou proche d'une PPE ?", [["non", "Non"], ["oui", "Oui"]]) + "</div>" +
      (f[w + "residence"] === "autre" ? champCase(w + "autocertification", "L'auto-certification de résidence fiscale a été remplie et signée par le " + libRang(w) + ".") : "") +
      (f[w + "ppe"] === "oui" ? champCase(w + "origineJustifiee", "Un justificatif de l'origine des fonds et du patrimoine du " + libRang(w) + " a été obtenu.") : "") + "</fieldset>";
    h += blocBdf(null, w);
    h += '<fieldset class="op-section op-second"><legend>' + R + " : pièces justificatives</legend>" + '<div class="op-grille">' + champChoix(w + "identite", "Pièce d'identité présentée", P.PIECES_IDENTITE) + "</div>" +
      champCase(w + "pieceIdentite", "Pièce d'identité en cours de validité : original vérifié, copie conservée.") + zoneScan(w + "identite") +
      (cc ? '<p class="op-aide">Client de l\'agence : son adresse est celle de sa fiche client, aucun justificatif de domicile n\'est demandé.</p>' : meme ? '<p class="op-aide">Même adresse que le premier titulaire : son justificatif de domicile suffit.</p>' :
        champCase(w + "pieceDomicile", "Justificatif de domicile de moins de 3 mois (facture, quittance de loyer, avis d'imposition) au nom du " + libRang(w) + ".") + zoneScan(w + "domicile")) + "</fieldset>";
    return h;
  }
  /* Compte joint (un second titulaire) ou indivis (de un à quatre autres titulaires) : un bloc par titulaire, avec les boutons pour ajouter ou retirer un indivisaire. */
  function sectionsCotitulaires() {
    var f = etat.f, n = nbCo(f), h = f.forme === "indivis" ? sectionIndivision() : "";
    h += listeParrains("op-clients-co");
    for (var i = 0; i < n; i++) h += sectionTitulaire(PREFIXES[i]);
    if (f.forme === "indivis") h += '<div class="pf-btns">' + (n < P.CO_MAX ? '<button type="button" class="btn btn-secondaire" id="op-co-ajouter" data-act="co-ajouter">Ajouter un indivisaire</button>' : "") +
      (n > 1 ? '<button type="button" class="btn btn-secondaire" id="op-co-retirer" data-act="co-retirer">Retirer le ' + libRang(PREFIXES[n - 1]) + "</button>" : "") + '</div><p class="op-aide">Un compte indivis compte de deux à cinq titulaires : ' + (n + 1) + " actuellement.</p>";
    return h;
  }
  /* Décision du conseiller pour une personne inscrite au FCC ou au FICP (fiche du dossier). */
  function decisionLigne(lib, q) { return q.decision ? ligne(lib, (q.decision.choix === "refuser" ? "Refus de l'ouverture" : "Avis favorable à l'ouverture (la directrice décide)") + " – motif : " + q.decision.motif) : ""; }
  function formHtml() {
    var f = etat.f, h = "", edit = etat.edition ? P.dossier(store(), etat.edition) : null, cl = clientDuForm();
    if (edit) {
      var e = P.etat(edit);
      if (e.complements.length) h += '<div class="op-info op-warn" role="status"><p><strong>Éléments demandés par la directrice :</strong></p><ul>' + e.complements.map(function (c) { return "<li>" + esc(c.texte) + "</li>"; }).join("") + "</ul><p>Obtenez-les auprès du " + (cl ? "client" : "prospect") + ", cochez les cases correspondantes dans « Connaissance du client », puis validez de nouveau le dossier et soumettez-le à validation.</p></div>";
    }
    var qui = cl ? "le client" : "le prospect";
    if (cl) h += blocClient(cl);
    else {
      h += '<fieldset class="op-section"><legend>Identité</legend><div class="op-grille">' + champRadio("civ", "Civilité", [["M.", "Monsieur"], ["Mme", "Madame"]]) + champTexte("nom", "Nom de famille", { max: 40 }) + champTexte("prenom", "Prénom", { max: 40 }) +
        champTexte("naissance", "Date de naissance", { type: "date", aide: "Le prospect doit être majeur." }) + champTexte("lieuNaissance", "Commune de naissance", { max: 50 }) + champTexte("nationalite", "Nationalité", { max: 40 }) + "</div></fieldset>";
      h += '<fieldset class="op-section"><legend>Coordonnées</legend><div class="op-grille">' + champTexte("rue", "Adresse (numéro et voie)", { large: true, max: 80, aide: "Exemple : 12 rue des Lilas" }) + champTexte("cp", "Code postal", { mode: "numeric", max: 5 }) + champTexte("ville", "Ville", { max: 50 }) +
        champTexte("mob", "Téléphone mobile", { type: "tel", mode: "tel", max: 20, aide: "06 ou 07 suivi de 8 chiffres." }) + champTexte("mail", "Adresse e-mail", { type: "email", max: 80 }) + "</div></fieldset>";
      h += '<fieldset class="op-section"><legend>Situation personnelle et professionnelle</legend><div class="op-grille">' + champChoix("situation", "Situation familiale", P.SITUATIONS) + champTexte("enfants", "Enfants à charge", { mode: "numeric", max: 1 }) + champChoix("logement", "Logement", P.LOGEMENTS) +
        champChoix("statut", "Situation professionnelle", P.STATUTS) + champTexte("profession", "Profession", { max: 60 }) + champTexte("revenus", "Revenus mensuels nets (€)", { mode: "decimal", max: 8, aide: "0 s'il n'y a pas de revenus." }) + "</div></fieldset>";
    }
    h += '<fieldset class="op-section"><legend>Connaissance du client</legend><p class="op-aide">Questions obligatoires avant toute ouverture de compte (lutte contre le blanchiment, échange automatique d\'informations fiscales).</p><div class="op-grille">' +
      champRadio("residence", "Résidence fiscale", P.RESIDENCES) + champRadio("ppe", "Personne politiquement exposée (PPE) ou proche d'une PPE ?", [["non", "Non"], ["oui", "Oui"]]) + champChoix("origine", "Origine principale des fonds", P.ORIGINES) +
      champChoix("objet", cl ? "Objet du compte" : "Objet de la relation", P.OBJETS) + "</div>" +
      (f.residence === "autre" ? champCase("autocertification", "L'auto-certification de résidence fiscale a été remplie et signée par " + qui + ".") : "") +
      (f.ppe === "oui" || f.origine === "autre" ? champCase("origineJustifiee", "Un justificatif de l'origine des fonds (et du patrimoine pour une PPE) a été obtenu.") : "") + "</fieldset>";
    h += blocBdf(cl);
    h += '<fieldset class="op-section"><legend>Pièces justificatives</legend><div class="op-grille">' + champChoix("identite", "Pièce d'identité présentée", P.PIECES_IDENTITE) + "</div>" +
      champCase("pieceIdentite", "Pièce d'identité en cours de validité : original vérifié, copie conservée.") + zoneScan("identite") +
      (cl ? "" : champCase("pieceDomicile", "Justificatif de domicile de moins de 3 mois (facture, quittance de loyer, avis d'imposition).") + zoneScan("domicile") +
        champCase("pieceRevenus", "Justificatif de revenus (bulletin de salaire, avis de pension, bilan) : obligatoire si le prospect déclare des revenus d'activité ou une pension.") + zoneScan("revenus")) + "</fieldset>";
    if (!cl) h += sectionReco();
    var dac = !cl && f.dac === "oui";
    h += '<fieldset class="op-section"><legend>Compte à ouvrir</legend>';
    if (!cl) {
      /* question posée au conseiller à l'ouverture : c'est la réponse, et non la convention, qui donne au compte la mention DAC */
      h += champRadio("dac", "Le compte est-il ouvert dans le cadre du droit au compte (désignation de la Banque de France) ?", [["non", "Non"], ["oui", "Oui – compte DAC"]]) +
        '<p class="op-aide">Réponse « oui » : la Banque de France a désigné la banque après le refus d\'une autre banque. Le compte reçoit la mention DAC et la convention de droit au compte (services bancaires de base, gratuits) s\'applique.</p>';
      if (dac) h += '<div class="op-grille">' + champTexte("dacDate", "Date de désignation par la Banque de France", { type: "date", aide: "La désignation reste valable six mois." }) + "</div>" +
        champCase("dacDeclaration", "Déclaration sur l\'honneur du prospect : il ne détient aucun compte de dépôt en France.");
      else h += sectionForme();
    } else h += sectionForme();
    h += '<div class="op-grille">' + (dac ? '<div class="champ"><span class="op-fixe-lib">Compte</span><p class="op-fixe" id="op-compte-dac">' + esc(PR.parId.DAC.nom) + "</p></div>" : champChoix("compte", "Compte", P.COMPTES.filter(function (id) { return f.forme === "individuel" || id === "CPT"; }).map(function (id) { return [id, PR.parId[id].nom]; }))) +
      champChoix("canal", "Moyen par lequel le compte est ouvert", K.ORDRE_MOYENS.map(function (k) { return [k, K.MOYENS[k]]; })) + "</div>" +
      '<p class="op-aide" id="op-aide-compte">' + esc(dac ? aideCompteDac() : aideCompte()) + "</p></fieldset>";
    if (!dac && (f.forme === "joint" || f.forme === "indivis")) h += sectionsCotitulaires();
    h += dac ? sectionDac() : sectionEquipement();
    h += '<fieldset class="op-section"><legend>Remarque</legend><div class="champ"><label for="op-note">Remarque <span class="aide-champ">(facultatif)</span></label><textarea id="op-note" maxlength="300" style="min-height:64px">' + esc(f.note) + "</textarea></div></fieldset>";
    h += '<p class="msg-erreur" id="op-err" role="alert">' + (etat.err ? esc(etat.err.erreur) : "") + "</p>";
    h += '<div class="pf-btns"><button type="submit" class="btn btn-principal">' + "Validation du conseiller" + '</button><button type="button" class="btn btn-secondaire" data-act="retour-liste">Annuler</button></div>';
    return h;
  }
  function formVue() {
    var edit = etat.edition ? P.dossier(store(), etat.edition) : null, dir = P.directeur(), cl = clientDuForm();
    return '<section class="bloc" aria-labelledby="t-form"><div class="bloc-tete"><h2 id="t-form" tabindex="-1">' + (edit ? (P.etat(edit).code === "conseiller" ? "Modifier le dossier " : "Compléter le dossier ") + esc(edit.ref) : cl ? "Nouveau compte pour " + esc(cl.prenom + " " + cl.nom.toUpperCase()) : "Nouveau dossier d'entrée en relation") + '</h2><span class="sous">Les champs marqués d\'une étoile sont obligatoires.</span></div>' +
      '<p class="op-aide">Vous validez d\'abord le dossier (« Validation du conseiller »), puis vous le soumettez à validation de ' + esc(dir.civ + " " + dir.prenom + " " + dir.nom.toUpperCase()) + ", directrice d'agence, avec la convention de compte demandée. Le compte ne peut être ouvert et équipé qu'après sa validation.</p>" +
      '<form class="formulaire op-form" id="op-form" novalidate>' + formHtml() + "</form></section>";
  }
  /* Choix du client pour lequel on ouvre un compte : numéro ou nom, avec la liste des clients. */
  function choixClientVue() {
    return '<section class="bloc" aria-labelledby="t-choix"><div class="bloc-tete"><h2 id="t-choix" tabindex="-1">Ouvrir un compte pour un client</h2></div>' +
      '<p class="op-aide">Le client est déjà connu de l\'agence : son dossier reprend l\'identité et les coordonnées de sa fiche, et le nouveau compte s\'ajoute à son compte actuel. Vous pouvez aussi ouvrir un compte depuis la fiche client.</p>' +
      '<form class="formulaire op-form" id="op-choix" novalidate><div class="champ op-large"><label for="op-cherche">Client (numéro ou nom) *</label><input id="op-cherche" type="text" list="op-parrains" autocomplete="off" maxlength="80" value="' + esc(etat.cherche || "") + '" aria-describedby="op-aide-cherche' + (etat.errChoix ? " op-err-choix" : "") + '"' + (etat.errChoix ? ' aria-invalid="true"' : "") + ">" +
      '<span class="aide-champ" id="op-aide-cherche">Numéro de client (GS-41…) ou nom et prénom : commencez à écrire pour choisir dans la liste.</span></div>' + listeParrains() +
      '<p class="msg-erreur" id="op-err-choix" role="alert">' + (etat.errChoix ? esc(etat.errChoix) : "") + '</p><div class="pf-btns"><button type="submit" class="btn btn-principal">Continuer</button><button type="button" class="btn btn-secondaire" data-act="retour-liste">Annuler</button></div></form></section>';
  }

  /* ---------- dossier ---------- */
  /* « Documents numérisés » : une ligne dans la fiche du dossier quand au moins une pièce a été scannée ou importée. */
  function scansLigne(f) {
    var sc = (f && f.scans) || {}, l = [];
    ["identite", "domicile", "revenus"].forEach(function (k) { if (sc[k] && NUM) l.push(PIECES_SCAN[k][0] + " (" + NUM.libelleMin(sc[k]) + ")"); });
    return l.length ? ligne("Documents numérisés", l.join(" ; ")) : "";
  }
  function ligne(l, v) { return "<div><dt>" + esc(l) + "</dt><dd>" + esc(v) + "</dd></div>"; }
  function equipLigne(f) {
    if (f.dac === "oui") return "Services bancaires de base, gratuits ; carte à autorisation systématique incluse ; ni chéquier ni découvert";
    var cv = f.convention ? PR.parId[f.convention] : null, pan = cv ? K.panierConvention(cv.convention, { cpt: { p: f.compte || "CPT" } }, f.services, f.compte) : null;
    var debut = (cv ? cv.nom.replace(/ – offre groupée.*$/, "") + " (" + B.eur2(cv.convention.cotisationMois) + " par mois), " + libCarte(cv.convention.carte) + " incluse" + (f.remise ? " (remise : " + K.libRemise(f.remise, cv.convention.carte) + ")" : "") : f.carte ? libCarte(f.carte) + (P.CARTES_A_DEBIT.indexOf(f.carte) >= 0 ? ", " + P.lib(P.DEBITS, f.debit).toLowerCase().replace(/ \(.*$/, "") : "") + (f.remise ? " (remise : " + K.libRemise(f.remise, f.carte) + ")" : "") : "aucune carte") +
      " ; chéquier : " + (f.cheque ? "oui" + (f.remiseCheque ? " (remise : " + K.libRemise(f.remiseCheque, "chequier") + ")" : "") : "non");
    if (!cv) return debut + " ; GS Connect (banque à distance) : " + (f.distance ? "oui, " + B.eur2(PR.gconMois) + " par mois" : "non") + " ; GS Alertes (alertes par SMS) : " + (f.sms ? "oui, " + B.eur2(PR.galeMois) + " par mois" : "non");
    var tous = cv.convention.services.filter(function (x) { return x.k !== "tenue"; }), lib = function (k) { return tous.filter(function (x) { return x.k === k; })[0].lib; };
    return debut + " ; services de la convention pris par le client : " + pan.cles.map(lib).join(", ") + (pan.cles.length < tous.length ? " (non pris pour l'instant, mais toujours compris dans la cotisation : " + tous.filter(function (x) { return pan.cles.indexOf(x.k) < 0; }).map(function (x) { return x.lib; }).join(", ") + ")" : "") +
      " ; " + (pan.eco.economie > 0 ? "réduction : " + PUI.e2(pan.eco.economie) + " par an par rapport aux mêmes services à l'unité" : "aucune réduction avec ces seuls services (la convention coûte " + PUI.e2(-pan.eco.economie) + " de plus par an qu'à l'unité)");
  }
  function parrainageHtml(d) {
    var pg = P.parrainage(store(), d); if (!pg) return "";
    var f = d.fiche, par = f.parrain;
    return '<h3>Recommandation et parrainage</h3><p>Recommandé par ' + esc(par.civ + " " + par.prenom + " " + par.nom.toUpperCase()) + " (client " + esc(par.num) + ').</p><div class="op-info' + (pg.applicable ? "" : " op-warn") + '" role="status"><p><strong>' + esc(pg.libelle) + "</strong></p><p>" + esc(pg.detail) + "</p></div>";
  }
  /* Lignes de la fiche pour un compte joint ou indivis : forme, indivision, puis chaque titulaire autre que le premier (identité, adresse, activité, connaissance client, Banque de France, décision, pièces). */
  function secondLignes(f) {
    if (!f.second) return "";
    var ind = f.indivision;
    var h = ligne("Forme du compte", f.forme === "indivis" ? "Compte indivis (« et ») : tous les titulaires signent chaque opération" : "Compte joint (« ou ») : chaque titulaire peut agir seul") +
      (ind ? ligne("Indivision", ind.type === "succession" ? "Succession de " + ind.defunt.civ + " " + ind.defunt.prenom + " " + ind.defunt.nom.toUpperCase() + ", décédé" + (ind.defunt.civ === "Mme" ? "e" : "") + " le " + fmt(ind.dateDeces) + " – acte de décès et acte de notoriété (ou attestation du notaire) vus" : "Indivision – justificatif de l'indivision vu") : "");
    P.titulaires(f).slice(1).forEach(function (t) {
      var q = t.p, R = P.RANGS[t.rang], lienTxt = P.lib(P.LIENS, q.lien), lienLib = lienTxt.charAt(0).toLowerCase() + lienTxt.slice(1), cc = q.client ? CL.filter(function (c) { return c.id === q.client; })[0] : null, sc = q.scans || {}, nums = [];
      h += ligne(R, nomP(q) + (cc ? " – client de l'agence (" + cc.num + ")" : "") + ", né" + (q.civ === "Mme" ? "e" : "") + " le " + fmt(q.naissance) + (q.lieuNaissance ? " à " + q.lieuNaissance : "") + " (" + q.age + " ans" + (q.nationalite ? ", " + q.nationalite : "") + ") – " + lienLib) +
        ligne("Adresse du " + libRangT(t.rang), q.memeAdresse === false ? q.rue + ", " + q.cp + " " + q.ville : "Même adresse que le premier titulaire") + (q.mob || q.mail ? ligne("Contact du " + libRangT(t.rang), [q.mob, q.mail].filter(Boolean).join(" – ")) : "") +
        ligne("Activité du " + libRangT(t.rang), q.profession + " (" + P.STATUTS.filter(function (x) { return x[0] === q.statut; })[0][1] + ") – " + B.eur(q.revenus || 0) + " nets par mois") +
        ligne("Connaissance du " + libRangT(t.rang), "Résidence fiscale : " + P.lib(P.RESIDENCES, q.residence).toLowerCase() + " ; PPE : " + (q.ppe === "oui" ? "oui" : "non")) +
        (q.bdf ? ligne("Banque de France (" + libRangT(t.rang) + ")", "Consultée le " + fmt(q.bdf.date) + " à " + q.bdf.heure + " (clé " + q.bdf.cle + (q.bdf.cleNaissance ? " et " + q.bdf.cleNaissance : "") + ") – " + X.libBilan(q.bdf)) : "") + decisionLigne("Décision du conseiller (" + libRangT(t.rang) + ")", q) +
        ligne("Pièces du " + libRangT(t.rang), P.lib(P.PIECES_IDENTITE, q.identite) + (q.memeAdresse === false && !cc ? ", justificatif de domicile" : ""));
      PIECES_CO.forEach(function (k) { if (sc[k] && NUM) nums.push(PIECES_SCAN[k][0] + " (" + NUM.libelleMin(sc[k]) + ")"); });
      if (nums.length) h += ligne("Documents numérisés (" + libRangT(t.rang) + ")", nums.join(" ; "));
    });
    return h;
  }
  /* « second titulaire », « troisième titulaire »… d'après le rang (1 = second). */
  function libRangT(rang) { var r = P.RANGS[rang] || "Titulaire"; return r.charAt(0).toLowerCase() + r.slice(1); }
  function ficheHtml(d) {
    var f = d.fiche, cl = estClient(f);
    var h = '<dl class="op-fiche">';
    if (cl) h += ligne("Client", nomP(f) + ", " + f.age + " ans – " + PRO_NUM(d)) + ligne("Adresse", f.rue + ", " + f.cp + " " + f.ville) + ligne("Contact", f.mob + " – " + f.mail) + ligne("Activité", f.profession + " – " + B.eur(f.revenus) + " nets par mois");
    else h += ligne("Identité", nomP(f) + ", né" + (f.civ === "Mme" ? "e" : "") + " le " + fmt(f.naissance) + " à " + f.lieuNaissance + " (" + f.age + " ans, " + f.nationalite + ")") + ligne("Adresse", f.rue + ", " + f.cp + " " + f.ville) + ligne("Contact", f.mob + " – " + f.mail) +
      ligne("Situation", P.lib(P.SITUATIONS, f.situation) + ", " + f.enfants + " enfant" + (f.enfants > 1 ? "s" : "") + " à charge – " + P.lib(P.LOGEMENTS, f.logement).toLowerCase()) +
      ligne("Activité", f.profession + " (" + P.STATUTS.filter(function (x) { return x[0] === f.statut; })[0][1] + ") – " + B.eur(f.revenus) + " nets par mois");
    h += ligne("Connaissance du client", "Résidence fiscale : " + P.lib(P.RESIDENCES, f.residence).toLowerCase() + " ; PPE : " + (f.ppe === "oui" ? "oui" : "non") + " ; origine des fonds : " + P.lib(P.ORIGINES, f.origine).toLowerCase() + " ; objet : " + P.lib(P.OBJETS, f.objet).toLowerCase()) +
      (f.bdf ? ligne("Banque de France", "Consultée le " + fmt(f.bdf.date) + " à " + f.bdf.heure + " (clé " + f.bdf.cle + (f.bdf.cleNaissance ? " et " + f.bdf.cleNaissance : "") + ") – " + X.libBilan(f.bdf)) : "") + decisionLigne("Décision du conseiller", f) +
      ligne("Pièces", P.lib(P.PIECES_IDENTITE, f.identite) + (cl ? "" : ", justificatif de domicile" + (f.pieceRevenus ? ", justificatif de revenus" : ""))) +
      scansLigne(f) + secondLignes(f) +
      (f.reco === "oui" && f.parrain ? ligne("Recommandation", "Recommandé par " + f.parrain.civ + " " + f.parrain.prenom + " " + f.parrain.nom.toUpperCase() + " (client " + f.parrain.num + ")") : "") +
      (f.dac === "oui" ? ligne("Droit au compte", "Compte DAC – désignation de la Banque de France du " + fmt(f.dacDate) + " ; déclaration sur l'honneur : aucun compte de dépôt en France") : "") +
      ligne("Compte demandé", PR.parId[f.compte].nom + (cl && f.objet === "secondaire" ? " (compte secondaire)" : "") + " – " + K.MOYENS[f.canal].toLowerCase()) + ligne("Équipement demandé", equipLigne(f)) + (f.note ? ligne("Remarque", f.note) : "") + "</dl>";
    return h;
  }
  function equipementHtml(d) {
    var st = store(), cid = P.clientDe(d).id, souscrits = K.souscriptions(st).filter(function (s) { return s.c === cid && (!estClient(d.fiche) || (s.options && s.options.dossier === d.ref)); }).slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : a.heure < b.heure ? 1 : -1; });
    var h = '<h3>Équipement du compte</h3><p>Le compte et la carte demandés à l\'ouverture figurent ci-dessous, avec leurs contrats (signature électronique ou impression selon le moyen). Équipez ensuite le client dans le catalogue : livret, assurance, autre carte…</p>' +
      '<div class="pf-btns"><a class="btn btn-principal" href="catalogue.html?client=' + cid + '">Équiper le compte dans le catalogue</a><a class="btn btn-secondaire" href="agenda.html">Planifier un suivi dans l\'agenda</a></div>';
    if (!souscrits.length) return h;
    return h + '<div class="tab-wrap"><table class="tab-ventes"><caption class="sr">Produits souscrits à l\'ouverture</caption><thead><tr><th scope="col">Date</th><th scope="col">Produit</th><th scope="col">Moyen</th><th scope="col">Contrat</th></tr></thead><tbody>' + souscrits.map(function (s) {
      return '<tr><th scope="row">' + esc(fmt(s.date)) + '</th><td data-label="Produit">' + esc(PR.parId[s.p].nom) + (s.montant != null ? '<span class="pf-sous">' + esc(B.eur(s.montant)) + "</span>" : "") + '</td><td data-label="Moyen">' + esc(K.MOYENS[s.canal] || "") + '</td><td data-label="Contrat" class="ct-cell">' + UC.celluleHtml(s) + "</td></tr>";
    }).join("") + "</tbody></table></div>";
  }
  function ribHtml(d) {
    var c = P.clientDe(d), r = RIB.rib(c, P.rangCompte(d), d.fiche.client ? P.titulairesCompte(d.fiche) : undefined); var rs = P.restrictions(d.fiche);
    return '<h3>Compte ouvert</h3><dl class="op-fiche"><div><dt>Numéro de client</dt><dd>' + esc(d.ouvert.num) + "</dd></div><div><dt>IBAN</dt><dd>" + esc(r.ibanLisible) + "</dd></div><div><dt>BIC</dt><dd>" + esc(r.bicLisible) + "</dd></div>" + (r.joint ? ligne("Forme du compte", r.forme === "indivis" ? "Compte indivis (« et »)" : "Compte joint (« ou »)") + ligne("Intitulé du compte", r.intitule) + (r.forme === "indivis" ? ligne("Titulaires", r.titulaires.join(" et ")) : "") : ligne("Titulaire", r.titulaire)) + (rs.textes.length ? ligne("Restrictions", rs.textes.join(" ; ") + " (inscription à la Banque de France appréciée par l'agence)") : "") + "</dl>";
  }
  /* ---------- fiche client : famille (situation, conjoint, enfants), à compléter après l'ouverture ---------- */
  var COUPLE = ["marie", "pacse", "concubinage"];
  function libConjoint(sit, sexe) { return sit === "marie" ? (sexe === "F" ? "Conjointe" : "Conjoint") : sit === "pacse" ? "Partenaire de PACS" : (sexe === "F" ? "Concubine" : "Concubin"); }
  function familleResume(d) {
    var c = P.clientDe(d), fam = c.fam, cj = fam.conj, h = '<dl class="op-fiche">' + ligne("Situation familiale", P.lib(P.SITUATIONS, fam.sit));
    if (cj) h += ligne(libConjoint(fam.sit, cj.sexe), cj.prenom + " " + cj.nom.toUpperCase() + ", " + cj.age + " ans – " + cj.prof + (cj.rev ? " – " + B.eur(cj.rev) + " nets par mois" : "") + (d.fiche.second && d.fiche.second.lien === "couple" ? " (second titulaire du compte)" : ""));
    else if (COUPLE.indexOf(fam.sit) >= 0) h += ligne("Conjoint", "À renseigner");
    h += ligne("Enfants", fam.enf.length ? fam.enf.map(function (e) { return e.prenom + " (" + e.age + (e.age > 1 ? " ans" : " an") + ")"; }).join(", ") + " – " + fam.nbCharge + " à charge" : fam.nbCharge ? fam.nbCharge + " à charge (non détaillés)" : "Aucun");
    return h + "</dl>";
  }
  function familleInit(d) {
    var c = P.clientDe(d), fam = c.fam, cj = fam.conj, dc = d.complement;
    return { sit: fam.sit, conj: { civ: cj ? (cj.sexe === "F" ? "Mme" : "M.") : "", prenom: cj ? cj.prenom : "", nom: cj ? cj.nom : "", naissance: dc && dc.conj ? dc.conj.naissance : "", statut: cj ? cj.statut : "", profession: cj ? cj.prof : "", revenus: cj && cj.rev ? String(cj.rev) : "" },
      enfants: dc ? dc.enf.map(function (e) { return Object.assign({}, e); }) : [], err: null };
  }
  function fcChamp(id, lib, v, o) {
    o = o || {}; var e = etat.famille.err && etat.famille.err.champ === id;
    return '<div class="champ"><label for="' + id + '">' + esc(lib) + (o.fac ? ' <span class="aide-champ">(facultatif)</span>' : " *") + '</label><input id="' + id + '" type="' + (o.type || "text") + '"' + (o.mode ? ' inputmode="' + o.mode + '"' : "") + ' autocomplete="off" maxlength="' + (o.max || 60) + '" value="' + esc(v) + '"' +
      (o.type === "date" ? ' min="1900-01-01" max="' + B.ymd(B.aujourdhui()) + '"' : "") + (e ? ' aria-invalid="true" aria-describedby="fc-err"' : "") + "></div>";
  }
  function fcChoix(id, lib, liste, v) {
    var e = etat.famille.err && etat.famille.err.champ === id;
    return '<div class="champ"><label for="' + id + '">' + esc(lib) + ' *</label><select id="' + id + '"' + (e ? ' aria-invalid="true" aria-describedby="fc-err"' : "") + '><option value="">Choisir…</option>' + liste.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (v === x[0] ? " selected" : "") + ">" + esc(x[1]) + "</option>"; }).join("") + "</select></div>";
  }
  function familleForm(d) {
    var F = etat.famille, e = F.err, liee = d.fiche.second && d.fiche.second.lien === "couple", couple = COUPLE.indexOf(F.sit) >= 0, h = '<form class="formulaire op-form op-fam-form" id="op-fam-form" novalidate><div class="op-grille">' + fcChoix("fc-sit", "Situation familiale", P.SITUATIONS, F.sit) + "</div>";
    if (couple && liee) h += '<p class="op-aide">Le conjoint, le partenaire ou le concubin est le second titulaire du compte, ' + esc(nomP(d.fiche.second)) + " : sa fiche est déjà renseignée.</p>";
    else if (couple) h += '<fieldset class="op-section"><legend>' + esc(libConjoint(F.sit, F.conj.civ === "Mme" ? "F" : "M")) + '</legend><div class="op-grille">' + fcChoix("fc-conj-civ", "Civilité", [["M.", "Monsieur"], ["Mme", "Madame"]], F.conj.civ) + fcChamp("fc-conj-prenom", "Prénom", F.conj.prenom, { max: 40 }) + fcChamp("fc-conj-nom", "Nom de famille", F.conj.nom, { max: 40 }) +
      fcChamp("fc-conj-naissance", "Date de naissance", F.conj.naissance, { type: "date" }) + fcChoix("fc-conj-statut", "Situation professionnelle", P.STATUTS, F.conj.statut) + fcChamp("fc-conj-profession", "Profession", F.conj.profession, { max: 60 }) + fcChamp("fc-conj-revenus", "Revenus mensuels nets (€)", F.conj.revenus, { mode: "decimal", max: 8, fac: true }) + "</div></fieldset>";
    h += '<fieldset class="op-section"><legend>Enfants</legend>' + (F.enfants.length ? "" : '<p class="op-aide">Aucun enfant renseigné.</p>');
    F.enfants.forEach(function (x, i) {
      var n = i + 1;
      h += '<div class="op-fam-enfant" role="group" aria-label="Enfant ' + n + '"><div class="op-grille">' + fcChamp("fc-enf-prenom-" + n, "Prénom de l'enfant " + n, x.prenom, { max: 40 }) + fcChamp("fc-enf-naissance-" + n, "Date de naissance", x.naissance, { type: "date" }) + fcChoix("fc-enf-sexe-" + n, "Fille ou garçon", [["F", "Fille"], ["M", "Garçon"]], x.sexe) +
        '</div><label class="op-case"><input type="checkbox" id="fc-enf-charge-' + n + '"' + (x.charge ? " checked" : "") + "><span>Enfant à charge</span></label>" +
        '<button type="button" class="btn-texte" data-act="fam-enfant-retirer" data-n="' + i + '">Retirer l\'enfant ' + n + "</button></div>";
    });
    if (F.enfants.length < 8) h += '<div class="pf-btns"><button type="button" class="btn btn-secondaire" data-act="fam-enfant-ajouter">Ajouter un enfant</button></div>';
    h += "</fieldset>" + '<p class="msg-erreur" id="fc-err" role="alert">' + (e ? esc(e.erreur) : "") + '</p><div class="pf-btns"><button type="submit" class="btn btn-principal">Enregistrer la fiche famille</button><button type="button" class="btn btn-secondaire" data-act="fam-annuler">Annuler</button></div></form>';
    return h;
  }
  function familleHtml(d) {
    if (!d.ouvert || estClient(d.fiche)) return "";
    var h = '<section class="op-fam" aria-labelledby="t-fam"><h3 id="t-fam" tabindex="-1">Fiche client : famille</h3><div id="op-fam-zone">';
    if (etat.famille) h += familleForm(d);
    else h += familleResume(d) + '<p class="op-aide">La situation familiale, le conjoint et les enfants se complètent à tout moment : ils alimentent la fiche client' + (d.complement ? " (dernière mise à jour le " + esc(fmt(d.complement.date)) + ")" : "") + '.</p><div class="pf-btns"><button type="button" class="btn btn-secondaire" data-act="fam-ouvrir">Compléter la fiche famille</button></div>';
    return h + "</div></section>";
  }
  function lireFamille() {
    var F = etat.famille; if (!F || !document.getElementById("op-fam-form")) return;
    function v(id) { var e = document.getElementById(id); return e ? e.value : ""; }
    F.sit = v("fc-sit");
    if (document.getElementById("fc-conj-prenom")) F.conj = { civ: v("fc-conj-civ"), prenom: v("fc-conj-prenom"), nom: v("fc-conj-nom"), naissance: v("fc-conj-naissance"), statut: v("fc-conj-statut"), profession: v("fc-conj-profession"), revenus: v("fc-conj-revenus") };
    F.enfants = F.enfants.map(function (x, i) { var n = i + 1, c = document.getElementById("fc-enf-charge-" + n); return { prenom: v("fc-enf-prenom-" + n), naissance: v("fc-enf-naissance-" + n), sexe: v("fc-enf-sexe-" + n), charge: c ? c.checked : false }; });
  }
  function refaireFamille(idFocus) {
    var d = dossierCourant(), z = document.getElementById("op-fam-zone"); if (!d || !z) return;
    z.innerHTML = etat.famille ? familleForm(d) : familleResume(d);
    var el = idFocus && document.getElementById(idFocus); if (el) el.focus();
  }
  function enregistrerFamille() {
    var d = dossierCourant(); if (!d || !etat.famille) return;
    lireFamille();
    var F = etat.famille, couple = COUPLE.indexOf(F.sit) >= 0, r = P.completer(store(), d.id, { sit: F.sit, conj: couple ? F.conj : null, enfants: F.enfants });
    if (!r.ok) { F.err = r; refaireFamille(); var el = document.getElementById(r.champ) || document.getElementById("fc-err"); if (el) { if (el.scrollIntoView) el.scrollIntoView({ block: "center" }); el.focus(); } return; }
    B.store.sauver(); etat.famille = null; etat.msg = "Fiche famille enregistrée : la fiche client de " + nomP(d.fiche) + " est à jour."; render(); focus("op-msg");
  }

  function dossierVue() {
    var d = dossierCourant(); if (!d) return "";
    var e = P.etat(d), h = '<section class="bloc" aria-labelledby="t-doss"><div class="bloc-tete"><h2 id="t-doss" tabindex="-1">Dossier ' + esc(d.ref) + " – " + esc(nomP(d.fiche)) + '</h2><span class="chip ' + CHIP[e.ton] + '">' + esc(e.libelle) + "</span>" + (d.fiche.dac === "oui" ? '<span class="chip chip-warn">DAC</span>' : "") + (d.fiche.second ? '<span class="chip chip-ctrl">' + (d.fiche.forme === "indivis" ? "Compte indivis" : "Compte joint") + "</span>" : "") + "</div>";
    h += '<p class="op-msg" id="op-msg" role="status" tabindex="-1">' + (etat.msg ? esc(etat.msg) : "") + "</p>";
    h += '<p class="op-etat">' + esc(e.detail) + "</p>";
    if (d.fiche.dac === "oui") h += '<div class="op-info" role="note"><p><strong>Compte DAC (droit au compte).</strong> ' + (d.ouvert ? "Le compte porte la mention DAC, posée à l\'ouverture. Il comprend les services bancaires de base, gratuits." : "La mention DAC sera posée à l\'ouverture du compte, qui comprendra les services bancaires de base, gratuits. Désignation de la Banque de France du " + esc(fmt(d.fiche.dacDate)) + ".") + "</p></div>";
    if (e.code === "conseiller") {
      var cvn = d.fiche.convention && PR.parId[d.fiche.convention] ? PR.parId[d.fiche.convention].nom.replace(/ – offre groupée.*$/, "") : "";
      h += '<div class="op-info" role="note"><p>' + (d.fiche.dac === "oui" ? "La convention de droit au compte (services bancaires de base, gratuits) est soumise avec l'ouverture du compte." : cvn ? "La demande de convention de compte (<strong>" + esc(cvn) + "</strong>) est soumise avec l'ouverture du compte." : "Le dossier d'ouverture du compte est soumis sans convention de compte.") + '</p></div>' +
        '<div class="champ op-comm"><label for="op-comm">Commentaire pour la directrice <span class="aide-champ">(facultatif, 300 caractères au plus)</span></label><textarea id="op-comm" maxlength="' + P.COMMENTAIRE_MAX + '" style="min-height:64px">' + esc(etat.commentaire || "") + '</textarea><p class="msg-erreur" id="op-comm-err" role="alert"></p></div>';
    }
    var dernier = d.soumis && d.soumis.length ? d.soumis[d.soumis.length - 1] : null;
    if (dernier && dernier.commentaire && e.code !== "conseiller") h += '<p class="op-aide"><strong>Votre commentaire à la directrice :</strong> ' + esc(dernier.commentaire) + "</p>";
    if (e.complements.length) h += '<div class="op-info op-warn"><ul>' + e.complements.map(function (c) { return "<li>" + esc(c.texte) + "</li>"; }).join("") + "</ul></div>";
    if (e.code === "refuse" && DC) h += '<div class="op-info op-warn" role="note"><p><strong>Droit au compte.</strong> Remettez au demandeur la lettre de refus d\'ouverture de compte : elle indique le motif du refus, rappelle son droit au compte (article L312-1 du Code monétaire et financier) et lui propose de transmettre sa demande à la Banque de France, qui désignera un établissement chargé de lui ouvrir un compte avec les services bancaires de base, gratuits.</p></div>';
    h += '<div class="pf-btns">';
    if (e.code === "refuse" && DC) {
      /* chaque personne refusée reçoit sa lettre, à son nom */
      var rs = P.refusDe(d);
      rs.forEach(function (r) { h += '<button type="button" class="btn btn-principal btn-impr" data-act="lettre-refus" data-qui="' + r.cle + '">' + ICO.imprimante + "<span>Imprimer la lettre de refus" + (rs.length > 1 || r.cle !== "principal" ? " – " + esc(nomP(r.p)) : "") + "</span></button>"; });
      h += '<a class="btn btn-secondaire" href="courriers.html?doc=droit_compte&amp;dossier=' + d.id + (P.refusDe(d).length > 1 ? "&amp;qui=" + P.refusDe(d)[0].cle : "") + (d.fiche.client ? "&amp;client=" + d.fiche.client : "") + '">Voir la lettre dans Courriers et documents</a>';
    }
    if (e.actions.indexOf("soumettre") >= 0) h += '<button type="button" class="btn btn-principal" data-act="soumettre">Soumettre à validation</button>';
    if (e.actions.indexOf("modifier") >= 0) h += '<button type="button" class="btn btn-secondaire" data-act="completer">Modifier le dossier</button>';
    if (e.actions.indexOf("ouvrir") >= 0) h += '<button type="button" class="btn btn-principal" data-act="ouvrir-compte">Ouvrir le compte</button>';
    if (e.actions.indexOf("completer") >= 0) h += '<button type="button" class="btn btn-principal" data-act="completer">Compléter le dossier</button>';
    h += '<button type="button" class="btn btn-secondaire btn-impr" data-act="imprimer">' + ICO.imprimante + "<span>Imprimer le dossier</span></button><button type=\"button\" class=\"btn-texte\" data-act=\"retour-liste\">Retour aux dossiers</button></div>";
    h += ficheHtml(d) + parrainageHtml(d);
    if (d.ouvert) h += ribHtml(d) + familleHtml(d) + equipementHtml(d);
    return h + "</section>";
  }
  function imprimer() {
    var d = dossierCourant(); if (!d) return;
    var e = P.etat(d), f = d.fiche, dir = P.directeur(), rv = P.revueAt(d), pg = P.parrainage(store(), d);
    var lignes = ficheHtml(d).replace(/<dl class="op-fiche">|<\/dl>/g, "").replace(/<div><dt>/g, '<tr><th scope="row" class="g">').replace(/<\/dt><dd>/g, '</th><td class="g">').replace(/<\/dd><\/div>/g, "</td></tr>");
    var corps = '<section class="dp-bloc"><h2>Situation du dossier</h2><p class="dp-texte"><strong>' + esc(e.libelle) + "</strong> – " + esc(e.detail) + '</p></section><section class="dp-bloc"><h2>Dossier d\'entrée en relation</h2><table class="dp-pf dp-dossier-oc"><tbody>' + lignes + "</tbody></table></section>" +
      (pg ? '<section class="dp-bloc"><h2>Recommandation et parrainage</h2><p class="dp-texte">Recommandé par ' + esc(f.parrain.civ + " " + f.parrain.prenom + " " + f.parrain.nom.toUpperCase()) + " (client " + esc(f.parrain.num) + "). <strong>" + esc(pg.libelle) + "</strong> – " + esc(pg.detail) + "</p></section>" : "") +
      '<section class="dp-bloc"><h2>Validation</h2><p class="dp-texte">Directrice d\'agence : ' + esc(dir.civ + " " + dir.prenom + " " + dir.nom.toUpperCase()) + (rv && (e.code === "ouvert" || e.code === "valide") ? " – dossier validé le " + esc(fmt(B.ymd(rv))) + " à " + esc(B.hhmm(rv).replace(":", " h ")) : "") + (d.ouvert ? " – compte ouvert le " + esc(fmt(d.ouvert.date)) + " (client " + esc(d.ouvert.num) + ")." : ".") + '</p></section>';
    IMP.imprimer(IMP.document({ titre: "Dossier d'ouverture de compte", sous: d.ref + " – " + nomP(f), corps: corps }), "Dossier_ouverture_" + IMP.nomFichier(f.prenom + " " + f.nom) + "_" + d.ref);
  }

  /* ---------- page ---------- */
  function render() {
    var h = '<nav class="fil-ariane" aria-label="Fil d\'Ariane"><a href="index.html">' + ICO.retour + "Accueil</a><span aria-hidden=\"true\">/</span><span>Ouverture de compte</span></nav>" +
      '<div class="page-titre"><h1>Ouverture de compte</h1><p>Pour un prospect ou pour un client : dossier, validation de la directrice d\'agence, ouverture du compte puis équipement</p></div>';
    if (etat.vue === "form") h += formVue(); else if (etat.vue === "choix") h += choixClientVue(); else if (etat.vue === "dossier") h += dossierVue(); else h += listeHtml();
    app.innerHTML = h;
  }
  function focus(id) { var e = document.getElementById(id); if (e) { if (!e.hasAttribute("tabindex")) e.setAttribute("tabindex", "-1"); e.focus(); } }

  function lire() {
    var f = document.getElementById("op-form"); if (!f) return;
    Object.keys(VIDE).forEach(function (k) {
      var r = f.querySelectorAll('input[name="op-' + k + '"]'), e = document.getElementById("op-" + k);
      if (r.length) { var c = f.querySelector('input[name="op-' + k + '"]:checked'); etat.f[k] = c ? c.value : ""; }
      else if (e) etat.f[k] = e.type === "checkbox" ? e.checked : e.value;
    });
  }
  function envoyer() {
    lire();
    var st = store(), edit = etat.edition, r = P.controler(ficheDuFormulaire(etat.f, edit), CL, B.aujourdhui(), st);
    if (!r.ok) {
      etat.err = r; render();
      var el = document.getElementById("op-" + r.champ) || document.querySelector('input[name="op-' + r.champ + '"]') || (r.champ === "bdf" ? document.querySelector('[data-act="bdf"]:not([data-w])') : /^(s|u\d)_bdf$/.test(r.champ) ? document.querySelector('[data-act="bdf"][data-w="' + r.champ.replace("bdf", "") + '"]') : null);
      if (el) { if (el.scrollIntoView) el.scrollIntoView({ block: "center" }); el.focus(); }
      return;
    }
    etat.err = null;
    var d;
    if (edit) { d = P.reviser(st, edit, r.fiche); etat.msg = "Dossier " + d.ref + " validé par le conseiller. Il reste à le soumettre à validation."; }
    else { d = P.creer(st, r.fiche); etat.msg = "Dossier " + d.ref + " validé par le conseiller. Il reste à le soumettre à validation."; }
    B.store.sauver();
    etat.commentaire = "";
    etat.vue = "dossier"; etat.dossier = d.id; etat.edition = null; render(); focus("op-msg");
  }
  function ouvrirPourClient(id) {
    var c = CL.filter(function (x) { return x.id === id; })[0]; if (!c) return false;
    etat.f = Object.assign({}, VIDE, { titulaire: "client", client: c.id }); etat.err = null; etat.edition = null; etat.vue = "form";
    if (c.kyc > S.KYC_MAX) etat.err = { champ: "client", erreur: P.nomClient(c) + " : le dossier client n'a pas été actualisé depuis plus de 5 ans. Actualisez-le lors d'un entretien (fiche client) avant d'ouvrir un compte." };
    return true;
  }

  /* Titulaires déjà clients de l'agence (d'après le champ « Client de l'agence » de chaque bloc) : le formulaire est refait quand l'un d'eux change. */
  function signatureCo() { return PREFIXES.map(function (w) { var c = clientCo(w); return c ? c.id : 0; }).join(","); }
  app.addEventListener("input", function (e) {
    var t = e.target;
    if (t.id === "op-comm") { etat.commentaire = t.value; var ez = document.getElementById("op-comm-err"); if (ez) ez.textContent = ""; return; }
    if (!t.closest("#op-form")) return;
    var k = t.id.replace(/^op-/, ""); if (k in VIDE && !/(^|_)naissance$/.test(k) && !/^(s|u\d)_client$/.test(k) && t.type !== "checkbox" && t.tagName !== "SELECT") etat.f[k] = t.value;
    if (k === "nom" || k === "nomNaissance") { etat.bdfErr = ""; majBdf(); }
    PREFIXES.forEach(function (w) { if (k === w + "nom" || k === w + "nomNaissance") { etat.bdfErrCo[w] = ""; majBdf(w); } });
  });
  app.addEventListener("change", function (e) {
    var t = e.target;
    if (t.id === "fc-sit" && etat.famille) { lireFamille(); etat.famille.err = null; refaireFamille("fc-sit"); return; }
    if (!t.closest("#op-form")) return;
    if (t.hasAttribute("data-svc")) { majPanier(PUI.basculer(etat.f.services, t.getAttribute("data-svc"), t.checked)); return; }
    var avant = { residence: etat.f.residence, ppe: etat.f.ppe, origine: etat.f.origine, reco: etat.f.reco, carte: etat.f.carte, convention: etat.f.convention, compte: etat.f.compte, dac: etat.f.dac, canal: etat.f.canal, cheque: etat.f.cheque,
      forme: etat.f.forme, indType: etat.f.indType, clientsCo: signatureCo() };
    PREFIXES.forEach(function (w) { ["residence", "ppe", "meme"].forEach(function (c) { avant[w + c] = etat.f[w + c]; }); });
    lire();
    var apres = signatureCo();
    if (t.id === "op-naissance") { etat.bdfErr = ""; majBdf(); }
    PREFIXES.forEach(function (w) { if (t.id === "op-" + w + "naissance") { etat.bdfErrCo[w] = ""; majBdf(w); } });
    if (etat.f.dac === "oui") etat.f.forme = "individuel";                                  /* le droit au compte donne un compte individuel */
    if (etat.f.forme !== "individuel" && etat.f.compte === "JEUNE") etat.f.compte = "CPT";   /* le Compte Jeune est individuel : un compte joint ou indivis est un compte courant Équilibre */
    if (avant.convention !== etat.f.convention) etat.f.services = [];       /* autre convention : le panier se compose de nouveau (carte seule au départ) */
    var aide = document.getElementById("op-aide-compte"); if (aide) aide.textContent = aideCompte();
    var rendre = Object.keys(avant).some(function (k) { return k === "clientsCo" ? avant[k] !== apres : avant[k] !== etat.f[k]; });
    if (rendre) {
      etat.err = null; var id = t.id || (t.name ? 'input[name="' + t.name + '"]:checked' : ""); var f = document.getElementById("op-form"); f.innerHTML = formHtml();
      var el = t.id ? document.getElementById(t.id) : document.querySelector(id); if (el) el.focus();
    }
  });
  app.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    var act = b.getAttribute("data-act"), id = b.getAttribute("data-id");
    if (act === "nouveau") { etat.f = Object.assign({}, VIDE); etat.err = null; etat.edition = null; etat.vue = "form"; render(); focus("t-form"); }
    else if (act === "nouveau-client") { etat.cherche = ""; etat.errChoix = null; etat.vue = "choix"; render(); focus("t-choix"); }
    else if (act === "retour-liste") { etat.famille = null; etat.vue = "liste"; etat.dossier = null; etat.edition = null; etat.err = null; etat.msg = null; history.replaceState(null, "", "prospect.html"); render(); focus("t-liste"); }
    else if (act === "ouvrir-dossier") { etat.vue = "dossier"; etat.dossier = parseInt(id, 10); etat.msg = null; etat.famille = null; render(); focus("t-doss"); }
    else if (act === "completer") { var d = dossierCourant(); if (!d) return; etat.f = Object.assign({}, VIDE, d.fiche, formulaireDeLaFiche(d.fiche), { enfants: String(d.fiche.enfants), revenus: String(d.fiche.revenus).replace(".", ",") }); etat.bdfErr = ""; etat.bdfErrCo = {}; etat.bdfConsult = null; etat.bdfConsultCo = {}; etat.edition = d.id; etat.err = null; etat.vue = "form"; render(); focus("t-form"); }
    else if (act === "soumettre") {
      var dS = dossierCourant(); if (!dS) return;
      var zc = document.getElementById("op-comm"), cm = zc ? zc.value : "";
      var rs = P.soumettre(store(), dS.id, cm);
      if (!rs.ok) { etat.commentaire = cm; var ez = document.getElementById("op-comm-err"); if (ez) ez.textContent = rs.erreur; if (zc) zc.focus(); return; }
      B.store.sauver(); etat.commentaire = "";
      etat.msg = "Dossier " + rs.dossier.ref + " soumis à validation de la directrice" + (rs.dossier.fiche.convention ? ", avec la convention de compte demandée" : "") + ".";
      render(); focus("op-msg");
    }
    else if (act === "ouvrir-compte") {
      var st = store(), r = P.ouvrir(st, etat.dossier);
      if (!r.ok) { etat.msg = r.erreur; render(); focus("op-msg"); return; }
      B.store.sauver(); etat.msg = "Compte ouvert : numéro de client " + r.dossier.ouvert.num + (r.convention ? ", " + PR.parId[r.convention.p].nom.replace(/ – offre groupée.*$/, "") + " souscrite" : "") + (r.carte ? ", " + PR.parId[r.carte.p].nom + (r.convention ? " incluse" : " souscrite") : "") + ". Le contrat (convention de compte" + (r.convention ? ", contrat de la convention" : "") + (r.carte ? " et contrat de carte" : "") + ") suit le moyen d'ouverture. Vous pouvez maintenant équiper le client."; render(); focus("op-msg");
    }
    else if (act === "svc-tout" || act === "svc-carte") { var cvp = conventionCourante(); if (cvp) { majPanier(PUI.raccourci(cvp, act)); b.focus(); } }
    else if (act === "imprimer") imprimer();
    else if (act === "lettre-refus") { var dr = dossierCourant(); if (dr && DC) { var qr = b.getAttribute("data-qui") || "principal", rf = P.refusDe(dr).filter(function (r) { return r.cle === qr; })[0] || P.refusDe(dr)[0], lt = DC.depuisDossier(dr, rf, P.dateRefus(dr)); IMP.imprimer(IMP.document({ titre: lt.titre, sous: lt.sous, corps: lt.corps, courrier: false, lettre: true }), lt.fichier); } }
    else if (act === "fam-ouvrir") { var dF = dossierCourant(); if (dF) { etat.famille = familleInit(dF); refaireFamille("fc-sit"); } }
    else if (act === "fam-annuler") { etat.famille = null; refaireFamille(); var bt = document.querySelector('[data-act="fam-ouvrir"]'); if (bt) bt.focus(); }
    else if (act === "fam-enfant-ajouter") { lireFamille(); etat.famille.err = null; etat.famille.enfants.push({ prenom: "", naissance: "", sexe: "", charge: true }); refaireFamille("fc-enf-prenom-" + etat.famille.enfants.length); }
    else if (act === "fam-enfant-retirer") { lireFamille(); etat.famille.err = null; etat.famille.enfants.splice(parseInt(b.getAttribute("data-n"), 10), 1); refaireFamille("fc-sit"); }
    else if (act === "num") numeriser(b);
    else if (act === "co-ajouter") { lire(); var na = nbCo(etat.f); if (na < P.CO_MAX) etat.f.nbCo = na + 1; refaireForm("op-" + PREFIXES[Math.min(na, P.CO_MAX - 1)] + "client"); }
    else if (act === "co-retirer") {
      lire(); var nr = nbCo(etat.f);
      if (nr > 1) { var wr = PREFIXES[nr - 1]; Object.keys(CHAMPS_CO).forEach(function (k) { etat.f[wr + k] = CHAMPS_CO[k]; }); PIECES_CO.forEach(function (k) { if (etat.f.scans) delete etat.f.scans[wr + k]; }); delete etat.bdfConsultCo[wr]; delete etat.bdfErrCo[wr]; etat.f.nbCo = nr - 1; }
      refaireForm("op-co-ajouter");
    }
    else if (act === "bdf") interrogerBdf(b.getAttribute("data-w") || "");
    else if (act.indexOf("ct-") === 0) { var m = UC.agir(act.slice(3), id); etat.msg = m.message; render(); focus("op-msg"); }
  });
  app.addEventListener("submit", function (e) {
    if (e.target.id === "op-form") { e.preventDefault(); envoyer(); }
    else if (e.target.id === "op-fam-form") { e.preventDefault(); enregistrerFamille(); }
    else if (e.target.id === "op-choix") {
      e.preventDefault(); var v = document.getElementById("op-cherche").value; etat.cherche = v;
      var c = P.trouverParrain(v, CL);
      if (!c) { etat.errChoix = "Client introuvable : saisissez son numéro de client (GS-41…) ou son nom et son prénom, puis choisissez-le dans la liste."; render(); var el = document.getElementById("op-cherche"); if (el) el.focus(); return; }
      etat.errChoix = null; ouvrirPourClient(c.id); render(); focus("t-form");
    }
  });

  var pc = parseInt(params.get("client"), 10);
  if (P.dossier(store(), parseInt(params.get("dossier"), 10))) { etat.vue = "dossier"; etat.dossier = parseInt(params.get("dossier"), 10); }
  else if (pc && ouvrirPourClient(pc)) { /* depuis la fiche client */ }
  render();
  RECH.init(CL, document.getElementById("rech"), document.getElementById("rech-res"), document.getElementById("rech-statut"));
})();
