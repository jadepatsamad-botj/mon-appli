// Recherche (2e onglet) : tous les membres en grille, icône des filtres, tri, origine dans la barre de recherche.
// Accueil (1er onglet) : invitation à se faire vérifier, nouveaux membres, activités proposées.
// Œil pour afficher le mot de passe à la connexion et à l'inscription.

// Le choix de l'origine se place à côté de la barre de recherche
(function () {
  var sel = $("f-origin");
  var lab = document.querySelector('label[for="f-origin"]'); if (lab) lab.remove();
  sel.classList.add("srch-origin-sel");
  sel.setAttribute("data-i18n-aria", "f_origin");
  sel.setAttribute("aria-label", t("f_origin"));
  $("srch-origin-slot").appendChild(sel);
  if (!sel.childElementCount) fillOriginFilter();
})();

function refreshSearch() { saveFilters(); loadFeed(true); }
$("f-origin").addEventListener("change", refreshSearch);
$("f-sort").addEventListener("change", refreshSearch);

// L'icône des filtres ouvre / ferme le panneau
$("f-toggle").onclick = function () {
  var f = $("filters");
  if (f.parentNode.id !== "feed-filter-slot") { loadFilters(); $("feed-filter-slot").appendChild(f); }
  f.open = !f.open;
  if (f.open) f.scrollIntoView({ block: "nearest", behavior: "smooth" });
};
$("filters").addEventListener("toggle", function () { $("f-toggle").setAttribute("aria-expanded", this.open ? "true" : "false"); });

$("f-reset").onclick = function () {
  $("f-min").value = 18; $("f-max").value = 99;
  ["f-gender", "f-country", "f-origin", "f-intent", "f-lang"].forEach(function (id) { $(id).value = ""; });
  saveFilters();
  if (!$("feed").hidden) { $("filters").open = false; loadFeed(true); }
};

// L'invitation à se faire vérifier est maintenant sur l'Accueil
var _loadEventsHome = loadEvents;
loadEvents = function () { if (typeof paintVnudge === "function") paintVnudge(); return _loadEventsHome.apply(this, arguments); };

// Œil : afficher / masquer le mot de passe
$("pw-eye").onclick = function () {
  var input = $("password"), show = input.type === "password";
  input.type = show ? "text" : "password";
  this.setAttribute("aria-pressed", show ? "true" : "false");
  this.setAttribute("data-i18n-aria", show ? "pw_hide" : "pw_show");
  this.setAttribute("aria-label", t(show ? "pw_hide" : "pw_show"));
  this.classList.toggle("on", show);
  try { input.focus({ preventScroll: true }); } catch (e) {}
};
// À chaque ouverture du formulaire, le mot de passe redevient masqué
var _setModeEye = setMode;
setMode = function () {
  var r = _setModeEye.apply(this, arguments);
  var input = $("password"); if (input.type !== "password") $("pw-eye").click();
  return r;
};

if (typeof loadFilters === "function") loadFilters();
