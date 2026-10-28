import type { Invitation } from "@/features/invitations/types";
import type { Conversation, ConversationParticipant } from "./types";

export type ConversationThread = {
  key: string;
  conversation: Conversation;
};
export type ConversationGroup = {
  key: string;
  person: ConversationParticipant;
  conversations: Conversation[];
  threads: ConversationThread[];
  latest: Conversation;
  unreadCount: number;
  invitations: Invitation[];
};

export function conversationPerson(conversation: Conversation): ConversationParticipant {
  return conversation.counterpart
    ?? (conversation.me === "instructor" ? conversation.participants.poster : conversation.me === "poster" ? conversation.participants.instructor : null)
    ?? { id: null, imageUrl: null, role: "teacher", name: [conversation.participants.instructor?.name, conversation.participants.poster?.name].filter(Boolean).join(" / ") || "Conversation" };
}

function timestamp(value: string | null | undefined) {
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : 0;
}

function activity(conversation: Conversation) {
  return timestamp(conversation.lastMessageAt ?? conversation.lastMessage?.createdAt ?? conversation.createdAt);
}

export function threadKind(thread: ConversationThread) {
  return thread.conversation.booking || thread.conversation.applicationId ? "Jobs" : "General";
}

export function threadTitle(thread: ConversationThread) {
  if (threadKind(thread) === "General") return "General conversation";
  const title = thread.conversation.job?.title || "Job";
  return `${thread.conversation.booking ? "Booking" : "Application"} · ${title}`;
}

export function threadCreatedAt(thread: ConversationThread) {
  return thread.conversation.createdAt;
}

/** Group by account/profile identity, never by display name. Backend conversations remain separate. */
export function groupConversationThreads(conversations: Conversation[], invitations: Invitation[] = []): ConversationGroup[] {
  const profileAccounts = new Map<string, string>();
  for (const conversation of conversations) {
    const person = conversationPerson(conversation);
    if (person.id && person.userId) profileAccounts.set(`${person.role}:${person.id}`, person.userId);
  }
  const groups = new Map<string, ConversationGroup>();
  const seen = new Set<string>();
  for (const conversation of conversations) {
    if (seen.has(conversation.id)) continue;
    seen.add(conversation.id);
    const person = conversationPerson(conversation);
    const userId = person.userId || (person.id ? profileAccounts.get(`${person.role}:${person.id}`) : undefined);
    const key = userId ? `${person.role}:user:${userId}` : person.id ? `${person.role}:profile:${person.id}` : `conversation:${conversation.id}`;
    let group = groups.get(key);
    if (!group) {
      group = { key, person, conversations: [], threads: [], latest: conversation, unreadCount: 0, invitations: [] };
      groups.set(key, group);
    }
    group.conversations.push(conversation);
    group.threads.push({ key: conversation.id, conversation });
    group.unreadCount += conversation.unreadCount;
    if (activity(conversation) > activity(group.latest)) {
      group.latest = conversation;
      group.person = person;
    }
  }
  for (const group of groups.values()) {
    const seenInvitations = new Set<string>();
    for (const invitation of invitations) {
      if (seenInvitations.has(invitation.id)) continue;
      const conversation = group.conversations.find(item =>
        item.participants.instructor?.id === invitation.instructor.id &&
        item.participants.poster?.id === invitation.institution.id,
      );
      if (conversation) {
        seenInvitations.add(invitation.id);
        group.invitations.push(invitation);
      }
    }
    group.threads.sort((a, b) => {
      const aDirect = threadKind(a) === "General";
      const bDirect = threadKind(b) === "General";
      return Number(aDirect) - Number(bDirect)
        || timestamp(threadCreatedAt(b)) - timestamp(threadCreatedAt(a))
        || a.key.localeCompare(b.key);
    });
    group.invitations.sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt));
  }
  return [...groups.values()].sort((a, b) => activity(b.latest) - activity(a.latest) || a.key.localeCompare(b.key));
}
