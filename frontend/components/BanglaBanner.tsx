"use client";

import { useEffect, useState } from "react";
import { getLang, setLang } from "../lib/lang";

const KEY = "gateway.bn_banner_dismissed";

export default function BanglaBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(KEY)) return;
    if (getLang() === "bn") return;
    if (navigator.language.toLowerCase().startsWith("bn") || new URLSearchParams(window.location.search).get("lang") === "bn") {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 sm:right-auto sm:w-80" role="status">
      <div className="glass !rounded-2xl border-brand/40 p-4 shadow-glow">
        <p className="text-sm font-semibold text-white">আপনার ব্রাউজার বাংলা — বাংলা ইন্টারফেসে দেখবেন?</p>
        <p className="mt-1 text-xs text-secondary">Switch the main buttons and navigation to বাংলা, anytime.</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="btn-primary !px-3 !py-1.5 text-xs"
            onClick={() => {
              setLang("bn");
              window.localStorage.setItem(KEY, "1");
              setVisible(false);
            }}
          >
            বাংলায় দেখুন
          </button>
          <button
            type="button"
            className="btn-ghost !px-3 !py-1.5 text-xs"
            onClick={() => {
              window.localStorage.setItem(KEY, "1");
              setVisible(false);
            }}
          >
            No thanks
          </button>
        </div>
      </div>
    </div>
  );
}
