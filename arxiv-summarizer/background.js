// background.js (MV3 service worker; ES module)
import { startSummaryConversation, continueConversation } from "./summarizer.js";

let lastSummary = null;
let lastSourceUrl = null;
let conversationMessages = null; // Array of {role, content}

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

  if (message?.type === "GET_CHAT") {
    sendResponse({ ok: true, messages: conversationMessages || [], sourceUrl: lastSourceUrl });
    return true;
  }

  if (message?.type === "FOLLOW_UP" && typeof message.content === "string") {
    (async () => {
      try {
        if (!conversationMessages || conversationMessages.length === 0) {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!activeTab?.url) {
            sendResponse({ ok: false, error: "No active tab URL." });
            return;
          }
          // Initialize if needed
          const { messages, reply } = await startSummaryConversation(activeTab.url);
          conversationMessages = messages;
          lastSummary = reply;
          lastSourceUrl = activeTab.url;
          chrome.runtime.sendMessage({ type: "CHAT_UPDATED", messages: conversationMessages, sourceUrl: lastSourceUrl });
        }

        conversationMessages.push({ role: "user", content: message.content });
        const reply = await continueConversation(conversationMessages);
        conversationMessages.push({ role: "assistant", content: reply });
        lastSummary = reply;
        chrome.runtime.sendMessage({ type: "CHAT_UPDATED", messages: conversationMessages, sourceUrl: lastSourceUrl });
        sendResponse({ ok: true });
      } catch (e) {
        const err = e?.message || String(e);
        sendResponse({ ok: false, error: err });
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

    // Emit a "working" update
    chrome.runtime.sendMessage({ type: "SUMMARY_READY", summary: "Working… summarizing via Perplexity.", sourceUrl: url });

    const { messages, reply } = await startSummaryConversation(url);
    conversationMessages = messages;
    lastSummary = reply;
    lastSourceUrl = url;

    chrome.runtime.sendMessage({ type: "CHAT_UPDATED", messages, sourceUrl: url });
  } catch (e) {
    const err = e?.message || String(e);
    lastSummary = `Error: ${err}`;
    chrome.runtime.sendMessage({ type: "SUMMARY_READY", summary: lastSummary, sourceUrl: knownUrl || null });
  }
}


