"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { getProKey, setProKey, useProStatus, type ProStatus } from "../../lib/pro";
import { CheckIcon, BoltIcon } from "../../components/icons";

const FREE = ["100 downloads per day", "First 10 playlist items", "With ads"];
const PRO = ["1,000 downloads per day", "Full playlist downloads", "No ads", "Priority processing"];

const BKASH = process.env.NEXT_PUBLIC_PAYMENT_BKASH || "";
const NAGAD = process.env.NEXT_PUBLIC_PAYMENT_NAGAD || "";

type Pkg = { id: number; name: string; price: number; duration_days: number; description: string | null };

type PurchaseResult = { status: string; key: string; plan: string; expires_at: string | null; message: string };

export default function ProPage() {
  const { status } = useProStatus();
  const [keyInput, setKeyInput] = useState("");
  const [state, setState] = useState<{ busy: boolean; error: string; message: string }>({ busy: false, error: "", message: "" });
  const [packages, setPackages] = useState<Pkg[] | null>(null);
  const [selected, setSelected] = useState<Pkg | null>(null);
  const [txid, setTxid] = useState("");
  const [contact, setContact] = useState("");
  const [buy, setBuy] = useState<{ busy: boolean; error: string; result: PurchaseResult | null }>({ busy: false, error: "", result: null });

  const loadPackages = useCallback(async () => {
    try {
      const rows = await apiFetch<Pkg[]>("/api/pro/packages");
      setPackages(rows);
      setSelected((current) => current ?? rows[0] ?? null);
    } catch {
      setPackages([]);
    }
  }, []);

  useEffect(() => {
    loadPackages();
  }, [loadPackages]);

  async function redeem(event: React.FormEvent) {
    event.preventDefault();
    const key = keyInput.trim();
    if (!key) return;
    setState({ busy: true, error: "", message: "" });
    try {
      const result = await apiFetch<ProStatus>("/api/pro/redeem", { method: "POST", body: { key } });
      setProKey(key);
      setKeyInput("");
      setState({ busy: false, error: "", message: `Pro activated! Plan: ${result.plan ?? "pro"}. Enjoy 1,000 downloads per day.` });
    } catch (err) {
      setState({ busy: false, error: (err as Error).message, message: "" });
    }
  }

  async function purchase(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !txid.trim()) return;
    setBuy({ busy: true, error: "", result: null });
    try {
      const result = await apiFetch<PurchaseResult>("/api/pro/purchase", {
        method: "POST",
        body: { package_id: selected.id, txid: txid.trim(), contact: contact.trim() || undefined },
      });
      setBuy({ busy: false, error: "", result });
      setTxid("");
      setContact("");
      if (result.status === "completed") setProKey(result.key);
    } catch (err) {
      setBuy({ busy: false, error: (err as Error).message, result: null });
    }
  }

  const active = status;
  const hasPackages = (packages?.length ?? 0) > 0;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-cyan-glow/40 bg-cyan-glow/10 px-4 py-1.5 text-xs font-bold tracking-widest text-cyan-glow">
          <BoltIcon className="h-3.5 w-3.5" />
          GO PRO
        </span>
        <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">
          Download <span className="gradient-text">without limits</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-secondary sm:text-base">
          Pick a package, pay with bKash/Nagad, paste the Transaction ID and get your Pro key instantly —
          no account needed.
        </p>
      </div>

      {hasPackages ? (
        <>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(packages ?? []).map((pkg) => (
              <button
                key={pkg.id}
                type="button"
                onClick={() => setSelected(pkg)}
                className={`glass p-6 text-left transition-transform hover:-translate-y-0.5 ${selected?.id === pkg.id ? "border-brand shadow-glow" : ""}`}
              >
                <h2 className="text-lg font-bold">{pkg.name}</h2>
                <p className="mt-1 text-3xl font-extrabold gradient-text">
                  {pkg.price} <span className="text-sm font-medium text-secondary">৳ / {pkg.duration_days} days</span>
                </p>
                {pkg.description && <p className="mt-2 text-xs text-secondary">{pkg.description}</p>}
              </button>
            ))}
          </div>

          <div className="glass mt-6 p-6">
            <h2 className="text-lg font-bold">
              Buy <span className="gradient-text">{selected ? selected.name : "a package"}</span> — instant key
            </h2>
            <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-secondary">
              <li>
                Send <strong className="text-white">{selected ? `${selected.price} ৳` : "the package price"}</strong> to one
                of the wallets below (use &ldquo;Personal&rdquo;).
              </li>
              {BKASH && (
                <li>
                  bKash (Personal): <strong className="font-mono text-white">{BKASH}</strong>
                </li>
              )}
              {NAGAD && (
                <li>
                  Nagad (Personal): <strong className="font-mono text-white">{NAGAD}</strong>
                </li>
              )}
              {!BKASH && !NAGAD && (
                <li>
                  Payment numbers will appear here once configured (bKash/Nagad) — meanwhile reach us via the{" "}
                  <Link href="/contact" className="text-brand hover:text-cyan-glow">
                    contact page
                  </Link>
                  .
                </li>
              )}
              <li>Paste the Transaction ID below.(save your money receipt)</li>
            </ol>

            <form className="mt-5 grid gap-3 sm:max-w-md" onSubmit={purchase}>
              <input
                className="field font-mono"
                placeholder="Transaction ID (TrxID)"
                value={txid}
                onChange={(e) => setTxid(e.target.value.toUpperCase())}
                autoComplete="off"
                spellCheck={false}
                minLength={6}
                maxLength={80}
                required
              />
              <input
                className="field"
                placeholder="Your contact (email / WhatsApp — optional)"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                maxLength={120}
              />
              <button type="submit" className="btn-primary" disabled={buy.busy || !selected || txid.trim().length < 6}>
                {buy.busy ? "Verifying…" : "Submit & get my key"}
              </button>
            </form>

            {buy.error && (
              <div className="mt-3 max-w-md rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
                {buy.error}
              </div>
            )}

            {buy.result && (
              <div
                className={`mt-4 max-w-md rounded-xl border px-4 py-4 ${
                  buy.result.status === "completed" ? "border-emerald-500/30 bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/10"
                }`}
                role="status"
              >
                <p className={`text-sm ${buy.result.status === "completed" ? "text-emerald-300" : "text-amber-300"}`}>
                  {buy.result.message}
                </p>
                <p className="mt-3 font-mono text-lg font-extrabold tracking-wider break-all text-white select-all">{buy.result.key}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-ghost !px-3 !py-1.5 text-xs"
                    onClick={() => navigator.clipboard?.writeText(buy.result?.key ?? "")}
                  >
                    Copy key
                  </button>
                  {buy.result.status !== "completed" && (
                    <Link className="btn-ghost !px-3 !py-1.5 text-xs" href="/contact">
                      Contact support
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <div className="glass p-6">
            <h2 className="text-lg font-bold">Free</h2>
            <p className="mt-1 text-3xl font-extrabold">
              0 <span className="text-sm font-medium text-secondary">৳</span>
            </p>
            <ul className="mt-4 space-y-2 text-sm text-secondary">
              {FREE.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="text-secondary/50">—</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="glass border-brand/50 p-6 shadow-glow">
            <h2 className="text-lg font-bold">
              Pro <span className="pill-flow ml-2 border-cyan-glow/40 text-[10px] text-cyan-glow">BEST VALUE</span>
            </h2>
            <p className="mt-1 text-3xl font-extrabold gradient-text">199 <span className="text-sm font-medium text-secondary">৳ / 30 days</span></p>
            <ul className="mt-4 space-y-2 text-sm text-secondary">
              {PRO.map((item) => (
                <li key={item} className="flex items-center gap-2 text-white">
                  <CheckIcon className="h-4 w-4 shrink-0 text-emerald-400" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="glass mt-6 p-6">
        <h2 className="text-lg font-bold">
          {active ? (
            <>
              Pro is <span className="text-emerald-300">active</span>
            </>
          ) : (
            <>
              Already have a key? <span className="gradient-text">Activate</span>
            </>
          )}
        </h2>
        {active ? (
          <div className="mt-4">
            <p className="text-sm text-secondary">
              Plan: <strong className="text-white">{active.plan}</strong>
              {active.expires_at ? (
                <>
                  {" "}
                  · valid until{" "}
                  <strong className="text-white">
                    {new Date(active.expires_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                  </strong>
                </>
              ) : null}
            </p>
            <p className="mt-2 font-mono text-xs text-secondary/70">key: {getProKey().slice(0, 7)}••••••••</p>
            <button type="button" className="btn-ghost mt-4" onClick={() => setProKey("")}>
              Remove this device
            </button>
          </div>
        ) : (
          <form className="mt-4 max-w-md" onSubmit={redeem}>
            <input
              className="field font-mono"
              placeholder="VDPRO-XXXXXXXXXX"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value.toUpperCase())}
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" className="btn-primary mt-3 w-full" disabled={state.busy || !keyInput.trim()}>
              {state.busy ? "Checking…" : "Activate Pro"}
            </button>
            {state.message && (
              <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300" role="status">
                {state.message}
              </div>
            )}
            {state.error && (
              <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
                {state.error}
              </div>
            )}
          </form>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-secondary/70">
        One key works on up to 3 of your own devices. Refunds within 24h if the key does not activate.
      </p>
    </div>
  );
}
