# 🚀 ফ্রি হোস্টিং গাইড — Render + Neon + Vercel + UptimeRobot

পুরো সাইট **০ টাকা, কার্ড ছাড়া** চালানোর পূর্ণ সেটআপ। মোট ৪টা ফ্রি সার্ভিস (৪টাতেই শুধু ইমেইল লাগে, কার্ড লাগে না):

| কাজ | সার্ভিস | ঠিকানা |
|---|---|---|
| ডাটাবেজ (PostgreSQL) | **Neon** | neon.tech |
| ব্যাকএন্ড (FastAPI) | **Render** | render.com |
| ফ্রন্টএন্ড (Next.js) | **Vercel** | vercel.com |
| সার্ভার জাগিয়ে রাখা | **UptimeRobot** | uptimerobot.com |

> আগের Hugging Face গাইড বাদ দাও — HF এখন ডর্মেন্ট স্পেসের জন্য টাকা নেয়। Render-এ সমস্যা নেই।

---

## ধাপ ১ — Neon: ডাটাবেজ তৈরি (৫ মিনিট)

1. **neon.tech** → Sign up (GitHub দিয়ে লগইন করো, সবচেয়ে সহজ)।
2. নতুন **Project** বানাও (নাম: `videodownloader`)। Region: `Singapore` (বাংলাদেশের কাছে)।
3. Dashboard-এ দেখবে **Connection string** — এই রকম (পুরোটা কপি করে রাখো):
   ```
   postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require
   ```
4. ⚠️ এই স্ট্রিং-এর মাঝে একটা ছোট এডিট লাগবে — নিচে ধাপ ২.২-এর টেবিলে দেখানো ফরম্যাটে বসাবে।

---

## ধাপ ২ — Render: ব্যাকএন্ড (১০ মিনিট)

### ধাপ ২.১ — সার্ভিস তৈরি
1. **render.com** → Sign up with GitHub (রিপো অ্যাক্সেস দাও)।
2. **New + → Web Service** → রিপো `adsnetworksbd-glitch/videodownloader` সিলেক্ট করো।
3. নিচের মত সেট করো:

| ফিল্ড | মান |
|---|---|
| Name | `vdbackend` (এটাই তোমার API URL-এর অংশ হবে) |
| Region | `Singapore` |
| Root Directory | `backend` |
| Runtime | `Python 3` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Instance Type | `Free` |

### ধাপ ২.২ — Environment Variables (সবচেয়ে গুরুত্বপূর্ণ)

Render → তোমার সার্ভিস → **Environment** → Add Environment Variable:

| Key | Value | ব্যাখ্যা |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://user:password@ep-xxx-pooler.....neon.tech/neondb?ssl=require` | Neon স্ট্রিং-এর সামনে `postgresql://` → **`postgresql+asyncpg://`** করবে, আর শেষে `?sslmode=require` → **`?ssl=require`** করবে ✅ |
| `ADMIN_TOKEN` | (নিজের বানানো লম্বা গোপন টোকেন, যেমন `vdb-admin-7f3k9...`) | মাস্টার টোকেন — এটা কেউকে দিও না |
| `ADMIN_EMAIL` | যেমন `rony@gmail.com` | অ্যাডমিন প্যানেলে লগইনের ইমেইল (যেকোনো ইমেইল লিখতে পারো, ভেরিফিকেশন লাগে না) |
| `ADMIN_PASSWORD` | শক্ত পাসওয়ার্ড | অ্যাডমিন প্যানেলে লগইনের পাসওয়ার্ড |
| `CORS_ORIGINS` | `["https://তোমার-সাইট.vercel.app"]` | পরে ডোমেইন কিনলে ওখানে কমা দিয়ে যোগ করবে |
| `TELEGRAM_BOT_TOKEN` | (অপশনাল) বট টোকেন | অর্ডার/মেসেজ অ্যালার্ট চাইলে |
| `TELEGRAM_ALERT_CHAT_ID` | (অপশনাল) চ্যাট আইডি | অ্যালার্ট কোথায় যাবে |

4. **Save** → প্রথম ডিপ্লয় শুরু হবে (৫–৮ মিনিট)।
5. সাকসেস হলে ব্রাউজারে খোলো: `https://vdbackend.onrender.com/health` → `{"status":"ok"}` দেখাবে।

> 📅 **টেবিল নিজেই তৈরি হবে** — অ্যাপ চালু হলে `init_db()` সব টেবিল অটো বানিয়ে দেয়, আলাদা মাইগ্রেশন লাগবে না।

### ধাপ ২.৩ — ffmpeg নোট (ট্রিম/কমপ্রেস ফিচার)

Render-এর ফ্রি **pip** ডিপ্লয়ে ffmpeg নেই → মার্জ ফলব্যাক ≤720p কাজ করবে (ডিজাইন অনুযায়ী)। পুরো ffmpeg চাইলে পরে **Docker ডিপ্লয়** করা যাবে (রিপোতে `backend/Dockerfile` রেডি আছে, তখন Runtime `Docker` করবে)। এখন দরকার নেই।

---

## ধাপ ৩ — Vercel: ফ্রন্টএন্ড (৫ মিনিট)

1. **vercel.com** → Sign up with GitHub।
2. **Add New → Project** → `videodownloader` রিপো **Import** করো।
3. সেটিংস:

| ফিল্ড | মান |
|---|---|
| Framework Preset | Next.js (অটো) |
| Root Directory | `frontend` |
| Build Command | (ডিফল্ট) |

4. **Environment Variables:**

| Key | Value |
|---|---|
| `BACKEND_URL` | `https://vdbackend.onrender.com` (তোমার Render URL, শেষে `/` নেই) |

5. **Deploy** → শেষে তোমার সাইট: `https://videodownloader-xxx.vercel.app` 🎉

> Vercel নিজেই `/api/*` কলগুলো ব্যাকএন্ডে পাঠায় (rewrites রেডি আছে)।

---

## ধাপ ৪ — UptimeRobot: ঘুম থামাও (৩ মিনিট)

Render ফ্রি সার্ভিস **১৫ মিনিট কোনো ভিজিটর না থাকলে ঘুমিয়ে যায়** — পরের ভিজিটরকে ~৫০ সেকেন্ড অপেক্ষা করতে হয়। UptimeRobot দিয়ে ঠিক করো:

1. **uptimerobot.com** → ফ্রি অ্যাকাউন্ট (৫০টা মনিটর ফ্রি)।
2. **Add New Monitor:**
   - Type: `HTTP(s)`
   - Friendly Name: `VD Backend`
   - URL: `https://vdbackend.onrender.com/health`
   - Interval: **৫ মিনিট** ✅
3. Save → প্রতি ৫ মিনিটে পিং করবে, সার্ভার আর ঘুমাবে না।

---

## ধাপ ৫ — ফাইনাল চেকলিস্ট

- [ ] `https://vdbackend.onrender.com/health` → `{"status":"ok"}`
- [ ] সাইটে কোনো লিংক পেস্ট → প্রিভিউ + কোয়ালিটি দেখাচ্ছে
- [ ] `/admin` → Email + password দিয়ে লগইন হচ্ছে
- [ ] অ্যাডমিন প্যানেলে সাইট সেটিংস/প্রো প্যাকেজ সেভ হচ্ছে
- [ ] ইতিহাস পেজে ডাউনলোড দেখাচ্ছে
- [ ] UptimeRobot মনিটর "Up" দেখাচ্ছে

---

## ধাপ ৬ (অপশনাল) — নিজের ডোমেইন + Cloudflare

ডোমেইন কিনে Cloudflare-এ যোগ করতে চাইলে সম্পূর্ণ গাইড আছে: **[CLOUDFLARE_DOMAIN_BANGLA.md](CLOUDFLARE_DOMAIN_BANGLA.md)** (DNS টেবিল, SSL, API cache রুল, SEO চেকলিস্ট)।

ডোমেইন যোগ করলে এই কাজগুলো করতে হবে:
- Vercel → Project → Settings → Domains → তোমার ডোমেইন যোগ
- Render → Environment → `CORS_ORIGINS`-এ নতুন ডোমেইন কমা দিয়ে যোগ → Save (অটো রিডিপ্লয় হবে)

---

## খরচ টেবিল

| সার্ভিস | কার্ড লাগে? | মাসিক খরচ | সীমা |
|---|---|---|---|
| Neon | ❌ | ০ | 0.5 GB ডাটা, যথেষ্ট |
| Render Web Service | ❌ | ০ | 750 ঘণ্টা/মাস, sleep আছে |
| Vercel | ❌ | ০ | Hobby প্ল্যান |
| UptimeRobot | ❌ | ০ | ৫-মিনিট পিং, ৫০ মনিটর |
| **মোট** | — | **০ টাকা** | — |

---

## সমস্যা হলে (Troubleshooting)

| সমস্যা | কারণ | সমাধান |
|---|---|---|
| ব্যাকএন্ড ডিপ্লয় ব্যর্থ, log-এ ডাটাবেজ এরর | `DATABASE_URL` ফরম্যাট ভুল | `+asyncpg` আর `?ssl=require` হুবহু চেক করো |
| ব্যাকএন্ড চালু কিন্তু সাইট কাজ করছে না | CORS বা BACKEND_URL ভুল | Vercel-এ `BACKEND_URL` ঠিক আছে কিনা দেখো; `CORS_ORIGINS`-এ vercel URL পুরো ঠিকানা সহ আছে কিনা |
| প্রথম রিকোয়েস্ট ৫০ সেকেন্ড লাগে | সার্ভার ঘুমিয়ে ছিল | UptimeRobot মনিটর অন আছে কিনা দেখো |
| অ্যাডমিন লগইনে "Email login is disabled" | Render-এ ADMIN_EMAIL/ADMIN_PASSWORD সেট করা হয়নি | Environment ট্যাবে সেট করে Save (অটো রিডিপ্লয় হবে) |
| Neon ডাটাবেজ রাতে প্রথম ভিজিটে স্লো | Neon cold start | পরের রিকোয়েস্টে স্বাভাবিক হয়ে যায় |
| এনভ বদলালাম কিন্তু কিছু পরিবর্তন হয়নি | কখনো রিডিপ্লয় লাগে | সার্ভিস → Manual Deploy → **Deploy latest commit** চাপো |
| এক্সটেনশনে কাজ করছে না | এক্সটেনশনে ভুল ব্যাকএন্ড URL | এক্সটেনশন সেটিংসে `https://vdbackend.onrender.com` বসাও |

---

## লোকাল মনে রাখো

- লোকালে ইমেইল লগইন চাইলে ব্যাকএন্ড `.env`-এ `ADMIN_EMAIL` আর `ADMIN_PASSWORD` দাও। না দিলে শুধু master token দিয়ে লগইন হবে।
- সার্ভার আপডেট অটো: তুমি নতুন কোড পুশ করলে Render ও Vercel নিজে নিজেই রিডিপ্লয় করে — কিছু করতে হয় না।
- লোকাল কম্পিউটার আপডেট করতে (প্রতিবার পুশের পর): `cd ~/Desktop/videodownloader && git fetch origin && git reset --hard origin/main`
