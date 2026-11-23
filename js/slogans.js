/* GS Banque & Assurance – slogans de la banque. Trois slogans ; UN SEUL est affiché pendant toute une connexion, sur la page de connexion (repère data-slogan)
   puis en bas de l'accueil : il est tiré au hasard à l'ouverture de la connexion et reste fixe tant qu'on ne se déconnecte pas (rechargements, changements de page).
   À la connexion suivante (après « Se déconnecter », ou dans un nouvel onglet), un autre slogan est tiré, différent du précédent.
   Pour modifier un slogan, changer son texte dans la liste ci-dessous (trois textes). */
(function (root) {
  "use strict";

  var LISTE = [
    "Bâtir vos projets, protéger ceux qui comptent.",
    "À chaque étape, un conseiller à vos côtés.",
    "Voir loin, construire avec vous."
  ];
  /* Slogan de la connexion en cours : sessionStorage (propre à l'onglet) ; effacé par acces.js à la déconnexion (même clé, à garder identique).
     Dernier slogan tiré, toutes connexions confondues : localStorage, pour ne pas répéter le même d'une connexion à l'autre. */
  var CLE = "sgbf.slogan", CLE_DERNIER = "sgbf.slogan.dernier";

  function stockage(nom) { try { return root && root[nom] ? root[nom] : null; } catch (e) { return null; } }
  function lire(st, cle) { try { var v = parseInt(st.getItem(cle), 10); return v >= 0 && v < LISTE.length ? v : -1; } catch (e) { return -1; } }
  function ecrire(st, cle, v) { try { st.setItem(cle, String(v)); } catch (e) { /* stockage indisponible : le slogan ne sera pas mémorisé */ } }
  /* Indice d'un slogan différent de « precedent » ; « hasard » (nombre de 0 à 1, par défaut Math.random) est paramétrable pour les tests. */
  function tirer(hasard, precedent) {
    var h = typeof hasard === "number" ? hasard : Math.random(), p = typeof precedent === "number" ? precedent : -1;
    var choix = []; for (var i = 0; i < LISTE.length; i++) if (i !== p) choix.push(i);
    return choix[Math.min(choix.length - 1, Math.floor(h * choix.length))];
  }
  /* Slogan de la connexion en cours : celui déjà retenu dans cet onglet, sinon un nouveau (différent du dernier tiré), mémorisé aussitôt. */
  function courant(session, local, hasard) {
    var i = session ? lire(session, CLE) : -1;
    if (i < 0) {
      i = tirer(hasard, local ? lire(local, CLE_DERNIER) : -1);
      if (session) ecrire(session, CLE, i);
      if (local) ecrire(local, CLE_DERNIER, i);
    }
    return i;
  }
  /* Affiche le slogan de la connexion dans chaque élément portant l'attribut data-slogan. */
  function appliquer() {
    if (!root || !root.document) return;
    var els = root.document.querySelectorAll("[data-slogan]");
    if (!els.length) return;
    var i = courant(stockage("sessionStorage"), stockage("localStorage"));
    for (var k = 0; k < els.length; k++) els[k].textContent = LISTE[i];
  }

  var api = { LISTE: LISTE, CLE: CLE, CLE_DERNIER: CLE_DERNIER, tirer: tirer, courant: courant, appliquer: appliquer };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.slogans = api; appliquer(); }
})(typeof window !== "undefined" ? window : null);
