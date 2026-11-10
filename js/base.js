// Connexion à Supabase, outils communs, affichage des écrans et du profil

// Clé publique : elle est faite pour être visible dans l'appli.
var SUPABASE_URL = "https://yvjmcaknsdpdxilenbku.supabase.co";
var SUPABASE_KEY = "sb_publishable_OZixI26YHQ6zO3nijJpTCA_olbwJl-w";
var db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

var mode = "signup";
var currentUser = null;
var currentProfile = null;
var $ = function (id) { return document.getElementById(id); };

$("app-name").textContent = APP_NAME;

function setRich(el, text) {
  el.textContent = "";
  text.split("**").forEach(function (part, i) {
    if (i % 2) { var s = document.createElement("strong"); s.textContent = part; el.appendChild(s); }
    else el.appendChild(document.createTextNode(part));
  });
}

function fillCountries(sel, firstKey) {
  var keep = sel.value;
  sel.textContent = "";
  var o = document.createElement("option"); o.value = ""; o.textContent = t(firstKey); sel.appendChild(o);
  // L'Europe d'abord (Jade s'adresse à la communauté asiatique de France et d'Europe), puis le reste du monde
  var europe = ["France", "Belgique", "Suisse", "Luxembourg", "Allemagne", "Royaume-Uni", "Pays-Bas", "Italie", "Espagne", "Portugal", "Autriche", "Irlande", "Suède", "Danemark", "Norvège", "Pologne"];
  europe.concat(COUNTRY_KEYS.filter(function (c) { return europe.indexOf(c) === -1; })).forEach(function (c) {
    var x = document.createElement("option"); x.value = c; x.textContent = countryLabel(c); sel.appendChild(x);
  });
  sel.value = keep;
}

function applyI18n() {
  document.documentElement.lang = lang;
  document.title = APP_NAME;
  Array.prototype.forEach.call(document.querySelectorAll("[data-i18n]"), function (el) { el.textContent = t(el.getAttribute("data-i18n")); });
  Array.prototype.forEach.call(document.querySelectorAll("[data-i18n-ph]"), function (el) { el.placeholder = t(el.getAttribute("data-i18n-ph")); });
  Array.prototype.forEach.call(document.querySelectorAll("[data-i18n-aria]"), function (el) { el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria"))); });
  Array.prototype.forEach.call(document.querySelectorAll("[data-i18n-rich]"), function (el) { setRich(el, t(el.getAttribute("data-i18n-rich"))); });
  fillCountries($("country"), "choose");
  fillCountries($("f-country"), "all_countries");
  fillLangFilter();
  fillOriginFilter();
  if ($("origins").childElementCount) buildOrigins();
  $("submit").textContent = mode === "signup" ? t("btn_signup") : t("btn_login");
  $("lang").value = lang;
}

function say(el, text, kind) { el.textContent = text; el.className = "msg " + (kind || ""); }

function setMode(m) {
  mode = m;
  $("tab-signup").setAttribute("aria-selected", m === "signup");
  $("tab-login").setAttribute("aria-selected", m === "login");
  $("signup-only").hidden = m !== "signup";
  // Titre de la fenêtre : « Créer un compte » ou « Se connecter » (les deux sont séparés, sans onglets)
  var ti = $("auth-title"); if (ti) { ti.setAttribute("data-i18n", m === "signup" ? "tab_signup" : "tab_login"); ti.textContent = t(ti.getAttribute("data-i18n")); }
  $("submit").textContent = m === "signup" ? t("btn_signup") : t("btn_login");
  $("password").autocomplete = m === "signup" ? "new-password" : "current-password";
  $("forgot").hidden = m !== "login";
  say($("msg"), "", "");
}

function ageFrom(iso) {
  var b = new Date(iso), n = new Date();
  var a = n.getFullYear() - b.getFullYear();
  var m = n.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < b.getDate())) a--;
  return a;
}
function dateYearsAgo(n) { var d = new Date(); d.setFullYear(d.getFullYear() - n); return d.toISOString().slice(0, 10); }
function nameWithAge(p) { return p.first_name + (p.birthdate ? ", " + ageFrom(p.birthdate) : ""); }

function photoUrl(p) {
  if (!p || !p.photo_path) return null;
  var r = db.storage.from("photos").getPublicUrl(p.photo_path);
  return r.data.publicUrl + "?v=" + encodeURIComponent(p.updated_at || "");
}

function photoPaths(p) {
  if (!p) return [];
  if (p.photos && p.photos.length) return p.photos;
  return p.photo_path ? [p.photo_path] : [];
}
function photoUrls(p) {
  return photoPaths(p).map(function (path) {
    return db.storage.from("photos").getPublicUrl(path).data.publicUrl + "?v=" + encodeURIComponent(p.updated_at || "");
  });
}
function setGallery(img, p) {
  var urls = photoUrls(p), cnt = img.nextElementSibling;
  if (!cnt || !cnt.classList.contains("gcount")) { cnt = document.createElement("div"); cnt.className = "gcount"; img.parentNode.insertBefore(cnt, img.nextSibling); }
  var i = 0;
  function show() {
    img.src = urls[i]; img.hidden = false;
    cnt.textContent = urls.length > 1 ? "● ".repeat(urls.length).split("●").slice(1).map(function (_, k) { return k === i ? "●" : "○"; }).join(" ") : "";
    cnt.hidden = urls.length < 2;
  }
  if (!urls.length) { img.hidden = true; img.removeAttribute("src"); cnt.hidden = true; img.onclick = null; return; }
  show();
  img.style.cursor = urls.length > 1 ? "pointer" : "";
  img.onclick = urls.length > 1 ? function () { i = (i + 1) % urls.length; show(); } : null;
}

var SECTIONS = ["auth", "profile", "feed", "home", "discover", "matches", "likes", "legal", "admin", "settings", "peer", "premium", "concierge", "events", "chat", "report", "verify", "safety"];
function showSection(name) {
  if (name !== "chat") stopChat();
  SECTIONS.forEach(function (id) { $(id).hidden = id !== name; });
  if (name === "home" && currentUser && typeof checkBadges === "function") checkBadges();
}

var LANG_NAMES = { fr: "Français", en: "English", th: "ไทย", vi: "Tiếng Việt", zh: "中文", id: "Bahasa Indonesia", ja: "日本語", ko: "한국어", ms: "Bahasa Melayu", tl: "Filipino", lo: "ລາວ", km: "ខ្មែរ" };
var INTERESTS = ["voyage", "cuisine", "musique", "sport", "cinema", "lecture", "nature", "danse", "photo", "jeux", "animaux", "famille"];
var INT_EMOJI = ["✈️", "🍜", "🎵", "⚽", "🎬", "📚", "🌿", "💃", "📷", "🎮", "🐾", "👨‍👩‍👧"];
function buildInterests() {
  var box = $("interests"); box.textContent = "";
  INTERESTS.forEach(function (k, i) {
    var l = document.createElement("label"), c = document.createElement("input");
    c.type = "checkbox"; c.value = k; l.appendChild(c); l.appendChild(document.createTextNode(INT_EMOJI[i] + " " + t("int_" + k))); box.appendChild(l);
  });
}
function profileScore(p) {
  var n = photoPaths(p).length, s = 0;
  s += Math.min(n, 3) * 10;                       // 30
  if (p.bio && p.bio.length >= 30) s += 15;
  if (p.city) s += 10;
  if (p.intention) s += 10;
  if (p.spoken && p.spoken.length) s += 10;
  if (p.interests && p.interests.length >= 3) s += 10; else if (p.interests && p.interests.length) s += 5;
  if (p.verified) s += 15;
  return Math.min(100, s);
}
function renderComplete(p) {
  var sc = profileScore(p);
  $("complete").hidden = sc >= 100;
  $("complete-t").textContent = t("complete", { n: sc });
  $("complete-bar").style.width = sc + "%";
}

function originLabel(k) { return /^or_/.test(k) ? t(k) : countryLabel(k); }
function buildOrigins() {
  var box = $("origins"), keep = Array.prototype.filter.call(box.querySelectorAll("input"), function (c) { return c.checked; }).map(function (c) { return c.value; });
  box.textContent = "";
  ORIGIN_KEYS.forEach(function (k) {
    var l = document.createElement("label"), c = document.createElement("input");
    c.type = "checkbox"; c.value = k; c.checked = keep.indexOf(k) !== -1; l.appendChild(c); l.appendChild(document.createTextNode(originLabel(k))); box.appendChild(l);
  });
}
function fillOriginFilter() {
  var s = $("f-origin"), keep = s.value; s.textContent = "";
  var o = document.createElement("option"); o.value = ""; o.textContent = t("all_origins"); s.appendChild(o);
  ORIGIN_KEYS.forEach(function (k) { var x = document.createElement("option"); x.value = k; x.textContent = originLabel(k); s.appendChild(x); });
  s.value = keep || "";
}
function buildSpoken() {
  var box = $("spoken"); if (box.childElementCount) return;
  Object.keys(LANG_NAMES).forEach(function (code) {
    var l = document.createElement("label"), c = document.createElement("input");
    c.type = "checkbox"; c.value = code; l.appendChild(c); l.appendChild(document.createTextNode(LANG_NAMES[code])); box.appendChild(l);
  });
}
function fillLangFilter() {
  var s = $("f-lang"), keep = s.value; s.textContent = "";
  var o = document.createElement("option"); o.value = ""; o.textContent = t("any_lang"); s.appendChild(o);
  Object.keys(LANG_NAMES).forEach(function (code) { var x = document.createElement("option"); x.value = code; x.textContent = LANG_NAMES[code]; s.appendChild(x); });
  s.value = keep || "";
}
// En ligne = actif dans l'appli il y a moins de 10 minutes
function isOnlineNow(p) { return !!(p && p.last_seen && (Date.now() - new Date(p.last_seen).getTime()) < 10 * 60000); }
function onlineDot(p) {
  var d = document.createElement("i"); d.className = "cdot"; d.title = t("online"); d.setAttribute("aria-label", t("online"));
  return d;
}

function activityTag(p) {
  if (!p.last_seen || (currentUser && p.id === currentUser.id)) return "";
  var m = (Date.now() - new Date(p.last_seen).getTime()) / 60000;
  return m < 10 ? t("online") : m < 1440 ? t("active_today") : "";
}

function tagsInto(el, p) {
  el.textContent = "";
  var items = [];
  if (p.verified) items.push([t("verified_tag"), true]);
  if (paidPlan(p)) items.push([paidPlan(p) === "diamond" ? "💎 Diamond" : paidPlan(p) === "gold" ? "✦ Gold" : t("premium_tag"), false, "premium"]);
  var act = activityTag(p); if (act) items.push([act, false, "online"]);
  items.push([p.city || "", false]);
  items.push([p.country ? countryLabel(p.country) : "", false]);
  if (p.origins && p.origins.length) items.push(["🌏 " + p.origins.map(originLabel).join(" · "), false]);
  items.push([p.gender ? t("g_" + p.gender) : "", false]);
  items.push([p.looking_for ? t("l_" + p.looking_for) : "", false]);
  items.push([p.intention ? t("i_" + p.intention) : "", false]);
  (p.interests || []).forEach(function (k) { var i = INTERESTS.indexOf(k); if (i !== -1) items.push([INT_EMOJI[i] + " " + t("int_" + k), false]); });
  if (p.spoken && p.spoken.length) items.push(["🗣 " + p.spoken.map(function (c) { return LANG_NAMES[c] || c; }).join(" · "), false]);
  items.forEach(function (it) {
    if (!it[0]) return;
    var s = document.createElement("span"); s.className = "tag" + (it[1] ? " verified" : "") + (it[2] ? " " + it[2] : ""); s.textContent = it[0]; el.appendChild(s);
  });
}

function renderView(user, p) {
  $("view-name").textContent = nameWithAge(p);
  tagsInto($("view-tags"), p);
  $("view-bio").textContent = p.bio || "";
  renderComplete(p);
  applyGating();
  setGallery($("view-photo"), p);
  $("who").textContent = t("connected") + user.email;
  say($("hmsg"), "", "");
  showSection("home");
  checkAdmin();
  startBadges();
}
