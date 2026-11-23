/* GS Banque & Assurance – catalogue de produits : fiches illustrées, tarifs, éligibilité d'un client avec justification, comparateur, souscription, impression et PDF. */
(function () {
  "use strict";

  var B = window.SGBF.banque, PR = window.SGBF.produits, E = window.SGBF.eligibilite, K = window.SGBF.catalogue, ILL = window.SGBF.illustrations, ICO = window.SGBF.icones,
    PL = window.SGBF.placements, R = window.SGBF.risque, RECH = window.SGBF.recherche, IMP = window.SGBF.impression, CL = window.SGBF.clients, M = window.SGBF.mifid, CT = window.SGBF.contrats, UC = window.SGBF.uiContrats, PUI = window.SGBF.panierUI, SU = window.SGBF.santeUI, BU = window.SGBF.beneficiairesUI;
  var app = document.getElementById("app");
  var esc = B.esc;

  var FAM = {}; PR.familles.forEach(function (f) { FAM[f.id] = f; });
  var CLIENT = {}; CL.forEach(function (c) { CLIENT[c.id] = c; });
  var PRO = window.SGBF.prospects;
  /* Clients : ceux du portefeuille et ceux dont le compte a été ouvert pendant l'exercice (ouverture de compte d'un prospect). */
  function tous() { return PRO ? PRO.tousClients(CL, B.store.charger()) : CL; }
  function qui(id) { return CLIENT[id] || (PRO ? PRO.clientsOuverts(B.store.charger()).filter(function (c) { return c.id === id; })[0] : null) || null; }
  function lienClient(c) { return PRO ? PRO.lienClient(c) : "client.html?id=" + c.id; }
  function pl(n, s, p) { return B.nb(n) + " " + (n > 1 ? p : s); }
  function store() { return B.store.charger(); }
  function nomCourt(c) { return c.prenom + " " + c.nom; }
  function nomListe(c) { return c.nom.toUpperCase() + " " + c.prenom; }
  function nomFull(c) { return c.civ + " " + c.prenom + " " + c.nom.toUpperCase(); }

  var params = new URLSearchParams(location.search);
  var etat = {
    fam: "tous", prod: PR.parId[params.get("produit")] ? params.get("produit") : null, client: qui(parseInt(params.get("client"), 10)) ? parseInt(params.get("client"), 10) : null,
    comp: [], msgComp: "", q: "", pq: "", vf: "tous", sous: false, coches: [], sante: {}, clause: {}, montant: "", note: "", err: "", msgSous: null, annuler: null, rapport: "", msgCt: null,
    canal: K.MOYENS[params.get("moyen")] ? params.get("moyen") : "", opt: {}, idv: "", idp: "", rem: ""
  };
  var auParamProduit = !!etat.prod;
  /* Lien « Souscrire ce produit » du rapport de conseil : client, produit et rapport sont déjà choisis. */
  if (etat.prod && etat.client && params.get("souscrire") === "1") { etat.sous = true; etat.rapport = params.get("rapport") || ""; }

  /* ---------- éléments communs ---------- */
  var CHIP = { eligible: "chip-ok", examiner: "chip-warn", non: "chip-bad", detenu: "chip-ctrl" };
  function chip(ev) {
    return '<span class="chip ' + CHIP[ev.verdict] + '">' + esc(ev.libelle) + "</span>";
  }
  function client() { return etat.client ? qui(etat.client) : null; }
  function verdict(pid) { var c = client(); return c ? K.verdictClient(c, pid, store()) : null; }

  /* ---------- client concerné ---------- */
  function clientHtml() {
    var c = client();
    var rech = '<div class="champ cl-q"><label for="cl-q">' + (c ? "Changer de client" : "Rechercher un client (nom, prénom ou numéro)") + '</label><input id="cl-q" type="search" autocomplete="off" maxlength="60" aria-controls="cl-res" value="' + esc(etat.q) + '"></div>' +
      '<ul id="cl-res" class="cl-res" hidden></ul><p id="cl-statut" class="sr" role="status"></p>';
    if (c) {
      var n = K.compterClient(c, store());
      return '<div class="cl-choisi" id="cl-choisi" tabindex="-1"><p><strong>' + esc(nomFull(c)) + "</strong> – " + c.age + " ans – " + esc(c.pro.prof) + " – " + esc(c.adr.ville) + " – " + esc(c.num) + '</p>' +
        '<p class="sous">Sur les ' + PR.produits.length + " produits : " + pl(n.eligible, "éligible", "éligibles") + ", " + pl(n.examiner, "à examiner", "à examiner") + ", " + pl(n.non, "non éligible", "non éligibles") + ", " + pl(n.detenu, "déjà détenu", "déjà détenus") + ".</p>" +
        '<div class="pf-btns"><a class="btn btn-secondaire" href="' + lienClient(c) + '">Ouvrir la fiche client</a><button type="button" class="btn-texte" data-act="retirer-client">Retirer ce client</button></div></div>' + rech;
    }
    return rech + '<p class="vide-bloc cl-aide">Aucun client choisi : les fiches montrent les conditions et le nombre de clients concernés. Choisissez un client pour voir s\'il est éligible à chaque produit, avec la justification.</p>';
  }
  function suggestions() {
    var z = document.getElementById("cl-res"), s = document.getElementById("cl-statut"), q = etat.q.trim();
    if (q.length < 2) { z.hidden = true; z.innerHTML = ""; s.textContent = ""; return; }
    var r = RECH.chercher(tous(), q, 8);
    z.innerHTML = r.length ? r.map(function (c) { return '<li><button type="button" data-act="choisir-client" data-id="' + c.id + '"><span class="rech-nom">' + esc(nomListe(c)) + '</span><span class="rech-sous">' + c.age + " ans – " + esc(c.pro.prof) + " – " + esc(c.num) + "</span></button></li>"; }).join("") : '<li class="rech-vide">Aucun client ne correspond à « ' + esc(q) + " ».</li>";
    s.textContent = r.length ? pl(r.length, "résultat", "résultats") : "Aucun résultat";
    z.hidden = false;
  }

  /* ---------- grille des produits ---------- */
  function carte(p, parPertinence) {
    var st = store(), n = K.compterProduit(CL, p.id, st), ev = verdict(p.id), actif = etat.prod === p.id, comp = etat.comp.indexOf(p.id) >= 0;
    return '<li class="cat-carte' + (actif ? " cat-actif" : "") + '"><div class="cat-illu">' + ILL.svg(p.id, p.famille) + '</div><div class="cat-corps">' + (parPertinence ? '<p class="cat-fam">' + esc(PR.universDe(p).nom) + "</p>" : PR.universDe(p).familles.length > 1 ? '<p class="cat-fam">' + esc(FAM[p.famille].nom) + "</p>" : "") + '<h4>' + esc(p.nom) + '</h4><p class="cat-accroche">' + esc(p.accroche) + "</p>" +
      '<dl class="cat-faits"><div><dt>Coût</dt><dd>' + esc(p.cmp.cout) + "</dd></div><div><dt>Minimum</dt><dd>" + esc(p.cmp.ticket) + "</dd></div></dl>" +
      '<p class="cat-nb">' + pl(n.eligible, "client éligible", "clients éligibles") + " sur " + CL.length + "</p>" +
      (ev ? '<p class="cat-verdict">' + chip(ev) + "</p>" : "") +
      '<div class="cat-actions"><button type="button" class="btn btn-secondaire" data-act="voir" data-id="' + p.id + '" aria-label="Voir la fiche : ' + esc(p.nom) + '">Voir la fiche</button>' +
      '<button type="button" class="btn btn-principal" data-act="souscrire-ouvrir" data-id="' + p.id + '" aria-label="Souscrire : ' + esc(p.nom) + '">Souscrire</button></div>' +
      '<label class="cat-comp"><input type="checkbox" data-comp="' + p.id + '"' + (comp ? " checked" : "") + '> Comparer<span class="sr"> : ' + esc(p.nom) + "</span></label></div></li>";
  }
  var VERDICTS_FILTRE = [["tous", "Tous"], ["eligible", "Éligibles"], ["examiner", "À examiner"], ["detenu", "Déjà détenus"], ["non", "Non éligibles"]];
  /* Produits affichés : univers choisi, recherche (mêmes mots-clés que la recherche du poste, du plus pertinent au moins pertinent) et, si un client est choisi, sa situation. */
  function produitsAffiches() {
    var q = etat.pq.trim(), c = client(), l = PR.produits;
    if (q.length >= 2) l = RECH.chercherProduits(q, PR.produits.length).map(function (r) { return r.x; });
    return l.filter(function (p) {
      if (etat.fam !== "tous" && PR.universDe(p).id !== etat.fam) return false;
      if (c && etat.vf !== "tous" && K.verdictClient(c, p.id, store()).verdict !== etat.vf) return false;
      return true;
    });
  }
  function grilleHtml() {
    var c = client(), st = store();
    if (!c) etat.vf = "tous";
    var chips = '<button type="button" class="filtre" aria-pressed="' + (etat.fam === "tous") + '" data-act="fam" data-id="tous">Tous (' + PR.produits.length + ")</button>" +
      PR.univers.map(function (u) { return '<button type="button" class="filtre" aria-pressed="' + (etat.fam === u.id) + '" data-act="fam" data-id="' + u.id + '">' + esc(u.nom) + " (" + PR.produits.filter(function (p) { return PR.universDe(p) === u; }).length + ")</button>"; }).join("");
    var h = '<div class="filtres" role="group" aria-label="Choisir un univers de produits">' + chips + "</div>";
    if (c) {
      var n = K.compterClient(c, st);
      h += '<div class="filtres filtres-client" role="group" aria-label="Situation de ' + esc(nomFull(c)) + ' face aux produits"><span class="filtres-lib">Situation du client :</span>' + VERDICTS_FILTRE.map(function (v) {
        return '<button type="button" class="filtre filtre-petit" aria-pressed="' + (etat.vf === v[0]) + '" data-act="vf" data-id="' + v[0] + '">' + v[1] + " (" + (v[0] === "tous" ? PR.produits.length : n[v[0]]) + ")</button>";
      }).join("") + "</div>";
    }
    var l = produitsAffiches();
    etat.nbAff = l.length;
    if (!l.length) return h + '<div class="cat-vide" tabindex="-1" id="cat-vide"><p><strong>Aucun produit ne correspond' + (etat.pq.trim() ? " à « " + esc(etat.pq.trim()) + " »" : "") + ".</strong> " + (etat.fam !== "tous" || etat.vf !== "tous" ? "Un filtre est actif : retirez-le pour élargir la liste." : "Essayez un mot plus court ou le nom de la famille (livret, carte, assurance, crédit).") + '</p><div class="pf-btns">' +
      (etat.pq.trim() ? '<button type="button" class="btn btn-secondaire" data-act="pq-effacer">Effacer la recherche</button>' : "") + (etat.fam !== "tous" || etat.vf !== "tous" ? '<button type="button" class="btn btn-secondaire" data-act="filtres-effacer">Afficher tous les produits</button>' : "") + "</div></div>";
    /* recherche en cours : les produits restent classés du plus pertinent au moins pertinent (l'univers est rappelé sur chaque carte) */
    if (etat.pq.trim().length >= 2) return h + '<p class="cat-univers-sous">Résultats classés du plus pertinent au moins pertinent.</p><ul class="cat-grille">' + l.map(function (p) { return carte(p, true); }).join("") + "</ul>";
    /* sinon, produits rangés par univers : un titre (nom, nombre de produits, ce qu'on y trouve) puis les cartes */
    return h + PR.univers.map(function (u) {
      var lu = l.filter(function (p) { return PR.universDe(p) === u; }); if (!lu.length) return "";
      var tot = PR.produits.filter(function (p) { return PR.universDe(p) === u; }).length;
      return '<section class="cat-univers" aria-labelledby="u-' + u.id + '"><div class="cat-univers-tete"><h3 id="u-' + u.id + '">' + esc(u.nom) + '</h3><span class="cat-univers-nb">' + pl(lu.length, "produit", "produits") + (lu.length !== tot ? " sur " + tot : "") + '</span></div>' +
        '<p class="cat-univers-sous">' + esc(u.sous) + '</p><ul class="cat-grille">' + lu.map(function (p) { return carte(p, false); }).join("") + "</ul></section>";
    }).join("");
  }
  function statutGrille() {
    var z = document.getElementById("pr-statut");
    if (z) z.textContent = etat.nbAff === PR.produits.length ? PR.produits.length + " produits" : pl(etat.nbAff, "produit affiché", "produits affichés") + " sur " + PR.produits.length;
  }

  /* ---------- comparateur ---------- */
  function tableComp(cmp) {
    return '<div class="tab-wrap"><table class="tab-ventes tab-cat"><caption class="sr">Comparaison de ' + cmp.produits.map(function (p) { return esc(p.nom); }).join(", ") + '</caption><thead><tr><th scope="col">Critère</th>' + cmp.produits.map(function (p) { return '<th scope="col">' + esc(p.nom) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      cmp.lignes.map(function (l) { return '<tr><th scope="row">' + esc(l.lib) + "</th>" + l.vals.map(function (v, i) { return '<td data-label="' + esc(cmp.produits[i].nom) + '">' + esc(v) + "</td>"; }).join("") + "</tr>"; }).join("") +
      "</tbody></table></div>";
  }
  function compHtml() {
    if (!etat.comp.length) return "";
    var cmp = K.comparer(etat.comp), h = '<section class="bloc" id="bloc-comp" aria-labelledby="t-comp"><div class="bloc-tete"><h2 id="t-comp">Comparer des produits</h2><span class="sous">' + pl(etat.comp.length, "produit choisi", "produits choisis") + " sur 3 au maximum</span></div>";
    h += '<div class="pf-puces-zone">' + etat.comp.map(function (id) { return '<span class="cat-pastille">' + esc(PR.parId[id].nom) + '<button type="button" class="pf-x" data-act="ret-comp" data-id="' + id + '" aria-label="Retirer de la comparaison : ' + esc(PR.parId[id].nom) + '"><span aria-hidden="true">×</span></button></span>'; }).join("") + '<button type="button" class="btn-texte" data-act="vider-comp">Tout retirer</button></div>';
    h += '<p class="msg-erreur" id="comp-msg" role="status">' + esc(etat.msgComp) + "</p>";
    if (etat.comp.length < 2) return h + '<p class="vide-bloc">Cochez « Comparer » sur un deuxième produit (et un troisième si vous le souhaitez) pour afficher le tableau.</p></section>';
    return h + tableComp(cmp) + '<div class="actions-impr"><button type="button" class="btn btn-secondaire btn-impr" data-act="imprimer-comp">' + ICO.imprimante + "<span>Imprimer ou enregistrer en PDF la comparaison</span></button></div>" +
      '<p class="note-pied">Les taux et plafonds réglementés sont fixés par la loi ; les autres tarifs sont ceux de la banque.</p></section>';
  }

  /* ---------- éligibilité : justification ---------- */
  function verifHtml(ev) {
    var h = '<ul class="verif-liste">' + ev.verifiees.map(function (l) {
      var cls = l.ok === true ? "v-ok" : l.ok === false ? "v-ko" : l.info ? "v-info" : "v-doute", ico = l.ok === true ? "✔" : l.ok === false ? "✖" : l.info ? "i" : "?";
      var sr = l.ok === true ? "Condition remplie : " : l.ok === false ? "Condition non remplie : " : l.info ? "Information : " : "À examiner : ";
      return '<li class="' + cls + '"><span class="v-ico" aria-hidden="true">' + ico + '</span><div><strong><span class="sr">' + sr + "</span>" + esc(l.lib) + "</strong><span>" + esc(l.detail) + "</span></div></li>";
    }).join("") + "</ul>";
    if (ev.aVerifier.length) h += '<h4>À vérifier avec le client</h4><ul class="dp-liste verif-av">' + ev.aVerifier.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>";
    return h;
  }
  function verdictBloc(c, ev) {
    var s = ev.souscription;
    var phr = s ? "Souscrit le " + B.fmtDate(B.lireYmd(s.date)) + (s.montant != null ? (PR.parId[s.p] && PR.parId[s.p].famille === "credit" ? " (capital emprunté de " : " (versement initial de ") + B.eur(s.montant) + ")" : "") + "." : K.phrase(ev);
    return '<div class="verif verif-' + ev.verdict + '"><p class="verif-verdict">' + chip(ev) + " <span>" + esc(phr) + "</span></p>" + verifHtml(ev) + "</div>";
  }

  /* ---------- souscription ---------- */
  /* Aide sous le choix du moyen : rappelle que le bilan compte les ventes par moyen, et prévient si aucun contact n'est enregistré par ce moyen pour ce client. */
  function canalAide(c) {
    var t = "Le bilan compte les contrats selon ce moyen." + (etat.canal ? " Contrat : " + (CT.aDistance(etat.canal) ? "envoyé au client pour signature électronique (vente à distance)." : "imprimé et signé par le client en agence (face à face).") : "");
    if (etat.canal && c && !K.contactParMoyen(store(), c.id, etat.canal)) t += " Attention : aucun contact par ce moyen n'est enregistré pour ce client (" + { mail: "aucun e-mail envoyé dans la messagerie", appel: "aucun appel abouti dans « Phoning et prospection »", rdv: "aucun rendez-vous noté dans « Compte Rendu d'Entretien (CRE) »", accueil: "aucun contact à l'accueil noté dans « Compte Rendu d'Entretien (CRE) »" }[etat.canal] + ") : enregistrez-le pour que le bilan soit juste.";
    return esc(t);
  }
  /* Prochaine étape du contrat, juste après la souscription. */
  function suiteContratHtml(id) {
    var s = K.souscriptions(store()).filter(function (x) { return x.id === id; })[0];
    if (!s || !CT.etat(s)) return "";
    var ct = CT.contrat(s), consigne = ct.mode === "esign" ? "La vente s'est faite à distance : le contrat s'envoie au client pour signature électronique." : "La vente s'est faite en face à face : le contrat se génère (impression) et le client le signe devant vous.";
    return '<div class="ct-suite"><p><strong>' + esc(ct.doc) + "</strong> – réf. " + esc(ct.ref) + ". " + esc(consigne) + '</p><div class="ct-etat">' + UC.statutHtml(s) + '</div><div class="ct-actions">' + UC.boutonsHtml(s) + "</div></div>";
  }
  /* Rapports de conseil à jour pour ce client et ce produit boursier. */
  function rapportsPour(c, p) { return M.rapportsUtilisables(store(), c.id, p.id, B.aujourdhui()).slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : a.heure < b.heure ? 1 : -1; }); }
  function rapportChoisi(c, p) { var l = rapportsPour(c, p), r = l.filter(function (x) { return x.id === etat.rapport; })[0] || l[0] || null; etat.rapport = r ? r.id : ""; return r; }
  function e2(n) { return Math.abs(n - Math.round(n)) < 1e-9 ? B.eur(n) : B.eur2(n); }
  /* Champs propres au produit (durée, formule, enfant, fonds…) et prime estimée avec les choix déjà faits. */
  /* Vente en face à face (rendez-vous ou accueil) : vérification d'identité ; carte remise (ou incluse dans une convention) : mode de remise. Dépend du moyen choisi. */
  function accueilHtml(p, c) {
    var st = store(), h = "", canal = etat.canal;
    if (K.presentiel(canal)) {
      h += '<fieldset class="pf-source souscr-ident"><legend>Vérification d\'identité</legend><div class="champ"><label for="s-idverif">L\'identité du client a-t-elle été vérifiée ? *</label><select id="s-idverif" data-acc="idv" aria-describedby="s-idverif-aide"><option value="">Répondre</option>' +
        '<option value="oui"' + (etat.idv === "oui" ? " selected" : "") + '>Oui – pièce d\'identité contrôlée</option><option value="non"' + (etat.idv === "non" ? " selected" : "") + '>Non – pas encore</option></select><span class="aide-champ" id="s-idverif-aide">' +
        (etat.idv === "non" ? "Sans contrôle d'identité, la vente est impossible : demandez une pièce officielle en cours de validité avec photographie, comparez la photographie et la signature." : "Pièce officielle en cours de validité avec photographie ; la photographie et la signature sont comparées au client.") + "</span></div>";
      if (etat.idv === "oui") h += '<div class="champ"><label for="s-idpiece">Pièce d\'identité présentée *</label><select id="s-idpiece" data-acc="idp"><option value="">Choisir la pièce</option>' + K.PIECES_ID.map(function (x) { return '<option value="' + x.v + '"' + (etat.idp === x.v ? " selected" : "") + ">" + esc(x.lib) + "</option>"; }).join("") + "</select></div>";
      h += "</fieldset>";
    }
    var carte = K.carteLivree(st, c, p.id);
    if (carte) {
      var rc = K.remisesCarte(st, carte, canal);
      if (etat.rem && !rc.some(function (x) { return x.v === etat.rem; })) etat.rem = "";      /* le mode choisi n'est plus proposé (autre carte) */
      var nomCarte = PR.parId[carte].nom, aide = "La carte est toujours commandée (fabriquée) : le client la retire à l'agence ou la reçoit à domicile en recommandé.";
      h += '<div class="champ"><label for="s-remise">Remise de la carte ' + (p.famille === "carte" ? "" : "incluse dans la convention ") + "(" + esc(nomCarte) + ') *</label><select id="s-remise" data-acc="rem" aria-describedby="s-remise-aide"><option value="">Choisir le mode de remise</option>' + rc.map(function (x) { return '<option value="' + x.v + '"' + (etat.rem === x.v ? " selected" : "") + ">" + esc(x.lib) + "</option>"; }).join("") + '</select><span class="aide-champ" id="s-remise-aide">' + esc(aide) + "</span></div>";
    }
    return h;
  }
  function optionsHtml(p, c) {
    var d = K.descripteurs(p.id, c, store());
    if (!d.length) return "";
    var h = d.map(function (x) {
      return '<div class="champ"><label for="s-opt-' + x.k + '">' + esc(x.lib) + ' *</label><select id="s-opt-' + x.k + '" data-opt="' + x.k + '"><option value="">Choisir</option>' + x.choix.map(function (y) { return '<option value="' + esc(y.v) + '"' + (etat.opt[x.k] === y.v ? " selected" : "") + ">" + esc(y.lib) + "</option>"; }).join("") + "</select></div>";
    }).join("");
    var pr = K.primeEstimee(p.id, c, etat.opt, store());
    if (pr && p.famille === "mobile") h += '<p class="aide-champ souscr-prime" id="s-prime"><strong>' + (pr.unique !== null ? "Prix : " + esc(e2(pr.unique)) + ", payé une seule fois" : "Mensualité : " + esc(e2(pr.mois)) + " par mois (" + esc(e2(pr.an)) + " par an)") + "</strong>" + (pr.remise ? ", remise box de " + esc(e2(pr.remise)) + " par mois déduite" : "") + ". Tarif de l'offre, fixé à la souscription.</p>";
    else if (pr) h += '<p class="aide-champ souscr-prime" id="s-prime"><strong>' + (etat.opt.mode === "unique" && pr.unique ? "Versement unique : " + esc(e2(pr.unique)) : "Cotisation : " + esc(e2(pr.mois)) + " par mois (" + esc(e2(pr.an)) + " par an)") + "</strong> pour un client de " + c.age + " ans. Tarif de la banque, fixé à la souscription.</p>";
    if (p.id === "CAT" && etat.opt.duree && etat.montant) {
      var m = K.lireMontant(etat.montant);
      if (!isNaN(m)) h += '<p class="aide-champ souscr-prime" id="s-prime"><strong>Intérêts bruts à l\'échéance : ' + esc(e2(Math.round(m * PR.catTaux[+etat.opt.duree] / 100 * (+etat.opt.duree) / 12 * 100) / 100)) + "</strong> pour " + esc(e2(m)) + " placés à " + String(PR.catTaux[+etat.opt.duree]).replace(".", ",") + " % pendant " + etat.opt.duree + " mois (avant prélèvement forfaitaire unique).</p>";
    }
    return h;
  }
  /* ---------- panier de services d'une convention (souscription) ---------- */
  function panierHtml(p, c) {
    if (!p.convention) return "";
    if (!Array.isArray(etat.opt.services)) etat.opt.services = [];
    return PUI.html(p.convention, c, etat.opt.services, "s");
  }
  function majPanier() {
    var c = client(), p = PR.parId[etat.prod];
    if (!document.getElementById("s-panier") || !c || !p || !p.convention) return;
    etat.opt.services = PUI.maj(p.convention, c, etat.opt.services, "s");
  }
  function souscrirePanneau(p) {
    var c = client(), st = store();
    if (etat.msgSous && etat.msgSous.p === p.id) {
      var m = etat.msgSous;
      return '<div class="souscr souscr-ok" role="status" tabindex="-1" id="souscr-ok"><p><strong>Souscription enregistrée</strong> : ' + esc(p.nom) + " pour " + esc(nomFull(qui(m.c))) + (m.montant != null ? (p.id === "AUTZ" ? ", versement programmé de " : ", versement initial de ") + esc(e2(m.montant)) : "") + " (" + esc(K.MOYENS[m.canal].toLowerCase()) + ").</p>" + (m.cotisation ? "<p>" + (p.famille === "mobile" ? "Mensualité" : "Cotisation") + " : <strong>" + esc(e2(m.cotisation)) + " par mois</strong>.</p>" : "") + (m.prixUnique ? "<p>Prix : <strong>" + esc(e2(m.prixUnique)) + "</strong>, payé une seule fois.</p>" : "") + (m.carte ? "<p>La carte incluse dans la convention est souscrite en même temps : <strong>" + esc(PR.parId[m.carte].nom) + "</strong>.</p>" : "") + (m.economie ? "<p>Services pris par le client : <strong>" + m.services.map(function (k) { return esc(p.convention.services.filter(function (x) { return x.k === k; })[0].lib); }).join(", ") + "</strong>. Tenue de compte exonérée. " + (m.economie.economie > 0 ? "Réduction obtenue : <strong>" + esc(e2(m.economie.economie)) + " par an</strong> (" + m.economie.pct + " % de moins qu'à l'unité)." : "Aucune réduction : ces services coûtent moins cher à l'unité.") + "</p>" : "") +
        "<p>Daté du " + esc(B.fmtLong(B.lireYmd(m.date))) + (m.ferme ? " : c'est le dernier jour ouvré, car la banque est fermée aujourd'hui (week-end ou jour férié)" : "") + '. Elle est conservée dans ce navigateur et apparaît dans « Mes souscriptions » et dans la fiche du client.</p>' + suiteContratHtml(m.id) +
        '<div class="pf-btns"><a class="btn btn-secondaire" href="' + lienClient(qui(m.c)) + '">Ouvrir la fiche client</a><a class="btn btn-secondaire" href="agenda.html?client=' + m.c + '">Planifier un suivi dans l\'agenda</a></div></div>';
    }
    if (!etat.sous) return "";
    if (!c) return '<div class="souscr souscr-info" role="status" tabindex="-1" id="souscr-info"><p><strong>Choisissez d\'abord le client</strong> qui souscrit : la souscription n\'est possible que pour un client éligible.</p><button type="button" class="btn btn-secondaire" data-act="aller-client">Choisir un client</button></div>';
    var ev = K.verdictClient(c, p.id, st), pos = K.possibilite(ev, p);
    var tete = '<h3 id="t-souscrire" tabindex="-1">Souscrire pour ' + esc(nomFull(c)) + "</h3>";
    if (!pos.ok) {
      var motif = pos.raison === "credit" ? "Un crédit ne se souscrit pas en une étape : il se monte (besoin, capacité d'emprunt, garanties, offre). Cette étape se fait dans l'outil « Montage de prêt »."
        : pos.raison === "fiche" ? (p.motifFiche || "Ce produit n'est pas souscrit dans l'outil : la fiche et l'éligibilité servent à le présenter au client, et sa mise en place passe par un contrat de crédit signé avec lui.")
        : pos.raison === "detenu" ? "Le client détient déjà ce produit : il n'y a rien à souscrire." : "Le client n'est pas éligible : la souscription est impossible.";
      return '<div class="souscr souscr-ko" role="status" tabindex="-1" id="souscr-ko">' + tete + "<p>" + esc(motif) + "</p>" + (pos.raison === "credit" ? "" : verdictBloc(c, ev)) + '<div class="pf-btns">' + (pos.raison === "credit" ? '<a class="btn btn-principal" href="montage.html?produit=' + p.id + "&amp;client=" + c.id + '">Monter ce crédit</a>' : "") + '<button type="button" class="btn btn-secondaire" data-act="annuler-souscrire">Fermer</button></div></div>';
    }
    var rap = null;
    if (M.estBoursier(p.id)) {
      rap = rapportChoisi(c, p);
      if (!rap) {
        var tous = M.rapports(st).filter(function (r) { return r.c === c.id && r.p === p.id && !M.utilise(st, r.id); }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : a.heure < b.heure ? 1 : -1; });
        var der = tous[0], ut = der ? M.utilisable(st, der, c.id, p.id, B.aujourdhui()) : null;
        var expl = !der ? "Aucun rapport de conseil n'existe pour ce client et ce produit."
          : ut.raison === "non_dispo" ? "Le rapport de conseil du " + B.fmtDate(B.lireYmd(der.date)) + " n'est pas encore mis à disposition du client."
          : ut.raison === "perime" ? "Le dernier rapport de conseil date du " + B.fmtDate(B.lireYmd(der.date)) + " : il a plus de " + M.VALIDITE_RAPPORT + " jours."
          : ut.raison === "non_adapte" ? "Le dernier rapport de conseil conclut que ce contrat n'est pas adapté au profil du client."
          : "Aucun rapport de conseil utilisable pour ce produit.";
        return '<div class="souscr souscr-ko" role="status" tabindex="-1" id="souscr-ko">' + tete + "<p><strong>Questionnaire profil investisseur (MIFID) obligatoire avant la souscription.</strong> " + esc(expl) + " Un produit boursier peut faire perdre du capital : le client répond au questionnaire, vous lui remettez le rapport de conseil, puis vous souscrivez.</p>" +
          '<div class="pf-btns"><a class="btn btn-principal" href="mifid.html?client=' + c.id + "&amp;produit=" + p.id + '">Remplir le questionnaire profil investisseur</a>' + (der && !der.dispo ? '<a class="btn btn-secondaire" href="mifid.html?rapport=' + esc(der.id) + '">Ouvrir le rapport en attente</a>' : "") + '<button type="button" class="btn-texte" data-act="annuler-souscrire">Annuler</button></div></div>';
      }
      etat.canal = rap.canal; if (!etat.montant) etat.montant = String(rap.montant).replace(".", ",");
    }
    var conf = pos.confirmations.map(function (t, i) {
      return '<label class="pf-radio souscr-conf"><input type="checkbox" data-conf="' + i + '"' + (etat.coches[i] ? " checked" : "") + "><span>" + esc(t) + "</span></label>";
    }).join("");
    var sq = pos.sante && SU ? SU.html("sq", pos.sante, etat.sante, { motifs: true }) : "";   /* questionnaire de santé : à remplir avec le client, sans trace des réponses */
    var bfh = pos.clause && BU ? BU.html(p.id, c, etat.clause) : "";   /* clause bénéficiaire : rédigée avec le client d'après son dossier */
    var mt = "";
    if (pos.montant) {
      var libM = K.LIB_MONTANT[p.id] || "Versement initial en euros", mini = p.id === "AUTZ" && etat.opt.periodicite === "trimestriel" ? 90 : pos.montant.min;
      mt = '<div class="champ"><label for="s-montant">' + esc(libM) + ' *</label><input id="s-montant" inputmode="decimal" autocomplete="off" maxlength="12" value="' + esc(etat.montant) + '" aria-describedby="s-aide"><span class="aide-champ" id="s-aide">Au moins ' + e2(mini) + (pos.montant.max ? (p.id === "PEAJ" || p.id === "PEAPME" ? " ; plafond de versements : " : " ; plafond de dépôts : ") + e2(pos.montant.max) : "") + (p.id === "PSOC" ? ". Un nombre entier de parts : 114 € pour 10 parts." : ". Exemple : 500 ou 250,50.") + "</span></div>";
    }
    var canalChamp;
    if (rap) {
      canalChamp = '<div class="champ"><label for="s-rapport">Rapport de conseil (profil investisseur) *</label><select id="s-rapport" aria-describedby="s-rapport-aide">' + rapportsPour(c, p).map(function (r) {
        return '<option value="' + esc(r.id) + '"' + (r.id === rap.id ? " selected" : "") + ">Rapport du " + esc(B.fmtDate(B.lireYmd(r.date))) + " à " + esc(r.heure.replace(":", " h ")) + " – " + esc(K.MOYENS[r.canal]) + " – montant annoncé " + esc(B.eur(r.montant)) + "</option>";
      }).join("") + '</select><span class="aide-champ" id="s-rapport-aide">Le rapport est à jour (valable ' + M.VALIDITE_RAPPORT + " jours) et mis à disposition du client. La vente se fait par le même moyen que le conseil : " + esc(K.MOYENS[rap.canal].toLowerCase()) + ". Le versement ne peut pas dépasser " + esc(B.eur(rap.montant)) + " (montant du questionnaire). Contrat : " + (CT.aDistance(rap.canal) ? "envoyé pour signature électronique." : "imprimé et signé en agence.") + "</span></div>";
    } else canalChamp = '<div class="champ"><label for="s-canal">Moyen par lequel la vente a été réalisée *</label><select id="s-canal" aria-describedby="s-canal-aide"><option value="">Choisir un moyen</option>' + K.ORDRE_MOYENS.map(function (k) { return '<option value="' + k + '"' + (etat.canal === k ? " selected" : "") + ">" + esc(K.MOYENS[k]) + "</option>"; }).join("") + '</select><span class="aide-champ" id="s-canal-aide">' + canalAide(c) + "</span></div>";
    return '<form class="souscr souscr-form formulaire" id="form-souscrire" novalidate>' + tete + '<p class="verif-verdict">' + chip(ev) + " <span>" + esc(K.phrase(ev)) + "</span></p>" +
      '<fieldset class="pf-source"><legend>Points à vérifier avec le client : cochez chacun quand c\'est fait</legend>' + (conf || "<p>Aucun point particulier à vérifier.</p>") + "</fieldset>" + sq + bfh + '<div id="s-options">' + optionsHtml(p, c) + '</div>' + panierHtml(p, c) + mt +
      canalChamp + '<div id="s-acc">' + accueilHtml(p, c) + '</div>' +
      '<div class="champ"><label for="s-note">Remarque <span class="aide-champ">(facultatif)</span></label><textarea id="s-note" maxlength="300" style="min-height:70px" placeholder="Exemple : souhaite ouvrir le livret pour un voyage">' + esc(etat.note) + "</textarea></div>" +
      '<p class="msg-erreur" id="s-err" role="alert">' + esc(etat.err) + '</p><div class="pf-btns"><button type="submit" class="btn btn-principal">Confirmer la souscription</button><button type="button" class="btn btn-secondaire" data-act="annuler-souscrire">Annuler</button></div>' +
      '<p class="mention">La souscription est enregistrée dans ce navigateur, pas dans le dossier de la banque : les autres chiffres du portefeuille ne changent pas.</p></form>';
  }

  /* ---------- fiche produit ---------- */
  function liste(l) { return '<ul class="dp-liste cat-liste">' + l.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>"; }
  function tableTarifs(p) {
    return '<div class="tab-wrap"><table class="tab-ventes tab-cat tab-tarifs"><caption class="sr">Tarifs : ' + esc(p.nom) + '</caption><thead><tr><th scope="col">Poste</th><th scope="col">Tarif</th><th scope="col">Nature</th></tr></thead><tbody>' +
      p.tarifs.map(function (t) { var n = K.natureTarif(p, t); return '<tr><th scope="row">' + esc(t.lib) + '</th><td data-label="Tarif">' + esc(t.val) + '</td><td data-label="Nature"><span class="nature nature-' + n + '">' + K.NATURES[n] + "</span></td></tr>"; }).join("") + "</tbody></table></div>";
  }
  function eligPortefeuille(p) {
    var st = store(), n = K.compterProduit(CL, p.id, st), tot = CL.length;
    function t(lib, v, cls) { return '<div class="kpi ' + cls + '"><dt>' + lib + '</dt><dd class="val">' + B.nb(v) + '</dd><dd class="det">' + B.pct(Math.round(1000 * v / tot) / 10) + " du portefeuille</dd></div>"; }
    return '<dl class="kpis cat-kpis">' + t("Éligibles", n.eligible, "") + t("À examiner", n.examiner, "") + t("Non éligibles", n.non, "") + t("Déjà détenu", n.detenu, "") + "</dl>" +
      '<p><a class="btn btn-secondaire" href="portefeuille.html?produit=' + p.id + '&amp;situation=eligible">Voir les ' + pl(n.eligible, "client éligible", "clients éligibles") + " dans le portefeuille</a></p>" +
      '<p class="note-pied">Éligible : toutes les conditions vérifiables dans le dossier sont remplies et le client ne détient pas déjà le produit. À examiner : aucune condition n\'est refusée mais une ne peut pas être tranchée sans le client. Les conditions qui ne se vérifient pas dans un dossier (pièces, fichiers, questionnaires, dépôt minimum) restent « à vérifier avec le client ».</p>';
  }
  /* ---------- niveau de risque et DICI (placements.js, risque.js : même source que le PDF et le rapport de conseil) ---------- */
  function compoTexte(compo) { return Object.keys(compo).sort(function (a, b) { return compo[b] - compo[a]; }).map(function (k) { return String(compo[k]).replace(".", ",") + " % " + R.CLASSES[k].lib.toLowerCase(); }).join(", "); }
  function lignesRisque(p) {
    var d = PL.P[p.id], g = PL.plage(p.id);
    if (!d) return null;
    var lignes = PL.supports(p.id).map(function (x) { return { nom: x.nom, compo: compoTexte(x.compo), sri: x.sri, niveau: R.NOMS_NIVEAU[x.risque] }; });
    return { g: g, lignes: lignes, gamme: d.gamme && d.gamme.length ? d.gamme : null };
  }
  function risqueHtml(p) {
    var r = lignesRisque(p);
    if (!r) return "";
    var h = "<h3>Niveau de risque</h3>" +
      "<p><strong>Indicateur de risque du produit : " + esc(R.libelleFiche(r.g.min, r.g.max, r.lignes.length > 1 || r.gamme ? "selon les supports" : "")) + ".</strong> " + esc(R.texteIndicateur(r.g.min, r.g.max)) + "</p>" +
      '<p class="note-pied">Ce niveau est celui du produit : il est calculé d\'après sa composition (part de fonds en euros, d\'obligations, d\'actions…) et ne dépend jamais des réponses du client au questionnaire. Le questionnaire donne le profil du client ; le conseil compare ensuite ce profil au niveau de risque du support.</p>' +
      '<div class="tab-wrap"><table class="tab-ventes tab-cat tab-risque"><caption class="sr">Supports de ' + esc(p.nom) + ' et leur niveau de risque</caption><thead><tr><th scope="col">Support</th><th scope="col">Composition</th><th scope="col">Indicateur de risque</th><th scope="col">Niveau de conseil</th></tr></thead><tbody>' +
      r.lignes.map(function (l) { return '<tr><th scope="row">' + esc(l.nom) + '</th><td data-label="Composition">' + esc(l.compo) + '</td><td data-label="Indicateur de risque">' + l.sri + ' sur 7</td><td data-label="Niveau de conseil">' + esc(l.niveau) + "</td></tr>"; }).join("") + "</tbody></table></div>";
    if (r.gamme) h += '<p class="note-pied">En gestion libre, le client peut aussi choisir parmi une gamme de supports d\'indicateurs de risque compris entre ' + r.g.min + " et " + r.g.max + " sur 7 (voir le DICI).</p>";
    if (p.dici) h += '<p class="cat-dici"><a class="btn btn-secondaire" href="' + esc(p.dici) + '" target="_blank" rel="noopener" download>Télécharger le document d\'informations clés (DICI, PDF)</a></p>';
    return h;
  }
  /* Résultat du simulateur : deux barres (services à l'unité / convention) et la réduction obtenue. */
  function conventionHtml(p) {
    var cv = p.convention;
    if (!cv) return "";
    var compte = cv.comptes.indexOf("CPT") >= 0 ? "CPT" : "JEUNE", libCompte = cv.mineur ? "" : " avec un compte Équilibre";
    var h = '<h3>Services inclus et économie</h3><div class="tab-wrap"><table class="tab-ventes tab-cat tab-conv"><caption class="sr">Services de ' + esc(p.nom) + '</caption><thead><tr><th scope="col">Service inclus</th><th scope="col">Prix à l\'unité, par an</th><th scope="col">Dans la convention</th></tr></thead><tbody>' +
      cv.services.map(function (x) { return '<tr><th scope="row">' + esc(x.lib) + '</th><td data-label="Prix à l\'unité, par an">' + esc(e2(x.valeur)) + " (" + esc(x.unite) + ')</td><td data-label="Dans la convention"><span class="conv-inclus">Inclus – ' + esc(e2(x.valeur)) + " de réduction</span></td></tr>"; }).join("") + "</tbody>" +
      '<tfoot><tr><th scope="row">' + (cv.mineur ? "Total à l\'unité" : "Total à l\'unité, avec un compte Équilibre") + '</th><td colspan="2">' + esc(e2(cv.avec.CPT)) + "</td></tr>" + (cv.avec.JEUNE != null ? '<tr><th scope="row">Total à l\'unité, avec le compte Jeune (tenue gratuite)</th><td colspan="2">' + esc(e2(cv.avec.JEUNE)) + "</td></tr>" : "") +
      '<tr><th scope="row">Avec la convention</th><td colspan="2">' + esc(e2(cv.cotisationAn)) + " par an (" + esc(e2(cv.cotisationMois)) + " par mois)</td></tr></tfoot></table></div>" +
      '<p class="note-pied">Économie : ' + esc(e2(Math.round((cv.avec.CPT - cv.cotisationAn) * 100) / 100)) + " par an" + esc(libCompte) + (cv.avec.JEUNE != null ? ", " + esc(e2(Math.round((cv.avec.JEUNE - cv.cotisationAn) * 100) / 100)) + " par an avec le compte Jeune" : "") + ". La convention vaut pour un client qui utilise réellement ces services.</p>" +
      '<div class="conv-sim" id="conv-sim" data-conv="' + esc(p.id) + '"><h3>Combien le client économise-t-il ?</h3><p class="note-pied">Cochez les services que le client utilisera vraiment : <strong>plus il en prend, plus la réduction augmente</strong>. Les frais de tenue de compte sont toujours exonérés.</p>' +
      '<fieldset class="conv-svc"><legend class="sr">Services utilisés par le client</legend>' +
      cv.services.filter(function (x) { return x.k !== "tenue"; }).map(function (x) { return '<label class="conv-case"><input type="checkbox" data-conv-svc="' + esc(x.k) + '" checked><span class="conv-nom">' + esc(x.lib) + '</span><span class="conv-prix">' + esc(e2(x.valeur)) + " à l\'unité</span></label>"; }).join("") + "</fieldset>" +
      '<div id="conv-res" role="status" aria-live="polite">' + PUI.resultat(cv, cv.services.map(function (x) { return x.k; }), compte) + "</div></div>";
    return h;
  }
  function majConvSim() {
    var z = document.getElementById("conv-sim"), r = document.getElementById("conv-res"), p = z && PR.parId[z.getAttribute("data-conv")];
    if (!z || !r || !p || !p.convention) return;
    var cv = p.convention, u = [];
    z.querySelectorAll("[data-conv-svc]").forEach(function (i) { if (i.checked) u.push(i.getAttribute("data-conv-svc")); });
    r.innerHTML = PUI.resultat(cv, u, cv.comptes.indexOf("CPT") >= 0 ? "CPT" : "JEUNE");
  }
  function ficheHtml() {
    var p = etat.prod ? PR.parId[etat.prod] : null;
    if (!p) return "";
    var c = client(), ev = c ? K.verdictClient(c, p.id, store()) : null;
    var h = '<section class="bloc" id="bloc-fiche" aria-labelledby="t-fiche"><div class="fiche-tete"><div class="fiche-illu">' + ILL.svg(p.id, p.famille) + '</div><div class="fiche-id"><p class="cat-fam">' + esc(FAM[p.famille].nom) + '</p><h2 id="t-fiche" tabindex="-1">' + esc(p.nom) + '</h2><p class="fiche-accroche">' + esc(p.accroche) + '</p><p><strong>Pour qui :</strong> ' + esc(p.public) + "</p>" +
      '<div class="pf-btns">' + (p.horsMontage ? "" : '<button type="button" class="btn btn-principal" data-act="souscrire-ouvrir" data-id="' + p.id + '">Souscrire</button>') +
      '<button type="button" class="btn btn-secondaire btn-impr" data-act="imprimer-fiche">' + ICO.imprimante + "<span>Imprimer ou PDF</span></button>" +
      (p.dici ? '<a class="btn btn-secondaire" href="' + esc(p.dici) + '" target="_blank" rel="noopener" download>Télécharger le DICI (PDF)</a>' : "") +
      (!K.prospectionPossible(p) ? "" : '<a class="btn-texte" href="campagnes.html?nouvelle=1&amp;produit=' + p.id + '">Lancer une campagne</a>') +
      (window.SGBF.epargne && window.SGBF.epargne.PRODUITS_EPARGNE.indexOf(p.id) >= 0 ? '<a class="btn-texte" href="epargne.html?produit=' + p.id + (c ? "&amp;client=" + c.id : "") + '">Simuler une épargne</a>' : "") +
      (window.SGBF.pret && window.SGBF.pret.PRODUITS_PRET.indexOf(p.id) >= 0 ? '<a class="btn-texte" href="pret.html?produit=' + p.id + (c ? "&amp;client=" + c.id : "") + '">Simuler un prêt</a><a class="btn-texte" href="montage.html?produit=' + p.id + (c ? "&amp;client=" + c.id : "") + '">Monter ce crédit</a>' : "") +
      '<button type="button" class="btn-texte" data-act="fermer-fiche">Fermer la fiche</button></div></div></div>';
    h += '<div id="z-souscrire">' + souscrirePanneau(p) + "</div>";
    h += '<div class="fiche-colonnes"><section><h3>Conditions d\'accès</h3>' + liste(p.eligibilite) + "</section><section><h3>Caractéristiques</h3>" + liste(p.caracteristiques) + "</section></div>";
    h += "<h3>Tarifs</h3>" + tableTarifs(p) + '<p class="note-pied"><span class="nature nature-fictif">Banque</span> : ' + (p.famille === "mobile" ? "tarif de l'opérateur partenaire, distribué par la banque" : "tarif fixé par la banque") + '. <span class="nature nature-reglemente">Réglementé</span> : montant ou plafond fixé par la loi.</p>';
    h += '<div class="fiche-colonnes"><section><h3>Avantages</h3>' + liste(p.avantages) + "</section><section><h3>Points d'attention</h3>" + liste(p.risques) + "</section></div>";
    h += "<h3>Règles à connaître</h3>" + liste(p.reglementaire) + '<p class="note-pied">Réglementation en vigueur à l\'automne 2026.</p>';
    h += conventionHtml(p) + risqueHtml(p);
    h += "<h3>Éligibilité dans le portefeuille</h3>" + eligPortefeuille(p);
    h += "<h3>Éligibilité du client choisi</h3>" + (c ? '<p class="cat-qui"><a href="' + lienClient(c) + '">' + esc(nomFull(c)) + "</a> – " + c.age + " ans – " + esc(c.pro.prof) + "</p>" + verdictBloc(c, ev) : '<p class="vide-bloc">Choisissez un client (bloc « Client concerné », en haut de la page) pour voir s\'il remplit les conditions, condition par condition.</p>');
    return h + "</section>";
  }

  /* ---------- produits d'un client ---------- */
  function clientProduitsHtml() {
    var c = client();
    if (!c) return "";
    var st = store(), g = K.parClient(c, st), n = K.compterClient(c, st);
    var h = '<section class="bloc" id="bloc-client-prod" aria-labelledby="t-cp"><div class="bloc-tete"><h2 id="t-cp">Produits pour ' + esc(nomCourt(c)) + '</h2><span class="sous">' + pl(n.eligible, "éligible", "éligibles") + " – " + pl(n.examiner, "à examiner", "à examiner") + " – " + pl(n.non, "non éligible", "non éligibles") + " – " + pl(n.detenu, "déjà détenu", "déjà détenus") + "</span></div>";
    g.forEach(function (gr) {
      h += '<h3 class="cp-fam">' + esc(gr.famille.nom) + '</h3><div class="tab-wrap"><table class="tab-ventes tab-cat tab-cp"><caption class="sr">' + esc(gr.famille.nom) + " : situation de " + esc(nomCourt(c)) + '</caption><thead><tr><th scope="col">Produit</th><th scope="col">Situation</th><th scope="col">Pourquoi</th><th scope="col"><span class="sr">Actions</span></th></tr></thead><tbody>' +
        gr.items.map(function (x) {
          return '<tr><th scope="row">' + esc(x.produit.nom) + '</th><td data-label="Situation">' + chip(x.ev) + '</td><td data-label="Pourquoi">' + esc(x.ev.souscription ? "Souscrit le " + B.fmtDate(B.lireYmd(x.ev.souscription.date)) + "." : x.pourquoi) + '</td><td class="cp-act"><button type="button" class="btn-texte" data-act="voir" data-id="' + x.produit.id + '" aria-label="Voir la fiche : ' + esc(x.produit.nom) + '">Voir la fiche</button>' +
            (x.possible.ok ? '<button type="button" class="btn-texte" data-act="souscrire-ouvrir" data-id="' + x.produit.id + '" aria-label="Souscrire : ' + esc(x.produit.nom) + '">Souscrire</button>' : "") + "</td></tr>";
        }).join("") + "</tbody></table></div>";
    });
    h += '<div class="actions-impr"><button type="button" class="btn btn-secondaire btn-impr" data-act="imprimer-client">' + ICO.imprimante + "<span>Imprimer ou enregistrer en PDF cette synthèse</span></button></div></section>";
    return h;
  }

  /* ---------- mes souscriptions ---------- */
  function msgCtHtml() {
    var m = etat.msgCt; if (!m) return "";
    return '<p class="' + (m.ok ? "ct-ok" : "ct-ko") + '"><strong>' + (m.ok ? "Fait" : "Impossible") + " :</strong> " + esc(m.message) + "</p>" + (m.email || "");
  }
  function souscriptionsHtml() {
    var st = store(), l = K.souscriptions(st).slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : a.heure < b.heure ? 1 : -1; });
    var h = '<section class="bloc" id="bloc-souscriptions" aria-labelledby="t-ms"><div class="bloc-tete"><h2 id="t-ms">Mes souscriptions</h2><span class="sous">' + (l.length ? pl(l.length, "souscription enregistrée", "souscriptions enregistrées") : "") + "</span></div>";
    if (!l.length) return h + '<p class="vide-bloc">Aucune souscription pour le moment. Choisissez un client, ouvrez la fiche d\'un produit pour lequel il est éligible, puis cliquez sur « Souscrire ».</p></section>';
    var total = l.reduce(function (t, s) { return t + (s.montant || 0); }, 0);
    h += '<div id="ct-msg" class="ct-msg" role="status" tabindex="-1">' + msgCtHtml() + '</div><div class="tab-wrap"><table class="tab-ventes tab-cat tab-ms"><caption class="sr">Souscriptions enregistrées</caption><thead><tr><th scope="col">Date</th><th scope="col">Client</th><th scope="col">Produit</th><th scope="col">Moyen</th><th scope="col">Montant</th><th scope="col">Contrat</th><th scope="col"><span class="sr">Action</span></th></tr></thead><tbody>' +
      l.map(function (s) {
        var c = qui(s.c), p = PR.parId[s.p], conf = etat.annuler === s.id;
        return '<tr><th scope="row">' + esc(B.fmtDate(B.lireYmd(s.date))) + '<span class="pf-sous">à ' + esc(s.heure) + "</span></th><td data-label=\"Client\"><a href=\"" + lienClient(c) + '">' + esc(nomListe(c)) + '</a></td><td data-label="Produit">' + esc(p.nom) + (s.options && s.options.enfant ? " – pour " + esc(s.options.enfant) : "") + (s.note ? '<span class="pf-sous">' + esc(s.note) + "</span>" : "") + '</td><td data-label="Moyen">' + esc(K.MOYENS[s.canal] || "Non précisé") + '</td><td data-label="Montant">' + (s.montant != null ? esc(B.eur(s.montant)) : "–") + '</td><td data-label="Contrat" class="ct-cell">' + UC.celluleHtml(s) + '</td><td class="cp-act">' +
          (conf ? '<button type="button" class="btn-texte" data-act="annul-oui" data-id="' + s.id + '">Confirmer l\'annulation</button> <button type="button" class="btn-texte" data-act="annul-non">Garder</button>' : '<button type="button" class="btn-texte" data-act="annul" data-id="' + s.id + '" aria-label="Annuler la souscription de ' + esc(nomCourt(c)) + " : " + esc(p.nom) + '">Annuler la souscription</button>') + "</td></tr>";
      }).join("") + '</tbody><tfoot><tr><th scope="row">Total</th><td data-label="Souscriptions">' + pl(l.length, "souscription", "souscriptions") + '</td><td></td><td></td><td data-label="Montants">' + esc(B.eurK(total)) + '</td><td></td><td></td></tr></tfoot></table></div>' +
      '<p class="note-pied">Annuler une souscription correspond à une rétractation ou à une erreur de saisie : elle disparaît de la liste. Les montants sont ceux des versements initiaux (épargne et placements) et des capitaux empruntés (crédits accordés dans le montage de prêt) ; les comptes, cartes et assurances n\'ont pas de montant. Les dates suivent la règle de l\'agence : jour ouvré d\'ouverture du contrat.</p></section>';
    return h;
  }

  /* ---------- documents imprimables ---------- */
  function docListe(l) { return '<ul class="dp-liste">' + l.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>"; }
  function docVerif(c, ev) {
    return '<p class="dp-texte"><strong>' + esc(ev.libelle) + "</strong> – " + esc(ev.souscription ? "Souscrit le " + B.fmtDate(B.lireYmd(ev.souscription.date)) + "." : K.phrase(ev)) + "</p>" +
      '<table class="dp-pf"><thead><tr><th scope="col" class="g">Condition</th><th scope="col" class="g">Résultat</th><th scope="col" class="g">Détail</th></tr></thead><tbody>' + ev.verifiees.map(function (l) {
        return '<tr><td class="g">' + esc(l.lib) + '</td><td class="g">' + (l.ok === true ? "Remplie" : l.ok === false ? "Non remplie" : l.info ? "Information" : "À examiner") + '</td><td class="g">' + esc(l.detail) + "</td></tr>";
      }).join("") + "</tbody></table>" + (ev.aVerifier.length ? "<h3>À vérifier avec le client</h3>" + docListe(ev.aVerifier) : "");
  }
  function imprimerFiche() {
    var p = PR.parId[etat.prod], c = client(), st = store(), n = K.compterProduit(CL, p.id, st), corps = "";
    corps += '<p class="dp-texte"><strong>' + esc(p.accroche) + "</strong></p><p class=\"dp-texte\"><strong>Pour qui :</strong> " + esc(p.public) + "</p>";
    corps += '<section class="dp-bloc"><h2>Conditions d\'accès</h2>' + docListe(p.eligibilite) + "</section><section class=\"dp-bloc\"><h2>Caractéristiques</h2>" + docListe(p.caracteristiques) + "</section>";
    corps += '<section class="dp-bloc"><h2>Tarifs</h2><table class="dp-pf"><thead><tr><th scope="col" class="g">Poste</th><th scope="col" class="g">Tarif</th><th scope="col" class="g">Nature</th></tr></thead><tbody>' + p.tarifs.map(function (t) { return '<tr><td class="g">' + esc(t.lib) + '</td><td class="g">' + esc(t.val) + '</td><td class="g">' + K.NATURES[K.natureTarif(p, t)] + "</td></tr>"; }).join("") + '</tbody></table><p class="dp-mention">Banque : ' + (p.famille === "mobile" ? "tarif de l'opérateur partenaire, distribué par la banque" : "tarif fixé par la banque") + '. Réglementé : montant ou plafond fixé par la loi.</p></section>';
    corps += '<section class="dp-bloc"><h2>Avantages</h2>' + docListe(p.avantages) + "</section><section class=\"dp-bloc\"><h2>Points d'attention</h2>" + docListe(p.risques) + "</section>";
    corps += '<section class="dp-bloc"><h2>Règles à connaître</h2>' + docListe(p.reglementaire) + '<p class="dp-mention">Réglementation en vigueur à l\'automne 2026.</p></section>';
    var rr = lignesRisque(p);
    if (rr) corps += '<section class="dp-bloc"><h2>Niveau de risque</h2><p class="dp-texte"><strong>Indicateur de risque du produit : ' + esc(R.libelleFiche(rr.g.min, rr.g.max, rr.lignes.length > 1 || rr.gamme ? "selon les supports" : "")) + '.</strong> Niveau calculé d\'après la composition du produit, indépendant du profil du client.</p><table class="dp-pf"><thead><tr><th scope="col" class="g">Support</th><th scope="col" class="g">Composition</th><th scope="col" class="g">Indicateur</th></tr></thead><tbody>' + rr.lignes.map(function (l) { return '<tr><td class="g">' + esc(l.nom) + '</td><td class="g">' + esc(l.compo) + '</td><td class="g">' + l.sri + " sur 7</td></tr>"; }).join("") + "</tbody></table></section>";
    if (p.convention) corps += '<section class="dp-bloc"><h2>Services inclus</h2>' + docListe(p.convention.services.map(function (x) { return x.lib + " – " + e2(x.valeur) + " par an à l'unité"; })) + '<p class="dp-texte">Total à l\'unité' + (p.convention.mineur ? "" : " avec un compte Équilibre") + ' : ' + esc(e2(p.convention.avec.CPT)) + " par an ; avec la convention : " + esc(e2(p.convention.cotisationAn)) + " par an.</p></section>";
    corps += '<section class="dp-bloc"><h2>Éligibilité dans le portefeuille</h2><p class="dp-texte">Sur ' + CL.length + " clients : " + pl(n.eligible, "éligible", "éligibles") + ", " + pl(n.examiner, "à examiner", "à examiner") + ", " + pl(n.non, "non éligible", "non éligibles") + ", " + pl(n.detenu, "déjà détenu", "déjà détenus") + ".</p></section>";
    if (c) corps += '<section class="dp-long"><h2>Éligibilité de ' + esc(nomFull(c)) + "</h2>" + docVerif(c, K.verdictClient(c, p.id, st)) + "</section>";
    IMP.imprimer(IMP.document({ titre: "Fiche produit : " + p.nom, sous: FAM[p.famille].nom + " – Agence de Paris", corps: corps }), "Fiche_" + IMP.nomFichier(p.nom) + "_" + B.ymd(B.aujourdhui()));
  }
  function imprimerComp() {
    var cmp = K.comparer(etat.comp), st = store(), corps = "";
    corps += '<section class="dp-long"><h2>Comparaison</h2><table class="dp-pf dp-cmp"><thead><tr><th scope="col" class="g">Critère</th>' + cmp.produits.map(function (p) { return '<th scope="col" class="g">' + esc(p.nom) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      cmp.lignes.map(function (l) { return '<tr><td class="g"><strong>' + esc(l.lib) + "</strong></td>" + l.vals.map(function (v) { return '<td class="g">' + esc(v) + "</td>"; }).join("") + "</tr>"; }).join("") + '</tbody></table><p class="dp-mention">Les taux et plafonds réglementés sont fixés par la loi ; les autres tarifs sont ceux de la banque.</p></section>';
    IMP.imprimer(IMP.document({ titre: "Comparaison de produits", sous: cmp.produits.map(function (p) { return p.nom; }).join(" – "), corps: corps }), "Comparaison_" + IMP.nomFichier(cmp.produits.map(function (p) { return p.code; }).join("_")) + "_" + B.ymd(B.aujourdhui()));
  }
  function imprimerClient() {
    var c = client(), st = store(), g = K.parClient(c, st), n = K.compterClient(c, st), corps = "";
    corps += '<p class="dp-texte">' + esc(nomFull(c)) + " – " + c.age + " ans – " + esc(c.pro.prof) + " – " + esc(c.adr.ville) + " – " + esc(c.num) + '</p><p class="dp-texte">Sur ' + PR.produits.length + " produits : " + pl(n.eligible, "éligible", "éligibles") + ", " + pl(n.examiner, "à examiner", "à examiner") + ", " + pl(n.non, "non éligible", "non éligibles") + ", " + pl(n.detenu, "déjà détenu", "déjà détenus") + ".</p>";
    g.forEach(function (gr) {
      corps += '<section class="dp-bloc"><h2>' + esc(gr.famille.nom) + '</h2><table class="dp-pf dp-elig"><thead><tr><th scope="col" class="g">Produit</th><th scope="col" class="g">Situation</th><th scope="col" class="g">Pourquoi</th></tr></thead><tbody>' + gr.items.map(function (x) {
        return '<tr><td class="g">' + esc(x.produit.nom) + '</td><td class="g">' + esc(x.ev.libelle) + '</td><td class="g">' + esc(x.ev.souscription ? "Souscrit le " + B.fmtDate(B.lireYmd(x.ev.souscription.date)) + "." : x.pourquoi) + "</td></tr>";
      }).join("") + "</tbody></table></section>";
    });
    corps += '<p class="dp-mention">Éligibilité calculée le ' + esc(B.fmtLong(B.aujourdhui())) + " à partir du dossier du client. Les conditions qui ne se vérifient pas dans un dossier (pièces, fichiers, questionnaires, dépôt minimum) restent à vérifier avec le client.</p>";
    IMP.imprimer(IMP.document({ titre: "Éligibilité aux produits", sous: nomFull(c) + " – Agence de Paris", corps: corps }), "Eligibilite_" + IMP.nomFichier(nomCourt(c)) + "_" + B.ymd(B.aujourdhui()));
  }

  /* ---------- page ---------- */
  function render() {
    app.innerHTML = '<nav class="fil-ariane" aria-label="Fil d\'Ariane"><a href="index.html">' + ICO.retour + "Accueil</a><span aria-hidden=\"true\">/</span><span>Catalogue de produits</span></nav>" +
      '<div class="page-titre"><h1>Catalogue de produits</h1><p>' + PR.produits.length + " produits en " + PR.univers.length + " univers – " + esc(B.fmtLong(B.aujourdhui())) + "</p></div>" +
      '<div class="page-grille">' +
      '<section class="bloc" id="bloc-client" aria-labelledby="t-cl"><div class="bloc-tete"><h2 id="t-cl">Client concerné</h2><span class="sous">Facultatif : pour vérifier l\'éligibilité et souscrire</span></div><div id="z-client"></div></section>' +
      '<section class="bloc" id="bloc-produits" aria-labelledby="t-pr"><div class="bloc-tete"><h2 id="t-pr">Les produits</h2><span class="sous" id="pr-statut" role="status"></span></div>' +
      '<div class="champ cat-recherche"><label for="pr-q">Rechercher un produit</label><input id="pr-q" type="search" autocomplete="off" maxlength="60" placeholder="Nom ou mot-clé : livret, carte, assurance habitation, crédit…" aria-controls="z-grille" value="' + esc(etat.pq) + '"></div><div id="z-grille"></div></section>' +
      '<div id="z-comp"></div><div id="z-fiche"></div><div id="z-client-prod"></div><div id="z-souscr"></div></div>' +
      '<p class="mention" style="margin-top:16px">Les taux et plafonds réglementaires, les règles du HCSF et le taux d\'usure sont ceux de l\'automne 2026.</p>';
    remplir();
  }
  function remplir() {
    document.getElementById("z-client").innerHTML = clientHtml();
    majApresClient();
    document.getElementById("z-comp").innerHTML = compHtml();
    document.getElementById("z-souscr").innerHTML = souscriptionsHtml();
  }
  function majApresClient() { majGrille(); majFiche(); document.getElementById("z-client-prod").innerHTML = clientProduitsHtml(); }
  function majGrille() { document.getElementById("z-grille").innerHTML = grilleHtml(); statutGrille(); }
  function majFiche() { document.getElementById("z-fiche").innerHTML = ficheHtml(); }
  function focus(id) { var e = document.getElementById(id); if (e) { if (!e.hasAttribute("tabindex")) e.setAttribute("tabindex", "-1"); e.focus(); } }
  function aller(id) { var e = document.getElementById(id); if (e) e.scrollIntoView({ block: "start" }); }
  function ouvrirFiche(id, souscrire) {
    if (etat.prod !== id) { etat.coches = []; etat.sante = {}; etat.clause = {}; etat.montant = ""; etat.note = ""; etat.err = ""; etat.msgSous = null; etat.canal = ""; etat.rapport = ""; etat.opt = {}; etat.idv = ""; etat.idp = ""; etat.rem = ""; }
    etat.prod = id; etat.sous = !!souscrire; if (souscrire) etat.msgSous = null;
    majGrille(); majFiche();
    aller("bloc-fiche");
    focus(souscrire ? (document.getElementById("t-souscrire") ? "t-souscrire" : document.getElementById("souscr-ko") ? "souscr-ko" : "souscr-info") : "t-fiche");
  }

  /* ---------- événements ---------- */
  /* Questionnaire de santé : la réponse est rangée dans la mémoire de la page (jamais enregistrée) et la décision se met à jour. */
  function santeSaisie(t) {
    if (!SU || !SU.saisir(etat.sante, t)) return false;
    SU.maj("sq", etat.prod, etat.sante, { motifs: true });
    var ze = document.getElementById("s-err"); if (ze && /questionnaire de santé/i.test(ze.textContent)) { ze.textContent = ""; etat.err = ""; }   /* le message de l'envoi précédent n'a plus lieu d'être */
    return true;
  }
  /* Clause bénéficiaire : un autre bénéficiaire redessine la clause, une saisie ne met à jour que la clause rédigée. */
  function clauseSaisie(t) {
    var c = client(); if (!BU || !c || !etat.prod) return false;
    var r = BU.saisir(etat.clause, t);
    if (r === "choix" && t.tagName === "SELECT") BU.redessiner(etat.prod, c, etat.clause, t.id);
    else if (r) BU.maj(etat.prod, c, etat.clause);
    var ze = document.getElementById("s-err"); if (ze && etat.err && /clause|bénéficiaire|désignée|pompes|conjoint|enfant|héritiers/i.test(etat.err)) { ze.textContent = ""; etat.err = ""; }
    return true;
  }
  app.addEventListener("input", function (e) {
    var t = e.target;
    if (t.hasAttribute("data-sq")) { santeSaisie(t); return; }
    if (t.hasAttribute("data-bf")) { clauseSaisie(t); return; }
    if (t.id === "cl-q") { etat.q = t.value; suggestions(); }
    else if (t.id === "s-montant") { etat.montant = t.value; if (etat.prod === "CAT") { var zo2 = document.getElementById("s-options"), c2 = client(); if (zo2 && c2) zo2.innerHTML = optionsHtml(PR.parId.CAT, c2); } }
    else if (t.id === "s-note") etat.note = t.value;
    else if (t.id === "pr-q") { etat.pq = t.value; majGrille(); }
  });
  function majAcc() { var z = document.getElementById("s-acc"), c = client(), p = PR.parId[etat.prod]; if (z && c && p) z.innerHTML = accueilHtml(p, c); }
  app.addEventListener("change", function (e) {
    var t = e.target;
    if (t.hasAttribute("data-sq")) { santeSaisie(t); return; }
    if (t.hasAttribute("data-bf")) { clauseSaisie(t); return; }
    if (t.hasAttribute("data-comp")) {
      var id = t.getAttribute("data-comp");
      if (t.checked) {
        if (etat.comp.length >= 3) { t.checked = false; etat.msgComp = "Trois produits au maximum : retirez-en un avant d'en ajouter un autre."; document.getElementById("z-comp").innerHTML = compHtml(); return; }
        etat.comp.push(id);
      } else etat.comp = etat.comp.filter(function (x) { return x !== id; });
      etat.msgComp = ""; document.getElementById("z-comp").innerHTML = compHtml();
    } else if (t.hasAttribute("data-conv-svc")) majConvSim();
    else if (t.hasAttribute("data-svc")) {
      etat.opt.services = PUI.basculer(etat.opt.services, t.getAttribute("data-svc"), t.checked); majPanier();
    }
    else if (t.hasAttribute("data-conf")) etat.coches[parseInt(t.getAttribute("data-conf"), 10)] = t.checked;
    else if (t.id === "s-rapport") { etat.rapport = t.value; etat.montant = ""; document.getElementById("z-souscrire").innerHTML = souscrirePanneau(PR.parId[etat.prod]); focus("s-rapport"); }
    else if (t.hasAttribute("data-opt")) { etat.opt[t.getAttribute("data-opt")] = t.value; var zo = document.getElementById("s-options"), cc = client(); if (zo && cc) { zo.innerHTML = optionsHtml(PR.parId[etat.prod], cc); var sel = document.getElementById("s-opt-" + t.getAttribute("data-opt")); if (sel) sel.focus(); } var pm = document.getElementById("s-montant"); if (pm && PR.parId[etat.prod].id === "AUTZ") { var ay = document.getElementById("s-aide"); if (ay) ay.textContent = "Au moins " + (etat.opt.periodicite === "trimestriel" ? "90 €" : "30 €") + ". Exemple : 50 ou 120,50."; } }
    else if (t.id === "s-canal") { etat.canal = t.value; var za = document.getElementById("s-canal-aide"); if (za) za.innerHTML = canalAide(client()); majAcc(); }
    else if (t.hasAttribute("data-acc")) {
      var ka = t.getAttribute("data-acc");
      if (ka === "idv") { etat.idv = t.value; if (t.value !== "oui") etat.idp = ""; majAcc(); focus("s-idverif"); }
      else if (ka === "idp") etat.idp = t.value;
      else if (ka === "rem") etat.rem = t.value;
    }
  });
  app.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b) return;
    var act = b.getAttribute("data-act"), id = b.getAttribute("data-id");
    if (act === "fam") { etat.fam = id; majGrille(); var s = app.querySelector('[data-act="fam"][aria-pressed="true"]'); if (s) s.focus(); }
    else if (act === "vf") { etat.vf = id; majGrille(); var sv = app.querySelector('[data-act="vf"][aria-pressed="true"]'); if (sv) sv.focus(); }
    else if (act === "pq-effacer") { etat.pq = ""; document.getElementById("pr-q").value = ""; majGrille(); document.getElementById("pr-q").focus(); }
    else if (act === "filtres-effacer") { etat.fam = "tous"; etat.vf = "tous"; majGrille(); var sf = app.querySelector('[data-act="fam"][aria-pressed="true"]'); if (sf) sf.focus(); }
    else if (act === "voir") ouvrirFiche(id, false);
    else if (act === "souscrire-ouvrir") ouvrirFiche(id, true);
    else if (act === "fermer-fiche") { etat.prod = null; etat.sous = false; etat.sante = {}; etat.clause = {}; etat.msgSous = null; majGrille(); majFiche(); focus("bloc-produits"); }
    else if (act === "annuler-souscrire") { etat.sous = false; etat.err = ""; etat.sante = {}; etat.clause = {}; majFiche(); focus("t-fiche"); }
    else if (act === "aller-client") { aller("bloc-client"); focus("cl-q"); }
    else if (act === "svc-tout" || act === "svc-carte") {
      var pc = PR.parId[etat.prod];
      etat.opt.services = PUI.raccourci(pc.convention, act);
      majPanier(); b.focus();
    }
    else if (act === "choisir-client") {
      etat.client = parseInt(id, 10); etat.q = ""; etat.coches = []; etat.sante = {}; etat.clause = {}; etat.err = ""; etat.msgSous = null; etat.opt = {}; etat.idv = ""; etat.idp = ""; etat.rem = "";
      document.getElementById("z-client").innerHTML = clientHtml(); majApresClient(); focus("cl-choisi");
    } else if (act === "retirer-client") { etat.client = null; etat.coches = []; etat.sante = {}; etat.clause = {}; etat.msgSous = null; etat.idv = ""; etat.idp = ""; etat.rem = ""; document.getElementById("z-client").innerHTML = clientHtml(); majApresClient(); focus("cl-q"); }
    else if (act === "ret-comp") { etat.comp = etat.comp.filter(function (x) { return x !== id; }); etat.msgComp = ""; document.getElementById("z-comp").innerHTML = compHtml(); majGrille(); }
    else if (act === "vider-comp") { etat.comp = []; etat.msgComp = ""; document.getElementById("z-comp").innerHTML = compHtml(); majGrille(); }
    else if (act === "imprimer-fiche") imprimerFiche();
    else if (act === "imprimer-comp") imprimerComp();
    else if (act === "imprimer-client") imprimerClient();
    else if (act.indexOf("ct-") === 0) {
      etat.msgCt = UC.agir(act.slice(3), id);
      document.getElementById("z-souscr").innerHTML = souscriptionsHtml(); if (etat.msgSous) majFiche();
      focus("ct-msg");
    }
    else if (act === "annul") { etat.annuler = id; document.getElementById("z-souscr").innerHTML = souscriptionsHtml(); var c1 = app.querySelector('[data-act="annul-oui"]'); if (c1) c1.focus(); }
    else if (act === "annul-non") { var ci = etat.annuler; etat.annuler = null; document.getElementById("z-souscr").innerHTML = souscriptionsHtml(); var b2 = app.querySelector('[data-act="annul"][data-id="' + ci + '"]'); if (b2) b2.focus(); }
    else if (act === "annul-oui") {
      var st = store(); if (K.annulerSouscription(st, id)) B.store.sauver();
      etat.annuler = null; etat.msgSous = null; remplir(); focus("t-ms");
    }
  });
  app.addEventListener("submit", function (e) {
    if (e.target.id !== "form-souscrire") return;
    e.preventDefault();
    var c = client(), p = PR.parId[etat.prod], st = store();
    var pos = K.possibilite(K.verdictClient(c, p.id, st), p), n = 0;
    (pos.confirmations || []).forEach(function (t, i) { if (etat.coches[i]) n++; });
    var rap = M.estBoursier(p.id) ? rapportChoisi(c, p) : null;
    if (rap) etat.canal = rap.canal;
    var r = K.souscrire(st, c, p.id, { montant: etat.montant, confirmees: n, note: etat.note, canal: etat.canal, rapport: rap ? rap.id : "", sante: etat.sante, clause: etat.clause, options: etat.opt, idverif: etat.idv, idpiece: etat.idp, remise: etat.rem });
    if (!r.ok) { etat.err = r.erreur; document.getElementById("s-err").textContent = r.erreur; var f = /^opt_/.test(r.champ || "") ? document.getElementById("s-" + r.champ.replace("opt_", "opt-")) : r.champ === "panier" ? document.getElementById("s-panier") : r.champ === "rapport" ? document.getElementById("s-rapport") : r.champ === "canal" ? (document.getElementById("s-canal") || document.getElementById("s-rapport")) : r.champ === "idverif" ? document.getElementById("s-idverif") : r.champ === "idpiece" ? document.getElementById("s-idpiece") : r.champ === "remise" ? document.getElementById("s-remise") : r.champ === "sante" ? document.getElementById("sq-t") : /^bf-/.test(r.champ || "") ? document.getElementById(r.champ) : r.champ === "montant" ? document.getElementById("s-montant") : /versement|plafond|montant/i.test(r.erreur) ? document.getElementById("s-montant") : app.querySelector("[data-conf]"); if (f) f.focus(); return; }
    B.store.sauver();
    var s = r.souscription;
    etat.msgSous = { id: s.id, p: p.id, c: c.id, montant: s.montant, canal: s.canal, date: s.date, ferme: !B.estOuvre(B.aujourdhui()), cotisation: s.options && s.options.cotisationMois, prixUnique: s.options && s.options.prixUnique, carte: r.carte ? r.carte.p : null, services: s.options && s.options.services ? s.options.services : null, economie: s.options && s.options.economie ? s.options.economie : null };
    etat.sous = false; etat.err = ""; etat.coches = []; etat.sante = {}; etat.clause = {}; etat.montant = ""; etat.note = ""; etat.canal = ""; etat.rapport = ""; etat.opt = {}; etat.idv = ""; etat.idp = ""; etat.rem = ""; etat.msgCt = null;
    majGrille(); majFiche(); document.getElementById("z-client").innerHTML = clientHtml(); document.getElementById("z-client-prod").innerHTML = clientProduitsHtml(); document.getElementById("z-souscr").innerHTML = souscriptionsHtml();
    focus("souscr-ok");
  });

  /* Typographie française sur toute la page : espace insécable avant « : ; ! ? % € » », après « et dans les nombres (« 22 950 € »). Les textes de ce module et des modules plus anciens sont écrits avec des espaces simples ; ils sont corrigés ici, au moment où ils sont affichés. */
  function typoTexte(t) {
    var p = t.parentNode;
    if (!p || (p.closest && p.closest("script,style,textarea"))) return;
    var v = t.nodeValue, w = v.replace(/ +([:;!?%€»])/g, "\u00a0$1").replace(/(\d) (?=\d{3}(?!\d))/g, "$1\u00a0").replace(/« +/g, "«\u00a0");
    if (w !== v) t.nodeValue = w;
  }
  function typoZone(n) {
    if (n.nodeType === 3) { typoTexte(n); return; }
    if (n.nodeType !== 1) return;
    var w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT, null, false), l = [], x;
    while ((x = w.nextNode())) l.push(x);
    l.forEach(typoTexte);
  }
  if (window.MutationObserver) new MutationObserver(function (ms) {
    ms.forEach(function (m) { if (m.type === "characterData") typoTexte(m.target); else Array.prototype.forEach.call(m.addedNodes, typoZone); });
  }).observe(app, { childList: true, subtree: true, characterData: true });

  RECH.init(CL, document.getElementById("rech"), document.getElementById("rech-res"), document.getElementById("rech-statut"));
  render();
  if (auParamProduit) aller("bloc-fiche");
})();
