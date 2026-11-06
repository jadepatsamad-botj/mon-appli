// Administration (réservé aux admins)

// ---------- Administration ----------
var isAdmin = false;
async function checkAdmin() {
  try {
    var r = await db.from("admins").select("user_id").eq("user_id", currentUser.id).maybeSingle();
    isAdmin = !!(r && r.data);
  } catch (e) { isAdmin = false; }
  $("go-admin").hidden = !isAdmin;
}
function abtn(label, fn) {
  var b = document.createElement("button"); b.type = "button"; b.className = "secondary"; b.textContent = label;
  b.onclick = async function () { b.disabled = true; try { await fn(); } catch (e) { say($("admsg"), e.message || "Erreur", "err"); } b.disabled = false; };
  return b;
}
function arow(p, lines, buttons, selfieUrl) {
  var row = document.createElement("div"); row.className = "arow";
  var url = p ? photoUrls(p)[0] : null;
  if (url) { var im = document.createElement("img"); im.src = url; im.alt = ""; row.appendChild(im); }
  if (selfieUrl) { var sf = document.createElement("img"); sf.src = selfieUrl; sf.alt = "selfie"; row.appendChild(sf); }
  var info = document.createElement("div"); info.className = "ainfo";
  lines.forEach(function (l, i) { var d = document.createElement(i === 0 ? "strong" : "div"); d.textContent = l; info.appendChild(d); });
  var bx = document.createElement("div"); bx.className = "abtns";
  buttons.forEach(function (b) { bx.appendChild(b); });
  info.appendChild(bx); row.appendChild(info);
  return row;
}
async function loadAdmin() {
  var vbox = $("admin-verifs"), rbox = $("admin-reports");
  vbox.textContent = ""; rbox.textContent = ""; say($("admsg"), "Chargement…", "");
  var v = await db.from("profiles").select("*").eq("verification_requested", true).eq("verified", false);
  if (v.error) return say($("admsg"), v.error.message, "err");
  if (!(v.data || []).length) { var e1 = document.createElement("p"); e1.className = "empty"; e1.textContent = "Aucune demande."; vbox.appendChild(e1); }
  for (var i = 0; i < (v.data || []).length; i++) {
    var p = v.data[i];
    var su = await db.storage.from("verifications").createSignedUrl(p.id + "/selfie", 600);
    vbox.appendChild(arow(p, [nameWithAge(p), p.country ? countryLabel(p.country) : ""], [
      abtn("✓ Valider", async function () { var x = await db.rpc("admin_set_verified", { uid: p.id, ok: true }); if (x.error) throw x.error; loadAdmin(); }),
      abtn("✗ Refuser", async function () { var x = await db.rpc("admin_set_verified", { uid: p.id, ok: false }); if (x.error) throw x.error; loadAdmin(); })
    ], su && su.data ? su.data.signedUrl : null));
  }
  var r = await db.from("reports").select("*").eq("handled", false).order("created_at", { ascending: false }).limit(50);
  if (r.error) return say($("admsg"), r.error.message, "err");
  var reps = r.data || [];
  if (!reps.length) { var e2 = document.createElement("p"); e2.className = "empty"; e2.textContent = "Aucun signalement."; rbox.appendChild(e2); }
  var ids = []; reps.forEach(function (x) { [x.reported_id, x.reporter_id].forEach(function (id) { if (id && ids.indexOf(id) === -1) ids.push(id); }); });
  var map = {};
  if (ids.length) { var pr = await db.from("profiles").select("*").in("id", ids); (pr.data || []).forEach(function (x) { map[x.id] = x; }); }
  reps.forEach(function (rep) {
    var tp = map[rep.reported_id], by = map[rep.reporter_id];
    var lines = [(tp ? nameWithAge(tp) : "Profil introuvable") + (tp && tp.suspended ? " (suspendu)" : "") + (tp && tp.under_review ? " (en revue auto)" : ""),
      "Motif : " + rep.reason, rep.details ? "Détails : " + rep.details : "",
      "Signalé par : " + (by ? by.first_name : "?") + (rep.created_at ? " · " + new Date(rep.created_at).toLocaleDateString() : "")].filter(Boolean);
    var btns = [abtn("Marquer traité", async function () { var x = await db.rpc("admin_handle_report", { rid: String(rep.id) }); if (x.error) throw x.error; loadAdmin(); })];
    if (tp) btns.push(abtn(tp.suspended ? "Réactiver" : "Suspendre le compte", async function () {
      if (!tp.suspended && !confirm("Suspendre ce compte ?")) return;
      var x = await db.rpc("admin_set_suspended", { uid: tp.id, flag: !tp.suspended }); if (x.error) throw x.error; loadAdmin();
    }));
    rbox.appendChild(arow(tp, lines, btns));
  });
  say($("admsg"), "", "");
}
async function runDiag() {
  var out = $("diag-out"); out.textContent = "Vérification…";
  async function chk(label, fn) {
    try { var r = await fn(); return [label, !(r && r.error), r && r.error ? r.error.message : ""]; }
    catch (e) { return [label, false, e.message || String(e)]; }
  }
  var res = [];
  res.push(await chk("Vérification des profils", function () { return db.from("profiles").select("verified,verification_requested").limit(1); }));
  res.push(await chk("Photos (5 par profil)", function () { return db.from("profiles").select("photos").limit(1); }));
  res.push(await chk("Administration (suspension)", function () { return db.from("profiles").select("suspended").limit(1); }));
  res.push(await chk("Signalements traités", function () { return db.from("reports").select("id,handled,created_at").limit(1); }));
  res.push(await chk("Profils enrichis (ville, intention, langues)", function () { return db.from("profiles").select("city,intention,spoken,last_seen").limit(1); }));
  res.push(await chk("Centres d'intérêt", function () { return db.from("profiles").select("interests").limit(1); }));
  res.push(await chk("Profil en pause", function () { return db.from("profiles").select("hidden").limit(1); }));
  res.push(await chk("Messages « Vu »", function () { return db.from("messages").select("read_at").limit(1); }));
  res.push(await chk("Fonction « Vu »", function () { return db.rpc("mark_messages_read", { peer: "00000000-0000-0000-0000-000000000000" }); }));
  res.push(await chk("Limites anti-abus (dates des likes)", function () { return db.from("swipes").select("created_at").limit(1); }));
  res.push(await chk("Super like", function () { return db.from("swipes").select("super").limit(1); }));
  res.push(await chk("Modération automatique", function () { return db.from("profiles").select("under_review").limit(1); }));
  res.push(await chk("Recherche de membres", function () { return db.rpc("admin_search", { q: "zzzz-test" }); }));
  res.push(await chk("Notifications (table)", function () { return db.from("push_subscriptions").select("endpoint").limit(1); }));
  res.push(await chk("Notifications (fonction notify)", async function () {
    var r = await db.functions.invoke("notify", { body: { to: currentUser.id, kind: "message" } });
    return r.error ? { error: { message: "fonction absente ou en erreur (" + (r.error.message || r.error) + ")" } } : {};
  }));
  res.push(await chk("Abonnements (colonnes)", function () { return db.from("profiles").select("premium_until,plan,boost").limit(1); }));
  res.push(await chk("Abonnements (niveau)", function () { return db.rpc("plan_level", { uid: currentUser.id }); }));
  res.push(await chk("Abonnements Stripe (table)", function () { return db.from("subscriptions").select("user_id").limit(1); }));
  res.push(await chk("Demandes Diamond", function () { return db.from("concierge_requests").select("id").limit(1); }));
  res.push(await chk("Compteur de visites", function () { return db.rpc("count_my_views"); }));
  res.push(await chk("Activités", function () { return db.from("events").select("id").limit(1); }));
  res.push(await chk("Inscriptions aux activités", function () { return db.from("event_signups").select("event_id").limit(1); }));
  res.push(await chk("Compteur d'inscrits", function () { return db.rpc("event_counts"); }));
  res.push(await chk("Liste des bloqués", function () { return db.rpc("my_blocked"); }));
  res.push(await chk("Statistiques", function () { return db.rpc("admin_stats"); }));
  res.push(await chk("Qui a vu mon profil", function () { return db.from("profile_views").select("viewer_id").limit(1); }));
  out.textContent = "";
  var ok = res.filter(function (x) { return x[1]; }).length;
  var head = document.createElement("p"); head.innerHTML = "<strong>" + ok + " / " + res.length + " OK</strong>" + (ok < res.length ? " — relance sql-tout-en-un.txt dans Supabase." : " — tout est en place."); out.appendChild(head);
  res.concat([["Temps réel", rtOk, rtOk ? "" : "non connecté : rouvre l'appli, ou relance sql-tout-en-un.txt (l'appli vérifie alors toutes les 4 s)"]]).forEach(function (x) {
    var d = document.createElement("div"); d.style.fontSize = ".88rem"; d.style.margin = "2px 0";
    d.textContent = (x[1] ? "✅ " : (x[0] === "Temps réel" ? "⚠️ " : "❌ ")) + x[0] + (x[2] ? " — " + x[2] : "");
    out.appendChild(d);
  });
}
$("admin-diag").onclick = runDiag;

async function loadAdminConcierge() {
  var box = $("admin-concierge"); box.textContent = "";
  var r = await db.from("concierge_requests").select("*").eq("status", "nouveau").order("created_at", { ascending: true }).limit(50);
  if (r.error) { box.textContent = r.error.message; return; }
  if (!(r.data || []).length) { var e = document.createElement("p"); e.className = "empty"; e.textContent = "Aucune demande."; box.appendChild(e); return; }
  var ids = r.data.map(function (x) { return x.user_id; });
  var pr = await db.rpc("admin_search", { q: "" }); var map = {};
  (pr.data || []).forEach(function (p) { map[p.id] = p; });
  r.data.forEach(function (x) {
    var p = map[x.user_id];
    box.appendChild(arow(p || null, [(p ? nameWithAge(p) : x.user_id), new Date(x.created_at).toLocaleString(), x.message], [
      abtn("Marquer traité", async function () { var y = await db.rpc("admin_concierge_done", { rid: x.id }); if (y.error) throw y.error; loadAdminConcierge(); })
    ]));
  });
}

async function loadStats() {
  var box = $("admin-stats"); box.textContent = "";
  var r = await db.rpc("admin_stats");
  if (!r || r.error || !r.data) return;
  var labels = { comptes: "Comptes", profils: "Profils", verifies: "Vérifiés", suspendus: "Suspendus", actifs_24h: "Actifs 24 h", likes: "Likes", matchs: "Matchs", messages: "Messages", messages_24h: "Messages 24 h", signalements_ouverts: "Signalements ouverts", en_revue: "En revue" };
  Object.keys(labels).forEach(function (k) {
    if (r.data[k] === undefined) return;
    var d = document.createElement("div"); d.className = "stat";
    var b = document.createElement("b"); b.textContent = r.data[k];
    var s = document.createElement("span"); s.textContent = labels[k];
    d.appendChild(b); d.appendChild(s); box.appendChild(d);
  });
}
async function adminSearch() {
  var box = $("admin-members"); box.textContent = "Recherche…";
  var r = await db.rpc("admin_search", { q: $("admin-q").value.trim() });
  box.textContent = "";
  if (r.error) return say($("admsg"), r.error.message, "err");
  if (!(r.data || []).length) { box.textContent = "Aucun membre trouvé."; return; }
  r.data.forEach(function (p) {
    var flags = [paidPlan(p) ? "★ " + paidPlan(p) + " jusqu'au " + new Date(p.premium_until).toLocaleDateString() : "", p.verified ? "✓ vérifié" : "", p.suspended ? "⛔ suspendu" : "", p.under_review ? "🔎 en revue" : "", p.hidden ? "⏸ en pause" : ""].filter(Boolean).join(" · ");
    var last = p.last_seen ? "Vu le " + new Date(p.last_seen).toLocaleDateString() : "";
    var btns = [
      abtn(p.verified ? "Retirer ✓" : "Vérifier ✓", async function () { var x = await db.rpc("admin_set_verified", { uid: p.id, ok: !p.verified }); if (x.error) throw x.error; adminSearch(); }),
      abtn(p.suspended ? "Réactiver" : "Suspendre", async function () {
        if (!p.suspended && !confirm("Suspendre " + p.first_name + " ?")) return;
        var x = await db.rpc("admin_set_suspended", { uid: p.id, flag: !p.suspended }); if (x.error) throw x.error; adminSearch(); })
    ];
    ["premium", "gold", "diamond"].forEach(function (k) {
      btns.push(abtn("+30 j " + k.charAt(0).toUpperCase() + k.slice(1), async function () { var x = await db.rpc("admin_add_premium", { uid: p.id, days: 30, p: k }); if (x.error) throw x.error; adminSearch(); }));
    });
    if (p.under_review) btns.push(abtn("Lever la revue", async function () { var x = await db.rpc("admin_set_review", { uid: p.id, flag: false }); if (x.error) throw x.error; adminSearch(); }));
    box.appendChild(arow(p, [nameWithAge(p), [p.city, p.country ? countryLabel(p.country) : ""].filter(Boolean).join(", "), flags, last].filter(Boolean), btns));
  });
}
$("admin-search").onclick = adminSearch;
$("admin-q").onkeydown = function (e) { if (e.key === "Enter") adminSearch(); };

$("go-admin").onclick = function () { showSection("admin"); loadStats(); loadAdminEvents(); loadAdminConcierge(); loadAdmin(); };
$("admin-back").onclick = function () { showSection("home"); };
