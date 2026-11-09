// Photo obligatoire : chaque membre doit avoir au moins une photo de lui.
// Sans photo, son accès à Jade est mis en pause tout de suite (il ne peut plus que modifier son profil)
// jusqu'à ce qu'il ajoute une photo, et l'équipe Jade lui écrit dans Messages.
// Le contrôle se fait côté Supabase avec la fonction jade_photo_check (fichier sql/photo-obligatoire.sql).

var photoLocked = false;

function hasPhoto(p) { return !!(p && p.photo_path); }

// Ouvre « Modifier mon profil » avec le message de pause, sans bouton Annuler
function lockToProfile() {
  fillForm(currentProfile);
  showSection("profile");
  $("pcancel").hidden = true;
  $("photo-lock").hidden = false;
  window.scrollTo(0, 0);
}

async function checkPhoto() {
  var p = currentProfile;
  if (!currentUser || !p) return;
  if (hasPhoto(p) && !p.photo_warned_at) { photoLocked = false; return; }
  if (!hasPhoto(p)) { photoLocked = true; lockToProfile(); }   // pause immédiate
  try {
    // Côté Supabase : envoie le message de l'équipe Jade (une seule fois) ou efface l'avertissement
    var r = await db.rpc("jade_photo_check");
    if (r.error || !r.data || currentProfile !== p) return;
    p.photo_warned_at = hasPhoto(p) ? null : (p.photo_warned_at || new Date().toISOString());
    if (r.data.warned && typeof checkBadges === "function") checkBadges();
  } catch (e) {}
}

// Chaque affichage du profil (connexion, enregistrement) refait le contrôle
var _renderViewPhoto = renderView;
renderView = function (user, p) {
  if (!hasPhoto(p)) { photoLocked = true; lockToProfile(); checkPhoto(); return; }
  if (hasPhoto(p)) { photoLocked = false; $("photo-lock").hidden = true; }
  _renderViewPhoto(user, p);
  checkPhoto();
};

// Pendant la pause, les onglets ramènent au profil
var _goTabPhoto = goTab;
goTab = function (tab) {
  if (photoLocked && !hasPhoto(currentProfile)) return lockToProfile();
  _goTabPhoto(tab);
};

var _showPhoto = show;
show = function (user) {
  if (!user) { photoLocked = false; $("photo-lock").hidden = true; }
  _showPhoto(user);
};

// Administration : prévenir d'un coup tous les profils sans photo
if ($("admin-photo-sweep")) $("admin-photo-sweep").onclick = async function () {
  var out = $("diag-out"), b = this;
  b.disabled = true; out.textContent = "Envoi des messages…";
  try {
    var r = await db.rpc("jade_photo_sweep");
    out.textContent = r.error ? "Erreur : " + r.error.message : (r.data || 0) + " membre(s) sans photo prévenu(s) dans Messages.";
  } catch (e) { out.textContent = "Erreur : " + (e.message || e); }
  b.disabled = false;
};
