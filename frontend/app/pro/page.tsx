"use client";

import Link from "next/link";
import { useState } from "react";
import { apiFetch } from "../../lib/api";
import { getProKey, setProKey, useProStatus, type ProStatus } from "../../lib/pro";
import { CheckIcon, BoltIcon } from "../../components/icons";

const FREE = ["100 downloads per day", "First 10 playlist items", "With ads"];
const PRO = ["1,000 downloads per day", "Full playlist downloads", "No ads", "Priority processing"];

const BKASH = process.env.NEXT_PUBLIC_PAYMENT_BKASH || "";
const NAGAD = process.env.NEXT_PUBLIC_PAYMENT_NAGAD || "";

export default function ProPage() {
  const { status } = useProStatus();
  const [keyInput, setKeyInput] = useState("");
  const [state, setState] = useState<{ busy: boolean; error: string; message: string }>({ busy: false, error: "", message: "" });

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

  const active = status;

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
          Pro Activated by a one-time license key. Pay with bKash/Nagad, receive your key, paste it below —
          done, no account needed.
        </p>
      </div>

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

      <div className="glass mt-6 p-6">
        <h2 className="text-lg font-bold">
          {active ? (
            <>
              Pro is <span className="text-emerald-300">active</span>
            </>
          ) : (
            <>
              Activate your <span className="gradient-text">license key</span>
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

      <div className="glass mt-6 p-6">
        <h2 className="text-lg font-bold">How to buy a key</h2>
        <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-secondary">
          <li>Send <strong className="text-white">199 ৳</strong> to one of the wallets below (use “Personal”, add a note with your email).</li>
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
          <li>You will receive a <strong className="text-white">VDPRO-…</strong> key in return.</li>
          <li>Paste the key above. It stays on this device — works immediately, no signup.</li>
        </ol>
        <p className="mt-4 text-xs text-secondary/70">
          One key works on up to 3 of your own devices. Refunds within 24h if the key does not activate.
        </p>
      </div>
    </div>
  );
}
