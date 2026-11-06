// Vérification du profil (selfie)

// ---------- Vérification du profil ----------
function renderVerifyStatus() {
  var st = $("verify-status"), form = $("verify-form");
  if (currentProfile && currentProfile.verified) { st.textContent = t("verify_status_ok"); st.style.color = "var(--ok)"; form.hidden = true; }
  else if (currentProfile && currentProfile.verification_requested) { st.textContent = t("verify_status_pending"); st.style.color = "var(--muted)"; form.hidden = false; }
  else { st.textContent = ""; form.hidden = false; }
}
$("go-verify").onclick = function () { $("verify-file").value = ""; say($("vmsg"), "", ""); renderVerifyStatus(); showSection("verify"); };
$("verify-back").onclick = function () { showSection("home"); };

$("verify-form").addEventListener("submit", async function (e) {
  e.preventDefault();
  var f = $("verify-file").files[0], msg = $("vmsg");
  if (!f) return say(msg, t("e_verify_file"), "err");
  if (/^image\//.test(f.type)) f = await compressImage(f, 1400);
  if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return say(msg, t("e_photo_type"), "err");
  if (f.size > 5 * 1024 * 1024) return say(msg, t("e_photo_size"), "err");
  $("verify-send").disabled = true; say(msg, t("wait"), "");
  try {
    var up = await db.storage.from("verifications").upload(currentUser.id + "/selfie", f, { upsert: true, contentType: f.type });
    if (up.error) throw up.error;
    var u = await db.from("profiles").update({ verification_requested: true }).eq("id", currentUser.id).select().single();
    if (u.error) throw u.error;
    currentProfile = u.data;
    say(msg, t("verify_sent"), "ok"); renderVerifyStatus();
  } catch (err) { say(msg, err.message || t("e_generic"), "err"); }
  $("verify-send").disabled = false;
});
