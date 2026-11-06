// Boîte de réception des messages (aperçu et messages non lus)

// ---------- Matchs (avec aperçu et messages non lus) ----------
function readMap() { try { return JSON.parse(localStorage.getItem("lastread:" + currentUser.id) || "{}"); } catch (e) { return {}; } }
function markRead(peerId) {
  try { var m = readMap(); m[peerId] = new Date().toISOString(); localStorage.setItem("lastread:" + currentUser.id, JSON.stringify(m)); } catch (e) {}
}

// ---------- Boîte de réception ----------
// Toutes les personnes avec qui j'ai échangé au moins un message (plus besoin de match)
var inboxData = null;        // dernières données chargées (pour filtrer sans recharger)

// Conversations masquées avec la croix : elles reviennent si un nouveau message arrive
function hiddenMap() { try { return JSON.parse(localStorage.getItem("hiddenconv:" + currentUser.id) || "{}"); } catch (e) { return {}; } }
function hideConv(peerId) {
  try { var m = hiddenMap(); m[peerId] = new Date().toISOString(); localStorage.setItem("hiddenconv:" + currentUser.id, JSON.stringify(m)); } catch (e) {}
}

async function loadMatches() {
  var list = $("matches-list"); $("matches-empty").hidden = true;
  var me = currentUser.id;
  var mm = await db.from("messages").select("from_id,to_id,body,created_at,image_path")
    .or("from_id.eq." + me + ",to_id.eq." + me).order("created_at", { ascending: false }).limit(500);
  if (mm.error) { list.textContent = ""; $("matches-empty").textContent = t("matches_err"); $("matches-empty").hidden = false; return; }
  var last = {}, count = {};
  (mm.data || []).forEach(function (m) {
    var peer = m.from_id === me ? m.to_id : m.from_id;
    if (!last[peer]) last[peer] = m;
    count[peer] = (count[peer] || 0) + 1;
  });
  var blocked = {};
  try { var bl = await db.rpc("my_blocked"); ((bl && bl.data) || []).forEach(function (x) { blocked[x.id] = true; }); } catch (e) {}
  var ids = Object.keys(last).filter(function (id) { return !blocked[id]; }), people = [];
  if (ids.length) {
    var r = await db.from("profiles").select("*").in("id", ids).eq("suspended", false);
    people = r.data || [];
  }
  inboxData = { people: people, last: last, count: count };
  renderInbox();
}

function isUnread(p) {
  var lm = inboxData.last[p.id], seenAt = readMap();
  return !!(lm && lm.from_id !== currentUser.id && (!seenAt[p.id] || lm.created_at > seenAt[p.id]));
}
function isOnline(p) { return !!(p.last_seen && (Date.now() - new Date(p.last_seen).getTime()) < 15 * 60000); }

function renderInbox() {
  if (!inboxData) return;
  var list = $("matches-list"), empty = $("matches-empty"), d = inboxData, hidden = hiddenMap();
  list.textContent = ""; empty.hidden = true;
  var rows = d.people.filter(function (p) {
    var lm = d.last[p.id];
    return lm && !(hidden[p.id] && lm.created_at <= hidden[p.id]);
  });
  var q = plain($("inbox-q").value.trim());
  if (q) rows = rows.filter(function (p) { return plain(p.first_name + " " + (p.city || "")).indexOf(q) !== -1; });
  if ($("only-unread").checked) rows = rows.filter(isUnread);
  var sort = $("inbox-sort").value;
  rows.sort(function (x, y) {
    if (sort === "unread" && isUnread(x) !== isUnread(y)) return isUnread(x) ? -1 : 1;
    if (sort === "online" && isOnline(x) !== isOnline(y)) return isOnline(x) ? -1 : 1;
    var lx = d.last[x.id] ? d.last[x.id].created_at : (x.created_at || ""), ly = d.last[y.id] ? d.last[y.id].created_at : (y.created_at || "");
    return lx < ly ? 1 : lx > ly ? -1 : 0;
  });

  if (!rows.length) {
    empty.textContent = $("only-unread").checked && d.people.length ? t("unread_empty") : t("inbox_empty2");
    empty.hidden = false; return;
  }
  rows.forEach(function (p) { list.appendChild(inboxRow(p)); });
}

function inboxRow(p) {
  var d = inboxData, lm = d.last[p.id], unread = isUnread(p);
  var row = document.createElement("div"); row.className = "irow" + (unread ? " unread" : ""); row.setAttribute("role", "button"); row.tabIndex = 0;

  var dot = document.createElement("span"); dot.className = "iunread"; dot.setAttribute("aria-hidden", "true"); row.appendChild(dot);

  var pic = document.createElement("div"); pic.className = "ipic";
  var url = photoUrl(p);
  if (url) { var im = document.createElement("img"); im.src = url; im.alt = ""; im.loading = "lazy"; pic.appendChild(im); }
  else { pic.classList.add("ph"); pic.textContent = p.first_name.charAt(0).toUpperCase(); }
  var n = photoPaths(p).length;
  if (n) { var c = document.createElement("span"); c.className = "ipcount"; c.textContent = "📷 " + n; pic.appendChild(c); }
  row.appendChild(pic);

  var info = document.createElement("div"); info.className = "iinfo";
  var l1 = document.createElement("div"); l1.className = "il1";
  if (isOnline(p)) { var on = document.createElement("i"); on.className = "cdot"; l1.appendChild(on); }
  var nm = document.createElement("span"); nm.className = "iname"; nm.textContent = p.first_name + (d.count[p.id] ? " (" + d.count[p.id] + ")" : ""); l1.appendChild(nm);
  if (p.verified) { var v = document.createElement("span"); v.className = "fcheck"; v.textContent = "✓"; v.title = t("verified_tag"); l1.appendChild(v); }
  var tm = document.createElement("span"); tm.className = "itime"; tm.textContent = lm ? timeAgo(lm.created_at) : ""; l1.appendChild(tm);
  info.appendChild(l1);

  var head = (p.bio || "").split("\n")[0].trim();
  if (head) { var l2 = document.createElement("div"); l2.className = "ihead2"; l2.textContent = head; info.appendChild(l2); }
  var place = [p.birthdate ? ageFrom(p.birthdate) : "", p.city || (p.country ? countryLabel(p.country) : "")].filter(Boolean).join(", ");
  if (place) { var l3 = document.createElement("div"); l3.className = "iplace"; l3.textContent = place; info.appendChild(l3); }
  var l4 = document.createElement("div"); l4.className = "ilast";
  if (lm) l4.textContent = (lm.from_id === currentUser.id ? t("you") : "") + (lm.image_path ? "📷 " + t("photo_label") : lm.body);
  info.appendChild(l4);
  row.appendChild(info);

  if (lm) {
    var x = document.createElement("button"); x.type = "button"; x.className = "ihide"; x.setAttribute("aria-label", t("hide_conv"));
    x.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    x.onclick = function (e) { e.stopPropagation(); hideConv(p.id); renderInbox(); };
    row.appendChild(x);
  }
  row.onclick = function () { openChat(p); };
  row.onkeydown = function (e) { if (e.key === "Enter" && e.target === row) openChat(p); };
  return row;
}

$("only-unread").onchange = renderInbox;
$("inbox-sort").onchange = function () { try { localStorage.setItem("inboxsort", $("inbox-sort").value); } catch (e) {} renderInbox(); };
try { var _sort = localStorage.getItem("inboxsort"); if (_sort) $("inbox-sort").value = _sort; } catch (e) {}
$("inbox-search-btn").onclick = function () {
  var q = $("inbox-q"); q.hidden = !q.hidden;
  if (!q.hidden) q.focus(); else { q.value = ""; renderInbox(); }
};
$("inbox-q").addEventListener("input", renderInbox);
$("go-matches").onclick = function () { showSection("matches"); loadMatches(); };
$("matches-back").onclick = function () { showSection("home"); };
