/* GS Banque & Assurance – contrats des souscriptions : affichage de l'état, boutons d'action (envoi pour signature électronique, génération du contrat, signature en agence),
   aperçu de l'e-mail envoyé et impression du contrat. Les règles sont dans contrats.js. */
(function () {
  "use strict";

  var B = window.SGBF.banque, CT = window.SGBF.contrats, PR = window.SGBF.produits, K = window.SGBF.catalogue, IMP = window.SGBF.impression, CL = window.SGBF.clients, TP = window.SGBF.tampon;
  var esc = B.esc;
  var CLIENT = {}; CL.forEach(function (c) { CLIENT[c.id] = c; });
  var PRO = window.SGBF.prospects;
  /* Le client d'une souscription : portefeuille, ou client créé pendant l'exercice (ouverture de compte d'un prospect). */
  function qui(id) { return CLIENT[id] || (PRO ? PRO.clientsOuverts(B.store.charger()).filter(function (c) { return c.id === id; })[0] : null) || null; }
  var CHIP = { ok: "chip-ok", warn: "chip-warn", bad: "chip-bad", info: "chip-ctrl" };
  function store() { return B.store.charger(); }
  function fmt(ymd) { return B.fmtDate(B.lireYmd(ymd)); }

  /* Texte seul : « Signé électroniquement », « À générer et à faire signer en agence »… */
  function libelle(s) { var e = CT.etat(s); return e ? e.libelle : ""; }

  /* État du contrat d'une souscription : pastille, détail et délai de rétractation (sans boutons). */
  function statutHtml(s) {
    var e = CT.etat(s); if (!e) return '<span class="pf-sous">Pas de contrat enregistré</span>';
    var ct = CT.contrat(s), r = CT.retractation(s);
    return '<span class="chip ' + CHIP[e.ton] + '">' + esc(e.libelle) + '</span><span class="pf-sous">' + esc(ct.doc) + " – réf. " + esc(ct.ref) + '</span><span class="pf-sous">' + esc(e.detail) + '</span><span class="pf-sous">' + esc(r.texte) + "</span>";
  }
  function boutonsHtml(s) {
    var e = CT.etat(s); if (!e) return "";
    var c = qui(s.c), p = PR.parId[s.p], cible = " : " + esc(c.prenom + " " + c.nom) + ", " + esc(p.nom);
    return e.actions.map(function (a) {
      var lib = a === "envoyer" ? (e.code === "a_envoyer" ? "Envoyer le contrat pour signature" : "Renvoyer le contrat pour signature") : a === "generer" ? (e.code === "genere" ? "Réimprimer le contrat" : "Générer le contrat (impression)") : "Le client a signé : l'enregistrer";
      return '<button type="button" class="btn-texte ct-btn" data-act="ct-' + a + '" data-id="' + esc(s.id) + '" aria-label="' + esc(lib) + cible + '">' + esc(lib) + "</button>";
    }).join(" ");
  }
  function celluleHtml(s) { return '<div class="ct-etat">' + statutHtml(s) + "</div>" + (boutonsHtml(s) ? '<div class="ct-actions">' + boutonsHtml(s) + "</div>" : ""); }

  /* Aperçu de l'e-mail envoyé au client pour signature. */
  function emailHtml(s, relance) {
    var c = qui(s.c), m = CT.emailEnvoi(s, c, relance);
    return '<div class="ct-mail"><p class="ct-mail-tete"><span>À : ' + esc(m.a) + "</span><span>Objet : " + esc(m.objet) + "</span></p><p class=\"ct-mail-corps\">" + esc(m.corps.join("\n")) + "</p></div>";
  }

  /* Contrat à imprimer (mode « papier »). */
  function corpsContrat(s, c, st) {
    var d = CT.contenu(s, c, st);
    function table(l) { return '<table class="dp-pf dp-contrat"><tbody>' + l.map(function (x) { return '<tr><th scope="row" class="g">' + esc(x.lib) + '</th><td class="g">' + esc(x.val) + "</td></tr>"; }).join("") + "</tbody></table>"; }
    var cosign = d.cosignataires && d.cosignataires.length ? d.cosignataires : (d.cosignataire ? [d.cosignataire] : []);
    function liste(l) { return '<ul class="dp-liste">' + l.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>"; }
    return '<section class="dp-bloc"><h2>Entre les soussignés</h2>' + table(d.parties) + "</section>" +
      '<section class="dp-bloc"><h2>Objet du contrat</h2>' + table(d.lignes) + "</section>" +
      '<section class="dp-bloc"><h2>Caractéristiques</h2>' + liste(d.caracteristiques) + "</section>" +
      '<section class="dp-bloc"><h2>Conditions tarifaires</h2><table class="dp-pf"><thead><tr><th scope="col" class="g">Poste</th><th scope="col" class="g">Tarif</th></tr></thead><tbody>' + d.tarifs.map(function (t) { return '<tr><td class="g">' + esc(t.lib) + '</td><td class="g">' + esc(t.val) + "</td></tr>"; }).join("") + "</tbody></table></section>" +
      '<section class="dp-bloc"><h2>' + (d.cosignataire ? "Déclarations des titulaires" : "Déclarations du client") + '</h2>' + liste(d.clauses) + "</section>" +
      '<section class="dp-bloc"><h2>Droit de rétractation</h2><p class="dp-texte">' + esc(d.retractation) + "</p></section>" +
      '<section class="dp-bloc dp-signatures"><p class="dp-texte">' + esc(TP.faitA(B.aujourdhui())) + ', en deux exemplaires dont un remis ' + (d.cosignataire ? "aux titulaires" : "au client") + '.</p><div class="dp-sign-cadres' + (d.cosignataire ? (cosign.length > 2 ? " dp-sign-n" : " dp-sign-3") : "") + '"><div><p><strong>' + esc(d.signataire || "Le client") + '</strong></p><p>Mention manuscrite « lu et approuvé, bon pour accord »</p></div>' + cosign.map(function (x) { return '<div><p><strong>' + esc(x) + '</strong></p><p>Mention manuscrite « lu et approuvé, bon pour accord »</p></div>'; }).join("") + '<div><p><strong>La banque</strong></p><p>Le conseiller clientèle</p>' + TP.zoneBanque(B.aujourdhui()) + '</div></div></section>' +
      '<p class="dp-mention">' + esc(d.legales) + "</p>";
  }
  function imprimer(s) {
    var st = store(), c = qui(s.c), d = CT.contenu(s, c, st);
    IMP.imprimer(IMP.document({ titre: d.titre, sous: d.sous, corps: corpsContrat(s, c, st) }), "Contrat_" + IMP.nomFichier(c.prenom + " " + c.nom) + "_" + s.p + "_" + CT.contrat(s).ref);
  }

  /* Action demandée par un bouton. Renvoie { ok, message, email } ; l'état est enregistré. */
  function agir(act, id) {
    var st = store(), s = (st.souscriptions || []).filter(function (x) { return x.id === id; })[0], c = s && qui(s.c);
    if (!s || !c) return { ok: false, message: "Souscription introuvable." };
    var r;
    if (act === "envoyer") {
      r = CT.envoyer(st, id); if (!r.ok) return { ok: false, message: r.erreur };
      B.store.sauver();
      return { ok: true, message: (r.relance ? "Contrat renvoyé" : "Contrat envoyé") + " à " + c.prenom + " " + c.nom + " pour signature électronique (" + B.fmtDate(B.lireYmd(r.envoi.date)) + " à " + r.envoi.heure.replace(":", " h ") + "). Le client reçoit un e-mail avec un lien ; la signature apparaît ici dès qu'il l'a faite.", email: emailHtml(s, r.relance) };
    }
    if (act === "generer") {
      r = CT.generer(st, id); if (!r.ok) return { ok: false, message: r.erreur };
      B.store.sauver(); imprimer(s);
      return { ok: true, message: "Contrat généré pour " + c.prenom + " " + c.nom + " : imprimez-le en deux exemplaires, faites-le signer au client, puis enregistrez la signature." };
    }
    if (act === "signer") {
      r = CT.signerEnAgence(st, id); if (!r.ok) return { ok: false, message: r.erreur };
      B.store.sauver();
      return { ok: true, message: "Signature enregistrée : le contrat de " + c.prenom + " " + c.nom + " est signé en agence. Remettez un exemplaire au client." };
    }
    return { ok: false, message: "Action inconnue." };
  }

  window.SGBF.uiContrats = { libelle: libelle, statutHtml: statutHtml, boutonsHtml: boutonsHtml, celluleHtml: celluleHtml, emailHtml: emailHtml, corpsContrat: corpsContrat, imprimer: imprimer, agir: agir };
})();
