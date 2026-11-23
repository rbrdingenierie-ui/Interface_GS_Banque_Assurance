/* GS Banque & Assurance – « Interro BDF » : interrogation de la Banque de France, fichier central des chèques (FCC) et fichier national des incidents de remboursement des crédits aux particuliers (FICP).
   Utilisée par l'outil « Interro BDF », par l'étape « Interrogation de la Banque de France » de l'ouverture de compte et par le Montage de prêt (pièce « Interro FICP »).
   Aucun affichage de page ici : règles (testées sous Node) et HTML des deux écrans de réponse.

   La recherche se fait par une clé : la date de naissance (JJMMAA, année sur deux chiffres comme dans les consultations réelles) suivie des cinq premières lettres du nom de famille ; pour une femme mariée ou veuve, on interroge aussi avec le nom de jeune fille
   (le fichier est tenu au nom de naissance). Exemple : une personne née le 2 septembre 1991 et nommée RICHARD donne 020991RICHA ; une personne née le 5 juillet 1987 et nommée DIALL donne 050787DIALL.
   Les personnes du fichier sont inventées : quelques identités d'entraînement sont listées dans l'outil ; toute autre identité obtient « Dossier inexistant » (aucune inscription), sauf les titulaires auxquels l'agence a envoyé une lettre d'injonction (regul.js) : ils sont inscrits au FCC jusqu'à la mise à jour du fichier qui suit leur régularisation.
   Les écrans reprennent la présentation des consultations de la Banque de France (bandeau bleu #3366cc, lignes crème, bandes bleu pâle, réponse en rouge ; même présentation pour le FCC et le FICP ; aucun logo) ; les rubriques d'une réponse positive du FCC et les codes de nature de crédit autres que « 08 » sont de l'exercice. */
(function (root) {
  "use strict";

  var B = root && root.SGBF ? root.SGBF.banque : require("./banque.js");
  var RG = root && root.SGBF ? root.SGBF.regul : require("./regul.js");
  var esc = B.esc;

  /* Nombre de chiffres de l'année dans la clé : 2 (JJMMAA, 020991RICHA), comme dans les captures de la consultation réelle (050787DIALL) ; mettre 4 pour une année complète (JJMMAAAA). */
  var CHIFFRES_ANNEE = 2;
  var LETTRES = 5;
  var JOURNAL_MAX = 100;
  var FICHIERS = [
    { id: "fcc", sigle: "FCC", lib: "Fichier central des chèques", resultat: "Interdit bancaire" },
    { id: "ficp", sigle: "FICP", lib: "Fichier national des incidents de remboursement des crédits aux particuliers", resultat: "Inscrit" }
  ];

  /* ---------- clé de recherche ---------- */
  function sansAccent(t) { return String(t == null ? "" : t).normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  /* Les cinq premières lettres du nom : sans accent, espaces, tirets ni apostrophes (« De la Roche » donne DELAR). */
  function lettres(nom) { return sansAccent(nom).toUpperCase().replace(/[^A-Z]/g, "").slice(0, LETTRES); }
  function dateDe(n) {
    if (n instanceof Date) return isNaN(n.getTime()) ? null : n;
    return n ? B.lireYmd(String(n)) : null;
  }
  function p2(n) { return (n < 10 ? "0" : "") + n; }
  function chiffres(d) { var a = String(d.getFullYear()); return p2(d.getDate()) + p2(d.getMonth() + 1) + (CHIFFRES_ANNEE === 2 ? a.slice(-2) : a); }
  /* Clé de recherche, ou « » si la date ou le nom manque. */
  function cle(naissance, nom) { var d = dateDe(naissance), l = lettres(nom); return d && l ? chiffres(d) + l : ""; }
  /* Les clés à interroger : le nom de famille, puis le nom de jeune fille s'il donne une autre clé. */
  function cles(saisie) {
    var s = saisie || {}, l = [], k1 = cle(s.naissance, s.nom), k2 = cle(s.naissance, s.nomNaissance);
    if (k1) l.push({ role: "nom", libelle: "Nom de famille", nom: String(s.nom || "").trim(), cle: k1 });
    if (k2 && k2 !== k1) l.push({ role: "jeune_fille", libelle: "Nom de jeune fille", nom: String(s.nomNaissance || "").trim(), cle: k2 });
    return l;
  }
  /* Contrôle de la saisie : { ok, cles } ou { ok: false, erreur, champ }. */
  function controlerSaisie(saisie, now) {
    var s = saisie || {}, auj = B.jour(now || B.maintenant());
    function ko(champ, erreur) { return { ok: false, champ: champ, erreur: erreur }; }
    if (lettres(s.nom).length < 2) return ko("nom", "Saisissez le nom de famille (au moins deux lettres).");
    if (String(s.nomNaissance || "").trim() && lettres(s.nomNaissance).length < 2) return ko("nomNaissance", "Le nom de jeune fille doit comporter au moins deux lettres (laissez la case vide s'il n'y en a pas).");
    var d = dateDe(s.naissance);
    if (!d) return ko("naissance", "Saisissez la date de naissance (jour, mois, année).");
    if (d.getTime() > auj.getTime()) return ko("naissance", "La date de naissance est dans le futur.");
    if (auj.getFullYear() - d.getFullYear() > 120) return ko("naissance", "Cette date de naissance n'est pas plausible.");
    return { ok: true, cles: cles(s) };
  }

  /* ---------- fichier des personnes inscrites (inventées) ---------- */
  /* naissance : AAAA-MM-JJ. fcc : interdiction bancaire (début, fin à 5 ans, incidents de paiement de chèque). ficp : incidents de remboursement de crédit (radiation prévue) et dossier de surendettement. */
  var BASE = [
    { id: "roussel", nom: "ROUSSEL", prenoms: "DYLAN MARC", marital: "", sexe: "M", naissance: "1992-02-09", lieu: "AMIENS", pays: "FR * FRANCE", sousCle: "01",
      fcc: { debut: "2026-06-12", fin: "2031-06-12", incidents: [{ date: "2026-05-27", montant: 1240 }], carte: false }, ficp: null },
    { id: "benali", nom: "BENALI", prenoms: "SAMIRA", marital: "", sexe: "F", naissance: "1979-11-22", lieu: "MARSEILLE", pays: "FR * FRANCE", sousCle: "01",
      fcc: null, ficp: { incidents: 1, declarants: 1, nature: "08 * CREDIT RENOUVELABLE", radiation: "2029-03-03", surendettement: null } },
    { id: "legrand", nom: "LEGRAND", prenoms: "CEDRIC ALAIN", marital: "", sexe: "M", naissance: "1975-05-30", lieu: "ROUEN", pays: "FR * FRANCE", sousCle: "02",
      fcc: { debut: "2026-03-18", fin: "2031-03-18", incidents: [{ date: "2026-02-20", montant: 780 }, { date: "2026-02-27", montant: 1150 }], carte: true },
      ficp: { incidents: 2, declarants: 2, nature: "01 * PRET PERSONNEL", radiation: "2030-01-21",
        surendettement: { mesure: "PLAN CONVENTIONNEL DE REDRESSEMENT", radiation: "2030-09-14", complementaire: "", recevable: "OUI", reexamen: "NON", instruction: "NON" } } },
    { id: "morel", nom: "MOREL", prenoms: "AURELIE CLAIRE", marital: "FOURNIER", sexe: "F", naissance: "1988-08-17", lieu: "NANTES", pays: "FR * FRANCE", sousCle: "01",
      fcc: null, ficp: { incidents: 1, declarants: 1, nature: "03 * PRET IMMOBILIER", radiation: "2028-05-12", surendettement: null } },
    { id: "petit", nom: "PETIT", prenoms: "HUGO LOUIS", marital: "", sexe: "M", naissance: "2001-12-03", lieu: "LILLE", pays: "FR * FRANCE", sousCle: "01",
      fcc: null, ficp: { incidents: 1, declarants: 1, nature: "08 * CREDIT RENOUVELABLE", radiation: "2026-10-20", surendettement: null } }
  ];
  var PAR_CLE = {};
  BASE.forEach(function (f) { f.cle = cle(f.naissance, f.nom); PAR_CLE[f.cle] = f; });
  /* Identités proposées pour s'entraîner (sans le résultat de leur interrogation). */
  /* Une femme mariée se présente sous son nom d'usage (marital) et donne son nom de jeune fille, sous lequel le fichier est tenu. */
  var ENTRAINEMENT = BASE.map(function (f) {
    return { id: f.id, civ: f.sexe === "F" ? "Mme" : "M.", nom: f.marital || f.nom, nomNaissance: f.marital ? f.nom : "", prenoms: f.prenoms, naissance: f.naissance, lieu: f.lieu };
  });

  /* Une inscription est en cours tant que sa date de radiation (ou de fin) n'est pas atteinte. */
  function enCours(ymd, now) { var d = B.lireYmd(ymd), j = B.jour(now || B.maintenant()); return !!d && d.getTime() > j.getTime(); }
  function fccActif(f, now) { return !!(f && f.fcc && enCours(f.fcc.fin, now)); }
  function ficpActif(f, now) {
    if (!f || !f.ficp) return false;
    return enCours(f.ficp.radiation, now) || !!(f.ficp.surendettement && enCours(f.ficp.surendettement.radiation, now));
  }
  function copie(o) { return JSON.parse(JSON.stringify(o)); }

  /* Les personnes inscrites au FCC à la suite d'une lettre d'injonction de l'agence (voir regul.js) : clé → fiche. Une régularisation n'y apparaît qu'une fois le fichier mis à jour par la Banque de France. */
  function fichesAgence(st, now) {
    var m = {};
    if (RG && st) RG.fichesAgence(st, now).forEach(function (f) { f.cle = cle(f.naissance, f.nom); m[f.cle] = f; });
    return m;
  }
  /* Réponse d'un fichier pour une clé : { fichier, cle, role, nom, trouve, fiche }. */
  function resultat(fichier, k, now, agence) {
    var f = PAR_CLE[k.cle] || (agence && agence[k.cle]) || null, trouve = fichier === "fcc" ? fccActif(f, now) : ficpActif(f, now);
    return { fichier: fichier, cle: k.cle, role: k.role, libelle: k.libelle, nom: k.nom, trouve: trouve, fiche: trouve ? copie(f) : null };
  }
  function horodate(now) { var n = now || B.maintenant(); return { date: B.ymd(n), heure: p2(n.getHours()) + ":" + p2(n.getMinutes()) + ":" + p2(n.getSeconds()) }; }
  /* Interrogation : fichiers = ["fcc"], ["ficp"] ou les deux. Renvoie { ok, saisie, cles, resultats, date, heure, bilan } ou { ok: false, erreur, champ }. */
  function interroger(saisie, fichiers, now, st) {
    now = now || B.maintenant();
    var c = controlerSaisie(saisie, now); if (!c.ok) return c;
    var fs = (fichiers && fichiers.length ? fichiers : ["fcc", "ficp"]).filter(function (x, i, a) { return (x === "fcc" || x === "ficp") && a.indexOf(x) === i; });
    if (!fs.length) return { ok: false, champ: "fichier", erreur: "Choisissez le fichier à interroger : FCC, FICP ou les deux." };
    var res = [], agence = fichesAgence(st, now);
    fs.forEach(function (fi) { c.cles.forEach(function (k) { res.push(resultat(fi, k, now, agence)); }); });
    var h = horodate(now), r = { ok: true, saisie: { nom: String(saisie.nom || "").trim(), nomNaissance: String(saisie.nomNaissance || "").trim(), naissance: B.ymd(dateDe(saisie.naissance)) }, cles: c.cles, fichiers: fs, resultats: res, date: h.date, heure: h.heure };
    r.bilan = bilan(r.resultats, fs, now);
    return r;
  }
  /* Bilan par fichier : fcc « aucun » | « interdit » (ou « » si non interrogé), ficp « aucun » | « inscrit » (ou « »). Il porte aussi le détail utile à la décision d'ouverture :
     fccIncidents (nombre d'incidents de paiement de chèques), ficpIncidents (nombre d'incidents de remboursement en cours) et surendettement (dossier de surendettement en cours). */
  function bilan(resultats, fichiers, now) {
    var fs = fichiers || [], b = { fcc: "", ficp: "", fccIncidents: 0, ficpIncidents: 0, surendettement: false }, j = now || B.maintenant();
    function a(fi) { return fs.indexOf(fi) >= 0 || resultats.some(function (r) { return r.fichier === fi; }); }
    function trouves(fi) { return resultats.filter(function (r) { return r.fichier === fi && r.trouve && r.fiche; }); }
    if (a("fcc")) b.fcc = trouves("fcc").length ? "interdit" : "aucun";
    if (a("ficp")) b.ficp = trouves("ficp").length ? "inscrit" : "aucun";
    trouves("fcc").forEach(function (r) { b.fccIncidents = Math.max(b.fccIncidents, ((r.fiche.fcc && r.fiche.fcc.incidents) || []).length); });
    trouves("ficp").forEach(function (r) {
      var x = r.fiche.ficp || {};
      if (enCours(x.radiation, j)) b.ficpIncidents = Math.max(b.ficpIncidents, x.incidents || 0);
      if (x.surendettement && enCours(x.surendettement.radiation, j)) b.surendettement = true;
    });
    return b;
  }
  /* Ce qu'on garde au dossier : clés, date et heure, résultat de chaque fichier (pas l'écran lui-même). */
  function trace(consultation) {
    var c = consultation, k = c.cles;
    return { date: c.date, heure: c.heure.slice(0, 5), cle: k[0].cle, cleNaissance: k[1] ? k[1].cle : "", nom: c.saisie.nom, nomNaissance: c.saisie.nomNaissance, naissance: c.saisie.naissance, fcc: c.bilan.fcc, ficp: c.bilan.ficp, fccIncidents: c.bilan.fccIncidents || 0, ficpIncidents: c.bilan.ficpIncidents || 0, surendettement: !!c.bilan.surendettement };
  }
  /* La trace vaut pour cette identité si elle a interrogé les deux fichiers avec les mêmes clés. */
  function correspond(t, saisie) {
    if (!t || typeof t !== "object" || !t.cle) return false;
    var k = cles(saisie);
    return k.length > 0 && k[0].cle === t.cle && (k[1] ? k[1].cle : "") === (t.cleNaissance || "");
  }
  function complete(t) { return !!t && (t.fcc === "aucun" || t.fcc === "interdit") && (t.ficp === "aucun" || t.ficp === "inscrit"); }
  /* ---------- risque présenté par une personne inscrite aux fichiers ----------
     L'inscription au FCC ou au FICP n'interdit pas à elle seule l'ouverture d'un compte : c'est à l'agence d'apprécier le risque, la directrice d'agence prend la décision finale.
     Règle appliquée par la directrice (réglable ici, en un seul endroit) : le risque est ÉLEVÉ (refus) si la personne est inscrite aux deux fichiers, si elle a plus d'incidents de paiement de chèques
     que INCIDENTS_FCC_MAX, si elle a plus d'incidents de remboursement que INCIDENTS_FICP_MAX ou si un dossier de surendettement est en cours ; sinon il est MODÉRÉ (un seul fichier, un seul incident) :
     le compte peut être ouvert avec des restrictions (FCC : pas de chéquier ni de prêt ; FICP : ni découvert ni crédit renouvelable). */
  var RISQUE = { INCIDENTS_FCC_MAX: 1, INCIDENTS_FICP_MAX: 1 };
  function pluriel(n, mot) { return n + " " + mot + (n > 1 ? "s" : ""); }
  /* t : trace de l'interrogation. Renvoie { niveau: "aucun" | "modere" | "eleve", fcc, ficp, raisons[], restrictions[] }. */
  function risque(t) {
    var fcc = !!t && t.fcc === "interdit", ficp = !!t && t.ficp === "inscrit", r = { niveau: "aucun", fcc: fcc, ficp: ficp, raisons: [], restrictions: [] };
    if (!fcc && !ficp) return r;
    var nf = Math.max(1, (t && t.fccIncidents) || 0), np = Math.max(1, (t && t.ficpIncidents) || 0), eleve = false;
    if (fcc && ficp) { eleve = true; r.raisons.push("inscription aux deux fichiers (FCC et FICP)"); }
    if (fcc && nf > RISQUE.INCIDENTS_FCC_MAX) { eleve = true; r.raisons.push(pluriel(nf, "incident") + " de paiement de chèque au FCC"); }
    if (ficp && np > RISQUE.INCIDENTS_FICP_MAX) { eleve = true; r.raisons.push(pluriel(np, "incident") + " de remboursement de crédit au FICP"); }
    if (ficp && t.surendettement) { eleve = true; r.raisons.push("dossier de surendettement en cours"); }
    if (eleve) { r.niveau = "eleve"; return r; }
    r.niveau = "modere";
    r.raisons.push(fcc ? "une seule inscription (FCC), un seul incident de paiement de chèque" : "une seule inscription (FICP), un seul incident de remboursement");
    if (fcc) r.restrictions.push("pas de chéquier ni de prêt");
    if (ficp) r.restrictions.push("ni découvert autorisé ni crédit renouvelable");
    return r;
  }
  function libBilan(t) {
    function f(x, lib) { return x === "interdit" ? "interdit bancaire" : x === "inscrit" ? "inscrit" : x === "aucun" ? "aucune inscription" : "non interrogé"; }
    return "FCC : " + f(t.fcc) + " ; FICP : " + f(t.ficp);
  }

  /* ---------- journal des interrogations (enregistré avec le reste de l'exercice) ---------- */
  function journal(st) { return st && Array.isArray(st.interrosBdf) ? st.interrosBdf : []; }
  /* Une ligne par fichier interrogé ; les lignes d'une même interrogation portent le même numéro (lot). contexte : { par, client, dossier }. */
  function noter(st, consultation, contexte) {
    if (!Array.isArray(st.interrosBdf)) st.interrosBdf = [];
    var ctx = contexte || {}, id = 0, lot = 0;
    st.interrosBdf.forEach(function (x) { if (x.id > id) id = x.id; if (x.lot > lot) lot = x.lot; });
    lot += 1;
    consultation.fichiers.forEach(function (fi) {
      var rs = consultation.resultats.filter(function (r) { return r.fichier === fi; });
      id += 1;
      st.interrosBdf.push({ id: id, lot: lot, date: consultation.date, heure: consultation.heure, fichier: fi, cles: rs.map(function (r) { return r.cle; }), resultat: rs.some(function (r) { return r.trouve; }) ? (fi === "fcc" ? "interdit" : "inscrit") : "aucun", par: ctx.par || "", client: ctx.client || 0, dossier: ctx.dossier || "" });
    });
    if (st.interrosBdf.length > JOURNAL_MAX) st.interrosBdf = st.interrosBdf.slice(-JOURNAL_MAX);
    return st.interrosBdf;
  }
  /* Dernière interrogation d'un fichier pour un client (identifiant du portefeuille), ou null. */
  function derniere(st, client, fichier) {
    var l = journal(st).filter(function (x) { return x.client === client && x.fichier === fichier; });
    return l.length ? l[l.length - 1] : null;
  }

  /* ---------- écrans de réponse ---------- */
  function point(ymd) { var d = B.lireYmd(ymd); return d ? p2(d.getDate()) + "." + p2(d.getMonth() + 1) + "." + d.getFullYear() : ""; }
  function horo(r) { return point(r.date) + " - " + r.heure; }
  function montant(n) { return B.eur2(n); }
  /* Une rubrique « libellé : valeur ». Les rubriques vont par deux sur une même ligne (libellé et valeur à gauche, libellé et valeur à droite) ; seule() occupe toute la ligne. */
  function item(lib, val, cls, seule) { return '<div class="bdf-ligne' + (seule ? " bdf-seule" : "") + '"><dt>' + esc(lib).replace(/ :$/, "&nbsp;:") + '</dt><dd' + (cls ? ' class="' + cls + '"' : "") + ">" + (val === "" || val == null ? "" : esc(val)) + "</dd></div>"; }
  function ligne(lib, val, cls) { return item(lib, val, cls, false); }
  function seule(lib, val, cls) { return item(lib, val, cls, true); }
  function lignes(h, bande) { return '<dl class="bdf-lignes' + (bande ? " bdf-lignes-cle" : "") + '">' + h + "</dl>"; }
  /* Cadre des réponses positives (identique pour le FCC et le FICP) : titre du cadre, puis rubriques séparées par des bandeaux. */
  function cadre(titre, cle, rubriques) {
    return '<div class="bdf-cadre"><h4 class="bdf-cadre-t">' + esc(titre) + "</h4>" + lignes(cle, true) + rubriques.map(function (x) { return (x[0] ? '<h4 class="bdf-cadre-s">' + esc(x[0]) + "</h4>" : "") + x[1]; }).join("") + "</div>";
  }
  var CONFIDENTIEL = "INFORMATIONS CONFIDENTIELLES PROVENANT DE LA BANQUE DE FRANCE";
  /* En-tête identique pour les deux écrans : bandeau bleu avec le sigle du fichier, titre, date et heure de la consultation. */
  function ecranTete(f, r, titre) {
    return '<div class="bdf-banniere bdf-banniere-' + f + '"><span class="bdf-sigle">' + (f === "fcc" ? "FCC" : "FICP") + "</span><div><p>" + CONFIDENTIEL + "</p>" +
      (f === "ficp" ? '<p class="bdf-banniere-sous">« Fichier national des incidents de remboursement des crédits aux particuliers »</p>' : "") + "</div></div>" +
      '<div class="bdf-tete"><h3 class="bdf-titre">' + esc(titre) + '</h3><p class="bdf-horodate">' + esc(horo(r)) + "</p></div>";
  }
  /* Bas de l'écran : mention de confidentialité. */
  function pied() {
    return '<p class="bdf-confid">Information communiquée pour un usage interne non diffusable aux tiers</p>';
  }
  function reponseNegative(r) {
    return '<div class="bdf-reponse"><span class="bdf-reponse-lib">Réponse de la Banque de France :</span><strong class="bdf-rouge">Dossier inexistant sous la clé : ' + esc(r.cle) + "</strong></div>";
  }
  function identiteFiche(f) {
    return lignes(seule("Nom patronymique :", f.nom) + seule("Prénom(s) :", f.prenoms) + ligne("Nom marital :", f.marital) + ligne("Sexe :", f.sexe === "F" ? "FÉMININ" : "MASCULIN") +
      seule("Date de naissance :", point(f.naissance)) + seule("Localité de naissance :", f.lieu) + seule("Pays :", f.pays));
  }
  /* Écran du FCC (r : résultat de l'interrogation du FCC, avec l'horodatage de la consultation). */
  function ecranFcc(r, cons) {
    var h = '<section class="bdf-ecran bdf-fcc' + (r.trouve ? " bdf-positif" : "") + '" aria-label="Consultation du fichier central des chèques, clé ' + esc(r.cle) + '">' + ecranTete("fcc", cons, "Consultation du Fichier central des chèques") + '<p class="bdf-soustitre">Relevé détaillé Personne Physique</p>';
    if (!r.trouve) return h + reponseNegative(r) + pied() + "</section>";
    var f = r.fiche, x = f.fcc;
    h += cadre("Coordonnées du dossier", seule("Clé BDF :", r.cle), [["", identiteFiche(f)],
      ["Interdiction bancaire", lignes(ligne("Interdiction d'émettre des chèques :", "OUI", "bdf-rouge") + ligne("Interdiction judiciaire :", "NON") + ligne("Date de début :", point(x.debut)) + ligne("Date de fin :", point(x.fin)) +
        seule("Motif :", "CHEQUE SANS PROVISION NON REGULARISE") + seule("Retrait de carte bancaire :", x.carte ? "OUI" : "NON"))],
      ["Incidents de paiement de chèques", '<table class="bdf-tab"><thead><tr><th scope="col">Date de l\'incident</th><th scope="col">Montant du chèque</th><th scope="col">Régularisation</th></tr></thead><tbody>' +
        x.incidents.map(function (i) { return "<tr><td>" + esc(point(i.date)) + "</td><td>" + esc(montant(i.montant)) + "</td><td>" + (i.regularise ? "OUI" : "NON") + "</td></tr>"; }).join("") + "</tbody></table>"]]);
    return h + pied() + "</section>";
  }
  /* Écran du FICP. */
  function ecranFicp(r, cons) {
    var h = '<section class="bdf-ecran bdf-ficp' + (r.trouve ? " bdf-positif" : "") + '" aria-label="Consultation du FICP, clé ' + esc(r.cle) + '">' + ecranTete("ficp", cons, "Consultation du FICP");
    if (!r.trouve) return h + reponseNegative(r) + pied() + "</section>";
    var f = r.fiche, x = f.ficp, s = x.surendettement, enc = enCours(x.radiation, cons ? B.lireYmd(cons.date) : null);
    h += cadre("Coordonnées du dossier", ligne("Clé BDF :", r.cle) + ligne("Sous-clé :", f.sousCle), [["", identiteFiche(f).replace(/<\/dl>$/, seule("Remarque :", "AUCUNE", "bdf-rouge") + "</dl>")],
      ["Relevé des incidents", lignes(ligne("Nombre d'incidents :", p3(enc ? x.incidents : 0)) + ligne("Nombre de déclarants :", p3(enc ? x.declarants : 0)) + ligne("Nature du crédit :", x.nature) + ligne("Date de la radiation :", point(x.radiation)))],
      ["Dossier de surendettement", lignes(ligne("Nature de la mesure :", s ? s.mesure : "NÉANT") + ligne("Date de la radiation :", s ? point(s.radiation) : "") + seule("Obligation complémentaire :", s ? s.complementaire : "") +
        seule("Dossier recevable :", s ? s.recevable : "NON") + ligne("Dossier en réexamen :", s ? s.reexamen : "NON") + ligne("Dossier en cours d'instruction :", s ? s.instruction : "NON"))]]);
    return h + pied() + "</section>";
  }
  function p3(n) { return (n < 10 ? "00" : n < 100 ? "0" : "") + n; }
  /* Tous les écrans d'une interrogation, dans l'ordre des résultats. */
  /* Mention discrète : en pied de page des documents imprimés (feuille bdf.css, page nommée « bdf ») et en bas de l'outil. */
  var MENTION_SIMULATION = "Simulation à des fins pédagogiques : ce n'est pas une consultation réelle de la Banque de France et elle n'a aucune valeur.";
  function ecrans(consultation) {
    return consultation.resultats.map(function (r) {
      return r.fichier === "fcc" ? ecranFcc(r, consultation) : ecranFicp(r, consultation);
    }).join("");
  }
  /* Phrase de synthèse, pour l'écran de l'outil et le dossier. */
  function synthese(consultation) {
    var b = consultation.bilan, p = [];
    if (b.fcc) p.push(b.fcc === "interdit" ? "FCC : la personne est interdite d'émettre des chèques (interdiction bancaire)." : "FCC : aucune inscription.");
    if (b.ficp) p.push(b.ficp === "inscrit" ? "FICP : la personne est inscrite au fichier des incidents de remboursement des crédits." : "FICP : aucune inscription.");
    return p.join(" ");
  }

  var api = {
    CHIFFRES_ANNEE: CHIFFRES_ANNEE, LETTRES: LETTRES, FICHIERS: FICHIERS, BASE: BASE, ENTRAINEMENT: ENTRAINEMENT, JOURNAL_MAX: JOURNAL_MAX,
    lettres: lettres, cle: cle, cles: cles, controlerSaisie: controlerSaisie, interroger: interroger, bilan: bilan, risque: risque, RISQUE: RISQUE, trace: trace, correspond: correspond, complete: complete, libBilan: libBilan,
    journal: journal, noter: noter, derniere: derniere, fccActif: fccActif, ficpActif: ficpActif, ecranFcc: ecranFcc, ecranFicp: ecranFicp, ecrans: ecrans, synthese: synthese, point: point, MENTION_SIMULATION: MENTION_SIMULATION
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.bdf = api; }
})(typeof window !== "undefined" ? window : null);
