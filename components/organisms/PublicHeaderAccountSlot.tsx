"use client";

import Link from "next/link";
import { getSession } from "next-auth/react";
import { useEffect, useState } from "react";

import { useOnboardingSnapshot } from "@/features/onboarding/use-onboarding";

import { buttonClassName } from "../atoms";
import { PublicAccountMenu } from "../molecules/PublicAccountMenu";

type PublicHeaderAccount = {
  email?: string | null;
  name?: string | null;
  role?: string | null;
};

export function PublicHeaderAccountSlot() {
  const [account, setAccount] = useState<PublicHeaderAccount | null>(null);
  const verification = useOnboardingSnapshot(account?.email ?? "", { enabled: Boolean(account?.email) });

  useEffect(() => {
    let mounted = true;

    getSession()
      .then((session) => {
        if (!mounted) return;
        const user = session?.user;
        setAccount(user ? { email: user.email, name: user.name, role: user.role } : null);
      })
      .catch(() => {
        if (mounted) setAccount(null);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (account) {
    return <PublicAccountMenu email={account.email} name={account.name} role={account.role} verified={verification.data?.verified === true} />;
  }

  return (
    <>
      <Link className={buttonClassName({ variant: "ghost", size: "sm", className: "max-sm:px-2 max-sm:text-[11px]" })} href="/login">
        Log in
      </Link>
      <Link className={buttonClassName({ size: "sm", className: "max-sm:px-2.5 max-sm:text-[11px]" })} href="/signup">
        Get started
      </Link>
    </>
  );
}
