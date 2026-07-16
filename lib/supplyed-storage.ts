import { defaultState, defaultTweaks } from "@/data/supplyed";
import type { AppRole, AppState, AuthState, Toast, Tweaks } from "@/types/supplyed";

const stateKey = "supplyed_state";
const tweaksKey = "supplyed_tweaks";

export function loadAppState(): AppState {
  if (typeof window === "undefined") return defaultState;

  try {
    const savedRecord = JSON.parse(window.localStorage.getItem(stateKey) || "{}") as Record<string, unknown>;
    const saved = savedRecord as Partial<AppState>;
    const rawRole = typeof savedRecord.role === "string" ? savedRecord.role : undefined;
    const savedRole = (rawRole === "guardian" ? "individual" : rawRole) as AppRole | undefined;
    const merged = { ...defaultState, ...saved, ...(savedRole ? { role: savedRole } : {}), toasts: [] as Toast[] };

    return {
      ...merged,
      roleSelected: saved.roleSelected ?? Boolean(saved.onboardingComplete || saved.auth === "signed-in"),
      applicationStatus: saved.applicationStatus ?? (saved.onboardingComplete ? "approved" : "none"),
    };
  } catch {
    return defaultState;
  }
}

export function saveAppState(state: AppState) {
  if (typeof window === "undefined") return;

  const { toasts, ...persistedState } = state;
  window.localStorage.setItem(stateKey, JSON.stringify(persistedState));
}

export function resetAuthFlowState(state: AppState, auth: Extract<AuthState, "landing" | "login" | "onboarding">): AppState {
  return {
    ...state,
    applicationStatus: "none",
    auth,
    ctx: {},
    onboardingComplete: false,
    onboardingStep: 1,
    page: "dashboard",
    roleSelected: false,
    signupEmail: "",
    signupVerified: false,
  };
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
