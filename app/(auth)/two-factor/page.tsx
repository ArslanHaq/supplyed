import { redirect } from "next/navigation";
import { getOAuthChallenge } from "@/lib/server/oauth-challenge";
import { OAuthTwoFactorClient } from "./client";
export default async function Page() {
  const challenge = await getOAuthChallenge();
  if (!challenge) redirect("/login");
  return <OAuthTwoFactorClient email={challenge.email} expiresAt={challenge.expiresAt} />;
}
