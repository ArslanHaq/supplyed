import type { ReactNode } from "react";

import { QueryProvider } from "@/lib/query/query-client";

export default function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <QueryProvider>{children}</QueryProvider>;
}
