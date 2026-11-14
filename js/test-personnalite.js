// Test de personnalité (16 types), dans l'esprit du test « 16 personnalités » :
// 20 affirmations (5 par axe), une échelle de 7 ronds de « Pas d'accord » à « D'accord »,
// puis le type, son petit personnage et le pourcentage sur chaque axe.
// Les affirmations sont écrites pour Jade (textes lpq_s1 … lpq_s20, dans les 12 langues).
// Utilisé sur la page d'accueil (sans inscription) et dans « Mon profil ».

var LPQ_KEY = "jade_mbti_guess";
var LPQ_AXES = [["E", "I"], ["S", "N"], ["T", "F"], ["J", "P"]];
// Chaque affirmation : l'axe (0 énergie, 1 perception, 2 décision, 3 organisation) et la lettre vers laquelle « d'accord » penche.
// L'ordre alterne les axes et le sens, pour ne pas enchaîner le même thème.
var LPQ_ITEMS = [
  [0, "E"], [1, "N"], [2, "F"], [3, "J"],
  [0, "I"], [1, "S"], [2, "T"], [3, "P"],
  [0, "E"], [1, "N"], [2, "F"], [3, "J"],
  [0, "I"], [1, "S"], [2, "T"], [3, "P"],
  [0, "E"], [1, "N"], [2, "F"], [3, "J"]
];
var LPQ_N = LPQ_ITEMS.length;
var lpqStep = 0, lpqAns = [], lpqCtx = "landing", lpqLastFocus = null;

// ---------- La galerie des 16 personnages (page d'accueil) ----------
function paintLpqGrid() {
  var g = $("lpq-grid"); if (!g) return;
  g.textContent = "";
  MBTI_TYPES.forEach(function (ty) {
    var c = document.createElement("div"); c.className = "lpq-cell " + mbtiFamily(ty); c.setAttribute("role", "listitem");
    c.appendChild(mbtiAvatar(ty));
    var b = document.createElement("b"); b.textContent = ty; c.appendChild(b);
    var n = document.createElement("span"); n.textContent = mbtiName(ty); c.appendChild(n);
    g.appendChild(c);
  });
}

// ---------- L'échelle de 7 ronds ----------
function buildDots() {
  var box = $("lpq-dots"); box.textContent = "";
  for (var v = -3; v <= 3; v++) {
    (function (v) {
      var b = document.createElement("button"); b.type = "button";
      b.className = "lpq-dot s" + Math.abs(v) + (v < 0 ? " dis" : v > 0 ? " agr" : " mid");
      b.setAttribute("aria-label", t("lpq_v" + (v + 4)));
      b.setAttribute("aria-pressed", "false");
      b.dataset.v = v;
      b.onclick = function () { lpqAnswer(v, b); };
      box.appendChild(b);
    })(v);
  }
}

// ---------- Calcul : pour chaque axe, la lettre et le pourcentage ----------
function lpqScore() {
  var sums = [0, 0, 0, 0], max = [0, 0, 0, 0];
  LPQ_ITEMS.forEach(function (it, i) {
    var v = lpqAns[i] || 0, ax = it[0];
    sums[ax] += it[1] === LPQ_AXES[ax][0] ? v : -v;
    max[ax] += 3;
  });
  return LPQ_AXES.map(function (pair, ax) {
    var first = sums[ax] >= 0;                         // égalité parfaite : la première lettre
    var pct = Math.round(50 + Math.abs(sums[ax]) / max[ax] * 50);
    return { letter: first ? pair[0] : pair[1], pct: pct, sideFirst: first };
  });
}

function lpqSvg(el, ty) { el.innerHTML = mbtiSvg(ty); }
function paintLpq() {
  var done = lpqStep >= LPQ_N;
  $("lpq-q-view").hidden = done; $("lpq-r-view").hidden = !done;
  $("lpq-fill").style.width = (done ? 100 : Math.round(lpqStep / LPQ_N * 100)) + "%";
  $("lpq-count").textContent = (done ? LPQ_N : lpqStep + 1) + " / " + LPQ_N;
  if (!done) {
    $("lpq-step").textContent = t("lpq_q", { n: lpqStep + 1 });
    $("lpq-title").textContent = t("lpq_s" + (lpqStep + 1));
    lpqSvg($("lpq-qav"), MBTI_TYPES[lpqStep % MBTI_TYPES.length]);
    Array.prototype.forEach.call($("lpq-dots").children, function (b) {
      var on = lpqAns[lpqStep] !== undefined && String(lpqAns[lpqStep]) === b.dataset.v;
      b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    $("lpq-prev").style.visibility = lpqStep ? "visible" : "hidden";
    $("lpq-noacc").hidden = lpqCtx !== "landing";
    return;
  }
  var axes = lpqScore(), ty = axes.map(function (a) { return a.letter; }).join("");
  if (lpqCtx === "landing") { try { localStorage.setItem(LPQ_KEY, ty); } catch (e) {} }
  var mini = $("lpq-mini"); mini.textContent = "";
  MBTI_TYPES.forEach(function (x) { var a = mbtiAvatar(x); if (x !== ty) a.classList.add("dim"); mini.appendChild(a); });
  lpqSvg($("lpq-big"), ty);
  $("lpq-code").textContent = ty;
  $("lpq-name").textContent = mbtiName(ty);
  $("lpq-desc").textContent = t("mbti_d_" + ty);
  // Les 4 barres : « Extraverti ——64 %—— Introverti »
  var box = $("lpq-axes"); box.textContent = "";
  axes.forEach(function (a, ax) {
    var pair = LPQ_AXES[ax], row = document.createElement("div"); row.className = "lpq-axis";
    var pc = document.createElement("b"); pc.className = "lpq-apct"; pc.textContent = a.pct + " % " + t("lpq_ax_" + a.letter);
    var l = document.createElement("span"); l.className = "lpq-al" + (a.sideFirst ? " win" : ""); l.textContent = t("lpq_ax_" + pair[0]);
    var bar = document.createElement("div"); bar.className = "lpq-abar";
    var fill = document.createElement("i"); fill.style.width = a.pct + "%"; if (!a.sideFirst) fill.className = "right";
    bar.appendChild(fill);
    var r = document.createElement("span"); r.className = "lpq-ar" + (!a.sideFirst ? " win" : ""); r.textContent = t("lpq_ax_" + pair[1]);
    row.appendChild(pc); row.appendChild(l); row.appendChild(bar); row.appendChild(r);
    box.appendChild(row);
  });
  $("lpq-join").hidden = lpqCtx !== "landing";
  $("lpq-kept").hidden = lpqCtx !== "landing";
  $("lpq-use").hidden = lpqCtx !== "profile";
  $("lpq-use").dataset.type = ty;
}

function openLpq(ctx) {
  lpqCtx = ctx || "landing";
  lpqLastFocus = document.activeElement;
  lpqStep = 0; lpqAns = [];
  buildDots();
  $("lpq").hidden = false; document.body.classList.add("lpq-open");
  document.querySelector(".lpq-sheet").setAttribute("aria-label", t("lpq_kicker"));
  paintLpq();
  document.querySelector(".lpq-sheet").scrollTop = 0;
  setTimeout(function () { try { $("lpq-dots").children[3].focus({ preventScroll: true }); } catch (e) {} }, 60);
}
function closeLpq() {
  $("lpq").hidden = true; document.body.classList.remove("lpq-open");
  try { (lpqLastFocus || $("lpq-start")).focus(); } catch (e) {}
}
function lpqAnswer(v, btn) {
  lpqAns[lpqStep] = v;
  btn.classList.add("on");
  setTimeout(function () {
    lpqStep++;
    paintLpq();
    if (lpqStep >= LPQ_N) document.querySelector(".lpq-sheet").scrollTop = 0;   // le résultat s'ouvre en haut
    try { (lpqStep >= LPQ_N ? (lpqCtx === "landing" ? $("lpq-join") : $("lpq-use")) : $("lpq-dots").children[3]).focus({ preventScroll: true }); } catch (e) {}
  }, 180);
}

$("lpq-start").onclick = function () { openLpq("landing"); };
$("lpq-close").onclick = closeLpq;
$("lpq-prev").onclick = function () { if (lpqStep > 0) { lpqStep--; paintLpq(); } };
$("lpq-again").onclick = function () { lpqStep = 0; lpqAns = []; paintLpq(); document.querySelector(".lpq-sheet").scrollTop = 0; };
$("lpq-join").onclick = function () { closeLpq(); if (typeof goAuth === "function") goAuth("signup"); };
$("lpq-use").onclick = function () { var ty = this.dataset.type; closeLpq(); if (typeof setMbti === "function") setMbti(ty); };
$("lpq").addEventListener("click", function (e) { if (e.target === this) closeLpq(); });   // clic à côté de la fenêtre
document.addEventListener("keydown", function (e) {
  if ($("lpq").hidden) return;
  if (e.key === "Escape") closeLpq();
  // Touches 1 à 7 pour répondre au clavier
  if (/^[1-7]$/.test(e.key) && lpqStep < LPQ_N && !e.metaKey && !e.ctrlKey) { var b = $("lpq-dots").children[+e.key - 1]; if (b) b.click(); }
});
$("lang").addEventListener("change", function () { paintLpqGrid(); if (!$("lpq").hidden) { buildDots(); paintLpq(); } });

// Dans « Mon profil », le bouton du test ouvre ce même test
$("mbti-quiz-btn").onclick = function () { openLpq("profile"); };

paintLpqGrid();
