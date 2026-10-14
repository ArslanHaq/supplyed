import { AppRouteShell } from "@/components/route-shell";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata("Settings");

export default function SettingsRoutePage() {
  return <AppRouteShell page="settings" />;
}
