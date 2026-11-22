import type { ComponentType, CSSProperties } from "react";
import {
  FacebookIcon,
  InstagramIcon,
  LinkIcon,
  PinterestIcon,
  RedditIcon,
  SnapchatIcon,
  TikTokIcon,
  TwitchIcon,
  VimeoIcon,
  XIcon,
  YouTubeIcon,
} from "../components/icons";
import { BRANDS } from "./brands";
import type { BrandIcon } from "./brand-types";

export type BrandVisual = {
  name: string;
  Icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  color: string;
};

export function BrandGlyph({ icon, className }: { icon: BrandIcon; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill={`#${icon.hex}`} className={className} aria-hidden="true">
      <path d={icon.path} />
    </svg>
  );
}

const COMPONENT_BRANDS: Record<string, BrandVisual> = {
  youtube: { name: "YouTube", Icon: YouTubeIcon, color: "#FF0000" },
  facebook: { name: "Facebook", Icon: FacebookIcon, color: "#1877F2" },
  instagram: { name: "Instagram", Icon: InstagramIcon, color: "#E4405F" },
  tiktok: { name: "TikTok", Icon: TikTokIcon, color: "#FFFFFF" },
  douyin: { name: "Douyin (TikTok China)", Icon: TikTokIcon, color: "#FFFFFF" },
  twitter: { name: "X (Twitter)", Icon: XIcon, color: "#FFFFFF" },
  pinterest: { name: "Pinterest", Icon: PinterestIcon, color: "#E60023" },
  reddit: { name: "Reddit", Icon: RedditIcon, color: "#FF4500" },
  vimeo: { name: "Vimeo", Icon: VimeoIcon, color: "#1AB7EA" },
  twitch: { name: "Twitch", Icon: TwitchIcon, color: "#9146FF" },
  snapchat: { name: "Snapchat", Icon: SnapchatIcon, color: "#FFFC00" },
};

const ALIASES: Record<string, string> = {
  twitter: "x",
  xtwitter: "x",
  vkvideo: "vk",
  vktv: "vk",
  vkwallpost: "vk",
  nbcnews: "nbc",
  douyin: "tiktok",
  nicovideo: "niconico",
  discordembeds: "discord",
  discordunembeds: "discord",
};

export function resolveBrand(platform: string | null): BrandVisual {
  const key = (platform || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!key) return { name: "Video", Icon: LinkIcon, color: "#00CFFF" };
  if (COMPONENT_BRANDS[key]) return COMPONENT_BRANDS[key];
  const slug = ALIASES[key] ?? key;
  let icon = BRANDS[slug];
  if (!icon && key.length >= 4) {
    const match = Object.keys(BRANDS).find((name) => name.startsWith(key));
    if (match) icon = BRANDS[match];
  }
  if (icon) {
    return {
      name: icon.title,
      Icon: ({ className }) => <BrandGlyph icon={icon} className={className} />,
      color: `#${icon.hex}`,
    };
  }
  return { name: platform || "Video", Icon: LinkIcon, color: "#00CFFF" };
}
