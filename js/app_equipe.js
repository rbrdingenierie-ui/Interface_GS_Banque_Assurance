/* GS Banque & Assurance – agenda de l'équipe : grille d'une journée (une colonne par poste de l'agence), annuaire de l'équipe, accès à la prise de rendez-vous avec un collègue.
   Les agendas des collègues sont fictifs et calculés par equipe.js ; la colonne « Vous » est votre propre agenda (agenda.js). Un rendez-vous se prend dans l'agenda commercial :
   une case libre mène au formulaire déjà rempli (collègue, date, heure) : « Prendre rendez-vous » pour vous voir avec le collègue, « Pour un client » pour qu'un client soit reçu par le collègue. */
(function () {
  "use strict";

  var B = window.SGBF.banque, AG = window.SGBF.agenda, E = window.SGBF.equipe, ICO = window.SGBF.icones, RECH = window.SGBF.recherche, CL = window.SGBF.clients;
  var app = document.getElementById("app"), esc = B.esc;
  function store() { return B.store.charger(); }
  function iso(d) { return B.ymd(d); }
  function maj1(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function heureTxt(h) { return E.hTxt(h); }
  function libJour(d) { return maj1(B.fmtLong(d)); }
  function nomPropre(st) { return E.nomComplet(E.COLLABS[0], st) !== "Vous"; }

  var DEFAUT = B.agenceSuivant(B.aujourdhui());
  var PASSE_MAX = 30;
  var etat = { date: DEFAUT, msg: "" };
  function limites() { var a = B.aujourdhui(); return { min: B.plusJours(a, -PASSE_MAX), max: B.plusJours(a, AG.HORIZON) }; }
  function dansLimites(d) { var l = limites(); return d >= l.min && d <= l.max; }

  /* Ce que fait chaque poste, en une phrase (organisation fictive de l'agence, inspirée de celle d'une agence bancaire). */
  var ROLES = {
    ccp: "Clientèle des particuliers : comptes, cartes, épargne, crédits, assurances.",
    ccpr: "Clientèle privée : clients au patrimoine important, conseil patrimonial, assurance-vie, placements. Vers qui orienter un client qui a besoin d'un conseil approfondi en placements.",
    ccpro: "Clientèle professionnelle : artisans, commerçants, professions libérales, chefs d'entreprise ; comptes et crédits professionnels.",
    dir: "Direction de l'agence : pilotage de l'activité, comité de crédit, validation des dossiers qui dépassent la délégation d'un conseiller (ouvertures de compte à valider, dérogations, crédits)."
  };

  /* ---------- grille ---------- */
  function celluleHtml(col, cel, d) {
    var c = col.collab, k = iso(d);
    if (cel.etat === "occupe") {
      var cls = "eq-occ eq-g-" + cel.genre;
      return '<td class="' + cls + '"><span class="eq-lib">' + esc(cel.lib) + '</span><span class="eq-sous">de ' + esc(heureTxt(cel.debut)) + " à " + esc(heureTxt(cel.fin)) + "</span></td>";
    }
    if (c.moi) return '<td class="eq-libre"><span class="eq-lib">Libre</span></td>';
    var nom = c.prenom + " " + c.nom, quand = esc(B.fmtLong(d)) + " à " + esc(heureTxt(cel.heure));
    /* le collègue est libre : on peut lui adresser un client, que vous soyez libre ou non (vous n'assistez pas au rendez-vous) */
    var pourClient = cel.client ? '<a class="eq-reserver eq-reserver-client" href="agenda.html?type=rdv_col&amp;avec=' + c.id + "&amp;date=" + k + "&amp;heure=" + cel.heure + '" aria-label="Prendre rendez-vous pour un client avec ' + esc(nom) + " le " + quand + '">Pour un client</a>' : "";
    if (cel.commun) {
      return '<td class="eq-libre eq-commun"><span class="eq-lib">Libre</span><a class="eq-reserver" href="agenda.html?avec=' + c.id + "&amp;date=" + k + "&amp;heure=" + cel.heure + '" aria-label="Prendre rendez-vous avec ' + esc(nom) + " le " + quand + '">Prendre rendez-vous</a>' + pourClient + "</td>";
    }
    return '<td class="eq-libre eq-seul"><span class="eq-lib">Libre</span><span class="eq-sous">' + (cel.raison === "passe" ? "Heure passée" : "Vous n'êtes pas libre") + "</span>" + pourClient + "</td>";
  }
  function grilleHtml() {
    var st = store(), d = etat.date, g = E.jourEquipe(st, d), l = limites();
    var nav = '<div class="ag-nav eq-nav"><button type="button" class="btn btn-secondaire" data-act="jour-prec"' + (B.agencePrecedent(B.plusJours(d, -1)) < l.min ? " disabled" : "") + ">" + ICO.retour + "Jour précédent</button>" +
      '<div class="ag-sem"><strong id="eq-jour" tabindex="-1">' + esc(libJour(d)) + "</strong><span>" + (B.ecartJours(d, B.aujourdhui()) === 0 ? "Aujourd'hui" : B.ecartJours(d, B.aujourdhui()) < 0 ? "Jour passé : consultation seulement" : "Dans " + B.ecartJours(d, B.aujourdhui()) + " jour" + (B.ecartJours(d, B.aujourdhui()) > 1 ? "s" : "")) + "</span></div>" +
      '<button type="button" class="btn btn-secondaire ag-suiv" data-act="jour-suiv"' + (B.agenceSuivant(B.plusJours(d, 1)) > l.max ? " disabled" : "") + ">Jour suivant" + ICO.retour + "</button>" +
      '<div class="champ eq-date"><label for="eq-date">Aller à une date</label><input id="eq-date" type="date" min="' + iso(l.min) + '" max="' + iso(l.max) + '" value="' + iso(d) + '"></div>' +
      (iso(d) === iso(DEFAUT) ? "" : '<button type="button" class="btn-texte" data-act="jour-auj">Revenir à ' + (B.ecartJours(DEFAUT, B.aujourdhui()) === 0 ? "aujourd'hui" : "la prochaine journée d'ouverture") + "</button>") + "</div>";
    if (!g.ouvert) {
      var f = B.estFerie(d) ? AG.nomFerie(d) : null;
      return nav + '<p class="ag-info">L\'agence est fermée ce jour-là (' + (f ? "jour férié : " + esc(f) : B.JOURS[d.getDay()]) + "). Prochain jour d'ouverture : " + esc(B.fmtLong(B.agenceSuivant(d))) + '. <button type="button" class="btn-texte" data-act="jour-suiv">Voir ce jour-là</button></p>';
    }
    var h = nav + '<div class="tab-defile eq-defile" tabindex="0" role="region" aria-label="Agendas des six postes de l\'agence, ' + esc(B.fmtLong(d)) + '">' +
      '<table class="eq-grille"><caption class="sr">Agendas du ' + esc(B.fmtLong(d)) + ". Chaque ligne est une heure de début possible pour un rendez-vous d'une heure ; une case libre mène à la prise de rendez-vous.</caption><thead><tr><th scope=\"col\" class=\"eq-h\">Début</th>" +
      g.colonnes.map(function (col) {
        var c = col.collab;
        return '<th scope="col"' + (c.moi ? ' class="eq-moi"' : "") + "><span class=\"eq-nom\">" + esc(E.nomComplet(c, st)) + (c.moi && nomPropre(st) ? " <span class=\"puce\">Vous</span>" : "") + '</span><span class="eq-poste">' + esc(E.posteLib(c)) + "</span></th>";
      }).join("") + "</tr></thead><tbody>";
    g.heures.forEach(function (hh, i) {
      var apres = i + 1 < g.heures.length ? g.heures[i + 1] : null;
      h += '<tr><th scope="row" class="eq-h">' + esc(heureTxt(hh)) + "</th>" + g.colonnes.map(function (col) { return celluleHtml(col, col.cellules[i], d); }).join("") + "</tr>";
      if (apres && E.minutes(apres) - E.minutes(hh) > 60) h += '<tr class="eq-pause"><th scope="row" class="eq-h">' + esc(heureTxt(hhmm(E.minutes(hh) + 60))) + '</th><td colspan="' + g.colonnes.length + '">Agence fermée : pause de la mi-journée</td></tr>';
    });
    h += "</tbody></table></div>" +
      '<div class="ag-legende eq-legende" role="group" aria-label="Codes couleur de la grille"><div class="ag-leg-groupe"><ul>' +
      [["eq-sw-libre", "Libre"], ["eq-sw-commun", "Libre, vous aussi : rendez-vous possible"], ["eq-sw-client", "Occupé : rendez-vous avec un client"], ["eq-sw-moi", "Occupé avec vous"], ["eq-sw-fixe", "Plage réservée de l'agence"], ["eq-sw-reunion", "Réunion"], ["eq-sw-absence", "Absent"]].map(function (x) { return '<li><span class="ag-sw ' + x[0] + '" aria-hidden="true"></span>' + x[1] + "</li>"; }).join("") + "</ul></div></div>" +
      '<p class="mention eq-leg">Une ligne = une heure de début possible (un rendez-vous dure une heure). Vous ne voyez que les plages occupées de vos collègues et leur nature, jamais le nom de leurs clients, comme dans un agenda partagé réel. ' +
      "Les rendez-vous avec un collègue se prennent aux jours d'ouverture, à partir d'aujourd'hui et jusqu'à un an ; le collègue accepte d'office s'il est libre. Pour un client reçu par le collègue sans vous, seule la disponibilité du collègue compte (« Pour un client »). Les agendas des collègues sont fictifs et ne changent pas d'une connexion à l'autre.</p>";
    return h;
  }
  function hhmm(n) { return (n < 600 ? "0" : "") + Math.floor(n / 60) + ":" + (n % 60 < 10 ? "0" : "") + (n % 60); }

  /* ---------- annuaire ---------- */
  function annuaireHtml() {
    var st = store(), d = etat.date;
    return '<ul class="eq-annuaire">' + E.COLLABS.map(function (c) {
      var nom = E.nomComplet(c, st);
      return '<li class="eq-fiche' + (c.moi ? " eq-fiche-moi" : "") + '"><h3>' + esc(nom) + (c.moi && nomPropre(st) ? ' <span class="puce">Vous</span>' : "") + '</h3><p class="eq-fonction">' + esc(E.posteLib(c)) + "</p><p class=\"eq-role\">" + esc(ROLES[c.poste]) + (c.moi ? " C'est votre poste." : c.poste === "ccp" ? " Même poste que le vôtre : il reçoit et conseille comme vous une autre partie du portefeuille de l'agence." : "") + "</p>" +
        (c.moi ? '<p class="eq-coord"><a href="carte.html">Votre carte de visite</a></p>' :
          '<dl class="eq-coord"><div><dt>Ligne directe</dt><dd>' + esc(c.direct) + '</dd></div><div><dt>E-mail</dt><dd class="eq-mail">' + esc(E.mail(c)) + "</dd></div></dl>" +
          '<p class="eq-act"><a class="btn btn-secondaire" href="agenda.html?type=interne&amp;avec=' + c.id + (B.ecartJours(d, B.aujourdhui()) >= 0 ? "&amp;date=" + iso(d) : "") + '" aria-label="Prendre rendez-vous avec ' + esc(nom) + '">Prendre rendez-vous</a> <a class="btn btn-secondaire" href="agenda.html?type=rdv_col&amp;avec=' + c.id + (B.ecartJours(d, B.aujourdhui()) >= 0 ? "&amp;date=" + iso(d) : "") + '" aria-label="Prendre rendez-vous pour un client avec ' + esc(nom) + '">Pour un client</a></p>') + "</li>";
    }).join("") + "</ul>";
  }

  /* ---------- page ---------- */
  function render() {
    var n = E.REPARTITION;
    app.innerHTML = '<nav class="fil-ariane" aria-label="Fil d\'Ariane"><a href="index.html">' + ICO.retour + "Accueil</a><span aria-hidden=\"true\">/</span><span>Agenda de l'équipe</span></nav>" +
      '<div class="page-titre"><h1>Agenda de l\'équipe</h1><p>Agence de Paris : ' + n.ccp + " conseillers clientèle particuliers (dont vous), " + n.ccpr + " conseillers clientèle privée, " + n.ccpro + " conseiller clientèle professionnelle et " + n.dir + " directrice d'agence</p></div>" +
      '<div class="page-grille"><section class="bloc" aria-labelledby="t-grille"><div class="bloc-tete"><h2 id="t-grille">Disponibilités de la journée</h2><a class="btn btn-secondaire" href="agenda.html">Mon agenda</a></div><div id="z-grille"></div></section>' +
      '<section class="bloc" aria-labelledby="t-equipe"><div class="bloc-tete"><h2 id="t-equipe">L\'équipe de l\'agence</h2></div><p class="aide-champ" style="margin-bottom:10px">Collègues fictifs : noms et numéros inventés. Orientez chaque client vers le bon interlocuteur, puis prenez rendez-vous avec lui.</p><div id="z-equipe"></div></section></div>';
    majGrille(); document.getElementById("z-equipe").innerHTML = annuaireHtml();
  }
  function majGrille() { document.getElementById("z-grille").innerHTML = grilleHtml(); majEquipe(); }
  function majEquipe() { var z = document.getElementById("z-equipe"); if (z) z.innerHTML = annuaireHtml(); }
  function aller(d, focus) {
    if (!dansLimites(d)) return;
    etat.date = d; majGrille();
    if (focus) { var t = document.getElementById("eq-jour"); if (t) t.focus(); }
  }

  app.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b) return;
    var act = b.getAttribute("data-act"), d = etat.date;
    if (act === "jour-prec") aller(B.agencePrecedent(B.plusJours(d, -1)), true);
    else if (act === "jour-suiv") aller(B.agenceSuivant(B.plusJours(d, 1)), true);
    else if (act === "jour-auj") aller(DEFAUT, true);
  });
  app.addEventListener("change", function (e) {
    if (e.target.id !== "eq-date") return;
    var d = B.lireYmd(e.target.value);
    if (!d || !dansLimites(d)) { e.target.value = iso(etat.date); return; }
    etat.date = d; majGrille();
    var i = document.getElementById("eq-date"); if (i) i.focus();
  });

  RECH.init(CL, document.getElementById("rech"), document.getElementById("rech-res"), document.getElementById("rech-statut"));
  var pd = B.lireYmd(new URLSearchParams(location.search).get("date"));
  if (pd && dansLimites(pd)) etat.date = pd;
  render();
})();
