import type { Metadata } from "next";
import LegalPage from "../../components/LegalPage";

export const metadata: Metadata = { title: "Disclaimer" };

export default function DisclaimerPage() {
  return (
    <LegalPage title="Simple Disclaimer">
      <p>
        VideoDownloader is not affiliated with, endorsed by, or sponsored by YouTube, Meta, TikTok, X, Pinterest or
        any other platform. All trademarks belong to their respective owners.
      </p>
      <p>
        Platform coverage is powered by the open-source yt-dlp extraction engine. The provider directory shows a
        curated, verified subset — other sites may work as well, and some integrations may break when platforms
        change.
      </p>
      <p>
        You are solely responsible for how you use downloaded media. Do not redistribute copyrighted content
        without permission.
      </p>
    </LegalPage>
  );
}
