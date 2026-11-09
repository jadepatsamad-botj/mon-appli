// Messagerie de l'équipe Jade : bouton « J » à côté de la loupe dans Messages.
// Annonces pour tous (nouvelle activité publiée), messages de l'équipe pour un membre, rappel photo.
// Tables Supabase : jade_notices et jade_notice_reads (fichier sql/messagerie-jade.sql).

SECTIONS.push("jadebox");
TAB_OF.jadebox = "messages";
var jadeUnreadN = 0, jadeOk = true;

function jadeReadKey() { return "jaderead:" + currentUser.id; }

// Date de dernière lecture (Supabase, avec une copie sur l'appareil)
async function jadeReadAt() {
  var local = null; try { local = localStorage.getItem(jadeReadKey()); } catch (e) {}
  try {
    var r = await db.from("jade_notice_reads").select("read_at").eq("user_id", currentUser.id).maybeSingle();
    if (r.data && r.data.read_at && (!local || r.data.read_at > local)) local = r.data.read_at;
  } catch (e) {}
  return local || new Date(Date.now() - 14 * 86400000).toISOString();   // nouveau membre : les annonces des 14 derniers jours
}

function jadeQuery() {
  return db.from("jade_notices").select("*")
    .or("user_id.is.null,user_id.eq." + currentUser.id)
    .gte("created_at", new Date(Date.now() - 90 * 86400000).toISOString())
    .order("created_at", { ascending: false });
}

async function refreshJadeUnread() {
  if (!currentUser || !jadeOk) return;
  try {
    var since = await jadeReadAt();
    var r = await jadeQuery().gt("created_at", since).limit(50);
    if (r.error) { if (/jade_notices/.test(r.error.message || "")) jadeOk = false; jadeUnreadN = 0; }
    else jadeUnreadN = (r.data || []).length;
  } catch (e) { jadeUnreadN = 0; }
  var b = $("nb-jade"); b.textContent = jadeUnreadN > 9 ? "9+" : jadeUnreadN; b.hidden = !(jadeUnreadN > 0);
}

// Les pastilles de l'onglet Messages comptent aussi les messages de l'équipe Jade
var _checkBadgesJade = checkBadges;
checkBadges = async function () { await refreshJadeUnread(); return _checkBadgesJade.apply(this, arguments); };
var _paintBadgeJade = paintBadge;
paintBadge = function (id, key, n) { _paintBadgeJade(id, key, id === "go-matches" ? (n || 0) + jadeUnreadN : n); };

function jadeLogo() { var s = document.createElement("span"); s.className = "jbox-logo"; s.setAttribute("aria-hidden", "true"); s.textContent = "J"; return s; }

async function loadJadeBox() {
  var box = $("jbox-list"); box.textContent = ""; $("jbox-empty").hidden = true;
  var since = await jadeReadAt();
  var r = await jadeQuery().limit(60);
  if (r.error) { $("jbox-empty").hidden = false; return; }
  var list = r.data || [];
  if (!list.length) { $("jbox-empty").hidden = false; }
  // Les activités annoncées (date à l'heure du lieu, annulées ou non)
  var ids = list.filter(function (n) { return n.event_id; }).map(function (n) { return n.event_id; }), evs = {};
  if (ids.length) { try { var e = await db.from("events").select("*").in("id", ids); (e.data || []).forEach(function (x) { evs[x.id] = x; }); } catch (x) {} }
  list.forEach(function (n) {
    var card = document.createElement("article"); card.className = "jcard" + (n.created_at > since ? " new" : "");
    var top = document.createElement("div"); top.className = "jtop";
    top.appendChild(jadeLogo());
    var who = document.createElement("b"); who.textContent = t("jbox_title"); top.appendChild(who);
    var when = document.createElement("span"); when.className = "jwhen"; when.textContent = typeof timeAgo === "function" ? timeAgo(n.created_at) : new Date(n.created_at).toLocaleDateString(); top.appendChild(when);
    card.appendChild(top);
    var h = document.createElement("h3"), p = document.createElement("p");
    if (n.kind === "event") {
      var ev = evs[n.event_id];
      h.textContent = t("jn_event_t") + " : " + (ev ? ev.title : n.title || "");
      if (ev) {
        var where = [ev.city, ev.country ? countryLabel(ev.country) : ""].filter(Boolean).join(", ");
        p.textContent = "📅 " + evWhen(ev) + (where ? "\n📍 " + where : "") + (ev.cancelled ? "\n" + t("jn_cancelled") : "");
      }
    } else if (n.kind === "photo") {
      h.textContent = t("jn_photo_t"); p.textContent = t("jn_photo_b");
    } else {
      h.textContent = n.title || ""; p.textContent = n.body || "";
    }
    if (h.textContent) card.appendChild(h);
    if (p.textContent) card.appendChild(p);
    if (n.kind === "event" && evs[n.event_id] && !evs[n.event_id].cancelled) {
      var b = document.createElement("button"); b.type = "button"; b.className = "secondary"; b.textContent = t("jn_event_btn");
      b.onclick = function () { goTab("events"); }; card.appendChild(b);
    }
    if (n.kind === "photo") {
      var b2 = document.createElement("button"); b2.type = "button"; b2.className = "secondary"; b2.textContent = t("jn_photo_btn");
      b2.onclick = function () { fillForm(currentProfile); showSection("profile"); window.scrollTo(0, 0); }; card.appendChild(b2);
    }
    box.appendChild(card);
  });
  // Tout est lu
  var latest = list.length ? list[0].created_at : new Date().toISOString();
  var readAt = latest > new Date().toISOString() ? latest : new Date().toISOString();
  try { localStorage.setItem(jadeReadKey(), readAt); } catch (e) {}
  try { await db.from("jade_notice_reads").upsert({ user_id: currentUser.id, read_at: readAt }); } catch (e) {}
  jadeUnreadN = 0; $("nb-jade").hidden = true;
  if (typeof checkBadges === "function") checkBadges();
}

$("jbox-btn").onclick = function () { showSection("jadebox"); window.scrollTo(0, 0); loadJadeBox(); };
$("jbox-back").onclick = function () { goTab("messages"); };

// Ouvrir Messages met aussi à jour la pastille du bouton J
var _loadMatchesJade = loadMatches;
loadMatches = function () { refreshJadeUnread(); return _loadMatchesJade.apply(this, arguments); };

// ---------- Administration : écrire de la part de l'équipe Jade ----------
var jnTo = null;   // null = tous les membres
function jnTarget(p) {
  jnTo = p || null;
  $("jn-to-name").textContent = p ? nameWithAge(p) : "tous les membres";
  $("jn-to-all").hidden = !p;
  if (p) { $("jn-admin").scrollIntoView({ block: "center", behavior: "smooth" }); try { $("jn-title").focus({ preventScroll: true }); } catch (e) {} }
}
$("jn-to-all").onclick = function () { jnTarget(null); };
$("jn-send").onclick = async function () {
  var title = $("jn-title").value.trim(), body = $("jn-body").value.trim();
  if (!title && !body) return say($("admsg"), "Écrivez au moins un titre ou un message.", "err");
  var to = jnTo ? jnTo.first_name : "tous les membres";
  if (!confirm("Envoyer ce message de l'équipe Jade à " + to + " ?")) return;
  this.disabled = true;
  var r = await db.from("jade_notices").insert({ user_id: jnTo ? jnTo.id : null, kind: "info", title: title || null, body: body || null });
  this.disabled = false;
  if (r.error) return say($("admsg"), r.error.message, "err");
  $("jn-title").value = ""; $("jn-body").value = "";
  say($("admsg"), "Message envoyé à " + to + " ✓", "ok");
  jnTarget(null); loadJadeSent();
};

// Les derniers messages envoyés (avec Supprimer en cas d'erreur)
async function loadJadeSent() {
  var box = $("jn-sent"); box.textContent = "";
  var r = await db.from("jade_notices").select("*").eq("kind", "info").order("created_at", { ascending: false }).limit(10);
  if (r.error) { box.textContent = /jade_notices/.test(r.error.message || "") ? "Lancez sql/messagerie-jade.sql dans Supabase pour activer la messagerie de l'équipe Jade." : r.error.message; return; }
  (r.data || []).forEach(function (n) {
    var row = arow(null, [(n.title || "(sans titre)") + (n.user_id ? " · à un membre" : " · à tous"), new Date(n.created_at).toLocaleString(), n.body || ""].filter(Boolean), [
      abtn("Supprimer", async function () {
        if (!confirm("Supprimer ce message pour tout le monde ?")) return;
        var d = await db.from("jade_notices").delete().eq("id", n.id); if (d.error) throw d.error; loadJadeSent();
      })
    ]);
    box.appendChild(row);
  });
}
var _goAdminJade = $("go-admin").onclick;
$("go-admin").onclick = function () { _goAdminJade.apply(this, arguments); jnTarget(null); loadJadeSent(); };
