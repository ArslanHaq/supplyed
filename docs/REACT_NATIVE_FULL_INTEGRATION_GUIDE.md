# SupplyED — complete React Native integration guide

**Reviewed 23 November 2026.** This is a source-based implementation specification for the teacher and school mobile app, matching the current website's business flows. It includes the backend request/response contract, validation, errors, lifecycle rules, native integration boundaries, and acceptance tests. Admin-only and provider callback endpoints are catalogued separately for completeness; they do not belong in the normal teacher/school app.

## Contents

1. [Version, scope and environment prerequisites](#version-scope)
2. [Architecture and existing React Native files](#native-architecture)
3. [HTTP, sessions, errors and cache behavior](#shared-transport)
4. [UI, money and UK calendar conventions](#shared-conventions)
5. [Authentication, onboarding, documents and verification](#identity-flows)
6. [Jobs, matching, applications, invitations, bookings and reviews](#hiring-flows)
7. [School billing, invoices, automatic/manual payments, tips and payouts](#payment-flows)
8. [Messaging, uploads, sockets and notifications](#realtime-flows)
9. [Native external-flow recovery, implementation order and acceptance tests](#implementation-plan)
10. [Appendix A: all227 backend handlers, paths, roles and source locations](#route-inventory)
11. [Appendix B: each operation's parameters, body and response codes](#operation-reference)
12. [Appendix C: request/response fields, validators and defaults](#schema-reference)
13. [Appendix D: backend enum values](#enum-reference)
14. [Appendix E: error-code source index](#error-reference)

Use chapters1–9 as the implementation guide and the appendices as the exhaustive contract lookup. Search for an endpoint, DTO name, error code or screen name. Source paths in this document are relative to the website/backend/native repository identified in chapter1; the file is portable and does not require access to this chat.


<a id="version-scope"></a>

## 1. Read this first: exact version and scope

| Component | Snapshot used |
|---|---|
| Website | `supplyed`, commit `91b055f` — optional teacher degree verification; earlier commits add payment recovery UI and fee-free tip wording |
| Backend | `supplyed-backend`, commit `597dabd` — Hedd degree checks and development test verification; includes flat **£18 per booking invoice** and no fee on tips |
| Website local changes | Paid attendance/period status, payment schedule popup, and live UK clock changes were uncommitted when reviewed; included and explicitly marked where deployment-dependent |
| Backend local changes | Paid attendance guard and `attendancePayroll.periods[].paid/shiftIds` were uncommitted; do not assume a deployed backend has these fields |
| Native reference tree | `/Users/waleed/Desktop/Waleed/App/supplyed-app`, commit `16d069b` plus its existing local changes; already includes secure sessions, native payment recovery and scheduling utilities |
| Other native checkout found | `/Users/waleed/Desktop/Waleed/supplyed-app`; it differs from the reference tree. Apply changes to the team's chosen checkout, not both automatically |

No application source was changed to create this document. No credentials, real authentication tokens, private keys or user test-account details are included.

### 1.1 Source and running server are temporarily different

During this review the backend checkout advanced from `8f018aa` to `597dabd`. The running `localhost:3003/api/docs-json` still advertised 180 paths/217 schemas and no degree routes. Loading the new source with the installed Prisma client failed because `DegreeCheckStatus` was undefined. That is an environment-generation mismatch, not evidence that the degree endpoints do not exist in the latest source.

The endpoint appendix was generated from **current source**: 227 HTTP handlers, 232 Swagger schemas and additional source-only DTOs. Current-source Swagger reflection was performed only for documentation, with enum values projected from the checked-out Prisma schema into the isolated reflection process; it did not start a server, connect to the database, run migrations or prove runtime readiness. The old running server's contract is not the release target of this guide.

Before testing the new app against the new backend, the backend owner must refresh dependencies/generated client, apply reviewed migrations to the intended database and restart/redeploy. For local development, from the backend directory:

```sh
cd '/Users/waleed/Desktop/Waleed/Backend /supplyed-backend'
pnpm install --frozen-lockfile
pnpm exec prisma generate
pnpm exec prisma migrate status
# Apply the repository's reviewed migrations to the intended environment:
pnpm exec prisma migrate deploy
pnpm run build
pnpm run dev
```

Use the repository's actual lockfile/package-manager policy if it differs; `pnpm install --frozen-lockfile` requires an existing compatible `pnpm-lock.yaml`. This document does not create one or change package managers. Do not run destructive reset/seed commands against an established database just to enable the app. The new degree migration is `20261117000000_degree_checks`; earlier payment notification migrations must also be present. Production migration/restart belongs in the existing deployment process.

Recheck `/api/docs-json`, `/api/health` where available, and authenticated feature endpoints after restart. The source lists all health paths in Appendix A; do not infer provider readiness from HTTP liveness alone.

### 1.2 Contract precedence

1. Backend DTO validators + controller + service + serializer at the reviewed commit define what is accepted and returned.
2. The domain chapters explain business rules and distinguish local patches.
3. The complete operation/schema appendices describe the transport. Swagger is useful but some required flags, examples and failure statuses are incomplete.
4. Website selectors decide what to display; they must not override authoritative backend payment, verification, eligibility or attendance state.
5. Provider documentation explains native SDK/link handling only; it does not invent SupplyED endpoints.

Examples are illustrative, with placeholder UUIDs and safe sample data. Unless labelled **full envelope**, response examples show `response.data` after exactly one unwrap. Do not copy example IDs into production. A file upload response may contain a short-lived URL: use the actual response, never a hard-coded sample.

<a id="native-architecture"></a>

## 2. Architecture: integrate the backend, reuse the existing native app

```text
React Native screen
  -> feature hook / state action
  -> typed feature API module
  -> shared protectedRequest / apiRequest
  -> Nest backend /api
  -> backend-owned PostgreSQL / Stripe / identity / mail providers
```

The website instead routes browser requests through Next.js API routes and server actions, authenticates with Auth.js cookies, then calls Nest. React Native should call Nest directly with bearer tokens. Do not implement native clients against Next.js server-action IDs, Auth.js CSRF/cookie exchanges, browser-only `/api/...` adapters or DOM-based React components.

For example, the web path `/api/onboarding/me` is a website adapter, not a Nest onboarding endpoint. The native app loads `/auth/me` or `/users/me` and the relevant `/instructors/me` or `/institutions/me`. The same distinction applies to the website `/api/teachers` adapter and backend `/instructors` routes. Use Appendix A to decide whether a route is actually a backend route.

### 2.1 Existing app files to extend

| Concern | Existing native source | Integration work |
|---|---|---|
| App lifecycle/navigation | `App.tsx`, `utils/navigation/appNavigation.ts`, `nextAccountScreen.ts` | Route by current session/profile state; retain pending invitation/payment return through login |
| URLs | `constants/env.ts`, `constants/api.ts`, `constants/endpoints.ts` | Use one environment-consistent backend `/api` base; add missing current endpoints |
| Session | `utils/api/session.ts` | Reuse Keychain, session generation, account identity and token replacement |
| HTTP | `utils/api/request.ts`, `response.ts` | Reuse envelope parsing, status/code/field errors, single-flight refresh, timeout and account-switch guards |
| Auth | `feature/auth/` | Align challenge-token flow and profile loading with chapter3 |
| Onboarding | `feature/onboarding/`, `utils/onboarding/` | Use backend requirements, school scope and profile completion data |
| Jobs | `feature/dashboard/school/`, teacher equivalents, `utils/jobs/` | Port current field/rate/schedule rules, not web DOM |
| Calendar and booking | `utils/jobs/londonTime.ts`, `bookingAgenda.ts`, `paymentReleaseSchedule.ts`, `utils/bookings/bookingActions.ts` | Preserve UK calendar dates; map immutable accepted terms |
| Payments | `feature/dashboard/shared/apis/paymentsApi.ts`, `constants/paymentSessionsApi.ts`, `utils/payments/` | Add current statuses/fields and durable external-flow reconciliation |
| Live events | `feature/dashboard/shared/hooks/useConversationSocket.ts` | Use supported access-token/socket-ticket handshake, reconnect and REST catch-up |
| Uploads | `utils/api/upload.ts`, `utils/documents/`, `utils/images/` | Reuse binary upload/session guard; separate API auth from signed storage URL |
| UI | `components/Ui/`, shared rich text and dropdown utilities | Use themed accessible native controls; sanitize rendered HTML |

The reference app uses React Native0.87.1, React19.2.3, Redux Toolkit, Keychain, Socket.IO, document picker, and Stripe React Native0.80.0 according to its package file. These are the reviewed repository declarations, not a recommendation to upgrade another app to those versions. Extend the existing Redux and feature API pattern; do not install a second cache/navigation system merely because the web uses React Query/Next routing.

### 2.2 Environment matrix

| Target | Backend base URL example | Notes |
|---|---|---|
| iOS simulator on the development Mac | `http://localhost:3003/api` | Match actual backend port |
| Android emulator | `http://10.0.2.2:3003/api` | Emulator loopback differs from the Mac |
| Android via USB reverse forwarding | `http://localhost:3003/api` | First run `adb reverse tcp:3003 tcp:3003` |
| Physical device on same network | `http://<MAC_LAN_IP>:3003/api` | Device must reach Mac; development network policy must permit HTTP |
| Distributed build | `https://<API_HOST>/api` | HTTPS; never bake localhost or development provider secrets into release |

`3000` is the website, `3003` is the local backend in this setup, and `3001` is the separate admin website. Verify current deployment configuration rather than assuming these ports elsewhere. Avoid a double `/api/api` prefix.

The reference native app currently points at a remote development backend while the reviewed server is local; matching source does not prove the remote deployment has it. Keep API host, payment web-return host, Stripe test/live environment, identity providers and account database aligned. Configure allowed return URLs on the backend before relying on a native callback. Never include DATABASE_URL, Stripe secret/webhook keys, SMTP, AWS, Twilio, Hedd or JWT-signing secrets in app env. Only documented public configuration such as API origin and Stripe publishable key is client-visible.

<a id="shared-transport"></a>

## 3. Shared HTTP, authentication and error foundations

### 3.1 Global transport

Authenticated REST:

```http
GET /api/bookings/me?page=1&limit=20 HTTP/1.1
Host: <API_HOST>
Accept: application/json
Authorization: Bearer <accessToken>
```

JSON writes add `Content-Type: application/json`. Do not add JSON headers to multipart or signed raw uploads. The Nest validation pipe transforms annotated fields, strips nothing silently when a forbidden field is supplied (`whitelist:true`, `forbidNonWhitelisted:true`), and returns400 for unknown properties. Only send the DTO's allowed fields; remove UI state, read-only fields and `undefined` values.

Success **full envelope**:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Success",
  "data": { "items": [] },
  "meta": {
    "requestId": "example-request-id",
    "timestamp": "2026-11-23T10:00:00.000Z",
    "path": "/api/example",
    "method": "GET"
  }
}
```

`items` above illustrates the envelope only; real collections have endpoint-specific keys such as `jobs`, `bookings`, `applications`, `notifications` or `messages`. Never assume all list APIs return `items`. POST defaults to201 unless explicitly decorated200. DELETE/other void handlers can return JSON with `data:null`; handle204 too. Signed download redirects, binary responses and Socket.IO events do not use the same JSON shape.

Error **full envelope**:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Shift minutes must be 00; choose whole-hour start and end times.",
  "error": "Bad Request",
  "data": null,
  "code": "INVALID_JOB_SCHEDULE",
  "fieldErrors": { "schedule": "Shift minutes must be 00; choose whole-hour start and end times." },
  "meta": {
    "requestId": "example-request-id",
    "timestamp": "2026-11-23T10:00:00.000Z",
    "path": "/api/jobs",
    "method": "POST"
  }
}
```

`message` can be a string or string array. `code`, `fieldErrors` and `retryAfter` are optional. Field errors can contain strings or arrays: normalize to `Record<string,string[]>`. Read `X-Request-Id` when present; use `meta.requestId` as fallback. Respect `Retry-After`/`retryAfter` for429. Keep unknown error codes, but do not show raw provider internals or stack traces.

### 3.2 App error behavior

| Failure | Required app response |
|---|---|
|400 validation | Keep draft, map fieldErrors, focus first invalid input; show message fallback |
|401 `ACCESS_TOKEN_EXPIRED`, `INVALID_ACCESS_TOKEN`, `AUTH_TOKEN_MISSING` | Coordinate one refresh, replace both tokens, retry original request once only after an access-token rejection |
|401 invalid password, OTP, current-password or 2FA proof | Display form error; do not turn it into a token refresh loop |
|403 | Show unavailable/permission/state explanation; refetch user/profile if state may have changed; do not immediately destroy an otherwise valid session |
|404 resource | Show no longer available; clear stale selection, not the whole account |
|409 business conflict | Refetch authoritative record; explain locked terms/already applied/filled booking/invoice state; do not blindly repeat the write |
|413/415 upload | Enforce endpoint size/type; choose another file |
|429 | Disable affected resend/submit action until cooldown; preserve draft; foreground expiry should recalculate from a timestamp |
|5xx/provider unavailable | Keep user input; retry reads with bounded backoff; writes require reconciliation before retry |
|Timeout/no connection | Outcome of a write is unknown, not necessarily failed. Refresh resource/list before offering a new payment, application, invite or message |
|HTML/non-JSON response | Preserve HTTP status/requestId; show an invalid-response/service message; do not crash parsing |
|App closed/account changed mid-request | Ignore old result and stop old-account side effects; use session generation checks |

No general client retry policy may replay arbitrary POST/PATCH operations after network failure. Backend idempotency differs by route. Disable double taps and retain identifiers such as saved draft ID, existing invitation ID, invoice ID and setup session ID. Do not invent an `Idempotency-Key` contract on routes that do not document one.

### 3.3 Reuse the current native request functions

The existing `apiRequest<T>(path,method,body,token,options)` handles public/explicit-token operations; `protectedRequest<T>(path,method,body)` handles the current access session. The latter refreshes only explicit access-token errors and checks session generation before applying/replaying results. Reuse it for new features, including degree checks.

```ts
// Feature API module example, adapting import paths to the feature directory.
import { protectedRequest } from '../../../utils/api/request';

export function queryPath(path: string, input: Record<string, string | number | boolean | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const suffix = query.toString();
  return path + (suffix ? '?' + suffix : '');
}

export function getBookings(page = 1, limit = 20) {
  return protectedRequest<PaginatedBookings>(queryPath('/bookings/me', { page, limit }));
}
// PaginatedBookings must mirror PaginatedBookingsResponseDto in Appendix C.
```

For an OTP proof, pass the **challenge** token to `apiRequest`, not `protectedRequest`'s access token. Separate access, refresh, email OTP, password reset, 2FA challenge and socket token roles. Challenge tokens must never unlock the workspace.

Keychain is already implemented. Persist refreshed access+refresh tokens atomically; persist the replacement token pair returned by refresh. This backend does not invalidate a prior refresh JWT merely because refresh was called. Multiple screens must share the refresh promise. On logout, increment session generation, clear tokens/cache/account state, disconnect sockets, and cancel/reject pending old-account actions. On transient refresh network failure, retain the ability to retry; on rejected/expired refresh, return to login. Do not preserve one school's pending checkout as another school's active flow.

### 3.4 Navigation, loading and cache consistency

On app start, restore session securely; refresh if needed; load user and role profile; derive onboarding/compliance/workspace route from server state. On foreground, reconcile active payment flow, refresh booking/attendance/billing/notifications and reconnect socket once. Avoid firing these requests continuously while backgrounded.

| Mutation/event | Refresh affected data |
|---|---|
| Profile/onboarding/phone save | Current user, role profile, completion, eligibility, public profile |
| Subjects/school phase edit | Teaching catalogue scope, job defaults, matches |
| Job create/publish/edit/close | My jobs, discovery, dashboard, job detail, matches |
| Application/status/hire | Applications, job counts/status, booking list, availability, dashboard, notifications |
| Invitation create/accept/decline | Invitations, booking list, job staffing, conversations, availability, notifications |
| Attendance/correction/review | Booking detail, payroll/periods, invoices, billing, dashboards |
| Card/switch/payment return/paid/failure | School billing, relevant booking, current invoice/history, paid filters, notifications |
| Payout onboarding/reconciliation | Payout account, balances, eligibility/completion, teacher billing |
| Message received/read | Relevant thread, participant inbox, unread counts; deduplicate by server ID |
| Admin approval/rejection/provider result | Profile/completion/requirements, feature gates; refetch on focus or bounded polling |

Use per-user cache keys and clear on account change. Preserve list filters on detail/back. Distinguish initial loading, empty success, retryable error and stale-data-refresh; a network error is not an empty list. Cancel obsolete searches and paginate with server metadata/cursors. Deduplicate merged pages by stable resource ID.

<a id="shared-conventions"></a>

## 4. Native UI and calendar conventions shared by every flow

- Currency totals from backend are integer pence; display with `Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'})` after dividing by100. Rates may be decimal pounds; do not confuse rate fields with `*Pence` fields. Do not recalculate fees or final payable totals in the app.
- Assignment input dates are UK calendar strings `YYYY-MM-DD`. Instants such as scheduledStart/End, invoice paidAt and createdAt are ISO strings; render with the record's explicit IANA timezone. Do not use device timezone for UK assignments.
- Never derive UK calendar dates with `new Date(iso).toISOString().slice(0,10)` or `iso.slice(0,10)` when `iso` represents a UK midnight instant. BST midnight can be the preceding UTC day. Preserve date-only input until submission and format instant-to-date in `Europe/London`.
- `day` in the recurring schedule is0 Sunday through6 Saturday. Work is generated from selected days across the inclusive date range; outside-range weekday controls are disabled. Two Tuesday/Wednesday dates cannot silently include Monday/Thursday. Longer ranges repeat selected weekdays; weekends are optional rather than auto-selected.
- Use the same themed native dropdown component for rate basis, release frequency, currency, period anchor, editor fonts/colours and catalogue selections. Colour labels should be names rather than bare hex values; store the underlying colour value.
- Keep rate basis (`hourly`, `daily`, `fixed`) separate from release frequency (`daily`, `weekly`, `monthly`, `completion`). The current web form removes hourly release; fixed work offers completion. Compatibility behavior in the backend is described in the hiring chapter.
- Render rich text safely using the existing sanitization/render pipeline. Never render HTML directly as a native Text string; never execute injected scripts or arbitrary navigations. Preserve allowed proposal/description formatting when sending HTML; validate plain-text character counts.
- Accessibility: label every input/control, expose disabled/loading state, keep field errors adjacent, support font scaling and keyboard avoidance, and avoid live screen-reader announcements every second from clocks.
- UK clock: use `Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h12'})`; uppercase AM/PM for current web parity. Update from `new Date()` each second while foregrounded, stop on unmount/background, and resync on return. This is a display using device clock accuracy, not an authority for releasing money.

A safe UK date conversion utility for an instant:

```ts
export function ukDateOfInstant(iso: string): string {
  const instant = new Date(iso);
  if (!Number.isFinite(instant.getTime())) throw new Error('Invalid date');
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
```

This corrects client display, not server-side payment grouping. Do not claim a native-only formatting fix resolves a backend eligibility defect.


<a id="identity-flows"></a>

## Identity, authentication, onboarding and account integration

This chapter uses backend paths relative to the API base, which already includes `/api`. JSON examples are the successful envelope's **`data` value**, unless explicitly shown as an HTTP request. Do not copy Next.js server actions, Auth.js cookies, or frontend `/api/...` proxy response shapes into the native client. The native app calls the Nest API with bearer tokens.

### Roles and account bootstrap

| Website term | API role | Own profile endpoint |
|---|---|---|
| Teacher | `INSTRUCTOR` | `GET /instructors/me` |
| School / MAT school | `INSTITUTION` | `GET /institutions/me` |
| Administrator | `ADMIN` | Admin routes; separate from the ordinary school/teacher app |

`GET /auth/me` and `GET /users/me` return account data, **not** an onboarding snapshot and **not** `instructorProfileId`, `institutionProfileId` or `applicationStatus`. Bootstrap those separately. A teacher's user ID, instructor profile ID, application ID and booking ID are different identifiers; never substitute one for another.

```ts
type ApiRole = 'INSTRUCTOR' | 'INSTITUTION' | 'ADMIN';
type User = {
  id: string; email: string; name?: string | null; role: ApiRole;
  emailVerified: boolean; phoneVerified: boolean; phone?: string | null;
  twoFactorEnabled: boolean; lastLogin?: string | null;
  createdAt?: string; updatedAt?: string;
};
type ProfileStatus = 'INCOMPLETE' | 'PENDING' | 'ACTIVE' |
  'SUSPENDED' | 'DEACTIVATED' | 'REJECTED';
```

Website display normalization is `ACTIVE → approved`, `PENDING → pending_review`, `INCOMPLETE → none`, `DEACTIVATED → none`, `REJECTED → rejected`, `SUSPENDED → suspended`; retain raw API status in your domain layer. Do not send these lowercase UI strings back to the API. Owner submission endpoints choose `PENDING` server-side and accept no status body.

Native routing difference to reconcile: the current reference app's `nextAccountScreen.ts` sends non-ACTIVE profiles to its review-status screen. For web parity, adapt this deliberately: DEACTIVATED is an onboarding/resubmission state and PENDING may enter the restricted workspace under backend guards. Do not simply keep the old native gate while claiming identical web behavior.

On app launch after loading tokens:

1. Fetch `/auth/me` with the access token. Use the common single-flight refresh procedure on a genuine access-token expiry.
2. Fetch `/instructors/me` or `/institutions/me`. A **404 from this own-profile endpoint** means no profile has been created, so open onboarding. Do not convert all API/network/403 failures into an empty profile.
3. Load `/document-requirements/profile`, paginated `/documents`, `/profile-completion/me`; school additionally loads its applicable compliance/signatory approval; teacher loads `/identity-verification/me` and `/dbs-checks/me`.
4. Route from actual profile existence/status and outstanding requirements, not from completion percentage alone. `PENDING` may enter the website workspace with restricted actions; it does not imply approval. `REJECTED` returns to correction/resubmission, and `SUSPENDED` shows a restricted status screen.
5. Re-fetch these resources after app foregrounding and any approval, upload, payment-method or verification change. Server-side guards remain authoritative even if a cached screen looked enabled.

### Auth endpoint contract

| Method and path | Authentication | Request body | Successful `data` |
|---|---|---|---|
| `POST /auth/register` | None | `{email,password,role}`; role `INSTRUCTOR` or `INSTITUTION` | Email-verification response |
| `POST /auth/login` | None | `{email,password}` | Auth response **or** email-verification response **or** 2FA challenge |
| `POST /auth/oauth/google` | None | `{credential,role?}`; Google ID token, role required for first signup | Auth response or 2FA challenge |
| `POST /auth/refresh` | None | `{refreshToken}` | Auth response with replacement token pair |
| `POST /auth/email/otp/resend` | None | `{email}` | `{emailVerified,expiresInMinutes,otpToken?}` |
| `POST /auth/email/otp/verify` | **Email-verification `otpToken`** as bearer | `{otp:"123456"}` | Auth response |
| `POST /auth/password/forgot` | None | `{email}` | `{otpToken,expiresInMinutes}` |
| `POST /auth/password/reset` | **Password-reset `otpToken`** as bearer | `{otp,password}` | `{passwordReset:true}` |
| `POST /auth/2fa/verify` | **`twoFactorToken`** as bearer | `{code}` | Auth response |
| `GET /auth/me` | Access token | None | `User` |
| `GET /users/me` | Access token | None | `User` |
| `PATCH /users/me` | Access token | `{name?,phone?}` | Updated `User` |

Registration creates a 201 response; most auth POST endpoints explicitly return 200. Password rules in the reviewed DTO: minimum 8 characters, at least one uppercase letter, one digit and one non-alphanumeric character. The website also caps its password input at 128. Normalize email by trimming and lowercasing. Preserve leading zeroes in six-digit OTPs: they are strings.

Auth response shape:

```json
{
  "user": {
    "id": "<user-uuid>", "email": "teacher@example.com", "name": "Alex Teacher",
    "role": "INSTRUCTOR", "emailVerified": true, "phoneVerified": false,
    "phone": null, "twoFactorEnabled": false
  },
  "accessToken": "<opaque-access-jwt>",
  "refreshToken": "<opaque-refresh-jwt>",
  "accessTokenExpiresAt": "2026-11-23T12:15:00.000Z",
  "accessTokenExpiresInSeconds": 900,
  "refreshTokenExpiresAt": "2026-11-30T12:00:00.000Z",
  "refreshTokenExpiresInSeconds": 604800
}
```

The times/lifetimes above are illustrative; honor the returned values. Do not assume a perpetual 15-minute/7-day configuration. Store the replacement refresh/access pair atomically in platform-secure storage, never in navigation parameters or logs. On logout clear secure storage, in-memory tokens, account-specific query cache and sockets. The reviewed auth controller has **no logout/revoke endpoint**: do not invent `/auth/logout` or claim server revocation occurs when the app only clears local state.

Email-verification response:

```json
{"user":{"id":"<uuid>","email":"teacher@example.com","role":"INSTRUCTOR","emailVerified":false,"phoneVerified":false,"twoFactorEnabled":false},"otpToken":"<email-purpose-token>","expiresInMinutes":5}
```

Treat an HTTP-success login without access tokens as a challenge, not an authenticated session. An existing unverified signup can be updated by registration and receives another verification code. Already-verified duplicate registration returns 409. Resend for an already-verified address returns `{emailVerified:true,expiresInMinutes:0}`; return to login instead of opening another OTP screen. Each resend may return a **new** challenge token; replace the old challenge token.

2FA challenge:

```json
{"twoFactorRequired":true,"twoFactorToken":"<2fa-purpose-token>","expiresInMinutes":5}
```

Use a distinct challenge state, clear entered passwords and old OTPs, and do not open the workspace until `/auth/2fa/verify` returns access tokens. The generic API refresh interceptor must **not** refresh or replace OTP-purpose tokens. OTP purpose enforcement prevents using email/reset/2FA tokens interchangeably.

Password recovery intentionally returns a decoy challenge for an unknown email, so the native UI should show the same neutral "If an account exists..." message. Successful password reset returns only `{passwordReset:true}`; return to login, not directly to the workspace.

Google login accepts the provider **ID token** in `credential`, not an arbitrary email, OAuth authorization code or provider access token. Configure a native Google client with an audience accepted by the backend; verify this before enabling the button. Only Google has a backend exchange route in this checkout. The website may configure Microsoft through Auth.js, but there is no matching native Nest Microsoft endpoint verified here; do not advertise it as implemented.

### Phone verification

Phone verification uses the ordinary access token; it is independent of email OTP.

```http
POST /api/auth/phone/otp/send
Authorization: Bearer <accessToken>
Content-Type: application/json

{"phone":"+447911123456"}
```

```json
{"phone":"+447911123456","expiresInMinutes":5,"resendAvailableInSeconds":60}
```

Then `POST /auth/phone/otp/verify` with `{"otp":"012345"}` returns the updated `User`. The verified number is the number stored with the OTP record, so do not submit a new number with the verify request. Backend accepts at most 30 characters for the send input and normalizes E.164; unprefixed input is interpreted as UK. Preserve website parity by displaying a UK input and storing normalized E.164.

The server enforces resend cooldown and sends-per-hour limits (defaults 60 seconds and 5/hour; configuration can change). Drive the button countdown from returned `resendAvailableInSeconds`; honor 429 and the common error retry metadata if present. A cooldown error can also be a plain message, so not every 429 contains a numeric field. Wrong, expired or exhausted code: 400 `Invalid or expired verification code`; already-verified same number: 409. On success replace cached account data and stop the timer. Website settings makes a verified phone read-only; do not silently change it through a plain profile patch and retain a verification badge.

### Authenticator setup and recovery codes

All management endpoints below require the current access token:

| Endpoint | Input | Output `data` |
|---|---|---|
| `GET /auth/2fa/status` | None | `{enabled,setupPending,recoveryCodesRemaining}` |
| `POST /auth/2fa/setup` | No body | `{secret,otpAuthUri,qrCodeDataUrl}` |
| `POST /auth/2fa/enable` | `{code:"123456"}` | `{enabled:true,recoveryCodes:string[]}` |
| `POST /auth/2fa/disable` | `{code}` | `{enabled:false}` |
| `POST /auth/2fa/recovery-codes` | `{code}` | `{recoveryCodes:string[]}` |

Enable accepts a six-digit TOTP only. Disable, recovery-code regeneration and login verification accept either six digits or a one-time recovery code shaped `XXXX-XXXX-XXXX-XXXX` from the unambiguous alphabet `A-HJ-NP-Z2-9`, case-insensitive. Show the QR/manual key during setup; show recovery codes only when returned and require an explicit acknowledgement that the user saved them. Do not persist them in the ordinary settings cache. Backend replay protection can reject an already-used TOTP time step: display the actual error and let the user wait for the next code rather than repeatedly sending the same value.

Relevant failures: 409 already enabled or setup changed; 400 setup not started, invalid enable code, not enabled; 401 invalid/expired login verification; 429 challenge throttling. Never infer success from the setup QR alone. Invalidate `/auth/2fa/status` and `/auth/me` after management mutations. Admin disable exists separately and must not be exposed in the school/teacher UI.

### Onboarding: shared contact step

The web's "Save on Continue" behavior corresponds to real API writes, not only local form state:

1. Load the existing account and role profile, and prefill server values.
2. Verify email via auth flow, collect full/display name and phone, verify phone separately.
3. `PATCH /users/me` with changed account fields, e.g. `{"name":"Alex Teacher"}`. Fields such as profile location, subjects and rates belong to the role profile, not this request.
4. Create a role profile once; subsequent steps use PATCH with its returned profile ID. On a duplicate-create 409, reload `/me` and reconcile instead of issuing repeated POSTs.
5. Preserve local unsaved draft on network failure and show field errors. Do not advance a step or show "saved" until the server acknowledges the corresponding write.

### Teacher profile contract and submit flow

| Endpoint | Use |
|---|---|
| `POST /instructors` | Create own teacher profile; `INSTRUCTOR` role |
| `GET /instructors/me` | Load own complete profile |
| `PATCH /instructors/:id` | Update own profile, sending only changed supported fields |
| `PATCH /instructors/me/status` | Submit/resubmit for review, **no status payload** |
| `GET /instructors/profile/:id` | Public-profile projection for authenticated permitted viewers |

Create body fields:

| Field | Requirement / type |
|---|---|
| `fullName` | Required nonempty string |
| `imageUrl` | Optional legacy field; use signed profile-image flow instead |
| `bio` | Optional string |
| `address`, `city`, `county`, `postalCode` | Optional strings, max250/100/100/20; website requires appropriate UK address completion |
| `countryCode` | ISO alpha-2, website `GB` |
| `subjects`, `skills` | Unique string arrays, maximum50; values from catalogue; each nonempty, max100 |
| `otherSubjects`, `otherSkills` | Custom names when selection includes `Other`; same limits |
| `keyStages` | Unique nonempty string array from catalogue |
| `hourlyRate`, `dailyRate` | Nonnegative numbers in major currency units (e.g.25.50 GBP), not pence |
| `experience` | Nonnegative integer years |
| `currency` | ISO4217 string; website GBP |
| `maxTravelDistance` | Nonnegative number in miles |

```json
{
  "fullName":"Alex Teacher", "address":"1 School Lane", "city":"London",
  "county":"Greater London", "postalCode":"SW1A 2AA", "countryCode":"GB",
  "bio":"Experienced primary mathematics teacher.",
  "subjects":["Mathematics"], "skills":["Counting"], "keyStages":["KS2"],
  "hourlyRate":25.5, "dailyRate":180, "currency":"GBP", "experience":5,
  "maxTravelDistance":20
}
```

Catalogue values in examples must be present in the environment's returned catalogue; do not hard-code this sample as a universally accepted selection. The response adds `id,userId,status,dbsVerified,ratingAverage,ratingCount,latitude,longitude,createdAt,updatedAt`. Rates serialize as numbers; nullable optional profile fields can be null. Latitude/longitude are derived server-side, not client write fields.

Before final submit: save profile, load current document requirements and documents, ensure required uploads exist, and complete TrustID when required. Submit via `PATCH /instructors/me/status`. A status-transition race can return 400/409; reload and accept the already-achieved target state, rather than creating another profile. Current owner transitions are `INCOMPLETE|DEACTIVATED|REJECTED → PENDING`; owners cannot promote themselves to `ACTIVE`, clear suspension, or arbitrarily switch statuses.

A document upload and approval are different states. Protected hiring actions re-check required documents and their expiry on every request. `INSTRUCTOR_DOCUMENTS_NOT_VERIFIED` is a 403 requiring document correction/review. Even an optional document that has actually been submitted can block protected actions while pending/rejected/expired, according to the current server document guard; do not assume "optional" means every submitted state is ignored.

### School / MAT profile contract and submit flow

| Endpoint | Use |
|---|---|
| `POST /institutions` | Create own school profile; `INSTITUTION` role |
| `GET /institutions/me` | Load own complete school profile |
| `PATCH /institutions/:id` | Update own profile |
| `PATCH /institutions/me/status` | Submit/resubmit for review; no status payload |
| `GET /institutions/profile/:id` | Authenticated public projection |

Create requirements: `name` nonempty max200, `schoolType:PRIMARY|SECONDARY`, `domain` fully qualified domain without scheme/path, `address` nonempty max250, `city` nonempty max100. Optional fields: `registrationId` max100, `imageUrl` legacy, `county` max100, `postalCode` max20, ISO alpha-2 `countryCode`, unique catalogue `staffingNeeds` strings (max50×100), `otherSubjects`, `coverTypes` max20×100, nonnegative integer `typicalPupilCount`, `complianceContact` max200, `complianceEmail` valid email max254, boolean `safeguardingConfirmed`, `userRole` max100, `institutionType:SINGLE_SCHOOL|MAT_SCHOOL`, and MAT-only `trust`.

```json
{
  "name":"Example Primary School", "schoolType":"PRIMARY",
  "domain":"example.sch.uk", "address":"1 School Lane", "city":"London",
  "county":"Greater London", "postalCode":"SW1A 2AA", "countryCode":"GB",
  "institutionType":"SINGLE_SCHOOL", "staffingNeeds":["Mathematics"],
  "coverTypes":["Same-day cover"], "typicalPupilCount":420,
  "complianceContact":"Sam Safeguarding", "complianceEmail":"sam@example.sch.uk",
  "safeguardingConfirmed":true, "userRole":"Headteacher"
}
```

MAT variant: set `institutionType:"MAT_SCHOOL"` and include `trust:{name:"Example Learning Trust",companyNumber:"08123456"}`. `trust.name` is required max200; company number is optional and normalized by uppercasing, removing whitespace and padding numeric values to eight digits. Valid format is eight digits or two letters plus six digits. Omit `trust` for SINGLE_SCHOOL. Never send school type or trust settings as free-form strings.

Response contains submitted profile fields plus `id,userId,status,verified,complianceApprovalRequired,trust:{id,name,companyNumber}|null,latitude,longitude,subscriptionTier,createdAt,updatedAt`. A school can have a stored profile but still need its separate approval and final submission. Status and `verified` are distinct fields.

- SINGLE_SCHOOL: save the compliance name/email first, then request compliance approval. The contact must not be the school user's own email. The web honors `complianceApprovalRequired:false`; don't hard-code every school to require it.
- MAT_SCHOOL: save the trust, then request trust signatory approval from a different person.
- Upload dynamic required documents. Poll/reload the approval after the contact's email action. Only when prerequisites are met call `/institutions/me/status`.
- Once in review/verified, some trust/compliance changes are deliberately locked (409). Show the server reason and contact-support route; do not silently discard or force the edit.
- A saved Stripe card and a 100% completion score are not synonyms. Use returned `canPostJobs` and hiring/billing gates for availability of job posting, not a client-only percentage threshold.

### Compliance and MAT signatory approval APIs

| Endpoint | Body | Successful `data` |
|---|---|---|
| `GET /institutions/me/compliance-approval` | None | Latest approval or null |
| `POST /institutions/me/compliance-approval` | `{}` | New approval; sends email to saved contact |
| `GET /institutions/me/signatory-approval` | None | Latest signatory approval or null |
| `POST /institutions/me/signatory-approval` | `{signatoryName,signatoryEmail,signatoryJobTitle}` | New approval; sends email |
| `GET /compliance-approvals/token/:token` | Public link token | Public review model |
| `POST /compliance-approvals/token/:token/approve` | `{acceptTerms:true}` | Public decision model |
| `POST /compliance-approvals/token/:token/decline` | `{reason}` | Public decision model |
| `GET /signatory-approvals/token/:token` | Public link token | Public review model |
| `POST /signatory-approvals/token/:token/approve` | `{acceptTerms:true}` | Public decision model |
| `POST /signatory-approvals/token/:token/decline` | `{reason}` | Public decision model |

Signatory name max200, email max254, job title max150. Decline reason is required, trimmed, max1000. Approval states include `PENDING,APPROVED,DECLINED,EXPIRED,REVOKED`. Own signatory response fields: `id,status,school:{id,name,registrationId,domain,address,city,postalCode},trust:{id,name,companyNumber},signatoryName,signatoryEmail,signatoryJobTitle,expiresAt,decidedAt,declineReason,termsVersion,approvedByAdmin,createdAt`. The public review intentionally excludes the secret token and has `requestedBy` and current terms.

The request endpoints do not return the email approval token for the school to approve itself. Use email-link routing to a dedicated review screen or existing web approval page. Do not auto-approve on link opening; require explicit terms acceptance. Refresh school approval state when returning to the app. Resending may revoke the previous pending link. Compliance has a two-minute resend cooldown; preserve server 429/409 messages. Invalid/expired/revoked links need a distinct expired-link screen, not a generic login redirect.

### Dynamic verification documents: exact upload sequence

Do not hard-code that every teacher needs exactly DBS/ID/address/qualification files. Load active role requirements from `GET /document-requirements/profile`. Each result has:

```ts
type DocumentRequirement = {
  id: string; documentTypeId: string;
  context: 'INSTRUCTOR_PROFILE' | 'INSTITUTION_PROFILE' | string;
  isRequired: boolean; requiresReview: boolean; isActive: boolean;
  documentType: {
    id: string; code: string; name: string; description: string | null;
    allowedMimes: string[]; maxSizeBytes: number; isActive: boolean;
    createdAt: string; updatedAt: string;
  };
  createdAt: string; updatedAt: string;
};
```

List uploaded documents using `GET /documents?page=1&limit=100&status=...` (status optional; paginate until complete). Its `data` is `{documents:Document[],pagination}`. Record fields: `id,userId,applicationId,requirementId,status,rejectionComment,fileKey,originalName,sizeBytes,contentType,checksum,documentExpiryDate,uploadedAt,requirement?,deletedAt,createdAt,updatedAt`; file fields are nullable until upload completes. States: `NOT_REQUIRED,PENDING,APPROVED,REJECTED,REQUIRES_INFO`.

1. Create a document slot with `POST /documents {"requirementId":"<requirement-uuid>"}`. `applicationId?:uuid|null` is only for an application-bound requirement; profile documents omit it. Retain the returned document ID and reuse its slot for a replacement rather than blindly creating duplicates.
2. Request `POST /documents/:id/upload-url {"contentType":"application/pdf","sizeBytes":123456}`. Client validates MIME and bytes against `documentType.allowedMimes/maxSizeBytes`; the backend validates again.
3. Receive `{fileKey,url,requiredHeaders,expiresAt}`. PUT the **raw binary file bytes** directly to `url` using exactly `requiredHeaders`. This is not multipart and must not include the SupplyED bearer token. For RN, resolve a picked `file://`/`content://` URI through the chosen file/network library; do not serialize the URI string as the file body.
4. Only after a successful PUT, call `POST /documents/:id/upload-complete {fileKey,originalName,documentExpiryDate?}`. `originalName` max255 must be a plain name without slashes/newlines; `fileKey` max512 must be the issued key. Optional expiry is an ISO date string or null. Never manufacture the key.
5. Reload `/documents`, role profile and profile completion. Show pending review if returned, not "verified".
6. To view: `GET /documents/:id/download-url` returns a short-lived `{url,expiresAt}`. Open/download that URL; don't expose bucket paths as public URLs. Renew it after expiry.

`PATCH /documents/:id` supports metadata changes as declared by its DTO; don't use it to mark a file approved or set arbitrary storage properties. No owner document-delete route is exposed in this controller. Admin review/deletion is not a mobile school/teacher action. When `REJECTED`/`REQUIRES_INFO`, show the current-file `rejectionComment`; replacement/approval clears that note. Preserve empty or unknown notes without inventing rejection reasons.

### Profile image versus public certificate/achievement

These are **three different upload domains**: compliance documents above, profile photos, and public certificates/achievements. Completing a public certificate upload does not approve a verification document.

Profile photo flow (teacher or school must first have a profile):

```text
POST /users/me/profile-image/upload-url {contentType,sizeBytes}
  → {fileKey,url,requiredHeaders,expiresAt}
PUT url with raw bytes and requiredHeaders
POST /users/me/profile-image/upload-complete {fileKey}
  → {imageUrl,expiresAt}
GET /users/me/profile-image → {imageUrl:null|string,expiresAt:null|string}
```

Allowed photo MIME types `image/jpeg,image/png,image/webp`; size 1 byte through 5 MiB (5,242,880 bytes). Backend validates the uploaded object, ownership and concurrent replacement. Retry a 409 with a fresh GET/upload URL, not the old key. The own role profile can contain a storage key beginning `profile-images/`; fetch `/users/me/profile-image` for a displayable signed URL instead of prepending an app base URL. Do not set `Image.source` to a bare object key.

Public profile documents:

| Endpoint | Body / response |
|---|---|
| `GET /profile-documents` | Returns own `ProfileDocument[]` |
| `POST /profile-documents` | `{title,description?,issueDate?}` → metadata record |
| `PATCH /profile-documents/:id` | Same DTO as create: **title remains required**, unlike a fully partial patch |
| `POST /profile-documents/:id/upload-url` | `{contentType,sizeBytes}` → signed upload object |
| `POST /profile-documents/:id/upload-complete` | `{fileKey,originalName}` → updated record |
| `DELETE /profile-documents/:id` | 204; do not JSON-parse an empty body |

Title: required nonblank max120; description max1000; issueDate optional strict ISO date string. Files: PDF, DOC, DOCX, JPEG, PNG or WebP, up to10 MiB. Server selects kind `CERTIFICATE` for teachers or `ACHIEVEMENT` for schools. Record: `id,kind,title,description,issueDate,originalName,contentType,sizeBytes,fileUrl,fileUrlExpiresAt,createdAt,updatedAt`. Upload URLs have the same binary-PUT pattern. Display/download signed `fileUrl`; refresh the record when expired. Handle metadata-only records with `fileUrl:null` as incomplete upload, not as a completed public certificate.

### TrustID and right-to-work verification

Teacher endpoints:

- `GET /identity-verification/me` → `MyIdentityVerification`.
- `POST /identity-verification/me {"consent":true}` → `IdentityVerification`; requires explicit biometric/document-processing consent.
- `GET /dbs-checks/me` → `{dbsCheck:null|{id,state,submittedAt,resultAt}}`.

```ts
type IdentityState = 'NOT_STARTED' | 'LINK_SENT' | 'PROCESSING' |
  'IN_REVIEW' | 'RETRY_PENDING' | 'VERIFIED' | 'UNSUCCESSFUL';
type IdentityVerification = {
  id: string; status: 'LINK_SENT' | 'SUBMITTED' | 'RESULTS_READY' |
    'COMPLETED' | 'EXPIRED' | 'CANCELLED';
  result: 'VERIFIED' | 'IN_REVIEW' | 'RETRY_PENDING' | 'UNSUCCESSFUL' | null;
  guestLinkUrl: string | null; linkExpiresAt: string;
  submittedAt: string | null; completedAt: string | null; createdAt: string;
};
type MyIdentityVerification = {
  required: boolean; state: IdentityState; verifiedAt: string | null;
  canStart: boolean; verification: IdentityVerification | null;
};
```

Render the aggregate `state` and `canStart` returned by the server; they are more authoritative than the latest attempt alone. An already-verified teacher can remain verified during an admin-initiated follow-up check. `required:false` is a development feature setting; the native app must not decide to bypass verification because a network call failed.

When `LINK_SENT` and `guestLinkUrl` is nonnull, open it in the phone's external browser. The server contract explicitly says **do not embed in an iframe**; native parity should use a browser handoff rather than a restrictive embedded WebView. After app resume, refetch status; while foregrounded and processing, use bounded polling and stop on a terminal/wait-for-admin state. A browser return is not proof of verification. TrustID callbacks and report retrieval run on the backend; the app does not call the provider webhook or possess its credentials.

UI states: NOT_STARTED → consent/start; LINK_SENT → Continue verification + expiry; PROCESSING → waiting; IN_REVIEW/RETRY_PENDING → awaiting team, no speculative self-retry; VERIFIED → success; UNSUCCESSFUL → contact support. `canStart` controls whether another attempt is allowed. Teachers intentionally receive no raw failure analysis, biometric result, provider report, or admin notes.

DBS is a separate server/admin handoff after identity data is available. Teacher states `IN_PROGRESS,VERIFIED,CERTIFICATE_NEEDED,NOT_VERIFIED`; `CERTIFICATE_NEEDED` asks for the certificate evidence requested by the workflow. There is no teacher `POST /dbs-checks/me` in this backend. Do not implement a fake "start DBS" endpoint or infer `dbsVerified` from TrustID VERIFIED. Admin preview/submit/report/decision routes are outside ordinary app permissions.

### Optional degree verification through Hedd

Frontend commit `91b055f` and the updated backend commit `597dabd` both contain this optional Hedd feature. The backend advanced during this review; this chapter was rechecked against the new degree controller, DTOs and service. Hide the section when `available:false`, and never make onboarding depend on this optional check. A successful GET can report unavailable when Hedd is not configured; do not treat that as a failed mandatory identity check.

Verified degree endpoints (teacher bearer token; institutions list also permits ADMIN):

| Endpoint | Expected request / `data` |
|---|---|
| `GET /degree-checks/me` | `{available,canStart,degreeCheck,identity}` |
| `GET /degree-checks/institutions` | `{institutions:[{id:number,name,consentFormUrl:null|string}],standardConsentFormUrl}` |
| `POST /degree-checks/me/consent-upload-url` | `{contentType,sizeBytes}` → `{fileKey,url,requiredHeaders,expiresAt}` |
| `POST /degree-checks/me` | DegreeCheckInput → DegreeCheck |

Degree response and input types:

```ts
type VerifiedDegree = {
  institutionName: string; classification: string | null;
  courseName: string | null; qualificationType: string | null; yearOfAward: number | null;
};
type DegreeIdentity = {
  firstNames: string; lastName: string; birthSurname: string | null; dateOfBirth: string;
};
type DegreeCheck = {
  id: string; createdAt: string; institutionName: string;
  qualificationType: string; courseName: string; classification: string;
  yearOfAward: number; dueDate: string | null; notes: string | null;
  state: 'IN_PROGRESS' | 'VERIFIED' | 'NOT_VERIFIED'; degree: VerifiedDegree | null;
};
type DegreeCheckInput = {
  institutionId: number; courseName: string; qualificationType: string;
  classification: string; yearOfAward: number; consentFileKey: string;
  lastNameAtStudy?: string;
  // Only for deliberately enabled backend development fixtures:
  firstNames?: string; lastName?: string; dateOfBirth?: string;
};
```

Web UI constraints: course max120; qualification/classification/surname-at-study max60; year1940..current year and integer. The backend DTO allows1940..2100, so preserve the stricter web UI upper bound for parity. `institutionId` must be an integer≥1 from the returned university list. Backend trims/collapses whitespace in names/course/classification. Prefer provider-verified `identity`; do not let a production user replace it with arbitrary name/DOB. Download the selected university's consent form, falling back to standard form, and ask the user to sign/upload it. Allowed consent formats PDF/JPEG/PNG/TIFF, max5 MiB. Request a fresh signed upload, PUT the binary with required headers, then send `consentFileKey` with the degree input. The web reuploads on each submission retry and invalidates `/degree-checks/me` on settlement.

If VERIFIED, display `degree` (university-confirmed values), not merely the originally claimed course/classification. Public teacher profile can expose `verifiedDegree`; hide the badge when null/absent. A corrected field can deliberately be null—do not fill it back from the unverified claim. IN_PROGRESS can show `dueDate`; NOT_VERIFIED can show returned notes. `GET /instructors/profile/:id` and directory results can now expose `verifiedDegree` from an approved check. The backend sets `canStart` only when Hedd is configured, a decided identity is approved, verified identity data exists (or test verification is enabled), and there is no open/already-approved check.

Submission error/recovery behavior is important because a provider enquiry may cost money:

- 400: invalid university ID, foreign consent key, missing uploaded object, unsupported MIME/size. Some rejected submissions delete their consent file; request a fresh signed upload for the next attempt.
- 409: identity not verified, verified name/DOB unavailable, or an existing in-progress/verified check. Refetch `/degree-checks/me`; do not blindly retry POST.
- 422 `HEDD_REJECTED`: provider rejected the supplied details. Its message can be an array of provider validation reasons. Display those safely and allow corrections; server removes the rejected local check and consent file.
- 503: feature not configured or provider unavailable after a definite rejection. Keep form input and retry deliberately with a fresh upload.
- A timeout/ambiguous provider answer is **not** automatically resubmitted. Backend retains an internal `UNCONFIRMED` record and may return HTTP success with teacher `IN_PROGRESS`, because Hedd might already have created/charged the enquiry. Show in-progress/support state. Admin must reconcile it; repeated submissions are blocked.

Provider polling is server-side: worker interval30 minutes, a given open check is normally queried every6 hours. Do not poll the mobile API every second expecting an instant university decision. Refetch on foreground/pull-to-refresh; show due date as an estimate.

Admin-only endpoints include list/detail, consent URL, decision, cancellation of UNCONFIRMED records, and `POST /degree-checks/admin/:id/test-verify`. A separate `POST /identity-verification/admin/users/:userId/test-verify` can seed identity/DBS readiness. Both test-verification actions require ADMIN and `TEST_VERIFICATION_ENABLED=true`; they are not production onboarding alternatives and must never be wired to teacher buttons. The environment flag is the server-side gate, so operators must leave it disabled in production.

### Dropdowns, teaching catalogue and locations

| Endpoint | Authentication / use |
|---|---|
| `GET /dropdowns` | Public collection summaries |
| `GET /dropdowns/:name` | Public active collection/options |
| `GET /teaching-catalogue` | Public all-teacher catalogue |
| `GET /teaching-catalogue?schoolType=PRIMARY` | Public phase-filtered catalogue during onboarding (`SECONDARY` also supported) |
| `GET /teaching-catalogue/school` | School access token; phase from saved profile |

Catalogue response: `version,title,description,schoolType,categories:[{name,subjects:[{name,aliases,skills}]}],sharedSkills,keyStages` and `subjectOptions,skillOptions,stageOptions` when supplied. Option fields include `key,value,label,aliases,group,sortOrder,isActive,isShared,subjectKeys,schoolTypes,primarySubjectKeys,secondarySubjectKeys`. Use the option **`value`** in requests, display `label`, match searches against label/value/aliases. Do not submit immutable keys in place of values or reject new response fields just because the app does not yet use them.

Required selector behavior:

- School must choose PRIMARY/SECONDARY before loading school-scoped subjects; backend `SCHOOL_TYPE_REQUIRED` directs the user to School details.
- Teachers use all subjects; job/school selections use phase-filtered subjects and corresponding linked skills plus shared skills.
- Selecting `Other` reveals custom subject/skill name inputs; send `otherSubjects`/`otherSkills`, and display actual stored names in returned arrays.
- Removing a subject must remove incompatible selected skills after explicit visible feedback; don't leave hidden invalid values.
- Existing saved retired/custom values must remain visible. Omit unchanged catalogue fields on unrelated PATCHes so a retired legacy choice does not prevent updating a bio or address. Website helpers `features/teaching-catalogue/patch.ts` implement this behavior.
- Refresh catalogue/version on foreground or validation disagreement. All catalogue endpoints declare `no-store`; do not ship a permanently baked list as authoritative.
- Collections include country, city, region, keyStage, cover-type and rich-text options; enumerate current `/dropdowns`, rather than guessing a plural endpoint name.

Location parity: country is GB, prices GBP, times Europe/London. Format UK postcode by stripping spaces/upcasing then inserting the final3-character separator, e.g. `m54wt → M5 4WT`; validate syntax and use returned city/region catalogue values. Website postcode-location mapping prefers settlement/town information; a county/district is not automatically a city. The reviewed backend geocoding service enriches coordinates internally and exposes no app geocoding controller. Do not invent `/geocode` or send client latitude/longitude fields. Postcode lookup UI is an independent integration; preserve manual selection if that lookup is unavailable.

### Profile completion and settings refresh dependencies

`GET /profile-completion/me` returns persisted current calculation:

```json
{
  "role":"INSTRUCTOR", "percentage":40, "completedWeight":40, "totalWeight":100,
  "complete":false, "canPostJobs":false,
  "items":[
    {"id":"profile","label":"Teacher profile created","weight":30,"complete":true,"href":"/settings"},
    {"id":"phone","label":"Phone number verified","weight":10,"complete":true,"href":"/settings"}
  ],
  "calculatedAt":"2026-11-23T12:00:00.000Z"
}
```

The example item list is abbreviated; actual calculation returns all six items. Weights: profile30, image10, public certificate/achievement20, verified phone10, role verification10, Stripe20. Teacher role verification reads required documents; school reads the latest matching compliance/signatory approval. Teacher Stripe completion requires charges+payouts enabled; school Stripe completion requires a READY default card. These rules do not mean every action requires100%.

Map web `href` destinations to native routes; do not navigate a native stack directly to `/settings#profile-documents`. Refetch completion after contact verification, image/document uploads, compliance/provider status changes and Stripe returns. Settings saves are separate account/profile requests; if one succeeds and another fails, reload both and show partial-save context rather than promising an atomic combined save.

### Error-to-screen handling for these flows

| Response / condition | Native behavior |
|---|---|
| 401 invalid email/password | Stay on login; generic credentials message; no silent refresh |
| 401 challenge-purpose mismatch/expired OTP/2FA | Clear challenge as appropriate; allow restart/resend; never treat as access-token refresh |
| 400 wrong/expired/exhausted code | Keep verification screen, show backend message; do not claim which part was wrong |
| 409 verified duplicate signup | Offer login/recovery |
| 429 auth/OTP/approval rate limit | Stop automatic retries; show cooldown/server message |
| Own-profile404 | Onboarding only for this known bootstrap condition |
| Required profile/catalogue field error | Attach to specific field, scroll/focus first failing input |
| `SCHOOL_TYPE_REQUIRED` | Open school details and select phase |
| `INSTRUCTOR_DOCUMENTS_NOT_VERIFIED`403 | Open document status/expiry/replacement, then refresh permissions |
| Identity required/not complete | Open verification state; follow `canStart`, not blind POST retry |
|409 immutable compliance/trust/profile state | Reload latest; explain review/support restriction |
|400 file not uploaded/MIME/size/key invalid | Keep draft, request fresh upload if needed; never call complete after failed PUT |
|409 concurrent photo/file replacement | Reload latest record; fresh upload URL; don't overwrite silently |
| Signed URL expired | Fetch new URL rather than logging out |
| Optional degree unavailable/unsupported deployment | Hide or mark unavailable; do not block login/onboarding |
| Provider or generic5xx | Keep draft; allow deliberate retry; status-refresh before retrying start/check operations |

Some service exceptions are plain messages, not machine codes. Use the central envelope's status/code/details when present; do not fabricate codes from English messages. Never expose server stacks or provider credentials in the UI.

### Source cross-reference for implementing parity

Backend: `src/modules/auth/auth.controller.ts`, `auth.service.ts`, `dto/*`; `two-factor/*`; `phone-verification/*`; `users/users.controller.ts`, `profile-images.service.ts`; `instructors/*`; `institutions/*`; `common/profile/profile-status.transitions.ts`, `instructor-document-access.ts`; `documents/*`; `document-requirements/*`; `profile-documents/*`; `profile-completion/*`; `identity-verification/*`; `dbs-checks/*`; `degree-checks/*`; `hedd/*`; `signatory-approvals/*`; `compliance-approvals/*`; `dropdowns/*`; `teaching-catalogue/*`.

Website: `features/auth/backend.ts`, `features/onboarding/actions.ts`, `profile-progress.ts`, `institution-approval.ts`, `document-requirements.ts`, `validation.ts`; `features/settings/*`; `features/profile-documents/*`; `features/profile-completion/*`; `features/identity-verification/*`; `features/degree-checks/*`; `components/organisms/DegreeSettings.tsx`; `features/teaching-catalogue/*`; `lib/uk-validation.ts`, `lib/postcode.ts`, `lib/postcode-location.ts`.


<a id="hiring-flows"></a>

## Jobs, matching, applications, invitations, bookings and attendance

This chapter describes the checked-out backend controllers/services and the website flows. All paths below are relative to the backend `/api` base. Success examples show the **unwrapped `data` value**, unless explicitly called an HTTP envelope. Do not call Next.js server actions from React Native: reproduce their orchestration against these backend endpoints. Use backend roles `INSTITUTION` (school), `INSTRUCTOR` (teacher), and `ADMIN`; the website's lowercase `institution`/`teacher` names are UI aliases.

### Screen and state map

| App screen | School behaviour | Teacher behaviour | Primary calls |
|---|---|---|---|
| Dashboard | Own jobs, hiring activity, matches, bookings, billing status | Recommended jobs, application stages, bookings, completion tasks, earnings | Reuse the domain list endpoints below; do not fabricate aggregate counts from a single paginated page |
| My jobs | Draft, publish, edit, close, delete permitted unused draft | Not shown | `/jobs/mine`, `/jobs/mine/:id` |
| Post/edit job | Four steps: Type → Details → Requirements → Review | Not shown | Teaching catalogue + `POST /jobs` + `PATCH /jobs/:id` |
| Find jobs | Not a school action | For you and All jobs tabs | `/matching/jobs/recommended`, `/jobs` |
| Find teachers | Search directory, inspect public profile, select a role before inviting | Not shown | `/instructors/directory`, `/instructors/profile/:id`, job matches |
| Job detail | Owned detail; published summary; applicants | Exact calendar, match factors, school profile, apply or existing application | `/jobs/accessible/:id`, public `/jobs/:id`, score, own application query, availability check |
| Applications | Role-level applications, optional view/shortlist, hire/reject, history | Own stages, original application terms, final booking terms when hired | `/applications/*`, `/matching/jobs/:id/applications` |
| Invitations | Sent invites, expiry, cancel pending | Received invites, explicit accept/decline, exact offered terms | `/job-invitations/*` |
| Bookings | Attendance, payment status, complete/no-show/cancel, review teacher | Read attendance/payment, cancel eligible booking, review school | `/bookings/*`, `/reviews` |
| Calendar | Booking schedule display | Recurring availability and exception editor | `/availability/*`, `/bookings/me` |

Do not equate “profile exists”, “email verified”, “approved/active”, “documents verified”, “available”, “Stripe ready” and “eligible to hire”. These are separate conditions and are checked again by the backend at mutation time. Current `instructor-document-access.ts` blocks protected actions for missing required uploads, expired documents, or unverified existing submissions—including optional documents submitted for review. Handle `INSTRUCTOR_DOCUMENTS_NOT_VERIFIED` by directing the teacher to documents/completion; a cached green badge is not sufficient authorization.

### Complete endpoint inventory for these flows

`AUTH` means authenticated and service-level access checks still apply. All UUIDs must be actual record IDs. `instructorId` and `institutionId` mean **profile IDs**, not login user IDs.

| Method and path | Caller | Input | `data` response |
|---|---|---|---|
| `GET /jobs` | Public | Job search query | `{jobs: Job[], pagination}` |
| `GET /jobs/:id` | Public | Job ID | Publicly visible `Job`; unavailable/closed/private listings can return404 |
| `GET /jobs/institution/:institutionId` | AUTH | School profile ID + search query | `{jobs, pagination}` |
| `GET /jobs/mine` | School/admin | Own-job query | `{jobs, pagination, statusCounts}`; counts include ALL and every JobStatus and are poster-wide, not the current filtered page |
| `GET /jobs/mine/:id` | Owning school/admin | Job ID | `Job`, including drafts/private management flags |
| `GET /jobs/accessible/:id` | Teacher/school/admin | Job ID | Participant-accessible job; use for related closed listings |
| `POST /jobs` | School/admin with posting profile | `CreateJobInput` | Newly created draft `Job`; **no `status` accepted here** |
| `PATCH /jobs/:id` | Owning school/admin | Partial create fields plus optional `status` | Updated `Job` |
| `DELETE /jobs/:id` | Owning school/admin | No body | Deleted `Job`; only history-free, never-published drafts are deletable |
| `GET /jobs/admin/all` | Admin | `page`, `limit`, `jobType` | `{jobs,pagination}`; not a teacher/school app fallback |
| `GET /instructors/directory` | School | Directory query below | `{instructors: DirectoryTeacher[],pagination}` |
| `GET /instructors/profile/:id` | Teacher/school/admin | Profile ID | Safe public teacher profile with certificates/bookings |
| `GET /matching/jobs/recommended` | Teacher | `page`, `limit`, `minScore` | `{jobs:[{job,match}],pagination}` |
| `GET /matching/jobs/:jobId/score` | Teacher | Job ID | `MatchScore` |
| `GET /matching/jobs/:jobId/instructors` | Owning school/admin | Matching query | `{instructors:[{instructor,match,application,invitation,canInvite,inviteDisabledReason}],pagination}` |
| `GET /matching/jobs/:jobId/applications` | Owning school/admin | Matching query | `{applications:[{application,instructor,match}],pagination}` |
| `GET /availability/me` | Teacher | None | `{availability: SavedAvailability|null,bookings:[OccupiedBooking]}` |
| `PUT /availability/me` | Teacher | Complete availability object | Saved availability record, **not** `{availability,bookings}` |
| `GET /availability/jobs/:jobId/check` | Teacher | Job ID | `{available:boolean,conflicts:AvailabilityConflict[]}` |
| `POST /applications` | Teacher | `{jobId,coverLetter?}` | `Application` |
| `GET /applications/me` | Teacher | Application query | `{applications,pagination}` |
| `GET /applications/job/:jobId` | Owning school/admin | Application query | `{applications,pagination}` |
| `GET /applications/instructor/:instructorId` | AUTH + service access | Application query | `{applications,pagination}`; not an unrestricted teacher-data endpoint |
| `GET /applications/:id` | Participant/admin | ID | `Application` |
| `GET /applications/:id/history` | Participant/admin | `page`,`limit` | `{history:[HistoryEntry],pagination}`, oldest first |
| `PATCH /applications/:id/status` | Owning school/admin | `{status}` | `Application` |
| `POST /applications/:id/hire` | Owning school | `{}` or negotiated payment fields | `Application` with `bookingId`, `bookingTerms`, optional `automaticallyRejectedCount`; **not a Booking response** |
| `POST /job-invitations` | School | `InvitationCreateInput` | `Invitation`, HTTP200 |
| `POST /bookings/direct-hire` | School | Same invitation input | Compatibility alias returning `Invitation`, HTTP200; does **not** immediately return a booking |
| `GET /job-invitations/me` | School/teacher | `page`,`limit`,`status` | `{invitations,pagination}` |
| `GET /job-invitations/:id` | Inviting school/invited teacher | ID | `Invitation` |
| `POST /job-invitations/:id/accept` | Invited teacher | No body | `Booking`, HTTP200 |
| `POST /job-invitations/:id/decline` | Invited teacher | No body | `Invitation`, HTTP200 |
| `POST /job-invitations/:id/cancel` | Inviting school | No body | `Invitation`, HTTP200 |
| `GET /bookings/me` | School/teacher | Booking query | `{bookings,pagination}` |
| `GET /bookings/:id` | Participant/admin | ID | `Booking` |
| `GET /bookings` | Admin | Booking query plus `instructorId`,`institutionId` | `{bookings,pagination}` |
| `PATCH /bookings/:id/complete` | Owning school/admin | No body | Updated `Booking` |
| `PATCH /bookings/:id/no-show` | Owning school/admin | No body | Updated `Booking` |
| `PATCH /bookings/:id/cancel` | Participant/admin | `{reason}` | Updated `Booking` |
| `POST /bookings/:id/attendance/activate` | Owning school/admin | No body | Updated `Booking` |
| `PATCH /bookings/:id/attendance/:shiftId` | Owning school/admin | `{status,reason?}` | Entire updated `Booking` |
| `PATCH /bookings/:id/attendance/:shiftId/correct` | Owning school/admin | `{status,reason}` | Entire updated `Booking` |
| `PATCH /bookings/:id/attendance/correction-requests/:requestId` | Owning school/admin | `{decision,reason}` | Entire updated `Booking` |
| `POST /reviews` | Participant school/teacher | `{bookingId,rating,comment?}` | `Review` |
| `GET /reviews/instructor/:instructorId` | AUTH | `page`,`limit` | `{reviews,pagination}` |
| `GET /reviews/institution/:institutionId` | AUTH | `page`,`limit` | `{reviews,pagination}` |
| `DELETE /reviews/:id` | Admin only | ID | Removed `Review`; no teacher/school delete UI |

A `RequestAttendanceCorrectionDto` exists in the backend code, but **the checked-out controller exposes no teacher endpoint to submit it**. Do not invent `POST .../correction-requests`. Existing correction requests can be displayed and reviewed through the school/admin route above. Teachers currently read attendance only.

### Queries and paging

All list endpoints above default to `page=1`, `limit=20`; permitted limit is1–100. Increment page only while `pagination.hasNextPage`; reset page on filter change. The meta shape is:

```ts
type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
};
```

- Job search: `jobType=INSTANT|BRIEF`, `search` up to100 characters (title/description/subject/location/skill), `subject` up to100 (exact case-insensitive subject), `keyStage` up to20, `urgent=true|false`. `urgent` query means listing expiry within two days; it is not a writable backend `urgent` column in CreateJobDto. Own-job query additionally accepts `status=DRAFT|ACTIVE|RESERVED|EXPIRED|FILLED|CLOSED|SUSPENDED`.
- Directory: `search` (name/city/county,100), `subject`100, `keyStage`30, `skill`100, `city`100; `dbsVerified`, `qtsQualified`, `availableToday` booleans encoded as strings; `minExperience` non-negative integer; `maxHourlyRate`,`maxDailyRate` non-negative numbers; `minRating`0–5. `availableToday` uses UTC day/range occupancy in the current backend; it is not the exact required-shift availability check for a job.
- Matching: only `page`,`limit`,`minScore` integer0–100. Do not forward the directory's free-text filters to these endpoints.
- Applications: `jobId` UUID, `status=APPLIED|VIEWED|SHORTLISTED|HIRED|REJECTED`, paging.
- Invitations: `status=ALL|PENDING|ACCEPTED|DECLINED|CANCELLED|EXPIRED`, case-insensitive. Omitted/ALL means all statuses, newest first. Expired pending invitations normalize to EXPIRED before the worker necessarily updates storage.
- Bookings: `status=CONFIRMED|COMPLETED|CANCELLED|NO_SHOW`, `search` up to100, `jobId`, `from`, `to`, `invoice=none|unpaid|paid`, paging. `from` keeps bookings still running on/after the date; `to` keeps bookings starting on/before it; date-only `to` includes that day. Reject inverted ranges locally. Omit “All”/empty values; do not send `status=ALL` for bookings.

### Creating and publishing a job: exact sequence

1. Load the school profile and school-scoped teaching catalogue. An active operating school and selected Primary/Secondary `schoolType` are prerequisites. `SCHOOL_TYPE_REQUIRED` should navigate to school settings.
2. Choose posting type: website “Targeted matching” → `jobType:"INSTANT"`; “Open applications” → `jobType:"BRIEF"`. This is independent of assignment duration or payment type. Do not derive it from whether the dates are short.
3. Collect title, rich description, location, assignment dates, weekday slots/exceptions, pay basis/rate/frequency, listing window, workers, subjects/skills and key stages.
4. Save draft using `POST /jobs` **without `status`**. Retain returned `id` immediately.
5. Publish using `PATCH /jobs/{savedId}` with `{"status":"ACTIVE"}`. Full publication requirements are checked here. If publication fails after creation, keep the draft ID and allow fixing/retrying the same draft; never repeat POST and create duplicate listings.
6. After success invalidate own jobs, public/recommended jobs, this job, applications and invitations. INSTANT can show recommended teachers immediately; BRIEF proceeds to its application workspace.
7. Editing uses `GET /jobs/mine/:id` (public detail cannot load a draft). Send only changed fields; respect `termsLocked`. Close a published role to preserve history. Delete only if `canDelete===true`.

A complete daily-pay create example (substitute valid future dates and actual catalogue names for the school's phase):

```http
POST /api/jobs
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json
```

```json
{
  "jobType": "BRIEF",
  "title": "KS2 mathematics cover",
  "description": "<p>Provide mathematics cover for two scheduled school days.</p>",
  "subjects": ["Mathematics"],
  "requiredSkills": [],
  "keyStages": ["KS2"],
  "minExperienceYears": 2,
  "address": "1 School Lane",
  "city": "London",
  "county": "Greater London",
  "postalCode": "SW1A 2AA",
  "countryCode": "GB",
  "startDate": "2027-02-02",
  "endDate": "2027-02-03",
  "timeZone": "Europe/London",
  "payType": "daily",
  "payAmount": 120,
  "currency": "GBP",
  "paymentFrequency": "daily",
  "periodAnchor": "ASSIGNMENT_START",
  "workersRequired": 1,
  "schedule": {
    "weekdays": [
      {"day": 2, "slots": [{"start": "09:00", "end": "15:00"}]},
      {"day": 3, "slots": [{"start": "09:00", "end": "15:00"}]}
    ],
    "exceptions": []
  },
  "parkingInfo": "Sign in at reception.",
  "liveFrom": null,
  "expiresAt": "2027-02-01"
}
```

Expected response properties: `status:"DRAFT"`, `id`, `hasBeenPublished:false`, `termsLocked:false`, `canDelete:true` when still unused, `days:2`, `hours:null`, `scheduledMinutes:720`; the response also contains the complete saved fields, institution summary, and timestamps. Backend derives work units from a structured schedule; do not add mismatching `hours`/`days`. Then:

```http
PATCH /api/jobs/JOB_ID
```

```json
{"status":"ACTIVE"}
```

Expected updated response has `status:"ACTIVE"`, `hasBeenPublished:true`, `canDelete:false`. A future `liveFrom` means ACTIVE but not yet publicly discoverable.

The same schema supports:

```json
{
  "payType": "hourly",
  "payAmount": 25,
  "paymentFrequency": "weekly",
  "periodAnchor": "CALENDAR"
}
```

and:

```json
{
  "payType": "fixed",
  "payAmount": 500,
  "paymentFrequency": "completion"
}
```

These are **field variations of the complete create object**, not standalone valid job creates. Hourly pay uses scheduled minutes to estimate money; daily pay counts distinct working dates; fixed pay is one agreed total. API rates are GBP major units (`25` =£25); payroll/invoice amounts ending `Pence` are integers (`2500` =£25).

#### Create/update validation table

| Field | Backend contract and app handling |
|---|---|
| `jobType` | Required `INSTANT` or `BRIEF` |
| `title`,`description` | Required non-empty strings even for draft; publication strips markup to require non-empty description text |
| `subjects` | Optional DTO array but publication requires a selected subject; unique, max50; each non-empty/max100; use catalogue display names |
| `subject` | Legacy single subject max100; prefer `subjects` |
| `otherSubjects`,`otherSkills` | Unique max50 strings/max100, used with “Other”; server stores resolved actual names |
| `requiredSkills` | Unique max50 non-empty strings/max100; must relate to chosen subjects or shared skills |
| `keyStages` | Unique non-empty string array; publication requires at least one |
| `minExperienceYears` | Non-negative integer; web caps its entry UI at80 |
| `address` | Optional DTO max250; required at publication |
| `city`,`county` | Max100; validate selected catalogue values; city required at publication |
| `postalCode` | Max20; required at publication; use the location workflow rather than trusting a free-form full address |
| `countryCode` | ISO alpha-2; use GB for website parity |
| `latitude`,`longitude` | Optional but must be sent together; numeric lat−90..90/lon−180..180. Omit both to let backend resolve |
| `startDate`,`endDate` | **YYYY-MM-DD only**, not an ISO timestamp; future start when publishing; end>=start |
| `liveFrom` | Optional ISO instant or UK date-only; null means immediately once ACTIVE; must precede work start |
| `expiresAt` | Optional ISO instant or inclusive final UK date; exclusive stored expiry must follow opening and be<=work start. Do not send null unless contract changes; DTO describes a string |
| `payType` | `hourly`,`daily`,`fixed`; required for publishing |
| `payAmount` | Non-negative DTO number; publication requires positive amount; enforce sensible two-decimal currency entry in app |
| `currency` | Only `GBP` |
| `paymentFrequency` | Explicitly send website choices: hourly/daily rates → daily,weekly,monthly; fixed → completion |
| `periodAnchor` | `ASSIGNMENT_START` or `CALENDAR`, default assignment start; show when weekly/monthly |
| `timeZone` | IANA zone string max100; website uses Europe/London; backend validates zone |
| `schedule` | Structured object below; new/changed posting shifts require whole hours |
| `workersRequired` | Integer1–100, default1; filling the final position closes competing pipeline entries |
| `hours`,`days` | Legacy/manual planned units, positive integer<=2147483647 or null; hours only hourly, days only daily; schedule overrides/derives correct values |
| `parkingInfo` | String max1000 |
| `status` | **PATCH only**; rejected as unknown extra property in POST |

Do not send UI-only fields such as `mode`, `urgent`, `qtsRequired`, `schoolName`, `status` on create, a preview total, or a copied normalized `Job` object. The website can encode presentation details in description; the backend DTO is the writable contract. Required catalogue lists can change through admin settings; fetch them instead of hard-coding all subjects/skills.

#### Schedule and calendar representation

```ts
type Slot = { start: string; end: string }; // HH:mm, posting editor restricts minutes to00
type Schedule = {
  weekdays: Array<{ day: 0|1|2|3|4|5|6; slots: Slot[] }>;
  exceptions?: Array<{
    date: string; // YYYY-MM-DD in the assignment zone
    kind: 'add'|'exclude'|'replace';
    slots?: Slot[]; // absent for exclude; at least one for add/replace
  }>;
};
```

Day0=Sunday,1=Monday,…6=Saturday. Weekdays cannot be duplicated; one or more non-zero slots per selected weekday are required. Identical start/end is invalid; end earlier than start is overnight into the following calendar day. Split shifts are separate slots. The expanded schedule must contain work and must not overlap, including across midnight. Adjacent09:00–10:00 and10:00–11:00 are valid. Exceptions have unique dates: `exclude` removes normal work; `replace` substitutes that day's slots; `add` adds to recurring slots. Date ranges are inclusive calendar days; list every recurring date through the final date without counting excluded days as worked.

For the user's weekday UX, derive allowed weekday numbers from the selected inclusive date range. A Tuesday–Wednesday range enables only those weekdays; clear disallowed selected weekdays. For longer ranges default Monday–Friday where present and leave weekends optional. Repeating Monday naturally creates the next Monday in the dated timeline; never manually add a second recurring “Monday” entry. Do not silently restore a day a user deliberately deselected when changing a different form field.

Show a read-only required-work calendar before applying/accepting. Each dated shift needs a UK formatted date/time and duration; show planned days/hours and hourly/daily/fixed estimate. Do not label a planned estimate “paid” or “due now”. Long assignment classification is backend `assignmentDuration:SHORT_TERM|EXTENDED|null`; EXTENDED starts when final calendar date reaches at least one calendar-month anniversary, not an arbitrary30-day test.

#### Date handling requirements and currently unresolved source mismatches

Retain **date-only form values** as strings until submission. Backend stores them as UTC instants representing local start00:00/end23:59; display these using the record's IANA timezone. Never use `iso.slice(0,10)` to recover a UK calendar date during BST, and never rely on device timezone for job/booking date labels. Use formatToParts with explicit zone for calendar-date reconstruction:

```ts
function calendarDateFromInstant(iso: string, timeZone = 'Europe/London'): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(iso)).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
```

The checked-out website still has UTC-slicing/local-device-date patterns in parts of its schedule preview. The backend `attendance-payroll.ts` still uses `dateOnly(startDate)` for assignment-start period anchors, while `job-schedule.ts` summary groups assignment periods from the first working interval. Do not treat copying these functions verbatim as a correct mobile implementation. Those are documented contract inconsistencies: mobile can display server-computed payroll `closesAt` and explain eligibility, but cannot repair server billing by changing a local preview. Coordinate an API fix and test July/BST starts, excluded opening dates, Jan31 monthly boundaries and overnight shifts before shipping a billing forecast.

The backend also still permits legacy `hourly` release for hourly pay and `milestone` for fixed pay; defaults omitted hourly frequency to hourly. The website's new-job UI deliberately removes those choices. Always explicitly send the desired frequency. Continue to render historical values without changing accepted terms.

### Discovery, directory and matching

Teacher “All jobs” uses public `/jobs`; “For you” uses `/matching/jobs/recommended`. Public visibility includes ACTIVE status, opening time and expiry; a previously visible job can disappear between discovery and apply. An application/booking participant should open accessible detail or its stored terms, not fall back to a public404 as evidence their booking was deleted.

A `MatchScore` is returned by the backend:

```ts
type MatchScore = {
  score: number; //0..100
  distanceMiles: number|null;
  factors: Array<{
    key: string; label: string; weight: number;
    value: number; //0..1, unweighted
    applicable: boolean; detail: string;
  }>;
  flags: { scheduleConflict:boolean; outsideTravelRadius:boolean; distanceKnown:boolean };
};
```

Render backend factors and flags, rather than recalculate scores with different weights on the phone. A null/unknown distance must not display0 miles. A score is not a hiring permission. School invitation buttons follow `canInvite` and `inviteDisabledReason` returned on the recommendation entry; server rechecks matching eligibility, documents, availability and school status when inviting or accepting. `TEACHER_NOT_ELIGIBLE` means refresh recommendations. BRIEF jobs do not support the targeted-invitation route.

The backend was rechecked at HEAD597dabd after the latest pull. Public profiles now also expose nullable `verifiedDegree` with `institutionName`, nullable `qualificationType`, `courseName`, `classification`, `yearOfAward`; display only this verified projection, not the teacher's submitted unchecked data. Degree verification remains separate from DBS/identity/document eligibility.

The public teacher profile intentionally omits home street/postcode, private coordinates/account IDs and private document status. It exposes `id,fullName,imageUrl,bio,city,county,subjects,skills,keyStages,experience,hourlyRate,dailyRate,currency,ratingAverage,ratingCount,dbsVerified,verifiedDegree,memberSince,bookings,certificates`; directory entries add `qtsQualified,availableToday`. Do not fetch the private `/instructors/:id` route to fill a school's profile screen.

### Teacher availability: save and conflict flow

`GET /availability/me` returns a nullable saved record plus confirmed booking overlays. A null availability record currently means no explicit recurring availability restriction, not “unavailable every day”. Present that state clearly and invite the teacher to save their calendar. Bookings remain authoritative occupied time; editing availability does not cancel existing bookings.

Example complete replace request:

```http
PUT /api/availability/me
```

```json
{
  "timeZone": "Europe/London",
  "weeklySchedule": {
    "weekdays": [
      {"day": 1, "slots": [{"start":"08:00","end":"18:00"}]},
      {"day": 2, "slots": [{"start":"08:00","end":"18:00"}]},
      {"day": 3, "slots": [{"start":"08:00","end":"18:00"}]},
      {"day": 4, "slots": [{"start":"08:00","end":"18:00"}]},
      {"day": 5, "slots": [{"start":"08:00","end":"18:00"}]}
    ]
  },
  "exceptions": [
    {"date":"2027-02-10","kind":"exclude"},
    {"date":"2027-02-11","kind":"replace","slots":[{"start":"10:00","end":"16:00"}]}
  ]
}
```

Saved record includes `id,instructorId,timeZone,weeklySchedule,exceptions,version,createdAt,updatedAt`. Refetch GET afterward to obtain both saved availability and confirmed booking overlays. Availability uses schedule parser which can accept minute values; website whole-hour controls should still save exactly the visible value. Do not reproduce its current15:30 default with a dropdown that only has HH:00 options. Month navigation should set day1 before changing month, so January31 does not skip February.

Before applying, fetch the check endpoint. Response example:

```json
{
  "available": false,
  "conflicts": [{
    "date": "2027-02-02",
    "start": "2027-02-02T09:00:00.000Z",
    "end": "2027-02-02T15:00:00.000Z",
    "type": "BOOKING_CONFLICT",
    "conflictingStart": "2027-02-02T10:00:00.000Z",
    "conflictingEnd": "2027-02-02T12:00:00.000Z",
    "bookingTitle": "Existing cover"
  }]
}
```

`OUTSIDE_AVAILABILITY` and `BOOKING_CONFLICT` are distinct. Private conflict detail is returned for the teacher's own check; do not require it in a school-facing conflict response. Applying/hiring/accepting independently rechecks availability inside transactions. On save, backend recalculates `scheduleConflict` for APPLIED/VIEWED/SHORTLISTED applications; refetch applications and matching as well as calendar.

### Applications: exact create, progression and hire

```http
POST /api/applications
```

```json
{"jobId":"00000000-0000-4000-8000-000000000001","coverLetter":"I can cover both scheduled days."}
```

`jobId` is required UUID; `coverLetter` optional string max2000. Use plain text unless your mobile rich-text editor has a tested compatible HTML serializer and length policy; do not send a native editor's internal JSON. The website proposal is optional. The response is an Application record; duplicates return409 instead of creating a second entry. On uncertain network delivery, query `/applications/me?jobId=...` before allowing a fresh submit.

```ts
type Application = {
  id:string; jobId:string; jobName:string; instructorId:string;
  status:'APPLIED'|'VIEWED'|'SHORTLISTED'|'HIRED'|'REJECTED';
  coverLetter?:string|null; createdAt?:string; updatedAt?:string;
  agreedTerms:OfferedJob|null;
  bookingTerms:OfferedJob|null;
  termsStatus:'RECORDED'|'LEGACY_UNVERIFIED';
  scheduleConflict?:{available:boolean;conflicts:AvailabilityConflict[]}|null;
  jobDetails?:Record<string,unknown>|null;
  school?:{id:string;name:string;imageUrl?:string|null}|null;
  bookingId?:string|null;
  conversationId?:string|null;
  automaticallyRejectedCount?:number;
};
```

`agreedTerms` is the immutable job offer the teacher applied to. `bookingTerms` is the final immutable booked offer (possibly with negotiated payment-only overrides). Do not overwrite one with the other or mutate the public job to represent a negotiated booking.

Allowed application transitions:

```text
APPLIED     → VIEWED, SHORTLISTED, HIRED, REJECTED
VIEWED      → SHORTLISTED, HIRED, REJECTED
SHORTLISTED → HIRED, REJECTED
HIRED       → no application transition
REJECTED    → no application transition
```

Viewing and shortlisting are optional. Render a forward-only stage control; never drag backwards. After HIRED, all work completion/cancellation/no-show is on the Booking. Status mutation can set HIRED, but use the dedicated school hire endpoint when implementing the website's confirmation and negotiated terms UX:

```http
POST /api/applications/APPLICATION_ID/hire
```

```json
{
  "payType": "daily",
  "payAmount": 130,
  "paymentFrequency": "weekly",
  "periodAnchor": "ASSIGNMENT_START"
}
```

All hire body fields are optional; `{}` uses original terms. `payAmount`0.01–99999999.99 and max2 decimals; `payType` enum; frequency/anchor enums; optional positive whole `hours`/`days` limited to corresponding basis. With structured schedule, provided hours/days must match derived work. Do not send invoice fee, teacher/profile ID, dates, address or arbitrary job fields. The hire response is still `Application`: navigate using `bookingId` or refetch bookings. A legacy `LEGACY_UNVERIFIED` application needs a new explicitly accepted offer; do not force-hire by inventing `agreedTerms`.

The server locks job and teacher, verifies document eligibility, exact availability and recorded terms, writes the booking snapshot, and advances occupancy atomically. `workersRequired` is capacity; when the final position is filled, remaining active applications are rejected and competing invitations cancelled. Show `automaticallyRejectedCount` when supplied and refresh all affected lists. A cancelled/no-show booking releases occupancy; completed bookings still count as filling the position. Do not assume every hire closes a multi-worker job after its first teacher.

History records contain `id,applicationId,fromStatus|null,toStatus,changedBy,createdAt`, oldest first. The app should keep the ordering and show event timestamps in UK time.

### Invitations: retries and explicit teacher acceptance

School selects an eligible teacher for a live INSTANT job:

```http
POST /api/job-invitations
```

```json
{
  "requestId": "00000000-0000-4000-8000-000000000002",
  "instructorId": "00000000-0000-4000-8000-000000000003",
  "jobId": "00000000-0000-4000-8000-000000000001",
  "message": "Please review the role and confirm whether you can cover the shifts.",
  "expiresAt": "2027-02-01T18:00:00.000Z"
}
```

Generate a fresh UUID for a new invite intent and persist it with the exact body while request outcome is unknown. **Reuse the same requestId and body on retry**. A reused requestId with different body conflicts. Send exactly one of `jobId` or `newJob`; `newJob` is a complete CreateJobInput for an INSTANT job created and published atomically with its invitation. No scheduled-not-live new job. `message` max1000; `expiresAt` must be future and no later than job start/expiry; backend default is up to seven days. Do not resend a declined invitation to the same teacher/job as a silent reset.

Invitation response shape:

```ts
type Invitation = {
  id:string;
  status:'PENDING'|'ACCEPTED'|'DECLINED'|'CANCELLED'|'EXPIRED';
  jobType:'INSTANT'|'BRIEF'; isExclusive:boolean;
  job:OfferedJob; jobStatus:JobStatus;
  instructor:{id:string;fullName:string;imageUrl:string|null};
  institution:{id:string;name:string;imageUrl:string|null};
  message:string|null; publishOnDecline:boolean;
  expiresAt:string; decidedAt:string|null; bookingId:string|null;
  invitationPath:string; invitationUrl:string|null;
  createdAt:string; updatedAt:string;
};
```

For new invites, use current non-exclusive semantics: multiple invitations can coexist, and inviting does not guarantee booking. Read `isExclusive` for historical records; do not make “exclusive reservation” promises for new flows. The teacher details screen must show the frozen `job` offer and expiry before confirmation. Accept calls `POST /job-invitations/:id/accept` with no body and gets a **Booking**. Retry of an already-accepted invitation returns its existing booking. Decline/cancel return the Invitation. Expired/filled/changed terms can win a race while the app screen is open; on409 refresh the invitation and linked job rather than keep an active Accept button.

Translate web `invitationPath` into the app's invitation-details route by ID. Do not open an authenticated web page just to perform accept/decline when native endpoints already exist.

### Shared immutable offer model

`OfferedJob` is stored in applications, invitations and bookings:

```ts
type OfferedJob = {
  id:string; title:string; description:string;
  subject:string|null; subjects:string[]; requiredSkills:string[];
  minExperienceYears:number|null; keyStages:string[];
  address:string|null; city:string|null; county:string|null;
  postalCode:string|null; countryCode:string;
  latitude:number|null; longitude:number|null; parkingInfo:string|null;
  startDate:string|null; endDate:string|null;
  payAmount:number|null; payType:string|null; currency:string;
  paymentFrequency:string|null; periodAnchor:string; timeZone:string;
  schedule:Schedule|null; workersRequired:number;
  scheduledMinutes:number|null; hours:number|null; days:number|null;
};
```

Null legacy fields stay null; do not manufacture hours or a new accepted frequency. Use fallback read-only labels where terms are partial. Current job listing state/title edits must not replace the offer recorded when the teacher applied/accepted.

### Bookings and lifecycle actions

Booking response includes:

```ts
type Booking = {
  id:string; applicationId:string;
  source:'APPLICATION'|'DIRECT_HIRE';
  status:'CONFIRMED'|'COMPLETED'|'CANCELLED'|'NO_SHOW';
  agreedTerms:OfferedJob|null; termsStatus:'RECORDED'|'LEGACY_PARTIAL';
  job:{id:string;title:string;description:string;subject:string|null;
    subjects:string[];keyStages:string[];address:string|null;city:string|null;
    county:string|null;postalCode:string|null;parkingInfo:string|null};
  instructor:{id:string;fullName:string;imageUrl:string|null};
  institution:{id:string;name:string;imageUrl:string|null};
  startDate:string|null;endDate:string|null;payAmount:number|null;payType:string|null;
  currency:string;paymentFrequency:string|null;periodAnchor:string;timeZone:string;
  schedule:Schedule|null;scheduledMinutes:number|null;hours:number|null;days:number|null;
  attendancePolicyEffectiveAt:string|null;
  attendanceShifts:AttendanceShift[];
  attendancePayroll:AttendancePayroll|null;
  attendanceAdjustments:Array<{id:string;shiftId:string;amountPence:number;reason:string;status:string;createdAt:string}>;
  completedAt:string|null;cancelledAt:string|null;cancelledById:string|null;cancelReason:string|null;
  reviews:Review[];
  invoice:BookingInvoiceSummary|null;
  automaticPayment:{state:string;message:string;nextCollectionAt:string|null};
  tip:BookingTipSummary|null;
  createdAt:string;updatedAt:string;
};
```

The runtime `job` can contain the full accepted snapshot beyond its Swagger summary. Preserve unknown additive keys but only use documented fields. `invoice` is a current invoice summary, not an array of every historical period invoice. Payment chapter supplies detailed invoice/tip fields and authoritative automaticPayment states. Do not decide all periods are unpaid just because the latest invoice is pending.

List confirmed bookings under Active, plus Completed/Cancelled/No-show tabs. UI “All” omits status. Open `/bookings/:id` for a notification/deep link. A teacher cannot mark attendance, complete, or no-show. School/admin may complete/no-show only after start and only from appropriate current lifecycle state. Both participants may cancel a confirmed booking with a trimmed non-empty reason (max1000 characters). Backend is authoritative for exact state and dates; completed/cancelled/no-show states cannot be overwritten optimistically.

```http
PATCH /api/bookings/BOOKING_ID/cancel
```

```json
{"reason":"The school no longer needs cover for these dates."}
```

Complete/no-show have no body. Completion can make eligible payment collection proceed; show a confirmation explaining payment consequences and invalidate payment queries after success. No automatic UI completion based merely on local clock or the final shift ending. Do not display a successful mutation until the backend responds. A409 concurrent-state error should show “This booking changed; refreshed latest details” and refetch.

### Attendance: school controls, read-only teacher view, payment locks

Render one calendar date with its actual dated shifts; use `workDate` for grouping and `scheduledStart`/`scheduledEnd` instants with the shift `timeZone` for labels. Highlight current/selected day, show present/absent/awaiting counts, reminder and response deadline, recorded reason and audit history.

```ts
type AttendanceShift = {
  id:string; workDate:string; scheduledStart:string;scheduledEnd:string;timeZone:string;
  status:'AWAITING_CONFIRMATION'|'PRESENT'|'ABSENT';
  decisionSource:'TEACHER'|'SCHOOL'|'ADMIN'|'SYSTEM_NO_RESPONSE'|null;
  reason:string|null;notifiedAt:string|null;responseDeadline:string|null;decidedAt:string|null;
  audits:Array<{id:string;actorUserId:string|null;fromStatus:string|null;toStatus:string;
    fromSource:string|null;toSource:string|null;reason:string|null;createdAt:string}>;
  correctionRequests:Array<{id:string;requestedById:string;requestedStatus:string;reason:string;
    status:'PENDING'|'APPROVED'|'REJECTED';reviewedById:string|null;reviewReason:string|null;
    reviewedAt:string|null;createdAt:string}>;
};
```

School's initial decision:

```http
PATCH /api/bookings/BOOKING_ID/attendance/SHIFT_ID
```

```json
{"status":"PRESENT","reason":"School confirmed attendance."}
```

Only PRESENT/ABSENT are writable. Initial reason optional/max500. The shift must have ended; if its state is already decided use `/correct` with a **required reason of3–1000 characters**. Disable the button for the existing decision and show the correction reason dialog before changing it. Response is the full refreshed Booking, including recalculated payroll. Replace cache with that record and invalidate all booking/payment summaries.

An existing pending correction request is reviewed with:

```json
{"decision":"APPROVED","reason":"Confirmed by the school attendance register."}
```

at `PATCH /bookings/{id}/attendance/correction-requests/{requestId}`. REJECTED is the other decision. Required reason3–1000. Do not imply teachers can create new requests through an endpoint that does not exist in this checkout.

Legacy bookings may have no `attendancePolicyEffectiveAt`. Show “Setup required” and the school-only activate action if meaningful. `/attendance/activate` requires a structured schedule and unfinished shifts; activation is prospective, not a backfill of all old completed work. New bookings capture policy start and create dated shifts at booking creation. Display backend `responseDeadline`; do not hard-code it to24h if configuration changes. Backend default window24h, reminder worker interval60s, can mark no-response absent according to its policy. Refresh on returning to foreground.

**Paid lock deployment note:** the local working tree adds `AttendancePayroll.periods[].paid` and `shiftIds`, plus backend409 `ATTENDANCE_PAYMENT_COMPLETED`. Those changes are not included in backend HEAD597dabd until committed/deployed. The app should tolerate missing flags without claiming a period is settled, but feature completion requires deploying the backend lock. For a paid period, hide present/absent/correction controls and show “Payment completed — attendance locked.” An unpaid non-void pending/open/uncollectible invoice can return `ATTENDANCE_INVOICE_MUST_BE_VOIDED`; direct user to the supported invoice management path, not a client-side forced correction.

### Payroll and display-only release schedule

Do not recalculate actual payable money in React Native from checkboxes. Use the backend payroll object:

```ts
type AttendancePayroll = {
  covered:boolean;currency:string;payType:string|null;paymentFrequency:string|null;
  estimatedAmountPence:number;payableAmountPence:number;pendingAmountPence:number;
  excludedAmountPence:number;reviewAmountPence:number;payableMinutes:number;payableDays:number;
  paidAmountPence:number;adjustmentDuePence:number;
  exclusions:Array<{shiftId:string|null;date:string;amountPence:number;reason:string}>;
  periods:Array<{
    key:string;label:string;startsAt:string;endsAt:string;closesAt:string;
    estimatedAmountPence:number;payableAmountPence:number;pendingAmountPence:number;
    excludedAmountPence:number;reviewAmountPence:number;payableMinutes:number;payableDays:number;
    paid?:boolean;shiftIds?:string[]; //local backend patch; verify deployment
  }>;
};
```

Rules to explain beside values:

- Hourly: each present shift's scheduled minutes earns proportionate rate; absent shift excludes only its amount; unanswered remains pending.
- Daily: a day's full rate is payable only if all required shifts are present. All absent excludes that day. Mixed present+absent is held for review; there is no configured half-day proration. Multiple shifts do not multiply the daily rate.
- Fixed: explicit completion plus all present, or no decisions recorded, can make the agreed total payable. All absent excludes total; mixed attendance requires review. Never multiply fixed total by days or slots.
- Paid is an invoice state, not the same as “payable/ready”. `payableAmountPence` may include earnings already paid; do not call it an outstanding balance without using invoice/paid data correctly.

The “View payment release schedule” button belongs in a dedicated payment-planning section. Open a scrollable modal/sheet listing periods, estimated eligibility dates/times in `booking.timeZone`, number of working dates/shifts, expandable dates, and status. This is **read-only**: opening it must not call invoice creation, payment synchronization or attendance mutation. Label “All scheduled shifts assumed present” and explain that actual attendance, completion and card processing decide final collection.

For current records prefer `attendancePayroll.periods[].closesAt` as server-calculated eligibility. When a future all-present local forecast is needed, distinguish it from actual current payroll; there is no dedicated schedule-preview endpoint. Reuse immutable booked terms, with corrected calendar-date extraction and explicitly tested boundaries; the existing website helper has the mismatches described above.

Period keys used by payroll/invoices include daily `YYYY-MM-DD`; calendar weekly `week:YYYY-MM-DD` (Monday); assignment weekly `week:1`, `week:2`; calendar monthly `month:YYYY-MM`; assignment monthly `month:1`; fixed `completion`; historical hourly shift-start ISO. Show “Payment completed” only for the matching server-paid period, else “Pending”; a whole-booking paid invoice with null/completion key covers the booking. Do not mark every future period completed just because any earlier recurring invoice was paid. Historical hourly website preview currently uses a different key format; use backend period identity instead.

### Reviews

Reviews are optional, written after COMPLETED and within14 days of `completedAt`. Each side may review the other once per booking. The backend derives reviewer side from the token; never send reviewerId/reviewerType or let a school review itself.

```http
POST /api/reviews
```

```json
{
  "bookingId":"00000000-0000-4000-8000-000000000004",
  "rating":5,
  "comment":"Prepared, punctual and clear with the class."
}
```

Rating integer1–5; optional trimmed comment max2000. Response:

```ts
type Review = {
  id:string;bookingId:string;reviewerType:'INSTRUCTOR'|'INSTITUTION';
  rating:number;comment:string|null;jobTitle?:string;reviewerName?:string;
  createdAt:string;updatedAt:string;
};
```

Profile list responses include reviewerName/jobTitle; booking nested reviews may not. Submission invalidates booking details, reviews about the counterpart and their rating/profile summary. Duplicate409 means show existing review/refetch, not retry until multiple reviews appear. No app edit/delete endpoint exists for the author's review. Only admin can delete for moderation.

### Error handling for hiring and attendance

Show server `message` in safe user language, map `fieldErrors` to inputs, keep `requestId` for support, and preserve user-entered drafts. Do not assume every error has a custom code: several services throw plain framework exceptions with only a message. The common error-envelope chapter explains where these fields are nested.

| HTTP/code or condition | UI action |
|---|---|
|401 | Refresh through common auth client once, then sign in; never retry every mutation in a loop |
|403 `SCHOOL_INACTIVE` | Show approval/account-status route; preserve draft |
|409 `SCHOOL_TYPE_REQUIRED` | Open school settings to choose Primary/Secondary, then return to draft |
|403 `INSTRUCTOR_DOCUMENTS_NOT_VERIFIED` | Explain document/expiry/review requirement; teacher documents screen; school can refresh eligibility |
|422 `INVALID_JOB_TERMS` | Show fieldErrors and return to the relevant job step |
|400 `INVALID_JOB_SCHEDULE` | Keep selected dates/slots; highlight schedule field |
|409 `JOB_TYPE_LOCKED` | Posting type changes are limited to an unused, never-published draft; create a new role |
|409 `JOB_TERMS_LOCKED` | Disable material editing; offer creating a new job, not overwriting accepted terms |
|409 `JOB_HISTORY_PROTECTED` or deletion conflict | Offer Close role rather than permanent delete |
|409 `JOB_FILLED`,`JOB_RESERVED`,`JOB_UNAVAILABLE` | Refresh job/application/invitation, hide invalid action; another action may have won |
|409 `JOB_TERMS_CHANGED`,`APPLICATION_TERMS_UNVERIFIED` | Require a new explicit offer/acceptance; do not silently substitute current listing |
|409 `TEACHER_SCHEDULE_CONFLICT` | Display provided required-date conflicts; refresh availability/booking overlays |
|403 `TEACHER_NOT_ELIGIBLE` | Refresh recommendation, explain teacher is no longer eligible |
|403 `BRIEF_INVITATIONS_DISABLED` | BRIEF uses open applications; invite through an INSTANT job |
|409 `INVITATION_PENDING` | Open existing pending invitation; do not generate fresh UUIDs repeatedly |
|409 `INVITATION_DECLINED`,`INVITATION_EXPIRED`,`INVITATION_CANCELLED` | Show final state and stop accept/resend UI |
|409 requestId reused with different request | Start a new explicit invitation intent after user confirmation, using a new UUID |
|409 duplicate application | Load `/applications/me?jobId=...` and show existing application |
|400 invalid transition/future action | Show returned reason and latest state; disable actions unavailable before start/end |
|400 `INVALID_BOOKING_PAYMENT_TERMS` | Field-level validation on negotiated payment dialog; keep original job unchanged |
|409 `ATTENDANCE_PAYMENT_COMPLETED` | Refresh booking; lock attendance; explain payment already settled |
|409 `ATTENDANCE_INVOICE_MUST_BE_VOIDED` | Keep original attendance; follow invoice-management workflow |
|409 already-recorded attendance | Refresh and offer correction with reason, not initial PATCH again |
|400 review not complete/window closed;409 duplicate | Disable submit and show backend condition |
|404 related public job | Try authenticated accessible/context route only if user is a participant; do not leak private data via admin endpoints |
|429 | Honor Retry-After/common retryAfter; disable submit countdown; retain same invitation requestId |
|Network timeout on write | Reconcile by GET and known IDs before retry. Invitation UUID supports safe retry; job creation has no equivalent client requestId |

### Query invalidation and foreground refresh

Use account-scoped query keys; clear them when logging out/switching users. Never let a school query result appear in teacher state after account switch.

| Mutation/event | Refetch/invalidate |
|---|---|
|Create/publish/update/close job | job byID, school job lists/counts, discovery/recommendations, job applicants/invitations where relevant |
|Apply | teacher applications, job-specific own application, school applications/ranked list, recommendations and notifications |
|View/shortlist/reject/hire | application detail/history, lists, job, invitations, bookings, teacher availability, matching, notifications; on hire payment readiness too |
|Create/accept/decline/cancel invitation | invitation detail/list, job, recommendations, applications; accept also bookings, availability, payment eligibility |
|Save availability | availability, teacher applications' scheduleConflict, job scores/recommendations |
|Complete/cancel/no-show booking | booking detail/list, job occupancy, availability, applications/history where relevant, invoice/billing/payment status, notifications |
|Attendance record/correct/review | replace full booking from mutation; invalidate booking lists, billing/invoices and schedule/payment status |
|Review submit | booking, counterpart reviews and profile/rating |
|Payment/notification realtime event | matching booking/invoice/billing/notifications and paid attendance lock |
|App foreground/network reconnect | active booking details, invitations, pending applications and payment status; countdowns should be computed from timestamps again |

For a mobile push/deep link to a stale or inaccessible item, fetch fresh detail first, handle404/403 with a readable unavailable screen, and keep a Back to list action. No component should trust local countdowns to authorize hire, accept, mark attendance or pay.

### Acceptance checklist for mobile parity

- Two-day Tuesday/Wednesday role only enables those weekdays; multi-week weekdays repeat correctly; excluded opening dates do not shift agreed anchor.
- Hourly rate with daily/weekly/monthly release stays distinct from frequency; fixed shows only After completion; legacy hourly/milestone render without being offered on new forms.
- Missing subject/key stage/invalid listing dates show correct validation; failed publish retains created draft ID.
- A teacher cannot create school jobs, approve their own application, mark attendance or mutate school billing.
- Invitations retry with stable requestId; repeated accept returns same booking; final-slot races handle409.
- New document expiry between list load and hire produces a useful verification error rather than unexplained disappearance.
- Accepted terms are stable after public listing changes; private completed listing can still be reached by its participants.
- Split shifts, overnight shifts, DST weekends, Jan31 monthly anniversaries and GBP pence rounding match server expectations.
- Paid attendance controls disappear after webhook/refetch; historical paid periods retain their status when a later invoice is pending.
- Date labels agree on devices in London and Karachi; calendar navigation Jan31→February does not skip.
- Review screen opens only for completed eligible booking and handles duplicate/window expiry.

Source anchors for maintenance: backend `src/modules/jobs/{jobs.controller.ts,jobs.service.ts,job-policy.ts,job-schedule.ts,job-listing-window.ts,dto/*}`, `applications/{applications.controller.ts,applications.service.ts,application-status.machine.ts,dto/*}`, `bookings/{bookings.controller.ts,direct-hire.service.ts,hiring-transaction.ts,attendance.service.ts,attendance-payroll.ts,dto/*}`, `availability/*`, `matching/*`, `reviews/*`; frontend `components/organisms/{PostJobPage,ApplicationsWorkspacePage,BookingsPage,BookingAttendancePanel,PaymentReleaseSchedule,CalendarPage}.tsx`, `features/{jobs,applications,bookings,availability,invitations}`. Backend local attendance patch must be deployed with its UI contract.


<a id="payment-flows"></a>

## Payments, school billing, teacher payouts, and tips

### Contract authority and important differences after the dev pull

This section is based on backend `597dabd` plus the local paid-attendance changes, and frontend `91b055f` plus local changes. Every path below is relative to the **backend `/api` base**, not a Next.js proxy route. Examples are illustrative `data` values inside the backend success envelope, with fictional IDs. Money labelled `Pence` is an integer; `rateAmount` / job `payAmount` is a decimal pound rate. Do not mix those units.

The current backend adds school billing synchronization fields and includes a notification outbox for some hiring flows. Payment-paid notices still use a best-effort trigger after the invoice transition; do not assume all notification types share durable outbox recovery. Current pricing and mobile-return rules:

- **New booking invoices add a flat £18 (1800 pence) SupplyED fee per invoice; new tips have no SupplyED fee.** This is the current backend `PROCESSING_FEE_PENCE`, not the old percentage configuration or the earlier £15 commit. Daily release can create multiple invoices, each with its own £18 fee; do not label it as one £18 fee per entire multi-period booking. Existing invoices and resumed tip reservations retain their stored amounts. Always display `teacherAmountPence`/`tipAmountPence`, `feeAmountPence`, and `totalAmountPence` returned by the server rather than recomputing old documents using today's pricing.
- Backend school setup/teacher onboarding/tip return URLs are constructed from `FRONTEND_URL`; request DTOs accept no `returnUrl`. A native custom scheme cannot be passed as an undocumented extra property. Build a resume-and-sync flow using persisted pending-flow IDs, or explicitly implement and verify an approved HTTPS universal-link/app-link return path. Do not place JWTs in redirect URLs.

Sources: backend `src/modules/payments/{payments.controller.ts,booking-payment.controller.ts,school-billing.service.ts,booking-tips.service.ts,payments.config.ts}` and frontend `features/payments/{actions.ts,types.ts,payment-status.ts}`.

### Money lifecycle and separate status concepts

1. A school authorizes a reusable card on Stripe's hosted setup page.
2. An eligible booking period creates an invoice using the agreed terms and attendance. The backend adds the flat £18 SupplyED fee to each newly created booking invoice.
3. Automatic invoices charge off-session; manual invoices are reviewed and paid explicitly. Reuse an existing invoice to recover a failed automatic payment.
4. Server-side Stripe webhooks and reconciliation confirm payment. A closed browser or optimistic client result does not make an invoice paid.
5. Teacher funds can be pending/available in Stripe before they reach the bank. Bank payout has a separate lifecycle.
6. A completed-booking tip is a separate Checkout payment, not an ordinary booking invoice, and does not settle that invoice.

Keep these values separate in the store and UI:

| Concept | Values | Display rule |
|---|---|---|
| School card setup | `NOT_STARTED`, `PENDING`, `READY`, `FAILED` | Whether the card authorization is ready |
| School opt-in | `automaticPaymentsEnabled` boolean | Backend result after a successful save; never only local state |
| School Stripe settings synchronization | `SYNCED`, `PENDING`, `FAILED` | An opt-out may be recorded while Stripe-side synchronization still needs retry |
| Invoice | `PENDING`, `OPEN`, `PAID`, `VOID`, `UNCOLLECTIBLE` | `PAID` means collected from school, not bank paid to teacher |
| Booking automatic explanation | `DISABLED`, `BLOCKED`, `REVIEW_REQUIRED`, `WAITING_ATTENDANCE`, `NOT_DUE`, `NO_PAYMENT_DUE`, `PREPARING`, `SCHEDULED`, `PROCESSING`, `FAILED`, `PAID` | Render server `message`; do not infer this from the school toggle alone |
| Bank payout | `pending`, `in_transit`, `paid`, `failed`, `canceled` | Payout state from teacher balance response |
| Tip | `PENDING`, `PROCESSING`, `PAID`, `FAILED`, `CANCELLED`, `REFUNDED` | Show independently from ordinary payment |

### School billing endpoint contract

All require an `INSTITUTION` access token and the caller's institution profile. No caller-supplied institution ID is accepted.

| Method | Path | Body | Success |
|---|---|---|---|
| GET | `/payments/school-billing` | None | 200 `SchoolBillingSettings` |
| POST | `/payments/school-billing/setup-session` | `{"consentToTerms":true}` | 201 `{url,sessionId,expiresAt}` |
| POST | `/payments/school-billing/sync` | `{"sessionId":"cs_test_example"}` | 200 `SchoolBillingSettings` |
| PATCH | `/payments/school-billing` | Enable: `{"automaticPaymentsEnabled":true,"consentToTerms":true}`; disable: `{"automaticPaymentsEnabled":false}` | 200 `SchoolBillingSettings` |
| DELETE | `/payments/school-billing/payment-method` | None | 200 `SchoolBillingSettings` |

`consentToTerms` on setup must be boolean true, not a string. `sessionId` matches `^cs_(?:test_|live_)?[A-Za-z0-9]+$`. The update DTO requires `automaticPaymentsEnabled`; `consentToTerms` is optional syntactically but required true by service logic when enabling.

Complete response shape:

```ts
type SchoolBillingSettings = {
  automaticPaymentsEnabled: boolean;
  setupStatus: 'NOT_STARTED' | 'PENDING' | 'READY' | 'FAILED';
  paymentMethod: null | {
    type: string; label: string; last4: string; mandateStatus: string | null;
  };
  lastSetupError: string | null;
  canEnableAutomaticPayments: boolean;
  consentedAt: string | null;                 // ISO instant
  consentTermsVersion: string | null;
  stripeSyncStatus: 'SYNCED' | 'PENDING' | 'FAILED';
  stripeSyncError: string | null;
  nextScheduledCollectionAt: string | null;  // ISO; currently next known invoice retry, not a full forecast
  currentPayment: null | {
    id: string; bookingId: string; jobTitle: string;
    status: string; totalAmountPence: number;
    failureCode: string | null; failureMessage: string | null;
    nextAttemptAt: string | null; paymentAttemptCount: number;
  };
};
type SchoolSetupSession = {
  url: string; sessionId: string; expiresAt: number; // Unix seconds, unlike normal ISO fields
};
```

Example ready response:

```json
{
  "automaticPaymentsEnabled": true,
  "setupStatus": "READY",
  "paymentMethod": {"type":"card","label":"Visa ending 4242","last4":"4242","mandateStatus":null},
  "lastSetupError": null,
  "canEnableAutomaticPayments": true,
  "consentedAt": "2026-11-23T10:00:00.000Z",
  "consentTermsVersion": "configured-server-version",
  "stripeSyncStatus": "SYNCED",
  "stripeSyncError": null,
  "nextScheduledCollectionAt": null,
  "currentPayment": null
}
```

Implement the settings screen in this order:

1. Fetch settings, render loading/error/retry explicitly. Never show “off” merely because the request is loading or failed.
2. Show saved card using only the returned masked label and last four digits.
3. Before starting setup, require an explicit unchecked authorization control explaining saved-card off-session payments, fee, agreed schedule, and the ability to disable future automation.
4. POST setup, persist `{kind:'school-card-setup',sessionId,createdAt,userId}` **before** opening the returned HTTPS Stripe Checkout URL. Match the current web validation: `https://checkout.stripe.com`, no URL username/password.
5. Backend redirects success to `/settings?setup=success&session_id={CHECKOUT_SESSION_ID}`, cancel to `/settings?setup=cancelled` under configured `FRONTEND_URL`. On app foreground or approved callback, call `/sync` with the stored session ID, then GET settings. The query string is not proof of successful setup.
6. Render `READY` only from returned state. A stale/incomplete/failed session may remain pending or disabled.
7. Switch enable uses PATCH plus fresh consent; disable uses PATCH false. Disable the switch during the request. Replace local cache with the returned object. Invalidate booking and invoice/payment status queries because eligibility can change.
8. If `stripeSyncStatus` is pending/failed, explain that settings synchronization is incomplete and show retry/refresh. Do not promise every existing provider-side collection has stopped just because local opt-in is false.
9. Removing the card requires a confirmation, calls DELETE, and uses returned settings. It disables automatic payments. Do not delete the card locally before the server confirms.
10. A legacy non-card method should prompt card replacement rather than expose it as eligible automatic setup.

Expected failures include: 400 missing consent/card; 403 missing institution profile/ownership mismatch; 404 setup session not found; 409 billing changed while setup opened; 502 provider returned no usable page; 503 missing provider/terms configuration or provider unavailable. These messages generally do **not** have a stable custom `code`; use HTTP status plus optional code and show the server's safe message.

### Automatic invoice scheduling and status

There is no app “release every payment” cron. Backend workers are responsible. Default billing and reconciliation interval is five minutes; backlog processing is bounded. The UI date is eligibility, not an exact charge time or bank-arrival promise. Server configuration must enable automatic billing and workers; it is not set by the mobile switch.

Conditions include server enabled, authorized school setting, card type/READY/default card, settings sync completed, current consent, teacher payout readiness, positive eligible amount, resolved attendance, closed period/completed booking, and no previously submitted conflicting invoice. Enabling automation does not sweep all historic periods; activation grace defaults to five minutes.

For hourly/daily rates, payable periods require `pendingAmountPence === 0` and `reviewAmountPence === 0`. Present work contributes to payable earnings; absent work is excluded. Fixed work is normally `completion` and requires an explicit COMPLETED booking; merely passing its final planned date is insufficient. Completed hourly/daily bookings with **no attendance decisions** can use accepted planned units. Mixed fixed attendance requires review. Voiding an automatic invoice moves the booking away from new automatic charges and toward reviewed/manual remaining-work invoicing.

`POST /bookings/:id/payment-sync` (200 Booking) is available to either owning participant or admin, with no body. **It is a mutation:** it evaluates automatic eligibility, can create/collect a payment, then syncs existing open/uncollectible invoices. Do not use it as an unattended polling endpoint. A visible “Refresh payment” action should disclose that it checks/updates payment, while ordinary screen refresh should use GET booking/invoice reads.

Booking response includes:

```ts
type AutomaticPayment = {
  state: 'DISABLED'|'BLOCKED'|'REVIEW_REQUIRED'|'WAITING_ATTENDANCE'|'NOT_DUE'|
         'NO_PAYMENT_DUE'|'PREPARING'|'SCHEDULED'|'PROCESSING'|'FAILED'|'PAID';
  message: string;
  nextCollectionAt: string | null;
};
```

School billing `currentPayment` and booking `automaticPayment` serve different scopes. One is a school summary of an outstanding automatic invoice; the other explains this booking. Do not replace the booking explanation with a single global switch value.

For phase badges, mirror web `features/payments/payment-status.ts`: PAID first; a failure message means failed; PENDING means preparing; zero attempts with a next-attempt timestamp means scheduled; otherwise processing. For card verification use failure codes `ACTION_REQUIRED`, `authentication_required`, `invoice_payment_intent_requires_action`, `payment_intent_requires_action`; offer verification/recovery on the existing invoice.

### Payment-release preview and paid attendance

The app needs a prominent “Payment release schedule” section on each booking and a read-only modal. Display all scheduled days assumed present, each estimated period/date, and **Payment completed** versus **Pending**. Opening it must not call payment-sync, create invoice, mark attendance, or submit payment.

- Use immutable accepted booking schedule/terms, not an edited current job.
- Group using the actual backend period keys; do not invent keys merely for rendering.
- Daily closes at next UK midnight. Weekly CALENDAR closes Monday; assignment anchor uses seven-day windows from assignment start. Monthly CALENDAR closes month start; assignment anniversaries clamp shorter months then recover original day. Fixed closes after completion, not automatically at predicted end time.
- The backend attendance periods expose `closesAt`; use it for authoritative existing-period display. The local all-present schedule calculation is still a forecast and must be labelled as such.
- Payment-completed status comes only from a PAID invoice covering that key or backend payroll period `paid:true`. An unpaid latest invoice must not erase older paid periods. A legacy whole-booking null period key can cover all periods.
- In the local patched API, period `paid` and `shiftIds` permit attendance locking. Hide present/absent/correction approval controls for paid shifts, and respect server `ATTENDANCE_PAYMENT_COMPLETED` even if the client is stale.
- Do not automatically mark a future period paid based on its elapsed date, consent, payout setup, or payable attendance.
- Do not blindly copy existing UTC `.slice(0,10)` preview code for London dates: during BST this can become the previous UK calendar day. Convert instants into the booking's IANA timezone, keep date-only values as dates, and regression-test July and GMT/BST boundaries.
- The current legacy hourly forecast key differs from backend ISO shift-start keys; retain an explicit compatibility test or hide a misleading paid estimate for unmatched legacy keys. New web forms remove hourly release and fixed milestone options; old backend records may still contain them.

### Invoice endpoints, bodies, and response

| Method/path | Caller | Request | Success |
|---|---|---|---|
| POST `/invoices` | Owning school or admin | `bookingId`, optional `unitsWorked`, optional `poNumber` | 201 Invoice |
| GET `/invoices/me` | Teacher/school | `page=1`, `limit=20` (1–100), optional `status` | 200 `{invoices,pagination}` |
| GET `/invoices/:id` | Owning participant/admin | None | 200 Invoice |
| POST `/invoices/:id/payment-session` | Owning school | None | 200 PaymentSession |
| POST `/invoices/:id/sync` | Owning participant/admin | None | 200 Invoice |
| POST `/invoices/:id/send` | Owning school/admin | None | 200 Invoice |
| GET `/invoices` | Admin only | Page/status plus `jobId`,`bookingId`,`instructorId`,`institutionId` UUID filters | 200 invoice page |
| GET `/invoices/job/:jobId` | Admin only | UUIDv4, page/status | 200 job payment audit |
| POST `/invoices/:id/void` | Admin only | None | 200 Invoice |
| POST `/invoices/:id/refund` | Admin only | Optional `amountPence`, `reason` | 200 Invoice |

Allowed party invoice filters are PENDING/OPEN/PAID/VOID/UNCOLLECTIBLE. Pagination is `{page,limit,total,totalPages,hasNextPage}`. The backend chooses authorization from participants, not `createdById` (which can be an admin or null).

Manual creation examples:

```json
{"bookingId":"11111111-1111-4111-8111-111111111111","poNumber":"PO-2026-014"}
```

```json
{"bookingId":"11111111-1111-4111-8111-111111111111","unitsWorked":4.5}
```

`bookingId` UUID required. `poNumber` is trimmed nonempty string max 100 when present. `unitsWorked` is numeric 0.01–9999.99, at most 2 decimals, and limited by accepted units. Omit for fixed and attendance-covered work: backend calculates the remaining payable amount. Only COMPLETED bookings can be manually invoiced; attendance pending/review conflicts return 409 `ATTENDANCE_PENDING`. New backend handles remaining uninvoiced periods rather than double-billing prior paid periods.

Complete invoice data shape:

```ts
type Invoice = {
  id: string; createdById: string | null;
  status: 'PENDING'|'OPEN'|'PAID'|'VOID'|'UNCOLLECTIBLE';
  booking: {
    id: string; jobId: string; jobTitle: string;
    startDate: string|null; endDate: string|null;
    hours: number|null; days: number|null;
    instructor: {id:string;userId:string;name:string};
    institution: {id:string;userId:string;name:string};
  };
  payType: string; rateAmount: number; unitsWorked: number|null;
  teacherAmountPence: number; feeAmountPence: number; totalAmountPence: number;
  currency: string; poNumber: string|null;
  billingPeriodKey: string|null; billingPeriodLabel: string|null;
  collectionMethod: string; // normally charge_automatically or send_invoice
  invoiceNumber: string|null; hostedInvoiceUrl: string|null; invoicePdfUrl: string|null;
  dueAt: string|null; paidAt: string|null; voidedAt: string|null;
  amountRefundedPence: number; disputeStatus: string|null;
  paymentAttemptCount: number; nextPaymentAttemptAt: string|null;
  lastPaymentFailureCode: string|null; lastPaymentFailureMessage: string|null;
  createdAt: string; updatedAt: string;
};
```

Never display `totalAmountPence` as teacher earnings. Display teacher amount, fee, and school total separately. Refund/dispute information does not necessarily introduce a new invoice status: a refunded invoice remains PAID with `amountRefundedPence` increased. Show net/refunded amounts accordingly.

#### When to show “Pay manually”

Mirror the checked-in web predicate instead of `!automaticPaymentsEnabled` alone:

1. School only.
2. An existing unpaid invoice: allow OPEN/UNCOLLECTIBLE if it is manual, or automatic **with a failed attempt**. Do not pay a PENDING reservation, a PAID invoice, or an automatic invoice already scheduled/processing.
3. Without an unpaid invoice, allow a COMPLETED booking when automatic state is REVIEW_REQUIRED, or DISABLED **and** the school's stored setting is false.
4. Do not create an attendance-covered manual invoice if pending/review amounts are positive or payable amount is zero.
5. A previously paid period is not by itself a reason to hide remaining-work manual invoicing; server decides remaining obligations.
6. On conflict/network uncertainty, reload booking and invoice before retrying. Never blindly create a second obligation.

#### Pay/recover one existing invoice

`POST /invoices/:id/payment-session` returns:

```json
{
  "clientSecret":"pi_example_secret_example",
  "customerSessionClientSecret":"cuss_example_secret_example",
  "publishableKey":"pk_test_example",
  "amountPence":3800,
  "currency":"gbp"
}
```

These are ephemeral UI credentials, not data to log or put into links. The current web uses Stripe Payment Element and `confirmPayment` with an invoice return URL; this code cannot be pasted into a React Native View. Backend `customerSessions.create` configures the **web `payment_element` component**, and its response omits `customerId`. Installed native Stripe types may accept PaymentSheet parameters, but this is not evidence that this web CustomerSession/confirmation-secret contract supports a drop-in native saved-card PaymentSheet. Do not fabricate a customer ID, ephemeral key, or `/payment-sheet` endpoint. For exact current server parity, open the returned invoice's HTTPS `hostedInvoiceUrl` externally and sync on app resume. A native sheet should be a separately verified adapter/backend contract, including the compatible session component and return handling.

A payment-session request may409 when invoice became paid/voided elsewhere or automatic collection has not failed. Treat these as refresh-state events, not “card declined.” Provider unavailable is 503; missing provider payment is 502. After external payment completion/cancel/app resume, call POST invoice sync and refetch invoices/bookings/billing/notifications. Show processing until backend PAID. Do not charge/create a second invoice because the browser closed.

The backend `/sync` reads Stripe. Manual `/send` resends an unpaid invoice. Avoid automatically retrying these user actions on every render. Refunds and void are admin operations; ordinary teacher/school apps must not offer them.

Refund request body is `{}` for all remaining refundable value, or `{"amountPence":500,"reason":"requested_by_customer"}`. Amount is integer>=1 and at most remaining refundable total; reasons are `duplicate`, `fraudulent`, `requested_by_customer`. Validation and role 403 still apply server-side.

### Teacher payout setup and withdrawals

| Method/path | Body | Success | Role |
|---|---|---|---|
| GET `/payments/payout-account` | None | 200 PayoutAccount | Teacher |
| POST `/payments/payout-account/onboarding-link` | None | 200 `{url,expiresAt}` | Teacher |
| POST `/payments/payout-account/dashboard-link` | None | 200 `{url,expiresAt:null}` | Teacher, account with dashboard |
| POST `/payments/payout-account/session` | None | 200 `{clientSecret,publishableKey,expiresAt}` | Teacher |
| GET `/payments/payout-account/balance` | None | 200 Balance | Teacher |
| POST `/payments/payout-account/instant-payout` | `{}` or `{"amountPence":10000}` | 201 PayoutSummary | Teacher |
| GET `/payments/payout-accounts/instructor/:instructorId` | None | 200 PayoutAccount | Admin |

```ts
type PayoutAccount = {
  connected:boolean; ready:boolean; detailsSubmitted:boolean;
  chargesEnabled:boolean; payoutsEnabled:boolean;
  requirementsDue:string[]; disabledReason:string|null;
};
type PayoutSummary = {
  id:string;amountPence:number;method:string;status:string;arrivalDate:string;
};
type PayoutBalance = {
  pendingPence:number;availablePence:number;instantAvailablePence:number;
  instantDestination:null|{id:string;label:string};recentPayouts:PayoutSummary[];
};
```

A missing payout account returns connected/ready false and empty requirements, not necessarily404. Balance can return all zeros for absent/unready account or unconfigured Stripe; do not confuse that with proof of no earned invoices. Fetch payout account and balance together. `ready` response is computed from chargesEnabled&&payoutsEnabled; stricter collection logic also examines submitted details/requirements/disabled reason, so use booking `automaticPayment` to explain blockers.

Use the hosted onboarding-link as the current backend-compatible native flow. Links are single-use/expiring; request a fresh one rather than storing/reopening indefinitely. Existing returns are `FRONTEND_URL/payouts/return` and refresh `/payouts/refresh`. On app resume, refresh payout account, balance, bookings and profile completion; returning from onboarding is not proof that requirements passed.

The web uses `@stripe/connect-js`/`@stripe/react-connect-js` embedded components. Do not render those DOM components inside native JSX. Native Connect support is a separate SDK-specific integration decision: verify installed SDK capabilities and this Accounts-v2/session configuration before using it. Do not state that Connect has no mobile SDK. Default backend dashboard mode is `none`, so dashboard-link may400; an `express` mode account can have hosted dashboard access. Treat the returned safe error as guidance to the supported management route.

Instant withdrawal: disable during request; allow integer pence>=40 and <=current instantAvailablePence, with nonnull instantDestination. Empty body means all currently instant-available, which may change between UI rendering and request. Display returned payout method/status/arrivalDate, then refresh balance. Provider payout idempotency is backend-owned. A zero/insufficient balance or unsupported bank is a 400 business condition. Do not claim exact bank-arrival minutes from old source comments; show provider date/status.

### Completed-booking tips

Endpoints:

- POST `/payments/booking-tips/checkout`, school only, body `{"bookingId":"11111111-1111-4111-8111-111111111111","amountPence":1000}`, success201.
- POST `/payments/booking-tips/:tipId/sync`, same owning school, body `{"sessionId":"cs_test_example"}`, success200.
- POST `/payments/booking-tips/:tipId/refund`, admin only, same optional refund body as invoices, success200.

Checkout response:

```json
{"tipId":"22222222-2222-4222-8222-222222222222","sessionId":"cs_test_example","url":"https://checkout.stripe.com/example","tipAmountPence":1000,"feeAmountPence":0,"totalAmountPence":1000}
```

For a new tip, feeAmountPence is 0 and the school total equals the teacher tip. A reservation created before the fee change can retain a historic nonzero fee; the backend deliberately charges stored reserved amounts on resume. Show the returned amount rather than silently subtracting a historic fee. Current DTO accepts 1–100000 pence (up to £1,000). The total must also meet provider minimum 30p; a 1p tip can pass DTO and fail business validation. The web's broader amount guard is not authoritative; use backend limits. Convert pounds input to integer pence carefully before submitting.

Booking must be COMPLETED and owned by school; teacher payout must be ready. There can be one completed tip per booking. Repeated creation may resume the same open Checkout; a changed amount while checkout is open can409. Disable repeated taps and persist tipId/sessionId before browser open. Don't create another checkout solely due to a network timeout; fetch/sync the pending reference when known.

Success URL: `/bookings?tip=success&tip_id=<id>&session_id={CHECKOUT_SESSION_ID}`. Cancel: `/bookings?tip=cancelled&tip_id=<id>`. Handle only a callback matching current user/pending tip. `/sync` returns the persisted tip entity (not a fully decorated response DTO), including at least `id,status,tipAmountPence,feeAmountPence,totalAmountPence,currency,bookingId` and timestamps/provider references. Consume known fields tolerantly; never log provider references unnecessarily. PAID comes only from server; URL success alone cannot settle it.

### Provider webhooks, retries, errors, and cache invalidation

`POST /payments/webhooks/stripe` is server infrastructure, public to Stripe and authenticated using Stripe-Signature over exact raw bytes. The app must **never** call it or hold signing/Stripe secret keys. Server handles invoice paid/payment failure/action-required, tip Checkout state and Connect account capability events; GET/sync queries are the client recovery path after missed live events.

The current invoice-paid handler marks the invoice paid, then invokes a best-effort notification trigger only for the call that changed its state. A persistence failure in that notification path can leave a missing notice even when payment is paid; the hiring notification outbox does not automatically repair that payment path. Therefore payment UI must be driven by authoritative invoice reads, not receipt of a notification. The app also needs foreground refetch and pagination because sockets can disconnect during delivery. In-app notification and optional email are separate from OS push: no APNs/FCM device registration endpoint is present in this contract.

Mutation invalidation matrix:

| Mutation / event | Refetch/invalidate |
|---|---|
| Setup sync, switch, card removal | school billing + bookings + relevant invoices |
| Attendance/completion/cancellation | bookings + attendance/payroll + invoice lists + billing + notifications |
| Invoice create/payment/sync/refund/void | invoice detail/list + booking + school billing; teacher balance after settlement |
| Payout onboarding/session return | payout account + payout balance + profile completion + blocked bookings |
| Instant payout | payout balance and displayed recent payouts |
| Tip sync/refund | booking tips/booking detail + notifications; teacher balance when settled |
| INVOICE_PAID / INVOICE_PAYMENT_FAILED live notice | invoice detail/list + bookings + school billing + teacher balance as appropriate |

Common handling:401 refresh session once;403 remove unauthorized action;404 refetch/list fallback;409 reload authoritative state and explain conflict;400 show field/business message;429 honor retryAfter;502/503 show retryable service problem without resubmitting payment indefinitely. Persist requestId for diagnostics, but redact tokens, client secrets and card details. Some error codes (`INVOICE_ID_REQUIRED`, `UNITS_INVALID`, `PO_TOO_LONG`) are **frontend server-action validations**, not stable backend error codes; native validation may use equivalent local codes but must not expect them from every API error.

Minimum payment acceptance tests: cancel setup; expire setup; resume after process death; disable opt-in while an invoice is scheduled; pending Stripe settings sync; successful/declined/3DS recovery using same invoice; webhook arriving before/after UI return; no second invoice on retries; partially paid periods with remaining manual work; all absent zero payable; mixed fixed attendance; teacher not payout-ready; refund display; duplicate tips; exact fee disclosure; GMT/BST and month-end boundaries. Use Stripe test mode and verify backend persisted status, not merely frontend success banners.

<a id="realtime-flows"></a>

## Messaging, attachments, live events, and notifications

### Conversation REST API

All paths below use backend `/api`. `INSTITUTION` is school, `INSTRUCTOR` is teacher. Participants are authorized on each request. Read-only admin inspection exists but normal mobile accounts must not impersonate admins.

| Method/path | Body/query | Roles / success |
|---|---|---|
| POST `/conversations` | `{applicationId}` **alone**, or `{instructorId,jobId?}` | School,200 Conversation |
| GET `/conversations` | page>=1,limit 1–100,defaults 1/20 | Teacher/school,200 conversation page |
| GET `/conversations/unread-count` | None | Teacher/school,200 `{total}` |
| POST `/conversations/socket-ticket` | None | Teacher/school,200 `{ticket,expiresInSeconds:60}` |
| GET `/conversations/application/:applicationId` | None | Participant/admin,200 existing Conversation; never creates one |
| GET `/conversations/booking/:bookingId` | UUIDv4 | Participant/admin,200 Conversation |
| GET `/conversations/:id` | None | Participant/admin,200 Conversation |
| GET `/conversations/:id/threads` | topic GENERAL/JOBS(default JOBS),before UUID?,limit 1–100(default 20) | Participant,200 `{conversations,total,hasMore,nextCursor}` |
| GET `/conversations/:id/messages` | before message UUID?,limit 1–100(default 30) | Participant/admin,200 `{messages,hasMore}` |
| POST `/conversations/:id/messages` | `{body?,attachmentIds?}` | Participant writable thread,201 Message |
| POST `/conversations/:id/read` | None | Participant/admin,200 `{readAt}` (admin can return null) |
| POST `/conversations/:id/attachments` | `{fileName,contentType,sizeBytes}` | Writable participant,201 AttachmentUpload |
| GET `/conversations/:id/attachments/:attachmentId/download-url` | None | Authorized reader,200 `{url,expiresAt}` |
| GET `/conversations/job/:jobId` | Page query | Admin only,200 `{job,conversations,pagination}` |

School starts a general thread using **instructor profile ID**, not login user ID. Optional job must belong to that school. Teacher “Message school” on an application uses application-context GET; don't call school-only POST. If no conversation exists, GET returns404 explaining that the school can start it. An admin-posted job has no school participant and returns 409 directing the user to support. Returned conversation ID may be canonical after old-thread consolidation: store the response ID, not just requested alias. Rejected application conversations are read-only. Disable compose/file/typing when `readOnly:true` and respect 403 even if stale UI allows editing.

```ts
type ConversationParty = {
  id:string|null; userId:string; name:string; imageUrl:string|null; role:'teacher'|'school';
};
type Conversation = {
  id:string;applicationId:string|null;
  booking:null|{id:string;status:string;applicationId:string};
  applicationStatus:string|null;readOnly:boolean;
  job:null|{id:string;title:string;hours:number|null;days:number|null};
  me:'instructor'|'poster'|null;counterpart:ConversationParty|null;
  participants:{instructor:ConversationParty;poster:ConversationParty};
  instructorLastReadAt:string|null;posterLastReadAt:string|null;
  lastMessage:null|{senderUserId:string|null;senderName:string|null;body:string;
    fromMe:boolean;hasAttachments:boolean;createdAt:string};
  unreadCount:number;counterpartLastReadAt:string|null;lastMessageAt:string|null;createdAt:string;
};
type Attachment = {id:string;fileName:string;contentType:string;sizeBytes:number};
type Message = {
  id:string;conversationId:string;senderUserId:string|null;senderName:string|null;
  senderSide:'instructor'|'poster'|null;body:string;attachments:Attachment[];createdAt:string;
};
```

Pagination differs: conversation list uses ordinary page metadata; thread choices use cursor+nextCursor; message history is **oldest-first within each returned page** and `before` is the first/oldest currently loaded message ID. Prepend older pages and deduplicate by message ID. A cursor from a different conversation/pair/topic returns 400. Maintain scroll position while prepending.

Message body is trimmed, at most 2000 characters. Up to5 unique attachment UUIDs. At least body or a file is required by service logic (an empty DTO is 400). Submit via REST; there is no socket `send-message` endpoint. Keep optimistic text separately until REST response returns an authoritative ID, then deduplicate the matching socket event. No client mutation/idempotency key is accepted for message sends: after a timeout, reconcile recent history and let user retry deliberately rather than automatically duplicating text.

### Message file upload sequence

1. Pick permitted file and read real size/MIME. Accepted: PDF, DOC, DOCX, JPEG, PNG, text/plain. Not WebP for this endpoint. Max 10*1024*1024 bytes, min 1; filename trimmed nonempty max 200.
2. POST metadata to this conversation's `/attachments`.
3. Response:

```json
{
  "attachment":{"id":"33333333-3333-4333-8333-333333333333","fileName":"lesson-plan.pdf","contentType":"application/pdf","sizeBytes":52000},
  "upload":{"url":"https://example-s3-signed-url.invalid/placeholder","expiresAt":"2026-11-23T10:10:00.000Z","requiredHeaders":{"Content-Type":"application/pdf","If-None-Match":"*"}}
}
```

4. PUT the **raw file bytes** to upload.url using every required header exactly. Do not wrap bytes in JSON/base64/multipart unless a different endpoint explicitly says so. Do not attach backend Authorization to an S3/provider URL. Choose an RN file transport that preserves supplied size and content type rather than rewriting images silently.
5. After upload succeeds, send message with attachmentIds. Backend HEAD-checks ownership, conversation, metadata, byte size and whether already sent. Upload completion must precede message send.
6. Failed/type-mismatched upload should reselect/create a new attachment; one already sent/removed returns 409. Unsent uploads expire/are cleaned after 24h. Do not invent DELETE attachment endpoint.
7. Download by requesting a fresh signed URL from backend; don't persist expired URLs in message history. Other users cannot see an unsent upload. Preserve original filename on save/share and show unavailable/retry for expired links.

### Socket.IO mobile connection

Backend namespace is `/conversations`; engine HTTP path is `/api/socket.io`. Use `socket.io-client`, not a raw WebSocket, and use the backend origin without duplicating `/api` in the namespace URL.

```ts
import {io} from 'socket.io-client';

function connectRealtime(backendOrigin: string, accessToken: string) {
  return io(`${backendOrigin}/conversations`, {
    path: '/api/socket.io',
    auth: {token: accessToken},
    transports: ['websocket'],
    autoConnect: false,
  });
}
```

Native clients can use `auth.token` with their normal access token. Web uses a single-use ticket because its backend token is in NextAuth's server session. Both are supported. A ticket has a 60-second handshake lifetime and cannot be reused after disconnect. Access-token sockets are disconnected when token expires; receiving `auth:expired` must trigger the shared single-flight auth refresh and a new socket connection. Set `socket.auth={token:newAccessToken}` before reconnecting. Logout disconnects and removes handlers. Use one connection per signed-in app, not per screen; maximum 10 sockets per user. Browser-origin allowlisting does not require a fake Origin from native apps.

Server→client events are raw event payloads, **not HTTP success envelopes**:

| Event | Payload | Client action |
|---|---|---|
| `ready` | `{userId}` | Refetch unread counts and active thread history to recover downtime |
| `message` | `{conversationId,message:Message}` | Deduplicate by ID, update messages/inbox, refresh counts |
| `read` | `{conversationId,side:'instructor'|'poster',readAt}` | Update counterpart read marker |
| `typing` | `{conversationId,side,typing:boolean}` | Ephemeral indicator; clear on timeout/blur/disconnect |
| `notification` | `{notification:Notification,unreadCount}` | Upsert notice, update badge, invalidate affected feature caches |
| `notification:count` | `{unreadCount}` | Replace badge count |
| `auth:expired` | `{code}` | Refresh/reconnect or clear session |

Client→server events:

```ts
type SocketAck = {ok:true} | {ok:false; error:string; status:number};
socket.emit('typing', {conversationId, typing:true}, (ack: SocketAck) => {
  // ack: {ok:true} OR {ok:false,error:string,status:number}
});
socket.emit('read', {conversationId}, (ack: SocketAck) => { /* same acknowledgement shape */ });
```

Typing/read are throttled about once per second server-side; use conservative client debouncing. Emit stopped typing on send/blur, and mark read only when the user actually views the thread. REST `/read` is a fallback. App background OS suspension means no guarantee of immediate socket events; foreground refresh is mandatory. Socket errors have `error.data.code`: `AUTH_TOKEN_MISSING`, `ACCESS_TOKEN_EXPIRED`, `INVALID_ACCESS_TOKEN`, `TICKET_ALREADY_USED`, `ROLE_NOT_ALLOWED`, `ORIGIN_NOT_ALLOWED`, `NAMESPACE_UNKNOWN`, `TOO_MANY_CONNECTIONS`. Don't endless-reconnect authorization/role errors; don't refresh an access token for a mere transient transport outage.

Server fan-out and used socket-ticket tracking are in-process in this checkout. Multi-instance deployments need shared pub/sub/adapter and ticket storage for consistent cross-instance events. The app should tolerate missed/reordered/duplicate live delivery and recover via REST; don't claim OS background push support from Socket.IO alone.

### Notifications and preferences

| Method/path | Body/query | Success |
|---|---|---|
| GET `/notifications` | page default 1,limit default 20 max 100,optional unread=true/false | 200 `{notifications,pagination,unreadCount}` |
| GET `/notifications/unread-count` | None | 200 `{total}` |
| POST `/notifications/:id/read` | None | 200 Notification |
| POST `/notifications/read-all` | None | 200 `{updated:number}` |
| GET `/notifications/preferences` | None | 200 Preferences |
| PATCH `/notifications/preferences` | Any subset of 3 booleans | 200 Preferences |

```ts
type Notification = {
  id:string;type:string;title:string;body:string;link:string|null;
  data:Record<string,unknown>;readAt:string|null;createdAt:string;
};
type NotificationPreferences = {
  emailJobMatches:boolean;emailMessages:boolean;emailUpdates:boolean;
};
```

Defaults are all true. These switches govern **email categories**, not notification existence and not APNs/FCM permissions. Notification types in current Prisma enum: `JOB_INVITATION`, `JOB_INVITATION_STATUS`, `JOB_MATCH`, `APPLICATION_RECEIVED`, `APPLICATION_STATUS`, `BOOKING_CONFIRMED`, `BOOKING_CANCELLED`, `BOOKING_COMPLETED`, `ATTENDANCE_CONFIRMATION`, `INVOICE_PAID`, `INVOICE_PAYMENT_FAILED`, `PROFILE_STATUS`, `REVIEW_RECEIVED`, `IDENTITY_VERIFICATION`. Treat unknown future types as generic notifications, not parse failures.

Example:

```json
{
  "id":"44444444-4444-4444-8444-444444444444",
  "type":"INVOICE_PAID",
  "title":"Payment received",
  "body":"Your booking payment has been collected.",
  "link":"/bookings?bookingId=11111111-1111-4111-8111-111111111111",
  "data":{"bookingId":"11111111-1111-4111-8111-111111111111"},
  "readAt":null,
  "createdAt":"2026-11-23T10:00:00.000Z"
}
```

Titles/bodies and `data` keys vary by trigger; don't require the illustrative string or assume every INVOICE_PAID has exactly this shape. Map trusted known `link` pathname/query to native routes (job-detail/jobId, applications/applicationId/jobId, bookings/bookingId/attendanceDate, invitations/invitationId, billing/invoice reference, settings/profile). Validate IDs and fall back to Notifications when a target no longer exists or the role lacks access. Never blindly evaluate/open arbitrary notification link text as an external URL. Mark read via API, update the returned notification, and refresh `/notifications/unread-count` (or apply the `notification:count` socket event); `read-all` returns `{updated}`, not the unread count. REST list on foreground recovers notices delivered while disconnected.

No device push-token registration, notification-permission storage, FCM/APNs send endpoint, or native badge service is supplied here. Adding true background OS push is an explicit backend/mobile feature; in-app socket + email parity is what this source implements.


<a id="implementation-plan"></a>

## Native external flows and implementation plan

### Hosted pages, deep links and app resume

The current backend creates hosted Stripe and provider URLs with backend-configured return pages. Returning to a page, receiving a deep link, or closing a browser is a **signal to query status**, not payment or verification proof.

The reference native app already defines `PAYMENT_APP_SCHEME='supplyed'`, an expected HTTPS `/mobile/payments/return` path, strict accepted query fields, and per-user pending payment records. These native expectations do not prove the website or backend serves that bridge. The website checkout being reviewed has no `/mobile/payments/return` page. Until an HTTPS bridge and associated app/universal links are actually implemented/deployed, recovery through app foreground + persisted reference + authenticated status read is the supported integration path. A web Auth.js cookie session is separate from native bearer auth; opening the website in a system browser does not sign the native user into the website.

For every external flow:

1. Call the feature's authenticated create/start endpoint exactly once after explicit user action.
2. Validate the returned provider URL and keep only necessary reference IDs and expiry, scoped to the initiating account. Do not store access tokens in URLs or logs.
3. Persist the pending reference **before** opening the provider; guard against double taps with a per-resource lock.
4. Open the returned hosted URL through the existing `Linking`/external-browser integration. Use provider-native UI only where the backend response and installed SDK genuinely support that flow.
5. Handle both cold-start links and warm app URL events; also reconcile on foreground when no deep link arrives.
6. Verify current account/session generation still matches, then call the flow's sync/status API. Render server PAID/READY/verified result; otherwise remain pending, allow resume, or display the returned failure.
7. Refresh affected billing/booking/notification/completion data. Remove the pending record only when a terminal authoritative outcome is known; an interrupted browser is not a reason to create another charge.

React Native exposes both `Linking.getInitialURL()` for cold starts and `Linking.addEventListener('url', ...)` for an already-running app; handle both and remove the subscription on cleanup. [React Native Linking documentation](https://reactnative.dev/docs/linking)

Example lifecycle wiring (use the existing flow coordinator instead of creating another listener/reconciler alongside it):

```tsx
import { useEffect } from 'react';
import { AppState, Linking } from 'react-native';

export function useExternalReturnSignals(
  onRecognizedUrl: (url: string) => Promise<void>,
  reconcileCurrentAccountFlows: () => Promise<void>,
  onRecoveryError: (error: unknown) => void,
) {
  useEffect(() => {
    let active = true;
    const handle = (url: string | null) => {
      if (url && active) void onRecognizedUrl(url).catch(onRecoveryError);
    };
    void Linking.getInitialURL().then(handle).catch(onRecoveryError);
    const links = Linking.addEventListener('url', ({ url }) => handle(url));
    const lifecycle = AppState.addEventListener('change', state => {
      if (state === 'active') {
        void reconcileCurrentAccountFlows().catch(onRecoveryError);
      }
    });
    return () => { active = false; links.remove(); lifecycle.remove(); };
  }, [onRecognizedUrl, reconcileCurrentAccountFlows, onRecoveryError]);
}
```

The callbacks must validate exact allowed host/path/query keys, reject unexpected identifiers and query duplicates, enforce account ownership, and be stable (`useCallback`). They must not interpret `result=success` as proof. iOS associated domains and Android intent/app-link declarations are separate native/deployment setup; JS parsing alone does not register a link. Stripe's native component APIs are separate from web DOM components; consult the installed SDK types before choosing an adapter. [Stripe React Native source](https://github.com/stripe/stripe-react-native), [Stripe native Payment Element](https://docs.stripe.com/payments/mobile/embedded).

### Uploads and images

Use endpoint-specific upload contracts described above, rather than one global assumed presign shape. User profile images, compliance documents, public certificates, degree consent and message attachments have different creation/completion steps and MIME/size limits.

General sequence: pick native file -> validate allowed type/size -> request signed upload from backend -> read/copy the native file URI as needed -> PUT/POST exact bytes and returned headers to returned storage URL -> confirm/submit reference through backend where required -> refetch metadata. Never call completion after failed storage upload. Never attach the app Authorization bearer to a signed S3/provider URL. Re-request expired URLs rather than retaining them indefinitely.

Android content URIs and iOS temporary picker files are not necessarily ordinary `file://` paths readable by every fetch implementation. Reuse the app's document-picker/file utilities and test on device. Match declared Content-Type and size to actual bytes. Preserve returned conditional headers such as `If-None-Match` when supplied. Keep original document metadata until the new upload succeeds; account changes abort the association.

Profile images can be direct URLs or backend-origin storage paths. Do not resolve a backend-relative path against the website origin accidentally. Public certificate URLs must follow endpoint access policy, and sensitive identity/compliance documents must never be republished as achievements.

### First implementation pass: foundation and capability verification

1. Select the intended native checkout. Preserve its existing local changes and use its current package manager/lockfile.
2. Align backend generation/migrations/deployment with the reviewed commit. Inspect current Swagger after restart; do not use source-reflected documentation as a health check.
3. Configure API base and provider return web origin for one environment. Check physical-device reachability; validate that all successful writes hit the intended database.
4. Extend endpoint constants and API types from Appendices A–D. Add a single capability/version check layer if deployments differ; hide optional degree UI on disabled/unavailable capability without hiding core API failures.
5. Reuse shared error parser, Keychain session, single-flight refresh, cache invalidation and external-flow recovery. Verify the app can restore after force-close and cannot apply an old account's late response.

### Second pass: account and profile parity

Implement/register all auth response branches; verify email/phone/2FA and password reset proofs; load actual role/profile state; implement teacher and school/MAT onboarding from live catalogue/requirements; handle rejected/pending/suspended status explicitly. Implement profile fields, validation, image/document flow, completion tasks, school compliance/signatory state and teacher identity/DBS/optional degree settings. Admin test verification is a development-only admin capability, never an app bypass.

### Third pass: hiring parity

Implement both targeted and open-application posting, create-draft then publish recovery, exact date/weekday/rate/release validation, exclusions/split/overnight shifts, requirement catalogue and original terms snapshots. Build discovery, matching explanation, participant-accessible details, application proposal/history/statuses, invitation expiry/accept/decline/cancel, accepted negotiated terms and booking detail/attendance/reviews. Use backend permissions again at mutation time.

### Fourth pass: payments and live updates

Implement card consent/setup/resume, switch persistence including pending Stripe sync, manual recovery of existing invoices, period/status distinctions, payout onboarding/balances, and separate tips. Add messaging/thread scope/attachments/unread events and notification navigation/preferences. Keep payment notices separate from payment truth; query invoices even if no notification arrived.

### Fifth pass: validation before release

Run typecheck, lint and the existing app tests using the native repository scripts. Add behavior-driven tests for changed contracts and real device flows; do not rely on source tests alone. Use Stripe test mode and separate labelled QA accounts/records. The following matrix is the implementation acceptance definition, not a claim these scenarios were rerun for this document.

| Area | Required cases |
|---|---|
| Network/session | Offline launch; timeout after a write; HTML503; token expires while3 screens load; replacement refresh tokens; rejected/expired refresh; logout/login another account with old requests still pending |
| Registration | Teacher and school; duplicate email; unverified login; wrong/expired OTP; resend cooldown; maximum attempts; phone resend;2FA normal/recovery code; password-reset wrong purpose token |
| Profile | No profile404 vs outage; required documents; resubmission after rejection; pending approval; suspended user; optional submitted document awaiting review; catalogue options changed by admin |
| Upload | PDF/image accepted; unsupported type/oversize rejected; expired signed URL; partial upload; background interruption; account switch before complete; private/public document distinction |
| Degree | Disabled provider; institution list; consent upload; HEDD_REJECTED field/message; accepted WAITING; uncertain timeout; later provider result; final verified badge; admin decisions and dev test action excluded from normal app |
| Job dates | Single day; Tue/Wed only; multiweek weekdays; optional weekends; excluded first days; overnight; overlap; non-whole-hour invalid; start after listing expiry; local timezone different from UK |
| Date boundaries | BST start/end, UK midnight represented prior UTC date, January31→February, leap day, weekly calendar Monday vs assignment anchor, monthly anniversary clamp |
| Posting | Blank required fields; draft then publish; failure between steps; resume same saved ID; targeted vs open; editable unused draft vs locked existing applications; closed/public/participant detail |
| Applications/invites | Wrong role; duplicate apply; double-tap invite; retry same request ID; expired invite; accept twice; reject/decline/cancel; conflicting teacher calendar; last worker slot already filled |
| Bookings | Accepted immutable schedule; paid shift lock; teacher read-only attendance; future shifts disabled; mixed/pending attendance; completion/no-show/cancel guards; review once and eligible date/status |
| Money | £18 per new invoice, not per booking; no fee on new tip; old stored fees unchanged; daily/weekly/monthly/completion; pending/review held; automatic off/on; consent after old period; existing manual invoice preserved |
| External payment | Browser cancelled; app killed; return to wrong account; malformed deep link; status still pending; card decline; authentication required; recovered existing invoice; duplicate webhook; partial/full refund; notification failure while payment succeeds |
| Payouts | Not onboarded; details submitted but payouts disabled; pending vs available balance; insufficient instant balance; provider pending/paid/failed; external return without a native link |
| Messaging | Correct thread scope; live incoming/read events; reconnect and REST catch-up; pagination; duplicate event; blocked/unauthorized conversation; pending attachment; unread badge consistency |
| Notifications | School vs teacher amount wording; paid vs payment failed; mark one/all read; preferences persisted; valid destination; stale/deleted target; missing notice does not hide a paid invoice |
| UI/device | Keyboard/form scroll; accessibility labels/font scaling; small screen dropdowns; loading/empty/error; Android and iOS foreground/background; screen-reader clock silence; safe rich text |

### Known boundaries that the implementation must not conceal

- The new source was not fully running when reviewed: generated Prisma client/runtime Swagger lagged. Resolve environment mismatch before claiming new endpoints are available.
- Paid-attendance lock/period flags in this workspace are local patches. If the deployed backend lacks them, native UI cannot guarantee server-side immutability. Deploy the matching backend change or treat missing fields as unknown; never label every old period paid using only the most recent invoice.
- Current schedule helpers still have UTC-date slicing/weekly-anchor issues described in the hiring chapter. Correct client display using explicit timezone conversion, but backend collection eligibility must be corrected/verified separately; do not silently replicate a known incorrect financial schedule for visual parity.
- Invoice-paid notification persistence can fail after PAID is recorded; payment state remains authoritative. The hiring notification outbox is not a guarantee of payment-notice delivery.
- The backend still accepts legacy release modes the new web form hides. New native creation should send explicit supported web choices; retain read-only display/recovery for legacy data.
- Existing website tip wording now matches the latest no-fee tip backend. Before the backend update it did not; historical invoice/tip amounts remain as stored and must not be repriced in the app.
- A5-minute eligibility worker is not an exact-time transfer or guaranteed bank payout. Missing consent/card/payout setup/attendance can prevent collection even on a forecast date.
- App deep-link parsers do not create server return routes, register OS associations or transfer web cookies. Implement the actual bridge if desired; otherwise rely on app resume plus authenticated reconciliation.

### Implementation handoff instruction

Use this document as the specification for an implementation agent working in the chosen React Native repository:

> Inspect the existing native app first. Extend its current API/session/navigation/payment-flow utilities rather than replacing them. Implement teacher and school feature parity against the documented backend commit, using the endpoint/DTO reference and business flows in this file. Preserve existing uncommitted work. Keep secrets server-side, use backend-authoritative statuses/amounts/permissions, and distinguish web-only adapters from REST APIs. Implement recovery for interrupted network/provider flows and account changes. Do not invent missing return bridges or native provider endpoints; report prerequisites explicitly. Validate the acceptance matrix and provide a changed-files/test-results report. Do not use admin test-verification endpoints as a production shortcut.

This handoff does not mean all implementation/configuration can be automatic: app signing, associated domain ownership, production credentials and provider activation must already be configured by their owners. The guide supplies the code-facing contract and identifies those dependencies instead of embedding credentials or pretending they are complete.



<a id="route-inventory"></a>

# Appendix A — Complete backend route inventory

Generated from the checked-out Nest controllers, including administration and provider callbacks for completeness. All paths include `/api`. `Public` means no access JWT; OTP proofs, callback credentials or other service checks can still apply. A bearer route without `@Roles` is **not** automatically available to every user: service ownership/state checks still apply. Admin and provider routes are not school/teacher mobile features. Global success/error envelopes described earlier wrap JSON except explicit response streams.

| Method | Path | Access | Handler/source |
|---|---|---|---|
| GET | `/api` | Bearer; see service access rules | `AppController.getHello` — `src/app.controller.ts:8` |
| POST | `/api/applications` | Bearer: INSTRUCTOR | `ApplicationsController.create` — `src/modules/applications/applications.controller.ts:25` |
| GET | `/api/applications/:id` | Bearer; see service access rules | `ApplicationsController.getById` — `src/modules/applications/applications.controller.ts:73` |
| POST | `/api/applications/:id/hire` | Bearer: INSTITUTION | `ApplicationsController.hire` — `src/modules/applications/applications.controller.ts:107` |
| GET | `/api/applications/:id/history` | Bearer; see service access rules | `ApplicationsController.getHistory` — `src/modules/applications/applications.controller.ts:82` |
| PATCH | `/api/applications/:id/status` | Bearer: INSTITUTION, ADMIN | `ApplicationsController.updateStatus` — `src/modules/applications/applications.controller.ts:93` |
| GET | `/api/applications/instructor/:instructorId` | Bearer; see service access rules | `ApplicationsController.findByInstructor` — `src/modules/applications/applications.controller.ts:60` |
| GET | `/api/applications/job/:jobId` | Bearer: INSTITUTION, ADMIN | `ApplicationsController.findByJob` — `src/modules/applications/applications.controller.ts:46` |
| GET | `/api/applications/me` | Bearer: INSTRUCTOR | `ApplicationsController.findMine` — `src/modules/applications/applications.controller.ts:36` |
| POST | `/api/auth/2fa/admin/:userId/disable` | Bearer: ADMIN | `TwoFactorController.disableByAdmin` — `src/modules/two-factor/two-factor.controller.ts:47` |
| POST | `/api/auth/2fa/disable` | Bearer; see service access rules | `TwoFactorController.disable` — `src/modules/two-factor/two-factor.controller.ts:39` |
| POST | `/api/auth/2fa/enable` | Bearer; see service access rules | `TwoFactorController.enable` — `src/modules/two-factor/two-factor.controller.ts:24` |
| POST | `/api/auth/2fa/recovery-codes` | Bearer; see service access rules | `TwoFactorController.regenerateRecoveryCodes` — `src/modules/two-factor/two-factor.controller.ts:56` |
| POST | `/api/auth/2fa/setup` | Bearer; see service access rules | `TwoFactorController.setup` — `src/modules/two-factor/two-factor.controller.ts:17` |
| GET | `/api/auth/2fa/status` | Bearer; see service access rules | `TwoFactorController.status` — `src/modules/two-factor/two-factor.controller.ts:32` |
| POST | `/api/auth/2fa/verify` | Bearer OTP challenge: OTP_TOKEN_PURPOSE.TWO_FACTOR_LOGIN | `AuthController.verifyTwoFactor` — `src/modules/auth/auth.controller.ts:98` |
| POST | `/api/auth/email/otp/resend` | Public | `AuthController.resendEmailOtp` — `src/modules/auth/auth.controller.ts:60` |
| POST | `/api/auth/email/otp/verify` | Bearer OTP challenge: OTP_TOKEN_PURPOSE.EMAIL_VERIFICATION | `AuthController.verifyEmailOtp` — `src/modules/auth/auth.controller.ts:69` |
| POST | `/api/auth/login` | Public | `AuthController.login` — `src/modules/auth/auth.controller.ts:25` |
| GET | `/api/auth/me` | Bearer; see service access rules | `AuthController.me` — `src/modules/auth/auth.controller.ts:112` |
| POST | `/api/auth/oauth/google` | Public | `AuthController.googleLogin` — `src/modules/auth/auth.controller.ts:34` |
| POST | `/api/auth/password/forgot` | Public | `AuthController.forgotPassword` — `src/modules/auth/auth.controller.ts:79` |
| POST | `/api/auth/password/reset` | Bearer OTP challenge: OTP_TOKEN_PURPOSE.PASSWORD_RESET | `AuthController.resetPassword` — `src/modules/auth/auth.controller.ts:88` |
| POST | `/api/auth/phone/otp/send` | Bearer; see service access rules | `PhoneVerificationController.sendOtp` — `src/modules/phone-verification/phone-verification.controller.ts:15` |
| POST | `/api/auth/phone/otp/verify` | Bearer; see service access rules | `PhoneVerificationController.verifyOtp` — `src/modules/phone-verification/phone-verification.controller.ts:23` |
| POST | `/api/auth/refresh` | Public | `AuthController.refresh` — `src/modules/auth/auth.controller.ts:51` |
| POST | `/api/auth/register` | Public | `AuthController.register` — `src/modules/auth/auth.controller.ts:43` |
| GET | `/api/availability/jobs/:jobId/check` | Bearer: INSTRUCTOR | `AvailabilityController.checkJob` — `src/modules/availability/availability.controller.ts:29` |
| GET | `/api/availability/me` | Bearer: INSTRUCTOR | `AvailabilityController.getMine` — `src/modules/availability/availability.controller.ts:17` |
| PUT | `/api/availability/me` | Bearer: INSTRUCTOR | `AvailabilityController.updateMine` — `src/modules/availability/availability.controller.ts:23` |
| GET | `/api/bookings` | Bearer: ADMIN | `BookingsController.findAll` — `src/modules/bookings/bookings.controller.ts:40` |
| GET | `/api/bookings/:id` | Bearer; see service access rules | `BookingsController.getById` — `src/modules/bookings/bookings.controller.ts:48` |
| PATCH | `/api/bookings/:id/attendance/:shiftId` | Bearer: INSTITUTION, ADMIN | `BookingsController.respondAttendance` — `src/modules/bookings/bookings.controller.ts:79` |
| PATCH | `/api/bookings/:id/attendance/:shiftId/correct` | Bearer: INSTITUTION, ADMIN | `BookingsController.correctAttendance` — `src/modules/bookings/bookings.controller.ts:98` |
| POST | `/api/bookings/:id/attendance/activate` | Bearer: INSTITUTION, ADMIN | `BookingsController.activateAttendance` — `src/modules/bookings/bookings.controller.ts:91` |
| PATCH | `/api/bookings/:id/attendance/correction-requests/:requestId` | Bearer: INSTITUTION, ADMIN | `BookingsController.reviewAttendanceCorrection` — `src/modules/bookings/bookings.controller.ts:110` |
| PATCH | `/api/bookings/:id/cancel` | Bearer: INSTRUCTOR, INSTITUTION, ADMIN | `BookingsController.cancel` — `src/modules/bookings/bookings.controller.ts:71` |
| PATCH | `/api/bookings/:id/complete` | Bearer: INSTITUTION, ADMIN | `BookingsController.complete` — `src/modules/bookings/bookings.controller.ts:55` |
| PATCH | `/api/bookings/:id/no-show` | Bearer: INSTITUTION, ADMIN | `BookingsController.markNoShow` — `src/modules/bookings/bookings.controller.ts:63` |
| POST | `/api/bookings/:id/payment-sync` | Bearer; see service access rules | `BookingPaymentController.sync` — `src/modules/payments/booking-payment.controller.ts:31` |
| POST | `/api/bookings/direct-hire` | Bearer: INSTITUTION | `DirectHireController.hire` — `src/modules/bookings/direct-hire.controller.ts:20` |
| GET | `/api/bookings/me` | Bearer: INSTRUCTOR, INSTITUTION | `BookingsController.findMine` — `src/modules/bookings/bookings.controller.ts:32` |
| GET | `/api/compliance-approvals/token/:token` | Public | `ComplianceApprovalsController.review` — `src/modules/compliance-approvals/compliance-approvals.controller.ts:48` |
| POST | `/api/compliance-approvals/token/:token/approve` | Public | `ComplianceApprovalsController.approve` — `src/modules/compliance-approvals/compliance-approvals.controller.ts:53` |
| POST | `/api/compliance-approvals/token/:token/decline` | Public | `ComplianceApprovalsController.decline` — `src/modules/compliance-approvals/compliance-approvals.controller.ts:64` |
| GET | `/api/contact/founding-interest` | Bearer: ADMIN | `ContactController.listFoundingInterest` — `src/modules/contact/contact.controller.ts:51` |
| POST | `/api/contact/founding-interest` | Public | `ContactController.createFoundingInterest` — `src/modules/contact/contact.controller.ts:29` |
| DELETE | `/api/contact/founding-interest/:id` | Bearer: ADMIN | `ContactController.deleteFoundingInterest` — `src/modules/contact/contact.controller.ts:65` |
| PATCH | `/api/contact/founding-interest/:id/details` | Public | `ContactController.updateWaitlistDetails` — `src/modules/contact/contact.controller.ts:37` |
| PATCH | `/api/contact/founding-interest/:id/status` | Bearer: ADMIN | `ContactController.updateFoundingInterestStatus` — `src/modules/contact/contact.controller.ts:58` |
| GET | `/api/contact/founding-interest/all` | Bearer: ADMIN | `ContactController.listAllFoundingInterest` — `src/modules/contact/contact.controller.ts:44` |
| POST | `/api/contact/register-interest` | Public | `ContactController.registerInterest` — `src/modules/contact/contact.controller.ts:21` |
| GET | `/api/conversations` | Bearer: INSTRUCTOR, INSTITUTION | `ConversationsController.listMine` — `src/modules/conversations/conversations.controller.ts:31` |
| POST | `/api/conversations` | Bearer: INSTITUTION | `ConversationsController.start` — `src/modules/conversations/conversations.controller.ts:22` |
| GET | `/api/conversations/:id` | Bearer; see service access rules | `ConversationsController.getOne` — `src/modules/conversations/conversations.controller.ts:86` |
| POST | `/api/conversations/:id/attachments` | Bearer: INSTRUCTOR, INSTITUTION | `ConversationsController.createAttachment` — `src/modules/conversations/conversations.controller.ts:133` |
| GET | `/api/conversations/:id/attachments/:attachmentId/download-url` | Bearer; see service access rules | `ConversationsController.downloadUrl` — `src/modules/conversations/conversations.controller.ts:141` |
| GET | `/api/conversations/:id/messages` | Bearer; see service access rules | `ConversationsController.listMessages` — `src/modules/conversations/conversations.controller.ts:110` |
| POST | `/api/conversations/:id/messages` | Bearer: INSTRUCTOR, INSTITUTION | `ConversationsController.send` — `src/modules/conversations/conversations.controller.ts:117` |
| POST | `/api/conversations/:id/read` | Bearer; see service access rules | `ConversationsController.markRead` — `src/modules/conversations/conversations.controller.ts:125` |
| GET | `/api/conversations/:id/threads` | Bearer: INSTRUCTOR, INSTITUTION | `ConversationsController.listThreads` — `src/modules/conversations/conversations.controller.ts:93` |
| GET | `/api/conversations/application/:applicationId` | Bearer; see service access rules | `ConversationsController.openForApplication` — `src/modules/conversations/conversations.controller.ts:57` |
| GET | `/api/conversations/booking/:bookingId` | Bearer; see service access rules | `ConversationsController.openForBooking` — `src/modules/conversations/conversations.controller.ts:64` |
| GET | `/api/conversations/job/:jobId` | Bearer: ADMIN | `ConversationsController.listForJob` — `src/modules/conversations/conversations.controller.ts:74` |
| POST | `/api/conversations/socket-ticket` | Bearer: INSTRUCTOR, INSTITUTION | `ConversationsController.socketTicket` — `src/modules/conversations/conversations.controller.ts:48` |
| GET | `/api/conversations/unread-count` | Bearer: INSTRUCTOR, INSTITUTION | `ConversationsController.unreadCount` — `src/modules/conversations/conversations.controller.ts:39` |
| GET | `/api/dbs-checks/admin` | Bearer: ADMIN | `DbsChecksController.findAll` — `src/modules/dbs-checks/dbs-checks.controller.ts:57` |
| POST | `/api/dbs-checks/admin` | Bearer: ADMIN | `DbsChecksController.submit` — `src/modules/dbs-checks/dbs-checks.controller.ts:49` |
| GET | `/api/dbs-checks/admin/:id` | Bearer: ADMIN | `DbsChecksController.findOne` — `src/modules/dbs-checks/dbs-checks.controller.ts:67` |
| POST | `/api/dbs-checks/admin/:id/decision` | Bearer: ADMIN | `DbsChecksController.decide` — `src/modules/dbs-checks/dbs-checks.controller.ts:83` |
| GET | `/api/dbs-checks/admin/:id/report-url` | Bearer: ADMIN | `DbsChecksController.createReportUrl` — `src/modules/dbs-checks/dbs-checks.controller.ts:75` |
| POST | `/api/dbs-checks/admin/preview` | Bearer: ADMIN | `DbsChecksController.preview` — `src/modules/dbs-checks/dbs-checks.controller.ts:38` |
| GET | `/api/dbs-checks/me` | Bearer: INSTRUCTOR | `DbsChecksController.findMine` — `src/modules/dbs-checks/dbs-checks.controller.ts:28` |
| GET | `/api/degree-checks/admin` | Bearer: ADMIN | `DegreeChecksController.findAll` — `src/modules/degree-checks/degree-checks.controller.ts:68` |
| GET | `/api/degree-checks/admin/:id` | Bearer: ADMIN | `DegreeChecksController.findOne` — `src/modules/degree-checks/degree-checks.controller.ts:78` |
| POST | `/api/degree-checks/admin/:id/cancel` | Bearer: ADMIN | `DegreeChecksController.cancel` — `src/modules/degree-checks/degree-checks.controller.ts:119` |
| GET | `/api/degree-checks/admin/:id/consent-url` | Bearer: ADMIN | `DegreeChecksController.createConsentUrl` — `src/modules/degree-checks/degree-checks.controller.ts:86` |
| POST | `/api/degree-checks/admin/:id/decision` | Bearer: ADMIN | `DegreeChecksController.decide` — `src/modules/degree-checks/degree-checks.controller.ts:94` |
| POST | `/api/degree-checks/admin/:id/test-verify` | Bearer: ADMIN | `DegreeChecksController.testVerify` — `src/modules/degree-checks/degree-checks.controller.ts:107` |
| GET | `/api/degree-checks/institutions` | Bearer: INSTRUCTOR, ADMIN | `DegreeChecksController.institutions` — `src/modules/degree-checks/degree-checks.controller.ts:31` |
| GET | `/api/degree-checks/me` | Bearer: INSTRUCTOR | `DegreeChecksController.findMine` — `src/modules/degree-checks/degree-checks.controller.ts:39` |
| POST | `/api/degree-checks/me` | Bearer: INSTRUCTOR | `DegreeChecksController.submit` — `src/modules/degree-checks/degree-checks.controller.ts:60` |
| POST | `/api/degree-checks/me/consent-upload-url` | Bearer: INSTRUCTOR | `DegreeChecksController.createConsentUploadUrl` — `src/modules/degree-checks/degree-checks.controller.ts:49` |
| GET | `/api/document-requirements` | Bearer: ADMIN | `DocumentRequirementsController.findAll` — `src/modules/document-requirements/document-requirements.controller.ts:28` |
| POST | `/api/document-requirements` | Bearer: ADMIN | `DocumentRequirementsController.create` — `src/modules/document-requirements/document-requirements.controller.ts:21` |
| DELETE | `/api/document-requirements/:id` | Bearer: ADMIN | `DocumentRequirementsController.remove` — `src/modules/document-requirements/document-requirements.controller.ts:56` |
| GET | `/api/document-requirements/:id` | Bearer: ADMIN | `DocumentRequirementsController.findOne` — `src/modules/document-requirements/document-requirements.controller.ts:42` |
| PATCH | `/api/document-requirements/:id` | Bearer: ADMIN | `DocumentRequirementsController.update` — `src/modules/document-requirements/document-requirements.controller.ts:49` |
| GET | `/api/document-requirements/profile` | Bearer: INSTRUCTOR, INSTITUTION | `DocumentRequirementsController.findAllForProfile` — `src/modules/document-requirements/document-requirements.controller.ts:35` |
| GET | `/api/document-reviews` | Bearer: ADMIN | `DocumentReviewsController.findAll` — `src/modules/document-reviews/document-reviews.controller.ts:16` |
| GET | `/api/document-reviews/:id` | Bearer: ADMIN | `DocumentReviewsController.findOne` — `src/modules/document-reviews/document-reviews.controller.ts:23` |
| GET | `/api/document-types` | Bearer: ADMIN | `DocumentTypesController.findAll` — `src/modules/document-types/document-types.controller.ts:22` |
| POST | `/api/document-types` | Bearer: ADMIN | `DocumentTypesController.create` — `src/modules/document-types/document-types.controller.ts:15` |
| DELETE | `/api/document-types/:id` | Bearer: ADMIN | `DocumentTypesController.remove` — `src/modules/document-types/document-types.controller.ts:43` |
| GET | `/api/document-types/:id` | Bearer: ADMIN | `DocumentTypesController.findOne` — `src/modules/document-types/document-types.controller.ts:29` |
| PATCH | `/api/document-types/:id` | Bearer: ADMIN | `DocumentTypesController.update` — `src/modules/document-types/document-types.controller.ts:36` |
| GET | `/api/documents` | Bearer: INSTRUCTOR, INSTITUTION | `DocumentsController.findAllByUser` — `src/modules/documents/documents.controller.ts:36` |
| POST | `/api/documents` | Bearer: INSTRUCTOR, INSTITUTION | `DocumentsController.create` — `src/modules/documents/documents.controller.ts:29` |
| PATCH | `/api/documents/:id` | Bearer: INSTRUCTOR, INSTITUTION | `DocumentsController.update` — `src/modules/documents/documents.controller.ts:114` |
| GET | `/api/documents/:id/download-url` | Bearer: INSTRUCTOR, INSTITUTION | `DocumentsController.createDownloadUrl` — `src/modules/documents/documents.controller.ts:107` |
| POST | `/api/documents/:id/upload-complete` | Bearer: INSTRUCTOR, INSTITUTION | `DocumentsController.completeUpload` — `src/modules/documents/documents.controller.ts:96` |
| POST | `/api/documents/:id/upload-url` | Bearer: INSTRUCTOR, INSTITUTION | `DocumentsController.createUploadUrl` — `src/modules/documents/documents.controller.ts:85` |
| GET | `/api/documents/admin` | Bearer: ADMIN | `DocumentsController.findAll` — `src/modules/documents/documents.controller.ts:52` |
| DELETE | `/api/documents/admin/:id` | Bearer: ADMIN | `DocumentsController.remove` — `src/modules/documents/documents.controller.ts:125` |
| GET | `/api/documents/admin/:id` | Bearer: ADMIN | `DocumentsController.findOne` — `src/modules/documents/documents.controller.ts:60` |
| GET | `/api/documents/admin/:id/download-url` | Bearer: ADMIN | `DocumentsController.createDownloadUrlAsAdmin` — `src/modules/documents/documents.controller.ts:67` |
| POST | `/api/documents/admin/:id/review` | Bearer: ADMIN | `DocumentsController.review` — `src/modules/documents/documents.controller.ts:74` |
| GET | `/api/dropdowns` | Public | `DropdownsController.list` — `src/modules/dropdowns/dropdowns.controller.ts:15` |
| DELETE | `/api/dropdowns/:name` | Bearer: ADMIN | `DropdownsController.remove` — `src/modules/dropdowns/dropdowns.controller.ts:58` |
| GET | `/api/dropdowns/:name` | Public | `DropdownsController.detail` — `src/modules/dropdowns/dropdowns.controller.ts:42` |
| PATCH | `/api/dropdowns/:name` | Bearer: ADMIN | `DropdownsController.update` — `src/modules/dropdowns/dropdowns.controller.ts:50` |
| GET | `/api/dropdowns/admin` | Bearer: ADMIN | `DropdownsController.adminList` — `src/modules/dropdowns/dropdowns.controller.ts:23` |
| GET | `/api/dropdowns/admin/:name` | Bearer: ADMIN | `DropdownsController.adminDetail` — `src/modules/dropdowns/dropdowns.controller.ts:32` |
| GET | `/api/health` | Public | `HealthController.check` — `src/modules/health/health.controller.ts:15` |
| GET | `/api/identity-verification/admin` | Bearer: ADMIN | `IdentityVerificationController.findAll` — `src/modules/identity-verification/identity-verification.controller.ts:59` |
| GET | `/api/identity-verification/admin/:id` | Bearer: ADMIN | `IdentityVerificationController.findOne` — `src/modules/identity-verification/identity-verification.controller.ts:72` |
| POST | `/api/identity-verification/admin/:id/decision` | Bearer: ADMIN | `IdentityVerificationController.decide` — `src/modules/identity-verification/identity-verification.controller.ts:101` |
| POST | `/api/identity-verification/admin/:id/reissue` | Bearer: ADMIN | `IdentityVerificationController.reissue` — `src/modules/identity-verification/identity-verification.controller.ts:88` |
| GET | `/api/identity-verification/admin/:id/report-url` | Bearer: ADMIN | `IdentityVerificationController.createReportUrl` — `src/modules/identity-verification/identity-verification.controller.ts:80` |
| POST | `/api/identity-verification/admin/:id/retry-retrieval` | Bearer: ADMIN | `IdentityVerificationController.retryRetrieval` — `src/modules/identity-verification/identity-verification.controller.ts:128` |
| POST | `/api/identity-verification/admin/users/:userId/test-verify` | Bearer: ADMIN | `IdentityVerificationController.testVerify` — `src/modules/identity-verification/identity-verification.controller.ts:114` |
| GET | `/api/identity-verification/me` | Bearer: INSTRUCTOR | `IdentityVerificationController.findMine` — `src/modules/identity-verification/identity-verification.controller.ts:40` |
| POST | `/api/identity-verification/me` | Bearer: INSTRUCTOR | `IdentityVerificationController.start` — `src/modules/identity-verification/identity-verification.controller.ts:48` |
| GET | `/api/institutions` | Bearer: ADMIN | `InstitutionsController.findAll` — `src/modules/institutions/institutions.controller.ts:33` |
| POST | `/api/institutions` | Bearer: INSTITUTION | `InstitutionsController.create` — `src/modules/institutions/institutions.controller.ts:23` |
| DELETE | `/api/institutions/:id` | Bearer: ADMIN | `InstitutionsController.remove` — `src/modules/institutions/institutions.controller.ts:108` |
| GET | `/api/institutions/:id` | Bearer: ADMIN | `InstitutionsController.getById` — `src/modules/institutions/institutions.controller.ts:84` |
| PATCH | `/api/institutions/:id` | Bearer: ADMIN, INSTITUTION | `InstitutionsController.update` — `src/modules/institutions/institutions.controller.ts:94` |
| PATCH | `/api/institutions/admin/:id/status` | Bearer: ADMIN | `InstitutionsController.adminUpdateStatus` — `src/modules/institutions/institutions.controller.ts:74` |
| GET | `/api/institutions/me` | Bearer: INSTITUTION | `InstitutionsController.getMine` — `src/modules/institutions/institutions.controller.ts:46` |
| GET | `/api/institutions/me/compliance-approval` | Bearer: INSTITUTION | `InstitutionComplianceApprovalController.findMine` — `src/modules/compliance-approvals/compliance-approvals.controller.ts:32` |
| POST | `/api/institutions/me/compliance-approval` | Bearer: INSTITUTION | `InstitutionComplianceApprovalController.request` — `src/modules/compliance-approvals/compliance-approvals.controller.ts:37` |
| GET | `/api/institutions/me/signatory-approval` | Bearer: INSTITUTION | `InstitutionSignatoryApprovalController.findMine` — `src/modules/signatory-approvals/signatory-approvals.controller.ts:37` |
| POST | `/api/institutions/me/signatory-approval` | Bearer: INSTITUTION | `InstitutionSignatoryApprovalController.request` — `src/modules/signatory-approvals/signatory-approvals.controller.ts:29` |
| PATCH | `/api/institutions/me/status` | Bearer: INSTITUTION | `InstitutionsController.updateOwnStatus` — `src/modules/institutions/institutions.controller.ts:64` |
| GET | `/api/institutions/profile/:id` | Bearer: INSTRUCTOR, INSTITUTION, ADMIN | `InstitutionsController.getProfile` — `src/modules/institutions/institutions.controller.ts:56` |
| GET | `/api/instructors` | Bearer: ADMIN | `InstructorsController.findAll` — `src/modules/instructors/instructors.controller.ts:35` |
| POST | `/api/instructors` | Bearer: INSTRUCTOR | `InstructorsController.create` — `src/modules/instructors/instructors.controller.ts:25` |
| DELETE | `/api/instructors/:id` | Bearer: ADMIN | `InstructorsController.remove` — `src/modules/instructors/instructors.controller.ts:117` |
| GET | `/api/instructors/:id` | Bearer: INSTRUCTOR, ADMIN | `InstructorsController.getById` — `src/modules/instructors/instructors.controller.ts:84` |
| PATCH | `/api/instructors/:id` | Bearer; see service access rules | `InstructorsController.update` — `src/modules/instructors/instructors.controller.ts:94` |
| PATCH | `/api/instructors/admin/:id` | Bearer: ADMIN | `InstructorsController.adminUpdate` — `src/modules/instructors/instructors.controller.ts:107` |
| GET | `/api/instructors/directory` | Bearer: INSTITUTION | `InstructorsController.findDirectory` — `src/modules/instructors/instructors.controller.ts:58` |
| GET | `/api/instructors/me` | Bearer: INSTRUCTOR | `InstructorsController.getMine` — `src/modules/instructors/instructors.controller.ts:48` |
| PATCH | `/api/instructors/me/status` | Bearer: INSTRUCTOR | `InstructorsController.updateOwnStatus` — `src/modules/instructors/instructors.controller.ts:66` |
| GET | `/api/instructors/profile/:id` | Bearer: INSTRUCTOR, INSTITUTION, ADMIN | `InstructorsController.getProfile` — `src/modules/instructors/instructors.controller.ts:76` |
| GET | `/api/invoices` | Bearer: ADMIN | `InvoicesController.findAll` — `src/modules/payments/payments.controller.ts:269` |
| POST | `/api/invoices` | Bearer: INSTITUTION, ADMIN | `InvoicesController.create` — `src/modules/payments/payments.controller.ts:253` |
| GET | `/api/invoices/:id` | Bearer; see service access rules | `InvoicesController.getById` — `src/modules/payments/payments.controller.ts:289` |
| POST | `/api/invoices/:id/payment-session` | Bearer: INSTITUTION | `InvoicesController.createPaymentSession` — `src/modules/payments/payments.controller.ts:296` |
| POST | `/api/invoices/:id/refund` | Bearer: ADMIN | `InvoicesController.refund` — `src/modules/payments/payments.controller.ts:334` |
| POST | `/api/invoices/:id/send` | Bearer: INSTITUTION, ADMIN | `InvoicesController.resend` — `src/modules/payments/payments.controller.ts:316` |
| POST | `/api/invoices/:id/sync` | Bearer; see service access rules | `InvoicesController.sync` — `src/modules/payments/payments.controller.ts:308` |
| POST | `/api/invoices/:id/void` | Bearer: ADMIN | `InvoicesController.void` — `src/modules/payments/payments.controller.ts:325` |
| GET | `/api/invoices/job/:jobId` | Bearer: ADMIN | `InvoicesController.findByJob` — `src/modules/payments/payments.controller.ts:277` |
| GET | `/api/invoices/me` | Bearer: INSTRUCTOR, INSTITUTION | `InvoicesController.findMine` — `src/modules/payments/payments.controller.ts:261` |
| POST | `/api/job-invitations` | Bearer: INSTITUTION | `JobInvitationsController.create` — `src/modules/bookings/job-invitations.controller.ts:47` |
| GET | `/api/job-invitations/:id` | Bearer: INSTITUTION, INSTRUCTOR | `JobInvitationsController.get` — `src/modules/bookings/job-invitations.controller.ts:82` |
| POST | `/api/job-invitations/:id/accept` | Bearer: INSTRUCTOR | `JobInvitationsController.accept` — `src/modules/bookings/job-invitations.controller.ts:91` |
| POST | `/api/job-invitations/:id/cancel` | Bearer: INSTITUTION | `JobInvitationsController.cancel` — `src/modules/bookings/job-invitations.controller.ts:112` |
| POST | `/api/job-invitations/:id/decline` | Bearer: INSTRUCTOR | `JobInvitationsController.decline` — `src/modules/bookings/job-invitations.controller.ts:102` |
| GET | `/api/job-invitations/me` | Bearer: INSTITUTION, INSTRUCTOR | `JobInvitationsController.list` — `src/modules/bookings/job-invitations.controller.ts:62` |
| GET | `/api/jobs` | Public | `JobsController.findAll` — `src/modules/jobs/jobs.controller.ts:35` |
| POST | `/api/jobs` | Bearer: INSTITUTION, ADMIN | `JobsController.create` — `src/modules/jobs/jobs.controller.ts:24` |
| DELETE | `/api/jobs/:id` | Bearer: INSTITUTION, ADMIN | `JobsController.remove` — `src/modules/jobs/jobs.controller.ts:115` |
| GET | `/api/jobs/:id` | Public | `JobsController.getById` — `src/modules/jobs/jobs.controller.ts:71` |
| PATCH | `/api/jobs/:id` | Bearer: INSTITUTION, ADMIN | `JobsController.update` — `src/modules/jobs/jobs.controller.ts:104` |
| GET | `/api/jobs/accessible/:id` | Bearer: INSTRUCTOR, INSTITUTION, ADMIN | `JobsController.getAccessibleById` — `src/modules/jobs/jobs.controller.ts:63` |
| GET | `/api/jobs/admin/all` | Bearer: ADMIN | `JobsController.findAllForAdmin` — `src/modules/jobs/jobs.controller.ts:82` |
| GET | `/api/jobs/institution/:institutionId` | Bearer; see service access rules | `JobsController.findByInstitution` — `src/modules/jobs/jobs.controller.ts:95` |
| GET | `/api/jobs/mine` | Bearer: INSTITUTION, ADMIN | `JobsController.findMine` — `src/modules/jobs/jobs.controller.ts:45` |
| GET | `/api/jobs/mine/:id` | Bearer: INSTITUTION, ADMIN | `JobsController.findMineById` — `src/modules/jobs/jobs.controller.ts:55` |
| GET | `/api/matching/jobs/:jobId/applications` | Bearer: INSTITUTION, ADMIN | `MatchingController.rankApplicants` — `src/modules/matching/matching.controller.ts:37` |
| GET | `/api/matching/jobs/:jobId/instructors` | Bearer: INSTITUTION, ADMIN | `MatchingController.recommendInstructors` — `src/modules/matching/matching.controller.ts:58` |
| GET | `/api/matching/jobs/:jobId/score` | Bearer: INSTRUCTOR | `MatchingController.scoreJob` — `src/modules/matching/matching.controller.ts:84` |
| GET | `/api/matching/jobs/recommended` | Bearer: INSTRUCTOR | `MatchingController.recommendJobs` — `src/modules/matching/matching.controller.ts:21` |
| GET | `/api/notifications` | Bearer; see service access rules | `NotificationsController.list` — `src/modules/notifications/notifications.controller.ts:16` |
| POST | `/api/notifications/:id/read` | Bearer; see service access rules | `NotificationsController.read` — `src/modules/notifications/notifications.controller.ts:53` |
| GET | `/api/notifications/preferences` | Bearer; see service access rules | `NotificationsController.getPreferences` — `src/modules/notifications/notifications.controller.ts:39` |
| PATCH | `/api/notifications/preferences` | Bearer; see service access rules | `NotificationsController.updatePreferences` — `src/modules/notifications/notifications.controller.ts:46` |
| POST | `/api/notifications/read-all` | Bearer; see service access rules | `NotificationsController.readAll` — `src/modules/notifications/notifications.controller.ts:31` |
| GET | `/api/notifications/unread-count` | Bearer; see service access rules | `NotificationsController.unreadCount` — `src/modules/notifications/notifications.controller.ts:24` |
| POST | `/api/payments/booking-tips/:id/refund` | Bearer: ADMIN | `BookingTipsController.refund` — `src/modules/payments/payments.controller.ts:142` |
| POST | `/api/payments/booking-tips/:id/sync` | Bearer: INSTITUTION | `BookingTipsController.sync` — `src/modules/payments/payments.controller.ts:133` |
| POST | `/api/payments/booking-tips/checkout` | Bearer: INSTITUTION | `BookingTipsController.createCheckout` — `src/modules/payments/payments.controller.ts:122` |
| GET | `/api/payments/payout-account` | Bearer: INSTRUCTOR | `PayoutAccountsController.findMine` — `src/modules/payments/payments.controller.ts:178` |
| GET | `/api/payments/payout-account/balance` | Bearer: INSTRUCTOR | `PayoutAccountsController.getBalance` — `src/modules/payments/payments.controller.ts:162` |
| POST | `/api/payments/payout-account/dashboard-link` | Bearer: INSTRUCTOR | `PayoutAccountsController.createDashboardLink` — `src/modules/payments/payments.controller.ts:204` |
| POST | `/api/payments/payout-account/instant-payout` | Bearer: INSTRUCTOR | `PayoutAccountsController.withdraw` — `src/modules/payments/payments.controller.ts:170` |
| POST | `/api/payments/payout-account/onboarding-link` | Bearer: INSTRUCTOR | `PayoutAccountsController.createOnboardingLink` — `src/modules/payments/payments.controller.ts:195` |
| POST | `/api/payments/payout-account/session` | Bearer: INSTRUCTOR | `PayoutAccountsController.createSession` — `src/modules/payments/payments.controller.ts:186` |
| GET | `/api/payments/payout-accounts/instructor/:instructorId` | Bearer: ADMIN | `PayoutAccountsController.findForInstructor` — `src/modules/payments/payments.controller.ts:213` |
| GET | `/api/payments/school-billing` | Bearer: INSTITUTION | `SchoolBillingController.getSettings` — `src/modules/payments/payments.controller.ts:64` |
| PATCH | `/api/payments/school-billing` | Bearer: INSTITUTION | `SchoolBillingController.updateSettings` — `src/modules/payments/payments.controller.ts:95` |
| DELETE | `/api/payments/school-billing/payment-method` | Bearer: INSTITUTION | `SchoolBillingController.removePaymentMethod` — `src/modules/payments/payments.controller.ts:106` |
| POST | `/api/payments/school-billing/setup-session` | Bearer: INSTITUTION | `SchoolBillingController.createSetupSession` — `src/modules/payments/payments.controller.ts:72` |
| POST | `/api/payments/school-billing/sync` | Bearer: INSTITUTION | `SchoolBillingController.syncSetup` — `src/modules/payments/payments.controller.ts:83` |
| POST | `/api/payments/webhooks/stripe` | Public | `StripeWebhooksController.handle` — `src/modules/payments/payments.controller.ts:231` |
| GET | `/api/profile-completion/me` | Bearer: INSTRUCTOR, INSTITUTION | `ProfileCompletionController.getMine` — `src/modules/profile-completion/profile-completion.controller.ts:14` |
| GET | `/api/profile-documents` | Bearer: INSTRUCTOR, INSTITUTION | `ProfileDocumentsController.findMine` — `src/modules/profile-documents/profile-documents.controller.ts:25` |
| POST | `/api/profile-documents` | Bearer: INSTRUCTOR, INSTITUTION | `ProfileDocumentsController.create` — `src/modules/profile-documents/profile-documents.controller.ts:30` |
| DELETE | `/api/profile-documents/:id` | Bearer: INSTRUCTOR, INSTITUTION | `ProfileDocumentsController.remove` — `src/modules/profile-documents/profile-documents.controller.ts:42` |
| PATCH | `/api/profile-documents/:id` | Bearer: INSTRUCTOR, INSTITUTION | `ProfileDocumentsController.update` — `src/modules/profile-documents/profile-documents.controller.ts:36` |
| POST | `/api/profile-documents/:id/upload-complete` | Bearer: INSTRUCTOR, INSTITUTION | `ProfileDocumentsController.completeUpload` — `src/modules/profile-documents/profile-documents.controller.ts:57` |
| POST | `/api/profile-documents/:id/upload-url` | Bearer: INSTRUCTOR, INSTITUTION | `ProfileDocumentsController.createUploadUrl` — `src/modules/profile-documents/profile-documents.controller.ts:48` |
| POST | `/api/reviews` | Bearer: INSTRUCTOR, INSTITUTION | `ReviewsController.create` — `src/modules/reviews/reviews.controller.ts:19` |
| DELETE | `/api/reviews/:id` | Bearer: ADMIN | `ReviewsController.remove` — `src/modules/reviews/reviews.controller.ts:47` |
| GET | `/api/reviews/institution/:institutionId` | Bearer; see service access rules | `ReviewsController.findAboutInstitution` — `src/modules/reviews/reviews.controller.ts:37` |
| GET | `/api/reviews/instructor/:instructorId` | Bearer; see service access rules | `ReviewsController.findAboutInstructor` — `src/modules/reviews/reviews.controller.ts:27` |
| GET | `/api/signatory-approvals` | Bearer: ADMIN | `SignatoryApprovalsController.findAll` — `src/modules/signatory-approvals/signatory-approvals.controller.ts:95` |
| POST | `/api/signatory-approvals/:id/override-approve` | Bearer: ADMIN | `SignatoryApprovalsController.overrideApprove` — `src/modules/signatory-approvals/signatory-approvals.controller.ts:109` |
| GET | `/api/signatory-approvals/token/:token` | Public | `SignatoryApprovalsController.review` — `src/modules/signatory-approvals/signatory-approvals.controller.ts:54` |
| POST | `/api/signatory-approvals/token/:token/approve` | Public | `SignatoryApprovalsController.approve` — `src/modules/signatory-approvals/signatory-approvals.controller.ts:62` |
| POST | `/api/signatory-approvals/token/:token/decline` | Public | `SignatoryApprovalsController.decline` — `src/modules/signatory-approvals/signatory-approvals.controller.ts:79` |
| GET | `/api/teaching-catalogue` | Public | `TeachingCatalogueController.getCatalogue` — `src/modules/teaching-catalogue/teaching-catalogue.module.ts:38` |
| GET | `/api/teaching-catalogue/school` | Bearer: INSTITUTION | `TeachingCatalogueController.getSchoolCatalogue` — `src/modules/teaching-catalogue/teaching-catalogue.module.ts:21` |
| GET | `/api/users` | Bearer: ADMIN | `UsersController.findAll` — `src/modules/users/users.controller.ts:68` |
| GET | `/api/users/:id` | Bearer: ADMIN | `UsersController.getById` — `src/modules/users/users.controller.ts:89` |
| POST | `/api/users/admin` | Bearer: ADMIN | `UsersController.adminCreate` — `src/modules/users/users.controller.ts:60` |
| DELETE | `/api/users/admin/:id` | Bearer: ADMIN | `UsersController.remove` — `src/modules/users/users.controller.ts:118` |
| PATCH | `/api/users/admin/:id` | Bearer: ADMIN | `UsersController.adminUpdate` — `src/modules/users/users.controller.ts:108` |
| GET | `/api/users/me` | Bearer; see service access rules | `UsersController.me` — `src/modules/users/users.controller.ts:81` |
| PATCH | `/api/users/me` | Bearer; see service access rules | `UsersController.update` — `src/modules/users/users.controller.ts:99` |
| GET | `/api/users/me/profile-image` | Bearer: INSTRUCTOR, INSTITUTION | `UsersController.getProfileImage` — `src/modules/users/users.controller.ts:52` |
| POST | `/api/users/me/profile-image/upload-complete` | Bearer: INSTRUCTOR, INSTITUTION | `UsersController.completeProfileImageUpload` — `src/modules/users/users.controller.ts:41` |
| POST | `/api/users/me/profile-image/upload-url` | Bearer: INSTRUCTOR, INSTITUTION | `UsersController.createProfileImageUploadUrl` — `src/modules/users/users.controller.ts:33` |
| POST | `/api/webhooks/trustid` | Public | `TrustIdWebhookController.handle` — `src/modules/identity-verification/identity-verification.controller.ts:144` |

<a id="operation-reference"></a>

# Appendix B — Operation requests and responses

Source handler signatures below preserve query/body DTO names and inline parameters. OpenAPI supplies the declared transport schemas and response codes; it is not exhaustive about service errors. Missing response schemas mean the Swagger declaration omitted them, not that the endpoint has no body. Use the domain chapters and source handler for those operations. DTO/schema definitions follow in Appendix C.

### GET /api

- Access: Bearer; see service access rules.
- Source: `src/app.controller.ts:8`.
- Controller parameters: ``.
- Return annotation: `string`.
- HTTP 200: .

### POST /api/applications

- Access: Bearer: INSTRUCTOR.
- Source: `src/modules/applications/applications.controller.ts:25`.
- Controller parameters: `@Body() createApplicationDto: CreateApplicationDto, @CurrentUser('id') userId: string`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Apply to a live job and record its immutable offered terms
- Body application/json: `CreateApplicationDto`.
- HTTP 201: Application submitted successfully — `ApiResponseDto & { data: ApplicationResponseDto }`.
- HTTP 400: The job is not accepting applications, has not gone live, or has expired.
- HTTP 403: An active instructor profile and verified documents are required; INSTRUCTOR_DOCUMENTS_NOT_VERIFIED for document failures.
- HTTP 404: Job not found.
- HTTP 409: Duplicate application, JOB_RESERVED or JOB_UNAVAILABLE.
- HTTP 422: INVALID_JOB_TERMS with fieldErrors.

### GET /api/applications/:id

- Access: Bearer; see service access rules.
- Source: `src/modules/applications/applications.controller.ts:73`.
- Controller parameters: `@Param('id') id: string, @CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Get an application by ID (applicant, job poster or admin)
- path `id` (required): `string`.
- HTTP 200: Application fetched successfully — `ApiResponseDto & { data: ApplicationResponseDto }`.
- HTTP 403: You do not have access to this application.
- HTTP 404: Application not found.

### POST /api/applications/:id/hire

- Access: Bearer: INSTITUTION.
- Source: `src/modules/applications/applications.controller.ts:107`.
- Controller parameters: `@Param('id') id: string, @Body() hireApplicationDto: HireApplicationDto, @CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Hire an applicant with optional booking-only payment terms (school only)
- path `id` (required): `string`.
- Body application/json: `HireApplicationDto`.
- HTTP 200: Applicant hired successfully — `ApiResponseDto & { data: ApplicationResponseDto }`.
- HTTP 400: Invalid negotiated payment fields or application status transition.
- HTTP 403: Only the institution that posted the job can use this endpoint.
- HTTP 404: Application not found.
- HTTP 409: Job filled/unavailable, application changed, terms changed, or teacher schedule conflict.
- HTTP 422: INVALID_JOB_TERMS with fieldErrors.

### GET /api/applications/:id/history

- Access: Bearer; see service access rules.
- Source: `src/modules/applications/applications.controller.ts:82`.
- Controller parameters: `@Param('id') id: string, @CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto`.
- Return annotation: `Promise<PaginatedApplicationHistoryResponseDto>`.
- Purpose: An application's status history, oldest first
- path `id` (required): `string`.
- query `page` (optional): `Object`.
- query `limit` (optional): `Object`.
- HTTP 200: Application history fetched successfully — `ApiResponseDto & { data: PaginatedApplicationHistoryResponseDto }`.
- HTTP 403: You do not have access to this application.
- HTTP 404: Application not found.

### PATCH /api/applications/:id/status

- Access: Bearer: INSTITUTION, ADMIN.
- Source: `src/modules/applications/applications.controller.ts:93`.
- Controller parameters: `@Param('id') id: string, @Body() updateApplicationStatusDto: UpdateApplicationStatusDto, @CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Update an application status (job poster or admin)
- path `id` (required): `string`.
- Body application/json: `UpdateApplicationStatusDto`.
- HTTP 200: Application status updated successfully — `ApiResponseDto & { data: ApplicationResponseDto }`.
- HTTP 400: Invalid status transition.
- HTTP 403: Only the job poster can update an application status.
- HTTP 404: Application not found.
- HTTP 409: Concurrent update, unavailable/reserved job, overlap, APPLICATION_TERMS_UNVERIFIED or JOB_TERMS_CHANGED.
- HTTP 422: INVALID_JOB_TERMS with fieldErrors.

### GET /api/applications/instructor/:instructorId

- Access: Bearer; see service access rules.
- Source: `src/modules/applications/applications.controller.ts:60`.
- Controller parameters: `@Param('instructorId') instructorId: string, @Query() query: ListApplicationsQueryDto, @CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: List applications by an instructor (self or admin)
- path `instructorId` (required): `string`.
- query `jobId` (optional): `string` — Only return the signed-in instructor application for this job.
- query `status` (optional): `string [APPLIED, VIEWED, SHORTLISTED, HIRED, REJECTED]` — Only return applications in this stage.
- query `page` (optional): `Object`.
- query `limit` (optional): `Object`.
- HTTP 200: Applications fetched successfully — `ApiResponseDto & { data: PaginatedApplicationsResponseDto }`.
- HTTP 403: You can only view your own applications.

### GET /api/applications/job/:jobId

- Access: Bearer: INSTITUTION, ADMIN.
- Source: `src/modules/applications/applications.controller.ts:46`.
- Controller parameters: `@Param('jobId') jobId: string, @Query() query: ListApplicationsQueryDto, @CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: List applicants for a job (job poster or admin)
- path `jobId` (required): `string`.
- query `jobId` (optional): `string` — Only return the signed-in instructor application for this job.
- query `status` (optional): `string [APPLIED, VIEWED, SHORTLISTED, HIRED, REJECTED]` — Only return applications in this stage.
- query `page` (optional): `Object`.
- query `limit` (optional): `Object`.
- HTTP 200: Applications fetched successfully — `ApiResponseDto & { data: PaginatedApplicationsResponseDto }`.
- HTTP 403: You can only review applications for your own job postings.
- HTTP 404: Job not found.

### GET /api/applications/me

- Access: Bearer: INSTRUCTOR.
- Source: `src/modules/applications/applications.controller.ts:36`.
- Controller parameters: `@Query() query: ListApplicationsQueryDto, @CurrentUser('id') userId: string`.
- Return annotation: `inferred; see controller/service`.
- Purpose: List the signed-in instructor's own applications
- query `jobId` (optional): `string` — Only return the signed-in instructor application for this job.
- query `status` (optional): `string [APPLIED, VIEWED, SHORTLISTED, HIRED, REJECTED]` — Only return applications in this stage.
- query `page` (optional): `Object`.
- query `limit` (optional): `Object`.
- HTTP 200: Applications fetched successfully — `ApiResponseDto & { data: PaginatedApplicationsResponseDto }`.
- HTTP 403: An instructor profile is required.

### POST /api/auth/2fa/admin/:userId/disable

- Access: Bearer: ADMIN.
- Source: `src/modules/two-factor/two-factor.controller.ts:47`.
- Controller parameters: `@CurrentUser('id') adminId: string, @Param('userId', new ParseUUIDPipe()) userId: string`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Disable another user's two-factor authentication without a code (admin)
- path `userId` (required): `string`.
- HTTP 200: Two-factor authentication disabled successfully — `ApiResponseDto & { data: TwoFactorDisableResponseDto }`.
- HTTP 400: 2FA is not enabled, or the admin is trying to disable their own 2FA.
- HTTP 403: Admin role is required.
- HTTP 404: User not found.

### POST /api/auth/2fa/disable

- Access: Bearer; see service access rules.
- Source: `src/modules/two-factor/two-factor.controller.ts:39`.
- Controller parameters: `@CurrentUser('id') userId: string, @Body() dto: VerifyTwoFactorDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Disable two-factor authentication
- Body application/json: `VerifyTwoFactorDto`.
- HTTP 200: Two-factor authentication disabled successfully — `ApiResponseDto & { data: TwoFactorDisableResponseDto }`.
- HTTP 400: Two-factor authentication is not enabled.
- HTTP 401: Missing access token or invalid two-factor code.

### POST /api/auth/2fa/enable

- Access: Bearer; see service access rules.
- Source: `src/modules/two-factor/two-factor.controller.ts:24`.
- Controller parameters: `@CurrentUser('id') userId: string, @Body() dto: EnableTwoFactorDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Confirm and enable two-factor authentication
- Body application/json: `EnableTwoFactorDto`.
- HTTP 200: Two-factor authentication enabled; recovery codes are returned once — `ApiResponseDto & { data: TwoFactorEnableResponseDto }`.
- HTTP 400: Setup is missing or the authenticator code is invalid.
- HTTP 401: Missing or invalid access token.
- HTTP 409: Two-factor authentication is already enabled or setup changed.

### POST /api/auth/2fa/recovery-codes

- Access: Bearer; see service access rules.
- Source: `src/modules/two-factor/two-factor.controller.ts:56`.
- Controller parameters: `@CurrentUser('id') userId: string, @Body() dto: VerifyTwoFactorDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Replace all two-factor recovery codes
- Body application/json: `VerifyTwoFactorDto`.
- HTTP 200: New recovery codes generated; all previous codes are invalid — `ApiResponseDto & { data: TwoFactorRecoveryCodesResponseDto }`.
- HTTP 400: Two-factor authentication is not enabled.
- HTTP 401: Missing access token or invalid two-factor code.

### POST /api/auth/2fa/setup

- Access: Bearer; see service access rules.
- Source: `src/modules/two-factor/two-factor.controller.ts:17`.
- Controller parameters: `@CurrentUser('id') userId: string`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Create a Google Authenticator-compatible 2FA setup
- HTTP 201: Authenticator setup created; confirm it before it becomes active — `ApiResponseDto & { data: TwoFactorSetupResponseDto }`.
- HTTP 401: Missing or invalid access token.
- HTTP 409: Two-factor authentication is already enabled.

### GET /api/auth/2fa/status

- Access: Bearer; see service access rules.
- Source: `src/modules/two-factor/two-factor.controller.ts:32`.
- Controller parameters: `@CurrentUser('id') userId: string`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Get two-factor authentication status
- HTTP 200: Two-factor authentication status fetched successfully — `ApiResponseDto & { data: TwoFactorStatusResponseDto }`.
- HTTP 401: Missing or invalid access token.

### POST /api/auth/2fa/verify

- Access: Bearer OTP challenge: OTP_TOKEN_PURPOSE.TWO_FACTOR_LOGIN.
- Source: `src/modules/auth/auth.controller.ts:98`.
- Controller parameters: `@CurrentUser('id') userId: string, @CurrentUser('challengeId') challengeId: string \| undefined, @Body() dto: VerifyTwoFactorDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Complete login with an authenticator or recovery code
- Body application/json: `VerifyTwoFactorDto`.
- HTTP 200: Two-factor authentication verified and tokens issued — `ApiResponseDto & { data: AuthResponseDto }`.
- HTTP 401: Missing, expired, consumed, invalid, or wrong-purpose two-factor token/code.

### POST /api/auth/email/otp/resend

- Access: Public.
- Source: `src/modules/auth/auth.controller.ts:60`.
- Controller parameters: `@Body() dto: ResendEmailOtpDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Send email verification OTP
- Body application/json: `ResendEmailOtpDto`.
- HTTP 200: Verification code sent successfully — `ApiResponseDto & { data: EmailOtpResponseDto }`.
- HTTP 400: Unable to send verification email.

### POST /api/auth/email/otp/verify

- Access: Bearer OTP challenge: OTP_TOKEN_PURPOSE.EMAIL_VERIFICATION.
- Source: `src/modules/auth/auth.controller.ts:69`.
- Controller parameters: `@CurrentUser('id') userId: string, @Body() dto: VerifyEmailOtpDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Verify email OTP
- Body application/json: `VerifyEmailOtpDto`.
- HTTP 200: Email verified successfully — `ApiResponseDto & { data: AuthResponseDto }`.
- HTTP 400: Invalid or expired verification code.
- HTTP 401: Missing, expired, invalid, or wrong-purpose OTP token.

### POST /api/auth/login

- Access: Public.
- Source: `src/modules/auth/auth.controller.ts:25`.
- Controller parameters: `@Body() loginDto: LoginDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Login user
- Body application/json: `LoginDto`.
- HTTP 200: User logged in successfully — `ApiResponseDto & { data: LoginResponseDto }`.
- HTTP 401: Invalid email or password.

### GET /api/auth/me

- Access: Bearer; see service access rules.
- Source: `src/modules/auth/auth.controller.ts:112`.
- Controller parameters: `@CurrentUser('id') userId: string`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Get authenticated user
- HTTP 200: Authenticated user fetched successfully — `ApiResponseDto & { data: UserResponseDto }`.
- HTTP 401: Missing or invalid access token.

### POST /api/auth/oauth/google

- Access: Public.
- Source: `src/modules/auth/auth.controller.ts:34`.
- Controller parameters: `@Body() dto: GoogleLoginDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Login or register with Google
- Body application/json: `GoogleLoginDto`.
- HTTP 200: Google sign-in accepted; tokens or a two-factor challenge are returned — `ApiResponseDto & { data: LoginResponseDto }`.
- HTTP 400: role is required when the Google account creates a new user.
- HTTP 401: Invalid Google credential.
- HTTP 409: A password account with this email already exists.

### POST /api/auth/password/forgot

- Access: Public.
- Source: `src/modules/auth/auth.controller.ts:79`.
- Controller parameters: `@Body() dto: ForgotPasswordDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Send password reset OTP
- Body application/json: `ForgotPasswordDto`.
- HTTP 200: Password reset code sent successfully — `ApiResponseDto & { data: PasswordResetOtpResponseDto }`.
- HTTP 400: Invalid request.

### POST /api/auth/password/reset

- Access: Bearer OTP challenge: OTP_TOKEN_PURPOSE.PASSWORD_RESET.
- Source: `src/modules/auth/auth.controller.ts:88`.
- Controller parameters: `@CurrentUser('id') userId: string, @Body() dto: ResetPasswordDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Reset password with OTP
- Body application/json: `ResetPasswordDto`.
- HTTP 200: Password reset successfully — `ApiResponseDto & { data: PasswordResetResponseDto }`.
- HTTP 400: Invalid or expired password reset code.
- HTTP 401: Missing, expired, invalid, or wrong-purpose OTP token.

### POST /api/auth/phone/otp/send

- Access: Bearer; see service access rules.
- Source: `src/modules/phone-verification/phone-verification.controller.ts:15`.
- Controller parameters: `@CurrentUser('id') userId: string, @Body() dto: SendPhoneOtpDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Send a phone verification code by SMS
- Body application/json: `SendPhoneOtpDto`.
- HTTP 200: Verification code sent — `ApiResponseDto & { data: PhoneOtpResponseDto }`.
- HTTP 400: Invalid phone number, or Twilio cannot deliver to it.
- HTTP 401: Missing or invalid access token.
- HTTP 409: This phone number is already verified on the account.
- HTTP 429: Resend cooldown or hourly send limit reached.
- HTTP 503: SMS provider is not configured or failed.

### POST /api/auth/phone/otp/verify

- Access: Bearer; see service access rules.
- Source: `src/modules/phone-verification/phone-verification.controller.ts:23`.
- Controller parameters: `@CurrentUser('id') userId: string, @Body() dto: VerifyPhoneOtpDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Verify the phone code
- Body application/json: `VerifyPhoneOtpDto`.
- HTTP 200: Phone verified successfully — `ApiResponseDto & { data: UserResponseDto }`.
- HTTP 400: Invalid or expired verification code.
- HTTP 401: Missing or invalid access token.

### POST /api/auth/refresh

- Access: Public.
- Source: `src/modules/auth/auth.controller.ts:51`.
- Controller parameters: `@Body() refreshTokenDto: RefreshTokenDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Refresh access token
- Body application/json: `RefreshTokenDto`.
- HTTP 200: Tokens refreshed successfully — `ApiResponseDto & { data: AuthResponseDto }`.
- HTTP 400: refreshToken is required.
- HTTP 401: Invalid refresh token.

### POST /api/auth/register

- Access: Public.
- Source: `src/modules/auth/auth.controller.ts:43`.
- Controller parameters: `@Body() registerDto: RegisterDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Register user as an instructor or institution
- Body application/json: `RegisterDto`.
- HTTP 201: User registered successfully and verification code sent — `ApiResponseDto & { data: EmailVerificationResponseDto }`.
- HTTP 409: Email is already registered.

### GET /api/availability/jobs/:jobId/check

- Access: Bearer: INSTRUCTOR.
- Source: `src/modules/availability/availability.controller.ts:29`.
- Controller parameters: `@CurrentUser('id') userId: string, @Param('jobId') jobId: string`.
- Return annotation: `inferred; see controller/service`.
- path `jobId` (required): `string`.
- HTTP 200: .

### GET /api/availability/me

- Access: Bearer: INSTRUCTOR.
- Source: `src/modules/availability/availability.controller.ts:17`.
- Controller parameters: `@CurrentUser('id') userId: string`.
- Return annotation: `inferred; see controller/service`.
- HTTP 200: .

### PUT /api/availability/me

- Access: Bearer: INSTRUCTOR.
- Source: `src/modules/availability/availability.controller.ts:23`.
- Controller parameters: `@CurrentUser('id') userId: string, @Body() dto: UpdateAvailabilityDto`.
- Return annotation: `inferred; see controller/service`.
- Body application/json: `UpdateAvailabilityDto`.
- HTTP 200: .

### GET /api/bookings

- Access: Bearer: ADMIN.
- Source: `src/modules/bookings/bookings.controller.ts:40`.
- Controller parameters: `@Query() query: AdminListBookingsQueryDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: List all bookings (admin)
- query `status` (optional): `string [CONFIRMED, COMPLETED, CANCELLED, NO_SHOW]` — Only return bookings in this status.
- query `page` (optional): `Object`.
- query `limit` (optional): `Object`.
- query `search` (optional): `string` — Matches the job title, the teacher's name or the school's name.
- query `jobId` (optional): `string` — Only bookings for this job.
- query `from` (optional): `string` — Only bookings still running on or after this date (ISO date or date-time).
- query `to` (optional): `string` — Only bookings starting on or before this date; a plain date includes that whole day.
- query `invoice` (optional): `string [none, unpaid, paid]` — none: not invoiced yet (or only voided invoices) · unpaid: invoice awaiting payment · paid.
- query `instructorId` (optional): `string` — Only bookings for this instructor profile.
- query `institutionId` (optional): `string` — Only bookings with this institution profile.
- HTTP 200: Bookings fetched successfully — `ApiResponseDto & { data: PaginatedBookingsResponseDto }`.

### GET /api/bookings/:id

- Access: Bearer; see service access rules.
- Source: `src/modules/bookings/bookings.controller.ts:48`.
- Controller parameters: `@Param('id') id: string, @CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Get a booking (its instructor, its institution or an admin)
- path `id` (required): `string`.
- HTTP 200: Booking fetched successfully — `ApiResponseDto & { data: BookingResponseDto }`.
- HTTP 403: You do not have access to this booking.
- HTTP 404: Booking not found.

### PATCH /api/bookings/:id/attendance/:shiftId

- Access: Bearer: INSTITUTION, ADMIN.
- Source: `src/modules/bookings/bookings.controller.ts:79`.
- Controller parameters: `@Param('id') id: string, @Param('shiftId') shiftId: string, @Body() dto: RespondAttendanceDto, @CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- path `id` (required): `string`.
- path `shiftId` (required): `string`.
- Body application/json: `RespondAttendanceDto`.
- HTTP 200: .

### PATCH /api/bookings/:id/attendance/:shiftId/correct

- Access: Bearer: INSTITUTION, ADMIN.
- Source: `src/modules/bookings/bookings.controller.ts:98`.
- Controller parameters: `@Param('id') id: string, @Param('shiftId') shiftId: string, @Body() dto: CorrectAttendanceDto, @CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- path `id` (required): `string`.
- path `shiftId` (required): `string`.
- Body application/json: `CorrectAttendanceDto`.
- HTTP 200: .

### POST /api/bookings/:id/attendance/activate

- Access: Bearer: INSTITUTION, ADMIN.
- Source: `src/modules/bookings/bookings.controller.ts:91`.
- Controller parameters: `@Param('id') id: string, @CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- path `id` (required): `string`.
- HTTP 201: .

### PATCH /api/bookings/:id/attendance/correction-requests/:requestId

- Access: Bearer: INSTITUTION, ADMIN.
- Source: `src/modules/bookings/bookings.controller.ts:110`.
- Controller parameters: `@Param('id') id: string, @Param('requestId') requestId: string, @Body() dto: ReviewAttendanceCorrectionDto, @CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- path `id` (required): `string`.
- path `requestId` (required): `string`.
- Body application/json: `ReviewAttendanceCorrectionDto`.
- HTTP 200: .

### PATCH /api/bookings/:id/cancel

- Access: Bearer: INSTRUCTOR, INSTITUTION, ADMIN.
- Source: `src/modules/bookings/bookings.controller.ts:71`.
- Controller parameters: `@Param('id') id: string, @Body() dto: CancelBookingDto, @CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Cancel a booking
- path `id` (required): `string`.
- Body application/json: `CancelBookingDto`.
- HTTP 200: Booking cancelled successfully — `ApiResponseDto & { data: BookingResponseDto }`.
- HTTP 400: The booking is not confirmed.
- HTTP 403: Only the instructor or institution on this booking can cancel it.
- HTTP 404: Booking not found.
- HTTP 409: The booking changed during the request; retry with the latest state.

### PATCH /api/bookings/:id/complete

- Access: Bearer: INSTITUTION, ADMIN.
- Source: `src/modules/bookings/bookings.controller.ts:55`.
- Controller parameters: `@Param('id') id: string, @CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Mark a booking as completed
- path `id` (required): `string`.
- HTTP 200: Booking completed successfully — `ApiResponseDto & { data: BookingResponseDto }`.
- HTTP 400: The booking is not confirmed, or has not started yet.
- HTTP 403: Only the institution on this booking can complete it.
- HTTP 404: Booking not found.
- HTTP 409: The booking changed during the request; retry with the latest state.

### PATCH /api/bookings/:id/no-show

- Access: Bearer: INSTITUTION, ADMIN.
- Source: `src/modules/bookings/bookings.controller.ts:63`.
- Controller parameters: `@Param('id') id: string, @CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Record that the instructor did not turn up (institution on the booking or admin)
- path `id` (required): `string`.
- HTTP 200: Booking marked as a no-show — `ApiResponseDto & { data: BookingResponseDto }`.
- HTTP 400: The booking is not confirmed, or has not started yet.
- HTTP 403: Only the institution on this booking can mark it as a no-show.
- HTTP 404: Booking not found.
- HTTP 409: The booking changed during the request; retry with the latest state.

### POST /api/bookings/:id/payment-sync

- Access: Bearer; see service access rules.
- Source: `src/modules/payments/booking-payment.controller.ts:31`.
- Controller parameters: `@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Evaluate this booking for automatic billing and refresh its Stripe payment state
- path `id` (required): `string`.
- HTTP 200: .

### POST /api/bookings/direct-hire

- Access: Bearer: INSTITUTION.
- Source: `src/modules/bookings/direct-hire.controller.ts:20`.
- Controller parameters: `@CurrentUser() user: AuthUser, @Body() dto: DirectHireDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: School: send a job invitation (compatibility alias for POST /job-invitations)
- Body application/json: `DirectHireDto`.
- HTTP 200: Job invitation sent — `ApiResponseDto & { data: JobInvitationResponseDto }`.
- HTTP 400: Invalid payload, missing dates/pay, or inactive teacher.
- HTTP 403: An active school account is required.
- HTTP 404: Teacher or owned job not found.
- HTTP 409: Position filled, overlapping dates, ineligible job/application, or requestId reused with different data.
- HTTP 422: INVALID_JOB_TERMS with fieldErrors.

### GET /api/bookings/me

- Access: Bearer: INSTRUCTOR, INSTITUTION.
- Source: `src/modules/bookings/bookings.controller.ts:32`.
- Controller parameters: `@CurrentUser() user: AuthUser, @Query() query: ListBookingsQueryDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: List the caller's bookings
- query `status` (optional): `string [CONFIRMED, COMPLETED, CANCELLED, NO_SHOW]` — Only return bookings in this status.
- query `page` (optional): `Object`.
- query `limit` (optional): `Object`.
- query `search` (optional): `string` — Matches the job title, the teacher's name or the school's name.
- query `jobId` (optional): `string` — Only bookings for this job.
- query `from` (optional): `string` — Only bookings still running on or after this date (ISO date or date-time).
- query `to` (optional): `string` — Only bookings starting on or before this date; a plain date includes that whole day.
- query `invoice` (optional): `string [none, unpaid, paid]` — none: not invoiced yet (or only voided invoices) · unpaid: invoice awaiting payment · paid.
- HTTP 200: Bookings fetched successfully — `ApiResponseDto & { data: PaginatedBookingsResponseDto }`.
- HTTP 400: Invalid filter, or from is after to.
- HTTP 403: An instructor or institution profile is required.

### GET /api/compliance-approvals/token/:token

- Access: Public.
- Source: `src/modules/compliance-approvals/compliance-approvals.controller.ts:48`.
- Controller parameters: `@Param('token') token: string`.
- Return annotation: `inferred; see controller/service`.
- path `token` (required): `string`.
- HTTP 200: .

### POST /api/compliance-approvals/token/:token/approve

- Access: Public.
- Source: `src/modules/compliance-approvals/compliance-approvals.controller.ts:53`.
- Controller parameters: `@Param('token') token: string, @Body() _body: ApproveComplianceDto, @Ip() ip: string, @Headers('user-agent') userAgent?: string`.
- Return annotation: `inferred; see controller/service`.
- path `token` (required): `string`.
- header `user-agent` (required): `string`.
- Body application/json: `ApproveComplianceDto`.
- HTTP 200: .

### POST /api/compliance-approvals/token/:token/decline

- Access: Public.
- Source: `src/modules/compliance-approvals/compliance-approvals.controller.ts:64`.
- Controller parameters: `@Param('token') token: string, @Body() body: DeclineComplianceDto, @Ip() ip: string, @Headers('user-agent') userAgent?: string`.
- Return annotation: `inferred; see controller/service`.
- path `token` (required): `string`.
- header `user-agent` (required): `string`.
- Body application/json: `DeclineComplianceDto`.
- HTTP 200: .

### GET /api/contact/founding-interest

- Access: Bearer: ADMIN.
- Source: `src/modules/contact/contact.controller.ts:51`.
- Controller parameters: `@Query() query: ListFoundingInterestQueryDto`.
- Return annotation: `inferred; see controller/service`.
- query `page` (optional): `Object`.
- query `limit` (optional): `Object`.
- query `type` (optional): `string [SCHOOL, TEACHER]`.
- query `status` (optional): `string [NEW, CONTACTED, QUALIFIED, CONVERTED, CLOSED]`.
- query `search` (optional): `string`.
- query `fromDate` (optional): `string` — Created on or after this UTC date.
- query `toDate` (optional): `string` — Created on or before this UTC date.
- HTTP 200: .

### POST /api/contact/founding-interest

- Access: Public.
- Source: `src/modules/contact/contact.controller.ts:29`.
- Controller parameters: `@Body() dto: CreateFoundingInterestDto`.
- Return annotation: `inferred; see controller/service`.
- Body application/json: `CreateFoundingInterestDto`.
- HTTP 200: .

### DELETE /api/contact/founding-interest/:id

- Access: Bearer: ADMIN.
- Source: `src/modules/contact/contact.controller.ts:65`.
- Controller parameters: `@Param('id') id: string`.
- Return annotation: `inferred; see controller/service`.
- path `id` (required): `string`.
- HTTP 200: .

### PATCH /api/contact/founding-interest/:id/details

- Access: Public.
- Source: `src/modules/contact/contact.controller.ts:37`.
- Controller parameters: `@Param('id') id: string, @Body() dto: UpdateWaitlistDetailsDto`.
- Return annotation: `inferred; see controller/service`.
- path `id` (required): `string`.
- Body application/json: `UpdateWaitlistDetailsDto`.
- HTTP 200: .

### PATCH /api/contact/founding-interest/:id/status

- Access: Bearer: ADMIN.
- Source: `src/modules/contact/contact.controller.ts:58`.
- Controller parameters: `@Param('id') id: string, @Body() dto: UpdateFoundingInterestStatusDto`.
- Return annotation: `inferred; see controller/service`.
- path `id` (required): `string`.
- Body application/json: `UpdateFoundingInterestStatusDto`.
- HTTP 200: .

### GET /api/contact/founding-interest/all

- Access: Bearer: ADMIN.
- Source: `src/modules/contact/contact.controller.ts:44`.
- Controller parameters: ``.
- Return annotation: `inferred; see controller/service`.
- HTTP 200: .

### POST /api/contact/register-interest

- Access: Public.
- Source: `src/modules/contact/contact.controller.ts:21`.
- Controller parameters: `@Body() dto: RegisterInterestDto`.
- Return annotation: `inferred; see controller/service`.
- Body application/json: `RegisterInterestDto`.
- HTTP 200: .

### GET /api/conversations

- Access: Bearer: INSTRUCTOR, INSTITUTION.
- Source: `src/modules/conversations/conversations.controller.ts:31`.
- Controller parameters: `@CurrentUser() user: AuthUser, @Query() query: ListConversationsQueryDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: My conversations, most recent activity first, with unread counts
- query `page` (optional): `Object`.
- query `limit` (optional): `Object`.
- HTTP 200: Conversations fetched successfully — `ApiResponseDto & { data: PaginatedConversationsResponseDto }`.

### POST /api/conversations

- Access: Bearer: INSTITUTION.
- Source: `src/modules/conversations/conversations.controller.ts:22`.
- Controller parameters: `@CurrentUser() user: AuthUser, @Body() dto: StartConversationDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: School: start or reopen a General or application conversation
- Body application/json: `StartConversationDto`.
- HTTP 200: Conversation opened — `ApiResponseDto & { data: ConversationResponseDto }`.
- HTTP 400: Invalid context or inactive instructor.
- HTTP 403: An active school account and a teacher with verified documents are required; INSTRUCTOR_DOCUMENTS_NOT_VERIFIED for document failures.
- HTTP 404: Teacher, owned job, or owned application not found.

### GET /api/conversations/:id

- Access: Bearer; see service access rules.
- Source: `src/modules/conversations/conversations.controller.ts:86`.
- Controller parameters: `@Param('id') id: string, @CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: One conversation
- path `id` (required): `string`.
- HTTP 200: Conversation fetched successfully — `ApiResponseDto & { data: ConversationResponseDto }`.
- HTTP 404: Conversation not found, or not one of yours.

### POST /api/conversations/:id/attachments

- Access: Bearer: INSTRUCTOR, INSTITUTION.
- Source: `src/modules/conversations/conversations.controller.ts:133`.
- Controller parameters: `@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() dto: CreateAttachmentDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Start a file upload
- path `id` (required): `string`.
- Body application/json: `CreateAttachmentDto`.
- HTTP 201: Upload link created — `ApiResponseDto & { data: AttachmentUploadResponseDto }`.
- HTTP 400: File type or size not allowed, or too many unsent files.
- HTTP 403: Not a participant, read-only conversation, inactive teacher, or INSTRUCTOR_DOCUMENTS_NOT_VERIFIED.
- HTTP 404: Conversation not found, or not one of yours.

### GET /api/conversations/:id/attachments/:attachmentId/download-url

- Access: Bearer; see service access rules.
- Source: `src/modules/conversations/conversations.controller.ts:141`.
- Controller parameters: `@Param('id') id: string, @Param('attachmentId') attachmentId: string, @CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: A short-lived download link for a shared file
- path `id` (required): `string`.
- path `attachmentId` (required): `string`.
- HTTP 200: Download link created — `ApiResponseDto & { data: DownloadUrlResponseDto }`.
- HTTP 404: File or conversation not found.

### GET /api/conversations/:id/messages

- Access: Bearer; see service access rules.
- Source: `src/modules/conversations/conversations.controller.ts:110`.
- Controller parameters: `@Param('id') id: string, @CurrentUser() user: AuthUser, @Query() query: ListMessagesQueryDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Messages, oldest first; pass before=<first message id> to load older ones
- path `id` (required): `string`.
- query `before` (optional): `string` — Load messages older than this one (for scrolling back).
- query `limit` (optional): `Object`.
- HTTP 200: Messages fetched successfully — `ApiResponseDto & { data: MessagesPageResponseDto }`.
- HTTP 404: Conversation not found, or not one of yours.

### POST /api/conversations/:id/messages

- Access: Bearer: INSTRUCTOR, INSTITUTION.
- Source: `src/modules/conversations/conversations.controller.ts:117`.
- Controller parameters: `@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() dto: SendMessageDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Send a message with text, files (uploaded first), or both
- path `id` (required): `string`.
- Body application/json: `SendMessageDto`.
- HTTP 201: Message sent — `ApiResponseDto & { data: MessageResponseDto }`.
- HTTP 400: Empty message, or a file not uploaded / not matching what was declared.
- HTTP 403: Not a participant, rejected application, inactive teacher, or INSTRUCTOR_DOCUMENTS_NOT_VERIFIED. Teacher eligibility is checked for both senders..
- HTTP 404: Conversation not found, or not one of yours.
- HTTP 409: A file was already sent or removed.

### POST /api/conversations/:id/read

- Access: Bearer; see service access rules.
- Source: `src/modules/conversations/conversations.controller.ts:125`.
- Controller parameters: `@Param('id') id: string, @CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Mark the conversation read up to now (sends a read receipt to the other side)
- path `id` (required): `string`.
- HTTP 200: Conversation marked read — `ApiResponseDto & { data: unknown or null }`.
- HTTP 404: Conversation not found, or not one of yours.

### GET /api/conversations/:id/threads

- Access: Bearer: INSTRUCTOR, INSTITUTION.
- Source: `src/modules/conversations/conversations.controller.ts:93`.
- Controller parameters: `@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthUser, @Query() query: ListConversationThreadsQueryDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Scroll through General or Jobs conversations with the same school and teacher
- path `id` (required): `string`.
- query `topic` (optional): `string [GENERAL, JOBS]`.
- query `before` (optional): `string` — Last conversation ID from the previous page.
- query `limit` (optional): `Object`.
- HTTP 200: A page of conversation choices — `ApiResponseDto & { data: ConversationThreadsResponseDto }`.

### GET /api/conversations/application/:applicationId

- Access: Bearer; see service access rules.
- Source: `src/modules/conversations/conversations.controller.ts:57`.
- Controller parameters: `@Param('applicationId') applicationId: string, @CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Read an existing application conversation without creating it
- path `applicationId` (required): `string`.
- HTTP 200: Conversation opened — `ApiResponseDto & { data: ConversationResponseDto }`.
- HTTP 403: Not the teacher or the school on this application.
- HTTP 404: Application not found.

### GET /api/conversations/booking/:bookingId

- Access: Bearer; see service access rules.
- Source: `src/modules/conversations/conversations.controller.ts:64`.
- Controller parameters: `@Param('bookingId', new ParseUUIDPipe({ version: '4' })) bookingId: string, @CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: One conversation
- path `bookingId` (required): `string`.
- HTTP 200: Conversation fetched successfully — `ApiResponseDto & { data: ConversationResponseDto }`.
- HTTP 404: Conversation not found, or not one of yours.

### GET /api/conversations/job/:jobId

- Access: Bearer: ADMIN.
- Source: `src/modules/conversations/conversations.controller.ts:74`.
- Controller parameters: `@Param('jobId', new ParseUUIDPipe({ version: '4' })) jobId: string, @CurrentUser() user: AuthUser, @Query() query: ListConversationsQueryDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Admin: conversations for one job, with both participant names and user IDs
- path `jobId` (required): `string`.
- query `page` (optional): `Object`.
- query `limit` (optional): `Object`.
- HTTP 200: Job conversations fetched successfully — `ApiResponseDto & { data: JobConversationsResponseDto }`.
- HTTP 400: Invalid job UUID or pagination.
- HTTP 403: Admin access required.
- HTTP 404: Job not found.

### POST /api/conversations/socket-ticket

- Access: Bearer: INSTRUCTOR, INSTITUTION.
- Source: `src/modules/conversations/conversations.controller.ts:48`.
- Controller parameters: `@CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: A single-use, 60-second ticket that opens the live Socket.IO connection
- HTTP 200: Socket ticket issued — `ApiResponseDto & { data: SocketTicketResponseDto }`.

### GET /api/conversations/unread-count

- Access: Bearer: INSTRUCTOR, INSTITUTION.
- Source: `src/modules/conversations/conversations.controller.ts:39`.
- Controller parameters: `@CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Total unread messages, for the navigation badge
- HTTP 200: Unread count fetched successfully — `ApiResponseDto & { data: UnreadCountResponseDto }`.

### GET /api/dbs-checks/admin

- Access: Bearer: ADMIN.
- Source: `src/modules/dbs-checks/dbs-checks.controller.ts:57`.
- Controller parameters: `@Query() query: ListDbsChecksQueryDto`.
- Return annotation: `Promise<PaginatedDbsChecksResponseDto>`.
- Purpose: Admin: DBS checks, newest first
- query `page` (optional): `Object`.
- query `limit` (optional): `Object`.
- query `status` (optional): `string [SEND_FAILED, SUBMITTED, COMPLETED]`.
- query `result` (optional): `string [CLEAR, SEE_CERTIFICATE]`.
- query `needsDecision` (optional): `boolean` — true: only results waiting for an admin to approve or reject them.
- query `userId` (optional): `string` — Only this teacher's checks (user id).
- query `identityVerificationId` (optional): `string` — Only the DBS check sent for this identity check.
- HTTP 200: DBS checks fetched — `ApiResponseDto & { data: PaginatedDbsChecksResponseDto }`.

### POST /api/dbs-checks/admin

- Access: Bearer: ADMIN.
- Source: `src/modules/dbs-checks/dbs-checks.controller.ts:49`.
- Controller parameters: `@CurrentUser() admin: AuthUser, @Body() dto: SubmitDbsCheckDto`.
- Return annotation: `Promise<AdminDbsCheckDto>`.
- Purpose: Admin: send (or resend) the Enhanced DBS application to uCheck
- Body application/json: `SubmitDbsCheckDto`.
- HTTP 201: Sent to uCheck — `ApiResponseDto & { data: AdminDbsCheckDto }`.
- HTTP 404: Identity check not found.
- HTTP 409: Identity check not approved, or already sent.
- HTTP 422: The DBS form is incomplete (code DBS_FORM_INCOMPLETE) or uCheck rejected the application (UCHECK_REJECTED); `message` lists why.
- HTTP 503: uCheck is not configured or is unavailable.

### GET /api/dbs-checks/admin/:id

- Access: Bearer: ADMIN.
- Source: `src/modules/dbs-checks/dbs-checks.controller.ts:67`.
- Controller parameters: `@Param('id', ParseUUIDPipe) id: string`.
- Return annotation: `Promise<AdminDbsCheckDto>`.
- Purpose: Admin: one DBS check
- path `id` (required): `string`.
- HTTP 200: DBS check fetched — `ApiResponseDto & { data: AdminDbsCheckDto }`.
- HTTP 404: DBS check not found.

### POST /api/dbs-checks/admin/:id/decision

- Access: Bearer: ADMIN.
- Source: `src/modules/dbs-checks/dbs-checks.controller.ts:83`.
- Controller parameters: `@CurrentUser() admin: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideDbsCheckDto`.
- Return annotation: `Promise<AdminDbsCheckDto>`.
- Purpose: Admin: approve or reject a DBS result
- path `id` (required): `string`.
- Body application/json: `DecideDbsCheckDto`.
- HTTP 200: Decision saved — `ApiResponseDto & { data: AdminDbsCheckDto }`.
- HTTP 404: DBS check not found.
- HTTP 409: No result yet.

### GET /api/dbs-checks/admin/:id/report-url

- Access: Bearer: ADMIN.
- Source: `src/modules/dbs-checks/dbs-checks.controller.ts:75`.
- Controller parameters: `@Param('id', ParseUUIDPipe) id: string`.
- Return annotation: `Promise<DbsReportUrlResponseDto>`.
- Purpose: Admin: a short-lived link to uCheck's result report (PDF)
- path `id` (required): `string`.
- HTTP 200: Report URL created — `ApiResponseDto & { data: DbsReportUrlResponseDto }`.
- HTTP 404: No DBS check, or no report yet.

### POST /api/dbs-checks/admin/preview

- Access: Bearer: ADMIN.
- Source: `src/modules/dbs-checks/dbs-checks.controller.ts:38`.
- Controller parameters: `@Body() dto: SubmitDbsCheckDto`.
- Return annotation: `Promise<DbsCheckPreviewDto>`.
- Purpose: Admin: what would be sent to uCheck for an identity check
- Body application/json: `SubmitDbsCheckDto`.
- HTTP 200: Preview built — `ApiResponseDto & { data: DbsCheckPreviewDto }`.
- HTTP 404: Identity check not found.

### GET /api/dbs-checks/me

- Access: Bearer: INSTRUCTOR.
- Source: `src/modules/dbs-checks/dbs-checks.controller.ts:28`.
- Controller parameters: `@CurrentUser() user: AuthUser`.
- Return annotation: `Promise<MyDbsCheckResponseDto>`.
- Purpose: The teacher's latest DBS check, in their terms
- HTTP 200: DBS check fetched — `ApiResponseDto & { data: MyDbsCheckResponseDto }`.

### GET /api/degree-checks/admin

- Access: Bearer: ADMIN.
- Source: `src/modules/degree-checks/degree-checks.controller.ts:68`.
- Controller parameters: `@Query() query: ListDegreeChecksQueryDto`.
- Return annotation: `Promise<PaginatedDegreeChecksResponseDto>`.
- Purpose: Admin: list degree checks, newest first
- query `page` (optional): `Object`.
- query `limit` (optional): `Object`.
- query `status` (optional): `string [UNCONFIRMED, WAITING, MORE_INFORMATION, VERIFIED, CANCELLED]`.
- query `needsAction` (optional): `boolean` — true: only checks an admin has to act on (unconfirmed, more information wanted, or corrections to decide).
- query `userId` (optional): `string` — Only this teacher's checks (user id).
- HTTP 200: Degree checks fetched — `ApiResponseDto & { data: PaginatedDegreeChecksResponseDto }`.

### GET /api/degree-checks/admin/:id

- Access: Bearer: ADMIN.
- Source: `src/modules/degree-checks/degree-checks.controller.ts:78`.
- Controller parameters: `@Param('id', ParseUUIDPipe) id: string`.
- Return annotation: `Promise<AdminDegreeCheckDto>`.
- Purpose: Admin: one degree check, with what Hedd said
- path `id` (required): `string`.
- HTTP 200: Degree check fetched — `ApiResponseDto & { data: AdminDegreeCheckDto }`.
- HTTP 404: Degree check not found.

### POST /api/degree-checks/admin/:id/cancel

- Access: Bearer: ADMIN.
- Source: `src/modules/degree-checks/degree-checks.controller.ts:119`.
- Controller parameters: `@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelDegreeCheckDto`.
- Return annotation: `Promise<AdminDegreeCheckDto>`.
- Purpose: Admin: cancel a check whose sending Hedd never confirmed, so the teacher can start again
- path `id` (required): `string`.
- Body application/json: `CancelDegreeCheckDto`.
- HTTP 200: Degree check cancelled — `ApiResponseDto & { data: AdminDegreeCheckDto }`.
- HTTP 404: Degree check not found.
- HTTP 409: The check is not UNCONFIRMED.

### GET /api/degree-checks/admin/:id/consent-url

- Access: Bearer: ADMIN.
- Source: `src/modules/degree-checks/degree-checks.controller.ts:86`.
- Controller parameters: `@Param('id', ParseUUIDPipe) id: string`.
- Return annotation: `Promise<DegreeConsentUrlResponseDto>`.
- Purpose: Admin: a short-lived download URL for the teacher's signed consent form
- path `id` (required): `string`.
- HTTP 200: Consent form URL created — `ApiResponseDto & { data: DegreeConsentUrlResponseDto }`.
- HTTP 404: Degree check not found.

### POST /api/degree-checks/admin/:id/decision

- Access: Bearer: ADMIN.
- Source: `src/modules/degree-checks/degree-checks.controller.ts:94`.
- Controller parameters: `@CurrentUser() admin: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideDegreeCheckDto`.
- Return annotation: `Promise<AdminDegreeCheckDto>`.
- Purpose: Admin: decide whether a degree the university verified with corrections counts
- path `id` (required): `string`.
- Body application/json: `DecideDegreeCheckDto`.
- HTTP 200: Decision saved — `ApiResponseDto & { data: AdminDegreeCheckDto }`.
- HTTP 404: Degree check not found.
- HTTP 409: The university has not verified it yet.

### POST /api/degree-checks/admin/:id/test-verify

- Access: Bearer: ADMIN.
- Source: `src/modules/degree-checks/degree-checks.controller.ts:107`.
- Controller parameters: `@CurrentUser() admin: AuthUser, @Param('id', ParseUUIDPipe) id: string`.
- Return annotation: `Promise<AdminDegreeCheckDto>`.
- Purpose: Admin, testing only: mark an open check verified by the university, without Hedd
- path `id` (required): `string`.
- HTTP 200: Degree marked verified — `ApiResponseDto & { data: AdminDegreeCheckDto }`.
- HTTP 403: Test verification is switched off in this environment.
- HTTP 404: Degree check not found.
- HTTP 409: The check is already verified or closed.

### GET /api/degree-checks/institutions

- Access: Bearer: INSTRUCTOR, ADMIN.
- Source: `src/modules/degree-checks/degree-checks.controller.ts:31`.
- Controller parameters: ``.
- Return annotation: `DegreeInstitutionsResponseDto`.
- Purpose: The universities Hedd can verify a degree with, and the consent form each needs
- HTTP 200: Universities fetched — `ApiResponseDto & { data: DegreeInstitutionsResponseDto }`.

### GET /api/degree-checks/me

- Access: Bearer: INSTRUCTOR.
- Source: `src/modules/degree-checks/degree-checks.controller.ts:39`.
- Controller parameters: `@CurrentUser() user: AuthUser`.
- Return annotation: `Promise<MyDegreeCheckResponseDto>`.
- Purpose: The teacher's optional degree check: whether they can start one, and their latest
- HTTP 200: Degree check fetched — `ApiResponseDto & { data: MyDegreeCheckResponseDto }`.

### POST /api/degree-checks/me

- Access: Bearer: INSTRUCTOR.
- Source: `src/modules/degree-checks/degree-checks.controller.ts:60`.
- Controller parameters: `@CurrentUser() user: AuthUser, @Body() dto: SubmitDegreeCheckDto`.
- Return annotation: `Promise<TeacherDegreeCheckDto>`.
- Purpose: Send the teacher’s degree to Hedd for verification
- Body application/json: `SubmitDegreeCheckDto`.
- HTTP 201: Sent to Hedd — `ApiResponseDto & { data: TeacherDegreeCheckDto }`.
- HTTP 400: Unknown university, or the consent form is missing, too big or the wrong type.
- HTTP 409: Identity not verified yet, or a degree check is already open or verified.
- HTTP 422: Hedd refused the details (code HEDD_REJECTED); `message` lists why.
- HTTP 503: Degree checks are switched off here.

### POST /api/degree-checks/me/consent-upload-url

- Access: Bearer: INSTRUCTOR.
- Source: `src/modules/degree-checks/degree-checks.controller.ts:49`.
- Controller parameters: `@CurrentUser() user: AuthUser, @Body() dto: DegreeConsentUploadUrlDto`.
- Return annotation: `Promise<DegreeConsentUploadUrlResponseDto>`.
- Purpose: Get an upload URL for the signed consent form
- Body application/json: `DegreeConsentUploadUrlDto`.
- HTTP 201: Upload URL created — `ApiResponseDto & { data: DegreeConsentUploadUrlResponseDto }`.
- HTTP 503: Degree checks are switched off here.

### GET /api/document-requirements

- Access: Bearer: ADMIN.
- Source: `src/modules/document-requirements/document-requirements.controller.ts:28`.
- Controller parameters: ``.
- Return annotation: `Promise<DocumentRequirementResponseDto[]>`.
- HTTP 200: .

### POST /api/document-requirements

- Access: Bearer: ADMIN.
- Source: `src/modules/document-requirements/document-requirements.controller.ts:21`.
- Controller parameters: `@Body() dto: CreateDocumentRequirementDto`.
- Return annotation: `Promise<DocumentRequirementResponseDto>`.
- Body application/json: `CreateDocumentRequirementDto`.
- HTTP 201: .

### DELETE /api/document-requirements/:id

- Access: Bearer: ADMIN.
- Source: `src/modules/document-requirements/document-requirements.controller.ts:56`.
- Controller parameters: `@Param('id') id: string`.
- Return annotation: `Promise<DocumentRequirementResponseDto>`.
- path `id` (required): `string`.
- HTTP 200: .

### GET /api/document-requirements/:id

- Access: Bearer: ADMIN.
- Source: `src/modules/document-requirements/document-requirements.controller.ts:42`.
- Controller parameters: `@Param('id') id: string`.
- Return annotation: `Promise<DocumentRequirementResponseDto>`.
- path `id` (required): `string`.
- HTTP 200: .

### PATCH /api/document-requirements/:id

- Access: Bearer: ADMIN.
- Source: `src/modules/document-requirements/document-requirements.controller.ts:49`.
- Controller parameters: `@Param('id') id: string, @Body() dto: UpdateDocumentRequirementDto`.
- Return annotation: `Promise<DocumentRequirementResponseDto>`.
- path `id` (required): `string`.
- Body application/json: `UpdateDocumentRequirementDto`.
- HTTP 200: .

### GET /api/document-requirements/profile

- Access: Bearer: INSTRUCTOR, INSTITUTION.
- Source: `src/modules/document-requirements/document-requirements.controller.ts:35`.
- Controller parameters: `@CurrentUser('role') role: Role`.
- Return annotation: `Promise<ProfileDocumentRequirementResponseDto[]>`.
- HTTP 200: .

### GET /api/document-reviews

- Access: Bearer: ADMIN.
- Source: `src/modules/document-reviews/document-reviews.controller.ts:16`.
- Controller parameters: `@Query() query: ListDocumentReviewsQueryDto`.
- Return annotation: `Promise<DocumentReviewResponseDto[]>`.
- query `documentId` (optional): `string` — Only reviews of this document.
- HTTP 200: .

### GET /api/document-reviews/:id

- Access: Bearer: ADMIN.
- Source: `src/modules/document-reviews/document-reviews.controller.ts:23`.
- Controller parameters: `@Param('id') id: string`.
- Return annotation: `Promise<DocumentReviewResponseDto>`.
- path `id` (required): `string`.
- HTTP 200: .

### GET /api/document-types

- Access: Bearer: ADMIN.
- Source: `src/modules/document-types/document-types.controller.ts:22`.
- Controller parameters: ``.
- Return annotation: `Promise<DocumentTypeResponseDto[]>`.
- HTTP 200: .

### POST /api/document-types

- Access: Bearer: ADMIN.
- Source: `src/modules/document-types/document-types.controller.ts:15`.
- Controller parameters: `@Body() dto: CreateDocumentTypeDto`.
- Return annotation: `Promise<DocumentTypeResponseDto>`.
- Body application/json: `CreateDocumentTypeDto`.
- HTTP 201: .

### DELETE /api/document-types/:id

- Access: Bearer: ADMIN.
- Source: `src/modules/document-types/document-types.controller.ts:43`.
- Controller parameters: `@Param('id') id: string`.
- Return annotation: `Promise<DocumentTypeResponseDto>`.
- path `id` (required): `string`.
- HTTP 200: .

### GET /api/document-types/:id

- Access: Bearer: ADMIN.
- Source: `src/modules/document-types/document-types.controller.ts:29`.
- Controller parameters: `@Param('id') id: string`.
- Return annotation: `Promise<DocumentTypeResponseDto>`.
- path `id` (required): `string`.
- HTTP 200: .

### PATCH /api/document-types/:id

- Access: Bearer: ADMIN.
- Source: `src/modules/document-types/document-types.controller.ts:36`.
- Controller parameters: `@Param('id') id: string, @Body() dto: UpdateDocumentTypeDto`.
- Return annotation: `Promise<DocumentTypeResponseDto>`.
- path `id` (required): `string`.
- Body application/json: `UpdateDocumentTypeDto`.
- HTTP 200: .

### GET /api/documents

- Access: Bearer: INSTRUCTOR, INSTITUTION.
- Source: `src/modules/documents/documents.controller.ts:36`.
- Controller parameters: `@CurrentUser('id') userId: string, @Query() query: ListDocumentsQueryDto`.
- Return annotation: `Promise<PaginatedDocumentsResponseDto>`.
- Purpose: List your documents, including the rejection note for the current file
- query `page` (optional): `Object`.
- query `limit` (optional): `Object`.
- query `status` (optional): `string [NOT_REQUIRED, PENDING, APPROVED, REJECTED, REQUIRES_INFO]`.
- HTTP 200: Documents and current-file rejection notes — `ApiResponseDto & { data: PaginatedDocumentsResponseDto }`.

### POST /api/documents

- Access: Bearer: INSTRUCTOR, INSTITUTION.
- Source: `src/modules/documents/documents.controller.ts:29`.
- Controller parameters: `@Body() dto: CreateDocumentDto, @CurrentUser() user: AuthUser`.
- Return annotation: `Promise<DocumentResponseDto>`.
- Body application/json: `CreateDocumentDto`.
- HTTP 201: .

### PATCH /api/documents/:id

- Access: Bearer: INSTRUCTOR, INSTITUTION.
- Source: `src/modules/documents/documents.controller.ts:114`.
- Controller parameters: `@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateDocumentDto`.
- Return annotation: `Promise<DocumentResponseDto>`.
- path `id` (required): `string`.
- Body application/json: `UpdateDocumentDto`.
- HTTP 200: .

### GET /api/documents/:id/download-url

- Access: Bearer: INSTRUCTOR, INSTITUTION.
- Source: `src/modules/documents/documents.controller.ts:107`.
- Controller parameters: `@CurrentUser() user: AuthUser, @Param('id') id: string`.
- Return annotation: `Promise<DownloadUrlResponseDto>`.
- path `id` (required): `string`.
- HTTP 200: .

### POST /api/documents/:id/upload-complete

- Access: Bearer: INSTRUCTOR, INSTITUTION.
- Source: `src/modules/documents/documents.controller.ts:96`.
- Controller parameters: `@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CompleteUploadDto`.
- Return annotation: `Promise<DocumentResponseDto>`.
- path `id` (required): `string`.
- Body application/json: `CompleteUploadDto`.
- HTTP 201: .

### POST /api/documents/:id/upload-url

- Access: Bearer: INSTRUCTOR, INSTITUTION.
- Source: `src/modules/documents/documents.controller.ts:85`.
- Controller parameters: `@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateUploadUrlDto`.
- Return annotation: `Promise<UploadUrlResponseDto>`.
- path `id` (required): `string`.
- Body application/json: `CreateUploadUrlDto`.
- HTTP 201: .

### GET /api/documents/admin

- Access: Bearer: ADMIN.
- Source: `src/modules/documents/documents.controller.ts:52`.
- Controller parameters: `@Query() query: ListDocumentsQueryDto`.
- Return annotation: `Promise<PaginatedDocumentsResponseDto>`.
- query `page` (optional): `Object`.
- query `limit` (optional): `Object`.
- query `status` (optional): `string [NOT_REQUIRED, PENDING, APPROVED, REJECTED, REQUIRES_INFO]`.
- HTTP 200: .

### DELETE /api/documents/admin/:id

- Access: Bearer: ADMIN.
- Source: `src/modules/documents/documents.controller.ts:125`.
- Controller parameters: `@Param('id') id: string`.
- Return annotation: `Promise<DocumentResponseDto>`.
- path `id` (required): `string`.
- HTTP 200: .

### GET /api/documents/admin/:id

- Access: Bearer: ADMIN.
- Source: `src/modules/documents/documents.controller.ts:60`.
- Controller parameters: `@Param('id') id: string`.
- Return annotation: `Promise<DocumentResponseDto>`.
- path `id` (required): `string`.
- HTTP 200: .

### GET /api/documents/admin/:id/download-url

- Access: Bearer: ADMIN.
- Source: `src/modules/documents/documents.controller.ts:67`.
- Controller parameters: `@Param('id') id: string`.
- Return annotation: `Promise<DownloadUrlResponseDto>`.
- path `id` (required): `string`.
- HTTP 200: .

### POST /api/documents/admin/:id/review

- Access: Bearer: ADMIN.
- Source: `src/modules/documents/documents.controller.ts:74`.
- Controller parameters: `@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReviewDocumentDto`.
- Return annotation: `Promise<DocumentResponseDto>`.
- path `id` (required): `string`.
- Body application/json: `ReviewDocumentDto`.
- HTTP 201: .

### GET /api/dropdowns

- Access: Public.
- Source: `src/modules/dropdowns/dropdowns.controller.ts:15`.
- Controller parameters: ``.
- Return annotation: `inferred; see controller/service`.
- HTTP 200: .

### DELETE /api/dropdowns/:name

- Access: Bearer: ADMIN.
- Source: `src/modules/dropdowns/dropdowns.controller.ts:58`.
- Controller parameters: `@Param('name') name: string, @Body() dto: DeleteDropdownDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Retire a dropdown or selected options without altering existing records
- path `name` (required): `string`.
- Body application/json: `DeleteDropdownDto`.
- HTTP 200: .

### GET /api/dropdowns/:name

- Access: Public.
- Source: `src/modules/dropdowns/dropdowns.controller.ts:42`.
- Controller parameters: `@Param('name') name: string`.
- Return annotation: `inferred; see controller/service`.
- path `name` (required): `string`.
- HTTP 200: .

### PATCH /api/dropdowns/:name

- Access: Bearer: ADMIN.
- Source: `src/modules/dropdowns/dropdowns.controller.ts:50`.
- Controller parameters: `@Param('name') name: string, @Body() dto: UpdateDropdownDto`.
- Return annotation: `inferred; see controller/service`.
- path `name` (required): `string`.
- Body application/json: `UpdateDropdownDto`.
- HTTP 200: .

### GET /api/dropdowns/admin

- Access: Bearer: ADMIN.
- Source: `src/modules/dropdowns/dropdowns.controller.ts:23`.
- Controller parameters: ``.
- Return annotation: `inferred; see controller/service`.
- HTTP 200: .

### GET /api/dropdowns/admin/:name

- Access: Bearer: ADMIN.
- Source: `src/modules/dropdowns/dropdowns.controller.ts:32`.
- Controller parameters: `@Param('name') name: string`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Get all options, including retired entries, for administration
- path `name` (required): `string`.
- HTTP 200: .

### GET /api/health

- Access: Public.
- Source: `src/modules/health/health.controller.ts:15`.
- Controller parameters: ``.
- Return annotation: `inferred; see controller/service`.
- HTTP 200: The Health Check is successful — `{ status: string; info: object or null; error: object or null; details: object }`.
- HTTP 503: The Health Check is not successful — `{ status: string; info: object or null; error: object or null; details: object }`.

### GET /api/identity-verification/admin

- Access: Bearer: ADMIN.
- Source: `src/modules/identity-verification/identity-verification.controller.ts:59`.
- Controller parameters: `@Query() query: ListIdentityVerificationsQueryDto`.
- Return annotation: `Promise<PaginatedIdentityVerificationsResponseDto>`.
- Purpose: Admin: identity checks, newest first
- query `page` (optional): `Object`.
- query `limit` (optional): `Object`.
- query `status` (optional): `string [LINK_SENT, SUBMITTED, RESULTS_READY, COMPLETED, EXPIRED, CANCELLED]`.
- query `outcome` (optional): `string [PASSED, REFERRED, SOFT_FAILED, HARD_FAILED]`.
- query `needsDecision` (optional): `boolean` — true: only checks waiting for an admin to approve or reject them.
- query `userId` (optional): `string` — Only this teacher's checks (user id).
- HTTP 200: Identity verifications fetched — `ApiResponseDto & { data: PaginatedIdentityVerificationsResponseDto }`.
- HTTP 403: Admin access required.

### GET /api/identity-verification/admin/:id

- Access: Bearer: ADMIN.
- Source: `src/modules/identity-verification/identity-verification.controller.ts:72`.
- Controller parameters: `@Param('id', ParseUUIDPipe) id: string`.
- Return annotation: `Promise<AdminIdentityVerificationDto>`.
- Purpose: Admin: one identity check with TrustID's results and analyst notes
- path `id` (required): `string`.
- HTTP 200: Identity verification fetched — `ApiResponseDto & { data: AdminIdentityVerificationDto }`.
- HTTP 404: Identity verification not found.

### POST /api/identity-verification/admin/:id/decision

- Access: Bearer: ADMIN.
- Source: `src/modules/identity-verification/identity-verification.controller.ts:101`.
- Controller parameters: `@CurrentUser() admin: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideIdentityVerificationDto`.
- Return annotation: `Promise<AdminIdentityVerificationDto>`.
- Purpose: Admin: approve or reject an identity check TrustID referred to us
- path `id` (required): `string`.
- Body application/json: `DecideIdentityVerificationDto`.
- HTTP 200: Decision saved — `ApiResponseDto & { data: AdminIdentityVerificationDto }`.
- HTTP 404: Identity verification not found.
- HTTP 409: The check is not waiting for a decision.

### POST /api/identity-verification/admin/:id/reissue

- Access: Bearer: ADMIN.
- Source: `src/modules/identity-verification/identity-verification.controller.ts:88`.
- Controller parameters: `@CurrentUser() admin: AuthUser, @Param('id', ParseUUIDPipe) id: string`.
- Return annotation: `Promise<AdminIdentityVerificationDto>`.
- Purpose: Admin: send the teacher a new TrustID link
- path `id` (required): `string`.
- HTTP 201: New link sent — `ApiResponseDto & { data: AdminIdentityVerificationDto }`.
- HTTP 409: The teacher has submitted their check and it is being processed.
- HTTP 502: TrustID rejected the request.
- HTTP 503: TrustID is not configured or is unavailable.

### GET /api/identity-verification/admin/:id/report-url

- Access: Bearer: ADMIN.
- Source: `src/modules/identity-verification/identity-verification.controller.ts:80`.
- Controller parameters: `@Param('id', ParseUUIDPipe) id: string`.
- Return annotation: `Promise<ReportUrlResponseDto>`.
- Purpose: Admin: download link for TrustID's PDF report
- path `id` (required): `string`.
- HTTP 200: Report URL created — `ApiResponseDto & { data: ReportUrlResponseDto }`.
- HTTP 404: No report yet.

### POST /api/identity-verification/admin/:id/retry-retrieval

- Access: Bearer: ADMIN.
- Source: `src/modules/identity-verification/identity-verification.controller.ts:128`.
- Controller parameters: `@Param('id', ParseUUIDPipe) id: string`.
- Return annotation: `Promise<AdminIdentityVerificationDto>`.
- Purpose: Admin: fetch TrustID's results again
- path `id` (required): `string`.
- HTTP 200: Queued — `ApiResponseDto & { data: AdminIdentityVerificationDto }`.
- HTTP 409: The check is not waiting for results.

### POST /api/identity-verification/admin/users/:userId/test-verify

- Access: Bearer: ADMIN.
- Source: `src/modules/identity-verification/identity-verification.controller.ts:114`.
- Controller parameters: `@CurrentUser() admin: AuthUser, @Param('userId', ParseUUIDPipe) userId: string`.
- Return annotation: `Promise<AdminIdentityVerificationDto>`.
- Purpose: Admin (testing only): pass a teacher through TrustID and DBS without either check
- path `userId` (required): `string`.
- HTTP 200: Teacher marked verified — `ApiResponseDto & { data: AdminIdentityVerificationDto }`.
- HTTP 403: Switched off in this environment, or admin access required.
- HTTP 404: Teacher profile not found.

### GET /api/identity-verification/me

- Access: Bearer: INSTRUCTOR.
- Source: `src/modules/identity-verification/identity-verification.controller.ts:40`.
- Controller parameters: `@CurrentUser() user: AuthUser`.
- Return annotation: `Promise<MyIdentityVerificationResponseDto>`.
- Purpose: Where the teacher stands on the identity step, and their latest check
- HTTP 200: Identity verification fetched — `ApiResponseDto & { data: MyIdentityVerificationResponseDto }`.

### POST /api/identity-verification/me

- Access: Bearer: INSTRUCTOR.
- Source: `src/modules/identity-verification/identity-verification.controller.ts:48`.
- Controller parameters: `@CurrentUser() user: AuthUser, @Body() dto: StartIdentityVerificationDto`.
- Return annotation: `Promise<TeacherIdentityVerificationDto>`.
- Purpose: Start the TrustID identity and right to work check
- Body application/json: `StartIdentityVerificationDto`.
- HTTP 201: Identity check started — `ApiResponseDto & { data: TeacherIdentityVerificationDto }`.
- HTTP 400: No consent, or the profile has no name yet.
- HTTP 409: Already verified, in review, or waiting for an admin.
- HTTP 502: TrustID rejected the request.
- HTTP 503: TrustID is not configured or is unavailable.

### GET /api/institutions

- Access: Bearer: ADMIN.
- Source: `src/modules/institutions/institutions.controller.ts:33`.
- Controller parameters: `@Query() query: ListProfilesQueryDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Admin: list institution profiles, newest first
- query `page` (optional): `Object`.
- query `limit` (optional): `Object`.
- query `status` (optional): `string [INCOMPLETE, PENDING, ACTIVE, SUSPENDED, DEACTIVATED, REJECTED]` — Only profiles in this review status.
- query `search` (optional): `string` — Matches the name, town, postcode or the account's email.
- query `userId` (optional): `string` — Only this user's profile (a page of at most one).
- HTTP 200: Institution profiles fetched successfully — `ApiResponseDto & { data: PaginatedInstitutionsResponseDto }`.

### POST /api/institutions

- Access: Bearer: INSTITUTION.
- Source: `src/modules/institutions/institutions.controller.ts:23`.
- Controller parameters: `@Body() createInstitutionDto: CreateInstitutionDto, @CurrentUser('id') userId: string`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Create institution profile
- Body application/json: `CreateInstitutionDto`.
- HTTP 201: Institution profile created successfully — `ApiResponseDto & { data: InstitutionResponseDto }`.

### DELETE /api/institutions/:id

- Access: Bearer: ADMIN.
- Source: `src/modules/institutions/institutions.controller.ts:108`.
- Controller parameters: `@Param('id') id: string`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Delete institution profile
- path `id` (required): `string`.
- HTTP 200: Institution profile deleted successfully — `ApiResponseDto & { data: InstitutionResponseDto }`.
- HTTP 404: Institution not found.

### GET /api/institutions/:id

- Access: Bearer: ADMIN.
- Source: `src/modules/institutions/institutions.controller.ts:84`.
- Controller parameters: `@Param('id') id: string`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Get institution profile by ID
- path `id` (required): `string`.
- HTTP 200: Institution profile fetched successfully — `ApiResponseDto & { data: InstitutionResponseDto }`.
- HTTP 403: You can only update your own institution profile.
- HTTP 404: Institution not found.

### PATCH /api/institutions/:id

- Access: Bearer: ADMIN, INSTITUTION.
- Source: `src/modules/institutions/institutions.controller.ts:94`.
- Controller parameters: `@Param('id') id: string, @Body() updateInstitutionDto: UpdateInstitutionDto, @CurrentUser('id') userId: string`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Update institution profile
- path `id` (required): `string`.
- Body application/json: `UpdateInstitutionDto`.
- HTTP 200: Institution profile updated successfully — `ApiResponseDto & { data: InstitutionResponseDto }`.
- HTTP 404: Institution not found.

### PATCH /api/institutions/admin/:id/status

- Access: Bearer: ADMIN.
- Source: `src/modules/institutions/institutions.controller.ts:74`.
- Controller parameters: `@Param('id') id: string, @Body() dto: AdminUpdateProfileStatusDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Update institution profile status (admin)
- path `id` (required): `string`.
- Body application/json: `AdminUpdateProfileStatusDto`.
- HTTP 200: Institution profile status updated successfully — `ApiResponseDto & { data: InstitutionResponseDto }`.
- HTTP 400: The profile status value is invalid.
- HTTP 403: Admin role is required.
- HTTP 404: Institution profile not found.
- HTTP 409: The profile status changed during the request.

### GET /api/institutions/me

- Access: Bearer: INSTITUTION.
- Source: `src/modules/institutions/institutions.controller.ts:46`.
- Controller parameters: `@CurrentUser('id') userId: string`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Get the authenticated institution profile
- HTTP 200: Institution profile fetched successfully — `ApiResponseDto & { data: InstitutionResponseDto }`.
- HTTP 404: Institution profile not found.

### GET /api/institutions/me/compliance-approval

- Access: Bearer: INSTITUTION.
- Source: `src/modules/compliance-approvals/compliance-approvals.controller.ts:32`.
- Controller parameters: `@CurrentUser('id') id: string`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Read the latest single-school compliance approval
- HTTP 200: .

### POST /api/institutions/me/compliance-approval

- Access: Bearer: INSTITUTION.
- Source: `src/modules/compliance-approvals/compliance-approvals.controller.ts:37`.
- Controller parameters: `@CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Email an approval link to the saved compliance contact
- HTTP 201: .

### GET /api/institutions/me/signatory-approval

- Access: Bearer: INSTITUTION.
- Source: `src/modules/signatory-approvals/signatory-approvals.controller.ts:37`.
- Controller parameters: `@CurrentUser('id') userId: string`.
- Return annotation: `inferred; see controller/service`.
- Purpose: The school's latest signatory approval request (null when none sent)
- HTTP 200: Signatory approval fetched successfully — `ApiResponseDto & { data: SignatoryApprovalResponseDto }`.

### POST /api/institutions/me/signatory-approval

- Access: Bearer: INSTITUTION.
- Source: `src/modules/signatory-approvals/signatory-approvals.controller.ts:29`.
- Controller parameters: `@CurrentUser() user: AuthUser, @Body() dto: RequestSignatoryApprovalDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Ask the trust signatory to approve this MAT school
- Body application/json: `RequestSignatoryApprovalDto`.
- HTTP 201: Approval request sent — `ApiResponseDto & { data: SignatoryApprovalResponseDto }`.
- HTTP 400: Not a MAT school, or the signatory is the requester.
- HTTP 403: An institution profile is required.
- HTTP 409: Already approved, or the profile is not editable.
- HTTP 429: A request was sent moments ago.

### PATCH /api/institutions/me/status

- Access: Bearer: INSTITUTION.
- Source: `src/modules/institutions/institutions.controller.ts:64`.
- Controller parameters: `@CurrentUser('id') userId: string`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Submit or resubmit the authenticated institution profile for review
- HTTP 200: Institution profile status updated successfully — `ApiResponseDto & { data: InstitutionResponseDto }`.
- HTTP 400: The requested profile status transition is not allowed.
- HTTP 404: Institution profile not found.
- HTTP 409: The profile status changed during the request.

### GET /api/institutions/profile/:id

- Access: Bearer: INSTRUCTOR, INSTITUTION, ADMIN.
- Source: `src/modules/institutions/institutions.controller.ts:56`.
- Controller parameters: `@Param('id') id: string, @CurrentUser() user: AuthUser`.
- Return annotation: `Promise<InstitutionPublicProfileDto>`.
- Purpose: A school's public profile, as teachers see it
- path `id` (required): `string`.
- HTTP 200: Institution profile fetched successfully — `ApiResponseDto & { data: InstitutionPublicProfileDto }`.
- HTTP 403: Only approved teachers can view school profiles.
- HTTP 404: No approved school with this id.

### GET /api/instructors

- Access: Bearer: ADMIN.
- Source: `src/modules/instructors/instructors.controller.ts:35`.
- Controller parameters: `@Query() query: ListProfilesQueryDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Admin: list instructor profiles, newest first
- query `page` (optional): `Object`.
- query `limit` (optional): `Object`.
- query `status` (optional): `string [INCOMPLETE, PENDING, ACTIVE, SUSPENDED, DEACTIVATED, REJECTED]` — Only profiles in this review status.
- query `search` (optional): `string` — Matches the name, town, postcode or the account's email.
- query `userId` (optional): `string` — Only this user's profile (a page of at most one).
- HTTP 200: Instructor profiles retrieved successfully — `ApiResponseDto & { data: PaginatedInstructorsResponseDto }`.

### POST /api/instructors

- Access: Bearer: INSTRUCTOR.
- Source: `src/modules/instructors/instructors.controller.ts:25`.
- Controller parameters: `@Body() createInstructorDto: CreateInstructorDto, @CurrentUser('id') userId: string`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Create instructor profile
- Body application/json: `CreateInstructorDto`.
- HTTP 201: Instructor profile created successfully — `ApiResponseDto & { data: InstructorResponseDto }`.
- HTTP 403: Only a USER account can create an instructor profile.
- HTTP 404: User not found.
- HTTP 409: Instructor profile already exists.

### DELETE /api/instructors/:id

- Access: Bearer: ADMIN.
- Source: `src/modules/instructors/instructors.controller.ts:117`.
- Controller parameters: `@Param('id') id: string`.
- Return annotation: `Promise<void>`.
- Purpose: Delete instructor profile
- path `id` (required): `string`.
- HTTP 200: Instructor profile deleted successfully — `ApiResponseDto & { data: unknown or null }`.
- HTTP 404: Instructor not found.

### GET /api/instructors/:id

- Access: Bearer: INSTRUCTOR, ADMIN.
- Source: `src/modules/instructors/instructors.controller.ts:84`.
- Controller parameters: `@Param('id') id: string, @CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: The full instructor profile, private details included (owner or admin)
- path `id` (required): `string`.
- HTTP 200: Instructor profile retrieved successfully — `ApiResponseDto & { data: InstructorResponseDto }`.
- HTTP 403: You can only view your own full profile.
- HTTP 404: Instructor not found.

### PATCH /api/instructors/:id

- Access: Bearer; see service access rules.
- Source: `src/modules/instructors/instructors.controller.ts:94`.
- Controller parameters: `@Param('id') id: string, @Body() updateInstructorDto: UpdateInstructorDto, @CurrentUser('id') userId: string`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Update instructor profile
- path `id` (required): `string`.
- Body application/json: `UpdateInstructorDto`.
- HTTP 200: Instructor profile updated successfully — `ApiResponseDto & { data: InstructorResponseDto }`.
- HTTP 403: You can only update your own instructor profile.
- HTTP 404: Instructor not found.

### PATCH /api/instructors/admin/:id

- Access: Bearer: ADMIN.
- Source: `src/modules/instructors/instructors.controller.ts:107`.
- Controller parameters: `@Param('id') id: string, @Body() adminUpdateInstructorDto: AdminUpdateInstructorDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Admin update instructor profile and status
- path `id` (required): `string`.
- Body application/json: `AdminUpdateInstructorDto`.
- HTTP 200: Instructor profile updated successfully — `ApiResponseDto & { data: InstructorResponseDto }`.
- HTTP 400: The profile status value is invalid.
- HTTP 403: Only an ADMIN account can use this endpoint.
- HTTP 404: Instructor not found.
- HTTP 409: The profile status changed during the request.

### GET /api/instructors/directory

- Access: Bearer: INSTITUTION.
- Source: `src/modules/instructors/instructors.controller.ts:58`.
- Controller parameters: `@CurrentUser('id') userId: string, @Query() query: ListInstructorDirectoryQueryDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: School: browse active instructors and their booked dates
- query `page` (optional): `Object`.
- query `limit` (optional): `Object`.
- query `search` (optional): `string` — Matches teacher name, city or county.
- query `subject` (optional): `string`.
- query `keyStage` (optional): `string`.
- query `skill` (optional): `string`.
- query `city` (optional): `string`.
- query `dbsVerified` (optional): `boolean`.
- query `qtsQualified` (optional): `boolean` — Has an approved document whose document type code is QTS.
- query `availableToday` (optional): `boolean` — Has no confirmed booking overlapping today in UTC.
- query `minExperience` (optional): `number`.
- query `maxHourlyRate` (optional): `number`.
- query `maxDailyRate` (optional): `number`.
- query `minRating` (optional): `number`.
- HTTP 200: Instructor directory fetched successfully — `ApiResponseDto & { data: PaginatedInstructorDirectoryResponseDto }`.
- HTTP 403: An active school account is required.

### GET /api/instructors/me

- Access: Bearer: INSTRUCTOR.
- Source: `src/modules/instructors/instructors.controller.ts:48`.
- Controller parameters: `@CurrentUser('id') userId: string`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Get the authenticated instructor profile
- HTTP 200: Instructor profile retrieved successfully — `ApiResponseDto & { data: InstructorResponseDto }`.
- HTTP 404: Instructor profile not found.

### PATCH /api/instructors/me/status

- Access: Bearer: INSTRUCTOR.
- Source: `src/modules/instructors/instructors.controller.ts:66`.
- Controller parameters: `@CurrentUser('id') userId: string`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Submit or resubmit the authenticated instructor profile for review
- HTTP 200: Instructor profile status updated successfully — `ApiResponseDto & { data: InstructorResponseDto }`.
- HTTP 400: The requested profile status transition is not allowed.
- HTTP 404: Instructor profile not found.
- HTTP 409: The profile status changed during the request.

### GET /api/instructors/profile/:id

- Access: Bearer: INSTRUCTOR, INSTITUTION, ADMIN.
- Source: `src/modules/instructors/instructors.controller.ts:76`.
- Controller parameters: `@Param('id') id: string, @CurrentUser() user: AuthUser`.
- Return annotation: `Promise<InstructorPublicProfileDto>`.
- Purpose: A teacher's public profile, as schools see it
- path `id` (required): `string`.
- HTTP 200: Instructor profile retrieved successfully — `ApiResponseDto & { data: InstructorPublicProfileDto }`.
- HTTP 403: Only approved schools can view teacher profiles.
- HTTP 404: No approved teacher with this id.

### GET /api/invoices

- Access: Bearer: ADMIN.
- Source: `src/modules/payments/payments.controller.ts:269`.
- Controller parameters: `@Query() query: AdminListInvoicesQueryDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Admin: every invoice
- query `page` (optional): `Object`.
- query `limit` (optional): `Object`.
- query `status` (optional): `string [PENDING, OPEN, PAID, VOID, UNCOLLECTIBLE]`.
- query `jobId` (optional): `string`.
- query `bookingId` (optional): `string`.
- query `instructorId` (optional): `string` — Instructor profile id.
- query `institutionId` (optional): `string` — Institution profile id.
- HTTP 200: Invoices fetched successfully — `ApiResponseDto & { data: PaginatedInvoicesResponseDto }`.

### POST /api/invoices

- Access: Bearer: INSTITUTION, ADMIN.
- Source: `src/modules/payments/payments.controller.ts:253`.
- Controller parameters: `@CurrentUser() user: AuthUser, @Body() dto: CreateInvoiceDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Invoice a completed booking
- Body application/json: `CreateInvoiceDto`.
- HTTP 201: Invoice created and sent — `ApiResponseDto & { data: InvoiceResponseDto }`.
- HTTP 400: Booking not completed, missing pay details, bad unitsWorked, or teacher payouts not ready.
- HTTP 403: Only the institution on the booking (or an admin) can invoice it.
- HTTP 404: Booking not found.
- HTTP 409: The booking already has an invoice.
- HTTP 502: Stripe rejected the request.
- HTTP 503: Payments are not configured, or Stripe is unavailable.

### GET /api/invoices/:id

- Access: Bearer; see service access rules.
- Source: `src/modules/payments/payments.controller.ts:289`.
- Controller parameters: `@Param('id') id: string, @CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: One invoice (the teacher, the school or an admin)
- path `id` (required): `string`.
- HTTP 200: Invoice fetched successfully — `ApiResponseDto & { data: InvoiceResponseDto }`.
- HTTP 404: Invoice not found.

### POST /api/invoices/:id/payment-session

- Access: Bearer: INSTITUTION.
- Source: `src/modules/payments/payments.controller.ts:296`.
- Controller parameters: `@Param('id') id: string, @CurrentUser() user: AuthUser`.
- Return annotation: `Promise<InvoicePaymentSessionResponseDto>`.
- Purpose: Resolve an unpaid invoice in the app (Stripe card Payment Element)
- path `id` (required): `string`.
- HTTP 200: Payment session created — `ApiResponseDto & { data: InvoicePaymentSessionResponseDto }`.
- HTTP 400: The invoice is not unpaid.
- HTTP 403: Only the institution on the booking can pay it.
- HTTP 404: Invoice not found.
- HTTP 409: The invoice was paid or voided in the meantime.
- HTTP 502: Stripe rejected the request.
- HTTP 503: Payments are not configured, or Stripe is unavailable.

### POST /api/invoices/:id/refund

- Access: Bearer: ADMIN.
- Source: `src/modules/payments/payments.controller.ts:334`.
- Controller parameters: `@Param('id') id: string, @Body() dto: RefundInvoiceDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Admin: refund a paid invoice, in full or in part
- path `id` (required): `string`.
- Body application/json: `RefundInvoiceDto`.
- HTTP 200: Refund issued — `ApiResponseDto & { data: InvoiceResponseDto }`.
- HTTP 400: Not paid, already refunded, or the amount is too large.
- HTTP 503: Payments are not configured, or Stripe is unavailable.

### POST /api/invoices/:id/send

- Access: Bearer: INSTITUTION, ADMIN.
- Source: `src/modules/payments/payments.controller.ts:316`.
- Controller parameters: `@Param('id') id: string, @CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Email an unpaid invoice to the school again
- path `id` (required): `string`.
- HTTP 200: Invoice sent — `ApiResponseDto & { data: InvoiceResponseDto }`.
- HTTP 400: The invoice is not unpaid.
- HTTP 503: Payments are not configured, or Stripe is unavailable.

### POST /api/invoices/:id/sync

- Access: Bearer; see service access rules.
- Source: `src/modules/payments/payments.controller.ts:308`.
- Controller parameters: `@Param('id') id: string, @CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Refresh an invoice's status from Stripe
- path `id` (required): `string`.
- HTTP 200: Invoice status refreshed — `ApiResponseDto & { data: InvoiceResponseDto }`.
- HTTP 404: Invoice not found.
- HTTP 503: Payments are not configured, or Stripe is unavailable.

### POST /api/invoices/:id/void

- Access: Bearer: ADMIN.
- Source: `src/modules/payments/payments.controller.ts:325`.
- Controller parameters: `@Param('id') id: string`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Admin: cancel an unpaid invoice
- path `id` (required): `string`.
- HTTP 200: Invoice voided — `ApiResponseDto & { data: InvoiceResponseDto }`.
- HTTP 400: The invoice is not unpaid.
- HTTP 503: Payments are not configured, or Stripe is unavailable.

### GET /api/invoices/job/:jobId

- Access: Bearer: ADMIN.
- Source: `src/modules/payments/payments.controller.ts:277`.
- Controller parameters: `@Param('jobId', new ParseUUIDPipe({ version: '4' })) jobId: string, @CurrentUser() user: AuthUser, @Query() query: JobInvoicesQueryDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Admin: payment audit for one job
- path `jobId` (required): `string`.
- query `page` (optional): `Object`.
- query `limit` (optional): `Object`.
- query `status` (optional): `string [PENDING, OPEN, PAID, VOID, UNCOLLECTIBLE]`.
- HTTP 200: Job payments fetched successfully — `ApiResponseDto & { data: JobPaymentsResponseDto }`.
- HTTP 400: Invalid job UUID, status or pagination.
- HTTP 403: Admin access required.
- HTTP 404: Job not found.

### GET /api/invoices/me

- Access: Bearer: INSTRUCTOR, INSTITUTION.
- Source: `src/modules/payments/payments.controller.ts:261`.
- Controller parameters: `@CurrentUser() user: AuthUser, @Query() query: ListMyInvoicesQueryDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: The caller's invoices: a teacher's earnings, or a school's bills
- query `page` (optional): `Object`.
- query `limit` (optional): `Object`.
- query `status` (optional): `string [PENDING, OPEN, PAID, VOID, UNCOLLECTIBLE]`.
- HTTP 200: Invoices fetched successfully — `ApiResponseDto & { data: PaginatedInvoicesResponseDto }`.

### POST /api/job-invitations

- Access: Bearer: INSTITUTION.
- Source: `src/modules/bookings/job-invitations.controller.ts:47`.
- Controller parameters: `@CurrentUser() user: AuthUser, @Body() dto: DirectHireDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: School: invite one teacher to an open instant job
- Body application/json: `DirectHireDto`.
- HTTP 200: Invitation sent — `ApiResponseDto & { data: JobInvitationResponseDto }`.
- HTTP 409: Reservation, concurrent decision, changed terms or overlapping booking conflict; refresh before retrying.
- HTTP 422: INVALID_JOB_TERMS with fieldErrors.

### GET /api/job-invitations/:id

- Access: Bearer: INSTITUTION, INSTRUCTOR.
- Source: `src/modules/bookings/job-invitations.controller.ts:82`.
- Controller parameters: `@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Read invitation details; only the inviting school and invited teacher
- path `id` (required): `string`.
- HTTP 200: Invitation fetched — `ApiResponseDto & { data: JobInvitationResponseDto }`.
- HTTP 409: Reservation, concurrent decision, changed terms or overlapping booking conflict; refresh before retrying.
- HTTP 422: INVALID_JOB_TERMS with fieldErrors.

### POST /api/job-invitations/:id/accept

- Access: Bearer: INSTRUCTOR.
- Source: `src/modules/bookings/job-invitations.controller.ts:91`.
- Controller parameters: `@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Invited teacher: accept and create the booking atomically
- path `id` (required): `string`.
- HTTP 200: Invitation accepted and booking confirmed — `ApiResponseDto & { data: BookingResponseDto }`.
- HTTP 409: Reservation, concurrent decision, changed terms or overlapping booking conflict; refresh before retrying.
- HTTP 422: INVALID_JOB_TERMS with fieldErrors.

### POST /api/job-invitations/:id/cancel

- Access: Bearer: INSTITUTION.
- Source: `src/modules/bookings/job-invitations.controller.ts:112`.
- Controller parameters: `@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Inviting school: cancel this invitation
- path `id` (required): `string`.
- HTTP 200: Invitation cancelled — `ApiResponseDto & { data: JobInvitationResponseDto }`.
- HTTP 409: Reservation, concurrent decision, changed terms or overlapping booking conflict; refresh before retrying.
- HTTP 422: INVALID_JOB_TERMS with fieldErrors.

### POST /api/job-invitations/:id/decline

- Access: Bearer: INSTRUCTOR.
- Source: `src/modules/bookings/job-invitations.controller.ts:102`.
- Controller parameters: `@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Invited teacher: decline this invitation
- path `id` (required): `string`.
- HTTP 200: Invitation declined — `ApiResponseDto & { data: JobInvitationResponseDto }`.
- HTTP 409: Reservation, concurrent decision, changed terms or overlapping booking conflict; refresh before retrying.
- HTTP 422: INVALID_JOB_TERMS with fieldErrors.

### GET /api/job-invitations/me

- Access: Bearer: INSTITUTION, INSTRUCTOR.
- Source: `src/modules/bookings/job-invitations.controller.ts:62`.
- Controller parameters: `@CurrentUser() user: AuthUser, @Query() query: ListJobInvitationsDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: My sent invitations (school) or received invitations (teacher)
- query `page` (optional): `Object`.
- query `limit` (optional): `Object`.
- query `status` (optional): `string [ALL, PENDING, ACCEPTED, DECLINED, CANCELLED, EXPIRED]` — Filter sent or received invitations by status (case-insensitive). Omit or use ALL for all invitations..
- HTTP 200: Invitations fetched — `ApiResponseDto & { data: PaginatedJobInvitationsDto }`.
- HTTP 409: Reservation, concurrent decision, changed terms or overlapping booking conflict; refresh before retrying.
- HTTP 422: INVALID_JOB_TERMS with fieldErrors.

### GET /api/jobs

- Access: Public.
- Source: `src/modules/jobs/jobs.controller.ts:35`.
- Controller parameters: `@Query() query: SearchJobsQueryDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: List active job postings, newest first
- query `jobType` (optional): `string [INSTANT, BRIEF]`.
- query `page` (optional): `Object`.
- query `limit` (optional): `Object`.
- query `search` (optional): `string` — Matches the title, description, subject, town, county, postcode or a required skill.
- query `subject` (optional): `string` — Exact subject, ignoring case.
- query `keyStage` (optional): `string` — Jobs that include this key stage.
- query `urgent` (optional): `boolean` — true: only jobs whose listing expires within 2 days.
- HTTP 200: Jobs fetched successfully — `ApiResponseDto & { data: PaginatedJobsResponseDto }`.

### POST /api/jobs

- Access: Bearer: INSTITUTION, ADMIN.
- Source: `src/modules/jobs/jobs.controller.ts:24`.
- Controller parameters: `@Body() createJobDto: CreateJobDto, @CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Create a job posting
- Body application/json: `CreateJobDto`.
- HTTP 201: Job created successfully — `ApiResponseDto & { data: JobResponseDto }`.
- HTTP 400: Invalid work/listing dates, invalid hours/days, or units supplied for the wrong pay type.

### DELETE /api/jobs/:id

- Access: Bearer: INSTITUTION, ADMIN.
- Source: `src/modules/jobs/jobs.controller.ts:115`.
- Controller parameters: `@Param('id') id: string, @CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Permanently delete only an unused, never-published draft
- path `id` (required): `string`.
- HTTP 200: Job deleted successfully — `ApiResponseDto & { data: JobResponseDto }`.
- HTTP 403: You can only manage your own job postings.
- HTTP 404: Job not found.
- HTTP 409: JOB_HISTORY_PROTECTED: close the job instead.

### GET /api/jobs/:id

- Access: Public.
- Source: `src/modules/jobs/jobs.controller.ts:71`.
- Controller parameters: `@Param('id') id: string`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Get a job by ID
- path `id` (required): `string`.
- HTTP 200: Job fetched successfully — `ApiResponseDto & { data: JobResponseDto }`.
- HTTP 404: Job not found.

### PATCH /api/jobs/:id

- Access: Bearer: INSTITUTION, ADMIN.
- Source: `src/modules/jobs/jobs.controller.ts:104`.
- Controller parameters: `@Param('id') id: string, @Body() updateJobDto: UpdateJobDto, @CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Update a job posting
- path `id` (required): `string`.
- Body application/json: `UpdateJobDto`.
- HTTP 200: Job updated successfully — `ApiResponseDto & { data: JobResponseDto }`.
- HTTP 400: startDate must be before or equal to endDate.
- HTTP 403: You can only manage your own job postings.
- HTTP 404: Job not found.
- HTTP 409: JOB_TERMS_LOCKED, concurrent update, or a protected reservation/booking transition.
- HTTP 422: INVALID_JOB_TERMS with fieldErrors when publication terms are incomplete.

### GET /api/jobs/accessible/:id

- Access: Bearer: INSTRUCTOR, INSTITUTION, ADMIN.
- Source: `src/modules/jobs/jobs.controller.ts:63`.
- Controller parameters: `@Param('id') id: string, @CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Get a job the signed-in user may view
- path `id` (required): `string`.
- HTTP 200: Job fetched successfully — `ApiResponseDto & { data: JobResponseDto }`.
- HTTP 404: Job not found or the caller is not allowed to view it.

### GET /api/jobs/admin/all

- Access: Bearer: ADMIN.
- Source: `src/modules/jobs/jobs.controller.ts:82`.
- Controller parameters: `@Query() query: ListJobsQueryDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: List jobs across all statuses with pagination (admin)
- query `jobType` (optional): `string [INSTANT, BRIEF]`.
- query `page` (optional): `Object`.
- query `limit` (optional): `Object`.
- HTTP 200: Jobs fetched successfully — `ApiResponseDto & { data: PaginatedJobsResponseDto }`.
- HTTP 403: Admin role is required.

### GET /api/jobs/institution/:institutionId

- Access: Bearer; see service access rules.
- Source: `src/modules/jobs/jobs.controller.ts:95`.
- Controller parameters: `@Param('institutionId') institutionId: string, @Query() query: SearchJobsQueryDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: List an institution's active jobs
- path `institutionId` (required): `string`.
- query `jobType` (optional): `string [INSTANT, BRIEF]`.
- query `page` (optional): `Object`.
- query `limit` (optional): `Object`.
- query `search` (optional): `string` — Matches the title, description, subject, town, county, postcode or a required skill.
- query `subject` (optional): `string` — Exact subject, ignoring case.
- query `keyStage` (optional): `string` — Jobs that include this key stage.
- query `urgent` (optional): `boolean` — true: only jobs whose listing expires within 2 days.
- HTTP 200: Jobs fetched successfully — `ApiResponseDto & { data: PaginatedJobsResponseDto }`.

### GET /api/jobs/mine

- Access: Bearer: INSTITUTION, ADMIN.
- Source: `src/modules/jobs/jobs.controller.ts:45`.
- Controller parameters: `@CurrentUser() user: AuthUser, @Query() query: ListMyJobsQueryDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: List the jobs the signed-in user posted, drafts included
- query `jobType` (optional): `string [INSTANT, BRIEF]`.
- query `page` (optional): `Object`.
- query `limit` (optional): `Object`.
- query `search` (optional): `string` — Matches the title, description, subject, town, county, postcode or a required skill.
- query `subject` (optional): `string` — Exact subject, ignoring case.
- query `keyStage` (optional): `string` — Jobs that include this key stage.
- query `urgent` (optional): `boolean` — true: only jobs whose listing expires within 2 days.
- query `status` (optional): `string [DRAFT, ACTIVE, RESERVED, EXPIRED, FILLED, CLOSED, SUSPENDED]`.
- HTTP 200: Jobs fetched successfully — `ApiResponseDto & { data: MyJobsResponseDto }`.
- HTTP 403: An institution or admin role is required.

### GET /api/jobs/mine/:id

- Access: Bearer: INSTITUTION, ADMIN.
- Source: `src/modules/jobs/jobs.controller.ts:55`.
- Controller parameters: `@Param('id') id: string, @CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: One of the signed-in user's own jobs, in any status (for editing)
- path `id` (required): `string`.
- HTTP 200: Job fetched successfully — `ApiResponseDto & { data: JobResponseDto }`.
- HTTP 404: No such job, or it belongs to someone else.

### GET /api/matching/jobs/:jobId/applications

- Access: Bearer: INSTITUTION, ADMIN.
- Source: `src/modules/matching/matching.controller.ts:37`.
- Controller parameters: `@Param('jobId') jobId: string, @Query() query: MatchListQueryDto, @CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Rank the applicants for a job by match score (job poster or admin)
- path `jobId` (required): `string`.
- query `minScore` (optional): `Object` — Hide matches scoring below this.
- query `page` (optional): `Object`.
- query `limit` (optional): `Object`.
- HTTP 200: Ranked applications fetched successfully — `ApiResponseDto & { data: PaginatedRankedApplicationsResponseDto }`.
- HTTP 403: You can only view matches for your own job postings.
- HTTP 404: Job not found.

### GET /api/matching/jobs/:jobId/instructors

- Access: Bearer: INSTITUTION, ADMIN.
- Source: `src/modules/matching/matching.controller.ts:58`.
- Controller parameters: `@Param('jobId') jobId: string, @Query() query: MatchListQueryDto, @CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Recommend instructors for a job (job poster or admin)
- path `jobId` (required): `string`.
- query `minScore` (optional): `Object` — Hide matches scoring below this.
- query `page` (optional): `Object`.
- query `limit` (optional): `Object`.
- HTTP 200: Recommended instructors fetched successfully — `ApiResponseDto & { data: PaginatedRecommendedInstructorsResponseDto }`.
- HTTP 403: You can only view matches for your own job postings.
- HTTP 404: Job not found.

### GET /api/matching/jobs/:jobId/score

- Access: Bearer: INSTRUCTOR.
- Source: `src/modules/matching/matching.controller.ts:84`.
- Controller parameters: `@Param('jobId') jobId: string, @CurrentUser('id') userId: string`.
- Return annotation: `inferred; see controller/service`.
- Purpose: The signed-in instructor's match score for one job, with the factor breakdown
- path `jobId` (required): `string`.
- HTTP 200: Match score fetched successfully — `ApiResponseDto & { data: MatchScoreDto }`.
- HTTP 403: An instructor profile is required.
- HTTP 404: Job not found.

### GET /api/matching/jobs/recommended

- Access: Bearer: INSTRUCTOR.
- Source: `src/modules/matching/matching.controller.ts:21`.
- Controller parameters: `@Query() query: MatchListQueryDto, @CurrentUser('id') userId: string`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Recommend live jobs to the signed-in instructor
- query `minScore` (optional): `Object` — Hide matches scoring below this.
- query `page` (optional): `Object`.
- query `limit` (optional): `Object`.
- HTTP 200: Recommended jobs fetched successfully — `ApiResponseDto & { data: PaginatedRecommendedJobsResponseDto }`.
- HTTP 403: An instructor profile is required.

### GET /api/notifications

- Access: Bearer; see service access rules.
- Source: `src/modules/notifications/notifications.controller.ts:16`.
- Controller parameters: `@CurrentUser('id') userId: string, @Query() query: ListNotificationsQueryDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: My notifications, newest first
- query `page` (optional): `Object`.
- query `limit` (optional): `Object`.
- query `unread` (optional): `boolean` — true: only unread notifications.
- HTTP 200: Notifications fetched successfully — `ApiResponseDto & { data: PaginatedNotificationsResponseDto }`.

### POST /api/notifications/:id/read

- Access: Bearer; see service access rules.
- Source: `src/modules/notifications/notifications.controller.ts:53`.
- Controller parameters: `@Param('id') id: string, @CurrentUser('id') userId: string`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Mark one notification as read
- path `id` (required): `string`.
- HTTP 200: Notification marked as read — `ApiResponseDto & { data: NotificationResponseDto }`.
- HTTP 404: Notification not found.

### GET /api/notifications/preferences

- Access: Bearer; see service access rules.
- Source: `src/modules/notifications/notifications.controller.ts:39`.
- Controller parameters: `@CurrentUser('id') userId: string`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Which optional emails I get
- HTTP 200: Notification settings fetched successfully — `ApiResponseDto & { data: NotificationPreferencesDto }`.

### PATCH /api/notifications/preferences

- Access: Bearer; see service access rules.
- Source: `src/modules/notifications/notifications.controller.ts:46`.
- Controller parameters: `@CurrentUser('id') userId: string, @Body() dto: UpdateNotificationPreferencesDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Change which optional emails I get
- Body application/json: `UpdateNotificationPreferencesDto`.
- HTTP 200: Notification settings saved — `ApiResponseDto & { data: NotificationPreferencesDto }`.

### POST /api/notifications/read-all

- Access: Bearer; see service access rules.
- Source: `src/modules/notifications/notifications.controller.ts:31`.
- Controller parameters: `@CurrentUser('id') userId: string`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Mark all my notifications as read
- HTTP 200: Notifications marked as read — `ApiResponseDto & { data: NotificationsReadAllResponseDto }`.

### GET /api/notifications/unread-count

- Access: Bearer; see service access rules.
- Source: `src/modules/notifications/notifications.controller.ts:24`.
- Controller parameters: `@CurrentUser('id') userId: string`.
- Return annotation: `inferred; see controller/service`.
- Purpose: How many notifications are unread, for the bell badge
- HTTP 200: Unread count fetched successfully — `ApiResponseDto & { data: NotificationUnreadCountDto }`.

### POST /api/payments/booking-tips/:id/refund

- Access: Bearer: ADMIN.
- Source: `src/modules/payments/payments.controller.ts:142`.
- Controller parameters: `@Param('id', ParseUUIDPipe) id: string, @Body() dto: RefundInvoiceDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Refund a paid booking tip and reverse the destination transfer
- path `id` (required): `string`.
- Body application/json: `RefundInvoiceDto`.
- HTTP 200: .

### POST /api/payments/booking-tips/:id/sync

- Access: Bearer: INSTITUTION.
- Source: `src/modules/payments/payments.controller.ts:133`.
- Controller parameters: `@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SyncBookingTipDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Verify a returned tip Checkout Session on the server
- path `id` (required): `string`.
- Body application/json: `SyncBookingTipDto`.
- HTTP 200: .

### POST /api/payments/booking-tips/checkout

- Access: Bearer: INSTITUTION.
- Source: `src/modules/payments/payments.controller.ts:122`.
- Controller parameters: `@CurrentUser() user: AuthUser, @Body() dto: CreateBookingTipDto`.
- Return annotation: `Promise<BookingTipCheckoutResponseDto>`.
- Purpose: Create or resume Stripe Checkout for a completed booking tip
- Body application/json: `CreateBookingTipDto`.
- HTTP 201: .

### GET /api/payments/payout-account

- Access: Bearer: INSTRUCTOR.
- Source: `src/modules/payments/payments.controller.ts:178`.
- Controller parameters: `@CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: The teacher's payout setup
- HTTP 200: Payout account fetched successfully — `ApiResponseDto & { data: PayoutAccountResponseDto }`.
- HTTP 403: An instructor profile is required.

### GET /api/payments/payout-account/balance

- Access: Bearer: INSTRUCTOR.
- Source: `src/modules/payments/payments.controller.ts:162`.
- Controller parameters: `@CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: The teacher's Stripe balance: pending, available, and what can be withdrawn instantly
- HTTP 200: Balance fetched successfully — `ApiResponseDto & { data: PayoutBalanceResponseDto }`.
- HTTP 503: Payments are not configured, or Stripe is unavailable.

### POST /api/payments/payout-account/dashboard-link

- Access: Bearer: INSTRUCTOR.
- Source: `src/modules/payments/payments.controller.ts:204`.
- Controller parameters: `@CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: A one-time login to the teacher's Stripe Express dashboard
- HTTP 200: Dashboard link created — `ApiResponseDto & { data: StripeLinkResponseDto }`.
- HTTP 400: Payout setup is not finished, or the account has no Stripe dashboard.
- HTTP 503: Payments are not configured, or Stripe is unavailable.

### POST /api/payments/payout-account/instant-payout

- Access: Bearer: INSTRUCTOR.
- Source: `src/modules/payments/payments.controller.ts:170`.
- Controller parameters: `@CurrentUser() user: AuthUser, @Body() dto: InstantPayoutDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Withdraw earnings now (Stripe Instant Payout)
- Body application/json: `InstantPayoutDto`.
- HTTP 201: Withdrawal on its way — `ApiResponseDto & { data: PayoutSummaryDto }`.
- HTTP 400: Payouts not set up, nothing to withdraw, below £0.40, or no instant-capable account.
- HTTP 502: Stripe rejected the request.
- HTTP 503: Payments are not configured, or Stripe is unavailable.

### POST /api/payments/payout-account/onboarding-link

- Access: Bearer: INSTRUCTOR.
- Source: `src/modules/payments/payments.controller.ts:195`.
- Controller parameters: `@CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Start or continue the teacher's payout setup on Stripe's hosted pages
- HTTP 200: Onboarding link created — `ApiResponseDto & { data: StripeLinkResponseDto }`.
- HTTP 403: An instructor profile is required.
- HTTP 502: Stripe rejected the request.
- HTTP 503: Payments are not configured, or Stripe is unavailable.

### POST /api/payments/payout-account/session

- Access: Bearer: INSTRUCTOR.
- Source: `src/modules/payments/payments.controller.ts:186`.
- Controller parameters: `@CurrentUser() user: AuthUser`.
- Return annotation: `Promise<PayoutSessionResponseDto>`.
- Purpose: Start the teacher's in-app payout session (Stripe Connect embedded components)
- HTTP 200: Payouts session created — `ApiResponseDto & { data: PayoutSessionResponseDto }`.
- HTTP 403: An instructor profile is required.
- HTTP 502: Stripe rejected the request.
- HTTP 503: Payments are not configured, or Stripe is unavailable.

### GET /api/payments/payout-accounts/instructor/:instructorId

- Access: Bearer: ADMIN.
- Source: `src/modules/payments/payments.controller.ts:213`.
- Controller parameters: `@Param('instructorId') instructorId: string`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Admin: a teacher's payout setup
- path `instructorId` (required): `string`.
- HTTP 200: Payout account fetched successfully — `ApiResponseDto & { data: PayoutAccountResponseDto }`.
- HTTP 404: Instructor not found.

### GET /api/payments/school-billing

- Access: Bearer: INSTITUTION.
- Source: `src/modules/payments/payments.controller.ts:64`.
- Controller parameters: `@CurrentUser() user: AuthUser`.
- Return annotation: `Promise<SchoolBillingSettingsResponseDto>`.
- Purpose: The school's saved card and automatic-payment setting
- HTTP 200: School billing settings fetched — `ApiResponseDto & { data: SchoolBillingSettingsResponseDto }`.

### PATCH /api/payments/school-billing

- Access: Bearer: INSTITUTION.
- Source: `src/modules/payments/payments.controller.ts:95`.
- Controller parameters: `@CurrentUser() user: AuthUser, @Body() dto: UpdateSchoolBillingSettingsDto`.
- Return annotation: `Promise<SchoolBillingSettingsResponseDto>`.
- Purpose: Enable or disable automatic completed-period payments
- Body application/json: `UpdateSchoolBillingSettingsDto`.
- HTTP 200: Billing settings updated — `ApiResponseDto & { data: SchoolBillingSettingsResponseDto }`.
- HTTP 400: No ready saved card or missing automatic-payment authorisation.

### DELETE /api/payments/school-billing/payment-method

- Access: Bearer: INSTITUTION.
- Source: `src/modules/payments/payments.controller.ts:106`.
- Controller parameters: `@CurrentUser() user: AuthUser`.
- Return annotation: `Promise<SchoolBillingSettingsResponseDto>`.
- Purpose: Disable automation and detach the school payment method
- HTTP 200: Payment method removed — `ApiResponseDto & { data: SchoolBillingSettingsResponseDto }`.
- HTTP 503: Payments are not configured, or Stripe is unavailable.

### POST /api/payments/school-billing/setup-session

- Access: Bearer: INSTITUTION.
- Source: `src/modules/payments/payments.controller.ts:72`.
- Controller parameters: `@CurrentUser() user: AuthUser, @Body() dto: CreateSchoolBillingSetupDto`.
- Return annotation: `Promise<SchoolBillingSetupSessionResponseDto>`.
- Purpose: Authorise and securely save or replace the school card
- Body application/json: `CreateSchoolBillingSetupDto`.
- HTTP 201: Payment setup started — `ApiResponseDto & { data: SchoolBillingSetupSessionResponseDto }`.
- HTTP 502: Stripe rejected the request.
- HTTP 503: Payments are not configured, or Stripe is unavailable.

### POST /api/payments/school-billing/sync

- Access: Bearer: INSTITUTION.
- Source: `src/modules/payments/payments.controller.ts:83`.
- Controller parameters: `@CurrentUser() user: AuthUser, @Body() dto: SyncSchoolBillingSetupDto`.
- Return annotation: `Promise<SchoolBillingSettingsResponseDto>`.
- Purpose: Refresh payment setup after Stripe redirects back
- Body application/json: `SyncSchoolBillingSetupDto`.
- HTTP 200: Payment setup refreshed — `ApiResponseDto & { data: SchoolBillingSettingsResponseDto }`.
- HTTP 404: Setup session not found for this school.
- HTTP 503: Payments are not configured, or Stripe is unavailable.

### POST /api/payments/webhooks/stripe

- Access: Public.
- Source: `src/modules/payments/payments.controller.ts:231`.
- Controller parameters: `@Req() request: RawBodyRequest<Request>, @Headers('stripe-signature') signature?: string`.
- Return annotation: `inferred; see controller/service`.
- Not present in the fetched OpenAPI snapshot; controller/service contract is authoritative.

### GET /api/profile-completion/me

- Access: Bearer: INSTRUCTOR, INSTITUTION.
- Source: `src/modules/profile-completion/profile-completion.controller.ts:14`.
- Controller parameters: `@CurrentUser('id') userId: string`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Calculate, persist and return the signed-in user profile completion
- HTTP 200: .

### GET /api/profile-documents

- Access: Bearer: INSTRUCTOR, INSTITUTION.
- Source: `src/modules/profile-documents/profile-documents.controller.ts:25`.
- Controller parameters: `@CurrentUser() user: AuthUser`.
- Return annotation: `Promise<ProfileDocumentResponseDto[]>`.
- HTTP 200: .

### POST /api/profile-documents

- Access: Bearer: INSTRUCTOR, INSTITUTION.
- Source: `src/modules/profile-documents/profile-documents.controller.ts:30`.
- Controller parameters: `@CurrentUser() user: AuthUser, @Body() dto: CreateProfileDocumentDto`.
- Return annotation: `inferred; see controller/service`.
- Body application/json: `CreateProfileDocumentDto`.
- HTTP 201: .

### DELETE /api/profile-documents/:id

- Access: Bearer: INSTRUCTOR, INSTITUTION.
- Source: `src/modules/profile-documents/profile-documents.controller.ts:42`.
- Controller parameters: `@CurrentUser() user: AuthUser, @Param('id') id: string`.
- Return annotation: `inferred; see controller/service`.
- path `id` (required): `string`.
- HTTP 204: .

### PATCH /api/profile-documents/:id

- Access: Bearer: INSTRUCTOR, INSTITUTION.
- Source: `src/modules/profile-documents/profile-documents.controller.ts:36`.
- Controller parameters: `@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateProfileDocumentDto`.
- Return annotation: `inferred; see controller/service`.
- path `id` (required): `string`.
- Body application/json: `UpdateProfileDocumentDto`.
- HTTP 200: .

### POST /api/profile-documents/:id/upload-complete

- Access: Bearer: INSTRUCTOR, INSTITUTION.
- Source: `src/modules/profile-documents/profile-documents.controller.ts:57`.
- Controller parameters: `@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CompleteProfileDocumentUploadDto`.
- Return annotation: `inferred; see controller/service`.
- path `id` (required): `string`.
- Body application/json: `CompleteProfileDocumentUploadDto`.
- HTTP 201: .

### POST /api/profile-documents/:id/upload-url

- Access: Bearer: INSTRUCTOR, INSTITUTION.
- Source: `src/modules/profile-documents/profile-documents.controller.ts:48`.
- Controller parameters: `@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ProfileDocumentUploadUrlDto`.
- Return annotation: `Promise<ProfileDocumentUploadUrlResponseDto>`.
- path `id` (required): `string`.
- Body application/json: `ProfileDocumentUploadUrlDto`.
- HTTP 201: .

### POST /api/reviews

- Access: Bearer: INSTRUCTOR, INSTITUTION.
- Source: `src/modules/reviews/reviews.controller.ts:19`.
- Controller parameters: `@Body() dto: CreateReviewDto, @CurrentUser() user: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Review the other party on a completed booking
- Body application/json: `CreateReviewDto`.
- HTTP 201: Review submitted successfully — `ApiResponseDto & { data: ReviewResponseDto }`.
- HTTP 400: The booking is not completed, or the review window has closed.
- HTTP 403: Only the instructor or institution on this booking can review it.
- HTTP 404: Booking not found.
- HTTP 409: You have already reviewed this booking.

### DELETE /api/reviews/:id

- Access: Bearer: ADMIN.
- Source: `src/modules/reviews/reviews.controller.ts:47`.
- Controller parameters: `@Param('id') id: string`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Delete a review (admin moderation); the reviewee's rating is recalculated
- path `id` (required): `string`.
- HTTP 200: Review deleted successfully — `ApiResponseDto & { data: ReviewResponseDto }`.
- HTTP 404: Review not found.

### GET /api/reviews/institution/:institutionId

- Access: Bearer; see service access rules.
- Source: `src/modules/reviews/reviews.controller.ts:37`.
- Controller parameters: `@Param('institutionId') institutionId: string, @Query() query: ListReviewsQueryDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Reviews instructors have left about an institution
- path `institutionId` (required): `string`.
- query `page` (optional): `Object`.
- query `limit` (optional): `Object`.
- HTTP 200: Reviews fetched successfully — `ApiResponseDto & { data: PaginatedReviewsResponseDto }`.

### GET /api/reviews/instructor/:instructorId

- Access: Bearer; see service access rules.
- Source: `src/modules/reviews/reviews.controller.ts:27`.
- Controller parameters: `@Param('instructorId') instructorId: string, @Query() query: ListReviewsQueryDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Reviews institutions have left about an instructor
- path `instructorId` (required): `string`.
- query `page` (optional): `Object`.
- query `limit` (optional): `Object`.
- HTTP 200: Reviews fetched successfully — `ApiResponseDto & { data: PaginatedReviewsResponseDto }`.

### GET /api/signatory-approvals

- Access: Bearer: ADMIN.
- Source: `src/modules/signatory-approvals/signatory-approvals.controller.ts:95`.
- Controller parameters: `@Query() query: ListSignatoryApprovalsQueryDto`.
- Return annotation: `Promise<PaginatedSignatoryApprovalsResponseDto>`.
- Purpose: List signatory approval requests (admin)
- query `status` (optional): `string [PENDING, APPROVED, DECLINED, EXPIRED, REVOKED]`.
- query `institutionId` (optional): `string`.
- query `trustId` (optional): `string`.
- query `page` (optional): `Object`.
- query `limit` (optional): `Object`.
- HTTP 200: Signatory approvals fetched successfully — `ApiResponseDto & { data: PaginatedSignatoryApprovalsResponseDto }`.

### POST /api/signatory-approvals/:id/override-approve

- Access: Bearer: ADMIN.
- Source: `src/modules/signatory-approvals/signatory-approvals.controller.ts:109`.
- Controller parameters: `@Param('id') id: string, @CurrentUser() admin: AuthUser`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Approve on the signatory’s behalf after verifying offline (admin)
- path `id` (required): `string`.
- HTTP 200: Signatory approval recorded — `ApiResponseDto & { data: SignatoryApprovalResponseDto }`.
- HTTP 404: Signatory approval not found.
- HTTP 409: Not the current request, or it cannot be approved.

### GET /api/signatory-approvals/token/:token

- Access: Public.
- Source: `src/modules/signatory-approvals/signatory-approvals.controller.ts:54`.
- Controller parameters: `@Param('token') token: string`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Public: what the signatory is asked to approve (reached through the emailed link)
- path `token` (required): `string`.
- HTTP 200: Approval request fetched successfully — `ApiResponseDto & { data: SignatoryApprovalReviewDto }`.
- HTTP 404: This approval link is not valid.

### POST /api/signatory-approvals/token/:token/approve

- Access: Public.
- Source: `src/modules/signatory-approvals/signatory-approvals.controller.ts:62`.
- Controller parameters: `@Param('token') token: string, @Body() _dto: ApproveSignatoryRequestDto, @Ip() ip: string, @Headers('user-agent') userAgent?: string`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Public: the signatory approves the school and accepts the terms
- path `token` (required): `string`.
- header `user-agent` (required): `string`.
- Body application/json: `ApproveSignatoryRequestDto`.
- HTTP 200: School approved — `ApiResponseDto & { data: SignatoryApprovalReviewDto }`.
- HTTP 400: acceptTerms must be true.
- HTTP 404: This approval link is not valid.
- HTTP 409: The request was already decided or replaced.
- HTTP 410: The link has expired.

### POST /api/signatory-approvals/token/:token/decline

- Access: Public.
- Source: `src/modules/signatory-approvals/signatory-approvals.controller.ts:79`.
- Controller parameters: `@Param('token') token: string, @Body() dto: DeclineSignatoryRequestDto, @Ip() ip: string, @Headers('user-agent') userAgent?: string`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Public: the signatory declines the school, with a reason
- path `token` (required): `string`.
- header `user-agent` (required): `string`.
- Body application/json: `DeclineSignatoryRequestDto`.
- HTTP 200: Request declined — `ApiResponseDto & { data: SignatoryApprovalReviewDto }`.
- HTTP 404: This approval link is not valid.
- HTTP 409: The request was already decided or replaced.
- HTTP 410: The link has expired.

### GET /api/teaching-catalogue

- Access: Public.
- Source: `src/modules/teaching-catalogue/teaching-catalogue.module.ts:38`.
- Controller parameters: `@Query() query: TeachingCatalogueQueryDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: All teacher subjects and skills, optionally filtered by school type during onboarding
- query `schoolType` (optional): `string [PRIMARY, SECONDARY]` — Filter subjects and skills for school onboarding. Omit for the complete teacher profile catalogue..
- HTTP 200: .

### GET /api/teaching-catalogue/school

- Access: Bearer: INSTITUTION.
- Source: `src/modules/teaching-catalogue/teaching-catalogue.module.ts:21`.
- Controller parameters: `@CurrentUser('id') userId: string`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Subjects and skills filtered by the signed-in school's onboarding type
- HTTP 200: .

### GET /api/users

- Access: Bearer: ADMIN.
- Source: `src/modules/users/users.controller.ts:68`.
- Controller parameters: `@Query() query: ListUsersQueryDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: List users (admin)
- query `page` (optional): `Object`.
- query `limit` (optional): `Object`.
- query `search` (optional): `string` — Case-insensitive email or name search.
- query `role` (optional): `string [INSTRUCTOR, INSTITUTION, ADMIN]`.
- query `accountType` (optional): `string [ADMIN, USERS]` — Admins only, or every non-admin role.
- query `profileStatus` (optional): `string [INCOMPLETE, PENDING, ACTIVE, SUSPENDED, DEACTIVATED, REJECTED]` — Filter by the status of the role profile.
- query `status` (optional): `string [INCOMPLETE, PENDING, ACTIVE, SUSPENDED, DEACTIVATED, REJECTED]` — Alias for profileStatus.
- query `countries` (optional): `string` — Comma-separated ISO country codes from the role profile.
- query `emailVerified` (optional): `boolean`.
- query `phoneVerified` (optional): `boolean`.
- query `createdFrom` (optional): `string` — Inclusive creation date/time (UTC for date-only values).
- query `createdTo` (optional): `string` — Inclusive creation date/time; date-only values include the whole UTC day.
- query `joined` (optional): `string` — Joined on this UTC date; use instead of createdFrom/createdTo.
- query `sortBy` (optional): `string [createdAt, joined, lastLogin]`.
- query `sortOrder` (optional): `string [asc, desc]`.
- HTTP 200: Users fetched successfully — `ApiResponseDto & { data: PaginatedUsersResponseDto }`.
- HTTP 401: Missing or invalid access token.
- HTTP 403: Admin role is required.

### GET /api/users/:id

- Access: Bearer: ADMIN.
- Source: `src/modules/users/users.controller.ts:89`.
- Controller parameters: `@Param('id') id: string`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Get private account by ID (admin only)
- path `id` (required): `string`.
- HTTP 200: User fetched successfully — `ApiResponseDto & { data: UserResponseDto }`.
- HTTP 401: Missing or invalid access token.
- HTTP 403: Admin role is required. Use GET /users/me for your own account..
- HTTP 404: User not found.

### POST /api/users/admin

- Access: Bearer: ADMIN.
- Source: `src/modules/users/users.controller.ts:60`.
- Controller parameters: `@Body() dto: AdminCreateUserDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Create user (admin)
- Body application/json: `AdminCreateUserDto`.
- HTTP 201: User created successfully — `ApiResponseDto & { data: UserResponseDto }`.
- HTTP 400: Invalid account details or verified phone without a phone number.
- HTTP 401: Missing or invalid access token.
- HTTP 403: Admin role is required.
- HTTP 409: Email is already registered.

### DELETE /api/users/admin/:id

- Access: Bearer: ADMIN.
- Source: `src/modules/users/users.controller.ts:118`.
- Controller parameters: `@Param('id', new ParseUUIDPipe()) id: string`.
- Return annotation: `Promise<void>`.
- Purpose: Delete user (admin)
- path `id` (required): `string`.
- HTTP 200: User deleted successfully — `ApiResponseDto & { data: unknown or null }`.
- HTTP 400: User ID must be a valid UUID.
- HTTP 401: Missing or invalid access token.
- HTTP 403: Admin role is required.
- HTTP 404: User not found.
- HTTP 409: User has related records and cannot be deleted.

### PATCH /api/users/admin/:id

- Access: Bearer: ADMIN.
- Source: `src/modules/users/users.controller.ts:108`.
- Controller parameters: `@Param('id', new ParseUUIDPipe()) id: string, @Body() updateUserDto: AdminUpdateUserDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Admin update user
- path `id` (required): `string`.
- Body application/json: `AdminUpdateUserDto`.
- HTTP 200: User updated successfully — `ApiResponseDto & { data: UserResponseDto }`.
- HTTP 401: Missing or invalid access token.
- HTTP 403: Admin role is required.
- HTTP 404: User not found.

### GET /api/users/me

- Access: Bearer; see service access rules.
- Source: `src/modules/users/users.controller.ts:81`.
- Controller parameters: `@CurrentUser('id') userId: string`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Get your own private account
- HTTP 200:  — `UserResponseDto`.
- HTTP 401: Missing or invalid access token.

### PATCH /api/users/me

- Access: Bearer; see service access rules.
- Source: `src/modules/users/users.controller.ts:99`.
- Controller parameters: `@CurrentUser('id') userId: string, @Body() updateUserDto: UpdateUserDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Update authenticated user
- Body application/json: `UpdateUserDto`.
- HTTP 200: User updated successfully — `ApiResponseDto & { data: UserResponseDto }`.
- HTTP 401: Missing or invalid access token.
- HTTP 404: User not found.

### GET /api/users/me/profile-image

- Access: Bearer: INSTRUCTOR, INSTITUTION.
- Source: `src/modules/users/users.controller.ts:52`.
- Controller parameters: `@CurrentUser() user: AuthUser`.
- Return annotation: `Promise<ProfileImageResponseDto>`.
- Purpose: Get a signed URL for your profile image
- HTTP 200: Profile image URL — `ApiResponseDto & { data: ProfileImageResponseDto }`.
- HTTP 401: Missing or invalid access token.

### POST /api/users/me/profile-image/upload-complete

- Access: Bearer: INSTRUCTOR, INSTITUTION.
- Source: `src/modules/users/users.controller.ts:41`.
- Controller parameters: `@CurrentUser() user: AuthUser, @Body() dto: CompleteProfileImageUploadDto`.
- Return annotation: `Promise<ProfileImageResponseDto>`.
- Purpose: Confirm upload and replace your profile image
- Body application/json: `CompleteProfileImageUploadDto`.
- HTTP 200: Profile image updated — `ApiResponseDto & { data: ProfileImageResponseDto }`.
- HTTP 400: Missing, invalid or oversized image.
- HTTP 401: Missing or invalid access token.
- HTTP 409: Profile image changed during upload.

### POST /api/users/me/profile-image/upload-url

- Access: Bearer: INSTRUCTOR, INSTITUTION.
- Source: `src/modules/users/users.controller.ts:33`.
- Controller parameters: `@CurrentUser() user: AuthUser, @Body() dto: ProfileImageUploadUrlDto`.
- Return annotation: `inferred; see controller/service`.
- Purpose: Create a signed PUT URL for your profile image
- Body application/json: `ProfileImageUploadUrlDto`.
- HTTP 200: Upload URL created — `ApiResponseDto & { data: UploadUrlResponseDto }`.
- HTTP 401: Missing or invalid access token.
- HTTP 403: An instructor or institution profile is required.

### POST /api/webhooks/trustid

- Access: Public.
- Source: `src/modules/identity-verification/identity-verification.controller.ts:144`.
- Controller parameters: `@Headers('authorization') authorization: string \| undefined, @Body() body: unknown`.
- Return annotation: `inferred; see controller/service`.
- Not present in the fetched OpenAPI snapshot; controller/service contract is authoritative.

<a id="schema-reference"></a>

# Appendix C — Request and response field reference

The OpenAPI schema tables are a transport reference, with DTO validation constraints added directly from source below each schema. The Nest global validation pipe rejects unknown request properties. Do not send response fields back wholesale. DTO fields with `@IsOptional()` are optional even if an imperfect OpenAPI schema says required; inherited DTOs inherit rules. `IsOptional` also skips null validation, but endpoint business logic may reject null. Empty string is not generally equivalent to omission. All TypeScript enum names refer to Appendix D or the domain chapters.

### DropdownOptionInput

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `key` | string | yes | example="mathematics" |
| `value` | string | yes | Immutable value submitted in profile/job requests.; example="Mathematics" |
| `label` | string | yes | example="Mathematics" |
| `aliases` | Array<string> | no |  |
| `group` | object or null | no | example="Core Subjects" |
| `sortOrder` | number | no |  |
| `isActive` | boolean | no |  |
| `isShared` | boolean | no | Skill available for every subject selection. |
| `subjectKeys` | Array<string> | no | example=["mathematics"] |
| `schoolTypes` | Array<string [PRIMARY, SECONDARY]> | no | School phases where this subject or skill is available. |
| `primarySubjectKeys` | Array<string> | no | Subject keys linked to this skill in primary schools. |
| `secondarySubjectKeys` | Array<string> | no | Subject keys linked to this skill in secondary schools. |

### UpdateDropdownDto

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `revision` | number | yes | Revision from the most recent GET; rejects stale writes.; example=1 |
| `label` | string | no |  |
| `isActive` | boolean | no |  |
| `options` | Array<DropdownOptionInput> | no | Upsert only these entries; omitted options are retained. |

### DeleteDropdownDto

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `revision` | number | yes | example=1 |
| `optionKeys` | Array<string> | no | Retire these options. Omit to retire the entire dropdown. |

### ResponseMetadataDto

Source: `src/common/dto/api-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `requestId` | string | yes | example="7cb8c09a-7687-480f-9f74-6f5f6cbaf9dd" |
| `timestamp` | string | yes | example="2026-07-23T10:15:30.000Z" |
| `path` | string | yes | example="/documents" |
| `method` | string | yes | example="GET" |

Source validation/defaults (override generated documentation where inconsistent):

- `requestId: string`.
- `timestamp: string`.
- `path: string`.
- `method: string`.

### ApiResponseDto

Source: `src/common/dto/api-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `success` | boolean | yes | example=true |
| `statusCode` | number | yes | example=200 |
| `message` | string | yes | example="Success" |
| `data` | object | yes |  |
| `meta` | ResponseMetadataDto | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `success: boolean`.
- `statusCode: number`.
- `message: string`.
- `data: TData \| null`.
- `meta: ResponseMetadataDto`.

### InstitutionTrustDto

Source: `src/modules/institutions/dto/institution-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `name` | string | yes | example="Oak Learning Trust" |
| `companyNumber` | object or null | no | example="08123456" |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `name: string`.
- `companyNumber: string \| null`.

### InstitutionResponseDto

Source: `src/modules/institutions/dto/institution-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `userId` | string | yes |  |
| `name` | string | yes |  |
| `schoolType` | string [PRIMARY, SECONDARY] or null | no | example="PRIMARY" |
| `imageUrl` | object | no |  |
| `registrationId` | object | no |  |
| `domain` | string | yes | example="greenfield.ac.uk" |
| `address` | string | yes | example="1 School Lane" |
| `city` | string | yes | example="London" |
| `county` | object or null | no | example="Greater London" |
| `postalCode` | object or null | no | example="SW1A 2AA" |
| `countryCode` | string | yes | example="GB" |
| `latitude` | object or null | no | Set by geocoding from the postcode; not client-supplied; example=51.5014 |
| `longitude` | object or null | no | Set by geocoding from the postcode; not client-supplied; example=-0.1419 |
| `staffingNeeds` | Array<string> | yes | Catalogue subjects the school needs.; example=["Mathematics","Science"] |
| `coverTypes` | Array<string> | no | example=["Same-day cover","Long-term roles"] |
| `typicalPupilCount` | object or null | no | example=420 |
| `complianceContact` | object or null | no | example="Jane Smith" |
| `complianceEmail` | object or null | no | example="safeguarding@greenfield.ac.uk" |
| `safeguardingConfirmed` | boolean | yes | example=true |
| `complianceApprovalRequired` | boolean | yes | Whether single-school compliance approval is required |
| `userRole` | object or null | no | example="Headteacher" |
| `verified` | boolean | yes | example=false |
| `subscriptionTier` | object or null | no | example="PRO" |
| `status` | string [INCOMPLETE, PENDING, ACTIVE, SUSPENDED, DEACTIVATED, REJECTED] | yes | example="INCOMPLETE" |
| `institutionType` | string [SINGLE_SCHOOL, MAT_SCHOOL] | yes | example="SINGLE_SCHOOL" |
| `trust` | InstitutionTrustDto | no | Set for MAT schools only |
| `createdAt` | string | no | format="date-time"; example="2026-06-14T00:00:00.000Z" |
| `updatedAt` | string | no | format="date-time"; example="2026-06-14T00:00:00.000Z" |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `userId: string`.
- `name: string`.
- `schoolType: SchoolType \| null`.
- `imageUrl?: string \| null`.
- `registrationId?: string \| null`.
- `domain: string`.
- `address: string`.
- `city: string`.
- `county?: string \| null`.
- `postalCode?: string \| null`.
- `countryCode: string`.
- `latitude?: number \| null`.
- `longitude?: number \| null`.
- `staffingNeeds: string[]`.
- `coverTypes: string[]`.
- `typicalPupilCount?: number \| null`.
- `complianceContact?: string \| null`.
- `complianceEmail?: string \| null`.
- `safeguardingConfirmed: boolean`.
- `complianceApprovalRequired: boolean`.
- `userRole?: string \| null`.
- `verified: boolean`.
- `subscriptionTier?: string \| null`.
- `status: ProfileStatus`.
- `institutionType: InstitutionType`.
- `trust: InstitutionTrustDto \| null`.
- `createdAt?: Date`.
- `updatedAt?: Date`.

### TrustInputDto

Source: `src/modules/institutions/dto/trust-input.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `name` | string | yes | maxLength=200; example="Oak Learning Trust" |
| `companyNumber` | string | no | The trust's Companies House number. Schools entering the same number join the same trust; without it a new trust is created.; example="08123456" |

Source validation/defaults (override generated documentation where inconsistent):

- `name: string` — `@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @IsNotEmpty() @MaxLength(200)`.
- `companyNumber?: string` — `@IsOptional() @Transform(({ value }: { value: unknown }) => normaliseCompanyNumber(value)) @IsString() @Matches(/^(\d{8}\|[A-Z]{2}\d{6})$/, { message: 'companyNumber must be a valid Companies House number' })`.

### CreateInstitutionDto

Source: `src/modules/institutions/dto/create-institution.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `name` | string | yes |  |
| `schoolType` | string [PRIMARY, SECONDARY] | yes | School phase selected during onboarding; controls the subjects and skills available for school jobs.; example="PRIMARY" |
| `imageUrl` | string | no | example="profile.jpg" |
| `registrationId` | string | no |  |
| `domain` | string | yes | example="greenfield.ac.uk" |
| `address` | string | yes |  |
| `city` | string | yes |  |
| `county` | string | no | example="Greater London" |
| `postalCode` | string | no |  |
| `countryCode` | string | no | default="GB"; example="GB" |
| `staffingNeeds` | Array<string> | no | Subjects the school needs, from GET /api/teaching-catalogue. Send an array, not free text. |
| `otherSubjects` | Array<string> | no | Custom staffing subjects when staffingNeeds includes Other. Stored as actual names in staffingNeeds. |
| `coverTypes` | Array<string> | no | example=["Same-day cover","Long-term roles"] |
| `typicalPupilCount` | number | no | minimum=0; example=420 |
| `complianceContact` | string | no | example="Jane Smith" |
| `complianceEmail` | string | no | example="safeguarding@greenfield.ac.uk" |
| `safeguardingConfirmed` | boolean | no | default=false; example=true |
| `userRole` | string | no | example="Headteacher" |
| `institutionType` | string [SINGLE_SCHOOL, MAT_SCHOOL] | no | A MAT school must name its trust and have a trust signatory approve it before submitting; default="SINGLE_SCHOOL" |
| `trust` | TrustInputDto | no | Required for MAT_SCHOOL; not allowed for SINGLE_SCHOOL |

Source validation/defaults (override generated documentation where inconsistent):

- `name: string` — `@IsString() @IsNotEmpty() @MaxLength(200)`.
- `schoolType: SchoolType` — `@IsEnum(SchoolType)`.
- `imageUrl?: string` — `@IsOptional()`.
- `registrationId?: string` — `@IsOptional() @IsString() @MaxLength(100)`.
- `domain: string` — `@IsFQDN({ require_tld: true })`.
- `address: string` — `@IsString() @IsNotEmpty() @MaxLength(250)`.
- `city: string` — `@IsString() @IsNotEmpty() @MaxLength(100)`.
- `county?: string` — `@IsOptional() @IsString() @MaxLength(100)`.
- `postalCode?: string` — `@IsOptional() @IsString() @MaxLength(20)`.
- `countryCode?: string` — `@IsOptional() @IsISO31661Alpha2()`.
- `staffingNeeds?: string[]` — `@IsOptional() @IsArray() @ArrayUnique() @ArrayMaxSize(50) @IsString({ each: true }) @IsNotEmpty({ each: true }) @MaxLength(100, { each: true })`.
- `otherSubjects?: string[]` — `@IsOptional() @IsArray() @ArrayUnique() @ArrayMaxSize(50) @IsString({ each: true }) @IsNotEmpty({ each: true }) @MaxLength(100, { each: true })`.
- `coverTypes?: string[]` — `@IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(100, { each: true })`.
- `typicalPupilCount?: number` — `@IsOptional() @Type(() => Number) @IsInt() @Min(0)`.
- `complianceContact?: string` — `@IsOptional() @IsString() @MaxLength(200)`.
- `complianceEmail?: string` — `@IsOptional() @IsEmail() @MaxLength(254)`.
- `safeguardingConfirmed?: boolean` — `@IsOptional() @IsBoolean()`.
- `userRole?: string` — `@IsOptional() @IsString() @MaxLength(100)`.
- `institutionType?: InstitutionType` — `@IsOptional() @IsEnum(InstitutionType)`.
- `trust?: TrustInputDto` — `@IsOptional() @ValidateNested() @Type(() => TrustInputDto)`.

### PaginationMetaDto

Source: `src/common/dto/pagination.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `page` | number | yes | example=1 |
| `limit` | number | yes | example=20 |
| `total` | number | yes | example=45 |
| `totalPages` | number | yes | example=3 |
| `hasNextPage` | boolean | yes | example=true |

Source validation/defaults (override generated documentation where inconsistent):

- `page: number`.
- `limit: number`.
- `total: number`.
- `totalPages: number`.
- `hasNextPage: boolean`.

### PaginatedInstitutionsResponseDto

Source: `src/modules/institutions/dto/institution-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `institutions` | Array<InstitutionResponseDto> | yes |  |
| `pagination` | PaginationMetaDto | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `institutions: InstitutionResponseDto[]`.
- `pagination: PaginationMetaDto`.

### Object

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|

### InstitutionPublicTrustDto

Source: `src/modules/institutions/dto/institution-public-profile.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `name` | string | yes | example="Oak Learning Trust" |

Source validation/defaults (override generated documentation where inconsistent):

- `name: string`.

### ProfileDocumentResponseDto

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `kind` | string [CERTIFICATE, ACHIEVEMENT] | yes |  |
| `title` | string | yes |  |
| `description` | object or null | no |  |
| `issueDate` | object or null | no | format="date" |
| `originalName` | object or null | no |  |
| `contentType` | object or null | no |  |
| `sizeBytes` | object or null | no |  |
| `fileUrl` | object or null | no | Short-lived signed URL for viewing or downloading the file |
| `fileUrlExpiresAt` | object or null | no |  |
| `createdAt` | string | yes | format="date-time" |
| `updatedAt` | string | yes | format="date-time" |

### InstitutionPublicProfileDto

Source: `src/modules/institutions/dto/institution-public-profile.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `name` | string | yes | example="Oakfield Primary School" |
| `schoolType` | string [PRIMARY, SECONDARY] or null | no |  |
| `imageUrl` | object or null | no |  |
| `institutionType` | string [SINGLE_SCHOOL, MAT_SCHOOL] | yes |  |
| `trust` | InstitutionPublicTrustDto | no |  |
| `address` | string | yes | example="12 Oak Lane" |
| `city` | string | yes | example="Leeds" |
| `county` | object or null | no | example="West Yorkshire" |
| `postalCode` | object or null | no | example="LS1 4AB" |
| `staffingNeeds` | Array<string> | yes | Catalogue subjects the school needs.; example=["Mathematics","Science"] |
| `coverTypes` | Array<string> | yes |  |
| `typicalPupilCount` | object or null | no | example=420 |
| `verified` | boolean | yes | SupplyEd has verified the school |
| `memberSince` | object | no | When it joined SupplyEd |
| `achievements` | Array<ProfileDocumentResponseDto> | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `name: string`.
- `schoolType: SchoolType \| null`.
- `imageUrl: string \| null`.
- `institutionType: InstitutionType`.
- `trust: InstitutionPublicTrustDto \| null`.
- `address: string`.
- `city: string`.
- `county: string \| null`.
- `postalCode: string \| null`.
- `staffingNeeds: string[]`.
- `coverTypes: string[]`.
- `typicalPupilCount: number \| null`.
- `verified: boolean`.
- `memberSince: Date \| null`.
- `achievements: ProfileDocumentResponseDto[]`.

### AdminUpdateProfileStatusDto

Source: `src/common/dto/update-profile-status.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `status` | string [INCOMPLETE, PENDING, ACTIVE, SUSPENDED, DEACTIVATED, REJECTED] | yes | example="ACTIVE" |

Source validation/defaults (override generated documentation where inconsistent):

- `status: (typeof ADMIN_PROFILE_STATUS_TARGETS)[number]` — `@IsIn(ADMIN_PROFILE_STATUS_TARGETS)`.

### UpdateInstitutionDto

Source: `src/modules/institutions/dto/update-institution.dto.ts` — `extends PartialType(CreateInstitutionDto)`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `name` | string | no |  |
| `schoolType` | string [PRIMARY, SECONDARY] | no | School phase selected during onboarding; controls the subjects and skills available for school jobs.; example="PRIMARY" |
| `imageUrl` | string | no | example="profile.jpg" |
| `registrationId` | string | no |  |
| `domain` | string | no | example="greenfield.ac.uk" |
| `address` | string | no |  |
| `city` | string | no |  |
| `county` | string | no | example="Greater London" |
| `postalCode` | string | no |  |
| `countryCode` | string | no | default="GB"; example="GB" |
| `staffingNeeds` | Array<string> | no | Subjects the school needs, from GET /api/teaching-catalogue. Send an array, not free text. |
| `otherSubjects` | Array<string> | no | Custom staffing subjects when staffingNeeds includes Other. Stored as actual names in staffingNeeds. |
| `coverTypes` | Array<string> | no | example=["Same-day cover","Long-term roles"] |
| `typicalPupilCount` | number | no | minimum=0; example=420 |
| `complianceContact` | string | no | example="Jane Smith" |
| `complianceEmail` | string | no | example="safeguarding@greenfield.ac.uk" |
| `safeguardingConfirmed` | boolean | no | default=false; example=true |
| `userRole` | string | no | example="Headteacher" |
| `institutionType` | string [SINGLE_SCHOOL, MAT_SCHOOL] | no | A MAT school must name its trust and have a trust signatory approve it before submitting; default="SINGLE_SCHOOL" |
| `trust` | TrustInputDto | no | Required for MAT_SCHOOL; not allowed for SINGLE_SCHOOL |

### NotificationResponseDto

Source: `src/modules/notifications/dto/notification-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `type` | string [JOB_INVITATION, JOB_INVITATION_STATUS, JOB_MATCH, APPLICATION_RECEIVED, APPLICATION_STATUS, BOOKING_CONFIRMED, BOOKING_CANCELLED, BOOKING_COMPLETED, ATTENDANCE_CONFIRMATION, INVOICE_PAID, INVOICE_PAYMENT_FAILED, PROFILE_STATUS, REVIEW_RECEIVED, IDENTITY_VERIFICATION] | yes |  |
| `title` | string | yes | example="New job match: Year 6 Maths cover" |
| `body` | string | yes | example="Oakfield Primary, Leeds · 92% match" |
| `link` | object or null | no | App page to open; example="/job-detail?jobId=..." |
| `data` | object | yes | Ids and details for the app |
| `readAt` | object or null | no |  |
| `createdAt` | string | yes | format="date-time" |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `type: NotificationType`.
- `title: string`.
- `body: string`.
- `link: string \| null`.
- `data: Record<string, unknown>`.
- `readAt: Date \| null`.
- `createdAt: Date`.

### PaginatedNotificationsResponseDto

Source: `src/modules/notifications/dto/notification-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `notifications` | Array<NotificationResponseDto> | yes |  |
| `pagination` | PaginationMetaDto | yes |  |
| `unreadCount` | number | yes | example=3 |

Source validation/defaults (override generated documentation where inconsistent):

- `notifications: NotificationResponseDto[]`.
- `pagination: PaginationMetaDto`.
- `unreadCount: number`.

### NotificationUnreadCountDto

Source: `src/modules/notifications/dto/notification-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `total` | number | yes | example=3 |

Source validation/defaults (override generated documentation where inconsistent):

- `total: number`.

### NotificationsReadAllResponseDto

Source: `src/modules/notifications/dto/notification-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `updated` | number | yes | How many were marked read; example=3 |

Source validation/defaults (override generated documentation where inconsistent):

- `updated: number`.

### NotificationPreferencesDto

Source: `src/modules/notifications/dto/notification-preferences.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `emailJobMatches` | boolean | yes | Email me jobs that strongly match my profile (teachers) |
| `emailMessages` | boolean | yes | Email me about messages I have not read after a while |
| `emailUpdates` | boolean | yes | Email me about applications, bookings and reviews |

Source validation/defaults (override generated documentation where inconsistent):

- `emailJobMatches: boolean`.
- `emailMessages: boolean`.
- `emailUpdates: boolean`.

### UpdateNotificationPreferencesDto

Source: `src/modules/notifications/dto/notification-preferences.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `emailJobMatches` | boolean | no |  |
| `emailMessages` | boolean | no |  |
| `emailUpdates` | boolean | no |  |

Source validation/defaults (override generated documentation where inconsistent):

- `emailJobMatches?: boolean` — `@IsOptional() @IsBoolean()`.
- `emailMessages?: boolean` — `@IsOptional() @IsBoolean()`.
- `emailUpdates?: boolean` — `@IsOptional() @IsBoolean()`.

### CreateProfileDocumentDto

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `title` | string | yes | maxLength=120 |
| `description` | string | no | maxLength=1000 |
| `issueDate` | string | no | format="date" |

### UpdateProfileDocumentDto

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `title` | string | yes | maxLength=120 |
| `description` | string | no | maxLength=1000 |
| `issueDate` | string | no | format="date" |

### ProfileDocumentUploadUrlDto

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `contentType` | string [application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, image/jpeg, image/png, image/webp] | yes |  |
| `sizeBytes` | number | yes | minimum=1; maximum=10485760 |

### CompleteProfileDocumentUploadDto

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `fileKey` | string | yes |  |
| `originalName` | string | yes | maxLength=255 |

### UserResponseDto

Source: `src/modules/users/dto/user-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes | example="b1b0f2bc-46fd-4f01-8c45-52e2b5fb84da" |
| `email` | string | yes | example="user@example.com" |
| `name` | object or null | no | example="Abdul Waheed" |
| `role` | string [INSTRUCTOR, INSTITUTION, ADMIN] | yes | example="INSTRUCTOR" |
| `emailVerified` | boolean | yes | example=false |
| `phoneVerified` | boolean | yes | example=false |
| `phone` | object or null | no | example="+923001234567" |
| `lastLogin` | object or null | no | example="2026-06-14T00:00:00.000Z" |
| `twoFactorEnabled` | boolean | yes | example=false |
| `createdAt` | string | no | format="date-time"; example="2026-06-14T00:00:00.000Z" |
| `updatedAt` | string | no | format="date-time"; example="2026-06-14T00:00:00.000Z" |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `email: string`.
- `name?: string \| null`.
- `role: Role`.
- `emailVerified: boolean`.
- `phoneVerified: boolean`.
- `phone?: string \| null`.
- `lastLogin?: Date \| null`.
- `twoFactorEnabled: boolean`.
- `createdAt?: Date`.
- `updatedAt?: Date`.

### LoginResponseDto

Source: `src/modules/auth/dto/email-verification-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `user` | UserResponseDto | no |  |
| `accessToken` | string | no | Returned only when the email is verified |
| `refreshToken` | string | no | Returned only when the email is verified |
| `accessTokenExpiresAt` | string | no | Access-token expiry as an ISO-8601 timestamp; example="2026-07-23T10:30:00.000Z" |
| `accessTokenExpiresInSeconds` | number | no | Remaining access-token lifetime in seconds; example=900 |
| `refreshTokenExpiresAt` | string | no | Refresh-token expiry as an ISO-8601 timestamp; example="2026-07-30T10:15:00.000Z" |
| `refreshTokenExpiresInSeconds` | number | no | Remaining refresh-token lifetime in seconds; example=604800 |
| `otpToken` | string | no | OTP token returned when email verification is still required |
| `expiresInMinutes` | number | no | Verification token and OTP lifetime in minutes; example=10 |
| `twoFactorRequired` | boolean | no | True when an authenticator or recovery code is required before tokens are issued |
| `twoFactorToken` | string | no | Short-lived token accepted only by POST /auth/2fa/verify |

Source validation/defaults (override generated documentation where inconsistent):

- `user?: UserResponseDto`.
- `accessToken?: string`.
- `refreshToken?: string`.
- `accessTokenExpiresAt?: string`.
- `accessTokenExpiresInSeconds?: number`.
- `refreshTokenExpiresAt?: string`.
- `refreshTokenExpiresInSeconds?: number`.
- `otpToken?: string`.
- `expiresInMinutes?: number`.
- `twoFactorRequired?: boolean`.
- `twoFactorToken?: string`.

### LoginDto

Source: `src/modules/auth/dto/login.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `email` | string | yes | example="user@example.com" |
| `password` | string | yes | minLength=8; example="password123" |

Source validation/defaults (override generated documentation where inconsistent):

- `email: string` — `@Transform(normalizeEmail) @IsEmail()`.
- `password: string` — `@IsString() @MinLength(8)`.

### GoogleLoginDto

Source: `src/modules/google-oauth/dto/google-login.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `credential` | string | yes | Google Identity Services ID token returned in the credential field |
| `role` | string [INSTRUCTOR, INSTITUTION] | no | Required on first sign-in, when the Google account creates a new user; ignored afterwards |

Source validation/defaults (override generated documentation where inconsistent):

- `credential: string` — `@IsString() @IsNotEmpty()`.
- `role?: SignupRole` — `@IsOptional() @IsIn(SIGNUP_ROLES)`.

### EmailVerificationResponseDto

Source: `src/modules/auth/dto/email-verification-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `user` | UserResponseDto | yes |  |
| `otpToken` | string | yes | Short-lived OTP token with the email_verification purpose; example="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." |
| `expiresInMinutes` | number | yes | example=10 |

Source validation/defaults (override generated documentation where inconsistent):

- `user: UserResponseDto`.
- `otpToken: string`.
- `expiresInMinutes: number`.

### RegisterDto

Source: `src/modules/auth/dto/register.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `email` | string | yes | example="user@example.com" |
| `password` | string | yes | minLength=8; example="Password123!" |
| `role` | string [INSTRUCTOR, INSTITUTION] | yes | example="INSTRUCTOR" |

Source validation/defaults (override generated documentation where inconsistent):

- `email: string` — `@Transform(normalizeEmail) @IsEmail() @IsNotEmpty()`.
- `password: string` — `@IsString() @MinLength(8) @Matches(/(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/, {     message: 'Password must contain at least one uppercase letter, one number, and one special character',   }) @IsNotEmpty()`.
- `role: SignupRole` — `@IsIn(SIGNUP_ROLES)`.

### AuthResponseDto

Source: `src/modules/auth/dto/auth-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `user` | UserResponseDto | yes |  |
| `accessToken` | string | yes | example="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." |
| `refreshToken` | string | yes | example="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." |
| `accessTokenExpiresAt` | string | yes | example="2026-07-23T10:30:00.000Z" |
| `accessTokenExpiresInSeconds` | number | yes | Remaining access-token lifetime in seconds; example=900 |
| `refreshTokenExpiresAt` | string | yes | example="2026-07-30T10:15:00.000Z" |
| `refreshTokenExpiresInSeconds` | number | yes | Remaining refresh-token lifetime in seconds; example=604800 |

Source validation/defaults (override generated documentation where inconsistent):

- `user: UserResponseDto`.
- `accessToken: string`.
- `refreshToken: string`.
- `accessTokenExpiresAt: string`.
- `accessTokenExpiresInSeconds: number`.
- `refreshTokenExpiresAt: string`.
- `refreshTokenExpiresInSeconds: number`.

### RefreshTokenDto

Source: `src/modules/auth/dto/refresh-token.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `refreshToken` | string | yes | example="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." |

Source validation/defaults (override generated documentation where inconsistent):

- `refreshToken: string` — `@IsString() @IsNotEmpty()`.

### EmailOtpResponseDto

Source: `src/modules/auth/dto/email-otp-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `emailVerified` | boolean | yes | example=false |
| `expiresInMinutes` | number | yes | example=10 |
| `otpToken` | string | no | Fresh OTP token with the email_verification purpose |

Source validation/defaults (override generated documentation where inconsistent):

- `emailVerified: boolean`.
- `expiresInMinutes: number`.
- `otpToken?: string`.

### ResendEmailOtpDto

Source: `src/modules/auth/dto/email-otp.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `email` | string | yes | example="user@example.com" |

Source validation/defaults (override generated documentation where inconsistent):

- `email: string` — `@IsEmail() @IsNotEmpty()`.

### VerifyEmailOtpDto

Source: `src/modules/auth/dto/email-otp.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `otp` | string | yes | example="123456" |

Source validation/defaults (override generated documentation where inconsistent):

- `otp: string` — `@Matches(/^\d{6}$/, { message: 'otp must be a 6 digit code' })`.

### PasswordResetOtpResponseDto

Source: `src/modules/auth/dto/password-reset-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `expiresInMinutes` | number | yes | example=10 |
| `otpToken` | string | yes | Short-lived OTP token with the password_reset purpose |

Source validation/defaults (override generated documentation where inconsistent):

- `expiresInMinutes: number`.
- `otpToken: string`.

### ForgotPasswordDto

Source: `src/modules/auth/dto/password.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `email` | string | yes | example="user@example.com" |

Source validation/defaults (override generated documentation where inconsistent):

- `email: string` — `@IsEmail() @IsNotEmpty()`.

### PasswordResetResponseDto

Source: `src/modules/auth/dto/password-reset-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `passwordReset` | boolean | yes | example=true |

Source validation/defaults (override generated documentation where inconsistent):

- `passwordReset: boolean`.

### ResetPasswordDto

Source: `src/modules/auth/dto/password.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `otp` | string | yes | example="123456" |
| `password` | string | yes | minLength=8; example="NewPassword123!" |

Source validation/defaults (override generated documentation where inconsistent):

- `otp: string` — `@Matches(/^\d{6}$/, { message: 'otp must be a 6 digit code' })`.
- `password: string` — `@IsString() @MinLength(8) @Matches(/(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/, {     message: 'Password must contain at least one uppercase letter, one number, and one special character',   }) @IsNotEmpty()`.

### VerifyTwoFactorDto

Source: `src/modules/two-factor/dto/two-factor.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `code` | string | yes | Current 6-digit authenticator code or a one-time recovery code; example="123456" |

Source validation/defaults (override generated documentation where inconsistent):

- `code: string` — `@Matches(/^(?:\d{6}\|[A-HJ-NP-Z2-9]{4}(?:-[A-HJ-NP-Z2-9]{4}){3})$/i, {     message: 'code must be a 6 digit authenticator code or a valid recovery code',   })`.

### UploadUrlResponseDto

Source: `src/modules/documents/dto/upload-url-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `fileKey` | string | yes | Send this back to upload-complete once the PUT succeeds |
| `url` | string | yes | Presigned S3 URL to PUT the file to |
| `requiredHeaders` | object | yes | Headers that must be sent with the PUT exactly as given |
| `expiresAt` | string | yes | format="date-time" |

Source validation/defaults (override generated documentation where inconsistent):

- `fileKey: string`.
- `url: string`.
- `requiredHeaders: Record<string, string>`.
- `expiresAt: Date`.

### ProfileImageUploadUrlDto

Source: `src/modules/users/dto/profile-image-upload.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `contentType` | string [image/jpeg, image/png, image/webp] | yes |  |
| `sizeBytes` | number | yes | minimum=1; maximum=5242880 |

Source validation/defaults (override generated documentation where inconsistent):

- `contentType: (typeof PROFILE_IMAGE_TYPES)[number]` — `@IsIn(PROFILE_IMAGE_TYPES)`.
- `sizeBytes: number` — `@IsInt() @Min(1) @Max(MAX_PROFILE_IMAGE_BYTES)`.

### ProfileImageResponseDto

Source: `src/modules/users/dto/profile-image-upload.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `imageUrl` | object or null | yes | Short-lived signed URL for displaying the image |
| `expiresAt` | object or null | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `imageUrl: string \| null`.
- `expiresAt: Date \| null`.

### CompleteProfileImageUploadDto

Source: `src/modules/users/dto/profile-image-upload.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `fileKey` | string | yes | The fileKey returned by the upload-url endpoint |

Source validation/defaults (override generated documentation where inconsistent):

- `fileKey: string` — `@IsString() @IsNotEmpty() @MaxLength(512)`.

### AdminCreateUserDto

Source: `src/modules/users/dto/admin-create-user.dto.ts` — `extends RegisterDto`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `email` | string | yes | example="user@example.com" |
| `password` | string | yes | minLength=8; example="Password123!" |
| `role` | string [INSTRUCTOR, INSTITUTION] | yes | example="INSTRUCTOR" |
| `name` | string | no | maxLength=200; example="Alex Morgan" |
| `phone` | string | no | maxLength=30; example="+923001234567" |
| `emailVerified` | boolean | no | default=false |
| `phoneVerified` | boolean | no | default=false |

Source validation/defaults (override generated documentation where inconsistent):

- `name?: string` — `@IsOptional() @IsString() @MaxLength(200)`.
- `phone?: string` — `@IsOptional() @IsString() @MaxLength(30)`.
- `emailVerified?: boolean` — `@ValidateIf((_object: unknown, value: unknown) => value !== undefined) @IsBoolean()`.
- `phoneVerified?: boolean` — `@ValidateIf((_object: unknown, value: unknown) => value !== undefined) @IsBoolean()`.

### AdminUserResponseDto

Source: `src/modules/users/dto/admin-user-response.dto.ts` — `extends UserResponseDto`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes | example="b1b0f2bc-46fd-4f01-8c45-52e2b5fb84da" |
| `email` | string | yes | example="user@example.com" |
| `name` | object or null | no | example="Abdul Waheed" |
| `role` | string [INSTRUCTOR, INSTITUTION, ADMIN] | yes | example="INSTRUCTOR" |
| `emailVerified` | boolean | yes | example=false |
| `phoneVerified` | boolean | yes | example=false |
| `phone` | object or null | no | example="+923001234567" |
| `lastLogin` | object or null | no | example="2026-06-14T00:00:00.000Z" |
| `twoFactorEnabled` | boolean | yes | example=false |
| `createdAt` | string | no | format="date-time"; example="2026-06-14T00:00:00.000Z" |
| `updatedAt` | string | no | format="date-time"; example="2026-06-14T00:00:00.000Z" |
| `countryCode` | object or null | yes | Country of the current role profile; null without a profile; example="PK" |
| `profileStatus` | string [INCOMPLETE, PENDING, ACTIVE, SUSPENDED, DEACTIVATED, REJECTED] or null | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `countryCode: string \| null`.
- `profileStatus: ProfileStatus \| null`.

### UsersPaginationDto

Source: `src/modules/users/dto/paginated-users-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `page` | number | yes | example=1 |
| `limit` | number | yes | example=20 |
| `total` | number | yes | example=45 |
| `totalPages` | number | yes | example=3 |
| `hasNextPage` | boolean | yes | example=true |

Source validation/defaults (override generated documentation where inconsistent):

- `page: number`.
- `limit: number`.
- `total: number`.
- `totalPages: number`.
- `hasNextPage: boolean`.

### PaginatedUsersResponseDto

Source: `src/modules/users/dto/paginated-users-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `users` | Array<AdminUserResponseDto> | yes |  |
| `pagination` | UsersPaginationDto | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `users: AdminUserResponseDto[]`.
- `pagination: UsersPaginationDto`.

### UpdateUserDto

Source: `src/modules/users/dto/update-user.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `name` | string | no | example="Abdul Waheed" |
| `phone` | string | no | example="09123456789" |

Source validation/defaults (override generated documentation where inconsistent):

- `name?: string` — `@IsOptional() @IsString()`.
- `phone?: string` — `@IsOptional() @IsString()`.

### AdminUpdateUserDto

Source: `src/modules/users/dto/admin-update-user.dto.ts` — `extends UpdateUserDto`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `name` | string | no | example="Abdul Waheed" |
| `phone` | string | no | example="09123456789" |
| `role` | string [INSTRUCTOR, INSTITUTION, ADMIN] | no | example="INSTRUCTOR" |
| `emailVerified` | boolean | no | Whether the email address has been verified; example=true |
| `phoneVerified` | boolean | no | Whether the current phone number has been verified; example=true |

Source validation/defaults (override generated documentation where inconsistent):

- `role?: Role` — `@IsOptional() @IsEnum(Role)`.
- `emailVerified?: boolean` — `@ValidateIf((_object: unknown, value: unknown) => value !== undefined) @IsBoolean()`.
- `phoneVerified?: boolean` — `@ValidateIf((_object: unknown, value: unknown) => value !== undefined) @IsBoolean()`.

### TwoFactorSetupResponseDto

Source: `src/modules/two-factor/dto/two-factor.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `secret` | string | yes | Manual-entry key; show it only during setup |
| `otpAuthUri` | string | yes | Google Authenticator-compatible TOTP provisioning URI |
| `qrCodeDataUrl` | string | yes | PNG QR code encoded as a data URL |

Source validation/defaults (override generated documentation where inconsistent):

- `secret: string`.
- `otpAuthUri: string`.
- `qrCodeDataUrl: string`.

### TwoFactorEnableResponseDto

Source: `src/modules/two-factor/dto/two-factor.dto.ts` — `extends TwoFactorRecoveryCodesResponseDto`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `recoveryCodes` | Array<string> | yes | One-time recovery codes. They are returned only when generated. |
| `enabled` | boolean | yes | example=true |

Source validation/defaults (override generated documentation where inconsistent):

- `enabled: boolean`.

### EnableTwoFactorDto

Source: `src/modules/two-factor/dto/two-factor.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `code` | string | yes | Current 6-digit code from the authenticator app; example="123456" |

Source validation/defaults (override generated documentation where inconsistent):

- `code: string` — `@Matches(/^\d{6}$/, { message: 'code must be a 6 digit authenticator code' })`.

### TwoFactorStatusResponseDto

Source: `src/modules/two-factor/dto/two-factor.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `enabled` | boolean | yes | example=true |
| `setupPending` | boolean | yes | example=false |
| `recoveryCodesRemaining` | number | yes | example=10 |

Source validation/defaults (override generated documentation where inconsistent):

- `enabled: boolean`.
- `setupPending: boolean`.
- `recoveryCodesRemaining: number`.

### TwoFactorDisableResponseDto

Source: `src/modules/two-factor/dto/two-factor.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `enabled` | boolean | yes | example=false |

Source validation/defaults (override generated documentation where inconsistent):

- `enabled: boolean`.

### TwoFactorRecoveryCodesResponseDto

Source: `src/modules/two-factor/dto/two-factor.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `recoveryCodes` | Array<string> | yes | One-time recovery codes. They are returned only when generated. |

Source validation/defaults (override generated documentation where inconsistent):

- `recoveryCodes: string[]`.

### RegisterInterestDto

Source: `src/modules/contact/dto/register-interest.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `schoolName` | string | yes | example="Greenfield Primary School" |
| `contactName` | string | yes | example="Jane Smith" |
| `role` | string | yes | An active legacySchoolRole dropdown value; example="Head Teacher" |
| `email` | string | yes | example="name@school.org.uk" |

Source validation/defaults (override generated documentation where inconsistent):

- `schoolName: string` — `@IsString() @IsNotEmpty() @Length(2, 120)`.
- `contactName: string` — `@IsString() @IsNotEmpty() @Length(2, 120)`.
- `role: string` — `@IsString() @IsNotEmpty() @Length(2, 100)`.
- `email: string` — `@IsEmail() @Length(5, 254)`.
- `phone?: string` — `@IsOptional() @IsString() @MaxLength(32)`.
- `postcode?: string` — `@IsOptional() @IsString() @MaxLength(20)`.
- `schoolType?: string` — `@IsOptional() @IsString() @MaxLength(80)`.
- `tier?: string` — `@IsOptional() @IsString() @MaxLength(100)`.
- `message?: string` — `@IsOptional() @IsString() @MaxLength(2000)`.
- `source?: string` — `@IsOptional() @IsString() @MaxLength(80)`.
- `campaign?: string` — `@IsOptional() @IsString() @MaxLength(120)`.

### CreateFoundingInterestDto

Source: `src/modules/contact/dto/founding-interest.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `type` | string [SCHOOL, TEACHER] | yes |  |
| `name` | string | yes |  |
| `email` | string | yes |  |
| `role` | string | yes |  |
| `area` | string | yes |  |
| `organizationName` | string | no |  |
| `schoolType` | string | no | An active waitlistSchoolType dropdown value |
| `supplyDaysPerTerm` | string | no | An active supplyDaysPerTerm dropdown value |
| `coverBookingMethod` | string | no | An active coverBookingMethod dropdown value |
| `foundingProgrammeInterest` | boolean | no |  |
| `firstName` | string | no |  |
| `lastName` | string | no |  |
| `phone` | string | no |  |
| `currentSupply` | string | no | An active currentSupply dropdown value |
| `daysPerWeek` | string | no | An active daysPerWeek dropdown value |
| `emailConsent` | boolean | no |  |
| `source` | string | no |  |
| `campaign` | string | no |  |

Source validation/defaults (override generated documentation where inconsistent):

- `type: FoundingInterestType` — `@IsEnum(FoundingInterestType)`.
- `name: string` — `@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @Length(2, 120)`.
- `email: string` — `@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value)) @IsEmail() @MaxLength(254)`.
- `role: string` — `@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @Length(2, 100)`.
- `area: string` — `@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @Length(2, 80)`.
- `organizationName?: string` — `@ValidateIf((input: CreateFoundingInterestDto) => input.type === FoundingInterestType.SCHOOL) @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @Length(2, 160)`.
- `schoolType?: string` — `@ValidateIf((input: CreateFoundingInterestDto) => input.type === FoundingInterestType.SCHOOL) @IsString() @Length(1, 100)`.
- `supplyDaysPerTerm?: string` — `@ValidateIf((input: CreateFoundingInterestDto) => input.type === FoundingInterestType.SCHOOL) @IsString() @Length(1, 100)`.
- `coverBookingMethod?: string` — `@ValidateIf((input: CreateFoundingInterestDto) => input.type === FoundingInterestType.SCHOOL) @IsString() @Length(1, 100)`.
- `foundingProgrammeInterest?: boolean` — `@IsOptional() @IsBoolean()`.
- `firstName?: string` — `@ValidateIf((input: CreateFoundingInterestDto) => input.type === FoundingInterestType.TEACHER) @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @Length(1, 60)`.
- `lastName?: string` — `@ValidateIf((input: CreateFoundingInterestDto) => input.type === FoundingInterestType.TEACHER) @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @Length(1, 60)`.
- `phone?: string` — `@IsOptional() @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @MaxLength(32) @Matches(/^(?=(?:\D*\d){10})[+()\d\s-]+$/)`.
- `currentSupply?: string` — `@ValidateIf((input: CreateFoundingInterestDto) => input.type === FoundingInterestType.TEACHER) @IsString() @Length(1, 100)`.
- `daysPerWeek?: string` — `@ValidateIf((input: CreateFoundingInterestDto) => input.type === FoundingInterestType.TEACHER) @IsString() @Length(1, 100)`.
- `emailConsent?: boolean` — `@ValidateIf((input: CreateFoundingInterestDto) => input.type === FoundingInterestType.TEACHER) @Equals(true)`.
- `source?: string` — `@IsOptional() @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @MaxLength(80)`.
- `campaign?: string` — `@IsOptional() @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @MaxLength(120)`.

### UpdateWaitlistDetailsDto

Source: `src/modules/contact/dto/founding-interest.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `token` | string | yes |  |
| `phases` | Array<string> | yes | Active waitlistPhase dropdown values |
| `mainSubject` | string | no |  |
| `postcode` | string | no |  |

Source validation/defaults (override generated documentation where inconsistent):

- `token: string` — `@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @Matches(/^[a-f0-9]{64}$/)`.
- `phases: string[]` — `@IsArray() @ArrayMaxSize(50) @ArrayUnique() @IsString({ each: true }) @Length(1, 100, { each: true })`.
- `mainSubject?: string` — `@IsOptional() @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @MaxLength(100)`.
- `postcode?: string` — `@IsOptional() @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @MaxLength(20) @Matches(/^$\|^[A-Z]{1,2}\d[A-Z\d]?(?:\s*\d[A-Z]{2})?$/i)`.

### UpdateFoundingInterestStatusDto

Source: `src/modules/contact/dto/founding-interest.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `status` | string [NEW, CONTACTED, QUALIFIED, CONVERTED, CLOSED] | yes | example="CONTACTED" |

Source validation/defaults (override generated documentation where inconsistent):

- `status: FoundingInterestStatus` — `@IsEnum(FoundingInterestStatus)`.

### CreateDocumentRequirementDto

Source: `src/modules/document-requirements/dto/create-document-requirement.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `documentTypeId` | string | yes |  |
| `context` | string [INSTRUCTOR_PROFILE, INSTITUTION_PROFILE] | yes |  |
| `isRequired` | boolean | no | default=true |
| `requiresReview` | boolean | no | default=false |
| `isActive` | boolean | no | default=true |

Source validation/defaults (override generated documentation where inconsistent):

- `documentTypeId: string` — `@IsUUID()`.
- `context: DocumentContext` — `@IsEnum(DocumentContext)`.
- `isRequired?: boolean` — `@IsOptional() @IsBoolean()`.
- `requiresReview?: boolean` — `@IsOptional() @IsBoolean()`.
- `isActive?: boolean` — `@IsOptional() @IsBoolean()`.

### UpdateDocumentRequirementDto

Source: `src/modules/document-requirements/dto/update-document-requirement.dto.ts` — `extends PartialType(CreateDocumentRequirementDto)`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `documentTypeId` | string | no |  |
| `context` | string [INSTRUCTOR_PROFILE, INSTITUTION_PROFILE] | no |  |
| `isRequired` | boolean | no | default=true |
| `requiresReview` | boolean | no | default=false |
| `isActive` | boolean | no | default=true |

### CreateDocumentTypeDto

Source: `src/modules/document-types/dto/create-document-type.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `code` | string | yes | example="DBS" |
| `name` | string | yes | example="DBS Certificate" |
| `description` | string | no | example="Disclosure and Barring Service certificate" |
| `allowedMimes` | Array<string> | yes | example=["application/pdf","image/jpeg"] |
| `maxSizeBytes` | number | no | default=10485760 |
| `isActive` | boolean | no | default=true |

Source validation/defaults (override generated documentation where inconsistent):

- `code: string` — `@IsString() @IsNotEmpty()`.
- `name: string` — `@IsString() @IsNotEmpty()`.
- `description?: string` — `@IsOptional() @IsString()`.
- `allowedMimes: string[]` — `@IsArray() @ArrayMinSize(1) @ArrayUnique() @IsString({ each: true }) @IsNotEmpty({ each: true })`.
- `maxSizeBytes?: number` — `@IsOptional() @IsInt() @Min(1)`.
- `isActive?: boolean` — `@IsOptional() @IsBoolean()`.

### UpdateDocumentTypeDto

Source: `src/modules/document-types/dto/update-document-type.dto.ts` — `extends PartialType(CreateDocumentTypeDto)`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `code` | string | no | example="DBS" |
| `name` | string | no | example="DBS Certificate" |
| `description` | string | no | example="Disclosure and Barring Service certificate" |
| `allowedMimes` | Array<string> | no | example=["application/pdf","image/jpeg"] |
| `maxSizeBytes` | number | no | default=10485760 |
| `isActive` | boolean | no | default=true |

### PhoneOtpResponseDto

Source: `src/modules/phone-verification/dto/phone-verification.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `phone` | string | yes | The number the code was sent to, in E.164 format; example="+447911123456" |
| `expiresInMinutes` | number | yes | example=10 |
| `resendAvailableInSeconds` | number | yes | Seconds before another code can be requested; example=60 |

Source validation/defaults (override generated documentation where inconsistent):

- `phone: string`.
- `expiresInMinutes: number`.
- `resendAvailableInSeconds: number`.

### SendPhoneOtpDto

Source: `src/modules/phone-verification/dto/phone-verification.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `phone` | string | yes | Mobile number to verify. Numbers without a +country prefix are read as UK numbers.; maxLength=30; example="+447911123456" |

Source validation/defaults (override generated documentation where inconsistent):

- `phone: string` — `@IsString() @IsNotEmpty() @MaxLength(30)`.

### VerifyPhoneOtpDto

Source: `src/modules/phone-verification/dto/phone-verification.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `otp` | string | yes | example="123456" |

Source validation/defaults (override generated documentation where inconsistent):

- `otp: string` — `@Matches(/^\d{6}$/, { message: 'otp must be a 6 digit code' })`.

### InstructorResponseDto

Source: `src/modules/instructors/dto/instructor-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `userId` | string | yes |  |
| `fullName` | string | yes |  |
| `imageUrl` | object | no |  |
| `bio` | object or null | no | example="Experienced mathematics instructor." |
| `address` | object or null | no | example="1 School Lane" |
| `city` | object or null | no | example="London" |
| `county` | object or null | no | example="Greater London" |
| `postalCode` | object or null | no | example="SW1A 2AA" |
| `countryCode` | string | yes | example="GB" |
| `latitude` | object or null | no | Set by geocoding from the postcode; not client-supplied; example=51.5014 |
| `longitude` | object or null | no | Set by geocoding from the postcode; not client-supplied; example=-0.1419 |
| `skills` | Array<string> | yes | example=["Classroom management","SEN"] |
| `subjects` | Array<string> | yes | example=["Mathematics","Physics"] |
| `keyStages` | Array<string> | yes | example=["KS2","KS3","KS4"] |
| `hourlyRate` | object or null | no | example=25.5 |
| `dailyRate` | object or null | no | example=180 |
| `experience` | object or null | no | example=5 |
| `currency` | object or null | no | example="GBP" |
| `maxTravelDistance` | object or null | no | example=25 |
| `ratingAverage` | number | yes | example=4.8 |
| `ratingCount` | number | yes | example=12 |
| `dbsVerified` | boolean | yes | example=false |
| `status` | string [INCOMPLETE, PENDING, ACTIVE, SUSPENDED, DEACTIVATED, REJECTED] | yes | example="INCOMPLETE" |
| `createdAt` | string | no | format="date-time"; example="2026-06-14T00:00:00.000Z" |
| `updatedAt` | string | no | format="date-time"; example="2026-06-14T00:00:00.000Z" |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `userId: string`.
- `fullName: string`.
- `imageUrl?: string \| null`.
- `bio?: string \| null`.
- `address?: string \| null`.
- `city?: string \| null`.
- `county?: string \| null`.
- `postalCode?: string \| null`.
- `countryCode: string`.
- `latitude?: number \| null`.
- `longitude?: number \| null`.
- `skills: string[]`.
- `subjects: string[]`.
- `keyStages: string[]`.
- `hourlyRate?: number \| null`.
- `dailyRate?: number \| null`.
- `experience?: number \| null`.
- `currency?: string \| null`.
- `maxTravelDistance?: number \| null`.
- `ratingAverage: number`.
- `ratingCount: number`.
- `dbsVerified: boolean`.
- `status: ProfileStatus`.
- `createdAt?: Date`.
- `updatedAt?: Date`.

### CreateInstructorDto

Source: `src/modules/instructors/dto/create-instructor.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `fullName` | string | yes |  |
| `imageUrl` | string | no |  |
| `bio` | string | no |  |
| `address` | string | no | example="1 School Lane" |
| `city` | string | no | example="London" |
| `county` | string | no | example="Greater London" |
| `postalCode` | string | no | example="SW1A 2AA" |
| `countryCode` | string | no | default="GB"; example="GB" |
| `skills` | Array<string> | no | Catalogue skills belonging to selected subjects, or sharedSkills. |
| `otherSkills` | Array<string> | no | Custom skill names when skills includes Other. Stored as actual names in skills. |
| `subjects` | Array<string> | no | Subject names from GET /api/teaching-catalogue. |
| `otherSubjects` | Array<string> | no | Custom subject names when subjects includes Other. Stored as actual names in the response subjects array. |
| `keyStages` | Array<string> | no |  |
| `hourlyRate` | number | no |  |
| `dailyRate` | number | no |  |
| `experience` | number | no | example=5 |
| `currency` | string | no |  |
| `maxTravelDistance` | number | no |  |

Source validation/defaults (override generated documentation where inconsistent):

- `fullName: string` — `@IsString() @IsNotEmpty()`.
- `imageUrl?: string` — `@IsOptional()`.
- `bio?: string` — `@IsOptional() @IsString()`.
- `address?: string` — `@IsOptional() @IsString() @MaxLength(250)`.
- `city?: string` — `@IsOptional() @IsString() @MaxLength(100)`.
- `county?: string` — `@IsOptional() @IsString() @MaxLength(100)`.
- `postalCode?: string` — `@IsOptional() @IsString() @MaxLength(20)`.
- `countryCode?: string` — `@IsOptional() @IsISO31661Alpha2()`.
- `skills?: string[]` — `@IsOptional() @IsArray() @ArrayUnique() @ArrayMaxSize(50) @IsString({ each: true }) @IsNotEmpty({ each: true }) @MaxLength(100, { each: true })`.
- `otherSkills?: string[]` — `@IsOptional() @IsArray() @ArrayUnique() @ArrayMaxSize(50) @IsString({ each: true }) @IsNotEmpty({ each: true }) @MaxLength(100, { each: true })`.
- `subjects?: string[]` — `@IsOptional() @IsArray() @ArrayUnique() @ArrayMaxSize(50) @IsString({ each: true }) @IsNotEmpty({ each: true }) @MaxLength(100, { each: true })`.
- `otherSubjects?: string[]` — `@IsOptional() @IsArray() @ArrayUnique() @ArrayMaxSize(50) @IsString({ each: true }) @IsNotEmpty({ each: true }) @MaxLength(100, { each: true })`.
- `keyStages?: string[]` — `@IsOptional() @IsArray() @ArrayUnique() @IsString({ each: true }) @IsNotEmpty({ each: true })`.
- `hourlyRate?: number` — `@IsOptional() @IsNumber() @Min(0)`.
- `dailyRate?: number` — `@IsOptional() @IsNumber() @Min(0)`.
- `experience?: number` — `@IsOptional() @IsInt() @Min(0)`.
- `currency?: string` — `@IsOptional() @IsISO4217CurrencyCode()`.
- `maxTravelDistance?: number` — `@IsOptional() @IsNumber() @Min(0)`.

### PaginatedInstructorsResponseDto

Source: `src/modules/instructors/dto/instructor-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `instructors` | Array<InstructorResponseDto> | yes |  |
| `pagination` | PaginationMetaDto | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `instructors: InstructorResponseDto[]`.
- `pagination: PaginationMetaDto`.

### VerifiedDegreeDto

Source: `src/modules/degree-checks/dto/degree-check-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `institutionName` | string | yes | example="University of Leeds" |
| `qualificationType` | object or null | no | example="BSc Hons" |
| `courseName` | object or null | no | example="Mathematics" |
| `classification` | object or null | no | example="2:1" |
| `yearOfAward` | object or null | no | example=2015 |

Source validation/defaults (override generated documentation where inconsistent):

- `institutionName: string`.
- `qualificationType: string \| null`.
- `courseName: string \| null`.
- `classification: string \| null`.
- `yearOfAward: number \| null`.

### InstructorBookingJobDto

Source: `src/modules/instructors/dto/instructor-booking.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `title` | string | yes |  |
| `address` | object or null | no |  |
| `city` | object or null | no |  |
| `county` | object or null | no |  |
| `postalCode` | object or null | no |  |
| `countryCode` | string | yes |  |
| `latitude` | object or null | no |  |
| `longitude` | object or null | no |  |
| `parkingInfo` | object or null | no |  |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `title: string`.
- `address: string \| null`.
- `city: string \| null`.
- `county: string \| null`.
- `postalCode: string \| null`.
- `countryCode: string`.
- `latitude: number \| null`.
- `longitude: number \| null`.
- `parkingInfo: string \| null`.

### InstructorBookingDto

Source: `src/modules/instructors/dto/instructor-booking.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `startDate` | object or null | no |  |
| `endDate` | object or null | no |  |
| `hours` | number or null | no | Total hours agreed when the hourly booking was created |
| `days` | number or null | no | Total days agreed when the daily booking was created |
| `job` | InstructorBookingJobDto | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `startDate: Date \| null`.
- `endDate: Date \| null`.
- `hours: number \| null`.
- `days: number \| null`.
- `job: InstructorBookingJobDto`.

### InstructorDirectoryItemDto

Source: `src/modules/instructors/dto/instructor-directory-item.dto.ts` — `extends InstructorPublicProfileDto`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `fullName` | string | yes | example="Sarah Johnson" |
| `imageUrl` | object or null | no |  |
| `bio` | object or null | no | example="Experienced mathematics teacher." |
| `city` | object or null | no | example="Leeds" |
| `county` | object or null | no | example="West Yorkshire" |
| `subjects` | Array<string> | yes |  |
| `skills` | Array<string> | yes |  |
| `keyStages` | Array<string> | yes | example=["KS2","KS3"] |
| `experience` | object or null | no | Years of experience; example=6 |
| `hourlyRate` | object or null | no | example=30 |
| `dailyRate` | object or null | no | example=180 |
| `currency` | object or null | no | example="GBP" |
| `ratingAverage` | number | yes | example=4.8 |
| `ratingCount` | number | yes | example=12 |
| `dbsVerified` | boolean | yes | Their DBS check has been verified |
| `verifiedDegree` | VerifiedDegreeDto | no | Their degree, as the university confirmed it through Hedd; null when they have no verified degree |
| `memberSince` | object | no | When they joined SupplyEd |
| `bookings` | Array<InstructorBookingDto> | yes | Confirmed bookings ending today or later (UTC), earliest first, including job titles and work locations |
| `certificates` | Array<ProfileDocumentResponseDto> | yes |  |
| `qtsQualified` | boolean | yes | Has an approved document whose document type code is QTS |
| `availableToday` | boolean | yes | Has no confirmed booking overlapping today in UTC |

Source validation/defaults (override generated documentation where inconsistent):

- `qtsQualified: boolean`.
- `availableToday: boolean`.

### PaginatedInstructorDirectoryResponseDto

Source: `src/modules/instructors/dto/instructor-directory-item.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `instructors` | Array<InstructorDirectoryItemDto> | yes |  |
| `pagination` | PaginationMetaDto | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `instructors: InstructorDirectoryItemDto[]`.
- `pagination: PaginationMetaDto`.

### InstructorPublicProfileDto

Source: `src/modules/instructors/dto/instructor-public-profile.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `fullName` | string | yes | example="Sarah Johnson" |
| `imageUrl` | object or null | no |  |
| `bio` | object or null | no | example="Experienced mathematics teacher." |
| `city` | object or null | no | example="Leeds" |
| `county` | object or null | no | example="West Yorkshire" |
| `subjects` | Array<string> | yes |  |
| `skills` | Array<string> | yes |  |
| `keyStages` | Array<string> | yes | example=["KS2","KS3"] |
| `experience` | object or null | no | Years of experience; example=6 |
| `hourlyRate` | object or null | no | example=30 |
| `dailyRate` | object or null | no | example=180 |
| `currency` | object or null | no | example="GBP" |
| `ratingAverage` | number | yes | example=4.8 |
| `ratingCount` | number | yes | example=12 |
| `dbsVerified` | boolean | yes | Their DBS check has been verified |
| `verifiedDegree` | VerifiedDegreeDto | no | Their degree, as the university confirmed it through Hedd; null when they have no verified degree |
| `memberSince` | object | no | When they joined SupplyEd |
| `bookings` | Array<InstructorBookingDto> | yes | Confirmed bookings ending today or later (UTC), earliest first, including job titles and work locations |
| `certificates` | Array<ProfileDocumentResponseDto> | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `fullName: string`.
- `imageUrl: string \| null`.
- `bio: string \| null`.
- `city: string \| null`.
- `county: string \| null`.
- `subjects: string[]`.
- `skills: string[]`.
- `keyStages: string[]`.
- `experience: number \| null`.
- `hourlyRate: number \| null`.
- `dailyRate: number \| null`.
- `currency: string \| null`.
- `ratingAverage: number`.
- `ratingCount: number`.
- `dbsVerified: boolean`.
- `verifiedDegree: VerifiedDegreeDto \| null`.
- `memberSince: Date \| null`.
- `bookings: InstructorBookingDto[]`.
- `certificates: ProfileDocumentResponseDto[]`.

### UpdateInstructorDto

Source: `src/modules/instructors/dto/update-instructor.dto.ts` — `extends PartialType(CreateInstructorDto)`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `fullName` | string | no |  |
| `imageUrl` | string | no |  |
| `bio` | string | no |  |
| `address` | string | no | example="1 School Lane" |
| `city` | string | no | example="London" |
| `county` | string | no | example="Greater London" |
| `postalCode` | string | no | example="SW1A 2AA" |
| `countryCode` | string | no | default="GB"; example="GB" |
| `skills` | Array<string> | no | Catalogue skills belonging to selected subjects, or sharedSkills. |
| `otherSkills` | Array<string> | no | Custom skill names when skills includes Other. Stored as actual names in skills. |
| `subjects` | Array<string> | no | Subject names from GET /api/teaching-catalogue. |
| `otherSubjects` | Array<string> | no | Custom subject names when subjects includes Other. Stored as actual names in the response subjects array. |
| `keyStages` | Array<string> | no |  |
| `hourlyRate` | number | no |  |
| `dailyRate` | number | no |  |
| `experience` | number | no | example=5 |
| `currency` | string | no |  |
| `maxTravelDistance` | number | no |  |

### AdminUpdateInstructorDto

Source: `src/modules/instructors/dto/admin-update-instructor.dto.ts` — `extends UpdateInstructorDto`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `fullName` | string | no |  |
| `imageUrl` | string | no |  |
| `bio` | string | no |  |
| `address` | string | no | example="1 School Lane" |
| `city` | string | no | example="London" |
| `county` | string | no | example="Greater London" |
| `postalCode` | string | no | example="SW1A 2AA" |
| `countryCode` | string | no | default="GB"; example="GB" |
| `skills` | Array<string> | no | Catalogue skills belonging to selected subjects, or sharedSkills. |
| `otherSkills` | Array<string> | no | Custom skill names when skills includes Other. Stored as actual names in skills. |
| `subjects` | Array<string> | no | Subject names from GET /api/teaching-catalogue. |
| `otherSubjects` | Array<string> | no | Custom subject names when subjects includes Other. Stored as actual names in the response subjects array. |
| `keyStages` | Array<string> | no |  |
| `hourlyRate` | number | no |  |
| `dailyRate` | number | no |  |
| `experience` | number | no | example=5 |
| `currency` | string | no |  |
| `maxTravelDistance` | number | no |  |
| `status` | string [INCOMPLETE, PENDING, ACTIVE, SUSPENDED, DEACTIVATED, REJECTED] | no | example="ACTIVE" |

Source validation/defaults (override generated documentation where inconsistent):

- `status?: ProfileStatus` — `@IsOptional() @IsIn(ADMIN_INSTRUCTOR_STATUSES)`.

### TeacherIdentityVerificationDto

Source: `src/modules/identity-verification/dto/identity-verification-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `status` | string [LINK_SENT, SUBMITTED, RESULTS_READY, COMPLETED, EXPIRED, CANCELLED] | yes |  |
| `result` | string [VERIFIED, IN_REVIEW, RETRY_PENDING, UNSUCCESSFUL] or null | no | Set once the check is complete; reflects an admin's decision once made |
| `guestLinkUrl` | object or null | no | TrustID link to open on a phone; only while status is LINK_SENT. Do not embed it in an iframe. |
| `linkExpiresAt` | string | yes | format="date-time" |
| `submittedAt` | object or null | no |  |
| `completedAt` | object or null | no |  |
| `createdAt` | string | yes | format="date-time" |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `status: IdentityVerificationStatus`.
- `result: TeacherResult \| null`.
- `guestLinkUrl: string \| null`.
- `linkExpiresAt: Date`.
- `submittedAt: Date \| null`.
- `completedAt: Date \| null`.
- `createdAt: Date`.

### MyIdentityVerificationResponseDto

Source: `src/modules/identity-verification/dto/identity-verification-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `required` | boolean | yes | false only where identity verification is switched off (local development) |
| `state` | string [NOT_STARTED, LINK_SENT, PROCESSING, IN_REVIEW, RETRY_PENDING, VERIFIED, UNSUCCESSFUL] | yes | Where the teacher stands on the identity step of opening their account. VERIFIED: their latest decided check was approved. IN_REVIEW and RETRY_PENDING: waiting for our team. |
| `verifiedAt` | object or null | no | When the check that verified the teacher was approved |
| `canStart` | boolean | yes | Whether "Verify my identity" should be offered (POST /identity-verification/me) |
| `verification` | TeacherIdentityVerificationDto | no | The latest check |

Source validation/defaults (override generated documentation where inconsistent):

- `required: boolean`.
- `state: IdentityState`.
- `verifiedAt: Date \| null`.
- `canStart: boolean`.
- `verification: TeacherIdentityVerificationDto \| null`.

### StartIdentityVerificationDto

Source: `src/modules/identity-verification/dto/start-identity-verification.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `consent` | boolean | yes | The teacher agrees to TrustID processing their identity document and a selfie (biometric data); example=true |

Source validation/defaults (override generated documentation where inconsistent):

- `consent: boolean` — `@Equals(true, { message: 'consent must be true to start the identity check' })`.

### IdentityVerificationUserDto

Source: `src/modules/identity-verification/dto/identity-verification-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `email` | string | yes |  |
| `name` | object or null | no |  |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `email: string`.
- `name: string \| null`.

### AdminIdentityVerificationDto

Source: `src/modules/identity-verification/dto/identity-verification-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `user` | IdentityVerificationUserDto | yes |  |
| `initiatedBy` | IdentityVerificationUserDto | no | Admin who reissued it |
| `consentedAt` | object or null | no | When the teacher agreed to TrustID processing their ID and selfie; null for a reissued link |
| `providerContainerId` | string | yes | TrustID container id |
| `status` | string [LINK_SENT, SUBMITTED, RESULTS_READY, COMPLETED, EXPIRED, CANCELLED] | yes |  |
| `outcome` | string [PASSED, REFERRED, SOFT_FAILED, HARD_FAILED] or null | no |  |
| `linkExpiresAt` | string | yes | format="date-time" |
| `submittedAt` | object or null | no |  |
| `resultsReadyAt` | object or null | no |  |
| `completedAt` | object or null | no |  |
| `cancelledAt` | object or null | no |  |
| `retrievalAttempts` | number | yes | Attempts to fetch the results from TrustID |
| `retrievalError` | object or null | no | Why fetching the results last failed |
| `rightToWorkPassed` | object or null | no |  |
| `rightToWorkStatus` | string [CONTINUOUS, TIME_LIMITED, REJECTED] or null | no |  |
| `rightToWorkFollowUpDate` | object or null | no | Time-limited permission: re-check by this date |
| `rightToWorkRestrictions` | object or null | no | Yes \| No \| Not Applicable; details in rightToWorkNotes |
| `rightToWorkNotes` | object or null | no |  |
| `shareCodeCheck` | object or null | no | Right to work proven with a Home Office share code |
| `dbsIdentityPassed` | object or null | no | Identity good enough for an Enhanced DBS (H1A) |
| `dbsInitiationState` | object or null | no | 3: ID and address passed, 4: ID only, 1: ID not passed |
| `addressVerification` | object or null | no |  |
| `faceMatch` | string [MATCH, UNSURE, NO_MATCH] or null | no |  |
| `livenessPassed` | object or null | no |  |
| `documentAuditorStatus` | object or null | no | 1 accepted, 3 failed, 4 rejected, 5 no validation |
| `documentNotes` | object or null | no | TrustID analysts' notes. Not shown to the teacher. |
| `decision` | string [APPROVED, REJECTED] or null | no | Whether this check verifies the teacher; set automatically for PASSED and HARD_FAILED |
| `decidedAt` | object or null | no |  |
| `decidedBy` | IdentityVerificationUserDto | no | Admin who decided; null when it followed from TrustID's result |
| `decisionNote` | object or null | no | The admin's note. Not shown to the teacher. |
| `needsDecision` | boolean | yes | Completed, REFERRED or SOFT_FAILED, and not yet approved or rejected |
| `hasReport` | boolean | yes | The TrustID PDF report is stored (GET .../report-url) |
| `hasDbsForm` | boolean | yes | The DBS form the teacher filled in is stored, for the DBS check |
| `createdAt` | string | yes | format="date-time" |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `user: IdentityVerificationUserDto`.
- `initiatedBy: IdentityVerificationUserDto \| null`.
- `consentedAt: Date \| null`.
- `providerContainerId: string`.
- `status: IdentityVerificationStatus`.
- `outcome: IdentityVerificationOutcome \| null`.
- `linkExpiresAt: Date`.
- `submittedAt: Date \| null`.
- `resultsReadyAt: Date \| null`.
- `completedAt: Date \| null`.
- `cancelledAt: Date \| null`.
- `retrievalAttempts: number`.
- `retrievalError: string \| null`.
- `rightToWorkPassed: boolean \| null`.
- `rightToWorkStatus: RightToWorkStatus \| null`.
- `rightToWorkFollowUpDate: Date \| null`.
- `rightToWorkRestrictions: string \| null`.
- `rightToWorkNotes: string \| null`.
- `shareCodeCheck: boolean \| null`.
- `dbsIdentityPassed: boolean \| null`.
- `dbsInitiationState: number \| null`.
- `addressVerification: string \| null`.
- `faceMatch: FaceMatchResult \| null`.
- `livenessPassed: boolean \| null`.
- `documentAuditorStatus: number \| null`.
- `documentNotes: string \| null`.
- `decision: IdentityVerificationDecision \| null`.
- `decidedAt: Date \| null`.
- `decidedBy: IdentityVerificationUserDto \| null`.
- `decisionNote: string \| null`.
- `needsDecision: boolean`.
- `hasReport: boolean`.
- `hasDbsForm: boolean`.
- `createdAt: Date`.

### PaginatedIdentityVerificationsResponseDto

Source: `src/modules/identity-verification/dto/identity-verification-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `verifications` | Array<AdminIdentityVerificationDto> | yes |  |
| `pagination` | PaginationMetaDto | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `verifications: AdminIdentityVerificationDto[]`.
- `pagination: PaginationMetaDto`.

### ReportUrlResponseDto

Source: `src/modules/identity-verification/dto/identity-verification-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `url` | string | yes |  |
| `expiresAt` | string | yes | format="date-time" |

Source validation/defaults (override generated documentation where inconsistent):

- `url: string`.
- `expiresAt: Date`.

### DecideIdentityVerificationDto

Source: `src/modules/identity-verification/dto/decide-identity-verification.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `decision` | string [APPROVED, REJECTED] | yes | APPROVED verifies the teacher |
| `note` | string | no | Why; kept for the audit trail and never shown to the teacher; maxLength=1000 |

Source validation/defaults (override generated documentation where inconsistent):

- `decision: IdentityVerificationDecision` — `@IsIn(Object.values(IdentityVerificationDecision))`.
- `note?: string` — `@IsOptional() @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() \|\| undefined : value)) @IsString() @MaxLength(1000)`.

### UpdateAvailabilityDto

Source: `src/modules/availability/dto/update-availability.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `timeZone` | string | yes | example="Europe/London" |
| `weeklySchedule` | object | yes | Recurring weekdays and one or more time slots per selected day |
| `exceptions` | Array<object> | yes | Date-specific additions, exclusions or replacement hours |

Source validation/defaults (override generated documentation where inconsistent):

- `timeZone: string` — `@IsString() @MaxLength(100)`.
- `weeklySchedule: Record<string, unknown>` — `@IsObject()`.
- `exceptions: Record<string, unknown>[]` — `@IsArray()`.

### CreateDocumentDto

Source: `src/modules/documents/dto/create-document.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `requirementId` | string | yes |  |
| `applicationId` | object or null | no |  |

Source validation/defaults (override generated documentation where inconsistent):

- `requirementId: string` — `@IsUUID()`.
- `applicationId?: string \| null` — `@IsOptional() @IsUUID()`.

### DocumentTypeResponseDto

Source: `src/modules/document-types/dto/document-type-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `code` | string | yes | example="DBS" |
| `name` | string | yes | example="DBS Certificate" |
| `description` | object or null | no |  |
| `allowedMimes` | Array<string> | yes |  |
| `maxSizeBytes` | number | yes |  |
| `isActive` | boolean | yes |  |
| `createdAt` | string | yes | format="date-time" |
| `updatedAt` | string | yes | format="date-time" |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `code: string`.
- `name: string`.
- `description: string \| null`.
- `allowedMimes: string[]`.
- `maxSizeBytes: number`.
- `isActive: boolean`.
- `createdAt: Date`.
- `updatedAt: Date`.

### ProfileDocumentRequirementResponseDto

Source: `src/modules/document-requirements/dto/profile-document-requirement-response.dto.ts` — `extends DocumentRequirementResponseDto`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `documentTypeId` | string | yes |  |
| `context` | string [INSTRUCTOR_PROFILE, INSTITUTION_PROFILE] | yes |  |
| `isRequired` | boolean | yes |  |
| `requiresReview` | boolean | yes |  |
| `isActive` | boolean | yes |  |
| `createdAt` | string | yes | format="date-time" |
| `updatedAt` | string | yes | format="date-time" |
| `documentType` | DocumentTypeResponseDto | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `documentType: DocumentTypeResponseDto`.

### DocumentOwnerSummaryDto

Source: `src/modules/documents/dto/document-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `email` | string | yes |  |
| `name` | object or null | no |  |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `email: string`.
- `name: string \| null`.

### DocumentResponseDto

Source: `src/modules/documents/dto/document-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `userId` | string | yes |  |
| `applicationId` | object or null | no |  |
| `requirementId` | string | yes |  |
| `status` | string [NOT_REQUIRED, PENDING, APPROVED, REJECTED, REQUIRES_INFO] | yes |  |
| `rejectionComment` | object or null | no | Latest rejection or information-request note for the current file; null after replacement or approval |
| `fileKey` | object or null | no |  |
| `originalName` | object or null | no |  |
| `sizeBytes` | object or null | no |  |
| `contentType` | object or null | no |  |
| `checksum` | object or null | no |  |
| `documentExpiryDate` | object or null | no |  |
| `uploadedAt` | object or null | no |  |
| `requirement` | ProfileDocumentRequirementResponseDto | no |  |
| `user` | DocumentOwnerSummaryDto | no | Present on admin routes only |
| `deletedAt` | object or null | no |  |
| `createdAt` | string | yes | format="date-time" |
| `updatedAt` | string | yes | format="date-time" |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `userId: string`.
- `applicationId: string \| null`.
- `requirementId: string`.
- `status: DocumentVerificationStatus`.
- `rejectionComment?: string \| null`.
- `fileKey: string \| null`.
- `originalName: string \| null`.
- `sizeBytes: number \| null`.
- `contentType: string \| null`.
- `checksum: string \| null`.
- `documentExpiryDate: Date \| null`.
- `uploadedAt: Date \| null`.
- `requirement?: ProfileDocumentRequirementResponseDto`.
- `user?: DocumentOwnerSummaryDto`.
- `deletedAt: Date \| null`.
- `createdAt: Date`.
- `updatedAt: Date`.

### DocumentsPaginationDto

Source: `src/modules/documents/dto/paginated-documents-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `page` | number | yes |  |
| `limit` | number | yes |  |
| `total` | number | yes |  |
| `totalPages` | number | yes |  |
| `hasNextPage` | boolean | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `page: number`.
- `limit: number`.
- `total: number`.
- `totalPages: number`.
- `hasNextPage: boolean`.

### PaginatedDocumentsResponseDto

Source: `src/modules/documents/dto/paginated-documents-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `documents` | Array<DocumentResponseDto> | yes |  |
| `pagination` | DocumentsPaginationDto | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `documents: DocumentResponseDto[]`.
- `pagination: DocumentsPaginationDto`.

### ReviewDocumentDto

Source: `src/modules/documents/dto/review-document.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `status` | string [APPROVED, REJECTED, REQUIRES_INFO] | yes |  |
| `notes` | string | no | Required when rejecting or requesting more information. Emailed to the document owner.; maxLength=2000 |

Source validation/defaults (override generated documentation where inconsistent):

- `status: ReviewDecision` — `@IsIn(REVIEW_DECISIONS)`.
- `notes?: string` — `@IsOptional() @IsString() @MaxLength(2000)`.

### CreateUploadUrlDto

Source: `src/modules/documents/dto/create-upload-url.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `contentType` | string | yes | MIME type the file will be uploaded with; example="application/pdf" |
| `sizeBytes` | number | yes | Size of the file in bytes; minimum=1 |

Source validation/defaults (override generated documentation where inconsistent):

- `contentType: string` — `@IsString() @MaxLength(255) @Matches(/^[\w.+-]+\/[\w.+-]+$/, { message: 'contentType must be a valid MIME type' })`.
- `sizeBytes: number` — `@IsInt() @Min(1)`.

### CompleteUploadDto

Source: `src/modules/documents/dto/complete-upload.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `fileKey` | string | yes | The fileKey returned by the upload-url endpoint |
| `originalName` | string | yes | example="dbs-certificate.pdf" |
| `documentExpiryDate` | object or null | no | format="date-time" |

Source validation/defaults (override generated documentation where inconsistent):

- `fileKey: string` — `@IsString() @IsNotEmpty() @MaxLength(512)`.
- `originalName: string` — `@IsString() @IsNotEmpty() @MaxLength(255) @Matches(/^[^\r\n/\\]+$/, { message: 'originalName must be a plain file name' })`.
- `documentExpiryDate?: string \| null` — `@IsOptional() @IsDateString()`.

### UpdateDocumentDto

Source: `src/modules/documents/dto/update-document.dto.ts` — `extends PartialType(CreateDocumentDto)`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `requirementId` | string | no |  |
| `applicationId` | object or null | no |  |

### JobResponseDto

Source: `src/modules/jobs/dto/job-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `jobType` | string [INSTANT, BRIEF] | yes |  |
| `canDelete` | boolean | yes | Only a never-published, unused draft can be permanently deleted |
| `termsLocked` | boolean | yes | Material terms are frozen once an application, invitation or booking exists |
| `hasBeenPublished` | boolean | yes |  |
| `id` | string | yes |  |
| `postedByUserId` | string | yes |  |
| `institution` | object or null | no | Safe public identity of the school behind the job; null for an admin-posted job |
| `title` | string | yes |  |
| `description` | string | yes |  |
| `subject` | object or null | no |  |
| `subjects` | Array<string> | yes | All selected subjects; subject is the first value for older clients. |
| `requiredSkills` | Array<string> | yes |  |
| `minExperienceYears` | object or null | no |  |
| `address` | object or null | no |  |
| `city` | object or null | no |  |
| `county` | object or null | no |  |
| `postalCode` | object or null | no |  |
| `countryCode` | string | yes | example="GB" |
| `latitude` | object or null | no | example=51.5014 |
| `longitude` | object or null | no | example=-0.1419 |
| `startDate` | object or null | no |  |
| `endDate` | object or null | no |  |
| `keyStages` | Array<string> | yes |  |
| `parkingInfo` | object or null | no |  |
| `payAmount` | object or null | no |  |
| `payType` | object or null | no |  |
| `currency` | string | yes | example="GBP" |
| `paymentFrequency` | string | yes | example="weekly" |
| `periodAnchor` | string [ASSIGNMENT_START, CALENDAR] | yes |  |
| `timeZone` | string | yes | example="Europe/London" |
| `schedule` | object or null | no |  |
| `workersRequired` | number | yes | minimum=1 |
| `scheduledMinutes` | object or null | no |  |
| `assignmentDuration` | string [SHORT_TERM, EXTENDED] or null | no |  |
| `scheduleSummary` | object or null | no |  |
| `hours` | number or null | no | Total planned hours for an hourly job; example=4 |
| `days` | number or null | no | Total planned days for a daily job; example=2 |
| `status` | string [DRAFT, ACTIVE, RESERVED, EXPIRED, FILLED, CLOSED, SUSPENDED] | yes |  |
| `liveFrom` | object or null | no | Public listing opens at this timestamp, provided status is ACTIVE. |
| `expiresAt` | object or null | no |  |
| `createdAt` | string | no | format="date-time" |
| `updatedAt` | string | no | format="date-time" |

Source validation/defaults (override generated documentation where inconsistent):

- `jobType: JobType`.
- `canDelete: boolean`.
- `termsLocked: boolean`.
- `hasBeenPublished: boolean`.
- `id: string`.
- `postedByUserId: string`.
- `institution: { id: string; name: string; imageUrl: string \| null; schoolType: SchoolType \| null } \| null`.
- `title: string`.
- `description: string`.
- `subject?: string \| null`.
- `subjects: string[]`.
- `requiredSkills: string[]`.
- `minExperienceYears?: number \| null`.
- `address?: string \| null`.
- `city?: string \| null`.
- `county?: string \| null`.
- `postalCode?: string \| null`.
- `countryCode: string`.
- `latitude?: number \| null`.
- `longitude?: number \| null`.
- `startDate?: Date \| null`.
- `endDate?: Date \| null`.
- `keyStages: string[]`.
- `parkingInfo?: string \| null`.
- `payAmount?: number \| null`.
- `payType?: string \| null`.
- `currency: string`.
- `paymentFrequency: string`.
- `periodAnchor: string`.
- `timeZone: string`.
- `schedule: unknown`.
- `workersRequired: number`.
- `scheduledMinutes: number \| null`.
- `assignmentDuration: string \| null`.
- `scheduleSummary: unknown`.
- `hours: number \| null`.
- `days: number \| null`.
- `status: JobStatus`.
- `liveFrom?: Date \| null`.
- `expiresAt?: Date \| null`.
- `createdAt?: Date`.
- `updatedAt?: Date`.

### CreateJobDto

Source: `src/modules/jobs/dto/create-job.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `jobType` | string [INSTANT, BRIEF] | yes |  |
| `title` | string | yes |  |
| `description` | string | yes |  |
| `subject` | string | no | Legacy single subject. Prefer subjects from GET /api/teaching-catalogue. |
| `subjects` | Array<string> | no | Multiple catalogue subject names. Skills must belong to these subjects or sharedSkills. |
| `otherSubjects` | Array<string> | no | Custom subject names when subjects includes Other. Stored as actual names in the response subjects array. |
| `requiredSkills` | Array<string> | no | Skills the poster wants an applicant to hold; matched against instructor skills; example=["Classroom management","SEN"] |
| `otherSkills` | Array<string> | no | Custom skill names when requiredSkills includes Other. Stored as actual names in requiredSkills. |
| `minExperienceYears` | number | no | Minimum years of teaching experience an applicant should have; example=2 |
| `address` | string | no | example="1 School Lane" |
| `city` | string | no | example="London" |
| `county` | string | no | example="Greater London" |
| `postalCode` | string | no | example="SW1A 2AA" |
| `countryCode` | string | no | default="GB"; example="GB" |
| `latitude` | number | no | Latitude of the job address. Must be sent together with longitude; minimum=-90; maximum=90; example=51.5014 |
| `longitude` | number | no | Longitude of the job address. Must be sent together with latitude; minimum=-180; maximum=180; example=-0.1419 |
| `startDate` | string | no | Date-only assignment start (YYYY-MM-DD), after listing opening and the final listing day.; example="2026-11-04" |
| `endDate` | string | no | Date-only assignment end (YYYY-MM-DD), on or after startDate.; example="2026-12-18" |
| `keyStages` | Array<string> | no |  |
| `parkingInfo` | string | no |  |
| `payAmount` | number | no |  |
| `payType` | string | no | hourly \| daily \| fixed |
| `currency` | string | no | Billing currency supported by the current payment provider; default="GBP"; example="GBP" |
| `paymentFrequency` | string [hourly, daily, weekly, monthly, completion, milestone] | no |  |
| `periodAnchor` | string [ASSIGNMENT_START, CALENDAR] | no | default="ASSIGNMENT_START" |
| `timeZone` | string | no | default="Europe/London"; example="Europe/London" |
| `schedule` | object | no | Recurring weekday slots plus date-specific additions, exclusions and replacements |
| `workersRequired` | number | no | minimum=1; maximum=100; default=1 |
| `hours` | number or null | no | Optional total planned hours for the whole hourly job. Omit or use null when not specified.; minimum=1; maximum=2147483647; example=4 |
| `days` | number or null | no | Optional total planned days for the whole daily job. Omit or use null when not specified.; minimum=1; maximum=2147483647; example=2 |
| `liveFrom` | object or null | no | Listing opens at this timestamp, or at midnight Europe/London for YYYY-MM-DD. Must be before work starts and not after expiry. Null means immediately once ACTIVE.; example="2026-10-20T00:00:00+01:00" |
| `expiresAt` | string | no | Exclusive timestamp deadline, or inclusive final Europe/London day for YYYY-MM-DD. Cannot precede liveFrom or extend into work. The same listing day as liveFrom is allowed. |

Source validation/defaults (override generated documentation where inconsistent):

- `jobType: JobType` — `@IsEnum(JobType)`.
- `title: string` — `@IsString() @IsNotEmpty()`.
- `description: string` — `@IsString() @IsNotEmpty()`.
- `subject?: string` — `@IsOptional() @IsString() @MaxLength(100)`.
- `subjects?: string[]` — `@IsOptional() @IsArray() @ArrayUnique() @ArrayMaxSize(50) @IsString({ each: true }) @IsNotEmpty({ each: true }) @MaxLength(100, { each: true })`.
- `otherSubjects?: string[]` — `@IsOptional() @IsArray() @ArrayUnique() @ArrayMaxSize(50) @IsString({ each: true }) @IsNotEmpty({ each: true }) @MaxLength(100, { each: true })`.
- `requiredSkills?: string[]` — `@IsOptional() @IsArray() @ArrayUnique() @ArrayMaxSize(50) @IsString({ each: true }) @IsNotEmpty({ each: true }) @MaxLength(100, { each: true })`.
- `otherSkills?: string[]` — `@IsOptional() @IsArray() @ArrayUnique() @ArrayMaxSize(50) @IsString({ each: true }) @IsNotEmpty({ each: true }) @MaxLength(100, { each: true })`.
- `minExperienceYears?: number` — `@IsOptional() @IsInt() @Min(0)`.
- `address?: string` — `@IsOptional() @IsString() @MaxLength(250)`.
- `city?: string` — `@IsOptional() @IsString() @MaxLength(100)`.
- `county?: string` — `@IsOptional() @IsString() @MaxLength(100)`.
- `postalCode?: string` — `@IsOptional() @IsString() @MaxLength(20)`.
- `countryCode?: string` — `@IsOptional() @IsISO31661Alpha2()`.
- `latitude?: number` — `@ValidateIf(hasAnyCoordinate) @IsNumber() @Min(-90) @Max(90)`.
- `longitude?: number` — `@ValidateIf(hasAnyCoordinate) @IsNumber() @Min(-180) @Max(180)`.
- `startDate?: string` — `@IsOptional() @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate must use YYYY-MM-DD without a time' })`.
- `endDate?: string` — `@IsOptional() @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate must use YYYY-MM-DD without a time' })`.
- `keyStages?: string[]` — `@IsOptional() @IsArray() @ArrayUnique() @IsString({ each: true }) @IsNotEmpty({ each: true })`.
- `parkingInfo?: string` — `@IsOptional() @IsString() @MaxLength(1000)`.
- `payAmount?: number` — `@IsOptional() @IsNumber() @Min(0)`.
- `payType?: string` — `@IsOptional() @IsString() @IsEnum(PayType)`.
- `currency?: string` — `@IsOptional() @IsIn(['GBP'])`.
- `paymentFrequency?: string` — `@IsOptional() @IsIn(['hourly', 'daily', 'weekly', 'monthly', 'completion', 'milestone'])`.
- `periodAnchor?: string` — `@IsOptional() @IsIn(['ASSIGNMENT_START', 'CALENDAR'])`.
- `timeZone?: string` — `@IsOptional() @IsString() @MaxLength(100)`.
- `schedule?: Record<string, unknown>` — `@IsOptional() @IsObject()`.
- `workersRequired?: number` — `@IsOptional() @IsInt() @Min(1) @Max(100)`.
- `hours?: number \| null` — `@IsOptional() @IsInt() @Min(1) @Max(2147483647)`.
- `days?: number \| null` — `@IsOptional() @IsInt() @Min(1) @Max(2147483647)`.
- `liveFrom?: string \| null` — `@IsOptional() @IsDateString({ strict: true })`.
- `expiresAt?: string` — `@IsOptional() @IsDateString({ strict: true })`.

### JobsPaginationDto

Source: `src/modules/jobs/dto/paginated-jobs-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `page` | number | yes |  |
| `limit` | number | yes |  |
| `total` | number | yes |  |
| `totalPages` | number | yes |  |
| `hasNextPage` | boolean | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `page: number`.
- `limit: number`.
- `total: number`.
- `totalPages: number`.
- `hasNextPage: boolean`.

### PaginatedJobsResponseDto

Source: `src/modules/jobs/dto/paginated-jobs-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `jobs` | Array<JobResponseDto> | yes |  |
| `pagination` | JobsPaginationDto | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `jobs: JobResponseDto[]`.
- `pagination: JobsPaginationDto`.

### JobStatusCountsDto

Source: `src/modules/jobs/dto/paginated-jobs-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `ALL` | number | yes | Every job they posted |
| `DRAFT` | number | yes |  |
| `ACTIVE` | number | yes |  |
| `RESERVED` | number | yes |  |
| `EXPIRED` | number | yes |  |
| `FILLED` | number | yes |  |
| `CLOSED` | number | yes |  |
| `SUSPENDED` | number | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `ALL: number`.
- `DRAFT: number`.
- `ACTIVE: number`.
- `RESERVED: number`.
- `EXPIRED: number`.
- `FILLED: number`.
- `CLOSED: number`.
- `SUSPENDED: number`.

### MyJobsResponseDto

Source: `src/modules/jobs/dto/paginated-jobs-response.dto.ts` — `extends PaginatedJobsResponseDto`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `jobs` | Array<JobResponseDto> | yes |  |
| `pagination` | JobsPaginationDto | yes |  |
| `statusCounts` | JobStatusCountsDto | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `statusCounts: JobStatusCountsDto`.

### UpdateJobDto

Source: `src/modules/jobs/dto/update-job.dto.ts` — `extends PartialType(CreateJobDto)`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `jobType` | string [INSTANT, BRIEF] | no |  |
| `title` | string | no |  |
| `description` | string | no |  |
| `subject` | string | no | Legacy single subject. Prefer subjects from GET /api/teaching-catalogue. |
| `subjects` | Array<string> | no | Multiple catalogue subject names. Skills must belong to these subjects or sharedSkills. |
| `otherSubjects` | Array<string> | no | Custom subject names when subjects includes Other. Stored as actual names in the response subjects array. |
| `requiredSkills` | Array<string> | no | Skills the poster wants an applicant to hold; matched against instructor skills; example=["Classroom management","SEN"] |
| `otherSkills` | Array<string> | no | Custom skill names when requiredSkills includes Other. Stored as actual names in requiredSkills. |
| `minExperienceYears` | number | no | Minimum years of teaching experience an applicant should have; example=2 |
| `address` | string | no | example="1 School Lane" |
| `city` | string | no | example="London" |
| `county` | string | no | example="Greater London" |
| `postalCode` | string | no | example="SW1A 2AA" |
| `countryCode` | string | no | default="GB"; example="GB" |
| `latitude` | number | no | Latitude of the job address. Must be sent together with longitude; minimum=-90; maximum=90; example=51.5014 |
| `longitude` | number | no | Longitude of the job address. Must be sent together with latitude; minimum=-180; maximum=180; example=-0.1419 |
| `startDate` | string | no | Date-only assignment start (YYYY-MM-DD), after listing opening and the final listing day.; example="2026-11-04" |
| `endDate` | string | no | Date-only assignment end (YYYY-MM-DD), on or after startDate.; example="2026-12-18" |
| `keyStages` | Array<string> | no |  |
| `parkingInfo` | string | no |  |
| `payAmount` | number | no |  |
| `payType` | string | no | hourly \| daily \| fixed |
| `currency` | string | no | Billing currency supported by the current payment provider; default="GBP"; example="GBP" |
| `paymentFrequency` | string [hourly, daily, weekly, monthly, completion, milestone] | no |  |
| `periodAnchor` | string [ASSIGNMENT_START, CALENDAR] | no | default="ASSIGNMENT_START" |
| `timeZone` | string | no | default="Europe/London"; example="Europe/London" |
| `schedule` | object | no | Recurring weekday slots plus date-specific additions, exclusions and replacements |
| `workersRequired` | number | no | minimum=1; maximum=100; default=1 |
| `hours` | number or null | no | Optional total planned hours for the whole hourly job. Omit or use null when not specified.; minimum=1; maximum=2147483647; example=4 |
| `days` | number or null | no | Optional total planned days for the whole daily job. Omit or use null when not specified.; minimum=1; maximum=2147483647; example=2 |
| `liveFrom` | object or null | no | Listing opens at this timestamp, or at midnight Europe/London for YYYY-MM-DD. Must be before work starts and not after expiry. Null means immediately once ACTIVE.; example="2026-10-20T00:00:00+01:00" |
| `expiresAt` | string | no | Exclusive timestamp deadline, or inclusive final Europe/London day for YYYY-MM-DD. Cannot precede liveFrom or extend into work. The same listing day as liveFrom is allowed. |
| `status` | string [DRAFT, ACTIVE, RESERVED, EXPIRED, FILLED, CLOSED, SUSPENDED] | no | example="ACTIVE" |

Source validation/defaults (override generated documentation where inconsistent):

- `status?: JobStatus` — `@IsOptional() @IsEnum(JobStatus)`.

### ApplicationJobDetailsDto

Source: `src/modules/applications/dto/application-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `description` | string | yes |  |
| `subject` | object or null | yes |  |
| `city` | object or null | yes |  |
| `county` | object or null | yes |  |
| `postalCode` | object or null | yes |  |
| `startDate` | string or null | yes | format="date-time" |
| `endDate` | string or null | yes | format="date-time" |
| `payAmount` | number or null | yes |  |
| `payType` | object or null | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `description: string`.
- `subject: string \| null`.
- `city: string \| null`.
- `county: string \| null`.
- `postalCode: string \| null`.
- `startDate: Date \| null`.
- `endDate: Date \| null`.
- `payAmount: number \| null`.
- `payType: string \| null`.

### ApplicationSchoolDto

Source: `src/modules/applications/dto/application-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `name` | string | yes |  |
| `imageUrl` | object or null | no |  |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `name: string`.
- `imageUrl?: string \| null`.

### ApplicationResponseDto

Source: `src/modules/applications/dto/application-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `agreedTerms` | object or null | yes | Immutable application-time offer. Null for legacy applications; those require a new accepted invitation before hiring. |
| `bookingTerms` | object or null | yes | Final immutable booking terms after hiring. Payment fields may differ from agreedTerms when the school recorded negotiated booking-only terms. |
| `termsStatus` | string [RECORDED, LEGACY_UNVERIFIED] | yes |  |
| `automaticallyRejectedCount` | number | no | Other active applications rejected atomically by this hire; minimum=0 |
| `scheduleConflict` | object or null | no | Latest availability revalidation; never auto-cancels an accepted booking |
| `jobDetails` | ApplicationJobDetailsDto | no | Stored job context accessible to application participants even when the public listing expires |
| `school` | ApplicationSchoolDto | no | Hiring school, also available after the job listing closes |
| `bookingId` | object or null | no |  |
| `conversationId` | object or null | no |  |
| `id` | string | yes |  |
| `jobId` | string | yes |  |
| `jobName` | string | yes | Job title when the application was submitted |
| `instructorId` | string | yes |  |
| `status` | string [APPLIED, VIEWED, SHORTLISTED, HIRED, REJECTED] | yes |  |
| `coverLetter` | object or null | no |  |
| `createdAt` | string | no | format="date-time" |
| `updatedAt` | string | no | format="date-time" |

Source validation/defaults (override generated documentation where inconsistent):

- `agreedTerms: ReturnType<typeof offeredJob> \| null`.
- `bookingTerms: ReturnType<typeof offeredJob> \| null`.
- `termsStatus: 'RECORDED' \| 'LEGACY_UNVERIFIED'`.
- `automaticallyRejectedCount?: number`.
- `scheduleConflict?: Prisma.JsonValue \| null`.
- `jobDetails?: ApplicationJobDetailsDto \| null`.
- `school?: ApplicationSchoolDto \| null`.
- `bookingId?: string \| null`.
- `conversationId?: string \| null`.
- `id: string`.
- `jobId: string`.
- `jobName: string`.
- `instructorId: string`.
- `status: ApplicationStatus`.
- `coverLetter?: string \| null`.
- `createdAt?: Date`.
- `updatedAt?: Date`.

### CreateApplicationDto

Source: `src/modules/applications/dto/create-application.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `jobId` | string | yes |  |
| `coverLetter` | string | no |  |

Source validation/defaults (override generated documentation where inconsistent):

- `jobId: string` — `@IsUUID() @IsNotEmpty()`.
- `coverLetter?: string` — `@IsOptional() @IsString() @MaxLength(2000)`.

### ApplicationsPaginationDto

Source: `src/modules/applications/dto/paginated-applications-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `page` | number | yes | example=1 |
| `limit` | number | yes | example=20 |
| `total` | number | yes | example=45 |
| `totalPages` | number | yes | example=3 |
| `hasNextPage` | boolean | yes | example=true |

Source validation/defaults (override generated documentation where inconsistent):

- `page: number`.
- `limit: number`.
- `total: number`.
- `totalPages: number`.
- `hasNextPage: boolean`.

### PaginatedApplicationsResponseDto

Source: `src/modules/applications/dto/paginated-applications-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `applications` | Array<ApplicationResponseDto> | yes |  |
| `pagination` | ApplicationsPaginationDto | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `applications: ApplicationResponseDto[]`.
- `pagination: ApplicationsPaginationDto`.

### ApplicationHistoryEntryDto

Source: `src/modules/applications/dto/application-history-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `applicationId` | string | yes |  |
| `fromStatus` | string [APPLIED, VIEWED, SHORTLISTED, HIRED, REJECTED] or null | no | Null for the first entry |
| `toStatus` | string [APPLIED, VIEWED, SHORTLISTED, HIRED, REJECTED] | yes |  |
| `changedBy` | string | yes | The user who made the change |
| `createdAt` | string | yes | format="date-time" |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `applicationId: string`.
- `fromStatus: ApplicationStatus \| null`.
- `toStatus: ApplicationStatus`.
- `changedBy: string`.
- `createdAt: Date`.

### PaginatedApplicationHistoryResponseDto

Source: `src/modules/applications/dto/application-history-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `history` | Array<ApplicationHistoryEntryDto> | yes | Oldest first, so it reads as a timeline |
| `pagination` | PaginationMetaDto | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `history: ApplicationHistoryEntryDto[]`.
- `pagination: PaginationMetaDto`.

### UpdateApplicationStatusDto

Source: `src/modules/applications/dto/update-application-status.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `status` | string [APPLIED, VIEWED, SHORTLISTED, HIRED, REJECTED] | yes | VIEWED and SHORTLISTED are optional. APPLIED, VIEWED, or SHORTLISTED can move directly to HIRED or REJECTED.; example="HIRED" |

Source validation/defaults (override generated documentation where inconsistent):

- `status: ApplicationStatus` — `@IsEnum(ApplicationStatus)`.

### HireApplicationDto

Source: `src/modules/applications/dto/hire-application.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `payAmount` | number | no | Negotiated rate or fixed total in GBP; example=20 |
| `payType` | string [hourly, daily, fixed] | no | Negotiated rate basis |
| `paymentFrequency` | string [hourly, daily, weekly, monthly, completion, milestone] | no | Negotiated payment release frequency |
| `periodAnchor` | string [ASSIGNMENT_START, CALENDAR] | no | How weekly or monthly periods are anchored |
| `hours` | number | no | Planned whole hours for hourly pay; minimum=1 |
| `days` | number | no | Planned whole days for daily pay; minimum=1 |

Source validation/defaults (override generated documentation where inconsistent):

- `payAmount?: number` — `@IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(99999999.99)`.
- `payType?: PayType` — `@IsOptional() @IsEnum(PayType)`.
- `paymentFrequency?: (typeof BOOKING_PAYMENT_FREQUENCIES)[number]` — `@IsOptional() @IsIn(BOOKING_PAYMENT_FREQUENCIES)`.
- `periodAnchor?: (typeof BOOKING_PERIOD_ANCHORS)[number]` — `@IsOptional() @IsIn(BOOKING_PERIOD_ANCHORS)`.
- `hours?: number` — `@IsOptional() @IsInt() @Min(1) @Max(2147483647)`.
- `days?: number` — `@IsOptional() @IsInt() @Min(1) @Max(2147483647)`.

### MatchFactorDto

Source: `src/modules/matching/dto/match-score.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `key` | string [subject, keyStages, skills, location, pay, verification, rating, experience] | yes | example="subject" |
| `label` | string | yes | example="Subject" |
| `weight` | number | yes | example=25 |
| `value` | number | yes | Unweighted contribution; minimum=0; maximum=1; example=1 |
| `applicable` | boolean | yes | False when the job gives nothing to compare on; example=true |
| `detail` | string | yes | example="Teaches Mathematics" |

Source validation/defaults (override generated documentation where inconsistent):

- `key: MatchFactorKey`.
- `label: string`.
- `weight: number`.
- `value: number`.
- `applicable: boolean`.
- `detail: string`.

### MatchFlagsDto

Source: `src/modules/matching/dto/match-score.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `scheduleConflict` | boolean | yes | A required shift is unavailable or overlaps another booking; example=false |
| `outsideTravelRadius` | boolean | yes | Further away than the instructor is willing to travel; example=false |
| `distanceKnown` | boolean | yes | Both sides had coordinates, so distance is real rather than a text guess; example=true |

Source validation/defaults (override generated documentation where inconsistent):

- `scheduleConflict: boolean`.
- `outsideTravelRadius: boolean`.
- `distanceKnown: boolean`.

### MatchScoreDto

Source: `src/modules/matching/dto/match-score.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `score` | number | yes | minimum=0; maximum=100; example=89 |
| `distanceMiles` | object or null | no | example=4.1 |
| `factors` | Array<MatchFactorDto> | yes |  |
| `flags` | MatchFlagsDto | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `score: number`.
- `distanceMiles: number \| null`.
- `factors: MatchFactorDto[]`.
- `flags: MatchFlagsDto`.

### RecommendedJobDto

Source: `src/modules/matching/dto/match-responses.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `job` | JobResponseDto | yes |  |
| `match` | MatchScoreDto | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `job: JobResponseDto`.
- `match: MatchScoreDto`.

### MatchPaginationDto

Source: `src/modules/matching/dto/match-responses.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `page` | number | yes | example=1 |
| `limit` | number | yes | example=20 |
| `total` | number | yes | example=45 |
| `totalPages` | number | yes | example=3 |
| `hasNextPage` | boolean | yes | example=true |

Source validation/defaults (override generated documentation where inconsistent):

- `page: number`.
- `limit: number`.
- `total: number`.
- `totalPages: number`.
- `hasNextPage: boolean`.

### PaginatedRecommendedJobsResponseDto

Source: `src/modules/matching/dto/match-responses.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `jobs` | Array<RecommendedJobDto> | yes |  |
| `pagination` | MatchPaginationDto | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `jobs: RecommendedJobDto[]`.
- `pagination: MatchPaginationDto`.

### MatchedInstructorDto

Source: `src/modules/matching/dto/matched-instructor.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `fullName` | string | yes | example="Alex Morgan" |
| `imageUrl` | object or null | no |  |
| `city` | object or null | no | example="London" |
| `county` | object or null | no | example="Greater London" |
| `subjects` | Array<string> | yes | example=["Mathematics","Physics"] |
| `keyStages` | Array<string> | yes | example=["KS3","KS4"] |
| `skills` | Array<string> | yes | example=["SEN"] |
| `experience` | object or null | no | example=5 |
| `hourlyRate` | object or null | no | example=28 |
| `dailyRate` | object or null | no | example=180 |
| `currency` | object or null | no | example="GBP" |
| `maxTravelDistance` | object or null | no | example=10 |
| `ratingAverage` | number | yes | example=4.5 |
| `ratingCount` | number | yes | example=8 |
| `dbsVerified` | boolean | yes | example=true |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `fullName: string`.
- `imageUrl?: string \| null`.
- `city?: string \| null`.
- `county?: string \| null`.
- `subjects: string[]`.
- `keyStages: string[]`.
- `skills: string[]`.
- `experience?: number \| null`.
- `hourlyRate?: number \| null`.
- `dailyRate?: number \| null`.
- `currency?: string \| null`.
- `maxTravelDistance?: number \| null`.
- `ratingAverage: number`.
- `ratingCount: number`.
- `dbsVerified: boolean`.

### RankedApplicationDto

Source: `src/modules/matching/dto/match-responses.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `application` | ApplicationResponseDto | yes |  |
| `instructor` | MatchedInstructorDto | yes |  |
| `match` | MatchScoreDto | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `application: ApplicationResponseDto`.
- `instructor: MatchedInstructorDto`.
- `match: MatchScoreDto`.

### PaginatedRankedApplicationsResponseDto

Source: `src/modules/matching/dto/match-responses.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `applications` | Array<RankedApplicationDto> | yes |  |
| `pagination` | MatchPaginationDto | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `applications: RankedApplicationDto[]`.
- `pagination: MatchPaginationDto`.

### RecommendedInstructorDto

Source: `src/modules/matching/dto/match-responses.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `application` | object or null | yes | example={"id":"application-id","status":"APPLIED"} |
| `invitation` | object or null | yes | example={"id":"invitation-id","status":"PENDING","expiresAt":"2030-11-01T12:00:00Z","isExclusive":false} |
| `canInvite` | boolean | yes | example=true |
| `inviteDisabledReason` | object or null | yes | JOB_UNAVAILABLE, ALREADY_BOOKED, APPLICATION_REJECTED, INVITATION_DECLINED, INVITATION_PENDING, SCHOOL_ONLY, or null; example="INVITATION_PENDING" |
| `instructor` | MatchedInstructorDto | yes |  |
| `match` | MatchScoreDto | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `application: { id: string; status: string } \| null`.
- `invitation: { id: string; status: string; expiresAt: Date; isExclusive: boolean } \| null`.
- `canInvite: boolean`.
- `inviteDisabledReason: string \| null`.
- `instructor: MatchedInstructorDto`.
- `match: MatchScoreDto`.

### PaginatedRecommendedInstructorsResponseDto

Source: `src/modules/matching/dto/match-responses.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `instructors` | Array<RecommendedInstructorDto> | yes |  |
| `pagination` | MatchPaginationDto | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `instructors: RecommendedInstructorDto[]`.
- `pagination: MatchPaginationDto`.

### BookingJobSummaryDto

Source: `src/modules/bookings/dto/booking-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `title` | string | yes |  |
| `description` | string | yes |  |
| `subject` | object or null | no |  |
| `subjects` | Array<string> | yes |  |
| `keyStages` | Array<string> | yes |  |
| `address` | object or null | no |  |
| `city` | object or null | no |  |
| `county` | object or null | no |  |
| `postalCode` | object or null | no |  |
| `parkingInfo` | object or null | no |  |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `title: string`.
- `description: string`.
- `subject: string \| null`.
- `subjects: string[]`.
- `keyStages: string[]`.
- `address: string \| null`.
- `city: string \| null`.
- `county: string \| null`.
- `postalCode: string \| null`.
- `parkingInfo: string \| null`.

### BookingInstructorSummaryDto

Source: `src/modules/bookings/dto/booking-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `fullName` | string | yes |  |
| `imageUrl` | object or null | no |  |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `fullName: string`.
- `imageUrl: string \| null`.

### BookingInstitutionSummaryDto

Source: `src/modules/bookings/dto/booking-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `name` | string | yes |  |
| `imageUrl` | object or null | no |  |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `name: string`.
- `imageUrl: string \| null`.

### BookingAttendanceShiftDto

Source: `src/modules/bookings/dto/booking-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `workDate: Date`.
- `scheduledStart: Date`.
- `scheduledEnd: Date`.
- `timeZone: string`.
- `status: AttendanceStatus`.
- `decisionSource: AttendanceDecisionSource \| null`.
- `reason: string \| null`.
- `notifiedAt: Date \| null`.
- `responseDeadline: Date \| null`.
- `decidedAt: Date \| null`.
- `audits: AttendanceAuditDto[]`.
- `correctionRequests: AttendanceCorrectionRequestDto[]`.

### BookingAttendanceAdjustmentDto

Source: `src/modules/bookings/dto/booking-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `shiftId: string`.
- `amountPence: number`.
- `reason: string`.
- `status: string`.
- `createdAt: Date`.

### ReviewResponseDto

Source: `src/modules/reviews/dto/review-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `bookingId` | string | yes |  |
| `reviewerType` | string [INSTITUTION, INSTRUCTOR] | yes | Who wrote the review; it is about the other party |
| `rating` | number | yes | minimum=1; maximum=5; example=5 |
| `comment` | object or null | no |  |
| `jobTitle` | string | no | Title of the job the booking was for. Present on profile review lists |
| `reviewerName` | string | no | School or teacher name of the author. Present on profile review lists |
| `createdAt` | string | yes | format="date-time" |
| `updatedAt` | string | yes | format="date-time" |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `bookingId: string`.
- `reviewerType: ReviewerType`.
- `rating: number`.
- `comment: string \| null`.
- `jobTitle?: string`.
- `reviewerName?: string`.
- `createdAt: Date`.
- `updatedAt: Date`.

### BookingInvoiceSummaryDto

Source: `src/modules/bookings/dto/booking-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `status` | string [PENDING, OPEN, PAID, UNCOLLECTIBLE] | yes |  |
| `billingPeriodKey` | object or null | no | example="month:2026-10" |
| `billingPeriodLabel` | object or null | no | example="On completion" |
| `collectionMethod` | string [send_invoice, charge_automatically] | yes |  |
| `totalAmountPence` | number | yes | What the school pays, in pence; example=91125 |
| `teacherAmountPence` | number | yes | Teacher ordinary earnings on this invoice, in pence; example=87500 |
| `hostedInvoiceUrl` | object or null | no | Stripe page where the school views and pays the invoice |
| `dueAt` | object or null | no |  |
| `paidAt` | object or null | no |  |
| `lastPaymentFailureMessage` | object or null | no |  |
| `lastPaymentFailureCode` | object or null | no |  |
| `paymentAttemptCount` | number | yes |  |
| `nextPaymentAttemptAt` | object or null | no |  |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `status: InvoiceStatus`.
- `billingPeriodKey: string \| null`.
- `billingPeriodLabel: string \| null`.
- `collectionMethod: string`.
- `totalAmountPence: number`.
- `teacherAmountPence: number`.
- `hostedInvoiceUrl: string \| null`.
- `dueAt: Date \| null`.
- `paidAt: Date \| null`.
- `lastPaymentFailureMessage: string \| null`.
- `lastPaymentFailureCode: string \| null`.
- `paymentAttemptCount: number`.
- `nextPaymentAttemptAt: Date \| null`.

### BookingAutomaticPaymentDto

Source: `src/modules/bookings/dto/booking-response.dto.ts` — `implements BookingAutomaticPayment`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `state` | string [DISABLED, BLOCKED, REVIEW_REQUIRED, WAITING_ATTENDANCE, NOT_DUE, NO_PAYMENT_DUE, PREPARING, SCHEDULED, PROCESSING, FAILED, PAID] | yes |  |
| `message` | string | yes | Why payment is due, pending, blocked or not payable, derived from server records |
| `nextCollectionAt` | object or null | no |  |

Source validation/defaults (override generated documentation where inconsistent):

- `state: BookingAutomaticPaymentState`.
- `message: string`.
- `nextCollectionAt: Date \| null`.

### BookingTipSummaryDto

Source: `src/modules/bookings/dto/booking-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `status` | string [PENDING, PROCESSING, PAID, FAILED, CANCELLED, REFUNDED] | yes |  |
| `tipAmountPence` | number | yes | Gratuity allocated to the teacher, in pence |
| `feeAmountPence` | number | yes | SupplyEd processing fee added on top, in pence |
| `totalAmountPence` | number | yes | Total charged to the school, in pence |
| `paymentFailureMessage` | object or null | no |  |
| `paidAt` | object or null | no |  |
| `amountRefundedPence` | number | yes |  |
| `disputeStatus` | object or null | no |  |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `status: BookingTipStatus`.
- `tipAmountPence: number`.
- `feeAmountPence: number`.
- `totalAmountPence: number`.
- `paymentFailureMessage: string \| null`.
- `paidAt: Date \| null`.
- `amountRefundedPence: number`.
- `disputeStatus: string \| null`.

### BookingResponseDto

Source: `src/modules/bookings/dto/booking-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `agreedTerms` | object or null | yes | Complete immutable accepted terms. Null for historical records without a full snapshot. |
| `termsStatus` | string [RECORDED, LEGACY_PARTIAL] | yes |  |
| `id` | string | yes |  |
| `applicationId` | string | yes |  |
| `source` | string [APPLICATION, DIRECT_HIRE] | yes | How the booking was created |
| `status` | string [CONFIRMED, COMPLETED, CANCELLED, NO_SHOW] | yes |  |
| `job` | BookingJobSummaryDto | yes |  |
| `instructor` | BookingInstructorSummaryDto | yes |  |
| `institution` | BookingInstitutionSummaryDto | yes |  |
| `startDate` | object or null | no | Copied from the job when the instructor was hired |
| `endDate` | object or null | no | Copied from the job when the instructor was hired |
| `payAmount` | object or null | no | Agreed pay, copied from the job when the instructor was hired |
| `payType` | object or null | no |  |
| `currency` | string | yes | example="GBP" |
| `paymentFrequency` | object or null | no |  |
| `periodAnchor` | string [ASSIGNMENT_START, CALENDAR] | yes |  |
| `timeZone` | string | yes | example="Europe/London" |
| `schedule` | object or null | no | Immutable booked weekdays and shift start/end times copied from the job at confirmation |
| `attendancePolicyEffectiveAt` | object or null | no | Prospective attendance policy start; null for legacy bookings |
| `attendanceShifts` | Array<BookingAttendanceShiftDto> | yes |  |
| `attendancePayroll` | object or null | no |  |
| `attendanceAdjustments` | Array<BookingAttendanceAdjustmentDto> | yes |  |
| `scheduledMinutes` | object or null | no | Total minutes across every booked shift |
| `hours` | number or null | no | Agreed total hours, copied from the hourly job when the instructor was hired |
| `days` | number or null | no | Agreed total days, copied from the daily job when the instructor was hired |
| `completedAt` | object or null | no |  |
| `cancelledAt` | object or null | no |  |
| `cancelledById` | object or null | no | User who cancelled the booking |
| `cancelReason` | object or null | no |  |
| `reviews` | Array<ReviewResponseDto> | yes | At most one review from each party |
| `invoice` | BookingInvoiceSummaryDto | no | The current invoice for this booking; null until it is invoiced |
| `automaticPayment` | BookingAutomaticPaymentDto | yes |  |
| `tip` | BookingTipSummaryDto | no | Optional one-time gratuity after completion; separate from the booking invoice |
| `createdAt` | string | yes | format="date-time" |
| `updatedAt` | string | yes | format="date-time" |

Source validation/defaults (override generated documentation where inconsistent):

- `agreedTerms: ReturnType<typeof offeredJob> \| null`.
- `termsStatus: 'RECORDED' \| 'LEGACY_PARTIAL'`.
- `id: string`.
- `applicationId: string`.
- `source: string`.
- `status: BookingStatus`.
- `job: BookingJobSummaryDto`.
- `instructor: BookingInstructorSummaryDto`.
- `institution: BookingInstitutionSummaryDto`.
- `startDate: Date \| null`.
- `endDate: Date \| null`.
- `payAmount: number \| null`.
- `payType: string \| null`.
- `currency: string`.
- `paymentFrequency: string \| null`.
- `periodAnchor: string`.
- `timeZone: string`.
- `schedule: unknown`.
- `attendancePolicyEffectiveAt: Date \| null`.
- `attendanceShifts: BookingAttendanceShiftDto[]`.
- `attendancePayroll: AttendancePayrollSummary \| null`.
- `attendanceAdjustments: BookingAttendanceAdjustmentDto[]`.
- `scheduledMinutes: number \| null`.
- `hours: number \| null`.
- `days: number \| null`.
- `completedAt: Date \| null`.
- `cancelledAt: Date \| null`.
- `cancelledById: string \| null`.
- `cancelReason: string \| null`.
- `reviews: ReviewResponseDto[]`.
- `invoice: BookingInvoiceSummaryDto \| null`.
- `automaticPayment: BookingAutomaticPaymentDto`.
- `tip: BookingTipSummaryDto \| null`.
- `createdAt: Date`.
- `updatedAt: Date`.

### BookingsPaginationDto

Source: `src/modules/bookings/dto/paginated-bookings-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `page` | number | yes | example=1 |
| `limit` | number | yes | example=20 |
| `total` | number | yes | example=45 |
| `totalPages` | number | yes | example=3 |
| `hasNextPage` | boolean | yes | example=true |

Source validation/defaults (override generated documentation where inconsistent):

- `page: number`.
- `limit: number`.
- `total: number`.
- `totalPages: number`.
- `hasNextPage: boolean`.

### PaginatedBookingsResponseDto

Source: `src/modules/bookings/dto/paginated-bookings-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `bookings` | Array<BookingResponseDto> | yes |  |
| `pagination` | BookingsPaginationDto | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `bookings: BookingResponseDto[]`.
- `pagination: BookingsPaginationDto`.

### CancelBookingDto

Source: `src/modules/bookings/dto/cancel-booking.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `reason` | string | yes | maxLength=1000; example="Instructor is unwell" |

Source validation/defaults (override generated documentation where inconsistent):

- `reason: string` — `@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @IsNotEmpty() @MaxLength(1000)`.

### RespondAttendanceDto

Source: `src/modules/bookings/dto/attendance.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|

Source validation/defaults (override generated documentation where inconsistent):

- `status: 'PRESENT' \| 'ABSENT'` — `@IsIn(DECISIONS)`.
- `reason?: string` — `@IsOptional() @IsString() @MaxLength(500)`.

### CorrectAttendanceDto

Source: `src/modules/bookings/dto/attendance.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|

Source validation/defaults (override generated documentation where inconsistent):

- `status: 'PRESENT' \| 'ABSENT'` — `@IsIn(DECISIONS)`.
- `reason: string` — `@IsString() @MinLength(3) @MaxLength(1000)`.

### ReviewAttendanceCorrectionDto

Source: `src/modules/bookings/dto/attendance.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|

Source validation/defaults (override generated documentation where inconsistent):

- `decision: 'APPROVED' \| 'REJECTED'` — `@IsIn(['APPROVED', 'REJECTED'])`.
- `reason: string` — `@IsString() @MinLength(3) @MaxLength(1000)`.

### JobInvitationResponseDto

Source: `src/modules/bookings/dto/job-invitation-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `jobType` | string [INSTANT, BRIEF] | yes |  |
| `isExclusive` | boolean | yes |  |
| `id` | string | yes |  |
| `status` | string [PENDING, ACCEPTED, DECLINED, CANCELLED, EXPIRED] | yes |  |
| `job` | object | yes | Snapshot of the offered job, including dates, pay, hours, days and location |
| `jobStatus` | string [DRAFT, ACTIVE, RESERVED, EXPIRED, FILLED, CLOSED, SUSPENDED] | yes |  |
| `instructor` | object | yes |  |
| `institution` | object | yes |  |
| `message` | string or null | yes |  |
| `publishOnDecline` | boolean | yes |  |
| `expiresAt` | string | yes | format="date-time" |
| `decidedAt` | string or null | yes | format="date-time" |
| `bookingId` | string or null | yes |  |
| `invitationPath` | string | yes |  |
| `invitationUrl` | string or null | yes |  |
| `createdAt` | string | yes | format="date-time" |
| `updatedAt` | string | yes | format="date-time" |

Source validation/defaults (override generated documentation where inconsistent):

- `jobType: JobType`.
- `isExclusive: boolean`.
- `id: string`.
- `status: JobInvitationStatus`.
- `job: ReturnType<typeof offeredJob>`.
- `jobStatus: JobStatus`.
- `instructor: { id: string; fullName: string; imageUrl: string \| null }`.
- `institution: { id: string; name: string; imageUrl: string \| null }`.
- `message: string \| null`.
- `publishOnDecline: boolean`.
- `expiresAt: Date`.
- `decidedAt: Date \| null`.
- `bookingId: string \| null`.
- `invitationPath: string`.
- `invitationUrl: string \| null`.
- `createdAt: Date`.
- `updatedAt: Date`.

### DirectHireDto

Source: `src/modules/bookings/dto/direct-hire.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `requestId` | string | yes | Client-generated UUID for this invitation. Reuse it with the same body on retries.; format="uuid" |
| `instructorId` | string | yes | Instructor profile ID, not login user ID; format="uuid" |
| `jobId` | string | no | Existing job owned by the school; mutually exclusive with newJob; format="uuid" |
| `newJob` | CreateJobDto | no | Create and immediately publish an INSTANT job and its non-exclusive invitation atomically. Scheduled jobs are not allowed. Requires complete role, location, future dates, positive pay and working hours (hourly) or days (daily). |
| `message` | string | no | maxLength=1000 |
| `expiresAt` | string | no | Future expiry, no later than job start or job expiry. Default: up to seven days. |

Source validation/defaults (override generated documentation where inconsistent):

- `requestId: string` — `@IsUUID()`.
- `instructorId: string` — `@IsUUID()`.
- `jobId?: string` — `@ValidateIf((_object, value: unknown) => value !== undefined) @IsUUID()`.
- `newJob?: CreateJobDto` — `@ValidateIf((_object, value: unknown) => value !== undefined) @IsObject() @ValidateNested() @Type(() => CreateJobDto)`.
- `message?: string` — `@ValidateIf((_object, value: unknown) => value !== undefined) @IsString() @MaxLength(1000)`.
- `expiresAt?: string` — `@ValidateIf((_object, value: unknown) => value !== undefined) @IsDateString()`.

### PaginatedJobInvitationsDto

Source: `src/modules/bookings/dto/job-invitation-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `invitations` | Array<JobInvitationResponseDto> | yes |  |
| `pagination` | PaginationMetaDto | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `invitations: JobInvitationResponseDto[]`.
- `pagination: PaginationMetaDto`.

### CreateReviewDto

Source: `src/modules/reviews/dto/create-review.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `bookingId` | string | yes | A completed booking the caller was a party to; format="uuid" |
| `rating` | number | yes | minimum=1; maximum=5; example=5 |
| `comment` | string | no | maxLength=2000; example="Well prepared and great with the class." |

Source validation/defaults (override generated documentation where inconsistent):

- `bookingId: string` — `@IsUUID()`.
- `rating: number` — `@IsInt() @Min(1) @Max(5)`.
- `comment?: string` — `@IsOptional() @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @MaxLength(2000)`.

### ReviewsPaginationDto

Source: `src/modules/reviews/dto/paginated-reviews-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `page` | number | yes | example=1 |
| `limit` | number | yes | example=20 |
| `total` | number | yes | example=45 |
| `totalPages` | number | yes | example=3 |
| `hasNextPage` | boolean | yes | example=true |

Source validation/defaults (override generated documentation where inconsistent):

- `page: number`.
- `limit: number`.
- `total: number`.
- `totalPages: number`.
- `hasNextPage: boolean`.

### PaginatedReviewsResponseDto

Source: `src/modules/reviews/dto/paginated-reviews-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `reviews` | Array<ReviewResponseDto> | yes |  |
| `pagination` | ReviewsPaginationDto | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `reviews: ReviewResponseDto[]`.
- `pagination: ReviewsPaginationDto`.

### SignatorySchoolDto

Source: `src/modules/signatory-approvals/dto/signatory-approval-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `name` | string | yes | example="Oak Primary School" |
| `registrationId` | object or null | no | School URN or registration number |
| `domain` | string | yes | example="oakprimary.sch.uk" |
| `address` | string | yes |  |
| `city` | string | yes |  |
| `postalCode` | object or null | no |  |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `name: string`.
- `registrationId: string \| null`.
- `domain: string`.
- `address: string`.
- `city: string`.
- `postalCode: string \| null`.

### SignatoryTrustDto

Source: `src/modules/signatory-approvals/dto/signatory-approval-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `name` | string | yes | example="Oak Learning Trust" |
| `companyNumber` | object or null | no | example="08123456" |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `name: string`.
- `companyNumber: string \| null`.

### SignatoryApprovalResponseDto

Source: `src/modules/signatory-approvals/dto/signatory-approval-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `status` | string [PENDING, APPROVED, DECLINED, EXPIRED, REVOKED] | yes |  |
| `school` | SignatorySchoolDto | yes |  |
| `trust` | SignatoryTrustDto | yes |  |
| `signatoryName` | string | yes |  |
| `signatoryEmail` | string | yes |  |
| `signatoryJobTitle` | string | yes |  |
| `expiresAt` | string | yes | format="date-time" |
| `decidedAt` | object or null | no |  |
| `declineReason` | object or null | no |  |
| `termsVersion` | object or null | no | Terms version the signatory accepted |
| `approvedByAdmin` | boolean | yes | True when an admin approved after verifying the signatory offline |
| `createdAt` | string | yes | format="date-time" |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `status: SignatoryApprovalStatus`.
- `school: SignatorySchoolDto`.
- `trust: SignatoryTrustDto`.
- `signatoryName: string`.
- `signatoryEmail: string`.
- `signatoryJobTitle: string`.
- `expiresAt: Date`.
- `decidedAt: Date \| null`.
- `declineReason: string \| null`.
- `termsVersion: string \| null`.
- `approvedByAdmin: boolean`.
- `createdAt: Date`.

### RequestSignatoryApprovalDto

Source: `src/modules/signatory-approvals/dto/request-signatory-approval.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `signatoryName` | string | yes | maxLength=200; example="Jane Smith" |
| `signatoryEmail` | string | yes | Must be someone other than the requester; example="jane.smith@oaktrust.org.uk" |
| `signatoryJobTitle` | string | yes | maxLength=150; example="Chief Financial Officer" |

Source validation/defaults (override generated documentation where inconsistent):

- `signatoryName: string` — `@Transform(trim) @IsString() @IsNotEmpty() @MaxLength(200)`.
- `signatoryEmail: string` — `@Transform(normalizeEmail) @IsEmail() @MaxLength(254)`.
- `signatoryJobTitle: string` — `@Transform(trim) @IsString() @IsNotEmpty() @MaxLength(150)`.

### SignatoryApprovalReviewDto

Source: `src/modules/signatory-approvals/dto/signatory-approval-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `status` | string [PENDING, APPROVED, DECLINED, EXPIRED, REVOKED] | yes |  |
| `school` | SignatorySchoolDto | yes |  |
| `trust` | SignatoryTrustDto | yes |  |
| `signatoryName` | string | yes |  |
| `signatoryJobTitle` | string | yes |  |
| `requestedBy` | string | yes | Email of the school user who made the request |
| `expiresAt` | string | yes | format="date-time" |
| `termsVersion` | string | yes | Terms version the signatory is asked to accept; example="2026-09" |

Source validation/defaults (override generated documentation where inconsistent):

- `status: SignatoryApprovalStatus`.
- `school: SignatorySchoolDto`.
- `trust: SignatoryTrustDto`.
- `signatoryName: string`.
- `signatoryJobTitle: string`.
- `requestedBy: string`.
- `expiresAt: Date`.
- `termsVersion: string`.

### ApproveSignatoryRequestDto

Source: `src/modules/signatory-approvals/dto/decide-signatory-approval.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `acceptTerms` | boolean | yes | The signatory must accept the terms shown on the approval page; example=true |

Source validation/defaults (override generated documentation where inconsistent):

- `acceptTerms: boolean` — `@Equals(true, { message: 'acceptTerms must be true to approve' })`.

### DeclineSignatoryRequestDto

Source: `src/modules/signatory-approvals/dto/decide-signatory-approval.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `reason` | string | yes | maxLength=1000; example="This school is not part of our trust" |

Source validation/defaults (override generated documentation where inconsistent):

- `reason: string` — `@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @IsNotEmpty() @MaxLength(1000)`.

### SignatoryApprovalsPaginationDto

Source: `src/modules/signatory-approvals/dto/signatory-approval-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `page` | number | yes | example=1 |
| `limit` | number | yes | example=20 |
| `total` | number | yes | example=45 |
| `totalPages` | number | yes | example=3 |
| `hasNextPage` | boolean | yes | example=true |

Source validation/defaults (override generated documentation where inconsistent):

- `page: number`.
- `limit: number`.
- `total: number`.
- `totalPages: number`.
- `hasNextPage: boolean`.

### PaginatedSignatoryApprovalsResponseDto

Source: `src/modules/signatory-approvals/dto/signatory-approval-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `approvals` | Array<SignatoryApprovalResponseDto> | yes |  |
| `pagination` | SignatoryApprovalsPaginationDto | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `approvals: SignatoryApprovalResponseDto[]`.
- `pagination: SignatoryApprovalsPaginationDto`.

### ApproveComplianceDto

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `acceptTerms` | boolean | yes | example=true |

### DeclineComplianceDto

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `reason` | string | yes | maxLength=1000 |

### PayoutDestinationDto

Source: `src/modules/payments/dto/payout-balance.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `label` | string | yes | example="Barclays ****2345" |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `label: string`.

### PayoutSummaryDto

Source: `src/modules/payments/dto/payout-balance.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `amountPence` | number | yes | example=10000 |
| `method` | string | yes | instant \| standard; example="instant" |
| `status` | string | yes | pending \| in_transit \| paid \| failed \| canceled; example="in_transit" |
| `arrivalDate` | string | yes | When the money is expected in the bank; format="date-time" |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `amountPence: number`.
- `method: string`.
- `status: string`.
- `arrivalDate: Date`.

### PayoutBalanceResponseDto

Source: `src/modules/payments/dto/payout-balance.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `pendingPence` | number | yes | Paid by schools, not yet released for a standard payout; example=0 |
| `availablePence` | number | yes | Released; paid out on Stripe's automatic schedule; example=0 |
| `instantAvailablePence` | number | yes | What can be withdrawn instantly now; example=10000 |
| `instantDestination` | PayoutDestinationDto | no | Null when nothing linked supports instant payouts |
| `recentPayouts` | Array<PayoutSummaryDto> | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `pendingPence: number`.
- `availablePence: number`.
- `instantAvailablePence: number`.
- `instantDestination: PayoutDestinationDto \| null`.
- `recentPayouts: PayoutSummaryDto[]`.

### InstantPayoutDto

Source: `src/modules/payments/dto/payout-balance.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `amountPence` | number | no | Pence to withdraw. Omit to withdraw everything available; minimum=40; example=10000 |

Source validation/defaults (override generated documentation where inconsistent):

- `amountPence?: number` — `@IsOptional() @IsInt() @Min(40)`.

### PayoutAccountResponseDto

Source: `src/modules/payments/dto/payout-account-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `connected` | boolean | yes | False until the teacher has started payout setup |
| `ready` | boolean | yes | True once the teacher can be paid; their bookings can then be invoiced |
| `detailsSubmitted` | boolean | yes |  |
| `chargesEnabled` | boolean | yes |  |
| `payoutsEnabled` | boolean | yes |  |
| `requirementsDue` | Array<string> | yes | What Stripe still needs from the teacher |
| `disabledReason` | object or null | no | Stripe's reason when the account is disabled |

Source validation/defaults (override generated documentation where inconsistent):

- `connected: boolean`.
- `ready: boolean`.
- `detailsSubmitted: boolean`.
- `chargesEnabled: boolean`.
- `payoutsEnabled: boolean`.
- `requirementsDue: string[]`.
- `disabledReason: string \| null`.

### PayoutSessionResponseDto

Source: `src/modules/payments/dto/embedded-session.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `clientSecret` | string | yes | Account Session client secret for Stripe's Connect embedded components (onboarding, notification banner, payouts). Pass it to the teacher's browser only; fetch a new one when it expires. |
| `publishableKey` | string | yes | Stripe's publishable key to load the components with; example="pk_test_..." |
| `expiresAt` | string | yes | format="date-time" |

Source validation/defaults (override generated documentation where inconsistent):

- `clientSecret: string`.
- `publishableKey: string`.
- `expiresAt: Date`.

### StripeLinkResponseDto

Source: `src/modules/payments/dto/payout-account-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `url` | string | yes | Single-use Stripe page to send the teacher to |
| `expiresAt` | object or null | no | When the link stops working; request a new one after that |

Source validation/defaults (override generated documentation where inconsistent):

- `url: string`.
- `expiresAt: Date \| null`.

### SchoolPaymentMethodDto

Source: `src/modules/payments/dto/school-billing.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `type` | string | yes | example="card" |
| `label` | string | yes | example="Visa ending 6789" |
| `last4` | string | yes | example="6789" |
| `mandateStatus` | object or null | no | example="active" |

Source validation/defaults (override generated documentation where inconsistent):

- `type: string`.
- `label: string`.
- `last4: string`.
- `mandateStatus: string \| null`.

### SchoolBillingSettingsResponseDto

Source: `src/modules/payments/dto/school-billing.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `automaticPaymentsEnabled` | boolean | yes |  |
| `setupStatus` | string | yes | NOT_STARTED \| PENDING \| READY \| FAILED; example="READY" |
| `paymentMethod` | SchoolPaymentMethodDto | no |  |
| `lastSetupError` | object or null | no |  |
| `canEnableAutomaticPayments` | boolean | yes | Automatic collection can only be enabled when this is true |
| `consentedAt` | object or null | no |  |
| `consentTermsVersion` | object or null | no |  |
| `stripeSyncStatus` | string | yes | SYNCED \| PENDING \| FAILED; example="SYNCED" |
| `stripeSyncError` | object or null | no |  |
| `nextScheduledCollectionAt` | object or null | no | Next Stripe retry or next eligible collection request |
| `currentPayment` | object or null | no |  |

Source validation/defaults (override generated documentation where inconsistent):

- `automaticPaymentsEnabled: boolean`.
- `setupStatus: string`.
- `paymentMethod: SchoolPaymentMethodDto \| null`.
- `lastSetupError: string \| null`.
- `canEnableAutomaticPayments: boolean`.
- `consentedAt: Date \| null`.
- `consentTermsVersion: string \| null`.
- `stripeSyncStatus: string`.
- `stripeSyncError: string \| null`.
- `nextScheduledCollectionAt: Date \| null`.
- `currentPayment: {     id: string;     bookingId: string;     jobTitle: string;     status: string;     totalAmountPence: number;     failureCode: string \| null;     failureMessage: string \| null;     nextAttemptAt: Date \| null;     paymentAttemptCount: number;   } \| null`.

### SchoolBillingSetupSessionResponseDto

Source: `src/modules/payments/dto/school-billing.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `url` | string | yes | Stripe-hosted page to save a card for automatic booking payments |
| `sessionId` | string | yes |  |
| `expiresAt` | number | yes | Unix timestamp |

Source validation/defaults (override generated documentation where inconsistent):

- `url: string`.
- `sessionId: string`.
- `expiresAt: number`.

### CreateSchoolBillingSetupDto

Source: `src/modules/payments/dto/school-billing.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `consentToTerms` | boolean | yes | Authorise saving the card in Stripe and automatic off-session booking charges; example=true |

Source validation/defaults (override generated documentation where inconsistent):

- `consentToTerms: boolean` — `@IsBoolean() @Equals(true)`.

### SyncSchoolBillingSetupDto

Source: `src/modules/payments/dto/school-billing.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `sessionId` | string | yes | Checkout Session returned in the Stripe success URL; example="cs_test_..." |

Source validation/defaults (override generated documentation where inconsistent):

- `sessionId: string` — `@IsString() @Matches(/^cs_(?:test_\|live_)?[A-Za-z0-9]+$/)`.

### UpdateSchoolBillingSettingsDto

Source: `src/modules/payments/dto/school-billing.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `automaticPaymentsEnabled` | boolean | yes | Automatically charge each completed attendance payroll period |
| `consentToTerms` | boolean | no | Must be true when enabling; records the authenticated user consent |

Source validation/defaults (override generated documentation where inconsistent):

- `automaticPaymentsEnabled: boolean` — `@IsBoolean()`.
- `consentToTerms?: boolean` — `@IsOptional() @IsBoolean()`.

### CreateBookingTipDto

Source: `src/modules/payments/dto/booking-tip.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `bookingId` | string | yes | format="uuid" |
| `amountPence` | number | yes | The gratuity the teacher receives, in whole pence (at most £1,000); minimum=1; maximum=100000 |

Source validation/defaults (override generated documentation where inconsistent):

- `bookingId: string` — `@IsUUID()`.
- `amountPence: number` — `@IsInt() @Min(1) @Max(MAX_TIP_PENCE, { message: 'A tip can be at most £1,000' })`.

### SyncBookingTipDto

Source: `src/modules/payments/dto/booking-tip.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `sessionId` | string | yes | example="cs_test_..." |

Source validation/defaults (override generated documentation where inconsistent):

- `sessionId: string` — `@IsString() @Matches(/^cs_(?:test_\|live_)?[A-Za-z0-9]+$/)`.

### RefundInvoiceDto

Source: `src/modules/payments/dto/refund-invoice.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `amountPence` | number | no | Pence to refund. Omit to refund everything not yet refunded; minimum=1; example=2000 |
| `reason` | string [duplicate, fraudulent, requested_by_customer] | no |  |

Source validation/defaults (override generated documentation where inconsistent):

- `amountPence?: number` — `@IsOptional() @IsInt() @Min(1)`.
- `reason?: RefundReason` — `@IsOptional() @IsIn(REFUND_REASONS)`.

### InvoicePartyDto

Source: `src/modules/payments/dto/invoice-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes | Profile ID, not the login user ID |
| `userId` | string | yes | Login user ID |
| `name` | string | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `userId: string`.
- `name: string`.

### InvoiceBookingSummaryDto

Source: `src/modules/payments/dto/invoice-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `jobId` | string | yes |  |
| `jobTitle` | string | yes |  |
| `startDate` | object or null | no |  |
| `endDate` | object or null | no |  |
| `hours` | number or null | no | Planned hours agreed at booking time, separate from actual unitsWorked |
| `days` | number or null | no | Planned days agreed at booking time, separate from actual unitsWorked |
| `instructor` | InvoicePartyDto | yes |  |
| `institution` | InvoicePartyDto | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `jobId: string`.
- `jobTitle: string`.
- `startDate: Date \| null`.
- `endDate: Date \| null`.
- `hours: number \| null`.
- `days: number \| null`.
- `instructor: InvoicePartyDto`.
- `institution: InvoicePartyDto`.

### InvoiceResponseDto

Source: `src/modules/payments/dto/invoice-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `createdById` | string or null | yes | User who created the invoice; not necessarily its payer |
| `status` | string [PENDING, OPEN, PAID, VOID, UNCOLLECTIBLE] | yes |  |
| `booking` | InvoiceBookingSummaryDto | yes |  |
| `payType` | string | yes | hourly \| daily \| fixed; example="daily" |
| `rateAmount` | number | yes | Agreed rate in pounds; example=180 |
| `unitsWorked` | object or null | no | Hours or days billed; null for a fixed price; example=4.5 |
| `teacherAmountPence` | number | yes | The teacher's pay, in pence; example=81000 |
| `feeAmountPence` | number | yes | SupplyEd's processing fee, in pence; example=10125 |
| `totalAmountPence` | number | yes | What the school pays, in pence; example=91125 |
| `currency` | string | yes | example="gbp" |
| `poNumber` | object or null | no |  |
| `billingPeriodKey` | object or null | no | example="month:2026-10" |
| `billingPeriodLabel` | object or null | no | example="2026-10" |
| `collectionMethod` | string | yes | example="charge_automatically" |
| `invoiceNumber` | object or null | no | Stripe's invoice number; example="A1B2C3D4-0001" |
| `hostedInvoiceUrl` | object or null | no | Stripe page where the school views and pays the invoice |
| `invoicePdfUrl` | object or null | no |  |
| `dueAt` | object or null | no |  |
| `paidAt` | object or null | no |  |
| `voidedAt` | object or null | no |  |
| `amountRefundedPence` | number | yes | example=0 |
| `disputeStatus` | object or null | no | Stripe's dispute status when the school disputed the payment; example="needs_response" |
| `paymentAttemptCount` | number | yes | example=1 |
| `nextPaymentAttemptAt` | object or null | no |  |
| `lastPaymentFailureCode` | object or null | no | example="PAYMENT_FAILED" |
| `lastPaymentFailureMessage` | object or null | no |  |
| `createdAt` | string | yes | format="date-time" |
| `updatedAt` | string | yes | format="date-time" |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `createdById: string \| null`.
- `status: InvoiceStatus`.
- `booking: InvoiceBookingSummaryDto`.
- `payType: string`.
- `rateAmount: number`.
- `unitsWorked: number \| null`.
- `teacherAmountPence: number`.
- `feeAmountPence: number`.
- `totalAmountPence: number`.
- `currency: string`.
- `poNumber: string \| null`.
- `billingPeriodKey: string \| null`.
- `billingPeriodLabel: string \| null`.
- `collectionMethod: string`.
- `invoiceNumber: string \| null`.
- `hostedInvoiceUrl: string \| null`.
- `invoicePdfUrl: string \| null`.
- `dueAt: Date \| null`.
- `paidAt: Date \| null`.
- `voidedAt: Date \| null`.
- `amountRefundedPence: number`.
- `disputeStatus: string \| null`.
- `paymentAttemptCount: number`.
- `nextPaymentAttemptAt: Date \| null`.
- `lastPaymentFailureCode: string \| null`.
- `lastPaymentFailureMessage: string \| null`.
- `createdAt: Date`.
- `updatedAt: Date`.

### CreateInvoiceDto

Source: `src/modules/payments/dto/create-invoice.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `bookingId` | string | yes | A completed booking; format="uuid" |
| `unitsWorked` | number | no | Days (daily rate) or hours (hourly rate) worked, up to two decimal places. Omit for a fixed price; minimum=0.01; maximum=9999.99; example=4.5 |
| `poNumber` | string | no | The school's purchase order number; maxLength=100; example="PO-2026-0412" |

Source validation/defaults (override generated documentation where inconsistent):

- `bookingId: string` — `@IsUUID()`.
- `unitsWorked?: number` — `@IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(9999.99)`.
- `poNumber?: string` — `@IsOptional() @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @IsNotEmpty() @MaxLength(100)`.

### InvoicesPaginationDto

Source: `src/modules/payments/dto/invoice-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `page` | number | yes | example=1 |
| `limit` | number | yes | example=20 |
| `total` | number | yes | example=45 |
| `totalPages` | number | yes | example=3 |
| `hasNextPage` | boolean | yes | example=true |

Source validation/defaults (override generated documentation where inconsistent):

- `page: number`.
- `limit: number`.
- `total: number`.
- `totalPages: number`.
- `hasNextPage: boolean`.

### PaginatedInvoicesResponseDto

Source: `src/modules/payments/dto/invoice-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `invoices` | Array<InvoiceResponseDto> | yes |  |
| `pagination` | InvoicesPaginationDto | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `invoices: InvoiceResponseDto[]`.
- `pagination: InvoicesPaginationDto`.

### PaymentJobDto

Source: `src/modules/payments/dto/job-payments-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `title` | string | yes |  |
| `status` | string [DRAFT, ACTIVE, RESERVED, EXPIRED, FILLED, CLOSED, SUSPENDED] | yes |  |
| `postedByUserId` | string | yes |  |
| `hours` | number or null | yes |  |
| `days` | number or null | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `title: string`.
- `status: JobStatus`.
- `postedByUserId: string`.
- `hours: number \| null`.
- `days: number \| null`.

### JobPaymentTotalsDto

Source: `src/modules/payments/dto/job-payments-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `currency` | string | yes |  |
| `status` | string [PENDING, OPEN, PAID, VOID, UNCOLLECTIBLE] | yes |  |
| `invoiceCount` | number | yes |  |
| `teacherAmountPence` | number | yes |  |
| `feeAmountPence` | number | yes |  |
| `totalAmountPence` | number | yes |  |
| `amountRefundedPence` | number | yes | Recorded refund total; not a bank settlement confirmation |

Source validation/defaults (override generated documentation where inconsistent):

- `currency: string`.
- `status: InvoiceStatus`.
- `invoiceCount: number`.
- `teacherAmountPence: number`.
- `feeAmountPence: number`.
- `totalAmountPence: number`.
- `amountRefundedPence: number`.

### JobPaymentInvoiceDto

Source: `src/modules/payments/dto/job-payments-response.dto.ts` — `extends InvoiceResponseDto`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `createdById` | string or null | yes | User who created the invoice; not necessarily its payer |
| `status` | string [PENDING, OPEN, PAID, VOID, UNCOLLECTIBLE] | yes |  |
| `booking` | InvoiceBookingSummaryDto | yes |  |
| `payType` | string | yes | hourly \| daily \| fixed; example="daily" |
| `rateAmount` | number | yes | Agreed rate in pounds; example=180 |
| `unitsWorked` | object or null | no | Hours or days billed; null for a fixed price; example=4.5 |
| `teacherAmountPence` | number | yes | The teacher's pay, in pence; example=81000 |
| `feeAmountPence` | number | yes | SupplyEd's processing fee, in pence; example=10125 |
| `totalAmountPence` | number | yes | What the school pays, in pence; example=91125 |
| `currency` | string | yes | example="gbp" |
| `poNumber` | object or null | no |  |
| `billingPeriodKey` | object or null | no | example="month:2026-10" |
| `billingPeriodLabel` | object or null | no | example="2026-10" |
| `collectionMethod` | string | yes | example="charge_automatically" |
| `invoiceNumber` | object or null | no | Stripe's invoice number; example="A1B2C3D4-0001" |
| `hostedInvoiceUrl` | object or null | no | Stripe page where the school views and pays the invoice |
| `invoicePdfUrl` | object or null | no |  |
| `dueAt` | object or null | no |  |
| `paidAt` | object or null | no |  |
| `voidedAt` | object or null | no |  |
| `amountRefundedPence` | number | yes | example=0 |
| `disputeStatus` | object or null | no | Stripe's dispute status when the school disputed the payment; example="needs_response" |
| `paymentAttemptCount` | number | yes | example=1 |
| `nextPaymentAttemptAt` | object or null | no |  |
| `lastPaymentFailureCode` | object or null | no | example="PAYMENT_FAILED" |
| `lastPaymentFailureMessage` | object or null | no |  |
| `createdAt` | string | yes | format="date-time" |
| `updatedAt` | string | yes | format="date-time" |
| `stripeInvoiceId` | string or null | yes |  |
| `stripePaymentIntentId` | string or null | yes |  |
| `destinationAccountId` | string | yes | Instructor Stripe account recorded when this invoice was created |

Source validation/defaults (override generated documentation where inconsistent):

- `stripeInvoiceId: string \| null`.
- `stripePaymentIntentId: string \| null`.
- `destinationAccountId: string`.

### JobPaymentsResponseDto

Source: `src/modules/payments/dto/job-payments-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `job` | PaymentJobDto | yes |  |
| `bookingCount` | number | yes | All bookings for this job, including cancelled and no-show bookings |
| `completedBookingsWithoutInvoice` | number | yes | Completed bookings with no non-VOID invoice |
| `totalsByStatus` | Array<JobPaymentTotalsDto> | yes | Whole-job totals, independent of page and status filter |
| `invoices` | Array<JobPaymentInvoiceDto> | yes |  |
| `pagination` | PaginationMetaDto | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `job: PaymentJobDto`.
- `bookingCount: number`.
- `completedBookingsWithoutInvoice: number`.
- `totalsByStatus: JobPaymentTotalsDto[]`.
- `invoices: JobPaymentInvoiceDto[]`.
- `pagination: PaginationMetaDto`.

### InvoicePaymentSessionResponseDto

Source: `src/modules/payments/dto/embedded-session.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `clientSecret` | string | yes | Client secret of the invoice's payment, for Stripe's Payment Element |
| `customerSessionClientSecret` | string | yes | Customer Session client secret: shows the school's saved cards and lets it save new ones |
| `publishableKey` | string | yes | Stripe's publishable key to load the Payment Element with; example="pk_test_..." |
| `amountPence` | number | yes | What is left to pay, in pence; example=11000 |
| `currency` | string | yes | example="gbp" |

Source validation/defaults (override generated documentation where inconsistent):

- `clientSecret: string`.
- `customerSessionClientSecret: string`.
- `publishableKey: string`.
- `amountPence: number`.
- `currency: string`.

### ConversationBookingDto

Source: `src/modules/conversations/dto/conversation-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `status` | string | yes |  |
| `applicationId` | string | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `status: string`.
- `applicationId: string`.

### ConversationJobDto

Source: `src/modules/conversations/dto/conversation-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `title` | string | yes |  |
| `hours` | number or null | yes |  |
| `days` | number or null | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `title: string`.
- `hours: number \| null`.
- `days: number \| null`.

### ConversationPartyDto

Source: `src/modules/conversations/dto/conversation-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | object or null | yes | Instructor or institution profile id; null for an admin-posted job |
| `userId` | string | yes | Login user ID, distinct from the profile id |
| `name` | string | yes | example="Oak Primary" |
| `imageUrl` | object or null | no |  |
| `role` | string [teacher, school] | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string \| null`.
- `userId: string`.
- `name: string`.
- `imageUrl: string \| null`.
- `role: 'teacher' \| 'school'`.

### ConversationParticipantsDto

Source: `src/modules/conversations/dto/conversation-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `instructor` | ConversationPartyDto | yes |  |
| `poster` | ConversationPartyDto | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `instructor: ConversationPartyDto`.
- `poster: ConversationPartyDto`.

### LastMessageDto

Source: `src/modules/conversations/dto/conversation-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `senderUserId` | string or null | yes |  |
| `senderName` | string or null | yes |  |
| `body` | string | yes |  |
| `fromMe` | boolean | yes |  |
| `hasAttachments` | boolean | yes |  |
| `createdAt` | string | yes | format="date-time" |

Source validation/defaults (override generated documentation where inconsistent):

- `senderUserId: string \| null`.
- `senderName: string \| null`.
- `body: string`.
- `fromMe: boolean`.
- `hasAttachments: boolean`.
- `createdAt: Date`.

### ConversationResponseDto

Source: `src/modules/conversations/dto/conversation-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `applicationId` | string or null | yes |  |
| `booking` | ConversationBookingDto | yes |  |
| `applicationStatus` | string [APPLIED, VIEWED, SHORTLISTED, HIRED, REJECTED] or null | yes |  |
| `readOnly` | boolean | yes | True for admins and rejected applications: viewing only, no new messages |
| `job` | ConversationJobDto | yes |  |
| `me` | string [instructor, poster] or null | yes | The caller's side; null for admin observers |
| `counterpart` | ConversationPartyDto | yes | The other person; null for admin observers |
| `participants` | ConversationParticipantsDto | yes |  |
| `instructorLastReadAt` | string or null | yes | format="date-time" |
| `posterLastReadAt` | string or null | yes | format="date-time" |
| `lastMessage` | LastMessageDto | no |  |
| `unreadCount` | number | yes | example=2 |
| `counterpartLastReadAt` | object or null | no | Messages up to here have been seen by the other person |
| `lastMessageAt` | object or null | no |  |
| `createdAt` | string | yes | format="date-time" |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `applicationId: string \| null`.
- `booking: ConversationBookingDto \| null`.
- `applicationStatus: ApplicationStatus \| null`.
- `readOnly: boolean`.
- `job: ConversationJobDto \| null`.
- `me: ConversationSide \| null`.
- `counterpart: ConversationPartyDto \| null`.
- `participants: ConversationParticipantsDto`.
- `instructorLastReadAt: Date \| null`.
- `posterLastReadAt: Date \| null`.
- `lastMessage: LastMessageDto \| null`.
- `unreadCount: number`.
- `counterpartLastReadAt: Date \| null`.
- `lastMessageAt: Date \| null`.
- `createdAt: Date`.

### StartConversationDto

Source: `src/modules/conversations/dto/start-conversation.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `instructorId` | string | no | Teacher profile ID; required unless applicationId is supplied; format="uuid" |
| `jobId` | string | no | Optional job owned by the signed-in school; format="uuid" |
| `applicationId` | string | no | Application on a job owned by the signed-in school; send alone; format="uuid" |

Source validation/defaults (override generated documentation where inconsistent):

- `instructorId?: string` — `@ValidateIf((_object, value: unknown) => value !== undefined) @IsUUID()`.
- `jobId?: string` — `@ValidateIf((_object, value: unknown) => value !== undefined) @IsUUID()`.
- `applicationId?: string` — `@ValidateIf((_object, value: unknown) => value !== undefined) @IsUUID()`.

### ConversationsPaginationDto

Source: `src/modules/conversations/dto/conversation-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `page` | number | yes | example=1 |
| `limit` | number | yes | example=20 |
| `total` | number | yes | example=45 |
| `totalPages` | number | yes | example=3 |
| `hasNextPage` | boolean | yes | example=true |

Source validation/defaults (override generated documentation where inconsistent):

- `page: number`.
- `limit: number`.
- `total: number`.
- `totalPages: number`.
- `hasNextPage: boolean`.

### PaginatedConversationsResponseDto

Source: `src/modules/conversations/dto/conversation-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `conversations` | Array<ConversationResponseDto> | yes |  |
| `pagination` | ConversationsPaginationDto | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `conversations: ConversationResponseDto[]`.
- `pagination: ConversationsPaginationDto`.

### UnreadCountResponseDto

Source: `src/modules/conversations/dto/conversation-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `total` | number | yes | example=3 |

Source validation/defaults (override generated documentation where inconsistent):

- `total: number`.

### SocketTicketResponseDto

Source: `src/modules/conversations/dto/conversation-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `ticket` | string | yes | Pass as auth.ticket when connecting to the /conversations Socket.IO namespace |
| `expiresInSeconds` | number | yes | example=60 |

Source validation/defaults (override generated documentation where inconsistent):

- `ticket: string`.
- `expiresInSeconds: number`.

### JobConversationsResponseDto

Source: `src/modules/conversations/dto/conversation-response.dto.ts` — `extends PaginatedConversationsResponseDto`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `conversations` | Array<ConversationResponseDto> | yes |  |
| `pagination` | ConversationsPaginationDto | yes |  |
| `job` | ConversationJobDto | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `job: ConversationJobDto`.

### ConversationThreadsResponseDto

Source: `src/modules/conversations/dto/conversation-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `conversations` | Array<ConversationResponseDto> | yes |  |
| `total` | number | yes |  |
| `hasMore` | boolean | yes |  |
| `nextCursor` | string or null | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `conversations: ConversationResponseDto[]`.
- `total: number`.
- `hasMore: boolean`.
- `nextCursor: string \| null`.

### AttachmentResponseDto

Source: `src/modules/conversations/dto/conversation-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `fileName` | string | yes | example="lesson-plan.pdf" |
| `contentType` | string | yes | example="application/pdf" |
| `sizeBytes` | number | yes | example=52000 |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `fileName: string`.
- `contentType: string`.
- `sizeBytes: number`.

### MessageResponseDto

Source: `src/modules/conversations/dto/conversation-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `conversationId` | string | yes |  |
| `senderUserId` | string or null | yes | Login user ID of the sender; null if deleted |
| `senderName` | string or null | yes | Current participant display name; null if unavailable |
| `senderSide` | string [instructor, poster] or null | yes | Which side sent it; null once the sender account is deleted |
| `body` | string | yes | Empty when the message only carries files |
| `attachments` | Array<AttachmentResponseDto> | yes |  |
| `createdAt` | string | yes | format="date-time" |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `conversationId: string`.
- `senderUserId: string \| null`.
- `senderName: string \| null`.
- `senderSide: ConversationSide \| null`.
- `body: string`.
- `attachments: AttachmentResponseDto[]`.
- `createdAt: Date`.

### MessagesPageResponseDto

Source: `src/modules/conversations/dto/conversation-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `messages` | Array<MessageResponseDto> | yes | Oldest first |
| `hasMore` | boolean | yes | More, older messages exist; pass the first message id as before |

Source validation/defaults (override generated documentation where inconsistent):

- `messages: MessageResponseDto[]`.
- `hasMore: boolean`.

### SendMessageDto

Source: `src/modules/conversations/dto/send-message.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `body` | string | no | maxLength=2000; example="Hi, is parking available on site?" |
| `attachmentIds` | Array<string> | no | Uploads from POST /conversations/:id/attachments, finished uploading to S3; maxItems=5 |

Source validation/defaults (override generated documentation where inconsistent):

- `body?: string` — `@IsOptional() @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @MaxLength(MAX_MESSAGE_LENGTH)`.
- `attachmentIds?: string[]` — `@IsOptional() @IsArray() @ArrayUnique() @ArrayMaxSize(MAX_ATTACHMENTS_PER_MESSAGE) @IsUUID(undefined, { each: true })`.

### AttachmentUploadResponseDto

Source: `src/modules/conversations/dto/conversation-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `attachment` | AttachmentResponseDto | yes |  |
| `upload` | object | yes | example={"url":"https://...","expiresAt":"...","requiredHeaders":{"Content-Type":"application/pdf","If-None-Match":"*"}} |

Source validation/defaults (override generated documentation where inconsistent):

- `attachment: AttachmentResponseDto`.
- `upload: { url: string; expiresAt: Date; requiredHeaders: Record<string, string> }`.

### CreateAttachmentDto

Source: `src/modules/conversations/dto/create-attachment.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `fileName` | string | yes | maxLength=200; example="lesson-plan.pdf" |
| `contentType` | string [application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, image/jpeg, image/png, text/plain] | yes | example="application/pdf" |
| `sizeBytes` | number | yes | minimum=1; maximum=10485760; example=52000 |

Source validation/defaults (override generated documentation where inconsistent):

- `fileName: string` — `@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @IsNotEmpty() @MaxLength(200)`.
- `contentType: string` — `@IsIn(Object.keys(ALLOWED_ATTACHMENT_TYPES), { message: 'Only PDF, Word, JPEG, PNG and text files can be shared' })`.
- `sizeBytes: number` — `@IsInt() @Min(1) @Max(MAX_ATTACHMENT_BYTES, { message: 'Files can be up to 10 MB' })`.

### DownloadUrlResponseDto

Source: `src/modules/documents/dto/download-url-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `url` | string | yes |  |
| `expiresAt` | string | yes | format="date-time" |

Source validation/defaults (override generated documentation where inconsistent):

- `url: string`.
- `expiresAt: Date`.
- `originalName: string \| null`.
- `contentType: string`.
- `sizeBytes: number`.

### TeacherDbsCheckDto

Source: `src/modules/dbs-checks/dto/dbs-check-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `state` | string [IN_PROGRESS, VERIFIED, CERTIFICATE_NEEDED, NOT_VERIFIED] | yes | IN_PROGRESS: being sent or with the DBS. VERIFIED. CERTIFICATE_NEEDED: show us the certificate the DBS posted to you. NOT_VERIFIED: contact support. |
| `submittedAt` | object or null | no |  |
| `resultAt` | object or null | no |  |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `state: TeacherDbsState`.
- `submittedAt: Date \| null`.
- `resultAt: Date \| null`.

### MyDbsCheckResponseDto

Source: `src/modules/dbs-checks/dto/dbs-check-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `dbsCheck` | TeacherDbsCheckDto | no | Null until one is sent |

Source validation/defaults (override generated documentation where inconsistent):

- `dbsCheck: TeacherDbsCheckDto \| null`.

### DbsCheckPreviewDto

Source: `src/modules/dbs-checks/dto/dbs-check-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `canSend` | boolean | yes | Whether it can be sent now: no problems, identity approved, not sent before |
| `problems` | Array<string> | yes | What uCheck would reject, or what stops it being sent |
| `notes` | Array<string> | yes | Optional details left out of the application |
| `application` | object or null | no | The application as it would be sent (without the key); null when there are problems |

Source validation/defaults (override generated documentation where inconsistent):

- `canSend: boolean`.
- `problems: string[]`.
- `notes: string[]`.
- `application: Record<string, unknown> \| null`.

### SubmitDbsCheckDto

Source: `src/modules/dbs-checks/dto/submit-dbs-check.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `identityVerificationId` | string | yes | The teacher's approved identity check; its DBS form becomes the application |
| `evidenceCheckedBy` | string | yes | Who checked the identity evidence (uCheck's EvidenceCheckedBy): TRUSTID, or the name of a person; maxLength=60; example="TRUSTID" |

Source validation/defaults (override generated documentation where inconsistent):

- `identityVerificationId: string` — `@IsUUID()`.
- `evidenceCheckedBy: string` — `@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @IsNotEmpty() @MaxLength(60)`.

### DbsCheckUserDto

Source: `src/modules/dbs-checks/dto/dbs-check-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `email` | string | yes |  |
| `name` | object or null | no |  |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `email: string`.
- `name: string \| null`.

### AdminDbsCheckDto

Source: `src/modules/dbs-checks/dto/dbs-check-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `user` | DbsCheckUserDto | yes | The teacher |
| `identityVerificationId` | string | yes | The identity check whose DBS form was sent |
| `submittedBy` | DbsCheckUserDto | no | Admin who sent it; null when it was sent automatically |
| `applicationReference` | string | yes | Our reference, sent to uCheck |
| `ucheckReference` | object or null | no | uCheck's applicant reference; null while it could not be sent; example="HR00009101" |
| `companyCode` | object or null | no |  |
| `live` | boolean | yes | false: sent to uCheck's test system, where nothing reaches the DBS |
| `evidenceCheckedBy` | string | yes | Who checked the identity evidence, as sent to uCheck |
| `status` | string [SEND_FAILED, SUBMITTED, COMPLETED] | yes | SEND_FAILED: could not be sent (see sendProblems); an admin resends it. SUBMITTED: with the DBS. |
| `sendProblems` | Array<string> | yes | Why it could not be sent (SEND_FAILED) |
| `result` | string [CLEAR, SEE_CERTIFICATE] or null | no | CLEAR, or SEE_CERTIFICATE: the certificate has content, so see it before deciding |
| `disclosureNumber` | object or null | no |  |
| `disclosureIssuedAt` | object or null | no |  |
| `submittedAt` | object or null | no | When uCheck accepted it |
| `resultAt` | object or null | no |  |
| `decision` | string [APPROVED, REJECTED] or null | no | Whether the result clears the teacher; set automatically for CLEAR. Sets the profile's dbsVerified. |
| `decidedAt` | object or null | no |  |
| `decidedBy` | DbsCheckUserDto | no | Admin who decided; null when it followed from a clear result |
| `decisionNote` | object or null | no | The admin's note. Not shown to the teacher. |
| `needsDecision` | boolean | yes | A result is in and nobody has approved or rejected it yet |
| `hasReport` | boolean | yes | uCheck's result report is stored (GET .../report-url) |
| `createdAt` | string | yes | format="date-time" |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `user: DbsCheckUserDto`.
- `identityVerificationId: string`.
- `submittedBy: DbsCheckUserDto \| null`.
- `applicationReference: string`.
- `ucheckReference: string \| null`.
- `companyCode: string \| null`.
- `live: boolean`.
- `evidenceCheckedBy: string`.
- `status: DbsCheckStatus`.
- `sendProblems: string[]`.
- `result: DbsCheckResult \| null`.
- `disclosureNumber: string \| null`.
- `disclosureIssuedAt: Date \| null`.
- `submittedAt: Date \| null`.
- `resultAt: Date \| null`.
- `decision: DbsCheckDecision \| null`.
- `decidedAt: Date \| null`.
- `decidedBy: DbsCheckUserDto \| null`.
- `decisionNote: string \| null`.
- `needsDecision: boolean`.
- `hasReport: boolean`.
- `createdAt: Date`.

### PaginatedDbsChecksResponseDto

Source: `src/modules/dbs-checks/dto/dbs-check-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `dbsChecks` | Array<AdminDbsCheckDto> | yes |  |
| `pagination` | PaginationMetaDto | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `dbsChecks: AdminDbsCheckDto[]`.
- `pagination: PaginationMetaDto`.

### DbsReportUrlResponseDto

Source: `src/modules/dbs-checks/dto/dbs-check-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `url` | string | yes |  |
| `expiresAt` | string | yes | format="date-time" |

Source validation/defaults (override generated documentation where inconsistent):

- `url: string`.
- `expiresAt: Date`.

### DecideDbsCheckDto

Source: `src/modules/dbs-checks/dto/decide-dbs-check.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `decision` | string [APPROVED, REJECTED] | yes | APPROVED marks the teacher's DBS as verified |
| `note` | string | no | Why; kept for the audit trail and never shown to the teacher; maxLength=1000 |

Source validation/defaults (override generated documentation where inconsistent):

- `decision: DbsCheckDecision` — `@IsIn(Object.values(DbsCheckDecision))`.
- `note?: string` — `@IsOptional() @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() \|\| undefined : value)) @IsString() @MaxLength(1000)`.

### DegreeInstitutionDto

Source: `src/modules/degree-checks/dto/degree-check-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | number | yes | Hedd's institution id; example=4 |
| `name` | string | yes | example="University of Aberdeen" |
| `consentFormUrl` | object or null | no | The university's own consent form; null: Hedd's standard form (standardConsentFormUrl) |

Source validation/defaults (override generated documentation where inconsistent):

- `id: number`.
- `name: string`.
- `consentFormUrl: string \| null`.

### DegreeInstitutionsResponseDto

Source: `src/modules/degree-checks/dto/degree-check-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `institutions` | Array<DegreeInstitutionDto> | yes |  |
| `standardConsentFormUrl` | string | yes | Hedd's standard consent form, for every university without its own |

Source validation/defaults (override generated documentation where inconsistent):

- `institutions: DegreeInstitutionDto[]`.
- `standardConsentFormUrl: string`.

### DegreeIdentityDto

Source: `src/modules/degree-checks/dto/degree-check-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `firstNames` | string | yes | example="Sarah Jane" |
| `lastName` | string | yes | example="Johnson" |
| `dateOfBirth` | string | yes | example="1990-04-21" |
| `birthSurname` | object or null | no | Their birth surname when it changed: a likely lastNameAtStudy |

Source validation/defaults (override generated documentation where inconsistent):

- `firstNames: string`.
- `lastName: string`.
- `dateOfBirth: string`.
- `birthSurname: string \| null`.

### TeacherDegreeCheckDto

Source: `src/modules/degree-checks/dto/degree-check-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `state` | string [IN_PROGRESS, VERIFIED, NOT_VERIFIED] | yes | IN_PROGRESS: with the university. VERIFIED: schools see the degree. NOT_VERIFIED: cancelled or not accepted; they can start a new check. |
| `institutionName` | string | yes |  |
| `courseName` | string | yes |  |
| `qualificationType` | string | yes |  |
| `classification` | string | yes |  |
| `yearOfAward` | number | yes |  |
| `dueDate` | object or null | no | When the university is expected to answer |
| `notes` | object or null | no | Why it was cancelled (NOT_VERIFIED only) |
| `degree` | VerifiedDegreeDto | no | What schools see (VERIFIED only) |
| `createdAt` | string | yes | format="date-time" |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `state: TeacherDegreeState`.
- `institutionName: string`.
- `courseName: string`.
- `qualificationType: string`.
- `classification: string`.
- `yearOfAward: number`.
- `dueDate: Date \| null`.
- `notes: string \| null`.
- `degree: VerifiedDegreeDto \| null`.
- `createdAt: Date`.

### MyDegreeCheckResponseDto

Source: `src/modules/degree-checks/dto/degree-check-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `available` | boolean | yes | false: degree checks are switched off here; hide them |
| `canStart` | boolean | yes | Whether POST /degree-checks/me would be accepted now |
| `identity` | DegreeIdentityDto | no | The verified name and date of birth sent to Hedd. Null before identity is approved, or (dev testing) when there is no DBS form: then, if canStart, ask for firstNames, lastName and dateOfBirth. |
| `degreeCheck` | TeacherDegreeCheckDto | no | Their latest check |

Source validation/defaults (override generated documentation where inconsistent):

- `available: boolean`.
- `canStart: boolean`.
- `identity: DegreeIdentityDto \| null`.
- `degreeCheck: TeacherDegreeCheckDto \| null`.

### DegreeConsentUploadUrlResponseDto

Source: `src/modules/degree-checks/dto/submit-degree-check.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `fileKey` | string | yes | Send it back as consentFileKey |
| `url` | string | yes | PUT the file here, with requiredHeaders |
| `expiresAt` | string | yes | format="date-time" |
| `requiredHeaders` | object | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `fileKey: string`.
- `url: string`.
- `expiresAt: Date`.
- `requiredHeaders: Record<string, string>`.

### DegreeConsentUploadUrlDto

Source: `src/modules/degree-checks/dto/submit-degree-check.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `contentType` | string [application/pdf, image/jpeg, image/png, image/tiff] | yes |  |
| `sizeBytes` | number | yes | Hedd's limit is 5 MB; minimum=1; maximum=5242880 |

Source validation/defaults (override generated documentation where inconsistent):

- `contentType: ConsentFormType` — `@IsIn(CONSENT_FORM_CONTENT_TYPES)`.
- `sizeBytes: number` — `@IsInt() @Min(1) @Max(MAX_CONSENT_FORM_BYTES)`.

### SubmitDegreeCheckDto

Source: `src/modules/degree-checks/dto/submit-degree-check.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `institutionId` | number | yes | Hedd's institution id, from GET /degree-checks/institutions; example=4 |
| `courseName` | string | yes | The course enrolled on, not a module; maxLength=120; example="Mathematics" |
| `qualificationType` | string | yes | maxLength=60; example="BSc Hons" |
| `classification` | string | yes | Pass when the certificate gives none; maxLength=60; example="2:1" |
| `yearOfAward` | number | yes | example=2015 |
| `lastNameAtStudy` | string | no | Only when their surname was different while studying; maxLength=60 |
| `consentFileKey` | string | yes | From POST /degree-checks/me/consent-upload-url, after the upload |
| `firstNames` | string | no | Dev testing only: used when the teacher was marked verified for testing and has no DBS form; maxLength=120 |
| `lastName` | string | no | Dev testing only, as firstNames; maxLength=60 |
| `dateOfBirth` | string | no | Dev testing only, as firstNames; example="1990-04-21" |

Source validation/defaults (override generated documentation where inconsistent):

- `institutionId: number` — `@IsInt() @Min(1)`.
- `courseName: string` — `@Transform(trim) @IsString() @IsNotEmpty() @MaxLength(120)`.
- `qualificationType: string` — `@Transform(trim) @IsString() @IsNotEmpty() @MaxLength(60)`.
- `classification: string` — `@Transform(trim) @IsString() @IsNotEmpty() @MaxLength(60)`.
- `yearOfAward: number` — `@IsInt() @Min(1940) @Max(2100)`.
- `lastNameAtStudy?: string` — `@IsOptional() @Transform(trimOrDrop) @IsString() @MaxLength(60)`.
- `consentFileKey: string` — `@IsString() @IsNotEmpty() @MaxLength(512)`.
- `firstNames?: string` — `@IsOptional() @Transform(trimOrDrop) @IsString() @MaxLength(120)`.
- `lastName?: string` — `@IsOptional() @Transform(trimOrDrop) @IsString() @MaxLength(60)`.
- `dateOfBirth?: string` — `@IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateOfBirth must be YYYY-MM-DD' })`.

### DegreeCheckUserDto

Source: `src/modules/degree-checks/dto/degree-check-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes |  |
| `email` | string | yes |  |
| `name` | object or null | no |  |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `email: string`.
- `name: string \| null`.

### AdminDegreeCheckDto

Source: `src/modules/degree-checks/dto/degree-check-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `id` | string | yes | Also our reference on Hedd (enquirer-reference) |
| `user` | DegreeCheckUserDto | yes | The teacher |
| `institutionId` | number | yes |  |
| `institutionName` | string | yes |  |
| `firstNames` | string | yes |  |
| `lastName` | string | yes |  |
| `lastNameAtStudy` | object or null | no |  |
| `dateOfBirth` | string | yes | format="date-time" |
| `courseName` | string | yes |  |
| `qualificationType` | string | yes |  |
| `classification` | string | yes |  |
| `yearOfAward` | number | yes |  |
| `live` | boolean | yes | false: sent to Hedd's test API |
| `status` | string [UNCONFIRMED, WAITING, MORE_INFORMATION, VERIFIED, CANCELLED] | yes | UNCONFIRMED: Hedd's answer never arrived; look for this id on Hedd, then cancel it if Hedd does not have it. MORE_INFORMATION: answer on the Hedd website (see notes). |
| `heddGuid` | object or null | no |  |
| `heddReference` | object or null | no | Hedd's reference number |
| `dueDate` | object or null | no |  |
| `notes` | object or null | no | Hedd's notes, or an admin's when they cancelled it |
| `corrections` | object or null | no | Fields the university says are wrong (Hedd's names, e.g. classification-name), with its value: '' when it gave none, null when withheld |
| `attendanceFrom` | object or null | no |  |
| `attendanceTo` | object or null | no |  |
| `verifiedOn` | object or null | no |  |
| `lastCheckedAt` | object or null | no | When Hedd was last asked |
| `decision` | string [APPROVED, REJECTED] or null | no | Whether schools see the degree as verified; automatic when nothing was corrected |
| `decidedAt` | object or null | no |  |
| `decidedBy` | DegreeCheckUserDto | no | Admin who decided; null when it followed from a verification without corrections |
| `decisionNote` | object or null | no | The admin's note. Not shown to the teacher. |
| `needsAction` | boolean | yes | An admin has to act: unconfirmed, more information wanted, or corrections to decide |
| `degree` | VerifiedDegreeDto | no | What schools see, once approved |
| `createdAt` | string | yes | format="date-time" |

Source validation/defaults (override generated documentation where inconsistent):

- `id: string`.
- `user: DegreeCheckUserDto`.
- `institutionId: number`.
- `institutionName: string`.
- `firstNames: string`.
- `lastName: string`.
- `lastNameAtStudy: string \| null`.
- `dateOfBirth: Date`.
- `courseName: string`.
- `qualificationType: string`.
- `classification: string`.
- `yearOfAward: number`.
- `live: boolean`.
- `status: DegreeCheckStatus`.
- `heddGuid: string \| null`.
- `heddReference: number \| null`.
- `dueDate: Date \| null`.
- `notes: string \| null`.
- `corrections: Record<string, unknown> \| null`.
- `attendanceFrom: Date \| null`.
- `attendanceTo: Date \| null`.
- `verifiedOn: Date \| null`.
- `lastCheckedAt: Date \| null`.
- `decision: DegreeCheckDecision \| null`.
- `decidedAt: Date \| null`.
- `decidedBy: DegreeCheckUserDto \| null`.
- `decisionNote: string \| null`.
- `needsAction: boolean`.
- `degree: VerifiedDegreeDto \| null`.
- `createdAt: Date`.

### PaginatedDegreeChecksResponseDto

Source: `src/modules/degree-checks/dto/degree-check-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `degreeChecks` | Array<AdminDegreeCheckDto> | yes |  |
| `pagination` | PaginationMetaDto | yes |  |

Source validation/defaults (override generated documentation where inconsistent):

- `degreeChecks: AdminDegreeCheckDto[]`.
- `pagination: PaginationMetaDto`.

### DegreeConsentUrlResponseDto

Source: `src/modules/degree-checks/dto/degree-check-response.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `url` | string | yes |  |
| `expiresAt` | string | yes | format="date-time" |

Source validation/defaults (override generated documentation where inconsistent):

- `url: string`.
- `expiresAt: Date`.

### DecideDegreeCheckDto

Source: `src/modules/degree-checks/dto/decide-degree-check.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `decision` | string [APPROVED, REJECTED] | yes | APPROVED shows the degree to schools as verified |
| `note` | string | no | Why; kept for the audit trail and never shown to the teacher; maxLength=1000 |

Source validation/defaults (override generated documentation where inconsistent):

- `decision: DegreeCheckDecision` — `@IsIn(Object.values(DegreeCheckDecision))`.
- `note?: string` — `@IsOptional() @Transform(trimOrDrop) @IsString() @MaxLength(1000)`.

### CancelDegreeCheckDto

Source: `src/modules/degree-checks/dto/decide-degree-check.dto.ts`.

| Field | Declared type | OpenAPI required | Constraints / description |
|---|---|---|---|
| `note` | string | no | Shown to the teacher, e.g. why to start again; maxLength=1000 |

Source validation/defaults (override generated documentation where inconsistent):

- `note?: string` — `@IsOptional() @Transform(trimOrDrop) @IsString() @MaxLength(1000)`.

### ListProfilesQueryDto (source-only DTO)

Source: `src/common/dto/list-profiles-query.dto.ts` — `extends PaginationQueryDto`.

- `status?: ProfileStatus` — `@IsOptional() @IsEnum(ProfileStatus)`.
- `search?: string` — `@IsOptional() @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() \|\| undefined : value)) @IsString() @MaxLength(100)`.
- `userId?: string` — `@IsOptional() @IsUUID()`.

### PaginationQueryDto (source-only DTO)

Source: `src/common/dto/pagination.dto.ts`.

- `page: inferred` = `1` — `@IsOptional() @Type(() => Number) @IsInt() @Min(1)`.
- `limit: inferred` = `20` — `@IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)`.

### ListApplicationsQueryDto (source-only DTO)

Source: `src/modules/applications/dto/list-applications-query.dto.ts`.

- `jobId?: string` — `@IsOptional() @IsUUID()`.
- `status?: ApplicationStatus` — `@IsOptional() @IsEnum(ApplicationStatus)`.
- `page: inferred` = `1` — `@IsOptional() @Type(() => Number) @IsInt() @Min(1)`.
- `limit: inferred` = `20` — `@IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)`.

### RequestAttendanceCorrectionDto (source-only DTO)

Source: `src/modules/bookings/dto/attendance.dto.ts`.

- `requestedStatus: 'PRESENT' \| 'ABSENT'` — `@IsIn(DECISIONS)`.
- `reason: string` — `@IsString() @MinLength(3) @MaxLength(1000)`.

### AttendanceAuditDto (source-only DTO)

Source: `src/modules/bookings/dto/booking-response.dto.ts`.

- `id: string`.
- `actorUserId: string \| null`.
- `fromStatus: AttendanceStatus \| null`.
- `toStatus: AttendanceStatus`.
- `fromSource: AttendanceDecisionSource \| null`.
- `toSource: AttendanceDecisionSource \| null`.
- `reason: string \| null`.
- `createdAt: Date`.

### AttendanceCorrectionRequestDto (source-only DTO)

Source: `src/modules/bookings/dto/booking-response.dto.ts`.

- `id: string`.
- `requestedById: string`.
- `requestedStatus: AttendanceStatus`.
- `reason: string`.
- `status: AttendanceCorrectionStatus`.
- `reviewedById: string \| null`.
- `reviewReason: string \| null`.
- `reviewedAt: Date \| null`.
- `createdAt: Date`.

### ListJobInvitationsDto (source-only DTO)

Source: `src/modules/bookings/dto/job-invitation-response.dto.ts` — `extends PaginationQueryDto`.

- `status?: JobInvitationStatus \| 'ALL'` — `@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value)) @IsOptional() @IsIn(['ALL', ...Object.values(JobInvitationStatus)])`.

### ListBookingsQueryDto (source-only DTO)

Source: `src/modules/bookings/dto/list-bookings-query.dto.ts`.

- `status?: BookingStatus` — `@IsOptional() @IsEnum(BookingStatus)`.
- `page: inferred` = `1` — `@IsOptional() @Type(() => Number) @IsInt() @Min(1)`.
- `limit: inferred` = `20` — `@IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)`.
- `search?: string` — `@IsOptional() @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() \|\| undefined : value)) @IsString() @MaxLength(100)`.
- `jobId?: string` — `@IsOptional() @IsUUID()`.
- `from?: string` — `@IsOptional() @IsDateString()`.
- `to?: string` — `@IsOptional() @IsDateString()`.
- `invoice?: BookingInvoiceFilter` — `@IsOptional() @IsIn(BOOKING_INVOICE_FILTERS)`.

### AdminListBookingsQueryDto (source-only DTO)

Source: `src/modules/bookings/dto/list-bookings-query.dto.ts` — `extends ListBookingsQueryDto`.

- `instructorId?: string` — `@IsOptional() @IsUUID()`.
- `institutionId?: string` — `@IsOptional() @IsUUID()`.

### ListFoundingInterestQueryDto (source-only DTO)

Source: `src/modules/contact/dto/founding-interest.dto.ts`.

- `page: inferred` = `1` — `@IsOptional() @Type(() => Number) @IsInt() @Min(1)`.
- `limit: inferred` = `20` — `@IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)`.
- `type?: FoundingInterestType` — `@IsOptional() @IsEnum(FoundingInterestType)`.
- `status?: FoundingInterestStatus` — `@IsOptional() @IsEnum(FoundingInterestStatus)`.
- `search?: string` — `@IsOptional() @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @MaxLength(200)`.
- `fromDate?: string` — `@IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fromDate must use YYYY-MM-DD format' }) @IsDateString()`.
- `toDate?: string` — `@IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'toDate must use YYYY-MM-DD format' }) @IsDateString()`.

### FoundingInterestResponseDto (source-only DTO)

Source: `src/modules/contact/dto/founding-interest.dto.ts`.

- `firstName?: string \| null`.
- `lastName?: string \| null`.
- `area?: string \| null`.
- `supplyDaysPerTerm?: string \| null`.
- `coverBookingMethod?: string \| null`.
- `foundingProgrammeInterest?: boolean \| null`.
- `currentSupply?: string \| null`.
- `daysPerWeek?: string \| null`.
- `emailConsent?: boolean \| null`.
- `phases: string[]`.
- `mainSubject?: string \| null`.
- `id: string`.
- `type: FoundingInterestType`.
- `status: FoundingInterestStatus`.
- `name: string`.
- `email: string`.
- `phone?: string \| null`.
- `role: string`.
- `organizationName?: string \| null`.
- `postcode?: string \| null`.
- `schoolType?: string \| null`.
- `tier?: string \| null`.
- `phase?: string \| null`.
- `availability?: string \| null`.
- `message?: string \| null`.
- `source?: string \| null`.
- `campaign?: string \| null`.
- `createdAt: Date`.
- `updatedAt: Date`.

### FoundingInterestPaginationDto (source-only DTO)

Source: `src/modules/contact/dto/founding-interest.dto.ts`.

- `page: number`.
- `limit: number`.
- `total: number`.
- `totalPages: number`.
- `hasNextPage: boolean`.

### PaginatedFoundingInterestResponseDto (source-only DTO)

Source: `src/modules/contact/dto/founding-interest.dto.ts`.

- `submissions: FoundingInterestResponseDto[]`.
- `pagination: FoundingInterestPaginationDto`.

### ListConversationThreadsQueryDto (source-only DTO)

Source: `src/modules/conversations/dto/list-conversation-threads-query.dto.ts`.

- `topic: 'GENERAL' \| 'JOBS'` = `'JOBS'` — `@IsOptional() @IsIn(['GENERAL', 'JOBS'])`.
- `before?: string` — `@IsOptional() @IsUUID()`.
- `limit: inferred` = `20` — `@IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)`.

### ListConversationsQueryDto (source-only DTO)

Source: `src/modules/conversations/dto/list-conversations-query.dto.ts`.

- `page: inferred` = `1` — `@IsOptional() @Type(() => Number) @IsInt() @Min(1)`.
- `limit: inferred` = `20` — `@IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)`.

### ListMessagesQueryDto (source-only DTO)

Source: `src/modules/conversations/dto/list-messages-query.dto.ts`.

- `before?: string` — `@IsOptional() @IsUUID()`.
- `limit: inferred` = `30` — `@IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)`.

### ListDbsChecksQueryDto (source-only DTO)

Source: `src/modules/dbs-checks/dto/list-dbs-checks-query.dto.ts` — `extends PaginationQueryDto`.

- `status?: DbsCheckStatus` — `@IsOptional() @IsEnum(DbsCheckStatus)`.
- `result?: DbsCheckResult` — `@IsOptional() @IsEnum(DbsCheckResult)`.
- `needsDecision?: boolean` — `@IsOptional() @Transform(({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value)) @IsBoolean()`.
- `userId?: string` — `@IsOptional() @IsUUID()`.
- `identityVerificationId?: string` — `@IsOptional() @IsUUID()`.

### ListDegreeChecksQueryDto (source-only DTO)

Source: `src/modules/degree-checks/dto/list-degree-checks-query.dto.ts` — `extends PaginationQueryDto`.

- `status?: DegreeCheckStatus` — `@IsOptional() @IsEnum(DegreeCheckStatus)`.
- `needsAction?: boolean` — `@IsOptional() @Transform(({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value)) @IsBoolean()`.
- `userId?: string` — `@IsOptional() @IsUUID()`.

### DocumentRequirementResponseDto (source-only DTO)

Source: `src/modules/document-requirements/dto/document-requirement-response.dto.ts`.

- `id: string`.
- `documentTypeId: string`.
- `context: DocumentContext`.
- `isRequired: boolean`.
- `requiresReview: boolean`.
- `isActive: boolean`.
- `createdAt: Date`.
- `updatedAt: Date`.

### DocumentReviewResponseDto (source-only DTO)

Source: `src/modules/document-reviews/dto/document-review-response.dto.ts`.

- `id: string`.
- `documentId: string`.
- `reviewedFileKey: string`.
- `reviewerId: string`.
- `fromStatus: DocumentVerificationStatus`.
- `toStatus: DocumentVerificationStatus`.
- `notes: string \| null`.
- `createdAt: Date`.

### ListDocumentReviewsQueryDto (source-only DTO)

Source: `src/modules/document-reviews/dto/list-document-reviews-query.dto.ts`.

- `documentId?: string` — `@IsOptional() @IsUUID()`.

### ListDocumentsQueryDto (source-only DTO)

Source: `src/modules/documents/dto/list-documents-query.dto.ts`.

- `page: inferred` = `1` — `@IsOptional() @Type(() => Number) @IsInt() @Min(1)`.
- `limit: inferred` = `20` — `@IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)`.
- `status?: DocumentVerificationStatus` — `@IsOptional() @IsEnum(DocumentVerificationStatus)`.

### ListIdentityVerificationsQueryDto (source-only DTO)

Source: `src/modules/identity-verification/dto/list-identity-verifications-query.dto.ts` — `extends PaginationQueryDto`.

- `status?: IdentityVerificationStatus` — `@IsOptional() @IsEnum(IdentityVerificationStatus)`.
- `outcome?: IdentityVerificationOutcome` — `@IsOptional() @IsEnum(IdentityVerificationOutcome)`.
- `needsDecision?: boolean` — `@IsOptional() @Transform(({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value)) @IsBoolean()`.
- `userId?: string` — `@IsOptional() @IsUUID()`.

### ListInstructorDirectoryQueryDto (source-only DTO)

Source: `src/modules/instructors/dto/list-instructor-directory-query.dto.ts`.

- `page: inferred` = `1` — `@IsOptional() @Type(() => Number) @IsInt() @Min(1)`.
- `limit: inferred` = `20` — `@IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)`.
- `search?: string` — `@IsOptional() @Transform(trimmed) @IsString() @MaxLength(100)`.
- `subject?: string` — `@IsOptional() @Transform(trimmed) @IsString() @MaxLength(100)`.
- `keyStage?: string` — `@IsOptional() @Transform(trimmed) @IsString() @MaxLength(30)`.
- `skill?: string` — `@IsOptional() @Transform(trimmed) @IsString() @MaxLength(100)`.
- `city?: string` — `@IsOptional() @Transform(trimmed) @IsString() @MaxLength(100)`.
- `dbsVerified?: boolean` — `@IsOptional() @Transform(booleanValue) @IsBoolean()`.
- `qtsQualified?: boolean` — `@IsOptional() @Transform(booleanValue) @IsBoolean()`.
- `availableToday?: boolean` — `@IsOptional() @Transform(booleanValue) @IsBoolean()`.
- `minExperience?: number` — `@IsOptional() @Type(() => Number) @IsInt() @Min(0)`.
- `maxHourlyRate?: number` — `@IsOptional() @Type(() => Number) @IsNumber() @Min(0)`.
- `maxDailyRate?: number` — `@IsOptional() @Type(() => Number) @IsNumber() @Min(0)`.
- `minRating?: number` — `@IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(5)`.

### ListJobsQueryDto (source-only DTO)

Source: `src/modules/jobs/dto/list-jobs-query.dto.ts`.

- `jobType?: JobType` — `@IsOptional() @IsEnum(JobType)`.
- `page: inferred` = `1` — `@IsOptional() @Type(() => Number) @IsInt() @Min(1)`.
- `limit: inferred` = `20` — `@IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)`.

### SearchJobsQueryDto (source-only DTO)

Source: `src/modules/jobs/dto/list-jobs-query.dto.ts` — `extends ListJobsQueryDto`.

- `search?: string` — `@IsOptional() @Transform(trimmed) @IsString() @MaxLength(100)`.
- `subject?: string` — `@IsOptional() @Transform(trimmed) @IsString() @MaxLength(100)`.
- `keyStage?: string` — `@IsOptional() @Transform(trimmed) @IsString() @MaxLength(20)`.
- `urgent?: boolean` — `@IsOptional() @Transform(({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value)) @IsBoolean()`.

### ListMyJobsQueryDto (source-only DTO)

Source: `src/modules/jobs/dto/list-jobs-query.dto.ts` — `extends SearchJobsQueryDto`.

- `status?: JobStatus` — `@IsOptional() @IsEnum(JobStatus)`.

### MatchListQueryDto (source-only DTO)

Source: `src/modules/matching/dto/match-list-query.dto.ts`.

- `minScore: inferred` = `0` — `@IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100)`.
- `page: inferred` = `1` — `@IsOptional() @Type(() => Number) @IsInt() @Min(1)`.
- `limit: inferred` = `20` — `@IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)`.

### ListNotificationsQueryDto (source-only DTO)

Source: `src/modules/notifications/dto/list-notifications-query.dto.ts` — `extends PaginationQueryDto`.

- `unread?: boolean` — `@IsOptional() @Transform(({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value)) @IsBoolean()`.

### BookingTipCheckoutResponseDto (source-only DTO)

Source: `src/modules/payments/dto/booking-tip.dto.ts`.

- `tipId: string`.
- `sessionId: string`.
- `url: string`.
- `tipAmountPence: number`.
- `feeAmountPence: number`.
- `totalAmountPence: number`.

### InvoicePageQueryDto (source-only DTO)

Source: `src/modules/payments/dto/list-invoices-query.dto.ts`.

- `page: inferred` = `1` — `@IsOptional() @Type(() => Number) @IsInt() @Min(1)`.
- `limit: inferred` = `20` — `@IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)`.

### ListMyInvoicesQueryDto (source-only DTO)

Source: `src/modules/payments/dto/list-invoices-query.dto.ts` — `extends InvoicePageQueryDto`.

- `status?: (typeof PARTY_VISIBLE_INVOICE_STATUSES)[number]` — `@IsOptional() @IsIn(PARTY_VISIBLE_INVOICE_STATUSES)`.

### JobInvoicesQueryDto (source-only DTO)

Source: `src/modules/payments/dto/list-invoices-query.dto.ts` — `extends InvoicePageQueryDto`.

- `status?: InvoiceStatus` — `@IsOptional() @IsEnum(InvoiceStatus)`.

### AdminListInvoicesQueryDto (source-only DTO)

Source: `src/modules/payments/dto/list-invoices-query.dto.ts` — `extends JobInvoicesQueryDto`.

- `jobId?: string` — `@IsOptional() @IsUUID()`.
- `bookingId?: string` — `@IsOptional() @IsUUID()`.
- `instructorId?: string` — `@IsOptional() @IsUUID()`.
- `institutionId?: string` — `@IsOptional() @IsUUID()`.

### ListReviewsQueryDto (source-only DTO)

Source: `src/modules/reviews/dto/list-reviews-query.dto.ts`.

- `page: inferred` = `1` — `@IsOptional() @Type(() => Number) @IsInt() @Min(1)`.
- `limit: inferred` = `20` — `@IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)`.

### ListSignatoryApprovalsQueryDto (source-only DTO)

Source: `src/modules/signatory-approvals/dto/list-signatory-approvals-query.dto.ts`.

- `status?: SignatoryApprovalStatus` — `@IsOptional() @IsEnum(SignatoryApprovalStatus)`.
- `institutionId?: string` — `@IsOptional() @IsUUID()`.
- `trustId?: string` — `@IsOptional() @IsUUID()`.
- `page: inferred` = `1` — `@IsOptional() @Type(() => Number) @IsInt() @Min(1)`.
- `limit: inferred` = `20` — `@IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)`.

### TwoFactorChallengeResponseDto (source-only DTO)

Source: `src/modules/two-factor/dto/two-factor.dto.ts`.

- `twoFactorRequired: boolean`.
- `twoFactorToken: string`.
- `expiresInMinutes: number`.

### ListUsersQueryDto (source-only DTO)

Source: `src/modules/users/dto/list-users-query.dto.ts`.

- `page: inferred` = `1` — `@IsOptional() @Type(() => Number) @IsInt() @Min(1)`.
- `limit: inferred` = `20` — `@IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)`.
- `search?: string` — `@IsOptional() @IsString() @MaxLength(200)`.
- `role?: Role` — `@IsOptional() @IsEnum(Role)`.
- `accountType?: 'ADMIN' \| 'USERS'` — `@IsOptional() @IsIn(['ADMIN', 'USERS'])`.
- `profileStatus?: ProfileStatus` — `@IsOptional() @IsEnum(ProfileStatus)`.
- `status?: ProfileStatus` — `@IsOptional() @IsEnum(ProfileStatus)`.
- `countries?: string[]` — `@IsOptional() @Transform(({ value }: { value: unknown }) => {     const countries = typeof value === 'string' ? value.split(',') : value;     return Array.isArray(countries)       ? countries.map((country: unknown) => (typeof country === 'string' ? country.trim().toUpperCase() : country))       : countries;   }) @IsArray() @ArrayNotEmpty() @ArrayUnique() @IsISO31661Alpha2({ each: true })`.
- `emailVerified?: boolean` — `@IsOptional() @Transform(({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value)) @IsBoolean()`.
- `phoneVerified?: boolean` — `@IsOptional() @Transform(({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value)) @IsBoolean()`.
- `createdFrom?: string` — `@IsOptional() @IsDateString({ strict: true })`.
- `createdTo?: string` — `@IsOptional() @IsDateString({ strict: true })`.
- `joined?: string` — `@IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true })`.
- `sortBy?: 'createdAt' \| 'joined' \| 'lastLogin'` — `@IsOptional() @IsIn(['createdAt', 'joined', 'lastLogin'])`.
- `sortOrder?: 'asc' \| 'desc'` — `@IsOptional() @IsIn(['asc', 'desc'])`.

<a id="enum-reference"></a>

# Appendix D — Backend enums

These are persisted backend enums. Mobile screens must use the values relevant to the endpoint, and tolerate unknown future response values with a neutral display. Do not send display labels as enums.

```prisma
enum Role {
  INSTRUCTOR
  INSTITUTION
  USER
  ADMIN
}

enum OAuthProvider {
  GOOGLE
}

enum FoundingInterestType {
  SCHOOL
  TEACHER
}

enum FoundingInterestStatus {
  NEW
  CONTACTED
  QUALIFIED
  CONVERTED
  CLOSED
}

enum DocumentContext {
  INSTRUCTOR_PROFILE
  INSTITUTION_PROFILE
}

enum DocumentVerificationStatus {
  NOT_REQUIRED
  PENDING
  APPROVED
  REJECTED
  REQUIRES_INFO
}

enum IdentityVerificationStatus {
  LINK_SENT // guest link created; waiting for the teacher to complete it
  SUBMITTED // teacher submitted; TrustID is processing (static webhook only)
  RESULTS_READY // TrustID says results are ready; queued for retrieval
  COMPLETED // results retrieved, stored and interpreted
  EXPIRED // no results within the link's lifetime (14 days by default)
  CANCELLED // replaced by a reissued link
}

enum IdentityVerificationOutcome {
  PASSED // verified automatically
  REFERRED // passed with work restrictions or an unsure face match: an admin decides
  SOFT_FAILED // could not be validated (blurry image, liveness): an admin decides or reissues
  HARD_FAILED // TrustID believes the document is fraudulent or the person an imposter
}

enum IdentityVerificationDecision {
  APPROVED
  REJECTED
}

enum DbsCheckStatus {
  SEND_FAILED // could not be sent (incomplete DBS form, or uCheck refused it): an admin resends it
  SUBMITTED // accepted by uCheck; waiting for the DBS
  COMPLETED // result issued
}

enum DbsCheckResult {
  CLEAR // nothing on the certificate
  SEE_CERTIFICATE // uCheck's "wait": the certificate has content, so an admin sees it before deciding
}

enum DbsCheckDecision {
  APPROVED
  REJECTED
}

enum DegreeCheckStatus {
  UNCONFIRMED // being sent, or Hedd's answer never arrived: Hedd may or may not have it, so an admin looks for our reference there
  WAITING // "wait": with the university
  MORE_INFORMATION // "send-more-information": an admin answers on the Hedd website (the API cannot)
  VERIFIED // the university confirmed the degree, perhaps with corrections
  CANCELLED // closed by the university, Hedd or an admin; the teacher can start a new check
}

enum DegreeCheckDecision {
  APPROVED
  REJECTED
}

enum RightToWorkStatus {
  CONTINUOUS
  TIME_LIMITED
  REJECTED
}

enum FaceMatchResult {
  MATCH
  UNSURE
  NO_MATCH
}

enum ProfileStatus {
  INCOMPLETE
  PENDING
  ACTIVE
  SUSPENDED
  DEACTIVATED
  REJECTED
}

enum JobType {
  INSTANT
  BRIEF
}

enum JobStatus {
  DRAFT
  ACTIVE
  RESERVED
  EXPIRED
  FILLED // a booking exists; private to the posting school and booked teacher
  CLOSED
  SUSPENDED // taken down by an admin (§2.13); only an admin can set or lift it
}

enum ApplicationStatus {
  APPLIED
  VIEWED
  SHORTLISTED
  HIRED // terminal: the work itself is tracked on the Booking
  REJECTED
}

enum BookingStatus {
  CONFIRMED
  COMPLETED
  CANCELLED
  NO_SHOW
}

enum AttendanceStatus {
  AWAITING_CONFIRMATION
  PRESENT
  ABSENT
}

enum AttendanceDecisionSource {
  TEACHER
  SCHOOL
  ADMIN
  SYSTEM_NO_RESPONSE
}

enum AttendanceCorrectionStatus {
  PENDING
  APPROVED
  REJECTED
}

enum AttendanceAdjustmentStatus {
  PENDING_REVIEW
  SETTLED
}

enum JobInvitationStatus {
  PENDING
  ACCEPTED
  DECLINED
  CANCELLED
  EXPIRED
}

enum ReviewerType {
  INSTITUTION
  INSTRUCTOR
}

enum InstitutionType {
  SINGLE_SCHOOL
  MAT_SCHOOL
}

enum SchoolType {
  PRIMARY
  SECONDARY
}

enum SignatoryApprovalStatus {
  PENDING
  APPROVED
  DECLINED
  EXPIRED
  REVOKED
}

enum InvoiceStatus {
  PENDING // being created in Stripe; becomes OPEN once sent to the school
  OPEN // sent, awaiting payment
  PAID
  VOID // cancelled before payment; a new invoice may then be issued
  UNCOLLECTIBLE // written off in Stripe; can still be paid
}

enum BookingTipStatus {
  PENDING
  PROCESSING
  PAID
  FAILED
  CANCELLED
  REFUNDED
}

enum ProfileDocumentKind {
  CERTIFICATE
  ACHIEVEMENT
}

enum NotificationType {
  JOB_INVITATION
  JOB_INVITATION_STATUS
  JOB_MATCH
  APPLICATION_RECEIVED
  APPLICATION_STATUS
  BOOKING_CONFIRMED
  BOOKING_CANCELLED
  BOOKING_COMPLETED
  ATTENDANCE_CONFIRMATION
  INVOICE_PAID
  INVOICE_PAYMENT_FAILED
  PROFILE_STATUS
  REVIEW_RECEIVED
  IDENTITY_VERIFICATION
}

enum NotificationEmailStatus {
  NONE
  PENDING
  SENDING
  SENT
  FAILED
  SKIPPED
}
```

<a id="error-reference"></a>

# Appendix E — Machine-readable error code index

Literal codes found in current backend production source. Not every error has a code: HTTP status and `message`/`fieldErrors` remain required fallbacks. Codes computed dynamically may not appear here. This list is **not** a promise that every endpoint emits every code. The source location and domain chapters determine applicability. Preserve unknown codes and request IDs without leaking tokens.

| Code | Source locations |
|---|---|
| `ACCESS_TOKEN_EXPIRED` | `src/modules/auth/auth-token.constants.ts` |
| `APPLICATION_REJECTED` | `src/modules/bookings/direct-hire.service.ts:457` |
| `APPLICATION_TERMS_UNVERIFIED` | `src/modules/jobs/job-policy.ts:99` |
| `ATTENDANCE_INVOICE_MUST_BE_VOIDED` | `src/modules/bookings/attendance.service.ts:154` |
| `ATTENDANCE_PAYMENT_COMPLETED` | `src/modules/bookings/attendance.service.ts:141` |
| `ATTENDANCE_PENDING` | `src/modules/payments/invoices.service.ts:89` |
| `AUTH_TOKEN_MISSING` | `src/modules/auth/auth-token.constants.ts` |
| `BRIEF_INVITATIONS_DISABLED` | `src/modules/bookings/direct-hire.service.ts:73`, `src/modules/bookings/direct-hire.service.ts:92`, `src/modules/bookings/direct-hire.service.ts:214`, `src/modules/matching/matching.service.ts:108` |
| `DBS_FORM_INCOMPLETE` | `src/modules/dbs-checks/dbs-checks.service.ts:231` |
| `DROPDOWN_NOT_FOUND` | `src/modules/dropdowns/dropdowns.service.ts:69` |
| `DROPDOWN_REVISION_CONFLICT` | `src/modules/dropdowns/dropdowns.service.ts:393` |
| `DROPDOWNS_NOT_SEEDED` | `src/modules/dropdowns/dropdowns.service.ts:66` |
| `HEDD_REJECTED` | `src/modules/degree-checks/degree-checks.service.ts:163` |
| `IMMUTABLE_DROPDOWN_VALUE` | `src/modules/dropdowns/dropdowns.service.ts:302` |
| `INSTRUCTOR_DOCUMENTS_NOT_VERIFIED` | `src/common/profile/instructor-document-access.ts:71` |
| `INVALID_ACCESS_TOKEN` | `src/modules/auth/auth-token.constants.ts` |
| `INVALID_BOOKING_PAYMENT_TERMS` | `src/modules/bookings/booking-payment-terms.ts:97` |
| `INVALID_DROPDOWN_OPTION` | `src/modules/dropdowns/dropdowns.service.ts:25` |
| `INVALID_DROPDOWN_SELECTION` | `src/modules/dropdowns/dropdowns.service.ts:121` |
| `INVALID_JOB_SCHEDULE` | `src/modules/jobs/job-schedule.ts:343` |
| `INVALID_JOB_TERMS` | `src/modules/jobs/job-policy.ts:89` |
| `INVITATION_DECLINED` | `src/modules/bookings/direct-hire.service.ts:102` |
| `INVITATION_PENDING` | `src/modules/bookings/direct-hire.service.ts:134` |
| `JOB_FILLED` | `src/modules/applications/applications.repository.ts:237`, `src/modules/applications/applications.service.ts:168`, `src/modules/bookings/direct-hire.service.ts:425` |
| `JOB_HISTORY_PROTECTED` | `src/modules/jobs/jobs.repository.ts:139`, `src/modules/jobs/jobs.repository.ts:243` |
| `JOB_TERMS_CHANGED` | `src/modules/bookings/direct-hire.service.ts:225`, `src/modules/jobs/job-policy.ts:105` |
| `JOB_TERMS_LOCKED` | `src/modules/jobs/job-policy.ts:114` |
| `JOB_TYPE_LOCKED` | `src/modules/jobs/jobs.repository.ts:128` |
| `JOB_UNAVAILABLE` | `src/modules/bookings/direct-hire.service.ts:439` |
| `RATE_LIMITED` | `src/common/guards/rate-limit.guard.ts:80` |
| `SCHOOL_CARD_REQUIRED` | `src/common/guards/payment-setup.guard.ts:59` |
| `SCHOOL_INACTIVE` | `src/modules/jobs/job-policy.ts:13` |
| `SCHOOL_TYPE_REQUIRED` | `src/modules/institutions/institutions.service.ts:202`, `src/modules/jobs/jobs.service.ts:60`, `src/modules/teaching-catalogue/teaching-catalogue.module.ts:31` |
| `STAFFING_NEEDS_REQUIRED_FOR_SCHOOL_TYPE_CHANGE` | `src/modules/institutions/institutions.service.ts:195` |
| `TEACHER_NOT_ELIGIBLE` | `src/modules/matching/matching.service.ts:200` |
| `TEACHER_PAYOUT_SETUP_REQUIRED` | `src/common/guards/payment-setup.guard.ts:33` |
| `TEACHER_SCHEDULE_CONFLICT` | `src/modules/availability/availability-check.ts:143` |
| `UCHECK_REJECTED` | `src/modules/dbs-checks/dbs-checks.service.ts:250` |
