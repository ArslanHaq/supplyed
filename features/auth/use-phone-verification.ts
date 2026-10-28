"use client";

import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

import type { OnboardingProfileSnapshot } from "@/features/onboarding/types";
import type { SettingsProfileSnapshot } from "@/features/settings/types";
import { startRouteLoading } from "@/lib/navigation-loading";
import { queryKeys } from "@/lib/query/keys";
import { validateUkPhone } from "@/lib/uk-validation";
import { validateOtpCode } from "@/lib/auth-code-validation";

import { sendPhoneOtpAction, verifyPhoneOtpAction } from "./phone-actions";
import type { AuthUser } from "./types";

function handleExpiredSession(result: { ok: boolean; code?: string }, navigateToLogin: () => void) {
  if (result.ok || result.code !== "SESSION_EXPIRED") return;
  startRouteLoading();
  void signOut({ redirect: false }).finally(navigateToLogin);
}

export function useSendPhoneOtp() {
  const router = useRouter();
  return useMutation({
    mutationFn: (input: { phone: string }): Promise<Awaited<ReturnType<typeof sendPhoneOtpAction>>> => {
      const phone = validateUkPhone(input.phone, { required: true });
      if (!phone.valid) return Promise.resolve({ ok: false as const, message: phone.error!, fieldErrors: { phone: phone.error! } });
      return sendPhoneOtpAction({ phone: phone.value });
    },
    mutationKey: [...queryKeys.auth.all, "phone", "send"],
    onSuccess: (result) => handleExpiredSession(result, () => router.replace("/login")),
  });
}

export function useVerifyPhoneOtp() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (input: { otp: string }): Promise<Awaited<ReturnType<typeof verifyPhoneOtpAction>>> => {
      if (!validateOtpCode(input.otp)) return Promise.resolve({ ok: false as const, message: "Enter the 6-digit code from your SMS.", fieldErrors: { otp: "Enter the 6-digit code from your SMS." } });
      return verifyPhoneOtpAction({ otp: input.otp.trim() });
    },
    mutationKey: [...queryKeys.auth.all, "phone", "verify"],
    onSuccess: async (result) => {
      handleExpiredSession(result, () => router.replace("/login"));
      if (!result.ok) return;

      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.auth.all }),
        queryClient.cancelQueries({ queryKey: queryKeys.settings.all }),
        queryClient.cancelQueries({ queryKey: queryKeys.onboarding.all }),
      ]);
      const phone = { phone: result.data.phone, phoneVerified: result.data.phoneVerified };
      queryClient.setQueryData<AuthUser | null>(queryKeys.auth.me(), (current) => current ? { ...current, ...phone } : current);
      queryClient.setQueryData<SettingsProfileSnapshot>(queryKeys.settings.profile(), (current) =>
        current ? { ...current, user: { ...current.user, ...phone } } : current,
      );
      queryClient.setQueriesData<OnboardingProfileSnapshot>({ queryKey: queryKeys.onboarding.all }, (current) =>
        current?.user ? { ...current, user: { ...current.user, ...phone } } : current,
      );

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.settings.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.all }),
      ]);
    },
  });
}

export function usePhoneVerificationPending() {
  return useIsMutating({ mutationKey: [...queryKeys.auth.all, "phone"] }) > 0;
}
