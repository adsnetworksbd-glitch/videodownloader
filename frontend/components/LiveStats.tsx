"use client";

import { useEffect, useState } from "react";

type Stats = { total_sites: number; total_downloads: number };

function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(target);
  useEffect(() => {
    if (target <= 0) {
      setValue(0);
      return;
    }
    const started = performance.now();
    let frame = 0;
    function tick(now: number) {
      const progress = Math.min(1, (now - started) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

export default function LiveStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stats/public")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Stats | null) => {
        if (!cancelled && data) setStats(data);
        else if (!cancelled) setFailed(true);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <p className="mb-3 text-center text-xs text-secondary">
        1,000+ sites supported — always free.
      </p>
    );
  }
  return (
    <LiveCount stats={stats} />
  );
}

function LiveCount({ stats }: { stats: Stats | null }) {
  const sites = useCountUp(stats?.total_sites || 0);
  const downloads = useCountUp(stats?.total_downloads || 0);
  return (
    <p className="mb-3 text-center text-xs text-secondary">
      <strong className="text-white">{sites.toLocaleString("en-US")}+</strong> sites supported
      {stats ? (
        <>
          {" "}
          · <strong className="text-white">{downloads.toLocaleString("en-US")}</strong> downloads completed
        </>
      ) : null}
    </p>
  );
}
