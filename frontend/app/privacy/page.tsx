import type { Metadata } from "next";
import LegalPage from "../../components/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        VideoDownloader processes the video URL you submit in order to extract media information and serve the
        download. Submitted URLs and basic technical logs (IP address, timestamp) are used solely to operate,
        secure and rate-limit the service.
      </p>
      <p>
        We do not require registration, we do not collect email addresses, and we do not sell or share your data
        with third parties. Downloaded media is handled as a temporary stream or stored only briefly, then
        automatically deleted from temporary storage.
      </p>
      <p>Local browser storage is used only to remember your admin token if you choose to administer providers.</p>
      <p>Questions? Use the contact page.</p>
    </LegalPage>
  );
}
