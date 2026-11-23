/* GS Banque & Assurance – portefeuille clients : recherche, filtres, tris, éligibilité à un produit, sélection d'une cible, cibles enregistrées, impression et PDF. */
(function () {
  "use strict";

  var B = window.SGBF.banque, PR = window.SGBF.produits, ICO = window.SGBF.icones, RECH = window.SGBF.recherche, IMP = window.SGBF.impression, P = window.SGBF.portefeuille, CL = window.SGBF.clients;
  var VOL = window.SGBF.volets;
  var app = (VOL && VOL.panneau("clients")) || document.getElementById("app");
  var esc = B.esc;
  var NB_PAGE = 25;

  function pl(n, s, p) { return B.nb(n) + " " + (n > 1 ? p : s); }
  function store() { return B.store.charger(); }
  function minus(l) { return l.charAt(0).toLowerCase() + l.slice(1); }
  function ageMoy(x) { return B.nb(Math.round(x)) + " ans"; }

  var params = VOL ? VOL.params("clients") : new URLSearchParams(location.search), brut = {};
  params.forEach(function (v, k) { brut[k] = v; });
  var etat = { f: P.nettoyer(brut), tri: "nom", sens: 1, nb: NB_PAGE, sel: {}, cible: null, source: "auto", nom: "", note: "", err: "", msg: "", edition: null, editNom: "", editNote: "", editErr: "", confirmer: null };
  if (params.get("cible") && P.trouverCible(store(), params.get("cible"))) etat.cible = params.get("cible");

  /* ---------- données affichées ---------- */
  function calcul() {
    var st = store(), cible = etat.cible ? P.trouverCible(st, etat.cible) : null;
    if (etat.cible && !cible) etat.cible = null;
    var tous = cible ? P.lignesCible(st, cible) : P.lignes(st);
    return { st: st, cible: cible, tous: tous, filtrees: P.trier(P.filtrer(tous, etat.f), etat.tri, etat.sens) };
  }
  function nbCoches() { return Object.keys(etat.sel).length; }
  function idsCoches(tous) { var m = {}; tous.forEach(function (r) { m[r.id] = true; }); return Object.keys(etat.sel).map(Number).filter(function (i) { return m[i]; }); }

  /* ---------- petits éléments ---------- */
  var CODES = {}; P.OPP.forEach(function (o) { CODES[o.v] = o.lib; });
  function ilYa(j) {
    if (j === null) return "Aucun contact enregistré";
    if (j === 0) return "aujourd'hui";
    if (j < 60) return "il y a " + j + " jour" + (j > 1 ? "s" : "");
    if (j < 730) return "il y a " + Math.round(j / 30.4) + " mois";
    return "il y a " + Math.floor(j / 365.25) + " ans";
  }
  /* ICC : libellé court du niveau (« Rouge » … « Vert+ »), avec sa couleur ; « Sociétaire » en complément quand le client détient des parts sociales. */
  function iccTexte(r) { var n = r.icc === null ? null : P.ICC_PAR_CODE[r.icc]; return n ? n.lib.replace(/^ICC /, "").replace(/^./, function (x) { return x.toUpperCase(); }) + (r.societaire ? " – sociétaire" : "") : "–"; }
  function iccCell(r) {
    var n = r.icc === null ? null : P.ICC_PAR_CODE[r.icc];
    return n ? '<span class="icc-puce icc-' + n.v + '">' + esc(iccTexte(r).split(" – ")[0]) + "</span>" + (r.societaire ? '<span class="pf-sous">Sociétaire</span>' : "") : "–";
  }
  function arrLib(n) { return n === 1 ? "Paris 1er" : "Paris " + n + "e"; }
  function contactCell(r) { return r.dernier === null ? "Aucun" : esc(B.fmtDate(r.dernierDate)) + '<span class="pf-sous">' + esc(ilYa(r.dernier)) + "</span>"; }
  function oppCell(r) {
    if (!r.opps.length) return '<span class="pf-sous">Aucune</span>';
    return r.opps.map(function (o) { return '<span class="piste-chip">' + esc(CODES[o.code] || o.titre) + "</span>"; }).join(" ");
  }

  /* ---------- zone : recherche et filtres ---------- */
  function selectCritere(k) {
    return '<div class="champ"><label for="f-' + k.id + '">' + esc(k.lib) + '</label><select id="f-' + k.id + '" data-f="' + k.id + '"><option value="">Tous</option>' +
      k.options.map(function (o) { return '<option value="' + esc(o.v) + '">' + esc(o.lib) + "</option>"; }).join("") + "</select></div>";
  }
  function selectProduit() {
    var h = '<option value="">Aucun produit</option>';
    PR.univers.forEach(function (f) {
      h += '<optgroup label="' + esc(f.nom) + '">' + PR.produits.filter(function (p) { return PR.universDe(p) === f; }).map(function (p) { return '<option value="' + p.id + '">' + esc(p.nom) + "</option>"; }).join("") + "</optgroup>";
    });
    return h;
  }
  function blocFiltres() {
    return '<section class="bloc" aria-labelledby="t-pf-rech"><div class="bloc-tete"><h2 id="t-pf-rech">Rechercher et filtrer</h2><span class="sous">Les filtres se cumulent : un client doit les respecter tous</span></div>' +
      '<div class="champ pf-q"><label for="pf-q">Nom, prénom, numéro client, profession ou ville</label><input id="pf-q" type="search" maxlength="80" autocomplete="off" placeholder="Exemple : Dupont, infirmière, Paris 11"></div>' +
      '<details class="detail-ventes pf-details" open><summary>Filtres <span class="pf-nbf" id="pf-nbf"></span></summary><div class="pf-corps">' +
      '<div class="pf-grille">' + P.CRITERES.map(selectCritere).join("") + "</div>" +
      '<fieldset class="pf-produit"><legend>Éligibilité à un produit</legend><div class="pf-grille pf-grille-2">' +
      '<div class="champ"><label for="f-produit">Produit</label><select id="f-produit" data-f="produit">' + selectProduit() + "</select></div>" +
      '<div class="champ"><label for="f-situation">Clients à afficher</label><select id="f-situation" data-f="situation">' + P.SITUATIONS.map(function (s) { return '<option value="' + s.v + '">' + esc(s.lib) + "</option>"; }).join("") + "</select></div></div>" +
      '<p class="aide-champ">« Éligibles » : toutes les conditions vérifiables dans le dossier sont remplies et le client ne détient pas déjà le produit. « À examiner » : aucune condition n\'est refusée mais une ne peut pas être tranchée sans le client. Le détail est dans le catalogue de produits.</p></fieldset></div></details>' +
      '<div id="pf-puces" class="pf-puces-zone"></div>' +
      '<div class="pf-tri"><div class="champ"><label for="pf-tri">Trier par</label><select id="pf-tri">' + P.TRIS.map(function (t) { return '<option value="' + t.id + '">' + esc(t.lib) + "</option>"; }).join("") + "</select></div>" +
      '<div class="champ"><label for="pf-sens">Ordre</label><select id="pf-sens"><option value="1">Croissant (A à Z, 0 à 9)</option><option value="-1">Décroissant (Z à A, 9 à 0)</option></select></div></div></section>';
  }
  function syncFiltres() {
    Array.prototype.forEach.call(app.querySelectorAll("[data-f]"), function (el) { el.value = etat.f[el.getAttribute("data-f")]; });
    var q = document.getElementById("pf-q"); if (q && q.value !== etat.f.q) q.value = etat.f.q;
    document.getElementById("f-situation").disabled = !etat.f.produit;
    document.getElementById("pf-tri").value = etat.tri;
    document.getElementById("pf-sens").value = String(etat.sens);
    var n = P.nbFiltres(etat.f), z = document.getElementById("pf-nbf");
    z.textContent = n ? "(" + pl(n, "actif", "actifs") + ")" : "";
  }
  function puces() {
    var d = P.decrire(etat.f);
    if (!d.length) return '<p class="sous pf-aucun">Aucun filtre : tous les clients' + (etat.cible ? " de la cible" : " du portefeuille") + " sont affichés.</p>";
    return '<ul class="pf-puces" aria-label="Filtres actifs">' + d.map(function (x) {
      return "<li><span>" + esc(x.txt) + '</span><button type="button" class="pf-x" data-act="ret-filtre" data-id="' + x.id + '" aria-label="Retirer le filtre : ' + esc(x.txt) + '"><span aria-hidden="true">×</span></button></li>';
    }).join("") + '</ul><button type="button" class="btn-texte" data-act="effacer">Effacer tous les filtres</button>';
  }

  /* ---------- zone : résultat ---------- */
  function resumeHtml(res) {
    var r = P.resume(res);
    if (!r.n) return "";
    return '<dl class="kpis pf-kpis"><div class="kpi"><dt>Âge moyen</dt><dd class="val">' + ageMoy(r.age) + '</dd></div><div class="kpi"><dt>Revenus mensuels moyens du foyer</dt><dd class="val">' + B.eur(r.foyer) + '</dd></div>' +
      '<div class="kpi"><dt>Encours moyen (épargne et placements)</dt><dd class="val">' + B.eur(r.encours) + '</dd><dd class="det">Total : ' + B.eurK(r.encoursTotal) + '</dd></div><div class="kpi"><dt>Avec au moins une opportunité</dt><dd class="val">' + B.nb(r.avecOpp) + '</dd><dd class="det">sur ' + B.nb(r.n) + " (" + B.pct(Math.round(1000 * r.avecOpp / r.n) / 10) + ")</dd></div></dl>";
  }
  function ligneHtml(r) {
    var c = r.c, nom = c.civ + " " + c.prenom + " " + c.nom.toUpperCase(), coche = !!etat.sel[r.id];
    return '<tr class="' + (coche ? "pf-coche-oui" : "") + '"><td class="pf-coche"><input type="checkbox" data-id="' + r.id + '"' + (coche ? " checked" : "") + ' aria-label="Cocher ' + esc(nom) + '"></td>' +
      '<th scope="row"><a href="client.html?id=' + r.id + '">' + esc(c.nom.toUpperCase() + " " + c.prenom) + '</a><span class="pf-sous">' + esc(c.num) + "</span></th>" +
      '<td data-label="Âge">' + r.age + ' ans</td>' +
      '<td data-label="Profession" class="gauche">' + esc(c.pro.prof) + '<span class="pf-sous">' + esc(window.SGBF.analyse.GROUPES[r.pcs - 1].court) + "</span></td>" +
      '<td data-label="Arrondissement" class="gauche">' + arrLib(r.arr) + "</td>" +
      '<td data-label="Revenus du foyer">' + B.eur(r.foyer) + "</td>" +
      '<td data-label="Produits à GS">' + r.nbProduits + "</td>" +
      '<td data-label="ICC" class="gauche">' + iccCell(r) + "</td>" +
      '<td data-label="Encours">' + B.eur(r.encours) + "</td>" +
      '<td data-label="Opportunités" class="gauche">' + oppCell(r) + "</td>" +
      '<td data-label="Dernier contact" class="gauche">' + contactCell(r) + "</td>" +
      '<td class="pf-act"><a href="client.html?id=' + r.id + '" aria-label="Ouvrir la fiche de ' + esc(nom) + '">Fiche</a><a href="agenda.html?client=' + r.id + '" aria-label="Agenda : planifier un rendez-vous ou un rappel avec ' + esc(nom) + '">Agenda</a><a href="catalogue.html?client=' + r.id + '" aria-label="Voir les produits et l\'éligibilité de ' + esc(nom) + '">Produits</a></td></tr>';
  }
  function tableauHtml(l) {
    return '<div class="tab-wrap tab-defile" tabindex="0" role="region" aria-label="Tableau des clients : faites-le défiler pour voir toutes les colonnes"><table class="tab-ventes tab-pf"><caption class="sr">Clients du résultat : ' + pl(l.length, "client", "clients") + ', classés selon « ' + esc(minus(P.TRIS.filter(function (t) { return t.id === etat.tri; })[0].lib)) + ' »</caption>' +
      '<thead><tr><th scope="col"><span class="sr">Cocher</span></th><th scope="col">Client</th><th scope="col">Âge</th><th scope="col">Profession</th><th scope="col">Arrondissement</th><th scope="col">Revenus mensuels du foyer</th><th scope="col">Produits à GS</th><th scope="col"><abbr title="Indice de commercialité client">ICC</abbr></th><th scope="col">Encours</th><th scope="col">Opportunités</th><th scope="col">Dernier contact</th><th scope="col"><span class="sr">Ouvrir</span></th></tr></thead><tbody>' +
      l.slice(0, etat.nb).map(ligneHtml).join("") + "</tbody></table></div>";
  }
  function banniereCible(cb, nbTous) {
    if (!cb) return "";
    return '<div class="pf-vue-cible"><p><strong>Cible « ' + esc(cb.nom) + " »</strong> – " + pl(nbTous, "client", "clients") + ", enregistrée le " + esc(B.fmtDate(B.lireYmd(cb.creee))) + '. Les filtres s\'appliquent aux clients de la cible.</p>' +
      '<button type="button" class="btn btn-secondaire" data-act="quitter-cible">Revenir à tout le portefeuille</button></div>';
  }
  function resultatHtml(k) {
    var l = k.filtrees, h = banniereCible(k.cible, k.tous.length);
    if (!l.length) {
      return h + '<p class="vide-bloc pf-vide">Aucun client ne correspond à ces filtres. Retirez un filtre ou élargissez la recherche.</p>';
    }
    var vus = Math.min(l.length, etat.nb), reste = l.length - vus;
    h += resumeHtml(l);
    h += '<div class="pf-barre" role="group" aria-label="Sélection de clients"><p class="pf-sel-txt" id="pf-sel-txt" role="status"></p>' +
      '<button type="button" class="btn btn-secondaire" data-act="cocher-resultat">Cocher les ' + pl(l.length, "client", "clients") + ' du résultat</button>' +
      '<button type="button" class="btn-texte" data-act="decocher-resultat" id="pf-decocher">Décocher ceux du résultat</button>' +
      '<button type="button" class="btn-texte" data-act="vider-sel" id="pf-vider">Tout décocher</button></div>';
    h += tableauHtml(l);
    h += '<div class="suite">' + (reste > 0 ? '<button type="button" class="btn btn-secondaire" data-act="plus">Afficher ' + Math.min(NB_PAGE, reste) + ' de plus</button>' + (reste > NB_PAGE ? '<button type="button" class="btn-texte" data-act="tout">Tout afficher</button>' : "") : "") +
      '<span class="sous">' + vus + " affichés sur " + l.length + "</span></div>";
    h += '<div class="actions-impr"><button type="button" class="btn btn-secondaire btn-impr" data-act="imprimer">' + ICO.imprimante + "<span>Imprimer ou enregistrer en PDF cette liste</span></button>" +
      '<span class="sous">Toute la liste (' + pl(l.length, "client", "clients") + ") est imprimée, pas seulement les lignes affichées.</span></div>";
    h += '<p class="note-pied">Revenus mensuels du foyer : revenus nets déclarés dans le dossier, toutes personnes du foyer. Produits à GS : contrats détenus chez GS Banque & Assurance (compte, cartes, épargne, placements, crédits, assurances ; les crédits d\'autres banques ne comptent pas). Encours : épargne bancaire et placements détenus chez GS. ' +
      'Opportunités : celles de l\'accueil, détectées sur le dossier de la banque. Dernier contact : dernière note du dossier ou note que vous avez ajoutée dans la fiche client.</p>';
    return h;
  }
  function majSelection(k) {
    k = k || calcul();
    var n = idsCoches(k.tous).length, t = document.getElementById("pf-sel-txt");
    var dansRes = k.filtrees.filter(function (r) { return etat.sel[r.id]; }).length;
    if (t) t.textContent = n ? pl(n, "client coché", "clients cochés") + (dansRes !== n ? " (dont " + dansRes + " dans le résultat affiché)" : "") + "." : "Aucun client coché : cochez des clients ou prenez tout le résultat.";
    var d = document.getElementById("pf-decocher"), v = document.getElementById("pf-vider");
    if (d) d.hidden = !dansRes; if (v) v.hidden = !n;
    majCible(k);
  }

  /* ---------- zone : enregistrer une cible ---------- */
  function sourceEffective(k) {
    var n = idsCoches(k.tous).length;
    if (etat.source === "coches" && n) return "coches";
    if (etat.source === "resultat") return "resultat";
    return n ? "coches" : "resultat";
  }
  function cibleHtml(k) {
    var n = idsCoches(k.tous).length, r = k.filtrees.length, src = sourceEffective(k);
    return '<form class="formulaire pf-form" id="form-cible" novalidate>' +
      '<fieldset class="pf-source"><legend>Clients de la cible</legend>' +
      '<label class="pf-radio"><input type="radio" name="source" value="resultat"' + (src === "resultat" ? " checked" : "") + (r ? "" : " disabled") + '> Les ' + pl(r, "client", "clients") + " du résultat affiché</label>" +
      '<label class="pf-radio"><input type="radio" name="source" value="coches"' + (src === "coches" ? " checked" : "") + (n ? "" : " disabled") + "> Les " + pl(n, "client coché", "clients cochés") + "</label></fieldset>" +
      '<div class="champ"><label for="c-nom">Nom de la cible *</label><input id="c-nom" maxlength="' + P.MAX_NOM + '" autocomplete="off" placeholder="Exemple : Retraités éligibles au LEP" value="' + esc(etat.nom) + '"></div>' +
      '<div class="champ"><label for="c-note">Objectif ou remarque <span class="aide-champ">(facultatif)</span></label><textarea id="c-note" maxlength="' + P.MAX_NOTE + '" style="min-height:80px" placeholder="Pourquoi cette cible ? Quelle action prévue ?">' + esc(etat.note) + "</textarea></div>" +
      '<p class="msg-erreur" id="c-err" role="alert">' + esc(etat.err) + '</p><div><button type="submit" class="btn btn-principal">Enregistrer la cible</button></div></form>' +
      '<p class="msg-ok" id="c-msg" role="status" tabindex="-1">' + esc(etat.msg) + "</p>" +
      '<p class="mention">La cible garde la liste des clients choisis aujourd\'hui, avec les filtres utilisés pour mémoire. Tout le reste (âge, éligibilité, dernier contact, opportunités…) est recalculé à chaque ouverture. Les cibles restent enregistrées dans ce navigateur, sur cet ordinateur (' + P.MAX_CIBLES + " au maximum).</p>";
  }
  function majCible(k) {
    var z = document.getElementById("pf-cible"); if (!z) return;
    /* Le formulaire n'est reconstruit que si la source change : on ne perd pas ce que l'élève est en train de taper. */
    var n = idsCoches(k.tous).length, r = k.filtrees.length, src = sourceEffective(k);
    var f = document.getElementById("form-cible");
    if (f) {
      var radios = f.querySelectorAll('input[name="source"]');
      radios[0].disabled = !r; radios[1].disabled = !n;
      radios[0].checked = src === "resultat"; radios[1].checked = src === "coches";
      radios[0].parentNode.lastChild.textContent = " Les " + pl(r, "client", "clients") + " du résultat affiché";
      radios[1].parentNode.lastChild.textContent = " Les " + pl(n, "client coché", "clients cochés");
    } else z.innerHTML = cibleHtml(k);
  }

  /* ---------- zone : mes cibles ---------- */
  function criteresCible(c) {
    var t = c.mode === "coches" ? "Clients cochés à la main" + (c.criteres.length ? ", parmi les résultats de : " : " dans le portefeuille.") : (c.criteres.length ? "Filtres : " : "Tout le portefeuille, sans filtre.");
    return t + (c.criteres.length ? c.criteres.join(" ; ") + "." : "");
  }
  function carteCible(c, st) {
    var lg = P.lignesCible(st, c), r = P.resume(lg), actif = etat.cible === c.id;
    if (etat.edition === c.id) {
      return '<li class="cible cible-edition"><form class="formulaire pf-form" data-cible="' + c.id + '" id="form-edition" novalidate><div class="champ"><label for="e-nom">Nom de la cible *</label><input id="e-nom" maxlength="' + P.MAX_NOM + '" value="' + esc(etat.editNom) + '"></div>' +
        '<div class="champ"><label for="e-note">Objectif ou remarque</label><textarea id="e-note" maxlength="' + P.MAX_NOTE + '" style="min-height:70px">' + esc(etat.editNote) + '</textarea></div><p class="msg-erreur" id="e-err" role="alert">' + esc(etat.editErr) + "</p>" +
        '<div class="pf-btns"><button type="submit" class="btn btn-principal">Enregistrer les modifications</button><button type="button" class="btn btn-secondaire" data-act="annuler-edition">Annuler</button></div></form></li>';
    }
    var conf = etat.confirmer === c.id;
    return '<li class="cible' + (actif ? " cible-actif" : "") + '" data-cible="' + c.id + '"><div class="cible-tete"><h3 tabindex="-1" id="cible-' + c.id + '">' + esc(c.nom) + '</h3><span class="sous">Enregistrée le ' + esc(B.fmtDate(B.lireYmd(c.creee))) + " à " + esc(c.heure) + "</span></div>" +
      (c.note ? '<p class="cible-note">' + esc(c.note) + "</p>" : "") +
      '<p class="cible-crit">' + esc(criteresCible(c)) + "</p>" +
      '<dl class="cible-stats"><div><dt>Clients</dt><dd>' + B.nb(r.n) + "</dd></div><div><dt>Âge moyen</dt><dd>" + ageMoy(r.age) + "</dd></div><div><dt>Encours moyen</dt><dd>" + B.eur(r.encours) + "</dd></div><div><dt>Avec opportunité</dt><dd>" + B.nb(r.avecOpp) + "</dd></div><div><dt>Sans contact depuis un an</dt><dd>" + B.nb(r.sansContactAn) + "</dd></div></dl>" +
      '<div class="pf-btns">' + (actif ? '<button type="button" class="btn btn-secondaire" data-act="quitter-cible">Revenir à tout le portefeuille</button>' : '<button type="button" class="btn btn-secondaire" data-act="voir-cible" data-id="' + c.id + '">Afficher les clients</button>') +
      '<button type="button" class="btn-texte btn-impr" data-act="imprimer-cible" data-id="' + c.id + '">' + ICO.imprimante + "<span>Imprimer ou PDF</span></button>" +
      '<a class="btn-texte" href="campagnes.html?nouvelle=1&amp;cible=' + c.id + '" aria-label="Créer une campagne à partir de la cible ' + esc(c.nom) + '">Créer une campagne</a>' +
      '<button type="button" class="btn-texte" data-act="modifier" data-id="' + c.id + '">Modifier le nom ou la note</button>' +
      (conf ? '<span class="pf-conf"><button type="button" class="btn-texte" data-act="suppr-oui" data-id="' + c.id + '">Confirmer la suppression</button> <button type="button" class="btn-texte" data-act="suppr-non">Annuler</button></span>' : '<button type="button" class="btn-texte" data-act="suppr" data-id="' + c.id + '">Supprimer</button>') + "</div></li>";
  }
  function mesCiblesHtml() {
    var st = store(), l = P.cibles(st).slice().sort(function (a, b) { return a.creee < b.creee ? 1 : a.creee > b.creee ? -1 : a.heure < b.heure ? 1 : a.heure > b.heure ? -1 : 0; });
    document.getElementById("pf-nb-cibles").textContent = l.length ? pl(l.length, "cible enregistrée", "cibles enregistrées") : "";
    if (!l.length) return '<p class="vide-bloc">Aucune cible enregistrée. Filtrez le portefeuille, puis enregistrez le résultat ou les clients cochés : vous les retrouverez ici, avec leurs chiffres du jour.</p>';
    return '<ul class="cibles">' + l.map(function (c) { return carteCible(c, st); }).join("") + "</ul>";
  }

  /* ---------- documents imprimables ---------- */
  function tableImpression(l) {
    var lignes = l.map(function (r) {
      return '<tr><td class="g"><strong>' + esc(r.c.nom.toUpperCase() + " " + r.c.prenom) + '</strong><br><span class="num">' + esc(r.c.num) + "</span></td><td>" + r.age + ' ans</td><td class="g">' + esc(r.c.pro.prof) + '</td><td class="g">' + arrLib(r.arr) + "</td><td>" + B.eur(r.foyer) + "</td><td>" + r.nbProduits + '</td><td class="g">' + iccTexte(r) + "</td><td>" + B.eur(r.encours) + '</td><td class="g">' +
        (r.opps.length ? r.opps.map(function (o) { return esc(CODES[o.code] || o.titre); }).join(", ") : "–") + '</td><td class="g">' + (r.dernier === null ? "Aucun" : esc(B.fmtDate(r.dernierDate))) + "</td></tr>";
    }).join("");
    return '<table class="dp-pf dp-pfl"><caption>' + pl(l.length, "client", "clients") + '</caption><thead><tr><th scope="col" class="g">Client</th><th scope="col">Âge</th><th scope="col" class="g">Profession</th><th scope="col" class="g">Arrond.</th><th scope="col">Revenus du foyer par mois</th><th scope="col">Produits</th><th scope="col" class="g">ICC</th><th scope="col">Encours</th><th scope="col" class="g">Opportunités</th><th scope="col" class="g">Dernier contact</th></tr></thead><tbody>' + lignes + "</tbody></table>";
  }
  function documentListe(l, o) {
    var st = store(), r = P.resume(l), corps = "";
    if (o.note) corps += '<p class="dp-texte"><strong>Objectif :</strong> ' + esc(o.note) + "</p>";
    corps += '<section class="dp-bloc"><h2>Comment les clients ont été choisis</h2><ul class="dp-liste">' + o.criteres.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul></section>";
    corps += '<section class="dp-bloc"><h2>Chiffres clés</h2><dl class="dp-chiffres"><div><dt>Clients</dt><dd>' + B.nb(r.n) + "</dd></div><div><dt>Âge moyen</dt><dd>" + ageMoy(r.age) + "</dd></div><div><dt>Revenus mensuels moyens du foyer</dt><dd>" + B.eur(r.foyer) + "</dd></div><div><dt>Encours moyen</dt><dd>" + B.eur(r.encours) + "</dd></div></dl>" +
      '<p class="dp-texte">' + pl(r.avecOpp, "client a", "clients ont") + " au moins une opportunité détectée ; " + pl(r.sansContactAn, "client n'a", "clients n'ont") + " aucun contact enregistré depuis plus d'un an.</p></section>";
    corps += '<section class="dp-long"><h2>Liste des clients</h2>' + tableImpression(l) + '<p class="dp-mention">Chiffres calculés le ' + esc(B.fmtLong(B.aujourdhui())) + ". Revenus du foyer : revenus nets déclarés dans le dossier. Encours : épargne et placements détenus chez GS Banque & Assurance. Opportunités : celles de l'accueil. ICC : indice de commercialité client, de rouge (client à équiper) à vert+ (client entièrement équipé et sociétaire).</p></section>";
    return IMP.document({ titre: o.titre, sous: o.sous, corps: corps });
  }
  function criteresListe(k) {
    var d = P.decrire(etat.f).map(function (x) { return x.txt; });
    var l = [];
    if (k.cible) l.push("Clients de la cible « " + k.cible.nom + " » (" + pl(k.tous.length, "client", "clients") + ")");
    else l.push("Portefeuille de " + pl(k.tous.length, "client", "clients"));
    if (d.length) d.forEach(function (t) { l.push("Filtre – " + t); }); else l.push("Aucun filtre appliqué");
    l.push("Classement : " + minus(P.TRIS.filter(function (t) { return t.id === etat.tri; })[0].lib) + (etat.sens === 1 ? ", croissant" : ", décroissant"));
    return l;
  }
  function imprimerResultat() {
    var k = calcul(), titre = k.cible ? "Cible : " + k.cible.nom : "Portefeuille clients";
    var fichier = "Portefeuille_" + IMP.nomFichier(k.cible ? k.cible.nom : "liste") + "_" + B.ymd(B.aujourdhui());
    IMP.imprimer(documentListe(k.filtrees, { titre: titre, sous: pl(k.filtrees.length, "client", "clients") + " – Agence de Paris", criteres: criteresListe(k), note: k.cible ? k.cible.note : "" }), fichier);
  }
  function imprimerCible(id) {
    var st = store(), c = P.trouverCible(st, id);
    if (!c) return;
    var l = P.trier(P.lignesCible(st, c), "nom", 1);
    var crit = ["Cible enregistrée le " + B.fmtDate(B.lireYmd(c.creee)) + " à " + c.heure, criteresCible(c), "Classement : nom, croissant"];
    IMP.imprimer(documentListe(l, { titre: "Cible : " + c.nom, sous: pl(l.length, "client", "clients") + " – Agence de Paris", criteres: crit, note: c.note }), "Cible_" + IMP.nomFichier(c.nom) + "_" + B.ymd(B.aujourdhui()));
  }

  /* ---------- page ---------- */
  function render() {
    app.innerHTML = '<nav class="pf-liens" aria-label="Aller à"><a href="#bloc-resultat">Résultat</a><a href="#bloc-cible">Enregistrer une cible</a><a href="#bloc-mes-cibles">Mes cibles</a></nav>' +
      '<div class="page-grille">' + blocFiltres() +
      '<section class="bloc" id="bloc-resultat" aria-labelledby="t-pf-res"><div class="bloc-tete"><h2 id="t-pf-res">Clients</h2><span class="sous" id="pf-compte" role="status"></span></div><div id="pf-resultat"></div></section>' +
      '<section class="bloc" id="bloc-cible" aria-labelledby="t-pf-cible"><div class="bloc-tete"><h2 id="t-pf-cible">Enregistrer une cible</h2><span class="sous">Pour la retrouver plus tard et préparer une campagne</span></div><div id="pf-cible"></div></section>' +
      '<section class="bloc" id="bloc-mes-cibles" aria-labelledby="t-pf-mes"><div class="bloc-tete"><h2 id="t-pf-mes">Mes cibles</h2><span class="sous" id="pf-nb-cibles"></span></div><div id="pf-mes-cibles"></div></section></div>' +
      '<p class="mention" style="margin-top:16px">Les plafonds et conditions réglementaires utilisés pour l\'éligibilité sont ceux de l\'automne 2026.</p>';
    syncFiltres();
    majResultat();
    document.getElementById("pf-mes-cibles").innerHTML = mesCiblesHtml();
  }
  function majResultat() {
    var k = calcul();
    document.getElementById("pf-puces").innerHTML = puces();
    document.getElementById("pf-resultat").innerHTML = resultatHtml(k);
    document.getElementById("pf-compte").textContent = pl(k.filtrees.length, "client", "clients") + " sur " + B.nb(k.tous.length) + (k.cible ? " dans la cible" : "");
    document.getElementById("pf-cible").innerHTML = cibleHtml(k);
    majSelection(k);
    var nf = P.nbFiltres(etat.f), z = document.getElementById("pf-nbf"); if (z) z.textContent = nf ? "(" + pl(nf, "actif", "actifs") + ")" : "";
  }
  function majMesCibles() { document.getElementById("pf-mes-cibles").innerHTML = mesCiblesHtml(); }
  function reinitPage() { etat.nb = NB_PAGE; }

  /* ---------- événements ---------- */
  var minuterie = null;
  app.addEventListener("input", function (e) {
    var t = e.target;
    if (t.id === "pf-q") { etat.f.q = t.value; reinitPage(); clearTimeout(minuterie); minuterie = setTimeout(function () { majResultat(); }, 180); }
    else if (t.id === "c-nom") etat.nom = t.value;
    else if (t.id === "c-note") etat.note = t.value;
    else if (t.id === "e-nom") etat.editNom = t.value;
    else if (t.id === "e-note") etat.editNote = t.value;
  });
  app.addEventListener("change", function (e) {
    var t = e.target;
    if (t.hasAttribute("data-f")) {
      var id = t.getAttribute("data-f");
      etat.f[id] = t.value;
      if (id === "produit") { if (!t.value) etat.f.situation = "eligible"; document.getElementById("f-situation").disabled = !t.value; document.getElementById("f-situation").value = etat.f.situation; }
      reinitPage(); majResultat();
    } else if (t.id === "pf-tri") {
      etat.tri = t.value; etat.sens = P.TRIS.filter(function (x) { return x.id === t.value; })[0].sens; document.getElementById("pf-sens").value = String(etat.sens); reinitPage(); majResultat();
    } else if (t.id === "pf-sens") { etat.sens = parseInt(t.value, 10) === -1 ? -1 : 1; reinitPage(); majResultat(); }
    else if (t.type === "checkbox" && t.hasAttribute("data-id")) {
      var i = parseInt(t.getAttribute("data-id"), 10);
      if (t.checked) etat.sel[i] = true; else delete etat.sel[i];
      t.closest("tr").classList.toggle("pf-coche-oui", t.checked);
      majSelection();
    } else if (t.name === "source") { etat.source = t.value; }
  });
  function demarrerEdition(c) { etat.edition = c.id; etat.editNom = c.nom; etat.editNote = c.note; etat.editErr = ""; }
  app.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b) return;
    var act = b.getAttribute("data-act"), id = b.getAttribute("data-id");
    if (act === "ret-filtre") {
      if (id === "produit") { etat.f.produit = ""; etat.f.situation = "eligible"; } else etat.f[id] = "";
      reinitPage(); syncFiltres(); majResultat();
      var s = app.querySelector("#pf-puces .pf-x") || document.getElementById("pf-q"); s.focus();
    } else if (act === "effacer") {
      etat.f = P.filtresVides(); reinitPage(); syncFiltres(); majResultat(); document.getElementById("pf-q").focus();
    } else if (act === "plus") {
      var avant = etat.nb; etat.nb += NB_PAGE; majResultat();
      var lignes = app.querySelectorAll("#pf-resultat tbody tr"); if (lignes[avant]) lignes[avant].querySelector("a").focus();
    } else if (act === "tout") {
      var av = etat.nb; etat.nb = 100000; majResultat();
      var ll = app.querySelectorAll("#pf-resultat tbody tr"); if (ll[av]) ll[av].querySelector("a").focus();
    } else if (act === "cocher-resultat" || act === "decocher-resultat") {
      var k = calcul(); k.filtrees.forEach(function (r) { if (act === "cocher-resultat") etat.sel[r.id] = true; else delete etat.sel[r.id]; });
      etat.source = "auto";
      Array.prototype.forEach.call(app.querySelectorAll("#pf-resultat tbody input[type=checkbox]"), function (c) { c.checked = !!etat.sel[c.getAttribute("data-id")]; c.closest("tr").classList.toggle("pf-coche-oui", c.checked); });
      majSelection(k);
    } else if (act === "vider-sel") {
      etat.sel = {}; etat.source = "auto";
      Array.prototype.forEach.call(app.querySelectorAll("#pf-resultat tbody input[type=checkbox]"), function (c) { c.checked = false; c.closest("tr").classList.remove("pf-coche-oui"); });
      majSelection();
    } else if (act === "imprimer") { imprimerResultat(); }
    else if (act === "imprimer-cible") { imprimerCible(id); }
    else if (act === "voir-cible") {
      etat.cible = id; etat.f = P.filtresVides(); etat.nb = NB_PAGE; etat.sel = {}; etat.source = "auto";
      syncFiltres(); majResultat(); majMesCibles();
      document.getElementById("bloc-resultat").scrollIntoView({ block: "start" });
      var h = document.getElementById("t-pf-res"); h.setAttribute("tabindex", "-1"); h.focus();
    } else if (act === "quitter-cible") {
      etat.cible = null; etat.nb = NB_PAGE; etat.sel = {}; etat.source = "auto";
      syncFiltres(); majResultat(); majMesCibles();
      var h2 = document.getElementById("t-pf-res"); h2.setAttribute("tabindex", "-1"); h2.focus();
    } else if (act === "modifier") {
      var c2 = P.trouverCible(store(), id); if (!c2) return;
      demarrerEdition(c2); etat.confirmer = null; majMesCibles(); document.getElementById("e-nom").focus();
    } else if (act === "annuler-edition") { var ed = etat.edition; etat.edition = null; majMesCibles(); var bt = app.querySelector('[data-act="modifier"][data-id="' + ed + '"]'); if (bt) bt.focus(); }
    else if (act === "suppr") { etat.confirmer = id; majMesCibles(); var cf = app.querySelector('[data-act="suppr-oui"]'); if (cf) cf.focus(); }
    else if (act === "suppr-non") { var ci = etat.confirmer; etat.confirmer = null; majMesCibles(); var bs = app.querySelector('[data-act="suppr"][data-id="' + ci + '"]'); if (bs) bs.focus(); }
    else if (act === "suppr-oui") {
      var st = store(), c3 = P.trouverCible(st, id), nom = c3 ? c3.nom : "";
      if (P.supprimerCible(st, id)) B.store.sauver();
      etat.confirmer = null;
      var enCours = etat.cible === id; if (enCours) { etat.cible = null; etat.sel = {}; }
      etat.msg = nom ? "La cible « " + nom + " » est supprimée." : "";
      if (enCours) { syncFiltres(); majResultat(); } else majCible(calcul());
      majMesCibles();
      var m = document.getElementById("c-msg"); if (m) { m.textContent = etat.msg; }
      var t = document.getElementById("t-pf-mes"); t.setAttribute("tabindex", "-1"); t.focus();
    }
  });
  app.addEventListener("submit", function (e) {
    e.preventDefault();
    var st = store();
    if (e.target.id === "form-cible") {
      var k = calcul(), src = sourceEffective(k), ids = src === "coches" ? idsCoches(k.tous) : k.filtrees.map(function (r) { return r.id; });
      var crit = P.decrire(etat.f).map(function (x) { return x.txt; });
      if (k.cible) crit.unshift("Parmi les clients de la cible « " + k.cible.nom + " »");
      var res = P.creerCible(st, { nom: etat.nom, note: etat.note, ids: ids, criteres: crit, mode: src });
      if (!res.ok) { etat.err = res.erreur; document.getElementById("c-err").textContent = res.erreur; var ch = document.getElementById("c-nom"); if (!etat.nom.trim() || /nom/.test(res.erreur)) ch.focus(); return; }
      B.store.sauver();
      etat.err = ""; etat.msg = "Cible « " + res.cible.nom + " » enregistrée : " + pl(res.cible.ids.length, "client", "clients") + ".";
      etat.nom = ""; etat.note = "";
      document.getElementById("pf-cible").innerHTML = cibleHtml(calcul());
      majMesCibles();
      var t = document.getElementById("cible-" + res.cible.id); if (t) t.focus();
      var m = document.getElementById("c-msg"); if (m) m.textContent = etat.msg;
    } else if (e.target.id === "form-edition") {
      var r2 = P.modifierCible(st, e.target.getAttribute("data-cible"), etat.editNom, etat.editNote);
      if (!r2.ok) { etat.editErr = r2.erreur; document.getElementById("e-err").textContent = r2.erreur; document.getElementById("e-nom").focus(); return; }
      B.store.sauver(); etat.edition = null; etat.editErr = ""; majMesCibles();
      if (etat.cible) majResultat();
      var tt = document.getElementById("cible-" + r2.cible.id); if (tt) tt.focus();
    }
  });

  render();
})();
