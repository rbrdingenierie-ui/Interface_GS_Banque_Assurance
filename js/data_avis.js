/* GS Banque & Assurance – avis laissés sur la page de l'agence de Paris, sur un site d'avis et sur un réseau social (« Avis clients en ligne »).
   Les 24 avis sont INVENTÉS, comme leurs auteurs (prénom et initiale ou pseudonyme). « jours » = nombre de jours écoulés depuis la publication : les dates se calculent à partir
   d'aujourd'hui, l'exercice reste donc d'actualité quel que soit le jour d'utilisation. Seuls des prénoms suivis d'une initiale correspondent (ou non) à un client des dossiers : le rapprochement se
   fait dans l'outil, jamais ici. Les IBAN, numéros et codes cités sont fictifs. */
(function (root) {
  "use strict";
  var AVIS = [
    { id: "AV-01", canal: "site", auteur: "Élodie V.", note: 5, jours: 2, texte: "Conseillère très à l'écoute lors de l'ouverture de mon livret. Explications claires, aucun forcing. Je recommande cette agence." },
    { id: "AV-02", canal: "reseau", auteur: "Mathieu P.", note: 5, jours: 4, texte: "Super accueil ce matin : rendez-vous à l'heure et des conseils précis pour mon projet. Merci à toute l'équipe !" },
    { id: "AV-03", canal: "site", auteur: "Annie C.", note: 4, jours: 6, texte: "Agence agréable, personnel souriant. Seul bémol : un peu d'attente le samedi matin. Rien de grave." },
    { id: "AV-04", canal: "site", auteur: "Hugo T.", note: 5, jours: 9, texte: "Mon dossier de prêt immobilier a été traité en trois semaines, de l'accord de principe à la signature. Bravo et merci !" },
    { id: "AV-05", canal: "reseau", auteur: "Claire F.", note: 4, jours: 12, texte: "L'application est plus simple depuis la mise à jour, et on m'a montré à l'agence comment faire un virement. Merci pour la pédagogie." },
    { id: "AV-06", canal: "site", auteur: "Gilles V.", note: 3, jours: 3, texte: "Une demi-heure d'attente à l'accueil sans que personne ne nous dise quoi que ce soit. Ensuite le conseiller a été efficace." },
    { id: "AV-07", canal: "reseau", auteur: "Inès K.", note: 2, jours: 5, texte: "Agence fermée à 17 h 30 alors que c'est écrit 18 h sur Internet. J'ai fait le trajet pour rien." },
    { id: "AV-08", canal: "site", auteur: "Théo L.", note: 2, jours: 8, texte: "Impossible de joindre l'agence par téléphone, ça sonne dans le vide depuis lundi." },
    { id: "AV-09", canal: "site", auteur: "Nadia S.", note: 3, jours: 11, texte: "Agence difficile d'accès avec une poussette : une marche à l'entrée et pas de rampe." },
    { id: "AV-10", canal: "site", auteur: "Sophie D.", note: 1, jours: 2, texte: "Frais bancaires prélevés deux fois ce mois-ci sans explication. Personne ne me rappelle. Honteux." },
    { id: "AV-11", canal: "reseau", auteur: "Cédric A.", note: 2, jours: 4, texte: "Ma demande de crédit a été refusée sans vraie explication, et on m'a dit de revenir dans six mois. Très déçu." },
    { id: "AV-12", canal: "site", auteur: "Virginie R.", note: 1, jours: 7, texte: "Ma carte a été avalée par le distributeur vendredi, toujours pas de nouvelle carte. Impossible de payer mes courses." },
    { id: "AV-13", canal: "reseau", auteur: "Delphine S.", note: 2, jours: 10, texte: "Virement envoyé il y a une semaine et toujours pas arrivé chez le destinataire. Personne ne sait me dire où il est." },
    { id: "AV-14", canal: "site", auteur: "Guillaume P.", note: 1, jours: 1, texte: "Si on ne règle pas mon problème de prélèvement refusé à tort, je ferme mon compte et je préviens une association de consommateurs. Dernier avertissement !" },
    { id: "AV-15", canal: "reseau", auteur: "Utilisateur4821", note: 1, jours: 3, texte: "Ne donnez jamais votre IBAN à cette banque ! J'ai envoyé le mien (FR76 1234 5678 9012 3456 7890 123) par message et on m'a volé. Tous des voleurs." },
    { id: "AV-16", canal: "site", auteur: "Marc A.", note: 3, jours: 6, texte: "Monsieur Lefèvre m'a répondu de façon très désagréable au guichet. Il devrait changer de métier." },
    { id: "AV-17", canal: "reseau", auteur: "DanDan75", note: 1, jours: 5, texte: "Cette agence blanchit l'argent de la mafia, tout le monde le sait. À fuir !!!" },
    { id: "AV-18", canal: "site", auteur: "Samira O.", note: 1, jours: 14, texte: "Je n'ai jamais mis les pieds dans cette agence, mais mes parents ont perdu toutes leurs économies à cause d'un conseiller incompétent. Fuyez !" },
    { id: "AV-19", canal: "site", auteur: "Lucas M.", note: 1, jours: 9, texte: "Fuyez ! Chez un concurrent c'est moins cher. Ouvrez un compte avec mon code de parrainage ABCD12 et gagnez 80 euros." },
    { id: "AV-20", canal: "reseau", auteur: "Anonyme", note: 1, jours: 15, texte: "NUL NUL NUL !!! Bande d'incapables !!!" },
    { id: "AV-21", canal: "reseau", auteur: "Éva L.", note: 1, jours: 1, texte: "J'ai cliqué sur un lien reçu par SMS pour un colis bloqué, et de l'argent a disparu de mon compte hier soir. Que dois-je faire ? Aidez-moi !" },
    { id: "AV-22", canal: "site", auteur: "Antoine D.", note: 2, jours: 2, texte: "On m'a appelé en se disant conseiller de ma banque pour sécuriser mon compte, et j'ai donné le code reçu par SMS. Maintenant mon compte est vide ! Que faites-vous ?" },
    { id: "AV-23", canal: "site", auteur: "Monique R.", note: 5, jours: 20, texte: "Merci à Nadia et à toute l'équipe : on m'a appris à utiliser l'application sur mon téléphone. À 62 ans, je n'osais pas ! Beaucoup de patience." },
    { id: "AV-24", canal: "site", auteur: "Thomas F.", note: 4, jours: 25, texte: "Bonne réactivité sur ma demande d'assurance auto : devis envoyé le jour même." }
  ];
  var api = { AVIS: AVIS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) { root.SGBF = root.SGBF || {}; root.SGBF.dataAvis = api; }
})(typeof window !== "undefined" ? window : null);
