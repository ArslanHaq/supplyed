import type { ReactNode } from "react";

export default function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  // Clarity can keep recording after a visitor moves here from a public page; mask sign-in details.
  return (
    <div className="contents" data-clarity-mask="True">
      {children}
    </div>
  );
}
