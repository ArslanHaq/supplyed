"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { useApplication } from "@/features/applications/use-applications";
import type { JobApplication } from "@/features/applications/types";
import { useBooking } from "@/features/bookings/use-bookings";
import type { Booking } from "@/features/bookings/types";
import {
  ALLOWED_ATTACHMENT_TYPES,
  formatFileSize,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  MAX_MESSAGE_LENGTH,
} from "@/features/conversations/schemas";
import { emitTyping } from "@/features/conversations/socket";
import { invitationMessageParts } from "@/features/conversations/message-links";
import { conversationPerson, groupConversationThreads, threadKind, type ConversationGroup, type ConversationThread } from "@/features/conversations/threads";
import { useAllInvitations, useInvitationClock } from "@/features/invitations/use-invitations";
import type { Invitation } from "@/features/invitations/types";
import { formatPlannedUnits } from "@/features/jobs/work-units";
import type { ChatMessage, Conversation, MessageAttachment } from "@/features/conversations/types";
import {
  flattenMessages,
  uploadAttachment,
  flattenConversations,
  useConversationForApplication,
  useConversationForBooking,
  useConversation,
  useConversations,
  useMarkConversationRead,
  useMessages,
  useSendMessage,
  useTypingIndicator,
  useUnreadMessages,
} from "@/features/conversations/use-conversations";
import { useJob } from "@/features/jobs/use-jobs";
import type { Job } from "@/features/jobs/types";
import type { RouteProps, ToastFn } from "@/types/supplyed";

import { Avatar, Btn, Icon, Tag } from "../atoms";
import { PageHead, SectionLoader } from "../molecules";
import { ProposalPreviewModal } from "../molecules/ProposalPreviewModal";
import { TeacherHireActions } from "./TeacherHireActions";
import { MessageAttachmentPreview } from "./MessageAttachmentPreview";
import { ConversationThreadPicker } from "./ConversationThreadPicker";

type PendingFile = {
  attachment?: MessageAttachment;
  error?: string;
  file: File;
  localId: string;
  status: "error" | "ready" | "uploading";
};
type ComposerDraft = { body: string; files: PendingFile[]; sending?: boolean };
type UpdateDraft = (conversationId: string, update: (draft: ComposerDraft) => ComposerDraft) => void;
const emptyDraft: ComposerDraft = { body: "", files: [] };

/**
 * General conversations and separate application/booking conversations under Jobs.
 * New messages, read receipts and typing notices arrive live over the shared
 * socket (see useConversationStream in AppChrome).
 */
export function MessagingPage({ ctx, go, role, toast }: Pick<RouteProps, "ctx" | "go" | "role" | "toast">) {
  const conversationsQuery = useConversations({ limit: 20 });
  const unreadQuery = useUnreadMessages();
  const invitationsQuery = useAllInvitations(role === "teacher" || role === "institution");
  const [drafts, setDrafts] = useState<Record<string, ComposerDraft>>({});
  const updateDraft: UpdateDraft = useCallback((id, update) => {
    setDrafts(current => ({ ...current, [id]: update(current[id] ?? emptyDraft) }));
  }, []);
  const fromApplication = useConversationForApplication(ctx.conversationId || ctx.bookingId ? undefined : ctx.applicationId);
  const fromBooking = useConversationForBooking(ctx.conversationId ? undefined : ctx.bookingId);
  const fromId = useConversation(ctx.conversationId);
  const linked = ctx.conversationId ? fromId : ctx.bookingId ? fromBooking : fromApplication;
  const contextId = ctx.conversationId ?? ctx.bookingId ?? ctx.applicationId;
  const { hasNextPage } = conversationsQuery;
  // undefined follows a direct application link, null explicitly returns to the inbox.
  const [selection, setSelection] = useState<{ applicationId?: string; selectedId: string | null | undefined; conversation?: Conversation }>({ selectedId: undefined });
  const selectedId = selection.applicationId === contextId ? selection.selectedId : undefined;

  const selectedQuery = useConversation(selectedId ?? undefined);
  const selectedConversation = selectedId ? selectedQuery.data ?? selection.conversation : undefined;

  // An older picker choice may not be in the loaded inbox pages.
  const conversations = useMemo(() => {
    const list = flattenConversations(conversationsQuery.data);
    const opened = [selectedConversation, linked.data].filter((item): item is Conversation => Boolean(item));
    return [...opened, ...list.filter(item => !opened.some(value => value.id === item.id))];
  }, [conversationsQuery.data, linked.data, selectedConversation]);

  const groups = useMemo(() => groupConversationThreads(conversations, invitationsQuery.data), [conversations, invitationsQuery.data]);
  const activeKey = selectedId === undefined ? linked.data?.id ?? null : selectedId;
  const activeGroup = groups.find(group => group.threads.some(thread => thread.key === activeKey));
  const activeThread = activeGroup?.threads.find(thread => thread.key === activeKey);
  const active = activeThread?.conversation ?? null;
  const bookingQuery = useBooking(active?.booking?.id);
  const applicationQuery = useApplication(active?.applicationId ?? undefined);
  const jobQuery = useJob(role === "institution" && !active?.booking && active?.applicationId ? active.job?.id ?? "" : "", role === "institution");
  const unread = unreadQuery.data?.total ?? conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0);
  function selectThread(conversation: Conversation) {
    setSelection({ applicationId: contextId, selectedId: conversation.id, conversation });
  }

  function returnToInbox() {
    setSelection({ applicationId: contextId, selectedId: null });
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

      {conversationsQuery.isLoading || linked.isLoading ? <SectionLoader rows={4} /> : null}
      {linked.error ? (
        <p className="mb-4 rounded-lg bg-danger-tint px-4 py-3 text-sm text-danger">{linked.error.message}</p>
      ) : null}
      {conversationsQuery.isError ? <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 text-sm" role="alert"><span>The inbox could not be loaded.</span><Btn size="sm" variant="secondary" onClick={() => void conversationsQuery.refetch()}>Try again</Btn></div> : null}

      {!conversationsQuery.isLoading && !conversationsQuery.isError && !linked.isLoading && conversations.length === 0 ? (
        <div className="card card-pad-lg text-center">
          <div className="font-heading text-[24px]">No conversations yet</div>
          <p className="mx-auto mt-2 max-w-[480px] text-sm leading-6 text-muted">
            {role === "teacher"
              ? "Schools can contact you directly or about an application. Their conversations appear here so you can reply."
              : "Choose Message on a teacher profile or applicant to start a conversation."}
          </p>
        </div>
      ) : null}

      {conversations.length > 0 ? (
        <div className={active ? "messaging-layout has-active" : "messaging-inbox-layout"}>
          <ConversationList
            active={activeGroup?.key ?? null}
            groups={groups}
            expanded={!active}
            hasMore={conversationsQuery.hasNextPage}
            loadingMore={conversationsQuery.isFetchingNextPage}
            onLoadMore={() => void conversationsQuery.fetchNextPage()}
            onSelect={(group) => selectThread(group.key === activeGroup?.key && active ? active : group.threads[0].conversation)}
          />
          {active && activeThread && activeGroup ? (
            <>
              <Thread
                conversation={active}
                activeThread={activeThread}
                onSelectThread={selectThread}
                invitationsLoading={invitationsQuery.isLoading}
                invitationsError={invitationsQuery.isError}
                onRetryInvitations={() => void invitationsQuery.refetch()}
                draft={drafts[active.id] ?? emptyDraft}
                updateDraft={updateDraft}
                onBack={returnToInbox}
                toast={toast}
              />
              {threadKind(activeThread) === "General" ? <GeneralConversationContext invitations={activeGroup.invitations} conversation={active} go={go} /> : active.booking ? <BookingConversationContext booking={bookingQuery.data} conversation={active} loading={bookingQuery.isLoading} error={bookingQuery.error?.message} go={go} /> : <ConversationContextPanel
                key={activeThread.key}
                application={applicationQuery.data ?? null}
                conversation={active}
                applicationError={applicationQuery.isError}
                go={go}
                job={jobQuery.data ?? null}
                loading={applicationQuery.isLoading || jobQuery.isLoading}
                role={role}
              />}
            </>
          ) : (
            <InboxOverview conversations={groups.length} role={role} unread={unread} loadingMore={Boolean(hasNextPage)} />
          )}
        </div>
      ) : null}
    </div>
  );
}

function ConversationList({
  active,
  groups,
  expanded,
  hasMore,
  loadingMore,
  onLoadMore,
  onSelect,
}: {
  active: string | null;
  groups: ConversationGroup[];
  expanded: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onSelect: (group: ConversationGroup) => void;
}) {
  return (
    <div className={`messaging-conversations sidebar-panel flex min-h-0 flex-col overflow-hidden ${expanded ? "is-inbox" : ""}`}>
      <div className="sidebar-heading mx-4 mb-0 pt-5">
        <span className="flex items-center gap-2"><Icon name="message" size={17} /> Inbox</span>
        <span className="rounded-md bg-chalk px-2 py-0.5 text-xs text-muted">{groups.length}{hasMore ? "+" : ""}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto" onScroll={event => {
        const element = event.currentTarget;
        if (hasMore && !loadingMore && element.scrollHeight - element.scrollTop - element.clientHeight < 80) onLoadMore();
      }}>
        {groups.map((group) => {
          const conversation = group.latest;
          const last = conversation.lastMessage;
          const preview = last
            ? `${last.fromMe ? "You: " : ""}${last.body || (last.hasAttachments ? "Sent a file" : "")}`
            : "No messages yet";

          return (
            <button
              key={group.key}
              aria-current={active === group.key ? "true" : undefined}
              className={`msg-list-item w-full text-left ${active === group.key ? "active" : ""}`}
              onClick={() => onSelect(group)}
              type="button"
            >
              <Avatar name={group.person.name} size="sm" src={group.person.imageUrl} />
              <div className="min-w-0 flex-1">
                <div className={`truncate ${group.unreadCount ? "font-bold" : "font-medium"}`}>{group.person.name}</div>
                <div className="truncate text-xs text-muted">{group.threads.length}{hasMore ? "+" : ""} {group.threads.length === 1 && !hasMore ? "thread" : "threads"} · {threadKind({ key: conversation.id, conversation })}</div>
                <div className={`truncate text-xs ${group.unreadCount ? "font-semibold text-ink" : "text-muted"}`}>{preview}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {last ? <span className="text-[11px] text-muted">{formatWhen(last.createdAt)}</span> : null}
                {group.unreadCount ? (
                  <span className="rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">{group.unreadCount}</span>
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

function InboxOverview({ conversations, role, unread, loadingMore }: { conversations: number; role: RouteProps["role"]; unread: number; loadingMore: boolean }) {
  return (
    <section className="messaging-inbox-overview card" aria-labelledby="inbox-overview-title">
      <div className="messaging-inbox-illustration" aria-hidden="true">
        <Icon name="message" size={30} />
      </div>
      <p className="context-label">Your messages</p>
      <h2 className="mt-2 font-heading text-2xl font-bold text-ink" id="inbox-overview-title">Select a conversation</h2>
      <p className="mt-2 max-w-[540px] text-sm leading-6 text-muted">
        Choose a {role === "teacher" ? "school" : "teacher"}. General holds direct messages and invitations. Jobs holds application conversations and a fresh conversation for each booking.
      </p>
      <div className="mt-6 grid w-full max-w-[520px] grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-chalk p-4">
          <div className="text-2xl font-bold text-ink">{conversations}{loadingMore ? "+" : ""}</div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted">{role === "teacher" ? "Schools" : "People"}</div>
        </div>
        <div className="rounded-xl border border-border bg-chalk p-4">
          <div className="text-2xl font-bold text-ink">{unread}</div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Unread messages</div>
        </div>
      </div>
    </section>
  );
}

function Thread({ conversation, activeThread, onSelectThread, invitationsLoading, invitationsError, onRetryInvitations, draft, updateDraft, onBack, toast }: {
  conversation: Conversation;
  activeThread: ConversationThread;
  onSelectThread: (conversation: Conversation) => void;
  invitationsLoading: boolean;
  invitationsError: boolean;
  onRetryInvitations: () => void;
  draft: ComposerDraft;
  updateDraft: UpdateDraft;
  onBack: () => void;
  toast: ToastFn;
}) {
  const tabId = useId();
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
        <Btn className="messaging-back-button" icon="arrowLeft" size="sm" variant="ghost" onClick={onBack}>Inbox</Btn>
        <Avatar name={conversationPerson(conversation).name} size="md" src={conversationPerson(conversation).imageUrl} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{conversationPerson(conversation).name}</div>
          <div className="truncate text-xs text-muted" aria-live="polite">
            {counterpartTyping ? (
              <span className="text-brand">{conversationPerson(conversation).name} is typing…</span>
            ) : (
              <>{conversationPerson(conversation).role === "school" ? "School" : "Teacher"} · {threadKind(activeThread) === "General" ? "General" : conversation.job?.title ?? "Job"}</>
            )}
          </div>
        </div>
        <Tag tone="ghost">{threadKind(activeThread)}</Tag>
      </header>

      <ConversationThreadPicker key={`${conversation.participants.poster?.id}:${conversation.participants.instructor?.id}`} id={tabId} active={activeThread} onSelect={onSelectThread} />
      {threadKind(activeThread) === "General" && invitationsLoading ? <p className="conversation-info" role="status">Loading invitation details…</p> : null}
      {threadKind(activeThread) === "General" && invitationsError ? <p className="conversation-info" role="status">Invitation details unavailable. <button className="underline" type="button" onClick={onRetryInvitations}>Try again</button></p> : null}
      {conversation.booking ? <p className="conversation-info"><Icon name="calendar" size={14} />Booking conversation · Application messages are in the application thread.</p> : null}
      <div id={`${tabId}-panel`} role="tabpanel" aria-labelledby={`${tabId}-${threadKind(activeThread)}`} tabIndex={0} className="message-timeline flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pr-1">
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
        {messagesQuery.isError ? <div className="my-4 text-center" role="alert"><p className="mb-3 text-sm text-muted">Messages could not be loaded.</p><Btn variant="secondary" size="sm" onClick={() => void messagesQuery.refetch()}>Try again</Btn></div> : null}
        {!messagesQuery.isLoading && !messagesQuery.isError && messages.length === 0 ? (
          <p className="m-auto max-w-[360px] text-center text-sm text-muted">
            Say hello to {conversationPerson(conversation).name}. Start a conversation using the message box below.
          </p>
        ) : null}
        {messages.map((message, index) => <div key={message.id}>
          {index === 0 || new Date(messages[index - 1].createdAt).toDateString() !== new Date(message.createdAt).toDateString() ? <div className="message-day-label"><span>{formatDisplayDate(message.createdAt)}</span></div> : null}
          <Bubble
            conversationId={conversation.id}
            message={message}
            mine={conversation.me !== null && message.senderSide === conversation.me}
            seen={message.id === seenId}
            toast={toast}
          />
        </div>)}
        <div ref={bottomRef} />
      </div>

      {conversation.readOnly ? (
        <p className="mt-4 rounded-lg bg-chalk px-4 py-3 text-sm text-muted">
          This conversation is read-only. You can still read and download what was shared.
        </p>
      ) : (
        <Composer key={conversation.id} conversationId={conversation.id} draft={draft} updateDraft={updateDraft} toast={toast} />
      )}
      <p className="conversation-privacy-note">SupplyEd may review conversations for support and safety.</p>
    </section>
  );
}

function GeneralConversationContext({ invitations, conversation, go }: { invitations: Invitation[]; conversation: Conversation; go: RouteProps["go"] }) {
  const person = conversationPerson(conversation);
  return <aside className="messaging-context sidebar-panel overflow-y-auto">
    <div className="border-b border-border p-5">
      <p className="context-label">General conversation</p>
      <h2 className="mt-1 font-heading text-lg font-bold text-ink">{person.name}</h2>
      <p className="mt-2 text-sm text-muted">Direct messages and all job invitations with this {person.role === "school" ? "school" : "teacher"} stay together here.</p>
      <Btn className="mt-4 w-full" variant="secondary" disabled={!person.id} onClick={() => person.role === "school" ? go("institution-profile", { institutionId: person.id ?? undefined }) : go("teacher-profile", { teacherId: person.id ?? undefined })}>View {person.role === "school" ? "school" : "teacher"} profile</Btn>
    </div>
    <div className="space-y-4 p-5">
      <h3 className="font-semibold">Job invitations</h3>
      {invitations.length ? invitations.map(invitation => <InvitationContextCard key={invitation.id} invitation={invitation} go={go} />) : <p className="text-sm text-muted">No invitations yet.</p>}
    </div>
  </aside>;
}

function InvitationContextCard({ invitation, go }: { invitation: Invitation; go: RouteProps["go"] }) {
  const status = useInvitationClock(invitation);
  return <section className="overflow-hidden rounded-xl border border-border">
    <div className="border-b border-border p-5">
      <p className="context-label">Invitation details</p>
      <h2 className="mt-1 font-heading text-lg font-bold text-ink">{invitation.job.title}</h2>
      <div className="mt-2"><Tag tone="ghost">{formatStatus(status ?? invitation.status)}</Tag></div>
    </div>
    <div className="space-y-4 p-5">
      <ContextRow icon="calendar" text={`Invited ${formatDisplayDate(invitation.createdAt)}`} />
      {invitation.job.startDate ? <ContextRow icon="calendar" text={`${formatDisplayDate(invitation.job.startDate)}${invitation.job.endDate ? ` – ${formatDisplayDate(invitation.job.endDate)}` : ""}`} /> : null}
      <ContextRow icon="pin" text={[invitation.job.address, invitation.job.city, invitation.job.county, invitation.job.postalCode].filter(Boolean).join(", ") || "Location not specified"} />
      <ContextRow icon="pound" text={`GBP ${invitation.job.payAmount} ${invitation.job.payType === "hourly" ? "/ hour" : invitation.job.payType === "daily" ? "/ day" : "fixed"}`} />
      <p className="text-sm text-muted">{formatPlannedUnits(invitation.job)}</p>
      {invitation.message ? <p className="whitespace-pre-wrap break-words rounded-lg bg-chalk p-3 text-sm">{invitation.message}</p> : null}
      {status === "PENDING" ? <p className="text-xs text-muted">Respond by {formatDisplayDate(invitation.expiresAt)}</p> : null}
      <Btn className="w-full" variant="secondary" onClick={() => go("job-invitations", { invitationId: invitation.id })}>View invitation</Btn>
    </div>
  </section>;
}

function BookingConversationContext({ booking, conversation, loading, error, go }: { booking?: Booking; conversation: Conversation; loading: boolean; error?: string; go: RouteProps["go"] }) {
  return <aside className="messaging-context sidebar-panel overflow-y-auto">
    <div className="border-b border-border p-5"><p className="context-label">Booking details</p><h2 className="mt-1 font-heading text-lg font-bold">{booking?.job.title ?? conversation.job?.title}</h2><Tag tone="ghost">{formatStatus(booking?.status ?? conversation.booking?.status ?? "CONFIRMED")}</Tag></div>
    <div className="space-y-4 p-5">
      {loading ? <SectionLoader rows={2} /> : null}
      {error ? <p className="text-sm text-danger" role="status">{error}</p> : null}
      {booking ? <>
        <ContextRow icon="calendar" text={`${booking.startDate ? formatDisplayDate(booking.startDate) : "Start not specified"} – ${booking.endDate ? formatDisplayDate(booking.endDate) : "End not specified"}`} />
        <ContextRow icon="pin" text={[booking.job.address, booking.job.city, booking.job.county, booking.job.postalCode].filter(Boolean).join(", ") || "Location not specified"} />
        <ContextRow icon="pound" text={booking.payAmount == null ? "Pay not specified" : `GBP ${booking.payAmount} ${booking.payType === "hourly" ? "/ hour" : booking.payType === "daily" ? "/ day" : "fixed"}`} />
        <p className="text-sm text-muted">{formatPlannedUnits(booking)}</p>
      </> : null}
      <Btn className="w-full" variant="secondary" onClick={() => go("bookings", { bookingId: conversation.booking!.id })}>View booking</Btn>
    </div>
  </aside>;
}

function ConversationContextPanel({
  application,
  applicationError,
  conversation,
  go,
  job,
  loading,
  role,
}: {
  application: JobApplication | null;
  applicationError: boolean;
  conversation: Conversation;
  go: RouteProps["go"];
  job: Job | null;
  loading: boolean;
  role: RouteProps["role"];
}) {
  const [proposalOpen, setProposalOpen] = useState(false);
  const applicant = application?.instructor;
  const status = application?.status ?? conversation.applicationStatus;
  const jobDetails = application?.jobDetails;

  return (
    <>
    <aside className="messaging-context sidebar-panel overflow-y-auto">
      <div className="border-b border-border p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="context-label">{conversation.applicationId ? "Application details" : conversation.job ? "Job details" : "General conversation"}</p>
            <h2 className="mt-1 font-heading text-lg font-bold text-ink">Conversation context</h2>
          </div>
          {status ? <Tag tone={applicationStatusTone(status)}>{formatStatus(status)}</Tag> : null}
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-chalk p-3.5">
          <Avatar
            name={conversationPerson(conversation).name}
            size="lg"
            src={conversationPerson(conversation).imageUrl}
          />
          <div className="min-w-0">
            <button
              className="block max-w-full truncate text-left font-bold text-ink hover:text-brand hover:underline disabled:cursor-default disabled:no-underline"
              disabled={!conversationPerson(conversation).id}
              onClick={() => conversationPerson(conversation).role === "school"
                ? go("institution-profile", { institutionId: conversationPerson(conversation).id ?? undefined, jobId: conversation.job?.id })
                : go("teacher-profile", { applicationId: conversation.applicationId ?? undefined, jobId: conversation.job?.id, teacherId: conversationPerson(conversation).id ?? undefined })}
              type="button"
            >
              {conversationPerson(conversation).name}
            </button>
            <p className="mt-0.5 text-xs text-muted">
              {role === "teacher" ? "Hiring school" : (conversation.applicationId ? "Teaching applicant" : "Teacher")}
            </p>
          </div>
        </div>

        {loading ? <SectionLoader rows={2} /> : null}

        {conversation.job ? <section>
          <p className="context-label">Job</p>
          <h3 className="mt-2 text-base font-bold leading-snug text-ink">
            {application?.jobName ?? job?.title ?? (conversation.job?.title ?? "General")}
          </h3>
          <div className="mt-3 space-y-2.5">
            {jobDetails ? <>
              {[jobDetails.city, jobDetails.county, jobDetails.postalCode].some(Boolean) ? <ContextRow icon="pin" text={[jobDetails.city, jobDetails.county, jobDetails.postalCode].filter(Boolean).join(", ")} /> : null}
              {jobDetails.startDate ? <ContextRow icon="calendar" text={`${formatDisplayDate(jobDetails.startDate)}${jobDetails.endDate ? ` – ${formatDisplayDate(jobDetails.endDate)}` : ""}`} /> : null}
              {jobDetails.payAmount != null ? <ContextRow icon="pound" text={`GBP ${jobDetails.payAmount} ${jobDetails.payType === "hourly" ? "/ hour" : jobDetails.payType === "daily" ? "/ day" : ""}`} /> : null}
            </> : job ? <><ContextRow icon="pin" text={formatJobLocation(job)} /><ContextRow icon="calendar" text={formatJobDates(job)} /><ContextRow icon="pound" text={formatJobPay(job)} /></> : null}
          </div>
          {job?.subject || job?.keyStages?.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {job.subject ? <Tag tone="ghost">{job.subject}</Tag> : null}
              {job.keyStages?.slice(0, 3).map((stage) => <Tag key={stage} tone="ghost">{stage}</Tag>)}
            </div>
          ) : null}
        </section> : <p className="text-sm leading-6 text-muted">Use General for questions and updates that are not about a particular job or application.</p>}

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
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface text-brand shadow-sm">
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

        {applicationError ? (
          <p className="rounded-lg bg-warning-tint p-3 text-xs text-ink">
            The proposal and applicant details could not be loaded. The conversation is still available.
          </p>
        ) : null}

        <div className="grid gap-2 border-t border-border pt-5">
          {conversation.applicationId ? <Btn
            icon="arrow"
            onClick={() => go("applications", { applicationId: conversation.applicationId ?? undefined, jobId: conversation.job?.id })}
          >
            View application
          </Btn> : null}
          {job ? <Btn icon="file" variant="secondary" onClick={() => go("job-detail", { jobId: conversation.job?.id })}>
            View job
          </Btn> : null}
          {role === "institution" && conversation.me === "poster" && !conversation.readOnly && conversation.applicationStatus !== "HIRED" && conversation.participants.instructor?.id ? <TeacherHireActions go={go} hideMessage jobId={conversation.job?.id} teacher={{ id: conversation.participants.instructor.id, fullName: conversation.participants.instructor.name, imageUrl: conversation.participants.instructor.imageUrl }} /> : null}
        </div>
      </div>
    </aside>
    <ProposalPreviewModal
      applicantImage={applicant?.imageUrl}
      applicantName={applicant?.fullName ?? conversationPerson(conversation).name}
      jobTitle={job?.title ?? (conversation.job?.title ?? "General")}
      onClose={() => setProposalOpen(false)}
      open={proposalOpen}
      submittedAt={application?.createdAt}
      value={application?.coverLetter ?? ""}
    />
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
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

function applicationStatusTone(status: string): "" | "green" | "purple" | "amber" | "red" {
  if (status === "HIRED") return "green";
  if (status === "SHORTLISTED") return "purple";
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
        {message.body ? (
          <div className="whitespace-pre-wrap break-words">
            {invitationMessageParts(message.body).map((part, index) => part.href ? (
              <Link
                key={index}
                href={part.href}
                prefetch={false}
                className="rounded-sm font-semibold text-inherit underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
              >
                {part.text}
              </Link>
            ) : <span key={index}>{part.text}</span>)}
          </div>
        ) : null}
        {message.attachments.map((attachment) => (
          <MessageAttachmentPreview key={attachment.id} attachment={attachment} conversationId={conversationId} light={mine} toast={toast} />
        ))}
        <div className={`mt-1.5 text-xs ${mine ? "text-white" : "text-muted"}`}>{formatTime(message.createdAt)}</div>
      </div>
      {seen ? <span className="mt-0.5 text-[11px] text-muted">Seen</span> : null}
    </div>
  );
}

function Composer({ conversationId, draft, updateDraft, toast }: { conversationId: string; draft: ComposerDraft; updateDraft: UpdateDraft; toast: ToastFn }) {
  const { body, files } = draft;
  function setBody(value: string) {
    updateDraft(conversationId, current => ({ ...current, body: value }));
  }
  function setFiles(value: PendingFile[] | ((current: PendingFile[]) => PendingFile[])) {
    updateDraft(conversationId, current => ({ ...current, files: typeof value === "function" ? value(current.files) : value }));
  }
  const [messageError, setMessageError] = useState<string>();
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
  const failedFiles = files.some((file) => file.status === "error");
  const canSend = !send.isPending && !draft.sending && !uploading && !failedFiles && body.length <= MAX_MESSAGE_LENGTH && (body.trim().length > 0 || readyIds.length > 0);

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
        : file.size === 0 ? "Choose a file that is not empty"
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
    if (failedFiles) { setMessageError("Remove or replace the failed attachments before sending."); return; }
    if (body.length > MAX_MESSAGE_LENGTH) { setMessageError(`Use ${MAX_MESSAGE_LENGTH.toLocaleString()} characters or fewer.`); return; }
    if (!body.trim() && !readyIds.length) { setMessageError("Write a message or add an attachment."); return; }
    if (!canSend) return;
    setMessageError(undefined);

    const state = typingRef.current;
    if (state.stopTimer) clearTimeout(state.stopTimer);
    if (state.lastSentAt) emitTyping(conversationId, false);
    state.lastSentAt = 0;

    // Finish updating this thread's draft even if the user switches topics while sending.
    updateDraft(conversationId, current => ({ ...current, sending: true }));
    void send.mutateAsync({ attachmentIds: readyIds, body, conversationId }).then(() => {
      updateDraft(conversationId, current => ({
        ...current,
        body: current.body === body ? "" : current.body,
        files: current.files.filter(file => !files.some(sentFile => sentFile.localId === file.localId)),
      }));
    }).catch(() => { /* The mutation's error handler displays the failure; keep the draft. */ })
      .finally(() => updateDraft(conversationId, current => ({ ...current, sending: false })));
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
          aria-invalid={Boolean(messageError)}
          aria-describedby={messageError ? "message-validation-error" : undefined}
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
        <Btn disabled={!canSend} icon="send" loading={send.isPending || draft.sending} loadingLabel="Sending" onClick={submit}>
          Send
        </Btn>
      </div>
      {messageError ? <p className="mt-2 text-sm text-danger" id="message-validation-error" role="alert">{messageError}</p> : null}
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
