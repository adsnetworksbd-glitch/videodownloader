"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { registerHudJob, updateHudJob } from "../../lib/hud";

type Job = {
  id: string;
  resource: string;
  status: string;
  quality: string | null;
  audio_only: boolean;
  filename: string | null;
  content_length: number | null;
  bytes_transferred: number;
  error: string | null;
  created_at: string;
};

function formatBytes(n?: number | null) {
  if (!n && n !== 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u += 1;
  }
  return `${v.toFixed(v >= 10 || u === 0 ? 0 : 1)} ${units[u]}`;
}

function formatDate(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const STATUS_STYLE: Record<string, string> = {
  ready: "border-emerald-500/40 text-emerald-300",
  completed: "border-emerald-500/40 text-emerald-300",
  failed: "border-red-500/40 text-red-300",
  queued: "border-amber-500/40 text-amber-300",
  downloading: "border-cyan-glow/50 text-cyan-glow",
  streaming: "border-cyan-glow/50 text-cyan-glow",
  pending: "border-white/15 text-secondary",
};

export default function HistoryPage() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "done" | "failed">("all");
  const [query, setQuery] = useState("");

  const filtered = (jobs || []).filter((job) => {
    if (filter === "done" && !(job.status === "ready" || job.status === "completed")) return false;
    if (filter === "failed" && job.status !== "failed") return false;
    if (filter === "active" && !("queued downloading streaming pending".includes(job.status))) return false;
    const q = query.trim().toLowerCase();
    if (q && !(job.filename || "").toLowerCase().includes(q) && !job.resource.toLowerCase().includes(q)) return false;
    return true;
  });

  const load = useCallback(async () => {
    try {
      const list = await apiFetch<Job[]>("/api/downloads?limit=100");
      setJobs(list);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!jobs) return;
    for (const job of jobs) {
      if (["ready", "completed", "failed"].includes(job.status)) updateHudJob(job.id, job.status);
    }
  }, [jobs]);

  function saveAgain(job: Job) {
    if (job.status === "ready" || job.status === "completed") {
      registerHudJob({ id: job.id, title: job.filename || "Video", status: "ready", at: Date.now() });
    }
  }

  const hasJobs = (jobs && jobs.length > 0) || false;
  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">
            Download <span className="gradient-text">History</span>
          </h1>
          <p className="mt-2 text-sm text-secondary">
            Recent jobs on this server. Files exist on the server until the next cleanup — re-save any finished one.
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={load}>
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
          {error}
        </div>
      )}

      <div className="glass mt-6 flex flex-wrap items-center gap-3 p-4">
        <div className="flex flex-wrap gap-2">
          {(["all", "active", "done", "failed"] as const).map((key) => (
            <button
              key={key}
              type="button"
              className={`!rounded-full !px-4 !py-1.5 !text-xs ${filter === key ? "btn-primary !py-1.5" : "btn-ghost !py-1.5"}`}
              onClick={() => setFilter(key)}
            >
              {key === "all" ? "All" : key === "active" ? "In progress" : key === "done" ? "Succeeded" : "Failed"}
            </button>
          ))}
        </div>
        <input
          className="field !w-auto grow placeholder:text-secondary/60 sm:ml-auto"
          style={{ maxWidth: 260 }}
          placeholder="Search file or link..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="glass mt-4 overflow-hidden">
        {jobs === null && !error && <p className="px-5 py-8 text-center text-sm text-secondary">Loading…</p>}
        {jobs !== null && !hasJobs && (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-secondary">No downloads yet.</p>
            <p className="mt-1 text-xs text-secondary/70">Paste a video link on the home page and your jobs will appear here.</p>
          </div>
        )}
        {jobs !== null && jobs.length > 0 && filtered.length === 0 && (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-secondary">No jobs match this filter.</p>
          </div>
        )}
        {hasJobs && filtered.length > 0 && (
          <ul className="divide-y divide-white/5">
            {filtered.map((job) => (
              <li key={job.id} className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 grow">
                  <p className="truncate text-sm font-semibold">{job.filename || job.resource}</p>
                  <p className="mt-0.5 truncate text-xs text-secondary">
                    {formatDate(job.created_at)}
                    {job.quality ? ` · ${job.quality}` : ""}
                    {job.audio_only ? " · audio" : ""} · {formatBytes(job.content_length)}
                  </p>
                  {job.error && <p className="mt-1 line-clamp-2 text-xs text-red-300/80">{job.error}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`pill-flow ${STATUS_STYLE[job.status] || "border-white/15 text-secondary"}`}>{job.status}</span>
                  {(job.status === "ready" || job.status === "completed") && (
                    <a className="btn-ghost !px-3 !py-1.5 text-xs" href={`/api/downloads/${job.id}/file`} onClick={() => saveAgain(job)}>
                      Save
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
