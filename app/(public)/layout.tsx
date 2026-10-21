import type { ReactNode } from "react";
import { MetaPixel } from "@/components/molecules/MetaPixel";
import { PublicFooter } from "@/components/organisms/PublicFooter";

export default function PublicLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="public-page">{children}<PublicFooter /><MetaPixel /></div>;
}
