"use client";

import { useSyncExternalStore } from "react";

function subscribe(onStoreChange: () => void) {
  const timer = window.setTimeout(onStoreChange, 0);
  return () => window.clearTimeout(timer);
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

export function useMounted() {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
