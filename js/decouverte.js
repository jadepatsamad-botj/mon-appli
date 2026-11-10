// Découverte : profils proposés, like, pass, super like, filtres

// ---------- Découverte ----------
var candidate = null;
var fromFeed = false;   // vrai quand le profil a été ouvert depuis l'Accueil

// Colonnes optionnelles absentes de la base (on les découvre au premier essai et on s'en passe)
var MISSING_COLS = {};

// Requête des profils à montrer : tous les inscrits du genre que je cherche + filtres choisis
// (utilisée par l'Accueil et la découverte)
function discoverQuery(seen) {
  var q = db.from("profiles").select("*").not("id", "in", "(" + seen.join(",") + ")");
  q = q.not("photo_path", "is", null);
  ["suspended", "hidden", "under_review"].forEach(function (c) { if (!MISSING_COLS[c]) q = q.not(c, "is", true); });
  if (!MISSING_COLS.boost) q = q.order("boost", { ascending: false, nullsFirst: false });
  q = q.order("created_at", { ascending: false });
  var want = currentProfile.looking_for;
  if (want === "homme" || want === "femme") q = q.eq("gender", want);
  var amin = parseInt($("f-min").value, 10), amax = parseInt($("f-max").value, 10);
  if (amin > 18) q = q.lte("birthdate", dateYearsAgo(amin));
  if (amax < 99) q = q.gt("birthdate", dateYearsAgo(amax + 1));
  if ($("f-country").value) q = q.eq("country", $("f-country").value);
  if ($("f-origin").value && !MISSING_COLS.origins) q = q.contains("origins", [$("f-origin").value]);
  if (myLevel() < 1) { $("f-intent").value = ""; $("f-lang").value = ""; }
  if ($("f-intent").value) q = q.eq("intention", $("f-intent").value);
  if ($("f-lang").value) q = q.contains("spoken", [$("f-lang").value]);
  return q;
}

// Lance une requête de profils ; si une colonne optionnelle n'existe pas, on réessaie sans elle
async function fetchProfiles(make) {
  for (var i = 0; i < 5; i++) {
    var r = await make();
    var m = r && r.error && /column profiles\.(\w+) does not exist/.exec(r.error.message || "");
    if (!m || MISSING_COLS[m[1]]) return r;
    MISSING_COLS[m[1]] = true;
  }
  return r;
}

function renderCandidate() {
  $("cand-name").textContent = nameWithAge(candidate);
  if (isOnlineNow(candidate)) $("cand-name").insertBefore(onlineDot(candidate), $("cand-name").firstChild);
  tagsInto($("cand-tags"), candidate);
  $("cand-bio").textContent = candidate.bio || "";
  setGallery($("cand-photo"), candidate);
  if (currentUser && candidate.id !== currentUser.id) {
    db.from("profile_views").upsert({ viewer_id: currentUser.id, viewed_id: candidate.id, viewed_at: new Date().toISOString() }).then(function () {}, function () {});
  }
  $("cand").hidden = false;
  paintCandFav();
}

async function nextCandidate() {
  var dmsg = $("dmsg"); say(dmsg, t("searching"), "");
  $("cand").hidden = true; $("cand-empty").hidden = true;
  var s = await db.from("swipes").select("to_id").eq("from_id", currentUser.id);
  if (s.error) return say(dmsg, s.error.message, "err");
  var seen = (s.data || []).map(function (x) { return x.to_id; });
  seen.push(currentUser.id);
  var r = await fetchProfiles(function () { return discoverQuery(seen).limit(1); });
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
    await db.from("swipes").delete().eq("from_id", currentUser.id).eq("to_id", candidate.id);   // remplace un ancien choix
    var ins = await db.from("swipes").insert(row);
    if (ins.error) throw ins.error;
    lastPassed = liked ? null : candidate;
    $("undo").hidden = !lastPassed || fromLikes;
    if (isSuper) say(dmsg, t("super_sent"), "ok");
    if (liked) { myFavs[candidate.id] = true; if (isSuper) notify(candidate.id, "super"); }
    else delete myFavs[candidate.id];
    if (fromFeed) { backToFeed(candidate.id, liked, liked ? t("fav_added") : ""); }
    else if (fromLikes) { backToInterests(); }
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

$("go-discover").onclick = function () { loadFilters(); fromLikes = false; fromFeed = false; lastPassed = null; $("undo").hidden = true; $("match-banner").hidden = true; showSection("discover"); nextCandidate(); };
function saveFilters() {
  try { localStorage.setItem("filters", JSON.stringify({ min: $("f-min").value, max: $("f-max").value, country: $("f-country").value, origin: $("f-origin").value, intent: $("f-intent").value, lang: $("f-lang").value })); } catch (e) {}
}
function loadFilters() {
  try {
    var f = JSON.parse(localStorage.getItem("filters") || "null"); if (!f) return;
    $("f-min").value = f.min || 18; $("f-max").value = f.max || 99;
    if (!$("f-origin").childElementCount) fillOriginFilter();
    $("f-country").value = f.country || ""; $("f-origin").value = f.origin || ""; $("f-intent").value = f.intent || ""; $("f-lang").value = f.lang || "";
  } catch (e) {}
}
$("f-apply").onclick = function () { saveFilters(); $("filters").open = false; $("match-banner").hidden = true; nextCandidate(); };
$("discover-back").onclick = function () {
  if (fromFeed) backToFeed();
  else if (fromLikes) backToInterests();
  else showSection("home");
};
// Profil ouvert depuis l'Accueil ou Intérêts : ♥ ajoute / retire des favoris sans changer d'écran
function paintCandFav() {
  if (!candidate) return;
  var single = fromFeed || fromLikes;
  $("like").textContent = single && myFavs[candidate.id] ? t("fav_on") : t("fav_btn");
  $("pass").hidden = !!fromLikes;
}
$("like").onclick = async function () {
  if (!candidate) return;
  if (fromFeed || fromLikes) {
    if (await toggleFav(candidate, $("like"))) { say($("dmsg"), myFavs[candidate.id] ? t("fav_added") : t("fav_removed"), "ok"); paintCandFav(); }
    else say($("dmsg"), $("lmsg").textContent, "err");
    return;
  }
  swipe(true);
};
$("cand-msg").onclick = function () { if (candidate) openChat(candidate); };
$("pass").onclick = function () { swipe(false); };
