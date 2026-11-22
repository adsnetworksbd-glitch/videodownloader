# Download Gateway — All-in-One Video & File Downloader

A self-hosted streaming download gateway with pluggable upstream providers and automatic
fallback. Paste a social media video link (YouTube, TikTok, Facebook, Instagram,
Twitter/X, Vimeo and ~1000 more sites via yt-dlp) or a plain file path; the gateway
resolves it, walks a priority-ordered chain of providers until one answers, streams the
bytes straight through, and records what happened.

- **Backend** — FastAPI + SQLAlchemy 2.0 (async), PostgreSQL in production (SQLite for local dev/tests)
- **Admin panel** — Next.js 14 (App Router), manage providers via CRUD + health test
- **Public UI** — Next.js page that starts a download, shows live progress, auto-saves the file
- **Architecture & polish guided by the registered skills**: design-md (brand DESIGN.md grounding), impeccable (anti-slop audit/polish), taste-skill (bold/motion/density gates), web-design-guidelines (UX + accessibility), playwright-visual-qa (closed-loop browser QA)

## Layout


```
download-gateway/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app, error handlers, /health
│   │   ├── config.py               # pydantic-settings (env-driven)
│   │   ├── database.py             # async engine + session (lazy)
│   │   ├── models.py               # Provider, DownloadJob
│   │   ├── schemas.py              # pydantic I/O (api_key never echoed)
│   │   ├── crud.py                 # provider/job DB helpers
│   │   ├── deps.py                 # require_admin (X-Admin-Token)
│   │   ├── provider_manager.py     # chain build + fallback + attempts
│   │   ├── providers/              # base + adapters (http_mirror, proxy_pass, ytdlp)
│   │   ├── services/download_service.py
│   │   └── routers/                # downloads.py, providers.py
│   ├── db/schema.sql               # raw PostgreSQL DDL
│   └── tests/                      # 12 pytest cases (fallback, CRUD, e2e stream)
└── frontend/
    ├── app/            # page.js (public), admin/page.js (admin panel)
    ├── lib/api.js      # fetch helper with X-Admin-Token
    └── next.config.mjs # /api/* rewrite -> BACKEND_URL
```

## Quick start (local, no Docker)

**Backend**

```
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export ADMIN_TOKEN="change-me-local"
uvicorn app.main:app --reload --port 8000
```

Without `DATABASE_URL` it uses `sqlite+aiosqlite:///./gateway.db` (tables auto-created).

**Frontend**

```
cd frontend
npm install
npm run dev            # http://localhost:3000
```

`/api/*` on port 3000 is rewritten to `http://localhost:8000` (`BACKEND_URL` env to change;
the rewrite target is evaluated at startup/build, so restart `npm run dev` after changing it).

**Tests**

```
cd backend && python -m pytest -q
```

## Quick start — Docker Compose (বাংলা)


1. প্রথমে সিক্রেট সেট করুন: `.env.example` কপি করে `.env` বানান, `ADMIN_TOKEN` আর
   `POSTGRES_PASSWORD` অবশ্যই বদলান।
2. তারপর:
   ```
   docker compose up -d --build
   ```
3. এরপর:
   - Public UI → http://localhost:3000
   - Admin panel → http://localhost:3000/admin (token দিন: আপনার `ADMIN_TOKEN`)
   - Backend API docs → http://localhost:8000/docs
   - Health → http://localhost:8000/health

Postgres টেবিল দুইভাবে তৈরি হয়: প্রথমবারের `docker-entrypoint-initdb.d` দিয়ে
`backend/db/schema.sql` চলে, এবং backend চালু হলে `create_all()` দিয়েও নিশ্চিত হয়।

## Using the gateway

1. Open `/admin`, enter the admin token, then **Add provider**:
   - `ytdlp` — social video extraction (YouTube, TikTok, Facebook, Instagram, Twitter/X,
     Vimeo, …). **No base URL needed.** Streams the best combined video+audio MP4.
   - `http_mirror` — upstream is a plain mirror: `GET {base_url}/{resource}`;
     optional `api_key` becomes a Bearer token; `extra_headers` is JSON, e.g. `{"X-Flag": "1"}`
   - `proxy_pass` — upstream accepts `POST {base_url}` with JSON `{"resource": ...}`;
     `api_key` goes in the `X-API-Key` header
   - **Priority**: lower number = tried first. Add at least 2 for real fallback.
2. Public page `/`: paste a link, hit **Preview** to see title/thumbnail/duration
   (via `GET /api/info`), then **Download** to stream the file into the browser.

### How video downloads work (server-side mode)

When a `ytdlp` provider is configured, `POST /api/downloads` immediately starts a
**server-side download** (not a pass-through): the backend downloads the best available
video+audio with yt-dlp, merges them to MP4 with **ffmpeg** (or extracts MP3 when
`audio_only` is set), stores progress (`downloading`, `bytes_transferred`), and flips the
job to `ready`. The browser polls the job for live progress, then fetches the finished
file from `GET /api/downloads/{id}/file` and saves it. Files stay on the server in
`DOWNLOAD_DIR` (default `./downloads`) until you clean them up.


Mirror/proxy providers keep the old pass-through streaming behavior.

### Cookies (for Facebook/Instagram/private videos)

Export cookies from your browser (any "cookies.txt" extension, Netscape format) and paste
them into the provider's **Cookies** field in the admin panel. Cookies are stored in the
DB plaintext and are never returned by the API (`has_cookies` only). They are written to a
temporary cookie file only for the duration of a download.

### Video notes & limitations

- **100% is not possible**: sites with login-only content or anti-bot walls can still fail;
  cookies fix most of those, and yt-dlp needs to stay current (it ships as a pinned
  dependency — update it regularly (`pip install -U yt-dlp`) since platforms change).
- Quality: best available **video+audio**, merged by ffmpeg up to 1080p MP4 — the image
  backend Dockerfile installs ffmpeg automatically. Audio-only mode produces MP3.
- Some sites (notably YouTube from datacenter IPs) may reject the media fetch with 403 even
  when metadata resolves; running on a residential IP or with cookies usually fixes it.
- Vimeo's web client requires login cookies.
- Respect copyright and the terms of service of the platforms you download from.

## API reference

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET  | `/health` | — | liveness |
| GET  | `/api/info?url=…` | — | video preview: title, thumbnail, duration, platform |
| POST | `/api/downloads` | — | body `{"resource": "...", "audio_only": false}` → job (201); with a ytdlp provider it starts a server-side download |
| GET  | `/api/downloads` | — | recent jobs (`?limit=1..200`) |
| GET  | `/api/downloads/{id}` | — | job status/bytes/attempts |
| GET  | `/api/downloads/{id}/file` | — | streams the file through the chain |
| GET/POST | `/api/admin/providers` | admin | list all + create |
| GET/PATCH/DELETE | `/api/admin/providers/{id}` | admin | manage one |
| POST | `/api/admin/providers/{id}/test` | admin | health-check result for that row |


Admin auth: send header `X-Admin-Token: <ADMIN_TOKEN>`. Errors: no active provider →
**503** `no_providers_available`; every provider failed → **502** with the attempts log;
unknown adapter → **500**.

## Browser extension

A Chrome/Edge popup extension ships in `extension/`: it grabs a direct CDN link for the
video in the current tab via `/api/info/direct` (server spends zero media bandwidth) and
falls back to opening the site when a server-side merge is needed. See
`extension/README.md` for the 2-minute install (Load unpacked).

## Deployment notes (production)

- **Always change `ADMIN_TOKEN`** — it is a single shared secret; without changing it anyone
  can edit your providers. Later improvements: per-user accounts, rate limiting.
- **Secrets in env only**: `.env` is git-ignored; never commit real keys. Provider `api_key`
  values are stored in the DB plaintext (masked in API responses) — the DB must be protected.
- **HTTPS**: put the stack behind a reverse proxy with TLS (Caddy, nginx + certbot, or a cloud
  load balancer). Terminate TLS there and expose only ports 80/443; you can remove
  ports 5432 and 8000 from `docker-compose.yml` in that setup.
- **CORS**: set `CORS_ORIGINS` to your real frontend origin(s).
- The `BACKEND_URL` build arg for the frontend image is evaluated at **build time**; if the
  backend address changes, rebuild the admin image.
- **Free hosting walkthrough (Bangla)**: see `docs/DEPLOY_FREE_BANGLA.md` — Render backend
  + Neon Postgres + Vercel frontend + UptimeRobot keep-alive, zero cost, no card.

## Known limitations

- No resumable/range downloads: responses carry `Accept-Ranges: none`; a mid-stream failure
  restarts the whole file (fallback happens before the first byte).
- No per-chunk progress persistence: progress shown in the browser is its own Content-Length
  estimate; the DB records only the final `bytes_transferred`.
- `proxy_pass` health test uses a plain `GET {base_url}` — upstreams that only accept POST
  will report `down` even when downloads work.
- Single admin token, plaintext provider keys, no scheduled background health checks
  (`last_status` updates only on test/attempt).
