import "server-only";

import { api } from "@/lib/server/api-client";
import type { ProfileCompletion } from "./types";

export function getMyProfileCompletion(): Promise<ProfileCompletion> {
  return api.get<ProfileCompletion>("/profile-completion/me", {
    cache: "no-store",
  });
}
