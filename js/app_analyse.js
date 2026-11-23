/* GS Banque & Assurance – analyse du portefeuille : répartition des clients selon un critère (PCS, âge, famille, logement…), indicateurs par segment,
   comparaison avec Paris, lecture qualitative d'un segment, analyse personnelle de l'étudiant, impression et PDF. */
(function () {
  "use strict";

  var B = window.SGBF.banque, CL = window.SGBF.clients, A = window.SGBF.analyse, ICO = window.SGBF.icones, RECH = window.SGBF.recherche, IMP = window.SGBF.impression, PR = window.SGBF.produits;
  var VOL = window.SGBF.volets;
  var app = (VOL && VOL.panneau("analyse")) || document.getElementById("app");
  var esc = B.esc;
  var etat = { dim: "pcs", seg: {}, nbCl: 12, msg: "" };
  var params = VOL ? VOL.params("analyse") : new URLSearchParams(location.search);
  if (A.DIMENSIONS.some(function (d) { return d.id === params.get("critere"); })) etat.dim = params.get("critere");

  function pl(n, s, p) { return B.nb(n) + " " + (n > 1 ? p : s); }
  function f1(x) { return B.nb(Math.round(x * 10) / 10); }
  /* pourcentages des tableaux de répartition et de comparaison : toujours une décimale (3,1 %, 22,0 %, 100,0 %) */
  var nf1 = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  function pc(x) { return nf1.format(Math.round(x * 10) / 10) + " %"; }
  function nomComplet(c) { return c.prenom + " " + c.nom; }
  function store() { return B.store.charger(); }
  function dimension() { return A.DIMENSIONS.filter(function (d) { return d.id === etat.dim; })[0]; }
  function segChoisi(res) {
    var i = etat.seg[etat.dim];
    if (i == null || !res.segments[i] || !res.segments[i].m.n) {
      i = 0; res.segments.forEach(function (s, k) { if (s.m.n > res.segments[i].m.n || !res.segments[i].m.n) i = k; });
      if (!res.segments[i].m.n) i = 0;
    }
    return i;
  }
  function minus(l) { return l.charAt(0).toLowerCase() + l.slice(1); }
  function pctSigne(x) { var v = Math.round(x * 10) / 10; return (v > 0 ? "+" : v < 0 ? "−" : "") + nf1.format(Math.abs(v)); }

  /* ---------- tableaux (communs à l'écran et à l'impression) ---------- */
  function tableRepartition(res, avecBarres) {
    var max = 0; res.segments.forEach(function (s) { if (s.pct > max) max = s.pct; });
    var lignes = res.segments.map(function (s) {
      var barre = avecBarres ? '<span class="barre" aria-hidden="true"><span style="width:' + (max ? Math.round(100 * s.pct / max) : 0) + '%"></span></span>' : "";
      return '<tr><th scope="row">' + esc(s.lib) + '</th><td data-label="Clients">' + B.nb(s.m.n) + '</td><td class="atteinte b" data-label="Part du portefeuille"><div class="atteinte-ligne">' + barre + '<span class="atteinte-val">' + pc(s.pct) + "</span></div></td></tr>";
    }).join("");
    return '<table class="tab-ventes tab-rep"><caption class="sr">Répartition des ' + res.total + " clients selon le critère : " + esc(res.dimension.lib) + '</caption><thead><tr><th scope="col">' + esc(res.dimension.court) + '</th><th scope="col">Clients</th><th scope="col">Part du portefeuille</th></tr></thead><tbody>' + lignes +
      '</tbody><tfoot><tr><th scope="row">Ensemble</th><td data-label="Clients">' + B.nb(res.total) + '</td><td data-label="Part du portefeuille">100 %</td></tr></tfoot></table>';
  }
  function tableProfil(res) {
    function ligne(lib, m, tot) {
      return "<tr><" + (tot ? "th" : "th") + ' scope="row">' + esc(lib) + '</th><td data-label="Clients">' + B.nb(m.n) + '</td><td data-label="Âge moyen">' + (m.n ? B.nb(Math.round(m.age)) + " ans" : "–") + '</td><td data-label="Revenu mensuel moyen du foyer">' + (m.n ? B.eur(m.foyer) : "–") + '</td><td data-label="Médiane">' + (m.n ? B.eur(m.foyerMed) : "–") + '</td><td data-label="Propriétaires">' + (m.n ? B.pct(Math.round(m.proprio)) : "–") + "</td></tr>";
    }
    return '<table class="tab-ventes tab-ind"><caption class="sr">Profil des clients de chaque segment</caption><thead><tr><th scope="col">' + esc(res.dimension.court) + '</th><th scope="col">Clients</th><th scope="col">Âge moyen</th><th scope="col">Revenu mensuel moyen du foyer</th><th scope="col">Médiane</th><th scope="col">Propriétaires</th></tr></thead><tbody>' +
      res.segments.map(function (s) { return ligne(s.lib, s.m); }).join("") + "</tbody><tfoot>" + ligne("Ensemble", res.ensemble, true) + "</tfoot></table>";
  }
  function tableEquipement(res) {
    function ligne(lib, m) {
      var v = m.n > 0;
      return '<tr><th scope="row">' + esc(lib) + '</th><td data-label="Produits par client">' + (v ? f1(m.produits) : "–") + '</td><td data-label="Épargne bancaire">' + (v ? B.pct(Math.round(m.epargne)) : "–") + '</td><td data-label="Placements et retraite">' + (v ? B.pct(Math.round(m.placement)) : "–") + '</td><td data-label="Crédit">' + (v ? B.pct(Math.round(m.credit)) : "–") + '</td><td data-label="Assurance">' + (v ? B.pct(Math.round(m.assurance)) : "–") + '</td><td data-label="Encours moyen">' + (v ? B.eur(m.encours) : "–") + '</td><td data-label="Avec opportunité">' + (v ? B.pct(Math.round(m.opp)) : "–") + "</td></tr>";
    }
    return '<table class="tab-ventes tab-ind"><caption class="sr">Équipement des clients de chaque segment</caption><thead><tr><th scope="col">' + esc(res.dimension.court) + '</th><th scope="col">Produits par client</th><th scope="col">Épargne bancaire</th><th scope="col">Placements et retraite</th><th scope="col">Crédit</th><th scope="col">Assurance</th><th scope="col">Encours moyen</th><th scope="col">Avec opportunité</th></tr></thead><tbody>' +
      res.segments.map(function (s) { return ligne(s.lib, s.m); }).join("") + "</tbody><tfoot>" + ligne("Ensemble", res.ensemble) + "</tfoot></table>";
  }
  function tableComparaison(cmp, avecBarres) {
    var lignes = cmp.lignes.map(function (l) {
      var ec = l.pct - l.paris;
      return '<tr><th scope="row">' + esc(l.lib) + '</th><td data-label="Clients">' + B.nb(l.n) + '</td><td data-label="Portefeuille">' + pc(l.pct) + '</td><td data-label="Paris">' + pc(l.paris) + '</td><td data-label="France">' + pc(l.france) + '</td><td data-label="Écart avec Paris (points)">' + pctSigne(ec) + "</td></tr>";
    }).join("");
    return '<table class="tab-ventes tab-cmp"><caption class="sr">Catégories socioprofessionnelles des actifs en emploi : portefeuille, Paris et France</caption><thead><tr><th scope="col">Catégorie</th><th scope="col">Clients actifs en emploi</th><th scope="col">Portefeuille</th><th scope="col">Paris</th><th scope="col">France</th><th scope="col">Écart avec Paris (points)</th></tr></thead><tbody>' + lignes +
      '</tbody><tfoot><tr><th scope="row">Ensemble des actifs en emploi</th><td data-label="Clients">' + B.nb(cmp.n) + '</td><td data-label="Portefeuille">100 %</td><td data-label="Paris">100 %</td><td data-label="France">100 %</td><td data-label="Écart">–</td></tr></tfoot></table>';
  }
  function graphiqueComparaison(cmp) {
    var max = 0; cmp.lignes.forEach(function (l) { max = Math.max(max, l.pct, l.paris, l.france); });
    function b(cls, lib, v) { return '<span class="cmp-b ' + cls + '"><span class="cmp-barre" style="width:' + (max ? Math.max(0.6, 76 * v / max).toFixed(1) : 0) + '%"></span><span class="cmp-val"><span class="sr">' + lib + " : </span>" + pc(v) + "</span></span>"; }
    return '<ul class="cmp" aria-label="Comparaison des catégories socioprofessionnelles : portefeuille, Paris, France">' + cmp.lignes.map(function (l) {
      return '<li><span class="cmp-lib">' + esc(l.lib) + '</span><span class="cmp-barres">' + b("cmp-pf", "Portefeuille", l.pct) + b("cmp-pa", "Paris", l.paris) + b("cmp-fr", "France", l.france) + "</span></li>";
    }).join("") + '</ul><p class="cmp-legende" aria-hidden="true"><span class="cmp-pt cmp-pf"></span>Portefeuille <span class="cmp-pt cmp-pa"></span>Paris <span class="cmp-pt cmp-fr"></span>France</p>';
  }
  function tableRetraites(rt) {
    return '<table class="tab-ventes tab-ret"><caption class="sr">Retraités selon leur ancienne profession</caption><thead><tr><th scope="col">Ancienne profession (catégorie)</th><th scope="col">Retraités</th><th scope="col">Part des retraités</th></tr></thead><tbody>' +
      rt.parGroupe.map(function (g) { return '<tr><th scope="row">' + esc(g.lib) + '</th><td data-label="Retraités">' + B.nb(g.n) + '</td><td data-label="Part">' + pc(rt.n ? 100 * g.n / rt.n : 0) + "</td></tr>"; }).join("") +
      '</tbody><tfoot><tr><th scope="row">Ensemble des retraités</th><td data-label="Retraités">' + B.nb(rt.n) + '</td><td data-label="Part">100 %</td></tr></tfoot></table>';
  }

  /* ---------- lecture qualitative ---------- */
  function lectureHtml(seg, res) {
    var p = A.portrait(seg, res.ensemble, etat.dim), h = "";
    h += '<ul class="lecture-faits">' + p.phrases.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>";
    if (p.reserve) h += '<p class="lecture-reserve">' + esc(p.reserve) + "</p>";
    if (p.professions && p.professions.length) h += "<h3>Professions les plus fréquentes</h3><p>" + p.professions.map(function (x) { return esc(x.lib) + " (" + x.n + ")"; }).join(" ; ") + ".</p>";
    if (p.typique && p.typique.length) h += "<h3>Profil le plus fréquent</h3><p>" + p.typique.map(function (t) { return esc(t.dim.toLowerCase()) + " : " + esc(t.lib) + " (" + t.pct + " %)"; }).join(" ; ") + ".</p>";
    if (p.ecarts.length) h += "<h3>Équipement : écarts avec l'ensemble du portefeuille</h3><ul class=\"lecture-faits\">" + p.ecarts.map(function (e) { return "<li>" + esc(e.lib.charAt(0).toUpperCase() + e.lib.slice(1)) + " : " + e.seg + " % des clients du segment, contre " + e.ens + " % pour l'ensemble (" + (e.ecart > 0 ? "+" : "−") + Math.abs(e.ecart) + " points).</li>"; }).join("") + "</ul>";
    else h += "<h3>Équipement : écarts avec l'ensemble du portefeuille</h3><p>Aucun écart de 5 points ou plus sur l'épargne, les placements, le crédit ou l'assurance.</p>";
    if (p.projets.length) h += "<h3>Projets connus</h3><p>" + pl(p.nbProjets, "client a", "clients ont") + " au moins un projet noté. Les plus fréquents : " + p.projets.map(function (x) { return esc(x.lib) + " (" + x.n + ")"; }).join(" ; ") + ".</p>";
    else h += "<h3>Projets connus</h3><p>Aucun projet noté pour les clients de ce segment.</p>";
    h += "<h3>Opportunités détectées dans les dossiers</h3>" + (p.opportunites.length ? "<p>" + pl(p.nbOpp, "client a", "clients ont") + " au moins une opportunité. Les plus fréquentes : " + p.opportunites.map(function (x) { return esc(x.lib) + " (" + x.n + ")"; }).join(" ; ") + ".</p>" : "<p>Aucune opportunité détectée.</p>");
    h += "<h3>Relation avec la banque</h3><p>" + (p.contact.nbSansNote ? pl(p.contact.nbSansNote, "client sans contact enregistré", "clients sans contact enregistré") + " (" + p.contact.sansNote + " % du segment)." : "Tous les clients ont au moins un contact enregistré.") + (p.contact.anciens ? " " + pl(p.contact.anciens, "client dont le dernier contact date", "clients dont le dernier contact date") + " de plus d'un an." : "") + "</p>";
    return h;
  }
  function listeClients(seg, plus) {
    var l = seg.clients.slice().sort(function (a, b) { return a.nom < b.nom ? -1 : a.nom > b.nom ? 1 : a.prenom < b.prenom ? -1 : 1; });
    var vus = l.slice(0, plus);
    return { vus: vus, total: l.length };
  }

  /* ---------- page ---------- */
  function blocCritere() {
    var puces = A.DIMENSIONS.map(function (d) { return '<button type="button" class="filtre" aria-pressed="' + (d.id === etat.dim) + '" data-act="dim" data-d="' + d.id + '">' + esc(d.lib) + "</button>"; }).join("");
    return '<section class="bloc" aria-labelledby="t-crit"><div class="bloc-tete"><h2 id="t-crit">Critère de classement</h2><span class="sous">' + CL.length + " clients – chaque client est classé dans un seul segment</span></div>" +
      '<div class="filtres" role="group" aria-label="Choisir le critère de classement">' + puces + "</div>" +
      '<div class="actions-impr"><button type="button" class="btn btn-secondaire btn-impr" data-act="imprimer">' + ICO.imprimante + '<span>Imprimer ou enregistrer en PDF</span></button>' +
      '<span class="sous">Dans la fenêtre d\'impression, choisissez « Enregistrer au format PDF » comme imprimante pour obtenir un fichier.</span></div></section>';
  }
  function blocRepartition(res) {
    var d = res.dimension, h = '<section class="bloc" id="bloc-rep" aria-labelledby="t-rep"><div class="bloc-tete"><h2 id="t-rep">Répartition des clients : ' + esc(minus(d.lib)) + '</h2><span class="sous">' + pl(res.total, "client", "clients") + "</span></div>" +
      '<div class="tab-wrap">' + tableRepartition(res, true) + "</div>";
    if (d.id === "pcs") {
      h += '<details class="detail-ventes"><summary>Comment les clients sont classés</summary><div class="aide-pcs"><p>Les huit groupes sont ceux de la nomenclature des professions et catégories socioprofessionnelles (PCS) de l\'Insee : six groupes d\'actifs, auxquels s\'ajoutent les retraités et les autres personnes sans activité professionnelle. Le classement des cas particuliers est un <strong>choix retenu pour cette analyse</strong> :</p><ul class="dp-liste">' +
        A.CONVENTIONS.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ul></div></details>";
    }
    return h + "</section>";
  }
  function blocIndicateurs(res) {
    return '<section class="bloc" id="bloc-ind" aria-labelledby="t-ind"><div class="bloc-tete"><h2 id="t-ind">Indicateurs par segment</h2><span class="sous">Moyennes et parts calculées sur les clients de chaque segment</span></div>' +
      '<h3 class="sous-titre-a">Profil des clients</h3><div class="tab-wrap">' + tableProfil(res) + "</div>" +
      '<h3 class="sous-titre-a">Équipement chez GS Banque & Assurance</h3><div class="tab-wrap">' + tableEquipement(res) + "</div>" +
      '<p class="note-pied">Épargne, placements, crédit et assurance : part des clients du segment qui détiennent au moins un contrat de la famille chez GS. Encours : épargne bancaire et placements détenus chez GS. Avec opportunité : au moins une opportunité commerciale détectée dans le dossier (celles de l\'accueil).</p></section>';
  }
  function blocComparaison() {
    var cmp = A.comparaisonPCS(CL), rt = A.retraitesParAncienne(CL);
    return '<section class="bloc" id="bloc-cmp" aria-labelledby="t-cmp"><div class="bloc-tete"><h2 id="t-cmp">Comparaison avec Paris et la France</h2><span class="sous">Actifs en emploi de 15 à 64 ans : ' + cmp.n + " clients du portefeuille</span></div>" +
      '<p class="synthese-texte">Les clients retraités, étudiants, au foyer ou sans emploi sont exclus : les chiffres de référence ne concernent que les personnes qui ont un emploi.</p>' +
      graphiqueComparaison(cmp) + '<div class="tab-wrap" style="margin-top:14px">' + tableComparaison(cmp) + "</div>" +
      '<p class="note-pied">Référence : ' + esc(cmp.source) + '. Le portefeuille compte ' + B.nb(CL.length) + " clients : sur un échantillon de cette taille, un écart de quelques points n'est pas significatif.</p>" +
      '<details class="detail-ventes"><summary>Les retraités selon leur ancienne profession</summary>' + '<div class="tab-wrap">' + tableRetraites(rt) + "</div></details></section>";
  }
  function blocLecture(res) {
    var ib = segChoisi(res), seg = res.segments[ib];
    var opts = res.segments.map(function (s, i) { return '<option value="' + i + '"' + (i === ib ? " selected" : "") + (s.m.n ? "" : " disabled") + ">" + esc(s.lib) + " (" + s.m.n + ")</option>"; }).join("");
    var lc = listeClients(seg, etat.nbCl);
    var li = lc.vus.map(function (c) {
      return '<li><a href="client.html?id=' + c.id + '">' + esc(nomComplet(c)) + '</a><span class="lc-sous">' + c.age + " ans – " + esc(c.pro.prof) + " – " + esc(c.adr.cp) + " – " + B.eur(c.pro.foyer) + " par mois</span></li>";
    }).join("");
    var q = A.QUESTIONS[etat.dim] || [];
    return '<section class="bloc" id="bloc-lect" aria-labelledby="t-lect"><div class="bloc-tete"><h2 id="t-lect">Lecture d\'un segment</h2><span class="sous">Description factuelle : à vous de l\'interpréter</span></div>' +
      '<div class="champ lect-choix"><label for="sel-seg">Segment à décrire</label><select id="sel-seg">' + opts + "</select></div>" +
      '<div class="lecture" aria-live="polite">' + lectureHtml(seg, res) + "</div>" +
      (q.length ? '<details class="detail-ventes" open><summary>Questions pour votre analyse</summary><ol class="questions">' + q.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ol></details>" : "") +
      '<details class="detail-ventes"><summary>Clients du segment (' + lc.total + ")</summary>" + (lc.total ? '<ul class="liste-lc">' + li + "</ul>" + (lc.total > lc.vus.length ? '<div class="suite"><button type="button" class="btn btn-secondaire" data-act="plus-cl">Afficher ' + Math.min(15, lc.total - lc.vus.length) + ' de plus</button><span class="sous">' + lc.vus.length + " affichés sur " + lc.total + "</span></div>" : "") : '<p class="vide-bloc">Aucun client dans ce segment.</p>') + "</details></section>";
  }
  function blocMonAnalyse() {
    var st = store(), saisie = (st.analyses && st.analyses[etat.dim]) || { txt: "" };
    return '<section class="bloc" id="bloc-mon" aria-labelledby="t-mon"><div class="bloc-tete"><h2 id="t-mon">Mon analyse</h2><span class="sous">Critère : ' + esc(minus(dimension().lib)) + "</span></div>" +
      '<div class="formulaire" style="max-width:none"><div class="champ"><label for="a-nom">Votre prénom et votre nom <span class="aide-champ">(imprimés sur le document)</span></label><input id="a-nom" maxlength="60" autocomplete="name" value="' + esc(st.eleve.nom || "") + '"></div>' +
      '<div class="champ"><label for="a-txt">Votre analyse du portefeuille</label><span class="aide-champ" id="a-aide">Constats chiffrés, explications possibles, comparaison avec Paris, actions commerciales proposées.</span><textarea id="a-txt" maxlength="4000" aria-describedby="a-aide a-msg" style="min-height:170px">' + esc(saisie.txt || "") + "</textarea></div>" +
      '<p class="msg-ok" id="a-msg" role="status">' + esc(etat.msg) + '</p><div class="actions-impr"><button type="button" class="btn btn-principal btn-impr" data-act="imprimer">' + ICO.imprimante + '<span>Imprimer ou enregistrer en PDF</span></button></div></div>' +
      '<p class="mention">Votre texte reste enregistré dans ce navigateur, sur cet ordinateur, pour chaque critère. Il n\'est envoyé nulle part.</p></section>';
  }

  /* ---------- document imprimable ---------- */
  function documentAnalyse() {
    var res = A.analyser(CL, etat.dim), d = res.dimension, ib = segChoisi(res), seg = res.segments[ib], st = store();
    var saisie = (st.analyses && st.analyses[etat.dim] && st.analyses[etat.dim].txt) || "";
    var corps = "";
    corps += '<section class="dp-bloc"><h2>Répartition des clients : ' + esc(minus(d.lib)) + "</h2>" + tableRepartition(res, true) + "</section>";
    corps += '<section class="dp-bloc"><h2>Profil des clients de chaque segment</h2>' + tableProfil(res) + "</section>";
    corps += '<section class="dp-bloc"><h2>Équipement chez GS Banque & Assurance</h2>' + tableEquipement(res) + '<p class="dp-mention">Épargne, placements, crédit, assurance : part des clients du segment qui détiennent au moins un contrat de la famille. Avec opportunité : au moins une opportunité commerciale détectée dans le dossier.</p></section>';
    if (d.id === "pcs") {
      var cmp = A.comparaisonPCS(CL);
      corps += '<section class="dp-bloc"><h2>Comparaison avec Paris et la France (actifs en emploi, 15 à 64 ans)</h2>' + tableComparaison(cmp) + '<p class="dp-mention">Référence : ' + esc(cmp.source) + ". Classement des cas particuliers : choix retenu pour cette analyse.</p></section>";
    }
    var p = A.portrait(seg, res.ensemble, etat.dim);
    corps += '<section class="dp-bloc"><h2>Lecture du segment « ' + esc(seg.lib) + " »</h2>" + lectureHtml(seg, res).replace(/<h4>/g, "<h3>").replace(/<\/h4>/g, "</h3>").replace(/class="lecture-faits"/g, 'class="dp-liste"') + "</section>";
    corps += '<section class="dp-bloc"><h2>Analyse personnelle</h2><div class="dp-saisie' + (saisie ? "" : " vide") + '">' + (saisie ? esc(saisie) : "Aucune analyse rédigée.") + "</div></section>";
    return IMP.document({ titre: "Analyse du portefeuille", sous: d.lib + " – " + CL.length + " clients", corps: corps });
  }
  function nomFichierAnalyse() {
    var d = B.aujourdhui();
    return "Analyse_portefeuille_" + IMP.nomFichier(dimension().court) + "_" + B.ymd(d);
  }

  /* ---------- rendu ---------- */
  function render() {
    var res = A.analyser(CL, etat.dim);
    app.innerHTML = '<div class="page-grille">' + blocCritere() + blocRepartition(res) + (etat.dim === "pcs" ? blocComparaison() : "") + blocIndicateurs(res) + blocLecture(res) + blocMonAnalyse() + "</div>";
  }

  /* ---------- événements ---------- */
  var minuterie = null;
  function enregistrer() {
    var st = store(), t = document.getElementById("a-txt"), n = document.getElementById("a-nom");
    if (!st.analyses) st.analyses = {};
    if (t) st.analyses[etat.dim] = { txt: t.value };
    if (n && window.SGBF.identite) { var rn = window.SGBF.identite.definir(st, n.value); if (rn.ok) window.SGBF.identite.confirmer(); }
    B.store.sauver();
    etat.msg = "Enregistré dans ce navigateur.";
    var m = document.getElementById("a-msg"); if (m) m.textContent = etat.msg;
  }
  app.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b) return;
    var act = b.getAttribute("data-act");
    if (act === "dim") {
      etat.dim = b.getAttribute("data-d"); etat.nbCl = 12; etat.msg = "";
      if (VOL) VOL.majUrl("analyse"); else { try { history.replaceState(null, "", "?critere=" + etat.dim); } catch (er) { /* ignoré */ } }
      render(); var p = app.querySelector('[data-act="dim"][data-d="' + etat.dim + '"]'); if (p) p.focus();
    } else if (act === "plus-cl") {
      etat.nbCl += 15; var z = document.getElementById("bloc-lect"), ouvert = Array.prototype.map.call(z.querySelectorAll("details"), function (d) { return d.open; });
      var res = A.analyser(CL, etat.dim); z.outerHTML = blocLecture(res);
      document.getElementById("bloc-lect").querySelectorAll("details").forEach(function (d, i) { d.open = ouvert[i]; });
      var li = document.querySelectorAll("#bloc-lect .liste-lc li"); if (li[etat.nbCl - 15]) li[etat.nbCl - 15].querySelector("a").focus();
    } else if (act === "imprimer") {
      enregistrer(); IMP.imprimer(documentAnalyse(), nomFichierAnalyse());
    }
  });
  app.addEventListener("change", function (e) {
    if (e.target.id === "sel-seg") {
      etat.seg[etat.dim] = parseInt(e.target.value, 10); etat.nbCl = 12;
      var res = A.analyser(CL, etat.dim), z = document.getElementById("bloc-lect"), ouvert = Array.prototype.map.call(z.querySelectorAll("details"), function (d) { return d.open; });
      z.outerHTML = blocLecture(res);
      document.getElementById("bloc-lect").querySelectorAll("details").forEach(function (d, i) { d.open = ouvert[i]; });
      document.getElementById("sel-seg").focus();
    }
  });
  app.addEventListener("input", function (e) {
    if (e.target.id === "a-txt" || e.target.id === "a-nom") { clearTimeout(minuterie); minuterie = setTimeout(enregistrer, 500); }
  });
  window.addEventListener("beforeunload", function () { if (minuterie) { clearTimeout(minuterie); enregistrer(); } });

  if (VOL) VOL.enregistrer("analyse", function () { return { critere: etat.dim }; });
  render();
})();
