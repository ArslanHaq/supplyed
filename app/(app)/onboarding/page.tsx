import { OnboardingRouteClient } from "@/components/organisms/OnboardingRouteClient";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata("Onboarding", "Complete your SupplyED account setup.");

export default function OnboardingPage() {
  return <OnboardingRouteClient />;
}
