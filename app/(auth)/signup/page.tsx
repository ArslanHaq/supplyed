import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { SignupRouteClient } from "@/components/organisms/SignupRouteClient";
import { resolveAuthErrorMessage } from "@/features/auth/error-messages";
import { getSocialAuthAvailability } from "@/features/auth/social-auth";
import { noIndexMetadata } from "@/lib/seo";
import type { SearchParamsPageProps } from "@/types/route";

export const metadata = noIndexMetadata("Sign up", "Create a SupplyED account.");

export default async function SignupPage({ searchParams }: SearchParamsPageProps) {
  const session = await auth();

  if (session?.user) {
    redirect("/post-auth");
  }

  return (
    <SignupRouteClient
      initialError={resolveAuthErrorMessage((await searchParams) ?? {})}
      socialAuth={getSocialAuthAvailability()}
    />
  );
}
