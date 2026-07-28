import { SignupRouteClient } from "@/components/organisms/SignupRouteClient";
import { resolveAuthErrorMessage } from "@/features/auth/error-messages";
import { getSocialAuthAvailability } from "@/features/auth/social-auth";
import { noIndexMetadata } from "@/lib/seo";
import type { SearchParamsPageProps } from "@/types/route";

export const metadata = noIndexMetadata("Sign up", "Create a SupplyED account.");

export default async function SignupPage({ searchParams }: SearchParamsPageProps) {
  return (
    <SignupRouteClient
      initialError={resolveAuthErrorMessage((await searchParams) ?? {})}
      socialAuth={getSocialAuthAvailability()}
    />
  );
}
