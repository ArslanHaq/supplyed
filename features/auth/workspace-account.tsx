"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { AppRole, ApplicationStatus } from "@/types/supplyed";

type WorkspaceAccount = { id: string; role: AppRole; applicationStatus: ApplicationStatus };
const WorkspaceAccountContext = createContext<WorkspaceAccount | null>(null);

/** The same authenticated account and live profile status used by the workspace shell. */
export function WorkspaceAccountProvider({ value, children }: { value: WorkspaceAccount; children: ReactNode }) {
  return <WorkspaceAccountContext.Provider value={value}>{children}</WorkspaceAccountContext.Provider>;
}

export function useWorkspaceAccount() {
  const account = useContext(WorkspaceAccountContext);
  if (!account) throw new Error("Workspace account controls must be rendered inside the authenticated workspace.");
  return account;
}
