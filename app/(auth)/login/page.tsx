import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LoginRouteClient } from "@/components/organisms/LoginRouteClient";
import { resolveAuthErrorMessage } from "@/features/auth/error-messages";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata("Log in", "Log in to your SupplyED account.");

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function hasEnvValue(key: string) {
  return Boolean(process.env[key]?.trim());
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();

  if (session?.user) {
    redirect("/post-auth");
  }

  return (
    <LoginRouteClient
      initialError={resolveAuthErrorMessage((await searchParams) ?? {})}
      socialAuth={{
        google: hasEnvValue("AUTH_GOOGLE_ID") && hasEnvValue("AUTH_GOOGLE_SECRET"),
        microsoft: hasEnvValue("AUTH_MICROSOFT_ENTRA_ID_ID") && hasEnvValue("AUTH_MICROSOFT_ENTRA_ID_SECRET"),
      }}
    />
  );
}
