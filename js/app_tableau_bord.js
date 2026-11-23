/* GS Banque & Assurance – page « Tableau de bord de l'agence » : lire les résultats du mois écoulé de l'agence et de ses cinq conseillers, repérer les écarts avec les objectifs, retenir les écarts prioritaires,
   en chercher les causes probables, proposer des actions correctives, noter les écarts à suivre par anticipation et rédiger la synthèse pour la directrice.
   Les règles sont dans tableau_bord.js, les chiffres dans data_tableau_bord.js. L'analyse du mois est enregistrée dans st.tableauBord (une par mois). */
(function () {
  "use strict";

  var SG = window.SGBF, B = SG.banque, T = SG.tableauBord, EQ = SG.equipe, ICO = SG.icones, RECH = SG.recherche, app = document.getElementById("app"), statut = document.getElementById("tb-statut");
  var esc = B.esc, NB = " ", SEUILS = T.SEUILS;
  var etat = { scope: "agence", prio: [], suivre: [], synthese: "", err: null, verif: null, msg: "", reprise: false, conf: false };
  var OUTILS = { "phoning.html": "Phoning et prospection", "campagnes.html": "Campagnes commerciales", "o2pc.html": "O2PC : opportunités commerciales", "agenda.html": "Agenda commercial", "reclamation.html": "Réclamations", "equipe.html": "Agenda de l'équipe" };

  function st() { return B.store.charger(); }
  function per() { return T.periode(B.aujourdhui()); }
  function pl(n, s, p) { return n + " " + (n > 1 ? p : s); }
  function minus(s) { return s.charAt(0).toLowerCase() + s.slice(1); }
  function dateLongue(ymd) { var d = B.lireYmd(ymd); return d ? d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : ""; }
  function pc(x) { return Math.abs(x).toFixed(1).replace(".", ",") + NB + "%"; }
  function nomEleve() { return EQ.nomComplet(EQ.collab("moi"), st()); }
  function courtScope(s) { return s === "agence" ? "Agence" : s === "moi" ? "Vous" : EQ.nomComplet(EQ.collab(s), st()); }
  function libScope(s) { return s === "agence" ? "Agence de Paris" : s === "moi" ? (nomEleve() !== "Vous" ? "Vous (" + nomEleve() + ")" : "Vous") : EQ.nomComplet(EQ.collab(s), st()); }
  function nomL(l) { return T.indicateur(l.ind).lib + " – " + courtScope(l.scope); }
  function cause(id) { return T.CAUSES.filter(function (x) { return x.id === id; })[0] || null; }
  function action(id) { return T.ACTIONS.filter(function (x) { return x.id === id; })[0] || null; }
  function rangPrio(c) { for (var i = 0; i < etat.prio.length; i++) if (etat.prio[i].cle === c) return i; return -1; }
  function annonce(t) { if (statut) statut.textContent = t; }

  /* ---------- en-tête, déroulé, vue d'ensemble ---------- */
  function deroule() {
    var e = [
      ["Lire et comparer", "Chaque résultat du mois est comparé à son objectif, au mois précédent et au même mois de l'an dernier. L'écart se lit en pourcentage de l'objectif."],
      ["Repérer et retenir", "Un écart est significatif à partir de 10 % de l'objectif. Vous en retenez trois au plus, ceux qui demandent une action : on ne peut pas tout traiter."],
      ["Chercher les causes et agir", "Fonds de commerce, portefeuille, activité, formation, absence, procédures, conjoncture : une cause probable, une action corrective et une échéance pour chaque écart."],
      ["Informer la directrice", "Les écarts non significatifs qui risquent de se dégrader sont notés à suivre. Une synthèse écrite dit ce qui va mal, pourquoi et ce que vous proposez."]
    ];
    return '<ol class="op-deroule regul-deroule" aria-label="Déroulé de l\'analyse du mois">' + e.map(function (x, i) {
      return '<li><span class="op-deroule-num" aria-hidden="true">' + (i + 1) + '</span><span class="op-deroule-txt"><strong>' + esc(x[0]) + "</strong><span>" + esc(x[1]) + "</span></span></li>";
    }).join("") + "</ol>";
  }
  function vue(p) {
    var tous = T.toutes(), n = { significatif: 0, asuivre: 0, favorable: 0, conforme: 0 };
    tous.forEach(function (l) { n[l.s.code]++; });
    var d = [["Écarts significatifs", n.significatif, "à partir de 10 % défavorables", "tb-b-bad"], ["Écarts à suivre", n.asuivre, "de 5 à moins de 10 % défavorables, en dégradation", "tb-b-warn"], ["Résultats favorables", n.favorable, "objectif dépassé de 10 % ou plus", "tb-b-ok"], ["Résultats conformes", n.conforme, "écart sous les seuils", "tb-b-neutre"]];
    return '<section class="bloc tb-vue" aria-labelledby="tb-t-vue"><div class="bloc-tete"><h2 id="tb-t-vue">Vue d\'ensemble ' + esc(p.de) + '</h2><span class="sous">' + tous.length + " résultats : 10 indicateurs pour l'agence et pour chacun de ses cinq conseillers</span></div>" +
      '<dl class="tb-bilan" aria-label="Bilan des écarts du mois">' + d.map(function (x) { return '<div class="tb-b ' + x[3] + '"><dt>' + esc(x[0]) + "</dt><dd>" + x[1] + '</dd><dd class="tb-b-sous">' + esc(x[2]) + "</dd></div>"; }).join("") + "</dl>" +
      '<div class="tb-contexte"><p><strong>Contexte du marché.</strong> ' + esc(T.CONJONCTURE) + "</p></div></section>";
  }

  /* ---------- tableaux de résultats ---------- */
  function evolution(v) { return Math.abs(v.reel - v.prec) < 1e-9 ? "résultat stable" : v.reel > v.prec ? "résultat en hausse" : "résultat en baisse"; }
  function lecture(l) {
    var d = l.s.defav;
    if (l.s.code === "significatif") return "Écart défavorable de " + pc(d * 100) + " par rapport à l'objectif, au-delà du seuil de 10" + NB + "%.";
    if (l.s.code === "asuivre") return "Écart défavorable de " + pc(d * 100) + " et résultat plus défavorable que le mois précédent : à suivre avant qu'il ne s'aggrave.";
    if (l.s.code === "favorable") return "Résultat meilleur que l'objectif de " + pc(d * 100) + ".";
    if (d >= SEUILS.suivre - SEUILS.eps) return "Écart défavorable de " + pc(d * 100) + ", sans dégradation par rapport au mois précédent : pas de suivi particulier.";
    if (d > 0.0005) return "Écart défavorable de " + pc(d * 100) + ", sous le seuil de 5" + NB + "%.";
    if (d < -0.0005) return "Objectif dépassé de " + pc(d * 100) + ".";
    return "Objectif atteint.";
  }
  function puce(code) {
    if (code === "significatif") return '<span class="chip chip-bad">' + ICO.alerte + T.STATUTS[code] + "</span>";
    if (code === "asuivre") return '<span class="chip chip-warn">' + ICO.info + T.STATUTS[code] + "</span>";
    if (code === "favorable") return '<span class="chip chip-ok">' + ICO.check + T.STATUTS[code] + "</span>";
    return '<span class="chip chip-ctrl">' + T.STATUTS[code] + "</span>";
  }
  function modifiable() { return !T.analyse(st(), per().cle) || etat.reprise; }
  function choix(l) {
    if (!modifiable()) return "";
    var c = l.cle, id = "tb-b-" + l.scope + "-" + l.ind, n = nomL(l);
    if (l.s.code === "significatif") {
      var r = rangPrio(c);
      return r >= 0 ? '<span class="chip chip-ctrl tb-rang">Écart prioritaire n°' + NB + (r + 1) + '</span><button type="button" class="btn btn-secondaire" id="' + id + '" data-act="prio" data-cle="' + c + '" aria-label="Retirer des écarts prioritaires : ' + esc(n) + '">Retirer des écarts prioritaires</button>'
        : '<button type="button" class="btn btn-secondaire" id="' + id + '" data-act="prio" data-cle="' + c + '" aria-label="Retenir comme prioritaire : ' + esc(n) + '">Retenir comme prioritaire</button>';
    }
    if (l.s.code === "asuivre") {
      return etat.suivre.indexOf(c) >= 0 ? '<span class="chip chip-ctrl tb-rang">Noté à suivre</span><button type="button" class="btn btn-secondaire" id="' + id + '" data-act="suivre" data-cle="' + c + '" aria-label="Retirer des écarts à suivre : ' + esc(n) + '">Retirer des écarts à suivre</button>'
        : '<button type="button" class="btn btn-secondaire" id="' + id + '" data-act="suivre" data-cle="' + c + '" aria-label="Noter à suivre : ' + esc(n) + '">Noter à suivre</button>';
    }
    return "";
  }
  function ligneHtml(l) {
    var i = T.indicateur(l.ind), v = l.v;
    var calc = i.type === "taux" ? '<span class="tb-calc">' + esc(i.num) + " <b>" + B.nb(v.num) + "</b> ÷ " + esc(i.den) + " <b>" + B.nb(v.den) + "</b></span>" : "";
    return '<tr class="tb-l-' + l.s.code + '"><th scope="row">' + esc(i.lib) + calc + "</th>" +
      '<td data-label="Objectif">' + T.fmt(l.ind, v.obj) + "</td>" +
      '<td data-label="Réalisé"><strong>' + T.fmt(l.ind, v.reel) + "</strong></td>" +
      '<td data-label="Écart">' + T.fmtEcart(l.ind, v) + ' <span class="tb-rel">(' + T.fmtRel(l.s.ecartRel) + ")</span></td>" +
      '<td data-label="Mois précédent">' + T.fmt(l.ind, v.prec) + ' <span class="tb-evol">' + esc(evolution(v)) + "</span></td>" +
      '<td data-label="Même mois de l\'an dernier">' + T.fmt(l.ind, v.an1) + "</td>" +
      '<td class="tb-g tb-lec" data-label="Lecture">' + puce(l.s.code) + "<p>" + esc(lecture(l)) + "</p>" + choix(l) + "</td></tr>";
  }
  function tableau(titre, sous, ls, p) {
    var tete = ["Indicateur", "Objectif", "Réalisé", "Écart avec l'objectif", "Mois précédent", "Même mois de l'an dernier", "Lecture"];
    return '<h3 class="tb-tab-t">' + esc(titre) + '</h3><p class="tb-tab-sous">' + esc(sous) + "</p>" +
      '<div class="tb-defile" role="region" tabindex="0" aria-label="' + esc(titre + " – " + libScope(etat.scope) + " – " + p.lib) + '"><table class="tb-tab"><caption class="sr">' + esc(titre + " – " + libScope(etat.scope) + " – " + p.lib) + "</caption><thead><tr>" +
      tete.map(function (t, k) { return '<th scope="col"' + (k === 6 ? ' class="tb-g"' : "") + ">" + esc(t) + "</th>"; }).join("") + "</tr></thead><tbody>" + ls.map(ligneHtml).join("") + "</tbody></table></div>";
  }
  function contexte(s) {
    if (s === "agence") {
      var cl = 0, ab = 0; T.CONSEILLERS.forEach(function (c) { cl += c.clients; ab += c.absences; });
      return "<p><strong>Agence de Paris</strong> – " + pl(cl, "client", "clients") + " répartis entre " + T.CONSEILLERS.length + " conseillers, " + pl(ab, "jour ouvré", "jours ouvrés") + " d'absence cumulés ce mois-ci. Un taux de l'agence se calcule sur l'ensemble des clients ou des appels, non en faisant la moyenne des taux des conseillers.</p>";
    }
    var cn = T.conseiller(s), c = EQ.collab(s);
    return "<p><strong>" + esc(libScope(s)) + "</strong> – " + (s === "moi" ? "votre portefeuille" : esc(EQ.posteLib(c))) + ", " + esc(minus(cn.poste)) + " – " + pl(cn.clients, "client", "clients") + " – " + (cn.absences ? pl(cn.absences, "jour ouvré", "jours ouvrés") + " d'absence ce mois-ci" : "aucune absence ce mois-ci") + ".</p><p>" + esc(cn.contexte) + "</p>";
  }
  function vues() {
    return '<div class="tb-vues" role="group" aria-label="Résultats à afficher">' + T.SCOPES.map(function (s) {
      var n = T.lignes(s).filter(function (l) { return l.s.code === "significatif"; }).length;
      return '<button type="button" class="btn ' + (etat.scope === s ? "btn-principal" : "btn-secondaire") + '" id="tb-v-' + s + '" data-act="vue" data-s="' + s + '" aria-pressed="' + (etat.scope === s) + '">' + esc(courtScope(s)) +
        (n ? ' <span class="tb-badge" aria-hidden="true">' + n + '</span><span class="sr"> (' + pl(n, "écart significatif", "écarts significatifs") + ")</span>" : "") + "</button>";
    }).join("") + "</div>";
  }
  function resultats(p) {
    var ls = T.lignes(etat.scope), q = ls.filter(function (l) { return T.indicateur(l.ind).famille === "quantitatif"; }), k = ls.filter(function (l) { return T.indicateur(l.ind).famille === "qualitatif"; });
    var h = '<section class="bloc tb-res" aria-labelledby="tb-t-res"><div class="bloc-tete"><h2 id="tb-t-res" tabindex="-1">Résultats ' + esc(p.de) + '</h2><span class="sous">' + esc(libScope(etat.scope)) + "</span></div>" + vues() +
      '<div class="tb-lecture"><p><strong>Comment lire le tableau.</strong> L\'écart avec l\'objectif est exprimé en pourcentage de l\'objectif : un écart défavorable de 10' + NB + "% ou plus est significatif. Le mois précédent dit si la situation se dégrade, le même mois de l'an dernier si l'écart est habituel ou nouveau. Dans un taux, le calcul est rappelé sous le nom de l'indicateur.</p></div>" +
      '<div class="tb-contexte">' + contexte(etat.scope) + "</div>";
    if (modifiable()) {
      var np = etat.prio.length, ns = etat.suivre.length;
      h += '<p class="tb-retenus"><span><strong>' + pl(np, "écart prioritaire retenu", "écarts prioritaires retenus") + "</strong> sur " + SEUILS.prioMax + " au plus – " + pl(ns, "écart noté à suivre", "écarts notés à suivre") + '</span> <a href="#tb-t-analyse">Compléter mon analyse</a></p>';
    } else {
      var sv = T.analyse(st(), p.cle);
      h += '<p class="tb-retenus"><span><strong>Analyse ' + esc(p.de) + " enregistrée</strong> – " + pl(sv.prioritaires.length, "écart prioritaire", "écarts prioritaires") + ", " + pl(sv.asuivre.length, "écart à suivre", "écarts à suivre") + '</span> <a href="#tb-t-ok">Voir mon analyse</a></p>';
    }
    h += '<p class="tb-msg" id="tb-msg" role="alert">' + esc(etat.msg) + "</p>";
    h += tableau("Indicateurs quantitatifs", "Ils mesurent l'activité en euros et en nombre : produit net bancaire, crédits, contrats, produits détenus par client.", q, p);
    h += tableau("Indicateurs qualitatifs", "Ils mesurent la qualité du travail commercial et de la relation avec les clients.", k, p);
    return h + "</section>";
  }

  /* ---------- analyse : formulaire ---------- */
  function erreur(champ) { return etat.err && etat.err.some(function (e) { return e.champ === champ; }); }
  function compteurJ(t) { return pl(t.length, "signe", "signes") + " sur 400 – 40 au moins"; }
  function compteurS(t) { return pl(t.length, "signe", "signes") + " – de " + SEUILS.syntheseMin + " à " + SEUILS.syntheseMax; }
  function prioHtml(x, n) {
    var l = T.ligne(x.scope, x.ind), i = T.indicateur(x.ind), id = "tb-p" + n, v = l.v;
    var h = '<div class="tb-prio" role="group" aria-labelledby="' + id + '-t"><div class="tb-prio-tete"><div><h4 class="tb-h4" id="' + id + '-t" tabindex="-1">Écart ' + (n + 1) + " : " + esc(nomL(l)) + '</h4><p class="tb-prio-val">Résultat ' + T.fmt(x.ind, v.reel) + " pour un objectif de " + T.fmt(x.ind, v.obj) + " (écart de " + T.fmtEcart(x.ind, v) + ", soit " + pc(l.s.defav * 100) + " d'écart défavorable).</p></div>" +
      '<button type="button" class="btn btn-secondaire tb-retirer" data-act="retirer-prio" data-cle="' + esc(x.cle) + '" aria-label="Retirer l\'écart ' + (n + 1) + " : " + esc(nomL(l)) + '">Retirer</button></div>';
    h += '<div class="tb-grp"><p class="tb-ctl-t" id="' + id + '-lc">Causes probables *</p><div class="tb-cases" role="group" aria-labelledby="' + id + '-lc"' + (erreur("prio-" + n + "-causes") ? ' aria-describedby="tb-err"' : "") + ">" + T.CAUSES.map(function (c) {
      return '<label class="op-case"><input type="checkbox" id="' + id + "-c-" + c.id + '" name="' + id + '-c" value="' + c.id + '"' + (x.causes.indexOf(c.id) >= 0 ? " checked" : "") + "><span>" + esc(c.lib) + '<span class="tb-sous">' + esc(c.sous) + "</span></span></label>";
    }).join("") + "</div></div>";
    h += '<div class="champ tb-champ"><label for="' + id + '-j">Justification chiffrée *</label><textarea id="' + id + '-j" rows="3" maxlength="500"' + (erreur("prio-" + n + "-justif") ? ' aria-invalid="true" aria-describedby="' + id + "-jd " + id + '-jc tb-err"' : ' aria-describedby="' + id + "-jd " + id + '-jc"') + ">" + esc(x.justification) + "</textarea>" +
      '<span class="aide-champ" id="' + id + '-jd">Une ou deux phrases qui s\'appuient sur au moins un chiffre du tableau ou du contexte (écart, effectif, jours d\'absence…). Elle explique pourquoi les causes retenues sont les plus probables.</span><span class="tb-compteur" id="' + id + '-jc">' + esc(compteurJ(x.justification)) + "</span></div>";
    h += '<div class="tb-grp"><p class="tb-ctl-t" id="' + id + '-la">Actions correctives proposées *</p><div class="tb-cases tb-cases-1" role="group" aria-labelledby="' + id + '-la"' + (erreur("prio-" + n + "-actions") ? ' aria-describedby="tb-err"' : "") + ">" + T.ACTIONS.map(function (a) {
      return '<label class="op-case"><input type="checkbox" id="' + id + "-a-" + a.id + '" name="' + id + '-a" value="' + a.id + '"' + (x.actions.indexOf(a.id) >= 0 ? " checked" : "") + "><span>" + esc(a.lib) + (a.href ? '<span class="tb-sous">Outil du poste : ' + esc(OUTILS[a.href]) + "</span>" : "") + "</span></label>";
    }).join("") + "</div></div>";
    var auj = B.aujourdhui(), min = B.ymd(auj), max = B.ymd(B.plusJours(auj, SEUILS.echeanceMax));
    h += '<div class="champ tb-champ"><label for="' + id + '-e">Échéance de l\'action *</label><input type="date" id="' + id + '-e" min="' + min + '" max="' + max + '" value="' + esc(x.echeance) + '"' + (erreur("prio-" + n + "-echeance") ? ' aria-invalid="true" aria-describedby="' + id + '-ed tb-err"' : ' aria-describedby="' + id + '-ed"') + '><span class="aide-champ" id="' + id + '-ed">Au plus tard le ' + esc(dateLongue(max)) + " (" + SEUILS.echeanceMax + " jours) : une action corrective se juge sur le mois qui suit.</span></div></div>";
    return h;
  }
  function suivreHtml() {
    if (!etat.suivre.length) return '<p class="vide-bloc">Aucun écart noté à suivre. Cette partie est facultative : dans les tableaux, les écarts « à suivre » sont ceux qui ne sont pas encore significatifs mais se dégradent.</p>';
    return '<ul class="tb-suivre">' + etat.suivre.map(function (c) {
      var r = T.lire(c), l = r ? T.ligne(r.scope, r.ind) : null; if (!l) return "";
      return "<li><span><strong>" + esc(nomL(l)) + "</strong> : " + T.fmt(l.ind, l.v.reel) + " pour un objectif de " + T.fmt(l.ind, l.v.obj) + ", " + esc(minus(evolution(l.v))) + ' sur un mois.</span><button type="button" class="btn btn-secondaire" data-act="retirer-suivre" data-cle="' + esc(c) + '" aria-label="Retirer des écarts à suivre : ' + esc(nomL(l)) + '">Retirer</button></li>';
    }).join("") + "</ul>";
  }
  function verifHtml() {
    var r = etat.verif; if (!r) return "";
    if (r.vide) return '<div class="tb-ctl"><p class="tb-ctl-t">' + ICO.info + "Rien à vérifier pour le moment</p><p>Retenez d'abord au moins un écart prioritaire dans les tableaux, puis choisissez ses causes et ses actions.</p></div>";
    if (!r.points.length) return '<div class="tb-ctl tb-ctl-ok"><p class="tb-ctl-t">' + ICO.check + "Aucun point d'attention</p><p>Vos causes et vos actions sont cohérentes entre elles.</p></div>";
    return '<div class="tb-ctl"><p class="tb-ctl-t">' + ICO.info + "Points d'attention (" + r.points.length + ")</p><ul>" + r.points.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul><p>Ces points ne bloquent pas l'enregistrement : à vous de juger s'ils sont fondés.</p></div>";
  }
  function formHtml(p) {
    var h = '<form class="formulaire tb-form" id="tb-form" novalidate aria-labelledby="tb-t-analyse">';
    if (etat.reprise) h += '<div class="tb-reprise" role="note">Vous modifiez l\'analyse déjà enregistrée ' + esc(p.de) + '. L\'enregistrer la remplace. <button type="button" class="btn btn-secondaire" data-act="annuler-reprise">Annuler la modification</button></div>';
    h += '<div><h3 class="tb-h3" id="tb-t-prio" tabindex="-1">Écarts prioritaires (un à trois)</h3>';
    if (!etat.prio.length) h += '<p class="vide-bloc">Aucun écart prioritaire retenu. Dans les tableaux, ouvrez la vue de l\'agence ou d\'un conseiller et choisissez « Retenir comme prioritaire » sur un écart significatif. Il n\'y a pas de bonne réponse unique : c\'est la justification qui compte.</p>';
    else h += '<div class="tb-grp">' + etat.prio.map(prioHtml).join("") + "</div>";
    h += '</div><div><h3 class="tb-h3" id="tb-t-suivre" tabindex="-1">Écarts à suivre par anticipation</h3>' + suivreHtml() + "</div>";
    h += '<div class="champ tb-champ"><label for="tb-synthese">Synthèse pour la directrice d\'agence *</label><textarea id="tb-synthese" rows="6" maxlength="900"' + (erreur("synthese") ? ' aria-invalid="true" aria-describedby="tb-aide-syn tb-compteur tb-err"' : ' aria-describedby="tb-aide-syn tb-compteur"') + ">" + esc(etat.synthese) + "</textarea>" +
      '<span class="aide-champ" id="tb-aide-syn">Trois idées : ce qui s\'écarte des objectifs, pourquoi (en quelques mots), ce que vous proposez. Hélène Delorme la lira sans avoir ouvert le tableau : donnez au moins un chiffre.</span><span class="tb-compteur" id="tb-compteur">' + esc(compteurS(etat.synthese)) + "</span></div>";
    h += '<div id="tb-verif" class="tb-verif" tabindex="-1" aria-live="polite">' + verifHtml() + "</div>";
    h += '<div class="msg-erreur" id="tb-err" role="alert">' + (etat.err ? (etat.err.length > 1 ? "<ul>" + etat.err.map(function (e) { return "<li>" + esc(e.msg) + "</li>"; }).join("") + "</ul>" : esc(etat.err[0].msg)) : "") + "</div>";
    h += '<div class="tb-btns"><button type="button" class="btn btn-secondaire" data-act="verifier">Vérifier la cohérence de mes choix</button><button type="submit" class="btn btn-principal">' + (etat.reprise ? "Enregistrer l'analyse modifiée" : "Enregistrer l'analyse") + "</button></div></form>";
    return h;
  }
  function analyseHtml(p) {
    return '<section class="bloc tb-analyse" id="tb-zone" aria-labelledby="tb-t-analyse"><div class="bloc-tete"><h2 id="tb-t-analyse" tabindex="-1">Votre analyse ' + esc(p.de) + '</h2><span class="sous">À remettre à la directrice d\'agence</span></div>' +
      '<p class="tb-aide">Pour chaque écart prioritaire : les causes probables, une justification qui s\'appuie sur un chiffre, des actions correctives et une échéance. Puis les écarts à suivre et la synthèse.</p>' + formHtml(p) + "</section>";
  }

  /* ---------- analyse enregistrée ---------- */
  function fiche(x) {
    var l = T.ligne(x.scope, x.ind);
    return '<li class="tb-fiche"><h4 class="tb-h4">' + esc(nomL(l)) + '</h4><dl class="regul-donnees"><div><dt>Résultat</dt><dd>' + T.fmt(x.ind, l.v.reel) + " pour un objectif de " + T.fmt(x.ind, l.v.obj) + " (" + T.fmtEcart(x.ind, l.v) + ", soit " + pc(l.s.defav * 100) + " d'écart défavorable)</dd></div>" +
      "<div><dt>Causes probables</dt><dd>" + x.causes.map(function (c) { return esc(cause(c).lib); }).join(" ; ") + "</dd></div>" +
      "<div><dt>Justification</dt><dd>" + esc(x.justification) + "</dd></div>" +
      "<div><dt>Actions correctives</dt><dd>" + x.actions.map(function (a) { return esc(action(a).lib); }).join(" ; ") + "</dd></div>" +
      "<div><dt>Échéance</dt><dd>" + esc(dateLongue(x.echeance)) + "</dd></div></dl></li>";
  }
  function recap(a, p) {
    var h = '<section class="bloc tb-ok" id="tb-ok" aria-labelledby="tb-t-ok"><div class="bloc-tete"><h2 id="tb-t-ok" tabindex="-1">' + ICO.check + "Analyse " + esc(p.de) + ' enregistrée</h2><span class="sous">Le ' + esc(dateLongue(a.date)) + " à " + esc(a.heure.replace(":", " h ")) + (a.par ? " par " + esc(a.par) : "") + "</span></div>" +
      '<p class="tb-ok-txt">L\'analyse est enregistrée dans le poste. Elle n\'est transmise à personne : la synthèse est à remettre à la directrice d\'agence.</p>';
    h += '<h3 class="tb-h3">Écarts prioritaires</h3><ul class="tb-fiches">' + a.prioritaires.map(fiche).join("") + "</ul>";
    h += '<h3 class="tb-h3">Écarts à suivre par anticipation</h3>';
    if (!a.asuivre.length) h += '<p class="vide-bloc">Aucun écart noté à suivre.</p>';
    else h += '<ul class="tb-suivre">' + a.asuivre.map(function (c) { var r = T.lire(c), l = r ? T.ligne(r.scope, r.ind) : null; return l ? "<li><span><strong>" + esc(nomL(l)) + "</strong> : " + T.fmt(l.ind, l.v.reel) + " pour un objectif de " + T.fmt(l.ind, l.v.obj) + "</span></li>" : ""; }).join("") + "</ul>";
    h += '<h3 class="tb-h3">Synthèse pour la directrice</h3><blockquote class="tb-synth"><p>' + esc(a.synthese) + "</p></blockquote>";
    if (a.points && a.points.length) h += '<div class="tb-ctl"><p class="tb-ctl-t">' + ICO.info + "Points d'attention (" + a.points.length + ")</p><ul>" + a.points.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div>";
    var hrefs = []; a.prioritaires.forEach(function (x) { x.actions.forEach(function (id) { var ac = action(id); if (ac && ac.href && hrefs.indexOf(ac.href) < 0) hrefs.push(ac.href); }); });
    if (hrefs.length) h += '<h3 class="tb-h3">Pour passer à l\'action</h3><div class="tb-liens">' + hrefs.map(function (u) { return '<a class="btn btn-secondaire tb-lien" href="' + u + '">' + esc(OUTILS[u]) + "</a>"; }).join("") + "</div>";
    if (etat.conf) h += '<div class="tb-conf" id="tb-conf" tabindex="-1" role="group" aria-labelledby="tb-conf-t"><p id="tb-conf-t"><strong>Supprimer l\'analyse ' + esc(p.de) + " ?</strong> Les écarts, les causes, les actions et la synthèse enregistrés seront effacés.</p>" +
      '<div class="tb-btns"><button type="button" class="btn btn-principal" data-act="supprimer-ok">Supprimer l\'analyse</button><button type="button" class="btn btn-secondaire" data-act="supprimer-non">Annuler</button></div></div>';
    else h += '<div class="tb-btns"><button type="button" class="btn btn-secondaire" data-act="reprendre">Reprendre l\'analyse</button><button type="button" class="btn btn-secondaire" data-act="supprimer">Supprimer l\'analyse</button></div>';
    return h + "</section>";
  }

  /* ---------- définitions, règles, sources ---------- */
  function definitions() {
    var h = '<section class="bloc" aria-labelledby="tb-t-def"><div class="bloc-tete"><h2 id="tb-t-def">Les dix indicateurs</h2><span class="sous">Définition, calcul et sens de lecture</span></div><details class="tb-regle"><summary>Voir les définitions</summary><dl class="tb-defs">';
    T.INDICATEURS.forEach(function (i) {
      h += "<div><dt>" + esc(i.lib) + " – " + (i.famille === "quantitatif" ? "indicateur quantitatif" : "indicateur qualitatif") + "</dt><dd>" + esc(i.def) + "</dd>" +
        (i.type === "taux" ? '<dd class="tb-d-sous">Calcul : ' + esc(minus(i.num)) + " ÷ " + esc(minus(i.den)) + ".</dd>" : "") +
        '<dd class="tb-d-sens">' + (i.sens === "hausse" ? "Plus le résultat est élevé, mieux c'est." : "Plus le résultat est bas, mieux c'est : un résultat supérieur à l'objectif est un écart défavorable.") + "</dd></div>";
    });
    return h + "</dl></details></section>";
  }
  var REGLES = [
    ["Comment un écart est qualifié (convention de GS)", "Un écart défavorable d'au moins 10 % de l'objectif est significatif. De 5 % à moins de 10 %, il est à suivre seulement si le résultat est plus défavorable que le mois précédent. Un résultat meilleur que l'objectif d'au moins 10 % est favorable. Le reste est conforme. Ces seuils sont une convention de l'exercice : aucun texte ne les fixe, et chaque établissement a les siens."],
    ["Comment lire un taux pour l'agence", "Pour l'agence, un taux se calcule en additionnant les numérateurs de tous les conseillers, puis les dénominateurs, et en divisant l'un par l'autre. Faire la moyenne des taux des conseillers donnerait un faux résultat dès que les portefeuilles ou les nombres d'appels diffèrent. L'objectif de l'agence est la moyenne des objectifs des conseillers, pondérée de la même façon."],
    ["Les causes probables à examiner", "Le référentiel du BTS Banque demande de clarifier les causes d'un écart : potentiel du fonds de commerce, potentiel du portefeuille, résultats liés à l'activité du conseiller, besoin de formation du conseiller, conjoncture économique (par exemple une baisse des octrois de crédit immobilier). L'absence d'un conseiller et les procédures ou l'offre de la banque (tarification, délais) ont été ajoutées par GS parce qu'elles expliquent des écarts de l'exercice."],
    ["Ce que l'on attend de l'analyse", "Au plus trois écarts prioritaires, ceux qui demandent une action corrective. Pour chacun : au moins une cause probable, une justification appuyée sur un chiffre, au moins une action et une échéance de 90 jours au plus. Puis les écarts non significatifs à suivre par anticipation, en raison d'une dégradation possible, et une synthèse pour la directrice. Aucune combinaison n'est la seule bonne : la cohérence entre cause, chiffre et action est ce qui est vérifié."]
  ];
  function regles() {
    return '<section class="bloc" aria-labelledby="tb-t-regles"><div class="bloc-tete"><h2 id="tb-t-regles">Les règles de l\'exercice</h2><span class="sous">Référentiel du BTS Banque, tâche A2.1 T1</span></div>' +
      REGLES.map(function (r) { return '<details class="tb-regle"><summary>' + esc(r[0]) + "</summary><p>" + esc(r[1]) + "</p></details>"; }).join("") + "</section>";
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
  function aller(focus) {
    if (!focus) return;
    var n = document.getElementById(focus); if (!n) return;
    try { n.focus(); } catch (e) { /* ignoré */ }
    if (/^tb-t-|^tb-ok|^tb-conf/.test(focus) && n.scrollIntoView) n.scrollIntoView({ block: "start" });
  }
  function render(focus) {
    var p = per(), a = T.analyse(st(), p.cle);
    document.title = "GS Banque & Assurance – Tableau de bord de l'agence";
    app.innerHTML = '<nav class="fil-ariane" aria-label="Fil d\'Ariane"><a href="index.html">' + ICO.retour + 'Accueil</a></nav>' +
      '<div class="page-titre"><h1>Tableau de bord de l\'agence</h1><p>Chaque mois, la directrice attend des conseillers une lecture critique des résultats : où sont les écarts avec les objectifs, lesquels comptent, pourquoi, et ce que l\'on fait. Voici les résultats ' + esc(p.de) + " de l'agence de Paris et de ses cinq conseillers.</p></div>" +
      deroule() + vue(p) + resultats(p) + (a && !etat.reprise ? recap(a, p) : analyseHtml(p)) + definitions() + regles() +
      '<p class="tb-rappel">Sources : référentiel et guide d\'accompagnement pédagogique du BTS Banque (tâche A2.1 T1, « Analyse d\'un tableau de bord commercial ») pour les indicateurs, les écarts, les causes et les écarts à suivre ; OpenClassrooms, cours « Découvrez comment la banque fonctionne », pour la définition du produit net bancaire (marge d\'intermédiation et commissions nettes), source pédagogique et non réglementaire. Les seuils de 10 % et de 5 %, la durée de 90 jours, la durée de douze mois des clients distanciés et les objectifs sont des conventions de GS Banque &amp; Assurance, inventées pour l\'exercice, tout comme les résultats, les effectifs et les contextes des conseillers.</p>';
    typo(app); aller(focus);
  }
  /* Met à jour seulement la partie « analyse » (garde le défilement et les tableaux). */
  function majZone(focus) {
    var z = document.getElementById("tb-zone"); if (!z || T.analyse(st(), per().cle) && !etat.reprise) { render(focus); return; }
    var tmp = document.createElement("div"); tmp.innerHTML = analyseHtml(per()); z.innerHTML = tmp.firstChild.innerHTML; typo(z); aller(focus);
  }

  /* ---------- saisie ---------- */
  function coches(nom) { return Array.prototype.filter.call(document.querySelectorAll('input[name="' + nom + '"]'), function (i) { return i.checked; }).map(function (i) { return i.value; }); }
  function lire() {
    if (!document.getElementById("tb-form")) return;
    etat.prio.forEach(function (x, n) {
      var id = "tb-p" + n, j = document.getElementById(id + "-j"), e = document.getElementById(id + "-e");
      x.causes = coches(id + "-c"); x.actions = coches(id + "-a");
      if (j) x.justification = j.value; if (e) x.echeance = e.value;
    });
    var s = document.getElementById("tb-synthese"); if (s) etat.synthese = s.value;
  }
  function saisie() { return { prioritaires: etat.prio.map(function (x) { return { scope: x.scope, ind: x.ind, causes: x.causes.slice(), justification: x.justification, actions: x.actions.slice(), echeance: x.echeance }; }), asuivre: etat.suivre.slice(), synthese: etat.synthese }; }
  function neuf(c) { var r = T.lire(c); return { cle: c, scope: r.scope, ind: r.ind, causes: [], justification: "", actions: [], echeance: "" }; }
  function vider() { etat.prio = []; etat.suivre = []; etat.synthese = ""; etat.err = null; etat.verif = null; etat.msg = ""; etat.reprise = false; etat.conf = false; }
  var CIBLE = {
    analyse: function () { return "tb-err"; }, prio: function () { return "tb-t-prio"; }, asuivre: function () { return "tb-t-suivre"; }, synthese: function () { return "tb-synthese"; },
    ciblePrio: function (c) {
      var m = /^prio-(\d+)(?:-(causes|justif|actions|echeance))?$/.exec(c); if (!m) return "tb-err";
      var id = "tb-p" + m[1];
      return m[2] === "causes" ? id + "-c-" + T.CAUSES[0].id : m[2] === "justif" ? id + "-j" : m[2] === "actions" ? id + "-a-" + T.ACTIONS[0].id : m[2] === "echeance" ? id + "-e" : id + "-t";
    }
  };
  function enregistrer() {
    lire();
    var p = per(), r = T.valider(st(), saisie(), { remplacer: etat.reprise });
    if (!r.ok) {
      etat.err = r.erreurs; etat.verif = null;
      var c = r.erreurs[0].champ, id = /^prio-/.test(c) ? CIBLE.ciblePrio(c) : (CIBLE[c] || CIBLE.analyse)();
      majZone(document.getElementById(id) ? id : "tb-err"); return;
    }
    B.store.sauver(); vider();
    annonce("Analyse " + p.de + " enregistrée.");
    render("tb-t-ok");
  }
  function verifier() {
    lire();
    var l = etat.prio.map(function (x) { return { scope: x.scope, ind: x.ind, causes: x.causes, actions: x.actions }; });
    etat.err = null; etat.verif = l.length ? { points: T.coherence(l) } : { vide: true };
    majZone("tb-verif");
  }
  function basculerPrio(c) {
    lire(); var r = rangPrio(c), l = T.ligne(T.lire(c).scope, T.lire(c).ind);
    etat.err = null; etat.verif = null; etat.msg = "";
    if (r >= 0) { etat.prio.splice(r, 1); annonce("Écart retiré des écarts prioritaires : " + nomL(l) + "."); }
    else if (etat.prio.length >= SEUILS.prioMax) { etat.msg = "Vous avez déjà retenu " + SEUILS.prioMax + " écarts prioritaires : retirez-en un avant d'en choisir un autre. Choisir, c'est hiérarchiser."; }
    else { etat.prio.push(neuf(c)); annonce("Écart retenu comme prioritaire : " + nomL(l) + ". Complétez-le dans la partie « Votre analyse »."); }
    render("tb-b-" + l.scope + "-" + l.ind);
  }
  function basculerSuivre(c) {
    lire(); var i = etat.suivre.indexOf(c), l = T.ligne(T.lire(c).scope, T.lire(c).ind);
    etat.err = null; etat.verif = null; etat.msg = "";
    if (i >= 0) { etat.suivre.splice(i, 1); annonce("Écart retiré des écarts à suivre : " + nomL(l) + "."); } else { etat.suivre.push(c); annonce("Écart noté à suivre : " + nomL(l) + "."); }
    render("tb-b-" + l.scope + "-" + l.ind);
  }

  app.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-act]") : null; if (!b) return;
    var act = b.getAttribute("data-act"), c = b.getAttribute("data-cle"), a;
    if (act === "vue") { lire(); etat.scope = b.getAttribute("data-s"); etat.msg = ""; render("tb-v-" + etat.scope); }
    else if (act === "prio") basculerPrio(c);
    else if (act === "suivre") basculerSuivre(c);
    else if (act === "retirer-prio") { lire(); var r = rangPrio(c); if (r >= 0) etat.prio.splice(r, 1); etat.err = null; etat.verif = null; etat.msg = ""; render("tb-t-prio"); }
    else if (act === "retirer-suivre") { lire(); var k = etat.suivre.indexOf(c); if (k >= 0) etat.suivre.splice(k, 1); etat.err = null; etat.msg = ""; render("tb-t-suivre"); }
    else if (act === "verifier") verifier();
    else if (act === "reprendre") {
      a = T.analyse(st(), per().cle); if (!a) return; vider();
      etat.prio = a.prioritaires.map(function (x) { return { cle: x.cle, scope: x.scope, ind: x.ind, causes: x.causes.slice(), justification: x.justification, actions: x.actions.slice(), echeance: x.echeance }; });
      etat.suivre = a.asuivre.slice(); etat.synthese = a.synthese; etat.reprise = true; render("tb-t-analyse");
    }
    else if (act === "annuler-reprise") { vider(); render("tb-t-ok"); }
    else if (act === "supprimer") { etat.conf = true; render("tb-conf"); }
    else if (act === "supprimer-non") { etat.conf = false; render(); var bs = document.querySelector('[data-act="supprimer"]'); if (bs) bs.focus(); }
    else if (act === "supprimer-ok") { var rr = T.remettre(st(), per().cle); if (rr.ok) B.store.sauver(); vider(); annonce("Analyse supprimée."); render("tb-t-analyse"); }
  });
  app.addEventListener("submit", function (e) { if (e.target.id === "tb-form") { e.preventDefault(); enregistrer(); } });
  function invalider() { if (etat.verif) { etat.verif = null; var z = document.getElementById("tb-verif"); if (z) z.innerHTML = ""; } }
  app.addEventListener("change", function (e) { var t = e.target; if (t.closest && t.closest("#tb-form")) { lire(); invalider(); } });
  app.addEventListener("input", function (e) {
    var t = e.target, m = /^tb-p(\d+)-j$/.exec(t.id || "");
    if (m) { var c = document.getElementById("tb-p" + m[1] + "-jc"); if (c) c.textContent = compteurJ(t.value); invalider(); }
    else if (t.id === "tb-synthese") { var s = document.getElementById("tb-compteur"); if (s) s.textContent = compteurS(t.value); invalider(); }
  });

  RECH.init(SG.clients, document.getElementById("rech"), document.getElementById("rech-res"), document.getElementById("rech-statut"));
  render();
})();
