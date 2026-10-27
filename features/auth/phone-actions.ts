"use server";

import { revalidateTag } from "next/cache";

import { actionError, actionOk } from "@/lib/server/action-response";
import { api, ApiError } from "@/lib/server/api-client";
import { getServerAuthContext } from "@/lib/server/auth-context";
import { validateUkPhone } from "@/lib/uk-validation";

import type { PhoneOtpChallenge, VerifiedPhoneUser } from "./phone-types";

function phoneActionError(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return actionError(error.message || fallback, { code: error.code, status: error.status, fieldErrors: error.fieldErrors, retryAfter: error.retryAfter, requestId: error.requestId });
  }
  return actionError(error instanceof Error && error.message ? error.message : fallback);
}

async function hasPhoneSession() {
  const context = await getServerAuthContext();
  return Boolean(context?.userId);
}

export async function sendPhoneOtpAction(input: { phone: string }) {
  const validation = validateUkPhone(input?.phone, { required: true });
  if (!validation.valid) {
    return actionError(validation.error!, {
      fieldErrors: { phone: validation.error! },
    });
  }

  if (!(await hasPhoneSession())) {
    return actionError("Your session expired. Sign in again to continue.", { code: "SESSION_EXPIRED" });
  }

  try {
    const challenge = await api.post<PhoneOtpChallenge>("/auth/phone/otp/send", { phone: validation.value });
    const returnedPhone = validateUkPhone(challenge?.phone, { required: true });
    if (!returnedPhone.valid || returnedPhone.value !== validation.value || !Number.isFinite(challenge.expiresInMinutes) || challenge.expiresInMinutes <= 0 ||
      !Number.isFinite(challenge.resendAvailableInSeconds) || challenge.resendAvailableInSeconds < 0) {
      throw new Error("The SMS service did not return a valid verification challenge. Try again.");
    }
    return actionOk({ ...challenge, phone: returnedPhone.value }, "Verification code sent successfully.");
  } catch (error) {
    return phoneActionError(error, "We could not send a verification code. Try again.");
  }
}

export async function verifyPhoneOtpAction(input: { otp: string }) {
  const otp = typeof input?.otp === "string" ? input.otp.trim() : "";
  if (!/^\d{6}$/.test(otp)) {
    return actionError("Enter the 6-digit code from your SMS.", {
      fieldErrors: { otp: "Enter the 6-digit code from your SMS." },
    });
  }

  if (!(await hasPhoneSession())) {
    return actionError("Your session expired. Sign in again to continue.", { code: "SESSION_EXPIRED" });
  }

  try {
    const user = await api.post<VerifiedPhoneUser>("/auth/phone/otp/verify", { otp });
    const returnedPhone = validateUkPhone(user?.phone, { required: true });
    if (!user?.id || !returnedPhone.valid || user.phoneVerified !== true) {
      throw new Error("The SMS service did not confirm your phone number. Request a new code and try again.");
    }

    revalidateTag("auth", "max");
    revalidateTag("auth:me", "max");
    revalidateTag("settings", "max");
    revalidateTag("onboarding", "max");

    return actionOk<VerifiedPhoneUser>({ id: user.id, phone: returnedPhone.value, phoneVerified: user.phoneVerified }, "Phone verified successfully.");
  } catch (error) {
    return phoneActionError(error, "We could not verify your phone number. Try again.");
  }
}
