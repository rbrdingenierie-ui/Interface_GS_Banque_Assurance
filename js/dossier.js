/* GS Banque & Assurance – mise à jour du dossier client par le conseiller (à l'issue d'un entretien).
   Ce que le conseiller met à jour : les coordonnées (téléphone, mobile, e-mail), le mode de contact souhaité, l'adresse, la situation familiale (situation, conjoint, enfants),
   la situation professionnelle déclarée (profession, employeur, contrat, revenu net mensuel) et la date de mise à jour du dossier.
   Cette date remplace celle des données de départ : elle fait disparaître l'alerte « Dossier à actualiser » (règle interne fictive : dossier à actualiser au bout de 5 ans)
   partout dans le site (fiche client, accueil, portefeuille, analyse). Les informations de la banque (revenus domiciliés, contrats, mouvements, compte et cartes) ne sont jamais modifiées :
   ce que le client déclare (famille, profession, revenu) remplace ce que le dossier contenait, et les règles du site (éligibilité, profil, opportunités) s'appuient ensuite sur ces nouvelles informations.
   Les mises à jour sont enregistrées dans le navigateur (store().infos[client].dossier) ; ce fichier est chargé sur chaque page, juste après les données clients,
   et les applique aux fiches clients en mémoire avant que les outils ne s'en servent. */
(function (root) {
  "use strict";

  var B = root && root.SGBF ? root.SGBF.banque : require("./banque.js");
  var CL = root && root.SGBF ? root.SGBF.clients : require("./data_clients.js").clients;

  var PREFS = { "": "Pas de préférence", mail: "Par e-mail", tel: "Par téléphone" };
  var ORDRE_PREFS = ["", "mail", "tel"];
  var MAX_MAIL = 80;
  var ORIGINE = {};
  function copie(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  CL.forEach(function (c) { ORIGINE[c.id] = { kyc: c.kyc, tel: c.tel, mob: c.mob, mail: c.mail, adr: copie(c.adr), fam: copie(c.fam), pro: { prof: c.pro.prof, emp: c.pro.emp, ctr: c.pro.ctr, rev: c.pro.rev, foyer: c.pro.foyer } }; });

  /* Situations familiales proposées, et contrats de travail possibles selon le statut du client (le statut lui-même, salarié, retraité, étudiant…, n'est pas modifiable ici : c'est une situation de départ du dossier). */
  var SITUATIONS = { celibataire: "Célibataire", marie: "Marié(e)", pacse: "Pacsé(e)", concubinage: "En concubinage", divorce: "Divorcé(e)", veuf: "Veuf / veuve" };
  var ORDRE_SIT = ["celibataire", "marie", "pacse", "concubinage", "divorce", "veuf"], COUPLES = { marie: true, pacse: true, concubinage: true };
  var CONTRATS = { salarie: ["CDI", "CDD", "Intérim", "Contractuel", "Contractuelle"], fonctionnaire: ["Titulaire de la fonction publique", "Contractuel", "Contractuelle"], independant: ["Indépendant", "Indépendante"] };
  var MAX_ENFANTS = 8, REV_MAX = 50000;

  function err(champ, msg) { return { ok: false, champ: champ, erreur: msg }; }
  function propre(s) { return String(s == null ? "" : s).replace(/[\u0000-\u001F\u007F]/g, "").trim(); }
  function dossierDe(st, cid) { var i = st && st.infos && st.infos[cid]; return i && i.dossier ? i.dossier : null; }
  function paires(d) { return d.replace(/(\d{2})(?=\d)/g, "$1 "); }
  /* Numéro de téléphone français : 10 chiffres commençant par 0 (ou +33 puis 9 chiffres) ; espaces, points et tirets acceptés. Renvoie le numéro mis en forme, ou null. */
  function numero(s, mobile) {
    var d = propre(s).replace(/[\s.\-]/g, "").replace(/^(\+33|0033)/, "0");
    if (!/^0\d{9}$/.test(d)) return null;
    if (mobile ? !/^0[67]/.test(d) : !/^0[1-59]/.test(d)) return null;
    return paires(d);
  }
  function courriel(s) {
    var m = propre(s).toLowerCase();
    return m.length <= MAX_MAIL && /^[a-z0-9._%+\-]+@[a-z0-9\-]+(\.[a-z0-9\-]+)*\.[a-z]{2,}$/.test(m) ? m : null;
  }

  /* ---------- contrôle ----------
     saisie = { tel, mob, mail, pref } ; le téléphone fixe est facultatif (beaucoup de clients n'en ont plus). */
  function controle(saisie) {
    var s = saisie || {}, tel = "", pref = String(s.pref == null ? "" : s.pref);
    if (propre(s.tel)) { tel = numero(s.tel, false); if (!tel) return err("tel", "Le téléphone fixe doit comporter 10 chiffres et commencer par 01 à 05 ou 09, par exemple 01 42 00 00 00. Laissez vide si le client n'en a pas."); }
    if (!propre(s.mob)) return err("mob", "Indiquez le numéro de mobile du client.");
    var mob = numero(s.mob, true);
    if (!mob) return err("mob", "Le mobile doit comporter 10 chiffres et commencer par 06 ou 07, par exemple 06 12 34 56 78.");
    if (!propre(s.mail)) return err("mail", "Indiquez l'adresse e-mail du client.");
    var mail = courriel(s.mail);
    if (!mail) return err("mail", "L'adresse e-mail n'est pas valide (exemple : prenom.nom@exemple.fr, " + MAX_MAIL + " caractères au plus).");
    if (!Object.prototype.hasOwnProperty.call(PREFS, pref)) return err("pref", "Choisissez le mode de contact souhaité dans la liste.");
    return { ok: true, tel: tel, mob: mob, mail: mail, pref: pref };
  }

  /* ---------- informations déclarées pendant l'entretien ----------
     decl = { rue, cp, ville, sit, conjPrenom, conjNom, conjSexe, conjAge, conjProf, conjRev, enfants (une ligne « Prénom, âge » par enfant), nbCharge, prof, emp, ctr, rev } (textes saisis).
     Renvoie { ok: true, decl } (valeurs nettoyées) ou { ok: false, champ, erreur }. Le client courant c sert aux valeurs actuelles (statut, contrats autorisés, enfants déjà connus). */
  function nombreFr(s) { var t = propre(s).replace(/[\s  ]/g, "").replace(",", "."); return /^\d+(\.\d{1,2})?$/.test(t) ? parseFloat(t) : NaN; }
  function controleDecl(d, c) {
    d = d || {};
    var rue = propre(d.rue), cp = propre(d.cp).replace(/\s/g, ""), ville = propre(d.ville);
    if (rue.length < 3 || rue.length > 80) return err("rue", "Indiquez l'adresse du client (numéro et nom de la voie, 80 caractères au plus).");
    if (!/^\d{5}$/.test(cp)) return err("cp", "Le code postal comporte 5 chiffres, par exemple 75020.");
    if (ville.length < 2 || ville.length > 40) return err("ville", "Indiquez la commune (40 caractères au plus).");
    var sit = propre(d.sit);
    if (!Object.prototype.hasOwnProperty.call(SITUATIONS, sit)) return err("sit", "Choisissez la situation familiale dans la liste.");
    var conj = null;
    if (COUPLES[sit]) {
      var cp0 = c.fam.conj, prenom = propre(d.conjPrenom), nom = propre(d.conjNom) || (sit === "marie" ? c.nom : ""), age = parseInt(propre(d.conjAge), 10), sexe = propre(d.conjSexe), prof = propre(d.conjProf), rev = propre(d.conjRev) === "" ? 0 : nombreFr(d.conjRev);
      if (prenom.length < 2 || prenom.length > 30) return err("conjPrenom", "Indiquez le prénom du conjoint ou du partenaire.");
      if (nom.length < 2 || nom.length > 40) return err("conjNom", "Indiquez le nom du conjoint ou du partenaire.");
      if (sexe !== "F" && sexe !== "M") return err("conjSexe", "Indiquez s'il s'agit d'une femme ou d'un homme.");
      if (!(age >= 18 && age <= 110) || String(age) !== propre(d.conjAge)) return err("conjAge", "L'âge du conjoint est compris entre 18 et 110 ans.");
      if (prof.length > 50) return err("conjProf", "La profession du conjoint est limitée à 50 caractères.");
      if (isNaN(rev) || rev > REV_MAX) return err("conjRev", "Indiquez le revenu net mensuel du conjoint en euros (0 s'il n'en a pas), par exemple 2 150.");
      conj = { prenom: prenom, nom: nom, age: age, sexe: sexe, banque: cp0 ? cp0.banque : "ext", statut: cp0 ? cp0.statut : (rev > 0 ? "salarie" : "foyer"), rev: rev, prof: prof };
    }
    var enf = [], lignes = String(d.enfants == null ? "" : d.enfants).split(/\n/).map(propre).filter(Boolean);
    if (lignes.length > MAX_ENFANTS) return err("enfants", "Huit enfants au plus : un par ligne.");
    for (var i = 0; i < lignes.length; i++) {
      var m = /^(.{1,30}?)\s*[,;]\s*(\d{1,2})(?:\s*ans?)?$/i.exec(lignes[i]);
      if (!m || +m[2] > 99) return err("enfants", "Un enfant par ligne, sous la forme « Prénom, âge » (par exemple Louise, 12) ; âge de 0 à 99 ans. Ligne à corriger : « " + lignes[i] + " ».");
      var ex = (c.fam.enf || []).filter(function (e) { return e.prenom.toLowerCase() === m[1].toLowerCase() && e.age === +m[2]; })[0] || (ORIGINE[c.id].fam.enf || []).filter(function (e) { return e.prenom.toLowerCase() === m[1].toLowerCase(); })[0];
      var e1 = ex ? copie(ex) : { prenom: m[1], age: +m[2], sexe: "" };
      e1.prenom = m[1]; e1.age = +m[2];
      if (e1.age !== 0) delete e1.naissJ;
      enf.push(e1);
    }
    var nb = propre(d.nbCharge) === "" ? Math.min(enf.length, (c.fam.nbCharge || 0)) : parseInt(propre(d.nbCharge), 10);
    if (!(nb >= 0 && nb <= enf.length) || (propre(d.nbCharge) !== "" && String(nb) !== propre(d.nbCharge))) return err("nbCharge", "Le nombre d'enfants à charge va de 0 au nombre d'enfants indiqués (" + enf.length + ").");
    var prof = propre(d.prof), emp = propre(d.emp), ctr = propre(d.ctr), rev = nombreFr(d.rev);
    if (prof.length < 2 || prof.length > 60) return err("prof", "Indiquez la profession du client (60 caractères au plus).");
    if (emp.length > 60) return err("emp", "L'employeur est limité à 60 caractères.");
    var permis = CONTRATS[c.pro.statut];
    if (permis) { if (permis.indexOf(ctr) < 0) return err("ctr", "Choisissez le contrat de travail dans la liste."); }
    else ctr = c.pro.ctr;
    if (isNaN(rev) || rev > REV_MAX) return err("rev", "Indiquez le revenu net mensuel du client en euros (0 s'il n'en a pas), par exemple 2 150.");
    return { ok: true, decl: { adr: { rue: rue, cp: cp, ville: ville }, sit: sit, conj: conj, enf: enf, nbCharge: nb, prof: prof, emp: permis ? emp : (c.pro.emp || ""), ctr: ctr, rev: rev } };
  }
  /* Valeurs actuelles du client, au même format que decl (pour préremplir le formulaire et repérer ce qui change). */
  function valeursDecl(c) {
    var f = c.fam, cj = f.conj;
    return { rue: c.adr.rue, cp: c.adr.cp, ville: c.adr.ville, sit: f.sit, conjPrenom: cj ? cj.prenom : "", conjNom: cj ? cj.nom : "", conjSexe: cj ? cj.sexe : "", conjAge: cj ? String(cj.age) : "", conjProf: cj ? cj.prof || "" : "", conjRev: cj ? String(cj.rev || 0) : "",
      enfants: (f.enf || []).map(function (e) { return e.prenom + ", " + e.age; }).join("\n"), nbCharge: String(f.nbCharge || 0), prof: c.pro.prof || "", emp: c.pro.emp || "", ctr: c.pro.ctr || "", rev: String(c.pro.rev || 0) };
  }
  function contratsDe(c) { return CONTRATS[c.pro.statut] || null; }
  function declDe(st, cid) { var d = dossierDe(st, cid); return d && d.decl ? d.decl : null; }

  /* ---------- application aux fiches clients ---------- */
  function appliquer(st) {
    CL.forEach(function (c) {
      var o = ORIGINE[c.id], d = dossierDe(st, c.id);
      c.kyc = o.kyc; c.tel = o.tel; c.mob = o.mob; c.mail = o.mail;
      c.adr = copie(o.adr); c.fam = copie(o.fam); c.pro.prof = o.pro.prof; c.pro.emp = o.pro.emp; c.pro.ctr = o.pro.ctr; c.pro.rev = o.pro.rev; c.pro.foyer = o.pro.foyer;
      if (!d) return;
      var x = d.decl;
      if (x && x.adr && x.conj !== undefined && Array.isArray(x.enf)) {
        c.adr = copie(x.adr); c.fam.sit = x.sit; c.fam.conj = copie(x.conj); c.fam.enf = copie(x.enf); c.fam.nbCharge = x.nbCharge;
        c.pro.prof = x.prof; c.pro.emp = x.emp; c.pro.ctr = x.ctr; c.pro.rev = x.rev;
        if (typeof o.pro.foyer === "number") c.pro.foyer = Math.max(0, Math.round((o.pro.foyer + (x.rev - o.pro.rev) + ((x.conj ? x.conj.rev : 0) - (o.fam.conj ? o.fam.conj.rev || 0 : 0))) * 100) / 100);
      }
      var date = B.lireYmd(d.date), jours = date ? B.ecartJours(B.aujourdhui(), date) : NaN;
      if (jours >= 0 && jours < o.kyc) c.kyc = jours;
      if (typeof d.tel === "string") c.tel = d.tel;
      if (typeof d.mob === "string" && d.mob) c.mob = d.mob;
      if (typeof d.mail === "string" && d.mail) c.mail = d.mail;
    });
    var S = root && root.SGBF ? root.SGBF.synthese : null;
    if (S && S.viderCache) S.viderCache();
  }

  /* ---------- mise à jour ---------- */
  function maj(st, c, saisie) {
    var v = controle(saisie);
    if (!v.ok) return v;
    var dc = null;
    if (saisie && saisie.decl) { dc = controleDecl(saisie.decl, c); if (!dc.ok) return dc; }
    var avant = dossierDe(st, c.id), prefAvant = avant ? avant.pref || "" : "", chg = [];
    if (v.tel !== (c.tel || "")) chg.push("téléphone");
    if (v.mob !== c.mob) chg.push("mobile");
    if (v.mail !== c.mail) chg.push("e-mail");
    if (v.pref !== prefAvant) chg.push("mode de contact souhaité");
    if (dc) {
      var x = dc.decl, f = c.fam, cj = f.conj, enfTxt = function (l) { return l.map(function (e) { return e.prenom + "|" + e.age; }).join(";"); };
      if (x.adr.rue !== c.adr.rue || x.adr.cp !== c.adr.cp || x.adr.ville !== c.adr.ville) chg.push("adresse");
      if (x.sit !== f.sit) chg.push("situation familiale");
      if (JSON.stringify(x.conj ? [x.conj.prenom, x.conj.nom, x.conj.age, x.conj.prof, x.conj.rev] : null) !== JSON.stringify(cj ? [cj.prenom, cj.nom, cj.age, cj.prof || "", cj.rev || 0] : null) && x.sit === f.sit) chg.push("conjoint");
      if (enfTxt(x.enf) !== enfTxt(f.enf || []) || x.nbCharge !== (f.nbCharge || 0)) chg.push("enfants");
      if (x.prof !== (c.pro.prof || "") || x.emp !== (c.pro.emp || "") || x.ctr !== (c.pro.ctr || "")) chg.push("situation professionnelle");
      if (x.rev !== (c.pro.rev || 0)) chg.push("revenu net mensuel");
    }
    if (!st.infos[c.id]) st.infos[c.id] = {};
    st.infos[c.id].dossier = { date: B.ymd(B.aujourdhui()), tel: v.tel, mob: v.mob, mail: v.mail, pref: v.pref, par: (st.eleve && st.eleve.nom) || "" };
    if (dc) st.infos[c.id].dossier.decl = dc.decl; else if (avant && avant.decl) st.infos[c.id].dossier.decl = avant.decl;
    appliquer(st);
    return { ok: true, date: st.infos[c.id].dossier.date, modifies: chg };
  }
  /* Mode de contact souhaité (clé de PREFS) ; chaîne vide si aucune préférence. */
  function pref(st, cid) { var d = dossierDe(st, cid); return d && PREFS[d.pref] != null ? d.pref : ""; }
  /* Date de la dernière mise à jour faite par le conseiller (AAAA-MM-JJ), ou chaîne vide. */
  function majLe(st, cid) { var d = dossierDe(st, cid); return d && B.lireYmd(d.date) ? d.date : ""; }

  var api = { SITUATIONS: SITUATIONS, ORDRE_SIT: ORDRE_SIT, COUPLES: COUPLES, CONTRATS: CONTRATS, MAX_ENFANTS: MAX_ENFANTS, REV_MAX: REV_MAX, controleDecl: controleDecl, valeursDecl: valeursDecl, contratsDe: contratsDe, declDe: declDe, PREFS: PREFS, ORDRE_PREFS: ORDRE_PREFS, MAX_MAIL: MAX_MAIL, numero: numero, courriel: courriel, controle: controle, appliquer: appliquer, maj: maj, pref: pref, majLe: majLe, origine: function (id) { return ORIGINE[id]; } };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) {
    root.SGBF = root.SGBF || {}; root.SGBF.dossier = api;
    appliquer(B.store.charger());
  }
})(typeof window !== "undefined" ? window : null);
