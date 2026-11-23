/* GS Banque & Assurance – page « Saisies administratives (SATD) » : enregistrer l'avis à tiers détenteur reçu d'un comptable public pour un client, voir le calcul (solde bancaire insaisissable laissé au client,
   somme bloquée 15 jours, somme versée au Trésor public, frais de 10 % du montant dû dans la limite de 100 €), l'enregistrer, imprimer les courriers (réponse au comptable public, lettre au client,
   lettre à chaque cotitulaire d'un compte joint ou indivis) et enregistrer la mainlevée notifiée par l'administration. Les règles sont dans satd.js, les courriers dans documents_satd.js.
   Adresse : satd.html?client=<id> ouvre la page pour un client (depuis sa fiche). */
(function () {
  "use strict";

  var SG = window.SGBF, B = SG.banque, CL = SG.clients, S = SG.satd, DS = SG.documentsSatd, RIB = SG.rib, IMP = SG.impression, ICO = SG.icones, RECH = SG.recherche, app = document.getElementById("app");
  var esc = B.esc;
  var CLIENT = {}; CL.forEach(function (c) { CLIENT[c.id] = c; });
  var params = new URLSearchParams(location.search);
  var VIDE = { avis: "", service: "", nature: "", du: "" };
  var etat = { cid: CLIENT[parseInt(params.get("client"), 10)] ? parseInt(params.get("client"), 10) : 0, f: Object.assign({}, VIDE), apercu: null, verif: false, err: null, fait: null, ml: null, mlVerif: false, mlErr: "" };

  function st() { return B.store.charger(); }
  function client() { return etat.cid ? CLIENT[etat.cid] : null; }
  function nomComplet(c) { return c.civ + " " + c.prenom + " " + c.nom.toUpperCase(); }
  function dateLongue(ymd) { var d = B.lireYmd(ymd); return d ? d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : ""; }
  function euros(n) { return B.eur2(n).replace(/,00(\s| )€/, "$1€"); }
  function liens(c) { return '<a class="btn btn-secondaire satd-lien" href="client.html?id=' + c.id + '">Fiche client</a>'; }

  /* ---------- déroulé et bilan ---------- */
  function deroule() {
    var e = [
      ["Le jour de la réception", "L'avis à tiers détenteur du comptable public arrive à la banque en même temps qu'au client : on l'enregistre le jour même."],
      ["Le calcul", "Soldes créditeurs du jour, solde bancaire insaisissable de " + euros(S.SBI) + " laissé au client, somme due : seule la somme due est bloquée si elle est inférieure à 2 000 €, tous les comptes sinon."],
      ["Les courriers", "Réponse au comptable public, lettre d'information du client et, pour un compte joint ou indivis, lettre à chaque cotitulaire. Frais : 10 % du montant dû, 100 € au plus."],
      ["Le versement", "Les comptes restent bloqués " + S.DELAI_BLOCAGE + " jours ; la banque verse ensuite la somme au Trésor public (dans les " + S.DELAI_VERSEMENT + " jours). Seule l'administration peut décider une mainlevée."]
    ];
    return '<ol class="op-deroule regul-deroule" aria-label="Déroulé d\'une saisie administrative à tiers détenteur">' + e.map(function (x, i) {
      return '<li><span class="op-deroule-num" aria-hidden="true">' + (i + 1) + '</span><span class="op-deroule-txt"><strong>' + esc(x[0]) + "</strong><span>" + esc(x[1]) + "</span></span></li>";
    }).join("") + "</ol>";
  }
  function bilan(l) {
    function n(code) { return l.filter(function (s) { return S.etat(s).code === code; }).length; }
    var d = [["Comptes bloqués", n("bloque"), "satd-b-warn"], ["Versées au Trésor public", n("verse"), "satd-b-ok"], ["Sans effet (rien à saisir)", n("sans_effet"), "satd-b-nul"], ["Mainlevée reçue", n("mainlevee"), "satd-b-info"]];
    return '<dl class="satd-bilan" aria-label="Bilan des saisies">' + d.map(function (x) { return '<div class="satd-b ' + x[2] + '"><dt>' + esc(x[0]) + "</dt><dd>" + x[1] + "</dd></div>"; }).join("") + "</dl>";
  }

  /* ---------- formulaire ---------- */
  function err(champ) { return etat.err && etat.err.some(function (e) { return e.champ === champ; }); }
  function champ(id, lib, corps, aide, pleine) {
    var e = err(id);
    return '<div class="champ' + (pleine ? ' satd-pleine' : '') + '"><label for="satd-' + id + '">' + esc(lib) + " *</label>" + corps.replace("<>", ' id="satd-' + id + '"' + (e ? ' aria-invalid="true" aria-describedby="satd-err' + (aide ? " satd-aide-" + id : "") + '"' : aide ? ' aria-describedby="satd-aide-' + id + '"' : "")) + (aide ? '<span class="aide-champ" id="satd-aide-' + id + '">' + esc(aide) + "</span>" : "") + "</div>";
  }
  function options(liste, v) { return '<option value="">Choisir…</option>' + liste.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (v === x[0] ? " selected" : "") + ">" + esc(x[1]) + "</option>"; }).join(""); }
  function selecteurClient() {
    var l = CL.slice().sort(function (a, b) { var x = a.nom + " " + a.prenom, y = b.nom + " " + b.prenom; return x < y ? -1 : x > y ? 1 : 0; });
    return '<div class="champ"><label for="satd-client">Client (redevable) *</label><select id="satd-client"' + (err("client") ? ' aria-invalid="true" aria-describedby="satd-err"' : "") + '><option value="">Choisir un client</option>' + l.map(function (c) {
      return '<option value="' + c.id + '"' + (etat.cid === c.id ? " selected" : "") + ">" + esc(c.nom.toUpperCase() + " " + c.prenom + " – " + c.age + " ans") + "</option>";
    }).join("") + "</select></div>";
  }
  function infoClient(c) {
    var cs = S.comptes(c, st(), B.aujourdhui()), rb = RIB.rib(c), act = S.actives(st(), c.id);
    var h = '<div class="satd-info-client"><p><strong>' + esc(nomComplet(c)) + "</strong> – client " + esc(c.num) + " – " + esc(c.pro.prof) + "</p><p>Comptes saisissables aujourd'hui : " +
      cs.map(function (x) { return esc(x.nom) + " " + esc(euros(x.solde)) + (x.solde < 0 ? " (débiteur)" : ""); }).join(" ; ") + ". Le compte-titres n'est pas concerné.</p>" +
      (rb.joint ? "<p>Compte " + (rb.forme === "indivis" ? "indivis" : "joint") + " avec " + esc(rb.titulaires.slice(1).join(", ")) + " : " + (rb.forme === "indivis" ? "les autres titulaires" : "le cotitulaire") + " reçoi" + (rb.forme === "indivis" && rb.titulaires.length > 2 ? "vent" : "t") + " une lettre d'information.</p>" : "") + "</div>";
    if (act.length) h += '<div class="satd-info-client satd-en-cours" role="status"><p><strong>' + (act.length > 1 ? act.length + " saisies sont déjà en cours" : "Une saisie est déjà en cours") + " sur ce client</strong> (" + esc(act.map(function (s) { return s.avis; }).join(", ")) + ") : les sommes qu'elle bloque ne peuvent pas être saisies une seconde fois.</p></div>";
    return h;
  }
  function formulaire() {
    var c = client(), f = etat.f, h = '<section class="bloc satd-panneau" id="satd-panneau" aria-labelledby="satd-t-form"><div class="bloc-tete"><h2 id="satd-t-form" tabindex="-1">Enregistrer un avis à tiers détenteur</h2></div>' +
      '<p class="op-aide">Recopiez les informations de l\'avis reçu du comptable public. La date de réception est celle d\'aujourd\'hui : ' + esc(dateLongue(B.ymd(B.aujourdhui()))) + ".</p>" +
      '<form class="formulaire op-form satd-form" id="satd-form" novalidate>' +
      '<div class="op-grille">' + selecteurClient() + "</div>" + (c ? infoClient(c) : "") +
      '<div class="satd-grille">' +
      champ("service", "Service émetteur", "<select <>>" + options(S.SERVICES, f.service) + "</select>", "Service ou trésorerie qui figure en tête de l'avis.", true) +
      champ("nature", "Nature de la créance", "<select <>>" + options(S.NATURES, f.nature) + "</select>", "", true) +
      champ("avis", "Numéro de l'avis", '<input <> type="text" autocomplete="off" maxlength="30" value="' + esc(f.avis) + '">', "Tel qu'il figure sur l'avis, par exemple SATD-2026-04417.") +
      champ("du", "Montant dû (€)", '<input <> type="text" inputmode="decimal" autocomplete="off" maxlength="12" value="' + esc(f.du) + '">', "Montant réclamé à l'ouverture de l'avis (frais de la banque non compris).") + "</div>" +
      '<div class="msg-erreur" id="satd-err" role="alert">' + (etat.err ? (etat.err.length > 1 ? "<ul>" + etat.err.map(function (e) { return "<li>" + esc(e.msg) + "</li>"; }).join("") + "</ul>" : esc(etat.err[0].msg)) : "") + "</div>" +
      '<div class="satd-btns"><button type="submit" class="btn btn-principal">Calculer la saisie</button></div></form>' + (etat.apercu ? calcul() : "") + "</section>";
    return h;
  }

  /* ---------- calcul affiché avant l'enregistrement ---------- */
  function tableauComptes(k) {
    return '<div class="satd-table-zone" role="region" aria-label="Comptes du client" tabindex="0"><table class="satd-table"><caption class="sr">Comptes du client à la date de réception de l\'avis</caption><thead><tr><th scope="col">Compte</th><th scope="col">Solde</th><th scope="col">Solde créditeur pris en compte</th><th scope="col">Laissé au client (solde bancaire insaisissable)</th><th scope="col">Saisissable</th><th scope="col">Versé au Trésor</th></tr></thead><tbody>' +
      k.comptes.map(function (x) { return "<tr><th scope=\"row\">" + esc(x.nom) + "</th><td" + (x.solde < 0 ? ' class="satd-debit"' : "") + ">" + esc(euros(x.solde)) + "</td><td>" + esc(euros(x.credit)) + "</td><td>" + esc(euros(x.garde)) + "</td><td>" + esc(euros(x.saisissable)) + "</td><td>" + esc(euros(x.preleve)) + "</td></tr>"; }).join("") +
      '</tbody><tfoot><tr><th scope="row">Total</th><td></td><td>' + esc(euros(k.total)) + "</td><td>" + esc(euros(k.gardeSbi)) + "</td><td>" + esc(euros(k.saisissable)) + "</td><td>" + esc(euros(k.aVerser)) + "</td></tr></tfoot></table></div>";
  }
  function blocageTexte(k) {
    if (k.aVerser <= 0) return k.raison === "debiteur" ? "Aucun blocage : les comptes sont débiteurs, la somme due ne peut pas y être prélevée." : "Aucun blocage : les sommes disponibles ne dépassent pas le solde bancaire insaisissable (" + euros(k.sbi) + "), qui reste à la disposition du client.";
    return k.mode === "tous" ? "Tous les comptes du client sont bloqués " + S.DELAI_BLOCAGE + " jours (dette de " + euros(S.SEUIL_TOUS_COMPTES) + " ou plus), sauf " + euros(k.sbi) + " laissés à sa disposition."
      : "Seule la somme due (" + euros(k.aVerser) + ") est bloquée " + S.DELAI_BLOCAGE + " jours (dette inférieure à " + euros(S.SEUIL_TOUS_COMPTES) + ") ; le reste du compte reste disponible.";
  }
  function calcul() {
    var k = etat.apercu.calcul, v = etat.apercu.v;
    var h = '<div class="satd-calcul" id="satd-calcul"><h3 id="satd-t-calcul" tabindex="-1">Calcul de la saisie</h3>' + tableauComptes(k) + '<dl class="satd-resultat">' +
      "<div><dt>Montant dû</dt><dd><strong>" + esc(euros(k.du)) + "</strong> – " + esc(S.lib(S.NATURES, v.nature)) + "</dd></div>" +
      "<div><dt>Versé au Trésor public</dt><dd><strong>" + esc(euros(k.aVerser)) + "</strong>" + (k.reste > 0 ? " – reste dû à l'administration : " + esc(euros(k.reste)) : "") + "</dd></div>" +
      "<div><dt>Blocage</dt><dd>" + esc(blocageTexte(k)) + "</dd></div>" +
      "<div><dt>Dates</dt><dd>" + (k.aVerser > 0 ? "Comptes bloqués du " + esc(dateLongue(k.recu)) + " au " + esc(dateLongue(k.versement)) + " ; versement le " + esc(dateLongue(k.versement)) + " (au plus tard le " + esc(dateLongue(k.limite)) + ")." : "Avis reçu le " + esc(dateLongue(k.recu)) + ".") + "</dd></div>" +
      "<div><dt>Frais de la banque</dt><dd><strong>" + esc(euros(k.frais)) + "</strong> – 10 % de " + esc(euros(k.du)) + (k.plafonne ? ", plafonnés à " + esc(euros(S.FRAIS.plafond)) : "") + ", débités du compte courant aujourd'hui.</dd></div></dl>" +
      k.alertes.map(function (a) { return '<p class="satd-alerte" role="status">' + ICO.alerte + "<span>" + esc(a) + "</span></p>"; }).join("");
    h += '<fieldset class="op-section satd-verif"' + (err("verif") ? ' aria-invalid="true"' : "") + '><legend>Vérification du conseiller *</legend><label class="op-case"><input type="checkbox" id="satd-verif"' + (etat.verif ? " checked" : "") + (err("verif") ? ' aria-describedby="satd-err"' : "") + "><span>J'ai vérifié l'avis : le redevable est bien ce client, le service émetteur, le montant dû et la date de réception sont ceux de l'avis.</span></label></fieldset>" +
      '<div class="satd-btns"><button type="button" class="btn btn-principal" data-act="enregistrer">Enregistrer la saisie et bloquer les comptes</button><button type="button" class="btn btn-secondaire" data-act="modifier">Modifier l\'avis</button></div></div>';
    return h;
  }

  /* ---------- confirmation ---------- */
  function boutonsCourriers(s) {
    var c = CLIENT[s.c], rb = RIB.rib(c), h = '<div class="satd-docs"><button type="button" class="btn btn-secondaire" data-act="doc" data-doc="tresor" data-id="' + esc(s.id) + '">Réponse au comptable public' + ICO.imprimante + '</button>' +
      '<button type="button" class="btn btn-secondaire" data-act="doc" data-doc="client" data-id="' + esc(s.id) + '">Lettre au client' + ICO.imprimante + "</button>";
    if (rb.joint) rb.coTitulaires.forEach(function (t, i) { h += '<button type="button" class="btn btn-secondaire" data-act="doc" data-doc="co" data-n="' + i + '" data-id="' + esc(s.id) + '">Lettre à ' + esc(t.civ + " " + t.prenom + " " + t.nom.toUpperCase()) + ICO.imprimante + "</button>"; });
    return h + "</div>";
  }
  function confirmation(s) {
    var c = CLIENT[s.c], k = s.calcul;
    return '<section class="bloc satd-ok" id="satd-ok" aria-labelledby="satd-t-ok"><div class="bloc-tete"><h2 id="satd-t-ok" tabindex="-1">' + ICO.check + "Saisie enregistrée</h2><span class=\"sous\">" + esc(nomComplet(c)) + " – avis " + esc(s.avis) + " – dossier " + esc(s.ref) + "</span></div>" +
      '<ul class="satd-ok-liste">' + (k.aVerser > 0 ? "<li>Les comptes sont bloqués jusqu'au <strong>" + esc(dateLongue(k.versement)) + "</strong>. " + esc(blocageTexte(k)) + "</li><li>La somme de <strong>" + esc(euros(k.aVerser)) + "</strong> est versée au Trésor public le " + esc(dateLongue(k.versement)) + " (au plus tard le " + esc(dateLongue(k.limite)) + ") : le virement apparaît alors sur le relevé du client.</li>" :
        "<li>" + esc(blocageTexte(k)) + " La saisie est enregistrée « sans effet » : aucun versement n'est fait au Trésor public.</li>") +
      "<li>Les frais de <strong>" + esc(euros(k.frais)) + "</strong> sont débités du compte courant aujourd'hui.</li></ul>" +
      '<p class="satd-ok-imprimer">Imprimez la réponse au comptable public et la lettre au client (recommandé avec accusé de réception)' + (RIB.rib(c).joint ? ", ainsi que la lettre au cotitulaire" : "") + " :</p>" +
      boutonsCourriers(s) + '<div class="satd-btns" style="margin-top:14px"><button type="button" class="btn btn-secondaire" data-act="fermer-ok">Fermer</button>' + liens(c) + "</div></section>";
  }

  /* ---------- liste des saisies ---------- */
  function puce(s) {
    var e = S.etat(s);
    if (e.code === "bloque") return '<span class="chip chip-warn">' + ICO.alerte + "Comptes bloqués</span>";
    if (e.code === "verse") return '<span class="chip chip-ok">' + ICO.check + "Versée au Trésor public</span>";
    return '<span class="chip chip-ctrl">' + ICO.info + (e.code === "mainlevee" ? "Mainlevée" : "Sans effet") + "</span>";
  }
  function suivi(s) {
    var e = S.etat(s), k = s.calcul, t;
    if (e.code === "bloque") t = "<strong>Blocage en cours :</strong> " + esc(blocageTexte(k)) + " Versement de " + esc(euros(k.aVerser)) + " au Trésor public le " + esc(dateLongue(s.versement)) + " (au plus tard le " + esc(dateLongue(s.limite)) + ").";
    else if (e.code === "verse") t = "<strong>Versé :</strong> " + esc(euros(k.aVerser)) + " ont été versés au Trésor public le " + esc(dateLongue(s.versement)) + (k.reste > 0 ? " ; il reste " + esc(euros(k.reste)) + " dû à l'administration (nouvel avis possible)." : ". La créance est couverte.");
    else if (e.code === "mainlevee") t = "<strong>Mainlevée :</strong> notifiée par l'administration le " + esc(dateLongue(s.mainlevee.date)) + ". Les comptes ont retrouvé leur fonctionnement normal ; aucun versement n'a eu lieu. Les frais de " + esc(euros(k.frais)) + " restent dus à la banque.";
    else t = "<strong>Sans effet :</strong> " + esc(blocageTexte(k));
    return '<p class="regul-suivi regul-suivi-' + (e.code === "bloque" ? "cours" : "fait") + '">' + t + "</p>";
  }
  function formMainlevee(s) {
    return '<form class="satd-ml" id="satd-ml-form" data-id="' + esc(s.id) + '" novalidate aria-labelledby="satd-ml-t"><p id="satd-ml-t"><strong>Enregistrer la mainlevée</strong></p><p>Seul le service qui a émis l\'avis peut lever la saisie ; il la notifie à la banque. Le blocage prend fin et le versement n\'a pas lieu.</p>' +
      '<label class="op-case"><input type="checkbox" id="satd-ml-verif"' + (etat.mlVerif ? " checked" : "") + '><span>J\'ai reçu la mainlevée du service qui a émis l\'avis (' + esc(S.lib(S.SERVICES, s.service)) + "), à la référence de l'avis " + esc(s.avis) + ".</span></label>" +
      '<div class="msg-erreur" id="satd-ml-err" role="alert">' + esc(etat.mlErr) + '</div><div class="satd-btns"><button type="submit" class="btn btn-principal">Enregistrer la mainlevée</button><button type="button" class="btn btn-secondaire" data-act="ml-annuler">Annuler</button></div></form>';
  }
  function carte(s) {
    var c = CLIENT[s.c], e = S.etat(s), k = s.calcul;
    return '<li class="regul-carte satd-carte satd-carte-' + e.code + '" id="satd-s-' + esc(s.ref) + '"><div class="regul-carte-tete"><div><h3 class="regul-nom">' + esc(nomComplet(c)) + '</h3><p class="regul-sous">Client ' + esc(c.num) + " – dossier " + esc(s.ref) + "</p></div>" + puce(s) + "</div>" +
      '<dl class="regul-donnees"><div><dt>Avis</dt><dd>n° ' + esc(s.avis) + "</dd></div><div><dt>Service émetteur</dt><dd>" + esc(S.lib(S.SERVICES, s.service)) + "</dd></div>" +
      "<div><dt>Créance</dt><dd>" + esc(S.lib(S.NATURES, s.nature)) + " – <strong>" + esc(euros(s.du)) + "</strong></dd></div><div><dt>Réception</dt><dd>" + esc(dateLongue(s.date)) + " à " + esc(s.heure.replace(":", " h ")) + "</dd></div>" +
      "<div><dt>Versé au Trésor</dt><dd>" + esc(euros(e.code === "mainlevee" || e.code === "sans_effet" ? 0 : k.aVerser)) + "</dd></div><div><dt>Frais de la banque</dt><dd>" + esc(euros(k.frais)) + "</dd></div></dl>" +
      suivi(s) + (etat.ml === s.id ? formMainlevee(s) : "") + boutonsCourriers(s) +
      '<div class="regul-actions">' + (e.code === "bloque" && etat.ml !== s.id ? '<button type="button" class="btn btn-secondaire" data-act="ml" data-id="' + esc(s.id) + '">Enregistrer la mainlevée</button>' : "") + liens(c) + "</div></li>";
  }
  function liste(l) {
    var h = '<section class="bloc" aria-labelledby="satd-t-liste"><div class="bloc-tete"><h2 id="satd-t-liste" tabindex="-1">Saisies enregistrées</h2><span class="sous">' + l.length + " saisie" + (l.length > 1 ? "s" : "") + "</span></div>";
    if (!l.length) return h + '<p class="vide-bloc">Aucune saisie pour le moment. Quand un comptable public (service des impôts, trésorerie…) adresse un avis à tiers détenteur pour un client, enregistrez-le ci-dessus : la banque bloque les comptes, informe le client et verse la somme au Trésor public.</p></section>';
    return h + '<ul class="regul-liste">' + l.slice().sort(function (a, b) { return a.ref < b.ref ? 1 : a.ref > b.ref ? -1 : 0; }).map(carte).join("") + "</ul></section>";
  }

  /* Typographie française : espace insécable avant « : », « % » et « € », dans les nombres à milliers et à l'intérieur des guillemets, pour que ces signes ne passent jamais seuls à la ligne. */
  function typo(racine) {
    var w = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT, null), n, l = [];
    while ((n = w.nextNode())) { if (n.parentNode && /^(SCRIPT|STYLE|OPTION|TEXTAREA)$/.test(n.parentNode.nodeName)) continue; l.push(n); }
    l.forEach(function (t) {
      var v = t.nodeValue, r = v.replace(/ +([:;!?%€»])/g, "\u00a0$1").replace(/(\d) (\d{3})(?!\d)/g, "$1\u00a0$2").replace(/« +/g, "«\u00a0");
      if (r !== v) t.nodeValue = r;
    });
  }
  function render(focus) {
    document.title = "GS Banque & Assurance – Saisies administratives (SATD)";
    var l = S.liste(st()), fait = etat.fait ? S.trouver(st(), etat.fait) : null;
    app.innerHTML = '<nav class="fil-ariane" aria-label="Fil d\'Ariane"><a href="index.html">' + ICO.retour + 'Accueil</a></nav>' +
      '<div class="page-titre"><h1>Saisies administratives (SATD)</h1><p>Saisie administrative à tiers détenteur : un comptable public demande à la banque de lui verser les sommes qu\'elle détient pour un client qui n\'a pas payé une dette fiscale ou une somme due à une collectivité ou à un hôpital public.</p></div>' +
      deroule() + bilan(l) + (fait ? confirmation(fait) : "") + formulaire() + liste(l) +
      '<p class="satd-rappel">Sources des règles : service-public.gouv.fr (fiche F31716), impots.gouv.fr, Banque de France, article L262 du Livre des procédures fiscales. Les services émetteurs, les natures de créance et les numéros d\'avis sont inventés pour l\'exercice.</p>';
    typo(app);
    if (focus) { var n = document.getElementById(focus); if (n) { try { n.focus(); } catch (e) { /* ignoré */ } if (/^satd-t-/.test(focus) && n.scrollIntoView) n.scrollIntoView({ block: "start" }); } }
  }

  /* ---------- actions ---------- */
  function lire() {
    var f = document.getElementById("satd-form"); if (!f) return;
    ["avis", "service", "nature", "du"].forEach(function (k) { var e = document.getElementById("satd-" + k); if (e) etat.f[k] = e.value; });
    var s = document.getElementById("satd-client"); if (s) etat.cid = parseInt(s.value, 10) || 0;
  }
  function calculer() {
    lire(); etat.fait = null; etat.verif = false; etat.apercu = null;
    var c = client();
    if (!c) { etat.err = [{ champ: "client", msg: "Choisissez le client visé par l'avis (le redevable)." }]; render("satd-client"); return; }
    var r = S.calculer(c, st(), etat.f, B.aujourdhui());
    if (!r.ok) { etat.err = r.erreurs; var p = r.erreurs[0].champ; render(p ? "satd-" + p : "satd-err"); return; }
    etat.err = null; etat.apercu = r; render("satd-t-calcul");
  }
  function enregistrer() {
    var v = document.getElementById("satd-verif"); etat.verif = !!(v && v.checked);
    if (!etat.verif) { etat.err = [{ champ: "verif", msg: "Cochez la vérification de l'avis avant d'enregistrer la saisie." }]; render("satd-verif"); return; }
    var c = client(), r = S.creer(st(), c, etat.f);
    if (!r.ok) { etat.err = r.erreurs; etat.apercu = null; render("satd-err"); return; }
    B.store.sauver();
    etat.fait = r.saisie.id; etat.f = Object.assign({}, VIDE); etat.apercu = null; etat.verif = false; etat.err = null; etat.cid = 0;
    render("satd-t-ok");
  }
  function imprimer(b) {
    var s = S.trouver(st(), b.getAttribute("data-id")); if (!s || !IMP) return;
    var c = CLIENT[s.c], p = DS.personne(c), k = b.getAttribute("data-doc"), d;
    if (k === "tresor") d = DS.reponseTresor(c, s, p); else if (k === "client") d = DS.infoClient(c, s, p);
    else d = DS.infoCotitulaire(c, s, p, RIB.rib(c).coTitulaires[parseInt(b.getAttribute("data-n"), 10)]);
    IMP.imprimer(IMP.document({ titre: d.titre, sous: d.sous, corps: d.corps, courrier: false, lettre: true }), d.fichier);
  }

  app.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-act]") : null; if (!b) return;
    var act = b.getAttribute("data-act");
    if (act === "enregistrer") enregistrer();
    else if (act === "modifier") { etat.apercu = null; etat.verif = false; render("satd-avis"); }
    else if (act === "doc") imprimer(b);
    else if (act === "fermer-ok") { etat.fait = null; render("satd-t-liste"); }
    else if (act === "ml") { etat.ml = b.getAttribute("data-id"); etat.mlVerif = false; etat.mlErr = ""; render("satd-ml-verif"); }
    else if (act === "ml-annuler") { var id = etat.ml; etat.ml = null; etat.mlErr = ""; render(); var bt = document.querySelector('[data-act="ml"][data-id="' + id + '"]'); if (bt) bt.focus(); }
  });
  app.addEventListener("submit", function (e) {
    if (e.target.id === "satd-form") { e.preventDefault(); calculer(); }
    else if (e.target.id === "satd-ml-form") {
      e.preventDefault();
      var v = document.getElementById("satd-ml-verif"); etat.mlVerif = !!(v && v.checked);
      if (!etat.mlVerif) { etat.mlErr = "Cochez la case une fois la mainlevée reçue du service qui a émis l'avis."; render("satd-ml-verif"); return; }
      var r = S.mainlevee(st(), e.target.getAttribute("data-id"));
      if (!r.ok) { etat.mlErr = r.erreur; render("satd-ml-err"); return; }
      B.store.sauver(); var ref = r.saisie.ref; etat.ml = null; etat.mlErr = ""; render(); var cc = document.getElementById("satd-s-" + ref); if (cc) { cc.setAttribute("tabindex", "-1"); cc.focus(); }
    }
  });
  app.addEventListener("change", function (e) {
    if (!e.target.closest || !e.target.closest("#satd-form")) return;
    if (e.target.id === "satd-verif") { etat.verif = e.target.checked; return; }
    /* Le message d'erreur reste affiché jusqu'au prochain calcul : le retirer au moment où le champ perd le focus ferait remonter le bouton « Calculer » et le clic sur celui-ci serait perdu. */
    lire(); etat.err = null; etat.apercu = null; etat.verif = false;
    if (e.target.id === "satd-client") render("satd-client");
    else { var m = document.getElementById("satd-calcul"); if (m) m.parentNode.removeChild(m); }
  });
  app.addEventListener("input", function (e) { if (e.target.id === "satd-avis" || e.target.id === "satd-du") etat.f[e.target.id.replace("satd-", "")] = e.target.value; });

  RECH.init(CL, document.getElementById("rech"), document.getElementById("rech-res"), document.getElementById("rech-statut"));
  render();
})();
