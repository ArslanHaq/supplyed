import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LoginRouteClient } from "@/components/organisms/LoginRouteClient";
import { resolveAuthErrorMessage } from "@/features/auth/error-messages";
import { getSocialAuthAvailability } from "@/features/auth/social-auth";
import { noIndexMetadata } from "@/lib/seo";
import type { SearchParamsPageProps } from "@/types/route";

export const metadata = noIndexMetadata("Log in", "Log in to your SupplyED account.");

export default async function LoginPage({ searchParams }: SearchParamsPageProps) {
  const session = await auth();

  if (session?.user) {
    redirect("/post-auth");
  }

  return (
    <LoginRouteClient
      initialError={resolveAuthErrorMessage((await searchParams) ?? {})}
      socialAuth={getSocialAuthAvailability()}
    />
  );
}
