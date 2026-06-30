import type { Metadata } from "next";

export const siteConfig = {
  name: "SupplyED",
  title: "SupplyED | Vetted Supply Teachers for UK Schools",
  description:
    "SupplyED helps UK schools find vetted, DBS-checked supply teachers for same-day cover, long-term roles, and competitive staffing briefs.",
  url: process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://supplyed.co.uk",
  locale: "en_GB",
};

export const seoKeywords = [
  "SupplyED",
  "supply teachers",
  "school staffing",
  "DBS checked teachers",
  "UK schools",
  "teacher marketplace",
  "supply teaching jobs",
];

export function noIndexMetadata(title: string, description?: string): Metadata {
  return {
    title: {
      absolute: `${title} | ${siteConfig.name}`,
    },
    description,
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    },
  };
}
