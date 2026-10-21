"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

import {
  type CookieConsent,
  loadMetaPixel,
  metaPixelId,
  readCookieConsent,
  saveCookieConsent,
  subscribeCookieConsent,
} from "@/lib/meta-pixel";
import { Btn } from "../atoms";

// Signatory approval links carry a private token in the URL, which must never reach Meta.
const excludedPathPrefixes = ["/signatory-approval"];

function useCookieConsent() {
  // "unknown" while server rendering, so returning visitors never see the banner flash.
  return useSyncExternalStore<CookieConsent | null | "unknown">(subscribeCookieConsent, readCookieConsent, () => "unknown");
}

/** Cookie banner plus the Meta Pixel, which loads only after the visitor accepts. */
export function MetaPixel() {
  const pathname = usePathname();
  const consent = useCookieConsent();
  const enabled = Boolean(metaPixelId) && !excludedPathPrefixes.some((prefix) => pathname.startsWith(prefix));

  useEffect(() => {
    if (!enabled) return;
    if (consent === "accepted") {
      loadMetaPixel();
      window.fbq?.("consent", "grant");
      // Client-side navigation does not reload the page, so each route change records its own view.
      window.fbq?.("track", "PageView");
    } else if (consent === "rejected") {
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
      <p className="text-sm font-semibold text-ink">Can we use a marketing cookie?</p>
      <p className="mt-1.5 text-[13px] leading-6 text-slate">
        We&apos;d like to use Meta&apos;s (Facebook) pixel to see which of our ads bring people to SupplyED. It only loads if you
        accept. See our{" "}
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
  if (!metaPixelId) return null;
  return (
    <button onClick={() => saveCookieConsent(null)} type="button">
      Cookie settings
    </button>
  );
}
