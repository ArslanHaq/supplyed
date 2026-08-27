import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    { path: "", priority: 1 },
    { path: "/founding-schools", priority: 0.9 },
    { path: "/founding-teachers", priority: 0.9 },
    { path: "/how-it-works", priority: 0.8 },
    { path: "/pricing", priority: 0.8 },
  ].map(({ path, priority }) => ({
    url: `${siteConfig.url}${path}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority,
  }));
}
