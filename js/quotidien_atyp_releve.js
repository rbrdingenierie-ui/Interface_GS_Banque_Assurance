/* GS Banque & Assurance – dossiers « du jour » (mouvements atypiques) : relevé de compte des trois derniers mois civils.
   Les opérations du dossier sont reprises à leur date ; les opérations habituelles sont reprises chaque mois ; on ajoute les prélèvements,
   les paiements par carte et les virements courants ; le solde d'ouverture est calculé pour que le solde ne passe jamais sous le plancher du profil.
   Format d'une ligne : [mois civils écoulés (3, 2 ou 1), jour (1 à 28), type, libellé, montant (− débit, + crédit), identifiant de l'opération du dossier (si la ligne en est issue)].
   Plan : { ouverture:{mois,jour,versement}, fixes:[[jour, libellé, montant<0, type]], extras:[[jour, type, libellé, [m3, m2, m1]]], cartes:[n, mini, maxi, j1, j2],
            cartesMois:{mois:cfg}, agreges:{idOp:{jours, lib, m:{3:[…],2:[…],1:[…]}}}, variantes:{idOp:{mois:montant|null}}, repete:{idOp:false}, plancher }.
   Fonction pure. */
(function (root) {
  "use strict";

  var Q = root && root.SGBF && root.SGBF.quotidienBase ? root.SGBF.quotidienBase : require("./quotidien_base.js");
  var P = root && root.SGBF && root.SGBF.quotidienPools ? root.SGBF.quotidienPools : require("./quotidien_pools.js");
  var r2 = Q.r2;
  var MOIS = [3, 2, 1];

  function sens(op) {
    if (op.sens) return op.sens === "credit" ? 1 : -1;
    return op.type === "depot_especes" || op.type === "depot_cheque" ? 1 : -1;
  }

  /* Répartit un total en n montants arrondis à 50 € (le dernier absorbe l'écart). */
  function repartir(r, total, n) {
    var poids = [], s = 0, i, out = [], reste = total, m;
    for (i = 0; i < n; i++) { poids.push(0.75 + r.f() * 0.5); s += poids[i]; }
    for (i = 0; i < n - 1; i++) { m = Math.max(50, Math.round(total * poids[i] / s / 50) * 50); out.push(m); reste -= m; }
    out.push(reste);
    return out;
  }

  function construire(r, d, plan) {
    var ville = d.client.coordonnees.adresse.replace(/^.*\b\d{5}\s+/, ""), ouv = plan.ouverture || null, lignes = [];
    function avant(mois, jour) { return ouv && (mois > ouv.mois || (mois === ouv.mois && jour < ouv.jour)); }
    function add(mois, jour, ord, kind, lib, m, op) {
      if (avant(mois, jour)) return;
      lignes.push({ mois: mois, jour: jour, ord: ord, kind: kind, lib: lib, m: r2(m), op: op || null, n: lignes.length });
    }
    function libCheque(b) { return "Chèque n° " + (3000000 + r.n(0, 4999999)) + " – " + b; }

    if (ouv) add(ouv.mois, ouv.jour, 0, "ouverture", "Ouverture du compte – versement initial", ouv.versement);

    /* opérations du dossier */
    d.operations.forEach(function (op) {
      var ag = (plan.agreges || {})[op.id];
      if (ag) {
        MOIS.forEach(function (mo) { ag.jours.forEach(function (j, i) { add(mo, j, 2, op.type, ag.lib, sens(op) * ag.m[mo][i], mo === op.mois ? op.id : null); }); });
        return;
      }
      add(op.mois, op.jour, op.atypique ? 3 : 2, op.type, op.libelle, sens(op) * op.montant, op.id);
      if (!op.atypique && (plan.repete || {})[op.id] !== false) {
        MOIS.filter(function (mo) { return mo !== op.mois; }).forEach(function (mo) {
          var vr = ((plan.variantes || {})[op.id] || {})[mo];
          if (vr === null) return;
          add(mo, op.jour, 2, op.type, op.libelle, sens(op) * (vr != null ? vr : op.montant));
        });
      }
    });

    /* prélèvements et virements fixes, chèques et virements récurrents */
    (plan.fixes || []).forEach(function (f) { MOIS.forEach(function (mo) { add(mo, f[0], 4, f[3] || "prelevement", f[1], f[2]); }); });
    (plan.extras || []).forEach(function (e) {
      MOIS.forEach(function (mo, i) {
        var m = e[3][i];
        if (m == null) return;
        add(mo, e[0], 4, e[1], e[1] === "cheque" ? libCheque(e[2]) : e[2], m);
      });
    });

    /* paiements par carte */
    MOIS.forEach(function (mo) {
      var cfg = (plan.cartesMois || {})[mo] || plan.cartes;
      if (!cfg) return;
      var n = cfg[0], mini = cfg[1], maxi = cfg[2], j1 = cfg[3] || 1, j2 = cfg[4] || 28;
      var total = mini + r.f() * (maxi - mini), w = [], sw = 0, i, mts, jours = [], ordre, lib = [];
      for (i = 0; i < n; i++) { w.push(0.35 + r.f()); sw += w[i]; }
      mts = w.map(function (x) { return r2(total * x / sw); });
      for (i = 0; i < n; i++) jours.push(j1 + r.n(0, j2 - j1));
      jours.sort(function (a, b) { return a - b; });
      mts.forEach(function (m, ix) { lib[ix] = "Paiement carte – " + P.carteSelon(r, m, ville); });
      mts.forEach(function (m, ix) { add(mo, jours[ix], 5, "carte", lib[ix], -m); });
    });

    lignes.sort(function (a, b) { return b.mois - a.mois || a.jour - b.jour || a.ord - b.ord || a.n - b.n; });

    /* solde d'ouverture : on garde au moins le plancher sur toute la période */
    var plancher = plan.plancher != null ? plan.plancher : 200, cum = 0, min = 0;
    lignes.forEach(function (l) { cum = r2(cum + l.m); if (cum < min) min = cum; });
    var ouverture = ouv ? 0 : Math.ceil(Math.max(0, plancher - min) / 10) * 10;
    return {
      ouverture: ouverture,
      depart: ouv ? { mois: ouv.mois, jour: ouv.jour } : null,
      lignes: lignes.map(function (l) { return [l.mois, l.jour, l.kind, l.lib, l.m].concat(l.op ? [l.op] : []); })
    };
  }

  var api = { construire: construire, repartir: repartir };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.quotidienAtypReleve = api; }
})(typeof window !== "undefined" ? window : null);
