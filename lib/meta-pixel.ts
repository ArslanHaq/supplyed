// Meta (Facebook) Pixel for the public marketing pages. It loads on every visit, with no
// cookie banner, when a pixel ID is configured for the deployment.
export const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "";

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

/** Sends a standard event (e.g. "Lead") when the pixel is configured. Never pass personal data. */
export function trackMetaEvent(event: string, params?: Record<string, string>) {
  window.fbq?.("track", event, params);
}
