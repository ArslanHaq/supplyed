import "./globals.css";

import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import type { ReactNode } from "react";
import { RouteLoader } from "@/components/molecules/RouteLoader";
import { themeBootScript } from "@/lib/theme-bootstrap";
import { seoKeywords, siteConfig } from "@/lib/seo";

const inter = localFont({
  src: "./fonts/InterLatinVariable.woff2",
  weight: "400 800",
  style: "normal",
  variable: "--font-inter",
  // Avoid a late font swap moving hydrated controls on slow connections.
  display: "optional",
  adjustFontFallback: "Arial",
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
