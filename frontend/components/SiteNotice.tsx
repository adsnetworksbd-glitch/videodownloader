"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

const DISMISS_KEY = "gateway.notice_dismissed";

export default function SiteNotice() {
  const [message, setMessage] = useState("");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const data = await apiFetch<{ message: string }>("/api/stats/notice");
        if (alive && data.message) {
          setMessage(data.message);
          setDismissed(window.localStorage.getItem(DISMISS_KEY) === data.message);
        }
      } catch {}
    };
    load();
    const timer = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (!message || dismissed) return null;

  return (
    <div className="border-b border-cyan-glow/30 bg-gradient-to-r from-brand/25 via-cyan-glow/15 to-brand/25">
      <div className="section-pad flex items-center justify-between gap-4 py-2.5 text-sm">
        <p className="flex items-center gap-2 text-white">
          <span aria-hidden>📢</span>
          <span>{message}</span>
        </p>
        <button
          type="button"
          aria-label="Dismiss notice"
          className="shrink-0 rounded-full px-2 text-secondary hover:text-white"
          onClick={() => {
            window.localStorage.setItem(DISMISS_KEY, message);
            setDismissed(true);
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
