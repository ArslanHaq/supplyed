import type { ReactNode } from "react";
import { PublicThemeControls } from "@/components/molecules/PublicThemeControls";
import { PublicFooter } from "@/components/organisms/PublicFooter";

export default function PublicLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="public-page">
      {children}
      <PublicFooter />
      <PublicThemeControls />
    </div>
  );
}
