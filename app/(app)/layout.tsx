import "@/components/styles/foundation.css";
import "@/components/styles/account.css";
import "@/components/styles/selectors.css";
import "@/components/styles/workspace.css";
import "@/components/styles/teacher-dashboard.css";
import "@/components/styles/editor.css";
import "@/components/styles/proposal.css";
import "@/components/styles/proposal-preview.css";
import "leaflet/dist/leaflet.css";

import type { ReactNode } from "react";

import { QueryProvider } from "@/lib/query/query-client";

export default function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <QueryProvider>{children}</QueryProvider>;
}
