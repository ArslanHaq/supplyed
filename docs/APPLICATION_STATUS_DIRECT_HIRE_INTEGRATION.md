# Application status and direct-hire integration

This document records the application workflow currently implemented by the SupplyEd web app and the backend contract verified on 16 October 2026. The backend repository was inspected read-only.

## Canonical statuses

```text
APPLIED -> VIEWED -> SHORTLISTED -> HIRED
   |         |             |
   +---------+-------------+-> REJECTED
```

The public status set is exactly:

```text
APPLIED | VIEWED | SHORTLISTED | HIRED | REJECTED
```

`INTERVIEW` has been removed. The frontend rejects unknown or retired status values instead of silently converting them.

| Current | Allowed next values |
| --- | --- |
| `APPLIED` | `VIEWED`, `SHORTLISTED`, `HIRED`, `REJECTED` |
| `VIEWED` | `SHORTLISTED`, `HIRED`, `REJECTED` |
| `SHORTLISTED` | `HIRED`, `REJECTED` |
| `HIRED` | none |
| `REJECTED` | none |

A direct hire or rejection uses one request:

```http
PATCH /applications/:id/status
Content-Type: application/json

{ "status": "HIRED" }
```

The web does not manufacture intermediate transitions. Reading an application also does not automatically change `APPLIED` to `VIEWED`.

## Backend readiness

The read-only backend audit confirmed these changes are already present:

- Prisma migration `20261016010000_remove_application_interview`
- five-value application enum
- direct active-stage transitions to `HIRED` and `REJECTED`
- atomic booking creation and job closure on hire
- application history and the saved `jobName` snapshot

The saved title is displayed in teacher history even if the job is renamed, expired, closed, or unavailable.

## Frontend implementation

- Types: `features/applications/types.ts`
- Response and history normalization: `features/applications/schemas.ts`
- Transition policy: `features/applications/workflow.ts`
- Apply and status actions: `features/applications/actions.ts`
- Query hooks and invalidation: `features/applications/use-applications.ts`
- School application workspace: `components/organisms/ApplicationsWorkspacePage.tsx`
- Teacher application list: `components/organisms/TeacherApplicationsPage.tsx`
- History proxy: `app/api/applications/[id]/history/route.ts`

On a successful hire, the app refreshes applications, bookings, invitations, jobs, matching data, and payment-related data. On a `400` or `409`, it refetches server state so stale buttons and counts are corrected.

## Acceptance checks

- No production page shows Interview.
- Direct hire and rejection are available from every active stage.
- Hired and Rejected are terminal.
- The optional proposal is omitted from the payload when blank and is limited to 2,000 characters when provided.
- Status history is visible to the school.
- A successful normal hire creates a booking immediately.
- Application history uses the saved job title.
