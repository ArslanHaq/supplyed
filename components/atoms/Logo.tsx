import Link from "next/link";

import { cn } from "@/lib/cn";

export function Logo({
  size = 18,
  onClick,
  className,
  href,
}: {
  size?: number;
  onClick?: () => void;
  className?: string;
  href?: string;
}) {
  const classes = cn("select-none whitespace-nowrap border-0 bg-transparent font-light leading-none text-[var(--ink)]", href || onClick ? "cursor-pointer" : null, className);
  const content = <>Supply<span className="font-bold text-[var(--se)]">ED</span></>;

  if (href) {
    return (
      <Link
        className={classes}
        href={href}
        style={{ fontSize: size }}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      className={classes}
      onClick={onClick}
      style={{ fontSize: size, cursor: onClick ? "pointer" : "default" }}
      type="button"
    >
      {content}
    </button>
  );
}
