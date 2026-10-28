import { defaultTweaks } from "@/data/supplyed";
import type { Tweaks } from "@/types/supplyed";
import { deriveBrandTheme } from "./theme";

let sessionTweaks: Tweaks = { ...defaultTweaks };
const listeners = new Set<() => void>();

function updateSnapshot(next: Tweaks) {
  if (next.accent !== sessionTweaks.accent || next.urgentBanner !== sessionTweaks.urgentBanner) {
    sessionTweaks = next;
  }
}

export function loadTweaks(): Tweaks {
  try {
    const saved = JSON.parse(window.localStorage.getItem("supplyed_tweaks") || "null");
    if (saved && typeof saved === "object") {
      updateSnapshot({
        accent: typeof saved.accent === "string" ? deriveBrandTheme(saved.accent).accent : sessionTweaks.accent,
        urgentBanner: typeof saved.urgentBanner === "boolean" ? saved.urgentBanner : sessionTweaks.urgentBanner,
      });
    }
  } catch { /* Storage may be unavailable; keep the current session preference. */ }
  return { ...sessionTweaks };
}

export function saveTweaks(tweaks: Tweaks) {
  updateSnapshot({ ...tweaks, accent: deriveBrandTheme(tweaks.accent).accent });
  try { window.localStorage.setItem("supplyed_tweaks", JSON.stringify(sessionTweaks)); }
  catch { /* A blocked storage setting must not prevent theme changes. */ }
  for (const listener of listeners) listener();
}

// React needs a stable snapshot identity until the stored values actually change.
export function getTweaksSnapshot(): Tweaks {
  loadTweaks();
  return sessionTweaks;
}

export function getServerTweaksSnapshot(): Tweaks {
  return defaultTweaks;
}

export function subscribeTweaks(listener: () => void) {
  listeners.add(listener);
  const refresh = () => listener();
  const onStorage = (event: StorageEvent) => {
    if (event.key === "supplyed_tweaks" || event.key === null) refresh();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("focus", refresh);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("focus", refresh);
  };
}
