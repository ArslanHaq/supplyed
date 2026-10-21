"use client";

import { useEffect, useRef, useState } from "react";
import { flattenConversations, useConversationThreads } from "@/features/conversations/use-conversations";
import { threadKind, threadTitle, type ConversationThread } from "@/features/conversations/threads";
import type { Conversation } from "@/features/conversations/types";
import { Icon } from "../atoms";

export function ConversationThreadPicker({ id, active, onSelect }: {
  id: string;
  active: ConversationThread;
  onSelect: (conversation: Conversation) => void;
}) {
  const general = useConversationThreads(active.conversation, "GENERAL");
  const jobs = useConversationThreads(active.conversation, "JOBS");
  const kind = threadKind(active);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const fetchingMore = useRef(false);
  const choices = flattenConversations(jobs.data);
  const categories = [{ kind: "General", query: general }, { kind: "Jobs", query: jobs }] as const;

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    list.current?.querySelector<HTMLButtonElement>('[aria-selected="true"], [role="option"]')?.focus();
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  function loadMore() {
    if (!jobs.hasNextPage || jobs.isFetching || fetchingMore.current) return;
    fetchingMore.current = true;
    void jobs.fetchNextPage().finally(() => { fetchingMore.current = false; });
  }

  function choose(conversation: Conversation) {
    setOpen(false);
    onSelect(conversation);
    trigger.current?.focus();
  }

  const failedCategories = categories.filter(category => category.query.isError && !category.query.isFetchNextPageError);

  return <div ref={root} className="conversation-switcher">
    <div className="conversation-topic-tabs" role="tablist" aria-label="Conversation topics"
      onKeyDown={event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="tab"]:not(:disabled)')];
        const index = buttons.indexOf(event.target as HTMLButtonElement);
        if (index < 0) return;
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
        buttons[next]?.click();
      }}>
      {categories.map(category => {
        const first = category.query.data?.pages[0];
        const count = first?.total;
        return <button key={category.kind} id={`${id}-${category.kind}`} type="button" role="tab"
          aria-selected={kind === category.kind} aria-controls={`${id}-panel`}
          aria-label={`${category.kind}${count == null ? "" : `, ${count} conversations`}`}
          tabIndex={kind === category.kind ? 0 : -1}
          disabled={kind !== category.kind && !first?.conversations.length}
          title={count === 0 ? `No ${category.kind.toLowerCase()} conversation yet` : undefined}
          onClick={() => { if (kind !== category.kind && first?.conversations[0]) choose(first.conversations[0]); }}
          className="conversation-topic-tab">
          <span className="conversation-topic-title"><Icon name={category.kind === "General" ? "message" : "calendar"} size={16} />{category.kind}{count != null ? <span className="conversation-topic-count">{count}</span> : null}</span>
          <span className="conversation-topic-description">{category.kind === "General" ? "Messages & invitations" : "Applications & bookings"}</span>
        </button>;
      })}
    </div>
    {failedCategories.length ? <div className="conversation-picker-error" role="status"><Icon name="refresh" size={15} /><span>Conversation list unavailable. Your open chat is still available.</span><button type="button" onClick={() => { for (const category of failedCategories) void category.query.refetch(); }}>Retry</button></div> : null}
    {kind === "Jobs" ? <div className="relative mt-3"
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}
      onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
      }}>
      <label id={`${id}-thread-label`} className="conversation-picker-label" htmlFor={`${id}-thread`}>
        Application or booking <span>Newest first</span>
      </label>
      <button ref={trigger} type="button" id={`${id}-thread`} aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-choices`}
        className="conversation-picker-trigger"
        onClick={() => setOpen(value => !value)}
        onKeyDown={event => { if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); setOpen(true); } }}>
        <span className="min-w-0 truncate">{choiceLabel(active.conversation)}</span><Icon name="chevronDown" size={16} />
      </button>
      {open ? <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
        <div ref={list} id={`${id}-choices`} role="listbox" aria-labelledby={`${id}-thread-label`} aria-busy={jobs.isFetching} tabIndex={-1}
          className="max-h-64 overflow-y-auto overscroll-contain p-1"
          onScroll={event => {
            const element = event.currentTarget;
            if (element.scrollHeight - element.scrollTop - element.clientHeight < 80 && !jobs.isFetchNextPageError) loadMore();
          }}
          onKeyDown={event => {
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
            const options = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]')];
            const index = options.indexOf(event.target as HTMLButtonElement);
            event.preventDefault();
            const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : Math.max(0, Math.min(options.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)));
            options[next]?.focus();
            if (next === options.length - 1 && event.key === "ArrowDown" && !jobs.isFetchNextPageError) loadMore();
          }}>
          {choices.map(conversation => <button type="button" role="option" aria-selected={conversation.id === active.key} key={conversation.id}
            className="conversation-picker-option"
            onClick={() => choose(conversation)}>
            <span className="flex items-center justify-between gap-2"><span className="font-semibold">{threadTitle({ key: conversation.id, conversation })}</span>{conversation.id === active.key ? <Icon name="check" size={16} /> : null}</span><span className="mt-1 block text-xs text-muted">{choiceMetadata(conversation)}{conversation.unreadCount ? ` · ${conversation.unreadCount} unread` : ""}</span>
          </button>)}
        </div>
        <div className="border-t border-border px-3 py-2 text-xs text-muted" role="status">
          {jobs.isFetching ? "Loading conversations…" : jobs.isError ? <button type="button" className="text-danger underline" onClick={() => jobs.isFetchNextPageError ? loadMore() : void jobs.refetch()}>Could not load conversations. Try again</button> : jobs.hasNextPage ? <button type="button" className="w-full text-left hover:text-brand" onClick={loadMore}>Scroll for more or load more</button> : choices.length ? "All conversations loaded" : "No applications or bookings yet"}
        </div>
      </div> : null}
    </div> : null}
  </div>;
}

function choiceLabel(conversation: Conversation) {
  return [threadTitle({ key: conversation.id, conversation }), choiceMetadata(conversation)].filter(Boolean).join(" · ");
}

function choiceMetadata(conversation: Conversation) {
  const status = conversation.booking?.status ?? conversation.applicationStatus;
  const date = conversation.createdAt && Number.isFinite(Date.parse(conversation.createdAt))
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(conversation.createdAt)) : null;
  return [date, status ? status.toLowerCase().replaceAll("_", " ").replace(/^./, char => char.toUpperCase()) : null].filter(Boolean).join(" · ");
}
