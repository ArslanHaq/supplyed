export const routeLoadingStartEvent = "supplyed:route-loading-start";

export function startRouteLoading() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(routeLoadingStartEvent));
}
