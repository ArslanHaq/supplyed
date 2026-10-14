import { listTeacherDirectory } from "@/features/teachers/queries";
import type { TeacherDirectoryFilters } from "@/features/teachers/types";
import { routeError } from "@/lib/server/route-error";
import { validateUkCity } from "@/lib/uk-validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const fieldErrors: Record<string, string> = {};
    const city = validateUkCity(params.get("city"));
    if (!city.valid) fieldErrors.city = city.error!;
    for (const key of ["limit", "page", "maxDailyRate", "maxHourlyRate", "minExperience", "minRating"]) {
      const raw = params.get(key);
      if (raw === null || raw === "") continue;
      const value = Number(raw);
      if (!raw.trim() || !Number.isFinite(value) || value < 0 || (["limit", "page", "minExperience"].includes(key) && !Number.isInteger(value)) || (["limit", "page"].includes(key) && value < 1) || (key === "limit" && value > 100) || (key === "minRating" && value > 5) || (key === "minExperience" && value > 100)) fieldErrors[key] = "Enter a valid filter value.";
    }
    for (const key of ["availableToday", "dbsVerified", "qtsQualified"]) if (params.has(key) && !["true", "false"].includes(params.get(key)!)) fieldErrors[key] = "Choose a valid filter.";
    for (const key of ["search", "keyStage", "subject", "skill"]) if ((params.get(key)?.length ?? 0) > 100) fieldErrors[key] = "Use 100 characters or fewer.";
    if (Object.keys(fieldErrors).length) return Response.json({ message: "Check your search filters.", fieldErrors }, { status: 400 });
    const filters: TeacherDirectoryFilters = {
      availableToday: readBoolean(params.get("availableToday")),
      city: city.value || undefined,
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
