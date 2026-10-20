# SupplyEd jobs, applications, invitations, and dashboards

This is the implementation map for the SupplyEd web app after applying the listing-date, application, matching, and invitation handoff. It covers both school and teacher experiences. The backend repository was used only to verify contracts and was not modified.

## 1. Domain rules

### Job lifecycle

Backend job statuses supported by the web are:

```text
DRAFT | ACTIVE | SUSPENDED | CLOSED | EXPIRED
```

The label shown to users is derived in this order:

1. `SUSPENDED` -> Suspended
2. `CLOSED` -> Closed
3. `DRAFT` or missing status -> Draft
4. backend `EXPIRED`, or an elapsed `expiresAt` -> Expired
5. future `liveFrom` -> Scheduled
6. otherwise -> Live

The derivation lives in `features/jobs/listing-window.ts`. It prevents a future scheduled job from being labelled Live and prevents an elapsed active record from being presented as open.

### Listing dates versus work dates

The two date groups have different meanings:

| Fields | Meaning | Web input | API value |
| --- | --- | --- | --- |
| `liveFrom`, `expiresAt` | marketplace visibility window | calendar date | unchanged `YYYY-MM-DD` |
| `startDate`, `endDate` | actual teaching work | date and time | ISO timestamp with timezone |

Listing dates use `Europe/London` calendar rules. Expiry includes the whole selected UK date. Work dates are converted from a UK wall-clock value to a precise instant; nonexistent daylight-saving times are rejected.

The job form keeps these concepts separate and explains them in `components/organisms/PostJobPage.tsx`. Shared conversion and display helpers live in `features/jobs/listing-window.ts`, `lib/zoned-date-time.ts`, and `features/jobs/validation.ts`.

When editing, unchanged listing fields are omitted. Clearing `liveFrom` sends `null`. Existing expiry is preserved if the user does not replace it because clearing an existing backend expiry is unsupported.

### Application lifecycle

Applications use five statuses:

```text
APPLIED | VIEWED | SHORTLISTED | HIRED | REJECTED
```

| From | Allowed destinations |
| --- | --- |
| Applied | Viewed, Shortlisted, Hired, Rejected |
| Viewed | Shortlisted, Hired, Rejected |
| Shortlisted | Hired, Rejected |
| Hired | none |
| Rejected | none |

The web makes one status request for the chosen destination. It never sends artificial intermediate stages. Opening an application does not automatically mark it Viewed. Unknown values such as the retired `INTERVIEW` status fail normalization so contract drift remains visible.

The teacher's proposal is optional. Blank content is omitted and nonblank content has a 2,000-character limit.

Every application retains the backend `jobName` snapshot. Teacher history uses that title when the current listing cannot be fetched or has since been renamed.

### Hiring and invitations

There are two distinct booking routes:

- Hiring an application creates the booking immediately and closes the filled job through the backend hire transaction.
- Sending a direct invitation does not create a booking. The booking is created only when the teacher accepts.

An invitation can reference an eligible existing job or contain `newJob`. A new invitation job may contain listing `liveFrom` and listing `expiresAt`. The top-level invitation `expiresAt` is the response deadline and must not be confused with `newJob.expiresAt`.

Fresh invitation submissions require a UUID idempotency key, one job source, an eligible teacher profile, precise zoned work dates, positive pay, and a future response deadline. The UI keeps the same retry identity after an uncertain result.

## 2. School implementation

### School dashboard

`components/organisms/dashboards/SchoolDashboard.tsx` is a real-data workspace. It loads:

- owned jobs via `useMyJobs`
- applicant total across active jobs via `useActiveJobApplicantCount`
- pending invitations via `useInvitations`
- confirmed bookings via `useBookings`

It provides job status filters, paging, edit, close, delete, application review, confirmed placement links, pending invitation links, and quick actions. Loading, error, empty, and manual refresh states are present. No sample teacher, fake activity, or fake subscription data is used.

### Job creation and editing

The form is implemented in `components/organisms/PostJobPage.tsx`.

Create behavior:

1. Validate locally.
2. Create the saved job.
3. If Publish was chosen, update the new record to `ACTIVE`.
4. If publication is uncertain after creation, retain the saved job ID and retry that same job.

Edit behavior:

1. Load the owned job, including drafts and nonpublic states.
2. Show listing calendar dates and UK work times.
3. Send only changed fields.
4. Publish by sending `status: ACTIVE` after validating the merged saved record.

Server actions are in `features/jobs/actions.ts`. Payload normalization is in `features/jobs/schemas.ts`. The job API proxies are under `app/api/jobs`.

Public job search does not accept a `status` query parameter. Owned jobs accept the full status set, including `SUSPENDED`. Unknown query parameters are rejected rather than silently ignored.

### Application management

The school workspace is `components/organisms/ApplicationsWorkspacePage.tsx`. It supports:

- paginated active job selection
- an Invited filter built from every page of the existing invitation API
- per-job Invited tags with total and currently pending invitation counts
- direct links to applications on nonactive owned jobs
- ranked applicants
- application details and saved proposal
- explicit status buttons and drag/drop transitions
- confirmation before hire
- backend status history
- loading, stale-state, empty, and error handling

The shared transition source is `features/applications/workflow.ts`. Server writes are in `features/applications/actions.ts`. Data hooks are in `features/applications/use-applications.ts`.

On `HIRED`, job, application, booking, invitation, matching, and payment views are refreshed. On validation or conflict responses, the web refetches authoritative state.

### Teacher search and invitation creation

Schools discover teachers through `components/organisms/FindTeachersPage.tsx` and public teacher profiles. `components/organisms/InvitationModal.tsx` supports:

- selecting an eligible existing job
- creating private job terms for the invitation
- separate listing visibility dates
- separate work timestamps
- a distinct invitation response deadline
- pay and optional message
- review before send
- retry-safe idempotency
- automatic creation or reuse of the job-scoped school-teacher conversation
- an automatic school message that identifies the invitation and lets both parties continue chatting

Invitation validation and actions live in `features/invitations/validation.ts`, `features/invitations/actions.ts`, and `features/invitations/types.ts`.

Schools can cancel pending invitations from `components/organisms/JobInvitationsPage.tsx`.

After the invitation is confirmed, the school is taken directly to the conversation. A retry checks recent messages for the invitation-specific message before sending, preventing the normal uncertain-response retry from posting it twice.

## 3. Teacher implementation

### Teacher dashboard

`components/organisms/TeacherDashboard.tsx` is the canonical dashboard. `components/organisms/dashboards/TeacherDashboard.tsx` re-exports it so both route paths render the same data and interactions.

The dashboard loads real data through `features/dashboard/use-teacher-dashboard.ts` and `useRecommendedJobs`. It presents:

- upcoming confirmed/ongoing bookings
- the next placement and agreed rate
- schedule filters for upcoming, week, and month
- application totals across the five supported stages
- pending direct invitations and their deadlines
- recommended roles with matching information
- profile completion and approval details
- optional phone-verification guidance
- Stripe payout readiness and actual available/pending balances
- recent conversations and notifications

Every section has loading, failure, empty, and retry behavior. Dashboard numbers are not hard-coded.

### Applying for a job

`components/organisms/JobDetailPage.tsx` checks listing availability and submits through `createApplicationAction`. The payload contains the job ID and includes `coverLetter` only when the teacher entered a proposal. A missing or unavailable public listing shows “This job is not currently available.”

After a successful application, application and matching queries are refreshed.

### Application history

Teacher application history is shown by `components/organisms/TeacherApplicationsPage.tsx` and related application components. It uses the saved `jobName` from the application response, so the name remains available after expiry, closure, deletion from public search, or later job-title edits.

The same page includes an Invited filter for direct school invitations. Invitation cards show the job, school, location, work dates, pay, message, and current invitation status, with actions to review the invitation or open messages. Application cards also show an Invited tag when their job has invitation history.

### Receiving and deciding invitations

`components/organisms/JobInvitationsPage.tsx` and the invitation detail UI allow teachers to review immutable terms and accept or decline. The effective expiry is enforced immediately in the browser while server state is refreshed.

Acceptance posts to `/job-invitations/:id/accept`. It expects the resulting booking and opens the booking context. Decline posts to `/job-invitations/:id/decline`. Neither action sends a request body.

Hooks in `features/invitations/use-invitations.ts` refresh pending invitation lists every 30 seconds and an open pending invitation every 15 seconds. A local deadline timer invalidates the query when the offer expires.

## 4. Web API proxy map

| Web route | Purpose |
| --- | --- |
| `GET /api/jobs` | public active marketplace jobs; no status filter |
| `GET /api/jobs/:id` | job detail, with owned-view support where applicable |
| `GET /api/jobs/mine` | school-owned jobs and status filtering |
| `GET /api/applications/me` | teacher application history |
| `GET /api/applications/job/:jobId` | school applications for a job |
| `GET /api/applications/:id` | application detail |
| `GET /api/applications/:id/history` | status audit history |
| `GET /api/applications/active-jobs/count` | school dashboard applicant total |
| `GET /api/job-invitations/me` | role-aware invitation list |
| `GET /api/job-invitations/:id` | invitation detail |

Mutations use server actions so credentials stay server-side:

- job create/update/delete: `features/jobs/actions.ts`
- application create/status update: `features/applications/actions.ts`
- invitation create/accept/decline/cancel: `features/invitations/actions.ts`

## 5. Cache and refresh rules

- Creating an application refreshes application and matching queries.
- Updating an application refreshes applications and matching.
- Hiring also refreshes bookings, invitations, jobs, and payments.
- Job writes revalidate public jobs, owned jobs, and the affected detail tag.
- Invitation lists refetch on mount and window focus while pending.
- The dashboards expose a manual Refresh action covering all displayed data.

These rules matter because a hire affects several resources atomically: application state, a new booking, the filled job, and potentially invitation eligibility.

## 6. Important backend behavior verified read-only

The backend directory inspected was:

```text
C:\Users\Usman Cheema\Desktop\Waleed\SupplyEd\supplyed-backend
```

Verified contract details include application enum migration removing Interview, direct hire/reject transitions, application title snapshots, listing `liveFrom`, atomic application hire behavior, and invitation acceptance as the booking point.

No backend source or migration was changed.

## 7. Regression coverage

Relevant automated tests include:

- `tests/application-workflow.test.cjs`
- `tests/application-job-title.test.cjs`
- `tests/applications-navigation.test.cjs`
- `tests/job-invitations.test.cjs`
- `tests/job-listing-window.test.cjs`
- `tests/job-pagination.test.cjs`
- `tests/workspace-form-validation.test.cjs`
- `tests/teacher-dashboard-data.test.cjs`
- `tests/teacher-dashboard-ui.test.cjs`
- `tests/teacher-hire-actions.test.cjs`
- `tests/production-safety.test.cjs`
- `tests/uk-server-validation.test.cjs`

Coverage includes direct transitions, optional proposals, saved titles, pagination, idempotent invitations, invitation decisions, UK time conversion, DST boundaries, job visibility derivation, payload validation, concurrent document upload behavior, and real dashboard states.

## 8. Manual acceptance checklist

### School

- Create a draft with no listing dates.
- Publish a job that is live immediately.
- Schedule a job with a future UK `liveFrom` date.
- Set an expiry on the same calendar day and confirm the full day remains valid.
- Edit the job without changing listing dates and confirm exact values remain intact.
- Review an Applied application without its status changing automatically.
- Move Applied directly to Hired and confirm exactly one booking appears and the job closes.
- Move an active application directly to Rejected and confirm no booking appears.
- Open status history and confirm actor, old status, new status, and timestamp.
- Invite a teacher to an existing job.
- Invite a teacher with new private job terms and separate response/listing deadlines.
- Cancel a pending invitation.

### Teacher

- Open a live job and apply with no proposal.
- Apply with a proposal and confirm the 2,000-character boundary.
- Confirm application history keeps the submitted job name when the listing is unavailable.
- Review and decline an invitation.
- Review and accept an invitation, then confirm navigation to the resulting booking.
- Confirm an elapsed invitation becomes unavailable without requiring a page reload.
- Verify dashboard counts, schedule, recommendations, profile progress, payouts, messages, and notifications against the associated pages.

### Cross-cutting

- Confirm no screen or filter displays Interview.
- Confirm Suspended, Closed, Draft, Expired, Scheduled, and Live labels are derived correctly.
- Confirm phone verification remains available but is not required to submit complete onboarding documents for review.
- Confirm all four required document boxes can upload independently and that review enables only after all uploads finish successfully.
