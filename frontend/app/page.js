"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

const QUALITY_OPTIONS = [
  { value: "best", label: "Best" },
  { value: "1080p", label: "1080p" },
  { value: "720p", label: "720p" },
  { value: "480p", label: "480p" },
  { value: "360p", label: "360p" },
  { value: "audio", label: "Audio MP3" },
];

const VALID_URL = /^https?:\/\/\S+$/i;

function formatBytes(n) {
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

function formatDuration(sec) {
  if (!sec && sec !== 0) return null;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function HomePage() {
  const [resource, setResource] = useState("");
  const [state, setState] = useState({ phase: "idle", received: 0, total: null, filename: null });
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [info, setInfo] = useState(null);
  const [thumbError, setThumbError] = useState(false);
  const [quality, setQuality] = useState("best");
  const [jobs, setJobs] = useState([]);

  const loadHistory = useCallback(async () => {
    try {
      setJobs(await apiFetch("/api/downloads?limit=10"));
    } catch {}
  }, []);

  useEffect(() => {
    loadHistory();
    const timer = setInterval(loadHistory, 5000);
    return () => clearInterval(timer);
  }, [loadHistory]);

  const fetchInfo = useCallback(async (value) => {
    setChecking(true);
    setError("");
    setInfo(null);
    try {
      const result = await apiFetch(`/api/info?url=${encodeURIComponent(value)}`);
      setInfo(result);
      setThumbError(false);
    } catch (err) {
      setInfo(null);
      setError(err.message);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    const value = resource.trim();
    if (busy || !value || !VALID_URL.test(value)) {
      setInfo(null);
      return;
    }
    const timer = setTimeout(() => fetchInfo(value), 700);
    return () => clearTimeout(timer);
  }, [resource, fetchInfo]);

  async function startDownload(event) {
    event.preventDefault();
    const value = resource.trim();
    if (!value) return;
    setError("");
    setState({ phase: "starting", received: 0, total: null, filename: null });
    const isAudio = quality === "audio";
    const body = { resource: value, audio_only: isAudio };
    if (!isAudio && quality !== "best") body.quality = quality;
    try {
      const job = await apiFetch("/api/downloads", { method: "POST", body });

      let finished = null;
      if (job.status === "queued" || job.status === "downloading") {
        let current = job;
        while (current.status === "queued" || current.status === "downloading") {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          current = await apiFetch(`/api/downloads/${job.id}`);
          setState({
            phase: "server-downloading",
            received: current.bytes_transferred || 0,
            total: current.content_length || null,
            filename: current.filename,
          });
        }
        if (current.status !== "ready") {
          throw new Error(current.error || "Download failed on the server");
        }
        finished = current;
      }

      const fileResponse = await fetch(`/api/downloads/${job.id}/file`);
      if (!fileResponse.ok) {
        const detail = await fileResponse.json().catch(() => null);
        throw new Error((detail && detail.detail) || `Download failed (${fileResponse.status})`);
      }
      const disposition = fileResponse.headers.get("content-disposition") || "";
      const match = disposition.match(/filename\*?=(?:UTF-8''|)?([^;]+)/i);
      const totalHeader = Number(fileResponse.headers.get("content-length"));
      const filename = finished?.filename || (match ? decodeURIComponent(match[1].replace(/"/g, "")) : info?.title || value.split("/").pop() || "download");

      const reader = fileResponse.body.getReader();
      const chunks = [];
      let received = 0;
      for (;;) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        chunks.push(chunk);
        received += chunk.length;
        setState({
          phase: "streaming",
          received,
          total: totalHeader || null,
          filename,
        });
      }
      const blob = new Blob(chunks);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      setState({ phase: "completed", received, total: totalHeader || received, filename });
      loadHistory();
    } catch (err) {
      setState({ phase: "idle", received: 0, total: null, filename: null });
      setError(err.message);
      loadHistory();
    }
  }

  const percent = state.total ? Math.min(100, Math.round((state.received / state.total) * 100)) : null;
  const busy = state.phase !== "idle" && state.phase !== "completed";

  return (
    <>
      <h1>Paste a video link — download from anywhere</h1>
      <p className="sub">
        YouTube, TikTok, Facebook, Instagram, Twitter/X, Vimeo and hundreds more. Paste a link and the
        preview appears automatically, then pick a quality and download.
      </p>

      <form className="card" onSubmit={startDownload}>
        <div className="row">
          <input
            className="grow"
            placeholder="https://www.youtube.com/watch?v=…"
            value={resource}
            onChange={(e) => setResource(e.target.value)}
            disabled={busy}
            autoComplete="off"
            inputMode="url"
          />
          <button type="submit" disabled={busy || !resource.trim()}>
            {busy && <span className="spinner" />}
            {state.phase === "starting" ? "Starting…"
              : state.phase === "queued" ? "Queued…"
              : state.phase === "server-downloading" ? "Downloading…"
              : state.phase === "streaming" ? "Saving…"
              : "Download"}
          </button>
        </div>

        <div className="quality-row" role="radiogroup" aria-label="Download quality">
          <span className="quality-label">Quality</span>
          {QUALITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={quality === option.value}
              className={`quality-chip${quality === option.value ? " selected" : ""}`}
              onClick={() => setQuality(option.value)}
              disabled={busy}
            >
              {option.label}
            </button>
          ))}
        </div>

        {(checking || info) && (
          <div className="info-card">
            {checking ? (
              <p className="muted" style={{ margin: 0 }}>
                <span className="spinner dark" /> Fetching preview…
              </p>
            ) : (
              info && (
                <>
                  {info.thumbnail && !thumbError && (
                    <img src={info.thumbnail} alt="" className="thumb" onError={() => setThumbError(true)} />
                  )}
                  <div className="info-meta">
                    <strong>{info.title || "Untitled"}</strong>
                    <span className="muted">
                      {info.platform || "?"}
                      {info.uploader ? ` · ${info.uploader}` : ""}
                      {info.duration != null ? ` · ${formatDuration(info.duration)}` : ""}
                      {info.filesize ? ` · ${formatBytes(info.filesize)}` : ""}
                      {info.ext ? ` · ${info.ext.toUpperCase()}` : ""}
                    </span>
                  </div>
                </>
              )
            )}
          </div>
        )}

        {(state.phase === "streaming" || state.phase === "server-downloading") && (
          <div className="bar" role="progressbar" aria-label="Download progress" aria-valuenow={percent ?? 0} aria-valuemin={0} aria-valuemax={100}>
            <div style={{ width: `${percent ?? 8}%` }} />
          </div>
        )}
        {state.phase !== "idle" && state.filename && (
          <p className="muted">
            {state.phase === "completed" ? "Saved " : "Downloading "}
            <strong>{state.filename}</strong> · {formatBytes(state.received)}
            {state.total ? ` of ${formatBytes(state.total)}` : ""}
          </p>
        )}
        {error && <div className="error-box" role="alert">{error}</div>}
      </form>

      <div className="card">
        <h2>Recent downloads</h2>
        {jobs.length === 0 ? (
          <p className="muted">No downloads yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Resource</th>
                  <th>Quality</th>
                  <th>Status</th>
                  <th>Size</th>
                  <th>Provider</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="code">{job.resource}</td>
                    <td>{job.quality ? job.quality : job.audio_only ? "MP3" : "Best"}</td>
                    <td><span className={`pill ${job.status}`}>{job.status}</span></td>
                    <td>{formatBytes(job.bytes_transferred)}</td>
                    <td>{job.provider_id ? `#${job.provider_id}` : "—"}</td>
                    <td className="muted">{new Date(job.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
