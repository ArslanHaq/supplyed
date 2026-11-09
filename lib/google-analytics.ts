// Google Analytics 4 for the public marketing pages. It loads on every visit, with no
// cookie banner, when a measurement ID is configured for the deployment.
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

/** Sends an event (e.g. "generate_lead") when GA is configured. Never pass personal data. */
export function trackGoogleEvent(event: string, params?: Record<string, string>) {
  window.gtag?.("event", event, params);
}
