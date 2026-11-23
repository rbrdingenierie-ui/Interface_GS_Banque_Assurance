/* GS Banque & Assurance – « Interro BDF » : parties d'affichage partagées par la page de l'outil et l'étape « Interrogation de la Banque de France » de l'ouverture de compte.
   – ecrans(consultation) : les écrans de réponse du FCC et du FICP ;
   – imprimer(consultation) : « Imprimer page » (impression ou PDF) ;
   – ouvrir(consultation, o) : fenêtre « Réponse de la Banque de France » (écrans, synthèse, Imprimer page, Retour saisie) ; o = { ouvreur, focusId } pour rendre le curseur à l'ouverture. */
(function () {
  "use strict";

  var SG = window.SGBF, B = SG.banque, X = SG.bdf, IMP = SG.impression;
  var esc = B.esc;
  var dlg = null, courante = null, ctx = null;

  function cleLibelle(c) { return c.cles.map(function (k) { return k.cle + (k.role === "jeune_fille" ? " (nom de jeune fille)" : ""); }).join(" et "); }
  function titreDoc() { return "Interrogation de la Banque de France"; }
  function nomFichier(c) {
    var n = ("Interro_BDF_" + String(c.saisie.nom).toUpperCase() + "_" + c.date).normalize("NFD").replace(/[̀-ͯ]/g, "");
    return n.replace(/[^A-Za-z0-9-]+/g, "_").replace(/^_+|_+$/g, "");
  }
  function corpsImpression(c) {
    return '<div class="dp-bdf"><p class="dp-texte"><strong>Clé de recherche :</strong> ' + esc(cleLibelle(c)) + "</p><p class=\"dp-texte\">" + esc(X.synthese(c)) + "</p>" + X.ecrans(c) + "</div>";
  }
  function imprimer(c) {
    var nom = c.saisie.nom.toUpperCase() + (c.saisie.nomNaissance ? " (née " + c.saisie.nomNaissance.toUpperCase() + ")" : "");
    IMP.imprimer(IMP.document({ titre: titreDoc(), sous: nom + " – date de naissance " + B.fmtDate(B.lireYmd(c.saisie.naissance)), corps: corpsImpression(c), courrier: false, classe: "dp-doc-bdf" }), nomFichier(c));
  }
  /* Synthèse : une phrase par fichier, en couleur selon la réponse. */
  function synthese(c) {
    var b = c.bilan;
    function ligne(f, ton, t) { return '<li class="bdf-syn bdf-syn-' + ton + '"><strong>' + f + " :</strong> " + esc(t) + "</li>"; }
    var l = "";
    if (b.fcc) l += ligne("FCC", b.fcc === "interdit" ? "bad" : "ok", b.fcc === "interdit" ? "interdit bancaire : la personne ne peut pas émettre de chèques" : "aucune inscription");
    if (b.ficp) l += ligne("FICP", b.ficp === "inscrit" ? "bad" : "ok", b.ficp === "inscrit" ? "inscrite au fichier des incidents de remboursement des crédits aux particuliers" : "aucune inscription");
    return '<ul class="bdf-synthese" aria-label="Résumé de la réponse de la Banque de France">' + l + "</ul>";
  }

  function ouvrir(c, o) {
    courante = c; ctx = o || {};
    if (!dlg) {
      dlg = document.createElement("dialog"); dlg.id = "dlg-bdf"; dlg.className = "bdf-dlg"; dlg.setAttribute("aria-labelledby", "bdf-dlg-t");
      document.body.appendChild(dlg);
      dlg.addEventListener("close", function () {
        var cible = (ctx && ctx.focusId && document.getElementById(ctx.focusId)) || (ctx && ctx.ouvreur && document.contains(ctx.ouvreur) ? ctx.ouvreur : null);
        if (cible) { try { cible.focus(); } catch (e) { /* ignoré */ } }
      });
      dlg.addEventListener("click", function (ev) {
        if (ev.target === dlg) { dlg.close(); return; }
        var b = ev.target.closest && ev.target.closest("[data-bdf]"); if (!b) return;
        var a = b.getAttribute("data-bdf");
        if (a === "fermer") dlg.close();
        else if (a === "imprimer" && courante) imprimer(courante);
      });
    }
    dlg.innerHTML = '<div class="bdf-dlg-corps"><div class="bdf-dlg-tete"><h2 id="bdf-dlg-t" tabindex="-1">Réponse de la Banque de France</h2></div>' +
      '<p class="bdf-cle-info"><strong>Clé de recherche :</strong> ' + esc(cleLibelle(c)) + "</p>" + synthese(c) +
      '<div class="bdf-ecrans">' + X.ecrans(c) + "</div>" +
      '<div class="bdf-btns"><button type="button" class="bdf-retour" data-bdf="fermer">Retour saisie</button><button type="button" class="btn btn-secondaire" data-bdf="imprimer">Imprimer page' + (SG.icones ? SG.icones.imprimante : "") + '</button></div></div>';
    if (dlg.showModal) { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute("open", "");
    var t = document.getElementById("bdf-dlg-t"); if (t) t.focus();
  }

  SG.bdfUI = { ecrans: X.ecrans, imprimer: imprimer, ouvrir: ouvrir, synthese: synthese, cleLibelle: cleLibelle, nomFichier: nomFichier };
})();
