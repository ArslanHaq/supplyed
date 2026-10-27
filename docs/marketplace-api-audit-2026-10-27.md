# Marketplace frontend API audit — 27 October 2026

This audit covers the supplied **Frontend Marketplace Integration Guide**, the existing Next.js API adapters and server actions, and the screens that consume their responses. API paths below are backend paths under `{API_ORIGIN}/api`. Browser-facing `/api/...` routes are Next.js adapters; writes generally use Next.js server actions.

## What changes for website users

| Website flow | Previous behavior or gap | Updated behavior |
| --- | --- | --- |
| School dashboard / job management | `RESERVED` was absent from the job union, counts and visibility labels; deletion was offered for every job. | Reserved jobs retain their status and count. Delete appears only when `canDelete === true`; protected jobs can be closed. The delete action reads the current owned job before calling DELETE. |
| Edit a role | The editor did not consume `termsLocked`. | Locked jobs show a read-only explanation with links to view terms, create a new role, or manage status. Material updates are also checked in the server action. |
| Publish a role | The draft/publish sequence already existed, but publication validation was incomplete. | Create still saves a draft, then PATCH publishes it. Required subjects, key stages, location, future dates, positive pay, and appropriate work units are validated. A failed publish retains the saved draft ID and field errors. |
| Teacher applies | Every HTTP 409 was shown as a successful “Already applied” outcome. | Reservation/unavailability codes close the proposal dialog and refresh state. Other conflicts remain errors. Availability and application records are reloaded instead of inventing a successful application. |
| School sends an invitation | Request IDs were already persisted, but UI copy said the position was not reserved; new-job invitations omitted key stages. | A pending invitation exclusively reserves the position. New-job invitations include required key-stage selection and complete publishable terms. Saved request IDs and bodies remain stable for uncertain retries. |
| Teacher accepts an invitation | Acceptance required a DRAFT/ACTIVE job, so the new RESERVED response disabled acceptance. | A pending, unexpired invitation on a RESERVED job can be accepted. Decisions remain bodyless POST requests with duplicate-click protection. |
| Invitation declined/cancelled | Text incorrectly said withdrawal could not reopen a job. | Text explains that an eligible job normally reopens; the frontend refreshes actual server status. It never locally forces ACTIVE. |
| School hires an applicant | Hiring controls did not distinguish legacy applications; displayed role terms came from the current job. | Recorded terms are shown. Legacy applications cannot be hired directly and direct users to send a fresh invitation. Hire confirmation uses the saved offer. |
| Applications, bookings, profile history and messaging | Several views consumed job details without explicit snapshot/legacy handling; profile history fetched live jobs. | Applications use `agreedTerms`; recorded bookings project the snapshot into their displayed dates/pay/location/units. Legacy records show warnings and do not borrow current role/location data. Profile history no longer fetches live jobs to reconstruct an application's offer. |
| “View job” from a booking | Loaded current job details through the accessible-job API. | Loads the booking by ID and displays its immutable terms. Legacy bookings show only historical title plus top-level dates/pay/units. |
| Current user / onboarding / settings | Mixed `/auth/me` with `/users/:id` for self-service reads. | All those backend reads use `/users/me`. The browser's existing `/api/auth/me` adapter remains stable. |
| Rate limits | Retry headers and structured delays were lost in parts of the server-action path; phone OTP parsed message text. | Both numeric and HTTP-date `Retry-After` values and body `retryAfter` are understood. Sensitive forms disable retry during the cooldown, a countdown is displayed, and the query client does not automatically retry HTTP 429. |

## Jobs: endpoint-by-endpoint

Primary code: [queries](../features/jobs/queries.ts), [actions](../features/jobs/actions.ts), [normalizers](../features/jobs/schemas.ts), [validation](../features/jobs/validation.ts), [query hooks](../features/jobs/use-jobs.ts).

| Backend API | Frontend use / file | Change and effect |
| --- | --- | --- |
| `POST /jobs` | `createJobAction`; `PostJobPage` | Continues to omit status from creation and create DRAFT first. Publication validation and structured failure metadata are strengthened. |
| `GET /jobs` | `listJobs`; `/api/jobs`; `FindJobsPage` | Response normalization now retains permission/history flags and RESERVED. Public visibility remains enforced by the backend. |
| `GET /jobs/mine` | `listMyJobs`; `/api/jobs/mine`; dashboards, job management, invitation picker | RESERVED filtering/counts are supported. Invitation picker continues to offer DRAFT/ACTIVE only. |
| `GET /jobs/mine/:id` | `getMyJob`; `/api/jobs/:id?scope=mine`; editor, applicant management, delete/update preflight | Owned jobs can be read in private statuses. Server flags govern editing/deletion; no public endpoint is used to authorize these actions. |
| `GET /jobs/accessible/:id` | `getAccessibleJob`; `/api/jobs/:id?scope=accessible`; signed-in role detail | Retained for authorized job access. Booking contract views now use the booking endpoint instead. |
| `GET /jobs/:id` | `getJob`; `/api/jobs/:id` without scope | Public read contract retained. Removed its use as a historical application fallback in profile history. |
| `GET /jobs/admin/all` | No existing consumer | No administrator job-list API screen was added. Shared types/errors support this contract if a consumer is added later. |
| `GET /jobs/institution/:institutionId` | No existing direct consumer | No new school-job-list flow was added. Existing institution profile APIs remain separate. |
| `PATCH /jobs/:id` | `updateJobAction`; editor, publish/close controls | Rejects workflow-owned RESERVED/FILLED submissions; checks locked material terms; refreshes jobs, applications, invitations and notification queries after changes/conflicts. Status-only closing remains possible. |
| `DELETE /jobs/:id` | `deleteJobAction`; `JobManagementList`, `DeleteJobModal` | Shown and called only after server `canDelete === true`. `JOB_HISTORY_PROTECTED` explains Close instead and triggers state refresh. |

## Applications: endpoint-by-endpoint

Primary code: [types](../features/applications/types.ts), [queries](../features/applications/queries.ts), [normalizers](../features/applications/schemas.ts), [actions](../features/applications/actions.ts), [hooks](../features/applications/use-applications.ts), [workspace](../components/organisms/ApplicationsWorkspacePage.tsx), [teacher views](../components/organisms/TeacherApplicationsPage.tsx).

| Backend API | Frontend use | Change and effect |
| --- | --- | --- |
| `POST /applications` | Job-detail proposal dialog | Payload stays `{jobId, coverLetter?}`. Returned snapshot is normalized and preserved. Structured unavailable/reserved conflicts are no longer reported as success. |
| `GET /applications/me` | Teacher applications, dashboard, existing-application check, profile history | Snapshot-aware normalization and explicit legacy handling apply to all consumers. |
| `GET /applications/job/:jobId` | School application workspace, applicant counts | Snapshot terms determine whether direct hiring is available. Existing pagination/status filters remain. |
| `GET /applications/instructor/:instructorId` | No direct consumer | Teacher self-service already uses `/applications/me`; no cross-user listing was introduced. |
| `GET /applications/:id` | Application detail, messaging context | Uses the recorded terms, with a warning when absent. |
| `GET /applications/:id/history` | Teacher timeline and school status-history panel | Endpoint/payload unchanged. History is refreshed through application query invalidation. |
| `PATCH /applications/:id/status` | School application pipeline and hire confirmation | Recorded terms are required by UI hiring controls. On successful hire, jobs/applications/bookings/invitations/notifications and related matching/profile queries refresh. `automaticallyRejectedCount` continues to inform the success message. |

`jobDetails` is kept as a compatibility display field, but normalized from `agreedTerms` only for RECORDED rows. It is null for legacy applications. No live-job fallback is used to fabricate historical consent.

## Invitations: endpoint-by-endpoint

Primary code: [types](../features/invitations/types.ts), [eligibility](../features/invitations/schemas.ts), [validation](../features/invitations/validation.ts), [actions](../features/invitations/actions.ts), [send dialog](../components/organisms/InvitationModal.tsx), [decision screen](../components/organisms/JobInvitationsPage.tsx).

| Backend API | Frontend use | Change and effect |
| --- | --- | --- |
| `POST /job-invitations` | Existing-job and new-job invitation forms | Canonical endpoint retained. Exactly one of `jobId`/`newJob`, instructor profile ID, stable UUID request ID, optional message/deadline. Full new-job terms validated. Adds key-stage control. |
| `POST /bookings/direct-hire` | Not used | Compatibility alias remains unnecessary; frontend uses the canonical invitation endpoint and does not assume a booking exists before acceptance. |
| `GET /job-invitations/me` | Invitation lists, school dashboard, invited-job summaries, messaging | Immutable offer type is shared with applications/bookings. Existing pagination and expiry handling retained. |
| `GET /job-invitations/:id` | Invitation detail/deep links | RESERVED is recognized as the expected pending-job status. Snapshot remains the displayed offer. |
| `POST /job-invitations/:id/accept` | Teacher decision | Bodyless request retained; returned Booking is normalized from accepted terms. Duplicate-click/uncertain-response recovery remains. Marketplace state and notification counts refresh. |
| `POST /job-invitations/:id/decline` | Teacher decision | Bodyless request retained; response drives state and job is refreshed. No local assumption that reopening always succeeds. |
| `POST /job-invitations/:id/cancel` | School withdrawal | Bodyless request retained; response drives state and job is refreshed. Copy now reflects possible reopening. |

The existing post-invitation conversation/message workflow remains. A failure to finish the conversation is reported as uncertain and preserves the same invitation request for retry; it does not create a fresh invitation request automatically.

## Bookings: endpoint-by-endpoint

Primary code: [types](../features/bookings/types.ts), [normalizer](../features/bookings/schemas.ts), [queries](../features/bookings/queries.ts), [actions](../features/bookings/actions.ts), [bookings screen](../components/organisms/BookingsPage.tsx), [contract view](../components/organisms/JobDetailPage.tsx).

| Backend API | Frontend use | Change and effect |
| --- | --- | --- |
| `GET /bookings/me` | Bookings, calendar, teacher dashboard and profile/review history | RECORDED rows display snapshot terms. LEGACY_PARTIAL rows retain historical title/top-level dates/pay/units, with other role/location details omitted. Existing filters remain. |
| `GET /bookings` | No existing admin-list consumer | No new administrator booking list was introduced. |
| `GET /bookings/:id` | Selected booking and booking-linked contract detail | Snapshot normalization applies; current job is not used as the accepted contract. |
| `PATCH /bookings/:id/complete` | School completion action | Request semantics unchanged; normalized returned booking uses immutable terms. |
| `PATCH /bookings/:id/no-show` | School no-show action | Request semantics unchanged; normalized returned booking uses immutable terms. |
| `PATCH /bookings/:id/cancel` | Booking cancellation | `{reason}` behavior retained; normalized returned booking uses immutable terms. |

Invoice/payment API contracts were not changed by the supplied guide. Existing booking consumers receive the normalized agreed pay/units, and hire-confirmation payment notices now read the agreed offer rather than the live role.

## Current user and cross-cutting errors

| API / concern | Updated location | Website effect |
| --- | --- | --- |
| `GET /users/me` | `features/auth/queries.ts`, `features/onboarding/actions.ts`, `features/settings/queries.ts` | Signed-in identity/settings/onboarding load without calling the now-admin-only user-by-ID endpoint. Profile approval status still comes from the existing instructor/institution profile flow. |
| `GET /users/:id` | Removed from onboarding self-read | No self-service dependency on admin-only access. |
| `GET /auth/me` | Replaced for backend user reads | Local browser adapter `/api/auth/me` still exists and calls `/users/me` server-side. |
| Success/error envelopes | `lib/server/api-client.ts`, `lib/server/api-error.ts`, `lib/server/action-response.ts`, `lib/server/route-error.ts` | Successful data remains unwrapped. Message arrays, error codes, field errors, request IDs and retry metadata survive the frontend transport. |
| Browser errors | `lib/query/fetch-json.ts`, `lib/api-error-details.ts` | Numeric and HTTP-date Retry-After values supported; structured metadata remains on errors. |
| Shared cooldown | `lib/rate-limit.ts`, `lib/query/query-client.tsx` | A countdown blocks further query network attempts and disables sensitive form retries for the reported interval. No automatic 429 query retry. Missing retry delay uses a conservative 60-second fallback. |
| `SCHOOL_INACTIVE` | `features/auth/use-school-hiring.ts` plus publish/invite/hire controls | Server rejection disables school hiring actions for the mounted workspace; explanation directs the user to account approval/status. Existing workspace approval checks remain. |

Sensitive routes affected through error handling, without changing their request contracts:

- Login/register, password reset request/confirmation, email OTP verify/resend and login 2FA verification: `features/auth/backend.ts`, `features/auth/actions.ts`, login/signup/reset/verification screens.
- Phone OTP send/verify: `features/auth/phone-actions.ts`, `components/molecules/PhoneVerification.tsx`. Retry delay is no longer parsed from message text.
- 2FA setup/enable/disable/recovery codes: `features/auth/two-factor-actions.ts`, `components/organisms/SecurityPage.tsx`.
- Contact/waitlist registration/details: `features/contact/actions.ts`, `features/contact/waitlist-client.ts`, `FoundingInterestForm`.
- Signatory approval token read/approve/decline: existing `/api/signatory-approvals/:token` adapter and `SignatoryApprovalPage`; retry metadata is handled without exposing the token as diagnostics.

## Verification and rollout boundaries

- Regression coverage exercises RESERVED filters/counts/labels, server permission flags, snapshot precedence, legacy suppression, invitation acceptance, publishable work units, workflow-owned status rejection, draft creation and retry metadata.
- Verification passed: 14 Node regression tests, TypeScript, repository-wide ESLint, and `next build` (33 static pages generated). The build retains an existing non-blocking module-type warning for `tailwind.config.ts`.
- No authenticated backend integration or production mutation was performed. Live behavior still depends on the backend branch and migrations being deployed.
- Backend migrations, duplicate-data cleanup, JWT secrets, trusted proxies and database-backed integration tests are backend/deployment work from the supplied guide; this frontend repository does not apply them.
- Existing API routes outside this guide remain in place. The complete shared-client call-site inventory below distinguishes feature-specific edits from shared error-transport effects; it is not a claim that every unrelated API contract was redesigned.

## Complete shared API-client call-site inventory

Generated from TypeScript call expressions in `app`, `features` and `lib`. Dynamic expressions are shown as written, so entries are **call sites**, not a count of unique backend endpoints. This excludes third-party browser SDK calls (Stripe/socket.io/NextAuth) and direct upload URLs, whose contracts are outside this backend guide.


132 call sites across 40 files.

| Method | Endpoint or dynamic expression | Source | Line | Impact |
| --- | --- | --- | ---: | --- |
| GET | `/bookings/${encodeURIComponent(id)}` | [app/api/bookings/[id]/route.ts](../app/api/bookings/[id]/route.ts) | 10 | Request contract retained; shared API error transport updated |
| GET | `/conversations/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}/download-url` | [app/api/conversations/[id]/attachments/[attachmentId]/preview/route.ts](../app/api/conversations/[id]/attachments/[attachmentId]/preview/route.ts) | 14 | Request contract retained; shared API error transport updated |
| POST | `/conversations/${id}/attachments` | [app/api/conversations/[id]/attachments/route.ts](../app/api/conversations/[id]/attachments/route.ts) | 33 | Request contract retained; shared API error transport updated |
| POST | `"/conversations/socket-ticket"` | [app/api/conversations/socket-ticket/route.ts](../app/api/conversations/socket-ticket/route.ts) | 13 | Request contract retained; shared API error transport updated |
| GET | `/dropdowns/${encodeURIComponent(name)}` | [app/api/dropdowns/[name]/route.ts](../app/api/dropdowns/[name]/route.ts) | 8 | Request contract retained; shared API error transport updated |
| GET | `"/dropdowns"` | [app/api/dropdowns/route.ts](../app/api/dropdowns/route.ts) | 5 | Request contract retained; shared API error transport updated |
| GET | `/documents/${encodeURIComponent(documentId)}/download-url` | [app/api/onboarding/documents/[documentId]/preview/route.ts](../app/api/onboarding/documents/[documentId]/preview/route.ts) | 27 | Request contract retained; shared API error transport updated |
| POST | `"/payments/payout-account/instant-payout"` | [app/api/payments/payout-account/instant-payout/route.ts](../app/api/payments/payout-account/instant-payout/route.ts) | 13 | Request contract retained; shared API error transport updated |
| GET | `/signatory-approvals/token/${encodeURIComponent(token)}` | [app/api/signatory-approvals/[token]/route.ts](../app/api/signatory-approvals/[token]/route.ts) | 17 | Sensitive-route error metadata and cooldown handling |
| POST | `/signatory-approvals/token/${encodeURIComponent(token)}/approve` | [app/api/signatory-approvals/[token]/route.ts](../app/api/signatory-approvals/[token]/route.ts) | 40 | Sensitive-route error metadata and cooldown handling |
| POST | `/signatory-approvals/token/${encodeURIComponent(token)}/decline` | [app/api/signatory-approvals/[token]/route.ts](../app/api/signatory-approvals/[token]/route.ts) | 48 | Sensitive-route error metadata and cooldown handling |
| GET | `"/teaching-catalogue"` | [app/api/teaching-catalogue/route.ts](../app/api/teaching-catalogue/route.ts) | 7 | Request contract retained; shared API error transport updated |
| POST | `"/applications"` | [features/applications/actions.ts](../features/applications/actions.ts) | 31 | Immutable application terms, legacy handling and hiring refresh |
| PATCH | `/applications/${input.id}/status` | [features/applications/actions.ts](../features/applications/actions.ts) | 49 | Immutable application terms, legacy handling and hiring refresh |
| GET | `/applications/${applicationId}` | [features/applications/queries.ts](../features/applications/queries.ts) | 15 | Immutable application terms, legacy handling and hiring refresh |
| GET | `/applications/${applicationId}/history` | [features/applications/queries.ts](../features/applications/queries.ts) | 27 | Immutable application terms, legacy handling and hiring refresh |
| GET | `/applications/job/${jobId}` | [features/applications/queries.ts](../features/applications/queries.ts) | 38 | Immutable application terms, legacy handling and hiring refresh |
| GET | `"/applications/me"` | [features/applications/queries.ts](../features/applications/queries.ts) | 58 | Immutable application terms, legacy handling and hiring refresh |
| GET | `profilePath` | [features/auth/actions.ts](../features/auth/actions.ts) | 93 | Sensitive-route error metadata and cooldown handling |
| POST | `backendAuthEndpoints.register` | [features/auth/backend.ts](../features/auth/backend.ts) | 370 | Sensitive-route error metadata and cooldown handling |
| POST | `backendAuthEndpoints.login` | [features/auth/backend.ts](../features/auth/backend.ts) | 391 | Sensitive-route error metadata and cooldown handling |
| POST | `backendAuthEndpoints.verifyEmail` | [features/auth/backend.ts](../features/auth/backend.ts) | 420 | Sensitive-route error metadata and cooldown handling |
| POST | `backendAuthEndpoints.verifyTwoFactor` | [features/auth/backend.ts](../features/auth/backend.ts) | 449 | Sensitive-route error metadata and cooldown handling |
| POST | `backendAuthEndpoints.resendEmailVerification` | [features/auth/backend.ts](../features/auth/backend.ts) | 472 | Sensitive-route error metadata and cooldown handling |
| POST | `backendAuthEndpoints.forgotPassword` | [features/auth/backend.ts](../features/auth/backend.ts) | 492 | Sensitive-route error metadata and cooldown handling |
| POST | `backendAuthEndpoints.resetPassword` | [features/auth/backend.ts](../features/auth/backend.ts) | 520 | Sensitive-route error metadata and cooldown handling |
| POST | `backendAuthEndpoints.oauthGoogle` | [features/auth/backend.ts](../features/auth/backend.ts) | 560 | Sensitive-route error metadata and cooldown handling |
| POST | `backendAuthEndpoints.refresh` | [features/auth/backend.ts](../features/auth/backend.ts) | 585 | Sensitive-route error metadata and cooldown handling |
| POST | `"/auth/phone/otp/send"` | [features/auth/phone-actions.ts](../features/auth/phone-actions.ts) | 37 | Sensitive-route error metadata and cooldown handling |
| POST | `"/auth/phone/otp/verify"` | [features/auth/phone-actions.ts](../features/auth/phone-actions.ts) | 62 | Sensitive-route error metadata and cooldown handling |
| GET | `"/users/me"` | [features/auth/queries.ts](../features/auth/queries.ts) | 14 | Current-user privacy endpoint |
| GET | `"/auth/2fa/status"` | [features/auth/two-factor-actions.ts](../features/auth/two-factor-actions.ts) | 92 | Sensitive-route error metadata and cooldown handling |
| POST | `"/auth/2fa/setup"` | [features/auth/two-factor-actions.ts](../features/auth/two-factor-actions.ts) | 100 | Sensitive-route error metadata and cooldown handling |
| POST | `"/auth/2fa/enable"` | [features/auth/two-factor-actions.ts](../features/auth/two-factor-actions.ts) | 116 | Sensitive-route error metadata and cooldown handling |
| POST | `"/auth/2fa/disable"` | [features/auth/two-factor-actions.ts](../features/auth/two-factor-actions.ts) | 135 | Sensitive-route error metadata and cooldown handling |
| POST | `"/auth/2fa/recovery-codes"` | [features/auth/two-factor-actions.ts](../features/auth/two-factor-actions.ts) | 155 | Sensitive-route error metadata and cooldown handling |
| PATCH | `/bookings/${id}/${bookingActionPath[input.action]}` | [features/bookings/actions.ts](../features/bookings/actions.ts) | 29 | Immutable booking terms and structured mutation errors |
| POST | `"/reviews"` | [features/bookings/actions.ts](../features/bookings/actions.ts) | 51 | Immutable booking terms and structured mutation errors |
| GET | `"/bookings/me"` | [features/bookings/queries.ts](../features/bookings/queries.ts) | 29 | Immutable booking terms and structured mutation errors |
| POST | `"/contact/register-interest"` | [features/contact/actions.ts](../features/contact/actions.ts) | 89 | Sensitive-route error metadata and cooldown handling |
| POST | `"/contact/founding-interest"` | [features/contact/actions.ts](../features/contact/actions.ts) | 143 | Sensitive-route error metadata and cooldown handling |
| PATCH | `/contact/founding-interest/${encodeURIComponent(id)}/details` | [features/contact/actions.ts](../features/contact/actions.ts) | 182 | Sensitive-route error metadata and cooldown handling |
| POST | `"/conversations"` | [features/conversations/actions.ts](../features/conversations/actions.ts) | 18 | Request contract retained; shared API error transport updated |
| GET | `/conversations/application/${id}` | [features/conversations/actions.ts](../features/conversations/actions.ts) | 30 | Request contract retained; shared API error transport updated |
| GET | `/conversations/booking/${bookingId.trim()}` | [features/conversations/actions.ts](../features/conversations/actions.ts) | 40 | Request contract retained; shared API error transport updated |
| POST | `/conversations/${input.conversationId}/messages` | [features/conversations/actions.ts](../features/conversations/actions.ts) | 54 | Request contract retained; shared API error transport updated |
| POST | `/conversations/${conversationId}/read` | [features/conversations/actions.ts](../features/conversations/actions.ts) | 66 | Request contract retained; shared API error transport updated |
| GET | `/conversations/${conversationId}/attachments/${attachmentId}/download-url` | [features/conversations/actions.ts](../features/conversations/actions.ts) | 75 | Request contract retained; shared API error transport updated |
| GET | `"/conversations"` | [features/conversations/queries.ts](../features/conversations/queries.ts) | 16 | Request contract retained; shared API error transport updated |
| GET | `"/conversations/unread-count"` | [features/conversations/queries.ts](../features/conversations/queries.ts) | 30 | Request contract retained; shared API error transport updated |
| GET | `/conversations/${id}` | [features/conversations/queries.ts](../features/conversations/queries.ts) | 35 | Request contract retained; shared API error transport updated |
| GET | `/conversations/${id}/threads` | [features/conversations/queries.ts](../features/conversations/queries.ts) | 39 | Request contract retained; shared API error transport updated |
| GET | `/conversations/${id}/messages` | [features/conversations/queries.ts](../features/conversations/queries.ts) | 48 | Request contract retained; shared API error transport updated |
| POST | `"/job-invitations"` | [features/invitations/actions.ts](../features/invitations/actions.ts) | 28 | Exclusive invitations, snapshot terms and lifecycle refresh |
| POST | `"/conversations"` | [features/invitations/actions.ts](../features/invitations/actions.ts) | 35 | Existing conversation behavior retained; structured errors shared |
| GET | `/conversations/${conversation.id}/messages` | [features/invitations/actions.ts](../features/invitations/actions.ts) | 41 | Existing conversation behavior retained; structured errors shared |
| POST | `/conversations/${conversation.id}/messages` | [features/invitations/actions.ts](../features/invitations/actions.ts) | 46 | Existing conversation behavior retained; structured errors shared |
| POST | `/job-invitations/${id}/accept` | [features/invitations/actions.ts](../features/invitations/actions.ts) | 74 | Exclusive invitations, snapshot terms and lifecycle refresh |
| POST | `/job-invitations/${id}/${decision}` | [features/invitations/actions.ts](../features/invitations/actions.ts) | 79 | Exclusive invitations, snapshot terms and lifecycle refresh |
| GET | `"/job-invitations/me"` | [features/invitations/queries.ts](../features/invitations/queries.ts) | 15 | Exclusive invitations, snapshot terms and lifecycle refresh |
| GET | `/job-invitations/${id}` | [features/invitations/queries.ts](../features/invitations/queries.ts) | 20 | Exclusive invitations, snapshot terms and lifecycle refresh |
| POST | `"/jobs"` | [features/jobs/actions.ts](../features/jobs/actions.ts) | 20 | Job permissions, RESERVED, validation and lifecycle refresh |
| PATCH | `/jobs/${created.id}` | [features/jobs/actions.ts](../features/jobs/actions.ts) | 23 | Job permissions, RESERVED, validation and lifecycle refresh |
| GET | `/jobs/mine/${encodeURIComponent(input.id)}` | [features/jobs/actions.ts](../features/jobs/actions.ts) | 64 | Job permissions, RESERVED, validation and lifecycle refresh |
| GET | `/jobs/mine/${encodeURIComponent(input.id)}` | [features/jobs/actions.ts](../features/jobs/actions.ts) | 72 | Job permissions, RESERVED, validation and lifecycle refresh |
| PATCH | `/jobs/${normalizedInput.id}` | [features/jobs/actions.ts](../features/jobs/actions.ts) | 84 | Job permissions, RESERVED, validation and lifecycle refresh |
| GET | `/jobs/mine/${encodeURIComponent(id)}` | [features/jobs/actions.ts](../features/jobs/actions.ts) | 106 | Job permissions, RESERVED, validation and lifecycle refresh |
| DELETE | `/jobs/${id}` | [features/jobs/actions.ts](../features/jobs/actions.ts) | 108 | Job permissions, RESERVED, validation and lifecycle refresh |
| GET | `"/jobs"` | [features/jobs/queries.ts](../features/jobs/queries.ts) | 13 | Job permissions, RESERVED, validation and lifecycle refresh |
| GET | `"/jobs/mine"` | [features/jobs/queries.ts](../features/jobs/queries.ts) | 24 | Job permissions, RESERVED, validation and lifecycle refresh |
| GET | `/jobs/${id}` | [features/jobs/queries.ts](../features/jobs/queries.ts) | 34 | Job permissions, RESERVED, validation and lifecycle refresh |
| GET | `/jobs/mine/${encodeURIComponent(id)}` | [features/jobs/queries.ts](../features/jobs/queries.ts) | 48 | Job permissions, RESERVED, validation and lifecycle refresh |
| GET | `/jobs/accessible/${encodeURIComponent(id)}` | [features/jobs/queries.ts](../features/jobs/queries.ts) | 62 | Job permissions, RESERVED, validation and lifecycle refresh |
| GET | `/matching/jobs/${jobId}/applications` | [features/matching/queries.ts](../features/matching/queries.ts) | 16 | Shared snapshot-aware job/application/booking normalization |
| GET | `/matching/jobs/${jobId}/instructors` | [features/matching/queries.ts](../features/matching/queries.ts) | 21 | Shared snapshot-aware job/application/booking normalization |
| GET | `"/matching/jobs/recommended"` | [features/matching/queries.ts](../features/matching/queries.ts) | 26 | Shared snapshot-aware job/application/booking normalization |
| GET | `/matching/jobs/${jobId}/score` | [features/matching/queries.ts](../features/matching/queries.ts) | 31 | Shared snapshot-aware job/application/booking normalization |
| POST | `/notifications/${id}/read` | [features/notifications/actions.ts](../features/notifications/actions.ts) | 15 | Request contract retained; shared API error transport updated |
| POST | `"/notifications/read-all"` | [features/notifications/actions.ts](../features/notifications/actions.ts) | 23 | Request contract retained; shared API error transport updated |
| PATCH | `"/notifications/preferences"` | [features/notifications/actions.ts](../features/notifications/actions.ts) | 35 | Request contract retained; shared API error transport updated |
| GET | `"/notifications"` | [features/notifications/queries.ts](../features/notifications/queries.ts) | 15 | Request contract retained; shared API error transport updated |
| GET | `"/notifications/unread-count"` | [features/notifications/queries.ts](../features/notifications/queries.ts) | 26 | Request contract retained; shared API error transport updated |
| GET | `"/notifications/preferences"` | [features/notifications/queries.ts](../features/notifications/queries.ts) | 31 | Request contract retained; shared API error transport updated |
| GET | `"/users/me"` | [features/onboarding/actions.ts](../features/onboarding/actions.ts) | 395 | Current-user privacy endpoint |
| GET | `"/instructors/me"` | [features/onboarding/actions.ts](../features/onboarding/actions.ts) | 402 | Request contract retained; shared API error transport updated |
| GET | `"/institutions/me"` | [features/onboarding/actions.ts](../features/onboarding/actions.ts) | 419 | Request contract retained; shared API error transport updated |
| GET | `"/institutions/me/signatory-approval"` | [features/onboarding/actions.ts](../features/onboarding/actions.ts) | 435 | Request contract retained; shared API error transport updated |
| POST | `"/institutions/me/signatory-approval"` | [features/onboarding/actions.ts](../features/onboarding/actions.ts) | 460 | Request contract retained; shared API error transport updated |
| GET | `"/users/me"` | [features/onboarding/actions.ts](../features/onboarding/actions.ts) | 512 | Current-user privacy endpoint |
| GET | `"/users/me"` | [features/onboarding/actions.ts](../features/onboarding/actions.ts) | 577 | Current-user privacy endpoint |
| GET | `"/users/me"` | [features/onboarding/actions.ts](../features/onboarding/actions.ts) | 597 | Current-user privacy endpoint |
| PATCH | `"/users/me"` | [features/onboarding/actions.ts](../features/onboarding/actions.ts) | 622 | Existing self-update contract retained |
| PATCH | `/instructors/${existing.id}` | [features/onboarding/actions.ts](../features/onboarding/actions.ts) | 650 | Request contract retained; shared API error transport updated |
| POST | `"/instructors"` | [features/onboarding/actions.ts](../features/onboarding/actions.ts) | 654 | Request contract retained; shared API error transport updated |
| PATCH | `/institutions/${existing.id}` | [features/onboarding/actions.ts](../features/onboarding/actions.ts) | 673 | Request contract retained; shared API error transport updated |
| POST | `"/institutions"` | [features/onboarding/actions.ts](../features/onboarding/actions.ts) | 677 | Request contract retained; shared API error transport updated |
| PATCH | `"/instructors/me/status"` | [features/onboarding/actions.ts](../features/onboarding/actions.ts) | 694 | Request contract retained; shared API error transport updated |
| PATCH | `"/institutions/me/status"` | [features/onboarding/actions.ts](../features/onboarding/actions.ts) | 714 | Request contract retained; shared API error transport updated |
| GET | `/documents/${documentId}/download-url` | [features/onboarding/actions.ts](../features/onboarding/actions.ts) | 777 | Request contract retained; shared API error transport updated |
| GET | `"/document-requirements/profile"` | [features/onboarding/documents.ts](../features/onboarding/documents.ts) | 217 | Request contract retained; shared API error transport updated |
| GET | `"/documents"` | [features/onboarding/documents.ts](../features/onboarding/documents.ts) | 245 | Request contract retained; shared API error transport updated |
| POST | `"/documents"` | [features/onboarding/documents.ts](../features/onboarding/documents.ts) | 340 | Request contract retained; shared API error transport updated |
| POST | `/documents/${documentId}/upload-url` | [features/onboarding/documents.ts](../features/onboarding/documents.ts) | 366 | Request contract retained; shared API error transport updated |
| POST | `/documents/${documentId}/upload-complete` | [features/onboarding/documents.ts](../features/onboarding/documents.ts) | 390 | Request contract retained; shared API error transport updated |
| POST | `"/payments/payout-account/session"` | [features/payments/actions.ts](../features/payments/actions.ts) | 19 | Request contract retained; shared API error transport updated |
| POST | `/invoices/${invoiceId}/payment-session` | [features/payments/actions.ts](../features/payments/actions.ts) | 36 | Request contract retained; shared API error transport updated |
| POST | `/invoices/${invoiceId}/sync` | [features/payments/actions.ts](../features/payments/actions.ts) | 60 | Request contract retained; shared API error transport updated |
| POST | `"/payments/payout-account/instant-payout"` | [features/payments/actions.ts](../features/payments/actions.ts) | 76 | Request contract retained; shared API error transport updated |
| POST | `"/invoices"` | [features/payments/actions.ts](../features/payments/actions.ts) | 100 | Request contract retained; shared API error transport updated |
| POST | `/invoices/${id}/refund` | [features/payments/actions.ts](../features/payments/actions.ts) | 133 | Request contract retained; shared API error transport updated |
| POST | `/invoices/${invoiceId}/${command}` | [features/payments/actions.ts](../features/payments/actions.ts) | 149 | Request contract retained; shared API error transport updated |
| GET | `/payments/payout-accounts/instructor/${encodeURIComponent(instructorId)}` | [features/payments/admin-payout-queries.ts](../features/payments/admin-payout-queries.ts) | 19 | Request contract retained; shared API error transport updated |
| GET | `"/payments/payout-account"` | [features/payments/queries.ts](../features/payments/queries.ts) | 38 | Request contract retained; shared API error transport updated |
| GET | `"/payments/payout-account/balance"` | [features/payments/queries.ts](../features/payments/queries.ts) | 45 | Request contract retained; shared API error transport updated |
| GET | `"/invoices/me"` | [features/payments/queries.ts](../features/payments/queries.ts) | 53 | Request contract retained; shared API error transport updated |
| GET | `"/invoices"` | [features/payments/queries.ts](../features/payments/queries.ts) | 66 | Request contract retained; shared API error transport updated |
| GET | `/invoices/${encodeURIComponent(id)}` | [features/payments/queries.ts](../features/payments/queries.ts) | 76 | Request contract retained; shared API error transport updated |
| GET | `/instructors/profile/${encodeURIComponent(id)}` | [features/public-profiles/queries.ts](../features/public-profiles/queries.ts) | 10 | Request contract retained; shared API error transport updated |
| GET | `/institutions/profile/${encodeURIComponent(id)}` | [features/public-profiles/queries.ts](../features/public-profiles/queries.ts) | 16 | Request contract retained; shared API error transport updated |
| GET | `/reviews/instructor/${encodeURIComponent(instructorId)}` | [features/reviews/queries.ts](../features/reviews/queries.ts) | 22 | Request contract retained; shared API error transport updated |
| GET | `/reviews/institution/${encodeURIComponent(institutionId)}` | [features/reviews/queries.ts](../features/reviews/queries.ts) | 33 | Request contract retained; shared API error transport updated |
| POST | `"/users/me/profile-image/upload-url"` | [features/settings/actions.ts](../features/settings/actions.ts) | 243 | Request contract retained; shared API error transport updated |
| POST | `"/users/me/profile-image/upload-complete"` | [features/settings/actions.ts](../features/settings/actions.ts) | 265 | Request contract retained; shared API error transport updated |
| PATCH | `"/users/me"` | [features/settings/actions.ts](../features/settings/actions.ts) | 327 | Existing self-update contract retained |
| PATCH | `/instructors/${profileId}` | [features/settings/actions.ts](../features/settings/actions.ts) | 334 | Request contract retained; shared API error transport updated |
| PATCH | `/institutions/${profileId}` | [features/settings/actions.ts](../features/settings/actions.ts) | 341 | Request contract retained; shared API error transport updated |
| GET | `path` | [features/settings/queries.ts](../features/settings/queries.ts) | 205 | Request contract retained; shared API error transport updated |
| GET | `"/users/me"` | [features/settings/queries.ts](../features/settings/queries.ts) | 252 | Current-user privacy endpoint |
| PATCH | `"/teachers/me"` | [features/teachers/actions.ts](../features/teachers/actions.ts) | 26 | Request contract retained; shared API error transport updated |
| GET | `"/teachers"` | [features/teachers/queries.ts](../features/teachers/queries.ts) | 22 | Request contract retained; shared API error transport updated |
| GET | `"/instructors/directory"` | [features/teachers/queries.ts](../features/teachers/queries.ts) | 45 | Request contract retained; shared API error transport updated |
| GET | `/teachers/${id}` | [features/teachers/queries.ts](../features/teachers/queries.ts) | 72 | Request contract retained; shared API error transport updated |

### Auth endpoint constants used by the inventory

| Constant | Backend path |
| --- | --- |
| `backendAuthEndpoints.forgotPassword` | `/auth/password/forgot` |
| `backendAuthEndpoints.login` | `/auth/login` |
| `backendAuthEndpoints.oauthGoogle` | `/auth/oauth/google` |
| `backendAuthEndpoints.refresh` | `/auth/refresh` |
| `backendAuthEndpoints.register` | `/auth/register` |
| `backendAuthEndpoints.resetPassword` | `/auth/password/reset` |
| `backendAuthEndpoints.resendEmailVerification` | `/auth/email/otp/resend` |
| `backendAuthEndpoints.verifyTwoFactor` | `/auth/2fa/verify` |
| `backendAuthEndpoints.verifyEmail` | `/auth/email/otp/verify` |
