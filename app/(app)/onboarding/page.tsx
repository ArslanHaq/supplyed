import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { OnboardingRouteClient } from "@/components/organisms/OnboardingRouteClient";
import { getOnboardingProfileSnapshot } from "@/features/onboarding/actions";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata("Onboarding", "Complete your SupplyED account setup.");

export default async function OnboardingPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const snapshot = await getOnboardingProfileSnapshot();

  return (
    <OnboardingRouteClient
      accountEmail={session.user.email ?? ""}
      initialApplicationStatus={session.user.applicationStatus}
      initialProfileSnapshot={snapshot}
      initialRole={session.user.role}
    />
  );
}
