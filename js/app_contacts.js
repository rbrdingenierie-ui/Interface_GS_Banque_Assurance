/* GS Banque & Assurance – Compte Rendu d'Entretien (CRE), volet « Rédiger un CRE » : rédiger le compte rendu d'un entretien avec un client à l'accueil ou lors d'un rendez-vous (produit abordé, rebond commercial, résultat), journal, impression. */
(function () {
  "use strict";

  var B = window.SGBF.banque, CT = window.SGBF.contacts, CA = window.SGBF.campagnes, K = window.SGBF.catalogue, P = window.SGBF.portefeuille, PR = window.SGBF.produits, AG = window.SGBF.agenda;
  var ICO = window.SGBF.icones, RECH = window.SGBF.recherche, IMP = window.SGBF.impression, CL = window.SGBF.clients;
  var VOL = window.SGBF.volets;
  var app = (VOL && VOL.panneau("contact")) || document.getElementById("app");
  var esc = B.esc;
  var CLIENT = {}; CL.forEach(function (c) { CLIENT[c.id] = c; });
  function store() { return B.store.charger(); }
  function pl(n, s, p) { return B.nb(n) + " " + (n > 1 ? p : s); }
  function nomCourt(c) { return c.prenom + " " + c.nom; }
  function lienClient(c) { return "client.html?id=" + c.id; }
  function nomProduit(pid) { return PR.parId[pid] ? PR.parId[pid].nom : pid; }
  function dateTxt(ymd) { return B.fmtDate(B.lireYmd(ymd)); }
  var CLASSE_RES = { souscrit: "puce puce-ok", rdv: "puce puce-ok", reflexion: "puce puce-warn", refus: "puce puce-bad" };
  var VERDICTS = { eligible: "éligible", examiner: "à examiner", detenu: "déjà détenu", non: "non éligible" };
  var params = new URLSearchParams(location.search);
  var etat = { form: null, msgHtml: "", supprimer: null, filtre: "tous", nbJ: 30 };

  /* ---------- formulaire : valeurs ---------- */
  function dateParDefaut() { return B.ymd(B.agencePrecedent(B.aujourdhui())); }
  /* Aujourd'hui : l'heure actuelle si l'agence est ouverte, sinon l'heure d'ouverture ou de fermeture la plus proche qui ne soit pas dans le futur. */
  function heureParDefaut(ymd) {
    if (ymd !== B.ymd(B.aujourdhui())) return "10:00";
    var h = B.hhmm(B.maintenant()), pl = AG.plages(B.aujourdhui());
    if (!pl.length) return "10:00";
    if (h < pl[0][0]) return pl[0][0];
    var res = h;
    pl.forEach(function (p) { if (h > p[1]) res = p[1]; });
    return res;
  }
  function jourParDefaut() { return B.ymd(B.agenceSuivant(B.plusJours(B.aujourdhui(), 1))); }
  function formVide(cid, o) {
    o = o || {};
    var d = dateParDefaut();
    var f = { client: cid || "", lieu: CT.LIEUX[o.lieu] ? o.lieu : "", date: d, heure: heureParDefaut(d), camp: "", prod: "", rebond: "", rdvLie: "", res: "", motif: "", note: "",
      suiteDate: "", suiteHeure: "10:00", suiteCanal: CT.CANAUX_RDV[0], err: null };
    var k = o.camp && cid ? CA.trouver(store(), o.camp) : null;
    if (k && k.ids.indexOf(cid) >= 0) { f.camp = k.id; f.prod = k.produit; }
    return f;
  }
  function erreurChamp(champ) { return etat.form && etat.form.err && etat.form.err.champ === champ; }
  function attrErr(champ) { return erreurChamp(champ) ? ' aria-invalid="true" aria-describedby="ct-err"' : ""; }

  /* ---------- zones du formulaire ---------- */
  function selectClient(f) {
    var l = CL.slice().sort(function (a, b) { return P.nomListe(a) < P.nomListe(b) ? -1 : 1; });
    return '<div class="champ"><label for="ct-client">Client reçu *</label><select id="ct-client"' + attrErr("client") + '><option value="">Choisir un client</option>' + l.map(function (c) {
      return '<option value="' + c.id + '"' + (String(f.client) === String(c.id) ? " selected" : "") + ">" + esc(P.nomListe(c)) + " – " + c.age + " ans</option>";
    }).join("") + "</select></div>";
  }
  function zoneLieu(f) {
    return '<fieldset class="pf-source ap-base"' + attrErr("lieu") + '><legend>Où a eu lieu l\'entretien ? *</legend>' + CT.ORDRE_LIEUX.map(function (k) {
      return '<label class="pf-radio" for="ct-lieu-' + k + '"><input type="radio" id="ct-lieu-' + k + '" name="ct-lieu" value="' + k + '"' + (f.lieu === k ? " checked" : "") + "> " + esc(CT.LIEUX[k].lib) + "</label>";
    }).join("") + '<p class="aide-champ">' + esc(f.lieu ? CT.LIEUX[f.lieu].aide : "L'agence est ouverte " + AG.HORAIRES_LIB + " (règle de l'agence).") + "</p></fieldset>";
  }
  function zoneProduit(f) {
    var st = store(), c = CLIENT[f.client], camps = CT.campagnesDuClient(st, c.id, f.date), k = f.camp ? CA.trouver(st, f.camp) : null;
    var h = '<div class="champ"><label for="ct-camp">Campagne (facultatif)</label><select id="ct-camp"' + attrErr("camp") + '><option value="">Aucune campagne</option>' + camps.map(function (x) {
      return '<option value="' + x.id + '"' + (f.camp === x.id ? " selected" : "") + ">" + esc(x.nom) + "</option>";
    }).join("") + '</select><p class="aide-champ">' + (camps.length ? "Une campagne reprend son produit ; l\'entretien compte dans ses indicateurs." : "Ce client ne fait partie d'aucune campagne dont la période comprend cette date.") + "</p></div>";
    if (k) return h + '<p class="cg-fixe"><strong>Produit de la campagne :</strong> ' + esc(nomProduit(k.produit)) + ".</p>";
    return h + '<div class="champ"><label for="ct-prod">Produit abordé *</label><select id="ct-prod"' + attrErr("prod") + '><option value="">Choisir un produit</option>' + optionsProduits(st, c, f.prod, "") + '</select><p class="aide-champ">Les crédits ne figurent pas dans la liste : ils se montent dans « Montage de prêt ».</p></div>';
  }
  function optionsProduits(st, c, choisi, exclu) {
    return PR.univers.map(function (fa) {
      var ps = CT.produitsPossibles().filter(function (p) { return PR.universDe(p) === fa && p.id !== exclu; });
      return ps.length ? '<optgroup label="' + esc(fa.nom) + '">' + ps.map(function (p) {
        var v = CT.verdictProduit(st, c, p.id), off = v === "detenu" || v === "non";
        return '<option value="' + p.id + '"' + (choisi === p.id ? " selected" : "") + (off ? " disabled" : "") + ">" + esc(p.nom) + " (" + VERDICTS[v] + ")</option>";
      }).join("") + "</optgroup>" : "";
    }).join("");
  }
  function zoneRebond(f) {
    var st = store(), c = CLIENT[f.client], k = f.camp ? CA.trouver(st, f.camp) : null, pid = k ? k.produit : f.prod;
    return '<div class="champ"><label for="ct-rebond">Rebond commercial : autre produit proposé pendant l\'entretien (facultatif)</label><select id="ct-rebond"' + attrErr("rebond") + '><option value="">Aucun rebond</option>' + optionsProduits(st, c, f.rebond, pid) +
      '</select><p class="aide-champ">Un rebond : vous profitez de l\'entretien pour proposer un autre produit que celui abordé au départ. Le bilan compte les rebonds utilisés et ceux qui ont abouti à une souscription.</p></div>';
  }
  function zoneRdvLie(f) {
    if (f.lieu !== "rdv") return "";
    var l = CT.rendezVousATenir(store(), parseInt(f.client, 10), f.date);
    if (!l.length) return '<p class="aide-champ">Aucun rendez-vous de votre agenda n\'est à clôturer pour ce client à cette date : le CRE sera enregistré seul.</p>';
    return '<div class="champ"><label for="ct-rdvlie">Rendez-vous de votre agenda (facultatif)</label><select id="ct-rdvlie"' + attrErr("rdvLie") + '><option value="">Aucun</option>' + l.map(function (x) {
      return '<option value="' + x.id + '"' + (f.rdvLie === x.id ? " selected" : "") + ">" + esc(B.fmtLong(B.lireYmd(x.date)) + (x.heure ? " à " + CT.heureLib(x.heure) : "") + " – " + x.objet) + "</option>";
    }).join("") + '</select><p class="aide-champ">Le rendez-vous choisi est marqué « Fait » dans votre agenda.</p></div>';
  }
  function zoneResultat(f) {
    return '<fieldset class="pf-source ap-res"' + attrErr("res") + '><legend>Résultat de l\'entretien *</legend>' + CT.ORDRE_RESULTATS.map(function (k) {
      return '<label class="pf-radio" for="ct-res-' + k + '"><input type="radio" id="ct-res-' + k + '" name="ct-res" value="' + k + '"' + (f.res === k ? " checked" : "") + "> " + esc(CT.RESULTATS[k].lib) + "</label>";
    }).join("") + "</fieldset>";
  }
  function zoneResExtra(f) {
    var r = CT.RESULTATS[f.res], h = "", auj = B.ymd(B.aujourdhui());
    if (!r) return '<p class="aide-champ">Choisissez le résultat : ce que le client a décidé.</p>';
    h += '<p class="aide-champ ap-aide-res">' + esc(r.aide) + "</p>";
    if (r.motif) h += '<div class="champ ap-extra"><label for="ct-motif">Motif du refus *</label><select id="ct-motif"' + attrErr("motif") + '><option value="">Choisir un motif</option>' + CA.MOTIFS_REFUS.map(function (m) { return "<option" + (f.motif === m ? " selected" : "") + ">" + esc(m) + "</option>"; }).join("") + "</select></div>";
    if (r.suite) {
      var sd = f.suiteDate || jourParDefaut();
      h += '<div class="ligne ap-extra"><div class="champ"><label for="ct-sdate">Date du rendez-vous *</label><input id="ct-sdate" type="date" min="' + auj + '" value="' + esc(sd) + '"' + attrErr("suiteDate") + '></div>' +
        '<div class="champ"><label for="ct-sheure">Heure *</label><input id="ct-sheure" type="time" value="' + esc(f.suiteHeure) + '"' + attrErr("suiteHeure") + "></div>" +
        '<div class="champ"><label for="ct-scanal">Où ?</label><select id="ct-scanal"' + attrErr("suiteCanal") + ">" + CT.CANAUX_RDV.map(function (c) { return "<option" + (f.suiteCanal === c ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("") + "</select></div></div>";
    }
    return h + '<div class="champ"><label for="ct-note">Compte rendu de l\'entretien *</label><textarea id="ct-note" rows="3" maxlength="' + CT.MAX_NOTE + '"' + attrErr("note") + ' placeholder="Ce que le client a dit, ce qui a été convenu">' + esc(f.note) + "</textarea></div>";
  }
  function formHtml() {
    var f = etat.form, c = f.client ? CLIENT[f.client] : null, auj = B.ymd(B.aujourdhui());
    var h = '<section class="bloc ap-form-bloc" id="bloc-form" aria-labelledby="t-form"><div class="bloc-tete"><h2 id="t-form" tabindex="-1">Rédiger un compte rendu d\'entretien (CRE)</h2><span class="sous">Les champs marqués d\'une étoile sont obligatoires.</span></div>' +
      '<form class="formulaire ap-form" id="form-ct" novalidate>' + selectClient(f);
    if (!c) return h + '<p class="aide-champ">Choisissez le client reçu : le formulaire se complète ensuite (lieu, produit, rebond, résultat).</p><p class="msg-erreur" id="ct-err" role="alert">' + (f.err ? esc(f.err.erreur) : "") + "</p></form></section>";
    h += '<p class="cg-fixe"><a href="' + lienClient(c) + '">' + esc(c.civ + " " + c.prenom + " " + c.nom) + "</a> – " + c.age + " ans – " + esc(c.pro.prof) + ".</p>" +
      '<fieldset class="ap-etape"><legend>1. L\'entretien</legend><div id="z-lieu">' + zoneLieu(f) + "</div>" +
      '<div class="ligne ap-moment"><div class="champ"><label for="ct-date">Date de l\'entretien *</label><input id="ct-date" type="date" min="' + B.ymd(B.plusJours(B.aujourdhui(), -CT.PASSE_MAX)) + '" max="' + auj + '" value="' + esc(f.date) + '"' + attrErr("date") + '></div>' +
      '<div class="champ"><label for="ct-heure">Heure de l\'entretien *</label><input id="ct-heure" type="time" min="' + AG.HEURE_MIN + '" max="' + AG.HEURE_MAX + '" value="' + esc(f.heure) + '"' + attrErr("heure") + '></div></div>' +
      '<div id="z-rdvlie">' + zoneRdvLie(f) + "</div></fieldset>" +
      '<fieldset class="ap-etape"><legend>2. Ce qui a été proposé</legend><div id="z-produit">' + zoneProduit(f) + '</div><div id="z-rebond">' + zoneRebond(f) + "</div></fieldset>" +
      '<fieldset class="ap-etape"><legend>3. Résultat de l\'entretien</legend><div id="z-res">' + zoneResultat(f) + '</div><div id="z-res-extra">' + zoneResExtra(f) + "</div></fieldset>" +
      '<p class="msg-erreur" id="ct-err" role="alert">' + (f.err ? esc(f.err.erreur) : "") + "</p>" +
      '<div class="pf-btns"><button type="submit" class="btn btn-principal">Enregistrer le CRE</button><button type="button" class="btn btn-secondaire" data-act="fermer-form">Annuler</button></div></form></section>';
    return h;
  }
  function majForm() { document.getElementById("z-form").innerHTML = formHtml(); }
  function lireForm() {
    var f = etat.form; if (!f) return;
    function v(id) { var e = document.getElementById(id); return e ? e.value : null; }
    var cl = v("ct-client"); if (cl !== null) f.client = cl;
    var l = app.querySelector('input[name="ct-lieu"]:checked'); f.lieu = l ? l.value : f.lieu;
    var d = v("ct-date"); if (d !== null) f.date = d;
    var h = v("ct-heure"); if (h !== null) f.heure = h;
    var rl = v("ct-rdvlie"); if (rl !== null) f.rdvLie = rl;
    var ca = v("ct-camp"); if (ca !== null) f.camp = ca;
    var pr = v("ct-prod"); if (pr !== null) f.prod = pr;
    var rb = v("ct-rebond"); if (rb !== null) f.rebond = rb;
    var r = app.querySelector('input[name="ct-res"]:checked'); f.res = r ? r.value : f.res;
    var m = v("ct-motif"); if (m !== null) f.motif = m;
    var sd = v("ct-sdate"); if (sd !== null) f.suiteDate = sd;
    var sh = v("ct-sheure"); if (sh !== null) f.suiteHeure = sh;
    var sc = v("ct-scanal"); if (sc !== null) f.suiteCanal = sc;
    var n = v("ct-note"); if (n !== null) f.note = n;
  }
  function majMsg() { var z = document.getElementById("z-msg"); if (z) z.innerHTML = etat.msgHtml ? '<div class="ag-ok ap-ok" id="ct-ok" tabindex="-1" role="status">' + etat.msgHtml + "</div>" : ""; }

  var CHAMP_ID = { client: "ct-client", lieu: "ct-lieu-accueil", date: "ct-date", heure: "ct-heure", camp: "ct-camp", prod: "ct-prod", rebond: "ct-rebond", rdvLie: "ct-rdvlie", res: "ct-res-souscrit", motif: "ct-motif", note: "ct-note", suiteDate: "ct-sdate", suiteHeure: "ct-sheure", suiteCanal: "ct-scanal" };
  function messageApres(x) {
    var c = CLIENT[x.c], r = CT.RESULTATS[x.res], h = "<p><strong>CRE enregistré :</strong> " + esc(nomCourt(c)) + ", " + esc(CT.LIEUX[x.lieu].lib.toLowerCase()) + ", " + esc(CT.quand(x)) + " – " + esc(nomProduit(x.prod)) + " – " + esc(r.lib.toLowerCase()) + ".</p>", l = [];
    if (x.rebond) l.push("Rebond noté : " + esc(nomProduit(x.rebond)) + ".");
    if (x.suite) l.push("Rendez-vous ajouté à votre agenda le " + esc(B.fmtLong(B.lireYmd(x.suite.date))) + " à " + esc(CT.heureLib(x.suite.heure)) + ' (<a href="agenda.html">ouvrir l\'agenda</a>).');
    if (x.rdvLie) l.push("Le rendez-vous de votre agenda est marqué « Fait ».");
    if (x.refusCamp) l.push("Refus noté dans la campagne.");
    if (x.res === "souscrit") l.push('<a href="catalogue.html?produit=' + x.prod + "&amp;client=" + c.id + "&amp;moyen=" + x.lieu + '">Enregistrer la souscription dans le catalogue</a> (le contrat compte alors dans les résultats).');
    return h + (l.length ? "<ul>" + l.map(function (q) { return "<li>" + q + "</li>"; }).join("") + "</ul>" : "");
  }
  function enregistrer() {
    lireForm();
    var f = etat.form, st = store();
    var r = CT.enregistrer(st, f);
    if (!r.ok) {
      f.err = r; var z = document.getElementById("ct-err"); z.textContent = r.erreur;
      app.querySelectorAll("#form-ct [aria-invalid]").forEach(function (e) { e.removeAttribute("aria-invalid"); e.removeAttribute("aria-describedby"); });
      var e = document.getElementById(CHAMP_ID[r.champ] || "ct-err");
      if (e && e.id !== "ct-err") { e.setAttribute("aria-invalid", "true"); e.setAttribute("aria-describedby", "ct-err"); }
      if (e) { if (!e.hasAttribute("tabindex") && !/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(e.tagName)) e.setAttribute("tabindex", "-1"); e.focus(); }
      return;
    }
    B.store.sauver();
    etat.msgHtml = messageApres(r.contact);
    etat.form = formVide(""); majForm(); majMsg(); majJournal();
    var ok = document.getElementById("ct-ok"); if (ok) { ok.scrollIntoView({ block: "center" }); ok.focus(); }
  }

  /* ---------- journal ---------- */
  var FILTRES = [["tous", "Tous les CRE"]].concat(CT.ORDRE_LIEUX.map(function (k) { return ["l:" + k, CT.LIEUX[k].lib]; })).concat(CT.ORDRE_RESULTATS.map(function (k) { return ["r:" + k, CT.RESULTATS[k].lib]; }));
  function lignesJournal() {
    var l = CT.journal(store());
    if (etat.filtre === "tous") return l;
    var k = etat.filtre.slice(2);
    return l.filter(function (x) { return etat.filtre.charAt(0) === "l" ? x.lieu === k : x.res === k; });
  }
  function compte(filtre, tout) {
    if (filtre === "tous") return tout.length;
    var k = filtre.slice(2);
    return tout.filter(function (x) { return filtre.charAt(0) === "l" ? x.lieu === k : x.res === k; }).length;
  }
  function suiteTxt(x) {
    var d = [];
    if (x.motif) d.push("Motif : " + x.motif.toLowerCase());
    if (x.rebond) d.push("Rebond : " + nomProduit(x.rebond));
    if (x.suite) d.push("Rendez-vous le " + dateTxt(x.suite.date) + " à " + CT.heureLib(x.suite.heure));
    if (x.camp) { var k = CA.trouver(store(), x.camp); if (k) d.push("Campagne « " + k.nom + " »"); }
    return d.join(" – ");
  }
  function souscriptionTxt(x) {
    if (x.res !== "souscrit") return "";
    return CT.souscriptionLiee(store(), x) ? ' <span class="puce puce-ok">Souscription enregistrée</span>' : ' <a class="btn-texte" href="catalogue.html?produit=' + x.prod + "&amp;client=" + x.c + "&amp;moyen=" + x.lieu + '">Souscription à enregistrer</a>';
  }
  function kpisJournal(t) {
    function kpi(lib, val, det) { return '<div class="kpi"><dt>' + esc(lib) + '</dt><dd class="val">' + val + "</dd>" + (det ? '<dd class="det">' + det + "</dd>" : "") + "</div>"; }
    return '<dl class="kpis ap-kpis">' + kpi("Entretiens", B.nb(t.contacts), pl(t.clients, "client reçu", "clients reçus")) + kpi("À l'accueil", B.nb(t.parLieu.accueil), "entretiens sans rendez-vous") + kpi("En rendez-vous", B.nb(t.parLieu.rdv), "entretiens tenus") +
      kpi("Souscriptions", B.nb(t.parResultat.souscrit), "clients qui souscrivent") + kpi("Rendez-vous pris", B.nb(t.parResultat.rdv), pl(t.parResultat.reflexion, "client veut réfléchir", "clients veulent réfléchir")) +
      kpi("Refus", B.nb(t.parResultat.refus), "") + kpi("Rebonds", B.nb(t.rebonds), "autre produit proposé") + "</dl>";
  }
  function journalHtml() {
    var st = store(), tout = CT.journal(st), t = CT.totaux(tout), l = lignesJournal(), vus = l.slice(0, etat.nbJ);
    var nb = document.getElementById("ct-nb"); if (nb) nb.textContent = tout.length ? pl(tout.length, "CRE", "CRE") : "";
    if (!tout.length) return '<p class="vide-bloc">Aucun CRE enregistré. Quand vous recevez un client à l\'accueil ou en rendez-vous et que vous lui proposez un produit, rédigez le CRE avec le formulaire ci-dessus.</p>';
    var h = kpisJournal(t) + '<div class="cg-filtre"><label for="ct-filtre">Afficher</label><select id="ct-filtre">' + FILTRES.map(function (x) {
      return '<option value="' + x[0] + '"' + (etat.filtre === x[0] ? " selected" : "") + ">" + esc(x[1]) + " (" + compte(x[0], tout) + ")</option>";
    }).join("") + '</select><button type="button" class="btn btn-secondaire" data-act="imprimer">Imprimer le journal</button></div>';
    if (!l.length) return h + '<p class="vide-bloc">Aucun CRE dans cette catégorie.</p>';
    h += '<div class="tab-wrap tab-defile" role="region" aria-label="Tableau des comptes rendus d\'entretien (CRE)" tabindex="0"><table class="tab tab-cg ap-tab"><caption class="sr">Comptes rendus d\'entretien (CRE), du plus récent au plus ancien</caption><thead><tr><th scope="col" class="gauche">Date</th><th scope="col" class="gauche">Client et produit</th><th scope="col" class="gauche">Lieu et résultat</th><th scope="col" class="gauche">Compte rendu</th><th scope="col" class="gauche"><span class="sr">Action</span></th></tr></thead><tbody>' +
      vus.map(function (x) {
        var c = CLIENT[x.c], conf = etat.supprimer === x.id;
        return '<tr><td class="gauche">' + esc(dateTxt(x.date)) + '<span class="pf-sous">' + esc(CT.heureLib(x.heure)) + '</span></td><th scope="row"><a href="' + lienClient(c) + '">' + esc(nomCourt(c)) + '</a><span class="pf-sous">' + esc(nomProduit(x.prod)) + "</span></th>" +
          '<td class="gauche">' + esc(CT.LIEUX[x.lieu].court) + ' <span class="' + CLASSE_RES[x.res] + '">' + esc(CT.RESULTATS[x.res].lib) + "</span>" + souscriptionTxt(x) + '</td><td class="gauche">' + esc(x.note || "–") + (suiteTxt(x) ? '<span class="pf-sous">' + esc(suiteTxt(x)) + "</span>" : "") + '</td><td class="gauche cg-act">' +
          (conf ? '<button type="button" class="btn-texte" data-act="suppr-oui" data-id="' + x.id + '">Confirmer la suppression</button><button type="button" class="btn-texte" data-act="suppr-non">Garder</button>' :
            '<button type="button" class="btn-texte" data-act="suppr" data-id="' + x.id + '" aria-label="Supprimer le CRE du ' + esc(dateTxt(x.date)) + " avec " + esc(nomCourt(c)) + '">Supprimer</button>') + "</td></tr>";
      }).join("") + "</tbody></table></div>";
    if (l.length > vus.length) h += '<p><button type="button" class="btn btn-secondaire" data-act="plus-j">Afficher les ' + Math.min(30, l.length - vus.length) + " CRE suivants (" + (l.length - vus.length) + " restants)</button></p>";
    return h;
  }
  function majJournal() { document.getElementById("z-journal").innerHTML = journalHtml(); }

  /* ---------- impression du journal ---------- */
  function docJournal() {
    var st = store(), l = CT.journal(st), t = CT.totaux(l), corps = "";
    corps += '<section class="dp-bloc"><h2>Bilan des entretiens au ' + esc(B.fmtDate(B.aujourdhui())) + '</h2><dl class="dp-chiffres"><div><dt>Entretiens</dt><dd>' + t.contacts + "</dd></div><div><dt>À l\'accueil</dt><dd>" + t.parLieu.accueil + "</dd></div><div><dt>En rendez-vous</dt><dd>" + t.parLieu.rdv + "</dd></div><div><dt>Souscriptions</dt><dd>" + t.parResultat.souscrit + "</dd></div><div><dt>Rendez-vous pris</dt><dd>" + t.parResultat.rdv + "</dd></div><div><dt>Refus</dt><dd>" + t.parResultat.refus + "</dd></div><div><dt>Rebonds</dt><dd>" + t.rebonds + "</dd></div></dl></section>";
    corps += '<section class="dp-long"><h2>CRE enregistrés (' + l.length + ')</h2><table class="dp-pf dp-camp"><thead><tr><th scope="col" class="g">Date</th><th scope="col" class="g">Client</th><th scope="col" class="g">Produit</th><th scope="col" class="g">Lieu</th><th scope="col" class="g">Résultat</th><th scope="col" class="g">Rebond</th><th scope="col" class="g">Compte rendu</th></tr></thead><tbody>' + l.map(function (x) {
      var c = CLIENT[x.c];
      return '<tr><td class="g">' + esc(dateTxt(x.date) + " " + CT.heureLib(x.heure)) + '</td><td class="g">' + esc(nomCourt(c)) + '</td><td class="g">' + esc(nomProduit(x.prod)) + '</td><td class="g">' + esc(CT.LIEUX[x.lieu].court) + '</td><td class="g">' + esc(CT.RESULTATS[x.res].lib + (x.motif ? " (" + x.motif.toLowerCase() + ")" : "")) + '</td><td class="g">' + esc(x.rebond ? nomProduit(x.rebond) : "–") + '</td><td class="g">' + esc(x.note || "–") + "</td></tr>";
    }).join("") + '</tbody></table><p class="dp-mention">Journal établi à partir des comptes rendus d\'entretien enregistrés dans l\'outil.</p></section>';
    IMP.imprimer(IMP.document({ titre: "Journal des comptes rendus d\'entretien (CRE)", sous: "Compte Rendu d'Entretien (CRE) – Agence de Paris", corps: corps }), IMP.nomFichier("Journal_des_CRE"));
  }

  /* ---------- page ---------- */
  function render() {
    /* Dans la page à volets, le fil d'Ariane, le titre et la date sont déjà affichés par volets.js. */
    var entete = VOL ? "" : '<nav class="fil-ariane" aria-label="Fil d\'Ariane"><a href="index.html">' + ICO.retour + "Accueil</a><span aria-hidden=\"true\">/</span><span>Compte Rendu d'Entretien (CRE)</span></nav>" +
      '<div class="page-titre"><h1>Compte Rendu d\'Entretien (CRE)</h1><p>' + esc(B.fmtLong(B.aujourdhui())) + " – noter les clients reçus à l'accueil ou en rendez-vous, et ce qu'ils ont décidé</p></div>";
    app.innerHTML = entete +
      '<div id="z-msg"></div><div class="page-grille"><div id="z-form"></div>' +
      '<section class="bloc" aria-labelledby="t-journal"><div class="bloc-tete"><h2 id="t-journal" tabindex="-1">Journal des CRE</h2><span class="sous" id="ct-nb"></span></div><div id="z-journal"></div></section></div>' +
      '<p class="mention" style="margin-top:16px">Les comptes rendus d\'entretien comptent, avec les appels et les e-mails, dans « Résultats et bilan ». Ils sont enregistrés dans ce navigateur, sur cet ordinateur.</p>';
    majForm(); majJournal();
  }

  /* ---------- événements ---------- */
  app.addEventListener("change", function (e) {
    var t = e.target, f = etat.form;
    if (t.id === "ct-filtre") { etat.filtre = t.value; etat.nbJ = 30; majJournal(); var s = document.getElementById("ct-filtre"); if (s) s.focus(); return; }
    if (!f || !t.closest("#form-ct")) return;
    f.err = null; var er = document.getElementById("ct-err"); if (er) er.textContent = "";
    var avant = { client: f.client, res: f.res, lieu: f.lieu };
    lireForm();
    if (t.id === "ct-client") {
      if (f.client !== avant.client) { f.camp = ""; f.prod = ""; f.rebond = ""; f.rdvLie = ""; }
      majForm(); var c0 = document.getElementById(f.client ? "ct-client" : "ct-client"); if (c0) c0.focus();
    } else if (t.id === "ct-date") {
      var ok = f.client ? CT.campagnesDuClient(store(), parseInt(f.client, 10), f.date).some(function (k) { return k.id === f.camp; }) : true;
      if (f.camp && !ok) { f.camp = ""; f.prod = ""; }
      f.rdvLie = "";
      majForm(); var d0 = document.getElementById("ct-date"); if (d0) d0.focus();
    } else if (t.name === "ct-lieu") {
      if (f.lieu !== "rdv") f.rdvLie = "";
      document.getElementById("z-lieu").innerHTML = zoneLieu(f); document.getElementById("z-rdvlie").innerHTML = zoneRdvLie(f);
    } else if (t.id === "ct-camp") {
      var k = f.camp ? CA.trouver(store(), f.camp) : null; f.prod = k ? k.produit : "";
      if (f.rebond === f.prod) f.rebond = "";
      document.getElementById("z-produit").innerHTML = zoneProduit(f); document.getElementById("z-rebond").innerHTML = zoneRebond(f); var c2 = document.getElementById("ct-camp"); if (c2) c2.focus();
    } else if (t.id === "ct-prod") {
      if (f.rebond === f.prod) f.rebond = "";
      document.getElementById("z-rebond").innerHTML = zoneRebond(f);
    } else if (t.name === "ct-res") {
      if (f.res !== avant.res) { f.motif = ""; if (CT.RESULTATS[f.res] && CT.RESULTATS[f.res].suite && !f.suiteDate) f.suiteDate = jourParDefaut(); }
      document.getElementById("z-res-extra").innerHTML = zoneResExtra(f);
    }
  });
  app.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b) return;
    var act = b.getAttribute("data-act"), id = b.getAttribute("data-id"), st = store();
    if (act === "fermer-form") { etat.form = formVide(""); majForm(); var t = document.getElementById("t-form"); if (t) t.focus(); }
    else if (act === "plus-j") { etat.nbJ += 30; majJournal(); }
    else if (act === "suppr") { etat.supprimer = id; majJournal(); var c1 = app.querySelector('[data-act="suppr-oui"]'); if (c1) c1.focus(); }
    else if (act === "suppr-non") { var ci = etat.supprimer; etat.supprimer = null; majJournal(); var b2 = app.querySelector('[data-act="suppr"][data-id="' + ci + '"]'); if (b2) b2.focus(); }
    else if (act === "suppr-oui") {
      var x = CT.trouver(st, id), r = CT.supprimer(st, id);
      etat.supprimer = null;
      if (r.ok) { B.store.sauver(); etat.msgHtml = "<p>CRE supprimé" + (x ? " : " + esc(nomCourt(CLIENT[x.c])) + ", " + esc(CT.quand(x)) : "") + ".</p>" + (r.retire.length ? "<p>Ont aussi été retirés : " + esc(r.retire.join(", ")) + ".</p>" : "") + (r.garde && r.garde.length ? "<p>À noter : " + esc(r.garde.join(", ")) + ".</p>" : ""); }
      majMsg(); majJournal(); majForm(); var ok = document.getElementById("ct-ok"); if (ok) { ok.scrollIntoView({ block: "center" }); ok.focus(); }
    }
    else if (act === "imprimer") docJournal();
  });
  app.addEventListener("submit", function (e) {
    e.preventDefault();
    if (e.target.id === "form-ct") enregistrer();
  });

  if (!VOL) RECH.init(CL, document.getElementById("rech"), document.getElementById("rech-res"), document.getElementById("rech-statut"));
  /* Paramètres d'adresse : ?client=ID (client déjà choisi), ?campagne=ID (campagne de ce client). */
  var pc = parseInt(params.get("client"), 10);
  etat.form = formVide(CLIENT[pc] ? pc : "", { camp: params.get("campagne") || "", lieu: params.get("lieu") || "" });
  render();
})();
