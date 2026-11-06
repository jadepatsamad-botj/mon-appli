// Qui m'a liké, qui a vu mon profil

// ---------- Qui m'a liké ----------
var fromLikes = false;   // "likes" ou "views" quand un profil est ouvert depuis Intérêts

// Revenir à la bonne liste (likes ou vues) après avoir ouvert un profil
function backToInterests() {
  var where = fromLikes === "views" ? "views" : "likes";
  fromLikes = false;
  showSection(where);
  if (where === "views") loadViews(); else loadLikes();
}
async function loadLikes() {
  var list = $("likes-list"); list.textContent = ""; $("likes-empty").hidden = true;
  var me = currentUser.id;
  var a = await db.from("swipes").select("to_id").eq("from_id", me);
  var b = await db.from("swipes").select("*").eq("to_id", me).eq("liked", true);
  var done = (a.data || []).map(function (x) { return x.to_id; });
  var supers = {}; (b.data || []).forEach(function (x) { if (x.super) supers[x.from_id] = true; });
  var ids = (b.data || []).map(function (x) { return x.from_id; }).filter(function (id) { return done.indexOf(id) === -1; });
  var people = [];
  if (ids.length) { var r = await db.from("profiles").select("*").in("id", ids).eq("suspended", false); people = r.data || []; }
  people.sort(function (x, y) { return (supers[y.id] ? 1 : 0) - (supers[x.id] ? 1 : 0); });
  if (!people.length) { $("likes-empty").textContent = t("likes_empty"); $("likes-empty").hidden = false; return; }
  if (myLevel() < 1) { list.appendChild(lockedBox(t("locked_likes", { n: people.length }))); return; }
  people.forEach(function (p) {
    var row = document.createElement("div"); row.className = "mrow link"; row.setAttribute("role", "button"); row.tabIndex = 0;
    var url = photoUrl(p), pic;
    if (url) { pic = document.createElement("img"); pic.src = url; pic.alt = ""; }
    else { pic = document.createElement("div"); pic.className = "mph"; pic.textContent = p.first_name.charAt(0).toUpperCase(); }
    var info = document.createElement("div"); info.className = "mi";
    var strong = document.createElement("strong"); strong.textContent = nameWithAge(p) + (p.verified ? " ✓" : "");
    var small = document.createElement("small"); small.textContent = p.country ? countryLabel(p.country) : "";
    info.appendChild(strong); info.appendChild(small);
    row.appendChild(pic); row.appendChild(info);
    if (supers[p.id]) { var st = document.createElement("span"); st.className = "staricon"; st.textContent = "⭐"; st.title = t("super_tag"); row.appendChild(st); }
    var open = function () { fromLikes = "likes"; fromFeed = false; candidate = p; $("match-banner").hidden = true; $("cand-empty").hidden = true; showSection("discover"); renderCandidate(); };
    row.onclick = open; row.onkeydown = function (e) { if (e.key === "Enter") open(); };
    list.appendChild(row);
  });
}
async function loadViews() {
  var list = $("views-list"); list.textContent = ""; $("views-empty").hidden = true;
  if (myLevel() < 1) {
    var cnt = await db.rpc("count_my_views");
    var n = (cnt && typeof cnt.data === "number") ? cnt.data : 0;
    if (!n) { $("views-empty").textContent = t("views_empty"); $("views-empty").hidden = false; }
    else list.appendChild(lockedBox(t("locked_views", { n: n })));
    return;
  }
  var v = await db.from("profile_views").select("viewer_id,viewed_at").eq("viewed_id", currentUser.id).order("viewed_at", { ascending: false }).limit(50);
  var rows = (v.data || []), when = {};
  rows.forEach(function (x) { when[x.viewer_id] = x.viewed_at; });
  var ids = rows.map(function (x) { return x.viewer_id; }), people = [];
  if (ids.length) { var r = await db.from("profiles").select("*").in("id", ids).eq("suspended", false); people = r.data || []; }
  people.sort(function (x, y) { return when[x.id] < when[y.id] ? 1 : -1; });
  if (!people.length) { $("views-empty").textContent = v.error ? v.error.message : t("views_empty"); $("views-empty").hidden = false; return; }
  people.forEach(function (p) {
    var row = document.createElement("div"); row.className = "mrow link"; row.setAttribute("role", "button"); row.tabIndex = 0;
    var url = photoUrl(p), pic;
    if (url) { pic = document.createElement("img"); pic.src = url; pic.alt = ""; }
    else { pic = document.createElement("div"); pic.className = "mph"; pic.textContent = p.first_name.charAt(0).toUpperCase(); }
    var info = document.createElement("div"); info.className = "mi";
    var strong = document.createElement("strong"); strong.textContent = nameWithAge(p) + (p.verified ? " ✓" : "");
    var small = document.createElement("small"); small.textContent = t("seen_on", { d: new Date(when[p.id]).toLocaleDateString() }) + (p.country ? " · " + countryLabel(p.country) : "");
    info.appendChild(strong); info.appendChild(small); row.appendChild(pic); row.appendChild(info);
    var open = function () { fromLikes = "views"; fromFeed = false; candidate = p; $("match-banner").hidden = true; $("cand-empty").hidden = true; $("undo").hidden = true; showSection("discover"); renderCandidate(); };
    row.onclick = open; row.onkeydown = function (e) { if (e.key === "Enter") open(); };
    list.appendChild(row);
  });
}
$("go-views").onclick = function () { showSection("views"); loadViews(); };
$("views-back").onclick = function () { showSection("home"); };

$("go-likes").onclick = function () { showSection("likes"); loadLikes(); };
$("likes-back").onclick = function () { showSection("home"); };
