# ArXiv Summarizer (Chrome Extension – MV3)

Summarize arXiv papers into 1–3 tight paragraphs that capture problem, contributions, methods, key results, and limitations. Uses ar5iv.org for clean HTML (no PDF parsing), and OpenAI Chat Completions for summarization.

## Install

1. Clone or download this folder.
2. Go to `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select this `arxiv-summarizer` folder.
4. Open the **Options** page and paste your **OpenAI API key**. Pick a model (default: `gpt-5-mini-2025-08-07`).

## Use

- Navigate to an arXiv paper (e.g., `https://arxiv.org/abs/...`).
- Click the extension icon → **Summarize current paper**.
- Or right-click anywhere → **Summarize this arXiv paper**.

## Notes

- We fetch the HTML from `https://ar5iv.org/html/<arxivId>`.
- We lightly clean out figures/tables/bibliography to save tokens and keep text focused.
- Text is truncated to ~15k chars by default (adjust in `summarizer.js`).
- If you need $0 infra, swap `callOpenAI` with a local model (Ollama) or a free HF endpoint.

## Privacy

- Your API key is stored in Chrome sync storage.
- Paper text is sent to your selected LLM provider for summarization.

## Troubleshooting

- If the popup shows an error about key/model, set them in **Options**.
- If you get API 401/429/500 errors, check billing/quota and model name.
