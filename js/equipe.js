/* GS Banque & Assurance – équipe de l'agence et agenda partagé.
   L'agence de Paris compte six postes : l'étudiant (conseiller clientèle particuliers), un autre conseiller clientèle particuliers, deux conseillers clientèle privée,
   un conseiller clientèle professionnelle et la directrice d'agence. Les cinq collègues sont des personnes FICTIVES (noms inventés, numéros dans la tranche 01 99 00 82 xx
   réservée à la fiction, adresses en « .example ») ; leurs agendas sont calculés, jour par jour, par une formule qui ne dépend que de la date : le même jour donne toujours
   le même agenda, d'une connexion à l'autre. Ils ne dépendent donc ni de l'heure du poste ni de ce que l'étudiant a saisi, sauf les rendez-vous qu'il prend avec eux.
   Ce que voit l'étudiant d'un collègue, comme dans un vrai agenda partagé : les plages occupées et leur nature (rendez-vous client, réunion, absence…), jamais le nom du client.
   Règles de l'exercice (aucune règle officielle) :
   - tous les conseillers ont la plage « Proactivité » (11 h – 12 h) ; les deux conseillers clientèle particuliers ont aussi la gestion des débiteurs, atypiques et GDI (9 h 10 – 10 h)
     et une plage accueil d'une heure par jour (jamais la même heure que celle de l'étudiant) ; la directrice a le pilotage de l'agence (9 h – 10 h) et le comité de crédit (mardi et vendredi, 15 h – 16 h) ;
   - réunion d'équipe le jeudi, 14 h – 15 h, pour tous ;
   - chacun a des rendez-vous clients, et une absence (journée ou demi-journée) un jour d'ouverture sur huit environ ;
   - un rendez-vous avec un collègue dure une heure et n'est possible que si le collègue ET l'étudiant sont libres (le collègue accepte alors d'office) ;
   - un rendez-vous d'un client avec un collègue (le client est reçu par le collègue seul) dure une heure et n'exige que la disponibilité du collègue : l'étudiant n'y assiste pas, il reste libre. */
(function (root) {
  "use strict";

  var B = root && root.SGBF ? root.SGBF.banque : require("./banque.js");
  function agenda() { return root && root.SGBF ? root.SGBF.agenda : require("./agenda.js"); }

  var DUREE = 60, DOMAINE = "gs-banque-assurance.example", JOUR_REUNION = 4;
  var POSTES = {
    ccp: { m: "Conseiller clientèle particuliers", f: "Conseillère clientèle particuliers", court: "Particuliers" },
    ccpr: { m: "Conseiller clientèle privée", f: "Conseillère clientèle privée", court: "Clientèle privée" },
    ccpro: { m: "Conseiller clientèle professionnelle", f: "Conseillère clientèle professionnelle", court: "Professionnels" },
    dir: { m: "Directeur d'agence", f: "Directrice d'agence", court: "Direction" }
  };
  /* L'ordre est celui des colonnes de la grille : l'étudiant, puis ses collègues par métier, la directrice en dernier. */
  var COLLABS = [
    { id: "moi", poste: "ccp", moi: true },
    { id: "nb", prenom: "Nadia", nom: "Benali", civ: "Mme", poste: "ccp", direct: "01 99 00 82 11" },
    { id: "tl", prenom: "Thomas", nom: "Lefèvre", civ: "M.", poste: "ccpr", direct: "01 99 00 82 12" },
    { id: "ca", prenom: "Claire", nom: "Aubert", civ: "Mme", poste: "ccpr", direct: "01 99 00 82 13" },
    { id: "kh", prenom: "Karim", nom: "Haddad", civ: "M.", poste: "ccpro", direct: "01 99 00 82 14" },
    { id: "pd", prenom: "Hélène", nom: "Delorme", civ: "Mme", poste: "dir", direct: "01 99 00 82 10" }
  ];
  var PAR_ID = {}; COLLABS.forEach(function (c) { PAR_ID[c.id] = c; });
  var REPARTITION = { ccp: 2, ccpr: 2, ccpro: 1, dir: 1 };   /* composition de l'agence demandée : 2 + 2 + 1 + 1 */

  function ascii(s) { return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9-]/g, ""); }
  function collab(id) { return PAR_ID[id] || null; }
  function collegues() { return COLLABS.filter(function (c) { return !c.moi; }); }
  function posteLib(c) { var p = POSTES[c.poste]; return c.civ === "Mme" ? p.f : p.m; }
  /* Nom de l'étudiant : celui de la sauvegarde partagée s'il respecte la règle de identite.js (prénom et nom, lettres seulement), sinon « Vous ». */
  function nomEleve(st) {
    var n = st && st.eleve && typeof st.eleve.nom === "string" ? st.eleve.nom.replace(/\s+/g, " ").trim() : "";
    return n.length >= 3 && n.length <= 60 && /^[\p{L}][\p{L}' -]*$/u.test(n) && n.split(" ").length >= 2 ? n : "";
  }
  function nomComplet(c, st) { return c.moi ? (nomEleve(st) || "Vous") : c.prenom + " " + c.nom; }
  function mail(c) { return c.moi ? null : ascii(c.prenom) + "." + ascii(c.nom) + "@" + DOMAINE; }

  /* ---------- heures ---------- */
  function minutes(h) { var m = /^(\d{2}):(\d{2})$/.exec(String(h == null ? "" : h)); if (!m) return NaN; var H = +m[1], M = +m[2]; return H > 23 || M > 59 ? NaN : H * 60 + M; }
  function hhmm(n) { return (n < 600 ? "0" : "") + Math.floor(n / 60) + ":" + (n % 60 < 10 ? "0" : "") + (n % 60); }
  function hTxt(h) { var m = /^(\d{2}):(\d{2})$/.exec(h || ""); return m ? (+m[1]) + " h" + (m[2] === "00" ? "" : " " + m[2]) : ""; }

  /* ---------- nombre pseudo-aléatoire stable : ne dépend que du collègue, du jour et de la raison ---------- */
  function hasard(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; h = Math.imul(h, 3266489917) >>> 0; h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function tirage(id, jour, raison) { return hasard(id + "|" + jour + "|" + raison); }

  /* ---------- agenda d'un collègue un jour donné (sans les rendez-vous de l'étudiant) ---------- */
  /* Chaque jour d'ouverture d'une même année a, pour un collègue donné, un agenda DIFFÉRENT de tous les autres jours de cette année : la formule tire d'abord un agenda au hasard
     (stable : il ne dépend que du collègue, du jour et d'un numéro d'essai), puis, si un jour plus tôt dans l'année a déjà exactement le même agenda, elle recommence avec l'essai suivant.
     Les jours sont examinés dans l'ordre du calendrier, du 1er janvier au 31 décembre : le résultat d'un jour ne dépend donc jamais de l'ordre dans lequel on les consulte. */
  var PROBA_RDV = { ccp: 0.3, ccpr: 0.45, ccpro: 0.4, dir: 0.2 };
  /* Nature des rendez-vous (jamais le nom du client). Le libellé complet est « début : nature ». */
  var DEBUT_RDV = { ccp: "Rendez-vous client", ccpr: "Rendez-vous patrimonial", ccpro: "Rendez-vous professionnel" };
  var NATURES_RDV = {
    ccp: ["ouverture de compte", "crédit à la consommation", "assurance", "épargne", "carte et moyens de paiement", "bilan de situation", "découvert ou incident", "projet immobilier"],
    ccpr: ["assurance-vie", "placements", "bilan patrimonial", "succession", "projet immobilier", "préparation de la retraite", "transmission", "fiscalité de l'épargne"],
    ccpro: ["ouverture de compte professionnel", "crédit d'investissement", "terminal de paiement", "assurance des professionnels", "trésorerie", "bilan annuel", "création d'entreprise", "garanties et cautions"],
    dir: ["Rendez-vous client : réclamation", "Rendez-vous client : dossier de crédit", "Rendez-vous client : situation sensible", "Rendez-vous client : ouverture de compte à valider",
      "Rendez-vous partenaire : assureur", "Rendez-vous partenaire : promoteur immobilier", "Rendez-vous partenaire : entreprise de la zone", "Rendez-vous client : professionnel"]
  };
  function libRdv(poste, i) { return poste === "dir" ? NATURES_RDV.dir[i] : DEBUT_RDV[poste] + " : " + NATURES_RDV[poste][i]; }
  /* Motifs d'une absence d'une journée entière : une même année ne peut pas en compter plus que de motifs (chaque jour d'ouverture a un agenda différent). */
  var MOTIFS_ABSENCE = ["congé", "RTT", "formation", "récupération", "congé exceptionnel", "pont", "déplacement", "séminaire"];
  var cache = {};
  function bloc(debut, fin, lib, genre) { return { debut: debut, fin: fin, lib: lib, genre: genre }; }
  function chevauche(a, b) { return a.debut < b.fin && a.fin > b.debut; }
  function signature(blocs) { return blocs.map(function (b) { return b.debut + "-" + b.fin + "-" + b.lib; }).join("|"); }

  /* Un tirage de l'agenda du collègue « c » le jour « d » ; « graine » = jour, suivi du numéro d'essai à partir du deuxième. */
  function planBrut(c, d, graine) {
    var id = c.id, ouv = B.plagesAgence(d), blocs = [];
    var debutJ = minutes(ouv[0][0]), finJ = minutes(ouv[ouv.length - 1][1]);
    var fem = c.civ === "Mme", abs = fem ? "Absente" : "Absent";
    /* absence : une journée ou une demi-journée environ un jour d'ouverture sur huit */
    var a = tirage(id, graine, "absence");
    if (a < 1 / 24) {
      var motif = MOTIFS_ABSENCE[Math.floor(tirage(id, graine, "motif") * MOTIFS_ABSENCE.length) % MOTIFS_ABSENCE.length];
      blocs.push(bloc(hhmm(debutJ), hhmm(finJ), abs + " (" + motif + ")", "absence"));
    } else if (a < 3 / 24) {
      var matin = ouv.length === 1 || tirage(id, graine, "demi") < 0.5;
      blocs.push(matin ? bloc(hhmm(debutJ), hhmm(minutes(ouv[0][1])), abs + " (matin)", "absence") : bloc(hhmm(minutes(ouv[1][0])), hhmm(finJ), abs + " (après-midi)", "absence"));
    }
    var absent = blocs.slice();
    function ajouter(debut, fin, lib, genre) {
      var b = { debut: minutes(debut), fin: minutes(fin) };
      if (!absent.some(function (x) { return chevauche(b, { debut: minutes(x.debut), fin: minutes(x.fin) }); })) blocs.push(bloc(debut, fin, lib, genre));
      else blocs.push(bloc(debut, fin, lib, "masque"));   /* présent dans la formule, mais recouvert par l'absence : ne s'affiche pas */
    }
    function occupe(bb) { return blocs.some(function (x) { return chevauche(bb, { debut: minutes(x.debut), fin: minutes(x.fin) }); }); }
    if (d.getDay() === JOUR_REUNION) ajouter("14:00", "15:00", "Réunion d'équipe", "reunion");
    if (c.poste !== "dir") ajouter("11:00", "12:00", "Proactivité", "fixe");
    if (c.poste === "ccp") ajouter("09:10", "10:00", "Gestion des débiteurs, atypiques et GDI", "fixe");
    if (c.poste === "dir") {
      ajouter("09:00", "10:00", "Pilotage de l'agence", "fixe");
      if (d.getDay() === 2 || d.getDay() === 5) ajouter("15:00", "16:00", "Comité de crédit", "fixe");
    }
    /* plage accueil des conseillers clientèle particuliers : une heure pleine, pas celle de l'étudiant */
    if (c.poste === "ccp") {
      var moiAccueil = B.plagesReservees(d).filter(function (p) { return p.id === "accueil"; })[0], cand = [];
      ouv.forEach(function (p) {
        for (var s = minutes(p[0]); s + 60 <= minutes(p[1]); s += 60) {
          if (!occupe({ debut: s, fin: s + 60 }) && !(moiAccueil && s === minutes(moiAccueil.debut))) cand.push(s);
        }
      });
      if (cand.length) { var s0 = cand[Math.floor(tirage(id, graine, "accueil") * cand.length) % cand.length]; ajouter(hhmm(s0), hhmm(s0 + 60), "Plage accueil", "fixe"); }
    }
    /* rendez-vous clients : sur les heures encore libres, au hasard (sans le nom du client). Dans une heure : un rendez-vous d'une heure, d'une demi-heure (début ou fin d'heure)
       ou deux rendez-vous d'une demi-heure ; la nature de chaque rendez-vous est tirée parmi huit. */
    var nb = NATURES_RDV[c.poste].length;
    ouv.forEach(function (p) {
      for (var s = minutes(p[0]); s + 60 <= minutes(p[1]); s += 60) {
        if (occupe({ debut: s, fin: s + 60 })) continue;
        if (tirage(id, graine, "rdv" + s) >= PROBA_RDV[c.poste]) continue;
        var v = tirage(id, graine, "forme" + s), n1 = Math.floor(tirage(id, graine, "nature" + s + "a") * nb) % nb, n2 = Math.floor(tirage(id, graine, "nature" + s + "b") * nb) % nb;
        if (v < 0.55) blocs.push(bloc(hhmm(s), hhmm(s + 60), libRdv(c.poste, n1), "client"));
        else if (v < 0.70) blocs.push(bloc(hhmm(s), hhmm(s + 30), libRdv(c.poste, n1), "client"));
        else if (v < 0.85) blocs.push(bloc(hhmm(s + 30), hhmm(s + 60), libRdv(c.poste, n1), "client"));
        else { blocs.push(bloc(hhmm(s), hhmm(s + 30), libRdv(c.poste, n1), "client")); blocs.push(bloc(hhmm(s + 30), hhmm(s + 60), libRdv(c.poste, n2), "client")); }
      }
    });
    blocs = blocs.filter(function (x) { return x.genre !== "masque"; });
    blocs.sort(function (x, y) { return minutes(x.debut) - minutes(y.debut) || minutes(x.fin) - minutes(y.fin); });
    return blocs;
  }

  /* Tous les agendas d'une année pour un collègue, jour après jour, chacun différent de tous les précédents. */
  var ESSAIS_MAX = 600;
  function construireAnnee(c, an) {
    var vus = {};
    for (var n = 0; ; n++) {
      var x = new Date(an, 0, 1 + n, 12);
      if (x.getFullYear() !== an) break;
      var k = B.ymd(x), blocs = [];
      if (B.plagesAgence(x).length) {
        var essai = 0, sig;
        do { blocs = planBrut(c, x, essai ? k + "#" + essai : k); sig = signature(blocs); essai++; } while (vus[sig] && essai < ESSAIS_MAX);
        vus[sig] = true;
      }
      cache[c.id + "|" + k] = blocs;
    }
  }
  function planJour(id, d) {
    var k = B.ymd(d), cle = id + "|" + k;
    if (cache[cle]) return cache[cle];
    var c = collab(id);
    if (!c || c.moi) { cache[cle] = []; return cache[cle]; }
    construireAnnee(c, d.getFullYear());
    return cache[cle] || (cache[cle] = []);
  }

  /* Rendez-vous que l'étudiant a pris avec ce collègue (encore à faire) ce jour-là : les siens (« interne ») et ceux qu'il a pris pour un client (« rdv_col »).
     « sauf » : identifiant d'un élément à ne pas compter (celui qu'on modifie). */
  function rdvAvecMoi(st, id, d, sauf) {
    var k = B.ymd(d), l = [];
    (st && Array.isArray(st.agenda) ? st.agenda : []).forEach(function (x) {
      if ((x.type === "interne" || x.type === "rdv_col") && x.avec === id && x.statut === "afaire" && x.date === k && x.id !== sauf && !isNaN(minutes(x.heure))) {
        var cl = x.type === "rdv_col" ? agenda().client(x.client) : null;
        l.push(bloc(x.heure, hhmm(minutes(x.heure) + DUREE), x.type === "rdv_col" ? "Rendez-vous client pris par vous" + (cl ? " : " + cl.prenom + " " + cl.nom : "") + " : " + x.objet : "Rendez-vous avec vous : " + x.objet, "moi"));
      }
    });
    return l;
  }
  function occupations(st, id, d, sauf) {
    return planJour(id, d).concat(rdvAvecMoi(st, id, d, sauf)).sort(function (x, y) { return minutes(x.debut) - minutes(y.debut) || minutes(x.fin) - minutes(y.fin); });
  }
  /* Première occupation qui empiète sur [heure, heure + durée). */
  function occupationA(st, id, d, heure, duree, sauf) {
    var t = minutes(heure), res = null;
    occupations(st, id, d, sauf).forEach(function (b) { if (!res && t < minutes(b.fin) && t + (duree || DUREE) > minutes(b.debut)) res = b; });
    return res;
  }
  /* Heures de début possibles (toutes les 30 minutes) où le collègue est libre une heure, pendant les heures d'ouverture ; dernier rendez-vous à 12 h le matin et le samedi, 17 h l'après-midi. */
  function heuresLibres(st, id, d, sauf) {
    var r = [];
    B.plagesAgence(d).forEach(function (p) {
      for (var s = minutes(p[0]); s + DUREE <= minutes(p[1]); s += 30) if (!occupationA(st, id, d, hhmm(s), DUREE, sauf)) r.push(hhmm(s));
    });
    return r;
  }
  function liste(h) { return h.map(hTxt).join(", "); }
  /* Message à afficher quand le collègue n'est pas libre à l'heure demandée ; null si tout va bien. */
  function indisponibilite(st, id, d, heure, sauf) {
    var c = collab(id);
    if (!c || c.moi) return "Choisissez le collègue avec qui vous prenez rendez-vous.";
    var b = occupationA(st, id, d, heure, DUREE, sauf);
    if (!b) return null;
    var nom = c.prenom + " " + c.nom, libres = heuresLibres(st, id, d, sauf);
    var pourquoi = b.genre === "absence" ? nom + " est " + (c.civ === "Mme" ? "absente" : "absent") + " à ce moment-là (" + b.lib.replace(/^Absente? \(/, "").replace(/\)$/, "") + ")" :
      nom + " n'est pas disponible à " + hTxt(heure) + " : " + b.lib.charAt(0).toLowerCase() + b.lib.slice(1) + " de " + hTxt(b.debut) + " à " + hTxt(b.fin);
    return pourquoi + ". " + (libres.length ? "Heures de début où " + c.prenom + " est libre ce jour-là : " + liste(libres) + "." : c.prenom + " n'a aucun créneau libre ce jour-là.");
  }
  /* Heures de début où le collègue ET l'étudiant sont libres ce jour-là (règles de l'agenda de l'étudiant comprises : plages réservées, autres rendez-vous, heure déjà passée). */
  function creneauxCommuns(st, id, d, sauf) {
    var AG = agenda();
    return heuresLibres(st, id, d, sauf).filter(function (h) {
      return !AG.passe(d, h) && !AG.conflit(st, d, h, sauf || null);
    });
  }
  /* Prochains créneaux communs à partir d'une date : { date, heure } sur au plus « n » créneaux et 30 jours d'ouverture. */
  function prochains(st, id, depuis, n) {
    var r = [], d = B.agenceSuivant(depuis), AG = agenda(), garde = 0;
    while (r.length < n && garde < 45) {
      if (B.ecartJours(d, B.aujourdhui()) > AG.HORIZON) break;
      creneauxCommuns(st, id, d, null).forEach(function (h) { if (r.length < n) r.push({ date: B.ymd(d), heure: h }); });
      d = B.agenceSuivant(B.plusJours(d, 1)); garde++;
    }
    return r;
  }

  /* Rendez-vous d'un client avec le collègue : seules comptent la disponibilité du collègue, l'heure (pas déjà passée) et les autres rendez-vous du client.
     Heures de début possibles ce jour-là ; « cid » facultatif (client concerné), « sauf » = élément modifié. */
  function creneauxClient(st, id, d, cid, sauf) {
    var AG = agenda();
    return heuresLibres(st, id, d, sauf).filter(function (h) {
      return !AG.passe(d, h) && !(cid && AG.conflitClient(st, cid, d, h, sauf || null));
    });
  }
  function prochainsClient(st, id, depuis, n, cid) {
    var r = [], d = B.agenceSuivant(depuis), AG = agenda(), garde = 0;
    while (r.length < n && garde < 45) {
      if (B.ecartJours(d, B.aujourdhui()) > AG.HORIZON) break;
      creneauxClient(st, id, d, cid, null).forEach(function (h) { if (r.length < n) r.push({ date: B.ymd(d), heure: h }); });
      d = B.agenceSuivant(B.plusJours(d, 1)); garde++;
    }
    return r;
  }

  /* ---------- grille de la journée : une colonne par poste, une ligne par heure de début possible ---------- */
  /* Colonne de l'étudiant : ses plages réservées, les rendez-vous de l'agence et ceux qu'il a planifiés (une heure chacun). */
  function occupationsMoi(st, d) {
    var AG = agenda(), l = [];
    AG.jour(st, d).forEach(function (e) {
      if (e.kind === "plage") l.push(bloc(e.heure, e.fin, e.motif, "fixe"));
      else if (e.kind === "agence" && e.heure) l.push(bloc(e.heure, hhmm(minutes(e.heure) + DUREE), "Rendez-vous client : " + e.client.prenom + " " + e.client.nom, "client"));
      else if (e.kind === "perso" && e.statut === "afaire" && e.heure && (e.type === "rdv" || e.type === "interne")) {
        var c = e.type === "interne" ? collab(e.avec) : null;
        l.push(bloc(e.heure, hhmm(minutes(e.heure) + DUREE), e.type === "interne" ? "Rendez-vous avec " + (c ? c.prenom + " " + c.nom : "un collègue") + " : " + e.motif : "Rendez-vous client" + (e.client ? " : " + e.client.prenom + " " + e.client.nom : "") + " : " + e.motif, e.type === "interne" ? "moi" : "client"));
      }
    });
    return l.sort(function (x, y) { return minutes(x.debut) - minutes(y.debut); });
  }
  function jourEquipe(st, d) {
    var ouv = B.plagesAgence(d), heures = [];
    ouv.forEach(function (p) { for (var s = minutes(p[0]); s + DUREE <= minutes(p[1]); s += 60) heures.push(hhmm(s)); });
    var colonnes = COLLABS.map(function (c) {
      var occ = c.moi ? occupationsMoi(st, d) : occupations(st, c.id, d, null);
      return { collab: c, cellules: heures.map(function (h) {
        var t = minutes(h), b = null;
        occ.forEach(function (x) { if (!b && t < minutes(x.fin) && t + DUREE > minutes(x.debut)) b = x; });
        if (b) return { heure: h, etat: "occupe", lib: b.lib, debut: b.debut, fin: b.fin, genre: b.genre };
        return { heure: h, etat: "libre" };
      }) };
    });
    /* cellule libre d'un collègue : on peut réserver si l'étudiant l'est aussi à cette heure */
    var AG = agenda(), moi = colonnes[0].cellules;
    colonnes.forEach(function (col) {
      if (col.collab.moi) return;
      col.cellules.forEach(function (cel, i) {
        if (cel.etat !== "libre") return;
        var passe = AG.passe(d, cel.heure);
        cel.commun = moi[i].etat === "libre" && !passe && !AG.conflit(st, d, cel.heure, null);
        if (!cel.commun) cel.raison = passe ? "passe" : "moi";
        cel.client = !passe;   /* le collègue peut recevoir un client à cette heure, que l'étudiant soit libre ou non */
      });
    });
    return { date: d, ouvert: ouv.length > 0, heures: heures, colonnes: colonnes };
  }

  var api = {
    DUREE: DUREE, DOMAINE: DOMAINE, POSTES: POSTES, COLLABS: COLLABS, REPARTITION: REPARTITION, JOUR_REUNION: JOUR_REUNION,
    collab: collab, collegues: collegues, posteLib: posteLib, nomComplet: nomComplet, mail: mail,
    planJour: planJour, occupations: occupations, occupationA: occupationA, heuresLibres: heuresLibres, indisponibilite: indisponibilite,
    creneauxCommuns: creneauxCommuns, prochains: prochains, creneauxClient: creneauxClient, prochainsClient: prochainsClient, jourEquipe: jourEquipe, occupationsMoi: occupationsMoi, minutes: minutes, hTxt: hTxt
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.equipe = api; }
})(typeof window !== "undefined" ? window : null);
