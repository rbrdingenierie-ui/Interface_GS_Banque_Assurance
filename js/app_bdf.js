/* GS Banque & Assurance – page « Interro BDF » : interrogation de la Banque de France (FCC et FICP).
   Le conseiller saisit le nom de famille, le nom de jeune fille (femme mariée ou veuve) et la date de naissance ; la clé de recherche (date de naissance suivie des cinq premières lettres du nom) s'affiche en direct.
   Il choisit le fichier (FCC, FICP ou les deux) puis lit les écrans de réponse, qu'il peut imprimer. Chaque interrogation est enregistrée dans le journal de l'exercice.
   Adresse : interro_bdf.html?client=ID&fichier=ficp reprend l'identité du client (utilisé par le Montage de prêt et la fiche client). */
(function () {
  "use strict";

  var SG = window.SGBF, B = SG.banque, X = SG.bdf, UI = SG.bdfUI, CL = SG.clients, S = SG.synthese, ICO = SG.icones, RECH = SG.recherche, app = document.getElementById("app");
  var esc = B.esc;
  var CLIENT = {}; CL.forEach(function (c) { CLIENT[c.id] = c; });
  var params = new URLSearchParams(location.search);
  var etat = { client: CLIENT[parseInt(params.get("client"), 10)] || null, nom: "", nomNaissance: "", naissance: "", fichier: params.get("fichier") === "fcc" || params.get("fichier") === "ficp" ? params.get("fichier") : "les_deux", cons: null, err: null };

  function naissanceClient(c) { var n = S && S.naissance ? S.naissance(c) : null; return n ? B.ymd(n) : ""; }
  function remplirClient(c) { etat.client = c; etat.nom = c ? c.nom : ""; etat.naissance = c ? naissanceClient(c) : ""; etat.nomNaissance = ""; }
  if (etat.client) remplirClient(etat.client);
  /* Adresse : interro_bdf.html?nom=BERARD&naissance=1971-04-12 (identité reprise de l'onglet « Régularisation FCC »). */
  else if (params.get("nom") && /^\d{4}-\d{2}-\d{2}$/.test(params.get("naissance") || "")) { etat.nom = params.get("nom").slice(0, 60); etat.nomNaissance = (params.get("nomNaissance") || "").slice(0, 60); etat.naissance = params.get("naissance"); }

  function nomEleve() { var st = B.store.charger(); return (st.eleve && st.eleve.nom) || ""; }
  function err(champ) { return etat.err && etat.err.champ === champ; }
  function aria(champ, aide) { return (err(champ) ? ' aria-invalid="true" aria-describedby="bdf-err' + (aide ? " " + aide : "") + '"' : (aide ? ' aria-describedby="' + aide + '"' : "")); }

  function selecteurClient() {
    var l = CL.slice().sort(function (a, b) { var x = a.nom + " " + a.prenom, y = b.nom + " " + b.prenom; return x < y ? -1 : x > y ? 1 : 0; });
    return '<div class="champ bdf-client"><label for="bdf-client">Client de l\'agence <span class="aide-champ">(facultatif)</span></label><select id="bdf-client" aria-describedby="bdf-client-aide"><option value="">Aucun : saisir l\'identité à la main</option>' + l.map(function (c) {
      return '<option value="' + c.id + '"' + (etat.client && etat.client.id === c.id ? " selected" : "") + ">" + esc(c.nom.toUpperCase() + " " + c.prenom + " – " + c.age + " ans") + "</option>";
    }).join("") + '</select><span class="aide-champ" id="bdf-client-aide">Reprend le nom et la date de naissance de la fiche client. Ajoutez le nom de jeune fille si la cliente est mariée ou veuve.</span></div>';
  }
  function champ(id, lib, valeur, o) {
    o = o || {};
    return '<div class="champ"><label for="bdf-' + id + '">' + esc(lib) + (o.fac ? ' <span class="aide-champ">(facultatif)</span>' : " *") + '</label><input id="bdf-' + id + '" type="' + (o.type || "text") + '" autocomplete="off" maxlength="' + (o.max || 40) + '" value="' + esc(valeur) + '"' +
      (o.type === "date" ? ' min="1900-01-01" max="' + B.ymd(B.aujourdhui()) + '"' : "") + aria(id, o.aide ? "bdf-aide-" + id : "") + ">" + (o.aide ? '<span class="aide-champ" id="bdf-aide-' + id + '">' + esc(o.aide) + "</span>" : "") + "</div>";
  }
  function radios() {
    var l = [["les_deux", "FCC et FICP"], ["fcc", "FCC : fichier central des chèques"], ["ficp", "FICP : fichier des incidents de remboursement des crédits"]];
    return '<fieldset class="op-radio"' + (err("fichier") ? ' aria-invalid="true"' : "") + "><legend>Fichier à interroger *</legend><div class=\"op-opts\">" + l.map(function (x) {
      return '<label class="op-opt"><input type="radio" name="bdf-fichier" value="' + x[0] + '"' + (etat.fichier === x[0] ? " checked" : "") + "><span>" + esc(x[1]) + "</span></label>";
    }).join("") + "</div></fieldset>";
  }
  /* Clé de recherche calculée avec ce qui est saisi. */
  function libCles() {
    var k = X.cles({ nom: etat.nom, nomNaissance: etat.nomNaissance, naissance: etat.naissance });
    if (!k.length) return '<span class="bdf-cle-vide">La clé s\'affiche dès que le nom et la date de naissance sont saisis.</span>';
    return k.map(function (x) { return '<span class="bdf-cle-item"><code class="bdf-cle">' + esc(x.cle) + "</code>" + (x.role === "jeune_fille" ? ' <span class="bdf-cle-role">(nom de jeune fille)</span>' : "") + "</span>"; }).join(" ");
  }
  function formulaire() {
    return '<section class="bloc" aria-labelledby="bdf-t-saisie"><div class="bloc-tete"><h2 id="bdf-t-saisie" tabindex="-1">Personne à interroger</h2><span class="sous">Les champs marqués d\'une étoile sont obligatoires.</span></div>' +
      '<form class="formulaire op-form bdf-form" id="bdf-form" novalidate>' + selecteurClient() +
      '<div class="op-grille">' + champ("nom", "Nom de famille", etat.nom, { max: 40 }) + champ("nomNaissance", "Nom de jeune fille", etat.nomNaissance, { fac: true, max: 40, aide: "Femme mariée ou veuve : le fichier est tenu au nom de naissance." }) +
      champ("naissance", "Date de naissance", etat.naissance, { type: "date" }) + "</div>" +
      '<p class="bdf-cle-ligne" id="bdf-cle-ligne"><strong>Clé de recherche :</strong> <output id="bdf-cle" for="bdf-nom bdf-nomNaissance bdf-naissance" aria-live="polite">' + libCles() + "</output></p>" +
      '<p class="op-aide">La clé est la date de naissance (jour, mois, année sur deux chiffres), suivie des cinq premières lettres du nom de famille, par exemple 020991RICHA.</p>' +
      radios() +
      '<p class="msg-erreur" id="bdf-err" role="alert">' + (etat.err ? esc(etat.err.erreur) : "") + "</p>" +
      '<div class="pf-btns"><button type="submit" class="btn btn-principal">Interroger la Banque de France</button></div></form></section>';
  }
  function reponse() {
    var c = etat.cons; if (!c) return "";
    return '<section class="bloc bdf-reponse-bloc" id="bdf-reponse" aria-labelledby="bdf-t-rep"><div class="bloc-tete"><h2 id="bdf-t-rep" tabindex="-1">Réponse de la Banque de France</h2><span class="sous">Clé : ' + esc(UI.cleLibelle(c)) + "</span></div>" +
      UI.synthese(c) + '<div class="bdf-ecrans">' + X.ecrans(c) + '</div><div class="bdf-btns"><button type="button" class="bdf-retour" data-act="retour">Retour saisie</button><button type="button" class="btn btn-secondaire" data-act="imprimer">Imprimer page' + ICO.imprimante + '</button></div></section>';
  }
  var LIB_RES = { aucun: "Aucune inscription", interdit: "Interdit bancaire", inscrit: "Inscrit" };
  function journal() {
    var l = X.journal(B.store.charger()).slice().sort(function (a, b) { return (b.lot || 0) - (a.lot || 0) || a.id - b.id; }).slice(0, 10);
    var corps = l.length ? '<div class="tableau-defile" role="region" tabindex="0" aria-label="Interrogations enregistrées"><table class="tab-ventes bdf-journal"><thead><tr><th scope="col">Date</th><th scope="col">Fichier</th><th scope="col">Clé</th><th scope="col">Réponse</th><th scope="col">Client</th></tr></thead><tbody>' + l.map(function (x) {
      var c = x.client && CLIENT[x.client];
      return "<tr><td>" + esc(B.fmtDate(B.lireYmd(x.date)) + " à " + x.heure.slice(0, 5).replace(":", " h ")) + "</td><td>" + esc(x.fichier.toUpperCase()) + "</td><td><code>" + esc(x.cles.join(" ; ")) + '</code></td><td class="bdf-res-' + (x.resultat === "aucun" ? "ok" : "bad") + '">' + esc(LIB_RES[x.resultat] || x.resultat) + "</td><td>" + (c ? esc(c.prenom + " " + c.nom.toUpperCase()) : "–") + "</td></tr>";
    }).join("") + "</tbody></table></div>" : '<p class="vide-bloc">Aucune interrogation pour le moment.</p>';
    return '<section class="bloc" aria-labelledby="bdf-t-j"><div class="bloc-tete"><h2 id="bdf-t-j">Dernières interrogations</h2><span class="sous">Les dix lignes les plus récentes, la plus récente interrogation en premier</span></div>' + corps + "</section>";
  }
  function entrainement() {
    return '<section class="bloc" aria-labelledby="bdf-t-e"><div class="bloc-tete"><h2 id="bdf-t-e">Identités pour s\'entraîner</h2></div>' +
      '<p class="op-aide">Ces personnes figurent au fichier de l\'exercice. Toute autre identité obtient « Dossier inexistant » : aucune inscription. Seuls les titulaires auxquels l\'agence a envoyé une lettre d\'injonction sont aussi inscrits au FCC (voir « Régularisation FCC »). Pour une femme mariée, interrogez aussi avec le nom de jeune fille.</p>' +
      '<div class="tableau-defile" role="region" tabindex="0" aria-label="Tableau des identités pour s\'entraîner"><table class="tab-ventes bdf-entrain"><thead><tr><th scope="col">Identité</th><th scope="col">Né(e) le</th><th scope="col">À</th><th scope="col"><span class="sr">Action</span></th></tr></thead><tbody>' +
      X.ENTRAINEMENT.map(function (e) {
        return "<tr><td>" + esc(e.civ + " " + e.prenoms.split(" ")[0].charAt(0) + e.prenoms.split(" ")[0].slice(1).toLowerCase() + " " + e.nom + (e.nomNaissance ? " (née " + e.nomNaissance + ")" : "")) + "</td><td>" + esc(B.fmtDate(B.lireYmd(e.naissance))) + "</td><td>" + esc(e.lieu) + '</td><td><button type="button" class="btn btn-secondaire btn-petit" data-act="essai" data-id="' + e.id + '" aria-label="Utiliser cette identité : ' + esc(e.civ + " " + e.nom) + '">Utiliser</button></td></tr>';
      }).join("") + "</tbody></table></div></section>";
  }

  function render(focus) {
    document.title = "GS Banque & Assurance – Interro BDF";
    app.innerHTML = '<nav class="fil-ariane" aria-label="Fil d\'Ariane"><a href="index.html">' + ICO.retour + 'Accueil</a></nav>' +
      '<div class="page-titre"><h1>Interro BDF</h1><p>Interrogation de la Banque de France : fichier central des chèques (FCC) et fichier des incidents de remboursement des crédits aux particuliers (FICP).</p></div>' +
      formulaire() + reponse() + journal() + entrainement() +
      '<p class="bdf-mention-simulation">' + esc(X.MENTION_SIMULATION) + "</p>";
    if (focus) { var n = document.getElementById(focus); if (n) { try { n.focus(); } catch (e) { /* ignoré */ } } }
  }
  function lire() {
    function v(id) { var n = document.getElementById(id); return n ? n.value : ""; }
    etat.nom = v("bdf-nom").trim(); etat.nomNaissance = v("bdf-nomNaissance").trim(); etat.naissance = v("bdf-naissance");
    var r = document.querySelector('input[name="bdf-fichier"]:checked'); etat.fichier = r ? r.value : "les_deux";
  }
  function majCle() { lire(); var o = document.getElementById("bdf-cle"); if (o) o.innerHTML = libCles(); }

  app.addEventListener("input", function (e) { if (e.target.id === "bdf-nom" || e.target.id === "bdf-nomNaissance" || e.target.id === "bdf-naissance") majCle(); });
  app.addEventListener("change", function (e) {
    if (e.target.id === "bdf-client") {
      var c = CLIENT[parseInt(e.target.value, 10)] || null; lire(); var f = etat.fichier; remplirClient(c); etat.fichier = f; etat.err = null; etat.cons = null;
      try { history.replaceState(null, "", c ? "interro_bdf.html?client=" + c.id + (f !== "les_deux" ? "&fichier=" + f : "") : "interro_bdf.html"); } catch (x) { /* ignoré */ }
      render("bdf-nom");
    } else if (e.target.name === "bdf-fichier") majCle();
  });
  app.addEventListener("submit", function (e) {
    if (e.target.id !== "bdf-form") return;
    e.preventDefault(); lire();
    var fs = etat.fichier === "les_deux" ? ["fcc", "ficp"] : [etat.fichier];
    var r = X.interroger({ nom: etat.nom, nomNaissance: etat.nomNaissance, naissance: etat.naissance }, fs, B.maintenant(), B.store.charger());
    if (!r.ok) { etat.err = r; etat.cons = null; render("bdf-" + r.champ); return; }
    etat.err = null; etat.cons = r;
    var st = B.store.charger(); X.noter(st, r, { par: nomEleve(), client: etat.client ? etat.client.id : 0 }); B.store.sauver();
    render("bdf-t-rep");
  });
  app.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-act]") : null; if (!b) return;
    var a = b.getAttribute("data-act");
    if (a === "retour") { etat.cons = null; render("bdf-nom"); }
    else if (a === "imprimer" && etat.cons) UI.imprimer(etat.cons);
    else if (a === "essai") {
      var x = X.ENTRAINEMENT.filter(function (y) { return y.id === b.getAttribute("data-id"); })[0]; if (!x) return;
      etat.client = null; etat.nom = x.nom; etat.nomNaissance = x.nomNaissance; etat.naissance = x.naissance; etat.err = null; etat.cons = null;
      try { history.replaceState(null, "", "interro_bdf.html"); } catch (z) { /* ignoré */ }
      render("bdf-t-saisie");
    }
  });
  RECH.init(CL, document.getElementById("rech"), document.getElementById("rech-res"), document.getElementById("rech-statut"));
  render();
})();
