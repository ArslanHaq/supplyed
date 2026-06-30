"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

function isInternalNavigation(anchor: HTMLAnchorElement) {
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;

  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return false;

  const nextUrl = new URL(anchor.href);
  const currentUrl = new URL(window.location.href);

  if (nextUrl.origin !== currentUrl.origin) return false;
  return nextUrl.pathname + nextUrl.search !== currentUrl.pathname + currentUrl.search;
}

export function RouteLoader() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const hideTimerRef = useRef<number | null>(null);
  const failSafeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    function clearTimers() {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      if (failSafeTimerRef.current) window.clearTimeout(failSafeTimerRef.current);
    }

    function startLoading() {
      clearTimers();
      setLoading(true);
      failSafeTimerRef.current = window.setTimeout(() => setLoading(false), 2800);
    }

    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest("a");
      if (anchor instanceof HTMLAnchorElement && isInternalNavigation(anchor)) {
        startLoading();
      }
    }

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function pushState(...args) {
      const previousUrl = window.location.href;
      const result = originalPushState.apply(this, args);
      if (window.location.href !== previousUrl) startLoading();
      return result;
    };

    window.history.replaceState = function replaceState(...args) {
      const previousUrl = window.location.href;
      const result = originalReplaceState.apply(this, args);
      if (window.location.href !== previousUrl) startLoading();
      return result;
    };

    window.addEventListener("popstate", startLoading);
    document.addEventListener("click", handleClick, true);

    return () => {
      clearTimers();
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener("popstate", startLoading);
      document.removeEventListener("click", handleClick, true);
    };
  }, []);

  useEffect(() => {
    if (!loading) return;

    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => setLoading(false), 420);
  }, [loading, pathname]);

  if (!loading) return null;

  return (
    <div aria-live="polite" aria-label="Loading page" className="route-loader" role="status">
      <div className="route-loader-bar" />
      <div className="route-loader-chip">
        <span className="route-loader-mark" />
        <span>Loading</span>
      </div>
    </div>
  );
}
