/* GS Banque & Assurance – résultats et bilan : choix du périmètre, indicateurs, constats chiffrés, tableaux, analyse écrite par l'élève, impression. */
(function () {
  "use strict";

  var B = window.SGBF.banque, BI = window.SGBF.bilan, PH = window.SGBF.phoning, CA = window.SGBF.campagnes, PR = window.SGBF.produits, K = window.SGBF.catalogue, CT = window.SGBF.contacts;
  var ICO = window.SGBF.icones, RECH = window.SGBF.recherche, IMP = window.SGBF.impression, CL = window.SGBF.clients;
  var app = document.getElementById("app");
  var esc = B.esc;
  function store() { return B.store.charger(); }
  function pl(n, s, p) { return B.nb(n) + " " + (n > 1 ? p : s); }
  function nomProduit(pid) { return PR.parId[pid] ? PR.parId[pid].nom : pid; }
  function dateTxt(ymd) { return B.fmtDate(B.lireYmd(ymd)); }
  function pc(v) { return v === null || v === undefined ? "–" : v + " %"; }
  var params = new URLSearchParams(location.search);
  var etat = { peri: "j30", du: "", au: "", err: null, msg: "", errAn: null };
  var CLASSE_STATUT = { avenir: "puce", cours: "puce puce-ok", terminee: "puce" };

  /* ---------- périmètre ---------- */
  function perimetre() {
    if (etat.peri.indexOf("k:") === 0) return { type: "campagne", id: etat.peri.slice(2) };
    if (etat.peri === "perso") return { type: "periode", du: etat.du, au: etat.au };
    return { type: "periode", jours: parseInt(etat.peri.slice(1), 10) };
  }
  function choixHtml() {
    var st = store(), camps = CA.campagnes(st), perso = etat.peri === "perso";
    var h = '<div class="champ bl-choix"><label for="bl-peri">Que voulez-vous analyser ?</label><select id="bl-peri">' +
      '<optgroup label="Mon activité commerciale">' + BI.PERIODES.map(function (j) { return '<option value="j' + j + '"' + (etat.peri === "j" + j ? " selected" : "") + ">Les " + j + " derniers jours</option>"; }).join("") +
      '<option value="perso"' + (perso ? " selected" : "") + ">Une période de mon choix</option></optgroup>" +
      (camps.length ? '<optgroup label="Une campagne">' + camps.map(function (k) { return '<option value="k:' + k.id + '"' + (etat.peri === "k:" + k.id ? " selected" : "") + ">" + esc(k.nom) + "</option>"; }).join("") + "</optgroup>" : "") + "</select></div>";
    if (perso) h += '<div class="ligne bl-dates"><div class="champ"><label for="bl-du">Du *</label><input id="bl-du" type="date" max="' + B.ymd(B.aujourdhui()) + '" value="' + esc(etat.du) + '"' + (etat.err && etat.err.champ === "du" ? ' aria-invalid="true" aria-describedby="bl-err"' : "") + '></div>' +
      '<div class="champ"><label for="bl-au">Au *</label><input id="bl-au" type="date" max="' + B.ymd(B.aujourdhui()) + '" value="' + esc(etat.au) + '"' + (etat.err && etat.err.champ === "au" ? ' aria-invalid="true" aria-describedby="bl-err"' : "") + "></div></div>";
    return h + '<p class="msg-erreur" id="bl-err" role="alert">' + (etat.err ? esc(etat.err.erreur) : "") + "</p>" +
      (!camps.length ? '<p class="aide-champ">Vous n\'avez pas encore de campagne : créez-en une dans <a href="campagnes.html">« Campagnes commerciales »</a> pour analyser son résultat.</p>' : "");
  }

  /* ---------- résultats ---------- */
  function kpi(lib, val, det) { return '<div class="kpi"><dt>' + esc(lib) + '</dt><dd class="val">' + val + "</dd>" + (det ? '<dd class="det">' + det + "</dd>" : "") + "</div>"; }
  function kpisHtml(r) {
    var c = r.campagne;
    return '<dl class="kpis bl-kpis">' +
      kpi("Appels", B.nb(r.appels), pl(r.joints, "abouti", "aboutis") + " – joignabilité " + pc(r.tauxJoint)) +
      kpi("Messages envoyés", B.nb(r.messages), "e-mails de la messagerie") +
      kpi("Comptes rendus d'entretien (CRE)", B.nb(r.face), r.face ? pl(r.parLieu.accueil, "à l'accueil", "à l'accueil") + ", " + pl(r.parLieu.rdv, "en rendez-vous", "en rendez-vous") : "aucun contact noté") +
      kpi("Rendez-vous", B.nb(r.rdv), c ? "rattachés à la campagne" : "créés sur la période") +
      kpi("Contrats", c ? r.contrats + " / " + c.objectif : B.nb(r.contrats), (c ? "Objectif atteint à " + pc(c.atteinte) : r.montant ? "Montants souscrits : " + B.eur(r.montant) : r.contrats ? "aucun montant saisi" : "aucun contrat")) +
      kpi("Clients contactés", B.nb(r.contactes), c ? "sur " + pl(c.cibles, "client ciblé", "clients ciblés") : "clients distincts") +
      kpi("Transformation", pc(r.transformation), "Clients ayant souscrit ÷ clients contactés") +
      kpi("Taux de multiventes", pc(r.tauxMulti), r.acheteurs ? pl(r.multi, "client", "clients") + " sur " + r.acheteurs + " avec au moins 2 produits – " + String(r.produitsParAcheteur).replace(".", ",") + " produit" + (r.produitsParAcheteur >= 2 ? "s" : "") + " par client" : "aucun client n'a souscrit") +
      kpi("Rebonds commerciaux", B.nb(r.rebonds), r.rebonds ? "utilisés – " + pl(r.rebondsAboutis, "abouti", "aboutis") + " (" + pc(r.tauxRebond) + ")" : "autre produit proposé pendant un contact") +
      kpi("Refus", B.nb(r.refus), r.refus ? "clients" : "aucun refus noté") +
      kpi(c ? "Montants souscrits" : "Hors créneau", c ? (r.montant ? B.eur(r.montant) : "–") : B.nb(r.hors), c ? "versements initiaux et capitaux empruntés" : (r.hors ? "appels à analyser" : "aucun appel hors créneau")) + "</dl>";
  }
  function barre(part) { return '<span class="barre" role="img" aria-label="' + (part || 0) + ' %"><span style="width:' + (part || 0) + '%"></span></span>'; }
  function tableau(titre, tete, lignes, cls) {
    return '<div class="tab-wrap tab-defile" role="region" aria-label="' + esc(titre) + '" tabindex="0"><table class="tab tab-cg bl-tab ' + (cls || "") + '"><caption class="sr">' + esc(titre) + "</caption><thead><tr>" + tete.map(function (t, i) { return '<th scope="col"' + (i === 0 ? ' class="gauche"' : "") + ">" + (t ? esc(t) : '<span class="sr">Représentation graphique</span>') + "</th>"; }).join("") + "</tr></thead><tbody>" + lignes.join("") + "</tbody></table></div>";
  }
  function tabResultats(r) {
    if (!r.appels) return "";
    return '<h3 class="sous-titre">Résultats des appels</h3>' + tableau("Résultats des appels", ["Résultat", "Appels", "Part", ""], PH.ORDRE_RESULTATS.map(function (k) {
      var n = r.parResultat[k] || 0, part = BI.pct(n, r.appels);
      return '<tr><th scope="row" class="gauche">' + esc(PH.RESULTATS[k].lib) + "</th><td>" + n + "</td><td>" + pc(part) + '</td><td class="bl-barre" aria-hidden="true">' + barre(part) + "</td></tr>";
    }));
  }
  function tabMoyens(r) {
    var c = r.campagne, tete = ["Moyen", "Actions", "Clients touchés", "Rendez-vous obtenus", "Rebonds", "Contrats", "Part des contrats", "Transformation", "Montants souscrits"];
    if (c) tete.splice(1, 0, "Prévu");
    function nz(v) { return v === null || v === undefined ? "–" : v; }
    var l = r.moyens.map(function (x) {
      return '<tr><th scope="row" class="gauche">' + esc(x.lib) + "</th>" + (c ? '<td class="gauche">' + (x.prevu ? "Oui" : "Non") + "</td>" : "") + "<td>" + x.actions + "</td><td>" + x.touches + "</td><td>" + nz(x.rdv) + "</td><td>" + (x.rebonds === null ? "–" : x.rebonds + (x.rebonds ? " (" + x.rebondsAboutis + " abouti" + (x.rebondsAboutis > 1 ? "s" : "") + ")" : "")) + "</td><td>" + x.contrats + "</td><td>" + pc(r.contrats ? x.part : null) + "</td><td>" + pc(x.transformation) + "</td><td>" + (x.montant ? B.eur(x.montant) : "–") + "</td></tr>";
    });
    if (r.autres) l.push('<tr><th scope="row" class="gauche">Autre ou non précisé</th>' + (c ? "<td>–</td>" : "") + "<td>–</td><td>" + r.autres.touches + "</td><td>–</td><td>–</td><td>" + r.autres.contrats + "</td><td>" + pc(r.contrats ? r.autres.part : null) + "</td><td>–</td><td>" + (r.autres.montant ? B.eur(r.autres.montant) : "–") + "</td></tr>");
    var rdvTot = (r.rdvTel || 0) + (r.rdvFace || 0);
    l.push('<tr class="bl-total"><th scope="row" class="gauche">Ensemble</th>' + (c ? "<td>–</td>" : "") + "<td>" + (r.appels + r.messages + r.face) + "</td><td>" + r.contactes + "</td><td>" + rdvTot + "</td><td>" + r.rebonds + (r.rebonds ? " (" + r.rebondsAboutis + " abouti" + (r.rebondsAboutis > 1 ? "s" : "") + ")" : "") + "</td><td>" + r.contrats + "</td><td>" + pc(r.contrats ? 100 : null) + "</td><td>" + pc(r.transformation) + "</td><td>" + (r.montant ? B.eur(r.montant) : "–") + "</td></tr>");
    return '<h3 class="sous-titre">Résultats par moyen</h3>' + tableau("Résultats par moyen : mailing, appel, entretien en rendez-vous, entretien à l'accueil", tete, l) +
      '<p class="mention">Actions : e-mails envoyés, appels passés, comptes rendus d\'entretien (CRE) rédigés. Clients touchés : clients ayant reçu un e-mail, été joints par téléphone ou reçus en entretien, ou ayant souscrit par ce moyen. Rendez-vous obtenus : notés dans le journal des appels ou des contacts (non suivis pour le mailing). Transformation : clients ayant souscrit par ce moyen ÷ clients touchés par ce moyen. « Autre ou non précisé » : clients contactés autrement (refus noté dans une campagne, rendez-vous créé sans contact noté) et contrats sans moyen.' + (c && r.moyensPrevus ? " Moyens prévus pour la campagne : " + esc(r.moyensPrevus.map(function (m) { return K.MOYENS[m].toLowerCase(); }).join(", ")) + "." : "") + "</p>";
  }
  function tabFace(r) {
    if (!r.face) return "";
    return '<h3 class="sous-titre">Résultats des entretiens (CRE)</h3>' + tableau("Résultats des entretiens (CRE)", ["Résultat", "Entretiens", "Part", ""], CT.ORDRE_RESULTATS.map(function (k) {
      var n = r.parResultatFace[k] || 0, part = BI.pct(n, r.face);
      return '<tr><th scope="row" class="gauche">' + esc(CT.RESULTATS[k].lib) + "</th><td>" + n + "</td><td>" + pc(part) + '</td><td class="bl-barre" aria-hidden="true">' + barre(part) + "</td></tr>";
    }));
  }
  function pistesHtml(r) {
    if (!r.pistes || !r.pistes.length) return "";
    return '<h3 class="sous-titre">Pistes pour vos axes d\'amélioration</h3><ul class="bl-constats bl-pistes">' + r.pistes.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + '</ul><p class="mention">Ces questions sont déduites des chiffres ci-dessus : ce ne sont pas des conclusions. Servez-vous-en pour rédiger vos axes d\'amélioration dans « Mon analyse ».</p>';
  }
  function tabMotifs(r) {
    if (!r.refus) return "";
    return '<h3 class="sous-titre">Motifs de refus</h3>' + tableau("Motifs de refus", ["Motif", "Clients"], CA.MOTIFS_REFUS.map(function (m) { return '<tr><th scope="row" class="gauche">' + esc(m) + "</th><td>" + (r.parMotif[m] || 0) + "</td></tr>"; }));
  }
  function tabEtats(r) {
    if (!r.etats) return "";
    var c = r.campagne;
    return '<h3 class="sous-titre">Situation des clients de la cible</h3>' + tableau("Situation des clients de la cible", ["État", "Clients", "Part", ""], Object.keys(CA.ETATS).map(function (e) {
      var n = r.etats[e] || 0, part = BI.pct(n, c.cibles);
      return '<tr><th scope="row" class="gauche">' + esc(CA.ETATS[e]) + "</th><td>" + n + "</td><td>" + pc(part) + '</td><td class="bl-barre" aria-hidden="true">' + barre(part) + "</td></tr>";
    }));
  }
  function tabProduits(r) {
    if (!r.parProduit || !r.parProduit.length) return "";
    return '<h3 class="sous-titre">Par produit</h3>' + tableau("Résultats par produit", ["Produit", "Appels", "Aboutis", "Comptes rendus d'entretien (CRE)", "Rendez-vous obtenus", "Refus", "Contrats", "Montants souscrits"], r.parProduit.map(function (x) {
      return '<tr><th scope="row" class="gauche">' + esc(nomProduit(x.p)) + "</th><td>" + x.appels + "</td><td>" + x.joints + "</td><td>" + x.face + "</td><td>" + x.rdv + "</td><td>" + x.refus + "</td><td>" + x.contrats + "</td><td>" + (x.montant ? B.eur(x.montant) : "–") + "</td></tr>";
    }));
  }
  function tabSemaines(r) {
    if (!r.semaines) return '<p class="mention">Le détail par semaine n\'est affiché que pour une période de 100 jours au plus.</p>';
    return '<h3 class="sous-titre">Semaine par semaine</h3>' + tableau("Activité semaine par semaine", ["Semaine", "Appels", "Aboutis", "Messages", "Entretiens", "Rendez-vous créés", "Contrats"], r.semaines.map(function (w) {
      return '<tr><th scope="row" class="gauche">Du ' + esc(dateTxt(w.du)) + " au " + esc(dateTxt(w.au)) + "</th><td>" + w.appels + "</td><td>" + w.joints + "</td><td>" + w.messages + "</td><td>" + w.face + "</td><td>" + w.rdv + "</td><td>" + w.contrats + "</td></tr>";
    }));
  }
  function tabCampagnes(r) {
    if (!r.campagnes || !r.campagnes.length) return "";
    return '<h3 class="sous-titre">Campagnes de la période</h3>' + tableau("Campagnes dont la période recoupe la période analysée", ["Campagne", "Produit", "État", "Contrats", "Objectif atteint"], r.campagnes.map(function (k) {
      return '<tr><th scope="row" class="gauche"><a href="campagnes.html?campagne=' + k.id + '">' + esc(k.nom) + '</a></th><td class="gauche">' + esc(nomProduit(k.produit)) + '</td><td class="gauche"><span class="' + CLASSE_STATUT[k.statut] + '">' + esc(CA.STATUTS[k.statut]) + "</span></td><td>" + k.contrats + " / " + k.objectif + "</td><td>" + pc(k.atteinte) + "</td></tr>";
    }));
  }
  function analyseHtml(r) {
    var a = BI.analyse(store(), r.cle), ch = BI.CHAMPS, fin = BI.complete(a);
    return '<h3 class="sous-titre">Mon analyse</h3><form class="formulaire bl-form" id="form-an" novalidate><p class="aide-champ">À partir des constats ci-dessus, expliquez ce qui s\'est passé et ce que vous allez faire. Chaque rubrique : ' + BI.MIN_TXT + " à " + BI.MAX_TXT + " caractères.</p>" +
      Object.keys(ch).map(function (c) {
        var zone = '<label for="bl-' + c + '">' + esc(ch[c]) + '</label>' + (c === "act" ? '<span class="aide-champ" id="bl-aide-act">Ce que vous décidez de faire, avec qui, et pour quand : une action par ligne.</span>' : "") +
          '<textarea id="bl-' + c + '" rows="4" maxlength="' + BI.MAX_TXT + '"' + (etat.errAn && etat.errAn.champ === c ? ' aria-invalid="true" aria-describedby="bl-err-an"' : c === "act" ? ' aria-describedby="bl-aide-act"' : "") + ">" + esc(a[c]) + "</textarea>";
        /* Les actions à décider sont dans un encadré à part, pour se distinguer de l'analyse. */
        return c === "act" ? '<div class="champ bl-actions">' + zone + "</div>" : '<div class="champ">' + zone + "</div>";
      }).join("") + '<p class="msg-erreur" id="bl-err-an" role="alert">' + (etat.errAn ? esc(etat.errAn.erreur) : "") + '</p><div class="pf-btns"><button type="submit" class="btn btn-principal">Enregistrer mon analyse</button> <span class="puce' + (fin ? " puce-ok" : "") + '" id="bl-etat-an">' + (fin ? "Analyse complète" : "Analyse à compléter") + "</span>" + (a.maj ? ' <span class="mention">Dernier enregistrement : ' + esc(dateTxt(a.maj)) + "</span>" : "") + "</div></form>";
  }
  function resultatHtml() {
    var st = store(), r = BI.calculer(st, perimetre());
    if (!r.ok) return '<p class="vide-bloc" id="bl-vide">' + esc(r.erreur) + "</p>";
    var c = r.campagne, sous = c ? esc(nomProduit(c.produit)) + " – du " + esc(dateTxt(r.du)) + " au " + esc(dateTxt(r.au)) + " – " + esc(CA.STATUTS[c.statut]) : "du " + esc(dateTxt(r.du)) + " au " + esc(dateTxt(r.au));
    return '<section class="bloc bl-resultat" aria-labelledby="t-res"><div class="bloc-tete"><h2 id="t-res" tabindex="-1">' + esc(r.titre) + '</h2><span class="ag-outils"><button type="button" class="btn btn-secondaire" data-act="imprimer">Imprimer le bilan</button></span></div>' +
      (c ? '<p class="cg-sous">' + sous + "</p>" : "") + kpisHtml(r) +
      '<h3 class="sous-titre">Constats chiffrés</h3><ul class="bl-constats">' + r.constats.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" + pistesHtml(r) +
      '<p class="mention">Les chiffres sont recalculés à chaque ouverture à partir de vos actions : appels du phoning, messages, entretiens, rendez-vous de l\'agenda, souscriptions du catalogue et refus des campagnes. « Clients contactés » = clients ayant reçu un message, été joints par téléphone, reçus en entretien, obtenu un rendez-vous, refusé ou souscrit ; un appel sans réponse n\'est pas un contact. « Taux de multiventes » = clients ayant souscrit au moins deux produits ÷ clients ayant souscrit. « Rebond commercial » = autre produit proposé pendant un appel abouti ou un entretien (CRE) ; il a abouti si le client a souscrit ce produit depuis.</p>' +
      tabMoyens(r) + tabResultats(r) + tabFace(r) + tabEtats(r) + tabMotifs(r) + tabProduits(r) + (c ? "" : tabSemaines(r)) + tabCampagnes(r) + (r.activite ? "" : "") +
      '<div id="z-analyse">' + analyseHtml(r) + "</div></section>";
  }
  function majResultat() { document.getElementById("z-resultat").innerHTML = resultatHtml(); }
  function majChoix() { document.getElementById("z-choix").innerHTML = choixHtml(); }
  function majMsg() { var z = document.getElementById("z-msg"); if (z) z.innerHTML = etat.msg ? '<p class="ag-ok" id="bl-ok" tabindex="-1" role="status">' + esc(etat.msg) + "</p>" : ""; }

  /* ---------- impression ---------- */
  function dpTable(tete, lignes) { return '<table class="dp-pf dp-camp"><thead><tr>' + tete.map(function (t) { return '<th scope="col" class="g">' + esc(t) + "</th>"; }).join("") + "</tr></thead><tbody>" + lignes.join("") + "</tbody></table>"; }
  function docBilan() {
    var st = store(), r = BI.calculer(st, perimetre());
    if (!r.ok) return;
    var c = r.campagne, a = BI.analyse(st, r.cle), corps = "";
    corps += '<section class="dp-bloc"><h2>Indicateurs au ' + esc(B.fmtDate(B.aujourdhui())) + '</h2><dl class="dp-chiffres"><div><dt>Appels</dt><dd>' + r.appels + " (" + r.joints + " aboutis)</dd></div><div><dt>Messages</dt><dd>" + r.messages + "</dd></div><div><dt>Comptes rendus d'entretien (CRE)</dt><dd>" + r.face + "</dd></div><div><dt>Rendez-vous</dt><dd>" + r.rdv + "</dd></div><div><dt>Contrats</dt><dd>" + r.contrats + (c ? " / " + c.objectif : "") + "</dd></div><div><dt>Clients contactés</dt><dd>" + r.contactes + "</dd></div><div><dt>Transformation</dt><dd>" + pc(r.transformation) + "</dd></div><div><dt>Taux de multiventes</dt><dd>" + pc(r.tauxMulti) + "</dd></div><div><dt>Rebonds commerciaux</dt><dd>" + r.rebonds + (r.rebonds ? " (" + r.rebondsAboutis + " aboutis)" : "") + "</dd></div><div><dt>Refus</dt><dd>" + r.refus + "</dd></div><div><dt>Montants souscrits</dt><dd>" + (r.montant ? esc(B.eur(r.montant)) : "–") + "</dd></div></dl></section>";
    corps += '<section class="dp-bloc"><h2>Constats chiffrés</h2><ul class="dp-liste">' + r.constats.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></section>";
    corps += '<section class="dp-bloc"><h2>Résultats par moyen</h2>' + dpTable(["Moyen"].concat(c ? ["Prévu"] : [], ["Actions", "Clients touchés", "Rendez-vous obtenus", "Rebonds", "Contrats", "Part des contrats", "Transformation", "Montants"]), r.moyens.map(function (x) {
      return '<tr><td class="g">' + esc(x.lib) + "</td>" + (c ? '<td class="g">' + (x.prevu ? "Oui" : "Non") + "</td>" : "") + '<td class="g">' + x.actions + '</td><td class="g">' + x.touches + '</td><td class="g">' + (x.rdv === null ? "–" : x.rdv) + '</td><td class="g">' + (x.rebonds === null ? "–" : x.rebonds + (x.rebonds ? " (" + x.rebondsAboutis + " aboutis)" : "")) + '</td><td class="g">' + x.contrats + '</td><td class="g">' + pc(r.contrats ? x.part : null) + '</td><td class="g">' + pc(x.transformation) + '</td><td class="g">' + (x.montant ? esc(B.eur(x.montant)) : "–") + "</td></tr>";
    }).concat(r.autres ? ['<tr><td class="g">Autre ou non précisé</td>' + (c ? '<td class="g">–</td>' : "") + '<td class="g">–</td><td class="g">' + r.autres.touches + '</td><td class="g">–</td><td class="g">–</td><td class="g">' + r.autres.contrats + '</td><td class="g">' + pc(r.contrats ? r.autres.part : null) + '</td><td class="g">–</td><td class="g">' + (r.autres.montant ? esc(B.eur(r.autres.montant)) : "–") + "</td></tr>"] : [], ['<tr><td class="g"><strong>Ensemble</strong></td>' + (c ? '<td class="g">–</td>' : "") + '<td class="g">' + (r.appels + r.messages + r.face) + '</td><td class="g">' + r.contactes + '</td><td class="g">' + ((r.rdvTel || 0) + (r.rdvFace || 0)) + '</td><td class="g">' + r.rebonds + (r.rebonds ? " (" + r.rebondsAboutis + " aboutis)" : "") + '</td><td class="g">' + r.contrats + '</td><td class="g">' + pc(r.contrats ? 100 : null) + '</td><td class="g">' + pc(r.transformation) + '</td><td class="g">' + (r.montant ? esc(B.eur(r.montant)) : "–") + "</td></tr>"])) + '<p class="dp-mention">Taux de multiventes : clients ayant souscrit au moins deux produits ÷ clients ayant souscrit. Rebond commercial : autre produit proposé pendant un appel abouti ou un entretien (CRE).</p></section>';
    if (r.appels) corps += '<section class="dp-bloc"><h2>Résultats des appels</h2>' + dpTable(["Résultat", "Appels", "Part"], PH.ORDRE_RESULTATS.map(function (k) { return '<tr><td class="g">' + esc(PH.RESULTATS[k].lib) + '</td><td class="g">' + (r.parResultat[k] || 0) + '</td><td class="g">' + pc(BI.pct(r.parResultat[k] || 0, r.appels)) + "</td></tr>"; })) + "</section>";
    if (r.face) corps += '<section class="dp-bloc"><h2>Résultats des entretiens (CRE)</h2>' + dpTable(["Résultat", "Entretiens", "Part"], CT.ORDRE_RESULTATS.map(function (k) { return '<tr><td class="g">' + esc(CT.RESULTATS[k].lib) + '</td><td class="g">' + (r.parResultatFace[k] || 0) + '</td><td class="g">' + pc(BI.pct(r.parResultatFace[k] || 0, r.face)) + "</td></tr>"; })) + "</section>";
    if (r.etats) corps += '<section class="dp-bloc"><h2>Situation des clients de la cible</h2>' + dpTable(["État", "Clients", "Part"], Object.keys(CA.ETATS).map(function (e) { return '<tr><td class="g">' + esc(CA.ETATS[e]) + '</td><td class="g">' + r.etats[e] + '</td><td class="g">' + pc(BI.pct(r.etats[e], c.cibles)) + "</td></tr>"; })) + "</section>";
    if (r.refus) corps += '<section class="dp-bloc"><h2>Motifs de refus</h2>' + dpTable(["Motif", "Clients"], CA.MOTIFS_REFUS.map(function (m) { return '<tr><td class="g">' + esc(m) + '</td><td class="g">' + (r.parMotif[m] || 0) + "</td></tr>"; })) + "</section>";
    if (r.parProduit && r.parProduit.length) corps += '<section class="dp-bloc"><h2>Par produit</h2>' + dpTable(["Produit", "Appels", "Aboutis", "Entretiens", "Rendez-vous", "Refus", "Contrats", "Montants"], r.parProduit.map(function (x) { return '<tr><td class="g">' + esc(nomProduit(x.p)) + '</td><td class="g">' + x.appels + '</td><td class="g">' + x.joints + '</td><td class="g">' + x.face + '</td><td class="g">' + x.rdv + '</td><td class="g">' + x.refus + '</td><td class="g">' + x.contrats + '</td><td class="g">' + (x.montant ? esc(B.eur(x.montant)) : "–") + "</td></tr>"; })) + "</section>";
    if (r.semaines) corps += '<section class="dp-bloc"><h2>Semaine par semaine</h2>' + dpTable(["Semaine", "Appels", "Aboutis", "Messages", "Entretiens", "Rendez-vous", "Contrats"], r.semaines.map(function (w) { return '<tr><td class="g">' + esc(dateTxt(w.du) + " au " + dateTxt(w.au)) + '</td><td class="g">' + w.appels + '</td><td class="g">' + w.joints + '</td><td class="g">' + w.messages + '</td><td class="g">' + w.face + '</td><td class="g">' + w.rdv + '</td><td class="g">' + w.contrats + "</td></tr>"; })) + "</section>";
    var ch = BI.CHAMPS;
    if (r.pistes && r.pistes.length) corps += '<section class="dp-bloc"><h2>Pistes pour les axes d\'amélioration</h2><ul class="dp-liste">' + r.pistes.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></section>";
    function bloc(k) { return '<h3 class="dp-sous">' + esc(ch[k]) + '</h3><p class="dp-analyse">' + (a[k] ? esc(a[k]).replace(/\n/g, "<br>") : "<em>À compléter</em>") + "</p>"; }
    corps += '<section class="dp-long"><h2>Analyse du conseiller</h2>' + Object.keys(ch).filter(function (k) { return k !== "act"; }).map(bloc).join("") + '<div class="dp-actions">' + bloc("act") + "</div>" + '<p class="dp-mention">Indicateurs recalculés à partir des appels, messages, entretiens, rendez-vous et contrats enregistrés dans l\'outil.</p></section>';
    IMP.imprimer(IMP.document({ titre: "Résultats et bilan : " + r.titre.replace(/^Activité commerciale/, "activité commerciale"), sous: "Agence de Paris – du " + dateTxt(r.du) + " au " + dateTxt(r.au), corps: corps }), IMP.nomFichier("Bilan_" + (c ? c.nom : r.du + "_" + r.au)));
  }

  /* ---------- page ---------- */
  function render() {
    app.innerHTML = '<nav class="fil-ariane" aria-label="Fil d\'Ariane"><a href="index.html">' + ICO.retour + "Accueil</a><span aria-hidden=\"true\">/</span><span>Résultats et bilan</span></nav>" +
      '<div class="page-titre"><h1>Résultats et bilan</h1><p>' + esc(B.fmtLong(B.aujourdhui())) + " – contacts, rendez-vous, contrats, transformation et analyse</p></div>" +
      '<div id="z-msg"></div><div class="page-grille"><section class="bloc" aria-labelledby="t-choix"><div class="bloc-tete"><h2 id="t-choix">Périmètre du bilan</h2></div><div id="z-choix" class="bl-choix-zone">' + choixHtml() + '</div></section><div id="z-resultat">' + resultatHtml() + "</div></div>" +
      '<p class="mention" style="margin-top:16px">Les résultats sont calculés à partir de vos actions dans les autres outils ; seule votre analyse est saisie ici. Elle est enregistrée dans ce navigateur, sur cet ordinateur.</p>';
  }

  /* ---------- événements ---------- */
  app.addEventListener("change", function (e) {
    var t = e.target;
    if (t.id === "bl-peri") {
      etat.peri = t.value; etat.err = null; etat.msg = ""; majMsg();
      if (etat.peri === "perso" && !etat.du) { var a = BI.bornes({ type: "periode", jours: 30 }); etat.du = a.du; etat.au = a.au; }
      majChoix(); validerEtAfficher(); var s = document.getElementById("bl-peri"); if (s) s.focus();
    } else if (t.id === "bl-du" || t.id === "bl-au") {
      if (t.id === "bl-du") etat.du = t.value; else etat.au = t.value;
      validerEtAfficher();
    }
  });
  function validerEtAfficher() {
    var v = BI.valider(store(), perimetre());
    etat.err = v.ok ? null : v;
    var z = document.getElementById("bl-err"); if (z) z.textContent = v.ok ? "" : v.erreur;
    app.querySelectorAll("#z-choix [aria-invalid]").forEach(function (x) { x.removeAttribute("aria-invalid"); x.removeAttribute("aria-describedby"); });
    if (!v.ok) { var f = document.getElementById("bl-" + v.champ); if (f) { f.setAttribute("aria-invalid", "true"); f.setAttribute("aria-describedby", "bl-err"); } document.getElementById("z-resultat").innerHTML = ""; return; }
    majResultat();
  }
  app.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (b && b.getAttribute("data-act") === "imprimer") docBilan();
  });
  app.addEventListener("submit", function (e) {
    e.preventDefault();
    if (e.target.id !== "form-an") return;
    var st = store(), r = BI.calculer(st, perimetre()); if (!r.ok) return;
    var o = {}; Object.keys(BI.CHAMPS).forEach(function (c) { o[c] = document.getElementById("bl-" + c).value; });
    var res = BI.enregistrerAnalyse(st, r.cle, o), z = document.getElementById("bl-err-an");
    if (!res.ok) {
      etat.errAn = res; z.textContent = res.erreur;
      app.querySelectorAll("#form-an [aria-invalid]").forEach(function (x) { x.removeAttribute("aria-invalid"); x.removeAttribute("aria-describedby"); });
      var f = document.getElementById("bl-" + res.champ); if (f) { f.setAttribute("aria-invalid", "true"); f.setAttribute("aria-describedby", "bl-err-an"); f.focus(); }
      return;
    }
    etat.errAn = null; B.store.sauver();
    document.getElementById("z-analyse").innerHTML = analyseHtml(r);
    etat.msg = "Analyse enregistrée" + (res.complete ? "." : " : elle est encore à compléter (les quatre rubriques doivent être renseignées).");
    majMsg(); var ok = document.getElementById("bl-ok"); if (ok) { ok.scrollIntoView({ block: "center" }); ok.focus(); }
  });

  RECH.init(CL, document.getElementById("rech"), document.getElementById("rech-res"), document.getElementById("rech-statut"));
  /* Paramètre d'adresse : ?campagne=ID (bilan d'une campagne). */
  var pk = params.get("campagne");
  if (pk && CA.trouver(store(), pk)) etat.peri = "k:" + pk;
  render();
})();
