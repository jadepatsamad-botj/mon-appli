// Pastilles : nouveaux messages et nouveaux likes

// ---------- Pastilles : nouveaux messages et nouveaux likes ----------
var badgeTimer = null;
function paintBadge(id, key, n) { $(id).textContent = t(key) + (n > 0 ? "  \u25CF " + n : ""); }
async function checkBadges() {
  if (!currentUser) return;
  var me = currentUser.id, unread = 0, likes = 0;
  try {
    var mm = await db.from("messages").select("from_id,created_at").eq("to_id", me).order("created_at", { ascending: false }).limit(200);
    var seenAt = readMap(), lastIn = {};
    (mm.data || []).forEach(function (m) { if (!lastIn[m.from_id]) lastIn[m.from_id] = m.created_at; });
    Object.keys(lastIn).forEach(function (pid) { if (!seenAt[pid] || lastIn[pid] > seenAt[pid]) unread++; });
    var a = await db.from("swipes").select("to_id").eq("from_id", me);
    var b = await db.from("swipes").select("from_id").eq("to_id", me).eq("liked", true);
    var done = (a.data || []).map(function (x) { return x.to_id; });
    likes = (b.data || []).filter(function (x) { return done.indexOf(x.from_id) === -1; }).length;
  } catch (e) {}
  paintBadge("go-matches", "matches", unread);
  paintBadge("go-likes", "likes_btn", likes);
}
function startBadges() {
  checkBadges();
  if (!badgeTimer) badgeTimer = setInterval(function () { if (currentUser && !$("home").hidden) checkBadges(); }, 30000);
}
