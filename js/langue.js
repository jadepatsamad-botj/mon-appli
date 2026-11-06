// Choix de la langue et traduction des textes (fonction t)

var LANGS = ["fr", "en", "th", "vi", "zh", "id", "ja", "ko", "ms", "tl", "lo", "km"];
var lang = "fr";
try { var saved = localStorage.getItem("lang"); if (LANGS.indexOf(saved) !== -1) lang = saved; else throw 0; }
catch (e) {
  var nav = ((navigator.language || "en") + "").slice(0, 2).toLowerCase();
  if (((navigator.language || "") + "").toLowerCase().indexOf("fil") === 0) nav = "tl";
  lang = LANGS.indexOf(nav) !== -1 ? nav : "en";
}

function t(key, vars) {
  var s = (I18N[lang] && I18N[lang][key]);
  if (s === undefined) s = I18N.fr[key];
  if (s === undefined) return key;
  if (vars) Object.keys(vars).forEach(function (k) { s = s.split("{" + k + "}").join(vars[k]); });
  return s;
}
function countryLabel(v) {
  var i = COUNTRY_KEYS.indexOf(v);
  return i === -1 ? v : (I18N[lang].countries[i] || v);
}
