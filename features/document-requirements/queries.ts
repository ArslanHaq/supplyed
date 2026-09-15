import "server-only";

import { api } from "@/lib/server/api-client";

import { normalizeApplicationDocumentRequirements } from "./schemas";
import type { ApplicationDocumentRequirement } from "./types";

export async function listApplicationDocumentRequirements(): Promise<ApplicationDocumentRequirement[]> {
  const response = await api.get<unknown>("/document-requirements/application", {
    next: { tags: ["document-requirements:application"] },
  });

  return normalizeApplicationDocumentRequirements(response);
}
