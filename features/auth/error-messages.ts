const authErrorMessages: Record<string, string> = {
  AccessDenied: "Access was denied by the identity provider.",
  CallbackRouteError: "The identity provider callback failed. Check the account details and try again.",
  Configuration: "The sign-in provider is not configured correctly. Check the OAuth client and redirect URL.",
  CredentialsSignin: "Sign in failed. Check the details you provided and try again.",
  OAuthAccountNotLinked: "That email already has a SupplyED password account. Log in with your email and password instead.",
  OAuthCallbackError: "The identity provider rejected the callback. Try signing in again.",
  Verification: "The verification link or code is invalid or expired.",
};

const emailPasswordSocialConflictMessage =
  "That email already has a SupplyED password account. Log in with your email and password instead.";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isEmailPasswordSocialConflict(message: string) {
  return (
    /oauthaccountnotlinked/i.test(message) ||
    /email .*already (registered|exists|in use|used)/i.test(message) ||
    /already (registered|exists|in use|used).*email/i.test(message) ||
    /account .*already (registered|exists|in use|used)/i.test(message) ||
    /already .*account/i.test(message) ||
    /different (provider|login|sign-in|sign in|auth)/i.test(message) ||
    /another (provider|login|sign-in|sign in|auth)/i.test(message) ||
    /password account|credentials account|email\/password account/i.test(message)
  );
}

export function sanitizeAuthErrorMessage(message: string | undefined, fallback = "Authentication failed. Try again.") {
  const normalized = message?.replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;
  if (/AUTH_BACKEND_OAUTH_ENABLED|Backend OAuth exchange is disabled/i.test(normalized)) {
    return "Social sign-in is not available yet. Use email and password while we finish connecting Google sign-in.";
  }
  if (/Google sign-in is not configured|provider.*google.*not configured/i.test(normalized)) {
    return "Google sign-in is not configured. Add AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET, then restart the app.";
  }
  if (/Microsoft sign-in is not connected/i.test(normalized)) {
    return "Microsoft sign-in is not available yet. Use email and password, or continue with Google when it is enabled.";
  }
  if (/Microsoft sign-in is not configured|provider.*microsoft.*not configured/i.test(normalized)) {
    return "Microsoft sign-in is not configured. Add AUTH_MICROSOFT_ENTRA_ID_ID and AUTH_MICROSOFT_ENTRA_ID_SECRET, then restart the app.";
  }
  return normalized.length > 240 ? `${normalized.slice(0, 237)}...` : normalized;
}

export function sanitizeSocialAuthErrorMessage(message: string | undefined, fallback = "Social sign-in failed. Try again.") {
  const normalized = message?.replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;
  if (isEmailPasswordSocialConflict(normalized)) return emailPasswordSocialConflictMessage;
  return sanitizeAuthErrorMessage(normalized, fallback);
}

export function resolveAuthErrorMessage(searchParams: Record<string, string | string[] | undefined>) {
  const explicitMessage = firstParam(searchParams.auth_error);
  if (explicitMessage) return sanitizeAuthErrorMessage(explicitMessage);

  const error = firstParam(searchParams.error);
  if (!error) return undefined;

  const message = authErrorMessages[error] ?? `Authentication failed: ${error}`;
  const code = firstParam(searchParams.code);

  return code ? `${message} Code: ${code}.` : message;
}

export function readUnknownAuthErrorMessage(error: unknown, fallback = "Authentication failed. Try again.") {
  if (error instanceof Error) return sanitizeAuthErrorMessage(error.message, fallback);
  if (typeof error === "string") return sanitizeAuthErrorMessage(error, fallback);
  return fallback;
}

export function readUnknownSocialAuthErrorMessage(error: unknown, fallback = "Social sign-in failed. Try again.") {
  if (error instanceof Error) return sanitizeSocialAuthErrorMessage(error.message, fallback);
  if (typeof error === "string") return sanitizeSocialAuthErrorMessage(error, fallback);
  return fallback;
}
