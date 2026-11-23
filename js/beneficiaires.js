/* GS Banque & Assurance – clause bénéficiaire d'un contrat qui verse un capital au décès (assurance-vie, GS Décès, GS Obsèques) : les règles et la rédaction (sans affichage).
   Le conseiller choisit avec le client le bénéficiaire de premier rang, puis le bénéficiaire « à défaut » ; l'outil contrôle la clause d'après le dossier (un conjoint, des enfants), la rédige
   et signale ce qu'elle laisse ouvert. La saisie et l'affichage sont dans js/beneficiaires_ui.js, l'enregistrement dans js/catalogue.js (souscription), l'impression dans js/contrats.js.

   Produits concernés : GS Vie Patrimoine (AV), GS Vie Premium (AVP), GS Décès (DECES) et GS Obsèques (OBSQ), dont les fiches demandent une clause ou un bénéficiaire. Ne sont pas traités : GS Vie Enfant
   (contrat ouvert au nom d'un mineur), GS Prévoyance, le PER et les mandats de gestion, dont les fiches de produit ne demandent pas de clause.

   Sources (consultées le 17 novembre 2026) :
   - Rapport du 118e Congrès des notaires de France (2022), « Rédaction de la clause bénéficiaire : principes fondamentaux » : article L. 132-8 du Code des assurances (bénéficiaire désigné nommément ou par
     ses qualités, « déterminé » ou « déterminable » ; les enfants nés ou à naître ; les héritiers, qui reçoivent le capital en proportion de leurs parts héréditaires) ; sans bénéficiaire valablement
     désigné, le capital « revient dans l'actif de la succession » ; en cas de prédécès d'un enfant, sa part ne revient à ses descendants que si la clause prévoit une représentation, sinon elle est
     répartie entre les bénéficiaires de premier rang ; la qualité de conjoint s'apprécie au décès ; pour un concubin, la vie commune au décès doit être prouvée (article 515-8 du Code civil) ;
   - Crédit Mutuel, « Assurance-vie : comment bien rédiger la clause bénéficiaire de son contrat ? » : clause type (conjoint non divorcé ou partenaire de PACS, à défaut enfants vivants ou représentés,
     à défaut héritiers) ; identification d'une personne désignée nommément (nom, prénom, date et lieu de naissance) ; un second rang s'écrit « à défaut » ; une fois le bénéfice accepté par le bénéficiaire,
     la clause ne peut plus être modifiée sans son accord ; capitaux transmis : abattement de 152 500 € par bénéficiaire pour les primes versées avant 70 ans (article 990 I du Code général des impôts),
     puis 20 % jusqu'à 700 000 € et 31,25 % au-delà ; primes versées après 70 ans : droits de succession après un abattement de 30 500 € tous contrats confondus (article 757 B).
   Les textes de loi n'ont pas été lus sur Légifrance : les deux sources ci-dessus sont secondaires.
   Conventions de l'exercice (aucune règle officielle) : deux rangs au plus, puis toujours « à défaut, les héritiers » ; les enfants se partagent le capital par parts égales (pas de pourcentages ni de montants) ;
   pas de clause démembrée ; une personne désignée nommément est identifiée par ses nom, prénom, date et lieu de naissance (l'adresse n'est pas demandée) ; pour GS Obsèques, le bénéficiaire est un proche
   désigné nommément ou une entreprise de pompes funèbres. */
(function (root) {
  "use strict";

  var B = root && root.SGBF ? root.SGBF.banque : require("./banque.js");

  var PRODUITS = ["AV", "AVP", "DECES", "OBSQ"];
  function estConcerne(pid) { return PRODUITS.indexOf(pid) >= 0; }

  var NOM = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ' \-]{0,38}$/;
  var TYPES = {
    conjoint: "Conjoint ou partenaire de PACS",
    enfants_repr: "Enfants, vivants ou représentés",
    enfants_viv: "Enfants vivants, sans représentation",
    nomme: "Une personne désignée nommément",
    pompes: "Une entreprise de pompes funèbres",
    heritiers: "Héritiers"
  };
  function trim(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); }

  /* ---------- le dossier du client ---------- */
  function situation(c) { return (c && c.fam && c.fam.sit) || ""; }
  function nbEnfants(c) { return c && c.fam && c.fam.enf ? c.fam.enf.length : 0; }
  function aConjoint(c) { var s = situation(c); return s === "marie" || s === "pacse"; }
  function nomComplet(p) { return p ? p.prenom + " " + String(p.nom || "").toUpperCase() : ""; }
  function pl(n, s, p) { return n + " " + (n > 1 ? p : s); }

  /* Les choix proposés pour un rang, d'après le dossier : { v, lib, aide }. Un conjoint n'est proposé que si le dossier en mentionne un, des enfants que s'il y en a. */
  function choix(pid, c, rang) {
    var o = [], s = situation(c), n = nbEnfants(c);
    if (pid === "OBSQ") {
      if (rang === 1) {
        o.push({ v: "nomme", lib: TYPES.nomme + " (un proche)", aide: "Le proche reçoit le capital et règle les obsèques." });
        o.push({ v: "pompes", lib: TYPES.pompes, aide: "L'entreprise choisie par le client reçoit le capital directement." });
      }
      return o;
    }
    if (aConjoint(c)) {
      var cj = c.fam.conj;
      o.push({ v: "conjoint", lib: (s === "pacse" ? "Mon partenaire de PACS" : "Mon conjoint") + (cj ? " (" + nomComplet(cj) + ")" : ""), aide: s === "pacse" ? "Désigné par sa qualité de partenaire lié par un PACS au jour du décès." : "Désigné par sa qualité : non divorcé ni séparé de corps au jour du décès." });
    }
    if (n > 0) {
      o.push({ v: "enfants_repr", lib: "Mes enfants, vivants ou représentés (" + pl(n, "enfant", "enfants") + " au dossier)", aide: "Si un enfant est décédé avant le client, sa part va à ses propres enfants." });
      o.push({ v: "enfants_viv", lib: "Mes enfants vivants, sans représentation (" + pl(n, "enfant", "enfants") + " au dossier)", aide: "Si un enfant est décédé avant le client, sa part est partagée entre les autres bénéficiaires du même rang." });
    }
    o.push({ v: "nomme", lib: TYPES.nomme, aide: "Il faut ses nom, prénom, date et lieu de naissance." });
    o.push({ v: "heritiers", lib: "Mes héritiers", aide: "Ils reçoivent le capital en proportion de leurs parts héréditaires." });
    return o;
  }

  /* ---------- la rédaction ---------- */
  function majuscule(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function prenomPropre(p) { return trim(p).split(" ").map(function (m) { return m.split("-").map(function (x) { return x ? x.charAt(0).toUpperCase() + x.slice(1).toLowerCase() : x; }).join("-"); }).join(" "); }
  function nomme(p) {
    var d = B.lireYmd(p.naissance);
    return prenomPropre(p.prenom) + " " + trim(p.nom).toUpperCase() + ", né(e) le " + B.fmtDate(d) + " à " + trim(p.lieu);
  }
  /* Le morceau de phrase d'un rang (sans « à défaut »). */
  function morceau(t, c, p) {
    if (t === "conjoint") return situation(c) === "pacse" ? "à son partenaire lié par un PACS" : "à son conjoint non divorcé ni séparé de corps";
    if (t === "enfants_repr") return "à ses enfants, nés ou à naître, vivants ou représentés, par parts égales entre eux";
    if (t === "enfants_viv") return "à ses enfants, nés ou à naître, vivants au jour du décès, par parts égales entre eux et sans représentation";
    if (t === "nomme") return "à " + nomme(p || {});
    if (t === "pompes") return "à l'entreprise de pompes funèbres « " + trim((p || {}).raison) + " »";
    return "à ses héritiers, en proportion de leurs parts héréditaires";
  }
  function texte(clause, c) {
    var rangs = [clause.r1]; if (clause.r2 && clause.r1 !== "heritiers") rangs.push(clause.r2);
    if (rangs[rangs.length - 1] !== "heritiers") rangs.push("heritiers");
    var morceaux = rangs.map(function (t, i) { return morceau(t, c, i === 0 ? clause.p1 : clause.p2); });
    return "Au décès de l'assuré, le capital est versé " + morceaux.join(" ; à défaut, ") + ".";
  }

  /* ---------- le contrôle ---------- */
  function lireP(p) { p = p || {}; return { nom: trim(p.nom), prenom: trim(p.prenom), naissance: trim(p.naissance), lieu: trim(p.lieu), raison: trim(p.raison) }; }
  function controlerPersonne(p, c, pre) {
    if (!NOM.test(p.nom)) return { champ: pre + "nom", erreur: "Saisissez le nom de la personne désignée (lettres, espaces, traits d'union et apostrophes)." };
    if (!NOM.test(p.prenom)) return { champ: pre + "prenom", erreur: "Saisissez le prénom de la personne désignée (lettres, espaces, traits d'union et apostrophes)." };
    var d = B.lireYmd(p.naissance);
    if (!d) return { champ: pre + "naissance", erreur: "Saisissez la date de naissance de la personne désignée (jour, mois, année) : sans elle, la personne n'est pas identifiable." };
    if (p.naissance > B.ymd(B.aujourdhui())) return { champ: pre + "naissance", erreur: "La date de naissance de la personne désignée ne peut pas être postérieure à aujourd'hui." };
    if (d.getFullYear() < 1900) return { champ: pre + "naissance", erreur: "Cette date de naissance n'est pas plausible." };
    if (!p.lieu || p.lieu.length > 60) return { champ: pre + "lieu", erreur: "Saisissez la commune de naissance de la personne désignée (ou le pays), 60 caractères au plus." };
    if (c && p.nom.toLowerCase() === String(c.nom).toLowerCase() && p.prenom.toLowerCase() === String(c.prenom).toLowerCase())
      return { champ: pre + "nom", erreur: "La personne désignée est le client lui-même : elle ne peut pas être bénéficiaire de son propre contrat." };
    return null;
  }
  function refusType(t, c) {
    var s = situation(c);
    if (t === "conjoint" && !aConjoint(c)) {
      return s === "concubinage" ? "Le client vit en concubinage : un concubin n'est pas un conjoint. Choisissez « Une personne désignée nommément » : la clause l'identifie par ses nom, prénom, date et lieu de naissance."
        : "Le dossier ne mentionne ni conjoint ni partenaire de PACS (situation : " + libSituation(s) + ") : choisissez un autre bénéficiaire.";
    }
    if ((t === "enfants_repr" || t === "enfants_viv") && nbEnfants(c) === 0) return "Le dossier ne mentionne aucun enfant : choisissez un autre bénéficiaire.";
    return "";
  }
  var SITUATIONS = { celibataire: "célibataire", marie: "marié(e)", pacse: "pacsé(e)", concubinage: "en concubinage", divorce: "divorcé(e)", veuf: "veuf ou veuve" };
  function libSituation(s) { return SITUATIONS[s] || s || "non renseignée"; }

  /* Contrôle de la saisie s = { r1, r2, p1, p2 } pour le produit pid et le client c. Renvoie { ok, clause, points } ou { ok: false, champ, erreur }. */
  function valider(pid, c, s) {
    s = s || {};
    if (!estConcerne(pid)) return { ok: false, champ: "clause", erreur: "Ce produit ne comporte pas de clause bénéficiaire dans l'outil." };
    var r1 = String(s.r1 || ""), r2 = String(s.r2 || ""), p1 = lireP(s.p1), p2 = lireP(s.p2);
    var autorises1 = choix(pid, c, 1).map(function (x) { return x.v; }), autorises2 = choix(pid, c, 2).map(function (x) { return x.v; });
    if (!r1) return { ok: false, champ: "bf-r1", erreur: pid === "OBSQ" ? "Choisissez le bénéficiaire du capital : un proche désigné nommément ou une entreprise de pompes funèbres." : "Choisissez le bénéficiaire de premier rang de la clause." };
    if (pid !== "OBSQ" && r1 === "pompes") return { ok: false, champ: "bf-r1", erreur: "Une entreprise de pompes funèbres ne peut être bénéficiaire que du contrat GS Obsèques." };
    var t1 = refusType(r1, c); if (t1) return { ok: false, champ: "bf-r1", erreur: t1 };
    if (autorises1.indexOf(r1) < 0) return { ok: false, champ: "bf-r1", erreur: "Ce bénéficiaire n'est pas possible pour ce produit." };
    if (r1 === "nomme") { var e1 = controlerPersonne(p1, c, "bf-1-"); if (e1) return { ok: false, champ: e1.champ, erreur: e1.erreur }; }
    if (r1 === "pompes" && (p1.raison.length < 2 || p1.raison.length > 60 || !/[A-Za-zÀ-ÿ]/.test(p1.raison))) return { ok: false, champ: "bf-1-raison", erreur: "Saisissez le nom de l'entreprise de pompes funèbres choisie par le client (2 à 60 caractères)." };
    if (r2) {
      if (pid === "OBSQ") return { ok: false, champ: "bf-r2", erreur: "Le contrat GS Obsèques n'a qu'un bénéficiaire : à défaut, ce sont les héritiers." };
      if (r1 === "heritiers") return { ok: false, champ: "bf-r2", erreur: "Les héritiers sont toujours le dernier rang : aucun bénéficiaire ne peut venir après eux." };
      var t2 = refusType(r2, c); if (t2) return { ok: false, champ: "bf-r2", erreur: t2 };
      if (r2 === "pompes") return { ok: false, champ: "bf-r2", erreur: "Une entreprise de pompes funèbres ne peut être bénéficiaire que du contrat GS Obsèques." };
      if (autorises2.indexOf(r2) < 0) return { ok: false, champ: "bf-r2", erreur: "Ce bénéficiaire n'est pas possible pour ce produit." };
      var groupe = function (t) { return t === "enfants_repr" || t === "enfants_viv" ? "enfants" : t; };
      if (groupe(r1) === groupe(r2) && r1 !== "nomme") return { ok: false, champ: "bf-r2", erreur: groupe(r1) === "enfants" ? "Les enfants figurent déjà au premier rang : choisissez les mêmes enfants une seule fois, avec ou sans représentation." : "Le même bénéficiaire ne peut pas figurer à deux rangs." };
      if (r2 === "nomme") {
        var e2 = controlerPersonne(p2, c, "bf-2-"); if (e2) return { ok: false, champ: e2.champ, erreur: e2.erreur };
        if (r1 === "nomme" && p1.nom.toLowerCase() === p2.nom.toLowerCase() && p1.prenom.toLowerCase() === p2.prenom.toLowerCase() && p1.naissance === p2.naissance)
          return { ok: false, champ: "bf-2-nom", erreur: "La même personne ne peut pas figurer à deux rangs." };
      }
    }
    var clause = { r1: r1, r2: r2 === "heritiers" ? "heritiers" : r2 };
    if (r1 === "nomme" || r1 === "pompes") clause.p1 = p1;
    if (r2 === "nomme") clause.p2 = p2;
    clause.texte = texte(clause, c);
    return { ok: true, clause: clause, points: points(pid, c, clause) };
  }

  /* Ce que la clause laisse ouvert ou ce qu'elle entraîne : points d'attention pour le conseiller (aucun ne bloque la souscription). */
  function points(pid, c, clause) {
    var p = [], rangs = [clause.r1, clause.r2], s = situation(c);
    if (rangs.indexOf("conjoint") >= 0) p.push("La qualité de conjoint s'apprécie au décès : un conjoint divorcé à ce moment-là ne reçoit rien. Le client doit refaire sa clause s'il divorce.");
    if (rangs.indexOf("enfants_viv") >= 0) p.push("Sans représentation, la part d'un enfant décédé avant le client ne revient pas à ses enfants : elle est partagée entre les autres bénéficiaires du même rang.");
    if (rangs.indexOf("enfants_repr") >= 0) p.push("Avec la représentation, la part d'un enfant décédé avant le client revient à ses propres enfants.");
    if (s === "concubinage" && rangs.indexOf("nomme") < 0 && pid !== "OBSQ") p.push("Le client vit en concubinage : pour que son concubin reçoive le capital, désignez-le nommément. Désigné par sa seule qualité, il devrait prouver la vie commune au décès (article 515-8 du Code civil).");
    if (s === "divorce" || s === "veuf" || s === "celibataire") { if (nbEnfants(c) === 0 && rangs.indexOf("nomme") < 0 && pid !== "OBSQ") p.push("Le dossier ne mentionne ni conjoint ni enfant : sans bénéficiaire nommé, le capital revient aux héritiers du client."); }
    if (clause.r2 !== "heritiers" && clause.r1 !== "heritiers" && pid !== "OBSQ") p.push("Si aucun bénéficiaire désigné ne peut recevoir le capital, il revient aux héritiers du client : l'outil l'ajoute toujours en dernier rang.");
    if (pid === "OBSQ") p.push("Le capital est versé au bénéficiaire désigné ; s'il ne peut pas le recevoir, il revient aux héritiers du client.");
    if (pid === "AV" || pid === "AVP" || pid === "DECES") {
      if (pid !== "DECES" && c.age >= 70) p.push("Le client a " + c.age + " ans : les primes versées après 70 ans relèvent des droits de succession, après un abattement de 30 500 € tous contrats confondus (article 757 B du Code général des impôts) ; seules les primes versées avant 70 ans bénéficient de l'abattement de 152 500 € par bénéficiaire (article 990 I).");
      else p.push("Primes versées avant 70 ans : abattement de 152 500 € par bénéficiaire sur le capital transmis, puis 20 % jusqu'à 700 000 € et 31,25 % au-delà (article 990 I du Code général des impôts).");
    }
    p.push("Tant que le bénéficiaire n'a pas accepté le bénéfice du contrat, le client peut modifier la clause ; une fois l'acceptation donnée, la clause ne peut plus changer sans l'accord du bénéficiaire.");
    return p;
  }

  /* Aperçu pour l'écran : la clause rédigée si elle est valide, sinon ce qu'il reste à saisir. */
  function apercu(pid, c, s) {
    var v = valider(pid, c, s);
    if (v.ok) return { ok: true, texte: v.clause.texte, points: v.points };
    return { ok: false, champ: v.champ, erreur: v.erreur };
  }

  var api = { PRODUITS: PRODUITS, TYPES: TYPES, SITUATIONS: SITUATIONS, estConcerne: estConcerne, situation: situation, choix: choix, texte: texte, valider: valider, points: points, apercu: apercu, libSituation: libSituation };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.beneficiaires = api; }
})(typeof window !== "undefined" ? window : null);
