// Microsoft Clarity (heatmaps and session recordings) for the public marketing pages. It sets
// cookies, so like the Meta Pixel it loads only after the visitor accepts the cookie banner,
// and only when a project ID is configured for the deployment.
import { readCookieConsent } from "./meta-pixel";

export const clarityProjectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID?.trim() ?? "";

type ClarityQueue = {
  (...args: unknown[]): void;
  q?: unknown[];
};

declare global {
  interface Window {
    clarity?: ClarityQueue;
  }
}

let sentConsent: boolean | null = null;

/** Microsoft's tag snippet: queues calls until the tag script loads. */
export function loadClarity() {
  if (!clarityProjectId || window.clarity) return;

  // The tag script replays `arguments` objects from the queue, as in Microsoft's snippet.
  const clarity = function () {
    (clarity.q ??= []).push(arguments);
  } as ClarityQueue;
  window.clarity = clarity;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${encodeURIComponent(clarityProjectId)}`;
  document.head.appendChild(script);
}

/**
 * Passes the banner choice to Clarity's Consent API v2, which it requires for UK visitors.
 * Microsoft asks for one call per change, not one per page. Ads storage stays denied: the site runs no Microsoft ads.
 */
export function setClarityConsent(granted: boolean) {
  if (!window.clarity || sentConsent === granted) return;
  sentConsent = granted;
  window.clarity("consentv2", { ad_Storage: "denied", analytics_Storage: granted ? "granted" : "denied" });
}

/** Tags the current recording so it can be filtered in Clarity (e.g. visitors who joined the waitlist). */
export function trackClarityEvent(event: string) {
  if (!clarityProjectId || readCookieConsent() !== "accepted") return;
  window.clarity?.("event", event);
}
