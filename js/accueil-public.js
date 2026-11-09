// Page d'accueil publique : ce que voit un visiteur non connecté (présentation + inscription)

var LANG_NAMES = { fr: "Français", en: "English", th: "ไทย", vi: "Tiếng Việt", zh: "中文", id: "Bahasa Indonesia",
  ja: "日本語", ko: "한국어", ms: "Bahasa Melayu", tl: "Filipino", lo: "ລາວ", km: "ខ្មែរ" };

// Amène le visiteur au formulaire, en mode inscription ou connexion
function goAuth(mode) {
  setMode(mode);
  var form = $("auth");
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(function () { try { $("email").focus({ preventScroll: true }); } catch (e) {} }, 450);
}

Array.prototype.forEach.call(document.querySelectorAll("[data-join]"), function (b) {
  b.onclick = function () { goAuth("signup"); };
});
$("lp-join-top").onclick = function () { goAuth("signup"); };
$("lp-login").onclick = function () { goAuth("login"); };
$("lp-login2").onclick = function () { goAuth("login"); };
$("lp-login-hero").onclick = function () { goAuth("login"); };
$("lp-discover").onclick = function () {
  var top = $("lp-spirit").getBoundingClientRect().top + window.scrollY - 60;
  window.scrollTo({ top: top, behavior: "smooth" });
};

// La barre du haut n'apparaît qu'une fois la photo d'ouverture dépassée
(function () {
  var hero = document.querySelector(".lp-win");
  if (!hero || !("IntersectionObserver" in window)) { document.body.classList.add("lp-scrolled"); return; }
  new IntersectionObserver(function (e) {
    document.body.classList.toggle("lp-scrolled", !e[0].isIntersecting);
  }, { rootMargin: "-120px 0px 0px 0px" }).observe(hero);
})();
$("lp-legal").onclick = function () { openLegal("auth"); window.scrollTo(0, 0); };

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
