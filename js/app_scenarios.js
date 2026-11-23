/* GS Banque & Assurance – écran « Simulations d'appels » : l'enseignant choisit un scénario, lit le script du client (ce que dit le client, ses réponses, ce que le conseiller doit faire),
   puis lance l'appel : le client choisi appelle le poste cinq secondes plus tard (fenêtre d'appel, sonnerie). Le script peut être imprimé pour la personne qui joue le client.
   Chargé à la demande par app_appels.js (ouvert en tapant « simulation » dans la recherche de l'en-tête) ; les scénarios sont dans scenarios_appels.js. Aucun réglage. */
(function (root) {
  "use strict";
  var doc = root.document, W = root.SGBF, S = W && W.scenarios, A = W && W.appels, AL = W && W.alertes;
  if (!doc || !S || !A || !AL) return;
  var esc = AL.esc;

  var dlg = null, vue = "liste", courant = null, rangs = {}, toast = null, tToast = null, impr = null;

  function etat() { return AL.etat(); }
  function candidatsDe(sc) { return S.candidats(sc, W.clients || [], AL.ctx(), 12); }
  function clientDe(id) { var l = W.clients || []; for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
  function script(sc) {
    var ids = candidatsDe(sc), r = ids.length ? (rangs[sc.id] || 0) % ids.length : 0, id = ids.length ? ids[r] : null;
    if (id === null) return { sc: sc, ids: ids, rang: 0, doc: null };
    return { sc: sc, ids: ids, rang: r, doc: S.construire(sc, id === 0 ? null : clientDe(id), AL.ctx()), id: id };
  }

  /* ---------- liste des scénarios ---------- */
  function htmlListe() {
    var h = '<h2 id="sim-titre">Simulations d\'appels</h2>' +
      '<p class="sim-intro">Choisissez un scénario. Le client choisi appelle le poste cinq secondes après « Lancer l\'appel » : la fenêtre d\'appel s\'affiche et le téléphone sonne. ' +
      'La personne qui joue le client (l\'enseignant) lit le script du scénario ; le conseiller (l\'élève) ne voit que le nom du client dans la fenêtre d\'appel.</p><ul class="sim-liste">';
    S.LISTE.forEach(function (s) {
      h += '<li><button type="button" class="sim-carte" data-sc="' + esc(s.id) + '"><span class="sim-carte-titre">' + esc(s.titre) + '</span>' +
        '<span class="sim-carte-meta">' + esc(s.theme) + " · " + esc(s.niveau) + " · " + esc(s.duree) + "</span>" +
        '<span class="sim-carte-resume">' + esc(s.resume) + "</span></button></li>";
    });
    return h + '</ul><div class="appels-dlg-act"><button type="button" class="btn-texte appels-fermer" data-fermer>Fermer</button></div>';
  }

  /* ---------- script d'un scénario (écran et impression) ---------- */
  function corpsScript(d, avecLiens) {
    var h = "";
    h += '<h3 class="sim-h3">Le client</h3><dl class="sim-id">' + d.identite.map(function (x) { return "<div><dt>" + esc(x[0]) + "</dt><dd>" + esc(x[1]) + "</dd></div>"; }).join("") + "</dl>";
    h += '<h3 class="sim-h3">Ce que dit le client en décrochant</h3><blockquote class="sim-dit">« ' + esc(d.accroche) + " »</blockquote>";
    h += '<h3 class="sim-h3">Ce que sait le client</h3><p class="sim-aide">Pour répondre aux questions du conseiller sans rien inventer.</p><ul class="sim-ul">' + d.infos.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
    h += '<h3 class="sim-h3">Réponses du client aux questions du conseiller</h3><table class="sim-t"><thead><tr><th scope="col">Si le conseiller demande…</th><th scope="col">Le client répond…</th></tr></thead><tbody>' +
      d.repliques.map(function (x) { return "<tr><td>" + esc(x[0]) + "</td><td>" + esc(x[1]) + "</td></tr>"; }).join("") + "</tbody></table>";
    if (d.questions && d.questions.length) {
      h += '<h3 class="sim-h3">Questions que le client peut poser</h3><table class="sim-t"><thead><tr><th scope="col">Le client demande…</th><th scope="col">Réponse attendue du conseiller</th></tr></thead><tbody>' +
        d.questions.map(function (x) { return "<tr><td>" + esc(x[0]) + "</td><td>" + esc(x[1]) + "</td></tr>"; }).join("") + "</tbody></table>";
    }
    h += '<h3 class="sim-h3">Ce que le conseiller doit faire</h3><ol class="sim-ol">' + d.etapes.map(function (e) {
      return "<li>" + esc(e.t) + (avecLiens && e.lien ? ' <a class="sim-lien" href="' + esc(e.lien.href) + '">' + esc(e.lien.lib) + "</a>" : "") + "</li>";
    }).join("") + "</ol>";
    h += '<h3 class="sim-h3">Pour finir l\'appel</h3><p class="sim-p">' + esc(d.fin) + "</p>";
    h += '<h3 class="sim-h3">Points de vigilance</h3><ul class="sim-ul">' + d.vigilance.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
    return h;
  }
  function htmlDetail(sv) {
    var sc = sv.sc, d = sv.doc, s = etat(), h = "";
    h += '<p class="sim-retour"><button type="button" class="appel-sec-btn" data-act="retour">‹ Tous les scénarios</button></p>';
    h += '<h2 id="sim-titre">' + esc(sc.titre) + '</h2><p class="sim-meta">' + esc(sc.theme) + " · " + esc(sc.niveau) + " · " + esc(sc.duree) + '</p><p class="sim-p">' + esc(sc.resume) + "</p>";
    if (!d) return h + '<p class="sim-alerte">Aucun client du portefeuille ne correspond au profil de ce scénario.</p>';
    h += '<p class="sim-profil"><strong>Profil du client :</strong> ' + esc(sc.profil) + "</p>";
    var lanceur = "";
    if (s.courant) lanceur = '<p class="sim-alerte" role="status">Un appel est déjà en cours : raccrochez avant d\'en lancer un autre.</p>';
    else if (!s.dispo) lanceur = '<p class="sim-alerte" role="status">Le conseiller est indisponible : aucun appel ne s\'affiche. <button type="button" class="appel-lien-btn" data-act="dispo">Redevenir disponible</button></p>';
    else if (s.lance) lanceur = '<p class="sim-alerte" role="status">Un appel est programmé : il sonne dans quelques secondes. <button type="button" class="appel-lien-btn" data-act="annuler">Annuler l\'appel</button></p>';
    var peut = !s.courant && s.dispo && !s.lance;
    h += lanceur + '<div class="sim-actions"><button type="button" class="sim-btn" data-act="lancer"' + (peut ? "" : " disabled") + '>Lancer l\'appel</button>' +
      '<button type="button" class="btn-texte" data-act="imprimer">Imprimer le script</button>' +
      (sv.ids.length > 1 ? '<button type="button" class="btn-texte" data-act="autre">Autre client (' + (sv.rang + 1) + " sur " + sv.ids.length + ")</button>" : "") + "</div>";
    return h + corpsScript(d, true) + '<div class="appels-dlg-act"><button type="button" class="btn-texte appels-fermer" data-fermer>Fermer</button></div>';
  }

  function rendre() {
    if (!dlg) return;
    if (vue === "liste" || !courant) { dlg.innerHTML = htmlListe(); return; }
    dlg.innerHTML = htmlDetail(script(courant));
  }
  function titre() { var t = dlg.querySelector("h2"); if (t) { t.setAttribute("tabindex", "-1"); t.focus(); } }

  /* ---------- impression du script ---------- */
  function imprimer() {
    var sv = script(courant);
    if (!sv.doc) return;
    if (!impr) { impr = doc.createElement("div"); impr.id = "sim-impression"; impr.className = "sim-impression"; doc.body.appendChild(impr); }
    impr.innerHTML = '<header class="sim-impr-tete"><p class="sim-impr-banque">GS Banque &amp; Assurance – Agence de Paris</p><h1>Simulation d\'appel : ' + esc(sv.sc.titre) + '</h1><p>' + esc(sv.sc.theme) + " · " + esc(sv.sc.niveau) + " · " + esc(sv.sc.duree) + '</p><p class="sim-impr-role">Script de la personne qui joue le client</p></header>' + corpsScript(sv.doc, false);
    doc.body.classList.add("sim-impression-actif");
    var fin = function () { doc.body.classList.remove("sim-impression-actif"); root.removeEventListener("afterprint", fin); };
    root.addEventListener("afterprint", fin);
    try { root.print(); } catch (e) { fin(); }
  }

  /* ---------- lancement ---------- */
  function annoncer(texte) {
    if (!toast) { toast = doc.createElement("p"); toast.id = "sim-toast"; toast.className = "sim-toast"; toast.setAttribute("role", "status"); doc.body.appendChild(toast); }
    toast.textContent = texte; toast.hidden = false;
    clearTimeout(tToast); tToast = setTimeout(function () { toast.hidden = true; }, 5000);
  }
  function lancer() {
    var sv = script(courant);
    if (!sv.doc) return;
    var ok = false;
    AL.agir(function (s, n) { ok = A.programmer(s, n, sv.id === 0 ? 0 : sv.id, { titre: sv.sc.titre, tel: sv.doc.nonClient ? sv.doc.tel : "" }); return ok; });
    if (!ok) { rendre(); return; }
    fermer();
    annoncer("Appel programmé : « " + sv.sc.titre + " ». Il sonne dans " + Math.round(A.DELAI_LANCEMENT / 1000) + " secondes.");
  }

  /* ---------- fenêtre ---------- */
  function fermer() { if (dlg.close) dlg.close(); else { dlg.removeAttribute("open"); surFermeture(); } }
  function surFermeture() { var b = AL.bouton(); if (b) b.focus(); }
  function creer() {
    dlg = doc.createElement("dialog");
    dlg.id = "sim-dlg"; dlg.className = "appels-dlg sim-dlg"; dlg.setAttribute("aria-labelledby", "sim-titre");
    doc.body.appendChild(dlg);
    dlg.addEventListener("click", function (e) {
      var t = e.target.closest ? e.target : null;
      if (!t) return;
      var sel = t.closest("[data-sc]"), act = t.closest("[data-act]"), f = t.closest("[data-fermer]");
      if (f) { fermer(); return; }
      if (sel) { courant = S.PAR_ID[sel.getAttribute("data-sc")] || null; vue = "detail"; rendre(); titre(); return; }
      if (!act) return;
      var a = act.getAttribute("data-act");
      if (a === "retour") { vue = "liste"; rendre(); titre(); }
      else if (a === "lancer") lancer();
      else if (a === "imprimer") imprimer();
      else if (a === "autre") { rangs[courant.id] = (rangs[courant.id] || 0) + 1; rendre(); titre(); }
      else if (a === "dispo") { AL.agir(function (s, n) { return A.basculer(s, true, n, AL.ctx()); }); rendre(); }
      else if (a === "annuler") { AL.agir(function (s) { return A.annulerLance(s); }); rendre(); }
    });
    dlg.addEventListener("keydown", function (e) { if (e.key === "Escape" && !dlg.showModal) fermer(); });
    dlg.addEventListener("close", surFermeture);
  }
  function ouvrir() {
    if (!dlg) creer();
    vue = "liste"; courant = null;
    rendre();
    if (dlg.showModal) { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute("open", "");
    titre();
  }
  W.simulations = { ouvrir: ouvrir, script: script, corps: corpsScript };
})(window);
