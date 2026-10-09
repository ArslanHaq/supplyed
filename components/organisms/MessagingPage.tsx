"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useApplication } from "@/features/applications/use-applications";
import type { JobApplication } from "@/features/applications/types";
import {
  ALLOWED_ATTACHMENT_TYPES,
  formatFileSize,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  MAX_MESSAGE_LENGTH,
} from "@/features/conversations/schemas";
import { emitTyping } from "@/features/conversations/socket";
import type { ChatMessage, Conversation, MessageAttachment } from "@/features/conversations/types";
import {
  flattenMessages,
  uploadAttachment,
  flattenConversations,
  useConversationForApplication,
  useConversations,
  useMarkConversationRead,
  useMessages,
  useSendMessage,
  useTypingIndicator,
} from "@/features/conversations/use-conversations";
import { useJob } from "@/features/jobs/use-jobs";
import type { Job } from "@/features/jobs/types";
import type { RouteProps, ToastFn } from "@/types/supplyed";

import { Avatar, Btn, Icon, Tag } from "../atoms";
import { Modal, PageHead, ProposalContent, SectionLoader } from "../molecules";
import { MessageAttachmentPreview } from "./MessageAttachmentPreview";

type PendingFile = {
  attachment?: MessageAttachment;
  error?: string;
  file: File;
  localId: string;
  status: "error" | "ready" | "uploading";
};

/**
 * Conversations between a school and a teacher, one per job application.
 * New messages, read receipts and typing notices arrive live over the shared
 * socket (see useConversationStream in AppChrome).
 */
export function MessagingPage({ ctx, go, role, toast }: Pick<RouteProps, "ctx" | "go" | "role" | "toast">) {
  const conversationsQuery = useConversations();
  const fromApplication = useConversationForApplication(ctx.applicationId);
  const { fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError } = conversationsQuery;
  // undefined follows a direct application link, null explicitly returns to the inbox.
  const [selection, setSelection] = useState<{ applicationId?: string; selectedId: string | null | undefined }>({ selectedId: undefined });
  const selectedId = selection.applicationId === ctx.applicationId ? selection.selectedId : undefined;

  // A thread opened from an application may not be in the list yet.
  const conversations = useMemo(() => {
    const list = flattenConversations(conversationsQuery.data);
    const opened = fromApplication.data;
    return opened && !list.some((item) => item.id === opened.id) ? [opened, ...list] : list;
  }, [conversationsQuery.data, fromApplication.data]);

  // Fill the inbox without making the user page through older conversations.
  useEffect(() => {
    if (
      hasNextPage &&
      !isFetchingNextPage &&
      !isFetchNextPageError
    ) {
      void fetchNextPage();
    }
  }, [
    fetchNextPage,
    hasNextPage,
    isFetchNextPageError,
    isFetchingNextPage,
  ]);

  const activeId = selectedId === undefined ? fromApplication.data?.id ?? null : selectedId;
  const active = conversations.find((item) => item.id === activeId) ?? null;
  const applicationQuery = useApplication(active?.applicationId);
  const jobQuery = useJob(active?.job.id ?? "", role === "institution");
  const total = Math.max(conversationsQuery.data?.pages[0]?.pagination.total ?? 0, conversations.length);
  const unread = conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0);

  function returnToInbox() {
    setSelection({ applicationId: ctx.applicationId, selectedId: null });
  }

  return (
    <div className="app-page messaging-page">
      <PageHead
        title="Messages"
        subtitle={
          role === "teacher"
            ? "Talk to schools about your applications and bookings."
            : "Talk to teachers about their applications and bookings."
        }
      />

      {conversationsQuery.isLoading || fromApplication.isLoading ? <SectionLoader rows={4} /> : null}
      {fromApplication.error ? (
        <p className="mb-4 rounded-lg bg-danger-tint px-4 py-3 text-sm text-danger">{fromApplication.error.message}</p>
      ) : null}

      {!conversationsQuery.isLoading && !fromApplication.isLoading && conversations.length === 0 ? (
        <div className="card card-pad-lg text-center">
          <div className="font-heading text-[24px]">No conversations yet</div>
          <p className="mx-auto mt-2 max-w-[480px] text-sm leading-6 text-muted">
            {role === "teacher"
              ? "Once you apply for a job, choose Message school on the application to start a conversation."
              : "Choose Message on an applicant to start a conversation with them."}
          </p>
        </div>
      ) : null}

      {conversations.length > 0 ? (
        <div className={active ? "messaging-layout has-active" : "messaging-inbox-layout"}>
          <ConversationList
            active={activeId}
            conversations={conversations}
            expanded={!active}
            hasMore={conversationsQuery.hasNextPage}
            loadingMore={conversationsQuery.isFetchingNextPage}
            onLoadMore={() => void conversationsQuery.fetchNextPage()}
            onSelect={(nextId) => setSelection({ applicationId: ctx.applicationId, selectedId: nextId })}
            total={total}
          />
          {active ? (
            <>
              <Thread key={active.id} conversation={active} onBack={returnToInbox} toast={toast} />
              <ConversationContextPanel
                application={applicationQuery.data ?? null}
                conversation={active}
                error={applicationQuery.isError || jobQuery.isError}
                go={go}
                job={jobQuery.data ?? null}
                loading={applicationQuery.isLoading || jobQuery.isLoading}
                role={role}
              />
            </>
          ) : (
            <InboxOverview conversations={total} role={role} unread={unread} />
          )}
        </div>
      ) : null}
    </div>
  );
}

function ConversationList({
  active,
  conversations,
  expanded,
  hasMore,
  loadingMore,
  onLoadMore,
  onSelect,
  total,
}: {
  active: string | null;
  conversations: Conversation[];
  expanded: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onSelect: (id: string) => void;
  /** Every thread the user has, not just the pages loaded so far. */
  total: number;
}) {
  return (
    <div className={`messaging-conversations sidebar-panel flex min-h-0 flex-col overflow-hidden ${expanded ? "is-inbox" : ""}`}>
      <div className="sidebar-heading mx-4 mb-0 pt-5">
        <span className="flex items-center gap-2"><Icon name="message" size={17} /> Inbox</span>
        <span className="rounded-md bg-chalk px-2 py-0.5 text-xs text-muted">{total}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {conversations.map((conversation) => {
          const last = conversation.lastMessage;
          const preview = last
            ? `${last.fromMe ? "You: " : ""}${last.body || (last.hasAttachments ? "Sent a file" : "")}`
            : "No messages yet";

          return (
            <button
              key={conversation.id}
              aria-current={active === conversation.id ? "true" : undefined}
              className={`msg-list-item w-full text-left ${active === conversation.id ? "active" : ""}`}
              onClick={() => onSelect(conversation.id)}
              type="button"
            >
              <Avatar name={conversation.counterpart.name} size="sm" src={conversation.counterpart.imageUrl} />
              <div className="min-w-0 flex-1">
                <div className={`truncate ${conversation.unreadCount ? "font-bold" : "font-medium"}`}>{conversation.counterpart.name}</div>
                <div className="truncate text-xs text-muted">{conversation.job.title}</div>
                <div className={`truncate text-xs ${conversation.unreadCount ? "font-semibold text-ink" : "text-muted"}`}>{preview}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {last ? <span className="text-[11px] text-muted">{formatWhen(last.createdAt)}</span> : null}
                {conversation.unreadCount ? (
                  <span className="rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">{conversation.unreadCount}</span>
                ) : null}
              </div>
            </button>
          );
        })}
        {hasMore ? (
          <div className="p-3">
            <Btn className="w-full" loading={loadingMore} loadingLabel="Loading" size="sm" variant="ghost" onClick={onLoadMore}>
              Load more conversations
            </Btn>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function InboxOverview({ conversations, role, unread }: { conversations: number; role: RouteProps["role"]; unread: number }) {
  return (
    <section className="messaging-inbox-overview card" aria-labelledby="inbox-overview-title">
      <div className="messaging-inbox-illustration" aria-hidden="true">
        <Icon name="message" size={30} />
      </div>
      <p className="context-label">Your messages</p>
      <h2 className="mt-2 font-heading text-2xl font-bold text-ink" id="inbox-overview-title">Select a conversation</h2>
      <p className="mt-2 max-w-[540px] text-sm leading-6 text-muted">
        Choose a {role === "teacher" ? "school" : "teacher"} from your inbox to open the full conversation and see the related application and job details.
      </p>
      <div className="mt-6 grid w-full max-w-[520px] grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-chalk p-4">
          <div className="text-2xl font-bold text-ink">{conversations}</div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Conversations</div>
        </div>
        <div className="rounded-xl border border-border bg-chalk p-4">
          <div className="text-2xl font-bold text-ink">{unread}</div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Unread messages</div>
        </div>
      </div>
    </section>
  );
}

function Thread({ conversation, onBack, toast }: { conversation: Conversation; onBack: () => void; toast: ToastFn }) {
  const messagesQuery = useMessages(conversation.id);
  const messages = useMemo(() => flattenMessages(messagesQuery.data), [messagesQuery.data]);
  const markRead = useMarkConversationRead();
  const markReadRef = useRef(markRead.mutate);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMessageId = messages.at(-1)?.id;
  const typing = useTypingIndicator(conversation.id);
  const counterpartTyping = Boolean(typing?.typing && typing.side !== conversation.me);

  useEffect(() => {
    markReadRef.current = markRead.mutate;
  }, [markRead.mutate]);

  // Something to mark read: the newest message is theirs, or the thread was opened with unread messages.
  const newestFromCounterpart = messages.length > 0 && messages.at(-1)?.senderSide !== conversation.me;
  const hasUnread = newestFromCounterpart || conversation.unreadCount > 0;

  // Follow the conversation: scroll to the newest message and mark it read while the tab is in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
    if (hasUnread && document.visibilityState === "visible") markReadRef.current(conversation.id);
  }, [conversation.id, hasUnread, lastMessageId]);

  // Messages that arrived while the tab was hidden are marked read when the user comes back to it.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && hasUnread) markReadRef.current(conversation.id);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [conversation.id, hasUnread]);

  // The newest of my messages the other side has seen, for a single "Seen" marker.
  const seenId = useMemo(() => {
    if (!conversation.counterpartLastReadAt) return null;
    const seenAt = new Date(conversation.counterpartLastReadAt).getTime();
    const mineSeen = messages.filter(
      (message) => message.senderSide === conversation.me && new Date(message.createdAt).getTime() <= seenAt,
    );
    return mineSeen.at(-1)?.id ?? null;
  }, [conversation.counterpartLastReadAt, conversation.me, messages]);

  return (
    <section className="messaging-thread card card-pad-lg flex min-h-[620px] flex-col overflow-hidden">
      <header className="mb-4 flex items-center gap-3 border-b border-border pb-4">
        <Btn className="messaging-back-button" size="sm" variant="ghost" onClick={onBack}>Inbox</Btn>
        <Avatar name={conversation.counterpart.name} size="md" src={conversation.counterpart.imageUrl} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{conversation.counterpart.name}</div>
          <div className="truncate text-xs text-muted" aria-live="polite">
            {counterpartTyping ? (
              <span className="text-brand">{conversation.counterpart.name} is typing…</span>
            ) : (
              <>{conversation.counterpart.role === "school" ? "School" : "Teacher"} · {conversation.job.title}</>
            )}
          </div>
        </div>
        <Tag tone="ghost">{conversation.applicationStatus.toLowerCase().replace(/_/g, " ")}</Tag>
      </header>

      <div className="message-timeline flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pr-1">
        {messagesQuery.hasNextPage ? (
          <Btn
            className="self-center"
            loading={messagesQuery.isFetchingNextPage}
            loadingLabel="Loading"
            size="sm"
            variant="ghost"
            onClick={() => messagesQuery.fetchNextPage()}
          >
            Load earlier messages
          </Btn>
        ) : null}
        {messagesQuery.isLoading ? <SectionLoader rows={3} /> : null}
        {!messagesQuery.isLoading && messages.length === 0 ? (
          <p className="m-auto max-w-[360px] text-center text-sm text-muted">
            Say hello to {conversation.counterpart.name}. Messages here are only visible to the two of you.
          </p>
        ) : null}
        {messages.map((message) => (
          <Bubble
            key={message.id}
            conversationId={conversation.id}
            message={message}
            mine={message.senderSide === conversation.me}
            seen={message.id === seenId}
            toast={toast}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {conversation.readOnly ? (
        <p className="mt-4 rounded-lg bg-chalk px-4 py-3 text-sm text-muted">
          This application was not successful, so the conversation is closed. You can still read and download what was shared.
        </p>
      ) : (
        <Composer key={conversation.id} conversationId={conversation.id} toast={toast} />
      )}
    </section>
  );
}

function ConversationContextPanel({
  application,
  conversation,
  error,
  go,
  job,
  loading,
  role,
}: {
  application: JobApplication | null;
  conversation: Conversation;
  error: boolean;
  go: RouteProps["go"];
  job: Job | null;
  loading: boolean;
  role: RouteProps["role"];
}) {
  const [proposalOpen, setProposalOpen] = useState(false);
  const applicant = application?.instructor;
  const status = application?.status ?? conversation.applicationStatus;

  return (
    <>
    <aside className="messaging-context sidebar-panel overflow-y-auto">
      <div className="border-b border-border p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="context-label">Application details</p>
            <h2 className="mt-1 font-heading text-lg font-bold text-ink">Conversation context</h2>
          </div>
          <Tag tone={applicationStatusTone(status)}>{formatStatus(status)}</Tag>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-chalk p-3.5">
          <Avatar
            name={conversation.counterpart.name}
            size="lg"
            src={conversation.counterpart.imageUrl}
          />
          <div className="min-w-0">
            <button
              className="block max-w-full truncate text-left font-bold text-ink hover:text-brand hover:underline disabled:cursor-default disabled:no-underline"
              disabled={!conversation.counterpart.id}
              onClick={() => conversation.counterpart.role === "school"
                ? go("institution-profile", { institutionId: conversation.counterpart.id ?? undefined, jobId: conversation.job.id })
                : go("teacher-profile", { applicationId: conversation.applicationId, jobId: conversation.job.id, teacherId: conversation.counterpart.id ?? undefined })}
              type="button"
            >
              {conversation.counterpart.name}
            </button>
            <p className="mt-0.5 text-xs text-muted">
              {role === "teacher" ? "Hiring school" : "Teaching applicant"}
            </p>
          </div>
        </div>

        {loading ? <SectionLoader rows={2} /> : null}

        <section>
          <p className="context-label">Job</p>
          <h3 className="mt-2 text-base font-bold leading-snug text-ink">
            {job?.title ?? conversation.job.title}
          </h3>
          <div className="mt-3 space-y-2.5">
            <ContextRow icon="pin" text={formatJobLocation(job)} />
            <ContextRow icon="calendar" text={formatJobDates(job)} />
            <ContextRow icon="pound" text={formatJobPay(job)} />
          </div>
          {job?.subject || job?.keyStages?.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {job.subject ? <Tag tone="ghost">{job.subject}</Tag> : null}
              {job.keyStages?.slice(0, 3).map((stage) => <Tag key={stage} tone="ghost">{stage}</Tag>)}
            </div>
          ) : null}
        </section>

        {role === "institution" && applicant ? (
          <section className="border-t border-border pt-5">
            <p className="context-label">Applicant</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <ContextStat
                label="Experience"
                value={typeof applicant.experience === "number" ? `${applicant.experience} years` : "Not listed"}
              />
              <ContextStat label="DBS" value={applicant.dbsVerified ? "Verified" : "Not verified"} />
            </div>
            {applicant.subjects.length ? (
              <p className="mt-3 text-sm leading-6 text-muted">
                <span className="font-semibold text-ink">Subjects:</span> {applicant.subjects.join(", ")}
              </p>
            ) : null}
          </section>
        ) : null}

        {application?.coverLetter ? (
          <section className="border-t border-border pt-5">
            <p className="context-label">Proposal</p>
            <div className="mt-3 rounded-xl border border-brand-tint-2 bg-brand-tint p-4">
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-brand shadow-sm">
                  <Icon name="file" size={17} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">Application proposal</p>
                  <p className="mt-1 text-xs leading-5 text-muted">Read the teacher&apos;s complete introduction and suitability for this role.</p>
                </div>
              </div>
              <Btn className="mt-4 w-full" icon="eye" size="sm" variant="secondary" onClick={() => setProposalOpen(true)}>
                View Proposal
              </Btn>
            </div>
          </section>
        ) : null}

        {application?.createdAt ? (
          <p className="border-t border-border pt-4 text-xs text-muted">
            Applied {formatDisplayDate(application.createdAt)}
          </p>
        ) : null}

        {error ? (
          <p className="rounded-lg bg-warning-tint p-3 text-xs text-ink">
            Some application details are temporarily unavailable.
          </p>
        ) : null}

        <div className="grid gap-2 border-t border-border pt-5">
          <Btn
            icon="arrow"
            onClick={() => go("applications", { applicationId: conversation.applicationId, jobId: conversation.job.id })}
          >
            View application
          </Btn>
          <Btn icon="file" variant="secondary" onClick={() => go("job-detail", { jobId: conversation.job.id })}>
            View job
          </Btn>
        </div>
      </div>
    </aside>
    <Modal open={proposalOpen} scrollMode="viewport" size="xl" onClose={() => setProposalOpen(false)}>
      <article className="overflow-hidden rounded-xl">
        <header className="border-b border-border bg-[linear-gradient(135deg,#eef9fd_0%,#ffffff_72%)] px-5 py-5 sm:px-8 sm:py-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3.5">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand text-white shadow-sm">
                <Icon name="file" size={21} />
              </div>
              <div className="min-w-0">
                <p className="context-label text-brand">Application proposal</p>
                <h2 className="mt-1 font-heading text-xl font-semibold text-ink sm:text-2xl">{applicant?.fullName ?? conversation.counterpart.name}</h2>
                <p className="mt-1 text-sm text-muted">For {job?.title ?? conversation.job.title}</p>
              </div>
            </div>
            <button aria-label="Close proposal" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-white text-muted shadow-sm transition-colors hover:bg-chalk hover:text-ink" onClick={() => setProposalOpen(false)} type="button">
              <Icon name="x" size={18} />
            </button>
          </div>
        </header>
        <div className="px-5 py-6 sm:px-8 sm:py-8">
          <ProposalContent className="text-[15px] leading-8 text-slate" value={application?.coverLetter ?? ""} />
        </div>
        <footer className="flex justify-end border-t border-border bg-surface-subtle px-5 py-4 sm:px-8">
          <Btn variant="secondary" onClick={() => setProposalOpen(false)}>Close proposal</Btn>
        </footer>
      </article>
    </Modal>
    </>
  );
}

function ContextRow({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-start gap-2 text-sm text-muted">
      <Icon className="mt-0.5 text-brand" name={icon} size={15} />
      <span className="leading-5">{text}</span>
    </div>
  );
}

function ContextStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-white p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

function applicationStatusTone(status: string): "" | "green" | "purple" | "amber" | "red" {
  if (status === "HIRED") return "green";
  if (status === "INTERVIEW" || status === "SHORTLISTED") return "purple";
  if (status === "VIEWED") return "amber";
  if (status === "REJECTED") return "red";
  return "";
}

function formatStatus(status: string) {
  return status.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatJobLocation(job: Job | null) {
  if (!job) return "Location available on the job listing";
  return [job.city === "Location TBC" ? "" : job.city, job.county, job.postalCode].filter(Boolean).join(", ") || "Location TBC";
}

function formatJobDates(job: Job | null) {
  if (!job?.startDate) return "Dates available on the job listing";
  const start = formatDisplayDate(job.startDate);
  return job.endDate ? `${start} – ${formatDisplayDate(job.endDate)}` : `Starts ${start}`;
}

function formatJobPay(job: Job | null) {
  if (!job?.rate) return "Rate TBC";
  if (job.payType === "hourly") return `GBP ${job.rate}/hr`;
  if (job.payType === "fixed") return `GBP ${job.rate} fixed`;
  return `GBP ${job.rate}/day`;
}

function formatDisplayDate(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "date not recorded";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(timestamp));
}

function Bubble({
  conversationId,
  message,
  mine,
  seen,
  toast,
}: {
  conversationId: string;
  message: ChatMessage;
  mine: boolean;
  seen: boolean;
  toast: ToastFn;
}) {
  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <div className={`msg-bubble ${mine ? "out" : "in"}`}>
        {message.body ? <div className="whitespace-pre-wrap break-words">{message.body}</div> : null}
        {message.attachments.map((attachment) => (
          <MessageAttachmentPreview key={attachment.id} attachment={attachment} conversationId={conversationId} light={mine} toast={toast} />
        ))}
        <div className="mt-1.5 text-xs opacity-70">{formatTime(message.createdAt)}</div>
      </div>
      {seen ? <span className="mt-0.5 text-[11px] text-muted">Seen</span> : null}
    </div>
  );
}

function Composer({ conversationId, toast }: { conversationId: string; toast: ToastFn }) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const typingRef = useRef<{ lastSentAt: number; stopTimer: ReturnType<typeof setTimeout> | null }>({ lastSentAt: 0, stopTimer: null });
  const send = useSendMessage({ onError: (message) => toast({ msg: message, title: "Message not sent", tone: "danger" }) });

  // Tell the other person we are typing (at most every 1.5 s) and that we stopped (3 s after the last keystroke).
  function noteTyping(text: string) {
    const state = typingRef.current;
    if (state.stopTimer) clearTimeout(state.stopTimer);

    if (!text.trim()) {
      if (state.lastSentAt) emitTyping(conversationId, false);
      state.lastSentAt = 0;
      return;
    }

    const now = Date.now();
    if (now - state.lastSentAt >= 1500) {
      emitTyping(conversationId, true);
      state.lastSentAt = now;
    }

    state.stopTimer = setTimeout(() => {
      emitTyping(conversationId, false);
      state.lastSentAt = 0;
    }, 3000);
  }

  useEffect(() => {
    const state = typingRef.current;
    return () => {
      if (state.stopTimer) clearTimeout(state.stopTimer);
      if (state.lastSentAt) emitTyping(conversationId, false);
    };
  }, [conversationId]);
  const uploading = files.some((file) => file.status === "uploading");
  const readyIds = files.flatMap((file) => (file.status === "ready" && file.attachment ? [file.attachment.id] : []));
  const canSend = !send.isPending && !uploading && (body.trim().length > 0 || readyIds.length > 0);

  function addFiles(list: FileList | null) {
    const picked = Array.from(list ?? []);
    const room = MAX_ATTACHMENTS - files.length;

    if (picked.length > room) {
      toast({ msg: `You can attach up to ${MAX_ATTACHMENTS} files per message.`, title: "Too many files", tone: "danger" });
    }

    picked.slice(0, Math.max(0, room)).forEach((file) => {
      const localId = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`;
      const problem = !ALLOWED_ATTACHMENT_TYPES.includes(file.type)
        ? "Only PDF, Word, JPEG, PNG and text files"
        : file.size > MAX_ATTACHMENT_BYTES
          ? "Files can be up to 10 MB"
          : null;

      if (problem) {
        setFiles((current) => [...current, { error: problem, file, localId, status: "error" }]);
        return;
      }

      setFiles((current) => [...current, { file, localId, status: "uploading" }]);
      uploadAttachment(conversationId, file)
        .then((attachment) =>
          setFiles((current) => current.map((item) => (item.localId === localId ? { ...item, attachment, status: "ready" } : item))),
        )
        .catch((error: unknown) =>
          setFiles((current) =>
            current.map((item) =>
              item.localId === localId
                ? { ...item, error: error instanceof Error ? error.message : "Upload failed", status: "error" }
                : item,
            ),
          ),
        );
    });

    if (fileInput.current) fileInput.current.value = "";
  }

  function submit() {
    if (!canSend) return;

    const state = typingRef.current;
    if (state.stopTimer) clearTimeout(state.stopTimer);
    if (state.lastSentAt) emitTyping(conversationId, false);
    state.lastSentAt = 0;

    send.mutate(
      { attachmentIds: readyIds, body, conversationId },
      {
        onSuccess: () => {
          setBody("");
          setFiles([]);
        },
      },
    );
  }

  return (
    <div className="message-composer border-t border-border">
      {files.length ? (
        <ul className="mb-3 flex flex-wrap gap-2">
          {files.map((item) => (
            <li
              key={item.localId}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${item.status === "error" ? "border-danger text-danger" : "border-border"}`}
            >
              <Icon name="file" size={13} />
              <span className="max-w-[180px] truncate">{item.file.name}</span>
              <span className="text-muted">
                {item.status === "uploading" ? "Uploading..." : item.status === "error" ? item.error : formatFileSize(item.file.size)}
              </span>
              <button
                aria-label={`Remove ${item.file.name}`}
                className="text-muted hover:text-ink"
                onClick={() => setFiles((current) => current.filter((file) => file.localId !== item.localId))}
                type="button"
              >
                <Icon name="x" size={12} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="message-composer-controls">
        <input
          ref={fileInput}
          accept={ALLOWED_ATTACHMENT_TYPES.join(",")}
          className="hidden"
          multiple
          onChange={(event) => addFiles(event.target.files)}
          type="file"
        />
        <Btn icon="upload" variant="ghost" onClick={() => fileInput.current?.click()}>
          Attach
        </Btn>
        <textarea
          aria-label="Message"
          className="input min-h-[44px] flex-1 resize-none"
          maxLength={MAX_MESSAGE_LENGTH}
          onChange={(event) => {
            setBody(event.target.value);
            noteTyping(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Write a message..."
          rows={1}
          value={body}
        />
        <Btn disabled={!canSend} icon="send" loading={send.isPending} loadingLabel="Sending" onClick={submit}>
          Send
        </Btn>
      </div>
      <p className="message-composer-hint">Enter to send · Shift+Enter for a new line</p>
    </div>
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatWhen(value: string) {
  const date = new Date(value);
  const sameDay = date.toDateString() === new Date().toDateString();

  return sameDay ? formatTime(value) : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date);
}
