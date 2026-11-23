/* GS Banque & Assurance – carte de visite du conseiller : règles de contenu (sans affichage).
   La carte porte le prénom et le nom de l'élève (la même règle et le même enregistrement que la signature des e-mails et l'identité portée par les documents imprimés),
   sa fonction dans l'agence, deux numéros et une adresse e-mail.
   Coordonnées inventées : numéros dans les tranches réservées à la fiction par l'ARCEP (01 99 00 xx xx pour une ligne fixe, 06 39 98 xx xx pour un mobile),
   domaine « .example » réservé aux exemples (RFC 2606), adresse du siège déjà utilisée sur les RIB. Une carte ne peut donc jamais porter un vrai numéro.
   L'agence compte six postes (voir equipe.js) ; la fonction proposée par défaut est celle de l'élève, conseiller clientèle particuliers. */
(function (root) {
  "use strict";

  var ID = root && root.SGBF ? root.SGBF.identite : require("./identite.js");

  var DOMAINE = "gs-banque-assurance.example", SITE = "www." + DOMAINE;
  var AGENCE = "Agence de Paris", TEL_AGENCE = "01 99 00 80 40", ADRESSE = ["27 rue de Châteaudun", "75009 Paris"];
  var HORAIRES = ["Du mardi au vendredi : 9 h – 13 h et 14 h – 18 h", "Samedi : 9 h – 13 h"];
  var PREFIXE_FIXE = "019900", PREFIXE_MOBILE = "063998";
  var CIVILITES = { "M.": "Monsieur", "Mme": "Madame" };
  /* Fonctions de l'agence, au masculin et au féminin (la civilité choisit la forme). */
  var FONCTIONS = {
    ccp: { m: "Conseiller clientèle particuliers", f: "Conseillère clientèle particuliers" },
    ccpr: { m: "Conseiller clientèle privée", f: "Conseillère clientèle privée" },
    ccpro: { m: "Conseiller clientèle professionnelle", f: "Conseillère clientèle professionnelle" },
    dir: { m: "Directeur d'agence", f: "Directrice d'agence" }
  };
  var ORDRE_FONCTIONS = ["ccp", "ccpr", "ccpro", "dir"];

  function ascii(s) { return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9-]/g, ""); }
  function chiffres(s) { return String(s == null ? "" : s).replace(/[\s.\-]/g, ""); }
  /* 0199008123 → « 01 99 00 81 23 » */
  function formater(c) { return c.replace(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/, "$1 $2 $3 $4 $5"); }

  /* Adresse e-mail : premier mot . dernier mot, sans accents ni apostrophes (même règle que la signature de la messagerie). */
  function mail(nom) {
    var t = String(nom == null ? "" : nom).replace(/\s+/g, " ").trim().split(" "), p = ascii(t[0] || ""), n = ascii(t[t.length - 1] || "");
    return p && n && t.length >= 2 ? p + "." + n + "@" + DOMAINE : null;
  }
  /* Nombre stable tiré du nom : les numéros proposés ne changent pas d'une ouverture à l'autre. */
  function graine(nom) {
    var h = 5381, s = ascii(String(nom).replace(/\s+/g, ""));
    for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h;
  }
  function deux(n) { return (n < 10 ? "0" : "") + n; }
  /* Ligne directe proposée : 01 99 00 81 xx (la ligne de l'agence est le 80 40). */
  function directDefaut(nom) { return formater(PREFIXE_FIXE + "81" + deux(graine(nom) % 100)); }
  /* Mobile proposé : 06 39 98 xx xx. */
  function mobileDefaut(nom) { var g = graine(nom); return formater(PREFIXE_MOBILE + deux(Math.floor(g / 100) % 100) + deux(g % 97)); }

  function fonctionLib(id, civ) { var f = FONCTIONS[id]; return f ? (civ === "Mme" ? f.f : f.m) : ""; }
  function err(champ, msg) { return { ok: false, champ: champ, erreur: msg }; }

  /* Réglages par défaut de la carte d'un élève (nom valide ou non). */
  function defauts(nom) {
    var n = ID.nomValide(nom);
    return { civ: "M.", fonction: "ccp", direct: n.ok ? directDefaut(n.nom) : "", mobile: n.ok ? mobileDefaut(n.nom) : "" };
  }

  /* Contrôle des champs saisis ; renvoie la carte complète prête à l'affichage ou à l'impression.
     o = { nom, civ, fonction, direct, mobile } ; le mobile est facultatif (vide = non imprimé). */
  function valider(o) {
    o = o || {};
    var v = ID.nomValide(o.nom);
    if (!v.ok) return err("nom", v.erreur);
    if (!CIVILITES[o.civ]) return err("civ", "Choisissez la civilité : M. ou Mme.");
    if (!FONCTIONS[o.fonction]) return err("fonction", "Choisissez votre fonction dans l'agence.");
    var d = chiffres(o.direct);
    if (!/^\d{10}$/.test(d) || d.indexOf(PREFIXE_FIXE) !== 0) return err("direct", "La ligne directe doit être un numéro fictif de la forme 01 99 00 xx xx (tranche réservée à la fiction).");
    var m = chiffres(o.mobile), mobile = "";
    if (m) {
      if (!/^\d{10}$/.test(m) || m.indexOf(PREFIXE_MOBILE) !== 0) return err("mobile", "Le mobile doit être un numéro fictif de la forme 06 39 98 xx xx (tranche réservée à la fiction), ou rester vide.");
      mobile = formater(m);
    }
    return { ok: true, carte: {
      nom: v.nom, civ: o.civ, fonctionId: o.fonction, fonction: fonctionLib(o.fonction, o.civ), direct: formater(d), mobile: mobile, mail: mail(v.nom),
      agence: AGENCE, tel: TEL_AGENCE, adresse: ADRESSE.slice(), site: SITE, horaires: HORAIRES.slice()
    } };
  }
  /* Nombre de cartes sur une planche A4 (2 colonnes de 85 mm, 5 rangées de 55 mm). */
  var FORMAT = { largeur: 85, hauteur: 55, colonnes: 2, rangees: 5 };
  FORMAT.parPlanche = FORMAT.colonnes * FORMAT.rangees;

  var api = {
    DOMAINE: DOMAINE, SITE: SITE, AGENCE: AGENCE, TEL_AGENCE: TEL_AGENCE, ADRESSE: ADRESSE, HORAIRES: HORAIRES, PREFIXE_FIXE: PREFIXE_FIXE, PREFIXE_MOBILE: PREFIXE_MOBILE,
    CIVILITES: CIVILITES, FONCTIONS: FONCTIONS, ORDRE_FONCTIONS: ORDRE_FONCTIONS, FORMAT: FORMAT,
    mail: mail, directDefaut: directDefaut, mobileDefaut: mobileDefaut, defauts: defauts, fonctionLib: fonctionLib, valider: valider, formater: formater
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.carte = api; }
})(typeof window !== "undefined" ? window : null);
