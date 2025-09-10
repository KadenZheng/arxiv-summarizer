// summarizer.js (Perplexity API)
// Utilities to extract arXiv ID, build messages, and call Perplexity chat completions.

function getArxivIdFromUrl(url) {
  const m1 = url.match(/arxiv\.org\/abs\/([\w.\-\/]+)/i);
  if (m1) return m1[1];
  const m2 = url.match(/arxiv\.org\/pdf\/([\w.\-\/]+)\.pdf/i);
  if (m2) return m2[1];
  return null;
}

function getPdfUrlFromAnyArxivUrl(url) {
  const id = getArxivIdFromUrl(url);
  if (!id) return null;
  return `https://arxiv.org/pdf/${id}.pdf`;
}

function buildSystemPrompt() {
  return "You are summarizing for a reader well-versed in ML and mechanistic interpretability. Do not explain basic concepts (e.g., LLMs, attention, SAEs, probes). Produce a dense 1–3 paragraph summary in plain text (no bullets), prioritizing concrete technical details over generic exposition. Keep tone precise and non-promotional; avoid quotes, citations, or section numbers.";
}

function buildUserPromptForPdf(pdfUrl) {
  return `Read the PDF at this URL and write a concise 1–3 paragraph summary for an expert audience (no bullets). Focus on:

- Problem framing (briefly) and why it matters
- Precise contributions (what is actually novel)
- Methodology details: features/circuits/SAEs/probes/attribution/interventions as applicable; model(s) and scale; datasets/benchmarks; training/eval setup if central
- Key empirical findings with concrete specifics (numbers, datasets, model sizes) when present
- Limitations, assumptions, failure modes, or threats to validity

Skip defining standard terms. Prefer specifics over exposition. Avoid fluff, quotes, citations, and section numbers.

PDF URL: ${pdfUrl}`;
}

async function getApiConfig() {
  return new Promise(resolve => {
    chrome.storage.sync.get(["PERPLEXITY_API_KEY", "PERPLEXITY_MODEL"], (cfg) => {
      resolve({
        apiKey: cfg.PERPLEXITY_API_KEY || "",
        model: (cfg.PERPLEXITY_MODEL || "sonar").trim()
      });
    });
  });
}

async function callPerplexity(messages, { apiKey, model }) {
  if (!apiKey) {
    throw new Error("Perplexity API key is not set. Open the extension’s Options page to add it.");
  }

  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Perplexity error ${res.status}: ${errText || res.statusText}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("No response returned by the model.");
  return text;
}

export async function startSummaryConversation(currentUrl) {
  const pdfUrl = getPdfUrlFromAnyArxivUrl(currentUrl);
  if (!pdfUrl) throw new Error("Couldn’t detect an arXiv ID on this page.");

  const apiCfg = await getApiConfig();
  const messages = [
    { role: "system", content: buildSystemPrompt() },
    { role: "user", content: buildUserPromptForPdf(pdfUrl) }
  ];
  const reply = await callPerplexity(messages, apiCfg);
  return { messages: [...messages, { role: "assistant", content: reply }], reply };
}

export async function continueConversation(messages) {
  const apiCfg = await getApiConfig();
  const reply = await callPerplexity(messages, apiCfg);
  return reply;
}

export { getArxivIdFromUrl, getPdfUrlFromAnyArxivUrl };


