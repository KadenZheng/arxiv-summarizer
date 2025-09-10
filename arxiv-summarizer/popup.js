// popup.js
const summarizeBtn = document.getElementById("summarizeBtn");
const statusEl = document.getElementById("status");
const summaryEl = document.getElementById("summary");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");

function setStatus(msg) {
  statusEl.textContent = msg || "";
}

function setSummary(text) {
  summaryEl.textContent = text || "";
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "SUMMARY_READY") {
    setStatus("");
    setSummary(msg.summary || "");
  }
  if (msg?.type === "CHAT_UPDATED") {
    renderChat(msg.messages || []);
    if (msg.messages?.length) {
      const last = msg.messages[msg.messages.length - 1];
      if (last?.role === "assistant") {
        setStatus("");
        setSummary(last.content || "");
      }
    }
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

// On popup open, load existing chat if any
chrome.runtime.sendMessage({ type: "GET_CHAT" }, (r) => {
  if (r?.messages) {
    renderChat(r.messages);
  }
});

function renderChat(messages) {
  chatMessages.innerHTML = "";
  messages.forEach(m => {
    const div = document.createElement("div");
    div.style.margin = "6px 0";
    div.textContent = `${m.role === "user" ? "You" : "Assistant"}: ${m.content}`;
    chatMessages.appendChild(div);
  });
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = (chatInput.value || "").trim();
  if (!text) return;
  chatInput.value = "";
  setStatus("Thinking…");
  const resp = await chrome.runtime.sendMessage({ type: "FOLLOW_UP", content: text });
  if (!resp?.ok) {
    setStatus(resp?.error || "Follow-up failed.");
  }
});


