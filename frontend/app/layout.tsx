import type { Metadata } from "next";
import "./globals.css";
import Header from "../components/Header";
import Footer from "../components/Footer";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || "http://localhost:3000"),
  title: {
    default: "VideoDownloader — Fast • Free • All in One",
    template: "%s | VideoDownloader",
  },
  description:
    "Download videos from 1000+ supported websites and platforms. Fast, simple and convenient — all in one place.",
  openGraph: {
    title: "VideoDownloader — Fast • Free • All in One",
    description:
      "Download videos from 1000+ supported websites and platforms. Fast, simple and convenient — all in one place.",
    type: "website",
    siteName: "VideoDownloader",
  },
  twitter: {
    card: "summary_large_image",
    title: "VideoDownloader — Fast • Free • All in One",
    description: "Download videos from 1000+ supported websites and platforms.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <Header />
        <main className="grow">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
