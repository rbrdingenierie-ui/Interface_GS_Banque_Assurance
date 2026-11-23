/* GS Banque & Assurance – simulateur d'épargne : choix de l'inconnue, saisie, résultat expliqué, évolution du capital, comparaison des trois méthodes, impression.
   Les calculs sont ceux de js/epargne.js ; cette page ne fait que saisir et présenter. */
(function () {
  "use strict";

  var B = window.SGBF.banque, EP = window.SGBF.epargne, PR = window.SGBF.produits, K = window.SGBF.catalogue, ICO = window.SGBF.icones, RECH = window.SGBF.recherche, IMP = window.SGBF.impression, CL = window.SGBF.clients;
  var VOL = window.SGBF.volets;
  var app = (VOL && VOL.panneau("epargne")) || document.getElementById("app");
  var esc = B.esc, eur = B.eur2;
  var CLIENT = {}; CL.forEach(function (c) { CLIENT[c.id] = c; });
  function store() { return B.store.charger(); }
  function nomFull(c) { return c.civ + " " + c.prenom + " " + c.nom.toUpperCase(); }
  function nomListe(c) { return c.nom.toUpperCase() + " " + c.prenom; }
  function pct(x) { return EP.pct(x); }
  function tauxTxt(x) { return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(x); }
  var PRODUITS = EP.produitsEpargne(), PAR_ID = {}; PRODUITS.forEach(function (p) { PAR_ID[p.id] = p; });

  var LIB_INCONNUE = {
    capitalAcquis: ["Le capital acquis", "Ce que j'aurai à la fin"],
    capitalDepart: ["Le montant à placer", "Le capital de départ"],
    versement: ["Le versement régulier", "Le montant à verser à chaque période"],
    duree: ["La durée nécessaire", "Le temps qu'il faut pour atteindre l'objectif"],
    taux: ["Le taux nécessaire", "Le rendement annuel qu'il faut"]
  };
  var AFFICHE = { capitalAcquis: "Capital acquis", capitalDepart: "Capital de départ", versement: "Versement régulier", duree: "Durée", taux: "Taux annuel" };
  var CHAMP_ID = { capitalAcquis: "ep-capitalAcquis", capitalDepart: "ep-capitalDepart", versement: "ep-versement", duree: "ep-ans", taux: "ep-taux", date: "ep-date", methode: "ep-methode", periodicite: "ep-periodicite", moment: "ep-moment", produit: "ep-produit" };
  var PAR_PERIODE = { mensuelle: "chaque mois", trimestrielle: "chaque trimestre", annuelle: "chaque année" };

  var params = VOL ? VOL.params("epargne") : new URLSearchParams(location.search);
  function etatInitial() {
    var o = { inconnue: "capitalAcquis", produit: "", methode: "compose", capitalAcquis: "10 000", capitalDepart: "1 000", versement: "100", periodicite: "mensuelle", moment: "fin", ans: "5", mois: "0", taux: "2,00", date: B.ymd(B.aujourdhui()),
      client: null, q: "", err: null, res: null, saisie: null, comp: null, perime: false };
    return o;
  }
  var etat = etatInitial();
  function choisirProduit(id) {
    etat.produit = id || "";
    /* Le taux reste toujours libre : choisir un produit ne le modifie pas (les taux qui évoluent sont communiqués dans la newsletter). */
    if (id === "CAT") {
      /* Compte à terme : dépôt unique, intérêts simples, taux fixe de la grille de la banque pour la durée choisie. */
      etat.methode = "simple"; etat.versement = "0";
      var mois = (parseInt(etat.ans, 10) || 0) * 12 + (parseInt(etat.mois, 10) || 0);
      if (!PR.catTaux[mois]) { etat.ans = "1"; etat.mois = "0"; mois = 12; }
      etat.taux = PR.catTaux[mois].toFixed(2).replace(".", ",");
    } else if (id) etat.methode = "quinzaines";
  }
  /* Bouton de la grille du compte à terme : reprend la durée et le taux de la ligne choisie. */
  function utiliserGrille(mois) {
    if (!PR.catTaux[mois]) return;
    if (etat.inconnue !== "duree") { etat.ans = String(Math.floor(mois / 12)); etat.mois = String(mois % 12); }
    if (etat.inconnue !== "taux") etat.taux = PR.catTaux[mois].toFixed(2).replace(".", ",");
  }
  function grilleCatHtml() {
    var ms = Object.keys(PR.catTaux).map(Number).sort(function (a, b) { return a - b; });
    return '<div class="ep-cat-grille" role="group" aria-label="Grille des taux du compte à terme"><p class="mention"><strong>Grille des taux du compte à terme</strong> (taux fixe brut par an, garanti pendant toute la durée)</p><ul class="ep-cat-liste">' + ms.map(function (m) {
      return '<li><button type="button" class="btn btn-secondaire" data-act="cat-grille" data-mois="' + m + '">' + esc(libDuree(m)) + " : " + esc(pct(PR.catTaux[m])) + "</button></li>";
    }).join("") + "</ul></div>";
  }
  if (EP.ORDRE_INCONNUES.indexOf(params.get("inconnue")) >= 0) etat.inconnue = params.get("inconnue");
  if (PAR_ID[params.get("produit")]) choisirProduit(params.get("produit")); else choisirProduit("LA");
  if (CLIENT[params.get("client")]) etat.client = parseInt(params.get("client"), 10);
  function client() { return etat.client ? CLIENT[etat.client] : null; }

  /* ---------- lecture de la saisie ---------- */
  function lireChamps() {
    ["capitalAcquis", "capitalDepart", "versement", "taux", "date", "ans", "mois"].forEach(function (k) {
      var f = document.getElementById("ep-" + (k === "date" ? "date" : k));
      if (f) etat[k] = f.value;
    });
    ["periodicite", "moment", "methode", "produit"].forEach(function (k) { var f = document.getElementById("ep-" + k); if (f) etat[k] = f.value; });
    var r = app.querySelector('input[name="ep-inc"]:checked'); if (r) etat.inconnue = r.value;
  }
  function saisie() {
    var a = etat.ans.trim() === "" ? 0 : EP.lireNombre(etat.ans), m = etat.mois.trim() === "" ? 0 : EP.lireNombre(etat.mois);
    var duree = isNaN(a) || isNaN(m) || a !== Math.floor(a) || m !== Math.floor(m) ? NaN : a * 12 + m;
    return { inconnue: etat.inconnue, methode: etat.methode, periodicite: etat.periodicite, moment: etat.moment, produit: etat.produit || null, capitalAcquis: etat.capitalAcquis, capitalDepart: etat.capitalDepart,
      versement: etat.versement, dureeMois: duree, taux: etat.taux, dateDepart: etat.date };
  }

  /* ---------- client concerné ---------- */
  function clientHtml() {
    var c = client(), h = '<div class="champ cl-q"><label for="cl-q">Rechercher un client (nom, prénom ou numéro)</label><input id="cl-q" type="search" autocomplete="off" maxlength="60" aria-controls="cl-res" value="' + esc(etat.q) + '"></div>' +
      '<ul id="cl-res" class="cl-res" hidden></ul><p id="cl-statut" class="sr" role="status"></p>';
    if (c) {
      h += '<div class="cl-choisi" id="cl-choisi" tabindex="-1"><p><strong>' + esc(nomFull(c)) + "</strong> – " + c.age + " ans – " + esc(c.pro.prof) + " – " + esc(c.num) + '</p>' + verdictHtml(c) +
        '<div class="pf-btns"><a class="btn btn-secondaire" href="client.html?id=' + c.id + '">Ouvrir la fiche client</a><button type="button" class="btn-texte" data-act="retirer-client">Retirer ce client</button></div></div>';
    } else h += '<p class="vide-bloc cl-aide">Facultatif : choisissez un client pour afficher son nom sur l\'impression et savoir s\'il peut ouvrir le produit choisi.</p>';
    return h;
  }
  function verdictHtml(c) {
    if (!etat.produit) return '<p class="sous">Choisissez un produit du catalogue pour voir si ce client peut l\'ouvrir.</p>';
    var ev = K.verdictClient(c, etat.produit, store()), cls = { eligible: "chip-ok", examiner: "chip-warn", non: "chip-bad", detenu: "chip-ctrl" }[ev.verdict];
    return '<p class="sous">' + esc(PAR_ID[etat.produit].nom) + " : " + '<span class="chip ' + cls + '">' + esc(ev.libelle) + '</span> <a href="catalogue.html?produit=' + etat.produit + "&amp;client=" + c.id + '">Voir le détail dans le catalogue</a></p>';
  }
  function majClient() { document.getElementById("z-client").innerHTML = clientHtml(); }
  function suggestions() {
    var z = document.getElementById("cl-res"), s = document.getElementById("cl-statut"), q = etat.q.trim();
    if (q.length < 2) { z.hidden = true; z.innerHTML = ""; s.textContent = ""; return; }
    var r = RECH.chercher(CL, q, 8);
    z.innerHTML = r.length ? r.map(function (c) { return '<li><button type="button" data-act="choisir-client" data-id="' + c.id + '"><span class="rech-nom">' + esc(nomListe(c)) + '</span><span class="rech-sous">' + c.age + " ans – " + esc(c.pro.prof) + " – " + esc(c.num) + "</span></button></li>"; }).join("") : '<li class="rech-vide">Aucun client trouvé</li>';
    s.textContent = r.length ? r.length + (r.length > 1 ? " résultats" : " résultat") : "Aucun résultat";
    z.hidden = false;
  }

  /* ---------- formulaire ---------- */
  function champ(cle, lib, aide, extra) {
    var err = etat.err && etat.err.champ === cle;
    return '<div class="champ" id="ch-' + cle + '"><label for="ep-' + cle + '">' + lib + '</label><input id="ep-' + cle + '" type="text" inputmode="decimal" autocomplete="off" value="' + esc(etat[cle]) + '"' + (extra || "") + (err ? ' aria-invalid="true" aria-describedby="ep-err"' : (aide ? ' aria-describedby="ep-aide-' + cle + '"' : "")) + ">" +
      (aide ? '<span class="aide-champ" id="ep-aide-' + cle + '">' + aide + "</span>" : "") + "</div>";
  }
  function options(liste, val) { return liste.map(function (o) { return '<option value="' + o[0] + '"' + (val === o[0] ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join(""); }
  function produitAide() {
    var p = PAR_ID[etat.produit];
    if (!p) return "Calcul libre : vous choisissez vous-même le taux. Il est supposé constant et brut, avant impôts.";
    return esc(p.nom) + " : " + (p.evolutif ? "taux en vigueur communiqué dans la newsletter, à saisir dans le champ « Taux annuel »" : "taux fixé par la banque, indiqué dans la fiche produit") + " – " + (p.plafond ? "plafond de dépôts " + eur(p.plafond).replace(",00", "") : "aucun plafond de dépôts") + " – dépôt minimum " + eur(p.minimum).replace(",00", "") + " – " + (p.exonere ? "intérêts exonérés d'impôt" : "intérêts imposables") + ".";
  }
  function formulaireHtml() {
    var inc = etat.inconnue, e = etat.err, h = "";
    h += '<fieldset class="ep-inconnue"><legend>Que voulez-vous calculer ?</legend><div class="ep-radios">' + EP.ORDRE_INCONNUES.map(function (k) {
      return '<label class="ep-radio"><input type="radio" name="ep-inc" value="' + k + '"' + (inc === k ? " checked" : "") + '><span><strong>' + LIB_INCONNUE[k][0] + "</strong><small>" + LIB_INCONNUE[k][1] + "</small></span></label>";
    }).join("") + "</div></fieldset>";
    h += '<div class="champ"><label for="ep-produit">' + (inc === "taux" ? "Comparer avec un produit du catalogue (facultatif)" : "Produit du catalogue (facultatif)") + '</label><select id="ep-produit" aria-describedby="ep-aide-produit">' +
      '<option value=""' + (!etat.produit ? " selected" : "") + ">" + "Aucun produit : calcul libre" + "</option>" +
      PRODUITS.map(function (p) { return '<option value="' + p.id + '"' + (etat.produit === p.id ? " selected" : "") + ">" + esc(p.nom.replace("Livret de développement durable et solidaire", "LDDS").replace("Livret d'épargne populaire", "LEP")) + "</option>"; }).join("") + '</select><span class="aide-champ" id="ep-aide-produit">' + produitAide() + "</span></div>" + (etat.produit === "CAT" ? grilleCatHtml() : "");
    h += '<div class="champ"><label for="ep-methode">Méthode de calcul des intérêts</label><select id="ep-methode" aria-describedby="ep-aide-methode">' + options(EP.ORDRE_METHODES.map(function (m) { return [m, EP.METHODES[m]]; }), etat.methode) + '</select><span class="aide-champ" id="ep-aide-methode">' + {
      simple: "Les intérêts ne produisent pas d'intérêts : on les utilise pour des placements de moins d'un an.",
      compose: "Les intérêts s'ajoutent au capital et produisent eux-mêmes des intérêts (taux équivalent pour les périodes plus courtes que l'année).",
      quinzaines: "Règle des livrets : un dépôt rapporte à partir du 1er ou du 16 qui suit, un retrait cesse de rapporter à la fin de la quinzaine précédente, intérêts ajoutés au capital le 31 décembre."
    }[etat.methode] + "</span></div>";
    if (inc !== "capitalAcquis") h += champ("capitalAcquis", "Capital à obtenir (€) *", "Le montant visé à la fin de l'épargne.");
    if (inc !== "capitalDepart") h += champ("capitalDepart", "Capital de départ (€) *", "0 si vous partez de rien.");
    if (inc !== "versement") {
      h += champ("versement", "Versement régulier (€) *", "0 s'il n'y a pas de versement régulier.") +
        '<div class="ligne ep-ligne2"><div class="champ"><label for="ep-periodicite">Versé</label><select id="ep-periodicite">' + options(EP.ORDRE_PERIODES.map(function (p) { return [p, EP.PERIODES[p].lib]; }), etat.periodicite) + '</select></div>' +
        '<div class="champ"><label for="ep-moment">Moment du versement</label><select id="ep-moment">' + options([["fin", "En fin de période"], ["debut", "En début de période"]], etat.moment) + "</select></div></div>";
    } else {
      h += '<div class="ligne ep-ligne2"><div class="champ"><label for="ep-periodicite">Le versement sera fait</label><select id="ep-periodicite">' + options(EP.ORDRE_PERIODES.map(function (p) { return [p, EP.PERIODES[p].lib]; }), etat.periodicite) + '</select></div>' +
        '<div class="champ"><label for="ep-moment">Moment du versement</label><select id="ep-moment">' + options([["fin", "En fin de période"], ["debut", "En début de période"]], etat.moment) + "</select></div></div>";
    }
    if (inc !== "duree") {
      var errD = e && e.champ === "duree";
      h += '<div class="champ ep-duree" role="group" aria-labelledby="ep-lib-duree"><span class="ep-lib" id="ep-lib-duree">Durée *</span><div class="ep-duree-champs"><label class="sr" for="ep-ans">Années</label><input id="ep-ans" type="text" inputmode="numeric" autocomplete="off" value="' + esc(etat.ans) + '"' + (errD ? ' aria-invalid="true" aria-describedby="ep-err"' : "") + '><span aria-hidden="true">ans</span>' +
        '<label class="sr" for="ep-mois">Mois</label><input id="ep-mois" type="text" inputmode="numeric" autocomplete="off" value="' + esc(etat.mois) + '"' + (errD ? ' aria-invalid="true" aria-describedby="ep-err"' : "") + '><span aria-hidden="true">mois</span></div><span class="aide-champ">De 1 mois à 50 ans. Avec des versements, un nombre entier de périodes.</span></div>';
    }
    if (inc !== "taux") {
      h += '<div class="champ" id="ch-taux"><label for="ep-taux">Taux annuel (%) *</label><input id="ep-taux" type="text" inputmode="decimal" autocomplete="off" value="' + esc(etat.taux) + '"' + (e && e.champ === "taux" ? ' aria-invalid="true" aria-describedby="ep-err"' : ' aria-describedby="ep-aide-taux"') + '><span class="aide-champ" id="ep-aide-taux">' +
        "Taux libre, entre 0 % et 30 %, deux décimales au plus (exemple : 1,7). Supposé constant. " +
        (etat.produit === "CAT" ? "Reprenez le taux de la grille pour la durée choisie (boutons ci-dessus)" : etat.produit && PAR_ID[etat.produit].evolutif ? "Saisissez le taux en vigueur communiqué dans la newsletter" : etat.produit ? "Reprenez le taux indiqué dans la fiche produit" : "Saisissez le taux de votre hypothèse") + " ; la valeur affichée au départ n'est qu'un exemple.</span></div>";
    }
    if (etat.methode === "quinzaines") {
      h += '<div class="champ" id="ch-date"><label for="ep-date">Date du dépôt de départ *</label><input id="ep-date" type="date" min="2000-01-01" max="2100-12-31" value="' + esc(etat.date) + '"' + (e && e.champ === "date" ? ' aria-invalid="true" aria-describedby="ep-err"' : ' aria-describedby="ep-aide-date"') + '><span class="aide-champ" id="ep-aide-date">Les intérêts dépendent du jour : le retrait est supposé le même jour du mois, à la fin de la durée, avec les versements le même jour de chaque période.</span></div>';
    }
    h += '<p class="msg-erreur" id="ep-err" role="alert">' + (e ? esc(e.erreur) : "") + "</p>" +
      '<div class="pf-btns"><button type="submit" class="btn btn-principal">Calculer</button><button type="button" class="btn-texte" data-act="exemple">Remettre l\'exemple</button></div>';
    return h;
  }
  function majFormulaire(focusId) {
    document.getElementById("ep-form").innerHTML = formulaireHtml();
    var f = focusId && document.getElementById(focusId); if (f) f.focus();
  }

  /* ---------- résultat ---------- */
  function libDuree(m) { return EP.libDuree(m); }
  function dureeLong(m) { return libDuree(m) + (m >= 12 && m % 12 ? " (" + m + " mois)" : ""); }
  function descVers(e) { return e.versement > 0 ? eur(e.versement) + " " + PAR_PERIODE[e.periodicite] + (e.moment === "debut" ? " (au début de la période)" : " (à la fin de la période)") : null; }
  function phrase(r) {
    var e = r.e, inc = r.inconnue, v = descVers(e), dep = e.capitalDepart > 0 ? "un capital de départ de " + eur(e.capitalDepart) : null, tx = pct(e.taux) + " par an", d = dureeLong(e.dureeMois);
    var avec = [dep, v ? "des versements de " + v : null].filter(Boolean).join(" et ");
    if (inc === "capitalAcquis") return "En plaçant " + (avec || "rien") + ", pendant " + d + ", à " + tx + ", vous obtiendrez " + eur(r.capitalObtenu) + ".";
    if (inc === "capitalDepart") return "Pour obtenir " + eur(e.capitalAcquis) + " au bout de " + d + ", à " + tx + (v ? ", avec des versements de " + v : "") + ", il faut placer " + eur(e.capitalDepart) + " au départ.";
    if (inc === "versement") return "Pour obtenir " + eur(e.capitalAcquis) + " au bout de " + d + ", à " + tx + (dep ? ", avec " + dep : ", sans capital de départ") + ", il faut verser " + eur(e.versement) + " " + PAR_PERIODE[e.periodicite] + (e.moment === "debut" ? " (au début de la période)." : " (à la fin de la période).");
    if (inc === "duree") return "Pour obtenir " + eur(e.capitalAcquis) + ", à " + tx + (avec ? ", avec " + avec : "") + ", il faut épargner pendant " + dureeLong(e.dureeMois) + ".";
    return "Pour obtenir " + eur(e.capitalAcquis) + " au bout de " + d + (avec ? ", avec " + avec : "") + ", il faut un taux de " + tx + ".";
  }
  function kpi(cle, lib, val, det, inc) {
    return '<div class="kpi' + (inc === cle ? " kpi-inconnue" : "") + '"><dt>' + esc(lib) + (inc === cle ? ' <span class="puce puce-ok">Résultat cherché</span>' : "") + '</dt><dd class="val">' + val + "</dd>" + (det ? '<dd class="det">' + det + "</dd>" : "") + "</div>";
  }
  function kpisHtml(r) {
    var e = r.e, inc = r.inconnue, p = r.p;
    return '<dl class="kpis ep-kpis">' +
      kpi("capitalAcquis", "Capital acquis", esc(eur(r.capitalObtenu)), inc === "capitalAcquis" ? "versements + intérêts" : "objectif : " + esc(eur(e.capitalAcquis)), inc) +
      kpi("capitalDepart", "Capital de départ", esc(eur(e.capitalDepart)), e.capitalDepart > 0 ? "" : "rien au départ", inc) +
      kpi("versement", "Versement régulier", esc(eur(e.versement)), e.versement > 0 ? esc(PAR_PERIODE[e.periodicite] + (e.moment === "debut" ? ", au début" : ", à la fin")) : "aucun", inc) +
      kpi("duree", "Durée", esc(libDuree(e.dureeMois)), e.dureeMois + " mois", inc) +
      kpi("taux", "Taux annuel", esc(pct(e.taux)), esc(EP.METHODES[e.methode]) + (p ? " – " + esc(p.code) : ""), inc) +
      kpi("verses", "Total versé", esc(eur(r.verses)), "départ + versements", inc) +
      kpi("interets", "Intérêts acquis", esc(eur(r.interets)), r.net !== null ? "bruts, avant impôts" : (p && p.exonere ? "exonérés d'impôt" : "bruts, avant impôts"), inc) + "</dl>";
  }
  function alertesHtml(r) {
    return '<ul class="ep-alertes">' + r.alertes.map(function (a) {
      return '<li class="ep-al ep-al-' + a.n + '"><span class="ep-al-ico">' + (a.n === "attention" ? ICO.alerte : ICO.info) + '</span><span><strong>' + (a.n === "attention" ? "Attention : " : "À savoir : ") + "</strong>" + esc(a.t) + "</span></li>";
    }).join("") + "</ul>";
  }
  function tableau(titre, tete, lignes, cls) {
    return '<div class="tab-wrap tab-defile" role="region" aria-label="' + esc(titre) + '" tabindex="0"><table class="tab tab-cg bl-tab ' + (cls || "") + '"><caption class="sr">' + esc(titre) + "</caption><thead><tr>" + tete.map(function (t, i) { return '<th scope="col"' + (i === 0 ? ' class="gauche"' : "") + ">" + esc(t) + "</th>"; }).join("") + "</tr></thead><tbody>" + lignes.join("") + "</tbody></table></div>";
  }
  function tabEvolution(r) {
    return '<h3 class="sous-titre">Évolution du capital</h3>' + tableau("Évolution du capital", ["Date", "Total versé", "Intérêts acquis", "Capital"], r.lignes.map(function (l) {
      return '<tr' + (l.fin ? ' class="bl-total"' : "") + '><th scope="row" class="gauche">' + esc(l.lib) + "</th><td>" + esc(eur(l.verses)) + "</td><td>" + esc(eur(l.interets)) + "</td><td>" + esc(eur(l.capital)) + "</td></tr>";
    }), "ep-tab") + '<p class="mention">' + (r.e.methode === "quinzaines" ? "Les intérêts de chaque année sont ajoutés au capital le 31 décembre ; la dernière ligne ajoute ceux de l'année en cours à la date de fin." : "Capital acquis aux dates anniversaires, puis à la fin de la durée.") + "</p>";
  }
  function valeurTxt(inc, x) { return inc === "capitalAcquis" || inc === "capitalDepart" || inc === "versement" ? eur(x) : inc === "duree" ? libDuree(x) : pct(x); }
  function tabComparaison(r) {
    var inc = r.inconnue, avecVal = inc !== "capitalAcquis", tete = ["Méthode"].concat(avecVal ? [AFFICHE[inc]] : [], ["Intérêts acquis", "Capital acquis"]);
    var l = etat.comp.map(function (c) {
      var utilisee = c.methode === r.e.methode, nom = esc(EP.METHODES[c.methode]) + (utilisee ? ' <span class="puce">Méthode utilisée</span>' : "");
      if (!c.ok) return '<tr><th scope="row" class="gauche">' + nom + '</th><td class="gauche" colspan="' + (tete.length - 1) + '">' + esc(c.erreur) + "</td></tr>";
      return '<tr' + (utilisee ? ' class="ep-utilisee"' : "") + '><th scope="row" class="gauche">' + nom + "</th>" + (avecVal ? "<td>" + esc(valeurTxt(inc, c.valeur)) + "</td>" : "") + "<td>" + esc(eur(c.interets)) + "</td><td>" + esc(eur(c.capital)) + "</td></tr>";
    });
    return '<h3 class="sous-titre">Le même calcul avec les trois méthodes</h3>' + tableau("Comparaison des trois méthodes de calcul des intérêts", tete, l, "ep-tab") +
      '<p class="mention">Mêmes données dans les trois lignes, seule la méthode change. Au-delà d\'un an, les intérêts composés rapportent plus que les intérêts simples ; en dessous d\'un an, c\'est l\'inverse.</p>';
  }
  function detailHtml(r) {
    return '<details class="ep-details" id="ep-det"><summary>Voir le calcul détaillé</summary><ol class="ep-calc">' + r.detail.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") +
      '</ol><p class="mention">Le signe ^ veut dire « puissance » : (1 + 0,025)^5 = 1,025 × 1,025 × 1,025 × 1,025 × 1,025. Les montants sont arrondis au centime.</p></details>';
  }
  function resultatHtml() {
    var r = etat.res;
    if (!r) return '<section class="bloc ep-res" aria-labelledby="ep-t-res"><div class="bloc-tete"><h2 id="ep-t-res" tabindex="-1">Résultat</h2></div><p class="vide-bloc" id="ep-vide">' + (etat.err ? "Corrigez la saisie signalée en rouge, puis cliquez sur « Calculer »." : "Choisissez ce que vous cherchez, renseignez les données puis cliquez sur « Calculer ». Les valeurs proposées sont un exemple : remplacez-les par les vôtres.") + "</p></section>";
    return '<section class="bloc ep-res" aria-labelledby="ep-t-res"><div class="bloc-tete"><h2 id="ep-t-res" tabindex="-1">Résultat</h2><span class="ag-outils"><button type="button" class="btn btn-secondaire btn-impr" data-act="imprimer">' + ICO.imprimante + "<span>Imprimer ou PDF</span></button></span></div>" +
      '<p class="ep-perime-msg" id="ep-perime" role="status" hidden>Les données ont changé depuis ce calcul : cliquez sur « Calculer » pour mettre le résultat à jour.</p><div id="ep-corps">' +
      '<p class="ep-phrase" id="ep-phrase">' + esc(phrase(r)) + "</p>" + kpisHtml(r) + alertesHtml(r) + detailHtml(r) + tabEvolution(r) + tabComparaison(r) + "</div></section>";
  }
  function majResultat() { document.getElementById("z-resultat").innerHTML = resultatHtml(); }

  /* ---------- impression ---------- */
  function dpTable(tete, lignes) { return '<table class="dp-pf dp-ep"><thead><tr>' + tete.map(function (t) { return '<th scope="col">' + esc(t) + "</th>"; }).join("") + "</tr></thead><tbody>" + lignes.join("") + "</tbody></table>"; }
  function docSimulation() {
    var r = etat.res; if (!r) return;
    var e = r.e, inc = r.inconnue, c = client(), st = store(), corps = "";
    corps += '<section class="dp-bloc"><h2>Résultat</h2><p class="dp-texte">' + esc(phrase(r)) + "</p></section>";
    corps += '<section class="dp-bloc"><h2>Données de la simulation</h2><dl class="dp-fiche"><dt>Calcul demandé</dt><dd>' + esc(LIB_INCONNUE[inc][0]) + "</dd><dt>Produit</dt><dd>" + esc(r.p ? r.p.nom : "Taux libre") + "</dd><dt>Méthode</dt><dd>" + esc(EP.METHODES[e.methode]) + "</dd>" +
      "<dt>Capital de départ</dt><dd>" + esc(eur(e.capitalDepart)) + "</dd><dt>Versement régulier</dt><dd>" + esc(e.versement > 0 ? descVers(e) : "aucun") + "</dd><dt>Durée</dt><dd>" + esc(dureeLong(e.dureeMois)) + "</dd><dt>Taux annuel</dt><dd>" + esc(pct(e.taux)) + "</dd>" +
      (e.methode === "quinzaines" ? "<dt>Dépôt de départ</dt><dd>" + esc(B.fmtDate(B.lireYmd(e.dateDepart))) + "</dd>" : "") + "<dt>Capital visé</dt><dd>" + esc(inc === "capitalAcquis" ? "à calculer" : eur(e.capitalAcquis)) + "</dd></dl></section>";
    corps += '<section class="dp-bloc"><h2>Résultats</h2><dl class="dp-chiffres"><div><dt>Capital de départ</dt><dd>' + esc(eur(e.capitalDepart)) + "</dd></div><div><dt>Total versé</dt><dd>" + esc(eur(r.verses)) + "</dd></div><div><dt>Intérêts acquis</dt><dd>" + esc(eur(r.interets)) + "</dd></div><div><dt>Capital acquis</dt><dd>" + esc(eur(r.capitalObtenu)) + "</dd></div></dl></section>";
    corps += '<section class="dp-bloc"><h2>Évolution du capital</h2>' + dpTable(["Date", "Total versé", "Intérêts acquis", "Capital"], r.lignes.map(function (l) { return '<tr><td>' + esc(l.lib) + '</td><td>' + esc(eur(l.verses)) + '</td><td>' + esc(eur(l.interets)) + '</td><td>' + esc(eur(l.capital)) + "</td></tr>"; })) + "</section>";
    var avecVal = inc !== "capitalAcquis";
    corps += '<section class="dp-bloc"><h2>Le même calcul avec les trois méthodes</h2>' + dpTable(["Méthode"].concat(avecVal ? [AFFICHE[inc]] : [], ["Intérêts acquis", "Capital acquis"]), etat.comp.map(function (x) {
      return x.ok ? '<tr><td>' + esc(EP.METHODES[x.methode]) + (x.methode === e.methode ? " (utilisée)" : "") + "</td>" + (avecVal ? '<td>' + esc(valeurTxt(inc, x.valeur)) + "</td>" : "") + '<td>' + esc(eur(x.interets)) + '</td><td>' + esc(eur(x.capital)) + "</td></tr>" :
        '<tr><td>' + esc(EP.METHODES[x.methode]) + '</td><td class="g" colspan="' + (avecVal ? 3 : 2) + '">' + esc(x.erreur) + "</td></tr>";
    })) + "</section>";
    corps += '<section class="dp-bloc"><h2>Calcul détaillé</h2><ul class="dp-liste">' + r.detail.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul></section>";
    corps += '<section class="dp-bloc"><h2>Points d\'attention</h2><ul class="dp-liste">' + r.alertes.map(function (a) { return "<li>" + esc((a.n === "attention" ? "Attention : " : "") + a.t) + "</li>"; }).join("") + '</ul><p class="dp-mention">Simulation à titre indicatif, sans valeur contractuelle : elle suppose un taux constant, aucun retrait avant la date de fin, et des intérêts bruts (avant impôts et prélèvements sociaux, sauf livrets exonérés). Règles et taux des livrets réglementés en vigueur à l\'automne 2026.</p></section>';
    IMP.imprimer(IMP.document({ titre: "Simulation d'épargne", sous: c ? nomFull(c) + " – " + c.num : "Agence de Paris", corps: corps }), IMP.nomFichier("Simulation_epargne_" + (c ? c.nom + "_" : "") + (r.p ? r.p.code + "_" : "") + EP.METHODES[e.methode]));
  }

  /* ---------- page ---------- */
  function render() {
    app.innerHTML = '<section class="bloc ep-client" aria-labelledby="ep-t-client"><div class="bloc-tete"><h2 id="ep-t-client">Client concerné</h2></div><div id="z-client">' + clientHtml() + "</div></section>" +
      '<div class="ep-grille"><section class="bloc ep-form-bloc" aria-labelledby="ep-t-form"><div class="bloc-tete"><h2 id="ep-t-form">Mon calcul</h2></div><form class="formulaire ep-form" id="ep-form" novalidate>' + formulaireHtml() + '</form></section><div id="z-resultat">' + resultatHtml() + "</div></div>" +
      '<p class="mention" style="margin-top:16px">Simulation à titre indicatif, sans valeur contractuelle. Hypothèses : taux constant sur toute la durée, aucun retrait avant la date de fin, intérêts bruts avant impôts. Plafonds et règles des livrets : ceux en vigueur à l\'automne 2026. Les taux évoluant, le simulateur n\'en impose aucun : le taux utilisé est celui que vous saisissez (pour les livrets réglementés, le taux en vigueur communiqué dans la newsletter).</p>';
  }
  function marquerPerime() {
    if (!etat.res || etat.perime) return;
    etat.perime = true;
    var m = document.getElementById("ep-perime"), c = document.getElementById("ep-corps");
    if (m) m.hidden = false; if (c) c.classList.add("ep-perime");
  }
  function calculer() {
    lireChamps();
    var s = saisie(), r = EP.calculer(s);
    etat.perime = false;
    if (!r.ok) {
      etat.err = r; etat.res = null; etat.comp = null;
      majFormulaire(); majResultat();
      var f = document.getElementById(CHAMP_ID[r.champ] || ""); if (f) f.focus(); else { var z = document.getElementById("ep-err"); if (z) z.scrollIntoView({ block: "center" }); }
      return;
    }
    etat.err = null; etat.res = r; etat.saisie = s; etat.comp = EP.comparer(s);
    majFormulaire(); majResultat();
    var h = document.getElementById("ep-t-res"); if (h) { h.scrollIntoView({ block: "start" }); h.focus(); }
  }

  /* ---------- événements ---------- */
  app.addEventListener("change", function (e) {
    var t = e.target;
    if (t.name === "ep-inc") {
      lireChamps(); etat.err = null; etat.res = null; etat.comp = null; etat.perime = false;
      majFormulaire(); majResultat(); var r = app.querySelector('input[name="ep-inc"]:checked'); if (r) r.focus();
    } else if (t.id === "ep-produit") {
      lireChamps(); choisirProduit(t.value); etat.err = null; marquerPerime(); majFormulaire("ep-produit"); majClient();
    } else if (t.id === "ep-methode") {
      lireChamps(); etat.err = null; marquerPerime(); majFormulaire("ep-methode");
    } else if (t.closest("#ep-form")) marquerPerime();
  });
  app.addEventListener("input", function (e) {
    var t = e.target;
    if (t.id === "cl-q") { etat.q = t.value; suggestions(); return; }
    if (t.closest("#ep-form") && t.tagName !== "SELECT") { marquerPerime(); if (etat.err) { etat.err = null; var z = document.getElementById("ep-err"); if (z) z.textContent = ""; app.querySelectorAll("#ep-form [aria-invalid]").forEach(function (x) { x.removeAttribute("aria-invalid"); }); } }
  });
  app.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    var a = b.getAttribute("data-act");
    if (a === "imprimer") docSimulation();
    else if (a === "cat-grille") { lireChamps(); utiliserGrille(parseInt(b.getAttribute("data-mois"), 10)); etat.err = null; marquerPerime(); majFormulaire(); var g = app.querySelector('[data-act="cat-grille"][data-mois="' + b.getAttribute("data-mois") + '"]'); if (g) g.focus(); }
    else if (a === "exemple") { var inc = etat.inconnue, p = etat.produit, cl = etat.client; etat = etatInitial(); etat.inconnue = inc; etat.client = cl; choisirProduit(p); render(); }
    else if (a === "choisir-client") { etat.client = parseInt(b.getAttribute("data-id"), 10); etat.q = ""; majClient(); var z = document.getElementById("cl-choisi"); if (z) z.focus(); }
    else if (a === "retirer-client") { etat.client = null; etat.q = ""; majClient(); var q = document.getElementById("cl-q"); if (q) q.focus(); }
  });
  app.addEventListener("submit", function (e) { e.preventDefault(); if (e.target.id === "ep-form") calculer(); });

  render();
})();
