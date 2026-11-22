import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Go Pro",
  description: "Unlock 1000 downloads per day, full playlist downloads and an ad-free experience with VideoDownloader Pro.",
};

export default function ProLayout({ children }: { children: React.ReactNode }) {
  return <div className="section-pad py-12">{children}</div>;
}
