export type Article = {
  slug: string;
  title: string;
  description: string;
  date: string;
  minutes: number;
  keywords: string[];
  body: { heading: string; paragraphs: string[]; steps?: string[] }[];
};

export const ARTICLES: Article[] = [
  {
    slug: "how-to-download-youtube-videos",
    title: "How to Download YouTube Videos in 3 Steps (2026 Guide)",
    description:
      "Paste the link, preview the quality options and save any public YouTube video — the complete beginner-friendly walkthrough.",
    date: "2026-11-20",
    minutes: 4,
    keywords: ["download youtube video", "youtube video downloader", "save youtube video"],
    body: [
      {
        heading: "Copy the video link",
        paragraphs: [
          "Open the video on YouTube, tap the Share button and choose Copy link. A link looks like https://www.youtube.com/watch?v=... or https://youtu.be/...",
        ],
      },
      {
        heading: "Paste it on VideoDownloader",
        paragraphs: [
          "Paste the link into the big input box on the home page. A preview with the title, thumbnail and available qualities appears automatically.",
        ],
      },
      {
        heading: "Pick a quality and save",
        paragraphs: [
          "Choose 1080p, 720p, 480p, 360p or an audio-only option — only qualities the video actually offers are shown. Press the button and the file downloads straight from your browser.",
        ],
        steps: ["Copy link from YouTube", "Paste on the home page", "Select quality → Save"],
      },
    ],
  },
  {
    slug: "download-tiktok-videos-without-watermark",
    title: "Download TikTok Videos Without the Watermark",
    description:
      "Save clean TikTok videos in original quality. Legal notes, privacy tips and what to do when a TikTok link is private.",
    date: "2026-11-18",
    minutes: 3,
    keywords: ["tiktok downloader", "tiktok no watermark", "save tiktok video"],
    body: [
      {
        heading: "Why some tools leave a watermark",
        paragraphs: [
          "TikTok serves two streams: the watermarked play URL and the clean original. Our extractor prefers the clean original whenever TikTok exposes it.",
        ],
      },
      {
        heading: "Steps",
        paragraphs: ["Use the Share → Copy link option inside the TikTok app, paste it on the home page and pick your quality."],
        steps: ["Share → Copy link in TikTok", "Paste on VideoDownloader", "Download the no-watermark file if it is available"],
      },
      {
        heading: "Private accounts",
        paragraphs: [
          "Private videos cannot be downloaded — that protection is respected by design. Only public content works.",
        ],
      },
    ],
  },
  {
    slug: "facebook-video-download-guide",
    title: "Facebook Video Download Guide (Reels, Watch, Groups)",
    description: "How facebook.com links, FB.watch links and logged-in-only videos behave — plus the cookies option explained.",
    date: "2026-11-15",
    minutes: 4,
    keywords: ["facebook video downloader", "fb reels download", "download fb video"],
    body: [
      {
        heading: "Supported Facebook link types",
        paragraphs: [
          "Public posts, Watch links, Reels and most group videos work. If Facebook says content is not available, the video needs login.",
        ],
      },
      {
        heading: "The cookies option",
        paragraphs: [
          "For logged-in-only videos, Advanced → Cookies accepts a cookies.txt export from a browser extension while you are logged in. Cookies are used in memory for that single job and never stored on the server.",
        ],
      },
    ],
  },
  {
    slug: "video-quality-explained",
    title: "1080p vs 720p vs Audio Only — Which Quality Should You Pick?",
    description: "What each label means, how much data it uses and when audio-only is the smarter choice.",
    date: "2026-11-10",
    minutes: 5,
    keywords: ["1080p 720p difference", "video quality guide", "audio only download"],
    body: [
      {
        heading: "Resolutions in plain language",
        paragraphs: [
          "360p saves the most data and is fine for chatting clips. 720p is the sweet spot for phones. 1080p looks sharp on laptops and TVs.",
        ],
      },
      {
        heading: "Why is 1080p missing?",
        paragraphs: [
          "We only show qualities the platform really offers for that video. Merging 1080p video and audio streams needs FFmpeg on the server; without it the site falls back to the best single-stream file (usually 720p).",
        ],
      },
      {
        heading: "Audio only (MP3/M4A)",
        paragraphs: [
          "Great for songs, lectures and podcasts — about 10x smaller than video. Available whenever the platform exposes an audio stream.",
        ],
      },
    ],
  },
  {
    slug: "is-online-video-downloading-safe",
    title: "Is Online Video Downloading Safe and Legal?",
    description: "The security checks running behind every paste, what we never store, and the copyright rules to respect.",
    date: "2026-11-05",
    minutes: 4,
    keywords: ["is video downloading safe", "video downloader legal", "safe video downloader"],
    body: [
      {
        heading: "What the site protects you from",
        paragraphs: [
          "Every submitted URL is validated against SSRF (server-side request forgery) — private networks, localhost and cloud metadata endpoints are blocked. Links are only processed, your browsing is never tracked.",
        ],
      },
      {
        heading: "What we keep",
        paragraphs: [
          "Temporary files are cleaned automatically, cookies you paste never touch the database, and we store no personal information beyond anonymized download counters.",
        ],
      },
      {
        heading: "Respect copyright",
        paragraphs: [
          "Download only videos you have the right to keep — your own uploads, Creative Commons content, or media the platform allows saving. This tool never bypasses DRM, paywalls or private-content protection.",
        ],
      },
    ],
  },
];

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((article) => article.slug === slug);
}
