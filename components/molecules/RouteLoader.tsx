"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { routeLoadingStartEvent } from "@/lib/navigation-loading";

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
  const loadingRef = useRef(false);
  const startedAtRef = useRef(0);
  const hideTimerRef = useRef<number | null>(null);
  const failSafeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    function clearTimers() {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      if (failSafeTimerRef.current) window.clearTimeout(failSafeTimerRef.current);
    }

    function startLoading() {
      clearTimers();
      loadingRef.current = true;
      startedAtRef.current = window.performance.now();
      setLoading(true);
      failSafeTimerRef.current = window.setTimeout(() => finishLoading(0), 4200);
    }

    function finishLoading(minimumVisibleMs = 340) {
      if (!loadingRef.current) return;

      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      const elapsed = window.performance.now() - startedAtRef.current;
      const delay = Math.max(0, minimumVisibleMs - elapsed);

      hideTimerRef.current = window.setTimeout(() => {
        loadingRef.current = false;
        setLoading(false);
      }, delay);
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest("a");
      if (anchor instanceof HTMLAnchorElement && isInternalNavigation(anchor)) {
        startLoading();
      }
    }

    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest("a");
      if (anchor instanceof HTMLAnchorElement && isInternalNavigation(anchor)) {
        startLoading();
      }
    }

    function handlePopState() {
      window.setTimeout(() => {
        startLoading();
        finishLoading();
      }, 0);
    }

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function pushState(...args) {
      const previousUrl = window.location.href;
      const result = originalPushState.apply(this, args);
      if (window.location.href !== previousUrl) {
        window.setTimeout(() => {
          if (!loadingRef.current) startLoading();
          finishLoading();
        }, 0);
      }
      return result;
    };

    window.history.replaceState = function replaceState(...args) {
      const previousUrl = window.location.href;
      const result = originalReplaceState.apply(this, args);
      if (window.location.href !== previousUrl) {
        window.setTimeout(() => {
          if (!loadingRef.current) startLoading();
          finishLoading();
        }, 0);
      }
      return result;
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener(routeLoadingStartEvent, startLoading);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("click", handleClick, true);

    return () => {
      clearTimers();
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener(routeLoadingStartEvent, startLoading);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("click", handleClick, true);
    };
  }, []);

  useEffect(() => {
    if (!loadingRef.current) return;

    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    const elapsed = window.performance.now() - startedAtRef.current;
    const delay = Math.max(0, 340 - elapsed);

    hideTimerRef.current = window.setTimeout(() => {
      loadingRef.current = false;
      setLoading(false);
    }, delay);
  }, [pathname]);

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
