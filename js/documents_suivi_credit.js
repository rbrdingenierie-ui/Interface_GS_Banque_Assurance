/* GS Banque & Assurance – lettre de proposition remise au client pour le suivi d'un crédit en cours : remboursement anticipé, renégociation du taux, rachat d'un prêt, regroupement de crédits,
   modulation ou report de mensualités. Ce module ne fabrique que le texte (HTML) : l'impression se fait avec impression.js. Chaque document est { id, titre, sous, fichier, courrier, lettre, corps }.
   Les chiffres et les règles viennent de suivi_credit.js (calcul enregistré avec le dossier) ; les points réservés au conseiller (épargne du client, taux d'endettement) n'y figurent pas.
   La lettre est une simulation : elle ne remplace ni l'avenant, ni l'offre de prêt, ni le décompte établi par le service de gestion des crédits. Fonctions pures, testées avec Node. */
(function (root) {
  "use strict";

  var D = (root && root.SGBF && root.SGBF.documents) || require("./documents.js");
  var B = (root && root.SGBF && root.SGBF.banque) || require("./banque.js");
  var S = (root && root.SGBF && root.SGBF.suiviCredit) || require("./suivi_credit.js");
  var P = (root && root.SGBF && root.SGBF.pret) || require("./pret.js");

  var e = D.esc;
  function ymd(t) { return B.lireYmd(t); }
  function dl(t) { return D.dateLongue(ymd(t)); }
  function eur(x) { return D.montant(x); }
  function nomComplet(p) { return p.civ + " " + p.prenom + " " + String(p.nom).toUpperCase(); }
  function feminin(p) { return p.civ === "Mme" || p.civ === "Mlle"; }
  function appel(p) { return feminin(p) ? "Madame" : "Monsieur"; }
  function personne(c) { return { civ: c.civ, prenom: c.prenom, nom: c.nom, rue: c.adr ? c.adr.rue : "", cp: c.adr ? c.adr.cp : "", ville: c.adr ? c.adr.ville : "" }; }
  function pct(n) { return P.pctTaux(n); }
  function duree(n) { return P.libDuree(n); }

  var TITRES = {
    remboursement: "Décompte et simulation de remboursement anticipé",
    renegociation: "Proposition de renégociation du taux de votre prêt",
    rachat: "Proposition de rachat de votre prêt immobilier",
    regroupement: "Proposition de regroupement de vos crédits",
    modulation: "Proposition de modulation de la mensualité de votre prêt",
    report: "Proposition de report de mensualités de votre prêt"
  };
  var OBJETS = {
    remboursement: "simulation de remboursement anticipé de votre crédit",
    renegociation: "proposition de renégociation du taux de votre prêt immobilier",
    rachat: "proposition de rachat de votre prêt immobilier détenu dans une autre banque",
    regroupement: "proposition de regroupement de vos crédits",
    modulation: "proposition de modulation de la mensualité de votre prêt immobilier",
    report: "proposition de report de mensualités de votre prêt immobilier"
  };
  function intro(r) {
    if (r.op === "remboursement") return "Suite à votre demande, nous avons chiffré " + (r.mode === "total" ? "le remboursement total" : "le remboursement partiel, à hauteur de " + e(eur(r.montant)) + ",") + " de votre crédit. Les chiffres ci-dessous sont calculés à la date de ce courrier.";
    if (r.op === "renegociation") return "Suite à votre demande, nous vous proposons de baisser le taux de votre prêt immobilier de " + e(pct(r.avant.taux)) + " à " + e(pct(r.nouveauTaux)) + ", par avenant à votre contrat de prêt.";
    if (r.op === "rachat") return "Suite à votre demande, nous avons étudié la reprise par GS Banque & Assurance de votre prêt immobilier, aujourd'hui détenu par un autre établissement, aux conditions du moment.";
    if (r.op === "regroupement") return "Suite à votre demande, nous avons étudié le regroupement de vos crédits en un seul prêt, avec une seule mensualité.";
    if (r.op === "modulation") return "Suite à votre demande, nous avons chiffré la " + (r.variation > 0 ? "hausse" : "baisse") + " de " + e(String(Math.abs(r.variation)).replace(".", ",")) + " % de la mensualité de votre prêt immobilier, prévue par la clause de modulation de votre contrat.";
    return "Suite à votre demande, nous avons chiffré le report de " + e(String(r.mois)) + " mensualité" + (r.mois > 1 ? "s" : "") + " de votre prêt immobilier, prévu par la clause de report de votre contrat.";
  }
  /* Tableau avant / après. */
  function tableau(r) {
    var av = r.avant, ap = r.apres, total = r.op === "remboursement" && r.mode === "total", L = [];
    var neuf = r.op === "rachat" || r.op === "regroupement";
    L.push([neuf ? (r.op === "rachat" ? "Capital restant dû à l'ancienne banque / capital du nouveau prêt" : "Capital restant dû des crédits regroupés / capital du nouveau prêt") : "Capital restant dû", e(eur(av.capital)), e(eur(ap.capital))]);
    if (av.taux !== null && av.taux !== undefined) L.push(["Taux nominal annuel", e(pct(av.taux)), total ? "–" : e(pct(ap.taux))]);
    else L.push(["Taux nominal annuel", "selon chaque crédit", e(pct(ap.taux))]);
    L.push(["Mensualité, assurance non comprise", e(eur(av.mensualite)), total ? "–" : e(eur(ap.mensualite))]);
    if (!neuf && av.assurance) L.push(["Cotisation d'assurance emprunteur par mois", e(eur(av.assurance)), total ? "prend fin" : e(eur(ap.assurance))]);
    L.push(["Durée restante", e(duree(av.reste)), total ? "–" : e(duree(ap.reste))]);
    L.push(["Dernière échéance", e(dl(av.fin)), total ? "–" : e(dl(ap.fin))]);
    L.push(["Intérêts restant à payer", e(eur(av.interets)), total ? e(eur(0)) : e(eur(ap.interets))]);
    if (!neuf && av.coutAssurance) L.push(["Assurance emprunteur restant à payer", e(eur(av.coutAssurance)), e(eur(ap.coutAssurance))]);
    return D.tableau(["", "Aujourd'hui", "Après l'opération"], L);
  }
  function couts(r) {
    if (!r.frais.length) return "<p>Cette opération n'entraîne aucun frais.</p>";
    return D.tableau(["Coût de l'opération", "Montant"], r.frais.map(function (f) { return [e(f.lib), e(eur(f.montant))]; }).concat([["<strong>Total</strong>", "<strong>" + e(eur(r.totalFrais)) + "</strong>"]]));
  }
  function bilan(r) {
    var g = r.gain;
    if (r.op === "regroupement") return g >= 0 ? "Sur la durée restante, le regroupement vous fait économiser " + eur(g) + ", frais de l'opération compris." : "Sur la durée restante, le regroupement vous coûte " + eur(-g) + " de plus que de conserver vos crédits actuels, frais de l'opération compris, même si votre mensualité totale baisse.";
    if (r.op === "modulation" || r.op === "report") return g >= 0 ? "Sur la durée restante, cette modification réduit le coût de votre prêt de " + eur(g) + " (intérêts et assurance emprunteur)." : "Sur la durée restante, cette modification augmente le coût de votre prêt de " + eur(-g) + " (intérêts et assurance emprunteur).";
    return g > 0 ? "Sur la durée restante, l'opération vous fait économiser " + eur(g) + ", frais déduits." : "Sur la durée restante, l'opération ne vous fait pas économiser d'argent : le bilan est de " + eur(g) + ", frais déduits.";
  }
  /* Coupon-réponse en bas de lettre : seul le client y signe (la banque a signé au-dessus, avec le tampon de l'agence). */
  function reponse() {
    return '<h3>Votre réponse</h3><p>Cette proposition ne vous engage pas tant que vous ne l\'avez pas acceptée par écrit. Vous pouvez nous retourner ce courrier daté et signé, en rayant la mention inutile.</p>' +
      D.signatures([{ titre: "Le client", mention: "Je souhaite donner suite à cette proposition – Je renonce (rayer la mention inutile)", legende: "Date et signature du client" }]);
  }

  function proposition(c, s, redevable) {
    var r = s.calcul, p = redevable || personne(c), date = ymd(s.date), x = r.credits.map(function (k) { return c.cre[k]; }).filter(Boolean);
    var libCredit = x.map(function (z) { return S.situation(z).nom + " de " + D.montant(z.cap) + " du " + D.dateCourte(B.dateJours(z.ouvert)) + (z.ext ? " (" + z.ext + ")" : ""); }).join(" ; ");
    var points = (r.alertes || []).filter(function (a) { return !a.interne; }).map(function (a) { return e(a.t); });
    var corps = '<div class="dp-lettre dp-suivi">' +
      '<div class="dp-lettre-dest"><p><strong>' + e(nomComplet(p)) + "</strong><br>" + e(p.rue || "") + "<br>" + e((p.cp ? p.cp + " " : "") + (p.ville || "")) + "</p></div>" +
      '<p class="dp-lettre-envoi"><strong>Remis en agence</strong></p>' +
      '<p class="dp-lettre-refs"><strong>Références :</strong> ' + e("Dossier " + s.ref + " – " + libCredit) + "</p>" +
      '<p class="dp-lettre-date">Paris, le ' + e(D.dateLongue(date)) + "</p>" +
      '<p class="dp-lettre-objet"><strong>Objet :</strong> ' + e(OBJETS[r.op]) + "</p>" +
      "<p>" + appel(p) + ",</p><p>" + intro(r) + "</p>" +
      "<h3>Votre situation avant et après l'opération</h3>" + tableau(r) +
      "<h3>Les coûts de l'opération</h3>" + couts(r) +
      "<h3>Ce que cela représente pour vous</h3><p><strong>" + e(bilan(r)) + "</strong></p>" +
      "<h3>Les règles qui s'appliquent</h3>" + D.liste(r.regles.map(e)) +
      (points.length ? "<h3>Les points à connaître</h3>" + D.liste(points) : "") +
      "<p>Cette proposition est une simulation établie d'après les informations dont nous disposons aujourd'hui. Elle ne remplace ni l'avenant à votre contrat, ni l'offre de prêt, ni le décompte établi par notre service de gestion des crédits, qui font foi.</p>" +
      "<p>Veuillez agréer, " + appel(p) + ", l'expression de nos salutations distinguées.</p>" + D.signatureBanque(null, date) + reponse() + "</div>";
    return { id: "suivi_" + r.op, titre: TITRES[r.op], sous: String(p.nom).toUpperCase() + " " + p.prenom + " – dossier " + s.ref + " – " + D.dateCourte(date),
      fichier: D.fichier("Suivi_credit_" + r.op, { nom: p.nom, prenom: p.prenom }, date), courrier: false, lettre: true, corps: corps };
  }

  var api = { personne: personne, proposition: proposition, TITRES: TITRES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.documentsSuiviCredit = api; }
})(typeof window !== "undefined" ? window : null);
