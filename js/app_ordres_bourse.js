/* GS Banque & Assurance – page « Ordres de bourse » : traiter la demande d'un client titulaire d'un PEA (acheter ou vendre des titres), composer l'ordre, le confronter au carnet d'ordres et obtenir l'avis d'opéré simulé.
   Les règles et les calculs sont dans ordres_bourse.js, les valeurs et les 12 demandes dans data_ordres.js. L'enregistrement se fait dans st.ordresBourse (un traitement par demande) ; l'outil ne transmet rien à une vraie Bourse. */
(function () {
  "use strict";

  var SG = window.SGBF, B = SG.banque, O = SG.ordresBourse, ICO = SG.icones, RECH = SG.recherche, app = document.getElementById("app");
  var esc = B.esc, NB = " ";
  var FILTRES = [["atraiter", "À traiter"], ["traites", "Traités"], ["tous", "Tous"]];
  var VIDE = { decision: "", compte: "", type: "", quantite: "", limite: "", seuil: "", validite: "", jusquau: "", motif: "", orientation: "", note: "" };
  var etat = { filtre: "atraiter", ouvert: null, f: Object.assign({}, VIDE), err: null, ctl: null, fait: null, conf: null };

  function st() { return B.store.charger(); }
  function nomComplet(c) { return c.civ + " " + c.prenom + " " + c.nom.toUpperCase(); }
  function pl(n, s, p) { return n + " " + (n > 1 ? p : s); }
  function dateLongue(ymd, jour) { var d = B.lireYmd(ymd), o = { day: "numeric", month: "long", year: "numeric" }; if (jour) o.weekday = "long"; return d ? d.toLocaleDateString("fr-FR", o) : ""; }
  /* Prix moyen d'exécution : de 2 à 4 décimales, sans zéro inutile. */
  function moyenne(x) { var t = Number(x).toFixed(4).replace(".", ","); return t.replace(/0{1,2}$/, "") + NB + "€"; }
  function heure(h) { return String(h).replace(":", NB + "h" + NB); }
  function nb(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NB); }
  function lib(liste, id) { var x = liste.filter(function (y) { return y.id === id; })[0]; return x ? x.lib : id; }

  /* ---------- déroulé, vue d'ensemble, séance ---------- */
  function deroule() {
    var e = [
      ["Comprendre la demande", "Sens (achat ou vente), valeur, quantité, prix et durée voulus par le client : tout ce qu'il a exigé doit se retrouver dans l'ordre."],
      ["Vérifier le compte", "Titre éligible au PEA, espèces suffisantes (courtage et taxe compris), titres réellement détenus pour une vente."],
      ["Composer l'ordre", "Type d'ordre, limite ou seuil de prix, durée de validité : chaque choix change ce qui sera exécuté, à quel prix, et quand."],
      ["Simuler et transmettre", "L'ordre est confronté au carnet : prix d'exécution, frais, espèces après l'opération. On enregistre si aucun point bloquant ne subsiste."]
    ];
    return '<ol class="op-deroule regul-deroule" aria-label="Déroulé du traitement d\'une demande d\'ordre">' + e.map(function (x, i) {
      return '<li><span class="op-deroule-num" aria-hidden="true">' + (i + 1) + '</span><span class="op-deroule-txt"><strong>' + esc(x[0]) + "</strong><span>" + esc(x[1]) + "</span></span></li>";
    }).join("") + "</ol>";
  }
  function vue(b) {
    var d = [["Demandes à traiter", b.atraiter, "sur " + b.total + " demandes", "ob-b-warn"], ["Ordres transmis", b.transmis, b.executes + " exécuté" + (b.executes > 1 ? "s" : "") + " en totalité, " + b.partiels + " en partie, " + b.enAttente + " en attente", "ob-b-ok"],
      ["Demandes non transmises", b.refuses, b.refuses ? "refusées, avec une proposition au client" : "aucune pour le moment", "ob-b-info"], ["Demandes traitées", b.traites, b.total - b.traites ? "il en reste " + (b.total - b.traites) : "toutes les demandes sont traitées", "ob-b-ok"]];
    var s = O.seance(), t = O.TARIF;
    return '<section class="bloc ob-vue" aria-labelledby="ob-t-vue"><div class="bloc-tete"><h2 id="ob-t-vue">Vue d\'ensemble</h2><span class="sous">Agence de Paris – demandes des clients titulaires d\'un PEA</span></div>' +
      '<dl class="ob-bilan" aria-label="Bilan des demandes">' + d.map(function (x) { return '<div class="ob-b ' + x[3] + '"><dt>' + esc(x[0]) + "</dt><dd>" + esc(String(x[1])) + '</dd><dd class="ob-b-sous">' + esc(x[2]) + "</dd></div>"; }).join("") + "</dl>" +
      '<h3 class="ob-h3">La séance et les repères du jour</h3><dl class="ob-reperes" aria-label="Séance de Bourse et repères">' +
      "<div><dt>Séance en ce moment</dt><dd><strong>" + esc(s.lib) + "</strong>. Euronext Paris : pré-ouverture de 7" + NB + "h" + NB + "15 à 9" + NB + "h" + NB + "00, négociation continue de 9" + NB + "h" + NB + "00 à 17" + NB + "h" + NB + "30, fixing de clôture jusqu'à 17" + NB + "h" + NB + "35.</dd></div>" +
      "<div><dt>Priorité dans le carnet</dt><dd>D'abord par le prix (l'acheteur le plus généreux, le vendeur le moins cher), puis, à prix égal, par l'heure d'arrivée de l'ordre.</dd></div>" +
      "<div><dt>Frais de GS</dt><dd>Courtage de 0,60" + NB + "% par ordre : minimum " + esc(O.eur(t.PEA.min)) + " sur un PEA, " + esc(O.eur(t.CTO.min)) + " sur un compte-titres ordinaire.</dd></div>" +
      "<div><dt>Taxe sur les transactions financières</dt><dd>0,4" + NB + "% sur l'achat d'actions de sociétés françaises de plus d'un milliard d'euros de capitalisation (au 1er décembre de l'année précédente). Elle ne frappe pas la vente.</dd></div>" +
      "<div><dt>Règlement-livraison</dt><dd>Au plus tard deux jours de négociation après l'exécution. Les titres ne sont pas livrés, ni le produit d'une vente crédité, tout de suite.</dd></div></dl></section>";
  }
  function filtres(b) {
    var n = { atraiter: b.atraiter, traites: b.traites, tous: b.total };
    return '<div class="ob-filtres" role="group" aria-label="Demandes à afficher">' + FILTRES.map(function (f) {
      return '<button type="button" class="btn ' + (etat.filtre === f[0] ? "btn-principal" : "btn-secondaire") + '" id="ob-f-' + f[0] + '" data-act="filtre" data-f="' + f[0] + '" aria-pressed="' + (etat.filtre === f[0]) + '">' + esc(f[1]) + " (" + n[f[0]] + ")</button>";
    }).join("") + "</div>";
  }

  /* ---------- une demande ---------- */
  function puce(t) {
    if (!t) return '<span class="chip chip-warn">' + ICO.alerte + "À traiter</span>";
    return t.decision === "transmettre" ? '<span class="chip chip-ok">' + ICO.check + "Transmis</span>" : '<span class="chip chip-ctrl">' + ICO.info + "Non transmis</span>";
  }
  function titreDemande(d, v) { return "Demande " + d.id + " – " + (d.sens === "achat" ? "achat" : "vente") + " de " + d.quantite + " " + (v.type === "etf" ? "parts" : "actions") + " " + v.nom; }
  function entete(d, v, t) {
    return '<div class="regul-carte-tete"><div><h3 class="regul-nom">' + esc(titreDemande(d, v)) + '</h3><p class="regul-sous">' + esc(O.CANAUX[d.canal]) + ", reçue à " + esc(heure(d.recu)) + "</p></div>" + puce(t) + "</div>";
  }
  function faits(d, v) {
    var dos = O.dossier(d), c = dos.client;
    var h = '<div class="ob-faits"><div class="ob-bloc-faits"><h4 class="ob-h4">Dossier du client</h4><dl>' +
      "<div><dt>Client</dt><dd>" + esc(nomComplet(c)) + ", " + c.age + " ans (client n°" + NB + '<span class="ob-nb">' + esc(c.num) + '</span>) – <a href="client.html?id=' + c.id + '">Fiche client</a></dd></div>' +
      "<div><dt>Valeur du PEA</dt><dd>" + esc(O.eur(dos.solde)) + "</dd></div><div><dt>Espèces du PEA</dt><dd>" + esc(O.eur(dos.esp)) + "</dd></div>" +
      "<div><dt>Titres déjà détenus</dt><dd>" + (dos.detient ? esc(pl(dos.detient, "titre", "titres") + " " + v.nom) : "Aucun titre " + esc(v.nom)) + "</dd></div>" +
      "<div><dt>Compte-titres ordinaire</dt><dd>" + (dos.cto ? "Oui" : "Aucun") + "</dd></div></dl></div>";
    h += '<div class="ob-bloc-faits"><h4 class="ob-h4">' + esc(v.nom) + '</h4><dl><div><dt>Nature</dt><dd>' + (v.type === "etf" ? "Fonds coté (ETF)" : "Action") + " – code " + esc(v.isin) + " (fictif)</dd></div>" +
      "<div><dt>Dernier cours</dt><dd>" + esc(O.prixTxt(v.cours)) + "</dd></div><div><dt>Siège de l'émetteur</dt><dd>" + esc(v.siege === "FR" ? "France" : v.siege === "DE" ? "Allemagne" : "États-Unis") + "</dd></div>" +
      "<div><dt>Liquidité</dt><dd>" + esc(O.LIQUIDITE[v.liquidite]) + "</dd></div>" +
      "<div><dt>Éligible au PEA</dt><dd>" + (v.pea.eligible ? "Oui" : "Non") + " – " + esc(v.pea.motif) + "</dd></div>" +
      (v.type === "action" ? "<div><dt>Capitalisation</dt><dd>" + esc(nb(v.capi)) + NB + "M€ au 1er décembre 2025</dd></div>" : "") + "</dl></div></div>";
    return h;
  }
  function carnet(v) {
    function tab(titre, liste) { return '<div class="ob-carnet-wrap"><table class="ob-carnet"><caption>' + esc(titre) + '</caption><thead><tr><th scope="col">Prix</th><th scope="col">Quantité</th></tr></thead><tbody>' + liste.map(function (n) { return "<tr><td>" + esc(O.prixTxt(n[0])) + "</td><td>" + esc(nb(n[1])) + "</td></tr>"; }).join("") + "</tbody></table></div>"; }
    return '<div class="ob-carnet-deux">' + tab("Carnet d'ordres – offres d'achat (acheteurs)", v.carnet.achats) + tab("Carnet d'ordres – offres de vente (vendeurs)", v.carnet.ventes) + "</div>";
  }
  function citation(d) { return '<blockquote class="ob-citation"><p>« ' + esc(d.citation) + ' »</p><footer>' + esc(O.CANAUX[d.canal]) + "</footer></blockquote>"; }

  /* ---------- avis d'opéré simulé ---------- */
  function ligne(lb, val, cl) { return '<tr' + (cl ? ' class="' + cl + '"' : "") + '><th scope="row">' + lb + "</th><td>" + val + "</td></tr>"; }
  function avis(d, r) {
    var achat = d.sens === "achat", h = '<p class="ob-statut">' + esc(O.STATUTS[r.statut]) + "</p>";
    if (r.qteExec) {
      h += '<div class="ob-carnet-wrap"><table class="ob-avis"><caption class="sr">Détail de l\'avis d\'opéré simulé</caption><tbody>';
      r.fills.forEach(function (f) { h += ligne("Exécuté : " + pl(f.qte, "titre", "titres") + " à " + esc(O.prixTxt(f.prix)), esc(O.eur(f.prix * f.qte))); });
      h += ligne("Quantité exécutée (prix moyen " + esc(moyenne(r.prixMoyen)) + ")", esc(pl(r.qteExec, "titre", "titres")));
      h += ligne("Montant brut", esc(O.eur(r.brut))) + ligne("Courtage", esc(O.eur(r.courtage)));
      if (achat && r.ttf > 0) h += ligne("Taxe sur les transactions financières", esc(O.eur(r.ttf)));
      h += ligne(achat ? "Total débité du compte espèces" : "Total crédité au compte espèces", esc(O.eur(r.total)), "ob-total");
      h += achat ? ligne("Espèces du PEA après l'opération", esc(O.eur(r.espApres))) : ligne("Espèces du PEA une fois le produit crédité, au règlement-livraison", esc(O.eur(r.espReglement)));
      if (r.bloque) h += ligne("Dont espèces réservées pour le solde de l'ordre", esc(O.eur(r.bloque)));
      h += ligne("Règlement-livraison", "au plus tard le " + esc(dateLongue(r.reglement, true)));
      h += "</tbody></table></div>";
      if (r.reste) h += "<p>Reste dans le carnet : " + esc(pl(r.reste, "titre", "titres")) + ".</p>";
    } else if (achat && r.besoin) h += "<p>Espèces à réserver pour l'ordre : " + esc(O.eur(r.besoin)) + " (courtage et taxe compris).</p>";
    return h;
  }

  /* ---------- panneau de traitement ---------- */
  function erreur(champ) { return etat.err && etat.err.some(function (e) { return e.champ === champ; }); }
  function radios(nom, liste, val) {
    return '<div class="ob-radios" role="radiogroup" aria-labelledby="ob-l-' + nom + '">' + liste.map(function (x) {
      return '<label class="op-case"><input type="radio" name="ob-' + nom + '" id="ob-' + nom + "-" + x.id + '" value="' + x.id + '"' + (val === x.id ? " checked" : "") + '><span><strong>' + esc(x.lib) + "</strong>" + (x.sous ? '<span class="ob-sous">' + esc(x.sous) + "</span>" : "") + "</span></label>";
    }).join("") + "</div>";
  }
  function champ(id, label, val, aide, opt) {
    opt = opt || {}; var e = erreur(opt.champ || id);
    return '<div class="champ ob-champ"><label for="ob-' + id + '">' + esc(label) + '</label><input type="' + (opt.type || "text") + '" id="ob-' + id + '"' + (opt.type === "date" ? "" : ' inputmode="' + (opt.mode || "decimal") + '" autocomplete="off"') + ' value="' + esc(val) + '"' +
      (e ? ' aria-invalid="true" aria-describedby="ob-aide-' + id + ' ob-err"' : ' aria-describedby="ob-aide-' + id + '"') + '><span class="aide-champ" id="ob-aide-' + id + '">' + esc(aide) + "</span></div>";
  }
  function controleHtml(r, d) {
    if (!r) return "";
    var h = "";
    if (r.erreurs.length) h += '<div class="ob-ctl ob-ctl-bad"><p class="ob-ctl-t">' + ICO.alerte + "Points bloquants (" + r.erreurs.length + ")</p><ul>" + r.erreurs.map(function (x) { return "<li>" + esc(x.msg) + "</li>"; }).join("") + "</ul></div>";
    if (r.points.length) h += '<div class="ob-ctl ob-ctl-warn"><p class="ob-ctl-t">' + ICO.info + "Points d'attention (" + r.points.length + ")</p><ul>" + r.points.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div>";
    if (r.ok) h += '<div class="ob-ctl ob-ctl-ok"><p class="ob-ctl-t">' + ICO.check + "Aucun point bloquant : l'ordre peut être enregistré</p>" + (r.estimation ? avis(d, r.estimation) : "") + "</div>";
    return h;
  }
  function formHtml(d) {
    var f = etat.f, v = O.valeur(d.valeur), dos = O.dossier(d), ty = O.type(f.type), dec = f.decision;
    var h = '<form class="formulaire ob-form" id="ob-form" data-id="' + esc(d.id) + '" novalidate aria-labelledby="ob-t-' + esc(d.id) + '"><h4 class="ob-h4 ob-h4-form" id="ob-t-' + esc(d.id) + '" tabindex="-1">Traiter la demande ' + esc(d.id) + "</h4>";
    h += '<fieldset class="op-section ob-fs"><legend id="ob-l-dec">Votre décision *</legend>' + radios("dec", [{ id: "transmettre", lib: "Transmettre l'ordre", sous: "Composer l'ordre puis l'enregistrer." }, { id: "refuser", lib: "Ne pas transmettre l'ordre", sous: "Seulement si un obstacle l'empêche vraiment : le client reçoit alors une proposition." }], dec) + "</fieldset>";
    if (dec === "transmettre") {
      h += '<fieldset class="op-section ob-fs"><legend id="ob-l-compte">Compte sur lequel passer l\'ordre *</legend>' + radios("compte", O.COMPTES.map(function (c) { return { id: c.id, lib: c.lib, sous: c.id === "PEA" ? "Compte-titres et compte espèces du PEA (espèces disponibles : " + O.eur(dos.esp) + ")." : (dos.cto ? "Le client a un compte-titres ordinaire." : "Le client n'en a pas.") }; }), f.compte) + "</fieldset>";
      h += '<fieldset class="op-section ob-fs"><legend id="ob-l-type">Type d\'ordre *</legend>' + radios("type", O.TYPES, f.type) + "</fieldset>";
      h += '<div class="ob-champs">' + champ("quantite", "Quantité (nombre de titres) *", f.quantite, "Le client a demandé " + d.quantite + (d.sens === "vente" ? " ; il en détient " + dos.detient + "." : "."), { mode: "numeric", champ: "quantite" });
      if (ty && ty.limite) h += champ("limite", "Limite de prix (€) *", f.limite, d.sens === "achat" ? "Prix maximal payé par titre. Pas de cotation : 0,01 €." : "Prix minimal reçu par titre. Pas de cotation : 0,01 €.", { champ: "limite" });
      if (ty && ty.seuil) h += champ("seuil", "Seuil de déclenchement (€) *", f.seuil, "Dernier cours : " + O.prixTxt(v.cours) + ". " + (d.sens === "vente" ? "Une vente se déclenche si le cours passe sous le seuil." : "Un achat se déclenche si le cours monte jusqu'au seuil."), { champ: "seuil" });
      h += "</div>";
      h += '<fieldset class="op-section ob-fs"><legend id="ob-l-val">Durée de validité *</legend>' + radios("val", O.VALIDITES, f.validite) + "</fieldset>";
      if (f.validite === "date") h += '<div class="ob-champs">' + champ("jusquau", "Valable jusqu'au *", f.jusquau, "Dans les 365 jours qui suivent.", { type: "date", champ: "jusquau" }) + "</div>";
    } else if (dec === "refuser") {
      h += '<fieldset class="op-section ob-fs"><legend id="ob-l-motif">Motif du refus *</legend>' + radios("motif", O.MOTIFS, f.motif) + "</fieldset>";
      h += '<fieldset class="op-section ob-fs"><legend id="ob-l-orient">Ce que vous proposez au client *</legend>' + radios("orient", O.ORIENTATIONS, f.orientation) + "</fieldset>";
    }
    h += '<div class="champ ob-champ"><label for="ob-note">Note interne (facultative)</label><textarea id="ob-note" rows="3" maxlength="300"' + (erreur("note") ? ' aria-invalid="true" aria-describedby="ob-aide-note ob-err"' : ' aria-describedby="ob-aide-note"') + ">" + esc(f.note) + '</textarea><span class="aide-champ" id="ob-aide-note">Pour la directrice et vos collègues. Elle n\'est jamais communiquée au client. 300 signes au plus.</span></div>';
    h += '<div class="ob-btns">' + (dec ? '<button type="button" class="btn btn-secondaire" data-act="controler">Simuler et contrôler</button>' : "") + "</div>";
    h += '<div id="ob-controle" class="ob-controle" tabindex="-1" aria-live="polite">' + controleHtml(etat.ctl, d) + "</div>";
    h += '<div class="msg-erreur" id="ob-err" role="alert">' + (etat.err ? (etat.err.length > 1 ? "<ul>" + etat.err.map(function (e) { return "<li>" + esc(e.msg) + "</li>"; }).join("") + "</ul>" : esc(etat.err[0].msg)) : "") + "</div>";
    h += '<div class="ob-btns"><button type="submit" class="btn btn-principal">Enregistrer le traitement</button><button type="button" class="btn btn-secondaire" data-act="annuler">Annuler</button></div></form>';
    return h;
  }

  /* ---------- demande traitée ---------- */
  function recap(d, t) {
    var v = O.valeur(d.valeur), h = '<dl class="regul-donnees ob-recap">';
    if (t.decision === "refuser") {
      h += "<div><dt>Décision</dt><dd>Ordre non transmis</dd></div><div><dt>Motif</dt><dd>" + esc(lib(O.MOTIFS, t.motif)) + "</dd></div><div><dt>Proposition au client</dt><dd>" + esc(lib(O.ORIENTATIONS, t.orientation)) + "</dd></div>";
    } else {
      var ty = O.type(t.type), r = t.resultat;
      h += "<div><dt>Décision</dt><dd>Ordre transmis</dd></div><div><dt>Compte</dt><dd>" + esc(lib(O.COMPTES, t.compte)) + "</dd></div><div><dt>Ordre</dt><dd>" + esc(d.sens === "achat" ? "Achat" : "Vente") + " de " + esc(pl(t.quantite, "titre", "titres")) + " " + esc(v.nom) + " – " + esc(ty.lib.toLowerCase()) + "</dd></div>";
      if (t.limite != null) h += "<div><dt>Limite de prix</dt><dd>" + esc(O.prixTxt(t.limite)) + "</dd></div>";
      if (t.seuil != null) h += "<div><dt>Seuil de déclenchement</dt><dd>" + esc(O.prixTxt(t.seuil)) + "</dd></div>";
      h += "<div><dt>Validité</dt><dd>" + esc(lib(O.VALIDITES, t.validite)) + (t.jusquau ? " – jusqu'au " + esc(dateLongue(t.jusquau)) : "") + "</dd></div>";
      h += '<div><dt>Avis d\'opéré simulé</dt><dd class="ob-rep">' + avis(d, Object.assign({}, r, { seance: null, besoin: 0 })) + "</dd></div>";
    }
    if (t.note) h += "<div><dt>Note interne</dt><dd>" + esc(t.note) + "</dd></div>";
    h += "<div><dt>Traité le</dt><dd>" + esc(dateLongue(t.date)) + " à " + esc(heure(t.heure)) + (t.par ? " par " + esc(t.par) : "") + "</dd></div></dl>";
    h += '<div class="ob-expl"><p class="ob-ctl-t">Ce qu\'il fallait voir dans cette demande</p><p>' + esc(d.explication) + "</p></div>";
    if (t.points && t.points.length) h += '<div class="ob-ctl ob-ctl-warn"><p class="ob-ctl-t">' + ICO.info + "Points d'attention (" + t.points.length + ")</p><ul>" + t.points.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div>";
    return h;
  }
  function confirmation(d, t) {
    return '<section class="bloc ob-ok" id="ob-ok" aria-labelledby="ob-t-ok"><div class="bloc-tete"><h2 id="ob-t-ok" tabindex="-1">' + ICO.check + "Traitement enregistré</h2><span class=\"sous\">Demande " + esc(d.id) + "</span></div>" +
      '<p class="ob-ok-txt">' + (t.decision === "transmettre" ? "L\'ordre est enregistré dans l\'outil : cet outil ne transmet rien à une vraie Bourse. L\'avis d\'opéré est une simulation, d\'après le carnet d\'ordres de la séance." : "La demande n\'est pas transmise : il reste à répondre au client, avec la proposition retenue.") + "</p>" + recap(d, t) +
      '<div class="ob-btns"><button type="button" class="btn btn-secondaire" data-act="fermer-ok">Fermer</button><button type="button" class="btn btn-secondaire" data-act="voir-traites">Voir les demandes traitées</button></div></section>';
  }
  function confirmRemettre(d) {
    return '<div class="ob-conf" id="ob-conf" tabindex="-1" role="group" aria-labelledby="ob-conf-t"><p id="ob-conf-t"><strong>Remettre la demande ' + esc(d.id) + " à traiter ?</strong> Le traitement et la note enregistrés seront effacés.</p>" +
      '<div class="ob-btns"><button type="button" class="btn btn-principal" data-act="remettre-ok" data-id="' + esc(d.id) + '">Remettre à traiter</button><button type="button" class="btn btn-secondaire" data-act="remettre-non" data-id="' + esc(d.id) + '">Annuler</button></div></div>';
  }
  function carte(d) {
    var t = O.traitement(st(), d.id), v = O.valeur(d.valeur), ouvert = etat.ouvert === d.id, h;
    h = '<li class="regul-carte ob-carte ob-carte-' + (t ? "traite" : "attente") + '" id="ob-' + esc(d.id) + '">' + entete(d, v, t) + citation(d) + faits(d, v) + carnet(v);
    if (t) {
      h += recap(d, t);
      h += etat.conf === d.id ? confirmRemettre(d) : '<div class="ob-btns"><button type="button" class="btn btn-secondaire" data-act="remettre" data-id="' + esc(d.id) + '">Remettre à traiter</button></div>';
    } else if (ouvert) h += '<div id="ob-zone">' + formHtml(d) + "</div>";
    else h += '<div class="ob-btns"><button type="button" class="btn btn-principal" data-act="traiter" data-id="' + esc(d.id) + '">Traiter cette demande</button></div>';
    return h + "</li>";
  }
  function listeHtml(b) {
    var l = O.liste().filter(function (d) { var t = O.traitement(st(), d.id); return etat.filtre === "tous" || (etat.filtre === "traites" ? !!t : !t); });
    var h = '<section class="bloc" aria-labelledby="ob-t-liste"><div class="bloc-tete"><h2 id="ob-t-liste" tabindex="-1">Demandes des clients</h2><span class="sous">' + pl(l.length, "demande affichée", "demandes affichées") + " – dans l'ordre d'arrivée</span></div>" + filtres(b);
    if (!l.length) return h + '<p class="vide-bloc">' + (etat.filtre === "atraiter" ? "Toutes les demandes sont traitées. Elles sont consultables, et peuvent être remises à traiter, dans l'onglet « Traités »." : "Aucune demande traitée pour le moment. Choisissez une demande, vérifiez le compte, composez l'ordre puis simulez-le.") + "</p></section>";
    return h + '<ul class="regul-liste ob-liste">' + l.map(carte).join("") + "</ul></section>";
  }

  /* ---------- règles et sources ---------- */
  var REGLES = [
    ["Les types d'ordres", "Au marché : exécuté sans condition de prix, prioritaire, sans aucune maîtrise du prix (AMF). À la meilleure limite : exécuté au meilleur prix du carnet, le solde devient un ordre à cours limité à ce prix. À cours limité : prix maximal à l'achat, minimal à la vente, l'exécution n'est pas garantie. À seuil de déclenchement : devient un ordre au marché quand le seuil est atteint. À plage de déclenchement : devient un ordre à cours limité quand le seuil est atteint."],
    ["La priorité dans le carnet", "Priorité par le prix : l'acheteur qui propose le prix le plus élevé et le vendeur qui demande le prix le plus bas sont servis d'abord ; l'ordre au marché passe avant les ordres à la meilleure limite et à cours limité. Priorité par le temps : à même sens et même prix, les ordres s'exécutent dans l'ordre d'arrivée (AMF)."],
    ["La durée de validité", "« Jour » : la séance en cours, par défaut. « À date déterminée » : jusqu'à la date fixée. « À révocation » : 365 jours (AMF). Les durées autorisées sont précisées dans la convention de compte. GS limite l'ordre à date déterminée à 365 jours (convention de l'exercice)."],
    ["Le PEA : espèces, titres éligibles", "Le compte espèces d'un PEA ne peut pas présenter de solde débiteur : l'achat doit être couvert, courtage et taxe compris (BOFiP BOI-RPPM-RCM-40-50-20-20, § 40). Titres éligibles : sociétés ayant leur siège dans l'Union européenne ou dans l'Espace économique européen, et parts d'OPC investis à plus de 75 % en titres éligibles. La vente à découvert et le service à règlement différé ne sont pas possibles dans un PEA (AMF)."],
    ["La taxe sur les transactions financières", "Article 235 ter ZD du Code général des impôts : 0,4 % du prix d'acquisition des actions de sociétés ayant leur siège en France et une capitalisation supérieure à un milliard d'euros au 1er décembre de l'année précédente, depuis le 1er avril 2025. Elle frappe l'achat, pas la vente ; elle est due par le prestataire qui exécute l'ordre et il la prélève sur le client. Le texte lu est indiqué en vigueur jusqu'au 31 décembre 2026 : à revérifier avant 2027."],
    ["Séance, ordre aberrant, règlement-livraison", "Euronext Paris : pré-ouverture de 7 h 15 à 9 h 00 (les ordres sont enregistrés sans être exécutés), négociation continue de 9 h 00 à 17 h 30, fixing de clôture jusqu'à 17 h 35 (Les clés de la banque). Un teneur de compte peut rejeter un ordre dont la limite est trop éloignée du dernier cours : l'AMF ne fixe pas de seuil, GS retient 20 % (convention de l'exercice). Le règlement-livraison intervient au plus tard le deuxième jour de négociation suivant l'exécution (T+2) ; il passera à T+1 le 11 octobre 2027 (AMF)."]
  ];
  function regles() {
    return '<section class="bloc" aria-labelledby="ob-t-regles"><div class="bloc-tete"><h2 id="ob-t-regles">Les règles à connaître</h2><span class="sous">Textes consultés le 17 novembre 2026</span></div>' +
      REGLES.map(function (r) { return '<details class="ob-regle"><summary>' + esc(r[0]) + "</summary><p>" + esc(r[1]) + "</p></details>"; }).join("") + "</section>";
  }

  /* Typographie française : espace insécable avant « : », « % » et « € », dans les nombres à milliers et à l'intérieur des guillemets. */
  function typo(racine) {
    var w = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT, null), n, l = [];
    while ((n = w.nextNode())) { if (n.parentNode && /^(SCRIPT|STYLE|OPTION|TEXTAREA)$/.test(n.parentNode.nodeName)) continue; l.push(n); }
    l.forEach(function (t) {
      var v = t.nodeValue, r = v.replace(/ +([:;!?%€»])/g, " $1").replace(/(\d) (?=\d{3}(?!\d))/g, "$1 ").replace(/« +/g, "« ");
      if (r !== v) t.nodeValue = r;
    });
  }
  function render(focus) {
    document.title = "GS Banque & Assurance – Ordres de bourse";
    var b = O.bilan(st()), fait = etat.fait ? O.trouver(etat.fait) : null, tf = fait ? O.traitement(st(), fait.id) : null;
    app.innerHTML = '<nav class="fil-ariane" aria-label="Fil d\'Ariane"><a href="index.html">' + ICO.retour + 'Accueil</a></nav>' +
      '<div class="page-titre"><h1>Ordres de bourse</h1><p>Des clients titulaires d\'un PEA demandent à acheter ou à vendre des titres. Le conseiller vérifie la demande et le compte, choisit le type d\'ordre, la limite de prix et la durée de validité, puis confronte l\'ordre au carnet d\'ordres pour savoir ce qui serait exécuté, à quel prix et pour quel coût.</p></div>' +
      deroule() + vue(b) + (fait && tf ? confirmation(fait, tf) : "") + listeHtml(b) + regles() +
      '<p class="ob-rappel">Sources des règles : AMF (ordres de bourse, durée de validité, ordre aberrant, PEA, règlement-livraison T+1) ; Les clés de la banque (horaires de la Bourse de Paris) ; BOFiP (PEA) ; article 235 ter ZD du Code général des impôts ; calendrier 2026 d\'Euronext Clearing. Les sociétés, les fonds, les codes, les cours et les carnets d\'ordres sont inventés ; les tarifs sont ceux de GS. Le plafond de versements du PEA n\'est pas contrôlé. Aucun ordre n\'est transmis à une vraie Bourse.</p>';
    typo(app);
    if (focus) { var n = document.getElementById(focus); if (n) { try { n.focus(); } catch (e) { /* ignoré */ } if (/^ob-t-/.test(focus) && n.scrollIntoView) n.scrollIntoView({ block: "start" }); } }
  }
  function majForm(focus) {
    var d = etat.ouvert ? O.trouver(etat.ouvert) : null, z = document.getElementById("ob-zone"); if (!d || !z) { render(focus); return; }
    z.innerHTML = formHtml(d); typo(z);
    if (focus) { var n = document.getElementById(focus); if (n) { try { n.focus(); } catch (e) { /* ignoré */ } } }
  }

  /* ---------- actions ---------- */
  function radio(nom) { var r = document.querySelector('#ob-form input[name="ob-' + nom + '"]:checked'); return r ? r.value : ""; }
  function lire() {
    var f = document.getElementById("ob-form"); if (!f) return;
    var g = function (id) { var x = document.getElementById(id); return x ? x.value : null; };
    etat.f.decision = radio("dec"); etat.f.compte = radio("compte"); etat.f.type = radio("type"); etat.f.validite = radio("val"); etat.f.motif = radio("motif"); etat.f.orientation = radio("orient");
    ["quantite", "limite", "seuil", "jusquau", "note"].forEach(function (k) { var x = g("ob-" + k); if (x !== null) etat.f[k] = x; });
  }
  function saisie() { return { decision: etat.f.decision, compte: etat.f.compte, type: etat.f.type, quantite: etat.f.quantite, limite: etat.f.limite, seuil: etat.f.seuil, validite: etat.f.validite, jusquau: etat.f.jusquau, motif: etat.f.motif, orientation: etat.f.orientation, note: etat.f.note }; }
  var CIBLE = { decision: "ob-dec-transmettre", motif: "ob-motif-" + O.MOTIFS[0].id, orientation: "ob-orient-" + O.ORIENTATIONS[0].id, compte: "ob-compte-PEA", type: "ob-type-marche", quantite: "ob-quantite", limite: "ob-limite", seuil: "ob-seuil", validite: "ob-val-jour", jusquau: "ob-jusquau", note: "ob-note", ordre: "ob-err" };
  function enregistrer() {
    lire();
    var d = O.trouver(etat.ouvert); if (!d) return;
    var r = O.valider(st(), d.id, saisie());
    if (!r.ok) {
      etat.err = r.erreurs; etat.ctl = r;
      var c = r.erreurs[0].champ, id = CIBLE[c] || "ob-err";
      if (c === "type" && etat.f.type) id = "ob-type-" + etat.f.type;
      majForm(document.getElementById(id) ? id : "ob-err"); return;
    }
    B.store.sauver();
    etat.fait = d.id; etat.ouvert = null; etat.f = Object.assign({}, VIDE); etat.err = null; etat.ctl = null; etat.conf = null;
    render("ob-t-ok");
  }
  function controler() {
    lire();
    var d = O.trouver(etat.ouvert); if (!d) return;
    etat.err = null; etat.ctl = O.analyser(st(), d.id, saisie());
    majForm("ob-controle");
  }

  app.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-act]") : null; if (!b) return;
    var act = b.getAttribute("data-act"), id = b.getAttribute("data-id");
    if (act === "filtre") { etat.filtre = b.getAttribute("data-f"); etat.ouvert = null; etat.conf = null; render("ob-f-" + etat.filtre); }
    else if (act === "traiter") { etat.ouvert = id; etat.f = Object.assign({}, VIDE); etat.err = null; etat.ctl = null; etat.fait = null; etat.conf = null; render("ob-t-" + id); }
    else if (act === "annuler") { var o = etat.ouvert; etat.ouvert = null; etat.err = null; etat.ctl = null; render(); var bt = document.querySelector('[data-act="traiter"][data-id="' + o + '"]'); if (bt) bt.focus(); }
    else if (act === "controler") controler();
    else if (act === "remettre") { etat.conf = id; etat.ouvert = null; render("ob-conf"); }
    else if (act === "remettre-non") { etat.conf = null; render(); var br = document.querySelector('[data-act="remettre"][data-id="' + id + '"]'); if (br) br.focus(); }
    else if (act === "remettre-ok") { var r = O.remettre(st(), id); if (r.ok) B.store.sauver(); etat.conf = null; render("ob-t-liste"); }
    else if (act === "fermer-ok") { etat.fait = null; render("ob-t-liste"); }
    else if (act === "voir-traites") { etat.fait = null; etat.filtre = "traites"; render("ob-t-liste"); }
  });
  app.addEventListener("submit", function (e) { if (e.target.id === "ob-form") { e.preventDefault(); enregistrer(); } });
  app.addEventListener("change", function (e) {
    var t = e.target; if (!t.closest || !t.closest("#ob-form") || !t.name) return;
    if (!/^ob-(dec|compte|type|val|motif|orient)$/.test(t.name)) return;
    lire(); etat.err = null; etat.ctl = null; majForm(t.id);
  });
  app.addEventListener("input", function (e) {
    var t = e.target;
    if (t.closest && t.closest("#ob-form") && /^ob-(quantite|limite|seuil|jusquau|note)$/.test(t.id)) {
      etat.f[t.id.replace("ob-", "")] = t.value;
      if (etat.ctl) { etat.ctl = null; var z = document.getElementById("ob-controle"); if (z) z.innerHTML = ""; }
    }
  });

  RECH.init(SG.clients, document.getElementById("rech"), document.getElementById("rech-res"), document.getElementById("rech-statut"));
  render();
})();
