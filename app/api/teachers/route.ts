import { listTeachers } from "@/features/teachers/queries";
import type { TeacherListFilters } from "@/features/teachers/types";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const filters: TeacherListFilters = {
      keyStage: searchParams.get("keyStage") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      subject: searchParams.get("subject") ?? undefined,
    };

    return Response.json(await listTeachers(filters));
  } catch (error) {
    return routeError(error);
  }
}
