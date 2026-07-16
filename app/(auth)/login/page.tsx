import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LoginRouteClient } from "@/components/organisms/LoginRouteClient";
import { resolveAuthErrorMessage } from "@/features/auth/error-messages";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata("Log in", "Log in to your SupplyED account.");

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();

  if (session?.user) {
    redirect("/post-auth");
  }

  return <LoginRouteClient initialError={resolveAuthErrorMessage((await searchParams) ?? {})} />;
}
