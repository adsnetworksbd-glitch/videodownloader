"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export default function AdSlot({ slot, className = "" }: { slot?: string; className?: string }) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const configured = Boolean(client && slot);

  useEffect(() => {
    if (!configured) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {}
  }, [configured]);

  if (!configured) {
    return (
      <div
        className={`glass flex min-h-20 items-center justify-center text-[11px] uppercase tracking-widest text-white/25 ${className}`}
        aria-hidden="true"
      >
        Advertisement
      </div>
    );
  }

  return (
    <div className={className}>
      <ins
        className="adsbygoogle block"
        style={{ display: "block" }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-full-width-responsive="true"
      />
    </div>
  );
}
