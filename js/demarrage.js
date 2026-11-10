// Démarrage de l'appli : toujours chargé en dernier

applyI18n();
setMode("signup");

if (db.auth.onAuthStateChange) {
  db.auth.onAuthStateChange(function (ev) { if (ev === "PASSWORD_RECOVERY") { recovering = true; setTimeout(function () { if (typeof openRecovery === "function") openRecovery(); else openSettings(t("recovery_msg")); }, 600); } });
}

// Fin du chargement : on retire l'écran « Jade » de départ (voir le début de index.html)
function bootDone() { document.body.classList.remove("boot-app"); }
setTimeout(bootDone, 8000);   // au cas où la connexion ne répond pas

db.auth.getSession().then(async function (r) {
  var u = r.data.session ? r.data.session.user : null;
  // Plus de 30 minutes sans activité depuis la dernière visite : il faut se reconnecter (js/inactivite.js)
  if (u && !recovering && typeof idleExpired === "function" && idleExpired()) { await idleLogout(); bootDone(); return; }
  show(u);
  bootDone();
  if (u && recovering) setTimeout(function () { if (typeof openRecovery === "function") openRecovery(); else openSettings(t("recovery_msg")); }, 900);
});
