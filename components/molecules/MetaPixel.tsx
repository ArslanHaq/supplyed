"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

import { gaMeasurementId, loadGoogleAnalytics, setGoogleAnalyticsEnabled } from "@/lib/google-analytics";
import { clarityProjectId, loadClarity, setClarityConsent } from "@/lib/microsoft-clarity";
import {
  type CookieConsent,
  loadMetaPixel,
  metaPixelId,
  readCookieConsent,
  saveCookieConsent,
  subscribeCookieConsent,
} from "@/lib/meta-pixel";
import { Btn } from "../atoms";

// Signatory approval links carry a private token in the URL, which must never reach Meta, Google or Microsoft.
const excludedPathPrefixes = ["/signatory-approval"];
const trackingConfigured = Boolean(metaPixelId || gaMeasurementId || clarityProjectId);

function useCookieConsent() {
  // "unknown" while server rendering, so returning visitors never see the banner flash.
  return useSyncExternalStore<CookieConsent | null | "unknown">(subscribeCookieConsent, readCookieConsent, () => "unknown");
}

/** Cookie banner plus Google Analytics and Microsoft Clarity, which run unless the visitor rejects, and the Meta Pixel, which waits for Accept. */
export function MetaPixel() {
  const pathname = usePathname();
  const consent = useCookieConsent();
  const enabled = trackingConfigured && !excludedPathPrefixes.some((prefix) => pathname.startsWith(prefix));

  useEffect(() => {
    if (!enabled || consent === "unknown") return;
    // UK law (Data (Use and Access) Act 2025) lets analytics used only to improve the site run without consent when
    // visitors can turn it off, so GA and Clarity start straight away and stop on Reject. Meta is advertising, so it still needs Accept.
    const analytics = consent !== "rejected";
    setGoogleAnalyticsEnabled(analytics);
    if (analytics) {
      loadGoogleAnalytics();
      loadClarity();
    }
    setClarityConsent(analytics);
    if (consent === "accepted") {
      loadMetaPixel();
      window.fbq?.("consent", "grant");
      // Client-side navigation does not reload the page, so each route change records its own view.
      window.fbq?.("track", "PageView");
    } else if (consent === "rejected") {
      window.fbq?.("consent", "revoke");
      // Denied consent only switches Clarity to cookieless recording, so reload to take it off the page.
      if (window.clarity) window.location.reload();
    }
  }, [consent, enabled, pathname]);

  if (!enabled || consent !== null) return null;

  return (
    <div
      aria-label="Cookie choice"
      className="fixed inset-x-4 bottom-4 z-[75] rounded-panel border border-border bg-surface p-5 shadow-panel sm:left-5 sm:right-auto sm:max-w-[420px]"
      role="region"
    >
      <p className="text-sm font-semibold text-ink">Cookies on SupplyED</p>
      <p className="mt-1.5 text-[13px] leading-6 text-slate">
        We use Google Analytics and Microsoft Clarity to count visits and see how people use our pages, so we can improve
        them. If you accept, we&apos;ll also use Meta&apos;s (Facebook) pixel to see which of our ads bring people here.
        Reject turns all of them off. See our{" "}
        <Link className="font-semibold text-brand-dark underline underline-offset-2" href="#waitlist-privacy">
          privacy information
        </Link>
        .
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Btn onClick={() => saveCookieConsent("accepted")} size="sm" variant="secondary">
          Accept
        </Btn>
        <Btn onClick={() => saveCookieConsent("rejected")} size="sm" variant="secondary">
          Reject
        </Btn>
      </div>
    </div>
  );
}

/** Reopens the cookie banner so visitors can change their choice at any time. */
export function CookieSettingsButton() {
  if (!trackingConfigured) return null;
  return (
    <button onClick={() => saveCookieConsent(null)} type="button">
      Cookie settings
    </button>
  );
}
