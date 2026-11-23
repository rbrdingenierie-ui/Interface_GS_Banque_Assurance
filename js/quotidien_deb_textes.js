/* GS Banque & Assurance – dossiers « du jour » (opérations débiteurs) : décisions attendues et textes de correction.
   La décision attendue pour chaque opération est calculée par la politique de l'exercice (ci-dessous), reproduite à l'identique sur les 30 dossiers rédigés à la main ;
   les textes citent uniquement des chiffres du dossier. Fonctions pures. */
(function (root) {
  "use strict";

  var Q = root && root.SGBF && root.SGBF.quotidienBase ? root.SGBF.quotidienBase : require("./quotidien_base.js");
  var R = root && root.SGBF && root.SGBF.rules ? root.SGBF.rules : require("./rules.js");
  var eur = Q.eur, eur2 = Q.eur2;

  var TYPE = { carte: "paiement par carte", cheque: "chèque", prelevement: "prélèvement" };

  /* Nombre de rejets de moins de 6 mois. */
  function rejetsRecents(d) { return d.antecedents.filter(function (a) { return a.joursAvant < 180; }).length; }
  function estSain(d) { return d.note === "A" || d.note === "B"; }

  /* Politique de l'exercice, appliquée dans l'ordre de présentation des opérations.
     - carte et chèque de 15 € ou moins : on paie (non rejetables) ;
     - si le paiement laisse le compte hors de l'état des débiteurs : on paie ;
     - sinon (dépassement dep) : tolérance si le client est sain (note A ou B, au plus un rejet de moins de 6 mois) et qu'un crédit certain
       d'au moins dep arrive sous 14 jours, ou s'il est en offre clientèle fragile avec un crédit couvrant dep sous 7 jours ; sinon rejet.
     - le choix contraire est « défendable » : rejet quand le délai dépasse 7 jours (client sain) et que les frais de rejet restent proportionnés
       (au plus la moitié du montant) ; paiement quand le client est sain, avec un seul rejet récent au plus, un crédit couvrant dep et un délai de 15 à 21 jours. */
  function politique(d) {
    var aut = d.position.autorisation, cr = d.position.creditAttendu, solde = d.position.solde, sain = estSain(d), rec = rejetsRecents(d), out = [];
    d.operations.forEach(function (o) {
      var avant = solde, st = { id: o.id, avant: avant, att: "payer", acc: null, tol: false, cas: "", dep: 0, apres: 0, delai: cr ? cr.dansJours : null, couvre: false };
      var apres = R.arrondi(avant - o.montant), e = R.etat(apres, aut), fr = R.fraisRejetClient(d, o), prop = fr <= 0.5 * o.montant;
      st.apres = apres; st.dep = e.depassement;
      if (R.estNonRejetable(o)) {
        st.cas = o.type === "carte" ? "carte" : "chq15"; solde = apres;
      } else if (e.code !== "etat_debiteurs") {
        st.cas = "ok"; solde = apres;
      } else {
        var delai = cr ? cr.dansJours : 999, cov = !!cr && cr.montant >= e.depassement;
        st.couvre = cov;
        if (sain && rec <= 1 && cov && delai <= 14) { st.cas = "tol"; st.tol = true; if (delai > 7 && prop) st.acc = "rejeter"; solde = apres; }
        else if (d.client.fragile && cov && delai <= 7) { st.cas = "tol"; st.tol = true; if (prop) st.acc = "rejeter"; solde = apres; }
        else { st.cas = "rej"; st.att = "rejeter"; if (sain && rec <= 1 && cov && delai >= 15 && delai <= 21) st.acc = "payer"; }
      }
      st.apresDecision = solde;
      out.push(st);
    });
    return out;
  }

  /* ---------- briques de texte ---------- */
  function rejetsTxt(n) { return n === 0 ? "aucun rejet sur 12 mois" : n === 1 ? "un seul rejet sur 12 mois" : n + " rejets sur 12 mois"; }
  function delaiTxt(n) { return n === 1 ? "demain" : "dans " + n + " jours"; }
  function nomType(o) { return o.type === "cheque" ? "chèque" : o.type === "prelevement" ? "prélèvement" : "paiement"; }
  function leType(o) { return o.type === "cheque" ? "Le chèque" : o.type === "prelevement" ? "Le prélèvement" : "Le paiement"; }
  function autTxt(aut) { return aut > 0 ? "pour " + eur(aut) + " d'autorisation" : "sans autorisation"; }
  function creditNom(cr) { return /^Salaire/.test(cr.libelle) ? "salaire" : /^Pension/.test(cr.libelle) ? "pension" : /^Allocation/.test(cr.libelle) ? "allocation" : /^Rémun/.test(cr.libelle) ? "rémunération" : cr.libelle.toLowerCase(); }
  function attendu(cr) { return creditNom(cr) + (/^(pension|allocation|rémunération)/.test(creditNom(cr)) ? " attendue" : " attendu"); }
  function fraisCourt(d, o) {
    var f = R.fraisRejetClient(d, o);
    /* un chèque rejeté : frais définis (30 € pour 50 € ou moins, 50 € au-dessus) ; autres cas : plafond */
    return "frais de rejet de " + (o.type === "prelevement" && o.montant <= 20 && !d.client.fragile ? eur2(o.montant) : eur(f)) + (o.type === "cheque" && !d.client.fragile ? "" : " au maximum");
  }
  function fraisTxt(d, o) {
    var f = R.fraisRejetClient(d, o);
    if (o.type === "cheque") {
      var base = o.montant <= 50 ? "chèque de 50 € ou moins" : "chèque de plus de 50 €";
      if (d.client.fragile) return "Frais de rejet : " + eur(f) + " au maximum (plafond de l'offre clientèle fragile).";
      return "Frais de rejet : " + eur(f) + " (" + base + ").";
    }
    if (o.type === "prelevement") {
      if (d.client.fragile) return "Frais de rejet : " + eur(f) + " au maximum (plafond de l'offre clientèle fragile).";
      if (o.montant <= 20) return "Frais de rejet : " + eur2(o.montant) + " seulement : pour un prélèvement de 20 € ou moins, les frais ne dépassent jamais le montant rejeté (art. D133-6 du CMF).";
      return "Frais de rejet : 20 € au maximum, le prélèvement étant supérieur à 20 € (art. D133-6 du CMF).";
    }
    return "";
  }
  function commissionTxt(d) {
    return d.client.fragile
      ? "Client titulaire de l'offre clientèle fragile (OCF) : la commission d'intervention est de 4 € par opération et l'ensemble des frais d'incidents est plafonné à 20 € par mois, que l'on paie ou que l'on rejette."
      : "Ce paiement en irrégularité donne lieu à une commission d'intervention de 8 € (80 € par mois au maximum).";
  }
  function pourquoiRejet(d, st) {
    var cr = d.position.creditAttendu, n = d.antecedents.length, p = [];
    p.push("note " + d.note);
    if (n) p.push(rejetsTxt(n)); else if (!estSain(d)) p.push("aucun rejet mais une situation à surveiller");
    if (d.client.ficp) p.push("client fiché FICP");
    if (!cr) p.push("aucun crédit attendu");
    else if (cr.montant < st.dep) p.push("un " + creditNom(cr) + " de " + eur(cr.montant) + " qui ne couvrirait pas le dépassement de " + eur(st.dep));
    else if (cr.dansJours > 14) p.push(attendu(cr) + " seulement " + delaiTxt(cr.dansJours));
    else p.push(attendu(cr) + " " + delaiTxt(cr.dansJours));
    return p.join(", ");
  }

  /* Explication d'une opération (st = résultat de la politique pour cette opération). */
  function expliquer(d, o, st, ix) {
    var aut = d.position.autorisation, cr = d.position.creditAttendu, t = "", precedent = ix > 0, deb = st.apres < 0 && R.etat(st.apres, aut).code === "etat_debiteurs";
    var avantDeb = R.etat(st.avant, aut).code === "etat_debiteurs";
    if (st.cas === "carte") {
      if (st.apres >= 0) t = "Une opération par carte se valide toujours. Le solde passe de " + eur(st.avant) + " à " + eur(st.apres) + ".";
      else if (!deb) t = "Une opération par carte se valide toujours : l'ordre de paiement est irrévocable. Le solde passe à " + eur(st.apres) + ", dans l'autorisation de " + eur(aut) + " : ce n'est pas l'état des débiteurs.";
      else t = "L'ordre de paiement par carte est irrévocable (art. L133-8 du Code monétaire et financier) : on valide, même si le compte passe à " + eur(st.apres) + " et à l'état des débiteurs" + (aut > 0 ? " (dépassement de " + eur(st.dep) + " au-delà de l'autorisation)" : "") + ".";
    } else if (st.cas === "chq15") {
      if (o.montant === 15) t = "Chèque de 15,00 € exactement : le seuil de 15 € est atteint, le chèque ne peut pas être refusé. Il est débité et le compte passe à " + eur2(st.apres) + (deb && aut === 0 ? ", sans autorisation" : "") + ".";
      else if (deb || st.apres < 0) t = "Un chèque sans provision de 15 € ou moins ne peut pas être refusé" + (avantDeb ? ", même sur un compte déjà à l'état des débiteurs" : "") + " : il est débité (le compte passe à " + eur2(st.apres) + ") et donne lieu à des intérêts débiteurs.";
      else t = "Un chèque de 15 € ou moins ne peut pas être refusé. Ici, la provision suffit : le solde passe à " + eur2(st.apres) + ".";
    } else if (st.cas === "ok") {
      if (st.apres >= 0) t = (o.type === "prelevement" ? "Provision suffisante : il reste " + eur2(st.apres) + " après le prélèvement." : "Provision suffisante : le solde passe à " + eur2(st.apres) + " après le chèque.");
      else t = leType(o) + " fait passer le solde à " + eur2(st.apres) + " : le compte est débiteur, mais dans l'autorisation de " + eur(aut) + ". Ce n'est pas l'état des débiteurs : on paie.";
    } else if (st.cas === "tol") {
      t = (avantDeb ? "Le compte est déjà à l'état des débiteurs : " : "") + "Le solde " + (avantDeb ? "passerait" : "passerait") + " à " + eur2(st.apres) + " " + autTxt(aut) + (st.dep ? ", soit un dépassement de " + eur(st.dep) : "") + ". " +
        (d.client.fragile ? "" : "Note " + d.note + ", " + rejetsTxt(d.antecedents.length) + " et ") + (d.client.fragile ? "" : "") + creditNom(cr) + " de " + eur(cr.montant) + " " + delaiTxt(cr.dansJours) + " qui couvre le dépassement : on tolère ce passage. " + commissionTxt(d);
      if (st.acc === "rejeter") t += " Le rejet reste défendable (" + fraisCourt(d, o) + ").";
    } else {
      t = (avantDeb ? "Compte déjà à l'état des débiteurs" + (d.position.debiteurDepuis ? " depuis " + Q.pl(d.position.debiteurDepuis, "jour", "jours") : "") + ". " : "") +
        "Le solde passerait à " + eur2(st.apres) + " " + autTxt(aut) + ", soit un dépassement de " + eur(st.dep) + ". " + Q.maj1(pourquoiRejet(d, st)) + " : on rejette" +
        (st.acc === "payer" ? ". Payer reste défendable (note " + d.note + ", " + rejetsTxt(d.antecedents.length) + ", " + creditNom(cr) + " de " + eur(cr.montant) + " " + delaiTxt(cr.dansJours) + ")" : "") +
        ". " + (o.type === "cheque" ? "Le chèque dépasse 15 € : il peut être refusé. " : "") + fraisTxt(d, o);
    }
    return t.replace(/\s+/g, " ").replace(/ \./g, ".").replace(/\.\./g, ".").trim();
  }

  var api = { attendu: attendu, fraisCourt: fraisCourt, politique: politique, expliquer: expliquer, rejetsRecents: rejetsRecents, estSain: estSain, rejetsTxt: rejetsTxt, delaiTxt: delaiTxt, creditNom: creditNom, fraisTxt: fraisTxt, commissionTxt: commissionTxt, autTxt: autTxt, TYPE: TYPE };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.quotidienDebTextes = api; }
})(typeof window !== "undefined" ? window : null);
