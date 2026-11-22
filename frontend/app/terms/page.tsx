import type { Metadata } from "next";
import LegalPage from "../../components/LegalPage";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        By using VideoDownloader you agree to download only content you have the right to download: your own
        uploads, public-domain or openly licensed material, or content permitted by the rights holder.
      </p>
      <p>
        The service must not be used to infringe copyright, bypass paywalls or DRM, access private or
        authentication-protected content, or violate any platform's terms. Automated abuse, excessive load and
        attempts to attack the service are rate-limited and blocked.
      </p>
      <p>
        The service is provided "as is" without warranties of any kind. Availability of specific platforms and
        qualities depends entirely on what those platforms provide.
      </p>
    </LegalPage>
  );
}
