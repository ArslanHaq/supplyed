import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LoginRouteClient } from "@/components/organisms/LoginRouteClient";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata("Log in", "Log in to your SupplyED account.");

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/post-auth");
  }

  return <LoginRouteClient />;
}
