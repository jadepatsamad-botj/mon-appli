// Signaler ou bloquer quelqu'un

// ---------- Signaler / bloquer ----------
var reportTarget = null, reportReturn = "home";

function openReport(p, ret) {
  reportTarget = p; reportReturn = ret;
  $("report-name").textContent = p.first_name;
  $("report-reason").value = ""; $("report-details").value = "";
  say($("rmsg"), "", "");
  showSection("report");
}
$("cand-report").onclick = function () { if (candidate) openReport(candidate, "discover"); };
$("chat-report").onclick = function () { if (chatWith) openReport(chatWith, "chat"); };
$("report-back").onclick = function () { showSection(reportReturn); };

$("report-form").addEventListener("submit", async function (e) {
  e.preventDefault();
  if (!$("report-reason").value) return say($("rmsg"), t("e_reason"), "err");
  $("report-send").disabled = true;
  var r = await db.from("reports").insert({
    reporter_id: currentUser.id, reported_id: reportTarget.id,
    reason: $("report-reason").value, details: $("report-details").value.trim() || null
  });
  if (r.error) say($("rmsg"), t("e_send") + r.error.message, "err");
  else {
    say($("rmsg"), t("ok_report"), "ok");
    setTimeout(function () { if (!$("report").hidden) showSection(reportReturn); }, 2200);
  }
  $("report-send").disabled = false;
});

$("chat-block").onclick = async function () {
  if (!chatWith) return;
  if (!confirm(t("block_confirm", { name: chatWith.first_name }))) return;
  var r = await db.from("blocks").insert({ blocker_id: currentUser.id, blocked_id: chatWith.id });
  if (r.error) return say($("cmsg"), t("e_block") + r.error.message, "err");
  chatWith = null;
  showSection("matches"); loadMatches();
};
