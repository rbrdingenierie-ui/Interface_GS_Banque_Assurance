/* GS Banque & Assurance – fiche d'entretien client : affichage et saisie (modèle et calculs dans entretien.js, mise à jour du dossier dans dossier.js).
   La même fiche est montée à deux endroits : l'onglet « Entretien » de la fiche client 360° (client.html) et le volet « Fiche d'entretien » de la page
   « Compte Rendu d'Entretien (CRE) » (contacts.html). Les saisies sont enregistrées au fur et à mesure dans le navigateur ; un client = une fiche.
   Utilisation : html(c, options) renvoie la fiche d'un client ; lier(racine, options) branche les événements une seule fois sur un élément qui ne change pas. */
(function () {
  "use strict";

  var SG = window.SGBF, B = SG.banque, EN = SG.entretien, DO = SG.dossier, MI = SG.mifid, S = SG.synthese, ICO = SG.icones, IMP = SG.impression, CL = SG.clients;
  var esc = B.esc, fmtDate = B.fmtDate;
  var CLIENT = {}; CL.forEach(function (c) { CLIENT[c.id] = c; });
  var ui = { msg: null, confirmer: null, erreur: null, mif: {}, appui: false, attente: null };   /* msg : { cid, cible, texte, ok } ; confirmer : id du client dont on efface la fiche */
  var minuterie = null;

  function store() { return B.store.charger(); }
  function sauverTard() { clearTimeout(minuterie); minuterie = setTimeout(function () { minuterie = null; B.store.sauver(); }, 300); }
  function sauverVite() { clearTimeout(minuterie); minuterie = null; B.store.sauver(); }
  window.addEventListener("pagehide", sauverVite);
  function nomComplet(c) { return c.civ + " " + c.prenom + " " + c.nom.toUpperCase(); }
  function pl(n, s, p) { return n + " " + (n > 1 ? p : s); }
  function virgule(x) { return String(x).replace(".", ","); }

  /* Abréviations de la fiche, expliquées au survol et pour les lecteurs d'écran. */
  var ABBR = [
    [/\bRP\b/g, '<abbr title="résidence principale">RP</abbr>'], [/\bRL\b/g, '<abbr title="résidence locative">RL</abbr>'], [/\bRS\b/g, '<abbr title="résidence secondaire">RS</abbr>'],
    [/\bMIF\b/g, '<abbr title="directive européenne sur les marchés d\'instruments financiers : questionnaire sur les connaissances et l\'expérience du client">MIF</abbr>']
  ];
  function qtxt(t) { var h = esc(t); ABBR.forEach(function (a) { h = h.replace(a[0], a[1]); }); return h; }

  /* ---------- structure ---------- */
  function section(id, corps, classe) {
    var et = EN.ETAPES.filter(function (x) { return x.id === id; })[0];
    return '<section class="bloc en-etape' + (classe ? " " + classe : "") + '" aria-labelledby="en-h-' + id + '"><h2 class="en-etape-titre" id="en-h-' + id + '"><span class="en-num" aria-hidden="true">' + et.n + '</span><span class="sr">Étape ' + et.n + " : </span><span><strong>" + et.lettre + "</strong>" + esc(et.reste) + "</span></h2>" + corps + "</section>";
  }
  function zoneNotes(k, e, aide) {
    return '<div class="champ en-notes"><label for="en-n-' + k + '">' + esc(EN.NOTES[k]) + '</label><textarea id="en-n-' + k + '" data-en-note="' + k + '" rows="4" maxlength="' + EN.MAX_TXT + '"' + (aide ? ' aria-describedby="en-a-' + k + '"' : "") + ">" + esc(e.notes[k] || "") + "</textarea>" + (aide ? '<p class="aide-champ" id="en-a-' + k + '">' + esc(aide) + "</p>" : "") + "</div>";
  }

  /* ---------- étape 1 : ce que la banque sait déjà ---------- */
  function etape1(c, st, opt) {
    var g = EN.donneesConnues(c, st);
    return section("prep", '<p class="en-intro">Exploitation des données et des informations détenues : relisez le dossier avant de recevoir le client.</p><div class="en-grille-info">' + g.map(function (x) {
      return '<section class="en-info" aria-labelledby="en-i-' + x.id + '"><h3 id="en-i-' + x.id + '">' + esc(x.titre) + "</h3><ul>" + x.lignes.map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ul></section>";
    }).join("") + "</div>" + (opt.lienFiche ? '<p class="mention"><a class="btn-texte" href="client.html?id=' + c.id + '">Ouvrir la fiche client 360°</a></p>' : ""));
  }

  /* ---------- étape 2 : accueil ---------- */
  function etape2(st) {
    var nom = st.eleve && st.eleve.nom ? st.eleve.nom : "";
    return section("accueil", '<div class="champ en-nom"><label for="en-nom">Votre nom (repris dans la phrase de présentation)</label><input id="en-nom" maxlength="60" autocomplete="name" value="' + esc(nom) + '"></div>' +
      '<div class="en-script"><p>Bonjour, je me présente, je suis <strong id="en-nom-txt">' + esc(nom || "(votre nom)") + "</strong>, votre conseiller. Tout d'abord, voici ma carte de visite : dessus vous avez ma ligne directe et mon adresse mail, je réponds sous 48 heures.</p>" +
      "<p>J'ai 25 minutes à vous consacrer, est-ce que cela vous convient ? Lors de notre entretien, je vais être amené à vous poser des questions sur votre situation personnelle, professionnelle et patrimoniale ainsi qu'à prendre des notes, cela vous convient-il ?</p>" +
      "<p>Avant de commencer, avez-vous des questions que vous souhaitez aborder ?</p></div>" +
      '<p class="en-consigne"><strong>Sujet négatif :</strong> le traiter tout de suite. <strong>Sujet positif :</strong> indiquer au client que l\'on reviendra dessus durant l\'entretien.</p>');
  }

  /* ---------- étape 3 : découverte ---------- */
  function coche(cle, texte, e) {
    return '<label class="en-coche"><input type="checkbox" id="en-q-' + cle + '" data-en-coche="' + cle + '"' + (e.coches[cle] ? " checked" : "") + "><span>" + qtxt(texte) + "</span></label>";
  }
  /* Zone de la grille : coordonnées, adresse, famille, profession (informations du dossier, préremplies) ou renseignement recueilli. */
  function champGrille(f, c, vals) {
    var id = "en-m-" + f.k, v = vals[f.k] == null ? "" : vals[f.k], a = ' data-en-g="' + f.k + '" aria-describedby="en-err-g-' + f.k + '"';
    var lib = esc(f.lib) + (f.aide ? ' <span class="aide-champ">(' + esc(f.aide) + ")</span>" : ""), h;
    if (f.si && f.si.contrats && !EN.visible(f, vals, c)) return "";
    var si = f.si && !f.si.contrats ? ' data-en-si="' + f.si.k + ":" + f.si.v.join(",") + '"' + (EN.visible(f, vals, c) ? "" : " hidden") : "";
    if (f.type === "sel") h = '<select id="' + id + '"' + a + ">" + (EN.options(f.k, c) || []).map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === v ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select>";
    else if (f.type === "area") h = '<textarea id="' + id + '"' + a + ' rows="3" maxlength="' + f.max + '">' + esc(v) + "</textarea>";
    else h = '<input id="' + id + '"' + a + ' type="' + (f.type === "tel" ? "tel" : f.type === "mail" ? "email" : "text") + '" autocomplete="off"' + (f.max ? ' maxlength="' + f.max + '"' : "") + (f.mode ? ' inputmode="' + f.mode + '"' : f.type === "num" ? ' inputmode="decimal"' : "") + ' value="' + esc(v) + '">';
    return '<div class="champ en-g' + (f.large ? " en-g-large" : "") + '"' + si + '><label for="' + id + '">' + lib + "</label>" + h + '<p class="msg-erreur" id="en-err-g-' + f.k + '"></p></div>';
  }
  function champsHtml(l, c, vals) {
    var simples = l.filter(function (f) { return f.groupe !== "conj"; }).map(function (f) { return champGrille(f, c, vals); }).join(""), conj = l.filter(function (f) { return f.groupe === "conj"; });
    var cj = conj.length ? '<div class="en-conjoint" id="en-conjoint" data-en-si="' + conj[0].si.k + ":" + conj[0].si.v.join(",") + '"' + (EN.visible(conj[0], vals, c) ? "" : " hidden") + '><p class="aide-champ">Conjoint, partenaire de PACS ou concubin : à renseigner si le client vit en couple.</p><div class="en-champs">' + conj.map(function (f) { return champGrille(f, c, vals); }).join("") + "</div></div>" : "";
    return '<div class="en-champs">' + simples + "</div>" + cj;
  }
  function questions(b, e, c, vals) {
    return '<ul class="en-questions">' + b.questions.map(function (q, i) {
      var qk = b.id + "-" + i, ch = EN.champsDe(qk), zone = ch.length ? '<div class="en-reponses">' + champsHtml(ch, c, vals) + "</div>" : "", cls = ch.length ? "en-q en-q-grille" : "en-q";
      if (q.sous) return '<li class="' + cls + '"><span class="en-q-t">' + qtxt(q.t) + '</span><ul class="en-sous">' + q.sous.map(function (s, j) { return "<li>" + coche(qk + "-" + j, s, e) + "</li>"; }).join("") + "</ul>" + zone + "</li>";
      return '<li class="' + cls + '">' + coche(qk, q.t, e) + zone + "</li>";
    }).join("") + "</ul>";
  }
  function ligneMontant(l, v) {
    var k = l.k, brut = v.saisi[k] ? (v.brut[k] || "") : (v.val[k] != null ? virgule(v.val[k]) : "");
    var banque = !v.saisi[k] && v.val[k] != null;
    return '<div class="champ en-montant"><label for="en-v-' + k + '">' + esc(l.lib) + '</label><div class="en-saisie"><input id="en-v-' + k + '" data-en-val="' + k + '" inputmode="decimal" autocomplete="off" value="' + esc(brut) + '" aria-describedby="en-err-v-' + k + '"><span aria-hidden="true">€</span></div>' +
      '<p class="en-src" id="en-src-' + k + '">' + (banque ? "Donnée de la banque, à confirmer" : "") + '</p><p class="msg-erreur" id="en-err-v-' + k + '"></p></div>';
  }
  function resultats(r, depensesSaisies) {
    var h = '<div><dt>Ressources mensuelles</dt><dd>' + B.eur2(r.ressources) + "</dd></div><div><dt>Charges mensuelles</dt><dd>" + B.eur2(r.charges) + "</dd></div>";
    if (r.taux == null) return h + '<div class="large"><dt>Taux d\'endettement et capacité d\'emprunt</dt><dd>Indiquez les ressources du foyer pour les calculer.</dd></div>';
    h += '<div><dt>Taux d\'endettement (charges ÷ ressources × 100)</dt><dd>' + B.pct(r.taux) + ' <span class="puce ' + (r.depasse ? "puce-bad" : "puce-ok") + '">' + (r.depasse ? "Au-dessus de " + EN.TAUX_REF + " %" : "Dans la limite de " + EN.TAUX_REF + " %") + "</span></dd></div>";
    h += "<div><dt>Capacité d'emprunt (ressources × " + EN.TAUX_REF + " % − prêts − loyer)</dt><dd>" + B.eur2(r.capaciteEmprunt) + " par mois" + (r.capaciteBrute < 0 ? ' <span class="puce puce-bad">Aucune capacité</span>' : "") + "</dd></div>";
    h += "<div><dt>Capacité d'épargne (ressources − charges − dépenses courantes)</dt><dd>" + (r.capaciteEpargne == null ? "à calculer : indiquez les dépenses courantes" : B.eur2(r.capaciteEpargne) + " par mois") + "</dd></div>";
    return h;
  }
  function calculette(c, e) {
    var v = EN.valeurs(c, e), r = EN.calculs(v.val);
    v.brut = e.val;
    function groupe(g, lib) { return '<fieldset class="en-groupe"><legend>' + lib + "</legend>" + EN.LIGNES.filter(function (l) { return l.g === g; }).map(function (l) { return ligneMontant(l, v); }).join("") + "</fieldset>"; }
    return '<section class="en-bloc en-calc en-sous-bloc" aria-labelledby="en-calc-t"><h3 id="en-calc-t">Calculer la situation financière (montants mensuels)</h3>' +
      '<p class="aide-champ">Les montants proposés sont ceux de la banque (revenus du foyer, loyer, crédits en cours) : confirmez-les ou corrigez-les avec le client.</p>' +
      '<div class="en-calc-cols">' + groupe("r", "Ressources") + groupe("c", "Charges") + groupe("d", "Pour la capacité d'épargne") + "</div>" +
      '<dl class="en-resultats" id="en-res" aria-labelledby="en-calc-t">' + resultats(r) + '</dl><p class="sr" id="en-res-annonce" role="status"></p>' +
      '<p class="mention">Règle de la fiche : un taux d\'endettement d\'au plus ' + EN.TAUX_REF + " % des ressources. Pour un crédit immobilier, l'outil « Montage de prêt » applique la limite du HCSF (35 %, assurance comprise).</p>" +
      '<p><button type="button" class="btn-texte" data-act="en-defaut">Reprendre les données de la banque</button></p>' +
      '<p class="mention">Pensez aussi au questionnaire <abbr title="directive européenne sur les marchés d\'instruments financiers : questionnaire sur les connaissances et l\'expérience du client">MIF</abbr> avant de proposer un placement.</p></section>';
  }
  function formProjet() {
    return '<form class="en-projet formulaire" data-en-form="projet" novalidate><h4>Ajouter un projet au dossier du client</h4><div class="en-projet-champs">' +
      '<div class="champ"><label for="en-pj-quoi">Quoi ? *</label><input id="en-pj-quoi" maxlength="120" autocomplete="off" placeholder="Exemple : achat immobilier"></div>' +
      '<div class="champ"><label for="en-pj-ou">Où ?</label><input id="en-pj-ou" maxlength="80" autocomplete="off" placeholder="Exemple : Paris 15e"></div>' +
      '<div class="champ"><label for="en-pj-quand">Quand ?</label><input id="en-pj-quand" maxlength="60" autocomplete="off" placeholder="Exemple : dans 6 mois"></div>' +
      '<div class="champ"><label for="en-pj-comment">Comment ?</label><input id="en-pj-comment" maxlength="100" autocomplete="off" placeholder="Exemple : prêt et apport"></div></div>' +
      '<p class="msg-erreur" id="en-err-projet" role="alert"></p><div><button type="submit" class="btn btn-secondaire">Ajouter le projet au dossier</button></div></form>';
  }
  function etape3(c, e) {
    var vals = EN.valeursGrille(c, store());
    var blocs = EN.BLOCS.map(function (b) {
      var h = '<section class="en-bloc en-bloc-' + b.id + '" aria-labelledby="en-h-b-' + b.id + '"><h3 id="en-h-b-' + b.id + '">' + esc(b.lib) + "</h3>" + questions(b, e, c, vals);
      if (b.id === "fin") h += calculette(c, e) + mifidBloc(c, store());
      if (b.id === "projets") h += formProjet();
      return h + zoneNotes(b.id, e) + "</section>";
    }).join("");
    return section("decouverte", '<p class="en-intro">Posez les questions et remplissez la grille : les zones sont préremplies avec le dossier du client, corrigez ce qui a changé. Rien n\'est enregistré dans le dossier avant la validation de l\'entretien, en bas de la fiche.</p><div class="en-grille-decouverte">' + blocs + "</div>" +
      '<section class="en-bloc en-rebond" aria-labelledby="en-h-b-rebond"><h3 id="en-h-b-rebond">Rebond commercial</h3>' + zoneNotes("rebond", e, "Autre que le sujet du rendez-vous, repéré pendant la découverte. Il pourra être noté comme rebond dans « Rédiger un CRE ».") + "</section>");
  }

  /* ---------- questionnaire MIFID : profil investisseur du client (revenus et patrimoine, connaissance et expérience) ----------
     Le profil enregistré ici est celui du dossier : il sert ensuite au questionnaire d'un produit boursier (page « Profil investisseur ») et au catalogue. Appétence au risque, finance durable et stratégie
     dépendent du contrat envisagé : elles se remplissent avec le produit, dans la page « Profil investisseur ». */
  function mifBrouillon(c) { return ui.mif[c.id] || (ui.mif[c.id] = {}); }
  function mifReponses(c, st) {
    var p = MI.profilClient(st, c), rep = {}, sg = MI.suggestions(c), br = mifBrouillon(c);
    MI.IDS_CLIENT.forEach(function (id) { rep[id] = br[id] !== undefined ? br[id] : (p && p.rep[id]) || ""; });
    if (!p && br.revenus === undefined) { rep.revenus = sg.revenus; rep.csp = sg.csp; }
    return { rep: rep, profil: p };
  }
  function mifQuestion(q, v) {
    var id = "en-mif-" + q.id;
    if (q.type === "vf") {
      return '<fieldset class="en-mif-q en-mif-vf"><legend>' + esc(q.texte) + ' *</legend><div class="en-mif-opts">' + q.options.map(function (o) {
        return '<label><input type="radio" name="' + id + '" data-en-mif="' + q.id + '" value="' + o.v + '"' + (v === o.v ? " checked" : "") + "> " + esc(o.t) + "</label>";
      }).join("") + "</div></fieldset>";
    }
    return '<div class="champ en-mif-q"><label for="' + id + '">' + esc(q.texte) + ' *</label><select id="' + id + '" data-en-mif="' + q.id + '"><option value="">Choisir</option>' + q.options.map(function (o) {
      return '<option value="' + o.v + '"' + (v === o.v ? " selected" : "") + ">" + esc(o.t) + "</option>";
    }).join("") + "</select></div>";
  }
  function mifNiveaux(rep) {
    var complet = MI.IDS_CLIENT.every(function (id) { return rep[id]; });
    if (!complet) return "";
    return '<dl class="en-mif-niv"><div><dt>Patrimoine</dt><dd>' + esc(MI.niveauPatrimoine(rep)) + "</dd></div><div><dt>Capacité à subir des pertes</dt><dd>" + esc(MI.capacitePertes(rep)) + "</dd></div><div><dt>Connaissance et expérience</dt><dd>" + esc(MI.niveauConnaissance(rep)) + " (" + MI.bonnesReponses(rep) + " bonnes réponses sur " + MI.questions("client").filter(function (q) { return q.type === "vf"; }).length + ")</dd></div></dl>";
  }
  function mifidBloc(c, st) {
    if (!MI) return "";
    var r = mifReponses(c, st), p = r.profil, auj = B.aujourdhui(), etat = MI.etatProfil(MI.profilStocke(st, c.id), auj), nomsFait = MI.profilStocke(st, c.id);
    var statut = nomsFait ? (etat.etat === "valable" ? '<span class="puce puce-ok">Profil à jour</span> enregistré le ' + esc(fmtDate(B.lireYmd(nomsFait.date))) + " (valable jusqu'au " + esc(fmtDate(etat.fin)) + ")" : '<span class="puce puce-warn">Profil à renouveler</span> enregistré le ' + esc(fmtDate(B.lireYmd(nomsFait.date))) + " : plus de 12 mois")
      : p ? '<span class="puce puce-ok">Profil reconstitué d\'après le dossier</span> (questionnaire rempli à l\'ouverture de son contrat le ' + esc(fmtDate(B.lireYmd(p.date))) + ") : à confirmer avec le client" : '<span class="puce puce-warn">Aucun profil</span> : questionnaire à remplir avant tout produit boursier';
    var qs = MI.SECTIONS.filter(function (x) { return x.portee === "client"; }).map(function (sec) {
      return '<fieldset class="en-mif-sec"><legend>' + esc(sec.titre) + "</legend>" + MI.questions("client").filter(function (q) { return q.s === sec.id; }).map(function (q) { return mifQuestion(q, r.rep[q.id]); }).join("") + "</fieldset>";
    }).join("");
    return '<section class="en-bloc en-mifid en-sous-bloc" id="en-mifid" aria-labelledby="en-mif-t"><h3 id="en-mif-t">Questionnaire profil investisseur (MIF)</h3>' +
      '<p class="aide-champ">Obligatoire avant de proposer un produit boursier (assurance-vie, PEA, PER, compte-titres…). Posez les questions au client, puis enregistrez : le profil est rangé dans son dossier, valable 12 mois, et le questionnaire d\'un produit boursier le reprend.</p>' +
      '<p class="en-mif-etat" role="status">' + statut + "</p>" +
      '<form class="formulaire en-form-mif" data-en-form="mifid" novalidate>' + qs + '<div class="en-mif-niveaux" id="en-mif-niveaux">' + mifNiveaux(r.rep) + "</div>" +
      '<p class="msg-erreur" id="en-err-mif" role="alert"></p><div class="en-boutons"><button type="submit" class="btn btn-secondaire">Enregistrer le profil investisseur dans le dossier</button></div></form>' +
      '<p class="en-liens"><a class="btn-texte" href="mifid.html?client=' + c.id + '">Questionnaire complet d\'un produit boursier (appétence au risque, finance durable, stratégie) et rapport de conseil</a></p></section>';
  }

  /* ---------- étapes 4 à 7 ---------- */
  function etapes4a7(c, e) {
    var lienRdv = '<a class="btn-texte" href="agenda.html">Prendre rendez-vous dans l\'agenda</a>', lienContact = '<a class="btn-texte" href="contacts.html?client=' + c.id + '&amp;volet=contact">Rédiger le CRE</a>';
    return section("accord", '<div class="en-script"><p><strong>Si j\'ai bien compris</strong>, (…) <strong>est-ce bien cela ?</strong></p></div>' + zoneNotes("accord", e)) +
      section("proposition", '<div class="en-script"><p>J\'ai une solution à vous proposer afin de répondre à vos besoins.</p></div>' + zoneNotes("proposition", e) + '<p><a class="btn-texte" href="catalogue.html?client=' + c.id + '">Consulter le catalogue de produits</a></p>') +
      section("argumentation", '<p class="en-consigne">Donner deux ou trois caractéristiques, puis donner des avantages.</p><div class="en-deux">' + zoneNotes("argu_car", e) + zoneNotes("argu_av", e) + "</div>") +
      section("conclusion", '<p class="en-consigne">Réconforter le client sur son choix et prendre rendez-vous.</p>' + zoneNotes("conclusion", e) + '<p class="en-liens">' + lienRdv + lienContact + "</p>");
  }

  /* ---------- mise à jour du dossier ---------- */
  function messageHtml(c) {
    var m = ui.msg && ui.msg.cid === c.id ? ui.msg : null;
    return '<p class="' + (m && !m.ok ? "msg-erreur" : "msg-ok") + '" id="en-ok" role="status" tabindex="-1">' + (m ? esc(m.texte) : "") + "</p>";
  }
  /* Aperçu de ce que la validation va enregistrer dans le dossier (mis à jour à chaque modification d'une zone de la grille). */
  function apercuHtml(c, st) {
    var a = EN.apercu(c, st), h = '<div class="en-apercu" id="en-apercu"><h3>Ce que la validation va enregistrer dans le dossier</h3>';
    if (a.changements.length) h += '<ul class="en-diff">' + a.changements.map(function (x) { return "<li><strong>" + esc(x.lib) + '</strong><span class="en-avant">' + esc(x.avant) + '</span><span class="en-fleche" aria-hidden="true">→</span><span class="sr"> devient </span><span class="en-apres">' + esc(x.apres) + "</span></li>"; }).join("") + "</ul>";
    else h += '<p class="en-rien">Aucune information du dossier ne change : coordonnées, adresse, famille, profession et revenu seront confirmés tels quels.</p>';
    if (a.erreurInfos) h += '<p class="msg-erreur">' + esc(a.erreurInfos.erreur) + "</p>";
    else if (a.infos.length) h += '<p class="en-infos-t">' + esc(pl(a.infos.length, "renseignement recueilli rejoint", "renseignements recueillis rejoignent")) + ' le dossier :</p><ul class="en-infos">' + a.infos.map(function (x) { return "<li><span>" + esc(EN.libCourt(EN.champDe(x.k))) + "</span> " + esc(x.val) + "</li>"; }).join("") + "</ul>";
    if (a.finances) h += '<p class="en-infos-t">La situation financière calculée (ressources, charges, taux d\'endettement, capacités d\'emprunt et d\'épargne) est enregistrée avec le dossier.</p>';
    return h + "</div>";
  }

  function etapeMaj(c, st, e) {
    var maj = DO.majLe(st, c.id), x = EN.entretienDe(st, c.id);
    return '<section class="bloc en-etape en-maj" aria-labelledby="en-h-maj"><h2 class="en-etape-titre" id="en-h-maj"><span>Valider l\'entretien : mettre à jour le dossier du client</span></h2>' +
      '<p class="en-intro">À la fin de l\'entretien, relisez l\'aperçu puis validez. Ce que vous avez corrigé dans la grille (coordonnées, adresse, famille, profession, revenu) met le dossier du client à jour, daté d\'aujourd\'hui : l\'alerte « Dossier à actualiser » disparaît. Les autres renseignements (loisirs, patrimoine, épargne chez des confrères, véhicule, situation financière) rejoignent son dossier et le résumé de l\'entretien s\'ajoute aux notes de rendez-vous. Les projets se versent au dossier depuis le bloc « Projets » et le profil investisseur depuis le questionnaire MIF.' + (maj ? " Dernière mise à jour par vous : le " + esc(fmtDate(B.lireYmd(maj))) + "." : "") + (x ? " Dernier entretien validé le " + esc(fmtDate(B.lireYmd(x.date))) + "." : "") + "</p>" +
      apercuHtml(c, st) +
      '<form class="formulaire en-form-maj" data-en-form="maj" novalidate>' +
      '<label class="en-note-coche" for="en-m-note"><input type="checkbox" id="en-m-note" checked> Ajouter le résumé de l\'entretien aux notes de rendez-vous du dossier</label>' +
      '<p class="msg-erreur" id="en-err-maj" role="alert"></p><div class="en-boutons"><button type="submit" class="btn btn-principal">Valider l\'entretien et mettre à jour le dossier</button></div></form>' +
      messageHtml(c) +
      '<p class="en-bas"><button type="button" class="btn-texte btn-impr" data-act="en-imprimer">' + ICO.imprimante + "<span>Imprimer la fiche d'entretien</span></button>" +
      (ui.confirmer === c.id ? '<span class="en-confirmer"><span>Effacer les notes et montants de cette fiche ?</span> <button type="button" class="btn-texte" data-act="en-effacer-oui">Confirmer l\'effacement</button> <button type="button" class="btn-texte" data-act="en-effacer-non">Garder</button></span>' : '<button type="button" class="btn-texte" data-act="en-effacer">Effacer les notes de la fiche</button>') + "</p>" +
      '<p class="mention">Les notes, montants et saisies de la grille sont enregistrés au fur et à mesure dans ce navigateur, sur cet ordinateur. Les informations de la banque (revenus domiciliés, contrats, mouvements) ne sont pas modifiées.</p></section>';
  }

  /* ---------- fiche complète ---------- */
  function tete(c, e) {
    var av = EN.avancement(e), kyc = c.kyc > S.KYC_MAX;
    return '<div class="en-tete"><div><p class="en-client"><strong>' + esc(nomComplet(c)) + "</strong> – " + c.age + " ans – " + esc(c.pro.prof) + '</p><p class="sous">Dossier mis à jour le ' + esc(fmtDate(B.dateJours(c.kyc))) + (kyc ? ' <span class="puce puce-warn">À actualiser</span>' : "") + "</p></div>" +
      '<p class="en-avancement" id="en-avancement" role="status">' + esc(pl(av.abordees, "question abordée", "questions abordées")) + " sur " + av.total + ".</p></div>";
  }
  function inner(c, opt) {
    var st = store(), e = EN.lire(st, c.id);
    return tete(c, e) + etape1(c, st, opt || {}) + etape2(st) + etape3(c, e) + etapes4a7(c, e) + etapeMaj(c, st, e);
  }
  function html(c, opt) { return '<div class="en-zone" data-en-client="' + c.id + '">' + inner(c, opt) + "</div>"; }
  function rafraichir(zone, opt, focusId) {
    var c = CLIENT[zone.getAttribute("data-en-client")];
    if (!c) return;
    zone.innerHTML = inner(c, opt);
    if (focusId) { var el = document.getElementById(focusId); if (el) el.focus(); }
  }
  /* Choix du client (page « Contacts ») : liste déroulante des 680 clients. */
  function selecteur(cid) {
    var l = CL.slice().sort(function (a, b) { var x = a.nom + " " + a.prenom, y = b.nom + " " + b.prenom; return x < y ? -1 : x > y ? 1 : 0; });
    return '<div class="champ en-choix"><label for="en-client">Client reçu *</label><select id="en-client"><option value="">Choisir un client</option>' + l.map(function (c) {
      return '<option value="' + c.id + '"' + (String(cid) === String(c.id) ? " selected" : "") + ">" + esc(c.nom.toUpperCase() + " " + c.prenom + " – " + c.age + " ans") + "</option>";
    }).join("") + "</select></div>";
  }
  function videHtml() { return '<p class="vide-bloc">Choisissez un client pour ouvrir sa fiche d\'entretien : ce que la banque sait déjà de lui, les questions à poser et la mise à jour de son dossier.</p>'; }

  /* ---------- impression ---------- */
  function liste(l) { return l.length ? '<ul class="dp-liste">' + l.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : ""; }
  function docFiche(c) {
    var st = store(), e = EN.lire(st, c.id), v = EN.valeurs(c, e), r = EN.calculs(v.val), vg = EN.valeursGrille(c, st), corps = "";
    corps += '<p class="dp-texte"><strong>Client :</strong> ' + esc(nomComplet(c)) + " – " + c.age + " ans – " + esc(c.num) + (st.eleve && st.eleve.nom ? " &nbsp; <strong>Conseiller :</strong> " + esc(st.eleve.nom) : "") + "</p>";
    corps += '<section class="dp-bloc"><h2>1. Préparation : ce que la banque sait déjà</h2>' + EN.donneesConnues(c, st).map(function (x) { return '<p class="dp-texte"><strong>' + esc(x.titre) + " :</strong> " + esc(x.lignes.join(" ; ")) + "</p>"; }).join("") + "</section>";
    corps += '<section class="dp-bloc"><h2>3. Découverte</h2>';
    EN.BLOCS.forEach(function (b) {
      var ab = [];
      b.questions.forEach(function (q, i) {
        if (q.sous) q.sous.forEach(function (s, j) { if (e.coches[b.id + "-" + i + "-" + j]) ab.push(q.t.replace(/ :$/, "") + " – " + s); });
        else if (e.coches[b.id + "-" + i]) ab.push(q.t);
      });
      var rens = EN.ZONES.filter(function (z) { return z.bloc === b.id && EN.visible(z, vg, c) && String(vg[z.k] || "").trim() !== "" && z.groupe !== "conj"; }).map(function (z) { return EN.libCourt(z) + " : " + EN.affiche(z, vg[z.k], c).replace(/\n/g, " ; "); });
      corps += "<h3>" + esc(b.lib) + "</h3>" + (ab.length ? '<p class="dp-texte"><strong>Questions abordées :</strong></p>' + liste(ab) : "") + (rens.length ? '<p class="dp-texte"><strong>Renseignements de la grille :</strong></p>' + liste(rens) : "") + (e.notes[b.id] ? '<p class="dp-texte">' + esc(e.notes[b.id]).replace(/\n/g, "<br>") + "</p>" : "");
    });
    corps += "<h3>Situation financière (montants mensuels)</h3>" + liste(EN.LIGNES.filter(function (l) { return v.val[l.k] != null; }).map(function (l) { return l.lib + " : " + B.eur2(v.val[l.k]); }));
    if (r.taux != null) corps += '<dl class="dp-chiffres"><div><dt>Ressources</dt><dd>' + B.eur2(r.ressources) + "</dd></div><div><dt>Charges</dt><dd>" + B.eur2(r.charges) + "</dd></div><div><dt>Taux d'endettement</dt><dd>" + B.pct(r.taux) + "</dd></div><div><dt>Capacité d'emprunt</dt><dd>" + B.eur2(r.capaciteEmprunt) + "<small>par mois</small></dd></div></dl>";
    if (e.notes.rebond) corps += "<h3>Rebond commercial</h3><p class=\"dp-texte\">" + esc(e.notes.rebond).replace(/\n/g, "<br>") + "</p>";
    corps += "</section>";
    [["accord", "4. Accord de découverte", ["accord"]], ["proposition", "5. Proposition", ["proposition"]], ["argumentation", "6. Argumentation", ["argu_car", "argu_av"]], ["conclusion", "7. Conclusion", ["conclusion"]]].forEach(function (x) {
      var t = x[2].filter(function (k) { return e.notes[k]; });
      if (t.length) corps += '<section class="dp-bloc"><h2>' + esc(x[1]) + "</h2>" + t.map(function (k) { return '<p class="dp-texte"><strong>' + esc(EN.NOTES[k]) + " :</strong> " + esc(e.notes[k]).replace(/\n/g, "<br>") + "</p>"; }).join("") + "</section>";
    });
    corps += '<p class="dp-mention">Fiche d\'entretien établie à partir des saisies du conseiller et des données de la banque.</p>';
    IMP.imprimer(IMP.document({ titre: "Fiche d'entretien client", sous: nomComplet(c) + " – Agence de Paris", corps: corps }), IMP.nomFichier("Fiche_entretien_" + c.nom + "_" + c.prenom));
  }

  /* ---------- événements ---------- */
  function zoneDe(el) { return el.closest ? el.closest(".en-zone") : null; }
  function clientDe(el) { var z = zoneDe(el); return z ? CLIENT[z.getAttribute("data-en-client")] : null; }
  function majResultats(zone, c) {
    var e = EN.lire(store(), c.id), v = EN.valeurs(c, e), r = EN.calculs(v.val), z = zone.querySelector("#en-res");
    if (z) z.innerHTML = resultats(r);
    return r;
  }
  function majAvancement(zone, c) {
    var av = EN.avancement(EN.lire(store(), c.id)), z = zone.querySelector("#en-avancement");
    if (z) z.textContent = pl(av.abordees, "question abordée", "questions abordées") + " sur " + av.total + ".";
  }
  /* Zones qui dépendent d'une autre réponse (conjoint, régime matrimonial, bien, véhicule…) : affichées ou masquées. */
  function majSi(zone) {
    [].forEach.call(zone.querySelectorAll("[data-en-si]"), function (el) {
      var m = /^([A-Za-z]+):(.*)$/.exec(el.getAttribute("data-en-si")), src = m && document.getElementById("en-m-" + m[1]);
      if (src) el.hidden = m[2].split(",").indexOf(src.value) < 0;
    });
  }
  function majApercu(zone, c) {
    var a = zone.querySelector("#en-apercu"); if (!a) return;
    var d = document.createElement("div"); d.innerHTML = apercuHtml(c, store());
    a.replaceWith(d.firstChild);
  }
  /* Mise à jour de l'aperçu ; si un clic sur « Valider » est en cours, elle attend la fin du clic : l'aperçu changerait de hauteur et ferait glisser le bouton sous le doigt. */
  function apercuApres(zone, c) { if (ui.appui) ui.attente = { zone: zone, c: c }; else majApercu(zone, c); }
  function erreurChamp(id, msg) {
    var el = document.getElementById(id); if (!el) return;
    el.setAttribute("aria-invalid", msg ? "true" : "false");
  }

  function lier(racine, opt) {
    opt = opt || {};
    racine.addEventListener("input", function (e) {
      var t = e.target, c = clientDe(t), zone = zoneDe(t);
      if (t.id === "en-nom") { var st = store(); st.eleve.nom = t.value.replace(/[\u0000-\u001F]/g, "").slice(0, 60); sauverTard(); var s = document.getElementById("en-nom-txt"); if (s) s.textContent = st.eleve.nom.trim() || "(votre nom)"; return; }
      if (!c) return;
      if (t.hasAttribute("data-en-note")) { EN.ecrireNote(store(), c.id, t.getAttribute("data-en-note"), t.value); sauverTard(); }
      else if (t.hasAttribute("data-en-g")) {
        var kg = t.getAttribute("data-en-g"), eg = document.getElementById("en-err-g-" + kg);
        EN.ecrireGrille(store(), c.id, kg, t.value); sauverTard();
        if (eg && eg.textContent) { eg.textContent = ""; erreurChamp(t.id, ""); }
      }
      else if (t.hasAttribute("data-en-val")) {
        var k = t.getAttribute("data-en-val"), x = EN.nombre(t.value), src = document.getElementById("en-src-" + k);
        EN.ecrireValeur(store(), c.id, k, t.value); sauverTard();
        if (src) src.textContent = "";
        var er = document.getElementById("en-err-v-" + k); if (er && x === x) { er.textContent = ""; erreurChamp(t.id, ""); }
        majResultats(zone, c);
      }
    });
    racine.addEventListener("change", function (e) {
      var t = e.target, c = clientDe(t), zone = zoneDe(t);
      if (!c) return;
      if (t.hasAttribute("data-en-mif")) {
        mifBrouillon(c)[t.getAttribute("data-en-mif")] = t.value; t.removeAttribute("aria-invalid");
        var f2 = t.closest("form"), nv = document.getElementById("en-mif-niveaux");
        if (f2 && nv) { var rp = {}; MI.IDS_CLIENT.forEach(function (id) { var el = f2.querySelector('[data-en-mif="' + id + '"]'); if (el && el.type === "radio") { var ch = f2.querySelector('[data-en-mif="' + id + '"]:checked'); rp[id] = ch ? ch.value : ""; } else rp[id] = el ? el.value : ""; }); nv.innerHTML = mifNiveaux(rp); }
        return;
      }
      if (t.hasAttribute("data-en-g")) {
        EN.ecrireGrille(store(), c.id, t.getAttribute("data-en-g"), t.value); sauverVite(); majSi(zone);
        apercuApres(zone, c);
        return;
      }
      if (t.hasAttribute("data-en-coche")) { EN.cocher(store(), c.id, t.getAttribute("data-en-coche"), t.checked); sauverVite(); majAvancement(zone, c); }
      else if (t.hasAttribute("data-en-val")) {
        var k = t.getAttribute("data-en-val"), x = EN.nombre(t.value), er = document.getElementById("en-err-v-" + k);
        if (x !== x) { if (er) er.textContent = "Saisissez un montant en euros, par exemple 2 150,50 (1 000 000 € au plus)."; erreurChamp(t.id, "x"); }
        else { if (er) er.textContent = ""; erreurChamp(t.id, ""); }
        sauverVite(); apercuApres(zone, c);
        var r = majResultats(zone, c), a = document.getElementById("en-res-annonce");
        if (a) a.textContent = r.taux == null ? "" : "Taux d'endettement " + B.pct(r.taux) + ", capacité d'emprunt " + B.eur2(r.capaciteEmprunt) + " par mois.";
      }
      else if (t.id === "en-nom") sauverVite();
    });
    racine.addEventListener("pointerdown", function (e) { if (e.target.closest && e.target.closest(".en-form-maj")) ui.appui = true; });
    function finAppui() {
      if (!ui.appui) return;
      ui.appui = false;
      setTimeout(function () { var a = ui.attente; ui.attente = null; if (a && document.contains(a.zone)) majApercu(a.zone, a.c); }, 0);
    }
    document.addEventListener("pointerup", finAppui); document.addEventListener("pointercancel", finAppui);
    racine.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (!b) return;
      var act = b.getAttribute("data-act");
      if (act.indexOf("en-") !== 0) return;
      var c = clientDe(b), zone = zoneDe(b);
      if (!c) return;
      if (act === "en-imprimer") { sauverVite(); docFiche(c); }
      else if (act === "en-defaut") {
        var e0 = store().entretiens && store().entretiens[c.id]; if (e0) e0.val = {};
        sauverVite(); var y = window.scrollY; rafraichir(zone, opt, "en-v-salaire"); window.scrollTo(0, y);
        var a = document.getElementById("en-res-annonce"); if (a) a.textContent = "Montants de la banque repris.";
      }
      else if (act === "en-effacer") { sauverVite(); ui.confirmer = c.id; rafraichir(zone, opt); var oui = zone.querySelector('[data-act="en-effacer-oui"]'); if (oui) oui.focus(); }
      else if (act === "en-effacer-non") { ui.confirmer = null; rafraichir(zone, opt); var bt = zone.querySelector('[data-act="en-effacer"]'); if (bt) bt.focus(); }
      else if (act === "en-effacer-oui") {
        EN.effacer(store(), c.id); sauverVite(); ui.confirmer = null; ui.msg = { cid: c.id, ok: true, texte: "Notes et montants de la fiche effacés. Le dossier du client n'a pas été modifié." };
        rafraichir(zone, opt, "en-ok");
      }
    });
    racine.addEventListener("submit", function (e) {
      var f = e.target.closest("[data-en-form]");
      if (!f) return;
      e.preventDefault();
      var c = clientDe(f), zone = zoneDe(f), st = store();
      if (!c) return;
      if (f.getAttribute("data-en-form") === "projet") {
        var g = function (id) { return document.getElementById(id).value; }, er = document.getElementById("en-err-projet");
        var r = EN.ajouterProjet(st, c.id, { quoi: g("en-pj-quoi"), ou: g("en-pj-ou"), quand: g("en-pj-quand"), comment: g("en-pj-comment") });
        if (!r.ok) { er.textContent = r.erreur; var ch = document.getElementById("en-pj-" + r.champ); if (ch) { ch.setAttribute("aria-invalid", "true"); ch.focus(); } return; }
        sauverVite(); ui.msg = { cid: c.id, ok: true, texte: "Projet ajouté au dossier : « " + r.projet.lib + " ». Il figure dans « Projets connus » (onglet Notes et projets de la fiche client)." };
        rafraichir(zone, opt, "en-ok");
        if (opt.apresMaj) opt.apresMaj(c, "projet");
      }
      else if (f.getAttribute("data-en-form") === "mifid") {
        var rep = {}; MI.IDS_CLIENT.forEach(function (id) { var el = f.querySelector('[data-en-mif="' + id + '"]'); if (el && el.type === "radio") { var ch = f.querySelector('[data-en-mif="' + id + '"]:checked'); rep[id] = ch ? ch.value : ""; } else rep[id] = el ? el.value : ""; });
        var erM = document.getElementById("en-err-mif"), rM = MI.enregistrerProfil(st, c, rep);
        if (!rM.ok) { erM.textContent = rM.erreur; var chM = f.querySelector('[data-en-mif="' + rM.champ + '"]'); if (chM) { chM.setAttribute("aria-invalid", "true"); chM.focus(); } return; }
        sauverVite(); delete ui.mif[c.id];
        ui.msg = { cid: c.id, ok: true, texte: "Profil investisseur enregistré dans le dossier le " + fmtDate(B.lireYmd(rM.profil.date)) + " (valable 12 mois). Le questionnaire d'un produit boursier reprendra ces réponses." };
        rafraichir(zone, opt, "en-ok");
        if (opt.apresMaj) opt.apresMaj(c, "mifid");
      }
      else if (f.getAttribute("data-en-form") === "maj") {
        var er2 = document.getElementById("en-err-maj"), alerte = c.kyc > S.KYC_MAX, cur = EN.valeursGrille(c, st);
        /* les valeurs affichées dans la grille sont reportées (au cas où une zone aurait changé sans que l'événement de saisie ne soit passé) */
        [].forEach.call(zone.querySelectorAll("[data-en-g]"), function (el) {
          var k = el.getAttribute("data-en-g"), m = document.getElementById("en-err-g-" + k);
          if (el.value !== cur[k]) EN.ecrireGrille(st, c.id, k, el.value);
          erreurChamp(el.id, ""); if (m) m.textContent = "";
        });
        var res = EN.valider(st, c, { note: document.getElementById("en-m-note").checked });
        if (!res.ok) {
          er2.textContent = res.erreur; sauverVite();
          var ch2 = document.getElementById("en-m-" + res.champ), im = document.getElementById("en-err-g-" + res.champ);
          if (ch2) { ch2.setAttribute("aria-invalid", "true"); if (im) im.textContent = res.erreur; ch2.focus(); }
          return;
        }
        sauverVite();
        var t = ["Dossier mis à jour le " + fmtDate(B.lireYmd(res.date)) + "."];
        t.push(res.modifies.length ? "Modifié dans le dossier : " + res.modifies.join(", ") + "." : "Informations confirmées, sans changement.");
        if (res.infos) t.push(pl(res.infos, "renseignement recueilli versé", "renseignements recueillis versés") + " au dossier" + (res.finances ? ", avec la situation financière." : "."));
        else if (res.finances) t.push("Situation financière versée au dossier.");
        if (res.noteVide) t.push("Aucun résumé ajouté aux notes : la fiche d'entretien est vide.");
        if (res.note) t.push(res.note.remplacee ? "Le résumé de l'entretien du jour a remplacé la note précédente." : "Résumé de l'entretien ajouté aux notes de rendez-vous.");
        if (alerte) t.push("L'alerte « Dossier à actualiser » est levée.");
        ui.msg = { cid: c.id, ok: true, texte: t.join(" ") };
        rafraichir(zone, opt, "en-ok");
        if (opt.apresMaj) opt.apresMaj(c, "maj");
      }
    });
  }

  SG.entretienUI = { html: html, inner: inner, lier: lier, rafraichir: rafraichir, selecteur: selecteur, vide: videHtml, imprimer: docFiche, flush: sauverVite };
})();
