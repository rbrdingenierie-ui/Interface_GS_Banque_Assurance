/* GS Banque & Assurance – outil « Ordres de bourse » : règles et calculs (sans affichage). Le conseiller reçoit la demande d'un client titulaire d'un PEA (achat ou vente de titres), choisit de transmettre l'ordre
   ou de ne pas le transmettre, puis compose l'ordre : compte, type d'ordre, quantité, limite ou seuil de prix, durée de validité. L'outil vérifie l'ordre, le confronte au carnet d'ordres (cours de la séance du
   17 novembre 2026 vers 15 h) et produit l'avis d'opéré simulé : prix d'exécution, courtage, taxe sur les transactions financières, espèces après l'opération, date de règlement-livraison.

   Sources (consultées le 17 novembre 2026) :
   - AMF, « Choisir et passer un ordre de bourse : ce qu'il faut savoir » : types d'ordres (au marché, à la meilleure limite, à cours limité, à seuil de déclenchement, à plage de déclenchement), priorité par le prix puis
     par le temps, contenu d'un ordre (sens, valeur, quantité, type, limite, validité), durées de validité (« jour » par défaut, « à date déterminée », « à révocation » valable 365 jours), règlement-livraison jusqu'à
     deux jours de négociation, obligation de renseigner le questionnaire (une réponse incomplète déclenche une alerte sans empêcher la transmission de l'ordre) ;
   - AMF, journal de bord du médiateur (3 novembre 2022) : un teneur de compte peut rejeter un ordre dont la limite est trop éloignée du dernier cours (« ordre aberrant ») ; aucun seuil général n'est fixé ;
   - Les clés de la banque, « Le fonctionnement de la Bourse de Paris » (23 juin 2026) : pré-ouverture de 7 h 15 à 9 h 00, négociation continue de 9 h 00 à 17 h 30, fixing de clôture jusqu'à 17 h 35 ;
   - BOFiP BOI-RPPM-RCM-40-50-20-20 (version du 26 octobre 2026) : le compte espèces du PEA ne peut pas présenter de solde débiteur (§ 40) ; titres éligibles : sociétés ayant leur siège dans l'Union européenne ou dans
     l'Espace économique européen (§ 110, 260), parts d'OPC investis à plus de 75 % en titres éligibles (§ 380, 400) ;
   - AMF, « PEA : tout savoir sur le plan d'épargne en actions » : la vente à découvert et le service à règlement différé (SRD) ne sont pas possibles dans un PEA ;
   - article 235 ter ZD du Code général des impôts (texte lu sur un site de reproduction, non sur Légifrance) : taxe de 0,4 % sur l'acquisition de titres de capital de sociétés ayant leur siège en France et une
     capitalisation supérieure à un milliard d'euros au 1er décembre de l'année précédente, depuis le 1er avril 2025 ; la taxe est due par le prestataire qui exécute l'ordre d'achat. Le texte lu est indiqué en vigueur
     jusqu'au 31 décembre 2026 : à revérifier avant 2027 ;
   - AMF, « Le règlement-livraison T+1 » : délai actuel T+2 ; passage à T+1 le 11 octobre 2027 ;
   - Euronext Clearing, calendrier 2026 : jours de fermeture (1er janvier, 3 avril, 6 avril, 1er mai, 25 décembre). Le calendrier des marchés lui-même n'a pas été relu ;
   - tarifs de GS : courtage de 0,60 % par ordre (minimum 2,50 € sur un PEA, 8 € sur un compte-titres ordinaire), repris du catalogue des produits.
   Conventions de l'exercice (aucune règle officielle) : pas de cotation de 0,01 € ; refus de l'ordre au marché sur une valeur peu liquide ; ordre « aberrant » si une limite ou un seuil s'écarte de plus de 20 % du dernier
   cours ; durée maximale d'un ordre à date déterminée de 365 jours ; fonds non soumis à la taxe sur les transactions financières ; couverture d'un ordre au marché calculée sur le carnet. Le plafond de versements du PEA
   n'est pas contrôlé : il concerne les versements d'espèces, non les achats de titres. */
(function (root) {
  "use strict";

  var B = root && root.SGBF ? root.SGBF.banque : require("./banque.js");
  var D = root && root.SGBF ? root.SGBF.dataOrdres : require("./data_ordres.js");
  var CLIENTS = (root && root.SGBF && root.SGBF.clients) ? root.SGBF.clients : require("./data_clients.js").clients;
  var VALEURS = D.VALEURS, DEMANDES = D.DEMANDES;

  var TARIF = { PEA: { taux: 0.006, min: 2.5 }, CTO: { taux: 0.006, min: 8 } };
  var TTF = { taux: 0.004, capiMin: 1000 };
  var CONV = { pas: 0.01, aberrant: 0.20, validiteMax: 365 };
  var SEANCE = { preouverture: [435, 540], continu: [540, 1050], cloture: [1050, 1055] };      /* en minutes depuis minuit : 7 h 15, 9 h 00, 17 h 30, 17 h 35 */
  var FERMES = ["2026-01-01", "2026-04-03", "2026-04-06", "2026-05-01", "2026-12-25"];
  var JOURS_REGLEMENT = 2;

  var TYPES = [
    { id: "marche", lib: "Ordre au marché", sous: "Exécuté tout de suite, au meilleur prix disponible, sans aucune maîtrise du prix.", limite: false, seuil: false, garantit: false },
    { id: "meilleure_limite", lib: "Ordre à la meilleure limite", sous: "Exécuté au meilleur prix du carnet ; le solde éventuel devient un ordre à cours limité à ce prix.", limite: false, seuil: false, garantit: false },
    { id: "cours_limite", lib: "Ordre à cours limité", sous: "Prix maximal à l'achat, minimal à la vente : le prix est maîtrisé, l'exécution n'est pas garantie.", limite: true, seuil: false, garantit: true },
    { id: "seuil", lib: "Ordre à seuil de déclenchement", sous: "Ordre « stop » : devient un ordre au marché quand le cours atteint le seuil ; le prix d'exécution n'est pas maîtrisé.", limite: false, seuil: true, garantit: false },
    { id: "plage", lib: "Ordre à plage de déclenchement", sous: "Devient un ordre à cours limité quand le cours atteint le seuil ; deux prix à fixer : le seuil et la limite.", limite: true, seuil: true, garantit: true }
  ];
  var VALIDITES = [
    { id: "jour", lib: "Jour", sous: "Valable pour la séance en cours seulement (durée par défaut)." },
    { id: "date", lib: "À date déterminée", sous: "Valable jusqu'à la date choisie, 365 jours au plus (convention de GS)." },
    { id: "revocation", lib: "À révocation", sous: "Valable 365 jours, sauf annulation." }
  ];
  var COMPTES = [{ id: "PEA", lib: "PEA" }, { id: "CTO", lib: "Compte-titres ordinaire" }];
  var MOTIFS = [
    { id: "non_eligible_pea", lib: "Titre non éligible au PEA, et le client n'a pas de compte-titres ordinaire" },
    { id: "couverture", lib: "Espèces insuffisantes, même pour un seul titre" },
    { id: "titres", lib: "Le client ne détient aucun titre à vendre" }
  ];
  var ORIENTATIONS = [
    { id: "ouvrir_cto", lib: "Proposer l'ouverture d'un compte-titres ordinaire" },
    { id: "titre_eligible", lib: "Proposer un titre éligible au PEA" },
    { id: "alimenter", lib: "Proposer d'alimenter le compte espèces du PEA" },
    { id: "aucune", lib: "Aucune proposition" }
  ];
  var LIQUIDITE = { elevee: "élevée", moyenne: "moyenne", faible: "faible" };
  var CANAUX = { agence: "Demande faite à l'agence", telephone: "Demande faite par téléphone", messagerie: "Demande faite par la messagerie de la banque" };

  function type(id) { return TYPES.filter(function (x) { return x.id === id; })[0] || null; }
  function validite(id) { return VALIDITES.filter(function (x) { return x.id === id; })[0] || null; }
  function valeur(id) { return VALEURS.filter(function (x) { return x.id === id; })[0] || null; }
  function trouver(id) { return DEMANDES.filter(function (x) { return x.id === id; })[0] || null; }
  function traitement(st, id) { return st && st.ordresBourse && st.ordresBourse[id] ? st.ordresBourse[id] : null; }
  function arrondi(x) { return Math.round((x + 1e-9) * 100) / 100; }
  function eur(x) { return String(arrondi(x).toFixed(2)).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " €"; }
  function prixTxt(x) { return String(Number(x).toFixed(2)).replace(".", ",") + " €"; }
  function plural(n, s, p) { return n + " " + (n > 1 ? p : s); }

  /* ---------- nombres saisis : « 12,40 », « 12.4 » ---------- */
  function nombre(x) {
    if (x == null || String(x).trim() === "") return null;
    var t = String(x).replace(/[\s  ]/g, "").replace(",", "."); if (!/^\d+(\.\d+)?$/.test(t)) return NaN;
    return Number(t);
  }
  function estPrix(p) { return typeof p === "number" && isFinite(p) && p > 0 && Math.abs(Math.round(p * 100) - p * 100) < 1e-6; }

  /* ---------- séance de Bourse ---------- */
  function ferme(d) { var j = d.getDay(); return j === 0 || j === 6 || FERMES.indexOf(B.ymd(d)) >= 0; }
  function seance(maintenant) {
    var n = maintenant || B.maintenant(), m = n.getHours() * 60 + n.getMinutes(), S = SEANCE;
    if (ferme(n)) return { phase: "ferme", lib: "Bourse fermée", continu: false };
    if (m >= S.preouverture[0] && m < S.preouverture[1]) return { phase: "preouverture", lib: "Pré-ouverture : les ordres sont enregistrés, sans être exécutés", continu: false };
    if (m >= S.continu[0] && m < S.continu[1]) return { phase: "continu", lib: "Négociation continue", continu: true };
    if (m >= S.cloture[0] && m < S.cloture[1]) return { phase: "cloture", lib: "Fixing de clôture : les ordres sont enregistrés, sans exécution immédiate", continu: false };
    return { phase: "ferme", lib: "Bourse fermée", continu: false };
  }
  /* Date de règlement-livraison : au plus tard deux jours de négociation après l'exécution (AMF) ; calcul sans week-ends ni jours de fermeture de 2026. */
  function reglement(depuis) {
    var d = new Date((depuis || B.aujourdhui()).getTime()), k = 0;
    while (k < JOURS_REGLEMENT) { d = B.plusJours(d, 1); if (!ferme(d)) k++; }
    return B.ymd(d);
  }

  /* ---------- coûts ---------- */
  function courtage(compte, brut) { var t = TARIF[compte] || TARIF.PEA; return brut > 0 ? arrondi(Math.max(t.min, brut * t.taux)) : 0; }
  function soumisTtf(v) { return !!v && v.type === "action" && v.siege === "FR" && v.capi > TTF.capiMin; }
  function ttf(v, sens, brut) { return sens === "achat" && soumisTtf(v) ? arrondi(brut * TTF.taux) : 0; }

  /* ---------- confrontation au carnet (négociation continue) ---------- */
  function niveaux(v, sens) { return (sens === "achat" ? v.carnet.ventes : v.carnet.achats).map(function (n) { return { prix: n[0], qte: n[1] }; }); }
  function accessible(sens, prix, limite) { return sens === "achat" ? prix <= limite + 1e-9 : prix >= limite - 1e-9; }
  function executer(v, sens, tid, q, limite) {
    var niv = niveaux(v, sens), fills = [], reste = q, i, prixReste = null;
    if (tid === "seuil" || tid === "plage") return { fills: [], qte: 0, reste: q, prixReste: null };
    if (tid === "meilleure_limite") {
      var n0 = niv[0], x = Math.min(q, n0.qte); fills.push({ prix: n0.prix, qte: x }); reste = q - x; prixReste = n0.prix;
    } else {
      for (i = 0; i < niv.length && reste > 0; i++) {
        if (tid === "cours_limite" && !accessible(sens, niv[i].prix, limite)) break;
        var y = Math.min(reste, niv[i].qte); fills.push({ prix: niv[i].prix, qte: y }); reste -= y;
      }
      if (tid === "cours_limite") prixReste = limite;
    }
    return { fills: fills, qte: q - reste, reste: reste, prixReste: prixReste };
  }

  /* Estimation d'un ordre : exécution simulée, frais, besoin de couverture. s = { type, quantite, limite, seuil } (nombres). */
  function estimation(d, s, compte) {
    var v = valeur(d.valeur), dos = dossier(d), sn = seance(), ty = type(s.type), q = s.quantite, ex, brutE = 0, i;
    if (sn.continu) ex = executer(v, d.sens, s.type, q, s.limite); else ex = { fills: [], qte: 0, reste: q, prixReste: null };
    for (i = 0; i < ex.fills.length; i++) brutE += ex.fills[i].prix * ex.fills[i].qte;
    brutE = arrondi(brutE);
    var prixRes = s.type === "cours_limite" || s.type === "plage" ? s.limite : s.type === "meilleure_limite" && ex.prixReste != null ? ex.prixReste : s.type === "seuil" ? Math.max(s.seuil, v.cours) : v.cours;
    var brutR = arrondi(ex.reste * prixRes), brutT = arrondi(brutE + brutR);
    var co = courtage(compte, brutE), tx = ttf(v, d.sens, brutE), moy = ex.qte ? brutE / ex.qte : null;
    var totalE = d.sens === "achat" ? arrondi(brutE + co + tx) : arrondi(brutE - co);
    var besoin = d.sens === "achat" ? arrondi(brutT + courtage(compte, brutT) + ttf(v, d.sens, brutT)) : 0;
    var statut, enAttente = ty && ty.seuil;
    if (enAttente) statut = "attente";
    else if (!sn.continu) statut = "enregistre";
    else if (ex.qte === q) statut = "total";
    else if (ex.qte > 0) statut = "partiel";
    else statut = "carnet";
    return { statut: statut, seance: sn, fills: ex.fills, qteExec: ex.qte, reste: ex.reste, prixReste: ex.prixReste, prixMoyen: moy == null ? null : Math.round(moy * 10000) / 10000, brut: brutE, courtage: co, ttf: tx, total: totalE,
      besoin: besoin, bloque: d.sens === "achat" ? arrondi(Math.max(0, besoin - totalE)) : 0, espApres: d.sens === "achat" ? arrondi(dos.esp - totalE) : arrondi(dos.esp), espReglement: d.sens === "achat" ? arrondi(dos.esp - totalE) : arrondi(dos.esp + totalE), reglement: ex.qte ? reglement() : null, ttfDue: soumisTtf(v) && d.sens === "achat" };
  }
  /* Plus grande quantité d'un achat que les espèces couvrent, frais et taxe compris. */
  function quantiteMax(d, s, compte) {
    var dos = dossier(d), meilleure = 0, q;
    if (d.sens !== "achat") return null;
    for (q = 1; q <= 5000; q++) {
      if (estimation(d, { type: s.type, quantite: q, limite: s.limite, seuil: s.seuil }, compte).besoin <= dos.esp + 1e-9) meilleure = q; else break;
    }
    return meilleure;
  }

  /* ---------- dossier du client ---------- */
  function dossier(d) {
    var c = CLIENTS.filter(function (x) { return x.id === d.client; })[0] || null, pea = c && c.plc ? c.plc.filter(function (x) { return x.p === "PEA"; })[0] : null;
    return { client: c, esp: pea ? pea.esp : 0, solde: pea ? pea.solde : 0, detient: d.detient || 0, cto: !!d.cto };
  }

  /* ---------- analyse d'un ordre ---------- */
  function E(champ, msg) { return { champ: champ, msg: msg }; }
  function justifie(d, v, dos, motif) {
    if (motif === "non_eligible_pea") return v.pea.eligible ? "« " + v.nom + " » est éligible au PEA : ce motif ne s'applique pas." : (dos.cto ? "Le client a un compte-titres ordinaire : l'ordre peut y être passé." : null);
    if (motif === "couverture") {
      if (d.sens !== "achat") return "Ce motif ne concerne que les achats.";
      var m = quantiteMax(d, { type: "marche" }, "PEA"); return m >= 1 ? "Les espèces du PEA couvrent au moins " + plural(m, "titre", "titres") + " : réduisez la quantité plutôt que de refuser la demande." : null;
    }
    if (motif === "titres") {
      if (d.sens !== "vente") return "Ce motif ne concerne que les ventes.";
      return dos.detient > 0 ? "Le client détient " + plural(dos.detient, "titre", "titres") + " : transmettez un ordre pour cette quantité au plus." : null;
    }
    return "Motif inconnu.";
  }
  function analyser(st, id, s) {
    s = s || {};
    var d = trouver(id), er = [], pts = [], est = null;
    if (!d) return { ok: false, erreurs: [E("ordre", "Demande introuvable.")], points: [], estimation: null };
    if (traitement(st, id)) return { ok: false, erreurs: [E("ordre", "Cette demande est déjà traitée : remettez-la à traiter pour la reprendre.")], points: [], estimation: null };
    var v = valeur(d.valeur), dos = dossier(d), co = d.consigne || {}, dec = s.decision;
    if (dec !== "transmettre" && dec !== "refuser") er.push(E("decision", "Choisissez : transmettre l'ordre ou ne pas le transmettre."));
    if (dec === "refuser") {
      var mo = MOTIFS.filter(function (x) { return x.id === s.motif; })[0];
      if (!mo) er.push(E("motif", "Choisissez le motif du refus."));
      else { var j = justifie(d, v, dos, mo.id); if (j) er.push(E("motif", j)); }
      var or = ORIENTATIONS.filter(function (x) { return x.id === s.orientation; })[0];
      if (!or || or.id === "aucune") er.push(E("orientation", "Dites au client ce que vous lui proposez : une demande refusée sans solution laisse le client sans réponse."));
    }
    if (dec === "transmettre") ordre(d, v, dos, co, s, er, pts, function (e) { est = e; });
    var note = String(s.note == null ? "" : s.note).trim();
    if (note.length > 300) er.push(E("note", "La note interne est limitée à 300 signes."));
    return { ok: er.length === 0, erreurs: er, points: pts, estimation: est, note: note };
  }
  function ordre(d, v, dos, co, s, er, pts, fin) {
    var cpt = s.compte, ty = type(s.type), q = nombre(s.quantite), lim = ty && ty.limite ? nombre(s.limite) : null, seu = ty && ty.seuil ? nombre(s.seuil) : null, ok = true, vd = validite(s.validite);
    var cours = v.cours, auj = B.aujourdhui(), jusquau = null;
    if (cpt !== "PEA" && cpt !== "CTO") { er.push(E("compte", "Choisissez le compte sur lequel passer l'ordre.")); ok = false; }
    else if (cpt === "CTO" && !dos.cto) { er.push(E("compte", "Le client n'a pas de compte-titres ordinaire : il faut l'ouvrir d'abord (convention de compte, questionnaire de connaissance et d'expérience). Aucun ordre ne peut y être passé aujourd'hui.")); ok = false; }
    else if (cpt === "PEA" && !v.pea.eligible) { er.push(E("compte", "« " + v.nom + " » n'est pas éligible au PEA. " + v.pea.motif)); ok = false; }
    if (!ty) { er.push(E("type", "Choisissez le type d'ordre.")); ok = false; }
    if (q == null || isNaN(q) || q < 1 || Math.floor(q) !== q) { er.push(E("quantite", "La quantité doit être un nombre entier de titres, au moins égal à 1.")); ok = false; }
    if (ty && ty.limite) { if (!estPrix(lim)) { er.push(E("limite", lim == null ? "Indiquez la limite de prix, en euros." : "La limite doit être un prix positif, au centime près (pas de cotation de 0,01 €).")); ok = false; } }
    if (ty && ty.seuil) { if (!estPrix(seu)) { er.push(E("seuil", seu == null ? "Indiquez le seuil de déclenchement, en euros." : "Le seuil doit être un prix positif, au centime près (pas de cotation de 0,01 €).")); ok = false; } }
    if (!vd) { er.push(E("validite", "Choisissez la durée de validité de l'ordre.")); ok = false; }
    else if (vd.id === "date") {
      jusquau = B.lireYmd(s.jusquau);
      if (!jusquau) { er.push(E("jusquau", "Indiquez la date jusqu'à laquelle l'ordre reste valable.")); ok = false; }
      else if (B.ymd(jusquau) < B.ymd(auj)) { er.push(E("jusquau", "La date de fin de validité ne peut pas être passée.")); ok = false; }
      else if (B.ymd(jusquau) > B.ymd(B.plusJours(auj, CONV.validiteMax))) { er.push(E("jusquau", "Un ordre à date déterminée reste valable " + CONV.validiteMax + " jours au plus (convention de GS, comme l'ordre à révocation).")); ok = false; }
    }
    if (!ty || !ok) { /* les contrôles suivants supposent un ordre complet */ if (!ty || q == null || isNaN(q) || q < 1 || Math.floor(q) !== q || (ty.limite && !estPrix(lim)) || (ty.seuil && !estPrix(seu))) return; }
    /* cohérence des prix */
    var prixOk = true;
    if (ty.seuil) {
      if (d.sens === "vente" && seu >= cours) { er.push(E("seuil", "Le seuil de déclenchement d'une vente doit être inférieur au dernier cours (" + prixTxt(cours) + ") : sinon l'ordre se déclencherait aussitôt. L'ordre à déclenchement sert à vendre si le marché passe sous le seuil (AMF).")); prixOk = false; }
      if (d.sens === "achat" && seu <= cours) { er.push(E("seuil", "Le seuil de déclenchement d'un achat doit être supérieur au dernier cours (" + prixTxt(cours) + ") : sinon l'ordre se déclencherait aussitôt.")); prixOk = false; }
    }
    if (ty.id === "plage" && prixOk) {
      if (d.sens === "vente" && lim > seu + 1e-9) { er.push(E("limite", "À la vente, la limite d'une plage de déclenchement ne peut pas dépasser le seuil : une fois le seuil atteint, le cours est déjà sous la limite, l'ordre ne pourrait pas être exécuté.")); prixOk = false; }
      if (d.sens === "achat" && lim < seu - 1e-9) { er.push(E("limite", "À l'achat, la limite d'une plage de déclenchement ne peut pas être inférieure au seuil : une fois le seuil atteint, le cours est déjà au-dessus de la limite, l'ordre ne pourrait pas être exécuté.")); prixOk = false; }
    }
    [["limite", lim], ["seuil", seu]].forEach(function (x) {
      if (x[1] != null && estPrix(x[1]) && Math.abs(x[1] - cours) / cours > CONV.aberrant + 1e-9) { er.push(E(x[0], "Ordre aberrant : " + (x[0] === "limite" ? "la limite" : "le seuil") + " (" + prixTxt(x[1]) + ") s'écarte de plus de " + Math.round(CONV.aberrant * 100) + " % du dernier cours (" + prixTxt(cours) + "). GS rejette ce type d'ordre (convention de l'exercice) : l'AMF rappelle qu'un teneur de compte peut rejeter un ordre trop éloigné du dernier cours, sans fixer de seuil.")); prixOk = false; }
    });
    if (ty.id === "marche" && v.liquidite === "faible") er.push(E("type", "« " + v.nom + " » est une valeur peu liquide : GS n'accepte pas d'ordre au marché sur ces valeurs (convention de l'exercice). Le carnet est mince, l'ordre consommerait plusieurs niveaux de prix, sans aucune maîtrise du prix (AMF) : passez un ordre à cours limité."));
    /* titres détenus, couverture */
    if (d.sens === "vente" && q > dos.detient) er.push(E("quantite", "Le client détient " + plural(dos.detient, "titre", "titres") + " : on ne peut pas en vendre " + q + ". Dans un PEA, la vente à découvert et le service à règlement différé ne sont pas possibles (AMF)."));
    var comp = cpt === "CTO" ? "CTO" : "PEA", e = prixOk ? estimation(d, { type: ty.id, quantite: q, limite: lim, seuil: seu }, comp) : null;
    if (e && d.sens === "achat" && cpt === "PEA" && e.besoin > dos.esp + 1e-9) {
      var mx = quantiteMax(d, { type: ty.id, limite: lim, seuil: seu }, comp);
      er.push(E("quantite", "Espèces insuffisantes : cet ordre exige " + eur(e.besoin) + " (courtage et taxe compris) et le compte espèces du PEA ne contient que " + eur(dos.esp) + ". Il ne peut pas être débiteur (BOFiP, § 40). " + (mx >= 1 ? "Quantité maximale couverte : " + mx + "." : "Même un seul titre n'est pas couvert.")));
    }
    /* consignes du client */
    if (co.declenchement != null) {
      if (!ty.seuil) er.push(E("type", "Le client veut un ordre qui se déclenche à " + prixTxt(co.declenchement) + " : choisissez un ordre à seuil ou à plage de déclenchement." + (d.sens === "vente" && ty.id === "cours_limite" ? " Un ordre à cours limité de vente serait exécuté aussitôt, au meilleur prix du carnet : ce serait une vente immédiate, non une protection." : "")));
      else if (estPrix(seu) && Math.abs(seu - co.declenchement) > 1e-9) er.push(E("seuil", "Le client a fixé le seuil de déclenchement à " + prixTxt(co.declenchement) + "."));
    } else if (ty.seuil) er.push(E("type", "Le client ne demande aucun déclenchement : un ordre à seuil ou à plage ne se déclencherait qu'au franchissement d'un prix qu'il n'a pas fixé."));
    var plafond = co.prixMax, plancher = co.prixMin;
    if (plafond != null || plancher != null) {
      var cible = plafond != null ? plafond : plancher;
      if (!ty.garantit) er.push(E("type", "Le client fixe un prix " + (plafond != null ? "maximum" : "minimum") + " (" + prixTxt(cible) + ") : seul un ordre qui porte une limite de prix le garantit. L'ordre « " + ty.lib.toLowerCase().replace(/^ordre /, "") + " » n'offre aucune garantie sur le prix (AMF)."));
      else if (estPrix(lim) && ((plafond != null && lim > plafond + 1e-9) || (plancher != null && lim < plancher - 1e-9))) er.push(E("limite", "La limite (" + prixTxt(lim) + ") ne respecte pas le prix demandé par le client : " + (plafond != null ? "pas plus de " : "pas moins de ") + prixTxt(cible) + "."));
    }
    if (co.quantiteExacte && q !== d.quantite && !isNaN(q)) er.push(E("quantite", "Le client demande exactement " + plural(d.quantite, "titre", "titres") + "."));
    else if (!co.quantiteExacte && q > d.quantite) er.push(E("quantite", "Le client demande " + plural(d.quantite, "titre", "titres") + " au plus : l'ordre ne peut pas porter sur davantage."));
    if (co.jusquau) {
      if (vd && vd.id === "jour") er.push(E("validite", "Le client veut maintenir l'ordre jusqu'au " + dateLongue(co.jusquau) + " : la validité « jour » le ferait expirer ce soir."));
      else if (vd && vd.id === "date" && jusquau && B.ymd(jusquau) < co.jusquau) er.push(E("jusquau", "L'ordre doit rester valable jusqu'au " + dateLongue(co.jusquau) + " au moins, comme le demande le client."));
    }
    /* points d'attention (ne bloquent pas) */
    if (e) {
      if (!isNaN(q) && q < d.quantite && !(d.sens === "vente" && q > dos.detient)) pts.push("Le client demandait " + plural(d.quantite, "titre", "titres") + " : l'ordre en porte " + q + ". Prévenez-le de la différence.");
      if (e.seance.phase !== "continu") pts.push("La Bourse n'est pas en négociation continue (" + e.seance.lib.toLowerCase() + ") : l'ordre est enregistré dans le carnet et ne sera pas exécuté avant la prochaine séance.");
      else if (e.statut === "partiel") pts.push("L'ordre n'est exécuté qu'en partie (" + plural(e.qteExec, "titre", "titres") + " sur " + q + ") : le solde reste dans le carnet" + (vd && vd.id === "jour" ? " jusqu'à la fin de la séance, puis expire (validité « jour »)." : "."));
      else if (e.statut === "carnet") pts.push("Aucun titre n'est exécuté tout de suite : l'ordre est inscrit dans le carnet à " + prixTxt(lim) + "." + (vd && vd.id === "jour" ? " Avec la validité « jour », il expirera à la fin de la séance s'il n'a pas trouvé de contrepartie." : ""));
      if (co.immediat && e.seance.phase === "continu" && e.statut !== "total" && e.statut !== "attente") pts.push("Le client veut une exécution immédiate : cet ordre ne sera pas exécuté en totalité tout de suite.");
      if (e.prixMoyen != null && Math.abs(e.prixMoyen - cours) / cours > 0.01) pts.push("Le prix moyen d'exécution (" + prixTxt(e.prixMoyen) + ") s'écarte de plus de 1 % du dernier cours (" + prixTxt(cours) + ") : le carnet est peu profond.");
      if (e.ttfDue) pts.push("La taxe sur les transactions financières de 0,4 % s'applique à cet achat : " + soumisTxt(v) + " Elle est prélevée à l'exécution et s'ajoute au courtage.");
      if (ty.id === "seuil") pts.push("À seuil de déclenchement, l'ordre devient un ordre au marché quand le seuil est atteint : le prix d'exécution n'est pas maîtrisé, surtout si le marché s'emballe (AMF).");
      if (ty.id === "plage") pts.push("À plage de déclenchement, l'ordre devient un ordre à cours limité quand le seuil est atteint : il peut n'être exécuté qu'en partie, ou pas du tout.");
    }
    fin(e);
  }
  function soumisTxt(v) { return "l'émetteur a son siège en France et une capitalisation de plus d'un milliard d'euros (" + v.capi.toLocaleString("fr-FR").replace(/ /g, " ") + " M€ au 1er décembre 2025)."; }
  function dateLongue(ymd) { var d = B.lireYmd(ymd); return d ? d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : ""; }

  /* ---------- enregistrement ---------- */
  function valider(st, id, s) {
    var r = analyser(st, id, s); if (!r.ok) return r;
    var d = trouver(id), now = B.maintenant(), t = { decision: s.decision, date: B.ymd(B.aujourdhui()), heure: B.hhmm(now), par: (st.eleve && st.eleve.nom) || "", note: r.note, points: r.points.slice() };
    if (s.decision === "refuser") { t.motif = s.motif; t.orientation = s.orientation; }
    else {
      var ty = type(s.type);
      t.compte = s.compte; t.type = ty.id; t.quantite = nombre(s.quantite); t.limite = ty.limite ? nombre(s.limite) : null; t.seuil = ty.seuil ? nombre(s.seuil) : null; t.validite = s.validite; t.jusquau = s.validite === "date" ? B.ymd(B.lireYmd(s.jusquau)) : null;
      t.resultat = { statut: r.estimation.statut, fills: r.estimation.fills, qteExec: r.estimation.qteExec, reste: r.estimation.reste, prixMoyen: r.estimation.prixMoyen, brut: r.estimation.brut, courtage: r.estimation.courtage, ttf: r.estimation.ttf, total: r.estimation.total, bloque: r.estimation.bloque, espApres: r.estimation.espApres, espReglement: r.estimation.espReglement, reglement: r.estimation.reglement };
    }
    if (!st.ordresBourse || typeof st.ordresBourse !== "object" || Array.isArray(st.ordresBourse)) st.ordresBourse = {};
    st.ordresBourse[d.id] = t;
    return { ok: true, traitement: t, points: r.points, estimation: r.estimation };
  }
  function remettre(st, id) {
    if (!trouver(id)) return { ok: false, erreur: "Demande introuvable." };
    if (!traitement(st, id)) return { ok: false, erreur: "Cette demande n'est pas traitée." };
    delete st.ordresBourse[id]; return { ok: true };
  }

  /* ---------- liste et bilan ---------- */
  function liste() { return DEMANDES.slice().sort(function (a, b) { return a.recu < b.recu ? -1 : a.recu > b.recu ? 1 : (a.id < b.id ? -1 : 1); }); }
  function bilan(st) {
    var tr = DEMANDES.filter(function (d) { return traitement(st, d.id); }), tx = tr.filter(function (d) { return traitement(st, d.id).decision === "transmettre"; });
    function n(c) { return tx.filter(function (d) { return traitement(st, d.id).resultat.statut === c; }).length; }
    return { total: DEMANDES.length, traites: tr.length, atraiter: DEMANDES.length - tr.length, transmis: tx.length, refuses: tr.length - tx.length, executes: n("total"), partiels: n("partiel"), enAttente: n("carnet") + n("attente") + n("enregistre") };
  }
  var STATUTS = { total: "Exécuté en totalité", partiel: "Exécuté en partie : le solde reste dans le carnet", carnet: "Non exécuté : l'ordre est inscrit dans le carnet", attente: "En attente de déclenchement : le seuil n'est pas atteint", enregistre: "Enregistré : aucune exécution avant la prochaine séance" };

  var api = { VALEURS: VALEURS, DEMANDES: DEMANDES, TARIF: TARIF, TTF: TTF, CONV: CONV, SEANCE: SEANCE, FERMES: FERMES, TYPES: TYPES, VALIDITES: VALIDITES, COMPTES: COMPTES, MOTIFS: MOTIFS, ORIENTATIONS: ORIENTATIONS, LIQUIDITE: LIQUIDITE, CANAUX: CANAUX, STATUTS: STATUTS,
    type: type, validite: validite, valeur: valeur, trouver: trouver, traitement: traitement, dossier: dossier, nombre: nombre, arrondi: arrondi, eur: eur, prixTxt: prixTxt, seance: seance, reglement: reglement, courtage: courtage, soumisTtf: soumisTtf, ttf: ttf,
    executer: executer, estimation: estimation, quantiteMax: quantiteMax, analyser: analyser, valider: valider, remettre: remettre, liste: liste, bilan: bilan };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.ordresBourse = api; }
})(typeof window !== "undefined" ? window : null);
