# SupplyEd React Native Stripe And Twilio Integration Guide

Last updated from frontend/backend integration work and the additional mobile API handoff: 2026-10-05

This guide is for implementing the same Stripe and Twilio flows in the SupplyEd React Native app that are now wired in the web app. It combines the backend API contract with the screen placement decisions used today in the website.

Sources: the supplied React Native Stripe + Twilio backend guide, the earlier SupplyEd API guide, and the current frontend/backend code. Screen placement follows the website changes requested in this session. React Native examples below are implementation templates for the mobile team; they have not been installed or run in a mobile project.

The mobile app must not contain Stripe secret keys, Twilio credentials, webhook secrets, or backend environment values. The app calls SupplyEd backend endpoints only. Stripe and Twilio are used by the backend.

All API paths below are under the backend global `/api` prefix. For example, `POST /auth/phone/otp/send` means the app calls:

```http
POST {API_BASE_URL}/api/auth/phone/otp/send
```

## Core Rules

- Use the logged-in access token for every endpoint in this guide except Stripe webhooks, which the mobile app must never call.
- Every backend response is wrapped in an envelope. Read the useful payload from `data`.
- Money values ending in `Pence` are integers in pence. Format them as GBP in the app.
- `rateAmount` is already pounds, not pence.
- Do not build a card form in React Native for invoice payment. Open `hostedInvoiceUrl`.
- Do not call Twilio directly from React Native. Send and verify OTP codes through the backend.
- After returning from Stripe, refetch backend state. Stripe webhook updates are asynchronous.
- `GET /invoices/:id` now reconciles unsettled invoices with Stripe, so use it after returning from Stripe invoice payment.
- A booking is created through the existing booking flow; its Stripe invoice is created only after the booking is `COMPLETED`. Creating or accepting a booking does not charge the school.
- Prevent repeated taps on OTP send/verify, invoice creation, and withdrawals. Do not automatically retry a financial mutation after a timeout; first read the current backend state.
- The native app calls the backend `/api` directly with a bearer token. The website's Next.js proxy routes, server actions, cookies, and `{ ok, data }` action results are not the mobile API contract.

## Endpoint And Role Reference

All paths in this table include the backend `/api` prefix. `INSTRUCTOR` is the teacher role and `INSTITUTION` is the school role.

| Method and path | Who can call it | Payload / result |
| --- | --- | --- |
| `GET /api/auth/me` | Authenticated user | Current `User` |
| `POST /api/auth/phone/otp/send` | Authenticated user | `{ phone }` → `PhoneOtpResponse` |
| `POST /api/auth/phone/otp/verify` | Authenticated user | `{ otp }` → updated `User` |
| `GET /api/payments/payout-account` | Instructor | `PayoutAccount` |
| `POST /api/payments/payout-account/onboarding-link` | Instructor | No body → `StripeLink` |
| `POST /api/payments/payout-account/dashboard-link` | Instructor | No body → `StripeLink` |
| `GET /api/payments/payout-account/balance` | Instructor | `PayoutBalance` |
| `POST /api/payments/payout-account/instant-payout` | Instructor | `{}` or `{ amountPence }` → `PayoutSummary`, HTTP 201 |
| `GET /api/payments/payout-accounts/instructor/:instructorId` | Admin | Instructor **profile id** → `PayoutAccount` |
| `POST /api/invoices` | Booking institution or admin | `{ bookingId, unitsWorked?, poNumber? }` → `Invoice`, HTTP 201 |
| `GET /api/invoices/me` | Instructor or institution | Paginated own invoices |
| `GET /api/invoices` | Admin | Paginated invoices with admin filters |
| `GET /api/invoices/:id` | Invoice party or admin | `Invoice`; reconciles unsettled status with Stripe |
| `POST /api/invoices/:id/send` | Booking institution or admin | No body → `Invoice` |
| `POST /api/invoices/:id/void` | Admin | No body → `Invoice` |
| `POST /api/invoices/:id/refund` | Admin | `{}` or `{ amountPence?, reason? }` → `Invoice` |
| `POST /api/payments/webhooks/stripe` | Stripe only | Mobile must not call this route |

Showing an action only to the correct role improves the UI; the backend still enforces role and invoice ownership checks.

## API Envelope

Success:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Success message",
  "data": {},
  "meta": {
    "requestId": "uuid-or-client-request-id",
    "timestamp": "2026-10-05T12:00:00.000Z",
    "path": "/api/invoices",
    "method": "GET"
  }
}
```

Error:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation or business error",
  "error": "Bad Request",
  "data": null,
  "meta": {
    "requestId": "uuid-or-client-request-id",
    "timestamp": "2026-10-05T12:00:00.000Z",
    "path": "/api/invoices",
    "method": "POST"
  },
  "code": "OPTIONAL_ERROR_CODE"
}
```

Auth error codes can include:

- `AUTH_TOKEN_MISSING`
- `ACCESS_TOKEN_EXPIRED`
- `INVALID_ACCESS_TOKEN`

Mobile behavior:

- If access token is expired, run your existing refresh-token flow.
- If refresh fails, send the user to login.
- For `AUTH_TOKEN_MISSING` or `INVALID_ACCESS_TOKEN`, clear the invalid session and show login.
- Show user-friendly messages from `message`.
- Include `meta.requestId` in support/debug logs.

## Suggested Mobile API Client

```ts
type ApiEnvelope<T> = {
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

type ApiErrorEnvelope = {
  success: false;
  statusCode: number;
  message: string | string[];
  error: string;
  data: null;
  code?: string;
  meta?: {
    requestId?: string;
    timestamp?: string;
    path?: string;
    method?: string;
  };
};

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { accessToken?: string } = {},
): Promise<T> {
  // API_BASE_URL is the backend origin, without /api or a trailing slash.
  // Example: https://backend.example.com
  const { accessToken, headers: extraHeaders, ...requestOptions } = options;
  const headers = new Headers(extraHeaders);
  headers.set("Accept", "application/json");
  if (requestOptions.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    ...requestOptions,
    headers,
  });

  const body = (await response.json().catch(() => null)) as
    | ApiEnvelope<T>
    | ApiErrorEnvelope
    | null;

  if (!response.ok || !body || !body.success) {
    const errorBody = body?.success === false ? body : undefined;
    throw new ApiRequestError(response.status, errorBody);
  }

  return body.data;
}

export class ApiRequestError extends Error {
  readonly code?: string;
  readonly requestId?: string;

  constructor(readonly status: number, body?: ApiErrorEnvelope) {
    const message = Array.isArray(body?.message)
      ? body.message.join("\n")
      : body?.message || `Request failed (${status})`;
    super(message);
    this.name = "ApiRequestError";
    this.code = body?.code;
    this.requestId = body?.meta?.requestId;
  }
}
```

Define `API_BASE_URL` using the app's existing public configuration. Pass paths such as `/invoices/me`, not `/api/invoices/me`, to this helper. Add token refresh through the app's existing auth manager. A network exception may occur after a POST reached the backend, so preserve the pending operation context and refresh before allowing another attempt. Do not log tokens, OTP values, or entire hosted payment URLs.

## Shared Types

```ts
type Role = "INSTRUCTOR" | "INSTITUTION" | "ADMIN";

type User = {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
  emailVerified: boolean;
  phoneVerified: boolean;
  phone?: string | null;
  lastLogin?: string | null;
  twoFactorEnabled: boolean;
  createdAt?: string;
  updatedAt?: string;
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

type StripeLink = {
  url: string;
  expiresAt: string | null;
};

type PhoneOtpResponse = {
  phone: string;
  expiresInMinutes: number;
  resendAvailableInSeconds: number;
};

type PayoutSummary = {
  id: string;
  amountPence: number;
  method: string;
  status: string;
  arrivalDate: string | null;
};

type PayoutBalance = {
  pendingPence: number;
  availablePence: number;
  instantAvailablePence: number;
  instantDestination: { id: string; label: string } | null;
  recentPayouts: PayoutSummary[];
};

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
  rateAmount: number;
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
  createdAt: string | null;
  updatedAt: string | null;
};

type PaginatedInvoices = {
  invoices: Invoice[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
  };
};

type BookingInvoiceSummary = Pick<
  Invoice,
  "id" | "totalAmountPence" | "hostedInvoiceUrl" | "dueAt" | "paidAt"
> & { status: "OPEN" | "PAID" | "UNCOLLECTIBLE" };

type CreateInvoiceInput = {
  bookingId: string;
  unitsWorked?: number;
  poNumber?: string;
};

type RefundReason = "duplicate" | "fraudulent" | "requested_by_customer";
type RefundInvoiceInput = { amountPence?: number; reason?: RefundReason };
```

Money formatting:

```ts
export function formatPence(pence: number | null | undefined) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format((pence ?? 0) / 100);
}
```

Use this for `totalAmountPence`, `teacherAmountPence`, `feeAmountPence`, `amountRefundedPence`, `pendingPence`, `availablePence`, `instantAvailablePence`, and payout amounts. Do not use it for `rateAmount`.

## Mobile Screen Placement

Match the web app placements:

- Onboarding first screen: collect phone number only. Do not show the OTP verify button here.
- School onboarding, step 2 of 4: show **School postal code** in the institution details form and send it as `postalCode` in the institution profile payload.
- Onboarding final created-profile screen: show phone verification button/card only, using the profile phone already saved.
- Settings profile screen: show phone input plus verification controls. Phone changes are committed only after OTP verify succeeds.
- Teacher Settings or Billing/Earnings screen: show Stripe payout setup and dashboard link.
- Teacher Billing/Earnings screen: show payout balance, instant cash-out, and recent payouts.
- School Bookings screen: show invoice state for completed bookings, create invoice, pay invoice, refresh payment.
- School Billing screen: show invoice list, pay link, PDF, resend email, details.
- Admin Payments screen: show all invoices, filters, void/refund actions, and instructor payout lookup.

## Twilio Phone Verification

Backend sends SMS through Twilio. The phone is not changed on the user until OTP verification succeeds.

The backend normalizes the submitted value to E.164. A number without a `+country` prefix is interpreted as a UK number. In production, SMS configuration is required. In non-production, an unconfigured SMS provider can log the message instead of delivering it; the app does not receive an OTP in the response.

### Send OTP

```http
POST /api/auth/phone/otp/send
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Request:

```json
{
  "phone": "+447911123456"
}
```

Response `data`:

```json
{
  "phone": "+447911123456",
  "expiresInMinutes": 10,
  "resendAvailableInSeconds": 60
}
```

Mobile behavior:

- Allow local phone entry.
- On the final onboarding screen, use the saved phone and hide the editable phone input; phone entry belongs to the first screen or Settings.
- Send the user-entered phone string to the backend.
- Show the normalized `data.phone` after sending.
- Start a resend timer from `resendAvailableInSeconds`.
- Show code expiry using `expiresInMinutes`.
- Disable resend until the cooldown is finished.
- If the user edits the phone after sending a code, send a new code before verifying.
- Clear the previous code when changing the phone. The verify request contains only `otp`, and verifies the latest active OTP for the signed-in user.
- Track cooldown and expiry as absolute times (`Date.now() + seconds * 1000`) so backgrounding the app does not pause the countdown.
- On `409`, refetch `GET /api/auth/me` before deciding whether to show verified state.

Errors to handle:

- `400`: invalid phone number.
- `400`: unable to send an SMS to this phone number.
- `409`: this phone number is already verified.
- `429`: wait before requesting another code.
- `429`: too many verification codes requested.
- `503`: SMS service or sender not configured.
- `503`: unable to send SMS; show a retry option after the applicable cooldown.

### Verify OTP

```http
POST /api/auth/phone/otp/verify
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Request:

```json
{
  "otp": "123456"
}
```

Response `data`: `User`.

Important fields:

```json
{
  "phone": "+447911123456",
  "phoneVerified": true
}
```

Mobile behavior:

- Use numeric keyboard.
- Only allow 6 digits.
- Disable verify until 6 digits are entered.
- On success, update current user state from returned `User`.
- Synchronize phone and verified state in auth, settings, and onboarding caches; cancel an older profile read before it can restore stale state, then refetch these snapshots.
- In onboarding final screen, after success, the screen should show "Phone verified".
- Clear OTP and pending phone state on logout or account change.

Verification errors: `400` for a code that is not exactly six digits or an invalid/expired code. Repeated failed attempts can consume the code, requiring a new send. Keep OTP as a string so a leading zero is preserved.

## Onboarding Phone Flow

Use the same sequence as web:

1. First onboarding/account screen shows:
   - full name
   - phone number field
   - role/profile fields
2. Do not show OTP button on first screen.
3. User completes all onboarding steps.
4. User creates profile.
5. On the created-profile/final screen, show phone verification card:
   - no editable phone input
   - "Verify phone" button
   - send OTP to the saved profile phone
   - OTP entry after code is sent
6. Do not send profile for review until any required documents/approval steps are complete. Phone verification is separate, but the UI should strongly encourage verification after profile creation.

If the user changes the phone in onboarding before profile creation, treat it as an unverified phone. Profile creation should not silently replace an already verified phone with a new unverified number.

Initial profile creation can store an unverified phone through the existing profile/user basics flow (`PATCH /api/users/me` with `phone`). The OTP send endpoint itself does not save that new value; OTP verify returns the verified, normalized user phone. For an account whose current phone is already verified, retain that phone during profile creation and use Settings to verify a replacement.

If the created profile has no saved phone, show a short explanation and a link to Settings to add it. Keep the final onboarding card free of a second phone input. Phone verification is not a new requirement to create a booking, create an invoice, or submit a profile unless the backend explicitly requires it.

### School Postal Code On Step 2 Of 4

Place the required field beside the school's address and town in institution details, and validate it before continuing step 2. The website's form state calls it `postcode`, but the backend institution payload uses `postalCode`; keep that distinction when mapping mobile form values. School onboarding has four steps; teacher onboarding has two.

```ts
const postalCode = schoolPostalCode.trim();
if (!postalCode) throw new Error("Enter the school's postal code");
const institutionPayload = {
  ...existingInstitutionFields,
  postalCode,
};
```

The backend profile field is optional, but the onboarding UI intentionally requires it. Submit through the app's existing institution profile create/update flow (`POST /api/institutions` when creating). Retain the postal code when moving between onboarding steps and when reopening the saved profile. Use the app's existing address lookup if available; Stripe and Twilio do not provide this lookup.

## Settings Phone Flow

Settings can allow phone editing, but the backend phone value should change only after OTP verification.

Recommended behavior:

- Show phone input.
- Show current verified state.
- If the user edits phone, show "Verify phone".
- Call OTP send with the edited value.
- On OTP verify success, update profile state from returned `User`.
- Do not save phone through the general settings update endpoint.
- Saving other settings must not overwrite a just-verified phone. Keep the draft phone separate from the canonical `User.phone` until verification succeeds.
- Disable profile/settings save while OTP send/verify is running, and do not reset a user's unsent phone draft just because a background profile read completed.

"Phone verified" describes the phone only. The website's complete profile verification also depends on email, application/documents, and applicable trust approval. Successful OTP verification does not approve documents or automatically submit the profile for review.

## Stripe Connect Payout Setup

These endpoints are for `INSTRUCTOR`.

The backend creates a connected account on the first onboarding-link request and tries to prefill profile name, email, phone, and UK address. Stripe collects identity and payout destination details. `ready` means both `chargesEnabled` and `payoutsEnabled` are true; do not infer readiness from `connected` or `detailsSubmitted` alone.

### Get Payout Account

```http
GET /api/payments/payout-account
Authorization: Bearer <accessToken>
```

Response `data`:

```json
{
  "connected": true,
  "ready": true,
  "detailsSubmitted": true,
  "chargesEnabled": true,
  "payoutsEnabled": true,
  "requirementsDue": [],
  "disabledReason": null
}
```

Screen states:

- `connected=false`: show "Set up payouts".
- `connected=true`, `ready=false`: show "Continue payout setup" and missing requirements.
- `ready=true`: show "Manage payouts", balance, cash-out, and earnings.
- Show a friendly explanation when `disabledReason` is present and human-readable labels for `requirementsDue`.

Errors: `403` for the wrong role or missing instructor profile; `502`/`503` for provider failures when refreshing Stripe account state. Keep a failed status read distinct from an account that is not connected.

### Create Onboarding Link

```http
POST /api/payments/payout-account/onboarding-link
Authorization: Bearer <accessToken>
```

Request body: none.

Response `data`:

```json
{
  "url": "https://connect.stripe.com/setup/...",
  "expiresAt": "2026-10-05T12:30:00.000Z"
}
```

Mobile behavior:

- Open `url` in browser or in-app browser.
- On app foreground/return, refetch payout account.
- If Stripe link expires, call this endpoint again.

Important mobile note:

- Backend currently uses web return URLs from `FRONTEND_URL`.
- Those URLs are `${FRONTEND_URL}/payouts/return` and `${FRONTEND_URL}/payouts/refresh`.
- For native app, use universal links if available.
- Configure the HTTPS domain and those paths as app links or use a web bridge page. The current endpoint accepts no custom native return URL in the request body.
- If universal links are not ready, refetch payout status when the app becomes active.

Errors: `403` for a missing instructor profile; `409` if concurrent setup changed the account; `503` for missing Stripe configuration or `FRONTEND_URL`; `502`/`503` for provider errors. Generate a fresh link when the user retries, rather than storing an expired link.

### Create Dashboard Link

```http
POST /api/payments/payout-account/dashboard-link
Authorization: Bearer <accessToken>
```

Response `data`:

```json
{
  "url": "https://connect.stripe.com/express/...",
  "expiresAt": null
}
```

Use this for "Manage payouts".

After returning, refresh both payout account and balance. The backend requires `detailsSubmitted` before opening the dashboard and otherwise returns `400`. To match the website, show the main dashboard button when `ready` is true; keep "Continue setup" while readiness is false. Handle `403` and provider configuration/unavailability errors as well.

## Payout Balance And Instant Withdrawal

### Get Balance

```http
GET /api/payments/payout-account/balance
Authorization: Bearer <accessToken>
```

Response `data`:

```json
{
  "pendingPence": 25000,
  "availablePence": 15000,
  "instantAvailablePence": 10000,
  "instantDestination": {
    "id": "ba_123",
    "label": "Barclays ****2345"
  },
  "recentPayouts": [
    {
      "id": "po_123",
      "amountPence": 10000,
      "method": "instant",
      "status": "in_transit",
      "arrivalDate": "2026-10-05T12:30:00.000Z"
    }
  ]
}
```

Mobile UI:

- Show `instantAvailablePence` as "Available to withdraw now".
- Show `pendingPence` as "Pending".
- Show `availablePence` as available on Stripe standard schedule.
- Show recent payouts.
- Enable instant withdrawal only when:
  - payout account is ready and no withdrawal is pending
  - `instantAvailablePence >= 40`
  - `instantDestination !== null`

The backend returns a zero balance when the payout account is missing, not ready, or Stripe is not configured. Read payout-account state alongside balance so zero is not interpreted as proof that setup is complete. The response includes up to five recent payouts. Use `instantAvailablePence` exactly as returned; it already accounts for any configured instant payout fee. Do not calculate it from the other balances or deduct a second fee.

Refresh on screen focus, app foreground, return from Stripe dashboard, and after a withdrawal. Show provider read errors with a retry control, rather than replacing a failed read with a fake zero balance.

If no instant destination, show:

```text
Add a debit card in Manage payouts to withdraw instantly.
```

### Create Instant Payout

```http
POST /api/payments/payout-account/instant-payout
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Withdraw full instantly available balance:

```json
{}
```

Withdraw a specific amount:

```json
{
  "amountPence": 10000
}
```

Response status: `201 Created`

Response `data`:

```json
{
  "id": "po_123",
  "amountPence": 10000,
  "method": "instant",
  "status": "in_transit",
  "arrivalDate": "2026-10-05T12:30:00.000Z"
}
```

Mobile behavior:

- Show a confirmation sheet before calling.
- Disable the button while the request runs.
- On success, show success toast/sheet and refetch balance.
- If request times out, refetch balance/recent payouts before retrying.
- `amountPence`, if supplied, must be an integer at least `40` and must not exceed the freshly available instant balance.
- An HTTP 201 result means a payout was created. `pending` and `in_transit` are not confirmation that the money has reached the bank. Render `paid`, `failed`, and `canceled` from recent payouts as they change.
- Balance can change between opening the confirmation sheet and sending the request; show the backend's latest limit if it rejects the amount.

Errors:

- Finish setting up payouts before withdrawing.
- Bank account does not support instant payouts.
- Amount below GBP 0.40.
- Requested amount exceeds available instant balance.
- Stripe/provider unavailable.

These business validation errors use `400`; a missing instructor profile uses `403`; provider rejection/unavailability uses `502`/`503`. Backend idempotency reduces duplicate identical withdrawals, but the app must still block repeated taps and read balance/recent payouts after an uncertain result.

## Invoice Creation From Bookings

Use this on the school/admin completed booking screen.

```http
POST /api/invoices
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Request for daily/hourly:

```json
{
  "bookingId": "4d79c36a-6df5-4ca4-96a0-431f321f2ac3",
  "unitsWorked": 4.5,
  "poNumber": "PO-2026-0412"
}
```

Request for fixed:

```json
{
  "bookingId": "4d79c36a-6df5-4ca4-96a0-431f321f2ac3",
  "poNumber": "PO-2026-0412"
}
```

Rules:

- Only completed bookings can be invoiced.
- Teacher payout account must be ready.
- For daily/hourly, `unitsWorked` is required.
- For fixed, omit `unitsWorked`.
- Max two decimal places.
- `unitsWorked` must be between `0.01` and `9999.99` inclusive, with at most two decimal places. Send a JSON number, not the input string.
- With booking dates, daily units cannot exceed the number of booking days; hourly units cannot exceed that number multiplied by 24. Backend date calculation is authoritative.
- `poNumber` is optional, trimmed, max 100 chars; omit a blank value rather than sending an empty string.
- Do not send rates, totals, fees, currency, teacher pay, or pay type from the app.

Response `data`: `Invoice`.

Response status: `201 Created`. Keep invoice creation separate from the app's booking creation action: school/admin invoicing becomes available after completion, when agreed pay details exist and the teacher's Stripe payouts are ready.

After success:

- Show invoice details.
- Show `hostedInvoiceUrl` as the school payment link.
- Refetch bookings and invoice lists.

Errors: `400` for an incomplete booking, missing pay details, invalid units, units exceeding booking length, charge limits, or teacher payout setup not ready; `403` for a caller other than the booking institution/admin; `404` for a missing booking/institution; `409` for an existing invoice or creation already in progress; `502`/`503` for Stripe/configuration failures. On `409` or a network timeout, refetch booking/invoice state before offering another create action.

## Paying Invoice In Mobile

The app opens Stripe-hosted invoice pages.

Flow:

1. User taps "Pay invoice".
2. App opens `invoice.hostedInvoiceUrl` in browser/in-app browser.
3. Stripe handles card/payment.
4. User returns to app.
5. App calls `GET /invoices/:id`.
6. If `PAID`, show paid state.
7. If still `OPEN`, show pending state and "Refresh payment".

The website also exposes the hosted payment link for `UNCOLLECTIBLE` when a link exists. Preserve that behavior for the school: show the written-off status, and refresh from invoice detail after any payment. Hide payment actions for `PAID`, `VOID`, and `PENDING`.

Do not mark paid locally without backend confirmation.

Important backend behavior:

- `GET /invoices/:id` checks Stripe when local invoice is still unsettled.
- If Stripe says paid, backend updates local invoice and returns `PAID`.
- This handles delayed or missed webhook cases.
- It also reconciles Stripe `void` and `uncollectible` states. A provider error must be shown as a refresh failure; do not assume paid or unpaid from the error.

### Preventing The "Stripe Paid, Booking Pending" Bug

Use one invoice cache keyed by invoice id for booking cards, invoice detail, and Billing. A fresh detail response must override an older invoice embedded in a booking response. After fetching detail, update the matching booking summary or invalidate the booking list; refresh invoice lists too.

Render status from the latest backend-confirmed detail. As compatibility with the website's normalizer, uppercase a known status and treat a backend-provided `paidAt` as paid evidence. A closed browser, success-looking return URL, or Stripe page screenshot is not backend confirmation.

```ts
function confirmedInvoiceStatus(invoice: Pick<Invoice, "status" | "paidAt">): InvoiceStatus {
  if (invoice.paidAt) return "PAID";
  const status = invoice.status.toUpperCase();
  const statuses: readonly string[] = ["PENDING", "OPEN", "PAID", "VOID", "UNCOLLECTIBLE"];
  if (!statuses.includes(status)) throw new Error("Unknown invoice status");
  return status as InvoiceStatus;
}

function canPayInvoice(invoice: Invoice, role: Role): boolean {
  const status = confirmedInvoiceStatus(invoice);
  return role === "INSTITUTION"
    && (status === "OPEN" || status === "UNCOLLECTIBLE")
    && isStripeInvoiceUrl(invoice.hostedInvoiceUrl);
}
```

For the reported GBP 123.20 invoice, `totalAmountPence` is `12320`. When detail returns `PAID`/`paidAt`, replace "Awaiting payment" and "Pay invoice" with "Paid" and the payment date. If status remains unsettled, keep manual refresh and use bounded polling only while the invoice screen is visible and the app is active. Stop polling when paid/void, when the screen closes, on logout, or after a provider error; never poll indefinitely in the background.

## Invoice Detail

```http
GET /api/invoices/:id
Authorization: Bearer <accessToken>
```

Roles:

- invoice party
- admin

Response `data`: `Invoice`.

Use this endpoint:

- after returning from Stripe invoice payment
- when opening invoice detail
- when user taps refresh payment
- for admin refund/void context

Errors:

- `404`: invoice not found or caller cannot see it.
- `502` or `503`: Stripe provider issue while reconciling.
- `503`: Stripe is not configured when reconciliation is needed.

Parties cannot read `PENDING` invoices. Successful invoice-detail reconciliation depends on the updated backend being deployed; changing the app alone cannot reconcile an older backend that always returns stale local status.

## Invoice Lists

### My Invoices

```http
GET /api/invoices/me?page=1&limit=20&status=OPEN
Authorization: Bearer <accessToken>
```

Roles:

- instructor
- institution

Use for:

- teacher earnings list
- school billing list

Parties cannot see `PENDING`.

Query rules: `page` defaults to `1` and must be an integer at least `1`; `limit` defaults to `20` and must be an integer from `1` to `100`. Own-invoice status filters are `OPEN`, `PAID`, `VOID`, and `UNCOLLECTIBLE`. Response `data` is `PaginatedInvoices` (not a bare array).

Use `pagination.hasNextPage` for loading more, reset to page 1 when a filter changes, and deduplicate appended invoices by id. Refresh the first page after external payment and other mutations.

### Admin Invoices

```http
GET /api/invoices?page=1&limit=20&status=PAID&bookingId=...&instructorId=...&institutionId=...
Authorization: Bearer <accessToken>
```

Role:

- admin

Admin can filter by:

- `status`: `PENDING`, `OPEN`, `PAID`, `VOID`, `UNCOLLECTIBLE`
- `bookingId`
- `instructorId`
- `institutionId`

The same pagination defaults/limits apply. Filter ids must be UUIDs. `instructorId` and `institutionId` refer to the corresponding profile ids, not user ids.

## Resend, Void, Refund

### Resend Invoice Email

```http
POST /api/invoices/:id/send
Authorization: Bearer <accessToken>
```

Roles:

- institution
- admin

Only unpaid `OPEN` invoices can be resent.

No request body. Returns the updated `Invoice` with HTTP 200. Errors: `400` when it is no longer open/unpaid, `403` for a different institution, `404` if absent, and `502`/`503` for provider/configuration failures. Replace cached detail with the returned invoice and refresh lists.

### Void Invoice

```http
POST /api/invoices/:id/void
Authorization: Bearer <accessToken>
```

Role:

- admin

Voidable statuses:

- `OPEN`
- `UNCOLLECTIBLE`

No request body. Returns the updated `Invoice` with HTTP 200. A voided unpaid invoice allows the booking to be invoiced again. Errors: `400` for a non-voidable status, `403` for non-admin, `404` if absent, and `502`/`503` for provider/configuration failures. Refresh the booking summary and invoice lists after success so the old invoice cannot remain payable.

### Refund Invoice

```http
POST /api/invoices/:id/refund
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Full remaining refund:

```json
{}
```

Partial refund:

```json
{
  "amountPence": 2000,
  "reason": "requested_by_customer"
}
```

Role:

- admin

Rules:

- Invoice must be `PAID`.
- `amountPence` is optional.
- If supplied, `amountPence` must be an integer >= 1.
- `reason` can be `duplicate`, `fraudulent`, or `requested_by_customer`.
- Remaining refundable amount is `totalAmountPence - amountRefundedPence`; disallow a partial refund larger than that.
- Invoice must have a Stripe payment; an already fully refunded invoice cannot be refunded again.

Returns `Invoice` with HTTP 200. Errors: `400` for an unpaid/non-Stripe invoice, fully refunded invoice, or excessive amount; `403` for non-admin; `404` if absent; `502`/`503` for provider/configuration failures. Show amount and reason in a confirmation sheet, lock the submit action, and refetch detail after an uncertain network result.

Refund display is separate from invoice status: a paid invoice remains `PAID` and uses `amountRefundedPence` to show "Partially refunded" or "Fully refunded". Do not invent a `REFUNDED` API status. Display `disputeStatus` separately when present.

## Booking Invoice Summary

Booking responses include:

```json
{
  "invoice": {
    "id": "0d4ca099-8c9c-43f4-9a6e-7615b4d6d6bc",
    "status": "OPEN",
    "totalAmountPence": 91125,
    "hostedInvoiceUrl": "https://invoice.stripe.com/i/...",
    "dueAt": "2026-11-04T00:00:00.000Z",
    "paidAt": null
  }
}
```

Use the summary for cards/lists, but use `GET /invoices/:id` for latest truth before showing payment state after Stripe.

`booking.invoice` is `null` until there is a visible invoice. The summary is deliberately smaller than a full `Invoice`; fetch detail to show PDF, invoice number, fees, refunds, and disputes. Never cast the summary to a full invoice.

Booking summary statuses:

- `OPEN`
- `PAID`
- `UNCOLLECTIBLE`

Hidden from booking summary:

- `PENDING`
- replaced `VOID` invoices

## Admin Instructor Payout Lookup

```http
GET /api/payments/payout-accounts/instructor/:instructorId
Authorization: Bearer <accessToken>
```

Role:

- admin

Use this on admin payment tools to check whether a teacher can receive invoice payments.

Response `data`: `PayoutAccount`.

Use the instructor profile id from booking/profile responses. Admin lookup is read-only; the instructor-only onboarding, dashboard, balance, and cash-out endpoints should not be called using an admin's own token to act as a teacher.

## User Phone Fields And Admin Support

Carry `phone` and `phoneVerified` in current-user, profile, settings, and admin user views. Read current canonical values with `GET /api/auth/me` after OTP verification or an "already verified" response.

Admin user list filters include `GET /api/users?phoneVerified=true` and `GET /api/users?phoneVerified=false`. Existing admin user create/update bodies support `phone` and `phoneVerified`. A true verification flag requires a phone; changing phone resets verification unless an admin explicitly supplies the flag. These administrative capabilities are separate from normal user OTP verification and must stay in admin screens.

## Stripe Webhooks

The mobile app must not call:

```http
POST /api/payments/webhooks/stripe
```

Backend handles:

- `invoice.paid`
- `invoice.voided`
- `invoice.marked_uncollectible`
- `invoice.payment_failed`
- `charge.refunded`
- `charge.dispute.created`
- `charge.dispute.updated`
- `charge.dispute.closed`
- `account.updated`
- `v2.core.account...`

The app only observes the resulting backend state by refetching.

`invoice.paid` updates status/paid date; void/uncollectible events update status; payment-failed leaves the invoice open; refund/dispute events update their fields; account events update payout readiness. The backend records processed event ids to handle repeat delivery and retries events whose handler failed. App foreground/detail reads complement the webhook and do not replace its deployment.

## React Native External URL Helpers

Validate Stripe URLs before opening:

```ts
function isStripeConnectUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname === "connect.stripe.com"
      && !url.username && !url.password && !url.port;
  } catch {
    return false;
  }
}

function isStripeInvoiceUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "invoice.stripe.com" || url.hostname === "pay.stripe.com") &&
      !url.username &&
      !url.password &&
      !url.port
    );
  } catch {
    return false;
  }
}

// Invoice PDFs may be served from files.stripe.com or another Stripe host.
function isStripePdfUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && (url.hostname === "stripe.com" || url.hostname.endsWith(".stripe.com"))
      && !url.username && !url.password && !url.port;
  } catch {
    return false;
  }
}
```

Apply the appropriate validator to the backend-returned URL. Use the invoice validator for `hostedInvoiceUrl`, the PDF validator for `invoicePdfUrl`, and the Connect validator for onboarding/dashboard. Open using `Linking.openURL(url)` or the app's browser/session wrapper and handle opening errors. A successful `openURL` promise means the OS accepted the open request; it does not establish payment or onboarding completion. See [React Native Linking](https://reactnative.dev/docs/linking).

## React Native API Functions

The examples use the `apiRequest` helper and types above. The token comes from the app's existing auth store, not a hardcoded value. List query strings should use URL encoding and include only selected filters.

```ts
export const mobilePaymentsApi = {
  me: (accessToken: string) =>
    apiRequest<User>("/auth/me", { accessToken }),

  sendOtp: (accessToken: string, phone: string) =>
    apiRequest<PhoneOtpResponse>("/auth/phone/otp/send", {
      accessToken, method: "POST", body: JSON.stringify({ phone }),
    }),

  verifyOtp: (accessToken: string, otp: string) =>
    apiRequest<User>("/auth/phone/otp/verify", {
      accessToken, method: "POST", body: JSON.stringify({ otp }),
    }),

  payoutAccount: (accessToken: string) =>
    apiRequest<PayoutAccount>("/payments/payout-account", { accessToken }),

  onboardingLink: (accessToken: string) =>
    apiRequest<StripeLink>("/payments/payout-account/onboarding-link", {
      accessToken, method: "POST",
    }),

  dashboardLink: (accessToken: string) =>
    apiRequest<StripeLink>("/payments/payout-account/dashboard-link", {
      accessToken, method: "POST",
    }),

  balance: (accessToken: string) =>
    apiRequest<PayoutBalance>("/payments/payout-account/balance", { accessToken }),

  withdraw: (accessToken: string, amountPence?: number) =>
    apiRequest<PayoutSummary>("/payments/payout-account/instant-payout", {
      accessToken, method: "POST",
      body: JSON.stringify(amountPence === undefined ? {} : { amountPence }),
    }),

  createInvoice: (accessToken: string, input: CreateInvoiceInput) =>
    apiRequest<Invoice>("/invoices", {
      accessToken, method: "POST", body: JSON.stringify(input),
    }),

  invoice: (accessToken: string, id: string) =>
    apiRequest<Invoice>(`/invoices/${encodeURIComponent(id)}`, { accessToken }),

  myInvoices: (accessToken: string, queryString = "page=1&limit=20") =>
    apiRequest<PaginatedInvoices>(`/invoices/me?${queryString}`, { accessToken }),

  adminInvoices: (accessToken: string, queryString = "page=1&limit=20") =>
    apiRequest<PaginatedInvoices>(`/invoices?${queryString}`, { accessToken }),

  resendInvoice: (accessToken: string, id: string) =>
    apiRequest<Invoice>(`/invoices/${encodeURIComponent(id)}/send`, {
      accessToken, method: "POST",
    }),

  voidInvoice: (accessToken: string, id: string) =>
    apiRequest<Invoice>(`/invoices/${encodeURIComponent(id)}/void`, {
      accessToken, method: "POST",
    }),

  refundInvoice: (accessToken: string, id: string, input: RefundInvoiceInput = {}) =>
    apiRequest<Invoice>(`/invoices/${encodeURIComponent(id)}/refund`, {
      accessToken, method: "POST", body: JSON.stringify(input),
    }),

  instructorPayoutAccount: (accessToken: string, instructorId: string) =>
    apiRequest<PayoutAccount>(
      `/payments/payout-accounts/instructor/${encodeURIComponent(instructorId)}`,
      { accessToken },
    ),
};
```

## Returning From Stripe In React Native

Refresh when the relevant screen gains focus, on a browser-session close callback, and when a backgrounded app becomes active. Deduplicate these triggers so they do not launch simultaneous reconciliation reads. React Native exposes foreground transitions through `AppState`; remove the subscription during cleanup. See [React Native AppState](https://reactnative.dev/docs/appstate).

The following hook remembers what needs refreshing. Mount it in an authenticated app-level provider so navigation between screens does not discard its state. It does not poll or treat return links as proof of success.

This example supports one pending external flow at a time; disable opening a second Stripe flow until the first has returned and refreshed or been explicitly canceled. `clearReturn()` clears context but does not abort an in-flight request. The supplied refresh callback must check the current user/session generation before writing caches, and skip those writes if logout or account switching occurred.

```ts
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";

type StripeReturnContext =
  | { kind: "invoice"; invoiceId: string }
  | { kind: "payout-onboarding" }
  | { kind: "payout-dashboard" };

export function useStripeReturnRefresh(
  refresh: (context: StripeReturnContext) => Promise<void>,
  onError: (error: unknown) => void,
) {
  const pending = useRef<StripeReturnContext | null>(null);
  const refreshing = useRef(false);
  const refreshRef = useRef(refresh);
  const errorRef = useRef(onError);
  const previousState = useRef(AppState.currentState);

  useEffect(() => {
    refreshRef.current = refresh;
    errorRef.current = onError;
  }, [refresh, onError]);

  const refreshPending = useCallback(async () => {
    const context = pending.current;
    if (!context || refreshing.current) return;
    refreshing.current = true;
    try {
      await refreshRef.current(context);
      if (pending.current === context) pending.current = null;
    } catch (error) {
      // Keep the context for manual retry. Display a refresh error.
      errorRef.current(error);
    } finally {
      refreshing.current = false;
    }
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const returned = previousState.current !== "active" && nextState === "active";
      previousState.current = nextState;
      if (returned) void refreshPending();
    });
    return () => subscription.remove();
  }, [refreshPending]);

  const rememberReturn = useCallback((context: StripeReturnContext) => {
    pending.current = context;
  }, []);

  const clearReturn = useCallback(() => { pending.current = null; }, []);

  return { rememberReturn, refreshPending, clearReturn };
}
```

Implement the supplied `refresh(context)` callback using the app's API and cache/store:

| Return context | Required reads | State to synchronize |
| --- | --- | --- |
| Invoice payment | `GET /api/invoices/:id` | Invoice detail first, matching booking summary, Billing/invoice lists |
| Payout onboarding | `GET /api/payments/payout-account` | Teacher payout status; fetch balance if ready |
| Stripe dashboard | Account and balance | Setup status, destination, available balance, recent payouts |
| Instant cash-out success | Balance | Balance and recent payouts; retain returned payout while refresh runs |
| OTP success | Updated `User`, then current-user/profile refresh | Auth, Settings, onboarding phone/verified state |

Opening a school invoice looks like this in the screen's existing error-handled action:

```ts
import { Linking } from "react-native";

// invoice is the latest detail response; role is the authenticated role.
if (!canPayInvoice(invoice, role)) return;
const url = invoice.hostedInvoiceUrl;
if (!url) return;

stripeReturn.rememberReturn({ kind: "invoice", invoiceId: invoice.id });
try {
  await Linking.openURL(url);
} catch (error) {
  stripeReturn.clearReturn();
  showOpenLinkError(error); // Implement with the app's error UI.
}
// Refresh on return/focus, not on resolution of openURL.
```

For an in-app browser wrapper, call the same `refreshPending()` when its session closes, because an `AppState` transition is not guaranteed. Screen-focus refresh remains necessary if the context has already been cleared or the app was relaunched. Share an in-flight read per invoice id between these triggers.

For payout links, generate a fresh link, validate it, remember the onboarding/dashboard context, then open it with the same error handling. Clear all return state on logout and prevent late responses from updating another user's store. If the OS kills the app while Stripe is open, restore the invoice id/context from an existing session-scoped store or load the relevant screen and refetch. Do not persist access tokens or hosted links alongside the return context.

Handle `/payouts/return` and `/payouts/refresh` using the app's existing incoming-link router, including cold launches. A refresh link requests a fresh onboarding link; a return link requests a status read. Wait for authentication before calling endpoints, validate the configured app domain, and discard any client-supplied claim that payment/setup succeeded. The backend still uses the configured HTTPS return paths; native link routing must be configured separately.

## Mobile State And Action Rules

| Feature | States the UI should handle |
| --- | --- |
| Phone | Idle, sending, code sent, cooldown, verifying, verified, invalid/expired code, too many sends |
| Payout setup | Loading, not connected, creating link, external onboarding, more information needed, ready, provider unavailable |
| Balance | Loading, empty, no instant destination, ready, withdrawing, sent/in transit, failed/canceled |
| Invoice | Not created, creating, awaiting payment/overdue, external payment, refreshing, paid, void, uncollectible, partial/full refund |

Use a shared mutation lock for OTP actions and prevent other profile saves while the lock is held. A disabled button prevents normal repeated taps; a synchronous ref/lock in the handler also prevents two requests before the UI rerenders. Financial mutation state must be isolated from read-refresh state: if withdrawal creation succeeds but balance refresh fails, show "Withdrawal created; could not refresh balance", keep the returned payout, and offer refresh rather than another withdrawal.

## Backend Configuration Handoff

These values belong only on the backend; mobile public configuration needs the backend origin and existing app-link domain.

| Integration | Backend environment variables |
| --- | --- |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET`, `PROCESSING_FEE_PERCENT`, `INVOICE_DAYS_UNTIL_DUE`, `FRONTEND_URL` |
| Twilio/OTP | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID` or `TWILIO_FROM_NUMBER`, `PHONE_OTP_RESEND_COOLDOWN_SECONDS`, `PHONE_OTP_MAX_SENDS_PER_HOUR`, `OTP_TTL_MINUTES`, `OTP_MAX_ATTEMPTS` |

Use a matching backend/Stripe test environment for QA. Ensure Stripe webhook delivery and the invoice-detail reconciliation update are deployed. Return paths must resolve on the configured frontend domain. No Stripe React Native payment SDK or Twilio client SDK is required by the hosted invoice and backend OTP flows described here.

## Suggested Mobile Module Placement

Adapt names to the existing app rather than creating a second auth or networking stack.

```text
src/api/client.ts                       Envelope/error handling and existing auth integration
src/api/phone.ts                        OTP send and verify
src/api/payments.ts                     Connect, balance, instant payout, admin lookup
src/api/invoices.ts                     Create/list/detail/send/void/refund
src/features/phone/PhoneVerification.tsx Shared card with hidePhoneInput for final onboarding
src/features/payments/StripeReturn.tsx  App-level return context and refresh deduplication
src/screens/onboarding/AccountBasics    Existing phone field, no verification button
src/screens/onboarding/SchoolDetails    School postal code on step 2 of 4
src/screens/onboarding/ProfileCreated   Verification after role profile exists, no phone input
src/screens/settings/Profile           Editable phone draft plus verify controls
src/screens/settings/Payouts           Instructor setup/dashboard status
src/screens/billing/TeacherEarnings     Balance, cash-out, recent payouts, invoice history
src/screens/bookings/BookingDetails     Completed-booking invoice and payment status
src/screens/billing/SchoolInvoices      Own invoices, details, payment/PDF/resend
src/screens/admin/Payments              Invoice filters, void/refund, instructor payout lookup
```

## Website Files To Use As References

| Mobile behavior | Current website implementation |
| --- | --- |
| First-step phone field | `components/organisms/onboarding/steps/AccountBasicsStep.tsx` |
| Final verification card | `components/organisms/OnboardingPage.tsx` |
| OTP UI, cooldown and hidden input | `components/molecules/PhoneVerification.tsx` |
| Phone state synchronization | `features/auth/use-phone-verification.ts` |
| School postal code and payload mapping | `components/organisms/onboarding/steps/InstitutionDetailsStep.tsx`, `features/onboarding/actions.ts` |
| Payout settings | `components/organisms/PayoutSettings.tsx` |
| Earnings and instant cash-out | `components/organisms/BillingPage.tsx` |
| Booking invoice detail refresh | `components/organisms/BookingsPage.tsx` |
| Invoice details and status normalization | `components/organisms/InvoiceDetailsModal.tsx`, `features/payments/schemas.ts` |
| Mutation cache refresh | `features/payments/use-payments.ts` |
| External URL validation | `features/payments/stripe-links.ts`, `features/payments/invoice-links.ts` |

Port behavior and data contracts from these files. Browser-specific APIs and Next.js server actions need the React Native equivalents described above.

## QA Checklist

Phone:

- Invalid phone shows error.
- Send OTP starts cooldown.
- Resend disabled until cooldown ends.
- Wrong OTP shows invalid/expired.
- Correct OTP updates `phoneVerified`.
- A code beginning with zero verifies correctly.
- Editing phone invalidates the old entered code and requires a new send.
- App backgrounding does not pause resend/expiry timers.
- Already-verified `409` refetches the canonical current user.
- Logout/account switch discards code and prevents stale requests updating the new user.
- First onboarding screen does not show verification button.
- Final onboarding created-profile screen shows verification button without another phone input.
- Settings phone changes only commit after OTP verify.
- School postal code is required on step 2 of 4 and survives navigation/reload as `postalCode` in the institution profile.
- Phone verification does not approve documents or create an extra booking/invoice prerequisite.

Payout setup:

- New teacher sees setup CTA.
- Stripe onboarding opens.
- Returning to app refreshes status.
- Expired link creates a new link.
- Ready account shows manage payouts.
- Dashboard rejects incomplete setup gracefully.
- Both browser close and foreground return trigger a deduplicated refresh.
- App relaunch during onboarding restores/refetches relevant state.

Balance and instant payout:

- Zero balance disables withdrawal.
- No instant destination explains debit card requirement.
- Less than GBP 0.40 is blocked.
- Successful withdrawal refreshes balance and recent payouts.
- Timeout leads to balance refresh before retry.
- A successful payout creation followed by failed balance refresh does not offer an automatic second withdrawal.
- Recent payout status handles in-transit, paid, failed, and canceled.
- Already-net instant availability is displayed without another fee deduction.

Invoices:

- Fixed booking sends no `unitsWorked`.
- Daily/hourly booking requires `unitsWorked`.
- Units enforce two decimals, `0.01–9999.99`, and booking-duration limits.
- Blank PO number is omitted, nonblank PO number is trimmed.
- Duplicate invoice handles `409`.
- Payment opens Stripe invoice page.
- Returning from Stripe calls `GET /invoices/:id`.
- Paid invoice becomes `PAID`.
- A stale `OPEN` booking summary is replaced by fresh paid detail, including the GBP 123.20 scenario.
- Closing Stripe without payment retains open state and manual refresh.
- `UNCOLLECTIBLE` remains written off but can expose the hosted payment link as on the website.
- A void while the payment page is open disables payment after refresh and updates the booking.
- Payment failed remains `OPEN`.
- Admin can void unpaid invoice.
- Admin can refund paid invoice.
- Partial/full refund uses refunded amounts without creating a new API invoice status.
- Pagination resets on filtering and uses `hasNextPage`.
- Invoice PDF opens from an allowed Stripe file host.

Cross-cutting:

- Access-token expiry refreshes or returns to login.
- Support/debug logs include `requestId`.
- Money is formatted from pence.
- Mutation buttons are disabled while pending.
- App never calls Twilio, Stripe secret APIs, or Stripe webhook directly.
