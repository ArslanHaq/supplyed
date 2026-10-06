# SupplyEd Stripe: Complete Implementation, Verification, and Mobile Handoff

Audited on **6 October 2026** against:

- web branch `feat/reflow`, commit `d13dffb208d3f8ee9b2234825f398cecfc458ea2`;
- backend branch `feat/profiles-restructure`, commit `b2c1b914dc45cabecbeb666540aea5f946165aa4`;
- web Stripe packages `@stripe/stripe-js ^10.0.0`, `@stripe/connect-js ^3.4.6`, and `@stripe/react-connect-js ^3.4.4`;
- backend Stripe SDK `stripe ^22.6.2`;
- backend Stripe API version `2026-08-26.dahlia`.

This is the standalone source of truth for everything currently implemented around Stripe in SupplyEd. It documents the website, backend, database, security model, mobile API contract, current limitations, and a test checklist.

## What was fixed in the latest Stripe configuration issue

The payout page showed:

```text
Payments are not configured: set STRIPE_PUBLISHABLE_KEY
```

The key was already present in the backend environment, but the running Nest process had not loaded the current environment. The work completed was:

1. Confirmed the backend has a publishable key, secret key, and webhook secret without printing or copying their values.
2. Confirmed the publishable and secret keys are both Stripe **test-mode** keys.
3. Confirmed `STRIPE_PUBLISHABLE_KEY` is read by `stripePublishableKey()` in the payment module.
4. Stopped stale SupplyEd backend processes holding port `3003`.
5. Restarted the backend from `supplyed-backend`, causing `.env` to be loaded again.
6. Confirmed the payment module, payout routes, invoice routes, and webhook route registered successfully.
7. Confirmed `GET http://localhost:3003/api/health` returned HTTP 200 with the database up.
8. Confirmed the compiled payment configuration reports `{ configured: true, mode: "test" }` without exposing a key.
9. Kept all Stripe secrets out of source control and this document.

Related local routing is currently:

```text
Website: http://localhost:3000
Backend: http://localhost:3003
Backend REST base: http://localhost:3003/api
```

The website server points to the backend through `API_BASE_URL`. React Native must call the backend directly and must not call the website's Next.js `/api/*` proxy routes.

## Stripe architecture

SupplyEd has three Stripe areas:

1. **Teacher Connect accounts and payouts**
   - A teacher receives a Stripe connected account.
   - Stripe collects identity and bank details.
   - SupplyEd stores only the connected account ID and readiness flags.
   - Teachers can see balances and request instant payouts.

2. **School invoices and payments**
   - A completed booking can be invoiced.
   - The backend calculates the teacher amount, SupplyEd fee, and school total.
   - Stripe emails a hosted invoice and also supplies an in-app payment client secret.
   - The teacher share goes to the connected account; SupplyEd keeps the configured application fee.

3. **Administration and payment state**
   - Admins can inspect invoices, check teacher payout readiness, void invoices, and issue full or partial refunds.
   - Stripe webhooks update local invoice, refund, dispute, and connected-account state.
   - Explicit sync endpoints allow the paying client to refresh status immediately.

Stripe is not involved when a user applies for a job, is hired, or accepts a booking. A charge is possible only after the booking is completed and an invoice is created.

## System boundaries

### Backend responsibilities

The backend alone:

- holds the Stripe secret key and webhook signing secrets;
- creates and reads Stripe connected accounts;
- creates Account Sessions and hosted onboarding links;
- creates Stripe customers, invoices, invoice items, refunds, and payouts;
- calculates every trusted amount;
- verifies webhook signatures from the raw request body;
- applies role and resource ownership checks;
- stores Stripe IDs and mirrored status;
- supplies short-lived client secrets and the public publishable key to an authenticated client.

### Web and mobile responsibilities

Clients:

- authenticate to SupplyEd with the normal user session or bearer token;
- request a short-lived Stripe session from the backend;
- show Stripe-owned UI for card, identity, and bank information;
- display backend-provided amounts and statuses;
- call the sync endpoint after a payment attempt;
- refetch after app foreground, browser return, or webhook-driven state changes.

Clients must never calculate the final bill, create Stripe objects directly with a secret key, or collect raw card/bank details in custom SupplyEd inputs.

## Environment variables

All variables below belong to the **backend**. Never place secret or webhook keys in a web bundle, React Native bundle, Expo public variable, source file, log, screenshot, analytics event, or crash report.

| Variable | Required for | Rule |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Every backend Stripe API call | Use `sk_test_...` locally and `sk_live_...` only in production. |
| `STRIPE_PUBLISHABLE_KEY` | Browser/native Stripe UI | Must belong to the same account and mode as the secret key. Public by design, but return it through the session response. |
| `STRIPE_WEBHOOK_SECRET` | Snapshot invoice/charge/dispute webhooks | Stripe endpoint signing secret, normally `whsec_...`. |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Accounts v2 thin connected-account events | Optional only if no separate Connect event destination is configured. |
| `STRIPE_TEACHER_DASHBOARD` | Connected-account behavior | `none` by default; `express` enables Express Dashboard login links. |
| `PROCESSING_FEE_PERCENT` | Invoice amount calculation | Required, finite, at least `0`, and below `100`. No guessed default. |
| `INVOICE_DAYS_UNTIL_DUE` | Stripe invoice due date | Positive integer; defaults to `30`. |
| `FRONTEND_URL` | Hosted onboarding return and refresh links | Currently `http://localhost:3000` locally. |
| `PORT` | Backend listener | Currently `3003` locally. |
| `STRIPE_API_HOST`, `STRIPE_API_PORT`, `STRIPE_API_PROTOCOL` | Automated tests/local Stripe fake | Never set these in a deployed environment. |

If a payment variable is missing, the rest of the backend remains available while the affected payment action returns HTTP 503.

## Authentication and response envelope

React Native calls:

```text
{API_ORIGIN}/api
```

Authenticated requests use:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Backend success responses wrap the endpoint payload in `data`:

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
```

Failures use the same envelope style:

```ts
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

The app API helper must unwrap `response.data`. It should preserve `statusCode`, `message`, `code`, and `meta.requestId` for support diagnostics.

## Complete endpoint matrix

Paths below are relative to `/api`.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/payments/payout-account` | Instructor | Read current connected-account readiness. |
| `POST` | `/payments/payout-account/session` | Instructor | Create a short-lived Account Session for Connect embedded components. |
| `POST` | `/payments/payout-account/onboarding-link` | Instructor | Create a single-use hosted onboarding URL. |
| `POST` | `/payments/payout-account/dashboard-link` | Instructor | Create a one-time Express Dashboard URL, if the account has an Express dashboard. |
| `GET` | `/payments/payout-account/balance` | Instructor | Read pending, available, instant balance, destination, and recent payouts. |
| `POST` | `/payments/payout-account/instant-payout` | Instructor | Withdraw all or part of the instantly available balance. |
| `GET` | `/payments/payout-accounts/instructor/:instructorId` | Admin | Inspect one teacher's payout readiness. |
| `POST` | `/invoices` | Booking institution or admin | Create, finalize, store, and email a booking invoice. |
| `GET` | `/invoices/me` | Instructor or institution | Paginated earnings/bills for the signed-in party. |
| `GET` | `/invoices` | Admin | Paginated platform-wide invoice list and filters. |
| `GET` | `/invoices/:id` | Invoice party or admin | Read stored invoice detail. This does not sync Stripe. |
| `POST` | `/invoices/:id/payment-session` | Booking institution | Get secrets for an in-app payment. |
| `POST` | `/invoices/:id/sync` | Invoice party or admin | Read Stripe and apply the latest invoice status. |
| `POST` | `/invoices/:id/send` | Booking institution or admin | Email an open invoice again. |
| `POST` | `/invoices/:id/void` | Admin | Void an unpaid invoice and allow re-invoicing. |
| `POST` | `/invoices/:id/refund` | Admin | Refund the remaining full amount or a partial amount. |
| `POST` | `/payments/webhooks/stripe` | Stripe signature only | Receive Stripe events. Apps must never call this endpoint. |

Swagger is available from the backend at `/api/docs`.

## Shared TypeScript models for mobile

```ts
export type InvoiceStatus =
  | "PENDING"
  | "OPEN"
  | "PAID"
  | "VOID"
  | "UNCOLLECTIBLE";

export type PayoutAccount = {
  connected: boolean;
  ready: boolean;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirementsDue: string[];
  disabledReason: string | null;
};

export type PayoutSummary = {
  id: string;
  amountPence: number;
  method: string; // instant | standard
  status: string; // pending | in_transit | paid | failed | canceled
  arrivalDate: string;
};

export type PayoutBalance = {
  pendingPence: number;
  availablePence: number;
  instantAvailablePence: number;
  instantDestination: { id: string; label: string } | null;
  recentPayouts: PayoutSummary[];
};

export type Invoice = {
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
  payType: "hourly" | "daily" | "fixed" | string;
  rateAmount: number; // pounds
  unitsWorked: number | null;
  teacherAmountPence: number;
  feeAmountPence: number;
  totalAmountPence: number;
  currency: string; // currently gbp
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

export type PaginatedInvoices = {
  invoices: Invoice[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
  };
};

export type PayoutSession = {
  clientSecret: string;
  publishableKey: string;
  expiresAt: string;
};

export type StripeLink = {
  url: string;
  expiresAt: string | null;
};

export type InvoicePaymentSession = {
  clientSecret: string;
  customerSessionClientSecret: string;
  publishableKey: string;
  amountPence: number;
  currency: string;
};
```

All fields ending in `Pence` are integer minor units. Never use floating-point pounds for a charge, refund, or payout request.

## Teacher Connect account lifecycle

### Account creation

A connected account is created lazily the first time the teacher starts an embedded session or asks for a hosted onboarding link.

The backend creates a Stripe **Accounts v2** individual account with:

- identity country `gb`;
- default currency `gbp`;
- locale `en-GB`;
- merchant and recipient configurations;
- card-payment and Stripe-transfer capabilities requested;
- merchant category code `8299` for schools and educational services;
- SupplyEd as the collector of fees and losses;
- `instructorId` in Stripe metadata;
- an idempotency key based on dashboard type, instructor ID, and prefill mode.

The backend attempts to prefill:

- legal name when the profile has at least two name parts;
- email;
- E.164 phone number;
- complete UK address.

If Stripe rejects the prefilled details, the backend retries account creation without prefill so the teacher can enter the information in Stripe's form.

### Readiness

The only correct readiness rule is:

```text
ready = chargesEnabled && payoutsEnabled
```

Do not treat `connected` or `detailsSubmitted` as payment readiness.

- `connected`: a SupplyEd database row and Stripe account exist.
- `detailsSubmitted`: no current non-eventual action is waiting on the teacher.
- `chargesEnabled`: card payments and transfers are active.
- `payoutsEnabled`: Stripe can pay the connected balance to a bank/card.
- `requirementsDue`: Stripe requirements currently awaiting the teacher.
- `disabledReason`: Stripe capability restriction code, if present.

An account that is not ready is refreshed from Stripe when read. A ready account is served from the database and kept current by webhooks.

### Website embedded setup

The website calls:

```http
POST /api/payments/payout-account/session
```

The backend enables these Account Session components:

- `account_onboarding`;
- `notification_banner`;
- `payouts` for bank details and payout history.

External-account collection is enabled. Stripe user authentication is disabled only when SupplyEd is the requirements collector. Embedded instant and standard payout controls are disabled because SupplyEd exposes its own instant-payout endpoint and Stripe handles the standard schedule.

The website uses `@stripe/react-connect-js`, refreshes the short-lived client secret when Stripe requests another one, and never stores the secret.

### Mobile onboarding choices

#### Choice A: hosted onboarding with the existing backend

This is the simplest mobile implementation:

```http
POST /api/payments/payout-account/onboarding-link
```

Open `data.url` immediately in an authenticated browser session. It is single use. On browser close, app foreground, or screen focus, refetch:

```http
GET /api/payments/payout-account
```

Current limitation: the backend builds Stripe's `return_url` and `refresh_url` from `FRONTEND_URL`, so Stripe returns to the website rather than a native deep link. The mobile app must currently detect foreground/browser close and refetch. Direct native return requires a backend change that accepts or selects an allow-listed mobile return URL.

#### Choice B: native Connect embedded components

Stripe's current Connect documentation includes React Native variants for account onboarding and payouts. The existing session endpoint already returns the publishable key and Account Session secret required by Stripe-owned components. Use the installed native Connect SDK's exact versioned API.

Do not install or import the website packages `@stripe/connect-js` or `@stripe/react-connect-js` in React Native.

Before choosing this path, verify that the intended native SDK version supports all three enabled components and the backend's Accounts v2 configuration. Hosted onboarding remains the fallback.

Official references:

- <https://docs.stripe.com/connect/supported-embedded-components/account-onboarding>
- <https://docs.stripe.com/connect/supported-embedded-components/payouts>
- <https://docs.stripe.com/api/account_links/create>

### Express Dashboard limitation

```http
POST /api/payments/payout-account/dashboard-link
```

This works only when:

1. the teacher has submitted setup details; and
2. the Stripe account was created with `STRIPE_TEACHER_DASHBOARD=express`.

The backend default is `none`. Accounts created with no dashboard are managed through embedded components. Changing the environment later does not automatically convert previously created accounts.

## Teacher balances and instant payouts

Read the balance:

```http
GET /api/payments/payout-account/balance
```

Before setup is ready, or when Stripe is unavailable, this read returns zero balances and an empty payout list.

The backend concurrently reads:

- connected-account Stripe balance;
- up to ten external bank/card destinations;
- the five most recent payouts.

It sums GBP pending and available balances. For instant payout, it selects the largest `instant_available.net_available` amount whose destination is present in the external-account list.

Withdraw the full instant balance:

```http
POST /api/payments/payout-account/instant-payout
Content-Type: application/json

{}
```

Withdraw part of it:

```json
{ "amountPence": 10000 }
```

Rules:

- instructor only;
- payout account must be ready;
- destination must support instant payouts;
- minimum is `40` pence;
- requested amount cannot exceed `instantAvailablePence`;
- Stripe's instant-payout fee is reflected in the available amount according to platform pricing;
- the backend uses an idempotency key derived from the Stripe account, current available balance, and requested amount.

If the request times out, refresh balance and recent payouts before allowing another submission. Never automatically repeat an uncertain financial mutation.

## Booking invoice creation

Create an invoice:

```http
POST /api/invoices
Content-Type: application/json

{
  "bookingId": "booking-uuid",
  "unitsWorked": 4.5,
  "poNumber": "PO-2026-0412"
}
```

Rules:

- only the booking institution or an admin may create it;
- booking must be `COMPLETED`;
- booking must have a positive agreed rate and a valid pay type;
- teacher payout account must be ready;
- `unitsWorked` is required for hourly/daily and forbidden for fixed price;
- units must be `0.01` to `9999.99` with at most two decimals;
- daily units cannot exceed inclusive booking days;
- hourly units cannot exceed inclusive booking days multiplied by 24;
- PO number is optional, trimmed, non-empty when supplied, and at most 100 characters;
- one non-void invoice is permitted per booking;
- invoice total must be between 30 pence and 99,999,999 pence.

The backend calculates:

```text
teacherAmountPence = agreed rate x units, or fixed agreed rate
feeAmountPence     = teacherAmountPence x PROCESSING_FEE_PERCENT
totalAmountPence   = teacherAmountPence + feeAmountPence
```

All calculations are rounded into whole pence. The fee is added to the school's bill, so the teacher receives the agreed amount.

### Stripe objects created during invoicing

1. A Stripe Customer is created for the school on its first invoice and its ID is saved on `InstitutionProfile`.
2. A draft Stripe invoice is created with `send_invoice`, configured due days, GBP currency, and manual finalization.
3. `on_behalf_of` and `transfer_data.destination` point to the teacher's connected account.
4. `application_fee_amount` is the SupplyEd fee when it is above zero.
5. One invoice item contains teacher pay.
6. A second invoice item contains the SupplyEd processing fee when above zero.
7. The invoice is finalized.
8. Local status changes from `PENDING` to `OPEN` and hosted/PDF URLs and due date are stored.
9. Stripe is asked to email the invoice. If email fails, the finalized invoice remains valid and can be resent.

Stripe metadata includes the local invoice and booking IDs. Idempotency keys are based on local invoice IDs, preventing a retry from creating duplicate Stripe invoices or line items.

A local `PENDING` invoice older than ten minutes is treated as an interrupted attempt. The backend checks Stripe, deletes a remote draft when safe, or keeps and records an already finalized invoice.

## School invoice payment

### Create payment session

```http
POST /api/invoices/{invoiceId}/payment-session
```

Only the booking institution can call this. The local and remote invoice must still be `OPEN` or `UNCOLLECTIBLE`.

The backend:

1. retrieves the Stripe invoice and expands its confirmation secret;
2. updates local state and returns 409 if Stripe already shows it paid or void;
3. creates a Customer Session with saved-card redisplay, removal, and on-session saving enabled;
4. returns the invoice payment client secret, Customer Session secret, publishable key, remaining amount, and currency.

Never log or persist either client secret.

### Website behavior

The website mounts Stripe's Payment Element in a modal. It:

- creates one payment session per modal opening;
- avoids refetching while the Payment Element is mounted;
- confirms payment with `redirect: "if_required"`;
- supplies `/billing?paidInvoice=<id>` as the return URL;
- calls the sync endpoint up to five times, 1.5 seconds apart;
- refreshes invoice and booking caches;
- reports "processing" unless the backend confirms `PAID`.

### React Native implementation

Use Stripe's official React Native SDK and initialize it with the `publishableKey` returned by the backend. The simplest implementation with the current backend omits saved-card Customer Session fields:

```ts
import {
  initStripe,
  PaymentSheetError,
} from "@stripe/stripe-react-native";

async function payInvoice(
  invoiceId: string,
  initPaymentSheet: (options: Record<string, unknown>) => Promise<{ error?: Error }>,
  presentPaymentSheet: () => Promise<{ error?: { code?: string; message?: string } }>,
) {
  const session = await api.post<InvoicePaymentSession>(
    `/invoices/${encodeURIComponent(invoiceId)}/payment-session`,
  );

  await initStripe({
    publishableKey: session.publishableKey,
    urlScheme: "supplyed",
  });

  const initialized = await initPaymentSheet({
    merchantDisplayName: "SupplyEd",
    paymentIntentClientSecret: session.clientSecret,
    returnURL: "supplyed://stripe-redirect",
    allowsDelayedPaymentMethods: false,
  });
  if (initialized.error) throw initialized.error;

  const presented = await presentPaymentSheet();
  if (presented.error?.code === PaymentSheetError.Canceled) return { canceled: true };
  if (presented.error) throw new Error(presented.error.message ?? "Payment failed");

  return settleInvoice(invoiceId);
}
```

`initPaymentSheet` and `presentPaymentSheet` normally come from `useStripe()`. Register the `supplyed` URL scheme on iOS and Android and pass incoming URLs to Stripe's URL callback handler.

Official references:

- <https://docs.stripe.com/payments/mobile/embedded>
- <https://github.com/stripe/stripe-react-native>

### Current saved-card parity gap

The backend returns `customerSessionClientSecret`, but React Native Customer Session integrations also require the associated Stripe `customerId`. The current response does not include `customerId`.

Therefore:

- current mobile payment can work without displaying saved cards by omitting Customer Session configuration;
- exact website parity requires adding `customerId` to `InvoicePaymentSessionResponseDto` and returning the Stripe invoice customer ID;
- after that change, pass both `customerId` and `customerSessionClientSecret` using the installed React Native Stripe SDK's current API;
- never derive a customer ID from a client secret.

This is a known backend contract gap, not a mobile UI bug.

### Payment completion and sync

After PaymentSheet completes, call:

```http
POST /api/invoices/{invoiceId}/sync
```

Use a bounded foreground-only loop:

```ts
async function settleInvoice(invoiceId: string): Promise<Invoice> {
  let latest: Invoice | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 1500));
    latest = await api.post<Invoice>(`/invoices/${invoiceId}/sync`);
    if (latest.status === "PAID" || latest.status === "VOID") break;
  }

  if (!latest) throw new Error("Invoice status could not be loaded");
  return latest;
}
```

PaymentSheet completion means Stripe accepted the client flow. Show final success only when the backend returns `PAID`; otherwise show that payment is processing and let webhook delivery finish the update.

### Hosted invoice fallback

Every finalized invoice can also contain `hostedInvoiceUrl` and `invoicePdfUrl`.

For a hosted payment fallback:

1. fetch current invoice detail;
2. require institution role and `OPEN`/`UNCOLLECTIBLE` status;
3. allow only HTTPS URLs on `stripe.com` or a subdomain of `stripe.com`;
4. open the hosted invoice in an in-app or device browser;
5. remember only the SupplyEd invoice ID;
6. on browser close/app foreground, call `/invoices/:id/sync`;
7. refresh invoice, booking, and payout balance data.

Do not store or log the hosted invoice URL. It is also emailed to the school.

## Invoice listing and status behavior

Own invoices:

```http
GET /api/invoices/me?page=1&limit=20&status=OPEN
```

Instructor and institution filters allow `OPEN`, `PAID`, `VOID`, and `UNCOLLECTIBLE`. `PENDING` is internal and hidden from parties.

Admin list:

```http
GET /api/invoices?page=1&limit=20&status=PAID&bookingId=...&instructorId=...&institutionId=...
```

Pagination defaults to page 1 and limit 20. Limit is capped at 100.

Status meaning:

| Status | Meaning | Can school pay? | Can admin void? |
| --- | --- | --- | --- |
| `PENDING` | Local/Stripe creation is in progress | No | No |
| `OPEN` | Finalized and awaiting payment | Yes | Yes |
| `PAID` | Stripe reports paid | No | No |
| `VOID` | Canceled before payment | No | No; booking can be invoiced again |
| `UNCOLLECTIBLE` | Written off in Stripe, still payable in this implementation | Yes | Yes |

The website polls relevant invoice views every 15 seconds. Native should refetch on focus and after any payment action. Background polling is unnecessary.

## Resend, void, refund, and disputes

Resend an open invoice:

```http
POST /api/invoices/{id}/send
```

Allowed for the booking institution and admin. Only `OPEN` invoices can be resent.

Void an unpaid invoice:

```http
POST /api/invoices/{id}/void
```

Admin only. Allowed for `OPEN` or `UNCOLLECTIBLE`. A void invoice permits a corrected replacement invoice for the booking.

Refund a paid invoice:

```http
POST /api/invoices/{id}/refund
Content-Type: application/json

{
  "amountPence": 2000,
  "reason": "requested_by_customer"
}
```

- admin only;
- invoice must be `PAID` and have a Stripe PaymentIntent;
- omit `amountPence` to refund everything still refundable;
- amount must be at least 1p and no more than the remaining paid amount;
- reason is optional and must be `duplicate`, `fraudulent`, or `requested_by_customer`;
- `reverse_transfer: true` pulls back the corresponding teacher share;
- `refund_application_fee: true` refunds SupplyEd's fee proportionally;
- the idempotency key uses invoice ID, already refunded amount, and new refund amount.

An invoice remains `PAID` after a refund. The UI must use `amountRefundedPence` to label partial or full refunds. There is no `REFUNDED` invoice status.

Stripe dispute state is stored in `disputeStatus` and updated from dispute webhooks.

## Webhook contract

Endpoint:

```http
POST /api/payments/webhooks/stripe
Stripe-Signature: ...
```

The endpoint is public only in the JWT sense. It authenticates Stripe using the signature and exact raw request bytes. Nest starts with `rawBody: true` for this reason.

The parser accepts either configured signing secret:

- `STRIPE_WEBHOOK_SECRET` for standard snapshot events;
- `STRIPE_CONNECT_WEBHOOK_SECRET` for a separate connected-account event destination.

Handled snapshot events:

| Event | Local effect |
| --- | --- |
| `invoice.paid` | Marks invoice `PAID`, records paid time and PaymentIntent ID. |
| `invoice.voided` | Marks invoice `VOID`. |
| `invoice.marked_uncollectible` | Marks invoice `UNCOLLECTIBLE`. |
| `invoice.payment_failed` | Logs the failure; invoice stays `OPEN`. |
| `charge.refunded` | Raises `amountRefundedPence` to Stripe's amount. |
| `charge.dispute.created` | Stores dispute status. |
| `charge.dispute.updated` | Updates dispute status. |
| `charge.dispute.closed` | Stores final dispute status. |
| `account.updated` | Refreshes a known connected account from Stripe. |

Accounts v2 thin events whose type starts with `v2.core.account` trigger a fresh account read when their related object is a v2 account.

Webhook event IDs are inserted into `StripeWebhookEvent`. A duplicate already processed event is ignored. An event is marked processed only after its handler succeeds, allowing Stripe to retry failures safely. Unknown valid events are recorded and marked processed without changing application state.

The mobile app never calls the webhook and does not need a Stripe socket. Webhooks provide eventual truth; `/invoices/:id/sync` provides immediate foreground reconciliation.

## Stripe and database object mapping

| SupplyEd entity | Stripe object | Stored field |
| --- | --- | --- |
| Teacher profile | Connected Account | `InstructorPayoutAccount.stripeAccountId` |
| School profile | Customer | `InstitutionProfile.stripeCustomerId` |
| Booking invoice | Invoice | `BookingInvoice.stripeInvoiceId` |
| Display invoice reference | Invoice number | `BookingInvoice.stripeInvoiceNumber` |
| Paid invoice | PaymentIntent | `BookingInvoice.stripePaymentIntentId` |
| Hosted payment page | Invoice hosted URL | `BookingInvoice.hostedInvoiceUrl` |
| Invoice PDF | Invoice PDF URL | `BookingInvoice.invoicePdfUrl` |
| Stripe delivery | Event ID/type/time | `StripeWebhookEvent` |

`BookingInvoice` stores a snapshot of rate, units, teacher amount, fee, total, destination account, and currency. Later booking or fee-setting edits do not alter an issued invoice.

SupplyEd intentionally does not store:

- card number, CVC, or expiry;
- bank account number or sort code;
- identity document images;
- Account Session client secrets;
- PaymentIntent/confirmation client secrets;
- Customer Session client secrets;
- onboarding or dashboard login URLs as durable application data.

## Security and retry rules

1. Never ship `STRIPE_SECRET_KEY` or a webhook secret to a client.
2. Never log access tokens, Stripe client secrets, hosted invoice URLs, dashboard URLs, or onboarding URLs.
3. Never collect raw card, bank, or identity data in SupplyEd forms.
4. Treat all amounts returned by the client as untrusted; the backend calculates invoice totals.
5. Keep money as integer pence.
6. Disable submit buttons while a mutation is pending.
7. After an uncertain timeout, read current state before retrying.
8. Accept only HTTPS Stripe-hosted external URLs.
9. Request fresh short-lived sessions and links instead of persisting them.
10. Preserve backend `requestId` in user-visible support errors without exposing internal Stripe IDs.

Backend idempotency covers connected-account creation, school Customer creation, invoices, invoice items, finalization, refunds, and instant payouts. Client-side double-submit prevention is still required for good UX.

## Error handling matrix

| HTTP status | Meaning in payment flows | App behavior |
| --- | --- | --- |
| `400` | Invalid units/amount/status, setup incomplete, or unsupported payout destination | Show the backend message and let the user correct the action. |
| `401` | Missing/expired access token | Refresh authentication, then retry a safe read once. |
| `403` | Wrong role, wrong invoice party, or missing instructor/institution profile | Hide the action and show access denied. |
| `404` | Resource missing or intentionally hidden | Close stale detail and refresh the list. |
| `409` | Invoice/account changed concurrently or invoice already exists | Refetch before offering another action. |
| `502` | Stripe rejected a server request | Show provider rejection and preserve request ID. |
| `503` | Missing configuration or Stripe unavailable | Show temporary unavailability; do not loop retries. |

Configuration diagnostics include:

```text
Payments are not configured: set STRIPE_SECRET_KEY
Payments are not configured: set STRIPE_PUBLISHABLE_KEY
Payments are not configured: set STRIPE_WEBHOOK_SECRET
Payments are not configured: set PROCESSING_FEE_PERCENT
FRONTEND_URL is not configured
```

If the environment value is present but the error remains, restart the backend process so it reloads `.env`.

## React Native implementation order

1. Install and configure the official `@stripe/stripe-react-native` package using its version-specific iOS/Android steps.
2. Add `supplyed://stripe-redirect` deep-link handling and forward inbound Stripe URLs to the SDK.
3. Create typed API methods for all endpoint payloads in this document.
4. Add instructor payout status screen.
5. Implement hosted teacher onboarding first, or adopt the current native Connect embedded SDK after a compatibility spike.
6. Add payout balance and instant withdrawal UI.
7. Add school and teacher invoice lists and detail screens.
8. Add school PaymentSheet using `clientSecret` without Customer Session saved cards.
9. Call invoice sync after payment and on return/foreground.
10. Add hosted invoice and PDF actions with Stripe-host validation.
11. Add institution invoice creation for completed bookings.
12. Add admin readiness lookup, resend, void, and refund only if the mobile app includes admin screens.
13. Add analytics that record SupplyEd action names and outcomes only, never secrets or Stripe URLs.

Suggested mobile modules:

```text
src/features/payments/api.ts
src/features/payments/types.ts
src/features/payments/queries.ts
src/features/payments/stripe.ts
src/features/payments/useInvoicePayment.ts
src/features/payments/usePayoutOnboarding.ts
src/features/payments/screens/InvoicesScreen.tsx
src/features/payments/screens/InvoiceDetailScreen.tsx
src/features/payments/screens/PayoutsScreen.tsx
src/features/payments/screens/PayoutSetupScreen.tsx
```

Do not copy these website-only parts into React Native:

- Next.js `/app/api/*` proxy routes;
- NextAuth cookie/session logic;
- Next.js server actions and `{ ok, data }` action wrappers;
- `@stripe/stripe-js`;
- `@stripe/connect-js`;
- `@stripe/react-stripe-js`;
- `@stripe/react-connect-js`;
- browser `window.location` return URLs.

## End-to-end verification checklist

### Local configuration

- [ ] Backend runs on port 3003 and `/api/health` returns 200.
- [ ] Web or mobile calls the backend origin, not its own development port.
- [ ] Secret and publishable key are both `test` or both `live`; never mixed.
- [ ] `PROCESSING_FEE_PERCENT` is intentionally set.
- [ ] `FRONTEND_URL` is correct for hosted onboarding.
- [ ] Webhook secrets match the configured Stripe event destinations.
- [ ] No secret value is committed or bundled into the app.

### Test identities and booking

- [ ] Create a teacher with a complete UK profile.
- [ ] Create a school with billing name, email, and address.
- [ ] Create a job with hourly, daily, or fixed agreed pay.
- [ ] Hire the teacher and create a booking.
- [ ] Complete the booking before trying to invoice.
- [ ] Have an admin account available for void/refund tests.

### Teacher payout setup

- [ ] `GET /payments/payout-account` initially returns `connected: false`.
- [ ] Starting setup creates one connected account even if tapped twice.
- [ ] Stripe displays prefilled data where the SupplyEd profile is complete.
- [ ] Leaving setup early keeps `connected: true` and `ready: false`.
- [ ] Returning to setup uses a fresh Account Session or onboarding link.
- [ ] Completing requirements eventually produces `ready: true`.
- [ ] Requirement labels and disabled state render without exposing internal IDs.
- [ ] Wrong roles receive 403.

### Invoice creation

- [ ] Invoice is rejected before the booking is completed.
- [ ] Invoice is rejected while teacher payout setup is not ready.
- [ ] Daily/hourly invoice requires valid units.
- [ ] Fixed invoice rejects `unitsWorked`.
- [ ] Units above the booking duration are rejected.
- [ ] PO number appears when supplied.
- [ ] Teacher amount, fee, and total exactly match backend values.
- [ ] The school receives a Stripe email and hosted link.
- [ ] A duplicate invoice attempt returns 409.
- [ ] Parties never see an internal `PENDING` invoice.

### School payment

Use Stripe test mode only. Stripe's official test values include:

| Scenario | Card number | Expected result |
| --- | --- | --- |
| Basic success | `4242 4242 4242 4242` | Payment succeeds without a challenge. |
| Authentication | `4000 0025 0000 3155` | Authentication flow is exercised. |
| Insufficient funds | `4000 0000 0000 9995` | Payment is declined. |

Use any future expiry and any valid CVC. Do not use real card details in test mode. Reference: <https://docs.stripe.com/testing>.

- [ ] Payment session can be created only by the booking school.
- [ ] PaymentSheet displays backend amount and GBP currency.
- [ ] Cancel returns to the invoice without changing it to paid.
- [ ] Decline remains recoverable and invoice stays payable.
- [ ] 3DS/deep-link return reopens the app correctly.
- [ ] Success calls `/invoices/:id/sync`.
- [ ] UI shows `PAID` only after backend confirmation.
- [ ] Hosted invoice fallback works and syncs on app foreground.
- [ ] Already paid/void remote invoice causes session endpoint 409 and a refetch.
- [ ] Teacher earnings and school bills show the same invoice amounts.

### Payout balance and withdrawal

- [ ] Before readiness, balance safely displays zeros.
- [ ] Pending and available GBP values render independently.
- [ ] No instant-capable destination disables instant withdrawal.
- [ ] Amount below 40p is rejected.
- [ ] Amount above instant availability is rejected.
- [ ] Empty body withdraws all instant availability.
- [ ] Partial integer-pence withdrawal works.
- [ ] A timeout triggers a balance/recent-payout refresh before another attempt.
- [ ] Arrival date, method, and status appear in recent payouts.

### Admin and lifecycle

- [ ] Admin lookup uses instructor profile ID and shows true readiness.
- [ ] Institution can resend only an open invoice.
- [ ] Admin can void open/uncollectible invoices.
- [ ] Voided booking can be invoiced again.
- [ ] Partial refund raises `amountRefundedPence` and leaves status `PAID`.
- [ ] Full remaining refund is idempotent and cannot exceed the paid amount.
- [ ] Dispute webhook updates `disputeStatus`.

### Webhooks

- [ ] Invalid/missing signature is rejected.
- [ ] `invoice.paid` updates local status.
- [ ] Re-delivering the same event changes state only once.
- [ ] A failed handler is not marked processed and can be retried.
- [ ] Account events refresh payout readiness.
- [ ] Mobile never calls or exposes the webhook URL as an app operation.

### Security review

- [ ] No Stripe secret or webhook signing secret exists in the app bundle.
- [ ] No card or bank fields are custom SupplyEd fields.
- [ ] Logs and analytics contain no client secrets or Stripe URLs.
- [ ] Every financial action has a role/ownership check on the backend.
- [ ] All money mutation requests use integer pence.
- [ ] External invoice links permit only HTTPS Stripe hosts.
- [ ] Sessions and single-use links are requested fresh.

## Current gaps before exact website/mobile parity

1. **Saved cards in React Native:** add `customerId` to the invoice payment-session response before enabling Customer Session saved-card display.
2. **Native hosted-onboarding return:** current return/refresh URLs use `FRONTEND_URL`; add allow-listed mobile deep-link support for direct return.
3. **No-dashboard bank management:** with `STRIPE_TEACHER_DASHBOARD=none`, mobile needs native Connect embedded components for full bank/payout management parity or must route the teacher to the website.
4. **Native Connect SDK decision:** select and pin a supported Stripe native/React Native Connect SDK version before copying the web embedded component experience.
5. **Automated backend payment coverage:** the web has payment integration/access tests, but the backend payment module should also have focused automated tests around amount calculation, permissions, webhook idempotency, refund limits, and interrupted invoice recovery.

These gaps do not prevent basic mobile invoice payment, invoice viewing, hosted teacher onboarding, payout balance display, or instant-payout requests with the existing backend.

## Relevant source files

Backend:

```text
src/main.ts
src/modules/payments/payments.controller.ts
src/modules/payments/payments.module.ts
src/modules/payments/payments.config.ts
src/modules/payments/stripe.service.ts
src/modules/payments/payout-accounts.service.ts
src/modules/payments/payout-accounts.repository.ts
src/modules/payments/instant-payouts.service.ts
src/modules/payments/invoice-amounts.ts
src/modules/payments/invoices.service.ts
src/modules/payments/invoices.repository.ts
src/modules/payments/stripe-webhooks.service.ts
src/modules/payments/webhook-events.repository.ts
src/modules/payments/dto/*
prisma/schema.prisma
prisma/migrations/20261001120000_payments_stripe_connect/migration.sql
```

Website:

```text
features/payments/actions.ts
features/payments/queries.ts
features/payments/types.ts
features/payments/schemas.ts
features/payments/stripe-client.ts
features/payments/use-payments.ts
features/payments/invoice-links.ts
features/payments/payout-auth.ts
features/payments/admin-payout-queries.ts
components/organisms/PayoutSettings.tsx
components/organisms/StripePayoutComponents.tsx
components/organisms/PayInvoiceModal.tsx
components/organisms/InvoiceDetailsModal.tsx
components/organisms/AdminPayoutLookup.tsx
components/molecules/BookingPaymentNotice.tsx
app/api/invoices/*
app/api/payments/*
app/(app)/payouts/return/page.tsx
app/(app)/payouts/refresh/page.tsx
tests/api-integrations.test.cjs
tests/payout-access.test.cjs
```

