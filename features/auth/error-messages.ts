const authErrorMessages: Record<string, string> = {
  AccessDenied: "Access was denied by the identity provider.",
  CallbackRouteError: "The identity provider callback failed. Check the account details and try again.",
  Configuration: "The sign-in provider is not configured correctly. Check the OAuth client and redirect URL.",
  CredentialsSignin: "Sign in failed. Check the details you provided and try again.",
  OAuthCallbackError: "The identity provider rejected the callback. Try signing in again.",
  Verification: "The verification link or code is invalid or expired.",
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function sanitizeAuthErrorMessage(message: string | undefined, fallback = "Authentication failed. Try again.") {
  const normalized = message?.replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;
  if (/AUTH_BACKEND_OAUTH_ENABLED|Backend OAuth exchange is disabled/i.test(normalized)) {
    return "Social sign-in is not available yet. Use email and password while we finish connecting Google sign-in.";
  }
  if (/Microsoft sign-in is not connected/i.test(normalized)) {
    return "Microsoft sign-in is not available yet. Use email and password, or continue with Google when it is enabled.";
  }
  return normalized.length > 240 ? `${normalized.slice(0, 237)}...` : normalized;
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
