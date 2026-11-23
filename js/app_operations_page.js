/* GS Banque & Assurance – page « Opérations de service » : réaliser une opération pour un client (virement, opposition ou contestation de carte, plafond, chéquier, chèque de banque, retrait d'espèces, devises…)
   sans passer par son dossier. Le conseiller choisit le client (ou arrive ici depuis la fenêtre d'un appel ou d'un client au distributeur, ou depuis l'accueil), puis voit les tuiles des opérations ;
   le déroulement (vérification d'identité, contrôles, document à faire signer, exécution) est celui de l'onglet « Opérations » de la fiche client : même écran, mêmes règles (app_operations.js). */
(function () {
  "use strict";

  var SG = window.SGBF, B = SG.banque, CL = SG.clients, ICO = SG.icones, RECH = SG.recherche, OPUI = SG.operationsUI, app = document.getElementById("app");
  var esc = B.esc;
  var CLIENT = {}; CL.forEach(function (c) { CLIENT[c.id] = c; });
  var params = new URLSearchParams(location.search);
  var courant = CLIENT[parseInt(params.get("client"), 10)] || null;

  function nomComplet(c) { return c.civ + " " + c.prenom + " " + c.nom.toUpperCase(); }
  function selecteur() {
    var l = CL.slice().sort(function (a, b) { var x = a.nom + " " + a.prenom, y = b.nom + " " + b.prenom; return x < y ? -1 : x > y ? 1 : 0; });
    return '<div class="champ pg-op-choix"><label for="op-client">Client *</label><select id="op-client"><option value="">Choisir un client</option>' + l.map(function (c) {
      return '<option value="' + c.id + '"' + (courant && courant.id === c.id ? " selected" : "") + ">" + esc(c.nom.toUpperCase() + " " + c.prenom + " – " + c.age + " ans") + "</option>";
    }).join("") + "</select></div>";
  }
  function entete(c) {
    return '<p class="pg-op-client"><strong>' + esc(nomComplet(c)) + "</strong> – n° " + esc(c.num) + " – " + c.age + " ans – " + esc(c.pro.prof) + '</p><p class="en-liens"><a class="btn-texte" href="client.html?id=' + c.id + '">Ouvrir le dossier complet du client</a><a class="btn-texte" href="client.html?id=' + c.id + '#compte">Relevé du compte courant</a></p>';
  }
  function corps() {
    if (!courant) return '<p class="vide-bloc">Choisissez le client pour afficher les opérations que vous pouvez réaliser pour lui : virements, opposition ou contestation de carte, plafond, chéquier, chèque de banque, retrait d\'espèces, devises.</p>';
    return entete(courant) + OPUI.html(courant);
  }
  function render() {
    document.title = (courant ? "Opérations – " + courant.prenom + " " + courant.nom + " – " : "Opérations de service – ") + "GS Banque & Assurance";
    var sel = document.getElementById("op-client");
    if (!sel) {
      app.innerHTML = '<nav class="fil-ariane" aria-label="Fil d\'Ariane"><a href="index.html">' + ICO.retour + 'Accueil</a></nav>' +
        '<div class="page-titre"><h1>Opérations de service</h1><p>Réalisez une opération pour un client sans ouvrir son dossier : choisissez le client, puis l\'opération.</p></div>' +
        '<section class="bloc" aria-labelledby="op-p-t"><h2 class="sr" id="op-p-t">Client</h2>' + selecteur() + '<div id="op-hote">' + corps() + "</div></section>";
    } else document.getElementById("op-hote").innerHTML = corps();
  }
  app.addEventListener("change", function (e) {
    if (e.target.id !== "op-client") return;
    courant = CLIENT[parseInt(e.target.value, 10)] || null;
    try { history.replaceState(null, "", courant ? "operations.html?client=" + courant.id : "operations.html"); } catch (x) { /* ignoré */ }
    render();
    var t = document.getElementById("op-t-choix"); if (t) { t.setAttribute("tabindex", "-1"); t.focus(); }
  });
  /* « Voir le relevé du compte » (dans la vue d'une opération) : ici, c'est la fiche du client. */
  document.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest('[data-op="releve"]') : null;
    if (b && courant) location.href = "client.html?id=" + courant.id + "#compte";
  });
  RECH.init(CL, document.getElementById("rech"), document.getElementById("rech-res"), document.getElementById("rech-statut"));
  render();
})();
