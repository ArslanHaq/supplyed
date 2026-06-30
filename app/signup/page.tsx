import { SignupRouteClient } from "@/components/organisms/SignupRouteClient";
import { noIndexMetadata } from "@/lib/seo";
import type { AppRole } from "@/types/supplyed";

export const metadata = noIndexMetadata("Sign up", "Create a SupplyED account for schools or teachers.");

type SignupRole = Extract<AppRole, "institution" | "teacher">;

type SignupPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function toSignupRole(value: string | string[] | undefined): SignupRole | undefined {
  const role = Array.isArray(value) ? value[0] : value;
  return role === "teacher" || role === "institution" ? role : undefined;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;
  return <SignupRouteClient initialRole={toSignupRole(params?.role)} />;
}
