import type { Metadata } from "next";
import Link from "next/link";
import { ARTICLES } from "../../lib/articles";

export const metadata: Metadata = {
  title: "Download Guides & Tips",
  description:
    "Step-by-step guides: download YouTube videos, save TikTok without watermark, Facebook Reels, quality explained and safety tips.",
  keywords: ["video download guides", "youtube downloader guide", "tiktok downloader tutorial"],
  alternates: { canonical: "/blog" },
};

export default function BlogIndex() {
  return (
    <div className="section-pad py-12">
      <h1 className="text-3xl font-extrabold sm:text-4xl">
        Download <span className="gradient-text">guides &amp; tips</span>
      </h1>
      <p className="mt-3 max-w-2xl text-secondary">
        Everything about saving videos the smart way — platform guides, quality advice and safety notes.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {ARTICLES.map((article) => (
          <Link
            key={article.slug}
            href={`/blog/${article.slug}`}
            className="glass block p-5 transition-transform hover:-translate-y-0.5"
          >
            <p className="text-[11px] uppercase tracking-widest text-secondary/70">
              {article.date} · {article.minutes} min read
            </p>
            <h2 className="mt-2 text-lg font-bold leading-snug">{article.title}</h2>
            <p className="mt-2 text-sm text-secondary">{article.description}</p>
            <p className="mt-3 text-sm font-semibold text-brand">Read the guide →</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
