// Menu des langues, inscription et connexion

// ---------- Langue ----------
$("lang").onchange = function () {
  lang = $("lang").value;
  try { localStorage.setItem("lang", lang); } catch (e) {}
  applyI18n();
  ["msg", "pmsg", "hmsg", "dmsg", "cmsg", "rmsg", "vmsg"].forEach(function (id) { say($(id), "", ""); });
  if (!$("home").hidden && currentProfile) renderView(currentUser, currentProfile);
  else if (!$("discover").hidden && candidate) renderCandidate();
  else if (!$("matches").hidden) loadMatches();
  else if (!$("verify").hidden) renderVerifyStatus();
};

// ---------- Connexion ----------
$("tab-signup").onclick = function () { setMode("signup"); };
$("tab-login").onclick = function () { setMode("login"); };

$("form").addEventListener("submit", async function (e) {
  e.preventDefault();
  var msg = $("msg");
  var email = $("email").value.trim(), password = $("password").value;
  if (!email || password.length < 8) return say(msg, t("e_creds"), "err");
  $("submit").disabled = true; say(msg, t("wait"), "");
  try {
    if (mode === "signup") {
      var birth = $("birth").value;
      if (!birth) throw new Error(t("e_birth"));
      if (ageFrom(birth) < 18) throw new Error(t("e_under18"));
      if (!$("adult").checked) throw new Error(t("e_adult"));
      var back = window.location.origin + window.location.pathname;
      var r = await db.auth.signUp({ email: email, password: password, options: { data: { birthdate: birth }, emailRedirectTo: back } });
      if (r.error) throw r.error;
      if (r.data.session) show(r.data.user);
      else say(msg, t("ok_created"), "ok");
    } else {
      var l = await db.auth.signInWithPassword({ email: email, password: password });
      if (l.error) throw l.error;
      show(l.data.user);
    }
  } catch (err) { say(msg, err.message || t("e_generic"), "err"); }
  $("submit").disabled = false;
});
