# SupplyEd React Native: complete implementation handoff

Consolidated: 20 October 2026  
Audience: Codex implementing the existing teacher and school React Native app.

## Read this first

Implement this guide in the existing mobile repository. It combines the earlier SupplyEd mobile integration guidance, the 20 October API contract, all fixes requested during this session, and the final messaging design. Use the existing app architecture and native components; inspect its repository instructions before editing.

This is the main implementation guide to give to the mobile coding agent. It describes what to build, why it matters, how the data flows, which API behavior already exists, what still needs backend enforcement, and how to verify the result. It does not claim the mobile app has already been changed.

The previous files remain available as historical references:

- `SUPPLYED_MOBILE_INTEGRATION_HANDOFF.md`: earlier endpoint/DTO/source snapshots and detailed web styling.
- `REACT_NATIVE_HANDOFF_2026-10-20.md`: the earlier daily-change handoff.

This new guide takes precedence where those files disagree. Its behavior and request rules are self-contained; optional source references help implementation but are not additional product requirements. Do not copy old DTO snapshots over the updated hours/days contracts.

### Final rules that supersede earlier versions

| Subject | Final behavior |
| --- | --- |
| Hourly duration | Daily working window multiplied by inclusive selected days. Two days of 02:00–05:00 means **6 hours**, not 27 elapsed hours. |
| Manual hourly total | Preserve selected dates and daily start; distribute hours across days and adjust daily end time. |
| Job Details order | Location → pay basis/amount → work dates → applicable hours/days → Live from/Listing expiry. |
| Fixed-price jobs | No hours/days input or empty row. |
| Equal work dates | Valid; work end must be on or after work start. |
| Listing dates | UK calendar semantics; listing opening precedes work, and exclusive closing is at or before work start. |
| Editor focus | Programmatic content updates must not steal focus from another input. |
| Inbox | One contact entry per school/person, identified by stable IDs rather than name. |
| Conversation topics | **General, Jobs, Applications, Invitations** tabs plus an individual-item selector. |
| Multiple items | Keep every item selectable; newest first. Opening a contact prioritizes its latest job/application/invitation context. |
| Selected topic/item | Messages and context change together; preserve drafts, attachments, and in-flight sends. |
| Invitation chats | Each offer has its own context, but existing API messages belong to the related job conversation. |
| Invitation link | Existing and new chat references render as **View invitation**, opening the exact review screen. |
| Monitoring copy | “Conversations may be monitored by the SupplyEd team for support and safety.” |
| Phone settings | Unverified phone editable/saveable without SMS; verified phone locked. Backend enforcement gap is documented below. |
| Application proposal | API field is `coverLetter`; serialized submitted string must be at most 2,000 characters. |
| User errors | Friendly field/action guidance; technical IDs and server details remain internal. |
| Verification work | Do not add test files. Run applicable existing checks and the manual acceptance scenarios. |

### How to use this document

1. Read Part A for the earlier platform behavior that must be retained.
2. Implement Part B's current jobs, bookings, settings, and messaging specification.
3. Follow Part C for native screen structure, selection state, drafts, and concrete walkthroughs.
4. Use the appendices for dropdown mapping and delivery checks.
5. Report backend dependencies separately from completed mobile work.

## Part A — Earlier platform behavior carried forward

### A1. Transport, account identity, and authentication

The backend has the global prefix `/api`. If the mobile `API_BASE_URL` already includes `/api`, append paths such as `/jobs`, not `/api/jobs` again. Browser `/api` proxies and Next.js Server Actions are not interchangeable with backend endpoints.

Use the app's existing authenticated REST client with `Authorization: Bearer <accessToken>`. Keep refresh credentials in platform secure storage. Coordinate concurrent token refreshes so requests do not consume the same rotated token independently. Temporary network/5xx failures must not clear credentials or trigger logout by themselves.

Backend roles are `INSTRUCTOR`, `INSTITUTION`, and `ADMIN`; the web normalizes them to teacher, institution, and admin. Preserve role, email verification, onboarding, profile approval, and suspended-account gates. Account user IDs, instructor profile IDs, institution profile IDs, job IDs, application IDs, and conversation IDs are distinct identities.

Successful REST envelopes include `success`, `statusCode`, `message`, and `data`, sometimes metadata. Unwrap `data` once. Preserve error status/code internally; a message may be a string or array. Website `ActionResult` and `fieldErrors` are adapters, not guaranteed backend fields on every endpoint.

Keep authentication flows already supported: password reset, email verification, Google sign-in, two-factor setup/challenge/enable/disable/recovery, and phone verification. Keep OTPs as strings so leading zeroes survive. Native sign-in and payment integration must use the app's existing supported platform flow rather than browser-only components.

Invitation destinations must survive login, email verification, onboarding, and approval gates. Permit only known internal invitation routes/IDs. Opening a link, notification, or screen must never accept an offer automatically.

Clear account-scoped caches and in-memory drafts on logout/account switching. Do not let one account see another's cached content.

### A2. Lists, loading, pagination, and partial failure

Use each endpoint's returned pagination. A first page is not a complete history or count. For complete dashboard/grouping summaries, fetch all relevant pages, deduplicate by entity ID, and guard against repeated pages, inconsistent metadata, and incomplete results.

An empty successful response differs from a failed request. Show unknown/unavailable rather than zero, “free,” or “no records” after a failure. A failed dashboard section should not blank the entire dashboard. Preserve form values during retries and invalidate related cached entities after mutations.

Refresh on native screen focus and foreground resume. Use app lifecycle signals for foreground-only polling and socket reconnects; do not port `window`/DOM lifecycle code into React Native.

### A3. Database-driven dropdowns

Use `GET /dropdowns`, `GET /dropdowns/:name`, and the existing `/teaching-catalogue` compatibility endpoint where applicable. Dropdown data is public but still uses the backend envelope.

```ts
type DropdownOption = {
  key: string;
  value: string;
  label: string;
  aliases: string[];
  group: string | null;
  sortOrder: number;
  isActive: boolean;
  isShared: boolean;
  subjectKeys: string[];
};

type Dropdown = {
  id: string;
  name: string;
  label: string;
  revision: number;
  isActive: boolean;
  updatedAt: string;
  expandable: boolean;
  options: DropdownOption[];
};
```

Display `label`, submit `value`, and use subject `key` to resolve skill `subjectKeys`. Preserve API ordering. Summaries have option counts, not full options. Do not hardcode old option counts, menu labels, catalogue versions, or seed values as production fallbacks.

Use a shared query/cache per collection; the web uses roughly 30 seconds of freshness, five minutes of unused cache, one retry, and focus refresh. Native equivalents should deduplicate in-flight requests and refresh after relevant stale-selection errors.

Handle `INVALID_DROPDOWN_SELECTION`, `DROPDOWNS_NOT_SEEDED`, `INVALID_TEACHING_SELECTION`, `INVALID_OTHER_SUBJECTS`, `INVALID_OTHER_SKILLS`, `SKILL_SUBJECT_MISMATCH`, and `CONFLICTING_JOB_SUBJECTS` by refreshing relevant choices while retaining the user's form.

Loading/error disables unavailable choices and offers retry. An empty successful list stays empty. Keep a retired saved value visible with review/remove guidance; do not automatically replace it with the first option. Local placeholders, All/Any filters, and formatting reset actions are UI controls, not backend options. An empty filter omits that query field.

Use searchable single/multi-select native controls with labels, selected counts, grouped choices, aliases, wrapping long labels, clear actions, maximum-selection limits, and accessible selected/disabled states. A native sheet is appropriate when it avoids keyboard or modal clipping.

Backend operators must deploy and seed the dropdown collections. The app must not run seeds or overwrite administrator-managed collections at startup.

### A4. Subjects, skills, staffing needs, and custom values

Available skills are active shared skills plus active skills whose subject keys intersect the selected named subjects. Deduplicate overlapping skills. Removing a subject removes unsupported selected named skills with an explanatory notice; skills still supported by another selected subject remain. Do not auto-select skills.

Teacher fields are `subjects`/`skills`; job fields are `subjects`/`requiredSkills`; school fields are `staffingNeeds`. Schools do not acquire a skills editor.

Custom names use an `Other` marker plus separate chips:

```json
{
  "subjects": ["Mathematics", "Other"],
  "otherSubjects": ["Astronomy"],
  "requiredSkills": ["Algebra", "Other"],
  "otherSkills": ["Telescope operation"]
}
```

For teachers use `skills` instead of `requiredSkills`. For schools use `staffingNeeds` and `otherSubjects`, without skill fields. These are fragments; retain each endpoint's other required fields.

Backend responses return actual names in the main arrays, not persisted `otherSubjects`/`otherSkills` columns. On edit, reconstruct named choices and custom chips. Resolve known aliases to canonical menu values; do not submit a known name as a custom value. Preserve historical unknown/retired values until explicitly changed.

Normalize whitespace, trim, and deduplicate names. Allow Unicode letters/numbers, reject controls and punctuation-only names. Custom names use 1–100 characters; subject and skill groups each allow at most 50 actual values. Other without custom names, custom names without Other, and uncommitted chip text must produce useful validation.

Unrelated PATCHes omit unchanged teaching/location/cover-type groups so retired values do not block unrelated edits. Preserve explicit `[]` clears. School cover types remain a multi-select, not comma-separated free text.

### A5. Rich text serialization and native reading

Use one editor implementation for role descriptions and application proposals, parameterized by labels, placeholder, and limits. Appearance choices come from `proposalFontFamily`, `proposalFontSize`, and `proposalTextColor`. `descriptionFontSize` is a historical compatibility collection, not a separate modern role-editor configuration.

Support bold, italic, underline, bullet/numbered lists, links, and clear formatting. Store supported semantic HTML in job `description` or application `coverLetter`; do not add separate font/color fields to requests. Do not submit a `proposal` field merely because a UI control uses that name.

The inspected application DTO uses `@MaxLength(2000)` on `coverLetter`. Validate the serialized submitted string, including markup, as well as any visible-text UI guidance. Empty HTML such as `<p><br></p>` is an empty optional proposal. Job descriptions use their own existing limit (web: 10,000 editable serialized characters; publication also requires at least 20 visible characters). Do not reuse the proposal limit for descriptions.

Import legacy plain/Markdown-like job text safely: escaped literal text, bold heading paragraphs, bullet lines, and supported bold spans. Do not double-escape existing supported HTML. Loading/normalizing old content must not dirty the form or PATCH an untouched job. Preserve the existing wizard's generated metadata handling rather than making those metadata lines editable rich text.

Render sanitized content in job review/details, invitations, and proposal previews. Allowed tags are `a`, `b`, `br`, `em`, `i`, `li`, `ol`, `p`, `span`, `strong`, `u`, and `ul`. Permit only approved link protocols and supported font-family/font-size/color styling; remove scripts, event handlers, embeds, and arbitrary CSS.

Stored renderer capabilities include Arial/Georgia/Times New Roman, sizes 12/14/16/18/20/24px, and the supported author colors `#17211c`, `#227557`, `#315ca8`, `#7a4a9e`, `#a1483f`. These capabilities are not fallback dropdown menus. Active API values determine selectable options; renderer capabilities must be updated deliberately if new formats are introduced.

Links support http, https, and mailto. Author-selected text colors are document content and must not change with the viewer's UI accent. Explicit toolbar actions may restore editor focus; Part B's focus rule prohibits automatic refocusing after blur or external updates.

### A6. Theme, layout, and accessibility

Load theme preset labels/colors from `/dropdowns/themeAccent`. Keep a custom-color control where supported. Persist app-local preferences equivalent to `supplyed_tweaks`, with `accent` and `urgentBanner`; changing accent must preserve the other preference. There is no new theme synchronization endpoint.

Restore preferences before initial visible content where possible. Mounting a screen must not overwrite a saved accent with a default. Normalize 3-digit custom hex to 6 digits; invalid values fall back to Supply blue `#008CC4`.

Derive tokens consistently:

1. Mix accent toward white by 0.90 for the soft tint and 0.78 for the stronger tint.
2. Start readable dark accent by mixing accent toward black by 0.22.
3. Use WCAG relative luminance on rounded RGB channels; increase black weight by 0.02 until dark text against tint reaches at least 4.6 contrast, capped at full black.
4. Preserve the chosen accent itself. Use the derived dark accent for readable text/icons.

Reference neutral tokens: ink `#15232d`, graphite `#2d3c48`, slate `#50616e`, muted `#5f707b`, border `#e2e8ec`, input border `#cbd5dd`, chalk `#f5f7f9`, surface `#ffffff`, secondary surface `#f8fafb`. Keep success green, warning amber, destructive red, and informational purple independent of the chosen accent.

Preserve the Inter/system-sans hierarchy, readable spacing, rounded fields/cards, and consistent labels. Web reference dimensions include a 46px field minimum, 9px control radius, 10–12px card radius, and 44px option rows. Adapt to native safe areas, touch targets, large text, reduced motion, and keyboard avoidance; do not copy fixed desktop columns onto a phone.

Menus show selected states and counts, wrap long option labels, support search over labels/aliases, and return focus sensibly when dismissed. Multi-selects remain open after toggling and permit removal at the maximum limit. Errors, loading, empty lists, and retired saved values all need distinct visible states.

### A7. Registration, onboarding, documents, and profile review

Recover progress using `/auth/me` and the role's `/instructors/me` or `/institutions/me`. Profile-review states are separate from application states. Retain existing registration, school/MAT/signatory dependencies, safeguarding confirmation, compliance contacts, and teacher experience/travel/rate fields.

Once the profile is created, preserve completed onboarding steps and focus on required documents. Optional empty staffing needs must not prevent school onboarding resumption. An uploaded document awaiting review can satisfy the user's submission stage; do not require prior administrator approval before Send for review.

Document flow:

1. Read `/document-requirements/profile`: requirement identity, mandatory status, MIME types, and byte limits.
2. List `/documents` and associate by requirement ID.
3. Create a missing document record via `POST /documents`; reuse existing records for file replacement.
4. Request `POST /documents/:id/upload-url`.
5. Upload actual bytes to the returned signed URL using its required method/headers.
6. After storage success, call `POST /documents/:id/upload-complete` with the supplied completion fields.
7. Preview using `/documents/:id/download-url`; refresh expired URLs.
8. Submit review through the role's `PATCH /instructors/me/status` or `/institutions/me/status` using its existing body-free contract.

Track upload state per requirement so several requirements can upload concurrently. Only lock the currently uploading box. A failed replacement must not appear successful. Review submission waits for required confirmations and all in-flight uploads to settle. Do not assume every profile has exactly four requirements.

Profile photos have their own 5 MiB limit; documents use their requirement limits. Do not JSON-encode file bytes or port the web's multipart wrapper into the native signed-upload flow.

Phone verification is optional at document submission. Settings use the final unverified-editable/verified-locked rule in Part B. Account and role-profile settings saves are two non-atomic writes; report partial success accurately if the second write fails.

### A8. Jobs, publication, discovery, and matching

Use public `/jobs` and `/jobs/:id` for public discovery. Owned jobs use `/jobs/mine` and `/jobs/mine/:id`, including drafts/nonpublic listings. A public 404 does not prove an owned job disappeared.

Creation saves through `POST /jobs`, then publication uses `PATCH /jobs/:id` with `status: "ACTIVE"`. Keep the created ID if activation fails and retry activation on that ID. If creation itself times out without an ID, reconcile owned jobs instead of blindly creating duplicates.

Preserve changed-field PATCHes and states `DRAFT`, `ACTIVE`, `SUSPENDED`, `CLOSED`, `EXPIRED`. Do not give ordinary schools an administrative suspension action. Visibility precedence remains Suspended → Closed → Draft → expired state/cutoff → future opening (Scheduled) → Live. An ACTIVE job can still be scheduled.

Use Part B's final field order, planned units, work-date checks, and listing-day semantics; the older Requirements-step listing placement is superseded.

Search subject remains scalar `subject=<canonical value>`, not `subjects=A,B`. The backend matches within job subject arrays. Reset pagination after filter changes. Keep directory's existing scalar subject/skill filters and supported location/stage/availability/qualification/experience/rate/rating filters.

Matching endpoints:

- `/matching/jobs/recommended` for teachers.
- `/matching/jobs/:jobId/instructors` for school teacher recommendations.
- `/matching/jobs/:jobId/applications` for ranked applicants.

Display returned scores, distance, flags, and factor explanations; do not recalculate ranking in the client. Unknown distance is unavailable, not zero. Job cards display all returned subjects. Staffing needs are a school preference, not a replacement for a job's subject requirements.

### A9. Applications and audit history

`POST /applications` accepts `{ jobId, coverLetter? }`. The backend snapshots the job title as `jobName`; do not submit a client-invented title. History uses saved `jobName` before a current job title so expiry/removal does not erase context.

Application states are exactly `APPLIED`, `VIEWED`, `SHORTLISTED`, `HIRED`, and `REJECTED`. No Interview state. Invited is a separate invitation-backed view, not a status sent to application APIs.

| Current state | Allowed forward destinations |
| --- | --- |
| APPLIED | VIEWED, SHORTLISTED, HIRED, REJECTED |
| VIEWED | SHORTLISTED, HIRED, REJECTED |
| SHORTLISTED | HIRED, REJECTED |
| HIRED / REJECTED | Terminal in this workflow |

Opening an application does not mark it Viewed. Send one `PATCH /applications/:id/status` for the chosen destination. Confirm hiring in the UI; the backend creates the booking and closes/fills the job transactionally. Do not create a second booking or fake intermediate transitions.

Read `/applications/me`, `/applications/job/:jobId`, `/applications/:id`, and paginated `/applications/:id/history`. Display server actor/time/old-new-status audit records, not fabricated local history. Refresh authoritative state after conflicts.

### A10. Invitation orchestration and recoverable retries

Use Part B's current fields, frozen terms, dates, overlap checks, and decisions. A pending invitation does not reserve the position or teacher.

Existing eligible jobs are DRAFT/ACTIVE, unexpired, with valid future work dates and supported pay. A newly created invitation job stays private while pending. Decline may publish an eligible auto-created job according to `publishOnDecline`; do not assume cancel/expiry publishes it.

The response deadline defaults to the earliest of seven days, work start, or listing expiry. Custom deadlines must satisfy the existing bounds. Keep invitation response expiry separate from listing expiry.

After successful invitation creation:

1. `POST /conversations` with the returned instructor profile ID and job ID.
2. Read recent messages from `/conversations/:id/messages?limit=100`.
3. If its school announcement is absent, post the invitation announcement containing `/job-invitations/<uuid>`.
4. Open the resulting conversation.

Invitation creation alone is not a guarantee that chat was created. If invitation succeeds but chat fails, keep the invitation/request identity and report that partial outcome. Retry chat completion without creating a second invitation. The recent-message check reduces duplicates but is not an atomic idempotent message API.

Persist an uncertain invitation's UUID and exact payload across navigation/app restart until reconciled, scoped to the current account. A corrected request after a definitive rejection gets a new UUID. Offer explicit accept/decline/cancel actions; opening a review screen does not decide.

### A11. Bookings, reviews, dashboards, and profile history

`/bookings/me` supports existing status/date/job/pagination/invoice filters. Booking states are `CONFIRMED`, `COMPLETED`, `CANCELLED`, and `NO_SHOW`. Retain returned agreed pay, units, job/address data, teacher/school summaries, invoices, and reviews.

Actions are PATCH `/bookings/:id/complete`, `/cancel`, and `/no-show`, under existing role/status permissions. Cancellation requires a trimmed nonempty reason up to 1,000 characters; do not send that reason body to complete/no-show.

Reviews use `POST /reviews` with booking ID, integer rating 1–5, and optional comment up to 2,000 characters. Public lists are `/reviews/instructor/:id` and `/reviews/institution/:id`. Use backend aggregates rather than invented ratings.

Teacher dashboard data comes from real applications, confirmed placements, pending unexpired invitations, recommendations, profile tasks, reviews, payout state, messages, and notifications. Active applications count APPLIED/VIEWED/SHORTLISTED; show hired/rejected separately. Use UK calendar boundaries for schedule periods. Ongoing confirmed work remains relevant through its final school day.

School dashboards use owned jobs, applicants, bookings, and invitations with real complete totals. Keep Scheduled/Live labels consistent across screens. Owner profile/history combines profile details, application history, bookings, and given/received reviews; web aggregation routes do not imply new backend endpoints.

Do not turn a failed balance query into £0, a failed review query into zero stars, or a failed booking query into free availability.

### A12. Messaging transport, notifications, payments, and invalidation

Retain the existing conversation list/detail/messages/read/attachment APIs. School conversations can start with permitted teacher/job/application context; they are not restricted to after booking. The latest inbox presentation changes in Part B group these existing entities without merging backend histories.

The web uses one Socket.IO connection on namespace `/conversations`, path `/api/socket.io`, authenticated with a short-lived ticket from `POST /conversations/socket-ticket`. Preserve the supported native integration, obtain a fresh ticket on reconnect, and refresh missed data. Use foreground REST refresh if the connection is unavailable.

Notifications use `/notifications`, `/notifications/unread-count`, `/notifications/preferences`, POST `/notifications/:id/read`, POST `/notifications/read-all`, and PATCH `/notifications/preferences`. Invitation notifications open their review ID; job-match notifications keep their appropriate discovery/job destination. Notification settings save independently.

Payments retain payout account/session/balance/instant-payout, invoice detail/list/payment-session/sync, and role-gated administrative actions. Amounts named `Pence` are integer minor units. A payment UI callback alone does not prove paid status; reload/sync the backend invoice. Planned hours/days do not replace actual `unitsWorked`.

Use supported native payment integration or an approved hosted flow; do not embed browser-only Stripe elements or secret keys in the app.

| Mutation | Refresh/reconcile |
| --- | --- |
| Profile/settings | Current user/profile, onboarding, affected discovery/matching |
| Dropdown validation rejection | Affected collections; retain edited form |
| Job save/publish/close/delete | Owned/public job lists/details, application job selectors, matching |
| Application decision | Application/history/list, dashboards; hire also bookings/jobs/invitations |
| Invitation create/chat | Invitations, jobs, conversations/unread, dashboards |
| Invitation accept | Invitations, jobs, applications, bookings, schedules, matching, payment context |
| Invitation decline/cancel | Invitations/jobs, including any publication change |
| Booking status | Bookings, teacher schedules, discovery/profile, matching/dashboard, invoice context |
| Review | Booking review state, profile ratings/history |
| Payment sync | Invoice, balances, booking payment summary |
| Phone verification | Current user/profile/onboarding and settings lock state |
| Overlap conflict | Affected teacher schedules and authoritative invitation/job state |

Public waitlist flows retain their existing audience-specific collections, consent, founding-interest endpoint, and token-authorized follow-up details. Legacy standalone HTML forms and web deployment files are source references, not new mobile screens or runtime dependencies.

## Part B — Current implementation specification and acceptance checks

The following consolidated requirements include all 20 October changes and follow-ups. They are authoritative for the final behavior. Part C explains how to translate them into native screen and state structure.

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

### Open invitations directly from chat

Existing invitation messages contain a plain relative path such as `/job-invitations/<uuid>`. Render that reference as an accessible **View invitation** link/button in both incoming and outgoing message bubbles. Tapping it opens the invitation detail screen for that exact UUID through the app's existing authenticated navigation; it must not accept the invitation automatically.

Apply this at rendering time so historical messages also work. Preserve surrounding text, newlines, attachments, timestamps, and read receipts. Do not rewrite/resend old messages or change message generation just to add markup (the web deduplicates retries using the existing message body).

Only recognize valid invitation paths at text boundaries; keep arbitrary text/HTML and unrelated URLs as plain text. Do not interpret chat content as executable HTML or navigation commands. Preserve normal access checks and login return-to behavior. Web reference: `features/conversations/message-links.ts` and the message bubble in `components/organisms/MessagingPage.tsx`. Mobile should navigate to its native invitation detail screen instead of opening a browser-only relative path.

Confirmed booking overlap is checked on invitation creation and acceptance:

```text
existingStart <= proposedEnd && existingEnd >= proposedStart
```

The supplied checks include equal endpoints. Two nonoverlapping times on one day can be valid; intervals that meet at exactly the same endpoint conflict under this rule. The backend remains authoritative because schedules can change after loading.

For the known overlap conflict, show: **"This teacher is already booked during these dates. Choose different dates or another teacher."** Refresh the affected teacher schedules. Do not treat every HTTP 409 as overlap; stale consent and other conflicts need their own messages.

Keep the invitation input `requestId` UUID: it is an idempotency key, not a diagnostic reference. When a network failure leaves the outcome uncertain, retry the same UUID with the same payload rather than creating another invitation. Use a new attempt only after a definitive rejection and corrected input. Preserve the app's existing deadline and retry rules.

## 6A. Messaging inbox and topic selection

Show one inbox entry for each school/person, grouping by stable account/profile identity and role. Never group by display name. Keep unknown/deleted accounts separate when no stable identity exists.

Inside the selected contact, use four accessible topic tabs: **General**, **Jobs**, **Applications**, and **Invitations**, with counts. Use "General" in the UI rather than "Direct message". Under the active topic, show a selector for each individual item, including title, creation date, status where available, and unread count. Disambiguate same-title entries so all remain selectable.

Keep all jobs, applications, and invitations; do not collapse them into one topic history. Sort each selector newest first. Opening a contact defaults to its newest job/application/invitation context, ahead of General. An explicit deep link still opens the exact requested conversation/application. Later refetches must not unexpectedly switch an already selected item. Sort contacts by their latest message activity.

Switching the selected item renders its messages and its matching context panel together. Show application context/proposal for an application, job context for a job, and offered snapshot/status/response link for an invitation. General has no job context. Preserve per-conversation message drafts, attachments, and pending sends while switching; a send/upload completing after a switch must update its original conversation only.

Unread counts at the contact level sum distinct underlying conversations. Opening one conversation must not mark unrelated conversations read. Topic counts represent selectable items, not unread totals. Keep pagination intact; a partially loaded inbox must not pretend its contact count is final.

The current conversation API has job/application context but no independent invitation-conversation ID. Use the paginated existing invitations API to match invitations to non-application job conversations by **job ID + instructor profile ID + institution profile ID**. Each matching invitation gets its own selectable context. Its messages are shared with that job conversation; tell the user this clearly and do not create fake independent histories or double-count unread messages. Show a retryable invitation-loading error if that data is unavailable. Invitations without a matching conversation should remain accessible through the normal invitation area; do not silently fabricate a chat.

Use the existing authorization, message send, attachment, read receipt, typing, and realtime APIs. No database merge or deletion of conversations is required. Reference `features/conversations/threads.ts` and `components/organisms/MessagingPage.tsx`.

Replace the old "Messages here are only visible to the two of you" claim. Show: **"Conversations may be monitored by the SupplyEd team for support and safety."** Keep a friendly empty-state greeting without promising two-person-only access.

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

### Saved-number normalization and verified display

Before implementing the backend gap below, also preserve the saved-number compatibility fix: the phone input previously displayed a stored national number with an added `+44`, while validation checked the original unprefixed value and rejected it. Normalize already-stored UK numbers consistently in auth/profile/settings adapters, and compare their canonical representations. For example, stored `7740123456`, `07740123456`, and `+44 7740 123456` represent the same UK number. This compatibility normalization applies to saved UK account data; keep explicit-country and validity checks for new or edited input.

Use the server's verification state for the immutable saved-number display. Show the saved number read-only with **Phone verified**; do not reclassify it as unverified because local metadata rejects a historical representation, display a disabled Verify phone action, or show an input error the user cannot correct. Do not offer “verify a new number to replace it.” Hide stale OTP errors/challenges after verification.

Omit untouched/verified phone values from settings writes. The save boundary must fetch current account state, reject an actual verified-number change/clear, omit equivalent unchanged values, and only then validate editable phone input. This also prevents old clients that submit the entire saved form from blocking unrelated settings saves. Malformed historical saved values remain unchanged rather than being guessed or silently rewritten; unverified replacements still require valid UK input. Normalization never grants verification or updates stored account data by itself.

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
| Invitation reference in old/new incoming/outgoing chat | Accessible View invitation action opens the exact invitation; does not accept it |
| Same school/person has multiple conversations | One inbox entry with General/Jobs/Applications/Invitations tabs |
| Multiple applications/jobs/invitations, including duplicate titles | Each is selectable, newest first, with matching messages/context |
| Invitation selection for an existing job conversation | Offered snapshot changes; shared message history is clearly labelled |
| Open a different topic while composing/uploading/sending | Original draft/attachments remain attached to original conversation |
| Group unread counts and opening a thread | No double counting shared invitation history; unrelated threads stay unread |
| Chat privacy copy | SupplyEd monitoring notice is visible; no two-person-only privacy promise |
| Save changed unverified phone | Saves without SMS requirement |
| Verified phone | Locked while other settings still save |
| Saved verified phone uses legacy national formatting | Canonical display with Phone verified; no impossible correction error or re-verification button |
| Old client submits the unchanged saved phone | Fresh-state comparison omits it before input validation; unrelated updates can save |
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
| Grouped inbox and selected context | `features/conversations/threads.ts`, `components/organisms/MessagingPage.tsx` |
| Clickable invitation references | `features/conversations/message-links.ts` |
| Messaging data and realtime transport | `features/conversations/types.ts`, `schemas.ts`, `use-conversations.ts`, `socket.ts` |
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

## Part C — React Native implementation walkthrough

### C1. Screen map and reusable modules

Map these responsibilities to the existing app's screens instead of inventing parallel flows:

| Screen/module | Implementation responsibility |
| --- | --- |
| Job create/edit | Shared role editor, final field order, pay mode, synchronized work units, listing constraints |
| New job inside invitation | Reuse the same scheduling/units/editor logic; keep response deadline separate |
| Teacher profile/discovery | Dates-only confirmed schedule with empty/error distinction |
| Own bookings | Full returned booking address and agreed-unit snapshot |
| Settings | Visible save validation, optional unverified-phone save, verified-phone guard |
| Inbox/contact screen | One contact entry per stable identity, aggregate distinct unread counts |
| Contact conversation | Four topic tabs, item selector, active messages/context, draft lifecycle |
| Invitation detail | Frozen offer, existing decision APIs, safe return after authentication |
| API adapter | Envelope handling, friendly errors, optional units, strict request values |
| Shared native controls | Search/multi-select, rich-text editor/reader, date/time input, accessible notices |

Use pure TypeScript for calendar/unit calculations, invitation-path recognition, stable-identity grouping, and context sorting where possible. Adapt import aliases and data types. Replace DOM controls, CSS, browser storage, Next actions, and browser navigation with the app's existing native equivalents.

### C2. A first-time messaging user should understand the screen

The contact list contains one “Quentin Kim” row, not separate rows for every topic. Its preview reflects the latest message activity and its unread badge counts each underlying conversation once.

After tapping the row:

```text
Quentin Kim

[ General ] [ Jobs (2) ] [ Applications (3) ] [ Invitations (2) ]

Choose an invitation                         Newest first
[ Physics · 20 Oct 2026 · Awaiting response · Latest      v ]

Selected offer summary / View details
Messages for the associated conversation
Message composer
```

The example names/counts are illustrative, never fixtures to ship as real data.

Keep the category strip compact; wrap or scroll accessibly on small screens. The item picker can be a native sheet with readable title, date, status, and unread information. A hundred invitations should become a searchable/listed selection, not a hundred narrow tabs.

Opening a contact chooses the newest job/application/invitation context; General is the fallback when no contextual thread exists. Within each category, newest means invitation creation time or the available conversation creation time. Contact ordering uses message activity. These are different sorts.

An explicit notification/deep link wins over the default sort. A background refresh must not jump the user to a different selection. Empty categories stay visibly unavailable rather than creating new backend conversations merely because a tab was tapped.

On phones, show a concise selected-context summary above the messages with a View details action opening a sheet or screen. On tablets, a side panel is appropriate. Both must show the currently selected item, not details from the previous query. A failed context fetch leaves the chat available with a retryable context error.

### C3. Selection state is separate from the message destination

Use equivalent state to:

```ts
type Topic = "general" | "job" | "application" | "invitation";
type SelectedThread = {
  contactKey: string;
  threadKey: string;
  topic: Topic;
  conversationId: string;
  invitationId?: string;
};
```

This is a suggested client view model, not a new API DTO. Ordinary thread keys may use the existing conversation ID. Invitation keys can be `invitation:<invitationId>` while retaining the matched job conversation ID for messages.

Two invitations for the same job can therefore have different selected offer IDs but the same `conversationId`. That is expected with the current backend. Never send messages to an invitation ID or fabricate a separate server history. Show the shared-history explanation.

Match invitation contexts only when job, instructor, and institution identities all agree. A shared job title, teacher name, or school name is not a safe join. Complete pagination before claiming there are no more invitations.

Retain every actual job/application conversation, even if titles repeat. Provide date/status and a deterministic secondary label where necessary. Missing participant identity must not merge unrelated “Account unavailable” records.

### C4. Drafts, uploads, sends, and read state

Keep draft state outside components that unmount on topic changes, keyed by underlying conversation ID:

```ts
type ConversationDraft = {
  body: string;
  attachments: unknown[]; // Replace with the app's existing upload/draft type.
  sending: boolean;
};
type DraftStore = Record<string, ConversationDraft>;
```

An invitation tab and its shared job chat intentionally use the same draft. Distinct application/job/general conversations use separate drafts.

When uploading or sending, capture the destination conversation ID. Completion updates that original draft/cache even if another tab is now open. Keep a pending-send guard across unmount/remount so switching away and back cannot enable a duplicate send. Remove only attachments included in the completed send and do not erase text typed afterward.

Keep a failed send's draft and show a friendly retry path. Scope in-memory drafts to the current account; clear them on logout/account switch. Use the existing mobile policy if longer-lived local drafts already exist.

Mark only the active, visible conversation read. Stop its typing indicator when leaving it. Return to the most recent relevant messages when switching histories; do not combine messages from separate conversation IDs into one timeline. Preserve message pagination and attachment access checks.

### C5. Worked hourly scheduling example

Inputs:

```text
Pay basis: Hourly
First working date: 21 October 2026
Last working date: 22 October 2026
Daily start: 02:00
Daily end: 05:00
```

Calculate calendar days as 2. Calculate daily working minutes as 180. Calculate planned total as `180 * 2 / 60 = 6`. Show “3 hours per day × 2 days = 6 total working hours.”

If the user enters total 8, preserve both dates and 02:00 start. Divide 8 by 2 to get 4 hours per day, then move daily end to 06:00.

If a total cannot be distributed into whole-minute daily shifts before midnight, keep the input and explain how to correct it. Do not silently round or extend the dates. The fields are an equal daily schedule across all included calendar dates; there is no weekday exclusion or per-day override in this contract.

Serialize the overall start/end timestamps and numeric planned `hours` using the existing API. This correction does not add a recurring-shift backend model. Existing booking overlap still uses the backend's overall date interval; do not infer that gaps between daily shifts are independently bookable without new backend support.

### C6. Worked invitation selection example

A school and teacher have:

- General conversation G.
- Job conversation J for Physics.
- Application conversation A for Chemistry.
- Two invitation records I1 and I2 for Physics, with I2 newer.

The inbox shows one contact. Tabs show General (1), Jobs (1), Applications (1), Invitations (2). The invitation selector lists I2 before I1. Selecting I1 displays I1's frozen terms and response status while fetching messages for J. Selecting A shows A's messages and Chemistry application context. Selecting G removes job/application context.

If J has three unread messages, the contact adds three once, even though J is also reached through two invitation contexts. Viewing I1 reads J's messages; it does not mark A or G read. Opening View invitation reviews I1; it does not accept it.

### C7. Native navigation and accessibility checks

Recognize valid internal invitation references from old and new plain-text messages. Render a tappable Text/Pressable using the app's existing navigation. Do not send `/job-invitations/<uuid>` to a generic external URL opener and assume it will resolve in React Native.

Preserve pending navigation through authentication and verify invitation authorization on load. Malformed IDs, unrelated URLs, and arbitrary HTML remain text. Use accessible link/action labels and adequate touch targets.

Expose topic selected/disabled states and unread information to screen readers. Announce the selected item and show a visible label for the picker. Do not rely on a dot or color alone to convey unread/error/status meaning. Support large text, narrow screens, the keyboard, attachments, and long job titles.

Display the SupplyEd monitoring notice in ordinary conversations and keep empty-state greetings friendly. Do not claim that only the two participants can access the conversation.

### C8. Implementation sequence and completion evidence

1. Inspect the actual mobile architecture and record matching screens/modules.
2. Update API types/adapters without changing existing envelope/pagination semantics.
3. Implement shared scheduling/date/unit rules and connect every job-entry flow.
4. Repair editor focus and native keyboard interactions.
5. Implement identity grouping and topic/item selection with existing conversation APIs.
6. Add invitation contexts, native invitation links, and shared-history disclosure.
7. Preserve per-conversation drafts/uploads/sends and correct unread handling.
8. Add booking addresses, teacher schedule visibility, friendly errors, and settings phone/save rules.
9. Reconcile earlier dropdown/editor/theme/onboarding/application/payment behavior from Part A.
10. Run the project's existing lint/type/build checks and the acceptance scenarios in Part B; do not create test files.

For manual checks, use authorized development/test accounts and disposable records. Do not send invitations, hire teachers, submit reviews, charge payments, or change live accounts merely to prove the interface works.

Report actual results: files/screens changed, checks run, device/simulator platforms exercised, unverified behavior, and remaining backend dependencies. Do not reuse historic web test results as proof of native correctness.

## Appendix — Complete earlier dropdown collection mapping

The mapping below carries forward the earlier registered collections and their payload responsibilities. The referenced IDs/component names are web provenance; native screens use their existing equivalents. Historical/legacy collections do not require inventing matching mobile screens.

| Collection | Stable IDs / locations | Value mapping |
| --- | --- | --- |
| `subject` | O03/S04 teacher onboarding/settings; O12/S10/R03 school staffing; J05 job wizard; I04 invitation new job; D03 job search; shared `TeachingSelectionFields` | Teacher/job `subjects`; school `staffingNeeds`; search scalar `subject`. |
| `skill` | O04/S05 teacher; J06 job; I05 invitation | Teacher `skills`; job `requiredSkills`; restricted by selected active subject keys/shared skills. |
| `keyStage` | O05/S06/J07; D02/D04; `TeacherProfileStep`, `SettingsPage`, `PostJobPage`, discovery pages | `keyStages[]` on profiles/jobs; scalar `keyStage` in search. |
| `country` | O01/O08/S01/S07/J03/R01; shared `CountryCityFields`, settings helper, job wizard, retained school profile step | `countryCode`; current supported technical country is `GB`. |
| `city` | O02/O09/S02/S08/J01/I03/R01/D05; same location fields, invitation and teacher discovery | `city`, `newJob.city`, scalar discovery `city`. |
| `region` | O10/S03/S09/J02/R02; school onboarding, both settings roles, job wizard, retained staffing step | `county`; onboarding editor calls the field `localAuthority`. |
| `currency` | O06, `TeacherProfileStep` | `currency`; supported payment currency remains GBP. |
| `institutionType` | O07, `InstitutionDetailsStep` | `institutionType`; existing MAT/trust/signatory conditions remain. |
| `coverType` | O11, `InstitutionDetailsStep`; school `SettingsPage` | `coverTypes[]`; settings now uses the same multi-select rather than comma-separated free text. |
| `payType` | J04/I02, `PostJobPage`, `InvitationModal` | `payType`/`newJob.payType`; exact values `daily`, `hourly`, `fixed`. |
| `timezone` | I01, `InvitationModal` | Default `Europe/London`; local date/time converted to ISO. No new timezone payload field. |
| `waitlistSchoolRole` | W01, `FoundingInterestForm` school | `role`. |
| `waitlistSchoolArea` | W02, same | `area`. |
| `waitlistSchoolType` | W03, same | `schoolType`. |
| `supplyDaysPerTerm` | W04, same | `supplyDaysPerTerm`. |
| `coverBookingMethod` | W05, same | `coverBookingMethod`. |
| `waitlistTeacherRole` | W06, `FoundingInterestForm` teacher | `role`. |
| `waitlistTeacherArea` | W07, same | `area`. |
| `currentSupply` | W08, same | `currentSupply`. |
| `daysPerWeek` | W09, same | `daysPerWeek`. |
| `waitlistPhase` | `WaitlistConfirmation` teacher checkboxes | `phases[]`; distinct from profile key stages. |
| `discoveryUrgency` | D01, `FindJobsPage` | Value `"true"` becomes boolean query `urgent: true`; All omits it. |
| `teacherRating` | D06, `FindTeachersPage` | String option becomes numeric `minRating`; Any omits it. |
| `bookingInvoiceState` | B01, `BookingsPage` | `invoice`: `none`, `unpaid`, `paid`; Any omits it. |
| `refundReason` | B02, `BillingPage` | Existing refund body `reason`; authorization unchanged. |
| `applicationStatus` | `TeacherApplicationsPage` status filters; `ApplicationsWorkspacePage` workflow | Supported application states/labels; local All and Invited views are separate. |
| `jobStatus` | M03-adjacent filters, `JobManagementList` | Existing `JobStatus` filter values; actions still follow job lifecycle rules. |
| `jobInvitationStatus` | `JobInvitationsPage` | Invitation status filters; decisions retain dedicated endpoints. |
| `bookingStatus` | `BookingsPage` status tabs | API status mapped to existing tab keys; local All omits status. |
| `invoiceStatus` | `BillingPage` invoice filters | Existing filter/status mapping; Processing/PENDING remains admin only. |
| `profileStatus` | Backend/admin reference collection | No editable profile-approval dropdown exists in this marketplace. Type registered; no new approval authority added. |
| `foundingInterestStatus` | Backend/admin reference collection | No marketplace waitlist-status editor. |
| `documentVerificationStatus` | Backend/admin reference collection | Document status remains server-owned; no marketplace verification-status editor. |
| `signatoryApprovalStatus` | Backend/admin reference collection | Approval remains server-owned; no marketplace approval-status editor. |
| `proposalFontFamily` | A01, `components/molecules/ProposalEditor`; shared role descriptions in job creation/editing and invitation new jobs | Quill `font`; saved inside proposal HTML. |
| `proposalFontSize` | A02, same | Quill `size`; saved inside proposal HTML. |
| `proposalTextColor` | A03, same | Quill `color`; saved inside proposal HTML. |
| `descriptionFontSize` | Historical R04 registry collection | Still exposed by backend for compatibility. The website role editor now imports `ProposalEditor` and uses `proposalFontSize`, `proposalFontFamily`, `proposalTextColor` so every change is shared. |
| `themeAccent` | M06, `PublicThemeControls`, `TweaksPanel` | Preset label/color; existing local theme preference persistence. Custom-color input remains. |
| `legacySchoolRole` | L01, `public/founding-schools (1) (1).html` | Legacy `role`. |
| `legacySchoolType` | L02, same | Legacy `schoolType`. |
| `legacySchoolTier` | L03, same | Legacy `tier`. |
| `legacyTeacherRole` | L04, `public/founding-teachers (1).html` | Legacy `role`. |
| `legacyTeacherPhase` | L05, same | Legacy `phase`. |
| `availability` | L06, same | Legacy desired work `availability`; not calendar availability. |

## Final delivery boundary

The mobile agent must complete all applicable client work and clearly report two external dependencies: deployment of the work-units migration/API, and server enforcement of the verified-phone lock. Grouped inbox presentation, topic selection, and invitation context can use the current APIs; separate invitation-only message histories would require a new backend contract.

Keep the existing UI design language and workflow permissions. Deliver a working native implementation with honest verification results, not a plan alone.
