/* GS Banque & Assurance – alertes du poste : appels entrants simulés (avec sonnerie) et clients au distributeur (règles : appels.js ; scénarios de l'enseignant : scenarios_appels.js et app_scenarios.js).
   Sur chaque page : dans l'en-tête, les boutons « Disponible / Indisponible », « Journal du poste » et « Sonnerie » (les simulations d'appels de l'enseignant s'ouvrent en tapant « simulation » dans la recherche) ; en bas à droite, la fenêtre d'appel (nom du client,
   « Décrocher », « Raccrocher », avec l'avatar du client, sa fiche en résumé et le temps de sonnerie qui reste), la fenêtre « Sécuriser l'appel » (à la prise d'appel d'un client : questions de sécurité avec les réponses du dossier, à cocher) et la fenêtre « Client au distributeur »
   (nom du client, ce qu'il fait, « Aller l'accueillir », « Ignorer »). Les fenêtres s'empilent sans se recouvrir. Quand le conseiller décroche, la fiche du client s'ouvre toute seule.
   L'état (appel en cours, client au distributeur, journal, disponibilité, sonnerie) est gardé dans le navigateur : il se poursuit d'une page à l'autre.
   Répondeur IA : un appel manqué ou refusé laisse un message retranscrit à l'écrit ; une carte « Nouveau message au répondeur » s'affiche 15 secondes après un appel manqué, et le bouton « Répondeur » de l'en-tête
   porte la pastille des messages non lus (la fenêtre du répondeur liste les messages, du plus urgent au plus ancien : « Ouvrir la fiche », « Marquer comme traité », « Supprimer »).
   Sonnerie : un son de téléphone fabriqué par le navigateur (aucun fichier son). Les navigateurs ne l'autorisent qu'après un clic ou une touche sur la page : tant que ce n'est pas fait,
   la fenêtre d'appel propose « Activer le son ».
   La liste des clients, le calcul des soldes, les scénarios et leur écran ne sont chargés qu'au moment où on en a besoin : toutes les pages n'ont pas ces fichiers. */
(function (root) {
  "use strict";
  var doc = root.document, A = root.SGBF && root.SGBF.appels;
  if (!doc || !A) return;
  var reg = A.reglages(root.SGBF_APPELS);
  if (!reg.actif) return;

  var memoire = null;
  function charger() {
    try { return A.valider(JSON.parse(root.localStorage.getItem(A.CLE) || "null")); } catch (e) { return memoire ? A.valider(memoire) : A.neuf(); }
  }
  function sauver(st) { memoire = JSON.parse(JSON.stringify(st)); try { root.localStorage.setItem(A.CLE, JSON.stringify(st)); } catch (e) { /* ignoré : l'état reste dans cette page */ } }

  var B = root.SGBF && root.SGBF.banque;
  function maintenant() { return B && B.maintenant ? B.maintenant() : new Date(); }
  function aujourdhui() { return B && B.aujourdhui ? B.aujourdhui() : new Date(); }
  function p2(n) { return (n < 10 ? "0" : "") + n; }
  function quand() { var d = maintenant(); return p2(d.getDate()) + "/" + p2(d.getMonth() + 1) + " " + p2(d.getHours()) + ":" + p2(d.getMinutes()); }
  function ouvert() { var d = maintenant(); return B && B.ouvertA ? B.ouvertA(d) : true; }
  /* Premier instant, à partir de ms (heure de l'horloge du navigateur), où l'agence est ouverte : les appels et les clients au distributeur n'arrivent qu'aux heures d'ouverture.
     L'horloge du poste (maintenant) peut être figée par les essais : on se règle sur elle, puis on revient à l'horloge du navigateur. */
  function ouvre(ms) {
    if (!B || !B.prochaineOuverture) return ms;
    var dec = maintenant().getTime() - Date.now();
    return B.prochaineOuverture(new Date(ms + dec)).getTime() - dec;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function solde(c) { var M = root.SGBF.mouvements; try { return M ? M.releve(c, 1).solde : null; } catch (e) { return null; } }
  function lignes(c) { var M = root.SGBF.mouvements; try { return M ? M.releve(c, 14).lignes.filter(function (l) { return !l.operation; }) : []; } catch (e) { return []; } }
  function ctx() { return { rng: Math.random, reg: reg, clients: root.SGBF.clients || null, donnees: donneesPretes(), ouvert: ouvert(), ouvre: ouvre, quand: quand(), solde: solde, lignes: lignes, auj: aujourdhui() }; }

  function svg(d) { return '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + "</svg>"; }
  var PHONE = svg('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>');
  var PHONE_OFF = svg('<path d="M10.7 13.3a16 16 0 0 0 3 2.3l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1M5.3 10.7A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9M22 2 2 22"/>');
  var HP_ON = svg('<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/>');
  var HP_OFF = svg('<path d="M11 5 6 9H2v6h4l5 4z"/><path d="m23 9-6 6"/><path d="m17 9 6 6"/>');
  var VOICEMAIL = svg('<circle cx="6" cy="12" r="4"/><circle cx="18" cy="12" r="4"/><path d="M6 16h12"/>');
  var DAB = svg('<rect x="3" y="3" width="18" height="18" rx="2"/><rect x="6" y="6" width="12" height="6" rx="1"/><path d="M8 16h8"/><path d="M8 19h3"/>');

  /* ---------- sonnerie : un son de téléphone fabriqué par le navigateur (Web Audio) ---------- */
  var ac = null, tampon = null, source = null, gain = null, muetPour = 0;
  function contexte() {
    var C = root.AudioContext || root.webkitAudioContext;
    if (!C) return null;
    if (!ac) { try { ac = new C(); } catch (e) { ac = null; } }
    return ac;
  }
  /* Cycle de 4 secondes : deux « trrrr-trrrr » (alternance rapide de deux notes, comme un téléphone de bureau), puis un silence. */
  var CYCLE = 4, RAFALES = [[0, 0.8], [1, 1.8]], NOTES = [1245, 1568], PAS = 0.04;
  function fabriquerTampon(c) {
    var fe = c.sampleRate, n = Math.round(CYCLE * fe), buf = c.createBuffer(1, n, fe), d = buf.getChannelData(0), phase = 0, i, t;
    for (i = 0; i < n; i++) {
      t = i / fe;
      var v = 0;
      for (var r = 0; r < RAFALES.length; r++) {
        var a = RAFALES[r][0], b = RAFALES[r][1];
        if (t >= a && t < b) {
          var f = NOTES[Math.floor((t - a) / PAS) % 2];
          phase += 2 * Math.PI * f / fe;
          var env = Math.min(1, (t - a) / 0.01, (b - t) / 0.02);
          v = (Math.sin(phase) + 0.25 * Math.sin(2 * phase) + 0.1 * Math.sin(3 * phase)) * 0.55 * env;
        }
      }
      d[i] = v;
    }
    return buf;
  }
  function debloquer() {
    var c = contexte();
    if (c && c.state === "suspended" && c.resume) { try { var p = c.resume(); if (p && p.then) p.then(majSon, function () { /* refusé */ }); } catch (e) { /* ignoré */ } }
    majSon();
  }
  function arreterSon() {
    if (source) { try { source.stop(); } catch (e) { /* déjà arrêtée */ } try { source.disconnect(); } catch (e2) { /* ignoré */ } source = null; }
  }
  function sonVoulu(s) { var a = s.courant; return !!(reg.son && reg.volume > 0 && s.son && a && a.etat === "sonne" && muetPour !== a.id); }
  /* Renvoie l'état de la sonnerie : « non » (pas de sonnerie), « joue » ou « bloque » (le navigateur attend un clic). */
  function majSon() {
    if (!sonVoulu(st)) { arreterSon(); return "non"; }
    if (source) return "joue";
    var c = contexte();
    if (!c) return "non";
    if (c.state !== "running") { if (c.resume && c.state === "suspended") { try { var p = c.resume(); if (p && p.then) p.then(majSon, function () { /* refusé */ }); } catch (e) { /* ignoré */ } } if (c.state !== "running") return "bloque"; }
    try {
      if (!tampon || tampon.contexte !== c) { tampon = { contexte: c, buf: fabriquerTampon(c) }; }
      source = c.createBufferSource(); source.buffer = tampon.buf; source.loop = true;
      gain = c.createGain(); gain.gain.value = reg.volume / 100 * 0.6;
      source.connect(gain); gain.connect(c.destination); source.start(0);
      return "joue";
    } catch (e) { source = null; return "non"; }
  }
  function etatSon() { if (!sonVoulu(st)) return "non"; if (source) return "joue"; var c = contexte(); return c && c.state === "running" ? "joue" : (c ? "bloque" : "non"); }

  /* ---------- fenêtres : appel entrant et client au distributeur ---------- */
  var st = charger(), fin = null, dabFin = null, dernierExterne = null, journalOuvert = false;
  var zone, fen, etatEl, nomEl, telEl, minEl, btnPrendre, btnRaccrocher, btnIndispo, btnMuet, lienFiche, lienOps, noteSon, annonce, btnDispo, btnJournal, btnSon, dlg, dlgContenu;
  var dab, dabEtat, dabNom, dabInfo, dabSolde, dabAccueillir, dabIgnorer, dabFiche, dabCre, dabOps, dabFermer, dabAvatar, dabGenre, dabBarre, dabReste;
  var avatarEl, metaEl, barreEl, repT, repTNom, repTTexte, repToast = null, repDlg, repContenu, repOuvert = false, repAvant = 0, btnRep;
  var secu, secuCorps, secuReduire, secuEtat, secuPour = null, secuReduit = false;

  function creerFenetres() {
    zone = doc.createElement("div");
    zone.id = "poste-alertes"; zone.className = "poste-alertes"; zone.hidden = true;
    zone.setAttribute("role", "region"); zone.setAttribute("aria-label", "Alertes du poste : appels et distributeur");
    /* appel entrant */
    fen = doc.createElement("section");
    fen.id = "appel-entrant"; fen.className = "appel"; fen.hidden = true;
    fen.setAttribute("role", "group"); fen.setAttribute("aria-labelledby", "appel-nom"); fen.setAttribute("aria-describedby", "appel-etat");
    fen.innerHTML =
      '<div class="appel-tete">' +
      '<span class="appel-avatar" id="appel-avatar" aria-hidden="true"></span>' +
      '<div class="appel-id"><p class="appel-etat" id="appel-etat"></p>' +
      '<p class="appel-nom" id="appel-nom"></p>' +
      '<p class="appel-tel" id="appel-tel"></p>' +
      '<p class="appel-meta" id="appel-meta"></p></div>' +
      '<p class="appel-minuteur" id="appel-minuteur" hidden></p>' +
      "</div>" +
      '<div class="appel-barre" id="appel-barre" aria-hidden="true"><span></span></div>' +
      '<div class="appel-actions">' +
      '<button type="button" class="appel-btn appel-prendre" id="appel-prendre">' + PHONE + "<span>Décrocher</span></button>" +
      '<button type="button" class="appel-btn appel-raccrocher" id="appel-raccrocher">' + PHONE_OFF + "<span>Raccrocher</span></button>" +
      "</div>" +
      '<p class="appel-note-son" id="appel-note-son" hidden>Le navigateur bloque la sonnerie tant que vous n\'avez pas cliqué sur la page. <button type="button" class="appel-lien-btn" id="appel-activer">Activer le son</button></p>' +
      '<div class="appel-sec">' +
      '<a class="appel-lien" id="appel-lien" href="client.html" hidden></a>' +
      '<a class="appel-lien" id="appel-ops" href="operations.html" hidden>Faire une opération</a>' +
      '<button type="button" class="appel-sec-btn" id="appel-muet" hidden>Couper la sonnerie</button>' +
      '<button type="button" class="appel-sec-btn" id="appel-indispo">Me mettre en indisponible</button>' +
      "</div>";
    /* client au distributeur */
    dab = doc.createElement("section");
    dab.id = "alerte-dab"; dab.className = "alerte-dab"; dab.hidden = true;
    dab.setAttribute("role", "group"); dab.setAttribute("aria-labelledby", "dab-nom"); dab.setAttribute("aria-describedby", "dab-etat");
    dab.innerHTML =
      '<div class="dab-tete"><span class="dab-avatar" id="dab-avatar" aria-hidden="true">' + DAB + "</span>" +
      '<div class="dab-id"><p class="dab-etat" id="dab-etat"><span id="dab-etat-txt"></span></p>' +
      '<p class="dab-nom" id="dab-nom"></p>' +
      '<p class="dab-puces"><span class="dab-genre" id="dab-genre"></span><span class="dab-reste" id="dab-reste"></span></p></div></div>' +
      '<div class="dab-ecran"><p class="dab-info" id="dab-info"></p>' +
      '<p class="dab-solde" id="dab-solde"></p></div>' +
      '<div class="appel-barre dab-barre" id="dab-barre" aria-hidden="true"><span></span></div>' +
      '<div class="dab-actions">' +
      '<button type="button" class="dab-btn" id="dab-accueillir">Aller l\'accueillir</button>' +
      '<button type="button" class="dab-btn dab-btn-sec" id="dab-ignorer">Ignorer</button>' +
      "</div>" +
      '<div class="appel-sec">' +
      '<a class="appel-lien" id="dab-fiche" href="client.html">Ouvrir la fiche client</a>' +
      '<a class="appel-lien" id="dab-cre" href="contacts.html" hidden>Noter l\'entretien</a>' +
      '<a class="appel-lien" id="dab-ops" href="operations.html" hidden>Faire une opération</a>' +
      '<button type="button" class="appel-sec-btn" id="dab-fermer" hidden>Fermer</button>' +
      "</div>";
    /* nouveau message au répondeur */
    repT = doc.createElement("section");
    repT.id = "alerte-repondeur"; repT.className = "alerte-rep"; repT.hidden = true;
    repT.setAttribute("role", "group"); repT.setAttribute("aria-labelledby", "rep-t-nom"); repT.setAttribute("aria-describedby", "rep-t-etat");
    repT.innerHTML =
      '<div class="rep-t-tete"><span class="rep-t-ico" aria-hidden="true">' + VOICEMAIL + '</span><div class="rep-t-id"><p class="rep-t-etat" id="rep-t-etat">Nouveau message au répondeur</p><p class="rep-t-nom" id="rep-t-nom"></p></div></div>' +
      '<p class="rep-t-texte" id="rep-t-texte"></p>' +
      '<div class="rep-t-actions"><button type="button" class="appel-btn rep-t-lire" id="rep-t-lire"><span>Lire le message</span></button><button type="button" class="appel-sec-btn" id="rep-t-fermer">Plus tard</button></div>';
    /* sécuriser l'appel */
    secu = doc.createElement("section");
    secu.id = "appel-secu"; secu.className = "appel-secu"; secu.hidden = true;
    secu.setAttribute("role", "group"); secu.setAttribute("aria-labelledby", "secu-titre");
    secu.innerHTML =
      '<div class="secu-tete"><h2 class="secu-titre" id="secu-titre">Sécuriser l\'appel</h2><button type="button" class="appel-sec-btn" id="secu-reduire" aria-expanded="true" aria-controls="secu-corps">Réduire</button></div>' +
      '<div class="secu-corps" id="secu-corps"></div>';
    zone.appendChild(fen); zone.appendChild(secu); zone.appendChild(dab); zone.appendChild(repT);
    doc.body.appendChild(zone);
    avatarEl = fen.querySelector("#appel-avatar"); metaEl = fen.querySelector("#appel-meta"); barreEl = fen.querySelector("#appel-barre span");
    dabAvatar = dab.querySelector("#dab-avatar"); dabGenre = dab.querySelector("#dab-genre"); dabBarre = dab.querySelector("#dab-barre span"); dabReste = dab.querySelector("#dab-reste");
    repTNom = repT.querySelector("#rep-t-nom"); repTTexte = repT.querySelector("#rep-t-texte");
    repT.querySelector("#rep-t-lire").addEventListener("click", function () { repToast = null; rendre(); ouvrirRepondeur(); });
    repT.querySelector("#rep-t-fermer").addEventListener("click", function () { repToast = null; rendre(); restaurerFocus(); });
    etatEl = fen.querySelector("#appel-etat"); nomEl = fen.querySelector("#appel-nom"); telEl = fen.querySelector("#appel-tel"); minEl = fen.querySelector("#appel-minuteur");
    btnPrendre = fen.querySelector("#appel-prendre"); btnRaccrocher = fen.querySelector("#appel-raccrocher"); btnIndispo = fen.querySelector("#appel-indispo"); btnMuet = fen.querySelector("#appel-muet");
    lienFiche = fen.querySelector("#appel-lien"); lienOps = fen.querySelector("#appel-ops"); noteSon = fen.querySelector("#appel-note-son");
    dabEtat = dab.querySelector("#dab-etat-txt"); dabNom = dab.querySelector("#dab-nom"); dabInfo = dab.querySelector("#dab-info"); dabSolde = dab.querySelector("#dab-solde");
    dabAccueillir = dab.querySelector("#dab-accueillir"); dabIgnorer = dab.querySelector("#dab-ignorer"); dabFiche = dab.querySelector("#dab-fiche"); dabCre = dab.querySelector("#dab-cre"); dabOps = dab.querySelector("#dab-ops"); dabFermer = dab.querySelector("#dab-fermer");
    secuCorps = secu.querySelector("#secu-corps"); secuReduire = secu.querySelector("#secu-reduire");
    secuReduire.addEventListener("click", function () { secuReduit = !secuReduit; majSecuReduit(); });
    secuCorps.addEventListener("change", function (e) {
      var t = e.target, k = t && t.getAttribute ? t.getAttribute("data-secu") : null;
      if (!k) return;
      agir(function (s, n) { return A.secuBasculer(s, k, !!t.checked); });
    });
    annonce = doc.createElement("p");
    annonce.id = "appel-annonce"; annonce.className = "sr"; annonce.setAttribute("role", "status"); annonce.setAttribute("aria-live", "polite");
    doc.body.appendChild(annonce);

    btnPrendre.addEventListener("click", function () {
      agir(function (s, n) { return A.decrocher(s, n); });
      var a = st.courant;
      if (a && a.etat === "en_cours" && a.c && ouvrirDossier(a.c)) return;      /* la page change : la nouvelle page reprend l'appel en cours */
      if (!fen.hidden && !btnRaccrocher.hidden) btnRaccrocher.focus();
    });
    btnRaccrocher.addEventListener("click", function () {
      var avant = st.courant ? st.courant.etat : null, nom = st.courant ? st.courant.nom : "", client = !!(st.courant && st.courant.c);
      agir(function (s, n) { return A.raccrocher(s, n, ctx()); });
      fin = { texte: avant === "sonne" ? "Appel refusé" : "Appel terminé", nom: nom, client: client, jusqu: Date.now() + 4000 };
      rendre(); restaurerFocus();
    });
    btnIndispo.addEventListener("click", function () {
      var nom = st.courant ? st.courant.nom : "", client = !!(st.courant && st.courant.c);
      agir(function (s, n) { return A.basculer(s, false, n, ctx()); });
      if (!st.courant) fin = { texte: "Appel refusé : vous êtes indisponible", nom: nom, client: client, jusqu: Date.now() + 4000 };
      rendre(); restaurerFocus();
    });
    btnMuet.addEventListener("click", function () { if (st.courant) muetPour = st.courant.id; majSon(); rendre(); btnRaccrocher.focus(); });
    fen.querySelector("#appel-activer").addEventListener("click", function () { debloquer(); rendre(); });

    dabAccueillir.addEventListener("click", function () {
      var ev = st.dab.courant;
      if (!ev) return;
      agir(function (s, n) { return !!A.dabAccueillir(s, n, ctx()); });
      dabFin = { type: "accueilli", ev: ev };
      rendre(); if (!dab.hidden) dabFiche.focus();
    });
    dabIgnorer.addEventListener("click", function () {
      agir(function (s, n) { return A.dabIgnorer(s, n, ctx()); });
      dabFin = null; rendre(); restaurerFocus();
    });
    dabFermer.addEventListener("click", function () { dabFin = null; rendre(); restaurerFocus(); });
  }
  /* Le conseiller décroche : la fiche du client s'ouvre toute seule (sauf si elle est déjà affichée). Renvoie vrai si la page change. */
  function ouvrirDossier(id) {
    var loc = root.location, m = /(?:^|[?&])id=(\d+)/.exec(loc.search || "");
    if (/client\.html$/.test(loc.pathname) && m && Number(m[1]) === id) return false;
    loc.href = "client.html?id=" + encodeURIComponent(id);
    return true;
  }
  function majSecuReduit() {
    secuCorps.hidden = secuReduit;
    secuReduire.textContent = secuReduit ? "Afficher" : "Réduire";
    secuReduire.setAttribute("aria-expanded", secuReduit ? "false" : "true");
  }
  /* Initiales de l'avatar : « M. Guillaume PASQUIER » donne « GP » ; pour un appelant non client, un point d'interrogation. */
  function initiales(nom) {
    var m = String(nom || "").replace(/^(M\.|Mme|Mlle)\s+/, "").split(/\s+/).filter(Boolean);
    if (!m.length) return "?";
    return (m[0].charAt(0) + (m.length > 1 ? m[m.length - 1].charAt(0) : "")).toUpperCase();
  }
  function pct(reste, total) { return Math.max(0, Math.min(100, Math.round(100 * reste / Math.max(1, total)))); }
  /* La fiche du client en une ligne, pour savoir à qui on parle avant même de décrocher. */
  function metaClient(id) {
    var c = id ? clientDe(id) : null;
    if (!c) return id ? "" : "Numéro hors portefeuille : appelant non client";
    return "Client n° " + c.num + " · " + c.age + " ans" + (c.pro && c.pro.prof ? " · " + c.pro.prof : "");
  }
  function clientDe(id) { var l = root.SGBF.clients; if (!Array.isArray(l)) return null; for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
  function messageSecu(a) {
    var n = A.secuNb(a);
    if (n >= A.SECU_MIN) return { ok: true, texte: "Appelant identifié : " + n + " réponse" + (n > 1 ? "s" : "") + " exacte" + (n > 1 ? "s" : "") + ". Vous pouvez répondre à sa demande." };
    return { ok: false, texte: n + " réponse" + (n > 1 ? "s" : "") + " exacte" + (n > 1 ? "s" : "") + " sur " + A.SECU_MIN + " nécessaires. Tant que l'appelant n'est pas identifié, ne donnez aucune information sur ses comptes." };
  }
  /* « Sécuriser l'appel » : visible quand le conseiller a décroché. Pour un client, les questions et les réponses du dossier ; pour un non-client, un rappel. */
  function rendreSecu() {
    var a = st.courant, actif = !!(a && a.etat === "en_cours");
    if (!actif) { secu.hidden = true; secuPour = null; return; }
    secu.hidden = false;
    if (!a.c) {
      if (secuPour !== "nc-" + a.id) {
        secuPour = "nc-" + a.id; secuReduit = false;
        secuCorps.innerHTML = '<p class="secu-intro">Cet appelant n\'est pas client : aucune information sur un compte ne peut lui être donnée. Présentez les offres, notez ses coordonnées et proposez-lui un rendez-vous à l\'agence.</p>';
      }
      majSecuReduit(); return;
    }
    if (!donneesPretes()) { secuPour = null; secuCorps.innerHTML = '<p class="secu-intro">Chargement du dossier…</p>'; majSecuReduit(); chargerDonnees(rendre); return; }
    var c = clientDe(a.c);
    if (!c) { secuPour = "absent-" + a.id; secuCorps.innerHTML = '<p class="secu-intro">Le dossier de ce client est introuvable : ne donnez aucune information et proposez-lui de venir à l\'agence avec sa pièce d\'identité.</p>'; majSecuReduit(); return; }
    if (secuPour !== "c-" + a.id) {
      secuPour = "c-" + a.id; secuReduit = false;
      var qs = A.questionsSecurite(c, ctx());
      secuCorps.innerHTML = '<p class="secu-intro">Avant de donner la moindre information, vérifiez l\'identité de l\'appelant : posez au moins ' + A.SECU_MIN + ' de ces questions, comparez avec le dossier, puis cochez chaque réponse exacte.</p>' +
        '<p class="secu-etat" id="secu-etat" role="status"></p>' +
        '<ul class="secu-liste">' + qs.map(function (q) {
          return '<li class="secu-item"><p class="secu-q">' + esc(q.q) + '</p><p class="secu-rep">Dans le dossier : <strong>' + esc(q.rep) + '</strong></p>' +
            '<label class="secu-ok" for="secu-' + q.k + '"><input type="checkbox" id="secu-' + q.k + '" data-secu="' + q.k + '"><span>Réponse exacte</span></label></li>';
        }).join("") + '</ul>' +
        '<p class="secu-interdit"><strong>Ne demandez jamais</strong> le code confidentiel, le code reçu par SMS, le cryptogramme, le numéro complet de la carte ni le mot de passe de la banque en ligne.</p>' +
        '<p class="secu-conseil">Si l\'appelant ne répond pas correctement : ne donnez aucune information et proposez-lui de venir à l\'agence avec sa pièce d\'identité.</p>';
      secuEtat = secuCorps.querySelector("#secu-etat");
    }
    Array.prototype.forEach.call(secuCorps.querySelectorAll("[data-secu]"), function (i) { var v = a.secu.indexOf(i.getAttribute("data-secu")) >= 0; if (i.checked !== v) i.checked = v; });
    var m = messageSecu(a);
    if (secuEtat && secuEtat.textContent !== m.texte) secuEtat.textContent = m.texte;
    if (secuEtat) secuEtat.setAttribute("data-ok", m.ok ? "oui" : "non");
    majSecuReduit();
  }
  /* Après avoir raccroché ou fermé une fenêtre, le bouton sur lequel on a cliqué disparaît : le curseur revient là où il était avant. */
  function restaurerFocus() {
    var a = doc.activeElement;
    if ((!a || a === doc.body || (zone && zone.contains(a))) && dernierExterne && doc.contains(dernierExterne) && dernierExterne.focus) { try { dernierExterne.focus(); } catch (e) { /* ignoré */ } }
  }
  /* Une alerte peut arriver pendant qu'une fenêtre modale est ouverte : les fenêtres d'alerte sont alors déplacées dans cette fenêtre modale pour rester utilisables. */
  function placer() {
    var ouvertes = doc.querySelectorAll("dialog[open]"), cible = ouvertes.length ? ouvertes[ouvertes.length - 1] : doc.body;
    if (zone.parentNode !== cible) cible.appendChild(zone);
  }
  function dire(id, mode, texte) {
    if (annonce.getAttribute("data-id") === id) return;
    annonce.setAttribute("data-id", id); annonce.setAttribute("aria-live", mode === "alert" ? "assertive" : "polite"); annonce.setAttribute("role", mode); annonce.textContent = "";
    annonce.textContent = texte;
  }

  function rendreAppel() {
    var a = st.courant;
    if (a) {
      var sonne = a.etat === "sonne";
      fen.hidden = false; fen.setAttribute("data-etat", a.etat);
      etatEl.textContent = sonne ? "Appel entrant" : "En communication";
      nomEl.textContent = a.nom; telEl.textContent = a.tel;
      avatarEl.textContent = initiales(a.c ? a.nom : ""); metaEl.textContent = metaClient(a.c);
      barreEl.parentNode.hidden = !sonne; if (sonne) barreEl.style.width = pct(reg.sonnerie * 1000 - (Date.now() - a.debut), reg.sonnerie * 1000) + "%";
      btnPrendre.hidden = !sonne; btnRaccrocher.hidden = false; btnIndispo.hidden = !sonne;
      minEl.hidden = sonne;
      if (!sonne) minEl.textContent = A.minuteur((Date.now() - (a.decroche || a.debut)) / 1000);
      if (a.c) { lienFiche.hidden = false; lienFiche.href = "client.html?id=" + encodeURIComponent(a.c); lienFiche.textContent = "Ouvrir la fiche client"; }
      else if (!sonne) { lienFiche.hidden = false; lienFiche.href = "prospect.html"; lienFiche.textContent = "Ouvrir une entrée en relation"; }
      else lienFiche.hidden = true;
      /* Le client est en ligne et reconnu : le conseiller peut réaliser l'opération demandée sans passer par son dossier. */
      lienOps.hidden = !(a.c && !sonne); if (a.c) lienOps.href = "operations.html?client=" + encodeURIComponent(a.c);
      var es = sonne ? majSon() : (majSon(), "non");
      btnMuet.hidden = !(sonne && es === "joue");
      noteSon.hidden = !(sonne && es === "bloque");
      if (sonne) dire("sonne-" + a.id, "alert", "Appel entrant : " + a.nom + ", " + a.tel); else dire("en-" + a.id, "status", "Appel décroché : " + a.nom);
      fin = null;
    } else if (fin && Date.now() < fin.jusqu) {
      majSon();
      fen.hidden = false; fen.setAttribute("data-etat", "fin");
      etatEl.textContent = fin.texte; nomEl.textContent = fin.nom; telEl.textContent = ""; metaEl.textContent = ""; avatarEl.textContent = initiales(fin.client ? fin.nom : ""); barreEl.parentNode.hidden = true;
      btnPrendre.hidden = true; btnRaccrocher.hidden = true; btnIndispo.hidden = true; btnMuet.hidden = true; noteSon.hidden = true; lienFiche.hidden = true; lienOps.hidden = true; minEl.hidden = true;
      dire("fin-" + fin.jusqu, "status", fin.texte + (fin.nom ? " : " + fin.nom : ""));
    } else {
      majSon();
      fin = null; fen.hidden = true; fen.removeAttribute("data-etat");
    }
  }

  function liensClient(ev) {
    dabFiche.href = "client.html?id=" + encodeURIComponent(ev.c);
    dabCre.href = "contacts.html?client=" + encodeURIComponent(ev.c);
    dabOps.href = "operations.html?client=" + encodeURIComponent(ev.c);
  }
  function rendreDab() {
    var ev = st.dab.courant;
    if (ev) {
      dabFin = null;
      dab.hidden = false; dab.setAttribute("data-etat", "presente"); dab.setAttribute("data-probleme", ev.probleme ? "oui" : "non");
      dabEtat.textContent = ev.probleme ? "Client en difficulté au distributeur" : "Client au distributeur";
      dabNom.textContent = ev.nom; dabInfo.textContent = ev.detail;
      dabSolde.textContent = ev.solde === null ? "" : "Solde du compte courant : " + A.eurTxt(ev.solde);
      dabGenre.textContent = A.GENRES[ev.genre] || ""; dabGenre.hidden = false;
      var resteMs = Math.max(0, ev.depart - Date.now());
      dabReste.textContent = "Repart dans " + A.minuteur(resteMs / 1000); dabBarre.parentNode.hidden = false; dabBarre.style.width = pct(resteMs, ev.depart - ev.debut) + "%";
      dabAccueillir.hidden = false; dabIgnorer.hidden = false; dabFermer.hidden = true; dabCre.hidden = true;
      liensClient(ev); dabFiche.hidden = false; dabOps.hidden = !(ev.genre === "avalee" || ev.genre === "refus");
      dire("dab-" + ev.id, "status", (ev.probleme ? "Client en difficulté au distributeur : " : "Client au distributeur : ") + ev.nom + ". " + ev.detail);
    } else if (dabFin && dabFin.type === "accueilli") {
      var e = dabFin.ev;
      dab.hidden = false; dab.setAttribute("data-etat", "accueilli"); dab.setAttribute("data-probleme", "non");
      dabEtat.textContent = "Vous accueillez le client";
      dabNom.textContent = e.nom; dabInfo.textContent = e.detail; dabSolde.textContent = "";
      dabGenre.textContent = A.GENRES[e.genre] || ""; dabReste.textContent = ""; dabBarre.parentNode.hidden = true;
      dabAccueillir.hidden = true; dabIgnorer.hidden = true; dabFermer.hidden = false;
      liensClient(e); dabFiche.hidden = false; dabCre.hidden = false; dabOps.hidden = !(e.genre === "avalee" || e.genre === "refus");
    } else if (dabFin && dabFin.type === "parti" && Date.now() < dabFin.jusqu) {
      dab.hidden = false; dab.setAttribute("data-etat", "parti"); dab.setAttribute("data-probleme", "non");
      dabEtat.textContent = "Le client a quitté le distributeur";
      dabNom.textContent = dabFin.nom; dabInfo.textContent = ""; dabSolde.textContent = ""; dabGenre.textContent = ""; dabReste.textContent = ""; dabBarre.parentNode.hidden = true;
      dabAccueillir.hidden = true; dabIgnorer.hidden = true; dabFermer.hidden = true; dabFiche.hidden = true; dabCre.hidden = true; dabOps.hidden = true;
      dire("dab-parti-" + dabFin.jusqu, "status", "Le client a quitté le distributeur : " + dabFin.nom);
    } else {
      if (dabFin && dabFin.type === "parti") dabFin = null;
      dab.hidden = true; dab.removeAttribute("data-etat");
    }
  }

  /* Carte « Nouveau message au répondeur » : quinze secondes après un appel manqué. */
  function rendreRep() {
    var m = null;
    if (repToast && !repOuvert && Date.now() < repToast.jusqu) m = st.rep.messages.filter(function (x) { return x.id === repToast.id; })[0] || null;
    if (!m) { repToast = null; repT.hidden = true; return; }
    repT.hidden = false; repT.setAttribute("data-urgent", m.urgent ? "oui" : "non");
    repTNom.textContent = m.nom + (m.urgent ? " – urgent" : "");
    repTTexte.textContent = "« " + m.texte + " »";
    dire("rep-" + m.id, "status", "Nouveau message au répondeur de " + m.nom + (m.urgent ? ", urgent" : "") + ".");
  }
  function rendre() {
    if (!zone) return;
    st = charger();
    rendreAppel(); rendreSecu(); rendreDab(); rendreRep();
    zone.hidden = fen.hidden && secu.hidden && dab.hidden && repT.hidden;
    placer();
    zone.style.setProperty("--appel-bas", (fen.hidden ? 0 : fen.offsetHeight + 12) + "px");   /* 12 px : écart entre deux fenêtres de la zone (voir .poste-alertes dans appels.css) */
    rendreBarre();
  }

  /* ---------- en-tête : disponibilité, journal, sonnerie, simulations ---------- */
  function creerBarre() {
    var zoneEntete = doc.querySelector(".entete-outils") || doc.querySelector(".entete");
    if (!zoneEntete) return;
    var groupe = doc.createElement("div");
    groupe.className = "appels-barre";
    btnDispo = doc.createElement("button");
    btnDispo.type = "button"; btnDispo.id = "btn-dispo"; btnDispo.className = "btn-texte btn-dispo";
    btnDispo.innerHTML = '<span class="dispo-pt" aria-hidden="true"></span><span class="dispo-txt" id="dispo-txt"></span>';
    btnDispo.addEventListener("click", function () { var voulu = !charger().dispo; agir(function (s, n) { return A.basculer(s, voulu, n, ctx()); }); });
    btnJournal = doc.createElement("button");
    btnJournal.type = "button"; btnJournal.id = "btn-appels"; btnJournal.className = "btn-texte btn-appels";
    btnJournal.addEventListener("click", ouvrirJournal);
    groupe.appendChild(btnDispo); groupe.appendChild(btnJournal);
    if (reg.repondeur) {
      btnRep = doc.createElement("button");
      btnRep.type = "button"; btnRep.id = "btn-repondeur"; btnRep.className = "btn-texte btn-repondeur";
      btnRep.addEventListener("click", ouvrirRepondeur);
      groupe.appendChild(btnRep);
    }
    if (reg.son && reg.volume > 0) {
      btnSon = doc.createElement("button");
      btnSon.type = "button"; btnSon.id = "btn-son"; btnSon.className = "btn-texte btn-son";
      btnSon.addEventListener("click", function () { var voulu = !charger().son; agir(function (s) { return A.basculerSon(s, voulu); }); });
      groupe.appendChild(btnSon);
    }
    var deco = doc.getElementById("btn-deconnexion");
    if (deco && deco.parentNode === zoneEntete) zoneEntete.insertBefore(groupe, deco); else zoneEntete.appendChild(groupe);
  }
  function aRevoir() { return A.resume(st).nonVus + A.dabResume(st).nonVus; }
  function rendreBarre() {
    if (!btnDispo) return;
    var dispo = st.dispo, n = aRevoir();
    btnDispo.setAttribute("data-dispo", dispo ? "oui" : "non");
    btnDispo.querySelector("#dispo-txt").textContent = dispo ? "Disponible" : "Indisponible";
    btnDispo.setAttribute("aria-label", dispo ? "Disponible pour les appels et le distributeur. Activer pour passer indisponible." : "Indisponible : ni appels ni alertes du distributeur. Activer pour redevenir disponible.");
    btnDispo.title = dispo ? "Se mettre en indisponible : les appels et les alertes du distributeur ne s'afficheront plus" : "Redevenir disponible : les appels et les alertes du distributeur s'afficheront de nouveau";
    btnJournal.textContent = "Journal du poste" + (n ? " (" + n + " à revoir)" : "");
    btnJournal.setAttribute("data-manques", String(n));
    if (btnRep) {
      var rr = A.repResume(st);
      btnRep.textContent = "Répondeur" + (rr.nonLus ? " (" + rr.nonLus + " nouveau" + (rr.nonLus > 1 ? "x" : "") + ")" : "");
      btnRep.setAttribute("data-nouveaux", String(rr.nonLus)); btnRep.setAttribute("data-urgents", String(rr.urgents));
      btnRep.title = rr.total ? rr.total + " message" + (rr.total > 1 ? "s" : "") + " au répondeur, " + rr.nonLus + " non lu" + (rr.nonLus > 1 ? "s" : "") + (rr.urgents ? ", " + rr.urgents + " urgent" + (rr.urgents > 1 ? "s" : "") + " à rappeler" : "") : "Aucun message au répondeur";
    }
    if (btnSon) {
      btnSon.innerHTML = st.son ? HP_ON : HP_OFF;
      btnSon.setAttribute("aria-label", st.son ? "Sonnerie des appels activée. Activer pour la couper." : "Sonnerie des appels coupée. Activer pour la remettre.");
      btnSon.title = st.son ? "Couper la sonnerie des appels" : "Remettre la sonnerie des appels";
      btnSon.setAttribute("aria-pressed", st.son ? "true" : "false");
      btnSon.setAttribute("data-son", st.son ? "oui" : "non");
    }
  }

  /* ---------- journal du poste ---------- */
  function tableAppels() {
    var l = st.journal.slice().reverse();
    if (!l.length) return '<p class="appels-vide">Aucun appel reçu pour le moment.</p>';
    return '<div class="appels-tableau"><table class="appels-t-appels"><caption class="sr">Appels reçus, du plus récent au plus ancien</caption><thead><tr><th scope="col">Date et heure</th><th scope="col">Appelant</th><th scope="col">Numéro</th><th scope="col">Résultat</th></tr></thead><tbody>' +
      l.map(function (j) {
        var nom = j.c ? '<a href="client.html?id=' + encodeURIComponent(j.c) + '">' + esc(j.nom) + "</a>" : esc(j.nom);
        if (j.sc) nom += '<span class="appels-sim">Simulation : ' + esc(j.sc) + "</span>";
        var res = j.issue === "pris" ? "Pris, " + A.dureeLib(j.duree) + (j.ident === "oui" ? " – appelant identifié" : j.ident === "non" ? " – appelant non identifié" : "") : A.ISSUES[j.issue];
        return '<tr class="appels-' + j.issue + '"><td>' + esc(j.quand) + "</td><td>" + nom + "</td><td>" + esc(j.tel) + "</td><td>" + esc(res) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }
  function tableDab() {
    var l = st.dab.journal.slice().reverse();
    if (!l.length) return '<p class="appels-vide">Aucun client au distributeur pour le moment.</p>';
    return '<div class="appels-tableau"><table class="appels-t-dab"><caption class="sr">Clients au distributeur, du plus récent au plus ancien</caption><thead><tr><th scope="col">Date et heure</th><th scope="col">Client</th><th scope="col">Au distributeur</th><th scope="col">Suite donnée</th></tr></thead><tbody>' +
      l.map(function (j) {
        var nom = j.c ? '<a href="client.html?id=' + encodeURIComponent(j.c) + '">' + esc(j.nom) + "</a>" : esc(j.nom);
        return '<tr class="dab-' + j.issue + '"><td>' + esc(j.quand) + "</td><td>" + nom + "</td><td>" + esc(j.detail) + "</td><td>" + esc(A.ISSUES_DAB[j.issue]) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }
  function majJournal() {
    var r = A.resume(st), d = A.dabResume(st);
    dlgContenu.innerHTML = '<h2 id="appels-titre">Journal du poste</h2>' +
      '<h3 class="appels-h3">Appels reçus</h3>' +
      '<p class="appels-sous">' + r.total + (r.total > 1 ? " appels" : " appel") + " : " + r.pris + " pris, " + r.refuse + " refusé" + (r.refuse > 1 ? "s" : "") + ", " + r.manque + " manqué" + (r.manque > 1 ? "s" : "") + ".</p>" + tableAppels() +
      '<h3 class="appels-h3">Clients au distributeur</h3>' +
      '<p class="appels-sous">' + d.total + (d.total > 1 ? " clients" : " client") + " : " + d.accueilli + " accueilli" + (d.accueilli > 1 ? "s" : "") + ", " + d.ignore + " ignoré" + (d.ignore > 1 ? "s" : "") + ", " + d.parti + " parti" + (d.parti > 1 ? "s" : "") + " sans être accueilli" + (d.parti > 1 ? "s" : "") + ".</p>" + tableDab() +
      '<p class="appels-note">Les ' + A.MAX_JOURNAL + " derniers appels et les " + A.MAX_JOURNAL + " derniers clients au distributeur sont gardés dans ce navigateur." + (reg.horaires ? " Appels et clients au distributeur n'arrivent qu'aux heures d'ouverture de l'agence (du mardi au vendredi de 9 h à 13 h et de 14 h à 18 h, le samedi de 9 h à 13 h ; rien le dimanche, le lundi ni les jours fériés)" + (ouvert() ? "." : " : l'agence est fermée en ce moment.") : "") + "</p>" +
      '<div class="appels-dlg-act"><button type="button" class="btn-texte" data-vider' + (r.total + d.total ? "" : " disabled") + '>Vider le journal</button><button type="button" class="btn-texte appels-fermer" data-fermer>Fermer</button></div>';
  }
  function ouvrirJournal() {
    st = charger();
    if (!dlg) {
      dlg = doc.createElement("dialog");
      dlg.id = "appels-journal"; dlg.className = "appels-dlg"; dlg.setAttribute("aria-labelledby", "appels-titre");
      dlgContenu = doc.createElement("div"); dlgContenu.className = "appels-contenu"; dlg.appendChild(dlgContenu);
      doc.body.appendChild(dlg);
      dlg.addEventListener("click", function (e) {
        if (e.target.closest && e.target.closest("[data-fermer]")) fermerJournal();
        else if (e.target.closest && e.target.closest("[data-vider]")) { agir(function (s) { s.journal = []; s.vu = s.seq; s.dab.journal = []; s.dab.vu = s.dab.seq; return true; }); }
      });
      dlg.addEventListener("keydown", function (e) { if (e.key === "Escape" && !dlg.showModal) fermerJournal(); });
      dlg.addEventListener("close", function () { journalOuvert = false; rendre(); if (btnJournal) btnJournal.focus(); });
    }
    majJournal();
    journalOuvert = true;
    if (dlg.showModal) { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute("open", "");
    agir(function (s) { s.vu = s.seq; s.dab.vu = s.dab.seq; return true; });
    var f = dlg.querySelector("[data-fermer]"); if (f) f.focus();
  }
  function fermerJournal() { if (dlg.close) dlg.close(); else { dlg.removeAttribute("open"); journalOuvert = false; rendre(); } }


  /* ---------- répondeur IA : les messages des appels manqués ou refusés, retranscrits à l'écrit ---------- */
  function triRep(a, b) {
    if (a.traite !== b.traite) return a.traite ? 1 : -1;
    if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
    return b.id - a.id;
  }
  function messageHtml(m) {
    var nouveau = m.id > repAvant && !m.traite;
    var nom = m.c ? '<a class="rep-nom" href="client.html?id=' + encodeURIComponent(m.c) + '">' + esc(m.nom) + "</a>" : '<span class="rep-nom">' + esc(m.nom) + "</span>";
    var puces = '<span class="rep-puce rep-puce-theme">' + esc(m.lib) + "</span>" +
      (m.urgent ? '<span class="rep-puce rep-puce-urgent">Urgent : à rappeler vite</span>' : "") +
      (nouveau ? '<span class="rep-puce rep-puce-nouveau">Nouveau</span>' : "") +
      (m.traite ? '<span class="rep-puce rep-puce-traite">Traité</span>' : "");
    return '<li class="rep-msg" data-id="' + m.id + '" data-urgent="' + (m.urgent ? "oui" : "non") + '" data-nouveau="' + (nouveau ? "oui" : "non") + '" data-traite="' + (m.traite ? "oui" : "non") + '">' +
      '<span class="rep-av" aria-hidden="true">' + esc(initiales(m.c ? m.nom : "")) + "</span>" +
      '<div class="rep-corps">' +
      '<p class="rep-ent">' + nom + '<span class="rep-tel">' + esc(m.tel) + "</span></p>" +
      '<p class="rep-meta"><span>' + esc(m.quand) + "</span><span>" + esc(A.CAUSES[m.cause]) + "</span><span>Message de " + esc(A.dureeLib(m.duree)) + "</span></p>" +
      '<p class="rep-puces">' + puces + "</p>" +
      '<blockquote class="rep-texte"><p>' + esc(m.texte) + "</p></blockquote>" +
      '<p class="rep-act">' +
      (m.c ? '<a class="btn-texte" href="client.html?id=' + encodeURIComponent(m.c) + '">Ouvrir la fiche</a>' : '<a class="btn-texte" href="prospect.html">Ouvrir une entrée en relation</a>') +
      '<button type="button" class="btn-texte" data-rep-act="traiter" data-id="' + m.id + '">' + (m.traite ? "Remettre à traiter" : "Marquer comme traité") + "</button>" +
      '<button type="button" class="btn-texte rep-suppr" data-rep-act="supprimer" data-id="' + m.id + '" aria-label="Supprimer le message de ' + esc(m.nom) + '">Supprimer</button></p>' +
      "</div></li>";
  }
  function majRepondeur(focus) {
    var r = A.repResume(st), l = st.rep.messages.slice().sort(triRep);
    r.nonLus = l.filter(function (m) { return m.id > repAvant && !m.traite; }).length;      /* « nouveaux » : ceux qu'on n'avait pas lus avant d'ouvrir le répondeur */
    var fa = doc.activeElement, cle = null;
    if (!focus && fa && repContenu.contains(fa)) cle = fa.getAttribute("data-rep-act") ? '[data-rep-act="' + fa.getAttribute("data-rep-act") + '"][data-id="' + fa.getAttribute("data-id") + '"]' : (fa.id ? "#" + fa.id : null);
    repContenu.innerHTML = '<h2 id="rep-titre" tabindex="-1">Répondeur</h2>' +
      '<p class="rep-sous">' + (r.total ? r.total + " message" + (r.total > 1 ? "s" : "") + " : " + r.nonLus + " nouveau" + (r.nonLus > 1 ? "x" : "") + ", " + r.urgents + " urgent" + (r.urgents > 1 ? "s" : "") + " à rappeler, " + r.traites + " traité" + (r.traites > 1 ? "s" : "") + "." : "Aucun message pour le moment.") + "</p>" +
      '<p class="rep-mention">Quand vous ne décrochez pas, ou que vous refusez un appel, le répondeur IA invite l\'appelant à laisser un message et le retranscrit ici à l\'écrit. Transcription automatique : elle peut comporter des erreurs, vérifiez en rappelant le client. Les messages les plus urgents (fraude, carte perdue) sont en haut.</p>' +
      (l.length ? '<ul class="rep-liste" aria-label="Messages du répondeur, du plus urgent au plus ancien">' + l.map(messageHtml).join("") + "</ul>" : '<p class="appels-vide">Quand un client laissera un message, il apparaîtra ici.</p>') +
      '<div class="appels-dlg-act"><button type="button" class="btn-texte" data-rep-purger' + (r.traites ? "" : " disabled") + '>Supprimer les messages traités</button><button type="button" class="btn-texte appels-fermer" data-fermer id="rep-fermer">Fermer</button></div>';
    if (focus) { var f = repContenu.querySelector(focus) || repContenu.querySelector("#rep-titre"); if (f) f.focus(); }
    else if (cle) { var g = repContenu.querySelector(cle); if (g && g !== doc.activeElement) g.focus(); }
  }
  function ouvrirRepondeur() {
    st = charger();
    if (!repDlg) {
      repDlg = doc.createElement("dialog");
      repDlg.id = "repondeur-dlg"; repDlg.className = "appels-dlg rep-dlg"; repDlg.setAttribute("aria-labelledby", "rep-titre");
      repContenu = doc.createElement("div"); repContenu.className = "appels-contenu"; repDlg.appendChild(repContenu);
      doc.body.appendChild(repDlg);
      repDlg.addEventListener("click", function (e) {
        var t = e.target.closest ? e.target.closest("[data-fermer],[data-rep-act],[data-rep-purger]") : null;
        if (!t) return;
        if (t.hasAttribute("data-fermer")) { fermerRepondeur(); return; }
        if (t.hasAttribute("data-rep-purger")) {
          agir(function (s) { var n = s.rep.messages.length; s.rep.messages = s.rep.messages.filter(function (m) { return !m.traite; }); return s.rep.messages.length < n; });
          dire("rep-purge-" + Date.now(), "status", "Messages traités supprimés."); majRepondeur("#rep-titre"); return;
        }
        var id = parseInt(t.getAttribute("data-id"), 10), act = t.getAttribute("data-rep-act"), m = st.rep.messages.filter(function (x) { return x.id === id; })[0];
        if (!m) return;
        var nom = m.nom, etait = m.traite;
        if (act === "traiter") {
          agir(function (s) { return A.repTraiter(s, id, !etait); });
          dire("rep-act-" + Date.now(), "status", etait ? "Message de " + nom + " remis à traiter." : "Message de " + nom + " marqué comme traité.");
          majRepondeur('[data-rep-act="traiter"][data-id="' + id + '"]');
        } else {
          agir(function (s) { return A.repSupprimer(s, id); });
          dire("rep-act-" + Date.now(), "status", "Message de " + nom + " supprimé.");
          majRepondeur("#rep-titre");
        }
      });
      repDlg.addEventListener("keydown", function (e) { if (e.key === "Escape" && !repDlg.showModal) fermerRepondeur(); });
      repDlg.addEventListener("close", function () { repOuvert = false; repAvant = 0; rendre(); if (btnRep) btnRep.focus(); });
    }
    repAvant = st.rep.vu; repToast = null;
    repOuvert = true;
    majRepondeur("#rep-titre");
    if (repDlg.showModal) { if (!repDlg.open) repDlg.showModal(); } else repDlg.setAttribute("open", "");
    agir(function (s) { return A.repLire(s); });
    var f = repContenu.querySelector("#rep-titre"); if (f) f.focus();
  }
  function fermerRepondeur() { if (repDlg.close) repDlg.close(); else { repDlg.removeAttribute("open"); repOuvert = false; repAvant = 0; rendre(); } }

  /* ---------- actions et horloge ---------- */
  function agir(f) {
    var s = charger(), n = Date.now();
    if (f(s, n)) sauver(s);
    st = s;
    rendre();
    if (journalOuvert && dlg) majJournal();
    if (repOuvert && repDlg && repContenu) majRepondeur();
  }
  function tic() {
    var s = charger(), n = Date.now(), c = ctx(), seqAvant = s.rep.seq, r = A.avancer(s, n, c), d = A.dabAvancer(s, n, c);
    if (r.evt === "clients" || d.evt === "clients") { chargerDonnees(tic); return; }
    if (repOuvert && A.repLire(s)) r.changed = true;      /* le répondeur est ouvert : le message qui arrive est lu aussitôt */
    if (r.changed || d.changed) sauver(s);
    st = s;
    if (r.evt === "manque") {
      var dm = s.rep.seq > seqAvant ? s.rep.messages[s.rep.messages.length - 1] : null;      /* le message que le répondeur vient de prendre, s'il y en a un */
      fin = { texte: "Appel manqué", nom: dm ? dm.nom : "", client: !!(dm && dm.c), jusqu: Date.now() + 4000 };
      if (dm && dm.cause === "manque") repToast = { id: dm.id, jusqu: Date.now() + 15000 };
    }
    if (d.evt === "parti") { var j = s.dab.journal[s.dab.journal.length - 1]; dabFin = { type: "parti", nom: j ? j.nom : "", jusqu: Date.now() + 6000 }; }
    rendre();
    if (journalOuvert && dlg && (r.changed || d.changed)) majJournal();
    if (repOuvert && repDlg && repContenu && r.changed) majRepondeur();
  }

  /* ---------- chargement à la demande : liste des clients, calcul des soldes, scénarios ---------- */
  var chargement = false, attente = [];
  function urlJs(nom) {
    var scripts = doc.getElementsByTagName("script");
    for (var i = 0; i < scripts.length; i++) { var m = /^(.*)app_appels\.js(\?.*)?$/.exec(scripts[i].getAttribute("src") || ""); if (m) return m[1] + nom; }
    return "js/" + nom;
  }
  function chargerScript(nom, apres) {
    var sc = doc.createElement("script");
    sc.src = urlJs(nom);
    sc.onload = function () { apres(true); };
    sc.onerror = function () { apres(false); };
    doc.head.appendChild(sc);
  }
  var mouvementsTentes = false;   /* si mouvements.js ne se charge pas, on n'insiste pas : le client du distributeur se contente alors de consulter son solde */
  function donneesPretes() { return Array.isArray(root.SGBF.clients) && (!!root.SGBF.mouvements || mouvementsTentes); }
  function chargerDonnees(apres) {
    if (apres && attente.indexOf(apres) < 0) attente.push(apres);
    if (chargement) return;
    var fini = function () { chargement = false; var l = attente.slice(); attente = []; l.forEach(function (f) { f(); }); };
    if (donneesPretes()) { fini(); return; }
    chargement = true;
    var etape2 = function () { if (root.SGBF.mouvements) fini(); else chargerScript("mouvements.js", function () { mouvementsTentes = true; fini(); }); };   /* sans le calcul des soldes, le client ne fait rien qui en dépende */
    if (Array.isArray(root.SGBF.clients)) etape2(); else chargerScript("data_clients.js", function (ok) { if (!ok) root.SGBF.clients = []; etape2(); });
  }
  /* Fenêtre « Simulations d'appels » : pas de bouton dans l'en-tête, pour que les élèves ne la rencontrent pas ; l'enseignant l'ouvre en tapant « simulation » dans la recherche (recherche.js).
     Les scénarios et leur écran ne sont chargés qu'à la première ouverture. */
  function ouvrirSimulations() {
    var ouvrir = function () { if (root.SGBF.simulations) root.SGBF.simulations.ouvrir(); };
    chargerDonnees(function () {
      if (root.SGBF.scenarios && root.SGBF.simulations) { ouvrir(); return; }
      chargerScript("scenarios_appels.js", function (ok1) {
        if (!ok1) return;
        chargerScript("app_scenarios.js", function (ok2) { if (ok2) ouvrir(); });
      });
    });
  }

  /* Pour l'enseignant (écran « Simulations d'appels ») et pour les essais. */
  root.SGBF.alertes = { ctx: ctx, agir: agir, etat: function () { return charger(); }, chargerDonnees: chargerDonnees, esc: esc, restaurerFocus: restaurerFocus, simulations: ouvrirSimulations, repondeur: ouvrirRepondeur, bouton: function () { return doc.getElementById("rech"); } };   /* bouton() : l'élément qui retrouve le focus à la fermeture de l'écran des simulations (le champ de recherche) */
  A.declencher = function (idClient) {
    chargerDonnees(function () { agir(function (s, n) { return A.sonner(s, n, ctx(), idClient).changed; }); });
  };
  A.declencherDab = function (idClient, genre) {
    chargerDonnees(function () { agir(function (s, n) { return A.dabArriver(s, n, ctx(), idClient, genre).changed; }); });
  };
  A.etatSon = etatSon;

  function demarrer() {
    creerFenetres(); creerBarre();
    doc.addEventListener("focusin", function (e) { if (zone && !zone.contains(e.target) && !(dlg && dlg.contains(e.target)) && !(repDlg && repDlg.contains(e.target))) dernierExterne = e.target; });
    ["pointerdown", "keydown", "touchstart"].forEach(function (ev) { doc.addEventListener(ev, function () { var c = contexte(); if (c && c.state !== "running") debloquer(); }, true); });
    root.addEventListener("storage", function (e) { if (e.key === A.CLE) rendre(); });
    root.addEventListener("pageshow", function () { rendre(); });
    rendre();
    root.setInterval(tic, 1000);
    tic();
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", demarrer); else demarrer();
})(window);
