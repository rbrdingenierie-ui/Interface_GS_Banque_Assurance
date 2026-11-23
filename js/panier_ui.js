/* GS Banque & Assurance – panier de services d'une convention de compte.
   Affichage commun à la souscription d'une convention (catalogue) et à l'ouverture de compte : le conseiller compose la convention du client en choisissant, parmi les services inclus,
   ceux que le client prendra. La cotisation reste fixe ; plus le client prend de services, plus la réduction (prix à l'unité moins cotisation) augmente.
   Le calcul est celui de catalogue.js (panierConvention) et de produits.js (economieConvention) : ce module ne fait qu'afficher et mettre à jour la zone. */
(function () {
  "use strict";
  var SG = window.SGBF = window.SGBF || {};
  var B = SG.banque, PR = SG.produits, K = SG.catalogue, esc = B.esc;

  function e2(n) { return Math.abs(n - Math.round(n)) < 1e-9 ? B.eur(n) : B.eur2(n); }   /* euros, avec les centimes quand il y en a */

  /* Barres « à l'unité » / « avec la convention » et phrase de réduction (ou de surcoût). utilises : clés des services pris ; compte : "CPT" ou "JEUNE" (la tenue du compte Jeune est déjà gratuite). */
  function resultat(cv, utilises, compte) {
    var e = PR.economieConvention(cv, utilises, compte), max = Math.max(e.unite, e.cotisation, 1);
    var gain = e.economie > 0, egal = e.economie === 0;
    return '<div class="conv-barres">' +
      '<div class="conv-barre"><span class="conv-lib">À l\'unité</span><span class="conv-piste" aria-hidden="true"><span class="conv-rempli conv-unite" style="width:' + Math.round(100 * e.unite / max) + '%"></span></span><span class="conv-val">' + esc(e2(e.unite)) + "</span></div>" +
      '<div class="conv-barre"><span class="conv-lib">Avec la convention</span><span class="conv-piste" aria-hidden="true"><span class="conv-rempli conv-conv" style="width:' + Math.round(100 * e.cotisation / max) + '%"></span></span><span class="conv-val">' + esc(e2(e.cotisation)) + "</span></div></div>" +
      '<p class="conv-econo ' + (gain ? "conv-gain" : "conv-perte") + '"><strong>' + (gain ? "Réduction : " + esc(e2(e.economie)) + " par an (" + e.pct + " % de moins)" : egal ? "Aucune réduction : la convention coûte autant que ces services à l\'unité" : "Surcoût : " + esc(e2(-e.economie)) + " par an avec la convention") + "</strong> – " +
      e.nb + " service" + (e.nb > 1 ? "s" : "") + " utilisé" + (e.nb > 1 ? "s" : "") + " sur " + e.total + (gain ? "." : ". La convention n\'est pas intéressante pour un client qui utilise si peu de services.") + "</p>";
  }
  function resume(cv, c, services) {
    var pan = K.panierConvention(cv, c, services), e = pan.eco;
    var cotis = '<p class="conv-cotis"><strong>Cotisation de la convention : ' + esc(e2(cv.cotisationMois)) + ' par mois</strong> (' + esc(e2(cv.cotisationAn)) + " par an), quel que soit le nombre de services pris.</p>";
    if (!pan.ok) return cotis + '<p class="conv-econo conv-perte conv-min"><strong>Il faut au moins ' + pan.minimum + " services pour composer une convention</strong> – la carte est incluse : ajoutez au moins un autre service pour pouvoir continuer.</p>";
    return cotis +
      resultat(cv, pan.cles, pan.compte) +
      '<p class="conv-reste">' + (e.nb === e.total ? "Tous les services de la convention sont pris : c'est la réduction maximale pour ce client." : "Il reste " + (e.total - e.nb) + (e.total - e.nb > 1 ? " services" : " service") + " à proposer au client : chacun fait monter la réduction, sans changer la cotisation.") + "</p>";
  }
  /* Services que l'on peut ajouter ou retirer (tous les services de la convention sauf la tenue de compte, qui est toujours exonérée). */
  function cles(cv) { return cv.services.filter(function (x) { return x.k !== "tenue"; }).map(function (x) { return x.k; }); }
  /* Le panier : bandeau « tenue de compte exonérée », un article par service (la carte de la convention est toujours incluse), deux raccourcis, résultat chiffré.
     base : préfixe des identifiants (« s » au catalogue, « op » à l'ouverture de compte). */
  function html(cv, c, services, base) {
    if (!cv) return "";
    base = base || "s";
    var pan = K.panierConvention(cv, c, services), tenue = cv.services.filter(function (x) { return x.k === "tenue"; })[0];
    var h = '<fieldset class="conv-panier" id="' + base + '-panier" tabindex="-1"><legend>Composer la convention du client</legend>' +
      '<p class="note-pied">Proposez au client les services de la convention, comme dans un panier : <strong>plus il en choisit, moins il paie au total</strong>, car la cotisation reste fixe alors que chaque service pris à l\'unité aurait son propre prix. Une convention regroupe <strong>au moins deux services</strong> : la carte, toujours incluse, et au moins un autre.</p>';
    if (tenue) h += '<p class="conv-tenue"><strong>Tenue de compte exonérée</strong> avec la convention' + (pan.compte === "JEUNE" ? ". Déjà gratuite avec le compte Jeune : elle ne compte pas dans la réduction." : " : " + esc(e2(tenue.valeur)) + " par an à l'unité, offerts au client.") + "</p>";
    h += '<div class="conv-articles">';
    cv.services.filter(function (x) { return x.k !== "tenue"; }).forEach(function (x) {
      var fixe = x.k === pan.fixe, pris = pan.cles.indexOf(x.k) >= 0;
      h += '<label class="conv-art' + (pris ? " conv-art-pris" : "") + '"><input type="checkbox" data-svc="' + esc(x.k) + '"' + (pris ? " checked" : "") + (fixe ? " disabled" : "") + '><span class="conv-nom">' + esc(x.lib) + '</span><span class="conv-prix">' + esc(e2(x.valeur)) + " par an à l'unité</span>" +
        '<span class="conv-etat">' + (fixe ? "Toujours incluse" : pris ? "Ajouté" : "Ajouter") + "</span></label>";
    });
    h += '</div><div class="pf-btns conv-actions"><button type="button" class="btn btn-secondaire" data-act="svc-tout">Tout ajouter</button><button type="button" class="btn btn-secondaire" data-act="svc-carte">Repartir de la carte</button></div>' +
      '<div id="' + base + '-conv-res" class="conv-sim conv-sim-res" role="status" aria-live="polite">' + resume(cv, c, services) + "</div></fieldset>";
    return h;
  }
  /* Met à jour la zone déjà affichée (cases, étiquettes, résultat) sans la redessiner, pour garder le focus. Renvoie les services retenus (la carte de la convention est toujours dedans). */
  function maj(cv, c, services, base) {
    base = base || "s";
    var z = document.getElementById(base + "-panier");
    var pan = K.panierConvention(cv, c, services);
    if (!z) return pan.cles;
    z.querySelectorAll("[data-svc]").forEach(function (i) {
      var k = i.getAttribute("data-svc"), pris = pan.cles.indexOf(k) >= 0, lab = i.closest("label");
      i.checked = pris;
      lab.classList.toggle("conv-art-pris", pris);
      lab.querySelector(".conv-etat").textContent = k === pan.fixe ? "Toujours incluse" : pris ? "Ajouté" : "Ajouter";
    });
    var r = document.getElementById(base + "-conv-res");
    if (r) r.innerHTML = resume(cv, c, services);
    return pan.cles;
  }
  /* Nouvelle liste après avoir coché ou décoché un service. */
  function basculer(services, k, coche) {
    var cur = (Array.isArray(services) ? services : []).filter(function (x) { return x !== k; });
    if (coche) cur.push(k);
    return cur;
  }
  /* Raccourcis : « Tout ajouter » (tous les services) ou « Ne garder que la carte » (liste vide : la carte reste incluse). */
  function raccourci(cv, act) { return act === "svc-tout" ? cles(cv) : []; }

  SG.panierUI = { resultat: resultat, resume: resume, html: html, maj: maj, basculer: basculer, raccourci: raccourci, cles: cles, e2: e2 };
})();
