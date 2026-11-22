import type { Metadata } from "next";
import "./globals.css";
import BanglaBanner from "../components/BanglaBanner";
import DownloadsHud from "../components/DownloadsHud";
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
        {process.env.NEXT_PUBLIC_ADSENSE_CLIENT ? (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_CLIENT}`}
            crossOrigin="anonymous"
          />
        ) : null}
        <Header />
        <main className="grow">{children}</main>
        <Footer />
        <BanglaBanner />
        <DownloadsHud />
      </body>
    </html>
  );
}
