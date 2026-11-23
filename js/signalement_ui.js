/* GS Banque & Assurance – fiche de signalement à la cellule TRACFIN : écran de saisie, dans l'onglet « Contact et décision » des mouvements atypiques (atypiques.html).
   Les règles sont dans js/signalement.js ; cette page-ci affiche la fiche, lit la saisie et montre ce qu'il reste à compléter. */
(function () {
  "use strict";

  var S = window.SGBF.signalement;

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  /* Typographie française : espace insécable avant « : ; ! ? % € » », dans les nombres et après « «  ». */
  function tp(s) { return String(s).replace(/ +([:;!?%€»])/g, " $1").replace(/(\d) (?=\d{3}(?!\d))/g, "$1 ").replace(/« +/g, "« "); }
  function t(s) { return esc(tp(s)); }
  function pl(n, s, p) { return n + " " + (n > 1 ? p : s); }

  function radios(nom, liste, val, off) {
    return '<div class="sg-radios">' + liste.map(function (x) {
      return '<label class="sg-choix' + (val === x.v ? " est-actif" : "") + '"><input type="radio" name="sg-' + nom + '" id="sg-' + nom + "-" + x.v + '" value="' + x.v + '" data-sg="' + nom + '"' + (val === x.v ? " checked" : "") + (off ? " disabled" : "") +
        '><span><strong>' + t(x.lib) + '</strong><span class="sg-sous">' + t(x.aide) + "</span></span></label>";
    }).join("") + "</div>";
  }
  function fait(lib, val) { return val ? "<div><dt>" + t(lib) + "</dt><dd>" + t(val) + "</dd></div>" : ""; }
  function liste(l) { return "<ul>" + l.map(function (x) { return "<li>" + t(x) + "</li>"; }).join("") + "</ul>"; }

  /* Ce qui est repris du dossier, sans rien à saisir. */
  function faitsHtml(f) {
    return '<dl class="sg-faits">' + fait("Signalé par", f.declarant) + fait("Date du signalement", f.date) + fait("Client", f.client) + fait("Situation", f.situation) + fait("Compte", f.compte) +
      fait("Relation d'affaires", f.relation) + fait("Patrimoine connu", f.patrimoine) +
      (f.pieces.length ? "<div><dt>Justificatifs demandés</dt><dd>" + liste(f.pieces) + "</dd></div>" : "") +
      (f.recues.length ? "<div><dt>Pièces reçues</dt><dd>" + liste(f.recues) + "</dd></div>" : "") +
      (f.echange.length ? "<div><dt>Échange avec le client</dt><dd>" + liste(f.echange) + "</dd></div>" : "") +
      (f.cosi.length ? "<div><dt>" + t("Espèces au-delà de 10 000 € dans le mois") + "</dt><dd>" + liste(f.cosi) + '<p class="sg-note">' + t("La communication systématique d'informations (COSI) est automatique : elle n'est pas une déclaration de soupçon.") + "</p></dd></div>" : "") +
      "</dl>";
  }
  function opsHtml(d, c, off) {
    var tous = S.lignes(d, d.operations.map(function (o) { return o.id; }), c.now);
    return '<fieldset class="sg-fs" id="sg-ops"><legend>Opérations signalées *</legend><div class="sg-ops">' + tous.map(function (r) {
      var coche = c.saisie.ops.indexOf(r.id) >= 0;
      return '<label class="sg-choix sg-op' + (coche ? " est-actif" : "") + '"><input type="checkbox" id="sg-op-' + esc(r.id) + '" data-sg="op" data-op="' + esc(r.id) + '"' + (coche ? " checked" : "") + (off ? " disabled" : "") + '><span><strong>' +
        t(r.dateTxt + " – " + r.lib + " : " + S.eur(r.montant)) + '</strong><span class="sg-sous">' + t(r.libelle + (r.detail ? " (" + r.detail + ")" : "") + " – " + (r.sens === "credit" ? "crédit" : "débit")) + "</span></span></label>";
    }).join("") + '</div><p class="sg-total" id="sg-total">' + totalTexte(c) + "</p></fieldset>";
  }
  function totalTexte(c) {
    var x = c.totaux;
    if (!x.n) return t("Aucune opération cochée.");
    return t(pl(x.n, "opération signalée", "opérations signalées") + ", du " + x.debut + " au " + x.fin + " : " + S.eur(x.total) + " au total (crédits " + S.eur(x.credits) + ", débits " + S.eur(x.debits) + ").");
  }

  /* Résultat affiché sous la fiche : ce qu'il reste à compléter, ou la fiche complète ; puis les points d'attention. */
  function resultatHtml(c) {
    var h = c.ok ? '<p class="sg-ok"><span class="chip chip-ok">Fiche complète</span> Toutes les mentions obligatoires figurent dans la fiche.</p>'
      : '<p class="sg-att-t"><span class="chip chip-warn">À compléter</span> ' + t(pl(c.erreurs.length, "mention manque", "mentions manquent") + " :") + "</p><ul class=\"sg-manque\">" +
        c.erreurs.map(function (e) { return "<li>" + t(e.msg) + "</li>"; }).join("") + "</ul>";
    if (c.points.length) h += '<p class="sg-pts-t"><strong>Points d\'attention</strong> (ils ne bloquent pas la validation)</p><ul class="sg-pts">' + c.points.map(function (x) { return "<li>" + t(x) + "</li>"; }).join("") + "</ul>";
    return h;
  }
  function reglesHtml() {
    return tp('<details class="sg-regles"><summary>Règles et sources</summary><ul>' +
      "<li><strong>Qui déclare.</strong> L'établissement désigne un déclarant et un correspondant TRACFIN. La déclaration est écrite, établie au moyen d'un formulaire (article R. 561-31 I) et transmise, de préférence, par la plateforme ERMES de TRACFIN.</li>" +
      "<li><strong>Mentions obligatoires</strong> (III de l'article R. 561-31) : profession et coordonnées du déclarant ; cas de déclaration ; identité du client et, le cas échéant, du bénéficiaire effectif, avec l'objet et la nature de la relation d'affaires ; descriptif de l'opération et éléments d'analyse ; délai d'exécution si l'opération n'est pas encore réalisée. Si une mention manque, la déclaration est irrecevable : elle est sans valeur au regard de l'article L. 561-15 et le déclarant perd l'exonération de responsabilité de l'article L. 561-22.</li>" +
      "<li><strong>Cas de déclaration.</strong> Cas I (article L. 561-15 I) : sommes ou opérations dont l'organisme sait, soupçonne ou a de bonnes raisons de soupçonner qu'elles proviennent d'une infraction passible d'une peine privative de liberté supérieure à un an, ou qu'elles participent au financement du terrorisme. Cas II (article L. 561-15 II) : fraude fiscale, quand au moins un critère fixé par décret est présent (article D. 561-32-1).</li>" +
      "<li><strong>Quand déclarer.</strong> Sans délai, dès que le soupçon est formé après analyse (article L. 561-16). En principe la déclaration précède l'exécution ; une opération déjà exécutée se déclare sans délai si l'on ne pouvait pas surseoir, si le report aurait nui aux investigations ou si le soupçon est apparu après l'opération.</li>" +
      "<li><strong>Éléments d'analyse.</strong> La déclaration expose les faits qui motivent le soupçon. Il n'est pas nécessaire de qualifier l'infraction. Le seul montant ou le seul comportement du client ne suffit pas à fonder une déclaration.</li>" +
      "<li><strong>Pièces.</strong> La déclaration est accompagnée de toute pièce utile à son exploitation (IV de l'article R. 561-31). Une attestation sur l'honneur seule ne justifie pas l'origine des fonds.</li>" +
      "<li><strong>Confidentialité.</strong> Il est interdit de révéler au client ou à un tiers l'existence ou le contenu de la déclaration (article L. 561-18) ; la violation est sanctionnée par l'article L. 574-1.</li>" +
      "<li><strong>Conventions de l'exercice</strong> (elles ne viennent d'aucun texte) : la fiche interne n'a pas de forme légale, ses rubriques reprennent les mentions de la déclaration ; toutes les opérations d'un dossier sont déjà inscrites au compte, donc exécutées ; aucun dossier de l'outil ne relève de la fraude fiscale ; les précisions libres comptent au moins " + S.TEXTE_MIN + " caractères.</li>" +
      "<li><strong>Sources.</strong> Lignes directrices conjointes ACPR–Tracfin (édition de 2018, et édition du 22 janvier 2025 pour les cas I et II et l'analyse des faits), consultées le 17 novembre 2026. Ces lignes directrices sont explicatives : les numéros d'articles sont à revérifier sur Légifrance, qui n'a pas pu être consulté.</li></ul></details>");
  }

  function interieur(d, s, ctx) {
    var c = S.controle(d, s, ctx), f = S.faits(d, ctx), x = c.saisie, off = !!ctx.valide;
    var h = '<h3 class="sg-titre" id="sg-t">Fiche de signalement à la cellule TRACFIN</h3>' +
      '<p class="sg-intro">' + t("Vous ne transmettez pas vous-même la déclaration à TRACFIN : vous signalez le dossier à la cellule de l'établissement, qui décide et déclare. Une déclaration à laquelle il manque une mention obligatoire est irrecevable : la fiche réunit ces mentions. Le client n'en est pas informé.") + "</p>" +
      '<h4 class="sg-h">Repris du dossier</h4>' + faitsHtml(f) + '<h4 class="sg-h">À renseigner</h4>' + opsHtml(d, c, off) +
      '<div class="champ sg-champ"><label for="sg-cas">Cas de déclaration *</label><select id="sg-cas" data-sg="cas" aria-describedby="sg-cas-aide"' + (off ? " disabled" : "") + '><option value="">' + t("Choisir le cas de déclaration") + "</option>" +
      S.CAS.map(function (o) { return '<option value="' + o.v + '"' + (x.cas === o.v ? " selected" : "") + ">" + t(o.lib) + "</option>"; }).join("") + '</select><span class="aide-champ" id="sg-cas-aide">' +
      t((S.CAS.filter(function (o) { return o.v === x.cas; })[0] || { aide: "Le cas I est le cas général ; le cas II est réservé à la fraude fiscale." }).aide) + "</span></div>";
    if (x.cas === "II") h += '<div class="champ sg-champ"><label for="sg-critere">' + t("Critère retenu (liste de l'article D. 561-32-1) *") + '</label><input type="text" id="sg-critere" data-sg="critere" maxlength="200" autocomplete="off" value="' + esc(x.critere) + '"' + (off ? " disabled" : "") + "></div>";
    h += '<fieldset class="sg-fs" id="sg-exec"><legend>' + t("Exécution des opérations signalées *") + "</legend>" + radios("exec", S.EXECUTION, x.exec, off) + "</fieldset>" +
      '<fieldset class="sg-fs" id="sg-benef"><legend>' + t("Bénéficiaire effectif *") + "</legend>" + radios("benef", S.BENEF, x.benef, off) + "</fieldset>";
    if (x.benef === "tiers") h += '<div class="champ sg-champ"><label for="sg-tiers">' + t("Ce que le client a dit du tiers *") + '</label><input type="text" id="sg-tiers" data-sg="tiers" maxlength="200" autocomplete="off" value="' + esc(x.tiers) + '"' + (off ? " disabled" : "") + "></div>";
    h += '<p class="sg-analyse"><strong>' + t("Éléments d'analyse :") + "</strong> " + t("repris de votre commentaire, plus bas dans cette page. Exposez les faits qui motivent le soupçon : montants, dates, écart avec le profil du client, explications reçues, pièces manquantes.") + "</p>" +
      '<label class="sg-choix sg-nondiv' + (x.nondiv ? " est-actif" : "") + '"><input type="checkbox" id="sg-nondiv" data-sg="nondiv"' + (x.nondiv ? " checked" : "") + (off ? " disabled" : "") + "><span><strong>" +
      t("Le client n'est pas informé de ce signalement et ne le sera pas, ni lui ni un tiers (article L. 561-18) *") + "</strong></span></label>" +
      '<div class="sg-res" id="sg-res" role="status" aria-live="polite">' + resultatHtml(c) + "</div>" + reglesHtml();
    return h;
  }
  function html(d, s, ctx) { return '<section class="sg" id="sg" aria-labelledby="sg-t">' + interieur(d, s, ctx) + "</section>"; }
  /* Redessine toute la fiche (quand le cas, l'exécution ou le bénéficiaire change) ; le focus revient sur le champ modifié. */
  function redessiner(d, s, ctx, focusId) {
    var z = document.getElementById("sg"); if (!z) return;
    z.innerHTML = interieur(d, s, ctx);
    var f = focusId && document.getElementById(focusId); if (f) f.focus();
  }
  /* Met à jour seulement le résultat et le total (frappe, case cochée, commentaire modifié), sans toucher aux champs. */
  function maj(d, s, ctx) {
    var c = S.controle(d, s, ctx);
    var r = document.getElementById("sg-res"); if (r) r.innerHTML = resultatHtml(c);
    var tt = document.getElementById("sg-total"); if (tt) tt.innerHTML = totalTexte(c);
    Array.prototype.forEach.call(document.querySelectorAll("#sg .sg-choix"), function (l) { var i = l.querySelector("input"); if (i) l.classList.toggle("est-actif", i.checked); });
  }

  /* Range dans s la valeur que le champ t vient de recevoir ; renvoie "choix" s'il faut redessiner la fiche, "texte" sinon, "" si t n'est pas un champ de la fiche. */
  function saisir(s, el) {
    if (!el || !el.hasAttribute || !el.hasAttribute("data-sg")) return "";
    var cle = el.getAttribute("data-sg"), v = el.value;
    if (cle === "cas") { s.cas = v; if (v !== "II") s.critere = ""; return "choix"; }
    if (cle === "exec") { s.exec = v; return "choix"; }
    if (cle === "benef") { s.benef = v; if (v !== "tiers") s.tiers = ""; return "choix"; }
    if (cle === "critere") { s.critere = v; return "texte"; }
    if (cle === "tiers") { s.tiers = v; return "texte"; }
    if (cle === "nondiv") { s.nondiv = !!el.checked; return "texte"; }
    if (cle === "op") {
      var id = el.getAttribute("data-op"), i = (s.ops = s.ops || []).indexOf(id);
      if (el.checked && i < 0) s.ops.push(id);
      if (!el.checked && i >= 0) s.ops.splice(i, 1);
      return "texte";
    }
    return "";
  }

  window.SGBF = window.SGBF || {};
  window.SGBF.signalementUI = { html: html, redessiner: redessiner, maj: maj, saisir: saisir, resultatHtml: resultatHtml };
})();
