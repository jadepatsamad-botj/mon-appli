// Création et modification du profil

// ---------- Profil ----------
// Présentation obligatoire : au moins 10 mots (compte aussi les mots en thaï, chinois, japonais… écrits sans espaces)
var BIO_MIN_WORDS = 10;
function countWords(s) {
  s = (s || "").trim(); if (!s) return 0;
  try {
    if (window.Intl && Intl.Segmenter) {
      var n = 0, it = new Intl.Segmenter(undefined, { granularity: "word" }).segment(s);
      for (var x of it) if (x.isWordLike) n++;
      return n;
    }
  } catch (e) {}
  var n2 = 0;
  s.split(/\s+/).forEach(function (w) {
    if (/[\u0E00-\u0EFF\u1780-\u17FF\u3040-\u30FF\u3400-\u9FFF]/.test(w)) n2 += Math.max(1, Math.round(w.length / 2));
    else if (/[\p{L}\p{N}]/u.test(w)) n2++;
  });
  return n2;
}
function paintBio() {
  var v = $("bio").value, n = countWords(v);
  $("bio-count").textContent = v.length;
  $("bio-wc").textContent = t("bio_wc").replace("{n}", Math.min(n, BIO_MIN_WORDS));
  $("bio-wc").classList.toggle("ok", n >= BIO_MIN_WORDS);
}
$("bio").addEventListener("input", paintBio);
$("edit").onclick = function () { fillForm(currentProfile); showSection("profile"); };
$("pcancel").onclick = function () { renderView(currentUser, currentProfile); };

$("pform").addEventListener("submit", async function (e) {
  e.preventDefault();
  var msg = $("pmsg");
  var name = $("first_name").value.trim();
  if (!name) return say(msg, t("e_name"), "err");
  if (!$("gender").value || !$("looking_for").value) return say(msg, t("e_gender"), "err");
  // Présentation obligatoire : au moins 10 mots
  if (countWords($("bio").value) < BIO_MIN_WORDS) { say(msg, t("e_bio_short"), "err"); $("bio").focus(); $("bio").scrollIntoView({ block: "center" }); return; }
  // Au moins une photo de soi est obligatoire (à l'inscription comme en modifiant son profil)
  if (!slots.some(function (s) { return s.path || s.file; })) { say(msg, t("e_photo_required"), "err"); $("slots").scrollIntoView({ block: "center" }); return; }
  $("psave").disabled = true; say(msg, t("saving"), "");
  try {
    for (var i = 0; i < 5; i++) {
      var s = slots[i];
      if (s.file) {
        var path = slotPath(i);
        var up = await db.storage.from("photos").upload(path, s.file, { upsert: true, contentType: s.file.type });
        if (up.error) throw up.error;
        s.path = path;
      }
    }
    var paths = slots.filter(function (s) { return s.path; }).map(function (s) { return s.path; });
    var photoPath = paths[0] || null;
    var bd = (currentProfile && currentProfile.birthdate) || (currentUser.user_metadata || {}).birthdate || null;
    var row = {
      id: currentUser.id,
      first_name: name,
      country: $("country").value || null,
      gender: $("gender").value,
      looking_for: $("looking_for").value,
      bio: $("bio").value.trim() || null,
      city: $("city").value.trim() || null,
      intention: $("intention").value || null,
      interests: Array.prototype.filter.call($("interests").querySelectorAll("input"), function (c) { return c.checked; }).map(function (c) { return c.value; }),
      spoken: Array.prototype.filter.call($("spoken").querySelectorAll("input"), function (c) { return c.checked; }).map(function (c) { return c.value; }),
      photo_path: photoPath,
      photos: paths,
      birthdate: bd,
      updated_at: new Date().toISOString()
    };
    var s = await db.from("profiles").upsert(row).select().single();
    if (s.error) throw s.error;
    if (removedPaths.length) { try { await db.storage.from("photos").remove(removedPaths); } catch (e2) {} }
    currentProfile = s.data;
    renderView(currentUser, s.data);
  } catch (err) { say(msg, err.message || t("e_generic"), "err"); }
  $("psave").disabled = false;
});
$("lang").addEventListener("change", paintBio);
