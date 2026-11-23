import type { SocialAuthAvailability } from "@/types/supplyed";

function hasEnvValue(key: string) {
  return Boolean(process.env[key]?.trim());
}

export function getSocialAuthAvailability(): SocialAuthAvailability {
  return {
    google: hasEnvValue("GOOGLE_CLIENT_ID") && hasEnvValue("GOOGLE_CLIENT_SECRET"),
    microsoft: hasEnvValue("AUTH_MICROSOFT_ENTRA_ID_ID") && hasEnvValue("AUTH_MICROSOFT_ENTRA_ID_SECRET"),
  };
}
