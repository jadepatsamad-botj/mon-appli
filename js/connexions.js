// Adresses IP de connexion : enregistrées à chaque connexion (côté Supabase, fonction jade_log_login),
// visibles seulement dans l'Administration. Fichier SQL : sql/connexions-ip.sql.

var ipLogged = false;
var _showIp = show;
show = function (user) {
  _showIp(user);
  if (!user) { ipLogged = false; return; }
  if (ipLogged) return;
  ipLogged = true;
  try { db.rpc("jade_log_login").then(function () {}, function () {}); } catch (e) {}
};

// « Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 …) … Safari » → « iPhone · Safari »
function deviceOf(ua) {
  ua = ua || "";
  var os = /iPad/.test(ua) ? "iPad" : /iPhone/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows"
    : /Macintosh|Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Appareil inconnu";
  var br = /SamsungBrowser/.test(ua) ? "Samsung Internet" : /Edg\//.test(ua) ? "Edge" : /CriOS|Chrome\//.test(ua) ? "Chrome"
    : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return br ? os + " · " + br : os;
}

var ipMember = null;   // null = tout le monde
function ipFor(p) {
  ipMember = p || null;
  $("ip-who").textContent = p ? "Connexions de " + nameWithAge(p) : "Toutes les connexions récentes";
  $("ip-all").hidden = !p;
  loadAdminIps();
  if (p) $("ip-who").scrollIntoView({ block: "start", behavior: "smooth" });
}

async function loadAdminIps() {
  var box = $("admin-ips"); box.textContent = "Chargement…";
  var r = await db.rpc("admin_login_ips", { uid: ipMember ? ipMember.id : null, lim: ipMember ? 200 : 60 });
  box.textContent = "";
  if (r.error) {
    box.textContent = /admin_login_ips|function/.test(r.error.message || "") ? "Lancez sql/connexions-ip.sql dans Supabase pour activer cette partie." : r.error.message;
    return;
  }
  if (!(r.data || []).length) { box.textContent = "Aucune connexion enregistrée pour l'instant."; return; }
  r.data.forEach(function (c) {
    var row = document.createElement("div"); row.className = "iprow";
    var who = document.createElement("button"); who.type = "button"; who.className = "linkbtn ipname";
    who.textContent = c.first_name || "(sans profil)";
    who.onclick = function () { ipFor({ id: c.user_id, first_name: c.first_name || "?" }); };
    var ip = document.createElement("code"); ip.textContent = c.ip || "IP inconnue";
    var dev = document.createElement("span"); dev.className = "ipdev"; dev.textContent = deviceOf(c.user_agent);
    var when = document.createElement("span"); when.className = "ipwhen"; when.textContent = new Date(c.created_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    row.appendChild(who); row.appendChild(ip); row.appendChild(dev); row.appendChild(when);
    if (c.other_accounts > 0) {
      var warn = document.createElement("span"); warn.className = "ipwarn";
      warn.textContent = "⚠️ même IP que " + c.other_accounts + " autre" + (c.other_accounts > 1 ? "s comptes" : " compte");
      row.appendChild(warn);
    }
    box.appendChild(row);
  });
}
$("ip-refresh").onclick = loadAdminIps;
$("ip-all").onclick = function () { ipFor(null); };
var _goAdminIp = $("go-admin").onclick;
$("go-admin").onclick = function () { _goAdminIp.apply(this, arguments); ipMember = null; ipFor(null); };
