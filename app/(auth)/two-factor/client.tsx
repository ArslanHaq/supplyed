"use client";
import { signIn, signOut } from "next-auth/react";
import { TwoFactorChallengePage } from "@/components/organisms/TwoFactorChallengePage";
import { verifyOAuthCode } from "./actions";
export function OAuthTwoFactorClient({ email, expiresAt }: { email: string; expiresAt: number }) {
  return <TwoFactorChallengePage email={email} expiresAt={expiresAt}
    onBack={() => { void signOut({ callbackUrl: "/login" }); }} onLanding={() => { window.location.href = "/"; }}
    onVerified={async (code) => {
      try {
        const result = await verifyOAuthCode(code);
        if (!result.ok) return { ok: false, message: result.message };
        const login = await signIn("credentials", { flow: "verified-email-session", ticket: result.data.ticket, redirect: false });
        if (login?.error) return { ok: false, message: "Sign-in could not be completed. Please start again." };
        window.location.href = "/post-auth";
        return { ok: true };
      } catch { return { ok: false, message: "Verification could not be completed. Please try again." }; }
    }} />;
}
