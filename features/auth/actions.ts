"use server";

import { actionError, actionOk } from "@/lib/server/action-response";
import { signIn } from "@/auth";
import { getAuthenticatedEntryHref } from "@/lib/routes";
import { api, ApiError } from "@/lib/server/api-client";
import { getServerAuthContext } from "@/lib/server/auth-context";
import type { AppRole, ApplicationStatus } from "@/types/supplyed";

import {
  createEmailAccount,
  loginWithEmail,
  normalizeRole,
  normalizeStatus,
  refreshBackendAuth,
  requestPasswordReset,
  resendEmailVerification,
  resetPassword,
  verifyEmail,
  verifyTwoFactorLogin,
} from "./backend";
import {
  parseEmailVerificationForm,
  parseForgotPasswordForm,
  parseLoginForm,
  parsePasswordResetForm,
  parseResendEmailVerificationForm,
  parseSignupForm,
  parseTwoFactorForm,
  passwordRequirementsMessage,
  validateEmail,
  validatePassword,
} from "./schemas";
import { createVerifiedEmailSessionTicket } from "./session-ticket";
import type { BackendAuthResponse, EmailVerificationResendResponse, TwoFactorLoginChallenge } from "./types";

async function createVerifiedSessionPayload(response: BackendAuthResponse) {
  const role = normalizeRole(response.user.role);
  const responseStatus = normalizeStatus(response.user.applicationStatus);
  const profileStatus = await readProfileApplicationStatus(role, response.accessToken);
  const applicationStatus = profileStatus !== "none" ? profileStatus : responseStatus;
  const sessionResponse: BackendAuthResponse = {
    ...response,
    user: {
      ...response.user,
      applicationStatus,
      role,
    },
  };

  return {
    nextHref: getAuthenticatedEntryHref({ applicationStatus, role }),
    ticket: createVerifiedEmailSessionTicket(sessionResponse),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readApiErrorText(error: ApiError) {
  const message = isRecord(error.payload) ? error.payload.message : undefined;

  if (Array.isArray(message)) return message.filter((item): item is string => typeof item === "string").join(" ");
  if (typeof message === "string") return message;

  return error.message;
}

function readApiErrorCode(error: ApiError) {
  if (!isRecord(error.payload)) return undefined;

  return readString(error.payload.code) ?? readString(error.payload.error);
}

function buildBearerHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

async function readProfileApplicationStatus(role: AppRole | null, accessToken?: string | null): Promise<ApplicationStatus> {
  if (!accessToken) return "none";

  const profilePath =
    role === "teacher" ? "/instructors/me" : role === "institution" ? "/institutions/me" : role === "individual" ? "/recruiters/me" : null;

  if (!profilePath) return "none";

  try {
    const profile = await api.get<unknown>(profilePath, {
      auth: false,
      cache: "no-store",
      headers: buildBearerHeaders(accessToken),
    });

    if (role === "individual" && isRecord(profile)) {
      const status = normalizeStatus(profile.status);
      return status === "rejected" || status === "suspended" ? status : "approved";
    }

    return normalizeStatus(isRecord(profile) ? profile.status : undefined);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) return "none";
    throw error;
  }
}

function isRegisteredEmailError(error: unknown) {
  if (!(error instanceof ApiError)) return false;

  const code = readApiErrorCode(error);
  const text = readApiErrorText(error);

  return (
    code === "EMAIL_ALREADY_REGISTERED" ||
    code === "EMAIL_VERIFICATION_PENDING" ||
    code === "EMAIL_VERIFICATION_REQUIRED" ||
    (error.status === 409 && /email .*already registered|already registered/i.test(text))
  );
}

function isEmailNotVerifiedError(error: unknown) {
  if (!(error instanceof ApiError)) return false;

  const code = readApiErrorCode(error);
  const text = readApiErrorText(error);

  return (
    code === "EMAIL_NOT_VERIFIED" ||
    code === "EMAIL_VERIFICATION_PENDING" ||
    code === "EMAIL_VERIFICATION_REQUIRED" ||
    (error.status === 403 && /email .*not verified|verify your email|email verification/i.test(text))
  );
}

function emailVerificationChallengeFromResponse(
  response: BackendAuthResponse | EmailVerificationResendResponse,
  fallbackEmail: string,
  message?: string,
) {
  const email = "user" in response ? response.user.email : response.email;

  return {
    code: "EMAIL_VERIFICATION_REQUIRED" as const,
    email: email || fallbackEmail,
    emailVerified: false as const,
    expiresInMinutes: response.expiresInMinutes,
    message,
    otpToken: response.otpToken,
  };
}

function isTwoFactorChallenge(response: BackendAuthResponse | TwoFactorLoginChallenge): response is TwoFactorLoginChallenge {
  return "twoFactorRequired" in response && response.twoFactorRequired === true;
}

async function issueLoginVerificationChallenge(email: string, message: string) {
  const resend = await resendEmailVerification({ email });

  if (resend.emailVerified) {
    return actionError("This email is already verified. Log in again to continue.", {
      code: "EMAIL_ALREADY_VERIFIED",
    });
  }

  return actionOk(emailVerificationChallengeFromResponse(resend, email, resend.message), message);
}

function toAuthActionError(error: unknown, fallback = "We could not complete that auth request.") {
  if (error instanceof ApiError) {
    return actionError(error.message || fallback);
  }

  if (error instanceof Error && error.message) {
    return actionError(error.message);
  }

  return actionError(fallback);
}

export async function loginWithEmailAction(_previousState: unknown, formData: FormData) {
  const input = parseLoginForm(formData);

  if (!validateEmail(input.email)) {
    return actionError("Use a valid email address.", {
      fieldErrors: { email: "Use a valid email address." },
    });
  }

  if (input.password.length < 8) {
    return actionError("Password must be at least 8 characters.", {
      fieldErrors: { password: "Password must be at least 8 characters." },
    });
  }

  try {
    const response = await loginWithEmail(input);

    if (isTwoFactorChallenge(response)) {
      return actionOk(response, "Enter your authenticator or recovery code to finish signing in.");
    }

    if (!response.user.emailVerified) {
      return actionOk(
        emailVerificationChallengeFromResponse(
          response,
          input.email,
          "Your email is not verified yet. We sent a new verification code.",
        ),
        "Your email is not verified yet. We sent a new verification code.",
      );
    }

    return actionOk(await createVerifiedSessionPayload(response), "Credentials accepted.");
  } catch (error) {
    if (isEmailNotVerifiedError(error)) {
      try {
        return await issueLoginVerificationChallenge(
          input.email,
          "Your email is not verified yet. We sent a new verification code.",
        );
      } catch (resendError) {
        return toAuthActionError(resendError, "Your email is not verified. We could not send a new code.");
      }
    }

    return toAuthActionError(error, "We could not sign you in with those details.");
  }
}

export async function verifyTwoFactorLoginAction(_previousState: unknown, formData: FormData) {
  const input = parseTwoFactorForm(formData);

  if (!input.twoFactorToken) {
    return actionError("Sign in again before entering your two-factor code.", {
      fieldErrors: { code: "Sign in again before entering your two-factor code." },
    });
  }

  if (!/^(?:\d{6}|[A-HJ-NP-Z2-9]{4}(?:-[A-HJ-NP-Z2-9]{4}){3})$/i.test(input.code)) {
    return actionError("Enter a 6-digit authenticator code or a valid recovery code.", {
      fieldErrors: { code: "Enter a 6-digit authenticator code or a valid recovery code." },
    });
  }

  try {
    const response = await verifyTwoFactorLogin(input);

    return actionOk(await createVerifiedSessionPayload(response), "Two-factor authentication verified.");
  } catch (error) {
    return toAuthActionError(error, "We could not verify that two-factor code.");
  }
}

export async function signupWithEmailAction(_previousState: unknown, formData: FormData) {
  const input = parseSignupForm(formData);

  if (!validateEmail(input.email)) {
    return actionError("Use a valid email address.", {
      fieldErrors: { email: "Use a valid email address." },
    });
  }

  if (!validatePassword(input.password)) {
    return actionError(passwordRequirementsMessage, {
      fieldErrors: { password: passwordRequirementsMessage },
    });
  }

  try {
    const challenge = await createEmailAccount(input);
    return actionOk(challenge, challenge.message ?? "Account created. Verify your email to continue.");
  } catch (error) {
    if (isRegisteredEmailError(error)) {
      try {
        const resend = await resendEmailVerification({ email: input.email });

        if (!resend.emailVerified) {
          return actionOk(
            {
              code: "EMAIL_VERIFICATION_PENDING" as const,
              email: resend.email,
              emailVerified: false as const,
              expiresInMinutes: resend.expiresInMinutes,
              message: resend.message,
              otpToken: resend.otpToken,
              passwordUpdated: false,
            },
            "This email already has a pending signup. We sent a new code. Use the password from your first signup attempt after verifying.",
          );
        }

        return actionError("This email is already registered. Log in instead.", {
          code: "EMAIL_ALREADY_REGISTERED",
          fieldErrors: { email: "This email is already registered. Log in instead." },
        });
      } catch (resendError) {
        return toAuthActionError(resendError, "This email is already registered. Log in or request a new code.");
      }
    }

    return toAuthActionError(error, "We could not create this account.");
  }
}

export async function forgotPasswordAction(_previousState: unknown, formData: FormData) {
  const input = parseForgotPasswordForm(formData);

  if (!validateEmail(input.email)) {
    return actionError("Use a valid email address.", {
      fieldErrors: { email: "Use a valid email address." },
    });
  }

  try {
    const challenge = await requestPasswordReset(input);
    return actionOk(challenge, "Check your email for a 6-digit reset code. If this address is registered, it should arrive shortly.");
  } catch (error) {
    return toAuthActionError(error, "We could not request a password reset.");
  }
}

export async function resetPasswordAction(_previousState: unknown, formData: FormData) {
  const input = parsePasswordResetForm(formData);

  if (input.code.length !== 6) {
    return actionError("Enter the 6-digit reset code.", {
      fieldErrors: { code: "Enter the 6-digit reset code." },
    });
  }

  if (!validatePassword(input.password)) {
    return actionError(passwordRequirementsMessage, {
      fieldErrors: { password: passwordRequirementsMessage },
    });
  }

  if (!input.otpToken) {
    return actionError("Request a new reset code before changing your password.", {
      fieldErrors: { code: "Request a new reset code before changing your password." },
    });
  }

  try {
    return actionOk(await resetPassword(input), "Password reset successfully. Log in with your new password.");
  } catch (error) {
    return toAuthActionError(error, "We could not reset your password.");
  }
}

export async function verifyEmailAction(_previousState: unknown, formData: FormData) {
  const input = parseEmailVerificationForm(formData);

  if (!validateEmail(input.email)) {
    return actionError("Use a valid email address.", {
      fieldErrors: { email: "Use a valid email address." },
    });
  }

  if (input.code.length !== 6) {
    return actionError("Enter the 6-digit verification code.", {
      fieldErrors: { code: "Enter the 6-digit verification code." },
    });
  }

  if (!input.otpToken) {
    return actionError("Request a new verification code before verifying this email.", {
      fieldErrors: { code: "Request a new verification code before verifying this email." },
    });
  }

  try {
    return actionOk(await verifyEmail(input), "Email verified.");
  } catch (error) {
    return toAuthActionError(error, "We could not verify that code.");
  }
}

export async function verifyEmailSessionAction(_previousState: unknown, formData: FormData) {
  const input = parseEmailVerificationForm(formData);

  if (!validateEmail(input.email)) {
    return actionError("Use a valid email address.", {
      fieldErrors: { email: "Use a valid email address." },
    });
  }

  if (input.code.length !== 6) {
    return actionError("Enter the 6-digit verification code.", {
      fieldErrors: { code: "Enter the 6-digit verification code." },
    });
  }

  if (!input.otpToken) {
    return actionError("Request a new verification code before verifying this email.", {
      fieldErrors: { code: "Request a new verification code before verifying this email." },
    });
  }

  try {
    const response = await verifyEmail(input);

    return actionOk(
      {
        ...(await createVerifiedSessionPayload(response)),
      },
      "Email verified.",
    );
  } catch (error) {
    return toAuthActionError(error, "We could not verify that code.");
  }
}

export async function resendEmailVerificationAction(_previousState: unknown, formData: FormData) {
  const input = parseResendEmailVerificationForm(formData);

  if (!validateEmail(input.email)) {
    return actionError("Use a valid email address.", {
      fieldErrors: { email: "Use a valid email address." },
    });
  }

  try {
    const response = await resendEmailVerification(input);

    if (response.emailVerified) {
      return actionOk(response, "This email is already verified. Log in to continue.");
    }

    return actionOk(response, response.message ?? "If this account needs verification, a new code will be sent.");
  } catch (error) {
    return toAuthActionError(error, "We could not resend the verification code.");
  }
}

export async function refreshApplicationStatusAction() {
  const authContext = await getServerAuthContext();

  if (!authContext?.refreshToken) {
    return actionError("Your session expired. Sign in again to check your application status.");
  }

  try {
    const response = await refreshBackendAuth(authContext.refreshToken);

    if (!response?.user.emailVerified) {
      return actionError("Your session could not be refreshed. Sign in again to continue.");
    }

    const role = response.user.role ?? normalizeRole(authContext.role);
    const applicationStatus = await readProfileApplicationStatus(role, response.accessToken ?? authContext.accessToken);
    const sessionResponse: BackendAuthResponse = {
      ...response,
      user: {
        ...response.user,
        applicationStatus,
        role,
      },
    };

    return actionOk(
      {
        applicationStatus,
        role,
        ticket: createVerifiedEmailSessionTicket(sessionResponse),
      },
      applicationStatus === "approved"
        ? "Your account is approved. Opening your workspace."
        : "Your application status is up to date.",
    );
  } catch (error) {
    return toAuthActionError(error, "We could not refresh your application status.");
  }
}

export async function signInWithGoogleAction() {
  await signIn("google", { redirectTo: "/post-auth" });
}

export async function signInWithMicrosoftAction() {
  await signIn("microsoft-entra-id", { redirectTo: "/post-auth" });
}
