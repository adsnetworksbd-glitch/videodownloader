"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, getAdminToken, setAdminToken } from "../../lib/api";
import { resolveBrand } from "../../lib/brand-lookup";

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

type AdminStats = {
  jobs_total: number;
  statuses: Record<string, number>;
  active_downloads: number;
  providers_total: number;
  providers_up: number;
  providers_down: number;
  providers_down_list: string[];
  daily: { date: string; count: number }[];
  trending: { domain: string; downloads: number }[];
};

type AdminMessage = {
  id: number;
  kind: string;
  name: string;
  phone: string | null;
  txid: string | null;
  body: string;
  is_read: boolean;
  created_at: string;
};

type Ban = {
  ip: string;
  reason: string | null;
  created_at: string;
};

type License = {
  key: string;
  plan: string;
  note: string | null;
  is_active: boolean;
  expires_at: string | null;
  redeemed_at: string | null;
  created_at: string;
};

type AdminJob = {
  id: string;
  resource: string;
  status: string;
  quality: string | null;
  filename: string | null;
  error: string | null;
  content_length: number | null;
  created_at: string;
};

type ProPkg = {
  id: number;
  name: string;
  price: number;
  duration_days: number;
  description: string | null;
  is_active: boolean;
};

type ProOrderRow = {
  id: number;
  package_id: number | null;
  txid: string;
  contact: string | null;
  status: string;
  license_key: string | null;
  created_at: string;
};

type ApiKeyRow = {
  key: string;
  label: string | null;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
};

const SETTING_FIELDS: { key: string; label: string; hint: string; kind: "number" | "text" }[] = [
  { key: "free_daily_limit", label: "Free daily limit", hint: "Downloads per IP per day without Pro", kind: "number" },
  { key: "pro_daily_limit", label: "Pro daily limit", hint: "Downloads per day for Pro users", kind: "number" },
  { key: "free_playlist_items", label: "Free playlist items", hint: "Playlist items free users can grab", kind: "number" },
  { key: "rate_limit_requests", label: "Rate limit requests", hint: "Requests per window (needs restart)", kind: "number" },
  { key: "rate_limit_window", label: "Rate limit window (s)", hint: "Window length in seconds (needs restart)", kind: "number" },
  { key: "pro_instant_activation", label: "Instant key (1/0)", hint: "1 = key activates immediately on purchase; 0 = approve manually in Package orders", kind: "number" },
  { key: "telegram_alert_chat_id", label: "Telegram chat ID", hint: "New orders/messages are also sent to this chat (bot token lives in backend env)", kind: "text" },
];

const SETTING_DEFAULTS: Record<string, string> = {
  telegram_alert_chat_id: "",
  free_daily_limit: "100",
  pro_daily_limit: "1000",
  free_playlist_items: "10",
  rate_limit_requests: "60",
  rate_limit_window: "60",
  pro_instant_activation: "1",
  notice_message: "",
};

const JOB_TERMINAL = new Set(["failed", "ready", "completed"]);

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
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [licenseForm, setLicenseForm] = useState<{ days: number | string; note: string }>({ days: 30, note: "" });
  const [lastKey, setLastKey] = useState("");
  const [proPackages, setProPackages] = useState<ProPkg[]>([]);
  const [pkgForm, setPkgForm] = useState({ name: "", price: "", duration_days: "30", description: "" });
  const [proOrders, setProOrders] = useState<ProOrderRow[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([]);
  const [apiKeyForm, setApiKeyForm] = useState("");
  const [settings, setSettings] = useState<Record<string, string>>(SETTING_DEFAULTS);
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [messages, setMessages] = useState<AdminMessage[] | null>(null);
  const [messageKind, setMessageKind] = useState<"all" | "message" | "pro_order">("all");
  const [bans, setBans] = useState<Ban[]>([]);
  const [banForm, setBanForm] = useState<{ ip: string; reason: string }>({ ip: "", reason: "" });

  const authed = Boolean(token) && Boolean(providers);

  useEffect(() => {
    if (!authed) return;
    let alive = true;
    const loadStats = async () => {
      try {
        const data = await apiFetch<AdminStats>("/api/admin/stats", { admin: true });
        if (alive) setStats(data);
      } catch {}
    };
    loadStats();
    const timer = setInterval(loadStats, 10000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [authed]);

  const loadLicenses = useCallback(async () => {
    if (!authed) return;
    try {
      setLicenses(await apiFetch<License[]>("/api/admin/licenses", { admin: true }));
    } catch {}
  }, [authed]);

  useEffect(() => {
    loadLicenses();
  }, [loadLicenses]);

  const loadProData = useCallback(async () => {
    if (!authed) return;
    try {
      const [pkgs, orders, keys] = await Promise.all([
        apiFetch<ProPkg[]>("/api/admin/packages", { admin: true }),
        apiFetch<ProOrderRow[]>("/api/admin/orders?limit=200", { admin: true }),
        apiFetch<ApiKeyRow[]>("/api/admin/apikeys", { admin: true }),
      ]);
      setProPackages(pkgs);
      setProOrders(orders);
      setApiKeys(keys);
    } catch {}
  }, [authed]);

  useEffect(() => {
    loadProData();
  }, [loadProData]);

  const createPackage = async () => {
    setError("");
    setMessage("");
    const price = Number(pkgForm.price);
    const days = Number(pkgForm.duration_days);
    if (!pkgForm.name.trim() || !price || price <= 0 || !days || days <= 0) {
      setError("Package name, price and valid days are required.");
      return;
    }
    try {
      await apiFetch("/api/admin/packages", {
        method: "POST",
        body: {
          name: pkgForm.name.trim(),
          price,
          duration_days: days,
          description: pkgForm.description.trim() || null,
        },
        admin: true,
      });
      setPkgForm({ name: "", price: "", duration_days: "30", description: "" });
      setMessage("Package created - it is live on the /pro page now.");
      await loadProData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const patchPackage = async (pkg: ProPkg, changes: Record<string, unknown>) => {
    try {
      await apiFetch(`/api/admin/packages/${pkg.id}`, { method: "PATCH", body: changes, admin: true });
      await loadProData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const deletePackage = async (pkg: ProPkg) => {
    if (!window.confirm(`Delete package "${pkg.name}"?`)) return;
    try {
      await apiFetch(`/api/admin/packages/${pkg.id}`, { method: "DELETE", admin: true });
      setMessage("Package deleted.");
      await loadProData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const setOrderStatus = async (order: ProOrderRow, next: "completed" | "rejected") => {
    try {
      await apiFetch(`/api/admin/orders/${order.id}`, { method: "PATCH", body: { status: next }, admin: true });
      setMessage(next === "completed" ? "Order completed - key is active for the buyer." : "Order rejected - key disabled.");
      await loadProData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const deleteOrder = async (order: ProOrderRow) => {
    if (!window.confirm("Delete this order?")) return;
    try {
      await apiFetch(`/api/admin/orders/${order.id}`, { method: "DELETE", admin: true });
      await loadProData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const createApiKey = async () => {
    setError("");
    setMessage("");
    try {
      const created = await apiFetch<ApiKeyRow>("/api/admin/apikeys", {
        method: "POST",
        body: { label: apiKeyForm.trim() || null },
        admin: true,
      });
      setApiKeyForm("");
      setMessage(`API key created - copy it now: ${created.key}`);
      await loadProData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const toggleApiKey = async (row: ApiKeyRow) => {
    try {
      await apiFetch(`/api/admin/apikeys/${row.key}`, { method: "PATCH", body: { is_active: !row.is_active }, admin: true });
      await loadProData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const deleteApiKey = async (row: ApiKeyRow) => {
    if (!window.confirm("Delete this API key? Clients using it stop working immediately.")) return;
    try {
      await apiFetch(`/api/admin/apikeys/${row.key}`, { method: "DELETE", admin: true });
      await loadProData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const loadSettings = useCallback(async () => {
    if (!authed) return;
    try {
      const data = await apiFetch<Record<string, string>>("/api/admin/settings", { admin: true });
      setSettings({ ...SETTING_DEFAULTS, ...data });
    } catch {}
  }, [authed]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const loadJobs = useCallback(async () => {
    if (!authed) return;
    try {
      setJobs(await apiFetch<AdminJob[]>("/api/admin/jobs?limit=20", { admin: true }));
    } catch {}
  }, [authed]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const loadMessages = useCallback(async () => {
    if (!authed) return;
    try {
      const query = messageKind === "all" ? "" : `?kind=${messageKind}`;
      setMessages(await apiFetch<AdminMessage[]>(`/api/admin/messages${query}`, { admin: true }));
    } catch {}
  }, [authed, messageKind]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const loadBans = useCallback(async () => {
    if (!authed) return;
    try {
      setBans(await apiFetch<Ban[]>("/api/admin/bans", { admin: true }));
    } catch {}
  }, [authed]);

  useEffect(() => {
    loadBans();
  }, [loadBans]);

  function exportData() {
    apiFetch<Record<string, unknown>>("/api/admin/export", { admin: true })
      .then((data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "videodownloader-export.json";
        link.click();
        URL.revokeObjectURL(link.href);
      })
      .catch((err) => setError((err as Error).message));
  }

  async function banSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await apiFetch("/api/admin/bans", { method: "POST", body: banForm, admin: true });
      setBanForm({ ip: "", reason: "" });
      setMessage("IP banned.");
      await loadBans();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const payload: Record<string, string> = {};
      for (const field of SETTING_FIELDS) payload[field.key] = String(settings[field.key] ?? "");
      payload.notice_message = settings.notice_message || "";
      await apiFetch("/api/admin/settings", { method: "PUT", body: payload, admin: true });
      setMessage("Site settings saved. Rate limit values apply after backend restart; the rest apply instantly.");
      await loadSettings();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function deleteJob(jobId: string) {
    if (!window.confirm("Delete this job and its file?")) return;
    setError("");
    try {
      await apiFetch(`/api/admin/jobs/${jobId}`, { method: "DELETE", admin: true });
      await loadJobs();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function retryJob(jobId: string) {
    setError("");
    setMessage("");
    try {
      await apiFetch(`/api/admin/jobs/${jobId}/retry`, { method: "POST", admin: true });
      setMessage("Job re-queued.");
      await loadJobs();
    } catch (err) {
      setError((err as Error).message);
    }
  }

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

      {stats && (
        <div className="glass mt-6 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">
              Live <span className="gradient-text">stats</span>
            </h2>
            <span className="text-[11px] text-secondary/70">auto-refreshes every 10s</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <p className="text-2xl font-extrabold text-white">{stats.jobs_total}</p>
              <p className="mt-0.5 text-[11px] uppercase tracking-widest text-secondary/70">Total jobs</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <p className="text-2xl font-extrabold text-emerald-300">
                {(stats.statuses.ready || 0) + (stats.statuses.completed || 0)}
              </p>
              <p className="mt-0.5 text-[11px] uppercase tracking-widest text-secondary/70">Succeeded</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <p className="text-2xl font-extrabold text-red-300">{stats.statuses.failed || 0}</p>
              <p className="mt-0.5 text-[11px] uppercase tracking-widest text-secondary/70">Failed</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <p className="text-2xl font-extrabold text-cyan-glow">{stats.active_downloads}</p>
              <p className="mt-0.5 text-[11px] uppercase tracking-widest text-secondary/70">In progress</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-secondary">
            <span className="pill-flow border-emerald-500/40 text-emerald-300">
              providers up: <strong className="text-white">{stats.providers_up}</strong>/{stats.providers_total}
            </span>
            {stats.providers_down > 0 && (
              <span className="pill-flow border-red-500/40 text-red-300">
                providers down: <strong className="text-white">{stats.providers_down}</strong>
                {stats.providers_down_list?.length ? <span className="text-secondary/70"> ({stats.providers_down_list.join(", ")})</span> : null}
              </span>
            )}
          </div>
          {(stats.daily?.length || 0) > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-secondary/70">Downloads last 7 days</p>
              <div className="mt-2 flex h-24 items-end gap-2">
                {stats.daily.map((day) => {
                  const max = Math.max(...stats.daily.map((d) => d.count), 1);
                  return (
                    <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t-md bg-gradient-to-t from-brand/60 to-cyan-glow/80"
                        style={{ height: `${Math.max(4, Math.round((day.count / max) * 88))}px` }}
                        title={`${day.date}: ${day.count}`}
                      />
                      <span className="text-[10px] text-secondary/60">{day.date.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {stats.trending.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-secondary/70">Trending sources</p>
              <ul className="mt-2 space-y-1 text-xs text-secondary">
                {stats.trending.map((entry) => {
                  const brand = resolveBrand(entry.domain);
                  return (
                    <li key={entry.domain} className="flex items-center justify-between gap-4">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
                          <brand.Icon className="h-3.5 w-3.5" style={{ color: brand.color }} />
                        </span>
                        <span className="truncate font-mono">{entry.domain}</span>
                      </span>
                      <span className="text-secondary/70">{entry.downloads}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="glass mt-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">
            Pro <span className="gradient-text">licenses</span>
          </h2>
          <div className="flex items-center gap-3">
            <button type="button" className="btn-ghost !px-3 !py-1 text-xs" onClick={exportData}>
              ⬇ Export data (JSON)
            </button>
            <Link href="/pro" className="text-xs font-semibold text-brand hover:text-cyan-glow">
              View the Pro page →
            </Link>
          </div>
        </div>
        <form
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setMessage("");
            try {
              const created = await apiFetch<License>("/api/admin/licenses", {
                method: "POST",
                body: { plan: "pro", days: Number(licenseForm.days) || null, note: licenseForm.note || null },
                admin: true,
              });
              setLastKey(created.key);
              setLicenseForm({ days: 30, note: "" });
              setMessage(`License created — copy it now: ${created.key}`);
              await loadLicenses();
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        >
          <div className="w-full sm:w-32">
            <label className="mb-1 block text-[11px] uppercase tracking-widest text-secondary/70" htmlFor="license-days">
              Valid days
            </label>
            <input
              id="license-days"
              className="field"
              type="number"
              min={1}
              max={3650}
              value={licenseForm.days}
              onChange={(e) => setLicenseForm({ ...licenseForm, days: e.target.value })}
            />
          </div>
          <div className="grow">
            <label className="mb-1 block text-[11px] uppercase tracking-widest text-secondary/70" htmlFor="license-note">
              Note (customer)
            </label>
            <input
              id="license-note"
              className="field"
              placeholder="customer email or bKash ref"
              value={licenseForm.note}
              onChange={(e) => setLicenseForm({ ...licenseForm, note: e.target.value })}
              maxLength={255}
            />
          </div>
          <button type="submit" className="btn-primary">Generate key</button>
        </form>
        {lastKey && (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-cyan-glow/40 bg-cyan-glow/10 px-4 py-3">
            <code className="font-mono text-sm font-bold text-cyan-glow">{lastKey}</code>
            <button
              type="button"
              className="btn-ghost !px-3 !py-1 text-xs"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(lastKey);
                  setMessage("Key copied to clipboard.");
                } catch {}
              }}
            >
              Copy
            </button>
          </div>
        )}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-widest text-secondary/70">
                <th className="px-3 py-2">Key</th>
                <th className="px-3 py-2">Expires</th>
                <th className="px-3 py-2">Redeemed</th>
                <th className="px-3 py-2">State</th>
                <th className="px-3 py-2">Note</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((license) => (
                <tr key={license.key} className="border-t border-white/5">
                  <td className="px-3 py-2 font-mono text-xs">{license.key}</td>
                  <td className="px-3 py-2 text-xs text-secondary">
                    {license.expires_at ? new Date(license.expires_at).toLocaleDateString("en-US") : "no expiry"}
                  </td>
                  <td className="px-3 py-2 text-xs text-secondary">
                    {license.redeemed_at ? new Date(license.redeemed_at).toLocaleDateString("en-US") : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`pill-flow ${license.is_active ? "border-emerald-500/40 text-emerald-300" : "border-white/15 text-secondary"}`}>
                      {license.is_active ? "active" : "inactive"}
                    </span>
                  </td>
                  <td className="max-w-[180px] truncate px-3 py-2 text-xs text-secondary">{license.note || "—"}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="btn-ghost !px-2.5 !py-1 text-[11px]"
                      onClick={async () => {
                        try {
                          await apiFetch(`/api/admin/licenses/${license.key}`, {
                            method: "PATCH",
                            body: { is_active: !license.is_active },
                            admin: true,
                          });
                          await loadLicenses();
                        } catch (err) {
                          setError((err as Error).message);
                        }
                      }}
                    >
                      {license.is_active ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              ))}
              {licenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-xs text-secondary">
                    No licenses yet — generate the first one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass mt-6 p-4 sm:p-6">
        <h2 className="text-lg font-bold">
          Developer <span className="gradient-text">API keys</span>
        </h2>
        <p className="mt-1 text-xs text-secondary">
          Partners call <code className="text-cyan-glow">GET /api/v1/info?url=...</code> and <code className="text-cyan-glow">GET /api/v1/direct?url=...</code> with the header X-API-Key.
        </p>
        <form
          className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void createApiKey();
          }}
        >
          <div className="grow">
            <label className="mb-1 block text-[11px] uppercase tracking-widest text-secondary/70" htmlFor="apikey-label">
              Label (who uses it)
            </label>
            <input
              id="apikey-label"
              className="field"
              placeholder="partner app / client name"
              value={apiKeyForm}
              onChange={(e) => setApiKeyForm(e.target.value)}
              maxLength={255}
            />
          </div>
          <button type="submit" className="btn-primary">Create API key</button>
        </form>
        <ul className="mt-4">
          {apiKeys.map((row) => (
            <li key={row.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-white/5 py-2 text-sm">
              <code className="font-mono text-xs text-cyan-glow">{row.key}</code>
              <span className="max-w-[220px] truncate text-xs text-secondary">{row.label || "no label"}</span>
              <span className={`pill-flow ${row.is_active ? "border-emerald-500/40 text-emerald-300" : "border-white/15 text-secondary"}`}>
                {row.is_active ? "active" : "inactive"}
              </span>
              <span className="ml-auto flex gap-2">
                <button type="button" className="btn-ghost !px-2.5 !py-1 text-[11px]" onClick={() => void toggleApiKey(row)}>
                  {row.is_active ? "Disable" : "Enable"}
                </button>
                <button
                  type="button"
                  className="btn-ghost !px-2.5 !py-1 text-[11px] !border-red-500/40 !text-red-300 hover:!bg-red-500/10"
                  onClick={() => void deleteApiKey(row)}
                >
                  Delete
                </button>
              </span>
            </li>
          ))}
          {apiKeys.length === 0 && (
            <li className="px-2 py-6 text-center text-xs text-secondary">No API keys yet - create one above for developer partners.</li>
          )}
        </ul>
      </div>

      <div className="glass mt-6 p-4 sm:p-6">
        <h2 className="text-lg font-bold">
          Pro <span className="gradient-text">packages</span>
        </h2>
        <p className="mt-1 text-xs text-secondary">
          Users pick a package on the /pro page, pay via bKash/Nagad and submit the TrxID - keys are issued instantly unless Instant key is set to 0 in Site settings.
        </p>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            void createPackage();
          }}
        >
          <label className="block">
            <span className="mb-1.5 block text-xs text-secondary">Package name</span>
            <input className="field" placeholder="Monthly Pro" value={pkgForm.name} onChange={(e) => setPkgForm({ ...pkgForm, name: e.target.value })} maxLength={80} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-secondary">Price (৳)</span>
            <input className="field" type="number" min={1} placeholder="199" value={pkgForm.price} onChange={(e) => setPkgForm({ ...pkgForm, price: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-secondary">Duration (days)</span>
            <input className="field" type="number" min={1} max={3650} value={pkgForm.duration_days} onChange={(e) => setPkgForm({ ...pkgForm, duration_days: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-secondary">Description (optional)</span>
            <input className="field" placeholder="1000 downloads / day" value={pkgForm.description} onChange={(e) => setPkgForm({ ...pkgForm, description: e.target.value })} maxLength={255} />
          </label>
          <button type="submit" className="btn-primary self-end">Add package</button>
        </form>
        <ul className="mt-4">
          {proPackages.map((pkg) => (
            <li key={pkg.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-white/5 py-2 text-sm">
              <strong className="text-white">{pkg.name}</strong>
              <span className="text-secondary">{pkg.price}৳ / {pkg.duration_days}d</span>
              <span className="max-w-[240px] truncate text-xs text-secondary">{pkg.description || ""}</span>
              <span className={`pill-flow ${pkg.is_active ? "border-emerald-500/40 text-emerald-300" : "border-white/15 text-secondary"}`}>
                {pkg.is_active ? "visible" : "hidden"}
              </span>
              <span className="ml-auto flex gap-2">
                <button
                  type="button"
                  className="btn-ghost !px-2.5 !py-1 text-[11px]"
                  onClick={() => void patchPackage(pkg, { is_active: !pkg.is_active })}
                >
                  {pkg.is_active ? "Hide" : "Show"}
                </button>
                <button
                  type="button"
                  className="btn-ghost !px-2.5 !py-1 text-[11px] !border-red-500/40 !text-red-300 hover:!bg-red-500/10"
                  onClick={() => void deletePackage(pkg)}
                >
                  Delete
                </button>
              </span>
            </li>
          ))}
          {proPackages.length === 0 && (
            <li className="px-2 py-6 text-center text-xs text-secondary">No packages yet - add one above and it appears on /pro instantly.</li>
          )}
        </ul>
      </div>

      <div className="glass mt-6 p-4 sm:p-6">
        <h2 className="text-lg font-bold">
          Site <span className="gradient-text">settings</span>
        </h2>
        <p className="mt-1 text-xs text-secondary">
          Limits apply instantly. Rate limit values take effect after a backend restart.
        </p>
        <form className="mt-4" onSubmit={saveSettings}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {SETTING_FIELDS.map((field) => (
              <label key={field.key} className="block">
                <span className="mb-1.5 block text-xs text-secondary">{field.label}</span>
                <input
                  type={field.kind}
                  min={field.kind === "number" ? 0 : undefined}
                  className="field"
                  value={settings[field.key] ?? ""}
                  onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })}
                />
                <span className="mt-1 block text-[11px] text-secondary/70">{field.hint}</span>
              </label>
            ))}
          </div>
          <label className="mt-3 block">
            <span className="mb-1.5 block text-xs text-secondary">Site notice (empty = hidden)</span>
            <textarea
              className="field min-h-[70px]"
              rows={2}
              maxLength={500}
              placeholder="Maintenance tonight at 2 AM BST"
              value={settings.notice_message || ""}
              onChange={(e) => setSettings({ ...settings, notice_message: e.target.value })}
            />
            <span className="mt-1 block text-[11px] text-secondary/70">
              Shows a dismissible announcement bar on every page for all visitors.
            </span>
          </label>
          <button type="submit" className="btn-primary mt-4">Save settings</button>
        </form>
      </div>

      <div className="glass mt-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">
            Recent <span className="gradient-text">jobs</span>
          </h2>
          <button type="button" className="btn-ghost !px-3 !py-1 text-xs" onClick={() => loadJobs()}>
            Refresh
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-widest text-secondary/70">
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">File / Source</th>
                <th className="px-3 py-2">Quality</th>
                <th className="px-3 py-2">Size</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-t border-white/5">
                  <td className="px-3 py-2">
                    <span
                      className={`pill-flow ${
                        job.status === "failed"
                          ? "border-red-500/40 text-red-300"
                          : job.status === "ready" || job.status === "completed"
                            ? "border-emerald-500/40 text-emerald-300"
                            : "border-cyan-glow/40 text-cyan-glow"
                      }`}
                    >
                      {job.status}
                    </span>
                  </td>
                  <td className="max-w-[260px] truncate px-3 py-2 text-xs">
                    {job.filename || job.resource}
                    <span className="block truncate text-secondary/60">{job.id}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-secondary">{job.quality || "—"}</td>
                  <td className="px-3 py-2 text-xs text-secondary">
                    {job.content_length ? `${(job.content_length / 1024 / 1024).toFixed(1)} MB` : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-secondary">
                    {new Date(job.created_at).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      {JOB_TERMINAL.has(job.status) && (
                        <button type="button" className="btn-ghost !px-2.5 !py-1 text-[11px]" onClick={() => retryJob(job.id)}>
                          Retry
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-ghost !px-2.5 !py-1 text-[11px] !border-red-500/40 !text-red-300 hover:!bg-red-500/10"
                        onClick={() => deleteJob(job.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-xs text-secondary">
                    No jobs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass mt-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">
            Orders &amp; <span className="gradient-text">messages</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {(["all", "message", "pro_order"] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                className={`${messageKind === kind ? "btn-primary" : "btn-ghost"} !px-3 !py-1 !text-xs`}
                onClick={() => setMessageKind(kind)}
              >
                {kind === "all" ? "All" : kind === "message" ? "Messages" : "Pro orders"}
              </button>
            ))}
          </div>
        </div>
        <ul className="mt-4 space-y-3">
          {(messages || []).map((message) => (
            <li key={message.id} className={`rounded-xl border p-3 ${message.is_read ? "border-white/10 bg-white/[0.02]" : "border-brand/40 bg-brand/10"}`}>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`pill-flow ${message.kind === "pro_order" ? "border-amber-500/40 text-amber-300" : "border-white/15 text-secondary"}`}>
                  {message.kind === "pro_order" ? "Pro order" : "Message"}
                </span>
                <strong className="text-sm text-white">{message.name}</strong>
                {message.phone && <span className="text-secondary">{message.phone}</span>}
                {message.txid && <code className="text-cyan-glow">TXID {message.txid}</code>}
                <span className="ml-auto text-secondary/60">{new Date(message.created_at).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-secondary">{message.body}</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="btn-ghost !px-2.5 !py-1 text-[11px]"
                  onClick={async () => {
                    try {
                      await apiFetch(`/api/admin/messages/${message.id}`, { method: "PATCH", body: { is_read: !message.is_read }, admin: true });
                      await loadMessages();
                    } catch (err) {
                      setError((err as Error).message);
                    }
                  }}
                >
                  {message.is_read ? "Mark unread" : "Mark read"}
                </button>
                <button
                  type="button"
                  className="btn-ghost !px-2.5 !py-1 text-[11px] !border-red-500/40 !text-red-300 hover:!bg-red-500/10"
                  onClick={async () => {
                    if (!window.confirm("Delete this message?")) return;
                    try {
                      await apiFetch(`/api/admin/messages/${message.id}`, { method: "DELETE", admin: true });
                      await loadMessages();
                    } catch (err) {
                      setError((err as Error).message);
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
          {messages !== null && messages.length === 0 && (
            <li className="px-2 py-6 text-center text-xs text-secondary">No messages in this tab yet.</li>
          )}
        </ul>
        <h3 className="mt-6 text-sm font-bold uppercase tracking-widest text-secondary/80">
          Package <span className="gradient-text">orders</span>
        </h3>
        <p className="mt-1 text-xs text-secondary">TrxID purchases from the /pro page. Approve completes the order and activates the key; reject disables it.</p>
        <ul className="mt-3 space-y-3">
          {proOrders.map((order) => (
            <li
              key={order.id}
              className={`rounded-xl border p-3 ${
                order.status === "pending"
                  ? "border-amber-500/40 bg-amber-500/10"
                  : order.status === "completed"
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-red-500/30 bg-red-500/5"
              }`}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span
                  className={`pill-flow ${
                    order.status === "completed"
                      ? "border-emerald-500/40 text-emerald-300"
                      : order.status === "pending"
                        ? "border-amber-500/40 text-amber-300"
                        : "border-red-500/40 text-red-300"
                  }`}
                >
                  {order.status}
                </span>
                <code className="text-cyan-glow">TXID {order.txid}</code>
                {order.contact && <span className="text-secondary">{order.contact}</span>}
                {order.license_key && <code className="break-all font-mono text-white">{order.license_key}</code>}
                <span className="ml-auto text-secondary/60">{new Date(order.created_at).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {order.status !== "completed" && (
                  <button
                    type="button"
                    className="btn-ghost !px-2.5 !py-1 text-[11px]"
                    onClick={() => void setOrderStatus(order, "completed")}
                  >
                    Approve &amp; issue key
                  </button>
                )}
                {order.status !== "rejected" && (
                  <button
                    type="button"
                    className="btn-ghost !px-2.5 !py-1 text-[11px] !border-red-500/40 !text-red-300 hover:!bg-red-500/10"
                    onClick={() => void setOrderStatus(order, "rejected")}
                  >
                    Reject
                  </button>
                )}
                <button
                  type="button"
                  className="btn-ghost !px-2.5 !py-1 text-[11px]"
                  onClick={() => void deleteOrder(order)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
          {proOrders.length === 0 && (
            <li className="px-2 py-6 text-center text-xs text-secondary">No package orders yet.</li>
          )}
        </ul>
      </div>

      <div className="glass mt-6 p-4 sm:p-6">
        <h2 className="text-lg font-bold">
          Banned <span className="gradient-text">IPs</span>
        </h2>
        <p className="mt-1 text-xs text-secondary">Banned IPs are refused for downloads, playlists, thumbnails and contact.</p>
        <form className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={banSubmit}>
          <div className="w-full sm:w-44">
            <label className="mb-1 block text-[11px] uppercase tracking-widest text-secondary/70" htmlFor="ban-ip">IP</label>
            <input id="ban-ip" required className="field font-mono" placeholder="203.0.113.5" value={banForm.ip} onChange={(e) => setBanForm({ ...banForm, ip: e.target.value })} />
          </div>
          <div className="grow">
            <label className="mb-1 block text-[11px] uppercase tracking-widest text-secondary/70" htmlFor="ban-reason">Reason (optional)</label>
            <input id="ban-reason" className="field" placeholder="rate abuse" value={banForm.reason} onChange={(e) => setBanForm({ ...banForm, reason: e.target.value })} maxLength={255} />
          </div>
          <button type="submit" className="btn-primary">Ban</button>
        </form>
        <ul className="mt-4">
          {bans.map((ban) => (
            <li key={ban.ip} className="flex flex-wrap items-center gap-3 border-t border-white/5 py-2 text-sm">
              <code className="font-mono text-xs text-white">{ban.ip}</code>
              <span className="text-xs text-secondary">{ban.reason || "no reason"}</span>
              <button
                type="button"
                className="btn-ghost ml-auto !px-2.5 !py-1 text-[11px]"
                onClick={async () => {
                  try {
                    await apiFetch(`/api/admin/bans/${ban.ip}`, { method: "DELETE", admin: true });
                    await loadBans();
                  } catch (err) {
                    setError((err as Error).message);
                  }
                }}
              >
                Unban
              </button>
            </li>
          ))}
          {bans.length === 0 && <li className="py-4 text-center text-xs text-secondary">No IPs banned.</li>}
        </ul>
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
