/* GS Banque & Assurance – volet « Fiche d'entretien » de la page « Compte Rendu d'Entretien (CRE) » : choix du client, puis fiche d'entretien (ui_entretien.js).
   Adresse : contacts.html?volet=entretien&client=ID ouvre la fiche d'un client. */
(function () {
  "use strict";
  var SG = window.SGBF, VOL = SG.volets, ENT = SG.entretienUI, CL = SG.clients, esc = SG.banque.esc;
  var corps = VOL && VOL.panneau("entretien");
  if (!corps) return;
  var CLIENT = {}; CL.forEach(function (c) { CLIENT[c.id] = c; });
  var cur = CLIENT[parseInt(VOL.params("entretien").get("client"), 10)] || null;
  var OPT = { lienFiche: true };

  corps.innerHTML = '<div id="en-choix">' + ENT.selecteur(cur ? cur.id : "") + '</div><div id="en-hote">' + (cur ? ENT.html(cur, OPT) : ENT.vide()) + "</div>";
  ENT.lier(corps, OPT);
  corps.addEventListener("change", function (e) {
    if (e.target.id !== "en-client") return;
    ENT.flush();
    cur = CLIENT[parseInt(e.target.value, 10)] || null;
    document.getElementById("en-hote").innerHTML = cur ? ENT.html(cur, OPT) : ENT.vide();
    VOL.majUrl("entretien");
  });
  VOL.enregistrer("entretien", function () { return cur ? { client: String(cur.id) } : {}; });
})();
