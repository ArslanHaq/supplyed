"use client";

import { useCallback, useEffect, useSyncExternalStore, type SetStateAction } from "react";
import type { Tweaks } from "@/types/supplyed";
import { getServerTweaksSnapshot, getTweaksSnapshot, loadTweaks, saveTweaks, subscribeTweaks } from "./supplyed-preferences";
import { applyBrandTheme } from "./theme";

export function useTweaks() {
  const tweaks = useSyncExternalStore(subscribeTweaks, getTweaksSnapshot, getServerTweaksSnapshot);
  const setTweaks = useCallback((update: SetStateAction<Tweaks>) => {
    saveTweaks(typeof update === "function" ? update(loadTweaks()) : update);
  }, []);

  useEffect(() => {
    // Read the client snapshot even during hydration; never repaint a saved theme
    // with the server default or persist the default over the user's choice.
    applyBrandTheme(getTweaksSnapshot().accent);
  }, [tweaks.accent]);

  return [tweaks, setTweaks] as const;
}
