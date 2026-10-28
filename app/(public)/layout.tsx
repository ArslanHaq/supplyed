import type { ReactNode } from "react";
import { PublicThemeControls } from "@/components/molecules/PublicThemeControls";
import { PublicFooter } from "@/components/organisms/PublicFooter";
import { QueryProvider } from "@/lib/query/query-client";

export default function PublicLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <QueryProvider>
      <div className="public-page">
        {children}
        <PublicFooter />
        <PublicThemeControls />
      </div>
    </QueryProvider>
  );
}
