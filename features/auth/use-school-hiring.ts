"use client";

import { useEffect, useState } from "react";
import { useWorkspaceAccount } from "./workspace-account";

export function reportSchoolInactive(result: unknown) {
  if (typeof window !== "undefined" && result && typeof result === "object" && "code" in result && result.code === "SCHOOL_INACTIVE") {
    window.dispatchEvent(new Event("supplyed:school-inactive"));
  }
}

export function useSchoolHiringAllowed() {
  const account = useWorkspaceAccount();
  const [inactive, setInactive] = useState(false);
  useEffect(() => {
    const block = () => setInactive(true);
    window.addEventListener("supplyed:school-inactive", block);
    return () => window.removeEventListener("supplyed:school-inactive", block);
  }, []);
  return account.role !== "institution" || (account.applicationStatus === "approved" && !inactive);
}
