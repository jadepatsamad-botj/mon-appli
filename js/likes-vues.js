// Intérêts : « A consulté mon profil », « Favoris », « M'a ajouté en favori »
// Un favori est enregistré dans la table swipes (liked = true). Il n'y a plus de système de match :
// on peut écrire à n'importe qui depuis son profil.

var favTab = "views";       // onglet ouvert : "views", "favs" ou "favme"
var fromLikes = false;      // onglet d'où l'on a ouvert un profil (pour y revenir)
var myFavs = {};            // id -> true pour les personnes que j'ai mises en favori
var myConvs = {};           // id -> true pour les personnes avec qui j'ai déjà une conversation

// Revenir à Intérêts (au bon onglet) après avoir ouvert un profil
function backToInterests() {
  if (fromLikes && fromLikes !== true) favTab = fromLikes;
  fromLikes = false;
  showSection("likes");
  loadLikes();
}

// Mes favoris et mes conversations (pour l'état des boutons ♥ et Message)
async function loadMyLinks() {
  var me = currentUser.id;
  var f = await db.from("swipes").select("to_id").eq("from_id", me).eq("liked", true);
  myFavs = {}; (f.data || []).forEach(function (x) { myFavs[x.to_id] = true; });
  var m = await db.from("messages").select("from_id,to_id").or("from_id.eq." + me + ",to_id.eq." + me).order("created_at", { ascending: false }).limit(500);
  myConvs = {}; (m.data || []).forEach(function (x) { myConvs[x.from_id === me ? x.to_id : x.from_id] = true; });
}

// Ajouter / retirer un favori
async function toggleFav(p, btn) {
  var me = currentUser.id, msg = $("lmsg");
  if (btn) btn.disabled = true;
  var r;
  if (myFavs[p.id]) {
    r = await db.from("swipes").delete().eq("from_id", me).eq("to_id", p.id);
    if (!r.error) { delete myFavs[p.id]; say(msg, t("fav_removed"), "ok"); }
  } else {
    await db.from("swipes").delete().eq("from_id", me).eq("to_id", p.id);   // efface un ancien « passer » éventuel
    r = await db.from("swipes").insert({ from_id: me, to_id: p.id, liked: true });
    if (!r.error) { myFavs[p.id] = true; say(msg, t("fav_added"), "ok"); }
  }
  if (btn) btn.disabled = false;
  if (r.error) {
    var em = r.error.message || "";
    say(msg, /LIMIT_LIKES/.test(em) ? t("limit_likes") : em || t("e_generic"), "err");
    return false;
  }
  return true;
}

function favButton(p, onDone) {
  var b = document.createElement("button"); b.type = "button"; b.className = "ibtn fav" + (myFavs[p.id] ? " on" : "");
  b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';
  var lab = document.createElement("span"); lab.textContent = t("fav_btn").replace(/^\s*♥\s*/, ""); b.appendChild(lab);
  b.setAttribute("aria-pressed", String(!!myFavs[p.id]));
  b.onclick = async function (e) {
    e.stopPropagation();
    if (await toggleFav(p, b)) {
      b.classList.toggle("on", !!myFavs[p.id]); b.setAttribute("aria-pressed", String(!!myFavs[p.id]));
      if (onDone) onDone();
    }
  };
  return b;
}

function msgButton(p) {
  var b = document.createElement("button"); b.type = "button";
  b.className = "ibtn " + (myConvs[p.id] ? "outline" : "dark");
  b.textContent = myConvs[p.id] ? t("btn_show_msg") : t("btn_message");
  b.onclick = function (e) { e.stopPropagation(); openChat(p); };
  return b;
}

// Une ligne comme sur la capture : photo, point vert, prénom ✓, date, bio, âge et lieu, boutons
function interestRow(p, when) {
  var row = document.createElement("div"); row.className = "irow frow"; row.setAttribute("role", "button"); row.tabIndex = 0;
  var pic = document.createElement("div"); pic.className = "ipic tall";
  var url = photoUrl(p);
  if (url) { var im = document.createElement("img"); im.src = url; im.alt = ""; im.loading = "lazy"; pic.appendChild(im); }
  else { pic.classList.add("ph"); pic.textContent = p.first_name.charAt(0).toUpperCase(); }
  var n = photoPaths(p).length;
  if (n) { var c = document.createElement("span"); c.className = "ipcount"; c.textContent = "📷 " + n; pic.appendChild(c); }
  row.appendChild(pic);

  var info = document.createElement("div"); info.className = "iinfo";
  var l1 = document.createElement("div"); l1.className = "il1";
  if (isOnlineP(p)) { var on = document.createElement("i"); on.className = "cdot"; l1.appendChild(on); }
  var nm = document.createElement("span"); nm.className = "iname"; nm.textContent = p.first_name; l1.appendChild(nm);
  if (p.verified) { var v = document.createElement("span"); v.className = "fcheck"; v.textContent = "✓"; v.title = t("verified_tag"); l1.appendChild(v); }
  var tm = document.createElement("span"); tm.className = "itime right"; tm.textContent = when ? timeAgo(when) : ""; l1.appendChild(tm);
  info.appendChild(l1);
  var head = (p.bio || "").split("\n")[0].trim();
  if (head) { var l2 = document.createElement("div"); l2.className = "ihead2"; l2.textContent = head; info.appendChild(l2); }
  var place = [p.birthdate ? ageFrom(p.birthdate) : "", p.city, p.country ? countryLabel(p.country) : ""].filter(Boolean).join(", ");
  if (place) { var l3 = document.createElement("div"); l3.className = "iplace"; l3.textContent = place; info.appendChild(l3); }
  var btns = document.createElement("div"); btns.className = "ibtns";
  btns.appendChild(msgButton(p));
  btns.appendChild(favButton(p, function () { if (favTab === "favs" && !myFavs[p.id]) { row.remove(); if (!$("likes-list").children.length) loadLikes(); } }));
  info.appendChild(btns);
  row.appendChild(info);

  var open = function () {
    fromLikes = favTab; fromFeed = false; candidate = p; lastPassed = null;
    $("match-banner").hidden = true; $("cand-empty").hidden = true; $("undo").hidden = true; say($("dmsg"), "", "");
    showSection("discover"); renderCandidate(); window.scrollTo(0, 0);
  };
  row.onclick = open;
  row.onkeydown = function (e) { if (e.key === "Enter" && e.target === row) open(); };
  return row;
}

function isOnlineP(p) { return !!(p.last_seen && (Date.now() - new Date(p.last_seen).getTime()) < 15 * 60000); }

function favSeenKey() { return "favseen:" + currentUser.id; }

async function loadLikes() {
  if (!currentUser) return;
  var list = $("likes-list"), empty = $("likes-empty"), me = currentUser.id;
  ["views", "favs", "favme"].forEach(function (k) { $("ftab-" + k).setAttribute("aria-selected", String(favTab === k)); });
  empty.hidden = true; say($("lmsg"), "", "");
  if (!list.children.length || list.dataset.tab !== favTab) { list.textContent = ""; say($("lmsg"), t("searching"), ""); }
  await loadMyLinks();

  var rows = [], when = {}, locked = 0, err = null;
  if (favTab === "views") {
    if (myLevel() < 1) {
      var cnt = await db.rpc("count_my_views");
      locked = (cnt && typeof cnt.data === "number") ? cnt.data : 0;
    } else {
      var v = await db.from("profile_views").select("viewer_id,viewed_at").eq("viewed_id", me).order("viewed_at", { ascending: false }).limit(100);
      err = v.error; (v.data || []).forEach(function (x) { when[x.viewer_id] = x.viewed_at; });
    }
  } else if (favTab === "favs") {
    var f = await db.from("swipes").select("to_id,created_at").eq("from_id", me).eq("liked", true).order("created_at", { ascending: false }).limit(200);
    err = f.error; (f.data || []).forEach(function (x) { when[x.to_id] = x.created_at; });
  } else {
    var g = await db.from("swipes").select("from_id,created_at").eq("to_id", me).eq("liked", true).order("created_at", { ascending: false }).limit(200);
    err = g.error; (g.data || []).forEach(function (x) { when[x.from_id] = x.created_at; });
    try { localStorage.setItem(favSeenKey(), new Date().toISOString()); } catch (e) {}
    if (myLevel() < 1) locked = Object.keys(when).length;
    if (typeof checkBadges === "function") checkBadges();
  }
  var ids = Object.keys(when);
  if (ids.length && !locked) {
    var r = await db.from("profiles").select("*").in("id", ids).eq("suspended", false);
    rows = r.data || [];
  }
  list.textContent = ""; list.dataset.tab = favTab; say($("lmsg"), "", "");
  if (locked) { list.appendChild(lockedBox(t(favTab === "views" ? "locked_views" : "locked_favme", { n: locked }))); return; }
  if (!rows.length) {
    empty.textContent = err ? err.message : t(favTab === "views" ? "views_empty" : favTab === "favs" ? "favs_empty" : "favme_empty");
    empty.hidden = false; return;
  }
  var sort = $("fav-sort").value;
  rows.sort(function (x, y) {
    if (sort === "online" && isOnlineP(x) !== isOnlineP(y)) return isOnlineP(x) ? -1 : 1;
    return (when[x.id] || "") < (when[y.id] || "") ? 1 : -1;
  });
  rows.forEach(function (p) { list.appendChild(interestRow(p, when[p.id])); });
}
async function loadViews() { favTab = "views"; return loadLikes(); }

["views", "favs", "favme"].forEach(function (k) {
  $("ftab-" + k).onclick = function () { favTab = k; loadLikes(); };
});
$("fav-sort").onchange = function () { loadLikes(); };

$("go-views").onclick = function () { favTab = "views"; showSection("likes"); loadLikes(); };
$("go-likes").onclick = function () { favTab = "favme"; showSection("likes"); loadLikes(); };
$("likes-back").onclick = function () { showSection("home"); };
