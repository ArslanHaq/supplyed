import Link from "next/link";

import { auth } from "@/auth";

import { buttonClassName, Logo } from "../atoms";
import { PublicAccountMenu } from "../molecules/PublicAccountMenu";

type PublicHeaderProps = {
  active?: "home" | "pricing" | "how-it-works";
  user?: {
    email?: string | null;
    name?: string | null;
    role?: string | null;
  } | null;
};

const navItems = [
  { id: "how-it-works", label: "How it works", href: "/how-it-works" },
  { id: "pricing", label: "Pricing", href: "/pricing" },
] as const;

export async function PublicHeader({ active = "home", user }: PublicHeaderProps) {
  const session = user === undefined ? await auth() : null;
  const account = user === undefined ? session?.user : user;
  const signedIn = Boolean(account);
  const appHref = "/post-auth";
  const signupHref = signedIn ? appHref : "/signup";

  return (
    <header className="flex min-h-[76px] items-center gap-4 border-b border-border bg-white px-4 py-3 sm:px-6 lg:px-12">
      <Logo href="/" size={20} />

      <nav aria-label="Public navigation" className="ml-0 hidden items-center gap-2 md:flex lg:ml-8">
        <Link className="app-nav-link" href={signupHref}>For Schools</Link>
        <Link className="app-nav-link" href={signupHref}>For Teachers</Link>
        <Link className="app-nav-link" href={signupHref}>Hire Talent</Link>
        {navItems.map((item) => (
          <Link key={item.id} className={`app-nav-link ${active === item.id ? "active" : ""}`} href={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
        {signedIn ? (
          <PublicAccountMenu email={account?.email} name={account?.name} role={account?.role} />
        ) : (
          <>
            <Link className={buttonClassName({ variant: "ghost", className: "h-10 rounded-full px-4 text-sm sm:h-11 sm:px-5 sm:text-[15px]" })} href="/login">
              Log in
            </Link>
            <Link className={buttonClassName({ className: "h-10 rounded-full px-5 text-sm text-white! sm:h-11 sm:px-6 sm:text-[15px]" })} href="/signup">
              Get started
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
