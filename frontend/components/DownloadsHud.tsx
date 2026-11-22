"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { JOBS_EVENT, loadHudJobs, updateHudJob, type HudJob } from "../lib/hud";

type Toast = { key: number; kind: "ok" | "fail"; title: string };

export default function DownloadsHud() {
  const [jobs, setJobs] = useState<HudJob[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const notified = useRef<Set<string>>(new Set());

  const pushToast = useCallback((kind: "ok" | "fail", title: string) => {
    const key = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-2), { key, kind, title }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.key !== key)), 8000);
  }, []);

  const poll = useCallback(async () => {
    const current = loadHudJobs();
    if (current.length === 0) return;
    let changed = false;
    for (const job of current) {
      if (["ready", "completed", "failed"].includes(job.status)) continue;
      try {
        const res = await fetch(`/api/downloads/${job.id}`);
        if (!res.ok) continue;
        const data = (await res.json()) as { status: string };
        updateHudJob(job.id, data.status);
        changed = true;
        if (!notified.current.has(job.id)) {
          if (data.status === "ready" || data.status === "completed") {
            notified.current.add(job.id);
            pushToast("ok", job.title || "Download complete");
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              try {
                new Notification("Download ready", { body: job.title || "Your video is ready" });
              } catch {}
            }
          } else if (data.status === "failed") {
            notified.current.add(job.id);
            pushToast("fail", job.title || "Download failed");
          }
        }
      } catch {}
    }
    if (changed) setJobs(loadHudJobs());
  }, [pushToast]);

  useEffect(() => {
    const sync = () => setJobs(loadHudJobs());
    sync();
    window.addEventListener(JOBS_EVENT, sync);
    const timer = setInterval(poll, 3000);
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      document.addEventListener(
        "click",
        () => {
          Notification.requestPermission().catch(() => {});
        },
        { once: true }
      );
    }
    return () => {
      window.removeEventListener(JOBS_EVENT, sync);
      clearInterval(timer);
    };
  }, [poll]);

  const active = jobs.filter((j) => j.status === "queued" || j.status === "downloading" || j.status === "streaming");
  if (active.length === 0 && toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-72 flex-col gap-2">
      {active.length > 0 && (
        <Link href="/history" className="glass pointer-events-auto flex items-center gap-3 !rounded-2xl px-4 py-3 shadow-glow-cyan">
          <svg className="h-4 w-4 shrink-0 animate-spin text-cyan-glow" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
          </svg>
          <span className="text-xs text-secondary">
            <strong className="text-white">{active.length}</strong> download{active.length > 1 ? "s" : ""} in progress
          </span>
        </Link>
      )}
      {toasts.map((toast) => (
        <div
          key={toast.key}
          role="status"
          className={`glass pointer-events-auto !rounded-2xl border px-4 py-3 shadow-glow-cyan ${
            toast.kind === "ok" ? "border-emerald-500/40" : "border-red-500/40"
          }`}
        >
          <p className={`text-xs font-semibold ${toast.kind === "ok" ? "text-emerald-300" : "text-red-300"}`}>
            {toast.kind === "ok" ? "✓ Download ready" : "✗ Download failed"}
          </p>
          <p className="mt-0.5 truncate text-xs text-secondary">{toast.title}</p>
          <Link href="/history" className="mt-2 inline-block text-[11px] font-semibold text-brand hover:text-cyan-glow">
            Open history →
          </Link>
        </div>
      ))}
    </div>
  );
}
