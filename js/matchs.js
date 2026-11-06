// Liste des matchs (aperçu et messages non lus)

// ---------- Matchs (avec aperçu et messages non lus) ----------
function readMap() { try { return JSON.parse(localStorage.getItem("lastread:" + currentUser.id) || "{}"); } catch (e) { return {}; } }
function markRead(peerId) {
  try { var m = readMap(); m[peerId] = new Date().toISOString(); localStorage.setItem("lastread:" + currentUser.id, JSON.stringify(m)); } catch (e) {}
}

async function loadMatches() {
  var list = $("matches-list"); list.textContent = ""; $("matches-empty").hidden = true;
  var me = currentUser.id;
  var a = await db.from("swipes").select("to_id").eq("from_id", me).eq("liked", true);
  var b = await db.from("swipes").select("from_id").eq("to_id", me).eq("liked", true);
  if (a.error || b.error) { $("matches-empty").textContent = t("matches_err"); $("matches-empty").hidden = false; return; }
  var mine = (a.data || []).map(function (x) { return x.to_id; });
  var ids = (b.data || []).map(function (x) { return x.from_id; }).filter(function (id) { return mine.indexOf(id) !== -1; });
  var people = [];
  if (ids.length) {
    var r = await db.from("profiles").select("*").in("id", ids).eq("suspended", false);   // les personnes bloquées n'apparaissent plus
    people = r.data || [];
  }
  if (!people.length) { $("matches-empty").textContent = t("matches_empty"); $("matches-empty").hidden = false; return; }

  var last = {};
  var mm = await db.from("messages").select("from_id,to_id,body,created_at")
    .or("from_id.eq." + me + ",to_id.eq." + me).order("created_at", { ascending: false }).limit(300);
  (mm.data || []).forEach(function (m) { var peer = m.from_id === me ? m.to_id : m.from_id; if (!last[peer]) last[peer] = m; });
  var seenAt = readMap();
  people.sort(function (x, y) {
    var lx = last[x.id] ? last[x.id].created_at : "", ly = last[y.id] ? last[y.id].created_at : "";
    return lx < ly ? 1 : lx > ly ? -1 : 0;
  });

  people.forEach(function (p) {
    var row = document.createElement("div"); row.className = "mrow link"; row.setAttribute("role", "button"); row.tabIndex = 0;
    var url = photoUrl(p), pic;
    if (url) { pic = document.createElement("img"); pic.src = url; pic.alt = ""; }
    else { pic = document.createElement("div"); pic.className = "mph"; pic.textContent = p.first_name.charAt(0).toUpperCase(); }
    var info = document.createElement("div"); info.className = "mi";
    var strong = document.createElement("strong"); strong.textContent = nameWithAge(p) + (p.verified ? " ✓" : "");
    var small = document.createElement("small");
    var lm = last[p.id];
    small.textContent = lm ? (lm.from_id === me ? t("you") : "") + lm.body : (p.country ? countryLabel(p.country) : "");
    info.appendChild(strong); info.appendChild(small);
    row.appendChild(pic); row.appendChild(info);
    if (lm && lm.from_id !== me && (!seenAt[p.id] || lm.created_at > seenAt[p.id])) {
      var bd = document.createElement("span"); bd.className = "badge"; bd.textContent = t("new_badge"); row.appendChild(bd);
    }
    row.onclick = function () { openChat(p); };
    row.onkeydown = function (e) { if (e.key === "Enter") openChat(p); };
    list.appendChild(row);
  });
}
$("go-matches").onclick = function () { showSection("matches"); loadMatches(); };
$("matches-back").onclick = function () { showSection("home"); };
