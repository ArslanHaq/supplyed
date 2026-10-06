import Link from "next/link";

import { QueryProvider } from "@/lib/query/query-client";

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
    <header className="flex min-h-[80px] flex-wrap items-center gap-x-4 gap-y-3 border-b border-border bg-white px-4 py-4 sm:px-6 lg:px-12">
      <Logo href="/" size={24} />

      <nav aria-label="Public navigation" className="order-3 flex w-full items-center gap-1 overflow-x-auto pb-1 xl:order-none xl:ml-6 xl:w-auto xl:pb-0">
        <Link aria-current={active === "founding-schools" ? "page" : undefined} className={`app-nav-link ${active === "founding-schools" ? "active" : ""}`} href="/founding-schools">For Schools</Link>
        <Link aria-current={active === "founding-teachers" ? "page" : undefined} className={`app-nav-link ${active === "founding-teachers" ? "active" : ""}`} href="/founding-teachers">For Teachers</Link>
        <Link className="app-nav-link" href="/signup">Hire Talent</Link>
        {navItems.map((item) => (
          <Link key={item.id} aria-current={active === item.id ? "page" : undefined} className={`app-nav-link ${active === item.id ? "active" : ""}`} href={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
        <QueryProvider><PublicHeaderAccountSlot /></QueryProvider>
      </div>
    </header>
  );
}
