import type { ReactNode } from "react";

import { QueryProvider } from "@/lib/query/query-client";

export default function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  // Clarity can keep recording after a visitor signs in from a public page; mask all account content.
  return (
    <div className="contents" data-clarity-mask="True">
      <QueryProvider>{children}</QueryProvider>
    </div>
  );
}
