// Temps d'activité du jour : « Actif aujourd'hui · 2 h 15 »
// Toutes les 2 minutes, si le membre utilise vraiment l'appli (écran visible et un geste récent),
// Supabase ajoute 2 minutes à son compteur du jour (remis à zéro chaque jour, heure de Paris).
// Fonction Supabase : jade_activity_ping (fichier sql/personnalite-activite.sql).

var ACT_STEP_MIN = 2, actPingOk = true;

function parisToday() {
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
  catch (e) { return new Date().toISOString().slice(0, 10); }
}

setInterval(function () {
  if (!actPingOk || !currentUser || !currentProfile || document.hidden) return;
  var last = typeof idleGet === "function" ? idleGet() : Date.now();
  if (!last || Date.now() - last > (ACT_STEP_MIN + 1) * 60000) return;   // pas de geste récent : on ne compte pas
  db.rpc("jade_activity_ping", { add_min: ACT_STEP_MIN }).then(function (r) {
    if (r && r.error && /jade_activity_ping|function/i.test(r.error.message || "")) actPingOk = false;   // SQL pas encore lancé
  }, function () {});
}, ACT_STEP_MIN * 60000);

// Minutes actives aujourd'hui pour un profil (0 si le compteur date d'un autre jour)
function activeMinutesToday(p) {
  if (!p || !p.active_day || !p.active_min) return 0;
  return String(p.active_day).slice(0, 10) === parisToday() ? p.active_min : 0;
}
function fmtDuration(min) {
  if (min < 60) return t("dur_min", { m: Math.max(1, Math.round(min)) });
  var h = Math.floor(min / 60), m = Math.round((min % 60) / 5) * 5;
  if (m === 60) { h++; m = 0; }
  return m ? t("dur_hm", { h: h, m: m < 10 ? "0" + m : m }) : t("dur_h", { h: h });
}

// « En ligne » / « Actif aujourd'hui » avec la durée
var _activityTagDay = activityTag;
activityTag = function (p) {
  var base = _activityTagDay.apply(this, arguments);
  if (!base) return base;
  var min = activeMinutesToday(p);
  if (!min) return base;
  return base === t("online") ? t("online_d", { d: fmtDuration(min) }) : t("active_today_d", { d: fmtDuration(min) });
};
