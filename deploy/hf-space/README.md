---
title: VideoDownloader API
emoji: ⬇️
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: true
---

Backend API for the VideoDownloader site. Runs FastAPI + yt-dlp + FFmpeg on the free HF Spaces tier.

Set these as Space **Secrets** (Settings → Variables and secrets):

| Secret | Value |
|---|---|
| `ADMIN_TOKEN` | a long random string (your admin panel password) |
| `DATABASE_URL` | Neon Postgres URL, scheme changed to `postgresql+asyncpg://...ssl=require` |
| `CORS_ORIGINS` | `["https://your-app.vercel.app"]` (optional; same-origin proxy normally handles this) |
| `TELEGRAM_BOT_TOKEN` | optional, enables the Telegram bot |

The Dockerfile clones the latest `main` from GitHub at build time. After pushing new code to GitHub, use Factory rebuild on the Space to pull it in.
