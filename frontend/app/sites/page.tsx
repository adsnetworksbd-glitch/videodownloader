import type { Metadata } from "next";
import AdSlot from "../../components/AdSlot";
import SitesDirectory from "../../components/SitesDirectory";

export const metadata: Metadata = {
  title: "Supported Sites",
  description:
    "Browse every website supported by VideoDownloader — search, filter by category and see which providers are verified.",
};

export default function SitesPage() {
  return (
    <div className="section-pad py-12">
      <h1 className="text-3xl font-extrabold sm:text-4xl">
        Supported <span className="gradient-text">Sites</span>
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-secondary sm:text-base">
        Our extraction engine covers over a thousand websites through yt-dlp. Below is the curated, verified
        directory — search or filter by category. Unlisted links can still work: paste any URL on the home page
        and the engine will try to extract it.
      </p>
      <div className="mt-8">
        <SitesDirectory />
      </div>
      <div className="mt-10">
        <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_SITES} />
      </div>
    </div>
  );
}
