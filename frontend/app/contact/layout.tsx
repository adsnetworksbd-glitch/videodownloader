import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Report a broken site, request a provider, or send your Pro payment order. We reply within 24 hours.",
  robots: { index: true, follow: true },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
