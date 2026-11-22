# VideoDownloader Quick Grab — Browser Extension

A lightweight Chrome/Edge (Manifest V3) extension for your own VideoDownloader backend.
It reads the URL of the current tab, asks your backend for a **direct CDN link**
(`/api/info/direct`) and starts the download straight from the source — your server
spends zero media bandwidth. When the requested quality needs a server-side merge
(e.g. 1080p DASH), it opens your site so the normal job flow can finish the work.

## Install (Chrome / Edge / Brave)

1. Copy the `extension/` folder anywhere (or keep it inside the repo).
2. Open `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the `extension/` folder.
5. Click the extension icon, set **Backend URL** (e.g. `http://localhost:8000`
   locally, or your Render backend URL in production) and it is remembered.

## Files

| File           | Purpose                                        |
|----------------|------------------------------------------------|
| `manifest.json`| MV3 manifest (popup, storage, activeTab)       |
| `popup.html`   | Dark Navy UI matching the site theme           |
| `popup.js`     | Direct-first resolve + graceful fallback       |

## Notes

- The extension only talks to **your** backend; it never sends page data anywhere else.
- Protected/private videos (DRM, login-only content) are intentionally not supported,
  same as on the website.
