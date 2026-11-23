/* GS Banque & Assurance – campagnes commerciales : liste, création, fiche d'une campagne (indicateurs, jalons, suivi client par client), impression. */
(function () {
  "use strict";

  var B = window.SGBF.banque, CA = window.SGBF.campagnes, K = window.SGBF.catalogue, P = window.SGBF.portefeuille, PR = window.SGBF.produits, AG = window.SGBF.agenda;
  var ICO = window.SGBF.icones, RECH = window.SGBF.recherche, IMP = window.SGBF.impression, CL = window.SGBF.clients;
  var app = document.getElementById("app");
  var esc = B.esc;
  function store() { return B.store.charger(); }
  function pl(n, s, p) { return B.nb(n) + " " + (n > 1 ? p : s); }
  function nomCourt(c) { return c.prenom + " " + c.nom; }
  function lienClient(c) { return "client.html?id=" + c.id; }
  function nomProduit(pid) { return PR.parId[pid] ? PR.parId[pid].nom : pid; }
  function maj1(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function iso(d) { return B.ymd(d); }
  function dateTxt(ymd) { return B.fmtDate(B.lireYmd(ymd)); }
  function periode(k) { return "du " + dateTxt(k.debut) + " au " + dateTxt(k.fin); }
  function pc(v) { return v === null ? "–" : v + " %"; }
  var CLASSE_STATUT = { avenir: "puce", cours: "puce puce-ok", terminee: "puce" };
  var CLASSE_ETAT = { souscrit: "puce puce-ok", detient: "puce", refus: "puce puce-bad", rdv: "puce puce-warn", face: "puce puce-warn", appel: "puce puce-warn", message: "puce", tentative: "puce", a_contacter: "puce" };

  var params = new URLSearchParams(location.search);
  var etat = { ouverte: null, form: null, msg: "", supprimer: null, refus: null, filtre: "tous", nbLignes: 50 };

  /* ---------- création : valeurs initiales ---------- */
  function debutParDefaut() { return B.estOuvre(B.aujourdhui()) ? B.aujourdhui() : B.ouvreSuivant(B.aujourdhui()); }
  function finParDefaut(d0) { var d = d0; for (var i = 0; i < 9; i++) d = B.ouvreSuivant(B.plusJours(d, 1)); return d; }
  function formVide(pid, cibleId) {
    var d0 = debutParDefaut();
    var f = { id: null, nom: "", produit: pid && K.prospectionPossible(PR.parId[pid]) ? pid : "", sourceType: cibleId ? "cible" : "eligibles", cible: cibleId || "", objectif: "", debut: iso(d0), fin: iso(finParDefaut(d0)), args: "", argsModifies: false, moyens: [], err: null, creation: true };
    if (f.produit) f.args = CA.argumentsSuggeres(f.produit).join("\n");
    return f;
  }
  function formDe(k) { return { id: k.id, nom: k.nom, produit: k.produit, sourceType: k.sourceType, cible: "", objectif: String(k.objectif), debut: k.debut, fin: k.fin, args: k.args.join("\n"), argsModifies: true, moyens: (k.moyens || []).slice(), err: null, creation: false }; }

  /* ---------- liste ---------- */
  function carte(k) {
    var st = store(), i = CA.indicateurs(st, k), ouverte = etat.ouverte === k.id, conf = etat.supprimer === k.id;
    var atteinte = i.atteinte === null ? 0 : Math.min(100, i.atteinte);
    return '<li class="cg-carte' + (ouverte ? " cg-ouverte" : "") + '"><div class="cg-tete"><h3 id="cg-' + k.id + '" tabindex="-1">' + esc(k.nom) + '</h3><span class="' + CLASSE_STATUT[i.statut] + '">' + esc(CA.STATUTS[i.statut]) + "</span></div>" +
      '<p class="cg-sous">' + esc(nomProduit(k.produit)) + " – " + esc(periode(k)) + " – " + pl(k.ids.length, "client retenu", "clients retenus") + "</p>" +
      '<div class="cg-prog"><div class="barre b-ok" role="img" aria-label="Objectif atteint à ' + (i.atteinte === null ? 0 : i.atteinte) + ' %"><span style="width:' + atteinte + '%"></span></div><span>' + i.contrats + " contrat" + (i.contrats > 1 ? "s" : "") + " sur " + k.objectif + " visé" + (k.objectif > 1 ? "s" : "") + "</span></div>" +
      '<p class="ag-liens"><button type="button" class="btn btn-secondaire" data-act="ouvrir" data-id="' + k.id + '" aria-label="Ouvrir la campagne ' + esc(k.nom) + '">Ouvrir</button>' +
      (conf ? '<button type="button" class="btn-texte" data-act="suppr-oui" data-id="' + k.id + '">Confirmer la suppression</button><button type="button" class="btn-texte" data-act="suppr-non">Garder</button>' :
        '<button type="button" class="btn-texte" data-act="suppr" data-id="' + k.id + '" aria-label="Supprimer la campagne ' + esc(k.nom) + '">Supprimer</button>') + "</p></li>";
  }
  function listeHtml() {
    var l = CA.campagnes(store()).slice().sort(function (a, b) { return a.creee < b.creee ? 1 : a.creee > b.creee ? -1 : a.id < b.id ? 1 : -1; });
    document.getElementById("cg-nb").textContent = l.length ? pl(l.length, "campagne", "campagnes") : "";
    if (!l.length) return '<p class="vide-bloc">Aucune campagne pour le moment. Une campagne vise la souscription d\'un produit par les clients d\'une cible, pendant une période de jours ouvrés. Cliquez sur « Nouvelle campagne » pour commencer.</p>';
    return '<ul class="cg-liste">' + l.map(carte).join("") + "</ul>";
  }
  function majListe() { document.getElementById("z-liste").innerHTML = listeHtml(); }

  /* ---------- formulaire ---------- */
  function erreurChamp(champ) { return etat.form && etat.form.err && etat.form.err.champ === champ; }
  function attrErr(champ) { return erreurChamp(champ) ? ' aria-invalid="true" aria-describedby="cg-err"' : ""; }
  function resumeCible(f) {
    if (!f || !f.creation) return "";
    if (!f.produit) return '<p class="aide-champ">Choisissez un produit pour voir combien de clients peuvent se le voir proposer.</p>';
    var st = store(), src = f.sourceType === "cible" ? { type: "cible", id: f.cible } : { type: "eligibles" };
    if (f.sourceType === "cible" && !f.cible) return '<p class="aide-champ">Choisissez une de vos cibles.</p>';
    var r = CA.cibleChoisie(st, f.produit, src);
    if (!r.ok) return '<p class="cg-alerte" role="status">' + esc(r.erreur) + "</p>";
    var c = r.compte;
    return '<p class="cg-resume" role="status"><strong>' + pl(r.retenus.length, "client retenu", "clients retenus") + "</strong> sur " + pl(r.total, "client", "clients") + " : " + pl(c.eligible, "éligible", "éligibles") + ", " + pl(c.examiner, "à examiner", "à examiner") +
      (r.total - r.retenus.length ? ". Écartés : " + pl(c.non, "non éligible", "non éligibles") + ", " + pl(c.detenu, "détenant déjà le produit", "détenant déjà le produit") : "") + ".</p>";
  }
  function maxObjectif(f) {
    if (!f.creation) { var k = CA.trouver(store(), f.id); return k ? k.ids.length : 0; }
    if (!f.produit || (f.sourceType === "cible" && !f.cible)) return 0;
    var r = CA.cibleChoisie(store(), f.produit, f.sourceType === "cible" ? { type: "cible", id: f.cible } : { type: "eligibles" });
    return r.ok ? r.retenus.length : 0;
  }
  function formHtml() {
    var f = etat.form;
    if (!f) return "";
    var st = store(), cibles = P.cibles(st), auj = B.aujourdhui(), modif = !f.creation, k = modif ? CA.trouver(st, f.id) : null;
    var h = '<section class="bloc cg-form-bloc" id="bloc-form" aria-labelledby="t-form"><div class="bloc-tete"><h2 id="t-form" tabindex="-1">' + (modif ? "Modifier la campagne" : "Nouvelle campagne") + '</h2><span class="sous">Les champs marqués d\'une étoile (*) sont obligatoires</span></div>' +
      '<form class="formulaire cg-form" id="form-cg" novalidate>' +
      '<div class="champ"><label for="cg-nom">Nom de la campagne *</label><input id="cg-nom" maxlength="' + CA.MAX_NOM + '" autocomplete="off" placeholder="Exemple : Le LEP pour les retraités" value="' + esc(f.nom) + '"' + attrErr("nom") + "></div>";
    if (modif) {
      h += '<p class="cg-fixe"><strong>Produit :</strong> ' + esc(nomProduit(k.produit)) + " – <strong>Cible :</strong> " + esc(k.source) + " (" + pl(k.ids.length, "client retenu", "clients retenus") + ") – <strong>Début :</strong> " + esc(dateTxt(k.debut)) + ". Ces éléments ne changent pas après le lancement.</p>";
    } else {
      var fams = PR.univers;   /* les crédits sont absents de CA.produitsPossibles() : l'univers « Prêts et crédits » n'a donc pas de groupe */
      h += '<div class="champ"><label for="cg-produit">Produit à vendre *</label><select id="cg-produit"' + attrErr("produit") + '><option value="">Choisir un produit</option>' + fams.map(function (fa) {
        var ps = CA.produitsPossibles().filter(function (p) { return PR.universDe(p) === fa; });
        return ps.length ? '<optgroup label="' + esc(fa.nom) + '">' + ps.map(function (p) { return '<option value="' + p.id + '"' + (f.produit === p.id ? " selected" : "") + ">" + esc(p.nom) + "</option>"; }).join("") + "</optgroup>" : "";
      }).join("") + '</select><p class="aide-champ">Deux sortes de produits sont absents de la liste : les crédits, qui se montent dans « Montage de prêt » et dont aucun contrat ne serait mesurable ici, et l\'offre clientèle fragile, que la banque propose aux clients qu\'elle repère comme fragiles au lieu de la vendre.</p></div>' +
        '<fieldset class="pf-source"><legend>Clients visés *</legend>' +
        '<label class="pf-radio"><input type="radio" name="cg-src" value="eligibles"' + (f.sourceType === "eligibles" ? " checked" : "") + "> Tous les clients du portefeuille éligibles au produit</label>" +
        '<label class="pf-radio"><input type="radio" name="cg-src" value="cible"' + (f.sourceType === "cible" ? " checked" : "") + (cibles.length ? "" : " disabled") + "> Une de mes cibles enregistrées" + (cibles.length ? "" : " (aucune : créez-en une dans le portefeuille clients)") + "</label>" +
        (f.sourceType === "cible" && cibles.length ? '<div class="champ cg-cible"><label for="cg-cible">Ma cible *</label><select id="cg-cible"' + attrErr("source") + '><option value="">Choisir une cible</option>' + cibles.map(function (c) { return '<option value="' + c.id + '"' + (f.cible === c.id ? " selected" : "") + ">" + esc(c.nom) + " (" + pl(c.ids.length, "client", "clients") + ")</option>"; }).join("") + "</select></div>" : "") +
        "</fieldset>" +
        '<div id="z-resume">' + resumeCible(f) + "</div>";
    }
    var mx = maxObjectif(f), dMin = modif ? "" : ' min="' + iso(auj) + '"', dMax = ' max="' + iso(B.plusJours(auj, CA.HORIZON + CA.DUREE_MAX)) + '"';
    h += '<div class="ligne cg-ligne"><div class="champ"><label for="cg-objectif">Objectif : nombre de contrats *</label><input id="cg-objectif" type="number" min="1"' + (mx ? ' max="' + mx + '"' : "") + ' step="1" inputmode="numeric" value="' + esc(f.objectif) + '"' + attrErr("objectif") + '><p class="aide-champ" id="cg-aide-obj">' + (mx ? "Au plus " + mx + " : un contrat par client retenu." : "Choisissez d'abord le produit et la cible.") + "</p></div>" +
      (modif ? "" : '<div class="champ"><label for="cg-debut">Début *</label><input id="cg-debut" type="date"' + dMin + dMax + ' value="' + esc(f.debut) + '"' + attrErr("debut") + "></div>") +
      '<div class="champ"><label for="cg-fin">Fin *</label><input id="cg-fin" type="date"' + dMax + ' value="' + esc(f.fin) + '"' + attrErr("fin") + "></div></div>" +
      '<p class="aide-champ">Jours ouvrés uniquement (lundi au vendredi, hors jours fériés). Une campagne dure ' + CA.DUREE_MAX + " jours au plus (règle de l'agence).</p>" +
      '<div class="champ"><label for="cg-args">Argumentaire : les arguments pour convaincre le client *</label><textarea id="cg-args" rows="5"' + attrErr("args") + ' placeholder="Un argument par ligne">' + esc(f.args) + '</textarea><p class="aide-champ">Un argument par ligne, ' + CA.MAX_ARGS + " au plus, " + CA.MAX_ARG + " caractères chacun. Les arguments proposés viennent de la fiche du produit : adaptez-les à votre cible.</p></div>" +
      '<fieldset class="pf-source cg-moyens"' + attrErr("moyens") + '><legend>Moyens prévus pour mener la campagne *</legend>' + K.ORDRE_MOYENS.map(function (m) {
        return '<label class="pf-radio" for="cg-moy-' + m + '"><input type="checkbox" id="cg-moy-' + m + '" name="cg-moy" value="' + m + '"' + (f.moyens.indexOf(m) >= 0 ? " checked" : "") + "> " + esc(K.MOYENS[m]) + "</label>";
      }).join("") + '<p class="aide-champ">Le bilan compare les résultats de chaque moyen et signale ceux qui étaient prévus mais n\'ont pas été utilisés.</p></fieldset>' +
      '<p class="msg-erreur" id="cg-err" role="alert">' + (f.err ? esc(f.err.erreur) : "") + "</p>" +
      '<div class="pf-btns"><button type="submit" class="btn btn-principal">' + (modif ? "Enregistrer les modifications" : "Créer la campagne") + '</button><button type="button" class="btn btn-secondaire" data-act="fermer-form">Annuler</button></div></form></section>';
    return h;
  }
  function majForm() { document.getElementById("z-form").innerHTML = formHtml(); }
  function lireForm() {
    var f = etat.form; if (!f) return;
    function v(id) { var e = document.getElementById(id); return e ? e.value : null; }
    var n = v("cg-nom"); if (n !== null) f.nom = n;
    var p = v("cg-produit"); if (p !== null) f.produit = p;
    var r = app.querySelector('input[name="cg-src"]:checked'); if (r) f.sourceType = r.value;
    var c = v("cg-cible"); if (c !== null) f.cible = c;
    var o = v("cg-objectif"); if (o !== null) f.objectif = o;
    var d = v("cg-debut"); if (d !== null) f.debut = d;
    var fi = v("cg-fin"); if (fi !== null) f.fin = fi;
    var a = v("cg-args"); if (a !== null) f.args = a;
    var mo = app.querySelectorAll('input[name="cg-moy"]'); if (mo.length) f.moyens = Array.prototype.filter.call(mo, function (x) { return x.checked; }).map(function (x) { return x.value; });
  }
  function ouvrirForm(f, focusId) {
    etat.form = f; etat.msg = ""; majMsg(); majForm();
    var e = document.getElementById("bloc-form"); if (e) e.scrollIntoView({ block: "start" });
    var t = document.getElementById(focusId || "t-form"); if (t) t.focus();
  }
  function fermerForm() { etat.form = null; majForm(); var t = document.getElementById("t-nouvelle"); if (t) t.focus(); }
  function majMsg() { var z = document.getElementById("z-msg"); if (z) z.innerHTML = etat.msg ? '<p class="ag-ok" id="cg-ok" tabindex="-1" role="status">' + esc(etat.msg) + "</p>" : ""; }
  function lignesArgs(t) { return String(t || "").split(/\r?\n/); }
  function enregistrer() {
    lireForm();
    var f = etat.form, st = store();
    var o = { nom: f.nom, produit: f.produit, source: f.sourceType === "cible" ? { type: "cible", id: f.cible } : { type: "eligibles" }, objectif: f.objectif, debut: f.debut, fin: f.fin, args: lignesArgs(f.args), moyens: f.moyens };
    var r = f.creation ? CA.creer(st, o) : CA.modifier(st, f.id, o);
    if (!r.ok) {
      f.err = r; document.getElementById("cg-err").textContent = r.erreur;
      var map = { nom: "cg-nom", produit: "cg-produit", source: f.sourceType === "cible" ? "cg-cible" : "cg-produit", objectif: "cg-objectif", debut: "cg-debut", fin: "cg-fin", args: "cg-args", moyens: "cg-moy-mail" };
      majForm(); var e = document.getElementById(map[r.champ] || "cg-err"); if (e) { if (!e.hasAttribute("tabindex") && !/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(e.tagName)) e.setAttribute("tabindex", "-1"); e.focus(); }
      return;
    }
    B.store.sauver();
    var k = r.campagne;
    etat.msg = (f.creation ? "Campagne créée" : "Modifications enregistrées") + " : « " + k.nom + " » – " + nomProduit(k.produit) + ", " + periode(k) + ", " + pl(k.ids.length, "client retenu", "clients retenus") + ", objectif de " + pl(k.objectif, "contrat", "contrats") + ".";
    etat.form = null; etat.ouverte = k.id; etat.filtre = "tous"; etat.nbLignes = 50;
    majForm(); majListe(); majDetail(); majMsg();
    var ok = document.getElementById("cg-ok"); if (ok) { ok.scrollIntoView({ block: "center" }); ok.focus(); }
  }

  /* ---------- fiche d'une campagne ---------- */
  function kpi(lib, val, det) { return '<div class="kpi"><dt>' + esc(lib) + '</dt><dd class="val">' + val + "</dd>" + (det ? '<dd class="det">' + det + "</dd>" : "") + "</div>"; }
  function rythmeTexte(i) {
    if (i.rythme === null) return i.statut === "avenir" ? "À venir" : i.statut === "terminee" ? "Terminée" : "–";
    return i.rythme === "ok" ? "Dans le rythme" : "En retard";
  }
  function kpisHtml(k, i) {
    return '<dl class="kpis cg-kpis">' +
      kpi("Clients ciblés", B.nb(i.cibles), i.aContacter + (i.aContacter > 1 ? " restent à contacter" : " reste à contacter")) +
      kpi("Clients contactés", B.nb(i.contactes), "Taux de contact : " + pc(i.tauxContact)) +
      kpi("Avec rendez-vous", B.nb(i.rdv), pl(i.messages, "message envoyé", "messages envoyés") + ", " + pl(i.appels, "appel", "appels") + ", " + pl(i.face, "client reçu en entretien", "clients reçus en entretien")) +
      kpi("Contrats", i.contrats + " / " + k.objectif, "Objectif atteint à " + pc(i.atteinte)) +
      kpi("Transformation", pc(i.tauxTransformation), "Clients ayant souscrit ÷ clients contactés") +
      kpi("Reste à faire", B.nb(i.resteAFaire), pl(i.refus, "refus", "refus") + (i.detient ? ", " + i.detient + " détenteur" + (i.detient > 1 ? "s" : "") + " hors période" : "")) +
      kpi("Jours ouvrés", i.jours.restants + " / " + i.jours.total, "restants / total de la période") +
      kpi("Rythme", esc(rythmeTexte(i)), i.tempsEcoule !== null && i.statut === "cours" ? i.tempsEcoule + " % de la période écoulée" : "") + "</dl>" +
      '<p class="mention">Les chiffres sont recalculés à chaque ouverture à partir de vos actions : messages envoyés, appels enregistrés dans « Phoning et prospection », contacts notés dans « Compte Rendu d\'Entretien (CRE) » et rendez-vous planifiés depuis la campagne, contrats souscrits dans le catalogue entre le début et la fin, refus notés ici ou lors d\'un appel. « Contactés » = clients ayant reçu un message de la campagne, ayant été joints par téléphone, reçus en entretien, ayant un rendez-vous de la campagne, un refus noté ou un contrat. Un appel resté sans réponse ne compte pas comme un contact : le client reste à contacter.</p>';
  }
  function jalonsHtml(k) {
    var st = store(), auj = B.aujourdhui();
    return '<ul class="cg-jalons">' + CA.jalons(k).map(function (j) {
      var dans = CA.jalonDansAgenda(st, k, j), passe = B.ecartJours(j.date, auj) < 0;
      return '<li><span class="cg-j-date"><strong>' + esc(maj1(B.fmtLong(j.date))) + "</strong></span><span>" + esc(j.lib) + "</span><span class=\"cg-j-act\">" +
        (dans ? '<span class="puce puce-ok">Dans votre agenda</span>' : passe ? '<span class="puce">Date passée</span>' : '<button type="button" class="btn-texte" data-act="jalon" data-k="' + j.k + '" aria-label="Ajouter à l\'agenda : ' + esc(j.lib) + '">Ajouter à l\'agenda</button>') + "</span></li>";
    }).join("") + "</ul>";
  }
  var FILTRES = [["tous", "Tous les clients"], ["a_contacter", "À contacter"], ["tentative", "Appel sans réponse"], ["message", "Message envoyé"], ["appel", "Appelé et joint"], ["rdv", "Rendez-vous pris"], ["face", "Reçu en entretien"], ["souscrit", "Contrat souscrit"], ["refus", "Refus"], ["detient", "Détient déjà le produit"]];
  function detailLigne(x) {
    var d = [];
    if (x.sub) d.push("Contrat du " + dateTxt(x.sub.date));
    if (x.refus) d.push("Refus du " + dateTxt(x.refus.date) + " : " + x.refus.motif.toLowerCase());
    if (x.rdv) d.push(pl(x.rdv, "rendez-vous", "rendez-vous"));
    if (x.msg) d.push(pl(x.msg, "message", "messages"));
    if (x.face) d.push(pl(x.face, "entretien", "entretiens"));
    if (x.appels) d.push(pl(x.appels, "appel", "appels") + (x.joints ? " dont " + pl(x.joints, "abouti", "aboutis") : ", aucun abouti"));
    return d.join(" – ");
  }
  function actionsLigne(k, x) {
    var h = '<a href="phoning.html?client=' + x.id + "&amp;campagne=" + k.id + '" aria-label="Appeler ' + esc(nomCourt(x.client)) + '">Appeler</a>' +
      '<a href="messagerie.html?client=' + x.id + "&amp;campagne=" + k.id + '" aria-label="Écrire à ' + esc(nomCourt(x.client)) + '">Écrire</a>' +
      '<a href="agenda.html?client=' + x.id + "&amp;type=rdv&amp;campagne=" + k.id + '" aria-label="Planifier un rendez-vous avec ' + esc(nomCourt(x.client)) + '">Rendez-vous</a>' +
      '<a href="contacts.html?client=' + x.id + "&amp;campagne=" + k.id + '" aria-label="Entretien : rédiger un CRE avec ' + esc(nomCourt(x.client)) + '">Entretien</a>';
    if (x.etat === "souscrit" || x.etat === "detient") return h;
    if (x.refus) return h + '<button type="button" class="btn-texte" data-act="annuler-refus" data-id="' + x.id + '" aria-label="Annuler le refus de ' + esc(nomCourt(x.client)) + '">Annuler le refus</button>';
    if (etat.refus === x.id) return h + '<span class="cg-refus"><label class="sr" for="cg-motif">Motif du refus de ' + esc(nomCourt(x.client)) + '</label><select id="cg-motif">' + CA.MOTIFS_REFUS.map(function (m) { return "<option>" + esc(m) + "</option>"; }).join("") + '</select><button type="button" class="btn-texte" data-act="refus-ok" data-id="' + x.id + '">Noter</button><button type="button" class="btn-texte" data-act="refus-non">Annuler</button></span>';
    return h + '<button type="button" class="btn-texte" data-act="refus" data-id="' + x.id + '" aria-label="Noter un refus de ' + esc(nomCourt(x.client)) + '">Noter un refus</button>';
  }
  function lignesFiltrees(k) {
    var l = CA.suivi(store(), k).sort(function (a, b) { return P.nomListe(a.client) < P.nomListe(b.client) ? -1 : 1; });
    return etat.filtre === "tous" ? l : l.filter(function (x) { return x.etat === etat.filtre; });
  }
  function suiviHtml(k) {
    var tout = CA.suivi(store(), k), cmpt = {}; tout.forEach(function (x) { cmpt[x.etat] = (cmpt[x.etat] || 0) + 1; });
    var l = lignesFiltrees(k), vus = l.slice(0, etat.nbLignes);
    var h = '<div class="cg-filtre"><label for="cg-filtre">Afficher</label><select id="cg-filtre">' + FILTRES.map(function (f) { return '<option value="' + f[0] + '"' + (etat.filtre === f[0] ? " selected" : "") + ">" + f[1] + (f[0] === "tous" ? " (" + tout.length + ")" : " (" + (cmpt[f[0]] || 0) + ")") + "</option>"; }).join("") + "</select></div>";
    if (!l.length) return h + '<p class="vide-bloc">Aucun client dans cet état.</p>';
    h += '<div class="tab-wrap tab-defile" role="region" aria-label="Clients de la campagne" tabindex="0"><table class="tab tab-cg"><caption class="sr">Clients de la campagne et leur état</caption><thead><tr><th scope="col" class="gauche">Client</th><th scope="col" class="gauche">État</th><th scope="col" class="gauche">Détail</th><th scope="col" class="gauche">Actions</th></tr></thead><tbody>' +
      vus.map(function (x) {
        var c = x.client;
        return '<tr><th scope="row"><a href="' + lienClient(c) + '">' + esc(nomCourt(c)) + '</a><span class="pf-sous">' + c.age + " ans – " + esc(c.pro.prof) + '</span></th><td class="gauche"><span class="' + CLASSE_ETAT[x.etat] + '">' + esc(CA.ETATS[x.etat]) + '</span></td><td class="gauche">' + esc(detailLigne(x) || "–") + '</td><td class="cg-act">' + actionsLigne(k, x) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
    if (l.length > vus.length) h += '<p><button type="button" class="btn btn-secondaire" data-act="plus">Afficher les ' + Math.min(50, l.length - vus.length) + " clients suivants (" + (l.length - vus.length) + " restants)</button></p>";
    return h;
  }
  function detailHtml() {
    var st = store(), k = etat.ouverte ? CA.trouver(st, etat.ouverte) : null;
    if (!k) return "";
    var i = CA.indicateurs(st, k), p = PR.parId[k.produit];
    return '<section class="bloc cg-detail" id="bloc-detail" aria-labelledby="t-detail"><div class="bloc-tete"><h2 id="t-detail" tabindex="-1">' + esc(k.nom) + ' <span class="' + CLASSE_STATUT[i.statut] + '">' + esc(CA.STATUTS[i.statut]) + '</span></h2><span class="ag-outils"><a class="btn btn-secondaire" id="cg-bilan" href="bilan.html?campagne=' + k.id + '">Voir le bilan</a><button type="button" class="btn btn-secondaire" data-act="modifier" data-id="' + k.id + '">' + ICO.crayon + 'Modifier</button><button type="button" class="btn btn-secondaire" data-act="imprimer">' + ICO.imprimante + 'Imprimer la fiche</button><button type="button" class="btn-texte" data-act="fermer-detail">Fermer</button></span></div>' +
      '<dl class="cg-carte-id"><div><dt>Produit</dt><dd><a href="catalogue.html?produit=' + p.id + '">' + esc(p.nom) + '</a></dd></div><div><dt>Moyens prévus</dt><dd>' + esc(CA.moyensTexte(k) || "non précisés") + '</dd></div><div><dt>Période</dt><dd>' + esc(periode(k)) + " – " + pl(i.jours.total, "jour ouvré", "jours ouvrés") + '</dd></div><div><dt>Cible</dt><dd>' + esc(k.source) + " : " + pl(k.ids.length, "client retenu", "clients retenus") + (k.ecartes ? ", " + pl(k.ecartes, "écarté", "écartés") + " à la création (non éligibles ou détenteurs)" : "") + '</dd></div><div><dt>Objectif</dt><dd>' + pl(k.objectif, "contrat", "contrats") + ' – créée le ' + esc(dateTxt(k.creee)) + "</dd></div></dl>" +
      '<h3 class="sous-titre">Indicateurs</h3>' + kpisHtml(k, i) +
      '<h3 class="sous-titre">Argumentaire</h3><ul class="cg-args">' + k.args.map(function (a) { return "<li>" + esc(a) + "</li>"; }).join("") + "</ul>" +
      '<h3 class="sous-titre">Calendrier conseillé</h3>' + jalonsHtml(k) +
      '<h3 class="sous-titre">Suivi client par client</h3><div id="z-suivi">' + suiviHtml(k) + "</div></section>";
  }
  function majDetail() { document.getElementById("z-detail").innerHTML = detailHtml(); }
  function majSuivi() { var k = etat.ouverte ? CA.trouver(store(), etat.ouverte) : null; var z = document.getElementById("z-suivi"); if (k && z) z.innerHTML = suiviHtml(k); }

  /* ---------- impression ---------- */
  function docCampagne() {
    var st = store(), k = CA.trouver(st, etat.ouverte), i = CA.indicateurs(st, k), p = PR.parId[k.produit], corps = "";
    corps += '<section class="dp-bloc"><h2>Campagne</h2><table class="dp-pf dp-camp-id"><tbody><tr><th scope="row" class="g">Produit</th><td class="g">' + esc(p.nom) + '</td></tr><tr><th scope="row" class="g">Moyens prévus</th><td class="g">' + esc(CA.moyensTexte(k) || "non précisés") + '</td></tr><tr><th scope="row" class="g">Période</th><td class="g">' + esc(periode(k)) + " (" + pl(i.jours.total, "jour ouvré", "jours ouvrés") + ')</td></tr><tr><th scope="row" class="g">Cible</th><td class="g">' + esc(k.source) + " : " + pl(k.ids.length, "client retenu", "clients retenus") + '</td></tr><tr><th scope="row" class="g">Objectif</th><td class="g">' + pl(k.objectif, "contrat", "contrats") + "</td></tr></tbody></table></section>";
    corps += '<section class="dp-bloc"><h2>Indicateurs au ' + esc(B.fmtDate(B.aujourdhui())) + '</h2><dl class="dp-chiffres"><div><dt>Clients ciblés</dt><dd>' + i.cibles + "</dd></div><div><dt>Contactés</dt><dd>" + i.contactes + " (" + pc(i.tauxContact) + ")</dd></div><div><dt>Avec rendez-vous</dt><dd>" + i.rdv + "</dd></div><div><dt>Appels</dt><dd>" + i.appels + " (" + i.joints + " client" + (i.joints > 1 ? "s joints" : " joint") + ")</dd></div><div><dt>Contrats</dt><dd>" + i.contrats + " / " + k.objectif + " (" + pc(i.atteinte) + ")</dd></div><div><dt>Transformation</dt><dd>" + pc(i.tauxTransformation) + "</dd></div><div><dt>Reste à faire</dt><dd>" + i.resteAFaire + "</dd></div></dl></section>";
    corps += '<section class="dp-bloc"><h2>Argumentaire</h2><ul class="dp-liste">' + k.args.map(function (a) { return "<li>" + esc(a) + "</li>"; }).join("") + "</ul></section>";
    corps += '<section class="dp-bloc"><h2>Calendrier conseillé</h2><ul class="dp-liste">' + CA.jalons(k).map(function (j) { return "<li>" + esc(maj1(B.fmtLong(j.date))) + " : " + esc(j.lib) + "</li>"; }).join("") + "</ul></section>";
    var l = CA.suivi(st, k).sort(function (a, b) { return P.nomListe(a.client) < P.nomListe(b.client) ? -1 : 1; });
    corps += '<section class="dp-long"><h2>Suivi client par client (' + l.length + ')</h2><table class="dp-pf dp-camp"><thead><tr><th scope="col" class="g">Client</th><th scope="col" class="g">Âge</th><th scope="col" class="g">État</th><th scope="col" class="g">Détail</th></tr></thead><tbody>' + l.map(function (x) {
      return '<tr><td class="g">' + esc(nomCourt(x.client)) + '</td><td class="g">' + x.client.age + ' ans</td><td class="g">' + esc(CA.ETATS[x.etat]) + '</td><td class="g">' + esc(detailLigne(x) || "–") + "</td></tr>";
    }).join("") + '</tbody></table><p class="dp-mention">Indicateurs recalculés à partir des messages, rendez-vous et contrats enregistrés dans l\'outil.</p></section>';
    IMP.imprimer(IMP.document({ titre: "Campagne : " + k.nom, sous: periode(k) + " – Agence de Paris", corps: corps }), IMP.nomFichier("Campagne_" + k.nom));
  }

  /* ---------- page ---------- */
  function render() {
    app.innerHTML = '<nav class="fil-ariane" aria-label="Fil d\'Ariane"><a href="index.html">' + ICO.retour + "Accueil</a><span aria-hidden=\"true\">/</span><span>Campagnes commerciales</span></nav>" +
      '<div class="page-titre"><h1>Campagnes commerciales</h1><p>' + esc(B.fmtLong(B.aujourdhui())) + " – objectif, cible, argumentaire, calendrier et indicateurs</p></div>" +
      '<div id="z-msg"></div><div class="page-grille">' +
      '<section class="bloc" aria-labelledby="t-liste"><div class="bloc-tete"><h2 id="t-liste" tabindex="-1">Mes campagnes</h2><span class="ag-outils"><span class="sous" id="cg-nb"></span><button type="button" class="btn btn-principal" id="t-nouvelle" data-act="nouvelle">Nouvelle campagne</button></span></div><div id="z-liste"></div></section>' +
      '<div id="z-form"></div><div id="z-detail"></div></div>' +
      '<p class="mention" style="margin-top:16px">Vos campagnes sont enregistrées dans ce navigateur, sur cet ordinateur.</p>';
    majListe(); majForm(); majDetail();
  }

  /* ---------- événements ---------- */
  app.addEventListener("input", function (e) {
    var t = e.target;
    if (t.id === "cg-args" && etat.form) etat.form.argsModifies = true;
  });
  app.addEventListener("change", function (e) {
    var t = e.target, f = etat.form;
    if (f && (t.id === "cg-produit" || t.id === "cg-cible" || t.name === "cg-src")) {
      var avant = f.produit; lireForm(); f.err = null;
      if (t.id === "cg-produit" && f.produit !== avant && (!f.argsModifies || !f.args.trim())) { f.args = f.produit ? CA.argumentsSuggeres(f.produit).join("\n") : ""; f.argsModifies = false; }
      if (t.name === "cg-src") { if (f.sourceType === "eligibles") f.cible = ""; majForm(); var s = app.querySelector('input[name="cg-src"]:checked'); if (s) s.focus(); }
      else { majForm(); var m = document.getElementById(t.id); if (m) m.focus(); }
    } else if (t.id === "cg-filtre") { etat.filtre = t.value; etat.nbLignes = 50; majSuivi(); var s2 = document.getElementById("cg-filtre"); if (s2) s2.focus(); }
  });
  app.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b) return;
    var act = b.getAttribute("data-act"), id = b.getAttribute("data-id"), st = store();
    if (act === "nouvelle") ouvrirForm(formVide(null, null));
    else if (act === "fermer-form") fermerForm();
    else if (act === "ouvrir") { etat.ouverte = id; etat.filtre = "tous"; etat.nbLignes = 50; etat.refus = null; majListe(); majDetail(); var t = document.getElementById("t-detail"); if (t) { t.scrollIntoView({ block: "start" }); t.focus(); } }
    else if (act === "fermer-detail") { var o = etat.ouverte; etat.ouverte = null; majListe(); majDetail(); var c0 = document.getElementById("cg-" + o); if (c0) c0.focus(); }
    else if (act === "modifier") { var k = CA.trouver(st, id); if (k) ouvrirForm(formDe(k), "cg-nom"); }
    else if (act === "suppr") { etat.supprimer = id; majListe(); var c1 = app.querySelector('[data-act="suppr-oui"]'); if (c1) c1.focus(); }
    else if (act === "suppr-non") { var ci = etat.supprimer; etat.supprimer = null; majListe(); var b2 = app.querySelector('[data-act="suppr"][data-id="' + ci + '"]'); if (b2) b2.focus(); }
    else if (act === "suppr-oui") {
      var nom = (CA.trouver(st, id) || {}).nom;
      if (CA.supprimer(st, id)) B.store.sauver();
      if (etat.ouverte === id) etat.ouverte = null;
      if (etat.form && etat.form.id === id) etat.form = null;
      etat.supprimer = null; etat.msg = "Campagne supprimée : « " + nom + " ». Les messages et rendez-vous déjà créés restent dans la messagerie et l'agenda.";
      majForm(); majListe(); majDetail(); majMsg(); var ok = document.getElementById("cg-ok"); if (ok) ok.focus();
    }
    else if (act === "jalon") {
      var r = CA.ajouterJalon(st, etat.ouverte, b.getAttribute("data-k"));
      if (!r.ok) { etat.msg = r.erreur; majMsg(); } else { B.store.sauver(); etat.msg = "Ajouté à votre agenda : rappel du " + B.fmtLong(r.jalon.date) + " – « " + r.jalon.objet + " »."; majMsg(); }
      majDetail(); var o2 = document.getElementById("cg-ok"); if (o2) { o2.scrollIntoView({ block: "center" }); o2.focus(); }
    }
    else if (act === "refus") { etat.refus = parseInt(id, 10); majSuivi(); var m = document.getElementById("cg-motif"); if (m) m.focus(); }
    else if (act === "refus-non") { var cr = etat.refus; etat.refus = null; majSuivi(); var b3 = app.querySelector('[data-act="refus"][data-id="' + cr + '"]'); if (b3) b3.focus(); }
    else if (act === "refus-ok") {
      var motif = document.getElementById("cg-motif").value, rr = CA.refuser(st, etat.ouverte, parseInt(id, 10), motif);
      etat.refus = null;
      if (!rr.ok) { etat.msg = rr.erreur; majMsg(); } else { B.store.sauver(); etat.msg = ""; majMsg(); }
      majDetail(); majListe();
      var h2 = document.getElementById("t-detail"); if (h2) h2.focus();
    }
    else if (act === "annuler-refus") { if (CA.annulerRefus(st, etat.ouverte, parseInt(id, 10))) B.store.sauver(); etat.msg = ""; majMsg(); majDetail(); majListe(); }
    else if (act === "plus") { etat.nbLignes += 50; majSuivi(); }
    else if (act === "imprimer") docCampagne();
  });
  app.addEventListener("submit", function (e) { if (e.target.id === "form-cg") { e.preventDefault(); enregistrer(); } });

  RECH.init(CL, document.getElementById("rech"), document.getElementById("rech-res"), document.getElementById("rech-statut"));
  render();
  /* Paramètres d'adresse : ?campagne=ID (ouvre la fiche), ?nouvelle=1&cible=ID&produit=ID (formulaire prérempli, depuis le portefeuille ou le catalogue). */
  var pk = params.get("campagne"), pn = params.get("nouvelle"), pcb = params.get("cible"), pp = params.get("produit");
  if (pk && CA.trouver(store(), pk)) { etat.ouverte = pk; majListe(); majDetail(); var td = document.getElementById("t-detail"); if (td) td.focus(); }
  else if (pn) ouvrirForm(formVide(pp, pcb && P.trouverCible(store(), pcb) ? pcb : null), "cg-nom");
})();
