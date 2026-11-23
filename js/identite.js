/* GS Banque & Assurance – identité de l'élève : prénom et nom demandés avant le premier document imprimé de chaque connexion.
   Le nom est enregistré dans la sauvegarde partagée (store().eleve.nom, la même que la signature des e-mails) puis reprend automatiquement
   dans l'en-tête de tous les documents (« Établi par : Prénom Nom », voir impression.js) et dans la signature de la messagerie.
   Pourquoi une confirmation à chaque connexion : dans une salle informatique, plusieurs élèves peuvent se servir du même ordinateur, donc du même navigateur.
   Le nom enregistré par le précédent n'est jamais repris sans être montré : à la première impression d'une connexion, la fenêtre s'ouvre avec ce nom déjà
   écrit, et l'élève le corrige ou le confirme. La confirmation est effacée à la déconnexion et à la fermeture de l'onglet (sessionStorage, voir acces.js).
   Aucun texte du site n'écrit un nom d'élève à la place de celui qui est saisi : tout vient de cette fenêtre. */
(function (root) {
  "use strict";

  var MAX_NOM = 60;
  var CLE = "sgbf.eleve";            /* clé de session : même valeur dans acces.js (effacée à la déconnexion) */
  var confirmeMemoire = false;       /* secours si le stockage de session est indisponible : valable pour la page en cours */

  function propre(s) { return String(s == null ? "" : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ""); }
  function espaces(s) { return propre(s).replace(/\s+/g, " ").trim(); }

  /* Un prénom et un nom : lettres, apostrophes, tirets et espaces, deux mots au moins. */
  function nomValide(v) {
    var n = espaces(v);
    if (n.length < 3 || n.length > MAX_NOM || !/^[\p{L}][\p{L}' -]*$/u.test(n) || n.split(" ").length < 2) return { ok: false, erreur: "Saisissez votre prénom et votre nom (lettres uniquement, " + MAX_NOM + " caractères au plus)." };
    return { ok: true, nom: n };
  }
  /* Nom enregistré s'il est valide, sinon chaîne vide. */
  function nom(st) {
    var n = st && st.eleve && typeof st.eleve.nom === "string" ? st.eleve.nom : "";
    var v = nomValide(n);
    return v.ok ? v.nom : "";
  }
  /* Enregistre le nom dans l'état (le navigateur l'écrit ensuite avec store.sauver) ; la classe, facultative, n'est jamais modifiée ici. */
  function definir(st, valeur) {
    var v = nomValide(valeur);
    if (!v.ok) return { ok: false, champ: "nom", erreur: v.erreur };
    if (!st.eleve || typeof st.eleve !== "object") st.eleve = { nom: "", classe: "" };
    st.eleve.nom = v.nom;
    return { ok: true, nom: v.nom };
  }

  /* ---------- confirmation pour la connexion en cours ---------- */
  function confirme() {
    try { if (root.sessionStorage) return root.sessionStorage.getItem(CLE) === "1"; } catch (e) { /* stockage de session indisponible : la mémoire de la page prend le relais */ }
    return confirmeMemoire;
  }
  function confirmer() {
    confirmeMemoire = true;
    try { root.sessionStorage.setItem(CLE, "1"); } catch (e) { /* ignoré : la confirmation vaut alors pour la page en cours */ }
  }
  function oublier() {
    confirmeMemoire = false;
    try { root.sessionStorage.removeItem(CLE); } catch (e) { /* ignoré */ }
  }

  var api = { MAX_NOM: MAX_NOM, CLE: CLE, nomValide: nomValide, nom: nom, definir: definir, confirme: confirme, confirmer: confirmer, oublier: oublier };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (!root) return;
  root.SGBF = root.SGBF || {}; root.SGBF.identite = api;

  /* ---------- navigateur : état partagé, document, fenêtre de saisie ---------- */
  function store() { return root.SGBF.banque.store.charger(); }
  /* Nom à inscrire sur un document : celui de la sauvegarde partagée s'il est valide. */
  api.nomCourant = function () { return nom(store()); };
  /* Enregistre (validé), écrit la sauvegarde et marque la connexion comme confirmée. */
  api.enregistrer = function (valeur) {
    var r = definir(store(), valeur);
    if (r.ok) { root.SGBF.banque.store.sauver(); confirmer(); }
    return r;
  };

  /* Remplit les mentions « Établi par » d'un document monté ; sans nom valide, la mention est retirée plutôt que laissée vide. */
  api.remplir = function (zone) {
    var n = api.nomCourant();
    [].slice.call(zone.querySelectorAll("[data-auteur]")).forEach(function (p) {
      var s = p.querySelector("[data-eleve]");
      if (!n) { if (p.parentNode) p.parentNode.removeChild(p); } else if (s) s.parentNode.replaceChild(root.document.createTextNode(n), s);
    });
  };

  var dlg = null, apres = null, ouvreur = null;
  function fermer() {
    if (!dlg) return;
    if (dlg.open) { if (dlg.close) dlg.close(); else dlg.removeAttribute("open"); }
    var o = ouvreur; ouvreur = null;
    if (o && o.focus && root.document.contains(o)) { try { o.focus(); } catch (e) { /* ignoré */ } }
  }
  function erreur(msg) {
    var champ = root.document.getElementById("id-dlg-nom"), e = root.document.getElementById("id-dlg-err");
    e.textContent = msg || "";
    if (msg) { champ.setAttribute("aria-invalid", "true"); champ.focus(); } else champ.removeAttribute("aria-invalid");
  }
  function construire() {
    var d = root.document;
    dlg = d.createElement("dialog");
    dlg.id = "id-dlg"; dlg.className = "id-dlg";
    dlg.setAttribute("aria-labelledby", "id-dlg-titre"); dlg.setAttribute("aria-describedby", "id-dlg-aide");
    dlg.innerHTML = '<form class="id-dlg-corps" id="id-dlg-form" novalidate>' +
      '<h2 id="id-dlg-titre">Qui établit ce document ?</h2>' +
      '<p id="id-dlg-aide" class="id-aide">Votre prénom et votre nom seront inscrits en haut du document (« Établi par »). Ils sont demandés une fois par connexion.</p>' +
      '<div class="id-champ"><label for="id-dlg-nom">Prénom et nom de l\'élève <span aria-hidden="true">*</span></label>' +
      '<input id="id-dlg-nom" type="text" maxlength="' + MAX_NOM + '" autocomplete="name" required aria-required="true" aria-describedby="id-dlg-ex id-dlg-err">' +
      '<p id="id-dlg-ex" class="id-aide">Exemple : Camille Durand</p></div>' +
      '<p id="id-dlg-err" class="id-err" role="alert"></p>' +
      '<div class="id-btns"><button type="submit" class="btn btn-principal">Valider et imprimer</button><button type="button" class="btn btn-secondaire" id="id-dlg-annuler">Annuler</button></div></form>';
    d.body.appendChild(dlg);
    d.getElementById("id-dlg-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var r = api.enregistrer(d.getElementById("id-dlg-nom").value);
      if (!r.ok) { erreur(r.erreur); return; }
      var suite = apres; apres = null;
      fermer();
      if (suite) suite();
    });
    d.getElementById("id-dlg-nom").addEventListener("input", function () { if (d.getElementById("id-dlg-err").textContent) erreur(""); });
    d.getElementById("id-dlg-annuler").addEventListener("click", function () { apres = null; fermer(); });
    /* Échap (ou fermeture par le navigateur) : la fenêtre se ferme sans rien imprimer et le focus revient sur le bouton qui l'avait ouverte. */
    dlg.addEventListener("close", function () {
      var o = ouvreur; ouvreur = null; apres = null;
      if (o && o.focus && d.contains(o)) { try { o.focus(); } catch (e) { /* ignoré */ } }
    });
    /* Navigateur sans <dialog> modal : Échap est géré ici. */
    dlg.addEventListener("keydown", function (e) { if (e.key === "Escape" && !dlg.showModal) { apres = null; fermer(); } });
  }
  /* Lance « suite » quand un nom valide est confirmé pour cette connexion ; sinon ouvre la fenêtre de saisie (nom déjà enregistré affiché pour contrôle). */
  api.exiger = function (suite) {
    if (api.nomCourant() && confirme()) { suite(); return; }
    if (!dlg) construire();
    apres = suite;
    ouvreur = root.document.activeElement;
    var champ = root.document.getElementById("id-dlg-nom");
    /* Nom valide : proposé tel quel ; nom incomplet resté d'une ancienne saisie : proposé aussi, pour que l'élève le complète. */
    var st = store();
    champ.value = api.nomCourant() || (st.eleve && typeof st.eleve.nom === "string" ? espaces(st.eleve.nom).slice(0, MAX_NOM) : "");
    erreur("");
    if (dlg.showModal) { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute("open", "");
    champ.focus();
    if (champ.value) champ.select();
  };
})(typeof window !== "undefined" ? window : null);
