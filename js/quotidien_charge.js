/* GS Banque & Assurance – mise en place des dossiers « du jour » dans la page.
   Chaque jour, la classe reçoit les mêmes dossiers (de 5 à 20 par outil) ; le lendemain, d'autres. Ce script remplace la liste des dossiers de référence
   (data.js, data_atypiques.js) par la liste du jour, avant le démarrage de l'outil.
   Deux réglages facultatifs, pour l'enseignant, dans l'adresse de la page :
     ?jour=2026-12-03   rejoue la liste d'une autre date (même liste pour toute la classe) ;
     ?jour=reference    reprend les dossiers de référence d'origine (30 dossiers débiteurs, 20 dossiers atypiques, 16 dossiers d'incidents), identiques tous les jours. */
(function (root) {
  "use strict";

  var S = root.SGBF, B = S.banque, Q = S.quotidien, QB = S.quotidienBase;

  function reglage() {
    var v = "";
    try { v = new URLSearchParams(root.location.search).get("jour") || ""; } catch (e) { v = ""; }
    return v || root.SGBF_JOUR || "";
  }

  var demande = reglage(), J = { ymd: null, date: null, reference: false, debiteurs: null, atypiques: null, incidents: null };
  if (demande === "reference") { J.ymd = "reference"; J.reference = true; }
  else if (/^\d{4}-\d{2}-\d{2}$/.test(demande) && QB.lireYmd(demande)) { J.ymd = demande; J.date = B.lireYmd(demande); }
  else J.ymd = B.ymd(B.aujourdhui());

  if (S.dossiers && !S.dossiersReference) {
    S.dossiersReference = S.dossiers; S.relevesReference = S.releves || {};
    if (!J.reference) { J.debiteurs = Q.debiteurs(J.ymd); S.dossiers = J.debiteurs.dossiers; S.releves = J.debiteurs.releves; }
  }
  if (S.atypiques && !S.atypiquesReference) {
    S.atypiquesReference = S.atypiques; S.relevesAtypReference = S.relevesAtyp || {};
    if (!J.reference) { J.atypiques = Q.atypiques(J.ymd); S.atypiques = J.atypiques.dossiers; S.relevesAtyp = J.atypiques.releves; }
  }
  if (S.incidents && !S.incidentsReference) {
    S.incidentsReference = S.incidents;
    if (!J.reference) { J.incidents = Q.incidents(J.ymd); S.incidents = J.incidents.dossiers; }
  }
  /* « maintenant » de l'exercice : la date réelle, ou celle demandée dans l'adresse */
  J.maintenant = function () { return J.date ? new Date(J.date.getTime()) : new Date(); };
  S.jourTravail = J;
})(window);
