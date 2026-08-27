import Link from "next/link";

import { Logo } from "../atoms";
import { PublicHeaderAccountSlot } from "./PublicHeaderAccountSlot";

type PublicHeaderProps = {
  active?: "founding-schools" | "founding-teachers" | "home" | "pricing" | "how-it-works";
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
        <Link className={`app-nav-link ${active === "founding-schools" ? "active" : ""}`} href="/founding-schools">For Schools</Link>
        <Link className={`app-nav-link ${active === "founding-teachers" ? "active" : ""}`} href="/founding-teachers">For Teachers</Link>
        <Link className="app-nav-link" href="/signup">Hire Talent</Link>
        {navItems.map((item) => (
          <Link key={item.id} className={`app-nav-link ${active === item.id ? "active" : ""}`} href={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
        <PublicHeaderAccountSlot />
      </div>
    </header>
  );
}
