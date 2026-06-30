import "./globals.css";

import type { Metadata } from "next";
import Script from "next/script";
import type { ReactNode } from "react";
import { seoKeywords, siteConfig } from "@/lib/seo";

const themeBootScript = `
(function () {
  try {
    var saved = JSON.parse(window.localStorage.getItem("supplyed_tweaks") || "{}");
    var accent = String(saved.accent || "#008CC4").trim();
    if (!/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(accent)) accent = "#008CC4";
    if (accent.charAt(0) !== "#") accent = "#" + accent;
    if (accent.length === 4) accent = "#" + accent[1] + accent[1] + accent[2] + accent[2] + accent[3] + accent[3];
    var rgb = {
      r: parseInt(accent.slice(1, 3), 16),
      g: parseInt(accent.slice(3, 5), 16),
      b: parseInt(accent.slice(5, 7), 16)
    };
    function mix(to, weight) {
      var from = rgb;
      return "#" + [from.r + (to.r - from.r) * weight, from.g + (to.g - from.g) * weight, from.b + (to.b - from.b) * weight]
        .map(function (value) { return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0"); })
        .join("");
    }
    var root = document.documentElement.style;
    root.setProperty("--se", accent);
    root.setProperty("--se-rgb", rgb.r + " " + rgb.g + " " + rgb.b);
    root.setProperty("--se-dark", mix({ r: 0, g: 0, b: 0 }, 0.22));
    root.setProperty("--se-tint", mix({ r: 255, g: 255, b: 255 }, 0.9));
    root.setProperty("--se-tint-2", mix({ r: 255, g: 255, b: 255 }, 0.78));
  } catch (error) {}
})();
`;

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
    <html lang="en" suppressHydrationWarning>
      <body>
        <Script
          dangerouslySetInnerHTML={{ __html: themeBootScript }}
          id="supplyed-theme-boot"
          strategy="beforeInteractive"
        />
        {children}
      </body>
    </html>
  );
}
