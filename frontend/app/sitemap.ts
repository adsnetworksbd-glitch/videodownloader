import type { MetadataRoute } from "next";
import { ARTICLES } from "../lib/articles";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.SITE_URL || "http://localhost:3000";
  const paths = [
    "",
    "/sites",
    "/blog",
    "/privacy",
    "/terms",
    "/disclaimer",
    "/contact",
    "/pro",
    "/history",
    ...ARTICLES.map((article) => `/blog/${article.slug}`),
  ];
  return paths.map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
  }));
}
