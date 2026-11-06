// Mot de passe oublié et paramètres

// ---------- Mot de passe oublié et paramètres ----------
var recovering = /type=recovery/.test(window.location.hash);
$("forgot").onclick = async function () {
  var email = $("email").value.trim();
  if (!email) return say($("msg"), t("e_creds"), "err");
  $("forgot").disabled = true;
  var err = null;
  try {
    var r = await db.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
    err = r && r.error;
  } catch (e) { err = e; }
  // On affiche le vrai problème (ex. limite d'envoi, email non autorisé) au lieu de dire « envoyé »
  if (err) say($("msg"), t("reset_err") + " (" + (err.message || err) + ")", "err");
  else say($("msg"), t("reset_sent"), "ok");
  $("forgot").disabled = false;
};
function openSettings(note) {
  $("pause").checked = !!(currentProfile && currentProfile.hidden);
  $("newpw").value = "";
  say($("smsg"), note || "", note ? "ok" : "");
  showSection("settings");
  if (note) $("newpw").focus();
}
async function loadBlocked() {
  var box = $("blocked-list"); box.textContent = "";
  var r = await db.rpc("my_blocked");
  var rows = (r && r.data) || [];
  if (!rows.length) { var e = document.createElement("p"); e.className = "empty"; e.textContent = r && r.error ? r.error.message : t("blocked_empty"); box.appendChild(e); return; }
  rows.forEach(function (p) {
    var row = document.createElement("div"); row.className = "brow";
    var n = document.createElement("span"); n.textContent = p.first_name;
    var b = document.createElement("button"); b.type = "button"; b.className = "secondary"; b.textContent = t("unblock");
    b.onclick = async function () {
      if (!confirm(t("unblock_confirm", { name: p.first_name }))) return;
      var d = await db.from("blocks").delete().eq("blocker_id", currentUser.id).eq("blocked_id", p.id);
      if (d.error) return say($("smsg"), d.error.message, "err");
      loadBlocked();
    };
    row.appendChild(n); row.appendChild(b); box.appendChild(row);
  });
}
$("go-settings").onclick = function () { openSettings(); loadBlocked(); };
$("settings-back").onclick = function () { if (currentProfile) renderView(currentUser, currentProfile); else showSection("profile"); };
$("pause").onchange = async function () {
  var on = $("pause").checked;
  var r = await db.from("profiles").update({ hidden: on }).eq("id", currentUser.id).select().single();
  if (r.error) { $("pause").checked = !on; return say($("smsg"), r.error.message, "err"); }
  currentProfile = r.data;
  say($("smsg"), t(on ? "pause_on" : "pause_off"), "ok");
};
$("change-pw").onclick = async function () {
  var pw = $("newpw").value;
  if (pw.length < 8) return say($("smsg"), t("e_creds"), "err");
  $("change-pw").disabled = true;
  var r = await db.auth.updateUser({ password: pw });
  $("change-pw").disabled = false;
  if (r.error) return say($("smsg"), r.error.message, "err");
  $("newpw").value = ""; say($("smsg"), t("pw_changed"), "ok");
  if (recovering) { recovering = false; try { history.replaceState(null, "", window.location.pathname); } catch (e) {} }
};
