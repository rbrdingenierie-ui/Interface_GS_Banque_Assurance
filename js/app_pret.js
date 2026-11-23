/* GS Banque & Assurance – simulateur de prêt : choix de l'inconnue (mensualité, capital à emprunter ou durée), saisie, résultat expliqué, tableau d'amortissement,
   endettement du client, impression. Les calculs sont ceux de js/pret.js ; cette page ne fait que saisir et présenter. */
(function () {
  "use strict";

  var B = window.SGBF.banque, R = window.SGBF.pret, K = window.SGBF.catalogue, ICO = window.SGBF.icones, RECH = window.SGBF.recherche, IMP = window.SGBF.impression, CL = window.SGBF.clients;
  var VOL = window.SGBF.volets;
  var app = (VOL && VOL.panneau("pret")) || document.getElementById("app");
  var esc = B.esc, eur = B.eur2;
  var CLIENT = {}; CL.forEach(function (c) { CLIENT[c.id] = c; });
  function store() { return B.store.charger(); }
  function nomFull(c) { return c.civ + " " + c.prenom + " " + c.nom.toUpperCase(); }
  function nomListe(c) { return c.nom.toUpperCase() + " " + c.prenom; }
  function nf(x, d) { return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(x); }
  function numTxt(x, d) { return nf(x, d).replace(/[  ]/g, " "); }
  function eur0(x) { return eur(x).replace(",00", ""); }
  function tauxTxt(x) { return nf(x, Math.abs(x * 100 - Math.round(x * 100)) < 1e-9 ? 2 : 3); }
  var pct = R.pct, pctTaux = R.pctTaux, libDuree = R.libDuree;
  var PRODUITS = R.produitsPret(), PAR_ID = {}; PRODUITS.forEach(function (p) { PAR_ID[p.id] = p; });

  var LIB_INCONNUE = {
    mensualite: ["La mensualité", "Ce que je rembourse chaque mois"],
    capital: ["Le capital à emprunter", "Ce que je peux emprunter pour une mensualité donnée"],
    duree: ["La durée du prêt", "Le nombre de mensualités nécessaire"]
  };
  var CHAMP_ID = { capital: "pr-capital", mensualite: "pr-mensualite", duree: "pr-ans", taux: "pr-taux", produit: "pr-produit", inconnue: "pr-inc-mensualite" };

  var params = VOL ? VOL.params("pret") : new URLSearchParams(location.search);
  function etatInitial() {
    return { inconnue: "mensualite", produit: "", capital: "200 000", mensualite: "1 170", ans: "20", mois: "0", taux: "3,60", client: null, q: "", err: null, res: null, perime: false };
  }
  var etat = etatInitial();
  function dureeSaisie() {
    var a = etat.ans.trim() === "" ? 0 : R.lireNombre(etat.ans), m = etat.mois.trim() === "" ? 0 : R.lireNombre(etat.mois);
    return isNaN(a) || isNaN(m) || a !== Math.floor(a) || m !== Math.floor(m) ? NaN : a * 12 + m;
  }
  function choisirProduit(id) {
    etat.produit = id || "";
    if (id) { var d = dureeSaisie(), tc = R.tauxCatalogue(id, d > 0 ? d : 0) || PAR_ID[id].grille[PAR_ID[id].grille.length - 1]; etat.taux = tauxTxt(tc.taux); }
  }
  if (R.ORDRE_INCONNUES.indexOf(params.get("inconnue")) >= 0) etat.inconnue = params.get("inconnue");
  choisirProduit(PAR_ID[params.get("produit")] ? params.get("produit") : "CIMMO");
  if (CLIENT[params.get("client")]) etat.client = parseInt(params.get("client"), 10);
  function client() { return etat.client ? CLIENT[etat.client] : null; }

  /* ---------- lecture de la saisie ---------- */
  function lireChamps() {
    ["capital", "mensualite", "taux", "ans", "mois"].forEach(function (k) { var f = document.getElementById("pr-" + k); if (f) etat[k] = f.value; });
    var p = document.getElementById("pr-produit"); if (p) etat.produit = p.value;
    var r = app.querySelector('input[name="pr-inc"]:checked'); if (r) etat.inconnue = r.value;
  }
  function saisie() {
    return { inconnue: etat.inconnue, produit: etat.produit || null, capital: etat.capital, mensualite: etat.mensualite, dureeMois: dureeSaisie(), taux: etat.taux };
  }

  /* ---------- client concerné ---------- */
  function clientHtml() {
    var c = client(), h = '<div class="champ cl-q"><label for="pr-cl-q">Rechercher un client (nom, prénom ou numéro)</label><input id="pr-cl-q" type="search" autocomplete="off" maxlength="60" aria-controls="pr-cl-res" value="' + esc(etat.q) + '"></div>' +
      '<ul id="pr-cl-res" class="cl-res" hidden></ul><p id="pr-cl-statut" class="sr" role="status"></p>';
    if (c) {
      h += '<div class="cl-choisi" id="pr-cl-choisi" tabindex="-1"><p><strong>' + esc(nomFull(c)) + "</strong> – " + c.age + " ans – " + esc(c.pro.prof) + " – " + esc(c.num) + '</p>' + verdictHtml(c) +
        '<div class="pf-btns"><a class="btn btn-secondaire" href="client.html?id=' + c.id + '">Ouvrir la fiche client</a><button type="button" class="btn-texte" data-act="retirer-client">Retirer ce client</button></div></div>';
    } else h += '<p class="vide-bloc cl-aide">Facultatif : choisissez un client pour afficher son nom sur l\'impression et mesurer l\'effet du prêt sur son taux d\'endettement.</p>';
    return h;
  }
  function verdictHtml(c) {
    if (!etat.produit) return '<p class="sous">Choisissez un crédit du catalogue pour voir où en est ce client.</p>';
    var ev = K.verdictClient(c, etat.produit, store()), cls = { eligible: "chip-ok", examiner: "chip-warn", non: "chip-bad", detenu: "chip-ctrl" }[ev.verdict];
    return '<p class="sous">' + esc(PAR_ID[etat.produit].nom) + " : " + '<span class="chip ' + cls + '">' + esc(ev.libelle) + '</span> <a href="catalogue.html?produit=' + etat.produit + "&amp;client=" + c.id + '">Voir le détail dans le catalogue</a></p>';
  }
  function majClient() { document.getElementById("pr-z-client").innerHTML = clientHtml(); }
  function suggestions() {
    var z = document.getElementById("pr-cl-res"), s = document.getElementById("pr-cl-statut"), q = etat.q.trim();
    if (q.length < 2) { z.hidden = true; z.innerHTML = ""; s.textContent = ""; return; }
    var r = RECH.chercher(CL, q, 8);
    z.innerHTML = r.length ? r.map(function (c) { return '<li><button type="button" data-act="choisir-client" data-id="' + c.id + '"><span class="rech-nom">' + esc(nomListe(c)) + '</span><span class="rech-sous">' + c.age + " ans – " + esc(c.pro.prof) + " – " + esc(c.num) + "</span></button></li>"; }).join("") : '<li class="rech-vide">Aucun client trouvé</li>';
    s.textContent = r.length ? r.length + (r.length > 1 ? " résultats" : " résultat") : "Aucun résultat";
    z.hidden = false;
  }

  /* ---------- formulaire ---------- */
  function champ(cle, lib, aide) {
    var err = etat.err && etat.err.champ === cle;
    return '<div class="champ" id="ch-' + cle + '"><label for="pr-' + cle + '">' + lib + '</label><input id="pr-' + cle + '" type="text" inputmode="decimal" autocomplete="off" value="' + esc(etat[cle]) + '"' + (err ? ' aria-invalid="true" aria-describedby="pr-err"' : (aide ? ' aria-describedby="pr-aide-' + cle + '"' : "")) + ">" +
      (aide ? '<span class="aide-champ" id="pr-aide-' + cle + '">' + aide + "</span>" : "") + "</div>";
  }
  function produitAide() {
    var p = PAR_ID[etat.produit];
    if (!p) return "Vous choisissez vous-même le taux. Le catalogue de la banque sert de repère : choisissez un crédit pour voir sa grille de taux.";
    var t = [];
    if (p.capitalMin && p.capitalMax) t.push("montant de " + eur0(p.capitalMin) + " à " + eur0(p.capitalMax)); else if (p.capitalMin) t.push("à partir de " + eur0(p.capitalMin));
    t.push(p.nature === "nominal" ? "durée jusqu'à " + libDuree(p.dureeMax) : "durée de " + libDuree(p.dureeMin) + " à " + libDuree(p.dureeMax));
    t.push(p.fraisDossier ? "frais de dossier " + eur0(p.fraisDossier) + " (non compris dans le calcul)" : "sans frais de dossier");
    return esc(p.nom) + " : " + t.join(" – ") + ".";
  }
  function tauxAide() {
    var p = PAR_ID[etat.produit], base = "Entre 0 % et 20 %, trois décimales au plus (exemple : 3,6). Taux fixe, constant sur toute la durée du prêt.";
    if (!p) return base;
    if (p.nature === "nominal") return "Grille du catalogue (taux fixe, hors assurance) : " + p.grille.map(function (g) { return g.mois / 12 + " ans : " + tauxTxt(g.taux) + " %"; }).join(" – ") + ". " + base;
    return "Le catalogue indique un TAEG « à partir de » " + tauxTxt(p.taeg) + " %, soit " + tauxTxt(p.grille[0].taux) + " % de taux nominal sans assurance ni frais. " + base;
  }
  function formulaireHtml() {
    var inc = etat.inconnue, e = etat.err, h = "";
    h += '<fieldset class="pr-inconnue"><legend>Que voulez-vous calculer ?</legend><div class="pr-radios">' + R.ORDRE_INCONNUES.map(function (k) {
      return '<label class="pr-radio"><input type="radio" name="pr-inc" id="pr-inc-' + k + '" value="' + k + '"' + (inc === k ? " checked" : "") + '><span><strong>' + LIB_INCONNUE[k][0] + "</strong><small>" + LIB_INCONNUE[k][1] + "</small></span></label>";
    }).join("") + "</div></fieldset>";
    h += '<div class="champ"><label for="pr-produit">Crédit du catalogue ou taux libre</label><select id="pr-produit" aria-describedby="pr-aide-produit">' +
      '<option value=""' + (!etat.produit ? " selected" : "") + ">Taux libre : je choisis le taux</option>" +
      PRODUITS.map(function (p) {
        var g = p.grille, rep = p.nature === "nominal" ? "taux fixe de " + tauxTxt(g[0].taux) + " % à " + tauxTxt(g[g.length - 1].taux) + " %" : "TAEG à partir de " + tauxTxt(p.taeg) + " %";
        return '<option value="' + p.id + '"' + (etat.produit === p.id ? " selected" : "") + ">" + esc(p.nom) + " – " + rep + "</option>";
      }).join("") + '</select><span class="aide-champ" id="pr-aide-produit">' + produitAide() + "</span></div>";
    if (inc !== "capital") h += champ("capital", "Capital à emprunter (€) *", "Le montant que la banque prête, entre 100 € et 5 000 000 €.");
    if (inc !== "mensualite") h += champ("mensualite", "Mensualité (€) *", "Ce que le client rembourse chaque mois, assurance non comprise.");
    if (inc !== "duree") {
      var errD = e && e.champ === "duree";
      h += '<div class="champ pr-duree" role="group" aria-labelledby="pr-lib-duree"><span class="pr-lib" id="pr-lib-duree">Durée *</span><div class="pr-duree-champs"><label class="sr" for="pr-ans">Années</label><input id="pr-ans" type="text" inputmode="numeric" autocomplete="off" value="' + esc(etat.ans) + '"' + (errD ? ' aria-invalid="true" aria-describedby="pr-err"' : "") + '><span aria-hidden="true">ans</span>' +
        '<label class="sr" for="pr-mois">Mois</label><input id="pr-mois" type="text" inputmode="numeric" autocomplete="off" value="' + esc(etat.mois) + '"' + (errD ? ' aria-invalid="true" aria-describedby="pr-err"' : "") + '><span aria-hidden="true">mois</span></div><span class="aide-champ">De 1 mois à 30 ans, en nombre entier de mois.</span></div>';
    }
    h += '<div class="champ" id="pr-ch-taux"><label for="pr-taux">Taux nominal annuel (%) *</label><input id="pr-taux" type="text" inputmode="decimal" autocomplete="off" value="' + esc(etat.taux) + '"' + (e && e.champ === "taux" ? ' aria-invalid="true" aria-describedby="pr-err"' : ' aria-describedby="pr-aide-taux"') + '><span class="aide-champ" id="pr-aide-taux">' + tauxAide() + "</span>" +
      (etat.produit ? '<button type="button" class="btn-texte pr-btn-taux" data-act="taux-catalogue">Appliquer le taux du catalogue</button>' : "") + "</div>";
    h += '<p class="msg-erreur" id="pr-err" role="alert">' + (e ? esc(e.erreur) : "") + "</p>" +
      '<div class="pf-btns"><button type="submit" class="btn btn-principal">Calculer</button><button type="button" class="btn-texte" data-act="exemple">Remettre l\'exemple</button></div>';
    return h;
  }
  function majFormulaire(focusId) {
    document.getElementById("pr-form").innerHTML = formulaireHtml();
    var f = focusId && document.getElementById(focusId); if (f) f.focus();
  }

  /* ---------- résultat ---------- */
  function dureeLong(m) { return libDuree(m) + (m >= 12 ? " (" + m + " mois)" : ""); }
  function difDerniere(r) { return r.nbEcheances > 1 && Math.abs(r.derniere - r.mensualite) > 1e-9; }
  function phrase(r) {
    var e = r.e, inc = r.inconnue, tx = pctTaux(e.taux) + " par an", fin = difDerniere(r) ? " La dernière mensualité, qui solde le prêt, est de " + eur(r.derniere) + "." : "";
    if (inc === "mensualite") return "Pour emprunter " + eur(e.capital) + " pendant " + dureeLong(e.dureeMois) + ", à " + tx + ", la mensualité est de " + eur(r.mensualite) + "." + fin;
    if (inc === "capital") return "Avec une mensualité de " + eur(e.mensualite) + " pendant " + dureeLong(e.dureeMois) + ", à " + tx + ", vous pouvez emprunter " + eur(r.capital) + "." + fin;
    return "Pour emprunter " + eur(e.capital) + " avec une mensualité de " + eur(e.mensualite) + ", à " + tx + ", il faut rembourser pendant " + dureeLong(e.dureeMois) + "." + fin;
  }
  function kpi(cle, lib, val, det, inc) {
    return '<div class="kpi' + (inc === cle ? " kpi-inconnue" : "") + '"><dt>' + esc(lib) + (inc === cle ? ' <span class="puce puce-ok">Résultat cherché</span>' : "") + '</dt><dd class="val">' + val + "</dd>" + (det ? '<dd class="det">' + det + "</dd>" : "") + "</div>";
  }
  function kpisHtml(r) {
    var e = r.e, inc = r.inconnue, p = r.p;
    return '<dl class="kpis pr-kpis">' +
      kpi("capital", "Capital emprunté", esc(eur(r.capital)), "", inc) +
      kpi("mensualite", "Mensualité", esc(eur(r.mensualite)), difDerniere(r) ? "dernière : " + esc(eur(r.derniere)) : "hors assurance", inc) +
      kpi("duree", "Durée", esc(libDuree(e.dureeMois)), e.dureeMois + " mois", inc) +
      kpi("taux", "Taux nominal annuel", esc(pctTaux(e.taux)), p ? esc(p.code) + " – taux annuel effectif " + esc(pct(r.tauxEffectif)) : "taux libre – taux annuel effectif " + esc(pct(r.tauxEffectif)), inc) +
      kpi("interets", "Coût du crédit", esc(eur(r.interets)), "intérêts seulement", inc) +
      kpi("total", "Total remboursé", esc(eur(r.total)), "capital + intérêts", inc) + "</dl>";
  }
  function partHtml(r) {
    var pc = r.capital / r.total * 100, pi = 100 - pc;
    return '<div class="pr-part"><p>Sur 100 € remboursés, <strong>' + nf(pc, 1) + " € de capital</strong> et <strong>" + nf(pi, 1) + " € d'intérêts</strong>.</p>" +
      '<div class="pr-part-barre" aria-hidden="true"><span class="pr-part-capital" style="width:' + pc.toFixed(2) + '%"></span><span class="pr-part-interets" style="width:' + pi.toFixed(2) + '%"></span></div>' +
      '<div class="pr-part-legende" aria-hidden="true"><span class="l-cap">Capital : ' + esc(eur(r.capital)) + '</span><span class="l-int">Intérêts : ' + esc(eur(r.interets)) + "</span></div></div>";
  }
  function alertesHtml(liste) {
    return '<ul class="pr-alertes">' + liste.map(function (a) {
      return '<li class="pr-al pr-al-' + a.n + '"><span class="pr-al-ico">' + (a.n === "attention" ? ICO.alerte : ICO.info) + '</span><span><strong>' + (a.n === "attention" ? "Attention : " : "À savoir : ") + "</strong>" + esc(a.t) + "</span></li>";
    }).join("") + "</ul>";
  }
  function tableau(titre, tete, lignes, cls) {
    return '<div class="tab-wrap tab-defile" role="region" aria-label="' + esc(titre) + '" tabindex="0"><table class="tab tab-cg bl-tab ' + (cls || "") + '"><caption class="sr">' + esc(titre) + "</caption><thead><tr>" + tete.map(function (t, i) { return '<th scope="col"' + (i === 0 ? ' class="gauche"' : "") + ">" + esc(t) + "</th>"; }).join("") + "</tr></thead><tbody>" + lignes.join("") + "</tbody></table></div>";
  }
  var TETE_AN = ["Année", "Mensualités versées", "Intérêts", "Capital remboursé", "Capital restant dû"], TETE_MOIS = ["Mensualité n°", "Mensualité", "Intérêts", "Capital remboursé", "Capital restant dû"];
  function tabAnnuel(r) {
    return '<h3 class="sous-titre">Tableau d\'amortissement par année</h3>' + tableau("Tableau d'amortissement par année", TETE_AN, r.lignes.map(function (l) {
      return '<tr><th scope="row" class="gauche">' + esc(l.lib) + "</th><td>" + esc(eur(l.pay)) + "</td><td>" + esc(eur(l.int)) + "</td><td>" + esc(eur(l.cap)) + "</td><td>" + esc(eur(l.crd)) + "</td></tr>";
    }).concat(['<tr class="bl-total"><th scope="row" class="gauche">Total</th><td>' + esc(eur(r.total)) + "</td><td>" + esc(eur(r.interets)) + "</td><td>" + esc(eur(r.capital)) + "</td><td>" + esc(eur(0)) + "</td></tr>"]), "pr-tab") +
      '<p class="mention">Chaque mensualité se partage entre des intérêts (calculés sur le capital restant dû) et du capital remboursé : au début, la part des intérêts est la plus forte.</p>';
  }
  function tabMensuel(r) {
    return '<details class="pr-details" id="pr-det-mois"><summary>Voir le tableau d\'amortissement mois par mois (' + r.nbEcheances + (r.nbEcheances > 1 ? " lignes" : " ligne") + ')</summary><div class="pr-tab-mois">' +
      tableau("Tableau d'amortissement mois par mois", TETE_MOIS, r.echeances.map(function (l) {
        return '<tr><th scope="row" class="gauche">' + l.k + "</th><td>" + esc(eur(l.pay)) + "</td><td>" + esc(eur(l.int)) + "</td><td>" + esc(eur(l.cap)) + "</td><td>" + esc(eur(l.crd)) + "</td></tr>";
      }), "pr-tab") + '</div><p class="mention" style="padding:0 14px 12px">Le tableau complet peut aussi s\'imprimer avec le bouton « Imprimer le tableau complet ».</p></details>';
  }
  function detailHtml(r) {
    return '<details class="pr-details" id="pr-det"><summary>Voir le calcul détaillé</summary><ol class="pr-calc">' + r.detail.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") +
      '</ol><p class="mention">Le signe ^ veut dire « puissance » : (1 + 0,003)^3 = 1,003 × 1,003 × 1,003. Les montants sont arrondis au centime.</p></details>';
  }
  /* Endettement du client avant et après le prêt (revenus du foyer, mensualités en cours, limite de 35 % pour un prêt immobilier). */
  function endettement(r) {
    var c = client(); if (!c) return null;
    var d = R.endettement(c, r.mensualite), imm = !!(r.p && r.p.id === "CIMMO"), lignes = [];
    if (d.foyer) {
      var lim = d.seuil / 100 * d.foyer;
      lignes.push(["Revenus du foyer par mois", eur(d.foyer), eur(d.foyer)], ["Mensualités de crédit par mois (toutes banques, assurance des crédits en cours comprise)", eur(d.avant), eur(d.apres)], ["Taux d'endettement", pct(d.tauxAvant), pct(d.tauxApres)]);
      if (imm) lignes.push(["Reste avant la limite de " + d.seuil + " % (" + eur(lim) + " par mois)", lim - d.avant >= 0 ? eur(lim - d.avant) : "dépassement de " + eur(d.avant - lim), lim - d.apres >= 0 ? eur(lim - d.apres) : "dépassement de " + eur(d.apres - lim)]);
    }
    return { c: c, d: d, imm: imm, lignes: lignes, alertes: R.alertesClient(r, c) };
  }
  function endettementHtml(r) {
    var x = endettement(r); if (!x) return "";
    var h = '<h3 class="sous-titre">Effet sur l\'endettement de ' + esc(nomFull(x.c)) + "</h3>";
    if (x.lignes.length) h += tableau("Endettement du client avant et avec le prêt", ["Indicateur", "Avant le prêt", "Avec ce prêt"], x.lignes.map(function (l, i) {
      var hors = x.imm && i === 3 && /dépassement/.test(l[2]);
      return '<tr><th scope="row" class="gauche">' + esc(l[0]) + "</th><td>" + esc(l[1]) + "</td><td" + (hors ? ' class="pr-hors"' : "") + ">" + esc(l[2]) + "</td></tr>";
    }), "pr-tab pr-endet");
    return h + alertesHtml(x.alertes);
  }
  function resultatHtml() {
    var r = etat.res;
    if (!r) return '<section class="bloc pr-res" aria-labelledby="pr-t-res"><div class="bloc-tete"><h2 id="pr-t-res" tabindex="-1">Résultat</h2></div><p class="vide-bloc" id="pr-vide">' + (etat.err ? "Corrigez la saisie signalée en rouge, puis cliquez sur « Calculer »." : "Choisissez ce que vous cherchez, renseignez les données puis cliquez sur « Calculer ». Les valeurs proposées sont un exemple : remplacez-les par les vôtres.") + "</p></section>";
    return '<section class="bloc pr-res" aria-labelledby="pr-t-res"><div class="bloc-tete"><h2 id="pr-t-res" tabindex="-1">Résultat</h2><span class="ag-outils pr-btns-imp"><button type="button" class="btn btn-secondaire btn-impr" data-act="imprimer">' + ICO.imprimante + "<span>Imprimer la simulation</span></button>" +
      '<button type="button" class="btn btn-secondaire btn-impr" data-act="imprimer-tableau">' + ICO.imprimante + "<span>Imprimer le tableau complet</span></button></span></div>" +
      '<p class="pr-perime-msg" id="pr-perime" role="status" hidden>Les données ont changé depuis ce calcul : cliquez sur « Calculer » pour mettre le résultat à jour.</p><div id="pr-corps">' +
      '<p class="pr-phrase" id="pr-phrase">' + esc(phrase(r)) + "</p>" + kpisHtml(r) + partHtml(r) + alertesHtml(r.alertes) + endettementHtml(r) + detailHtml(r) + tabAnnuel(r) + tabMensuel(r) + "</div></section>";
  }
  function mentionHtml() { return esc(R.mentionCredit(null, etat.produit || null)); }
  function majMention() { var m = document.getElementById("pr-mention-credit"); if (m) m.innerHTML = mentionHtml(); }
  function majResultat() { document.getElementById("pr-z-resultat").innerHTML = resultatHtml(); }
  /* Nouveau rendu du résultat déjà affiché (changement de client), sans effacer l'avertissement « données modifiées ». */
  function rafraichirResultat() { var p = etat.perime; majResultat(); etat.perime = false; if (p) marquerPerime(); }

  /* ---------- impression ---------- */
  function dpTable(tete, lignes, cls) { return '<table class="dp-pf dp-pr ' + (cls || "") + '"><thead><tr>' + tete.map(function (t) { return '<th scope="col">' + esc(t) + "</th>"; }).join("") + "</tr></thead><tbody>" + lignes.join("") + "</tbody></table>"; }
  function ligneDp(cells, total) { return "<tr" + (total ? ' class="dp-total"' : "") + ">" + cells.map(function (x) { return "<td>" + esc(x) + "</td>"; }).join("") + "</tr>"; }
  function fichierNom(r, pref) { var c = client(); return IMP.nomFichier(pref + (c ? c.nom + "_" : "") + (r.p ? r.p.code + "_" : "") + Math.round(r.capital) + "_euros_" + r.nbEcheances + "_mois"); }
  function docSimulation() {
    var r = etat.res; if (!r) return;
    var e = r.e, inc = r.inconnue, c = client(), st = store(), corps = "";
    corps += '<section class="dp-bloc"><h2>Résultat</h2><p class="dp-texte">' + esc(phrase(r)) + "</p></section>";
    corps += '<section class="dp-bloc"><h2>Données de la simulation</h2><dl class="dp-fiche"><dt>Calcul demandé</dt><dd>' + esc(LIB_INCONNUE[inc][0]) + "</dd><dt>Crédit</dt><dd>" + esc(r.p ? r.p.nom : "Taux libre") + "</dd>" +
      "<dt>Capital emprunté</dt><dd>" + esc(eur(r.capital)) + "</dd><dt>Durée</dt><dd>" + esc(dureeLong(e.dureeMois)) + "</dd><dt>Taux nominal annuel</dt><dd>" + esc(pctTaux(e.taux)) + " (taux annuel effectif : " + esc(pct(r.tauxEffectif)) + ")</dd><dt>Mensualité</dt><dd>" + esc(eur(r.mensualite)) + (difDerniere(r) ? " (dernière : " + esc(eur(r.derniere)) + ")" : "") + "</dd></dl></section>";
    corps += '<section class="dp-bloc"><h2>Chiffres clés</h2><dl class="dp-chiffres"><div><dt>Capital emprunté</dt><dd>' + esc(eur(r.capital)) + "</dd></div><div><dt>Mensualité</dt><dd>" + esc(eur(r.mensualite)) + "</dd></div><div><dt>Coût du crédit (intérêts)</dt><dd>" + esc(eur(r.interets)) + "</dd></div><div><dt>Total remboursé</dt><dd>" + esc(eur(r.total)) + "</dd></div></dl></section>";
    var x = endettement(r);
    if (x) {
      corps += '<section class="dp-bloc"><h2>Effet sur l\'endettement de ' + esc(nomFull(x.c)) + "</h2>" + (x.lignes.length ? dpTable(["Indicateur", "Avant le prêt", "Avec ce prêt"], x.lignes.map(function (l) { return ligneDp(l); }), "dp-prg") : "") +
        '<ul class="dp-liste">' + x.alertes.map(function (a) { return "<li>" + esc((a.n === "attention" ? "Attention : " : "") + a.t) + "</li>"; }).join("") + "</ul></section>";
    }
    corps += '<section class="dp-bloc"><h2>Tableau d\'amortissement par année</h2>' + dpTable(TETE_AN, r.lignes.map(function (l) { return ligneDp([l.lib, eur(l.pay), eur(l.int), eur(l.cap), eur(l.crd)]); }).concat([ligneDp(["Total", eur(r.total), eur(r.interets), eur(r.capital), eur(0)], true)])) + "</section>";
    corps += '<section class="dp-bloc"><h2>Calcul détaillé</h2><ul class="dp-liste">' + r.detail.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul></section>";
    corps += '<section class="dp-bloc"><h2>Points d\'attention</h2><ul class="dp-liste">' + r.alertes.map(function (a) { return "<li>" + esc((a.n === "attention" ? "Attention : " : "") + a.t) + "</li>"; }).join("") + '</ul><p class="dp-mention">Simulation à titre indicatif, sans valeur contractuelle : prêt à taux fixe et à mensualités constantes, calcul sans assurance emprunteur, frais de dossier ni garanties, sans différé ni remboursement anticipé. ' + esc(R.mentionCredit(null, r.p ? r.p.id : null)) + "</p></section>";
    IMP.imprimer(IMP.document({ titre: "Simulation de prêt", sous: c ? nomFull(c) + " – " + c.num : "Agence de Paris", corps: corps }), fichierNom(r, "Simulation_pret_"));
  }
  function docTableau() {
    var r = etat.res; if (!r) return;
    var e = r.e, c = client(), st = store(), corps = "";
    corps += '<section class="dp-bloc"><h2>Caractéristiques du prêt</h2><dl class="dp-fiche"><dt>Crédit</dt><dd>' + esc(r.p ? r.p.nom : "Taux libre") + "</dd><dt>Capital emprunté</dt><dd>" + esc(eur(r.capital)) + "</dd><dt>Durée</dt><dd>" + esc(dureeLong(e.dureeMois)) + "</dd><dt>Taux nominal annuel</dt><dd>" + esc(pctTaux(e.taux)) + "</dd><dt>Mensualité</dt><dd>" + esc(eur(r.mensualite)) + (difDerniere(r) ? " (dernière : " + esc(eur(r.derniere)) + ")" : "") + "</dd><dt>Coût du crédit (intérêts)</dt><dd>" + esc(eur(r.interets)) + "</dd><dt>Total remboursé</dt><dd>" + esc(eur(r.total)) + "</dd></dl></section>";
    corps += '<section class="dp-bloc"><h2>Tableau d\'amortissement</h2>' + dpTable(TETE_MOIS, r.echeances.map(function (l) { return ligneDp([String(l.k), eur(l.pay), eur(l.int), eur(l.cap), eur(l.crd)]); }).concat([ligneDp(["Total", eur(r.total), eur(r.interets), eur(r.capital), ""], true)])) +
      '<p class="dp-mention">Simulation à titre indicatif, sans valeur contractuelle, sans assurance emprunteur ni frais. ' + esc(R.mentionCredit(null, r.p ? r.p.id : null)) + "</p></section>";
    IMP.imprimer(IMP.document({ titre: "Tableau d'amortissement", sous: c ? nomFull(c) + " – " + c.num : "Agence de Paris", corps: corps }), fichierNom(r, "Tableau_amortissement_"));
  }

  /* ---------- page ---------- */
  function render() {
    app.innerHTML = '<section class="bloc pr-client" aria-labelledby="pr-t-client"><div class="bloc-tete"><h2 id="pr-t-client">Client concerné</h2></div><div id="pr-z-client">' + clientHtml() + "</div></section>" +
      '<div class="pr-grille"><section class="bloc pr-form-bloc" aria-labelledby="pr-t-form"><div class="bloc-tete"><h2 id="pr-t-form">Mon calcul</h2></div><form class="formulaire pr-form" id="pr-form" novalidate>' + formulaireHtml() + '</form></section><div id="pr-z-resultat">' + resultatHtml() + "</div></div>" +
      '<p class="mention" style="margin-top:16px">Simulation à titre indicatif, sans valeur contractuelle. Hypothèses : prêt à taux fixe remboursé par mensualités constantes ; calcul sans assurance emprunteur, frais de dossier ni garanties (intérêts seulement) ; ni différé ni remboursement anticipé. Taux et conditions : ceux du catalogue de la banque. Ce simulateur ne remplace pas l\'étude du dossier du client.</p>' +
      '<p class="mention pr-mention-credit" id="pr-mention-credit" style="margin-top:6px">' + mentionHtml() + "</p>";
  }
  function marquerPerime() {
    if (!etat.res || etat.perime) return;
    etat.perime = true;
    var m = document.getElementById("pr-perime"), c = document.getElementById("pr-corps");
    if (m) m.hidden = false; if (c) c.classList.add("pr-perime");
  }
  function reporter(r) {
    /* Le résultat devient une donnée : si l'on change ce qu'on cherche, la valeur trouvée apparaît déjà dans le champ correspondant. */
    if (r.inconnue === "mensualite") etat.mensualite = numTxt(r.mensualite, 2);
    else if (r.inconnue === "capital") etat.capital = numTxt(r.capital, 2);
    else { etat.ans = String(Math.floor(r.dureeMois / 12)); etat.mois = String(r.dureeMois % 12); }
  }
  function calculer() {
    lireChamps();
    var r = R.calculer(saisie());
    etat.perime = false;
    if (!r.ok) {
      etat.err = r; etat.res = null;
      majFormulaire(); majResultat();
      var f = document.getElementById(CHAMP_ID[r.champ] || ""); if (f) f.focus(); else { var z = document.getElementById("pr-err"); if (z) z.scrollIntoView({ block: "center" }); }
      return;
    }
    etat.err = null; etat.res = r; reporter(r);
    majFormulaire(); majResultat();
    var h = document.getElementById("pr-t-res"); if (h) { h.scrollIntoView({ block: "start" }); h.focus(); }
  }

  /* ---------- événements ---------- */
  app.addEventListener("change", function (e) {
    var t = e.target;
    if (t.name === "pr-inc") {
      lireChamps(); etat.err = null; etat.res = null; etat.perime = false;
      majFormulaire(); majResultat(); var r = app.querySelector('input[name="pr-inc"]:checked'); if (r) r.focus();
    } else if (t.id === "pr-produit") {
      lireChamps(); choisirProduit(t.value); etat.err = null; marquerPerime(); majFormulaire("pr-produit"); majClient(); majMention();
    } else if (t.closest("#pr-form")) marquerPerime();
  });
  app.addEventListener("input", function (e) {
    var t = e.target;
    if (t.id === "pr-cl-q") { etat.q = t.value; suggestions(); return; }
    if (t.closest("#pr-form") && t.tagName !== "SELECT") { marquerPerime(); if (etat.err) { etat.err = null; var z = document.getElementById("pr-err"); if (z) z.textContent = ""; app.querySelectorAll("#pr-form [aria-invalid]").forEach(function (x) { x.removeAttribute("aria-invalid"); }); } }
  });
  app.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    var a = b.getAttribute("data-act");
    if (a === "imprimer") docSimulation();
    else if (a === "imprimer-tableau") docTableau();
    else if (a === "taux-catalogue") { lireChamps(); var p = PAR_ID[etat.produit]; if (p) { choisirProduit(p.id); etat.err = null; marquerPerime(); majFormulaire("pr-taux"); } }
    else if (a === "exemple") { var inc = etat.inconnue, p2 = etat.produit, cl = etat.client; etat = etatInitial(); etat.inconnue = inc; etat.client = cl; choisirProduit(p2 || "CIMMO"); render(); }
    else if (a === "choisir-client") { etat.client = parseInt(b.getAttribute("data-id"), 10); etat.q = ""; majClient(); var z = document.getElementById("pr-cl-choisi"); if (z) z.focus(); if (etat.res) rafraichirResultat(); }
    else if (a === "retirer-client") { etat.client = null; etat.q = ""; majClient(); var q = document.getElementById("pr-cl-q"); if (q) q.focus(); if (etat.res) rafraichirResultat(); }
  });
  app.addEventListener("submit", function (e) { e.preventDefault(); if (e.target.id === "pr-form") calculer(); });

  render();
})();
