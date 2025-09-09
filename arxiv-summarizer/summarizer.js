// summarizer.js
// Utilities to extract arXiv ID, fetch ar5iv HTML -> text, build prompt, and call OpenAI.

// Optional: Hardcode your OpenAI API key/model here to bypass the Options page.
// Leave the key empty to use the Options-saved values instead.
const HARDCODED_OPENAI_API_KEY = "REDACTED"; // Paste your key here, e.g., "sk-..."
const HARDCODED_OPENAI_MODEL = "gpt-5-mini-2025-08-07"; // Optional override when hardcoding
// Optional: Perplexity API support (https://api.perplexity.ai/chat/completions)
// If set, the extension will prefer Perplexity; leave empty to use OpenAI instead.
const HARDCODED_PERPLEXITY_API_KEY = "REDACTED"; // e.g., "pplx-..."
const HARDCODED_PERPLEXITY_MODEL = "sonar-pro"; // e.g., sonar-pro, sonar-small-chat

function getArxivIdFromUrl(url) {
  try {
    const u = new URL(url);
    let path = u.pathname || "";
    // Handle /abs/<id> and /pdf/<id>[.pdf]
    if (path.startsWith("/abs/")) {
      path = path.slice(5);
    } else if (path.startsWith("/pdf/")) {
      path = path.slice(5);
      path = path.replace(/\.pdf$/i, "");
    } else {
      // Not an arXiv abs/pdf path
      const m = url.match(/arxiv\.org\/(?:abs|pdf)\/([^?#]+)/i);
      if (m && m[1]) {
        return m[1].replace(/\.pdf$/i, "").replace(/\/$/, "");
      }
      return null;
    }
    return decodeURIComponent(path.replace(/\/$/, ""));
  } catch (_e) {
    // Fallback regex if URL constructor fails
    const m = url.match(/arxiv\.org\/(?:abs|pdf)\/([^?#]+)/i);
    if (m && m[1]) return m[1].replace(/\.pdf$/i, "").replace(/\/$/, "");
    return null;
  }
}

async function fetchAr5ivPlainText(arxivId) {
  const ar5url = `https://ar5iv.org/html/${arxivId}`;
  const res = await fetch(ar5url, { credentials: "omit" });
  if (!res.ok) throw new Error(`Failed to fetch ar5iv HTML (${res.status})`);
  const html = await res.text();

  // Parse using DOMParser when available (service workers support it)
  try {
    const parser = typeof DOMParser !== "undefined" ? new DOMParser() : null;
    if (parser) {
      const doc = parser.parseFromString(html, "text/html");
      const root = doc.querySelector("#content") || doc.body || doc;
      // Remove heavy/irrelevant sections to save tokens
      root.querySelectorAll?.("nav, footer, .ltx_bibliography, .ltx_note, .ltx_Figure, .ltx_table").forEach(el => el.remove());
      const text = (root.innerText || root.textContent || "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      return text.slice(0, 60000);
    }
  } catch (_) {
    // fall through to regex-based text extraction
  }

  // Fallback: strip tags and try to isolate #content manually
  const contentMatch = html.match(/<div[^>]*id=["']content["'][^>]*>([\s\S]*?)<\/div>/i);
  const bodyHtml = (contentMatch?.[1] || html)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");
  const withNewlines = bodyHtml
    .replace(/<\/(p|div|section|br|li|h\d)>/gi, "\n")
    .replace(/<li>/gi, "- ")
    .replace(/<[^>]+>/g, "");
  return withNewlines.replace(/\n{3,}/g, "\n\n").trim().slice(0, 60000);
}

function buildPrompt(pageText, pageUrl) {
  return `
You are a concise scientific paper summarizer. Summarize the following arXiv paper into 1–3 tight paragraphs (no bullets), capturing:

- Core problem & why it matters
- Main contributions (be specific)
- Key methodology (what was actually done)
- Most important results/findings and any limitations
- Notable datasets, benchmarks, or settings if relevant

Avoid fluff. Prefer concrete details. Do not include citations, section numbers, or quotes. If the paper is qualitative, reflect that. Use only the provided text; do not ask for more content or mention browsing. Assume the reader is well-versed in LLMs and mechanistic interpretability; skip basic explanations and definitions.

Paper URL: ${pageUrl}

--- BEGIN PAPER TEXT ---
${pageText}
--- END PAPER TEXT ---
`;
}

function buildFollowupPrompt(pageText, pageUrl, question) {
  return `
You are answering a technical follow-up question about the following arXiv paper. Provide a concise, expert-level answer (1–2 tight paragraphs) that focuses on concrete details from the text. Use only the provided text; do not ask for more content or mention browsing. Assume the reader is well-versed in LLMs and mechanistic interpretability; skip basic explanations and definitions.

Paper URL: ${pageUrl}
User question: ${question}

--- BEGIN PAPER TEXT ---
${pageText}
--- END PAPER TEXT ---
`;
}

async function getApiConfig() {
  if ((HARDCODED_OPENAI_API_KEY || "").trim()) {
    return {
      apiKey: HARDCODED_OPENAI_API_KEY.trim(),
      model: (HARDCODED_OPENAI_MODEL || "gpt-5-mini-2025-08-07").trim()
    };
  }
  return new Promise(resolve => {
    chrome.storage.sync.get(["OPENAI_API_KEY", "OPENAI_MODEL"], (cfg) => {
      resolve({
        apiKey: cfg.OPENAI_API_KEY || "",
        model: (cfg.OPENAI_MODEL || "gpt-5-mini-2025-08-07").trim()
      });
    });
  });
}

async function callOpenAI(prompt, { apiKey, model }) {
  if (!apiKey) {
    throw new Error("OpenAI API key is not set. Open the extension’s Options page to add it.");
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "You produce rigorous, succinct scientific summaries in clear paragraph form." },
        { role: "user", content: prompt }
      ]
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenAI error ${res.status}: ${errText || res.statusText}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("No summary returned by the model.");
  return text;
}

// Perplexity API client (OpenAI-like)
async function callPerplexity(prompt, { apiKey, model }) {
  if (!apiKey) {
    throw new Error("Perplexity API key is not set.");
  }

  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "You produce rigorous, succinct scientific summaries in clear paragraph form." },
        { role: "user", content: prompt }
      ]
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Perplexity error ${res.status}: ${errText || res.statusText}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("No summary returned by the Perplexity model.");
  return text;
}

function chunkText(text, size = 20000, overlap = 1500) {
  if (!text || text.length <= size) return [text];
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + size);
    chunks.push(text.slice(start, end));
    if (end === text.length) break;
    start = end - overlap;
    if (start < 0) start = 0;
  }
  return chunks;
}

async function summarizeWithChunking(fullPrompt, clientFn) {
  const textMatch = fullPrompt.match(/--- BEGIN PAPER TEXT ---([\s\S]*?)--- END PAPER TEXT ---/);
  const paperText = (textMatch?.[1] || "").trim();
  if (paperText.length <= 20000) return clientFn(fullPrompt);
  const urlMatch = fullPrompt.match(/Paper URL:\s*(\S+)/);
  const pageUrl = urlMatch?.[1] || "https://arxiv.org";
  const pieces = chunkText(paperText, 20000, 1500);
  const partials = [];
  for (const part of pieces) {
    const p = `Summarize this section into a concise paragraph that preserves concrete details (problem, contributions, methods, results, limitations). URL: ${pageUrl}\n\n--- TEXT ---\n${part}\n--- END ---`;
    partials.push(await clientFn(p));
  }
  const mergePrompt = `Merge the partial paragraphs into 1–3 cohesive paragraphs covering: problem, specific contributions, key methods, important results and any limitations. Avoid repetition and fluff.\n\n--- PARTIALS ---\n${partials.join("\n\n")}\n--- END ---`;
  return clientFn(mergePrompt);
}

export async function summarizeFromArxivUrl(currentUrl) {
  const arxivId = getArxivIdFromUrl(currentUrl);
  if (!arxivId) throw new Error("Couldn’t detect an arXiv ID on this page.");

  const [apiCfg, paperText] = await Promise.all([
    getApiConfig(),
    fetchAr5ivPlainText(arxivId)
  ]);

  const prompt = buildPrompt(paperText, `https://arxiv.org/abs/${arxivId}`);
  if ((HARDCODED_PERPLEXITY_API_KEY || "").trim()) {
    return await summarizeWithChunking(prompt, (p) => callPerplexity(p, {
      apiKey: HARDCODED_PERPLEXITY_API_KEY.trim(),
      model: (HARDCODED_PERPLEXITY_MODEL || "sonar-pro").trim()
    }));
  }
  return await summarizeWithChunking(prompt, (p) => callOpenAI(p, apiCfg));
}

export async function answerFollowupFromArxivUrl(currentUrl, question) {
  const arxivId = getArxivIdFromUrl(currentUrl);
  if (!arxivId) throw new Error("Couldn’t detect an arXiv ID on this page.");

  const paperText = await fetchAr5ivPlainText(arxivId);
  const prompt = buildFollowupPrompt(paperText, `https://arxiv.org/abs/${arxivId}`, question);

  if ((HARDCODED_PERPLEXITY_API_KEY || "").trim()) {
    return await summarizeWithChunking(prompt, (p) => callPerplexity(p, {
      apiKey: HARDCODED_PERPLEXITY_API_KEY.trim(),
      model: (HARDCODED_PERPLEXITY_MODEL || "sonar-pro").trim()
    }));
  }
  const apiCfg = await getApiConfig();
  return await summarizeWithChunking(prompt, (p) => callOpenAI(p, apiCfg));
}

