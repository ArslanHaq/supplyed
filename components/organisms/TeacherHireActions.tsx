"use client";

import { useState } from "react";
import { useWorkspaceAccount } from "@/features/auth/workspace-account";
import { useStartConversation } from "@/features/conversations/use-conversations";
import type { GoFn } from "@/types/supplyed";
import { Btn } from "../atoms";
import { InvitationModal, type HireTeacher } from "./InvitationModal";

export function TeacherHireActions({ teacher, go, jobId, hideMessage = false }: { teacher: HireTeacher; go: GoFn; jobId?: string; hideMessage?: boolean }) {
  const [hireOpen, setHireOpen] = useState(false);
  const account = useWorkspaceAccount();
  const message = useStartConversation();
  if (account.role !== "institution") return null;
  // Do not hide school actions behind a second account request. The workspace
  // already resolved this account and its approval; the API authorizes mutations.
  const blocked = account.applicationStatus !== "approved";
  const disabled = blocked;
  return <div className="teacher-hire-actions mt-3 text-left">
    <div className="flex flex-wrap gap-2">
      <Btn disabled={disabled} icon="send" size="sm" onClick={() => setHireOpen(true)}>Invite to job</Btn>
      {!hideMessage ? <Btn disabled={disabled} icon="message" loading={message.isPending} loadingLabel="Opening" size="sm" variant="secondary" onClick={() => message.mutate({ instructorId: teacher.id }, { onSuccess: conversation => go("messaging", { conversationId: conversation.id }) })}>Message</Btn> : null}
    </div>
    {blocked ? <p className="mt-2 text-xs text-muted">Available when your school account is approved.</p> : null}
    {message.error ? <p className="mt-2 text-xs text-danger" role="alert">{message.error.message}</p> : null}
    {hireOpen ? <InvitationModal accountId={account.id} go={go} initialJobId={jobId} onClose={() => setHireOpen(false)} teacher={teacher} /> : null}
  </div>;
}
