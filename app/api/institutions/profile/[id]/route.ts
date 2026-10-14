import { getInstitutionPublicProfile } from "@/features/public-profiles/queries";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const profile = await getInstitutionPublicProfile(id);
    return profile
      ? Response.json(profile)
      : Response.json({ message: "School profile not found." }, { status: 404 });
  } catch (error) {
    return routeError(error);
  }
}
