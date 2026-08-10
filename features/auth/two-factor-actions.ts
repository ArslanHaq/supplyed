"use server";

import { actionError, actionOk } from "@/lib/server/action-response";
import { api, ApiError } from "@/lib/server/api-client";

type TwoFactorStatus = {
  enabled: boolean;
  recoveryCodesRemaining: number;
  setupPending: boolean;
};

type TwoFactorSetup = {
  otpAuthUri: string;
  qrCodeDataUrl: string;
  secret: string;
};

type TwoFactorRecoveryCodes = {
  recoveryCodes: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : "";
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
}

function readActionError(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.message) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function normalizeCode(formData: FormData) {
  return String(formData.get("code") ?? "").trim().toUpperCase();
}

function validateVerificationCode(code: string) {
  return /^(?:\d{6}|[A-HJ-NP-Z2-9]{4}(?:-[A-HJ-NP-Z2-9]{4}){3})$/i.test(code);
}

function normalizeStatus(payload: unknown): TwoFactorStatus {
  const record = isRecord(payload) ? payload : {};

  return {
    enabled: readBoolean(record.enabled),
    recoveryCodesRemaining: readNumber(record.recoveryCodesRemaining),
    setupPending: readBoolean(record.setupPending),
  };
}

function normalizeSetup(payload: unknown): TwoFactorSetup {
  const record = isRecord(payload) ? payload : {};
  const secret = readString(record.secret);
  const otpAuthUri = readString(record.otpAuthUri);
  const qrCodeDataUrl = readString(record.qrCodeDataUrl);

  if (!secret || !otpAuthUri || !qrCodeDataUrl) {
    throw new Error("The backend did not return a complete two-factor setup response.");
  }

  return { otpAuthUri, qrCodeDataUrl, secret };
}

function normalizeRecoveryCodes(payload: unknown): TwoFactorRecoveryCodes {
  const record = isRecord(payload) ? payload : {};
  const recoveryCodes = readStringArray(record.recoveryCodes);

  if (recoveryCodes.length === 0) {
    throw new Error("The backend did not return recovery codes.");
  }

  return { recoveryCodes };
}

export async function getTwoFactorStatusAction() {
  try {
    return actionOk(normalizeStatus(await api.get<unknown>("/auth/2fa/status")));
  } catch (error) {
    return actionError(readActionError(error, "We could not load two-factor authentication status."));
  }
}

export async function startTwoFactorSetupAction() {
  try {
    return actionOk(normalizeSetup(await api.post<unknown>("/auth/2fa/setup")));
  } catch (error) {
    return actionError(readActionError(error, "We could not start two-factor authentication setup."));
  }
}

export async function enableTwoFactorAction(_previousState: unknown, formData: FormData) {
  const code = normalizeCode(formData);

  if (!/^\d{6}$/.test(code)) {
    return actionError("Enter the 6-digit code from your authenticator app.", {
      fieldErrors: { code: "Enter the 6-digit code from your authenticator app." },
    });
  }

  try {
    return actionOk(normalizeRecoveryCodes(await api.post<unknown>("/auth/2fa/enable", { code })), "Two-factor authentication is now enabled.");
  } catch (error) {
    return actionError(readActionError(error, "We could not enable two-factor authentication."), {
      fieldErrors: { code: "Check the authenticator code and try again." },
    });
  }
}

export async function disableTwoFactorAction(_previousState: unknown, formData: FormData) {
  const code = normalizeCode(formData);

  if (!validateVerificationCode(code)) {
    return actionError("Enter a 6-digit authenticator code or a valid recovery code.", {
      fieldErrors: { code: "Enter a 6-digit authenticator code or a valid recovery code." },
    });
  }

  try {
    return actionOk(normalizeStatus(await api.post<unknown>("/auth/2fa/disable", { code })), "Two-factor authentication is disabled.");
  } catch (error) {
    return actionError(readActionError(error, "We could not disable two-factor authentication."), {
      fieldErrors: { code: "Check the code and try again." },
    });
  }
}

export async function regenerateTwoFactorRecoveryCodesAction(_previousState: unknown, formData: FormData) {
  const code = normalizeCode(formData);

  if (!validateVerificationCode(code)) {
    return actionError("Enter a 6-digit authenticator code or a valid recovery code.", {
      fieldErrors: { code: "Enter a 6-digit authenticator code or a valid recovery code." },
    });
  }

  try {
    return actionOk(
      normalizeRecoveryCodes(await api.post<unknown>("/auth/2fa/recovery-codes", { code })),
      "New recovery codes generated.",
    );
  } catch (error) {
    return actionError(readActionError(error, "We could not generate new recovery codes."), {
      fieldErrors: { code: "Check the code and try again." },
    });
  }
}
