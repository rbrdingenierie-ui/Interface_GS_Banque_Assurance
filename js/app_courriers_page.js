/* GS Banque & Assurance – page « Courriers et documents » : les documents à remettre au client et à faire signer, sans passer par son dossier.
   Le conseiller choisit le client (ou arrive ici depuis l'accueil, la recherche ou un lien « ?client= »), puis voit le document tel qu'il sera imprimé ;
   l'écran est celui de l'onglet « Courriers et documents » de la fiche client (ui_courriers.js). */
(function () {
  "use strict";

  var SG = window.SGBF, B = SG.banque, CL = SG.clients, ICO = SG.icones, RECH = SG.recherche, COUR = SG.courriersUI, app = document.getElementById("app");
  var esc = B.esc;
  var CLIENT = {}; CL.forEach(function (c) { CLIENT[c.id] = c; });
  var params = new URLSearchParams(location.search);
  var courant = CLIENT[parseInt(params.get("client"), 10)] || null;
  /* Lettre de droit au compte d'un dossier refusé dont le demandeur n'est pas client (depuis le dossier d'ouverture de compte) : pas de choix de client. */
  var dosProspect = params.get("doc") === "droit_compte" && COUR.dossierSansClient ? COUR.dossierSansClient(params.get("dossier")) : null;

  function nomComplet(c) { return c.civ + " " + c.prenom + " " + c.nom.toUpperCase(); }
  function selecteur() {
    var l = CL.slice().sort(function (a, b) { var x = a.nom + " " + a.prenom, y = b.nom + " " + b.prenom; return x < y ? -1 : x > y ? 1 : 0; });
    return '<div class="champ pg-op-choix"><label for="cd-client">Client *</label><select id="cd-client"><option value="">Choisir un client</option>' + l.map(function (c) {
      return '<option value="' + c.id + '"' + (courant && courant.id === c.id ? " selected" : "") + ">" + esc(c.nom.toUpperCase() + " " + c.prenom + " – " + c.age + " ans") + "</option>";
    }).join("") + "</select></div>";
  }
  function entete(c) {
    return '<p class="pg-op-client"><strong>' + esc(nomComplet(c)) + "</strong> – n° " + esc(c.num) + " – " + c.age + " ans – " + esc(c.pro.prof) + '</p><p class="en-liens"><a class="btn-texte" href="client.html?id=' + c.id + '#courriers">Ouvrir le dossier complet</a></p>';
  }
  function corps() {
    if (dosProspect) return COUR.htmlDossier(dosProspect);
    if (!courant) return '<p class="vide-bloc">Choisissez le client pour afficher le document à lui remettre : la liste des pièces à fournir pour ouvrir un compte ou pour l\'étude de sa demande de prêt (prêt immobilier ou crédit à la consommation), les courriers à lui adresser et la lettre de refus d\'ouverture de compte (droit au compte).</p>';
    return entete(courant) + COUR.html(courant);
  }
  function render() {
    document.title = (courant ? "Courriers et documents – " + courant.prenom + " " + courant.nom + " – " : "Courriers et documents – ") + "GS Banque & Assurance";
    var sel = document.getElementById("cd-client");
    if (!sel) {
      app.innerHTML = '<nav class="fil-ariane" aria-label="Fil d\'Ariane"><a href="index.html">' + ICO.retour + 'Accueil</a></nav>' +
        '<div class="page-titre"><h1>Courriers et documents</h1><p>Les documents à remettre au client et à faire signer : choisissez le client, puis imprimez le document.</p></div>' +
        '<section class="bloc" aria-labelledby="cd-p-t"><h2 class="sr" id="cd-p-t">' + (dosProspect ? "Dossier" : "Client") + '</h2>' + (dosProspect ? "" : selecteur()) + '<div id="cd-hote">' + corps() + "</div></section>";
    } else document.getElementById("cd-hote").innerHTML = corps();
  }
  app.addEventListener("change", function (e) {
    if (e.target.id !== "cd-client") return;
    courant = CLIENT[parseInt(e.target.value, 10)] || null;
    try { history.replaceState(null, "", courant ? "courriers.html?client=" + courant.id + COUR.suffixeAdresse() : "courriers.html"); } catch (x) { /* ignoré */ }
    render();
    var t = document.getElementById("cd-t"); if (t) t.focus();
  });
  COUR.lier(app);
  RECH.init(CL, document.getElementById("rech"), document.getElementById("rech-res"), document.getElementById("rech-statut"));
  render();
})();
