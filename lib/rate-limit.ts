"use client";

import { useSyncExternalStore } from "react";

let until = 0;
let remaining = 0;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();
function sync() {
  remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000));
  for (const listener of listeners) listener();
  if (!remaining && timer) { clearInterval(timer); timer = undefined; }
}
/** The shared backend limiter can cover several sensitive routes. */
export function recordRateLimit(result: unknown) {
  if (!result || typeof result !== "object") return;
  const error = result as { status?: number; statusCode?: number; code?: string; retryAfter?: number };
  if (error.status !== 429 && error.statusCode !== 429 && error.code !== "RATE_LIMITED" && error.retryAfter === undefined) return;
  const seconds = typeof error.retryAfter === "number" && Number.isFinite(error.retryAfter) ? Math.max(0, error.retryAfter) : 60;
  until = Math.max(until, Date.now() + seconds * 1000);
  sync();
  if (remaining && !timer) timer = setInterval(sync, 1000);
}
export function rateLimitError() {
  const retryAfter = Math.max(0, Math.ceil((until - Date.now()) / 1000));
  return retryAfter ? Object.assign(new Error(`Please wait ${retryAfter} seconds before trying again.`), { status: 429, code: "RATE_LIMITED", retryAfter }) : null;
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function useRateLimit() {
  return useSyncExternalStore(subscribe, () => remaining, () => 0);
}
