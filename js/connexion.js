/* GS Banque & Assurance – page de connexion : formulaire, messages, ouverture de la session, et décor (Paris au coucher du soleil, dont les fenêtres s'allument). */
(function (root) {
  "use strict";
  var doc = root.document, A = root.SGBF && root.SGBF.acces;
  function $(id) { return doc.getElementById(id); }
  var scene = $("scene"), form = $("form-connexion"), champId = $("identifiant"), champMdp = $("mdp"), btn = $("valider"), erreur = $("erreur"), info = $("info"), maj = $("maj"), voir = $("voir"), ok = $("ok");
  var params = new URLSearchParams(root.location.search);
  var retour = A ? A.retourSur(params.get("retour")) : "index.html";
  var reduit = !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);

  /* ---------- décor : Paris au coucher du soleil ----------
     Les monuments (tour Eiffel, Invalides, Notre-Dame, Sacré-Cœur, Montparnasse) sont dessinés dans connexion.html ; ici on fabrique les toits parisiens
     devant eux, en trois plans (loin, milieu, avant) : immeubles haussmanniens à comble mansardé en zinc, cheminées, balcons filants, lucarnes et fenêtres
     dont certaines s'allument au chargement. Le résultat est toujours le même (graine fixe). Il est aussi écrit tel quel dans connexion.html, pour que la ville s'affiche même si ce script ne s'exécute pas ; le tracé ci-dessous ne sert alors que de secours. */
  function graine(s) { return function () { s = (s + 0x6d2b79f5) | 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  /* ---------- photo de fond facultative ----------
     js/fond.js contient le chemin d'une photo copiée dans le dossier assets (vide par défaut : on garde le dessin de Paris). Seuls les chemins relatifs d'images sont acceptés
     (ni adresse internet, ni « .. »). La photo ne remplace le dessin qu'une fois chargée : si elle est introuvable, le dessin reste. */
  function fondPhoto() {
    var f = root.SGBF_FOND_CONNEXION;
    if (typeof f !== "string") return;
    var chemin = f.trim();
    if (!/^(?!\/)(?!.*\.\.)[\w\-. \/]+\.(jpe?g|png|webp)$/i.test(chemin)) return;
    var img = new root.Image();
    img.onload = function () { scene.style.setProperty("--photo-fond", 'url("' + encodeURI(chemin) + '")'); scene.classList.add("avec-photo"); };
    img.src = chemin;
  }
  var RIM = "rgba(255,186,130,.5)";
  function ville() {
    var rnd = graine(7531);
    function entre(a, b) { return a + rnd() * (b - a); }
    function arrondi(n) { return Math.round(n * 10) / 10; }
    function cheminees(g, x, w, yToit, n, fond, brique) {
      var h = "";
      for (var k = 0; k < n; k++) {
        var cx = Math.round(x + 10 + rnd() * Math.max(4, w - 36)), ch = Math.round(entre(15, 30)), lg = brique ? 11 : 9;
        h += '<rect x="' + cx + '" y="' + (yToit - ch) + '" width="' + lg + '" height="' + ch + '" fill="' + fond + '"/>';
        if (brique) h += '<rect x="' + (cx - 1.5) + '" y="' + (yToit - ch - 2.5) + '" width="' + (lg + 3) + '" height="3" fill="' + fond + '"/><rect x="' + (cx - 1.5) + '" y="' + (yToit - ch - 2.5) + '" width="' + (lg + 3) + '" height="1" fill="' + RIM + '"/>' +
          '<rect x="' + (cx + 1.5) + '" y="' + (yToit - ch - 7) + '" width="2.6" height="5" fill="' + fond + '"/><rect x="' + (cx + 6.5) + '" y="' + (yToit - ch - 7) + '" width="2.6" height="5" fill="' + fond + '"/>';
      }
      return h;
    }
    function fenetre(fx, fy, lit, grand) {
      /* grand : fenêtre de façade (9 × 15) ; sinon lucarne (7 × 9) */
      var lw = grand ? 9 : 7, lh = grand ? 15 : 9;
      if (!lit) return '<rect x="' + fx + '" y="' + fy + '" width="' + lw + '" height="' + lh + '" fill="#1b3652" fill-opacity=".92"/>';
      var d = (rnd() * 2.6).toFixed(2), froid = rnd() < 0.18, cl = froid ? " fen-froid" : "";
      return '<rect class="fen halo' + cl + '" x="' + (fx - 3) + '" y="' + (fy - 3) + '" width="' + (lw + 6) + '" height="' + (lh + 6) + '" rx="4" style="animation-delay:' + d + 's"/>' +
        '<rect class="fen' + cl + '" x="' + fx + '" y="' + fy + '" width="' + lw + '" height="' + lh + '" rx="1" style="animation-delay:' + d + 's"/>';
    }
    /* o : plan, sol (y du bas), larg et haut (fourchettes), toit (hauteur du comble), facades (couleurs), zinc, lit (part de fenêtres allumées), detail (fenêtres et balcons dessinés), motif (fenêtres en motif) */
    function plan(id, o) {
      var g = $(id); if (!g || g.firstChild) return; /* les toits sont déjà écrits dans connexion.html : ce tracé ne sert que de secours */
      var x = -30 - Math.floor(rnd() * 40), h = "";
      while (x < 1640) {
        var w = Math.round(entre(o.larg[0], o.larg[1])), hb = Math.round(entre(o.haut[0], o.haut[1])), top = o.sol - hb, fac = o.facades[Math.floor(rnd() * o.facades.length)];
        var base = o.sol + (o.sol < 560 ? 12 : 1);
        h += '<rect x="' + x + '" y="' + top + '" width="' + w + '" height="' + (base - top) + '" fill="' + fac + '"/>';
        if (o.motif) h += '<rect x="' + x + '" y="' + (top + 8) + '" width="' + w + '" height="' + (base - top - 8) + '" fill="url(#v-fenetres)"/>';
        /* comble mansardé en zinc */
        var rt = top - o.toit;
        h += '<polygon points="' + (x - 3) + "," + top + " " + (x + w + 3) + "," + top + " " + (x + w - 11) + "," + rt + " " + (x + 11) + "," + rt + '" fill="' + o.zinc + '"' + (o.rim ? ' stroke="' + RIM + '" stroke-width=".9" stroke-linejoin="round"' : "") + "/>";
        h += cheminees(g, x, w, rt + 1, o.nbch ? 1 + Math.floor(rnd() * o.nbch) : 1, o.zinc, o.rim);
        if (o.detail) {
          /* lucarnes sur le comble */
          var nl = Math.max(1, Math.floor((w - 24) / 27)), pl = (w - 24) / nl;
          for (var l = 0; l < nl; l++) {
            var lx = Math.round(x + 12 + l * pl + (pl - 7) / 2), ly = rt + 7;
            h += '<polygon points="' + (lx - 1.5) + "," + ly + " " + (lx + 3.5) + "," + (ly - 5) + " " + (lx + 8.5) + "," + ly + '" fill="' + o.zinc + '"/>' + fenetre(lx, ly, rnd() < o.lit * 1.4, false);
          }
          /* étages : balcons filants au 5e et au 2e étage, fenêtres en colonnes régulières */
          var cols = Math.max(2, Math.floor((w - 12) / 21)), pas = (w - 12) / cols;
          for (var r = 0; top + 11 + r * 27 < o.sol - 12; r++) {
            var fy = top + 11 + r * 27;
            h += '<rect x="' + x + '" y="' + (fy - 6) + '" width="' + w + '" height=".9" fill="#fff" fill-opacity=".06"/>';
            for (var j = 0; j < cols; j++) h += fenetre(Math.round(x + 6 + j * pas + (pas - 9) / 2), fy, rnd() < o.lit, true);
            if (r === 0 || r === 3) h += '<rect x="' + (x + 1) + '" y="' + (fy + 16.5) + '" width="' + (w - 2) + '" height="2.4" fill="#06121f" fill-opacity=".55"/><rect x="' + (x + 1) + '" y="' + (fy + 12.5) + '" width="' + (w - 2) + '" height=".8" fill="#06121f" fill-opacity=".5"/>';
          }
        } else if (o.lit) {
          /* quelques lucarnes éclairées sur les toits du plan intermédiaire */
          var nm = Math.max(1, Math.floor((w - 24) / 24));
          for (var m = 0; m < nm; m++) if (rnd() < o.lit) { var mx = Math.round(x + 14 + m * ((w - 28) / nm)); h += '<rect class="fen" x="' + mx + '" y="' + (rt + 8) + '" width="4" height="6" rx=".6" style="animation-delay:' + (rnd() * 2.6).toFixed(2) + 's"/>'; }
        }
        x += w + Math.round(rnd() * 4);
      }
      g.innerHTML = h;
    }
    plan("rue-loin", { sol: 492, larg: [40, 74], haut: [30, 56], toit: 20, facades: ["url(#v-loin)"], zinc: "url(#v-loin)", nbch: 2 });
    plan("rue-milieu", { sol: 560, larg: [62, 104], haut: [88, 128], toit: 26, facades: ["#2b4568", "#30496d", "#27405f"], zinc: "#213a58", lit: 0.2, motif: true, rim: true, nbch: 3 });
    plan("rue-avant", { sol: 560, larg: [100, 154], haut: [62, 112], toit: 30, facades: ["#10243a", "#0d1f33", "#12283f"], zinc: "#14283f", lit: 0.24, detail: true, rim: true, nbch: 2 });
  }

  /* ---------- messages ---------- */
  function montrer(el, texte) { el.textContent = texte; el.hidden = false; }
  function cacher(el) { el.hidden = true; el.textContent = ""; }
  function marquerInvalide() { var champs = Array.prototype.slice.call(arguments); [champId, champMdp].forEach(function (c) { if (champs.indexOf(c) >= 0) c.setAttribute("aria-invalid", "true"); else c.removeAttribute("aria-invalid"); }); }

  /* ---------- connexion ---------- */
  var occupe = false;
  function tenter(e) {
    e.preventDefault();
    if (occupe) return;
    var id = champId.value, mdp = champMdp.value;
    cacher(info);
    if (!id.trim() && !mdp) { montrer(erreur, "Saisissez votre identifiant et votre mot de passe."); marquerInvalide(champId, champMdp); champId.focus(); return; }
    if (!id.trim()) { montrer(erreur, "Saisissez votre identifiant."); marquerInvalide(champId); champId.focus(); return; }
    if (!mdp) { montrer(erreur, "Saisissez votre mot de passe."); marquerInvalide(champMdp); champMdp.focus(); return; }
    cacher(erreur); marquerInvalide();
    occupe = true; btn.disabled = true; btn.textContent = "Vérification…"; form.setAttribute("aria-busy", "true");
    /* Le calcul de l'empreinte prend une fraction de seconde : on laisse d'abord le bouton se mettre à jour. */
    root.setTimeout(function () {
      var bon = false;
      try { bon = A.verifier(id, mdp); } catch (err) { bon = false; }
      form.removeAttribute("aria-busy");
      if (bon && A.ouvrirSession()) {
        champMdp.value = "";
        form.hidden = true; cacher(info); cacher(erreur); var intro = doc.querySelector(".intro"); if (intro) intro.hidden = true; ok.hidden = false;
        scene.classList.add("jour");
        root.setTimeout(function () { root.location.replace(retour); }, reduit ? 250 : 1100);
      } else {
        occupe = false; btn.disabled = false; btn.textContent = "Se connecter";
        champMdp.value = "";
        montrer(erreur, "Identifiant ou mot de passe incorrect. Vérifiez les deux champs ou demandez-les à votre enseignant.");
        marquerInvalide(champId, champMdp); champMdp.focus();
      }
    }, 40);
  }

  function init() {
    if (!A || !root.SGBF.identifiants) { montrer(erreur, "Les fichiers d'accès du site sont introuvables (js/identifiants.js et js/acces.js). Rechargez la page ou prévenez votre enseignant."); btn.disabled = true; return; }
    /* Déjà connecté dans cet onglet : on rouvre directement le site. */
    if (A.sessionValide()) { root.location.replace(retour); return; }
    ville();
    fondPhoto();
    if (params.get("deconnecte") === "1") montrer(info, "Vous êtes déconnecté. À bientôt !");
    form.addEventListener("submit", tenter);
    [champId, champMdp].forEach(function (c) { c.addEventListener("input", function () { if (!erreur.hidden) { cacher(erreur); marquerInvalide(); } }); });
    voir.addEventListener("click", function () {
      var visible = champMdp.type === "password";
      champMdp.type = visible ? "text" : "password";
      voir.textContent = visible ? "Masquer" : "Afficher";
      voir.setAttribute("aria-pressed", String(visible));
      champMdp.focus();
    });
    function majuscules(e) { if (e.getModifierState) maj.hidden = !e.getModifierState("CapsLock"); }
    champMdp.addEventListener("keydown", majuscules); champMdp.addEventListener("keyup", majuscules);
    champMdp.addEventListener("blur", function () { maj.hidden = true; });
  }
  init();
})(window);
