import Link from "next/link";

import { buttonClassName, Logo } from "../atoms";

type PublicHeaderProps = {
  active?: "home" | "pricing" | "how-it-works";
};

const navItems = [
  { id: "how-it-works", label: "How it works", href: "/how-it-works" },
  { id: "pricing", label: "Pricing", href: "/pricing" },
] as const;

export function PublicHeader({ active = "home" }: PublicHeaderProps) {
  return (
    <header className="flex min-h-[76px] items-center gap-4 border-b border-border bg-white px-4 py-3 sm:px-6 lg:px-12">
      <Logo href="/" size={20} />

      <nav aria-label="Public navigation" className="ml-0 hidden items-center gap-2 md:flex lg:ml-8">
        <Link className="app-nav-link" href="/signup">For Schools</Link>
        <Link className="app-nav-link" href="/signup">For Teachers</Link>
        <Link className="app-nav-link" href="/signup">Hire Talent</Link>
        {navItems.map((item) => (
          <Link key={item.id} className={`app-nav-link ${active === item.id ? "active" : ""}`} href={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
        <Link className={buttonClassName({ variant: "ghost", className: "h-10 rounded-full px-4 text-sm sm:h-11 sm:px-5 sm:text-[15px]" })} href="/login">
          Log in
        </Link>
        <Link className={buttonClassName({ className: "h-10 rounded-full px-5 text-sm text-white! sm:h-11 sm:px-6 sm:text-[15px]" })} href="/signup">
          Get started
        </Link>
      </div>
    </header>
  );
}
