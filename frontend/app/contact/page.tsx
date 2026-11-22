import type { Metadata } from "next";
import LegalPage from "../../components/LegalPage";

export const metadata: Metadata = { title: "Contact Us" };

export default function ContactPage() {
  return (
    <LegalPage title="Simple Contact">
      <p>Found a site that no longer works, or want a provider added to the verified directory?</p>
      <p className="text-white">
        Open an issue on our{" "}
        <a
          className="font-semibold text-brand underline decoration-brand/40 underline-offset-2 hover:text-cyan-glow"
          href="https://github.com/adsnetworksbd-glitch/videodownloader"
        >
          GitHub repository
        </a>{" "}
        and we will look into it.
      </p>
      <p>Please include the platform name, an example public video URL, and the error message you saw.</p>
    </LegalPage>
  );
}
