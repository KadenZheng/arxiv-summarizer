// background.js (MV3 service worker; ES module)
import { summarizeFromArxivUrl, answerFollowupFromArxivUrl } from "./summarizer.js";

let lastSummary = null;
let lastSourceUrl = null;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "summarizeArxiv",
    title: "Summarize this arXiv paper",
    contexts: ["page"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "summarizeArxiv" && tab && tab.id) {
    startSummarizationForTab(tab.id);
  }
});

// Toolbar popup asks us to summarize the active tab.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "SUMMARIZE_ACTIVE_TAB") {
    (async () => {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab?.id || !activeTab?.url) {
        sendResponse({ ok: false, error: "No active tab or URL." });
        return;
      }
      sendResponse({ ok: true, started: true });
      startSummarizationForTab(activeTab.id, activeTab.url);
    })();
    return true; // keep the message channel open for async
  }

  if (message?.type === "GET_LAST_SUMMARY") {
    sendResponse({ ok: true, summary: lastSummary, sourceUrl: lastSourceUrl });
    return true;
  }

  if (message?.type === "ASK_FOLLOWUP") {
    (async () => {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab?.id || !activeTab?.url) {
        sendResponse({ ok: false, error: "No active tab or URL." });
        return;
      }
      try {
        const answer = await answerFollowupFromArxivUrl(activeTab.url, message.question || "");
        sendResponse({ ok: true, answer });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  return false;
});

async function startSummarizationForTab(tabId, knownUrl) {
  try {
    const tab = knownUrl
      ? { url: knownUrl }
      : (await chrome.tabs.get(tabId));

    const url = tab?.url || "";
    if (!/arxiv\.org\/(abs|pdf)\//i.test(url)) {
      lastSummary = "This doesn’t look like an arXiv paper page.";
      lastSourceUrl = url || null;
      chrome.runtime.sendMessage({ type: "SUMMARY_READY", summary: lastSummary, sourceUrl: lastSourceUrl });
      return;
    }

    // Emit a "working" update (optional)
    chrome.runtime.sendMessage({ type: "SUMMARY_READY", summary: "Working… fetching paper text and summarizing.", sourceUrl: url });

    const summary = await summarizeFromArxivUrl(url);
    lastSummary = summary;
    lastSourceUrl = url;

    chrome.runtime.sendMessage({ type: "SUMMARY_READY", summary, sourceUrl: url });
  } catch (e) {
    const err = e?.message || String(e);
    lastSummary = `Error: ${err}`;
    chrome.runtime.sendMessage({ type: "SUMMARY_READY", summary: lastSummary, sourceUrl: knownUrl || null });
  }
}

