/* GS Banque & Assurance – documents imprimables : briques communes des lettres et des documents « à signer par le client ».
   Ce module ne fabrique que du texte (HTML) : l'impression se fait avec impression.js (en-tête de la banque, date, PDF).
   Deux familles de documents l'utilisent :
     – les courriers de la banque au client (gestion des incidents : documents_gdi.js) ;
     – les documents que le client lit, date et signe (opérations de service : documents_service.js ; engagement de régularisation).
   Chaque document est un objet { id, titre, sous, fichier, courrier, corps } : « corps » est le HTML à placer dans impression.document().
   Les mots « fictif » et le mot de passe des exercices n'apparaissent jamais dans ces textes. Fonctions pures, testées avec Node. */
(function (root) {
  "use strict";

  var T = (root && root.SGBF && root.SGBF.tampon) || require("./tampon.js");
  var AGENCE = ["GS Banque & Assurance", "Agence de Paris", "27 rue de Châteaudun", "75009 Paris"];

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function arrondi(x) { return Math.round(x * 100) / 100; }
  /* 1 234,56 € (espace insécable avant le signe €) */
  function montant(x) {
    var s = Math.abs(arrondi(x)).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    s = s.replace(/,00$/, "");
    return (x < 0 ? "−" : "") + s + "\u00a0€";
  }
  function dateLongue(d) { return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }); }
  function dateCourte(d) { return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }); }
  function plusJours(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }

  /* ---------- le client ---------- */
  var RUES = [["rue de Charonne", "75011"], ["rue Oberkampf", "75011"], ["avenue Daumesnil", "75012"], ["rue de Tolbiac", "75013"], ["rue Daguerre", "75014"], ["rue de la Convention", "75015"],
    ["rue Legendre", "75017"], ["rue Ordener", "75018"], ["rue de Crimée", "75019"], ["rue des Pyrénées", "75020"], ["boulevard de Magenta", "75010"], ["rue des Martyrs", "75009"],
    ["rue Montorgueil", "75002"], ["rue de Rennes", "75006"], ["rue Mouffetard", "75005"], ["rue Saint-Antoine", "75004"]];
  function empreinte(t) { var h = 7, i; t = String(t); for (i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 1000003; return h; }
  /* Adresse : celle du client quand le dossier la donne (fiche client : adresse ; dossiers de gestion des incidents : coordonnees.adresse, « 21 rue de Charonne, 75011 Paris ») ;
     les dossiers des outils d'état débiteur n'en contiennent pas : on en déduit une, toujours la même pour un même client (rues parisiennes, numéros imaginaires). */
  function adresse(client) {
    if (client && client.adresse && client.adresse.ligne1) return client.adresse;
    var m = client && client.coordonnees && typeof client.coordonnees.adresse === "string" ? client.coordonnees.adresse.match(/^(.+?),\s*(\d{5}\s+\S.*)$/) : null;
    if (m) return { ligne1: m[1], ligne2: m[2] };
    var h = empreinte((client.nom || "") + "|" + (client.prenom || "") + "|" + (client.compte || ""));
    var r = RUES[h % RUES.length];
    return { ligne1: (1 + (Math.floor(h / 16) % 96)) + " " + r[0], ligne2: r[1] + " Paris" };
  }
  function feminin(client) { return client.civilite === "Mme" || client.civilite === "Mlle"; }
  function nomComplet(client) { return client.civilite + " " + client.prenom + " " + String(client.nom).toUpperCase(); }
  function appel(client) { return feminin(client) ? "Madame" : "Monsieur"; }

  /* ---------- briques de mise en page ---------- */
  function p(t, cl) { return "<p" + (cl ? ' class="' + cl + '"' : "") + ">" + t + "</p>"; }
  function liste(items) { return '<ul class="dp-liste">' + items.map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ul>"; }
  function titre(t) { return "<h2>" + esc(t) + "</h2>"; }
  /* lignes : [ [libellé, valeur HTML déjà échappée], … ] */
  function fiche(lignes) {
    return '<dl class="dp-fiche dp-fiche-l">' + lignes.filter(Boolean).map(function (l) { return "<dt>" + esc(l[0]) + "</dt><dd>" + l[1] + "</dd>"; }).join("") + "</dl>";
  }
  function trait(long) { return '<span class="dp-trait' + (long ? " dp-trait-long" : "") + '"></span>'; }
  function caseACocher(texte, cochee) {
    return '<p class="dp-case"><span class="dp-boite' + (cochee ? " dp-coche" : "") + '" aria-hidden="true">' + (cochee ? "×" : "") + "</span> " + texte + "</p>";
  }
  function tableau(entetes, lignes, classe) {
    return '<table class="' + (classe || "dp-tab") + '"><thead><tr>' + entetes.map(function (e, i) { return "<th" + (i ? ' class="g"' : "") + ">" + esc(e) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      lignes.map(function (l) { return "<tr>" + l.map(function (c, i) { return "<td" + (i ? ' class="g"' : "") + ">" + c + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table>";
  }
  /* Lieu et date. Sans date : « Fait à ______, le ______ » à remplir à la main (document que quelqu'un d'autre date : bénéficiaire d'un chèque…).
     Avec une date : « Fait à Paris, le 11 novembre 2026 », écrit tout seul (documents que la banque édite et fait signer le jour même). */
  function lieuDate(date) { return date ? '<p class="dp-lieu">' + esc(T.faitA(date)) + "</p>" : '<p class="dp-lieu">Fait à ' + trait() + ", le " + trait() + "</p>"; }

  /* Cadres de signature. cadres : [ { titre, mention, nom, legende, cachet } ] ; la ligne reste vide pour la signature manuscrite du client.
     Un cadre avec « cachet » (une date) est celui de la banque : tampon de l'agence daté, signature du conseiller (le nom de l'élève) sur la ligne, nom et qualité dessous.
     Quand un cadre de banque est présent, les autres cadres reçoivent une légende sous leur ligne, pour que les deux lignes de signature soient à la même hauteur. */
  function signatures(cadres) {
    var avecCachet = cadres.some(function (c) { return !!c.cachet; });
    return '<div class="dp-signatures' + (avecCachet ? " dp-sign-cachet" : "") + '">' + cadres.map(function (c) {
      var tete = "<p><strong>" + esc(c.titre) + "</strong></p>" + (c.nom ? "<p>" + esc(c.nom) + "</p>" : "") + (c.mention ? '<p class="dp-mention-sign">' + esc(c.mention) + "</p>" : "");
      if (c.cachet) return "<div>" + tete + T.zoneBanque(c.cachet) + "</div>";
      var legende = c.legende || (avecCachet ? (c.titre === "Le client" ? "Signature du client" : "Signature") : "");
      return "<div>" + tete + '<div class="dp-ligne-sign"></div>' + (legende ? '<p class="dp-legende">' + esc(legende) + "</p>" : "") + "</div>";
    }).join("") + "</div>";
  }
  /* Signature de la banque : le nom du conseiller est celui saisi à l'ouverture de la séance (rempli au moment de l'impression). */
  /* Signature d'un courrier de la banque. Avec une date (celle du courrier) : tampon de l'agence daté, signature du conseiller (le nom de l'élève, inscrit à l'impression) sur la ligne,
     nom et qualité dessous. Sans date : bloc de texte seul. */
  function signatureBanque(qualite, date) {
    if (date) return '<div class="dp-lettre-sign dp-lettre-sign-cachet"><p class="dp-lettre-ag">' + esc(AGENCE[0]) + " – " + esc(AGENCE[1]) + "</p>" + T.zoneBanque(date) + "</div>";
    return '<p class="dp-lettre-sign" data-auteur>' + esc(AGENCE[0]) + " – " + esc(AGENCE[1]) + '<br><span data-eleve></span>, ' + esc(qualite || "conseiller clientèle particuliers") + "</p>";
  }
  /* Cadre de la banque. Avec une date (celle du jour) : tampon de l'agence et signature du conseiller ; sans date : cadre vide à compléter à la main. */
  function signatureConseiller(date) {
    if (date) return { titre: "Pour la banque", nom: "", mention: "Le conseiller clientèle", cachet: date };
    return { titre: "Pour la banque", nom: "", mention: "Le conseiller clientèle (nom, date, signature)" };
  }

  /* ---------- courrier de la banque ----------
     o : { client, date, refs, objet, envoi ("Lettre recommandée avec accusé de réception" | "Courrier simple"), corps (HTML), pj (liste de pièces jointes) } */
  function lettre(o) {
    var c = o.client, adr = adresse(c);
    var h = '<div class="dp-lettre">' +
      '<div class="dp-lettre-dest"><p><strong>' + esc(nomComplet(c)) + "</strong><br>" + esc(adr.ligne1) + "<br>" + esc(adr.ligne2) + "</p></div>" +
      (o.envoi ? '<p class="dp-lettre-envoi"><strong>' + esc(o.envoi) + "</strong></p>" : "") +
      '<p class="dp-lettre-refs"><strong>Références :</strong> ' + esc(o.refs) + "</p>" +
      '<p class="dp-lettre-date">Paris, le ' + esc(dateLongue(o.date)) + "</p>" +
      '<p class="dp-lettre-objet"><strong>Objet :</strong> ' + esc(o.objet) + "</p>" +
      "<p>" + appel(c) + ",</p>" + o.corps +
      "<p>Nous vous prions d'agréer, " + appel(c) + ", l'expression de nos salutations distinguées.</p>" +
      signatureBanque(null, o.date) +
      (o.pj && o.pj.length ? '<p class="dp-lettre-pj"><strong>Pièce' + (o.pj.length > 1 ? "s" : "") + " jointe" + (o.pj.length > 1 ? "s" : "") + " :</strong> " + o.pj.map(esc).join(" ; ") + "</p>" : "") +
      "</div>";
    return h;
  }

  /* Nom de fichier proposé pour le PDF : AAAA-MM-JJ_Type_Nom. */
  function fichier(prefixe, client, date) {
    var n = (prefixe + "_" + String(client.nom).toUpperCase() + "_" + client.prenom + "_" + dateCourte(date).split("/").reverse().join("-")).normalize("NFD").replace(/[̀-ͯ]/g, "");
    return n.replace(/[^A-Za-z0-9-]+/g, "_").replace(/^_+|_+$/g, "");
  }

  var api = {
    AGENCE: AGENCE, esc: esc, arrondi: arrondi, montant: montant, dateLongue: dateLongue, dateCourte: dateCourte, plusJours: plusJours,
    adresse: adresse, feminin: feminin, nomComplet: nomComplet, appel: appel,
    p: p, liste: liste, titre: titre, fiche: fiche, trait: trait, caseACocher: caseACocher, tableau: tableau, lieuDate: lieuDate, signatures: signatures, signatureBanque: signatureBanque,
    signatureConseiller: signatureConseiller, lettre: lettre, fichier: fichier
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.documents = api; }
})(typeof window !== "undefined" ? window : null);
