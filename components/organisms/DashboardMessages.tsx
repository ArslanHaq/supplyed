"use client";

import { useEffect } from "react";

import { flattenConversations, useConversations } from "@/features/conversations/use-conversations";
import type { RouteProps } from "@/types/supplyed";

import { Avatar, Btn, Tag } from "../atoms";
import { SectionLoader } from "../molecules";

export function DashboardMessages({ go }: Pick<RouteProps, "go">) {
  const query = useConversations({ limit: 3 });
  const { fetchNextPage, hasNextPage, isFetching, isError } = query;
  const seen = new Set<string>();
  const conversations = flattenConversations(query.data).filter((conversation) => {
    if (!conversation.lastMessage) return false;
    const userId = conversation.counterpart.id ?? conversation.id;
    if (seen.has(userId)) return false;
    seen.add(userId);
    return true;
  }).slice(0, 3);

  // Applications can create multiple threads with the same person.
  // Only load another small page when needed to find three different people.
  useEffect(() => {
    if (conversations.length < 3 && hasNextPage && !isFetching && !isError) {
      void fetchNextPage();
    }
  }, [conversations.length, hasNextPage, isFetching, isError, fetchNextPage]);

  return (
    <div className="sidebar-panel overflow-hidden">
      {query.isLoading ? <div className="card-pad" role="status" aria-label="Loading messages"><SectionLoader rows={3} /></div> : null}
      {conversations.map((conversation, index) => (
        <button
          key={conversation.id}
          type="button"
          className="msg-list-item w-full text-left"
          style={{ borderBottom: index < conversations.length - 1 ? "0.5px solid var(--border)" : "none" }}
          onClick={() => go("messaging", { applicationId: conversation.applicationId })}
        >
          <Avatar name={conversation.counterpart.name} src={conversation.counterpart.imageUrl} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{conversation.counterpart.name}</div>
            <div className="truncate text-xs text-muted">
              {conversation.lastMessage?.fromMe ? "You: " : ""}
              {conversation.lastMessage?.body || (conversation.lastMessage?.hasAttachments ? "Attachment" : "Message")}
            </div>
          </div>
          {conversation.unreadCount > 0 ? <Tag>{conversation.unreadCount}</Tag> : null}
        </button>
      ))}
      {query.isError ? (
        <div className="card-pad text-center" role="alert">
          <p className="text-sm text-muted">Messages could not be loaded.</p>
          <Btn className="mt-3" size="sm" variant="secondary" onClick={() => void (query.isFetchNextPageError ? query.fetchNextPage() : query.refetch())}>Try again</Btn>
        </div>
      ) : null}
      {!query.isLoading && !query.isError && conversations.length === 0 ? (
        <div className="card-pad text-center text-sm text-muted" role="status">
          {query.hasNextPage ? "Loading messages..." : "No messages yet."}
        </div>
      ) : null}
    </div>
  );
}
