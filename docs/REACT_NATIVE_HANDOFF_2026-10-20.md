# SupplyEd React Native implementation handoff

Date: 20 October 2026

## Instructions for Codex

Implement the behavior below in the existing SupplyEd React Native app. This document consolidates today's web changes, supplied backend API changes, and the user's final decisions. Inspect the mobile repository instructions and architecture first, then complete the implementation using its existing navigation, API client, authentication, components, theme, and state management.

This is an implementation specification, not evidence that the mobile app or a remote backend has already been updated. Preserve unrelated app behavior. Report any missing backend capability clearly; do not invent endpoints or claim that frontend checks enforce server invariants.

For broader pre-existing mobile integration context, see `SUPPLYED_MOBILE_INTEGRATION_HANDOFF.md` alongside this file. This document takes precedence for the subjects below, especially optional phone verification, locked verified numbers, planned units, date rules, error messages, and form order.

### Final decisions

- Unverified phone numbers can be edited and saved without SMS verification. Verified numbers cannot be changed through self-service settings.
- Hourly and daily jobs have optional total planned hours/days. User changes to dates and totals synchronize in both directions.
- Equal work start and end values are valid. Do not require a multi-day job.
- Listing dates describe when teachers can apply; work dates describe when they work.
- Discovery shows a teacher's current/upcoming confirmed booking dates only, without another school's booking details.
- User-facing errors must be readable and actionable, without diagnostic reference IDs or technical-details panels.
- Keep the existing UI style. Move fields as specified below instead of redesigning the flow.
- Do not add test files for this port. Use existing lint/type/build checks and manual acceptance checks.

## 1. Job creation and editing: final field order

Apply the same behavior to job creation, job editing, and new jobs created inside an invitation. Use shared scheduling/validation logic so the flows cannot diverge.

In the job wizard's **Details** step, order the relevant fields as follows:

1. Role location.
2. Pay basis: hourly, daily, or fixed, with the pay amount.
3. Work start and work end dates; hourly jobs also clearly expose start/end working times.
4. Total planned hours for hourly jobs, or total planned days for daily jobs.
5. Live from and Listing expiry.
6. Other existing details.

Fixed-price jobs show no planned-unit field and no empty placeholder row. Listing dates no longer belong in the later Requirements step. Keep key stages, parking/arrival notes, and existing requirements there.

Move step validation and error-to-step navigation with the listing fields: invalid `liveFrom` or `expiresAt` must return the user to Details. Validate before Continue and again before submission. Preserve review summaries and edits when moving between steps.

Use the same logical order in the invitation's new-job form, adapted to its existing layout. The invitation response deadline remains a separate invitation field.

## 2. Rich text editor must not steal focus

Apply this to job descriptions during creation, editing, and invitation creation, and any shared proposal editor.

- Tapping another input must transfer focus immediately. The keyboard must stay associated with that input.
- Mounting, loading saved HTML, receiving props, validation, and unrelated rerenders must not focus the editor.
- Do not restore the editor selection after the user has left it.
- Keep content synchronization separate from user typing; avoid value/change feedback loops.
- Preserve formatting and content when navigating steps, opening pickers, scrolling, or changing other fields.
- Explicit editor taps and toolbar interactions may focus the editor intentionally.
- Keep editor instances/keys stable and remove listeners on unmount.

Web reference: Quill's `getFormat()` without an explicit range can request a focused selection. The web change ignores a null selection and calls `getFormat(range)`. Programmatic HTML loads use clipboard conversion plus silent `setContents`; selection restoration is conditional on `hasFocus()`.

Port the behavior to the mobile editor/WebView library. Do not copy Quill DOM code blindly. Configure native scroll/keyboard handling so taps reach other controls; blanket touch interception or disabling the keyboard is not a fix.

## 3. Planned hours/days API contract

```ts
type PlannedWorkUnits = {
  hours?: number | null;
  days?: number | null;
};
```

| Field | Applicable pay type | Accepted non-null value |
| --- | --- | --- |
| `hours` | `hourly` | Positive whole JSON number, 1 through 2147483647 |
| `days` | `daily` | Positive whole JSON number, 1 through 2147483647 |

Both fields are optional, including on jobs of their applicable pay type. They represent the total planned units for the whole job. Missing response values normalize to `null`; do not invent durations for old records.

Reject zero, negative numbers, fractions, numeric strings in API payloads, non-finite numbers, and values over the maximum. Form input can be a string while editing, but serialize an explicitly validated number or `null`.

- Non-null `hours` is invalid unless pay type is hourly.
- Non-null `days` is invalid unless pay type is daily.
- Fixed-price jobs accept omitted/null units only.
- In a PATCH, omission preserves the saved value while its pay type applies; `null` explicitly clears it.
- Hourly to daily clears saved hours; daily to hourly clears saved days; fixed clears both.
- Never send an incompatible non-null value when switching pay type.
- If PATCH omits pay type, validate against the saved pay type.

### Bidirectional synchronization on user edits

The backend does not calculate units from dates. The mobile form must implement the user's requested synchronization:

| User action | Form behavior |
| --- | --- |
| Enter/change complete hourly start and end | Calculate daily clock-time hours multiplied by inclusive calendar days; exclude time between shifts |
| Enter/change daily start and end | Calculate inclusive calendar days: end day minus start day plus one |
| Manually enter valid total hours | Keep the selected dates; divide total by inclusive days and adjust the daily end time |
| Manually enter valid total days | Set end calendar day to start day plus `days - 1` |
| Enter units before a start, with no end | Once start is complete, derive the end from those units |
| Clear units | Keep dates and submit `null` when clearing a saved value |
| Change dates after clearing units | Recalculate the applicable total |
| Change pay type | Clear inactive units; calculate applicable units from complete valid dates |
| Select fixed | Hide/clear both units, retain work dates |
| Load an existing job | Preserve saved units/nulls; do not recalculate simply because data loaded |

For daily edits, retain the end time where valid. For one-day work, if the retained end time precedes start, use a valid end time at or after start. Daily totals count calendar days, including both endpoints; do not divide elapsed hours by 24 or assume weekdays only.

Hourly times describe the same daily working window on every selected calendar day. Calculate `(daily end clock minutes - daily start clock minutes) / 60 * inclusive calendar days`. Do not count overnight gaps or use the elapsed duration between the first start and final end. Calculate calendar days independently of UTC offset changes; keep timezone-aware validation/serialization of the endpoint timestamps. This planned daily clock-time calculation is separate from billing actual elapsed work.

Reject a daily end time before the daily start time; do not silently infer overnight shifts. Do not silently round a fractional calculated total to an integer. Show that value with an inline whole-number validation error so the user can correct times or enter a valid total.

When editing total hours, spread them evenly over the selected days, preserving the dates and daily start time. The resulting daily end must fit before midnight and be expressible in whole minutes. Otherwise show an inline error and retain the entered total for correction, without silently changing the date range or rounding. If no end date exists yet, use the start date. Endpoint times must still pass timezone/DST validation.

Equal work instants remain valid. Hourly units then stay blank/null rather than zero; a daily job on one calendar day has one planned day. Do not calculate from incomplete/invalid dates. Prevent effect loops, stale totals, overflow, and ambiguous/nonexistent local-time conversions. Surface a friendly validation message when a manual total cannot produce a valid representable end.

Examples:

- Hourly 08:00 to 12:00 on the same day gives 4 hours. Changing total to 3 changes daily end to 11:00.
- Hourly 21 October through 22 October, daily 02:00 to 05:00, gives **3 hours per day × 2 days = 6 total hours**, not 27 elapsed hours. Changing total to 8 keeps both dates and changes daily end to 06:00.
- Daily 2 November through 4 November gives 3 days. Changing total to 1 moves end to 2 November.
- Loading an old hourly job whose saved hours are null leaves the optional field blank until a relevant user edit.

## 4. Work dates and listing dates

| Relationship | Required rule |
| --- | --- |
| Work start/end | `startDate <= endDate` |
| Listing opening/work start | `liveFrom < startDate`, when both exist |
| Listing opening/closing | Closing instant must be after opening |
| Listing closing/work start | Exclusive listing expiry must be at or before work start |

Same-day hourly and daily jobs are valid. Work cannot end before it starts.

### UK listing-day semantics

Date-only listing inputs use **Europe/London**, irrespective of the phone's timezone:

- `liveFrom: "YYYY-MM-DD"` opens at the start of that UK day.
- `expiresAt: "YYYY-MM-DD"` includes the whole selected day and becomes an exclusive cutoff at the start of the following UK day.
- The same date-only live-from/expiry values are valid: one full listing day.
- Explicit timestamps retain their actual instant.
- Equal explicit opening and closing timestamps are invalid because the window is empty.
- Exclusive expiry equal to work start is valid.
- A date-only expiry whose selected day includes the work start is invalid.

Example: opening and closing on `2030-11-01` become opening at `2030-11-01T00:00:00Z` and exclusive closing at `2030-11-02T00:00:00Z`. Work can begin on 2 November. Do not hardcode a UTC offset for summer dates.

Validate real calendar dates, not merely parseability: JavaScript rollover of an invalid day is not acceptance. Use explicit timezone-aware conversion for local work inputs. Preserve existing explicit timestamps when an edit leaves the field unchanged; do not silently change their meaning to full-day listing dates.

Optional dates remain optional. Compare only present counterparts. For partial updates, fetch/merge the saved job and compare the effective complete date set; changing only one field must not bypass validation. Preserve the form's existing checks against past work starts/listing expiry.

Clearing a previously saved `liveFrom` requires `null`, not an omitted PATCH field. The current web flow does not support clearing a saved listing expiry; require a replacement date unless the backend explicitly supports clearing it.

Distinguish `newJob.expiresAt` (listing close) from invitation-level `expiresAt` (response deadline). Map listing errors to their own field, e.g. local `listingExpiresAt`, so a listing error does not highlight the response deadline.

## 5. Requests and response propagation

Paths below omit the backend `/api` prefix. Use the mobile app's authenticated backend client; do not call Next.js Server Actions or assume browser proxy routes are backend endpoints. Unwrap the established backend response envelope once and preserve existing pagination.

Hourly creation:

```http
POST /jobs
```

```json
{
  "title": "Maths cover",
  "description": "Four hours of mathematics cover.",
  "payType": "hourly",
  "payAmount": 30,
  "hours": 4,
  "liveFrom": "2030-11-01",
  "expiresAt": "2030-11-01",
  "startDate": "2030-11-02T08:00:00Z",
  "endDate": "2030-11-02T12:00:00Z"
}
```

Daily creation uses `payType: "daily"`, `days: 1`, and may use the same start/end date. Omission of applicable units is also valid.

PATCH examples for `/jobs/:id`: `{"hours":3}`, `{"hours":null}`, or `{"payType":"daily","payAmount":180,"days":2}`.

Invitations:

```json
{
  "requestId": "<new-request-uuid>",
  "instructorId": "<instructor-profile-uuid>",
  "newJob": {
    "title": "Maths cover",
    "description": "Four hours of cover.",
    "payType": "hourly",
    "payAmount": 30,
    "hours": 4,
    "liveFrom": "2030-11-01",
    "expiresAt": "2030-11-01",
    "startDate": "2030-11-02T08:00:00Z",
    "endDate": "2030-11-02T12:00:00Z"
  }
}
```

Send to `POST /job-invitations`; `/bookings/direct-hire` is a compatibility alias. For an existing job, send `jobId` instead of `newJob`, never both. Use real profile UUIDs and dates satisfying the invitation deadline rules; the example is structural, not a request to submit live data.

Update types, schemas, adapters, cached entities, and relevant display summaries across:

| API family | Units location |
| --- | --- |
| Job create/update/delete responses; job lists and details | Returned job `hours`, `days` |
| `/jobs`, `/jobs/mine`, `/jobs/admin/all`, `/jobs/institution/:institutionId` | Each job |
| `/jobs/:id`, `/jobs/mine/:id` | Job |
| `/matching/jobs/recommended` | `job.hours`, `job.days` |
| Invitation create/list/detail/decline/cancel | Offered snapshot `job.hours`, `job.days` |
| Invitation acceptance | Returned booking's top-level `hours`, `days` |
| Booking detail/lists/status changes | Booking's top-level `hours`, `days` |
| Instructor public profile/directory | `bookings[].hours`, `bookings[].days` |
| Conversations carrying job context | `job.hours`, `job.days` |
| `/conversations/job/:jobId` | Top-level job and conversation job contexts |
| Invoices carrying booking context | `booking.hours`, `booking.days` |
| `/invoices/job/:jobId` | Top-level job and invoice booking contexts |

Keep null handling compatible with older records.

### Snapshots and billing

Hiring through an application or invitation copies planned units onto the booking. Booked units remain the agreed snapshot after later job edits. Do not replace them with the live job's values.

Invitations preserve offered units. Editing those units after sending makes consent stale; acceptance requires a new invitation. Handle that conflict explicitly.

Invoices still use explicitly submitted **actual `unitsWorked`**. Planned totals do not automatically bill a school, become actual units, or introduce a billing cap. Do not reuse planned whole-number validation for actual units without checking their separate API contract.

## 6. Invitation acceptance, competing invitations, and conflicts

When five teachers receive invitations for one job and one accepts, the backend hiring transaction accepts the winning invitation, creates the booking, closes the job, and cancels the other pending invitations for that job.

Display competing invitations as **cancelled** when that is the returned status. Their own response deadlines produce expiration; do not label every competing cancellation as expired.

Database changes are atomic, but different devices do not necessarily render the new state at the same instant. Refresh/invalidate jobs, invitations, bookings, and affected teacher schedules after mutations. Use available realtime events plus foreground refresh/polling; web references use 15-second detail and 30-second pending-list refreshes. Stop polling in the background and refresh on app resume/screen focus.

- Invitation creation does not itself book a teacher.
- `GET /job-invitations/me` and `GET /job-invitations/:id` provide lists/detail.
- `POST /job-invitations/:id/accept` returns a booking.
- Accept/decline are teacher actions; cancel is a school action. Preserve backend authorization.
- Reading/opening an invitation must not implicitly accept it.
- Preserve existing conversation association and avoid duplicate chat messages during retries.

Confirmed booking overlap is checked on invitation creation and acceptance:

```text
existingStart <= proposedEnd && existingEnd >= proposedStart
```

The supplied checks include equal endpoints. Two nonoverlapping times on one day can be valid; intervals that meet at exactly the same endpoint conflict under this rule. The backend remains authoritative because schedules can change after loading.

For the known overlap conflict, show: **"This teacher is already booked during these dates. Choose different dates or another teacher."** Refresh the affected teacher schedules. Do not treat every HTTP 409 as overlap; stale consent and other conflicts need their own messages.

Keep the invitation input `requestId` UUID: it is an idempotency key, not a diagnostic reference. When a network failure leaves the outcome uncertain, retry the same UUID with the same payload rather than creating another invitation. Use a new attempt only after a definitive rejection and corrected input. Preserve the app's existing deadline and retry rules.

## 7. Show booking addresses after creation

On the user's booking cards/detail, show the job location using trimmed nonempty values from:

```text
booking.job.address
booking.job.city
booking.job.county
booking.job.postalCode
```

Use readable separators and wrapping without horizontal overflow. If no address exists, show "Address not provided". Retain the address after reloading booking lists/details. This is separate from privacy-limited teacher discovery below.

## 8. Teacher booking dates on profile and Find teachers

Use existing APIs:

- `GET /instructors/profile/:id`
- `GET /instructors/directory`

Each instructor includes `bookings`. Supplied backend behavior returns confirmed bookings with a non-null start and end at/after the beginning of the current UTC day, sorted by start then ID. Entries include `id`, `startDate`, `endDate`, optional `hours`/`days`, and a nested job context.

On school-facing teacher profiles and discovery cards, show **current/upcoming booking dates and times only**. Do not expose the other school's name, job title, address, contacts, map, identifiers, or navigable booking details. Normalize through an explicit whitelist instead of spreading the nested job object into discovery UI.

- Present dates in UK time with GMT/BST context; compact same-day intervals.
- Directory cards show a short preview (web: first two) with accessible expansion.
- Teacher profile can show all returned periods.
- `bookings: []` means no current/upcoming confirmed bookings returned.
- A missing or malformed schedule means "Booking dates are currently unavailable", not "Available".
- Do not replace the separate `availableToday` API flag based on the presence of a future booking.
- Preserve optional planned units in normalized data where needed, but do not expand this dates-only section into booking details.

Refresh every 30 seconds while the relevant screen is active, on screen focus, and on app resume. Invalidate after booking status changes, successful hiring, invitation acceptance, overlap conflicts, and relevant notifications. Use native lifecycle integration, not `window` events. Avoid background polling and duplicate intervals.

## 9. Friendly error handling throughout the app

Remove visible "Technical details", "Share this reference with support", UUID blocks, stack traces, server internals, and diagnostic suffixes from ordinary errors.

Centralize error normalization so invitations, bookings, settings, phone verification, payments, and query failures behave consistently:

- Preserve safe actionable field validation.
- Map known errors to plain-language explanations and a useful next action.
- Distinguish network failures, timeouts, authentication expiry, rate limits/cooldowns, conflicts, and unexpected server failures.
- Do not expose SQL/Prisma messages, configuration secrets, raw HTML, or arbitrary backend internals.
- Keep HTTP status, error code, diagnostic request ID, and sanitized context internally for debugging.
- Keep OTP retry/cooldown guidance functional.
- Treat malformed success responses as a friendly loading failure rather than crashing or inventing empty data.
- Preserve entered values and make retries possible; avoid duplicate submissions.

Use compact messages within the existing layout. Put field errors next to their inputs, provide an accessible summary where needed, and scroll/focus the first invalid field. Do not replace an entire usable screen with a large technical error panel for a recoverable form failure.

Do not remove the invitation idempotency UUID from requests just because diagnostic UUIDs no longer appear in UI.

## 10. Settings Save and optional phone verification

### Save behavior

Do not silently disable Save because a phone is changed, invalid, or unverified. Once the editable profile has loaded, users must be able to submit changes and receive visible validation feedback.

Disable submission only for real pending/loading/unavailable states; explain pending verification/save status where relevant and prevent duplicate requests. If using dirty-state tracking, every editable field must update it correctly.

Keep changes after errors. Show a summary and field messages, then scroll/focus the first invalid control. Notification preference toggles retain their independent automatic-save behavior.

### Final phone policy

| Saved server state | Settings behavior |
| --- | --- |
| Phone unverified | Editable; valid changed phone saves without mandatory SMS verification |
| Phone verified | Read-only/disabled; other profile fields can still be saved |

Normalize UK numbers to E.164 and compare normalized values, so equivalent national/international formatting is not a change. Send changed unverified `phone` through `PATCH /users/me`. Omit untouched phone values. Do not send client-controlled verification flags.

When an unverified phone changes, the backend must retain/reset `phoneVerified: false`. Verification remains optional via existing `/auth/phone/otp/send` and `/auth/phone/otp/verify`.

Suggested copy:

- Unverified: "Save your phone number with Save settings. Verification is optional; once verified, the number cannot be changed."
- Verified: "This number is verified and cannot be edited."

Refresh the current user before applying sensitive phone changes. If a fresh response says the saved number is verified, it must win over stale local edits. Do not submit a replacement/clear of a verified number. On success reset edited state and update relevant caches; after a locked-phone conflict refresh settings.

### Known backend gap: do not claim global enforcement yet

The web currently guards verified-number edits in Settings and its Next.js server action, including a friendly `PHONE_VERIFIED_LOCKED` result. That local code is not proof of a backend HTTP error contract.

The inspected backend's user update path still allows phone replacement and resets verification; its OTP flow also needs review for replacement of a previously verified number. A React Native client calls the backend directly and cannot rely on the web server action.

Implement the mobile UI guard now, and require a backend self-service guard before claiming verified numbers are immutable across clients. It must reject replacement/clearing of an already verified number and prevent bypass through OTP replacement, including stale/racing requests. Keep administrative recovery policy separate. If this task has no backend access, report this specific gap instead of fabricating server enforcement.

## 11. Deployment prerequisite for the new fields

The supplied API note names:

```text
prisma/migrations/20261020000000_job_work_units/migration.sql
```

It adds nullable integer hours/days to Job and Booking, with positive-value/pay-type constraints. Existing rows remain null. At the time of that note the migration had **not been applied to a database**.

Confirm the target backend has deployed the migration, regenerated its client, and built successfully before relying on the new contract. Backend operator commands from the note:

```powershell
npx.cmd prisma migrate deploy
npm.cmd run prisma:generate
npm.cmd run build
```

`migrate deploy` applies all pending migrations for the configured database. These are backend deployment instructions, not commands for the React Native repository or app startup. Do not claim deployment was verified from source inspection alone.

## 12. Test-file cleanup and verification preference

The user requested removal of project-owned test files without breaking runtime code. Today's web cleanup removed the frontend test suite/helpers, test scripts, and their CI steps while retaining lint/build.

Do not create replacement test files during this port. If applying the equivalent cleanup to the mobile project, first inspect imports and scripts: remove only test-only files/helpers and obsolete test jobs. Preserve runtime modules, dependencies' files, fixtures used at runtime, native build assets, lint, type checking, and production build jobs.

Use the manual checklist below and the mobile project's supported lint/type/build commands. Report checks actually run and any blockers. Do not claim a passing device/build check that was not performed.

## 13. Manual acceptance checklist

| Check | Expected result |
| --- | --- |
| Create/edit field order | Location, pay basis/amount, dates, applicable units, listing dates |
| Fixed pay | No hours/days input or empty row |
| Listing error from Continue/review | Details step opens and correct field is visible |
| Editor to title/address/pay/date input | Focus stays on the selected control; keyboard does not jump back |
| Load saved description and switch steps | Formatting/content preserved without unwanted focus |
| Hourly same-day 08:00–12:00 | Allowed; auto-fills 4 hours |
| Change hours to 3 | End becomes 11:00; payload contains numeric 3 |
| Hourly 21–22 October, daily 02:00–05:00 | Auto-fills 6; summary says 3 hours per day × 2 days |
| Change that two-day total to 8 | Dates remain unchanged; daily end becomes 06:00 |
| Total cannot divide into whole-minute daily shifts or fit before midnight | Inline error; no rounding or hidden date changes |
| Daily end time before daily start, even over multiple dates | Rejected; overnight gaps are not counted as work |
| Daily same day | Allowed; total is 1 |
| Daily range/manual total edits | Inclusive calendar days and end date stay synchronized |
| Equal hourly start/end | Valid dates; blank/null optional hours, never zero |
| Fractional duration/invalid units | Clear inline error; no silent rounding or invalid request |
| Load legacy null units | Remain blank without a user scheduling edit |
| Clear saved units/change pay type | Correct null/omission semantics; no incompatible value |
| UK DST/device timezone differs | Correct UK listing days and timezone-aware work calculations |
| Same date-only live/expiry | Full-day listing valid if it closes by work start |
| Explicit equal live/expiry | Rejected |
| Work start equals exclusive expiry | Allowed |
| End before start/listing after work start | Rejected on create, edit, and new invitation job |
| Update only one date | Compared against saved counterparts |
| Invite five teachers; one accepts | One booking; job closed; other pending invitations cancelled after refresh |
| Conflicting invitation | Friendly unavailable message; data refresh; form retained |
| Units changed after invitation | Stale consent handled; require new invitation |
| Own booking after creation/reload | Address shown and wraps; useful empty fallback |
| Discovery profile and cards | Booking dates only; no other school's details |
| Missing vs empty schedule | Unavailable message vs genuine empty result |
| App background/resume | Polling stops/resumes appropriately; fresh availability |
| Error responses | No technical panel, reference UUID, raw stack, SQL, or HTML |
| Uncertain invitation retry | Same request UUID/payload; no duplicate invitation/message |
| Save changed unverified phone | Saves without SMS requirement |
| Verified phone | Locked while other settings still save |
| Stale screen after verification | Cannot replace phone; fresh server state respected |
| Settings invalid field | Save surfaces visible errors instead of silent disabled state |
| Notifications | Toggles still save independently |
| Invoice entry | Actual work remains separate from planned totals |

## 14. Web implementation references

Paths are relative to `supplyed-web`; use them for behavior, not as native components to copy directly.

| Area | Reference |
| --- | --- |
| Form order, wizard validation, job editing | `components/organisms/PostJobPage.tsx` |
| New-job invitations | `components/organisms/InvitationModal.tsx` |
| Rich text focus | `components/molecules/ProposalEditor.tsx`, `RoleDescriptionEditor.tsx` |
| Work inputs | `components/molecules/HourlyWorkSchedule.tsx`, `PlannedWorkUnitsField.tsx` |
| Unit validation/sync | `features/jobs/work-units.ts`, `schedule-editor.ts` |
| Date rules/time conversion | `features/jobs/date-validation.ts`, `listing-window.ts`, `lib/zoned-date-time.ts` |
| Job API adapters | `features/jobs/actions.ts`, `schemas.ts`, `types.ts`, `validation.ts` |
| Invitation integration | `features/invitations/`, `components/organisms/InvitationErrorNotice.tsx` |
| Booking address | `components/organisms/BookingsPage.tsx` |
| Teacher booking-date presentation | `components/molecules/TeacherBookingDates.tsx` |
| Discovery/profile integration | `components/organisms/FindTeachersPage.tsx`, `PublicTeacherProfilePage.tsx` |
| Schedule normalization | `features/public-profiles/booking-dates.ts`, profile/teacher schemas and query hooks |
| Snapshot propagation | `features/bookings/`, `features/conversations/`, `features/payments/` schemas/types |
| Friendly errors | `lib/user-facing-error.ts`, `lib/query/fetch-json.ts`, `lib/server/api-error.ts`, `action-response.ts` |
| Settings and phone | `components/organisms/SettingsPage.tsx`, `features/settings/`, `features/auth/phone-actions.ts`, `components/molecules/PhoneVerification.tsx` |
| Test-script cleanup | `package.json`, `.github/workflows/dev-cicd.yml` |

Native implementation must replace web focus events, DOM inputs, browser storage, Next actions, and CSS with the app's existing native equivalents. Keep all pure business rules consistent across screens.

During the web layout update, development output also contained stale versions of the listing-window module, producing `shiftCalendarDay is not a function` despite a valid source export. This is a development-bundle issue to check with a fresh build/cache, not a reason to remove date validation or catch-and-ignore scheduling failures. Verify all shared helper imports in the native bundle as well.

## Completion report expected from the mobile Codex agent

Deliver the implemented changes, a concise list of affected screens, validation/build results, and any remaining backend dependency. Explicitly state the migration deployment status and verified-phone backend enforcement status if they could not be confirmed. Preserve all final decisions above.
