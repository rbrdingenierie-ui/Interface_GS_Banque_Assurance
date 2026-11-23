/* GS Banque & Assurance – impression et PDF : monte un document daté, avec l'identité de la banque, puis ouvre la fenêtre d'impression du navigateur.
   Dans cette fenêtre, choisir « Enregistrer au format PDF » comme imprimante pour obtenir un fichier PDF. */
(function (root) {
  "use strict";
  var B = root.SGBF.banque, esc = B.esc;

  function nomFichier(s) {
    return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }
  /* Le logo est celui déjà affiché dans l'en-tête de la page (même fichier, déjà chargé) : il figure donc sur tous les documents imprimés. */
  function logoSrc() { var im = document.querySelector(".logo-tuile img"); return im ? im.getAttribute("src") : "assets/logo.png"; }
  /* Document complet : en-tête (logo, agence, titre, date, « Établi par »), corps.
     « Établi par : Prénom Nom » est ajouté à tous les documents de l'élève ; le nom est écrit au moment de l'impression (monter), après sa saisie dans la fenêtre d'identite.js.
     Pas de mention pour un courrier (la signature de l'e-mail porte déjà le nom) ni pour un document que la banque édite elle-même (relevé de compte : sansAuteur). */
  /* En-tête d'une lettre de la banque (o.lettre) : papier à en-tête (logo, nom de la banque, adresse de l'agence), sans titre de document ni « Édité le » : la lettre porte déjà sa date et son objet.
     Le même en-tête sert à l'aperçu à l'écran. Un <div> et non un <header> : dans une fenêtre ou une région, un <header> serait lu comme un bandeau de page (règle d'accessibilité). */
  function enteteLettre() {
    return '<div class="dp-entete dp-entete-lettre"><div class="dp-marque"><img src="' + esc(logoSrc()) + '" width="56" height="56" alt=""><div><p class="dp-banque">GS Banque & Assurance</p><p class="dp-agence">Agence de Paris</p></div></div>' +
      '<div class="dp-coord"><p>27 rue de Châteaudun</p><p>75009 Paris</p></div></div>';
  }
  function document_(o) {
    if (o.lettre) return '<article class="dp dp-courrier dp-papier">' + enteteLettre() + o.corps + "</article>";
    var edite = B.fmtLong(B.aujourdhui());
    var auteur = o.courrier || o.sansAuteur ? "" : '<p class="dp-date dp-auteur" data-auteur><strong>Établi par :</strong> <span data-eleve></span></p>';
    return '<article class="dp' + (o.courrier ? " dp-courrier" : "") + (o.classe ? " " + esc(o.classe) : "") + '">' +
      '<header class="dp-entete"><div class="dp-marque"><img src="' + esc(logoSrc()) + '" width="56" height="56" alt=""><div><p class="dp-banque">GS Banque & Assurance</p><p class="dp-agence">Agence de Paris</p></div></div>' +
      '<div class="dp-titre"><h1>' + esc(o.titre) + "</h1>" + (o.sous ? "<p>" + esc(o.sous) + "</p>" : "") + "<p class=\"dp-date\">Édité le " + esc(edite) + "</p>" + auteur + "</div></header>" +
      o.corps + "</article>";
  }
  var ancienTitre = null, actif = false;
  function zone() {
    var z = document.getElementById("doc-impression");
    if (!z) { z = document.createElement("div"); z.id = "doc-impression"; document.body.appendChild(z); }
    return z;
  }
  function monter(html, fichier) {
    var z = zone();
    z.innerHTML = html;
    if (root.SGBF.identite) root.SGBF.identite.remplir(z);
    if (!actif) ancienTitre = document.title;
    actif = true;
    document.title = fichier || document.title;
    document.documentElement.classList.add("impression-doc");
    return z;
  }
  function demonter() {
    var z = document.getElementById("doc-impression");
    if (z) z.innerHTML = "";
    document.documentElement.classList.remove("impression-doc");
    if (actif && ancienTitre != null) document.title = ancienTitre;
    actif = false;
  }
  /* Attend, au plus 1,5 s, que les images du document (le logo) soient chargées avant d'ouvrir l'impression. */
  function imagesPretes(z, suite) {
    var attente = [].slice.call(z.querySelectorAll("img")).filter(function (i) { return !(i.complete && i.naturalWidth > 0); });
    if (!attente.length) { suite(); return; }
    var n = attente.length, fait = false;
    function go() { if (fait) return; fait = true; suite(); }
    function un() { n--; if (n <= 0) go(); }
    attente.forEach(function (i) { i.addEventListener("load", un); i.addEventListener("error", un); });
    setTimeout(go, 1500);
  }
  /* Ouvre la fenêtre d'impression. Le titre de la page sert de nom de fichier proposé pour le PDF. */
  function imprimer(html, fichier) {
    /* Un document qui porte « Établi par » ne s'imprime qu'une fois le prénom et le nom de l'élève confirmés pour cette connexion : la fenêtre de saisie s'ouvre sinon. */
    var ID = root.SGBF.identite;
    if (ID && String(html).indexOf("data-auteur") >= 0) { ID.exiger(function () { lancer(html, fichier); }); return; }
    lancer(html, fichier);
  }
  function lancer(html, fichier) {
    var z = monter(html, fichier);
    var fini = false;
    function fin() { if (fini) return; fini = true; window.removeEventListener("afterprint", fin); demonter(); }
    window.addEventListener("afterprint", fin);
    imagesPretes(z, function () { try { window.print(); } catch (e) { fin(); } });
  }
  var api = { document: document_, enteteLettre: enteteLettre, logo: logoSrc, monter: monter, demonter: demonter, imprimer: imprimer, nomFichier: nomFichier };
  root.SGBF.impression = api;
})(window);
