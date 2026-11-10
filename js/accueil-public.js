// Page d'accueil publique : ce que voit un visiteur non connecté (présentation + inscription)

var LANG_NAMES = { fr: "Français", en: "English", th: "ไทย", vi: "Tiếng Việt", zh: "中文", id: "Bahasa Indonesia",
  ja: "日本語", ko: "한국어", ms: "Bahasa Melayu", tl: "Filipino", lo: "ລາວ", km: "ខ្មែរ" };

// Le formulaire s'ouvre en fenêtre par-dessus la page, seulement avec « S'inscrire » ou « Se connecter » (en haut à droite)
function goAuth(mode) {
  setMode(mode);
  if ($("auth").hidden) showSection("auth");
  document.body.classList.add("auth-open");
  $("auth").scrollIntoView({ block: "start" });
  setTimeout(function () { try { $("email").focus({ preventScroll: true }); } catch (e) {} }, 60);
}
function closeAuth() {
  document.body.classList.remove("auth-open");
  if ($("auth").hidden && !currentUser) showSection("auth");
}

$("lp-join-top").onclick = function () { goAuth("signup"); };
$("lp-login").onclick = function () { goAuth("login"); };
// Les boutons « Créer mon compte gratuit » de la page
Array.prototype.forEach.call(document.querySelectorAll(".lp-join-any"), function (b) { b.onclick = function () { goAuth("signup"); }; });
$("auth-close").onclick = closeAuth;
$("lp-legal").onclick = function () { document.body.classList.add("auth-open"); openLegal("auth"); };
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && document.body.classList.contains("auth-open")) closeAuth();
});
// Un clic sur le fond assombri ferme aussi la fenêtre
document.querySelector("main").addEventListener("click", function (e) {
  if (e.target === this && document.body.classList.contains("auth-open")) closeAuth();
});

// Les 12 langues en bas de page
(function () {
  var box = $("lp-langs");
  LANGS.forEach(function (code) {
    var b = document.createElement("button"); b.type = "button"; b.className = "linkbtn"; b.lang = code;
    b.textContent = LANG_NAMES[code] || code;
    b.onclick = function () {
      $("lang").value = code;
      $("lang").dispatchEvent(new Event("change"));
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    box.appendChild(b);
  });
})();
