"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandGlyph } from "../lib/brand-lookup";
import { BRANDS } from "../lib/brands";
import {
  FacebookIcon,
  InstagramIcon,
  PinterestIcon,
  RedditIcon,
  SnapchatIcon,
  TikTokIcon,
  TwitchIcon,
  VimeoIcon,
  XIcon,
  YouTubeIcon,
} from "./icons";

const SHOWCASE = [
  { name: "YouTube", Icon: YouTubeIcon, color: "text-[#FF0000]" },
  { name: "Facebook", Icon: FacebookIcon, color: "text-[#1877F2]" },
  { name: "Instagram", Icon: InstagramIcon, color: "text-[#E4405F]" },
  { name: "TikTok", Icon: TikTokIcon, color: "text-white" },
  { name: "Pinterest", Icon: PinterestIcon, color: "text-[#E60023]" },
  { name: "X (Twitter)", Icon: XIcon, color: "text-white" },
  { name: "Reddit", Icon: RedditIcon, color: "text-[#FF4500]" },
  { name: "Vimeo", Icon: VimeoIcon, color: "text-[#1AB7EA]" },
  { name: "Twitch", Icon: TwitchIcon, color: "text-[#9146FF]" },
  { name: "Snapchat", Icon: SnapchatIcon, color: "text-[#FFFC00]" },
];

const EXTRA_SLUGS = [
  "dailymotion",
  "soundcloud",
  "telegram",
  "threads",
  "tumblr",
  "vk",
  "bilibili",
  "odysee",
  "rumble",
  "ted",
  "imdb",
  "9gag",
  "discord",
  "mastodon",
  "bluesky",
  "kick",
  "niconico",
  "odnoklassniki",
  "flickr",
  "loom",
];

type Stats = { total_sites: number; verified_curated: number; categories: string[] };

export default function PlatformsShowcase() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    apiSafe();
    async function apiSafe() {
      try {
        const res = await fetch("/api/catalog/stats");
        if (res.ok) setStats(await res.json());
      } catch {}
    }
  }, []);

  return (
    <section className="section-pad py-14">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold sm:text-4xl">
          Supported <span className="gradient-text">Platforms</span>
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-secondary">
          {stats ? (
            <>
              Extraction engine covers <span className="font-semibold text-white">{stats.total_sites.toLocaleString()}+</span> websites ·
              curated &amp; verified providers: <span className="font-semibold text-white">{stats.verified_curated}</span>
            </>
          ) : (
            "Paste a link from any popular platform — the gateway detects the provider automatically."
          )}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {SHOWCASE.map(({ name, Icon, color }) => (
          <div key={name} className="glass glass-hover flex items-center gap-3 px-4 py-3.5">
            <Icon className={`h-6 w-6 shrink-0 ${color}`} />
            <span className="truncate text-sm font-semibold">{name}</span>
          </div>
        ))}
        {EXTRA_SLUGS.map((slug) => {
          const brand = BRANDS[slug];
          if (!brand) return null;
          return (
            <div key={slug} className="glass glass-hover flex items-center gap-3 px-4 py-3.5">
              <BrandGlyph icon={brand} className="h-6 w-6 shrink-0" />
              <span className="truncate text-sm font-semibold">{brand.title}</span>
            </div>
          );
        })}
        <Link
          href="/sites"
          className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-brand/40 bg-brand/5 px-4 py-3.5 text-sm font-semibold text-brand transition-colors hover:bg-brand/10"
        >
          View All Platforms →
        </Link>
      </div>
    </section>
  );
}
