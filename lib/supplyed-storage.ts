import { defaultState, defaultTweaks } from "@/data/supplyed";
import type { AppState, Toast, Tweaks } from "@/types/supplyed";

const stateKey = "supplyed_state";
const tweaksKey = "supplyed_tweaks";

export function loadAppState(): AppState {
  if (typeof window === "undefined") return defaultState;

  try {
    const saved = JSON.parse(window.localStorage.getItem(stateKey) || "{}") as Partial<AppState>;
    return { ...defaultState, ...saved, toasts: [] as Toast[] };
  } catch {
    return defaultState;
  }
}

export function saveAppState(state: AppState) {
  if (typeof window === "undefined") return;

  const { toasts, ...persistedState } = state;
  window.localStorage.setItem(stateKey, JSON.stringify(persistedState));
}

export function loadTweaks(): Tweaks {
  if (typeof window === "undefined") return defaultTweaks;

  try {
    const savedTweaks = JSON.parse(window.localStorage.getItem(tweaksKey) || "{}") as Partial<Tweaks>;
    return { ...defaultTweaks, ...savedTweaks };
  } catch {
    return defaultTweaks;
  }
}

export function saveTweaks(tweaks: Tweaks) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(tweaksKey, JSON.stringify(tweaks));
}
