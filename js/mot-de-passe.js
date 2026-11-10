// Mot de passe oublié : messages clairs, et arrivée fiable sur « nouveau mot de passe » depuis le lien de l'e-mail.
//  1. Sans e-mail saisi : on explique quoi faire (au lieu d'un message d'erreur général).
//  2. Les erreurs de Supabase sont traduites en mots simples (trop de demandes, envoi d'e-mails pas réglé…).
//  3. En arrivant par le lien de l'e-mail, on ouvre directement les Paramètres sur « Nouveau mot de passe ».
//  4. Lien expiré ou déjà utilisé : on le dit, et on propose d'en redemander un.

function resetErrorText(err) {
  var m = String((err && (err.message || err.msg || err.error_description)) || err || "");
  if (/rate|seconds|too many|security purposes/i.test(m)) return t("reset_rate");
  if (/sending|smtp|not authorized|authorised|unauthorized|confirmation|mail/i.test(m)) return t("reset_smtp");
  return t("reset_err") + (m ? " (" + m + ")" : "");
}

$("forgot").onclick = async function () {
  var email = $("email").value.trim(), btn = this;
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    say($("msg"), t("forgot_need_email"), "err");
    try { $("email").focus(); } catch (e) {}
    return;
  }
  btn.disabled = true;
  var err = null;
  try {
    var r = await db.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
    err = r && r.error;
  } catch (e) { err = e; }
  if (err) { say($("msg"), resetErrorText(err), "err"); btn.disabled = false; return; }
  say($("msg"), t("reset_sent") + " " + t("reset_spam"), "ok");
  setTimeout(function () { btn.disabled = false; }, 30000);   // évite d'envoyer 10 e-mails d'affilée
};

// Lien de l'e-mail expiré ou déjà utilisé (Supabase renvoie error_description dans l'adresse)
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

// Arrivée par le lien « mot de passe oublié » : directement sur le nouveau mot de passe
var _renderViewRecovery = renderView;
renderView = function () {
  var r = _renderViewRecovery.apply(this, arguments);
  if (recovering) openRecovery();
  return r;
};
function openRecovery() {
  openSettings(t("recovery_msg"));
  setTimeout(function () {
    try { $("newpw").scrollIntoView({ block: "center" }); $("newpw").focus({ preventScroll: true }); } catch (e) {}
  }, 80);
}
// Après le nouveau mot de passe, retour à l'Accueil
var _changePw = $("change-pw").onclick;
$("change-pw").onclick = async function () {
  var was = recovering;
  await _changePw.apply(this, arguments);
  // parametres.js remet « recovering » à faux seulement si le mot de passe a bien été changé
  if (was && !recovering) setTimeout(function () { goTab("home"); }, 1800);
};

// Œil aussi sur le nouveau mot de passe des Paramètres
(function () {
  var input = $("newpw"), wrap = document.createElement("div"); wrap.className = "pw-wrap";
  input.parentNode.insertBefore(wrap, input); wrap.appendChild(input);
  var b = $("pw-eye").cloneNode(true); b.id = "newpw-eye"; b.classList.remove("on"); wrap.appendChild(b);
  var bt = b.querySelector(".pw-eye-t"); if (bt) { bt.setAttribute("data-i18n", "pw_show_s"); bt.textContent = t("pw_show_s"); }
  b.onclick = function () {
    var show = input.type === "password";
    input.type = show ? "text" : "password";
    b.classList.toggle("on", show);
    b.setAttribute("aria-pressed", show ? "true" : "false");
    b.setAttribute("aria-label", t(show ? "pw_hide" : "pw_show"));
    var tx = b.querySelector(".pw-eye-t"); if (tx) { tx.setAttribute("data-i18n", show ? "pw_hide_s" : "pw_show_s"); tx.textContent = t(show ? "pw_hide_s" : "pw_show_s"); }
  };
})();
