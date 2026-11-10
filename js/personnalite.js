// Personnalité MBTI (16 types) : choix dans le profil, petit test de 4 questions,
// et un petit personnage dessiné pour chaque type (dessins originaux de Jade).
// Colonne Supabase : profiles.mbti (fichier sql/personnalite-activite.sql).

var MBTI_TYPES = ["INTJ", "INTP", "ENTJ", "ENTP", "INFJ", "INFP", "ENFJ", "ENFP",
                  "ISTJ", "ISFJ", "ESTJ", "ESFJ", "ISTP", "ISFP", "ESTP", "ESFP"];

// Couleur du personnage selon la famille : analystes (NT), diplomates (NF), sentinelles (SJ), explorateurs (SP)
function mbtiFamily(type) {
  if (type[1] === "N") return type[2] === "T" ? "nt" : "nf";
  return type[3] === "J" ? "sj" : "sp";
}
var MBTI_COLORS = { nt: "#c3c4ec", nf: "#f4cbc0", sj: "#ecd0b4", sp: "#cfe0c8" };

// Le petit personnage : une boule douce avec un visage, et un accessoire propre à chaque type
function mbtiSvg(type) {
  if (MBTI_TYPES.indexOf(type) === -1) return "";
  var ink = "#1f1c1b", c = MBTI_COLORS[mbtiFamily(type)];
  var s = 'stroke="' + ink + '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
  var closedEyes = type === "INFJ";
  var armsUp = type === "ENFP" || type === "ESFP";
  var out = [];
  // pieds, corps
  out.push('<ellipse cx="25" cy="56.5" rx="4.2" ry="2.2" fill="' + c + '" ' + s + '/>');
  out.push('<ellipse cx="39" cy="56.5" rx="4.2" ry="2.2" fill="' + c + '" ' + s + '/>');
  out.push('<path d="M32 15c-12 0-20 9-20 21.5C12 49 20 56 32 56s20-7 20-19.5C52 24 44 15 32 15z" fill="' + c + '" ' + s + '/>');
  // bras
  if (armsUp) out.push('<path d="M14 33q-5-3-6-8M50 33q5-3 6-8" fill="none" ' + s + '/>');
  else out.push('<path d="M13.5 40q-4 1-5 4.5M50.5 40q4 1 5 4.5" fill="none" ' + s + '/>');
  // yeux
  if (type === "ESTP") {
    out.push('<rect x="21.5" y="31" width="9" height="6" rx="2.5" fill="' + ink + '"/><rect x="33.5" y="31" width="9" height="6" rx="2.5" fill="' + ink + '"/><path d="M30.5 33h3" ' + s + '/>');
  } else if (closedEyes) {
    out.push('<path d="M23.5 34q2.5 2.4 5 0M35.5 34q2.5 2.4 5 0" fill="none" ' + s + '/>');
  } else {
    out.push('<circle cx="26" cy="34" r="2" fill="' + ink + '"/><circle cx="38" cy="34" r="2" fill="' + ink + '"/>');
    out.push('<circle cx="26.7" cy="33.3" r=".6" fill="#fff"/><circle cx="38.7" cy="33.3" r=".6" fill="#fff"/>');
  }
  // joues, bouche
  out.push('<ellipse cx="21.5" cy="39.5" rx="2.7" ry="1.6" fill="#ef9f95" opacity=".75"/><ellipse cx="42.5" cy="39.5" rx="2.7" ry="1.6" fill="#ef9f95" opacity=".75"/>');
  if (armsUp || type === "ENTP") out.push('<path d="M29 39q3 4.2 6 0z" fill="' + ink + '" ' + s + '/>');
  else out.push('<path d="M29.5 39.2q2.5 2.4 5 0" fill="none" ' + s + '/>');
  // accessoires
  var a = {
    INTJ: '<circle cx="26" cy="34" r="4.3" fill="none" ' + s + '/><circle cx="38" cy="34" r="4.3" fill="none" ' + s + '/><path d="M30.3 34h3.4" ' + s + '/>',
    INTP: '<circle cx="45" cy="16" r="1.4" fill="#fff" ' + s + '/><circle cx="51" cy="9.5" r="5.6" fill="#fff" ' + s + '/><path d="M49.2 8q1.8-2.2 3.6 0 0 1.6-1.8 2.6v1" fill="none" ' + s + '/><circle cx="51" cy="13.4" r=".5" fill="' + ink + '"/>',
    ENTJ: '<path d="M24.5 16.5l2-7 5.5 4.5 5.5-4.5 2 7z" fill="#e3b960" ' + s + '/>',
    ENTP: '<circle cx="51" cy="10" r="4.8" fill="#fff1bf" ' + s + '/><path d="M49.2 15.5h3.6M49.6 17.6h2.8M51 2.5v-1M44.5 5l-1-1M57.5 5l1-1" fill="none" ' + s + '/>',
    INFJ: '<path d="M54 4.5a6.5 6.5 0 1 0 0 11.5 5.2 5.2 0 1 1 0-11.5z" fill="#f3dfd5" ' + s + '/>',
    INFP: '<g ' + s + ' fill="#fff"><circle cx="21" cy="14" r="2.6"/><circle cx="26" cy="13" r="2.6"/><circle cx="27" cy="18" r="2.6"/><circle cx="22.5" cy="19.5" r="2.6"/><circle cx="19.5" cy="17" r="2.6"/></g><circle cx="23.3" cy="16.3" r="1.9" fill="#e3b960" ' + s + '/>',
    ENFJ: '<path d="M32 53.5s-4.6-2.9-4.6-5.9a2.3 2.3 0 0 1 4.6-.9 2.3 2.3 0 0 1 4.6.9c0 3-4.6 5.9-4.6 5.9z" fill="#e2786b" ' + s + '/>',
    ENFP: '<path d="M9 13l1.2 3 3 1.2-3 1.2L9 21.5l-1.2-3.1-3-1.2 3-1.2zM55 8l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1z" fill="#e3b960" ' + s + '/>',
    ISTJ: '<path d="M27 45l5 2.6-5 2.6zM37 45l-5 2.6 5 2.6z" fill="#5b5d92" ' + s + '/><circle cx="32" cy="47.6" r="1.2" fill="#5b5d92" ' + s + '/>',
    ISFJ: '<path d="M17.5 42.5q14.5 6 29 0l.5 4q-15 6.5-30 0z" fill="#e8a598" ' + s + '/><path d="M40 46.5l2 7 3-1.5-1-6" fill="#e8a598" ' + s + '/>',
    ESTJ: '<rect x="50.5" y="37" width="9" height="12" rx="1.5" fill="#fff" ' + s + '/><path d="M53 41h4M53 44h4M53 47h2.5" fill="none" ' + s + '/><rect x="53" y="35.5" width="4" height="2.4" rx=".8" fill="#5b5d92" ' + s + '/>',
    ESFJ: '<path d="M55.5 44q-1.5-8 1-14" fill="none" ' + s + '/><ellipse cx="57" cy="12" rx="5" ry="6" fill="#e2786b" ' + s + '/><path d="M56.2 18.2l.8 1.6.8-1.6M57 19.8q-2 5 0 10" fill="none" ' + s + '/>',
    ISTP: '<path d="M51.5 48l5-9" stroke="' + ink + '" stroke-width="2.4" stroke-linecap="round"/><path d="M53.2 35.2l7.4 4.1-1.7 3-7.4-4.1z" fill="#c9c6c2" ' + s + '/>',
    ISFP: '<path d="M19.5 18.5q12.5-10 25 0q-12.5 3.5-25 0z" fill="#b5603f" ' + s + '/><path d="M32 10.2v-2" ' + s + '/><path d="M51.5 47l5-8" ' + s + '/><path d="M55.6 40.3l1.5-3.3 1.7 1.4z" fill="#5b5d92" ' + s + '/>',
    ESTP: '<path d="M18 23q14-12 28 0z" fill="#5b5d92" ' + s + '/><path d="M46 23l8 1" ' + s + '/>',
    ESFP: '<path d="M27.5 16.5L32 4l4.5 12.5z" fill="#e3b960" ' + s + '/><circle cx="32" cy="3.8" r="1.8" fill="#e2786b" ' + s + '/><path d="M10 10l2 1M52 6l1.5-1.5M56 18l2 .5M8 22l1.5-1" stroke="#b5603f" stroke-width="2" stroke-linecap="round"/>'
  };
  out.push(a[type] || "");
  return '<svg class="mbti-svg" viewBox="0 0 64 64" aria-hidden="true">' + out.join("") + '</svg>';
}

function mbtiName(type) { return t("mbti_n_" + type); }
function mbtiLabel(type) { return type + " · " + mbtiName(type); }
function mbtiAvatar(type, cls) {
  var s = document.createElement("span"); s.className = "mbti-av" + (cls ? " " + cls : ""); s.innerHTML = mbtiSvg(type); return s;
}

// ---------- Dans le formulaire du profil : grille des 16 personnages ----------
var mbtiChoice = "";
function paintMbtiGrid() {
  var g = $("mbti-grid"); if (!g) return;
  g.textContent = "";
  var none = document.createElement("button"); none.type = "button"; none.className = "mbti-opt none";
  none.setAttribute("aria-pressed", mbtiChoice === "" ? "true" : "false");
  none.textContent = t("mbti_none");
  none.onclick = function () { setMbti(""); };
  MBTI_TYPES.forEach(function (ty) {
    var b = document.createElement("button"); b.type = "button"; b.className = "mbti-opt " + mbtiFamily(ty);
    b.setAttribute("aria-pressed", mbtiChoice === ty ? "true" : "false");
    b.appendChild(mbtiAvatar(ty));
    var code = document.createElement("b"); code.textContent = ty; b.appendChild(code);
    var nm = document.createElement("span"); nm.textContent = mbtiName(ty); b.appendChild(nm);
    b.onclick = function () { setMbti(ty); };
    g.appendChild(b);
  });
  g.appendChild(none);
  var d = $("mbti-desc");
  d.textContent = mbtiChoice ? mbtiLabel(mbtiChoice) + " — " + t("mbti_d_" + mbtiChoice) : "";
}
function setMbti(ty) { mbtiChoice = MBTI_TYPES.indexOf(ty) !== -1 ? ty : ""; paintMbtiGrid(); }

// ---------- Le petit test : 4 questions, une par dimension ----------
var MBTI_Q = [["E", "I"], ["S", "N"], ["T", "F"], ["J", "P"]];
var mbtiStep = 0, mbtiAns = [];
function paintQuiz() {
  if (mbtiStep >= 4) {
    var ty = mbtiAns.join("");
    setMbti(ty);
    $("mbti-q").textContent = t("mbti_result", { t: mbtiLabel(ty) });
    $("mbti-a").hidden = true; $("mbti-b").hidden = true;
    $("mbti-step").textContent = "";
    $("mbti-again").hidden = false;
    return;
  }
  $("mbti-q").textContent = t("mbti_q" + (mbtiStep + 1));
  $("mbti-a").textContent = t("mbti_q" + (mbtiStep + 1) + "a"); $("mbti-a").hidden = false;
  $("mbti-b").textContent = t("mbti_q" + (mbtiStep + 1) + "b"); $("mbti-b").hidden = false;
  $("mbti-step").textContent = (mbtiStep + 1) + " / 4";
  $("mbti-again").hidden = true;
}
function startQuiz() { mbtiStep = 0; mbtiAns = []; $("mbti-quiz").hidden = false; paintQuiz(); }
$("mbti-quiz-btn").onclick = startQuiz;
$("mbti-again").onclick = startQuiz;
$("mbti-a").onclick = function () { mbtiAns.push(MBTI_Q[mbtiStep][0]); mbtiStep++; paintQuiz(); };
$("mbti-b").onclick = function () { mbtiAns.push(MBTI_Q[mbtiStep][1]); mbtiStep++; paintQuiz(); };
$("lang").addEventListener("change", function () { paintMbtiGrid(); if (!$("mbti-quiz").hidden) paintQuiz(); });

// Remplir le formulaire avec la personnalité enregistrée
var _fillFormMbti = fillForm;
fillForm = function (p) {
  var r = _fillFormMbti.apply(this, arguments);
  mbtiChoice = (p && MBTI_TYPES.indexOf(p.mbti) !== -1) ? p.mbti : "";
  $("mbti-quiz").hidden = true;
  paintMbtiGrid();
  return r;
};

// ---------- Affichage sur les profils ----------
var _tagsIntoMbti = tagsInto;
tagsInto = function (el, p) {
  var r = _tagsIntoMbti.apply(this, arguments);
  if (p && MBTI_TYPES.indexOf(p.mbti) !== -1) {
    var tag = document.createElement("span"); tag.className = "tag mbti " + mbtiFamily(p.mbti);
    tag.title = t("mbti_d_" + p.mbti);
    tag.appendChild(mbtiAvatar(p.mbti, "sm"));
    tag.appendChild(document.createTextNode(mbtiLabel(p.mbti)));
    el.insertBefore(tag, el.firstChild);
  }
  return r;
};
// Sur les cartes de l'accueil : le petit personnage à côté du prénom
var _feedCardMbti = feedCard;
feedCard = function (p) {
  var card = _feedCardMbti.apply(this, arguments);
  if (p && MBTI_TYPES.indexOf(p.mbti) !== -1) {
    var n = card.querySelector(".fname");
    if (n) { var av = mbtiAvatar(p.mbti, "card"); av.title = mbtiLabel(p.mbti); n.appendChild(av); }
  }
  return card;
};
