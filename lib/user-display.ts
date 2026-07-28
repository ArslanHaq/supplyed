export function getDisplayName(name?: string | null, email?: string | null, fallback = "SupplyED account") {
  const normalizedName = name?.trim();
  if (normalizedName) return normalizedName;

  const emailName = email?.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  return emailName || fallback;
}

export function getFirstName(name?: string | null, email?: string | null, fallback = "there") {
  return getDisplayName(name, email, fallback).split(/\s+/)[0] || fallback;
}
