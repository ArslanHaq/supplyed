"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

import { gaMeasurementId, loadGoogleAnalytics, setGoogleAnalyticsEnabled } from "@/lib/google-analytics";
import {
  type CookieConsent,
  loadMetaPixel,
  metaPixelId,
  readCookieConsent,
  saveCookieConsent,
  subscribeCookieConsent,
} from "@/lib/meta-pixel";
import { Btn } from "../atoms";

// Signatory approval links carry a private token in the URL, which must never reach Meta or Google.
const excludedPathPrefixes = ["/signatory-approval"];
const trackingConfigured = Boolean(metaPixelId || gaMeasurementId);

function useCookieConsent() {
  // "unknown" while server rendering, so returning visitors never see the banner flash.
  return useSyncExternalStore<CookieConsent | null | "unknown">(subscribeCookieConsent, readCookieConsent, () => "unknown");
}

/** Cookie banner plus the Meta Pixel and Google Analytics, which load only after the visitor accepts. */
export function MetaPixel() {
  const pathname = usePathname();
  const consent = useCookieConsent();
  const enabled = trackingConfigured && !excludedPathPrefixes.some((prefix) => pathname.startsWith(prefix));

  useEffect(() => {
    if (!enabled) return;
    if (consent === "accepted") {
      setGoogleAnalyticsEnabled(true);
      loadGoogleAnalytics();
      loadMetaPixel();
      window.fbq?.("consent", "grant");
      // Client-side navigation does not reload the page, so each route change records its own view.
      window.fbq?.("track", "PageView");
    } else if (consent === "rejected") {
      setGoogleAnalyticsEnabled(false);
      window.fbq?.("consent", "revoke");
    }
  }, [consent, enabled, pathname]);

  if (!enabled || consent !== null) return null;

  return (
    <div
      aria-label="Cookie choice"
      className="fixed inset-x-4 bottom-4 z-[75] rounded-panel border border-border bg-surface p-5 shadow-panel sm:left-5 sm:right-auto sm:max-w-[420px]"
      role="region"
    >
      <p className="text-sm font-semibold text-ink">Can we use cookies to measure visits?</p>
      <p className="mt-1.5 text-[13px] leading-6 text-slate">
        We&apos;d like to use Google Analytics to count visits and Meta&apos;s (Facebook) pixel to see which of our ads bring
        people to SupplyED. They only load if you accept. See our{" "}
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
