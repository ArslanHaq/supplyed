"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { attachmentDownloadUrlAction } from "@/features/conversations/actions";
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
  useConversationForApplication,
  useConversations,
  useMarkConversationRead,
  useMessages,
  useSendMessage,
  useTypingIndicator,
} from "@/features/conversations/use-conversations";
import type { RouteProps, ToastFn } from "@/types/supplyed";

import { Avatar, Btn, Icon, Tag } from "../atoms";
import { PageHead, SectionLoader } from "../molecules";

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
export function MessagingPage({ ctx, role, toast }: Pick<RouteProps, "ctx" | "role" | "toast">) {
  const conversationsQuery = useConversations();
  const fromApplication = useConversationForApplication(ctx.applicationId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // A thread opened from an application may not be in the list yet.
  const conversations = useMemo(() => {
    const list = conversationsQuery.data ?? [];
    const opened = fromApplication.data;
    return opened && !list.some((item) => item.id === opened.id) ? [opened, ...list] : list;
  }, [conversationsQuery.data, fromApplication.data]);

  const activeId = selectedId ?? fromApplication.data?.id ?? conversations[0]?.id ?? null;
  const active = conversations.find((item) => item.id === activeId) ?? null;

  return (
    <div className="app-page">
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
          <div className="font-serif text-[24px]">No conversations yet</div>
          <p className="mx-auto mt-2 max-w-[480px] text-sm leading-6 text-muted">
            {role === "teacher"
              ? "Once you apply for a job, choose Message school on the application to start a conversation."
              : "Choose Message on an applicant to start a conversation with them."}
          </p>
        </div>
      ) : null}

      {conversations.length > 0 ? (
        <div className="three-panel">
          <ConversationList active={activeId} conversations={conversations} onSelect={setSelectedId} />
          {active ? <Thread key={active.id} conversation={active} toast={toast} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function ConversationList({
  active,
  conversations,
  onSelect,
}: {
  active: string | null;
  conversations: Conversation[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="card self-start overflow-hidden">
      {conversations.map((conversation) => {
        const last = conversation.lastMessage;
        const preview = last
          ? `${last.fromMe ? "You: " : ""}${last.body || (last.hasAttachments ? "Sent a file" : "")}`
          : "No messages yet";

        return (
          <button
            key={conversation.id}
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
    </div>
  );
}

function Thread({ conversation, toast }: { conversation: Conversation; toast: ToastFn }) {
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
    <section className="card card-pad-lg flex min-h-[520px] flex-col">
      <header className="mb-4 flex items-center gap-3 border-b border-border pb-4">
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

      <div className="flex max-h-[520px] flex-1 flex-col gap-2.5 overflow-y-auto pr-1">
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
          <AttachmentChip key={attachment.id} attachment={attachment} conversationId={conversationId} light={mine} toast={toast} />
        ))}
        <div className="mt-1.5 text-xs opacity-70">{formatTime(message.createdAt)}</div>
      </div>
      {seen ? <span className="mt-0.5 text-[11px] text-muted">Seen</span> : null}
    </div>
  );
}

function AttachmentChip({
  attachment,
  conversationId,
  light,
  toast,
}: {
  attachment: MessageAttachment;
  conversationId: string;
  light: boolean;
  toast: ToastFn;
}) {
  const [opening, setOpening] = useState(false);

  async function download() {
    setOpening(true);
    const result = await attachmentDownloadUrlAction(conversationId, attachment.id);
    setOpening(false);
    if (result.ok) window.open(result.data, "_blank", "noopener,noreferrer");
    else toast({ msg: result.message, title: "Could not open file", tone: "danger" });
  }

  return (
    <button
      className={`mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs ${light ? "bg-white/15" : "bg-white"}`}
      disabled={opening}
      onClick={download}
      type="button"
    >
      <Icon name="file" size={14} />
      <span className="min-w-0 flex-1 truncate font-medium">{attachment.fileName}</span>
      <span className="opacity-70">{opening ? "Opening..." : formatFileSize(attachment.sizeBytes)}</span>
      <Icon name="download" size={13} />
    </button>
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
    <div className="mt-4 border-t border-border pt-4">
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

      <div className="flex items-end gap-2">
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
          placeholder="Write a message... (Enter to send, Shift+Enter for a new line)"
          rows={1}
          value={body}
        />
        <Btn disabled={!canSend} icon="send" loading={send.isPending} loadingLabel="Sending" onClick={submit}>
          Send
        </Btn>
      </div>
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
