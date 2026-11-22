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

type DirectEvent = {
  id: number;
  url: string;
  title: string | null;
  quality: string | null;
  ext: string | null;
  content_length: number | null;
  created_at: string;
};

type HistoryRow = {
  key: string;
  kind: "job" | "direct";
  title: string;
  resource: string;
  status: string;
  quality: string | null;
  ext: string | null;
  audio: boolean;
  size: number | null;
  error: string | null;
  jobId: string | null;
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

const ACTIVE = new Set(["queued", "downloading", "streaming", "pending"]);

export default function HistoryPage() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "done" | "failed">("all");
  const [query, setQuery] = useState("");

  const filtered = rows.filter((row) => {
    if (filter === "done" && row.status !== "ready" && row.status !== "completed") return false;
    if (filter === "failed" && row.status !== "failed") return false;
    if (filter === "active" && !ACTIVE.has(row.status)) return false;
    const q = query.trim().toLowerCase();
    if (q && !row.title.toLowerCase().includes(q) && !row.resource.toLowerCase().includes(q)) return false;
    return true;
  });

  const load = useCallback(async () => {
    try {
      const [jobList, eventList] = await Promise.all([
        apiFetch<Job[]>("/api/downloads?limit=100"),
        apiFetch<DirectEvent[]>("/api/downloads/events?limit=100").catch(() => [] as DirectEvent[]),
      ]);
      const jobRows: HistoryRow[] = (jobList || []).map((job) => ({
        key: `job-${job.id}`,
        kind: "job",
        title: job.filename || job.resource,
        resource: job.resource,
        status: job.status,
        quality: job.quality,
        ext: null,
        audio: job.audio_only,
        size: job.content_length,
        error: job.error,
        jobId: job.id,
        created_at: job.created_at,
      }));
      const directRows: HistoryRow[] = (eventList || []).map((event) => ({
        key: `direct-${event.id}`,
        kind: "direct",
        title: event.title || event.url,
        resource: event.url,
        status: "completed",
        quality: event.quality,
        ext: event.ext,
        audio: event.quality === "audio",
        size: event.content_length,
        error: null,
        jobId: null,
        created_at: event.created_at,
      }));
      const merged = [...jobRows, ...directRows].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setJobs(jobList || []);
      setRows(merged);
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

  const hasRows = rows.length > 0;
  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">
            Download <span className="gradient-text">History</span>
          </h1>
          <p className="mt-2 text-sm text-secondary">
            Direct-link saves and server files in one list. Files exist on the server until the next cleanup — re-save any finished one.
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
        {jobs !== null && !hasRows && (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-secondary">No downloads yet.</p>
            <p className="mt-1 text-xs text-secondary/70">Paste a video link on the home page and your downloads will appear here.</p>
          </div>
        )}
        {jobs !== null && hasRows && filtered.length === 0 && (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-secondary">No downloads match this filter.</p>
          </div>
        )}
        {hasRows && filtered.length > 0 && (
          <ul className="divide-y divide-white/5">
            {filtered.map((row) => (
              <li key={row.key} className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 grow">
                  <p className="truncate text-sm font-semibold">{row.title}</p>
                  <p className="mt-0.5 truncate text-xs text-secondary">
                    {formatDate(row.created_at)}
                    {row.quality ? ` · ${row.quality}` : ""}
                    {row.audio ? " · audio" : ""}
                    {row.ext ? ` · .${row.ext}` : ""} · {formatBytes(row.size)}
                  </p>
                  {row.error && <p className="mt-1 line-clamp-2 text-xs text-red-300/80">{row.error}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {row.kind === "direct" ? (
                    <span className="pill-flow border-cyan-glow/40 text-cyan-glow">direct link</span>
                  ) : (
                    <>
                      <span className={`pill-flow ${STATUS_STYLE[row.status] || "border-white/15 text-secondary"}`}>{row.status}</span>
                      {(row.status === "ready" || row.status === "completed") && row.jobId && (
                        <a
                          className="btn-ghost !px-3 !py-1.5 text-xs"
                          href={`/api/downloads/${row.jobId}/file`}
                          onClick={() => {
                            const job = (jobs || []).find((item) => item.id === row.jobId);
                            if (job) saveAgain(job);
                          }}
                        >
                          Save
                        </a>
                      )}
                    </>
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
