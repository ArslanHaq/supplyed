# SupplyEd React Native Notifications Integration

Audited on **8 October 2026** against:

- the notification implementation in the SupplyEd web repository on branch `feat/reflow`, base revision `660576c39b6dc8e8365ea9048cc46c50d172d984`;
- the supplied backend document **“SupplyEd notification APIs: complete flow”**.

The backend repository is not present in this workspace, so backend internals in this guide are based on the supplied backend contract rather than an independent source-code audit. The website files listed in [Website source map](#website-source-map) were inspected directly.

This document is the implementation contract for adding notifications to the React Native app for both marketplace roles:

- instructor/teacher;
- institution/school.

Admin behavior is documented where it differs, but the primary mobile scope is instructor and institution.

## Non-negotiable architecture decisions

1. React Native calls the Nest backend directly at `{API_ORIGIN}/api`. It must not call the website’s Next.js `/api/notifications/*` routes or server actions.
2. REST is the durable source of truth for the notification list, unread count, read state, and email preferences.
3. Socket.IO is a live update signal, not a durable notification queue. Reconcile with REST after startup, foregrounding, and reconnecting.
4. Use the normal JWT access token for the native Socket.IO connection. Socket tickets are a website-only security mechanism.
5. In-app notifications cannot be disabled. The three preferences control email only.
6. Message unread counts and notification unread counts are different stores and different badges. A delayed unread-message email does not create a notification inbox row.
7. There is currently no APNs, FCM, Expo Notifications, device-token endpoint, or backend push worker. Do not describe the Socket.IO or browser `Notification` API as native push.
8. Treat the server-provided internal `link` as the primary navigation instruction, but validate it and translate it into a native route. Never open an arbitrary external URL from this field.

## Delivery channels

| Channel | Durable | Works while native app is terminated | User preference | Implementation |
| --- | --- | --- | --- | --- |
| In-app notification inbox | Yes | Data remains on server and loads next launch | Always enabled | Notification REST APIs |
| Live in-app update | No | No | Always enabled for connected marketplace users | Socket.IO `notification` and `notification:count` |
| Email | External delivery | Yes | Optional by category; some mandatory | Backend email queue/workers |
| Native OS push | No current implementation | No | None | Requires future backend and mobile work |
| Website desktop alert | Browser only | Not applicable to native | Browser permission | Web `Notification` API while the page is hidden |

The native app can show an in-app banner when it receives a socket event while active. Reliable lock-screen/background delivery requires a separate APNs/FCM project; see [Native push gap](#native-push-gap).

## API base, authentication, and envelopes

The REST base is:

```text
{API_ORIGIN}/api
```

Send the current access token on every notification request:

```http
Authorization: Bearer <access-token>
```

Store access and refresh tokens in secure device storage. Coalesce concurrent refresh attempts. On an expired access token, refresh once, replace the token, and retry a safe request once. Clear notification caches and disconnect the socket on logout or account change.

Every successful backend response wraps the endpoint result inside `data`:

```ts
export type ApiSuccess<T> = {
  success: true;
  statusCode: number;
  message: string;
  data: T;
  meta: {
    requestId: string;
    timestamp: string;
    path: string;
    method: string;
  };
};

export type ApiFailure = {
  success: false;
  statusCode: number;
  message: string | string[];
  error: string;
  data: null;
  meta: {
    requestId: string;
    timestamp: string;
    path: string;
    method: string;
  };
  code?: string;
};
```

The API helper must return `payload.data`, not the outer envelope. Preserve `meta.requestId` or the `X-Request-Id` response header in diagnostic errors.

Authentication failures include:

| Code | Meaning | Native response |
| --- | --- | --- |
| `AUTH_TOKEN_MISSING` | No bearer token | Try only if a token was accidentally omitted; otherwise sign in |
| `ACCESS_TOKEN_EXPIRED` | Access token expired | Refresh, replace token, retry once |
| `INVALID_ACCESS_TOKEN` | Invalid token or wrong token type | Clear session and sign in again |

The backend rejects unknown DTO fields and invalid values with `400`. Send JSON booleans as booleans, never as `"true"` or `"false"`.

## Public data contracts

```ts
export type NotificationType =
  | "JOB_MATCH"
  | "APPLICATION_RECEIVED"
  | "APPLICATION_STATUS"
  | "BOOKING_CONFIRMED"
  | "BOOKING_CANCELLED"
  | "BOOKING_COMPLETED"
  | "INVOICE_PAID"
  | "PROFILE_STATUS"
  | "REVIEW_RECEIVED";

export type SupplyEdNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export type NotificationPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
};

export type NotificationPage = {
  notifications: SupplyEdNotification[];
  pagination: NotificationPagination;
  unreadCount: number;
};

export type NotificationPreferences = {
  emailJobMatches: boolean;
  emailMessages: boolean;
  emailUpdates: boolean;
};

export type NewNotificationEvent = {
  notification: SupplyEdNotification;
  unreadCount: number;
};

export type NotificationCountEvent = {
  unreadCount: number;
};
```

`readAt === null` means unread. Dates are ISO 8601 strings. Internal queue fields such as `emailStatus`, `emailAttempts`, and `emailError` are intentionally private and must not be expected by clients.

Keep rendering forward-compatible. If the backend later adds a notification type, show a default bell icon instead of failing validation or dropping the row.

## REST endpoint summary

All paths below are relative to `{API_ORIGIN}/api` and require authentication.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/notifications` | Newest-first notification pages |
| `GET` | `/notifications/unread-count` | Notification badge total |
| `POST` | `/notifications/read-all` | Mark all owned unread rows read |
| `GET` | `/notifications/preferences` | Read email preferences |
| `PATCH` | `/notifications/preferences` | Patch one or more email preferences |
| `POST` | `/notifications/:notificationId/read` | Mark one owned notification read |

These endpoints are user-scoped by the JWT. Never send a user ID, and never accept a user ID from UI state for these operations.

### List notifications

```http
GET /api/notifications?page=1&limit=20
Authorization: Bearer <access-token>
```

Optional unread-only page:

```http
GET /api/notifications?page=1&limit=20&unread=true
```

Rules:

- pages are one-based;
- `page` defaults to `1` and must be at least `1`;
- `limit` defaults to `20` and must be from `1` through `100`;
- only `unread=true` filters to unread rows;
- `unread=false` and omitting `unread` both return read and unread rows;
- string values such as `1`, `yes`, and an empty `unread` fail validation;
- order is `createdAt DESC`, then `id DESC`, which provides stable newest-first paging;
- `pagination.total` applies to the current filter;
- `unreadCount` is the user’s total unread count across every page, even when the current page is filtered.

Example unwrapped `data`:

```json
{
  "notifications": [
    {
      "id": "7b4571d5-645f-43d4-a150-8aa9119185e0",
      "type": "JOB_MATCH",
      "title": "New job match: Year 6 Maths cover",
      "body": "Oakfield Primary · Leeds · 92% match · From 3 Nov 2026 · £180 a day",
      "link": "/job-detail?jobId=1ecfbe83-c36d-4588-a565-af94614d43ad",
      "data": {
        "jobId": "1ecfbe83-c36d-4588-a565-af94614d43ad",
        "score": 92
      },
      "readAt": null,
      "createdAt": "2026-10-08T09:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1,
    "hasNextPage": false
  },
  "unreadCount": 3
}
```

For infinite scrolling, fetch `page + 1` only when `hasNextPage` is true. Dedupe by notification ID when combining REST pages and socket events.

### Get unread count

```http
GET /api/notifications/unread-count
Authorization: Bearer <access-token>
```

Unwrapped data:

```json
{ "total": 3 }
```

This call does not emit a socket event. Use it at authenticated startup, after reconnect/foreground reconciliation, and when recovering from an uncertain local cache.

### Mark one notification read

```http
POST /api/notifications/7b4571d5-645f-43d4-a150-8aa9119185e0/read
Authorization: Bearer <access-token>
```

There is no request body. The unwrapped response is the complete updated notification.

Behavior:

- the backend updates only a row matching the ID, current JWT user, and `readAt IS NULL`;
- an unowned or nonexistent ID returns `404 Notification not found`;
- an already-read notification is returned unchanged;
- the operation is idempotent;
- the backend emits `notification:count` to every connected socket for this user after the read flow.

The UI may optimistically set `readAt` and decrement the cached badge, bounded at zero. On error, restore the previous row/count or refetch the list and count. Navigation does not need to wait for this request to finish.

### Mark all notifications read

```http
POST /api/notifications/read-all
Authorization: Bearer <access-token>
```

There is no request body. Unwrapped data:

```json
{ "updated": 3 }
```

Behavior:

- only unread rows owned by the current user change;
- every changed row receives the same server timestamp;
- if rows changed, the backend recounts and emits `notification:count`;
- a repeated call returns `{ "updated": 0 }` and does not emit another count event;
- the operation is idempotent.

Optimistically mark every loaded row read and set the badge to zero. Refetch on failure.

### Get email preferences

```http
GET /api/notifications/preferences
Authorization: Bearer <access-token>
```

Unwrapped data:

```json
{
  "emailJobMatches": true,
  "emailMessages": true,
  "emailUpdates": true
}
```

If the user has no preference row, the backend returns all three defaults as `true` without requiring a database insert.

### Update email preferences

Patch only the switch that changed:

```http
PATCH /api/notifications/preferences
Authorization: Bearer <access-token>
Content-Type: application/json

{ "emailUpdates": false }
```

All fields are optional, but any supplied value must be a JSON boolean. Unknown fields and strings such as `"false"` are rejected. The response contains the complete saved preference object.

The backend upserts preferences:

- first patch creates a row, using `true` defaults for omitted settings;
- later patches update only supplied fields;
- an optional email already queued is checked against the latest preferences again before sending, so turning a setting off can still suppress it.

## Preference UI for both users

The settings screen controls email only. Include explanatory copy that all events still appear in the in-app notification inbox and that payment/account emails always send when the address is verified.

### Instructor/teacher settings

Show all three switches:

| Switch | Field | Meaning |
| --- | --- | --- |
| Job matches | `emailJobMatches` | Strong job-match email alerts; threshold normally 80%; maximum three per rolling 24 hours |
| Unread messages | `emailMessages` | Delayed reminders when a conversation remains unread |
| Applications and bookings | `emailUpdates` | Shortlists, interviews, rejections, and booking confirmation/cancellation |

### Institution/school settings

Show these two switches:

| Switch | Field | Meaning |
| --- | --- | --- |
| Unread messages | `emailMessages` | Delayed reminders when a conversation remains unread |
| Bookings | `emailUpdates` | Booking confirmation and cancellation emails |

Do not show `emailJobMatches` to an institution. The API still returns the field because both roles share one contract.

Recommended switch behavior:

1. Load all preferences when the settings screen opens.
2. Display a skeleton or disabled controls until the first load resolves.
3. On toggle, patch only that key.
4. Optimistically display the new value while saving.
5. Disable repeated changes to the same switch or serialize preference mutations to prevent out-of-order responses.
6. Replace local preferences with the complete server response.
7. Roll back/refetch and show an error if saving fails.

## Which business actions create notifications

Clients cannot create arbitrary notification rows. Business endpoints and backend workers create them as side effects.

| Type | Trigger | Recipient | In app | Email | Link/data |
| --- | --- | --- | --- | --- | --- |
| `JOB_MATCH` | Match-alert worker processes a live job | Up to 50 strongest eligible teachers at/above the threshold | Yes | Optional: `emailJobMatches`; max 3 per teacher per rolling 24h | `/job-detail?jobId=...`; `{ jobId, score }` |
| `APPLICATION_RECEIVED` | `POST /applications` | Institution user who posted the job | Yes | No | `/applications?jobId=...&applicationId=...`; `{ applicationId, jobId }` |
| `APPLICATION_STATUS` | Status changes to `VIEWED`, `SHORTLISTED`, `INTERVIEW`, or `REJECTED` | Applicant/teacher | Yes | `VIEWED`: no; others optional through `emailUpdates` | Applications route, or messaging for interview; `{ applicationId, jobId, status }` |
| `BOOKING_CONFIRMED` | Application changes to `HIRED` | Teacher and institution | Yes | Optional through `emailUpdates` for both | `/bookings`; `{ applicationId, jobId, bookingId }` |
| `BOOKING_CANCELLED` | Booking cancellation | Other party; both parties for an admin cancellation | Yes | Optional through `emailUpdates` | `/bookings`; `{ bookingId }` |
| `BOOKING_COMPLETED` | Booking completion | Teacher | Yes | No | `/bookings`; `{ bookingId }` |
| `INVOICE_PAID` | Stripe webhook/invoice sync first changes invoice to paid | Teacher | Yes | Mandatory | `/billing`; `{ invoiceId }` |
| `PROFILE_STATUS` | Admin changes status to `ACTIVE`, `REJECTED`, or `SUSPENDED` | Profile owner | Yes | Mandatory | `/dashboard` or `/settings`; `{ status }` |
| `REVIEW_RECEIVED` | `POST /reviews` | Reviewed person or institution | Yes | No | Reviewed profile; `{ reviewId, rating }` |

Important trigger details:

- changing an application to `HIRED` creates `BOOKING_CONFIRMED`, not `APPLICATION_STATUS`;
- changing an application to `VIEWED` creates an in-app notification but no email;
- a no-show currently creates no notification;
- notification failures are logged and swallowed so they do not roll back the business action;
- titles are limited to 200 characters and bodies to 1,000 characters before insertion;
- most event types use a `dedupeKey`, preventing duplicate rows during retries or repeat webhook/worker handling.

### Recipient view by role

An instructor can receive:

- job matches;
- application status changes;
- booking confirmations, cancellations, and completions;
- paid-invoice notices;
- instructor profile-status changes;
- reviews received.

An institution can receive:

- new applications for jobs it posted;
- booking confirmations and cancellations;
- institution profile-status changes;
- reviews received.

Conversation message reminders are email-only and belong to the messaging flow, not the notification inbox.

## Email rules and worker behavior

### Optional versus mandatory

| Email category | Preference | Mandatory? |
| --- | --- | --- |
| Job match | `emailJobMatches` | No |
| Delayed unread message | `emailMessages` | No |
| Shortlist/interview/rejection | `emailUpdates` | No |
| Booking confirmed/cancelled | `emailUpdates` | No |
| Invoice paid | None | Yes |
| Profile/account status | None | Yes |

All email categories, including mandatory ones, require a verified email address.

An event email is queued only when:

1. the recipient still exists;
2. the recipient email is verified;
3. the relevant optional preference is enabled, unless the email is mandatory;
4. any per-type cap has not been reached.

The in-app row is still created when an optional email is disabled or the address is unverified. Eligible rows begin with private `emailStatus = PENDING`; ineligible rows use private `emailStatus = NONE`.

### Delayed unread-message reminder

`emailMessages` does not control notification inbox rows. When a new message remains unread:

- the backend arms a reminder, normally due after 15 minutes;
- the worker sends only if messages still remain unread;
- the current email address must still be verified;
- `emailMessages` must still be enabled;
- cooldown is one email per conversation/person per hour.

Use the separate conversations unread-count API for the message badge. Never add that count to the notification badge.

### Notification email worker

The backend worker:

- polls every 15 seconds;
- claims up to 20 due emails with database row locking for concurrent workers;
- rechecks verification and the latest preference before sending;
- marks disabled or unverified queued messages `SKIPPED`;
- retries failures with increasing delays up to five attempts;
- releases `SENDING` jobs locked for more than 10 minutes;
- marks exhausted jobs `FAILED`.

`FRONTEND_URL` turns an internal notification path into the full button URL in an email. This currently targets the website, not a native deep link.

## Socket.IO live delivery

Notifications share the conversations socket; create only one app-level connection.

```text
origin:    API_ORIGIN (without /api)
namespace: /conversations
path:      /api/socket.io
version:   Socket.IO 4.8-compatible client
```

Supported socket roles are instructor and institution. Admin can use notification REST APIs but cannot connect to this namespace. Maximum concurrent sockets are 10 per user.

Native connection:

```ts
import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function connectSupplyEdSocket(apiOrigin: string, accessToken: string) {
  socket?.disconnect();
  socket = io(`${apiOrigin.replace(/\/+$/, "")}/conversations`, {
    path: "/api/socket.io",
    auth: { token: accessToken },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelayMax: 10_000,
  });
  return socket;
}
```

Do not call `/conversations/socket-ticket` from native. The website uses a 60-second single-use ticket so its backend access token never enters browser JavaScript. Native already owns its access token securely and sends `auth: { token }`.

### Server events

```ts
socket.on("ready", ({ userId }: { userId: string }) => {});

socket.on("notification", (event: NewNotificationEvent) => {});

socket.on("notification:count", (event: NotificationCountEvent) => {});

socket.on("auth:expired", ({ code }: { code: string }) => {});
```

`ready` means authentication succeeded and the private user room is joined. On the first `ready`, normal startup REST loads may already be running. On later `ready` events, refetch the first notification page and unread count because events may have been missed while offline.

For `notification`:

1. validate/normalize the notification without rejecting unknown future types;
2. set the badge to the event’s absolute `unreadCount`—do not increment locally;
3. insert at the top of page one if the ID is not already present;
4. maintain the configured page-size boundary;
5. optionally show an in-app banner while the app is active;
6. never count the socket echo twice.

For `notification:count`:

1. replace the badge with the absolute `unreadCount`;
2. mark cached list data stale or refetch visible pages, because the event does not identify which notification changed.

For `auth:expired`:

1. refresh the access token through the shared auth manager;
2. replace `socket.auth` with `{ token: newAccessToken }`;
3. reconnect;
4. if refresh fails, disconnect, clear private caches, and return to sign-in.

The backend event hub is currently process-local. Multiple API instances require a shared Socket.IO adapter/broker such as Redis. Without it, REST remains correct but an event created on one process may not reach a socket connected to another.

## Recommended native state flow

### Authenticated app startup

1. Restore/refresh the session.
2. Start `GET /notifications/unread-count`.
3. Connect the shared conversations socket with the current access token.
4. Subscribe once to notification events at app scope, not once per screen.
5. Load the first notification page only when the notification screen or preview actually needs it.

### App foreground

Refetch the unread count. If the notification screen is mounted, also refetch its first page. A socket may have been suspended by the OS while the app was backgrounded.

### Open notification screen

1. Fetch page one with a consistent page size such as 20.
2. Set the badge from `NotificationPage.unreadCount`.
3. Render newest first.
4. Load later pages only while `hasNextPage` is true.
5. Dedupe by `id` across pages and socket inserts.
6. On pull-to-refresh, replace page one and discard/revalidate later pages so boundaries cannot overlap.

### Select one notification

1. Validate and resolve its internal link.
2. Optimistically set `readAt` locally and reduce the badge by one if it was unread.
3. Start `POST /notifications/:id/read`.
4. Navigate immediately when a valid destination exists.
5. Replace the cached row with the response.
6. Roll back/refetch if the mutation fails.

### Mark all read

1. Optimistically set every loaded row read and badge zero.
2. Call `POST /notifications/read-all`.
3. Retain the optimistic state after success, regardless of `updated` being zero.
4. Refetch list/count on failure.

### Logout or account switch

1. Disconnect the shared socket.
2. Remove all notification and conversation query data from memory and persisted cache.
3. Remove the previous user’s tokens.
4. Do not show cached rows while the next user session is resolving.

## Native navigation from notification links

The backend currently sends website-style internal paths. Parse them as data and map them to native screens. Accept only paths beginning with one `/` and reject protocol-relative values beginning with `//`.

```ts
type NotificationDestination =
  | { screen: "JobDetail"; params: { jobId: string } }
  | { screen: "Applications"; params?: { applicationId?: string; jobId?: string } }
  | { screen: "Conversation"; params: { applicationId: string } }
  | { screen: "Bookings"; params?: { bookingId?: string } }
  | { screen: "Billing"; params?: { invoiceId?: string } }
  | { screen: "Dashboard" }
  | { screen: "Settings" }
  | { screen: "TeacherProfile"; params: { teacherId: string } }
  | { screen: "InstitutionProfile"; params: { institutionId: string } }
  | { screen: "Notifications" };

function stringValue(data: Record<string, unknown>, key: string) {
  return typeof data[key] === "string" && data[key] ? data[key] : undefined;
}

export function notificationDestination(
  item: SupplyEdNotification,
): NotificationDestination {
  if (!item.link || !item.link.startsWith("/") || item.link.startsWith("//")) {
    return { screen: "Notifications" };
  }

  const url = new URL(item.link, "https://native.invalid");
  const query = (key: string) => url.searchParams.get(key) || undefined;

  switch (url.pathname) {
    case "/job-detail": {
      const jobId = query("jobId") ?? stringValue(item.data, "jobId");
      return jobId ? { screen: "JobDetail", params: { jobId } } : { screen: "Notifications" };
    }
    case "/applications":
      return {
        screen: "Applications",
        params: {
          applicationId: query("applicationId") ?? stringValue(item.data, "applicationId"),
          jobId: query("jobId") ?? stringValue(item.data, "jobId"),
        },
      };
    case "/messaging": {
      const applicationId = query("applicationId") ?? stringValue(item.data, "applicationId");
      return applicationId ? { screen: "Conversation", params: { applicationId } } : { screen: "Notifications" };
    }
    case "/bookings":
      return { screen: "Bookings", params: { bookingId: stringValue(item.data, "bookingId") } };
    case "/billing":
      return { screen: "Billing", params: { invoiceId: stringValue(item.data, "invoiceId") } };
    case "/dashboard":
      return { screen: "Dashboard" };
    case "/settings":
      return { screen: "Settings" };
    case "/teacher-profile": {
      const teacherId = query("teacherId");
      return teacherId ? { screen: "TeacherProfile", params: { teacherId } } : { screen: "Notifications" };
    }
    case "/institution-profile": {
      const institutionId = query("institutionId");
      return institutionId ? { screen: "InstitutionProfile", params: { institutionId } } : { screen: "Notifications" };
    }
    default:
      return { screen: "Notifications" };
  }
}
```

The server link is the primary route contract. `data` is a useful fallback and lets native open a more focused booking/invoice screen if one exists, but do not invent access from IDs: every destination screen must still fetch through authorized APIs.

For `/messaging?applicationId=...`, use the conversations API to open/create the exact application conversation before entering the chat screen. Do not interpret an application ID as a conversation ID.

## Suggested React Query shape

```ts
export const notificationKeys = {
  all: ["notifications"] as const,
  list: (filters: { unread?: boolean }) => ["notifications", "list", filters] as const,
  unread: ["notifications", "unread"] as const,
  preferences: ["notifications", "preferences"] as const,
};
```

Recommended cache rules:

- `notification` socket event: set unread total, prepend/dedupe page one;
- `notification:count`: set unread total, invalidate visible notification pages;
- mark-one mutation: optimistically patch that ID across all loaded list filters;
- mark-all mutation: optimistically patch every loaded list and set total zero;
- preference mutation: send one key, then replace cache with complete server result;
- reconnect/foreground: invalidate unread count and page one;
- logout: remove every key under `notificationKeys.all`.

Do not persist notification content unencrypted in AsyncStorage. If offline persistence is required, use an encrypted store, scope it by user ID, expire it, and erase it on logout.

## Display guidance

Type-to-icon suggestions matching the website:

| Type | Icon idea |
| --- | --- |
| `JOB_MATCH` | lightning/zap |
| `APPLICATION_RECEIVED` | users |
| `APPLICATION_STATUS` | document/file |
| `BOOKING_CONFIRMED` | check circle |
| `BOOKING_CANCELLED` | x/cancel |
| `BOOKING_COMPLETED` | check |
| `INVOICE_PAID` | pound/payment |
| `PROFILE_STATUS` | shield |
| `REVIEW_RECEIVED` | star |
| Unknown future type | bell |

Show:

- title;
- body;
- relative time, falling back to a localized absolute date;
- unread styling and an accessible unread label;
- a badge capped visually at `99+`, while retaining the real integer in state.

Do not render notification body/title as HTML. Treat both as plain text.

## Native push gap

The current repository contains no:

- device-token registration API;
- APNs or FCM credential/configuration;
- Expo push integration;
- backend device table;
- push queue/worker;
- notification-open payload contract;
- token rotation or logout cleanup flow.

Socket.IO is generally active only while the React Native process is alive and connected. Email may arrive while the app is closed, but it is not a push substitute.

If native push is required, implement it as a separate project:

1. Add authenticated register/update/delete device endpoints.
2. Store platform, installation ID, push token, user ID, last-seen timestamp, and enabled state.
3. Rotate tokens safely and delete/disable them on logout or provider invalidation.
4. Enqueue push alongside successful notification creation, after database commit.
5. Put only minimal IDs/type/navigation data in the provider payload; fetch private content after auth.
6. Define foreground, background, terminated, and notification-tap behavior.
7. Reconcile via REST on open even when launched from push.
8. Add a separate push preference contract if product wants push categories. Do not reuse email preference fields implicitly.

Until that work exists, do not request native notification permission merely to implement the current REST/Socket.IO inbox.

## Backend operations and retention

Useful backend environment variables from the supplied contract:

| Variable | Purpose | Default/current behavior |
| --- | --- | --- |
| `FRONTEND_URL` | Website URLs in email buttons and allowed browser socket origin | Buttons may be omitted when absent |
| `CORS_ORIGINS` | Additional browser socket origins | Empty |
| `NOTIFICATION_WORKERS_ENABLED` | Enables notification background workers | Enabled unless set to `false` |
| `JOB_MATCH_NOTIFY_MIN_SCORE` | Job-match threshold from 1–100 | `80` |
| `MESSAGE_EMAIL_DELAY_MINUTES` | Unread-message email delay from 1–1,440 minutes | `15` |
| `SOCKET_SESSION_RECHECK_MS` | Connected-account revalidation interval | `300000` (5 minutes) |

A daily cleanup at 3:00 AM in the application process timezone retains:

- read notifications for 90 days;
- unread notifications for 365 days.

The app must not assume an infinite history.

## Failure and race-condition rules

- A socket event can arrive before the first REST page. Store the absolute badge count and either retain the event for page-one merge or let the REST fetch reconcile it.
- The same notification can arrive through REST and Socket.IO. Dedupe by `id`.
- Mark-read responses and `notification:count` events can arrive in either order. Treat count events as absolute values.
- Multiple devices can mark the same row read. Both mark-one and mark-all are idempotent.
- After a timeout on a read mutation, refetch before presenting a persistent failure; the server may already have applied it.
- Never decrement below zero.
- Refreshing an access token does not update an existing socket automatically. Replace socket auth and reconnect.
- Do not reconnect indefinitely for final role/namespace rejection. Surface the inbox through REST even if live delivery is unavailable.
- REST errors must not erase already-rendered cached rows; show a retry state and retain known data where appropriate.

## Acceptance checklist

### REST and state

- [ ] Native calls `{API_ORIGIN}/api/notifications`, not the website origin.
- [ ] The API helper unwraps `data` and records the request ID on errors.
- [ ] Page, limit, and unread values use the exact backend contract.
- [ ] Infinite pages remain newest first and dedupe by ID.
- [ ] Startup/foreground fetches the notification unread count.
- [ ] Mark-one is optimistic, idempotent, and rolls back/refetches on failure.
- [ ] Mark-all sets loaded rows read and badge zero, then recovers on failure.
- [ ] Logout/account switch clears all private notification state.

### Socket

- [ ] One shared `/conversations` socket is used for messaging and notifications.
- [ ] Native authenticates with `{ token: accessToken }`, never a browser ticket.
- [ ] `notification` inserts/dedupes and replaces the badge with `unreadCount`.
- [ ] `notification:count` replaces the badge and invalidates visible rows.
- [ ] Reconnect and app foreground trigger REST reconciliation.
- [ ] `auth:expired` refreshes, replaces socket auth, and reconnects.
- [ ] Socket absence/failure does not prevent REST notification use.

### Settings and email semantics

- [ ] Teacher sees job match, unread message, and application/booking email switches.
- [ ] Institution sees unread message and booking email switches.
- [ ] Each change patches a JSON boolean for only the changed key.
- [ ] Copy states that in-app notifications remain enabled.
- [ ] Copy states that verified-email payment/account messages are mandatory.
- [ ] Message email preference is not presented as a notification-inbox preference.

### Navigation and safety

- [ ] Only a single-slash internal `link` is accepted.
- [ ] Website-style paths map to native screens and typed IDs.
- [ ] Missing/invalid IDs fall back safely to the notification screen.
- [ ] Unknown notification types render with a default icon.
- [ ] Title/body render as plain text.

### Test scenarios for both roles

- [ ] Institution receives `APPLICATION_RECEIVED` after an instructor applies.
- [ ] Instructor receives each supported application-status notification.
- [ ] Both users receive `BOOKING_CONFIRMED` on hire.
- [ ] Correct recipients receive user/admin booking cancellations.
- [ ] Teacher receives booking completion and invoice-paid notifications.
- [ ] Both profile-owner types receive account-status changes.
- [ ] Both review-recipient types receive review notifications.
- [ ] Turning off each optional email suppresses email but not the inbox row.
- [ ] Mandatory invoice/profile email ignores optional preferences but requires verified email.
- [ ] Unverified email still receives the in-app row and no email.
- [ ] A disconnected device reconciles missed events after reconnect.
- [ ] Two devices stay consistent after mark-one and mark-all.
- [ ] No native push is claimed or requested in the current release.

## Website behavior to understand, not copy literally

The website uses a backend-for-frontend pattern:

- browser reads call local Next.js routes such as `/api/notifications`;
- server actions perform mark-read, mark-all, and preference mutations;
- the Next.js server owns backend access/refresh tokens;
- the browser obtains a 60-second single-use socket ticket;
- React Query stores lists, preferences, and badge counts;
- a browser desktop alert appears only when permission is granted and the document is hidden.

React Native differs:

- it calls the Nest API directly;
- it owns tokens in secure device storage;
- it gives the normal access token directly to Socket.IO;
- it must not use the browser `Notification` API;
- it must not call `/conversations/socket-ticket`;
- it must not copy Next.js server actions or cookie-session behavior.

## Website source map

| File | Responsibility |
| --- | --- |
| `features/notifications/types.ts` | Public notification, pagination, preference, and socket payload types |
| `features/notifications/schemas.ts` | Runtime normalization and safe internal-link filtering |
| `features/notifications/queries.ts` | Server-side list, count, and preference reads |
| `features/notifications/actions.ts` | Read-one, read-all, and preference server actions |
| `features/notifications/use-notifications.ts` | React Query paging/cache, optimistic reads, live socket events, desktop alerts |
| `components/organisms/NotificationBell.tsx` | Badge, dropdown list, load-more, mark-read/all, email-settings entry |
| `components/organisms/NotificationSettings.tsx` | Role-specific optional email switches |
| `features/conversations/socket.ts` | Shared website Socket.IO connection and single-use ticket refresh |
| `components/organisms/AppChrome.tsx` | Mounts the notification bell/live stream for signed-in workspaces |
| `components/organisms/SettingsPage.tsx` | Mounts notification settings for teacher/institution only |
| `app/api/notifications/route.ts` | Website-only list proxy |
| `app/api/notifications/unread-count/route.ts` | Website-only unread-count proxy |
| `app/api/notifications/preferences/route.ts` | Website-only preference read proxy |
| `app/api/conversations/socket-ticket/route.ts` | Website-only socket ticket proxy |
| `lib/server/api-client.ts` | Backend envelope unwrapping, bearer auth, refresh, and request IDs |
| `lib/query/keys.ts` | Website notification cache keys |

Related existing mobile handoff: [React Native Messaging and Payments Handoff](./react-native-messaging-and-payments-handoff.md). Use its conversation contract for `/messaging?applicationId=...` and for the separate unread-message badge.
