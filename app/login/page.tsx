import { LoginRouteClient } from "@/components/organisms/LoginRouteClient";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata("Log in", "Log in to your SupplyED account.");

export default function LoginPage() {
  return <LoginRouteClient />;
}
