# ArXiv Summarizer (Chrome Extension – MV3)

This extension turns any arXiv paper into a short, high‑signal summary right from your browser. It fetches the paper’s HTML from ar5iv.org (clean, readable HTML that mirrors arXiv), trims boilerplate like figures and references, and sends just the useful text to an LLM to produce a 1–3 paragraph synopsis.

Setup is lightweight. Load the folder in chrome://extensions (Developer mode → Load unpacked). You can provide API keys in three ways: a simple `.env` file shipped alongside the extension (preferred), an optional `env.json`, or via the Options page. If a key is present in `.env`/`env.json`, the extension will use it automatically; otherwise, it falls back to what you saved in the Options UI. By default, the model is `gpt-5-mini-2025-08-07`.

Using it is straightforward. Open an arXiv paper (abs/pdf), click the extension icon, and choose “Summarize current paper.” The popup will show a concise explanation of the core problem, concrete contributions, high‑level methods, and the most important results or limitations. There’s also a follow‑up box to ask targeted questions about the same paper context, so you can quickly dig into details without pasting anything.

Under the hood, the extension pulls text from `https://ar5iv.org/html/<arxivId>`, lightly cleans it, and limits the size to a safe threshold. If the text is long, it splits it into overlapping chunks, summarizes each chunk, and merges the partials into one cohesive answer that avoids repetition. The extension supports both OpenAI and Perplexity; if Perplexity credentials are provided, it will use Perplexity’s chat completions endpoint, otherwise it uses OpenAI’s chat completions. All requests are made directly from the extension; your keys never leave the browser.

If something goes wrong, the popup will show the error returned by the provider (for example, an invalid API key or model name). You can adjust the default model or paste a different key in `.env`, `env.json`, or the Options page and reload the extension.
