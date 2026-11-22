import AdSlot from "../components/AdSlot";
import DownloadPanel from "../components/DownloadPanel";
import FaqSection from "../components/FaqSection";
import PhoneMockup from "../components/PhoneMockup";
import PlatformsShowcase from "../components/PlatformsShowcase";
import { BoltIcon, CheckIcon, DevicesIcon, FormatsIcon, FreeIcon, ShieldIcon } from "../components/icons";

const FEATURES = [
  { Icon: BoltIcon, title: "Fast Download", text: "High-speed processing and optimized performance for quick saves." },
  { Icon: FreeIcon, title: "Free Access", text: "No mandatory registration — paste a link and download instantly." },
  { Icon: DevicesIcon, title: "All Devices", text: "Works on mobile, tablet and desktop browsers alike." },
  { Icon: ShieldIcon, title: "Safe & Secure", text: "Secure URL processing with privacy protection built in." },
  { Icon: FormatsIcon, title: "Multiple Formats", text: "MP4, WebM and other formats the platform actually provides." },
];

const STEPS = [
  { n: "01", title: "Copy Video URL", text: "Open any supported platform, find your video and copy its link." },
  { n: "02", title: "Paste Your Link", text: "Drop the link into the box above — we detect the provider automatically." },
  { n: "03", title: "Select Quality & Download", text: "Pick from the available resolutions or grab audio-only, then save it." },
];

export default function HomePage() {
  return (
    <>
      <section className="section-pad grid items-center gap-10 pb-10 pt-12 lg:grid-cols-2 lg:pt-20">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand/10 px-4 py-1.5 text-xs font-bold tracking-widest text-brand">
            <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-cyan-glow" />
            ALL IN ONE
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
            Video Downloader
            <br />
            From <span className="gradient-text">ALL PLATFORMS</span>
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-secondary sm:text-lg">
            Download videos from 1000+ supported websites and platforms. Fast, simple and convenient —
            all in one place.
          </p>
        </div>
        <div className="flex justify-center lg:justify-end">
          <PhoneMockup />
        </div>
      </section>

      <div className="section-pad pb-6">
        <DownloadPanel />
      </div>

      <div className="section-pad pb-2">
        <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME} />
      </div>

      <PlatformsShowcase />

      <section className="section-pad py-14">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">
            Why <span className="gradient-text">VideoDownloader</span>
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-secondary">
            Built for speed, privacy and simplicity — everything works without an account.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {FEATURES.map(({ Icon, title, text }) => (
            <div key={title} className="glass glass-hover p-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand/30 to-cyan-glow/20 text-cyan-glow">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-sm font-bold sm:text-base">{title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-secondary sm:text-sm">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="section-pad scroll-mt-24 py-14">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">
            How It <span className="gradient-text">Works</span>
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.n} className="glass glass-hover relative overflow-hidden p-6">
              <span className="absolute -right-3 -top-6 text-7xl font-black text-brand/10">{step.n}</span>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-r from-brand to-cyan-glow shadow-glow">
                <CheckIcon className="h-5 w-5 text-white" />
              </span>
              <h3 className="mt-4 text-base font-bold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-secondary">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <FaqSection />
    </>
  );
}
