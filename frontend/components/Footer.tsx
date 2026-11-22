import Link from "next/link";
import { DownloadIcon } from "./icons";

const PAGES = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/contact", label: "Contact Us" },
  { href: "/disclaimer", label: "Disclaimer" },
];

const NAV = [
  { href: "/", label: "Home" },
  { href: "/sites", label: "Supported Sites" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/#faq", label: "FAQ" },
];

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-white/5 bg-surface/60">
      <div className="section-pad grid gap-10 py-12 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-cyan-glow shadow-glow">
              <DownloadIcon className="h-5 w-5 text-white" />
            </span>
            <span className="text-base font-bold">VideoDownloader</span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-secondary">
            Paste a link, preview the video, pick a quality and download — from over a thousand supported
            websites, all in one place.
          </p>
        </div>
        <nav className="flex flex-col gap-3 text-sm md:items-center">
          <span className="mb-1 text-xs font-semibold uppercase tracking-widest text-secondary/70">Explore</span>
          {NAV.map((item) => (
            <Link key={item.label} href={item.href} className="text-secondary transition-colors hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>
        <nav className="flex flex-col gap-3 text-sm md:items-end">
          <span className="mb-1 text-xs font-semibold uppercase tracking-widest text-secondary/70">Legal</span>
          {PAGES.map((item) => (
            <Link key={item.label} href={item.href} className="text-secondary transition-colors hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t border-white/5 py-5 text-center text-xs text-secondary/70">
        Download Your Favorite Videos — Anytime, Anywhere.
      </div>
    </footer>
  );
}
