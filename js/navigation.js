// Navigation : barre du bas (Accueil, Intérêts, Activités, Messages) et en-tête (Mise à niveau, mon profil)

// Quel onglet du bas est allumé pour chaque écran
var TAB_OF = { feed: "home", discover: "home", likes: "interests", views: "interests", events: "events", matches: "messages", chat: "messages" };
// Écrans où la barre du bas est cachée (formulaires plein écran)
var NO_TABBAR = ["auth", "profile", "chat"];
var navStarted = false;

function updateNav(name) {
  var logged = !!(currentUser && currentProfile);
  document.body.classList.toggle("nav-on", logged && NO_TABBAR.indexOf(name) === -1);
  document.body.classList.toggle("chat-on", name === "chat");
  if (name !== "chat" && typeof closeLightbox === "function") closeLightbox();
  $("tabbar").hidden = !logged || NO_TABBAR.indexOf(name) !== -1;
  $("top-actions").hidden = !logged || name === "auth";
  var active = TAB_OF[name] || "";
  Array.prototype.forEach.call(document.querySelectorAll("#tabbar button"), function (b) {
    var on = b.dataset.tab === active;
    b.classList.toggle("on", on);
    if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
  Array.prototype.forEach.call(document.querySelectorAll(".seg-likes"), function (b) { b.setAttribute("aria-selected", name === "likes"); });
  Array.prototype.forEach.call(document.querySelectorAll(".seg-views"), function (b) { b.setAttribute("aria-selected", name === "views"); });
  placeLang(logged);
  paintAvatar();
}

// Le menu des langues va dans les Paramètres une fois connecté (l'en-tête reste léger)
function placeLang(logged) {
  var sel = $("lang");
  if (logged && sel.parentNode.id !== "settings") $("settings").insertBefore(sel, $("settings").children[2]);
  if (!logged && sel.parentNode.className !== "topbar") $("top-actions").parentNode.appendChild(sel);
}

function paintAvatar() {
  var p = currentProfile, url = p ? photoUrl(p) : null;
  $("top-avatar").hidden = !url;
  if (url && $("top-avatar").getAttribute("src") !== url) $("top-avatar").src = url;
  $("top-initial").textContent = url || !p ? "" : (p.first_name || "?").charAt(0).toUpperCase();
}

// Chaque changement d'écran met à jour la barre du bas
var _showSection = showSection;
showSection = function (name) {
  _showSection(name);
  updateNav(name);
};

// Après la connexion, on arrive sur l'Accueil (et plus sur la page de profil)
var _renderView = renderView;
renderView = function (user, p) {
  _renderView(user, p);
  if (!navStarted) { navStarted = true; goTab("home"); }
};
var _show = show;
show = function (user) {
  if (!user) navStarted = false;
  _show(user);
};

function goTab(tab) {
  if (tab === "home") {
    if ($("filters").parentNode.id !== "feed-filter-slot") { loadFilters(); $("feed-filter-slot").appendChild($("filters")); }
    showSection("feed");
    if (!$("feed-list").children.length || tab === goTab.last) loadFeed(true);
  } else if (tab === "interests") { fromLikes = false; showSection("likes"); loadLikes(); }
  else if (tab === "events") { showSection("events"); loadEvents(); }
  else if (tab === "messages") { showSection("matches"); loadMatches(); }
  goTab.last = tab;
  window.scrollTo(0, 0);
  if (currentUser) checkBadges();
}

Array.prototype.forEach.call(document.querySelectorAll("#tabbar button"), function (b) {
  b.onclick = function () { goTab(b.dataset.tab); };
});
Array.prototype.forEach.call(document.querySelectorAll(".seg-likes"), function (b) {
  b.onclick = function () { showSection("likes"); loadLikes(); };
});
Array.prototype.forEach.call(document.querySelectorAll(".seg-views"), function (b) {
  b.onclick = function () { showSection("views"); loadViews(); };
});
$("top-upgrade").onclick = openPremium;
$("top-me").onclick = function () { goTab.last = ""; renderView(currentUser, currentProfile); window.scrollTo(0, 0); };

// Les filtres appliqués depuis l'Accueil rechargent l'Accueil
var _applyFilters = $("f-apply").onclick;
$("f-apply").onclick = function () {
  if (!$("feed").hidden) { saveFilters(); $("filters").open = false; loadFeed(true); }
  else _applyFilters();
};

// Pastilles rouges sur Intérêts et Messages
var _paintBadge = paintBadge;
paintBadge = function (id, key, n) {
  _paintBadge(id, key, n);
  var nb = id === "go-likes" ? $("nb-interests") : id === "go-matches" ? $("nb-messages") : null;
  if (nb) { nb.textContent = n > 9 ? "9+" : n; nb.hidden = !(n > 0); }
};
setInterval(function () { if (currentUser && document.body.classList.contains("nav-on") && $("home").hidden) checkBadges(); }, 30000);

// Les boutons « Retour » de l'ancien menu ramènent maintenant à l'Accueil
["events-back", "matches-back", "likes-back", "views-back"].forEach(function (id) {
  $(id).onclick = function () { goTab("home"); };
});
$("chat-back").onclick = function () { goTab("messages"); };

// Changer de langue réaffiche l'Accueil dans la nouvelle langue
$("lang").addEventListener("change", function () {
  if (!$("feed").hidden) loadFeed(true);
  else if (!$("likes").hidden) loadLikes();
  else if (!$("views").hidden) loadViews();
  else if (!$("events").hidden) loadEvents();
});
