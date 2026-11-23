/* GS Banque & Assurance – page « Avis clients en ligne » : lire les avis laissés sur la page de l'agence (site d'avis, réseau social), les recouper en interne avec les dossiers, les qualifier, décider des
   suites (réponse publique, contact privé, réclamation, signalement à la plateforme, directrice), rédiger la réponse publique et la faire contrôler avant publication.
   Les règles et le contrôle sont dans avis_en_ligne.js, les 24 avis dans data_avis.js. L'enregistrement se fait dans st.avis (un traitement par avis). */
(function () {
  "use strict";

  var SG = window.SGBF, B = SG.banque, CL = SG.clients, A = SG.avisEnLigne, EQ = SG.equipe, ICO = SG.icones, RECH = SG.recherche, app = document.getElementById("app");
  var esc = B.esc, NB = " ";
  var CLIENT = {}; CL.forEach(function (c) { CLIENT[c.id] = c; });
  var FILTRES = [["atraiter", "À traiter"], ["traites", "Traités"], ["tous", "Tous"]];
  var VIDE = { nature: "", suites: [], reponse: "", note: "" };
  var etat = { filtre: "atraiter", ouvert: null, f: Object.assign({}, VIDE, { suites: [] }), err: null, controle: null, fait: null, conf: null };

  function st() { return B.store.charger(); }
  function nomComplet(c) { return c.civ + " " + c.prenom + " " + c.nom.toUpperCase(); }
  function dateLongue(ymd) { var d = B.lireYmd(ymd); return d ? d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : ""; }
  function pl(n, s, p) { return n + " " + (n > 1 ? p : s); }
  function nature(id) { return A.NATURES.filter(function (x) { return x.id === id; })[0] || null; }
  function suiteLib(id) { var s = A.SUITES.filter(function (x) { return x.id === id; })[0]; return s ? s.lib : id; }
  function noms(a) {
    var l = A.candidats(a.auteur, CL).map(function (c) { return c.nom; });
    EQ.COLLABS.forEach(function (c) { if (c.nom) l.push(c.nom); });
    return l;
  }
  function compteur(t) { var m = A.mots(t); return pl(m, "mot", "mots") + " – " + pl(t.length, "signe", "signes") + " sur 1" + NB + "000"; }
  function etoiles(n) { var s = "", i; for (i = 1; i <= 5; i++) s += i <= n ? "★" : "☆"; return s; }
  function chiffre(x) { return String(x).replace(".", ","); }

  /* ---------- déroulé, vue d'ensemble, filtres ---------- */
  function deroule() {
    var e = [
      ["Lire et recouper", "On lit l'avis, sa note et sa date, puis on cherche en interne si l'auteur est un client. Ce rapprochement ne se dit jamais en public."],
      ["Qualifier", "Compliment, remarque sur l'agence, réclamation, données personnelles, faux avis, publicité ou client victime d'une fraude : le type d'avis décide de la suite."],
      ["Décider des suites", "Répondre en public, contacter l'auteur en privé, enregistrer une réclamation, signaler l'avis à la plateforme, prévenir la directrice."],
      ["Répondre et contrôler", "La réponse publique est rédigée puis contrôlée avant publication : secret professionnel, promesses, données personnelles, ton."]
    ];
    return '<ol class="op-deroule regul-deroule" aria-label="Déroulé du traitement d\'un avis">' + e.map(function (x, i) {
      return '<li><span class="op-deroule-num" aria-hidden="true">' + (i + 1) + '</span><span class="op-deroule-txt"><strong>' + esc(x[0]) + "</strong><span>" + esc(x[1]) + "</span></span></li>";
    }).join("") + "</ol>";
  }
  function vue(b) {
    var d = [["Avis à traiter", b.atraiter, "sur " + b.total + " avis", "av-b-warn"], ["Délai dépassé", b.retard, "plus de " + pl(A.CONV.delaiOuvres, "jour ouvré", "jours ouvrés") + " sans traitement", b.retard ? "av-b-bad" : "av-b-ok"], ["Avis traités", b.traites, b.repondus + " réponse" + (b.repondus > 1 ? "s" : "") + ", " + b.signales + " signalement" + (b.signales > 1 ? "s" : ""), "av-b-ok"], ["Note moyenne", chiffre(b.moyenne) + " sur 5", "sur " + b.total + " avis", "av-b-info"]];
    var max = Math.max.apply(null, b.repartition.slice(1));
    var rep = [5, 4, 3, 2, 1].map(function (n) {
      var v = b.repartition[n];
      return '<li><span class="av-r-lib">' + n + " sur 5</span><span class=\"av-r-barre\" aria-hidden=\"true\"><span style=\"width:" + (max ? Math.round(v / max * 100) : 0) + '%"></span></span><span class="av-r-val">' + pl(v, "avis", "avis") + "</span></li>";
    }).join("");
    return '<section class="bloc av-vue" aria-labelledby="av-t-vue"><div class="bloc-tete"><h2 id="av-t-vue">Vue d\'ensemble</h2><span class="sous">Page de l\'agence de Paris – site d\'avis et réseau social</span></div>' +
      '<dl class="av-bilan" aria-label="Bilan des avis">' + d.map(function (x) { return '<div class="av-b ' + x[3] + '"><dt>' + esc(x[0]) + "</dt><dd>" + esc(String(x[1])) + '</dd><dd class="av-b-sous">' + esc(x[2]) + "</dd></div>"; }).join("") + "</dl>" +
      '<h3 class="av-h3">Répartition des notes</h3><ul class="av-repart" aria-label="Répartition des notes">' + rep + "</ul></section>";
  }
  function filtres(b) {
    var n = { atraiter: b.atraiter, traites: b.traites, tous: b.total };
    return '<div class="av-filtres" role="group" aria-label="Avis à afficher">' + FILTRES.map(function (f) {
      return '<button type="button" class="btn ' + (etat.filtre === f[0] ? "btn-principal" : "btn-secondaire") + '" id="av-f-' + f[0] + '" data-act="filtre" data-f="' + f[0] + '" aria-pressed="' + (etat.filtre === f[0]) + '">' + esc(f[1]) + " (" + n[f[0]] + ")</button>";
    }).join("") + "</div>";
  }

  /* ---------- un avis ---------- */
  function puce(a, t) {
    if (t) return '<span class="chip chip-ok">' + ICO.check + "Traité</span>";
    if (A.enRetard(a, st(), B.aujourdhui())) return '<span class="chip chip-bad">' + ICO.alerte + "Délai dépassé</span>";
    return '<span class="chip chip-warn">' + ICO.alerte + "À traiter</span>";
  }
  function entete(a, t) {
    var j = a.jours;
    return '<div class="regul-carte-tete"><div><h3 class="regul-nom">' + esc(a.auteur) + '</h3><p class="regul-sous">Avis ' + esc(a.id) + " – " + esc(A.CANAUX[a.canal]) + " – publié le " + esc(dateLongue(A.dateAvis(a, B.aujourdhui()))) + " (" + (j === 0 ? "aujourd'hui" : "il y a " + pl(j, "jour", "jours")) + ")</p></div>" + puce(a, t) + "</div>" +
      '<p class="av-note"><span class="av-etoiles" aria-hidden="true">' + etoiles(a.note) + '</span> <strong>' + a.note + " sur 5</strong></p>" +
      '<blockquote class="av-texte"><p>' + esc(a.texte) + "</p></blockquote>";
  }

  /* recoupement interne : jamais repris dans la réponse publique */
  function recoupement(a) {
    var c = A.candidats(a.auteur, CL), h;
    if (!A.identifiable(a.auteur)) h = "<p><strong>« " + esc(a.auteur) + " »</strong> n'est pas un nom : l'auteur ne peut pas être retrouvé dans les dossiers à partir de ce que la plateforme affiche.</p>";
    else if (!c.length) h = "<p>Aucun client ne porte ce prénom avec cette initiale. L'auteur n'est probablement pas client, ou a publié sous un autre nom : rien ne permet de l'affirmer.</p>";
    else h = "<p>" + (c.length > 1 ? c.length + " clients portent" : "Un client porte") + " ce prénom et cette initiale :</p><ul class=\"av-cands\">" + c.map(function (x) {
      return "<li><strong>" + esc(nomComplet(x)) + "</strong> – client n° " + esc(x.num) + " – " + x.age + " ans – " + esc(x.pro.prof) + ' <a href="client.html?id=' + x.id + '">Fiche client</a></li>';
    }).join("") + "</ul><p>Un prénom et une initiale ne prouvent pas qu'il s'agit de cette personne : vérifiez son identité avant tout contact privé et ne confirmez rien en public.</p>";
    return '<div class="av-recoup"><h4 class="av-h4">Recoupement avec les dossiers (usage interne)</h4>' + h + "</div>";
  }

  /* ---------- panneau de traitement ---------- */
  function erreur(champ) { return etat.err && etat.err.some(function (e) { return e.champ === champ; }); }
  function controleHtml(r) {
    if (!r) return "";
    var h = "";
    if (r.bloquants.length) h += '<div class="av-ctl av-ctl-bad"><p class="av-ctl-t">' + ICO.alerte + "Points bloquants (" + r.bloquants.length + ")</p><ul>" + r.bloquants.map(function (x) { return "<li><strong>" + esc(x.titre) + ".</strong> " + esc(x.detail) + "</li>"; }).join("") + "</ul></div>";
    if (r.avertissements.length) h += '<div class="av-ctl av-ctl-warn"><p class="av-ctl-t">' + ICO.info + "Avertissements (" + r.avertissements.length + ")</p><ul>" + r.avertissements.map(function (x) { return "<li><strong>" + esc(x.titre) + ".</strong> " + esc(x.detail) + "</li>"; }).join("") + "</ul></div>";
    if (r.ok && !r.avertissements.length) h += '<div class="av-ctl av-ctl-ok"><p class="av-ctl-t">' + ICO.check + "Aucun point bloquant, aucun avertissement</p><p>La réponse peut être publiée.</p></div>";
    else if (r.ok) h += '<p class="av-ctl-fin">Aucun point bloquant : la réponse peut être publiée, après lecture des avertissements.</p>';
    return h;
  }
  function formHtml(a) {
    var f = etat.f, nat = nature(f.nature), repond = f.suites.indexOf("repondre") >= 0, aucune = f.suites.indexOf("aucune") >= 0;
    var h = '<form class="formulaire av-form" id="av-form" data-id="' + esc(a.id) + '" novalidate aria-labelledby="av-t-' + esc(a.id) + '"><h4 class="av-h4 av-h4-form" id="av-t-' + esc(a.id) + '" tabindex="-1">Traiter l\'avis ' + esc(a.id) + "</h4>" + recoupement(a);
    h += '<fieldset class="op-section av-fs"><legend id="av-l-nature">Type de l\'avis *</legend><div class="av-radios" role="radiogroup" aria-labelledby="av-l-nature"' + (erreur("nature") ? ' aria-invalid="true" aria-describedby="av-err"' : "") + '>' + A.NATURES.map(function (x) {
      return '<label class="op-case"><input type="radio" name="av-nature" id="av-nature-' + x.id + '" value="' + x.id + '"' + (f.nature === x.id ? " checked" : "") + '><span><strong>' + esc(x.lib) + '</strong><span class="av-sous">' + esc(x.sous) + "</span></span></label>";
    }).join("") + "</div></fieldset>";
    if (nat) h += '<div class="av-procedure"><p class="av-ctl-t">Procédure conseillée par GS (convention de l\'exercice)</p><p>' + esc(nat.procedure) + "</p></div>";
    h += '<fieldset class="op-section av-fs"><legend id="av-l-suites">Suites à donner *</legend><div class="av-radios"' + (erreur("suites") ? ' aria-describedby="av-err"' : "") + '>' + A.SUITES.map(function (x) {
      return '<label class="op-case"><input type="checkbox" name="av-suite" id="av-suite-' + x.id + '" value="' + x.id + '"' + (f.suites.indexOf(x.id) >= 0 ? " checked" : "") + "><span>" + esc(x.lib) + "</span></label>";
    }).join("") + "</div></fieldset>";
    if (repond) {
      h += '<div class="champ av-champ"><label for="av-reponse">Réponse publique à publier *</label><textarea id="av-reponse" rows="7" maxlength="2000"' + (erreur("reponse") ? ' aria-invalid="true" aria-describedby="av-aide-rep av-compteur av-err"' : ' aria-describedby="av-aide-rep av-compteur"') + ">" + esc(f.reponse) + "</textarea>" +
        '<span class="aide-champ" id="av-aide-rep">Tout le monde la lira. Ne confirmez pas que l\'auteur est client, ne citez aucun détail de sa situation ni aucun nom, ne promettez rien : proposez un contact privé. Entre ' + A.CONV.motsMin + " et " + A.CONV.motsMax + " mots.</span>" +
        '<span class="av-compteur" id="av-compteur">' + esc(compteur(f.reponse)) + "</span></div>" +
        '<div class="av-btns"><button type="button" class="btn btn-secondaire" data-act="controler">Contrôler la réponse avant publication</button></div>';
    }
    h += '<div id="av-controle" class="av-controle" tabindex="-1" aria-live="polite">' + (repond ? controleHtml(etat.controle) : "") + "</div>";
    h += '<div class="champ av-champ"><label for="av-note">Note interne' + (aucune ? " *" : " (facultative)") + '</label><textarea id="av-note" rows="3" maxlength="300"' + (erreur("note") ? ' aria-invalid="true" aria-describedby="av-aide-note av-err"' : ' aria-describedby="av-aide-note"') + ">" + esc(f.note) + "</textarea>" +
      '<span class="aide-champ" id="av-aide-note">Pour la directrice et vos collègues : ce que vous avez constaté ou décidé. Elle n\'est jamais publiée. 300 signes au plus' + (aucune ? ". Obligatoire avec « Aucune suite » : justifiez-la" : "") + ".</span></div>";
    h += '<div class="msg-erreur" id="av-err" role="alert">' + (etat.err ? (etat.err.length > 1 ? "<ul>" + etat.err.map(function (e) { return "<li>" + esc(e.msg) + "</li>"; }).join("") + "</ul>" : esc(etat.err[0].msg)) : "") + "</div>";
    h += '<div class="av-btns"><button type="submit" class="btn btn-principal">Enregistrer le traitement</button><button type="button" class="btn btn-secondaire" data-act="annuler">Annuler</button></div></form>';
    return h;
  }

  /* ---------- avis traité ---------- */
  function liensSuites(a, t) {
    var c = A.candidats(a.auteur, CL), h = "", rec = t.suites.indexOf("reclamation") >= 0, priv = t.suites.indexOf("prive") >= 0;
    if (!rec && !priv) return "";
    if (!c.length) return '<p class="av-info" role="note">' + ICO.info + "<span>Aucun client n'est identifié dans les dossiers : pour " + (rec ? "enregistrer la réclamation" : "le contact privé") + ", demandez à l'auteur, en message privé, son nom et son numéro de client, sans rien confirmer en public.</span></p>";
    h = '<div class="regul-actions">';
    c.forEach(function (x) {
      if (rec) h += '<a class="btn btn-secondaire av-lien" href="reclamation.html?client=' + x.id + '&amp;canal=avis">Enregistrer la réclamation de ' + esc(x.prenom + " " + x.nom.toUpperCase()) + "</a>";
      h += '<a class="btn btn-secondaire av-lien" href="client.html?id=' + x.id + '">Fiche client ' + esc(x.prenom + " " + x.nom.toUpperCase()) + "</a>";
    });
    return h + "</div>";
  }
  function recap(a, t) {
    var nat = nature(t.nature), ctl = t.reponse ? A.controler(t.reponse, { nature: t.nature, suites: t.suites, noms: [] }) : null;
    var h = '<dl class="regul-donnees av-recap"><div><dt>Type retenu</dt><dd>' + esc(nat ? nat.lib : t.nature) + "</dd></div><div><dt>Suites</dt><dd>" + esc(t.suites.map(suiteLib).join(" ; ")) + "</dd></div>" +
      (t.reponse ? '<div><dt>Réponse validée pour publication</dt><dd class="av-rep">' + esc(t.reponse) + "</dd></div>" : "") +
      (t.note ? "<div><dt>Note interne</dt><dd>" + esc(t.note) + "</dd></div>" : "") +
      "<div><dt>Traité le</dt><dd>" + esc(dateLongue(t.date)) + " à " + esc(t.heure.replace(":", " h ")) + (t.par ? " par " + esc(t.par) : "") + "</dd></div></dl>";
    if (ctl && ctl.avertissements.length) h += '<div class="av-ctl av-ctl-warn"><p class="av-ctl-t">' + ICO.info + "Avertissements du contrôle (" + ctl.avertissements.length + ")</p><ul>" + ctl.avertissements.map(function (x) { return "<li><strong>" + esc(x.titre) + ".</strong> " + esc(x.detail) + "</li>"; }).join("") + "</ul></div>";
    if (t.points && t.points.length) h += '<div class="av-ctl av-ctl-warn"><p class="av-ctl-t">' + ICO.info + "Points d'attention (" + t.points.length + ")</p><ul>" + t.points.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div>";
    return h + liensSuites(a, t);
  }
  function confirmation(a, t) {
    return '<section class="bloc av-ok" id="av-ok" aria-labelledby="av-t-ok"><div class="bloc-tete"><h2 id="av-t-ok" tabindex="-1">' + ICO.check + "Traitement enregistré</h2><span class=\"sous\">Avis " + esc(a.id) + " – " + esc(a.auteur) + "</span></div>" +
      '<p class="av-ok-txt">La réponse, si elle existe, est validée : elle reste à publier sur la plateforme (cet outil ne publie rien). Les autres suites sont à faire par vous ou à transmettre.</p>' + recap(a, t) +
      '<div class="av-btns"><button type="button" class="btn btn-secondaire" data-act="fermer-ok">Fermer</button><button type="button" class="btn btn-secondaire" data-act="voir-traites">Voir les avis traités</button></div></section>';
  }
  function confirmRemettre(a) {
    return '<div class="av-conf" id="av-conf" tabindex="-1" role="group" aria-labelledby="av-conf-t"><p id="av-conf-t"><strong>Remettre l\'avis ' + esc(a.id) + " à traiter ?</strong> La réponse et la note enregistrées seront effacées.</p>" +
      '<div class="av-btns"><button type="button" class="btn btn-principal" data-act="remettre-ok" data-id="' + esc(a.id) + '">Remettre à traiter</button><button type="button" class="btn btn-secondaire" data-act="remettre-non" data-id="' + esc(a.id) + '">Annuler</button></div></div>';
  }
  function carte(a) {
    var t = A.traitement(st(), a.id), ouvert = etat.ouvert === a.id, h;
    h = '<li class="regul-carte av-carte av-carte-' + (t ? "traite" : A.enRetard(a, st(), B.aujourdhui()) ? "retard" : "attente") + '" id="av-' + esc(a.id) + '">' + entete(a, t);
    if (t) {
      h += recap(a, t);
      h += etat.conf === a.id ? confirmRemettre(a) : '<div class="av-btns"><button type="button" class="btn btn-secondaire" data-act="remettre" data-id="' + esc(a.id) + '">Remettre à traiter</button></div>';
    } else if (ouvert) h += '<div id="av-zone">' + formHtml(a) + "</div>";
    else h += '<div class="av-btns"><button type="button" class="btn btn-principal" data-act="traiter" data-id="' + esc(a.id) + '">Traiter cet avis</button></div>';
    return h + "</li>";
  }
  function liste(b) {
    var l = A.liste().filter(function (a) { var t = A.traitement(st(), a.id); return etat.filtre === "tous" || (etat.filtre === "traites" ? !!t : !t); });
    var h = '<section class="bloc" aria-labelledby="av-t-liste"><div class="bloc-tete"><h2 id="av-t-liste" tabindex="-1">Avis reçus</h2><span class="sous">' + pl(l.length, "avis affiché", "avis affichés") + " – les plus récents d'abord</span></div>" + filtres(b);
    if (!l.length) return h + '<p class="vide-bloc">' + (etat.filtre === "atraiter" ? "Tous les avis sont traités. Les avis traités sont consultables, et peuvent être remis à traiter, dans l'onglet « Traités »." : "Aucun avis traité pour le moment. Choisissez un avis à traiter, qualifiez-le, décidez des suites puis faites contrôler la réponse.") + "</p></section>";
    return h + '<ul class="regul-liste av-liste">' + l.map(carte).join("") + "</ul></section>";
  }

  /* ---------- règles et sources ---------- */
  function regles() {
    return '<section class="bloc" aria-labelledby="av-t-regles"><div class="bloc-tete"><h2 id="av-t-regles">Les règles à connaître</h2><span class="sous">Textes consultés le 17 novembre 2026</span></div>' +
      A.REGLES.map(function (r) { return '<details class="av-regle"><summary>' + esc(r.titre) + "</summary><p>" + esc(r.texte) + "</p></details>"; }).join("") + "</section>";
  }

  /* Typographie française : espace insécable avant « : », « % » et « € », dans les nombres à milliers et à l'intérieur des guillemets. */
  function typo(racine) {
    var w = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT, null), n, l = [];
    while ((n = w.nextNode())) { if (n.parentNode && /^(SCRIPT|STYLE|OPTION|TEXTAREA)$/.test(n.parentNode.nodeName)) continue; l.push(n); }
    l.forEach(function (t) {
      var v = t.nodeValue, r = v.replace(/ +([:;!?%€»])/g, " $1").replace(/(\d) (\d{3})(?!\d)/g, "$1 $2").replace(/« +/g, "« ");
      if (r !== v) t.nodeValue = r;
    });
  }
  function render(focus) {
    document.title = "GS Banque & Assurance – Avis clients en ligne";
    var b = A.bilan(st(), B.aujourdhui()), fait = etat.fait ? A.trouver(etat.fait) : null, tf = fait ? A.traitement(st(), fait.id) : null;
    app.innerHTML = '<nav class="fil-ariane" aria-label="Fil d\'Ariane"><a href="index.html">' + ICO.retour + 'Accueil</a></nav>' +
      '<div class="page-titre"><h1>Avis clients en ligne</h1><p>Des clients, ou des inconnus, laissent un avis sur la page de l\'agence. Le conseiller le lit, le qualifie, décide de la suite et rédige une réponse publique qui ne révèle rien de la relation entre l\'auteur et la banque.</p></div>' +
      deroule() + vue(b) + (fait && tf ? confirmation(fait, tf) : "") + liste(b) + regles() +
      '<p class="av-rappel">Sources des règles : Légifrance (Code monétaire et financier, article L511-33 ; Code pénal, article 226-13 ; Code de la consommation, articles L111-7-2, L121-4 et L132-2 ; loi du 29 juillet 1881, article 65), recommandation 2022-R-01 de l\'ACPR. La définition de la diffamation (article 29 de la loi de 1881) n\'a été confirmée que par une source secondaire : la page de Légifrance n\'a pas pu être lue. Les délais de réponse, la longueur et le ton attendus, la liste des mots refusés et la procédure de chaque type d\'avis sont des conventions de GS Banque &amp; Assurance, inventées pour l\'exercice. Les avis, leurs auteurs, les IBAN et les codes cités sont fictifs.</p>';
    typo(app);
    if (focus) { var n = document.getElementById(focus); if (n) { try { n.focus(); } catch (e) { /* ignoré */ } if (/^av-t-/.test(focus) && n.scrollIntoView) n.scrollIntoView({ block: "start" }); } }
  }
  /* Met à jour seulement le panneau de traitement (garde le défilement et la saisie de la page). */
  function majForm(focus) {
    var a = etat.ouvert ? A.trouver(etat.ouvert) : null, z = document.getElementById("av-zone"); if (!a || !z) { render(focus); return; }
    z.innerHTML = formHtml(a); typo(z);
    if (focus) { var n = document.getElementById(focus); if (n) { try { n.focus(); } catch (e) { /* ignoré */ } } }
  }

  /* ---------- actions ---------- */
  function lire() {
    var f = document.getElementById("av-form"); if (!f) return;
    var r = f.querySelector('input[name="av-nature"]:checked'); etat.f.nature = r ? r.value : "";
    etat.f.suites = Array.prototype.filter.call(f.querySelectorAll('input[name="av-suite"]'), function (i) { return i.checked; }).map(function (i) { return i.value; });
    var rep = document.getElementById("av-reponse"); if (rep) etat.f.reponse = rep.value;
    var no = document.getElementById("av-note"); if (no) etat.f.note = no.value;
  }
  function saisie() { return { nature: etat.f.nature, suites: etat.f.suites.slice(), reponse: etat.f.reponse, note: etat.f.note }; }
  var CIBLE = { nature: function () { return "av-nature-" + A.NATURES[0].id; }, suites: function () { return "av-suite-" + A.SUITES[0].id; }, reponse: function () { return "av-reponse"; }, note: function () { return "av-note"; }, avis: function () { return "av-err"; } };
  function enregistrer() {
    lire();
    if (etat.f.suites.indexOf("repondre") < 0) etat.f.reponse = "";      /* un texte tapé puis masqué (suite décochée) n'est pas enregistré */
    var a = A.trouver(etat.ouvert); if (!a) return;
    var r = A.valider(st(), a.id, saisie(), { noms: noms(a) });
    if (!r.ok) {
      etat.err = r.erreurs; etat.controle = r.controle || null;
      var c = r.erreurs[0].champ, id = (CIBLE[c] || CIBLE.avis)();
      if (c === "nature" && etat.f.nature) id = "av-nature-" + etat.f.nature;
      majForm(document.getElementById(id) ? id : "av-err"); return;
    }
    B.store.sauver();
    etat.fait = a.id; etat.ouvert = null; etat.f = Object.assign({}, VIDE, { suites: [] }); etat.err = null; etat.controle = null; etat.conf = null;
    render("av-t-ok");
  }
  function controler() {
    lire();
    var a = A.trouver(etat.ouvert); if (!a) return;
    etat.err = null; etat.controle = A.controler(etat.f.reponse, { nature: etat.f.nature, suites: etat.f.suites, noms: noms(a) });
    majForm("av-controle");
  }

  app.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-act]") : null; if (!b) return;
    var act = b.getAttribute("data-act"), id = b.getAttribute("data-id");
    if (act === "filtre") { etat.filtre = b.getAttribute("data-f"); etat.ouvert = null; etat.conf = null; render("av-f-" + etat.filtre); }
    else if (act === "traiter") { etat.ouvert = id; etat.f = Object.assign({}, VIDE, { suites: [] }); etat.err = null; etat.controle = null; etat.fait = null; etat.conf = null; render("av-t-" + id); }
    else if (act === "annuler") { var o = etat.ouvert; etat.ouvert = null; etat.err = null; etat.controle = null; render(); var bt = document.querySelector('[data-act="traiter"][data-id="' + o + '"]'); if (bt) bt.focus(); }
    else if (act === "controler") controler();
    else if (act === "remettre") { etat.conf = id; etat.ouvert = null; render("av-conf"); }
    else if (act === "remettre-non") { etat.conf = null; render(); var br = document.querySelector('[data-act="remettre"][data-id="' + id + '"]'); if (br) br.focus(); }
    else if (act === "remettre-ok") { var r = A.remettre(st(), id); if (r.ok) B.store.sauver(); etat.conf = null; render("av-t-liste"); }
    else if (act === "fermer-ok") { etat.fait = null; render("av-t-liste"); }
    else if (act === "voir-traites") { etat.fait = null; etat.filtre = "traites"; render("av-t-liste"); }
  });
  app.addEventListener("submit", function (e) { if (e.target.id === "av-form") { e.preventDefault(); enregistrer(); } });
  app.addEventListener("change", function (e) {
    var t = e.target; if (!t.closest || !t.closest("#av-form") || !t.name) return;
    if (t.name !== "av-nature" && t.name !== "av-suite") return;
    lire();
    if (t.name === "av-suite") {                       /* « Aucune suite » exclut toutes les autres */
      if (t.value === "aucune" && t.checked) etat.f.suites = ["aucune"];
      else if (t.value !== "aucune" && t.checked) etat.f.suites = etat.f.suites.filter(function (x) { return x !== "aucune"; });
    }
    etat.err = null; etat.controle = null; majForm(t.id);
  });
  app.addEventListener("input", function (e) {
    var t = e.target;
    if (t.id === "av-reponse") {
      etat.f.reponse = t.value; var c = document.getElementById("av-compteur"); if (c) c.textContent = compteur(t.value);
      if (etat.controle) { etat.controle = null; var z = document.getElementById("av-controle"); if (z) z.innerHTML = ""; }
    } else if (t.id === "av-note") etat.f.note = t.value;
  });

  RECH.init(CL, document.getElementById("rech"), document.getElementById("rech-res"), document.getElementById("rech-statut"));
  render();
})();
