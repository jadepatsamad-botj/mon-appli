// « En ligne il y a 3 h » : depuis combien de temps le membre a utilisé l'appli pour la dernière fois.
//  * moins de 10 minutes  → « En ligne » (point vert)
//  * moins d'une heure    → « En ligne il y a 25 min »
//  * moins de 24 heures   → « En ligne il y a 3 h »
//  * plus                 → rien
// Basé sur profiles.last_seen, mis à jour toutes les 2 minutes quand l'appli est ouverte.

var _activityTagAgo = activityTag;
activityTag = function (p) {
  var base = _activityTagAgo.apply(this, arguments);
  if (!base || base === t("online")) return base;
  var m = (Date.now() - new Date(p.last_seen).getTime()) / 60000;
  if (m < 60) return t("seen_min_ago", { n: Math.max(10, Math.floor(m)) });
  return t("seen_h_ago", { n: Math.floor(m / 60) });
};
