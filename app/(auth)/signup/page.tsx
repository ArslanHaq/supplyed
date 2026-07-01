import { SignupRouteClient } from "@/components/organisms/SignupRouteClient";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata("Sign up", "Create a SupplyED account.");

export default function SignupPage() {
  return <SignupRouteClient />;
}
