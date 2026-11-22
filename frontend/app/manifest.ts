import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VideoDownloader — Fast • Free • All in One",
    short_name: "VideoDL",
    description: "Download videos from 1000+ supported websites — paste a link, pick a quality, save.",
    start_url: "/",
    display: "standalone",
    background_color: "#020B1B",
    theme_color: "#087BFF",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
