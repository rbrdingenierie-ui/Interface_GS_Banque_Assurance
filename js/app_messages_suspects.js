/* GS Banque & Assurance – page « Messages suspects » : examiner un e-mail, un SMS ou le récit d'un appel signalé par un client (ou reçu par un conseiller), le qualifier, relever les indices, choisir les
   mesures selon ce que le client a fait, rédiger la réponse (ou la note à la directrice) et la faire contrôler avant envoi.
   Les règles et le contrôle sont dans messages_suspects.js, les 12 messages dans data_messages.js. L'enregistrement se fait dans st.messagesSuspects (un traitement par message). */
(function () {
  "use strict";

  var SG = window.SGBF, B = SG.banque, CL = SG.clients, M = SG.messagesSuspects, ICO = SG.icones, RECH = SG.recherche, app = document.getElementById("app");
  var esc = B.esc, NB = "\u00a0";
  var CLIENT = {}; CL.forEach(function (c) { CLIENT[c.id] = c; });
  var FILTRES = [["atraiter", "À traiter"], ["traites", "Traités"], ["tous", "Tous"]];
  var VIDE = { type: "", indices: [], actions: [], reponse: "", note: "" };
  var etat = { filtre: "atraiter", ouvert: null, f: Object.assign({}, VIDE, { indices: [], actions: [] }), err: null, controle: null, fait: null, conf: null };

  function st() { return B.store.charger(); }
  function nomComplet(c) { return c.civ + " " + c.prenom + " " + c.nom.toUpperCase(); }
  function dateLongue(ymd) { var d = B.lireYmd(ymd); return d ? d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : ""; }
  function pl(n, s, p) { return n + " " + (n > 1 ? p : s); }
  function type(id) { return M.TYPES.filter(function (x) { return x.id === id; })[0] || null; }
  function compteur(t, m) { var c = M.CONV[m.destinataire === "direction" ? "direction" : "client"]; return pl(M.mots(t), "mot", "mots") + " – " + pl(t.length, "signe", "signes") + " sur " + String(c.signesMax).replace(/(\d)(\d{3})$/, "$1" + NB + "$2"); }
  function liste(l, vide) { return l.length ? '<ul class="ms-liste-r">' + l.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : esc(vide || "Aucun"); }
  function quand(m) { var j = m.jours; return j === 0 ? "aujourd'hui" : j === 1 ? "hier" : "il y a " + pl(j, "jour", "jours"); }

  /* ---------- déroulé, vue d'ensemble, filtres ---------- */
  function deroule() {
    var e = [
      ["Lire et comparer", "On lit le message sans cliquer, puis on compare l'adresse, le numéro et la demande aux coordonnées officielles de l'agence."],
      ["Qualifier", "Message authentique, hameçonnage, faux conseiller ou faux ordre de virement : on relève les indices qui le justifient."],
      ["Agir", "Les mesures dépendent de ce que le client a fait : rien, cliqué, saisi ses identifiants ou sa carte, donné un code, viré, installé un logiciel."],
      ["Répondre et contrôler", "La réponse au client, ou la note à la directrice, est contrôlée avant envoi : aucun lien, aucun code demandé, aucune promesse."]
    ];
    return '<ol class="op-deroule regul-deroule" aria-label="Déroulé du traitement d\'un message suspect">' + e.map(function (x, i) {
      return '<li><span class="op-deroule-num" aria-hidden="true">' + (i + 1) + '</span><span class="op-deroule-txt"><strong>' + esc(x[0]) + "</strong><span>" + esc(x[1]) + "</span></span></li>";
    }).join("") + "</ol>";
  }
  function vue(b) {
    var d = [["Messages à traiter", b.atraiter, "sur " + b.total + " messages", "ms-b-warn"], ["Messages urgents", b.urgents, b.urgents ? "une action est partie ou un ordre attend" : "aucun message urgent en attente", b.urgents ? "ms-b-bad" : "ms-b-ok"],
      ["Messages traités", b.traites, b.frauduleux + " classé" + (b.frauduleux > 1 ? "s" : "") + " comme frauduleux", "ms-b-ok"], ["Sans écart", b.conformes, "traitements conformes à l'analyse de l'agence", "ms-b-info"]];
    return '<section class="bloc ms-vue" aria-labelledby="ms-t-vue"><div class="bloc-tete"><h2 id="ms-t-vue">Vue d\'ensemble</h2><span class="sous">Agence de Paris – messages reçus ou signalés</span></div>' +
      '<dl class="ms-bilan" aria-label="Bilan des messages">' + d.map(function (x) { return '<div class="ms-b ' + x[3] + '"><dt>' + esc(x[0]) + "</dt><dd>" + esc(String(x[1])) + '</dd><dd class="ms-b-sous">' + esc(x[2]) + "</dd></div>"; }).join("") + "</dl>" +
      '<h3 class="ms-h3">Repères officiels de l\'agence, pour comparer</h3><dl class="ms-reperes" aria-label="Coordonnées officielles de l\'agence">' +
      "<div><dt>Numéro de l'agence</dt><dd>" + esc(M.TEL) + "</dd></div>" +
      "<div><dt>Adresses des conseillers</dt><dd>prénom.nom@" + esc(SG.carte.DOMAINE) + "</dd></div>" +
      "<div><dt>Ce que la banque ne demande jamais</dt><dd>Un code reçu par SMS, un mot de passe ou un identifiant, un virement vers un compte « sécurisé », l'installation d'un logiciel à distance.</dd></div>" +
      "<div><dt>Un numéro affiché prouve-t-il quelque chose ?</dt><dd>Non : un escroc peut afficher le numéro de l'agence. Dans le doute, on raccroche et on rappelle soi-même le numéro officiel.</dd></div></dl></section>";
  }
  function filtres(b) {
    var n = { atraiter: b.atraiter, traites: b.traites, tous: b.total };
    return '<div class="ms-filtres" role="group" aria-label="Messages à afficher">' + FILTRES.map(function (f) {
      return '<button type="button" class="btn ' + (etat.filtre === f[0] ? "btn-principal" : "btn-secondaire") + '" id="ms-f-' + f[0] + '" data-act="filtre" data-f="' + f[0] + '" aria-pressed="' + (etat.filtre === f[0]) + '">' + esc(f[1]) + " (" + n[f[0]] + ")</button>";
    }).join("") + "</div>";
  }

  /* ---------- un message ---------- */
  function puce(m, t) {
    if (t) return '<span class="chip chip-ok">' + ICO.check + "Traité</span>";
    if (m.urgent) return '<span class="chip chip-bad">' + ICO.alerte + "Urgent</span>";
    return '<span class="chip chip-warn">' + ICO.alerte + "À traiter</span>";
  }
  function provenance(m) {
    var c = m.client ? CLIENT[m.client] : null;
    if (!c) return "Message interne reçu par un conseiller de l'agence";
    var lien = ' – <a href="client.html?id=' + c.id + '">Fiche client</a>';
    if (m.via === "agence") return "Reçu par un conseiller, au nom de " + esc(nomComplet(c)) + " (client n° " + esc(c.num) + ")" + lien;
    return "Transmis par " + esc(nomComplet(c)) + ", " + c.age + " ans (client n° " + esc(c.num) + ")" + lien;
  }
  function entete(m, t) {
    return '<div class="regul-carte-tete"><div><h3 class="regul-nom">Message ' + esc(m.id) + " – " + esc(M.CANAUX[m.canal]) + '</h3><p class="regul-sous">Reçu le ' + esc(dateLongue(M.dateMessage(m, B.aujourdhui()))) + " (" + esc(quand(m)) + ")</p></div>" + puce(m, t) + "</div>";
  }
  function messageHtml(m) {
    var h = '<div class="ms-msg ms-' + m.canal + '" role="group" aria-label="Contenu du message ' + esc(m.id) + '"><dl class="ms-msg-tete">';
    if (m.canal === "email") h += "<div><dt>De</dt><dd>" + esc(m.de) + " &lt;<code>" + esc(m.adresse) + "</code>&gt;</dd></div><div><dt>Objet</dt><dd>" + esc(m.objet) + "</dd></div>";
    else if (m.canal === "sms") h += "<div><dt>Expéditeur</dt><dd>" + esc(m.de) + (/^Nom d'expéditeur/.test(m.adresse) ? "" : " – <code>" + esc(m.adresse) + "</code>") + "</dd></div>";
    else h += "<div><dt>Appelant</dt><dd>" + esc(m.de) + "</dd></div><div><dt>Numéro affiché</dt><dd>" + esc(m.adresse) + "</dd></div><div><dt>Nature</dt><dd>Transcription de l'appel, d'après le récit du client</dd></div>";
    h += '</dl><p class="ms-msg-corps">' + esc(m.texte) + "</p>";
    if (m.lien && m.canal === "email") h += '<p class="ms-lien">Le lien « ' + esc(m.lien.affiche) + " » mène, au survol, à l'adresse : <code>" + esc(m.lien.cible) + "</code></p>";
    return h + "</div>";
  }
  function contexte(m) {
    return '<div class="ms-ctx"><p><strong>Ce que l\'on sait.</strong> ' + esc(m.situation) + "</p><p>" + provenance(m) + "</p>" +
      (m.echeance ? '<p class="ms-urgence">Échéance : ' + esc(m.echeance) + ".</p>" : m.urgent ? '<p class="ms-urgence">Urgent : le client a déjà agi, chaque heure compte pour limiter les dégâts.</p>' : "") + "</div>";
  }

  /* ---------- panneau de traitement ---------- */
  function erreur(champ) { return etat.err && etat.err.some(function (e) { return e.champ === champ; }); }
  function controleHtml(r) {
    if (!r) return "";
    var h = "";
    if (r.bloquants.length) h += '<div class="ms-ctl ms-ctl-bad"><p class="ms-ctl-t">' + ICO.alerte + "Points bloquants (" + r.bloquants.length + ")</p><ul>" + r.bloquants.map(function (x) { return "<li><strong>" + esc(x.titre) + ".</strong> " + esc(x.detail) + "</li>"; }).join("") + "</ul></div>";
    if (r.avertissements.length) h += '<div class="ms-ctl ms-ctl-warn"><p class="ms-ctl-t">' + ICO.info + "Avertissements (" + r.avertissements.length + ")</p><ul>" + r.avertissements.map(function (x) { return "<li><strong>" + esc(x.titre) + ".</strong> " + esc(x.detail) + "</li>"; }).join("") + "</ul></div>";
    if (r.ok && !r.avertissements.length) h += '<div class="ms-ctl ms-ctl-ok"><p class="ms-ctl-t">' + ICO.check + "Aucun point bloquant, aucun avertissement</p><p>Le message peut être envoyé.</p></div>";
    else if (r.ok) h += '<p class="ms-ctl-fin">Aucun point bloquant : le message peut être envoyé, après lecture des avertissements.</p>';
    return h;
  }
  function formHtml(m) {
    var f = etat.f, ty = type(f.type), dir = m.destinataire === "direction", cv = M.CONV[dir ? "direction" : "client"];
    var h = '<form class="formulaire ms-form" id="ms-form" data-id="' + esc(m.id) + '" novalidate aria-labelledby="ms-t-' + esc(m.id) + '"><h4 class="ms-h4 ms-h4-form" id="ms-t-' + esc(m.id) + '" tabindex="-1">Traiter le message ' + esc(m.id) + "</h4>";
    h += '<fieldset class="op-section ms-fs"><legend id="ms-l-type">Type du message *</legend><div class="ms-radios" role="radiogroup" aria-labelledby="ms-l-type"' + (erreur("type") ? ' aria-invalid="true" aria-describedby="ms-err"' : "") + ">" + M.TYPES.map(function (x) {
      return '<label class="op-case"><input type="radio" name="ms-type" id="ms-type-' + x.id + '" value="' + x.id + '"' + (f.type === x.id ? " checked" : "") + '><span><strong>' + esc(x.lib) + '</strong><span class="ms-sous">' + esc(x.sous) + "</span></span></label>";
    }).join("") + "</div></fieldset>";
    if (ty) h += '<div class="ms-procedure"><p class="ms-ctl-t">Procédure conseillée par GS (convention de l\'exercice)</p><p>' + esc(ty.procedure) + "</p></div>";
    h += '<fieldset class="op-section ms-fs"><legend id="ms-l-indices">Indices relevés dans ce message *</legend><p class="ms-aide" id="ms-aide-ind">Cochez uniquement ce que vous observez dans ce message. Un message authentique n\'en porte aucun : ne cochez alors rien.</p><div class="ms-radios" aria-describedby="ms-aide-ind' + (erreur("indices") ? " ms-err" : "") + '">' + M.INDICES.map(function (x) {
      return '<label class="op-case"><input type="checkbox" name="ms-indice" id="ms-indice-' + x.id + '" value="' + x.id + '"' + (f.indices.indexOf(x.id) >= 0 ? " checked" : "") + '><span><strong>' + esc(x.lib) + '</strong><span class="ms-sous">' + esc(x.sous) + "</span></span></label>";
    }).join("") + "</div></fieldset>";
    h += '<fieldset class="op-section ms-fs"><legend id="ms-l-actions">Mesures à prendre *</legend><p class="ms-aide" id="ms-aide-act">Adaptez-les à ce que le client a fait : lisez bien « Ce que l\'on sait » au-dessus du message.</p><div' + (erreur("actions") ? ' aria-describedby="ms-aide-act ms-err"' : ' aria-describedby="ms-aide-act"') + ">" + M.GROUPES.map(function (g) {
      return '<div class="ms-groupe" role="group" aria-labelledby="ms-g-' + g[0] + '"><p class="ms-groupe-t" id="ms-g-' + g[0] + '">' + esc(g[1]) + '</p><div class="ms-radios">' + M.ACTIONS.filter(function (x) { return x.groupe === g[0]; }).map(function (x) {
        return '<label class="op-case"><input type="checkbox" name="ms-action" id="ms-action-' + x.id + '" value="' + x.id + '"' + (f.actions.indexOf(x.id) >= 0 ? " checked" : "") + "><span>" + esc(x.lib) + "</span></label>";
      }).join("") + "</div></div>";
    }).join("") + "</div></fieldset>";
    h += '<div class="champ ms-champ"><label for="ms-reponse">' + (dir ? "Note d'alerte à la directrice *" : "Réponse à envoyer au client *") + '</label><textarea id="ms-reponse" rows="9" maxlength="2500"' + (erreur("reponse") ? ' aria-invalid="true" aria-describedby="ms-aide-rep ms-compteur ms-err"' : ' aria-describedby="ms-aide-rep ms-compteur"') + ">" + esc(f.reponse) + "</textarea>" +
      '<span class="aide-champ" id="ms-aide-rep">' + (dir ? "Dites ce qui est arrivé (heure, adresse d'expédition), ce que vous n'avez pas fait, comment la demande sera vérifiée. Entre " : "Aucun lien, aucun code ni mot de passe demandé, aucune promesse de remboursement, aucun jugement sur le client : expliquez ce qui est fait, ce qu'il doit faire et par où passer (le numéro de l'agence, l'application). Entre ") + cv.motsMin + " et " + cv.motsMax + " mots.</span>" +
      '<span class="ms-compteur" id="ms-compteur">' + esc(compteur(f.reponse, m)) + "</span></div>" +
      '<div class="ms-btns"><button type="button" class="btn btn-secondaire" data-act="controler">Contrôler le message avant envoi</button></div>';
    h += '<div id="ms-controle" class="ms-controle" tabindex="-1" aria-live="polite">' + controleHtml(etat.controle) + "</div>";
    h += '<div class="champ ms-champ"><label for="ms-note">Note interne (facultative)</label><textarea id="ms-note" rows="3" maxlength="300"' + (erreur("note") ? ' aria-invalid="true" aria-describedby="ms-aide-note ms-err"' : ' aria-describedby="ms-aide-note"') + ">" + esc(f.note) + "</textarea>" +
      '<span class="aide-champ" id="ms-aide-note">Pour la directrice et vos collègues : ce que vous avez constaté ou décidé. Elle n\'est jamais envoyée au client. 300 signes au plus.</span></div>';
    h += '<div class="msg-erreur" id="ms-err" role="alert">' + (etat.err ? (etat.err.length > 1 ? "<ul>" + etat.err.map(function (e) { return "<li>" + esc(e.msg) + "</li>"; }).join("") + "</ul>" : esc(etat.err[0].msg)) : "") + "</div>";
    h += '<div class="ms-btns"><button type="submit" class="btn btn-principal">Enregistrer le traitement</button><button type="button" class="btn btn-secondaire" data-act="annuler">Annuler</button></div></form>';
    return h;
  }

  /* ---------- message traité ---------- */
  function analyse(m, t) {
    var e = M.ecarts(m, t), h = '<div class="ms-ctl ' + (e.n ? "ms-ctl-warn" : "ms-ctl-ok") + ' ms-diff"><p class="ms-ctl-t">' + (e.n ? ICO.info + "Écarts avec l'analyse de l'agence (" + e.n + ")" : ICO.check + "Votre analyse correspond à celle de l'agence : type et indices") + "</p>";
    if (e.n) {
      h += "<ul>";
      if (!e.type.ok) h += "<li>Type retenu : <strong>" + esc(M.typeLib(e.type.retenu)) + "</strong> ; type attendu : <strong>" + esc(M.typeLib(e.type.attendu)) + "</strong>.</li>";
      if (e.manquants.length) h += "<li>Indice" + (e.manquants.length > 1 ? "s" : "") + " non relevé" + (e.manquants.length > 1 ? "s" : "") + " : " + esc(e.manquants.map(M.indiceLib).join(" ; ")) + ".</li>";
      if (e.enTrop.length) h += "<li>Indice" + (e.enTrop.length > 1 ? "s" : "") + " relevé" + (e.enTrop.length > 1 ? "s" : "") + " à tort : " + esc(e.enTrop.map(M.indiceLib).join(" ; ")) + ".</li>";
      h += "</ul>";
    }
    return h + '</div><div class="ms-expl"><p class="ms-ctl-t">Ce qu\'il fallait voir dans ce message</p><p>' + esc(m.explication) + "</p></div>";
  }
  function liensSuites(m, t) {
    var c = m.client ? CLIENT[m.client] : null, h = "";
    if (!c) return "";
    h = '<div class="regul-actions"><a class="btn btn-secondaire ms-lien-btn" href="client.html?id=' + c.id + '">Fiche client ' + esc(c.prenom + " " + c.nom.toUpperCase()) + "</a>";
    if (t.actions.indexOf("contester") >= 0) h += '<a class="btn btn-secondaire ms-lien-btn" href="reclamation.html?client=' + c.id + '">Enregistrer la réclamation de ' + esc(c.prenom + " " + c.nom.toUpperCase()) + "</a>";
    return h + "</div>";
  }
  function recap(m, t) {
    var ctl = M.controler(t.reponse, { type: t.type, contexte: m.contexte, destinataire: m.destinataire }), dir = m.destinataire === "direction";
    var h = '<dl class="regul-donnees ms-recap"><div><dt>Type retenu</dt><dd>' + esc(M.typeLib(t.type)) + "</dd></div><div><dt>Indices relevés</dt><dd>" + liste(t.indices.map(M.indiceLib), "Aucun indice") + "</dd></div>" +
      "<div><dt>Mesures retenues</dt><dd>" + liste(t.actions.map(function (x) { return M.action(x).lib; })) + "</dd></div>" +
      "<div><dt>" + (dir ? "Note à la directrice, validée pour envoi" : "Réponse au client, validée pour envoi") + '</dt><dd class="ms-rep">' + esc(t.reponse) + "</dd></div>" +
      (t.note ? "<div><dt>Note interne</dt><dd>" + esc(t.note) + "</dd></div>" : "") +
      "<div><dt>Traité le</dt><dd>" + esc(dateLongue(t.date)) + " à " + esc(t.heure.replace(":", " h ")) + (t.par ? " par " + esc(t.par) : "") + "</dd></div></dl>";
    h += analyse(m, t);
    if (ctl.avertissements.length) h += '<div class="ms-ctl ms-ctl-warn"><p class="ms-ctl-t">' + ICO.info + "Avertissements du contrôle (" + ctl.avertissements.length + ")</p><ul>" + ctl.avertissements.map(function (x) { return "<li><strong>" + esc(x.titre) + ".</strong> " + esc(x.detail) + "</li>"; }).join("") + "</ul></div>";
    if (t.points && t.points.length) h += '<div class="ms-ctl ms-ctl-warn"><p class="ms-ctl-t">' + ICO.info + "Points d'attention (" + t.points.length + ")</p><ul>" + t.points.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div>";
    return h + liensSuites(m, t);
  }
  function confirmation(m, t) {
    return '<section class="bloc ms-ok" id="ms-ok" aria-labelledby="ms-t-ok"><div class="bloc-tete"><h2 id="ms-t-ok" tabindex="-1">' + ICO.check + "Traitement enregistré</h2><span class=\"sous\">Message " + esc(m.id) + " – " + esc(M.CANAUX[m.canal]) + "</span></div>" +
      '<p class="ms-ok-txt">Le message est validé : il reste à l\'envoyer par les moyens habituels (cet outil n\'envoie rien). Les mesures retenues sont à faire par vous ou à transmettre.</p>' + recap(m, t) +
      '<div class="ms-btns"><button type="button" class="btn btn-secondaire" data-act="fermer-ok">Fermer</button><button type="button" class="btn btn-secondaire" data-act="voir-traites">Voir les messages traités</button></div></section>';
  }
  function confirmRemettre(m) {
    return '<div class="ms-conf" id="ms-conf" tabindex="-1" role="group" aria-labelledby="ms-conf-t"><p id="ms-conf-t"><strong>Remettre le message ' + esc(m.id) + " à traiter ?</strong> Le traitement, la réponse et la note enregistrés seront effacés.</p>" +
      '<div class="ms-btns"><button type="button" class="btn btn-principal" data-act="remettre-ok" data-id="' + esc(m.id) + '">Remettre à traiter</button><button type="button" class="btn btn-secondaire" data-act="remettre-non" data-id="' + esc(m.id) + '">Annuler</button></div></div>';
  }
  function carte(m) {
    var t = M.traitement(st(), m.id), ouvert = etat.ouvert === m.id, h;
    h = '<li class="regul-carte ms-carte ms-carte-' + (t ? "traite" : m.urgent ? "urgent" : "attente") + '" id="ms-' + esc(m.id) + '">' + entete(m, t) + messageHtml(m) + contexte(m);
    if (t) {
      h += recap(m, t);
      h += etat.conf === m.id ? confirmRemettre(m) : '<div class="ms-btns"><button type="button" class="btn btn-secondaire" data-act="remettre" data-id="' + esc(m.id) + '">Remettre à traiter</button></div>';
    } else if (ouvert) h += '<div id="ms-zone">' + formHtml(m) + "</div>";
    else h += '<div class="ms-btns"><button type="button" class="btn btn-principal" data-act="traiter" data-id="' + esc(m.id) + '">Traiter ce message</button></div>';
    return h + "</li>";
  }
  function listeHtml(b) {
    var l = M.liste().filter(function (m) { var t = M.traitement(st(), m.id); return etat.filtre === "tous" || (etat.filtre === "traites" ? !!t : !t); });
    var h = '<section class="bloc" aria-labelledby="ms-t-liste"><div class="bloc-tete"><h2 id="ms-t-liste" tabindex="-1">Messages reçus</h2><span class="sous">' + pl(l.length, "message affiché", "messages affichés") + " – les urgents d'abord</span></div>" + filtres(b);
    if (!l.length) return h + '<p class="vide-bloc">' + (etat.filtre === "atraiter" ? "Tous les messages sont traités. Les messages traités sont consultables, et peuvent être remis à traiter, dans l'onglet « Traités »." : "Aucun message traité pour le moment. Choisissez un message, lisez-le sans cliquer, qualifiez-le, choisissez les mesures puis faites contrôler la réponse.") + "</p></section>";
    return h + '<ul class="regul-liste ms-liste">' + l.map(carte).join("") + "</ul></section>";
  }

  /* ---------- règles et sources ---------- */
  function regles() {
    return '<section class="bloc" aria-labelledby="ms-t-regles"><div class="bloc-tete"><h2 id="ms-t-regles">Les règles à connaître</h2><span class="sous">Textes consultés le 17 novembre 2026</span></div>' +
      M.REGLES.map(function (r) { return '<details class="ms-regle"><summary>' + esc(r.titre) + "</summary><p>" + esc(r.texte) + "</p></details>"; }).join("") + "</section>";
  }

  /* Typographie française : espace insécable avant « : », « % » et « € », dans les nombres à milliers et à l'intérieur des guillemets. */
  function typo(racine) {
    var w = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT, null), n, l = [];
    while ((n = w.nextNode())) { if (n.parentNode && /^(SCRIPT|STYLE|OPTION|TEXTAREA)$/.test(n.parentNode.nodeName)) continue; l.push(n); }
    l.forEach(function (t) {
      var v = t.nodeValue, r = v.replace(/ +([:;!?%€»])/g, "\u00a0$1").replace(/(\d) (?=\d{3}(?!\d))/g, "$1\u00a0").replace(/« +/g, "«\u00a0");
      if (r !== v) t.nodeValue = r;
    });
  }
  function render(focus) {
    document.title = "GS Banque & Assurance – Messages suspects";
    var b = M.bilan(st()), fait = etat.fait ? M.trouver(etat.fait) : null, tf = fait ? M.traitement(st(), fait.id) : null;
    app.innerHTML = '<nav class="fil-ariane" aria-label="Fil d\'Ariane"><a href="index.html">' + ICO.retour + 'Accueil</a></nav>' +
      '<div class="page-titre"><h1>Messages suspects</h1><p>Des clients transmettent à l\'agence un e-mail, un SMS ou le récit d\'un appel qui leur paraît suspect, et des conseillers reçoivent des demandes de virement inhabituelles. Le conseiller examine chaque message, relève les indices, décide des mesures selon ce que le client a fait, puis rédige la réponse.</p></div>' +
      deroule() + vue(b) + (fait && tf ? confirmation(fait, tf) : "") + listeHtml(b) + regles() +
      '<p class="ms-rappel">Sources des règles : site Les clés de la banque (fraude au faux conseiller) ; Cybermalveillance.gouv.fr (fiches réflexes « Hameçonnage » et « Faux ordres de virement ») ; direction générale des collectivités locales (consigne de rappel de l\'auteur d\'une demande de virement) ; Code monétaire et financier, articles L133-18, L133-19, L133-23 et L133-24. La version en vigueur de l\'article L133-18 n\'a pas pu être relue : seul son principe est repris. Les messages, les entreprises, les adresses et les numéros sont inventés. Aucun message n\'est envoyé par cet outil.</p>';
    typo(app);
    if (focus) { var n = document.getElementById(focus); if (n) { try { n.focus(); } catch (e) { /* ignoré */ } if (/^ms-t-/.test(focus) && n.scrollIntoView) n.scrollIntoView({ block: "start" }); } }
  }
  /* Met à jour seulement le panneau de traitement (garde le défilement et la saisie de la page). */
  function majForm(focus) {
    var m = etat.ouvert ? M.trouver(etat.ouvert) : null, z = document.getElementById("ms-zone"); if (!m || !z) { render(focus); return; }
    z.innerHTML = formHtml(m); typo(z);
    if (focus) { var n = document.getElementById(focus); if (n) { try { n.focus(); } catch (e) { /* ignoré */ } } }
  }

  /* ---------- actions ---------- */
  function lire() {
    var f = document.getElementById("ms-form"); if (!f) return;
    var r = f.querySelector('input[name="ms-type"]:checked'); etat.f.type = r ? r.value : "";
    etat.f.indices = Array.prototype.filter.call(f.querySelectorAll('input[name="ms-indice"]'), function (i) { return i.checked; }).map(function (i) { return i.value; });
    etat.f.actions = Array.prototype.filter.call(f.querySelectorAll('input[name="ms-action"]'), function (i) { return i.checked; }).map(function (i) { return i.value; });
    var rep = document.getElementById("ms-reponse"); if (rep) etat.f.reponse = rep.value;
    var no = document.getElementById("ms-note"); if (no) etat.f.note = no.value;
  }
  function saisie() { return { type: etat.f.type, indices: etat.f.indices.slice(), actions: etat.f.actions.slice(), reponse: etat.f.reponse, note: etat.f.note }; }
  var CIBLE = { type: function () { return "ms-type-" + M.TYPES[0].id; }, indices: function () { return "ms-indice-" + M.INDICES[0].id; }, actions: function () { return "ms-action-" + M.ACTIONS[0].id; }, reponse: function () { return "ms-reponse"; }, note: function () { return "ms-note"; }, message: function () { return "ms-err"; } };
  function enregistrer() {
    lire();
    var m = M.trouver(etat.ouvert); if (!m) return;
    var r = M.valider(st(), m.id, saisie());
    if (!r.ok) {
      etat.err = r.erreurs; etat.controle = r.controle || null;
      var c = r.erreurs[0].champ, id = (CIBLE[c] || CIBLE.message)();
      if (c === "type" && etat.f.type) id = "ms-type-" + etat.f.type;
      majForm(document.getElementById(id) ? id : "ms-err"); return;
    }
    B.store.sauver();
    etat.fait = m.id; etat.ouvert = null; etat.f = Object.assign({}, VIDE, { indices: [], actions: [] }); etat.err = null; etat.controle = null; etat.conf = null;
    render("ms-t-ok");
  }
  function controler() {
    lire();
    var m = M.trouver(etat.ouvert); if (!m) return;
    etat.err = null; etat.controle = M.controler(etat.f.reponse, { type: etat.f.type, contexte: m.contexte, destinataire: m.destinataire });
    majForm("ms-controle");
  }

  app.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-act]") : null; if (!b) return;
    var act = b.getAttribute("data-act"), id = b.getAttribute("data-id");
    if (act === "filtre") { etat.filtre = b.getAttribute("data-f"); etat.ouvert = null; etat.conf = null; render("ms-f-" + etat.filtre); }
    else if (act === "traiter") { etat.ouvert = id; etat.f = Object.assign({}, VIDE, { indices: [], actions: [] }); etat.err = null; etat.controle = null; etat.fait = null; etat.conf = null; render("ms-t-" + id); }
    else if (act === "annuler") { var o = etat.ouvert; etat.ouvert = null; etat.err = null; etat.controle = null; render(); var bt = document.querySelector('[data-act="traiter"][data-id="' + o + '"]'); if (bt) bt.focus(); }
    else if (act === "controler") controler();
    else if (act === "remettre") { etat.conf = id; etat.ouvert = null; render("ms-conf"); }
    else if (act === "remettre-non") { etat.conf = null; render(); var br = document.querySelector('[data-act="remettre"][data-id="' + id + '"]'); if (br) br.focus(); }
    else if (act === "remettre-ok") { var r = M.remettre(st(), id); if (r.ok) B.store.sauver(); etat.conf = null; render("ms-t-liste"); }
    else if (act === "fermer-ok") { etat.fait = null; render("ms-t-liste"); }
    else if (act === "voir-traites") { etat.fait = null; etat.filtre = "traites"; render("ms-t-liste"); }
  });
  app.addEventListener("submit", function (e) { if (e.target.id === "ms-form") { e.preventDefault(); enregistrer(); } });
  app.addEventListener("change", function (e) {
    var t = e.target; if (!t.closest || !t.closest("#ms-form") || !t.name) return;
    if (t.name !== "ms-type" && t.name !== "ms-indice" && t.name !== "ms-action") return;
    lire();
    if (t.name === "ms-action") {                      /* « Aucune mesure » exclut toutes les autres */
      if (t.value === "aucune" && t.checked) etat.f.actions = ["aucune"];
      else if (t.value !== "aucune" && t.checked) etat.f.actions = etat.f.actions.filter(function (x) { return x !== "aucune"; });
    }
    etat.err = null; etat.controle = null; majForm(t.id);
  });
  app.addEventListener("input", function (e) {
    var t = e.target;
    if (t.id === "ms-reponse") {
      etat.f.reponse = t.value; var m = M.trouver(etat.ouvert), c = document.getElementById("ms-compteur"); if (c && m) c.textContent = compteur(t.value, m);
      if (etat.controle) { etat.controle = null; var z = document.getElementById("ms-controle"); if (z) z.innerHTML = ""; }
    } else if (t.id === "ms-note") etat.f.note = t.value;
  });

  RECH.init(CL, document.getElementById("rech"), document.getElementById("rech-res"), document.getElementById("rech-statut"));
  render();
})();
