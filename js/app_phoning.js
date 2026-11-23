/* GS Banque & Assurance – phoning et prospection : qui appeler, fiche d'appel (contrôle avant l'appel, script, objections, résultat), journal des appels, impression. */
(function () {
  "use strict";

  var B = window.SGBF.banque, PH = window.SGBF.phoning, CA = window.SGBF.campagnes, K = window.SGBF.catalogue, P = window.SGBF.portefeuille, PR = window.SGBF.produits, AG = window.SGBF.agenda;
  var ICO = window.SGBF.icones, RECH = window.SGBF.recherche, IMP = window.SGBF.impression, CL = window.SGBF.clients;
  var app = document.getElementById("app");
  var esc = B.esc;
  var CLIENT = {}; CL.forEach(function (c) { CLIENT[c.id] = c; });
  function store() { return B.store.charger(); }
  function pl(n, s, p) { return B.nb(n) + " " + (n > 1 ? p : s); }
  function nomCourt(c) { return c.prenom + " " + c.nom; }
  function lienClient(c) { return "client.html?id=" + c.id; }
  function nomProduit(pid) { return PR.parId[pid] ? PR.parId[pid].nom : pid; }
  function dateTxt(ymd) { return B.fmtDate(B.lireYmd(ymd)); }
  function maj1(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function pc(v) { return v === null ? "–" : v + " %"; }
  var CLASSE_RES = { nr: "puce", doc: "puce", rappel: "puce puce-warn", rdv: "puce puce-ok", accord: "puce puce-ok", refus: "puce puce-bad", stop: "puce puce-bad" };
  var params = new URLSearchParams(location.search);
  var etat = { form: null, msg: "", msgHtml: "", supprimer: null, filtre: "tous", nbJ: 30, liste: "", nbL: 30, choix: "", ed: edVide() };
  /* Texte du script et des réponses modifié par l'élève : valable pour le client, le produit, la campagne et le fondement de l'appel en cours. */
  function edVide() { return { cle: "", sc: null, scMode: false, scBr: null, scErr: null, ob: null, obMode: false, obBr: null, obErr: null, avis: "" }; }

  /* ---------- formulaire : valeurs ---------- */
  function formVide(cid, o) {
    o = o || {};
    var f = { client: cid, date: B.ymd(B.aujourdhui()), heure: B.hhmm(B.maintenant()), base: PH.BASES[o.base] ? o.base : "", baseDate: "", lien: "", camp: "", prod: "", rebond: "", res: "", motif: "", note: "",
      suiteDate: "", suiteHeure: "10:00", suiteCanal: PH.CANAUX_RDV[0], relance: o.relance || "", o2pc: PH.themeO2pc(o.o2pc), err: null };
    /* appel ouvert depuis la liste O2PC : produit, fondement et lien avec le contrat déjà proposés (modifiables) */
    if (f.o2pc) {
      var pp = o.prod ? PR.parId[o.prod] : null;
      if (pp && PH.produitsPossibles(true).indexOf(pp) >= 0) f.prod = pp.id;
      if (f.base === "contrat" && o.lien) f.lien = String(o.lien).slice(0, PH.MAX_LIEN);
    }
    var k = o.camp ? CA.trouver(store(), o.camp) : null;
    if (k && k.ids.indexOf(cid) >= 0) { f.camp = k.id; f.prod = k.produit; }
    if (f.relance) { var x = AG.trouver(store(), f.relance); if (x && x.client === cid && x.type === "relance") { f.base = "demande"; } else f.relance = ""; }
    return f;
  }
  /* Date proposée pour la suite d'un appel (rendez-vous, relance, rappel : des éléments de l'agenda) : le prochain jour d'ouverture de l'agence, demain au plus tôt. */
  function jourParDefaut() { return B.ymd(B.agenceSuivant(B.plusJours(B.aujourdhui(), 1))); }

  /* ---------- file d'appels ---------- */
  function blocRappels() {
    var l = PH.rappelsAFaire(store()), auj = B.aujourdhui();
    if (!l.length) return '<p class="vide-bloc">Aucun rappel téléphonique à faire. Quand un client demande à être rappelé, le rappel s\'ajoute à votre agenda et apparaît ici.</p>';
    return '<ul class="liste-simple ap-rappels">' + l.slice(0, 10).map(function (e) {
      var retard = AG.passe(e.date, e.heure), auj0 = B.ecartJours(e.date, auj) === 0;
      return "<li><span><strong>" + esc(nomCourt(e.client)) + "</strong> – " + esc(e.motif) + '<br><span class="mention">' + esc(maj1(B.fmtLong(e.date)) + (e.heure ? " à " + PH.heureLib(e.heure) : "")) + "</span> " +
        (retard ? '<span class="puce puce-bad">En retard</span>' : auj0 ? '<span class="puce puce-warn">Aujourd\'hui</span>' : "") + '</span><span class="droite"><button type="button" class="btn btn-secondaire" data-act="appeler" data-id="' + e.client.id + '" data-rel="' + e.id + '" aria-label="Appeler ' + esc(nomCourt(e.client)) + ' : ' + esc(e.motif) + '">Appeler</button></span></li>';
    }).join("") + "</ul>" + (l.length > 10 ? '<p class="mention">+ ' + (l.length - 10) + " autre" + (l.length - 10 > 1 ? "s" : "") + " dans l'agenda.</p>" : "");
  }
  function campagnesEnCours() { return CA.campagnes(store()).filter(function (k) { return CA.statut(k) === "cours"; }); }
  function aPrendre(k) { return CA.suivi(store(), k).filter(function (x) { return ["souscrit", "detient", "refus", "rdv"].indexOf(x.etat) < 0; }); }
  function selectListe() {
    var l = campagnesEnCours();
    if (!l.length) return '<p class="vide-bloc">Aucune campagne en cours. Créez-en une dans <a href="campagnes.html">« Campagnes commerciales »</a> pour obtenir une liste d\'appels.</p>';
    return '<div class="champ ap-liste-choix"><label for="ap-liste">Campagne en cours</label><select id="ap-liste"><option value="">Choisir une campagne</option>' + l.map(function (k) {
      return '<option value="' + k.id + '"' + (etat.liste === k.id ? " selected" : "") + ">" + esc(k.nom) + " (" + aPrendre(k).length + " à travailler)</option>";
    }).join("") + '</select></div><div id="z-liste-camp">' + tableCampagne() + "</div>";
  }
  function statutAppel(cid) {
    var s = PH.situation(store(), cid);
    if (s.stop) return '<span class="puce puce-bad">Ne plus appeler</span>';
    if (!s.quota.possible) return '<span class="puce puce-warn">Quota atteint : prochain appel le ' + esc(B.fmtDate(s.quota.prochaine)) + "</span>";
    return '<span class="puce puce-ok">Appel possible</span> <span class="mention">' + s.quota.n + " / " + s.quota.max + " appels en 30 jours</span>";
  }
  function tableCampagne() {
    var k = etat.liste ? CA.trouver(store(), etat.liste) : null;
    if (!k) return "";
    var l = aPrendre(k).sort(function (a, b) { return P.nomListe(a.client) < P.nomListe(b.client) ? -1 : 1; }), vus = l.slice(0, etat.nbL);
    if (!l.length) return '<p class="vide-bloc">Tous les clients de cette campagne ont été traités (contrat, refus ou rendez-vous).</p>';
    var h = '<div class="tab-wrap tab-defile" role="region" aria-label="Clients de la campagne à appeler" tabindex="0"><table class="tab tab-cg ap-tab"><caption class="sr">Clients de la campagne « ' + esc(k.nom) + ' » restant à travailler</caption><thead><tr><th scope="col" class="gauche">Client</th><th scope="col" class="gauche">État dans la campagne</th><th scope="col" class="gauche">Peut-on l\'appeler ?</th><th scope="col" class="gauche">Action</th></tr></thead><tbody>' +
      vus.map(function (x) {
        var c = x.client;
        return '<tr><th scope="row"><a href="' + lienClient(c) + '">' + esc(nomCourt(c)) + '</a><span class="pf-sous">' + c.age + " ans – " + esc(c.pro.prof) + '</span></th><td class="gauche"><span class="puce">' + esc(CA.ETATS[x.etat]) + '</span></td><td class="gauche">' + statutAppel(c.id) +
          '</td><td class="gauche cg-act"><button type="button" class="btn-texte" data-act="appeler" data-id="' + c.id + '" data-camp="' + k.id + '" aria-label="Appeler ' + esc(nomCourt(c)) + '">Appeler</button></td></tr>';
      }).join("") + "</tbody></table></div>";
    if (l.length > vus.length) h += '<p><button type="button" class="btn btn-secondaire" data-act="plus-l">Afficher les ' + Math.min(30, l.length - vus.length) + " clients suivants (" + (l.length - vus.length) + " restants)</button></p>";
    return h;
  }
  function selectClient() {
    var l = CL.slice().sort(function (a, b) { return P.nomListe(a) < P.nomListe(b) ? -1 : 1; });
    return '<form class="ap-autre" id="form-choix" novalidate><div class="champ"><label for="ap-choix">Un autre client du portefeuille</label><select id="ap-choix"><option value="">Choisir un client</option>' + l.map(function (c) {
      return '<option value="' + c.id + '"' + (String(etat.choix) === String(c.id) ? " selected" : "") + ">" + esc(P.nomListe(c)) + " – " + c.age + " ans</option>";
    }).join("") + '</select></div><button type="submit" class="btn btn-secondaire">Préparer l\'appel</button><p class="msg-erreur" id="ap-choix-err" role="alert"></p></form>';
  }
  function fileHtml() {
    return '<section class="bloc" aria-labelledby="t-file"><div class="bloc-tete"><h2 id="t-file" tabindex="-1">Qui appeler ?</h2></div>' +
      '<h3 class="sous-titre">Rappels demandés par des clients</h3>' + blocRappels() +
      '<h3 class="sous-titre">Liste d\'appels d\'une campagne</h3><div id="z-liste">' + selectListe() + "</div>" +
      '<h3 class="sous-titre">Appeler un autre client</h3>' + selectClient() + "</section>";
  }

  /* ---------- fiche d'appel ---------- */
  function ligneDl(l, v) { return "<div><dt>" + esc(l) + "</dt><dd>" + v + "</dd></div>"; }
  function identHtml(c) {
    var st = store(), det = PH.detenus(st, c).map(function (p) { return p.nom; }), prec = PH.duClient(st, c.id), q = PH.quotaClient(st, c.id);
    return '<dl class="cg-carte-id ap-ident">' +
      ligneDl("Client", '<a href="' + lienClient(c) + '">' + esc(c.civ + " " + c.prenom + " " + c.nom) + "</a> – " + c.age + " ans – " + esc(c.pro.prof)) +
      ligneDl("Téléphone", (c.tel ? "Fixe " + esc(c.tel) + " – " : "") + "mobile " + esc(c.mob)) +
      ligneDl("Détient chez nous", det.length ? esc(det.join(", ")) : "aucun produit") +
      ligneDl("Appels précédents", prec.length ? pl(prec.length, "appel", "appels") + " – dernier le " + esc(PH.quand(prec[0])) + " (" + esc(PH.RESULTATS[prec[0].res].lib.toLowerCase()) + ")" + " – " + q.n + " appel" + (q.n > 1 ? "s" : "") + " de démarchage sur les 30 derniers jours" : "aucun appel enregistré") + "</dl>";
  }
  function erreurChamp(champ) { return etat.form && etat.form.err && etat.form.err.champ === champ; }
  function attrErr(champ) { return erreurChamp(champ) ? ' aria-invalid="true" aria-describedby="ap-err"' : ""; }
  var VERDICTS = { eligible: "éligible", examiner: "à examiner", detenu: "déjà détenu", non: "non éligible" };

  function zoneProduit(f) {
    var st = store(), c = CLIENT[f.client], camps = PH.campagnesDuClient(st, c.id, f.date), k = f.camp ? CA.trouver(st, f.camp) : null;
    var h = '<div class="champ"><label for="ap-camp">Campagne (facultatif)</label><select id="ap-camp"' + attrErr("camp") + '><option value="">Aucune campagne</option>' + camps.map(function (x) {
      return '<option value="' + x.id + '"' + (f.camp === x.id ? " selected" : "") + ">" + esc(x.nom) + "</option>";
    }).join("") + '</select><p class="aide-champ">' + (camps.length ? "Une campagne reprend son produit et son argumentaire ; l'appel compte dans ses indicateurs." : "Ce client ne fait partie d'aucune campagne dont la période comprend cette date.") + "</p></div>";
    if (k) h += '<p class="cg-fixe"><strong>Produit de la campagne :</strong> ' + esc(nomProduit(k.produit)) + '. <strong>Argumentaire :</strong> ' + esc(k.args.join(" – ")) + "</p>";
    else {
      var fams = PR.univers;   /* les crédits ne figurent dans PH.produitsPossibles() que pour une campagne O2PC */
      h += '<div class="champ"><label for="ap-prod">Produit proposé *</label><select id="ap-prod"' + attrErr("prod") + '><option value="">Choisir un produit</option>' + fams.map(function (fa) {
        var ps = PH.produitsPossibles(!!f.o2pc).filter(function (p) { return PR.universDe(p) === fa; });
        return ps.length ? '<optgroup label="' + esc(fa.nom) + '">' + ps.map(function (p) {
          var v = PH.verdictProduit(st, c, p.id), cr = p.famille === "credit", off = !cr && (v === "detenu" || v === "non");
          return '<option value="' + p.id + '"' + (f.prod === p.id ? " selected" : "") + (off ? " disabled" : "") + ">" + esc(p.nom) + (cr ? " (à étudier en rendez-vous)" : " (" + VERDICTS[v] + ")") + "</option>";
        }).join("") + "</optgroup>" : "";
      }).join("") + '</select><p class="aide-champ">' + (f.o2pc ? "Les crédits ne figurent dans la liste que pour les opportunités O2PC « crédit » : ils s'évoquent par téléphone mais se montent en rendez-vous, dans « Montage de prêt ». " : "Les crédits ne figurent pas dans la liste : ils se montent dans « Montage de prêt ». ") + 'L\'offre clientèle fragile ne se vend pas : la banque la propose aux clients qu\'elle repère comme fragiles.</p></div>';
    }
    return h;
  }
  function zoneBaseRadios(f) {
    return '<fieldset class="pf-source ap-base"' + attrErr("base") + '><legend>Sur quel fondement appelez-vous ce client ? *</legend>' + Object.keys(PH.BASES).map(function (k) {
      return '<label class="pf-radio" for="ap-base-' + k + '"><input type="radio" id="ap-base-' + k + '" name="ap-base" value="' + k + '"' + (f.base === k ? " checked" : "") + "> " + esc(PH.BASES[k].lib) + "</label>";
    }).join("") + "</fieldset>";
  }
  function zoneBaseExtra(f) {
    var auj = B.ymd(B.aujourdhui());
    if (f.base === "consentement") return '<div class="champ ap-extra"><label for="ap-bdate">Date à laquelle le client a donné son accord *</label><input id="ap-bdate" type="date" max="' + auj + '" value="' + esc(f.baseDate) + '"' + attrErr("baseDate") + '><p class="aide-champ">Un accord est valable un an au plus et le client peut le retirer à tout moment, même à l\'oral. Le portefeuille ne contient pas cette information : c\'est vous qui la déclarez (par exemple, accord recueilli lors d\'un entretien).</p></div>';
    if (f.base === "contrat") return '<div class="champ ap-extra"><label for="ap-lien">Contrat détenu et lien avec le produit proposé *</label><textarea id="ap-lien" rows="2" maxlength="' + PH.MAX_LIEN + '"' + attrErr("lien") + ' placeholder="Exemple : il détient un compte courant avec carte ; la proposition porte sur la carte Visa Premier">' + esc(f.lien) + '</textarea><p class="aide-champ">L\'appel sans accord n\'est permis que s\'il porte sur l\'objet du contrat déjà conclu. Dites précisément lequel et en quoi le produit proposé s\'y rattache.</p></div>';
    if (f.base === "demande") return '<p class="aide-champ ap-extra">Le client a lui-même demandé à être appelé : les jours, les heures et le nombre d\'appels du démarchage ne s\'appliquent pas. Précisez la demande dans le compte rendu.</p>';
    return "";
  }
  /* Liste de contrôle avant l'appel, recalculée à chaque modification. */
  function zoneControle(f) {
    var st = store(), ct = PH.controleAppel(st, f), par = {};
    ct.bloquants.forEach(function (b) { (par[b.groupe] = par[b.groupe] || []).push(b.msg); });
    var videBase = !f.base || (f.base === "consentement" && !f.baseDate) || (f.base === "contrat" && !f.lien.replace(/\s/g, "")), videProd = !ct.produit, vide = 0, ko = 0, warn = 0;
    function item(cls, titre, txt, lib) {
      if (cls === "neutre") vide++; else if (cls === "ko") ko++; else if (cls === "warn") warn++;
      return '<li class="ap-ck ap-ck-' + cls + '"><span class="ap-ck-ico" aria-hidden="true">' + { ok: "✓", ko: "✕", warn: "!", neutre: "–" }[cls] + '</span><span><span class="sr">' + lib + " : </span><strong>" + esc(titre) + "</strong> " + esc(txt) + "</span></li>";
    }
    var l = [];
    if (videBase) l.push(item("neutre", "Fondement de l'appel.", par.base ? par.base[0] : "À choisir.", "À compléter"));
    else if (par.base) l.push(item("ko", "Fondement de l'appel.", par.base.join(" "), "Appel impossible"));
    else l.push(item("ok", "Fondement de l'appel.", f.base === "consentement" ? "Accord du client donné le " + dateTxt(f.baseDate) + "." : f.base === "contrat" ? "Exception « contrat en cours » : " + f.lien.replace(/\s+/g, " ").trim() : "Appel demandé par le client.", "Conforme"));
    if (par.moment) l.push(item("ko", "Jour et heure.", par.moment.join(" "), "Appel impossible"));
    else if (!f.base) l.push(item("neutre", "Jour et heure.", "Dépend du fondement de l'appel.", "À compléter"));
    else if (!ct.demarchage) l.push(item("ok", "Jour et heure.", "Appel demandé par le client : aucun créneau n'est imposé.", "Conforme"));
    else if (ct.alertes.length) l.push(item("warn", "Jour et heure.", ct.alertes[0], "Attention"));
    else l.push(item("ok", "Jour et heure.", maj1(B.fmtLong(B.lireYmd(f.date))) + " à " + PH.heureLib(f.heure) + " : dans les créneaux autorisés.", "Conforme"));
    if (par.quota) l.push(item("ko", "Nombre d'appels.", par.quota.join(" "), "Appel impossible"));
    else if (!ct.demarchage) l.push(item("neutre", "Nombre d'appels.", f.base ? "Non concerné : appel demandé par le client." : "Dépend du fondement de l'appel.", f.base ? "Non concerné" : "À compléter"));
    else if (ct.quota) l.push(item("ok", "Nombre d'appels.", ct.quota.n + " appel" + (ct.quota.n > 1 ? "s" : "") + " de démarchage sur les 30 jours qui précèdent (tentatives sans réponse comprises) ; au plus " + PH.QUOTA + " sont autorisés, celui-ci est le n° " + (ct.quota.n + 1) + ".", "Conforme"));
    if (videProd) l.push(item("neutre", "Produit proposé.", "À choisir.", "À compléter"));
    else if (par.produit) l.push(item("ko", "Produit proposé.", par.produit.join(" "), "Appel impossible"));
    else { var v = PH.verdictProduit(st, CLIENT[f.client], ct.produit); l.push(item(v === "examiner" ? "warn" : "ok", "Produit proposé.", nomProduit(ct.produit) + (v === "examiner" ? " : éligibilité à examiner avec le client (voir la fiche du produit)." : " : le client est éligible."), v === "examiner" ? "Attention" : "Conforme")); }
    var concl = ko ? '<p class="cg-alerte">Appel impossible en l\'état : corrigez les points marqués ✕.</p>' : vide ? '<p class="aide-champ">Complétez les points ci-dessus avant d\'appeler.</p>' : warn ? '<p class="cg-alerte">Vous pouvez enregistrer cet appel, mais il sera signalé : lisez les points marqués !.</p>' : '<p class="cg-resume">Vous pouvez appeler ce client.</p>';
    return '<ul class="ap-controle">' + l.join("") + "</ul>" + concl;
  }
  function syncEdition(f) {
    var cle = PH.cleScript(f), ed = etat.ed;
    if (ed.cle === cle) return;
    var modifie = ed.sc || ed.scMode || ed.ob || ed.obMode;
    etat.ed = edVide(); etat.ed.cle = cle;
    if (modifie) etat.ed.avis = "Le script et les réponses ont été remis au texte type : le client, le produit ou le fondement de l'appel a changé.";
  }
  function avisEdition() { return etat.ed.avis ? '<p class="mention ap-avis" role="status">' + esc(etat.ed.avis) + "</p>" : ""; }
  function zoneScript(f) {
    syncEdition(f);
    var ed = etat.ed, std = PH.script(store(), f), e = ed.sc ? PH.appliquerScript(std, ed.sc) : std;
    if (ed.scMode) {
      return avisEdition() + '<p class="aide-champ">Adaptez les phrases à dire au client. Écrivez une ligne par phrase (à l\'étape 3, une ligne par question). Les consignes en gris ne se modifient pas.</p>' + e.map(function (x, i) {
        var v = ed.scBr && ed.scBr[i] != null ? ed.scBr[i] : x.texte.join("\n"), inv = ed.scErr && ed.scErr.champ === "sc" + i;
        return '<div class="champ"><label for="ap-sc-' + i + '">' + esc(x.titre) + '</label><textarea id="ap-sc-' + i + '" class="ap-ed" data-ed="sc" data-i="' + i + '" rows="' + Math.min(10, Math.max(3, v.split("\n").length + 1)) + '"' + (inv ? ' aria-invalid="true" aria-describedby="ap-sc-err"' : "") + ">" + esc(v) + "</textarea>" + (x.note ? '<p class="mention">' + esc(x.note) + "</p>" : "") + "</div>";
      }).join("") + '<p class="msg-erreur" id="ap-sc-err" role="alert">' + (ed.scErr ? esc(ed.scErr.erreur) : "") + "</p>" +
        '<div class="pf-btns"><button type="button" class="btn btn-principal" data-act="sc-valider">Utiliser ce script</button><button type="button" class="btn btn-secondaire" data-act="sc-annuler">Annuler mes modifications</button><button type="button" class="btn btn-secondaire" data-act="sc-type">Revenir au script type</button></div>';
    }
    return avisEdition() + e.map(function (x) {
      var t = x.liste ? '<p class="ap-dire">' + esc(x.texte[0]) + "</p><ul>" + x.texte.slice(1).map(function (q) { return "<li>" + esc(q) + "</li>"; }).join("") + "</ul>" : x.texte.map(function (q) { return '<p class="ap-dire">' + esc(q) + "</p>"; }).join("");
      return "<h3>" + esc(x.titre) + "</h3>" + t + (x.note ? '<p class="mention">' + esc(x.note) + "</p>" : "");
    }).join("") + '<p class="mention">' + (ed.sc ? "<strong>Script modifié par vous.</strong> " : "") + "Ce script est une trame : il reprend la fiche du produit, le dossier du client et l'argumentaire de la campagne. Vous pouvez le modifier avec vos mots.</p>" +
      '<p class="ap-ed-btns"><button type="button" class="btn btn-secondaire" data-act="sc-modifier">Modifier le script</button>' + (ed.sc ? '<button type="button" class="btn btn-secondaire" data-act="sc-type">Revenir au script type</button>' : "") + "</p>";
  }
  function zoneObjections(f) {
    syncEdition(f);
    var ed = etat.ed, std = PH.objections(f), l = ed.ob ? PH.appliquerObjections(std, ed.ob) : std;
    if (ed.obMode) {
      return avisEdition() + '<p class="aide-champ">Adaptez les réponses que vous donnez au client. Les consignes en gris ne se modifient pas.</p>' + l.map(function (x, i) {
        var v = ed.obBr && ed.obBr[i] != null ? ed.obBr[i] : x.r, inv = ed.obErr && ed.obErr.champ === "ob" + i;
        return '<div class="champ"><label for="ap-ob-' + i + '">Réponse à l\'objection ' + esc(x.q) + '</label><textarea id="ap-ob-' + i + '" class="ap-ed" data-ed="ob" data-i="' + i + '" rows="3"' + (inv ? ' aria-invalid="true" aria-describedby="ap-ob-err"' : "") + ">" + esc(v) + "</textarea>" + (x.note ? '<p class="mention">' + esc(x.note) + "</p>" : "") + "</div>";
      }).join("") + '<p class="msg-erreur" id="ap-ob-err" role="alert">' + (ed.obErr ? esc(ed.obErr.erreur) : "") + "</p>" +
        '<div class="pf-btns"><button type="button" class="btn btn-principal" data-act="ob-valider">Utiliser ces réponses</button><button type="button" class="btn btn-secondaire" data-act="ob-annuler">Annuler mes modifications</button><button type="button" class="btn btn-secondaire" data-act="ob-type">Revenir aux réponses types</button></div>';
    }
    return avisEdition() + '<dl class="ap-obj">' + l.map(function (x) { return "<div><dt>" + esc(x.q) + "</dt><dd>" + esc(x.r) + "</dd>" + (x.note ? '<dd class="mention">' + esc(x.note) + "</dd>" : "") + "</div>"; }).join("") + "</dl>" +
      (ed.ob ? '<p class="mention"><strong>Réponses modifiées par vous.</strong></p>' : "") +
      '<p class="ap-ed-btns"><button type="button" class="btn btn-secondaire" data-act="ob-modifier">Modifier les réponses</button>' + (ed.ob ? '<button type="button" class="btn btn-secondaire" data-act="ob-type">Revenir aux réponses types</button>' : "") + "</p>";
  }
  /* Recopie dans l'état ce qui est saisi dans les zones de modification (pour ne rien perdre si la zone est redessinée). */
  function lireEditions() {
    var ed = etat.ed;
    var sc = app.querySelectorAll('.ap-ed[data-ed="sc"]'), ob = app.querySelectorAll('.ap-ed[data-ed="ob"]');
    if (sc.length) { ed.scBr = []; sc.forEach(function (t) { ed.scBr[parseInt(t.getAttribute("data-i"), 10)] = t.value; }); }
    if (ob.length) { ed.obBr = []; ob.forEach(function (t) { ed.obBr[parseInt(t.getAttribute("data-i"), 10)] = t.value; }); }
  }
  function zoneResultat(f) {
    return '<fieldset class="pf-source ap-res"' + attrErr("res") + '><legend>Résultat de l\'appel *</legend>' + PH.ORDRE_RESULTATS.map(function (k) {
      return '<label class="pf-radio" for="ap-res-' + k + '"><input type="radio" id="ap-res-' + k + '" name="ap-res" value="' + k + '"' + (f.res === k ? " checked" : "") + "> " + esc(PH.RESULTATS[k].lib) + "</label>";
    }).join("") + "</fieldset>";
  }
  /* Rebond commercial : un autre produit proposé pendant l'appel, en plus de celui du motif de l'appel. */
  function zoneRebond(f) {
    var st = store(), c = CLIENT[f.client], k = f.camp ? CA.trouver(st, f.camp) : null, pid = k ? k.produit : f.prod;
    var fams = PR.univers;
    return '<div class="champ ap-extra"><label for="ap-rebond">Rebond commercial : autre produit proposé pendant l\'appel (facultatif)</label><select id="ap-rebond"' + attrErr("rebond") + '><option value="">Aucun rebond</option>' + fams.map(function (fa) {
      var ps = PH.produitsPossibles().filter(function (p) { return PR.universDe(p) === fa && p.id !== pid; });
      return ps.length ? '<optgroup label="' + esc(fa.nom) + '">' + ps.map(function (p) {
        var v = PH.verdictProduit(st, c, p.id), off = v === "detenu" || v === "non";
        return '<option value="' + p.id + '"' + (f.rebond === p.id ? " selected" : "") + (off ? " disabled" : "") + ">" + esc(p.nom) + " (" + VERDICTS[v] + ")</option>";
      }).join("") + "</optgroup>" : "";
    }).join("") + '</select><p class="aide-champ">Un rebond : vous profitez de l\'échange pour proposer un autre produit que celui du motif de l\'appel. Le bilan compte les rebonds utilisés et ceux qui ont abouti à une souscription.</p></div>';
  }
  function zoneResExtra(f) {
    var r = PH.RESULTATS[f.res], h = "", auj = B.ymd(B.aujourdhui());
    if (!r) return '<p class="aide-champ">Choisissez le résultat : ce que le client a répondu.</p>';
    h += '<p class="aide-champ ap-aide-res">' + esc(r.aide) + "</p>";
    if (r.motif) h += '<div class="champ ap-extra"><label for="ap-motif">Motif du refus *</label><select id="ap-motif"' + attrErr("motif") + '><option value="">Choisir un motif</option>' + CA.MOTIFS_REFUS.map(function (m) { return '<option' + (f.motif === m ? " selected" : "") + ">" + esc(m) + "</option>"; }).join("") + "</select></div>";
    if (r.suite) {
      var rdv = r.suite === "rdv", sd = f.suiteDate || jourParDefaut();
      h += '<div class="ligne ap-extra"><div class="champ"><label for="ap-sdate">' + (rdv ? "Date du rendez-vous *" : "Rappeler le client le *") + '</label><input id="ap-sdate" type="date" min="' + auj + '" value="' + esc(sd) + '"' + attrErr("suiteDate") + '></div>' +
        '<div class="champ"><label for="ap-sheure">Heure *</label><input id="ap-sheure" type="time" value="' + esc(f.suiteHeure) + '"' + attrErr("suiteHeure") + "></div>" +
        (rdv ? '<div class="champ"><label for="ap-scanal">Où ?</label><select id="ap-scanal"' + attrErr("suiteCanal") + ">" + PH.CANAUX_RDV.map(function (c) { return "<option" + (f.suiteCanal === c ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("") + "</select></div>" : '<div class="champ"><span class="lib-fixe">Canal</span><p class="ap-fixe">Par téléphone</p></div>') + "</div>";
    }
    if (f.res !== "nr") h += zoneRebond(f);
    h += '<div class="champ"><label for="ap-note">Compte rendu de l\'appel' + (f.res === "nr" ? " (facultatif)" : " *") + '</label><textarea id="ap-note" rows="3" maxlength="' + PH.MAX_NOTE + '"' + attrErr("note") + ' placeholder="Ce que le client a dit, ce qui a été convenu">' + esc(f.note) + "</textarea></div>";
    return h;
  }
  /* Encadré de l'opportunité O2PC qui a motivé l'appel (fiche ouverte depuis la liste du jour). */
  function blocO2pc(f) {
    var O = window.SGBF.o2pc;
    if (!f.o2pc || !O) return "";
    var t = O.PAR_ID[f.o2pc], opp = O.opportunite(store(), f.client, f.o2pc);
    return '<aside class="ap-o2pc" aria-label="Opportunité O2PC"><p><span class="puce puce-ok">O2PC</span> <strong>' + esc(t.lib) + "</strong></p>" +
      (opp ? "<p>" + esc(opp.motif) + "</p><ul>" + opp.details.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : '<p class="mention">Cette opportunité n\'est plus d\'actualité pour ce client : l\'appel reste possible, mais sans ce motif.</p>') +
      '<p class="mention">' + esc(t.argu) + "</p></aside>";
  }
  function formHtml() {
    var f = etat.form;
    if (!f) return "";
    var c = CLIENT[f.client];
    return '<section class="bloc ap-form-bloc" id="bloc-form" aria-labelledby="t-form"><div class="bloc-tete"><h2 id="t-form" tabindex="-1">Fiche d\'appel : ' + esc(nomCourt(c)) + '</h2><span class="sous">Les champs marqués d\'une étoile sont obligatoires.</span></div>' + identHtml(c) +
      '<form class="formulaire ap-form" id="form-ap" novalidate>' + blocO2pc(f) +
      '<fieldset class="ap-etape"><legend>1. Préparer l\'appel</legend><div id="z-produit">' + zoneProduit(f) + "</div></fieldset>" +
      '<fieldset class="ap-etape"><legend>2. Avant d\'appeler</legend><div id="z-base">' + zoneBaseRadios(f) + '</div><div id="z-base-extra">' + zoneBaseExtra(f) + "</div>" +
      '<div class="ligne ap-moment"><div class="champ"><label for="ap-date">Date de l\'appel *</label><input id="ap-date" type="date" min="' + B.ymd(B.plusJours(B.aujourdhui(), -PH.PASSE_MAX)) + '" max="' + B.ymd(B.aujourdhui()) + '" value="' + esc(f.date) + '"' + attrErr("date") + '></div>' +
      '<div class="champ"><label for="ap-heure">Heure de l\'appel *</label><input id="ap-heure" type="time" value="' + esc(f.heure) + '"' + attrErr("heure") + '></div></div>' +
      '<p class="aide-champ">Par défaut, la date et l\'heure sont celles de maintenant ; vous pouvez les modifier pour enregistrer un appel passé plus tôt.</p>' +
      '<div id="z-controle" class="ap-controle-zone" role="status" aria-live="polite">' + zoneControle(f) + "</div></fieldset>" +
      '<details class="ap-details" id="ap-det-script"><summary>Script d\'appel</summary><div id="z-script">' + zoneScript(f) + "</div></details>" +
      '<details class="ap-details"><summary>Réponses aux objections</summary><div id="z-obj">' + zoneObjections(f) + "</div></details>" +
      '<fieldset class="ap-etape"><legend>3. Résultat de l\'appel</legend><div id="z-res">' + zoneResultat(f) + '</div><div id="z-res-extra">' + zoneResExtra(f) + "</div></fieldset>" +
      '<p class="msg-erreur" id="ap-err" role="alert">' + (f.err ? esc(f.err.erreur) : "") + "</p>" +
      '<div class="pf-btns"><button type="submit" class="btn btn-principal">Enregistrer l\'appel</button><button type="button" class="btn btn-secondaire" data-act="fermer-form">Annuler</button></div></form></section>';
  }
  function majForm() { document.getElementById("z-form").innerHTML = formHtml(); }
  function lireForm() {
    var f = etat.form; if (!f) return;
    function v(id) { var e = document.getElementById(id); return e ? e.value : null; }
    var d = v("ap-date"); if (d !== null) f.date = d;
    var h = v("ap-heure"); if (h !== null) f.heure = h;
    var b = app.querySelector('input[name="ap-base"]:checked'); f.base = b ? b.value : f.base;
    var bd = v("ap-bdate"); if (bd !== null) f.baseDate = bd;
    var li = v("ap-lien"); if (li !== null) f.lien = li;
    var ca = v("ap-camp"); if (ca !== null) f.camp = ca;
    var pr = v("ap-prod"); if (pr !== null) f.prod = pr;
    var rb = v("ap-rebond"); if (rb !== null) f.rebond = rb;
    var r = app.querySelector('input[name="ap-res"]:checked'); f.res = r ? r.value : f.res;
    var m = v("ap-motif"); if (m !== null) f.motif = m;
    var sd = v("ap-sdate"); if (sd !== null) f.suiteDate = sd;
    var sh = v("ap-sheure"); if (sh !== null) f.suiteHeure = sh;
    var sc = v("ap-scanal"); if (sc !== null) f.suiteCanal = sc;
    var n = v("ap-note"); if (n !== null) f.note = n;
  }
  /* Le rebond ne peut pas porter sur le produit de l'appel : on le remet à zéro s'il vient d'en devenir le produit, et on rafraîchit la liste. */
  function majRes(f) {
    var k = f.camp ? CA.trouver(store(), f.camp) : null, pid = k ? k.produit : f.prod;
    if (f.rebond && f.rebond === pid) f.rebond = "";
    var z = document.getElementById("z-res-extra"); if (z && f.res) z.innerHTML = zoneResExtra(f);
  }
  function majControle() { var z = document.getElementById("z-controle"); if (z && etat.form) z.innerHTML = zoneControle(etat.form); }
  function majScript() { lireEditions(); var z = document.getElementById("z-script"), o = document.getElementById("z-obj"); if (z && etat.form) { z.innerHTML = zoneScript(etat.form); o.innerHTML = zoneObjections(etat.form); } }
  function ouvrirForm(f, focus) {
    etat.form = f; etat.ed = edVide(); etat.msg = ""; etat.msgHtml = ""; majMsg(); majForm();
    var e = document.getElementById("bloc-form"); if (e) e.scrollIntoView({ block: "start" });
    var t = document.getElementById(focus || "t-form"); if (t) t.focus();
  }
  function fermerForm() { etat.form = null; etat.ed = edVide(); majForm(); var t = document.getElementById("t-file"); if (t) { t.scrollIntoView({ block: "start" }); t.focus(); } }
  function majMsg() { var z = document.getElementById("z-msg"); if (z) z.innerHTML = etat.msgHtml ? '<div class="ag-ok ap-ok" id="ap-ok" tabindex="-1" role="status">' + etat.msgHtml + "</div>" : ""; }

  var CHAMP_ID = { client: "ap-choix", date: "ap-date", heure: "ap-heure", base: "ap-base-consentement", baseDate: "ap-bdate", lien: "ap-lien", camp: "ap-camp", prod: "ap-prod", rebond: "ap-rebond", res: "ap-res-nr", motif: "ap-motif", note: "ap-note", suiteDate: "ap-sdate", suiteHeure: "ap-sheure", suiteCanal: "ap-scanal" };
  function messageApres(r, f) {
    var a = r.appel, res = PH.RESULTATS[a.res], c = CLIENT[a.c], h = "<p><strong>Appel enregistré :</strong> " + esc(nomCourt(c)) + ", " + esc(PH.quand(a)) + " – " + esc(nomProduit(a.prod)) + " – " + esc(res.lib.toLowerCase()) + ".</p>", l = [];
    if (r.hors) h += '<p class="ap-hors">Cet appel est signalé « hors créneau » : le démarchage ne se fait que ' + esc(PH.creneauLib()) + ".</p>";
    if (a.suite) l.push((a.suite.type === "rdv" ? "Rendez-vous ajouté" : "Rappel ajouté") + " à votre agenda le " + esc(B.fmtLong(B.lireYmd(a.suite.date))) + " à " + esc(PH.heureLib(a.suite.heure)) + ' (<a href="agenda.html">ouvrir l\'agenda</a>).');
    if (a.refusCamp) l.push("Refus noté dans la campagne.");
    if (a.res === "doc") l.push('<a href="messagerie.html?client=' + c.id + "&amp;modele=produit" + (a.camp ? "&amp;campagne=" + a.camp : "") + '">Écrire au client pour lui envoyer la documentation</a>.');
    if (a.res === "accord") l.push('<a href="catalogue.html?produit=' + a.prod + "&amp;client=" + c.id + '&amp;moyen=appel">Enregistrer la souscription dans le catalogue</a> (le contrat compte alors dans les résultats).');
    if (a.res === "stop") l.push("Ce client ne peut plus être démarché par téléphone, sauf demande de sa part ou nouvel accord de sa part.");
    if (a.res === "nr") { var q = PH.quotaClient(store(), c.id); l.push("Appels de démarchage sur les 30 derniers jours : " + q.n + " sur " + q.max + (q.possible ? "." : " : le prochain appel sera possible le " + esc(B.fmtDate(q.prochaine)) + ".")); }
    return h + (l.length ? "<ul>" + l.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul>" : "");
  }
  function enregistrer() {
    lireForm();
    var f = etat.form, st = store();
    var r = PH.enregistrer(st, f);
    if (!r.ok) {
      f.err = r; var z = document.getElementById("ap-err"); z.textContent = r.erreur;
      /* le message d'erreur est replacé dans la page sans recréer le formulaire : les saisies sont conservées */
      app.querySelectorAll("[aria-invalid]").forEach(function (e) { e.removeAttribute("aria-invalid"); e.removeAttribute("aria-describedby"); });
      var e = document.getElementById(CHAMP_ID[r.champ] || "ap-err");
      if (e && e.id !== "ap-err") { e.setAttribute("aria-invalid", "true"); e.setAttribute("aria-describedby", "ap-err"); }
      if (e) { if (!e.hasAttribute("tabindex") && !/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(e.tagName)) e.setAttribute("tabindex", "-1"); e.focus(); }
      return;
    }
    B.store.sauver();
    etat.msgHtml = messageApres(r, f);
    etat.form = null; etat.ed = edVide(); majForm(); majMsg(); majFile(); majJournal();
    var ok = document.getElementById("ap-ok"); if (ok) { ok.scrollIntoView({ block: "center" }); ok.focus(); }
  }

  /* ---------- journal ---------- */
  var FILTRES = [["tous", "Tous les appels"]].concat(PH.ORDRE_RESULTATS.map(function (k) { return [k, PH.RESULTATS[k].lib]; })).concat([["hors", "Hors créneau"]]);
  function lignesJournal() {
    var l = PH.journal(store());
    if (etat.filtre === "hors") return l.filter(PH.horsCreneau);
    return etat.filtre === "tous" ? l : l.filter(function (a) { return a.res === etat.filtre; });
  }
  function suiteTxt(a) {
    var d = [];
    if (a.motif) d.push("Motif : " + a.motif.toLowerCase());
    if (a.rebond) d.push("Rebond : " + nomProduit(a.rebond));
    if (a.suite) d.push((a.suite.type === "rdv" ? "Rendez-vous le " : "Rappel le ") + dateTxt(a.suite.date) + " à " + PH.heureLib(a.suite.heure));
    if (a.camp) { var k = CA.trouver(store(), a.camp); if (k) d.push("Campagne « " + k.nom + " »"); }
    if (a.o2pc && window.SGBF.o2pc && window.SGBF.o2pc.PAR_ID[a.o2pc]) d.push("O2PC : " + window.SGBF.o2pc.PAR_ID[a.o2pc].court);
    return d.join(" – ");
  }
  function baseTxt(a) { return PH.BASES[a.base].court + (a.base === "consentement" && a.baseDate ? " du " + dateTxt(a.baseDate) : ""); }
  function kpisJournal(t) {
    function kpi(lib, val, det) { return '<div class="kpi"><dt>' + esc(lib) + '</dt><dd class="val">' + val + "</dd>" + (det ? '<dd class="det">' + det + "</dd>" : "") + "</div>"; }
    return '<dl class="kpis ap-kpis">' + kpi("Appels", B.nb(t.appels), pl(t.clients, "client appelé", "clients appelés")) + kpi("Appels aboutis", B.nb(t.joints), "Taux de joignabilité : " + pc(t.tauxJoint)) +
      kpi("Rendez-vous obtenus", B.nb(t.parResultat.rdv), pl(t.parResultat.rappel, "rappel demandé", "rappels demandés")) + kpi("Accords de principe", B.nb(t.parResultat.accord), pl(t.parResultat.doc, "demande de documentation", "demandes de documentation")) +
      kpi("Refus", B.nb(t.parResultat.refus), pl(t.parResultat.stop, "demande d'arrêt", "demandes d'arrêt")) + kpi("Rebonds", B.nb(t.rebonds), "autre produit proposé pendant l'appel") + kpi("Hors créneau", B.nb(t.hors), t.hors ? "à analyser" : "aucun") + "</dl>";
  }
  function journalHtml() {
    var st = store(), tout = PH.journal(st), t = PH.totaux(tout), l = lignesJournal(), vus = l.slice(0, etat.nbJ);
    var nb = document.getElementById("ap-nb"); if (nb) nb.textContent = tout.length ? pl(tout.length, "appel", "appels") : "";
    if (!tout.length) return '<p class="vide-bloc">Aucun appel enregistré. Choisissez un client dans « Qui appeler ? », passez l\'appel, puis enregistrez son résultat sur la fiche d\'appel.</p>';
    var cmpt = {}; tout.forEach(function (a) { cmpt[a.res] = (cmpt[a.res] || 0) + 1; });
    var h = kpisJournal(t) + '<div class="cg-filtre"><label for="ap-filtre">Afficher</label><select id="ap-filtre">' + FILTRES.map(function (x) {
      var n = x[0] === "tous" ? tout.length : x[0] === "hors" ? t.hors : (cmpt[x[0]] || 0);
      return '<option value="' + x[0] + '"' + (etat.filtre === x[0] ? " selected" : "") + ">" + esc(x[1]) + " (" + n + ")</option>";
    }).join("") + '</select><button type="button" class="btn btn-secondaire" data-act="imprimer">Imprimer le journal</button></div>';
    if (!l.length) return h + '<p class="vide-bloc">Aucun appel dans cette catégorie.</p>';
    h += '<div class="tab-wrap tab-defile" role="region" aria-label="Tableau des appels enregistrés" tabindex="0"><table class="tab tab-cg ap-tab"><caption class="sr">Appels enregistrés, du plus récent au plus ancien</caption><thead><tr><th scope="col" class="gauche">Date</th><th scope="col" class="gauche">Client et produit</th><th scope="col" class="gauche">Résultat</th><th scope="col" class="gauche">Détail</th><th scope="col" class="gauche">Action</th></tr></thead><tbody>' +
      vus.map(function (a) {
        var c = CLIENT[a.c], conf = etat.supprimer === a.id, hc = PH.horsCreneau(a);
        return '<tr><td class="gauche">' + esc(B.fmtDate(B.lireYmd(a.date))) + '<span class="pf-sous">' + esc(PH.heureLib(a.heure)) + '</span></td><th scope="row"><a href="' + lienClient(c) + '">' + esc(nomCourt(c)) + '</a><span class="pf-sous">' + esc(nomProduit(a.prod)) + " – " + esc(baseTxt(a)) + "</span></th>" +
          '<td class="gauche"><span class="' + CLASSE_RES[a.res] + '">' + esc(PH.RESULTATS[a.res].lib) + "</span>" + (hc ? ' <span class="puce puce-bad">Hors créneau</span>' : "") + '</td><td class="gauche">' + esc(a.note || "–") + (suiteTxt(a) ? '<span class="pf-sous">' + esc(suiteTxt(a)) + "</span>" : "") + '</td><td class="gauche cg-act">' +
          (conf ? '<button type="button" class="btn-texte" data-act="suppr-oui" data-id="' + a.id + '">Confirmer la suppression</button><button type="button" class="btn-texte" data-act="suppr-non">Garder</button>' :
            '<button type="button" class="btn-texte" data-act="suppr" data-id="' + a.id + '" aria-label="Supprimer l\'appel du ' + esc(dateTxt(a.date)) + " à " + esc(nomCourt(c)) + '">Supprimer</button>') + "</td></tr>";
      }).join("") + "</tbody></table></div>";
    if (l.length > vus.length) h += '<p><button type="button" class="btn btn-secondaire" data-act="plus-j">Afficher les ' + Math.min(30, l.length - vus.length) + " appels suivants (" + (l.length - vus.length) + " restants)</button></p>";
    return h;
  }
  function majJournal() { document.getElementById("z-journal").innerHTML = journalHtml(); }
  function majFile() { var z = document.getElementById("z-file"); if (z) z.innerHTML = fileHtml(); }

  /* ---------- impression du journal ---------- */
  function docJournal() {
    var st = store(), l = PH.journal(st), t = PH.totaux(l), corps = "";
    corps += '<section class="dp-bloc"><h2>Bilan des appels au ' + esc(B.fmtDate(B.aujourdhui())) + '</h2><dl class="dp-chiffres"><div><dt>Appels</dt><dd>' + t.appels + "</dd></div><div><dt>Aboutis</dt><dd>" + t.joints + " (" + pc(t.tauxJoint) + ")</dd></div><div><dt>Rendez-vous</dt><dd>" + t.parResultat.rdv + "</dd></div><div><dt>Accords de principe</dt><dd>" + t.parResultat.accord + "</dd></div><div><dt>Refus</dt><dd>" + t.parResultat.refus + "</dd></div><div><dt>Hors créneau</dt><dd>" + t.hors + "</dd></div></dl></section>";
    corps += '<section class="dp-long"><h2>Appels enregistrés (' + l.length + ')</h2><table class="dp-pf dp-camp"><thead><tr><th scope="col" class="g">Date</th><th scope="col" class="g">Client</th><th scope="col" class="g">Produit</th><th scope="col" class="g">Fondement</th><th scope="col" class="g">Résultat</th><th scope="col" class="g">Compte rendu</th></tr></thead><tbody>' + l.map(function (a) {
      var c = CLIENT[a.c];
      return '<tr><td class="g">' + esc(B.fmtDate(B.lireYmd(a.date)) + " " + PH.heureLib(a.heure)) + '</td><td class="g">' + esc(nomCourt(c)) + '</td><td class="g">' + esc(nomProduit(a.prod)) + '</td><td class="g">' + esc(baseTxt(a)) + '</td><td class="g">' + esc(PH.RESULTATS[a.res].lib + (a.motif ? " (" + a.motif.toLowerCase() + ")" : "") + (PH.horsCreneau(a) ? " – hors créneau" : "")) + '</td><td class="g">' + esc(a.note || "–") + "</td></tr>";
    }).join("") + '</tbody></table><p class="dp-mention">Journal établi à partir des appels enregistrés dans l\'outil.</p></section>';
    IMP.imprimer(IMP.document({ titre: "Journal des appels", sous: "Phoning et prospection – Agence de Paris", corps: corps }), IMP.nomFichier("Journal_des_appels"));
  }

  /* ---------- page ---------- */
  function reperesHtml() {
    return '<details class="bloc ap-reperes"><summary>Les règles du démarchage téléphonique (à lire avant d\'appeler)</summary><ul>' +
      "<li><strong>Accord préalable :</strong> depuis le 11 août 2026, un professionnel ne peut démarcher un consommateur par téléphone que si celui-ci y a consenti. L'accord est valable un an au plus ; le client peut le retirer à tout moment, même à l'oral.</li>" +
      "<li><strong>Contrat en cours :</strong> sans accord, l'appel reste permis s'il se rapporte à l'objet d'un contrat que le client a déjà conclu avec la banque.</li>" +
      "<li><strong>Jours et heures :</strong> " + esc(maj1(PH.creneauLib())) + ".</li>" +
      "<li><strong>Nombre d'appels :</strong> quatre au plus par période de 30 jours pour un même client.</li>" +
      "<li><strong>Au début de l'appel :</strong> annoncez votre identité, celle de la banque et le but commercial de l'appel.</li>" +
      "<li><strong>À la demande du client :</strong> un appel que le client a lui-même demandé n'est pas du démarchage.</li></ul>" +
      '<p class="mention">Règles de l\'agence : un appel commencé à 13 h 00 ou à 20 h 00 est hors créneau ; l\'accord du client et le lien avec un contrat sont déclarés par vous, car le portefeuille ne les contient pas. Une tentative sans réponse compte parmi les quatre appels (le texte vise le fait de « contacter ou tenter de contacter » : article D223-9). Sources : service-public.fr (Entreprendre, fiche A19003) et Code de la consommation, articles L223-1 et suivants. Repères à revérifier sur les textes en vigueur.</p></details>';
  }
  function render() {
    app.innerHTML = '<nav class="fil-ariane" aria-label="Fil d\'Ariane"><a href="index.html">' + ICO.retour + "Accueil</a><span aria-hidden=\"true\">/</span><span>Phoning et prospection</span></nav>" +
      '<div class="page-titre"><h1>Phoning et prospection</h1><p>' + esc(B.fmtLong(B.aujourdhui())) + " – appeler les clients de votre portefeuille et enregistrer le résultat de chaque appel</p></div>" +
      '<div id="z-msg"></div>' + reperesHtml() + '<div class="page-grille"><div id="z-file">' + fileHtml() + '</div><div id="z-form"></div>' +
      '<section class="bloc" aria-labelledby="t-journal"><div class="bloc-tete"><h2 id="t-journal" tabindex="-1">Journal des appels</h2><span class="sous" id="ap-nb"></span></div><div id="z-journal"></div></section></div>' +
      '<p class="mention" style="margin-top:16px">L\'outil ne passe aucun appel : vous passez l\'appel vous-même, puis vous enregistrez son résultat. Vos appels sont enregistrés dans ce navigateur, sur cet ordinateur.</p>';
    majJournal();
  }

  /* Boutons de modification du script (sc-) et des réponses aux objections (ob-). */
  function actionEdition(act) {
    var f = etat.form; if (!f) return;
    lireEditions(); syncEdition(f);
    var ed = etat.ed, quoi = act.slice(0, 2), cmd = act.slice(3), K0 = quoi === "sc" ? { mode: "scMode", br: "scBr", err: "scErr", val: "sc" } : { mode: "obMode", br: "obBr", err: "obErr", val: "ob" };
    var foc = null;
    if (cmd === "modifier") { ed[K0.mode] = true; ed[K0.br] = null; ed[K0.err] = null; foc = quoi === "sc" ? "ap-sc-0" : "ap-ob-0"; }
    else if (cmd === "annuler") { ed[K0.mode] = false; ed[K0.br] = null; ed[K0.err] = null; foc = quoi === "sc" ? 'z-script' : 'z-obj'; }
    else if (cmd === "type") { ed[K0.val] = null; ed[K0.mode] = false; ed[K0.br] = null; ed[K0.err] = null; foc = quoi === "sc" ? 'z-script' : 'z-obj'; }
    else if (cmd === "valider") {
      var r = quoi === "sc" ? PH.controleScript(PH.script(store(), f), ed.scBr) : PH.controleObjections(PH.objections(f), ed.obBr);
      if (!r.ok) { ed[K0.err] = r; foc = r.champ ? "ap-" + r.champ.slice(0, 2) + "-" + r.champ.slice(2) : null; }
      else {
        var val = quoi === "sc" ? r.textes : r.reponses, std = quoi === "sc" ? PH.script(store(), f).map(function (x) { return x.texte; }) : PH.objections(f).map(function (x) { return x.r; });
        ed[K0.val] = JSON.stringify(val) === JSON.stringify(std) ? null : val;   /* identique au texte type : rien n'est modifié */
        ed[K0.mode] = false; ed[K0.br] = null; ed[K0.err] = null; foc = quoi === "sc" ? 'z-script' : 'z-obj';
      }
    }
    var z = document.getElementById(quoi === "sc" ? "z-script" : "z-obj"); if (!z) return;
    z.innerHTML = quoi === "sc" ? zoneScript(f) : zoneObjections(f);
    var cible = foc && document.getElementById(foc);
    if (cible && /^z-/.test(foc)) { var bt = z.querySelector('[data-act="' + quoi + '-modifier"]'); cible = bt || cible; }
    if (cible) cible.focus();
  }

  /* ---------- événements ---------- */
  app.addEventListener("input", function (e) {
    var t = e.target;
    if (!etat.form || !t.closest("#form-ap")) return;
    if (t.classList && t.classList.contains("ap-ed")) { lireEditions(); return; }
    if (t.id === "ap-lien" || t.id === "ap-bdate" || t.id === "ap-heure" || t.id === "ap-date") { lireForm(); majControle(); }
  });
  app.addEventListener("change", function (e) {
    var t = e.target, f = etat.form;
    if (t.id === "ap-liste") { etat.liste = t.value; etat.nbL = 30; document.getElementById("z-liste-camp").innerHTML = tableCampagne(); return; }
    if (t.id === "ap-choix") { etat.choix = t.value; return; }
    if (t.id === "ap-filtre") { etat.filtre = t.value; etat.nbJ = 30; majJournal(); var s = document.getElementById("ap-filtre"); if (s) s.focus(); return; }
    if (!f || !t.closest("#form-ap")) return;
    if (t.classList && t.classList.contains("ap-ed")) { lireEditions(); return; }
    f.err = null; var er = document.getElementById("ap-err"); if (er) er.textContent = "";
    var avant = { camp: f.camp, date: f.date, base: f.base, res: f.res };
    lireForm();
    if (t.id === "ap-date") {
      var ok = PH.campagnesDuClient(store(), f.client, f.date).some(function (k) { return k.id === f.camp; });
      if (f.camp && !ok) { f.camp = ""; f.prod = ""; }
      document.getElementById("z-produit").innerHTML = zoneProduit(f); majControle(); majScript(); majRes(f);
    } else if (t.id === "ap-camp") {
      var k = f.camp ? CA.trouver(store(), f.camp) : null; f.prod = k ? k.produit : "";
      document.getElementById("z-produit").innerHTML = zoneProduit(f); var c2 = document.getElementById("ap-camp"); if (c2) c2.focus(); majControle(); majScript(); majRes(f);
    } else if (t.id === "ap-prod") { majControle(); majScript(); majRes(f); }
    else if (t.name === "ap-base") { document.getElementById("z-base-extra").innerHTML = zoneBaseExtra(f); majControle(); majScript(); }
    else if (t.name === "ap-res") {
      if (f.res !== avant.res) { f.motif = ""; if (PH.RESULTATS[f.res] && PH.RESULTATS[f.res].suite) { if (!f.suiteDate) f.suiteDate = jourParDefaut(); if (f.res === "rdv") f.suiteHeure = PH.heureLibre(store(), f.client, f.suiteDate); } }
      document.getElementById("z-res-extra").innerHTML = zoneResExtra(f);
    } else majControle();
  });
  app.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b) return;
    var act = b.getAttribute("data-act"), id = b.getAttribute("data-id"), st = store();
    if (act === "appeler") { var cid = parseInt(id, 10); if (CLIENT[cid]) ouvrirForm(formVide(cid, { camp: b.getAttribute("data-camp") || "", relance: b.getAttribute("data-rel") || "" })); }
    else if (act === "fermer-form") fermerForm();
    else if (act === "plus-l") { etat.nbL += 30; document.getElementById("z-liste-camp").innerHTML = tableCampagne(); }
    else if (act === "plus-j") { etat.nbJ += 30; majJournal(); }
    else if (act === "suppr") { etat.supprimer = id; majJournal(); var c1 = app.querySelector('[data-act="suppr-oui"]'); if (c1) c1.focus(); }
    else if (act === "suppr-non") { var ci = etat.supprimer; etat.supprimer = null; majJournal(); var b2 = app.querySelector('[data-act="suppr"][data-id="' + ci + '"]'); if (b2) b2.focus(); }
    else if (act === "suppr-oui") {
      var a = PH.trouver(st, id), r = PH.supprimer(st, id);
      etat.supprimer = null;
      if (r.ok) { B.store.sauver(); etat.msgHtml = "<p>Appel supprimé" + (a ? " : " + esc(nomCourt(CLIENT[a.c])) + ", " + esc(PH.quand(a)) : "") + ".</p>" + (r.retire.length ? "<p>Ont aussi été retirés : " + esc(r.retire.join(", ")) + ".</p>" : ""); }
      majMsg(); majJournal(); majFile(); var ok = document.getElementById("ap-ok"); if (ok) { ok.scrollIntoView({ block: "center" }); ok.focus(); }
    }
    else if (act === "sc-modifier" || act === "sc-annuler" || act === "sc-type" || act === "sc-valider" || act === "ob-modifier" || act === "ob-annuler" || act === "ob-type" || act === "ob-valider") actionEdition(act);
    else if (act === "imprimer") docJournal();
  });
  app.addEventListener("submit", function (e) {
    e.preventDefault();
    if (e.target.id === "form-ap") enregistrer();
    else if (e.target.id === "form-choix") {
      var v = parseInt(document.getElementById("ap-choix").value, 10), z = document.getElementById("ap-choix-err");
      if (!CLIENT[v]) { z.textContent = "Choisissez un client dans la liste."; document.getElementById("ap-choix").focus(); return; }
      z.textContent = ""; ouvrirForm(formVide(v, {}));
    }
  });

  RECH.init(CL, document.getElementById("rech"), document.getElementById("rech-res"), document.getElementById("rech-statut"));
  render();
  /* Paramètres d'adresse : ?client=ID (ouvre la fiche d'appel), &campagne=ID (rattache l'appel à une campagne), &relance=ID (rappel demandé par le client), &base=demande|consentement|contrat, &o2pc=THEME&prod=ID&lien=TEXTE (appel ouvert depuis la liste O2PC). */
  var pc0 = parseInt(params.get("client"), 10);
  if (CLIENT[pc0]) ouvrirForm(formVide(pc0, { camp: params.get("campagne") || "", relance: params.get("relance") || "", base: params.get("base") || "", prod: params.get("prod") || "", lien: params.get("lien") || "", o2pc: params.get("o2pc") || "" }));
})();
