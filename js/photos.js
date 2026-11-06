// Photos du profil (compression, emplacements) et chargement du profil

// Réduit la photo (max 1600 px, JPEG) : évite les photos trop lourdes des téléphones
function compressImage(file, maxSide) {
  maxSide = maxSide || 1600;
  return new Promise(function (resolve) {
    try {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, maxSide / Math.max(w, h));
        var c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) {
          if (!b || (b.size >= file.size && /^image\/(jpeg|png|webp)$/.test(file.type))) return resolve(file);
          resolve(new File([b], "photo.jpg", { type: "image/jpeg" }));
        }, "image/jpeg", 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    } catch (e) { resolve(file); }
  });
}

var slots = [];   // 5 emplacements : { path, file, url }
var removedPaths = [];
function slotPath(i) { return currentUser.id + "/" + (i === 0 ? "avatar" : "p" + i); }
function initSlots(p) {
  slots = []; removedPaths = [];
  for (var i = 0; i < 5; i++) slots.push({ path: null, file: null, url: null });
  var urls = p ? photoUrls(p) : [];
  photoPaths(p).forEach(function (path, k) {
    var m = /\/(avatar|p([1-4]))$/.exec(path);
    var idx = m ? (m[1] === "avatar" ? 0 : parseInt(m[2], 10)) : k;
    if (slots[idx] && !slots[idx].path) slots[idx] = { path: path, file: null, url: urls[k] };
  });
  renderSlots();
}
function renderSlots() {
  var box = $("slots"); box.textContent = "";
  slots.forEach(function (s, i) {
    var d = document.createElement("div"); d.className = "slot";
    if (s.url) {
      var im = document.createElement("img"); im.src = s.url; im.alt = ""; d.appendChild(im);
      var x = document.createElement("button"); x.type = "button"; x.className = "x"; x.textContent = "✕"; x.setAttribute("aria-label", t("photo_remove"));
      x.onclick = function () { if (s.path) removedPaths.push(s.path); slots[i] = { path: null, file: null, url: null }; renderSlots(); };
      d.appendChild(x);
    } else {
      d.appendChild(document.createTextNode("+"));
      d.setAttribute("aria-label", t("photo_add"));
    }
    var inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/jpeg,image/png,image/webp";
    inp.onchange = async function () {
      var f = inp.files[0]; if (!f) return;
      if (!/^image\//.test(f.type)) return say($("pmsg"), t("e_photo_type"), "err");
      say($("pmsg"), t("compressing"), "");
      f = await compressImage(f);
      if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return say($("pmsg"), t("e_photo_type"), "err");
      if (f.size > 5 * 1024 * 1024) return say($("pmsg"), t("e_photo_size"), "err");
      say($("pmsg"), "", "");
      slots[i] = { path: s.path || null, file: f, url: URL.createObjectURL(f) };
      removedPaths = removedPaths.filter(function (p) { return p !== slotPath(i); });
      renderSlots();
    };
    d.appendChild(inp);
    box.appendChild(d);
  });
}

function fillForm(p) {
  $("first_name").value = (p && p.first_name) || "";
  $("country").value = (p && p.country) || "";
  $("gender").value = (p && p.gender) || "";
  $("looking_for").value = (p && p.looking_for) || "";
  $("bio").value = (p && p.bio) || "";
  $("city").value = (p && p.city) || "";
  $("intention").value = (p && p.intention) || "";
  buildInterests();
  var it = (p && p.interests) || [];
  Array.prototype.forEach.call($("interests").querySelectorAll("input"), function (c) { c.checked = it.indexOf(c.value) !== -1; });
  buildSpoken();
  var sp = (p && p.spoken) || [];
  Array.prototype.forEach.call($("spoken").querySelectorAll("input"), function (c) { c.checked = sp.indexOf(c.value) !== -1; });
  $("bio-count").textContent = $("bio").value.length;
  initSlots(p);
  $("pcancel").hidden = !p;
  say($("pmsg"), "", "");
}

async function loadProfile(user) {
  currentUser = user;
  var r = await db.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (r.error) { showSection("auth"); return say($("msg"), t("e_profile_load") + r.error.message, "err"); }
  if (r.data && r.data.suspended) {
    try { await db.auth.signOut({ scope: "local" }); } catch (x) {}
    currentUser = null; currentProfile = null; showSection("auth");
    return say($("msg"), "Compte suspendu / Account suspended.", "err");
  }
  currentProfile = r.data;
  if (r.data) { touchSeen(); startRealtime(); renderView(user, r.data); }
  else { fillForm(null); showSection("profile"); }
}
