"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, getAdminToken, setAdminToken } from "../../lib/api";

const ADAPTERS = ["http_mirror", "proxy_pass", "ytdlp"];

const ADAPTER_HINTS: Record<string, string> = {
  http_mirror: "Plain mirror: GET {base_url}/{resource} — base URL required",
  proxy_pass: "POST {base_url} with {\"resource\": …} — base URL required",
  ytdlp: "Social video extraction via yt-dlp (YouTube, TikTok, FB, IG…) — no base URL needed",
};

type Provider = {
  id: number;
  name: string;
  adapter: string;
  base_url: string;
  has_api_key: boolean;
  has_cookies: boolean;
  priority: number;
  is_active: boolean;
  timeout_seconds: number;
  last_status: string | null;
};

type FormState = {
  name: string;
  adapter: string;
  base_url: string;
  api_key: string;
  cookies: string;
  priority: number | string;
  timeout_seconds: number | string;
  is_active: boolean;
};

const emptyForm: FormState = {
  name: "",
  adapter: "http_mirror",
  base_url: "",
  api_key: "",
  cookies: "",
  priority: 100,
  timeout_seconds: 30,
  is_active: true,
};

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const authed = Boolean(token) && Boolean(providers);

  const load = useCallback(async (activeToken?: string) => {
    const saved = activeToken ?? getAdminToken();
    if (!saved) {
      setProviders(null);
      return;
    }
    try {
      setProviders(await apiFetch<Provider[]>("/api/admin/providers", { admin: true }));
    } catch (err) {
      setProviders(null);
      setError(`Could not load providers: ${(err as Error).message}`);
    }
  }, []);

  useEffect(() => {
    const saved = getAdminToken();
    setToken(saved);
    load(saved);
  }, [load]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const payload: Record<string, unknown> = {
        ...form,
        api_key: form.api_key || null,
        cookies: form.cookies,
        priority: Number(form.priority),
        timeout_seconds: Number(form.timeout_seconds),
      };
      if (editingId && !form.cookies.trim()) delete payload.cookies;
      if (editingId) {
        await apiFetch(`/api/admin/providers/${editingId}`, { method: "PATCH", body: payload, admin: true });
        setMessage(`Provider "${form.name}" updated.`);
      } else {
        await apiFetch("/api/admin/providers", { method: "POST", body: payload, admin: true });
        setMessage(`Provider "${form.name}" created.`);
      }
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeProvider(id: number, name: string) {
    if (!window.confirm(`Delete provider "${name}"?`)) return;
    try {
      await apiFetch(`/api/admin/providers/${id}`, { method: "DELETE", admin: true });
      setMessage(`Provider "${name}" deleted.`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function testProvider(id: number) {
    setMessage("");
    setError("");
    try {
      const result = await apiFetch<{ status: string }>(`/api/admin/providers/${id}/test`, { method: "POST", admin: true });
      setMessage(result.status === "up" ? "Provider is up." : `Provider is ${result.status}.`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function editProvider(provider: Provider) {
    setEditingId(provider.id);
    setForm({
      name: provider.name,
      adapter: provider.adapter,
      base_url: provider.base_url,
      api_key: "",
      cookies: "",
      priority: provider.priority,
      timeout_seconds: provider.timeout_seconds,
      is_active: provider.is_active,
    });
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }

  if (!authed) {
    return (
      <div className="section-pad max-w-lg py-16">
        <h1 className="text-3xl font-extrabold">
          Admin <span className="gradient-text">sign-in</span>
        </h1>
        <p className="mt-3 text-sm text-secondary">Enter the admin token (ADMIN_TOKEN of the backend) to manage providers.</p>
        <form
          className="glass mt-8 p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            setAdminToken(token);
            setMessage("");
            setError("");
            await load(token);
          }}
        >
          <input
            className="field"
            type="password"
            placeholder="Admin token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="current-password"
          />
          <button type="submit" className="btn-primary mt-4 w-full">Unlock</button>
          {error && <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
        </form>
        <Link href="/" className="mt-6 inline-block text-sm font-semibold text-brand hover:text-cyan-glow">
          ← Back to app
        </Link>
      </div>
    );
  }

  const total = providers?.length ?? 0;
  const activeCount = (providers || []).filter((p) => p.is_active).length;
  const downCount = (providers || []).filter((p) => p.last_status === "down").length;

  return (
    <div className="section-pad py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">
            Provider <span className="gradient-text">Manager</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-secondary">
            Highest priority (lowest number) is tried first. A provider that fails to answer is skipped automatically.
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <Link href="/" className="text-sm font-semibold text-brand hover:text-cyan-glow">← Back to app</Link>
          <div className="flex gap-2 text-xs">
            <span className="glass !rounded-full px-3 py-1.5"><strong>{total}</strong> <span className="text-secondary">total</span></span>
            <span className="glass !rounded-full px-3 py-1.5 text-emerald-300"><strong>{activeCount}</strong> <span className="text-secondary/70">active</span></span>
            {downCount > 0 && (
              <span className="glass !rounded-full px-3 py-1.5 text-red-300"><strong>{downCount}</strong> <span className="text-secondary/70">down</span></span>
            )}
          </div>
        </div>
      </div>

      {message && (
        <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300" role="status">
          {message}
        </div>
      )}
      {error && (
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
          {error}
        </div>
      )}

      <div className="glass mt-6 p-4 sm:p-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-widest text-secondary/70">
                <th className="px-3 py-3">Name</th>
                <th className="px-3 py-3">Adapter</th>
                <th className="px-3 py-3">Base URL</th>
                <th className="px-3 py-3">Priority</th>
                <th className="px-3 py-3">Health</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Key</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {(providers || []).map((p) => (
                <tr key={p.id} className="border-t border-white/5">
                  <td className="px-3 py-3 font-semibold">{p.name}</td>
                  <td className="px-3 py-3 font-mono text-xs text-secondary">{p.adapter}</td>
                  <td className="max-w-[200px] truncate px-3 py-3 font-mono text-xs text-secondary">{p.base_url}</td>
                  <td className="px-3 py-3">{p.priority}</td>
                  <td className="px-3 py-3">
                    {p.last_status ? (
                      <span className={`pill-flow ${p.last_status === "up" ? "border-emerald-500/40 text-emerald-300" : "border-red-500/40 text-red-300"}`}>
                        {p.last_status}
                      </span>
                    ) : (
                      <span className="text-secondary/50">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`pill-flow ${p.is_active ? "border-emerald-500/40 text-emerald-300" : "border-white/15 text-secondary"}`}>
                      {p.is_active ? "active" : "inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-secondary">{p.has_api_key ? "set" : "—"}</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => editProvider(p)} className="btn-ghost !px-3 !py-1.5 !text-xs">Edit</button>
                      <button type="button" onClick={() => testProvider(p.id)} className="btn-ghost !px-3 !py-1.5 !text-xs">Test</button>
                      <button
                        type="button"
                        onClick={() => removeProvider(p.id, p.name)}
                        className="btn-ghost !px-3 !py-1.5 !text-xs !border-red-500/40 !text-red-300 hover:!bg-red-500/10"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {providers && providers.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-secondary">No providers yet — add the first one below.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass mt-6 p-4 sm:p-6" id="provider-form">
        <h2 className="text-lg font-bold">{editingId ? `Edit provider #${editingId}` : "Add provider"}</h2>
        <form onSubmit={onSubmit} className="mt-4">
          <div className="rounded-xl border border-white/10 bg-ink/40 p-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-brand">Basics</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs text-secondary">Name</span>
                <input required className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs text-secondary">Adapter</span>
                <select className="field" value={form.adapter} onChange={(e) => setForm({ ...form, adapter: e.target.value })}>
                  {ADAPTERS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs text-secondary">Base URL {form.adapter === "ytdlp" ? "(not used for ytdlp)" : ""}</span>
                <input
                  required={form.adapter !== "ytdlp"}
                  className="field"
                  placeholder="https://mirror.example.com"
                  value={form.base_url}
                  onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                />
                <span className="mt-1 block text-[11px] text-secondary/70">{ADAPTER_HINTS[form.adapter]}</span>
              </label>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-ink/40 p-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-brand">Advanced</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs text-secondary">Cookies (optional — for Facebook/Instagram/private videos)</span>
                <textarea
                  className="field min-h-[90px] font-mono text-xs"
                  rows={4}
                  placeholder={editingId === null ? "Paste a Netscape cookies.txt export here" : "Leave empty to keep current cookies"}
                  value={form.cookies || ""}
                  onChange={(e) => setForm({ ...form, cookies: e.target.value })}
                />
                <span className="mt-1 block text-[11px] text-secondary/70">Export with a "cookies.txt" browser extension. Never share these cookies.</span>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs text-secondary">API key (optional)</span>
                <input
                  type="password"
                  className="field"
                  placeholder={editingId === null ? "Bearer key for the upstream" : "Leave empty to keep current"}
                  value={form.api_key}
                  onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                  autoComplete="new-password"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs text-secondary">Priority (1 = first)</span>
                <input type="number" min={1} className="field" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs text-secondary">Timeout (seconds)</span>
                <input type="number" min={1} max={600} className="field" value={form.timeout_seconds} onChange={(e) => setForm({ ...form, timeout_seconds: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs text-secondary">Active</span>
                <select
                  className="field"
                  value={form.is_active ? "yes" : "no"}
                  onChange={(e) => setForm({ ...form, is_active: e.target.value === "yes" })}
                >
                  <option value="yes">Active</option>
                  <option value="no">Inactive</option>
                </select>
              </label>
            </div>
          </div>

          <div className="mt-5 flex gap-3">
            <button type="submit" className="btn-primary" disabled={busy}>
              {editingId ? "Save changes" : "Create provider"}
            </button>
            {editingId && (
              <button type="button" className="btn-ghost" onClick={() => { setEditingId(null); setForm(emptyForm); }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
