import { FacebookIcon, InstagramIcon, PlayIcon, TikTokIcon, XIcon, YouTubeIcon } from "./icons";

const FLOATERS = [
  { Icon: YouTubeIcon, className: "left-4 top-10 h-10 w-10 text-[#FF0000] animate-float", delay: "0s" },
  { Icon: FacebookIcon, className: "right-2 top-24 h-9 w-9 text-[#1877F2] animate-float-slow", delay: "0.8s" },
  { Icon: InstagramIcon, className: "left-6 bottom-24 h-9 w-9 text-[#E4405F] animate-float-slow", delay: "1.6s" },
  { Icon: TikTokIcon, className: "right-14 bottom-48 h-8 w-8 text-white animate-float", delay: "0.4s" },
  { Icon: XIcon, className: "right-14 bottom-48 h-8 w-8 text-white", delay: "1.2s" },
];

export default function PhoneMockup() {
  return (
    <div className="relative mx-auto hidden w-fit lg:block" aria-hidden>
      {FLOATERS.slice(0, 4).map(({ Icon, className, delay }, i) => (
        <span key={i} className={`absolute z-10 flex items-center justify-center rounded-2xl bg-card/80 p-2.5 shadow-glow backdrop-blur ${className}`} style={{ animationDelay: delay }}>
          <Icon className="h-full w-full" />
        </span>
      ))}

      <div className="relative h-[430px] w-[220px] rounded-[2.4rem] border border-white/15 bg-surface p-2 shadow-[0_30px_80px_rgba(8,123,255,0.25)]">
        <div className="flex h-full flex-col overflow-hidden rounded-[1.9rem] bg-ink">
          <div className="mx-auto mt-2 h-1.5 w-16 rounded-full bg-white/20" />
          <div className="relative m-3 h-40 overflow-hidden rounded-xl bg-gradient-to-br from-brand/40 to-cyan-glow/20">
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 backdrop-blur">
                <PlayIcon className="h-6 w-6 text-white" />
              </span>
            </div>
            <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold">12:48</span>
          </div>
          <div className="px-3">
            <p className="truncate text-xs font-semibold">Sunset Timelapse 4K</p>
            <p className="mt-0.5 text-[10px] text-secondary">Nature Channel · 2.1M views</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {["1080p", "720p", "480p", "MP3"].map((q) => (
                <span key={q} className="pill-flow border-brand/40 text-cyan-glow">{q}</span>
              ))}
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-brand to-cyan-glow" />
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-secondary">
              <span>Downloading…</span>
              <span className="font-semibold text-white">68%</span>
            </div>
          </div>
          <div className="mt-auto m-3 rounded-lg bg-gradient-to-r from-brand to-cyan-glow py-2 text-center text-[11px] font-bold">
            Downloading MP4
          </div>
        </div>
      </div>
    </div>
  );
}
