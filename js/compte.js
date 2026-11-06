// Sécurité, déconnexion, suppression du compte

// ---------- Sécurité, déconnexion, suppression ----------
$("go-safety").onclick = function () { showSection("safety"); };
$("safety-back").onclick = function () { showSection("home"); };

$("logout").onclick = async function () { await db.auth.signOut(); show(null); setMode("login"); };

$("delete-account").onclick = async function () {
  if (!confirm(t("delete_confirm"))) return;
  var hmsg = $("hmsg"); say(hmsg, t("deleting"), "");
  try {
    var uid = currentUser.id, buckets = ["photos", "verifications"];
    for (var i = 0; i < buckets.length; i++) {
      var l = await db.storage.from(buckets[i]).list(uid);
      if (l.data && l.data.length) {
        await db.storage.from(buckets[i]).remove(l.data.map(function (f) { return uid + "/" + f.name; }));
      }
    }
    var r = await db.rpc("delete_my_account");
    if (r.error) throw r.error;
    try { await db.auth.signOut({ scope: "local" }); } catch (x) {}
    show(null); setMode("signup");
    say($("msg"), t("deleted"), "ok");
  } catch (err) { say(hmsg, t("e_delete") + (err.message || err), "err"); }
};
