"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { sanitizeAuthErrorMessage } from "@/features/auth/error-messages";
import type { Toast } from "@/types/supplyed";

function getAuthToastTitle(message: string) {
  if (/password account|email and password|email\/password|already has a SupplyED/i.test(message)) {
    return "Use email login";
  }

  if (/social sign-(in|up)|Google sign-in|Microsoft sign-in|not available/i.test(message)) {
    return "Social sign-in unavailable";
  }

  if (/verification|code|OTP/i.test(message)) {
    return "Verification failed";
  }

  return "Authentication failed";
}

export function useAuthToasts(initialError?: string) {
  const [authToasts, setAuthToasts] = useState<Toast[]>([]);
  const initialShownRef = useRef(false);

  const dismissAuthToast = useCallback((id: string) => {
    setAuthToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showAuthError = useCallback((message: string | undefined, fallback?: string) => {
    const id = Math.random().toString(36).slice(2);
    const msg = sanitizeAuthErrorMessage(message, fallback);

    setAuthToasts((current) => [
      ...current,
      {
        icon: "x",
        id,
        msg,
        title: getAuthToastTitle(msg),
        tone: "danger",
      },
    ]);
  }, []);

  useEffect(() => {
    if (initialShownRef.current || !initialError) return;
    initialShownRef.current = true;
    showAuthError(initialError);

    const url = new URL(window.location.href);
    const authErrorParams = ["auth_error", "error", "code"];
    const hasAuthErrorParam = authErrorParams.some((param) => url.searchParams.has(param));

    if (hasAuthErrorParam) {
      authErrorParams.forEach((param) => url.searchParams.delete(param));
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, [initialError, showAuthError]);

  return { authToasts, dismissAuthToast, showAuthError };
}
