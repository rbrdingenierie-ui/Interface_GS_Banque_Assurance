/* GS Banque & Assurance – garde d'accès : à placer dans l'en-tête (<head>) de chaque page du site, après identifiants.js et acces.js.
   Sans session ouverte, renvoie vers la page de connexion puis ramène à la page demandée. Ajoute le bouton « Se déconnecter ».
   Rappel : contrôle fait dans le navigateur, pour filtrer l'accès de la classe ; ce n'est pas une protection informatique réelle. */
(function (root) {
  "use strict";
  var A = root.SGBF && root.SGBF.acces, doc = root.document;
  function page() {
    var seg = (root.location.pathname.split("/").pop() || "index.html");
    return A ? A.retourSur(seg + root.location.search + root.location.hash) : "index.html";
  }
  function versConnexion(suffixe) { root.location.replace("connexion.html" + suffixe); }

  if (!A || !A.sessionValide()) {
    /* Rien de la page ne doit apparaître pendant la redirection. */
    doc.documentElement.style.visibility = "hidden";
    versConnexion("?retour=" + encodeURIComponent(page()));
    return;
  }

  /* Page retrouvée dans le cache en revenant en arrière après une déconnexion : on revérifie. */
  root.addEventListener("pageshow", function (e) {
    if (e.persisted && !A.sessionValide()) { doc.documentElement.style.visibility = "hidden"; versConnexion(""); }
  });

  function bouton() {
    var zone = doc.querySelector(".entete-outils") || doc.querySelector(".entete");
    if (!zone || doc.getElementById("btn-deconnexion")) return;
    var b = doc.createElement("button");
    b.type = "button"; b.id = "btn-deconnexion"; b.className = "btn-texte btn-deco"; b.textContent = "Se déconnecter";
    b.addEventListener("click", function () { A.fermerSession(); versConnexion("?deconnecte=1"); });
    zone.appendChild(b);
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", bouton); else bouton();
})(window);
