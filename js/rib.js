/* GS Banque & Assurance – relevé d'identité bancaire (RIB) du compte courant d'un client.
   Le RIB est calculé pour chaque client à partir de son numéro client : même client, même RIB, à chaque ouverture.
   Structure réelle d'un RIB français : code banque (5 chiffres), code guichet (5 chiffres), numéro de compte (11 caractères), clé RIB (2 chiffres) ;
   l'IBAN est « FR » + clé IBAN (2 chiffres) + ces 23 caractères ; le BIC identifie la banque (8 ou 11 caractères).
   Les deux clés sont calculées selon les règles réelles (clé RIB : 97 − (89 × banque + 15 × guichet + 3 × compte) modulo 97 ; clé IBAN : 98 − (BBAN suivi de FR00) modulo 97),
   si bien que l'IBAN passe les contrôles de forme d'un formulaire. Les identifiants de la banque (code banque, code guichet, BIC) sont inventés :
   ce RIB ne correspond à aucune banque réelle et ne permet aucune opération.
   Compte joint : tout client en couple (marié, pacsé ou en concubinage) a un compte courant joint avec son conjoint ; le conjoint est alors co-titulaire du compte.
   Son nom de famille est dans la fiche client (fam.conj.nom) : celui du client s'il est marié, un autre nom s'il est pacsé ou en concubinage.
   Compte ouvert pendant l'exercice (entrée en relation) : le dossier peut désigner un second titulaire (c.coTit) et une forme de compte (c.formeCompte) :
   « joint » : compte joint, les deux titulaires agissent seuls, chacun engage les deux (solidarité) ; intitulé « M. X ou Mme Y » ;
   « indivis » : compte indivis, toute opération exige la signature de tous les titulaires ; intitulé « Indivision X » ou « Succession de M. Z » (c.indivision).
   Désolidarisation : une fois l'opération de service « Désolidarisation d'un compte joint » exécutée (sauvegarde locale partagée), le compte du portefeuille du client devient un compte individuel
   (même numéro, même IBAN) : au nom du client s'il le garde, au nom de son ancien cotitulaire sinon. Les comptes ouverts pendant l'exercice (rang 2 et plus, over) ne sont pas concernés. */
(function (root) {
  "use strict";

  var CODE_BANQUE = "99830", CODE_GUICHET = "75009", BIC = "GSBAFRPPXXX";
  /* Domiciliation : l'agence de Paris, à l'adresse du siège indiquée dans la signature des e-mails (messagerie.js). */
  var DOMICILIATION = ["GS Banque & Assurance", "Agence de Paris", "27 rue de Châteaudun", "75009 Paris"];
  var SUFFIXE_COMPTE = "01";   /* premier compte du client : le compte courant */

  function chiffres(s) { return String(s).replace(/\D/g, ""); }
  /* Lettres d'un numéro de compte, converties en chiffres pour la clé RIB : A-I → 1-9, J-R → 1-9, S-Z → 2-9. */
  function lettreRib(ch) {
    var n = ch.charCodeAt(0) - 64;
    return n <= 9 ? n : n <= 18 ? n - 9 : n - 17;
  }
  function enChiffresRib(s) { return String(s).toUpperCase().replace(/[A-Z]/g, function (m) { return String(lettreRib(m)); }); }
  function cleRib(banque, guichet, compte) {
    var r = (89 * parseInt(banque, 10) + 15 * parseInt(guichet, 10) + 3 * parseInt(enChiffresRib(compte), 10)) % 97;
    var k = 97 - r;
    return (k < 10 ? "0" : "") + k;
  }
  /* Reste modulo 97 d'un grand nombre écrit en chiffres (et en lettres pour un IBAN : A = 10 … Z = 35). */
  function mod97(s) {
    var txt = String(s).toUpperCase().replace(/[A-Z]/g, function (m) { return String(m.charCodeAt(0) - 55); }), r = 0, i;
    for (i = 0; i < txt.length; i++) r = (r * 10 + (txt.charCodeAt(i) - 48)) % 97;
    return r;
  }
  function cleIban(bban) {
    var k = 98 - mod97(bban + "FR00");
    return (k < 10 ? "0" : "") + k;
  }
  /* IBAN valide : forme française (27 caractères) et reste 1 une fois les quatre premiers caractères placés à la fin. */
  function ibanValide(iban) {
    var s = String(iban).replace(/\s/g, "").toUpperCase();
    return /^FR\d{2}\d{10}[0-9A-Z]{11}\d{2}$/.test(s) && mod97(s.slice(4) + s.slice(0, 4)) === 1;
  }
  function ibanLisible(iban) { return String(iban).replace(/\s/g, "").replace(/(.{4})(?=.)/g, "$1 "); }
  /* Adresse normalisée comme sur un RIB : majuscules, sans accent ni ponctuation. */
  function normaliser(s) {
    return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/['’\-.,]/g, " ").replace(/\s+/g, " ").trim();
  }

  /* Désolidarisation exécutée du compte joint du client (la dernière) : { date, conserve: "client" | "cotitulaire", cotitulaire, … } ; null sinon.
     Lue dans la sauvegarde locale partagée (banque.js) : le RIB n'a pas besoin que les pages lui transmettent l'état. */
  function desolidarisation(c) {
    var B = null, st = null, l;
    try { B = root && root.SGBF && root.SGBF.banque ? root.SGBF.banque : (typeof require === "function" ? require("./banque.js") : null); st = B && B.store ? B.store.charger() : null; } catch (e) { st = null; }
    if (!st || !Array.isArray(st.operations) || !c) return null;
    l = st.operations.filter(function (o) { return o.type === "desolidarisation_compte" && o.statut === "executee" && o.c === c.id && o.desol; });
    return l.length ? l[l.length - 1].desol : null;
  }

  /* Titulaires du compte autres que le premier. over : description d'un compte ouvert pendant l'exercice { forme, coTits, indivision } (compte supplémentaire d'un client, dossier d'ouverture) ;
     sinon celle du client : c.coTits (dossier d'ouverture, de un à quatre titulaires), c.coTit (second titulaire) ou, pour un client du portefeuille en couple, son conjoint (compte joint). Liste vide : compte individuel. */
  function coTitulaires(c, over) {
    function t(x) { return { civ: x.civ, prenom: x.prenom, nom: x.nom, sexe: x.civ === "Mme" ? "F" : "M" }; }
    if (over) return (over.coTits || []).map(t);
    if (desolidarisation(c)) return [];       /* compte joint désolidarisé : un seul titulaire */
    if (c.coTits && c.coTits.length) return c.coTits.map(t);
    if (c.coTit) return [t(c.coTit)];
    if (c.formeCompte) return [];    /* client créé pendant l'exercice : seul le dossier d'ouverture désigne des cotitulaires (son conjoint, s'il est renseigné plus tard, n'est pas cotitulaire) */
    var cj = c.fam && c.fam.conj;
    if (!cj) return [];
    return [{ civ: cj.sexe === "F" ? "Mme" : "M.", prenom: cj.prenom, nom: cj.nom, sexe: cj.sexe }];
  }
  /* Second titulaire du compte courant (le premier des autres titulaires) ; null si le compte est individuel. */
  function coTitulaire(c, over) { return coTitulaires(c, over)[0] || null; }
  function libTitulaire(t) { return t.civ + " " + t.nom.toUpperCase() + " " + t.prenom; }
  /* Forme du compte : « individuel », « joint » (ou) ou « indivis » (et). */
  function formeDe(c, over) { var f = over ? over.forme : c.formeCompte; return f === "indivis" && coTitulaire(c, over) ? "indivis" : coTitulaire(c, over) ? "joint" : "individuel"; }
  /* Intitulé du compte, tel qu'il figure sur le relevé et le RIB. Joint : « M. X Jean ou Mme Y Marie ». Indivis : « Indivision X » (« Indivision X – Y – Z » si les noms diffèrent)
     ou, pour une succession, « Succession de M. Z Pierre » ; les indivisaires sont nommés à la suite, reliés par « et ». */
  function intituleCompte(c, titulaires, over) {
    var forme = formeDe(c, over), co = coTitulaires(c, over);
    if (forme === "individuel") return titulaires[0];
    if (forme === "joint") return titulaires.join(" ou ");
    var ind = (over ? over.indivision : c.indivision) || { type: "indivision" };
    if (ind.type === "succession" && ind.defunt) return "Succession de " + ind.defunt.civ + " " + ind.defunt.nom.toUpperCase() + " " + ind.defunt.prenom;
    var noms = [c.nom.toUpperCase()]; co.forEach(function (x) { var n = x.nom.toUpperCase(); if (noms.indexOf(n) < 0) noms.push(n); });
    return "Indivision " + noms.join(" – ");
  }
  var LIB_FORME = { individuel: "compte individuel", joint: "compte joint", indivis: "compte indivis" };
  /* Mots à employer devant les titulaires d'un compte (r = résultat de rib()). */
  function libCompte(r) { return LIB_FORME[r.forme || (r.joint ? "joint" : "individuel")]; }
  function libTitulaires(r) { return r.joint ? "Titulaires du " + libCompte(r) : "Titulaire du compte"; }

  /* RIB d'un client (fiche de data_clients.js). */
  /* rang : 1 pour le compte du portefeuille (par défaut), 2 pour un compte supplémentaire ouvert pendant l'exercice (même client, autre numéro de compte). */
  /* over : forme et titulaires du compte, pour un compte supplémentaire (rang 2 et plus) ; un compte supplémentaire sans over est un compte individuel. */
  function rib(c, rang, over) {
    if (rang > 1 && !over) over = { forme: "individuel", coTits: [], indivision: null };
    var numero = "00" + chiffres(c.num) + (rang > 1 ? (rang < 10 ? "0" : "") + rang : SUFFIXE_COMPTE);
    var cle = cleRib(CODE_BANQUE, CODE_GUICHET, numero);
    var bban = CODE_BANQUE + CODE_GUICHET + numero + cle;
    var iban = "FR" + cleIban(bban) + bban;
    var cos = coTitulaires(c, over), co = cos[0] || null, titulaires = [c.civ + " " + c.nom.toUpperCase() + " " + c.prenom];
    var des = over || rang > 1 ? null : desolidarisation(c);
    cos.forEach(function (x) { titulaires.push(libTitulaire(x)); });
    if (des && des.conserve === "cotitulaire" && des.cotitulaire) titulaires = [libTitulaire(des.cotitulaire)];    /* l'ancien cotitulaire garde le compte, le client n'en est plus titulaire */
    var forme = formeDe(c, over);
    return {
      titulaire: titulaires[0], titulaires: titulaires, joint: !!co, coTitulaire: co, coTitulaires: cos, forme: forme, lien: forme === "indivis" ? "et" : "ou", intitule: intituleCompte(c, titulaires, over), indivision: forme === "indivis" ? ((over ? over.indivision : c.indivision) || { type: "indivision" }) : null,
      adresse: [normaliser(c.adr.rue), normaliser(c.adr.cp + " " + c.adr.ville)],
      banque: CODE_BANQUE, guichet: CODE_GUICHET, compte: numero, cle: cle, bban: bban,
      iban: iban, ibanLisible: ibanLisible(iban),
      bic: BIC, bicLisible: BIC.replace(/^(.{4})(.{4})(.*)$/, "$1 $2 $3"),
      domiciliation: DOMICILIATION.slice(), desolidarisation: des
    };
  }

  var api = { desolidarisation: desolidarisation, CODE_BANQUE: CODE_BANQUE, CODE_GUICHET: CODE_GUICHET, BIC: BIC, DOMICILIATION: DOMICILIATION, coTitulaire: coTitulaire, coTitulaires: coTitulaires, libTitulaire: libTitulaire, formeDe: formeDe, libCompte: libCompte, libTitulaires: libTitulaires, cleRib: cleRib, cleIban: cleIban, mod97: mod97, ibanValide: ibanValide, ibanLisible: ibanLisible, normaliser: normaliser, rib: rib };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.rib = api; }
})(typeof window !== "undefined" ? window : null);
