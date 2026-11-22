"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/api";
import { registerHudJob, updateHudJob } from "../lib/hud";
import { tt, useLang } from "../lib/lang";
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
type PlaylistItem = { title: string | null; duration: number | null; thumbnail: string | null; url: string | null };
type Playlist = { title: string | null; count: number; total_count: number; pro_required?: boolean; items: PlaylistItem[] };

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

function friendlyError(message: string): string {
  const m = (message || "").toLowerCase();
  if (m.includes("rate limit") || m.includes("too many") || m.includes("429"))
    return "Too many requests right now. Please wait a minute and try again.";
  if (m.includes("private account") || m.includes("login") || m.includes("authentication"))
    return "This video needs an account to view. Try the Advanced options and paste cookies, or pick a public video.";
  if (m.includes("age") && (m.includes("restrict") || m.includes("confirm")))
    return "This video is age-restricted. Open Advanced options and paste cookies for it to work.";
  if (m.includes("drm") || m.includes("protected content"))
    return "This video is DRM-protected — downloading it is not possible.";
  if (m.includes("unavailable") || m.includes("removed") || m.includes("not exist") || m.includes("404"))
    return "This video is unavailable — it may have been deleted, made private, or the link is wrong.";
  if (m.includes("unsupported url") || m.includes("no suitable"))
    return "This platform is not supported yet. Browse the Supported Sites page for what works.";
  if (m.includes("playlist contained no") || m.includes("no media") || m.includes("no downloadable"))
    return "No downloadable video was found at this link. Double-check the URL.";
  if (m.includes("http(s)"))
    return "Please paste a valid video link starting with http(s)://";
  if (m.includes("private") || m.includes("localhost") || m.includes("not allowed"))
    return "This link points to a private network address and is blocked for security.";
  return message;
}

export default function DownloadPanel() {
  const lang = useLang();
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [info, setInfo] = useState<Info | null>(null);
  const [thumbError, setThumbError] = useState(false);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string>("");
  const [received, setReceived] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const [cookies, setCookies] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [playlistSel, setPlaylistSel] = useState<Set<string>>(new Set());
  const [playlistProgress, setPlaylistProgress] = useState<{ done: number; total: number; current: string | null } | null>(null);
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const confettiRef = useRef<HTMLDivElement | null>(null);

  const checking = phase === "checking" || phase === "starting" || phase === "downloading" || phase === "saving";

  useEffect(() => {
    const preset = new URLSearchParams(window.location.search).get("url");
    if (preset && /^https?:\/\//i.test(preset)) setUrl(preset);
    return () => {
      if (stepTimer.current) clearInterval(stepTimer.current);
    };
  }, []);

  function fireConfetti() {
    const container = confettiRef.current;
    if (!container) return;
    const colors = ["#087BFF", "#00CFFF", "#22C55E", "#F59E0B", "#EC4899", "#FFFFFF"];
    for (let i = 0; i < 80; i++) {
      const piece = document.createElement("span");
      piece.className = "confetti-piece";
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = colors[i % colors.length];
      piece.style.setProperty("--rot", `${Math.round(Math.random() * 720 - 360)}deg`);
      piece.style.animationDelay = `${(Math.random() * 0.25).toFixed(2)}s`;
      piece.style.animationDuration = `${(1.1 + Math.random() * 0.8).toFixed(2)}s`;
      container.appendChild(piece);
      setTimeout(() => piece.remove(), 2200);
    }
  }

  async function createJob(resource: string, quality: string, cookiesText: string) {
    const isAudio = quality === "audio";
    const body: Record<string, unknown> = { resource, audio_only: isAudio };
    if (!isAudio && quality && quality !== "best") body.quality = quality;
    if (cookiesText.trim()) body.cookies = cookiesText.trim();
    return apiFetch<{ id: string; status: string; error: string | null }>("/api/downloads", { method: "POST", body });
  }

  async function waitForJob(jobId: string) {
    let current = await apiFetch<{ id: string; status: string; error: string | null; bytes_transferred?: number; content_length?: number | null }>(
      `/api/downloads/${jobId}`
    );
    while (current.status === "queued" || current.status === "downloading") {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      current = await apiFetch<{ id: string; status: string; error: string | null; bytes_transferred?: number; content_length?: number | null }>(
        `/api/downloads/${jobId}`
      );
      setReceived(current.bytes_transferred || 0);
      setTotal(current.content_length || null);
    }
    if (current.status !== "ready") {
      throw new Error(current.error || "Download failed on the server");
    }
    return current;
  }

  async function saveFile(jobId: string, fallbackName: string) {
    const fileResponse = await fetch(`/api/downloads/${jobId}/file`);
    if (!fileResponse.ok) {
      const detail = await fileResponse.json().catch(() => null);
      throw new Error((detail && detail.detail) || `Download failed (${fileResponse.status})`);
    }
    const disposition = fileResponse.headers.get("content-disposition") || "";
    const match = disposition.match(/filename\*?=(?:UTF-8''|)?([^;]+)/i);
    const totalHeader = Number(fileResponse.headers.get("content-length"));
    const filename = (match ? decodeURIComponent(match[1].replace(/"/g, "")) : null) || fallbackName;
    if (totalHeader) setTotal(totalHeader);
    const reader = fileResponse.body!.getReader();
    const chunks: Uint8Array[] = [];
    let count = 0;
    for (;;) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      chunks.push(chunk);
      count += chunk.length;
      setReceived(count);
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
    return filename;
  }

  async function downloadSingle(resource: string, quality: string, knownTitle: string | null) {
    setPhase("starting");
    setReceived(0);
    setTotal(null);
    const job = await createJob(resource, quality, cookies);
    registerHudJob({ id: job.id, title: knownTitle || "Video", status: job.status, at: Date.now() });

    let current = job;
    if (current.status === "queued" || current.status === "downloading") {
      setPhase("downloading");
      await waitForJob(job.id);
      updateHudJob(job.id, "ready");
    }

    setPhase("saving");
    try {
      await saveFile(job.id, knownTitle || "download");
      updateHudJob(job.id, "completed");
    } catch (err) {
      updateHudJob(job.id, "failed");
      throw err;
    }
    setPhase("completed");
    fireConfetti();
  }

  async function startDownload(quality: string) {
    const value = url.trim();
    if (!value) return;
    setError("");
    try {
      await downloadSingle(value, quality, info?.title || null);
    } catch (err) {
      setPhase("error");
      setError(friendlyError((err as Error).message));
    }
  }

  function togglePlaylistItem(itemUrl: string) {
    setPlaylistSel((prev) => {
      const next = new Set(prev);
      if (next.has(itemUrl)) next.delete(itemUrl);
      else next.add(itemUrl);
      return next;
    });
  }

  async function downloadPlaylistItems(items: PlaylistItem[]) {
    if (items.length === 0) return;
    setError("");
    setPhase("downloading");
    let ok = 0;
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      setPlaylistProgress({ done: index, total: items.length, current: item.title });
      let jobId = "unknown";
      try {
        const job = await createJob(item.url || "", "best", "");
        jobId = job.id;
        registerHudJob({ id: job.id, title: item.title || "Playlist item", status: job.status, at: Date.now() });
        if (job.status === "queued" || job.status === "downloading") await waitForJob(job.id);
        await saveFile(job.id, item.title || "download");
        updateHudJob(job.id, "completed");
        ok += 1;
      } catch {
        updateHudJob(jobId, "failed");
      }
    }
    setPlaylistProgress({ done: items.length, total: items.length, current: null });
    if (ok === items.length) {
      setPhase("completed");
      fireConfetti();
    } else {
      setPhase("error");
      setError(`${items.length - ok} of ${items.length} items could not be downloaded. The rest are saved.`);
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
    setPlaylist(null);
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
    } catch {
      try {
        const pl = await apiFetch<Playlist>(`/api/playlist?url=${encodeURIComponent(value)}`);
        setPlaylist(pl);
        setPlaylistSel(new Set(pl.items.map((item) => item.url).filter((u): u is string => Boolean(u))));
        setPhase("ready");
      } catch (plErr) {
        setPhase("error");
        setError(friendlyError((plErr as Error).message));
      }
    } finally {
      if (stepTimer.current) clearInterval(stepTimer.current);
    }
  }

  const percent = total ? Math.min(100, Math.round((received / total) * 100)) : null;
  const busyLabel =
    phase === "starting"
      ? tt(lang, "busy_starting")
      : phase === "downloading"
        ? tt(lang, "busy_downloading")
        : phase === "saving"
          ? tt(lang, "busy_saving")
          : tt(lang, "busy_checking");

  return (
    <section id="downloader" className="relative scroll-mt-24">
      <div ref={confettiRef} className="pointer-events-none absolute inset-x-0 top-0 z-20 h-3/4 overflow-hidden" aria-hidden="true" />
      <form onSubmit={handleSubmit} className="glass glass-hover p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative grow">
            <LinkIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary/60" />
            <input
              className="field !py-4 pl-11"
              placeholder={tt(lang, "input_placeholder")}
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
            {checking ? busyLabel : tt(lang, "btn_download")}
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
          {playlist && phase !== "checking" && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-5 rounded-2xl border border-white/10 bg-ink/50 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-cyan-glow">Playlist</p>
                  <h3 className="mt-1 break-words text-base font-bold sm:text-lg">{playlist.title || "Playlist"}</h3>
                  <p className="mt-0.5 text-xs text-secondary">
                    {playlist.count} of {playlist.total_count} items loaded
                  </p>
                </div>
                <div className="flex gap-2">
                  {playlist.pro_required && (
                    <Link href="/pro" className="btn-ghost !px-3 !py-1.5 text-xs !text-cyan-glow">
                      ⋯ {playlist.total_count - playlist.count} more with Pro
                    </Link>
                  )}
                  <button
                    type="button"
                    className="btn-ghost !px-3 !py-1.5 text-xs"
                    onClick={() => setPlaylistSel(new Set(playlist.items.map((item) => item.url).filter((u): u is string => Boolean(u))))}
                    disabled={checking}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className="btn-ghost !px-3 !py-1.5 text-xs"
                    onClick={() => setPlaylistSel(new Set())}
                    disabled={checking}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <ul className="mt-3 max-h-72 space-y-1.5 overflow-y-auto pr-1">
                {playlist.items.map((item) => (
                  <li
                    key={item.url}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
                      playlistSel.has(item.url || "") ? "border-brand/40 bg-brand/10" : "border-white/10 bg-white/[0.02]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 accent-[#087BFF]"
                      checked={playlistSel.has(item.url || "")}
                      onChange={() => togglePlaylistItem(item.url || "")}
                      disabled={checking}
                      aria-label={item.title || "item"}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm" title={item.title || ""}>
                      {item.title || "Untitled item"}
                    </span>
                    <span className="shrink-0 text-xs text-secondary">{formatDuration(item.duration)}</span>
                    <button
                      type="button"
                      className="btn-ghost shrink-0 !px-2.5 !py-1 text-[11px]"
                      onClick={() => downloadPlaylistItems([item])}
                      disabled={checking || !item.url}
                    >
                      Get
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="btn-primary mt-4 w-full sm:w-auto"
                onClick={() => downloadPlaylistItems(playlist.items.filter((item) => playlistSel.has(item.url || "")))}
                disabled={checking || playlistSel.size === 0}
              >
                <DownloadIcon className="h-4 w-4" />
                Download {playlistSel.size} selected
              </button>
              {playlistProgress && (phase === "downloading" || phase === "error") && (
                <p className="mt-3 text-xs text-secondary" aria-live="polite">
                  Item {Math.min(playlistProgress.done + (playlistProgress.current ? 1 : 0), playlistProgress.total)} of {playlistProgress.total}
                  {playlistProgress.current ? ` — ${playlistProgress.current}` : ""}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

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
                      <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-secondary/70">{tt(lang, "label_quality")}</p>
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
                      <p className="text-xs font-semibold uppercase tracking-widest text-secondary/70">{tt(lang, "label_quality")}</p>
                      <button type="button" onClick={() => setSelected("best")} className={`chip mt-2 ${selected === "best" ? "chip-selected" : ""}`} disabled={checking}>
                        {tt(lang, "chip_best")}
                      </button>
                    </div>
                  )}

                  {info.audio_only_available && (
                    <>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-secondary/70">{tt(lang, "label_audio")}</p>
                      <button type="button" onClick={() => setSelected("audio")} className={`chip mt-2 ${selected === "audio" ? "chip-selected" : ""}`} disabled={checking}>
                        {tt(lang, "chip_audio")}
                      </button>
                    </>
                  )}

                  {info.thumbnail && (
                    <a
                      className="btn-ghost mt-4 inline-flex w-full items-center justify-center gap-2 sm:w-auto"
                      href={`/api/thumbnail?url=${encodeURIComponent(url.trim())}&download=true`}
                      role="button"
                    >
                      Save thumbnail
                    </a>
                  )}

                  <button type="button" className="btn-primary mt-2 block w-full sm:w-auto" onClick={() => startDownload(selected)} disabled={checking}>
                    <DownloadIcon className="h-4 w-4" />
                    {selected === "audio"
                      ? tt(lang, "cta_audio")
                      : selected === "best"
                        ? tt(lang, "cta_best")
                        : `Download ${selected}`}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-4">
          <button
            type="button"
            className="text-xs font-semibold text-secondary transition-colors hover:text-white"
            onClick={() => setAdvancedOpen((v) => !v)}
            aria-expanded={advancedOpen}
          >
            ⚙ {tt(lang, "label_advanced")} {advancedOpen ? "▲" : "▼"}
          </button>
          {advancedOpen && (
            <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <textarea
                className="field min-h-20 font-mono text-xs"
                placeholder="# Netscape HTTP Cookie File…"
                value={cookies}
                onChange={(e) => setCookies(e.target.value)}
                maxLength={200000}
                rows={4}
              />
              <p className="mt-2 text-[11px] leading-relaxed text-secondary">{tt(lang, "cookies_hint")}</p>
            </div>
          )}
        </div>

        {percent != null && (phase === "downloading" || phase === "saving") && (
          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand to-cyan-glow transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-secondary" aria-live="polite">
              {phase === "saving" ? tt(lang, "busy_saving") : tt(lang, "busy_downloading")} · {formatBytes(received)}
              {total ? ` of ${formatBytes(total)}` : ""} · {percent}%
            </p>
          </div>
        )}

        {phase === "completed" && (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300" role="status">
            ✓ {tt(lang, "done_saved")} · {formatBytes(received)}
          </div>
        )}
      </form>
    </section>
  );
}
