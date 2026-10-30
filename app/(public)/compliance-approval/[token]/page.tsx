import type { Metadata } from "next";

import { ComplianceApprovalPage } from "@/components/organisms/ComplianceApprovalPage";

export const metadata: Metadata = {
  description: "Review a SupplyED single-school compliance approval request.",
  referrer: "no-referrer",
  robots: { follow: false, index: false },
  title: "School compliance approval | SupplyED",
};

export default async function ComplianceApprovalRoute({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ComplianceApprovalPage token={token} />;
}
