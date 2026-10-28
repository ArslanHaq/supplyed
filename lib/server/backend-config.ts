import "server-only";

/** Development fixtures must never become the production authentication backend. */
export function backendEnabled() {
  const value = process.env.API_BASE_URL?.trim();
  if (!value) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("The backend is not configured. Please try again later.");
    }
    return false;
  }
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("The backend URL must use HTTP or HTTPS.");
  }
  return true;
}
