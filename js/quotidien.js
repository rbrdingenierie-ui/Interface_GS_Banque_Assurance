/* GS Banque & Assurance – dossiers « du jour ».
   jour(AAAA-MM-JJ) renvoie, pour une date, la liste des dossiers des trois outils (« Opérations débiteurs », « Mouvements atypiques » et « Gestion des incidents ») avec leurs relevés.
   La liste ne dépend que de la date : toute la classe reçoit les mêmes dossiers le même jour, et d'autres le lendemain.
   Chaque liste compte entre 5 et 20 dossiers : environ un quart sont des dossiers de référence rédigés à la main, les autres sont fabriqués
   (scénarios, chiffres tirés au hasard, décisions calculées par la politique de l'exercice, relevés construits pour concorder).
   Les modules des deux générateurs ne sont chargés que si la page en a besoin (page d'un outil : le sien ; accueil : les deux). */
(function (root) {
  "use strict";

  var navigateur = !!(root && root.SGBF);
  function charge(cle, fichier) {
    if (navigateur && root.SGBF[cle]) return root.SGBF[cle];
    if (navigateur) throw new Error("module « " + cle + " » non chargé dans la page");
    return require(fichier);
  }
  var Q = charge("quotidienBase", "./quotidien_base.js");

  var PART_REFERENCE = 0.25;

  function refDebiteurs() {
    if (navigateur && root.SGBF.dossiersReference) return { dossiers: root.SGBF.dossiersReference, releves: root.SGBF.relevesReference || {} };
    if (navigateur && root.SGBF.dossiers) return { dossiers: root.SGBF.dossiers, releves: root.SGBF.releves || {} };
    return { dossiers: require("./data.js").dossiers, releves: require("./releves.js").releves };
  }

  /* Choisit n scénarios (au plus 3 fois le même, 4 au-delà de 14 dossiers). */
  function scenarios(DEB, r, n) {
    var cle = DEB.ORDRE.filter(function (k) { return k !== "defaut"; }), compte = {}, out = [], plafond = n > 14 ? 4 : 3;
    while (out.length < n) {
      var tab = cle.filter(function (k) { return (compte[k] || 0) < plafond; }).map(function (k) { return [k, DEB.SC[k].w]; });
      var k = r.poids(tab);
      compte[k] = (compte[k] || 0) + 1; out.push(k);
    }
    return out;
  }

  function debiteurs(ymd) {
    var DEB = charge("quotidienDeb", "./quotidien_deb.js"), ASM = charge("quotidienDebAsm", "./quotidien_deb_asm.js");
    var n = Q.nombreDuJour(ymd, "debiteurs"), r = Q.rng("debiteurs|" + ymd);
    var ref = refDebiteurs(), nRef = Math.min(ref.dossiers.length, Math.max(1, Math.round(n * PART_REFERENCE)));
    var ids = r.melange(ref.dossiers.map(function (d) { return d.id; })).slice(0, nRef);
    var liste = [], noms = {}, comptes = {};
    ids.forEach(function (id) {
      var d = ref.dossiers.filter(function (x) { return x.id === id; })[0];
      noms[d.client.nom] = 1; comptes[d.client.compte] = 1;
      liste.push({ source: "reference", scenario: "reference", refId: id, d: d, rel: ref.releves[id] });
    });
    var sc = scenarios(DEB, r, n - nRef), i, v, x;
    sc.forEach(function (k, ix) {
      for (v = 0; v < 8; v++) {
        x = ASM.fabriquer(ymd + "|d" + ix + "|v" + v, k);
        if (!noms[x.dossier.client.nom] && !comptes[x.dossier.client.compte]) break;
      }
      noms[x.dossier.client.nom] = 1; comptes[x.dossier.client.compte] = 1;
      liste.push({ source: "genere", scenario: k, d: x.dossier, rel: x.releve });
    });
    liste = Q.rng("ordre|debiteurs|" + ymd).melange(liste);
    var dossiers = [], releves = {}, composition = [];
    liste.forEach(function (e, ix) {
      var d = e.source === "reference" ? Object.assign({}, e.d) : e.d;
      d.id = ix + 1;
      dossiers.push(d); releves[d.id] = e.rel;
      composition.push({ id: d.id, source: e.source, scenario: e.scenario, refId: e.refId || null });
    });
    return { dossiers: dossiers, releves: releves, composition: composition };
  }

  function atypiques(ymd) { return charge("quotidienAtyp", "./quotidien_atyp.js").atypiques(ymd); }
  function incidents(ymd) { return charge("quotidienGdi", "./quotidien_gdi.js").incidents(ymd); }

  function jour(ymd) {
    return { ymd: ymd, debiteurs: debiteurs(ymd), atypiques: atypiques(ymd), incidents: incidents(ymd) };
  }

  var api = { jour: jour, debiteurs: debiteurs, atypiques: atypiques, incidents: incidents, PART_REFERENCE: PART_REFERENCE };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.quotidien = api; }
})(typeof window !== "undefined" ? window : null);
