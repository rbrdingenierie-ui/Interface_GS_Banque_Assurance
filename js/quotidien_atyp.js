/* GS Banque & Assurance – dossiers « du jour » (mouvements atypiques) : tirage de la journée.
   atypiques(AAAA-MM-JJ) renvoie 5 à 20 dossiers (même liste pour toute la classe ce jour-là) : environ un quart de dossiers de référence rédigés à la main,
   les autres fabriqués à partir de 24 familles de cas (12 cohérents : le conseiller classe ; 12 à déclarer : le conseiller déclare à TRACFIN).
   Chaque dossier fabriqué est contrôlé (solde jamais négatif, au moins une opération atypique…) ; en cas d'échec on retire un autre tirage. Fonctions pures. */
(function (root) {
  "use strict";

  var Q = root && root.SGBF && root.SGBF.quotidienBase ? root.SGBF.quotidienBase : require("./quotidien_base.js");
  var COH = root && root.SGBF && root.SGBF.quotidienAtypCoherent ? root.SGBF.quotidienAtypCoherent : require("./quotidien_atyp_coherent.js");
  var DEC = root && root.SGBF && root.SGBF.quotidienAtypDeclaration ? root.SGBF.quotidienAtypDeclaration : require("./quotidien_atyp_declaration.js");

  var PART_REFERENCE = 0.25;
  var FAMILLES_COHERENTES = Object.keys(COH.familles);
  var FAMILLES_A_DECLARER = Object.keys(DEC.familles);

  function refAtypiques() {
    if (root && root.SGBF && root.SGBF.atypiquesReference) return { dossiers: root.SGBF.atypiquesReference, releves: root.SGBF.relevesAtypReference || {} };
    if (root && root.SGBF && root.SGBF.atypiques) return { dossiers: root.SGBF.atypiques, releves: root.SGBF.relevesAtyp || {} };
    return { dossiers: require("./data_atypiques.js").dossiers, releves: require("./releves_atypiques.js").releves };
  }

  function constructeur(famille) { return COH.familles[famille] || DEC.familles[famille]; }

  /* Contrôles de cohérence d'un dossier fabriqué : renvoie la liste des problèmes (vide si tout va bien). */
  function controler(x) {
    var d = x.dossier, rel = x.releve, pb = [], bal, mini;
    if (!d || !rel) return ["dossier ou relevé absent"];
    if (!d.operations || d.operations.length < 2) pb.push("moins de deux opérations");
    if (!d.operations.some(function (o) { return o.atypique; })) pb.push("aucune opération atypique");
    if (d.issue !== "coherent" && d.issue !== "declaration") pb.push("issue inconnue");
    if (rel.ouverture < 0 || rel.ouverture > 30000) pb.push("solde d'ouverture hors limites");
    bal = rel.ouverture; mini = bal;
    rel.lignes.forEach(function (l) { bal = Q.r2(bal + l[4]); if (bal < mini) mini = bal; });
    if (mini < 0) pb.push("solde négatif");
    return pb;
  }

  /* Fabrique un dossier (et son relevé) pour une graine et une famille ; l'appel est reproductible. */
  function fabriquer(graine, famille) {
    var f = constructeur(famille);
    if (!f) throw new Error("famille inconnue : " + famille);
    var x = f(Q.rng(graine));
    x.famille = famille;
    x.problemes = controler(x);
    return x;
  }

  /* Tire k familles distinctes dans une liste (12 familles par côté, jamais plus de 8 tirées le même jour). */
  function tirer(r, liste, k) { return r.melange(liste).slice(0, k); }

  function atypiques(ymd) {
    var n = Q.nombreDuJour(ymd, "atypiques"), r = Q.rng("atypiques|" + ymd);
    var ref = refAtypiques(), nRef = Math.min(ref.dossiers.length, Math.max(1, Math.round(n * PART_REFERENCE)));
    var refCoh = ref.dossiers.filter(function (d) { return d.issue === "coherent"; }).map(function (d) { return d.id; });
    var refDec = ref.dossiers.filter(function (d) { return d.issue !== "coherent"; }).map(function (d) { return d.id; });
    var nRefDec = Math.floor(nRef / 2) + (nRef % 2 ? r.n(0, 1) : 0);
    var ids = r.melange(refDec).slice(0, nRefDec).concat(r.melange(refCoh).slice(0, nRef - nRefDec));
    var liste = [], noms = {}, comptes = {}, pers = {};
    ids.forEach(function (id) {
      var d = ref.dossiers.filter(function (x) { return x.id === id; })[0];
      noms[d.client.nom] = 1; comptes[d.client.compte] = 1; pers[d.client.prenom + " " + d.client.nom] = 1;
      liste.push({ source: "reference", famille: "reference", refId: id, d: d, rel: ref.releves[id], issue: d.issue });
    });

    var nGen = n - nRef;
    var nDec = Math.floor(nGen / 2) + (nGen % 2 ? r.n(0, 1) : 0);
    var fams = tirer(r, FAMILLES_A_DECLARER, nDec).concat(tirer(r, FAMILLES_COHERENTES, nGen - nDec));
    fams = r.melange(fams);
    fams.forEach(function (famille, ix) {
      var x = null, v, essai;
      for (v = 0; v < 40; v++) {
        essai = fabriquer(ymd + "|a" + ix + "|v" + v, famille);
        if (essai.problemes.length) continue;
        var c = essai.dossier.client;
        if (noms[c.nom] || comptes[c.compte] || pers[c.prenom + " " + c.nom]) { x = x || null; continue; }
        x = essai; break;
      }
      if (!x) throw new Error("impossible de fabriquer un dossier valide : " + famille + " (" + ymd + ")");
      noms[x.dossier.client.nom] = 1; comptes[x.dossier.client.compte] = 1; pers[x.dossier.client.prenom + " " + x.dossier.client.nom] = 1;
      liste.push({ source: "genere", famille: famille, d: x.dossier, rel: x.releve, issue: x.dossier.issue });
    });

    liste = Q.rng("ordre|atypiques|" + ymd).melange(liste);
    var dossiers = [], releves = {}, composition = [];
    liste.forEach(function (e, ix) {
      var d = e.source === "reference" ? Object.assign({}, e.d) : e.d;
      d.id = ix + 1;
      dossiers.push(d); releves[d.id] = e.rel;
      composition.push({ id: d.id, source: e.source, famille: e.famille, issue: e.issue, refId: e.refId || null });
    });
    return { dossiers: dossiers, releves: releves, composition: composition };
  }

  var api = { atypiques: atypiques, fabriquer: fabriquer, controler: controler, FAMILLES_COHERENTES: FAMILLES_COHERENTES, FAMILLES_A_DECLARER: FAMILLES_A_DECLARER, PART_REFERENCE: PART_REFERENCE };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.quotidienAtyp = api; }
})(typeof window !== "undefined" ? window : null);
