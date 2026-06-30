import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/seo";

const privateRoutes = [
  "/admin",
  "/applications",
  "/billing",
  "/calendar",
  "/dashboard",
  "/find-jobs",
  "/find-teachers",
  "/forgot-password",
  "/job-detail",
  "/login",
  "/messaging",
  "/onboarding",
  "/post-job",
  "/signup",
  "/teacher-profile",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: privateRoutes,
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
