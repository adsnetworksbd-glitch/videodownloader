import { useEffect, useState } from "react";
import { apiFetch } from "./api";

const KEY = "gateway.pro_key";
const EVENT = "gateway:pro";

export type ProStatus = { valid: boolean; plan?: string; expires_at?: string | null; features?: string[] };

export function getProKey(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(KEY) || "";
}

export function setProKey(key: string): void {
  if (typeof window === "undefined") return;
  if (key) window.localStorage.setItem(KEY, key);
  else window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT));
}

export function useProStatus(): { status: ProStatus | null; loading: boolean } {
  const [status, setStatus] = useState<ProStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const key = getProKey();
      if (!key) {
        if (alive) {
          setStatus(null);
          setLoading(false);
        }
        return;
      }
      try {
        const data = await apiFetch<ProStatus>(`/api/pro/status?key=${encodeURIComponent(key)}`);
        if (alive) setStatus(data);
      } catch {
        if (alive) setStatus({ valid: false });
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    window.addEventListener(EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(EVENT, load);
    };
  }, []);

  return { status: status && status.valid ? status : null, loading };
}
