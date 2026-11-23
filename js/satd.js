/* GS Banque & Assurance – saisie administrative à tiers détenteur (SATD) sur le compte d'un client.
   Une SATD est un avis du comptable public (service des impôts, trésorerie…) qui demande à la banque, « tiers détenteur », de lui verser les sommes qu'elle détient pour le compte d'un redevable
   qui n'a pas payé une dette fiscale ou une somme due à un comptable public. L'avis est notifié en même temps à la banque et au redevable.
   Règles reprises (service-public.gouv.fr, fiche F31716 ; impots.gouv.fr ; Banque de France ; Livre des procédures fiscales, article L262 ; décret n° 2018-1118 du 10 décembre 2018 pour les frais) :
     – la banque a 30 jours pour verser les sommes à l'administration ; le compte saisi est bloqué 15 jours ; les sommes prélevées sont celles présentes sur les comptes à la date de réception de l'avis ;
     – tous les comptes peuvent être saisis (courant, livrets), sauf le compte-titres ; un compte débiteur n'est pas saisi : la somme due ne peut pas y être prélevée ;
     – la banque laisse au redevable, à sa disposition, le solde bancaire insaisissable (SBI), égal au montant du RSA pour une personne seule : 651,69 € depuis le 1er avril 2026 ;
     – dette de moins de 2 000 € : seule la somme due est bloquée ; dette de 2 000 € ou plus : tous les comptes sont bloqués 15 jours (sauf le SBI laissé à disposition) ;
     – frais bancaires : 10 % du montant dû, dans la limite de 100 € TTC par saisie ;
     – seule l'administration décide de la mainlevée et la notifie à la banque, qui rétablit alors le fonctionnement normal des comptes ;
     – le compte joint peut être saisi : chaque cotitulaire est informé et peut demander au juge de l'exécution la mainlevée pour les fonds qui lui appartiennent ;
     – le redevable ou le tiers détenteur peut contester par écrit dans les 2 mois auprès de la DDFIP qui a décidé la saisie.
   Valeurs inventées pour l'exercice (à ne pas confondre avec la loi) : services émetteurs, natures de créance, numéros d'avis ; le seuil de 2 000 € vient de la Banque de France (page « saisies sur compte »).
   Ce module est pur (aucun accès à la page) : calculer(), creer(), mainlevee() travaillent sur la sauvegarde st.satd. Les mouvements d'une saisie (frais le jour de la réception, versement au Trésor
   public à l'issue du blocage) sont repris dans le relevé du client par mouvements.js ; le blocage est pris en compte par operations_service.js (compte().bloque). Les courriers sont dans documents_satd.js. */
(function (root) {
  "use strict";

  var R = root && root.SGBF ? root.SGBF : null;
  function mod(nom, fichier) { return R && R[nom] ? R[nom] : require("./" + fichier); }
  var B = mod("banque", "banque.js"), OS = mod("operations", "operations_service.js"), K = mod("catalogue", "catalogue.js"), PR = mod("produits", "produits.js");

  /* ---------- règles ---------- */
  var SBI = 651.69;                       /* solde bancaire insaisissable : montant du RSA pour une personne seule, 1er avril 2026 (décret 2026-220, d'après impots.gouv.fr) */
  var DELAI_BLOCAGE = 15, DELAI_VERSEMENT = 30;
  var SEUIL_TOUS_COMPTES = 2000;           /* à partir de ce montant dû, tous les comptes sont bloqués (en dessous : la somme due seulement) */
  var FRAIS = { taux: 0.10, plafond: 100 };
  var DU_MAX = 1000000;
  var LIVRETS = ["LA", "LDDS", "LEP", "LJ", "LBR"];
  var SERVICES = [
    ["sip", "Service des impôts des particuliers (SIP)"],
    ["sie", "Service des impôts des entreprises (SIE)"],
    ["sgc", "Service de gestion comptable (SGC) ou trésorerie"],
    ["hopital", "Trésorerie hospitalière ou établissement public de santé"]
  ];
  var NATURES = [
    ["ir", "Impôt sur le revenu"],
    ["foncier", "Taxe foncière"],
    ["habitation", "Taxe d'habitation sur les résidences secondaires"],
    ["amende", "Amende ou condamnation pécuniaire"],
    ["local", "Somme due à une collectivité ou à un hôpital public (cantine, frais d'hospitalisation…)"]
  ];
  function lib(liste, k) { var x = liste.filter(function (y) { return y[0] === k; })[0]; return x ? x[1] : ""; }
  function r2(n) { return Math.round(n * 100 + 1e-9) / 100; }
  function E(champ, msg) { return { champ: champ, msg: msg }; }
  function txt(v) { return String(v == null ? "" : v).replace(/\s+/g, " ").trim(); }

  /* Frais bancaires : 10 % du montant dû, 100 € au plus. */
  function frais(du) { return r2(Math.min(du * FRAIS.taux, FRAIS.plafond)); }

  function liste(st, cid) { return (st && Array.isArray(st.satd) ? st.satd : []).filter(function (s) { return cid == null || s.c === cid; }); }
  /* Une saisie bloque les comptes de sa réception (incluse) au jour du versement (exclu). */
  function enCours(s, ymd) { return s.statut === "bloque" && ymd >= s.debut && ymd < s.versement; }
  function actives(st, cid, auj) { var y = B.ymd(auj || B.aujourdhui()); return liste(st, cid).filter(function (s) { return enCours(s, y); }); }
  /* Situation d'une saisie à une date : bloquée (en cours), versée au Trésor, sans effet (rien à saisir) ou levée (mainlevée). */
  function etat(s, auj) {
    var y = B.ymd(auj || B.aujourdhui());
    if (s.statut === "mainlevee") return { code: "mainlevee", libelle: "Mainlevée reçue le " + B.fmtDate(B.lireYmd(s.mainlevee.date)), ton: "info" };
    if (s.statut === "sans_effet") return { code: "sans_effet", libelle: "Sans effet : rien à saisir", ton: "info" };
    if (y < s.versement) return { code: "bloque", libelle: "Comptes bloqués jusqu'au " + B.fmtDate(B.lireYmd(s.versement)), ton: "warn" };
    return { code: "verse", libelle: "Versée au Trésor public le " + B.fmtDate(B.lireYmd(s.versement)), ton: "ok" };
  }

  /* Comptes saisissables du client : compte courant et livrets, avec leur solde au jour de la réception, diminué des sommes déjà réservées par une autre saisie en cours. */
  function comptes(c, st, auj) {
    var y = B.ymd(auj), cpt = OS.compte(c, st), reserve = {};
    liste(st, c.id).forEach(function (s) { if (enCours(s, y)) (s.calcul.prelevements || []).forEach(function (p) { reserve[p.compte] = r2((reserve[p.compte] || 0) + p.montant); }); });
    var l = [{ id: "cpt", nom: "Compte courant", solde: cpt.solde, reserve: reserve.cpt || 0 }];
    K.contexte(c, st).epa.forEach(function (e) {
      if (LIVRETS.indexOf(e.p) < 0) return;
      l.push({ id: e.p, nom: PR.parId[e.p] ? PR.parId[e.p].nom : e.p, solde: OS.soldeEpargne(c, st, e.p, e.solde || 0), reserve: reserve[e.p] || 0 });
    });
    l.forEach(function (x) { x.libre = r2(x.solde - x.reserve); x.credit = Math.max(0, x.libre); });
    return l;
  }

  /* Calcul d'une saisie pour un client. v : { avis, service, nature, du }. Renvoie { ok, erreurs, calcul }. Le calcul suit l'ordre de l'exercice :
     1. soldes créditeurs au jour de la réception (un compte débiteur ne compte pas) ; 2. le SBI est laissé à disposition (d'abord sur le compte courant) ; 3. somme saisissable = le reste ;
     4. montant versé au Trésor = le plus petit de la dette et de la somme saisissable (pris d'abord sur le compte courant, puis sur les livrets) ; 5. blocage : la somme due seulement (dette < 2 000 €)
     ou tous les comptes (2 000 € ou plus), le SBI restant disponible ; 6. frais : 10 % de la dette, 100 € au plus. */
  function calculer(c, st, v, auj) {
    v = v || {}; auj = auj || B.aujourdhui();
    var erreurs = [], y = B.ymd(auj), clo = OS.compteQuitteDe ? OS.compteQuitteDe(st, c.id) : null;
    if (clo) return { ok: false, erreurs: [E("", OS.messageQuitte(clo) + " : il n'y a plus de compte à saisir.")], calcul: null };
    var avis = txt(v.avis), du = OS.lireM ? OS.lireM(v.du) : NaN;
    if (!/^[A-Za-z0-9][A-Za-z0-9 \-\/.]{3,29}$/.test(avis)) erreurs.push(E("avis", "Saisissez le numéro de l'avis à tiers détenteur tel qu'il figure sur l'avis (4 à 30 caractères : lettres, chiffres, tirets), par exemple SATD-2026-04417."));
    else if (liste(st).some(function (s) { return s.c === c.id && s.avis.toLowerCase() === avis.toLowerCase() && s.statut !== "mainlevee"; })) erreurs.push(E("avis", "Cet avis (" + avis + ") est déjà enregistré pour ce client : une même saisie ne s'enregistre qu'une fois."));
    if (!lib(SERVICES, v.service)) erreurs.push(E("service", "Choisissez le service qui a émis l'avis : il figure en tête de l'avis."));
    if (!lib(NATURES, v.nature)) erreurs.push(E("nature", "Choisissez la nature de la créance réclamée (impôt, amende…)."));
    if (v.du == null || String(v.du).trim() === "") erreurs.push(E("du", "Saisissez le montant dû à l'administration, tel qu'il figure sur l'avis."));
    else if (isNaN(du)) erreurs.push(E("du", "Saisissez le montant en euros, par exemple 1 250,50."));
    else if (du <= 0) erreurs.push(E("du", "Le montant dû doit être supérieur à zéro."));
    else if (du > DU_MAX) erreurs.push(E("du", "Ce montant n'est pas plausible : vérifiez-le sur l'avis (" + B.eur(DU_MAX) + " au plus dans cet exercice)."));
    if (erreurs.length) return { ok: false, erreurs: erreurs, calcul: null };

    var cs = comptes(c, st, auj), reste = SBI, total = 0, sais = 0;
    cs.forEach(function (x) { total = r2(total + x.credit); var g = Math.min(x.credit, reste); reste = r2(reste - g); x.garde = r2(g); x.saisissable = r2(x.credit - g); sais = r2(sais + x.saisissable); });
    var aVerser = r2(Math.min(du, sais)), tous = du >= SEUIL_TOUS_COMPTES, rest = aVerser, prelevements = [];
    cs.forEach(function (x) { var p = r2(Math.min(x.saisissable, rest)); x.preleve = p; rest = r2(rest - p); if (p > 0) prelevements.push({ compte: x.id, nom: x.nom, montant: p }); });
    var cpt = cs[0], bloqueCourant = aVerser <= 0 ? 0 : tous ? cpt.saisissable : cpt.preleve;
    var f = frais(du), alertes = [];
    var apres = r2(OS.compte(c, st).solde - (prelevements.filter(function (p) { return p.compte === "cpt"; })[0] || { montant: 0 }).montant - f);
    if (apres < -(OS.compte(c, st).decouvert || 0) - 0.005) alertes.push("Les frais (" + B.eur2(f) + ") et le versement portent le compte courant à " + B.eur2(apres) + ", au-delà du découvert autorisé : prévenez le client.");
    else if (apres < 0) alertes.push("Après le versement et les frais, le compte courant sera débiteur de " + B.eur2(-apres) + " (dans la limite du découvert autorisé).");
    var raison = aVerser > 0 ? "" : total <= 0 ? "debiteur" : "sbi";
    var recu = y, versement = B.ymd(B.plusJours(auj, DELAI_BLOCAGE)), limite = B.ymd(B.plusJours(auj, DELAI_VERSEMENT));
    var calcul = {
      comptes: cs.map(function (x) { return { id: x.id, nom: x.nom, solde: x.solde, reserve: x.reserve, credit: x.credit, garde: x.garde, saisissable: x.saisissable, preleve: x.preleve }; }),
      total: total, sbi: SBI, gardeSbi: r2(SBI - reste), saisissable: sais, du: du, aVerser: aVerser, reste: r2(du - aVerser), mode: tous ? "tous" : "montant", bloqueCourant: r2(bloqueCourant),
      prelevements: prelevements, frais: f, raison: raison, alertes: alertes, recu: recu, versement: versement, limite: limite, plafonne: du * FRAIS.taux > FRAIS.plafond
    };
    return { ok: true, erreurs: [], calcul: calcul, v: { avis: avis, service: v.service, nature: v.nature, du: du } };
  }

  /* Enregistre la saisie : le client est informé, les comptes sont bloqués, les frais sont débités et le versement est programmé. Renvoie { ok, saisie } ou { ok: false, erreurs }. */
  function creer(st, c, v) {
    var auj = B.aujourdhui(), r = calculer(c, st, v, auj);
    if (!r.ok) return r;
    if (!Array.isArray(st.satd)) st.satd = [];
    var k = r.calcul, an = String(auj.getFullYear()), n = st.satd.filter(function (s) { return s.ref.indexOf("SATD-" + an) === 0; }).length + 1;
    var now = B.maintenant(), cpt = k.prelevements.filter(function (p) { return p.compte === "cpt"; })[0], ep = k.prelevements.filter(function (p) { return p.compte !== "cpt"; });
    var mv = [{ ymd: k.recu, kind: "frais", lib: "Frais de saisie administrative à tiers détenteur (avis " + r.v.avis + ")", m: r2(-k.frais) }];
    if (cpt) mv.push({ ymd: k.versement, kind: "virement", lib: "Saisie administrative à tiers détenteur – versement au Trésor public (avis " + r.v.avis + ")", m: r2(-cpt.montant) });
    var s = {
      id: "s" + now.getTime().toString(36) + Math.random().toString(36).slice(2, 5), ref: "SATD-" + an + "-" + (n < 10 ? "000" : n < 100 ? "00" : "0") + n, c: c.id,
      date: k.recu, heure: B.hhmm(now), par: (st.eleve && st.eleve.nom) || "", avis: r.v.avis, service: r.v.service, nature: r.v.nature, du: r.v.du,
      debut: k.recu, versement: k.versement, limite: k.limite, statut: k.aVerser > 0 ? "bloque" : "sans_effet", calcul: k, mv: mv,
      mvEp: ep.map(function (p) { return { p: p.compte, ymd: k.versement, m: r2(-p.montant) }; })
    };
    st.satd.push(s);
    try { (R && R.mouvements ? R.mouvements : require("./mouvements.js")).viderCache(); } catch (e) { /* pas de cache à vider */ }
    return { ok: true, saisie: s, calcul: k };
  }
  function trouver(st, id) { return liste(st).filter(function (s) { return s.id === id || s.ref === id; })[0] || null; }
  /* Mainlevée notifiée par l'administration : le blocage cesse et le versement prévu n'a plus lieu ; les frais restent dus à la banque. Possible tant que les sommes n'ont pas été versées. */
  function mainlevee(st, id) {
    var s = trouver(st, id), auj = B.aujourdhui(), y = B.ymd(auj);
    if (!s) return { ok: false, erreur: "Saisie introuvable." };
    if (s.statut === "mainlevee") return { ok: false, erreur: "La mainlevée de cette saisie est déjà enregistrée." };
    if (s.statut === "sans_effet") return { ok: false, erreur: "Cette saisie est sans effet : aucun compte n'a été bloqué, il n'y a rien à lever." };
    if (y >= s.versement) return { ok: false, erreur: "Les sommes ont déjà été versées au Trésor public le " + B.fmtDate(B.lireYmd(s.versement)) + " : la mainlevée n'a plus d'objet pour la banque, le redevable s'adresse à l'administration." };
    s.statut = "mainlevee"; s.mainlevee = { date: y, heure: B.hhmm(B.maintenant()) };
    s.mv = s.mv.filter(function (x) { return x.kind !== "virement"; }); s.mvEp = [];
    try { (R && R.mouvements ? R.mouvements : require("./mouvements.js")).viderCache(); } catch (e) { /* pas de cache à vider */ }
    return { ok: true, saisie: s };
  }
  /* Blocage du compte courant d'un client à une date : { montant, tous, jusqu, saisies }. */
  function blocage(st, cid, auj) {
    var r = { montant: 0, tous: false, jusqu: "", saisies: [] };
    actives(st, cid, auj).forEach(function (s) { r.montant = r2(r.montant + (s.calcul.bloqueCourant || 0)); r.tous = r.tous || s.calcul.mode === "tous"; r.saisies.push(s); if (s.versement > r.jusqu) r.jusqu = s.versement; });
    return r;
  }

  var api = {
    SBI: SBI, DELAI_BLOCAGE: DELAI_BLOCAGE, DELAI_VERSEMENT: DELAI_VERSEMENT, SEUIL_TOUS_COMPTES: SEUIL_TOUS_COMPTES, FRAIS: FRAIS, DU_MAX: DU_MAX, SERVICES: SERVICES, NATURES: NATURES, LIVRETS: LIVRETS,
    lib: lib, frais: frais, liste: liste, actives: actives, etat: etat, comptes: comptes, calculer: calculer, creer: creer, trouver: trouver, mainlevee: mainlevee, blocage: blocage
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.satd = api; }
})(typeof window !== "undefined" ? window : null);
