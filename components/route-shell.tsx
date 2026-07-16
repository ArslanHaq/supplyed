import { Suspense } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppRouteShellClient } from "./organisms/RouteShell";
import type { AppPage } from "@/types/supplyed";

export async function AppRouteShell(props: { page: AppPage }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!session.user.isEmailVerified) {
    redirect("/post-auth");
  }

  const setupComplete =
    session.user.role === "admin" ||
    Boolean(session.user.role && session.user.applicationStatus !== "none");

  if (!setupComplete) {
    redirect("/onboarding");
  }

  return (
    <Suspense fallback={null}>
      <AppRouteShellClient {...props} />
    </Suspense>
  );
}
