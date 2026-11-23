/* GS Banque & Assurance – accès au site : vérification de l'identifiant et du mot de passe, ouverture et fermeture de la session.
   L'identifiant et le mot de passe ne figurent nulle part en clair : js/identifiants.js ne contient que leur empreinte
   (SHA-256 répété, avec un « sel »). ATTENTION : ce contrôle se fait dans le navigateur ; il filtre l'accès pour la classe
   mais ce n'est pas une protection informatique réelle (toute personne qui lit le code du site peut le contourner). */
(function (root) {
  "use strict";
  root.SGBF = root.SGBF || {};

  /* ---------- SHA-256 (norme FIPS 180-4), sans dépendance : fonctionne aussi hors connexion et depuis un fichier local ---------- */
  var K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);
  var W = new Uint32Array(64);

  function sha256(data) {
    var l = data.length, n = ((l + 9 + 63) >> 6) << 6;
    var m = new Uint8Array(n);
    m.set(data); m[l] = 0x80;
    var dv = new DataView(m.buffer);
    dv.setUint32(n - 8, Math.floor(l / 0x20000000)); dv.setUint32(n - 4, (l << 3) >>> 0);
    var h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a, h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    for (var o = 0; o < n; o += 64) {
      var i, a, b;
      for (i = 0; i < 16; i++) W[i] = dv.getUint32(o + i * 4);
      for (i = 16; i < 64; i++) {
        a = W[i - 15]; b = W[i - 2];
        W[i] = (W[i - 16] + (((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3)) + W[i - 7] + (((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10))) | 0;
      }
      var A = h0, B = h1, C = h2, D = h3, E = h4, F = h5, G = h6, H = h7;
      for (i = 0; i < 64; i++) {
        var t1 = (H + (((E >>> 6) | (E << 26)) ^ ((E >>> 11) | (E << 21)) ^ ((E >>> 25) | (E << 7))) + ((E & F) ^ (~E & G)) + K[i] + W[i]) | 0;
        var t2 = ((((A >>> 2) | (A << 30)) ^ ((A >>> 13) | (A << 19)) ^ ((A >>> 22) | (A << 10))) + ((A & B) ^ (A & C) ^ (B & C))) | 0;
        H = G; G = F; F = E; E = (D + t1) | 0; D = C; C = B; B = A; A = (t1 + t2) | 0;
      }
      h0 = (h0 + A) | 0; h1 = (h1 + B) | 0; h2 = (h2 + C) | 0; h3 = (h3 + D) | 0; h4 = (h4 + E) | 0; h5 = (h5 + F) | 0; h6 = (h6 + G) | 0; h7 = (h7 + H) | 0;
    }
    var out = new Uint8Array(32), ov = new DataView(out.buffer);
    [h0, h1, h2, h3, h4, h5, h6, h7].forEach(function (x, k) { ov.setUint32(k * 4, x >>> 0); });
    return out;
  }

  function octets(s) {
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(s);
    var u = unescape(encodeURIComponent(s)), r = new Uint8Array(u.length);
    for (var i = 0; i < u.length; i++) r[i] = u.charCodeAt(i);
    return r;
  }
  function hex(b) { var s = ""; for (var i = 0; i < b.length; i++) s += (b[i] < 16 ? "0" : "") + b[i].toString(16); return s; }
  function sha256Hex(texte) { return hex(sha256(octets(texte))); }

  /* ---------- empreinte de l'identifiant et du mot de passe ---------- */
  /* Identifiant : espaces autour ignorés et majuscules/minuscules indifférentes (les téléphones mettent souvent une majuscule). Mot de passe : exact. */
  function normId(s) { s = String(s == null ? "" : s); if (s.normalize) s = s.normalize("NFC"); return s.trim().toLowerCase(); }
  function empreinte(identifiant, mdp, sel, tours) {
    var msg = octets(String(sel) + "\u0000" + normId(identifiant) + "\u0000" + String(mdp == null ? "" : mdp));
    var h = sha256(msg), buf = new Uint8Array(32 + msg.length);
    buf.set(msg, 32);
    for (var i = 0; i < tours; i++) { buf.set(h, 0); h = sha256(buf); }
    return hex(h);
  }
  function memeTexte(a, b) {
    if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
    var d = 0; for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return d === 0;
  }
  function config() { return root.SGBF.identifiants || null; }
  function verifier(identifiant, mdp) {
    var c = config();
    if (!c) return false;
    return memeTexte(empreinte(identifiant, mdp, c.sel, c.tours), c.empreinte);
  }

  /* Texte complet du fichier js/identifiants.js pour un nouvel identifiant et un nouveau mot de passe (outil interne, sans usage pour les élèves). */
  function creerFichier(identifiant, mdp, sel, tours) {
    tours = tours || 60000;
    return "/* GS Banque & Assurance – accès au site. Ce fichier ne contient ni l'identifiant ni le mot de passe en clair : seulement leur empreinte.\n" +
      "   Ne pas modifier ce fichier à la main. */\n" +
      "(function (root) {\n  \"use strict\";\n  root.SGBF = root.SGBF || {};\n" +
      "  root.SGBF.identifiants = { sel: \"" + sel + "\", tours: " + tours + ", empreinte: \"" + empreinte(identifiant, mdp, sel, tours) + "\" };\n" +
      "  if (typeof module !== \"undefined\" && module.exports) module.exports = root.SGBF.identifiants;\n" +
      "})(typeof window !== \"undefined\" ? window : globalThis);\n";
  }

  /* ---------- session : valable pour l'onglet en cours, effacée à sa fermeture ---------- */
  var CLE = "sgbf.acces", PREFIXE_NOM = "sgbf-acces:";
  function jeton() { var c = config(); return c ? sha256Hex("sgbf-session|" + c.empreinte).slice(0, 32) : null; }
  function lire() {
    var t = jeton();
    if (!t) return false;
    try { if (root.sessionStorage && root.sessionStorage.getItem(CLE) === t) return true; } catch (e) { /* stockage indisponible */ }
    /* Secours : certains navigateurs ne partagent pas le stockage entre deux fichiers ouverts en local ; le nom de l'onglet, lui, est conservé. */
    try { if (typeof root.name === "string" && root.name === PREFIXE_NOM + t) { try { root.sessionStorage.setItem(CLE, t); } catch (e) { /* ignoré */ } return true; } } catch (e) { /* ignoré */ }
    return false;
  }
  function ouvrirSession() {
    var t = jeton();
    if (!t) return false;
    try { root.sessionStorage.setItem(CLE, t); } catch (e) { /* ignoré : le nom de l'onglet prend le relais */ }
    try { root.name = PREFIXE_NOM + t; } catch (e) { /* ignoré */ }
    return lire();
  }
  function fermerSession() {
    try { root.sessionStorage.removeItem(CLE); } catch (e) { /* ignoré */ }
    try { root.sessionStorage.removeItem("sgbf.eleve"); } catch (e) { /* ignoré : le nom est alors redemandé à la fermeture de l'onglet (voir identite.js) */ }
    try { root.sessionStorage.removeItem("sgbf.slogan"); } catch (e) { /* ignoré : le slogan de la connexion se renouvelle à la prochaine connexion (voir slogans.js) */ }
    try { if (typeof root.name === "string" && root.name.indexOf(PREFIXE_NOM) === 0) root.name = ""; } catch (e) { /* ignoré */ }
  }

  /* ---------- page à rouvrir après la connexion : uniquement une page du site, jamais une adresse extérieure ---------- */
  var PAGES = ["index.html", "client.html", "analyse.html", "debiteurs.html", "atypiques.html", "portefeuille.html", "catalogue.html", "agenda.html", "messagerie.html", "campagnes.html", "phoning.html", "contacts.html", "bilan.html", "simulateur.html", "epargne.html", "pret.html", "montage.html", "carte.html", "equipe.html", "mifid.html", "prospect.html", "incidents.html", "o2pc.html", "reclamation.html", "operations.html", "courriers.html", "interro_bdf.html", "regularisation_fcc.html", "satd.html", "suivi_credit.html", "avis_en_ligne.html", "tableau_bord.html", "messages_suspects.html", "ordres_bourse.html"];
  function retourSur(brut) {
    var m = /^([A-Za-z0-9_]+\.html)((?:\?[A-Za-z0-9_=&.\-]*)?(?:#[A-Za-z0-9_\-]*)?)$/.exec(String(brut == null ? "" : brut));
    return m && PAGES.indexOf(m[1]) >= 0 ? m[1] + m[2] : "index.html";
  }

  var api = { sha256: sha256, sha256Hex: sha256Hex, octets: octets, hex: hex, normId: normId, empreinte: empreinte, verifier: verifier, creerFichier: creerFichier,
    sessionValide: lire, ouvrirSession: ouvrirSession, fermerSession: fermerSession, jeton: jeton, retourSur: retourSur, PAGES: PAGES, CLE: CLE, PREFIXE_NOM: PREFIXE_NOM };
  root.SGBF.acces = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
