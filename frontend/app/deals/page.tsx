import type { Metadata } from "next";

type Deal = { label: string; url: string };

const DEALS: Deal[] = (process.env.NEXT_PUBLIC_DEAL_LINKS || "")
  .split("|")
  .map((entry) => entry.trim())
  .filter(Boolean)
  .map((entry) => ({ label: entry.split("::")[0].trim(), url: entry.split("::")[1].trim() }));

export const metadata: Metadata = {
  title: "Deals & Tools",
  description: "Hand-picked VPNs, storage and creator tools we recommend alongside the downloader.",
  robots: { index: Boolean(DEALS.length), follow: Boolean(DEALS.length) },
};

export default function DealsPage() {
  if (DEALS.length === 0) {
    return (
      <div className="section-pad max-w-lg py-16">
        <h1 className="text-3xl font-extrabold">
          Deals &amp; <span className="gradient-text">Tools</span>
        </h1>
        <p className="mt-3 text-sm text-secondary">Nothing listed right now — check back later.</p>
      </div>
    );
  }
  return (
    <div className="section-pad max-w-3xl py-12">
      <h1 className="text-3xl font-extrabold">
        Deals &amp; <span className="gradient-text">Tools</span>
      </h1>
      <p className="mt-3 max-w-xl text-sm text-secondary">
        Tools we actually recommend. Using these affiliate links supports the site at no extra cost to you.
      </p>
      <ul className="mt-8 space-y-3">
        {DEALS.map((deal) => (
          <li key={deal.url} className="glass flex items-center justify-between gap-4 p-4">
            <span className="font-semibold">{deal.label}</span>
            <a className="btn-primary !px-4 !py-1.5 !text-xs" href={deal.url} target="_blank" rel="noopener noreferrer sponsored">
              Open deal →
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
