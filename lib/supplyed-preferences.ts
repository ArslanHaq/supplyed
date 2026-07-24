import { defaultTweaks } from "@/data/supplyed";
import type { Tweaks } from "@/types/supplyed";

let sessionTweaks: Tweaks = { ...defaultTweaks };

export function loadTweaks(): Tweaks {
  return { ...sessionTweaks };
}

export function saveTweaks(tweaks: Tweaks) {
  sessionTweaks = { ...tweaks };
}
