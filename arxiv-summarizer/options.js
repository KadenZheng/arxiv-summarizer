// options.js
const form = document.getElementById("form");
const apiKey = document.getElementById("apiKey");
const model = document.getElementById("model");
const saved = document.getElementById("saved");

function flashSaved(msg) {
  saved.textContent = msg;
  setTimeout(() => (saved.textContent = ""), 2000);
}

chrome.storage.sync.get(["PERPLEXITY_API_KEY", "PERPLEXITY_MODEL"], (cfg) => {
  if (cfg.PERPLEXITY_API_KEY) apiKey.value = cfg.PERPLEXITY_API_KEY;
  if (cfg.PERPLEXITY_MODEL) model.value = cfg.PERPLEXITY_MODEL;
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  chrome.storage.sync.set(
    {
      PERPLEXITY_API_KEY: apiKey.value.trim(),
      PERPLEXITY_MODEL: (model.value || "sonar").trim()
    },
    () => flashSaved("Saved!")
  );
});


