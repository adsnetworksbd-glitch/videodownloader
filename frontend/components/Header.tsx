"use client";

import Link from "next/link";
import { useState } from "react";
import { DownloadIcon } from "./icons";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/sites", label: "Supported Sites" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/#faq", label: "FAQ" },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-ink/70 backdrop-blur-xl">
      <div className="section-pad flex items-center justify-between py-3">
        <Link href="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-cyan-glow shadow-glow">
            <DownloadIcon className="h-5 w-5 text-white" />
          </span>
          <span className="leading-tight">
            <span className="block text-base font-bold">VideoDownloader</span>
            <span className="block text-[11px] font-medium text-secondary">
              Fast <span className="text-brand">•</span> Free <span className="text-brand">•</span> All in One
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="rounded-lg px-4 py-2 text-sm font-medium text-secondary transition-colors hover:bg-white/5 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <select
            aria-label="Language"
            className="hidden rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-secondary outline-none sm:block"
            defaultValue="en"
          >
            <option value="en">EN</option>
            <option value="bn">BN</option>
          </select>
          <button
            type="button"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 md:hidden"
          >
            <span className={`h-0.5 w-5 bg-white transition-transform ${open ? "translate-y-2 rotate-45" : ""}`} />
            <span className={`h-0.5 w-5 bg-white transition-opacity ${open ? "opacity-0" : ""}`} />
            <span className={`h-0.5 w-5 bg-white transition-transform ${open ? "-translate-y-2 -rotate-45" : ""}`} />
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-white/5 bg-ink/95 px-4 py-3 md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="block rounded-lg px-3 py-3 text-sm font-medium text-secondary hover:bg-white/5 hover:text-white"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
