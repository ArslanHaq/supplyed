import { listTeacherDirectory } from "@/features/teachers/queries";
import type { TeacherDirectoryFilters } from "@/features/teachers/types";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const filters: TeacherDirectoryFilters = {
      availableToday: readBoolean(params.get("availableToday")),
      city: params.get("city") ?? undefined,
      dbsVerified: readBoolean(params.get("dbsVerified")),
      keyStage: params.get("keyStage") ?? undefined,
      limit: readNumber(params.get("limit")),
      maxDailyRate: readNumber(params.get("maxDailyRate")),
      maxHourlyRate: readNumber(params.get("maxHourlyRate")),
      minExperience: readNumber(params.get("minExperience")),
      minRating: readNumber(params.get("minRating")),
      page: readNumber(params.get("page")),
      qtsQualified: readBoolean(params.get("qtsQualified")),
      search: params.get("search") ?? undefined,
      skill: params.get("skill") ?? undefined,
      subject: params.get("subject") ?? undefined,
    };

    return Response.json(await listTeacherDirectory(filters));
  } catch (error) {
    return routeError(error);
  }
}

function readBoolean(value: string | null) {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function readNumber(value: string | null) {
  if (value === null || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}
