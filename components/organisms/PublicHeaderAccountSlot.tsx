"use client";

import Link from "next/link";
import { getSession } from "next-auth/react";
import { useEffect, useState } from "react";

import { buttonClassName } from "../atoms";
import { PublicAccountMenu } from "../molecules/PublicAccountMenu";

type PublicHeaderAccount = {
  email?: string | null;
  name?: string | null;
  role?: string | null;
};

export function PublicHeaderAccountSlot() {
  const [account, setAccount] = useState<PublicHeaderAccount | null>(null);

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
    return <PublicAccountMenu email={account.email} name={account.name} role={account.role} />;
  }

  return (
    <>
      <Link className={buttonClassName({ variant: "ghost", className: "h-10 rounded-full px-4 text-sm sm:h-11 sm:px-5 sm:text-[15px]" })} href="/login">
        Log in
      </Link>
      <Link className={buttonClassName({ className: "h-10 rounded-full px-5 text-sm text-white! sm:h-11 sm:px-6 sm:text-[15px]" })} href="/signup">
        Get started
      </Link>
    </>
  );
}
