// Démarrage de l'appli : toujours chargé en dernier

applyI18n();
setMode("signup");

if (db.auth.onAuthStateChange) {
  db.auth.onAuthStateChange(function (ev) { if (ev === "PASSWORD_RECOVERY") { recovering = true; setTimeout(function () { openSettings(t("recovery_msg")); }, 600); } });
}

db.auth.getSession().then(async function (r) {
  var u = r.data.session ? r.data.session.user : null;
  // Plus de 30 minutes sans activité depuis la dernière visite : il faut se reconnecter (js/inactivite.js)
  if (u && !recovering && typeof idleExpired === "function" && idleExpired()) { await idleLogout(); return; }
  show(u);
  if (u && recovering) setTimeout(function () { openSettings(t("recovery_msg")); }, 900);
});
