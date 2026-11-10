// Activités (sorties réelles)

// ---------- Activités ----------
var LEVEL_NAME = { 1: "Premium", 2: "Gold", 3: "Diamond" };
// Date et heure d'une activité : à l'heure du lieu quand le fuseau est connu (colonne tz)
function evWhen(e) {
  var d = new Date(e.starts_at), o = e.tz ? { timeZone: e.tz } : {};
  try {
    return d.toLocaleDateString(lang, Object.assign({ weekday: "long", day: "numeric", month: "long" }, o)) + " · " +
      d.toLocaleTimeString(lang, Object.assign({ hour: "2-digit", minute: "2-digit" }, o)) + (e.tz ? " (" + t("ev_local_time") + ")" : "");
  } catch (x) { return d.toLocaleString(); }
}

// Fuseaux horaires proposés pour le lieu d'une activité
var EV_TZ = [
  ["Asia/Bangkok", "Thaïlande (Bangkok)"], ["Asia/Ho_Chi_Minh", "Vietnam (Hô Chi Minh-Ville, Hanoï)"],
  ["Asia/Jakarta", "Indonésie (Jakarta)"], ["Asia/Makassar", "Indonésie (Bali)"], ["Asia/Manila", "Philippines (Manille)"],
  ["Asia/Phnom_Penh", "Cambodge (Phnom Penh)"], ["Asia/Vientiane", "Laos (Vientiane)"], ["Asia/Kuala_Lumpur", "Malaisie (Kuala Lumpur)"],
  ["Asia/Singapore", "Singapour"], ["Asia/Shanghai", "Chine (Pékin, Shanghai)"], ["Asia/Taipei", "Taïwan (Taipei)"],
  ["Asia/Hong_Kong", "Hong Kong"], ["Asia/Tokyo", "Japon (Tokyo)"], ["Asia/Seoul", "Corée du Sud (Séoul)"],
  ["America/New_York", "États-Unis (New York, Miami)"], ["America/Chicago", "États-Unis (Chicago, Houston)"],
  ["America/Denver", "États-Unis (Denver)"], ["America/Phoenix", "États-Unis (Phoenix)"],
  ["America/Los_Angeles", "États-Unis (Los Angeles, Las Vegas)"], ["Pacific/Honolulu", "États-Unis (Hawaï)"],
  ["America/Toronto", "Canada (Toronto, Montréal)"], ["America/Vancouver", "Canada (Vancouver)"],
  ["Europe/Paris", "France (Paris)"], ["Europe/Brussels", "Belgique (Bruxelles)"], ["Europe/Zurich", "Suisse (Zurich, Genève)"],
  ["Europe/Berlin", "Allemagne (Berlin)"], ["Europe/London", "Royaume-Uni (Londres)"], ["Europe/Amsterdam", "Pays-Bas (Amsterdam)"],
  ["Europe/Rome", "Italie (Rome)"], ["Europe/Madrid", "Espagne (Madrid)"], ["Europe/Lisbon", "Portugal (Lisbonne)"],
  ["Australia/Sydney", "Australie (Sydney, Melbourne)"], ["Australia/Perth", "Australie (Perth)"]
];
var EV_TZ_OF_COUNTRY = { "Thaïlande": "Asia/Bangkok", "Vietnam": "Asia/Ho_Chi_Minh", "Indonésie": "Asia/Jakarta", "Philippines": "Asia/Manila",
  "Cambodge": "Asia/Phnom_Penh", "Laos": "Asia/Vientiane", "Malaisie": "Asia/Kuala_Lumpur", "Singapour": "Asia/Singapore", "Chine": "Asia/Shanghai",
  "Taïwan": "Asia/Taipei", "Hong Kong": "Asia/Hong_Kong", "Japon": "Asia/Tokyo", "Corée du Sud": "Asia/Seoul", "États-Unis": "America/New_York",
  "Canada": "America/Toronto", "France": "Europe/Paris", "Belgique": "Europe/Brussels", "Suisse": "Europe/Zurich", "Allemagne": "Europe/Berlin",
  "Royaume-Uni": "Europe/London", "Pays-Bas": "Europe/Amsterdam", "Italie": "Europe/Rome", "Espagne": "Europe/Madrid", "Portugal": "Europe/Lisbon",
  "Australie": "Australia/Sydney" };

// Décalage (en minutes) d'un fuseau à un instant donné
function tzOffsetMin(ms, tz) {
  var parts = {};
  new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(new Date(ms)).forEach(function (p) { parts[p.type] = p.value; });
  var asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second);
  return Math.round((asUtc - ms) / 60000);
}
// « 2026-12-05 » + « 19:00 » à l'heure du lieu → instant exact
function zonedToDate(dateStr, timeStr, tz) {
  var d = dateStr.split("-").map(Number), h = (timeStr || "00:00").split(":").map(Number);
  var guess = Date.UTC(d[0], d[1] - 1, d[2], h[0], h[1] || 0);
  var ms = guess - tzOffsetMin(guess, tz) * 60000;
  ms = guess - tzOffsetMin(ms, tz) * 60000;   // ajustement heure d'été / d'hiver
  return new Date(ms);
}
function fillEvTz() {
  var sel = $("ev-tz"); if (sel.childElementCount) return;
  EV_TZ.forEach(function (z) {
    var o = document.createElement("option"); o.value = z[0];
    var off = 0; try { off = tzOffsetMin(Date.now(), z[0]); } catch (x) {}
    var hh = Math.floor(Math.abs(off) / 60), mm = Math.abs(off) % 60;
    o.textContent = z[1] + " · UTC" + (off < 0 ? "−" : "+") + hh + (mm ? ":" + String(mm).padStart(2, "0") : "");
    sel.appendChild(o);
  });
  sel.value = "Asia/Bangkok";
}
// Le pays choisi propose son fuseau ; un aperçu rappelle l'heure correspondante en France
function evCheck() {
  var dt = $("ev-date").value, tm = $("ev-time").value, tz = $("ev-tz").value;
  if (!dt || !tm || !tz) { $("ev-check").textContent = ""; return; }
  try {
    var d = zonedToDate(dt, tm, tz);
    $("ev-check").textContent = "Soit le " + d.toLocaleString("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) + " à l'heure de Paris.";
  } catch (x) { $("ev-check").textContent = ""; }
}
$("ev-country").addEventListener("change", function () { var z = EV_TZ_OF_COUNTRY[this.value]; if (z) { $("ev-tz").value = z; evCheck(); } });
["ev-date", "ev-time", "ev-tz"].forEach(function (id) { $(id).addEventListener("input", evCheck); $(id).addEventListener("change", evCheck); });
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
    if (e.photo_url) { var ph = document.createElement("img"); ph.className = "evphoto"; ph.src = e.photo_url; ph.alt = ""; ph.loading = "lazy"; card.appendChild(ph); }
    var h3 = document.createElement("h3"); h3.textContent = e.title; card.appendChild(h3);
    var meta = document.createElement("div"); meta.className = "evmeta";
    var where = [e.city, e.country ? countryLabel(e.country) : ""].filter(Boolean).join(", ");
    meta.textContent = "📅 " + evWhen(e) + " · ⏱ " + t("ev_hours", { n: String(e.duration_hours).replace(/\.0$/, "") }) + (where ? " · 📍 " + where : "") +
      " · " + (Number(e.price_eur) > 0 ? t("ev_price", { p: money(Number(e.price_eur)) }) : t("ev_free"));
    card.appendChild(meta);
    if (e.address) card.appendChild(evMapLine(e));
    if (e.description) { var p = document.createElement("p"); p.className = "evdesc"; p.textContent = e.description; card.appendChild(p); }
    var foot = document.createElement("div"); foot.className = "evfoot";
    var left = Math.max(0, e.capacity - (counts[e.id] || 0));
    var pl = document.createElement("span"); pl.className = "evplaces"; pl.textContent = left > 0 ? t("ev_places", { n: left }) : t("ev_full"); foot.appendChild(pl);
    var b = document.createElement("button"); b.type = "button";
    if (joined[e.id]) {
      b.className = "secondary"; b.textContent = t("ev_leave");
      b.onclick = async function () { b.disabled = true; var d = await db.from("event_signups").delete().eq("event_id", e.id).eq("user_id", currentUser.id); if (d.error) say($("evmsg"), d.error.message, "err"); loadEvents(); };
      var ok = document.createElement("span"); ok.className = "tag verified"; ok.textContent = t("ev_joined"); foot.appendChild(ok);
      // Participant : on voit qui vient, et la discussion du groupe
      var extra = document.createElement("div"); extra.className = "evjoined";
      var people = document.createElement("div"); people.className = "evpeople"; extra.appendChild(people);
      var chat = document.createElement("button"); chat.type = "button"; chat.className = "secondary evchat-btn"; chat.textContent = "💬 " + t("ev_chat");
      chat.onclick = function () { openEvChat(e); };
      extra.appendChild(chat);
      card.appendChild(extra);
      fillEvPeople(e.id, people);
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
  fillEvTz();
  var r = await db.from("events").select("*").gte("starts_at", new Date(Date.now() - 7 * 86400000).toISOString()).order("starts_at", { ascending: true }).limit(50);
  if (r.error) { box.textContent = r.error.message; return; }
  var c = await db.rpc("event_counts"), counts = {};
  ((c && c.data) || []).forEach(function (x) { counts[x.event_id] = x.n; });
  (r.data || []).forEach(function (e) {
    var lines = [e.title + (e.cancelled ? " (annulée)" : ""), evWhen(e) + " · " + [e.city, e.country].filter(Boolean).join(", "),
      (counts[e.id] || 0) + " / " + e.capacity + " inscrits" + (e.min_level ? " · réservée " + LEVEL_NAME[e.min_level] : "")];
    var out = document.createElement("div");
    var btns = [
      abtn("Voir les inscrits", async function () { await adminPeople(e, out); }),
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
  var title = $("ev-title").value.trim(), day = $("ev-date").value, hour = $("ev-time").value, tz = $("ev-tz").value;
  if (title.length < 3 || !day || !hour) return say($("admsg"), "Indique au moins un titre, une date et une heure.", "err");
  var start = zonedToDate(day, hour, tz);
  if (start.getTime() < Date.now()) return say($("admsg"), "Cette date est déjà passée à l'heure du lieu.", "err");
  // Photo de l'activité (facultative), déposée dans l'espace public « event-photos »
  var photoUrl = null, pf = $("ev-photo").files[0];
  if (pf) {
    try {
      var small = await compressImage(pf, 1600);
      var ppath = Date.now() + "-" + Math.random().toString(36).slice(2, 8) + ".jpg";
      var upl = await db.storage.from("event-photos").upload(ppath, small, { contentType: small.type || "image/jpeg" });
      if (upl.error) return say($("admsg"), "Photo : " + upl.error.message + " (lance sql/activites-plus.sql)", "err");
      photoUrl = db.storage.from("event-photos").getPublicUrl(ppath).data.publicUrl;
    } catch (x) { return say($("admsg"), "Photo : " + (x.message || x), "err"); }
  }
  var row = {
    address: $("ev-address").value.trim() || null, photo_url: photoUrl,
    title: title, description: $("ev-desc").value.trim() || null, city: $("ev-city").value.trim() || null,
    country: $("ev-country").value || null, starts_at: start.toISOString(), tz: tz,
    duration_hours: parseFloat($("ev-dur").value) || 2, capacity: parseInt($("ev-cap").value, 10) || 10,
    price_eur: parseFloat($("ev-price").value) || 0, min_level: parseInt($("ev-level").value, 10) || 0
  };
  $("ev-create").disabled = true;
  var r = await db.from("events").insert(row), noTz = false;
  if (r.error && /address|photo_url/.test(r.error.message || "")) { delete row.address; delete row.photo_url; r = await db.from("events").insert(row); }   // colonnes pas encore créées
  if (r.error && /tz/.test(r.error.message || "")) { delete row.tz; noTz = true; r = await db.from("events").insert(row); }   // colonne tz pas encore créée
  $("ev-create").disabled = false;
  if (r.error) return say($("admsg"), r.error.message, "err");
  ["ev-title", "ev-desc", "ev-city", "ev-date", "ev-address", "ev-photo"].forEach(function (id) { $(id).value = ""; });
  $("ev-check").textContent = "";
  say($("admsg"), noTz ? "Activité publiée ✓ (lance sql/activites-heure-locale.sql dans Supabase pour afficher l'heure du lieu)" : "Activité publiée ✓", "ok"); loadAdminEvents();
};

// Inscrits d'une activité pour l'admin : une fois la sortie commencée, on coche qui était présent·e
// (le badge « sorties Jade » du membre est recalculé)
async function adminPeople(e, out) {
  var p = await db.rpc("admin_event_people", { eid: e.id });
  if (p.error) p = await db.rpc("admin_event_participants", { eid: e.id });   // SQL de l'étape 2 pas encore lancé
  if (p.error) throw p.error;
  out.textContent = "";
  if (!(p.data || []).length) { out.textContent = "Aucun inscrit."; return; }
  var started = new Date(e.starts_at).getTime() < Date.now();
  (p.data || []).forEach(function (x) {
    var line = document.createElement("label"); line.className = "evpeople-row";
    var txt = x.first_name + (x.country ? " (" + countryLabel(x.country) + ")" : "") + (x.gender ? " · " + t("g_" + x.gender) : "");
    if (started && "attended" in x) {
      var c = document.createElement("input"); c.type = "checkbox"; c.checked = !!x.attended;
      c.onchange = async function () {
        c.disabled = true;
        var r = await db.rpc("admin_set_attended", { eid: e.id, uid: x.user_id, flag: c.checked });
        c.disabled = false;
        if (r.error) { c.checked = !c.checked; say($("admsg"), r.error.message, "err"); }
      };
      line.appendChild(c); line.appendChild(document.createTextNode(" " + txt + " · présent·e"));
    } else line.textContent = txt;
    out.appendChild(line);
  });
}
