"use client";

import { useState } from "react";
import { ChevronIcon } from "./icons";

const FAQS = [
  {
    q: "How do I download a video?",
    a: "Copy the video link from any supported platform, paste it into the box on the home page, wait for the preview, then choose a quality and press Download. The file is saved straight to your device.",
  },
  {
    q: "Which websites are supported?",
    a: "Our extraction engine supports more than a thousand websites including YouTube, Facebook, Instagram, TikTok, X (Twitter), Pinterest, Reddit, Vimeo, Dailymotion and Twitch. Browse the full Supported Sites directory for the curated, verified list.",
  },
  {
    q: "Is the service free?",
    a: "Yes. Every core feature — link preview, quality selection and downloads — is completely free with unlimited usage.",
  },
  {
    q: "Do I need an account?",
    a: "No account, no registration, no email. Paste a link and download.",
  },
  {
    q: "Which video formats are supported?",
    a: "MP4 is the default output for videos, WebM where the source provides it, and MP3 for audio-only downloads. The options shown for each video reflect exactly what the platform provides — we never list formats that do not exist.",
  },
  {
    q: "Why is my link not working?",
    a: "The link must be a public http(s) URL to a video post. Private, deleted, age-restricted or DRM-protected content cannot be extracted. Double-check that the video plays in an incognito browser window.",
  },
  {
    q: "Can I use this website on Android?",
    a: "Yes. The site is built mobile-first and works in any modern Android or iOS browser, including Chrome, Firefox and Samsung Internet.",
  },
  {
    q: "Why are some video qualities unavailable?",
    a: "A quality option appears only when the platform itself offers that resolution for the video. Higher resolutions may require the uploader or platform to provide them, so older or lower-resolution videos show fewer options.",
  },
];

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? FAQS.filter((item) => item.q.toLowerCase().includes(needle) || item.a.toLowerCase().includes(needle))
    : FAQS;

  return (
    <section id="faq" className="section-pad scroll-mt-24 py-16">
      <div className="mb-10 text-center">
        <h2 className="text-3xl font-bold sm:text-4xl">Frequently Asked <span className="gradient-text">Questions</span></h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-secondary">
          Everything you need to know about downloading videos with VideoDownloader.
        </p>
      </div>
      <div className="mx-auto max-w-3xl">
        <input
          className="field"
          placeholder="Search questions…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search FAQ"
        />
      </div>
      <div className="mx-auto mt-3 max-w-3xl space-y-3">
        {filtered.length === 0 && (
          <p className="py-6 text-center text-sm text-secondary">No questions match “{query}”.</p>
        )}
        {filtered.map((item, index) => {
          const open = openIndex === index;
          return (
            <div key={item.q} className={`glass overflow-hidden transition-colors ${open ? "border-brand/40" : ""}`}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                onClick={() => setOpenIndex(open ? null : index)}
                aria-expanded={open}
              >
                <span className="text-sm font-semibold sm:text-base">{item.q}</span>
                <ChevronIcon className={`h-4 w-4 shrink-0 text-brand transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
              </button>
              {open && <p className="px-5 pb-5 text-sm leading-relaxed text-secondary">{item.a}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
