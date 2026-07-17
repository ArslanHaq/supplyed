import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { SignupRouteClient } from "@/components/organisms/SignupRouteClient";
import { resolveAuthErrorMessage } from "@/features/auth/error-messages";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata("Sign up", "Create a SupplyED account.");

type SignupPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function hasEnvValue(key: string) {
  return Boolean(process.env[key]?.trim());
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const session = await auth();

  if (session?.user) {
    redirect("/post-auth");
  }

  return (
    <SignupRouteClient
      initialError={resolveAuthErrorMessage((await searchParams) ?? {})}
      socialAuth={{
        google: hasEnvValue("AUTH_GOOGLE_ID") && hasEnvValue("AUTH_GOOGLE_SECRET"),
        microsoft: hasEnvValue("AUTH_MICROSOFT_ENTRA_ID_ID") && hasEnvValue("AUTH_MICROSOFT_ENTRA_ID_SECRET"),
      }}
    />
  );
}
