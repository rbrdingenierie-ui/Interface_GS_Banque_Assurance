/* GS Banque & Assurance – icônes communes (SVG en ligne, décoratives : le texte voisin porte le sens). */
(function (root) {
  "use strict";
  function s(corps) { return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + corps + "</svg>"; }
  var ICON = {
    carte: s('<rect x="2.5" y="5.5" width="19" height="13" rx="2"/><path d="M2.5 10h19M6 15h4"/>'),
    prelevement: s('<path d="M12 3.5v11"/><path d="M7.5 10.5 12 15l4.5-4.5"/><path d="M4 19h16"/>'),
    cheque: s('<rect x="2.5" y="6" width="19" height="12" rx="1.5"/><path d="M6 10h8M6 13.5h5"/><path d="M14 16c1-2.2 2-2.2 2.6-.6s1.4 1 2-.6"/>'),
    virement: s('<path d="M4 8h14"/><path d="M14 4l4 4-4 4"/><path d="M20 16H6"/><path d="M10 12l-4 4 4 4"/>'),
    retrait: s('<path d="M12 14.5v-11"/><path d="M7.5 8 12 3.5 16.5 8"/><path d="M4 19h16"/>'),
    frais: s('<circle cx="12" cy="12" r="9"/><path d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.4 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1.1 0-2-.4-2.5-1.2M12 6.5V8M12 16v1.5"/>'),
    info: s('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
    check: s('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    alerte: s('<path d="M12 4 21 20H3L12 4z"/><path d="M12 10v4M12 17h.01"/>'),
    cloche: s('<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 21h4"/>'),
    recherche: s('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>'),
    utilisateur: s('<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>'),
    groupe: s('<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6"/><circle cx="17" cy="9.5" r="2.4"/><path d="M16 14.600c2.600-.2 4.200 1.100 4.700 3.900"/>'),
    dossier: s('<path d="M4 6.500A1.500 1.500 0 0 1 5.500 5H10l2 2.500h6.500A1.500 1.500 0 0 1 20 9v9a1.500 1.500 0 0 1-1.500 1.500h-13A1.500 1.500 0 0 1 4 18z"/>'),
    megaphone: s('<path d="M4 10v4h3l7 4V6L7 10z"/><path d="M17.500 9a4 4 0 0 1 0 6"/><path d="M7 14l1 5h2.500l-1-4.500"/>'),
    courrier: s('<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M3 7l9 6.500L21 7"/>'),
    telephone: s('<path d="M6.500 3.500h3l1.500 4-2 1.300a11 11 0 0 0 5.200 5.200l1.300-2 4 1.500v3a2 2 0 0 1-2.200 2A15.500 15.500 0 0 1 4.500 5.700a2 2 0 0 1 2-2.200z"/>'),
    mobile: s('<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.500h2"/>'),
    calendrier: s('<rect x="3.500" y="5" width="17" height="15" rx="2"/><path d="M3.500 10h17M8 3v4M16 3v4"/>'),
    livre: s('<path d="M5 4.500h10.500A2.500 2.500 0 0 1 18 7v13H7.500A2.500 2.500 0 0 1 5 17.500z"/><path d="M5 17.500A2.500 2.500 0 0 1 7.500 15H18"/>'),
    graphique: s('<path d="M3 20h18"/><path d="M6 20v-7M11 20V6M16 20v-10"/>'),
    calculette: s('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8.500 7h7M8.500 12h.01M12 12h.01M15.500 12h.01M8.500 16h.01M12 16h.01M15.500 16h.01"/>'),
    ouvrir: s('<path d="M9 5h10v10"/><path d="M19 5 8 16"/><path d="M5 9v10h10"/>'),
    retour: s('<path d="M15 5 8 12l7 7"/>'),
    maison: s('<path d="M4 11 12 4l8 7"/><path d="M6 10v9.500h12V10"/><path d="M10 19.500v-5h4v5"/>'),
    epargne: s('<path d="M5 12c0-3.500 3-6 7-6s7 2.500 7 6c0 2-.9 3.500-2.500 4.500V19h-3v-1.500h-3V19h-3v-2.500C6 15.500 5 14 5 12z"/><path d="M15 11h.01M2.500 11.500h2.500"/>'),
    credit: s('<path d="M4 19h16"/><path d="M6 19V9l6-4 6 4v10"/><path d="M10 19v-5h4v5"/>'),
    assurance: s('<path d="M12 3 5 6v5.500c0 4.300 2.900 7.600 7 9.500 4.100-1.900 7-5.200 7-9.500V6l-7-3z"/><path d="m8.800 12 2.400 2.400 4-4.400"/>'),
    crayon: s('<path d="M4 20l1-4L16.500 4.500a2 2 0 0 1 3 3L8 19z"/><path d="M14.500 6.500l3 3"/>'),
    corbeille: s('<path d="M5 7h14M10 7V4.500h4V7"/><path d="M6.500 7l1 13h9l1-13"/><path d="M10 11v6M14 11v6"/>'),
    ciseaux: s('<circle cx="6" cy="6.500" r="2.500"/><circle cx="6" cy="17.500" r="2.500"/><path d="M8 8l12 9.500M8 16l12-9.500"/>'),
    imprimante: s('<path d="M7 9V3.500h10V9"/><rect x="3.500" y="9" width="17" height="8" rx="1.500"/><path d="M7 14h10v6.500H7z"/>'),
    analyse: s('<path d="M12 3.500v8.500h8.500"/><path d="M10.500 5.200A8 8 0 1 0 18.800 13.500"/>')
  };
  var api = { ICON: ICON };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.icones = ICON; }
})(typeof window !== "undefined" ? window : null);
