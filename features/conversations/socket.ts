"use client";

import { io, type Socket } from "socket.io-client";

/**
 * One Socket.IO connection to the backend's `/conversations` namespace,
 * shared by every screen while the app is open. The browser never holds the
 * backend token: each (re)connection fetches a single-use 60-second ticket
 * from our own server and hands that to the socket.
 */
let socket: Socket | null = null;
let holders = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryAttempt = 0;

/** Where the backend listens for sockets; it sits under /api so one proxy rule covers REST and sockets. */
const SOCKET_PATH = "/api/socket.io";

/** Refusals that will not change by retrying: the account simply may not connect. */
const FINAL_REJECTIONS = new Set(["ROLE_NOT_ALLOWED", "ORIGIN_NOT_ALLOWED", "NAMESPACE_UNKNOWN"]);

function backendOrigin() {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ?? "";
}

/** True when the page can receive live updates; otherwise screens fall back to periodic refreshes. */
export function liveMessagingAvailable() {
  return Boolean(backendOrigin());
}

async function fetchTicket(): Promise<string> {
  const response = await fetch("/api/conversations/socket-ticket", { credentials: "same-origin", method: "POST" });
  if (!response.ok) throw new Error(`Socket ticket request failed with status ${response.status}`);

  const payload = (await response.json()) as { ticket?: string };
  if (!payload.ticket) throw new Error("Socket ticket missing from response");

  return payload.ticket;
}

/**
 * A refused handshake (no ticket, expired ticket, server restart mid-auth)
 * stops Socket.IO's own reconnection, so it is retried here with a capped
 * back-off. Final refusals (wrong role, wrong origin) are not retried.
 */
function scheduleRetry(current: Socket, reason: string) {
  if (FINAL_REJECTIONS.has(reason) || retryTimer || current !== socket) return;

  retryAttempt += 1;
  const delay = Math.min(30_000, 1000 * 2 ** Math.min(retryAttempt, 5));

  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (current === socket && !current.connected) current.connect();
  }, delay);
}

/** Returns the shared socket, connecting on first use. Null when the backend origin is not configured. */
export function acquireConversationSocket(): Socket | null {
  holders += 1;

  if (!liveMessagingAvailable()) {
    if (holders === 1) console.warn("NEXT_PUBLIC_API_URL is not set; live messaging is off, so conversations refresh every 30 seconds instead.");
    return null;
  }

  if (!socket) {
    const created = io(`${backendOrigin()}/conversations`, {
      // Called on every connection attempt, so a reconnect always carries a fresh ticket.
      auth: (callback) => {
        fetchTicket()
          .then((ticket) => callback({ ticket }))
          .catch(() => callback({}));
      },
      path: SOCKET_PATH,
      reconnectionDelayMax: 10_000,
      transports: ["websocket", "polling"],
      // If WebSocket is blocked (some school networks), fall back to long-polling instead of giving up.
      tryAllTransports: true,
      withCredentials: false,
    });

    created.on("connect", () => {
      retryAttempt = 0;
    });
    created.on("connect_error", (error) => {
      const code = (error as Error & { data?: { code?: string } }).data?.code ?? error.message;
      if (!created.active) scheduleRetry(created, code);
    });
    // The backend closes a socket whose credential expired; the next connect fetches a fresh ticket.
    created.on("auth:expired", () => {
      if (created === socket) created.connect();
    });

    socket = created;
  }

  return socket;
}

/** Drops a holder; the connection closes once nothing on the page needs it. */
export function releaseConversationSocket() {
  holders = Math.max(0, holders - 1);

  if (holders === 0 && socket) {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    retryAttempt = 0;
    socket.disconnect();
    socket = null;
  }
}

/** Tells the other person in a thread that the user is (or stopped) typing. Silently ignored when offline. */
export function emitTyping(conversationId: string, typing: boolean) {
  socket?.emit("typing", { conversationId, typing });
}
