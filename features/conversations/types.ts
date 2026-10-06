export type ConversationSide = "instructor" | "poster";

export type MessageAttachment = {
  contentType: string;
  fileName: string;
  id: string;
  sizeBytes: number;
};

export type ChatMessage = {
  attachments: MessageAttachment[];
  body: string;
  conversationId: string;
  createdAt: string;
  id: string;
  /** Which side sent it; null once the sender's account was deleted. */
  senderSide: ConversationSide | null;
};

export type Conversation = {
  applicationId: string;
  applicationStatus: string;
  counterpart: { id: string | null; imageUrl: string | null; name: string; role: "school" | "teacher" };
  /** Messages up to this time have been seen by the other person. */
  counterpartLastReadAt: string | null;
  createdAt: string | null;
  id: string;
  job: { id: string; title: string };
  lastMessage: { body: string; createdAt: string; fromMe: boolean; hasAttachments: boolean } | null;
  lastMessageAt: string | null;
  /** The signed-in user's side of the thread. */
  me: ConversationSide;
  /** True after the application was rejected: history stays, no new messages. */
  readOnly: boolean;
  unreadCount: number;
};

export type MessagesPage = {
  hasMore: boolean;
  /** Oldest first. */
  messages: ChatMessage[];
};

export type AttachmentUpload = {
  attachment: MessageAttachment;
  upload: { expiresAt: string; requiredHeaders: Record<string, string>; url: string };
};

export type SendMessageInput = {
  attachmentIds?: string[];
  body?: string;
  conversationId: string;
};

/** Pushed by the server over the live socket as things happen. */
export type MessageEventPayload = { conversationId: string; message: ChatMessage };
export type ReadEventPayload = { conversationId: string; readAt: string; side: ConversationSide };
export type TypingEventPayload = { conversationId: string; side: ConversationSide; typing: boolean };

/** Who is typing in a thread right now, as shown to the other person. */
export type TypingState = { side: ConversationSide; typing: boolean };
