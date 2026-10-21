// Meta (Facebook) Pixel for the public marketing pages. It is a marketing cookie, so
// under UK GDPR / PECR it loads only after the visitor accepts, and only when a
// pixel ID is configured for the deployment.
export const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "";

export type CookieConsent = "accepted" | "rejected";

const consentKey = "supplyed_cookie_consent";
const consentChangeEvent = "supplyed:cookie-consent";

type MetaFbq = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: MetaFbq;
  loaded: boolean;
  version: string;
};

declare global {
  interface Window {
    fbq?: MetaFbq;
    _fbq?: MetaFbq;
  }
}

export function readCookieConsent(): CookieConsent | null {
  try {
    const value = window.localStorage.getItem(consentKey);
    return value === "accepted" || value === "rejected" ? value : null;
  } catch {
    return null;
  }
}

/** Saves the visitor's choice; `null` clears it so the banner asks again. */
export function saveCookieConsent(value: CookieConsent | null) {
  try {
    if (value) window.localStorage.setItem(consentKey, value);
    else window.localStorage.removeItem(consentKey);
  } catch {
    // Storage can be blocked; the choice then lasts for this page view only.
  }
  window.dispatchEvent(new Event(consentChangeEvent));
}

export function subscribeCookieConsent(onChange: () => void) {
  window.addEventListener(consentChangeEvent, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(consentChangeEvent, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Meta's base code: queues calls until fbevents.js loads, then initialises the pixel once. */
export function loadMetaPixel() {
  if (!metaPixelId || window.fbq) return;

  const fbq = ((...args: unknown[]) => {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  }) as MetaFbq;
  fbq.queue = [];
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  window.fbq = fbq;
  window._fbq ??= fbq;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);

  fbq("init", metaPixelId);
}

/** Sends a standard event (e.g. "Lead") when the pixel is configured and the visitor accepted. Never pass personal data. */
export function trackMetaEvent(event: string, params?: Record<string, string>) {
  if (!metaPixelId || readCookieConsent() !== "accepted") return;
  window.fbq?.("track", event, params);
}
