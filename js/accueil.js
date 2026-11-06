// Accueil : barre de recherche et grandes cartes de profils (like et accès au profil)

var FEED_SIZE = 12;
var feedPage = 0, feedSeen = [], feedLoading = false, feedTimer = null;

// Enlève les accents et les majuscules pour comparer « thailande » et « Thaïlande »
function plain(s) { return (s || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }

// Ajoute la recherche (prénom, ville ou pays) à la requête
function withSearch(q) {
  var term = $("feed-q").value.replace(/[,()%*"\\:.]/g, " ").trim();
  if (!term) return q;
  var p = plain(term), parts = ["first_name.ilike.%" + term + "%", "city.ilike.%" + term + "%"];
  var countries = COUNTRY_KEYS.filter(function (k, i) {
    var lab = (I18N[lang] && I18N[lang].countries && I18N[lang].countries[i]) || k;
    return plain(k).indexOf(p) !== -1 || plain(lab).indexOf(p) !== -1;
  });
  if (countries.length) parts.push("country.in.(" + countries.map(function (c) { return '"' + c + '"'; }).join(",") + ")");
  return q.or(parts.join(","));
}

function isNewMember(p) { return p.created_at && (Date.now() - new Date(p.created_at).getTime()) < 7 * 86400000; }

function feedCard(p) {
  var card = document.createElement("article"); card.className = "fcard"; card.dataset.id = p.id;
  var open = function () { openFromFeed(p); };

  var url = photoUrl(p);
  if (url) { var img = document.createElement("img"); img.src = url; img.alt = ""; img.loading = "lazy"; card.appendChild(img); }
  else { var ph = document.createElement("div"); ph.className = "fph"; ph.textContent = p.first_name.charAt(0).toUpperCase(); card.appendChild(ph); }

  var n = photoPaths(p).length;
  if (n) { var c = document.createElement("span"); c.className = "fcount"; c.textContent = "📷 " + n; card.appendChild(c); }
  if (isNewMember(p)) { var nw = document.createElement("span"); nw.className = "fnew"; nw.textContent = t("new_member"); card.appendChild(nw); }

  var info = document.createElement("div"); info.className = "finfo";
  var name = document.createElement("div"); name.className = "fname";
  if (isOnlineNow(p)) name.appendChild(onlineDot(p));
  name.appendChild(document.createTextNode(p.first_name));
  if (p.verified) { var v = document.createElement("span"); v.className = "fcheck"; v.textContent = "✓"; v.title = t("verified_tag"); name.appendChild(v); }
  var meta = document.createElement("div"); meta.className = "fmeta";
  var bits = [];
  if (p.birthdate) bits.push(ageFrom(p.birthdate));
  var place = [p.city, p.country ? countryLabel(p.country) : ""].filter(Boolean).join(", ");
  if (place) bits.push(place);
  meta.textContent = bits.join(" · ");
  info.appendChild(name); info.appendChild(meta);
  var act = activityTag(p);
  if (act) { var on = document.createElement("div"); on.className = "fonline" + (isOnlineNow(p) ? "" : " today"); on.textContent = act; info.appendChild(on); }
  card.appendChild(info);

  var btns = document.createElement("div"); btns.className = "fbtns";
  var see = document.createElement("button"); see.type = "button"; see.className = "fbtn"; see.setAttribute("aria-label", t("view_profile"));
  see.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/></svg>';
  see.setAttribute("aria-label", t("btn_message"));
  see.onclick = function (e) { e.stopPropagation(); openChat(p); };
  var like = document.createElement("button"); like.type = "button"; like.className = "fbtn like" + (myFavs[p.id] ? " on" : ""); like.setAttribute("aria-label", t("fav_btn"));
  like.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';
  like.onclick = function (e) { e.stopPropagation(); feedLike(p, like); };
  btns.appendChild(see); btns.appendChild(like);
  card.appendChild(btns);

  card.tabIndex = 0; card.setAttribute("role", "button"); card.setAttribute("aria-label", nameWithAge(p));
  card.onclick = open;
  card.onkeydown = function (e) { if (e.key === "Enter" && e.target === card) open(); };
  return card;
}

async function loadFeed(reset) {
  if (!currentUser || !currentProfile || feedLoading) return;
  feedLoading = true;
  var list = $("feed-list"), fmsg = $("fmsg");
  if (reset) {
    feedPage = 0; list.textContent = ""; $("feed-empty").hidden = true; $("feed-more").hidden = true;
    say(fmsg, t("searching"), "");
    var s = await db.from("swipes").select("to_id,liked").eq("from_id", currentUser.id);
    if (s.error) { feedLoading = false; return say(fmsg, s.error.message, "err"); }
    myFavs = {}; (s.data || []).forEach(function (x) { if (x.liked) myFavs[x.to_id] = true; });
    feedSeen = (s.data || []).filter(function (x) { return !x.liked; }).map(function (x) { return x.to_id; });
    feedSeen.push(currentUser.id);
  }
  var from = feedPage * FEED_SIZE;
  var r = await withSearch(discoverQuery(feedSeen)).range(from, from + FEED_SIZE - 1);
  feedLoading = false;
  if (r.error) return say(fmsg, r.error.message, "err");
  if (reset) { say(fmsg, ""); loadNewStrip(); }
  var rows = r.data || [];
  rows.forEach(function (p) { list.appendChild(feedCard(p)); });
  feedPage++;
  $("feed-empty").hidden = list.children.length > 0;
  $("feed-more").hidden = rows.length < FEED_SIZE;
}

async function feedLike(p, btn) {
  var ok = await toggleFav(p, btn);
  if (ok) { btn.classList.toggle("on", !!myFavs[p.id]); say($("fmsg"), myFavs[p.id] ? t("fav_added") : t("fav_removed"), "ok"); }
  else say($("fmsg"), $("lmsg").textContent, "err");
}

// Rangée « Nouveaux membres » : inscrits des 14 derniers jours, compatibles et selon les filtres
async function loadNewStrip() {
  var strip = $("new-strip"), row = $("new-row");
  if ($("feed-q").value.trim()) { strip.hidden = true; return; }
  var since = new Date(Date.now() - 14 * 86400000).toISOString();
  var r = await discoverQuery(feedSeen).gte("created_at", since).limit(20);
  var list = ((r && r.data) || []).sort(function (a, b) { return (a.created_at || "") < (b.created_at || "") ? 1 : -1; });
  row.textContent = "";
  strip.hidden = !list.length;
  list.forEach(function (p) {
    var b = document.createElement("button"); b.type = "button"; b.className = "ifav";
    b.setAttribute("aria-label", nameWithAge(p));
    var av = document.createElement("span"); av.className = "ifav-pic";
    var url = photoUrl(p);
    if (url) { var im = document.createElement("img"); im.src = url; im.alt = ""; im.loading = "lazy"; av.appendChild(im); }
    else av.textContent = p.first_name.charAt(0).toUpperCase();
    if (isOnlineNow(p)) av.appendChild(onlineDot(p));
    var nm = document.createElement("span"); nm.className = "ifav-name";
    nm.textContent = p.first_name + (p.birthdate ? ", " + ageFrom(p.birthdate) : "");
    b.appendChild(av); b.appendChild(nm);
    b.onclick = function () { openFromFeed(p); };
    row.appendChild(b);
  });
}

// Ouvre le profil en grand (écran de découverte avec Like / Pass)
function openFromFeed(p) {
  fromFeed = true; fromLikes = false; candidate = p; lastPassed = null;
  $("match-banner").hidden = true; $("cand-empty").hidden = true; $("undo").hidden = true; say($("dmsg"), "", "");
  showSection("discover");
  renderCandidate();
  window.scrollTo(0, 0);
}

// Retour à l'Accueil après avoir vu un profil (et retire la carte si on a liké ou passé)
function backToFeed(id, decided, matchText) {
  fromFeed = false;
  showSection("feed");
  if (id && decided !== undefined) {
    var card = $("feed-list").querySelector('[data-id="' + id + '"]');
    if (decided) { if (card) card.querySelector(".fbtn.like").classList.add("on"); }
    else { feedSeen.push(id); if (card) card.remove(); }
    $("feed-empty").hidden = $("feed-list").children.length > 0;
  }
  say($("fmsg"), matchText || "", matchText ? "ok" : "");
}

$("feed-more").onclick = function () { loadFeed(false); };
$("feed-q").addEventListener("input", function () {
  clearTimeout(feedTimer);
  feedTimer = setTimeout(function () { loadFeed(true); }, 450);
});
$("feed-q").addEventListener("keydown", function (e) {
  if (e.key === "Enter") { e.preventDefault(); clearTimeout(feedTimer); $("feed-q").blur(); loadFeed(true); }
});
