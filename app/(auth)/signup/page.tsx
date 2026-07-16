import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { SignupRouteClient } from "@/components/organisms/SignupRouteClient";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata("Sign up", "Create a SupplyED account.");

export default async function SignupPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/post-auth");
  }

  return <SignupRouteClient />;
}
