/* GS Banque & Assurance – page « Suivi d'un crédit en cours » : choisir un client qui a un crédit, formuler la demande (remboursement anticipé, renégociation du taux, rachat d'un prêt détenu ailleurs,
   regroupement de crédits, modulation ou report de mensualités), lire le calcul (avant/après, coûts, règles, repères), enregistrer la proposition remise au client, l'imprimer, puis noter sa réponse.
   Les règles sont dans suivi_credit.js, la lettre dans documents_suivi_credit.js. Adresse : suivi_credit.html?client=<id> ouvre la page pour un client (depuis sa fiche). */
(function () {
  "use strict";

  var SG = window.SGBF, B = SG.banque, CL = SG.clients, S = SG.suiviCredit, DS = SG.documentsSuiviCredit, P = SG.pret, IMP = SG.impression, ICO = SG.icones, RECH = SG.recherche, app = document.getElementById("app");
  var esc = B.esc;
  var CLIENT = {}; CL.forEach(function (c) { CLIENT[c.id] = c; });
  var params = new URLSearchParams(location.search);
  var VIDE = { op: "", k: "", mode: "partiel", montant: "", effet: "", motif: "", deja: "", taux: "", duree: "", variation: "", mois: "", credits: [] };
  var etat = { cid: CLIENT[parseInt(params.get("client"), 10)] ? parseInt(params.get("client"), 10) : 0, f: Object.assign({}, VIDE, { credits: [] }), apercu: null, verif: false, err: null, fait: null, dec: null, decVerif: false, decErr: "" };
  var DESC = {
    remboursement: "Le client rembourse tout ou une partie du capital restant dû avant la fin du contrat : indemnité éventuelle, économie d'intérêts.",
    renegociation: "Le client demande à GS de baisser le taux de son prêt immobilier, par avenant : frais d'avenant, économie, repères du métier.",
    rachat: "Le client veut transférer à GS un prêt immobilier détenu dans une autre banque : indemnité de l'ancienne banque, frais, économie.",
    regroupement: "Le client veut remplacer plusieurs crédits par un seul, avec une seule mensualité : qualification (règle des 60 %), coût total.",
    modulation: "Le client veut augmenter ou baisser la mensualité de son prêt immobilier, dans la limite de la clause du contrat.",
    report: "Le client veut suspendre le paiement de quelques mensualités de son prêt immobilier ; les intérêts continuent de courir."
  };

  var FACULTATIFS = ["motif", "deja", "duree"];                     /* champs que l'on peut laisser vides */
  function st() { return B.store.charger(); }
  function client() { return etat.cid ? CLIENT[etat.cid] : null; }
  function nomComplet(c) { return c.civ + " " + c.prenom + " " + c.nom.toUpperCase(); }
  function dateLongue(ymd) { var d = B.lireYmd(ymd); return d ? d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : ""; }
  function eur(n) { return B.eur2(n); }
  function pct(n) { return P.pctTaux(n); }
  function pl(n, s, p) { return n + " " + (n > 1 ? p : s); }
  function liens(c) { return '<a class="btn btn-secondaire sc-lien" href="client.html?id=' + c.id + '">Fiche client</a>'; }
  function avecCredit(c) { return c.cre && c.cre.some(function (x) { return S.situation(x).reste > 0; }); }
  function libCredit(s) { return s.nom + (s.ext ? " – " + s.ext : "") + " de " + eur(s.x.cap) + " (capital restant dû " + eur(s.crd) + ")"; }

  /* ---------- déroulé et bilan ---------- */
  function deroule() {
    var e = [
      ["Le client et son crédit", "On choisit un client qui a un crédit en cours : le tableau montre, pour chaque crédit, le capital restant dû, la mensualité et la fin prévue (autres banques comprises)."],
      ["La demande", "Remboursement anticipé, renégociation du taux, rachat d'un prêt détenu ailleurs, regroupement de crédits, modulation ou report de mensualités."],
      ["Le calcul", "Situation avant et après, coûts de l'opération, règles appliquées avec leur source, repères du métier et points d'attention."],
      ["La proposition", "Lettre à remettre au client, puis sa réponse : acceptée ou abandonnée. Un crédit qui a une proposition en cours ne reçoit pas une deuxième simulation."]
    ];
    return '<ol class="op-deroule regul-deroule" aria-label="Déroulé du suivi d\'un crédit">' + e.map(function (x, i) {
      return '<li><span class="op-deroule-num" aria-hidden="true">' + (i + 1) + '</span><span class="op-deroule-txt"><strong>' + esc(x[0]) + "</strong><span>" + esc(x[1]) + "</span></span></li>";
    }).join("") + "</ol>";
  }
  function bilan(l) {
    function n(code) { return l.filter(function (s) { return S.etat(s).code === code; }).length; }
    var d = [["Propositions en attente", n("propose"), "sc-b-warn"], ["Acceptées par le client", n("accepte"), "sc-b-ok"], ["Abandonnées par le client", n("renonce"), "sc-b-nul"]];
    return '<dl class="sc-bilan" aria-label="Bilan des propositions">' + d.map(function (x) { return '<div class="sc-b ' + x[2] + '"><dt>' + esc(x[0]) + "</dt><dd>" + x[1] + "</dd></div>"; }).join("") + "</dl>";
  }

  /* ---------- client et crédits ---------- */
  function err(champ) { return etat.err && etat.err.some(function (e) { return e.champ === champ || (champ === "k" && e.champ === "credit"); }); }
  function champ(id, lib, corps, aide, pleine) {
    var e = err(id);
    return '<div class="champ' + (pleine ? " sc-pleine" : "") + '"><label for="sc-' + id + '">' + esc(lib) + (FACULTATIFS.indexOf(id) >= 0 ? "" : " *") + "</label>" + corps.replace("<>", ' id="sc-' + id + '"' + (e ? ' aria-invalid="true" aria-describedby="sc-err' + (aide ? " sc-aide-" + id : "") + '"' : aide ? ' aria-describedby="sc-aide-' + id + '"' : "")) + (aide ? '<span class="aide-champ" id="sc-aide-' + id + '">' + esc(aide) + "</span>" : "") + "</div>";
  }
  function selecteurClient() {
    var l = CL.filter(avecCredit).sort(function (a, b) { var x = a.nom + " " + a.prenom, y = b.nom + " " + b.prenom; return x < y ? -1 : x > y ? 1 : 0; });
    return '<div class="champ"><label for="sc-client">Client *</label><select id="sc-client"' + (err("client") ? ' aria-invalid="true" aria-describedby="sc-err"' : "") + '><option value="">Choisir un client</option>' + l.map(function (c) {
      return '<option value="' + c.id + '"' + (etat.cid === c.id ? " selected" : "") + ">" + esc(c.nom.toUpperCase() + " " + c.prenom + " – " + c.age + " ans") + "</option>";
    }).join("") + '</select><span class="aide-champ">Seuls les clients qui ont un crédit en cours sont proposés (' + l.length + ").</span></div>";
  }
  function tableauCredits(c) {
    var sit = S.situations(c, B.aujourdhui());
    return '<div class="sc-table-zone" role="region" aria-label="Crédits du client" tabindex="0"><table class="sc-table"><caption class="sr">Crédits en cours du client</caption><thead><tr><th scope="col">Crédit</th><th scope="col">Ouvert le</th><th scope="col">Capital emprunté</th><th scope="col">Taux</th><th scope="col">Mensualité (assurance)</th><th scope="col">Échéances payées</th><th scope="col">Capital restant dû</th><th scope="col">Dernière échéance</th></tr></thead><tbody>' +
      sit.map(function (s) {
        var v = S.verrou(st(), c.id, s.k), x = s.x;
        return "<tr><th scope=\"row\">" + esc(s.nom) + "<br><span class=\"sc-sous\">" + (s.ext ? "Détenu par " + esc(s.ext) + " (déclaré par le client)" : "Prêt GS") + "</span>" + (s.reste < 1 ? ' <span class="chip chip-ctrl">Soldé</span>' : "") + (v ? ' <span class="chip ' + (v.statut === "accepte" ? "chip-ok" : "chip-warn") + '">Dossier ' + esc(v.ref) + "</span>" : "") + "</th><td>" + esc(B.fmtDate(B.dateOuvrable(x.ouvert))) + "</td><td>" + esc(eur(x.cap)) + "</td><td>" + esc(pct(x.taux)) + "</td><td>" + esc(eur(x.mens)) + (s.assM ? "<br><span class=\"sc-sous\">+ " + esc(eur(s.assM)) + "</span>" : "") + "</td><td>" + s.payees + " sur " + x.dur + "</td><td>" + esc(eur(s.crd)) + "</td><td>" + esc(B.fmtDate(B.lireYmd(s.fin))) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }
  function infoClient(c) {
    var d = S.endettement(c, [], 0, B.aujourdhui());
    return '<div class="sc-info-client"><p><strong>' + esc(nomComplet(c)) + "</strong> – client " + esc(c.num) + " – " + esc(c.pro.prof) + "</p><p>Revenus du foyer : " + esc(eur(d.foyer)) + " par mois ; mensualités de crédit, assurance comprise : " + esc(eur(d.avant)) + " par mois, soit un taux d'endettement de " + esc(d.tauxAvant === null ? "non calculable" : pct(Math.round(d.tauxAvant * 10) / 10)) + ".</p></div>" + tableauCredits(c);
  }

  /* ---------- formulaire de la demande ---------- */
  function eligibles(c, op) {
    return S.situations(c, B.aujourdhui()).filter(function (s) {
      if (s.reste < 1) return false;
      if (op === "remboursement") return !s.ext;
      if (op === "renegociation" || op === "modulation" || op === "report") return !s.ext && s.immo;
      if (op === "rachat") return s.ext && s.immo;
      return true;
    });
  }
  function optionsCredits(liste, v) {
    return '<option value="">Choisir le crédit</option>' + liste.map(function (s) { var l = S.verrou(st(), etat.cid, s.k); return '<option value="' + s.k + '"' + (String(v) === String(s.k) ? " selected" : "") + (l ? " disabled" : "") + ">" + esc(libCredit(s) + (l ? " – dossier " + l.ref + " en cours" : "")) + "</option>"; }).join("");
  }
  function opt(liste, v, vide) { return (vide ? '<option value="">' + esc(vide) + "</option>" : "") + liste.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (v === x[0] ? " selected" : "") + ">" + esc(x[1]) + "</option>"; }).join(""); }
  function radios(nom, valeurs, v) {
    return '<div class="sc-radios" role="radiogroup" aria-labelledby="sc-l-' + nom + '">' + valeurs.map(function (x, i) { return '<label class="op-case"><input type="radio" name="sc-' + nom + '" value="' + esc(x[0]) + '"' + (v === x[0] ? " checked" : "") + '><span>' + esc(x[1]) + "</span></label>"; }).join("") + "</div>";
  }
  function champRadio(nom, lib, valeurs, v, aide) {
    return '<div class="champ sc-pleine" id="sc-' + nom + '"><span class="sc-lib" id="sc-l-' + nom + '">' + esc(lib) + " *</span>" + radios(nom, valeurs, v) + (aide ? '<span class="aide-champ">' + esc(aide) + "</span>" : "") + "</div>";
  }
  function champsOperation(c) {
    var f = etat.f, h = "", liste = f.op ? eligibles(c, f.op) : [];
    if (!f.op) return "";
    if (!liste.length) return '<p class="sc-vide sc-pleine" role="status">Aucun crédit de ce client ne permet cette opération : ' + esc({ remboursement: "il faut un crédit de GS qui n'est pas soldé.", renegociation: "il faut un prêt immobilier de GS qui n'est pas soldé.", rachat: "il faut un prêt immobilier détenu dans une autre banque.", regroupement: "il faut au moins deux crédits.", modulation: "il faut un prêt immobilier de GS.", report: "il faut un prêt immobilier de GS." }[f.op]) + "</p>";
    var x = f.k !== "" && c.cre[f.k] ? S.situation(c.cre[f.k]) : null;
    if (f.op === "regroupement") {
      h += '<fieldset class="champ sc-pleine sc-liste-cr"' + (err("credits") ? ' aria-invalid="true"' : "") + "><legend>Crédits à regrouper (au moins deux) *</legend>" + liste.map(function (s) {
        var v = S.verrou(st(), c.id, s.k);
        return '<label class="op-case"><input type="checkbox" name="sc-cr" value="' + s.k + '"' + (f.credits.indexOf(String(s.k)) >= 0 ? " checked" : "") + (v ? " disabled" : "") + "><span>" + esc(libCredit(s) + (v ? " – dossier " + v.ref + " en cours" : "")) + "</span></label>";
      }).join("") + "</fieldset>" + champ("duree", "Durée du nouveau prêt (mois)", '<input <> type="text" inputmode="numeric" autocomplete="off" maxlength="3" value="' + esc(f.duree) + '">', "Laissez vide pour reprendre la durée du crédit le plus long.");
      return h;
    }
    h += champ("k", "Crédit concerné", "<select <>>" + optionsCredits(liste, f.k) + "</select>", "", true);
    if (f.op === "remboursement") {
      h += champRadio("mode", "Remboursement", [["partiel", "Partiel : une partie du capital restant dû"], ["total", "Total : le crédit est soldé"]], f.mode);
      if (f.mode !== "total") h += champ("montant", "Montant remboursé (€)", '<input <> type="text" inputmode="decimal" autocomplete="off" maxlength="12" value="' + esc(f.montant) + '">', x && x.immo ? "Le contrat de GS refuse un remboursement partiel égal ou inférieur à 10 % du capital emprunté." : "Capital remboursé par anticipation.") +
        champRadio("effet", "Effet du remboursement partiel", [["duree", "Garder la mensualité : le crédit se termine plus tôt"], ["mensualite", "Garder la durée : la mensualité baisse"]], f.effet);
      if (x && x.immo) h += champ("motif", "Motif du remboursement", "<select <>>" + opt(S.EXONERATIONS, f.motif, "Aucun motif particulier (indemnité due)") + "</select>", "Aucune indemnité si le remboursement fait suite à la vente du logement pour l'une de ces raisons.", true);
      else if (x) h += champ("deja", "Déjà remboursé par anticipation sur les 12 derniers mois (€)", '<input <> type="text" inputmode="decimal" autocomplete="off" maxlength="12" value="' + esc(f.deja) + '">', "Laissez vide s'il n'y en a pas. Une indemnité n'est due que si le total dépasse " + eur(S.CONSO.seuil) + " sur douze mois.");
    } else if (f.op === "renegociation") {
      var gc = x ? S.tauxCatalogueImmo(x.reste) : null;
      h += champ("taux", "Nouveau taux nominal annuel (%)", '<input <> type="text" inputmode="decimal" autocomplete="off" maxlength="7" value="' + esc(f.taux) + '">', gc ? "Taux du catalogue pour la durée restante : " + pct(gc.taux) + "." : "Taux proposé au client.") +
        champRadio("effet", "Ce que devient le prêt", [["duree", "Garder la durée : la mensualité baisse"], ["mensualite", "Garder la mensualité : le prêt se termine plus tôt"]], f.effet);
    } else if (f.op === "rachat") {
      h += champ("duree", "Durée du nouveau prêt (mois)", '<input <> type="text" inputmode="numeric" autocomplete="off" maxlength="3" value="' + esc(f.duree) + '">', "Laissez vide pour reprendre la durée restante de l'ancien prêt" + (x ? " (" + P.libDuree(x.reste) + ")" : "") + ".");
    } else if (f.op === "modulation") {
      h += champ("variation", "Variation de la mensualité (%)", '<input <> type="text" inputmode="decimal" autocomplete="off" maxlength="6" value="' + esc(f.variation) + '">', "Entre −" + S.AMENAGEMENT.pctMax + " et +" + S.AMENAGEMENT.pctMax + " : par exemple 10 pour augmenter de 10 %, −10 pour baisser de 10 %.");
    } else if (f.op === "report") {
      h += champ("mois", "Nombre de mensualités à reporter", '<input <> type="text" inputmode="numeric" autocomplete="off" maxlength="2" value="' + esc(f.mois) + '">', "De 1 à " + S.AMENAGEMENT.reportMax + ".");
    }
    return h;
  }
  function messageErreur() {
    return '<div class="msg-erreur" id="sc-err" role="alert">' + (etat.err ? (etat.err.length > 1 ? "<ul>" + etat.err.map(function (e) { return "<li>" + esc(e.msg) + "</li>"; }).join("") + "</ul>" : esc(etat.err[0].msg)) : "") + "</div>";
  }
  function formulaire() {
    var c = client(), f = etat.f;
    if (c && f.op === "renegociation" && f.k !== "" && f.taux === "" && c.cre[f.k]) {
      var x0 = S.situation(c.cre[f.k]), g0 = S.tauxCatalogueImmo(x0.reste);
      if (g0 && g0.taux < x0.taux) f.taux = String(g0.taux).replace(".", ",");
    }
    var h = '<section class="bloc sc-panneau" id="sc-panneau" aria-labelledby="sc-t-form"><div class="bloc-tete"><h2 id="sc-t-form" tabindex="-1">Étudier la demande d\'un client</h2></div>' +
      '<p class="op-aide">Choisissez le client, puis l\'opération qu\'il demande. La date de l\'étude est celle d\'aujourd\'hui : ' + esc(dateLongue(B.ymd(B.aujourdhui()))) + ".</p>" +
      '<form class="formulaire op-form sc-form" id="sc-form" novalidate><div class="op-grille">' + selecteurClient() + "</div>" + (c ? infoClient(c) : "");
    if (c && !avecCredit(c)) h += '<p class="sc-vide" role="status">Ce client n\'a aucun crédit en cours : il n\'y a rien à suivre.</p>';
    else if (c) {
      h += '<div class="sc-grille">' + champ("op", "Opération demandée", "<select <>>" + opt(S.OPERATIONS, f.op, "Choisir l'opération") + "</select>", f.op ? DESC[f.op] : "Six opérations sont possibles selon le crédit.", true) + champsOperation(c) + "</div>" + messageErreur() +
        '<div class="sc-btns"><button type="submit" class="btn btn-principal">Calculer</button></div>';
    }
    h += "</form>" + (etat.apercu ? calcul() : "") + "</section>";
    return h;
  }

  /* ---------- calcul affiché avant l'enregistrement ---------- */
  function ligne(lib, a, b, d) { return "<tr><th scope=\"row\">" + esc(lib) + "</th><td>" + a + "</td><td>" + b + "</td><td>" + (d || "") + "</td></tr>"; }
  function delta(a, b, f, signe) { var d = b - a; if (Math.abs(d) < 0.005) return "inchangé"; return (d > 0 ? "+" : "−") + f(Math.abs(d)); }
  function comparaison(r) {
    var av = r.avant, ap = r.apres, total = r.op === "remboursement" && r.mode === "total", neuf = r.op === "rachat" || r.op === "regroupement", L = [];
    L.push(ligne(neuf ? "Capital (restant dû avant, nouveau prêt après)" : "Capital restant dû", esc(eur(av.capital)), esc(eur(ap.capital)), total ? "" : esc(delta(av.capital, ap.capital, eur))));
    L.push(ligne("Taux nominal annuel", av.taux === null || av.taux === undefined ? "selon chaque crédit" : esc(pct(av.taux)), total ? "–" : esc(pct(ap.taux)), av.taux !== null && av.taux !== undefined && !total && Math.abs(ap.taux - av.taux) > 1e-9 ? esc(delta(av.taux, ap.taux, function (x) { return pct(x); })) : ""));
    L.push(ligne("Mensualité (assurance non comprise)", esc(eur(av.mensualite)), total ? "–" : esc(eur(ap.mensualite)), total ? "" : esc(delta(av.mensualite, ap.mensualite, eur))));
    if (!neuf && av.assurance) L.push(ligne("Cotisation d'assurance emprunteur par mois", esc(eur(av.assurance)), total ? "prend fin" : esc(eur(ap.assurance)), ""));
    L.push(ligne("Durée restante", esc(P.libDuree(av.reste)), total ? "–" : esc(P.libDuree(ap.reste)), total ? "" : esc(delta(av.reste, ap.reste, function (x) { return pl(x, "mois", "mois"); }))));
    L.push(ligne("Dernière échéance", esc(dateLongue(av.fin)), total ? "–" : esc(dateLongue(ap.fin)), ""));
    L.push(ligne("Intérêts restant à payer", esc(eur(av.interets)), esc(eur(total ? 0 : ap.interets)), total ? "−" + esc(eur(av.interets)) : esc(delta(av.interets, ap.interets, eur))));
    if (!neuf && av.coutAssurance) L.push(ligne("Assurance emprunteur restant à payer", esc(eur(av.coutAssurance)), esc(eur(ap.coutAssurance)), esc(delta(av.coutAssurance, ap.coutAssurance, eur))));
    return '<div class="sc-table-zone" role="region" aria-label="Situation avant et après" tabindex="0"><table class="sc-table sc-comparaison"><caption class="sr">Situation du crédit avant et après l\'opération</caption><thead><tr><th scope="col"><span class="sr">Élément</span></th><th scope="col">Aujourd\'hui</th><th scope="col">Après l\'opération</th><th scope="col">Écart</th></tr></thead><tbody>' + L.join("") + "</tbody></table></div>";
  }
  function tableauFrais(r) {
    if (!r.frais.length) return "";
    return '<div class="sc-table-zone" role="region" aria-label="Coûts de l\'opération" tabindex="0"><table class="sc-table sc-frais"><caption class="sr">Coûts de l\'opération</caption><thead><tr><th scope="col">Coût de l\'opération</th><th scope="col">Montant</th></tr></thead><tbody>' +
      r.frais.map(function (f) { return "<tr><th scope=\"row\">" + esc(f.lib) + "</th><td>" + esc(eur(f.montant)) + "</td></tr>"; }).join("") + "</tbody><tfoot><tr><th scope=\"row\">Total</th><td>" + esc(eur(r.totalFrais)) + "</td></tr></tfoot></table></div>";
  }
  function puceVerdict(v) {
    var cl = { interessant: "chip-ok", a_etudier: "chip-warn", cout: "chip-warn", peu_interessant: "chip-bad" }[v.code] || "chip-ctrl";
    return '<span class="chip ' + cl + '">' + (v.code === "interessant" ? ICO.check : ICO.alerte) + esc({ interessant: "Intéressant", a_etudier: "À étudier", cout: "Coût à connaître", peu_interessant: "Peu intéressant" }[v.code] || "") + "</span>";
  }
  function calcul() {
    var r = etat.apercu, l = r.gain >= 0 ? "Économie nette" : "Surcoût";
    var h = '<div class="sc-calcul" id="sc-calcul"><h3 id="sc-t-calcul" tabindex="-1">' + esc(r.titre) + "</h3>" +
      '<p class="sc-verdict">' + puceVerdict(r.verdict) + " <span>" + esc(r.verdict.libelle) + "</span></p>" + comparaison(r) + tableauFrais(r) +
      '<dl class="sc-resultat"><div><dt>' + l + ' sur la durée restante</dt><dd><strong>' + esc(eur(Math.abs(r.gain))) + "</strong>" + (r.op === "remboursement" ? " – intérêts" + (r.assuranceEco ? " et assurance" : "") + " évités, moins l'indemnité" : r.op === "modulation" || r.op === "report" ? " – intérêts et assurance emprunteur" : " – intérêts évités, moins les coûts de l'opération") + "</dd></div>" +
      (r.pointMort ? "<div><dt>Coûts amortis en</dt><dd>" + esc(pl(r.pointMort, "mois", "mois")) + " d'économie de mensualité</dd></div>" : "") + "</dl>";
    if (r.reperes && r.reperes.length) h += '<h4 class="sc-h4">Repères du métier pour une renégociation</h4><ul class="sc-reperes">' + r.reperes.map(function (x) { return '<li><span class="chip ' + (x.ok ? "chip-ok" : "chip-warn") + '">' + (x.ok ? "Atteint" : "Non atteint") + "</span> <span><strong>" + esc(x.lib) + ".</strong> " + esc(x.detail) + "</span></li>"; }).join("") + "</ul>";
    h += '<h4 class="sc-h4">Règles appliquées</h4><ul class="sc-regles">' + r.regles.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>";
    h += r.alertes.map(function (a) { return '<p class="sc-alerte' + (a.n === "attention" ? "" : " sc-alerte-info") + '" role="status">' + (a.n === "attention" ? ICO.alerte : ICO.info) + "<span>" + esc(a.t) + "</span></p>"; }).join("");
    h += '<fieldset class="op-section sc-verif"' + (err("verif") ? ' aria-invalid="true"' : "") + '><legend>Vérification du conseiller *</legend><label class="op-case"><input type="checkbox" id="sc-verif"' + (etat.verif ? " checked" : "") + (err("verif") ? ' aria-describedby="sc-err"' : "") + "><span>J'ai vérifié avec le client les informations du ou des crédits (capital restant dû, taux, mensualité" + (r.op === "rachat" || r.op === "regroupement" ? ", décomptes des autres banques" : "") + ") et je lui ai expliqué le coût de l'opération.</span></label></fieldset>" +
      '<div class="sc-btns"><button type="button" class="btn btn-principal" data-act="enregistrer">Enregistrer la proposition</button><button type="button" class="btn btn-secondaire" data-act="modifier">Modifier la demande</button></div></div>';
    return h;
  }

  /* ---------- confirmation et liste des dossiers ---------- */
  function boutonLettre(s) { return '<button type="button" class="btn btn-secondaire" data-act="doc" data-id="' + esc(s.id) + '">Lettre de proposition au client' + ICO.imprimante + "</button>"; }
  function confirmation(s) {
    var c = CLIENT[s.c], r = s.calcul;
    return '<section class="bloc sc-ok" id="sc-ok" aria-labelledby="sc-t-ok"><div class="bloc-tete"><h2 id="sc-t-ok" tabindex="-1">' + ICO.check + "Proposition enregistrée</h2><span class=\"sous\">" + esc(nomComplet(c)) + " – dossier " + esc(s.ref) + "</span></div>" +
      '<ul class="sc-ok-liste"><li>' + esc(r.titre) + " : " + esc(r.verdict.libelle) + "</li><li>Les crédits concernés sont réservés à ce dossier tant que le client n'a pas répondu : aucune autre simulation n'est possible dessus.</li><li>Les conditions acceptées ne sont pas reprises automatiquement dans la fiche du client : le service de gestion des crédits établit l'avenant ou le nouveau prêt.</li></ul>" +
      '<p class="sc-ok-imprimer">Imprimez la lettre de proposition et remettez-la au client :</p><div class="sc-docs">' + boutonLettre(s) + '</div><div class="sc-btns" style="margin-top:14px"><button type="button" class="btn btn-secondaire" data-act="fermer-ok">Fermer</button>' + liens(c) + "</div></section>";
  }
  function puce(s) {
    var e = S.etat(s);
    if (e.code === "accepte") return '<span class="chip chip-ok">' + ICO.check + "Acceptée</span>";
    if (e.code === "renonce") return '<span class="chip chip-ctrl">' + ICO.info + "Abandonnée</span>";
    return '<span class="chip chip-warn">' + ICO.alerte + "En attente du client</span>";
  }
  function formDecision(s) {
    var accepte = etat.dec.d === "accepte";
    return '<form class="sc-dec" id="sc-dec-form" data-id="' + esc(s.id) + '" novalidate aria-labelledby="sc-dec-t"><p id="sc-dec-t"><strong>' + (accepte ? "Enregistrer l'acceptation du client" : "Enregistrer la renonciation du client") + "</strong></p>" +
      (accepte ? "<p>La lettre signée par le client est au dossier. Le service de gestion des crédits établit ensuite l'avenant ou l'offre de prêt ; les conditions ne sont pas modifiées dans la fiche du client par cet outil.</p>" : "<p>Le crédit est libéré : une nouvelle simulation est possible.</p>") +
      '<label class="op-case"><input type="checkbox" id="sc-dec-verif"' + (etat.decVerif ? " checked" : "") + "><span>" + (accepte ? "Le client m'a remis la lettre de proposition datée et signée." : "Le client m'a confirmé qu'il renonce à cette proposition.") + '</span></label><div class="msg-erreur" id="sc-dec-err" role="alert">' + esc(etat.decErr) + '</div><div class="sc-btns"><button type="submit" class="btn btn-principal">Enregistrer</button><button type="button" class="btn btn-secondaire" data-act="dec-annuler">Annuler</button></div></form>';
  }
  function carte(s) {
    var c = CLIENT[s.c], r = s.calcul, e = S.etat(s), sit = r.credits.map(function (k) { return S.situation(c.cre[k]); });
    return '<li class="regul-carte sc-carte sc-carte-' + e.code + '" id="sc-s-' + esc(s.ref) + '"><div class="regul-carte-tete"><div><h3 class="regul-nom">' + esc(nomComplet(c)) + '</h3><p class="regul-sous">Client ' + esc(c.num) + " – dossier " + esc(s.ref) + "</p></div>" + puce(s) + "</div>" +
      '<dl class="regul-donnees"><div><dt>Opération</dt><dd>' + esc(r.titre) + "</dd></div><div><dt>Crédit" + (sit.length > 1 ? "s" : "") + '</dt><dd>' + esc(sit.map(function (x) { return x.nom + (x.ext ? " – " + x.ext : "") + " (" + eur(x.crd) + ")"; }).join(" ; ")) + "</dd></div>" +
      "<div><dt>Étude du</dt><dd>" + esc(dateLongue(s.date)) + " à " + esc(s.heure.replace(":", " h ")) + "</dd></div><div><dt>" + (r.gain >= 0 ? "Économie nette" : "Surcoût") + "</dt><dd><strong>" + esc(eur(Math.abs(r.gain))) + "</strong></dd></div></dl>" +
      '<p class="regul-suivi regul-suivi-' + (e.code === "propose" ? "cours" : "fait") + '"><strong>' + esc(e.libelle) + ".</strong> " + esc(r.verdict.libelle) + "</p>" +
      (etat.dec && etat.dec.id === s.id ? formDecision(s) : "") + '<div class="sc-docs">' + boutonLettre(s) + "</div>" +
      '<div class="regul-actions">' + (e.code === "propose" && !(etat.dec && etat.dec.id === s.id) ? '<button type="button" class="btn btn-secondaire" data-act="dec" data-d="accepte" data-id="' + esc(s.id) + '">Le client accepte</button><button type="button" class="btn btn-secondaire" data-act="dec" data-d="renonce" data-id="' + esc(s.id) + '">Le client renonce</button>' : "") + liens(c) + "</div></li>";
  }
  function liste(l) {
    var h = '<section class="bloc" aria-labelledby="sc-t-liste"><div class="bloc-tete"><h2 id="sc-t-liste" tabindex="-1">Propositions enregistrées</h2><span class="sous">' + l.length + " proposition" + (l.length > 1 ? "s" : "") + "</span></div>";
    if (!l.length) return h + '<p class="vide-bloc">Aucune proposition pour le moment. Quand un client demande à rembourser, renégocier ou regrouper un crédit, étudiez sa demande ci-dessus puis enregistrez la proposition qui lui est remise.</p></section>';
    return h + '<ul class="regul-liste">' + l.slice().sort(function (a, b) { return a.ref < b.ref ? 1 : a.ref > b.ref ? -1 : 0; }).map(carte).join("") + "</ul></section>";
  }

  /* Typographie française : espace insécable avant « : », « % » et « € », dans les nombres à milliers et à l'intérieur des guillemets. */
  function typo(racine) {
    var w = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT, null), n, l = [];
    while ((n = w.nextNode())) { if (n.parentNode && /^(SCRIPT|STYLE|OPTION|TEXTAREA)$/.test(n.parentNode.nodeName)) continue; l.push(n); }
    l.forEach(function (t) {
      var v = t.nodeValue, r = v.replace(/ +([:;!?%€»])/g, " $1").replace(/(\d) (\d{3})(?!\d)/g, "$1 $2").replace(/« +/g, "« ");
      if (r !== v) t.nodeValue = r;
    });
  }
  function render(focus) {
    document.title = "GS Banque & Assurance – Suivi d'un crédit en cours";
    var l = S.liste(st()), fait = etat.fait ? S.trouver(st(), etat.fait) : null;
    app.innerHTML = '<nav class="fil-ariane" aria-label="Fil d\'Ariane"><a href="index.html">' + ICO.retour + 'Accueil</a></nav>' +
      '<div class="page-titre"><h1>Suivi d\'un crédit en cours</h1><p>Un client qui a déjà un crédit demande à le rembourser par anticipation, à en baisser le taux, à le faire reprendre par GS, à regrouper ses crédits ou à aménager ses mensualités : le conseiller chiffre la demande, applique les règles et remet une proposition.</p></div>' +
      deroule() + bilan(l) + (fait ? confirmation(fait) : "") + formulaire() + liste(l) +
      '<p class="sc-rappel">Sources des règles : Légifrance (Code de la consommation, articles L312-34, D312-15, L313-47, L313-48, R313-25 et R314-18 ; ordonnance n° 2025-880 du 3 septembre 2025), service-public.gouv.fr (fiche F1669), La finance pour tous, Pretto et Cafpi pour les repères du métier. Les frais d\'avenant, la clause de modulation et de report, les frais de dossier et de garantie du nouveau prêt sont des conventions de GS Banque &amp; Assurance, inventées pour l\'exercice.</p>';
    typo(app);
    if (focus) { var n = document.getElementById(focus); if (n) { try { n.focus(); } catch (e) { /* ignoré */ } if (/^sc-t-/.test(focus) && n.scrollIntoView) n.scrollIntoView({ block: "start" }); } }
  }

  /* ---------- actions ---------- */
  function lire() {
    var f = document.getElementById("sc-form"); if (!f) return;
    ["op", "k", "montant", "motif", "deja", "taux", "duree", "variation", "mois"].forEach(function (k) { var e = document.getElementById("sc-" + k); if (e) etat.f[k] = e.value; });
    ["mode", "effet"].forEach(function (k) { var e = f.querySelector('input[name="sc-' + k + '"]:checked'); if (e) etat.f[k] = e.value; else if (document.getElementById("sc-" + k)) etat.f[k] = ""; });
    var cr = f.querySelectorAll('input[name="sc-cr"]'); if (cr.length) etat.f.credits = Array.prototype.filter.call(cr, function (i) { return i.checked; }).map(function (i) { return i.value; });
    var s = document.getElementById("sc-client"); if (s) etat.cid = parseInt(s.value, 10) || 0;
  }
  function saisie() {
    var f = etat.f, o = { op: f.op, k: f.k === "" ? undefined : parseInt(f.k, 10), mode: f.mode, montant: f.montant, effet: f.effet, motif: f.motif, deja: f.deja, taux: f.taux, duree: f.duree, variation: f.variation, mois: f.mois, credits: f.credits.map(function (v) { return parseInt(v, 10); }) };
    return o;
  }
  function calculer() {
    lire(); etat.fait = null; etat.verif = false; etat.apercu = null;
    var c = client();
    if (!c) { etat.err = [{ champ: "client", msg: "Choisissez le client qui demande l'opération." }]; render("sc-client"); return; }
    var r = S.calculer(c, saisie(), B.aujourdhui());
    if (!r.ok) { etat.err = r.erreurs; var p = r.erreurs[0].champ; render(p && document.getElementById("sc-" + p) ? "sc-" + p : "sc-err"); return; }
    var bloque = null; r.credits.forEach(function (k) { var v = S.verrou(st(), c.id, k); if (v && !bloque) bloque = v; });
    if (bloque) { etat.err = [{ champ: "k", msg: "Ce crédit fait déjà l'objet du dossier " + bloque.ref + " : " + (bloque.statut === "accepte" ? "l'opération acceptée n'est pas encore reprise dans la fiche du client, aucune autre opération n'est simulée par-dessus." : "enregistrez la réponse du client avant d'en simuler une autre.") }]; render("sc-err"); return; }
    etat.err = null; etat.apercu = r; render("sc-t-calcul");
  }
  function enregistrer() {
    var v = document.getElementById("sc-verif"); etat.verif = !!(v && v.checked);
    if (!etat.verif) { etat.err = [{ champ: "verif", msg: "Cochez la vérification avec le client avant d'enregistrer la proposition." }]; render("sc-verif"); return; }
    var c = client(), r = S.creer(st(), c, saisie());
    if (!r.ok) { etat.err = r.erreurs; etat.apercu = null; render("sc-err"); return; }
    B.store.sauver();
    etat.fait = r.suivi.id; etat.f = Object.assign({}, VIDE, { credits: [] }); etat.apercu = null; etat.verif = false; etat.err = null; etat.cid = 0;
    render("sc-t-ok");
  }
  function imprimer(b) {
    var s = S.trouver(st(), b.getAttribute("data-id")); if (!s || !IMP) return;
    var c = CLIENT[s.c], d = DS.proposition(c, s, DS.personne(c));
    IMP.imprimer(IMP.document({ titre: d.titre, sous: d.sous, corps: d.corps, courrier: false, lettre: true }), d.fichier);
  }

  app.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-act]") : null; if (!b) return;
    var act = b.getAttribute("data-act");
    if (act === "enregistrer") enregistrer();
    else if (act === "modifier") { etat.apercu = null; etat.verif = false; render("sc-op"); }
    else if (act === "doc") imprimer(b);
    else if (act === "fermer-ok") { etat.fait = null; render("sc-t-liste"); }
    else if (act === "dec") { etat.dec = { id: b.getAttribute("data-id"), d: b.getAttribute("data-d") }; etat.decVerif = false; etat.decErr = ""; render("sc-dec-verif"); }
    else if (act === "dec-annuler") { var id = etat.dec && etat.dec.id; etat.dec = null; etat.decErr = ""; render(); var bt = document.querySelector('[data-act="dec"][data-id="' + id + '"]'); if (bt) bt.focus(); }
  });
  app.addEventListener("submit", function (e) {
    if (e.target.id === "sc-form") { e.preventDefault(); calculer(); }
    else if (e.target.id === "sc-dec-form") {
      e.preventDefault();
      var v = document.getElementById("sc-dec-verif"); etat.decVerif = !!(v && v.checked);
      if (!etat.decVerif) { etat.decErr = etat.dec.d === "accepte" ? "Cochez la case une fois la lettre signée reçue." : "Cochez la case une fois la renonciation confirmée par le client."; render("sc-dec-verif"); return; }
      var r = S.decider(st(), e.target.getAttribute("data-id"), etat.dec.d);
      if (!r.ok) { etat.decErr = r.erreur; render("sc-dec-err"); return; }
      B.store.sauver(); var ref = r.suivi.ref; etat.dec = null; etat.decErr = ""; render(); var cc = document.getElementById("sc-s-" + ref); if (cc) { cc.setAttribute("tabindex", "-1"); cc.focus(); }
    }
  });
  app.addEventListener("change", function (e) {
    if (!e.target.closest || !e.target.closest("#sc-form")) return;
    if (e.target.id === "sc-verif") { etat.verif = e.target.checked; return; }
    lire(); etat.err = null; etat.apercu = null; etat.verif = false;
    if (e.target.id === "sc-client") { etat.f = Object.assign({}, VIDE, { credits: [] }); render("sc-client"); return; }
    if (e.target.id === "sc-op") { var o = etat.f.op; etat.f = Object.assign({}, VIDE, { credits: [], op: o }); render("sc-op"); return; }
    if (e.target.id === "sc-k" || e.target.name === "sc-mode") {
      if (e.target.id === "sc-k") { etat.f.taux = ""; etat.f.duree = ""; }
      render(e.target.id || undefined);
      if (!e.target.id) { var rd = document.querySelector('input[name="' + e.target.name + '"][value="' + e.target.value + '"]'); if (rd) rd.focus(); }
      return;
    }
    var m = document.getElementById("sc-calcul"); if (m) m.parentNode.removeChild(m);
  });
  app.addEventListener("input", function (e) { if (e.target.id && /^sc-(montant|deja|taux|duree|variation|mois)$/.test(e.target.id)) etat.f[e.target.id.replace("sc-", "")] = e.target.value; });

  RECH.init(CL, document.getElementById("rech"), document.getElementById("rech-res"), document.getElementById("rech-statut"));
  render();
})();
