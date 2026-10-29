"use server";
import { getOAuthChallenge } from "@/lib/server/oauth-challenge";
import { verifyTwoFactorLoginAction } from "@/features/auth/actions";
export async function verifyOAuthCode(code: string) {
  const challenge = await getOAuthChallenge();
  const form = new FormData();
  form.set("code", code);
  if (challenge) form.set("twoFactorToken", challenge.token);
  return verifyTwoFactorLoginAction(null, form);
}
