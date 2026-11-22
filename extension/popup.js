const backendInput = document.getElementById("backend");
const pageUrlInput = document.getElementById("pageurl");
const qualitySelect = document.getElementById("quality");
const goButton = document.getElementById("go");
const statusBox = document.getElementById("status");

chrome.storage.local.get(["backend"], (data) => {
  if (data.backend) backendInput.value = data.backend;
});

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  if (tab && tab.url && /^https?:/i.test(tab.url)) pageUrlInput.value = tab.url;
});

backendInput.addEventListener("change", () => {
  chrome.storage.local.set({ backend: backendInput.value.trim().replace(/\/+$/, "") });
});

function normalize(url) {
  let value = url.trim().replace(/\/+$/, "");
  if (value && !/^https?:\/\//i.test(value)) value = `http://${value}`;
  return value;
}

function setTitle(info) {
  const title = info.title || info.filename || "video";
  statusBox.textContent = `Found: ${title}\nPlatform: ${info.platform || "unknown"}${
    info.ext ? `\nFormat: .${info.ext}` : ""
  }`;
}

goButton.addEventListener("click", async () => {
  const backend = normalize(backendInput.value);
  const pageUrl = pageUrlInput.value.trim();
  const quality = qualitySelect.value;

  if (!backend || !/^https?:\/\//i.test(backend)) {
    statusBox.textContent = "Set your backend URL first (e.g. http://localhost:8000).";
    return;
  }
  if (!pageUrl || !/^https?:\/\//i.test(pageUrl)) {
    statusBox.textContent = "No video URL found in the tab.";
    return;
  }
  chrome.storage.local.set({ backend });
  goButton.disabled = true;
  statusBox.textContent = "Resolving…";

  try {
    const direct = await fetch(
      `${backend}/api/info/direct?url=${encodeURIComponent(pageUrl)}&quality=${encodeURIComponent(quality)}`
    );
    if (direct.ok) {
      const data = await direct.json();
      setTitle(data);
      const anchor = document.createElement("a");
      anchor.href = data.url;
      anchor.download = data.filename || "";
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      statusBox.textContent += "\nDownload started from the source CDN.";
      return;
    }

    const info = await fetch(`${backend}/api/info?url=${encodeURIComponent(pageUrl)}`);
    if (!info.ok) {
      statusBox.textContent = `Backend error ${info.status} - try opening the site to see details.`;
      return;
    }
    const data = await info.json();
    setTitle(data);
    statusBox.textContent +=
      "\nNo direct file for this quality (needs server merge). Opening your site to finish there…";
    chrome.tabs.create({ url: backend.replace(/\/api$/, "") });
  } catch (err) {
    statusBox.textContent = "Could not reach the backend. Check the URL and that it is running.";
  } finally {
    goButton.disabled = false;
  }
});
