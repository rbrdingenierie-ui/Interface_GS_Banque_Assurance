/* GS Banque & Assurance – régularisation d'un incident de paiement de chèque inscrit au fichier central des chèques (FCC).
   Point de départ : un chèque rejeté pour défaut de provision dont la lettre d'injonction a été envoyée (procédure MURCEF, injonction.js) : le titulaire est interdit bancaire.
   Deux façons de régulariser, que la lettre d'injonction propose au titulaire :
     – le blocage de provision : la somme nécessaire est bloquée au profit du bénéficiaire dans l'attente d'une nouvelle présentation du chèque (1 an et 8 jours). Elle est constituée soit par un versement d'espèces du titulaire, soit par virement : la somme est alors prélevée directement sur le compte ;
     – la remise du chèque impayé : le titulaire reprend le chèque, le remet à la banque et règle le bénéficiaire autrement (virement, espèces, carte bancaire…).
   Dans les deux cas, la banque complète la déclaration de régularisation de la lettre d'injonction et la remet au titulaire, puis déclare la régularisation à la Banque de France.
   Règles retenues (sources : service-public.fr, fiche « Interdiction d'émettre des chèques » ; La finance pour tous ; Les Clés de la banque ; Légifrance non consulté) :
     – l'interdiction n'est levée que si TOUS les incidents du titulaire sont régularisés ;
     – la banque prévient la Banque de France au plus tard 2 jours ouvrés après la justification de la régularisation ; en pratique, elle le fait immédiatement : la déclaration est datée du jour de la validation ;
     – la Banque de France met son fichier à jour DANS LE MOIS (règle de l'exercice : un mois après la déclaration) : jusqu'à cette date, une interrogation du FCC montre encore l'inscription.
   Les mentions « régularisation déclarée, mise à jour en cours » n'existent que dans l'outil de la banque (page « Régularisation FCC »), jamais dans la réponse de la Banque de France.
   Fonctions pures, testées avec Node ; l'état est conservé dans la sauvegarde partagée de la banque : st.murcef (procédures) et st.regul (régularisations déclarées). */
(function (root) {
  "use strict";

  var B = (root && root.SGBF && root.SGBF.banque) || (typeof require === "function" ? require("./banque.js") : null);

  var JOURS_DECLARATION = 2;     /* jours ouvrés dont dispose la banque, au plus, pour prévenir la Banque de France (règle) ; en pratique, elle déclare le jour même */
  var MOIS_MISE_A_JOUR = 1;      /* la Banque de France met son fichier à jour dans le mois qui suit la déclaration */
  var ANNEES_INTERDICTION = 5;
  var MAX_MONTANT = 1000000;

  var MODES = [
    { code: "provision", libelle: "Blocage de provision",
      aide: "La somme du chèque est bloquée au profit du bénéficiaire, qui peut représenter le chèque pendant 1 an et 8 jours : le titulaire verse des espèces, ou la somme est prélevée sur son compte par virement." },
    { code: "cheque", libelle: "Remise du chèque et paiement du bénéficiaire autrement",
      aide: "Le titulaire reprend le chèque impayé et le remet à la banque, après avoir réglé le bénéficiaire par un autre moyen de paiement." }
  ];
  /* Comment la provision est constituée (mode « provision »). Par virement, la somme est prélevée directement sur le compte : aucun versement n'est saisi. */
  var MOYENS_PROVISION = [
    { code: "especes", libelle: "Versement d'espèces", court: "en espèces",
      aide: "Le titulaire verse des espèces sur son compte ; la somme du chèque est bloquée, l'éventuel surplus reste disponible." },
    { code: "virement", libelle: "Virement", court: "par virement",
      aide: "La somme du chèque est prélevée directement sur le compte du titulaire par virement, puis bloquée : aucun versement d'espèces." }
  ];
  var PAIEMENTS = [
    { code: "virement", libelle: "Virement", court: "par virement" },
    { code: "especes", libelle: "Espèces", court: "en espèces" },
    { code: "carte", libelle: "Carte bancaire", court: "par carte bancaire" },
    { code: "autre", libelle: "Autre moyen de paiement (hors chèque)", court: "par un autre moyen de paiement" }
  ];
  /* Vérifications que le conseiller atteste avant de valider la régularisation (toutes obligatoires). */
  var VERIFICATIONS = {
    provision: [
      { id: "identite", libelle: "L'identité du titulaire a été vérifiée sur une pièce officielle." },
      { id: "especes", libelle: "Les espèces ont été comptées et versées sur le compte du titulaire." },
      { id: "blocage", libelle: "La somme du chèque est bloquée au profit du bénéficiaire, pour 1 an et 8 jours." },
      { id: "declaration", libelle: "Le titulaire a daté et signé la déclaration de régularisation de la lettre d'injonction." }
    ],
    provision_virement: [
      { id: "identite", libelle: "L'identité du titulaire a été vérifiée sur une pièce officielle." },
      { id: "virement", libelle: "Le virement est exécuté : la somme du chèque est prélevée directement sur le compte du titulaire, dont le solde disponible la couvre." },
      { id: "blocage", libelle: "La somme du chèque est bloquée au profit du bénéficiaire, pour 1 an et 8 jours." },
      { id: "declaration", libelle: "Le titulaire a daté et signé la déclaration de régularisation de la lettre d'injonction." }
    ],
    cheque: [
      { id: "identite", libelle: "L'identité du titulaire a été vérifiée sur une pièce officielle." },
      { id: "cheque", libelle: "Le chèque impayé a été remis à la banque par le titulaire." },
      { id: "paiement", libelle: "Le bénéficiaire a été payé autrement : le justificatif a été vu." },
      { id: "declaration", libelle: "Le titulaire a daté et signé la déclaration de régularisation de la lettre d'injonction." }
    ]
  };

  /* ---------- outils ---------- */
  function ymdDe(t) { return String(t || "").slice(0, 10); }
  function arrondi(x) { return Math.round(x * 100) / 100; }
  /* Montant saisi : « 1 240,50 », « 1240.5 » ; renvoie un nombre, null si vide, NaN si invalide. */
  function nombre(s) {
    var t = String(s == null ? "" : s).replace(/[\s  ]/g, "").replace(/€$/, "").replace(",", ".");
    if (t === "") return null;
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return NaN;
    var n = Math.round(parseFloat(t) * 100) / 100;
    return n > MAX_MONTANT ? NaN : n;
  }
  /* Le n-ième jour ouvré après d (le jour même n'est pas compté). */
  function joursOuvres(d, n) { var x = B.jour(d), k = 0; while (k < n) { x = B.plusJours(x, 1); if (B.estOuvre(x)) k++; } return x; }
  /* Même jour du mois suivant (le dernier jour du mois si ce jour n'existe pas), reporté au jour ouvré suivant. */
  function plusMois(d, n) {
    var m = d.getMonth() + n, y = d.getFullYear() + Math.floor(m / 12), mm = ((m % 12) + 12) % 12;
    var dernier = new Date(y, mm + 1, 0).getDate(), x = new Date(y, mm, Math.min(d.getDate(), dernier));
    while (!B.estOuvre(x)) x = B.plusJours(x, 1);
    return x;
  }
  function plusAnnees(d, n) { var x = new Date(d.getFullYear() + n, d.getMonth(), d.getDate()); return x.getMonth() !== d.getMonth() ? new Date(d.getFullYear() + n, d.getMonth() + 1, 0) : x; }
  function empreinte(t) { var h = 11, i; t = String(t); for (i = 0; i < t.length; i++) h = (h * 33 + t.charCodeAt(i)) % 1000003; return h; }
  function sansAccent(t) { return String(t == null ? "" : t).normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function p2(n) { return (n < 10 ? "0" : "") + n; }

  /* ---------- identité sous laquelle l'incident est inscrit au FCC ----------
     Les dossiers des états débiteurs ne portent ni date ni lieu de naissance : on en déduit, toujours les mêmes pour un même titulaire (comme l'adresse, documents.js), pour pouvoir l'interroger dans « Interro BDF ». */
  var LIEUX = ["PARIS 11E ARRONDISSEMENT", "PARIS 15E ARRONDISSEMENT", "LYON 3E ARRONDISSEMENT", "LILLE", "TOURS", "DIJON", "RENNES", "BORDEAUX", "TOULOUSE", "STRASBOURG", "MONTPELLIER", "NANCY", "ORLEANS", "AMIENS", "LIMOGES", "NANTES"];
  function identite(client) {
    var h = empreinte((client.nom || "") + "|" + (client.prenom || "") + "|" + (client.compte || ""));
    var an = 1958 + (h % 39), mois = 1 + (Math.floor(h / 39) % 12), j = 1 + (Math.floor(h / 468) % 28);
    return {
      nom: sansAccent(client.nom).toUpperCase(), prenoms: sansAccent(client.prenom).toUpperCase(), sexe: client.civilite === "M." ? "M" : "F",
      naissance: an + "-" + p2(mois) + "-" + p2(j), lieu: LIEUX[Math.floor(h / 13104) % LIEUX.length], pays: "FR * FRANCE"
    };
  }
  function cleIdentite(i) { return i.nom + "|" + i.naissance; }

  /* ---------- dossiers à régulariser ---------- */
  function regulations(st) { return st && st.regul && typeof st.regul === "object" && !Array.isArray(st.regul) ? st.regul : {}; }
  function procedures(st) { return st && st.murcef && typeof st.murcef === "object" && !Array.isArray(st.murcef) ? st.murcef : {}; }
  /* État vu de la banque : « a_regulariser », « declaree » (déclarée à la Banque de France, fichier pas encore mis à jour) ou « levee » (fichier mis à jour). */
  function etat(regul, now) {
    if (!regul) return "a_regulariser";
    return B.ymd(now || B.maintenant()) >= regul.levee ? "levee" : "declaree";
  }
  /* Les chèques rejetés dont la lettre d'injonction a été envoyée, du plus récent au plus ancien. */
  function dossiers(st, now) {
    var P = procedures(st), R = regulations(st), auj = B.ymd(now || B.maintenant());
    var l = Object.keys(P).filter(function (k) { var p = P[k]; return p && p.injonction && p.inst && p.inst.ok && ymdDe(p.injonction.date) <= auj; }).map(function (k) {
      var p = P[k], inst = p.inst, c = inst.client, rg = R[k] || null, idt = identite(c);
      return {
        cle: k, inst: inst, client: c, compte: c.compte, cheque: inst.cheque, montant: inst.montantCheque, frais: inst.frais, beneficiaire: inst.beneficiaire,
        dateInjonction: ymdDe(p.injonction.date), injonction: p.injonction, identite: idt, cleIdentite: cleIdentite(idt), regul: rg, etat: etat(rg, now)
      };
    });
    l.sort(function (a, b) { return a.injonction.date < b.injonction.date ? 1 : a.injonction.date > b.injonction.date ? -1 : (a.cle < b.cle ? -1 : 1); });
    /* autres incidents du même titulaire : l'interdiction n'est levée que lorsqu'ils sont tous régularisés */
    l.forEach(function (d) { d.autres = l.filter(function (x) { return x !== d && x.cleIdentite === d.cleIdentite; }); d.autresNonRegularises = d.autres.filter(function (x) { return !x.regul; }).length; });
    return l;
  }
  function dossier(st, cle, now) { return dossiers(st, now).filter(function (d) { return d.cle === cle; })[0] || null; }
  /* Vérifications du mode choisi ; pour le blocage de provision, elles dépendent du moyen (espèces ou virement). */
  function verificationsDe(mode, moyen) { return VERIFICATIONS[mode === "provision" && moyen === "virement" ? "provision_virement" : mode] || []; }

  /* ---------- contrôle et enregistrement ---------- */
  /* saisie : { mode, moyen (espèces ou virement, pour le blocage de provision), versement (espèces), paiement (remise du chèque), verifs : [id] } → { ok } ou { ok: false, champ, erreur }. */
  function controler(d, saisie) {
    var s = saisie || {};
    function ko(champ, erreur) { return { ok: false, champ: champ, erreur: erreur }; }
    if (!d) return ko("dossier", "Choisissez le chèque à régulariser.");
    if (d.regul) return ko("dossier", "Ce chèque est déjà régularisé : la régularisation a été déclarée à la Banque de France le " + B.fmtDate(B.lireYmd(d.regul.date)) + ".");
    var mode = MODES.filter(function (m) { return m.code === s.mode; })[0];
    if (!mode) return ko("mode", "Choisissez le mode de régularisation : blocage de provision, ou remise du chèque.");
    var r = { ok: true, mode: mode.code };
    if (mode.code === "provision") {
      var moyen = MOYENS_PROVISION.filter(function (m) { return m.code === s.moyen; })[0];
      if (!moyen) return ko("moyen", "Indiquez comment la provision est constituée : versement d'espèces, ou virement (somme prélevée directement sur le compte).");
      r.moyen = moyen.code; r.bloque = d.montant;
      if (moyen.code === "especes") {
        var v = nombre(s.versement);
        if (v === null) return ko("versement", "Indiquez la somme versée en espèces.");
        if (v !== v || v <= 0) return ko("versement", "La somme versée n'est pas un montant valide (exemple : 1 240,50).");
        if (v < d.montant) return ko("versement", "Le versement doit couvrir au moins le montant du chèque (" + B.eur2(d.montant) + ") : la provision doit être suffisante pour payer le chèque.");
        r.versement = v;
      } else r.preleve = d.montant;
    } else {
      if (!PAIEMENTS.some(function (m) { return m.code === s.paiement; })) return ko("paiement", "Indiquez comment le bénéficiaire a été payé : virement, espèces, carte bancaire ou autre moyen (pas de chèque).");
      r.paiement = s.paiement;
    }
    var faites = Array.isArray(s.verifs) ? s.verifs : [];
    var manque = verificationsDe(mode.code, r.moyen).filter(function (x) { return faites.indexOf(x.id) < 0; });
    if (manque.length) return ko("verifs", "Cochez " + (manque.length > 1 ? "les " + manque.length + " vérifications restantes" : "la vérification restante") + " avant de valider : une régularisation lève une interdiction bancaire.");
    return r;
  }
  /* Enregistre la régularisation : déclaration à la Banque de France le jour même (la règle accorde 2 jours ouvrés au plus) et mise à jour de son fichier dans le mois. */
  function regulariser(st, cle, saisie, now, par) {
    now = now || B.maintenant();
    var d = dossier(st, cle, now), c = controler(d, saisie);
    if (!c.ok) return c;
    if (!st.regul || typeof st.regul !== "object" || Array.isArray(st.regul)) st.regul = {};
    var rg = {
      date: B.ymd(now), heure: B.hhmm(now), mode: c.mode, montant: d.montant, par: par || "",
      declaree: B.ymd(now), levee: B.ymd(plusMois(B.jour(now), MOIS_MISE_A_JOUR))
    };
    if (c.mode === "provision") { rg.moyen = c.moyen; rg.bloque = c.bloque; if (c.moyen === "especes") rg.versement = c.versement; else rg.preleve = c.preleve; } else { rg.paiement = c.paiement; }
    st.regul[cle] = rg;
    return { ok: true, regul: rg, dossier: dossier(st, cle, now) };
  }
  function libPaiement(code) { var m = PAIEMENTS.filter(function (x) { return x.code === code; })[0]; return m ? m.court : ""; }
  function libMode(code) { var m = MODES.filter(function (x) { return x.code === code; })[0]; return m ? m.libelle : ""; }
  /* Mode complet d'une régularisation enregistrée : « Blocage de provision en espèces », « Blocage de provision par virement » ou « Remise du chèque… ». */
  function libModeComplet(rg) {
    if (!rg) return "";
    if (rg.mode !== "provision") return libMode(rg.mode);
    return "Blocage de provision " + (rg.moyen === "virement" ? "par virement" : "en espèces");
  }

  /* ---------- le fichier central des chèques vu de la Banque de France ----------
     Les incidents des procédures de l'agence y sont inscrits à partir de l'envoi de la lettre d'injonction. Une régularisation n'y apparaît qu'une fois le fichier mis à jour (date « levee ») :
     l'incident est alors régularisé ; quand tous les incidents du titulaire le sont, l'interdiction est levée et il n'y a plus de dossier. */
  function fichesAgence(st, now) {
    var groupes = {}, ordre = [];
    dossiers(st, now).forEach(function (d) {
      var g = groupes[d.cleIdentite];
      if (!g) { g = groupes[d.cleIdentite] = { identite: d.identite, incidents: [] }; ordre.push(d.cleIdentite); }
      g.incidents.push({ date: d.dateInjonction, montant: d.montant, regularise: d.etat === "levee" });
    });
    return ordre.map(function (k) {
      var g = groupes[k], i = g.identite;
      g.incidents.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
      var debut = g.incidents[0].date, levee = g.incidents.every(function (x) { return x.regularise; });
      return {
        id: "agence", agence: true, nom: i.nom, prenoms: i.prenoms, marital: "", sexe: i.sexe, naissance: i.naissance, lieu: i.lieu, pays: i.pays, sousCle: "01",
        fcc: levee ? null : { debut: debut, fin: B.ymd(plusAnnees(B.lireYmd(debut), ANNEES_INTERDICTION)), incidents: g.incidents, carte: false }, ficp: null
      };
    });
  }

  var api = {
    JOURS_DECLARATION: JOURS_DECLARATION, MOIS_MISE_A_JOUR: MOIS_MISE_A_JOUR, MODES: MODES, MOYENS_PROVISION: MOYENS_PROVISION, PAIEMENTS: PAIEMENTS, VERIFICATIONS: VERIFICATIONS,
    nombre: nombre, joursOuvres: joursOuvres, plusMois: plusMois, identite: identite, cleIdentite: cleIdentite, etat: etat, dossiers: dossiers, dossier: dossier, verificationsDe: verificationsDe,
    controler: controler, regulariser: regulariser, libPaiement: libPaiement, libMode: libMode, libModeComplet: libModeComplet, fichesAgence: fichesAgence
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.regul = api; }
})(typeof window !== "undefined" ? window : null);
