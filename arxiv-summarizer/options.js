// options.js
const form = document.getElementById("form");
const apiKey = document.getElementById("apiKey");
const model = document.getElementById("model");
const saved = document.getElementById("saved");

function flashSaved(msg) {
  saved.textContent = msg;
  setTimeout(() => (saved.textContent = ""), 2000);
}

chrome.storage.sync.get(["OPENAI_API_KEY", "OPENAI_MODEL"], (cfg) => {
  if (cfg.OPENAI_API_KEY) apiKey.value = cfg.OPENAI_API_KEY;
  if (cfg.OPENAI_MODEL) model.value = cfg.OPENAI_MODEL;
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  chrome.storage.sync.set(
    {
      OPENAI_API_KEY: apiKey.value.trim(),
      OPENAI_MODEL: (model.value || "gpt-5-mini-2025-08-07").trim()
    },
    () => flashSaved("Saved!")
  );
});


