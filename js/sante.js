/* GS Banque & Assurance – questionnaire de santé : les questions et la règle qui conclut.
   Ce module ne fait que des calculs (aucun accès à la page) : la saisie et l'affichage sont dans js/app_catalogue.js (souscription d'une assurance) et js/app_montage.js
   (assurance emprunteur du montage de prêt). Les règles sont celles de l'exercice : une assurance réelle pose beaucoup plus de questions et décide avec un médecin.

   Six questionnaires :
   - DECES (GS Décès), PREV (GS Prévoyance) : questionnaire complet ;
   - DEP (GS Autonomie) : questionnaire complet et deux questions sur la dépendance ;
   - OBSQ (GS Obsèques), GAV (GS Protection Famille) : questionnaire simplifié ;
   - EMPRUNTEUR : assurance d'un crédit ; une question sur le cancer et l'hépatite C applique le « droit à l'oubli » de la convention AERAS.

   Chaque question a un effet quand la réponse est « oui » : « etude » (l'assureur examine le dossier médical), « refus » (risque non assurable) ou « info » (aucun effet sur la décision).
   Décision : « refus » si une réponse a l'effet « refus » ; sinon « etude » si une réponse a l'effet « etude » ou si l'indice de masse corporelle sort de la plage acceptée ;
   sinon « accepte ». Rien n'est conservé hors de la décision : ni les réponses, ni les motifs (secret médical). */
(function (root) {
  "use strict";

  /* Indice de masse corporelle accepté sans étude : de 17 inclus à 35 exclu (convention de l'exercice). */
  var IMC = { min: 17, max: 35 };
  /* Convention AERAS : prêts assurés jusqu'à 420 000 € et contrats qui se terminent avant les 71 ans de l'assuré ; droit à l'oubli du cancer et de l'hépatite virale C
     (fin du protocole thérapeutique depuis plus de 5 ans, sans rechute). Délai de réponse de l'assureur : 3 semaines au plus pour un dossier complet. */
  var AERAS = { capitalMax: 420000, ageMax: 71, oubliAns: 5, delaiSemaines: 3 };
  /* Saisies admises pour la taille et le poids (au-delà, c'est une faute de frappe). */
  var MESURES = { tailleMin: 100, tailleMax: 230, poidsMin: 25, poidsMax: 250 };

  /* ---------- les questions ---------- */
  /* type « on » : oui ou non ; « mesure » : taille et poids ; « oubli » : trois réponses (non, oui plus de 5 ans, oui 5 ans ou moins). */
  var Q = {
    mesure: { id: "mesure", type: "mesure", lib: "Taille et poids", aide: "Taille en centimètres, poids en kilogrammes. L'assureur en déduit l'indice de masse corporelle (poids ÷ taille², la taille étant en mètres) : de 17 à moins de 35, aucune étude." },
    tabac: { id: "tabac", type: "on", lib: "Avez-vous fumé (cigarette, cigare, pipe) ou vapoté au cours des 24 derniers mois ?", effet: "info", aide: "Sans effet sur la décision dans l'outil : un assureur fait payer plus cher un fumeur, mais le tarif de l'outil ne distingue pas les fumeurs." },
    hospit: { id: "hospit", type: "on", lib: "Avez-vous été hospitalisé plus de 7 jours de suite au cours des 5 dernières années (hors accouchement) ?", effet: "etude", motif: "Hospitalisation de plus de 7 jours au cours des 5 dernières années." },
    traitement: { id: "traitement", type: "on", lib: "Suivez-vous un traitement médical régulier, depuis plus de 3 mois (hors contraception) ?", effet: "etude", motif: "Traitement médical régulier." },
    arret: { id: "arret", type: "on", lib: "Êtes-vous en arrêt de travail depuis plus de 30 jours, reconnu invalide, ou avez-vous demandé la reconnaissance d'une invalidité ?", effet: "etude", motif: "Arrêt de travail de plus de 30 jours, invalidité reconnue ou demandée." },
    ald: { id: "ald", type: "on", lib: "Êtes-vous reconnu en affection de longue durée (ALD) par l'assurance maladie ?", effet: "etude", motif: "Affection de longue durée reconnue." },
    grave: { id: "grave", type: "on", lib: "Avez-vous eu, au cours des 10 dernières années, un cancer, un infarctus, un accident vasculaire cérébral (AVC) ou une maladie grave du cœur, du foie, des reins ou des poumons ?", effet: "etude", motif: "Maladie grave au cours des 10 dernières années (cancer, infarctus, AVC, cœur, foie, reins, poumons)." },
    coeur: { id: "coeur", type: "on", lib: "Avez-vous eu, au cours des 10 dernières années, un infarctus, un accident vasculaire cérébral (AVC) ou une maladie grave du cœur, du foie, des reins ou des poumons ?", effet: "etude", motif: "Maladie grave au cours des 10 dernières années (infarctus, AVC, cœur, foie, reins, poumons)." },
    oubli: { id: "oubli", type: "oubli", lib: "Avez-vous eu un cancer ou une hépatite virale C ?", effet: "etude", aide: "Droit à l'oubli de la convention AERAS : si le protocole de soins est terminé depuis plus de " + AERAS.oubliAns + " ans, sans rechute, la maladie ne se déclare pas." },
    terminal: { id: "terminal", type: "on", lib: "Êtes-vous atteint d'une maladie grave en phase avancée ou terminale, ou en attente d'une greffe d'organe ?", effet: "refus", motif: "Maladie grave en phase avancée ou terminale, ou greffe en attente : le risque n'est pas assurable." },
    aideVie: { id: "aideVie", type: "on", lib: "Avez-vous besoin de l'aide d'une autre personne pour au moins un acte de la vie quotidienne (se laver, s'habiller, manger, se déplacer) ?", effet: "refus", motif: "Le client est déjà dépendant : le risque garanti est déjà réalisé." },
    neuro: { id: "neuro", type: "on", lib: "Un médecin a-t-il posé le diagnostic d'une maladie neurodégénérative (maladie d'Alzheimer, de Parkinson, de Huntington…) ?", effet: "refus", motif: "Maladie neurodégénérative diagnostiquée : le risque garanti est déjà engagé." },
    hospCours: { id: "hospCours", type: "on", lib: "Êtes-vous actuellement hospitalisé, ou une hospitalisation est-elle déjà prévue ?", effet: "etude", motif: "Hospitalisation en cours ou prévue." },
    handicap: { id: "handicap", type: "on", lib: "Avez-vous un handicap ou une invalidité reconnue, avec un taux d'au moins 33 % ?", effet: "etude", motif: "Handicap ou invalidité reconnue (taux d'au moins 33 %)." },
    soins: { id: "soins", type: "on", lib: "Êtes-vous actuellement en traitement ou en rééducation à la suite d'un accident ?", effet: "etude", motif: "Soins en cours à la suite d'un accident." }
  };

  /* ---------- les questionnaires ---------- */
  var COMPLET = ["mesure", "tabac", "hospit", "traitement", "arret", "ald", "grave", "terminal"];
  var QUESTIONNAIRES = {
    DECES: { titre: "Questionnaire de santé – GS Décès", ids: COMPLET, intro: "Questionnaire complet : le contrat garantit un capital en cas de décès." },
    PREV: { titre: "Questionnaire de santé – GS Prévoyance", ids: COMPLET, intro: "Questionnaire complet : le contrat garantit un capital en cas de décès ou une rente en cas d'invalidité." },
    DEP: { titre: "Questionnaire de santé – GS Autonomie", ids: COMPLET.concat(["aideVie", "neuro"]), intro: "Questionnaire complet, avec deux questions sur la dépendance : le contrat garantit une rente si le client perd son autonomie." },
    OBSQ: { titre: "Questionnaire de santé simplifié – GS Obsèques", ids: ["hospCours", "ald", "terminal"], intro: "Questionnaire simplifié : le contrat garantit un capital pour financer les obsèques ; le décès par maladie n'est couvert qu'après le délai de carence de 12 mois." },
    GAV: { titre: "Questionnaire de santé simplifié – GS Protection Famille", ids: ["handicap", "soins"], intro: "Questionnaire simplifié : le contrat indemnise les séquelles d'un accident de la vie privée." },
    EMPRUNTEUR: { titre: "Questionnaire de santé – assurance emprunteur", ids: ["mesure", "tabac", "hospit", "traitement", "arret", "ald", "coeur", "oubli", "terminal"], intro: "Questionnaire de la convention AERAS : le contrat rembourse le crédit en cas de décès ou d'invalidité de l'emprunteur." }
  };
  /* Produits du catalogue qui posent un questionnaire de santé à la souscription. */
  var PRODUITS = ["DECES", "PREV", "DEP", "OBSQ", "GAV"];
  function estQuestionne(pid) { return PRODUITS.indexOf(pid) >= 0; }

  /* Le questionnaire d'un contrat (ou « EMPRUNTEUR ») : { code, titre, intro, questions: [...] } ; null si le produit n'en a pas. */
  function questionnaire(code) {
    var d = QUESTIONNAIRES[code];
    if (!d) return null;
    return { code: code, titre: d.titre, intro: d.intro, questions: d.ids.map(function (id) { var q = Q[id], o = {}; Object.keys(q).forEach(function (k) { o[k] = q[k]; }); return o; }) };
  }

  /* ---------- la règle ---------- */
  function entier(t) { var s = String(t == null ? "" : t).replace(/[\s ]/g, ""); return /^\d{1,3}$/.test(s) ? parseInt(s, 10) : NaN; }
  function imcDe(taille, poids) { var m = taille / 100; return Math.round(poids / (m * m) * 10) / 10; }
  function fr1(x) { return String(x).replace(".", ","); }

  /* Convention AERAS applicable à cet assuré : capital assuré d'au plus 420 000 € et contrat terminé avant les 71 ans de l'assuré. */
  function aeras(assure, ageTerme) { return assure <= AERAS.capitalMax && ageTerme < AERAS.ageMax; }

  /* code : « DECES », « PREV », « DEP », « OBSQ », « GAV » ou « EMPRUNTEUR » ; rep : réponses saisies { id: "oui" | "non" | … ; mesure: { taille, poids } } ;
     ctx (assurance emprunteur) : { aeras: true | false }. Renvoie { code, complet, manquantes, erreurs, verdict, motifs, imc }. */
  function evaluer(code, rep, ctx) {
    var qn = questionnaire(code), r = { code: code, complet: false, manquantes: [], erreurs: {}, verdict: null, motifs: [], imc: null };
    if (!qn) { r.erreurs._ = "Ce produit n'a pas de questionnaire de santé."; return r; }
    rep = rep || {}; ctx = ctx || {};
    var dansAeras = ctx.aeras !== false, etude = false, refus = false;
    qn.questions.forEach(function (q) {
      var v = rep[q.id];
      if (q.type === "mesure") {
        var m = v || {}, ta = entier(m.taille), po = entier(m.poids);
        if (m.taille == null || m.taille === "" || m.poids == null || m.poids === "") { r.manquantes.push(q.id); return; }
        if (isNaN(ta) || ta < MESURES.tailleMin || ta > MESURES.tailleMax) { r.erreurs[q.id] = "Taille : un nombre entier de centimètres, de " + MESURES.tailleMin + " à " + MESURES.tailleMax + "."; r.manquantes.push(q.id); return; }
        if (isNaN(po) || po < MESURES.poidsMin || po > MESURES.poidsMax) { r.erreurs[q.id] = "Poids : un nombre entier de kilogrammes, de " + MESURES.poidsMin + " à " + MESURES.poidsMax + "."; r.manquantes.push(q.id); return; }
        r.imc = imcDe(ta, po);
        if (r.imc < IMC.min || r.imc >= IMC.max) { etude = true; r.motifs.push("Indice de masse corporelle de " + fr1(r.imc) + " : hors de la plage de " + IMC.min + " à moins de " + IMC.max + " acceptée sans étude."); }
      } else if (q.type === "oubli") {
        if (v !== "non" && v !== "plus5" && v !== "moins5") { r.manquantes.push(q.id); return; }
        if (v === "moins5") { etude = true; r.motifs.push("Cancer ou hépatite virale C : protocole de soins en cours ou terminé depuis " + AERAS.oubliAns + " ans ou moins."); }
        else if (v === "plus5" && !dansAeras) { etude = true; r.motifs.push("Cancer ou hépatite virale C : le droit à l'oubli ne s'applique pas hors de la convention AERAS (capital assuré supérieur à " + "420 000 € ou contrat terminé à partir des 71 ans de l'assuré)."); }
      } else {
        if (v !== "oui" && v !== "non") { r.manquantes.push(q.id); return; }
        if (v === "oui" && q.effet === "etude") { etude = true; r.motifs.push(q.motif); }
        else if (v === "oui" && q.effet === "refus") { refus = true; r.motifs.push(q.motif); }
      }
    });
    r.complet = r.manquantes.length === 0;
    if (r.complet) r.verdict = refus ? "refus" : etude ? "etude" : "accepte";
    else r.motifs = [];
    return r;
  }

  /* ---------- les textes ---------- */
  var VERDICTS = { accepte: "Accepté", etude: "Étude par l'assureur", refus: "Refusé" };
  function libelle(v) { return VERDICTS[v] || ""; }
  /* Explication de la décision, à lire après son libellé (« Étude par l'assureur : … »), pour un contrat du catalogue (le conseiller a les réponses sous les yeux) ou pour l'assurance emprunteur. */
  function phrase(code, v) {
    var emp = code === "EMPRUNTEUR";
    if (v === "accepte") return emp ? "l'assureur n'a pas d'étude médicale à faire : il assure aux conditions standard." : "aucune réponse ne demande d'étude médicale : le contrat est accepté aux conditions standard.";
    if (v === "etude") return emp
      ? "le service médical de l'assureur examine le dossier (" + AERAS.delaiSemaines + " semaines au plus pour un dossier complet, selon la convention AERAS), puis accepte aux conditions standard, propose une surprime ou une exclusion, ou refuse. L'offre de prêt ne peut pas être émise avant sa décision."
      : "le service médical de l'assureur examine le dossier, puis accepte aux conditions standard, propose une surprime ou une exclusion de certaines causes, ou refuse. Le contrat ne peut pas être confirmé aujourd'hui : consignez la demande dans le compte rendu d'entretien.";
    if (v === "refus") return emp
      ? "le risque n'est pas assurable aux conditions de l'exercice. Sans assurance acceptée, l'offre de prêt ne peut pas être émise. (Dans la réalité, la convention AERAS prévoit un examen approfondi avant tout refus.)"
      : "le risque n'est pas assurable par ce contrat. La souscription est impossible : expliquez la décision au client et notez-la dans le compte rendu d'entretien.";
    return "";
  }
  var RAPPEL = "Le client répond lui-même, avec exactitude : une réticence ou une fausse déclaration intentionnelle peut entraîner la nullité du contrat (article L113-8 du Code des assurances) ; une omission ou une inexactitude sans mauvaise foi peut entraîner une cotisation majorée ou une indemnité réduite.";
  var CONFIDENTIEL = "Les réponses relèvent du secret médical : l'outil n'en garde aucune trace, seule la décision est conservée.";
  var CONFIDENTIEL_EMPRUNTEUR = "Dans la réalité, les réponses sont confidentielles : seul le service médical de l'assureur les analyse (convention AERAS). Le dossier de prêt ne garde que la décision de l'assureur ; l'outil n'en garde aucune trace.";

  var api = {
    IMC: IMC, AERAS: AERAS, MESURES: MESURES, PRODUITS: PRODUITS, VERDICTS: VERDICTS, RAPPEL: RAPPEL, CONFIDENTIEL: CONFIDENTIEL, CONFIDENTIEL_EMPRUNTEUR: CONFIDENTIEL_EMPRUNTEUR,
    estQuestionne: estQuestionne, questionnaire: questionnaire, evaluer: evaluer, aeras: aeras, libelle: libelle, phrase: phrase, imcDe: imcDe
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.sante = api; }
})(typeof window !== "undefined" ? window : this);
