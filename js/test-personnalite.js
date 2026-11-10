// Page d'accueil : les 16 petits personnages + le test de personnalité en 4 questions, sans inscription.
// Le résultat est gardé sur l'appareil : à l'inscription, il est déjà choisi dans le profil (js/personnalite.js).

var LPQ_KEY = "jade_mbti_guess";
// Personnages qui illustrent chaque réponse (réponse A, réponse B)
var LPQ_PICS = [["ESFP", "INFJ"], ["ISTJ", "ENTP"], ["INTJ", "ENFJ"], ["ESTJ", "ESTP"]];
var lpqStep = 0, lpqAns = [], lpqLastFocus = null;

// ---------- La galerie des 16 personnages ----------
function paintLpqGrid() {
  var g = $("lpq-grid"); g.textContent = "";
  MBTI_TYPES.forEach(function (ty) {
    var c = document.createElement("div"); c.className = "lpq-cell " + mbtiFamily(ty); c.setAttribute("role", "listitem");
    c.appendChild(mbtiAvatar(ty));
    var b = document.createElement("b"); b.textContent = ty; c.appendChild(b);
    var n = document.createElement("span"); n.textContent = mbtiName(ty); c.appendChild(n);
    g.appendChild(c);
  });
}

// ---------- Le test ----------
function lpqSet(el, svgType) { el.innerHTML = mbtiSvg(svgType); }
function paintLpq() {
  var done = lpqStep >= 4;
  $("lpq-q-view").hidden = done; $("lpq-r-view").hidden = !done;
  $("lpq-fill").style.width = (done ? 100 : (lpqStep + 1) * 25) + "%";
  $("lpq-count").textContent = (done ? 4 : lpqStep + 1) + " / 4";
  if (!done) {
    var n = lpqStep + 1;
    $("lpq-step").textContent = t("lpq_q", { n: n });
    $("lpq-title").textContent = t("mbti_q" + n);
    $("lpq-a-t").textContent = t("mbti_q" + n + "a"); lpqSet($("lpq-a-av"), LPQ_PICS[lpqStep][0]);
    $("lpq-b-t").textContent = t("mbti_q" + n + "b"); lpqSet($("lpq-b-av"), LPQ_PICS[lpqStep][1]);
    $("lpq-prev").style.visibility = lpqStep ? "visible" : "hidden";
    return;
  }
  var ty = lpqAns.join("");
  try { localStorage.setItem(LPQ_KEY, ty); } catch (e) {}
  var mini = $("lpq-mini"); mini.textContent = "";
  MBTI_TYPES.forEach(function (x) { var a = mbtiAvatar(x); if (x !== ty) a.classList.add("dim"); mini.appendChild(a); });
  lpqSet($("lpq-big"), ty);
  $("lpq-code").textContent = ty;
  $("lpq-name").textContent = mbtiName(ty);
  $("lpq-desc").textContent = t("mbti_d_" + ty);
}
function openLpq() {
  lpqLastFocus = document.activeElement;
  lpqStep = 0; lpqAns = [];
  $("lpq").hidden = false; document.body.classList.add("lpq-open");
  document.querySelector(".lpq-sheet").setAttribute("aria-label", t("lpq_kicker"));
  paintLpq();
  setTimeout(function () { try { $("lpq-a").focus(); } catch (e) {} }, 60);
}
function closeLpq() {
  $("lpq").hidden = true; document.body.classList.remove("lpq-open");
  try { (lpqLastFocus || $("lpq-start")).focus(); } catch (e) {}
}
function lpqAnswer(i) {
  var btn = i ? $("lpq-b") : $("lpq-a");
  btn.classList.add("picked");
  setTimeout(function () {
    btn.classList.remove("picked");
    lpqAns[lpqStep] = MBTI_Q[lpqStep][i];
    lpqStep++;
    paintLpq();
    try { (lpqStep >= 4 ? $("lpq-join") : $("lpq-a")).focus(); } catch (e) {}
  }, 160);
}

$("lpq-start").onclick = openLpq;
$("lpq-close").onclick = closeLpq;
$("lpq-a").onclick = function () { lpqAnswer(0); };
$("lpq-b").onclick = function () { lpqAnswer(1); };
$("lpq-prev").onclick = function () { if (lpqStep > 0) { lpqStep--; lpqAns.length = lpqStep; paintLpq(); } };
$("lpq-again").onclick = function () { lpqStep = 0; lpqAns = []; paintLpq(); try { $("lpq-a").focus(); } catch (e) {} };
$("lpq-join").onclick = function () { closeLpq(); if (typeof goAuth === "function") goAuth("signup"); };
$("lpq").addEventListener("click", function (e) { if (e.target === this) closeLpq(); });   // clic à côté de la fenêtre
document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("lpq").hidden) closeLpq(); });
$("lang").addEventListener("change", function () { paintLpqGrid(); if (!$("lpq").hidden) paintLpq(); });

paintLpqGrid();
