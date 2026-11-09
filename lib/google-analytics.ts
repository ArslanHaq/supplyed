// Google Analytics 4 for the public marketing pages, used only to measure and improve the site.
// UK law allows that without consent when visitors can turn it off, so it runs unless they
// reject the cookie banner, and only when a measurement ID is configured for the deployment.
import { readCookieConsent } from "./meta-pixel";

export const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? "";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** Google's gtag.js snippet. GA's enhanced measurement records client-side page changes, so this runs once. */
export function loadGoogleAnalytics() {
  if (!gaMeasurementId || window.gtag) return;

  const dataLayer = (window.dataLayer ??= []);
  // gtag.js only reads the `arguments` object, not a plain array.
  window.gtag = function gtag() {
    dataLayer.push(arguments);
  };

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaMeasurementId)}`;
  document.head.appendChild(script);

  window.gtag("js", new Date());
  // Measures visits only; Google's advertising features stay off.
  window.gtag("config", gaMeasurementId, { allow_google_signals: false, allow_ad_personalization_signals: false });
}

/** Google's documented opt-out flag: stops GA sending anything after the visitor rejects. */
export function setGoogleAnalyticsEnabled(enabled: boolean) {
  if (!gaMeasurementId) return;
  (window as unknown as Record<string, boolean>)[`ga-disable-${gaMeasurementId}`] = !enabled;
}

/** Sends an event (e.g. "generate_lead") when GA is configured and the visitor has not turned it off. Never pass personal data. */
export function trackGoogleEvent(event: string, params?: Record<string, string>) {
  if (!gaMeasurementId || readCookieConsent() === "rejected") return;
  window.gtag?.("event", event, params);
}
