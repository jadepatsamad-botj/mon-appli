// Réglages des abonnements, lus dans Supabase (table app_settings, fichier sql/abonnements.sql)
// et modifiables depuis l'Administration : « tout gratuit », qui paie, liens de paiement Stripe.
// Sans la table, l'appli garde les valeurs du code (js/reglages.js et js/abonnements.js).

var SETTINGS_OK = false;
async function loadAppSettings() {
  try {
    var r = await db.from("app_settings").select("key,value");
    if (r.error || !Array.isArray(r.data)) return;
    r.data.forEach(function (row) {
      if (row.key === "free_for_all") FREE_FOR_ALL = row.value === true;
      if (row.key === "payers" && ["hommes", "tous", "personne"].indexOf(row.value) !== -1) PAYERS = row.value;
      if (row.key === "stripe_links" && row.value && typeof row.value === "object") {
        ["premium", "gold", "diamond", "portal"].forEach(function (k) { if (typeof row.value[k] === "string") STRIPE[k] = row.value[k]; });
      }
    });
    SETTINGS_OK = true;
    if (currentProfile && typeof applyGating === "function") applyGating();
  } catch (e) {}
}
loadAppSettings();

// Chaque connexion relit les réglages (au cas où l'admin les a changés)
var _showSettings = show;
show = function (user) { _showSettings(user); if (user) loadAppSettings(); };

// ---------- Administration ----------
function fillSettingsForm() {
  $("set-free").checked = !!FREE_FOR_ALL;
  $("set-payers").value = PAYERS;
  ["premium", "gold", "diamond", "portal"].forEach(function (k) { $("set-l-" + k).value = STRIPE[k] || ""; });
  say($("set-msg"), SETTINGS_OK ? "" : "Lance sql/abonnements.sql dans Supabase pour pouvoir enregistrer ces réglages.", SETTINGS_OK ? "" : "err");
}
$("set-save").onclick = async function () {
  var links = {}, bad = null;
  ["premium", "gold", "diamond", "portal"].forEach(function (k) {
    var v = $("set-l-" + k).value.trim();
    var ok = !v || (k === "portal" ? /^https:\/\/billing\.stripe\.com\//.test(v) : /^https:\/\/buy\.stripe\.com\//.test(v));
    if (!ok) bad = k;
    links[k] = v;
  });
  if (bad) return say($("set-msg"), "Le lien « " + bad + " » doit commencer par " + (bad === "portal" ? "https://billing.stripe.com/" : "https://buy.stripe.com/"), "err");
  var free = $("set-free").checked;
  if (!free && !links.premium && !links.gold && !links.diamond && !confirm("Aucun lien de paiement n'est rempli : les membres concernés ne pourront plus rien acheter. Continuer ?")) return;
  this.disabled = true;
  var rows = [
    { key: "free_for_all", value: free, updated_at: new Date().toISOString() },
    { key: "payers", value: $("set-payers").value, updated_at: new Date().toISOString() },
    { key: "stripe_links", value: links, updated_at: new Date().toISOString() }
  ];
  var r = await db.from("app_settings").upsert(rows);
  this.disabled = false;
  if (r.error) return say($("set-msg"), r.error.message, "err");
  await loadAppSettings();
  say($("set-msg"), free ? "Enregistré ✓ Tout reste gratuit pour tout le monde." : "Enregistré ✓ Les abonnements payants sont actifs.", "ok");
};
var _goAdminSettings = $("go-admin").onclick;
$("go-admin").onclick = function () { _goAdminSettings.apply(this, arguments); loadAppSettings().then(fillSettingsForm); };
