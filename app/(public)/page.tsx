import type { Metadata } from "next";
import { LandingPage } from "@/components/organisms/LandingPage";
import { siteConfig } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    absolute: siteConfig.title,
  },
  description: siteConfig.description,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    url: "/",
    title: siteConfig.title,
    description: siteConfig.description,
  },
  twitter: {
    title: siteConfig.title,
    description: siteConfig.description,
  },
};

export default function Page() {
  return <LandingPage />;
}
