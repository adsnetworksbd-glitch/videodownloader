"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { resolveBrand } from "../lib/brand-lookup";

type Site = { name: string; domain: string; category: string; status: string; formats: string[] };
type CatalogResponse = { total: number; page: number; pages: number; items: Site[] };

const PAGE_SIZE = 24;

export default function SitesDirectory() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [state, setState] = useState<{ data: CatalogResponse | null; error: string }>({
    data: null,
    error: "",
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
      if (query.trim()) params.set("q", query.trim());
      if (category) params.set("category", category);
      const res = await fetch(`/api/catalog/sites?${params.toString()}`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setState({ data: await res.json(), error: "" });
    } catch (err) {
      setState({ data: null, error: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }, [query, category, page]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const data = state.data;

  return (
    <>
      <div className="glass flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <input
          className="field sm:max-w-xs"
          placeholder="Search provider…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          aria-label="Search providers"
        />
        <div className="flex flex-wrap gap-2">
          {["", "Social Media", "Video Sharing", "Streaming", "Educational", "Entertainment", "News & Media", "Cloud Video", "Creator", "Other"].map((cat) => (
            <button
              key={cat || "all"}
              type="button"
              onClick={() => { setCategory(cat); setPage(1); }}
              className={`chip ${category === cat ? "chip-selected" : ""}`}
            >
              {cat || "All"}
            </button>
          ))}
        </div>
      </div>

      {state.error && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
          {state.error}
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading && !data && <p className="text-sm text-secondary">Loading providers…</p>}
        {data?.items.map((site) => (
          <div key={site.domain + site.name} className="glass glass-hover p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                {(() => {
                  const brand = resolveBrand(site.name);
                  return (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5">
                        <brand.Icon className="h-3.5 w-3.5" style={{ color: brand.color }} />
                      </span>
                      <p className="truncate text-sm font-bold">{site.name}</p>
                    </div>
                  );
                })()}
                <p className="truncate pl-8 text-xs text-secondary">{site.domain}</p>
              </div>
              <span
                className={`pill-flow shrink-0 ${
                  site.status === "verified"
                    ? "border-emerald-500/40 text-emerald-300"
                    : "border-white/15 text-secondary"
                }`}
              >
                {site.status === "verified" ? "✓ verified" : "supported"}
              </span>
            </div>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-widest text-brand">{site.category}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {site.formats.map((f) => (
                <span key={f} className="pill-flow text-secondary">{f}</span>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <Link
                className="btn-ghost !px-3 !py-1.5 text-xs"
                href={`/?url=${encodeURIComponent(`https://${site.domain}/`)}`}
              >
                Try it →
              </Link>
            </div>
          </div>
        ))}
        {data && data.items.length === 0 && (
          <p className="text-sm text-secondary">No providers match your search.</p>
        )}
      </div>

      {data && data.pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button type="button" className="btn-ghost" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
            ← Prev
          </button>
          <span className="text-sm text-secondary">
            Page {data.page} of {data.pages}
          </span>
          <button type="button" className="btn-ghost" disabled={page >= data.pages || loading} onClick={() => setPage(page + 1)}>
            Next →
          </button>
        </div>
      )}
    </>
  );
}
