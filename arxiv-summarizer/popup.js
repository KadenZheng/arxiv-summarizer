// popup.js
const summarizeBtn = document.getElementById("summarizeBtn");
const statusEl = document.getElementById("status");
const summaryEl = document.getElementById("summary");
const followupInput = document.getElementById("followupInput");
const askBtn = document.getElementById("askBtn");
const answerEl = document.getElementById("answer");

function setStatus(msg) {
  statusEl.textContent = msg || "";
}

function setSummary(text) { summaryEl.textContent = text || ""; }
function setAnswer(text) { answerEl.textContent = text || ""; }

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "SUMMARY_READY") {
    setStatus("");
    setSummary(msg.summary || "");
  }
});

summarizeBtn.addEventListener("click", async () => {
  setSummary("");
  setStatus("Summarizing…");
  const resp = await chrome.runtime.sendMessage({ type: "SUMMARIZE_ACTIVE_TAB" });
  if (!resp?.ok) {
    setStatus(resp?.error || "Could not start summarization.");
    return;
  }
  // Try to show the last known summary immediately
  chrome.runtime.sendMessage({ type: "GET_LAST_SUMMARY" }, (r) => {
    if (r?.summary) {
      setStatus("");
      setSummary(r.summary);
    }
  });
});

askBtn?.addEventListener("click", async () => {
  const q = (followupInput?.value || "").trim();
  if (!q) return;
  setStatus("Answering…");
  setAnswer("");
  try {
    const resp = await chrome.runtime.sendMessage({ type: "ASK_FOLLOWUP", question: q });
    if (!resp?.ok) {
      setStatus(resp?.error || "Could not answer question.");
      return;
    }
    setStatus("");
    setAnswer(resp.answer || "");
  } catch (e) {
    setStatus(String(e?.message || e));
  }
});


