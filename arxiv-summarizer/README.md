# ArXiv Summarizer (Chrome Extension – MV3)

Summarize arXiv papers into 1–3 tight paragraphs that capture problem, contributions, methods, key results, and limitations. Uses Perplexity Chat Completions with the `sonar` model, which can browse and read PDFs directly, so you can point it to an arXiv PDF like `https://arxiv.org/pdf/<id>.pdf`.

## Install

1. Clone or download this folder.
2. Go to `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select this `arxiv-summarizer` folder.
4. Open the **Options** page and paste your **Perplexity API key**. Pick a model (default: `sonar`).

## Use

- Navigate to an arXiv paper (e.g., `https://arxiv.org/abs/...`).
- Click the extension icon → **Summarize current paper**.
- Or right-click anywhere → **Summarize this arXiv paper**.

## Notes

- We pass the arXiv PDF URL (e.g., `https://arxiv.org/pdf/<id>.pdf`) to Perplexity so it can read it directly.
- A follow-up chat UI in the popup lets you ask clarifying questions using the same conversation.

## Privacy

- Your API key is stored in Chrome sync storage.
- The PDF URL is sent to Perplexity’s API for summarization and follow-up.

## Troubleshooting

- If the popup shows an error about key/model, set them in **Options**.
- If you get API 401/429/500 errors, check billing/quota and model name.


