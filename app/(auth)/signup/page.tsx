import { SignupRouteClient } from "@/components/organisms/SignupRouteClient";
import { resolveAuthErrorMessage } from "@/features/auth/error-messages";
import { readFoundingSignupEmail, readFoundingSignupType } from "@/lib/founding-signup-intent";
import { getSocialAuthAvailability } from "@/features/auth/social-auth";
import { noIndexMetadata } from "@/lib/seo";
import type { SearchParamsPageProps } from "@/types/route";

export const metadata = noIndexMetadata("Sign up", "Create a SupplyED account.");

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignupPage({ searchParams }: SearchParamsPageProps) {
  const params = (await searchParams) ?? {};
  const foundingSignupType =
    readParam(params.source) === "founding" ? readFoundingSignupType(readParam(params.type)) : undefined;
  const foundingSignupEmail = foundingSignupType ? readFoundingSignupEmail(readParam(params.email)) : undefined;

  return (
    <SignupRouteClient
      foundingSignupEmail={foundingSignupEmail}
      foundingSignupType={foundingSignupType}
      initialError={resolveAuthErrorMessage(params)}
      socialAuth={getSocialAuthAvailability()}
    />
  );
}
