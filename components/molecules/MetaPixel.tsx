"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { loadGoogleAnalytics } from "@/lib/google-analytics";
import { loadMetaPixel } from "@/lib/meta-pixel";
import { loadClarity } from "@/lib/microsoft-clarity";

// Signatory approval links carry a private token in the URL, which must never reach Meta, Google or Microsoft.
const excludedPathPrefixes = ["/signatory-approval"];

/** Loads Google Analytics, Microsoft Clarity and the Meta Pixel on every public page, with no cookie banner. */
export function MetaPixel() {
  const pathname = usePathname();
  const enabled = !excludedPathPrefixes.some((prefix) => pathname.startsWith(prefix));

  useEffect(() => {
    if (!enabled) return;
    loadGoogleAnalytics();
    loadClarity();
    loadMetaPixel();
    // Client-side navigation does not reload the page, so each route change records its own view.
    window.fbq?.("track", "PageView");
  }, [enabled, pathname]);

  return null;
}
