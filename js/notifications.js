// Service worker et notifications

// ---------- Chargement plus rapide (service worker) ----------
if ("serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
}

// ---------- Notifications ----------
var VAPID_PUBLIC = "BK-DELSdSbhb1II18DzsW3uqZffj8VzKInZyEUiwo257LU1SUUopGdNsvWwGyNZXdRObKNPZzeU4AbkioredGt4";
function b64ToU8(s) {
  var p = "=".repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, "+").replace(/_/g, "/"));
  var a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a;
}
function notify(to, kind) {
  try { if (db.functions && to) db.functions.invoke("notify", { body: { to: to, kind: kind } }).catch(function () {}); } catch (e) {}
}
$("notif-btn").onclick = async function () {
  var m = $("nmsg");
  var ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var standalone = window.navigator.standalone || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return say(m, ios && !standalone ? t("notif_ios") : t("notif_unsupported"), "err");
  }
  try {
    var perm = await Notification.requestPermission();
    if (perm !== "granted") return say(m, t("notif_denied"), "err");
    var reg = await navigator.serviceWorker.register("sw.js");
    reg = await navigator.serviceWorker.ready;
    var sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(VAPID_PUBLIC) });
    var j = sub.toJSON();
    var r = await db.from("push_subscriptions").upsert({ endpoint: j.endpoint, user_id: currentUser.id, subscription: j, lang: lang });
    if (r.error) throw r.error;
    say(m, t("notif_ok"), "ok");
  } catch (e) { say(m, (e && e.message) || t("e_generic"), "err"); }
};
