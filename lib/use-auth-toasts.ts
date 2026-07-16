"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { sanitizeAuthErrorMessage } from "@/features/auth/error-messages";
import type { Toast } from "@/types/supplyed";

function getAuthToastTitle(message: string) {
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
  const timersRef = useRef<number[]>([]);

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

    const timer = window.setTimeout(() => {
      setAuthToasts((current) => current.filter((toast) => toast.id !== id));
      timersRef.current = timersRef.current.filter((item) => item !== timer);
    }, 7000);

    timersRef.current.push(timer);
  }, []);

  useEffect(() => {
    if (initialShownRef.current || !initialError) return;
    initialShownRef.current = true;
    showAuthError(initialError);
  }, [initialError, showAuthError]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  return { authToasts, showAuthError };
}
