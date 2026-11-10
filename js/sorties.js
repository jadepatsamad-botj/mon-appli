// Sorties Jade (étape 2 : se rencontrer en vrai)
// - carte et adresse de l'activité, participants visibles entre participants
// - discussion de groupe par activité
// - après la sortie : « Qui avez-vous aimé rencontrer ? » (réciproque → message de l'équipe Jade)
// - rappels dans la messagerie de l'équipe Jade, badge « sorties Jade » sur le profil
// Tables Supabase : sql/activites-plus.sql

// ---------- Adresse et carte ----------
function evMapLine(e) {
  var d = document.createElement("div"); d.className = "evaddr";
  d.appendChild(document.createTextNode("📍 " + e.address + " · "));
  var a = document.createElement("a"); a.target = "_blank"; a.rel = "noopener";
  a.href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent([e.address, e.city, e.country].filter(Boolean).join(", "));
  a.textContent = t("ev_map"); d.appendChild(a);
  return d;
}

// ---------- Participants (pastilles photo + prénom) ----------
async function fillEvPeople(eid, box) {
  box.textContent = "";
  var r; try { r = await db.rpc("event_people", { eid: eid }); } catch (x) { return; }
  if (!r || r.error || !Array.isArray(r.data) || !r.data.length) return;
  var t1 = document.createElement("div"); t1.className = "evpeople-t"; t1.textContent = t("ev_people", { n: r.data.length }); box.appendChild(t1);
  var row = document.createElement("div"); row.className = "evpeople-row2";
  r.data.slice(0, 12).forEach(function (p) {
    var c = document.createElement("div"); c.className = "evp";
    var pic = document.createElement("div"); pic.className = "evp-pic";
    var url = p.photo_path ? photoUrl({ photo_path: p.photo_path, photos: [p.photo_path] }) : null;
    if (url) { var im = document.createElement("img"); im.src = url; im.alt = ""; pic.appendChild(im); }
    else pic.textContent = (p.first_name || "?").charAt(0).toUpperCase();
    var n = document.createElement("span"); n.textContent = (p.first_name || "") + (p.verified ? " ✓" : "") + (p.user_id === currentUser.id ? " (" + t("you") + ")" : "");
    c.appendChild(pic); c.appendChild(n); row.appendChild(c);
  });
  box.appendChild(row);
}

// ---------- Discussion de groupe ----------
var evChatEvent = null, evChatTimer = null, evChatNames = {};
SECTIONS.push("evchat");
TAB_OF.evchat = "events";

async function openEvChat(e) {
  evChatEvent = e;
  $("evchat-title").textContent = e.title;
  $("evchat-when").textContent = "📅 " + evWhen(e);
  $("evchat-box").textContent = ""; $("evchat-input").value = ""; say($("evchat-msg"), "", "");
  showSection("evchat"); window.scrollTo(0, 0);
  // Les prénoms des participants, pour signer les messages
  evChatNames = {};
  try { var r = await db.rpc("event_people", { eid: e.id }); (r.data || []).forEach(function (p) { evChatNames[p.user_id] = p.first_name; }); } catch (x) {}
  fillEvPeople(e.id, $("evchat-people"));
  await loadEvChat();
  clearInterval(evChatTimer);
  evChatTimer = setInterval(function () { if ($("evchat").hidden) { clearInterval(evChatTimer); return; } loadEvChat(); }, 8000);
}

async function loadEvChat() {
  if (!evChatEvent) return;
  var r = await db.from("event_messages").select("*").eq("event_id", evChatEvent.id).order("created_at", { ascending: true }).limit(300);
  if (r.error) { say($("evchat-msg"), /event_messages/.test(r.error.message || "") ? t("e_generic") : r.error.message, "err"); return; }
  var list = r.data || [], box = $("evchat-box");
  var atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  box.textContent = "";
  $("evchat-empty").hidden = list.length > 0;
  list.forEach(function (m) {
    var mine = m.user_id === currentUser.id;
    var d = document.createElement("div"); d.className = "evmsg" + (mine ? " me" : "");
    var who = document.createElement("b"); who.textContent = mine ? t("you") : (evChatNames[m.user_id] || "Jade"); d.appendChild(who);
    var p = document.createElement("p"); p.textContent = m.body; d.appendChild(p);
    var w = document.createElement("span"); w.className = "evmsg-t"; w.textContent = timeAgo(m.created_at); d.appendChild(w);
    box.appendChild(d);
  });
  if (atBottom || box.dataset.first !== "1") { box.scrollTop = box.scrollHeight; box.dataset.first = "1"; }
}

$("evchat-form").addEventListener("submit", async function (ev) {
  ev.preventDefault();
  var body = $("evchat-input").value.trim();
  if (!body || !evChatEvent) return;
  $("evchat-input").value = "";
  var r = await db.from("event_messages").insert({ event_id: evChatEvent.id, user_id: currentUser.id, body: body });
  if (r.error) { $("evchat-input").value = body; return say($("evchat-msg"), r.error.message, "err"); }
  loadEvChat();
});
$("evchat-back").onclick = function () { clearInterval(evChatTimer); goTab("events"); };

// ---------- Mes sorties passées : « Qui avez-vous aimé rencontrer ? » ----------
async function loadPastOutings() {
  var wrap = $("events-past"), box = $("events-past-list");
  wrap.hidden = true; box.textContent = "";
  var mine = await db.from("event_signups").select("event_id").eq("user_id", currentUser.id);
  var ids = ((mine && mine.data) || []).map(function (x) { return x.event_id; });
  if (!ids.length) return;
  var since = new Date(Date.now() - 30 * 86400000).toISOString();
  var r = await db.from("events").select("*").in("id", ids).eq("cancelled", false).lt("starts_at", new Date().toISOString()).gte("starts_at", since).order("starts_at", { ascending: false });
  if (r.error || !(r.data || []).length) return;
  var liked = {};
  try { var l = await db.from("event_likes").select("event_id,to_id").eq("from_id", currentUser.id); ((l && l.data) || []).forEach(function (x) { liked[x.event_id + ":" + x.to_id] = true; }); } catch (x) {}
  wrap.hidden = false;
  for (var i = 0; i < r.data.length; i++) {
    var e = r.data[i];
    var card = document.createElement("div"); card.className = "evcard evpast";
    var h = document.createElement("h3"); h.textContent = e.title; card.appendChild(h);
    var m = document.createElement("div"); m.className = "evmeta"; m.textContent = "📅 " + evWhen(e); card.appendChild(m);
    var q = document.createElement("p"); q.className = "evq"; q.textContent = t("ev_liked_q"); card.appendChild(q);
    var list = document.createElement("div"); list.className = "evlikes"; card.appendChild(list);
    var chat = document.createElement("button"); chat.type = "button"; chat.className = "linkbtn"; chat.textContent = "💬 " + t("ev_chat");
    chat.onclick = (function (ev) { return function () { openEvChat(ev); }; })(e);
    card.appendChild(chat);
    box.appendChild(card);
    var pr; try { pr = await db.rpc("event_people", { eid: e.id }); } catch (x) { pr = null; }
    ((pr && Array.isArray(pr.data) && pr.data) || []).filter(function (p) { return p.user_id !== currentUser.id; }).forEach(function (p) {
      var row = document.createElement("div"); row.className = "evlike";
      var pic = document.createElement("div"); pic.className = "evp-pic";
      var url = p.photo_path ? photoUrl({ photo_path: p.photo_path, photos: [p.photo_path] }) : null;
      if (url) { var im = document.createElement("img"); im.src = url; im.alt = ""; pic.appendChild(im); } else pic.textContent = (p.first_name || "?").charAt(0);
      var n = document.createElement("span"); n.className = "evlike-n"; n.textContent = p.first_name + (p.verified ? " ✓" : "");
      var b = document.createElement("button"); b.type = "button";
      var key = e.id + ":" + p.user_id, on = !!liked[key];
      var paint = function (btn, v) { btn.className = v ? "primary evlike-b on" : "secondary evlike-b"; btn.textContent = v ? t("ev_like_on") : t("ev_like_btn"); };
      paint(b, on);
      b.onclick = (function (btn, eid, uid, k) {
        return async function () {
          btn.disabled = true;
          var res = liked[k]
            ? await db.from("event_likes").delete().eq("event_id", eid).eq("from_id", currentUser.id).eq("to_id", uid)
            : await db.from("event_likes").insert({ event_id: eid, from_id: currentUser.id, to_id: uid });
          btn.disabled = false;
          if (res.error) return say($("evmsg"), res.error.message, "err");
          liked[k] = !liked[k]; paint(btn, liked[k]);
          if (liked[k] && typeof checkBadges === "function") checkBadges();   // peut-être réciproque
        };
      })(b, e.id, p.user_id, key);
      row.appendChild(pic); row.appendChild(n); row.appendChild(b); list.appendChild(row);
    });
    if (!list.childElementCount) list.textContent = t("ev_nobody");
  }
}
var _loadEventsSorties = loadEvents;
loadEvents = async function () { await _loadEventsSorties.apply(this, arguments); try { await loadPastOutings(); } catch (x) {} };

// ---------- Badge « sorties Jade » sur le profil ----------
var _tagsIntoSorties = tagsInto;
tagsInto = function (el, p) {
  _tagsIntoSorties(el, p);
  if (p && p.outings > 0) {
    var s = document.createElement("span"); s.className = "tag outings"; s.textContent = "🌿 " + t("outings_tag", { n: p.outings });
    el.insertBefore(s, el.firstChild && el.firstChild.classList.contains("verified") ? el.firstChild.nextSibling : el.firstChild);
  }
};

// ---------- Messagerie de l'équipe Jade : rappels de sortie et rencontres réciproques ----------
// Rappel : mes sorties qui commencent dans les 36 prochaines heures (calculé dans l'appli)
async function jadeReminders() {
  var mine = await db.from("event_signups").select("event_id").eq("user_id", currentUser.id);
  var ids = ((mine && mine.data) || []).map(function (x) { return x.event_id; });
  if (!ids.length) return [];
  var now = new Date(), soon = new Date(Date.now() + 36 * 3600000);
  var r = await db.from("events").select("*").in("id", ids).eq("cancelled", false).gte("starts_at", now.toISOString()).lte("starts_at", soon.toISOString());
  return (r && !r.error && r.data) || [];
}
function remindSeen(id) { try { return !!localStorage.getItem("remind:" + currentUser.id + ":" + id); } catch (e) { return false; } }
function remindMark(id) { try { localStorage.setItem("remind:" + currentUser.id + ":" + id, "1"); } catch (e) {} }

var _refreshJadeUnreadS = refreshJadeUnread;
refreshJadeUnread = async function () {
  await _refreshJadeUnreadS.apply(this, arguments);
  try {
    var rs = await jadeReminders(), extra = rs.filter(function (e) { return !remindSeen(e.id); }).length;
    if (extra) {
      jadeUnreadN += extra;
      var b = $("nb-jade"); b.textContent = jadeUnreadN > 9 ? "9+" : jadeUnreadN; b.hidden = false;
    }
  } catch (x) {}
};

var _loadJadeBoxS = loadJadeBox;
loadJadeBox = async function () {
  await _loadJadeBoxS.apply(this, arguments);
  var box = $("jbox-list");
  // Rencontres réciproques (kind = meet) : texte et bouton « Écrire à … »
  var cards = box.querySelectorAll(".jcard");
  var r = await jadeQuery().limit(60);
  ((r && r.data) || []).forEach(function (n, i) {
    if (n.kind !== "meet" || !cards[i]) return;
    var card = cards[i];
    Array.prototype.forEach.call(card.querySelectorAll("h3, p, button"), function (x) { x.remove(); });
    var h = document.createElement("h3"); h.textContent = t("jn_meet_t"); card.appendChild(h);
    var p = document.createElement("p"); card.appendChild(p);
    var b = document.createElement("button"); b.type = "button"; b.className = "primary"; card.appendChild(b);
    db.from("profiles").select("*").eq("id", n.other_id).maybeSingle().then(function (pr) {
      var other = pr && pr.data; var name = other ? other.first_name : "";
      p.textContent = t("jn_meet_b", { name: name, title: n.title || "" });
      b.textContent = t("jn_meet_btn", { name: name });
      b.onclick = function () { if (other) openChat(other); };
      b.hidden = !other;
    });
  });
  // Rappels de sortie, en haut de la liste
  try {
    var rs = await jadeReminders();
    rs.reverse().forEach(function (e) {
      var card = document.createElement("article"); card.className = "jcard" + (remindSeen(e.id) ? "" : " new");
      var top = document.createElement("div"); top.className = "jtop"; top.appendChild(jadeLogo());
      var who = document.createElement("b"); who.textContent = t("jbox_title"); top.appendChild(who); card.appendChild(top);
      var h = document.createElement("h3"); h.textContent = t("jn_remind_t"); card.appendChild(h);
      var p = document.createElement("p"); p.textContent = "« " + e.title + " »\n📅 " + evWhen(e) + (e.address ? "\n📍 " + e.address : ""); card.appendChild(p);
      var b = document.createElement("button"); b.type = "button"; b.className = "secondary"; b.textContent = "💬 " + t("ev_chat");
      b.onclick = function () { openEvChat(e); }; card.appendChild(b);
      box.insertBefore(card, box.firstChild);
      remindMark(e.id);
    });
    if (rs.length) $("jbox-empty").hidden = true;
  } catch (x) {}
};
