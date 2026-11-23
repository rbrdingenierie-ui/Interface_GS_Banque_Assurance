/* GS Banque & Assurance – fiche client 360° : identité, famille, compte courant et relevé, épargne, crédits, assurances, notes et projets. */
(function () {
  "use strict";

  var B = window.SGBF.banque, S = window.SGBF.synthese, DO = window.SGBF.dossier, ENT = window.SGBF.entretienUI, COUR = window.SGBF.courriersUI, RIB = window.SGBF.rib, PR = window.SGBF.produits, CL = window.SGBF.clients, M = window.SGBF.mouvements, ICO = window.SGBF.icones, RECH = window.SGBF.recherche, IMP = window.SGBF.impression, OS = window.SGBF.operations, OPUI = window.SGBF.operationsUI, RC = window.SGBF.reclamations, RUI = window.SGBF.reclamationsUI;
  var app = document.getElementById("app");
  var esc = B.esc, eur = B.eur, eur2 = B.eur2, fmtDate = B.fmtDate;
  /* Nom proposé dans « Rédigée par » : seulement celui que l'élève a confirmé pour cette connexion (jamais celui d'un élève précédent sur le même ordinateur). */
  function nomConfirme() { var ID = window.SGBF.identite; return ID && ID.confirme() ? ID.nomCourant() : ""; }

  var TABS = [
    { id: "vue", lib: "Vue d'ensemble" },
    { id: "compte", lib: "Compte courant" },
    { id: "operations", lib: "Opérations" },
    { id: "epargne", lib: "Épargne et placements" },
    { id: "credits", lib: "Crédits" },
    { id: "assurances", lib: "Assurances" },
    { id: "notes", lib: "Notes et projets" },
    { id: "reclamations", lib: "Réclamations" },
    { id: "entretien", lib: "Entretien" },
    { id: "courriers", lib: "Courriers et documents" }
  ];
  var MOIS_COURT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  var CANAUX = ["Entretien en agence", "Appel téléphonique", "E-mail"];
  var TYPES = [
    { id: "tous", lib: "Tous les mouvements" }, { id: "carte", lib: "Paiements par carte" }, { id: "prelevement", lib: "Prélèvements" },
    { id: "virement_recu", lib: "Virements reçus" }, { id: "virement_emis", lib: "Virements émis" }, { id: "retrait", lib: "Retraits d'espèces" },
    { id: "cheque", lib: "Chèques" }, { id: "frais", lib: "Frais et intérêts" }
  ];
  var ICONE_CAT = { carte: ICO.carte, prelevement: ICO.prelevement, cheque: ICO.cheque, virement_recu: ICO.virement, virement_emis: ICO.virement, retrait: ICO.retrait, frais: ICO.frais, ouverture: ICO.info };

  var params = new URLSearchParams(location.search);
  var client = CL.filter(function (c) { return String(c.id) === params.get("id"); })[0] || null;
  var etat = { tab: "vue", mois: "0", type: "tous", q: "", confirmer: null, message: "" };
  var cache = {};

  /* ---------- outils ---------- */
  function pl(n, s, p) { return n + " " + (n > 1 ? p : s); }
  function nomComplet(c) { return c.prenom + " " + c.nom; }
  function initiales(c) { return (c.prenom.charAt(0) + c.nom.charAt(0)).toUpperCase(); }
  function maj(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function dureeTxt(m) { return m % 12 === 0 ? pl(m / 12, "an", "ans") : pl(m, "mois", "mois"); }
  function anneesTxt(j) { var a = Math.floor(j / 365.25); return a >= 1 ? pl(a, "an", "ans") : pl(Math.max(1, Math.round(j / 30.4)), "mois", "mois"); }
  function parseYmd(s) { var p = s.split("-"); return B.D(+p[0], +p[1] - 1, +p[2]); }
  function dateIso(d) { return B.ymd(d); }
  function pct2(x) { return String(x).replace(".", ",") + " %"; }
  function pctFr(x) { return (Math.round(x * 10) / 10).toString().replace(".", ",") + " %"; }
  function ligneDl(lib, val) { return val == null || val === "" ? "" : "<dt>" + lib + "</dt><dd>" + val + "</dd>"; }
  function nomProduit(p) { return PR.parId[p] ? PR.parId[p].nom : p; }
  function codeProduit(p) { return PR.parId[p] ? PR.parId[p].code : p; }
  function store() { return B.store.charger(); }
  function chip(cls, ico, txt) { return '<span class="puce puce-' + cls + '">' + ICO[ico] + esc(txt) + "</span>"; }

  /* ---------- relevé : calculs ---------- */
  /* Un relevé de compte couvre un seul mois civil. Le site tient les 12 derniers relevés (mois terminés) et le mois en cours (non arrêté). */
  var NB_RELEVES = 12;
  function moisN(rc, n) { return rc.mois[rc.mois.length - 1 - n]; }
  function deMois(m) { var t = B.libMois(m.k).toLowerCase(); return (/^[aeiouyéèàôû]/.test(t) ? "d'" : "de ") + t; }
  function releve() {
    var cle = client.id + "|" + B.ymd(B.aujourdhui());
    if (cache.cle === cle) return cache.r;
    var r = M.releve(client, NB_RELEVES), auj = B.aujourdhui(), k0 = B.indexMois(auj);
    var mois = [], bal = r.soldeDebut, i, k;
    for (i = NB_RELEVES; i >= 0; i--) mois.push({ k: k0 - i, lignes: [], debut: 0, fin: 0, cre: 0, deb: 0 });
    r.lignes.forEach(function (l) { var m = mois[B.indexMois(l.date) - (k0 - NB_RELEVES)]; if (m) m.lignes.push(l); });
    mois.forEach(function (m) {
      m.debut = bal;
      m.lignes.forEach(function (l) { if (l.m > 0) m.cre += l.m; else m.deb -= l.m; bal = l.solde; });
      m.fin = bal;
      m.cre = B.arrondi(m.cre); m.deb = B.arrondi(m.deb);
      m.avantOuverture = B.dateDuMois(m.k, 31) < r.ouvertureCompte;
    });
    /* série quotidienne du solde (fin de journée) */
    var jours = [], idx = 0, courant = r.soldeDebut, d = r.debut;
    while (d <= auj) {
      while (idx < r.lignes.length && r.lignes[idx].date <= d) { courant = r.lignes[idx].solde; idx++; }
      if (d >= r.ouvertureCompte) jours.push({ d: d, s: courant });
      d = B.plusJours(d, 1);
    }
    cache = { cle: cle, r: { brut: r, mois: mois, jours: jours, k0: k0 } };
    return cache.r;
  }

  var largeurGraphe = 0;
  function graphe(rc, largeurImpr) {
    var jours = rc.jours, n = jours.length;
    if (n < 2) return '<p class="vide-onglet">Le compte vient d\'être ouvert : il n\'y a pas encore assez de jours pour tracer une courbe.</p>';
    var conteneur = app.clientWidth || 760;
    var W = largeurImpr || Math.max(300, Math.min(760, conteneur - 56)), H = W < 500 ? 210 : 240, ml = W < 500 ? 58 : 64, mr = 10, mt = 14, mb = 28;
    if (!largeurImpr) largeurGraphe = W;
    var mn = Infinity, mx = -Infinity, imn = 0, imx = 0;
    jours.forEach(function (p, i) { if (p.s < mn) { mn = p.s; imn = i; } if (p.s > mx) { mx = p.s; imx = i; } });
    var lo = Math.min(0, mn), hi = Math.max(mx, 1);
    var brut = (hi - lo) / 4, mag = Math.pow(10, Math.floor(Math.log10(brut))), pas = mag * 10;
    [1, 2, 2.5, 5, 10].some(function (m) { if (m * mag >= brut) { pas = m * mag; return true; } return false; });
    lo = Math.floor(lo / pas) * pas; hi = Math.ceil(hi / pas) * pas;
    function X(i) { return ml + (W - ml - mr) * i / Math.max(1, n - 1); }
    function Y(v) { return mt + (H - mt - mb) * (1 - (v - lo) / (hi - lo)); }
    var pts = jours.map(function (p, i) { return X(i).toFixed(1) + "," + Y(p.s).toFixed(1); });
    var y0 = Y(Math.max(lo, 0)).toFixed(1);
    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Évolution du solde du compte courant du ' + fmtDate(jours[0].d) + " au " + fmtDate(jours[n - 1].d) + ". Solde le plus bas : " + eur(mn) + " le " + fmtDate(jours[imn].d) + ". Solde le plus haut : " + eur(mx) + " le " + fmtDate(jours[imx].d) + ". Solde actuel : " + eur(jours[n - 1].s) + '. Les mêmes données figurent dans les tableaux ci-dessous.">';
    if (!largeurImpr) {
      var m = moisN(rc, +etat.mois);
      var a = Math.max(0, B.ecartJours(B.dateDuMois(m.k, 1), jours[0].d)), b = Math.min(n - 1, B.ecartJours(B.dateDuMois(m.k, 31), jours[0].d));
      if (b > a) svg += '<rect class="mois-actif" x="' + X(a).toFixed(1) + '" y="' + mt + '" width="' + (X(b) - X(a)).toFixed(1) + '" height="' + (H - mt - mb) + '"></rect>';
    }
    for (var v = lo; v <= hi + 1e-6; v += pas) {
      svg += '<line class="axe" x1="' + ml + '" x2="' + (W - mr) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '"></line><text x="' + (ml - 7) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end">' + esc(eur(v)) + "</text>";
    }
    if (lo < 0) svg += '<line class="zero" x1="' + ml + '" x2="' + (W - mr) + '" y1="' + Y(0).toFixed(1) + '" y2="' + Y(0).toFixed(1) + '"></line>';
    var espace = (W - ml - mr) / 12, saut = Math.max(1, Math.ceil(52 / espace)), nm = 0;
    jours.forEach(function (p, i) {
      if (p.d.getDate() === 1) {
        if (nm % saut === 0) svg += '<text x="' + X(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="start">' + MOIS_COURT[p.d.getMonth()] + (p.d.getMonth() === 0 ? " " + p.d.getFullYear() : "") + "</text>";
        nm++;
      }
    });
    svg += '<path class="aire" d="M' + pts[0] + " L" + pts.join(" L") + " L" + X(n - 1).toFixed(1) + "," + y0 + " L" + X(0).toFixed(1) + "," + y0 + ' Z"></path><polyline class="courbe" points="' + pts.join(" ") + '"></polyline></svg>';
    return svg;
  }

  /* Faits d'un relevé mensuel (n = 0 : mois en cours, 1 : mois précédent…). Le mois en cours n'est pas arrêté : ce n'est pas encore un relevé. */
  function faitsReleve(rc, n) {
    var m = moisN(rc, n), enCours = n === 0, premierJour = B.dateDuMois(m.k, 1);
    var du = premierJour < rc.brut.ouvertureCompte ? rc.brut.ouvertureCompte : premierJour;
    var finMois = B.dateDuMois(m.k, 31), au = enCours ? B.aujourdhui() : finMois, ouverture = du > premierJour, cre = 0, deb = 0;
    m.lignes.forEach(function (x) { if (x.m > 0) cre += x.m; else deb -= x.m; });
    return {
      m: m, n: n, enCours: enCours, du: du, au: au, finMois: finMois, ouverture: ouverture,
      cre: B.arrondi(cre), deb: B.arrondi(deb), debut: m.debut, fin: m.fin, lignes: m.lignes,
      libDebut: ouverture ? "Solde à l'ouverture du compte" : (enCours ? "Solde au " + fmtDate(B.plusJours(du, -1)) + " (dernier relevé)" : "Ancien solde au " + fmtDate(B.plusJours(du, -1))),
      libFin: enCours ? "Solde au " + fmtDate(au) + " (situation du jour)" : "Nouveau solde au " + fmtDate(au)
    };
  }
  function titreReleve(f) { return f.enCours ? "Opérations du mois en cours (relevé non arrêté)" : "Relevé " + deMois(f.m); }
  function filtrerLignes(rc) {
    var q = RECH.norm(etat.q), src = moisN(rc, +etat.mois).lignes;
    return src.filter(function (l) { return (etat.type === "tous" || l.cat === etat.type) && (!q || RECH.norm(l.lib).indexOf(q) >= 0); });
  }
  function ligneReleve(l) {
    var montant = l.m < 0 ? eur2(l.m) : "+" + eur2(l.m);
    return '<tr class="rel-ligne' + (l.cat === "frais" ? " rel-frais" : "") + '"><td class="rel-date">' + fmtDate(l.date) + "</td>" +
      '<td class="rel-lib"><span class="rel-ico">' + (ICONE_CAT[l.cat] || "") + '</span><span class="rel-lib-txt">' + esc(l.lib) + "</span>" +
      '<span class="rel-mob">' + esc(montant) + " – solde " + eur2(l.solde) + "</span></td>" +
      '<td class="rel-debit">' + (l.m < 0 ? eur2(-l.m) : "") + "</td>" +
      '<td class="rel-credit">' + (l.m > 0 ? eur2(l.m) : "") + "</td>" +
      '<td class="rel-solde' + (l.solde < 0 ? " neg" : "") + '">' + eur2(l.solde) + "</td></tr>";
  }
  function corpsReleve() {
    var rc = releve(), f = faitsReleve(rc, +etat.mois), titre = titreReleve(f);
    if (f.m.avantOuverture) return '<h3 class="rel-titre">' + esc(titre) + '</h3><p class="rel-vide">Le compte a été ouvert le ' + fmtDate(rc.brut.ouvertureCompte) + " : il n'y a aucun mouvement avant cette date.</p>";
    var l = filtrerLignes(rc), total = f.lignes.length;
    var r = RIB.rib(client), tit = titulairesAu(client, f.au);
    var h = '<h3 class="rel-titre">' + esc(titre) + " : du " + fmtDate(f.du) + " au " + fmtDate(f.au) + "</h3>" +
      '<dl class="rel-compte"><div><dt>' + (tit.joint ? "Titulaires du " + tit.lib : "Titulaire") + "</dt><dd>" + tit.noms.map(esc).join(" " + tit.lien + " ") + "</dd></div>" +
      '<div><dt>' + ABBR_IBAN + '</dt><dd class="rel-iban">' + esc(r.ibanLisible) + "</dd></div><div><dt>" + ABBR_BIC + "</dt><dd>" + esc(r.bicLisible) + "</dd></div></dl>" +
      '<dl class="rel-synthese"><div><dt>' + esc(f.libDebut) + "</dt><dd" + (f.debut < 0 ? ' class="neg"' : "") + ">" + eur2(f.debut) + "</dd></div>" +
      "<div><dt>Total des débits</dt><dd>" + eur2(f.deb) + "</dd></div><div><dt>Total des crédits</dt><dd>" + eur2(f.cre) + "</dd></div>" +
      "<div><dt>" + esc(f.libFin) + "</dt><dd" + (f.fin < 0 ? ' class="neg"' : "") + ">" + eur2(f.fin) + "</dd></div></dl>" +
      (f.enCours ? '<p class="mention">Ce mois n\'est pas terminé : son relevé sera arrêté le ' + fmtDate(f.finMois) + ". Pour l'instant, ce sont des opérations en cours, pas un relevé.</p>" : "") +
      '<p class="sous" role="status" style="font-size:14px;color:var(--muted)">' + (l.length === total ? pl(total, "mouvement", "mouvements") + " affichés." : pl(l.length, "mouvement affiché", "mouvements affichés") + " sur " + total + ".") + "</p>" +
      '<div class="rel-tableau"><table class="rel-table"><caption class="sr">' + esc(titre) + ", de la plus ancienne à la plus récente</caption>" +
      '<thead><tr><th scope="col">Date</th><th scope="col">Opération</th><th scope="col" class="rel-debit">Débit</th><th scope="col" class="rel-credit">Crédit</th><th scope="col" class="rel-solde">Solde</th></tr></thead><tbody>' +
      (l.length ? l.map(ligneReleve).join("") : '<tr><td colspan="5" class="rel-vide">Aucun mouvement ne correspond à ces critères.</td></tr>') + "</tbody></table></div>";
    return h;
  }

  /* ---------- onglet : vue d'ensemble ---------- */
  var LIB_REV = { retraite: "Pension de retraite nette", chomage: "Allocation chômage nette", etudiant: "Ressources mensuelles", independant: "Revenu mensuel moyen", foyer: "Revenu propre", salarie: "Salaire net mensuel", fonctionnaire: "Traitement net mensuel", apprenti: "Rémunération nette" };
  /* Les libellés génériques comportent « (e) » : on les accorde selon le sexe du client. */
  function genre(txt, feminin) { return txt === "Veuf / veuve" ? (feminin ? "Veuve" : "Veuf") : txt.replace(/\(e\)/g, feminin ? "e" : ""); }
  function dansTxt(j) { return j < 60 ? "dans environ " + pl(Math.max(1, j), "jour", "jours") : "dans environ " + Math.round(j / 30.4) + " mois"; }
  function carteIdentite(c) {
    var n = S.naissance(c), f = c.sexe === "F", kyc = c.kyc > S.KYC_MAX;
    return '<section class="carte-info" aria-labelledby="h-id"><h2 id="h-id">' + ICO.utilisateur + "Identité et coordonnées</h2><dl class=\"fiche\">" +
      ligneDl("Client", esc(c.civ + " " + c.prenom + " " + c.nom.toUpperCase())) +
      ligneDl(f ? "Née le" : "Né le", fmtDate(n) + " (" + c.age + " ans)") +
      ligneDl("Adresse", esc(c.adr.rue) + ", " + esc(c.adr.cp) + " " + esc(c.adr.ville)) +
      ligneDl("Téléphone", esc(c.tel) || "Non renseigné") + ligneDl("Mobile", esc(c.mob)) + ligneDl("E-mail", esc(c.mail)) + (DO && DO.pref(store(), c.id) ? ligneDl("Contact souhaité", esc(DO.PREFS[DO.pref(store(), c.id)])) : "") +
      ligneDl("Numéro client", esc(c.num)) +
      ligneDl(ABBR_IBAN + " du compte courant", '<span class="rel-iban" id="fiche-iban">' + esc(RIB.rib(c).ibanLisible) + "</span>") +
      ligneDl("Client depuis", fmtDate(B.dateOuvrable(c.depuis)) + " (" + anneesTxt(c.depuis) + ")") +
      ligneDl("Dossier mis à jour le", fmtDate(B.dateOuvrable(c.kyc)) + (kyc ? " " + chip("warn", "alerte", "À actualiser") : "")) +
      "</dl></section>";
  }
  function carteFamille(c) {
    var f = c.fam, cj = f.conj, h = "", fem = c.sexe === "F";
    h += ligneDl("Situation", esc(genre(S.LIB_SITUATION[f.sit] || f.sit, fem)));
    if (cj) {
      var libCj = f.sit === "marie" ? (cj.sexe === "F" ? "Conjointe" : "Conjoint") : f.sit === "pacse" ? "Partenaire de PACS" : (cj.sexe === "F" ? "Concubine" : "Concubin");
      h += ligneDl(libCj, esc(cj.prenom + " " + (RIB.coTitulaire(c) || cj).nom.toUpperCase()) + ", " + cj.age + " ans");
      h += ligneDl("Activité", esc(cj.prof) + (cj.rev ? ", " + eur(cj.rev) + " net par mois" : ""));
      h += ligneDl("Banque principale", cj.banque === "GS" ? "GS Banque & Assurance" : "Autre établissement");
      h += ligneDl("Compte joint", "Oui : le compte courant est ouvert au nom du couple");
    }
    h += ligneDl("Enfants", f.enf.length ? f.enf.map(function (e) { return esc(e.prenom) + " (" + (e.age === 0 ? (e.naissJ ? Math.max(1, Math.round(e.naissJ / 30.4)) + " mois" : "moins d'un an") : pl(e.age, "an", "ans")) + ")"; }).join(", ") : "Aucun");
    h += ligneDl("Personnes à charge", String(f.nbCharge));
    h += ligneDl("Parts fiscales", String(c.pro.parts).replace(".", ","));
    h += ligneDl("Revenu fiscal de référence", eur(c.rfr));
    return '<section class="carte-info" aria-labelledby="h-fam"><h2 id="h-fam">' + ICO.groupe + 'Famille et situation fiscale</h2><dl class="fiche">' + h + "</dl></section>";
  }
  function cartePro(c) {
    var p = c.pro, h = "", fem = c.sexe === "F";
    h += ligneDl("Situation", esc(genre(S.LIB_STATUT[p.statut] || p.statut, fem)));
    h += ligneDl("Profession", esc(p.prof));
    if (["salarie", "fonctionnaire", "apprenti", "independant"].indexOf(p.statut) >= 0) {
      h += ligneDl(p.statut === "independant" ? "Activité" : "Employeur", esc(p.emp));
      h += ligneDl("Contrat", esc(p.ctr) + (p.tp === false ? ", temps partiel" : ""));
      if (p.anc) h += ligneDl("Ancienneté", pl(p.anc, "an", "ans"));
    } else if (p.statut === "chomage" && p.prevProf) h += ligneDl("Dernier emploi", esc(p.prevProf));
    else if (p.statut === "retraite" && p.depuisRet != null) h += ligneDl("Retraite", p.depuisRet < 1 ? "depuis moins d'un an" : "depuis " + pl(p.depuisRet, "an", "ans"));
    h += ligneDl(LIB_REV[p.statut] || "Revenu net mensuel", p.rev ? eur(p.rev) : "Aucun revenu propre");
    (p.autres || []).forEach(function (a) { h += ligneDl(esc(a.lib), eur(a.m) + " par mois"); });
    h += ligneDl("Revenus du foyer", eur(p.foyer) + " net par mois");
    return '<section class="carte-info" aria-labelledby="h-pro"><h2 id="h-pro">' + ICO.dossier + 'Situation professionnelle et revenus</h2><dl class="fiche">' + h + "</dl></section>";
  }
  function carteLogement(c) {
    var l = c.log, fem = c.sexe === "F", h = ligneDl("Logement", esc(genre(S.LIB_LOGEMENT[l.st] || l.st, fem)));
    if (l.st === "locataire") { h += ligneDl("Loyer", eur(l.loyer) + " par mois"); h += ligneDl("Bailleur", esc(l.bailleur) + (l.social ? " (logement social)" : "")); h += ligneDl("Dans le logement depuis", pl(l.depuis, "an", "ans")); }
    else if (l.depuis) h += ligneDl("Propriétaire depuis", pl(l.depuis, "an", "ans"));
    if (l.bien) h += ligneDl("Valeur estimée du bien", eur(l.bien));
    h += ligneDl("Véhicule", c.veh ? (fem ? "La cliente possède un véhicule" : "Le client possède un véhicule") : "Pas de véhicule déclaré");
    return '<section class="carte-info" aria-labelledby="h-log"><h2 id="h-log">' + ICO.maison + 'Logement et mobilité</h2><dl class="fiche">' + h + "</dl></section>";
  }
  var ICO_NON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M7 12h10"/></svg>';
  function carteEquipement(c) {
    var cs = S.contrats(c), h = PR.univers.map(function (f) {
      var l = cs.filter(function (x) { return PR.universDe({ famille: x.famille }) === f; });
      var ext = f.id === "credit" ? c.cre.filter(function (x) { return x.ext; }) : [];
      var det = l.map(function (x) { return esc(nomProduit(x.p)) + " (depuis " + B.dateJours(x.ouvert).getFullYear() + ")"; }).join(", ");
      return '<li class="' + (l.length ? "oui" : "non") + '">' + (l.length ? ICO.check : ICO_NON) +
        "<span><strong>" + esc(f.nom) + "</strong> : " + (l.length ? pl(l.length, "contrat", "contrats") : (ext.length ? "aucun chez GS" : "aucun")) + (det ? "<small>" + det + "</small>" : "") + (ext.length ? "<small>Crédit déclaré dans un autre établissement : " + esc(ext.map(function (x) { return x.ext; }).join(", ")) + "</small>" : "") + "</span></li>";
    }).join("");
    return '<section class="carte-info" aria-labelledby="h-eq"><h2 id="h-eq">' + ICO.check + 'Équipement chez GS Banque & Assurance</h2><ul class="equipement">' + h + "</ul></section>";
  }
  /* ICC : lu sur le client « augmenté » des contrats souscrits dans l'exercice. Non repris dans les documents imprimés (notation interne). */
  function carteIcc(c) {
    var I = window.SGBF.icc, V = window.SGBF.iccVue;
    return I && V ? V.bloc(I.depuisClient(c, store()), { id: "icc", classe: "carte-info", icone: ICO.check }) : "";
  }
  function carteAttention(c) {
    var al = S.alertes(c), op = S.opportunites(c), h = "";
    if (al.length) h += '<ul class="liste-simple">' + al.map(function (a) { return "<li><span><strong>" + esc(a.titre) + "</strong><br>" + esc(a.detail) + "</span></li>"; }).join("") + "</ul>";
    if (op.length) h += '<h3 style="margin:' + (al.length ? "12px" : "0") + ' 0 6px;font-size:14.5px;color:var(--navy)">Opportunités détectées</h3><ul class="liste-simple">' + op.map(function (o) {
      return "<li><span><strong>" + esc(o.titre) + "</strong><br>" + esc(o.detail) + (o.pistes.length ? '<br><span class="opp-pistes"><span>Pistes :</span>' + o.pistes.map(function (p) { return '<span class="piste-chip">' + esc(codeProduit(p)) + "</span>"; }).join("") + "</span>" : "") + "</span></li>";
    }).join("") + "</ul>";
    if (!h) h = '<p class="vide-onglet">Aucun point d\'attention ni opportunité détectée dans le dossier.</p>';
    return '<section class="carte-info" aria-labelledby="h-att"><h2 id="h-att">' + ICO.cloche + "Points d'attention et opportunités</h2>" + h + "</section>";
  }
  function listeProjets(c, avecSuppr) {
    var st = store(), mes = (st.infos[c.id] && st.infos[c.id].projets) || [];
    var base = c.prj.map(function (p) { return "<li><span><strong>" + esc(p.lib) + "</strong><br>" + esc(p.detail ? maj(p.detail) + "." : "") + '</span><span class="droite">' + esc(dansTxt(p.dans)) + "</span></li>"; });
    var perso = mes.map(function (p) {
      var act = "";
      if (avecSuppr) act = "<br>" + (etat.confirmer === "p" + p.id ? '<button type="button" class="btn-texte" data-act="suppr-oui" data-k="p" data-id="' + p.id + '">Confirmer la suppression</button> <button type="button" class="btn-texte" data-act="suppr-non">Annuler</button>' : '<button type="button" class="btn-texte" data-act="suppr" data-k="p" data-id="' + p.id + '" aria-label="Supprimer le projet ' + esc(p.lib) + '">Supprimer</button>');
      return "<li><span><strong>" + esc(p.lib) + '</strong> <span class="puce">Ajouté par vous</span><br>' + esc(p.detail || "") + '</span><span class="droite">' + esc(p.ech || "échéance non précisée") + act + "</span></li>";
    });
    var tout = base.concat(perso);
    return tout.length ? '<ul class="liste-simple">' + tout.join("") + "</ul>" : '<p class="vide-onglet">Aucun projet connu pour le moment.</p>';
  }
  function carteProjets(c) {
    var der = notesFusion(c)[0];
    var h = listeProjets(c, false) + '<p style="margin-top:10px;font-size:14.5px"><strong>Dernier contact :</strong> ' + (der ? fmtDate(der.date) + " – " + esc(der.canal) + ", " + esc(der.objet) : "aucun contact enregistré") + '. <button type="button" class="btn-texte" data-act="tab" data-t="notes">Voir les notes et projets</button></p>';
    return '<section class="carte-info" aria-labelledby="h-prj"><h2 id="h-prj">' + ICO.calendrier + "Projets et dernier contact</h2>" + h + "</section>";
  }
  /* Suite commerciale : ce qui est planifié avec ce client (agenda) et ce qu'il a souscrit pendant l'exercice. Ces données viennent des outils Agenda et Catalogue ; sans eux, la carte n'apparaît pas. */
  function carteSuite(c) {
    var AG = window.SGBF.agenda, K = window.SGBF.catalogue;
    if (!AG || !K) return "";
    var st = store(), a = AG.duClient(st, c.id), souscrits = K.souscriptions(st).filter(function (x) { return x.c === c.id; });
    var h = '<h3 class="sous-titre">Prochains rendez-vous, relances et rappels</h3>';
    h += a.length ? '<ul class="liste-simple">' + a.slice(0, 5).map(function (e) {
      var EQ = window.SGBF.equipe, col = e.kind === "perso" && e.avec && EQ ? EQ.collab(e.avec) : null;
      var nature = e.kind === "agence" ? "Rendez-vous de l'agence" : e.type === "rdv_col" && col ? "Rendez-vous avec " + col.prenom + " " + col.nom + " (" + EQ.posteLib(col).toLowerCase() + ")" : AG.TYPES[e.type].lib;
      return "<li><span><strong>" + esc(nature) + "</strong> – " + esc(e.motif) + (e.canal ? ", " + esc(e.canal.toLowerCase()) : "") + '</span><span class="droite">' + esc(maj(B.JOURS[e.date.getDay()]) + " " + fmtDate(e.date) + (e.heure ? " à " + e.heure : "")) + "</span></li>";
    }).join("") + "</ul>" + (a.length > 5 ? '<p class="mention">+ ' + (a.length - 5) + " autre" + (a.length - 5 > 1 ? "s" : "") + " dans l'agenda.</p>" : "") : '<p class="vide-bloc">Rien de planifié avec ce client.</p>';
    h += '<h3 class="sous-titre">Produits souscrits</h3>';
    var MT = window.SGBF.montage, CTR = window.SGBF.contrats, MIF = window.SGBF.mifid;
    h += souscrits.length ? '<ul class="liste-simple">' + souscrits.map(function (x) {
      var cred = PR.parId[x.p] && PR.parId[x.p].famille === "credit", mt = x.montant !== null && x.montant !== undefined ? (x.montant % 1 === 0 ? eur(x.montant) : eur2(x.montant)) : "", ce = CTR ? CTR.etat(x) : null;
      return "<li><span><strong>" + esc(nomProduit(x.p)) + "</strong>" + (x.options && x.options.enfant ? " – pour " + esc(x.options.enfant) : "") + (mt ? (cred ? " – capital emprunté " : " – versement initial ") + mt : "") + (ce ? '<br><span class="mention">Contrat : ' + esc(ce.libelle) + "</span>" : "") + '</span><span class="droite">' + fmtDate(parseYmd(x.date)) + (cred && x.dossier && MT ? ' <a class="btn-texte" href="montage.html?dossier=' + esc(x.dossier) + '">Voir le dossier</a>' : "") +
        (ce && ce.actions.length ? ' <a class="btn-texte" href="catalogue.html?client=' + c.id + '#bloc-souscriptions" aria-label="Suivre le contrat : ' + esc(nomProduit(x.p)) + '">Suivre le contrat</a>' : "") + "</span></li>";
    }).join("") + "</ul>" : '<p class="vide-bloc">Aucune souscription enregistrée.</p>';
    if (MIF) {
      var pr = MIF.profilClient(st, c), ep = pr ? MIF.etatProfil({ date: pr.date }, B.aujourdhui()) : null;
      h += '<h3 class="sous-titre">Profil investisseur (MIFID)</h3>' + (pr ? "<p>Dernier questionnaire du " + fmtDate(parseYmd(pr.date)) + (pr.origine === "dossier" ? " (établi à l'ouverture de son contrat)" : "") + " : " + (ep.etat === "valable" ? "à jour jusqu'au " + fmtDate(ep.fin) : "à actualiser") + '.</p>' : '<p class="vide-bloc">Aucun questionnaire enregistré : il est obligatoire avant un produit boursier (assurance-vie, PEA, PER).</p>');
    }
    var PRO = window.SGBF.prospects, pgs = PRO ? PRO.parrainagesDe(st, c.id) : [], ods = PRO ? PRO.dossiersDuClient(st, c.id) : [];
    if (ods.length) h += '<h3 class="sous-titre">Ouvertures de compte</h3><ul class="liste-simple">' + ods.map(function (d) { var e = PRO.etat(d); return "<li><span><strong>" + esc(nomProduit(d.fiche.compte)) + "</strong> – " + esc(e.libelle.toLowerCase()) + '</span><span class="droite"><a class="btn-texte" href="prospect.html?dossier=' + d.id + '" aria-label="Ouvrir le dossier ' + esc(d.ref) + '">Dossier ' + esc(d.ref) + "</a></span></li>"; }).join("") + "</ul>";
    if (pgs.length) h += '<h3 class="sous-titre">Parrainages</h3><ul class="liste-simple">' + pgs.map(function (x) { var f = x.dossier.fiche; return "<li><span><strong>" + esc(f.civ + " " + f.prenom + " " + f.nom.toUpperCase()) + "</strong> – " + esc(x.parrainage.libelle.toLowerCase()) + '</span><span class="droite"><a class="btn-texte" href="prospect.html?dossier=' + x.dossier.id + '">Dossier ' + esc(x.dossier.ref) + "</a></span></li>"; }).join("") + "</ul>";
    var dos = MT ? MT.dossiersClient(st, c.id).filter(function (d) { return MT.statutAffiche(st, d) !== "accorde"; }) : [];
    if (dos.length) {
      var LIB_DOS = { brouillon: "en cours", refuse: "refusé", annule: "crédit annulé" };
      h += '<h3 class="sous-titre">Dossiers de crédit</h3><ul class="liste-simple">' + dos.map(function (d) {
        var s2 = MT.statutAffiche(st, d);
        return "<li><span><strong>" + esc(nomProduit(d.p)) + "</strong> – " + LIB_DOS[s2] + (s2 === "brouillon" ? " (étape " + d.etape + " sur 4)" : "") + '</span><span class="droite"><a class="btn-texte" href="montage.html?dossier=' + esc(d.id) + '">Ouvrir</a></span></li>';
      }).join("") + "</ul>";
    }
    h += '<p style="margin-top:10px;display:flex;flex-wrap:wrap;gap:4px 14px"><a class="btn-texte" href="agenda.html?client=' + c.id + '&type=rdv">Planifier un rendez-vous</a><a class="btn-texte" href="agenda.html?client=' + c.id + '&type=rdv_col">Planifier un rendez-vous avec un collègue</a><a class="btn-texte" href="agenda.html?client=' + c.id + '&type=relance">Planifier une relance</a><a class="btn-texte" href="catalogue.html?client=' + c.id + '">Produits et éligibilité</a><a class="btn-texte" href="prospect.html?client=' + c.id + '">Ouvrir un compte</a>' + (MIF ? '<a class="btn-texte" href="mifid.html?client=' + c.id + '">Profil investisseur (MIFID)</a>' : "") + (MT ? '<a class="btn-texte" href="montage.html?client=' + c.id + '">Monter un prêt</a>' : "") + "</p>";
    return '<section class="carte-info" aria-labelledby="h-suite"><h2 id="h-suite">' + ICO.calendrier + "Agenda et souscriptions</h2>" + h + "</section>";
  }
  /* Messages envoyés (simulés) à ce client et campagnes commerciales auxquelles il participe. */
  function carteCom(c) {
    var MS = window.SGBF.messagerie, CA = window.SGBF.campagnes, PH = window.SGBF.phoning, CT = window.SGBF.contacts;
    if (!MS || !CA) return "";
    var st = store(), msgs = MS.duClient(st, c.id), camps = CA.duClient(st, c.id), apps = PH ? PH.duClient(st, c.id) : [];
    var h = '<h3 class="sous-titre">Messages envoyés</h3>';
    h += msgs.length ? '<ul class="liste-simple">' + msgs.slice(0, 5).map(function (x) {
      return "<li><span><strong>" + esc(x.objet) + '</strong><br><span class="mention">' + esc(MS.MODELE[x.m] ? MS.MODELE[x.m].titre : "E-mail") + '</span></span><span class="droite">' + fmtDate(parseYmd(x.date)) + " à " + esc(MS.heureTxt(x.heure)) + "</span></li>";
    }).join("") + "</ul>" + (msgs.length > 5 ? '<p class="mention">+ ' + (msgs.length - 5) + " autre" + (msgs.length - 5 > 1 ? "s" : "") + " dans la messagerie.</p>" : "") : '<p class="vide-bloc">Aucun message envoyé à ce client.</p>';
    if (PH) {
      h += '<h3 class="sous-titre">Appels</h3>';
      h += apps.length ? '<ul class="liste-simple">' + apps.slice(0, 5).map(function (a) {
        return "<li><span><strong>" + esc(PH.RESULTATS[a.res].lib) + '</strong><br><span class="mention">' + esc(nomProduit(a.prod)) + " – " + esc(PH.BASES[a.base].court) + (PH.horsCreneau(a) ? " – hors créneau" : "") + '</span></span><span class="droite">' + fmtDate(parseYmd(a.date)) + " à " + esc(PH.heureLib(a.heure)) + "</span></li>";
      }).join("") + "</ul>" + (apps.length > 5 ? '<p class="mention">+ ' + (apps.length - 5) + " autre" + (apps.length - 5 > 1 ? "s" : "") + " dans le journal des appels.</p>" : "") : '<p class="vide-bloc">Aucun appel enregistré pour ce client.</p>';
      var stop = PH.dernierStop(st, c.id);
      if (stop) h += '<p class="mention"><strong>Ne plus appeler :</strong> le client a demandé le ' + fmtDate(parseYmd(stop.date)) + " à ne plus être appelé.</p>";
    }
    if (CT) {
      var fa = CT.duClient(st, c.id);
      h += '<h3 class="sous-titre">Comptes rendus d\'entretien (CRE)</h3>';
      h += fa.length ? '<ul class="liste-simple">' + fa.slice(0, 5).map(function (x) {
        return "<li><span><strong>" + esc(CT.RESULTATS[x.res].lib) + '</strong><br><span class="mention">' + esc(CT.LIEUX[x.lieu].court) + " – " + esc(nomProduit(x.prod)) + (x.rebond ? " – rebond : " + esc(nomProduit(x.rebond)) : "") + '</span></span><span class="droite">' + fmtDate(parseYmd(x.date)) + " à " + esc(CT.heureLib(x.heure)) + "</span></li>";
      }).join("") + "</ul>" + (fa.length > 5 ? '<p class="mention">+ ' + (fa.length - 5) + " autre" + (fa.length - 5 > 1 ? "s" : "") + " dans le journal des CRE.</p>" : "") : '<p class="vide-bloc">Aucun compte rendu d\'entretien noté pour ce client.</p>';
    }
    h += '<h3 class="sous-titre">Campagnes commerciales</h3>';
    h += camps.length ? '<ul class="liste-simple">' + camps.map(function (x) {
      return '<li><span><strong><a href="campagnes.html?campagne=' + x.campagne.id + '">' + esc(x.campagne.nom) + '</a></strong><br><span class="mention">' + esc(nomProduit(x.campagne.produit)) + " – " + esc(CA.STATUTS[x.statut].toLowerCase()) + '</span></span><span class="droite">' + esc(CA.ETATS[x.etat]) + "</span></li>";
    }).join("") + "</ul>" : '<p class="vide-bloc">Ce client ne fait partie d\'aucune de vos campagnes.</p>';
    h += '<p style="margin-top:10px;display:flex;flex-wrap:wrap;gap:4px 14px"><a class="btn-texte" href="messagerie.html?client=' + c.id + '">Écrire au client</a>' + (PH ? '<a class="btn-texte" href="phoning.html?client=' + c.id + '">Appeler le client</a>' : "") + (CT ? '<a class="btn-texte" href="contacts.html?client=' + c.id + '">Rédiger un CRE</a>' : "") + (ENT ? '<a class="btn-texte" href="#entretien">Préparer l\'entretien</a>' : "") + '</p>';
    return '<section class="carte-info" aria-labelledby="h-com"><h2 id="h-com">' + ICO.courrier + "Messagerie, appels, entretiens et campagnes</h2>" + h + "</section>";
  }
  function carteAnnulations(c) {
    if (!c.ann || !c.ann.length) return "";
    var h = '<ul class="liste-simple">' + c.ann.map(function (a) {
      return "<li><span><strong>" + esc(nomProduit(a.p)) + "</strong> – " + eur(a.montant) + "<br>Vendu le " + fmtDate(B.dateOuvrable(a.vente)) + ", annulé le " + fmtDate(B.dateOuvrable(a.annule)) + "<br>" + esc(a.motif) + "</span></li>";
    }).join("") + "</ul>";
    return '<section class="carte-info" aria-labelledby="h-ann"><h2 id="h-ann">' + ICO.info + "Ventes annulées</h2>" + h + '<p class="mention" style="margin-top:8px">Ces contrats ont été vendus puis annulés : ils ne figurent pas dans l\'équipement du client. Ils comptent dans les ventes brutes de la semaine de la vente, pas dans les ventes nettes.</p></section>';
  }
  /* Réclamations du client : celles à suivre (non clôturées) sont signalées dans l'en-tête, la vue d'ensemble et le libellé de l'onglet. */
  function reclamationsOuvertes(c) { return RC ? RC.ouvertesDuClient(store(), c.id) : []; }
  function carteReclamations(c) {
    var ouv = reclamationsOuvertes(c);
    if (!ouv.length) return "";
    return '<section class="carte-info carte-reclam" aria-labelledby="h-rec"><h2 id="h-rec">' + ICO.alerte + (ouv.length > 1 ? ouv.length + " réclamations à suivre" : "Une réclamation à suivre") + "</h2><ul class=\"liste-simple\">" + ouv.map(function (r) {
      return "<li><span><strong>" + esc(r.ref) + " – " + esc(RC.libelle("theme", r.theme)) + "</strong><br>" + esc(RUI.retourTexte(r)) + "</span></li>";
    }).join("") + '</ul><p style="margin-top:8px"><button type="button" class="btn-texte" data-act="tab" data-t="reclamations">Ouvrir les réclamations de ce client</button></p></section>';
  }
  function panneauReclamations(c) {
    if (!RUI) return "";
    return '<section class="carte-info" aria-labelledby="h-reclam"><div class="bloc-tete"><h2 id="h-reclam">' + ICO.alerte + "Réclamations de ce client</h2>" +
      '<a class="btn btn-principal btn-petit" href="reclamation.html?client=' + c.id + '">Enregistrer une réclamation</a></div>' +
      '<p class="mention" style="margin:0 0 10px">Une réclamation est un mécontentement exprimé par le client. Elle est remise au conseiller gestionnaire et/ou à la directrice d\'agence, qui la traitent.</p>' + RUI.html(c.id) + "</section>";
  }
  /* Renseignements versés au dossier à la validation d'un entretien (loisirs, patrimoine, épargne chez des confrères, véhicule, situation financière). */
  function carteEntretien(c) {
    var EN = window.SGBF.entretien; if (!EN) return "";
    var st = store(), x = EN.entretienDe(st, c.id), g = x ? EN.lignesDossier(c, st) : [];
    if (!g.length) return "";
    return '<section class="carte-info" aria-labelledby="h-ent"><h2 id="h-ent">' + ICO.calendrier + "Renseignements recueillis en entretien</h2>" +
      '<p class="mention">Entretien validé le ' + fmtDate(parseYmd(x.date)) + (x.par ? " par " + esc(x.par) : "") + ".</p>" +
      g.map(function (b) { return '<h3 class="sous-titre">' + esc(b.titre) + '</h3><dl class="fiche">' + b.lignes.map(function (l) { return ligneDl(l.lib, esc(l.val)); }).join("") + "</dl>"; }).join("") + "</section>";
  }
  /* Mesure de protection juridique du client (protection.js) : la carte n'existe que pour les huit clients qui en ont une. */
  function carteProtection(c) {
    var PT = window.SGBF.protection, m = PT && PT.mesure(c);
    if (!m) return "";
    var p = m.protecteur, t = PT.tp;
    return '<section class="carte-info carte-protection" aria-labelledby="h-prot"><h2 id="h-prot">' + ICO.alerte + "Mesure de protection juridique</h2>" +
      '<dl class="fiche">' + ligneDl("Mesure", esc(m.lib)) + ligneDl("Jugement", fmtDate(B.dateJours(m.j)) + ", " + esc(m.juridiction) + " (juge des tutelles)") +
      ligneDl(esc(maj(p.qualite)), esc(p.nomComplet) + ", " + esc(p.lien)) + "</dl>" +
      '<p class="prot-def">' + esc(t(m.def)) + "</p>" +
      '<h3 class="sous-titre">' + esc(t("Ce que la mesure change pour les actes de l'exercice")) + '</h3><ul class="liste-simple prot-actes">' +
      PT.lignes(c).map(function (l) { return "<li><span><strong>" + esc(l.lib) + "</strong><br>" + esc(l.texte) + "</span></li>"; }).join("") + "</ul>" +
      '<p class="mention">' + esc(t("Avant tout acte : demandez la copie du jugement et vérifiez l'identité du protecteur (pratique de l'agence). Règles tirées des pages de service-public.gouv.fr consultées le 17 novembre 2026 ; à revérifier sur Légifrance hors de l'exercice.")) + "</p></section>";
  }
  function panneauVue(c) {
    return '<div class="grille-fiche">' + carteReclamations(c) + carteProtection(c) + carteIdentite(c) + carteFamille(c) + cartePro(c) + carteLogement(c) + carteEntretien(c) + carteEquipement(c) + carteIcc(c) + carteAttention(c) + carteProjets(c) + carteSuite(c) + carteCom(c) + carteAnnulations(c) + "</div>";
  }

  /* ---------- impression et PDF ---------- */
  function sansBoutons(h) { return h.replace(/<button[^>]*>[\s\S]*?<\/button>/g, "").replace(/ aria-labelledby="[^"]*"/g, "").replace(/ id="h-[a-z]+"/g, ""); }
  /* Titulaires du compte courant, « M. Prénom NOM » : le client, puis son conjoint (compte joint) s'il est en couple. */
  function nomsTitulaires(c) {
    var t = [c.civ + " " + c.prenom + " " + c.nom.toUpperCase()];
    RIB.coTitulaires(c).forEach(function (co) { t.push(co.civ + " " + co.prenom + " " + co.nom.toUpperCase()); });
    return t;
  }
  /* Titulaires du compte courant à la date d'un relevé (fin de la période) : avant la désolidarisation du compte joint, les deux cotitulaires ; après, le titulaire qui a gardé le compte
     (le client, ou son ancien cotitulaire). { noms, joint, lien, lib } */
  function titulairesAu(c, fin) {
    var r = RIB.rib(c), d = r.desolidarisation, nom = function (p) { return p.civ + " " + p.prenom + " " + p.nom.toUpperCase(); };
    if (d && B.ymd(fin) < d.date) return { noms: [nom(c), nom(d.cotitulaire)], joint: true, lien: "ou", lib: "compte joint" };
    if (d && d.conserve === "cotitulaire") return { noms: [nom(d.cotitulaire)], joint: false, lien: "ou", lib: "compte individuel" };
    return { noms: nomsTitulaires(c), joint: r.joint, lien: r.lien, lib: RIB.libCompte(r) };
  }
  /* tit : titulaires du compte à la date du relevé (titulairesAu) ; sans lui, le client seul (fiche, synthèse). */
  function blocTitulaire(c, droite, tit) {
    var tt = tit ? tit.noms : [c.civ + " " + c.prenom + " " + c.nom.toUpperCase()], co = tt.length > 1;
    var noms = tt.map(function (t) { return '<p class="nom">' + esc(t) + "</p>"; }).join("");
    return '<div class="dp-deux"><div class="dp-cadre"><h3>' + (co ? "Titulaires du " + tit.lib : "Titulaire") + "</h3>" + noms + "<p>" + esc(c.adr.rue) + "</p><p>" + esc(c.adr.cp) + " " + esc(c.adr.ville) + "</p><p>Numéro client : " + esc(c.num) + '</p></div><div class="dp-cadre">' + droite + "</div></div>";
  }
  function fichierDoc(prefixe, suffixe) { return IMP.nomFichier(prefixe + "_" + client.nom + "_" + client.prenom + (suffixe ? "_" + suffixe : "")); }

  /* Un relevé mensuel imprimable (n = 0 : opérations du mois en cours, non arrêté). */
  function htmlReleve(rc, n) {
    var c = client, f = faitsReleve(rc, n), neg = function (v) { return v < 0 ? ' class="neg"' : ""; };
    var r = RIB.rib(c), tit = titulairesAu(c, f.au);
    var droite = "<h3>Compte</h3><p class=\"nom\">" + esc(nomProduit(c.cpt.p) + (tit.joint ? " – " + tit.lib : "")) + "</p><p>Compte ouvert le " + fmtDate(B.dateOuvrable(c.cpt.ouvert)) + "</p><p>Découvert autorisé : " + (c.cpt.dec ? eur(c.cpt.dec) : "aucun") + "</p>" +
      '<p class="dp-iban-l">IBAN : <span class="dp-iban">' + esc(r.ibanLisible) + "</span></p><p>BIC : " + esc(r.bicLisible) + "</p>";
    var lignes = f.lignes.map(function (l) {
      return "<tr" + (l.cat === "frais" ? ' class="frais"' : "") + '><td class="date">' + fmtDate(l.date) + '</td><td class="lib">' + esc(l.lib) + "</td><td>" + (l.m < 0 ? eur2(-l.m) : "") + "</td><td>" + (l.m > 0 ? eur2(l.m) : "") + "</td><td" + neg(l.solde) + ">" + eur2(l.solde) + "</td></tr>";
    }).join("");
    var ancien = '<tr class="solde-ligne"><td class="date"></td><td class="lib"><strong>' + esc(f.libDebut) + "</strong></td><td></td><td></td><td" + neg(f.debut) + "><strong>" + eur2(f.debut) + "</strong></td></tr>";
    var nouveau = '<tr class="solde-ligne"><td class="date"></td><td class="lib"><strong>Total des mouvements</strong></td><td><strong>' + eur2(f.deb) + "</strong></td><td><strong>" + eur2(f.cre) + "</strong></td><td></td></tr>" +
      '<tr class="solde-ligne"><td class="date"></td><td class="lib"><strong>' + esc(f.libFin) + "</strong></td><td></td><td></td><td" + neg(f.fin) + "><strong>" + eur2(f.fin) + "</strong></td></tr>";
    var corps = blocTitulaire(c, droite, tit) +
      '<dl class="dp-chiffres"><div><dt>' + esc(f.libDebut) + "</dt><dd" + neg(f.debut) + ">" + eur2(f.debut) + "</dd></div><div><dt>Total des débits</dt><dd>" + eur2(f.deb) + "</dd></div><div><dt>Total des crédits</dt><dd>" + eur2(f.cre) + "</dd></div><div><dt>" + esc(f.libFin) + "</dt><dd" + neg(f.fin) + ">" + eur2(f.fin) + "</dd></div></dl>" +
      '<div class="dp-long"><table class="dp-rel"><caption>' + esc(pl(f.lignes.length, "mouvement", "mouvements")) + ', de la plus ancienne à la plus récente</caption><thead><tr><th scope="col" class="g">Date</th><th scope="col" class="g">Opération</th><th scope="col">Débit</th><th scope="col">Crédit</th><th scope="col">Solde</th></tr></thead><tbody>' +
      ancien + (lignes || '<tr><td colspan="5" class="g">Aucun mouvement sur la période.</td></tr>') + nouveau + "</tbody></table></div>" +
      '<p class="dp-mention">' + (f.enCours ? "Situation provisoire : le mois n'est pas terminé, son relevé sera arrêté le " + fmtDate(f.finMois) + ". Ce document n'est pas un relevé de compte. " : "Le nouveau solde de ce relevé est l'ancien solde du relevé suivant. ") + "Les dates sont les dates de comptabilisation (jours ouvrés).</p>";
    var sous = maj(B.libMois(f.m.k)) + " – du " + fmtDate(f.du) + " au " + fmtDate(f.au) + (f.enCours ? " – relevé non arrêté" : "");
    return IMP.document({ titre: f.enCours ? "Opérations du mois en cours" : "Relevé de compte", sous: sous, corps: corps, sansAuteur: true });
  }
  function docReleve() {
    var rc = releve(), n = +etat.mois, f = faitsReleve(rc, n);
    if (f.m.avantOuverture) return null;
    return { html: htmlReleve(rc, n), fichier: fichierDoc(f.enCours ? "Operations_en_cours" : "Releve_compte", B.ymd(B.dateDuMois(f.m.k, 1)).slice(0, 7)) };
  }

  /* Période d'impression saisie par l'étudiant : on imprime le relevé de chaque mois touché par la période (un relevé n'est jamais coupé en cours de mois). */
  function bornesPeriode(rc) { return { min: B.dateDuMois(moisN(rc, NB_RELEVES).k, 1), max: B.aujourdhui() }; }
  function periodeParDefaut(rc) {
    var k0 = rc.mois[rc.mois.length - 1].k;
    return { du: B.ymd(B.dateDuMois(k0 - 3, 1)), au: B.ymd(B.dateDuMois(k0 - 1, 31)) };
  }
  function nomMois(rc, n) { return B.libMois(moisN(rc, n).k).toLowerCase(); }
  function lirePeriode() {
    var rc = releve(), b = bornesPeriode(rc), ouv = rc.brut.ouvertureCompte;
    if (!etat.pDu || !etat.pAu) return { ok: false, champ: etat.pDu ? "p-au" : "p-du", msg: "Choisissez une date de début et une date de fin." };
    var du = parseYmd(etat.pDu), au = parseYmd(etat.pAu);
    if (isNaN(du) || isNaN(au)) return { ok: false, champ: "p-du", msg: "Une des dates n'est pas valide." };
    if (du > au) return { ok: false, champ: "p-au", msg: "La date de fin doit être égale ou postérieure à la date de début." };
    if (du < b.min) return { ok: false, champ: "p-du", msg: "Les relevés disponibles commencent le " + fmtDate(b.min) + ". Choisissez une date de début à partir de cette date." };
    if (au > b.max) return { ok: false, champ: "p-au", msg: "La date de fin ne peut pas être postérieure à aujourd'hui (" + fmtDate(b.max) + ")." };
    var liste = [];
    for (var n = NB_RELEVES; n >= 0; n--) {
      var m = moisN(rc, n);
      if (!m.avantOuverture && B.dateDuMois(m.k, 31) >= du && B.dateDuMois(m.k, 1) <= au) liste.push(n);
    }
    if (!liste.length) return { ok: false, champ: "p-du", msg: "Le compte a été ouvert le " + fmtDate(ouv) + " : il n'y a aucun relevé sur cette période." };
    var clos = liste.filter(function (x) { return x > 0; }), enCours = liste.indexOf(0) >= 0, txt;
    if (!clos.length) txt = "aucun relevé terminé";
    else if (clos.length === 1) txt = "1 relevé mensuel (" + nomMois(rc, clos[0]) + ")";
    else txt = clos.length + " relevés mensuels, de " + nomMois(rc, clos[0]) + " à " + nomMois(rc, clos[clos.length - 1]);
    if (enCours) txt += (clos.length ? ", plus " : ", seulement ") + "les opérations du mois en cours (relevé non arrêté)";
    return { ok: true, liste: liste, clos: clos, enCours: enCours, txt: txt + "." };
  }
  function docReleves() {
    var rc = releve(), p = lirePeriode();
    if (!p.ok) return null;
    var iPremier = p.liste[0], iDernier = p.liste[p.liste.length - 1];
    var ym = function (n) { return B.ymd(B.dateDuMois(moisN(rc, n).k, 1)).slice(0, 7); };
    var fin = ym(iDernier);
    return { html: p.liste.map(function (n) { return htmlReleve(rc, n); }).join(""), fichier: fichierDoc(iDernier === 0 && p.liste.length === 1 ? "Operations_en_cours" : "Releves_compte", p.liste.length === 1 ? ym(iDernier) : ym(iPremier) + "_a_" + fin) };
  }
  function majPeriode() {
    var z = document.getElementById("p-statut"); if (!z) return;
    var p = lirePeriode();
    z.className = "p-statut " + (p.ok ? "ok" : "erreur");
    z.textContent = p.ok ? "Seront imprimés : " + p.txt : p.msg;
  }

  function docSynthese() {
    var c = client, rc = releve(), rs = M.resume(c, 90), auj = B.aujourdhui();
    var lignes = [], totEpa = 0, totPlc = 0, totCrd = 0, totMens = 0;
    function l(prod, ouvert, nature, montant, detail) { lignes.push('<tr><td class="g"><strong>' + esc(prod) + '</strong></td><td>' + (ouvert ? fmtDate(B.dateOuvrable(ouvert)) : "") + '</td><td class="g">' + esc(nature) + "</td><td>" + montant + '</td><td class="g">' + detail + "</td></tr>"); }
    var rj = RIB.rib(c), coj = rj.coTitulaire;
    l(nomProduit(c.cpt.p) + (coj ? " (compte joint)" : ""), c.cpt.ouvert, "Solde du jour", '<span' + (rc.brut.solde < 0 ? ' class="neg"' : "") + ">" + eur2(rc.brut.solde) + "</span>", "Découvert autorisé : " + (c.cpt.dec ? eur(c.cpt.dec) : "aucun") + (coj ? esc((rj.forme === "indivis" ? ". Compte indivis avec " : ". Compte joint avec ") + nomsTitulaires(c).slice(1).join(", ")) : ""));
    c.cartes.forEach(function (x) { l(nomProduit(x.p), x.ouvert, "Carte bancaire", "", "Émise le " + fmtDate(B.dateOuvrable(x.emis))); });
    c.epa.forEach(function (e) {
      totEpa += e.solde; var pl_ = PR.plafond[e.p], d = [];
      if (PR.tauxEvolutif.indexOf(e.p) >= 0) d.push(PR.tauxNewsletter.toLowerCase());
      if (pl_) d.push("plafond " + eur(pl_));
      if (e.vm) d.push("virement permanent " + eur(e.vm) + " le " + e.jv);
      l(nomProduit(e.p), e.ouvert, "Solde", eur(e.solde), esc(d.join(", ")));
    });
    c.plc.forEach(function (e) { totPlc += e.solde; l(nomProduit(e.p), e.ouvert, "Valeur du contrat", eur(e.solde), e.uc != null ? (e.uc ? e.uc + " % en unités de compte" : "fonds en euros") : ""); });
    c.cre.forEach(function (x) {
      var crd = B.crdAu(x); totCrd += crd; totMens += x.mens + (x.assM || 0);
      l((x.ext ? nomProduit(x.p) + " – " + x.ext : nomProduit(x.p)), x.ouvert, "Capital restant dû", eur(crd), esc("emprunté " + eur(x.cap) + " sur " + dureeTxt(x.dur) + ", taux " + pct2(x.taux) + ", mensualité " + eur2(x.mens + (x.assM || 0)) + (x.ext ? " (crédit détenu dans un autre établissement)" : "")));
    });
    c.ass.forEach(function (a) { l(nomProduit(a.p), a.ouvert, "Cotisation mensuelle", eur2(a.prime), "Prélèvement le " + a.jd + " de chaque mois"); });
    var rows = rc.mois.slice().reverse().filter(function (m) { return !m.avantOuverture; }).map(function (m, i) {
      return "<tr><td>" + esc(B.libMois(m.k)) + (i === 0 ? " (en cours, au " + fmtDate(auj) + ")" : "") + "</td><td>" + eur2(m.cre) + "</td><td>" + eur2(m.deb) + "</td><td" + (m.fin < 0 ? ' class="neg"' : "") + ">" + eur2(m.fin) + "</td></tr>";
    }).join("");
    var inc = c.inc.slice().sort(function (a, b) { return a.j - b.j; });
    var droite = "<h3>Situation au " + esc(fmtDate(auj)) + "</h3><p>Client depuis le " + fmtDate(B.dateOuvrable(c.depuis)) + "</p><p>" + ABBR_IBAN.replace(/<abbr[^>]*>|<\/abbr>/g, "") + " du compte courant : " + esc(RIB.rib(c).ibanLisible) + "</p><p>" + pl(S.contrats(c).length, "contrat", "contrats") + " chez GS Banque & Assurance</p><p>Revenus du foyer : " + eur(c.pro.foyer) + " net par mois</p>";
    var corps = blocTitulaire(c, droite) +
      '<section><h2>Comptes et contrats chez GS Banque & Assurance</h2><table><thead><tr><th scope="col" class="g">Produit</th><th scope="col">Ouvert le</th><th scope="col" class="g">Nature du montant</th><th scope="col">Montant</th><th scope="col" class="g">Détail</th></tr></thead><tbody>' + lignes.join("") + "</tbody></table></section>" +
      '<dl class="dp-chiffres"><div><dt>Solde du compte courant</dt><dd' + (rc.brut.solde < 0 ? ' class="neg"' : "") + ">" + eur2(rc.brut.solde) + "</dd></div><div><dt>Épargne bancaire</dt><dd>" + eur(totEpa) + "</dd></div><div><dt>Placements et retraite</dt><dd>" + eur(totPlc) + "</dd></div><div><dt>Capital restant dû (tous crédits)</dt><dd>" + eur(totCrd) + "<small>mensualités : " + eur2(totMens) + "</small></dd></div></dl>" +
      '<section><h2>Compte courant : situation du jour</h2><dl class="dp-chiffres"><div><dt>Solde du jour</dt><dd' + (rc.brut.solde < 0 ? ' class="neg"' : "") + ">" + eur2(rc.brut.solde) + "<small>au " + fmtDate(auj) + "</small></dd></div><div><dt>Solde moyen sur 90 jours</dt><dd>" + eur(rs.moyen) + "<small>de " + eur(rs.min) + " à " + eur(rs.max) + "</small></dd></div><div><dt>Découvert autorisé</dt><dd>" + (c.cpt.dec ? eur(c.cpt.dec) : "Aucun") + "</dd></div><div><dt>Incidents enregistrés</dt><dd>" + inc.length + "</dd></div></dl>" +
      '<div class="graphe">' + graphe(rc, 700) + '</div><p class="dp-legende">Évolution du solde en fin de journée depuis le ' + fmtDate(rc.jours[0].d) + '.</p></section>' +
      '<section class="dp-long"><h2>Récapitulatif mensuel</h2><table><thead><tr><th scope="col" class="g">Mois</th><th scope="col">Crédits</th><th scope="col">Débits</th><th scope="col">Solde de fin de mois</th></tr></thead><tbody>' + rows + "</tbody></table></section>" +
      (inc.length ? '<section><h2>Incidents de fonctionnement</h2><ul class="dp-liste">' + inc.map(function (i) { return "<li>" + esc(i.lib) + " – " + fmtDate(B.dateOuvrable(i.j)) + "</li>"; }).join("") + "</ul></section>" : "");
    return { html: IMP.document({ titre: "Synthèse des comptes", sous: c.civ + " " + c.prenom + " " + c.nom.toUpperCase() + " – " + c.num, corps: corps }), fichier: fichierDoc("Synthese_comptes", B.ymd(auj)) };
  }

  function docFiche() {
    var c = client, nts = notesFusion(c), auj = B.aujourdhui();
    var cartes = carteIdentite(c) + carteFamille(c) + cartePro(c) + carteLogement(c) + carteEquipement(c) + carteAttention(c) + carteProjets(c) + carteAnnulations(c);
    var notes = nts.length ? '<div class="dp-notes">' + nts.map(function (n) {
      return '<article class="note"><div class="note-tete"><span>' + fmtDate(n.date) + "</span><span>" + esc(n.canal) + "</span>" + (n.moi ? "<span>Ajoutée par " + esc(n.par || "l'étudiant") + "</span>" : "") + '</div><p class="note-objet">' + esc(n.objet) + '</p><p class="note-txt">' + esc(n.txt) + "</p></article>";
    }).join("") + "</div>" : '<p class="dp-texte">Aucune note dans le dossier.</p>';
    var corps = '<div class="dp-cartes">' + sansBoutons(cartes) + "</div>" + '<section class="dp-long"><h2>Notes de rendez-vous</h2>' + notes + "</section>";
    return { html: IMP.document({ titre: "Fiche client", sous: c.civ + " " + c.prenom + " " + c.nom.toUpperCase() + " – " + c.num + " – " + c.age + " ans", corps: corps }), fichier: fichierDoc("Fiche_client", B.ymd(auj)) };
  }

  /* RIB : trois exemplaires identiques sur une page A4, à découper (même présentation que les relevés d'identité bancaire remis aux clients). */
  function docRib() {
    var c = client, r = RIB.rib(c), auj = B.aujourdhui();
    function ligne(t) { return "<p>" + esc(t) + "</p>"; }
    function exemplaire() {
      return '<section class="dp-rib-bloc"><div class="dp-rib-haut"><div class="dp-marque"><img src="' + esc(IMP.logo()) + '" width="56" height="56" alt=""><div><p class="dp-banque">GS Banque & Assurance</p><p class="dp-agence">Agence de Paris</p></div></div>' +
        '<div class="dp-rib-titre"><p class="dp-rib-t1">Relevé d\'Identité Bancaire</p><p class="dp-rib-t2">Compte bancaire</p></div></div>' +
        '<div class="dp-rib-corps"><div><h3>' + (r.joint ? "Titulaires du compte" : "Titulaire du compte") + "</h3>" + r.titulaires.map(ligne).join("") + r.adresse.map(ligne).join("") + "<h3>Domiciliation</h3>" + r.domiciliation.map(ligne).join("") + "</div>" +
        '<div><h3>BIC</h3>' + ligne(r.bicLisible) + '<h3>IBAN</h3><p class="dp-rib-iban">' + esc(r.ibanLisible) + "</p><h3>RIB</h3>" +
        '<dl class="dp-rib-cles"><div><dt>Code Banque</dt><dd>' + esc(r.banque) + "</dd></div><div><dt>Code Guichet</dt><dd>" + esc(r.guichet) + "</dd></div><div><dt>N° compte</dt><dd>" + esc(r.compte) + "</dd></div><div><dt>Clé RIB</dt><dd>" + esc(r.cle) + "</dd></div></dl></div></div></section>";
    }
    var coupe = '<div class="dp-rib-coupe" aria-hidden="true">' + ICO.ciseaux + "</div>";
    return { html: '<article class="dp dp-rib">' + exemplaire() + coupe + exemplaire() + coupe + exemplaire() + "</article>", fichier: fichierDoc("RIB", B.ymd(auj)) };
  }
  function imprimerDoc(kind) {
    if (kind === "releves") {
      var pp = lirePeriode();
      if (!pp.ok) { majPeriode(); var ch = document.getElementById(pp.champ); if (ch) ch.focus(); return; }
    }
    var d = kind === "releve" ? docReleve() : kind === "releves" ? docReleves() : kind === "synthese" ? docSynthese() : kind === "rib" ? docRib() : docFiche();
    if (!d) return;
    IMP.imprimer(d.html, d.fichier);
  }

  /* ---------- relevé d'identité bancaire (onglet compte courant) ---------- */
  var ABBR_IBAN = '<abbr title="International Bank Account Number : numéro de compte bancaire international">IBAN</abbr>', ABBR_BIC = '<abbr title="Bank Identifier Code : code qui identifie la banque">BIC</abbr>';
  function blocRib(c) {
    var r = RIB.rib(c);
    return '<h2 class="sous-titre" id="h-rib">Relevé d\'identité bancaire (RIB)</h2><section class="rib-carte" aria-labelledby="h-rib">' +
      '<div class="rib-fiche"><dl><div><dt>' + (r.joint ? "Titulaires du compte" : "Titulaire du compte") + "</dt><dd>" + r.titulaires.map(esc).join("<br>") + "<br>" + esc(r.adresse[0]) + "<br>" + esc(r.adresse[1]) + "</dd></div>" +
      "<div><dt>Domiciliation</dt><dd>" + r.domiciliation.map(esc).join("<br>") + "</dd></div></dl>" +
      "<dl><div><dt>" + ABBR_BIC + "</dt><dd>" + esc(r.bicLisible) + "</dd></div>" +
      "<div><dt>" + ABBR_IBAN + '</dt><dd class="rib-iban" id="rib-iban">' + esc(r.ibanLisible) + "</dd></div></dl></div>" +
      '<dl class="rib-cles"><div><dt>Code banque</dt><dd>' + esc(r.banque) + "</dd></div><div><dt>Code guichet</dt><dd>" + esc(r.guichet) + "</dd></div><div><dt>N° de compte</dt><dd>" + esc(r.compte) + "</dd></div><div><dt>Clé RIB</dt><dd>" + esc(r.cle) + "</dd></div></dl>" +
      '<div class="actions-impr"><button type="button" class="btn btn-secondaire btn-impr" data-act="imprimer" data-doc="rib">' + ICO.imprimante + "<span>Éditer le RIB</span></button>" +
      '<button type="button" class="btn btn-secondaire" data-act="copier-iban">Copier l\'IBAN</button><span class="sous">Le RIB s\'imprime en trois exemplaires sur une page A4, à découper.</span></div>' +
      '<p class="msg-ok" id="rib-ok" role="status"></p></section>';
  }
  function copierIban() {
    var t = RIB.rib(client).ibanLisible, z = document.getElementById("rib-ok");
    function dit(m) { if (z) z.textContent = m; }
    function secours() {
      var ta = document.createElement("textarea"); ta.value = t; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;left:-9999px;top:0";
      document.body.appendChild(ta); ta.select();
      var bon = false; try { bon = document.execCommand("copy"); } catch (e) { bon = false; }
      document.body.removeChild(ta);
      dit(bon ? "IBAN copié : vous pouvez le coller." : "La copie automatique n'a pas fonctionné : sélectionnez l'IBAN affiché et copiez-le.");
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { dit("IBAN copié : vous pouvez le coller."); }, secours); else secours();
  }

  /* ---------- onglet : compte courant ---------- */
  function panneauCompte(c) {
    var rc = releve(), rs = M.resume(c, 90), nomCompte = nomProduit(c.cpt.p);
    var carte = c.cartes.map(function (x) { return nomProduit(x.p); }).join(", "), carteDate = c.cartes.length ? "émise le " + fmtDate(B.dateOuvrable(c.cartes[0].emis)) : "";
    /* Cartes touchées par une opération de service (opposition, changement de gamme) : l'état est rappelé sous le nom. */
    if (OS) {
      var ks = OS.cartes(c, store()), touchees = ks.filter(function (k) { return k.etat !== "active" || k.note; });
      if (ks.length) { carte = ks.map(function (k) { return k.nom + (k.etat !== "active" ? " (" + k.etatLib.toLowerCase() + ")" : ""); }).join(", "); if (touchees.length) carteDate = "voir l'onglet Opérations de service"; }
    }
    /* Compte joint désolidarisé : la situation du compte est rappelée en tête. */
    var des = RIB.rib(c).desolidarisation, avisDes = "";
    if (des) avisDes = '<p class="op-info" role="note">Compte joint désolidarisé le ' + fmtDate(B.lireYmd(des.date)) + " : " + (des.conserve === "client" ? "c'est désormais le compte individuel de " + esc(des.conserveNom) + ", " + esc(des.partantNom) + " n'en est plus titulaire."
      : "c'est désormais le compte individuel de " + esc(des.conserveNom) + ", le client n'en est plus titulaire (la situation ci-dessous est celle du compte à ce jour).") + "</p>";
    var h = avisDes + '<h2 class="sous-titre">' + esc(nomCompte) + " – situation du jour</h2>" +
      '<dl class="tuiles"><div class="tuile"><dt>Solde du jour</dt><dd' + (rc.brut.solde < 0 ? ' class="neg"' : "") + ">" + eur2(rc.brut.solde) + "<small>au " + fmtDate(B.aujourdhui()) + "</small></dd></div>" +
      '<div class="tuile"><dt>Solde moyen sur 90 jours</dt><dd>' + eur(rs.moyen) + "<small>de " + eur(rs.min) + " à " + eur(rs.max) + "</small></dd></div>" +
      '<div class="tuile"><dt>Découvert autorisé</dt><dd>' + (c.cpt.dec ? eur(c.cpt.dec) : "Aucun") + "<small>compte ouvert le " + fmtDate(B.dateOuvrable(c.cpt.ouvert)) + "</small></dd></div>" +
      '<div class="tuile"><dt>Carte bancaire</dt><dd style="font-size:17px">' + esc(carte) + (carteDate ? "<small>" + carteDate + "</small>" : "") + "</dd></div></dl>" +
      blocRib(c) +
      '<h2 class="sous-titre">Évolution du solde</h2><div class="graphe">' + graphe(rc) + '</div><p class="graphe-legende">Solde en fin de journée depuis le ' + fmtDate(rc.jours[0] ? rc.jours[0].d : B.aujourdhui()) + '. La zone grisée correspond au mois choisi dans le relevé ci-dessous.</p>';
    /* récapitulatif mensuel */
    var rows = "", n;
    for (n = 0; n <= NB_RELEVES; n++) {
      var m = moisN(rc, n);
      if (m.avantOuverture) continue;
      rows += '<tr><td><button type="button" class="lien-mois" data-act="mois" data-m="' + n + '">' + esc(B.libMois(m.k)) + (n === 0 ? " (en cours)" : "") + '</button></td><td data-label="Crédits">' + eur2(m.cre) + '</td><td data-label="Débits">' + eur2(m.deb) + '</td><td data-label="Solde de fin de mois" class="' + (m.fin < 0 ? "neg" : "") + '">' + eur2(m.fin) + "</td></tr>";
    }
    h += '<h2 class="sous-titre">Récapitulatif mensuel</h2><div class="rel-tableau"><table class="recap"><caption class="sr">Total des crédits, des débits et solde de fin de mois, pour chacun des 12 derniers relevés et pour le mois en cours</caption><thead><tr><th scope="col">Mois</th><th scope="col">Crédits</th><th scope="col">Débits</th><th scope="col">Solde de fin de mois</th></tr></thead><tbody>' + rows + "</tbody></table></div>";
    /* relevé : un mois à la fois */
    var chips = "";
    for (n = 0; n <= NB_RELEVES; n++) {
      var mc = moisN(rc, n);
      if (mc.avantOuverture) continue;
      chips += '<button type="button" class="mois' + (String(n) === etat.mois ? " est-actif" : "") + '" aria-pressed="' + (String(n) === etat.mois) + '" data-act="mois" data-m="' + n + '">' + esc(MOIS_COURT[mc.k % 12].replace(".", "") + " " + Math.floor(mc.k / 12)) + (n === 0 ? " (en cours)" : "") + "</button>";
    }
    chips = '<span class="rel-mois-lib" id="rel-mois-lib">Mois du relevé :</span>' + chips;
    if (!etat.pDu) { var pd = periodeParDefaut(rc); etat.pDu = pd.du; etat.pAu = pd.au; }
    var bp = bornesPeriode(rc), fm = faitsReleve(rc, +etat.mois), pp = lirePeriode();
    h += '<h2 class="sous-titre">Relevé de compte</h2><div class="releve"><p class="mention" style="margin:0 0 10px">Un relevé couvre un seul mois. Son ancien solde est le nouveau solde du relevé précédent.</p><div class="rel-mois" role="group" aria-label="Mois du relevé">' + chips + "</div>" +
      '<div class="rel-outils"><div class="champ"><label for="f-type">Type de mouvement</label><select id="f-type">' + TYPES.map(function (t) { return '<option value="' + t.id + '"' + (t.id === etat.type ? " selected" : "") + ">" + esc(t.lib) + "</option>"; }).join("") + "</select></div>" +
      '<div class="champ"><label for="f-q">Rechercher dans les libellés</label><input id="f-q" type="search" value="' + esc(etat.q) + '" placeholder="Nom, commerce, mot du libellé" autocomplete="off"></div></div>' +
      '<div id="rel-corps">' + corpsReleve() + "</div>" +
      '<div class="actions-impr"><button type="button" class="btn btn-secondaire btn-impr" data-act="imprimer" data-doc="releve">' + ICO.imprimante + "<span>" + (fm.enCours ? "Imprimer les opérations du mois en cours" : "Imprimer ce relevé") + '</span></button><span class="sous">Tous les mouvements du mois, sans les filtres de l\'écran.</span></div>' +
      '<fieldset class="imp-periode"><legend>Imprimer les relevés d\'une période</legend>' +
      '<div class="imp-dates"><div class="champ"><label for="p-du">Du</label><input type="date" id="p-du" value="' + esc(etat.pDu) + '" min="' + B.ymd(bp.min) + '" max="' + B.ymd(bp.max) + '"></div>' +
      '<div class="champ"><label for="p-au">Au</label><input type="date" id="p-au" value="' + esc(etat.pAu) + '" min="' + B.ymd(bp.min) + '" max="' + B.ymd(bp.max) + '"></div>' +
      '<button type="button" class="btn btn-secondaire btn-impr" data-act="imprimer" data-doc="releves">' + ICO.imprimante + "<span>Imprimer les relevés de la période</span></button></div>" +
      '<p id="p-statut" class="p-statut ' + (pp.ok ? "ok" : "erreur") + '" role="status">' + esc(pp.ok ? "Seront imprimés : " + pp.txt : pp.msg) + "</p>" +
      '<p class="sous">Chaque mois touché par la période donne un relevé complet, avec son ancien et son nouveau solde. Chaque relevé commence sur une nouvelle page. Le relevé du mois en cours n\'est pas arrêté : il est imprimé comme « opérations en cours ».</p></fieldset>' +
      '<p class="mention">Dates de comptabilisation (jours ouvrés). L\'historique est recalculé à partir de la date du jour.</p></div>';
    /* incidents */
    var inc = c.inc.slice().sort(function (a, b) { return a.j - b.j; });
    h += '<h2 class="sous-titre">Incidents de fonctionnement</h2>' + (inc.length ? '<ul class="liste-simple">' + inc.map(function (i) { return "<li><span>" + esc(i.lib) + '</span><span class="droite">' + fmtDate(B.dateOuvrable(i.j)) + "</span></li>"; }).join("") + "</ul>" : '<p class="vide-onglet">Aucun incident enregistré dans le dossier.</p>');
    return h;
  }

  /* ---------- onglet : épargne et placements ---------- */
  function carteContrat(titre, sous, montant, montantLib, details, jauge, jaugeLib) {
    return '<article class="contrat"><div><h3>' + esc(titre) + '</h3><p class="sous">' + sous + '</p></div><p class="montant">' + montant + (montantLib ? "<small>" + montantLib + "</small>" : "") + "</p>" +
      (jauge != null ? '<div class="jauge-fine" role="img" aria-label="' + Math.round(jauge) + " % " + jaugeLib + '" style="grid-column:1/-1"><span style="width:' + Math.max(0, Math.min(100, jauge)).toFixed(1) + '%"></span></div>' : "") +
      (details ? '<dl class="det">' + details.replace(/<dt>([\s\S]*?)<\/dt><dd>([\s\S]*?)<\/dd>/g, "<div><dt>$1</dt><dd>$2</dd></div>") + "</dl>" : "") + "</article>";
  }
  /* Date + n mois (le jour est ramené à la fin du mois si le mois d'arrivée est plus court : 31 janvier + 1 mois = 28 février). */
  function plusMois(d, n) {
    var y = d.getFullYear(), m = d.getMonth() + n, j = d.getDate(), fin = new Date(y, m + 1, 0).getDate();
    return new Date(y, m, Math.min(j, fin));
  }
  /* Produits d'épargne et de placement souscrits pendant l'exercice (catalogue, fiche client) : ils s'ajoutent aux produits du dossier. */
  function souscritsEpargne(c, famille) {
    var K = window.SGBF.catalogue; if (!K) return [];
    return K.souscriptions(store()).filter(function (x) { return x.c === c.id && PR.parId[x.p] && PR.parId[x.p].famille === famille; });
  }
  function carteSouscrit(x, famille) {
    var p = PR.parId[x.p], m = x.montant || 0, o = x.options || {}, d0 = B.lireYmd(x.date), det = ligneDl("Souscrit le", fmtDate(d0)), montantLib = famille === "epargne" ? "solde" : "versement initial";
    if (x.p === "CAT") {
      var ech = plusMois(d0, o.duree), interets = Math.round(m * o.taux / 100 * o.duree / 12 * 100) / 100;
      det += ligneDl("Durée", o.duree + " mois") + ligneDl("Taux fixe brut annuel garanti", String(o.taux).replace(".", ",") + " %") + ligneDl("Échéance", fmtDate(ech)) + ligneDl("Intérêts bruts sur la durée", eur2(interets) + (o.duree >= 24 ? " (versés chaque année sur le compte courant, hors prélèvements)" : " (versés à l'échéance avec le capital, hors prélèvements)"));
    } else if (["PEA", "PEAJ", "PEAPME", "CTO"].indexOf(x.p) >= 0) {
      det += ligneDl("Espèces du compte", eur2(m) + " (versement initial, pas encore investi : les ordres de bourse s'ajoutent plus tard)");
    } else if (famille === "placement" && m) {
      det += ligneDl("Versement initial", eur2(m));
    }
    if (p && p.plafond == null && PR.plafond[x.p]) det += ligneDl("Plafond", eur(PR.plafond[x.p]));
    return carteContrat(nomProduit(x.p), "Souscrit pendant l'exercice. " + esc(p ? p.accroche : ""), eur(m), montantLib, det, null, "");
  }
  function panneauEpargne(c) {
    var tot = 0, tp = 0, h = "", st = store();
    var cartes = c.epa.map(function (e) {
      var solde = OS ? OS.soldeEpargne(c, st, e.p, e.solde) : e.solde;   /* + les virements exécutés depuis le compte courant (onglet « Opérations ») */
      tot += solde;
      var pl_ = PR.plafond[e.p], det = ligneDl("Ouvert le", fmtDate(B.dateOuvrable(e.ouvert)));
      if (solde !== e.solde) { det += ligneDl("Dont virements de l'exercice", "+ " + eur2(solde - e.solde)); }
      if (PR.tauxEvolutif.indexOf(e.p) >= 0) det += ligneDl("Taux annuel", PR.tauxNewsletter + " (taux réglementé)");
      if (pl_) det += ligneDl("Plafond", eur(pl_)) + ligneDl("Capacité de versement", eur(Math.max(0, pl_ - solde)));
      if (e.vm) det += ligneDl("Virement permanent", eur(e.vm) + " le " + e.jv + " de chaque mois");
      return carteContrat(nomProduit(e.p), esc(PR.parId[e.p] ? PR.parId[e.p].accroche : ""), eur(solde), "solde", det, pl_ ? 100 * solde / pl_ : null, "du plafond utilisé");
    }).join("");
    var neufsEpa = souscritsEpargne(c, "epargne");
    neufsEpa.forEach(function (x) { tot += x.montant || 0; cartes += carteSouscrit(x, "epargne"); });
    var plc = c.plc.map(function (e) {
      tp += e.solde;
      var det = ligneDl("Ouvert le", fmtDate(B.dateOuvrable(e.ouvert)));
      if (e.uc != null) det += ligneDl("Part en unités de compte", e.uc ? e.uc + " %" : "Aucune (fonds en euros)");
      return carteContrat(nomProduit(e.p), esc(PR.parId[e.p] ? PR.parId[e.p].accroche : ""), eur(e.solde), "valeur du contrat", det, null, "");
    }).join("");
    var neufsPlc = souscritsEpargne(c, "placement");
    neufsPlc.forEach(function (x) { tp += x.montant || 0; plc += carteSouscrit(x, "placement"); });
    var lienSimu = '<p class="pf-btns" style="margin-top:12px"><a class="btn btn-secondaire" href="epargne.html?client=' + c.id + '">Simuler une épargne pour ce client</a></p>';
    if (!cartes && !plc) return '<p class="vide-onglet">Aucun produit d\'épargne ni de placement chez GS Banque & Assurance. L\'épargne détenue dans d\'autres établissements n\'est connue de la banque que si le client l\'a déclarée.</p>' + lienSimu;
    h += '<dl class="tuiles"><div class="tuile"><dt>Épargne bancaire</dt><dd>' + eur(tot) + "</dd></div><div class=\"tuile\"><dt>Placements et retraite</dt><dd>" + eur(tp) + '</dd></div><div class="tuile"><dt>Total chez GS</dt><dd>' + eur(tot + tp) + '</dd></div><div class="tuile"><dt>Solde moyen sur 90 jours</dt><dd>' + eur(M.resume(c, 90).moyen) + "</dd></div></dl>";
    if (cartes) h += '<h2 class="sous-titre">Épargne bancaire</h2><div class="contrats">' + cartes + "</div>";
    if (plc) h += '<h2 class="sous-titre">Placements et retraite</h2><div class="contrats">' + plc + "</div>";
    return h + '<p class="mention" style="margin-top:12px">Taux et plafonds réglementés en vigueur à l\'automne 2026 (Livret A et LDDS : 1,7 % ; LEP : 2,5 %).</p>' + lienSimu;
  }

  /* ---------- onglet : crédits ---------- */
  function carteCredit(x) {
    var pay = B.echeancesPayees(x), crd = B.crdAu(x), k0 = B.indexMois(B.dateJours(x.ouvert)) + 1;
    var fin = B.dateDuMois(k0 + x.dur - 1, x.jEch);
    var det = ligneDl("Ouvert le", fmtDate(B.dateOuvrable(x.ouvert))) + ligneDl("Capital emprunté", eur(x.cap)) + ligneDl("Durée", dureeTxt(x.dur)) + ligneDl("Taux nominal", pct2(x.taux)) +
      ligneDl("Mensualité hors assurance", eur2(x.mens)) + (x.assM ? ligneDl("Assurance emprunteur", eur2(x.assM) + " par mois") : "") + ligneDl("Prélèvement", "le " + x.jEch + " de chaque mois") +
      ligneDl("Échéances payées", pay + " sur " + x.dur) + ligneDl("Dernière échéance", fmtDate(fin));
    return carteContrat((x.ext ? nomProduit(x.p) + " – " + x.ext : nomProduit(x.p)), x.ext ? "Crédit détenu dans un autre établissement, déclaré par le client." : esc(PR.parId[x.p] ? PR.parId[x.p].accroche : ""), eur(crd), "capital restant dû", det, 100 * pay / x.dur, "des échéances payées");
  }
  /* Crédits accordés pendant l'exercice dans l'outil « Montage de prêt » (souscriptions de crédit). */
  function creditsAccordes(c) {
    var K = window.SGBF.catalogue, MT = window.SGBF.montage; if (!K || !MT) return "";
    var st = store(), L = K.souscriptions(st).filter(function (x) { return x.c === c.id && PR.parId[x.p] && PR.parId[x.p].famille === "credit"; });
    if (!L.length) return "";
    return '<h2 class="sous-titre">Crédits accordés pendant l\'exercice</h2><ul class="liste-simple">' + L.map(function (x) {
      var d = x.dossier ? MT.trouver(st, x.dossier) : null, o = d && d.offre;
      return "<li><span><strong>" + esc(nomProduit(x.p)) + "</strong> – capital emprunté " + eur2(x.montant) + (o ? ", " + dureeTxt(o.dureeMois) + " à " + pct2(o.taux) + ", mensualité assurance comprise " + eur2(o.mensualiteAC) : "") + '</span><span class="droite">' + fmtDate(parseYmd(x.date)) + (d ? ' <a class="btn-texte" href="montage.html?dossier=' + esc(d.id) + '">Voir le dossier</a>' : "") + "</span></li>";
    }).join("") + "</ul>";
  }
  function panneauCredits(c) {
    var lienPret = '<p class="pf-btns" style="margin-top:12px"><a class="btn btn-secondaire" href="pret.html?client=' + c.id + '">Simuler un prêt pour ce client</a>' + (window.SGBF.montage ? '<a class="btn btn-secondaire" href="montage.html?client=' + c.id + '">Monter un prêt pour ce client</a>' : "") + "</p>";
    if (!c.cre.length) return '<p class="vide-onglet">Aucun crédit en cours déclaré à GS Banque & Assurance.</p>' + creditsAccordes(c) + lienPret;
    lienPret = lienPret.replace("</p>", '<a class="btn btn-secondaire" href="suivi_credit.html?client=' + c.id + '">Suivre un crédit de ce client</a></p>');
    var sg = c.cre.filter(function (x) { return !x.ext; }), ext = c.cre.filter(function (x) { return x.ext; });
    var mensSg = 0, mensExt = 0, crdTot = 0;
    sg.forEach(function (x) { mensSg += x.mens + (x.assM || 0); crdTot += B.crdAu(x); });
    ext.forEach(function (x) { mensExt += x.mens + (x.assM || 0); crdTot += B.crdAu(x); });
    var h = '<dl class="tuiles"><div class="tuile"><dt>Mensualités chez GS</dt><dd>' + eur(mensSg) + '</dd></div><div class="tuile"><dt>Mensualités ailleurs (déclarées)</dt><dd>' + eur(mensExt) + '</dd></div><div class="tuile"><dt>Capital restant dû total</dt><dd>' + eur(crdTot) + '</dd></div><div class="tuile"><dt>Mensualités ÷ revenus du foyer</dt><dd>' + (c.pro.foyer ? pctFr(100 * (mensSg + mensExt) / c.pro.foyer) : "–") + "</dd></div></dl>";
    if (sg.length) h += '<h2 class="sous-titre">Crédits chez GS Banque & Assurance</h2><div class="contrats">' + sg.map(carteCredit).join("") + "</div>";
    if (ext.length) h += '<h2 class="sous-titre">Crédits dans un autre établissement (déclarés par le client)</h2><div class="contrats">' + ext.map(carteCredit).join("") + "</div>";
    return h + creditsAccordes(c) + '<p class="mention" style="margin-top:12px">Le HCSF fixe à 35 % des revenus, assurance comprise, le taux d\'effort maximal pour un crédit immobilier.</p>' + lienPret;
  }

  /* ---------- onglet : assurances ---------- */
  function panneauAssurances(c) {
    var intro = '<p class="mention" style="margin-bottom:12px">Les contrats d\'assurance souscrits dans un autre établissement ne sont connus de la banque que si le client les a déclarés.</p>';
    if (!c.ass.length) return intro + '<p class="vide-onglet">Aucun contrat d\'assurance chez GS Banque & Assurance.</p><dl class="fiche" style="margin-top:12px;max-width:520px">' + ligneDl("Logement", esc(genre(S.LIB_LOGEMENT[c.log.st], c.sexe === "F"))) + ligneDl("Véhicule", c.veh ? "Oui" : "Non") + ligneDl("Personnes à charge", String(c.fam.nbCharge)) + "</dl>";
    return intro + '<h2 class="sous-titre">Contrats d\'assurance chez GS Banque & Assurance</h2><div class="contrats">' + c.ass.map(function (a) {
      var det = ligneDl("Souscrit le", fmtDate(B.dateOuvrable(a.ouvert))) + ligneDl("Cotisation", eur2(a.prime) + " par mois") + ligneDl("Prélèvement", "le " + a.jd + " de chaque mois");
      return carteContrat(nomProduit(a.p), esc(PR.parId[a.p] ? PR.parId[a.p].accroche : ""), eur2(a.prime), "par mois", det, null, "");
    }).join("") + "</div>";
  }

  /* ---------- onglet : notes et projets ---------- */
  function notesFusion(c) {
    var st = store(), liste = c.not.map(function (n) { return { date: B.dateContact(n.j), canal: maj(n.canal === "agence" ? "entretien en agence" : n.canal === "téléphone" ? "appel téléphonique" : n.canal), objet: n.objet, txt: n.txt, moi: false }; });
    (st.notes[c.id] || []).forEach(function (n) { liste.push({ date: parseYmd(n.d), canal: n.canal, objet: n.objet, txt: n.txt, par: n.par, id: n.id, moi: true }); });
    liste.sort(function (a, b) { return b.date - a.date; });
    return liste;
  }
  function panneauNotes(c) {
    var nts = notesFusion(c), st = store();
    var auj = dateIso(B.aujourdhui());
    var h = '<h2 class="sous-titre">Projets connus</h2>' + listeProjets(c, true);
    h += '<h2 class="sous-titre">Ajouter un projet</h2><form class="formulaire" id="form-projet" novalidate>' +
      '<div class="ligne ligne-projet"><div class="champ"><label for="p-lib">Projet *</label><input id="p-lib" maxlength="120" autocomplete="off" placeholder="Exemple : achat d\'un véhicule"></div><div class="champ"><label for="p-ech">Échéance prévue</label><input id="p-ech" maxlength="40" autocomplete="off" placeholder="Exemple : été 2027"></div></div>' +
      '<div class="champ"><label for="p-det">Précisions</label><input id="p-det" maxlength="200" autocomplete="off" placeholder="Budget, financement envisagé, contraintes"></div>' +
      '<p class="msg-erreur" id="p-err" role="alert"></p><div><button type="submit" class="btn btn-secondaire">Ajouter le projet</button></div></form>';
    h += '<h2 class="sous-titre">Notes de rendez-vous</h2>';
    h += nts.length ? '<div class="notes">' + nts.map(function (n) {
      return '<article class="note' + (n.moi ? " note-moi" : "") + '"><div class="note-tete"><span>' + fmtDate(n.date) + "</span><span>" + esc(n.canal) + "</span>" + (n.moi ? '<span class="puce">Ajoutée par vous' + (n.par ? " – " + esc(n.par) : "") + "</span>" : "") + '</div><p class="note-objet">' + esc(n.objet) + '</p><p class="note-txt">' + esc(n.txt) + "</p>" +
        (n.moi ? (etat.confirmer === "n" + n.id ? '<span><button type="button" class="btn-texte" data-act="suppr-oui" data-k="n" data-id="' + n.id + '">Confirmer la suppression</button> <button type="button" class="btn-texte" data-act="suppr-non">Annuler</button></span>' : '<button type="button" class="btn-texte" data-act="suppr" data-k="n" data-id="' + n.id + '" aria-label="Supprimer la note du ' + fmtDate(n.date) + '">Supprimer</button>') : "") + "</article>";
    }).join("") + "</div>" : '<p class="vide-onglet">Aucune note dans le dossier.</p>';
    h += '<h2 class="sous-titre">Ajouter une note de rendez-vous</h2><form class="formulaire" id="form-note" novalidate>' +
      '<div class="ligne"><div class="champ"><label for="n-date">Date</label><input id="n-date" type="date" value="' + auj + '" max="' + auj + '"></div>' +
      '<div class="champ"><label for="n-canal">Canal</label><select id="n-canal">' + CANAUX.map(function (x) { return "<option>" + x + "</option>"; }).join("") + "</select></div>" +
      '<div class="champ"><label for="n-par">Rédigée par <span class="aide-champ">(facultatif)</span></label><input id="n-par" maxlength="60" autocomplete="name" value="' + esc(nomConfirme()) + '"></div></div>' +
      '<div class="champ"><label for="n-objet">Objet *</label><input id="n-objet" maxlength="120" autocomplete="off" placeholder="Exemple : bilan de situation"></div>' +
      '<div class="champ"><label for="n-txt">Note *</label><textarea id="n-txt" maxlength="2000" placeholder="Besoins exprimés, informations nouvelles, suite à donner"></textarea></div>' +
      '<p class="msg-erreur" id="n-err" role="alert"></p><div><button type="submit" class="btn btn-principal">Enregistrer la note</button></div></form>' +
      '<p class="msg-ok" id="msg-ok" role="status" tabindex="-1">' + esc(etat.message) + '</p><p class="mention">Les notes et projets ajoutés restent enregistrés dans ce navigateur, sur cet ordinateur. Ils n\'apparaissent pas ailleurs.</p>';
    return h;
  }

  /* ---------- page ---------- */
  function tete(c) {
    var al = S.alertes(c), puces = [];
    puces.push(chip("", "calendrier", "Client depuis " + anneesTxt(c.depuis)));
    if (c.cpt.p === "OCF") puces.push(chip("warn", "info", "Offre clientèle fragile"));
    if (c.cpt.p === "DAC" || c.dac) puces.push(chip("warn", "info", "DAC – droit au compte"));
    al.forEach(function (a) { puces.push(chip(a.code === "DEBITEUR" ? "bad" : "warn", "alerte", a.titre)); });
    var clo = OS && OS.compteQuitteDe ? OS.compteQuitteDe(store(), c.id) : null;
    if (clo) puces.push(chip("bad", "alerte", clo.type === "desolidarisation_compte" ? "Plus titulaire du compte depuis le " + B.fmtDate(B.lireYmd(clo.dateExec || clo.date)) : "Compte clôturé le " + B.fmtDate(B.lireYmd(clo.dateExec || clo.date))));
    var des = RIB.rib(c).desolidarisation;
    if (des && !clo) puces.push(chip("", "info", "Compte désolidarisé le " + B.fmtDate(B.lireYmd(des.date))));
    var sd = OS && OS.compte ? OS.compte(c, store()).satd : null;
    if (sd && sd.avis.length) puces.push(chip("bad", "alerte", "Saisie administrative (SATD) : comptes bloqués jusqu'au " + B.fmtDate(B.lireYmd(sd.jusqu))));
    var nr = reclamationsOuvertes(c).length;
    if (nr) puces.push(chip("bad", "alerte", nr > 1 ? nr + " réclamations à suivre" : "Réclamation à suivre"));
    var rc = releve(), nb = S.contrats(c).length;
    return '<nav class="fil-ariane" aria-label="Fil d\'Ariane"><a href="index.html">' + ICO.retour + "Accueil</a><span aria-hidden=\"true\">/</span><span>Fiche client</span></nav>" +
      '<div class="client-tete"><span class="avatar" aria-hidden="true">' + esc(initiales(c)) + '</span><div><h1 class="client-nom">' + esc(c.civ + " " + c.prenom + " " + c.nom.toUpperCase()) + '</h1><p class="client-sous">' + c.age + " ans – " + esc(c.pro.prof) + " – " + esc(c.adr.ville) + " – " + esc(c.num) + '</p><div class="client-puces">' + puces.join("") + "</div></div>" +
      '<dl class="client-chiffres"><div><dt>Solde du compte</dt><dd' + (rc.brut.solde < 0 ? ' class="neg"' : "") + ">" + eur(rc.brut.solde) + "</dd></div><div><dt>Contrats chez GS</dt><dd>" + nb + "</dd></div></dl></div>" +
      '<div class="actions-impr actions-fiche"><span class="sous">Imprimer ou enregistrer en PDF :</span><button type="button" class="btn-texte btn-impr" data-act="imprimer" data-doc="fiche">' + ICO.imprimante + "<span>La fiche client</span></button>" +
      '<button type="button" class="btn-texte btn-impr" data-act="imprimer" data-doc="synthese">' + ICO.imprimante + "<span>La synthèse des comptes</span></button>" +
      '<button type="button" class="btn-texte btn-impr" data-act="imprimer" data-doc="rib">' + ICO.imprimante + "<span>Le RIB</span></button></div>";
  }
  function panneau(c) {
    if (etat.tab === "compte") return panneauCompte(c);
    if (etat.tab === "operations") return OPUI ? OPUI.html(c) : "";
    if (etat.tab === "epargne") return panneauEpargne(c);
    if (etat.tab === "credits") return panneauCredits(c);
    if (etat.tab === "assurances") return panneauAssurances(c);
    if (etat.tab === "notes") return panneauNotes(c);
    if (etat.tab === "reclamations") return panneauReclamations(c);
    if (etat.tab === "entretien") return ENT.html(c, {});
    if (etat.tab === "courriers") return COUR ? COUR.html(c) : "";
    return panneauVue(c);
  }
  function onglets() {
    return '<div class="onglets onglets-4 onglets-fiche" role="tablist" aria-label="Rubriques de la fiche client">' + TABS.map(function (t) {
      var sel = t.id === etat.tab;
      var nbR = t.id === "reclamations" ? reclamationsOuvertes(client).length : 0;
      return '<button type="button" role="tab" class="onglet" id="tab-' + t.id + '" aria-selected="' + sel + '" aria-controls="panneau" tabindex="' + (sel ? 0 : -1) + '" data-act="tab" data-t="' + t.id + '">' + esc(t.lib) + (nbR ? " (" + nbR + ")" : "") + "</button>";
    }).join("") + "</div>";
  }
  function render(focus) {
    var c = client;
    document.title = "Fiche client – " + nomComplet(c) + " – GS Banque & Assurance";
    app.innerHTML = tete(c) + '<section class="bloc bloc-travail" aria-label="Dossier du client">' + onglets() + '<div class="panneau" id="panneau" role="tabpanel" aria-labelledby="tab-' + etat.tab + '" tabindex="0">' + panneau(c) + "</div></section>";
    if (focus) { var el = typeof focus === "string" ? document.getElementById(focus) : null; if (el) el.focus(); }
  }
  /* Page sans client choisi : les clients à contacter cette semaine, puis la liste de TOUS les clients (sans passer par la recherche), classés par nom, par pages, avec un accès direct par initiale. */
  var PAGE_CLIENTS = 40;
  var liste = { page: 0, lettre: "" };
  var TRIES = null;
  function clientsTries() {
    if (!TRIES) TRIES = CL.slice().sort(function (a, b) { return RECH.norm(a.nom).localeCompare(RECH.norm(b.nom), "fr") || RECH.norm(a.prenom).localeCompare(RECH.norm(b.prenom), "fr") || a.id - b.id; });
    return TRIES;
  }
  function libSituation(c) { var t = (S.LIB_SITUATION && S.LIB_SITUATION[c.fam.sit]) || c.fam.sit || ""; return t.replace(/\(e\)/g, c.sexe === "F" ? "e" : ""); }
  function initiale(c) { var l = RECH.norm(c.nom).charAt(0).toUpperCase(); return /[A-Z]/.test(l) ? l : "#"; }
  function nbPagesClients() { return Math.max(1, Math.ceil(CL.length / PAGE_CLIENTS)); }
  function listeClientsHtml() {
    var tous = clientsTries(), np = nbPagesClients(), pg = Math.max(0, Math.min(np - 1, liste.page)), deb = pg * PAGE_CLIENTS, vue = tous.slice(deb, deb + PAGE_CLIENTS);
    var premiere = {};
    tous.forEach(function (c, i) { var l = initiale(c); if (premiere[l] === undefined) premiere[l] = i; });
    var lettres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(function (l) {
      var dispo = premiere[l] !== undefined, cur = dispo && premiere[l] >= deb && premiere[l] < deb + PAGE_CLIENTS;
      return '<li><button type="button" class="cl-lettre" data-act="cl-lettre" data-l="' + l + '"' + (dispo ? "" : " disabled") + (cur ? ' aria-current="true"' : "") + ' aria-label="Clients dont le nom commence par ' + l + (dispo ? "" : " (aucun)") + '">' + l + "</button></li>";
    }).join("");
    var fin = Math.min(tous.length, deb + PAGE_CLIENTS);
    return '<section class="bloc" id="cl-tous" aria-labelledby="h-cl-tous"><div class="bloc-tete"><h2 id="h-cl-tous">Tous les clients</h2><span class="sous">' + pl(tous.length, "client", "clients") + " du portefeuille, par ordre alphabétique</span></div>" +
      '<nav aria-label="Aller à une initiale"><ul class="cl-lettres">' + lettres + "</ul></nav>" +
      '<div class="tab-wrap" tabindex="0" role="region" aria-label="Liste des clients du portefeuille"><table class="cl-table"><caption class="sr">Clients ' + (deb + 1) + " à " + fin + " sur " + tous.length + ', classés par nom</caption><thead><tr><th scope="col" class="gauche">Client</th><th scope="col" class="gauche">N° client</th><th scope="col">Âge</th><th scope="col" class="gauche">Profession</th><th scope="col" class="gauche">Situation familiale</th></tr></thead><tbody>' +
      vue.map(function (c) {
        return '<tr><th scope="row" class="gauche"><a href="client.html?id=' + c.id + '">' + esc(c.nom.toUpperCase() + " " + c.prenom) + '</a></th><td class="gauche">' + esc(c.num) + "</td><td>" + c.age + ' ans</td><td class="gauche">' + esc((c.pro && c.pro.prof) || "") + '</td><td class="gauche">' + esc(libSituation(c))+ "</td></tr>";
      }).join("") + "</tbody></table></div>" +
      '<div class="cl-pages"><button type="button" class="btn btn-secondaire" data-act="cl-page" data-d="-1"' + (pg === 0 ? " disabled" : "") + '>' + "‹ Page précédente</button>" +
      '<span class="cl-pages-n" id="cl-pages-n">Page ' + (pg + 1) + " sur " + np + " – clients " + (deb + 1) + " à " + fin + '</span><button type="button" class="btn btn-secondaire" data-act="cl-page" data-d="1"' + (pg >= np - 1 ? " disabled" : "") + '>Page suivante ›</button></div>' +
      '<p class="sr" role="status" id="cl-statut">Page ' + (pg + 1) + " sur " + np + ", clients " + (deb + 1) + " à " + fin + ".</p></section>";
  }
  function choixClient() {
    var sem = S.opportunitesSemaine(CL, 8).items;
    document.title = "Fiche client – GS Banque & Assurance";
    app.innerHTML = '<nav class="fil-ariane" aria-label="Fil d\'Ariane"><a href="index.html">' + ICO.retour + "Accueil</a></nav>" +
      '<div class="page-titre"><h1>Fiche client 360°</h1><p>' + (params.get("id") ? "Ce numéro de client n'existe pas. " : "") + "Choisissez un client dans la liste, ou utilisez la recherche en haut de la page (nom, prénom, numéro client ou IBAN).</p></div>" +
      '<section class="bloc" aria-labelledby="h-cl-sem"><h2 id="h-cl-sem">À contacter cette semaine</h2><ul class="liste-simple" style="margin-top:12px;max-width:640px">' +
      sem.map(function (i) { return '<li><span><a href="client.html?id=' + i.client.id + '"><strong>' + esc(nomComplet(i.client)) + "</strong></a><br>" + esc(i.opp.titre) + '</span><span class="droite">' + i.client.age + " ans</span></li>"; }).join("") + "</ul></section>" +
      listeClientsHtml();
  }
  function majListeClients(focus) {
    var z = document.getElementById("cl-tous"); if (!z) return;
    z.outerHTML = listeClientsHtml();
    var f = focus && app.querySelector(focus); if (f) f.focus();
  }

  /* ---------- événements ---------- */
  function changerOnglet(id, focus) {
    etat.tab = id; etat.message = ""; etat.confirmer = null;
    try { history.replaceState(null, "", "#" + id); } catch (e) { /* ignoré */ }
    render(focus ? "tab-" + id : null);
  }
  function majReleve() { var z = document.getElementById("rel-corps"); if (z) z.innerHTML = corpsReleve(); }

  app.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b) return;
    var act = b.getAttribute("data-act");
    if (act === "cl-page") { liste.page = Math.max(0, Math.min(nbPagesClients() - 1, liste.page + parseInt(b.getAttribute("data-d"), 10))); majListeClients('[data-act="cl-page"][data-d="' + b.getAttribute("data-d") + '"]:not([disabled]), #h-cl-tous'); var h2 = document.getElementById("h-cl-tous"); if (h2 && document.activeElement === document.body) { h2.setAttribute("tabindex", "-1"); h2.focus(); } }
    else if (act === "cl-lettre") { var l = b.getAttribute("data-l"), idx = clientsTries().map(initiale).indexOf(l); if (idx >= 0) { liste.page = Math.floor(idx / PAGE_CLIENTS); majListeClients('[data-act="cl-lettre"][data-l="' + l + '"]'); } }
    else if (act === "tab") changerOnglet(b.getAttribute("data-t"), true);
    else if (act === "mois") {
      etat.mois = b.getAttribute("data-m");
      var y = window.scrollY;
      render(); var rel = document.querySelector(".releve"); if (rel && b.closest(".recap")) rel.scrollIntoView({ block: "start" });
      var actif = document.querySelector('.mois[data-m="' + etat.mois + '"]'); if (actif && !b.closest(".recap")) { actif.focus(); window.scrollTo(0, y); }
    }
    else if (act === "imprimer") imprimerDoc(b.getAttribute("data-doc"));
    else if (act === "copier-iban") copierIban();
    else if (act === "suppr") { etat.confirmer = b.getAttribute("data-k") + b.getAttribute("data-id"); render(); var oui = document.querySelector('[data-act="suppr-oui"]'); if (oui) oui.focus(); }
    else if (act === "suppr-non") { etat.confirmer = null; render(); }
    else if (act === "suppr-oui") {
      var st = store(), k = b.getAttribute("data-k"), id = b.getAttribute("data-id");
      if (k === "n") st.notes[client.id] = (st.notes[client.id] || []).filter(function (n) { return n.id !== id; });
      else if (st.infos[client.id]) st.infos[client.id].projets = (st.infos[client.id].projets || []).filter(function (p) { return p.id !== id; });
      B.store.sauver(); etat.confirmer = null; etat.message = k === "n" ? "Note supprimée." : "Projet supprimé."; render("msg-ok");
    }
  });
  app.addEventListener("change", function (e) {
    if (e.target.id === "f-type") { etat.type = e.target.value; majReleve(); }
    else if (e.target.id === "p-du" || e.target.id === "p-au") { if (e.target.id === "p-du") etat.pDu = e.target.value; else etat.pAu = e.target.value; majPeriode(); }
  });
  app.addEventListener("input", function (e) {
    if (e.target.id === "f-q") { etat.q = e.target.value; majReleve(); }
    else if (e.target.id === "p-du" || e.target.id === "p-au") { if (e.target.id === "p-du") etat.pDu = e.target.value; else etat.pAu = e.target.value; majPeriode(); }
  });
  app.addEventListener("keydown", function (e) {
    var t = e.target.closest('[role="tab"]');
    if (!t || ["ArrowLeft", "ArrowRight", "Home", "End"].indexOf(e.key) < 0) return;
    e.preventDefault();
    var i = TABS.map(function (x) { return x.id; }).indexOf(etat.tab);
    if (e.key === "ArrowRight") i = (i + 1) % TABS.length; else if (e.key === "ArrowLeft") i = (i + TABS.length - 1) % TABS.length; else if (e.key === "Home") i = 0; else i = TABS.length - 1;
    changerOnglet(TABS[i].id, true);
  });
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  app.addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target, st = store();
    if (f.id === "form-note") {
      var date = document.getElementById("n-date").value, objet = document.getElementById("n-objet").value.trim(), txt = document.getElementById("n-txt").value.trim(), par = document.getElementById("n-par").value.trim(), canal = document.getElementById("n-canal").value;
      var err = document.getElementById("n-err");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > dateIso(B.aujourdhui())) { err.textContent = "Choisissez une date qui n'est pas dans le futur."; document.getElementById("n-date").focus(); return; }
      if (objet.length < 3) { err.textContent = "Indiquez l'objet de la note (3 caractères au moins)."; document.getElementById("n-objet").focus(); return; }
      if (txt.length < 5) { err.textContent = "Rédigez la note (5 caractères au moins)."; document.getElementById("n-txt").focus(); return; }
      if (!st.notes[client.id]) st.notes[client.id] = [];
      st.notes[client.id].push({ id: uid(), d: date, canal: canal, objet: objet, txt: txt, par: par });
      B.store.sauver(); etat.message = "Note enregistrée dans ce navigateur."; render("msg-ok");
    } else if (f.id === "form-projet") {
      var lib = document.getElementById("p-lib").value.trim(), ech = document.getElementById("p-ech").value.trim(), det = document.getElementById("p-det").value.trim(), perr = document.getElementById("p-err");
      if (lib.length < 3) { perr.textContent = "Indiquez le projet (3 caractères au moins)."; document.getElementById("p-lib").focus(); return; }
      if (!st.infos[client.id]) st.infos[client.id] = {};
      if (!st.infos[client.id].projets) st.infos[client.id].projets = [];
      st.infos[client.id].projets.push({ id: uid(), lib: lib, ech: ech, detail: det });
      B.store.sauver(); etat.message = "Projet ajouté dans ce navigateur."; render("msg-ok");
    }
  });
  var minuterie = null;
  window.addEventListener("resize", function () {
    clearTimeout(minuterie);
    minuterie = setTimeout(function () {
      var z = document.querySelector(".graphe");
      if (client && z && etat.tab === "compte" && Math.abs(Math.max(300, Math.min(760, app.clientWidth - 56)) - largeurGraphe) > 30) z.innerHTML = graphe(releve());
    }, 150);
  });
  /* Une opération de service exécutée ou annulée change le relevé, les cartes et les soldes : la fiche est recalculée. */
  document.addEventListener("sgbf:operation", function () { cache = {}; if (client && etat.tab !== "operations") render(); });
  /* Une réclamation enregistrée, répondue, clôturée, rouverte ou supprimée change l'en-tête et le libellé de l'onglet : la fiche est redessinée au même endroit. */
  document.addEventListener("sgbf:reclamations", function () { if (client) { var y = window.scrollY; render(); window.scrollTo(0, y); } });
  window.addEventListener("hashchange", function () { var h = location.hash.slice(1); if (client && TABS.some(function (t) { return t.id === h; }) && h !== etat.tab) { etat.tab = h; render(); } });

  RECH.init(CL, document.getElementById("rech"), document.getElementById("rech-res"), document.getElementById("rech-statut"));
  if (!client) { choixClient(); return; }
  /* Fiche d'entretien (onglet « Entretien ») : après une mise à jour du dossier ou l'ajout d'un projet, la page est reconstruite (alertes, date de mise à jour, projets). */
  ENT.lier(app, { apresMaj: function () { render("en-ok"); } });
  if (COUR) COUR.lier(app);
  var h0 = location.hash.slice(1);
  if (TABS.some(function (t) { return t.id === h0; })) etat.tab = h0;
  render();
})();
