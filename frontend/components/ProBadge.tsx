"use client";

import Link from "next/link";
import { useProStatus } from "../lib/pro";

export default function ProBadge() {
  const { status } = useProStatus();
  if (status) {
    return (
      <Link
        href="/pro"
        className="pill-flow hidden border-cyan-glow/50 text-[11px] font-bold text-cyan-glow sm:inline-block"
        title={`VideoDownloader Pro${status.expires_at ? ` — until ${new Date(status.expires_at).toLocaleDateString("en-US")}` : ""}`}
      >
        ⚡ PRO
      </Link>
    );
  }
  return (
    <Link
      href="/pro"
      className="pill-flow hidden border-brand/50 bg-brand/10 text-[11px] font-bold text-brand hover:text-cyan-glow sm:inline-block"
    >
      Go Pro
    </Link>
  );
}
