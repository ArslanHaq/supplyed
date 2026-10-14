# SupplyEd React Native Messaging and Payments Handoff

> **Stripe source of truth:** use [Stripe Complete Verification and Mobile Handoff](./stripe-complete-verification-and-mobile-handoff.md). It contains the current full contract, known mobile parity gaps, and end-to-end verification checklist.

Audited on **6 October 2026** against:

- backend `feat/profiles-restructure` at `b2c1b914dc45cabecbeb666540aea5f946165aa4`;
- web `feat/reflow` at `d13dffb208d3f8ee9b2234825f398cecfc458ea2`.

This is the implementation contract for a React Native app using the same Nest backend as the website. Native must call the Nest API directly. Do not copy the website's Next.js `/api/*` proxies, server actions, cookie session, or browser-only Stripe components.

## Required architecture decisions

1. Use REST for conversation history, sending, read state, and attachments.
2. Use Socket.IO for live `message`, `read`, and `typing` events. Messages are still sent over REST.
3. Authenticate the native socket with the normal access token. Socket tickets are for the website.
4. A conversation belongs to one job application. To message a particular person, navigate with `applicationId`, open that application's conversation, then use the returned `conversation.id`.
5. Use Stripe's React Native SDK with the invoice payment session for current in-app payment. Keep the Stripe-hosted invoice URL as a fallback.
6. Use hosted Stripe Connect onboarding in React Native unless the mobile project deliberately adopts Stripe's native Connect components. The website's `@stripe/react-connect-js` package is not a React Native package.
7. Treat REST as truth. Socket events, payment returns, and webhooks are update signals.

## API base, auth, and response envelope

The global backend prefix is `/api`:

```text
{API_ORIGIN}/api
```

Authenticated REST requests use `Authorization: Bearer <accessToken>`. Successful payloads are under `data`:

```ts
type ApiSuccess<T> = {
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

type ApiFailure = {
  success: false;
  statusCode: number;
  message: string | string[];
  error: string;
  code?: string;
  data: null;
  meta: {
    requestId: string;
    timestamp: string;
    path: string;
    method: string;
  };
};
```

Store access and refresh tokens in secure device storage. Refresh through:

```http
POST /api/auth/refresh
Content-Type: application/json

{ "refreshToken": "..." }
```

The response includes new access/refresh tokens and their expiry timestamps. Coalesce concurrent refresh attempts. Retry an idempotent read once after refresh. For a message or financial mutation with an uncertain network result, read current state before offering another submit.

## Messaging rules

- One conversation exists per application.
- Participants are the instructor who applied and the job-posting user, normally the institution.
- The conversation is created lazily on first open.
- Instructor and institution inboxes contain only their conversations.
- Admin can read a known conversation for safeguarding, but cannot send unless actually a participant.
- `REJECTED` makes the thread read-only. History and downloads remain available.
- `Message.senderSide` can be `null` after a sender account is deleted.
- There is no arbitrary user-to-user messaging endpoint. A valid application is required.

### Where a particular chat opens

| Mobile screen | Actor | Identifier | Result |
| --- | --- | --- | --- |
| Teacher applications | Instructor | `application.id` | Exact school thread |
| Job applicants | Institution | `application.id` | Exact applicant thread |
| Booking card/detail | Either | `booking.applicationId` | Exact other-party thread |
| Inbox | Either | `conversation.id` | Existing thread |
| Job before application | Instructor | No application | No particular-person chat yet |

The website currently has a generic job-detail message button with no `applicationId`. Do not reproduce it: it can open the first inbox conversation. After applying, retain/refetch the application ID and open that application conversation.

```ts
async function openApplicationChat(applicationId: string) {
  const conversation = await api.get<Conversation>(
    `/conversations/application/${encodeURIComponent(applicationId)}`,
  );
  navigation.navigate("Conversation", {
    applicationId,
    conversationId: conversation.id,
  });
}
```

On the conversation screen, fetch the newest message page, mark read once visible, and load application/job context. Keep one shared app-level socket instead of one socket per thread.

## Messaging types

```ts
type ConversationSide = "instructor" | "poster";

type MessageAttachment = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
};

type ChatMessage = {
  id: string;
  conversationId: string;
  senderSide: ConversationSide | null;
  body: string;
  attachments: MessageAttachment[];
  createdAt: string;
};

type Conversation = {
  id: string;
  applicationId: string;
  applicationStatus:
    | "APPLIED"
    | "VIEWED"
    | "SHORTLISTED"
    | "INTERVIEW"
    | "HIRED"
    | "REJECTED";
  readOnly: boolean;
  job: { id: string; title: string };
  me: ConversationSide;
  counterpart: {
    id: string | null;
    name: string;
    imageUrl: string | null;
    role: "teacher" | "school";
  };
  lastMessage: {
    body: string;
    fromMe: boolean;
    hasAttachments: boolean;
    createdAt: string;
  } | null;
  unreadCount: number;
  counterpartLastReadAt: string | null;
  lastMessageAt: string | null;
  createdAt: string;
};

type MessagesPage = {
  messages: ChatMessage[];
  hasMore: boolean;
};
```

## Messaging REST endpoints

| Method | Path | Roles | Purpose |
| --- | --- | --- | --- |
| `GET` | `/conversations` | Instructor, institution | Inbox, newest first, maximum 200 |
| `GET` | `/conversations/unread-count` | Instructor, institution | Total unread badge |
| `POST` | `/conversations/socket-ticket` | Instructor, institution | Browser-only single-use socket ticket |
| `GET` | `/conversations/application/:applicationId` | Participant; admin read access | Open/create exact thread |
| `GET` | `/conversations/:id` | Participant or admin | Conversation summary |
| `GET` | `/conversations/:id/messages` | Participant or admin | Cursor message history |
| `POST` | `/conversations/:id/messages` | Participant instructor/institution | Send text/files |
| `POST` | `/conversations/:id/read` | Participant or admin | Mark read through now |
| `POST` | `/conversations/:id/attachments` | Participant instructor/institution | Start private upload |
| `GET` | `/conversations/:id/attachments/:attachmentId/download-url` | Participant or admin | Fresh private download URL |

Unread total response data is `{ "total": 3 }`. Unread counts include messages from the other side after this user's read timestamp. Sending advances the sender's read timestamp.

### Open/create by application

```http
GET /api/conversations/application/{applicationId}
```

Repeated or concurrent first opens settle on the same conversation. Expected failures are `404 Application not found` and `403 Only the teacher and the school on this application can message about it`.

### Load message pages

```http
GET /api/conversations/{id}/messages?limit=30
GET /api/conversations/{id}/messages?limit=30&before={oldestLoadedMessageId}
```

- `limit`: default 30, minimum 1, maximum 100.
- `before` must be a message UUID in this conversation.
- Each page is returned oldest first.
- Load older history with the first loaded message ID, prepend it, and dedupe by ID.
- Stop when `hasMore` is false.

### Send

```http
POST /api/conversations/{id}/messages
Content-Type: application/json

{
  "body": "Can you confirm the arrival time?",
  "attachmentIds": ["attachment-uuid"]
}
```

- Body is trimmed, maximum 2,000 characters.
- Maximum five unique attachments.
- Text, attachments, or both are valid.
- Empty text and no attachments returns `400`.
- A rejected application returns `403`.
- A claimed/removed attachment returns `409`; create a fresh upload.
- Insert the `201` response locally and dedupe its socket echo by message ID.

### Mark read

```http
POST /api/conversations/{id}/read
```

Participant data is `{ "readAt": "ISO date" }`. Call when the screen is focused and latest messages are visible. A non-participant admin gets `readAt: null` and does not affect participant read markers.

## Socket.IO contract

The current backend uses Socket.IO 4.8.x:

```text
origin:    API_ORIGIN
namespace: /conversations
path:      /api/socket.io
```

Do not append `/api` to the socket origin because it is already in the Socket.IO path.

Mobile authenticates with `auth: { token: accessToken }`. The website uses a 60-second, single-use ticket from `POST /conversations/socket-ticket`; native does not need a ticket.

```ts
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function connectConversationSocket(apiOrigin: string, accessToken: string) {
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

Connect after login, keep the socket across screens, reconnect with the new token after refresh, and disconnect on logout.

### Server events

```ts
type ServerEvents = {
  ready: { userId: string };
  message: { conversationId: string; message: ChatMessage };
  read: { conversationId: string; side: ConversationSide; readAt: string };
  typing: { conversationId: string; side: ConversationSide; typing: boolean };
  "auth:expired": { code: string };
};
```

- `ready`: private user room joined. Refetch inbox/unread/focused thread after reconnect.
- `message`: insert by ID, update inbox preview/order, clear typing, refresh unread.
- `read`: if the side is not `conversation.me`, update `counterpartLastReadAt`.
- `typing`: show only for the other side; auto-clear after about four seconds.
- `auth:expired`: refresh token, replace socket auth, reconnect.

### Client events

Messages are never sent through Socket.IO.

```ts
socket.emit("typing", { conversationId, typing: true }, ack => {});
socket.emit("read", { conversationId }, ack => {});
```

Ack shape is `{ ok: true }` or `{ ok: false, error, status }`. The server throttles typing starts and read writes to one per conversation per socket per second. Emit typing true at most every 1.5 seconds and false after three seconds idle, send, blur, or unmount.

Handshake codes:

- `AUTH_TOKEN_MISSING`
- `ACCESS_TOKEN_EXPIRED`
- `INVALID_ACCESS_TOKEN`
- `TICKET_ALREADY_USED`
- `ROLE_NOT_ALLOWED`
- `ORIGIN_NOT_ALLOWED`
- `NAMESPACE_UNKNOWN`
- `TOO_MANY_CONNECTIONS`

The limit is 10 sockets per account. Account validity is rechecked about every five minutes. The event hub/ticket registry are currently process-local; add a Socket.IO Redis adapter/shared ticket store before multiple backend instances.

## Attachments

Native calls the backend presigned upload directly. Do not copy the website's multipart Next.js proxy.

Allowed types: PDF, Word/DOCX, JPEG, PNG, and plain text. Maximum size is 10 MiB; maximum five per message; maximum 10 pending unsent files per user/conversation. Pending uploads expire after 24 hours.

1. Start upload:

```http
POST /api/conversations/{id}/attachments
Content-Type: application/json

{
  "fileName": "lesson-plan.pdf",
  "contentType": "application/pdf",
  "sizeBytes": 52000
}
```

2. Read:

```ts
type AttachmentUpload = {
  attachment: MessageAttachment;
  upload: {
    url: string;
    expiresAt: string;
    requiredHeaders: Record<string, string>;
  };
};
```

3. `PUT` raw bytes to `upload.url` with every returned header exactly. Do not use multipart form data for S3.
4. After PUT succeeds, send `attachment.id` with the message.

The server verifies S3 size/type when sending. Request a new attachment record after expiry/failure.

Download/preview with:

```http
GET /api/conversations/{conversationId}/attachments/{attachmentId}/download-url
```

Request a fresh URL on tap and never persist it. Use native image/PDF/text previews; show Word as a file card opened by a document viewer. Always provide an open/download/share action supported by the device.

## Conversation details and avatars

Use these endpoints for the selected thread:

```http
GET /api/applications/{conversation.applicationId}
GET /api/jobs/{conversation.job.id}
```

The application response currently contains `id`, `jobId`, `instructorId`, `status`, `coverLetter`, `createdAt`, and `updatedAt`. It does not include a nested instructor. An institution can load the detailed applicant with:

```http
GET /api/instructors/profile/{application.instructorId}
```

The conversation provides counterpart name, role, profile ID, and `imageUrl`. Render name and avatar together in the inbox, chat header, and details. If the URL is absent or fails, show initials:

```ts
function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
}
```

Examples: `Waleed` -> `W`; `Waleed Cheema` -> `WC`.

Details should show application status/date/cover letter; job title, location, dates, pay, subject and key stages; and, for institutions, applicant experience, DBS verification, subjects, skills, key stages, and rating. On phones use a details bottom sheet or screen; on tablets use a third pane.

## Messaging cache and offline rules

Recommended independent caches:

```text
conversations.list
conversations.byApplication[applicationId]
messages.byConversation[conversationId]
unread.total
typing.byConversation[conversationId]
applications.byId
jobs.byId
instructors.byId
```

- Dedupe REST and socket copies by message ID.
- If a socket message arrives before a thread has loaded, invalidate/refetch the thread.
- On `message`, refresh inbox ordering and unread total.
- On successful read, optimistically set thread unread to zero, then refresh total.
- Refetch inbox, unread, and focused messages on app foreground and socket reconnect.
- With no socket, poll inbox/focused messages every ~30 seconds and unread every ~60 seconds while foregrounded.
- Never background-poll.

## Payments: updated and previous flows

The backend now supports embedded payment sessions while retaining hosted Stripe URLs.

| Area | Current website | React Native with same backend | Previous/fallback |
| --- | --- | --- | --- |
| School pays | Payment Element via `/invoices/:id/payment-session` | Stripe React Native PaymentSheet/In-app Payment Element | Open `hostedInvoiceUrl` |
| Teacher setup | Connect embedded components via `/payments/payout-account/session` | Hosted onboarding unless native Connect is separately adopted | `/payments/payout-account/onboarding-link` |
| Payout management | Connect embedded payouts | SupplyEd balance/cash-out UI; Express dashboard when configured | `/payments/payout-account/dashboard-link` |
| Payment status | `POST /invoices/:id/sync` | Same | Same after hosted browser closes |

The older mobile guide said `GET /invoices/:id` reconciles Stripe. The current backend instead uses explicit `POST /invoices/:id/sync`. `GET /invoices/:id` returns stored detail.

## Payment endpoint matrix

| Method | Path | Roles | Purpose |
| --- | --- | --- | --- |
| `GET` | `/payments/payout-account` | Instructor | Payout readiness |
| `POST` | `/payments/payout-account/session` | Instructor | Web Connect embedded session |
| `POST` | `/payments/payout-account/onboarding-link` | Instructor | Hosted onboarding URL |
| `POST` | `/payments/payout-account/dashboard-link` | Instructor | Express Dashboard URL if available |
| `GET` | `/payments/payout-account/balance` | Instructor | Balance/destination/recent payouts |
| `POST` | `/payments/payout-account/instant-payout` | Instructor | Instant withdrawal |
| `GET` | `/payments/payout-accounts/instructor/:instructorId` | Admin | Teacher readiness lookup |
| `POST` | `/invoices` | Booking institution or admin | Create/email invoice |
| `GET` | `/invoices/me` | Instructor or institution | Own invoices |
| `GET` | `/invoices` | Admin | All invoices |
| `GET` | `/invoices/:id` | Party or admin | Stored invoice detail |
| `POST` | `/invoices/:id/payment-session` | Booking institution | Payment secrets |
| `POST` | `/invoices/:id/sync` | Party or admin | Sync Stripe status |
| `POST` | `/invoices/:id/send` | Booking institution or admin | Email again |
| `POST` | `/invoices/:id/void` | Admin | Void unpaid invoice |
| `POST` | `/invoices/:id/refund` | Admin | Full/partial refund |
| `POST` | `/payments/webhooks/stripe` | Stripe signature | Backend only; never call from app |

## Payment types

```ts
type InvoiceStatus = "PENDING" | "OPEN" | "PAID" | "VOID" | "UNCOLLECTIBLE";

type Invoice = {
  id: string;
  status: InvoiceStatus;
  booking: {
    id: string;
    jobTitle: string;
    startDate: string | null;
    endDate: string | null;
    instructor: { id: string; name: string };
    institution: { id: string; name: string };
  };
  payType: string;
  rateAmount: number; // pounds, not pence
  unitsWorked: number | null;
  teacherAmountPence: number;
  feeAmountPence: number;
  totalAmountPence: number;
  currency: string;
  poNumber: string | null;
  invoiceNumber: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  dueAt: string | null;
  paidAt: string | null;
  voidedAt: string | null;
  amountRefundedPence: number;
  disputeStatus: string | null;
  createdAt: string;
  updatedAt: string;
};

type PayoutAccount = {
  connected: boolean;
  ready: boolean;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirementsDue: string[];
  disabledReason: string | null;
};
```

Fields ending in `Pence` are integer pence. `rateAmount` is pounds.

## Booking and invoice lifecycle

1. A hired application produces a confirmed booking.
2. Institution completes the booking.
3. Institution/admin creates the invoice.
4. Backend calculates trusted amounts from booking pay details.
5. Backend creates/finalizes a Stripe invoice, stores hosted/PDF URLs, and emails the school.
6. School pays in-app or through the hosted URL.
7. Stripe routes the teacher share to the connected account and the configured application fee to SupplyEd.
8. Webhook or explicit sync updates the local invoice to `PAID`.
9. Teacher sees balance/earnings; admin can refund.

Creating or accepting a booking never charges the school.

### Create invoice

```http
POST /api/invoices
Content-Type: application/json

{
  "bookingId": "uuid",
  "unitsWorked": 4.5,
  "poNumber": "PO-2026-0412"
}
```

- Only completed bookings.
- `unitsWorked` is required for hourly/daily and omitted for fixed.
- Range 0.01-9999.99, at most two decimals.
- Daily units cannot exceed inclusive booking days; hourly cannot exceed days x 24.
- PO number optional, maximum 100 characters.
- Teacher payout account must be ready.
- One active invoice per booking. On `409`, refetch instead of blindly retrying.

Backend amount rules:

```text
teacherAmount = agreed rate x units (or fixed rate)
feeAmount     = teacherAmount x PROCESSING_FEE_PERCENT
schoolTotal   = teacherAmount + feeAmount
```

Everything is calculated in whole pence. The fee is added on top, so the teacher receives the agreed amount.

## Current React Native invoice payment

Use Stripe's official React Native SDK. References:

- https://docs.stripe.com/payments/mobile/embedded
- https://github.com/stripe/stripe-react-native

### Create session

```http
POST /api/invoices/{invoiceId}/payment-session
```

Only the booking institution can call it. The invoice must be `OPEN` or `UNCOLLECTIBLE`.

```ts
type InvoicePaymentSession = {
  clientSecret: string;
  customerSessionClientSecret: string;
  publishableKey: string;
  amountPence: number;
  currency: string;
};
```

If Stripe already shows paid/void, the endpoint applies that state and returns `409`. Sync/refetch instead of opening checkout.

### PaymentSheet

```ts
import {
  initStripe,
  PaymentSheetError,
  useStripe,
} from "@stripe/stripe-react-native";

async function payInvoice(invoiceId: string) {
  const session = await api.post<InvoicePaymentSession>(
    `/invoices/${encodeURIComponent(invoiceId)}/payment-session`,
  );

  await initStripe({
    publishableKey: session.publishableKey,
    urlScheme: "supplyed",
  });

  const { error: initError } = await initPaymentSheet({
    merchantDisplayName: "SupplyEd",
    paymentIntentClientSecret: session.clientSecret,
    returnURL: "supplyed://stripe-redirect",
    allowsDelayedPaymentMethods: false,
  });
  if (initError) throw initError;

  const { error: paymentError } = await presentPaymentSheet();
  if (paymentError?.code === PaymentSheetError.Canceled) return;
  if (paymentError) throw paymentError;

  return settleInvoice(invoiceId);
}
```

`initPaymentSheet` and `presentPaymentSheet` come from `useStripe()`. Register the URL scheme and pass incoming URLs to Stripe's `handleURLCallback`.

The backend returns `customerSessionClientSecret`, but Stripe's current React Native Customer Session examples also require `customerId`. The backend DTO does not return it. Therefore:

- with the unchanged backend, omit Customer Session fields and pay without saved-card display;
- to match web saved cards, extend the response with Stripe customer ID and pass both values using the installed SDK's exact API;
- never derive customer ID from a client secret.

### Settle

```http
POST /api/invoices/{invoiceId}/sync
```

Use a bounded loop, for example five attempts 1.5 seconds apart, only while the payment screen is active. Stop on `PAID` or `VOID`. Invalidate invoice detail/list, booking summary, and payout balance. Do not declare final success from PaymentSheet alone; if backend is not yet `PAID`, say payment is processing.

## Previous hosted invoice flow

This remains a supported fallback:

1. Fetch latest invoice detail.
2. Require institution role and `OPEN`/`UNCOLLECTIBLE`.
3. Validate `hostedInvoiceUrl` as HTTPS Stripe URL.
4. Open it in an in-app/device browser.
5. Store only the invoice ID as pending return context.
6. On browser close, app foreground, or screen focus, call `POST /invoices/:id/sync`.
7. Refresh invoice and booking caches.

The hosted link is also emailed when the invoice is issued. Do not persist or log it.

## Teacher Stripe onboarding

Payout readiness is exactly:

```text
ready = chargesEnabled && payoutsEnabled
```

Do not infer it from `connected` or `detailsSubmitted`.

The website uses:

```http
POST /api/payments/payout-account/session
```

and passes the Account Session secret to `@stripe/react-connect-js`. That is web-only.

For React Native with the same backend, use:

```http
POST /api/payments/payout-account/onboarding-link
```

```ts
type StripeLink = { url: string; expiresAt: string | null };
```

Open the single-use URL immediately. On browser close/foreground, refetch `GET /payments/payout-account`. Request a new link after expiry.

Hosted return/refresh URLs currently use backend `FRONTEND_URL`, so Stripe returns to the website rather than a native deep link. With no backend change, detect browser close/foreground and refetch. Add mobile-aware return URLs server-side if direct native return is required.

Stripe has native Connect embedded components for iOS/Android, with some components in preview, but no drop-in equivalent to React Connect JS. Adopt them only as a separate version-checked decision: https://docs.stripe.com/connect/supported-embedded-components/payouts

`POST /payments/payout-account/dashboard-link` only works for accounts created with `STRIPE_TEACHER_DASHBOARD=express`. Backend default is `none`, where management is expected in embedded components. Decide this deployment setting before creating production accounts if mobile needs Express Dashboard fallback.

## Balance and instant payout

```http
GET /api/payments/payout-account/balance
```

```ts
type PayoutBalance = {
  pendingPence: number;
  availablePence: number;
  instantAvailablePence: number;
  instantDestination: { id: string; label: string } | null;
  recentPayouts: Array<{
    id: string;
    amountPence: number;
    method: string;
    status: string;
    arrivalDate: string;
  }>;
};
```

Before readiness, balance returns zeros. Withdraw all instantly with `{}` or a partial amount with `{ "amountPence": 10000 }` to `POST /payments/payout-account/instant-payout`.

- Minimum 40p.
- Requires an instant-capable destination.
- Status can be `pending`, `in_transit`, `paid`, `failed`, or `canceled`.
- Never auto-repeat an uncertain payout; refresh balance/recent payouts first.

## Invoice lists, commands, refunds

Own invoices:

```http
GET /api/invoices/me?page=1&limit=20&status=OPEN
```

Party filters: `OPEN`, `PAID`, `VOID`, `UNCOLLECTIBLE`; `PENDING` is hidden.

Admin:

```http
GET /api/invoices?page=1&limit=20&status=PAID&bookingId=...&instructorId=...&institutionId=...
```

Limit is capped at 100.

```http
POST /api/invoices/{id}/send
POST /api/invoices/{id}/void
POST /api/invoices/{id}/refund
```

Refund body:

```json
{ "amountPence": 2000, "reason": "requested_by_customer" }
```

Amount is optional for the full remaining refund. Reasons: `duplicate`, `fraudulent`, `requested_by_customer`. A refunded invoice remains `PAID`; use `amountRefundedPence` for partial/full labels. There is no `REFUNDED` status.

Void is admin-only for unpaid `OPEN`/`UNCOLLECTIBLE` invoices and allows re-invoicing. Refund uses Stripe transfer reversal and proportional application fee refund.

## Webhooks and truth

Mobile never calls `POST /api/payments/webhooks/stripe`. Stripe calls it with a signature. Handled events include invoice paid/void/uncollectible/payment failed, charge refunded, disputes, and connected account updates. Processing is idempotent through stored event IDs. Explicit sync gives the paying client immediate state; webhook delivery supplies eventual truth.

## Security and retry rules

- Never ship Stripe secret or webhook keys.
- Never log tokens, client secrets, hosted invoice URLs, or account links.
- Card/bank data must go directly to Stripe UI, never custom fields or SupplyEd REST.
- Use synchronous handler locks plus disabled UI for mutations.
- After mutation timeout, read state before retrying.
- Keep money as integer pence.
- Validate external Stripe URLs and permit HTTPS only.
- Backend already uses idempotency keys for account/invoice/refund/payout creation.

## Suggested mobile structure

```text
src/api/client.ts
src/api/conversations.ts
src/api/applications.ts
src/api/attachments.ts
src/api/payments.ts
src/realtime/conversationSocket.ts
src/store/conversations.ts
src/store/messages.ts
src/store/payments.ts
src/screens/messages/InboxScreen.tsx
src/screens/messages/ConversationScreen.tsx
src/screens/messages/ConversationDetails.tsx
src/screens/messages/AttachmentViewer.tsx
src/screens/bookings/BookingDetails.tsx
src/screens/payments/SchoolInvoices.tsx
src/screens/payments/InvoiceCheckout.tsx
src/screens/payments/TeacherEarnings.tsx
src/screens/payments/PayoutSetup.tsx
```

## Mobile implementation order

1. Envelope API client and token refresh.
2. Conversation REST and exact application navigation.
3. Inbox/thread pagination and read state.
4. One app-level Socket.IO manager and cache reconciliation.
5. Typing and seen markers.
6. Presigned attachment upload/download/preview.
7. Application/job/applicant details and avatar fallback.
8. Booking chat shortcut using `booking.applicationId`.
9. Invoice list/detail/create/sync and hosted fallback.
10. Native PaymentSheet using payment session.
11. Hosted payout onboarding, readiness, balance, instant payout.
12. Admin void/refund only if mobile has admin screens.

## Acceptance checklist

### Messaging

- Correct school/applicant opens from application and booking.
- Job without application cannot open arbitrary chat.
- Name and photo display; missing/broken photo falls back to initials.
- Pagination prepends without duplicates or scroll jumps.
- Text-only, attachment-only, and combined messages work.
- Image/PDF/text preview and Word open/download work.
- Socket handles message, read, typing, ready, auth-expired.
- POST response and socket echo render once.
- Reconnect refetches missed state.
- Rejected thread preserves history and disables composer/upload.
- Logout closes socket and clears user caches.

### Payments

- Only completed bookings invoice.
- Hourly/daily/fixed and pounds/pence rules are correct.
- Invoice `409` triggers refresh, not blind duplicate POST.
- Institution pays open/written-off invoice through PaymentSheet.
- Cancel is neither failure nor success.
- Completion explicitly syncs invoice and refreshes booking/Billing.
- Hosted fallback syncs after browser closes/returns.
- Teacher onboarding refetches readiness on foreground.
- Ready requires charges and payouts enabled.
- Instant payout validates minimum and available amount.
- Admin void/refund rules work.
- Refund labels use `amountRefundedPence`; status remains paid.
- Sensitive values never enter logs.

## Source map

Backend:

- `src/modules/conversations/conversations.controller.ts`
- `src/modules/conversations/conversations.gateway.ts`
- `src/modules/conversations/conversations.service.ts`
- `src/modules/conversations/conversations.repository.ts`
- `src/modules/conversations/conversations.config.ts`
- `src/modules/conversations/conversation-events.service.ts`
- `src/modules/conversations/dto/*`
- `src/modules/applications/applications.controller.ts`
- `src/modules/jobs/jobs.controller.ts`
- `src/modules/instructors/instructors.controller.ts`
- `src/modules/payments/payments.controller.ts`
- `src/modules/payments/invoices.service.ts`
- `src/modules/payments/payout-accounts.service.ts`
- `src/modules/payments/instant-payouts.service.ts`
- `src/modules/payments/stripe-webhooks.service.ts`
- `src/modules/payments/stripe.service.ts`
- `src/modules/payments/payments.config.ts`
- `src/modules/payments/dto/*`

Website references:

- `features/conversations/socket.ts`
- `features/conversations/use-conversations.ts`
- `features/conversations/actions.ts`
- `components/organisms/MessagingPage.tsx`
- `components/organisms/MessageAttachmentPreview.tsx`
- `components/organisms/ApplicationsWorkspacePage.tsx`
- `components/organisms/TeacherApplicationsPage.tsx`
- `components/organisms/BookingsPage.tsx`
- `features/payments/actions.ts`
- `features/payments/use-payments.ts`
- `components/organisms/PayInvoiceModal.tsx`
- `components/organisms/StripePayoutComponents.tsx`
- `components/organisms/PayoutSettings.tsx`
- `components/organisms/BillingPage.tsx`

The older `docs/react-native-stripe-twilio-mobile-integration-guide.md` remains useful for Twilio. This document supersedes its hosted-only payment recommendation and its former assumption that invoice GET reconciles status.
