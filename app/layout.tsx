import "./globals.css";
import "@/components/styles/foundation.css";
import "@/components/styles/account.css";
import "@/components/styles/selectors.css";
import "@/components/styles/workspace.css";
import "@/components/styles/teacher-dashboard.css";
import "@/components/styles/proposal.css";
import "@/components/styles/proposal-preview.css";
import "@/components/styles/public.css";
import "@/components/styles/waitlist.css";

import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import type { ReactNode } from "react";
import { RouteLoader } from "@/components/molecules/RouteLoader";
import { themeBootScript } from "@/lib/theme-bootstrap";
import { seoKeywords, siteConfig } from "@/lib/seo";

const inter = localFont({
  src: [
    { path: "./fonts/InterVariable.woff2", weight: "100 900", style: "normal" },
    { path: "./fonts/InterVariable-Italic.woff2", weight: "100 900", style: "italic" },
  ],
  variable: "--font-inter",
  display: "swap",
  fallback: ["Arial", "sans-serif"],
});



export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  applicationName: siteConfig.name,
  title: {
    default: siteConfig.title,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: seoKeywords,
  authors: [{ name: siteConfig.name }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  category: "education",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: siteConfig.name,
    title: siteConfig.title,
    description: siteConfig.description,
    locale: siteConfig.locale,
  },
  twitter: {
    card: "summary",
    title: siteConfig.title,
    description: siteConfig.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html className={inter.variable} lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <Script
          dangerouslySetInnerHTML={{ __html: themeBootScript }}
          id="supplyed-theme-boot"
          strategy="beforeInteractive"
        />
        <RouteLoader />
        {children}
      </body>
    </html>
  );
}
