import { Suspense } from "react";

import { AppRouteShellClient } from "./organisms/RouteShell";
import type { AppPage } from "@/types/supplyed";

export function AppRouteShell(props: { page: AppPage }) {
  return (
    <Suspense fallback={null}>
      <AppRouteShellClient {...props} />
    </Suspense>
  );
}
