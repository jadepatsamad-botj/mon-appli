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
  rows.forEach(function (m, i) {
    var mine = m.from_id === me;
    var w = document.createElement("div"); w.className = "bwrap " + (mine ? "me" : "them");
    var d = document.createElement("div"); d.className = "bubble " + (mine ? "me" : "them"); d.textContent = m.body; w.appendChild(d);
    var vm = /https:\/\/meet\.jit\.si\/Jade-[A-Za-z0-9]{8,32}/.exec(m.body);
    if (vm) {
      var jb = document.createElement("button"); jb.type = "button"; jb.className = "joinbtn"; jb.textContent = "📹 " + t("video_join");
      jb.onclick = (function (u) { return function () { window.open(u, "_blank", "noopener"); }; })(vm[0]);
      w.appendChild(jb);
    }
    var meta = document.createElement("div"); meta.className = "bmeta";
    var tm = m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
    meta.appendChild(document.createTextNode(tm));
    if (!mine && looksRisky(m.body)) {
      var wv = document.createElement("div"); wv.className = "scamwarn"; wv.textContent = t("scam_warn") + " ";
      var rb = document.createElement("button"); rb.type = "button"; rb.className = "trbtn"; rb.textContent = t("report");
      rb.onclick = function () { if (chatWith) openReport(chatWith, "chat"); };
      wv.appendChild(rb); w.appendChild(wv);
    }
    if (!mine) {
      var key = msgKey(m), tr = TR[key + "|" + lang];
      if (tr && tr.text) {
        var tv = document.createElement("div"); tv.className = "btrans"; tv.textContent = tr.text; w.appendChild(tv);
      }
      var a = document.createElement("button"); a.type = "button"; a.className = "trbtn";
      a.textContent = tr && tr.text ? t("original") : tr && tr.loading ? t("translating") : t("translate");
      a.onclick = (function (msg, k) { return function () { toggleTranslate(msg, k); }; })(m, key);
      meta.appendChild(document.createTextNode(" · ")); meta.appendChild(a);
      if (tr && tr.error) meta.appendChild(document.createTextNode(" · " + t("tr_error")));
    } else if (i === lastMine && m.read_at) {
      meta.appendChild(document.createTextNode(" · " + t("seen") + " ✓✓"));
    }
    w.appendChild(meta); box.appendChild(w);
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

function openChat(p) {
  chatWith = p; lastCount = -1;
  $("chat-name").textContent = p.first_name;
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
$("chat-profile").onclick = function () { if (chatWith) { stopChat(); openPeer(chatWith); } };
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
