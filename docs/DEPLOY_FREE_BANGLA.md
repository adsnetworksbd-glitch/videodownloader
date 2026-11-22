# সাইট পুরো ফ্রিতে লাইভ করার গাইড (HF Spaces + Vercel + Neon)

ক্রেডিট কার্ড লাগবে না। মোট ৩টা জায়গায় একবার করে সেটআপ করলেই সাইট ২৪ ঘণ্টা অনলাইনে থাকবে।

```
User ──> Vercel (frontend, ফ্রি) ──/api/* proxy──> HF Space (backend, ফ্রি) ──> Neon (Postgres, ফ্রি)
```

---

## ধাপ ১ — Neon: ফ্রি PostgreSQL database

1. https://neon.tech ওয়েবসাইটে গিয়ে Google/GitHub দিয়ে ফ্রি অ্যাকাউন্ট খুলো।
2. নতুন project বানাও (নাম: `videodownloader`), region কাছের হলে ভালো।
3. Dashboard থেকে **Connection string** কপি করো। দেখতে এমন:
   ```
   postgresql://neondb_owner:XXXXXXXX@ep-xyz-123.ap-southeast-1.aws.neon.tech/neondb
   ```
4. এখন দুটো জিনিস বদলাও:
   - শুরুর `postgresql://` তে `+asyncpg` বসাও → `postgresql+asyncpg://`
   - একদম শেষে যোগ করো `?ssl=require`
   - ফাইনাল এরকম হবে:
   ```
   postgresql+asyncpg://neondb_owner:XXXXXXXX@ep-xyz-123.ap-southeast-1.aws.neon.tech/neondb?ssl=require
   ```
5. এই string-টা সেভ করে রাখো — এটাই **DATABASE_URL**। টেবিল নিজে থেকেই তৈরি হয়ে যাবে (backend চালু হলে create_all ব্যবহারকারীর দরকার নেই)।

---

## ধাপ ২ — Hugging Face Space: ফ্রি backend

1. https://huggingface.co তে ফ্রি অ্যাকাউন্ট খোলো।
2. **New Space** → নাম `videodownloader-api` → SDK: **Docker** → Public → Create.
3. Space repo লোকালে clone করে আমাদের বানানো ফাইল দুটো ভেতরে দাও, তারপর push:
   ```bash
   git clone https://huggingface.co/spaces/তোমার-ইউজারনেম/videodownloader-api hf-space
   cp -r ~/Desktop/videodownloader/deploy/hf-space/* hf-space/
   cd hf-space
   git add -A && git commit -m "deploy backend on HF Spaces"
   git push
   ```
4. Build হতে ৫-১০ মিনিট লাগবে ( Guthub থেকে কোড + FFmpeg ইনস্টল হয় )।
5. Build শেষে Secrets দাও: Space → **Settings → Variables and secrets → New secret**:
   | নাম | মান |
   |---|---|
   | `ADMIN_TOKEN` | লম্বা random লেখা (যেমন `vdl-9f3k2l8as7dfkjh32`) — admin panel-এর password |
   | `DATABASE_URL` | ধাপ ১-এর string |
   | `TELEGRAM_BOT_TOKEN` | (ইচ্ছা হলে) Telegram bot চালু করতে |
6. App তখন লাইভ — ব্রাউজারে `https://তোমার-ইউজারনেম-videodownloader-api.hf.space/health` এ গিয়ে `{"status": "ok"}` দেখলেই backend ready ✅

> **FFmpeg এই backend-এ আগে থেকেই আছে** → 1080p merge আর আসল MP3 এখন কাজ করবে! 🎉

> **৪৮ ঘণ্টা** টানা কেউ না ঢুকলে Space ঘুমায়; যেকোনো request দিলেই জেগে ওঠে (৩০ সেকেন্ডের মতো লাগে)। প্রতিদিন user এলে ঘুমাবেই না।

**নতুন কোড deploy করা:** GitHub-এ push করার পর Space → Settings → **Factory rebuild** — Dockerfile প্রতি build-এ GitHub main থেকে সর্বশেষ কোড টেনে নেয়।

---

## ধাপ ৩ — Vercel: ফ্রি frontend

1. https://vercel.com এ GitHub দিয়ে login করো।
2. **Add New Project** → `adsnetworksbd-glitch/videodownloader` import করো।
3. Config:
   - **Framework Preset:** Next.js (automatically detected)
   - **Root Directory:** `frontend`
4. **Environment Variables** এ যোগ করো:
   | নাম | মান |
   |---|---|
   | `BACKEND_URL` | `https://তোমার-ইউজারনেম-videodownloader-api.hf.space` (শেষে `/` দিও না) |
   | `SITE_URL` | `https://videodownloader-তোমারনাম.vercel.app` |
   | `NEXT_PUBLIC_PAYMENT_BKASH` | তোমার bKash নম্বর (Pro পেমেন্ট নির্দেশনায় দেখাবে) |
   | `NEXT_PUBLIC_PAYMENT_NAGAD` | তোমার Nagad নম্বর |
   | `NEXT_PUBLIC_DONATION_BKASH` | (ইচ্ছা হলে) footer-এর donation লাইনের জন্য |
   | `NEXT_PUBLIC_DONATION_NAGAD` | (ইচ্ছা হলে) একইভাবে Nagad |
   | `NEXT_PUBLIC_ADSENSE_CLIENT`, `NEXT_PUBLIC_ADSENSE_SLOT_HOME`, `NEXT_PUBLIC_ADSENSE_SLOT_SITES` | AdSense অ্যাকাউন্ট পেলে |
   | `NEXT_PUBLIC_DEAL_LINKS` | affiliate: `নাম::লিংক` ফরম্যাটে, একাধিক হলে `|` দিয়ে আলাদা করো |
5. **Deploy** চাপো — ৩-৪ মিনিটে লাইভ সাইট! 🎉

---

## ধাপ ৪ — লাইভ টেস্ট চেকলিস্ট

- [ ] `https://তোমার-সাইট.vercel.app` খুলে একটা YouTube লিংক paste → প্রিভিউ + download হচ্ছে?
- [ ] `/admin` → ধাপ ২-এর ADMIN_TOKEN দিয়ে login → providers/settings/jobs সব দেখাচ্ছে?
- [ ] `/pro` → admin panel থেকে key generate করে redeem টেস্ট
- [ ] `/contact`-এ একটা message পাঠাও → admin-এর Orders & messages panel-এ এসেছে কিনা দেখো

## সমস্যা হলে

| সমস্যা | সমাধান |
|---|---|
| সাইট প্রথমবার 502 দেখায় | Space ঘুমাচ্ছিল — রিফ্রেশ দাও, ৩০ সেকেন্ডে উঠে আসবে |
| Backend build fail | Space-এর **Logs** দেখো; বেশিরভাগ সময় secret-এ ভুল বানানের কারণে |
| Database connection error | DATABASE_URL-এ `+asyncpg` আর `?ssl=require` আছে কি না মিলিয়ে দেখো |
| নির্দিষ্ট ভিডিও নামে (age/login error) | হয়তো ব্যক্তিগত ভিডিও — DownloadPanel-এর Advanced → Cookies অপশন ব্যবহার করো |

## খরচ

| জিনিস | সেবা | টাকা |
|---|---|---|
| Frontend | Vercel Hobby | ফ্রি |
| Backend | HF Spaces (CPU basic) | ফ্রি |
| Database | Neon free plan | ফ্রি |
| **মোট** | | **০ টাকা** 😎 |
