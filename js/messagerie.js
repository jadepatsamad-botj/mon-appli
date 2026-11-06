// Messagerie, traduction des messages, fiche d'un profil

// ---------- Messagerie ----------
var chatWith = null, chatTimer = null, lastCount = -1;

function stopChat() { if (chatTimer) { clearInterval(chatTimer); chatTimer = null; } }

async function refreshChat() {
  if (!chatWith || !currentUser) return;
  var me = currentUser.id, other = chatWith.id;
  var r = await db.from("messages").select("*")
    .or("and(from_id.eq." + me + ",to_id.eq." + other + "),and(from_id.eq." + other + ",to_id.eq." + me + ")")
    .order("created_at", { ascending: true }).limit(200);
  if (r.error) return say($("cmsg"), r.error.message, "err");
  var box = $("chat-box");
  var stick = box.scrollTop + box.clientHeight >= box.scrollHeight - 40;
  box.textContent = "";
  var rows = r.data || [], lastMine = -1;
  rows.forEach(function (m, i) { if (m.from_id === me) lastMine = i; });
  var peerPic = photoUrl(chatWith);
  rows.forEach(function (m, i) {
    var mine = m.from_id === me, next = rows[i + 1];
    // Fin d'un groupe : l'autre personne répond, ou plus d'une heure passe → on affiche la date
    var groupEnd = !next || next.from_id !== m.from_id || (new Date(next.created_at) - new Date(m.created_at)) > 3600000;
    var line = document.createElement("div"); line.className = "bline " + (mine ? "me" : "them");
    if (!mine) line.appendChild(miniAvatar(chatWith, peerPic));
    var w = document.createElement("div"); w.className = "bwrap " + (mine ? "me" : "them");
    var vm = /https:\/\/meet\.jit\.si\/Jade-[A-Za-z0-9]{8,32}/.exec(m.body);
    var d;
    if (m.image_path) {
      d = document.createElement("button"); d.type = "button"; d.className = "bphoto " + (mine ? "me" : "them");
      d.setAttribute("aria-label", t("photo_open"));
      var im = document.createElement("img"); im.alt = ""; d.appendChild(im);
      chatImage(m.image_path, im);
      d.onclick = (function (img) { return function () { if (img.src) openLightbox(img.src); }; })(im);
      w.appendChild(d);
      if (m.body && m.body !== PHOTO_BODY) { var cap = document.createElement("div"); cap.className = "bubble " + (mine ? "me" : "them"); cap.textContent = m.body; w.appendChild(cap); }
    } else {
      d = document.createElement("div"); d.className = "bubble " + (mine ? "me" : "them") + (vm ? " sys" : ""); d.textContent = m.body; w.appendChild(d);
    }
    if (vm) {
      var jb = document.createElement("button"); jb.type = "button"; jb.className = "joinbtn"; jb.textContent = "📹 " + t("video_join");
      jb.onclick = (function (u) { return function () { window.open(u, "_blank", "noopener"); }; })(vm[0]);
      w.appendChild(jb);
    }
    if (!mine && looksRisky(m.body)) {
      var wv = document.createElement("div"); wv.className = "scamwarn"; wv.textContent = t("scam_warn") + " ";
      var rb = document.createElement("button"); rb.type = "button"; rb.className = "trbtn"; rb.textContent = t("report");
      rb.onclick = function () { if (chatWith) openReport(chatWith, "chat"); };
      wv.appendChild(rb); w.appendChild(wv);
    }
    var meta = document.createElement("div"); meta.className = "bmeta";
    var bits = [];
    if (!mine && m.image_path) {
      if (groupEnd && m.created_at) bits.push(document.createTextNode(timeAgo(m.created_at)));
    } else if (!mine) {
      var key = msgKey(m), tr = TR[key + "|" + lang];
      if (tr && tr.text) {
        var tv = document.createElement("div"); tv.className = "btrans"; tv.textContent = tr.text; w.appendChild(tv);
      }
      var a = document.createElement("button"); a.type = "button"; a.className = "trbtn";
      a.textContent = tr && tr.text ? t("original") : tr && tr.loading ? t("translating") : t("translate");
      a.onclick = (function (msg, k) { return function () { toggleTranslate(msg, k); }; })(m, key);
      if (groupEnd && m.created_at) bits.push(document.createTextNode(timeAgo(m.created_at)));
      bits.push(a);
      if (tr && tr.error) bits.push(document.createTextNode(t("tr_error")));
    } else {
      if (groupEnd && m.created_at) bits.push(document.createTextNode(timeAgo(m.created_at)));
      if (i === lastMine && m.read_at) bits.push(document.createTextNode(t("seen") + " ✓✓"));
    }
    bits.forEach(function (x, j) { if (j) meta.appendChild(document.createTextNode(" · ")); meta.appendChild(x); });
    if (bits.length) w.appendChild(meta);
    line.appendChild(w);
    if (groupEnd) line.classList.add("gend");
    box.appendChild(line);
  });
  $("ice").hidden = rows.length > 0;
  if (rows.some(function (m) { return m.from_id === other && !m.read_at; })) {
    db.rpc("mark_messages_read", { peer: other }).then(function () {}, function () {});
  }
  if (stick || lastCount !== (r.data || []).length) box.scrollTop = box.scrollHeight;
  lastCount = (r.data || []).length;
  markRead(other);
}

var SCAM_WORDS = ["argent", "money", "western union", "moneygram", "bitcoin", "btc", "crypto", "usdt", "binance", "gift card", "carte cadeau", "itunes", "google play card", "virement", "transfer", "wire", "bank account", "compte bancaire", "iban", "paypal", "investment", "invest", "investir", "trading", "forex", "loan", "hospital", "hôpital", "visa fee", "plane ticket", "billet d'avion", "customs", "douane", "เงิน", "โอน", "ลงทุน", "คริปโต", "บัญชีธนาคาร", "tiền", "chuyển khoản", "đầu tư", "tài khoản ngân hàng", "钱", "汇款", "转账", "投资", "比特币", "银行卡", "uang", "investasi", "rekening", "pinjaman", "お金", "送金", "振込", "投資", "仮想通貨", "돈", "송금", "입금", "투자", "코인", "wang", "pelaburan", "akaun bank", "pinjaman", "pera", "padala", "utang", "ເງິນ", "ໂອນ", "ລົງທຶນ", "លុយ", "ផ្ទេរប្រាក់", "វិនិយោគ"];
function looksRisky(text) {
  var s = (text || "").toLowerCase();
  return SCAM_WORDS.some(function (w) {
    if (/^[a-z' ]+$/.test(w)) return new RegExp("(^|[^a-z])" + w.replace(/ /g, "\\s+") + "([^a-z]|$)").test(s);
    return s.indexOf(w) !== -1;
  });
}

// ---------- Traduction dans la discussion ----------
var TR = {};   // cache : message + langue -> { text, loading, error }
function msgKey(m) { return m.id ? String(m.id) : (m.created_at + "|" + m.body.slice(0, 40)); }
var TR_LANG = { zh: "zh-CN", tl: "tl", fr: "fr", en: "en", th: "th", vi: "vi", id: "id", ja: "ja", ko: "ko", ms: "ms", lo: "lo", km: "km" };
async function toggleTranslate(m, key) {
  var k = key + "|" + lang, cur = TR[k];
  if (cur && cur.text) { delete TR[k]; return refreshChat(); }
  if (cur && cur.loading) return;
  TR[k] = { loading: true }; refreshChat();
  try {
    var url = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(m.body.slice(0, 480)) +
      "&langpair=" + encodeURIComponent("Autodetect|" + (TR_LANG[lang] || lang));
    var res = await fetch(url);
    var j = await res.json();
    var out = j && j.responseData && j.responseData.translatedText;
    if (!out || (j.responseStatus && Number(j.responseStatus) !== 200) || /^(PLEASE SELECT|MYMEMORY WARNING|INVALID)/i.test(out)) throw new Error("tr");
    var tmp = document.createElement("textarea"); tmp.innerHTML = out;   // décode les entités HTML éventuelles
    TR[k] = { text: tmp.value };
  } catch (e) { TR[k] = { error: true }; }
  refreshChat();
}

// ---------- Photos dans la discussion ----------
var PHOTO_BODY = "📷";            // texte enregistré avec une photo (aperçu dans la liste des messages)
var CHAT_BUCKET = "chat-photos";  // espace de stockage privé (voir sql/photos-discussion.sql)
var CHAT_URLS = {};               // liens temporaires déjà obtenus, pour ne pas recharger les images

// Les photos sont privées : on demande un lien valable 1 heure
function chatImage(path, img) {
  var c = CHAT_URLS[path];
  if (c && c.until > Date.now()) { img.src = c.url; return; }
  db.storage.from(CHAT_BUCKET).createSignedUrl(path, 3600).then(function (r) {
    if (r && r.data && r.data.signedUrl) {
      CHAT_URLS[path] = { url: r.data.signedUrl, until: Date.now() + 3000000 };
      img.src = r.data.signedUrl;
    } else img.parentNode && img.parentNode.classList.add("missing");
  }, function () {});
}

function openLightbox(src) { $("lightbox-img").src = src; $("lightbox").hidden = false; }
function closeLightbox() { $("lightbox").hidden = true; $("lightbox-img").removeAttribute("src"); }
$("lightbox-close").onclick = closeLightbox;
$("lightbox").onclick = function (e) { if (e.target === $("lightbox")) closeLightbox(); };
document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("lightbox").hidden) closeLightbox(); });

$("chat-photo").onclick = function () { $("chat-file").click(); };
$("chat-file").onchange = async function () {
  var file = $("chat-file").files && $("chat-file").files[0];
  $("chat-file").value = "";
  if (!file || !chatWith) return;
  var cm = $("cmsg"), other = chatWith;
  if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) return say(cm, t("photo_err"), "err");
  $("chat-photo").disabled = true; say(cm, t("photo_sending"), "");
  try {
    var f = await compressImage(file, 1600);
    if (f.size > 5 * 1024 * 1024) throw new Error(t("photo_big"));
    var a = new Uint8Array(9); crypto.getRandomValues(a);
    var name = Array.prototype.map.call(a, function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
    var path = currentUser.id + "/" + other.id + "/" + Date.now() + "-" + name + ".jpg";
    var up = await db.storage.from(CHAT_BUCKET).upload(path, f, { contentType: f.type || "image/jpeg", upsert: false });
    if (up.error) throw up.error;
    var r = await db.from("messages").insert({ from_id: currentUser.id, to_id: other.id, body: PHOTO_BODY, image_path: path });
    if (r.error) { db.storage.from(CHAT_BUCKET).remove([path]).then(function () {}, function () {}); throw r.error; }
    say(cm, "", ""); notify(other.id, "message");
    lastCount = -1; await refreshChat();
  } catch (e) {
    var em = (e && e.message) || "";
    say(cm, /bucket|image_path|not found|schema cache/i.test(em) ? t("photo_off") : (em || t("photo_err")), "err");
  }
  $("chat-photo").disabled = false;
};

// Petite photo ronde à côté des messages reçus
function miniAvatar(p, url) {
  var av = document.createElement("span"); av.className = "bav";
  if (url) { var im = document.createElement("img"); im.src = url; im.alt = ""; av.appendChild(im); }
  else av.textContent = (p.first_name || "?").charAt(0).toUpperCase();
  return av;
}

// « il y a 3 jours », « 14:32 » aujourd'hui… dans la langue choisie
function timeAgo(iso) {
  var d = new Date(iso), s = (Date.now() - d.getTime()) / 1000;
  if (new Date().toDateString() === d.toDateString()) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  var units = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400]];
  try {
    var rtf = new Intl.RelativeTimeFormat(lang === "tl" ? "fil" : lang, { numeric: "auto" });
    for (var i = 0; i < units.length; i++) if (s >= units[i][1]) return rtf.format(-Math.floor(s / units[i][1]), units[i][0]);
    return rtf.format(-1, "day");
  } catch (e) { return d.toLocaleDateString(); }
}

// En-tête : photo, point vert si en ligne, prénom, ✓, âge · ville
function fillChatHead(p) {
  $("chat-name").textContent = p.first_name;
  $("chat-verified").hidden = !p.verified;
  $("chat-dot").hidden = !(p.last_seen && (Date.now() - new Date(p.last_seen).getTime()) < 15 * 60000);
  $("chat-sub").textContent = [p.birthdate ? ageFrom(p.birthdate) : "", p.city || (p.country ? countryLabel(p.country) : "")].filter(Boolean).join(" · ");
  var url = photoUrl(p);
  $("chat-avatar").hidden = !url; if (url) $("chat-avatar").src = url;
  $("chat-initial").textContent = url ? "" : (p.first_name || "?").charAt(0).toUpperCase();
  $("chat-peek-body").hidden = true; $("chat-peek").setAttribute("aria-expanded", "false");
  $("chat-menu").hidden = true; $("chat-more").setAttribute("aria-expanded", "false");
}

// Aperçu rapide du profil (sous l'en-tête)
function fillPeek(p) {
  var box = $("chat-peek-photos"); box.textContent = "";
  photoUrls(p).forEach(function (u) { var im = document.createElement("img"); im.src = u; im.alt = ""; im.loading = "lazy"; box.appendChild(im); });
  box.hidden = !box.children.length;
  tagsInto($("chat-peek-tags"), p);
  $("chat-peek-bio").textContent = p.bio || "";
}

function openChat(p) {
  chatWith = p; lastCount = -1;
  fillChatHead(p);
  $("chat-box").textContent = ""; $("chat-input").value = ""; $("ice").hidden = true;
  say($("cmsg"), "", "");
  showSection("chat");
  markRead(p.id);
  refreshChat();
  stopChat();
  chatTimer = setInterval(refreshChat, rtOk ? 15000 : 4000);
}

Array.prototype.forEach.call(document.querySelectorAll("#ice .chip"), function (b) {
  b.onclick = function () { $("chat-input").value = b.textContent; $("chat-input").focus(); };
});

var peerReturn = "chat";
function openPeer(p) {
  $("peer-name").textContent = nameWithAge(p);
  tagsInto($("peer-tags"), p);
  $("peer-bio").textContent = p.bio || "";
  setGallery($("peer-photo"), p);
  showSection("peer");
}
$("chat-profile").onclick = function () { if (chatWith) { $("chat-menu").hidden = true; stopChat(); openPeer(chatWith); } };
$("chat-who").onclick = function () { if (chatWith) { stopChat(); openPeer(chatWith); } };
$("chat-peek-full").onclick = $("chat-who").onclick;
$("chat-peek").onclick = function () {
  var open = $("chat-peek-body").hidden;
  if (open && chatWith) fillPeek(chatWith);
  $("chat-peek-body").hidden = !open;
  $("chat-peek").setAttribute("aria-expanded", String(open));
};
$("chat-more").onclick = function (e) {
  e.stopPropagation();
  var open = $("chat-menu").hidden;
  $("chat-menu").hidden = !open;
  $("chat-more").setAttribute("aria-expanded", String(open));
};
document.addEventListener("click", function (e) {
  if (!$("chat-menu").hidden && !$("chat-menu").contains(e.target)) { $("chat-menu").hidden = true; $("chat-more").setAttribute("aria-expanded", "false"); }
});
$("peer-back").onclick = function () { if (chatWith) openChat(chatWith); else showSection("home"); };

$("chat-video").onclick = async function () {
  if (!chatWith || !confirm(t("video_confirm"))) return;
  var a = new Uint8Array(12); (window.crypto || window.msCrypto).getRandomValues(a);
  var room = "Jade-" + Array.prototype.map.call(a, function (x) { return "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"[x % 56]; }).join("");
  var r = await db.from("messages").insert({ from_id: currentUser.id, to_id: chatWith.id, body: t("video_invite") + " https://meet.jit.si/" + room });
  if (r.error) return say($("cmsg"), t("e_send") + r.error.message, "err");
  notify(chatWith.id, "message");
  refreshChat();
  window.open("https://meet.jit.si/" + room, "_blank", "noopener");
};

$("chat-form").addEventListener("submit", async function (e) {
  e.preventDefault();
  var text = $("chat-input").value.trim();
  if (!text || !chatWith) return;
  $("chat-send").disabled = true;
  var r = await db.from("messages").insert({ from_id: currentUser.id, to_id: chatWith.id, body: text });
  if (r.error) say($("cmsg"), t("e_send") + r.error.message, "err");
  else { $("chat-input").value = ""; say($("cmsg"), "", ""); notify(chatWith.id, "message"); await refreshChat(); }
  $("chat-send").disabled = false;
});
$("chat-back").onclick = function () { showSection("matches"); loadMatches(); };
