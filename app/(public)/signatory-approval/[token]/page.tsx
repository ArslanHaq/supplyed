import type { Metadata } from "next";

import { SignatoryApprovalPage } from "@/components/organisms/SignatoryApprovalPage";

export const metadata: Metadata = {
  description: "Review a SupplyED multi-academy trust school approval request.",
  referrer: "no-referrer",
  robots: { follow: false, index: false },
  title: "Trust signatory approval | SupplyED",
};

export default async function SignatoryApprovalRoute({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SignatoryApprovalPage token={token} />;
}
