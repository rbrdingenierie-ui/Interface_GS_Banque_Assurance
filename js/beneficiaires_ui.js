/* GS Banque & Assurance – clause bénéficiaire : écran de saisie, dans la souscription d'une assurance-vie, de GS Décès ou de GS Obsèques (catalogue.html).
   Les règles et la rédaction de la clause sont dans js/beneficiaires.js ; cette page-ci affiche les choix, lit la saisie et montre la clause rédigée. */
(function () {
  "use strict";

  var B = window.SGBF.banque, BF = window.SGBF.beneficiaires, esc = B.esc;

  /* Typographie française : espace insécable avant « : ; ! ? % € » », dans les nombres et après « «  ». */
  function tp(s) { return String(s).replace(/ +([:;!?%€»])/g, "\u00a0$1").replace(/(\d) (?=\d{3}(?!\d))/g, "$1\u00a0").replace(/« +/g, "«\u00a0"); }
  function t(s) { return esc(tp(s)); }
  function option(v, lib, sel) { return '<option value="' + esc(v) + '"' + (sel === v ? " selected" : "") + ">" + t(lib) + "</option>"; }
  function aideDe(liste, v) { var x = liste.filter(function (y) { return y.v === v; })[0]; return x && x.aide ? x.aide : ""; }
  function champTexte(id, cle, lib, val, o) {
    o = o || {};
    return '<div class="champ"><label for="' + id + '">' + t(lib) + ' *</label><input id="' + id + '" data-bf="' + cle + '" ' + (o.date ? 'type="date" max="' + esc(B.ymd(B.aujourdhui())) + '" min="1900-01-01"' : 'type="text" autocomplete="off" maxlength="' + (o.max || 40) + '"') + ' value="' + esc(val || "") + '"></div>';
  }
  /* Les champs d'identification d'une personne désignée (rang n = 1 ou 2), ou le nom de l'entreprise de pompes funèbres. */
  function personneHtml(n, type, p) {
    p = p || {};
    if (type === "pompes") return '<div class="bf-pers" id="bf-z' + n + '">' + champTexte("bf-" + n + "-raison", "p" + n + ".raison", "Nom de l'entreprise de pompes funèbres", p.raison, { max: 60 }) + "</div>";
    if (type !== "nomme") return '<div class="bf-pers" id="bf-z' + n + '"></div>';
    return '<div class="bf-pers" id="bf-z' + n + '"><fieldset class="bf-ident"><legend>Identité de la personne désignée</legend><div class="bf-grille">' +
      champTexte("bf-" + n + "-nom", "p" + n + ".nom", "Nom", p.nom) + champTexte("bf-" + n + "-prenom", "p" + n + ".prenom", "Prénom", p.prenom) +
      champTexte("bf-" + n + "-naissance", "p" + n + ".naissance", "Date de naissance", p.naissance, { date: true }) + champTexte("bf-" + n + "-lieu", "p" + n + ".lieu", "Lieu de naissance (commune ou pays)", p.lieu, { max: 60 }) +
      "</div></fieldset></div>";
  }
  function selectHtml(id, cle, lib, liste, val, vide, requis) {
    return '<div class="champ"><label for="' + id + '">' + t(lib) + (requis ? " *" : "") + '</label><select id="' + id + '" data-bf="' + cle + '" aria-describedby="' + id + '-aide">' +
      '<option value="">' + t(vide) + "</option>" + liste.map(function (x) { return option(x.v, x.lib, val); }).join("") + '</select><span class="aide-champ" id="' + id + '-aide">' + t(aideDe(liste, val)) + "</span></div>";
  }

  /* Résultat affiché sous la saisie : la clause rédigée et ses points d'attention, ou ce qu'il reste à faire. */
  function resultatHtml(pid, c, s) {
    var a = BF.apercu(pid, c, s);
    if (!a.ok) return '<p class="bf-att">' + t(s && s.r1 ? a.erreur : "Choisissez le bénéficiaire : la clause se rédige ensuite d'elle-même.") + "</p>";
    return '<p class="bf-ok"><span class="chip chip-ok">Clause rédigée</span></p><blockquote class="bf-clause">' + t(a.texte) + "</blockquote>" +
      '<p class="bf-pts-t"><strong>À dire au client</strong></p><ul class="bf-pts">' + a.points.map(function (x) { return "<li>" + esc(tp(x)) + "</li>"; }).join("") + "</ul>";
  }
  function intro(pid) {
    return pid === "OBSQ" ? "Le capital est versé au bénéficiaire désigné : un proche, identifié par ses nom, prénom, date et lieu de naissance, ou l'entreprise de pompes funèbres choisie. À défaut, ce sont les héritiers du client."
      : "Le capital est versé au décès du client à la personne qu'il désigne. Une clause précise évite les litiges : l'outil la rédige d'après le dossier et ajoute toujours, en dernier rang, les héritiers.";
  }
  function interieur(pid, c, s) {
    var l1 = BF.choix(pid, c, 1), l2 = BF.choix(pid, c, 2), h = "";
    h += '<h3 class="bf-titre" id="bf-t">Clause bénéficiaire</h3><p class="bf-intro">' + t(intro(pid)) + "</p>";
    h += selectHtml("bf-r1", "r1", pid === "OBSQ" ? "Bénéficiaire du capital" : "Bénéficiaire de premier rang", l1, s.r1, "Choisir un bénéficiaire", true) + personneHtml(1, s.r1, s.p1);
    if (pid !== "OBSQ" && s.r1 !== "heritiers") {
      h += selectHtml("bf-r2", "r2", "À défaut : bénéficiaire de second rang", l2.filter(function (x) { return x.v !== s.r1 && x.v !== "pompes"; }), s.r2, "Aucun autre bénéficiaire : à défaut, les héritiers", false) + personneHtml(2, s.r2, s.p2);
    }
    return h + '<div class="bf-res" id="bf-res" role="status" aria-live="polite">' + resultatHtml(pid, c, s) + "</div>";
  }
  function html(pid, c, s) { return '<section class="bf" id="bf" aria-labelledby="bf-t">' + interieur(pid, c, s) + "</section>"; }
  /* Redessine toute la clause (quand un bénéficiaire change) ; le focus revient sur le champ modifié. */
  function redessiner(pid, c, s, focusId) {
    var z = document.getElementById("bf"); if (!z) return;
    z.innerHTML = interieur(pid, c, s);
    var f = focusId && document.getElementById(focusId); if (f) f.focus();
  }
  function maj(pid, c, s) { var z = document.getElementById("bf-res"); if (z) z.innerHTML = resultatHtml(pid, c, s); }

  /* Range dans s la valeur que le champ t vient de recevoir ; renvoie "choix" si un bénéficiaire a changé (il faut redessiner), "texte" si une saisie a changé, "" si t n'est pas un champ de la clause. */
  function saisir(s, t) {
    if (!t || !t.hasAttribute || !t.hasAttribute("data-bf")) return "";
    var cle = t.getAttribute("data-bf"), v = t.value;
    if (cle === "r1" || cle === "r2") {
      s[cle] = v;
      if (cle === "r1" && s.r2 === v) s.r2 = "";       /* le même bénéficiaire ne peut pas figurer aux deux rangs */
      if (cle === "r1" && v === "heritiers") { s.r2 = ""; s.p2 = {}; }
      return "choix";
    }
    var m = /^p([12])\.(\w+)$/.exec(cle); if (!m) return "";
    s["p" + m[1]] = s["p" + m[1]] || {}; s["p" + m[1]][m[2]] = v;
    return "texte";
  }

  window.SGBF = window.SGBF || {};
  window.SGBF.beneficiairesUI = { html: html, redessiner: redessiner, maj: maj, saisir: saisir, resultatHtml: resultatHtml };
})();
