// Mot de passe oublié, en 3 étapes :
//  1. « Mot de passe oublié ? » ouvre un écran « Saisissez votre e-mail » dans la fenêtre de connexion.
//  2. L'équipe Jade envoie un e-mail avec un lien (envoi par Supabase, modèle « Reset Password »).
//  3. Le lien ouvre l'écran « Nouveau mot de passe » ; une fois enregistré, on revient à la connexion
//     pour se connecter avec le nouveau mot de passe.
// Lien expiré ou déjà utilisé : on le dit, et on propose d'en redemander un.

SECTIONS.push("reset");
NO_TABBAR.push("reset");

function resetErrorText(err) {
  var m = String((err && (err.message || err.msg || err.error_description)) || err || "");
  if (/rate|seconds|too many|security purposes/i.test(m)) return t("reset_rate");
  if (/sending|smtp|not authorized|authorised|unauthorized|confirmation|mail/i.test(m)) return t("reset_smtp");
  return t("reset_err") + (m ? " (" + m + ")" : "");
}

// ---------- Étape 1 : écran « Saisissez votre e-mail » ----------
var _setModeForgot = setMode;
setMode = function (m) {
  var forgot = m === "forgot";
  if (!forgot) _setModeForgot.apply(this, arguments);
  else {
    mode = "forgot";
    $("signup-only").hidden = true;
    var ti = $("auth-title"); ti.setAttribute("data-i18n", "forgot_t"); ti.textContent = t("forgot_t");
    $("submit").textContent = t("forgot_send"); $("submit").setAttribute("data-i18n", "forgot_send");
    $("forgot").hidden = true;
    say($("msg"), "", "");
  }
  if (!forgot) $("submit").removeAttribute("data-i18n");
  $("forgot-intro").hidden = !forgot;
  $("forgot-back").hidden = !forgot;
  $("password").closest(".pw-wrap").hidden = forgot;
  document.querySelector('label[for="password"]').hidden = forgot;
  $("submit").disabled = false;
};

$("forgot").onclick = function () {
  setMode("forgot");
  try { $("email").focus(); } catch (e) {}
};
$("forgot-back").onclick = function () { setMode("login"); };

// Le bouton « Recevoir le lien » : passe avant la connexion habituelle (écoute en phase de capture)
document.addEventListener("submit", async function (e) {
  if (e.target.id !== "form" || mode !== "forgot") return;
  e.preventDefault(); e.stopImmediatePropagation();
  var email = $("email").value.trim(), btn = $("submit");
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    say($("msg"), t("forgot_need_email"), "err");
    try { $("email").focus(); } catch (x) {}
    return;
  }
  btn.disabled = true; say($("msg"), t("wait"), "");
  var err = null;
  try {
    var r = await db.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
    err = r && r.error;
  } catch (x) { err = x; }
  if (err) { say($("msg"), resetErrorText(err), "err"); btn.disabled = false; return; }
  say($("msg"), t("reset_sent2"), "ok");
  setTimeout(function () { btn.disabled = false; }, 30000);   // évite d'envoyer 10 e-mails d'affilée
}, true);

// ---------- Lien de l'e-mail expiré ou déjà utilisé ----------
(function () {
  var h = (window.location.hash || "") + "&" + (window.location.search || "").replace(/^\?/, "");
  if (!/error_description=|error_code=/.test(h)) return;
  try { history.replaceState(null, "", window.location.pathname); } catch (e) {}
  recovering = false;
  setTimeout(function () {
    if (currentUser) return;
    if (typeof goAuth === "function") goAuth("login"); else setMode("login");
    say($("msg"), t("link_expired"), "err");
  }, 900);
})();

// ---------- Étape 3 : écran « Nouveau mot de passe » ----------
function openRecovery() {
  if (!recovering || !currentUser) return;
  $("rpw").value = ""; $("rpw2").value = ""; say($("rpw-msg"), "", "");
  showSection("reset");
  window.scrollTo(0, 0);
  setTimeout(function () { try { $("rpw").focus(); } catch (e) {} }, 80);
}
// Après le chargement du profil, on passe sur « Nouveau mot de passe » plutôt que sur l'Accueil
var _renderViewRecovery = renderView;
renderView = function () {
  var r = _renderViewRecovery.apply(this, arguments);
  if (recovering) openRecovery();
  return r;
};
// Membre qui n'avait pas encore fini son profil : on passe aussi sur « Nouveau mot de passe »
var _showRecovery = show;
show = function (user) {
  var r = _showRecovery.apply(this, arguments);
  if (user && recovering) setTimeout(openRecovery, 700);
  return r;
};

$("rpw-form").addEventListener("submit", async function (e) {
  e.preventDefault();
  var pw = $("rpw").value, pw2 = $("rpw2").value, msg = $("rpw-msg");
  if (pw.length < 8) return say(msg, t("rpw_short"), "err");
  if (pw !== pw2) return say(msg, t("rpw_mismatch"), "err");
  $("rpw-save").disabled = true; say(msg, t("wait"), "");
  var r = await db.auth.updateUser({ password: pw });
  $("rpw-save").disabled = false;
  if (r && r.error) return say(msg, r.error.message, "err");
  // Mot de passe changé : on revient à la connexion pour se connecter avec le nouveau mot de passe
  var email = currentUser && currentUser.email;
  recovering = false;
  try { history.replaceState(null, "", window.location.pathname); } catch (x) {}
  try { await db.auth.signOut({ scope: "local" }); } catch (x) {}
  show(null);
  if (typeof goAuth === "function") goAuth("login"); else setMode("login");
  if (email) $("email").value = email;
  $("password").value = "";
  say($("msg"), t("pw_reset_done"), "ok");
  setTimeout(function () { try { $("password").focus(); } catch (x) {} }, 120);
});

// ---------- Œil sur les nouveaux mots de passe (écran « Nouveau mot de passe » et Paramètres) ----------
function addEye(input, id) {
  var wrap = input.closest(".pw-wrap");
  if (!wrap) { wrap = document.createElement("div"); wrap.className = "pw-wrap"; input.parentNode.insertBefore(wrap, input); wrap.appendChild(input); }
  var b = $("pw-eye").cloneNode(true); b.id = id; b.classList.remove("on"); wrap.appendChild(b);
  var bt = b.querySelector(".pw-eye-t");
  function paint(show) {
    b.classList.toggle("on", show);
    b.setAttribute("aria-pressed", show ? "true" : "false");
    b.setAttribute("aria-label", t(show ? "pw_hide" : "pw_show"));
    if (bt) { bt.setAttribute("data-i18n", show ? "pw_hide_s" : "pw_show_s"); bt.textContent = t(show ? "pw_hide_s" : "pw_show_s"); }
  }
  paint(false);
  b.onclick = function () {
    var show = input.type === "password";
    input.type = show ? "text" : "password";
    if (input.id === "rpw") $("rpw2").type = input.type;   // les deux champs ensemble
    paint(show);
  };
}
addEye($("rpw"), "rpw-eye");
addEye($("newpw"), "newpw-eye");
