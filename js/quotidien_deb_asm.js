/* GS Banque & Assurance – dossiers « du jour » (opérations débiteurs) : assemblage d'un dossier complet à partir d'un scénario.
   Étapes : tirage du profil et des chiffres, vérification de l'intention du scénario par la politique, construction du relevé, puis textes
   (décisions, observations, opportunité commerciale, « à retenir »). Un tirage qui ne passe pas un contrôle est écarté et recommencé avec une autre graine. */
(function (root) {
  "use strict";

  var Q = root && root.SGBF && root.SGBF.quotidienBase ? root.SGBF.quotidienBase : require("./quotidien_base.js");
  var P = root && root.SGBF && root.SGBF.quotidienPools ? root.SGBF.quotidienPools : require("./quotidien_pools.js");
  var R = root && root.SGBF && root.SGBF.rules ? root.SGBF.rules : require("./rules.js");
  var T = root && root.SGBF && root.SGBF.quotidienDebTextes ? root.SGBF.quotidienDebTextes : require("./quotidien_deb_textes.js");
  var D = root && root.SGBF && root.SGBF.quotidienDeb ? root.SGBF.quotidienDeb : require("./quotidien_deb.js");
  var REL = root && root.SGBF && root.SGBF.quotidienReleve ? root.SGBF.quotidienReleve : require("./quotidien_releve.js");
  var ICC = root && root.SGBF && root.SGBF.icc ? root.SGBF.icc : require("./icc.js");
  var eur = Q.eur, r2 = Q.r2;

  var OBJECTIFS = {
    sain: ["Valider des opérations courantes sur un compte sain, puis repérer l'éventuelle opportunité commerciale.", "Constater que les opérations passent sans difficulté, puis chercher un besoin du client.", "Vérifier la provision de chaque opération : ici tout passe, l'enjeu est commercial."],
    carte_rejet: ["Valider l'opération par carte (ordre irrévocable), puis protéger la position en rejetant l'opération qui aggraverait le débit.", "Distinguer la carte, qui se valide toujours, du chèque ou du prélèvement qui peut être rejeté."],
    chq_rejet: ["Reconnaître un compte dont l'autorisation est déjà entièrement utilisée : l'opération suivante peut être rejetée.", "Ne pas creuser le dépassement d'un client à la note dégradée, sans crédit proche."],
    tolerance: ["Distinguer un client sain qui attend un crédit certain (on tolère un dépassement faible) d'un cas où il faut rejeter.", "Peser la tolérance : note, historique de rejets, délai et montant du crédit attendu."],
    cheque15: ["Connaître le seuil de 15 € : un chèque de 15 € ou moins ne peut pas être refusé, même sans provision.", "Appliquer le seuil de 15 € aux chèques, puis décider pour l'opération suivante."],
    controle: ["Un compte sous contrôle (SC) n'est pas un compte débiteur : le conseiller surveille, il ne rejette pas.", "Reconnaître un compte sous contrôle : on paie, et le conseiller surveille les mouvements."],
    ocf: ["Décider pour un client en offre clientèle fragile (OCF), dont les frais d'incidents sont plafonnés.", "Appliquer les règles de la clientèle fragile : commission de 4 € et frais plafonnés à 20 € par mois."],
    ficp: ["Un client fiché au FICP (FCP) : la règle payer ou rejeter ne change pas, mais aucun crédit ne se propose.", "Ne pas confondre fichage FICP et interdiction du chéquier ; aucune offre de crédit pour ce client."],
    dac: ["Un client en droit au compte (DAC) : services bancaires de base, carte à autorisation systématique, ni découvert ni chéquier.", "Droit au compte : pas de découvert possible, la carte ne peut pas créer de débit non autorisé."],
    debiteur: ["Un compte déjà à l'état des débiteurs depuis plusieurs jours : on ne creuse pas le débit.", "Ne rien aggraver sur un compte déjà irrégulier et dégradé."],
    gros_cheque: ["Un gros chèque que le salaire attendu ne couvre pas : on rejette, après information du client.", "Un dépassement disproportionné par rapport aux revenus se rejette, même pour un bon client."]
  };

  function nomOp(o) { return o.type === "carte" ? "paiement" : o.type === "cheque" ? "chèque" : "prélèvement"; }

  function assembler(r, pf, sk, k) {
    var c = pf.client, rev = c.revenus, aut = sk.aut, i, o, ops = [], nums = {};
    var ville = r.pick(r.chance(0.8) ? P.VILLES : P.VILLES_PROCHES);
    /* statut du compte */
    if (sk.fragile) c.fragile = true;
    if (sk.ficp) c.ficp = true;
    if (sk.dac) c.dac = true;
    if (sk.ancMois) { delete c.ancienneteAns; c.ancienneteMois = sk.ancMois; }
    var note = sk.note, nbRej = sk.rej[0], rec = sk.rej[1];
    if (note === "A") { nbRej = 0; rec = 0; }
    if (note === "B") { nbRej = Math.min(nbRej, 1); rec = 0; }
    /* produits */
    var prod = ["Compte courant"], carteAut = c.fragile || c.dac;
    if (c.dac) prod = ["Services bancaires de base", "Carte à autorisation systématique"];
    else if (c.fragile) prod = ["Compte courant", "Offre clientèle fragile (OCF)", "Carte à autorisation systématique"];
    else {
      var premier = sk.opp !== "libre" && sk.opp === "credit" ? false : (rev >= 3300 && !sk.opp && r.chance(0.35));
      prod.push(pf.prof.st === "alternance" || c.age < 23 ? "Carte Visa à débit immédiat" : premier ? "Carte Visa Premier" : "Carte Visa Classic");
    }
    if (!c.dac && r.chance(0.5) && note !== "Défaut" && !c.ficp) prod.push("Livret A");
    if (aut > 0 && !c.dac) prod.push("Autorisation de découvert");
    if (c.ficp) prod.push("Crédit à la consommation (incident de remboursement)");
    c.produits = prod;
    /* crédit attendu */
    var cr = sk.cr == null ? null : { libelle: pf.prof.cr, montant: rev, dansJours: sk.cr };
    if (cr && /^Salaire/.test(cr.libelle) && rev < 1350 && c.fragile) { cr.libelle = "Salaire et prime d'activité"; cr.montant = rev + r.pas(60, 160, 10); }
    /* opérations */
    sk.ops.forEach(function (s, ix) {
      var x = { t: s.t, m: s.m, lib: s.lib, mandat: s.mandat, kind: s.kind, motif: s.motif };
      if (x.t === "carte") x.lib = D.carteOp(r, ville, x.m);
      if (x.t === "prelevement") { var q = D.prelevExact(r, x.m, rev); x.lib = q.lib; x.mandat = q.mandat; x.kind = q.kind; }
      if (x.t === "cheque") {
        x.num = 4400000 + r.n(0, 99999); while (nums[x.num]) x.num++; nums[x.num] = 1;
        if (s.petit) x.lib = r.pick(P.CHEQUE_PETIT)[0];
        else { var ce = D.chequeExact(r, x.m); x.lib = ce.lib; if (ce.motif && sk.projet !== undefined) sk.projet = ce.motif; }
      }
      if (x.t === "prelevement" && x.m > 0.6 * rev) x.trop = true;
      ops.push(x);
    });
    if (ops.some(function (x) { return x.trop; })) return null;
    if (ops.some(function (x) { return x.t === "cheque" && x.m === 50; })) return null;
    /* un même libellé ne figure pas deux fois dans les opérations */
    var vus = {};
    for (i = 0; i < ops.length; i++) { if (vus[ops[i].lib]) return null; vus[ops[i].lib] = 1; }
    var aCredit = ops.some(function (x) { return x.kind === "credit"; });
    var operations = ops.map(function (x, ix) {
      var o2 = D.opFinale(r, x, ix);
      if (x.t === "cheque" && x.num) o2.detail = "Chèque n° " + x.num + ", émis le {date}";
      return o2;
    });
    var d = {
      objectif: r.pick(OBJECTIFS[sk.obj]), opportunite: { type: null, explication: "" },
      client: c, note: note,
      position: { solde: r2(sk.solde), autorisation: aut, creditAttendu: cr, debiteurDepuis: sk.dd || null },
      operations: operations, antecedents: [], retenir: [], argumentaire: []
    };
    if (sk.controle) d.controle = { motif: sk.controle === "fraude" ? "fraude à la carte constatée il y a " + r.pick([2, 3, 4]) + " semaines (carte remplacée)" : "ouverture de compte récente (il y a " + sk.ancMois + " mois)" };
    if (nbRej) { d.antecedents = D.antecedents(r, nbRej, rec, d); if (!d.antecedents) return null; }
    /* plan du relevé */
    var rc = [], somme = 0;
    d.operations.forEach(function (op) {
      if (op.type !== "prelevement") return;
      var lib = op.libelle, mm = op.montant, u = cr ? (30 - cr.dansJours) - op.joursAvant : 0;
      rc.push({ k: "prelevement", lib: lib, m: mm, u: u, j0: op.joursAvant });
      somme += mm;
    });
    var extras = c.dac ? 1 : r.n(1, 3), kinds = r.melange(["loyer", "energie", "tel", "assur", "divers"]), e;
    for (e = 0; e < extras && e < kinds.length; e++) {
      var p = D.prelev(r, kinds[e], rev, null, null);
      if (vus[p.lib] || somme + p.m > 0.55 * rev) continue;
      vus[p.lib] = 1; somme += p.m;
      rc.push({ k: "prelevement", lib: p.lib, m: p.m, u: r.n(0, 28), j0: r.n(1, 29) });
    }
    if (aCredit && (c.dac || sk.opp === "credit")) return null;
    if (aCredit && !c.produits.some(function (x) { return /Crédit/.test(x); })) c.produits.push("Crédit à la consommation");
    ICC.completerProduits(c, "deb");   /* assurances, livret, parts sociales : tirage par empreinte du compte, sans toucher au générateur du jour */
    var plan = { recurrents: rc, retraits: r.n(1, 3), cheques: c.dac ? 0 : r.n(0, 2), ville: ville, depart: 90, ouverture: false };
    if ((k === "sain" || k === "tolerance") && !sk.dd) {
      if (aut > 0 && r.chance(0.4)) plan.neg = [Math.round(aut * 0.15), Math.round(aut * 0.7)];
      else if (aut === 0 && r.chance(0.4)) plan.low = [10, 120];
    }
    if (sk.ancMois && sk.ancMois <= 2) { plan.depart = sk.ancMois * 30; plan.ouverture = true; }
    if (sk.dd) { var N = sk.dd; if (N >= 88) return null; plan.irreg = { N: N, x: r.pas(20, 140, 5), extras: [] }; if (N >= 5) { var ne = r.n(0, 2), q; for (q = 0; q < ne; q++) plan.irreg.extras.push({ j: r.n(2, N - 1), m: r.pas(10, 70, 1) }); } }
    return { d: d, plan: plan, pf: pf, ville: ville };
  }

  /* chiffres tirés du relevé */
  function mesures(d, rel) {
    var solde = d.position.solde, tot = 0, i, l, bal, min = Infinity, cartes30 = 0, cartes90 = 0, negAvantPaie = 0;
    rel.lignes.forEach(function (x) { tot += x[3]; });
    bal = R.arrondi(solde - tot);
    var vals = [];
    rel.lignes.forEach(function (x) { bal = R.arrondi(bal + x[3]); vals.push([x[0], bal]); if (bal < min) min = bal; if (x[1] === "carte") { cartes90 += -x[3]; if (x[0] <= 30) cartes30 += -x[3]; } });
    return { min: min, cartes30: r2(cartes30), cartes90: r2(cartes90) };
  }

  function choisirOpp(r, d, sk, m) {
    if (sk.opp !== "libre" && sk.opp !== "credit") return null;
    var c = d.client, aut = d.position.autorisation, cand = [];
    var classic = c.produits.some(function (x) { return /Visa Classic/.test(x); }), premier = c.produits.some(function (x) { return /Visa Premier/.test(x); });
    var credit = c.produits.some(function (x) { return /Crédit/.test(x); });
    if (sk.opp === "credit") return premier || credit ? null : "credit";
    if (classic && c.revenus >= 2000 && m.cartes30 >= 0.55 * c.revenus) cand.push(["carte", 3]);
    if (aut === 0 && m.min < 150) cand.push(["decouvert", 3]);
    if (aut > 0 && m.min < 0) cand.push(["augmentation", 3]);
    if (!premier && !credit) cand.push(["credit", 1]);
    cand.push(["aucune", 2]);
    return r.poids(cand);
  }

  /* textes d'opportunité */
  function texteOpp(d, t, m) {
    var c = d.client, n = d.antecedents.length, rev = eur(c.revenus), aut = d.position.autorisation;
    var base = "Note " + d.note + ", " + rev + " de " + c.revenusNote.replace(/ domicilié$/, " domicilié") + ", " + T.rejetsTxt(n).replace("sur 12 mois", "sur 12 mois");
    if (t === "carte") return "Note " + d.note + ", " + rev + " de " + c.revenusNote + " et une carte Visa Classic qui règle la plus grande part des dépenses (" + eur(m.cartes30) + " de paiements par carte au cours des 30 derniers jours) : une montée en gamme vers une carte Premier se justifie.";
    if (t === "decouvert") return "Aucune autorisation de découvert alors que le compte est descendu jusqu'à " + eur(m.min) + " sur trois mois ; " + c.revenusNote + " de " + rev + ", note " + d.note + ", " + T.rejetsTxt(n) + " : une autorisation de découvert laisserait une marge de sécurité.";
    if (t === "augmentation") return "L'autorisation de " + eur(aut) + " est utilisée (solde le plus bas des trois derniers mois : " + eur(m.min) + ") avec " + c.revenusNote + " de " + rev + ", une note " + d.note + " et " + T.rejetsTxt(n) + " : une augmentation du découvert est à proposer.";
    if (t === "credit") return "Note " + d.note + ", " + rev + " de " + c.revenusNote + " et " + T.rejetsTxt(n) + " : un crédit consommation peut financer le projet évoqué par le client.";
    return null;
  }

  function texteAucune(d, sk) {
    var c = d.client, n = d.antecedents.length;
    if (d.controle) return "Compte sous contrôle (SC) " + (/fraude/.test(d.controle.motif) ? "à la suite d'une fraude" : "ouvert depuis " + c.ancienneteMois + " mois") + " : on ne propose rien tant que le contrôle n'est pas levé.";
    if (c.dac) return "Droit au compte (DAC) : les services bancaires de base n'incluent ni découvert ni chéquier, et la carte est à autorisation systématique : on s'en tient à ces services.";
    if (c.fragile) return "Client titulaire de l'offre clientèle fragile (OCF), note " + d.note + " : on ne propose ni découvert ni crédit.";
    if (c.ficp) return "Client fiché FICP (FCP) : la banque consulte le fichier avant tout crédit et l'inscription pèse lourdement dans la décision. On ne propose ni crédit consommation ni découvert.";
    if (d.note === "Défaut") return "Client en défaut, dossier suivi par le recouvrement : aucune proposition commerciale.";
    if (d.position.debiteurDepuis) return "Note " + d.note + ", " + T.rejetsTxt(n).replace("sur 12 mois", "sur 12 mois") + " et compte à l'état des débiteurs depuis " + Q.pl(d.position.debiteurDepuis, "jour", "jours") + " : aucune proposition commerciale.";
    if (d.note === "C" || d.note === "D" || d.note === "E") return "Note " + d.note + (n ? ", " + T.rejetsTxt(n) : "") + " : client à surveiller, pas encore « sain » (notes A et B) : pas de proposition commerciale.";
    return "Note " + d.note + ", " + c.revenusNote + " de " + eur(c.revenus) + (d.position.autorisation ? " et autorisation de " + eur(d.position.autorisation) : "") + " : le compte fonctionne normalement, la carte et l'autorisation sont adaptées à l'usage et aucun besoin n'est détecté.";
  }

  function finir(r, d, sk, pol, rel, pf) {
    var m = mesures(d, rel), i, o, st;
    d.operations.forEach(function (op, ix) {
      st = pol[ix];
      op.attendu = st.att;
      if (st.acc) op.acceptable = st.acc;
      if (st.tol) op.tolerance = true;
      op.explication = T.expliquer(d, op, st, ix);
    });
    /* opportunité */
    var t = choisirOpp(r, d, sk, m);
    if (t === "carte") { d.observations = ["Règle la plus grande part de ses dépenses courantes par carte : " + eur(m.cartes30) + " de paiements par carte au cours des 30 derniers jours"]; }
    else if (t === "decouvert") { d.observations = ["Solde le plus bas des trois derniers mois : " + eur(m.min) + ", sans autorisation de découvert"]; }
    else if (t === "augmentation") { d.observations = ["Solde le plus bas des trois derniers mois : " + eur(m.min) + " pour une autorisation de " + eur(d.position.autorisation)]; }
    else if (t === "credit" && sk.projet) { d.observations = ["Projet évoqué lors du dernier entretien : " + sk.projet]; }
    else if (t === "credit") { d.observations = ["Projet évoqué lors du dernier entretien : " + r.pick(["équiper la maison (électroménager)", "changer de véhicule", "financer des travaux", "financer un voyage en famille"])]; }
    if (t && t !== "aucune") { d.opportunite = { type: t, explication: texteOpp(d, t, m) }; }
    else d.opportunite = { type: null, explication: texteAucune(d, sk) };
    /* à retenir et argumentaire */
    var fin = R.projeter(d, R.decisionsAttendues(d)), nbRej = d.operations.filter(function (o) { return o.attendu === "rejeter"; }).length;
    var etatFin = fin.etat.code === "etat_debiteurs" ? "à l'état des débiteurs" : fin.etat.code === "autorise" ? "débiteur, mais dans l'autorisation de " + eur(d.position.autorisation) : "créditeur";
    d.argumentaire = ["Solde final de " + eur(fin.soldeFinal) + " : " + etatFin, "Note " + d.note + ", " + eur(d.client.revenus) + " de " + d.client.revenusNote + ", " + T.rejetsTxt(d.antecedents.length)];
    var tol = d.operations.filter(function (o) { return o.tolerance; }).length;
    if (tol) d.argumentaire.push(eur(d.position.creditAttendu.montant) + " de " + T.creditNom(d.position.creditAttendu) + " " + T.delaiTxt(d.position.creditAttendu.dansJours) + " : dépassement couvert, tolérance");
    if (nbRej) d.argumentaire.push(nbRej + " opération" + (nbRej > 1 ? "s" : "") + " rejetée" + (nbRej > 1 ? "s" : "") + " : frais de rejet plafonnés");
    if (d.operations.some(function (o) { return o.type === "carte"; })) d.argumentaire.push("Carte : ordre irrévocable, toujours validée");
    d.argumentaire.push(d.opportunite.type ? "Opportunité : " + R.libelleOpportunite(d.opportunite.type).toLowerCase() : "Aucune opportunité commerciale");
    d.retenir = RETENIR(d, pol);
    return true;
  }

  function RETENIR(d, pol) {
    var out = [], has = function (c) { return pol.some(function (s) { return s.cas === c; }); };
    if (has("carte")) out.push("La carte se valide toujours : c'est l'ordre irrévocable du client.");
    if (has("chq15")) out.push("Un chèque de 15 € ou moins ne peut pas être refusé, même sans provision : il est débité.");
    if (pol.some(function (s) { return s.att === "rejeter"; })) out.push("Le chèque ou le prélèvement qui aggrave le débit peut être rejeté : frais de rejet plafonnés (30 € ou 50 € pour un chèque, 20 € au plus pour un prélèvement).");
    if (pol.some(function (s) { return s.tol; })) out.push("Tolérance : client sain, dépassement couvert par un crédit certain à très court terme ; la commission d'intervention est de " + (d.client.fragile ? "4 €" : "8 €") + " par opération.");
    if (pol.some(function (s) { return s.cas === "ok" && s.apres < 0; })) out.push("Un solde négatif dans l'autorisation de découvert n'est pas l'état des débiteurs : on paie.");
    if (d.client.fragile) out.push("Offre clientèle fragile (OCF) : commission d'intervention de 4 € par opération et frais d'incidents plafonnés à 20 € par mois.");
    if (d.client.ficp) out.push("Client fiché FICP : le fichage n'interdit pas la carte mais exclut toute proposition de crédit.");
    if (d.client.dac) out.push("Droit au compte : services bancaires de base, ni découvert ni chéquier, carte à autorisation systématique.");
    if (d.controle) out.push("Un compte sous contrôle (SC) n'est pas un compte débiteur : on paie, le conseiller surveille les mouvements.");
    if (d.position.debiteurDepuis) out.push("Un compte déjà à l'état des débiteurs depuis " + Q.pl(d.position.debiteurDepuis, "jour", "jours") + " : on ne creuse pas le débit.");
    if (d.opportunite.type) out.push("Opportunité détectée : " + R.libelleOpportunite(d.opportunite.type).toLowerCase() + ".");
    if (out.length < 2) out.push("Revenus de " + eur(d.client.revenus) + ", note " + d.note + " : la note et l'historique des rejets guident la décision.");
    return out.slice(0, 4);
  }

  function fabriquer(graine, k) {
    var S = D.SC[k], essai, dernier = "";
    for (essai = 0; essai < 80; essai++) {
      var g = graine + "|" + k + "|" + essai, r = Q.rng(g);
      var pf = D.profil(r, S.prof); if (!pf) { dernier = "profil"; continue; }
      var sk = S.tirer(r, pf); if (!sk) { dernier = "tirage"; continue; }
      var a = assembler(r, pf, sk, k); if (!a) { dernier = "assemblage"; continue; }
      var pol = T.politique(a.d);
      if (!S.exige(pol, a.d)) { dernier = "intention"; continue; }
      var rel;
      try { rel = REL.construire(g, a.d, a.plan); } catch (e) { dernier = e.message; continue; }
      var m = mesures(a.d, rel);
      if (sk.opp === "libre" && false) continue;
      finir(r, a.d, sk, pol, rel, pf);
      if (a.d.note === "A" || a.d.note === "B") { /* dossier sain */ }
      return { dossier: a.d, releve: rel, scenario: k, essais: essai + 1 };
    }
    throw new Error("scénario impossible : " + k + " (" + dernier + ")");
  }

  var api = { fabriquer: fabriquer, mesures: mesures };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.quotidienDebAsm = api; }
})(typeof window !== "undefined" ? window : null);
