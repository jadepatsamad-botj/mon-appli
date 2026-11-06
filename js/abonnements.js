// Abonnements Premium / Gold / Diamond et accompagnement

// ---------- Abonnements (Premium / Gold / Diamond) ----------
// Liens de paiement Stripe : à remplir quand ils sont créés (Stripe > Payment Links).
var STRIPE = { premium: "", gold: "", diamond: "", portal: "" };
var PRICES = { premium: 15.99, gold: 45.99, diamond: 149.99 };
var PLAN_LEVEL = { premium: 1, gold: 2, diamond: 3 };
var PAYS = "homme";   // choix actuel : seuls les hommes paient ; les autres ont Premium offert
function paidPlan(p) {
  return p && p.premium_until && new Date(p.premium_until) > new Date() ? (p.plan || "premium") : null;
}
function levelOf(p) {
  if (!p) return 0;
  var paid = paidPlan(p) ? PLAN_LEVEL[paidPlan(p)] || 1 : 0;
  return Math.max(p.gender !== PAYS ? 1 : 0, paid);
}
function myLevel() { return FREE_FOR_ALL ? PLAN_LEVEL.diamond : levelOf(currentProfile); }
function lockedBox(text) {
  var d = document.createElement("div"); d.className = "locked";
  var p = document.createElement("div"); p.textContent = "🔒 " + text; d.appendChild(p);
  var b = document.createElement("button"); b.type = "button"; b.className = "primary"; b.textContent = t("see_plans");
  b.onclick = openPremium; d.appendChild(b);
  return d;
}
function money(x) {
  try { return new Intl.NumberFormat(lang, { style: "currency", currency: "EUR" }).format(x); } catch (e) { return x + " €"; }
}
function applyGating() {
  var lv = myLevel();
  ["f-intent", "f-lang"].forEach(function (id) { var el = $(id); if (el) { el.disabled = lv < 1; el.title = lv < 1 ? t("premium_only") : ""; } });
  $("go-concierge").hidden = lv < 3;
}
function openPremium() {
  var p = currentProfile, plan = paidPlan(p), st = $("premium-status");
  Array.prototype.forEach.call(document.querySelectorAll("#premium .plan"), function (card) {
    var k = card.getAttribute("data-plan");
    card.querySelector(".pp").textContent = money(PRICES[k]);
    card.classList.toggle("current", plan === k);
    var buy = card.querySelector(".buy");
    if (FREE_FOR_ALL) { buy.textContent = t("plan_included"); buy.disabled = true; buy.onclick = null; }
    else buy.onclick = function () { buyPlan(k); };
  });
  if (FREE_FOR_ALL) st.textContent = t("free_launch");
  else if (plan) st.textContent = t("plan_active", { plan: plan.charAt(0).toUpperCase() + plan.slice(1), d: new Date(p.premium_until).toLocaleDateString() });
  else if (myLevel() >= 1) st.textContent = t("premium_free");
  else st.textContent = "";
  st.hidden = !st.textContent;
  $("manage-sub").hidden = !(plan && STRIPE.portal);
  say($("pmmsg"), "", "");
  showSection("premium");
}
function buyPlan(k) {
  var link = STRIPE[k];
  if (!link) return say($("pmmsg"), t("pay_soon"), "err");
  var u = link + (link.indexOf("?") === -1 ? "?" : "&") + "client_reference_id=" + encodeURIComponent(currentUser.id) +
    "&prefilled_email=" + encodeURIComponent(currentUser.email || "");
  window.location.href = u;
}
$("manage-sub").onclick = function () { if (STRIPE.portal) window.open(STRIPE.portal, "_blank", "noopener"); };
$("go-premium").onclick = openPremium;
$("premium-back").onclick = function () { renderView(currentUser, currentProfile); };

async function loadConcierge() {
  var box = $("concierge-list"); box.textContent = "";
  var r = await db.from("concierge_requests").select("*").eq("user_id", currentUser.id).order("created_at", { ascending: false }).limit(20);
  (r.data || []).forEach(function (x) {
    var d = document.createElement("div"); d.className = "brow";
    var s = document.createElement("span"); s.textContent = new Date(x.created_at).toLocaleDateString() + " · " + x.message.slice(0, 80);
    var st = document.createElement("small"); st.textContent = x.status === "traité" ? "✅" : "⏳";
    d.appendChild(s); d.appendChild(st); box.appendChild(d);
  });
}
$("go-concierge").onclick = function () { $("concierge-msg").value = ""; say($("cgmsg"), "", ""); showSection("concierge"); loadConcierge(); };
$("concierge-back").onclick = function () { renderView(currentUser, currentProfile); };
$("concierge-send").onclick = async function () {
  var txt = $("concierge-msg").value.trim();
  if (txt.length < 5) return say($("cgmsg"), t("e_generic"), "err");
  $("concierge-send").disabled = true;
  var r = await db.from("concierge_requests").insert({ user_id: currentUser.id, message: txt });
  $("concierge-send").disabled = false;
  if (r.error) return say($("cgmsg"), r.error.message, "err");
  $("concierge-msg").value = ""; say($("cgmsg"), t("concierge_sent"), "ok"); loadConcierge();
};
