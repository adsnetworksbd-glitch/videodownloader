"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, getAdminToken, setAdminToken } from "@/lib/api";

const ADAPTERS = ["http_mirror", "proxy_pass", "ytdlp"];

const ADAPTER_HINTS = {
  http_mirror: "Plain mirror: GET {base_url}/{resource} — base URL required",
  proxy_pass: "POST {base_url} with {\"resource\": …} — base URL required",
  ytdlp: "Social video extraction via yt-dlp (YouTube, TikTok, FB, IG…) — no base URL needed",
};

const emptyForm = {
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
  const [providers, setProviders] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const authed = Boolean(token) && Boolean(providers);

  const load = useCallback(async (activeToken) => {
    const saved = activeToken ?? getAdminToken();
    if (!saved) {
      setProviders(null);
      return;
    }
    try {
      setProviders(await apiFetch("/api/admin/providers", { admin: true }));
    } catch (err) {
      setProviders(null);
      setError(`Could not load providers: ${err.message}`);
    }
  }, []);

  useEffect(() => {
    const saved = getAdminToken();
    setToken(saved);
    load(saved);
  }, [load]);

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const payload = { ...form, api_key: form.api_key || null, priority: Number(form.priority), timeout_seconds: Number(form.timeout_seconds) };
      if (editingId && !payload.cookies.trim()) delete payload.cookies;
      if (editingId) {
        await apiFetch(`/api/admin/providers/${editingId}`, { method: "PATCH", body: payload, admin: true });
        setMessage(`Provider “${form.name}” updated.`);
      } else {
        await apiFetch("/api/admin/providers", { method: "POST", body: payload, admin: true });
        setMessage(`Provider “${form.name}” created.`);
      }
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeProvider(id, name) {
    if (!window.confirm(`Delete provider “${name}”?`)) return;
    try {
      await apiFetch(`/api/admin/providers/${id}`, { method: "DELETE", admin: true });
      setMessage(`Provider “${name}” deleted.`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function testProvider(id) {
    setMessage("");
    setError("");
    try {
      const result = await apiFetch(`/api/admin/providers/${id}/test`, { method: "POST", admin: true });
      setMessage(result.status === "up" ? "Provider is up." : `Provider is ${result.status}.`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function editProvider(provider) {
    setEditingId(provider.id);
    setForm({
      name: provider.name,
      adapter: provider.adapter,
      base_url: provider.base_url,
      api_key: "",
      priority: provider.priority,
      timeout_seconds: provider.timeout_seconds,
      is_active: provider.is_active,
    });
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }

  if (!authed) {
    return (
      <>
        <h1>Admin sign-in</h1>
        <p className="sub">Enter the admin token (ADMIN_TOKEN of the backend) to manage providers.</p>
        <form
          className="card"
          onSubmit={async (e) => {
            e.preventDefault();
            setAdminToken(token);
            setMessage("");
            setError("");
            await load(token);
          }}
        >
          <div className="row">
            <input
              className="grow"
              type="password"
              placeholder="Admin token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="current-password"
            />
            <button type="submit">Unlock</button>
          </div>
          {error && <div className="error-box" role="alert">{error}</div>}
        </form>
      </>
    );
  }

  const total = providers?.length ?? 0;
  const activeCount = (providers || []).filter((p) => p.is_active).length;
  const downCount = (providers || []).filter((p) => p.last_status === "down").length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Providers</h1>
          <p className="sub">Highest priority (lowest number) is tried first. A provider that fails to answer is skipped automatically.</p>
        </div>
        <div className="head-actions">
          <a className="back-link" href="/">← Back to app</a>
          <div className="stat-row">
            <span className="stat"><strong>{total}</strong> total</span>
            <span className="stat ok"><strong>{activeCount}</strong> active</span>
            {downCount > 0 && <span className="stat err"><strong>{downCount}</strong> down</span>}
          </div>
        </div>
      </div>

      {message && <div className="error-box" style={{ borderColor: "rgba(47,191,113,.4)", color: "#8ce2b2", background: "rgba(47,191,113,.1)" }}>{message}</div>}
      {error && <div className="error-box" role="alert">{error}</div>}

      <div className="card">
        <h2>Configured providers</h2>
        <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Adapter</th><th>Base URL</th><th>Priority</th><th>Health</th><th>Status</th><th>Key</th><th></th>
            </tr>
          </thead>
          <tbody>
            {(providers || []).map((p) => (
              <tr key={p.id}>
                <td><strong>{p.name}</strong></td>
                <td className="code">{p.adapter}</td>
                <td className="code">{p.base_url}</td>
                <td>{p.priority}</td>
                <td>{p.last_status ? <span className={`pill ${p.last_status}`}>{p.last_status}</span> : <span className="muted">—</span>}</td>
                <td><span className={`pill ${p.is_active ? "active" : "inactive"}`}>{p.is_active ? "active" : "inactive"}</span></td>
                <td>{p.has_api_key ? "set" : "—"}</td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    <button className="small" onClick={() => editProvider(p)}>Edit</button>
                    <button className="small" onClick={() => testProvider(p.id)}>Test</button>
                    <button className="small danger" onClick={() => removeProvider(p.id, p.name)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {providers && providers.length === 0 && (
              <tr><td colSpan="8" className="muted">No providers yet — add the first one below.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <div className="card" id="provider-form">
        <h2>{editingId ? `Edit provider #${editingId}` : "Add provider"}</h2>
        <form onSubmit={onSubmit}>
          <div className="form-section">
            <h3>Basics</h3>
            <div className="grid">
              <label className="fld"><span>Name</span>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label className="fld"><span>Adapter</span>
                <select value={form.adapter} onChange={(e) => setForm({ ...form, adapter: e.target.value })}>
                  {ADAPTERS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>
              <label className="fld" style={{ gridColumn: "1 / -1" }}><span>Base URL {form.adapter === "ytdlp" ? "(not used for ytdlp)" : ""}</span>
                <input required={form.adapter !== "ytdlp"} placeholder="https://mirror.example.com" value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} />
                <span className="muted" style={{ fontSize: 11 }}>{ADAPTER_HINTS[form.adapter]}</span>
              </label>
            </div>
          </div>

          <div className="form-section">
            <h3>Advanced</h3>
            <div className="grid">
              <label className="fld" style={{ gridColumn: "1 / -1" }}><span>Cookies (optional — for Facebook/Instagram/private videos)</span>
                <textarea
                  className="code"
                  rows={4}
                  placeholder={editingId === null ? "Paste a Netscape cookies.txt export here" : "Leave empty to keep current cookies"}
                  value={form.cookies || ""}
                  onChange={(e) => setForm({ ...form, cookies: e.target.value })}
                  style={{ minHeight: 80, fontFamily: "ui-monospace, monospace", fontSize: 12 }}
                />
                <span className="muted" style={{ fontSize: 11 }}>Export with a “cookies.txt” browser extension. Never share these cookies.</span>
              </label>
              <label className="fld"><span>API key (optional)</span>
                <input type="password" placeholder={editingId === null ? "Bearer key for the upstream" : "Leave empty to keep current"} value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} autoComplete="new-password" />
              </label>
              <label className="fld"><span>Priority (1 = first)</span>
                <input type="number" min="1" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
              </label>
              <label className="fld"><span>Timeout (seconds)</span>
                <input type="number" min="1" max="600" value={form.timeout_seconds} onChange={(e) => setForm({ ...form, timeout_seconds: e.target.value })} />
              </label>
              <label className="fld"><span>Active</span>
                <select value={form.is_active ? "yes" : "no"} onChange={(e) => setForm({ ...form, is_active: e.target.value === "yes" })}>
                  <option value="yes">Active</option>
                  <option value="no">Inactive</option>
                </select>
              </label>
            </div>
          </div>

          <div className="row" style={{ marginTop: 16 }}>
            <button type="submit" disabled={busy}>{busy && <span className="spinner" />}{editingId ? "Save changes" : "Create provider"}</button>
            {editingId && (
              <button type="button" className="ghost" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancel</button>
            )}
          </div>
        </form>
      </div>
    </>
  );
}
