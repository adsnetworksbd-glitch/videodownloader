"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/api";
import { CheckIcon, DownloadIcon, LinkIcon } from "./icons";

type VideoFormat = { quality: string; ext: string | null; filesize: number | null; fps: number | null; has_audio: boolean };
type Info = {
  title: string | null;
  uploader: string | null;
  duration: number | null;
  thumbnail: string | null;
  platform: string | null;
  ext: string | null;
  filesize: number | null;
  formats: VideoFormat[];
  audio_only_available: boolean;
};

type Phase = "idle" | "checking" | "ready" | "starting" | "downloading" | "saving" | "completed" | "error";

const STEPS = ["Validating URL", "Detecting provider", "Extracting video info", "Retrieving available formats"];

function formatBytes(n?: number | null) {
  if (!n && n !== 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u += 1;
  }
  return `${v.toFixed(v >= 10 || u === 0 ? 0 : 1)} ${units[u]}`;
}

function formatDuration(sec?: number | null) {
  if (!sec && sec !== 0) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function DownloadPanel() {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [info, setInfo] = useState<Info | null>(null);
  const [thumbError, setThumbError] = useState(false);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string>("");
  const [received, setReceived] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const checking = phase === "checking" || phase === "starting" || phase === "downloading" || phase === "saving";

  useEffect(() => () => { if (stepTimer.current) clearInterval(stepTimer.current); }, []);

  async function startDownload(quality: string) {
    const value = url.trim();
    if (!value) return;
    setError("");
    setReceived(0);
    setTotal(null);
    setPhase("starting");
    const isAudio = quality === "audio";
    const body: Record<string, unknown> = { resource: value, audio_only: isAudio };
    if (!isAudio && quality && quality !== "best") body.quality = quality;
    try {
      const job = await apiFetch<{ id: string; status: string; error: string | null }>("/api/downloads", {
        method: "POST",
        body,
      });

      let current: { id: string; status: string; error: string | null; bytes_transferred?: number; content_length?: number | null } = job;
      if (current.status === "queued" || current.status === "downloading") {
        setPhase("downloading");
        while (current.status === "queued" || current.status === "downloading") {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          current = await apiFetch<{ id: string; status: string; error: string | null; bytes_transferred?: number; content_length?: number | null }>(`/api/downloads/${job.id}`);
          setReceived(current.bytes_transferred || 0);
          setTotal(current.content_length || null);
        }
        if (current.status !== "ready") {
          throw new Error(current.error || "Download failed on the server");
        }
      }

      setPhase("saving");
      const fileResponse = await fetch(`/api/downloads/${job.id}/file`);
      if (!fileResponse.ok) {
        const detail = await fileResponse.json().catch(() => null);
        throw new Error((detail && detail.detail) || `Download failed (${fileResponse.status})`);
      }
      const disposition = fileResponse.headers.get("content-disposition") || "";
      const match = disposition.match(/filename\*?=(?:UTF-8''|)?([^;]+)/i);
      const totalHeader = Number(fileResponse.headers.get("content-length"));
      const filename =
        (match ? decodeURIComponent(match[1].replace(/"/g, "")) : null) || info?.title || "download";
      setTotal(totalHeader || total);

      const reader = fileResponse.body!.getReader();
      const chunks: Uint8Array[] = [];
      let count = 0;
      for (;;) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        chunks.push(chunk);
        count += chunk.length;
        setReceived(count);
        if (totalHeader) setTotal(totalHeader);
      }
      const parts: BlobPart[] = chunks.map((c) => {
        const copy = new Uint8Array(c.length);
        copy.set(c);
        return copy.buffer;
      });
      const blob = new Blob(parts);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
      setPhase("completed");
    } catch (err) {
      setPhase("error");
      setError((err as Error).message);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = url.trim();
    if (!value) return;
    if (!/^https?:\/\//i.test(value)) {
      setPhase("error");
      setError("Please paste a valid video link starting with http(s)://");
      setInfo(null);
      return;
    }
    setInfo(null);
    setError("");
    setPhase("checking");
    setStep(0);
    if (stepTimer.current) clearInterval(stepTimer.current);
    stepTimer.current = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length)), 450);
    try {
      const result = await apiFetch<Info>(`/api/info?url=${encodeURIComponent(value)}`);
      setInfo(result);
      setThumbError(false);
      setSelected(result.formats[0]?.quality || "best");
      setStep(STEPS.length);
      setPhase("ready");
      document.getElementById("download-result")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (err) {
      setInfo(null);
      setPhase("error");
      setError((err as Error).message);
    } finally {
      if (stepTimer.current) clearInterval(stepTimer.current);
    }
  }

  const percent = total ? Math.min(100, Math.round((received / total) * 100)) : null;
  const busyLabel =
    phase === "starting" ? "Starting…" : phase === "downloading" ? "Downloading…" : phase === "saving" ? "Saving…" : "Checking…";

  return (
    <section id="downloader" className="scroll-mt-24">
      <form onSubmit={handleSubmit} className="glass glass-hover p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative grow">
            <LinkIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary/60" />
            <input
              className="field !py-4 pl-11"
              placeholder="Paste video link here..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={checking}
              autoComplete="off"
              inputMode="url"
              enterKeyHint="go"
            />
          </div>
          <button type="submit" className="btn-primary !px-8 !py-4 text-base" disabled={checking || !url.trim()}>
            {checking ? (
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
              </svg>
            ) : (
              <DownloadIcon className="h-5 w-5" />
            )}
            {checking ? busyLabel : "Download"}
          </button>
        </div>

        {phase === "checking" && (
          <div className="mt-5 space-y-2" aria-live="polite">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center gap-3 text-sm">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                    i < step
                      ? "border-transparent bg-gradient-to-r from-brand to-cyan-glow"
                      : i === step
                        ? "border-cyan-glow text-cyan-glow"
                        : "border-white/15 text-secondary/40"
                  }`}
                >
                  {i < step ? <CheckIcon className="h-3 w-3 text-white" /> : <span className="text-[10px] font-bold">{i + 1}</span>}
                </span>
                <span className={i <= step ? "text-white" : "text-secondary/50"}>{label}</span>
                {i === step && (
                  <svg className="h-3.5 w-3.5 animate-spin text-cyan-glow" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
            {error}
          </div>
        )}

        <AnimatePresence>
          {info && phase !== "checking" && (
            <motion.div
              id="download-result"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-5 rounded-2xl border border-white/10 bg-ink/50 p-4"
            >
              <div className="flex flex-col gap-4 sm:flex-row">
                {info.thumbnail && !thumbError ? (
                  <img src={info.thumbnail} alt="" className="h-40 w-full rounded-xl object-cover sm:w-52" onError={() => setThumbError(true)} />
                ) : (
                  <div className="flex h-40 w-full items-center justify-center rounded-xl bg-gradient-to-br from-brand/30 to-cyan-glow/10 sm:w-52">
                    <span className="text-secondary/50">No preview</span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-cyan-glow">{info.platform || "Video"}</p>
                  <h3 className="mt-1 break-words text-base font-bold sm:text-lg">{info.title || "Untitled video"}</h3>
                  <p className="mt-1 text-xs text-secondary">
                    {info.uploader}
                    {info.duration != null ? ` · ${formatDuration(info.duration)}` : ""}
                    {info.ext ? ` · ${info.ext.toUpperCase()}` : ""}
                    {info.filesize ? ` · ${formatBytes(info.filesize)}` : ""}
                  </p>

                  {info.formats.length > 0 ? (
                    <>
                      <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-secondary/70">Video quality</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {info.formats.map((f) => (
                          <button
                            type="button"
                            key={f.quality}
                            onClick={() => setSelected(f.quality)}
                            className={`chip ${selected === f.quality ? "chip-selected" : ""}`}
                            disabled={checking}
                          >
                            {f.quality}
                            {f.filesize ? <span className="text-[10px] opacity-70">{formatBytes(f.filesize)}</span> : null}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-widest text-secondary/70">Video quality</p>
                      <button type="button" onClick={() => setSelected("best")} className={`chip mt-2 ${selected === "best" ? "chip-selected" : ""}`} disabled={checking}>
                        Best available
                      </button>
                    </div>
                  )}

                  {info.audio_only_available && (
                    <>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-secondary/70">Audio</p>
                      <button type="button" onClick={() => setSelected("audio")} className={`chip mt-2 ${selected === "audio" ? "chip-selected" : ""}`} disabled={checking}>
                        Audio only (MP3/M4A)
                      </button>
                    </>
                  )}

                  <button type="button" className="btn-primary mt-5 w-full sm:w-auto" onClick={() => startDownload(selected)} disabled={checking}>
                    <DownloadIcon className="h-4 w-4" />
                    Download {selected === "audio" ? "audio" : selected === "best" ? "best quality" : selected}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {percent != null && (phase === "downloading" || phase === "saving") && (
          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand to-cyan-glow transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-secondary" aria-live="polite">
              {phase === "saving" ? "Saving" : "Downloading"} · {formatBytes(received)}
              {total ? ` of ${formatBytes(total)}` : ""} · {percent}%
            </p>
          </div>
        )}

        {phase === "completed" && (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300" role="status">
            Saved to your device · {formatBytes(received)}
          </div>
        )}
      </form>
    </section>
  );
}
