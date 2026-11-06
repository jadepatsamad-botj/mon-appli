// Mises à jour en temps réel et présence en ligne

// ---------- Temps réel ----------
var rtChan = null, rtOk = false;
function startRealtime() {
  if (!db.channel || !currentUser || rtChan) return;
  var me = currentUser.id;
  rtChan = db.channel("rt-" + me)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: "to_id=eq." + me }, function (ev) {
      var m = ev && ev.new;
      if (chatWith && m && m.from_id === chatWith.id && !$("chat").hidden) refreshChat();
      else checkBadges();
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: "from_id=eq." + me }, function () {
      if (chatWith && !$("chat").hidden) refreshChat();
    })
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "swipes", filter: "to_id=eq." + me }, function () { checkBadges(); })
    .subscribe(function (status) { rtOk = status === "SUBSCRIBED"; });
}
function stopRealtime() {
  if (rtChan && db.removeChannel) { try { db.removeChannel(rtChan); } catch (e) {} }
  rtChan = null; rtOk = false;
}

var seenTimer = null;
function touchSeen() {
  if (!currentUser) return;
  db.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", currentUser.id).then(function () {}, function () {});
  if (!seenTimer) seenTimer = setInterval(function () { if (currentUser && currentProfile) touchSeen(); }, 300000);
}

function show(user) {
  if (!user) { stopRealtime(); currentUser = null; currentProfile = null; showSection("auth"); return; }
  loadProfile(user);
}
