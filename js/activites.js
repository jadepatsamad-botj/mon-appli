// Activités (sorties réelles)

// ---------- Activités ----------
var LEVEL_NAME = { 1: "Premium", 2: "Gold", 3: "Diamond" };
function evWhen(e) {
  var d = new Date(e.starts_at);
  try { return d.toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "long" }) + " · " + d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" }); }
  catch (x) { return d.toLocaleString(); }
}
async function loadEvents() {
  var box = $("events-list"); box.textContent = ""; $("events-empty").hidden = true; say($("evmsg"), "", "");
  var r = await db.from("events").select("*").eq("cancelled", false).gte("starts_at", new Date().toISOString()).order("starts_at", { ascending: true }).limit(50);
  if (r.error) return say($("evmsg"), r.error.message, "err");
  var evs = r.data || [];
  if (!evs.length) { $("events-empty").textContent = t("events_empty"); $("events-empty").hidden = false; return; }
  var c = await db.rpc("event_counts"), counts = {};
  ((c && c.data) || []).forEach(function (x) { counts[x.event_id] = x.n; });
  var mine = await db.from("event_signups").select("event_id").eq("user_id", currentUser.id), joined = {};
  ((mine && mine.data) || []).forEach(function (x) { joined[x.event_id] = true; });
  var lv = myLevel();
  evs.forEach(function (e) {
    var card = document.createElement("div"); card.className = "evcard";
    var h3 = document.createElement("h3"); h3.textContent = e.title; card.appendChild(h3);
    var meta = document.createElement("div"); meta.className = "evmeta";
    var where = [e.city, e.country ? countryLabel(e.country) : ""].filter(Boolean).join(", ");
    meta.textContent = "📅 " + evWhen(e) + " · ⏱ " + t("ev_hours", { n: String(e.duration_hours).replace(/\.0$/, "") }) + (where ? " · 📍 " + where : "") +
      " · " + (Number(e.price_eur) > 0 ? t("ev_price", { p: money(Number(e.price_eur)) }) : t("ev_free"));
    card.appendChild(meta);
    if (e.description) { var p = document.createElement("p"); p.className = "evdesc"; p.textContent = e.description; card.appendChild(p); }
    var foot = document.createElement("div"); foot.className = "evfoot";
    var left = Math.max(0, e.capacity - (counts[e.id] || 0));
    var pl = document.createElement("span"); pl.className = "evplaces"; pl.textContent = left > 0 ? t("ev_places", { n: left }) : t("ev_full"); foot.appendChild(pl);
    var b = document.createElement("button"); b.type = "button";
    if (joined[e.id]) {
      b.className = "secondary"; b.textContent = t("ev_leave");
      b.onclick = async function () { b.disabled = true; var d = await db.from("event_signups").delete().eq("event_id", e.id).eq("user_id", currentUser.id); if (d.error) say($("evmsg"), d.error.message, "err"); loadEvents(); };
      var ok = document.createElement("span"); ok.className = "tag verified"; ok.textContent = t("ev_joined"); foot.insertBefore(ok, b);
    } else if (lv < e.min_level) {
      b.className = "secondary"; b.textContent = "🔒 " + t("ev_locked", { plan: LEVEL_NAME[e.min_level] }); b.onclick = openPremium;
    } else if (left <= 0) {
      b.className = "secondary"; b.textContent = t("ev_full"); b.disabled = true;
    } else {
      b.className = "primary"; b.textContent = t("ev_join");
      b.onclick = async function () {
        b.disabled = true;
        var ins = await db.from("event_signups").insert({ event_id: e.id, user_id: currentUser.id });
        if (ins.error) {
          var m = ins.error.message || "";
          say($("evmsg"), /EVENT_FULL/.test(m) ? t("ev_err_full") : /EVENT_PAST/.test(m) ? t("ev_past") : m, "err");
        }
        loadEvents();
      };
    }
    foot.appendChild(b); card.appendChild(foot); box.appendChild(card);
  });
}
$("go-events").onclick = function () { showSection("events"); loadEvents(); };
$("events-back").onclick = function () { showSection("home"); };

async function loadAdminEvents() {
  var box = $("admin-events"); box.textContent = "";
  if (!$("ev-country").childElementCount) fillCountries($("ev-country"), "choose");
  var r = await db.from("events").select("*").gte("starts_at", new Date(Date.now() - 7 * 86400000).toISOString()).order("starts_at", { ascending: true }).limit(50);
  if (r.error) { box.textContent = r.error.message; return; }
  var c = await db.rpc("event_counts"), counts = {};
  ((c && c.data) || []).forEach(function (x) { counts[x.event_id] = x.n; });
  (r.data || []).forEach(function (e) {
    var lines = [e.title + (e.cancelled ? " (annulée)" : ""), evWhen(e) + " · " + [e.city, e.country].filter(Boolean).join(", "),
      (counts[e.id] || 0) + " / " + e.capacity + " inscrits" + (e.min_level ? " · réservée " + LEVEL_NAME[e.min_level] : "")];
    var out = document.createElement("div");
    var btns = [
      abtn("Voir les inscrits", async function () {
        var p = await db.rpc("admin_event_participants", { eid: e.id }); if (p.error) throw p.error;
        out.textContent = (p.data || []).map(function (x) { return x.first_name + (x.country ? " (" + countryLabel(x.country) + ")" : "") + (x.gender ? " · " + t("g_" + x.gender) : ""); }).join(" · ") || "Aucun inscrit.";
      }),
      abtn(e.cancelled ? "Rétablir" : "Annuler", async function () {
        if (!e.cancelled && !confirm("Annuler cette activité ?")) return;
        var u = await db.from("events").update({ cancelled: !e.cancelled }).eq("id", e.id); if (u.error) throw u.error; loadAdminEvents();
      }),
      abtn("Supprimer", async function () {
        if (!confirm("Supprimer définitivement cette activité et ses inscriptions ?")) return;
        var d = await db.from("events").delete().eq("id", e.id); if (d.error) throw d.error; loadAdminEvents();
      })
    ];
    var row = arow(null, lines, btns); row.querySelector(".ainfo").appendChild(out); box.appendChild(row);
  });
}
$("ev-create").onclick = async function () {
  var title = $("ev-title").value.trim(), start = $("ev-start").value;
  if (title.length < 3 || !start) return say($("admsg"), "Indique au moins un titre et une date.", "err");
  var row = {
    title: title, description: $("ev-desc").value.trim() || null, city: $("ev-city").value.trim() || null,
    country: $("ev-country").value || null, starts_at: new Date(start).toISOString(),
    duration_hours: parseFloat($("ev-dur").value) || 2, capacity: parseInt($("ev-cap").value, 10) || 10,
    price_eur: parseFloat($("ev-price").value) || 0, min_level: parseInt($("ev-level").value, 10) || 0
  };
  $("ev-create").disabled = true;
  var r = await db.from("events").insert(row);
  $("ev-create").disabled = false;
  if (r.error) return say($("admsg"), r.error.message, "err");
  ["ev-title", "ev-desc", "ev-city", "ev-start"].forEach(function (id) { $(id).value = ""; });
  say($("admsg"), "Activité publiée ✓", "ok"); loadAdminEvents();
};
