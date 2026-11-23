/* GS Banque & Assurance – questionnaire profil investisseur (MIFID) et rapport de conseil : choix du client et du produit boursier, questionnaire, rapport, mise à disposition, impression.
   Les règles (questions, niveaux, supports, textes du rapport) sont dans mifid.js ; cette page ne fait que saisir et présenter. */
(function () {
  "use strict";

  var B = window.SGBF.banque, M = window.SGBF.mifid, PR = window.SGBF.produits, K = window.SGBF.catalogue, IMP = window.SGBF.impression, ICO = window.SGBF.icones, RECH = window.SGBF.recherche, CL = window.SGBF.clients;
  var app = document.getElementById("app"), esc = B.esc;
  var CLIENT = {}; CL.forEach(function (c) { CLIENT[c.id] = c; });
  var PRO = window.SGBF.prospects;
  /* Clients : ceux du portefeuille et ceux dont le compte a été ouvert pendant l'exercice (ouverture de compte d'un prospect). */
  function tous() { return PRO ? PRO.tousClients(CL, B.store.charger()) : CL; }
  function qui(id) { return CLIENT[id] || (PRO ? PRO.clientsOuverts(B.store.charger()).filter(function (c) { return c.id === id; })[0] : null) || null; }
  function lienClient(c) { return PRO ? PRO.lienClient(c) : "client.html?id=" + c.id; }
  function store() { return B.store.charger(); }
  function nomFull(c) { return c.civ + " " + c.prenom + " " + c.nom.toUpperCase(); }
  function nomListe(c) { return c.nom.toUpperCase() + " " + c.prenom; }
  function fmt(ymd) { return B.fmtDate(B.lireYmd(ymd)); }

  var params = new URLSearchParams(location.search);
  var etat = { client: null, q: "", produit: "", canal: "", rep: {}, err: null, vue: "form", rapport: null, remplace: null, msg: "", suppr: null, origine: "" };

  /* ---------- initialisation depuis l'adresse ---------- */
  function choisirClient(id) {
    etat.client = id || null; etat.err = null; etat.vue = "form"; etat.rapport = null; etat.msg = "";
    if (id) preremplir();
  }
  function client() { return etat.client ? qui(etat.client) : null; }
  /* Réponses du client déjà connues : profil enregistré (ou reconstitué d'après son dossier), à défaut revenus et catégorie du dossier. */
  function preremplir() {
    var c = client(), st = store(), rep = {}, pr = M.profilClient(st, c);
    M.IDS_CONTRAT.forEach(function (id) { rep[id] = ""; });
    if (pr) { M.IDS_CLIENT.forEach(function (id) { rep[id] = pr.rep[id] || ""; }); etat.origine = pr.origine; }
    else { var sg = M.suggestions(c); M.IDS_CLIENT.forEach(function (id) { rep[id] = ""; }); rep.revenus = sg.revenus; rep.csp = sg.csp; etat.origine = "suggestion"; }
    etat.rep = rep;
  }
  if (qui(parseInt(params.get("client"), 10))) choisirClient(parseInt(params.get("client"), 10));
  if (M.estBoursier(params.get("produit"))) etat.produit = params.get("produit");
  if (K.MOYENS[params.get("canal")]) etat.canal = params.get("canal");
  (function () {
    var r = M.rapport(store(), params.get("rapport"));
    if (r && qui(r.c)) { choisirClient(r.c); etat.produit = r.p; etat.canal = r.canal; etat.rapport = r.id; etat.vue = "rapport"; }
  })();

  /* ---------- client ---------- */
  function clientHtml() {
    var c = client(), h = '<div class="champ cl-q"><label for="cl-q">Rechercher un client (nom, prénom ou numéro)</label><input id="cl-q" type="search" autocomplete="off" maxlength="60" aria-controls="cl-res" value="' + esc(etat.q) + '"></div>' +
      '<ul id="cl-res" class="cl-res" hidden></ul><p id="cl-statut" class="sr" role="status"></p>';
    if (c) {
      h += '<div class="cl-choisi" id="cl-choisi" tabindex="-1"><p><strong>' + esc(nomFull(c)) + "</strong> – " + c.age + " ans – " + esc(c.pro.prof) + " – " + esc(c.num) + "</p>" + profilHtml(c) +
        '<div class="pf-btns"><a class="btn btn-secondaire" href="' + lienClient(c) + '">Ouvrir la fiche client</a><button type="button" class="btn-texte" data-act="retirer-client">Choisir un autre client</button></div></div>';
    } else h += '<p class="vide-bloc cl-aide">Choisissez le client qui répond au questionnaire.</p>';
    return h;
  }
  function profilHtml(c) {
    var st = store(), pr = M.profilClient(st, c);
    if (!pr) return '<p class="sous">Aucun questionnaire enregistré pour ce client : il n\'a pas encore de profil investisseur.</p>';
    var e = M.etatProfil({ date: pr.date }, B.aujourdhui()), cls = e.etat === "valable" ? "chip-ok" : "chip-warn";
    return '<p class="sous">Dernier profil investisseur : ' + esc(fmt(pr.date)) + (pr.origine === "dossier" ? " (établi à l'ouverture de son contrat)" : "") + ' <span class="chip ' + cls + '">' + (e.etat === "valable" ? "À jour jusqu'au " + esc(B.fmtDate(e.fin)) : "À actualiser") + "</span></p>";
  }
  function suggestions() {
    var z = document.getElementById("cl-res"), s = document.getElementById("cl-statut"), q = etat.q.trim();
    if (!z) return;
    if (q.length < 2) { z.hidden = true; z.innerHTML = ""; s.textContent = ""; return; }
    var r = RECH.chercher(tous(), q, 8);
    z.innerHTML = r.length ? r.map(function (c) { return '<li><button type="button" data-act="choisir-client" data-id="' + c.id + '"><span class="rech-nom">' + esc(nomListe(c)) + '</span><span class="rech-sous">' + c.age + " ans – " + esc(c.pro.prof) + " – " + esc(c.num) + "</span></button></li>"; }).join("") : '<li class="rech-vide">Aucun client trouvé</li>';
    s.textContent = r.length ? r.length + (r.length > 1 ? " résultats" : " résultat") : "Aucun résultat";
    z.hidden = false;
  }

  /* ---------- historique des rapports du client ---------- */
  function historiqueHtml() {
    var c = client(); if (!c) return "";
    var st = store(), l = M.rapports(st).filter(function (r) { return r.c === c.id; }).slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : a.heure < b.heure ? 1 : -1; });
    if (!l.length) return '<p class="vide-bloc">Aucun rapport de conseil pour ce client.</p>';
    var auj = B.aujourdhui();
    return '<div class="tab-wrap"><table class="tab-ventes"><caption class="sr">Rapports de conseil de ' + esc(nomFull(c)) + '</caption><thead><tr><th scope="col">Date</th><th scope="col">Produit</th><th scope="col">Support</th><th scope="col">Conseil</th><th scope="col">Situation</th><th scope="col">Actions</th></tr></thead><tbody>' + l.map(function (r) {
      var u = M.utilise(st, r.id), ut = M.utilisable(st, r, r.c, r.p, auj), sit = u ? "Utilisé pour une souscription" : !r.dispo ? "À mettre à disposition" : ut.ok ? "Mis à disposition – utilisable" : ut.raison === "perime" ? "Expiré (valable 30 jours)" : "Non utilisable";
      var sup = r.conseil.verdict === "adapte" ? r.conseil.support.nom : "Aucun";
      return '<tr><td data-label="Date">' + esc(fmt(r.date)) + " " + esc(r.heure.replace(":", " h ")) + '</td><td data-label="Produit">' + esc(M.CONTRAT_NOM[r.p]) + '</td><td data-label="Support">' + esc(sup) + '</td><td data-label="Conseil"><span class="chip ' + (r.conseil.verdict === "adapte" ? "chip-ok" : "chip-bad") + '">' + (r.conseil.verdict === "adapte" ? "Adapté" : "Non adapté") + '</span></td><td data-label="Situation">' + esc(sit) + '</td><td data-label="Actions"><button type="button" class="btn-texte" data-act="voir" data-id="' + r.id + '" aria-label="Ouvrir le rapport du ' + esc(fmt(r.date)) + " : " + esc(M.CONTRAT_NOM[r.p]) + '">Ouvrir</button>' +
        (!r.dispo && !u ? (etat.suppr === r.id ? ' <button type="button" class="btn-texte neg" data-act="suppr-oui" data-id="' + r.id + '">Confirmer la suppression</button> <button type="button" class="btn-texte" data-act="suppr-non">Garder</button>' : ' <button type="button" class="btn-texte" data-act="suppr" data-id="' + r.id + '" aria-label="Supprimer le rapport du ' + esc(fmt(r.date)) + " : " + esc(M.CONTRAT_NOM[r.p]) + '">Supprimer</button>') : "") + "</td></tr>";
    }).join("") + "</tbody></table></div>";
  }

  /* ---------- questionnaire ---------- */
  function banniere() {
    var c = client(), pr = M.profilClient(store(), c), s = "";
    if (!pr) return '<p class="mf-info">Aucun profil enregistré : posez les questions au client. Les revenus et la catégorie socioprofessionnelle sont proposés d\'après son dossier : faites-les confirmer.</p>';
    var e = M.etatProfil({ date: pr.date }, B.aujourdhui());
    s = e.etat === "valable" ? "Réponses reprises du profil du " + fmt(pr.date) + ", à jour jusqu'au " + B.fmtDate(e.fin) + " : relisez-les avec le client et corrigez-les si sa situation a changé."
      : "Le dernier profil date du " + fmt(pr.date) + " : il est à actualiser (un profil est valable 12 mois). Les anciennes réponses sont reprises ; faites-les confirmer ou corriger par le client.";
    return '<p class="mf-info' + (e.etat === "valable" ? "" : " mf-info-warn") + '">' + esc(s) + "</p>";
  }
  function questionHtml(q) {
    var v = etat.rep[q.id], err = etat.err && etat.err.champ === q.id, id = "mf-" + q.id, d = err ? ' aria-invalid="true" aria-describedby="mf-err"' : "";
    if (q.type === "montant") {
      return '<div class="champ mf-q" id="q-' + q.id + '"><label for="' + id + '">' + esc(q.texte) + ' *</label><input id="' + id + '" type="text" inputmode="decimal" autocomplete="off" value="' + esc(v == null ? "" : v) + '"' + d + '>' +
        '<span class="aide-champ">Ce montant sert à vérifier que le conseil reste adapté : la souscription ne pourra pas le dépasser.</span></div>';
    }
    if (q.id === "csp") {
      return '<div class="champ mf-q" id="q-' + q.id + '"><label for="' + id + '">' + esc(q.texte) + ' *</label><select id="' + id + '"' + d + '><option value="">Choisir…</option>' + q.options.map(function (x) { return '<option value="' + x.v + '"' + (v === x.v ? " selected" : "") + ">" + esc(x.t) + "</option>"; }).join("") + "</select></div>";
    }
    return '<fieldset class="mf-q' + (q.type === "vf" ? " mf-vf" : "") + '" id="q-' + q.id + '"' + (err ? ' aria-invalid="true"' : "") + '><legend>' + esc(q.texte) + ' *</legend><div class="mf-opts">' + q.options.map(function (x, i) {
      return '<label class="mf-opt"><input type="radio" name="' + id + '" value="' + x.v + '"' + (v === x.v ? " checked" : "") + (err && i === 0 ? ' aria-describedby="mf-err"' : "") + "><span>" + esc(x.t) + "</span></label>";
    }).join("") + "</div></fieldset>";
  }
  function formHtml() {
    var c = client(); if (!c) return "";
    var st = store(), h = "";
    h += '<div class="mf-choix"><fieldset class="mf-q"><legend>Produit boursier concerné *</legend><div class="mf-opts">' + M.BOURSIERS.map(function (pid) {
      var ev = K.verdictClient(c, pid, st), cls = { eligible: "chip-ok", examiner: "chip-warn", non: "chip-bad", detenu: "chip-ctrl" }[ev.verdict];
      return '<label class="mf-opt"><input type="radio" name="mf-produit" value="' + pid + '"' + (etat.produit === pid ? " checked" : "") + '><span><strong>' + esc(PR.parId[pid].nom) + '</strong> <span class="chip ' + cls + '">' + esc(ev.libelle) + "</span></span></label>";
    }).join("") + '</div></fieldset>' +
      '<div class="champ"><label for="mf-canal">Moyen par lequel le conseil est donné *</label><select id="mf-canal" aria-describedby="mf-aide-canal"><option value="">Choisir…</option>' + K.ORDRE_MOYENS.map(function (m) { return '<option value="' + m + '"' + (etat.canal === m ? " selected" : "") + ">" + esc(K.MOYENS[m]) + "</option>"; }).join("") + '</select>' +
      '<span class="aide-champ" id="mf-aide-canal">Le même moyen sera repris pour la souscription. À distance (mailing, appel), le rapport est mis à disposition dans l\'espace client ; en rendez-vous ou à l\'accueil, il est remis en agence.</span></div></div>';
    if (!etat.produit) return h + '<p class="vide-bloc">Choisissez le produit pour afficher le questionnaire.</p>';
    h += banniere();
    M.SECTIONS.forEach(function (s) {
      h += '<section class="mf-section" aria-labelledby="mf-s-' + s.id + '"><h3 id="mf-s-' + s.id + '">' + esc(s.titre) + ' <span class="mf-portee">' + (s.portee === "client" ? "Propre au client" : "Propre à ce contrat") + "</span></h3>";
      M.questions().forEach(function (q) {
        if (q.s !== s.id) return;
        if (q.conditionnelle && (!etat.rep.durable || etat.rep.durable === "d0")) return;
        h += questionHtml(q);
      });
      h += "</section>";
    });
    h += '<div class="champ mf-decl"><label class="case"><input type="checkbox" id="mf-decl"' + (etat.decl ? " checked" : "") + (etat.err && etat.err.champ === "decl" ? ' aria-invalid="true" aria-describedby="mf-err"' : "") + '><span>Ces réponses ont été données par le client, qui les a relues et confirmées. *</span></label></div>' +
      '<p class="msg-erreur" id="mf-err" role="alert">' + (etat.err ? esc(etat.err.erreur) : "") + "</p>" +
      '<div class="pf-btns"><button type="submit" class="btn btn-principal">Valider le questionnaire et établir le rapport de conseil</button></div>';
    return h;
  }

  /* ---------- rapport ---------- */
  function niveauHtml(n) { return n ? '<span class="rc-niveau">' + esc(n) + "</span>" : ""; }
  function liste(l, cls) { return l.length ? '<ul class="rc-liste' + (cls ? " " + cls : "") + '">' + l.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" : ""; }
  function bloc(b) { return '<div class="rc-bloc"><p class="rc-titre"><span>' + esc(b.titre) + "</span>" + niveauHtml(b.niveau) + "</p><p>" + esc(b.texte) + "</p></div>"; }
  /* Même mise en page à l'écran et à l'impression (le style est dans mifid.css). */
  function rapportHtml(r, c) {
    var t = M.textes(r, c), ad = t.verdict === "adapte";
    var h = '<div class="rc"><p class="rc-appel">' + esc(t.civilite) + ",</p>" + t.intro.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") + liste(t.besoins) + "<p>" + esc(t.limite) + "</p>" +
      '<p class="rc-verdict ' + (ad ? "rc-ok" : "rc-ko") + '"><strong>' + (ad ? "Contrat adapté à votre profil" : "Mise en garde : contrat non adapté à votre profil") + "</strong></p><p>" + esc(t.adequation) + "</p>" +
      '<h2 class="rc-h">Récapitulatif de votre conseil</h2><h3 class="rc-h3">Profil client</h3>' + t.recap.client.map(bloc).join("") +
      '<h3 class="rc-h3">Stratégie – ' + esc(t.contrat) + "</h3>" + t.recap.contrat.map(bloc).join("") +
      '<h3 class="rc-h3">Résultat – ' + esc(t.contrat) + '</h3><div class="rc-bloc rc-conseil"><p class="rc-titre"><span>' + esc(t.resultat.titre) + "</span>" + (ad ? niveauHtml("Risque " + t.resultat.risque.toLowerCase() + (t.resultat.sri ? " (indicateur " + t.resultat.sri + " sur 7)" : "")) : "") + "</p><p><strong>" + esc(t.resultat.support) + "</strong></p>" + t.resultat.presentation.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") + "</div>" +
      '<div class="rc-bloc"><p class="rc-titre"><span>Explication de notre conseil</span></p><p>' + esc(t.resultat.intro) + '</p><ul class="rc-liste rc-crit">' + t.resultat.explication.map(function (x) { return '<li class="' + (x.ok ? "rc-c-ok" : "rc-c-ko") + '"><span class="rc-marque">' + (x.ok ? "Adapté" : "Non adapté") + ' : </span>' + esc(x.texte) + "</li>"; }).join("") + "</ul></div>" +
      (t.resultat.messages.length ? '<div class="rc-bloc"><p class="rc-titre"><span>Messages d\'information</span></p>' + liste(t.resultat.messages) + "</div>" : "") +
      (t.resultat.alternatives.length ? '<div class="rc-bloc"><p class="rc-titre"><span>Produits adaptés à votre profil</span></p>' + liste(t.resultat.alternatives) + "</div>" : "") +
      '<h2 class="rc-h">Questionnaire profil investisseur</h2>' + t.questionnaire.map(function (s) {
        return '<div class="rc-bloc rc-qs"><p class="rc-titre"><span>' + esc(s.titre) + (s.portee === "contrat" ? " – " + esc(t.contrat) : "") + "</span></p><dl>" + s.lignes.map(function (l) { return "<dt>" + esc(l.q) + "</dt><dd>" + esc(l.r) + "</dd>"; }).join("") + "</dl></div>";
      }).join("") + "</div>";
    return h;
  }
  function rapportVue() {
    var st = store(), r = M.rapport(st, etat.rapport), c = client();
    if (!r || !c) return "";
    var ad = r.conseil.verdict === "adapte", u = M.utilise(st, r.id), ut = M.utilisable(st, r, r.c, r.p, B.aujourdhui()), t = M.textes(r, c);
    var h = '<div class="bloc-tete"><h2 id="t-rapport" tabindex="-1">Rapport de conseil</h2><span class="sous">' + esc(M.CONTRAT_NOM[r.p]) + " – établi le " + esc(fmt(r.date)) + " à " + esc(r.heure.replace(":", " h ")) + "</span></div>";
    h += '<p class="mf-ok" id="mf-ok" role="status" tabindex="-1">' + esc(etat.msg) + "</p>";
    if (r.dispo) h += '<p class="mf-info mf-dispo"><strong>Mis à disposition du client.</strong> ' + esc(t.dispo) + (u ? " Ce rapport a servi à une souscription." : ut.ok ? " Il est valable 30 jours : la souscription peut être faite." : "") + "</p>";
    else if (ad) h += '<p class="mf-info mf-info-warn"><strong>À mettre à disposition du client.</strong> Le rapport doit être remis ou mis à disposition du client avant la souscription.</p>';
    else h += '<p class="mf-info mf-info-warn"><strong>Contrat non adapté au profil du client.</strong> Proposez un produit adapté (voir les produits cités dans le rapport). Si le client maintient sa demande, c\'est à son initiative et après cette mise en garde.</p>';
    h += '<div class="pf-btns mf-actions">';
    if (!r.dispo) {
      if (!ad) h += '<label class="case mf-maintien"><input type="checkbox" id="mf-maintien"><span>Le client a pris connaissance de la mise en garde et maintient sa demande, à son initiative.</span></label>';
      h += '<button type="button" class="btn btn-principal" data-act="dispo">Mettre le rapport à disposition du client</button>';
    } else if (ut.ok && !u) h += '<a class="btn btn-principal" href="catalogue.html?produit=' + r.p + "&amp;client=" + c.id + '&amp;souscrire=1&amp;rapport=' + r.id + '">Souscrire ce produit</a>';
    h += '<button type="button" class="btn btn-secondaire" data-act="imprimer">Imprimer ou enregistrer en PDF</button>';
    if (!u) h += '<button type="button" class="btn-texte" data-act="refaire">Modifier les réponses</button>';
    h += '<button type="button" class="btn-texte" data-act="retour-form">Fermer le rapport</button></div>';
    return h + '<div class="mf-rapport">' + rapportHtml(r, c) + "</div>";
  }
  function imprimerRapport() {
    var st = store(), r = M.rapport(st, etat.rapport), c = client(); if (!r || !c) return;
    var t = M.textes(r, c), corps = '<section class="dp-long mf-print">' + rapportHtml(r, c) + "</section>" +
      (t.dispo ? '<p class="dp-mention">' + esc(t.dispo) + "</p>" : "");
    IMP.imprimer(IMP.document({ titre: "Rapport de conseil", sous: nomFull(c) + " – " + M.CONTRAT_NOM[r.p], corps: corps }), "Rapport_de_conseil_" + IMP.nomFichier(c.prenom + " " + c.nom) + "_" + r.p + "_" + r.date);
  }

  /* ---------- page ---------- */
  function render() {
    app.innerHTML = '<nav class="fil-ariane" aria-label="Fil d\'Ariane"><a href="index.html">' + ICO.retour + "Accueil</a><span aria-hidden=\"true\">/</span><span>Profil investisseur (MIFID)</span></nav>" +
      '<div class="page-titre"><h1>Profil investisseur (MIFID)</h1><p>Questionnaire obligatoire avant la souscription d\'un produit boursier, puis rapport de conseil remis au client</p></div>' +
      '<section class="bloc" aria-labelledby="t-client"><div class="bloc-tete"><h2 id="t-client">Client concerné</h2></div><div id="z-client">' + clientHtml() + "</div></section>" +
      '<div id="z-corps"></div>';
    majCorps();
  }
  function majClient() { document.getElementById("z-client").innerHTML = clientHtml(); }
  function majCorps() {
    var z = document.getElementById("z-corps"), c = client(), h = "";
    if (!c) { z.innerHTML = ""; return; }
    if (etat.vue === "rapport") h = '<section class="bloc mf-bloc-rapport" aria-labelledby="t-rapport">' + rapportVue() + "</section>";
    else h = '<section class="bloc" aria-labelledby="t-form"><div class="bloc-tete"><h2 id="t-form" tabindex="-1">Questionnaire profil investisseur</h2><span class="sous">Les questions marquées d\'une étoile sont obligatoires.</span></div><form class="formulaire mf-form" id="mf-form" novalidate>' + formHtml() + "</form></section>";
    h += '<section class="bloc" aria-labelledby="t-hist"><div class="bloc-tete"><h2 id="t-hist">Rapports de conseil de ce client</h2></div><div id="z-hist">' + historiqueHtml() + "</div></section>";
    z.innerHTML = h;
  }
  function majForm(focusId) { var f = document.getElementById("mf-form"); if (f) f.innerHTML = formHtml(); var e = focusId && document.getElementById(focusId); if (e) e.focus(); }
  function majHist() { var z = document.getElementById("z-hist"); if (z) z.innerHTML = historiqueHtml(); }
  function focus(id) { var e = document.getElementById(id); if (e) { if (!e.hasAttribute("tabindex")) e.setAttribute("tabindex", "-1"); e.focus(); } }

  /* ---------- saisie ---------- */
  function lire() {
    var f = document.getElementById("mf-form"); if (!f) return;
    M.questions().forEach(function (q) {
      var id = "mf-" + q.id;
      if (q.type === "choix" && q.id !== "csp" || q.type === "vf") { var r = f.querySelector('input[name="' + id + '"]:checked'); if (r) etat.rep[q.id] = r.value; }
      else { var e = document.getElementById(id); if (e) etat.rep[q.id] = e.value; }
    });
    var p = f.querySelector('input[name="mf-produit"]:checked'); if (p) etat.produit = p.value;
    var cn = document.getElementById("mf-canal"); if (cn) etat.canal = cn.value;
    var d = document.getElementById("mf-decl"); if (d) etat.decl = d.checked;
  }
  function valider() {
    lire();
    if (!M.estBoursier(etat.produit)) { etat.err = { champ: "produit", erreur: "Choisissez le produit boursier concerné." }; return null; }
    if (!K.MOYENS[etat.canal]) { etat.err = { champ: "canal", erreur: "Indiquez le moyen par lequel le conseil est donné : mailing, appel, entretien en rendez-vous ou entretien à l'accueil." }; return null; }
    var k = M.controler(etat.rep);
    if (!k.ok) { etat.err = k; return null; }
    if (!etat.decl) { etat.err = { champ: "decl", erreur: "Confirmez que ces réponses ont été données par le client." }; return null; }
    etat.err = null; return k;
  }
  function envoyer() {
    var k = valider();
    if (!k) {
      majForm();
      var ch = etat.err.champ, e = document.getElementById("mf-" + ch) || document.querySelector('input[name="mf-' + ch + '"]') || document.getElementById("q-" + ch);
      if (ch === "produit") e = document.querySelector('input[name="mf-produit"]');
      if (ch === "canal") e = document.getElementById("mf-canal");
      if (ch === "decl") e = document.getElementById("mf-decl");
      if (e) { if (e.scrollIntoView) e.scrollIntoView({ block: "center" }); e.focus(); }
      return;
    }
    var st = store(), c = client();
    if (etat.remplace) { var ancien = M.rapport(st, etat.remplace); if (ancien && !ancien.dispo && !M.utilise(st, ancien.id)) M.supprimerRapport(st, ancien.id); etat.remplace = null; }
    var res = M.creerRapport(st, c, etat.produit, k.rep, { canal: etat.canal });
    if (!res.ok) { etat.err = res; majForm(); return; }
    B.store.sauver();
    etat.rapport = res.rapport.id; etat.vue = "rapport"; etat.decl = false;
    etat.msg = "Questionnaire enregistré : le profil du client est mis à jour et le rapport de conseil est établi. Mettez-le à disposition du client.";
    majClient(); majCorps(); focus("t-rapport");
  }

  /* ---------- événements ---------- */
  app.addEventListener("input", function (e) {
    if (e.target.id === "cl-q") { etat.q = e.target.value; suggestions(); }
  });
  app.addEventListener("change", function (e) {
    var t = e.target;
    if (!t.closest("#mf-form")) return;
    var avant = etat.rep.durable, prod = etat.produit;
    lire();
    if (t.name === "mf-produit" && prod !== etat.produit) { etat.err = null; majForm(); var r = document.querySelector('input[name="mf-produit"]:checked'); if (r) r.focus(); }
    else if (t.name === "mf-durable" && (avant === "d0" || !avant) !== (etat.rep.durable === "d0")) { majForm(); var d = document.querySelector('input[name="mf-durable"]:checked'); if (d) d.focus(); }
  });
  app.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && e.target.id === "cl-q") { e.preventDefault(); var b = document.querySelector("#cl-res button[data-act=choisir-client]"); if (b) b.click(); }
  });
  app.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    var act = b.getAttribute("data-act"), id = b.getAttribute("data-id");
    if (act === "choisir-client") { choisirClient(parseInt(id, 10)); etat.q = ""; majClient(); majCorps(); focus("cl-choisi"); }
    else if (act === "retirer-client") { etat.client = null; etat.vue = "form"; etat.rapport = null; etat.rep = {}; majClient(); majCorps(); var q = document.getElementById("cl-q"); if (q) q.focus(); }
    else if (act === "voir") { etat.rapport = id; etat.vue = "rapport"; etat.msg = ""; var r = M.rapport(store(), id); if (r) { etat.produit = r.p; etat.canal = r.canal; } majCorps(); focus("t-rapport"); }
    else if (act === "retour-form") { etat.vue = "form"; etat.rapport = null; etat.msg = ""; majCorps(); focus("t-form"); }
    else if (act === "refaire") {
      var r2 = M.rapport(store(), etat.rapport); if (!r2) return;
      preremplir(); Object.keys(r2.rep).forEach(function (k) { etat.rep[k] = r2.rep[k]; }); etat.rep.montant = String(r2.rep.montant).replace(".", ",");
      etat.produit = r2.p; etat.canal = r2.canal; etat.remplace = r2.dispo ? null : r2.id; etat.vue = "form"; etat.decl = false; etat.err = null; etat.msg = "";
      majCorps(); focus("t-form");
    }
    else if (act === "dispo") {
      var st = store(), cb = document.getElementById("mf-maintien"), res = M.mettreADisposition(st, etat.rapport, { maintien: !!(cb && cb.checked) });
      if (!res.ok) { etat.msg = ""; var er = document.getElementById("mf-ok"); majCorps(); er = document.getElementById("mf-ok"); if (er) { er.textContent = res.erreur; er.classList.add("mf-ok-err"); er.focus(); } return; }
      B.store.sauver(); etat.msg = res.rapport.dispo.mode === "agence" ? "Rapport remis au client en agence : imprimez-le pour lui en donner un exemplaire. Vous pouvez maintenant souscrire." : "Rapport mis à disposition du client dans son espace client, avec une notification par e-mail. Vous pouvez maintenant souscrire.";
      majCorps(); focus("mf-ok");
    }
    else if (act === "imprimer") imprimerRapport();
    else if (act === "suppr") { etat.suppr = id; majHist(); }
    else if (act === "suppr-non") { etat.suppr = null; majHist(); }
    else if (act === "suppr-oui") { M.supprimerRapport(store(), id); B.store.sauver(); etat.suppr = null; if (etat.rapport === id) { etat.rapport = null; etat.vue = "form"; majCorps(); } else majHist(); }
  });
  app.addEventListener("submit", function (e) { if (e.target.id === "mf-form") { e.preventDefault(); envoyer(); } });
  document.addEventListener("click", function (e) { if (!e.target.closest(".cl-q, .cl-res")) { var z = document.getElementById("cl-res"); if (z) z.hidden = true; } });

  render();
  RECH.init(CL, document.getElementById("rech"), document.getElementById("rech-res"), document.getElementById("rech-statut"));
})();
