import { getTeacher } from "@/features/teachers/queries";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const teacher = await getTeacher(id);

    if (!teacher) {
      return Response.json({ message: "Teacher not found." }, { status: 404 });
    }

    return Response.json(teacher);
  } catch (error) {
    return routeError(error);
  }
}
