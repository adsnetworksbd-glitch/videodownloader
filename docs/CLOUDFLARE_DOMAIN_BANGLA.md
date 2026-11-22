# Cloudflare + Custom Domain + SEO (বাংলা গাইড, ফ্রি টিয়ার)

সাইট লাইভ করার পর এই গাইড ফলো করলে: DDoS protection, HTTPS, cache, নিজের ডোমেইন — সব ফ্রিতে পাবে।

## ধাপ ০ — আগের সেটআপ ধরে নিচ্ছি

- Frontend (Vercel): `your-app.vercel.app`
- Backend (Render): `your-api.onrender.com`
- Database (Neon): Postgres live

না হলে আগে `docs/DEPLOY_FREE_BANGLA.md` ফলো করো।

---

## ধাপ ১ — নিজের ডোমেইন কেনা (ফ্রি না, তবে সস্তা)

ডোমেইন কিনতে হবে। সস্তা ও ভরসাযোগ্য: **Namecheap**, **Porkbun** (`.xyz` / `.site` / `.online` ডোমেইন প্রথম বছর ১–২ ডলার)।

> একদম টাকা খরচ করতে না চাইলে ফ্রি উপায়: GitHub Student Pack থাকলে `.me` ডোমেইন ফ্রি। তবে নিজের ডোমেইন থাকলে SEO-র জন্য সবচেয়ে ভালো।

## ধাপ ২ — ডোমেইন Cloudflare এ যোগ করা (ফ্রি)

1. [cloudflare.com](https://www.cloudflare.com) — ফ্রি একাউন্ট খোলো → **Add a site** → তোমার ডোমেইন দাও → **Free plan** সিলেক্ট করো।
2. Cloudflare তোমাকে **২টা nameserver** দেবে (যেমন `ada.ns.cloudflare.com`)।
3. ডোমেইন রেজিস্ট্রারে (Namecheap ইত্যাদি) গিয়ে nameserver বদলে Cloudflare-এরটা বসাও। কয়েক ঘণ্টায় একটিভ হয়।

### DNS রেকর্ড (Cloudflare Dashboard → DNS)

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| CNAME | `@` (root) | `cname.vercel-dns.com` | 🟠 Proxied |
| CNAME | `www` | `cname.vercel-dns.com` | 🟠 Proxied |
| CNAME | `api` | `your-api.onrender.com` | 🟠 Proxied |

> ⚠️ টিপ: root domain CNAME সাপোর্ট করতে Cloudflare-এ **CNAME Flattening** auto কাজ করে — চিন্তা নেই।

### Vercel-এ ডোমেইন যোগ

1. Vercel → তোমার প্রজেক্ট → **Settings → Domains** → তোমার ডোমেইন লিখে Add।
2. `www` আর root দুটোই যোগ করো; root কে `www` তে redirect করে দাও।

### Render-এ ডোমেইন যোগ

1. Render → তোমার backend service → **Settings → Custom Domains** → `api.yourdomain.com` যোগ করো।
2. **Frontend এর env আপডেট:** Vercel → Settings → Environment Variables → `BACKEND_URL` = `https://api.yourdomain.com` → Redeploy।

## ধাপ ৩ — Cloudflare সেটিংস (গুরুত্বপূর্ণ)

| সেটিং | কোথায় | কী করবে |
|--------|--------|----------|
| SSL/TLS mode | SSL/TLS → Overview | **Full (strict)** — এটা মিস করলে redirect loop হয় |
| Always Use HTTPS | SSL/TLS → Edge Certificates | ON |
| Brotli | Speed → Optimization | ON |
| Cache Level | Caching → Configuration | Standard |
| Browser Cache TTL | Caching → Configuration | 4 hours |
| Under Attack Mode | Security → Settings | শুধু attack-এর সময় ON করো (সবসময় চালু রাখলে সাধারণ user কষ্ট পায়) |

### Backend API ক্যাশিং বন্ধ রাখা (জরুরি!)

Cloudflare ডিফল্টে static ফাইল ক্যাশ করে — API response ক্যাশ হয়ে বাগ হতে পারে। একটা **Cache Rule** বানাও:

1. Caching → **Cache Rules** → Create rule
2. Name: `bypass-api`
3. Match: Hostname equals `api.yourdomain.com`
4. Action: **Bypass cache**

> এতে video CDN link (`/api/v1/direct`, `/api/info/direct`) response কখনো পুরনো হবে না।

### Rate limit বাড়তি সুরক্ষা

Security → WAF → **Rate limiting rules** (ফ্রি প্ল্যানে একটা রুল): `/api/*` path এ ১০ সেকেন্ডে ৫০+ request হলে block — আমাদের নিজের rate-limit মিডলওয়্যারের উপরে আরেক স্তর।

## ধাপ ৪ — SEO চেকলিস্ট (ডোমেইন একটিভ হওয়ার পর)

1. **Google Search Console** ([search.google.com/search-console](https://search.google.com/search-console)) — ডোমেইন property যোগ করো → Cloudflare DNS এ TXT রেকর্ড বসিয়ে verify করো → **Sitemaps** এ `https://yourdomain.com/sitemap.xml` সাবমিট (সাইটে sitemap আগেই আছে ✅)।
2. **Bing Webmaster Tools** — একই কাজ, Bing থেকেও ট্রাফিক আসে।
3. Search Console → **URL Inspection** → হোমপেজের URL দিয়ে **Request indexing**।
4. Robots block নেই কিনা দেখো: `https://yourdomain.com/robots.txt` — আগেই আছে ✅
5. ব্লগ পোস্টগুলো নিয়মিত আপডেট থাকলে গুগল দ্রুত র‍্যাঙ্ক করে (সাইটে ৫টা ব্লগ পোস্ট আগেই আছে ✅)।

## খরচের হিসাব

| জিনিস | খরচ |
|--------|-----|
| Cloudflare Free (CDN, DDoS, SSL, cache) | 0৳ |
| Vercel / Render / Neon (আগের সেটআপ) | 0৳ |
| ডোমেইন | ~১৫০–৩০০৳/মাস (বছরে ১–২ ডলার) |

**মোট: ডোমেইনের টাকা ছাড়া সব ফ্রি।**

## সমস্যা টেবিল

| সমস্যা | কারণ | সমাধান |
|--------|-------|---------|
| Redirect loop (too many redirects) | SSL mode "Flexible" | SSL/TLS mode → **Full (strict)** |
| API CORS error | `CORS_ORIGINS` env এ নতুন ডোমেইন নেই | Render env: `CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com` + redeploy |
| ডোমেইন কাজ করছে না ২৪ ঘণ্টার বেশি | Nameserver ভুল | Registrar এ Cloudflare-এর ২টা nameserver ঠিক আছে কিনা দেখো |
| ভিডিও ডাউনলোড ক্লিকে কিছু হয় না | Cloudflare API ক্যাশ করছে | ধাপ ৩-এর "Bypass cache" রুল বানাও |
