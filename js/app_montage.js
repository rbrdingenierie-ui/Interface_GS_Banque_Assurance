/* GS Banque & Assurance – montage de prêt : accueil des dossiers, puis quatre étapes (projet et financement, pièces justificatives, analyse de la solvabilité,
   décision et offre), dossier imprimable. Les calculs sont ceux de js/montage.js et js/pret.js ; cette page ne fait que saisir et présenter. */
(function () {
  "use strict";

  var B = window.SGBF.banque, M = window.SGBF.montage, R = window.SGBF.pret, K = window.SGBF.catalogue, ICO = window.SGBF.icones, RECH = window.SGBF.recherche, IMP = window.SGBF.impression, NUM = window.SGBF.numerisation, DP = window.SGBF.documentsPret, CL = window.SGBF.clients, PR = window.SGBF.produits, SU = window.SGBF.santeUI, SAN = window.SGBF.sante;
  var app = document.getElementById("app");
  var esc = B.esc, eur = B.eur2, pct = R.pct, pctTaux = R.pctTaux, libDuree = R.libDuree;
  var CLIENT = {}; CL.forEach(function (c) { CLIENT[c.id] = c; });
  function store() { return B.store.charger(); }
  function sauver() { B.store.sauver(); }
  function nomFull(c) { return c.civ + " " + c.prenom + " " + c.nom.toUpperCase(); }
  function nomListe(c) { return c.nom.toUpperCase() + " " + c.prenom; }
  function nf(x, d) { return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(x); }
  function nomProduit(id) { return PR.parId[id].nom; }
  var PRODUITS = M.PRODUITS, params = new URLSearchParams(location.search);
  var DESC_PRODUIT = {
    CIMMO: "Acheter ou construire la résidence principale : plan de financement, garantie, assurance emprunteur.",
    CCONSO: "Financer un projet sans justificatif d'achat.",
    CAUTO: "Financer l'achat d'un véhicule (bon de commande).",
    CTRAV: "Financer des travaux (devis signé)."
  };
  var DESC_SURETE = {
    scm: "Une société de cautionnement mutuel se porte garante : si le client ne rembourse plus, elle rembourse la banque. Pas d'acte chez le notaire.",
    hyp: "Garantie prise sur le bien financé, devant notaire : si le client ne rembourse plus, la banque peut faire vendre le bien.",
    ppd: "Hypothèque légale du prêteur de deniers, sur le bien acheté, dans l'ancien seulement : moins coûteuse que l'hypothèque.",
    cs: "Un proche s'engage à rembourser si le client ne le fait pas ; il peut demander à la banque de poursuivre d'abord l'emprunteur.",
    csol: "Un proche s'engage au même titre que le client : la banque peut s'adresser directement à lui.",
    aucune: "Pas de garantie : usage courant pour un crédit à la consommation."
  };

  var etat = { client: null, produit: "", q: "", d: null, etape: 1, a: null, montrer: false, err: null, confirmerSuppr: null, msg: "", santeRep: {}, santeOuvert: "" };
  if (CLIENT[params.get("client")]) etat.client = parseInt(params.get("client"), 10);
  if (PRODUITS.indexOf(params.get("produit")) >= 0) etat.produit = params.get("produit");
  function client() { return etat.client ? CLIENT[etat.client] : null; }
  function dossier() { return etat.d; }
  function verrouille() { return !!etat.d && etat.d.statut !== "brouillon"; }
  function evaluer() { var c = CLIENT[etat.d.c]; etat.a = M.evaluer(etat.d, c, store()); return etat.a; }

  /* ---------- chemins de saisie : data-f="plan.bien" ---------- */
  function getPath(o, p) { return p.split(".").reduce(function (x, k) { return x == null ? x : x[k]; }, o); }
  function setPath(o, p, v) { var ks = p.split("."), x = o; for (var i = 0; i < ks.length - 1; i++) x = x[ks[i]]; x[ks[ks.length - 1]] = v; }
  function errFor(champ) { if (!etat.montrer || !etat.a) return ""; var e = etat.a.erreurs.filter(function (x) { return x.champ === champ; })[0]; return e ? e.msg : ""; }
  function champHtml(champ, lib, path, o) {
    o = o || {};
    var id = "mt-" + champ, v = getPath(etat.d, path), e = errFor(champ), dis = verrouille() ? " disabled" : "";
    var attrs = ' data-f="' + path + '"' + (o.struct ? " data-struct" : "") + (o.t ? ' data-t="' + o.t + '"' : "");
    var desc = [o.aide ? id + "-aide" : "", e ? id + "-err" : ""].filter(Boolean).join(" ");
    var ctrl;
    if (o.type === "textarea") ctrl = '<textarea id="' + id + '" rows="' + (o.rows || 4) + '" maxlength="' + (o.max || 1200) + '"' + attrs + (desc ? ' aria-describedby="' + desc + '"' : "") + (e ? ' aria-invalid="true"' : "") + dis + ">" + esc(v == null ? "" : v) + "</textarea>";
    else ctrl = '<input id="' + id + '" type="' + (o.type || "text") + '"' + (o.inputmode ? ' inputmode="' + o.inputmode + '"' : "") + ' autocomplete="off"' + (o.max ? ' maxlength="' + o.max + '"' : "") + (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : "") + attrs + ' value="' + esc(v == null ? "" : v) + '"' + (desc ? ' aria-describedby="' + desc + '"' : "") + (e ? ' aria-invalid="true"' : "") + dis + ">";
    return '<div class="champ' + (o.cls ? " " + o.cls : "") + '" id="ch-' + champ + '"><label for="' + id + '">' + lib + "</label>" + ctrl + (o.aide ? '<span class="aide-champ" id="' + id + '-aide">' + o.aide + "</span>" : "") + '<span class="msg-champ" id="' + id + '-err" role="alert">' + esc(e) + "</span></div>";
  }
  function selectHtml(champ, lib, path, options, o) {
    o = o || {};
    var id = "mt-" + champ, v = getPath(etat.d, path), e = errFor(champ), dis = verrouille() ? " disabled" : "";
    return '<div class="champ" id="ch-' + champ + '"><label for="' + id + '">' + lib + '</label><select id="' + id + '" data-f="' + path + '"' + (o.struct ? " data-struct" : "") + (e ? ' aria-invalid="true" aria-describedby="' + id + '-err"' : "") + dis + ">" +
      options.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (String(v) === String(x[0]) ? " selected" : "") + ">" + esc(x[1]) + "</option>"; }).join("") + '</select><span class="msg-champ" id="' + id + '-err" role="alert">' + esc(e) + "</span></div>";
  }
  /* Place le curseur sur le champ d'une erreur (identifiant de champ du moteur). */
  function focusChamp(champ) {
    var f = document.getElementById("mt-" + champ);
    if (!f && champ === "garantie") f = document.querySelector('input[name="mt-garantie"]:checked') || document.querySelector('input[name="mt-garantie"]');
    if (!f && champ === "avis") f = document.getElementById("mt-avis-favorable");
    if (!f && /^ass-/.test(champ)) { f = document.getElementById("mt-" + champ + "-0"); if (f && f.disabled) f = document.getElementById("mt-souscrite") || document.getElementById("mt-co") || null; }
    if (f) { f.scrollIntoView({ block: "center" }); f.focus(); }
  }
  function lireChamp(t) {
    var p = t.getAttribute("data-f"); if (!p) return false;
    var v;
    if (t.type === "checkbox") v = t.getAttribute("data-t") === "q" ? (t.checked ? 100 : 0) : t.checked;
    else if (t.type === "radio") { if (!t.checked) return false; v = t.value; }
    else v = t.value;
    if (t.getAttribute("data-t") === "n") v = (v.trim() !== "" && isFinite(Number(v))) ? Number(v) : v;
    setPath(etat.d, p, v);
    return true;
  }

  /* ---------- client concerné (accueil) ---------- */
  function clientHtml() {
    var c = client(), h = '<div class="champ cl-q"><label for="cl-q">Rechercher un client (nom, prénom ou numéro)</label><input id="cl-q" type="search" autocomplete="off" maxlength="60" aria-controls="cl-res" value="' + esc(etat.q) + '"></div>' +
      '<ul id="cl-res" class="cl-res" hidden></ul><p id="cl-statut" class="sr" role="status"></p>';
    if (c) h += '<div class="cl-choisi" id="cl-choisi" tabindex="-1"><p><strong>' + esc(nomFull(c)) + "</strong> – " + c.age + " ans – " + esc(c.pro.prof) + " – " + esc(c.num) + '</p><div class="pf-btns"><a class="btn btn-secondaire" href="client.html?id=' + c.id + '">Ouvrir la fiche client</a><button type="button" class="btn-texte" data-act="retirer-client">Retirer ce client</button></div></div>';
    else h += '<p class="vide-bloc cl-aide">Choisissez le client qui demande un crédit.</p>';
    return h;
  }
  function suggestions() {
    var z = document.getElementById("cl-res"), s = document.getElementById("cl-statut"), q = etat.q.trim();
    if (q.length < 2) { z.hidden = true; z.innerHTML = ""; s.textContent = ""; return; }
    var r = RECH.chercher(CL, q, 8);
    z.innerHTML = r.length ? r.map(function (c) { return '<li><button type="button" data-act="choisir-client" data-id="' + c.id + '"><span class="rech-nom">' + esc(nomListe(c)) + '</span><span class="rech-sous">' + c.age + " ans – " + esc(c.pro.prof) + " – " + esc(c.num) + "</span></button></li>"; }).join("") : '<li class="rech-vide">Aucun client trouvé</li>';
    s.textContent = r.length ? r.length + (r.length > 1 ? " résultats" : " résultat") : "Aucun résultat";
    z.hidden = false;
  }
  function produitsHtml() {
    var c = client();
    return '<fieldset class="pr-inconnue"><legend>Quel crédit ?</legend><div class="pr-radios">' + PRODUITS.map(function (id) {
      var v = "";
      if (c) { var ev = K.verdictClient(c, id, store()), cls = { eligible: "chip-ok", examiner: "chip-warn", non: "chip-bad", detenu: "chip-ctrl" }[ev.verdict]; v = ' <span class="chip ' + cls + '">' + esc(ev.libelle) + "</span>"; }
      return '<label class="pr-radio"><input type="radio" name="mt-produit" value="' + id + '"' + (etat.produit === id ? " checked" : "") + '><span><strong>' + esc(nomProduit(id)) + "</strong>" + v + "<small>" + esc(DESC_PRODUIT[id]) + "</small></span></label>";
    }).join("") + "</div></fieldset>";
  }
  function majAccueilClient() { document.getElementById("z-client").innerHTML = clientHtml(); document.getElementById("z-produit").innerHTML = produitsHtml(); }
  var LIB_STATUT = { brouillon: ["En cours", "chip-warn"], accorde: ["Crédit accordé", "chip-ok"], refuse: ["Refusé", "chip-bad"], annule: ["Crédit annulé", "chip-ctrl"] };
  function listeDossiers() {
    var st = store(), L = M.dossiers(st).slice().sort(function (a, b) { return a.maj < b.maj ? 1 : a.maj > b.maj ? -1 : 0; });
    if (!L.length) return '<p class="vide-bloc">Aucun dossier pour l\'instant. Commencez un dossier ci-dessus.</p>';
    return '<div class="tab-wrap tab-defile" role="region" aria-label="Dossiers de montage" tabindex="0"><table class="tab tab-cg bl-tab pr-tab"><caption class="sr">Dossiers de montage</caption><thead><tr><th scope="col" class="gauche">Client</th><th scope="col" class="gauche">Crédit</th><th scope="col" class="gauche">État</th><th scope="col">Mis à jour</th><th scope="col" class="gauche"><span class="sr">Actions</span></th></tr></thead><tbody>' + L.map(function (d) {
      var c = CLIENT[d.c], s = M.statutAffiche(st, d), ls = LIB_STATUT[s];
      var conf = etat.confirmerSuppr === d.id;
      return '<tr><th scope="row" class="gauche">' + esc(nomFull(c)) + '</th><td class="gauche">' + esc(nomProduit(d.p)) + '</td><td class="gauche"><span class="chip ' + ls[1] + '">' + ls[0] + (s === "brouillon" ? " – étape " + d.etape : "") + "</span></td><td>" + B.fmtDate(B.lireYmd(d.maj)) + '</td><td class="gauche mt-actions"><a class="btn-texte" href="montage.html?dossier=' + d.id + '">Ouvrir</a>' +
        (s === "accorde" ? "" : conf ? ' <span class="mt-conf">Supprimer ce dossier ? <button type="button" class="btn-texte mt-danger" data-act="suppr-oui" data-id="' + d.id + '">Oui, supprimer</button> <button type="button" class="btn-texte" data-act="suppr-non">Non</button></span>' : ' <button type="button" class="btn-texte" data-act="suppr" data-id="' + d.id + '">Supprimer</button>') + "</td></tr>";
    }).join("") + "</tbody></table></div>";
  }
  function vueAccueil() {
    app.innerHTML = '<nav class="fil-ariane" aria-label="Fil d\'Ariane"><a href="index.html">' + ICO.retour + "Accueil</a><span aria-hidden=\"true\">/</span><span>Montage de prêt</span></nav>" +
      '<div class="page-titre"><h1>Montage de prêt</h1><p>Constituer le dossier de crédit d\'un client : projet et financement, pièces justificatives, solvabilité, décision et offre</p></div>' +
      '<div class="pr-grille mt-debut"><section class="bloc" aria-labelledby="mt-t-client"><div class="bloc-tete"><h2 id="mt-t-client">1. Le client</h2></div><div id="z-client">' + clientHtml() + '</div></section>' +
      '<section class="bloc" aria-labelledby="mt-t-prod"><div class="bloc-tete"><h2 id="mt-t-prod">2. Le crédit</h2></div><div id="z-produit">' + produitsHtml() + '</div><p class="msg-erreur" id="mt-err-debut" role="alert">' + esc(etat.err || "") + '</p><div class="pf-btns"><button type="button" class="btn btn-principal" id="mt-commencer" data-act="commencer">Commencer le dossier</button></div></section></div>' +
      '<section class="bloc" aria-labelledby="mt-t-liste" style="margin-top:16px"><div class="bloc-tete"><h2 id="mt-t-liste">Mes dossiers</h2></div><div id="z-liste">' + listeDossiers() + "</div></section>" +
      '<p class="mention" style="margin-top:16px">Exercice : les dossiers sont enregistrés dans ce navigateur. Un crédit accordé est enregistré comme souscription du client (fiche client, « Mes souscriptions » du catalogue et bilan). Les tarifs de la banque (garanties, assurance emprunteur) sont fictifs ; les règles de calcul (TAEG, TAEA, quotités, délais) sont celles de la réglementation.</p>';
  }

  /* ---------- en-tête du dossier et navigation entre les étapes ---------- */
  function statutChip() { var s = M.statutAffiche(store(), etat.d), ls = LIB_STATUT[s]; return '<span class="chip ' + ls[1] + '" id="mt-statut">' + ls[0] + "</span>"; }
  function verrouHtml() {
    if (!verrouille()) return "";
    if (M.statutAffiche(store(), etat.d) === "annule") return '<p class="mt-verrou" role="status">La souscription de ce crédit a été annulée dans le catalogue (Mes souscriptions) : le dossier est en lecture seule. <button type="button" class="btn-texte" data-act="rouvrir">Rouvrir le dossier pour une nouvelle décision</button></p>';
    return '<p class="mt-verrou" role="status">Ce dossier est clôturé : les données sont en lecture seule.</p>';
  }
  function vueDossier() {
    var d = etat.d, c = CLIENT[d.c];
    evaluer();
    app.innerHTML = '<nav class="fil-ariane" aria-label="Fil d\'Ariane"><a href="index.html">' + ICO.retour + 'Accueil</a><span aria-hidden="true">/</span><a href="montage.html">Montage de prêt</a><span aria-hidden="true">/</span><span>' + esc(nomFull(c)) + "</span></nav>" +
      '<div class="page-titre"><h1>Montage de prêt</h1><p><strong>' + esc(nomFull(c)) + "</strong> – " + esc(nomProduit(d.p)) + " – " + statutChip() + ' <a class="btn-texte" href="client.html?id=' + c.id + '">Fiche client</a></p></div>' +
      '<nav class="mt-etapes" aria-label="Étapes du dossier"><ol>' + M.ETAPES.map(function (e) {
        var cls = e.n === etat.etape ? "mt-courante" : "";
        return '<li class="' + cls + '"><button type="button" data-act="etape" data-n="' + e.n + '"' + (e.n === etat.etape ? ' aria-current="step"' : "") + '><span class="mt-num">' + e.n + '</span><span class="mt-lib">' + esc(e.lib) + "</span></button></li>";
      }).join("") + "</ol></nav>" +
      '<div id="z-verrou">' + verrouHtml() + '</div><div id="z-etape"></div>';
    renderEtape();
  }
  function renderEtape(focusId) {
    evaluer();
    var z = document.getElementById("z-etape");
    z.innerHTML = [vueEtape1, vueEtape2, vueEtape3, vueEtape4][etat.etape - 1]();
    document.querySelectorAll(".mt-etapes li").forEach(function (li, i) { li.className = i + 1 === etat.etape ? "mt-courante" : ""; var b = li.querySelector("button"); if (i + 1 === etat.etape) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current"); });
    var f = focusId && document.getElementById(focusId); if (f) f.focus();
  }
  function allerEtape(n, focus) {
    etat.etape = n; etat.err = null; etat.d.etape = Math.max(etat.d.etape || 1, n);
    if (!verrouille()) { M.enregistrer(store(), etat.d); sauver(); }
    renderEtape();
    if (focus !== false) { var h = document.getElementById("mt-h-etape"); if (h) { h.scrollIntoView({ block: "start" }); h.focus(); } }
  }
  function boutonsBas(n) {
    return '<div class="mt-bas">' + (n > 1 ? '<button type="button" class="btn btn-secondaire" data-act="etape" data-n="' + (n - 1) + '">Étape précédente</button>' : "<span></span>") +
      '<span class="mt-bas-droite">' + (verrouille() ? "" : '<button type="button" class="btn-texte" data-act="enregistrer">Enregistrer le brouillon</button>') + (n < 4 ? '<button type="button" class="btn btn-principal" data-act="suivant" data-n="' + (n + 1) + '">Étape suivante</button>' : "") + "</span></div>";
  }

  /* ---------- étape 1 : projet et financement ---------- */
  var QUOTITES = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  function m0(x) { return x % 1 === 0 ? B.eur(x) : eur(x); }
  /* Cas particuliers du prêt immobilier : chacun ajoute à l'étape 2 la rubrique correspondante du document « Documents à fournir… » (js/documents_pret.js). */
  function optionsImmo() {
    var d = etat.d, dis = verrouille() ? " disabled" : "";
    function opt(k, lib) {
      var r = DP.RUBRIQUE_PAR_ID[k];
      return '<label class="mt-case"><input type="checkbox" id="mt-' + k + '" data-f="' + k + '"' + (d[k] ? " checked" : "") + dis + '><span><strong>' + esc(lib) + '</strong><small class="mt-sous">Pièces ajoutées à l\'étape 2 : ' + r.pieces.map(function (x) { return esc(DP.texte(x)); }).join(" ; ") + ".</small></span></label>";
    }
    return '<fieldset class="pr-inconnue mt-options" id="ch-options"><legend>Le projet comprend aussi (facultatif)</legend>' + opt("rachat", "Un rachat de créance") + opt("ptz", "Un prêt à taux zéro") + opt("relais", "Un prêt relais") + "</fieldset>";
  }
  function bloc1Projet() {
    var d = etat.d, cimmo = d.p === "CIMMO", h = '<section class="bloc" aria-labelledby="mt-t-projet"><div class="bloc-tete"><h2 id="mt-t-projet">Le projet</h2></div>';
    if (cimmo) {
      h += selectHtml("objet", "Objet du financement *", "objet", Object.keys(M.OBJETS).map(function (k) { return [k, M.OBJETS[k]]; }), { struct: true });
      h += champHtml("libelle", "Bien financé (adresse, surface, caractéristiques) *", "libelle", { max: 200, aide: "Exemple : appartement de 26,6 m² avec jardin et parking, Noisy-le-Grand (93160)." });
      if (d.objet !== "construction") {
        var nom = d.objet === "neuf" ? "du contrat de réservation" : "du compromis de vente";
        h += '<div class="mt-dates">' + champHtml("compromis", "Date de signature " + nom + " *", "compromis", { type: "date" }) + champHtml("condSusp", "Date limite d'obtention du prêt *", "condSusp", { type: "date", aide: "Condition suspensive d'obtention du prêt." }) + champHtml("reiteration", "Date de signature de l'acte authentique *", "reiteration", { type: "date", aide: "Signature chez le notaire." }) + "</div>";
      }
      h += champHtml("notaire", "Notaire (facultatif)", "notaire", { max: 80 });
      h += optionsImmo();
    } else {
      h += champHtml("libelle", d.p === "CAUTO" ? "Véhicule financé *" : d.p === "CTRAV" ? "Nature des travaux *" : "Objet du crédit *", "libelle", { max: 200, aide: d.p === "CAUTO" ? "Marque, modèle, neuf ou occasion. Exemple : Citroën C3, neuve." : d.p === "CTRAV" ? "Exemple : remplacement des fenêtres et isolation des combles." : "Exemple : voyage, mariage, équipement." });
    }
    return h + "</section>";
  }
  function ligneSaisie(l) {
    var champ = "plan-" + l.k, id = "mt-" + champ, e = errFor(champ), v = etat.d.plan[l.k], dis = verrouille() ? " disabled" : "";
    return '<div class="mt-pf-ligne"><label for="' + id + '">' + esc(l.lib) + (l.req ? " *" : "") + '</label><input id="' + id + '" type="text" inputmode="decimal" autocomplete="off" data-f="plan.' + l.k + '" value="' + esc(v) + '"' + (e ? ' aria-invalid="true" aria-describedby="' + id + '-err"' : "") + dis + '><span class="mt-eur" aria-hidden="true">€</span><span class="msg-champ" id="' + id + '-err" role="alert">' + esc(e) + "</span></div>";
  }
  function bloc1Plan() {
    var d = etat.d, a = etat.a, L = M.LIGNES[d.p], cimmo = d.p === "CIMMO", plan = a.plan, h = '<section class="bloc" aria-labelledby="mt-t-plan"><div class="bloc-tete"><h2 id="mt-t-plan">Plan de financement</h2></div>';
    h += '<div class="mt-pf"><div class="mt-pf-col"><h3 class="sous-titre">Projet (dépenses)</h3>' + L.map(function (l) {
      if (l.auto === "dossier") return '<div class="mt-pf-ligne mt-pf-auto"><span>' + esc(l.lib) + '</span><output id="mt-pf-dossier">' + (plan ? m0(plan.fraisDossier) : "–") + "</output></div>";
      if (l.auto === "garantie") return '<div class="mt-pf-ligne mt-pf-auto"><span>' + esc(l.lib) + '</span><output id="mt-pf-garantie">' + (plan ? m0(plan.fraisGarantie) : "–") + "</output></div>";
      return ligneSaisie(l);
    }).join("") + '<div class="mt-pf-ligne mt-pf-total"><span>Total des dépenses</span><output id="mt-pf-emplois">' + (plan ? m0(plan.emplois) : "–") + "</output></div></div>";
    h += '<div class="mt-pf-col"><h3 class="sous-titre">Financement (ressources)</h3>' + ligneSaisie({ k: "apport", lib: "Apport personnel" }) +
      '<div class="mt-pf-ligne mt-pf-auto"><span>Prêt (calculé)</span><output id="mt-pf-pret">' + (plan ? m0(plan.pret) : "–") + '</output></div><div class="mt-pf-ligne mt-pf-total"><span>Total des ressources</span><output id="mt-pf-ressources">' + (plan ? m0(plan.ressources) : "–") + "</output></div>" +
      '<p class="mt-pf-eq" id="mt-pf-eq" role="status">' + (plan ? "Le plan est équilibré : dépenses et ressources sont égales." : "Saisissez les montants pour calculer le prêt.") + "</p></div></div>";
    if (cimmo) {
      var pn = d.objet === "neuf" ? M.FRAIS_NOTAIRE.neuf : M.FRAIS_NOTAIRE.ancien;
      h += '<p class="mention">Les frais de dossier (' + B.eur(R.produitPret("CIMMO").fraisDossier) + ") et les frais de garantie sont ajoutés automatiquement : le prêt les finance. " +
        (d.objet === "construction" ? "" : "Frais de notaire : environ " + (d.objet === "neuf" ? "2 à 3 %" : "7 à 8 %") + " du prix (ordre de grandeur) ; saisissez le montant exact.") +
        (d.objet === "construction" || verrouille() ? "" : ' <button type="button" class="btn-texte" data-act="estimer-notaire">Estimer à ' + nf(pn, 1) + " % du prix</button>") + "</p>";
    }
    return h + "</section>";
  }
  function bloc1Pret() {
    var d = etat.d, a = etat.a, p = R.produitPret(d.p), n = Number(d.dureeMois), tc = a.tauxCatalogue;
    var h = '<section class="bloc" aria-labelledby="mt-t-pret"><div class="bloc-tete"><h2 id="mt-t-pret">Le prêt</h2></div>';
    h += champHtml("duree", "Durée (en mois) *", "dureeMois", { inputmode: "numeric", t: "n", aide: '<span id="mt-duree-txt">' + dureeTxt(n) + "</span> ; de " + libDuree(p.dureeMin) + " à " + libDuree(p.dureeMax) + " pour ce crédit." });
    h += champHtml("taux", "Taux nominal annuel proposé (%)", "taux", { inputmode: "decimal", placeholder: tc ? nf(tc.taux, Math.abs(tc.taux * 100 - Math.round(tc.taux * 100)) < 1e-9 ? 2 : 3) : "", aide: '<span id="mt-taux-txt">' + tauxTxt() + "</span>" });
    return h + "</section>";
  }
  function dureeTxt(n) { return n >= 1 && n === Math.round(n) ? "soit " + libDuree(n) : "durée à saisir en nombre entier de mois"; }
  function tauxTxt() {
    var tc = etat.a && etat.a.tauxCatalogue;
    if (!tc) return "Le taux dépend de la durée.";
    return (R.produitPret(etat.d.p).nature === "taeg" ? "Taux du catalogue : " + pctTaux(tc.taux) + " (TAEG « à partir de » " + pct(tc.taeg) + ", hors assurance)" : "Taux du catalogue pour cette durée : " + pctTaux(tc.taux) + " (" + tc.lib + ", hors assurance)") + ". Laissez vide pour appliquer ce taux ; vous pouvez l'augmenter, pas le diminuer.";
  }
  function bloc1Garantie() {
    var d = etat.d, a = etat.a, liste = M.suretesPossibles(d.p, d.objet), dis = verrouille() ? " disabled" : "";
    var h = '<section class="bloc" aria-labelledby="mt-t-gar"><div class="bloc-tete"><h2 id="mt-t-gar">Garantie du prêt</h2></div><fieldset class="pr-inconnue" id="ch-garantie"><legend class="sr">Garantie du prêt</legend><div class="pr-radios">' + liste.map(function (id) {
      var s = M.SURETES[id];
      return '<label class="pr-radio"><input type="radio" name="mt-garantie" id="mt-garantie-' + id + '" data-f="garantie" data-struct value="' + id + '"' + (d.garantie === id ? " checked" : "") + dis + '><span><strong>' + esc(s.lib) + "</strong>" + (s.taux ? " – environ " + nf(s.taux, 2) + " % du prêt" : " – sans frais") + "<small>" + esc(DESC_SURETE[id]) + "</small></span></label>";
    }).join("") + "</div></fieldset>";
    var s = M.SURETES[d.garantie];
    if (s && s.couvre === "engagement") h += champHtml("engagement", "Montant garanti par la caution (€) *", "engagement", { inputmode: "decimal", aide: "Le montant pour lequel la caution s'engage ; au plus le montant du prêt." });
    h += '<p class="mention" id="mt-gar-txt">' + garantieTxt() + "</p>";
    return h + "</section>";
  }
  function garantieTxt() {
    var g = etat.a && etat.a.garantie, plan = etat.a && etat.a.plan; if (!g || !plan) return "";
    return "Frais de garantie : " + eur(g.frais) + (g.tauxFrais ? " (" + nf(g.tauxFrais, 2) + " % du prêt, financés par le prêt)" : "") + ". Risque nominal : " + eur(g.nominal) + " ; risque résiduel (part du prêt non couverte par la garantie) : " + eur(g.residuel) + ".";
  }
  function bloc1Assurance() {
    var d = etat.d, a = etat.a, cimmo = d.p === "CIMMO", c = CLIENT[d.c], cj = M.conjoint(c), co = !!(d.co && cj), P = M.personnes(d, c), dis = verrouille() ? " disabled" : "";
    var h = '<section class="bloc" aria-labelledby="mt-t-ass"><div class="bloc-tete"><h2 id="mt-t-ass">Assurance emprunteur</h2></div>';
    if (!cimmo) h += '<label class="mt-case"><input type="checkbox" id="mt-souscrite" data-f="assurance.souscrite" data-struct' + (d.assurance.souscrite ? " checked" : "") + dis + '> Le client souscrit l\'assurance emprunteur (facultative pour ce crédit)</label>';
    else h += '<p class="mention" style="margin-top:0">L\'assurance emprunteur est exigée en pratique pour un prêt immobilier : les garanties décès et PTIA sont obligatoires.</p>';
    if (cj) h += '<label class="mt-case"><input type="checkbox" id="mt-co" data-f="co" data-struct' + (d.co ? " checked" : "") + dis + '> Co-emprunteur : ' + esc(M.personnes({ co: true }, c)[1].nom) + "</label>";
    if (cimmo || d.assurance.souscrite) {
      var seul = P.length === 1, rows = M.ROWS_ASS;
      h += '<div class="tab-wrap tab-defile" role="region" aria-label="Garanties et quotités" tabindex="0"><table class="tab mt-tab-ass"><caption class="sr">Garanties de l\'assurance emprunteur et quotité de chaque emprunteur</caption><thead><tr><th scope="col" class="gauche">Garantie</th>' + P.map(function (p, i) { return '<th scope="col">' + (seul ? "Garantie choisie" : "Quotité – " + esc(p.role.toLowerCase())) + (seul ? "" : '<small class="mt-sous">' + esc(p.nom.split(" (")[0].replace(/^(Mme|M\.) /, "")) + ", " + p.age + ' ans</small>') + "</th>"; }).join("") + '<th scope="col">Cotisation par mois</th></tr></thead><tbody>';
      rows.forEach(function (r) {
        var err = errFor("ass-" + r.k), ligne = a.assurance && a.assurance.lignes.filter(function (x) { return x.k === r.k; })[0];
        h += '<tr><th scope="row" class="gauche">' + esc(r.lib) + '<small class="mt-sous">' + esc(r.detail) + "</small>" + (err ? '<span class="msg-champ" role="alert">' + esc(err) + "</span>" : "") + "</th>";
        P.forEach(function (p, i) {
          var q = (d.assurance.q[r.k] || [0, 0])[i] || 0, id = "mt-ass-" + r.k + "-" + i, ok = r.k !== "pe" || M.perteEmploiPossible(p), tarif = nf(M.tauxAssurance(r.k, p.age), 2);
          if (seul) h += "<td>" + '<label class="mt-case mt-case-ass"><input type="checkbox" id="' + id + '" data-f="assurance.q.' + r.k + '.0" data-t="q"' + (q > 0 ? " checked" : "") + (r.k === "socle" || !ok || verrouille() ? " disabled" : "") + '><span>' + (r.k === "socle" ? "Obligatoire" : ok ? "Oui" : "Non assurable") + "</span></label>" + '<small class="mt-sous">' + tarif + " % par an</small></td>";
          else h += "<td>" + (ok ? '<label class="sr" for="' + id + '">Quotité ' + esc(r.lib) + " – " + esc(p.role) + '</label><select id="' + id + '" data-f="assurance.q.' + r.k + "." + i + '" data-t="n"' + dis + ">" + QUOTITES.map(function (x) { return '<option value="' + x + '"' + (q === x ? " selected" : "") + ">" + x + " %</option>"; }).join("") + '</select><small class="mt-sous">' + tarif + " % par an à 100 %</small>" : '<span class="mt-sous">Non assurable (réservée aux salariés en CDI)</span>') + "</td>";
        });
        h += '<td class="mt-prime"><output data-prime="' + r.k + '">' + (ligne && ligne.couverte ? eur(ligne.mensuel) : "–") + "</output></td></tr>";
      });
      h += '</tbody><tfoot><tr><th scope="row" class="gauche" colspan="' + (P.length + 1) + '">Cotisation mensuelle totale</th><td class="mt-prime"><output id="mt-prime-total">' + (a.assurance ? eur(a.assurance.mensuel) : "–") + "</output></td></tr></tfoot></table></div>";
      h += '<p class="mention" id="mt-ass-txt">' + assuranceTxt() + "</p>";
    } else h += '<p class="mention" id="mt-ass-txt">Sans assurance, le client supporte seul le risque : en cas de décès ou d\'invalidité, les mensualités restent dues.</p>';
    return h + "</section>";
  }
  function assuranceTxt() {
    var a = etat.a, as = a && a.assurance; if (!as || !as.souscrite) return "";
    var t = "Cotisation constante, calculée sur le capital initial, au prorata de la quotité (tarif de la banque selon l'âge). Taux d'assurance : " + nf(as.tauxAnnuel, 3) + " % du capital par an. La quotité est la part du prêt assurée : un emprunteur seul est assuré à 100 % ; avec un co-emprunteur, le total doit atteindre au moins 100 % pour chaque garantie choisie (100 % + 100 % protège davantage, mais coûte plus cher).";
    if (as.avertissements.length) t += " Attention : " + as.avertissements.join(" ");
    return esc(t);
  }
  function kpi(lib, val, det) { return '<div class="kpi"><dt>' + esc(lib) + '</dt><dd class="val">' + val + "</dd>" + (det ? '<dd class="det">' + det + "</dd>" : "") + "</div>"; }
  function syntheseHtml() {
    var a = etat.a, h = '<h2 id="mt-t-syn" tabindex="-1">Synthèse du financement</h2>';
    if (etat.montrer && a.erreurs.length) h += '<div class="mt-erreurs" role="alert"><p><strong>À compléter ou corriger avant l\'étape suivante :</strong></p><ul>' + a.erreurs.map(function (e) { return '<li><button type="button" class="btn-texte" data-act="aller-champ" data-champ="' + esc(e.champ) + '">' + esc(e.msg) + "</button></li>"; }).join("") + "</ul></div>";
    if (!a.pret) return h + '<p class="vide-bloc">Renseignez le plan de financement, la durée et l\'assurance pour voir le prêt, la mensualité, le TAEG et le TAEA.</p>';
    var p = a.pret, c = a.couts, as = a.assurance;
    h += '<dl class="kpis mt-kpis">' + kpi("Prêt", esc(eur(p.capital)), esc(libDuree(p.dureeMois)) + " au taux de " + esc(pctTaux(p.taux))) + kpi("Mensualité hors assurance", esc(eur(p.mensualite)), p.derniere !== p.mensualite ? "dernière : " + esc(eur(p.derniere)) : "") +
      kpi("Assurance par mois", as.souscrite ? esc(eur(c.prime)) : "Aucune", as.souscrite ? nf(as.tauxAnnuel, 3) + " % du capital par an" : "") + kpi("Mensualité assurance comprise", esc(eur(c.mensualiteAC)), "") +
      kpi("TAEG", esc(pct(c.taeg)), c.taegObligatoire ? "assurance et frais compris" : "frais compris, assurance facultative non comprise") + kpi("TAEA", c.taea === null ? "Sans objet" : esc(pct(c.taea)), c.taea === null ? "pas d'assurance" : "coût de l'assurance : TAEG avec − TAEG sans") +
      kpi("Coût total du crédit", esc(eur(c.coutTotal)), c.taegObligatoire ? "intérêts, frais et assurance" : "intérêts et frais") + kpi("Frais de garantie", esc(eur(c.fraisGarantie)), esc(a.garantie.lib)) + "</dl>";
    var us = c.usure;
    h += '<p class="mt-usure ' + (us.depasse ? "mt-usure-bad" : "") + '">Taux d\'usure (' + esc(us.trimestre) + ", " + esc(us.lib) + ") : " + esc(pct(us.taux)) + ". TAEG de l'offre : " + esc(pct(us.taeg2)) + (us.depasse ? " – au-dessus du seuil : l'offre serait refusée." : " – sous le seuil.") + "</p>";
    return h;
  }
  function majDerives1() {
    var a = etat.a; if (!a) return;
    function set(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }
    var plan = a.plan;
    set("mt-pf-dossier", plan ? m0(plan.fraisDossier) : "–"); set("mt-pf-garantie", plan ? m0(plan.fraisGarantie) : "–"); set("mt-pf-emplois", plan ? m0(plan.emplois) : "–"); set("mt-pf-pret", plan ? m0(plan.pret) : "–"); set("mt-pf-ressources", plan ? m0(plan.ressources) : "–");
    set("mt-pf-eq", plan ? "Le plan est équilibré : dépenses et ressources sont égales." : "Saisissez les montants pour calculer le prêt.");
    set("mt-duree-txt", dureeTxt(Number(etat.d.dureeMois))); set("mt-taux-txt", tauxTxt());
    var g = document.getElementById("mt-gar-txt"); if (g) g.textContent = garantieTxt();
    var at = document.getElementById("mt-ass-txt"); if (at && etat.d.p && (etat.d.p === "CIMMO" || etat.d.assurance.souscrite)) at.innerHTML = assuranceTxt();
    set("mt-prime-total", a.assurance ? eur(a.assurance.mensuel) : "–");
    document.querySelectorAll("[data-prime]").forEach(function (o) { var l = a.assurance && a.assurance.lignes.filter(function (x) { return x.k === o.getAttribute("data-prime"); })[0]; o.textContent = l && l.couverte ? eur(l.mensuel) : "–"; });
    document.getElementById("z-synthese").innerHTML = syntheseHtml();
    /* messages d'erreur des champs (après un clic sur « Étape suivante ») */
    if (etat.montrer) document.querySelectorAll("#mt-form [id$='-err']").forEach(function (o) {
      var id = o.id.replace(/-err$/, ""), champ = id.replace(/^mt-/, ""), m = errFor(champ), f = document.getElementById(id);
      o.textContent = m; if (f) { if (m) f.setAttribute("aria-invalid", "true"); else f.removeAttribute("aria-invalid"); }
    });
  }
  function vueEtape1() {
    return '<h2 class="mt-h-etape" id="mt-h-etape" tabindex="-1">Étape 1 – Projet et financement</h2><div class="mt-grille"><form id="mt-form" class="formulaire mt-form" novalidate>' + bloc1Projet() + bloc1Plan() + bloc1Pret() + bloc1Garantie() + bloc1Assurance() + '</form><aside class="bloc mt-synthese" id="z-synthese" aria-labelledby="mt-t-syn">' + syntheseHtml() + "</aside></div>" + boutonsBas(1);
  }

  /* ---------- étape 2 : pièces justificatives ---------- */
  function libPiece(x) {
    var h = x.seg ? x.seg.map(function (m) { return m[1] ? "<strong>" + esc(m[0]) + "</strong>" : esc(m[0]); }).join("") : esc(x.lib);
    return x.cond ? h + ' <span class="mt-cond">(si concerné)</span>' : h;
  }
  /* Le document à faire signer au client (même texte que « Courriers et documents »), imprimable ou enregistrable en PDF. */
  function docPret() {
    var c = CLIENT[etat.d.c], id = etat.a && etat.a.pieces && etat.a.pieces.doc === "conso" ? "conso" : "immo", dc = DP.documentPour(id, c, B.aujourdhui(), DP.autresDe(store(), DP.cleClient(c), id));
    IMP.imprimer(IMP.document({ titre: dc.titre, sous: dc.sous, corps: dc.corps, courrier: false }), dc.fichier);
  }
  /* Toutes les pièces se numérisent. Les interrogations de fichiers (FICP, FCC) ne sont pas remises par le client : le conseiller les fait dans « Interro BDF », imprime la réponse
     et la numérise comme les autres pièces (copie versée au dossier). */
  function estInterro(x) { return x.id === "ficp" || x.id === "fcc"; }
  function numerisable() { return true; }
  function precisionPiece(x) { return estInterro(x) ? "interrogation faite aujourd'hui" : undefined; }
  function lienInterro(x) {
    return estInterro(x) ? '<a class="btn-texte mt-lien-bdf" href="interro_bdf.html?client=' + encodeURIComponent(etat.d.c) + "&amp;fichier=" + x.id + '">Interroger le ' + (x.id === "ficp" ? "FICP" : "FCC") + "<span class=\"sr\"> dans Interro BDF</span></a>" : "";
  }
  function zoneScan(x, g, dis) {
    if (!NUM || !numerisable(x)) return "";
    var doc = etat.d.scans && etat.d.scans[x.id];
    if (dis && !doc) return "";
    var z = NUM.bouton(x.id, x.lib, doc, dis), lien = dis ? "" : lienInterro(x);
    return lien && z ? z.replace('<div class="num-zone">', '<div class="num-zone">' + lien) : z;
  }
  function pieceParId(id) {
    var r = null; if (etat.a && etat.a.pieces) etat.a.pieces.groupes.forEach(function (g) { g.items.forEach(function (x) { if (x.id === id) r = x; }); });
    return r;
  }
  function numeriser(b) {
    if (!NUM || !etat.d || verrouille()) return;
    var id = b.getAttribute("data-id"), x = pieceParId(id); if (!x || !numerisable(x)) return;
    if (!etat.d.scans) etat.d.scans = {};
    NUM.ouvrir({
      piece: x.lib, precision: precisionPiece(x), doc: etat.d.scans[id] || null, ouvreur: b, focusId: "num-" + id,
      apres: function (doc) { etat.d.scans[id] = doc; etat.d.pieces[id] = true; sauverBrouillon(); renderEtape("num-" + id); },
      retirer: function () { delete etat.d.scans[id]; sauverBrouillon(); renderEtape("num-" + id); }
    });
  }
  /* ---------- questionnaire de santé de l'emprunteur (étape 2) : le dossier garde la décision de l'assureur, jamais les réponses ---------- */
  function ligneSante(x) {
    var s = x.sante, dc = s.decision, dis = verrouille(), id = x.id, ouvert = etat.santeOuvert === id && !dis, etatH, actions = "";
    if (!dc) etatH = '<p><span class="chip chip-ctrl">À remplir</span> Le client répond au questionnaire de santé ; l\'assureur donne sa décision.</p>';
    else if (dc.obsolete) etatH = '<p><span class="chip chip-warn">À refaire</span> Le capital assuré ou la durée a changé depuis le questionnaire du ' + esc(B.fmtDate(B.lireYmd(dc.date))) + " : la décision de l'assureur n'est plus valable.</p>";
    else etatH = '<p><span class="chip ' + (dc.verdict === "accepte" ? "chip-ok" : dc.verdict === "etude" ? "chip-warn" : "chip-bad") + '">' + esc(SAN.libelle(dc.verdict)) + "</span> Décision de l'assureur du " + esc(B.fmtDate(B.lireYmd(dc.date))) + " : " + esc(SAN.phrase("EMPRUNTEUR", dc.verdict)) + "</p>";
    if (!dis && !ouvert) actions = '<div class="mt-sante-actions"><button type="button" class="btn btn-secondaire" id="mt-sq-' + esc(id) + '-b" data-act="sante-ouvrir" data-id="' + esc(id) + '">' + (dc ? "Refaire le questionnaire de santé" : "Remplir le questionnaire de santé") + "</button></div>";
    var form = "";
    if (ouvert) {
      if (!etat.santeRep[id]) etat.santeRep[id] = {};
      form = '<div class="mt-sante-form">' + SU.html("sq-" + id, "EMPRUNTEUR", etat.santeRep[id], { note: SAN.CONFIDENTIEL_EMPRUNTEUR, ctx: { aeras: s.aeras } }) +
        '<p class="msg-erreur" id="sq-' + esc(id) + '-err" role="alert"></p><div class="mt-sante-actions" style="margin-left:0"><button type="button" class="btn btn-principal" data-act="sante-valider" data-id="' + esc(id) + '">Valider le questionnaire</button><button type="button" class="btn-texte" data-act="sante-annuler" data-id="' + esc(id) + '">Annuler</button></div></div>';
    }
    return '<li class="mt-li-sante"><div class="mt-sante-ligne"><span class="mt-sante-lib">' + esc(x.lib) + '</span></div><div class="mt-sante-etat">' + etatH + "</div>" + actions + form + "</li>";
  }
  function santeSaisie(t) {
    if (!SU) return false;
    var pre = SU.prefixe(t); if (!pre || pre.indexOf("sq-") !== 0) return false;
    var id = pre.slice(3), x = pieceParId(id); if (!x || !x.sante) return false;
    if (!etat.santeRep[id]) etat.santeRep[id] = {};
    if (!SU.saisir(etat.santeRep[id], t)) return false;
    SU.maj(pre, "EMPRUNTEUR", etat.santeRep[id], { ctx: { aeras: x.sante.aeras } });
    var ze = document.getElementById("sq-" + id + "-err"); if (ze) ze.textContent = "";   /* le message de la validation précédente n'a plus lieu d'être */
    return true;
  }
  function santeAgir(act, id) {
    if (verrouille()) return;
    if (act === "sante-ouvrir") { M.effacerSante(etat.d, id); sauverBrouillon(); etat.santeRep[id] = {}; etat.santeOuvert = id; renderEtape("sq-" + id + "-t"); }
    else if (act === "sante-annuler") { delete etat.santeRep[id]; etat.santeOuvert = ""; renderEtape("mt-sq-" + id + "-b"); }
    else if (act === "sante-valider") {
      var r = M.questionnaireSante(etat.d, etat.a, id, etat.santeRep[id] || {});
      if (!r.ok) { var z = document.getElementById("sq-" + id + "-err"); if (z) z.textContent = r.erreur; var t = document.getElementById("sq-" + id + "-t"); if (t) t.focus(); return; }
      delete etat.santeRep[id]; etat.santeOuvert = ""; sauverBrouillon(); renderEtape("mt-sq-" + id + "-b");
    }
  }
  function vueEtape2() {
    var a = etat.a, P = a.pieces, dis = verrouille() ? " disabled" : "", cimmo = etat.d.p === "CIMMO", doc = P.doc, consoHorsCDI = !doc && etat.d.p !== "CIMMO";
    var h = '<h2 class="mt-h-etape" id="mt-h-etape" tabindex="-1">Étape 2 – Pièces justificatives</h2><section class="bloc" aria-labelledby="mt-t-pieces"><div class="bloc-tete"><h2 id="mt-t-pieces">Pièces à réunir</h2><span class="mt-compte" id="mt-compte" role="status">' + compteTxt(P) + '</span></div>';
    h += '<p class="mention" style="margin-top:0">Pour chaque pièce remise par le client, utilisez le bouton « Scanner ou importer un document » : vous vérifiez la pièce (lisible, à jour, au nom du client) et elle est cochée automatiquement. Vous pouvez aussi la cocher à la main. Le dossier ne peut pas être accordé tant que toutes les pièces ne sont pas cochées' + (doc ? ", à l'exception de celles marquées « si concerné »" : "") + ". La liste dépend du crédit, de la situation professionnelle et familiale du client" + (cimmo ? ", des cas particuliers du projet (étape 1)" : "") + " et de l'assurance choisie. Le questionnaire de santé se remplit dans l'outil (bouton « Remplir le questionnaire de santé ») : la pièce est reçue quand l'assureur accepte. Les interrogations du FICP et du FCC se font dans « Interro BDF » : imprimez la réponse, puis numérisez-la comme les autres pièces.</p>";
    if (doc) h += '<p class="mention mt-doc-pret"><span>Cette liste reprend le document « ' + esc((doc === "conso" ? DP.CONSO.TITRE : DP.TITRE).replace(/ \*$/, "")) + " » que le client date et signe : les pièces en <strong>gras</strong> sont indispensables à l'évaluation de sa solvabilité.</span>" +
      '<button type="button" class="btn btn-secondaire btn-impr" data-act="doc-pret">' + ICO.imprimante + "<span>Imprimer le document à faire signer</span></button></p>";
    if (consoHorsCDI) h += '<p class="mention mt-doc-info">Le document « ' + esc(DP.CONSO.TITRE.replace(/ \*$/, "")) + " » ne traite que le salarié en CDI : la liste ci-dessous est adaptée à la situation professionnelle du client.</p>";
    if (!a.etape1Ok) h += '<p class="pr-perime-msg" role="status">L\'étape 1 n\'est pas terminée : la liste peut encore changer (apport, assurance, co-emprunteur). <button type="button" class="btn-texte" data-act="etape" data-n="1">Retourner à l\'étape 1</button></p>';
    h += '<div class="mt-fs">' + P.groupes.map(function (g, gi) {
      return '<div class="mt-piece-groupe"><h3 class="sous-titre">' + esc(g.lib) + '</h3><ul class="mt-pieces">' + g.items.map(function (x) {
        if (x.sante && SU) return ligneSante(x);
        return '<li' + (g.autres ? ' class="mt-li-autre"' : "") + '><label class="mt-case"><input type="checkbox" id="mt-p-' + esc(x.id) + '" data-f="pieces.' + esc(x.id) + '"' + (etat.d.pieces[x.id] ? " checked" : "") + dis + "><span>" + libPiece(x) + "</span></label>" +
          (g.autres && !dis ? '<button type="button" class="btn-texte mt-autre-retrait" data-act="autre-retrait" data-id="' + esc(x.id) + '" aria-label="Retirer de la liste : ' + esc(x.lib) + '">Retirer</button>' : "") + zoneScan(x, g, dis) + "</li>";
      }).join("") + "</ul></div>";
    }).join("") + "</div>";
    h += autresMontage();
    if (P.notes.length) h += '<ul class="mt-notes">' + P.notes.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>";
    h += '<p class="mention">' + (doc ? "Liste non exhaustive, susceptible d'évoluer selon la situation du client, le projet et l'étude du dossier." : "Pièces habituellement demandées pour un dossier de crédit ; chaque banque peut demander des pièces complémentaires.") + "</p>";
    return h + "</section>" + boutonsBas(2);
  }
  /* Documents ajoutés par le conseiller pour ce client (mêmes lignes que dans « Courriers et documents ») : retrait d'une ligne, champ pour en ajouter. */
  function docAutres() { return etat.d.p === "CIMMO" ? "immo" : "conso"; }
  function autresMontage() {
    var c = CLIENT[etat.d.c], l = DP.autresDe(store(), DP.cleClient(c), docAutres()), plein = l.length >= DP.AUTRES.MAX, dis = verrouille() ? " disabled" : "";
    return '<form class="mt-autres" id="mt-autres-form" novalidate aria-labelledby="mt-autres-t"><h3 class="sous-titre" id="mt-autres-t">Ajouter un autre document</h3><div class="mt-autres-ligne"><div class="champ"><label for="mt-autre">Document à ajouter à la liste</label>' +
      '<input id="mt-autre" type="text" maxlength="' + DP.AUTRES.LONGUEUR + '" autocomplete="off" aria-describedby="mt-autre-aide mt-autre-err"' + (plein ? " disabled" : dis) + ' placeholder="Exemple : Attestation de l\'employeur"><span class="aide-champ" id="mt-autre-aide">' + (plein ? "La rubrique « Autres documents » est pleine (" + DP.AUTRES.MAX + " documents au plus)." : l.length + " sur " + DP.AUTRES.MAX + " documents au plus. Il apparaît aussi dans le document à faire signer.") + "</span></div>" +
      '<button type="submit" class="btn btn-secondaire"' + (plein ? " disabled" : dis) + '>Ajouter à la liste</button></div><p class="msg-erreur" id="mt-autre-err" role="alert"></p>' +
      (l.length ? '<p class="mention">Pour retirer un document de la liste, utilisez « Retirer » en face de sa ligne ci-dessus.</p>' : "") + "</form>";
  }
  function compteTxt(P) { return P.recues + " pièce" + (P.recues > 1 ? "s" : "") + " sur " + P.total + (P.complet ? " – dossier complet" : ""); }

  /* ---------- étape 3 : analyse de la solvabilité ---------- */
  function tab(titre, lignes) {
    return '<div class="tab-wrap"><table class="tab tab-cg bl-tab pr-tab mt-tab"><caption class="sr">' + esc(titre) + "</caption><tbody>" + lignes.map(function (l) { return '<tr><th scope="row" class="gauche">' + esc(l[0]) + "</th><td class=\"gauche\">" + (l[2] ? l[1] : esc(l[1])) + "</td></tr>"; }).join("") + "</tbody></table></div>";
  }
  function lignesPret(a) {
    var p = a.pret, c = a.couts, as = a.assurance, g = a.garantie;
    return [["Montant du prêt amortissable", eur(p.capital)], ["Durée", libDuree(p.dureeMois) + " (" + p.dureeMois + " mois)"], ["Taux nominal annuel", pctTaux(p.taux)], ["Mensualité hors assurance", eur(p.mensualite)],
      ["Assurance emprunteur", M.resumeAssurance(as) + (as.souscrite ? " – " + eur(c.prime) + " par mois" : "")], ["Mensualité assurance comprise", eur(c.mensualiteAC)], ["TAEG", pct(c.taeg) + (c.taegObligatoire ? " (assurance et frais compris)" : " (assurance facultative non comprise)")],
      ["TAEA", c.taea === null ? "Sans objet (pas d'assurance)" : pct(c.taea)], ["Garantie", g.lib + (g.frais ? " – frais de garantie " + eur(g.frais) : "")], ["Risque nominal", eur(g.nominal)], ["Risque résiduel", eur(g.residuel)]];
  }
  function lignesSolva(a, noteBale) {
    var s = a.solva, c = a.c, imm = a.d.p === "CIMMO", L = [];
    L.push(["Revenus du foyer par mois", s.foyer ? eur(s.foyer) : "Non renseignés"]);
    L.push(["Mensualités de crédit en cours par mois", s.creditsEnCours.length ? eur(s.avant) + " (" + s.creditsEnCours.map(function (x) { return nomProduit(x.p) + (x.ext ? " – " + x.ext : "") + (x.accorde ? " (accordé dans cet outil)" : "") + " : " + eur(x.mens) + ", durée restante " + libDuree(x.restant); }).join(" ; ") + ")" : "Aucun crédit en cours"]);
    if (s.foyer) {
      L.push(["Taux d'endettement avant le financement", "(" + eur(s.avant) + ") ÷ (" + eur(s.foyer) + ") = " + pct(s.tauxAvant)]);
      L.push(["Taux d'endettement avec le financement", "(" + eur(s.avant) + " + " + eur(s.mensNouv) + ") ÷ (" + eur(s.foyer) + ") = " + pct(s.tauxApres) + " – limite de " + M.HCSF + " %" + (imm ? " (HCSF)" : " (repère)") + " : " + (s.depasse ? "dépassée" : "respectée")]);
      L.push(["Reste à vivre mensuel avant le financement", eur(s.resteAvant)]);
      L.push(["Reste à vivre mensuel avec le financement", eur(s.resteApres) + " (revenus − mensualités" + (s.loyer ? " − loyer de " + eur(s.loyer) : "") + ")"]);
    }
    L.push(["Note Bâle", noteBale ? noteBale : "Non renseignée"]);
    return L;
  }
  function vueEtape3() {
    var a = etat.a, h = '<h2 class="mt-h-etape" id="mt-h-etape" tabindex="-1">Étape 3 – Analyse de la solvabilité</h2>';
    if (!a.solva) return h + '<section class="bloc"><p class="vide-bloc">Terminez d\'abord l\'étape 1 : le prêt doit être calculé pour analyser la solvabilité du client. <button type="button" class="btn-texte" data-act="etape" data-n="1">Retourner à l\'étape 1</button></p></section>' + boutonsBas(3);
    var c = a.c, sit = M.situation(c), s = a.solva, imm = a.d.p === "CIMMO";
    h += '<section class="bloc" aria-labelledby="mt-t-sit"><div class="bloc-tete"><h2 id="mt-t-sit">Situation du client</h2></div>' + sit.personnelle.map(function (t) { return '<p class="mt-texte">' + esc(t) + "</p>"; }).join("") + '<p class="mt-texte"><strong>Statut :</strong> ' + esc(sit.statutClient) + ".</p>";
    h += sit.patrimoine.length ? '<h3 class="sous-titre">Patrimoine financier</h3><div class="tab-wrap" role="region" aria-label="Patrimoine financier" tabindex="0"><table class="tab tab-cg bl-tab pr-tab"><caption class="sr">Patrimoine financier du client à GS Banque & Assurance</caption><thead><tr><th scope="col" class="gauche">Emprunteur</th><th scope="col" class="gauche">Catégorie</th><th scope="col">Montant</th></tr></thead><tbody>' + sit.patrimoine.map(function (r) { return '<tr><th scope="row" class="gauche">' + esc(sit.nom) + '</th><td class="gauche">' + esc(r.cat) + "</td><td>" + esc(B.eur(r.montant)) + "</td></tr>"; }).join("") + "</tbody></table></div>" : '<p class="vide-bloc">Pas d\'épargne ni de placement à GS Banque & Assurance.</p>';
    h += '<p class="mention">' + esc(sit.commentairePatrimoine) + "</p></section>";
    h += '<section class="bloc" aria-labelledby="mt-t-carac"><div class="bloc-tete"><h2 id="mt-t-carac">Caractéristiques du prêt proposé</h2></div>' + tab("Caractéristiques du prêt proposé", lignesPret(a)) + "</section>";
    h += '<section class="bloc" aria-labelledby="mt-t-solva"><div class="bloc-tete"><h2 id="mt-t-solva">Analyse de la solvabilité</h2></div>' + tab("Analyse de la solvabilité", lignesSolva(a, "")) +
      champHtml("bale", "Note Bâle (cotation interne de la banque)", "bale", { max: 12, cls: "mt-bale", aide: "Facultatif : la note attribuée par la banque au client, qui se lit sur la tenue du compte. L'outil ne la calcule pas." }) +
      '<div class="pr-alertes">' + [s.depasse ? '<p class="pr-al pr-al-attention"><span class="pr-al-ico">' + ICO.alerte + "</span><span><strong>Attention : </strong>le taux d'endettement avec ce financement (" + esc(pct(s.tauxApres)) + ") dépasse " + M.HCSF + " %" + (imm ? ", limite fixée par le HCSF pour un crédit immobilier : une justification sera demandée à l'étape 4" : " (repère)") + ".</span></p>" : "", s.resteApres <= 0 ? '<p class="pr-al pr-al-attention"><span class="pr-al-ico">' + ICO.alerte + "</span><span><strong>Attention : </strong>le reste à vivre est nul ou négatif avec ce financement.</span></p>" : ""].join("") + "</div></section>";
    return h + boutonsBas(3);
  }

  /* ---------- étape 4 : décision et offre ---------- */
  var CRIT_ICO = { true: ["chip-ok", "Conforme"], false: ["chip-bad", "Bloquant"], "null": ["chip-warn", "À examiner"] };
  function critereHtml(x) {
    var k = x.ok === true ? "true" : x.ok === false ? "false" : "null", lab = x.ok === false && !x.bloquant ? "Non respecté" : CRIT_ICO[k][1];
    return '<li class="mt-critere"><span class="chip ' + (x.ok === false && !x.bloquant ? "chip-warn" : CRIT_ICO[k][0]) + '">' + lab + '</span><span><strong>' + esc(x.lib) + " : </strong>" + esc(x.detail) + "</span></li>";
  }
  function aideHtml() {
    var a = etat.a, ad = a.aide, cls = { favorable: "chip-ok", examiner: "chip-warn", defavorable: "chip-bad", incomplet: "chip-ctrl" }[ad.verdict];
    return '<section class="bloc mt-aide" aria-labelledby="mt-t-aide"><div class="bloc-tete"><h2 id="mt-t-aide">Outil d\'aide à la décision</h2><span class="chip ' + cls + '" id="mt-verdict">' + esc(ad.libelle) + '</span></div><p class="mention" style="margin-top:0">L\'outil examine le dossier à partir des règles de la banque et de la réglementation. Il aide, il ne décide pas : la décision est la vôtre, vous la motivez ci-dessous.</p><ul class="mt-criteres">' + ad.criteres.map(critereHtml).join("") + "</ul></section>";
  }
  function vueEtape4() {
    var d = etat.d, a = etat.a, st = store(), h = '<h2 class="mt-h-etape" id="mt-h-etape" tabindex="-1">Étape 4 – Décision et offre</h2>', s = M.statutAffiche(st, d);
    if (d.statut !== "brouillon") {
      if (s === "annule") return h + '<section class="bloc mt-recap" aria-labelledby="mt-t-rec"><div class="bloc-tete"><h2 id="mt-t-rec" tabindex="-1">Crédit annulé</h2></div><p class="pr-phrase">La souscription de ce crédit a été annulée dans le catalogue (Mes souscriptions).</p><p class="mt-texte">Le dossier peut être rouvert pour une nouvelle décision : l\'avis et la motivation sont à saisir de nouveau.</p><p class="pf-btns"><button type="button" class="btn btn-principal" data-act="rouvrir">Rouvrir le dossier</button></p></section>' + boutonsBas(4);
      return h + decisionRecapHtml(s) + boutonsBas(4);
    }
    if (!a.pret || !a.aide) return h + '<section class="bloc"><p class="vide-bloc">Terminez d\'abord l\'étape 1 : l\'outil d\'aide à la décision a besoin du prêt calculé. <button type="button" class="btn-texte" data-act="etape" data-n="1">Retourner à l\'étape 1</button></p></section>' + boutonsBas(4);
    return h + aideHtml() + decisionFormHtml() + boutonsBas(4);
  }
  function decisionFormHtml() {
    var d = etat.d, a = etat.a, ad = a.aide, st = store(), c = a.c, fav = d.avis === "favorable";
    var h = '<section class="bloc" aria-labelledby="mt-t-dec"><div class="bloc-tete"><h2 id="mt-t-dec">Votre décision</h2></div><form class="formulaire" id="mt-dec" novalidate>';
    h += '<fieldset class="pr-inconnue"><legend>Avis du conseiller *</legend><div class="pr-radios">' + [["favorable", "Avis favorable", "J'accorde le crédit"], ["defavorable", "Avis défavorable", "Je refuse le crédit"]].map(function (x) {
      return '<label class="pr-radio"><input type="radio" name="mt-avis" id="mt-avis-' + x[0] + '" data-f="avis" data-struct value="' + x[0] + '"' + (d.avis === x[0] ? " checked" : "") + '><span><strong>' + x[1] + "</strong><small>" + x[2] + "</small></span></label>";
    }).join("") + "</div></fieldset>";
    h += champHtml("motivation", "Motivation de l'avis *", "motivation", { type: "textarea", rows: 5, max: 1200, aide: "Quelques phrases : endettement, reste à vivre, stabilité des revenus, garantie, points d'attention. Au moins " + M.MIN_MOTIVATION + " caractères." });
    if (fav) {
      if (!ad.accordPossible) h += '<p class="pr-al pr-al-attention"><span class="pr-al-ico">' + ICO.alerte + "</span><span><strong>Accord impossible pour l'instant : </strong>" + esc(ad.impossible.map(function (x) { return x.lib.toLowerCase(); }).join(", ")) + ".</span></p>";
      var contre = M.contrepartiesPossibles(c, st);
      h += selectHtml("canal", "Moyen par lequel le crédit a été vendu *", "canal", [["", "Choisir un moyen"]].concat(K.ORDRE_MOYENS.map(function (k) { return [k, K.MOYENS[k]]; })));
      h += '<fieldset class="pr-inconnue"><legend>Contreparties commerciales (facultatif)</legend><details class="pr-details" ' + (d.contreparties.length ? "open" : "") + "><summary>Produits à proposer au client en contrepartie du crédit (" + contre.length + ' possibles)</summary><ul class="mt-pieces">' + contre.map(function (x) {
        return '<li><label class="mt-case"><input type="checkbox" id="mt-ctp-' + x.produit.id + '" data-ctp="' + x.produit.id + '"' + (d.contreparties.indexOf(x.produit.id) >= 0 ? " checked" : "") + "><span>" + esc(x.produit.nom) + "</span></label></li>";
      }).join("") + "</ul></details></fieldset>";
      if (ad.verdict !== "favorable" && ad.accordPossible) h += '<label class="mt-case mt-passeoutre"><input type="checkbox" id="mt-passeOutre" data-f="passeOutre"' + (d.passeOutre ? " checked" : "") + "><span>Je confirme ma décision malgré les points signalés par l'outil d'aide à la décision (" + esc(ad.libelle.toLowerCase()) + ").</span></label>";
    }
    h += '<p class="msg-erreur" id="mt-err-dec" role="alert">' + esc(etat.err || "") + "</p>";
    h += '<div class="pf-btns">' + (fav ? '<button type="button" class="btn btn-principal" id="mt-accorder" data-act="accorder">Accorder le crédit</button>' : d.avis === "defavorable" ? '<button type="button" class="btn btn-principal" id="mt-refuser" data-act="refuser">Enregistrer le refus</button>' : '<button type="button" class="btn btn-principal" disabled>Choisissez d\'abord votre avis</button>') +
      '<button type="button" class="btn btn-secondaire btn-impr" data-act="imprimer-dossier">' + ICO.imprimante + "<span>Imprimer le dossier</span></button></div>";
    h += '<p class="mention">Les avis de l\'intermédiaire et du décideur final se complètent à la main sur le dossier imprimé.</p></form></section>';
    return h;
  }
  function decisionRecapHtml(s) {
    var d = etat.d, a = etat.a, o = d.offre, h = "";
    if (d.decision.type === "accord" && o) {
      var dl = M.delaisOffre(d.p, o.emission), c = a.c;
      h += '<section class="bloc mt-recap" aria-labelledby="mt-t-rec"><div class="bloc-tete"><h2 id="mt-t-rec" tabindex="-1">Crédit accordé</h2><span class="ag-outils"><button type="button" class="btn btn-secondaire btn-impr" data-act="imprimer-offre">' + ICO.imprimante + "<span>Imprimer l'offre de prêt</span></button>" +
        '<button type="button" class="btn btn-secondaire btn-impr" data-act="imprimer-dossier">' + ICO.imprimante + "<span>Imprimer le dossier</span></button></span></div>";
      h += '<p class="pr-phrase">Le crédit de ' + esc(eur(o.capital)) + " est accordé à " + esc(nomFull(c)) + ". La souscription est enregistrée le " + esc(B.fmtDate(B.lireYmd(d.decision.date))) + " : elle apparaît dans la fiche client, dans « Mes souscriptions » du catalogue et dans le bilan.</p>";
      h += '<dl class="kpis mt-kpis">' + kpi("Prêt", esc(eur(o.capital)), esc(libDuree(o.dureeMois)) + " au taux de " + esc(pctTaux(o.taux))) + kpi("Mensualité assurance comprise", esc(eur(o.mensualiteAC)), "dont assurance : " + esc(eur(o.prime))) + kpi("TAEG", esc(pct(o.taeg)), "") + kpi("TAEA", o.taea === null ? "Sans objet" : esc(pct(o.taea)), "") + kpi("Coût total du crédit", esc(eur(o.coutTotal)), "") + "</dl>";
      h += '<h3 class="sous-titre">Étapes suivantes avec le client</h3><ul class="mt-notes">' +
        (d.p === "CIMMO" ? "<li>Offre de prêt émise le " + esc(B.fmtDate(B.lireYmd(o.emission))) + " : valable " + dl.validite + " jours minimum à partir de sa réception ; délai de réflexion de " + dl.reflexion + " jours avant que le client puisse l'accepter (le délai commence le lendemain de la réception).</li><li>Si l'achat n'est pas conclu dans les 4 mois, le crédit est annulé.</li>" : "<li>Contrat de crédit remis le " + esc(B.fmtDate(B.lireYmd(o.emission))) + " : le client dispose de " + dl.retractation + " jours calendaires, jusqu'au " + esc(B.fmtDate(dl.limiteRetractation)) + ", pour se rétracter.</li>" + (d.p === "CIMMO" ? "" : "<li>Les fonds sont débloqués sur présentation du " + (d.p === "CAUTO" ? "bon de commande" : d.p === "CTRAV" ? "devis signé" : "justificatif prévu au contrat") + " selon le crédit.</li>")) + "</ul>";
      h += '<p class="pf-btns"><a class="btn btn-secondaire" href="client.html?id=' + c.id + '">Voir la fiche client</a><a class="btn btn-secondaire" href="montage.html">Retour aux dossiers</a></p></section>';
    } else {
      h += '<section class="bloc mt-recap" aria-labelledby="mt-t-rec"><div class="bloc-tete"><h2 id="mt-t-rec" tabindex="-1">Crédit refusé</h2><span class="ag-outils"><button type="button" class="btn btn-secondaire btn-impr" data-act="imprimer-dossier">' + ICO.imprimante + "<span>Imprimer le dossier</span></button></span></div><p class=\"pr-phrase\">Le dossier est clôturé : avis défavorable enregistré le " + esc(B.fmtDate(B.lireYmd(d.decision.date))) + ".</p><p class=\"mt-texte\"><strong>Motivation :</strong> " + esc(d.motivation) + '</p><p class="pf-btns"><a class="btn btn-secondaire" href="montage.html">Retour aux dossiers</a></p></section>';
    }
    return h;
  }

  /* ---------- impression ---------- */
  function ligneDp(cells, total) { return "<tr" + (total ? ' class="dp-total"' : "") + ">" + cells.map(function (x) { return "<td>" + esc(x) + "</td>"; }).join("") + "</tr>"; }
  function dpTable(tete, lignes, cls) { return '<table class="dp-pf dp-pr ' + (cls || "") + '"><thead><tr>' + tete.map(function (t) { return '<th scope="col">' + esc(t) + "</th>"; }).join("") + "</tr></thead><tbody>" + lignes.join("") + "</tbody></table>"; }
  function dpFiche(lignes) { return '<dl class="dp-fiche dp-fiche-l">' + lignes.map(function (l) { return "<dt>" + esc(l[0]) + "</dt><dd>" + esc(l[1]) + "</dd>"; }).join("") + "</dl>"; }
  function dpPlan(a) {
    var plan = a.plan, g = plan.lignes, res = [["Apport personnel", plan.apport], ["Prêt", plan.pret]], n = Math.max(g.length, res.length), rows = [], i;
    for (i = 0; i < n; i++) rows.push("<tr><td>" + (g[i] ? esc(g[i].lib) : "") + '</td><td class="dp-num">' + (g[i] ? (g[i].montant ? esc(eur(g[i].montant)) : "NÉANT") : "") + "</td><td class=\"g\">" + (res[i] ? esc(res[i][0]) : "") + '</td><td class="dp-num">' + (res[i] ? esc(eur(res[i][1])) : "") + "</td></tr>");
    rows.push('<tr class="dp-total"><td>Total</td><td class="dp-num">' + esc(eur(plan.emplois)) + '</td><td class="g">Total</td><td class="dp-num">' + esc(eur(plan.ressources)) + "</td></tr>");
    return '<table class="dp-pf dp-plan"><thead><tr><th scope="col">Projet</th><th scope="col">Montant</th><th scope="col">Financement</th><th scope="col">Montant</th></tr></thead><tbody>' + rows.join("") + "</tbody></table>";
  }
  function listeDp(t) { return '<ul class="dp-liste">' + t.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>"; }
  function avisDp(a) {
    var d = a.d, st = store(), ctp = d.contreparties.map(function (id) { return nomProduit(id); }), av = d.avis === "favorable" ? "Avis favorable" : d.avis === "defavorable" ? "Avis défavorable" : "À compléter";
    var lib = d.decision && d.decision.aide ? d.decision.aide : a.aide ? a.aide.libelle : "";
    var dec = lib ? "Outil d'aide à la décision : " + lib.toLowerCase() + "." : "";
    return '<table class="dp-pf dp-avis"><tbody><tr><th scope="row">Avis du conseiller</th><td class="g">' + esc(av + (d.motivation ? " – " + d.motivation : "")) + '</td></tr><tr><th scope="row">Avis de l\'intermédiaire</th><td class="g dp-vide"></td></tr><tr><th scope="row">Avis du décideur final</th><td class="g dp-vide"></td></tr><tr><th scope="row">Contreparties commerciales</th><td class="g">' + (ctp.length ? esc(ctp.join(" ; ")) : "Aucune") + "</td></tr></tbody></table>" + (dec ? '<p class="dp-mention">' + esc(dec) + "</p>" : "");
  }
  function docDossier() {
    evaluer(); var a = etat.a, d = etat.d, c = a.c, st = store(), cimmo = d.p === "CIMMO";
    if (!a.pret) return;
    var sit = M.situation(c), s = a.solva, corps = "", cts = a.couts, p = a.pret, g = a.garantie, as = a.assurance, pc = a.pieces;
    var bale = String(d.bale || "").trim();
    if (cimmo) {
      corps += dpFiche([["Cliente / client", nomFull(c)], ["Numéro de compte", c.num], ["Ancienneté de la relation", B.fmtDate(sit.depuis)], ["Note Bâle", bale || "Non renseignée"], ["Statut", sit.statutClient], ["Montant du financement", eur(p.capital)], ["Objet du financement", M.OBJETS[d.objet]], ["Durée", p.dureeMois + " mois"]]);
      corps += '<section class="dp-bloc"><h2>I. Situation personnelle et professionnelle</h2>' + sit.personnelle.map(function (t) { return '<p class="dp-texte">' + esc(t) + "</p>"; }).join("") + "</section>";
      corps += '<section class="dp-bloc"><h2>II. Composition du patrimoine financier et immobilier</h2>' + (sit.patrimoine.length ? dpTable(["Emprunteur", "Catégorie", "Montant"], sit.patrimoine.map(function (r) { return ligneDp([sit.nom, r.cat, eur(r.montant)]); }), "dp-prg") : '<p class="dp-texte">Pas d\'épargne ni de placement à GS Banque & Assurance.</p>') + '<p class="dp-texte">' + esc(sit.commentairePatrimoine) + "</p></section>";
      var dc = B.lireYmd(d.compromis), ds = B.lireYmd(d.condSusp), dr = B.lireYmd(d.reiteration);
      corps += '<section class="dp-bloc"><h2>III. Projet financé</h2><p class="dp-texte">' + esc(d.libelle) + "</p>" + (d.objet !== "construction" ? '<p class="dp-texte">' + esc((d.objet === "neuf" ? "Le contrat de réservation a été signé le " : "Le compromis de vente a été signé le ") + B.fmtDate(dc) + ". Il contient une condition suspensive d'obtention de prêt dont la date limite est fixée au " + B.fmtDate(ds) + ". La signature de l'acte authentique est prévue le " + B.fmtDate(dr) + (d.notaire ? " ; le notaire est " + d.notaire : "") + ".") + "</p>" : "") + "</section>";
      corps += '<section class="dp-bloc"><h2>IV. Plan de financement</h2>' + dpPlan(a) + "</section>";
      corps += '<section class="dp-bloc"><h2>V. Caractéristiques du prêt proposé</h2>' + dpFiche([["Montant prêt amortissable", eur(p.capital)], ["Durée", p.dureeMois + " mois"], ["Taux", pctTaux(p.taux)], ["Mensualité hors assurance", eur(p.mensualite)], ["Assurance", M.resumeAssurance(as) + " – " + eur(cts.prime) + " par mois"], ["Mensualité assurance comprise", eur(cts.mensualiteAC)], ["TAEG", pct(cts.taeg) + " (assurance et frais compris)"], ["TAEA", cts.taea === null ? "Sans objet" : pct(cts.taea)], ["Garantie", g.lib + " – frais de garantie " + eur(g.frais)], ["Risque nominal", eur(g.nominal)], ["Risque résiduel", eur(g.residuel)]]) + "</section>";
    } else {
      corps += '<section class="dp-bloc"><h2>Contexte de la relation</h2>' + sit.personnelle.map(function (t) { return '<p class="dp-texte">' + esc(t) + "</p>"; }).join("") + '<p class="dp-texte">' + esc(nomFull(c) + " sollicite " + (d.p === "CAUTO" ? "le financement d'un véhicule" : d.p === "CTRAV" ? "le financement de travaux" : "un prêt personnel") + " : " + d.libelle + ". Les fichiers FICP et FCC " + (pc.complet || (d.pieces.ficp && d.pieces.fcc) ? "ont été interrogés : aucune inscription." : "n'ont pas encore été interrogés.")) + "</p></section>";
      corps += '<section class="dp-bloc"><h2>Plan de financement</h2>' + dpPlan(a) + "</section>";
      corps += '<section class="dp-bloc"><h2>Caractéristiques du financement</h2>' + dpFiche([["Montant", eur(p.capital)], ["Durée", p.dureeMois + " mois"], ["Taux", pctTaux(p.taux)], ["Mensualité hors assurance", eur(p.mensualite)], ["Mensualité assurance comprise", eur(cts.mensualiteAC)], ["Prise de garantie", g.id === "aucune" ? "Néant" : g.lib], ["Assurance emprunteur", M.resumeAssurance(as) + (as.souscrite ? " – " + eur(cts.prime) + " par mois" : "")], ["TAEG", pct(cts.taeg) + (cts.taegObligatoire ? "" : " (assurance facultative non comprise)")], ["TAEA", cts.taea === null ? "Sans objet" : pct(cts.taea)]]) + "</section>";
    }
    var sv = s;
    corps += '<section class="dp-bloc"><h2>' + (cimmo ? "VI. " : "") + "Analyse de la solvabilité</h2>" + dpFiche([["Revenus du foyer par mois", sv.foyer ? eur(sv.foyer) : "Non renseignés"], ["Mensualités de crédit en cours", sv.creditsEnCours.length ? eur(sv.avant) + " par mois (" + sv.creditsEnCours.map(function (x) { return nomProduit(x.p) + (x.ext ? " – " + x.ext : "") + " : " + eur(x.mens); }).join(" ; ") + ")" : "Aucun crédit en cours"], ["Taux d'endettement avant le financement", sv.foyer ? "(" + eur(sv.avant) + ") ÷ (" + eur(sv.foyer) + ") = " + pct(sv.tauxAvant) : "–"], ["Taux d'endettement avec le financement", sv.foyer ? "(" + eur(sv.avant) + " + " + eur(sv.mensNouv) + ") ÷ (" + eur(sv.foyer) + ") = " + pct(sv.tauxApres) : "–"], ["Reste à vivre mensuel avec le financement", eur(sv.resteApres)]].concat(cimmo ? [] : [["Risque nominal", eur(g.nominal)], ["Risque résiduel", eur(g.residuel)], ["Note Bâle", bale || "Non renseignée"]])) +
      '<p class="dp-texte">' + esc(sv.foyer ? "Le taux d'endettement avec le financement, assurance comprise, est de " + pct(sv.tauxApres) + " pour une limite de " + M.HCSF + " %" + (cimmo ? " fixée par le HCSF" : " (repère)") + " : " + (sv.depasse ? "limite dépassée." : "limite respectée.") : "") + "</p></section>";
    corps += '<section class="dp-bloc"><h2>' + (cimmo ? "VII. Avis et contreparties commerciales" : "Décision et contrepartie(s) commerciale(s)") + "</h2>" + avisDp(a) + "</section>";
    corps += '<section class="dp-bloc"><h2>Pièces justificatives</h2><ul class="dp-liste dp-pieces">' + pc.groupes.reduce(function (t, gr) { return t.concat(gr.items); }, []).filter(function (x) { return !x.cond || d.pieces[x.id]; }).map(function (x) { return "<li>" + (M.pieceRecue(d, x) ? "☑" : "☐") + " " + esc(x.lib) + (x.sante && x.sante.decision && !x.sante.decision.obsolete ? " – décision de l'assureur : " + esc(SAN.libelle(x.sante.decision.verdict).toLowerCase()) + " (" + esc(B.fmtDate(B.lireYmd(x.sante.decision.date))) + ")" : "") + (NUM && d.scans && d.scans[x.id] ? " – " + esc(NUM.libelleMin(d.scans[x.id])) : "") + "</li>"; }).join("") + "</ul></section>";
    corps += '<section class="dp-bloc"><h2>Tableau d\'amortissement par année</h2>' + dpTable(["Année", "Mensualités versées", "Intérêts", "Capital remboursé", "Capital restant dû"], p.lignes.map(function (l) { return ligneDp([l.lib, eur(l.pay), eur(l.int), eur(l.cap), eur(l.crd)]); }).concat([ligneDp(["Total", eur(p.totalRembourse), eur(p.interets), eur(p.capital), eur(0)], true)])) + '<p class="dp-mention">Hors assurance emprunteur. ' + esc(R.mentionCredit(null, d.p)) + "</p></section>";
    IMP.imprimer(IMP.document({ titre: cimmo ? "Note de synthèse" : "Commentaire de financement", sous: nomFull(c) + " – " + nomProduit(d.p), corps: corps }), IMP.nomFichier((cimmo ? "Note_de_synthese_" : "Commentaire_financement_") + c.nom + "_" + R.produitPret(d.p).code + "_" + Math.round(p.capital) + "_euros"));
  }
  function docOffre() {
    var d = etat.d, o = d.offre, c = CLIENT[d.c]; if (!o) return;
    var dl = M.delaisOffre(d.p, o.emission), cimmo = d.p === "CIMMO", st = store(), corps = "";
    var res = R.calculer({ inconnue: "mensualite", produit: d.p, capital: o.capital, dureeMois: o.dureeMois, taux: o.taux });
    corps += '<p class="dp-texte">' + (cimmo ? "Offre de prêt immobilier" : "Offre de contrat de crédit") + " émise le " + esc(B.fmtDate(B.lireYmd(o.emission))) + " au nom de " + esc(nomFull(c)) + ", " + esc(c.adr.rue) + ", " + esc(c.adr.cp) + " " + esc(c.adr.ville) + ".</p>";
    corps += '<section class="dp-bloc"><h2>Caractéristiques du crédit</h2>' + dpFiche([["Crédit", nomProduit(d.p)], ["Montant du crédit", eur(o.capital)], ["Durée", libDuree(o.dureeMois) + " (" + o.dureeMois + " mensualités)"], ["Taux débiteur fixe", pctTaux(o.taux)], ["Mensualité hors assurance", eur(o.mensualite) + (o.derniere !== o.mensualite ? " (dernière mensualité : " + eur(o.derniere) + ")" : "")], ["Assurance emprunteur", o.assurance.souscrite ? o.assurance.resume : "Aucune"], ["Cotisation d'assurance par mois", o.assurance.souscrite ? eur(o.prime) : "–"], ["Mensualité assurance comprise", eur(o.mensualiteAC)], ["Garantie", o.garantie.lib], ["Frais de dossier", eur(o.fraisDossier)], ["Frais de garantie", eur(o.fraisGarantie)]]) + "</section>";
    corps += '<section class="dp-bloc"><h2>Coût du crédit</h2><dl class="dp-chiffres"><div><dt>TAEG</dt><dd>' + esc(pct(o.taeg)) + "<small>" + (o.taegObligatoire ? "assurance et frais compris" : "frais compris, assurance facultative non comprise") + '</small></dd></div><div><dt>TAEA</dt><dd>' + (o.taea === null ? "Sans objet" : esc(pct(o.taea))) + "<small>" + (o.taea === null ? "pas d'assurance" : "coût de l'assurance") + '</small></dd></div><div><dt>Coût total du crédit</dt><dd>' + esc(eur(o.coutTotal)) + "<small>" + (o.taegObligatoire ? "intérêts, frais et assurance" : "intérêts et frais") + '</small></dd></div><div><dt>Montant total dû</dt><dd>' + esc(eur(o.montantTotalDu)) + "<small>capital, intérêts, frais" + (o.assurance.souscrite ? ", assurance" : "") + "</small></dd></div></dl>" +
      (o.assurance.souscrite ? '<p class="dp-texte">Coût total de l\'assurance : ' + esc(eur(o.assurance.total)) + " (" + esc(eur(o.assurance.annuel)) + " par an, soit " + esc(nf(o.assurance.tauxAnnuel, 3)) + " % du capital emprunté par an). Garanties couvertes : " + esc(o.assurance.resume) + ".</p>" : "") + "</section>";
    corps += '<section class="dp-bloc"><h2>Délais</h2>' + listeDp(cimmo ? ["L'offre est valable " + dl.validite + " jours minimum à compter de sa réception, soit au moins jusqu'au " + B.fmtDate(dl.finValidite) + " si elle est reçue le jour de son émission.", "Délai de réflexion : " + dl.reflexion + " jours calendaires à compter du lendemain de la réception de l'offre ; le client ne peut pas l'accepter avant la fin de ce délai.", "Si l'opération financée n'est pas conclue dans les 4 mois, le crédit est annulé de plein droit et le client rembourse les sommes déjà versées.", "Le client peut résilier l'assurance emprunteur à tout moment et choisir un autre contrat d'assurance."] : ["Délai de rétractation : " + dl.retractation + " jours calendaires à compter de la signature du contrat, soit jusqu'au " + B.fmtDate(dl.limiteRetractation) + " si le contrat est signé le jour de l'émission.", d.p === "CCONSO" ? "Les fonds sont versés sur le compte du client." : "Crédit affecté : le contrat de vente et le crédit sont liés ; si l'achat est annulé, le crédit l'est aussi.", "L'assurance emprunteur est facultative."]) + "</section>";
    corps += '<section class="dp-bloc"><h2>Tableau d\'amortissement par année</h2>' + dpTable(["Année", "Mensualités versées", "Intérêts", "Capital remboursé", "Capital restant dû"], res.lignes.map(function (l) { return ligneDp([l.lib, eur(l.pay), eur(l.int), eur(l.cap), eur(l.crd)]); }).concat([ligneDp(["Total", eur(res.total), eur(res.interets), eur(res.capital), eur(0)], true)])) + "</section>";
    /* La banque signe l'offre le jour de son émission : tampon de l'agence daté, signature du conseiller (nom de l'élève). Le client date et signe lui-même, après le délai prévu. */
    var jourOffre = B.lireYmd(o.emission) || B.aujourdhui();
    corps += '<section class="dp-bloc"><p class="dp-texte">' + esc(window.SGBF.tampon.faitA(jourOffre)) + '.</p><div class="dp-signatures"><div><p>Pour la banque</p>' + window.SGBF.tampon.zoneBanque(jourOffre) + '</div><div><p>Le client – « lu et approuvé », date et signature</p><p class="dp-ligne-sign"></p></div></div><p class="dp-mention">' + esc(R.mentionCredit(B.lireYmd(o.emission), d.p)) + "</p></section>";
    IMP.imprimer(IMP.document({ titre: "Offre de crédit", sous: nomFull(c) + " – " + nomProduit(d.p), corps: corps }), IMP.nomFichier("Offre_credit_" + c.nom + "_" + R.produitPret(d.p).code + "_" + Math.round(o.capital) + "_euros"));
  }

  /* ---------- actions ---------- */
  function ouvrirDossier(d) {
    etat.santeRep = {}; etat.santeOuvert = ""; etat.d = d; etat.etape = d.etape && d.statut === "brouillon" ? Math.min(d.etape, 4) : 4; etat.montrer = false; etat.err = null;
    try { history.replaceState(null, "", "montage.html?dossier=" + d.id); } catch (e) { /* ignoré */ }
    vueDossier();
    var h = document.getElementById("mt-h-etape"); if (h) h.focus({ preventScroll: true });
  }
  function commencer() {
    var c = client(), p = etat.produit, z = document.getElementById("mt-err-debut");
    if (!c) { etat.err = "Choisissez d'abord un client."; z.textContent = etat.err; var q = document.getElementById("cl-q"); if (q) q.focus(); return; }
    if (!p) { etat.err = "Choisissez le crédit demandé."; z.textContent = etat.err; var r = document.querySelector('input[name="mt-produit"]'); if (r) r.focus(); return; }
    etat.err = null;
    var st = store(), exist = M.dossiersClient(st, c.id).filter(function (d) { return d.p === p && d.statut === "brouillon"; })[0];
    if (exist) { ouvrirDossier(exist); return; }
    var d = M.nouveau(c, p); M.enregistrer(st, d); sauver(); ouvrirDossier(d);
  }
  function suivant(n) {
    evaluer();
    if (etat.etape === 1 && !etat.a.etape1Ok) {
      etat.montrer = true; renderEtape();
      if (etat.a.erreurs[0]) focusChamp(etat.a.erreurs[0].champ);
      return;
    }
    allerEtape(n);
  }
  function accorderOuRefuser(accord) {
    lireDecision();
    var c = CLIENT[etat.d.c], st = store(), o = { motivation: etat.d.motivation, canal: etat.d.canal, passeOutre: etat.d.passeOutre, contreparties: etat.d.contreparties };
    var r = accord ? M.accorder(st, c, etat.d, o) : M.refuser(st, c, etat.d, o);
    if (!r.ok) { etat.err = r.erreur; etat.montrer = true; renderEtape(); focusChamp(r.champ); return; }
    etat.err = null; sauver(); etat.etape = 4; vueDossier();
    var h = document.getElementById("mt-t-rec"); if (h) { h.scrollIntoView({ block: "start" }); h.focus(); }
  }
  function lireDecision() { /* les champs de la décision sont déjà dans le dossier (événement change) ; contreparties lues ici */
    var l = []; app.querySelectorAll("[data-ctp]").forEach(function (i) { if (i.checked) l.push(i.getAttribute("data-ctp")); });
    if (document.getElementById("mt-dec")) etat.d.contreparties = l;
  }
  function sauverBrouillon() { if (etat.d && etat.d.statut === "brouillon") { M.enregistrer(store(), etat.d); sauver(); } }
  function changementStructure(t) {
    var d = etat.d, c = CLIENT[d.c], p = t.getAttribute("data-f");
    if (p === "objet") { if (M.suretesPossibles(d.p, d.objet).indexOf(d.garantie) < 0) d.garantie = M.SURETE_DEFAUT[d.p]; if (d.objet === "construction") { d.compromis = ""; d.condSusp = ""; d.reiteration = ""; } }
    if (p === "garantie" && M.SURETES[d.garantie] && M.SURETES[d.garantie].couvre !== "engagement") d.engagement = "";
    if (p === "co") {
      var P = M.personnes(d, c);
      ["socle", "ipt", "ipp", "pe"].forEach(function (k) {
        var q = d.assurance.q[k], sel = (q[0] || 0) + (q[1] || 0) > 0;
        if (!sel) { d.assurance.q[k] = [0, 0]; return; }
        var ok = P.map(function (x) { return k !== "pe" || M.perteEmploiPossible(x); }), n = ok.filter(Boolean).length;
        if (n === 0) d.assurance.q[k] = [0, 0];
        else if (P.length === 1) d.assurance.q[k] = [100, 0];
        else d.assurance.q[k] = n === 2 ? [50, 50] : ok[0] ? [100, 0] : [0, 100];
      });
    }
  }

  /* ---------- événements ---------- */
  app.addEventListener("change", function (e) {
    var t = e.target;
    if (t.hasAttribute("data-sq")) { santeSaisie(t); return; }
    if (t.name === "mt-produit") { etat.produit = t.value; return; }
    if (!etat.d) return;
    if (t.hasAttribute("data-ctp")) { lireDecision(); sauverBrouillon(); return; }
    if (!lireChamp(t)) return;
    if (t.hasAttribute("data-struct")) { changementStructure(t); sauverBrouillon(); renderEtape(t.id); return; }
    sauverBrouillon(); evaluer();
    if (etat.etape === 1) majDerives1();
    else if (etat.etape === 2) { var z = document.getElementById("mt-compte"); if (z) z.textContent = compteTxt(etat.a.pieces); }
  });
  app.addEventListener("input", function (e) {
    var t = e.target;
    if (t.hasAttribute("data-sq")) { santeSaisie(t); return; }
    if (t.id === "cl-q") { etat.q = t.value; suggestions(); return; }
    if (!etat.d || !t.hasAttribute("data-f")) return;
    if (t.tagName === "TEXTAREA" || (t.type === "text" && etat.etape === 1) || t.type === "date") { if (lireChamp(t)) { evaluer(); if (etat.etape === 1) majDerives1(); } }
  });
  app.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    var a = b.getAttribute("data-act");
    if (a === "choisir-client") { etat.client = parseInt(b.getAttribute("data-id"), 10); etat.q = ""; majAccueilClient(); var z = document.getElementById("cl-choisi"); if (z) z.focus(); }
    else if (a === "retirer-client") { etat.client = null; etat.q = ""; majAccueilClient(); var q = document.getElementById("cl-q"); if (q) q.focus(); }
    else if (a === "commencer") commencer();
    else if (a === "suppr") { etat.confirmerSuppr = b.getAttribute("data-id"); document.getElementById("z-liste").innerHTML = listeDossiers(); }
    else if (a === "suppr-non") { etat.confirmerSuppr = null; document.getElementById("z-liste").innerHTML = listeDossiers(); }
    else if (a === "suppr-oui") { M.supprimer(store(), b.getAttribute("data-id")); etat.confirmerSuppr = null; sauver(); document.getElementById("z-liste").innerHTML = listeDossiers(); }
    else if (a === "etape") { lireDecision(); allerEtape(parseInt(b.getAttribute("data-n"), 10)); }
    else if (a === "suivant") suivant(parseInt(b.getAttribute("data-n"), 10));
    else if (a === "enregistrer") { sauverBrouillon(); var s = document.createElement("span"); s.className = "sr"; s.setAttribute("role", "status"); s.textContent = "Brouillon enregistré"; b.parentNode.appendChild(s); b.textContent = "Brouillon enregistré"; setTimeout(function () { b.textContent = "Enregistrer le brouillon"; }, 2500); }
    else if (a === "aller-champ") focusChamp(b.getAttribute("data-champ"));
    else if (a === "estimer-notaire") { evaluer(); var prix = parseFloat(String(etat.d.plan.bien).replace(/[\s ]/g, "").replace(",", ".")); if (prix > 0) { var pc = etat.d.objet === "neuf" ? M.FRAIS_NOTAIRE.neuf : M.FRAIS_NOTAIRE.ancien; etat.d.plan.notaire = String(Math.round(prix * pc) / 100).replace(".", ","); sauverBrouillon(); renderEtape("mt-plan-notaire"); } else { etat.montrer = true; renderEtape("mt-plan-bien"); } }
    else if (a === "accorder") accorderOuRefuser(true);
    else if (a === "refuser") accorderOuRefuser(false);
    else if (a === "rouvrir") { if (M.rouvrir(store(), etat.d)) { M.enregistrer(store(), etat.d); sauver(); etat.etape = 4; vueDossier(); } }
    else if (a === "imprimer-dossier") { lireDecision(); docDossier(); }
    else if (a === "imprimer-offre") docOffre();
    else if (a === "doc-pret") docPret();
    else if (a === "num") numeriser(b);
    else if (a.indexOf("sante-") === 0) santeAgir(a, b.getAttribute("data-id"));
    else if (a === "autre-retrait") {
      var st = store(), c = CLIENT[etat.d.c]; if (DP.retirerAutre(st, DP.cleClient(c), docAutres(), b.getAttribute("data-id")).ok) { sauver(); }
      renderEtape("mt-autre");
    }
  });
  app.addEventListener("submit", function (e) {
    if (!e.target || e.target.id !== "mt-autres-form") return;
    e.preventDefault();
    if (!etat.d || verrouille()) return;
    var champ = document.getElementById("mt-autre"), msg = document.getElementById("mt-autre-err"), st = store(), c = CLIENT[etat.d.c], r = DP.ajouterAutre(st, DP.cleClient(c), docAutres(), champ.value);
    if (!r.ok) { champ.setAttribute("aria-invalid", "true"); msg.textContent = r.erreur; champ.focus(); return; }
    sauver(); renderEtape("mt-autre");
  });

  RECH.init(CL, document.getElementById("rech"), document.getElementById("rech-res"), document.getElementById("rech-statut"));
  var dId = params.get("dossier"), dExist = dId && M.trouver(store(), dId);
  if (dExist && CLIENT[dExist.c]) { etat.d = dExist; etat.etape = dExist.statut === "brouillon" ? Math.min(dExist.etape || 1, 4) : 4; vueDossier(); }
  else vueAccueil();
})();
