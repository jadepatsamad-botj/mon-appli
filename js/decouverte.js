// Découverte : profils proposés, like, pass, super like, filtres

// ---------- Découverte ----------
var candidate = null;

function renderCandidate() {
  $("cand-name").textContent = nameWithAge(candidate);
  tagsInto($("cand-tags"), candidate);
  $("cand-bio").textContent = candidate.bio || "";
  setGallery($("cand-photo"), candidate);
  if (currentUser && candidate.id !== currentUser.id) {
    db.from("profile_views").upsert({ viewer_id: currentUser.id, viewed_id: candidate.id, viewed_at: new Date().toISOString() }).then(function () {}, function () {});
  }
  $("cand").hidden = false;
}

async function nextCandidate() {
  var dmsg = $("dmsg"); say(dmsg, t("searching"), "");
  $("cand").hidden = true; $("cand-empty").hidden = true;
  var s = await db.from("swipes").select("to_id").eq("from_id", currentUser.id);
  if (s.error) return say(dmsg, s.error.message, "err");
  var seen = (s.data || []).map(function (x) { return x.to_id; });
  seen.push(currentUser.id);
  var q = db.from("profiles").select("*")
    .not("id", "in", "(" + seen.join(",") + ")")
    .in("looking_for", [currentProfile.gender, "tous"])
    .eq("suspended", false)
    .eq("hidden", false)
    .eq("under_review", false)
    .order("boost", { ascending: false })
    .order("created_at", { ascending: false }).limit(1);
  if (currentProfile.looking_for !== "tous") q = q.eq("gender", currentProfile.looking_for);
  var amin = parseInt($("f-min").value, 10), amax = parseInt($("f-max").value, 10);
  if (amin > 18) q = q.lte("birthdate", dateYearsAgo(amin));
  if (amax < 99) q = q.gt("birthdate", dateYearsAgo(amax + 1));
  if ($("f-country").value) q = q.eq("country", $("f-country").value);
  if (myLevel() < 1) { $("f-intent").value = ""; $("f-lang").value = ""; }
  if ($("f-intent").value) q = q.eq("intention", $("f-intent").value);
  if ($("f-lang").value) q = q.contains("spoken", [$("f-lang").value]);
  var r = await q;
  if (r.error) return say(dmsg, r.error.message, "err");
  say(dmsg, "", "");
  candidate = r.data && r.data[0];
  if (!candidate) { $("cand-empty").hidden = false; return; }
  renderCandidate();
}

var lastPassed = null;
async function swipe(liked, isSuper) {
  if (!candidate) return;
  $("like").disabled = $("pass").disabled = $("superlike").disabled = true;
  var dmsg = $("dmsg"), banner = $("match-banner");
  banner.hidden = true;
  try {
    var row = { from_id: currentUser.id, to_id: candidate.id, liked: liked };
    if (isSuper) row.super = true;
    var ins = await db.from("swipes").insert(row);
    if (ins.error) throw ins.error;
    lastPassed = liked ? null : candidate;
    $("undo").hidden = !lastPassed || fromLikes;
    if (isSuper) say(dmsg, t("super_sent"), "ok");
    if (liked) {
      var back = await db.from("swipes").select("liked")
        .eq("from_id", candidate.id).eq("to_id", currentUser.id).eq("liked", true).maybeSingle();
      if (back.data) { banner.textContent = t("match_with", { name: candidate.first_name }); banner.hidden = false; notify(candidate.id, "match"); }
      else if (isSuper) notify(candidate.id, "super");
    }
    if (fromLikes) { fromLikes = false; showSection("likes"); await loadLikes(); }
    else { var keepMsg = isSuper; await nextCandidate(); if (keepMsg) say(dmsg, t("super_sent"), "ok"); }
  } catch (err) {
    var em = (err && err.message) || "";
    if (/LIMIT_LIKES/.test(em)) say(dmsg, t("limit_likes"), "err");
    else if (/LIMIT_SUPER/.test(em)) say(dmsg, t("limit_super"), "err");
    else say(dmsg, em || t("e_generic"), "err");
  }
  $("like").disabled = $("pass").disabled = $("superlike").disabled = false;
}
$("superlike").onclick = function () { swipe(true, true); };
$("undo").onclick = async function () {
  if (!lastPassed) return;
  $("undo").disabled = true;
  var r = await db.from("swipes").delete().eq("from_id", currentUser.id).eq("to_id", lastPassed.id).eq("liked", false);
  $("undo").disabled = false;
  if (r.error) return say($("dmsg"), r.error.message, "err");
  candidate = lastPassed; lastPassed = null; $("undo").hidden = true;
  $("cand-empty").hidden = true; say($("dmsg"), "", ""); renderCandidate();
};

$("go-discover").onclick = function () { loadFilters(); fromLikes = false; lastPassed = null; $("undo").hidden = true; $("match-banner").hidden = true; showSection("discover"); nextCandidate(); };
function saveFilters() {
  try { localStorage.setItem("filters", JSON.stringify({ min: $("f-min").value, max: $("f-max").value, country: $("f-country").value, intent: $("f-intent").value, lang: $("f-lang").value })); } catch (e) {}
}
function loadFilters() {
  try {
    var f = JSON.parse(localStorage.getItem("filters") || "null"); if (!f) return;
    $("f-min").value = f.min || 18; $("f-max").value = f.max || 99;
    $("f-country").value = f.country || ""; $("f-intent").value = f.intent || ""; $("f-lang").value = f.lang || "";
  } catch (e) {}
}
$("f-apply").onclick = function () { saveFilters(); $("filters").open = false; $("match-banner").hidden = true; nextCandidate(); };
$("discover-back").onclick = function () { if (fromLikes) { fromLikes = false; showSection("likes"); loadLikes(); } else showSection("home"); };
$("like").onclick = function () { swipe(true); };
$("pass").onclick = function () { swipe(false); };
