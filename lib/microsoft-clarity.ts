// Microsoft Clarity (heatmaps and session recordings) for the public marketing pages. It loads
// on every visit, with no cookie banner, when a project ID is configured for the deployment.
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

  // Without a consent signal Clarity treats UK visitors as unconsented and records each page view
  // separately. Ads storage stays denied: the site runs no Microsoft ads.
  clarity("consentv2", { ad_Storage: "denied", analytics_Storage: "granted" });
}

/** Tags the current recording so it can be filtered in Clarity (e.g. visitors who joined the waitlist). */
export function trackClarityEvent(event: string) {
  window.clarity?.("event", event);
}
