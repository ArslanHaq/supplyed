import Link from "next/link";

import { QueryProvider } from "@/lib/query/query-client";

import { Icon, Logo, buttonClassName } from "../atoms";
import { PublicHeaderAccountSlot } from "./PublicHeaderAccountSlot";

type PublicHeaderProps = {
  active?: "founding-schools" | "founding-teachers" | "home" | "how-it-works";
};

const navItems = [
  { id: "founding-schools", label: "For schools", href: "/founding-schools" },
  {
    id: "founding-teachers",
    label: "For teachers",
    href: "/founding-teachers",
  },
  {
    id: "how-it-works",
    label: "How it works",
    href: "/#waitlist-how-it-works",
  },
  { id: "faq", label: "FAQ", href: "/#faq" },
] as const;

export function PublicHeader({ active = "home" }: PublicHeaderProps) {
  const waitlistHref =
    active === "founding-schools"
      ? "#school-registration"
      : active === "founding-teachers"
        ? "#teacher-registration"
        : "/#register-interest";
  return (
    <header className="marketing-header">
      <div className="marketing-header-inner">
        <Logo href="/" size={25} />

        <nav aria-label="Public navigation" className="marketing-nav">
          {navItems.map((item) => (
            <Link
              key={item.id}
              aria-current={active === item.id ? "page" : undefined}
              className={`app-nav-link ${active === item.id ? "active" : ""}`}
              href={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="marketing-account">
          <Link
            className={buttonClassName({
              size: "sm",
              className: "marketing-nav-waitlist",
            })}
            href={waitlistHref}
          >
            Join the waitlist
          </Link>
          <QueryProvider>
            <PublicHeaderAccountSlot />
          </QueryProvider>
        </div>
        <details className="marketing-mobile-nav">
          <summary aria-label="Navigation menu">
            <Icon name="list" size={21} />
          </summary>
          <nav aria-label="Mobile public navigation">
            {navItems.map((item) => (
              <Link
                aria-current={active === item.id ? "page" : undefined}
                href={item.href}
                key={item.id}
              >
                {item.label}
                <Icon name="arrow" size={15} />
              </Link>
            ))}
            <Link href={waitlistHref}>
              Join the waitlist
              <Icon name="arrow" size={15} />
            </Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
