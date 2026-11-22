import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Download History",
  description: "Browse your recent download jobs, their status and re-save finished files.",
  robots: { index: false, follow: false },
};

export default function HistoryLayout({ children }: { children: React.ReactNode }) {
  return <div className="section-pad py-12">{children}</div>;
}
