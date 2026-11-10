// Confiance et sécurité (étape 3)
// - invitation à faire vérifier son profil (les profils vérifiés passent en premier dans l'Accueil)
// - alerte quand un message propose de quitter Jade (WhatsApp, Telegram, numéro, e-mail…)
// - conseils de sécurité affichés une fois, avant la première sortie ou la première discussion
// - Administration : « Messages suspects » (fichier SQL : sql/securite.sql)

// ---------- Propositions de continuer ailleurs ----------
var OFFSITE_WORDS = ["whatsapp", "whats app", "telegram", "wechat", "weixin", "微信", "line id", "kakao", "viber", "zalo", "snapchat", "signal app"];
function looksOffsite(text) {
  var s = (text || "").toLowerCase();
  if (OFFSITE_WORDS.some(function (w) { return s.indexOf(w) !== -1; })) return true;
  if (/\+?\d[\d .\-]{7,}\d/.test(s)) return true;                       // numéro de téléphone
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(s)) return true;     // adresse e-mail
  return false;
}

// ---------- Invitation à se faire vérifier ----------
function vnudgeKey() { return "vnudge:" + (currentUser ? currentUser.id : ""); }
function paintVnudge() {
  var hide = !currentProfile || currentProfile.verified;
  try { if (localStorage.getItem(vnudgeKey())) hide = true; } catch (e) {}
  $("vnudge").hidden = hide;
}
$("vnudge-go").onclick = function () { $("go-verify").click(); };
$("vnudge-x").onclick = function () { try { localStorage.setItem(vnudgeKey(), "1"); } catch (e) {} $("vnudge").hidden = true; };
var _loadFeedSec = loadFeed;
loadFeed = function () { paintVnudge(); return _loadFeedSec.apply(this, arguments); };

// ---------- Conseils de sécurité, une seule fois ----------
function safetyOnce(then) {
  var key = "safety_seen:" + (currentUser ? currentUser.id : ""), seen = false;
  try { seen = !!localStorage.getItem(key); } catch (e) {}
  if (seen) return then();
  var m = $("safemodal"); m.hidden = false; document.body.classList.add("modal-open");
  $("safemodal-ok").focus();
  $("safemodal-ok").onclick = function () {
    try { localStorage.setItem(key, "1"); } catch (e) {}
    m.hidden = true; document.body.classList.remove("modal-open");
    then();
  };
}
// Avant la première discussion
var _openChatSec = openChat;
openChat = function (p) { var self = this, args = arguments; safetyOnce(function () { _openChatSec.apply(self, args); }); };
// Avant la première inscription à une sortie : on intercepte le clic sur « Je participe »
document.addEventListener("click", function (e) {
  var b = e.target.closest && e.target.closest("#events-list .evfoot button.primary");
  if (!b || b.dataset.safeOk) return;
  var seen = false; try { seen = !!localStorage.getItem("safety_seen:" + currentUser.id); } catch (x) {}
  if (seen) return;
  e.preventDefault(); e.stopImmediatePropagation();
  safetyOnce(function () { b.dataset.safeOk = "1"; b.click(); });
}, true);

// ---------- Administration : messages suspects ----------
async function loadAdminFlags() {
  var box = $("admin-flags"); box.textContent = "Chargement…";
  var r = await db.rpc("admin_message_flags", { show_reviewed: false });
  box.textContent = "";
  if (r.error) { box.textContent = /admin_message_flags|function/.test(r.error.message || "") ? "Lance sql/securite.sql dans Supabase pour activer cette partie." : r.error.message; return; }
  if (!(r.data || []).length) { box.textContent = "Aucun message suspect à examiner. 👍"; return; }
  r.data.forEach(function (f) {
    var lines = [
      (f.reason === "argent" ? "💰 Argent" : "📱 Propose de continuer ailleurs") + " · de " + (f.from_name || "?") + " à " + (f.to_name || "?") + (f.from_suspended ? " · ⛔ suspendu" : ""),
      "« " + (f.excerpt || "") + " »",
      new Date(f.created_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + " · " + f.total_flags + " alerte(s) au total pour " + (f.from_name || "ce membre")
    ];
    var btns = [
      abtn("Rien de grave", async function () { var x = await db.rpc("admin_review_flags", { sender: f.from_id }); if (x.error) throw x.error; loadAdminFlags(); }),
      abtn("🌐 IP", async function () { if (typeof ipFor === "function") ipFor({ id: f.from_id, first_name: f.from_name || "?" }); }),
      abtn(f.from_suspended ? "Réactiver" : "Suspendre", async function () {
        if (!f.from_suspended && !confirm("Suspendre " + (f.from_name || "ce membre") + " ?")) return;
        var x = await db.rpc("admin_set_suspended", { uid: f.from_id, flag: !f.from_suspended }); if (x.error) throw x.error;
        await db.rpc("admin_review_flags", { sender: f.from_id }); loadAdminFlags();
      })
    ];
    box.appendChild(arow(null, lines, btns));
  });
}
var _goAdminSec = $("go-admin").onclick;
$("go-admin").onclick = function () { _goAdminSec.apply(this, arguments); loadAdminFlags(); };
