/* GS Banque & Assurance – réclamations : liste de suivi, détail d'une réclamation, suite donnée, réponse, clôture, impression de la fiche.
   Composant partagé par la page « Réclamations » (toutes les réclamations) et par l'onglet « Réclamations » de la fiche client (celles du client). Les règles sont dans reclamations.js.
   Un conteneur « .rec-suivi » (attribut data-client : numéro du client, ou vide pour toutes) est redessiné à chaque action ; l'événement « sgbf:reclamations » prévient le reste de la page. */
(function (root) {
  "use strict";
  var doc = root.document, W = root.SGBF, B = W.banque, RC = W.reclamations, E = W.equipe, CL = W.clients, ICO = W.icones, IMP = W.impression;
  var esc = B.esc;
  var CLIENT = {}; CL.forEach(function (c) { CLIENT[c.id] = c; });
  var etats = {};

  function store() { return B.store.charger(); }
  function etatDe(cle) { return etats[cle] || (etats[cle] = { filtre: "tous", ouvertes: {}, action: null, suppr: null, msg: "" }); }
  function nomClient(c) { return c.prenom + " " + c.nom; }
  function jour(ymd) { return B.fmtLong(B.lireYmd(ymd)); }
  function maj1(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function min1(s) { return s.charAt(0).toLowerCase() + s.slice(1); }
  function eur(x) { return x % 1 === 0 ? B.eur(x) : B.eur2(x); }
  function court(lib) { return lib.replace(/ \(.*\)$/, ""); }
  function paragraphes(t) { return String(t).split(/\n{2,}/).map(function (p) { return "<p>" + esc(p).replace(/\n/g, "<br>") + "</p>"; }).join(""); }
  function prevenir() { try { doc.dispatchEvent(new CustomEvent("sgbf:reclamations")); } catch (e) { /* ignoré */ } }
  function enSommes(n) { return n + " jour" + (n > 1 ? "s" : ""); }

  /* « Nouvelles au client » : date promise et ce qu'il en reste. */
  function retourTexte(r) {
    var t = RC.retour(r), d = jour(r.retour);
    if (r.statut === "close") return "Le client devait avoir des nouvelles avant le " + d + ".";
    if (r.statut === "repondue") return "Le client devait avoir des nouvelles avant le " + d + " ; une réponse lui a été donnée.";
    if (t.retard) return "Le client devait avoir des nouvelles avant le " + d + " : retard de " + enSommes(-t.ecart) + ".";
    if (t.aujourdhui) return "Le client doit avoir des nouvelles aujourd'hui (" + d + ").";
    return "Le client doit avoir des nouvelles avant le " + d + " (dans " + enSommes(t.ecart) + ").";
  }

  /* ---------- une réclamation ---------- */
  function dl(lignes) {
    return '<dl class="rec-dl">' + lignes.filter(function (l) { return l && l[1]; }).map(function (l) { return "<div><dt>" + esc(l[0]) + "</dt><dd>" + l[1] + "</dd></div>"; }).join("") + "</dl>";
  }
  function destinatairesHtml(r) {
    var st = store();
    return '<ul class="rec-dest">' + RC.destinataires(r, st).map(function (d) { return "<li><strong>" + esc(d.role) + " :</strong> " + (d.moi ? "vous" : esc(d.nom)) + (min1(d.poste) === min1(d.role) ? "" : " <span class=\"rec-sous\">(" + esc(min1(d.poste)) + ")</span>") + "</li>"; }).join("") + "</ul>";
  }
  function detailHtml(r, avecClient) {
    var c = CLIENT[r.client], canal = RC.PAR.canal[r.canal], th = RC.PAR.theme[r.theme], og = RC.PAR.origine[r.origine], at = RC.PAR.attente[r.attente], nv = RC.PAR.niveau[r.niveau];
    var mesures = '<ul class="rec-liste">' + r.mesures.map(function (m) { return "<li>" + esc(RC.PAR.mesure[m].lib) + "</li>"; }).join("") + "</ul>" + paragraphes(r.mesuresTxt) +
      (r.geste !== null && r.geste !== undefined ? '<p class="rec-sous">Montant proposé : <strong>' + esc(eur(r.geste)) + "</strong>. Un remboursement ou un geste commercial n'est pas accordé par vous seul : le conseiller gestionnaire ou la directrice décide.</p>" : "");
    var h = dl([
      avecClient && c ? ["Client", '<a href="client.html?id=' + c.id + '#reclamations">' + esc(nomClient(c)) + "</a> – client n° " + esc(c.num)] : null,
      ["Reçue le", esc(jour(r.date)) + " – " + esc(min1(canal.lib)) + " (" + esc(canal.sous) + ")"],
      ["Sujet", esc(th.lib)],
      ["Ce que reproche le client", paragraphes(r.faits)],
      ["D'où vient le problème", esc(og.lib) + (og.banque ? ' <span class="puce puce-warn">La banque semble en cause</span>' : "") + paragraphes(r.origineTxt)],
      ["Ce que le client demande", esc(at.lib) + (r.attenteTxt ? " – " + esc(r.attenteTxt) : "")],
      ["Son état d'esprit", esc(nv.lib) + " <span class=\"rec-sous\">(" + esc(min1(nv.ex.replace(/\.$/, ""))) + ")</span>"],
      r.montant !== null && r.montant !== undefined ? ["Somme en jeu pour le client", esc(eur(r.montant))] : null,
      r.deja ? ["Déjà fait ou dit au client", paragraphes(r.deja)] : null,
      ["Ce que vous proposez pour calmer la situation", mesures],
      ["Remise à", destinatairesHtml(r)],
      r.autres ? ["Autres informations utiles", paragraphes(r.autres)] : null,
      ["Nouvelles au client", esc(retourTexte(r))],
      r.reponse ? ["Réponse donnée au client", "<p><strong>" + esc(jour(r.reponse.date)) + "</strong></p>" + paragraphes(r.reponse.texte) + (r.reponse.recours ? '<p class="rec-sous">Le client a été informé de la suite possible s\'il n\'est pas satisfait.</p>' : "")] : null,
      r.cloture ? ["Clôture", "<p><strong>" + esc(jour(r.cloture.date)) + "</strong> – " + esc(RC.PAR.issue[r.cloture.issue].lib) + "</p>" + (r.cloture.note ? paragraphes(r.cloture.note) : "")] : null
    ]);
    h += '<h4 class="rec-h4">Suivi</h4><ol class="rec-chrono">' + r.suivi.map(function (s) { return "<li><span class=\"rec-quand\">" + esc(B.fmtDate(B.lireYmd(s.d))) + " à " + esc(s.h.replace(":", " h ")) + "</span> " + esc(s.txt) + "</li>"; }).join("") + "</ol>";
    return h;
  }
  /* Formulaires d'action, dans la carte. */
  function formAction(r, a) {
    var id = esc(r.id), err = a.err ? esc(a.err.erreur) : "", auj = B.ymd(B.aujourdhui());
    function inv(champ) { return a.err && a.err.champ === champ ? ' aria-invalid="true" aria-describedby="rec-err-' + id + '"' : ""; }
    var h = '<form class="formulaire rec-action" data-rec-form="' + a.type + '" data-id="' + id + '" novalidate>';
    if (a.type === "suite") {
      h += '<div class="champ"><label for="rec-suite-' + id + '">Suite donnée *</label><textarea id="rec-suite-' + id + '" name="suite" rows="3" maxlength="' + RC.LIMITES.suite[1] + '"' + inv("suite") + ' placeholder="Exemple : j\'ai rappelé le client, il accepte le remboursement des frais."></textarea>' +
        '<p class="aide-champ">Ce que vous avez fait, dit ou appris depuis l\'enregistrement. La ligne est datée automatiquement.</p></div>';
    } else if (a.type === "reponse") {
      h += '<div class="champ"><label for="rec-rd-' + id + '">Date de la réponse *</label><input id="rec-rd-' + id + '" name="date" type="date" value="' + auj + '" min="' + esc(r.date) + '" max="' + auj + '"' + inv("date") + "></div>" +
        '<div class="champ"><label for="rec-rt-' + id + '">Réponse donnée au client *</label><textarea id="rec-rt-' + id + '" name="texte" rows="4" maxlength="' + RC.LIMITES.reponse[1] + '"' + inv("texte") + ' placeholder="Exemple : nous avons remboursé les 8 € de frais et expliqué comment éviter un nouveau rejet."></textarea>' +
        '<p class="aide-champ">Ce que vous avez répondu au client : ce qui s\'est passé, ce que la banque fait pour lui.</p></div>' +
        '<label class="pf-radio rec-case"><input type="checkbox" name="recours"> J\'ai indiqué au client comment aller plus loin s\'il n\'est pas satisfait (service réclamations de la banque, puis médiateur).</label>';
    } else {
      h += '<div class="champ"><label for="rec-ci-' + id + '">Comment la réclamation se termine-t-elle ? *</label><select id="rec-ci-' + id + '" name="issue"' + inv("issue") + '><option value="">Choisir</option>' +
        RC.ISSUES.map(function (x) { return '<option value="' + x.id + '">' + esc(x.lib) + "</option>"; }).join("") + "</select></div>" +
        '<div class="champ"><label for="rec-cn-' + id + '">Remarque <span class="aide-champ">(facultatif)</span></label><textarea id="rec-cn-' + id + '" name="note" rows="2" maxlength="' + RC.LIMITES.cloture[1] + '"' + inv("note") + ' placeholder="Exemple : le client reste chez nous, geste de 20 € accordé par la directrice."></textarea></div>';
    }
    h += '<p class="msg-erreur" id="rec-err-' + id + '" role="alert">' + err + "</p>" +
      '<div class="pf-btns"><button type="submit" class="btn btn-principal">' + (a.type === "suite" ? "Ajouter la suite" : a.type === "reponse" ? "Enregistrer la réponse" : "Clôturer la réclamation") + '</button><button type="button" class="btn btn-secondaire" data-rec-act="annuler">Annuler</button></div></form>';
    return h;
  }
  function actionsHtml(r, et, avecClient) {
    var c = CLIENT[r.client], ouv = RC.ouverte(r), h = "", liens = [], st = store();
    if (ouv) {
      h += '<button type="button" class="btn-texte" data-rec-act="suite" data-id="' + esc(r.id) + '">Noter une suite</button>';
      if (r.statut === "transmise") h += '<button type="button" class="btn-texte" data-rec-act="reponse" data-id="' + esc(r.id) + '">Réponse donnée au client</button>';
      h += '<button type="button" class="btn-texte" data-rec-act="cloture" data-id="' + esc(r.id) + '">Clôturer</button>';
      RC.destinataires(r, st).forEach(function (d) {
        if (!d.moi) liens.push('<a class="btn-texte" href="agenda.html?client=' + r.client + "&amp;type=rdv_col&amp;avec=" + d.id + '" aria-label="Rendez-vous du client avec ' + esc(d.nom) + ", pour " + esc(c ? nomClient(c) : "le client") + '">Rendez-vous du client avec ' + esc(d.nom) + "</a>");
      });
      liens.push('<a class="btn-texte" href="agenda.html?client=' + r.client + "&amp;type=relance&amp;date=" + esc(r.retour) + '" aria-label="Programmer le rappel du client dans l\'agenda">Programmer le rappel du client</a>');
    } else h += '<button type="button" class="btn-texte" data-rec-act="rouvrir" data-id="' + esc(r.id) + '">Rouvrir</button>';
    if (avecClient && c) liens.push('<a class="btn-texte" href="client.html?id=' + c.id + '#reclamations">Dossier du client</a>');
    if (IMP) h += '<button type="button" class="btn-texte btn-impr" data-rec-act="imprimer" data-id="' + esc(r.id) + '">' + ICO.imprimante + "<span>Imprimer la fiche</span></button>";
    h += et.suppr === r.id ? '<button type="button" class="btn-texte" data-rec-act="suppr-oui" data-id="' + esc(r.id) + '">Confirmer la suppression</button><button type="button" class="btn-texte" data-rec-act="suppr-non">Garder</button>' :
      '<button type="button" class="btn-texte" data-rec-act="suppr" data-id="' + esc(r.id) + '">Supprimer</button>';
    return '<div class="rec-actions">' + h + liens.join("") + "</div>";
  }
  function carteHtml(r, et, avecClient) {
    var c = CLIENT[r.client], t = RC.retour(r), th = RC.PAR.theme[r.theme], nv = RC.PAR.niveau[r.niveau];
    var ouv = !!et.ouvertes[r.id], a = et.action && et.action.id === r.id ? et.action : null;
    var puces = '<span class="puce ' + (r.statut === "close" ? "puce-ok" : r.statut === "repondue" ? "" : "puce-warn") + '">' + esc(RC.STATUTS[r.statut]) + "</span>" + (t.retard ? ' <span class="puce puce-bad">Retour au client en retard</span>' : "") + (r.niveau === "menace" && RC.ouverte(r) ? ' <span class="puce puce-bad">Menace d\'aller plus loin</span>' : r.niveau === "fache" && RC.ouverte(r) ? ' <span class="puce puce-warn">Très mécontent</span>' : "");
    return '<li class="rec-carte rec-' + r.statut + '"><details class="rec-det" id="rec-' + esc(r.id) + '" data-id="' + esc(r.id) + '"' + (ouv || a ? " open" : "") + '><summary><span class="rec-ref">' + esc(r.ref) + '</span><span class="rec-titre">' +
      (avecClient && c ? "<strong>" + esc(nomClient(c)) + "</strong> – " : "") + esc(court(th.lib)) + '</span><span class="rec-puces">' + puces + '</span><span class="rec-ech">' + esc(retourTexte(r)) + "</span></summary>" +
      '<div class="rec-corps">' + detailHtml(r, avecClient) + actionsHtml(r, et, avecClient) + (a ? formAction(r, a) : "") + "</div></details></li>";
  }

  /* ---------- liste ---------- */
  function liste(cid) {
    var st = store();
    return cid ? RC.duClient(st, cid) : RC.trier(RC.elements(st));
  }
  var FILTRES = [["tous", "Toutes"], ["transmise", "À traiter"], ["repondue", "Réponse donnée"], ["close", "Clôturées"]];
  function interieur(cle) {
    var cid = cle === "tous" ? null : parseInt(cle, 10), et = etatDe(cle), tout = liste(cid);
    var vue = tout.filter(function (r) { return et.filtre === "tous" || r.statut === et.filtre; });
    var h = '<div class="rec-filtres" role="group" aria-label="Afficher les réclamations">' + FILTRES.map(function (f) {
      var n = tout.filter(function (r) { return f[0] === "tous" || r.statut === f[0]; }).length;
      return '<button type="button" class="rec-filtre" data-rec-filtre="' + f[0] + '" aria-pressed="' + (et.filtre === f[0]) + '">' + esc(f[1]) + " (" + n + ")</button>";
    }).join("") + "</div>";
    h += '<p class="sr" role="status">' + (et.msg ? esc(et.msg) : "") + "</p>" + (et.msg ? '<p class="ag-ok rec-msg" aria-hidden="true">' + esc(et.msg) + "</p>" : "");
    if (!tout.length) return h + '<p class="vide-bloc">' + (cid ? "Aucune réclamation enregistrée pour ce client." : "Aucune réclamation enregistrée pour le moment. Elles apparaissent ici dès que vous en avez transmis une.") + "</p>";
    if (!vue.length) return h + '<p class="vide-bloc">Aucune réclamation dans cette catégorie.</p>';
    return h + '<ul class="rec-liste-cartes">' + vue.map(function (r) { return carteHtml(r, et, !cid); }).join("") + "</ul>";
  }
  function html(cid) {
    var cle = cid ? String(cid) : "tous";
    return '<div class="rec-suivi" data-client="' + (cid ? esc(String(cid)) : "") + '">' + interieur(cle) + "</div>";
  }
  function rendre(z, focus) {
    var cle = z.getAttribute("data-client") || "tous";
    z.innerHTML = interieur(cle);
    if (focus) { var e = typeof focus === "string" ? z.querySelector(focus) : focus; if (e) e.focus(); }
  }
  function conteneurs() { return [].slice.call(doc.querySelectorAll(".rec-suivi")); }
  function rendreTous() { conteneurs().forEach(function (z) { rendre(z); }); }

  /* Après l'enregistrement d'une réclamation : la montrer, ouverte, en tête de la liste. */
  function montrer(id) {
    conteneurs().forEach(function (z) {
      var cle = z.getAttribute("data-client") || "tous", et = etatDe(cle);
      et.filtre = "tous"; et.ouvertes[id] = true; et.msg = "";
      rendre(z);
    });
  }

  /* ---------- impression de la fiche ---------- */
  function ficheImpression(r) {
    var c = CLIENT[r.client], st = store(), canal = RC.PAR.canal[r.canal], nv = RC.PAR.niveau[r.niveau], og = RC.PAR.origine[r.origine];
    function ligne(k, v) { return v ? "<dt>" + esc(k) + "</dt><dd>" + v + "</dd>" : ""; }
    function txt(t) { return esc(t).replace(/\n/g, "<br>"); }
    var corps = '<section class="dp-bloc"><h2>Le client</h2><dl class="dp-fiche">' + ligne("Nom", esc(c.civ + " " + c.prenom + " " + c.nom.toUpperCase())) + ligne("Numéro de client", esc(c.num)) + ligne("Âge et profession", esc(c.age + " ans – " + c.pro.prof)) + ligne("Téléphone", esc(c.mob || c.tel || "")) + "</dl></section>" +
      '<section class="dp-bloc"><h2>La réclamation</h2><dl class="dp-fiche">' + ligne("Numéro de dossier", esc(r.ref)) + ligne("Reçue le", esc(jour(r.date)) + " – " + esc(min1(canal.lib)) + " (" + esc(canal.sous) + ")") + ligne("Sujet", esc(RC.PAR.theme[r.theme].lib)) +
      ligne("Ce que reproche le client", txt(r.faits)) + ligne("Ce que le client demande", esc(RC.PAR.attente[r.attente].lib) + (r.attenteTxt ? " – " + esc(r.attenteTxt) : "")) + ligne("État d'esprit du client", esc(nv.lib)) + ligne("Somme en jeu", r.montant !== null && r.montant !== undefined ? esc(eur(r.montant)) : "") + "</dl></section>" +
      '<section class="dp-bloc"><h2>D\'où vient le problème</h2><dl class="dp-fiche">' + ligne("Origine", esc(og.lib)) + ligne("Explication", txt(r.origineTxt)) + ligne("Déjà fait ou dit au client", txt(r.deja)) + "</dl></section>" +
      '<section class="dp-bloc"><h2>Ce qui est proposé pour calmer la situation</h2><ul class="dp-liste">' + r.mesures.map(function (m) { return "<li>" + esc(RC.PAR.mesure[m].lib) + "</li>"; }).join("") + '</ul><p class="dp-texte">' + txt(r.mesuresTxt) + "</p>" +
      (r.geste !== null && r.geste !== undefined ? '<p class="dp-texte"><strong>Montant proposé :</strong> ' + esc(eur(r.geste)) + ". La décision revient au conseiller gestionnaire ou à la directrice d'agence.</p>" : "") + "</section>" +
      '<section class="dp-bloc"><h2>Remise à</h2><dl class="dp-fiche">' + RC.destinataires(r, st).map(function (d) { return ligne(d.role, esc(d.nom) + (min1(d.poste) === min1(d.role) ? "" : " (" + esc(min1(d.poste)) + ")")); }).join("") + ligne("Nouvelles au client avant le", esc(jour(r.retour))) + ligne("Autres informations utiles", txt(r.autres)) + "</dl></section>";
    if (r.reponse) corps += '<section class="dp-bloc"><h2>Réponse donnée au client</h2><p class="dp-texte"><strong>' + esc(jour(r.reponse.date)) + "</strong><br>" + txt(r.reponse.texte) + "</p></section>";
    if (r.cloture) corps += '<section class="dp-bloc"><h2>Clôture</h2><p class="dp-texte"><strong>' + esc(jour(r.cloture.date)) + "</strong> – " + esc(RC.PAR.issue[r.cloture.issue].lib) + (r.cloture.note ? "<br>" + txt(r.cloture.note) : "") + "</p></section>";
    corps += '<section class="dp-bloc"><h2>Suivi</h2><table class="dp-pf dp-ag"><thead><tr><th scope="col" class="g">Date</th><th scope="col" class="g">Heure</th><th scope="col" class="g">Suite</th></tr></thead><tbody>' +
      r.suivi.map(function (s) { return '<tr><td class="g">' + esc(B.fmtDate(B.lireYmd(s.d))) + '</td><td class="g">' + esc(s.h.replace(":", " h ")) + '</td><td class="g">' + esc(s.txt) + "</td></tr>"; }).join("") + "</tbody></table></section>";
    return IMP.document({ titre: "Fiche de réclamation " + r.ref, sous: nomClient(c) + " – " + court(RC.PAR.theme[r.theme].lib), corps: corps });
  }
  function imprimer(id) {
    var r = RC.trouver(store(), id);
    if (r && IMP) IMP.imprimer(ficheImpression(r), "Reclamation_" + r.ref);
  }

  /* ---------- événements (sur toute la page) ---------- */
  function conteneurDe(el) { return el.closest ? el.closest(".rec-suivi") : null; }
  doc.addEventListener("toggle", function (e) {
    var d = e.target; if (!d || !d.classList || !d.classList.contains("rec-det")) return;
    var z = conteneurDe(d); if (!z) return;
    etatDe(z.getAttribute("data-client") || "tous").ouvertes[d.getAttribute("data-id")] = d.open;
  }, true);
  doc.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target : null; if (!t) return;
    var f = t.closest("[data-rec-filtre]"), b = t.closest("[data-rec-act]");
    var z = conteneurDe(t); if (!z || (!f && !b)) return;
    var cle = z.getAttribute("data-client") || "tous", et = etatDe(cle);
    if (f) { et.filtre = f.getAttribute("data-rec-filtre"); et.msg = ""; rendre(z); var nf = z.querySelector('[data-rec-filtre="' + et.filtre + '"]'); if (nf) nf.focus(); return; }
    var act = b.getAttribute("data-rec-act"), id = b.getAttribute("data-id"), st = store();
    et.msg = "";
    if (act === "suite" || act === "reponse" || act === "cloture") { et.action = { id: id, type: act, err: null }; et.ouvertes[id] = true; rendre(z); var fm = z.querySelector('form[data-id="' + id + '"] textarea, form[data-id="' + id + '"] input, form[data-id="' + id + '"] select'); if (fm) fm.focus(); }
    else if (act === "annuler") { var ida = et.action && et.action.id; et.action = null; rendre(z, ida ? 'button[data-rec-act="' + (b.closest("form").getAttribute("data-rec-form")) + '"][data-id="' + ida + '"]' : null); }
    else if (act === "rouvrir") { if (RC.rouvrir(st, id)) { B.store.sauver(); et.msg = "Réclamation rouverte."; rendreTous(); prevenir(); var d = doc.getElementById("rec-" + id); if (d) d.querySelector("summary").focus(); } }
    else if (act === "suppr") { et.suppr = id; rendre(z, 'button[data-rec-act="suppr-oui"]'); }
    else if (act === "suppr-non") { var ids = et.suppr; et.suppr = null; rendre(z, 'button[data-rec-act="suppr"][data-id="' + ids + '"]'); }
    else if (act === "suppr-oui") { et.suppr = null; if (RC.supprimer(st, id)) { B.store.sauver(); et.msg = "Réclamation supprimée."; } rendreTous(); prevenir(); var s0 = doc.querySelector(".rec-suivi .rec-filtre"); if (s0) s0.focus(); }
    else if (act === "imprimer") imprimer(id);
  });
  doc.addEventListener("submit", function (e) {
    var fm = e.target; if (!fm.getAttribute || !fm.getAttribute("data-rec-form")) return;
    e.preventDefault();
    var z = conteneurDe(fm), cle = z.getAttribute("data-client") || "tous", et = etatDe(cle), st = store(), id = fm.getAttribute("data-id"), type = fm.getAttribute("data-rec-form");
    function v(n) { var x = fm.elements[n]; return x ? x.value : ""; }
    var r;
    if (type === "suite") r = RC.noterSuite(st, id, v("suite"));
    else if (type === "reponse") r = RC.donnerReponse(st, id, { date: v("date"), texte: v("texte"), recours: fm.elements.recours && fm.elements.recours.checked });
    else r = RC.cloturer(st, id, { issue: v("issue"), note: v("note") });
    if (!r.ok) {
      /* on garde ce qui a été saisi : le formulaire est redessiné avec le message, puis les valeurs sont remises */
      var saisi = {}; [].slice.call(fm.elements).forEach(function (x) { if (x.name) saisi[x.name] = x.type === "checkbox" ? x.checked : x.value; });
      et.action = { id: id, type: type, err: r }; rendre(z);
      var nf = z.querySelector('form[data-id="' + id + '"]');
      if (nf) { [].slice.call(nf.elements).forEach(function (x) { if (x.name && saisi[x.name] !== undefined) { if (x.type === "checkbox") x.checked = saisi[x.name]; else x.value = saisi[x.name]; } }); var cible = r.champ === "texte" || r.champ === "suite" || r.champ === "note" || r.champ === "date" || r.champ === "issue" ? nf.elements[r.champ === "suite" ? "suite" : r.champ] : null; (cible || nf.elements[0]).focus(); }
      return;
    }
    B.store.sauver(); et.action = null;
    et.msg = type === "suite" ? "Suite ajoutée." : type === "reponse" ? "Réponse enregistrée." : "Réclamation clôturée.";
    rendreTous(); prevenir();
    var det = doc.getElementById("rec-" + id); if (det) { var sm = det.querySelector("summary"); if (sm) sm.focus(); }
  });

  W.reclamationsUI = { html: html, rendre: rendre, rendreTous: rendreTous, montrer: montrer, imprimer: imprimer, ficheImpression: ficheImpression, retourTexte: retourTexte, nomClient: nomClient, FILTRES: FILTRES };
})(window);
