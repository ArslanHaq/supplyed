import { ForgotPasswordRouteClient } from "@/components/organisms/ForgotPasswordRouteClient";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata("Forgot Password", "Reset your SupplyED account password.");

export default function ForgotPasswordPage() {
  return <ForgotPasswordRouteClient />;
}
