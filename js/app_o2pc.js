/* GS Banque & Assurance – O2PC : la liste quotidienne des opportunités commerciales à saisir pendant la session de proactivité.
   La page affiche la liste du jour (o2pc.js), les filtres, l'état de chaque appel et ouvre la fiche d'appel (phoning.html) avec le client, le fondement et le produit déjà renseignés. */
(function () {
  "use strict";

  var W = window.SGBF, B = W.banque, O = W.o2pc, PH = W.phoning, PR = W.produits, RECH = W.recherche, ICO = W.icones, CL = W.clients;
  var app = document.getElementById("app");
  var boiteAide = document.getElementById("aide");
  var esc = B.esc;
  var etat = { theme: "tous", statut: "tous", liste: null };

  function store() { return B.store.charger(); }
  function pl(n, s, p) { return B.nb(n) + " " + (n > 1 ? p : s); }
  function nomCourt(c) { return c.prenom + " " + c.nom; }
  function nomProduit(pid) { return PR.parId[pid] ? PR.parId[pid].nom : pid; }
  function calculer() { etat.liste = O.liste(store()); }

  /* ---------- une carte client ---------- */
  function lienAppel(x) {
    var q = ["client=" + x.client.id, "o2pc=" + encodeURIComponent(x.theme), "base=" + x.base];
    if (x.produit) q.push("prod=" + encodeURIComponent(x.produit));
    if (x.lien) q.push("lien=" + encodeURIComponent(x.lien));
    return "phoning.html?" + q.join("&");
  }
  function etatAppel(x) {
    if (x.appel) {
      var r = PH.RESULTATS[x.appel.res];
      return { code: "fait", html: '<span class="puce puce-ok">Appelé à ' + esc(PH.heureLib(x.appel.heure)) + "</span> <span>" + esc(r ? r.lib : "") + "</span>" };
    }
    if (x.stop) return { code: "bloque", html: '<span class="puce puce-bad">Ne plus appeler</span> <span class="mention">Le client a demandé à ne plus être démarché par téléphone.</span>' };
    if (!x.quota.possible) return { code: "bloque", html: '<span class="puce puce-warn">Quota atteint</span> <span class="mention">Prochain appel de démarchage possible le ' + esc(B.fmtDate(x.quota.prochaine)) + ".</span>" };
    return { code: "afaire", html: '<span class="puce">À appeler</span> <span class="mention">' + x.quota.n + " / " + x.quota.max + " appels en 30 jours</span>" };
  }
  function carte(x) {
    var c = x.client, t = O.PAR_ID[x.theme], e = etatAppel(x), icc = x.icc;
    var autres = x.autres.length ? '<p class="mention o2-autres">Autre' + (x.autres.length > 1 ? "s" : "") + " opportunité" + (x.autres.length > 1 ? "s" : "") + " pour ce client : " + x.autres.map(function (id) { return esc(O.PAR_ID[id].court); }).join(", ") + ".</p>" : "";
    var prod = x.produit ? "<p><strong>Produit à proposer :</strong> " + esc(nomProduit(x.produit)) + (t.credit ? ' <span class="mention">(se monte en rendez-vous, dans « Montage de prêt »)</span>' : "") + "</p>"
      : '<p class="mention">Aucun produit ne s\'impose : choisissez-le pendant l\'appel selon ce que dit le client.</p>';
    var fondement = x.base === "contrat"
      ? '<p class="mention"><strong>Fondement de l\'appel :</strong> contrat en cours – le lien avec le contrat est déjà rédigé dans la fiche d\'appel.</p>'
      : '<p class="mention"><strong>Fondement de l\'appel :</strong> accord du client – vérifiez qu\'il a accepté d\'être appelé et saisissez la date de son accord dans la fiche d\'appel.</p>';
    var action = e.code === "bloque" ? "" : e.code === "fait"
      ? '<a class="btn btn-secondaire" href="phoning.html">Voir le journal des appels</a>'
      : '<a class="btn btn-principal" href="' + esc(lienAppel(x)) + '" data-act="appeler">Appeler ' + esc(nomCourt(c)) + "</a>";
    return '<li class="o2-carte' + (x.urgent ? " o2-urgent" : "") + (e.code === "fait" ? " o2-fait" : "") + '" data-theme="' + x.theme + '" data-etat="' + e.code + '">' +
      '<article aria-labelledby="o2-' + c.id + '">' +
      '<header class="o2-tete"><span class="o2-rang" aria-label="Rang ' + x.rang + '">' + x.rang + "</span>" +
      '<div class="o2-id"><h3 id="o2-' + c.id + '"><a href="client.html?id=' + c.id + '">' + esc(nomCourt(c)) + '</a> <span class="o2-age">' + c.age + " ans</span></h3>" +
      '<p class="o2-puces"><span class="puce o2-theme">' + esc(x.themeLib) + "</span>" + (x.urgent ? ' <span class="puce puce-warn">À saisir vite</span>' : "") +
      ' <span class="icc-puce ' + icc.niveau.classe + '" title="' + esc(icc.niveau.lib) + '">ICC ' + esc(icc.niveau.nom) + "</span></p></div></header>" +
      '<p class="o2-motif">' + esc(x.motif) + "</p>" +
      "<ul class=\"o2-details\">" + x.details.map(function (d) { return "<li>" + esc(d) + "</li>"; }).join("") + "</ul>" +
      prod + fondement + autres +
      '<footer class="o2-pied"><p class="o2-etat">' + e.html + '</p><p class="o2-actions">' + action + ' <a class="btn btn-secondaire" href="client.html?id=' + c.id + '">Fiche client</a></p></footer>' +
      "</article></li>";
  }

  /* ---------- la page ---------- */
  function themesDuJour(l) { var vu = {}, n = 0; l.items.forEach(function (x) { if (!vu[x.theme]) { vu[x.theme] = true; n++; } }); return n; }
  function kpis(l) {
    var faits = l.items.filter(function (x) { return !!x.appel; }).length, detect = 0;
    O.THEMES.forEach(function (t) { detect += l.pool[t.id]; });
    function k(lib, val, det) { return '<div class="kpi"><dt>' + esc(lib) + '</dt><dd class="val">' + val + "</dd>" + (det ? '<dd class="det">' + det + "</dd>" : "") + "</div>"; }
    return '<dl class="kpis o2-kpis">' + k("Clients à appeler", B.nb(l.total), "dans la liste du jour") + k("Déjà appelés", B.nb(faits), faits === l.total ? "liste terminée" : pl(l.total - faits, "client reste", "clients restent")) +
      k("Opportunités repérées", B.nb(detect), "dans tout le portefeuille") + k("Thèmes du jour", B.nb(themesDuJour(l)), "sur " + O.THEMES.length) + "</dl>";
  }
  function creneau() {
    var s = PH.situation(store(), 0), cr = s.creneau;
    return cr && cr.ok ? '<p class="o2-creneau"><span class="puce puce-ok">Créneau ouvert</span> Le démarchage téléphonique est possible maintenant.</p>'
      : '<p class="o2-creneau"><span class="puce puce-warn">Hors créneau</span> ' + esc(cr ? cr.raison.charAt(0).toUpperCase() + cr.raison.slice(1) : "") + " Préparez vos appels : les enregistrer maintenant les ferait compter « hors créneau ».</p>";
  }
  function filtres(l) {
    var nb = {}; l.items.forEach(function (x) { nb[x.theme] = (nb[x.theme] || 0) + 1; });
    var themes = O.THEMES.filter(function (t) { return nb[t.id]; });
    return '<div class="o2-filtres"><div class="champ"><label for="o2-theme">Thème</label><select id="o2-theme"><option value="tous">Tous les thèmes (' + l.total + ")</option>" + themes.map(function (t) {
      return '<option value="' + t.id + '"' + (etat.theme === t.id ? " selected" : "") + ">" + esc(t.lib) + " (" + nb[t.id] + ")</option>";
    }).join("") + '</select></div><div class="champ"><label for="o2-statut">Avancement</label><select id="o2-statut">' + [["tous", "Tous les clients"], ["afaire", "Restent à appeler"], ["fait", "Déjà appelés"]].map(function (o) {
      return '<option value="' + o[0] + '"' + (etat.statut === o[0] ? " selected" : "") + ">" + o[1] + "</option>";
    }).join("") + "</select></div></div>";
  }
  function listeHtml(l) {
    var items = l.items.filter(function (x) {
      if (etat.theme !== "tous" && x.theme !== etat.theme) return false;
      var e = etatAppel(x).code;
      return etat.statut === "tous" || (etat.statut === "fait" ? e === "fait" : e !== "fait");
    });
    if (!items.length) return '<p class="vide-bloc">Aucun client ne correspond à ces filtres.</p>';
    return '<ol class="o2-liste">' + items.map(carte).join("") + "</ol>";
  }
  function tableauThemes(l) {
    var nb = {}; l.items.forEach(function (x) { nb[x.theme] = (nb[x.theme] || 0) + 1; });
    return '<div class="tab-wrap o2-defil" tabindex="0" role="region" aria-label="Tableau des douze thèmes"><table class="tab-ventes o2-themes"><caption class="sr">Les douze thèmes d\'opportunités</caption><thead><tr><th scope="col">Thème</th><th scope="col">Ce qui est repéré</th><th scope="col">Dans le portefeuille</th><th scope="col">Dans la liste du jour</th></tr></thead><tbody>' +
      O.THEMES.map(function (t) { return '<tr><th scope="row">' + esc(t.lib) + "</th><td>" + esc(t.def) + '</td><td>' + B.nb(l.pool[t.id]) + "</td><td>" + (nb[t.id] || 0) + "</td></tr>"; }).join("") + "</tbody></table></div>";
  }
  function render() {
    var l = etat.liste, auj = B.aujourdhui();
    app.innerHTML = '<h1>O2PC : opportunités commerciales à saisir</h1>' +
      '<p class="intro">Liste de la session de proactivité du ' + esc(B.fmtLong(auj)) + ". Une dizaine de clients à appeler, choisis parce qu'un événement de leur dossier ouvre une occasion : appelez-les, notez le résultat dans la fiche d'appel.</p>" +
      kpis(l) + creneau() +
      '<section class="bloc" aria-labelledby="t-liste"><div class="bloc-tete"><h2 id="t-liste">Liste du jour</h2><span class="sous">La liste change chaque jour</span></div>' + filtres(l) +
      '<div id="z-liste" aria-live="polite">' + listeHtml(l) + "</div></section>" +
      '<section class="bloc" aria-labelledby="t-themes"><div class="bloc-tete"><h2 id="t-themes">Les douze thèmes</h2><span class="sous">Ce que l\'outil repère dans le portefeuille</span></div>' + tableauThemes(l) +
      '<p class="mention">La liste prend au plus un thème par client et varie les thèmes d\'un jour à l\'autre. Un client déjà appelé dans les ' + O.PAUSE_JOURS + " derniers jours n'est pas reproposé.</p></section>";
  }

  /* ---------- événements ---------- */
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest ? ev.target.closest("[data-act]") : null;
    if (!b) return;
    var act = b.getAttribute("data-act");
    if (act === "aide") { if (boiteAide.showModal) boiteAide.showModal(); else boiteAide.setAttribute("open", ""); }
    else if (act === "fermer-aide") { if (boiteAide.close) boiteAide.close(); else boiteAide.removeAttribute("open"); }
  });
  boiteAide.addEventListener("click", function (ev) { if (ev.target === boiteAide && boiteAide.close) boiteAide.close(); });
  app.addEventListener("change", function (ev) {
    if (ev.target.id === "o2-theme") etat.theme = ev.target.value;
    else if (ev.target.id === "o2-statut") etat.statut = ev.target.value;
    else return;
    document.getElementById("z-liste").innerHTML = listeHtml(etat.liste);
  });

  RECH.init(CL, document.getElementById("rech"), document.getElementById("rech-res"), document.getElementById("rech-statut"));
  calculer();
  render();
})();
