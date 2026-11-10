// Déconnexion automatique après 30 minutes sans activité.
// Compte comme activité : toucher l'écran, cliquer, taper au clavier, faire défiler.
// Fonctionne aussi si l'appli est fermée : à la réouverture, si la dernière activité date
// de plus de 30 minutes, la session est fermée et il faut se reconnecter.
// L'heure de dernière activité est gardée sur l'appareil (partagée entre les onglets).

var IDLE_MS = 30 * 60 * 1000;
var IDLE_KEY = "jade_last_active";
var idleLastWrite = 0;

function idleGet() { try { return parseInt(localStorage.getItem(IDLE_KEY) || "0", 10) || 0; } catch (e) { return 0; } }
function idleTouch(force) {
  var now = Date.now();
  if (!force && now - idleLastWrite < 15000) return;   // on n'écrit pas plus d'une fois toutes les 15 s
  idleLastWrite = now;
  try { localStorage.setItem(IDLE_KEY, String(now)); } catch (e) {}
}
function idleExpired() { var last = idleGet(); return !!last && Date.now() - last > IDLE_MS; }

// Ferme la session et revient à la page d'accueil, avec un message sur la fenêtre de connexion
async function idleLogout() {
  try { localStorage.removeItem(IDLE_KEY); } catch (e) {}
  try { await db.auth.signOut({ scope: "local" }); } catch (e) {}
  show(null);
  setMode("login");
  if (typeof goAuth === "function") goAuth("login");
  say($("msg"), t("idle_logout"), "err");
}

// Chaque connexion (ou retour avec une session valide) remet le compteur à zéro
var _showIdle = show;
show = function (user) {
  if (user) idleTouch(true);
  return _showIdle.apply(this, arguments);
};

["pointerdown", "keydown", "scroll", "touchstart", "wheel"].forEach(function (ev) {
  window.addEventListener(ev, function () { if (currentUser) idleTouch(false); }, { passive: true, capture: true });
});

// Vérification régulière, et dès que l'on revient sur l'appli
function idleCheck() {
  if (!currentUser || (typeof recovering !== "undefined" && recovering)) return;
  if (idleExpired()) idleLogout();
}
setInterval(idleCheck, 30000);
document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") idleCheck(); });
window.addEventListener("pageshow", idleCheck);
window.addEventListener("focus", idleCheck);
