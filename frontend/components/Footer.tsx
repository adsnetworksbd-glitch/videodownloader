import Link from "next/link";
import LiveStats from "./LiveStats";
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
  { href: "/history", label: "History" },
  { href: "/blog", label: "Guides" },
];

const DEALS: { label: string; url: string }[] = (process.env.NEXT_PUBLIC_DEAL_LINKS || "")
  .split("|")
  .map((entry) => entry.trim())
  .filter(Boolean)
  .map((entry) => ({ label: entry.split("::")[0], url: entry.split("::")[1] }));

const DONATION_BKASH = process.env.NEXT_PUBLIC_DONATION_BKASH || "";
const DONATION_NAGAD = process.env.NEXT_PUBLIC_DONATION_NAGAD || "";
const donationsOn = Boolean(DONATION_BKASH || DONATION_NAGAD);

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
          {DEALS.length > 0 && (
            <Link href="/deals" className="text-secondary transition-colors hover:text-white">
              Deals &amp; Tools
            </Link>
          )}
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
      {donationsOn && (
        <div className="section-pad pb-2">
          <div className="glass flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
            <p className="text-sm font-semibold">Enjoying the tool? A small donation keeps it fast and free. &hearts;</p>
            {DONATION_BKASH && (
              <span className="pill-flow border-pink-500/40 text-pink-300">bKash: <strong className="text-white">{DONATION_BKASH}</strong></span>
            )}
            {DONATION_NAGAD && (
              <span className="pill-flow border-amber-500/40 text-amber-300">Nagad: <strong className="text-white">{DONATION_NAGAD}</strong></span>
            )}
          </div>
        </div>
      )}
      <div className="border-t border-white/5 py-5">
        <LiveStats />
        <p className="text-center text-xs text-secondary/70">
          Download Your Favorite Videos — Anytime, Anywhere.
        </p>
      </div>
    </footer>
  );
}
