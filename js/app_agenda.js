/* GS Banque & Assurance – agenda commercial : semaine, éléments à faire, planification de rendez-vous, relances et rappels, impression. */
(function () {
  "use strict";

  var B = window.SGBF.banque, AG = window.SGBF.agenda, ICO = window.SGBF.icones, RECH = window.SGBF.recherche, IMP = window.SGBF.impression, CL = window.SGBF.clients, E = window.SGBF.equipe;
  var app = document.getElementById("app");
  var esc = B.esc;
  var CLIENT = {}; CL.forEach(function (c) { CLIENT[c.id] = c; });
  function store() { return B.store.charger(); }
  function pl(n, s, p) { return B.nb(n) + " " + (n > 1 ? p : s); }
  function nomCourt(c) { return c.prenom + " " + c.nom; }
  function nomListe(c) { return c.nom.toUpperCase() + " " + c.prenom; }
  function maj1(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function iso(d) { return B.ymd(d); }
  function lienClient(c) { return "client.html?id=" + c.id; }
  /* Collègue d'un rendez-vous interne : nom et poste (personnes fictives, voir equipe.js). */
  function collegueNom(id) { var c = E.collab(id); return c && !c.moi ? c.prenom + " " + c.nom : "un collègue"; }
  function colleguePoste(id) { var c = E.collab(id); return c && !c.moi ? E.posteLib(c) : ""; }
  /* Rendez-vous avec un collègue : « Avec … » (le vôtre) ou « Reçu par … » (le client est reçu par le collègue, sans vous). */
  function estCollegue(x) { return x.type === "interne" || x.type === "rdv_col"; }
  function prefixeCollegue(x) { return x.type === "rdv_col" ? "Reçu par " : "Avec "; }
  /* Texte brut pour l'impression : qui est concerné par la ligne. */
  function quiTexte(e) {
    if (e.type === "interne") return "Collègue : " + collegueNom(e.avec);
    if (e.type === "rdv_col") return (e.client ? nomCourt(e.client) : "–") + " (reçu par " + collegueNom(e.avec) + ")";
    return e.client ? nomCourt(e.client) : "–";
  }
  function heureTxt(h) { var m = /^(\d{2}):(\d{2})$/.exec(h || ""); return m ? (+m[1]) + " h" + (m[2] === "00" ? "" : " " + m[2]) : ""; }

  /* Libellés de dates : « Mardi 10 novembre », « du 10 au 14 novembre 2026 ». */
  function libJour(d) { return maj1(B.JOURS[d.getDay()]) + " " + d.getDate() + (d.getDate() === 1 ? "er " : " ") + B.MOIS[d.getMonth()]; }
  function libJourLong(d) { return B.fmtLong(d); }
  /* La semaine va du mardi au samedi (l'agence est fermée le lundi) : on part du lundi qui la repère. */
  function libSemaine(lundi) {
    var m = AG.debutSemaine(lundi), v = B.plusJours(lundi, AG.NB_JOURS_SEMAINE), a = m.getDate() + (m.getDate() === 1 ? "er" : "");
    if (m.getFullYear() !== v.getFullYear()) return "du " + a + " " + B.MOIS[m.getMonth()] + " " + m.getFullYear() + " au " + v.getDate() + " " + B.MOIS[v.getMonth()] + " " + v.getFullYear();
    if (m.getMonth() !== v.getMonth()) return "du " + a + " " + B.MOIS[m.getMonth()] + " au " + v.getDate() + " " + B.MOIS[v.getMonth()] + " " + v.getFullYear();
    return "du " + a + " au " + v.getDate() + " " + B.MOIS[v.getMonth()] + " " + v.getFullYear();
  }

  /* ---------- état ---------- */
  var params = new URLSearchParams(location.search);
  var base = AG.semaineParDefaut();
  var NB_SEM = 53;
  var etat = { lundi: base, form: null, msg: "", supprimer: null, histo: false };
  function limites() { return { min: B.plusJours(base, -7 * NB_SEM), max: B.plusJours(base, 7 * NB_SEM) }; }

  function dateParDefaut() {
    var auj = B.aujourdhui(), d = B.agenceSuivant(auj);
    var n = B.maintenant(), pl = AG.plages(d), dernier = pl.length ? AG.minutes(pl[pl.length - 1][1]) - AG.DUREE_RDV : 0;
    if (B.ecartJours(d, auj) === 0 && n.getHours() * 60 + n.getMinutes() >= dernier) d = B.agenceSuivant(B.plusJours(auj, 1));
    return d;
  }
  function formVide(type, cid, date, camp, avec, heure) {
    var c = cid && CLIENT[cid] ? cid : null;
    return { id: null, type: type || "rdv", client: c, q: "", date: date || iso(dateParDefaut()), heure: heure || "", canal: "", objet: "", note: "", statut: "afaire", camp: camp || "", avec: avec || "", err: null, creation: true };
  }
  function campagne(id) { return id ? (Array.isArray(store().campagnes) ? store().campagnes : []).filter(function (k) { return k.id === id; })[0] || null : null; }
  function formDe(x) {
    return { id: x.id, type: x.type, client: x.client, q: "", date: x.date, heure: x.heure || "", canal: x.canal || "", objet: x.objet, note: x.note || "", statut: x.statut, camp: x.camp && campagne(x.camp) ? x.camp : "", avec: x.avec || "", err: null, creation: false };
  }

  /* ---------- éléments d'affichage ---------- */
  var KIND = { agence: "Rendez-vous de l'agence", contact: "Contact enregistré", plage: "Plage réservée" };
  function typeLib(e) {
    if (e.kind === "agence") return KIND.agence;
    if (e.kind === "plage") return KIND.plage;
    if (e.kind === "contact") return e.moi ? "Votre note" : KIND.contact;
    return AG.TYPES[e.type].lib;
  }
  /* Libellé court pour les colonnes étroites de la semaine ; typeLib (complet) sert à l'impression. */
  function typeCourt(e) {
    if (e.kind === "agence") return "RDV agence";
    if (e.kind === "plage") return KIND.plage;
    if (e.kind === "contact") return e.moi ? "Votre note" : "Dossier";
    return e.type === "interne" ? "RDV collègue" : e.type === "rdv_col" ? "RDV client – collègue" : AG.TYPES[e.type].lib;
  }
  /* Légende des codes couleur : une pastille de la couleur et le nom, par groupe. */
  function legendeHtml() {
    var groupes = [];
    AG.CODES.forEach(function (c) { var g = groupes.filter(function (x) { return x.lib === c.groupe; })[0]; if (!g) groupes.push(g = { lib: c.groupe, codes: [] }); g.codes.push(c); });
    return '<div class="ag-legende" role="group" aria-label="Codes couleur de l\'agenda">' + groupes.map(function (g) {
      return '<div class="ag-leg-groupe"><p class="ag-leg-titre">' + esc(g.lib) + '</p><ul>' + g.codes.map(function (c) { return '<li><span class="ag-sw ag-c-' + c.code + '" aria-hidden="true"></span>' + esc(c.lib) + "</li>"; }).join("") + "</ul></div>";
    }).join("") + "</div>";
  }
  function statutPuce(e) {
    if (e.kind !== "perso") return "";
    if (e.statut === "fait") return '<span class="puce puce-ok">Fait</span>';
    if (e.statut === "annule") return '<span class="puce puce-bad">Annulé</span>';
    return e.reporte ? '<span class="puce puce-warn">Reporté</span>' : "";
  }
  function lienProduits(c) { return '<a href="catalogue.html?client=' + c.id + '">Produits</a>'; }
  /* Plage réservée de la journée (gestion, proactivité, réunion d'équipe du jeudi, accueil) : on ne la modifie pas, aucun rendez-vous n'y est possible. */
  var LIENS_PLAGE = {
    gestion: [["debiteurs.html", "Débiteurs", "Ouvrir les opérations débiteurs"], ["incidents.html", "Incidents", "Ouvrir la gestion des incidents"], ["atypiques.html", "Atypiques", "Ouvrir les mouvements atypiques"]],
    proactivite: [["o2pc.html", "O2PC", "Ouvrir la liste O2PC du jour"], ["campagnes.html", "Campagnes", "Ouvrir les campagnes commerciales"], ["phoning.html", "Phoning", "Ouvrir le phoning"]],
    reunion: [],
    accueil: []
  };
  function plageEntree(e) {
    var liens = (LIENS_PLAGE[e.id] || []).map(function (l) { return '<a href="' + l[0] + '" aria-label="' + esc(l[2]) + '">' + esc(l[1]) + "</a>"; }).join("");
    return '<li class="ag-e ag-e-plage ag-c-' + AG.codeCouleur(e) + (AG.passe(e.date, e.fin) ? " ag-passe" : "") + '"><span class="ag-h">' + esc(heureTxt(e.heure)) + "</span>" +
      '<div class="ag-c"><p class="ag-t"><span class="puce puce-plage">' + esc(KIND.plage) + "</span></p>" +
      '<p class="ag-m">' + esc(e.motif) + '<span class="ag-sous ag-bloc">de ' + esc(heureTxt(e.heure)) + " à " + esc(heureTxt(e.fin)) + "</span></p>" +
      (liens ? '<p class="ag-liens">' + liens + "</p>" : "") + "</div></li>";
  }
  function entree(e, jourDate) {
    if (e.kind === "plage") return plageEntree(e);
    var passe = e.kind === "perso" ? (e.statut !== "afaire" || AG.passe(e.date, e.heure)) : (e.kind === "contact" ? true : AG.passe(e.date, e.heure));
    var c = e.client;
    var h = '<li class="ag-e ag-e-' + e.kind + " ag-c-" + AG.codeCouleur(e) + (passe ? " ag-passe" : "") + (e.kind === "perso" && e.statut === "annule" ? " ag-annule" : "") + '">' +
      '<span class="ag-h">' + (e.heure ? esc(heureTxt(e.heure)) : '<span class="sr">Sans heure précise</span><span aria-hidden="true">–</span>') + "</span>" +
      '<div class="ag-c"><p class="ag-t"><span class="puce" title="' + esc(typeLib(e)) + '">' + esc(typeCourt(e)) + "</span>" + statutPuce(e) + "</p>" +
      (e.kind === "perso" && estCollegue(e) ? '<p class="ag-qui">' + prefixeCollegue(e) + '<a href="equipe.html?date=' + iso(e.date) + '">' + esc(collegueNom(e.avec)) + '</a><span class="ag-sous ag-bloc">' + esc(colleguePoste(e.avec)) + "</span></p>" : "") +
      (c ? '<p class="ag-qui"><a href="' + lienClient(c) + '">' + esc(nomCourt(c)) + '</a><span class="ag-sous ag-bloc">' + c.age + " ans – " + esc(c.pro.prof) + "</span></p>" : "") +
      '<p class="ag-m">' + esc(e.motif) + (e.canal ? '<span class="ag-sous"> – ' + esc(e.canal.toLowerCase()) + "</span>" : "") + "</p>" +
      (e.note ? '<p class="ag-note">' + esc(e.note) + "</p>" : "") +
      (e.kind === "perso" && e.camp && campagne(e.camp) ? '<p class="ag-sous">Campagne : <a href="campagnes.html?campagne=' + esc(e.camp) + '">' + esc(campagne(e.camp).nom) + "</a></p>" : "") +
      (e.reelle && B.ymd(e.reelle) !== B.ymd(jourDate) ? '<p class="ag-sous">Note rédigée le ' + esc(B.fmtDate(e.reelle)) + " (jour d'ouverture précédent affiché).</p>" : "");
    var liens = [];
    if (c) { liens.push('<a href="' + lienClient(c) + '">Fiche client</a>'); liens.push(lienProduits(c)); }
    if (e.kind === "perso") {
      if (e.statut === "afaire") liens.push('<button type="button" class="btn-texte" data-act="fait" data-id="' + e.id + '" aria-label="Marquer comme fait : ' + esc(e.motif) + '">Fait</button>');
      liens.push('<button type="button" class="btn-texte" data-act="modifier" data-id="' + e.id + '" aria-label="Modifier : ' + esc(e.motif) + '">Modifier</button>');
    } else if (e.kind === "agence" && c) liens.push('<a href="agenda.html?client=' + c.id + '&amp;type=relance" aria-label="Relancer ' + esc(nomCourt(c)) + ' : planifier une relance">Relancer</a>');
    h += (liens.length ? '<p class="ag-liens">' + liens.join("") + "</p>" : "") + "</div></li>";
    return h;
  }

  /* Grille de la semaine : une colonne par jour, une ligne par heure, même libre (voir agenda.js, grilleHtml). */
  function grilleSemaine(s) {
    return AG.grilleHtml(s, { entree: entree, libJour: function (d) { return esc(libJour(d)); }, libJourLong: libJourLong, planifier: true, ajout: true,
      textes: { ferie: function (f) { return "Jour férié : " + f + ". Agence fermée."; }, vide: function (passe) { return passe ? "Aucun contact enregistré ce jour-là." : "Rien d'autre de prévu."; } } });
  }

  /* ---------- semaine ---------- */
  function semaineHtml() {
    var st = store(), s = AG.semaine(st, etat.lundi), lim = limites(), auj = B.aujourdhui();
    var nA = 0, nP = 0, nC = 0;
    s.jours.forEach(function (j) { j.entrees.forEach(function (e) { if (e.kind === "agence") nA++; else if (e.kind === "perso") nP++; else if (e.kind === "contact") nC++; }); });
    var estCourante = B.ymd(etat.lundi) === B.ymd(AG.lundiDe(auj)), estDefaut = B.ymd(etat.lundi) === B.ymd(base);
    var h = '<div class="ag-nav"><button type="button" class="btn btn-secondaire" data-act="sem-prec"' + (etat.lundi <= lim.min ? " disabled" : "") + '>' + ICO.retour + "Semaine précédente</button>" +
      '<div class="ag-sem"><strong id="ag-sem-lib" tabindex="-1">Semaine ' + s.numero + "</strong><span>" + esc(libSemaine(s.lundi)) + "</span></div>" +
      '<button type="button" class="btn btn-secondaire ag-suiv" data-act="sem-suiv"' + (etat.lundi >= lim.max ? " disabled" : "") + '>Semaine suivante' + ICO.retour + "</button>" +
      (estDefaut ? "" : '<button type="button" class="btn-texte" data-act="sem-auj">Revenir à ' + (estCourante ? "la semaine en cours" : "la prochaine semaine d'ouverture") + "</button>") + "</div>";
    if (!AG.ouverte(auj)) {
      var f = B.estFerie(auj) ? AG.nomFerie(auj) : null;
      h += '<p class="ag-info">Aujourd\'hui, ' + esc(libJourLong(auj)) + ", l'agence est fermée (" + (f ? "jour férié : " + esc(f) : B.JOURS[auj.getDay()]) + "). L'agenda s'ouvre sur la semaine du prochain jour d'ouverture, le " + esc(libJourLong(B.agenceSuivant(auj))) + ".</p>";
    }
    h += '<p class="sr" role="status" id="ag-sem-statut">Semaine ' + s.numero + ", " + esc(libSemaine(s.lundi)) + ". " + pl(nA, "rendez-vous de l'agence", "rendez-vous de l'agence") + ", " + pl(nP, "élément à vous", "éléments à vous") + ".</p>";
    h += legendeHtml() + grilleSemaine(s);
    var fin = s.finAgence;
    var apresFin = fin && B.ecartJours(s.lundi, fin) > 0;
    h += '<p class="mention ag-leg">' + (apresFin ? "L'agence n'a pas encore programmé de rendez-vous après le " + esc(B.fmtDate(fin)) + " : les rendez-vous de l'agence sont proposés semaine après semaine. " : "Les rendez-vous de l'agence sont programmés jusqu'au " + esc(fin ? B.fmtDate(fin) : "—") + " ; ils peuvent changer d'une semaine à l'autre. ") +
      "Les contacts déjà enregistrés viennent des notes du dossier de chaque client et de vos propres notes. Chaque jour d'ouverture comporte trois plages réservées (gestion des débiteurs, atypiques et GDI, proactivité, accueil), et le jeudi une quatrième, la réunion d'équipe (14 h à 15 h) : aucun rendez-vous ne s'y place.</p>";
    return h;
  }
  function majSemaine() { document.getElementById("z-semaine").innerHTML = semaineHtml(); }

  /* ---------- à faire ---------- */
  function ligneAFaire(e, retard) {
    var c = e.client;
    return '<li class="ag-af' + (retard ? " ag-af-retard" : "") + '"><div class="ag-af-date"><strong>' + esc(maj1(B.JOURS[e.date.getDay()]) + " " + B.fmtDate(e.date)) + "</strong>" + (e.heure ? "<span>" + esc(heureTxt(e.heure)) + "</span>" : "") + "</div>" +
      '<div class="ag-af-corps"><p><span class="puce">' + esc(AG.TYPES[e.type].lib) + "</span>" + statutPuce(e) + (retard ? ' <span class="puce puce-bad">En retard</span>' : "") + "</p>" +
      '<p class="ag-m">' + (estCollegue(e) ? prefixeCollegue(e) + esc(collegueNom(e.avec)) + " (" + esc(colleguePoste(e.avec)) + ") – " : "") + (c ? '<a href="' + lienClient(c) + '">' + esc(nomCourt(c)) + "</a> – " : "") + esc(e.motif) + (e.canal ? '<span class="ag-sous"> – ' + esc(e.canal.toLowerCase()) + "</span>" : "") + "</p>" +
      (e.note ? '<p class="ag-note">' + esc(e.note) + "</p>" : "") + "</div>" +
      '<div class="ag-af-act"><button type="button" class="btn btn-secondaire" data-act="fait" data-id="' + e.id + '" aria-label="Marquer comme fait : ' + esc(e.motif) + '">Fait</button><button type="button" class="btn-texte" data-act="modifier" data-id="' + e.id + '" aria-label="Modifier : ' + esc(e.motif) + '">Modifier</button></div></li>';
  }
  function aFaireHtml() {
    var a = AG.aFaire(store()), n = a.retard.length + a.auj.length + a.avenir.length;
    if (!n) return '<p class="vide-bloc">Rien à faire pour le moment. Planifiez un rendez-vous, une relance ou un rappel avec le bouton « Planifier ».</p>';
    function groupe(titre, l, retard) { return l.length ? '<h3 class="sous-titre">' + esc(titre) + " (" + l.length + ')</h3><ul class="ag-afaire">' + l.map(function (e) { return ligneAFaire(e, retard); }).join("") + "</ul>" : ""; }
    return groupe("En retard", a.retard, true) + groupe("Aujourd'hui", a.auj, false) + groupe("À venir", a.avenir, false);
  }
  function majAFaire() { document.getElementById("z-afaire").innerHTML = aFaireHtml(); }

  /* ---------- historique ---------- */
  function histoHtml() {
    var l = AG.termines(store());
    if (!l.length) return '<p class="vide-bloc">Aucun élément terminé ou annulé pour le moment.</p>';
    return '<ul class="ag-afaire">' + l.map(function (e) {
      var c = e.client, conf = etat.supprimer === e.id;
      return '<li class="ag-af ag-passe' + (e.statut === "annule" ? " ag-annule" : "") + '"><div class="ag-af-date"><strong>' + esc(maj1(B.JOURS[e.date.getDay()]) + " " + B.fmtDate(e.date)) + "</strong>" + (e.heure ? "<span>" + esc(heureTxt(e.heure)) + "</span>" : "") + "</div>" +
        '<div class="ag-af-corps"><p><span class="puce">' + esc(AG.TYPES[e.type].lib) + "</span>" + statutPuce(e) + "</p><p class=\"ag-m\">" + (estCollegue(e) ? prefixeCollegue(e) + esc(collegueNom(e.avec)) + " – " : "") + (c ? '<a href="' + lienClient(c) + '">' + esc(nomCourt(c)) + "</a> – " : "") + esc(e.motif) + "</p>" + (e.note ? '<p class="ag-note">' + esc(e.note) + "</p>" : "") + "</div>" +
        '<div class="ag-af-act">' + (conf ? '<button type="button" class="btn-texte" data-act="suppr-oui" data-id="' + e.id + '">Confirmer la suppression</button><button type="button" class="btn-texte" data-act="suppr-non">Garder</button>' :
          '<button type="button" class="btn-texte" data-act="remettre" data-id="' + e.id + '" aria-label="Remettre à faire : ' + esc(e.motif) + '">Remettre à faire</button><button type="button" class="btn-texte" data-act="suppr" data-id="' + e.id + '" aria-label="Supprimer : ' + esc(e.motif) + '">Supprimer</button>') + "</div></li>";
    }).join("") + "</ul>";
  }
  function majHisto() {
    var z = document.getElementById("z-histo"), n = document.getElementById("ag-histo-n");
    if (z) z.innerHTML = histoHtml();
    if (n) { var k = AG.termines(store()).length; n.textContent = k ? "(" + k + ")" : ""; }
  }

  /* ---------- formulaire ---------- */
  var CHAMP_TYPE = { rdv: "Rendez-vous", rdv_col: "Rendez-vous du client avec un collègue", relance: "Relance", rappel: "Rappel", interne: "Rendez-vous avec un collègue" };
  function erreurChamp(champ) { return etat.form && etat.form.err && etat.form.err.champ === champ; }
  function attrErr(champ, id) { return erreurChamp(champ) ? ' aria-invalid="true" aria-describedby="ag-err"' : ""; }
  function campChip(f) {
    var k = f.camp ? campagne(f.camp) : null;
    return k ? '<p class="ms-camp"><span class="puce">Campagne</span> <strong>' + esc(k.nom) + '</strong> : cet élément sera rattaché à la campagne (il compte dans ses indicateurs si c\'est un rendez-vous). <button type="button" class="btn-texte" data-act="retirer-camp">Ne pas rattacher</button></p>' : "";
  }
  /* Choix du collègue : celui avec qui vous prenez rendez-vous (« interne ») ou celui qui reçoit le client (« rdv_col ») ; les cinq autres postes de l'agence, avec leur fonction. */
  function collegueChoix(f) {
    var col = f.type === "rdv_col";
    return '<div class="champ"><label for="ag-avec">' + (col ? "Conseiller qui reçoit le client *" : "Collègue *") + '</label><select id="ag-avec"' + attrErr("avec") + ' aria-describedby="ag-dispo"><option value="">Choisir un collègue</option>' +
      E.collegues().map(function (c) { return '<option value="' + c.id + '"' + (f.avec === c.id ? " selected" : "") + ">" + esc(c.prenom + " " + c.nom + " – " + E.posteLib(c)) + "</option>"; }).join("") + "</select>" +
      '<p class="aide-champ">' + (col ? "Le client est reçu par ce conseiller, seul : vous n'assistez pas au rendez-vous et vous restez libre à cette heure. Seule la disponibilité du conseiller est vérifiée. " : "") +
      'Les agendas des collègues sont ceux de l\'agence : <a href="equipe.html">voir l\'agenda de l\'équipe</a>. Vous voyez si un collègue est libre, jamais le nom de ses clients.</p></div>';
  }
  function clientChoix(f) {
    var c = f.client ? CLIENT[f.client] : null, T = AG.TYPES[f.type];
    var h = '<div class="champ ag-champ-client"><label for="ag-cq">Client' + (T.client ? " *" : ' <span class="aide-champ">(facultatif)</span>') + "</label>";
    if (c) h += '<p class="cl-choisi ag-cl-ok" id="ag-cl-ok"><span><strong>' + esc(nomCourt(c)) + "</strong> – " + c.age + " ans – " + esc(c.pro.prof) + " – " + esc(c.num) + '</span><button type="button" class="btn-texte" data-act="changer-client">Changer de client</button></p>';
    else h += '<input id="ag-cq" type="search" autocomplete="off" maxlength="60" aria-controls="ag-cres" placeholder="Nom, prénom ou numéro du client" value="' + esc(f.q) + '"' + attrErr("client") + '><ul id="ag-cres" class="cl-res" hidden></ul><p id="ag-cstatut" class="sr" role="status"></p>';
    return h + "</div>";
  }
  function formHtml() {
    var f = etat.form;
    if (!f) return "";
    var T = AG.TYPES[f.type], auj = B.aujourdhui(), maxD = iso(B.plusJours(auj, AG.HORIZON));
    var dMin = f.creation || f.date >= iso(auj) ? ' min="' + iso(auj) + '"' : "";
    var modif = !f.creation;
    var titre = modif ? "Modifier l'élément" : "Planifier un élément";
    var h = '<section class="bloc ag-form-bloc" id="bloc-form" aria-labelledby="t-form"><div class="bloc-tete"><h2 id="t-form" tabindex="-1">' + titre + '</h2><span class="sous">Les champs marqués d\'une étoile (*) sont obligatoires</span></div>' +
      '<form class="formulaire ag-form" id="form-ag" novalidate>' +
      '<fieldset class="pf-source"><legend>Ce que vous planifiez *</legend>' + Object.keys(CHAMP_TYPE).map(function (k) {
        return '<label class="pf-radio"><input type="radio" name="ag-type" value="' + k + '"' + (f.type === k ? " checked" : "") + (modif && f.type !== k ? " disabled" : "") + "> " + CHAMP_TYPE[k] + (k === "rdv" ? " – échange avec un client, d'une heure" : k === "rdv_col" ? " – le client est reçu par un autre conseiller de l'agence, sans vous" : k === "relance" ? " – appel ou e-mail de suivi" : k === "interne" ? " – une heure avec un collègue de l'agence, s'il est libre" : " – pense-bête, avec ou sans client") + "</label>";
      }).join("") + "</fieldset>" +
      campChip(f) + (f.type === "interne" ? collegueChoix(f) + clientChoix(f) : f.type === "rdv_col" ? clientChoix(f) + collegueChoix(f) : clientChoix(f)) +
      '<div class="ligne ag-ligne"><div class="champ"><label for="ag-date">Date *</label><input id="ag-date" type="date"' + dMin + ' max="' + maxD + '" value="' + esc(f.date) + '"' + attrErr("date") + '></div>' +
      '<div class="champ"><label for="ag-heure">Heure' + (T.heure ? " *" : ' <span class="aide-champ">(facultatif)</span>') + '</label><input id="ag-heure" type="time" step="900" min="' + AG.HEURE_MIN + '" max="' + T.hmax + '" value="' + esc(f.heure) + '"' + attrErr("heure") + '></div>' +
      (T.canaux.length ? '<div class="champ"><label for="ag-canal">Canal</label><select id="ag-canal"' + attrErr("canal") + ">" + T.canaux.map(function (x) { return "<option" + ((f.canal || T.canaux[0]) === x ? " selected" : "") + ">" + x + "</option>"; }).join("") + "</select></div>" : "") + "</div>" +
      (f.type === "interne" || f.type === "rdv_col" ? '<p class="ag-dispo" id="ag-dispo" aria-live="polite"></p>' : "") +
      '<p class="aide-champ">Agence ouverte ' + AG.HORAIRES_LIB + ' (règle de l\'agence). Un rendez-vous dure une heure et doit se terminer avant la fermeture (dernier rendez-vous à 12 h le matin et le samedi, à 17 h l\'après-midi) ; on planifie jusqu\'à un an. Aucun rendez-vous sur les plages réservées de chaque jour : gestion des débiteurs, atypiques et GDI (9 h 10 à 10 h), proactivité (11 h à 12 h), plage accueil (une heure variable d\'un jour à l\'autre, visible dans la semaine) et, le jeudi, réunion d\'équipe (14 h à 15 h).</p>' +
      '<div class="champ"><label for="ag-objet">Objet *</label><input id="ag-objet" maxlength="' + AG.MAX_OBJET + '" autocomplete="off" placeholder="' + (f.type === "rappel" ? "Exemple : envoyer le devis d'assurance" : f.type === "relance" ? "Exemple : relance du dossier de prêt" : f.type === "interne" ? "Exemple : présenter un client à la clientèle privée" : f.type === "rdv_col" ? "Exemple : conseil en placements avec la clientèle privée" : "Exemple : bilan d'épargne") + '" value="' + esc(f.objet) + '"' + attrErr("objet") + "></div>" +
      '<div class="champ"><label for="ag-note">Remarque <span class="aide-champ">(facultatif, ' + AG.MAX_NOTE + ' caractères au plus)</span></label><textarea id="ag-note" maxlength="' + AG.MAX_NOTE + '" rows="3"' + attrErr("note") + ">" + esc(f.note) + "</textarea></div>" +
      (modif ? '<div class="champ ag-champ-statut"><label for="ag-statut">Statut</label><select id="ag-statut"' + attrErr("statut") + ">" + Object.keys(AG.STATUTS).map(function (k) { return '<option value="' + k + '"' + (f.statut === k ? " selected" : "") + ">" + AG.STATUTS[k] + "</option>"; }).join("") + "</select></div>" : "") +
      '<p class="msg-erreur" id="ag-err" role="alert">' + (f.err ? esc(f.err.erreur) : "") + "</p>" +
      '<div class="pf-btns"><button type="submit" class="btn btn-principal">' + (modif ? "Enregistrer les modifications" : "Ajouter à l'agenda") + '</button><button type="button" class="btn btn-secondaire" data-act="fermer-form">Annuler</button>' +
      (modif ? (etat.supprimer === f.id ? '<button type="button" class="btn-texte" data-act="suppr-oui" data-id="' + f.id + '">Confirmer la suppression</button><button type="button" class="btn-texte" data-act="suppr-non">Garder</button>' : '<button type="button" class="btn-texte" data-act="suppr" data-id="' + f.id + '">Supprimer cet élément</button>') : "") + "</div></form></section>";
    return h;
  }
  function majForm() { document.getElementById("z-form").innerHTML = formHtml(); majDispo(); }
  function suggestions() {
    var f = etat.form, z = document.getElementById("ag-cres"), s = document.getElementById("ag-cstatut");
    if (!f || !z) return;
    var q = f.q.trim();
    if (q.length < 2) { z.hidden = true; z.innerHTML = ""; s.textContent = ""; return; }
    var kc = f.camp ? campagne(f.camp) : null, r = RECH.chercher(kc ? CL.filter(function (c) { return kc.ids.indexOf(c.id) >= 0; }) : CL, q, 8);
    z.innerHTML = r.length ? r.map(function (c) { return '<li><button type="button" data-act="choisir-client" data-id="' + c.id + '"><span class="rech-nom">' + esc(nomListe(c)) + '</span><span class="rech-sous">' + c.age + " ans – " + esc(c.pro.prof) + " – " + esc(c.num) + "</span></button></li>"; }).join("") : '<li class="rech-vide">Aucun client ne correspond à « ' + esc(q) + " ».</li>";
    s.textContent = r.length ? pl(r.length, "résultat", "résultats") : "Aucun résultat";
    z.hidden = false;
  }
  /* Lit les champs saisis dans l'état (appelé avant tout nouvel affichage du formulaire). */
  function lireForm() {
    var f = etat.form; if (!f) return;
    function v(id) { var e = document.getElementById(id); return e ? e.value : null; }
    var r = app.querySelector('input[name="ag-type"]:checked');
    if (r) f.type = r.value;
    var d = v("ag-date"); if (d !== null) f.date = d;
    var hh = v("ag-heure"); if (hh !== null) f.heure = hh;
    var cn = v("ag-canal"); if (cn !== null) f.canal = cn;
    var o = v("ag-objet"); if (o !== null) f.objet = o;
    var n = v("ag-note"); if (n !== null) f.note = n;
    var s = v("ag-statut"); if (s !== null) f.statut = s;
    var av = v("ag-avec"); if (av !== null) f.avec = av;
  }
  /* Disponibilité du collègue choisi à la date saisie : heures où vous êtes tous les deux libres, sinon les prochains créneaux communs. */
  function majDispo() {
    var z = document.getElementById("ag-dispo"), f = etat.form;
    if (!z || !f) return;
    lireForm();
    var d = B.lireYmd(f.date), c = E.collab(f.avec), st = store();
    if (!c || c.moi) { z.textContent = f.type === "rdv_col" ? "Choisissez le conseiller qui recevra le client pour voir ses disponibilités." : "Choisissez un collègue pour voir ses disponibilités."; return; }
    if (!d || !AG.ouverte(d) || B.ecartJours(d, B.aujourdhui()) < 0 || B.ecartJours(d, B.aujourdhui()) > AG.HORIZON) { z.textContent = "Choisissez un jour d'ouverture de l'agence pour voir les disponibilités de " + c.prenom + "."; return; }
    var nom = c.prenom, cid = f.client || null;
    if (f.type === "rdv_col") {
      var libres = E.creneauxClient(st, c.id, d, cid, f.id || null);
      if (libres.length) z.textContent = "Le " + libJourLong(d) + ", " + nom + " peut recevoir le client à : " + libres.map(heureTxt).join(", ") + ". Vous n'avez pas besoin d'être libre.";
      else {
        var p2 = E.prochainsClient(st, c.id, B.plusJours(d, 1), 3, cid);
        z.textContent = "Le " + libJourLong(d) + ", " + nom + " ne peut recevoir le client à aucune heure." + (p2.length ? " Prochains créneaux : " + p2.map(function (x) { return libJourLong(B.lireYmd(x.date)) + " à " + heureTxt(x.heure); }).join(" ; ") + "." : "");
      }
      return;
    }
    var comm = E.creneauxCommuns(st, c.id, d, f.id || null);
    if (comm.length) z.textContent = "Le " + libJourLong(d) + ", vous et " + nom + " êtes libres à : " + comm.map(heureTxt).join(", ") + ".";
    else {
      var p = E.prochains(st, c.id, B.plusJours(d, 1), 3);
      z.textContent = "Le " + libJourLong(d) + ", vous et " + nom + " n'avez aucun créneau libre en commun." + (p.length ? " Prochains créneaux communs : " + p.map(function (x) { return libJourLong(B.lireYmd(x.date)) + " à " + heureTxt(x.heure); }).join(" ; ") + "." : "");
    }
  }
  function ouvrirForm(f, focusId) {
    etat.form = f; etat.supprimer = null; etat.msg = ""; majMsg();
    majForm();
    var e = document.getElementById("bloc-form"); if (e) e.scrollIntoView({ block: "start" });
    var t = document.getElementById(focusId || "t-form"); if (t) t.focus();
  }
  function fermerForm(focusId) {
    etat.form = null; etat.supprimer = null; majForm();
    var t = document.getElementById(focusId || "t-planifier"); if (t) t.focus();
  }
  function majMsg() { var z = document.getElementById("z-msg"); if (z) z.innerHTML = etat.msg ? '<p class="ag-ok" id="ag-ok" tabindex="-1" role="status">' + esc(etat.msg) + "</p>" : ""; }
  function semainePour(d) { var l = AG.lundiDe(d), lim = limites(); if (l < lim.min) return lim.min; if (l > lim.max) return lim.max; return l; }

  /* ---------- enregistrement ---------- */
  function valeurs(f) { return { type: f.type, client: f.client, date: f.date, heure: f.heure, canal: f.canal, objet: f.objet, note: f.note, statut: f.statut, camp: f.camp || "", avec: f.avec || "" }; }
  function enregistrer() {
    lireForm();
    var f = etat.form, st = store(), r = f.creation ? AG.creer(st, valeurs(f)) : AG.modifier(st, f.id, valeurs(f));
    if (!r.ok) {
      f.err = r; document.getElementById("ag-err").textContent = r.erreur;
      var map = { client: "ag-cq", date: "ag-date", heure: "ag-heure", objet: "ag-objet", note: "ag-note", canal: "ag-canal", statut: "ag-statut", type: "ag-date", camp: "ag-err", avec: "ag-avec" };
      majForm(); var e = document.getElementById(map[r.champ] || "ag-err"); if (!e && r.champ === "client") e = document.getElementById("ag-cl-ok"); if (e) { if (!e.hasAttribute("tabindex") && !/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(e.tagName)) e.setAttribute("tabindex", "-1"); e.focus(); }
      return;
    }
    B.store.sauver();
    var x = r.element, c = x.client ? CLIENT[x.client] : null, d = B.lireYmd(x.date);
    etat.msg = (f.creation ? "Ajouté à l'agenda" : "Modifications enregistrées") + " : " + (x.type === "rdv_col" && c ? "rendez-vous de " + nomCourt(c) + " avec " + collegueNom(x.avec) : AG.TYPES[x.type].lib.toLowerCase() + (x.type === "interne" ? " (" + collegueNom(x.avec) + ")" : "") + (c ? " avec " + nomCourt(c) : "")) + " le " + libJourLong(d) + (x.heure ? " à " + heureTxt(x.heure) : "") + " – « " + x.objet + " ».";
    etat.form = null; etat.supprimer = null; etat.lundi = semainePour(d);
    majForm(); majSemaine(); majAFaire(); majHisto(); majMsg();
    var ok = document.getElementById("ag-ok"); if (ok) { ok.scrollIntoView({ block: "center" }); ok.focus(); }
  }

  /* ---------- impression ---------- */
  function docSemaine() {
    var st = store(), s = AG.semaine(st, etat.lundi), corps = "";
    var lignes = "";
    s.jours.forEach(function (j) {
      if (j.ferie) { lignes += '<tr><td class="g"><strong>' + esc(libJour(j.date)) + '</strong></td><td class="g" colspan="5">Jour férié : ' + esc(j.ferie) + ". Agence fermée.</td></tr>"; return; }
      if (!j.entrees.length) { lignes += '<tr><td class="g"><strong>' + esc(libJour(j.date)) + '</strong></td><td class="g" colspan="5">Rien de prévu.</td></tr>'; return; }
      j.entrees.forEach(function (e, i) {
        var stat = e.kind === "plage" ? "Réservée" : e.kind === "perso" ? (e.statut === "fait" ? "Fait" : e.statut === "annule" ? "Annulé" : e.reporte ? "Reporté" : "À faire") : e.kind === "agence" ? "Programmé" : "Enregistré";
        lignes += "<tr>" + (i === 0 ? '<td class="g" rowspan="' + j.entrees.length + '"><strong>' + esc(libJour(j.date)) + "</strong></td>" : "") + '<td class="g">' + esc(e.kind === "plage" ? (heureTxt(e.heure) + " – " + heureTxt(e.fin)).replace(/ /g, "\u00a0") : e.heure ? heureTxt(e.heure) : "–") + '</td><td class="g">' + esc(typeLib(e)) + '</td><td class="g">' + esc(quiTexte(e)) + '</td><td class="g">' + esc(e.motif) + (e.canal ? " (" + esc(e.canal.toLowerCase()) + ")" : "") + '</td><td class="g">' + esc(stat) + "</td></tr>";
      });
    });
    corps += '<section class="dp-long"><h2>Semaine ' + s.numero + " – " + esc(libSemaine(s.lundi)) + '</h2><table class="dp-pf dp-ag"><thead><tr><th scope="col" class="g">Jour</th><th scope="col" class="g">Heure</th><th scope="col" class="g">Nature</th><th scope="col" class="g">Client</th><th scope="col" class="g">Objet</th><th scope="col" class="g">Statut</th></tr></thead><tbody>' + lignes + "</tbody></table>" +
      '<p class="dp-mention">Agence ouverte ' + AG.HORAIRES_LIB + ' (règle de l\'agence). Plages réservées chaque jour d\'ouverture (et réunion d\'équipe le jeudi, de 14 h à 15 h) : aucun rendez-vous ne s\'y place.</p></section>';
    IMP.imprimer(IMP.document({ titre: "Agenda commercial – semaine " + s.numero, sous: libSemaine(s.lundi) + " – Agence de Paris", corps: corps }), "Agenda_semaine_" + s.numero + "_" + iso(s.lundi));
  }
  function docAFaire() {
    var a = AG.aFaire(store()), st = store(), corps = "";
    function tab(titre, l) {
      return l.length ? '<section class="dp-bloc"><h2>' + esc(titre) + '</h2><table class="dp-pf dp-ag"><thead><tr><th scope="col" class="g">Date</th><th scope="col" class="g">Heure</th><th scope="col" class="g">Nature</th><th scope="col" class="g">Client</th><th scope="col" class="g">Objet</th></tr></thead><tbody>' + l.map(function (e) {
        return '<tr><td class="g">' + esc(maj1(B.JOURS[e.date.getDay()]) + " " + B.fmtDate(e.date)) + '</td><td class="g">' + esc(e.heure ? heureTxt(e.heure) : "–") + '</td><td class="g">' + esc(AG.TYPES[e.type].lib) + '</td><td class="g">' + esc(quiTexte(e)) + '</td><td class="g">' + esc(e.motif) + (e.canal ? " (" + esc(e.canal.toLowerCase()) + ")" : "") + "</td></tr>";
      }).join("") + "</tbody></table></section>" : "";
    }
    var t = tab("En retard", a.retard) + tab("Aujourd'hui", a.auj) + tab("À venir", a.avenir);
    corps += t || '<p class="dp-texte">Rien à faire pour le moment.</p>';
    IMP.imprimer(IMP.document({ titre: "À faire", sous: "Situation au " + B.fmtLong(B.aujourdhui()) + " – Agence de Paris", corps: corps }), "A_faire_" + iso(B.aujourdhui()));
  }

  /* ---------- page ---------- */
  function render() {
    app.innerHTML = '<nav class="fil-ariane" aria-label="Fil d\'Ariane"><a href="index.html">' + ICO.retour + "Accueil</a><span aria-hidden=\"true\">/</span><span>Agenda commercial</span></nav>" +
      '<div class="page-titre"><h1>Agenda commercial</h1><p>' + esc(B.fmtLong(B.aujourdhui())) + " – jours d'ouverture de l'agence uniquement</p></div>" +
      '<div id="z-msg"></div><div class="page-grille">' +
      '<section class="bloc" aria-labelledby="t-sem"><div class="bloc-tete"><h2 id="t-sem">Ma semaine</h2><span class="ag-outils"><button type="button" class="btn btn-principal" id="t-planifier" data-act="planifier">Planifier</button><a class="btn btn-secondaire" href="equipe.html">Agenda de l\'équipe</a><button type="button" class="btn btn-secondaire" data-act="imprimer-sem">' + ICO.imprimante + "Imprimer la semaine</button></span></div><div id=\"z-semaine\"></div></section>" +
      '<div id="z-form"></div>' +
      '<section class="bloc" aria-labelledby="t-afaire"><div class="bloc-tete"><h2 id="t-afaire" tabindex="-1">À faire</h2><button type="button" class="btn btn-secondaire" data-act="imprimer-afaire">' + ICO.imprimante + "Imprimer la liste</button></div><div id=\"z-afaire\"></div></section>" +
      '<section class="bloc" aria-labelledby="t-histo"><details id="ag-histo"' + (etat.histo ? " open" : "") + '><summary><h2 id="t-histo" tabindex="-1">Terminés et annulés <span id="ag-histo-n" class="sous"></span></h2></summary><div id="z-histo" style="margin-top:10px"></div></details></section></div>' +
      '<p class="mention" style="margin-top:16px">Vos rendez-vous, relances et rappels sont enregistrés dans ce navigateur, sur cet ordinateur : pensez à imprimer ou à noter ce qu\'il faut garder.</p>';
    majSemaine(); majAFaire(); majHisto(); majForm();
  }

  /* ---------- événements ---------- */
  app.addEventListener("input", function (e) {
    var t = e.target;
    if (t.id === "ag-cq" && etat.form) { etat.form.q = t.value; suggestions(); }
    else if (t.id === "ag-date" && etat.form) majDispo();
  });
  app.addEventListener("change", function (e) {
    var t = e.target;
    if ((t.id === "ag-avec" || t.id === "ag-date") && etat.form) { majDispo(); return; }
    if (t.name === "ag-type" && etat.form) { lireForm(); etat.form.err = null; etat.form.canal = ""; majForm(); var r = app.querySelector('input[name="ag-type"]:checked'); if (r) r.focus(); }
  });
  app.addEventListener("toggle", function (e) { if (e.target.id === "ag-histo") etat.histo = e.target.open; }, true);
  app.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b) return;
    var act = b.getAttribute("data-act"), id = b.getAttribute("data-id"), st = store();
    if (act === "sem-prec" || act === "sem-suiv") {
      var lim = limites(), l = B.plusJours(etat.lundi, act === "sem-prec" ? -7 : 7);
      if (l < lim.min || l > lim.max) return;
      etat.lundi = l; majSemaine(); var s = document.getElementById("ag-sem-lib"); if (s) s.focus();
    } else if (act === "sem-auj") { etat.lundi = base; majSemaine(); var s2 = document.getElementById("ag-sem-lib"); if (s2) s2.focus(); }
    else if (act === "planifier") ouvrirForm(formVide("rdv", null, null));
    else if (act === "ajout-jour") ouvrirForm(formVide("rdv", null, b.getAttribute("data-d")));
    else if (act === "ajout-heure") ouvrirForm(formVide("rdv", null, b.getAttribute("data-d"), "", "", b.getAttribute("data-h")));
    else if (act === "fermer-form") fermerForm();
    else if (act === "retirer-camp") { lireForm(); etat.form.camp = ""; etat.form.err = null; majForm(); var rc = document.getElementById("t-form"); if (rc) rc.focus(); }
    else if (act === "changer-client") { lireForm(); etat.form.client = null; etat.form.q = ""; majForm(); document.getElementById("ag-cq").focus(); }
    else if (act === "choisir-client") { lireForm(); etat.form.client = parseInt(id, 10); etat.form.q = ""; etat.form.err = null; majForm(); var d = document.getElementById("ag-date"); if (d) d.focus(); }
    else if (act === "modifier") { var x = AG.trouver(st, id); if (x) ouvrirForm(formDe(x)); }
    else if (act === "fait" || act === "remettre") {
      var r = AG.changerStatut(st, id, act === "fait" ? "fait" : "afaire");
      if (r && r.ok === false) { etat.msg = r.erreur; majMsg(); var o = document.getElementById("ag-ok"); if (o) o.focus(); return; }
      B.store.sauver(); etat.msg = ""; majMsg(); majSemaine(); majAFaire(); majHisto();
      var h = document.getElementById(act === "fait" ? "t-afaire" : "t-histo"); if (h) h.focus();
    }
    else if (act === "suppr") { etat.supprimer = id; if (etat.form) { lireForm(); majForm(); } majHisto(); var c1 = app.querySelector('[data-act="suppr-oui"]'); if (c1) c1.focus(); }
    else if (act === "suppr-non") { var ci = etat.supprimer; etat.supprimer = null; if (etat.form) { lireForm(); majForm(); } majHisto(); var b2 = app.querySelector('[data-act="suppr"][data-id="' + ci + '"]'); if (b2) b2.focus(); }
    else if (act === "suppr-oui") {
      if (AG.supprimer(st, id)) B.store.sauver();
      var enForm = etat.form && etat.form.id === id; etat.supprimer = null; if (enForm) etat.form = null;
      etat.msg = "Élément supprimé de l'agenda."; majForm(); majSemaine(); majAFaire(); majHisto(); majMsg();
      var ok = document.getElementById("ag-ok"); if (ok) ok.focus();
    }
    else if (act === "imprimer-sem") docSemaine();
    else if (act === "imprimer-afaire") docAFaire();
  });
  app.addEventListener("submit", function (e) { if (e.target.id === "form-ag") { e.preventDefault(); enregistrer(); } });

  RECH.init(CL, document.getElementById("rech"), document.getElementById("rech-res"), document.getElementById("rech-statut"));
  render();
  /* Paramètres d'adresse : ?client=ID&type=rdv|rdv_col|relance|rappel|interne, ?avec=ID du collègue, ?heure=HH:MM, ?date=AAAA-MM-JJ (depuis la fiche client et l'agenda de l'équipe). */
  var pc = parseInt(params.get("client"), 10), pt = params.get("type"), pd = params.get("date");
  var pk = campagne(params.get("campagne"));
  if (pk && CLIENT[pc] && pk.ids.indexOf(pc) < 0) pk = null;
  if (CLIENT[pc] || pd || pt || params.get("avec")) {
    var ddate = B.lireYmd(pd), okd = ddate && AG.ouverte(ddate) && B.ecartJours(ddate, B.aujourdhui()) >= 0 && B.ecartJours(ddate, B.aujourdhui()) <= AG.HORIZON;
    var pa = params.get("avec"), ph = params.get("heure"), colleg = E.collab(pa), type = AG.TYPES[pt] ? pt : (colleg && !colleg.moi ? "interne" : "rdv"), avecType = type === "interne" || type === "rdv_col";
    if (CLIENT[pc] || okd || colleg) ouvrirForm(formVide(type, CLIENT[pc] ? pc : null, okd ? iso(ddate) : null, pk ? pk.id : "", avecType && colleg && !colleg.moi ? colleg.id : "", avecType && /^\d{2}:\d{2}$/.test(ph || "") ? ph : ""), CLIENT[pc] ? "ag-date" : "t-form");
  }
})();
