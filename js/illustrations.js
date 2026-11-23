/* GS Banque & Assurance – illustrations des produits du catalogue : dessins originaux (formes simples en SVG), sans photo ni image extérieure.
   Chaque dessin est décoratif : le nom du produit est écrit à côté. Aucun identifiant interne (id) n'est utilisé, pour pouvoir afficher plusieurs fois le même dessin. */
(function (root) {
  "use strict";

  var NAVY = "#1b3a57", BLUE = "#29a3db", GOLD = "#e3a82b", GREEN = "#3d9a6b", CORAL = "#e0604f", WHITE = "#ffffff", INK = "#14202b", GREY = "#b9c6d2", SOFT = "#e4f3fb";
  var FOND = {
    compte: ["#e4f3fb", "#c6e5f5"], carte: ["#e1e8f0", "#c3d1e0"], epargne: ["#e3f3e9", "#c4e4d1"],
    placement: ["#efe9f7", "#d8cbeb"], credit: ["#fdf0dc", "#f7dcae"], assurance: ["#e5f1f4", "#bad9e0"], mobile: ["#e6eefb", "#c5d6f3"]
  };

  function R(x, y, w, h, f, rx, ex) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (rx || 0) + '" fill="' + f + '"' + (ex || "") + "/>"; }
  function C(cx, cy, r, f, ex) { return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + f + '"' + (ex || "") + "/>"; }
  function P(d, f, ex) { return '<path d="' + d + '" fill="' + f + '"' + (ex || "") + "/>"; }
  function L(d, s, w, ex) { return '<path d="' + d + '" fill="none" stroke="' + s + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"' + (ex || "") + "/>"; }
  function T(x, y, txt, size, f) { return '<text x="' + x + '" y="' + y + '" font-size="' + size + '" font-weight="700" font-family="Segoe UI, Arial, sans-serif" text-anchor="middle" fill="' + f + '" stroke="none">' + txt + "</text>"; }
  function G(tr, corps) { return '<g transform="' + tr + '">' + corps + "</g>"; }

  /* ---------- éléments ---------- */
  function coin(cx, cy, r, sym) { return C(cx, cy, r, GOLD) + C(cx, cy, r * 0.72, "none", ' stroke="#b8821a" stroke-width="' + Math.max(1, r * 0.1) + '"') + T(cx, cy + r * 0.3, sym || "€", r * 0.95, "#8a5f0e"); }
  function pile(x, y, n, r) { var s = ""; for (var i = 0; i < n; i++) s += '<ellipse cx="' + x + '" cy="' + (y - i * r * 0.5) + '" rx="' + r + '" ry="' + r * 0.42 + '" fill="' + (i % 2 ? "#f0c04f" : GOLD) + '" stroke="#b8821a" stroke-width="1"/>'; return s; }
  function carte(x, y, w, h, col, rot, bande) {
    var s = R(x, y, w, h, col, 8) + (bande ? R(x, y + h * 0.18, w, h * 0.2, "rgba(0,0,0,.45)") : R(x + w * 0.1, y + h * 0.28, w * 0.17, h * 0.2, GOLD, 3) + R(x + w * 0.1, y + h * 0.7, w * 0.34, h * 0.07, "rgba(255,255,255,.7)", 2)) +
      (bande ? R(x + w * 0.1, y + h * 0.7, w * 0.4, h * 0.08, "rgba(255,255,255,.75)", 2) : C(x + w * 0.82, y + h * 0.74, h * 0.1, "rgba(255,255,255,.85)") + C(x + w * 0.9, y + h * 0.74, h * 0.1, "rgba(255,255,255,.55)"));
    return rot ? G("rotate(" + rot + " " + (x + w / 2) + " " + (y + h / 2) + ")", s) : s;
  }
  function maison(x, y, w, h, mur, toit) {
    var rh = h * 0.42;
    return R(x, y + rh, w, h - rh, mur) + P("M" + (x - w * 0.08) + "," + (y + rh) + " L" + (x + w / 2) + "," + y + " L" + (x + w * 1.08) + "," + (y + rh) + " Z", toit) +
      R(x + w * 0.42, y + h - h * 0.34, w * 0.16, h * 0.34, NAVY, 2) + R(x + w * 0.12, y + rh + h * 0.12, w * 0.2, w * 0.2, SOFT, 2) + R(x + w * 0.68, y + rh + h * 0.12, w * 0.2, w * 0.2, SOFT, 2);
  }
  function voiture(x, y, s, col) {
    return G("translate(" + x + " " + y + ") scale(" + s + ")",
      P("M0,34 L6,34 L10,18 Q12,10 22,10 L58,10 Q68,10 74,20 L84,26 Q92,28 92,36 L92,42 L0,42 Z", col) + P("M18,18 L26,13 L40,13 L40,26 L14,26 Z", "#d9eef9") + P("M44,13 L58,13 Q64,14 68,22 L68,26 L44,26 Z", "#d9eef9") +
      C(24, 44, 9, INK) + C(24, 44, 4, GREY) + C(70, 44, 9, INK) + C(70, 44, 4, GREY) + R(0, 34, 6, 5, GOLD, 2));
  }
  function bouclier(cx, cy, s, col, symbole) {
    return G("translate(" + cx + " " + cy + ") scale(" + s + ")", P("M0,-30 L24,-21 L24,2 C24,18 10,28 0,33 C-10,28 -24,18 -24,2 L-24,-21 Z", col) + (symbole || ""));
  }
  function coche(c) { return L("M-10,2 L-3,10 L12,-8", c || WHITE, 6); }
  function coeur(cx, cy, s, col) { return G("translate(" + cx + " " + cy + ") scale(" + s + ")", P("M0,12 C-22,-4 -14,-20 -5,-17 C-2,-16 0,-13 0,-11 C0,-13 2,-16 5,-17 C14,-20 22,-4 0,12 Z", col)); }
  function parapluie(cx, cy, r, c1, c2) {
    return P("M" + (cx - r) + "," + cy + " A" + r + "," + r + " 0 0 1 " + (cx + r) + "," + cy + " Z", c1) +
      P("M" + (cx - r / 3) + "," + cy + " A" + r + "," + r + " 0 0 1 " + (cx + r / 3) + "," + cy + " L" + cx + "," + (cy - r) + " Z", c2, ' opacity=".9"') +
      L("M" + cx + "," + cy + " L" + cx + "," + (cy + r * 1.1) + " Q" + cx + "," + (cy + r * 1.35) + " " + (cx - r * 0.2) + "," + (cy + r * 1.3), NAVY, 3);
  }
  function feuille(x, y, s, col) { return G("translate(" + x + " " + y + ") scale(" + s + ")", P("M0,0 C-20,-10 -18,-36 6,-44 C24,-34 22,-8 0,0 Z", col) + L("M0,0 L5,-34", "rgba(255,255,255,.7)", 2.5)); }
  function arbre(x, y, s) { return G("translate(" + x + " " + y + ") scale(" + s + ")", R(-6, -30, 12, 34, "#8a6a47", 3) + C(0, -48, 30, GREEN) + C(-20, -34, 20, "#4aa87a") + C(20, -34, 20, "#4aa87a") + C(0, -60, 18, "#58b88a")); }
  function telephone(x, y, w, h, ecran) {
    return R(x, y, w, h, INK, 10) + R(x + 5, y + 10, w - 10, h - 20, ecran || WHITE, 4) + R(x + w / 2 - 8, y + 4, 16, 3, "#40505e", 2);
  }
  function barres(x, y, n, w, hmax, col) {
    var s = "";
    for (var i = 0; i < n; i++) { var h = hmax * (0.35 + 0.65 * (i + 1) / n); s += R(x + i * (w + 6), y + hmax - h, w, h, col, 3); }
    return s;
  }
  function sol(col) { return R(0, 150, 320, 30, col || "rgba(27,58,87,.10)"); }

  function roue(cx, cy, r) { return C(cx, cy, r, INK) + C(cx, cy, r * 0.55, GREY) + C(cx, cy, r * 0.16, INK); }
  function serrure(cx, cy, s, col) { return G("translate(" + cx + " " + cy + ") scale(" + s + ")", L("M-14,-8 L-14,-22 A14,14 0 0 1 14,-22 L14,-8", NAVY, 6) + R(-22, -8, 44, 34, col, 6) + C(0, 6, 5, INK) + R(-2, 8, 4, 10, INK, 2)); }
  function balance(cx, cy, s) {
    return G("translate(" + cx + " " + cy + ") scale(" + s + ")", R(-3, -44, 6, 88, NAVY, 2) + R(-26, 40, 52, 6, NAVY, 3) + L("M-52,-34 L52,-34", NAVY, 5) + L("M-52,-34 L-70,0 M-52,-34 L-34,0 M52,-34 L34,0 M52,-34 L70,0", GREY, 2.5) +
      P("M-72,0 L-32,0 Q-52,22 -72,0 Z", GOLD) + P("M32,0 L72,0 Q52,22 32,0 Z", GOLD) + C(0, -46, 6, GOLD));
  }
  function fleur(cx, cy, s, col) {
    var p = ""; for (var i = 0; i < 6; i++) p += '<ellipse cx="0" cy="-15" rx="8" ry="15" fill="' + col + '" transform="rotate(' + (i * 60) + ')"/>';
    return G("translate(" + cx + " " + cy + ") scale(" + s + ")", p + C(0, 0, 7, GOLD));
  }
  function colis(x, y, w, h, col) { return R(x, y, w, h, col, 6) + R(x + w / 2 - 7, y, 14, h, GOLD) + R(x, y + h * 0.32, w, 10, "rgba(255,255,255,.3)") + P("M" + (x + w / 2) + "," + y + " q-26,-26 -30,-6 q4,10 30,6 Z", GOLD) + P("M" + (x + w / 2) + "," + y + " q26,-26 30,-6 q-4,10 -30,6 Z", "#f0c04f"); }
  function arc(cx, cy, r, a0, a1, col, w) {
    var t = function (a) { var q = a * Math.PI / 180; return (cx + r * Math.cos(q)).toFixed(1) + "," + (cy + r * Math.sin(q)).toFixed(1); };
    return L("M" + t(a0) + " A" + r + "," + r + " 0 0 1 " + t(a1), col, w);
  }
  function cadran(cx, cy, r, aiguille) {
    var q = aiguille * Math.PI / 180;
    return arc(cx, cy, r, 182, 238, GREEN, 14) + arc(cx, cy, r, 242, 298, GOLD, 14) + arc(cx, cy, r, 302, 358, CORAL, 14) + L("M" + cx + "," + cy + " L" + (cx + (r - 6) * Math.cos(q)).toFixed(1) + "," + (cy + (r - 6) * Math.sin(q)).toFixed(1), NAVY, 6) + C(cx, cy, 9, NAVY);
  }
  function immeuble(x, y, w, h, col) {
    var f = "", i, j; for (i = 0; i < 3; i++) for (j = 0; j < Math.floor(h / 26); j++) f += R(x + 8 + i * (w - 16) / 3, y + 10 + j * 24, (w - 16) / 3 - 6, 14, "#d9eef9", 2);
    return R(x, y, w, h, col, 4) + f;
  }
  function facade(x, y, w, h) {
    var c = ""; for (var i = 0; i < 4; i++) c += R(x + 10 + i * (w - 20) / 4, y + 26, 10, h - 40, WHITE, 2);
    return P("M" + (x - 8) + "," + (y + 24) + " L" + (x + w / 2) + "," + y + " L" + (x + w + 8) + "," + (y + 24) + " Z", NAVY) + c + R(x - 6, y + h - 14, w + 12, 14, GREY, 3);
  }
  function silhouette(x, y, s, col) { return G("translate(" + x + " " + y + ") scale(" + s + ")", C(0, -26, 11, col) + P("M-15,12 Q-15,-12 0,-12 Q15,-12 15,12 Z", col)); }
  function sol_(c) { return sol(c); }
  function cartePlate(x, y, w, h, col, rot, accent) {
    var s = R(x, y, w, h, col, 10) + R(x + w * 0.1, y + h * 0.3, w * 0.17, h * 0.22, accent, 3) + R(x + w * 0.1, y + h * 0.72, w * 0.42, h * 0.08, "rgba(255,255,255,.75)", 2) + C(x + w * 0.8, y + h * 0.74, h * 0.12, accent, ' opacity=".95"') + C(x + w * 0.9, y + h * 0.74, h * 0.12, "rgba(255,255,255,.8)");
    return rot ? G("rotate(" + rot + " " + (x + w / 2) + " " + (y + h / 2) + ")", s) : s;
  }

  /* ---------- une scène par produit (320 × 180) ---------- */
  var SCENES = {
    CPT: function () { return sol() + carte(150, 56, 120, 76, NAVY, -8) + telephone(70, 22, 74, 132, "#eaf6fc") + R(80, 48, 54, 8, BLUE, 3) + R(80, 66, 40, 6, GREY, 3) + R(80, 80, 48, 6, GREY, 3) + R(80, 100, 54, 22, "#d4ecf8", 5) + L("M86,115 L96,108 L104,112 L116,104 L128,109", GREEN, 3) + coin(262, 132, 14); },
    JEUNE: function () { return sol() + R(70, 44, 74, 100, CORAL, 14) + R(82, 90, 50, 40, "#c94a3a", 8) + L("M92,44 Q107,18 122,44", NAVY, 6) + R(88, 104, 38, 6, "rgba(255,255,255,.8)", 3) + carte(158, 70, 112, 70, BLUE, 8) + coin(256, 58, 14) + C(110, 70, 5, WHITE); },
    OCF: function () { return sol() + parapluie(160, 90, 74, BLUE, NAVY) + carte(116, 112, 90, 56, WHITE, 0, false).replace(/fill="#ffffff"/, 'fill="#ffffff" stroke="#b9c6d2"') + coeur(256, 40, 0.9, CORAL) + coin(60, 138, 12); },
    DAC: function () { return sol() + carte(92, 58, 118, 74, NAVY, -7) + bouclier(214, 76, 1.05, BLUE, coche(WHITE)) + R(60, 128, 46, 6, GREY, 3) + R(60, 140, 30, 5, GREY, 2) + coin(270, 34, 11); },
    VCLA: function () { return sol() + carte(80, 40, 160, 100, BLUE, -6) + coin(268, 54, 12); },
    VPRE: function () { return sol() + carte(98, 32, 150, 96, "#c99a2a", 10) + carte(70, 46, 160, 100, NAVY, -7) + L("M240,34 l4,10 l10,1 l-8,7 l3,10 l-9,-6 l-9,6 l3,-10 l-8,-7 l10,-1 Z", GOLD, 2.5, ' transform="translate(20 -8)"'); },
    VELE: function () { return sol() + carte(78, 44, 150, 96, "#2f6f9f", -6) + R(236, 100, 60, 12, "#d4ecf8", 6) + R(236, 100, 38, 12, GREEN, 6) + bouclier(262, 62, 0.85, GREEN, coche(WHITE)) + R(100, 108, 58, 7, "rgba(255,255,255,.8)", 3) + coin(60, 128, 12); },
    VJEU: function () { return sol() + carte(88, 46, 150, 94, "#13a89a", -5) + L("M64,40 l4,9 l9,1 l-7,6 l2,9 l-8,-5 l-8,5 l2,-9 l-7,-6 l9,-1 Z", CORAL, 2.5) + L("M262,60 l3,7 l7,1 l-5,5 l1,7 l-6,-4 l-6,4 l1,-7 l-5,-5 l7,-1 Z", GOLD, 2.5) + R(110, 104, 60, 7, "rgba(255,255,255,.8)", 3); },
    CRET: function () { return sol() + R(88, 26, 100, 124, NAVY, 10) + R(100, 40, 76, 40, "#d4ecf8", 4) + L("M108,60 L124,52 L138,58 L160,48", GREEN, 3) + R(104, 96, 68, 12, "#0e2236", 3) + R(112, 124, 52, 8, GREY, 3) + carte(150, 84, 74, 46, BLUE, 12) + R(196, 112, 60, 30, "#9fd3b3", 4) + R(204, 120, 44, 6, "#5fae82", 2) + coin(258, 54, 12); },
    LA: function () {
      return sol() + '<ellipse cx="160" cy="108" rx="64" ry="42" fill="#f4a3a0"/>' + P("M214,92 Q236,84 238,106 Q236,126 214,122 Z", "#e98a86") + C(228, 100, 3, INK) + R(108, 140, 14, 18, "#e98a86", 4) + R(184, 140, 14, 18, "#e98a86", 4) +
        P("M118,76 L108,56 L136,68 Z", "#e98a86") + R(140, 66, 44, 8, "#c55f5b", 4) + coin(160, 38, 16) + C(132, 100, 4, INK) + L("M96,108 Q82,100 88,88", "#e98a86", 5) + coin(268, 138, 12, "€") + coin(52, 140, 10, "€");
    },
    LDDS: function () { return sol() + arbre(120, 150, 1.1) + feuille(232, 128, 1.4, GREEN) + feuille(262, 140, 1, "#58b88a") + C(264, 42, 22, GOLD) + coin(200, 84, 14) + L("M268,70 L268,80", GOLD, 3); },
    LEP: function () { return sol() + bouclier(160, 80, 1.8, GREEN, coche()) + pile(70, 150, 5, 22) + pile(250, 150, 3, 20) + coeur(262, 40, 0.8, CORAL); },
    LJ: function () { return sol() + R(124, 112, 72, 40, "#c97a4a", 6) + R(118, 108, 84, 10, "#b36a3c", 4) + L("M160,108 L160,64", GREEN, 5) + feuille(160, 84, 1.3, GREEN).replace('scale(1.3)', 'scale(1.3) scale(-1 1)') + feuille(160, 68, 1.5, "#58b88a") + coin(236, 70, 14) + coin(86, 90, 10) + C(262, 120, 6, CORAL); },
    LBR: function () { return sol() + P("M40,150 L120,70 L170,120 L210,84 L290,150 Z", "#9ec9b0") + P("M120,70 L136,86 L120,82 L104,86 Z", WHITE) + L("M210,84 L210,36", INK, 4) + P("M210,36 L252,48 L210,62 Z", CORAL) + coin(70, 48, 14) + C(250, 120, 5, GOLD); },
    AV: function () { return sol() + arbre(160, 150, 1.4) + coin(120, 78, 10) + coin(206, 70, 10) + coin(160, 40, 10) + coeur(70, 60, 1, CORAL) + C(258, 130, 6, GOLD); },
    PEA: function () { return sol() + barres(78, 40, 5, 28, 104, BLUE) + L("M72,128 L128,98 L162,108 L224,60 L248,50", GREEN, 5) + P("M250,44 L226,46 L240,64 Z", GREEN) + coin(262, 118, 14) + coin(52, 52, 10); },
    PER: function () { return sol("#f3dcae") + C(246, 40, 24, GOLD) + parapluie(150, 100, 70, CORAL, "#f2c14b") + R(106, 132, 108, 6, "#c9a063", 3) + R(120, 140, 80, 6, "#c9a063", 3) + L("M30,160 Q60,150 90,160 T150,160 T210,160 T270,160", BLUE, 4) + coin(70, 100, 12); },
    CIMMO: function () { return sol() + maison(96, 36, 120, 110, "#f4e3c4", CORAL) + G("translate(236 110)", C(0, 0, 12, GOLD) + C(0, 0, 5, "#fdf0dc") + R(10, -3, 36, 6, GOLD, 2) + R(34, 0, 6, 12, GOLD, 1) + R(24, 0, 6, 9, GOLD, 1)) + coin(60, 50, 12); },
    CCONSO: function () { return sol() + P("M104,62 L216,62 L226,150 L94,150 Z", BLUE) + L("M130,62 Q130,34 160,34 Q190,34 190,62", NAVY, 6) + R(132, 92, 56, 40, "#d4ecf8", 6) + L("M146,112 L154,120 L172,100", GREEN, 5) + coin(252, 60, 14) + coin(66, 126, 12) + C(254, 120, 7, CORAL); },
    CAUTO: function () { return sol() + voiture(98, 70, 1.5, BLUE) + R(40, 150, 240, 3, GREY, 2) + coin(262, 46, 14) + L("M60,60 l20,0 M50,76 l26,0", WHITE, 4, ' opacity=".8"'); },
    CTRAV: function () { return sol() + maison(70, 38, 110, 108, "#f1e5d0", "#8a6a47") + R(70, 92, 55, 54, "#9fd3b3", 0) + L("M206,150 L206,96 M236,150 L236,96 M206,108 L236,108 M206,124 L236,124 M206,140 L236,140", "#c9a063", 4) + R(250, 124, 34, 26, CORAL, 4) + L("M252,124 Q267,100 282,124", NAVY, 3) + R(250, 124, 34, 7, "#c94a3a", 2) + coin(262, 62, 12); },
    DECOUV: function () { return sol() + R(92, 30, 136, 116, WHITE, 8, ' stroke="#b9c6d2" stroke-width="2"') + R(108, 46, 64, 6, GREY, 3) + R(108, 62, 104, 6, GREY, 3) + R(108, 78, 88, 6, GREY, 3) + R(106, 100, 108, 30, "#fbe3df", 6) + L("M118,115 L134,115", CORAL, 6) + T(178, 121, "120 €", 15, CORAL) + coin(262, 56, 14) + C(60, 118, 8, CORAL) + C(58, 70, 5, GOLD); },
    CREV: function () { return sol() + L("M112,84 A50,50 0 0 1 198,64", BLUE, 8) + P("M206,46 L216,74 L188,70 Z", BLUE) + L("M208,96 A50,50 0 0 1 122,116", GREEN, 8) + P("M114,134 L104,106 L132,110 Z", GREEN) + coin(160, 90, 20) + coin(252, 52, 12) + coin(66, 128, 10) + C(264, 126, 6, CORAL); },
    MRH: function () { return sol() + maison(88, 40, 120, 106, "#f4e3c4", BLUE) + bouclier(238, 100, 1.1, NAVY, coche()) + coeur(262, 40, 0.8, CORAL); },
    AUTO: function () { return sol() + voiture(70, 74, 1.45, CORAL) + bouclier(256, 70, 1.1, NAVY, coche()) + R(40, 150, 240, 3, GREY, 2); },
    GAV: function () {
      var f = function (x, h, c) { return C(x, 90 - h, 11, c) + P("M" + (x - 14) + ",126 Q" + (x - 14) + "," + (96 - h + 14) + " " + x + "," + (96 - h + 14) + " Q" + (x + 14) + "," + (96 - h + 14) + " " + (x + 14) + ",126 Z", c); };
      return sol() + bouclier(160, 82, 2.2, "#cfe5ec", "") + f(130, 0, BLUE) + f(160, 14, CORAL) + f(190, 0, GREEN) + coeur(262, 44, 0.8, CORAL);
    },
    PREV: function () { return sol() + bouclier(160, 84, 2.1, NAVY, coeur(0, 2, 1.2, WHITE)) + parapluie(256, 84, 34, BLUE, "#7cc3e6") + C(64, 60, 14, GOLD) + coin(70, 130, 10); },

    CVM: function () { return sol() + colis(104, 76, 110, 72, "#13a89a") + carte(184, 28, 96, 62, CORAL, 7) + silhouette(62, 146, 1.1, BLUE) + bouclier(50, 60, 0.55, GOLD, coche(WHITE)) + coin(262, 140, 12); },
    CVJ: function () { return sol() + colis(90, 70, 110, 74, "#13a89a") + telephone(214, 40, 56, 100, "#eaf6fc") + R(222, 62, 40, 6, BLUE, 3) + R(222, 76, 30, 5, GREY, 2) + carte(60, 30, 80, 50, CORAL, -10) + coin(262, 150, 12) + L("M52,130 l4,9 l9,1 l-7,6 l2,9 l-8,-5 l-8,5 l2,-9 l-7,-6 l9,-1 Z", GOLD, 2.5); },
    CVA: function () { return sol() + colis(96, 72, 118, 76, BLUE) + carte(180, 28, 100, 64, NAVY, 8) + telephone(40, 44, 54, 96, "#eaf6fc") + R(48, 66, 38, 6, GREEN, 3) + R(48, 80, 28, 5, GREY, 2) + coin(262, 140, 14) + bouclier(70, 150, 0.5, GOLD, coche(WHITE)); },
    CVS: function () { return sol() + colis(100, 74, 116, 74, "#c99a2a") + carte(188, 26, 98, 62, GREEN, 6) + R(40, 52, 58, 88, WHITE, 4) + R(48, 64, 42, 5, GREY, 2) + R(48, 76, 36, 5, GREY, 2) + R(48, 88, 40, 5, GREY, 2) + coeur(70, 120, 0.8, CORAL) + coin(262, 140, 12); },
    PLAT: function () { return sol() + cartePlate(76, 36, 168, 104, "#8d9aa8", -7, "#d7dee6") + cartePlate(100, 52, 168, 104, NAVY, 6, "#c0cad4") + L("M262,40 l4,10 l10,1 l-8,7 l3,10 l-9,-6 l-9,6 l3,-10 l-8,-7 l10,-1 Z", "#c0cad4", 2.5); },
    WELI: function () { return sol() + cartePlate(70, 34, 180, 112, INK, -5, GOLD) + C(206, 70, 26, "none", ' stroke="' + GOLD + '" stroke-width="3"') + L("M180,70 L232,70 M206,44 Q190,70 206,96 M206,44 Q222,70 206,96", GOLD, 2) + L("M268,30 l4,10 l10,1 l-8,7 l3,10 l-9,-6 l-9,6 l3,-10 l-8,-7 l10,-1 Z", GOLD, 2.5) + coin(44, 140, 10); },
    CAT: function () { return sol() + R(84, 36, 110, 112, WHITE, 8, ' stroke="#b9c6d2" stroke-width="2"') + R(84, 36, 110, 28, CORAL, 8) + L("M104,36 L104,26 M174,36 L174,26", NAVY, 6) + R(98, 80, 20, 14, SOFT, 2) + R(128, 80, 20, 14, SOFT, 2) + R(158, 80, 20, 14, SOFT, 2) + R(98, 104, 20, 14, SOFT, 2) + serrure(232, 108, 1.2, GOLD) + coin(260, 46, 14) + C(60, 132, 6, GOLD); },
    AVP: function () { return sol() + arbre(150, 150, 1.5) + P("M236,48 L256,30 L276,48 L266,70 L246,70 Z", "#7cc3e6") + L("M236,48 L276,48 M246,70 L256,30 L266,70", WHITE, 2) + coin(96, 70, 12) + coin(208, 62, 10) + coin(150, 30, 10) + P("M56,56 l8,-14 l8,14 l-4,0 l0,12 l-8,0 l0,-12 Z", GOLD); },
    AVE: function () { return sol() + R(120, 112, 80, 38, "#c97a4a", 6) + R(114, 106, 92, 10, "#b36a3c", 4) + L("M160,106 L160,60", GREEN, 5) + feuille(160, 90, 1.3, GREEN) + feuille(160, 72, 1.5, "#58b88a") + coeur(250, 56, 1, CORAL) + silhouette(70, 140, 1.2, BLUE) + C(250, 126, 8, GOLD) + L("M60,46 l4,9 l9,1 l-7,6 l2,9 l-8,-5 l-8,5 l2,-9 l-7,-6 l9,-1 Z", GOLD, 2.5); },
    MGS: function () { return sol() + cadran(160, 130, 72, 214) + bouclier(70, 84, 0.9, GREEN, coche()) + coin(262, 70, 14); },
    MGE: function () { return sol() + cadran(160, 130, 72, 270) + barres(40, 70, 3, 14, 40, GOLD) + coin(262, 70, 14); },
    MGD: function () { return sol() + cadran(160, 130, 72, 326) + L("M44,110 L64,86 L84,96 L104,62", CORAL, 5) + P("M108,56 L88,60 L102,76 Z", CORAL) + coin(262, 70, 14); },
    PEAJ: function () { return sol() + barres(96, 50, 4, 26, 94, BLUE) + L("M90,128 L132,104 L168,112 L214,70", GREEN, 5) + P("M220,62 L198,64 L210,82 Z", GREEN) + L("M52,50 l4,9 l9,1 l-7,6 l2,9 l-8,-5 l-8,5 l2,-9 l-7,-6 l9,-1 Z", CORAL, 2.5) + silhouette(262, 140, 1.1, "#13a89a") + coin(250, 56, 12); },
    PEAPME: function () { return sol() + immeuble(70, 60, 56, 90, "#8aa0b3") + immeuble(138, 36, 64, 114, NAVY) + immeuble(214, 78, 48, 72, "#8aa0b3") + L("M64,40 L120,22 L178,8", GREEN, 5) + P("M184,6 L162,6 L174,24 Z", GREEN) + coin(276, 44, 14); },
    CTO: function () { return sol() + R(84, 28, 100, 124, WHITE, 6, ' stroke="#b9c6d2" stroke-width="2"') + R(98, 42, 72, 6, GREY, 3) + L("M98,112 L112,96 L126,104 L144,76 L164,84", GREEN, 4) + R(100, 122, 20, 16, BLUE, 2) + R(126, 116, 20, 22, NAVY, 2) + R(152, 124, 18, 14, BLUE, 2) + R(190, 52, 70, 90, "#efe9f7", 6) + L("M204,92 L204,70 M224,100 L224,76 M244,88 L244,64", NAVY, 4) + R(200, 76, 8, 14, GREEN, 1) + R(220, 82, 8, 14, CORAL, 1) + R(240, 70, 8, 14, GREEN, 1) + coin(268, 150, 12); },
    PSOC: function () { return sol() + facade(104, 40, 112, 104) + silhouette(70, 150, 1.1, BLUE) + silhouette(252, 150, 1.1, GREEN) + coin(160, 26, 12) + C(52, 60, 6, GOLD); },
    AUTZ: function () { return sol() + C(160, 90, 56, SOFT, ' stroke="#29a3db" stroke-width="6"') + P("M200,52 L222,54 L212,74 Z", BLUE) + coin(160, 90, 24) + barres(236, 90, 3, 14, 50, GREEN) + R(60, 54, 56, 44, WHITE, 4, ' stroke="#b9c6d2" stroke-width="2"') + R(60, 54, 56, 12, CORAL, 4) + R(68, 74, 12, 8, SOFT, 1) + R(86, 74, 12, 8, SOFT, 1) + R(68, 86, 12, 8, SOFT, 1); },
    DEP: function () { return sol() + maison(86, 44, 112, 100, "#f4e3c4", "#5c8f86") + coeur(142, 118, 0.9, CORAL) + C(236, 100, 26, WHITE, ' stroke="#3d9a6b" stroke-width="4"') + R(231, 86, 10, 28, GREEN, 2) + R(222, 95, 28, 10, GREEN, 2) + silhouette(262, 150, 0.9, NAVY); },
    DECES: function () { return sol() + parapluie(160, 104, 78, NAVY, "#3f5f7d") + silhouette(130, 150, 1, BLUE) + silhouette(190, 150, 1, CORAL) + silhouette(160, 156, 0.7, GREEN) + coeur(262, 40, 0.9, CORAL) + coin(52, 56, 12); },
    OBSQ: function () { return sol() + fleur(130, 84, 1.6, WHITE) + fleur(196, 104, 1.1, "#f4a3a0") + L("M130,110 Q128,140 120,160 M196,122 Q196,146 200,162", GREEN, 4) + feuille(124, 150, 1, GREEN) + bouclier(268, 70, 0.8, NAVY, coeur(0, 2, 1, WHITE)) + C(60, 46, 6, GOLD); },
    MOTO: function () { return sol() + roue(96, 128, 24) + roue(226, 128, 24) + L("M96,128 L132,98 L184,98 L226,128", CORAL, 7) + L("M226,128 L208,80 M196,78 L218,72", NAVY, 6) + L("M132,98 L118,80", NAVY, 5) + R(110, 82, 56, 14, INK, 7) + P("M150,98 Q176,70 200,90 L196,98 Z", CORAL) + bouclier(262, 50, 0.8, NAVY, coche()) + R(40, 152, 240, 3, GREY, 2); },
    CCAR: function () { return sol() + R(64, 52, 176, 78, "#f4f1ea", 14) + P("M240,70 L274,70 Q290,72 292,92 L292,130 L240,130 Z", "#f4f1ea") + P("M246,76 L272,76 Q282,78 284,92 L246,92 Z", "#d9eef9") + R(84, 66, 46, 30, "#d9eef9", 4) + R(142, 66, 46, 30, "#d9eef9", 4) + R(64, 104, 176, 8, BLUE, 0) + roue(112, 134, 18) + roue(238, 134, 18) + C(268, 34, 16, GOLD) + R(40, 152, 240, 3, GREY, 2); },
    VSP: function () { return sol() + voiture(60, 82, 1.2, "#13a89a") + C(252, 66, 30, WHITE, ' stroke="#e0604f" stroke-width="8"') + T(252, 76, "45", 26, INK) + R(40, 150, 240, 3, GREY, 2) + bouclier(262, 138, 0.5, NAVY, coche()); },
    MOB: function () {
      return sol() + telephone(118, 22, 84, 140, "#e4f3fb") + barres(137, 62, 4, 10, 40, BLUE) + T(160, 122, "5G", 24, NAVY) + R(136, 136, 48, 5, GREY, 2) +
        L("M214,62 Q232,82 214,102", BLUE, 5) + L("M230,48 Q260,82 230,116", BLUE, 5) + L("M104,62 Q86,82 104,102", BLUE, 5) + L("M88,48 Q60,82 88,116", BLUE, 5) +
        P("M250,128 L272,128 L282,138 L282,166 L250,166 Z", GOLD) + R(256,142,20,16,"#b8821a",3);
    },
    BOX: function () {
      return sol() + R(104, 104, 112, 36, NAVY, 9) + R(116, 76, 6, 30, NAVY, 2) + R(198, 76, 6, 30, NAVY, 2) + C(126, 122, 4.5, GREEN) + C(142, 122, 4.5, BLUE) + C(158, 122, 4.5, GOLD) + R(180, 118, 24, 8, "#40505e", 3) +
        C(160, 82, 5, BLUE) + L("M142,70 Q160,52 178,70", BLUE, 5) + L("M126,58 Q160,26 194,58", BLUE, 5) + L("M110,46 Q160,2 210,46", BLUE, 5, ' opacity=".55"') +
        L("M216,122 Q262,122 268,150 L268,166", GOLD, 5) + C(268, 166, 6, GOLD) + R(40, 130, 46, 28, "#d9eef9", 4) + R(46, 136, 34, 16, NAVY, 2);
    },
    PACK: function () {
      return sol() + telephone(52, 34, 62, 118, "#e4f3fb") + barres(66, 70, 4, 7, 30, BLUE) + T(83, 118, "5G", 17, NAVY) +
        R(138, 112, 112, 34, NAVY, 9) + R(150, 88, 6, 26, NAVY, 2) + R(232, 88, 6, 26, NAVY, 2) + C(160, 129, 4, GREEN) + C(174, 129, 4, BLUE) + L("M176,80 Q194,62 212,80", BLUE, 5) + C(194, 86, 4.5, BLUE) +
        C(266, 48, 30, CORAL) + T(266, 56, "-3 €", 20, WHITE);
    },
    ESIM: function () {
      return sol() + C(120, 92, 54, "#c6e5f5") + L("M66,92 L174,92", WHITE, 3) + L("M120,38 Q92,92 120,146", WHITE, 3) + L("M120,38 Q148,92 120,146", WHITE, 3) + L("M76,64 Q120,80 164,64", WHITE, 3) + L("M76,120 Q120,104 164,120", WHITE, 3) +
        L("M60,150 Q120,176 190,120", CORAL, 3, ' stroke-dasharray="1 9"') + P("M196,106 L224,114 L196,122 L201,114 Z", CORAL) +
        R(222, 32, 62, 46, NAVY, 7) + R(232, 42, 14, 12, GOLD, 2) + T(253, 70, "eSIM", 15, WHITE);
    },
    PJ: function () { return sol() + balance(160, 90, 1.25) + R(236, 120, 50, 12, "#8a6a47", 4) + R(250, 100, 6, 24, "#8a6a47", 2) + bouclier(60, 120, 0.7, NAVY, coche()); },
    GALE: function () {
      return sol() + telephone(104, 24, 88, 128, "#e4f3fb") + R(114, 44, 68, 22, BLUE, 8) + R(120, 51, 44, 4, WHITE, 2) + R(120, 58, 28, 3, "rgba(255,255,255,.7)", 2) +
        R(114, 72, 68, 22, GREY, 8) + R(120, 79, 40, 4, WHITE, 2) + R(120, 86, 24, 3, "rgba(255,255,255,.7)", 2) +
        R(114, 100, 68, 24, CORAL, 8) + T(148, 118, "Solde bas", 12, WHITE) +
        G("translate(246 78)", P("M-26,26 Q-26,-18 0,-22 Q26,-18 26,26 Z", GOLD) + R(-32, 26, 64, 8, "#b8821a", 4) + C(0, 40, 8, "#b8821a") + C(0, -26, 5, "#b8821a")) +
        L("M232,44 Q244,34 258,44", CORAL, 3) + L("M226,32 Q244,16 266,32", CORAL, 3) +
        L("M26,118 L48,96 L66,108 L84,134", CORAL, 3) + L("M22,122 L92,122", NAVY, 2, ' stroke-dasharray="4 5"') + coin(52, 52, 14);
    },
    GCON: function () {
      return sol() + R(150, 44, 130, 88, NAVY, 8) + R(158, 52, 114, 66, "#e4f3fb", 4) + barres(172, 62, 5, 12, 44, BLUE) + L("M172,104 L196,92 L214,98 L250,70", GREEN, 4) + R(196, 132, 38, 6, GREY, 2) + R(178, 138, 74, 5, NAVY, 2) +
        telephone(64, 52, 70, 112, "#e4f3fb") + R(76, 70, 46, 8, BLUE, 3) + R(76, 86, 46, 8, GREY, 3) + R(76, 102, 30, 8, GREY, 3) + C(99, 134, 9, GREEN) + L("M94,134 L98,138 L105,130", WHITE, 3) +
        coin(262, 30, 13) + L("M138,96 L148,96", GOLD, 4) + L("M143,90 L149,96 L143,102", GOLD, 4);
    },
    APN: function () {
      return sol() + telephone(64, 38, 70, 112, "#e4f3fb") + L("M74,56 L92,84 L84,104 L108,138", CORAL, 3) + L("M92,84 L118,76", CORAL, 3) + R(150, 78, 106, 66, NAVY, 7) + R(158, 86, 90, 50, "#d9eef9", 3) + R(142, 144, 122, 7, GREY, 3) +
        bouclier(236, 52, 1.3, GREEN, coche()) + L("M170,104 Q178,96 186,104 T202,104", BLUE, 3) + C(258, 120, 4, GOLD);
    },
    MPAY: function () { return sol() + carte(58, 38, 120, 76, NAVY, -8) + bouclier(224, 84, 1.7, GREEN, coche()) + serrure(110, 136, 0.9, GOLD) + coin(266, 34, 12); }
  };

  /* Dessin d'un produit : fond coloré selon l'univers, scène, légère ombre au sol. « famille » = identifiant de l'univers. */
  function svg(id, famille) {
    var f = FOND[famille] || FOND.compte, sc = SCENES[id];
    return '<svg class="illu" viewBox="0 0 320 180" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice" style="fill:none;stroke:none;stroke-width:0">' +
      R(0, 0, 320, 180, f[0]) + C(280, 20, 90, f[1]) + C(20, 170, 70, f[1], ' opacity=".6"') + (sc ? sc() : "") + "</svg>";
  }
  var api = { svg: svg, SCENES: SCENES, FOND: FOND };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.illustrations = api; }
})(typeof window !== "undefined" ? window : null);
