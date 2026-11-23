/* GS Banque & Assurance – questionnaire de santé : écran de saisie, commun à la souscription d'une assurance (catalogue.html) et au montage de prêt (montage.html).
   Les questions et la règle sont dans js/sante.js ; cette page-ci ne fait que les afficher et lire les réponses. Les réponses restent dans la mémoire de la page :
   elles ne sont jamais enregistrées (secret médical), seule la décision l'est. */
(function () {
  "use strict";

  var B = window.SGBF.banque, S = window.SGBF.sante, esc = B.esc;
  var CHIP = { accepte: "chip-ok", etude: "chip-warn", refus: "chip-bad" };

  function radio(pre, q, v, val, lib, lecture) {
    return '<label class="sq-opt"><input type="radio" name="' + esc(pre + "-" + q.id) + '" value="' + val + '" data-sq="' + esc(q.id) + '"' + (v === val ? " checked" : "") + (lecture ? " disabled" : "") + "><span>" + esc(lib) + "</span></label>";
  }
  function question(pre, q, rep, n, lecture) {
    var id = pre + "-" + q.id, aide = q.aide ? '<span class="aide-champ" id="' + esc(id) + '-aide">' + esc(q.aide) + "</span>" : "", desc = q.aide ? ' aria-describedby="' + esc(id) + '-aide"' : "";
    if (q.type === "mesure") {
      var m = rep.mesure || {};
      return '<li class="sq-q"><div class="sq-qf sq-mesure" role="group" aria-labelledby="' + esc(id) + '-l"' + desc + '><span class="sq-l" id="' + esc(id) + '-l">' + n + ". " + esc(q.lib) + " *</span>" +
        '<div class="sq-mes"><label for="' + esc(id) + '-taille">Taille (cm)</label><input id="' + esc(id) + '-taille" inputmode="numeric" autocomplete="off" maxlength="3" data-sq="mesure" data-sqf="taille" value="' + esc(m.taille || "") + '"' + (lecture ? " disabled" : "") + ">" +
        '<label for="' + esc(id) + '-poids">Poids (kg)</label><input id="' + esc(id) + '-poids" inputmode="numeric" autocomplete="off" maxlength="3" data-sq="mesure" data-sqf="poids" value="' + esc(m.poids || "") + '"' + (lecture ? " disabled" : "") + "></div>" + aide + "</div></li>";
    }
    var v = rep[q.id], opts = q.type === "oubli"
      ? radio(pre, q, v, "non", "Non", lecture) + radio(pre, q, v, "plus5", "Oui, protocole de soins terminé depuis plus de " + S.AERAS.oubliAns + " ans, sans rechute", lecture) + radio(pre, q, v, "moins5", "Oui, en cours ou terminé depuis " + S.AERAS.oubliAns + " ans ou moins, ou rechute", lecture)
      : radio(pre, q, v, "oui", "Oui", lecture) + radio(pre, q, v, "non", "Non", lecture);
    return '<li class="sq-q"><fieldset class="sq-qf' + (q.type === "oubli" ? "" : " sq-on") + '"' + desc + '><legend>' + n + ". " + esc(q.lib) + ' *</legend><div class="sq-opts">' + opts + "</div>" + aide + "</fieldset></li>";
  }

  /* Résultat affiché sous le questionnaire. o : { motifs: true pour lister les réponses qui ont déclenché l'étude, ctx: contexte de la règle }. */
  function resultatHtml(code, rep, o) {
    o = o || {};
    var ev = S.evaluer(code, rep, o.ctx), n = S.questionnaire(code).questions.length;
    if (!ev.complet) {
      var m = ev.manquantes.length, err = ev.erreurs.mesure ? '<span class="sq-err">' + esc(ev.erreurs.mesure) + "</span> " : "";
      return '<p class="sq-att">' + err + (m === n ? "Répondez aux " + n + " questions : la décision s'affiche quand toutes les réponses sont saisies." : (m === 1 ? "1 question sans réponse" : m + " questions sans réponse") + ".") + "</p>";
    }
    var ph = S.phrase(code, ev.verdict), h = '<p class="sq-verdict"><span class="chip ' + CHIP[ev.verdict] + '">' + esc(S.libelle(ev.verdict)) + "</span> <span>" + esc(ph.charAt(0).toUpperCase() + ph.slice(1)) + "</span></p>";
    if (o.motifs) {
      if (ev.imc !== null) h += '<p class="sq-imc">Indice de masse corporelle : ' + esc(String(ev.imc).replace(".", ",")) + ".</p>";
      if (ev.motifs.length) h += '<ul class="sq-motifs">' + ev.motifs.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>";
    }
    return h;
  }
  function maj(pre, code, rep, o) { var z = document.getElementById(pre + "-res"); if (z) z.innerHTML = resultatHtml(code, rep, o); }

  /* Le questionnaire complet : titre, rappel de la loi, secret médical, questions et résultat. o : { note: texte sur le secret médical, motifs, ctx, lecture }. */
  function html(pre, code, rep, o) {
    o = o || {};
    var qn = S.questionnaire(code); if (!qn) return "";
    return '<section class="sq" id="' + esc(pre) + '" aria-labelledby="' + esc(pre) + '-t"><h3 class="sq-titre" id="' + esc(pre) + '-t" tabindex="-1">' + esc(qn.titre) + "</h3>" +
      '<p class="sq-intro">' + esc(qn.intro) + "</p>" +
      '<p class="sq-note"><strong>Avant de répondre.</strong> ' + esc(S.RAPPEL) + " " + esc(o.note || S.CONFIDENTIEL) + "</p>" +
      '<ol class="sq-liste">' + qn.questions.map(function (q, i) { return question(pre, q, rep, i + 1, o.lecture); }).join("") + "</ol>" +
      '<div class="sq-res" id="' + esc(pre) + '-res" role="status" aria-live="polite">' + resultatHtml(code, rep, o) + "</div></section>";
  }

  /* Range dans rep la réponse que le champ t vient de recevoir ; renvoie false si t n'est pas un champ du questionnaire. */
  function saisir(rep, t) {
    if (!t || !t.hasAttribute || !t.hasAttribute("data-sq")) return false;
    var id = t.getAttribute("data-sq"), f = t.getAttribute("data-sqf");
    if (id === "mesure") { rep.mesure = rep.mesure || {}; rep.mesure[f] = t.value; }
    else if (t.type === "radio") { if (t.checked) rep[id] = t.value; }
    return true;
  }
  /* Le questionnaire auquel appartient le champ t (préfixe de ses identifiants), ou "". */
  function prefixe(t) { var s = t.closest ? t.closest(".sq") : null; return s ? s.id : ""; }

  window.SGBF = window.SGBF || {};
  window.SGBF.santeUI = { html: html, resultatHtml: resultatHtml, maj: maj, saisir: saisir, prefixe: prefixe };
})();
