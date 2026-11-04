import { api } from "@/lib/server/api-client";
import { routeError } from "@/lib/server/route-error";
import { normalizeProfileDocuments } from "@/features/profile-documents/schemas";
import type { ProfileDocument } from "@/features/profile-documents/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(normalizeProfileDocuments(await api.get<ProfileDocument[]>("/profile-documents")));
  } catch (error) {
    return routeError(error);
  }
}
