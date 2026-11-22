"use client";

import { useState } from "react";
import LegalPage from "../../components/LegalPage";
import { apiFetch } from "../../lib/api";

export default function ContactPage() {
  const [kind, setKind] = useState<"message" | "pro_order">("message");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [txid, setTxid] = useState("");
  const [body, setBody] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setState("busy");
    setError("");
    try {
      await apiFetch("/api/contact", {
        method: "POST",
        body: { kind, name, phone: phone || null, txid: kind === "pro_order" ? txid : null, body },
      });
      setState("sent");
      setBody("");
      setTxid("");
    } catch (err) {
      setState("error");
      setError((err as Error).message);
    }
  }

  const input = "field";

  return (
    <LegalPage title="Contact & Pro orders">
      <p>
        Found a broken site, want a provider added, or paid for Pro and need your key? Send a message — it
        lands directly in our admin inbox.
      </p>
      {state === "sent" && (
        <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300" role="status">
          Got it! We will reply to your number soon.
        </div>
      )}
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <label className="block">
          <span className="mb-1.5 block text-xs text-secondary">Type</span>
          <select className={input} value={kind} onChange={(e) => setKind(e.target.value as "message" | "pro_order")}>
            <option value="message">General message / site problem</option>
            <option value="pro_order">Pro payment order</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs text-secondary">Your name</span>
          <input required className={input} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs text-secondary">{kind === "pro_order" ? "bKash / Nagad number" : "Phone or email (optional)"}</span>
          <input className={input} maxLength={40} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" />
        </label>
        {kind === "pro_order" && (
          <label className="block">
            <span className="mb-1.5 block text-xs text-secondary">Transaction ID (TXID)</span>
            <input required className={input} maxLength={80} value={txid} onChange={(e) => setTxid(e.target.value.toUpperCase())} placeholder="e.g. 8HJ2KX9PLM" />
            <span className="mt-1 block text-[11px] text-secondary/70">
              Send 199৳ to our bKash/Nagad (see the Pro page), then paste the TrxID here — we generate your key after checking.
            </span>
          </label>
        )}
        <label className="block">
          <span className="mb-1.5 block text-xs text-secondary">Message</span>
          <textarea
            required
            className={`${input} min-h-[110px]`}
            maxLength={2000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={kind === "pro_order" ? "Which number you paid from, plan duration, anything else" : "Platform name, example public link, and the error you saw"}
          />
        </label>
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={state === "busy"}>
            {state === "busy" ? "Sending..." : "Send"}
          </button>
          {state === "error" && (
            <p className="mb-0 text-sm text-red-300" role="alert">{error}</p>
          )}
        </div>
      </form>
      <p className="mt-6 text-xs text-secondary/70">
        Prefer GitHub? <a className="text-brand underline" href="https://github.com/adsnetworksbd-glitch/videodownloader">Open an issue</a> with the platform name, an example public video URL, and the error message.
      </p>
    </LegalPage>
  );
}
