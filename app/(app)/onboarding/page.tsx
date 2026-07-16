import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { OnboardingRouteClient } from "@/components/organisms/OnboardingRouteClient";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata("Onboarding", "Complete your SupplyED account setup.");

export default async function OnboardingPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return <OnboardingRouteClient accountEmail={session.user.email ?? ""} />;
}
