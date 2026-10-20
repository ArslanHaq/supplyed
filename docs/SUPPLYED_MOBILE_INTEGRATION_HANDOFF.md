# SupplyEd mobile integration handoff

Updated 19 October 2026 after the database dropdown, shared role-description editor, theme-persistence and authentication query-provider changes. This is a standalone implementation handoff for a coding agent building the teacher and school mobile experiences against the existing SupplyEd backend. Read the behavior sections before the reference appendices. Do not copy Next.js Server Actions, browser cookies, or React components into a native app.

## 1. Scope, source revisions, and precedence

The review includes the two latest web commits and the current working tree, including untracked feature files:

- `620d3331e5c8e860f61a277fdaa34934101f85bb` — 14 October 2026, “fixed the founding page only show”. Despite the title, this is a substantial validation, component consistency, uploads, session, deployment, and production-safety change. It temporarily restricted the site to the public founding/waitlist pages.
- `4c666d1a032125581671946c941869d4e1c33bd1` — 15 October 2026, “code updated”. Restores authenticated product routing and public navigation while retaining the broader validation and safety work.
- Current uncommitted work — document upload fixes; optional phone verification at document review; teacher/school dashboards; saved application titles; five application statuses; direct decisions; listing dates; invitation workflow and chat initiation; Invited filters; profile histories; notification routing; UK phone handling; database-managed dropdowns across the website; custom subjects and skills; the shared role/cover-letter rich editor; persisted theme tokens; and the detailed UI integration described below.

The current working tree takes precedence over the two historical commits. In particular, do not reproduce the historical waitlist-only middleware, Interview status, mandatory phone verification at document submission, old free-text staffing needs, or scalar-only job subject writes.

The backend repository was inspected read-only. No backend code, database, migration, deployment, or live account data was changed for this handoff. Local source contracts do not prove that a remote environment has deployed those contracts.

### Deployment prerequisite

The target backend must deploy its current job-subject/staffing-needs and database-dropdown migrations and initialize its registered dropdown collections using the dedicated backend seed before clients consume the updated APIs. The initial seed is deployment preparation, not an operation run by mobile/web app startup. Never reset already administered collections from a client. The local backend was checked read-only and all 45 collections were available; this does not prove a remote environment is deployed. Catalogue versions are now revision-based (`db-<subject>.<skill>.<keyStage>`), not the historical fixed `1.2.0`. No option count or list order should be hardcoded in mobile validation.

### Reading this standalone file

- Sections 2?14 explain transport, data, role workflows, errors and implementation order.
- Section 3 is the complete current database-dropdown mapping, including all 45 registered collections and custom-subject/custom-skill payloads.
- Section 3A specifies the exact shared editor, theme derivation, control states, dimensions, spacing, accessibility and mobile parity behavior.
- Appendices A?C retain detailed endpoint, DTO and web-adapter references; documented source blocks have been refreshed from the current read-only backend and website files.
- Appendix F is the latest supplied teaching API handoff; Appendix G embeds current UI/control/theme source snapshots for precise reproduction.
- Earlier audit control IDs are retained. The new shared role editor uses the proposal formatting collections, superseding the older independent `descriptionFontSize` UI recommendation.

## 2. Transport, identity, and common response handling

The Nest backend has global prefix `/api`. In the prose below, backend paths are relative to `API_BASE_URL`, which should already include `/api`: for example, `GET /jobs` means `GET https://BACKEND_HOST/api/jobs`. The website also exposes its own `/api/...` routes; many aggregate or transform backend data. A native client should call backend REST endpoints directly with its own authentication, or explicitly agree to a separate mobile gateway. Do not assume every website `/api` path exists on the backend.

Authenticated REST calls use `Authorization: Bearer <accessToken>`. Keep refresh tokens in platform secure storage. Backend role values include `INSTRUCTOR`, `INSTITUTION`, and `ADMIN`; the web normalizes them to `teacher`, `institution`, and `admin`. Do not confuse user IDs with instructor/institution profile IDs. Job creation uses the authenticated school account; invitation `instructorId` is a teacher profile ID.

Successful backend responses use an envelope with `success`, `statusCode`, `message`, and `data` (and possibly metadata). Unwrap `data` once. Website proxy responses are often already unwrapped. Errors may have `message: string` or `message: string[]`; join an array into readable guidance. Preserve `code`, HTTP status, and any request/support reference for diagnostics. Do not require `field`, `invalidValues`, or `fieldErrors` to exist in a backend error. The web's `ActionResult` and `fieldErrors` are presentation adapters, not a backend-wide response schema.

Use request deadlines; keep entered form data on failures. Coordinate simultaneous refresh attempts. The production HTTP checks exposed duplicate refreshes across separate Next server-render and route-handler module copies; the web refresh cache now lives on the server process global object so both reuse the same rotated pair. Each caller still persists its own cookies, the 30-second grace/expiry/size limits remain, and this does not coordinate separate server replicas. An ordinary temporary network/5xx error must not erase credentials. Sign out or prompt for login only for an unrecoverable authentication failure. Never log tokens or signed download URLs. Refresh each account's cache on account change; do not show one account's cached data to another.

Pagination is endpoint-specific. Lists generally return a collection and `pagination: { page, limit, total, totalPages, hasNextPage }`. Use the returned metadata. A first page is not a complete history or total. If collecting every page for a dashboard, reject repeated IDs/pages, inconsistent totals, missing pages, timeouts, and incomplete results. Show a section error instead of a false zero.

## 3. Database dropdowns, teaching choices and custom names

The following is the current website integration specification. Examples use fully prefixed backend paths (`/api/...`); if the native API base already ends in `/api`, append only the remaining path. Website proxy responses are unwrapped. Direct mobile/backend responses use the standard envelope.

Implemented 19 October 2026 in `supplyed-web`. Read alongside the backend's `DROPDOWNS_FRONTEND_INTEGRATION.md`, `TEACHING_CATALOGUE_FRONTEND_INTEGRATION.md` and the preserved [dropdown.md](dropdown.md) inventory. The original W/O/S/J/I/D/A/B/M/R/L control IDs are unchanged so future work can refer to the same controls.

### Scope and source of truth

Website reference choices now come from the public database dropdown API. This includes school/teacher waitlists, onboarding, settings, job creation/editing, new jobs inside invitations, discovery filters, application/job/invitation/booking/invoice status choices, refunds, editor formatting, theme presets and the retained standalone HTML forms. Labels, active membership and supported subject/skill relationships follow the returned data.

The backend was read only. No backend code, database records, seeds, migrations, invitations or profile data were changed for this integration. The separate `supplyed-admin` dropdown manager is outside this marketplace repository; its integration instructions are in the backend's `DROPDOWNS_ADMIN_INTEGRATION.md`.

Old option snapshots in `dropdown.md` and unused legacy constants are historical references, not fallback choices. Do not reconnect forms to those arrays. Counts are not part of frontend validation.

### Public API and website transport

| Method | Backend URL | Response `data` | Website URL |
| --- | --- | --- | --- |
| GET | `/api/dropdowns` | `{ dropdowns: DropdownSummary[] }` | `/api/dropdowns` |
| GET | `/api/dropdowns/:name` | `Dropdown` with `options[]` | `/api/dropdowns/:name` |
| GET | `/api/teaching-catalogue` | Compatibility teaching catalogue | Existing `/api/teaching-catalogue` retained |

Backend reads are public and return the standard `{success,statusCode,message,data,meta}` envelope. The website's existing server API client checks/unwraps that envelope. **Website proxy JSON is already the `data` object**; browser code must not unwrap it again. Mobile clients calling the backend directly must unwrap the backend envelope once.

The two new Next routes are `app/api/dropdowns/route.ts` and `app/api/dropdowns/[name]/route.ts`. They use `auth: false`, server fetch `cache: "no-store"`, dynamic route rendering and response `Cache-Control: no-store`. The public detail proxy excludes the reserved `admin` path. This website exposes no dropdown write/admin proxy.

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
// Summaries replace options with optionCount; do not treat summaries as options.
```

Render `label`, submit `value`, and use subject `key` only to resolve a skill's `subjectKeys`. An administrator's label change must not alter a payload or a match. Preserve API order; the backend sorts by `sortOrder`, then key. Group headings and aliases are passed to the searchable menu. The browser shares the full city collection and searches locally, without a request on every keystroke.

### Shared implementation and lifecycle

| Source | Responsibility |
| --- | --- |
| `features/dropdowns/types.ts` | Detail/summary/option types, 45 registered collection names and active option mapping. |
| `features/dropdowns/use-dropdown.ts` | Shared React Query reads, `['dropdown', name]`, 30-second stale time, five-minute unused cache, one retry and refetch on window focus. |
| `features/dropdowns/refresh.ts` | Refresh event for dropdown/teaching validation errors. |
| `components/molecules/DynamicDropdown.tsx` | `DynamicSelect`, `DynamicMultiSelect`, loading/error/retry notices and saved-choice review. |
| `components/molecules/OptionDropdowns.tsx` | Existing searchable, keyboard-accessible single/multi menu, native form bridge and labels. |
| `lib/query/query-client.tsx` | Mutation success/error callbacks detect structured validation failures and refresh choices. |
| `app/(public)/layout.tsx` | Provides query context to public waitlists and theme controls. The signed-in route group already provides its own context. |
| `features/teaching-catalogue/use-teaching-catalogue.ts` | Adapts the live `subject`, `skill`, `keyStage` collections for shared teaching fields; retains raw options/keys/labels. |
| `components/molecules/TeachingSelectionFields.tsx` | Subject-linked skill menus, custom-name chips, reconciliation, subject search filter and key-stage wrapper. |
| `public/dynamic-dropdowns.js` | Native select loading/refetch/retry for both retained standalone HTML files. |

An unloaded or failed form dropdown is disabled and shows a loading/retry message. No hardcoded fallback options are offered. Refetches preserve state. A selected value missing from a refreshed ordinary dropdown remains visible with a review notice; multi-selects let the user explicitly remove it. Loading an updated collection never picks its first option automatically.

Empty placeholders and `All`/`Any`/format reset choices remain local. An empty filter omits its API query field. Historical badges can still render their stored status even when it is no longer an active filter option.

`supplyed:refresh-dropdowns` refreshes mounted collections after `INVALID_DROPDOWN_SELECTION`, `DROPDOWNS_NOT_SEEDED`, `INVALID_TEACHING_SELECTION`, `INVALID_OTHER_SUBJECTS`, `INVALID_OTHER_SKILLS`, `SKILL_SUBJECT_MISMATCH` or `CONFLICTING_JOB_SUBJECTS`. Multiple observers share an in-flight refresh. Existing onboarding/invitation direct-action flows also invalidate the `['dropdown']` prefix. Backend messages can be strings or arrays; form state is retained on error.

Public 404/503/network failures show unavailable/retry rather than seed values. A missing seed remains an operator/deployment issue; the website does not run database initialization.

### Complete collection-to-control map

Component paths in the following table are beneath `components/organisms` unless another prefix is stated.

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

Both standalone HTML pages load `/dynamic-dropdowns.js`. This requires serving them from the website origin rather than opening them as `file://` documents. Their external `SCRIPT_URL` submission transport is unchanged. The script preserves current selections on focus refresh, blocks submission while choices are unavailable and flags a retired value until corrected.

### Subjects, skills and custom-name round trips

Available skills are all active shared skills plus active skills whose `subjectKeys` intersect the selected active subjects' keys. A skill available through multiple subjects appears once. Removing a subject removes unsupported selected named skills and explains the removal; skills still supported by another subject remain. Skills are never selected automatically. Key stages are independent.

The shared editor supports separate **Other subjects** and **Other skills** chips. `Other` is a request marker, not a stored name. Custom subjects permit shared skills; a named skill still requires the matching named subject. Custom skills can accompany named or custom subjects and do not require selecting Other in the subject menu.

Teacher request fragment:

```json
{
  "subjects": ["Mathematics", "Other"],
  "otherSubjects": ["Astronomy"],
  "skills": ["Algebra", "Other"],
  "otherSkills": ["Telescope operation"]
}
```

Job request fragment, also used inside an invitation's `newJob`:

```json
{
  "subjects": ["Mathematics", "Other"],
  "otherSubjects": ["Astronomy"],
  "requiredSkills": ["Algebra", "Other"],
  "otherSkills": ["Telescope operation"]
}
```

School request fragment:

```json
{
  "staffingNeeds": ["Mathematics", "Other"],
  "otherSubjects": ["Astronomy"]
}
```

These are teaching-field fragments, not complete create requests: retain every endpoint's other required fields. Schools have no skills field. If Astronomy or Telescope operation is already a known value/alias in the current catalogue, select its canonical named menu option instead of using Other.

The backend returns actual values in `subjects`, `skills`, `requiredSkills` or `staffingNeeds`, e.g. `subjects: ["Mathematics", "Astronomy"]`. It does not return persisted `otherSubjects`/`otherSkills` columns. `toSubjectEditor`/`toSkillEditor` restore known names and aliases to canonical choices and reconstruct Other + chips for unknown saved names. Retired names are kept visible; public active-only data cannot distinguish every retired name from a custom name, so backend validation remains authoritative when that group is changed.

Custom names are trimmed/whitespace-normalized and deduplicated; Unicode letters/numbers are allowed. Controls/punctuation-only names are rejected. Names use 1–100 characters, at most 50 actual subjects and at most 50 actual skills including named choices. Other with no custom names, custom names without Other, or a known name/alias entered as custom are invalid. Press Add/Enter to commit a chip before saving.

Payload support runs through onboarding state/FormData/actions, settings types/actions, job normalization/create/update, invitation `newJob`, inline errors and review displays. `INVALID_OTHER_SKILLS` maps to the `otherSkills` field. Explicit `[]` clears are retained. Unrelated profile PATCHes omit unchanged teaching groups and unchanged location/currency/stage/cover-type fields so old values are not silently deleted or unnecessarily revalidated. Job updates retain changed-field comparison.

### Business APIs remain the same

| Flow | Backend APIs receiving the selected values |
| --- | --- |
| Teacher onboarding/settings | `POST /api/instructors`, `PATCH /api/instructors/:id`. |
| School onboarding/settings | `POST /api/institutions`, `PATCH /api/institutions/:id`. |
| Job create/edit/publish | `POST /api/jobs`, `PATCH /api/jobs/:id`; existing draft/publication orchestration remains. |
| Invitation | `POST /api/job-invitations`; choose exactly one of existing `jobId` or complete `newJob`. Existing-job choices still come from authenticated `/api/jobs/mine`. |
| Modern waitlists | `POST /api/contact/founding-interest`; audience `type: SCHOOL` or `TEACHER` and its relevant field values. |
| Waitlist extra details | `PATCH /api/contact/founding-interest/:id/details`; existing details token and `phases[]`. |
| Legacy school registration action | `POST /api/contact/register-interest`; format/required validation remains and backend validates live membership. |

Modern waitlist submissions fetch the relevant audience collections again before submit, validate exact current values and keep input on a stale-choice failure. Optional teacher details check current `waitlistPhase`. Generic location validation now checks required/length/control-character rules without a bundled city/region allow-list; backend active membership is authoritative. UK postcode/phone/country rules, numeric limits, consent, role authorization and technical workflow enums remain.

Matching continues to use actual subject/skill names and the backend relationship/alias logic. Menu label edits do not change matching. This website change adds no local scoring formula and no new matching endpoint. Existing teacher-directory subject/skill filters remain scalar text searches; job discovery excludes the Other marker and retains exact custom-subject input.

### Controls that keep their own source

- Account/navigation menus contain application routes and executable actions. Existing role checks and logout behavior remain local.
- Notifications, conversations, invitation job choices, uploads and bookings use their existing account/entity APIs and IDs.
- Stripe PaymentElement/Connect menus remain owned by Stripe.
- Browser date/time, upload, custom color and ordinary boolean controls are not finite dropdown collections.
- Editor format support and technical status transitions remain enforced by code/backend. Database presentation changes cannot introduce unsupported payment modes or an Interview stage. Quill format menus sit outside Quill's generated toolbar to prevent its picker transformation from conflicting with React controls.
- Application stages remain APPLIED, VIEWED, SHORTLISTED, HIRED, REJECTED. Direct hire/reject remains available where the existing transition/permission rules allow it. Invited is a distinct view, not an application status.

### Validation performed

- Read-only live backend checks succeeded for all 45 collection detail endpoints. The observed subject collection had revision 2 and 71 options, demonstrating that current database data already differed from the initial seed. These are observations, not assumed constants.
- Website `/api/dropdowns/subject` returned HTTP 200 with the unwrapped detail object.
- Website `/founding-schools` returned HTTP 200, contained the waitlist and dropdown loading UI, and contained no missing-query-provider/server-error screen.
- TypeScript no-emit check passed.
- Full automated suite after shared-editor/theme integration: **258 passed, 0 failed**. Includes subject-key relationships, shared/retired skills, editable labels versus payload values, custom skills, explicit clears, unchanged PATCH preservation, current waitlist membership, real dropdown rendering and query context for public forms and authentication theme controls, plus stable theme hydration/persistence.
- Full `npm run lint` passed. TypeScript `tsc --noEmit` passed.

Interactive visual browser QA was unavailable in this session. Live verification used read-only HTTP requests and automated server-rendered component checks; no live form submissions or admin edits were performed.

### Shared role editor and theme follow-up (19 October 2026)

`RoleDescriptionEditor` is now a thin wrapper around `ProposalEditor`, used by the job wizard (create/edit) and the invitation new-job form. The wrapper changes its label/placeholder, preserves existing Markdown descriptions on import and does not emit an edit simply because an existing value was loaded. Both editors fetch the **same** `proposalFontFamily`, `proposalFontSize`, `proposalTextColor` collections. The historical `descriptionFontSize` collection is no longer an independent website menu.

`FormattedJobDescription` delegates HTML to the existing sanitized `ProposalContent` reader; plain/Markdown records keep the old renderer. Job reviews, teacher job details, offered invitation terms and school application job details therefore display rich formatting without exposing raw tags. Payloads remain HTML strings in `description`; no new endpoint or body property is introduced. Job validation retains its 10,000-character serialized description limit, and application proposals retain their separate 2,000-character visible-text rule.

All authored React form dropdowns use the theme-token based `OptionDropdowns` control. Hover/selected/focus/menu/search states use the current SupplyEd accent and surfaces; warnings retain semantic warning colors. The school/teacher standalone HTML dropdowns now load `public/dropdown-theme.css` and `/theme-bootstrap.js`. That route and the root layout share `lib/theme-bootstrap.ts`. Native browser popup styling uses `appearance: base-select` where supported; older browser/OS picker chrome remains platform-controlled.

Theme presets remain database-driven. Preferences now persist under `supplyed_tweaks` with session fallback if browser storage is unavailable. Early bootstrap and interactive updates use the same derived color rules, including a readable dark tone for pale accents. The mobile handoff contains the exact tokens, algorithms, control measurements, interaction rules and current source snapshots.

### Authentication provider coverage and theme hydration

The dynamic public theme control calls `useDropdown("themeAccent")`, which uses TanStack Query. The shared `QueryProvider` must therefore surround it on authentication routes as well as public pages and the signed-in workspace. `app/(auth)/layout.tsx` now wraps login, signup and forgot-password children with the existing provider. The other route-group layouts retain their own providers. Do not fix this by removing the dynamic theme query, returning hardcoded presets, or constructing a new query client during every component render. The existing provider creates a stable client once per mount.

The reported `No QueryClient set, use QueryClientProvider to set one` happened because authentication pages rendered the new dynamic theme control outside a provider. A regression test now renders the real `PublicThemeControls` under the actual authentication layout and its real dropdown hook. Login, signup and forgot-password returned HTTP 200 in read-only checks. Login/signup initially render their normal client-loading shells; the HTTP checks alone do not prove browser hydration. The real-component regression test covers the missing query-context failure.

`lib/use-tweaks.ts` shares theme preferences through React's `useSyncExternalStore`. The server snapshot is the stable default; the client reads saved local preferences without overwriting them during hydration. Snapshot identity changes only when accent or urgent-banner preference changes. Same-page saves notify subscribed controls; storage events and returning focus re-read preferences. Public/auth theme controls and the signed-in shell use the same hook. Only user changes persist preferences; simply loading a screen does not write default values. Mobile should use its own observable local-preferences store and foreground refresh, preserving the same behavior rather than porting browser hooks.

## 3A. Exact UI and theme specification for mobile parity

This section describes the implemented website as of 19 October 2026. Use it with section 3's complete collection/field map. The source snapshots in Appendix G are part of this same file: a mobile coding agent does not need a second document to recover the dropdown/editor/theme behavior. Port the design tokens and behavior into native components; do not execute Next.js Server Actions in a mobile runtime.

### 3A.1 Shared architecture and which editor to use

There is one rich-text implementation: `components/molecules/ProposalEditor.tsx`. Application cover letters use it directly. `RoleDescriptionEditor.tsx` imports it and supplies a role-description label, placeholder, and job-specific limit. The role wrapper is used in the school job wizard when creating or editing a job and in the invitation dialog when creating a new private job. There is no separate job font/size/color configuration to maintain.

All three screens use these exact collection names:

| Control | Collection | Editor format | Empty/reset action |
| --- | --- | --- | --- |
| Font family | `proposalFontFamily` | `font` | SupplyEd Sans; remove explicit font formatting. |
| Font size | `proposalFontSize` | `size` | 16; remove explicit size formatting. |
| Text color | `proposalTextColor` | `color` | Default; remove explicit color formatting. |

The backend's `descriptionFontSize` collection is a historical compatibility collection. **Do not use it for the new mobile role editor** if reproducing current website behavior. An admin edit to a proposal formatting label/active option must be reflected in both cover-letter and role-description menus through the same data repository/cache.

The role editor's label is **Role description**, its accessible text-box name is **Role description**, and its placeholder is “Describe the class, cover expectations, timetable notes, support needs, and arrival instructions.” The invitation form's surrounding field label remains **Role details**. The cover-letter editor's accessible name is **Application proposal**, and its placeholder is “Introduce yourself, highlight relevant experience, and explain why you are a strong fit for this role.” Labels are UI copy, not payload field names.

### 3A.2 Rich-text controls, state and serialization

Toolbar order after the appearance dropdown row:

1. Bold, Italic, Underline.
2. Bullet list, Numbered list.
3. Add link, Clear formatting.

Selecting a formatting option applies it to the current selection or insertion point and returns focus to the editor. Cursor/selection changes update the appearance controls to match the text's current format. Mixed formats can show their default/reset label. The React menus sit outside Quill's toolbar DOM; native mobile should similarly avoid creating two competing control systems for the same rich-text selection.

The application editor uses Quill 2 and stores semantic HTML, not a Quill Delta or Markdown string. Compatible HTML includes paragraphs, line breaks, strong/bold, emphasis/italic, underline, ordered/unordered lists and list items, spans carrying permitted inline styles, and links. Do not introduce tables, images, video, arbitrary embeds or additional formats merely because the native rich-text library supports them.

For payloads:

```json
{
  "description": "<p><strong>Year 5 cover teacher</strong></p><ul><li>Deliver the planned lessons</li><li>Support inclusive learning</li></ul><p><span style=\"font-family: Georgia; font-size: 18px; color: #315ca8\">Please arrive at 08:15.</span></p>"
}
```

This fragment goes to the existing job `description` field. The same field belongs inside `newJob` when creating a job in an invitation. Existing application requests keep their `proposal` string. Do not add font, size, color or theme fields to job/application JSON: rich formatting is inside the HTML, and the personal UI accent belongs to preferences.

Job descriptions retain the existing client limit of 10,000 characters in editable serialized role content, including markup. Publishing through the school wizard also requires at least 20 visible text characters; draft content must not be empty. The wizard's generated posting-route/QTS/urgent metadata lines are separate from editable content and are stripped before the existing editable-content validation. Cover letters retain their independent **2,000 visible-character** rule. Do not accidentally apply the cover-letter limit to a job description, or count HTML tags as visible proposal text. Empty rich text such as `<p><br></p>` is empty, even though the string is nonempty.

The editor does not silently truncate pasted content. Existing form validation blocks invalid submission and keeps the text. Native should surface the applicable length/empty error before submitting and preserve the draft. Do not trim valid text from the middle to fit an HTML limit.

### 3A.3 Editing legacy jobs without corrupting them

The previous role-description field stored text with simple Markdown conventions. On editor load:

- `#`, `##` or `###` at the start of a line becomes a bold paragraph heading.
- Lines starting with `- ` or `* ` become bullet list items.
- `**bold text**` becomes `<strong>bold text</strong>`.
- Literal `&`, `<`, `>`, quotes and apostrophes in ordinary text are HTML-escaped.
- Existing supported HTML is passed through as the existing rich value; do not double-escape it.
- Initial editor parsing does **not** mark an untouched job as changed or submit a PATCH. Only a user edit calls the role wrapper's change callback.

The job wizard continues to remove its generated lines (`Posting route: ...`, urgent marker, QTS marker) from the editable description, then rebuild them in its existing save helper. Do not copy those lines into the user's rich-text paragraph. An invitation's new job does not need to invent wizard metadata lines.

### 3A.4 Safe rich-text reading and exact formatting support

HTML role descriptions in job review, teacher job details, invitation offered terms and school application job details use the same sanitized reader as cover letters (`ProposalContent`). Plain/Markdown descriptions keep the existing legacy block renderer. Never show the raw tags to the user, and never trust backend/user HTML as executable markup.

The reader permits these tags: `a`, `b`, `br`, `em`, `i`, `li`, `ol`, `p`, `span`, `strong`, `u`, `ul`. Only `href` and `style` enter the sanitizer; inline style is then rebuilt from supported font-family/font-size/color properties. Scripts, handlers, embeds, arbitrary CSS and unsupported attributes are removed. Links must use `http`, `https` or `mailto`; opened browser links receive `noopener noreferrer`.

Current supported renderer formats are listed below as **technical capabilities**, not menu fallback lists. Render the active menu choices from the API; keep support for previously saved permitted formatting even when an option is retired.

| Capability | Supported stored values |
| --- | --- |
| Font | Arial, Georgia, Times New Roman; absence uses the application's Inter/system sans-serif. |
| Size | 12px, 14px, 16px, 18px, 20px, 24px. |
| Text color | `#17211c`, `#227557`, `#315ca8`, `#7a4a9e`, `#a1483f`; browser `rgb(...)` equivalents normalize to these colors. |
| Links | http, https, mailto; bare valid website input receives https, a bare valid email becomes mailto. |

Text colors selected by the author remain part of their document; changing the viewer's UI accent must not recolor authored text. Menu backgrounds, arrows, focus rings and selected-option highlights use the UI theme. Database labels/activation do not extend a fixed renderer capability; unsupported new technical values require a coordinated backend/editor/reader change.

The Add a link panel displays Link text, Website or email address, Cancel and Apply; Remove appears for an existing selected link. Link text is disabled when editing a selected text range. Invalid URLs produce “Enter a valid website or email link.” Enter in a link input applies the link without submitting the outer form; Escape closes the panel and returns focus to the editor. Native should make its toolbar/link sheet obey the same draft-preserving behavior.

### 3A.5 Theme source, persistence and derivation

Theme preset labels and accent values come from `GET /api/dropdowns/themeAccent`. An empty/unavailable collection must not fabricate presets. The custom color picker remains available and does not create a backend dropdown option.

Theme preferences are stored locally under **`supplyed_tweaks`**:

```json
{ "accent": "#008CC4", "urgentBanner": true }
```

This is browser-local UI preference storage, not a REST endpoint or profile field. Native should use an app-local preferences store with the same conceptual fields and no bearer token. Preserve `urgentBanner` when changing only accent. There is no new theme-sync API. The browser keeps an in-memory fallback if storage is blocked or malformed. Three-digit custom hex input expands to six digits; invalid values fall back to Supply blue. Database theme accent values are six-digit hex.

The root layout applies the stored theme before hydration using `lib/theme-bootstrap.ts`. The standalone HTML forms load the same script from `/theme-bootstrap.js`. Interactive changes use `lib/theme.ts`; tests assert that both derive identical tokens. The public/auth theme controls and signed-in shell share `useTweaks`, backed by `useSyncExternalStore`. Its stable server snapshot provides consistent hydration markup; its client snapshot restores saved preferences and updates subscribers. The theme effect reads the client snapshot even during hydration, and only a user change saves preferences, so mounting a screen never overwrites the saved accent with the server default. The bootstrap responds to storage changes and page focus.

Use the exact derivation rather than assigning the chosen accent to every text/background role:

1. Parse the normalized six-digit hex into RGB channels in [0,255].
2. `tint = mix(accent, white, 0.90)` and `tint2 = mix(accent, white, 0.78)`.
3. Start the dark text tone by mixing accent toward black with weight 0.22.
4. Calculate WCAG relative luminance from rounded RGB channels. For normalized sRGB `c`, use `c / 12.92` when `c <= 0.04045`; otherwise `((c + 0.055) / 1.055)^2.4`. Luminance = `0.2126 R + 0.7152 G + 0.0722 B`.
5. While `(luminance(tint)+0.05)/(luminance(dark)+0.05) < 4.6`, increase black weight by 0.02 up to 1 and recompute dark.
6. Clamp/round every emitted RGB channel and serialize as hex. Preserve the user's accent itself; only derive darker readable text and tinted surfaces.

The JavaScript implementation is copied in Appendix G to eliminate rounding ambiguity. A custom very pale accent must still yield readable selected-option text. Do not use white text on the raw accent indiscriminately.

| Runtime token | Use |
| --- | --- |
| `--se` | Selected accent; outlines and active borders. |
| `--se-rgb` | Space-separated RGB channels for opacity effects. |
| `--se-dark` | Derived readable text/icon tone and solid selected indicator. |
| `--se-tint` | Selected/hovered option surface, chips, subtle theme background. |
| `--se-tint-2` | Stronger tint for borders and secondary accents. |
| `--focus-ring` | `0 0 0 3px rgb(var(--se-rgb) / 0.14)`. |

Default CSS values shown in the token snapshot are pre-bootstrap fallbacks; the derivation is authoritative after bootstrap. For the default `#008CC4`, derived dark is `#006d99`. Palette choices are data; historical example presets are not a reason to ship a native hardcoded option list.

### 3A.6 Neutral and semantic tokens

| Token | Website value | Role |
| --- | --- | --- |
| ink | `#15232d` | Main readable text. |
| graphite | `#2d3c48` | Labels/strong secondary text. |
| slate | `#50616e` | Secondary body text. |
| muted | `#5f707b` | Placeholder/help text. |
| border | `#e2e8ec` | Card/menu separators and subtle borders. |
| border-2 | `#cbd5dd` | Input/control border. |
| chalk | `#f5f7f9` | Page/background surface. |
| surface | `#ffffff` | Card, field and menu surface. |
| surface-2 | `#f8fafb` | Toolbar and secondary surfaces. |
| green / green-tint | `#168344` / `#f0fdf4` | Success. |
| amber / amber-tint | `#a96008` / `#fffbeb` | Warning/unavailable saved selection. |
| red / red-tint | `#cf1941` / `#fff1f2` | Error/destructive action. |
| purple / purple-tint | `#7c3aed` / `#f5f3ff` | Existing informational/status variant. |
| overlay | `rgba(15,23,35,0.45)` | Modal backdrop. |

Error/destructive/success/warning semantics deliberately keep their semantic colors across accent changes. A rejected application must not become visually indistinguishable from a harmless selected filter. Dropdown ordinary hover/selection is theme-accent based; loading text uses muted; retired selections use warning tokens. The previous fixed-blue subject/skill reconciliation notice now uses accent tint and dark accent text.

### 3A.7 Typography, spacing, radii and motion

- Primary website font: bundled Inter Variable, weights 100–900. Italic uses its matching variable font. Fallbacks: platform system sans-serif, Segoe UI, Arial. Headings also use Inter, default weight 600 and letter spacing -0.03em.
- Base body size: 15px; line-height 1.6. Native accessibility text scaling must remain supported; do not freeze all text in physical pixels.
- Radius tokens: small 6px, ordinary/card 10px, large 12px, extra-large 18px; controls use 9px; checkbox indicator uses 4px.
- Shared field minimum height: 46px; padding 11px vertically and 13px horizontally; 14px text; mobile form inputs use 16px at narrow widths to avoid browser zoom.
- Focus animation: 160ms, cubic-bezier(.2,.8,.2,1). Option-color transitions are 150ms. Respect reduced-motion preferences.
- Small control shadow: `0 1px 3px rgba(24,46,62,0.035)`.
- Card shadow: `0 4px 16px rgba(10,10,10,0.04), 0 1px 3px rgba(10,10,10,0.03)`.
- Menu/panel shadow: `0 16px 48px rgba(10,10,10,0.1), 0 2px 8px rgba(10,10,10,0.04)`.

Use CSS logical equivalents in a native design system, keeping the proportions and hierarchy. The CSS snapshots preserve every exact value needed for comparison. Color tokens should be named roles in native code, not duplicated hex literals in each screen.

### 3A.8 Dropdown anatomy and interaction states

All authored React single/multi/searchable form dropdowns reuse `OptionDropdowns`. `DynamicSelect` and `DynamicMultiSelect` supply API data and lifecycle notices; teaching subject/skill menus use the same visual control after relationship filtering.

Closed field:

- Full width, minimum 46px height, 9px corners, white surface, 1px border-2, 14px label.
- Text uses one-line ellipsis; the full summary is available as the title on web. The chevron is 16px with a 10px gap from content.
- Empty state uses the field placeholder and muted text. It is not a stored option.
- Selected/open state uses accent border, accent-tint background and ink text; chevron uses dark accent.
- Multi-select summary joins up to two labels, then shows `+N more`; a separate count badge shows the number of selected values. Count badge minimum width is 22px, 11px text, 20px line height and 6px corners.
- Invalid border uses red. The surrounding field keeps its associated error text and label. Disabled state prevents opening and uses the existing muted control styling; no replacement selection is made.

Opened menu:

- Surface background, ink text, 1px border, 10px corners, large panel shadow. Menu width matches the field subject to viewport margins.
- On web it uses the top layer with `popover="manual"` and fixed positioning, preserving its logical parent dialog/focus scope. It is not clipped by a card or modal's scrolling body.
- Gap from trigger: 6px; viewport margin: 8px; maximum height: 360px, reduced to available space. If below-space is under 260px and above-space is larger, open upward. Close when the trigger scrolls outside the viewport. Reposition for resize, scrolling, visual viewport changes and keyboard appearance.
- Search row: 10px vertical/13px horizontal padding, bottom border, search icon, borderless text input, minimum 28px input height, accent line on focus. Search text is 13px desktop and 16px mobile. Search runs locally against label and aliases, case-insensitively. Preserve API option order; group headings follow the supplied groups.
- Option list padding: 6px. Each option: minimum 44px height; 9px vertical/11px horizontal padding; 10px gap; 6px corners; 13px desktop/14px narrow-screen text; line-height 1.5. Wrap long labels within the menu instead of horizontal scrolling.
- Hover and selected backgrounds use accent tint; selected text uses dark accent. Active keyboard option has a 2px accent outline inset by 2px.
- Selection indicator: 16px circle for single select, 4px-radius square for multi. Unselected uses surface/border-2; selected uses dark accent with a surface-colored check.
- Optional option description appears beneath its label in 12px muted text. No matches shows “No options found.”
- Multi-select Clear selection footer appears when selections exist: top border, 6px outer padding, 40px minimum button height, 8px/11px button padding, 12px semibold dark-accent text and tint hover.

Selection behavior:

| Action | Single | Multiple |
| --- | --- | --- |
| Select row | Replace value, close, return focus to trigger. | Toggle that value; keep menu open. |
| Select while at maximum | Not applicable. | Do not add another value; existing choices remain removable. |
| Clear | Local empty option where provided. | Explicit Clear selection sends `[]`. |
| Open | Reset search; focus search when present; active row begins at selected/first appropriate option. | Same. |
| Close | Outside pointer/focus, Escape, or normal tab departure. | Same; Tab can reach the Clear selection footer first. |

Web accessibility/keyboard: visible label and error/help text are connected with IDs; trigger exposes combobox, expanded, has-popup, controls and active-descendant semantics; list is listbox, rows are options with selected state; multiple lists expose multiselectable. Arrow keys navigate, Home/End go to ends, Enter selects, Space selects outside a search input, Escape closes and restores focus. Typeahead accumulates within 700ms. Home/End while typing retain normal text-input cursor behavior. A hidden native select handles actual form values/required state where needed. Native should expose equivalent accessible roles, selection announcements, focus recovery and a clear dismiss action; a sheet is acceptable when it preserves these behaviors and theme.

### 3A.9 Async, empty, error and retired-choice UI

| State | Visible behavior | Data behavior |
| --- | --- | --- |
| Initial loading | Disabled control; “Loading choices…” status. Teaching fields say “Loading subjects and skills…”. | No fabricated seed choices; keep prefilled form state. |
| Ready, no options | “No choices are currently available.” | Empty list is real; do not select a made-up value. |
| Network/retired collection failure | “Choices are temporarily unavailable. Your entries have been kept.” and Try again. | Keep input, disable selection until successful retry. |
| Teaching read failure | Subjects/skills unavailable message with Try again and preserved other details. | Retry subject, skill and key-stage source queries. |
| Saved single value missing | Display the raw saved value with “This choice is no longer available; review before changing it.” | No automatic clearing/replacement. |
| Saved multi value missing | Warning row with value, “saved choice needs review,” Remove. | Explicit remove updates the array. |
| Submission rejected after admin edit | Existing form error plus fresh dropdown read. | Preserve all fields and allow explicit correction/resubmission. |

Reference requests share a 30-second stale cache and refetch on focus. Do not turn a transient read failure into logout or a silent empty list. Public collection failure is not evidence that the user lacks permission. Error codes and mobile refresh actions are specified in section 3.

### 3A.10 Subject/skill UI specifics

Subjects and skills are searchable multi-selects, limited to 50 actual values each. Subjects show category group labels and can be found using aliases. The skills menu combines current shared and linked skills, and uses the same labels/values distinction as every dropdown. The user chooses skills; opening a menu does not auto-select all skills.

When Other is selected, show a separate field below the corresponding menu. Existing custom names appear as removable pills: accent-tint background, rounded-full shape, 12px horizontal/4px vertical padding and 14px text. Below the pills, show a text input and Add button in one row. Placeholder examples are Astronomy / Telescope operation. Enter or Add validates and commits the chip. A nonempty uncommitted draft shows “Choose Add or press Enter to include this name before saving.” Do not silently submit an uncommitted input as a custom name.

Subject removal reconciles skills immediately. If any are removed, show an accent-tinted status message listing the removed names. Skills still supported by another selected subject remain. Stored unsupported named skills are shown with a Needs review indicator and explicit Remove action. Custom skills remain independent of selecting Other subjects. School staffing displays only subject/custom-subject fields; it never creates a school skills editor.

### 3A.11 Rich-text layout measurements

| Region | Desktop | Narrow screen (up to 640px) |
| --- | --- | --- |
| Editor outer shell | 1px border-2, 12px corners, surface background; accent border and 3px/10%-accent focus glow. Invalid border is red. | Same. |
| Appearance row | Grid: `minmax(160px,1.5fr) minmax(100px,1fr) minmax(130px,1fr)`; 12px padding/gap; surface-2 and bottom border. | Two equal columns, 8px gap; font family spans both columns, size/color share next row. |
| Formatting toolbar | Minimum 55px high; wrapping flex groups, 10px/12px padding; border separator; surface-2. | 9px/8px padding, 7px vertical gap. |
| Formatting buttons | 34×34px, 8px padding, 18px icon, 6px corners. | 30×34px, 6px padding. Native touch target may be expanded without changing the icon size. |
| Text area | Minimum 220px; maximum editor-scroll height 330px; 22px/24px padding; 16px text; line-height 1.75. | Minimum 210px; maximum 300px; 18px padding. |
| Placeholder | Muted, 14px, normal style, line-height 1.8. | 13px; same muted role. |
| Link panel | 17px/20px padding; accent tint; 13px semibold title; form inputs 40px high. | 16px padding; fields wrap. |

The toolbar uses the same accent for active, hovered and focused icons; Quill's default blue focus color is overridden. Reader links use dark accent and underline. The editor content's own font/color choices remain authored document content, distinct from theme styling.

### 3A.12 Screen placement and retained workflow

| Screen | Placement and behavior to reproduce |
| --- | --- |
| School/teacher waitlist | Shared themed fields beneath visible labels; school/teacher collection separation; changing audience resets audience-specific form state. Consent and required details remain. Teacher confirmation phases are API-backed checkboxes. |
| Teacher onboarding | Subject and dependent skill menus plus separate Other fields; key stages; UK country/city; currency. Saved profile then documents, with phone verification optional at document submission. |
| School onboarding | Institution type controls MAT/trust/signatory dependencies; location fields, cover types and subject-based staffing needs; school has no skills field. |
| Teacher settings | Saved subject/custom/skill fields round-trip; unrelated edits omit unchanged legacy values. Theme and field errors do not erase pending edits. |
| School settings | Same city/region/country and staffing selectors; cover types are the shared multi-select rather than comma-separated text. |
| Job wizard | Four steps: posting type, role details, requirements/listing, review. Role description is the shared rich editor in role details; review renders formatted text. Existing save-draft/publish behavior, double-submit protection and saved-job retry identity remain. |
| Edit job | Same role editor and selectors; preserve untouched listing dates, retired values and rich content; changing an existing expiry requires a replacement date. |
| Invitation dialog | Existing owned job radio cards OR a new private job, never both. New-job role details use the shared rich editor. Timezone remains Europe/London by default; dates serialize to ISO; description HTML nests under newJob. |
| Teacher job discovery | Recommended/all views remain; subject, stage and urgency filter controls use API values with local All choices. Exact custom subject search remains separate. |
| School teacher discovery | Stage/city/minimum-rating use API dropdowns; subject/skill filters remain scalar text. No invented multi-value filtering API. |
| Applications | Teacher status filters plus separate Invited view; school workflow excludes Interview and allows direct hire/reject under existing rules. Database labels do not change transition authority. |
| Bookings/billing | Status and invoice filters use data-backed labels/values; refund reason uses its collection; actions remain gated by account/payment state. |
| Public/workspace theme control | Fetch presets; selected preset has a visible ring and accessible pressed state; the workspace Tweaks panel also offers custom color; changing it updates all shared dropdown tokens immediately and persists locally. |
| Legacy standalone forms | Use the same saved accent via shared bootstrap, themed 44px-minimum native selects, themed retry button and live backend options. Modern browser `base-select` can theme the popup; older OS native popup chrome remains platform-controlled. |

Account/notification/navigation popovers use theme roles but their entries remain executable app actions or real entity data. Browser date/file/custom-color pickers and Stripe-managed payment menus are platform/provider surfaces, not dropdown reference collections; native should keep its corresponding platform/SDK controls. Do not replace status permissions with arbitrary admin-supplied menu actions.

### 3A.13 Dashboard and page-level visual references

The existing dashboard API/data behavior remains in sections 9–10. Appendix G includes the website's workspace, teacher-dashboard, account, waitlist and profile styles so a mobile agent can reproduce more than the field controls. Preserve the same information hierarchy and real counts/empty/error states rather than copying fixture values.

The teacher dashboard uses a maximum 1520px desktop content area, four metric cards with 16px gaps, and a two-column main layout (`minmax(0,1fr)` plus a 290–340px sidebar, 24px gap). Metric cards use 20px padding, 14px corners and subtle shadow. On native phones, stack the main sections and use a readable small-screen metric grid instead of shrinking the desktop layout. The next-placement panel has its own dark-blue visual treatment in the exact stylesheet; it is not an accent dropdown. Schedule rows and application progress retain their status meaning and actionable routes.

Use the supplied style snapshots for exact breakpoint, spacing and surface values. Native should preserve accessible touch sizes, safe-area insets and keyboard avoidance even when that requires a layout adaptation. Such adaptations must not change required fields, omitted values, status decisions or API payload identities.

### 3A.14 Mobile implementation sequence and parity checks

1. Implement a typed dropdown repository with public-envelope handling, per-name/revision cache, active option mapping and focus/foreground refresh. Add deterministic fake API fixtures for errors/retirement, not production fallback data.
2. Build a single themed accessible selection component for single/multi/search; expose label/value separately and support grouped choices, aliases, selected-summary truncation, clear/reset, max selections and retry.
3. Build shared subject/skill adapters plus Other chip fields; test overlapping relationships, subject removal, known aliases, Unicode custom names, deduplication and explicit clears.
4. Connect every collection in section 3's table to its existing screen/payload. Keep account-specific entities on their existing APIs.
5. Implement one rich-text component for proposals and descriptions, parameterized by label/placeholder/validation policy; use the same three formatting collections. Preserve the chosen library's selection when interacting with a toolbar/sheet.
6. Implement an HTML reader with the same allowlist and permitted styles, plus legacy text/Markdown import. Test create, save, reload, edit, preview and teacher-side read; verify no raw HTML is displayed and no untouched old job is rewritten just by opening it.
7. Implement theme-token derivation and local persistence, apply before initial visible content when possible, and retain semantic status colors. Verify a dark, pale and custom accent across every control state.
8. Check tablet/phone layouts, keyboard open, long city labels, long custom names, empty list, retired saved value, slow API, retry, validation error, screen-reader selection announcement and modal focus recovery.
9. Confirm job/application/invitation payloads are unchanged apart from intended teaching custom fields and HTML description content. Never POST a live job or invitation merely to test the UI without the user's authorization.

Acceptance examples: a renamed font label appears in both editors; a retired city remains readable on an old profile but cannot be newly chosen; changing theme colors an already open React option menu; a pale accent keeps selected text readable; custom skills survive profile and new-job reload; deleting all custom values sends explicit clears; opening an existing Markdown job does not dirty its form; bullets/links/colors survive a real save/read cycle in a test environment.


## 4. Registration, profile creation, documents, and phone verification

Teacher profile creation uses the authenticated user plus `fullName`, biography, UK location, experience, key stages, catalogue subjects/skills, optional rates and travel distance. The school flow captures organisation, domain, location, school/MAT type, cover types, catalogue staffing needs, compliance contact, safeguarding confirmation, and MAT signatory details where applicable. Backend DTOs in the appendices distinguish required and optional properties.

Use `GET /auth/me`, `GET /instructors/me` or `GET /institutions/me` to recover progress. Profile-review states are separate from job-application states. The web presents `none`, `pending_review`, `approved`, `rejected`, and `suspended`; translate backend profile states through the profile response contract, not the five job-application statuses.

Once the profile is created, previous onboarding steps lock and document requirements become the focus. School onboarding resumption does not require a nonempty optional staffing-needs selection. Missing or rejected required documents block submission; an uploaded document awaiting review is sufficient for the user's submission stage. Do not require administrators to approve each document before enabling Send for review.

### Document sequence

1. Fetch `GET /document-requirements/profile` for the user's profile context. Read requirement IDs, mandatory flags, document type, allowed MIME types, and maximum byte size. Do not assume every account always has exactly four requirements.
2. List owned documents with `GET /documents`, associating records by requirement ID.
3. Create a missing document record with `POST /documents` using the requirement/context fields in `CreateDocumentDto`. Reuse an existing record when replacing its file.
4. Request `POST /documents/:id/upload-url` with the file metadata defined in `CreateUploadUrlDto`.
5. Upload the actual bytes to the returned signed storage URL using its required method/headers. Do not JSON-encode bytes or send a filename in place of the file.
6. Only after storage success, call `POST /documents/:id/upload-complete` with the returned storage key/completion data. Use the confirmed document response to mark the requirement uploaded.
7. Preview via `GET /documents/:id/download-url`; refresh an expired URL instead of retaining it forever. Native viewers must treat unsupported/active document types as downloads.
8. Submit profile review with the relevant `PATCH /instructors/me/status` or `PATCH /institutions/me/status` endpoint, following its body-free contract.

Allow upload in box 2 while box 1 is uploading, and likewise for all other boxes. Maintain upload state, pending locks, progress, selected file, error, and retry per requirement ID. A single document box still holds one current file. Disable replacement only for that box while its upload is pending. Disable review until every required upload is confirmed and every in-flight upload has settled. A failed replacement must not be mistaken for a successfully stored replacement. Keep retry state local to the failed box.

The earlier web bug was at its upload transport boundary: a multipart submission was being misread, producing “Choose one file to upload” for valid selections. The bounded request reader now passes real bytes correctly. Mobile should implement the backend signed-upload sequence directly, not reproduce the website multipart wrapper.

### Phone verification

Phone input accepts national UK entry with a visible `+44` prefix and normalizes to E.164. Reject invalid or foreign numbers without truncating them into a valid-looking number. Six-digit codes must stay strings so leading zeroes survive.

- `POST /auth/phone/otp/send` body `{ "phone": "+447..." }`; honor returned challenge/cooldown fields.
- `POST /auth/phone/otp/verify` body `{ "otp": "012345" }`; do not submit phone and OTP as a stale combined challenge payload.
- Require the returned user state to confirm verification; refresh account/profile snapshots after success.
- Incorrect/expired code: show an accessible inline message such as “That code is incorrect or has expired. Check the code and try again, or request a new one.” Keep the field and retry action usable. Technical support references belong in diagnostics, not the primary OTP error.
- Phone verification remains available at the document step but is optional there. Do not make Send for review depend on `phoneVerified`. Entering a syntactically valid phone during earlier registration is a separate requirement.

Settings saves update `/users/me` and then the role profile. Those two writes are not atomic. If account details save but profile saving fails, say so; do not claim complete success. Preserve catalogue error codes even in this partial-save case. Unchanged legacy catalogue fields must not block unrelated profile changes.

## 5. Job posting, listing visibility, and discovery

Read public jobs with `GET /jobs`; school management uses `GET /jobs/mine` and `GET /jobs/mine/:id` so drafts and nonpublic jobs can still be edited. Public detail is `GET /jobs/:id`. Do not use a public 404 to conclude that an owned job no longer exists.

The four-step web wizard covers posting mode, role/location/pay/subjects/skills, key stages and listing details, then review. Mobile can adapt the layout while preserving validation and the review step. Jobs accept title, description, `subjects`, `requiredSkills`, key stages, optional experience, location/coordinates, work dates, pay, parking, and listing dates. See the DTO appendix for exact limits.

Creation first calls `POST /jobs`, which saves the job. Publishing then calls `PATCH /jobs/:id` with `{ "status": "ACTIVE" }`. Keep the created ID if activation fails; retry activation on that same ID. Block repeated taps while submitting. Do not create a new job merely because the activation response failed. If initial creation itself has an uncertain response and no returned ID, this workflow does not guarantee idempotency; reconcile owned jobs before offering a blind duplicate creation.

Updates send changed fields only. Jobs use `DRAFT`, `ACTIVE`, `SUSPENDED`, `CLOSED`, `EXPIRED`. Ordinary school UI may close or publish eligible jobs; suspension is not an ordinary school editing action.

### Dates

| Field | Meaning | Write format |
| --- | --- | --- |
| `startDate`, `endDate` | Actual classroom work | ISO timestamp with explicit timezone/UTC offset |
| `liveFrom` | Marketplace opening date | `YYYY-MM-DD`, interpreted as UK midnight |
| job `expiresAt` | Marketplace closing date | `YYYY-MM-DD`, includes the whole selected UK day |
| invitation `expiresAt` | Teacher response deadline | Precise ISO timestamp with timezone |

Use `Europe/London` for school calendar calculations, including BST/GMT. Do not convert a date-only listing field using the device timezone. Explicit timestamps remain exact instants. Reject nonexistent or ambiguous local work times unless the user supplies an unambiguous choice. Preserve untouched timestamp precision during edits. Clearing `liveFrom` sends `null`; clearing an existing listing expiry is unsupported in the current editor, so ask for a replacement date instead.

Display precedence: Suspended → Closed → Draft → expired status/elapsed expiry → future Live from (Scheduled) → Live. A scheduled ACTIVE job must not be advertised as immediately available. Same-calendar-day opening/expiry permits that whole UK day.

Search filters remain `subject=<one canonical subject>`, never `subjects=A,B`. The backend matches that subject anywhere in the job's subject array. Public listing does not accept a job status filter; owned listing does. Reset pagination when filters change. School teacher search uses canonical subject and skill choices with the directory API's existing scalar filter fields, plus location, key stage, availability, qualification, experience, rate, and rating filters.

## 6. Matching

- `GET /matching/jobs/recommended` — teacher's recommended jobs.
- `GET /matching/jobs/:jobId/instructors` — school's ranked teacher recommendations.
- `GET /matching/jobs/:jobId/applications` — ranked applicants for the school's job.

The matching endpoints accept their existing page, limit, and minimum-score query. Render the returned `score`, `distanceMiles`, `flags`, and each factor's `key`, `label`, `value`, `weight`, `applicable`, and `detail`. Do not recompute the score from local selections. The subject factor now describes overlap over all required job subjects (weight 25), and the skill factor uses catalogue skills (weight 15). Display explanations such as “1 of 2 subjects” exactly as supplied. Other factors and flags remain backend-owned.

Show unknown distance as unavailable, rather than zero miles. Show schedule conflicts and outside-travel-radius warnings. School staffing needs is a profile discovery preference, not a substitute for a job's subjects. Recommendation job cards must show all job subjects. Refresh recommendations after profile/selection changes, applications, hiring, invitation acceptance, and booking changes.

## 7. Applications, saved job titles, and direct decisions

`POST /applications` accepts `{ jobId, coverLetter? }`. The backend snapshots the canonical title into `jobName`; the client must not submit a fabricated title. The web's application history prioritizes that saved `jobName`, then a current job title when available, then a neutral unavailable title. A missing/expired public listing must not erase the application, proposal, status, or saved title.

The proposal is optional. Omit blank/empty rich text; nonblank formatted content must fit 2,000 characters. Validate what is actually submitted, not only its visible plain text. Render saved rich content through sanitization and a readable preview/full-reader flow. Preserve the complete proposal and scrollable dialog on small screens.

Application statuses are exactly `APPLIED`, `VIEWED`, `SHORTLISTED`, `HIRED`, `REJECTED`. Remove Interview from filters, labels, boards, types, status mapping, buttons, and transition checks. Opening an application does not itself submit Viewed.

| Current | Allowed forward actions |
| --- | --- |
| APPLIED | VIEWED, SHORTLISTED, HIRED, REJECTED |
| VIEWED | SHORTLISTED, HIRED, REJECTED |
| SHORTLISTED | HIRED, REJECTED |
| HIRED / REJECTED | Terminal in this workflow |

Send one `PATCH /applications/:id/status` with `{ status }` for the actual chosen destination. Do not manufacture intermediate transitions. Confirm hiring in the UI. The backend hire operation creates the booking and fills/closes the job transactionally; the client must not create a second booking. Rejection creates none. On conflict, refetch authoritative status and explain the outcome.

Read teacher history from `GET /applications/me`, school job applications from `GET /applications/job/:jobId`, details from `GET /applications/:id`, and paginated audit history from `GET /applications/:id/history`. Display old/new status, actor, and timestamp from the history response. Do not invent local audit events.

## 8. Job invitations and automatic school conversation

Sending an invitation is not an application hire. It invites the teacher to accept offered terms. Create with `POST /job-invitations`:

```json
{
  "requestId": "a-new-UUID-for-this-logical-request",
  "instructorId": "teacher-profile-UUID",
  "jobId": "existing-job-UUID",
  "message": "Optional personal message",
  "expiresAt": "2026-11-02T17:00:00Z"
}
```

Alternatively send `newJob` instead of `jobId`. Never both. New job payload includes title/description, zoned future start and end, positive pay and `payType`, optional location/listing dates, catalogue subjects and required skills, and other job fields. Do not supply status for the private new job. Listing `newJob.expiresAt` and top-level response `expiresAt` have different meanings.

Persist the request ID and exact payload before sending. Keep them across timeout, temporary server error, lost response, navigation, and app restart until outcome is reconciled. Retry the same logical request with the same identity; a corrected request after a definitive validation failure uses a new identity. A pending invitation does not reserve the teacher or position.

Existing job eligibility: DRAFT/ACTIVE, unexpired, future valid work dates, positive pay, supported pay type. A new job remains private pending response. Teacher decline may publish an eligible auto-created private job according to `publishOnDecline`; cancellation or expiry must not be assumed to publish it. The default response deadline is the earliest of seven days, job start, or listing expiry. A custom deadline cannot exceed the applicable boundaries.

After invitation creation, the current website orchestrates school messaging explicitly:

1. `POST /conversations` with `{ instructorId, jobId }` from the returned invitation.
2. Read recent messages with `GET /conversations/:id/messages?limit=100`.
3. If the same invitation announcement is not already present from the school, `POST /conversations/:id/messages` with a body identifying the job and invitation review link.
4. Open the resulting conversation. Example: `I've sent you a job invitation for “Physics cover”. Review and respond from Job invitations: /job-invitations/<id>`.

This is web orchestration, not a guarantee that `POST /job-invitations` alone sends chat. Mobile must implement the same sequence or use an explicitly agreed backend orchestration endpoint. If invitation succeeds but chat fails, report that precise partial outcome and retain the same retry identity. The current recent-message check reduces duplicate announcements but is not an atomic idempotent message API; concurrent senders could still duplicate an announcement. Never create another invitation just to retry chat.

Invitation reads: `GET /job-invitations/me` with page/limit/status; `GET /job-invitations/:id` for frozen offer details. Use `jobStatus` separately from the frozen job terms. Local display should expire PENDING when its deadline passes.

Teacher decisions: `POST /job-invitations/:id/accept` or `/decline`, without a body. School decision: `POST /job-invitations/:id/cancel`, without a body. Acceptance returns a booking; decline/cancel return invitation state. Only acceptance creates the booking. Acceptance retries recover the existing booking even if it has subsequently completed or been cancelled. Do not create a client-side application or booking alongside acceptance.

Deep links must open an invitation review screen and wait for an explicit decision. Preserve an allowed invitation destination through login, email verification, onboarding, and account approval. Do not auto-accept on GET, notification opening, or login. Reject external or malformed redirect destinations.

### Invited filters

The teacher Applications page has an **Invited** filter backed by the invitation API, separate from the five application statuses. It lists invitation cards using their frozen job snapshots, so a private/unavailable listing can still be reviewed. Mark associated application/job records with an Invited tag where applicable.

The school Applications job selector also has Invited and per-job invitation/pending counts. Collect all relevant invitation pages before treating those counts as complete. Do not send `status=INVITED` to `/applications`; no such application status exists.

## 9. Bookings, profiles, reviews, and dashboards

`GET /bookings/me` supports the backend booking filters for status, date range, job, pagination, and invoice state. Booking statuses are `CONFIRMED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`. Preserve job summary subjects, title, dates, agreed pay, school/teacher summaries, invoice and review information returned by the backend.

Booking actions use PATCH: `/bookings/:id/complete`, `/cancel`, `/no-show`. Cancellation requires a trimmed nonempty reason of at most 1,000 characters. Do not send a cancellation reason body to complete/no-show. Show only actions permitted for the role and current booking; backend authorization remains authoritative.

Create a review with `POST /reviews`, passing `bookingId`, an integer rating 1–5, and optional comment up to 2,000 characters. Public review lists use `/reviews/instructor/:id` and `/reviews/institution/:id`. Do not post fabricated review aggregates.

### Teacher dashboard

Use real account and profile data, all-page application summaries, confirmed upcoming/ongoing bookings, pending invitations, server recommendations, review aggregates, payout account/balance, conversations, and notifications. Failure in one section must not blank the whole dashboard or turn an unknown value into zero.

- Active applications count only APPLIED + VIEWED + SHORTLISTED; show Hired and Rejected separately in the progress summary.
- Next placement and schedule come from confirmed bookings, including ongoing multi-day work through the final UK school day.
- Upcoming / This week / This month use Europe/London calendar boundaries, not device-local dates.
- Invitations to review are pending and unexpired. Refresh them as time advances and on app foreground.
- Rating is the server aggregate plus actual review count; no fabricated default stars.
- Profile tasks reflect real missing information. They are guidance, not a fabricated approval percentage.
- Payout balances load only when the payout account is ready; distinguish unavailable data from an actual £0.
- Provide Refresh, Find work, applications, booking, invitation, messaging, and payout navigation.
- The web refreshes pending invitations/time-sensitive dashboard state around every 30 seconds while active, and refreshes queries on focus. Mobile may use foreground lifecycle equivalents.

### School dashboard

Use owned jobs/status counts, applicant totals, confirmed bookings, and pending invitations. Support page/filter navigation, edit, close, delete confirmation, review applications, invite, and view bookings. A job's first applicant page is not the total applicant population. Keep Scheduled/Live labels consistent across dashboard, job cards, application workspace, and details.

### My profile/history

The added My profile experience composes saved profile details, application history, bookings and received/given reviews. Website `/api/my-profile/...` routes are aggregation routes, not new backend endpoints. Mobile can compose the existing APIs and their pagination, or introduce a separately designed gateway. Handle unavailable current listings using saved application titles. Keep public profile links separate from the owner's editable/history view.

## 10. Messaging, notifications, payments, and account security

School-created conversations can use teacher, job, or application context as allowed by `StartConversationDto`. Teachers reply in authorized conversations. The invitation flow above starts the school conversation immediately; do not impose the earlier superseded “only after booking” rule.

Conversations: list, unread count, detail, messages, read acknowledgement, and signed attachment upload/download. The website uses one shared Socket.IO connection on namespace `/conversations`, path `/api/socket.io`, authenticated using a short-lived socket ticket from `POST /conversations/socket-ticket`. Get a fresh ticket on reconnect; fall back to periodic REST refresh when the socket is unavailable, and refetch missed data on reconnect. Do not infer connection health from configuration alone.

Notifications: `GET /notifications`, `/notifications/unread-count`, `/notifications/preferences`; `POST /notifications/:id/read`, `/notifications/read-all`; `PATCH /notifications/preferences`. Invitation notifications resolve to the invitation ID/review screen; ordinary job match notifications keep their job/discovery destination. Use server unread counts and mark-read outcomes, not guessed counters. Notification, conversation, and dashboard data refresh after related actions.

Payments: instructor payout account, account session, balance, instant payout, invoice lists/detail/payment session/sync, and role-specific administrative invoice actions. Currency amounts ending in `Pence` are integer minor units; do not submit displayed pounds as pence. Server/account eligibility determines available actions. Payment UI completion is not proof an invoice is paid: sync/reload the backend invoice. Web Stripe embedded/Connect components are browser-specific; choose supported mobile Stripe integration or an approved hosted flow while retaining the backend contracts. Never embed secret keys in a mobile app.

Account security retains password reset, email verification, Google sign-in, 2FA challenge/setup/enable/disable/recovery, phone verification, and session refresh. Use the exact auth DTOs below. Preserve OTP strings; do not truncate invalid codes and submit them. Honor role, profile approval, and authentication gates before protected screens. Invitation return links must survive these steps safely.

## 11. Cache invalidation after mutations

| Mutation | Refresh/reconcile |
| --- | --- |
| Teacher/school profile update | Account/profile, onboarding, discovery and matching data affected by selections |
| Catalogue validation error | Catalogue; retain form data and field context |
| Job create/edit/delete/publish/close | Owned/public jobs, details, application job lists/counts, matching |
| Application create/status change | Application detail/history/list, dashboards, matching |
| Application hire | Above plus bookings, jobs, invitations, invoices/payment views |
| Invitation create + chat | Invitations, jobs, conversations/unread, school/teacher dashboards |
| Invitation accept | Invitations, applications, bookings, jobs, matching, payment/dashboard data |
| Invitation decline/cancel | Invitations and jobs, including any publication change |
| Booking change | Bookings, schedule, matching, dashboard, relevant invoice data |
| Review | Booking reviews, public/profile ratings and review history |
| Successful payment/sync | Invoice, balances, bookings/payment summary |
| Phone verification | Account/profile/onboarding snapshots |

Treat this table as mobile dependency guidance. Inspect the included current web hook implementations for the exact web query keys; native applications should use their own cache infrastructure with equivalent dependencies.

## 12. Cross-cutting changes from the reviewed commits

The earlier commits also include changes that must inform mobile behavior even though their HTML/CSS cannot be copied directly:

- Consistent labelled controls, error descriptions, focus handling, disabled/loading buttons, keyboard support, modal boundaries, readable contrast, and responsive forms.
- Searchable selects and UK city/region lists. Country is GB, currency GBP where constrained. UK postcode/phone format validation does not prove an address exists.
- Form validation at both UI and server boundary for jobs, accounts, reviews, booking cancellation, directory queries, signatory actions, uploads, payment amounts, and public interest forms. Reject unknown query parameters instead of silently accepting typos.
- Upload byte limits and deadlines; no success before storage completion; sandboxed/attachment treatment of unsupported previews; separate profile-photo limit (5 MiB) from document requirement limits.
- Production backend configuration must be real; mock development fixtures must not become live data. Browser transport/session logic preserves refresh state through temporary outages and exposes useful request references.
- Founding interest pages and details validation, pending signup intent, role-aware onboarding prefill, and public navigation changes. Free-text founding-interest staffing context is not automatically a canonical catalogue selection; retain it for explicit review where carried into onboarding.
- Notification preference loading states, socket fallback, bounded pagination and independent dashboard errors.
- Deployment checks, Docker build-time socket configuration, health endpoint, production HTTP smoke fixtures, stylesheet imports, static page accessibility, sitemap/robots and authentication routing. These are website delivery changes; mobile should reproduce product behavior rather than Next.js infrastructure.

The appendix indexes every changed file across both reviewed commits and the current tree, including tests, audit evidence and generated/static assets, so infrastructure-only changes are not mistaken for new mobile API requirements.

## 13. Mobile implementation order and acceptance cases

Implement transport/auth and typed decoding first; then catalogue + reusable selectors; then profile creation/settings and documents; then job creation/discovery/matching; then applications/decisions/history; then invitation idempotency/chat/deep links; then dashboards/history/notifications/payments.

Test at least these scenarios against a migrated test backend:

1. Catalogue loading, offline retry, alias search, multiple categories, duplicate prevention, 50-value limit, empty selection, version refresh after rejection.
2. Remove one of two subjects: shared/overlapping skills survive and unsupported skills are visibly removed. Submit the pair and reload it.
3. Open saved custom subjects or a legacy staffing sentence; restore Other plus whole custom chips for review. Save an unrelated setting without selection fields. Replace or remove those values explicitly and reload.
4. Create/edit/clear a multi-subject job. No scalar `subject` write. A search for its second subject finds it. Old scalar-only job responses still display.
5. Match score and factor explanations match the server exactly; no client algorithm changes ranking.
6. Upload four requirements concurrently, fail/retry one, replace one, and enable review only after confirmations. Submit while phone is unverified. Wrong OTP shows friendly inline recovery.
7. Publish immediately, schedule a future listing, use same-day opening/expiry, cross a UK DST boundary, preserve exact untouched dates, retry failed activation without another job.
8. Apply with blank or formatted proposal; keep jobName after listing expiry/removal. Direct Applied → Hired and Applied → Rejected each send one request. No Interview anywhere.
9. Invite using existing/new job. Kill/reopen app after uncertain send and retry the saved identity. Recover chat separately after invitation success. No booking before accept.
10. Accept/decline/cancel, expired deadline, job closed meanwhile, concurrent acceptance/hire conflict, and acceptance retry after booking status changes.
11. Invited filter works for teacher and school using actual invitations, including private jobs and more than one API page.
12. Invitation notification/deep link survives login/onboarding and never accepts automatically. Teacher can reply in the school-started conversation.
13. Dashboard real-data counts, ongoing work, timezone filters, partial API failure, empty state, unread updates and payout readiness all match their detail pages.
14. Select Other alone and with named subjects in teacher, school, job and invitation forms. Check Unicode, duplicate names, known aliases, missing/overlong/control-character names, combined limits, shared skills, reload, removal with an explicit empty custom array, and exact saved-name filtering. Confirm response arrays contain actual names and no separate otherSubjects field.
15. Reject malformed pagination/query fields and unauthorized IDs. Reset caches on logout/account switch. No credentials, signed URLs, or OTPs in logs.

## 14. Verification status

Verification results for this web change are recorded at the end of this file after the source-reference appendices. Automated local checks are distinct from live-backend/mobile acceptance. Backend migration/deployment and real-device testing remain environment rollout work.

<!-- GENERATED_REFERENCE_APPENDICES -->

## Appendix A. Backend endpoint inventory

Extracted from the current read-only backend controllers. Paths below include the backend global `/api` prefix. Role names are decorator values, not inferred from screen visibility. “Controller/service policy” means that this method has no method-level role decorator; it does not promise anonymous access. Admin-only routes are reference context and are not teacher/school permissions. `direct-hire` is a compatibility route; the current web uses `job-invitations`.

### /api/applications

Source: `src/modules/applications/applications.controller.ts`.

| Method and path | Roles/policy | Request DTOs | Operation / response contract |
| --- | --- | --- | --- |
| `POST /api/applications` | INSTRUCTOR | CreateApplicationDto | Application submitted successfully |
| `GET /api/applications/me` | INSTRUCTOR | ListApplicationsQueryDto | Applications fetched successfully |
| `GET /api/applications/job/:jobId` | INSTITUTION, ADMIN | ListApplicationsQueryDto | Applications fetched successfully |
| `GET /api/applications/instructor/:instructorId` | Controller/service policy | ListApplicationsQueryDto | Applications fetched successfully |
| `GET /api/applications/:id` | Controller/service policy | No DTO declared here | Application fetched successfully |
| `GET /api/applications/:id/history` | Controller/service policy | PaginationQueryDto | Application history fetched successfully; Promise<PaginatedApplicationHistoryResponseDto> |
| `PATCH /api/applications/:id/status` | INSTITUTION, ADMIN | UpdateApplicationStatusDto | Application status updated successfully |

### /api/auth

Source: `src/modules/auth/auth.controller.ts`.

| Method and path | Roles/policy | Request DTOs | Operation / response contract |
| --- | --- | --- | --- |
| `POST /api/auth/login` | Controller/service policy | LoginDto | User logged in successfully |
| `POST /api/auth/oauth/google` | Controller/service policy | GoogleLoginDto | User logged in with Google successfully |
| `POST /api/auth/register` | Controller/service policy | RegisterDto | User registered successfully and verification code sent |
| `POST /api/auth/refresh` | Controller/service policy | RefreshTokenDto | Tokens refreshed successfully |
| `POST /api/auth/email/otp/resend` | Controller/service policy | ResendEmailOtpDto | Verification code sent successfully |
| `POST /api/auth/email/otp/verify` | Controller/service policy | VerifyEmailOtpDto | Email verified successfully |
| `POST /api/auth/password/forgot` | Controller/service policy | ForgotPasswordDto | Password reset code sent successfully |
| `POST /api/auth/password/reset` | Controller/service policy | ResetPasswordDto | Password reset successfully |
| `POST /api/auth/2fa/verify` | Controller/service policy | VerifyTwoFactorDto | Two-factor authentication verified successfully |
| `GET /api/auth/me` | Controller/service policy | No DTO declared here | Authenticated user fetched successfully |

### /api/bookings

Source: `src/modules/bookings/bookings.controller.ts`.

| Method and path | Roles/policy | Request DTOs | Operation / response contract |
| --- | --- | --- | --- |
| `GET /api/bookings/me` | INSTRUCTOR, INSTITUTION | ListBookingsQueryDto | Bookings fetched successfully |
| `GET /api/bookings` | ADMIN | AdminListBookingsQueryDto | Bookings fetched successfully |
| `GET /api/bookings/:id` | Controller/service policy | No DTO declared here | Booking fetched successfully |
| `PATCH /api/bookings/:id/complete` | INSTITUTION, ADMIN | No DTO declared here | Booking completed successfully |
| `PATCH /api/bookings/:id/no-show` | INSTITUTION, ADMIN | No DTO declared here | Booking marked as a no-show |
| `PATCH /api/bookings/:id/cancel` | INSTRUCTOR, INSTITUTION, ADMIN | CancelBookingDto | Booking cancelled successfully; PaginatedBookingsResponseDto |

### /api/bookings

Source: `src/modules/bookings/direct-hire.controller.ts`.

| Method and path | Roles/policy | Request DTOs | Operation / response contract |
| --- | --- | --- | --- |
| `POST /api/bookings/direct-hire` | INSTITUTION | DirectHireDto | Job invitation sent |

### /api/job-invitations

Source: `src/modules/bookings/job-invitations.controller.ts`.

| Method and path | Roles/policy | Request DTOs | Operation / response contract |
| --- | --- | --- | --- |
| `POST /api/job-invitations` | INSTITUTION | DirectHireDto | Job invitation sent |
| `GET /api/job-invitations/me` | INSTITUTION, INSTRUCTOR | ListJobInvitationsDto | Job invitations fetched successfully |
| `GET /api/job-invitations/:id` | INSTITUTION, INSTRUCTOR | No DTO declared here | Job invitation fetched successfully |
| `POST /api/job-invitations/:id/accept` | INSTRUCTOR | No DTO declared here | Invitation accepted and booking confirmed |
| `POST /api/job-invitations/:id/decline` | INSTRUCTOR | No DTO declared here | Invitation declined |
| `POST /api/job-invitations/:id/cancel` | INSTITUTION | No DTO declared here | Invitation cancelled |

### /api/contact

Source: `src/modules/contact/contact.controller.ts`.

| Method and path | Roles/policy | Request DTOs | Operation / response contract |
| --- | --- | --- | --- |
| `POST /api/contact/register-interest` | Controller/service policy | RegisterInterestDto | Register interest email sent successfully |
| `POST /api/contact/founding-interest` | Controller/service policy | CreateFoundingInterestDto | Founding interest captured successfully |
| `PATCH /api/contact/founding-interest/:id/details` | Controller/service policy | UpdateWaitlistDetailsDto | Waitlist details saved successfully |
| `GET /api/contact/founding-interest/all` | ADMIN | No DTO declared here | All founding interest submissions fetched successfully |
| `GET /api/contact/founding-interest` | ADMIN | ListFoundingInterestQueryDto | Founding interest submissions fetched successfully |
| `PATCH /api/contact/founding-interest/:id/status` | ADMIN | UpdateFoundingInterestStatusDto | Founding interest status updated successfully |

### /api/conversations

Source: `src/modules/conversations/conversations.controller.ts`.

| Method and path | Roles/policy | Request DTOs | Operation / response contract |
| --- | --- | --- | --- |
| `POST /api/conversations` | INSTITUTION | StartConversationDto | Conversation opened |
| `GET /api/conversations` | INSTRUCTOR, INSTITUTION | ListConversationsQueryDto | Conversations fetched successfully |
| `GET /api/conversations/unread-count` | INSTRUCTOR, INSTITUTION | No DTO declared here | Unread count fetched successfully |
| `POST /api/conversations/socket-ticket` | INSTRUCTOR, INSTITUTION | No DTO declared here | Socket ticket issued |
| `GET /api/conversations/application/:applicationId` | Controller/service policy | No DTO declared here | Conversation opened |
| `GET /api/conversations/job/:jobId` | ADMIN | ListConversationsQueryDto | Job conversations fetched successfully |
| `GET /api/conversations/:id` | Controller/service policy | No DTO declared here | Conversation fetched successfully |
| `GET /api/conversations/:id/messages` | Controller/service policy | ListMessagesQueryDto | Messages fetched successfully |
| `POST /api/conversations/:id/messages` | INSTRUCTOR, INSTITUTION | SendMessageDto | Message sent |
| `POST /api/conversations/:id/read` | Controller/service policy | No DTO declared here | Conversation marked read |
| `POST /api/conversations/:id/attachments` | INSTRUCTOR, INSTITUTION | CreateAttachmentDto | Upload link created |
| `GET /api/conversations/:id/attachments/:attachmentId/download-url` | Controller/service policy | No DTO declared here | Download link created |

### /api/document-requirements

Source: `src/modules/document-requirements/document-requirements.controller.ts`.

| Method and path | Roles/policy | Request DTOs | Operation / response contract |
| --- | --- | --- | --- |
| `POST /api/document-requirements` | ADMIN | CreateDocumentRequirementDto | Document requirement created successfully; Promise<DocumentRequirementResponseDto> |
| `GET /api/document-requirements` | ADMIN | No DTO declared here | Document requirements fetched successfully; Promise<DocumentRequirementResponseDto[]> |
| `GET /api/document-requirements/profile` | INSTRUCTOR, INSTITUTION | No DTO declared here | Document requirements fetched successfully; Promise<ProfileDocumentRequirementResponseDto[]> |
| `GET /api/document-requirements/:id` | ADMIN | No DTO declared here | Document requirement fetched successfully; Promise<DocumentRequirementResponseDto> |
| `PATCH /api/document-requirements/:id` | ADMIN | UpdateDocumentRequirementDto | Document requirement updated successfully; Promise<DocumentRequirementResponseDto> |
| `DELETE /api/document-requirements/:id` | ADMIN | No DTO declared here | Document requirement deleted successfully; Promise<DocumentRequirementResponseDto> |

### /api/document-reviews

Source: `src/modules/document-reviews/document-reviews.controller.ts`.

| Method and path | Roles/policy | Request DTOs | Operation / response contract |
| --- | --- | --- | --- |
| `GET /api/document-reviews` | ADMIN | ListDocumentReviewsQueryDto | Document reviews fetched successfully; Promise<DocumentReviewResponseDto[]> |
| `GET /api/document-reviews/:id` | ADMIN | No DTO declared here | Document review fetched successfully; Promise<DocumentReviewResponseDto> |

### /api/document-types

Source: `src/modules/document-types/document-types.controller.ts`.

| Method and path | Roles/policy | Request DTOs | Operation / response contract |
| --- | --- | --- | --- |
| `POST /api/document-types` | ADMIN | CreateDocumentTypeDto | Document type created successfully; Promise<DocumentTypeResponseDto> |
| `GET /api/document-types` | ADMIN | No DTO declared here | Document types fetched successfully; Promise<DocumentTypeResponseDto[]> |
| `GET /api/document-types/:id` | ADMIN | No DTO declared here | Document type fetched successfully; Promise<DocumentTypeResponseDto> |
| `PATCH /api/document-types/:id` | ADMIN | UpdateDocumentTypeDto | Document type updated successfully; Promise<DocumentTypeResponseDto> |
| `DELETE /api/document-types/:id` | ADMIN | No DTO declared here | Document type deleted successfully; Promise<DocumentTypeResponseDto> |

### /api/documents

Source: `src/modules/documents/documents.controller.ts`.

| Method and path | Roles/policy | Request DTOs | Operation / response contract |
| --- | --- | --- | --- |
| `POST /api/documents` | INSTRUCTOR, INSTITUTION | CreateDocumentDto | Document created successfully; Promise<DocumentResponseDto> |
| `GET /api/documents` | INSTRUCTOR, INSTITUTION | ListDocumentsQueryDto | Documents fetched successfully; Promise<PaginatedDocumentsResponseDto> |
| `GET /api/documents/admin` | ADMIN | ListDocumentsQueryDto | Documents fetched successfully; Promise<PaginatedDocumentsResponseDto> |
| `GET /api/documents/admin/:id` | ADMIN | No DTO declared here | Document fetched successfully; Promise<DocumentResponseDto> |
| `GET /api/documents/admin/:id/download-url` | ADMIN | No DTO declared here | Download URL created successfully; Promise<DownloadUrlResponseDto> |
| `POST /api/documents/admin/:id/review` | ADMIN | ReviewDocumentDto | Document reviewed successfully; Promise<DocumentResponseDto> |
| `POST /api/documents/:id/upload-url` | INSTRUCTOR, INSTITUTION | CreateUploadUrlDto | Upload URL created successfully; Promise<UploadUrlResponseDto> |
| `POST /api/documents/:id/upload-complete` | INSTRUCTOR, INSTITUTION | CompleteUploadDto | Document file uploaded successfully; Promise<DocumentResponseDto> |
| `GET /api/documents/:id/download-url` | INSTRUCTOR, INSTITUTION | No DTO declared here | Download URL created successfully; Promise<DownloadUrlResponseDto> |
| `PATCH /api/documents/:id` | INSTRUCTOR, INSTITUTION | UpdateDocumentDto | Document updated successfully; Promise<DocumentResponseDto> |
| `DELETE /api/documents/admin/:id` | ADMIN | No DTO declared here | Document deleted successfully; Promise<DocumentResponseDto> |

### /api/health

Source: `src/modules/health/health.controller.ts`.

| Method and path | Roles/policy | Request DTOs | Operation / response contract |
| --- | --- | --- | --- |
| `GET /api/health` | Controller/service policy | No DTO declared here | See controller and DTO reference |

### /api/institutions

Source: `src/modules/institutions/institutions.controller.ts`.

| Method and path | Roles/policy | Request DTOs | Operation / response contract |
| --- | --- | --- | --- |
| `POST /api/institutions` | ADMIN | CreateInstitutionDto | Institution profiles fetched successfully |
| `GET /api/institutions` | INSTITUTION | ListProfilesQueryDto | Institution profile fetched successfully |
| `GET /api/institutions/me` | INSTRUCTOR, INSTITUTION, ADMIN | No DTO declared here | Institution profile fetched successfully |
| `GET /api/institutions/profile/:id` | INSTITUTION | No DTO declared here | Institution profile status updated successfully; Promise<InstitutionPublicProfileDto> |
| `PATCH /api/institutions/me/status` | ADMIN | No DTO declared here | Institution profile status updated successfully |
| `PATCH /api/institutions/admin/:id/status` | ADMIN | AdminUpdateProfileStatusDto | Institution profile fetched successfully |
| `GET /api/institutions/:id` | ADMIN, INSTITUTION | No DTO declared here | Institution profile updated successfully |
| `PATCH /api/institutions/:id` | ADMIN | UpdateInstitutionDto | Institution profile deleted successfully |
| `DELETE /api/institutions/:id` | Controller/service policy | No DTO declared here | See controller and DTO reference |

### /api/instructors

Source: `src/modules/instructors/instructors.controller.ts`.

| Method and path | Roles/policy | Request DTOs | Operation / response contract |
| --- | --- | --- | --- |
| `POST /api/instructors` | ADMIN | CreateInstructorDto | See controller and DTO reference |
| `GET /api/instructors` | INSTRUCTOR | ListProfilesQueryDto | See controller and DTO reference |
| `GET /api/instructors/me` | INSTITUTION | No DTO declared here | Instructor directory fetched successfully |
| `GET /api/instructors/directory` | INSTRUCTOR | ListInstructorDirectoryQueryDto | Instructor profile status updated successfully |
| `PATCH /api/instructors/me/status` | INSTRUCTOR, INSTITUTION, ADMIN | No DTO declared here | See controller and DTO reference |
| `GET /api/instructors/profile/:id` | INSTRUCTOR, ADMIN | No DTO declared here | ; Promise<InstructorPublicProfileDto> |
| `GET /api/instructors/:id` | Controller/service policy | No DTO declared here | See controller and DTO reference |
| `PATCH /api/instructors/:id` | ADMIN | UpdateInstructorDto | See controller and DTO reference |
| `PATCH /api/instructors/admin/:id` | ADMIN | AdminUpdateInstructorDto | See controller and DTO reference |
| `DELETE /api/instructors/:id` | Controller/service policy | No DTO declared here | ; Promise<void> |

### /api/jobs

Source: `src/modules/jobs/jobs.controller.ts`.

| Method and path | Roles/policy | Request DTOs | Operation / response contract |
| --- | --- | --- | --- |
| `POST /api/jobs` | INSTITUTION, ADMIN | CreateJobDto | Job created successfully |
| `GET /api/jobs` | Controller/service policy | SearchJobsQueryDto | Jobs fetched successfully |
| `GET /api/jobs/mine` | INSTITUTION, ADMIN | ListMyJobsQueryDto | Jobs fetched successfully |
| `GET /api/jobs/mine/:id` | INSTITUTION, ADMIN | No DTO declared here | Job fetched successfully |
| `GET /api/jobs/:id` | Controller/service policy | No DTO declared here | Job fetched successfully |
| `GET /api/jobs/admin/all` | ADMIN | ListJobsQueryDto | Jobs fetched successfully |
| `GET /api/jobs/institution/:institutionId` | Controller/service policy | SearchJobsQueryDto | Jobs fetched successfully |
| `PATCH /api/jobs/:id` | INSTITUTION, ADMIN | UpdateJobDto | Job updated successfully |
| `DELETE /api/jobs/:id` | INSTITUTION, ADMIN | No DTO declared here | Job deleted successfully |

### /api/matching

Source: `src/modules/matching/matching.controller.ts`.

| Method and path | Roles/policy | Request DTOs | Operation / response contract |
| --- | --- | --- | --- |
| `GET /api/matching/jobs/recommended` | INSTRUCTOR | MatchListQueryDto | Recommended jobs fetched successfully |
| `GET /api/matching/jobs/:jobId/applications` | INSTITUTION, ADMIN | MatchListQueryDto | Ranked applications fetched successfully |
| `GET /api/matching/jobs/:jobId/instructors` | INSTITUTION, ADMIN | MatchListQueryDto | Recommended instructors fetched successfully |
| `GET /api/matching/jobs/:jobId/score` | INSTRUCTOR | No DTO declared here | Match score fetched successfully |

### /api/notifications

Source: `src/modules/notifications/notifications.controller.ts`.

| Method and path | Roles/policy | Request DTOs | Operation / response contract |
| --- | --- | --- | --- |
| `GET /api/notifications` | Controller/service policy | ListNotificationsQueryDto | Notifications fetched successfully |
| `GET /api/notifications/unread-count` | Controller/service policy | No DTO declared here | Unread count fetched successfully |
| `POST /api/notifications/read-all` | Controller/service policy | No DTO declared here | Notifications marked as read |
| `GET /api/notifications/preferences` | Controller/service policy | No DTO declared here | Notification settings fetched successfully |
| `PATCH /api/notifications/preferences` | Controller/service policy | UpdateNotificationPreferencesDto | Notification settings saved |
| `POST /api/notifications/:id/read` | Controller/service policy | No DTO declared here | Notification marked as read |

### /api/payments

Source: `src/modules/payments/payments.controller.ts`.

| Method and path | Roles/policy | Request DTOs | Operation / response contract |
| --- | --- | --- | --- |
| `GET /api/payments/payout-account/balance` | INSTRUCTOR | No DTO declared here | Balance fetched successfully |
| `POST /api/payments/payout-account/instant-payout` | INSTRUCTOR | InstantPayoutDto | Withdrawal on its way |
| `GET /api/payments/payout-account` | INSTRUCTOR | No DTO declared here | Payout account fetched successfully |
| `POST /api/payments/payout-account/session` | INSTRUCTOR | No DTO declared here | Payouts session created; Promise<PayoutSessionResponseDto> |
| `POST /api/payments/payout-account/onboarding-link` | INSTRUCTOR | No DTO declared here | Onboarding link created |
| `POST /api/payments/payout-account/dashboard-link` | INSTRUCTOR | No DTO declared here | Dashboard link created |
| `GET /api/payments/payout-accounts/instructor/:instructorId` | ADMIN | No DTO declared here | Payout account fetched successfully |

### /api/payments/webhooks

Source: `src/modules/payments/payments.controller.ts`.

| Method and path | Roles/policy | Request DTOs | Operation / response contract |
| --- | --- | --- | --- |
| `POST /api/payments/webhooks/stripe` | Controller/service policy | No DTO declared here | See controller and DTO reference |

### /api/invoices

Source: `src/modules/payments/payments.controller.ts`.

| Method and path | Roles/policy | Request DTOs | Operation / response contract |
| --- | --- | --- | --- |
| `POST /api/invoices` | INSTITUTION, ADMIN | CreateInvoiceDto | Invoice created and sent |
| `GET /api/invoices/me` | INSTRUCTOR, INSTITUTION | ListMyInvoicesQueryDto | Invoices fetched successfully |
| `GET /api/invoices` | ADMIN | AdminListInvoicesQueryDto | Invoices fetched successfully |
| `GET /api/invoices/job/:jobId` | ADMIN | JobInvoicesQueryDto | Job payments fetched successfully |
| `GET /api/invoices/:id` | Controller/service policy | No DTO declared here | Invoice fetched successfully |
| `POST /api/invoices/:id/payment-session` | INSTITUTION | No DTO declared here | Payment session created; Promise<InvoicePaymentSessionResponseDto> |
| `POST /api/invoices/:id/sync` | Controller/service policy | No DTO declared here | Invoice status refreshed |
| `POST /api/invoices/:id/send` | INSTITUTION, ADMIN | No DTO declared here | Invoice sent |
| `POST /api/invoices/:id/void` | ADMIN | No DTO declared here | Invoice voided |
| `POST /api/invoices/:id/refund` | ADMIN | RefundInvoiceDto | Refund issued; PaginatedInvoicesResponseDto |

### /api/auth/phone/otp

Source: `src/modules/phone-verification/phone-verification.controller.ts`.

| Method and path | Roles/policy | Request DTOs | Operation / response contract |
| --- | --- | --- | --- |
| `POST /api/auth/phone/otp/send` | Controller/service policy | SendPhoneOtpDto | Verification code sent successfully |
| `POST /api/auth/phone/otp/verify` | Controller/service policy | VerifyPhoneOtpDto | Phone verified successfully |

### /api/reviews

Source: `src/modules/reviews/reviews.controller.ts`.

| Method and path | Roles/policy | Request DTOs | Operation / response contract |
| --- | --- | --- | --- |
| `POST /api/reviews` | INSTRUCTOR, INSTITUTION | CreateReviewDto | Review submitted successfully |
| `GET /api/reviews/instructor/:instructorId` | Controller/service policy | ListReviewsQueryDto | Reviews fetched successfully |
| `GET /api/reviews/institution/:institutionId` | Controller/service policy | ListReviewsQueryDto | Reviews fetched successfully |
| `DELETE /api/reviews/:id` | ADMIN | No DTO declared here | Review deleted successfully; PaginatedReviewsResponseDto |

### /api/institutions/me/signatory-approval

Source: `src/modules/signatory-approvals/signatory-approvals.controller.ts`.

| Method and path | Roles/policy | Request DTOs | Operation / response contract |
| --- | --- | --- | --- |
| `POST /api/institutions/me/signatory-approval` | INSTITUTION | RequestSignatoryApprovalDto | Signatory approval request sent |
| `GET /api/institutions/me/signatory-approval` | INSTITUTION | No DTO declared here | Signatory approval fetched successfully |

### /api/signatory-approvals

Source: `src/modules/signatory-approvals/signatory-approvals.controller.ts`.

| Method and path | Roles/policy | Request DTOs | Operation / response contract |
| --- | --- | --- | --- |
| `GET /api/signatory-approvals/token/:token` | Controller/service policy | No DTO declared here | Approval request fetched successfully |
| `POST /api/signatory-approvals/token/:token/approve` | Controller/service policy | ApproveSignatoryRequestDto | School approved |
| `POST /api/signatory-approvals/token/:token/decline` | Controller/service policy | DeclineSignatoryRequestDto | Request declined |
| `GET /api/signatory-approvals` | ADMIN | ListSignatoryApprovalsQueryDto | Signatory approvals fetched successfully; Promise<PaginatedSignatoryApprovalsResponseDto> |
| `POST /api/signatory-approvals/:id/override-approve` | ADMIN | No DTO declared here | Signatory approval recorded; DecisionContext |

### /api/auth/2fa

Source: `src/modules/two-factor/two-factor.controller.ts`.

| Method and path | Roles/policy | Request DTOs | Operation / response contract |
| --- | --- | --- | --- |
| `POST /api/auth/2fa/setup` | Controller/service policy | No DTO declared here | Two-factor authentication setup created successfully |
| `POST /api/auth/2fa/enable` | Controller/service policy | EnableTwoFactorDto | Two-factor authentication enabled successfully |
| `GET /api/auth/2fa/status` | Controller/service policy | No DTO declared here | Two-factor authentication status fetched successfully |
| `POST /api/auth/2fa/disable` | Controller/service policy | VerifyTwoFactorDto | Two-factor authentication disabled successfully |
| `POST /api/auth/2fa/admin/:userId/disable` | ADMIN | No DTO declared here | Two-factor authentication disabled by admin successfully |
| `POST /api/auth/2fa/recovery-codes` | Controller/service policy | VerifyTwoFactorDto | Two-factor recovery codes regenerated successfully |

### /api/users

Source: `src/modules/users/users.controller.ts`.

| Method and path | Roles/policy | Request DTOs | Operation / response contract |
| --- | --- | --- | --- |
| `POST /api/users/me/profile-image/upload-url` | INSTRUCTOR, INSTITUTION | ProfileImageUploadUrlDto | Profile image upload URL created successfully |
| `POST /api/users/me/profile-image/upload-complete` | INSTRUCTOR, INSTITUTION | CompleteProfileImageUploadDto | Profile image updated successfully; Promise<ProfileImageResponseDto> |
| `GET /api/users/me/profile-image` | INSTRUCTOR, INSTITUTION | No DTO declared here | Profile image fetched successfully; Promise<ProfileImageResponseDto> |
| `POST /api/users/admin` | ADMIN | AdminCreateUserDto | User created successfully |
| `GET /api/users` | ADMIN | ListUsersQueryDto | Users fetched successfully |
| `GET /api/users/:id` | Controller/service policy | No DTO declared here | User fetched successfully |
| `PATCH /api/users/me` | Controller/service policy | UpdateUserDto | User updated successfully |
| `PATCH /api/users/admin/:id` | ADMIN | AdminUpdateUserDto | User updated successfully |
| `DELETE /api/users/admin/:id` | ADMIN | No DTO declared here | User deleted successfully; Promise<void> |

### /api/teaching-catalogue

Source: `src/modules/teaching-catalogue/teaching-catalogue.module.ts`.

| Method and path | Roles/policy | Request DTOs | Operation / response contract |
| --- | --- | --- | --- |
| `GET /api/teaching-catalogue` | Public catalogue | No DTO declared here | Teaching catalogue fetched successfully |

### /api/dropdowns

| Method | Backend path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/dropdowns` | Public | Active collection summaries; `data.dropdowns[]`. |
| GET | `/api/dropdowns/:name` | Public | Active collection detail and options. |
| GET | `/api/dropdowns/admin` | ADMIN | Summaries including inactive collections. |
| GET | `/api/dropdowns/admin/:name` | ADMIN | Detail including retired options. |
| PATCH | `/api/dropdowns/:name` | ADMIN | Revision-checked metadata/options upsert. |
| DELETE | `/api/dropdowns/:name` | ADMIN | Revision-checked soft retirement. |

Teacher/school mobile apps consume public reads. Do not expose admin write controls or use privileged credentials to populate ordinary forms. Admin mutations require the current revision; PATCH omission preserves existing options, DELETE with optionKeys retires those options, DELETE without optionKeys retires the collection. HTTP 409 requires a fresh read/review rather than a guessed revision/retry. The public website implements only read proxies. Success detail returns the incremented revision; retirement never deletes historical saved selections.

## Appendix B. Exact backend DTO reference

These definitions were copied read-only from the local backend on 19 October 2026. They specify request names, optionality, validators, response properties, and pagination. They are source reference, not mobile code to execute. Imported Prisma enums are included later. `PartialType` inherits create-field constraints while allowing omitted fields; endpoint service validation still applies. Do not infer a service permission or transition merely because a DTO accepts a property. Do not hardcode example values from Swagger decorators as real data.

### src/modules/applications/dto/application-history-response.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationStatus } from '@prisma/client';
import { PaginationMetaDto } from '../../../common/dto/pagination.dto';

export class ApplicationHistoryEntryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  applicationId: string;

  @ApiPropertyOptional({ enum: ApplicationStatus, nullable: true, description: 'Null for the first entry' })
  fromStatus: ApplicationStatus | null;

  @ApiProperty({ enum: ApplicationStatus })
  toStatus: ApplicationStatus;

  @ApiProperty({ description: 'The user who made the change' })
  changedBy: string;

  @ApiProperty()
  createdAt: Date;
}

export class PaginatedApplicationHistoryResponseDto {
  @ApiProperty({ type: [ApplicationHistoryEntryDto], description: 'Oldest first, so it reads as a timeline' })
  history: ApplicationHistoryEntryDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination: PaginationMetaDto;
}
```

### src/modules/applications/dto/application-response.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationStatus } from '@prisma/client';

interface ApplicationEntity {
  id: string;
  jobId: string;
  jobName: string;
  instructorId: string;
  status: ApplicationStatus;
  coverLetter?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class ApplicationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  jobId: string;

  @ApiProperty({ description: 'Job title when the application was submitted' })
  jobName: string;

  @ApiProperty()
  instructorId: string;

  @ApiProperty({ enum: ApplicationStatus })
  status: ApplicationStatus;

  @ApiPropertyOptional({ nullable: true })
  coverLetter?: string | null;

  @ApiPropertyOptional()
  createdAt?: Date;

  @ApiPropertyOptional()
  updatedAt?: Date;

  static fromEntity(entity: ApplicationEntity): ApplicationResponseDto {
    return {
      id: entity.id,
      jobId: entity.jobId,
      jobName: entity.jobName,
      instructorId: entity.instructorId,
      status: entity.status,
      coverLetter: entity.coverLetter,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
```

### src/modules/applications/dto/create-application.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateApplicationDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  jobId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  coverLetter?: string;
}
```

### src/modules/applications/dto/list-applications-query.dto.ts

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListApplicationsQueryDto {
  @ApiPropertyOptional({ enum: ApplicationStatus, description: 'Only return applications in this stage' })
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
```

### src/modules/applications/dto/paginated-applications-response.dto.ts

```ts
import { ApiProperty } from '@nestjs/swagger';
import { ApplicationResponseDto } from './application-response.dto';

export class ApplicationsPaginationDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 45 })
  total: number;

  @ApiProperty({ example: 3 })
  totalPages: number;

  @ApiProperty({ example: true })
  hasNextPage: boolean;
}

export class PaginatedApplicationsResponseDto {
  @ApiProperty({ type: [ApplicationResponseDto] })
  applications: ApplicationResponseDto[];

  @ApiProperty({ type: ApplicationsPaginationDto })
  pagination: ApplicationsPaginationDto;
}
```

### src/modules/applications/dto/update-application-status.dto.ts

```ts
import { ApiProperty } from '@nestjs/swagger';
import { ApplicationStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateApplicationStatusDto {
  @ApiProperty({
    enum: ApplicationStatus,
    example: ApplicationStatus.HIRED,
    description:
      'VIEWED and SHORTLISTED are optional. APPLIED, VIEWED, or SHORTLISTED can move directly to HIRED or REJECTED.',
  })
  @IsEnum(ApplicationStatus)
  status!: ApplicationStatus;
}
```

### src/modules/auth/dto/auth-response.dto.ts

```ts
import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/dto/user-response.dto';

export class AuthResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refreshToken: string;

  @ApiProperty({ example: '2026-07-23T10:30:00.000Z' })
  accessTokenExpiresAt: string;

  @ApiProperty({ example: 900, description: 'Remaining access-token lifetime in seconds' })
  accessTokenExpiresInSeconds: number;

  @ApiProperty({ example: '2026-07-30T10:15:00.000Z' })
  refreshTokenExpiresAt: string;

  @ApiProperty({ example: 604800, description: 'Remaining refresh-token lifetime in seconds' })
  refreshTokenExpiresInSeconds: number;
}
```

### src/modules/auth/dto/email-otp-response.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EmailOtpResponseDto {
  @ApiProperty({ example: false })
  emailVerified: boolean;

  @ApiProperty({ example: 10 })
  expiresInMinutes: number;

  @ApiPropertyOptional({
    description: 'Fresh OTP token with the email_verification purpose',
  })
  otpToken?: string;
}
```

### src/modules/auth/dto/email-otp.dto.ts

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, Matches } from 'class-validator';

export class ResendEmailOtpDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}

export class VerifyEmailOtpDto {
  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/, { message: 'otp must be a 6 digit code' })
  otp!: string;
}
```

### src/modules/auth/dto/email-verification-response.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/dto/user-response.dto';

export class EmailVerificationResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;

  @ApiProperty({
    description: 'Short-lived OTP token with the email_verification purpose',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  otpToken: string;

  @ApiProperty({ example: 10 })
  expiresInMinutes: number;
}

export class LoginResponseDto {
  @ApiPropertyOptional({ type: UserResponseDto })
  user?: UserResponseDto;

  @ApiPropertyOptional({
    description: 'Returned only when the email is verified',
  })
  accessToken?: string;

  @ApiPropertyOptional({
    description: 'Returned only when the email is verified',
  })
  refreshToken?: string;

  @ApiPropertyOptional({
    description: 'Access-token expiry as an ISO-8601 timestamp',
    example: '2026-07-23T10:30:00.000Z',
  })
  accessTokenExpiresAt?: string;

  @ApiPropertyOptional({ example: 900, description: 'Remaining access-token lifetime in seconds' })
  accessTokenExpiresInSeconds?: number;

  @ApiPropertyOptional({
    description: 'Refresh-token expiry as an ISO-8601 timestamp',
    example: '2026-07-30T10:15:00.000Z',
  })
  refreshTokenExpiresAt?: string;

  @ApiPropertyOptional({ example: 604800, description: 'Remaining refresh-token lifetime in seconds' })
  refreshTokenExpiresInSeconds?: number;

  @ApiPropertyOptional({
    description: 'OTP token returned when email verification is still required',
  })
  otpToken?: string;

  @ApiPropertyOptional({
    description: 'Verification token and OTP lifetime in minutes',
    example: 10,
  })
  expiresInMinutes?: number;

  @ApiPropertyOptional({
    description: 'True when an authenticator or recovery code is required before tokens are issued',
  })
  twoFactorRequired?: boolean;

  @ApiPropertyOptional({
    description: 'Short-lived token accepted only by POST /auth/2fa/verify',
  })
  twoFactorToken?: string;
}
```

### src/modules/auth/dto/login.dto.ts

```ts
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { normalizeEmail } from '../../../common/transforms/normalize-email.transform';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @Transform(normalizeEmail)
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}
```

### src/modules/auth/dto/password-reset-response.dto.ts

```ts
import { ApiProperty } from '@nestjs/swagger';

export class PasswordResetOtpResponseDto {
  @ApiProperty({ example: 10 })
  expiresInMinutes!: number;

  @ApiProperty({
    description: 'Short-lived OTP token with the password_reset purpose',
  })
  otpToken!: string;
}

export class PasswordResetResponseDto {
  @ApiProperty({ example: true })
  passwordReset!: boolean;
}
```

### src/modules/auth/dto/password.dto.ts

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/, { message: 'otp must be a 6 digit code' })
  otp!: string;

  @ApiProperty({ example: 'NewPassword123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  @Matches(/(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/, {
    message: 'Password must contain at least one uppercase letter, one number, and one special character',
  })
  @IsNotEmpty()
  password!: string;
}
```

### src/modules/auth/dto/refresh-token.dto.ts

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
```

### src/modules/auth/dto/register.dto.ts

```ts
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength, IsNotEmpty, Matches, IsIn } from 'class-validator';
import { SIGNUP_ROLES, type SignupRole } from '../../../common/enums/role.enum';
import { normalizeEmail } from '../../../common/transforms/normalize-email.transform';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @Transform(normalizeEmail)
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'Password123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  @Matches(/(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/, {
    message: 'Password must contain at least one uppercase letter, one number, and one special character',
  })
  @IsNotEmpty()
  password!: string;

  @ApiProperty({ enum: SIGNUP_ROLES, example: SIGNUP_ROLES[0] })
  @IsIn(SIGNUP_ROLES)
  role!: SignupRole;
}
```

### src/modules/bookings/dto/booking-response.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus, InvoiceStatus } from '@prisma/client';
import { ReviewResponseDto } from '../../reviews/dto/review-response.dto';
import type { BookingWithRelations } from '../bookings.repository';

export class BookingJobSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiPropertyOptional({ nullable: true })
  subject: string | null;

  @ApiProperty({ type: [String] })
  subjects: string[];

  @ApiProperty({ type: [String] })
  keyStages: string[];

  @ApiPropertyOptional({ nullable: true })
  address: string | null;

  @ApiPropertyOptional({ nullable: true })
  city: string | null;

  @ApiPropertyOptional({ nullable: true })
  county: string | null;

  @ApiPropertyOptional({ nullable: true })
  postalCode: string | null;

  @ApiPropertyOptional({ nullable: true })
  parkingInfo: string | null;
}

export class BookingInstructorSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fullName: string;

  @ApiPropertyOptional({ nullable: true })
  imageUrl: string | null;
}

export class BookingInstitutionSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  imageUrl: string | null;
}

export class BookingInvoiceSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: [InvoiceStatus.OPEN, InvoiceStatus.PAID, InvoiceStatus.UNCOLLECTIBLE] })
  status: InvoiceStatus;

  @ApiProperty({ example: 91125, description: 'What the school pays, in pence' })
  totalAmountPence: number;

  @ApiPropertyOptional({ nullable: true, description: 'Stripe page where the school views and pays the invoice' })
  hostedInvoiceUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  dueAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  paidAt: Date | null;
}

export class BookingResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  applicationId: string;

  @ApiProperty({ enum: ['APPLICATION', 'DIRECT_HIRE'], description: 'How the booking was created' })
  source: string;

  @ApiProperty({ enum: BookingStatus })
  status: BookingStatus;

  @ApiProperty({ type: BookingJobSummaryDto })
  job: BookingJobSummaryDto;

  @ApiProperty({ type: BookingInstructorSummaryDto })
  instructor: BookingInstructorSummaryDto;

  @ApiProperty({ type: BookingInstitutionSummaryDto })
  institution: BookingInstitutionSummaryDto;

  @ApiPropertyOptional({ nullable: true, description: 'Copied from the job when the instructor was hired' })
  startDate: Date | null;

  @ApiPropertyOptional({ nullable: true, description: 'Copied from the job when the instructor was hired' })
  endDate: Date | null;

  @ApiPropertyOptional({ nullable: true, description: 'Agreed pay, copied from the job when the instructor was hired' })
  payAmount: number | null;

  @ApiPropertyOptional({ nullable: true })
  payType: string | null;

  @ApiPropertyOptional({ nullable: true })
  completedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  cancelledAt: Date | null;

  @ApiPropertyOptional({ nullable: true, description: 'User who cancelled the booking' })
  cancelledById: string | null;

  @ApiPropertyOptional({ nullable: true })
  cancelReason: string | null;

  @ApiProperty({ type: [ReviewResponseDto], description: 'At most one review from each party' })
  reviews: ReviewResponseDto[];

  @ApiPropertyOptional({
    type: BookingInvoiceSummaryDto,
    nullable: true,
    description: 'The current invoice for this booking; null until it is invoiced',
  })
  invoice: BookingInvoiceSummaryDto | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(entity: BookingWithRelations): BookingResponseDto {
    return {
      id: entity.id,
      applicationId: entity.applicationId,
      source: entity.source,
      status: entity.status,
      job: entity.job,
      instructor: {
        id: entity.instructor.id,
        fullName: entity.instructor.fullName,
        imageUrl: entity.instructor.imageUrl,
      },
      institution: {
        id: entity.institution.id,
        name: entity.institution.name,
        imageUrl: entity.institution.imageUrl,
      },
      startDate: entity.startDate,
      endDate: entity.endDate,
      payAmount: entity.payAmount != null ? Number(entity.payAmount) : null,
      payType: entity.payType,
      completedAt: entity.completedAt,
      cancelledAt: entity.cancelledAt,
      cancelledById: entity.cancelledById,
      cancelReason: entity.cancelReason,
      reviews: entity.reviews.map((review) => ReviewResponseDto.fromEntity(review)),
      invoice: entity.invoices[0] ?? null,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
```

### src/modules/bookings/dto/cancel-booking.dto.ts

```ts
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CancelBookingDto {
  @ApiProperty({ example: 'Instructor is unwell', maxLength: 1000 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}
```

### src/modules/bookings/dto/direct-hire.dto.ts

```ts
import { Type } from 'class-transformer';
import { IsDateString, IsObject, IsString, IsUUID, MaxLength, ValidateIf, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateJobDto } from '../../jobs/dto/create-job.dto';

export class DirectHireDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Client-generated UUID for this invitation. Reuse it with the same body on retries.',
  })
  @IsUUID()
  requestId!: string;

  @ApiProperty({ format: 'uuid', description: 'Instructor profile ID, not login user ID' })
  @IsUUID()
  instructorId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Existing job owned by the school; mutually exclusive with newJob',
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsUUID()
  jobId?: string;

  @ApiPropertyOptional({
    type: CreateJobDto,
    description: 'Create a private draft and send an invitation atomically. Requires dates and pay.',
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => CreateJobDto)
  newJob?: CreateJobDto;

  @ApiPropertyOptional({ maxLength: 1000 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(1000)
  message?: string;

  @ApiPropertyOptional({
    description: 'Future expiry, no later than job start or job expiry. Default: up to seven days.',
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsDateString()
  expiresAt?: string;
}
```

### src/modules/bookings/dto/job-invitation-response.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Job, JobInvitationStatus, JobStatus, Prisma } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationMetaDto, PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { appUrl } from '../../notifications/notifications.config';
import { jobSubjects } from '../../teaching-catalogue/teaching-catalogue';

export const INVITATION_INCLUDE = {
  instructor: { select: { id: true, userId: true, fullName: true, imageUrl: true } },
  institution: { select: { id: true, userId: true, name: true, imageUrl: true } },
  job: true,
} satisfies Prisma.JobInvitationInclude;
export type InvitationWithRelations = Prisma.JobInvitationGetPayload<{ include: typeof INVITATION_INCLUDE }>;

/** The terms the teacher is asked to accept, excluding mutable listing state. */
export function offeredJob(job: Job) {
  return {
    id: job.id,
    title: job.title,
    description: job.description,
    subject: job.subject,
    subjects: jobSubjects(job),
    requiredSkills: job.requiredSkills,
    minExperienceYears: job.minExperienceYears,
    keyStages: job.keyStages,
    address: job.address,
    city: job.city,
    county: job.county,
    postalCode: job.postalCode,
    countryCode: job.countryCode,
    latitude: job.latitude,
    longitude: job.longitude,
    parkingInfo: job.parkingInfo,
    startDate: job.startDate?.toISOString() ?? null,
    endDate: job.endDate?.toISOString() ?? null,
    payAmount: job.payAmount == null ? null : Number(job.payAmount),
    payType: job.payType,
  };
}

export function invitationExpiry(invitation: InvitationWithRelations): Date {
  return invitation.job.expiresAt && invitation.job.expiresAt < invitation.expiresAt
    ? invitation.job.expiresAt
    : invitation.expiresAt;
}

/** Old pending offers predate subjects; add their single subject without altering the stored consent snapshot. */
export function offeredJobSnapshot(value: Prisma.JsonValue): ReturnType<typeof offeredJob> {
  const snapshot = value as unknown as ReturnType<typeof offeredJob>;
  return { ...snapshot, subjects: jobSubjects(snapshot) };
}

export function invitationStatus(invitation: InvitationWithRelations): JobInvitationStatus {
  return invitation.status === JobInvitationStatus.PENDING &&
    (invitationExpiry(invitation).getTime() <= Date.now() || invitation.job.status === JobStatus.EXPIRED)
    ? JobInvitationStatus.EXPIRED
    : invitation.status;
}

export class ListJobInvitationsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: JobInvitationStatus })
  @IsOptional()
  @IsEnum(JobInvitationStatus)
  status?: JobInvitationStatus;
}

export class JobInvitationResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: JobInvitationStatus }) status: JobInvitationStatus;
  @ApiProperty({ type: Object, description: 'Snapshot of the offered job, including dates, pay and location' })
  job: ReturnType<typeof offeredJob>;
  @ApiProperty({ enum: JobStatus }) jobStatus: JobStatus;
  @ApiProperty({ type: Object }) instructor: { id: string; fullName: string; imageUrl: string | null };
  @ApiProperty({ type: Object }) institution: { id: string; name: string; imageUrl: string | null };
  @ApiProperty({ type: String, nullable: true }) message: string | null;
  @ApiProperty() publishOnDecline: boolean;
  @ApiProperty() expiresAt: Date;
  @ApiProperty({ type: Date, nullable: true }) decidedAt: Date | null;
  @ApiProperty({ type: String, nullable: true }) bookingId: string | null;
  @ApiProperty() invitationPath: string;
  @ApiProperty({ type: String, nullable: true }) invitationUrl: string | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static fromEntity(entity: InvitationWithRelations): JobInvitationResponseDto {
    const invitationPath = `/job-invitations/${entity.id}`;
    const jobExpired = entity.job.expiresAt && entity.job.expiresAt.getTime() <= Date.now();
    return {
      id: entity.id,
      status: invitationStatus(entity),
      job: offeredJobSnapshot(entity.offeredJob),
      jobStatus:
        jobExpired && (entity.job.status === JobStatus.DRAFT || entity.job.status === JobStatus.ACTIVE)
          ? JobStatus.EXPIRED
          : entity.job.status,
      instructor: {
        id: entity.instructor.id,
        fullName: entity.instructor.fullName,
        imageUrl: entity.instructor.imageUrl,
      },
      institution: { id: entity.institution.id, name: entity.institution.name, imageUrl: entity.institution.imageUrl },
      message: entity.message,
      publishOnDecline: entity.publishOnDecline,
      expiresAt: invitationExpiry(entity),
      decidedAt: entity.decidedAt,
      bookingId: entity.bookingId,
      invitationPath,
      invitationUrl: appUrl(invitationPath),
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}

export class PaginatedJobInvitationsDto {
  @ApiProperty({ type: [JobInvitationResponseDto] }) invitations: JobInvitationResponseDto[];
  @ApiProperty({ type: PaginationMetaDto }) pagination: PaginationMetaDto;
}
```

### src/modules/bookings/dto/list-bookings-query.dto.ts

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export const BOOKING_INVOICE_FILTERS = ['none', 'unpaid', 'paid'] as const;
export type BookingInvoiceFilter = (typeof BOOKING_INVOICE_FILTERS)[number];

export class ListBookingsQueryDto {
  @ApiPropertyOptional({ enum: BookingStatus, description: 'Only return bookings in this status' })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({
    description: "Matches the job title, the teacher's name or the school's name",
    maxLength: 100,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || undefined : value))
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Only bookings for this job' })
  @IsOptional()
  @IsUUID()
  jobId?: string;

  @ApiPropertyOptional({
    example: '2026-10-01',
    description: 'Only bookings still running on or after this date (ISO date or date-time)',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-10-31',
    description: 'Only bookings starting on or before this date; a plain date includes that whole day',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    enum: BOOKING_INVOICE_FILTERS,
    description: 'none: not invoiced yet (or only voided invoices) · unpaid: invoice awaiting payment · paid',
  })
  @IsOptional()
  @IsIn(BOOKING_INVOICE_FILTERS)
  invoice?: BookingInvoiceFilter;
}

export class AdminListBookingsQueryDto extends ListBookingsQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Only bookings for this instructor profile' })
  @IsOptional()
  @IsUUID()
  instructorId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Only bookings with this institution profile' })
  @IsOptional()
  @IsUUID()
  institutionId?: string;
}
```

### src/modules/bookings/dto/paginated-bookings-response.dto.ts

```ts
import { ApiProperty } from '@nestjs/swagger';
import { BookingResponseDto } from './booking-response.dto';

export class BookingsPaginationDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 45 })
  total: number;

  @ApiProperty({ example: 3 })
  totalPages: number;

  @ApiProperty({ example: true })
  hasNextPage: boolean;
}

export class PaginatedBookingsResponseDto {
  @ApiProperty({ type: [BookingResponseDto] })
  bookings: BookingResponseDto[];

  @ApiProperty({ type: BookingsPaginationDto })
  pagination: BookingsPaginationDto;
}
```

### src/modules/contact/dto/founding-interest.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  Equals,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Matches,
  Min,
  ValidateIf,
} from 'class-validator';
import { FoundingInterestStatus, FoundingInterestType, type FoundingInterestSubmission } from '@prisma/client';

export class CreateFoundingInterestDto {
  @ApiProperty({ enum: FoundingInterestType })
  @IsEnum(FoundingInterestType)
  type!: FoundingInterestType;

  @ApiProperty()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 120)
  name!: string;

  @ApiProperty()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 100)
  role!: string;

  @ApiProperty()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 80)
  area!: string;

  @ApiPropertyOptional()
  @ValidateIf((input: CreateFoundingInterestDto) => input.type === FoundingInterestType.SCHOOL)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 160)
  organizationName?: string;

  @ApiPropertyOptional({ description: 'An active waitlistSchoolType dropdown value' })
  @ValidateIf((input: CreateFoundingInterestDto) => input.type === FoundingInterestType.SCHOOL)
  @IsString()
  @Length(1, 100)
  schoolType?: string;

  @ApiPropertyOptional({ description: 'An active supplyDaysPerTerm dropdown value' })
  @ValidateIf((input: CreateFoundingInterestDto) => input.type === FoundingInterestType.SCHOOL)
  @IsString()
  @Length(1, 100)
  supplyDaysPerTerm?: string;

  @ApiPropertyOptional({ description: 'An active coverBookingMethod dropdown value' })
  @ValidateIf((input: CreateFoundingInterestDto) => input.type === FoundingInterestType.SCHOOL)
  @IsString()
  @Length(1, 100)
  coverBookingMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  foundingProgrammeInterest?: boolean;

  @ApiPropertyOptional()
  @ValidateIf((input: CreateFoundingInterestDto) => input.type === FoundingInterestType.TEACHER)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 60)
  firstName?: string;

  @ApiPropertyOptional()
  @ValidateIf((input: CreateFoundingInterestDto) => input.type === FoundingInterestType.TEACHER)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 60)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(32)
  @Matches(/^(?=(?:\D*\d){10})[+()\d\s-]+$/)
  phone?: string;

  @ApiPropertyOptional({ description: 'An active currentSupply dropdown value' })
  @ValidateIf((input: CreateFoundingInterestDto) => input.type === FoundingInterestType.TEACHER)
  @IsString()
  @Length(1, 100)
  currentSupply?: string;

  @ApiPropertyOptional({ description: 'An active daysPerWeek dropdown value' })
  @ValidateIf((input: CreateFoundingInterestDto) => input.type === FoundingInterestType.TEACHER)
  @IsString()
  @Length(1, 100)
  daysPerWeek?: string;

  @ApiPropertyOptional()
  @ValidateIf((input: CreateFoundingInterestDto) => input.type === FoundingInterestType.TEACHER)
  @Equals(true)
  emailConsent?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(80)
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  campaign?: string;
}

export class UpdateWaitlistDetailsDto {
  @ApiProperty()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  token!: string;

  @ApiProperty({ type: [String], description: 'Active waitlistPhase dropdown values' })
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  @Length(1, 100, { each: true })
  phases!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  mainSubject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(20)
  @Matches(/^$|^[A-Z]{1,2}\d[A-Z\d]?(?:\s*\d[A-Z]{2})?$/i)
  postcode?: string;
}

export class ListFoundingInterestQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({ enum: FoundingInterestType })
  @IsOptional()
  @IsEnum(FoundingInterestType)
  type?: FoundingInterestType;

  @ApiPropertyOptional({ enum: FoundingInterestStatus })
  @IsOptional()
  @IsEnum(FoundingInterestStatus)
  status?: FoundingInterestStatus;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ example: '2026-10-01', description: 'Created on or after this UTC date' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fromDate must use YYYY-MM-DD format' })
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ example: '2026-10-31', description: 'Created on or before this UTC date' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'toDate must use YYYY-MM-DD format' })
  @IsDateString()
  toDate?: string;
}

export class UpdateFoundingInterestStatusDto {
  @ApiProperty({ enum: FoundingInterestStatus, example: FoundingInterestStatus.CONTACTED })
  @IsEnum(FoundingInterestStatus)
  status!: FoundingInterestStatus;
}

export class FoundingInterestResponseDto {
  @ApiPropertyOptional()
  firstName?: string | null;

  @ApiPropertyOptional()
  lastName?: string | null;

  @ApiPropertyOptional()
  area?: string | null;

  @ApiPropertyOptional()
  supplyDaysPerTerm?: string | null;

  @ApiPropertyOptional()
  coverBookingMethod?: string | null;

  @ApiPropertyOptional()
  foundingProgrammeInterest?: boolean | null;

  @ApiPropertyOptional()
  currentSupply?: string | null;

  @ApiPropertyOptional()
  daysPerWeek?: string | null;

  @ApiPropertyOptional()
  emailConsent?: boolean | null;

  @ApiPropertyOptional()
  phases: string[];

  @ApiPropertyOptional()
  mainSubject?: string | null;

  @ApiProperty()
  id: string;

  @ApiProperty({ enum: FoundingInterestType })
  type: FoundingInterestType;

  @ApiProperty({ enum: FoundingInterestStatus })
  status: FoundingInterestStatus;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional()
  phone?: string | null;

  @ApiProperty()
  role: string;

  @ApiPropertyOptional()
  organizationName?: string | null;

  @ApiPropertyOptional()
  postcode?: string | null;

  @ApiPropertyOptional()
  schoolType?: string | null;

  @ApiPropertyOptional()
  tier?: string | null;

  @ApiPropertyOptional()
  phase?: string | null;

  @ApiPropertyOptional()
  availability?: string | null;

  @ApiPropertyOptional()
  message?: string | null;

  @ApiPropertyOptional()
  source?: string | null;

  @ApiPropertyOptional()
  campaign?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(entity: FoundingInterestSubmission): FoundingInterestResponseDto {
    return {
      firstName: entity.firstName,
      lastName: entity.lastName,
      area: entity.area,
      supplyDaysPerTerm: entity.supplyDaysPerTerm,
      coverBookingMethod: entity.coverBookingMethod,
      foundingProgrammeInterest: entity.foundingProgrammeInterest,
      currentSupply: entity.currentSupply,
      daysPerWeek: entity.daysPerWeek,
      emailConsent: entity.emailConsent,
      phases: entity.phases,
      mainSubject: entity.mainSubject,
      id: entity.id,
      type: entity.type,
      status: entity.status,
      name: entity.name,
      email: entity.email,
      phone: entity.phone,
      role: entity.role,
      organizationName: entity.organizationName,
      postcode: entity.postcode,
      schoolType: entity.schoolType,
      tier: entity.tier,
      phase: entity.phase,
      availability: entity.availability,
      message: entity.message,
      source: entity.source,
      campaign: entity.campaign,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}

class FoundingInterestPaginationDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 45 })
  total: number;

  @ApiProperty({ example: 3 })
  totalPages: number;

  @ApiProperty({ example: true })
  hasNextPage: boolean;
}

export class PaginatedFoundingInterestResponseDto {
  @ApiProperty({ type: [FoundingInterestResponseDto] })
  submissions: FoundingInterestResponseDto[];

  @ApiProperty({ type: FoundingInterestPaginationDto })
  pagination: FoundingInterestPaginationDto;
}
```

### src/modules/contact/dto/register-interest.dto.ts

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export const registerInterestRoles = [
  'Head Teacher',
  'Deputy Head',
  'Cover Manager',
  'HR Lead',
  'MAT / Trust Lead',
] as const;

export class RegisterInterestDto {
  @ApiProperty({ example: 'Greenfield Primary School' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 120)
  schoolName!: string;

  @ApiProperty({ example: 'Jane Smith' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 120)
  contactName!: string;

  @ApiProperty({ description: 'An active legacySchoolRole dropdown value', example: 'Head Teacher' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  role!: string;

  @ApiProperty({ example: 'name@school.org.uk' })
  @IsEmail()
  @Length(5, 254)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postcode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  schoolType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  campaign?: string;
}
```

### src/modules/conversations/dto/conversation-response.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationStatus } from '@prisma/client';

export type ConversationSide = 'instructor' | 'poster';

export class AttachmentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'lesson-plan.pdf' })
  fileName: string;

  @ApiProperty({ example: 'application/pdf' })
  contentType: string;

  @ApiProperty({ example: 52000 })
  sizeBytes: number;
}

export class MessageResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  conversationId: string;

  @ApiProperty({ type: String, nullable: true, description: 'Login user ID of the sender; null if deleted' })
  senderUserId: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Current participant display name; null if unavailable' })
  senderName: string | null;

  @ApiProperty({
    enum: ['instructor', 'poster'],
    nullable: true,
    description: 'Which side sent it; null once the sender account is deleted',
  })
  senderSide: ConversationSide | null;

  @ApiProperty({ description: 'Empty when the message only carries files' })
  body: string;

  @ApiProperty({ type: [AttachmentResponseDto] })
  attachments: AttachmentResponseDto[];

  @ApiProperty()
  createdAt: Date;
}

export class ConversationPartyDto {
  @ApiProperty({ description: 'Instructor or institution profile id; null for an admin-posted job', nullable: true })
  id: string | null;

  @ApiProperty({ description: 'Login user ID, distinct from the profile id' })
  userId: string;

  @ApiProperty({ example: 'Oak Primary' })
  name: string;

  @ApiPropertyOptional({ nullable: true })
  imageUrl: string | null;

  @ApiProperty({ enum: ['teacher', 'school'] })
  role: 'teacher' | 'school';
}

export class ConversationParticipantsDto {
  @ApiProperty({ type: ConversationPartyDto })
  instructor: ConversationPartyDto;

  @ApiProperty({ type: ConversationPartyDto })
  poster: ConversationPartyDto;
}

export class LastMessageDto {
  @ApiProperty({ type: String, nullable: true })
  senderUserId: string | null;

  @ApiProperty({ type: String, nullable: true })
  senderName: string | null;

  @ApiProperty()
  body: string;

  @ApiProperty()
  fromMe: boolean;

  @ApiProperty()
  hasAttachments: boolean;

  @ApiProperty()
  createdAt: Date;
}

export class ConversationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: String, nullable: true })
  applicationId: string | null;

  @ApiProperty({ enum: ApplicationStatus, nullable: true })
  applicationStatus: ApplicationStatus | null;

  @ApiProperty({ description: 'True for admins and rejected applications: viewing only, no new messages' })
  readOnly: boolean;

  @ApiProperty({ nullable: true, example: { id: '...', title: 'Year 5 cover' } })
  job: { id: string; title: string } | null;

  @ApiProperty({
    enum: ['instructor', 'poster'],
    nullable: true,
    description: "The caller's side; null for admin observers",
  })
  me: ConversationSide | null;

  @ApiProperty({
    type: ConversationPartyDto,
    nullable: true,
    description: 'The other person; null for admin observers',
  })
  counterpart: ConversationPartyDto | null;

  @ApiProperty({ type: ConversationParticipantsDto })
  participants: ConversationParticipantsDto;

  @ApiProperty({ type: Date, nullable: true })
  instructorLastReadAt: Date | null;

  @ApiProperty({ type: Date, nullable: true })
  posterLastReadAt: Date | null;

  @ApiPropertyOptional({ type: LastMessageDto, nullable: true })
  lastMessage: LastMessageDto | null;

  @ApiProperty({ example: 2 })
  unreadCount: number;

  @ApiPropertyOptional({ nullable: true, description: 'Messages up to here have been seen by the other person' })
  counterpartLastReadAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  lastMessageAt: Date | null;

  @ApiProperty()
  createdAt: Date;
}

export class ConversationsPaginationDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 45 })
  total: number;

  @ApiProperty({ example: 3 })
  totalPages: number;

  @ApiProperty({ example: true })
  hasNextPage: boolean;
}

export class PaginatedConversationsResponseDto {
  @ApiProperty({ type: [ConversationResponseDto] })
  conversations: ConversationResponseDto[];

  @ApiProperty({ type: ConversationsPaginationDto })
  pagination: ConversationsPaginationDto;
}

export class JobConversationsResponseDto extends PaginatedConversationsResponseDto {
  @ApiProperty({ example: { id: '...', title: 'Year 5 cover' } })
  job: { id: string; title: string };
}

export class MessagesPageResponseDto {
  @ApiProperty({ type: [MessageResponseDto], description: 'Oldest first' })
  messages: MessageResponseDto[];

  @ApiProperty({ description: 'More, older messages exist; pass the first message id as before' })
  hasMore: boolean;
}

export class AttachmentUploadResponseDto {
  @ApiProperty({ type: AttachmentResponseDto })
  attachment: AttachmentResponseDto;

  @ApiProperty({
    example: {
      url: 'https://...',
      expiresAt: '...',
      requiredHeaders: { 'Content-Type': 'application/pdf', 'If-None-Match': '*' },
    },
  })
  upload: { url: string; expiresAt: Date; requiredHeaders: Record<string, string> };
}

export class UnreadCountResponseDto {
  @ApiProperty({ example: 3 })
  total: number;
}

export class DownloadUrlResponseDto {
  @ApiProperty()
  url: string;

  @ApiProperty()
  expiresAt: Date;
}

export class SocketTicketResponseDto {
  @ApiProperty({ description: 'Pass as auth.ticket when connecting to the /conversations Socket.IO namespace' })
  ticket: string;

  @ApiProperty({ example: 60 })
  expiresInSeconds: number;
}
```

### src/modules/conversations/dto/create-attachment.dto.ts

```ts
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';
import { ALLOWED_ATTACHMENT_TYPES, MAX_ATTACHMENT_BYTES } from '../conversations.config';

export class CreateAttachmentDto {
  @ApiProperty({ example: 'lesson-plan.pdf', maxLength: 200 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fileName!: string;

  @ApiProperty({ enum: Object.keys(ALLOWED_ATTACHMENT_TYPES), example: 'application/pdf' })
  @IsIn(Object.keys(ALLOWED_ATTACHMENT_TYPES), { message: 'Only PDF, Word, JPEG, PNG and text files can be shared' })
  contentType!: string;

  @ApiProperty({ example: 52000, minimum: 1, maximum: MAX_ATTACHMENT_BYTES })
  @IsInt()
  @Min(1)
  @Max(MAX_ATTACHMENT_BYTES, { message: 'Files can be up to 10 MB' })
  sizeBytes!: number;
}
```

### src/modules/conversations/dto/list-conversations-query.dto.ts

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListConversationsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
```

### src/modules/conversations/dto/list-messages-query.dto.ts

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ListMessagesQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Load messages older than this one (for scrolling back)' })
  @IsOptional()
  @IsUUID()
  before?: string;

  @ApiPropertyOptional({ default: 30, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 30;
}
```

### src/modules/conversations/dto/send-message.dto.ts

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { MAX_ATTACHMENTS_PER_MESSAGE, MAX_MESSAGE_LENGTH } from '../conversations.config';

export class SendMessageDto {
  @ApiPropertyOptional({ example: 'Hi, is parking available on site?', maxLength: MAX_MESSAGE_LENGTH })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(MAX_MESSAGE_LENGTH)
  body?: string;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    maxItems: MAX_ATTACHMENTS_PER_MESSAGE,
    description: 'Uploads from POST /conversations/:id/attachments, finished uploading to S3',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(MAX_ATTACHMENTS_PER_MESSAGE)
  @IsUUID(undefined, { each: true })
  attachmentIds?: string[];
}
```

### src/modules/conversations/dto/start-conversation.dto.ts

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, ValidateIf } from 'class-validator';

/** Send applicationId alone, or instructorId with an optional jobId. */
export class StartConversationDto {
  @ApiPropertyOptional({ description: 'Teacher profile ID; required unless applicationId is supplied', format: 'uuid' })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsUUID()
  instructorId?: string;

  @ApiPropertyOptional({ description: 'Optional job owned by the signed-in school', format: 'uuid' })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsUUID()
  jobId?: string;

  @ApiPropertyOptional({
    description: 'Application on a job owned by the signed-in school; send alone',
    format: 'uuid',
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsUUID()
  applicationId?: string;
}
```

### src/modules/document-requirements/dto/create-document-requirement.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentContext } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';

export class CreateDocumentRequirementDto {
  @ApiProperty()
  @IsUUID()
  documentTypeId!: string;

  @ApiProperty({ enum: DocumentContext })
  @IsEnum(DocumentContext)
  context!: DocumentContext;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresReview?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

### src/modules/document-requirements/dto/document-requirement-response.dto.ts

```ts
import { ApiProperty } from '@nestjs/swagger';
import { DocumentContext } from '@prisma/client';

export class DocumentRequirementResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  documentTypeId: string;

  @ApiProperty({ enum: DocumentContext })
  context: DocumentContext;

  @ApiProperty()
  isRequired: boolean;

  @ApiProperty()
  requiresReview: boolean;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
```

### src/modules/document-requirements/dto/profile-document-requirement-response.dto.ts

```ts
import { ApiProperty } from '@nestjs/swagger';
import { DocumentTypeResponseDto } from '../../document-types/dto/document-type-response.dto';
import { DocumentRequirementResponseDto } from './document-requirement-response.dto';

/**
 * A requirement together with its document type, so the client can show the
 * document name and validate the file (allowed mimes, max size) before upload.
 */
export class ProfileDocumentRequirementResponseDto extends DocumentRequirementResponseDto {
  @ApiProperty({ type: DocumentTypeResponseDto })
  documentType: DocumentTypeResponseDto;
}
```

### src/modules/document-requirements/dto/update-document-requirement.dto.ts

```ts
import { PartialType } from '@nestjs/swagger';
import { CreateDocumentRequirementDto } from './create-document-requirement.dto';

export class UpdateDocumentRequirementDto extends PartialType(CreateDocumentRequirementDto) {}
```

### src/modules/document-reviews/dto/document-review-response.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentVerificationStatus } from '@prisma/client';

export class DocumentReviewResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  documentId: string;

  @ApiProperty()
  reviewedFileKey: string;

  @ApiProperty()
  reviewerId: string;

  @ApiProperty({ enum: DocumentVerificationStatus })
  fromStatus: DocumentVerificationStatus;

  @ApiProperty({ enum: DocumentVerificationStatus })
  toStatus: DocumentVerificationStatus;

  @ApiPropertyOptional({ nullable: true })
  notes: string | null;

  @ApiProperty()
  createdAt: Date;
}
```

### src/modules/document-reviews/dto/list-document-reviews-query.dto.ts

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ListDocumentReviewsQueryDto {
  @ApiPropertyOptional({ description: 'Only reviews of this document' })
  @IsOptional()
  @IsUUID()
  documentId?: string;
}
```

### src/modules/document-types/dto/create-document-type.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateDocumentTypeDto {
  @ApiProperty({ example: 'DBS' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: 'DBS Certificate' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'Disclosure and Barring Service certificate' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: [String], example: ['application/pdf', 'image/jpeg'] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  allowedMimes!: string[];

  @ApiPropertyOptional({ default: 10485760 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxSizeBytes?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

### src/modules/document-types/dto/document-type-response.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DocumentTypeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'DBS' })
  code: string;

  @ApiProperty({ example: 'DBS Certificate' })
  name: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiProperty({ type: [String] })
  allowedMimes: string[];

  @ApiProperty()
  maxSizeBytes: number;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
```

### src/modules/document-types/dto/update-document-type.dto.ts

```ts
import { PartialType } from '@nestjs/swagger';
import { CreateDocumentTypeDto } from './create-document-type.dto';

export class UpdateDocumentTypeDto extends PartialType(CreateDocumentTypeDto) {}
```

### src/modules/documents/dto/complete-upload.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CompleteUploadDto {
  @ApiProperty({ description: 'The fileKey returned by the upload-url endpoint' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  fileKey!: string;

  @ApiProperty({ example: 'dbs-certificate.pdf' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(/^[^\r\n/\\]+$/, { message: 'originalName must be a plain file name' })
  originalName!: string;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  documentExpiryDate?: string | null;
}
```

### src/modules/documents/dto/create-document.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class CreateDocumentDto {
  @ApiProperty()
  @IsUUID()
  requirementId!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  applicationId?: string | null;
}
```

### src/modules/documents/dto/create-upload-url.dto.ts

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Matches, MaxLength, Min } from 'class-validator';

export class CreateUploadUrlDto {
  @ApiProperty({ example: 'application/pdf', description: 'MIME type the file will be uploaded with' })
  @IsString()
  @MaxLength(255)
  @Matches(/^[\w.+-]+\/[\w.+-]+$/, { message: 'contentType must be a valid MIME type' })
  contentType!: string;

  @ApiProperty({ minimum: 1, description: 'Size of the file in bytes' })
  @IsInt()
  @Min(1)
  sizeBytes!: number;
}
```

### src/modules/documents/dto/document-response.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentVerificationStatus } from '@prisma/client';
import { ProfileDocumentRequirementResponseDto } from '../../document-requirements/dto/profile-document-requirement-response.dto';

export class DocumentOwnerSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional({ nullable: true })
  name: string | null;
}

export class DocumentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiPropertyOptional({ nullable: true })
  applicationId: string | null;

  @ApiProperty()
  requirementId: string;

  @ApiProperty({ enum: DocumentVerificationStatus })
  status: DocumentVerificationStatus;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Latest rejection or information-request note for the current file; null after replacement or approval',
  })
  rejectionComment?: string | null;

  @ApiPropertyOptional({ nullable: true })
  fileKey: string | null;

  @ApiPropertyOptional({ nullable: true })
  originalName: string | null;

  @ApiPropertyOptional({ nullable: true })
  sizeBytes: number | null;

  @ApiPropertyOptional({ nullable: true })
  contentType: string | null;

  @ApiPropertyOptional({ nullable: true })
  checksum: string | null;

  @ApiPropertyOptional({ nullable: true })
  documentExpiryDate: Date | null;

  @ApiPropertyOptional({ nullable: true })
  uploadedAt: Date | null;

  @ApiPropertyOptional({ type: ProfileDocumentRequirementResponseDto })
  requirement?: ProfileDocumentRequirementResponseDto;

  @ApiPropertyOptional({ type: DocumentOwnerSummaryDto, description: 'Present on admin routes only' })
  user?: DocumentOwnerSummaryDto;

  @ApiPropertyOptional({ nullable: true })
  deletedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromDocument(
    document: DocumentResponseDto & {
      reviews?: { reviewedFileKey: string; toStatus: DocumentVerificationStatus; notes: string | null }[];
    },
  ): DocumentResponseDto {
    const { reviews, ...response } = document;
    const latestReview = reviews?.[0];
    const needsReplacement =
      document.status === DocumentVerificationStatus.REJECTED ||
      document.status === DocumentVerificationStatus.REQUIRES_INFO;

    return {
      ...response,
      rejectionComment:
        needsReplacement &&
        latestReview?.reviewedFileKey === document.fileKey &&
        latestReview?.toStatus === document.status
          ? latestReview.notes
          : null,
    };
  }
}
```

### src/modules/documents/dto/download-url-response.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DownloadUrlResponseDto {
  @ApiProperty({ description: 'Presigned S3 URL to GET the file from' })
  url: string;

  @ApiProperty()
  expiresAt: Date;

  @ApiPropertyOptional({ nullable: true })
  originalName: string | null;

  @ApiProperty()
  contentType: string;

  @ApiProperty()
  sizeBytes: number;
}
```

### src/modules/documents/dto/list-documents-query.dto.ts

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentVerificationStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListDocumentsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({ enum: DocumentVerificationStatus })
  @IsOptional()
  @IsEnum(DocumentVerificationStatus)
  status?: DocumentVerificationStatus;
}
```

### src/modules/documents/dto/paginated-documents-response.dto.ts

```ts
import { ApiProperty } from '@nestjs/swagger';
import { DocumentResponseDto } from './document-response.dto';

export class DocumentsPaginationDto {
  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  total: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty()
  hasNextPage: boolean;
}

export class PaginatedDocumentsResponseDto {
  @ApiProperty({ type: [DocumentResponseDto] })
  documents: DocumentResponseDto[];

  @ApiProperty({ type: DocumentsPaginationDto })
  pagination: DocumentsPaginationDto;
}
```

### src/modules/documents/dto/review-document.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentVerificationStatus } from '@prisma/client';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const REVIEW_DECISIONS = [
  DocumentVerificationStatus.APPROVED,
  DocumentVerificationStatus.REJECTED,
  DocumentVerificationStatus.REQUIRES_INFO,
] as const;

export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export class ReviewDocumentDto {
  @ApiProperty({ enum: REVIEW_DECISIONS })
  @IsIn(REVIEW_DECISIONS)
  status!: ReviewDecision;

  @ApiPropertyOptional({
    maxLength: 2000,
    description: 'Required when rejecting or requesting more information. Emailed to the document owner.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
```

### src/modules/documents/dto/update-document.dto.ts

```ts
import { PartialType } from '@nestjs/swagger';
import { CreateDocumentDto } from './create-document.dto';

export class UpdateDocumentDto extends PartialType(CreateDocumentDto) {}
```

### src/modules/documents/dto/upload-url-response.dto.ts

```ts
import { ApiProperty } from '@nestjs/swagger';

export class UploadUrlResponseDto {
  @ApiProperty({ description: 'Send this back to upload-complete once the PUT succeeds' })
  fileKey: string;

  @ApiProperty({ description: 'Presigned S3 URL to PUT the file to' })
  url: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    description: 'Headers that must be sent with the PUT exactly as given',
  })
  requiredHeaders: Record<string, string>;

  @ApiProperty()
  expiresAt: Date;
}
```

### src/modules/google-oauth/dto/google-login.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { SIGNUP_ROLES, type SignupRole } from '../../../common/enums/role.enum';

export class GoogleLoginDto {
  @ApiProperty({
    description: 'Google Identity Services ID token returned in the credential field',
  })
  @IsString()
  @IsNotEmpty()
  credential!: string;

  @ApiPropertyOptional({
    enum: SIGNUP_ROLES,
    description: 'Required on first sign-in, when the Google account creates a new user; ignored afterwards',
  })
  @IsOptional()
  @IsIn(SIGNUP_ROLES)
  role?: SignupRole;
}
```

### src/modules/institutions/dto/create-institution.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InstitutionType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsFQDN,
  IsISO31661Alpha2,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { TrustInputDto } from './trust-input.dto';

export class CreateInstitutionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: 'profile.jpg' })
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  registrationId?: string;

  @ApiProperty({ example: 'greenfield.ac.uk' })
  @IsFQDN({ require_tld: true })
  domain!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  address!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city!: string;

  @ApiPropertyOptional({ example: 'Greater London' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  county?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional({ example: 'GB', default: 'GB' })
  @IsOptional()
  @IsISO31661Alpha2()
  countryCode?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Subjects the school needs, from GET /api/teaching-catalogue. Send an array, not free text.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(100, { each: true })
  staffingNeeds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Custom staffing subjects when staffingNeeds includes Other. Stored as actual names in staffingNeeds.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(100, { each: true })
  otherSubjects?: string[];

  @ApiPropertyOptional({
    example: ['Same-day cover', 'Long-term roles'],
    isArray: true,
    type: String,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  coverTypes?: string[];

  @ApiPropertyOptional({ example: 420, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  typicalPupilCount?: number;

  @ApiPropertyOptional({ example: 'Jane Smith' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  complianceContact?: string;

  @ApiPropertyOptional({ example: 'safeguarding@greenfield.ac.uk' })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  complianceEmail?: string;

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean()
  safeguardingConfirmed?: boolean;

  @ApiPropertyOptional({ example: 'Headteacher' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  userRole?: string;

  @ApiPropertyOptional({
    enum: InstitutionType,
    default: InstitutionType.SINGLE_SCHOOL,
    description: 'A MAT school must name its trust and have a trust signatory approve it before submitting',
  })
  @IsOptional()
  @IsEnum(InstitutionType)
  institutionType?: InstitutionType;

  @ApiPropertyOptional({ type: TrustInputDto, description: 'Required for MAT_SCHOOL; not allowed for SINGLE_SCHOOL' })
  @IsOptional()
  @ValidateNested()
  @Type(() => TrustInputDto)
  trust?: TrustInputDto;
}
```

### src/modules/institutions/dto/institution-public-profile.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InstitutionType } from '@prisma/client';

export class InstitutionPublicTrustDto {
  @ApiProperty({ example: 'Oak Learning Trust' })
  name: string;
}

/**
 * What a teacher sees of a school: who it is and where they would be working.
 * A school's site address is business information teachers need to travel
 * there; the people behind the account (compliance contact and email, the
 * account holder's role), its billing plan, internal ids and review status
 * stay private.
 */
export class InstitutionPublicProfileDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Oakfield Primary School' })
  name: string;

  @ApiPropertyOptional({ nullable: true })
  imageUrl: string | null;

  @ApiProperty({ enum: InstitutionType })
  institutionType: InstitutionType;

  @ApiPropertyOptional({ type: InstitutionPublicTrustDto, nullable: true })
  trust: InstitutionPublicTrustDto | null;

  @ApiProperty({ example: '12 Oak Lane' })
  address: string;

  @ApiProperty({ example: 'Leeds' })
  city: string;

  @ApiPropertyOptional({ nullable: true, example: 'West Yorkshire' })
  county: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'LS1 4AB' })
  postalCode: string | null;

  @ApiProperty({
    type: [String],
    example: ['Mathematics', 'Science'],
    description: 'Catalogue subjects the school needs.',
  })
  staffingNeeds: string[];

  @ApiProperty({ type: [String] })
  coverTypes: string[];

  @ApiPropertyOptional({ nullable: true, example: 420 })
  typicalPupilCount: number | null;

  @ApiProperty({ description: 'SupplyEd has verified the school' })
  verified: boolean;

  @ApiPropertyOptional({ description: 'When it joined SupplyEd' })
  memberSince: Date | null;

  static fromEntity(entity: {
    id: string;
    name: string;
    imageUrl?: string | null;
    institutionType: InstitutionType;
    trust?: { name: string } | null;
    address: string;
    city: string;
    county?: string | null;
    postalCode?: string | null;
    staffingNeeds?: string[];
    coverTypes: string[];
    typicalPupilCount?: number | null;
    verified: boolean;
    createdAt?: Date;
  }): InstitutionPublicProfileDto {
    return {
      id: entity.id,
      name: entity.name,
      imageUrl: entity.imageUrl ?? null,
      institutionType: entity.institutionType,
      trust: entity.trust ? { name: entity.trust.name } : null,
      address: entity.address,
      city: entity.city,
      county: entity.county ?? null,
      postalCode: entity.postalCode ?? null,
      staffingNeeds: entity.staffingNeeds ?? [],
      coverTypes: entity.coverTypes,
      typicalPupilCount: entity.typicalPupilCount ?? null,
      verified: entity.verified,
      memberSince: entity.createdAt ?? null,
    };
  }
}
```

### src/modules/institutions/dto/institution-response.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination.dto';
import { InstitutionType } from '@prisma/client';
import { ProfileStatus } from '../../../common/enums/profile-status.enum';

export class InstitutionTrustDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Oak Learning Trust' })
  name: string;

  @ApiPropertyOptional({ example: '08123456', nullable: true })
  companyNumber: string | null;
}

export class InstitutionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  imageUrl?: string | null;

  @ApiPropertyOptional()
  registrationId?: string | null;

  @ApiProperty({ example: 'greenfield.ac.uk' })
  domain: string;

  @ApiProperty({ example: '1 School Lane' })
  address: string;

  @ApiProperty({ example: 'London' })
  city: string;

  @ApiPropertyOptional({ example: 'Greater London', nullable: true })
  county?: string | null;

  @ApiPropertyOptional({ example: 'SW1A 2AA', nullable: true })
  postalCode?: string | null;

  @ApiProperty({ example: 'GB' })
  countryCode: string;

  @ApiPropertyOptional({
    example: 51.5014,
    nullable: true,
    description: 'Set by geocoding from the postcode; not client-supplied',
  })
  latitude?: number | null;

  @ApiPropertyOptional({
    example: -0.1419,
    nullable: true,
    description: 'Set by geocoding from the postcode; not client-supplied',
  })
  longitude?: number | null;

  @ApiProperty({
    type: [String],
    example: ['Mathematics', 'Science'],
    description: 'Catalogue subjects the school needs.',
  })
  staffingNeeds: string[];

  @ApiPropertyOptional({
    example: ['Same-day cover', 'Long-term roles'],
    isArray: true,
    type: String,
  })
  coverTypes: string[];

  @ApiPropertyOptional({ example: 420, nullable: true })
  typicalPupilCount?: number | null;

  @ApiPropertyOptional({ example: 'Jane Smith', nullable: true })
  complianceContact?: string | null;

  @ApiPropertyOptional({ example: 'safeguarding@greenfield.ac.uk', nullable: true })
  complianceEmail?: string | null;

  @ApiProperty({ example: true })
  safeguardingConfirmed: boolean;

  @ApiPropertyOptional({ example: 'Headteacher', nullable: true })
  userRole?: string | null;

  @ApiProperty({ example: false })
  verified: boolean;

  @ApiPropertyOptional({ example: 'PRO', nullable: true })
  subscriptionTier?: string | null;

  @ApiProperty({ enum: ProfileStatus, example: ProfileStatus.INCOMPLETE })
  status: ProfileStatus;

  @ApiProperty({ enum: InstitutionType, example: InstitutionType.SINGLE_SCHOOL })
  institutionType: InstitutionType;

  @ApiPropertyOptional({ type: InstitutionTrustDto, nullable: true, description: 'Set for MAT schools only' })
  trust: InstitutionTrustDto | null;

  @ApiPropertyOptional({ example: '2026-06-14T00:00:00.000Z' })
  createdAt?: Date;

  @ApiPropertyOptional({ example: '2026-06-14T00:00:00.000Z' })
  updatedAt?: Date;

  static fromEntity(entity: {
    id: string;
    userId: string;
    name: string;
    imageUrl?: string | null;
    registrationId?: string | null;
    domain: string;
    address: string;
    city: string;
    county?: string | null;
    postalCode?: string | null;
    countryCode: string;
    latitude?: number | null;
    longitude?: number | null;
    staffingNeeds?: string[];
    coverTypes: string[];
    typicalPupilCount?: number | null;
    complianceContact?: string | null;
    complianceEmail?: string | null;
    safeguardingConfirmed: boolean;
    userRole?: string | null;
    verified: boolean;
    subscriptionTier?: string | null;
    status: keyof typeof ProfileStatus;
    institutionType: InstitutionType;
    trust?: { id: string; name: string; companyNumber: string | null } | null;
    createdAt?: Date;
    updatedAt?: Date;
  }): InstitutionResponseDto {
    return {
      id: entity.id,
      userId: entity.userId,
      name: entity.name,
      imageUrl: entity.imageUrl,
      registrationId: entity.registrationId,
      domain: entity.domain,
      address: entity.address,
      city: entity.city,
      county: entity.county,
      postalCode: entity.postalCode,
      countryCode: entity.countryCode,
      latitude: entity.latitude,
      longitude: entity.longitude,
      staffingNeeds: entity.staffingNeeds ?? [],
      coverTypes: entity.coverTypes,
      typicalPupilCount: entity.typicalPupilCount,
      complianceContact: entity.complianceContact,
      complianceEmail: entity.complianceEmail,
      safeguardingConfirmed: entity.safeguardingConfirmed,
      userRole: entity.userRole,
      verified: entity.verified,
      subscriptionTier: entity.subscriptionTier,
      status: ProfileStatus[entity.status],
      institutionType: entity.institutionType,
      trust: entity.trust
        ? { id: entity.trust.id, name: entity.trust.name, companyNumber: entity.trust.companyNumber }
        : null,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}

export class PaginatedInstitutionsResponseDto {
  @ApiProperty({ type: [InstitutionResponseDto] })
  institutions: InstitutionResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination: PaginationMetaDto;
}
```

### src/modules/institutions/dto/trust-input.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/**
 * Companies House numbers are 8 characters: 8 digits, or a 2-letter prefix
 * (SC, NI, ...) and 6 digits. People often drop the leading zero or add
 * spaces, so the input is normalised before it is validated or matched.
 */
export function normaliseCompanyNumber(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const compact = value.replace(/\s+/g, '').toUpperCase();

  return /^\d{1,8}$/.test(compact) ? compact.padStart(8, '0') : compact;
}

export class TrustInputDto {
  @ApiProperty({ example: 'Oak Learning Trust', maxLength: 200 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({
    example: '08123456',
    description:
      "The trust's Companies House number. Schools entering the same number join the same trust; " +
      'without it a new trust is created.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normaliseCompanyNumber(value))
  @IsString()
  @Matches(/^(\d{8}|[A-Z]{2}\d{6})$/, { message: 'companyNumber must be a valid Companies House number' })
  companyNumber?: string;
}
```

### src/modules/institutions/dto/update-institution.dto.ts

```ts
import { PartialType } from '@nestjs/swagger';
import { CreateInstitutionDto } from './create-institution.dto';

export class UpdateInstitutionDto extends PartialType(CreateInstitutionDto) {}
```

### src/modules/instructors/dto/admin-update-instructor.dto.ts

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { ADMIN_PROFILE_STATUS_TARGETS } from '../../../common/dto/update-profile-status.dto';
import { ProfileStatus } from '../../../common/enums/profile-status.enum';
import { UpdateInstructorDto } from './update-instructor.dto';

export const ADMIN_INSTRUCTOR_STATUSES = ADMIN_PROFILE_STATUS_TARGETS;

export class AdminUpdateInstructorDto extends UpdateInstructorDto {
  @ApiPropertyOptional({ enum: ADMIN_INSTRUCTOR_STATUSES, example: ProfileStatus.ACTIVE })
  @IsOptional()
  @IsIn(ADMIN_INSTRUCTOR_STATUSES)
  status?: ProfileStatus;
}
```

### src/modules/instructors/dto/create-instructor.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  ArrayMaxSize,
  IsArray,
  IsISO31661Alpha2,
  IsISO4217CurrencyCode,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateInstructorDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ example: '1 School Lane' })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  address?: string;

  @ApiPropertyOptional({ example: 'London' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: 'Greater London' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  county?: string;

  @ApiPropertyOptional({ example: 'SW1A 2AA' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional({ example: 'GB', default: 'GB' })
  @IsOptional()
  @IsISO31661Alpha2()
  countryCode?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Catalogue skills belonging to selected subjects, or sharedSkills.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(100, { each: true })
  skills?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Custom skill names when skills includes Other. Stored as actual names in skills.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(100, { each: true })
  otherSkills?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Subject names from GET /api/teaching-catalogue.' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(100, { each: true })
  subjects?: string[];

  @ApiPropertyOptional({
    type: [String],
    description:
      'Custom subject names when subjects includes Other. Stored as actual names in the response subjects array.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(100, { each: true })
  otherSubjects?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  keyStages?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  hourlyRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  dailyRate?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  experience?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO4217CurrencyCode()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxTravelDistance?: number;
}
```

### src/modules/instructors/dto/instructor-directory-item.dto.ts

```ts
import { ApiProperty } from '@nestjs/swagger';
import { InstructorPublicProfileDto } from './instructor-public-profile.dto';

export class InstructorDirectoryItemDto extends InstructorPublicProfileDto {
  @ApiProperty({ description: 'Has an approved document whose document type code is QTS' })
  qtsQualified: boolean;

  @ApiProperty({ description: 'Has no confirmed booking overlapping today in UTC' })
  availableToday: boolean;

  static fromDirectoryEntity(
    entity: Parameters<typeof InstructorPublicProfileDto.fromEntity>[0] & {
      user: { documents: Array<{ id: string }> };
      bookings: Array<{ id: string }>;
    },
  ): InstructorDirectoryItemDto {
    return {
      ...InstructorPublicProfileDto.fromEntity(entity),
      qtsQualified: entity.user.documents.length > 0,
      availableToday: entity.bookings.length === 0,
    };
  }
}
```

### src/modules/instructors/dto/instructor-public-profile.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * What a school sees of a teacher. Data minimisation (UK GDPR): enough to
 * decide whether to hire them, nothing that locates or identifies them beyond
 * that. Their home address, postcode, coordinates, account ids and review
 * status stay private; the town and county give a rough area.
 */
export class InstructorPublicProfileDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Sarah Johnson' })
  fullName: string;

  @ApiPropertyOptional({ nullable: true })
  imageUrl: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Experienced mathematics teacher.' })
  bio: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Leeds' })
  city: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'West Yorkshire' })
  county: string | null;

  @ApiProperty({ type: [String] })
  subjects: string[];

  @ApiProperty({ type: [String] })
  skills: string[];

  @ApiProperty({ type: [String], example: ['KS2', 'KS3'] })
  keyStages: string[];

  @ApiPropertyOptional({ nullable: true, example: 6, description: 'Years of experience' })
  experience: number | null;

  @ApiPropertyOptional({ nullable: true, example: 30 })
  hourlyRate: number | null;

  @ApiPropertyOptional({ nullable: true, example: 180 })
  dailyRate: number | null;

  @ApiPropertyOptional({ nullable: true, example: 'GBP' })
  currency: string | null;

  @ApiProperty({ example: 4.8 })
  ratingAverage: number;

  @ApiProperty({ example: 12 })
  ratingCount: number;

  @ApiProperty({ description: 'Their DBS check has been verified' })
  dbsVerified: boolean;

  @ApiPropertyOptional({ description: 'When they joined SupplyEd' })
  memberSince: Date | null;

  static fromEntity(entity: {
    id: string;
    fullName: string;
    imageUrl?: string | null;
    bio?: string | null;
    city?: string | null;
    county?: string | null;
    subjects: string[];
    skills: string[];
    keyStages: string[];
    experience?: number | null;
    hourlyRate?: unknown;
    dailyRate?: unknown;
    currency?: string | null;
    ratingAverage: number;
    ratingCount: number;
    dbsVerified: boolean;
    createdAt?: Date;
  }): InstructorPublicProfileDto {
    return {
      id: entity.id,
      fullName: entity.fullName,
      imageUrl: entity.imageUrl ?? null,
      bio: entity.bio ?? null,
      city: entity.city ?? null,
      county: entity.county ?? null,
      subjects: entity.subjects,
      skills: entity.skills,
      keyStages: entity.keyStages,
      experience: entity.experience ?? null,
      hourlyRate: entity.hourlyRate != null ? Number(entity.hourlyRate) : null,
      dailyRate: entity.dailyRate != null ? Number(entity.dailyRate) : null,
      currency: entity.currency ?? null,
      ratingAverage: entity.ratingAverage,
      ratingCount: entity.ratingCount,
      dbsVerified: entity.dbsVerified,
      memberSince: entity.createdAt ?? null,
    };
  }
}
```

### src/modules/instructors/dto/instructor-response.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination.dto';
import { ProfileStatus } from '../../../common/enums/profile-status.enum';

export class InstructorResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  fullName: string;

  @ApiPropertyOptional()
  imageUrl?: string | null;

  @ApiPropertyOptional({
    example: 'Experienced mathematics instructor.',
    nullable: true,
  })
  bio?: string | null;

  @ApiPropertyOptional({ example: '1 School Lane', nullable: true })
  address?: string | null;

  @ApiPropertyOptional({ example: 'London', nullable: true })
  city?: string | null;

  @ApiPropertyOptional({ example: 'Greater London', nullable: true })
  county?: string | null;

  @ApiPropertyOptional({ example: 'SW1A 2AA', nullable: true })
  postalCode?: string | null;

  @ApiProperty({ example: 'GB' })
  countryCode: string;

  @ApiPropertyOptional({
    example: 51.5014,
    nullable: true,
    description: 'Set by geocoding from the postcode; not client-supplied',
  })
  latitude?: number | null;

  @ApiPropertyOptional({
    example: -0.1419,
    nullable: true,
    description: 'Set by geocoding from the postcode; not client-supplied',
  })
  longitude?: number | null;

  @ApiProperty({ example: ['Classroom management', 'SEN'] })
  skills: string[];

  @ApiProperty({ example: ['Mathematics', 'Physics'] })
  subjects: string[];

  @ApiProperty({ example: ['KS2', 'KS3', 'KS4'] })
  keyStages: string[];

  @ApiPropertyOptional({ example: 25.5, nullable: true })
  hourlyRate?: number | null;

  @ApiPropertyOptional({ example: 180, nullable: true })
  dailyRate?: number | null;

  @ApiPropertyOptional({ example: 5, nullable: true })
  experience?: number | null;

  @ApiPropertyOptional({ example: 'GBP', nullable: true })
  currency?: string | null;

  @ApiPropertyOptional({ example: 25, nullable: true })
  maxTravelDistance?: number | null;

  @ApiProperty({ example: 4.8 })
  ratingAverage: number;

  @ApiProperty({ example: 12 })
  ratingCount: number;

  @ApiProperty({ example: false })
  dbsVerified: boolean;

  @ApiProperty({ enum: ProfileStatus, example: ProfileStatus.INCOMPLETE })
  status: ProfileStatus;

  @ApiPropertyOptional({ example: '2026-06-14T00:00:00.000Z' })
  createdAt?: Date;

  @ApiPropertyOptional({ example: '2026-06-14T00:00:00.000Z' })
  updatedAt?: Date;

  static fromEntity(entity: {
    id: string;
    userId: string;
    fullName: string;
    imageUrl?: string | null;
    bio?: string | null;
    address?: string | null;
    city?: string | null;
    county?: string | null;
    postalCode?: string | null;
    countryCode: string;
    latitude?: number | null;
    longitude?: number | null;
    skills: string[];
    subjects: string[];
    keyStages: string[];
    hourlyRate?: unknown;
    dailyRate?: unknown;
    experience?: number | null;
    currency?: string | null;
    maxTravelDistance?: number | null;
    ratingAverage: number;
    ratingCount: number;
    dbsVerified: boolean;
    status: keyof typeof ProfileStatus;
    createdAt?: Date;
    updatedAt?: Date;
  }): InstructorResponseDto {
    return {
      id: entity.id,
      userId: entity.userId,
      fullName: entity.fullName,
      imageUrl: entity.imageUrl,
      bio: entity.bio,
      address: entity.address,
      city: entity.city,
      county: entity.county,
      postalCode: entity.postalCode,
      countryCode: entity.countryCode,
      latitude: entity.latitude,
      longitude: entity.longitude,
      skills: entity.skills,
      subjects: entity.subjects,
      keyStages: entity.keyStages,
      hourlyRate: entity.hourlyRate != null ? Number(entity.hourlyRate) : null,
      dailyRate: entity.dailyRate != null ? Number(entity.dailyRate) : null,
      experience: entity.experience,
      currency: entity.currency,
      maxTravelDistance: entity.maxTravelDistance,
      ratingAverage: entity.ratingAverage,
      ratingCount: entity.ratingCount,
      dbsVerified: entity.dbsVerified,
      status: ProfileStatus[entity.status],
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}

export class PaginatedInstructorsResponseDto {
  @ApiProperty({ type: [InstructorResponseDto] })
  instructors: InstructorResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination: PaginationMetaDto;
}
```

### src/modules/instructors/dto/list-instructor-directory-query.dto.ts

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const trimmed = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || undefined : value);
const booleanValue = ({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value);

export class ListInstructorDirectoryQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({ description: 'Matches teacher name, city or county', maxLength: 100 })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ example: 'Mathematics' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  subject?: string;

  @ApiPropertyOptional({ example: 'KS2' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(30)
  keyStage?: string;

  @ApiPropertyOptional({ example: 'SEN' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  skill?: string;

  @ApiPropertyOptional({ example: 'Leeds' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(booleanValue)
  @IsBoolean()
  dbsVerified?: boolean;

  @ApiPropertyOptional({ description: 'Has an approved document whose document type code is QTS' })
  @IsOptional()
  @Transform(booleanValue)
  @IsBoolean()
  qtsQualified?: boolean;

  @ApiPropertyOptional({ description: 'Has no confirmed booking overlapping today in UTC' })
  @IsOptional()
  @Transform(booleanValue)
  @IsBoolean()
  availableToday?: boolean;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minExperience?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxHourlyRate?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxDailyRate?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;
}
```

### src/modules/instructors/dto/update-instructor.dto.ts

```ts
import { PartialType } from '@nestjs/swagger';
import { CreateInstructorDto } from './create-instructor.dto';

export class UpdateInstructorDto extends PartialType(CreateInstructorDto) {}
```

### src/modules/jobs/dto/create-job.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsISO31661Alpha2,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

/** True when the client sent either coordinate, so the other becomes required too. */
const hasAnyCoordinate = (dto: { latitude?: number; longitude?: number }) =>
  dto.latitude !== undefined || dto.longitude !== undefined;

export enum PayType {
  HOURLY = 'hourly',
  DAILY = 'daily',
  FIXED = 'fixed',
}

export class CreateJobDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional({
    deprecated: true,
    description: 'Legacy single subject. Prefer subjects from GET /api/teaching-catalogue.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  subject?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Multiple catalogue subject names. Skills must belong to these subjects or sharedSkills.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(100, { each: true })
  subjects?: string[];

  @ApiPropertyOptional({
    type: [String],
    description:
      'Custom subject names when subjects includes Other. Stored as actual names in the response subjects array.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(100, { each: true })
  otherSubjects?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['Classroom management', 'SEN'],
    description: 'Skills the poster wants an applicant to hold; matched against instructor skills',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(100, { each: true })
  requiredSkills?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Custom skill names when requiredSkills includes Other. Stored as actual names in requiredSkills.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(100, { each: true })
  otherSkills?: string[];

  @ApiPropertyOptional({ example: 2, description: 'Minimum years of teaching experience an applicant should have' })
  @IsOptional()
  @IsInt()
  @Min(0)
  minExperienceYears?: number;

  @ApiPropertyOptional({ example: '1 School Lane' })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  address?: string;

  @ApiPropertyOptional({ example: 'London' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: 'Greater London' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  county?: string;

  @ApiPropertyOptional({ example: 'SW1A 2AA' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional({ example: 'GB', default: 'GB' })
  @IsOptional()
  @IsISO31661Alpha2()
  countryCode?: string;

  @ApiPropertyOptional({
    example: 51.5014,
    minimum: -90,
    maximum: 90,
    description: 'Latitude of the job address. Must be sent together with longitude',
  })
  @ValidateIf(hasAnyCoordinate)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({
    example: -0.1419,
    minimum: -180,
    maximum: 180,
    description: 'Longitude of the job address. Must be sent together with latitude',
  })
  @ValidateIf(hasAnyCoordinate)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  keyStages?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  parkingInfo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  payAmount?: number;

  @ApiPropertyOptional({ description: 'hourly | daily | fixed' })
  @IsOptional()
  @IsString()
  @IsEnum(PayType)
  payType?: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Listing opens at this timestamp, or at midnight Europe/London for YYYY-MM-DD. Independent of startDate. Null means immediately once ACTIVE.',
    example: '2026-10-20T00:00:00+01:00',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  liveFrom?: string | null;

  @ApiPropertyOptional({
    description:
      'Exclusive timestamp deadline, or inclusive final Europe/London day for YYYY-MM-DD. Then the job is hidden and applications close.',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  expiresAt?: string;
}
```

### src/modules/jobs/dto/job-response.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JobStatus } from '@prisma/client';
import { jobSubjects } from '../../teaching-catalogue/teaching-catalogue';

export class JobResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  postedByUserId: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Safe public identity of the school behind the job; null for an admin-posted job',
  })
  institution: { id: string; name: string; imageUrl: string | null } | null;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiPropertyOptional({ nullable: true })
  subject?: string | null;

  @ApiProperty({ type: [String], description: 'All selected subjects; subject is the first value for older clients.' })
  subjects: string[];

  @ApiProperty({ type: [String] })
  requiredSkills: string[];

  @ApiPropertyOptional({ nullable: true })
  minExperienceYears?: number | null;

  @ApiPropertyOptional({ nullable: true })
  address?: string | null;

  @ApiPropertyOptional({ nullable: true })
  city?: string | null;

  @ApiPropertyOptional({ nullable: true })
  county?: string | null;

  @ApiPropertyOptional({ nullable: true })
  postalCode?: string | null;

  @ApiProperty({ example: 'GB' })
  countryCode: string;

  @ApiPropertyOptional({ example: 51.5014, nullable: true })
  latitude?: number | null;

  @ApiPropertyOptional({ example: -0.1419, nullable: true })
  longitude?: number | null;

  @ApiPropertyOptional({ nullable: true })
  startDate?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  endDate?: Date | null;

  @ApiProperty({ type: [String] })
  keyStages: string[];

  @ApiPropertyOptional({ nullable: true })
  parkingInfo?: string | null;

  @ApiPropertyOptional({ nullable: true })
  payAmount?: number | null;

  @ApiPropertyOptional({ nullable: true })
  payType?: string | null;

  @ApiProperty({ enum: JobStatus })
  status: JobStatus;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Public listing opens at this timestamp, provided status is ACTIVE.',
  })
  liveFrom?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  expiresAt?: Date | null;

  @ApiPropertyOptional()
  createdAt?: Date;

  @ApiPropertyOptional()
  updatedAt?: Date;

  static fromEntity(entity: {
    id: string;
    postedByUserId: string;
    postedBy?: {
      institutionProfile?: { id: string; imageUrl: string | null; name: string } | null;
    };
    title: string;
    description: string;
    subject?: string | null;
    subjects?: string[];
    requiredSkills: string[];
    minExperienceYears?: number | null;
    address?: string | null;
    city?: string | null;
    county?: string | null;
    postalCode?: string | null;
    countryCode: string;
    latitude?: number | null;
    longitude?: number | null;
    startDate?: Date | null;
    endDate?: Date | null;
    keyStages: string[];
    parkingInfo?: string | null;
    payAmount?: unknown;
    payType?: string | null;
    status: JobStatus;
    liveFrom?: Date | null;
    expiresAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
  }): JobResponseDto {
    return {
      id: entity.id,
      postedByUserId: entity.postedByUserId,
      institution: entity.postedBy?.institutionProfile ?? null,
      title: entity.title,
      description: entity.description,
      subject: entity.subject,
      subjects: jobSubjects(entity),
      requiredSkills: entity.requiredSkills,
      minExperienceYears: entity.minExperienceYears,
      address: entity.address,
      city: entity.city,
      county: entity.county,
      postalCode: entity.postalCode,
      countryCode: entity.countryCode,
      latitude: entity.latitude,
      longitude: entity.longitude,
      startDate: entity.startDate,
      endDate: entity.endDate,
      keyStages: entity.keyStages,
      parkingInfo: entity.parkingInfo,
      payAmount: entity.payAmount != null ? Number(entity.payAmount) : null,
      payType: entity.payType,
      status: entity.status,
      liveFrom: entity.liveFrom ?? null,
      expiresAt: entity.expiresAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
```

### src/modules/jobs/dto/list-jobs-query.dto.ts

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { JobStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const trimmed = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || undefined : value);

export class ListJobsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

/** Paging plus the filters a job board offers. */
export class SearchJobsQueryDto extends ListJobsQueryDto {
  @ApiPropertyOptional({
    description: 'Matches the title, description, subject, town, county, postcode or a required skill',
    maxLength: 100,
  })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ example: 'Maths', description: 'Exact subject, ignoring case' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  subject?: string;

  @ApiPropertyOptional({ example: 'KS2', description: 'Jobs that include this key stage' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(20)
  keyStage?: string;

  @ApiPropertyOptional({ description: 'true: only jobs whose listing expires within 2 days' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  urgent?: boolean;
}

/** The poster's own jobs, which can also be narrowed by status. */
export class ListMyJobsQueryDto extends SearchJobsQueryDto {
  @ApiPropertyOptional({ enum: JobStatus })
  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;
}
```

### src/modules/jobs/dto/paginated-jobs-response.dto.ts

```ts
import { ApiProperty } from '@nestjs/swagger';
import { JobResponseDto } from './job-response.dto';

export class JobsPaginationDto {
  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  total: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty()
  hasNextPage: boolean;
}

export class PaginatedJobsResponseDto {
  @ApiProperty({ type: [JobResponseDto] })
  jobs: JobResponseDto[];

  @ApiProperty({ type: JobsPaginationDto })
  pagination: JobsPaginationDto;
}

/** How many of the poster's jobs are in each status, ignoring the status filter and paging. */
export class JobStatusCountsDto {
  @ApiProperty({ description: 'Every job they posted' })
  ALL: number;

  @ApiProperty()
  DRAFT: number;

  @ApiProperty()
  ACTIVE: number;

  @ApiProperty()
  EXPIRED: number;

  @ApiProperty()
  CLOSED: number;

  @ApiProperty()
  SUSPENDED: number;
}

export class MyJobsResponseDto extends PaginatedJobsResponseDto {
  @ApiProperty({ type: JobStatusCountsDto })
  statusCounts: JobStatusCountsDto;
}
```

### src/modules/jobs/dto/update-job.dto.ts

```ts
import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { JobStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateJobDto } from './create-job.dto';

export class UpdateJobDto extends PartialType(CreateJobDto) {
  @ApiPropertyOptional({ enum: JobStatus, example: JobStatus.ACTIVE })
  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;
}
```

### src/modules/matching/dto/match-list-query.dto.ts

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class MatchListQueryDto {
  @ApiPropertyOptional({ default: 0, minimum: 0, maximum: 100, description: 'Hide matches scoring below this' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minScore = 0;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
```

### src/modules/matching/dto/match-responses.dto.ts

```ts
import { ApiProperty } from '@nestjs/swagger';
import { ApplicationResponseDto } from '../../applications/dto/application-response.dto';
import { JobResponseDto } from '../../jobs/dto/job-response.dto';
import { MatchScoreDto } from './match-score.dto';
import { MatchedInstructorDto } from './matched-instructor.dto';

export class MatchPaginationDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 45 })
  total: number;

  @ApiProperty({ example: 3 })
  totalPages: number;

  @ApiProperty({ example: true })
  hasNextPage: boolean;
}

export class RankedApplicationDto {
  @ApiProperty({ type: ApplicationResponseDto })
  application: ApplicationResponseDto;

  @ApiProperty({ type: MatchedInstructorDto })
  instructor: MatchedInstructorDto;

  @ApiProperty({ type: MatchScoreDto })
  match: MatchScoreDto;
}

export class PaginatedRankedApplicationsResponseDto {
  @ApiProperty({ type: [RankedApplicationDto] })
  applications: RankedApplicationDto[];

  @ApiProperty({ type: MatchPaginationDto })
  pagination: MatchPaginationDto;
}

export class RecommendedInstructorDto {
  @ApiProperty({ type: MatchedInstructorDto })
  instructor: MatchedInstructorDto;

  @ApiProperty({ type: MatchScoreDto })
  match: MatchScoreDto;
}

export class PaginatedRecommendedInstructorsResponseDto {
  @ApiProperty({ type: [RecommendedInstructorDto] })
  instructors: RecommendedInstructorDto[];

  @ApiProperty({ type: MatchPaginationDto })
  pagination: MatchPaginationDto;
}

export class RecommendedJobDto {
  @ApiProperty({ type: JobResponseDto })
  job: JobResponseDto;

  @ApiProperty({ type: MatchScoreDto })
  match: MatchScoreDto;
}

export class PaginatedRecommendedJobsResponseDto {
  @ApiProperty({ type: [RecommendedJobDto] })
  jobs: RecommendedJobDto[];

  @ApiProperty({ type: MatchPaginationDto })
  pagination: MatchPaginationDto;
}
```

### src/modules/matching/dto/match-score.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { MatchResult } from '../match-scorer';
import { MATCH_FACTOR_KEYS } from '../match-weights';
import type { MatchFactorKey } from '../match-weights';

export class MatchFactorDto {
  @ApiProperty({ enum: MATCH_FACTOR_KEYS, example: 'subject' })
  key: MatchFactorKey;

  @ApiProperty({ example: 'Subject' })
  label: string;

  @ApiProperty({ example: 25 })
  weight: number;

  @ApiProperty({ example: 1, minimum: 0, maximum: 1, description: 'Unweighted contribution' })
  value: number;

  @ApiProperty({ example: true, description: 'False when the job gives nothing to compare on' })
  applicable: boolean;

  @ApiProperty({ example: 'Teaches Mathematics' })
  detail: string;
}

export class MatchFlagsDto {
  @ApiProperty({ example: false, description: 'Hired on another job whose dates overlap' })
  scheduleConflict: boolean;

  @ApiProperty({ example: false, description: 'Further away than the instructor is willing to travel' })
  outsideTravelRadius: boolean;

  @ApiProperty({
    example: true,
    description: 'Both sides had coordinates, so distance is real rather than a text guess',
  })
  distanceKnown: boolean;
}

export class MatchScoreDto {
  @ApiProperty({ example: 89, minimum: 0, maximum: 100 })
  score: number;

  @ApiPropertyOptional({ example: 4.1, nullable: true })
  distanceMiles: number | null;

  @ApiProperty({ type: [MatchFactorDto] })
  factors: MatchFactorDto[];

  @ApiProperty({ type: MatchFlagsDto })
  flags: MatchFlagsDto;

  static fromResult(result: MatchResult): MatchScoreDto {
    return {
      score: result.score,
      distanceMiles: result.distanceMiles,
      factors: result.factors.map((factor) => ({ ...factor })),
      flags: { ...result.flags },
    };
  }
}
```

### src/modules/matching/dto/matched-instructor.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * What a job poster sees about a candidate. Deliberately narrower than the
 * full instructor response: no street address, postcode, coordinates or
 * profile status, since the poster is a third party to that data.
 */
export class MatchedInstructorDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Alex Morgan' })
  fullName: string;

  @ApiPropertyOptional({ nullable: true })
  imageUrl?: string | null;

  @ApiPropertyOptional({ example: 'London', nullable: true })
  city?: string | null;

  @ApiPropertyOptional({ example: 'Greater London', nullable: true })
  county?: string | null;

  @ApiProperty({ example: ['Mathematics', 'Physics'] })
  subjects: string[];

  @ApiProperty({ example: ['KS3', 'KS4'] })
  keyStages: string[];

  @ApiProperty({ example: ['SEN'] })
  skills: string[];

  @ApiPropertyOptional({ example: 5, nullable: true })
  experience?: number | null;

  @ApiPropertyOptional({ example: 28, nullable: true })
  hourlyRate?: number | null;

  @ApiPropertyOptional({ example: 180, nullable: true })
  dailyRate?: number | null;

  @ApiPropertyOptional({ example: 'GBP', nullable: true })
  currency?: string | null;

  @ApiPropertyOptional({ example: 10, nullable: true })
  maxTravelDistance?: number | null;

  @ApiProperty({ example: 4.5 })
  ratingAverage: number;

  @ApiProperty({ example: 8 })
  ratingCount: number;

  @ApiProperty({ example: true })
  dbsVerified: boolean;

  static fromEntity(entity: {
    id: string;
    fullName: string;
    imageUrl?: string | null;
    city?: string | null;
    county?: string | null;
    subjects: string[];
    keyStages: string[];
    skills: string[];
    experience?: number | null;
    hourlyRate?: unknown;
    dailyRate?: unknown;
    currency?: string | null;
    maxTravelDistance?: number | null;
    ratingAverage: number;
    ratingCount: number;
    dbsVerified: boolean;
  }): MatchedInstructorDto {
    return {
      id: entity.id,
      fullName: entity.fullName,
      imageUrl: entity.imageUrl,
      city: entity.city,
      county: entity.county,
      subjects: entity.subjects,
      keyStages: entity.keyStages,
      skills: entity.skills,
      experience: entity.experience,
      hourlyRate: entity.hourlyRate != null ? Number(entity.hourlyRate) : null,
      dailyRate: entity.dailyRate != null ? Number(entity.dailyRate) : null,
      currency: entity.currency,
      maxTravelDistance: entity.maxTravelDistance,
      ratingAverage: entity.ratingAverage,
      ratingCount: entity.ratingCount,
      dbsVerified: entity.dbsVerified,
    };
  }
}
```

### src/modules/notifications/dto/list-notifications-query.dto.ts

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class ListNotificationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'true: only unread notifications' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  unread?: boolean;
}
```

### src/modules/notifications/dto/notification-preferences.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class NotificationPreferencesDto {
  @ApiProperty({ description: 'Email me jobs that strongly match my profile (teachers)' })
  emailJobMatches: boolean;

  @ApiProperty({ description: 'Email me about messages I have not read after a while' })
  emailMessages: boolean;

  @ApiProperty({ description: 'Email me about applications, bookings and reviews' })
  emailUpdates: boolean;
}

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailJobMatches?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailMessages?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailUpdates?: boolean;
}
```

### src/modules/notifications/dto/notification-response.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Notification, NotificationType } from '@prisma/client';
import { PaginationMetaDto } from '../../../common/dto/pagination.dto';

export class NotificationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: NotificationType })
  type: NotificationType;

  @ApiProperty({ example: 'New job match: Year 6 Maths cover' })
  title: string;

  @ApiProperty({ example: 'Oakfield Primary, Leeds · 92% match' })
  body: string;

  @ApiPropertyOptional({ nullable: true, example: '/job-detail?jobId=...', description: 'App page to open' })
  link: string | null;

  @ApiProperty({ type: 'object', additionalProperties: true, description: 'Ids and details for the app' })
  data: Record<string, unknown>;

  @ApiPropertyOptional({ nullable: true })
  readAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  static fromEntity(entity: Notification): NotificationResponseDto {
    return {
      id: entity.id,
      type: entity.type,
      title: entity.title,
      body: entity.body,
      link: entity.link,
      data: entity.data && typeof entity.data === 'object' && !Array.isArray(entity.data) ? entity.data : {},
      readAt: entity.readAt,
      createdAt: entity.createdAt,
    };
  }
}

export class PaginatedNotificationsResponseDto {
  @ApiProperty({ type: [NotificationResponseDto] })
  notifications: NotificationResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination: PaginationMetaDto;

  @ApiProperty({ example: 3 })
  unreadCount: number;
}

export class NotificationUnreadCountDto {
  @ApiProperty({ example: 3 })
  total: number;
}

export class NotificationsReadAllResponseDto {
  @ApiProperty({ example: 3, description: 'How many were marked read' })
  updated: number;
}
```

### src/modules/payments/dto/create-invoice.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateInvoiceDto {
  @ApiProperty({ format: 'uuid', description: 'A completed booking' })
  @IsUUID()
  bookingId!: string;

  @ApiPropertyOptional({
    example: 4.5,
    minimum: 0.01,
    maximum: 9999.99,
    description: 'Days (daily rate) or hours (hourly rate) worked, up to two decimal places. Omit for a fixed price',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9999.99)
  unitsWorked?: number;

  @ApiPropertyOptional({ example: 'PO-2026-0412', maxLength: 100, description: "The school's purchase order number" })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  poNumber?: string;
}
```

### src/modules/payments/dto/embedded-session.dto.ts

```ts
import { ApiProperty } from '@nestjs/swagger';

export class PayoutSessionResponseDto {
  @ApiProperty({
    description:
      "Account Session client secret for Stripe's Connect embedded components (onboarding, notification banner, " +
      "payouts). Pass it to the teacher's browser only; fetch a new one when it expires.",
  })
  clientSecret: string;

  @ApiProperty({ example: 'pk_test_...', description: "Stripe's publishable key to load the components with" })
  publishableKey: string;

  @ApiProperty()
  expiresAt: Date;
}

export class InvoicePaymentSessionResponseDto {
  @ApiProperty({ description: "Client secret of the invoice's payment, for Stripe's Payment Element" })
  clientSecret: string;

  @ApiProperty({
    description: "Customer Session client secret: shows the school's saved cards and lets it save new ones",
  })
  customerSessionClientSecret: string;

  @ApiProperty({ example: 'pk_test_...', description: "Stripe's publishable key to load the Payment Element with" })
  publishableKey: string;

  @ApiProperty({ example: 11000, description: 'What is left to pay, in pence' })
  amountPence: number;

  @ApiProperty({ example: 'gbp' })
  currency: string;
}
```

### src/modules/payments/dto/invoice-response.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceStatus } from '@prisma/client';
import type { InvoiceWithBooking } from '../invoices.repository';

export class InvoicePartyDto {
  @ApiProperty({ description: 'Profile ID, not the login user ID' })
  id: string;

  @ApiProperty({ description: 'Login user ID' })
  userId: string;

  @ApiProperty()
  name: string;
}

export class InvoiceBookingSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  jobId: string;

  @ApiProperty()
  jobTitle: string;

  @ApiPropertyOptional({ nullable: true })
  startDate: Date | null;

  @ApiPropertyOptional({ nullable: true })
  endDate: Date | null;

  @ApiProperty({ type: InvoicePartyDto })
  instructor: InvoicePartyDto;

  @ApiProperty({ type: InvoicePartyDto })
  institution: InvoicePartyDto;
}

export class InvoiceResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: String, nullable: true, description: 'User who created the invoice; not necessarily its payer' })
  createdById: string | null;

  @ApiProperty({ enum: InvoiceStatus })
  status: InvoiceStatus;

  @ApiProperty({ type: InvoiceBookingSummaryDto })
  booking: InvoiceBookingSummaryDto;

  @ApiProperty({ example: 'daily', description: 'hourly | daily | fixed' })
  payType: string;

  @ApiProperty({ example: 180, description: 'Agreed rate in pounds' })
  rateAmount: number;

  @ApiPropertyOptional({ example: 4.5, nullable: true, description: 'Hours or days billed; null for a fixed price' })
  unitsWorked: number | null;

  @ApiProperty({ example: 81000, description: "The teacher's pay, in pence" })
  teacherAmountPence: number;

  @ApiProperty({ example: 10125, description: "SupplyEd's processing fee, in pence" })
  feeAmountPence: number;

  @ApiProperty({ example: 91125, description: 'What the school pays, in pence' })
  totalAmountPence: number;

  @ApiProperty({ example: 'gbp' })
  currency: string;

  @ApiPropertyOptional({ nullable: true })
  poNumber: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'A1B2C3D4-0001', description: "Stripe's invoice number" })
  invoiceNumber: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Stripe page where the school views and pays the invoice' })
  hostedInvoiceUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  invoicePdfUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  dueAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  paidAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  voidedAt: Date | null;

  @ApiProperty({ example: 0 })
  amountRefundedPence: number;

  @ApiPropertyOptional({
    nullable: true,
    example: 'needs_response',
    description: "Stripe's dispute status when the school disputed the payment",
  })
  disputeStatus: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(entity: InvoiceWithBooking): InvoiceResponseDto {
    const { booking } = entity;

    return {
      id: entity.id,
      createdById: entity.createdById,
      status: entity.status,
      booking: {
        id: booking.id,
        jobId: booking.job.id,
        jobTitle: booking.job.title,
        startDate: booking.startDate,
        endDate: booking.endDate,
        instructor: { id: booking.instructor.id, userId: booking.instructor.userId, name: booking.instructor.fullName },
        institution: { id: booking.institution.id, userId: booking.institution.userId, name: booking.institution.name },
      },
      payType: entity.payType,
      rateAmount: Number(entity.rateAmount),
      unitsWorked: entity.unitsWorked != null ? Number(entity.unitsWorked) : null,
      teacherAmountPence: entity.teacherAmountPence,
      feeAmountPence: entity.feeAmountPence,
      totalAmountPence: entity.totalAmountPence,
      currency: entity.currency,
      poNumber: entity.poNumber,
      invoiceNumber: entity.stripeInvoiceNumber,
      hostedInvoiceUrl: entity.hostedInvoiceUrl,
      invoicePdfUrl: entity.invoicePdfUrl,
      dueAt: entity.dueAt,
      paidAt: entity.paidAt,
      voidedAt: entity.voidedAt,
      amountRefundedPence: entity.amountRefundedPence,
      disputeStatus: entity.disputeStatus,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}

export class InvoicesPaginationDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 45 })
  total: number;

  @ApiProperty({ example: 3 })
  totalPages: number;

  @ApiProperty({ example: true })
  hasNextPage: boolean;
}

export class PaginatedInvoicesResponseDto {
  @ApiProperty({ type: [InvoiceResponseDto] })
  invoices: InvoiceResponseDto[];

  @ApiProperty({ type: InvoicesPaginationDto })
  pagination: InvoicesPaginationDto;
}
```

### src/modules/payments/dto/job-payments-response.dto.ts

```ts
import { ApiProperty } from '@nestjs/swagger';
import { InvoiceStatus, JobStatus } from '@prisma/client';
import { PaginationMetaDto } from '../../../common/dto/pagination.dto';
import type { InvoiceWithBooking } from '../invoices.repository';
import { InvoiceResponseDto } from './invoice-response.dto';

export class JobPaymentInvoiceDto extends InvoiceResponseDto {
  @ApiProperty({ type: String, nullable: true })
  stripeInvoiceId: string | null;

  @ApiProperty({ type: String, nullable: true })
  stripePaymentIntentId: string | null;

  @ApiProperty({ description: 'Instructor Stripe account recorded when this invoice was created' })
  destinationAccountId: string;

  static fromEntity(entity: InvoiceWithBooking): JobPaymentInvoiceDto {
    return {
      ...InvoiceResponseDto.fromEntity(entity),
      stripeInvoiceId: entity.stripeInvoiceId,
      stripePaymentIntentId: entity.stripePaymentIntentId,
      destinationAccountId: entity.destinationAccountId,
    };
  }
}

export class PaymentJobDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ enum: JobStatus })
  status: JobStatus;

  @ApiProperty()
  postedByUserId: string;
}

export class JobPaymentTotalsDto {
  @ApiProperty()
  currency: string;

  @ApiProperty({ enum: InvoiceStatus })
  status: InvoiceStatus;

  @ApiProperty()
  invoiceCount: number;

  @ApiProperty()
  teacherAmountPence: number;

  @ApiProperty()
  feeAmountPence: number;

  @ApiProperty()
  totalAmountPence: number;

  @ApiProperty({ description: 'Recorded refund total; not a bank settlement confirmation' })
  amountRefundedPence: number;
}

export class JobPaymentsResponseDto {
  @ApiProperty({ type: PaymentJobDto })
  job: PaymentJobDto;

  @ApiProperty({ description: 'All bookings for this job, including cancelled and no-show bookings' })
  bookingCount: number;

  @ApiProperty({ description: 'Completed bookings with no non-VOID invoice' })
  completedBookingsWithoutInvoice: number;

  @ApiProperty({ type: [JobPaymentTotalsDto], description: 'Whole-job totals, independent of page and status filter' })
  totalsByStatus: JobPaymentTotalsDto[];

  @ApiProperty({ type: [JobPaymentInvoiceDto] })
  invoices: JobPaymentInvoiceDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination: PaginationMetaDto;
}
```

### src/modules/payments/dto/list-invoices-query.dto.ts

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/** Statuses a teacher or school can filter by. PENDING is internal: the invoice has not reached anyone yet. */
export const PARTY_VISIBLE_INVOICE_STATUSES = [
  InvoiceStatus.OPEN,
  InvoiceStatus.PAID,
  InvoiceStatus.VOID,
  InvoiceStatus.UNCOLLECTIBLE,
] as const;

class InvoicePageQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class ListMyInvoicesQueryDto extends InvoicePageQueryDto {
  @ApiPropertyOptional({ enum: PARTY_VISIBLE_INVOICE_STATUSES })
  @IsOptional()
  @IsIn(PARTY_VISIBLE_INVOICE_STATUSES)
  status?: (typeof PARTY_VISIBLE_INVOICE_STATUSES)[number];
}

export class JobInvoicesQueryDto extends InvoicePageQueryDto {
  @ApiPropertyOptional({ enum: InvoiceStatus })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;
}

export class AdminListInvoicesQueryDto extends JobInvoicesQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  jobId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  bookingId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Instructor profile id' })
  @IsOptional()
  @IsUUID()
  instructorId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Institution profile id' })
  @IsOptional()
  @IsUUID()
  institutionId?: string;
}
```

### src/modules/payments/dto/payout-account-response.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PayoutAccountResponseDto {
  @ApiProperty({ description: 'False until the teacher has started payout setup' })
  connected: boolean;

  @ApiProperty({ description: 'True once the teacher can be paid; their bookings can then be invoiced' })
  ready: boolean;

  @ApiProperty()
  detailsSubmitted: boolean;

  @ApiProperty()
  chargesEnabled: boolean;

  @ApiProperty()
  payoutsEnabled: boolean;

  @ApiProperty({ type: [String], description: 'What Stripe still needs from the teacher' })
  requirementsDue: string[];

  @ApiPropertyOptional({ nullable: true, description: "Stripe's reason when the account is disabled" })
  disabledReason: string | null;

  static fromEntity(
    account: {
      detailsSubmitted: boolean;
      chargesEnabled: boolean;
      payoutsEnabled: boolean;
      requirementsDue: string[];
      disabledReason: string | null;
    } | null,
  ): PayoutAccountResponseDto {
    if (!account) {
      return {
        connected: false,
        ready: false,
        detailsSubmitted: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        requirementsDue: [],
        disabledReason: null,
      };
    }

    return {
      connected: true,
      ready: account.chargesEnabled && account.payoutsEnabled,
      detailsSubmitted: account.detailsSubmitted,
      chargesEnabled: account.chargesEnabled,
      payoutsEnabled: account.payoutsEnabled,
      requirementsDue: account.requirementsDue,
      disabledReason: account.disabledReason,
    };
  }
}

export class StripeLinkResponseDto {
  @ApiProperty({ description: 'Single-use Stripe page to send the teacher to' })
  url: string;

  @ApiPropertyOptional({ nullable: true, description: 'When the link stops working; request a new one after that' })
  expiresAt: Date | null;
}
```

### src/modules/payments/dto/payout-balance.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class InstantPayoutDto {
  @ApiPropertyOptional({
    example: 10000,
    minimum: 40,
    description: 'Pence to withdraw. Omit to withdraw everything available',
  })
  @IsOptional()
  @IsInt()
  @Min(40)
  amountPence?: number;
}

export class PayoutSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 10000 })
  amountPence: number;

  @ApiProperty({ example: 'instant', description: 'instant | standard' })
  method: string;

  @ApiProperty({ example: 'in_transit', description: 'pending | in_transit | paid | failed | canceled' })
  status: string;

  @ApiProperty({ description: 'When the money is expected in the bank' })
  arrivalDate: Date;
}

export class PayoutDestinationDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Barclays ****2345' })
  label: string;
}

export class PayoutBalanceResponseDto {
  @ApiProperty({ example: 0, description: 'Paid by schools, not yet released for a standard payout' })
  pendingPence: number;

  @ApiProperty({ example: 0, description: "Released; paid out on Stripe's automatic schedule" })
  availablePence: number;

  @ApiProperty({ example: 10000, description: 'What can be withdrawn instantly now' })
  instantAvailablePence: number;

  @ApiPropertyOptional({
    type: PayoutDestinationDto,
    nullable: true,
    description: 'Null when nothing linked supports instant payouts',
  })
  instantDestination: PayoutDestinationDto | null;

  @ApiProperty({ type: [PayoutSummaryDto] })
  recentPayouts: PayoutSummaryDto[];
}
```

### src/modules/payments/dto/refund-invoice.dto.ts

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

export const REFUND_REASONS = ['duplicate', 'fraudulent', 'requested_by_customer'] as const;
export type RefundReason = (typeof REFUND_REASONS)[number];

export class RefundInvoiceDto {
  @ApiPropertyOptional({
    example: 2000,
    minimum: 1,
    description: 'Pence to refund. Omit to refund everything not yet refunded',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  amountPence?: number;

  @ApiPropertyOptional({ enum: REFUND_REASONS })
  @IsOptional()
  @IsIn(REFUND_REASONS)
  reason?: RefundReason;
}
```

### src/modules/phone-verification/dto/phone-verification.dto.ts

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class SendPhoneOtpDto {
  @ApiProperty({
    example: '+447911123456',
    description: 'Mobile number to verify. Numbers without a +country prefix are read as UK numbers.',
    maxLength: 30,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone!: string;
}

export class VerifyPhoneOtpDto {
  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/, { message: 'otp must be a 6 digit code' })
  otp!: string;
}

export class PhoneOtpResponseDto {
  @ApiProperty({ example: '+447911123456', description: 'The number the code was sent to, in E.164 format' })
  phone: string;

  @ApiProperty({ example: 10 })
  expiresInMinutes: number;

  @ApiProperty({ example: 60, description: 'Seconds before another code can be requested' })
  resendAvailableInSeconds: number;
}
```

### src/modules/reviews/dto/create-review.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({ format: 'uuid', description: 'A completed booking the caller was a party to' })
  @IsUUID()
  bookingId!: string;

  @ApiProperty({ minimum: 1, maximum: 5, example: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ maxLength: 2000, example: 'Well prepared and great with the class.' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
```

### src/modules/reviews/dto/list-reviews-query.dto.ts

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListReviewsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
```

### src/modules/reviews/dto/paginated-reviews-response.dto.ts

```ts
import { ApiProperty } from '@nestjs/swagger';
import { ReviewResponseDto } from './review-response.dto';

export class ReviewsPaginationDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 45 })
  total: number;

  @ApiProperty({ example: 3 })
  totalPages: number;

  @ApiProperty({ example: true })
  hasNextPage: boolean;
}

export class PaginatedReviewsResponseDto {
  @ApiProperty({ type: [ReviewResponseDto] })
  reviews: ReviewResponseDto[];

  @ApiProperty({ type: ReviewsPaginationDto })
  pagination: ReviewsPaginationDto;
}
```

### src/modules/reviews/dto/review-response.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReviewerType } from '@prisma/client';

interface ReviewEntity {
  id: string;
  bookingId: string;
  reviewerType: ReviewerType;
  rating: number;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class ReviewResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  bookingId: string;

  @ApiProperty({ enum: ReviewerType, description: 'Who wrote the review; it is about the other party' })
  reviewerType: ReviewerType;

  @ApiProperty({ minimum: 1, maximum: 5, example: 5 })
  rating: number;

  @ApiPropertyOptional({ nullable: true })
  comment: string | null;

  @ApiPropertyOptional({ description: 'Title of the job the booking was for. Present on profile review lists' })
  jobTitle?: string;

  @ApiPropertyOptional({ description: 'School or teacher name of the author. Present on profile review lists' })
  reviewerName?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(
    entity: ReviewEntity,
    context: { jobTitle?: string; reviewerName?: string } = {},
  ): ReviewResponseDto {
    return {
      id: entity.id,
      bookingId: entity.bookingId,
      reviewerType: entity.reviewerType,
      rating: entity.rating,
      comment: entity.comment,
      ...context,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
```

### src/modules/signatory-approvals/dto/decide-signatory-approval.dto.ts

```ts
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Equals, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ApproveSignatoryRequestDto {
  @ApiProperty({ example: true, description: 'The signatory must accept the terms shown on the approval page' })
  @Equals(true, { message: 'acceptTerms must be true to approve' })
  acceptTerms!: boolean;
}

export class DeclineSignatoryRequestDto {
  @ApiProperty({ example: 'This school is not part of our trust', maxLength: 1000 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}
```

### src/modules/signatory-approvals/dto/list-signatory-approvals-query.dto.ts

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SignatoryApprovalStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ListSignatoryApprovalsQueryDto {
  @ApiPropertyOptional({ enum: SignatoryApprovalStatus })
  @IsOptional()
  @IsEnum(SignatoryApprovalStatus)
  status?: SignatoryApprovalStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  trustId?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
```

### src/modules/signatory-approvals/dto/request-signatory-approval.dto.ts

```ts
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { normalizeEmail } from '../../../common/transforms/normalize-email.transform';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class RequestSignatoryApprovalDto {
  @ApiProperty({ example: 'Jane Smith', maxLength: 200 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  signatoryName!: string;

  @ApiProperty({ example: 'jane.smith@oaktrust.org.uk', description: 'Must be someone other than the requester' })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  signatoryEmail!: string;

  @ApiProperty({ example: 'Chief Financial Officer', maxLength: 150 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  signatoryJobTitle!: string;
}
```

### src/modules/signatory-approvals/dto/signatory-approval-response.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SignatoryApprovalStatus } from '@prisma/client';
import type { SignatoryApprovalWithContext } from '../signatory-approvals.repository';

export class SignatoryTrustDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Oak Learning Trust' })
  name: string;

  @ApiPropertyOptional({ example: '08123456', nullable: true })
  companyNumber: string | null;
}

export class SignatorySchoolDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Oak Primary School' })
  name: string;

  @ApiPropertyOptional({ nullable: true, description: 'School URN or registration number' })
  registrationId: string | null;

  @ApiProperty({ example: 'oakprimary.sch.uk' })
  domain: string;

  @ApiProperty()
  address: string;

  @ApiProperty()
  city: string;

  @ApiPropertyOptional({ nullable: true })
  postalCode: string | null;
}

/** What the school and admins see about a request. Never carries the link token. */
export class SignatoryApprovalResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: SignatoryApprovalStatus })
  status: SignatoryApprovalStatus;

  @ApiProperty({ type: SignatorySchoolDto })
  school: SignatorySchoolDto;

  @ApiProperty({ type: SignatoryTrustDto })
  trust: SignatoryTrustDto;

  @ApiProperty()
  signatoryName: string;

  @ApiProperty()
  signatoryEmail: string;

  @ApiProperty()
  signatoryJobTitle: string;

  @ApiProperty()
  expiresAt: Date;

  @ApiPropertyOptional({ nullable: true })
  decidedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  declineReason: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Terms version the signatory accepted' })
  termsVersion: string | null;

  @ApiProperty({ description: 'True when an admin approved after verifying the signatory offline' })
  approvedByAdmin: boolean;

  @ApiProperty()
  createdAt: Date;

  static fromEntity(entity: SignatoryApprovalWithContext): SignatoryApprovalResponseDto {
    return {
      id: entity.id,
      status: entity.status,
      school: SignatoryApprovalResponseDto.school(entity),
      trust: entity.trust,
      signatoryName: entity.signatoryName,
      signatoryEmail: entity.signatoryEmail,
      signatoryJobTitle: entity.signatoryJobTitle,
      expiresAt: entity.expiresAt,
      decidedAt: entity.decidedAt,
      declineReason: entity.declineReason,
      termsVersion: entity.termsVersion,
      approvedByAdmin: entity.overriddenById !== null,
      createdAt: entity.createdAt,
    };
  }

  static school(entity: SignatoryApprovalWithContext): SignatorySchoolDto {
    const { id, name, registrationId, domain, address, city, postalCode } = entity.institution;

    return { id, name, registrationId, domain, address, city, postalCode };
  }
}

/** What the signatory sees on the public approval page, reached only through the emailed link. */
export class SignatoryApprovalReviewDto {
  @ApiProperty({ enum: SignatoryApprovalStatus })
  status: SignatoryApprovalStatus;

  @ApiProperty({ type: SignatorySchoolDto })
  school: SignatorySchoolDto;

  @ApiProperty({ type: SignatoryTrustDto })
  trust: SignatoryTrustDto;

  @ApiProperty()
  signatoryName: string;

  @ApiProperty()
  signatoryJobTitle: string;

  @ApiProperty({ description: 'Email of the school user who made the request' })
  requestedBy: string;

  @ApiProperty()
  expiresAt: Date;

  @ApiProperty({ example: '2026-09', description: 'Terms version the signatory is asked to accept' })
  termsVersion: string;

  static fromEntity(entity: SignatoryApprovalWithContext, termsVersion: string): SignatoryApprovalReviewDto {
    return {
      status: entity.status,
      school: SignatoryApprovalResponseDto.school(entity),
      trust: entity.trust,
      signatoryName: entity.signatoryName,
      signatoryJobTitle: entity.signatoryJobTitle,
      requestedBy: entity.institution.user.email,
      expiresAt: entity.expiresAt,
      termsVersion: entity.termsVersion ?? termsVersion,
    };
  }
}

export class SignatoryApprovalsPaginationDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 45 })
  total: number;

  @ApiProperty({ example: 3 })
  totalPages: number;

  @ApiProperty({ example: true })
  hasNextPage: boolean;
}

export class PaginatedSignatoryApprovalsResponseDto {
  @ApiProperty({ type: [SignatoryApprovalResponseDto] })
  approvals: SignatoryApprovalResponseDto[];

  @ApiProperty({ type: SignatoryApprovalsPaginationDto })
  pagination: SignatoryApprovalsPaginationDto;
}
```

### src/modules/two-factor/dto/two-factor.dto.ts

```ts
import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class EnableTwoFactorDto {
  @ApiProperty({ example: '123456', description: 'Current 6-digit code from the authenticator app' })
  @Matches(/^\d{6}$/, { message: 'code must be a 6 digit authenticator code' })
  code!: string;
}

export class VerifyTwoFactorDto {
  @ApiProperty({
    example: '123456',
    description: 'Current 6-digit authenticator code or a one-time recovery code',
  })
  @Matches(/^(?:\d{6}|[A-HJ-NP-Z2-9]{4}(?:-[A-HJ-NP-Z2-9]{4}){3})$/i, {
    message: 'code must be a 6 digit authenticator code or a valid recovery code',
  })
  code!: string;
}

export class TwoFactorSetupResponseDto {
  @ApiProperty({ description: 'Manual-entry key; show it only during setup' })
  secret!: string;

  @ApiProperty({ description: 'Google Authenticator-compatible TOTP provisioning URI' })
  otpAuthUri!: string;

  @ApiProperty({ description: 'PNG QR code encoded as a data URL' })
  qrCodeDataUrl!: string;
}

export class TwoFactorRecoveryCodesResponseDto {
  @ApiProperty({
    type: [String],
    description: 'One-time recovery codes. They are returned only when generated.',
  })
  recoveryCodes!: string[];
}

export class TwoFactorEnableResponseDto extends TwoFactorRecoveryCodesResponseDto {
  @ApiProperty({ example: true })
  enabled!: boolean;
}

export class TwoFactorStatusResponseDto {
  @ApiProperty({ example: true })
  enabled!: boolean;

  @ApiProperty({ example: false })
  setupPending!: boolean;

  @ApiProperty({ example: 10 })
  recoveryCodesRemaining!: number;
}

export class TwoFactorDisableResponseDto {
  @ApiProperty({ example: false })
  enabled!: boolean;
}

export class TwoFactorChallengeResponseDto {
  @ApiProperty({ example: true })
  twoFactorRequired!: boolean;

  @ApiProperty({ description: 'Short-lived token accepted only by POST /auth/2fa/verify' })
  twoFactorToken!: string;

  @ApiProperty({ example: 5 })
  expiresInMinutes!: number;
}
```

### src/modules/users/dto/admin-create-user.dto.ts

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { RegisterDto } from '../../auth/dto/register.dto';

export class AdminCreateUserDto extends RegisterDto {
  @ApiPropertyOptional({ example: 'Alex Morgan', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: '+923001234567', maxLength: 30 })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ default: false })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsBoolean()
  emailVerified?: boolean;

  @ApiPropertyOptional({ default: false })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsBoolean()
  phoneVerified?: boolean;
}
```

### src/modules/users/dto/admin-update-user.dto.ts

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, ValidateIf } from 'class-validator';
import { Role } from '../../../common/enums/role.enum';
import { UpdateUserDto } from './update-user.dto';

export class AdminUpdateUserDto extends UpdateUserDto {
  @ApiPropertyOptional({ enum: Role, example: Role.INSTRUCTOR })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ description: 'Whether the email address has been verified', example: true })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsBoolean()
  emailVerified?: boolean;

  @ApiPropertyOptional({ description: 'Whether the current phone number has been verified', example: true })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsBoolean()
  phoneVerified?: boolean;
}
```

### src/modules/users/dto/admin-user-response.dto.ts

```ts
import { ApiProperty } from '@nestjs/swagger';
import { ProfileStatus } from '../../../common/enums/profile-status.enum';
import { Role } from '../../../common/enums/role.enum';
import { UserResponseDto } from './user-response.dto';

type ProfileSummary = { countryCode: string; status: ProfileStatus };

export class AdminUserResponseDto extends UserResponseDto {
  @ApiProperty({
    example: 'PK',
    nullable: true,
    description: 'Country of the current role profile; null without a profile',
  })
  countryCode: string | null;

  @ApiProperty({ enum: ProfileStatus, nullable: true })
  profileStatus: ProfileStatus | null;

  static fromUser(
    user: Parameters<typeof UserResponseDto.fromUser>[0] & {
      instructorProfile?: ProfileSummary | null;
      institutionProfile?: ProfileSummary | null;
    },
  ): AdminUserResponseDto {
    const profile =
      user.role === Role.INSTRUCTOR
        ? user.instructorProfile
        : user.role === Role.INSTITUTION
          ? user.institutionProfile
          : null;

    return {
      ...UserResponseDto.fromUser(user),
      countryCode: profile?.countryCode ?? null,
      profileStatus: profile?.status ?? null,
    };
  }
}
```

### src/modules/users/dto/list-users-query.dto.ts

```ts
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsISO31661Alpha2,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ProfileStatus } from '../../../common/enums/profile-status.enum';
import { Role } from '../../../common/enums/role.enum';

export class ListUsersQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({ description: 'Case-insensitive email or name search', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ enum: ['ADMIN', 'USERS'], description: 'Admins only, or every non-admin role' })
  @IsOptional()
  @IsIn(['ADMIN', 'USERS'])
  accountType?: 'ADMIN' | 'USERS';

  @ApiPropertyOptional({ enum: ProfileStatus, description: 'Filter by the status of the role profile' })
  @IsOptional()
  @IsEnum(ProfileStatus)
  profileStatus?: ProfileStatus;

  @ApiPropertyOptional({ enum: ProfileStatus, description: 'Alias for profileStatus' })
  @IsOptional()
  @IsEnum(ProfileStatus)
  status?: ProfileStatus;

  @ApiPropertyOptional({
    type: String,
    example: 'GB,PK',
    description: 'Comma-separated ISO country codes from the role profile',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    const countries = typeof value === 'string' ? value.split(',') : value;
    return Array.isArray(countries)
      ? countries.map((country: unknown) => (typeof country === 'string' ? country.trim().toUpperCase() : country))
      : countries;
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsISO31661Alpha2({ each: true })
  countries?: string[];

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  emailVerified?: boolean;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  phoneVerified?: boolean;

  @ApiPropertyOptional({
    example: '2026-09-01',
    description: 'Inclusive creation date/time (UTC for date-only values)',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  createdFrom?: string;

  @ApiPropertyOptional({
    example: '2026-09-30',
    description: 'Inclusive creation date/time; date-only values include the whole UTC day',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  createdTo?: string;

  @ApiPropertyOptional({
    example: '2026-09-17',
    description: 'Joined on this UTC date; use instead of createdFrom/createdTo',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  joined?: string;

  @ApiPropertyOptional({ enum: ['createdAt', 'joined', 'lastLogin'], default: 'createdAt' })
  @IsOptional()
  @IsIn(['createdAt', 'joined', 'lastLogin'])
  sortBy?: 'createdAt' | 'joined' | 'lastLogin';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
```

### src/modules/users/dto/paginated-users-response.dto.ts

```ts
import { ApiProperty } from '@nestjs/swagger';
import { AdminUserResponseDto } from './admin-user-response.dto';

export class UsersPaginationDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 45 })
  total: number;

  @ApiProperty({ example: 3 })
  totalPages: number;

  @ApiProperty({ example: true })
  hasNextPage: boolean;
}

export class PaginatedUsersResponseDto {
  @ApiProperty({ type: [AdminUserResponseDto] })
  users: AdminUserResponseDto[];

  @ApiProperty({ type: UsersPaginationDto })
  pagination: UsersPaginationDto;
}
```

### src/modules/users/dto/profile-image-upload.dto.ts

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';

export const PROFILE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

export class ProfileImageUploadUrlDto {
  @ApiProperty({ enum: PROFILE_IMAGE_TYPES })
  @IsIn(PROFILE_IMAGE_TYPES)
  contentType!: (typeof PROFILE_IMAGE_TYPES)[number];

  @ApiProperty({ minimum: 1, maximum: MAX_PROFILE_IMAGE_BYTES })
  @IsInt()
  @Min(1)
  @Max(MAX_PROFILE_IMAGE_BYTES)
  sizeBytes!: number;
}

export class CompleteProfileImageUploadDto {
  @ApiProperty({ description: 'The fileKey returned by the upload-url endpoint' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  fileKey!: string;
}

export class ProfileImageResponseDto {
  @ApiProperty({ nullable: true, description: 'Short-lived signed URL for displaying the image' })
  imageUrl!: string | null;

  @ApiProperty({ nullable: true })
  expiresAt!: Date | null;
}
```

### src/modules/users/dto/update-user.dto.ts

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Abdul Waheed' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '09123456789' })
  @IsOptional()
  @IsString()
  phone?: string;
}
```

### src/modules/users/dto/user-response.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '../../../common/enums/role.enum';

export class UserResponseDto {
  @ApiProperty({ example: 'b1b0f2bc-46fd-4f01-8c45-52e2b5fb84da' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiPropertyOptional({ example: 'Abdul Waheed', nullable: true })
  name?: string | null;

  @ApiProperty({ enum: Role, example: Role.INSTRUCTOR })
  role: Role;

  @ApiProperty({ example: false })
  emailVerified: boolean;

  @ApiProperty({ example: false })
  phoneVerified: boolean;

  @ApiPropertyOptional({ example: '+923001234567', nullable: true })
  phone?: string | null;

  @ApiPropertyOptional({ example: '2026-06-14T00:00:00.000Z', nullable: true })
  lastLogin?: Date | null;

  @ApiProperty({ example: false })
  twoFactorEnabled: boolean;

  @ApiPropertyOptional({ example: '2026-06-14T00:00:00.000Z' })
  createdAt?: Date;

  @ApiPropertyOptional({ example: '2026-06-14T00:00:00.000Z' })
  updatedAt?: Date;

  static fromUser(user: {
    id: string;
    email: string;
    name?: string | null;
    role: Role;
    emailVerified?: boolean;
    phoneVerified?: boolean;
    phone?: string | null;
    lastLogin?: Date | null;
    twoFactorEnabled?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
  }): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified ?? false,
      phoneVerified: user.phoneVerified ?? false,
      phone: user.phone,
      lastLogin: user.lastLogin,
      twoFactorEnabled: user.twoFactorEnabled ?? false,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
```

### src/common/dto/api-response.dto.ts

```ts
import { ApiProperty } from '@nestjs/swagger';

export class ResponseMetadataDto {
  @ApiProperty({ example: '7cb8c09a-7687-480f-9f74-6f5f6cbaf9dd' })
  requestId: string;

  @ApiProperty({ example: '2026-07-23T10:15:30.000Z' })
  timestamp: string;

  @ApiProperty({ example: '/documents' })
  path: string;

  @ApiProperty({ example: 'GET' })
  method: string;
}

export class ApiResponseDto<TData = unknown> {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: 'Success' })
  message: string;

  @ApiProperty()
  data: TData | null;

  @ApiProperty({ type: ResponseMetadataDto })
  meta: ResponseMetadataDto;
}
```

### src/common/dto/list-profiles-query.dto.ts

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ProfileStatus } from '../enums/profile-status.enum';
import { PaginationQueryDto } from './pagination.dto';

/** The admin's list of teacher or school profiles. */
export class ListProfilesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ProfileStatus, description: 'Only profiles in this review status' })
  @IsOptional()
  @IsEnum(ProfileStatus)
  status?: ProfileStatus;

  @ApiPropertyOptional({ description: "Matches the name, town, postcode or the account's email", maxLength: 100 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || undefined : value))
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid', description: "Only this user's profile (a page of at most one)" })
  @IsOptional()
  @IsUUID()
  userId?: string;
}
```

### src/common/dto/pagination.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** `page` and `limit` query parameters; extend it to add a list's own filters. */
export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class PaginationMetaDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 45 })
  total: number;

  @ApiProperty({ example: 3 })
  totalPages: number;

  @ApiProperty({ example: true })
  hasNextPage: boolean;
}

/** The rows to skip for a page. */
export const pageOffset = (query: PaginationQueryDto) => (query.page - 1) * query.limit;

export function paginationMeta(query: PaginationQueryDto, total: number): PaginationMetaDto {
  const totalPages = Math.ceil(total / query.limit);

  return { page: query.page, limit: query.limit, total, totalPages, hasNextPage: query.page < totalPages };
}
```

### src/common/dto/update-profile-status.dto.ts

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { ProfileStatus } from '../enums/profile-status.enum';

export const ADMIN_PROFILE_STATUS_TARGETS = [
  ProfileStatus.INCOMPLETE,
  ProfileStatus.PENDING,
  ProfileStatus.ACTIVE,
  ProfileStatus.SUSPENDED,
  ProfileStatus.DEACTIVATED,
  ProfileStatus.REJECTED,
] as const;

export class AdminUpdateProfileStatusDto {
  @ApiProperty({ enum: ADMIN_PROFILE_STATUS_TARGETS, example: ProfileStatus.ACTIVE })
  @IsIn(ADMIN_PROFILE_STATUS_TARGETS)
  status: (typeof ADMIN_PROFILE_STATUS_TARGETS)[number];
}
```

### src/modules/teaching-catalogue/teaching-catalogue.ts (selection validation)

```ts
import { BadRequestException } from '@nestjs/common';
import { TEACHING_CATALOGUE } from './teaching-catalogue.data';

export const MAX_TEACHING_SELECTIONS = 50;
export const OTHER_SUBJECT = 'Other';
export const catalogueKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
export const SUBJECTS = TEACHING_CATALOGUE.categories.flatMap((category) => category.subjects);
const subjectsByName = new Map(
  SUBJECTS.flatMap((subject) =>
    [subject.name, ...subject.aliases].map((name) => [catalogueKey(name), subject.name] as const),
  ),
);
const skillsByName = new Map(
  [...TEACHING_CATALOGUE.sharedSkills, ...SUBJECTS.flatMap((subject) => subject.skills)].map((name) => [
    catalogueKey(name),
    name,
  ]),
);

/** Only unambiguous spelling/legacy aliases; each resolves to a catalogue value. */
const SKILL_ALIASES: Record<string, string> = {
  'differentiated instruction': 'Adaptive Teaching',
  'differentiated learning': 'Adaptive Teaching',
  safeguarding: 'Safeguarding Awareness',
  'phonics instruction': 'Phonics Teaching',
  phonics: 'Phonics Teaching',
  'play based activities': 'Play-Based Learning',
  'individual progress tracking': 'Progress Monitoring',
  'technical drawings': 'Technical Drawing',
  cad: 'Computer-Aided Design (CAD)',
  'cad modelling': 'Computer-Aided Design (CAD)',
  'student engagement': 'Pupil Engagement',
  'behavior management': 'Behaviour Management',
  sen: 'SEND Support',
  send: 'SEND Support',
  'special educational needs': 'SEND Support',
};

export const resolveSubject = (value: string) => subjectsByName.get(catalogueKey(value));
export const validateStaffingNeeds = (value: unknown, otherSubjects: unknown = []) =>
  validateSubjects(value, otherSubjects, 'staffingNeeds subjects');
export function resolveSkill(value: string): string | undefined {
  const key = catalogueKey(value);
  return skillsByName.get(key) ?? (Object.hasOwn(SKILL_ALIASES, key) ? SKILL_ALIASES[key] : undefined);
}

function invalid(code: string, message: string): never {
  throw new BadRequestException({ code, message });
}

function selected(raw: unknown, field: string, resolve: (value: string) => string | undefined): string[] {
  if (
    !Array.isArray(raw) ||
    raw.length > MAX_TEACHING_SELECTIONS ||
    raw.some((value) => typeof value !== 'string' || value.length > 100)
  ) {
    return invalid(
      'INVALID_TEACHING_SELECTION',
      `${field} must be a list of up to 50 catalogue names, each no longer than 100 characters.`,
    );
  }
  const names = raw as string[];
  const unknown = names.filter((name) => !resolve(name));
  if (unknown.length)
    return invalid(
      'INVALID_TEACHING_SELECTION',
      `Choose ${field} from the teaching catalogue. Unrecognised values: ${unknown.join(', ')}.`,
    );
  return [...new Set(names.map((name) => resolve(name)!))];
}

/** Custom names are accepted only through the explicit Other flow, never as catalogue additions. */
function validateSubjects(raw: unknown, otherSubjects: unknown, field = 'subjects'): string[] {
  const choices = selected(raw, field, resolveSubject);
  if (!Array.isArray(otherSubjects) || otherSubjects.length > MAX_TEACHING_SELECTIONS) {
    return invalid('INVALID_OTHER_SUBJECTS', 'otherSubjects must be a list of up to 50 subject names.');
  }
  const custom = new Map<string, string>();
  for (const value of otherSubjects as unknown[]) {
    if (typeof value !== 'string' || value.length > 100 || /\p{Cc}/u.test(value) || !catalogueKey(value)) {
      return invalid(
        'INVALID_OTHER_SUBJECTS',
        'Each other subject must contain a name of 1–100 characters, without control characters.',
      );
    }
    const name = value.trim().replace(/\s+/gu, ' ');
    if (resolveSubject(name)) {
      return invalid(
        'INVALID_OTHER_SUBJECTS',
        `Select ${resolveSubject(name)} from the catalogue instead of entering it as an other subject.`,
      );
    }
    if (!custom.has(catalogueKey(name))) custom.set(catalogueKey(name), name);
  }
  if (choices.includes(OTHER_SUBJECT) !== custom.size > 0) {
    return invalid(
      'INVALID_OTHER_SUBJECTS',
      'Select Other and enter at least one other subject, or remove Other and clear otherSubjects.',
    );
  }
  const subjects = [...choices.filter((name) => name !== OTHER_SUBJECT), ...custom.values()];
  if (subjects.length > MAX_TEACHING_SELECTIONS)
    return invalid('INVALID_OTHER_SUBJECTS', 'Select up to 50 subjects in total, including other subjects.');
  return subjects;
}

/** Reconstruct editor choices from stored names for safe partial updates. */
function storedChoices(values: string[]) {
  const subjects = [...new Set(values.map(resolveSubject).filter((value): value is string => Boolean(value)))];
  const otherSubjects = values.filter((value) => !resolveSubject(value));
  if (otherSubjects.length) subjects.push(OTHER_SUBJECT);
  return { subjects, otherSubjects };
}

export function schoolTeachingSelection(
  input: { staffingNeeds?: string[]; otherSubjects?: string[] },
  existing?: { staffingNeeds: string[] },
): { staffingNeeds?: string[] } {
  if (existing && input.staffingNeeds === undefined && input.otherSubjects === undefined) return {};
  const stored = storedChoices(existing?.staffingNeeds ?? []);
  return {
    staffingNeeds: validateStaffingNeeds(
      input.staffingNeeds === undefined ? stored.subjects : input.staffingNeeds,
      input.otherSubjects === undefined ? stored.otherSubjects : input.otherSubjects,
    ),
  };
}

/** Shared skills plus the union of skills for the selected catalogue subjects. */
export function validateTeachingSelection(
  subjects: unknown,
  skills: unknown,
  skillsField = 'skills',
  otherSubjects: unknown = [],
) {
  const canonicalSubjects = validateSubjects(subjects, otherSubjects);
  const canonicalSkills = selected(skills, skillsField, resolveSkill);
  const allowed = new Set([
    ...TEACHING_CATALOGUE.sharedSkills,
    ...SUBJECTS.filter((subject) => canonicalSubjects.includes(subject.name)).flatMap((subject) => subject.skills),
  ]);
  const unrelated = canonicalSkills.filter((skill) => !allowed.has(skill));
  if (unrelated.length)
    invalid(
      'SKILL_SUBJECT_MISMATCH',
      `These ${skillsField} do not belong to the selected subjects: ${unrelated.join(', ')}. Select the relevant subject or remove these skills.`,
    );
  return { subjects: canonicalSubjects, skills: canonicalSkills };
}

export function profileTeachingSelection(
  input: { subjects?: string[]; skills?: string[]; otherSubjects?: string[] },
  existing?: { subjects: string[]; skills: string[] },
): { subjects?: string[]; skills?: string[] } {
  if (existing && input.subjects === undefined && input.skills === undefined && input.otherSubjects === undefined)
    return {};
  const stored = storedChoices(existing?.subjects ?? []);
  return validateTeachingSelection(
    input.subjects === undefined ? stored.subjects : input.subjects,
    input.skills === undefined ? (existing?.skills ?? []) : input.skills,
    'skills',
    input.otherSubjects === undefined ? stored.otherSubjects : input.otherSubjects,
  );
}

/** Legacy single-subject jobs remain readable without claiming unknown labels are approved. */
export function jobSubjects(job: { subjects?: string[]; subject?: string | null }): string[] {
  return job.subjects?.length ? job.subjects : job.subject ? [job.subject] : [];
}

export function jobTeachingSelection(
  input: { subjects?: string[]; subject?: string | null; requiredSkills?: string[]; otherSubjects?: string[] },
  existing?: { subjects?: string[]; subject?: string | null; requiredSkills: string[] },
): { subjects?: string[]; subject?: string | null; requiredSkills?: string[] } {
  const hasSubjects = input.subjects !== undefined;
  const hasLegacy = input.subject !== undefined;
  if (existing && !hasSubjects && !hasLegacy && input.requiredSkills === undefined && input.otherSubjects === undefined)
    return {};
  const stored = storedChoices(existing ? jobSubjects(existing) : []);
  const rawSubjects = hasSubjects
    ? input.subjects
    : hasLegacy
      ? input.subject === null
        ? []
        : [input.subject]
      : stored.subjects;
  const selection = validateTeachingSelection(
    rawSubjects,
    input.requiredSkills === undefined ? (existing?.requiredSkills ?? []) : input.requiredSkills,
    'requiredSkills',
    input.otherSubjects === undefined ? stored.otherSubjects : input.otherSubjects,
  );
  if (hasSubjects && hasLegacy) {
    const legacy = input.subject == null ? '' : catalogueKey(resolveSubject(input.subject) ?? input.subject);
    if (legacy !== catalogueKey(selection.subjects[0] ?? ''))
      invalid('CONFLICTING_JOB_SUBJECTS', 'Send subjects only, or make subject match the first selected subject.');
  }
  return { subjects: selection.subjects, subject: selection.subjects[0] ?? null, requiredSkills: selection.skills };
}
```

### Prisma enum definitions referenced by DTOs

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

enum ProfileStatus {
  INCOMPLETE
  PENDING
  ACTIVE
  SUSPENDED
  DEACTIVATED
  REJECTED
}

enum JobStatus {
  DRAFT
  ACTIVE
  EXPIRED
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

enum NotificationType {
  JOB_INVITATION
  JOB_INVITATION_STATUS
  JOB_MATCH
  APPLICATION_RECEIVED
  APPLICATION_STATUS
  BOOKING_CONFIRMED
  BOOKING_CANCELLED
  BOOKING_COMPLETED
  INVOICE_PAID
  PROFILE_STATUS
  REVIEW_RECEIVED
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

### src/common/enums/profile-status.enum.ts

```ts
export enum ProfileStatus {
  INCOMPLETE = 'INCOMPLETE',
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DEACTIVATED = 'DEACTIVATED',
  REJECTED = 'REJECTED',
}
```

### src/common/enums/role.enum.ts

```ts
export enum Role {
  INSTRUCTOR = 'INSTRUCTOR',
  INSTITUTION = 'INSTITUTION',
  ADMIN = 'ADMIN',
}

/** Roles a user can pick for themselves at signup. ADMIN is assigned by an admin only. */
export const SIGNUP_ROLES = [Role.INSTRUCTOR, Role.INSTITUTION] as const;
export type SignupRole = (typeof SIGNUP_ROLES)[number];
```


### Current dropdown backend contract source

#### src/modules/dropdowns/dropdowns.dto.ts

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class DropdownOptionInput {
  @ApiProperty({ example: 'mathematics' })
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9_-]{0,119}$/)
  key: string;

  @ApiProperty({ example: 'Mathematics', description: 'Immutable value submitted in profile/job requests.' })
  @IsString()
  @Length(1, 100)
  value: string;

  @ApiProperty({ example: 'Mathematics' })
  @IsString()
  @Length(1, 200)
  label: string;

  @ApiPropertyOptional({ type: [String] })
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  @Length(1, 100, { each: true })
  aliases?: string[];

  @ApiPropertyOptional({ example: 'Core Subjects', nullable: true })
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @Length(1, 100)
  group?: string | null;

  @ApiPropertyOptional()
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;

  @ApiPropertyOptional()
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Skill available for every subject selection.' })
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isShared?: boolean;

  @ApiPropertyOptional({ type: [String], example: ['mathematics'] })
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(250)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/^[a-z0-9][a-z0-9_-]{0,119}$/, { each: true })
  subjectKeys?: string[];
}

export class UpdateDropdownDto {
  @ApiProperty({ example: 1, description: 'Revision from the most recent GET; rejects stale writes.' })
  @IsInt()
  @Min(1)
  revision: number;

  @ApiPropertyOptional()
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Length(1, 200)
  label?: string;

  @ApiPropertyOptional()
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    type: [DropdownOptionInput],
    description: 'Upsert only these entries; omitted options are retained.',
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(250)
  @ArrayUnique((option: DropdownOptionInput | null | undefined) => option?.key)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => DropdownOptionInput)
  options?: DropdownOptionInput[];
}

export class DeleteDropdownDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  revision: number;

  @ApiPropertyOptional({ type: [String], description: 'Retire these options. Omit to retire the entire dropdown.' })
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(250)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  optionKeys?: string[];
}
```

#### src/modules/dropdowns/dropdowns.controller.ts

```ts
import { Body, Controller, Delete, Get, Header, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Role } from '../../common/enums/role.enum';
import { DeleteDropdownDto, UpdateDropdownDto } from './dropdowns.dto';
import { DropdownsService } from './dropdowns.service';

@ApiTags('Dropdowns')
@Controller('dropdowns')
export class DropdownsController {
  constructor(private readonly dropdowns: DropdownsService) {}

  @Get()
  @Public()
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Dropdowns fetched successfully')
  list() {
    return this.dropdowns.list();
  }

  @Get('admin')
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Dropdowns fetched successfully')
  adminList() {
    return this.dropdowns.list(true);
  }

  @Get('admin/:name')
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Get all options, including retired entries, for administration' })
  @ResponseMessage('Dropdown fetched successfully')
  adminDetail(@Param('name') name: string) {
    return this.dropdowns.detail(name, true);
  }

  @Get(':name')
  @Public()
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Dropdown fetched successfully')
  detail(@Param('name') name: string) {
    return this.dropdowns.detail(name);
  }

  @Patch(':name')
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ResponseMessage('Dropdown updated successfully')
  update(@Param('name') name: string, @Body() dto: UpdateDropdownDto) {
    return this.dropdowns.update(name, dto);
  }

  @Delete(':name')
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retire a dropdown or selected options without altering existing records' })
  @ResponseMessage('Dropdown deleted successfully')
  remove(@Param('name') name: string, @Body() dto: DeleteDropdownDto) {
    return this.dropdowns.remove(name, dto);
  }
}
```

## Appendix C. Current web-normalized contracts and adapters

These are the final web types and selected pure adapters, included so a mobile agent can see the presentation transformations. The DTOs above remain the wire contract. In particular, web settings numeric strings, lowercase profile states, joined display subjects, and ActionResult are not necessarily backend JSON types.

### features/applications/types.ts

```ts
export type JobApplicationStatus = "APPLIED" | "HIRED" | "REJECTED" | "SHORTLISTED" | "VIEWED";

export type ApplicantSummary = {
  city?: string | null;
  county?: string | null;
  dbsVerified: boolean;
  experience?: number | null;
  fullName: string;
  id: string;
  imageUrl?: string | null;
  keyStages: string[];
  ratingAverage: number;
  ratingCount: number;
  skills: string[];
  subjects: string[];
};

export type JobApplication = {
  coverLetter?: string | null;
  createdAt?: string | null;
  id: string;
  instructor?: ApplicantSummary;
  instructorId: string;
  jobId: string;
  /** The backend saves the job's title when the application is submitted. */
  jobName?: string | null;
  status: JobApplicationStatus;
  updatedAt?: string | null;
};

export type ApplicationCreateInput = {
  coverLetter?: string;
  jobId: string;
};

export type ApplicationStatusUpdateInput = { id: string; status: JobApplicationStatus };

export type ApplicationsPagination = {
  hasNextPage: boolean;
  limit: number;
  page: number;
  total: number;
  totalPages: number;
};

export type PaginatedApplications = {
  applications: JobApplication[];
  pagination: ApplicationsPagination;
};

export type ApplicationHistoryEntry = {
  applicationId: string;
  changedBy: string;
  createdAt: string;
  fromStatus: JobApplicationStatus | null;
  id: string;
  toStatus: JobApplicationStatus;
};

export type PaginatedApplicationHistory = {
  history: ApplicationHistoryEntry[];
  pagination: ApplicationsPagination;
};

export type JobApplicationsQuery = {
  limit?: number;
  page?: number;
  status?: JobApplicationStatus;
};
```

### features/bookings/types.ts

```ts
export type BookingStatus = "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
export type BookingInvoiceFilter = "none" | "paid" | "unpaid";
export type ReviewerType = "INSTITUTION" | "INSTRUCTOR";

export type BookingReview = {
  bookingId: string;
  comment?: string | null;
  createdAt?: string | null;
  id: string;
  jobTitle?: string;
  rating: number;
  reviewerName?: string;
  reviewerType: ReviewerType;
  updatedAt?: string | null;
};

export type BookingJobSummary = {
  address?: string | null;
  city?: string | null;
  county?: string | null;
  description?: string | null;
  id: string;
  keyStages: string[];
  parkingInfo?: string | null;
  postalCode?: string | null;
  subject?: string | null;
  subjects?: string[];
  title: string;
};

export type BookingPartySummary = {
  fullName?: string;
  id: string;
  imageUrl?: string | null;
  name?: string;
};

/** The booking's current invoice: none until the school invoices it, and never one still being created or voided. */
export type BookingInvoiceSummary = {
  dueAt?: string | null;
  hostedInvoiceUrl?: string | null;
  id: string;
  paidAt?: string | null;
  status: "OPEN" | "PAID" | "UNCOLLECTIBLE";
  totalAmountPence: number;
};

export type Booking = {
  source?: "APPLICATION" | "DIRECT_HIRE";
  applicationId: string;
  cancelReason?: string | null;
  cancelledAt?: string | null;
  cancelledById?: string | null;
  completedAt?: string | null;
  createdAt?: string | null;
  endDate?: string | null;
  id: string;
  institution: BookingPartySummary;
  instructor: BookingPartySummary;
  invoice: BookingInvoiceSummary | null;
  job: BookingJobSummary;
  payAmount?: number | null;
  payType?: string | null;
  reviews: BookingReview[];
  startDate?: string | null;
  status: BookingStatus;
  updatedAt?: string | null;
};

export type BookingsPagination = {
  hasNextPage: boolean;
  limit: number;
  page: number;
  total: number;
  totalPages: number;
};

export type PaginatedBookings = {
  bookings: Booking[];
  pagination: BookingsPagination;
};

export type BookingListQuery = {
  from?: string;
  invoice?: BookingInvoiceFilter;
  jobId?: string;
  limit?: number;
  page?: number;
  search?: string;
  status?: BookingStatus;
  to?: string;
};

export type BookingStatusAction = "cancel" | "complete" | "no-show";

export type BookingStatusUpdateInput = {
  action: BookingStatusAction;
  id: string;
  reason?: string;
};

export type BookingReviewInput = {
  bookingId: string;
  comment?: string;
  rating: number;
};
```

### features/conversations/types.ts

```ts
export type ConversationSide = "instructor" | "poster";

export type MessageAttachment = {
  contentType: string;
  fileName: string;
  id: string;
  sizeBytes: number;
};

export type ChatMessage = {
  attachments: MessageAttachment[];
  body: string;
  conversationId: string;
  createdAt: string;
  id: string;
  /** Which side sent it; null once the sender's account was deleted. */
  senderSide: ConversationSide | null;
};

export type ConversationParticipant = { id: string | null; userId?: string | null; imageUrl: string | null; name: string; role: "school" | "teacher" };
export type StartConversationInput = { applicationId: string; instructorId?: never; jobId?: never } | { instructorId: string; jobId?: string; applicationId?: never };

export type Conversation = {
  applicationId: string | null;
  applicationStatus: string | null;
  counterpart: ConversationParticipant | null;
  participants: { instructor: ConversationParticipant | null; poster: ConversationParticipant | null };
  /** Messages up to this time have been seen by the other person. */
  counterpartLastReadAt: string | null;
  createdAt: string | null;
  id: string;
  job: { id: string; title: string } | null;
  lastMessage: { body: string; createdAt: string; fromMe: boolean; hasAttachments: boolean } | null;
  lastMessageAt: string | null;
  /** The signed-in user's side of the thread. */
  me: ConversationSide | null;
  /** True after the application was rejected: history stays, no new messages. */
  readOnly: boolean;
  unreadCount: number;
};

export type ConversationsPagination = {
  hasNextPage: boolean;
  limit: number;
  page: number;
  total: number;
  totalPages: number;
};

/** One page of the thread list, most recent activity first. */
export type ConversationsPage = {
  conversations: Conversation[];
  pagination: ConversationsPagination;
};

export type MessagesPage = {
  hasMore: boolean;
  /** Oldest first. */
  messages: ChatMessage[];
};

export type AttachmentUpload = {
  attachment: MessageAttachment;
  upload: { expiresAt: string; requiredHeaders: Record<string, string>; url: string };
};

export type SendMessageInput = {
  attachmentIds?: string[];
  body?: string;
  conversationId: string;
};

/** Pushed by the server over the live socket as things happen. */
export type MessageEventPayload = { conversationId: string; message: ChatMessage };
export type ReadEventPayload = { conversationId: string; readAt: string; side: ConversationSide };
export type TypingEventPayload = { conversationId: string; side: ConversationSide; typing: boolean };

/** Who is typing in a thread right now, as shown to the other person. */
export type TypingState = { side: ConversationSide; typing: boolean };
```

### features/invitations/types.ts

```ts
import type { JobCreateInput } from "@/features/jobs/types";

export const invitationStatuses = ["PENDING", "ACCEPTED", "DECLINED", "CANCELLED", "EXPIRED"] as const;
export type InvitationStatus = typeof invitationStatuses[number];
export type InvitationInput = { requestId: string; instructorId: string; message?: string; expiresAt?: string } & (
  { jobId: string; newJob?: never } | { newJob: JobCreateInput; jobId?: never }
);
export type Invitation = {
  id: string;
  status: InvitationStatus;
  /** Frozen offered terms; listing visibility fields remain on the managed job. */
  job: Omit<JobCreateInput, "status" | "liveFrom" | "expiresAt" | "otherSubjects" | "otherSkills"> & { id: string; subject?: string };
  jobStatus: string;
  instructor: { id: string; fullName: string; imageUrl: string | null };
  institution: { id: string; name: string; imageUrl: string | null };
  message: string | null;
  publishOnDecline: boolean;
  expiresAt: string;
  decidedAt: string | null;
  bookingId: string | null;
  invitationPath: string;
  invitationUrl: string | null;
  createdAt: string;
  updatedAt: string;
};
export type InvitationListQuery = { page?: number; limit?: number; status?: InvitationStatus };
export type InvitationsPage = { invitations: Invitation[]; pagination: { page: number; limit: number; total: number; totalPages: number; hasNextPage: boolean } };
export type InvitationDecision = "accept" | "decline" | "cancel";
```

### features/jobs/types.ts

```ts
import type { Job, JobPayType, JobStatus } from "@/types/supplyed";

/** Paging and filters, applied by the backend so every page is filtered the same way. */
export type JobListFilters = {
  keyStage?: string;
  limit?: number;
  page?: number;
  search?: string;
  /** The poster's own jobs only. */
  status?: JobStatus;
  subject?: string;
  urgent?: boolean;
};

export type JobsPagination = {
  hasNextPage: boolean;
  limit: number;
  page: number;
  total: number;
  totalPages: number;
};

export type PaginatedJobs = {
  jobs: Job[];
  pagination: JobsPagination;
};

/** How many of the poster's jobs are in each status, whatever page or filter is showing. */
export type JobStatusCounts = Record<"ALL" | JobStatus, number>;

export type MyJobs = PaginatedJobs & {
  statusCounts: JobStatusCounts;
};

export type BackendJobResponse = {
  id: string;
  institution?: { id: string; imageUrl: string | null; name: string } | null;
  postedByUserId: string;
  title: string;
  description: string;
  jobType?: string | null;
  mode?: string | null;
  postingMode?: string | null;
  subject?: string | null;
  subjects?: string[];
  requiredSkills?: string[];
  minExperienceYears?: number | string | null;
  address?: string | null;
  city?: string | null;
  county?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  startDate?: string | null;
  endDate?: string | null;
  keyStages?: string[];
  parkingInfo?: string | null;
  payAmount?: number | string | null;
  payType?: JobPayType | string | null;
  status: JobStatus;
  liveFrom?: string | null;
  expiresAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type JobCreateInput = {
  otherSubjects?: string[]; otherSkills?: string[];
  address?: string;
  city?: string;
  countryCode?: string;
  county?: string;
  description: string;
  endDate?: string;
  expiresAt?: string;
  liveFrom?: string;
  keyStages: string[];
  latitude?: number;
  longitude?: number;
  minExperienceYears?: number;
  parkingInfo?: string;
  payAmount?: number;
  payType?: JobPayType;
  postalCode?: string;
  requiredSkills?: string[];
  startDate?: string;
  status?: Extract<JobStatus, "ACTIVE" | "DRAFT">;
  subjects?: string[];
  title: string;
};

export type JobUpdateInput = Partial<Omit<JobCreateInput, "status" | "liveFrom">> & {
  id: string;
  liveFrom?: string | null;
  status?: JobStatus;
};

export type { Job, JobStatus };
```

### features/matching/types.ts

```ts
import type { ApplicantSummary, ApplicationsPagination, JobApplication } from "@/features/applications/types";
import type { BackendJobResponse, Job } from "@/features/jobs/types";

export type MatchFactor = {
  applicable: boolean;
  detail: string;
  key: string;
  label: string;
  value: number;
  weight: number;
};

export type MatchResult = {
  distanceMiles: number | null;
  factors: MatchFactor[];
  flags: {
    distanceKnown: boolean;
    outsideTravelRadius: boolean;
    scheduleConflict: boolean;
  };
  score: number;
};

export type MatchListQuery = { limit?: number; minScore?: number; page?: number };
export type MatchedInstructor = ApplicantSummary & {
  currency?: string | null;
  dailyRate?: number | null;
  hourlyRate?: number | null;
  maxTravelDistance?: number | null;
};

export type RankedApplication = { application: JobApplication; instructor: MatchedInstructor; match: MatchResult };
export type RecommendedInstructor = { instructor: MatchedInstructor; match: MatchResult };
export type RecommendedJob = { job: Job; match: MatchResult };

export type RankedApplicationsPage = { applications: RankedApplication[]; pagination: ApplicationsPagination };
export type RecommendedInstructorsPage = { instructors: RecommendedInstructor[]; pagination: ApplicationsPagination };
export type RecommendedJobsPage = { jobs: RecommendedJob[]; pagination: ApplicationsPagination };

export type BackendRecommendedJobsPage = {
  jobs: Array<{ job: BackendJobResponse; match: MatchResult }>;
  pagination: ApplicationsPagination;
};
```

### features/my-profile/types.ts

```ts
import type { JobApplication } from "@/features/applications/types";
import type { BookingReview } from "@/features/bookings/types";

export type ProfilePagination = { page: number; limit: number; total: number; totalPages: number; hasNextPage: boolean };
export type ProfilePageQuery = { page: number; limit: number };
export type ProfileApplication = JobApplication & { jobTitle: string | null; schoolName: string | null; jobAvailable: boolean };
export type ProfileApplications = { applications: ProfileApplication[]; pagination: ProfilePagination };
export type ReviewDirection = "received" | "given";
export type MyProfileReview = BookingReview & {
  direction: ReviewDirection;
  jobId: string;
  partyId: string;
  partyName: string;
};
export type MyProfileReviews = {
  reviews: MyProfileReview[];
  pagination: ProfilePagination;
  receivedTotal: number;
  givenTotal: number;
  averageReceived: number | null;
};
```

### features/notifications/types.ts

```ts
export type NotificationType =
  | "APPLICATION_RECEIVED"
  | "APPLICATION_STATUS"
  | "BOOKING_CANCELLED"
  | "BOOKING_COMPLETED"
  | "BOOKING_CONFIRMED"
  | "INVOICE_PAID"
  | "JOB_MATCH"
  | "JOB_INVITATION"
  | "JOB_INVITATION_STATUS"
  | "PROFILE_STATUS"
  | "REVIEW_RECEIVED";

export type AppNotification = {
  createdAt: string;
  data: Record<string, unknown>;
  id: string;
  /** App page to open, e.g. /job-detail?jobId=... */
  link: string | null;
  readAt: string | null;
  body: string;
  title: string;
  type: NotificationType;
};

export type NotificationsPagination = {
  hasNextPage: boolean;
  limit: number;
  page: number;
  total: number;
  totalPages: number;
};

export type NotificationsPage = {
  notifications: AppNotification[];
  pagination: NotificationsPagination;
  unreadCount: number;
};

/** Which optional emails the user wants; in-app notifications are always on. */
export type NotificationPreferences = {
  emailJobMatches: boolean;
  emailMessages: boolean;
  emailUpdates: boolean;
};

/** Socket events. */
export type NotificationEventPayload = { notification: AppNotification; unreadCount: number };
export type NotificationCountPayload = { unreadCount: number };
```

### features/onboarding/types.ts

```ts
import type { AppRole, ApplicationStatus } from "@/types/supplyed";

export type OnboardingSnapshot = {
  applicationStatus: ApplicationStatus;
  completed: boolean;
  verified: boolean;
  role: AppRole | null;
  signatoryApproval?: SignatoryApprovalSnapshot | null;
  step: number;
};

export type OnboardingSubmitInput = {
  role: AppRole;
  step: number;
  values: Record<string, unknown>;
};

export type OnboardingSubmitResult = {
  applicationStatus: ApplicationStatus;
  snapshot?: OnboardingProfileSnapshot;
  ticket?: string;
};

export type OnboardingDocumentKind = "addressProof" | "dbs" | "id" | "qualification";
export type OnboardingDocumentContext =
  | "INSTRUCTOR_PROFILE"
  | "INSTITUTION_PROFILE"
 ;

export type InstitutionType = "MAT_SCHOOL" | "SINGLE_SCHOOL";
export type SignatoryApprovalStatus = "APPROVED" | "DECLINED" | "EXPIRED" | "PENDING" | "REVOKED";

export type InstitutionTrustSnapshot = {
  companyNumber: string | null;
  id: string;
  name: string;
};

export type SignatoryApprovalSnapshot = {
  approvedByAdmin: boolean;
  createdAt: string;
  decidedAt: string | null;
  declineReason: string | null;
  expiresAt: string;
  id: string;
  signatoryEmail: string;
  signatoryJobTitle: string;
  signatoryName: string;
  status: SignatoryApprovalStatus;
  termsVersion: string | null;
};

export type OnboardingDocumentSnapshot = {
  code?: string | null;
  dbsNumber?: string | null;
  id: string;
  name: string;
  rejectionComment?: string | null;
  requirementId?: string | null;
  size: number;
  status?: string | null;
  type: string;
  uploadedAt?: string | null;
  versionId?: string | null;
  versionNumber?: number | null;
};

export type OnboardingDocumentRequirementSnapshot = {
  context: OnboardingDocumentContext | string;
  documentType: {
    allowedMimes: string[];
    code: string;
    id?: string;
    maxSizeBytes: number;
    name: string;
  };
  documentTypeId?: string;
  id: string;
  isRequired: boolean;
  requiresReview: boolean;
};

export type OnboardingDocumentRequirement = {
  allowedMimes: string[];
  code: string;
  context: OnboardingDocumentContext | string;
  description?: string | null;
  id: string;
  isRequired: boolean;
  maxSizeBytes: number;
  name: string;
  requiresReview: boolean;
};

export type OnboardingDocumentMap = Record<string, OnboardingDocumentSnapshot>;

export type OnboardingDocumentState = {
  documentRequirements: OnboardingDocumentRequirement[];
  documents: OnboardingDocumentMap;
};

export type OnboardingUserSnapshot = {
  email: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  fullName: string;
  phone: string;
  postcode: string;
};

export type OnboardingInstructorSnapshot = {
  bio: string;
  city: string;
  countryCode: string;
  currency: string;
  dailyRate: string;
  fullName: string;
  hourlyRate: string;
  id: string;
  keyStages: string[];
  maxTravelDistance: string;
  postalCode: string;
  skills: string[];
  status: ApplicationStatus;
  subjects: string[];
  yearsExperience: string;
};

export type OnboardingInstitutionSnapshot = {
  address: string;
  city: string;
  complianceContact: string;
  complianceEmail: string;
  countryCode: string;
  coverTypes: string[];
  county: string;
  domain: string;
  id: string;
  institutionType: InstitutionType;
  name: string;
  postalCode: string;
  registrationId: string;
  safeguardingConfirmed: boolean;
  status: ApplicationStatus;
  staffingNeeds: string[];
  trust: InstitutionTrustSnapshot | null;
  typicalPupilCount: string;
  userRole: string;
  verified: boolean;
};

export type OnboardingProfileSnapshot = {
  applicationStatus: ApplicationStatus;
  documentRequirements: OnboardingDocumentRequirementSnapshot[];
  documents: Partial<Record<OnboardingDocumentKind, OnboardingDocumentSnapshot>>;
  institution?: OnboardingInstitutionSnapshot;
  instructor?: OnboardingInstructorSnapshot;
  requirementDocuments: Record<string, OnboardingDocumentSnapshot>;
  role: AppRole | null;
  signatoryApproval?: SignatoryApprovalSnapshot | null;
  user?: OnboardingUserSnapshot;
};

export type OnboardingProgressResult = OnboardingSubmitResult & {
  savedStep: number;
  snapshot: OnboardingProfileSnapshot;
};

export type OnboardingDocumentUploadResult = {
  document: OnboardingDocumentSnapshot;
  documents: Partial<Record<OnboardingDocumentKind, OnboardingDocumentSnapshot>>;
  requirementDocuments: Record<string, OnboardingDocumentSnapshot>;
};

export type OnboardingDocumentDownloadResult = {
  expiresAt?: string;
  url: string;
};
```

### features/payments/types.ts

```ts
export type InvoiceStatus = "PENDING" | "OPEN" | "PAID" | "VOID" | "UNCOLLECTIBLE";

/** The teacher's Stripe payout account, as the backend mirrors it. */
export type PayoutAccount = {
  chargesEnabled: boolean;
  connected: boolean;
  detailsSubmitted: boolean;
  disabledReason: string | null;
  payoutsEnabled: boolean;
  /** True once the teacher can be paid; their bookings can then be invoiced. */
  ready: boolean;
  requirementsDue: string[];
};

export type PayoutSummary = {
  amountPence: number;
  arrivalDate: string | null;
  id: string;
  /** "instant" or "standard" (Stripe's automatic payout). */
  method: string;
  /** pending | in_transit | paid | failed | canceled */
  status: string;
};

/** The teacher's Stripe balance and what can be cashed out right now. */
export type PayoutBalance = {
  availablePence: number;
  /** What can be cashed out now; already net of any instant payout fee. */
  instantAvailablePence: number;
  /** Where a cash-out goes; null when nothing linked supports instant payouts. */
  instantDestination: { id: string; label: string } | null;
  pendingPence: number;
  recentPayouts: PayoutSummary[];
};

/** What the teacher's browser needs to show Stripe's embedded payout setup, bank details and payouts. */
export type PayoutSession = {
  clientSecret: string;
  publishableKey: string;
};

/** What the school's browser needs to pay one invoice with Stripe's Payment Element. */
export type InvoicePaymentSession = {
  amountPence: number;
  clientSecret: string;
  /** Lets the Payment Element offer the school's saved cards and save new ones. */
  customerSessionClientSecret: string;
  publishableKey: string;
};

/** The invoice a school is about to pay. */
export type PayableInvoice = {
  id: string;
  jobTitle?: string;
  totalAmountPence: number;
};

export type InvoiceParty = {
  id: string;
  name: string;
};

export type Invoice = {
  amountRefundedPence: number;
  booking: {
    endDate: string | null;
    id: string;
    institution: InvoiceParty;
    instructor: InvoiceParty;
    jobTitle: string;
    startDate: string | null;
  };
  createdAt: string | null;
  currency: string;
  disputeStatus: string | null;
  dueAt: string | null;
  feeAmountPence: number;
  hostedInvoiceUrl: string | null;
  id: string;
  invoiceNumber: string | null;
  invoicePdfUrl: string | null;
  paidAt: string | null;
  payType: string;
  poNumber: string | null;
  rateAmount: number;
  status: InvoiceStatus;
  teacherAmountPence: number;
  totalAmountPence: number;
  unitsWorked: number | null;
  updatedAt: string | null;
  voidedAt: string | null;
};

export type InvoicesPagination = {
  hasNextPage: boolean;
  limit: number;
  page: number;
  total: number;
  totalPages: number;
};

export type PaginatedInvoices = {
  invoices: Invoice[];
  pagination: InvoicesPagination;
};

export type InvoiceListQuery = {
  limit?: number;
  page?: number;
  status?: InvoiceStatus;
};

export type AdminInvoiceListQuery = InvoiceListQuery & {
  bookingId?: string;
  instructorId?: string;
  institutionId?: string;
};

export type CreateInvoiceInput = {
  bookingId: string;
  poNumber?: string;
  /** Days (daily rate) or hours (hourly rate) worked; omitted for a fixed price. */
  unitsWorked?: number;
};

export type RefundReason = "duplicate" | "fraudulent" | "requested_by_customer";

export type RefundInvoiceInput = {
  /** Pence to refund; omit to refund everything not yet refunded. */
  amountPence?: number;
  id: string;
  reason?: RefundReason;
};
```

### features/public-profiles/types.ts

```ts
export type InstructorPublicProfile = {
  bio: string | null;
  city: string | null;
  county: string | null;
  currency: string | null;
  dailyRate: number | null;
  dbsVerified: boolean;
  experience: number | null;
  fullName: string;
  hourlyRate: number | null;
  id: string;
  imageUrl: string | null;
  keyStages: string[];
  memberSince: string | null;
  ratingAverage: number;
  ratingCount: number;
  skills: string[];
  subjects: string[];
};

export type InstitutionPublicProfile = {
  address: string;
  city: string;
  county: string | null;
  coverTypes: string[];
  id: string;
  imageUrl: string | null;
  institutionType: "MAT_SCHOOL" | "SINGLE_SCHOOL";
  memberSince: string | null;
  name: string;
  postalCode: string | null;
  staffingNeeds: string[];
  trust: { name: string } | null;
  typicalPupilCount: number | null;
  verified: boolean;
};
```

### features/reviews/types.ts

```ts
export type ProfileReview = {
  bookingId?: string | null;
  comment?: string | null;
  createdAt?: string | null;
  id: string;
  jobTitle?: string | null;
  rating: number;
  reviewerName?: string | null;
  reviewerType?: "INSTITUTION" | "INSTRUCTOR" | string | null;
  updatedAt?: string | null;
};

export type ProfileReviews = {
  averageRating: number | null;
  reviews: ProfileReview[];
  total: number;
};
```

### features/settings/types.ts

```ts
import type { AppRole, ApplicationStatus } from "@/types/supplyed";

export type SettingsUserSnapshot = {
  createdAt: string | null;
  email: string;
  emailVerified: boolean;
  id: string;
  lastLogin: string | null;
  name: string;
  phone: string;
  phoneVerified: boolean;
  role: AppRole | null;
  twoFactorEnabled: boolean;
  updatedAt: string | null;
};

export type SettingsInstructorProfile = {
  address: string;
  bio: string;
  city: string;
  countryCode: string;
  county: string;
  createdAt: string | null;
  currency: string;
  dailyRate: string;
  dbsVerified: boolean;
  experience: string;
  fullName: string;
  hourlyRate: string;
  id: string;
  imageUrl: string;
  keyStages: string[];
  maxTravelDistance: string;
  postalCode: string;
  ratingAverage: number | null;
  ratingCount: number;
  skills: string[];
  status: ApplicationStatus;
  subjects: string[];
  updatedAt: string | null;
  userId: string | null;
};

export type SettingsInstitutionProfile = {
  address: string;
  city: string;
  complianceContact: string;
  complianceEmail: string;
  countryCode: string;
  county: string;
  coverTypes: string[];
  createdAt: string | null;
  domain: string;
  id: string;
  imageUrl: string;
  name: string;
  postalCode: string;
  registrationId: string;
  safeguardingConfirmed: boolean;
  staffingNeeds: string[];
  status: ApplicationStatus;
  typicalPupilCount: string;
  updatedAt: string | null;
  userId: string | null;
  userRole: string;
  verified: boolean;
};

export type SettingsProfileSnapshot = {
  applicationStatus: ApplicationStatus;
  institution?: SettingsInstitutionProfile;
  instructor?: SettingsInstructorProfile;
  role: AppRole | null;
  user: SettingsUserSnapshot;
};

export type SettingsUserUpdateInput = {
  name: string;
  phone: string;
};

export type SettingsInstructorUpdateInput = {
  otherSubjects?: string[]; otherSkills?: string[];
  address: string;
  bio: string;
  city: string;
  countryCode: string;
  county: string;
  currency: string;
  dailyRate: string;
  experience: string;
  fullName: string;
  hourlyRate: string;
  id?: string;
  imageUrl: string;
  keyStages: string[];
  maxTravelDistance: string;
  postalCode: string;
  skills: string[];
  subjects: string[];
};

export type SettingsInstitutionUpdateInput = {
  otherSubjects?: string[];
  address: string;
  city: string;
  complianceContact: string;
  complianceEmail: string;
  countryCode: string;
  county: string;
  coverTypes: string[];
  domain: string;
  id?: string;
  imageUrl: string;
  name: string;
  postalCode: string;
  registrationId: string;
  safeguardingConfirmed: boolean;
  staffingNeeds: string[];
  typicalPupilCount: string;
  userRole: string;
};

export type SettingsUpdateInput = {
  institution?: SettingsInstitutionUpdateInput;
  instructor?: SettingsInstructorUpdateInput;
  role: AppRole;
  user: SettingsUserUpdateInput;
};
```

### features/teachers/types.ts

```ts
import type { Teacher } from "@/types/supplyed";

export type TeacherListFilters = {
  keyStage?: string;
  search?: string;
  subject?: string;
};

export type TeacherDirectoryFilters = {
  availableToday?: boolean;
  city?: string;
  dbsVerified?: boolean;
  keyStage?: string;
  limit?: number;
  maxDailyRate?: number;
  maxHourlyRate?: number;
  minExperience?: number;
  minRating?: number;
  page?: number;
  qtsQualified?: boolean;
  search?: string;
  skill?: string;
  subject?: string;
};

export type TeacherDirectoryItem = {
  availableToday: boolean;
  bio: string | null;
  city: string | null;
  county: string | null;
  currency: string | null;
  dailyRate: number | null;
  dbsVerified: boolean;
  experience: number | null;
  fullName: string;
  hourlyRate: number | null;
  id: string;
  imageUrl: string | null;
  keyStages: string[];
  memberSince: string | null;
  qtsQualified: boolean;
  ratingAverage: number;
  ratingCount: number;
  skills: string[];
  subjects: string[];
};

export type TeacherDirectoryPagination = {
  hasNextPage: boolean;
  limit: number;
  page: number;
  total: number;
  totalPages: number;
};

export type TeacherDirectoryPage = {
  instructors: TeacherDirectoryItem[];
  pagination: TeacherDirectoryPagination;
};

export type TeacherProfileUpdateInput = Partial<
  Pick<Teacher, "availability" | "city" | "keyStages" | "rate" | "subjects">
>;

export type { Teacher };
```

### features/teaching-catalogue/types.ts

```ts
export type TeachingCatalogue = {
  subjectOptions?: import("@/features/dropdowns/types").DropdownOption[];
  skillOptions?: import("@/features/dropdowns/types").DropdownOption[];
  stageOptions?: import("@/features/dropdowns/types").DropdownOption[];
  version: string;
  title: string;
  description: string;
  categories: { name: string; subjects: { name: string; aliases: string[]; skills: string[] }[] }[];
  sharedSkills: string[];
  keyStages: string[];
};
```

### features/teaching-catalogue/selection.ts

```ts
import type { TeachingCatalogue } from "./types";

/** Preserve a legacy sentence as one reviewable value; never infer subjects from prose. */
export function selectionValues(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : typeof value === "string" && value.trim() ? [value] : [];
}

export function jobSubjects(job: { subjects?: string[] | null; subject?: string | null }): string[] {
  return Array.isArray(job.subjects) ? selectionValues(job.subjects) : job.subject && job.subject !== "General cover" ? [job.subject] : [];
}

export const subjectKey = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const key = subjectKey;
export function canonicalSubjects(values: string[], catalogue: TeachingCatalogue): string[] {
  const subjects = catalogue.categories.flatMap(category => category.subjects);
  return [...new Set(values.map(value => {
    const matches = subjects.filter(subject => [subject.name, ...subject.aliases].some(alias => key(alias) === key(value)));
    return matches.length === 1 ? matches[0].name : value;
  }))];
}

export function allowedSkills(subjects: string[], catalogue: TeachingCatalogue): string[] {
  const names = canonicalSubjects(subjects, catalogue);
  if (catalogue.skillOptions && catalogue.subjectOptions) {
    const keys = new Set(catalogue.subjectOptions.filter(option => option.isActive && names.includes(option.value) && option.value !== "Other").map(option => option.key));
    return catalogue.skillOptions.filter(option => option.isActive && (option.isShared || option.subjectKeys.some(key => keys.has(key)))).map(option => option.value);
  }
  return [...new Set([...catalogue.sharedSkills, ...catalogue.categories.flatMap(category => category.subjects).filter(subject => names.includes(subject.name)).flatMap(subject => subject.skills)])];
}

export function reconcileSkills(subjects: string[], skills: string[], catalogue: TeachingCatalogue): string[] {
  const allowed = new Set(allowedSkills(subjects, catalogue));
  return [...new Set(skills.filter(skill => allowed.has(skill)))];
}

export function catalogueError(code?: string) {
  return code === "INVALID_OTHER_SUBJECTS" || code === "INVALID_OTHER_SKILLS" || code === "INVALID_DROPDOWN_SELECTION" || code === "INVALID_TEACHING_SELECTION" || code === "SKILL_SUBJECT_MISMATCH" || code === "CONFLICTING_JOB_SUBJECTS";
}

export function toSkillEditor(catalogue: TeachingCatalogue | undefined, values: string[], otherSkills?: string[]) {
  if (!catalogue) return { skills: values, otherSkills };
  const options = catalogue.skillOptions ?? [...new Set([...catalogue.sharedSkills, ...catalogue.categories.flatMap(category => category.subjects.flatMap(subject => subject.skills))])].map(value => ({ value, aliases: [] as string[] }));
  const canonical = [...new Set(values.map(value => options.find(option => [option.value, ...option.aliases].some(alias => key(alias) === key(value)))?.value ?? value))];
  if (otherSkills !== undefined) return { skills: canonical, otherSkills };
  const known = new Set(options.map(option => option.value));
  const custom = canonical.filter(value => !known.has(value));
  return { skills: [...canonical.filter(value => known.has(value)), ...(custom.length ? ["Other"] : [])], otherSkills: custom };
}

export function otherSkillsError(skills: string[] | undefined, values: unknown, catalogue?: TeachingCatalogue): string | undefined {
  const error = otherSubjectsError(skills, values);
  if (error) return error.replace(/subjects/g, "skills").replace(/subject names/g, "skill names");
  if (catalogue && Array.isArray(values)) {
    const options = catalogue.skillOptions ?? [...new Set([...catalogue.sharedSkills, ...catalogue.categories.flatMap(category => category.subjects.flatMap(subject => subject.skills))])].map(value => ({ value, aliases: [] as string[] }));
    const match = options.find(option => values.some(value => [option.value, ...option.aliases].some(alias => key(alias) === key(value))));
    if (match) return `Select ${match.value} from the skills menu instead of entering it under Other.`;
  }
  return undefined;
}

/** Responses store actual names. Only requests contain Other + otherSubjects. */
export function toSubjectEditor(catalogue: TeachingCatalogue | undefined, values: string[], otherSubjects?: string[]) {
  if (!catalogue) return { subjects: values, otherSubjects };
  const canonical = canonicalSubjects(values, catalogue);
  if (otherSubjects !== undefined) return { subjects: canonical, otherSubjects };
  const known = new Set(catalogue.categories.flatMap(category => category.subjects.map(subject => subject.name)));
  const custom = canonical.filter(value => !known.has(value));
  return { subjects: [...new Set([...canonical.filter(value => known.has(value)), ...(custom.length ? ["Other"] : [])])], otherSubjects: custom };
}

export function cleanOtherSubjects(values: string[]): string[] {
  const unique = new Map<string, string>();
  for (const value of values) {
    const cleaned = value.trim().replace(/\s+/gu, " ");
    if (!unique.has(subjectKey(cleaned))) unique.set(subjectKey(cleaned), cleaned);
  }
  return [...unique.values()];
}

export function actualSubjects(subjects: string[], otherSubjects?: string[]) {
  return !Array.isArray(subjects) || !Array.isArray(otherSubjects) ? subjects : [...subjects.filter(value => value !== "Other"), ...otherSubjects];
}

export function otherSubjectsError(subjects: string[] | undefined, values: unknown, catalogue?: TeachingCatalogue): string | undefined {
  if (subjects !== undefined && !Array.isArray(subjects)) return undefined;
  // Omission deliberately preserves custom names during a PATCH.
  if (values === undefined) return subjects?.includes("Other") ? "Add at least one name under Other subjects." : undefined;
  if (!Array.isArray(values) || values.length > 50 || values.some(value => typeof value !== "string" || value.length > 100 || /\p{Cc}/u.test(value) || !subjectKey(value))) return "Use up to 50 subject names, each 1–100 characters, without control characters.";
  const names = values as string[];
  if (catalogue) {
    const known = catalogue.categories.flatMap(category => category.subjects);
    const match = known.find(subject => names.some(name => [subject.name, ...subject.aliases].some(alias => subjectKey(alias) === subjectKey(name))));
    if (match) return `Select ${match.name} from the catalogue instead of entering it under Other.`;
  }
  if (subjects && subjects.includes("Other") !== (names.length > 0)) return "Select Other and add at least one name, or remove Other and clear its names.";
  if ((subjects?.filter(value => value !== "Other").length ?? 0) + cleanOtherSubjects(names).length > 50) return "Select up to 50 subjects in total, including Other subjects.";
  return undefined;
}
```

### features/teaching-catalogue/patch.ts

```ts
/** Unrelated profile edits must not revalidate legacy catalogue values. */
import { actualSubjects } from "./selection";

/** Retired reference values on unchanged fields must not block unrelated edits. */
export function omitUnchangedDropdownFields(payload: object, saved: object | null | undefined) {
  if (!saved) return;
  const current = payload as Record<string, unknown>, previous = saved as Record<string, unknown>;
  for (const field of ["city", "county", "countryCode", "currency", "keyStages", "coverTypes", "institutionType"]) {
    if (field in current && JSON.stringify(current[field]) === JSON.stringify(previous[field])) delete current[field];
  }
}

export function omitUnchangedTeachingFields(payload: { subjects?: string[]; skills?: string[]; staffingNeeds?: string[]; otherSubjects?: string[]; otherSkills?: string[] }, saved: { subjects?: string[]; skills?: string[]; staffingNeeds?: string[] } | null | undefined) {
  if (!saved) return;
  const same = (left?: string[], right?: string[]) => JSON.stringify(left ?? []) === JSON.stringify(right ?? []);
  if (("subjects" in payload || "skills" in payload) && same(actualSubjects(payload.subjects ?? [], payload.otherSubjects), saved.subjects) && same(actualSubjects(payload.skills ?? [], payload.otherSkills), saved.skills)) {
    delete payload.subjects;
    delete payload.skills;
    delete payload.otherSubjects;
    delete payload.otherSkills;
  }
  if ("staffingNeeds" in payload && same(actualSubjects(payload.staffingNeeds ?? [], payload.otherSubjects), saved.staffingNeeds)) { delete payload.staffingNeeds; delete payload.otherSubjects; }
}
```

### features/applications/workflow.ts

```ts
import type { JobApplicationStatus } from "./types";

export const applicationPipeline: readonly Exclude<JobApplicationStatus, "REJECTED">[] = [
  "APPLIED", "VIEWED", "SHORTLISTED", "HIRED",
];

/** Applications may skip ahead, but never return to a previous or terminal stage. */
export function canTransitionApplication(current: JobApplicationStatus, target: JobApplicationStatus) {
  if (current === "HIRED" || current === "REJECTED") return false;
  const currentIndex = applicationPipeline.indexOf(current);
  if (currentIndex < 0) return false;
  if (target === "REJECTED") return true;
  return applicationPipeline.indexOf(target) > currentIndex;
}
```

### features/jobs/listing-window.ts

```ts
import type { Job } from "./types";

export const LISTING_TIME_ZONE = "Europe/London";
export type JobVisibilityLabel = "closed" | "draft" | "expired" | "live" | "scheduled" | "suspended";

export function getJobVisibilityLabel(job: Pick<Job, "expiresAt" | "liveFrom" | "status">, now = Date.now()): JobVisibilityLabel {
  if (job.status === "SUSPENDED") return "suspended";
  if (job.status === "CLOSED") return "closed";
  if (job.status === "DRAFT" || !job.status) return "draft";
  if (job.status === "EXPIRED") return "expired";
  if (job.expiresAt && Date.parse(job.expiresAt) <= now) return "expired";
  if (job.liveFrom && Date.parse(job.liveFrom) > now) return "scheduled";
  return "live";
}

export function formatJobVisibilityLabel(value: JobVisibilityLabel) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function ukCalendarDate(value: string | null | undefined, inclusiveLastDay = false): string {
  if (!value) return "";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LISTING_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(parsed - (inclusiveLastDay ? 1 : 0)));
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function ukDateTimeInput(value: string | null | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LISTING_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function formatUkListingInstant(value: string | null | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "Not set";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: LISTING_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

/** Date-only listing fields use UK midnight; expiry includes the selected day. */
export function listingCalendarInstant(value: string, boundary: "open" | "close"): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return Date.parse(value);
  const midnight = Date.parse(`${value}T00:00:00Z`) + (boundary === "close" ? 86400000 : 0);
  const offsetLabel = new Intl.DateTimeFormat("en-GB", { timeZone: LISTING_TIME_ZONE, timeZoneName: "longOffset" })
    .formatToParts(new Date(midnight)).find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(offsetLabel);
  const offsetMinutes = match ? (Number(match[2]) * 60 + Number(match[3])) * (match[1] === "+" ? 1 : -1) : 0;
  return midnight - offsetMinutes * 60_000;
}
```

### features/invitations/validation.ts

```ts
import type { Job } from "@/features/jobs/types";
import { listingCalendarInstant } from "@/features/jobs/listing-window";
import { validateJobInput } from "@/features/jobs/validation";
import type { InvitationInput } from "./types";

export function jobInvitationProblem(job: Job, now = Date.now()): string | null {
  if (job.status !== "DRAFT" && job.status !== "ACTIVE") return "This job is no longer available for hiring.";
  if (job.expiresAt && Date.parse(job.expiresAt) <= now) return "This job has expired. Update its expiry before hiring.";
  if (!job.startDate || !job.endDate || !Number.isFinite(Date.parse(job.startDate)) || !Number.isFinite(Date.parse(job.endDate))) return "Add start and end dates before hiring.";
  if (Date.parse(job.startDate) > Date.parse(job.endDate)) return "Correct the job's start and end dates.";
  if (Date.parse(job.startDate) <= now) return "Choose a job with a future start date.";
  if (!(Number(job.payAmount) > 0) || !["hourly", "daily", "fixed"].includes(job.payType ?? "")) return "Add a positive pay amount and pay type before hiring.";
  return null;
}

export function validateInvitation(input: InvitationInput, options: { fresh?: boolean; now?: number; job?: { startDate?: string | null; expiresAt?: string | null } } = {}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input && Object.keys(input).some(key => !["requestId", "instructorId", "jobId", "newJob", "message", "expiresAt"].includes(key))) errors.request = "Only invitation details can be submitted.";
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!input || !uuid.test(input.requestId)) errors.requestId = "Start a new hiring request.";
  if (!input || typeof input.instructorId !== "string" || !uuid.test(input.instructorId)) errors.instructorId = "Choose a valid teacher profile.";
  if (!input || Boolean(input.jobId) === Boolean(input.newJob)) return { ...errors, jobId: "Choose an existing job or create a new job." };
  if (input.jobId !== undefined && (typeof input.jobId !== "string" || !uuid.test(input.jobId))) errors.jobId = "Choose a valid job.";
  if (input.message !== undefined && (typeof input.message !== "string" || input.message.length > 1000)) errors.message = "Use 1,000 characters or fewer.";
  if (input.expiresAt !== undefined && (typeof input.expiresAt !== "string" || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(input.expiresAt) || !Number.isFinite(Date.parse(input.expiresAt)))) errors.expiresAt = "Enter a valid invitation deadline with a timezone.";
  if (input.newJob) {
    Object.assign(errors, validateJobInput(input.newJob));
    // A successful request may be recovered later; the backend checks eligibility after idempotency.
    if (errors.startDate === "Start date cannot be before today.") delete errors.startDate;
    if (errors.expiresAt === "Listing expiry cannot be before today.") delete errors.expiresAt;
    for (const field of ["startDate", "endDate"] as const) {
      const value = input.newJob[field];
      if (!value || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) errors[field] = "Enter a date and time with a timezone.";
    }
    if (!(typeof input.newJob.payAmount === "number" && Number.isFinite(input.newJob.payAmount) && input.newJob.payAmount > 0)) errors.payAmount = "Enter a pay amount greater than zero.";
    if (!input.newJob.payType || !["hourly", "daily", "fixed"].includes(input.newJob.payType)) errors.payType = "Choose a pay type.";
    if ((input.newJob.latitude === undefined) !== (input.newJob.longitude === undefined)) errors.latitude = "Provide both map coordinates.";
    if (input.newJob.status !== undefined) errors.status = "New invitation jobs are created as private drafts.";
  }
  if (options.fresh) {
    const now = options.now ?? Date.now();
    const job = input.newJob ?? options.job;
    if (job?.startDate && Date.parse(job.startDate) <= now) errors.startDate = "Choose a future start date and time.";
    if (input.expiresAt && !errors.expiresAt) {
      const deadline = Date.parse(input.expiresAt);
      if (deadline <= now) errors.expiresAt = "Choose a future invitation deadline.";
      else if ((job?.startDate && deadline > Date.parse(job.startDate)) || (job?.expiresAt && deadline > listingCalendarInstant(job.expiresAt, "close"))) errors.expiresAt = "The invitation deadline cannot be later than the job start or listing expiry.";
    }
  }
  return errors;
}
```

### features/invitations/actions.ts

```ts
"use server";

import { actionError } from "@/lib/server/action-response";
import { normalizeRole } from "@/features/auth/backend";
import { api, ApiError } from "@/lib/server/api-client";
import { getServerAuthContext } from "@/lib/server/auth-context";
import { validateInvitation } from "./validation";
import { normalizeInvitation } from "./schemas";
import { normalizeBooking } from "@/features/bookings/schemas";
import type { Booking } from "@/features/bookings/types";
import { normalizeConversation, normalizeMessage, normalizeMessagesPage } from "@/features/conversations/schemas";
import type { ChatMessage, Conversation, MessagesPage } from "@/features/conversations/types";
import type { Invitation, InvitationDecision, InvitationInput } from "./types";

export type InvitationResult<T> = { ok: true; data: T } | { ok: false; message: string; uncertain: boolean; code?: string; status?: number; fieldErrors?: Record<string, string>; requestId?: string };
export type CreateInvitationResult = InvitationResult<Invitation> & { conversationId?: string };

export async function createInvitationAction(input: InvitationInput): Promise<CreateInvitationResult> {
  let invitation: Invitation;
  try {
    const auth = await getServerAuthContext();
    if (!auth) return { ok: false, message: "Sign in again, then retry this saved invitation.", uncertain: true, status: 401 };
    if (normalizeRole(auth.role) !== "institution") return { ok: false, message: "Only schools can send an invitation.", uncertain: false, status: 403 };
    const fieldErrors = validateInvitation(input);
    if (Object.keys(fieldErrors).length) return { ok: false, message: "Check the hiring details before continuing.", fieldErrors, uncertain: false };
    // Time-dependent eligibility is checked by the backend after its idempotency lookup.
    invitation = normalizeInvitation(await api.post<Invitation>("/job-invitations", input));
  } catch (error) {
    return failure(error);
  }

  try {
    const conversation = normalizeConversation(await api.post<Conversation>("/conversations", {
      instructorId: invitation.instructor.id,
      jobId: invitation.job.id,
    }));
    if (!conversation.id) throw new Error("The conversation response was incomplete.");

    const body = invitationConversationMessage(invitation);
    const recent = normalizeMessagesPage(await api.get<MessagesPage>(`/conversations/${conversation.id}/messages`, {
      cache: "no-store",
      query: { limit: 100 },
    }));
    if (!recent.messages.some((item) => item.senderSide === "poster" && item.body === body)) {
      normalizeMessage(await api.post<ChatMessage>(`/conversations/${conversation.id}/messages`, { body }));
    }

    return { ok: true, data: invitation, conversationId: conversation.id };
  } catch (error) {
    return {
      ok: false,
      message: "The invitation was sent, but its conversation could not be started. Retry the same invitation to finish opening the chat.",
      uncertain: true,
      status: error instanceof ApiError ? error.status : undefined,
      requestId: error instanceof ApiError ? error.requestId : undefined,
    };
  }
}

function invitationConversationMessage(invitation: Pick<Invitation, "id" | "invitationPath" | "job">) {
  const path = invitation.invitationPath || `/job-invitations/${encodeURIComponent(invitation.id)}`;
  return `I've sent you a job invitation for “${invitation.job.title}”. Review and respond from Job invitations: ${path}`;
}

export async function decideInvitationAction(id: string, decision: InvitationDecision): Promise<InvitationResult<{ invitation?: Invitation; booking?: Booking }>> {
  try {
    const auth = await getServerAuthContext();
    const role = normalizeRole(auth?.role);
    if (!auth) return { ok: false, message: "Sign in to respond to this invitation.", uncertain: false, status: 401 };
    if (!["accept", "decline", "cancel"].includes(decision) || (decision === "cancel" ? role !== "institution" : role !== "teacher")) return { ok: false, message: "This action is not available for your account.", uncertain: false, status: 403 };
    if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id)) return { ok: false, message: "Choose a valid invitation.", uncertain: false, status: 400 };
    if (decision === "accept") {
      const booking = await api.post<Booking>(`/job-invitations/${id}/accept`);
      if (!booking?.id || !booking.applicationId || !booking.status) throw new Error("The acceptance result was incomplete. Retry acceptance to retrieve the booking.");
      return { ok: true, data: { booking: normalizeBooking(booking) } };
    }
    return { ok: true, data: { invitation: normalizeInvitation(await api.post<Invitation>(`/job-invitations/${id}/${decision}`)) } };
  } catch (error) { return failure(error); }
}

function failure(error: unknown): InvitationResult<never> {
  const mapped = actionError(error instanceof Error ? error.message : "Review your selections.", { code: error instanceof ApiError ? error.code : undefined });
  return { ...mapped, fieldErrors: mapped.fieldErrors as Record<string, string> | undefined, ok: false, message: error instanceof Error ? error.message : "The invitation result could not be confirmed.", uncertain: !(error instanceof ApiError) || error.status >= 500 || [408, 401].includes(error.status), status: error instanceof ApiError ? error.status : undefined, requestId: error instanceof ApiError ? error.requestId : undefined };
}
```

### features/dashboard/teacher-dashboard-data.ts

```ts
import type { JobApplication, JobApplicationStatus } from "@/features/applications/types";
import type { Booking } from "@/features/bookings/types";
import type { Invitation } from "@/features/invitations/types";
import type { SettingsProfileSnapshot } from "@/features/settings/types";

/** Teaching dates belong to the UK school, independently of the browser timezone. */
export const DASHBOARD_TIME_ZONE = "Europe/London";
export type DashboardBookingPeriod = "week" | "month" | "all";
export const DASHBOARD_APPLICATION_STATUSES: JobApplicationStatus[] = ["APPLIED", "VIEWED", "SHORTLISTED", "HIRED", "REJECTED"];

const calendarFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: DASHBOARD_TIME_ZONE,
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
});

function calendarParts(value: string | number | Date) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = calendarFormatter.formatToParts(date);
  const part = (name: string) => Number(parts.find((item) => item.type === name)?.value);
  return { year: part("year"), month: part("month"), day: part("day"), hour: part("hour") };
}

function calendarDay(value: string | number | Date) {
  const parts = calendarParts(value);
  return parts ? Date.UTC(parts.year, parts.month - 1, parts.day) : null;
}

/** An explicit instant avoids the backend interpreting a London date as UTC midnight. */
export function dashboardDayStart(now: string | number | Date = Date.now()) {
  const day = calendarDay(now);
  if (day === null) throw new Error("A valid date is required.");
  // London is UTC or UTC+1, and its daylight-saving changes happen after midnight.
  const offsetHours = calendarParts(day)?.hour ?? 0;
  return new Date(day - offsetHours * 60 * 60 * 1000).toISOString();
}

export function formatDashboardDate(value: string | null | undefined, options: Intl.DateTimeFormatOptions = {}) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Date to be confirmed";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", ...options, timeZone: DASHBOARD_TIME_ZONE }).format(new Date(value));
}

export function getUpcomingBookings(bookings: Booking[], now: number = Date.now()) {
  const today = calendarDay(now);
  if (today === null) return [];
  return bookings.filter((booking) => {
    const start = booking.startDate ? calendarDay(booking.startDate) : null;
    const end = booking.endDate ? calendarDay(booking.endDate) : start;
    return booking.status === "CONFIRMED" && start !== null && end !== null && end >= today;
  }).sort((left, right) => Date.parse(left.startDate!) - Date.parse(right.startDate!) || left.id.localeCompare(right.id));
}

/** Includes ongoing multi-day bookings, and the whole of the final school day. */
export function isDashboardBookingOngoing(booking: Booking, now: number = Date.now()) {
  const today = calendarDay(now);
  const start = booking.startDate ? calendarDay(booking.startDate) : null;
  const end = booking.endDate ? calendarDay(booking.endDate) : start;
  return booking.status === "CONFIRMED" && today !== null && start !== null && end !== null && start <= today && end >= today;
}

/** Week and month mean the current calendar week/month, including work already underway. */
export function filterDashboardBookings(bookings: Booking[], period: DashboardBookingPeriod, now: number = Date.now()) {
  const upcoming = getUpcomingBookings(bookings, now);
  if (period === "all") return upcoming;
  const today = calendarDay(now);
  if (today === null) return [];
  const date = new Date(today);
  const until = period === "week"
    ? today + (7 - ((date.getUTCDay() + 6) % 7)) * 86400000
    : Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
  return upcoming.filter((booking) => calendarDay(booking.startDate!)! < until);
}

export type DashboardApplicationSummary = {
  active: number;
  counts: Record<JobApplicationStatus, number>;
  total: number;
};

export function summarizeDashboardApplications(applications: JobApplication[]): DashboardApplicationSummary {
  const counts: Record<JobApplicationStatus, number> = { APPLIED: 0, VIEWED: 0, SHORTLISTED: 0, HIRED: 0, REJECTED: 0 };
  for (const application of applications) counts[application.status] += 1;
  return { active: counts.APPLIED + counts.VIEWED + counts.SHORTLISTED, counts, total: applications.length };
}

export function getPendingDashboardInvitations(invitations: Invitation[], now: number = Date.now()) {
  return invitations.filter((invitation) => invitation.status === "PENDING" && Date.parse(invitation.expiresAt) > now)
    .sort((left, right) => Date.parse(left.expiresAt) - Date.parse(right.expiresAt) || left.id.localeCompare(right.id));
}

export type DashboardProfileTask = { id: string; label: string; complete: boolean };

/** Optional profile improvements; these are not a verification score or an approval gate. */
export function getDashboardProfileTasks(profile: SettingsProfileSnapshot): DashboardProfileTask[] {
  const teacher = profile.instructor;
  return [
    { id: "photo", label: "Add a profile photo", complete: Boolean(teacher?.imageUrl.trim()) },
    { id: "bio", label: "Introduce yourself to schools", complete: Boolean(teacher?.bio.trim()) },
    { id: "subjects", label: "Add subjects and key stages", complete: Boolean(teacher?.subjects.length && teacher.keyStages.length) },
    { id: "rates", label: "Set your teaching rate", complete: Number(teacher?.dailyRate) > 0 || Number(teacher?.hourlyRate) > 0 },
    { id: "location", label: "Add your location and travel distance", complete: Boolean(teacher?.postalCode.trim()) && Boolean(teacher?.maxTravelDistance.trim()) && Number(teacher?.maxTravelDistance) >= 0 },
  ];
}

export type DashboardPage<T> = {
  items: T[];
  pagination: { hasNextPage: boolean; page: number; total: number; totalPages: number };
};

/** Never turn a truncated, repeated or changing page into an apparently complete count. */
export async function loadDashboardPages<T extends { id: string }>(
  loadPage: (query: { page: number; limit: number }) => Promise<DashboardPage<T>>,
): Promise<T[]> {
  const items: T[] = [];
  const seen = new Set<string>();
  const deadline = Date.now() + 30_000;
  let expectedTotal: number | undefined;
  for (let page = 1; page <= 100; page += 1) {
    if (Date.now() >= deadline) throw new Error("Your dashboard took too long to load. Please try again.");
    const result = await loadPage({ page, limit: 100 });
    const pagination = result.pagination;
    if (!pagination || !Number.isSafeInteger(pagination.total) || pagination.total < 0 || pagination.page !== page) {
      throw new Error("Your complete dashboard could not be loaded. Please try again.");
    }
    expectedTotal ??= pagination.total;
    if (expectedTotal !== pagination.total) throw new Error("Your records changed while loading. Please refresh your dashboard.");
    for (const item of result.items) {
      if (!item.id || seen.has(item.id)) throw new Error("Your complete dashboard could not be loaded. Please try again.");
      seen.add(item.id);
      items.push(item);
    }
    if (!pagination.hasNextPage) {
      if (items.length !== expectedTotal) throw new Error("Your complete dashboard could not be loaded. Please try again.");
      return items;
    }
    if (result.items.length === 0 || items.length >= expectedTotal) throw new Error("Your complete dashboard could not be loaded. Please try again.");
  }
  throw new Error("Your dashboard has too many records to summarise. Open the full list to continue.");
}
```

### features/dashboard/use-teacher-dashboard.ts

```ts
"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { PaginatedApplications } from "@/features/applications/types";
import type { PaginatedBookings } from "@/features/bookings/types";
import type { InvitationsPage } from "@/features/invitations/types";
import { usePayoutAccount, usePayoutBalance } from "@/features/payments/use-payments";
import { useSettingsProfile } from "@/features/settings/use-settings";
import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";

import {
  dashboardDayStart,
  getDashboardProfileTasks,
  getPendingDashboardInvitations,
  getUpcomingBookings,
  loadDashboardPages,
  summarizeDashboardApplications,
} from "./teacher-dashboard-data";

/** Composes authenticated teacher APIs; section failures remain independent. */
export function useTeacherDashboard() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const from = dashboardDayStart(now);
  const profileQuery = useSettingsProfile();
  const bookingsQuery = useQuery({
    queryKey: [...queryKeys.bookings.all, "teacher-dashboard", from],
    queryFn: async () => ({ bookings: await loadDashboardPages(async (pagination) => {
      const result = await fetchJson<PaginatedBookings>("/api/bookings/me", { query: { ...pagination, from, status: "CONFIRMED" } });
      return { items: result.bookings, pagination: result.pagination };
    }) }),
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    staleTime: 30_000,
    retry: 1,
  });
  const applicationsQuery = useQuery({
    queryKey: [...queryKeys.applications.all, "teacher-dashboard"],
    queryFn: async () => {
      const applications = await loadDashboardPages(async (pagination) => {
        const result = await fetchJson<PaginatedApplications>("/api/applications/me", { query: pagination });
        return { items: result.applications, pagination: result.pagination };
      });
      return { applications, summary: summarizeDashboardApplications(applications) };
    },
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    staleTime: 30_000,
    retry: 1,
  });
  const invitationsQuery = useQuery({
    queryKey: [...queryKeys.invitations.all, "teacher-dashboard"],
    queryFn: async () => ({ invitations: await loadDashboardPages(async (pagination) => {
      const result = await fetchJson<InvitationsPage>("/api/job-invitations/me", { query: { ...pagination, status: "PENDING" } });
      return { items: result.invitations, pagination: result.pagination };
    }) }),
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    retry: 1,
  });
  const payoutAccountQuery = usePayoutAccount();
  const balanceQuery = usePayoutBalance({ enabled: payoutAccountQuery.data?.ready === true });
  const queries = [profileQuery, bookingsQuery, applicationsQuery, invitationsQuery, payoutAccountQuery];
  const refresh = async () => {
    setNow(Date.now());
    await Promise.allSettled([...queries.map((query) => query.refetch()), ...(payoutAccountQuery.data?.ready ? [balanceQuery.refetch()] : [])]);
  };

  return {
    now,
    profileQuery,
    bookingsQuery,
    applicationsQuery,
    invitationsQuery,
    payoutAccountQuery,
    balanceQuery,
    upcomingBookings: getUpcomingBookings(bookingsQuery.data?.bookings ?? [], now),
    pendingInvitations: getPendingDashboardInvitations(invitationsQuery.data?.invitations ?? [], now),
    applicationSummary: applicationsQuery.data?.summary,
    profileTasks: profileQuery.data ? getDashboardProfileTasks(profileQuery.data) : undefined,
    refresh,
    isRefreshing: queries.some((query) => query.isFetching) || balanceQuery.isFetching,
  };
}
```

### features/conversations/socket.ts

```ts
"use client";

import { io, type Socket } from "socket.io-client";
import { useSyncExternalStore } from "react";

/**
 * One Socket.IO connection to the backend's `/conversations` namespace,
 * shared by every screen while the app is open. The browser never holds the
 * backend token: each (re)connection fetches a single-use 60-second ticket
 * from our own server and hands that to the socket.
 */
let socket: Socket | null = null;
let holders = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryAttempt = 0;
let ready = false;
const connectionListeners = new Set<() => void>();

function setReady(value: boolean) {
  if (ready === value) return;
  ready = value;
  connectionListeners.forEach((listener) => listener());
}

function subscribeConnection(listener: () => void) {
  connectionListeners.add(listener);
  return () => { connectionListeners.delete(listener); };
}

/** Connection health, not just configuration, controls the polling fallback. */
export function useConversationConnected() {
  return useSyncExternalStore(subscribeConnection, () => ready, () => false);
}

/** Where the backend listens for sockets; it sits under /api so one proxy rule covers REST and sockets. */
const SOCKET_PATH = "/api/socket.io";

/** Refusals that will not change by retrying: the account simply may not connect. */
const FINAL_REJECTIONS = new Set(["ROLE_NOT_ALLOWED", "ORIGIN_NOT_ALLOWED", "NAMESPACE_UNKNOWN"]);

function backendOrigin() {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ?? "";
}

/** True when the page can receive live updates; otherwise screens fall back to periodic refreshes. */
export function liveMessagingAvailable() {
  return Boolean(backendOrigin());
}

async function fetchTicket(): Promise<string> {
  const response = await fetch("/api/conversations/socket-ticket", {
    credentials: "same-origin", method: "POST", signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Socket ticket request failed with status ${response.status}`);

  const payload = (await response.json()) as { ticket?: string };
  if (!payload.ticket) throw new Error("Socket ticket missing from response");

  return payload.ticket;
}

/**
 * A refused handshake (no ticket, expired ticket, server restart mid-auth)
 * stops Socket.IO's own reconnection, so it is retried here with a capped
 * back-off. Final refusals (wrong role, wrong origin) are not retried.
 */
function scheduleRetry(current: Socket, reason: string) {
  if (FINAL_REJECTIONS.has(reason) || retryTimer || current !== socket) return;

  retryAttempt += 1;
  const delay = Math.min(30_000, 1000 * 2 ** Math.min(retryAttempt, 5));

  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (current === socket && !current.connected) current.connect();
  }, delay);
}

/** Returns the shared socket, connecting on first use. Null when the backend origin is not configured. */
export function acquireConversationSocket(): Socket | null {
  holders += 1;

  if (!liveMessagingAvailable()) {
    if (holders === 1) console.warn("NEXT_PUBLIC_API_URL is not set; live messaging is off, so conversations refresh every 30 seconds instead.");
    return null;
  }

  if (!socket) {
    const created = io(`${backendOrigin()}/conversations`, {
      // Called on every connection attempt, so a reconnect always carries a fresh ticket.
      auth: (callback) => {
        fetchTicket()
          .then((ticket) => callback({ ticket }))
          .catch(() => callback({}));
      },
      path: SOCKET_PATH,
      reconnectionDelayMax: 10_000,
      transports: ["websocket", "polling"],
      // If WebSocket is blocked (some school networks), fall back to long-polling instead of giving up.
      tryAllTransports: true,
      withCredentials: false,
    });

    created.on("connect", () => {
      retryAttempt = 0;
    });
    created.on("ready", () => setReady(true));
    created.on("disconnect", () => setReady(false));
    created.on("connect_error", (error) => {
      setReady(false);
      const code = (error as Error & { data?: { code?: string } }).data?.code ?? error.message;
      if (!created.active) scheduleRetry(created, code);
    });
    // The backend closes a socket whose credential expired; the next connect fetches a fresh ticket.
    created.on("auth:expired", () => {
      if (created === socket) {
        setReady(false);
        created.disconnect().connect();
      }
    });

    socket = created;
  }

  return socket;
}

/** Drops a holder; the connection closes once nothing on the page needs it. */
export function releaseConversationSocket() {
  holders = Math.max(0, holders - 1);

  if (holders === 0 && socket) {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    retryAttempt = 0;
    socket.disconnect();
    socket = null;
    setReady(false);
  }
}

/** Tells the other person in a thread that the user is (or stopped) typing. Silently ignored when offline. */
export function emitTyping(conversationId: string, typing: boolean) {
  socket?.emit("typing", { conversationId, typing });
}
```

### features/my-profile/queries.ts

```ts
import "server-only";

import { listApplicationsByJob, listMyApplications } from "@/features/applications/queries";
import { listMyBookings } from "@/features/bookings/queries";
import { getJob, listMyJobs } from "@/features/jobs/queries";
import { ApiError } from "@/lib/server/api-client";
import { getServerAuthContext } from "@/lib/server/auth-context";
import { backendEnabled } from "@/lib/server/backend-config";

import type { MyProfileReview, MyProfileReviews, ProfileApplication, ProfileApplications, ProfilePageQuery, ProfilePagination, ReviewDirection } from "./types";

async function requireProfileRole() {
  const auth = await getServerAuthContext();
  if (!auth) throw new ApiError("Sign in to view your profile.", 401);
  if (auth.role !== "teacher" && auth.role !== "institution") throw new ApiError("This profile is available to teachers and schools.", 403);
  if (!backendEnabled()) throw new ApiError("Connect your account service to load your profile history.", 503);
  return auth.role;
}

function requestBudget() {
  const deadline = Date.now() + 30_000;
  let requests = 0;
  return () => {
    if (Date.now() >= deadline || ++requests > 300) throw new ApiError("Your history could not be loaded completely. Please try again or open the relevant workspace page.", 503);
  };
}

/** Never return an apparently complete history when an upstream page is missing or repeats. */
async function collectPages<T extends { id: string }>(read: (page: number) => Promise<{ items: T[]; pagination: ProfilePagination }>, checkBudget: () => void): Promise<T[]> {
  const items = new Map<string, T>();
  for (let page = 1; ; page++) {
    checkBudget();
    const result = await read(page);
    const before = items.size;
    result.items.forEach(item => items.set(item.id, item));
    if (!result.pagination.hasNextPage) {
      if (items.size < result.pagination.total) throw new ApiError("Some history records could not be loaded. Please try again.", 502);
      return [...items.values()];
    }
    if (items.size === before) throw new ApiError("Your history returned a repeated page. Please try again.", 502);
  }
}

function paginate<T>(items: T[], { page, limit }: ProfilePageQuery) {
  const total = items.length;
  return { items: items.slice((page - 1) * limit, page * limit), pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: page * limit < total } };
}

function newestFirst(left: { createdAt?: string | null; id: string }, right: { createdAt?: string | null; id: string }) {
  const time = (value?: string | null) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
  return time(right.createdAt) - time(left.createdAt) || left.id.localeCompare(right.id);
}

export async function listMyProfileApplications(query: ProfilePageQuery): Promise<ProfileApplications> {
  const role = await requireProfileRole();
  if (role === "teacher") {
    const result = await listMyApplications(query);
    const jobs = new Map(await Promise.all([...new Set(result.applications.map(item => item.jobId))].map(async id => {
      try { return [id, await getJob(id)] as const; }
      catch (error) {
        if (error instanceof ApiError && (error.status === 403 || error.status === 404)) return [id, null] as const;
        throw error;
      }
    })));
    return { ...result, applications: result.applications.map(item => ({ ...item, jobTitle: item.jobName?.trim() || jobs.get(item.jobId)?.title || null, schoolName: jobs.get(item.jobId)?.school ?? null, jobAvailable: Boolean(jobs.get(item.jobId)) })) };
  }

  const checkBudget = requestBudget();
  const jobs = await collectPages(async page => {
    const result = await listMyJobs({ page, limit: 100 });
    return { items: result.jobs, pagination: result.pagination };
  }, checkBudget);
  const applications: ProfileApplication[] = [];
  for (let offset = 0; offset < jobs.length; offset += 5) {
    const batch = await Promise.all(jobs.slice(offset, offset + 5).map(async job => {
      const records = await collectPages(async page => {
        const result = await listApplicationsByJob(job.id, { page, limit: 100 });
        return { items: result.applications, pagination: result.pagination };
      }, checkBudget);
      return records.map(item => ({ ...item, jobTitle: item.jobName?.trim() || job.title, schoolName: job.school, jobAvailable: true }));
    }));
    applications.push(...batch.flat());
  }
  const result = paginate(applications.sort(newestFirst), query);
  return { applications: result.items, pagination: result.pagination };
}

export async function listMyProfileReviews(query: ProfilePageQuery & { direction: ReviewDirection }): Promise<MyProfileReviews> {
  const role = await requireProfileRole();
  const bookings = await collectPages(async page => {
    const result = await listMyBookings({ page, limit: 100 });
    return { items: result.bookings, pagination: result.pagination };
  }, requestBudget());
  const ownType = role === "teacher" ? "INSTRUCTOR" : "INSTITUTION";
  const unique = new Map<string, MyProfileReview>();
  for (const booking of bookings) {
    const party = role === "teacher" ? booking.institution : booking.instructor;
    for (const review of booking.reviews) {
      unique.set(review.id, {
        ...review,
        bookingId: booking.id,
        direction: review.reviewerType === ownType ? "given" : "received",
        jobId: booking.job.id,
        jobTitle: booking.job.title,
        partyId: party.id,
        partyName: party.fullName || party.name || (role === "teacher" ? "School" : "Teacher"),
      });
    }
  }
  const reviews = [...unique.values()].sort(newestFirst);
  const received = reviews.filter(review => review.direction === "received");
  const result = paginate(reviews.filter(review => review.direction === query.direction), query);
  return {
    reviews: result.items, pagination: result.pagination,
    receivedTotal: received.length, givenTotal: reviews.length - received.length,
    averageReceived: received.length ? received.reduce((sum, item) => sum + item.rating, 0) / received.length : null,
  };
}
```

### lib/query/keys.ts

```ts
export const queryKeys = {
  invitations: {
    all: ["invitations"] as const,
    detail: (id: string) => [...queryKeys.invitations.all, "detail", id] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.invitations.all, "list", filters ?? {}] as const,
  },
  applications: {
    all: ["applications"] as const,
    activeJobCount: () => [...queryKeys.applications.all, "active-job-count"] as const,
    byJob: (jobId: string, filters?: Record<string, unknown>) =>
      [...queryKeys.applications.all, "job", jobId, filters ?? {}] as const,
    detail: (applicationId: string) => [...queryKeys.applications.all, "detail", applicationId] as const,
    history: (applicationId: string) => [...queryKeys.applications.all, "history", applicationId] as const,
    mine: (filters?: Record<string, unknown>) => [...queryKeys.applications.all, "mine", filters ?? {}] as const,
  },
  auth: {
    all: ["auth"] as const,
    me: () => [...queryKeys.auth.all, "me"] as const,
  },
  bookings: {
    all: ["bookings"] as const,
    detail: (id: string) => [...queryKeys.bookings.all, "detail", id] as const,
    mine: (filters?: Record<string, unknown>) => [...queryKeys.bookings.all, "mine", filters ?? {}] as const,
  },
  conversations: {
    all: ["conversations"] as const,
    detail: (id: string) => [...queryKeys.conversations.all, "detail", id] as const,
    forApplication: (applicationId: string) => [...queryKeys.conversations.all, "application", applicationId] as const,
    list: () => [...queryKeys.conversations.all, "list"] as const,
    messages: (conversationId: string) => [...queryKeys.conversations.all, "messages", conversationId] as const,
    typing: (conversationId: string) => [...queryKeys.conversations.all, "typing", conversationId] as const,
    unread: () => [...queryKeys.conversations.all, "unread"] as const,
  },
  jobs: {
    all: ["jobs"] as const,
    detail: (id: string) => [...queryKeys.jobs.all, "detail", id] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.jobs.all, "list", filters ?? {}] as const,
    mine: (filters?: Record<string, unknown>) => [...queryKeys.jobs.all, "mine", filters ?? {}] as const,
  },
  matching: {
    all: ["matching"] as const,
    applications: (jobId: string, query?: Record<string, unknown>) => [...queryKeys.matching.all, "applications", jobId, query ?? {}] as const,
    instructors: (jobId: string, query?: Record<string, unknown>) => [...queryKeys.matching.all, "instructors", jobId, query ?? {}] as const,
    recommendedJobs: (query?: Record<string, unknown>) => [...queryKeys.matching.all, "recommended-jobs", query ?? {}] as const,
    score: (jobId: string) => [...queryKeys.matching.all, "score", jobId] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    list: () => [...queryKeys.notifications.all, "list"] as const,
    preferences: () => [...queryKeys.notifications.all, "preferences"] as const,
    recent: (limit?: number) => [...queryKeys.notifications.all, "recent", ...(limit ? [limit] : [])] as const,
    unread: () => [...queryKeys.notifications.all, "unread"] as const,
  },
  onboarding: {
    all: ["onboarding"] as const,
    current: () => [...queryKeys.onboarding.all, "current"] as const,
    documentRequirements: (role: string) => [...queryKeys.onboarding.all, "document-requirements", role] as const,
  },
  payments: {
    all: ["payments"] as const,
    balance: () => [...queryKeys.payments.all, "balance"] as const,
    allInvoices: (filters?: Record<string, unknown>) => [...queryKeys.payments.all, "invoices", "all", filters ?? {}] as const,
    myInvoices: (filters?: Record<string, unknown>) => [...queryKeys.payments.all, "invoices", "mine", filters ?? {}] as const,
    payoutAccount: () => [...queryKeys.payments.all, "payout-account"] as const,
  },
  publicProfiles: {
    all: ["public-profiles"] as const,
    institution: (id: string) => [...queryKeys.publicProfiles.all, "institution", id] as const,
    instructor: (id: string) => [...queryKeys.publicProfiles.all, "instructor", id] as const,
  },
  reviews: {
    all: ["reviews"] as const,
    institution: (institutionId: string) => [...queryKeys.reviews.all, "institution", institutionId] as const,
    instructor: (instructorId: string) => [...queryKeys.reviews.all, "instructor", instructorId] as const,
  },
  settings: {
    all: ["settings"] as const,
    profile: () => [...queryKeys.settings.all, "profile"] as const,
  },
  teachers: {
    all: ["teachers"] as const,
    detail: (id: string) => [...queryKeys.teachers.all, "detail", id] as const,
    directory: (filters?: Record<string, unknown>) => [...queryKeys.teachers.all, "directory", filters ?? {}] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.teachers.all, "list", filters ?? {}] as const,
  },
};
```

### lib/invitation-links.ts

```ts
/** Only an authenticated invitation route can be a return destination. */
export function invitationReturnPath(value: unknown): string | null {
  return typeof value === "string" && /^\/job-invitations(?:\/[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12})?$/i.test(value) ? value : null;
}
export function invitationLoginHref(value: unknown) {
  const destination = invitationReturnPath(value);
  return destination ? `/login?returnTo=${encodeURIComponent(destination)}` : "/login";
}
```

### lib/server/token-refresh.ts

```ts
import "server-only";

import { createHash } from "node:crypto";
import { ApiError } from "./api-error";
import { readUnverifiedJwtExpiresAt, readUnverifiedJwtPayload } from "./jwt";
import type { ServerAuthContext } from "./auth-context";

type RefreshResult = {
  accessToken?: string;
  accessTokenExpiresAt?: number;
  refreshToken?: string;
};

// Share only the upstream request, never a caller's cookie-writing context.
// A short grace period lets parallel requests and the first client request after
// server rendering persist the same rotated pair. This cache is process-local.
type RefreshCache = Map<string, { promise: Promise<RefreshResult | null>; expiresAt: number }>;
// Next can load separate copies of this module for RSC and route handlers.
// A process-wide store lets both persist the same rotated token pair.
const refreshGlobal = globalThis as typeof globalThis & { __supplyedBackendRefreshes?: RefreshCache };
const refreshes: RefreshCache = refreshGlobal.__supplyedBackendRefreshes ??= new Map();
const MAX_REFRESHES = 1000;
const REFRESH_GRACE_MS = 30_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function readTokenUserId(accessToken?: string) {
  const payload = readUnverifiedJwtPayload(accessToken);
  return readString(payload?.sub);
}

function normalizeExpiryTimestamp(value: number) {
  return value < 10_000_000_000 ? value * 1000 : value;
}

async function updateBackendAuthSession(data: Record<string, unknown>) {
  try {
    const { updateAuthSession } = await import("@/auth");
    await updateAuthSession(data as never);
  } catch (error) {
    // Server Components cannot write cookies. The grace cache keeps the rotated
    // pair available to the next writable request without reusing the old token.
    if (!(error instanceof Error && error.message.includes("Cookies can only be modified"))) {
      console.error(JSON.stringify({ event: "session_persistence_failed", errorType: error instanceof Error ? error.name : "Unknown" }));
    }
  }
}

async function persistBackendTokenRefresh(result: RefreshResult) {
  if (!result.accessToken || !readTokenUserId(result.accessToken)) return;

  await updateBackendAuthSession({
    backendAuthUpdate: {
      type: "refresh",
      accessToken: result.accessToken,
      accessTokenExpiresAt: result.accessTokenExpiresAt,
      refreshToken: result.refreshToken,
    },
  });
}

export async function markBackendSessionExpired(message = "Your session expired. Sign in again to continue.") {
  await updateBackendAuthSession({
    backendAuthUpdate: {
      type: "expired",
      message,
    },
  });
}

function getApiBaseUrl() {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) return null;
  return baseUrl;
}

function buildApiPath(basePath: string, path: string) {
  const normalizedBasePath = basePath === "/" ? "" : basePath.replace(/\/+$/, "");
  const normalizedPath = path.replace(/^\/+/, "");

  return [normalizedBasePath, normalizedPath].filter(Boolean).join("/");
}

function buildApiUrl(path: string) {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) return null;

  const url = new URL(baseUrl);
  url.pathname = buildApiPath(url.pathname, path);
  url.search = "";
  return url;
}

function unwrapApiPayload(payload: unknown) {
  if (isRecord(payload) && "data" in payload && ("success" in payload || "message" in payload)) {
    return payload.data;
  }

  return payload;
}

function readAccessTokenExpiresAt(record: Record<string, unknown>, accessToken?: string) {
  const tokens = isRecord(record.tokens) ? record.tokens : {};
  const explicitExpiresAt =
    readNumber(record.accessTokenExpiresAt) ??
    readNumber(record.expiresAt) ??
    readNumber(tokens.accessTokenExpiresAt) ??
    readNumber(tokens.expiresAt);

  if (explicitExpiresAt) return normalizeExpiryTimestamp(explicitExpiresAt);

  const expiresAtIso = readString(record.accessTokenExpiresAt) ?? readString(record.expiresAt) ?? readString(tokens.expiresAt);
  if (expiresAtIso) {
    const parsed = Date.parse(expiresAtIso);
    if (Number.isFinite(parsed)) return parsed;
  }

  const expiresInSeconds =
    readNumber(record.accessTokenExpiresInSeconds) ??
    readNumber(record.accessTokenExpiresIn) ??
    readNumber(record.expiresIn) ??
    readNumber(tokens.accessTokenExpiresInSeconds) ??
    readNumber(tokens.accessTokenExpiresIn);

  if (expiresInSeconds) return Date.now() + expiresInSeconds * 1000;

  return readUnverifiedJwtExpiresAt(accessToken);
}

async function requestTokenRefresh(refreshToken: string): Promise<RefreshResult | null> {
  const url = buildApiUrl("/auth/refresh");
  if (!url) return null;

  const response = await fetch(url, {
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "POST",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    await response.body?.cancel();
    if (response.status === 401 || response.status === 403) return null;
    throw new ApiError("Your session could not be refreshed right now. Please try again.", 503, undefined, "AUTH_SERVICE_UNAVAILABLE");
  }

  const payload = unwrapApiPayload(await response.json().catch(() => null));
  if (!isRecord(payload)) {
    throw new ApiError("The authentication service returned an invalid response. Please try again.", 502);
  }

  const tokens = isRecord(payload.tokens) ? payload.tokens : {};
  const accessToken = readString(payload.accessToken) ?? readString(tokens.accessToken);
  const nextRefreshToken = readString(payload.refreshToken) ?? readString(tokens.refreshToken);

  if (!accessToken) {
    throw new ApiError("The authentication service returned an incomplete response. Please try again.", 502);
  }

  const result = {
    accessToken,
    accessTokenExpiresAt: readAccessTokenExpiresAt(payload, accessToken),
    refreshToken: nextRefreshToken,
  };

  return result;
}

export async function refreshBackendAccessToken(refreshToken: string): Promise<RefreshResult | null> {
  const now = Date.now();
  for (const [key, entry] of refreshes) {
    if (entry.expiresAt <= now) refreshes.delete(key);
  }
  const key = createHash("sha256").update(refreshToken).digest("hex");
  let entry = refreshes.get(key);
  if (!entry) {
    if (refreshes.size >= MAX_REFRESHES) {
      throw new ApiError("Sign-in is busy. Please try again shortly.", 503);
    }
    entry = { promise: requestTokenRefresh(refreshToken), expiresAt: now + 15_000 + REFRESH_GRACE_MS };
    refreshes.set(key, entry);
    const current = entry;
    void current.promise.then((result) => {
      if (!result) refreshes.delete(key);
      else current.expiresAt = Math.min(Date.now() + REFRESH_GRACE_MS, result.accessTokenExpiresAt ?? Infinity);
    }, () => { refreshes.delete(key); });
  }
  const result = await entry.promise;
  if (result) await persistBackendTokenRefresh(result);
  else await markBackendSessionExpired();
  return result;
}

export async function getValidAccessToken(authContext: ServerAuthContext): Promise<string | null> {
  if (!authContext?.accessToken) return null;

  const expiresAt = authContext.accessTokenExpiresAt ?? readUnverifiedJwtExpiresAt(authContext.accessToken);
  if (!expiresAt || Date.now() <= expiresAt - 60_000) {
    return authContext.accessToken;
  }

  if (!authContext.refreshToken) {
    await markBackendSessionExpired();
    return null;
  }

  const refreshed = await refreshBackendAccessToken(authContext.refreshToken);
  return refreshed?.accessToken ?? null;
}
```

## Appendix D. Website route inventory

These paths belong to the Next.js website. This list prevents confusing a browser aggregation/transport route with the similarly named backend endpoint. Server Action writes also exist outside this list. For native requests, use Appendix A and the DTO definitions.

| Web route | HTTP exports | Adapter source |
| --- | --- | --- |
| `/api/applications/[id]/history` | GET | `app/api/applications/[id]/history/route.ts` |
| `/api/applications/[id]` | GET | `app/api/applications/[id]/route.ts` |
| `/api/applications/active-jobs/count` | GET | `app/api/applications/active-jobs/count/route.ts` |
| `/api/applications/job/[jobId]` | GET | `app/api/applications/job/[jobId]/route.ts` |
| `/api/applications/me` | GET | `app/api/applications/me/route.ts` |
| `/api/auth/[...nextauth]` | See route module | `app/api/auth/[...nextauth]/route.ts` |
| `/api/auth/me` | GET | `app/api/auth/me/route.ts` |
| `/api/bookings/[id]` | GET | `app/api/bookings/[id]/route.ts` |
| `/api/bookings/me` | GET | `app/api/bookings/me/route.ts` |
| `/api/conversations/[id]/attachments/[attachmentId]/preview` | GET | `app/api/conversations/[id]/attachments/[attachmentId]/preview/route.ts` |
| `/api/conversations/[id]/attachments` | POST | `app/api/conversations/[id]/attachments/route.ts` |
| `/api/conversations/[id]/messages` | GET | `app/api/conversations/[id]/messages/route.ts` |
| `/api/conversations/[id]` | GET | `app/api/conversations/[id]/route.ts` |
| `/api/conversations` | GET | `app/api/conversations/route.ts` |
| `/api/conversations/socket-ticket` | POST | `app/api/conversations/socket-ticket/route.ts` |
| `/api/conversations/unread-count` | GET | `app/api/conversations/unread-count/route.ts` |
| `/api/health` | GET | `app/api/health/route.ts` |
| `/api/institutions/profile/[id]` | GET | `app/api/institutions/profile/[id]/route.ts` |
| `/api/instructors/directory` | GET | `app/api/instructors/directory/route.ts` |
| `/api/instructors/profile/[id]` | GET | `app/api/instructors/profile/[id]/route.ts` |
| `/api/invoices/[id]` | GET | `app/api/invoices/[id]/route.ts` |
| `/api/invoices/me` | GET | `app/api/invoices/me/route.ts` |
| `/api/invoices` | GET | `app/api/invoices/route.ts` |
| `/api/job-invitations/[id]` | GET | `app/api/job-invitations/[id]/route.ts` |
| `/api/job-invitations/me` | GET | `app/api/job-invitations/me/route.ts` |
| `/api/jobs/[id]` | GET | `app/api/jobs/[id]/route.ts` |
| `/api/jobs/mine` | GET | `app/api/jobs/mine/route.ts` |
| `/api/jobs` | GET | `app/api/jobs/route.ts` |
| `/api/matching/jobs/[jobId]/applications` | GET | `app/api/matching/jobs/[jobId]/applications/route.ts` |
| `/api/matching/jobs/[jobId]/instructors` | GET | `app/api/matching/jobs/[jobId]/instructors/route.ts` |
| `/api/matching/jobs/[jobId]/score` | GET | `app/api/matching/jobs/[jobId]/score/route.ts` |
| `/api/matching/jobs/recommended` | GET | `app/api/matching/jobs/recommended/route.ts` |
| `/api/my-profile/applications` | GET | `app/api/my-profile/applications/route.ts` |
| `/api/my-profile/reviews` | GET | `app/api/my-profile/reviews/route.ts` |
| `/api/notifications/preferences` | GET | `app/api/notifications/preferences/route.ts` |
| `/api/notifications` | GET | `app/api/notifications/route.ts` |
| `/api/notifications/unread-count` | GET | `app/api/notifications/unread-count/route.ts` |
| `/api/onboarding/document-requirements` | GET | `app/api/onboarding/document-requirements/route.ts` |
| `/api/onboarding/documents/[documentId]/preview` | GET | `app/api/onboarding/documents/[documentId]/preview/route.ts` |
| `/api/onboarding/documents` | POST | `app/api/onboarding/documents/route.ts` |
| `/api/onboarding/me` | GET | `app/api/onboarding/me/route.ts` |
| `/api/payments/payout-account/balance` | GET | `app/api/payments/payout-account/balance/route.ts` |
| `/api/payments/payout-account/instant-payout` | POST | `app/api/payments/payout-account/instant-payout/route.ts` |
| `/api/payments/payout-account` | GET | `app/api/payments/payout-account/route.ts` |
| `/api/payments/payout-accounts/instructor/[instructorId]` | GET | `app/api/payments/payout-accounts/instructor/[instructorId]/route.ts` |
| `/api/reviews/institution/[institutionId]` | GET | `app/api/reviews/institution/[institutionId]/route.ts` |
| `/api/reviews/instructor/[instructorId]` | GET | `app/api/reviews/instructor/[instructorId]/route.ts` |
| `/api/settings/profile` | GET | `app/api/settings/profile/route.ts` |
| `/api/signatory-approvals/[token]` | GET, POST | `app/api/signatory-approvals/[token]/route.ts` |
| `/api/teachers/[id]` | GET | `app/api/teachers/[id]/route.ts` |
| `/api/teachers` | GET | `app/api/teachers/route.ts` |
| `/api/teaching-catalogue` | GET | `app/api/teaching-catalogue/route.ts` |

## Appendix E. Complete changed-file index

Scope labels: **C1** = commit `620d333`; **C2** = commit `4c666d1`; **W** = present tracked working-tree change; **N** = present untracked addition. A file can appear in several scopes; final source wins. The index includes historical files later restored or deleted so no reviewed commit change disappears from the audit. Generated audit evidence, lockfiles, CSS and deployment files are indexed for traceability, not treated as mobile REST contracts. Scratch validation logs and this handoff generator are excluded.

### `.github/workflows/dev-cicd.yml` [C1]

Build, deployment, tooling, generated types, dependencies or verification infrastructure.

Final file SHA-256 prefix: `94b1913b736c`.

### `APPLICATION_STATUS_DIRECT_HIRE_INTEGRATION.md` [N]

Documentation/audit evidence; see final feature behavior above for current contracts.

Final file SHA-256 prefix: `267a262ac20e`.

### `Dockerfile` [C1]

Build, deployment, tooling, generated types, dependencies or verification infrastructure.

Final file SHA-256 prefix: `f330fae40711`.

### `SUPPLYED_JOBS_APPLICATIONS_INVITATIONS_IMPLEMENTATION.md` [N]

Documentation/audit evidence; see final feature behavior above for current contracts.

Final file SHA-256 prefix: `b3792d60c9f5`.

### `app/(app)/job-invitations/[id]/page.tsx` [N]

Route entry, authentication/onboarding navigation, public metadata or shared stylesheet delivery.

Current symbols: `metadata`, `InvitationRoute`.

Final file SHA-256 prefix: `32cd753e2fa4`.

### `app/(app)/job-invitations/page.tsx` [N]

Route entry, authentication/onboarding navigation, public metadata or shared stylesheet delivery.

Current symbols: `metadata`, `InvitationsRoute`.

Final file SHA-256 prefix: `9ebf9092e9a0`.

### `app/(app)/my-profile/page.tsx` [N]

Route entry, authentication/onboarding navigation, public metadata or shared stylesheet delivery.

Current symbols: `metadata`, `MyProfileRoutePage`.

Final file SHA-256 prefix: `7d938b276bc0`.

### `app/(app)/onboarding/page.tsx` [W]

Route entry, authentication/onboarding navigation, public metadata or shared stylesheet delivery.

Current symbols: `metadata`, `readOptional`, `createSessionRepairTicket`, `OnboardingPage`.

Final file SHA-256 prefix: `cc1fc5df60b6`.

### `app/(public)/how-it-works/page.tsx` [C1, C2]

Route entry, authentication/onboarding navigation, public metadata or shared stylesheet delivery.

Current symbols: `metadata`, `HowItWorksPage`.

Final file SHA-256 prefix: `7668f12abce9`.

### `app/(public)/layout.tsx` [C2]

Route entry, authentication/onboarding navigation, public metadata or shared stylesheet delivery.

Current symbols: `PublicLayout`.

Final file SHA-256 prefix: `a561b74a1b22`.

### `app/api/applications/[id]/history/route.ts` [N]

Website HTTP adapter: authentication, input validation, transport and/or normalized backend response; see route inventory.

Current symbols: `dynamic`, `GET`.

Final file SHA-256 prefix: `84507b03c020`.

### `app/api/applications/job/[jobId]/route.ts` [C1, W]

Website HTTP adapter: authentication, input validation, transport and/or normalized backend response; see route inventory.

Current symbols: `dynamic`, `GET`.

Final file SHA-256 prefix: `a4a1840d58d7`.

### `app/api/applications/me/route.ts` [C1, W]

Website HTTP adapter: authentication, input validation, transport and/or normalized backend response; see route inventory.

Current symbols: `dynamic`, `GET`.

Final file SHA-256 prefix: `77dfe06444ca`.

### `app/api/bookings/[id]/route.ts` [N]

Website HTTP adapter: authentication, input validation, transport and/or normalized backend response; see route inventory.

Current symbols: `dynamic`, `GET`.

Final file SHA-256 prefix: `3bec5402b11b`.

### `app/api/bookings/me/route.ts` [C1]

Website HTTP adapter: authentication, input validation, transport and/or normalized backend response; see route inventory.

Current symbols: `dynamic`, `GET`.

Final file SHA-256 prefix: `f45e26aba4e9`.

### `app/api/conversations/[id]/attachments/route.ts` [C1]

Website HTTP adapter: authentication, input validation, transport and/or normalized backend response; see route inventory.

Current symbols: `dynamic`, `POST`.

Final file SHA-256 prefix: `14cc857b8fdc`.

### `app/api/conversations/[id]/route.ts` [N]

Website HTTP adapter: authentication, input validation, transport and/or normalized backend response; see route inventory.

Current symbols: `dynamic`, `GET`.

Final file SHA-256 prefix: `24da62697a8a`.

### `app/api/conversations/route.ts` [C1]

Website HTTP adapter: authentication, input validation, transport and/or normalized backend response; see route inventory.

Current symbols: `dynamic`, `GET`.

Final file SHA-256 prefix: `87d9d0c732d1`.

### `app/api/health/route.ts` [C1]

Website HTTP adapter: authentication, input validation, transport and/or normalized backend response; see route inventory.

Current symbols: `dynamic`, `GET`.

Final file SHA-256 prefix: `0de3edeb3a2f`.

### `app/api/instructors/directory/route.ts` [C1]

Website HTTP adapter: authentication, input validation, transport and/or normalized backend response; see route inventory.

Current symbols: `dynamic`, `GET`, `readBoolean`, `readNumber`.

Final file SHA-256 prefix: `d23c3c7cc55f`.

### `app/api/job-invitations/[id]/route.ts` [N]

Website HTTP adapter: authentication, input validation, transport and/or normalized backend response; see route inventory.

Current symbols: `dynamic`, `GET`.

Final file SHA-256 prefix: `4a11f571c4ea`.

### `app/api/job-invitations/me/route.ts` [N]

Website HTTP adapter: authentication, input validation, transport and/or normalized backend response; see route inventory.

Current symbols: `dynamic`, `GET`.

Final file SHA-256 prefix: `6691fad36cba`.

### `app/api/jobs/mine/route.ts` [C1, W]

Website HTTP adapter: authentication, input validation, transport and/or normalized backend response; see route inventory.

Current symbols: `dynamic`, `GET`.

Final file SHA-256 prefix: `be3ffac93a8b`.

### `app/api/jobs/route.ts` [C1, W]

Website HTTP adapter: authentication, input validation, transport and/or normalized backend response; see route inventory.

Current symbols: `dynamic`, `GET`.

Final file SHA-256 prefix: `a6493f5d9df8`.

### `app/api/matching/jobs/[jobId]/applications/route.ts` [C1]

Website HTTP adapter: authentication, input validation, transport and/or normalized backend response; see route inventory.

Current symbols: `dynamic`, `GET`.

Final file SHA-256 prefix: `3bc522c043c5`.

### `app/api/matching/jobs/[jobId]/instructors/route.ts` [C1]

Website HTTP adapter: authentication, input validation, transport and/or normalized backend response; see route inventory.

Current symbols: `dynamic`, `GET`.

Final file SHA-256 prefix: `a623a7918dca`.

### `app/api/matching/jobs/recommended/route.ts` [C1]

Website HTTP adapter: authentication, input validation, transport and/or normalized backend response; see route inventory.

Current symbols: `dynamic`, `GET`.

Final file SHA-256 prefix: `2c4592ed84ea`.

### `app/api/my-profile/applications/route.ts` [N]

Website HTTP adapter: authentication, input validation, transport and/or normalized backend response; see route inventory.

Current symbols: `dynamic`, `GET`.

Final file SHA-256 prefix: `3f4c3e808568`.

### `app/api/my-profile/reviews/route.ts` [N]

Website HTTP adapter: authentication, input validation, transport and/or normalized backend response; see route inventory.

Current symbols: `dynamic`, `GET`.

Final file SHA-256 prefix: `9b4afc5ece5a`.

### `app/api/notifications/route.ts` [C1]

Website HTTP adapter: authentication, input validation, transport and/or normalized backend response; see route inventory.

Current symbols: `dynamic`, `GET`.

Final file SHA-256 prefix: `946c012359fd`.

### `app/api/onboarding/documents/[documentId]/preview/route.ts` [C1]

Website HTTP adapter: authentication, input validation, transport and/or normalized backend response; see route inventory.

Current symbols: `dynamic`, `runtime`, `readString`, `inlineContentDisposition`, `GET`.

Final file SHA-256 prefix: `58a60fe36899`.

### `app/api/onboarding/documents/route.ts` [C1]

Website HTTP adapter: authentication, input validation, transport and/or normalized backend response; see route inventory.

Current symbols: `POST`.

Final file SHA-256 prefix: `0d32dd3baa82`.

### `app/api/payments/payout-account/instant-payout/route.ts` [C1]

Website HTTP adapter: authentication, input validation, transport and/or normalized backend response; see route inventory.

Current symbols: `dynamic`, `POST`.

Final file SHA-256 prefix: `934eda388784`.

### `app/api/signatory-approvals/[token]/route.ts` [C1]

Website HTTP adapter: authentication, input validation, transport and/or normalized backend response; see route inventory.

Current symbols: `dynamic`, `validToken`, `GET`, `POST`.

Final file SHA-256 prefix: `7f2a1bb8bf7f`.

### `app/api/teachers/route.ts` [C1]

Website HTTP adapter: authentication, input validation, transport and/or normalized backend response; see route inventory.

Current symbols: `dynamic`, `GET`.

Final file SHA-256 prefix: `fa1e39bc1c1b`.

### `app/api/teaching-catalogue/route.ts` [N]

Website HTTP adapter: authentication, input validation, transport and/or normalized backend response; see route inventory.

Current symbols: `dynamic`, `GET`.

Final file SHA-256 prefix: `a258e326b4be`.

### `app/globals.css` [C1]

Visual layout, responsive spacing, readable states and shared theme styling; native UI adapts the behavior.

Final file SHA-256 prefix: `a131d56e6ce1`.

### `app/layout.tsx` [C1, W]

Route entry, authentication/onboarding navigation, public metadata or shared stylesheet delivery.

Current symbols: `mix`, `luminance`, `metadata`, `RootLayout`.

Final file SHA-256 prefix: `a8831d20b338`.

### `app/not-found.tsx` [C1]

Route entry, authentication/onboarding navigation, public metadata or shared stylesheet delivery.

Current symbols: `NotFound`.

Final file SHA-256 prefix: `33182210cfcd`.

### `app/post-auth/page.tsx` [W]

Route entry, authentication/onboarding navigation, public metadata or shared stylesheet delivery.

Current symbols: `metadata`, `PostAuthPage`.

Final file SHA-256 prefix: `b4c8b874c3cf`.

### `app/robots.ts` [W]

Route entry, authentication/onboarding navigation, public metadata or shared stylesheet delivery.

Current symbols: `robots`.

Final file SHA-256 prefix: `366fcec01b11`.

### `app/sitemap.ts` [C1, C2]

Route entry, authentication/onboarding navigation, public metadata or shared stylesheet delivery.

Current symbols: `sitemap`.

Final file SHA-256 prefix: `8f3a3a7324f8`.

### `auth.ts` [C1]

Shared data model or supporting application configuration.

Current symbols: `authSecret`, `readEnv`, `readCredential`, `isRecord`, `readString`, `readNumber`, `toAuthUser`, `assignBackendSession`, `assignBackendAuthError`, `assignRefreshAuthError`, `clearBackendAuthError`, `readJwtSubject`, `readJwtTokenKind`, `hasUnexpectedJwtTokenKind`, `canApplyBackendTokenUpdate`, `applyBackendSessionUpdate`.

Final file SHA-256 prefix: `c0d52dc4b89d`.

### `components/atoms/Avatar.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `Avatar`.

Final file SHA-256 prefix: `d02dbc4733da`.

### `components/atoms/Button.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `ButtonProps`, `buttonClassName`, `Button`, `Btn`.

Final file SHA-256 prefix: `eb11b94e65be`.

### `components/atoms/Checkbox.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `Checkbox`.

Final file SHA-256 prefix: `a37d160e6147`.

### `components/atoms/Chip.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `Chip`.

Final file SHA-256 prefix: `f40e6873e159`.

### `components/atoms/Field.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `findControl`, `associateControl`, `Field`.

Final file SHA-256 prefix: `ef32a8ed5164`.

### `components/atoms/Icon.tsx` [W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `Icon`.

Final file SHA-256 prefix: `d8d8ef81d8cc`.

### `components/atoms/Stars.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `Stars`.

Final file SHA-256 prefix: `a01592cf601e`.

### `components/atoms/Toggle.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `Toggle`.

Final file SHA-256 prefix: `f0e3cfe1a930`.

### `components/molecules/AppAccountMenu.tsx` [C1, W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `AppAccountMenuItem`, `selectAction`, `AppAccountMenu`, `onPointerDown`, `onKeyDown`, `closeThen`.

Final file SHA-256 prefix: `bee3fc2ddc3e`.

### `components/molecules/MatchScorePanel.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `MatchScorePanel`.

Final file SHA-256 prefix: `65f5765496b9`.

### `components/molecules/Modal.tsx` [C1, W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `Modal`, `onKeyDown`.

Final file SHA-256 prefix: `35ae88176f83`.

### `components/molecules/OptionDropdowns.tsx` [C1, W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `SelectOption`, `normalizeOption`, `OptionDropdown`, `close`, `show`, `change`, `choose`, `position`, `dismissOutside`, `handleKeyDown`, `SelectDropdown`, `MultiSelectDropdown`.

Final file SHA-256 prefix: `6061ea056aee`.

### `components/molecules/PhoneInput.tsx` [C1, W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `PhoneInput`, `acceptInput`, `pasteNumber`.

Final file SHA-256 prefix: `fd7c05696abc`.

### `components/molecules/PhoneVerification.tsx` [C1, W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `PhoneVerification`, `sendCode`, `verifyCode`.

Final file SHA-256 prefix: `e9c1fa9215ae`.

### `components/molecules/PostcodeLookup.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `PostcodeLookupSelection`, `lookupPostcodeArea`, `PostcodeLookup`, `lookup`.

Final file SHA-256 prefix: `6350b28ffc9b`.

### `components/molecules/ProposalEditor.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `escapeHtml`, `proposalToHtml`, `editorTextLength`, `editorHtml`, `normalizeLink`, `ProposalEditor`, `closeLinkEditor`, `applyLink`, `removeLink`.

Final file SHA-256 prefix: `b35a27dfee45`.

### `components/molecules/PublicAccountMenu.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `getDisplayName`, `getRoleLabel`, `getAccountLinks`, `PublicAccountMenu`, `onPointerDown`, `onKeyDown`, `logout`.

Final file SHA-256 prefix: `cae26a888b5f`.

### `components/molecules/PublicThemeControls.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `PublicThemeControls`, `closeControls`, `dismiss`, `openControls`, `selectAccent`.

Final file SHA-256 prefix: `3153d78bd82b`.

### `components/molecules/RoleDescriptionEditor.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `escapeHtml`, `formatLegacyInline`, `legacyDescriptionToHtml`, `flushList`, `isEmptyEditor`, `normalizedEditorHtml`, `RoleDescriptionEditor`.

Final file SHA-256 prefix: `e32308951d57`.

### `components/molecules/RouteErrorState.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `RouteErrorState`.

Final file SHA-256 prefix: `b064df3c190d`.

### `components/molecules/SocialAuthButtons.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `SocialAuthButtons`.

Final file SHA-256 prefix: `23034d91f2de`.

### `components/molecules/TagInput.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `TagInput`, `addDraft`.

Final file SHA-256 prefix: `bf7e0b78ec57`.

### `components/molecules/TeachingSelectionFields.tsx` [N]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `TeachingSelectionFields`, `change`, `reviewValues`, `CatalogueStatus`, `CatalogueSubjectFilter`, `CatalogueKeyStages`.

Final file SHA-256 prefix: `46b3b8de4481`.

### `components/molecules/ToastStack.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `clearTimer`, `ToastStack`.

Final file SHA-256 prefix: `56d2dd71be39`.

### `components/molecules/index.ts` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Final file SHA-256 prefix: `40e3777e68ab`.

### `components/organisms/AdminPayoutLookup.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `AdminPayoutLookup`, `lookup`.

Final file SHA-256 prefix: `b6be15c3d674`.

### `components/organisms/AppChrome.tsx` [C1, W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `AppChrome`, `submitNavSearch`, `navigate`.

Final file SHA-256 prefix: `acbc6ae68634`.

### `components/organisms/ApplicationStatusPage.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `statusCopy`, `ApplicationStatusPage`.

Final file SHA-256 prefix: `466e8e689979`.

### `components/organisms/ApplicationsJobList.tsx` [W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `ApplicationsJobFilter`, `ApplicationsJobList`, `JobFilterHeader`, `ApplicationJobRow`, `summarizeInvitedJobs`, `invitationJobSnapshot`.

Final file SHA-256 prefix: `228dbfcbcefb`.

### `components/organisms/ApplicationsPage.tsx` [C1, W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `ApplicationsPage`, `CandidateHeader`, `StatusActions`, `ApplicationStatusTag`, `EmptyState`, `formatPay`, `formatLocation`, `formatStatus`.

Final file SHA-256 prefix: `d3d5de85b291`.

### `components/organisms/ApplicationsWorkspacePage.tsx` [C1, W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `ApplicationsPage`, `openApplication`, `closeApplication`, `changeStatus`, `confirmHire`, `ApplicationListRow`, `ApplicationDetail`, `TeacherReviewsPanel`, `StatusWorkflow`, `moveTo`, `JobDetailPanel`, `toApplicationRows`, `workflowIndex`, `statusHelp`, `ApplicationStatusTag`, `InfoTile`, `InfoLine`, `EmptyState`, `formatPay`, `formatLocation`, `formatStatus`, `formatDate`, `formatRating`, `stripHtml`.

Final file SHA-256 prefix: `84825016378d`.

### `components/organisms/BillingPage.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `BillingPage`, `SchoolInvoices`, `TeacherEarnings`, `CashOutCard`, `AdminPayments`, `RefundModal`, `AdminInvoiceFilters`, `InvoiceList`, `InvoiceRow`, `InvoiceStatusTag`, `PdfLink`, `payable`, `RefreshInvoices`, `invoiceQuery`, `isUnpaid`, `EmptyState`, `notify`, `actionMessage`, `mutationFailure`, `sum`, `isOverdue`, `describeWork`, `timing`, `formatDateRange`, `formatDate`.

Final file SHA-256 prefix: `603728f55636`.

### `components/organisms/BookingsPage.tsx` [C1, W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `BookingsPage`, `applyFilters`, `clearFilters`, `BookingCard`, `InvoiceStrip`, `CreateInvoiceModal`, `isPastDue`, `CancelBookingModal`, `ReviewBookingModal`, `Detail`, `validateCancellationReason`, `validateBookingReview`, `BookingStatusTag`, `EmptyState`, `emptyMessage`, `isReviewableBookingStatus`, `formatClosedStatus`, `reviewerType`, `formatDateRange`, `formatDate`, `formatPay`.

Final file SHA-256 prefix: `cc39c4f77f07`.

### `components/organisms/CalendarPage.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `CalendarPage`.

Final file SHA-256 prefix: `0970076453d9`.

### `components/organisms/DashboardMessages.tsx` [W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `DashboardMessages`.

Final file SHA-256 prefix: `1884459b1cc4`.

### `components/organisms/DeleteJobModal.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `DeleteJobModal`.

Final file SHA-256 prefix: `f5f8b59653fb`.

### `components/organisms/FindJobsPage.tsx` [C1, W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `FindJobsPage`.

Final file SHA-256 prefix: `fe49fa81daae`.

### `components/organisms/FindTeachersPage.tsx` [C1, W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `FindTeachersPage`, `update`, `applyFilters`, `resetFilters`, `TeacherDirectoryCard`, `trimFilters`, `validateDirectoryFilters`, `optionalNumber`, `formatMoney`, `formatRating`, `pageItems`.

Final file SHA-256 prefix: `7d06afb8fde1`.

### `components/organisms/ForgotPasswordRouteClient.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `fieldClass`, `formData`, `ForgotPasswordRouteClient`, `syncResendTimer`, `goLanding`, `goLogin`, `resetToEmail`, `handleCodeChange`, `handleCodeKeyDown`, `handleCodePaste`, `requestReset`, `resendCode`, `confirmReset`.

Final file SHA-256 prefix: `ec4af45e7601`.

### `components/organisms/FoundingInterestForm.tsx` [C1, C2, W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `FoundingInterestForm`, `WaitlistForm`, `input`, `select`.

Final file SHA-256 prefix: `9c4b67ff2fee`.

### `components/organisms/FoundingInterestPage.tsx` [C1, C2]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `contentFor`, `themedCardStyle`, `FoundingInterestPage`.

Final file SHA-256 prefix: `460899104659`.

### `components/organisms/FoundingSchoolSections.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `themedCardStyle`, `FoundingSchoolTrustStrip`, `FoundingSchoolCohortSection`, `FoundingSchoolTiersSection`, `FoundingSchoolFaqSection`.

Final file SHA-256 prefix: `9801bb9b403b`.

### `components/organisms/FoundingTeacherSections.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `roleChipClassName`, `FoundingTeacherTrustStrip`, `FoundingTeacherRolesSection`, `FoundingTeacherRegionsSection`, `FoundingTeacherFaqSection`.

Final file SHA-256 prefix: `40c290ff2680`.

### `components/organisms/InstitutionDashboard.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `InstitutionDashboard`, `closeJob`, `removeJob`, `HiringMetric`, `HiringAction`.

Final file SHA-256 prefix: `022b23eb21d8`.

### `components/organisms/InstitutionProfilePage.tsx` [C1, W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `InstitutionProfilePage`, `ProfileSection`, `SectionHeading`, `ProfileMetric`, `ProfileFact`, `ProfileState`, `formatMonth`, `formatCoverType`.

Final file SHA-256 prefix: `fff4c73b73c5`.

### `components/organisms/InvitationErrorNotice.tsx` [N]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `useInvitationError`, `InvitationErrorNotice`.

Final file SHA-256 prefix: `7e3fe0a119a0`.

### `components/organisms/InvitationModal.tsx` [N]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `HireTeacher`, `InvitationModal`, `update`, `reviewDetails`, `confirmHire`, `displayDate`, `displayPay`, `Detail`.

Final file SHA-256 prefix: `e6e03eea8251`.

### `components/organisms/JobDetailPage.tsx` [C1, W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `JobDetailPage`, `submitApplication`, `closeModal`.

Final file SHA-256 prefix: `52a834c2ef7f`.

### `components/organisms/JobInvitationsPage.tsx` [N]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `JobInvitationsPage`, `InvitationList`, `InvitationRow`, `InvitationDetail`, `InvitationReview`, `decide`, `copy`, `StatusTag`, `StateMessage`, `Fact`, `DateText`, `pay`.

Final file SHA-256 prefix: `ea5754e7eef7`.

### `components/organisms/JobManagementList.tsx` [C1, W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `JobStatusFilter`, `JobManagementList`, `pageItems`, `JobManagementRow`, `dismissOutside`, `dismissOnEscape`, `formatPay`, `formatJobStatus`, `visibilityTone`.

Final file SHA-256 prefix: `c1b099cba2bf`.

### `components/organisms/LoginPage.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `LoginPage`, `validateCredentials`, `handleCredentialSubmit`.

Final file SHA-256 prefix: `517a5013f713`.

### `components/organisms/LoginRouteClient.tsx` [W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `isRecord`, `readString`, `readCooldownUntil`, `isVerificationChallenge`, `isTwoFactorChallenge`, `socialUnavailableMessage`, `isSocialProviderAvailable`, `LoginRouteClientInner`, `formData`, `startEmailVerification`, `startTwoFactorChallenge`, `goLanding`, `goSignup`, `goForgotPassword`, `finishLogin`, `backToLogin`, `finishVerification`, `finishTwoFactor`, `resendVerification`, `startSocialAuth`, `LoginRouteClient`.

Final file SHA-256 prefix: `b00c27e9e95d`.

### `components/organisms/MessageAttachmentPreview.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `MessageAttachmentPreview`, `load`, `download`.

Final file SHA-256 prefix: `1880fffa19bd`.

### `components/organisms/MessagingPage.tsx` [C1, W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `MessagingPage`, `returnToInbox`, `ConversationList`, `InboxOverview`, `Thread`, `ConversationContextPanel`, `ContextRow`, `ContextStat`, `applicationStatusTone`, `formatStatus`, `formatJobLocation`, `formatJobDates`, `formatJobPay`, `formatDisplayDate`, `Bubble`, `Composer`, `noteTyping`, `addFiles`, `submit`, `formatTime`, `formatWhen`, `conversationPerson`.

Final file SHA-256 prefix: `3da28b6226c5`.

### `components/organisms/MyProfilePage.tsx` [N]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `MyProfilePage`, `openActivity`, `ProfileDetails`, `DetailSection`, `Fact`, `DetailTags`, `ProfileStat`, `ActivityHeading`, `StatusBadge`, `QueryContent`, `ProfilePaginationControl`, `statusLabel`, `dateLabel`, `dateRange`, `money`.

Final file SHA-256 prefix: `fa3d2a385f69`.

### `components/organisms/NotificationBell.tsx` [C1, W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `NotificationBell`, `toggle`, `select`, `enableDesktopAlerts`, `timeAgo`.

Final file SHA-256 prefix: `61060308d857`.

### `components/organisms/NotificationSettings.tsx` [C1, W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `NotificationSettings`.

Final file SHA-256 prefix: `c80558720447`.

### `components/organisms/OnboardingPage.tsx` [C1, W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `OnboardingPage`, `closeConfirmCreate`, `handlePrimaryAction`, `confirmCreateProfile`, `PhoneVerificationCard`, `MatApplicationWaitingPage`, `SignatoryApprovalCard`, `OnboardingStepContent`.

Final file SHA-256 prefix: `9a18a44b63b9`.

### `components/organisms/OnboardingRouteClient.tsx` [W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `withClientTimeout`, `normalizeSignupRole`, `initialStep`, `keyStagesFromFoundingPhase`, `prefillFromFoundingIntent`, `hasFoundingAccountBasics`, `hasFoundingTeacherBasics`, `hasFoundingTeacherProfile`, `initialStepWithFoundingIntent`, `readMatchingFoundingIntent`, `refreshSessionFromTicket`, `uploadDocument`, `OnboardingRouteClientInner`, `setRole`, `goLanding`, `logout`, `saveStep`, `finishOnboarding`, `OnboardingRouteClient`.

Final file SHA-256 prefix: `7897688c72cb`.

### `components/organisms/PayInvoiceModal.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `PayInvoiceModal`, `PaymentSession`, `PaymentForm`, `submit`, `usePaymentReturn`, `paymentReturnUrl`, `settleInvoice`, `refreshPayments`, `announce`.

Final file SHA-256 prefix: `67c78a32ef43`.

### `components/organisms/PostAuthRedirectClient.tsx` [W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `PostAuthRedirectClient`.

Final file SHA-256 prefix: `0900bfcf9b92`.

### `components/organisms/PostJobPage.tsx` [C1, W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `PostJobPage`, `PostJobEditor`, `updateForm`, `nextStep`, `saveDraft`, `publish`, `saveJob`, `formatDescription`, `renderPostingTypeSection`, `renderDetailsFields`, `renderRequirementsFields`, `renderReviewSummary`, `validateStep`, `validateAll`, `validateDraft`, `validateOptionalJobFields`, `validateJobDates`, `pickErrors`, `firstInvalidStep`, `expiryClearError`, `toJobCreateInput`, `toChangedJobUpdateInput`, `buildDescription`, `buildFormattedDescription`, `toWorkIso`, `getTodayDateInput`, `toFormState`, `readEditableDescription`, `isGeneratedDescriptionLine`, `isPayType`, `formatPayTypeLabel`, `readPayTypeLabel`, `formatPay`, `formatDateRange`, `formatFormLocation`.

Final file SHA-256 prefix: `77e19189d561`.

### `components/organisms/PublicFooter.tsx` [C1, C2]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `PublicFooter`.

Final file SHA-256 prefix: `45169144be1a`.

### `components/organisms/PublicHeader.tsx` [C1, C2]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `PublicHeader`, `scrollToWaitlist`.

Final file SHA-256 prefix: `7c1b2d350ce6`.

### `components/organisms/PublicTeacherProfilePage.tsx` [C1, W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `PublicTeacherProfilePage`, `ProfileSection`, `SectionHeading`, `ExpertiseGroup`, `ProfileMetric`, `ProfileFact`, `ProfileState`, `formatMonth`, `formatMoney`.

Final file SHA-256 prefix: `e19fa95d768e`.

### `components/organisms/RecentNotifications.tsx` [W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `RecentNotifications`, `select`, `formatActivityTime`.

Final file SHA-256 prefix: `d2ab9de84b98`.

### `components/organisms/RouteShell.tsx` [W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `readContext`, `createInitialRouteState`, `RouteShell`, `goHome`, `logout`, `AppRouteShellClient`.

Final file SHA-256 prefix: `573bc125aad1`.

### `components/organisms/SecurityPage.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `formData`, `statusLabel`, `SecurityPage`, `syncSettingsStatus`, `loadStatus`, `startSetup`, `enableTwoFactor`, `disableTwoFactor`, `regenerateRecoveryCodes`, `copyRecoveryCodes`, `downloadRecoveryCodes`.

Final file SHA-256 prefix: `17f4146c436c`.

### `components/organisms/SettingsPage.tsx` [C1, W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `profileImageContentType`, `profileImageValidationError`, `profileImageUrlForRole`, `arrayToText`, `textToArray`, `roleLabel`, `statusLabel`, `statusTone`, `displayName`, `createForm`, `profileExists`, `ArrayField`, `ProfileImageField`, `CountryCityFields`, `SettingsPage`, `updateActiveSection`, `setForm`, `updateUser`, `updateInstructor`, `updateInstructorCountry`, `updateInstitution`, `updateInstitutionCountry`, `setProfileImageUrl`, `uploadProfileImageFile`, `saveSettings`.

Final file SHA-256 prefix: `08e4d4246d03`.

### `components/organisms/SignatoryApprovalPage.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `decidedRequestCopy`, `readResponse`, `SignatoryApprovalPage`, `load`, `decide`, `Detail`.

Final file SHA-256 prefix: `6215f56bd2be`.

### `components/organisms/SignupAccessPage.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `fieldClass`, `SignupAccessPage`, `validate`, `handleSubmit`, `startSocialSignup`.

Final file SHA-256 prefix: `f7ee20cc7c43`.

### `components/organisms/SignupRouteClient.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `socialUnavailableMessage`, `isSocialProviderAvailable`, `SignupRouteClientInner`, `formData`, `startVerification`, `backToAccount`, `finishVerification`, `resendVerification`, `goLanding`, `goLogin`, `startSocialAuth`, `SignupRouteClient`.

Final file SHA-256 prefix: `66b70ce36df3`.

### `components/organisms/SignupVerifyPage.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `SignupVerifyPage`, `syncResendTimer`, `validate`, `handleCodeChange`, `handleCodeKeyDown`, `handleCodePaste`, `handleSubmit`, `resendCode`.

Final file SHA-256 prefix: `827a0f726fc7`.

### `components/organisms/StripePayoutComponents.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `fetchPayoutSession`, `useConnectInstance`, `StripePayoutComponents`.

Final file SHA-256 prefix: `3cf88b79167f`.

### `components/organisms/TeacherApplicationsPage.tsx` [W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `TeacherApplicationsPage`, `TeacherApplicationCard`, `TeacherInvitationCard`, `InvitationStatusTag`, `ApplicationStatusTag`, `formatStatus`, `formatSubmittedAt`, `formatDateRange`, `payUnit`.

Final file SHA-256 prefix: `b384a860869d`.

### `components/organisms/TeacherDashboard.tsx` [W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `TeacherDashboard`, `refresh`, `metricValue`, `Metric`, `Panel`, `QueryContent`, `Empty`, `DateTile`, `dateRange`, `formatRate`, `location`.

Final file SHA-256 prefix: `cb3ef6d0a66d`.

### `components/organisms/TeacherHireActions.tsx` [N]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `TeacherHireActions`.

Final file SHA-256 prefix: `e06109926ab3`.

### `components/organisms/TwoFactorChallengePage.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `readExpiryText`, `TwoFactorChallengePage`, `validate`, `handleSubmit`.

Final file SHA-256 prefix: `0070e2da862d`.

### `components/organisms/WaitlistConfirmation.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `WaitlistConfirmation`, `copyLink`, `TeacherDetails`.

Final file SHA-256 prefix: `27c4475e289a`.

### `components/organisms/dashboards/SchoolDashboard.tsx` [C1, W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `SchoolDashboard`, `refresh`, `metric`, `formatDate`, `dateRange`, `DashboardError`.

Final file SHA-256 prefix: `c56d10911350`.

### `components/organisms/dashboards/TeacherDashboard.tsx` [W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Final file SHA-256 prefix: `d84550b28806`.

### `components/organisms/onboarding/CountryCityFields.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `CountryCityFields`.

Final file SHA-256 prefix: `bca17e637d1e`.

### `components/organisms/onboarding/DocumentPreviewModal.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `DocumentPreviewModal`.

Final file SHA-256 prefix: `895629bea555`.

### `components/organisms/onboarding/ReviewCard.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `ReviewBadgeList`, `FileSummary`, `ReviewCard`.

Final file SHA-256 prefix: `13b214195f92`.

### `components/organisms/onboarding/UploadCard.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `UploadCard`.

Final file SHA-256 prefix: `3476294423a2`.

### `components/organisms/onboarding/constants.ts` [W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `initialForm`, `coverTypes`, `currencies`, `countryCodes`, `unselectedSteps`, `stepContent`.

Final file SHA-256 prefix: `8529abee7a4b`.

### `components/organisms/onboarding/steps/AccountBasicsStep.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `AccountBasicsStep`.

Final file SHA-256 prefix: `1d19534aa002`.

### `components/organisms/onboarding/steps/DocumentUploadStep.tsx` [C1, W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `DocumentUploadStep`.

Final file SHA-256 prefix: `b16418488608`.

### `components/organisms/onboarding/steps/InstitutionComplianceStep.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `InstitutionComplianceStep`.

Final file SHA-256 prefix: `3bade911ce43`.

### `components/organisms/onboarding/steps/InstitutionDetailsStep.tsx` [C1, W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `InstitutionDetailsStep`.

Final file SHA-256 prefix: `c53867607d6a`.

### `components/organisms/onboarding/steps/InstitutionProfileStep.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `InstitutionProfileStep`.

Final file SHA-256 prefix: `3ff3d5eadfd6`.

### `components/organisms/onboarding/steps/InstitutionStaffingStep.tsx` [C1, W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `InstitutionStaffingStep`.

Final file SHA-256 prefix: `57b442aad5e5`.

### `components/organisms/onboarding/steps/ReviewStep.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `ReviewStep`.

Final file SHA-256 prefix: `d1a77d19b62e`.

### `components/organisms/onboarding/steps/TeacherDocumentsStep.tsx` [C1]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `toDocumentRequirement`, `TeacherDocumentsStep`.

Final file SHA-256 prefix: `d1f6549cad71`.

### `components/organisms/onboarding/steps/TeacherProfileStep.tsx` [C1, W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `TeacherProfileStep`.

Final file SHA-256 prefix: `233893a40108`.

### `components/organisms/onboarding/types.ts` [C1, W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `SignupRole`, `SignupStep`, `OnboardingPending`, `DocumentErrors`, `DocumentPreview`, `OnboardingFinishResult`, `OnboardingDocumentUploadActionResult`, `OnboardingDocumentDownloadActionResult`, `SignupField`, `SignupErrors`, `UploadedFile`, `SignupForm`, `OnboardingPrefill`, `ReviewLine`, `ReviewGroup`.

Final file SHA-256 prefix: `8a6b31516338`.

### `components/organisms/onboarding/useOnboardingForm.tsx` [C1, W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `snapshotFingerprint`, `countryLabel`, `snapshotString`, `snapshotStringArray`, `hasCreatedProfile`, `missingSnapshotDocumentRequirements`, `requirementErrorEntries`, `mergeSnapshotForm`, `fillEmpty`, `fillEmptyArray`, `mergePrefillForm`, `useOnboardingForm`, `buildPayload`, `updateField`, `setDocumentError`, `clearDocumentError`, `retryDocumentRequirements`, `uploadDocument`, `viewDocument`, `uploadRequirementDocument`, `viewRequirementDocument`, `closeDocumentPreview`, `clearFieldError`, `applySnapshot`, `validateStep`, `validateThrough`, `navigateStep`, `applyServerFieldErrors`, `continueStep`, `submitSignup`, `submitDocumentsForReview`, `refreshSignatoryApproval`, `requestSignatoryApproval`, `OnboardingFormController`.

Final file SHA-256 prefix: `950782c29364`.

### `components/organisms/onboarding/utils.ts` [C1, W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `roleLabel`, `signupHeroTitle`, `signupHeroCopy`, `signupStepTitle`, `signupSubmitLabel`, `fieldClass`, `areaClass`, `formatFileSize`, `DocumentStatusTone`, `documentStatusTag`, `requirementAccept`, `requirementIcon`, `requirementDescription`, `requirementLimits`, `documentFileError`, `toUploadedFile`, `toUploadedFileFromDocument`, `uploadedFilesFromSnapshot`, `createInitialForm`, `buildOnboardingPayload`.

Final file SHA-256 prefix: `6b96b38cb642`.

### `components/organisms/onboarding/validation.ts` [C1, W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `validateOnboardingStep`.

Final file SHA-256 prefix: `25d7c2a25b47`.

### `components/route-shell.tsx` [W]

Screen/control behavior, accessibility, validation, real-data presentation or interaction; see component symbols below.

Current symbols: `AppRouteShell`.

Final file SHA-256 prefix: `e4802f54b61a`.

### `components/styles/account.css` [C1]

Visual layout, responsive spacing, readable states and shared theme styling; native UI adapts the behavior.

Final file SHA-256 prefix: `091ac072d4ad`.

### `components/styles/foundation.css` [C1]

Visual layout, responsive spacing, readable states and shared theme styling; native UI adapts the behavior.

Final file SHA-256 prefix: `8ef866d38410`.

### `components/styles/my-profile.css` [N]

Visual layout, responsive spacing, readable states and shared theme styling; native UI adapts the behavior.

Final file SHA-256 prefix: `00cd8e650391`.

### `components/styles/proposal-preview.css` [C1]

Visual layout, responsive spacing, readable states and shared theme styling; native UI adapts the behavior.

Final file SHA-256 prefix: `34a9f42ed84d`.

### `components/styles/proposal.css` [C1]

Visual layout, responsive spacing, readable states and shared theme styling; native UI adapts the behavior.

Final file SHA-256 prefix: `96db901d41db`.

### `components/styles/public.css` [C1]

Visual layout, responsive spacing, readable states and shared theme styling; native UI adapts the behavior.

Final file SHA-256 prefix: `944f2a4b6a7d`.

### `components/styles/selectors.css` [C1]

Visual layout, responsive spacing, readable states and shared theme styling; native UI adapts the behavior.

Final file SHA-256 prefix: `48ce104a0dbe`.

### `components/styles/teacher-dashboard.css` [N]

Visual layout, responsive spacing, readable states and shared theme styling; native UI adapts the behavior.

Final file SHA-256 prefix: `f3cbe367592f`.

### `components/styles/waitlist.css` [C1, C2]

Visual layout, responsive spacing, readable states and shared theme styling; native UI adapts the behavior.

Final file SHA-256 prefix: `08d2a195640e`.

### `components/styles/workspace.css` [C1, W]

Visual layout, responsive spacing, readable states and shared theme styling; native UI adapts the behavior.

Final file SHA-256 prefix: `ca3b3ec662cc`.

### `data/supplyed.ts` [W]

Shared data model or supporting application configuration.

Current symbols: `seedTeachers`, `seedApplications`, `seedMessages`, `defaultState`, `defaultTweaks`.

Final file SHA-256 prefix: `d83794f24bc6`.

### `deploy/README.md` [C1]

Documentation/audit evidence; see final feature behavior above for current contracts.

Final file SHA-256 prefix: `30ccc01b5d4a`.

### `deploy/docker-compose.dev.yml` [C1]

Build, deployment, tooling, generated types, dependencies or verification infrastructure.

Final file SHA-256 prefix: `125c4c5bab9a`.

### `deploy/docker-compose.main.yml` [C1]

Build, deployment, tooling, generated types, dependencies or verification infrastructure.

Final file SHA-256 prefix: `1208e092fe76`.

### `docs/form-theme-rescan-evidence.json` [C1]

Documentation/audit evidence; see final feature behavior above for current contracts.

Final file SHA-256 prefix: `773b54b1b707`.

### `docs/form-theme-rescan.csv` [C1]

Documentation/audit evidence; see final feature behavior above for current contracts.

Final file SHA-256 prefix: `7b190b92b90a`.

### `docs/form-theme-rescan.md` [C1]

Documentation/audit evidence; see final feature behavior above for current contracts.

Final file SHA-256 prefix: `456a796990ed`.

### `docs/form-validation-audit.md` [C1]

Documentation/audit evidence; see final feature behavior above for current contracts.

Final file SHA-256 prefix: `20ff19e60fb9`.

### `docs/form-validation-evidence.json` [C1]

Documentation/audit evidence; see final feature behavior above for current contracts.

Final file SHA-256 prefix: `d4effd3c869d`.

### `docs/form-validation-matrix.csv` [C1]

Documentation/audit evidence; see final feature behavior above for current contracts.

Final file SHA-256 prefix: `3ebcf66ff7a2`.

### `docs/production-readiness-audit.md` [C1]

Documentation/audit evidence; see final feature behavior above for current contracts.

Final file SHA-256 prefix: `002aa732038b`.

### `docs/production-safety-fixes.md` [C1]

Documentation/audit evidence; see final feature behavior above for current contracts.

Final file SHA-256 prefix: `bf3ac09f2717`.

### `docs/theme-colors.md` [C1]

Documentation/audit evidence; see final feature behavior above for current contracts.

Final file SHA-256 prefix: `fafe3a6862b1`.

### `docs/ui-consistency-audit.md` [C1]

Documentation/audit evidence; see final feature behavior above for current contracts.

Final file SHA-256 prefix: `0ff1daf2bad3`.

### `docs/ui-consistency-components.csv` [C1]

Documentation/audit evidence; see final feature behavior above for current contracts.

Final file SHA-256 prefix: `8381faf18c0b`.

### `docs/ui-consistency-evidence.json` [C1]

Documentation/audit evidence; see final feature behavior above for current contracts.

Final file SHA-256 prefix: `e784cdcdb9be`.

### `docs/ui-consistency-routes.csv` [C1]

Documentation/audit evidence; see final feature behavior above for current contracts.

Final file SHA-256 prefix: `728bf52e7b95`.

### `eslint.config.mjs` [W]

Build, deployment, tooling, generated types, dependencies or verification infrastructure.

Final file SHA-256 prefix: `6f1d2dbf090c`.

### `features/applications/actions.ts` [C1, W]

applications: Backend mutations and error handling.

Current symbols: `createApplicationAction`, `updateApplicationStatusAction`, `readApplicationError`.

Final file SHA-256 prefix: `8729cacbd280`.

### `features/applications/queries.ts` [C1, W]

applications: Backend reads and aggregation.

Current symbols: `getApplicationById`, `listApplicationHistory`, `listApplicationsByJob`, `listMyApplications`, `countApplicationsForActiveJobs`, `toJobApplication`, `paginateApplications`.

Final file SHA-256 prefix: `9d0ef0787e79`.

### `features/applications/rich-text.ts` [C1]

applications: Normalization, validation or domain logic.

Current symbols: `MAX_PROPOSAL_LENGTH`, `decodeHtmlEntities`, `hasRichTextMarkup`, `richTextToPlainText`, `isEmptyRichText`.

Final file SHA-256 prefix: `63bb558597d0`.

### `features/applications/schemas.ts` [W]

applications: Normalization, validation or domain logic.

Current symbols: `normalizeApplicationsQuery`, `normalizePaginatedApplications`, `normalizeApplicationHistory`, `normalizeHistoryEntry`, `normalizeApplicationCreateInput`, `normalizeApplication`, `normalizeApplicationStatus`, `normalizePage`, `normalizePageSize`, `normalizeStringList`, `readDateIso`.

Final file SHA-256 prefix: `9284ecc560aa`.

### `features/applications/types.ts` [W]

applications: Request/response contract.

Current symbols: `JobApplicationStatus`, `ApplicantSummary`, `JobApplication`, `ApplicationCreateInput`, `ApplicationStatusUpdateInput`, `ApplicationsPagination`, `PaginatedApplications`, `ApplicationHistoryEntry`, `PaginatedApplicationHistory`, `JobApplicationsQuery`.

Final file SHA-256 prefix: `2a57142b2d3c`.

### `features/applications/use-applications.ts` [W]

applications: Client cache, invalidation and loading states.

Current symbols: `useJobApplications`, `useApplication`, `useApplicationHistory`, `useMyApplications`, `useActiveJobApplicantCount`, `useUpdateApplicationStatus`, `useCreateApplication`.

Final file SHA-256 prefix: `7cbd1e0b8535`.

### `features/applications/workflow.ts` [W]

applications: Normalization, validation or domain logic.

Current symbols: `applicationPipeline`, `canTransitionApplication`.

Final file SHA-256 prefix: `fca13571fa12`.

### `features/auth/actions.ts` [C1]

auth: Backend mutations and error handling.

Current symbols: `createVerifiedSessionPayload`, `isRecord`, `readString`, `readApiErrorText`, `readApiErrorCode`, `buildBearerHeaders`, `readProfileApplicationStatus`, `isRegisteredEmailError`, `isEmailNotVerifiedError`, `emailVerificationChallengeFromResponse`, `isTwoFactorChallenge`, `issueLoginVerificationChallenge`, `toAuthActionError`, `loginWithEmailAction`, `verifyTwoFactorLoginAction`, `signupWithEmailAction`, `forgotPasswordAction`, `resetPasswordAction`, `verifyEmailAction`, `verifyEmailSessionAction`, `resendEmailVerificationAction`, `refreshApplicationStatusAction`, `signInWithGoogleAction`, `signInWithMicrosoftAction`.

Final file SHA-256 prefix: `e9213cb49bf7`.

### `features/auth/backend.ts` [C1]

auth: Normalization, validation or domain logic.

Current symbols: `backendOAuthExchangeEnabled`, `isRecord`, `readString`, `readBoolean`, `readNumber`, `normalizeExpiryTimestamp`, `redacted`, `safeConsolePayload`, `logBackendPayload`, `logLoginUserData`, `mockUser`, `readTokenPair`, `readAccessTokenExpiresAt`, `readUserPayload`, `readOptionalUserPayload`, `toBackendRole`, `normalizeRole`, `normalizeStatus`, `normalizeAuthUser`, `normalizeAuthResponse`, `normalizeTwoFactorChallenge`, `normalizeLoginResponse`, `normalizeEmailVerificationChallenge`, `normalizeEmailVerificationResendResponse`, `normalizePasswordResetChallenge`, `createEmailAccount`, `loginWithEmail`, `verifyEmail`, `verifyTwoFactorLogin`, `resendEmailVerification`, `requestPasswordReset`, `resetPassword`, `exchangeOAuthAccount`, `refreshBackendAuth`.

Final file SHA-256 prefix: `0c20a5e46711`.

### `features/auth/phone-actions.ts` [C1]

auth: Backend mutations and error handling.

Current symbols: `phoneActionError`, `hasPhoneSession`, `sendPhoneOtpAction`, `verifyPhoneOtpAction`.

Final file SHA-256 prefix: `e9c29fc05738`.

### `features/auth/queries.ts` [C1]

auth: Backend reads and aggregation.

Current symbols: `getCurrentUser`.

Final file SHA-256 prefix: `a15e68c82e71`.

### `features/auth/schemas.ts` [C1]

auth: Normalization, validation or domain logic.

Current symbols: `passwordRequirementsMessage`, `normalizeEmail`, `parseLoginForm`, `parseSignupForm`, `parseForgotPasswordForm`, `parsePasswordResetForm`, `parseEmailVerificationForm`, `parseTwoFactorForm`, `parseResendEmailVerificationForm`, `validateEmail`, `validatePassword`.

Final file SHA-256 prefix: `ab2ed4d9b53a`.

### `features/auth/use-phone-verification.ts` [C1]

auth: Client cache, invalidation and loading states.

Current symbols: `handleExpiredSession`, `useSendPhoneOtp`, `useVerifyPhoneOtp`, `usePhoneVerificationPending`.

Final file SHA-256 prefix: `cd0f42903bd1`.

### `features/auth/workspace-account.tsx` [N]

auth: Normalization, validation or domain logic.

Current symbols: `WorkspaceAccountProvider`, `useWorkspaceAccount`.

Final file SHA-256 prefix: `27cc33b54c65`.

### `features/bookings/actions.ts` [C1]

bookings: Backend mutations and error handling.

Current symbols: `updateBookingStatusAction`, `createBookingReviewAction`, `readBookingError`.

Final file SHA-256 prefix: `19787ab12e36`.

### `features/bookings/queries.ts` [C1]

bookings: Backend reads and aggregation.

Current symbols: `emptyBookings`, `listMyBookings`.

Final file SHA-256 prefix: `084a9c503591`.

### `features/bookings/schemas.ts` [C1, W]

bookings: Normalization, validation or domain logic.

Current symbols: `readDateIso`, `readNumber`, `readStringArray`, `normalizeReview`, `normalizeInvoiceStatus`, `normalizeInvoiceSummary`, `normalizeBooking`, `normalizePaginatedBookings`, `normalizeBookingsQuery`, `normalizeQueryText`, `normalizeReviewInput`, `bookingDays`, `invoiceUnitsLimit`.

Final file SHA-256 prefix: `578b7c43cdef`.

### `features/bookings/types.ts` [W]

bookings: Request/response contract.

Current symbols: `BookingStatus`, `BookingInvoiceFilter`, `ReviewerType`, `BookingReview`, `BookingJobSummary`, `BookingPartySummary`, `BookingInvoiceSummary`, `Booking`, `BookingsPagination`, `PaginatedBookings`, `BookingListQuery`, `BookingStatusAction`, `BookingStatusUpdateInput`, `BookingReviewInput`.

Final file SHA-256 prefix: `1cc96fb79153`.

### `features/bookings/use-bookings.ts` [W]

bookings: Client cache, invalidation and loading states.

Current symbols: `useBooking`, `useBookings`, `useUpdateBookingStatus`, `useCreateBookingReview`.

Final file SHA-256 prefix: `7a52ee9ac2c3`.

### `features/contact/actions.ts` [C1]

contact: Backend mutations and error handling.

Current symbols: `RegisterInterestActionState`, `WaitlistField`, `FoundingInterestSubmitResult`, `FoundingInterestActionState`, `WaitlistDetailsState`, `read`, `validEmail`, `includes`, `apiMessage`, `registerInterestAction`, `foundingInterestAction`, `saveWaitlistDetailsAction`.

Final file SHA-256 prefix: `a25f73a45419`.

### `features/contact/validation.ts` [C1]

contact: Normalization, validation or domain logic.

Current symbols: `read`, `validateWaitlist`, `validateWaitlistDetails`.

Final file SHA-256 prefix: `c3669b05f39c`.

### `features/contact/waitlist-client.ts` [C1]

contact: Normalization, validation or domain logic.

Current symbols: `submitWaitlistAction`, `submitWaitlistDetailsAction`.

Final file SHA-256 prefix: `421ad8ce16a1`.

### `features/contact/waitlist-options.ts` [C1]

contact: Normalization, validation or domain logic.

Current symbols: `waitlistSchoolRoles`, `waitlistTeacherRoles`, `waitlistSchoolAreas`, `waitlistTeacherAreas`, `waitlistSchoolTypes`, `supplyDaysOptions`, `coverBookingOptions`, `currentSupplyOptions`, `daysPerWeekOptions`, `waitlistPhases`.

Final file SHA-256 prefix: `6e050169f321`.

### `features/conversations/actions.ts` [C1, W]

conversations: Backend mutations and error handling.

Current symbols: `startConversationAction`, `openConversationForApplicationAction`, `sendMessageAction`, `markConversationReadAction`, `attachmentDownloadUrlAction`, `errorCode`, `readError`.

Final file SHA-256 prefix: `1a62e22ee0fc`.

### `features/conversations/queries.ts` [C1]

conversations: Backend reads and aggregation.

Current symbols: `listMyConversations`, `getUnreadMessageCount`, `getConversation`, `listMessages`.

Final file SHA-256 prefix: `73faca0ec26e`.

### `features/conversations/schemas.ts` [W]

conversations: Normalization, validation or domain logic.

Current symbols: `MAX_MESSAGE_LENGTH`, `MAX_ATTACHMENTS`, `MAX_ATTACHMENT_BYTES`, `ALLOWED_ATTACHMENT_TYPES`, `readDateIso`, `normalizeAttachment`, `normalizeMessage`, `normalizeConversation`, `normalizeParticipant`, `normalizeMessagesPage`, `formatFileSize`.

Final file SHA-256 prefix: `830703a0d655`.

### `features/conversations/socket.ts` [C1]

conversations: Normalization, validation or domain logic.

Current symbols: `setReady`, `subscribeConnection`, `useConversationConnected`, `backendOrigin`, `liveMessagingAvailable`, `fetchTicket`, `scheduleRetry`, `acquireConversationSocket`, `releaseConversationSocket`, `emitTyping`.

Final file SHA-256 prefix: `fb26c9974646`.

### `features/conversations/types.ts` [W]

conversations: Request/response contract.

Current symbols: `ConversationSide`, `MessageAttachment`, `ChatMessage`, `ConversationParticipant`, `StartConversationInput`, `Conversation`, `ConversationsPagination`, `ConversationsPage`, `MessagesPage`, `AttachmentUpload`, `SendMessageInput`, `MessageEventPayload`, `ReadEventPayload`, `TypingEventPayload`, `TypingState`.

Final file SHA-256 prefix: `e0217c9b6310`.

### `features/conversations/use-conversations.ts` [C1, W]

conversations: Client cache, invalidation and loading states.

Current symbols: `useConversations`, `flattenConversations`, `useUnreadMessages`, `useConversationForApplication`, `useConversation`, `useStartConversation`, `useMessages`, `flattenMessages`, `appendMessage`, `patchConversation`, `useSendMessage`, `useMarkConversationRead`, `uploadAttachment`, `useConversationStream`, `useTypingIndicator`.

Final file SHA-256 prefix: `83486eb674a9`.

### `features/dashboard/teacher-dashboard-data.ts` [N]

dashboard: Normalization, validation or domain logic.

Current symbols: `DASHBOARD_TIME_ZONE`, `DashboardBookingPeriod`, `DASHBOARD_APPLICATION_STATUSES`, `calendarParts`, `calendarDay`, `dashboardDayStart`, `formatDashboardDate`, `getUpcomingBookings`, `isDashboardBookingOngoing`, `filterDashboardBookings`, `DashboardApplicationSummary`, `summarizeDashboardApplications`, `getPendingDashboardInvitations`, `DashboardProfileTask`, `getDashboardProfileTasks`, `DashboardPage`, `loadDashboardPages`.

Final file SHA-256 prefix: `cb4ae1a5e523`.

### `features/dashboard/use-teacher-dashboard.ts` [N]

dashboard: Client cache, invalidation and loading states.

Current symbols: `useTeacherDashboard`.

Final file SHA-256 prefix: `8a64b1a55e35`.

### `features/invitations/actions.ts` [N]

invitations: Backend mutations and error handling.

Current symbols: `InvitationResult`, `CreateInvitationResult`, `createInvitationAction`, `invitationConversationMessage`, `decideInvitationAction`, `failure`.

Final file SHA-256 prefix: `0b59336096df`.

### `features/invitations/queries.ts` [N]

invitations: Backend reads and aggregation.

Current symbols: `requireParticipantRole`, `listInvitations`, `getInvitation`.

Final file SHA-256 prefix: `4e99daf43c98`.

### `features/invitations/schemas.ts` [N]

invitations: Normalization, validation or domain logic.

Current symbols: `normalizeInvitation`, `normalizeInvitationsPage`, `effectiveInvitationStatus`, `invitationCanAccept`.

Final file SHA-256 prefix: `79d445230a43`.

### `features/invitations/types.ts` [N]

invitations: Request/response contract.

Current symbols: `invitationStatuses`, `InvitationStatus`, `InvitationInput`, `Invitation`, `InvitationListQuery`, `InvitationsPage`, `InvitationDecision`.

Final file SHA-256 prefix: `a85a7e73737e`.

### `features/invitations/use-invitations.ts` [N]

invitations: Client cache, invalidation and loading states.

Current symbols: `useInvitations`, `useAllInvitations`, `useInvitation`, `useInvitationClock`.

Final file SHA-256 prefix: `3f4cd5aed01d`.

### `features/invitations/validation.ts` [N]

invitations: Normalization, validation or domain logic.

Current symbols: `jobInvitationProblem`, `validateInvitation`.

Final file SHA-256 prefix: `7fc2511160d1`.

### `features/jobs/actions.ts` [C1, W]

jobs: Backend mutations and error handling.

Current symbols: `createJobAction`, `updateJobAction`, `deleteJobAction`, `readJobActionError`, `readJobActionCode`, `readJobFieldErrors`.

Final file SHA-256 prefix: `b09400e05423`.

### `features/jobs/listing-window.ts` [N]

jobs: Normalization, validation or domain logic.

Current symbols: `LISTING_TIME_ZONE`, `JobVisibilityLabel`, `getJobVisibilityLabel`, `formatJobVisibilityLabel`, `ukCalendarDate`, `ukDateTimeInput`, `formatUkListingInstant`, `listingCalendarInstant`.

Final file SHA-256 prefix: `56ffd797212d`.

### `features/jobs/schemas.ts` [C1, W]

jobs: Normalization, validation or domain logic.

Current symbols: `normalizeJobFilters`, `readJobFilters`, `normalizePaginatedJobs`, `normalizeMyJobs`, `wholeNumberBetween`, `normalizeJobCreateInput`, `normalizeJobUpdateInput`, `normalizeBackendJob`, `toCreateJobPayload`, `toUpdateJobPayload`, `normalizeStringList`, `normalizePositiveNumber`, `normalizeNonNegativeInteger`, `readNumber`, `readDateIso`, `formatDateRange`, `formatDisplayDate`, `formatRelativeTime`, `derivePostingMode`, `readPostingMode`, `readPostingModeFromDescription`, `isUrgent`, `withoutEmptyJobFields`.

Final file SHA-256 prefix: `d4162dbef91e`.

### `features/jobs/types.ts` [W]

jobs: Request/response contract.

Current symbols: `JobListFilters`, `JobsPagination`, `PaginatedJobs`, `JobStatusCounts`, `MyJobs`, `BackendJobResponse`, `JobCreateInput`, `JobUpdateInput`.

Final file SHA-256 prefix: `ad4874711614`.

### `features/jobs/use-jobs.ts` [C1, W]

jobs: Client cache, invalidation and loading states.

Current symbols: `signOutExpiredSession`, `handleSessionExpiredResult`, `useJobs`, `useMyJobs`, `useJob`, `useCreateJob`, `useUpdateJob`, `useDeleteJob`.

Final file SHA-256 prefix: `7d61abef9144`.

### `features/jobs/validation.ts` [C1, W]

jobs: Normalization, validation or domain logic.

Current symbols: `validateJobInput`, `listingBoundary`, `validDate`.

Final file SHA-256 prefix: `c5897c26a870`.

### `features/my-profile/queries.ts` [N]

my-profile: Backend reads and aggregation.

Current symbols: `requireProfileRole`, `requestBudget`, `collectPages`, `paginate`, `newestFirst`, `listMyProfileApplications`, `listMyProfileReviews`.

Final file SHA-256 prefix: `03e9441edecd`.

### `features/my-profile/types.ts` [N]

my-profile: Request/response contract.

Current symbols: `ProfilePagination`, `ProfilePageQuery`, `ProfileApplication`, `ProfileApplications`, `ReviewDirection`, `MyProfileReview`, `MyProfileReviews`.

Final file SHA-256 prefix: `04bca932a7b1`.

### `features/my-profile/use-my-profile.ts` [N]

my-profile: Client cache, invalidation and loading states.

Current symbols: `useProfileJobs`, `useProfileApplications`, `useProfileReviews`.

Final file SHA-256 prefix: `814e30ecb905`.

### `features/notifications/actions.ts` [C1]

notifications: Backend mutations and error handling.

Current symbols: `markNotificationReadAction`, `markAllNotificationsReadAction`, `updateNotificationPreferencesAction`, `readError`.

Final file SHA-256 prefix: `5148273818e7`.

### `features/notifications/queries.ts` [C1]

notifications: Backend reads and aggregation.

Current symbols: `listNotifications`, `getUnreadNotificationCount`, `getNotificationPreferences`.

Final file SHA-256 prefix: `d60baa26c691`.

### `features/notifications/schemas.ts` [W]

notifications: Normalization, validation or domain logic.

Current symbols: `isRecord`, `safeNotificationLink`, `normalizeNotification`, `normalizeNotificationsPage`, `normalizePreferences`.

Final file SHA-256 prefix: `047daf964c26`.

### `features/notifications/types.ts` [W]

notifications: Request/response contract.

Current symbols: `NotificationType`, `AppNotification`, `NotificationsPagination`, `NotificationsPage`, `NotificationPreferences`, `NotificationEventPayload`, `NotificationCountPayload`.

Final file SHA-256 prefix: `7c44be834c41`.

### `features/notifications/use-notifications.ts` [W]

notifications: Client cache, invalidation and loading states.

Current symbols: `useNotifications`, `useRecentNotifications`, `flattenNotifications`, `useUnreadNotifications`, `setUnread`, `patchList`, `patchRecent`, `useMarkNotificationRead`, `useMarkAllNotificationsRead`, `useNotificationPreferences`, `useUpdateNotificationPreferences`, `desktopAlertPermission`, `useNotificationStream`, `showDesktopAlert`.

Final file SHA-256 prefix: `fbd3261118ab`.

### `features/onboarding/actions.ts` [C1, W]

onboarding: Backend mutations and error handling.

Current symbols: `readString`, `readNumber`, `readStringArray`, `numberString`, `normalizeUserSnapshot`, `normalizeInstructorSnapshot`, `normalizeInstitutionSnapshot`, `documentKind`, `backendDocumentType`, `emptyDocumentSnapshotData`, `missingRequiredDocumentNames`, `emptySnapshot`, `readFormString`, `readFormStringArray`, `readFormNumber`, `readFormBoolean`, `readFormFile`, `buildInstructorProfilePayload`, `normalizeDomain`, `buildInstitutionProfilePayload`, `buildBearerHeaders`, `notFoundOrForbidden`, `isStatusTransitionRace`, `getCurrentUserSnapshot`, `getCurrentInstructorSnapshot`, `getInstitutionSnapshot`, `getSignatoryApproval`, `ensureSignatoryApproval`, `getDocumentSnapshotData`, `getProfileDocumentRequirements`, `getDocumentState`, `getOnboardingProfileSnapshot`, `createSessionResponse`, `getOnboardingAuth`, `saveUserBasics`, `onboardingError`, `saveInstructorProfile`, `saveInstitutionProfile`, `submitInstructorProfileForReview`, `submitInstitutionProfileForReview`, `uploadOnboardingDocumentAction`, `downloadOnboardingDocumentAction`, `saveOnboardingStepAction`, `submitInstructorOnboarding`, `submitInstitutionOnboarding`, `submitOnboardingAction`, `assertStoredProfileLocation`.

Final file SHA-256 prefix: `6cf22815b5e4`.

### `features/onboarding/documents.ts` [C1]

onboarding: Normalization, validation or domain logic.

Current symbols: `DocumentRequestAuth`, `isRecord`, `readString`, `readNumber`, `readIsoDate`, `readStringArray`, `requestOptions`, `normalizeRequirement`, `normalizeDocument`, `getProfileDocumentRequirements`, `listProfileDocuments`, `getDocumentSnapshots`, `getDocumentState`, `emptyDocumentState`, `validateDocumentFile`, `assertRequiredDocumentsUploaded`, `safeOriginalName`, `findExistingDocument`, `createDocument`, `uploadProfileDocument`.

Final file SHA-256 prefix: `50f8d8e2e949`.

### `features/onboarding/types.ts` [W]

onboarding: Request/response contract.

Current symbols: `OnboardingSnapshot`, `OnboardingSubmitInput`, `OnboardingSubmitResult`, `OnboardingDocumentKind`, `OnboardingDocumentContext`, `InstitutionType`, `SignatoryApprovalStatus`, `InstitutionTrustSnapshot`, `SignatoryApprovalSnapshot`, `OnboardingDocumentSnapshot`, `OnboardingDocumentRequirementSnapshot`, `OnboardingDocumentRequirement`, `OnboardingDocumentMap`, `OnboardingDocumentState`, `OnboardingUserSnapshot`, `OnboardingInstructorSnapshot`, `OnboardingInstitutionSnapshot`, `OnboardingProfileSnapshot`, `OnboardingProgressResult`, `OnboardingDocumentUploadResult`, `OnboardingDocumentDownloadResult`.

Final file SHA-256 prefix: `ebc4891b7ffc`.

### `features/onboarding/validation.ts` [C1, W]

onboarding: Normalization, validation or domain logic.

Current symbols: `validateOnboardingForm`, `normalizeOnboardingForm`.

Final file SHA-256 prefix: `39dd5f5dc366`.

### `features/payments/actions.ts` [C1]

payments: Backend mutations and error handling.

Current symbols: `createPayoutSessionAction`, `createInvoicePaymentSessionAction`, `syncInvoiceAction`, `instantPayoutAction`, `createInvoiceAction`, `resendInvoiceAction`, `voidInvoiceAction`, `refundInvoiceAction`, `invoiceCommand`, `errorCode`, `isUuid`, `readPaymentError`.

Final file SHA-256 prefix: `aae0909c2431`.

### `features/payments/queries.ts` [C1]

payments: Backend reads and aggregation.

Current symbols: `emptyInvoices`, `getMyPayoutAccount`, `getMyPayoutBalance`, `listMyInvoices`, `listAllInvoices`, `getInvoice`.

Final file SHA-256 prefix: `79f9e5ca9671`.

### `features/payments/route-query.ts` [C1]

payments: Backend reads and aggregation.

Current symbols: `readInvoiceListQuery`.

Final file SHA-256 prefix: `ba60fb5a19c4`.

### `features/payments/stripe-client.ts` [C1]

payments: Normalization, validation or domain logic.

Current symbols: `stripeFonts`, `currentTheme`, `observeStripeTheme`, `getPaymentAppearance`, `getConnectAppearance`, `getStripe`.

Final file SHA-256 prefix: `19829c822a7b`.

### `features/public-profiles/schemas.ts` [W]

public-profiles: Normalization, validation or domain logic.

Current symbols: `strings`, `numberOrNull`, `dateOrNull`, `normalizeInstructorPublicProfile`, `normalizeInstitutionPublicProfile`.

Final file SHA-256 prefix: `5499f7499c09`.

### `features/public-profiles/types.ts` [W]

public-profiles: Request/response contract.

Current symbols: `InstructorPublicProfile`, `InstitutionPublicProfile`.

Final file SHA-256 prefix: `4878c12fda86`.

### `features/reviews/queries.ts` [C1]

reviews: Backend reads and aggregation.

Current symbols: `emptyReviews`, `listInstructorReviews`, `listInstitutionReviews`.

Final file SHA-256 prefix: `e17655007133`.

### `features/settings/actions.ts` [C1, W]

settings: Backend mutations and error handling.

Current symbols: `text`, `optionalText`, `normalizeStringArray`, `optionalNumber`, `hasInvalidNumber`, `withoutUndefined`, `actionFailure`, `userPayload`, `instructorPayload`, `institutionPayload`, `mergeLocalSnapshot`, `assertRoleAllowed`, `SettingsProfileImageUploadResult`, `readFormFile`, `profileImageContentType`, `validateProfileImage`, `responseDate`, `uploadSettingsProfileImageAction`, `updateSettingsAction`.

Final file SHA-256 prefix: `a9c3ff54ea13`.

### `features/settings/queries.ts` [C1, W]

settings: Backend reads and aggregation.

Current symbols: `isRecord`, `nestedRecord`, `readString`, `readNullableString`, `readBoolean`, `readNumber`, `numberString`, `readStringArray`, `readDate`, `emptyUserSnapshot`, `normalizeUser`, `normalizeInstructor`, `normalizeInstitution`, `getSignedProfileImageUrl`, `applySignedProfileImageUrl`, `optionalApiGet`, `applicationStatusForRole`, `getSettingsProfileSnapshot`.

Final file SHA-256 prefix: `aa8bb3a5b203`.

### `features/settings/types.ts` [W]

settings: Request/response contract.

Current symbols: `SettingsUserSnapshot`, `SettingsInstructorProfile`, `SettingsInstitutionProfile`, `SettingsProfileSnapshot`, `SettingsUserUpdateInput`, `SettingsInstructorUpdateInput`, `SettingsInstitutionUpdateInput`, `SettingsUpdateInput`.

Final file SHA-256 prefix: `947d1f2ce059`.

### `features/settings/use-settings.ts` [W]

settings: Client cache, invalidation and loading states.

Current symbols: `snapshotWithProfileImage`, `signOutExpiredSession`, `useSettingsProfile`, `useUpdateSettings`, `useUploadSettingsProfileImage`.

Final file SHA-256 prefix: `0524c16e5f70`.

### `features/settings/validation.ts` [C1, W]

settings: Normalization, validation or domain logic.

Current symbols: `validateSettingsInput`.

Final file SHA-256 prefix: `d9c52f2403e6`.

### `features/teachers/actions.ts` [C1]

teachers: Backend mutations and error handling.

Current symbols: `updateTeacherProfileAction`.

Final file SHA-256 prefix: `5f2cac68b9e3`.

### `features/teachers/queries.ts` [C1]

teachers: Backend reads and aggregation.

Current symbols: `listTeachers`, `listTeacherDirectory`, `getTeacher`, `toDirectoryItem`, `matchesDirectoryFilters`.

Final file SHA-256 prefix: `bb74d33bae30`.

### `features/teaching-catalogue/patch.ts` [N]

teaching-catalogue: Normalization, validation or domain logic.

Current symbols: `omitUnchangedTeachingFields`.

Final file SHA-256 prefix: `35819a3dde54`.

### `features/teaching-catalogue/selection.ts` [N]

teaching-catalogue: Normalization, validation or domain logic.

Current symbols: `selectionValues`, `jobSubjects`, `canonicalSubjects`, `allowedSkills`, `reconcileSkills`, `catalogueError`.

Final file SHA-256 prefix: `a59bd75e4ab2`.

### `features/teaching-catalogue/types.ts` [N]

teaching-catalogue: Request/response contract.

Current symbols: `TeachingCatalogue`.

Final file SHA-256 prefix: `af82c71a9050`.

### `features/teaching-catalogue/use-teaching-catalogue.ts` [N]

teaching-catalogue: Client cache, invalidation and loading states.

Current symbols: `teachingCatalogueKey`, `useTeachingCatalogue`.

Final file SHA-256 prefix: `24253dd5fe9a`.

### `lib/auth-code-validation.ts` [C1]

Shared routing, query, time, phone, validation, session, upload or API infrastructure; see symbols below.

Current symbols: `validateOtpCode`, `validateTwoFactorCode`.

Final file SHA-256 prefix: `217033fb1076`.

### `lib/founding-signup-intent.ts` [C1]

Shared routing, query, time, phone, validation, session, upload or API infrastructure; see symbols below.

Current symbols: `FoundingSignupType`, `FoundingSignupRole`, `FoundingSignupIntent`, `isRecord`, `readString`, `readFoundingSignupEmail`, `readStringArray`, `readFormString`, `readFormStringArray`, `readDigits`, `readDecimal`, `normalizeDomain`, `readFoundingSignupType`, `foundingSignupRole`, `foundingSignupHref`, `saveFoundingSignupIntent`, `saveFoundingSignupIntentFromForm`, `readFoundingSignupIntent`, `clearFoundingSignupIntent`.

Final file SHA-256 prefix: `e65f929fc083`.

### `lib/invitation-links.ts` [N]

Shared routing, query, time, phone, validation, session, upload or API infrastructure; see symbols below.

Current symbols: `invitationReturnPath`, `invitationLoginHref`.

Final file SHA-256 prefix: `bbe19371622e`.

### `lib/query/fetch-json.ts` [C1, W]

Shared routing, query, time, phone, validation, session, upload or API infrastructure; see symbols below.

Current symbols: `withQuery`, `fetchJson`, `readErrorPayload`, `isRecord`, `readErrorCode`, `readErrorMessage`.

Final file SHA-256 prefix: `657cbf96bd1d`.

### `lib/query/keys.ts` [W]

Shared routing, query, time, phone, validation, session, upload or API infrastructure; see symbols below.

Current symbols: `queryKeys`.

Final file SHA-256 prefix: `b2d93d8afc2f`.

### `lib/routes.ts` [W]

Shared routing, query, time, phone, validation, session, upload or API infrastructure; see symbols below.

Current symbols: `appPathByPage`, `buildAppHref`, `hasSubmittedApplicationStatus`, `isApprovedApplicationStatus`, `shouldShowApplicationStatusPage`, `getAuthenticatedEntryHref`.

Final file SHA-256 prefix: `a395cc1c8291`.

### `lib/server/action-response.ts` [W]

Shared routing, query, time, phone, validation, session, upload or API infrastructure; see symbols below.

Current symbols: `ActionFieldErrors`, `ActionResult`, `actionOk`, `actionError`, `unwrapActionResult`.

Final file SHA-256 prefix: `1eda542b4f77`.

### `lib/server/api-client.ts` [C1]

Shared routing, query, time, phone, validation, session, upload or API infrastructure; see symbols below.

Current symbols: `isRecord`, `isApiEnvelope`, `readErrorMessage`, `readErrorCode`, `isBackendAuthError`, `unwrapApiPayload`, `getApiBaseUrl`, `appendQuery`, `buildApiPath`, `buildUrl`, `isAuthFailureStatus`, `parseResponse`, `request`, `requestInit`, `bodyInit`, `api`.

Final file SHA-256 prefix: `90dca16d0906`.

### `lib/server/api-error.ts` [C1]

Shared routing, query, time, phone, validation, session, upload or API infrastructure; see symbols below.

Current symbols: `ApiError`.

Final file SHA-256 prefix: `25443ae1eaa9`.

### `lib/server/backend-config.ts` [C1]

Shared routing, query, time, phone, validation, session, upload or API infrastructure; see symbols below.

Current symbols: `backendEnabled`.

Final file SHA-256 prefix: `4dd508d53a0d`.

### `lib/server/query-validation.ts` [C1, W]

Shared routing, query, time, phone, validation, session, upload or API infrastructure; see symbols below.

Current symbols: `assertValidQuery`.

Final file SHA-256 prefix: `7c429f23bee9`.

### `lib/server/route-error.ts` [C1]

Shared routing, query, time, phone, validation, session, upload or API infrastructure; see symbols below.

Current symbols: `routeError`.

Final file SHA-256 prefix: `caf15a7cc8d5`.

### `lib/server/token-refresh.ts` [C1, W]

Shared routing, query, time, phone, validation, session, upload or API infrastructure; see symbols below.

Current symbols: `isRecord`, `readString`, `readNumber`, `readTokenUserId`, `normalizeExpiryTimestamp`, `updateBackendAuthSession`, `persistBackendTokenRefresh`, `markBackendSessionExpired`, `getApiBaseUrl`, `buildApiPath`, `buildApiUrl`, `unwrapApiPayload`, `readAccessTokenExpiresAt`, `requestTokenRefresh`, `refreshBackendAccessToken`, `getValidAccessToken`.

Final file SHA-256 prefix: `cc5909720db4`.

### `lib/server/upload-request.ts` [C1, W]

Shared routing, query, time, phone, validation, session, upload or API infrastructure; see symbols below.

Current symbols: `MULTIPART_OVERHEAD_BYTES`, `requireSameOrigin`, `readLimitedFormData`.

Final file SHA-256 prefix: `f7b3d06f5c00`.

### `lib/theme.ts` [C1]

Shared routing, query, time, phone, validation, session, upload or API infrastructure; see symbols below.

Current symbols: `brandPalettes`, `clamp`, `normalizeHex`, `hexToRgb`, `rgbToHex`, `mix`, `luminance`, `readableDark`, `deriveBrandTheme`, `applyBrandTheme`.

Final file SHA-256 prefix: `67f7e76504aa`.

### `lib/uk-phone-input.ts` [N]

Shared routing, query, time, phone, validation, session, upload or API infrastructure; see symbols below.

Current symbols: `ukPhoneEdit`, `ukPhonePaste`.

Final file SHA-256 prefix: `aa8be1eef883`.

### `lib/uk-validation.ts` [C1, W]

Shared routing, query, time, phone, validation, session, upload or API infrastructure; see symbols below.

Current symbols: `UK_COUNTRY_CODE`, `UK_COUNTRY_NAME`, `ValidationOptions`, `UkValidationResult`, `inputText`, `result`, `optionalEmpty`, `validateUkPhone`, `validateUkPostcode`, `validateUkCountry`, `locationKey`, `getUkCities`, `getUkRegions`, `validateUkCity`, `validateUkRegion`.

Final file SHA-256 prefix: `f7870525a27c`.

### `lib/zoned-date-time.ts` [N]

Shared routing, query, time, phone, validation, session, upload or API infrastructure; see symbols below.

Current symbols: `zonedDateTimeToIso`.

Final file SHA-256 prefix: `74c37035450e`.

### `next-env.d.ts` [C1, C2, W]

Build, deployment, tooling, generated types, dependencies or verification infrastructure.

Final file SHA-256 prefix: `4e4da12aa061`.

### `next.config.mjs` [C1]

Build, deployment, tooling, generated types, dependencies or verification infrastructure.

Final file SHA-256 prefix: `ce2449db6a5a`.

### `package-lock.json` [C1, W]

Build, deployment, tooling, generated types, dependencies or verification infrastructure.

Final file SHA-256 prefix: `bfaebba32ccf`.

### `package.json` [C1, W]

Build, deployment, tooling, generated types, dependencies or verification infrastructure.

Final file SHA-256 prefix: `3e71636155e3`.

### `proxy.ts` [C1, C2, W]

Route entry, authentication/onboarding navigation, public metadata or shared stylesheet delivery.

Current symbols: `getAuthCookieSecret`, `shouldUseSecureAuthCookies`, `redirectTo`, `readAppRole`, `readApplicationStatus`, `proxy`, `config`.

Final file SHA-256 prefix: `e69ac0376509`.

### `public/founding-schools (1) (1).html` [W]

Public founding-page assets, phone-validation support, or vendored static resources; not an authenticated product API.

Current symbols: `showError`.

Final file SHA-256 prefix: `5ee94d09df8b`.

### `public/founding-teachers (1).html` [W]

Public founding-page assets, phone-validation support, or vendored static resources; not an authenticated product API.

Current symbols: `showError`.

Final file SHA-256 prefix: `bd7fb2061122`.

### `public/uk-phone-validation.js` [N]

Public founding-page assets, phone-validation support, or vendored static resources; not an authenticated product API.

Final file SHA-256 prefix: `6322391a84d1`.

### `public/vendor/README.txt` [N]

Public founding-page assets, phone-validation support, or vendored static resources; not an authenticated product API.

Final file SHA-256 prefix: `8fd3860f7d9e`.

### `public/vendor/libphonenumber-LICENSE.txt` [N]

Public founding-page assets, phone-validation support, or vendored static resources; not an authenticated product API.

Final file SHA-256 prefix: `ea6fc5fe0f90`.

### `public/vendor/libphonenumber-max.js` [N]

Public founding-page assets, phone-validation support, or vendored static resources; not an authenticated product API.

Final file SHA-256 prefix: `49963114d3f9`.

### `tests/api-integrations.test.cjs` [C1]

Regression coverage: attachment previews authorize with the backend and serve private inline bytes; attachment previews do not read storage when backend access is denied; attachment previews reject active content and unsupported file types; attachment previews report storage failures and oversized files; backend envelope is unwrapped and OTP is sent with bearer auth under /api; backend validation messages and support reference survive API errors; request ID header is retained when provider errors have no metadata; phone send normalizes UK input before the backend and preserves returned cooldown; phone verification sends only the six-digit OTP and refreshes user snapshots; phone verification rejects invalid codes and unauthenticated sends before the API; verification success requires the server to confirm a verified number; fixed invoices omit units and never send client-supplied rates or totals; hourly/daily invoice units accept fractional work and reject out-of-range precision; invalid booking IDs and PO numbers cannot trigger Stripe invoices; refund amounts remain integer pence and optional full refunds are supported; invoice totals use pence while rates stay pounds and private statuses stay admin-only; paid invoice evidence wins over stale or lower-case payment statuses; booking filters are normalized for the paginated API; public marketplace profiles expose normalized safe fields; profile reviews use the API pagination total; job responses retain the safe institution profile identity; worked time stays within inclusive booking dates even across a UK clock change; hosted Stripe invoice and PDF links reject executable or lookalike URLs; administrator payout support is visible on Payments while confirmation dialogs are closed

Current symbols: `attachmentPreviewFixture`, `loadModule`, `invoice`, `actionsFixture`, `apiFixture`.

Final file SHA-256 prefix: `61ec0b1c70ec`.

### `tests/application-job-title.test.cjs` [N]

Regression coverage: application responses retain the stored title, including paginated history; a proposal is optional and empty proposal markup is omitted from the API payload; applying sends the supported fields and keeps the canonical title returned by the API; profile history uses the original title after a job is renamed and supports older application records; application cards and proposal context retain the title while the listing loads or becomes unavailable; teacher application cards identify jobs that originated from direct invitations; teacher invited filter renders private invitation details and response actions; application cards show the submitted title after a rename and fall back for older records

Current symbols: `loadModule`, `profileFixture`, `renderHistory`.

Final file SHA-256 prefix: `60c0987bdeb4`.

### `tests/application-workflow.test.cjs` [W]

Regression coverage: the public pipeline contains no interview stage

Final file SHA-256 prefix: `d010347fe44d`.

### `tests/applications-navigation.test.cjs` [W]

Regression coverage: Applications requests active jobs only and opens the chosen job; Invited filters jobs from all invitation records and shows counts on each job; a closed job direct link still opens its applications and can return to active jobs; an application deep link opens the detail and its back button keeps the selected job; an unknown application deep link retains its unavailable message and selected job; active jobs are reachable through paginated results with correct ranges and boundaries; refreshing jobs keeps the rows visible and disables pagination until the response arrives; empty and failed job requests show guidance without opening an application automatically

Current symbols: `loadModule`, `fixture`, `button`.

Final file SHA-256 prefix: `5d422793e15d`.

### `tests/founding-interest.test.cjs` [C1]

Regression coverage: school waitlist saves cover preferences and explicit founding interest, with attribution; teachers join with split names and supply preferences without phone, postcode or phases; invalid role, area, consent and supply preferences are rejected before any network call; duplicate submission stays a confirmation and does not invent an optional-details token; optional teacher details use the submission capability, normalize postcode and preserve multiple phases; optional details reject missing capabilities and invalid fields without a request; backend failures and missing configuration never claim a successful submission

Current symbols: `loadModule`, `submissionFixture`, `interestForm`, `assertPublicRequest`.

Final file SHA-256 prefix: `869c65e52b01`.

### `tests/job-invitations.test.cjs` [N]

Regression coverage: invitation notifications open the offer review using their invitation ID; inviting requires one job source, profile UUID, retry UUID, zoned dates and positive pay; existing job eligibility covers drafts, expiry, missing dates, reversed dates and invalid pay; invitations start their job conversation, post one retry-safe school message, and create no booking; teacher/admin invitations and malformed input cannot reach the backend; conflicts allow correction while timeouts and server errors retain the retry identity; recovery forwards old dates while fresh submissions reject past or excessive deadlines; only teacher accept creates a booking and all decision requests have no body; accept retries recover the existing booking in its current completed or cancelled state; immutable terms, live job status and deadline independently control invitation display; invitation reads are uncached and never trigger acceptance; roles and UUIDs are guarded; explicit timezones handle UK summer/winter, overseas schools and daylight-saving gaps; invitation URLs survive authentication without allowing external return destinations; school chats support teacher-only, job and application contexts without sending a message; teachers cannot initialise chats and legacy application links explain school initiation; normalisation keeps absent conversation context null and preserves participant identities for admins; new invitation jobs accept explicit Other subjects and reject empty or implicit custom selections

Current symbols: `loader`, `load`, `fixture`.

Final file SHA-256 prefix: `d8fd2903efb9`.

### `tests/job-listing-window.test.cjs` [N]

Regression coverage: listing calendar dates use Europe/London midnight across daylight-saving changes; derived job visibility respects state, expiry, and scheduled opening priority

Final file SHA-256 prefix: `cb592b2b9f1a`.

### `tests/job-pagination.test.cjs` [W]

Regression coverage: a single page retains its result summary and disables both boundary controls; an empty result has no invalid numeric range and no next or previous page; long result sets show current neighbours and both endpoints with accessible ellipses; pagination is omitted when its data or navigation callback is unavailable; previous, next and numbered controls send the requested page to the existing callback

Current symbols: `loadModule`, `fixture`, `control`, `visit`.

Final file SHA-256 prefix: `8bb47b41daac`.

### `tests/my-profile-history.test.cjs` [N]

Regression coverage: school history includes all job statuses and every application page, sorted before pagination; teacher history reads only their applications and preserves unavailable job records; repeated or incomplete upstream pages produce an error instead of a false complete history; an upstream application failure does not silently hide part of a school history

Current symbols: `page`, `fixture`.

Final file SHA-256 prefix: `32253616e3c3`.

### `tests/onboarding-validation.test.cjs` [C1, W]

Regression coverage: teacher, school and MAT valid paths accept UK data across every data step; teacher cannot advance with foreign or malformed phone/postcode/country/city; school location is validated in its own step, including optional region and count; zero is valid, malformed numerical strings and missing selections are blocked; MAT compliance and self-signatory validation remains enforced; payloads normalize accepted UK fields but preserve rejected data for server validation; existing foreign profile data remains visible for explicit correction; teacher and school onboarding send Other requests and explicit clears

Current symbols: `load`, `validForm`.

Final file SHA-256 prefix: `b15117db206e`.

### `tests/phone-profile-state.test.cjs` [C1]

Regression coverage: saving settings cannot overwrite a phone verified in another tab; onboarding keeps server phone verification across steps and protects it at profile creation

Current symbols: `loadModule`, `fixture`.

Final file SHA-256 prefix: `6e879cbebe2b`.

### `tests/production-http.smoke.cjs` [C1, W]

Regression coverage: production health, login and protected pages render with the existing routing; production invitation routes preserve guest links and authenticated reads never accept; production invitation Server Actions send exact payloads and only teacher acceptance returns a booking; actual onboarding upload and preview preserve a PDF and replace it without creating another document; actual conversation uploads preserve bytes, previews work, and anonymous uploads are rejected; actual Server Action accepts a 5 MiB profile photo and finalizes storage; production rejects oversized or cross-origin uploads and serves unsafe previews as downloads; actual job actions create drafts, publish and retry failed activation without another creation; real session-cookie refresh persists rotated tokens and a transient outage never signs the user out; built phone Server Action rejects foreign and malformed numbers before sending; built job Server Action rejects foreign country, town and postal code without a write; actual website filter endpoints reject invalid direct query requests; built teacher creation replaces an old Pakistani phone with normalized UK input, but rejects Pakistani input; public teaching catalogue proxy unwraps the backend envelope without authentication; built job actions preserve Other names, explicit clears and partial-update omission; built invitation action forwards Other fields inside newJob

Current symbols: `jwt`, `userFor`, `body`, `jsonBody`, `json`, `handleBackend`, `request`, `action`, `expiredCookie`.

Final file SHA-256 prefix: `0731ca5a03aa`.

### `tests/production-safety.test.cjs` [C1, W]

Regression coverage: malformed Unicode entities cannot crash proposal validation or rendering; production refuses missing backend configuration; development fixtures remain available; parallel refreshes share one request but each caller persists the rotated credentials; a render-only cookie context does not lose the rotated pair for the next writable request; transient and malformed refresh responses preserve the session and can be retried; definitive authentication rejection still expires a session; bounded multipart parsing preserves full-size valid bytes and document fields; multipart limits reject lying content lengths, extra files, and malformed origins; anonymous conversation uploads are rejected before multipart parsing; multipart field limits are enforced separately from the single-file requirement; every supported conversation attachment uploads unchanged with a deadline; onboarding upload route honors live backend limits even when the session role is stale; onboarding form uploads each supported file type through the bounded route for teachers and schools; document review is available without phone verification while missing or rejected documents still block it; document boxes upload concurrently, isolate retries, and block review until every upload settles; phone code errors show accessible retry guidance without technical references; onboarding previews preserve PDF/images and force unsafe content to a sandboxed download; document upload creates, transfers, completes and replaces existing documents without changing bytes; profile photo uploads accept the advertised 5 MiB and complete only after storage succeeds; settings validate before any write and report partial backend failures without claiming success; draft creation and publication retain their backend sequence and return the created job; interrupted publication retains the job ID for a safe update retry; the four-step job form blocks double submission and retries the saved job without changing navigation; socket polling health follows ready, disconnect, and final rejection; application counts stop on repeated pagination rather than looping or returning a partial total

Current symbols: `loader`, `load`, `uploadRequest`, `refreshFixture`, `token`, `Harness`, `findButton`.

Final file SHA-256 prefix: `03f3b3a4ef95`.

### `tests/public-form-validation.test.cjs` [C1, W]

Regression coverage: waitlist required fields and enum tampering are rejected before invoking the server action; optional waitlist phone accepts UK mobiles and landlines and rejects foreign and invalid prefilled data; optional teacher details require a full UK postcode when supplied and preserve all four nations; single-input authenticator and OTP validators reject malformed and truncated input; settings resubmission rejects foreign saved values without altering personal information; phone mutation hooks validate before SMS requests and normalize accepted UK numbers; saved founding signup details preserve invalid personal values for correction instead of stripping them into valid numbers

Current symbols: `load`.

Final file SHA-256 prefix: `61d8df8987dc`.

### `tests/stripe-theme.test.cjs` [C1]

Regression coverage: Stripe server appearance uses the site; active theme changes update appearance once without loading a new Stripe session

Current symbols: `load`.

Final file SHA-256 prefix: `d1e14108c635`.

### `tests/teacher-dashboard-data.test.cjs` [N]

Regression coverage: dashboard date boundaries use the UK school timezone throughout both DST changes; upcoming work includes ongoing final days and sorts nearest first without cancelled or undated records; calendar filters include multi-day overlap and stop at the London week and month boundary; application totals count every status but only outstanding applications are active; pending invitations disappear at their deadline and most urgent invitations appear first; optional profile suggestions are based on actual fields and do not require a verified phone; dashboard summaries follow every page, including an empty dataset; partial, repeated and changing pages fail instead of presenting misleading counts; upstream failures stay errors rather than empty successful summaries

Current symbols: `booking`, `page`.

Final file SHA-256 prefix: `41810123b38a`.

### `tests/teacher-dashboard-notifications.test.cjs` [N]

Regression coverage: school application decisions refresh teacher pipeline, confirmed work and recommendations immediately; booking confirmations and outcomes refresh schedule data and the teacher’s eligible matches; invoice payments refresh actual balances and invoices without inventing a new monetary value; received reviews refresh the profile rating aggregate and review history; profile decisions refresh the same status queries that control workspace access; invitation changes retain existing refresh behavior and refresh new dashboard summaries; a reconnection refreshes missed teacher updates, with no duplicate initial fetch and clean subscription teardown

Current symbols: `load`, `fixture`.

Final file SHA-256 prefix: `f64db822fe42`.

### `tests/teacher-dashboard-ui.test.cjs` [N]

Regression coverage: populated teacher dashboard renders real bookings, application totals, invitations and aggregate school rating; empty, unrated and unconnected accounts show honest empty states without sample money or ratings; loading data is labelled as loading rather than rendered as zero activity; section failures remain unknown, hide technical details and preserve successful sections; booking, invitation, recommendation and account controls open the exact destination; schedule period buttons filter current school work and preserve ongoing placements; application stage buttons reveal useful guidance without changing application records; booking, invitation and recommended role pay use their actual rate units and unknown rates stay unknown; payout cards render real available and pending balances in pounds only for a ready account; a missing or failed payout balance stays unknown while a real zero balance can display zero; refresh reloads account data and recommended jobs while loading prevents duplicate refresh clicks

Current symbols: `loadModule`, `booking`, `invitation`, `recommendedJob`, `textContent`, `fixture`, `metric`, `populated`.

Final file SHA-256 prefix: `d0cf1606deae`.

### `tests/teacher-hire-actions.test.cjs` [N]

Regression coverage: approved schools receive enabled Message and Invite controls without another account request; teacher and admin profiles never receive school hiring controls; the workspace approval status controls both buttons and chat can hide its redundant Message button

Current symbols: `load`, `render`.

Final file SHA-256 prefix: `67f3f1816781`.

### `tests/teaching-catalogue.test.cjs` [N]

Regression coverage: subject aliases resolve to canonical names, deduplicate and retain unknown legacy context; removing a subject retains shared and overlapping skills, removes only unsupported skills; explicit empty subjects override stale legacy scalar while old responses retain a fallback; job payloads retain explicit clears, omit unchanged arrays and never write the legacy scalar; unchanged legacy selections are omitted from profile patches but explicit clears are sent; catalogue errors map to editable fields without expecting nonexistent backend properties; public catalogue proxy is unauthenticated and does not reuse a stale deployment response; saved custom names reconstruct the Other editor and preserve legacy prose intact; custom subject validation permits Unicode, deduplicates equivalents and rejects invalid or catalogue names; custom profile fields are omitted only when equivalent to saved actual names; explicit removal survives; job create and patch serialize request-only custom fields without polluting response subjects; INVALID_OTHER_SUBJECTS refreshes catalogue and targets the custom input

Current symbols: `load`.

Final file SHA-256 prefix: `2c615961de3e`.

### `tests/ui-controls.test.cjs` [C1]

Regression coverage: Field links a nested control to its visible label and error without altering native validation; Field preserves explicit target IDs, associates custom controls and leaves unrelated inputs alone; Field IDs stay unique for repeated controls and helper text is suppressed by an error; Loading buttons expose busy/disabled state and retain both labels for stable layout; Checkbox and toggle expose native disabled and selected states; Checkbox preserves native named, required and uncontrolled form semantics; Every preset and pale custom accent keeps readable text on its tint without changing the accent; Early theme bootstrap and interactive theme changes derive identical tokens

Current symbols: `component`, `luminance`.

Final file SHA-256 prefix: `63c96bdaf9bd`.

### `tests/uk-phone-input.test.cjs` [N]

Regression coverage: UK entry permits partial typing under a fixed +44 and valid mobiles or landlines; UK entry refuses foreign prefixes, letters, impossible prefixes, excess digits and non-UK +44 regions; pastes must be complete valid UK numbers and are never truncated or converted from foreign numbers

Current symbols: `load`.

Final file SHA-256 prefix: `3a70184407d0`.

### `tests/uk-server-validation.test.cjs` [C1, W]

Regression coverage: standalone registration pages use the same phone rules and metadata as account forms; UK phone validation accepts mobile, landline, national and international formats and normalizes E.164; creating teacher and institution profiles saves the submitted UK phone even when signup already assigned a role; UK phones reject foreign codes, crown dependencies, malformed, reserved and invalid prefilled values; UK postcode validation covers every format and all four nations without claiming existence; country and maintained location selections include UK nations and reject foreign values; onboarding direct step and final submissions reject invalid fields before auth or backend access; onboarding school location waits for its own step and final validation cannot be bypassed with step=1; both account types reject invalid phones at every onboarding save and final submission; settings resubmission rejects malformed saved geo and optional numeric fields before any write; phone server action rejects direct bypasses, normalizes accepted input and distrusts foreign challenge responses; job direct writes reject invalid UK data and malformed rates, dates, arrays and enum values; status-only publish cannot resubmit an invalid saved foreign job; review, cancellation, message and preference tampering is rejected before mutation; settings cannot disguise a foreign saved phone with a valid submitted replacement; profile images reject empty files and explicitly unsupported MIME before storage requests; job display normalization does not convert an optional county or postcode into a structured city; direct search filters reject impossible dates, reversed ranges, enum and pagination tampering; credential authorization never strips or truncates OTP and signup requires accepted terms; direct payout JSON, signatory decisions and directory filters reject bypasses with HTTP 400; auth parsers preserve malformed OTPs for rejection and direct auth gateway validates credentials; teacher and school settings preserve untouched legacy selections and explicitly send changed Other names or clears; backend-disabled settings return actual custom names without request-only fields

Current symbols: `loader`, `load`, `fixture`.

Final file SHA-256 prefix: `1e8780992bfa`.

### `tests/waitlist-access.test.cjs` [C1, C2]

Test fixtures, isolated integration checks, or assertions.

Final file SHA-256 prefix: `deleted`.

### `tests/waitlist-client.test.cjs` [C1]

Regression coverage: an outdated action or network rejection returns an inline failure instead of crashing the page; successful and invalid submissions preserve the original action result; failed optional detail requests keep the saved waitlist confirmation

Current symbols: `load`.

Final file SHA-256 prefix: `c31cb8029176`.

### `tests/workspace-form-validation.test.cjs` [C1, W]

Regression coverage: job wizard, draft and publication all reject foreign or invalid saved location fields; job payload normalizes UK values while optional empty location fields remain valid; listing dates remain UK calendar values while work dates become precise UK instants; editing omits untouched listing dates, permits clearing live-from, and preserves an existing expiry; job transitions reject required omissions, invalid dates and invalid numeric inputs; directory filters accept all four UK nations and reject structured foreign towns and invalid numbers; booking cancellation and review validators enforce the rules independently of button state; proposal link dialog rejects invalid schemes and malformed email links

Current symbols: `load`.

Final file SHA-256 prefix: `e8e6f8550094`.

### `types/supplyed.ts` [W]

Shared data model or supporting application configuration.

Current symbols: `Tone`, `ApplicationStage`, `MessageAuthor`, `AppRole`, `AuthState`, `ApplicationStatus`, `JobStatus`, `JobPayType`, `AppPage`, `Teacher`, `Job`, `Application`, `Message`, `RouteContext`, `ToastInput`, `Toast`, `SocialAuthAvailability`, `AppState`, `Tweaks`, `GoFn`, `ToastFn`, `SetAppState`, `SetTweaks`, `RouteProps`.

Final file SHA-256 prefix: `25c76db7da30`.

### `DYNAMIC_DROPDOWNS_INTEGRATION.md` [N]

Database dropdown or teaching-selection implementation; see section 3 and the source snapshots.

Final file SHA-256 prefix: `9e3b7af65694`.

### `app/(auth)/layout.tsx` [W]

Shared provider/theme infrastructure; see section 3A for lifecycle, persistence and native equivalents.

Final file SHA-256 prefix: `3c3df58d5a65`.

### `app/api/dropdowns/[name]/route.ts` [N]

Database dropdown or teaching-selection implementation; see section 3 and the source snapshots.

Final file SHA-256 prefix: `138608295411`.

### `app/api/dropdowns/route.ts` [N]

Database dropdown or teaching-selection implementation; see section 3 and the source snapshots.

Final file SHA-256 prefix: `8e1b222016eb`.

### `app/theme-bootstrap.js/route.ts` [N]

Shared provider/theme infrastructure; see section 3A for lifecycle, persistence and native equivalents.

Final file SHA-256 prefix: `465e104223a5`.

### `components/molecules/DynamicDropdown.tsx` [N]

Database dropdown or teaching-selection implementation; see section 3 and the source snapshots.

Final file SHA-256 prefix: `2be205929208`.

### `components/molecules/FormattedJobDescription.tsx` [W]

Current frontend integration addition; final behavior is described in the feature sections above.

Final file SHA-256 prefix: `2be97baeee19`.

### `components/organisms/TweaksPanel.tsx` [W]

Current frontend integration addition; final behavior is described in the feature sections above.

Final file SHA-256 prefix: `5aabeac5bb9e`.

### `dropdown.md` [N]

Database dropdown or teaching-selection implementation; see section 3 and the source snapshots.

Final file SHA-256 prefix: `0a811cfbda6b`.

### `features/dropdowns/refresh.ts` [N]

Database dropdown or teaching-selection implementation; see section 3 and the source snapshots.

Final file SHA-256 prefix: `ef6ca1ceb2e4`.

### `features/dropdowns/types.ts` [N]

Database dropdown or teaching-selection implementation; see section 3 and the source snapshots.

Final file SHA-256 prefix: `9a7e4a7721e4`.

### `features/dropdowns/use-dropdown.ts` [N]

Database dropdown or teaching-selection implementation; see section 3 and the source snapshots.

Final file SHA-256 prefix: `42bd03a646d5`.

### `lib/query/query-client.tsx` [W]

Shared provider/theme infrastructure; see section 3A for lifecycle, persistence and native equivalents.

Final file SHA-256 prefix: `ddb3063179a9`.

### `lib/supplyed-preferences.ts` [W]

Shared provider/theme infrastructure; see section 3A for lifecycle, persistence and native equivalents.

Final file SHA-256 prefix: `874f61bc31da`.

### `lib/theme-bootstrap.ts` [N]

Shared provider/theme infrastructure; see section 3A for lifecycle, persistence and native equivalents.

Final file SHA-256 prefix: `ca6f02658a9d`.

### `lib/use-tweaks.ts` [N]

Shared provider/theme infrastructure; see section 3A for lifecycle, persistence and native equivalents.

Final file SHA-256 prefix: `07d5abf7d876`.

### `public/dropdown-theme.css` [N]

Database dropdown or teaching-selection implementation; see section 3 and the source snapshots.

Final file SHA-256 prefix: `d99da3a4f828`.

### `public/dynamic-dropdowns.js` [N]

Database dropdown or teaching-selection implementation; see section 3 and the source snapshots.

Final file SHA-256 prefix: `a2fcd66d7afb`.

### `tests/dropdown-fixture.cjs` [N]

Regression coverage for current frontend behavior; validation reference, not a mobile API.

Final file SHA-256 prefix: `8af8f0a1d771`.

### `tests/dynamic-dropdown-ui.test.cjs` [N]

Regression coverage for current frontend behavior; validation reference, not a mobile API.

Final file SHA-256 prefix: `50b507af5d80`.

### `tests/dynamic-dropdowns.test.cjs` [N]

Regression coverage for current frontend behavior; validation reference, not a mobile API.

Final file SHA-256 prefix: `a26f0c3e00dd`.

### `tests/role-description-editor.test.cjs` [N]

Regression coverage for current frontend behavior; validation reference, not a mobile API.

Final file SHA-256 prefix: `c3d017ad9752`.

## Appendix F. Current teaching API handoff supplied by the backend task

The following supplied contract replaces the old v1.2-only attachment. Its linked backend guides are supporting material; the dropdown mapping, response shape, payload examples and current website UI are already embedded above. Where its frontend suggestions mention a separate role font-size menu, section 3A's shared proposal-editor implementation takes precedence for this website/mobile parity task.

### SupplyEd: subjects, skills, and school staffing needs

Updated 19 October 2026 for database-managed dropdowns, **Other subjects and Other skills**. This document describes the prepared backend code and the website integration. Apply migrations and seed the target database before using the updated contract. For all dropdown APIs, control IDs and frontend source locations see [DROPDOWNS_FRONTEND_INTEGRATION.md](DROPDOWNS_FRONTEND_INTEGRATION.md); for the admin manager see [DROPDOWNS_ADMIN_INTEGRATION.md](DROPDOWNS_ADMIN_INTEGRATION.md).

#### 1. What changed

One versioned catalogue supplies the choices for all three flows:

| Form | Subject selections | Skill selections |
| --- | --- | --- |
| Teacher profile | `subjects: string[]` | `skills: string[]` |
| School profile, labelled **Staffing needs** | `staffingNeeds: string[]` | No school-profile skills field is added. |
| Job posting, including an invitation's `newJob` | `subjects: string[]` | `requiredSkills: string[]` |

**Staffing needs means the subjects/teaching areas the school needs staff for.** Replace its old free-text input with a searchable subject multi-select. It uses exactly the same subject values as teacher profiles and jobs.

The live catalogue is maintained in database `Dropdown` and `DropdownOption` tables. The source data is now seed input, not the runtime authority. Admin can fetch, add/edit options, retire and restore them through the new dropdown APIs. Existing string arrays remain the storage format for teachers/jobs; school staffing needs is an array. Custom subjects use request-only `otherSubjects`, and custom skills use request-only `otherSkills`. The backend stores their actual names in those existing arrays; no separate custom-name columns are needed.

#### 2. Fetch the catalogue

For editable labels, stable option keys and explicit relationships use the public `GET /api/dropdowns/subject`, `/api/dropdowns/skill` and `/api/dropdowns/keyStage` routes. Their `data.options[]` entries contain `{key,value,label,aliases,group,sortOrder,isActive,isShared,subjectKeys}`. Render `label`, submit `value` in existing business APIs, and use subject `key` values only for skill relationships. The common response/model is documented in the linked dropdown guide.

The compatibility teaching endpoint remains available and is built from the same consistent database snapshot:

```http
GET /api/teaching-catalogue
```

This endpoint is public, requires no token, has no query parameters, and returns HTTP 200 in the standard envelope:

```ts
type TeachingSubject = {
  name: string;          // Canonical saved value; editable display labels use the general dropdown API
  aliases: string[];     // Alternate spellings for search/legacy compatibility
  skills: string[];      // Subject-specific allowed skills
};
type TeachingCatalogue = {
  version: string;       // e.g. "db-1.1.1": subject, skill and keyStage revisions
  title: string;
  description: string;
  categories: Array<{ name: string; subjects: TeachingSubject[] }>;
  sharedSkills: string[];
  keyStages: string[];
  skillAliases: Record<string, string>;    // Alias/value -> canonical skill value
  keyStageAliases: Record<string, string>;
};
type CatalogueResponse = {
  success: true;
  statusCode: 200;
  message: string;
  data: TeachingCatalogue;
  meta: { requestId: string; timestamp: string; path: string; method: string };
};
```

Read `data.categories`, `data.sharedSkills`, and `data.keyStages`. The supplied starter file used `shared_skills` and `key_stages`; the API uses camelCase. The initial database seed has **69 named subjects/teaching areas plus Other**, and **335 distinct named skills plus Other**. The initial shared set contains the existing 16 shared skills plus the Other skill placeholder. Other subjects have no subject-specific links. Admin changes can alter membership/categories, so derive choices from the API rather than counts.

Fetch through a shared short-lived query/cache layer and refetch on focus, catalogue validation errors or admin changes. Replace the existing infinite stale-time policy. There is no ETag contract. The general dropdown reads send `Cache-Control: no-store`; administration now uses the protected dropdown APIs. During loading/error states show retry and preserve input rather than inventing fallback options. Do not maintain a second hardcoded frontend catalogue.

Use canonical `subject.name` and skill strings as values when consuming the compatibility endpoint. General dropdown options also have stable keys and editable labels, but business payloads still submit their `value`, not IDs/keys/labels. Do not submit category names or option objects. Aliases help search find the canonical choice; selecting Maths should submit Mathematics. The compatibility shape does not expose editable labels; adapt the wrapper to general dropdown detail when showing admin label changes.

#### 3. Which skills to show

For teachers and jobs:

```text
allowed skills = sharedSkills
                 UNION all skills of every currently selected subject
```

The union is deduplicated. A selected named skill must occur in this union; it need not belong to every selected subject. Shared skills such as Classroom Management and Lesson Planning are available regardless of subject. Other is now a shared skill placeholder for custom skill entry. An empty subject selection can contain shared named skills and explicit custom skills through Other, but not unrelated subject-specific named skills.

Example: selecting **Mathematics** and **Physics** allows Mathematics skills such as Algebra, Physics skills such as Mechanics, and all shared skills. Selecting Mathematics alone does not allow Poetry Analysis.

```ts
function availableSkills(catalogue: TeachingCatalogue, selectedSubjects: string[]): string[] {
  const selected = new Set(selectedSubjects);
  return [...new Set([
    ...catalogue.sharedSkills,
    ...catalogue.categories.flatMap(category => category.subjects)
      .filter(subject => selected.has(subject.name))
      .flatMap(subject => subject.skills),
  ])].sort((a, b) => a.localeCompare(b, 'en-GB'));
}

function reconcileSkills(catalogue: TeachingCatalogue, subjects: string[], skills: string[]) {
  const allowed = new Set(availableSkills(catalogue, subjects));
  return {
    kept: skills.filter(skill => allowed.has(skill)),
    removed: skills.filter(skill => !allowed.has(skill)),
  };
}
```

When a user removes a subject, identify skills that are no longer available. Remove those selections with a visible explanation, or ask the user to resolve them before saving. Keep skills still available through another selected subject or the shared list. Submit both the changed subjects and the cleaned-up skills together. The backend does not silently discard skills on the user's behalf.

Recommended form layout: searchable grouped **Subjects / teaching areas** multi-select, then searchable **Skills** multi-select with “Shared teaching skills” and selected-subject sections. If a skill appears under several sections, it must still represent one selected value. For schools, show only the subject multi-select under **Staffing needs**; do not add an unsupported `skills` field to the institution request.

##### Other subjects: input, saving, and editing

Selecting **Other** reveals a multi-value text input labelled **Other subjects**. Let the user add one name at a time as a chip, for example Astronomy or Marine Studies. Other can be selected alone or alongside catalogue subjects. The same behavior applies to teacher profiles, job forms (including invitation `newJob`), and school staffing needs.

Teacher request example:

```json
{
  "subjects": ["Mathematics", "Other"],
  "otherSubjects": ["Astronomy", "Marine Studies"],
  "skills": ["Algebra", "Lesson Planning"]
}
```

For a job, use the same `subjects` and `otherSubjects` fields and call the skill field `requiredSkills`. For a school, use:

```json
{
  "staffingNeeds": ["Mathematics", "Other"],
  "otherSubjects": ["Astronomy", "Marine Studies"]
}
```

`otherSubjects` is a **request-only** field. The backend stores actual names, not the Other placeholder, and returns:

```json
{
  "subjects": ["Mathematics", "Astronomy", "Marine Studies"]
}
```

For school responses, that same list is returned under `staffingNeeds`. There is no response `otherSubjects` field. A job's legacy scalar `subject` is its first actual subject, e.g. Mathematics here, or Astronomy if only Other + Astronomy was selected. Catalogue selections are stored first in their selected order, followed by custom names in their entered order.

Custom names are trimmed, repeated whitespace is collapsed, and case/punctuation-equivalent duplicates are removed. Each must contain at least one letter or number, be at most 100 characters, and contain no control characters. Unicode subject names are supported. The total number of real subjects across catalogue and custom selections must not exceed 50. Exact duplicate request values can also be rejected by DTO validation, so deduplicate the frontend chips before submission.

Other requires at least one custom name. Custom names require Other to be selected. Catalogue subjects or known aliases must be selected normally: entering Maths under Other asks the user to select Mathematics. Custom subject names do not become global choices and do not unlock arbitrary named skills. Other subjects alone provide shared named skills; selecting Mathematics also adds Mathematics skills. Custom skills have their own independent Other flow below.

For editing, split returned names into catalogue choices and custom names, then restore the Other selection when custom names exist. Example helper:

```ts
function subjectKey(value: string) {
  return value.toLowerCase().replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
function toSubjectEditor(catalogue: TeachingCatalogue, savedNames: string[]) {
  const lookup = new Map<string, string>();
  for (const subject of catalogue.categories.flatMap(category => category.subjects)) {
    if (subject.name === 'Other') continue;
    for (const name of [subject.name, ...subject.aliases]) lookup.set(subjectKey(name), subject.name);
  }
  const subjects: string[] = [];
  const otherSubjects: string[] = [];
  for (const name of savedNames) {
    const known = lookup.get(subjectKey(name));
    if (known) subjects.push(known);
    else otherSubjects.push(name);
  }
  return {
    subjects: [...new Set([...subjects, ...(otherSubjects.length ? ['Other'] : [])])],
    otherSubjects,
  };
}
```

Pass teacher/job `subjects` or school `staffingNeeds` as `savedNames`. For school writes, send the helper's `subjects` result as `staffingNeeds`. Do not send returned custom names directly inside the request's catalogue `subjects`/`staffingNeeds` array; reconstruct the explicit Other payload instead. Render custom values as text, not HTML.

On PATCH, omitted `otherSubjects` retains saved custom names. Skills-only edits preserve and revalidate them. To remove Other, send both the new catalogue choices **without Other** and `otherSubjects: []` in the same request. To clear all subjects, send `subjects: []` (or `staffingNeeds: []`) and `otherSubjects: []`, plus remove any non-shared skills. Removing Other while omitting its saved custom names returns an error rather than silently deleting them. An `otherSubjects`-only PATCH can replace existing custom names when the saved selection already contains custom subjects; when adding custom subjects for the first time, also send the choices with Other selected.

#### 4. Requests and responses

##### Other skills: input, saving, editing and clearing

When teacher `skills` or job `requiredSkills` contains **Other**, show an **Other skills** chip input. This selection is independent from Other subjects: a named subject can have custom skills. Use request-only `otherSkills: string[]`; it is also supported inside invitation `newJob`.

Teacher PATCH example:

```json
{
  "subjects": ["Mathematics", "Other"],
  "otherSubjects": ["Astronomy"],
  "skills": ["Algebra", "Other"],
  "otherSkills": ["Telescope operation"]
}
```

Saved response fields are `subjects: ["Mathematics", "Astronomy"]` and `skills: ["Algebra", "Telescope operation"]`. Neither Other nor request-only custom fields are stored. For jobs replace `skills` with `requiredSkills`. School staffing needs has custom subjects only; do not add an unsupported school skills field.

Custom skill rules mirror custom subjects: matching Other marker required, at least one name, at most 100 characters each, Unicode letter/number required, no controls, trimmed/collapsed whitespace and normalized deduplication. The combined number of named and custom actual skills cannot exceed 50. Known active skill names/aliases must be selected normally; entering an unrelated known skill in `otherSkills` cannot bypass subject validation.

On edit, split saved skill names into canonical/alias selections and unknown custom chips, adding Other when needed. Omitted `otherSkills` retains saved custom names. Removing Other skills sends both skills without Other and `otherSkills: []`. An `otherSkills`-only PATCH can replace an existing custom list; adding the first custom skill also needs the selection list with Other. Send the complete resulting teaching group when any part changes; omit unchanged groups on unrelated edits.

Explicit teacher clear:

```json
{
  "subjects": [],
  "otherSubjects": [],
  "skills": [],
  "otherSkills": []
}
```

For a job use `requiredSkills` instead of `skills`. Custom entries remain local to the record; they do not automatically add public dropdown options. If an admin later adds the same name officially, the next edited form resolves it to that official choice.

Authenticated writes continue to use the existing bearer-token flow and JSON API client. Existing required profile/job fields remain required; examples labelled PATCH are partial updates.

##### Teacher profile

Create using `POST /api/instructors`, or edit the owned profile using `PATCH /api/instructors/:id`:

```json
{
  "fullName": "Alex Teacher",
  "subjects": ["Mathematics", "Physics"],
  "skills": ["Algebra", "Mechanics", "Classroom Management"],
  "keyStages": ["KS3", "KS4"]
}
```

For PATCH, `fullName` and other unchanged fields can be omitted. Admin edits at `PATCH /api/instructors/admin/:id` enforce the same catalogue/Other rules. Teacher profile responses contain `subjects` and `skills` arrays with canonical spellings plus cleaned-up custom subject and skill names.

##### School profile / staffing needs

Create with `POST /api/institutions`, supplying the other required school fields. Edit with `PATCH /api/institutions/:id`:

```json
{
  "staffingNeeds": ["Mathematics", "English Language", "SEND Support"]
}
```

School own/public profile responses now return, for example:

```json
{
  "staffingNeeds": ["Mathematics", "English Language", "SEND Support"]
}
```

This is an intentional change from `string | null` to `string[]`. Update all school profile types, editors, summary cards, public profiles, review screens, fixtures, and form defaults. Render chips or a joined display string; submit an array. Do not submit `"Mathematics, Physics"` or an arbitrary sentence. Empty staffing needs is `[]`; sending null is rejected when this field is edited.

Staffing needs does not automatically create a job, change job recommendations, or restrict which subjects a school can select when posting. The website may offer a button to prefill a new job's subjects from the school profile, but the school must be able to edit that selection. The job's own subjects and skills remain the matching inputs.

##### Job create or edit

`POST /api/jobs` creates a draft. Publish with `PATCH /api/jobs/:id` and `{"status":"ACTIVE"}`. Public visibility requires ACTIVE status, a reached/unset `liveFrom`, and a future/unset `expiresAt`. Date-only listing inputs use Europe/London: live-from starts at midnight; expiry includes the entire selected day. Work `startDate` and `endDate` remain separate. These rules are unchanged by the catalogue.

```json
{
  "title": "Mathematics and physics cover",
  "description": "Cover lessons in both subjects.",
  "subjects": ["Mathematics", "Physics"],
  "requiredSkills": ["Algebra", "Mechanics", "Lesson Planning"],
  "keyStages": ["KS3", "KS4"],
  "liveFrom": "2026-11-01",
  "expiresAt": "2026-11-10",
  "startDate": "2026-11-12T08:00:00Z",
  "endDate": "2026-11-12T15:00:00Z",
  "payType": "daily",
  "payAmount": 180
}
```

For `PATCH /api/jobs/:id`, send only changed fields, but send the new skill list too if a subject removal would otherwise leave unrelated skills. Job `requiredSkills` keeps its existing name; do not rename it to `skills` in job requests.

Job responses now include both:

```json
{
  "subject": "Mathematics",
  "subjects": ["Mathematics", "Physics"],
  "requiredSkills": ["Algebra", "Mechanics", "Lesson Planning"]
}
```

`subject` is retained as a legacy first-subject field. New website code should read/display all of `subjects` and write `subjects` plus `otherSubjects` when applicable, omitting the legacy scalar. A legacy single `subject` request is still accepted if it resolves to an approved catalogue subject. If both fields are sent, `subject` must match the first actual stored subject after normalization; otherwise the request returns 400. Do not send a stale scalar alongside an updated array.

Changing the first actual subject changes the legacy scalar. `subjects: []` clears catalogue subjects; if custom names exist, also send `otherSubjects: []` to clear the whole selection and set `subject: null`. Remove any skills that are not shared. Omitting subjects on a PATCH preserves them. A legacy `subject: null` also clears subjects, subject to the same retained-custom-name and retained-skill checks.

Job lists still use the single `subject` query parameter, e.g. `GET /api/jobs?subject=Physics`; it matches that subject anywhere in the job's subject array. The free-text job search also considers catalogue subject names/aliases across the array and exact saved custom names. For custom subjects, use the saved spelling, e.g. `subject=Astronomy`. Partial/case-insensitive matching of secondary custom subjects in array search is not implemented. This does not add a multi-value subject query filter or an “all Other jobs” filter: Other is not stored. Teacher-directory subject/skill filters normalize known aliases too. Legacy, non-canonical stored values may need owner review before exact catalogue filters find them consistently.

##### Private invitations and bookings

An invitation `newJob` accepts the same `subjects`, `otherSubjects`, `requiredSkills` and `otherSkills` fields and runs the same validation as ordinary job creation. Recommended teachers can still be invited through the existing flow. Existing-job invitations send `jobId` rather than copying or replacing that job's teaching terms.

The offered job snapshot in invitation responses now includes `subjects: string[]`; booking job summaries also include it. Update those display types and render all selected subjects. Existing pending offer snapshots are read with a single-subject fallback so adding the array does not alone invalidate an unchanged offer. Changing the actual offered subjects remains a terms change and can require a fresh invitation under existing consent rules.

#### 5. Backend validation and editing rules

- Maximum **50 subjects**, **50 skills**, or **50 staffing-needs subjects** per respective array. Each name is at most 100 characters.
- Request `subjects`/`staffingNeeds` values must be active catalogue entries or supported aliases, including Other. Custom subjects use Other plus `otherSubjects`; custom skills use skill Other plus `otherSkills`.
- For catalogue choices, the API normalizes case, whitespace, punctuation, and `&`, and stores canonical names. Known equivalent aliases are deduplicated. Custom names preserve the user's spelling after whitespace cleanup, with normalized comparison for deduplication and matching. Avoid duplicate values in frontend payloads; DTO validation rejects exact duplicates.
- Named skills must belong to selected subjects or `sharedSkills`. Being present elsewhere in the catalogue is insufficient. Explicit custom skills follow their separate Other rules.
- Missing optional arrays on create keep the existing ability to save incomplete profiles/jobs. No new “must select one subject” publication rule was added. The website can encourage selection; do not claim the API requires one.
- On PATCH, omitted fields are retained. Explicit arrays replace the entire selection. Use `[]` to clear arrays; do not send null.
- If only subjects change, validation checks retained skills/custom names. If only skills change, it checks retained subjects/custom names. Orphaned named skills must be corrected in the same request; saved custom subjects and skills are reconstructed as Other internally.
- Unrelated edits, such as a teacher's name or a job's title, do not force a legacy catalogue cleanup. Only send changed fields to avoid unintentionally resubmitting obsolete selections.
- Key stages remain separate and now validate against active `keyStage` dropdown values on teacher/job writes. Other mutable location/currency/cover-type fields also use active dropdown membership. Existing shapes, technical enums and required-field checks remain. Do not add unsupported phase/duration/credential request properties.

Examples of canonicalization: `Maths` -> `Mathematics`; `ICT` -> `Information Technology (ICT)`; `Differentiated Instruction` -> `Adaptive Teaching`; `SEN` as a supported skill alias -> `SEND Support`. These aliases provide compatibility, not permission to add arbitrary synonyms.

Ambiguous old values are deliberately not guessed: generic `English` is not silently assigned to English Language or English Literature, and generic `Composition` is not silently assigned to Music Composition or Photographic Composition. The user should choose the intended option.

#### 6. Error handling

Catalogue violations return HTTP 400 in the normal failure envelope:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "These requiredSkills do not belong to the selected subjects: Poetry Analysis. Select the relevant subject or remove these skills.",
  "error": "Bad Request",
  "code": "SKILL_SUBJECT_MISMATCH",
  "data": null,
  "meta": {
    "requestId": "example-request-id",
    "timestamp": "2026-10-19T10:00:00.000Z",
    "path": "/api/jobs",
    "method": "POST"
  }
}
```

| Code | Meaning | Website handling |
| --- | --- | --- |
| `INVALID_TEACHING_SELECTION` | Unknown subject/skill/staffing-need value, invalid list, or selection limit exceeded | Refresh the catalogue and highlight the selection field. Keep the user's other form values. |
| `SKILL_SUBJECT_MISMATCH` | Approved skill is not allowed for the selected subjects | Show the message beside Skills; ask the user to remove the skill or add its subject. |
| `CONFLICTING_JOB_SUBJECTS` | Legacy `subject` disagrees with `subjects` | Correct the API payload to send only `subjects`. |
| `INVALID_OTHER_SUBJECTS` | Other is missing/empty, custom names are invalid, a known subject was entered as custom, or the combined subject limit was exceeded | Show the returned message beside Other subjects; retain all form input so the user can correct it. |
| `INVALID_OTHER_SKILLS` | Skill Other/custom pairing is invalid, a known skill was entered as custom, or name/combined limit rules fail | Show beside Other skills and preserve the input. |
| `INVALID_DROPDOWN_SELECTION` | A submitted location/key stage/currency/etc. choice is not currently active | Refresh that dropdown and allow correction. |
| `DROPDOWNS_NOT_SEEDED` | Registered reference data is absent; HTTP 503 | Show temporarily unavailable/retry; operator runs migration and seed. |

DTO-level failures, such as a string instead of an array, can have an array of validation messages and no `code`. Support both string and array `message` values. Do not expect an `invalidValues` or `field` response property: those are not part of this error contract. Keep request IDs in technical details rather than showing them as the main error text.

#### 7. Matching changes

The engine remains a rule-based weighted scorer; no new service or machine-learning model is introduced.

```text
subject factor = number of selected job subjects the teacher teaches
                 / number of selected job subjects
```

With Mathematics + Physics on the job, a Mathematics-only teacher gets **0.5** for the subject factor; a teacher covering both gets **1**. The subject weight remains **25**. Skills still use the fraction of required skills the teacher holds, with weight **15**. All other factors, weights, booking-conflict rules, travel filters, and alert thresholds remain unchanged.

The subject list represents desired coverage, not an “any one subject gives full marks” list. Partial coverage lowers the score; it is not a hard exclusion. Subjects/skills omitted from the job still skip their respective factors. The frontend should use the returned `match.score` and explanations such as “1 of 2 subjects”, not recompute scores.

Normalization respects distinct identities: English Language does not equal English Literature; Computing does not equal Information Technology (ICT); Classroom Management does not equal Behaviour Management. Synonymous spellings resolve through database aliases. Custom subject and skill names compare Unicode-aware normalized text: Astronomy matches astronomy, but not Marine Studies. Custom synonyms are not inferred. Other is excluded from both subject and skill matching and never provides placeholder credit. Saved legacy names use the same actual-name comparison.

Every ranking request loads a consistent database catalogue snapshot including retired identities/aliases so old saved selections keep matching. New/edited form selections use active data. Existing teaching aliases cannot be removed through admin updates; aliases/values of retired options cannot be reassigned to a different identity. Editing an option label leaves scoring unchanged because saved values remain immutable.

Default weights remain: subjects 25, key stages 15, skills 15, location 15, pay 10, DBS verification 10, rating 5, experience 5. The final score is `round(100 * sum(weight * factorValue) / sum(applicable positive weights))`. Job requirements that are absent skip their factors. Existing `MATCH_WEIGHTS` deployment configuration can override defaults; dropdown edits do not alter it.

Confirmed overlapping bookings and exceeded explicit travel radii continue to exclude new recommendations. Applicant ranking keeps submitted applicants and exposes conflict flags instead of dropping them. No new QTS/DBS verification is inferred from choosing a subject or skill. Use returned `match.score`, `factors`, `flags` and `distanceMiles`, not frontend calculations.

Matching endpoints remain `GET /api/matching/jobs/recommended` for teachers, `GET /api/matching/jobs/:jobId/instructors` and `/applications` for the owning school/admin, and `GET /api/matching/jobs/:jobId/score` for a teacher's score against a public job. The dropdown source change adds no matching API or automatic hire/invitation behavior.

The school's staffing needs is a profile preference, not a replacement for each job's subject requirements. No new school-to-teacher matching endpoint is added.

#### 8. Changes made to the supplied AI-generated data

The data was edited as a product catalogue, not represented as an official curriculum or a complete list for every UK education system. The main improvements are:

| Change | Reason |
| --- | --- |
| Merged ICT into Information Technology (ICT), keeping the combined skills | Prevent duplicate choices for the same general teaching area. Computing stays separate. |
| Renamed Primary / General Classroom to Primary Teaching | A clearer selectable teaching-area label. |
| Merged Reception skills into Early Years (EYFS); KS1/KS2 skills into Primary Teaching | Avoid duplicating key stages as subjects. Users can still select key stages separately. |
| Removed Other Modern Foreign Languages | An unspecified language cannot provide a reliable match; select a listed language or use Other and enter the actual language name. |
| Removed generic BTEC / Vocational Studies and T-Level Subjects choices | A qualification route alone does not identify the actual subject needed. The actual vocational subjects remain available. |
| Retained support areas/roles under their own category | SEND Support, Teaching Assistant, HLTA, and Cover Supervisor are useful staffing areas, even though they are not academic subjects. Label the overall selector accordingly. |
| Split ambiguous Composition into Music Composition and Photographic Composition | Avoid false matches between unrelated skills. |
| Standardized Adaptive Teaching, Safeguarding Awareness, Phonics Teaching, CAD, Pupil Engagement, and repeated skills | Reduce duplicate spellings and make shared skills reusable. |
| Added shared SEND Support with legacy SEN/SEND aliases | Keep this cross-subject support ability selectable without requiring a special-subject job. |
| Kept qualifications/checks out of the selectable skill-verification logic | A skill selection does not prove QTS, DBS, right-to-work, or safeguarding clearance. Existing verification workflows remain authoritative. |

School phases, job durations, and credential labels from the starter file are not newly persisted or validated by this implementation. Do not add unsupported request fields based on those sections of the original attachment.

#### 9. Existing data and rollout

Migration: `prisma/migrations/20261019000000_job_subjects_catalogue/migration.sql`.

It adds `Job.subjects` and copies each nonblank existing `subject` into a one-element array. It changes `InstitutionProfile.staffingNeeds` from text to a non-null text array: blank/null becomes `[]`; other old text is preserved as a single entry. It does not try to parse free-form staffing sentences or silently assign subjects. Teacher selections are not bulk-rewritten. No profiles/jobs are deleted.

For existing forms, compare returned selections against the catalogue and reconstruct Other for custom/unknown names as described above. Preserve those names for user review; do not silently discard them. Legacy free-form staffing sentences should be reviewed and replaced by meaningful individual subjects. The backend checks name shape/length, not whether prose is educationally meaningful; an unknown saved name can now be retained as a custom subject through Other.

Changing teaching fields validates the combined named/custom subjects and skills. An unrelated edit can omit them and retain saved values as-is. Known aliases canonicalize on the next teaching-related save. Custom subject/skill names are allowed and do not become public options. Other itself adds no custom-name columns; the earlier job-subject/staffing-needs migration is still required if not deployed. The new dropdown migration creates the reference tables.

Before starting the updated backend run:

```powershell
pnpm exec prisma migrate deploy
pnpm prisma:generate
pnpm seed:dropdowns
```

`pnpm prisma:seed` runs the same configured dropdown seed. `pnpm seed:dropdowns --check` validates packaged data without connecting to a database. Existing collections are skipped completely on rerun, preserving all admin edits/deletions; administer them through PATCH instead of treating seed as a reset. Compiled production deployments can run `pnpm seed:dropdowns:prod` after building; see the full deployment sequence in the dropdown guide.

Coordinate the website update, especially staffingNeeds arrays, skill Other, dynamic membership and labels. Old clients sending free-text staffing needs receive validation errors. Existing valid scalar-job-subject clients continue to work but display only its first subject. Migration/seed execution against a deployed database is an operator step, not a claimed result of these code changes.

#### 10. Frontend acceptance checks

1. All three forms fetch the same database catalogue and submit canonical values, rendering editable labels through the general dropdown API. Custom subjects and skills use their explicit Other fields.
2. Multiple teacher/job subjects and school staffing-needs subjects can be selected, removed, and reloaded correctly.
3. Skills are the deduplicated union of selected subjects plus shared skills; shared options are never counted twice.
4. Removing a subject preserves skills supported elsewhere and prompts removal of unsupported skills.
5. A custom name directly in a catalogue selection array or an unrelated named skill receives 400; admin profile edits and invitation-created jobs cannot bypass validation. Custom subject and skill names succeed through their explicit Other fields.
6. Partial updates validate against stored subjects/skills, and changing both together succeeds when the final selection is valid.
7. School staffing needs is an array in private and public profile displays; old free text is handled as a legacy selection requiring review.
8. Job detail, matching results, invitations, bookings, and search show/find secondary subjects rather than only the legacy first subject.
9. Mathematics + Physics matches a Mathematics-only teacher at half the subject factor. English Language and English Literature do not become a false exact match.
10. Existing pending single-subject offers still compare correctly after migration; actual changes to offered subjects trigger existing terms-change protection.
11. Existing listing dates, application hire/reject shortcuts, and invitation acceptance/expiry behavior continue to work.
12. Other works alone or alongside catalogue subjects in teacher, school, ordinary job, and invitation-new-job forms; save/reload reconstructs the editor correctly.
13. Other without names, custom names without Other, blank/control-character/overlong names, and known catalogue aliases entered as custom receive 400.
14. Removing either Other selection clears the matching custom array explicitly; omitted arrays retain saved values. Shared skills remain available, and unrelated named skills cannot bypass validation through otherSkills.
15. Matching compares actual custom subject/skill names, including Unicode names; different custom values do not match merely because both forms selected Other.
16. Admin label edits leave scores unchanged; active membership/relationship changes appear in refreshed forms; retired saved identities remain readable and keep historical alias resolution.

#### 11. Source files

- [Dropdown seed data](src/modules/dropdowns/dropdown-seed.data.ts): initial values, aliases, categories, skill links and frontend control/source mappings.
- [Dropdown service](src/modules/dropdowns/dropdowns.service.ts): live database data, admin edits, active-value validation and consistent teaching snapshots.
- [Validation helpers](src/modules/teaching-catalogue/teaching-catalogue.ts): canonicalization, merged PATCH checks, and legacy subject handling.
- [Catalogue endpoint](src/modules/teaching-catalogue/teaching-catalogue.module.ts).
- [Matching scorer](src/modules/matching/match-scorer.ts) and [normalization](src/modules/matching/normalize.ts).
- [Application transition rules](src/modules/applications/application-status.machine.ts): unchanged `APPLIED`, `VIEWED`, and `SHORTLISTED` can move directly to `HIRED` or `REJECTED`; review stages are optional.
- [Invitation service](src/modules/bookings/direct-hire.service.ts): private offers still require teacher acceptance; sending an invitation does not create a booking.

Maintain live choices through the ADMIN-only dropdown APIs, using the latest revision. Existing option key/value identities are immutable; labels and supported metadata are editable. Adding options to extensible collections does not require a schema migration. Retirement is reversible soft deletion and does not rewrite saved records. Read [DROPDOWNS_ADMIN_INTEGRATION.md](DROPDOWNS_ADMIN_INTEGRATION.md) for exact admin flows and [DROPDOWNS_FRONTEND_INTEGRATION.md](DROPDOWNS_FRONTEND_INTEGRATION.md) for every public frontend location and API.


## Appendix G. Exact current UI, dropdown, editor and theme source snapshots

These are reference snapshots from the current website, included so this single file can drive precise mobile integration. Reimplement platform equivalents; do not blindly execute browser DOM, Quill, Next, CSS or web authentication code in a native app. CSS `@layer`/utility precedence is part of web rendering. The prose above identifies which measurements/states to port. Read the currently deployed dropdown API for option values; source lists marked technical support/legacy data are not runtime menu fallbacks.

| Source | Purpose |
| --- | --- |
| `app/globals.css` | Visual token/layout reference. |
| `components/styles/foundation.css` | Visual token/layout reference. |
| `components/styles/selectors.css` | Visual token/layout reference. |
| `components/styles/proposal.css` | Visual token/layout reference. |
| `components/styles/proposal-preview.css` | Visual token/layout reference. |
| `components/styles/workspace.css` | Visual token/layout reference. |
| `components/styles/teacher-dashboard.css` | Visual token/layout reference. |
| `components/styles/account.css` | Visual token/layout reference. |
| `components/styles/waitlist.css` | Visual token/layout reference. |
| `components/styles/my-profile.css` | Visual token/layout reference. |
| `components/atoms/Field.tsx` | Current behavior/contract reference. |
| `components/molecules/OptionDropdowns.tsx` | Current behavior/contract reference. |
| `components/molecules/DynamicDropdown.tsx` | Current behavior/contract reference. |
| `components/molecules/TeachingSelectionFields.tsx` | Current behavior/contract reference. |
| `components/molecules/ProposalEditor.tsx` | Current behavior/contract reference. |
| `components/molecules/RoleDescriptionEditor.tsx` | Current behavior/contract reference. |
| `components/molecules/ProposalContent.tsx` | Current behavior/contract reference. |
| `components/molecules/FormattedJobDescription.tsx` | Current behavior/contract reference. |
| `features/dropdowns/types.ts` | Current behavior/contract reference. |
| `features/dropdowns/use-dropdown.ts` | Current behavior/contract reference. |
| `features/dropdowns/refresh.ts` | Current behavior/contract reference. |
| `features/teaching-catalogue/use-teaching-catalogue.ts` | Current behavior/contract reference. |
| `features/teaching-catalogue/selection.ts` | Current behavior/contract reference. |
| `features/teaching-catalogue/patch.ts` | Current behavior/contract reference. |
| `lib/theme.ts` | Current behavior/contract reference. |
| `lib/theme-bootstrap.ts` | Current behavior/contract reference. |
| `lib/supplyed-preferences.ts` | Current behavior/contract reference. |
| `components/molecules/PublicThemeControls.tsx` | Current behavior/contract reference. |
| `components/organisms/TweaksPanel.tsx` | Current behavior/contract reference. |
| `public/dropdown-theme.css` | Visual token/layout reference. |
| `public/dynamic-dropdowns.js` | Current behavior/contract reference. |
| `app/api/dropdowns/route.ts` | Current behavior/contract reference. |
| `app/api/dropdowns/[name]/route.ts` | Current behavior/contract reference. |
| `app/theme-bootstrap.js/route.ts` | Current behavior/contract reference. |
| `lib/use-tweaks.ts` | Observable local theme preferences with hydration-safe snapshots. |
| `lib/query/query-client.tsx` | Stable TanStack Query client, defaults and mutation refresh behavior. |
| `app/layout.tsx` | Shared root and early theme bootstrap placement. |
| `app/(auth)/layout.tsx` | Query context for login, signup and forgot-password theme controls. |
| `app/(public)/layout.tsx` | Query context for public forms and theme controls. |
| `app/(app)/layout.tsx` | Authenticated workspace query context. |

### UI source: app/globals.css

```css
@import "tailwindcss";
@config "../tailwind.config.ts";
@source not "../tmp";

@theme inline {
  --font-sans: var(--sans);
  --font-heading: var(--sans);
  --font-serif: var(--serif);
  --font-mono: var(--mono);
  --color-brand: var(--se);
  --color-brand-dark: var(--se-dark);
  --color-brand-tint: var(--se-tint);
  --color-brand-tint-2: var(--se-tint-2);
  --color-ink: var(--ink);
  --color-graphite: var(--graphite);
  --color-slate: var(--slate);
  --color-muted: var(--muted);
  --color-border: var(--border);
  --color-border-strong: var(--border-2);
  --color-chalk: var(--chalk);
  --color-surface: var(--surface);
  --color-surface-subtle: var(--surface-2);
  --color-success: var(--green);
  --color-success-tint: var(--green-tint);
  --color-warning: var(--amber);
  --color-warning-tint: var(--amber-tint);
  --color-danger: var(--red);
  --color-danger-tint: var(--red-tint);
  --radius-card: var(--radius);
  --radius-panel: var(--radius-lg);
  --shadow-card: var(--shadow);
  --shadow-panel: var(--shadow-lg);
}

:root {
  --se: #008cc4;
  --se-rgb: 0 140 196;
  --se-dark: #006e9a;
  --se-tint: #e5f4fa;
  --se-tint-2: #cfeaf5;
  --ink: #15232d;
  --graphite: #2d3c48;
  --slate: #50616e;
  --muted: #5f707b;
  --border: #e2e8ec;
  --border-2: #cbd5dd;
  --chalk: #f5f7f9;
  --surface: #ffffff;
  --surface-2: #f8fafb;
  --green: #168344;
  --green-tint: #f0fdf4;
  --amber: #a96008;
  --amber-tint: #fffbeb;
  --red: #cf1941;
  --red-tint: #fff1f2;
  --purple: #7c3aed;
  --purple-tint: #f5f3ff;
  --radius-sm: 6px;
  --radius: 10px;
  --radius-lg: 12px;
  --radius-xl: 18px;
  --control-height: 46px;
  --control-radius: 9px;
  --radius-check: 4px;
  --control-font-size: 14px;
  --control-padding-x: 13px;
  --control-padding-y: 11px;
  --focus-ring: 0 0 0 3px rgb(var(--se-rgb) / 0.14);
  --duration-ui: 160ms;
  --ease-ui: cubic-bezier(.2, .8, .2, 1);
  --overlay: rgb(15 23 35 / .45);
  --on-brand: #ffffff;
  --text-brand: var(--se-dark);
  --shadow-xs: 0 1px 3px rgba(24, 46, 62, 0.035);
  --shadow-sm: 0 1px 3px rgba(10, 10, 10, 0.06), 0 1px 2px rgba(10, 10, 10, 0.04);
  --shadow: 0 4px 16px rgba(10, 10, 10, 0.04), 0 1px 3px rgba(10, 10, 10, 0.03);
  --shadow-lg: 0 16px 48px rgba(10, 10, 10, 0.1), 0 2px 8px rgba(10, 10, 10, 0.04);
  --sans: var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
  /* Existing display/serif utilities share the site's new heading family. */
  --serif: var(--sans);
  --mono: ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  --font-serif: var(--serif);
  --font-sans: var(--sans);
  --font-heading: var(--sans);
  --font-mono: var(--mono);
  --default-font-family: var(--sans);
}

/* Base rules must not override Tailwind component typography and spacing. */
@layer base {
* {
  box-sizing: border-box;
}

html,
body {
  min-height: 100%;
  font-family: var(--sans);
  background: var(--chalk);
  color: var(--ink);
  line-height: 1.6;
  font-optical-sizing: auto;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

  html {
    font-size: 100%;
    scroll-padding-top: 6rem;
  }

  body {
    font-size: 0.9375rem;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  .font-heading {
    font-family: var(--sans);
    font-weight: 600;
    letter-spacing: -0.03em;
    text-wrap: balance;
  }

button,
input,
select,
textarea {
  font: inherit;
}

button:not(:disabled),
a[href],
[role="button"],
input[type="button"],
input[type="submit"],
input[type="reset"],
summary {
  cursor: pointer;
}

button:disabled,
[aria-disabled="true"] {
  cursor: not-allowed;
}

a {
  color: inherit;
  text-decoration: none;
}

:where(button, a, input, select, textarea, summary, [tabindex]):focus-visible {
  outline: 2px solid var(--se);
  outline-offset: 3px;
}

input[type="checkbox"],
input[type="radio"] {
  accent-color: var(--se);
}

input[type="date"], input[type="time"], select {
  color-scheme: light;
}

* {
  scrollbar-width: thin;
  scrollbar-color: var(--border-2) transparent;
}

::selection {
  background: var(--se-tint-2);
  color: var(--ink);
}
}

/* Components sit below utilities so page-specific sizing remains predictable. */
@layer components {

.workspace-shell {
  min-height: 100vh;
  background: var(--chalk);
}

.logo {
  font-weight: 500;
  letter-spacing: -0.5px;
  white-space: nowrap;
  user-select: none;
}

.logo .ed {
  color: var(--se);
  font-weight: 700;
}

.h-display,
.h-serif {
  font-family: var(--serif);
  font-weight: 600;
  letter-spacing: -0.03em;
}

.h-display {
  line-height: 1.1;
}

.h-serif {
  line-height: 1.18;
}

.eyebrow,
.label-xs {
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.eyebrow {
  font-size: 11px;
  color: var(--text-brand);
  font-weight: 600;
}

.label-xs {
  font-size: 11px;
  color: var(--muted);
  font-weight: 600;
}

.section-title {
  font-size: 15px;
  color: var(--graphite);
  font-weight: 600;
  letter-spacing: -0.01em;
  margin-bottom: 16px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
  min-height: 44px;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  max-width: 100%;
  white-space: normal;
}

.btn-primary {
  background: var(--se);
  color: #fff;
}

.btn-primary:hover {
  background: var(--se-dark);
}

.btn-secondary {
  background: var(--surface);
  color: var(--ink);
  border-color: var(--border-2);
}

.btn-secondary:hover {
  background: var(--chalk);
}

.btn-ghost {
  background: transparent;
  color: var(--slate);
}

.btn-ghost:hover {
  background: var(--chalk);
  color: var(--ink);
}

.btn-ink {
  background: var(--ink);
  color: #fff;
}

.btn-danger {
  background: var(--surface);
  color: var(--red);
  border-color: var(--red);
}

.btn-sm {
  min-height: 36px;
  padding: 7px 12px;
  font-size: 13px;
}

.btn-lg {
  min-height: 48px;
  padding: 12px 20px;
  font-size: 14px;
}

.btn-xl {
  min-height: 52px;
  padding: 14px 24px;
  font-size: 15px;
  border-radius: var(--radius-xl);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tag,
.pill,
.chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.tag {
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
  padding: 4px 9px;
  border-radius: 6px;
  background: var(--se-tint);
  color: var(--text-brand);
}

.tag-green {
  background: var(--green-tint);
  color: var(--green);
}

.tag-amber {
  background: var(--amber-tint);
  color: var(--amber);
}

.tag-red {
  background: var(--red-tint);
  color: var(--red);
}

.tag-purple {
  background: var(--purple-tint);
  color: var(--purple);
}

.tag-ghost {
  background: var(--chalk);
  color: var(--slate);
  border: 0.5px solid var(--border);
}

.pill {
  padding: 4px 10px;
  border-radius: 20px;
  border: 1px solid var(--border);
  font-size: 12px;
  color: var(--slate);
}

.chip {
  padding: 6px 12px;
  border-radius: 999px;
  border: 0.5px solid var(--border);
  background: var(--surface);
  color: var(--slate);
  font-size: 12px;
  cursor: pointer;
}

.chip.active {
  background: var(--se-dark);
  color: #fff;
  border-color: var(--se-dark);
}

.input,
.select,
.textarea {
  width: 100%;
  min-width: 0;
  min-height: var(--control-height);
  border: 1px solid var(--border-2);
  border-radius: var(--control-radius);
  background: var(--surface);
  color: var(--ink);
  padding: var(--control-padding-y) var(--control-padding-x);
  font-size: var(--control-font-size);
  font-weight: 400;
  line-height: 1.5;
  transition: border-color 160ms ease, box-shadow 160ms ease;
  outline: none;
}

.input:focus,
.select:focus,
.textarea:focus {
  border-color: var(--se);
  box-shadow: var(--focus-ring);
}

.textarea {
  resize: vertical;
  min-height: 88px;
}

.field {
  margin-bottom: 20px;
}

.field-label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--graphite);
}

.checkbox {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1px solid var(--border-2);
  background: var(--surface);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.checkbox.checked {
  background: var(--se);
  border-color: var(--se);
}

.checkbox.checked::after {
  content: "";
  width: 8px;
  height: 4px;
  border-left: 1.5px solid #fff;
  border-bottom: 1.5px solid #fff;
  transform: rotate(-45deg) translate(1px, -1px);
}

.toggle {
  width: 36px;
  height: 20px;
  border-radius: 999px;
  position: relative;
  background: var(--border-2);
  cursor: pointer;
}

.toggle::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--surface);
  transition: transform 0.18s ease;
}

.toggle.on {
  background: var(--se);
}

.toggle.on::after {
  transform: translateX(16px);
}

.card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-xs);
  min-width: 0;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}

.card-pad {
  padding: 24px;
}

.card-pad-lg {
  padding: 28px;
}

.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--se-tint);
  color: var(--se-dark);
  font-weight: 700;
  flex-shrink: 0;
}

.avatar-sm {
  width: 30px;
  height: 30px;
  font-size: 10px;
}

.avatar-md {
  width: 38px;
  height: 38px;
  font-size: 12px;
}

.avatar-lg {
  width: 56px;
  height: 56px;
  font-size: 16px;
}

.avatar-purple {
  background: var(--purple-tint);
  color: var(--purple);
}

.avatar-amber {
  background: var(--amber-tint);
  color: var(--amber);
}

.avatar-green {
  background: var(--green-tint);
  color: var(--green);
}

.row {
  display: flex;
  align-items: center;
}

.col {
  display: flex;
  flex-direction: column;
}

.between {
  justify-content: space-between;
}

.wrap {
  flex-wrap: wrap;
}

.flex-1 {
  flex: 1;
  min-width: 0;
}

.w-full {
  width: 100%;
}

.grid-2,
.grid-3,
.grid-4 {
  display: grid;
  gap: 16px;
}

.grid-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.grid-3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.grid-4 {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.xs { font-size: 11px; }
.sm { font-size: 12px; }
.md { font-size: 13px; }
.lg { font-size: 15px; }

.fw-5 { font-weight: 500; }
.fw-6 { font-weight: 600; }
.fw-7 { font-weight: 700; }

.muted { color: var(--muted); }
.se { color: var(--text-brand); }

.truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-nav {
  min-height: 76px;
  padding: 14px 28px;
  display: flex;
  align-items: center;
  gap: 24px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.app-nav-links {
  display: flex;
  gap: 4px;
  min-width: 0;
}

.app-nav-link {
  display: flex;
  align-items: center;
  min-height: 40px;
  padding: 10px 12px;
  border: none;
  border-radius: var(--radius);
  background: transparent;
  color: var(--slate);
  cursor: pointer;
  font-family: var(--sans);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  transition: background-color 160ms ease, color 160ms ease;
  white-space: nowrap;
}

.app-nav-link:hover {
  background: var(--chalk);
  color: var(--ink);
}

.app-nav-link.active {
  background: var(--chalk);
  color: var(--ink);
  font-weight: 600;
  box-shadow: inset 0 -2px 0 var(--se);
}

.app-nav-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}

.notif-btn {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: var(--radius);
  background: transparent;
  color: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
}

.notif-btn:hover {
  background: var(--chalk);
}

.notif-dot {
  position: absolute;
  top: 7px;
  right: 7px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--red);
}

.app-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 36px 32px 56px;
}

.page-title-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}

.page-title {
  font-family: var(--serif);
  font-weight: 600;
  letter-spacing: -0.03em;
  font-size: 32px;
  line-height: 1.1;
}

.page-subtitle {
  margin-top: 6px;
  color: var(--muted);
}

.stat {
  padding: 24px;
  border-radius: var(--radius-lg);
  background: var(--surface);
  border: 1px solid var(--border);
}

.stat-value {
  font-family: var(--serif);
  font-weight: 600;
  letter-spacing: -0.025em;
  font-variant-numeric: tabular-nums;
  font-size: 32px;
  line-height: 1;
}

.stat-label,
.stat-delta {
  margin-top: 8px;
  font-size: 13px;
  font-weight: 500;
}

.stat-delta {
  color: var(--green);
}

.progress {
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: var(--chalk);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--se);
}

@keyframes loader-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
}

@keyframes auth-loader-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes auth-loader-sweep {
  0% {
    transform: translateX(-70%) scaleX(0.3);
  }

  50% {
    transform: translateX(20%) scaleX(0.72);
  }

  100% {
    transform: translateX(145%) scaleX(0.28);
  }
}

.button-loader-mark {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  opacity: 0.9;
  animation: loader-spin 0.75s linear infinite;
}

.inline-loader {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.inline-loader-mark {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  border: 2px solid var(--se);
  border-top-color: transparent;
  animation: loader-spin 0.75s linear infinite;
}

.skeleton {
  position: relative;
  display: block;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--se-tint) 46%, var(--chalk));
}

.skeleton::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgb(255 255 255 / 0.7), transparent);
  animation: skeleton-shimmer 1.35s ease-in-out infinite;
}

.skeleton-dot {
  width: 34px;
  height: 34px;
}

.skeleton-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-lg);
}

.skeleton-line {
  width: 100%;
  height: 10px;
}

.skeleton-line.short {
  width: 64%;
}

.skeleton-title {
  width: 70%;
  height: 16px;
}

.skeleton-action {
  width: 76px;
  height: 34px;
  border-radius: var(--radius);
}

.section-loader {
  display: grid;
  gap: 10px;
}

.section-loader-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  min-height: 60px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  padding: 12px;
}

.section-loader-lines {
  display: grid;
  gap: 8px;
}

.card-grid-loader {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.card-loader {
  display: grid;
  gap: 12px;
  min-height: 150px;
  align-content: start;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  padding: 16px;
}

.page-loader-screen {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background:
    radial-gradient(circle at 18% 16%, rgb(var(--se-rgb) / 0.08), transparent 28%),
    var(--chalk);
  padding: 24px;
}

.page-loader-screen.compact {
  min-height: 420px;
}

.page-loader-panel {
  width: min(920px, 100%);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  background: rgb(255 255 255 / 0.94);
  box-shadow: var(--shadow-lg);
  padding: 22px;
}

.page-loader-head {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-bottom: 18px;
}

.page-loader-brand-mark {
  width: 42px;
  height: 42px;
  border-radius: var(--radius-lg);
  background: linear-gradient(135deg, var(--se), var(--se-dark));
  box-shadow: 0 0 0 8px rgb(var(--se-rgb) / 0.1);
  position: relative;
}

.page-loader-brand-mark::after {
  content: "";
  position: absolute;
  inset: 12px;
  border: 2px solid #fff;
  border-top-color: transparent;
  border-radius: 999px;
  animation: loader-spin 0.85s linear infinite;
}

.page-loader-title {
  font-family: var(--serif);
  font-weight: 600;
  letter-spacing: -0.025em;
  font-size: 28px;
  line-height: 1.1;
}

.page-loader-copy {
  margin-top: 4px;
  color: var(--muted);
}

.page-loader-grid {
  display: grid;
  gap: 14px;
}

.auth-loader-screen {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background:
    linear-gradient(180deg, rgb(255 255 255 / 0.86), rgb(255 255 255 / 0.28)),
    var(--chalk);
  padding: 24px;
}

.auth-loader-shell {
  width: min(780px, 100%);
  display: grid;
  grid-template-columns: minmax(220px, 0.42fr) minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
}

.auth-loader-rail {
  position: relative;
  min-height: 320px;
  overflow: hidden;
  background:
    linear-gradient(rgb(var(--se-rgb) / 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgb(var(--se-rgb) / 0.08) 1px, transparent 1px),
    var(--ink);
  background-size: 44px 44px;
  color: #fff;
  padding: 28px;
}

.auth-loader-logo {
  position: relative;
  z-index: 1;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0;
}

.auth-loader-logo span {
  color: var(--se);
}

.auth-loader-rail-copy {
  position: absolute;
  left: 28px;
  right: 28px;
  bottom: 72px;
  z-index: 1;
  display: grid;
  gap: 10px;
}

.auth-loader-rail-copy span {
  color: color-mix(in srgb, var(--se) 72%, #fff);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.auth-loader-rail-copy strong {
  max-width: 250px;
  color: rgb(255 255 255 / 0.9);
  font-size: 22px;
  font-weight: 700;
  line-height: 1.18;
}

.auth-loader-steps {
  position: absolute;
  left: 28px;
  right: 28px;
  bottom: 32px;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.auth-loader-step {
  height: 4px;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.16);
}

.auth-loader-step.active {
  background: var(--se);
}

.auth-loader-content {
  min-height: 320px;
  display: grid;
  align-content: center;
  justify-items: start;
  padding: 42px;
}

.auth-loader-mark {
  position: relative;
  width: 66px;
  height: 66px;
  display: grid;
  place-items: center;
  border-radius: 22px;
  background: var(--se-tint);
  box-shadow: 0 0 0 10px rgb(var(--se-rgb) / 0.08);
}

.auth-loader-mark::before {
  content: "";
  position: absolute;
  inset: 12px;
  border: 3px solid var(--se);
  border-top-color: transparent;
  border-radius: 999px;
  animation: auth-loader-spin 0.9s linear infinite;
}

.auth-loader-mark::after {
  content: "";
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: var(--se);
}

.auth-loader-mark span {
  position: absolute;
  inset: 5px;
  border: 1px solid rgb(var(--se-rgb) / 0.22);
  border-radius: 26px;
}

.auth-loader-kicker {
  margin-top: 28px;
  color: var(--text-brand);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.auth-loader-title {
  max-width: 440px;
  margin-top: 10px;
  font-family: var(--serif);
  font-weight: 600;
  letter-spacing: -0.03em;
  font-size: clamp(34px, 5vw, 52px);
  line-height: 1.1;
  color: var(--ink);
}

.auth-loader-copy {
  max-width: 410px;
  margin-top: 14px;
  color: var(--muted);
  font-size: 17px;
  line-height: 1.65;
}

.auth-loader-progress {
  position: relative;
  width: min(360px, 100%);
  height: 6px;
  margin-top: 26px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--chalk);
}

.auth-loader-progress span {
  position: absolute;
  inset: 0;
  width: 58%;
  transform-origin: left center;
  border-radius: inherit;
  background: linear-gradient(90deg, transparent, var(--se), var(--se-dark), transparent);
  animation: auth-loader-sweep 1.1s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
}

.steps {
  display: flex;
  align-items: center;
  gap: 6px;
}

.step {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-2);
  background: var(--chalk);
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
}

.step.active {
  background: var(--ink);
  border-color: var(--ink);
  color: #fff;
}

.step.done {
  background: var(--se-dark);
  border-color: var(--se-dark);
  color: #fff;
}

.step-bar {
  width: 44px;
  height: 2px;
  background: var(--border-2);
}

.step-bar.done {
  background: var(--se);
}

.urgent-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 20px;
  border-bottom: 1px solid color-mix(in srgb, var(--red) 20%, var(--surface));
  background: linear-gradient(90deg, var(--red-tint) 0%, var(--amber-tint) 100%);
  color: var(--red);
}

.match-score {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
}

.match-score.high {
  background: var(--se-tint);
  color: var(--se-dark);
  border: 1.5px solid var(--se-tint-2);
}

.match-score.mid {
  background: var(--amber-tint);
  color: var(--amber);
  border: 1.5px solid color-mix(in srgb, var(--amber) 25%, var(--surface));
}

.match-score.low {
  background: var(--chalk);
  color: var(--muted);
  border: 1.5px solid var(--border-2);
}

.verify-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--green) 20%, var(--surface));
  background: var(--green-tint);
  color: var(--green);
  font-size: 10px;
  font-weight: 700;
}

.tbl {
  width: 100%;
  border-collapse: collapse;
}

.tbl th,
.tbl td {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  text-align: left;
}

.tbl th {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  background: var(--chalk);
}

.kanban {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.kanban-col {
  min-height: 300px;
  padding: 12px;
  border-radius: var(--radius-lg);
  border: 0.5px solid var(--border);
  background: var(--chalk);
}

.kanban-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
  margin-bottom: 10px;
}

.kanban-card {
  margin-bottom: 8px;
  padding: 10px 12px;
  border-radius: var(--radius);
  border: 0.5px solid var(--border);
  background: var(--surface);
  cursor: pointer;
}

.msg-list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
  transition: background-color 160ms ease;
}

.msg-list-item.active,
.msg-list-item:hover {
  background: var(--se-tint);
}

.msg-bubble {
  max-width: 70%;
  padding: 12px 16px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.msg-bubble.in {
  background: var(--chalk);
  border-top-left-radius: 4px;
}

.msg-bubble.out {
  background: var(--se-dark);
  color: #fff;
  margin-left: auto;
  border-top-right-radius: 4px;
}

.toast-stack {
  position: fixed;
  top: max(16px, calc(env(safe-area-inset-top) + 12px));
  right: max(16px, calc(env(safe-area-inset-right) + 12px));
  width: min(360px, calc(100vw - 32px));
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
  z-index: 120;
}

.toast {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  min-height: 52px;
  overflow: hidden;
  padding: 11px 38px 12px 12px;
  border-radius: var(--radius-lg);
  border: 1px solid rgba(255, 255, 255, 0.12);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
    rgba(10, 10, 10, 0.94);
  color: #fff;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.32), 0 8px 24px rgba(0, 0, 0, 0.22);
  pointer-events: auto;
  transform-origin: top right;
  animation: toast-enter 260ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  backdrop-filter: blur(18px);
}

.toast-leaving {
  pointer-events: none;
  animation: toast-exit 180ms cubic-bezier(0.4, 0, 1, 1) both;
}

.toast-danger {
  border-color: rgba(225, 29, 72, 0.38);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.34), 0 0 0 1px rgba(225, 29, 72, 0.16);
}

.toast-success {
  border-color: rgb(var(--se-rgb) / 0.36);
}

.toast-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  margin-top: 1px;
  background: rgb(var(--se-rgb) / 0.18);
  color: var(--se-tint-2);
}

.toast-danger .toast-icon {
  background: rgba(225, 29, 72, 0.18);
  color: #fecdd3;
}

.toast-copy {
  min-width: 0;
  flex: 1 1 auto;
}

.toast-title {
  font-size: 13.5px;
  font-weight: 700;
  line-height: 1.25;
}

.toast-message {
  margin-top: 2px;
  color: rgba(255, 255, 255, 0.76);
  font-size: 12.5px;
  line-height: 1.4;
}

.toast-close {
  position: absolute;
  top: 8px;
  right: 8px;
  display: inline-flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: rgba(255, 255, 255, 0.64);
  cursor: pointer;
  transition: background 160ms ease, color 160ms ease, transform 160ms ease;
}

.toast-close:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.toast-close:active {
  transform: scale(0.94);
}

.toast-close:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.78);
  outline-offset: 2px;
}

.toast-progress {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 2px;
  background: rgba(255, 255, 255, 0.36);
  transform-origin: left center;
  animation: toast-progress linear forwards;
}

.toast-danger .toast-progress {
  background: rgba(254, 205, 211, 0.7);
}

.toast-success .toast-progress {
  background: var(--se-tint-2);
}

@keyframes toast-enter {
  from {
    opacity: 0;
    transform: translateX(24px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

@keyframes toast-exit {
  from {
    opacity: 1;
    transform: translateX(0) scale(1);
  }

  to {
    opacity: 0;
    transform: translateX(24px) scale(0.98);
  }
}

@keyframes toast-progress {
  from {
    transform: scaleX(1);
  }

  to {
    transform: scaleX(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .toast,
  .toast-leaving,
  .toast-progress {
    animation: none;
  }
}

.modal-back {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(10, 10, 10, 0.4);
  cursor: pointer;
}

.modal {
  width: 100%;
  max-width: 560px;
  max-height: 90vh;
  overflow: auto;
  border-radius: var(--radius-xl);
  cursor: default;
  background: var(--surface);
  box-shadow: var(--shadow-lg);
}

.tweaks-panel {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 70;
  width: 260px;
  padding: 16px;
  border-radius: var(--radius-lg);
  border: 0.5px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
}

.ico {
  width: 16px;
  height: 16px;
  stroke: currentColor;
  stroke-width: 1.6;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  flex-shrink: 0;
}

.stars {
  color: #f59e0b;
  letter-spacing: 1px;
}

@keyframes route-loader-run {
  0% {
    transform: translateX(-55%) scaleX(0.22);
  }

  45% {
    transform: translateX(25%) scaleX(0.5);
  }

  100% {
    transform: translateX(160%) scaleX(0.18);
  }
}

@keyframes route-loader-pulse {
  0%,
  100% {
    opacity: 0.55;
    transform: scale(0.86);
  }

  50% {
    opacity: 1;
    transform: scale(1);
  }
}

.route-loader {
  pointer-events: none;
  position: fixed;
  inset: 0;
  z-index: 9999;
}

.route-loader-bar {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 3px;
  overflow: hidden;
  background: rgb(var(--se-rgb) / 0.12);
}

.route-loader-bar::before {
  content: "";
  position: absolute;
  inset: 0;
  width: 62%;
  transform-origin: left center;
  background: linear-gradient(90deg, transparent, var(--se), var(--se-dark), transparent);
  animation: route-loader-run 1s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
}

.route-loader-chip {
  position: absolute;
  left: 50%;
  top: 18px;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  transform: translateX(-50%);
  border: 1px solid var(--se-tint-2);
  border-radius: 999px;
  background: rgb(255 255 255 / 0.92);
  box-shadow: var(--shadow-sm);
  color: var(--ink);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  padding: 8px 12px;
  backdrop-filter: blur(12px);
}

.route-loader-mark {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: var(--se);
  box-shadow: 0 0 0 5px rgb(var(--se-rgb) / 0.12);
  animation: route-loader-pulse 0.9s ease-in-out infinite;
}

.two-col {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 24px;
}

.input::placeholder,
.textarea::placeholder {
  color: var(--muted);
  opacity: 1;
}

.input:disabled,
.select:disabled,
.textarea:disabled {
  background: var(--chalk);
  color: var(--muted);
  cursor: not-allowed;
}

.input[aria-invalid="true"],
.select[aria-invalid="true"],
.textarea[aria-invalid="true"] {
  border-color: var(--red);
}

.card.cursor-pointer:hover,
a.card:hover,
button.card:hover {
  border-color: var(--border-2);
  box-shadow: var(--shadow);
}

.sidebar-panel {
  align-self: start;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow);
}

.sidebar-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.sidebar-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
}

.sidebar-panel .section-title {
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}

.app-search {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--chalk);
  color: var(--muted);
}

.app-search:focus-within {
  border-color: var(--se);
  box-shadow: 0 0 0 3px rgb(var(--se-rgb) / 0.1);
}

.app-search input {
  min-width: 0;
  width: 132px;
  font-size: 13px;
  color: var(--ink);
  outline: none;
}

.msg-list-item.active {
  box-shadow: inset 3px 0 0 var(--se);
}

.msg-list-item:last-child,
.tbl tbody tr:last-child td {
  border-bottom: 0;
}

.tbl td {
  font-size: 14px;
  line-height: 1.6;
}

.tbl tbody tr:hover {
  background: var(--surface-2);
}

.public-page h1,
.public-page h2 {
  letter-spacing: -0.035em;
}

.public-page .card {
  box-shadow: var(--shadow);
}

@media (max-width: 1280px) {
  .app-nav {
    flex-wrap: wrap;
    gap: 12px 20px;
  }

  .app-nav-links {
    order: 3;
    width: 100%;
    overflow-x: auto;
    padding-bottom: 2px;
    scrollbar-width: thin;
  }
}

.three-panel {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 24px;
}

.messaging-page {
  max-width: 1800px;
}

.messaging-layout {
  display: grid;
  grid-template-columns: 280px minmax(480px, 1fr) 340px;
  gap: 20px;
  align-items: stretch;
}

.messaging-inbox-layout {
  display: grid;
  grid-template-columns: minmax(340px, 460px) minmax(0, 1fr);
  gap: 20px;
  align-items: stretch;
}

.messaging-conversations,
.messaging-thread,
.messaging-context,
.messaging-inbox-overview {
  height: clamp(620px, calc(100dvh - 190px), 900px);
}

.messaging-conversations,
.messaging-context {
  align-self: stretch;
}

.messaging-conversations.is-inbox .msg-list-item {
  padding-block: 16px;
}

.messaging-inbox-overview {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: clamp(32px, 6vw, 72px);
  text-align: center;
}

.messaging-inbox-illustration {
  display: grid;
  width: 72px;
  height: 72px;
  margin-bottom: 22px;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: 22px;
  background: var(--chalk);
  color: var(--brand);
  box-shadow: 0 12px 30px color-mix(in srgb, var(--brand) 12%, transparent);
}

.messaging-back-button {
  display: none;
}

.context-label {
  color: var(--muted);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  line-height: 1.2;
  text-transform: uppercase;
}

@media (max-width: 1280px) {
  .messaging-layout {
    grid-template-columns: 250px minmax(420px, 1fr) 300px;
    gap: 16px;
  }

  .messaging-inbox-layout {
    grid-template-columns: minmax(300px, 400px) minmax(0, 1fr);
    gap: 16px;
  }
}

@media (max-width: 1050px) {
  .messaging-layout {
    grid-template-columns: 260px minmax(0, 1fr);
  }

  .messaging-inbox-layout {
    grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
  }

  .messaging-context {
    grid-column: 2;
    height: auto;
    max-height: none;
  }
}

@media (max-width: 1100px) {
  .grid-4,
  .grid-3 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .kanban,
  .two-col,
  .three-panel {
    grid-template-columns: 1fr;
  }

  .page-title-row,
  .app-nav {
    flex-wrap: wrap;
  }
}

@media (max-width: 720px) {
  .messaging-layout,
  .messaging-inbox-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .messaging-inbox-overview {
    display: none;
  }

  .messaging-conversations {
    height: min(720px, calc(100dvh - 155px));
    max-height: none;
  }

  .messaging-layout.has-active .messaging-conversations {
    display: none;
  }

  .messaging-thread {
    height: min(680px, calc(100dvh - 120px));
    min-height: 560px;
  }

  .messaging-context {
    grid-column: auto;
  }

  .messaging-back-button {
    display: inline-flex;
  }

  .card-grid-loader {
    grid-template-columns: 1fr;
  }

  .auth-loader-screen {
    padding: 16px;
  }

  .auth-loader-shell {
    grid-template-columns: 1fr;
  }

  .auth-loader-rail {
    min-height: 128px;
    padding: 22px;
  }

  .auth-loader-rail-copy {
    display: none;
  }

  .auth-loader-steps {
    left: 22px;
    right: 22px;
    bottom: 22px;
  }

  .auth-loader-content {
    min-height: 310px;
    padding: 30px 24px;
  }

  .auth-loader-title {
    font-size: 38px;
  }

  .auth-loader-copy {
    font-size: 16px;
  }

  .page-loader-screen {
    padding: 16px;
  }

  .page-loader-panel {
    padding: 18px;
  }

  .page-loader-title {
    font-size: 24px;
  }

  .page-loader-head {
    align-items: flex-start;
  }

  .section-loader-row {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .skeleton-action {
    display: none;
  }

  .app-page {
    padding: 24px 16px 40px;
  }

  .card-pad,
  .card-pad-lg {
    padding: 20px;
  }

  .app-nav-right {
    gap: 4px;
  }

  .app-search input {
    width: 88px;
  }

  .msg-bubble {
    max-width: 90%;
  }

  .input,
  .select,
  .textarea {
    font-size: 16px;
  }

  .app-nav {
    height: auto;
    padding: 16px;
  }

  .app-nav-links {
    width: 100%;
    overflow-x: auto;
  }

  .toast-stack {
    left: 16px;
    right: 16px;
    top: max(12px, calc(env(safe-area-inset-top) + 10px));
    width: auto;
  }
}

@media (max-width: 639px) {
  .grid-2,
  .grid-3,
  .grid-4 {
    grid-template-columns: minmax(0, 1fr);
  }

  .urgent-banner {
    flex-wrap: wrap;
    padding: 16px;
  }

  .app-nav-right {
    flex-wrap: wrap;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
}

/* Quill ships unlayered styles; keep the editor consistent with the app font. */
.role-description-editor .ql-container,
.role-description-editor .ql-toolbar,
.role-description-editor .ql-picker {
  font-family: var(--sans);
}

.role-description-editor .ql-toolbar {
  padding: 12px;
}

.role-description-editor .ql-editor {
  min-height: 220px;
  padding: 16px;
  line-height: 1.7;
}

/* Application proposals use the same typography as the product with a focused,
   restrained formatting palette. */
.proposal-editor .ql-container,
.proposal-editor .ql-toolbar,
.proposal-editor .ql-picker {
  font-family: var(--sans);
}

.proposal-editor .ql-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 11px 12px;
}

.proposal-editor .ql-formats {
  align-items: center;
  display: inline-flex;
  margin-right: 6px;
}

.proposal-editor .ql-editor {
  min-height: 250px;
  padding: 18px;
  line-height: 1.75;
}

.proposal-editor .ql-editor p,
.proposal-editor .ql-editor ul,
.proposal-editor .ql-editor ol {
  margin-bottom: 0.65rem;
}

.proposal-editor .ql-picker.ql-font {
  width: 138px;
}

.proposal-editor .ql-picker.ql-size {
  width: 76px;
}

.proposal-editor .ql-font .ql-picker-label::before,
.proposal-editor .ql-font .ql-picker-item::before {
  content: "SupplyEd Sans";
}

.proposal-editor .ql-font .ql-picker-label[data-value="Arial"]::before,
.proposal-editor .ql-font .ql-picker-item[data-value="Arial"]::before {
  content: "Arial";
  font-family: Arial, sans-serif;
}

.proposal-editor .ql-font .ql-picker-label[data-value="Georgia"]::before,
.proposal-editor .ql-font .ql-picker-item[data-value="Georgia"]::before {
  content: "Georgia";
  font-family: Georgia, serif;
}

.proposal-editor .ql-font .ql-picker-label[data-value="Times New Roman"]::before,
.proposal-editor .ql-font .ql-picker-item[data-value="Times New Roman"]::before {
  content: "Times New Roman";
  font-family: "Times New Roman", serif;
}

.editor-link-action {
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 8px;
  display: inline-flex;
  font-size: 12px;
  font-weight: 700;
  height: 40px;
  justify-content: center;
  padding: 0 12px;
  transition: border-color 160ms ease, background 160ms ease, color 160ms ease;
}

.editor-link-action:hover {
  background: var(--chalk);
  border-color: var(--border-2);
}

.editor-link-action-primary {
  background: var(--se-dark);
  border-color: var(--se-dark);
  color: white;
}

.editor-link-action-primary:hover {
  background: var(--se-dark);
  border-color: var(--se-dark);
}

.proposal-content > * + * {
  margin-top: 0.65rem;
}

.proposal-content ul,
.proposal-content ol {
  padding-left: 1.35rem;
}

.proposal-content ul {
  list-style: disc;
}

.proposal-content ol {
  list-style: decimal;
}

.proposal-content li + li {
  margin-top: 0.25rem;
}

.proposal-content a {
  color: var(--text-brand);
  font-weight: 650;
  text-decoration: underline;
  text-decoration-color: rgb(var(--se-rgb) / 0.35);
  text-underline-offset: 3px;
}

@media (max-width: 640px) {
  .proposal-editor .ql-toolbar {
    gap: 7px 2px;
  }

  .proposal-editor .ql-formats {
    margin-right: 2px;
  }

  .proposal-editor .ql-editor {
    min-height: 220px;
  }
}

/* Brand fills retain the accent; small brand text uses its readable dark tone. */
@layer utilities {
  .text-brand { color: var(--text-brand); }
}
```

### UI source: components/styles/foundation.css

```css
/* Shared SupplyED design system. Component rules remain overridable by utilities. */
@layer components {
  .skip-link { position: fixed; top: 12px; left: 12px; z-index: 100; transform: translateY(-180%); padding: 12px 18px; border-radius: 8px; background: var(--ink); color: white; }
  .skip-link:focus { transform: none; }
  .workspace-frame { --sidebar-width: 232px; display: grid; grid-template-columns: var(--sidebar-width) minmax(0, 1fr); min-height: 100dvh; }
  .workspace-frame.is-collapsed { --sidebar-width: 80px; }
  .workspace-sidebar { position: sticky; top: 0; display: flex; flex-direction: column; align-self: start; height: 100dvh; padding: 0 14px 16px; border-right: 1px solid var(--border); background: var(--surface); overflow-y: auto; scrollbar-width: thin; }
  .workspace-brand { min-height: 84px; display: flex; align-items: center; padding: 0 13px; }
  .workspace-brand-short { display: none; font-size: 17px; font-weight: 500; letter-spacing: -.06em; }
  .workspace-brand-short span { color: var(--se); font-weight: 750; }
  .workspace-role { display: flex; align-items: center; gap: 10px; margin: 0 0 27px; padding: 12px 10px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); }
  .workspace-role-mark { display: grid; place-items: center; flex-shrink: 0; width: 32px; height: 32px; border: 1px solid var(--border); border-radius: 8px; color: var(--se-dark); background: white; }
  .workspace-role strong { display: block; font-size: 12px; font-weight: 650; color: var(--graphite); }
  .workspace-role .workspace-nav-copy > span { display: block; margin-top: 2px; font-size: 10px; color: var(--muted); }
  .workspace-role.has-quick-action { margin-bottom: 12px; }
  .workspace-quick-action { display: flex; align-items: center; justify-content: center; gap: 9px; width: 100%; min-height: 44px; margin-bottom: 26px; padding: 11px 13px; border: 1px solid transparent; border-radius: 9px; background: var(--se-dark); color: white; font-size: 13px; font-weight: 650; box-shadow: var(--shadow-xs); transition: background 150ms ease, transform 150ms ease; }
  .workspace-quick-action:hover { background: color-mix(in srgb, var(--se-dark) 88%, black); }
  .workspace-quick-action:active { transform: translateY(1px); }
  .workspace-nav-label { padding: 0 13px; margin-bottom: 10px; font-size: 10px; font-weight: 650; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
  .workspace-navigation { display: grid; align-content: start; gap: 5px; }
  .workspace-nav-item { position: relative; display: flex; width: 100%; min-height: 43px; align-items: center; gap: 11px; padding: 11px 13px; border: 1px solid transparent; border-radius: 8px; color: var(--slate); font-size: 13px; font-weight: 500; text-align: left; transition: color 150ms ease, background 150ms ease; }
  .workspace-nav-item:hover { background: var(--chalk); color: var(--ink); }
  .workspace-nav-item.active { border-color: rgb(var(--se-rgb) / .1); background: var(--se-tint); color: var(--se-dark); font-weight: 650; }
  .workspace-nav-count { margin-left: auto; min-width: 20px; border-radius: 5px; background: var(--se-dark); padding: 0 5px; color: white; font-size: 10px; font-weight: 650; text-align: center; line-height: 19px; }
  .workspace-sidebar-bottom { display: grid; gap: 5px; margin-top: auto; padding-top: 40px; }
  .workspace-collapse { margin-top: 12px; padding-top: 15px; border-top: 1px solid var(--border); border-radius: 0; font-size: 11px; }
  .workspace-main, .workspace-content { min-width: 0; }
  .workspace-content:focus { outline: none; }
  .workspace-topbar { position: sticky; top: 0; z-index: 35; display: flex; min-height: 76px; align-items: center; justify-content: space-between; gap: 20px; padding: 12px 36px; border-bottom: 1px solid var(--border); background: var(--surface); }
  .workspace-breadcrumb { display: flex; min-width: 0; align-items: center; gap: 12px; color: var(--muted); font-size: 12px; white-space: nowrap; }
  .workspace-breadcrumb strong { overflow: hidden; color: var(--graphite); font-weight: 550; text-overflow: ellipsis; }
  .workspace-topbar-actions { display: flex; align-items: center; gap: 12px; }
  .workspace-menu-button { display: none; width: 40px; height: 40px; align-items: center; justify-content: center; border: 1px solid var(--border); border-radius: 9px; background: var(--surface); }
  .workspace-mobile-brand { display: none; }
  .workspace-topbar .app-search { min-height: 36px; padding: 7px 11px; background: var(--surface-2); border-radius: 8px; }
  .workspace-topbar .app-search input { width: 144px; font-size: 12px; }
  .workspace-topbar .notif-btn { border: 1px solid var(--border); border-radius: 9px; }
  .is-collapsed .workspace-brand { padding: 0; justify-content: center; }
  .is-collapsed .workspace-brand-full, .is-collapsed .workspace-nav-copy, .is-collapsed .workspace-nav-label { display: none; }
  .is-collapsed .workspace-brand-short { display: block; }
  .is-collapsed .workspace-role { justify-content: center; border: 0; padding: 8px 0; }
  .is-collapsed .workspace-nav-item { justify-content: center; padding-inline: 0; }
  .is-collapsed .workspace-quick-action { width: 44px; margin-inline: auto; padding-inline: 0; }
  .is-collapsed .workspace-nav-count { position: absolute; right: -2px; top: -3px; font-size: 9px; }
  .app-page { width: 100%; max-width: 1480px; padding: 36px clamp(20px, 3vw, 48px) 64px; }
  .page-head { position: relative; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 30px; }
  .page-head-title { font-size: clamp(26px, 2.5vw, 34px); line-height: 1.18; font-weight: 650; letter-spacing: -.045em; color: var(--ink); }
  .page-head-description { max-width: 720px; margin-top: 9px; color: var(--muted); font-size: 13px; line-height: 1.75; }
  .page-head-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .card { box-shadow: var(--shadow-xs); }
  .card-pad { padding: 24px; }
  .card-pad-lg { padding: 30px; }
  .metric-card { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 15px; min-height: 148px; padding: 22px 24px; }
  .metric-label { color: var(--slate); font-size: 12px; font-weight: 550; }
  .metric-value { font-size: clamp(28px, 2.7vw, 36px); font-weight: 600; line-height: 1.05; letter-spacing: -.04em; font-variant-numeric: tabular-nums; color: var(--ink); }
  .metric-context { width: 100%; margin-top: auto; padding-top: 12px; border-top: 1px solid var(--border); color: var(--se-dark); font-size: 11px; font-weight: 500; line-height: 1.6; }
  .ui-button:not(:disabled):active, .btn:not(:disabled):active { transform: translateY(1px); }
  .btn-primary { background: var(--se-dark); box-shadow: var(--shadow-xs); }
  .btn-primary:hover { background: color-mix(in srgb, var(--se-dark) 88%, black); }
  .status-tag { border-radius: 5px; font-size: 11px; font-weight: 550; box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 9%, transparent); }
  .input, .select, .textarea { border-color: var(--border-2); border-radius: var(--control-radius); min-height: var(--control-height); padding: var(--control-padding-y) var(--control-padding-x); box-shadow: var(--shadow-xs); }
  .input:hover:not(:disabled):not(:focus):not([aria-invalid="true"]), .select:hover:not(:disabled):not(:focus):not([aria-invalid="true"]), .textarea:hover:not(:disabled):not(:focus):not([aria-invalid="true"]) { border-color: color-mix(in srgb, var(--slate) 45%, var(--border)); }
  .form-field[data-invalid] :is(.input,.select,.textarea) { border-color: var(--red); }
  .form-field[data-invalid] :is(.input,.select,.textarea):focus { box-shadow: 0 0 0 3px color-mix(in srgb, var(--red) 12%, transparent); }
  .select { text-overflow: ellipsis; }
  .input[aria-invalid="true"]:focus, .select[aria-invalid="true"]:focus, .textarea[aria-invalid="true"]:focus { border-color: var(--red); box-shadow: 0 0 0 3px color-mix(in srgb, var(--red) 12%, transparent); }
  .tag-input:has([aria-invalid="true"]) { border-color: var(--red); }
  .phone-input-controls { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: 10px; }
  .phone-input-controls > .input { min-width: 0; }
  .phone-input-action { display: flex; align-items: center; min-height: var(--control-height); }
  .phone-input-action .ui-button { width: 100%; }
  .tag-input:has([aria-invalid="true"]):focus-within { box-shadow: 0 0 0 3px color-mix(in srgb, var(--red) 12%, transparent); }
  select.select { appearance: none; padding-right: 36px; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23647580' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-position: right 12px center; background-repeat: no-repeat; }
  .option-list [role="option"][aria-selected="true"] { color: var(--se-dark); background: var(--se-tint); }
  .option-list [role="option"]:focus-visible { outline-offset: -2px; }
  .tbl th { padding: 12px 20px; background: var(--surface-2); color: var(--slate); font-size: 11px; font-weight: 600; letter-spacing: .025em; white-space: nowrap; }
  .tbl td { padding: 17px 20px; font-size: 13px; }
  .tbl tbody tr { transition: background 150ms ease; }
  .sidebar-panel { box-shadow: var(--shadow-xs); }
  .sidebar-heading { font-size: 13px; }
  .modal-overlay { background: var(--overlay); backdrop-filter: blur(4px); animation: surface-fade var(--duration-ui) var(--ease-ui); }
  .modal-panel { outline: none; box-shadow: 0 32px 90px rgb(15 23 35 / .2); animation: surface-enter 180ms ease; overscroll-behavior: contain; }
  .modal-panel :is(h2,h3) { letter-spacing: -.025em; }
  .notification-panel { position: absolute; right: 0; top: 48px; z-index: 50; width: min(400px, calc(100vw - 32px)); }
  .notification-panel, [role="menu"] { animation: surface-enter 150ms ease; }
  .attachment-preview-card { transition: box-shadow 160ms ease, border-color 160ms ease; }
  .attachment-preview-card:hover { box-shadow: var(--shadow); }
  .attachment-preview-dialog[open] { animation: surface-enter 180ms ease; }
  .toast { border-radius: 12px; box-shadow: 0 12px 40px rgb(16 24 40 / .12); }
  .toast-icon { width: 30px; height: 30px; flex-shrink: 0; }
  .toast-title { font-size: 13px; }
  .toast-message { font-size: 12px; line-height: 1.65; }
  .page-loader-screen { background: var(--chalk); }
  .page-loader-panel { background: var(--surface); box-shadow: var(--shadow); padding: 28px; }
  .page-loader-brand-mark { background: var(--se-dark); box-shadow: none; }
  .page-loader-title { font-size: 24px; }
  .page-loader-copy { font-size: 13px; }
  .skeleton { background: var(--border); border-radius: 5px; }
  .skeleton-dot { border-radius: 50%; }
  .section-loader-row { min-height: 76px; padding: 16px; }
  .card-loader { padding: 24px; min-height: 176px; }
  @keyframes surface-fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes surface-enter { from { opacity: 0; transform: translateY(8px) scale(.99); } to { opacity: 1; transform: none; } }
  @media (min-width: 1024px) and (max-width: 1240px) {
    .workspace-frame { --sidebar-width: 212px; }
    .workspace-topbar { padding-inline: 24px; }
    .workspace-topbar .app-search { display: none; }
  }
  @media (max-width: 1023px) {
    .workspace-frame, .workspace-frame.is-collapsed { display: flex; flex-direction: column; }
    .workspace-sidebar { display: none; position: relative; top: auto; width: 100%; height: auto; padding: 18px 20px; border-right: 0; border-bottom: 1px solid var(--border); order: 0; }
    .workspace-sidebar.is-open { display: flex; }
    .workspace-brand, .workspace-role, .workspace-nav-label, .workspace-collapse { display: none; }
    .workspace-navigation { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .workspace-sidebar-bottom { grid-template-columns: repeat(2, minmax(0, 1fr)); padding-top: 12px; margin-top: 12px; border-top: 1px solid var(--border); }
    .workspace-main { display: contents; }
    .workspace-topbar { order: -1; min-height: 68px; padding: 12px 20px; gap: 12px; }
    .workspace-content { order: 1; }
    .workspace-menu-button { display: flex; flex-shrink: 0; }
    .workspace-breadcrumb { margin-right: auto; gap: 8px; }
    .workspace-breadcrumb > span { display: none; }
    .workspace-breadcrumb > svg { display: none; }
    .workspace-topbar-actions { gap: 8px; }
    .workspace-topbar .app-search { display: none; }
    .is-collapsed .workspace-nav-copy { display: inline; }
    .is-collapsed .workspace-nav-item { justify-content: flex-start; padding-inline: 13px; }
    .workspace-quick-action, .is-collapsed .workspace-quick-action { width: 100%; margin: 0 0 16px; padding-inline: 13px; }
    .is-collapsed .workspace-nav-count { position: static; }
    .app-page { padding: 28px 24px 48px; }
  }
  @media (max-width: 639px) {
    .phone-verification-action { --phone-control-height: 48px; }
    .phone-input-controls { grid-template-columns: minmax(0, 1fr); }
    .workspace-mobile-brand { display: inline-flex; margin-right: auto; }
    .workspace-breadcrumb { display: none; }
    .notification-panel { position: fixed; top: 76px; left: 16px; right: 16px; width: auto; }
    .workspace-topbar { padding-inline: 16px; gap: 10px; }
    .workspace-breadcrumb { font-size: 12px; }
    .workspace-topbar-actions { gap: 6px; }
    .workspace-navigation { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .workspace-sidebar { padding: 14px; }
    .workspace-nav-item { font-size: 12px; gap: 8px; }
    .app-page { padding: 25px 16px 40px; }
    .page-head { gap: 18px; margin-bottom: 24px; }
    .page-head-title { font-size: 27px; }
    .page-head-actions { width: 100%; }
    .card-pad, .card-pad-lg { padding: 20px; }
    .metric-card { padding: 20px; min-height: 130px; }
    .input, .select, .textarea { font-size: 16px; }
    .modal-overlay { padding: 12px; }
    .page-loader-panel { padding: 20px; }
  }
}
```

### UI source: components/styles/selectors.css

```css
/* Single, multiple and searchable controls share the existing form tokens. */
@layer components {
  .option-dropdown { position: relative; min-width: 0; }
  .option-trigger { display: flex; width: 100%; align-items: center; gap: 10px; text-align: left; cursor: pointer; background-color: var(--surface); }
  .option-trigger[data-placeholder] { color: var(--muted); }
  .option-summary { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .option-count { display: inline-flex; flex-shrink: 0; align-items: center; justify-content: center; min-width: 22px; padding: 1px 6px; border-radius: var(--radius-sm); background: var(--se-tint); color: var(--se-dark); font-size: 11px; font-weight: 650; line-height: 20px; }
  .option-chevron { flex-shrink: 0; color: var(--muted); transition: transform 150ms ease; }
  .option-trigger:not(:disabled)[aria-expanded="true"], .option-trigger:not(:disabled):not([data-placeholder]) { border-color: var(--se); background-color: var(--se-tint); color: var(--ink); }
  .option-trigger:not(:disabled)[aria-expanded="true"] .option-chevron, .option-trigger:not(:disabled):not([data-placeholder]) .option-chevron { color: var(--se-dark); }
  .option-dropdown .option-trigger[aria-invalid="true"] { border-color: var(--red); }
  .option-native-control { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
  .option-validation { margin-top: 8px; color: var(--red); font-size: 12px; line-height: 1.6; }
  .option-menu { position: fixed; inset: auto; z-index: 80; display: flex; flex-direction: column; margin: 0; padding: 0; overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius); color: var(--ink); background: var(--surface); box-shadow: var(--shadow-lg); font-family: var(--sans); }
  .option-menu::backdrop { background: transparent; pointer-events: none; }
  .option-list { min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; padding: 6px; }
  .option-item { display: flex; width: 100%; min-height: 44px; align-items: center; gap: 10px; border: 1px solid transparent; border-radius: var(--radius-sm); padding: 9px 11px; color: var(--slate); text-align: left; font-size: 13px; line-height: 1.5; transition: color 150ms ease, background 150ms ease; }
  .option-item:hover { background: var(--se-tint); color: var(--se-dark); }
  .option-item[aria-selected="true"] { background: var(--se-tint); color: var(--se-dark); }
  .option-item[data-active] { outline: 2px solid var(--se); outline-offset: -2px; }
  .option-indicator { display: inline-flex; width: 16px; height: 16px; flex-shrink: 0; align-items: center; justify-content: center; border: 1px solid var(--border-2); border-radius: 50%; background: var(--surface); }
  .option-indicator[data-multiple] { border-radius: var(--radius-check); }
  .option-item[aria-selected="true"] .option-indicator { border-color: var(--se-dark); background: var(--se-dark); color: var(--surface); }
  .option-copy { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  .option-copy > span { display: block; }
  .option-description { margin-top: 2px; color: var(--muted); font-size: 12px; line-height: 1.6; }
  .option-search { display: flex; flex-shrink: 0; align-items: center; gap: 9px; padding: 10px 13px; border-bottom: 1px solid var(--border); color: var(--muted); }
  .option-search:focus-within { box-shadow: inset 0 -2px var(--se); }
  .option-search input { min-width: 0; width: 100%; min-height: 28px; border: 0; background: transparent; color: var(--ink); font-size: 13px; outline: none; }
  .option-search input::placeholder { color: var(--muted); }
  .option-empty { padding: 16px 12px; color: var(--muted); font-size: 13px; }
  .option-footer { flex-shrink: 0; padding: 6px; border-top: 1px solid var(--border); }
  .option-clear { width: 100%; min-height: 40px; border-radius: var(--radius-sm); padding: 8px 11px; color: var(--se-dark); text-align: left; font-size: 12px; font-weight: 600; }
  .option-clear:hover { background: var(--se-tint); }
  .option-clear:focus-visible { outline-offset: -2px; }
  @media (max-width: 639px) {
    .option-search input { font-size: 16px; }
    .option-item { font-size: 14px; }
  }
}
```

### UI source: components/styles/proposal.css

```css
@layer components {
  .proposal-dialog { display: flex; min-width: 0; max-height: min(calc(90dvh - 2px), 880px); flex-direction: column; overflow: hidden; border-radius: inherit; background: var(--surface); }
  .proposal-dialog-header { display: flex; flex-shrink: 0; align-items: flex-start; gap: 16px; padding: 28px 32px 24px; border-bottom: 1px solid var(--border); background: var(--surface-2); }
  .proposal-heading-icon { display: grid; width: 47px; height: 47px; flex: 0 0 auto; place-items: center; border: 1px solid var(--se-tint-2); border-radius: var(--radius-lg); background: var(--se-tint); color: var(--se-dark); }
  .proposal-heading-copy { min-width: 0; flex: 1; }
  .proposal-eyebrow { margin: 0 0 5px; color: var(--se-dark); font-size: 10px; font-weight: 700; letter-spacing: .12em; line-height: 1.4; text-transform: uppercase; }
  .proposal-heading-copy h2 { margin: 0; color: var(--ink); font-size: 28px; font-weight: 650; letter-spacing: -.045em; line-height: 1.25; }
  .proposal-close { display: grid; width: 36px; height: 36px; flex: 0 0 auto; place-items: center; border: 1px solid var(--border); border-radius: 9px; background: var(--surface); color: var(--muted); transition: background-color 150ms ease, color 150ms ease; }
  .proposal-close:hover { background: var(--chalk); color: var(--ink); }
  .proposal-close:disabled { opacity: .5; cursor: not-allowed; }
  .proposal-role-context { display: flex; flex-shrink: 0; align-items: center; gap: 13px; padding: 18px 32px; border-bottom: 1px solid var(--border); }
  .proposal-role-icon { display: grid; width: 38px; height: 38px; flex: 0 0 auto; place-items: center; border: 1px solid var(--border); border-radius: 9px; background: var(--chalk); color: var(--slate); }
  .proposal-role-context > div { min-width: 0; flex: 1; }
  .proposal-role-context strong { display: block; color: var(--ink); font-size: 15px; font-weight: 650; line-height: 1.5; overflow-wrap: anywhere; }
  .proposal-role-context small { display: block; margin-top: 2px; color: var(--muted); font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
  .proposal-dialog-body { min-height: 0; flex: 1 1 auto; overflow-y: auto; overscroll-behavior: contain; padding: 25px 32px 23px; scrollbar-gutter: stable; }
  .proposal-intro { max-width: 650px; margin: 0 0 22px; color: var(--slate); font-size: 14px; line-height: 1.7; }
  .proposal-dialog-body .form-field { margin-bottom: 0; }
  .proposal-dialog-body .field-label { margin-bottom: 10px; color: var(--graphite); font-size: 13px; font-weight: 650; }
  .proposal-editor-surface { min-height: 220px; }
  .proposal-editor-footer { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding-top: 12px; }
  .proposal-format-note { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.6; }
  .proposal-format-note.is-error { color: var(--red); font-weight: 550; }
  .proposal-character-count { flex-shrink: 0; padding: 3px 8px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--chalk); color: var(--muted); font-size: 11px; line-height: 1.6; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .proposal-character-count strong { color: var(--graphite); font-weight: 650; }
  .proposal-character-count.is-error { border-color: var(--red); background: var(--red-tint); color: var(--red); }
  .proposal-dialog-actions { display: flex; flex-shrink: 0; align-items: center; justify-content: space-between; gap: 24px; padding: 21px 32px; border-top: 1px solid var(--border); background: var(--surface-2); }
  .proposal-submit-note { display: flex; max-width: 360px; align-items: flex-start; gap: 9px; margin: 0; color: var(--muted); font-size: 12px; line-height: 1.6; }
  .proposal-submit-note > svg { flex: 0 0 auto; margin-top: 2px; color: var(--se-dark); }
  .proposal-action-buttons { display: flex; flex-shrink: 0; gap: 10px; }
  .proposal-link-panel { padding: 17px 20px; border-bottom: 1px solid var(--border); background: var(--se-tint); }
  .proposal-link-title { margin: 0 0 12px; color: var(--ink); font-size: 13px; font-weight: 650; }
  .proposal-link-panel .editor-link-action { height: 40px; background: var(--surface); font-weight: 600; }
  .proposal-link-panel .editor-link-action-primary { background: var(--se-dark); color: #fff; }

  @media (max-width: 640px) {
    .proposal-dialog-header { gap: 12px; padding: 19px 20px 17px; }
    .proposal-heading-icon { display: none; }
    .proposal-heading-copy h2 { font-size: clamp(20px, 5.6vw, 23px); }
    .proposal-eyebrow { font-size: 9px; }
    .proposal-close { width: 32px; height: 32px; }
    .proposal-role-context { gap: 11px; padding: 13px 20px; }
    .proposal-role-context > .tag { display: none; }
    .proposal-role-context strong { font-size: 14px; }
    .proposal-role-context small { font-size: 11px; }
    .proposal-dialog-body { padding: 20px; }
    .proposal-intro { margin-bottom: 20px; font-size: 13px; line-height: 1.65; }
    .proposal-editor-footer { flex-wrap: wrap; align-items: center; gap: 8px; }
    .proposal-format-note { flex-basis: 100%; font-size: 11px; }
    .proposal-character-count { margin-left: auto; }
    .proposal-dialog-actions { flex-direction: column; align-items: stretch; gap: 10px; padding: 14px 20px; }
    .proposal-submit-note { max-width: none; font-size: 11px; }
    .proposal-action-buttons { display: grid; grid-template-columns: minmax(0, .75fr) minmax(0, 1.25fr); }
    .proposal-action-buttons .ui-button { min-width: 0; padding-inline: 12px; white-space: normal; }
    .proposal-action-buttons .ui-button > span { white-space: normal; }
    .proposal-link-panel { padding: 16px; }
  }
}

/* Quill ships unlayered Snow rules. These narrowly scoped overrides deliberately
   sit outside a layer so native picker dimensions cannot win by import order. */
.proposal-editor {
  min-width: 0;
  border: 1px solid var(--border-2);
  border-radius: var(--radius-lg);
  background: var(--surface);
  transition: border-color 150ms ease, box-shadow 150ms ease;
}
.proposal-editor:focus-within { border-color: var(--se); box-shadow: 0 0 0 3px rgb(var(--se-rgb) / .1); }
.proposal-editor[data-invalid="true"] { border-color: var(--red); }
.editor-appearance-controls { display: grid; grid-template-columns: minmax(160px, 1.5fr) minmax(100px, 1fr) minmax(130px, 1fr); gap: 12px; padding: 12px; border-bottom: 1px solid var(--border); border-radius: var(--radius-lg) var(--radius-lg) 0 0; background: var(--surface-2); }
.editor-appearance-controls > div { min-width: 0; }
.proposal-editor > [role="toolbar"] { min-height: 55px; }
.proposal-editor .ql-toolbar.ql-snow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 0;
  padding: 10px 12px;
  border: 0;
  border-bottom: 1px solid var(--border);
  border-radius: 11px 11px 0 0;
  background: var(--surface-2);
  font-family: var(--sans);
}
.proposal-editor .ql-toolbar.ql-snow::after, .proposal-editor .ql-formats::after { display: none; }
.proposal-editor .ql-toolbar.ql-snow .ql-formats { display: inline-flex; flex: 0 0 auto; align-items: center; gap: 2px; margin: 0; padding: 0 9px; border-right: 1px solid var(--border); }
.proposal-editor .ql-toolbar.ql-snow .ql-formats:first-child { padding-left: 0; }
.proposal-editor .ql-toolbar.ql-snow .ql-formats:last-child { padding-right: 0; border-right: 0; }
.proposal-editor .ql-toolbar.ql-snow button { display: grid; float: none; width: 34px; height: 34px; padding: 8px; place-items: center; border-radius: var(--radius-sm); }
.proposal-editor .ql-toolbar.ql-snow button > svg { float: none; width: 18px; height: 18px; }
.proposal-editor .ql-toolbar.ql-snow button:hover, .proposal-editor .ql-toolbar.ql-snow button.ql-active { background: var(--se-tint); color: var(--se-dark); }
.proposal-editor .ql-toolbar.ql-snow button.ql-active .ql-stroke, .proposal-editor .ql-toolbar.ql-snow button:hover .ql-stroke { stroke: var(--se-dark); }
.proposal-editor .ql-toolbar.ql-snow button.ql-active .ql-fill, .proposal-editor .ql-toolbar.ql-snow button:hover .ql-fill { fill: var(--se-dark); }
.proposal-editor .ql-toolbar.ql-snow button:focus-visible, .proposal-editor .ql-picker-label:focus-visible, .proposal-editor .ql-picker-item:focus-visible { outline: 2px solid var(--se); outline-offset: 2px; }
.proposal-editor .ql-toolbar.ql-snow button:focus { color: var(--se-dark); }
.proposal-editor .ql-toolbar.ql-snow button:focus .ql-stroke { stroke: var(--se-dark); }
.proposal-editor .ql-toolbar.ql-snow button:focus .ql-fill { fill: var(--se-dark); }
.proposal-editor .ql-snow .ql-tooltip { border-color: var(--border); border-radius: var(--radius); background: var(--surface); color: var(--ink); box-shadow: var(--shadow-lg); }
.proposal-editor .ql-snow .ql-tooltip a { color: var(--se-dark); }
.proposal-editor .ql-snow .ql-picker { flex: 0 0 auto; float: none; height: 34px; color: var(--graphite); font-family: var(--sans); font-size: 12px; font-weight: 550; line-height: 1; }
.proposal-editor .ql-snow .ql-picker.ql-font { width: 159px; }
.proposal-editor .ql-snow .ql-picker.ql-size { width: 62px; }
.proposal-editor .ql-snow .ql-picker.ql-color { width: 34px; }
.proposal-editor .ql-snow .ql-picker-label { display: flex; align-items: center; width: 100%; padding: 0 25px 0 10px; border: 1px solid transparent; border-radius: var(--radius-sm); white-space: nowrap; }
.proposal-editor .ql-snow .ql-picker.ql-font .ql-picker-label, .proposal-editor .ql-snow .ql-picker.ql-size .ql-picker-label { border-color: var(--border); background: var(--surface); }
.proposal-editor .ql-snow .ql-picker-label::before { display: block; overflow: hidden; line-height: 1.4; text-overflow: ellipsis; white-space: nowrap; }
.proposal-editor .ql-snow .ql-picker.ql-color .ql-picker-label { justify-content: center; padding: 7px; }
.proposal-editor .ql-snow .ql-picker.ql-color .ql-picker-label svg { width: 19px; height: 19px; }
.proposal-editor .ql-snow .ql-picker:not(.ql-color-picker):not(.ql-icon-picker) svg { right: 6px; width: 16px; margin-top: -8px; }
.proposal-editor .ql-snow .ql-picker.ql-expanded .ql-picker-label { border-color: var(--se); color: var(--se-dark); }
.proposal-editor .ql-snow .ql-picker-options { padding: 7px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface); box-shadow: var(--shadow-lg); }
.proposal-editor .ql-snow .ql-picker.ql-expanded .ql-picker-options { z-index: 5; margin-top: 6px; border-color: var(--border); }
.proposal-editor .ql-snow .ql-picker-options .ql-picker-item { padding: 9px 10px; border-radius: 5px; color: var(--slate); font-size: 12px; line-height: 1.4; }
.proposal-editor .ql-snow .ql-picker-options .ql-picker-item:hover, .proposal-editor .ql-snow .ql-picker-options .ql-picker-item.ql-selected { background: var(--se-tint); color: var(--se-dark); }
.proposal-editor .ql-snow .ql-color-picker .ql-picker-options { right: 0; width: 158px; padding: 7px; }
.proposal-editor .ql-snow .ql-color-picker .ql-picker-item { width: 21px; height: 21px; margin: 3px; padding: 0; border-radius: 4px; }
.proposal-editor .ql-container.ql-snow { height: auto; min-height: 220px; border: 0; border-radius: 0 0 11px 11px; font-family: var(--sans); font-size: 16px; }
.proposal-editor .ql-container .ql-editor { min-height: 220px; max-height: 330px; padding: 22px 24px; color: var(--ink); line-height: 1.75; overflow-wrap: anywhere; }
.proposal-editor .ql-editor.ql-blank::before { left: 24px; right: 24px; color: var(--muted); font-size: 14px; font-style: normal; line-height: 1.8; }
.proposal-editor .ql-editor p, .proposal-editor .ql-editor ul, .proposal-editor .ql-editor ol { margin-bottom: .65rem; }
.proposal-editor .ql-editor p:last-child, .proposal-editor .ql-editor ul:last-child, .proposal-editor .ql-editor ol:last-child { margin-bottom: 0; }
.proposal-editor .ql-editor a { color: var(--se-dark); text-decoration: underline; text-underline-offset: 2px; }
.proposal-editor .ql-snow .ql-font .ql-picker-label::before, .proposal-editor .ql-snow .ql-font .ql-picker-item::before { content: "SupplyEd Sans"; }
.proposal-editor .ql-snow .ql-font [data-value="Arial"]::before { content: "Arial"; font-family: Arial, sans-serif; }
.proposal-editor .ql-snow .ql-font [data-value="Georgia"]::before { content: "Georgia"; font-family: Georgia, serif; }
.proposal-editor .ql-snow .ql-font [data-value="Times New Roman"]::before { content: "Times New Roman"; font-family: "Times New Roman", serif; }

@media (max-width: 640px) {
  .editor-appearance-controls { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .editor-appearance-controls > div:first-child { grid-column: 1 / -1; }
  .proposal-editor .ql-toolbar.ql-snow { gap: 7px 0; padding: 9px 8px; }
  .proposal-editor .ql-toolbar.ql-snow .ql-formats { padding: 0 6px; }
  .proposal-editor .ql-toolbar.ql-snow .proposal-font-controls { flex-basis: 100%; padding: 0 0 8px; border-right: 0; border-bottom: 1px solid var(--border); }
  .proposal-editor .ql-snow .ql-picker.ql-font { width: 154px; }
  .proposal-editor .ql-toolbar.ql-snow .ql-formats:nth-child(2) { padding-left: 0; }
  .proposal-editor .ql-toolbar.ql-snow button { width: 30px; height: 34px; padding: 6px; }
  .proposal-editor .ql-toolbar.ql-snow .ql-formats:last-child { padding-right: 0; }
  .proposal-editor .ql-snow .ql-picker.ql-color { width: 30px; }
  .proposal-editor .ql-container.ql-snow { min-height: 210px; }
  .proposal-editor .ql-container .ql-editor { min-height: 210px; max-height: 300px; padding: 18px; }
  .proposal-editor .ql-editor.ql-blank::before { left: 18px; right: 18px; font-size: 13px; }
}

@media (prefers-reduced-motion: reduce) {
  .proposal-editor, .proposal-close { transition: none; }
}
```

### UI source: components/styles/proposal-preview.css

```css
@layer components {
  .proposal-preview-card { min-width: 0; margin-top: 22px; padding: 20px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); }
  .proposal-preview-heading { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 14px; }
  .proposal-preview-heading > div { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .proposal-preview-heading h3 { font-size: 14px; font-weight: 600; color: var(--ink); }
  .proposal-preview-icon { display: grid; place-items: center; flex-shrink: 0; width: 34px; height: 34px; border-radius: 9px; color: var(--se); background: var(--se-tint); }
  .proposal-preview-excerpt { min-width: 0; overflow-wrap: anywhere; }
  .proposal-reader { display: flex; flex-direction: column; max-height: min(86dvh, 880px); min-width: 0; overflow: hidden; border-radius: inherit; }
  .proposal-reader-header { flex-shrink: 0; padding: 26px 30px 22px; border-bottom: 1px solid var(--border); background: var(--surface); }
  .proposal-reader-title-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; }
  .proposal-reader-eyebrow { margin-bottom: 7px; color: var(--se-dark); font-size: 10px; font-weight: 650; letter-spacing: .1em; text-transform: uppercase; }
  .proposal-reader-title-row h2 { color: var(--ink); font-size: 27px; line-height: 1.2; font-weight: 600; letter-spacing: -.035em; }
  .proposal-reader-close { display: grid; place-items: center; flex-shrink: 0; width: 40px; height: 40px; border: 1px solid var(--border); border-radius: var(--radius); color: var(--muted); background: var(--surface); transition: background .15s, color .15s; }
  .proposal-reader-close:hover { background: var(--chalk); color: var(--ink); }
  .proposal-reader-close:focus-visible { outline: 2px solid var(--se); outline-offset: 3px; }
  .proposal-reader-identity { display: flex; align-items: center; gap: 12px; margin-top: 22px; }
  .proposal-reader-identity > div:last-child { min-width: 0; overflow-wrap: anywhere; }
  .proposal-reader-identity strong { display: block; color: var(--ink); font-size: 13px; font-weight: 600; }
  .proposal-reader-identity p { margin-top: 3px; color: var(--muted); font-size: 12px; line-height: 1.6; }
  .proposal-reader-identity span { font-size: 11px; color: var(--muted); }
  .proposal-reader-body { min-height: 0; overflow-y: auto; overscroll-behavior: contain; background: var(--chalk); padding: 26px 30px; scrollbar-gutter: stable; }
  .proposal-reader-body:focus-visible { outline: 2px solid var(--se); outline-offset: -3px; }
  .proposal-reader-paper { min-width: 0; padding: 28px 32px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); }
  .proposal-reader-content { max-width: 68ch; margin-inline: auto; overflow-wrap: anywhere; word-break: normal; }
  .proposal-reader-content :where(p, li, a, span) { overflow-wrap: anywhere; }
  .proposal-reader-content > :first-child { margin-top: 0; }
  .proposal-reader-content > :last-child { margin-bottom: 0; }
  .proposal-reader-content p + p { margin-top: 16px; }
  .proposal-reader-content ul, .proposal-reader-content ol { padding-left: 24px; margin-block: 16px; }
  .proposal-reader-content ul { list-style: disc; }
  .proposal-reader-content ol { list-style: decimal; }
  .proposal-reader-content li + li { margin-top: 6px; }
  .proposal-reader-content a { color: var(--se-dark); text-decoration: underline; text-underline-offset: 3px; }
  .proposal-reader-content a:focus-visible { outline: 2px solid var(--se); outline-offset: 3px; border-radius: 2px; }
  .proposal-reader-footer { display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; gap: 14px; padding: 16px 30px; border-top: 1px solid var(--border); background: var(--surface); }
  .proposal-reader-footer p { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; color: var(--muted); font-size: 11px; }
  @media (max-width: 639px) {
    .proposal-preview-heading { align-items: flex-start; flex-direction: column; gap: 12px; }
    .proposal-preview-open { width: 100%; }
    .proposal-reader { max-height: 86dvh; }
    .proposal-reader-header { padding: 20px 18px; }
    .proposal-reader-title-row h2 { font-size: 24px; }
    .proposal-reader-identity { margin-top: 18px; align-items: flex-start; }
    .proposal-reader-body { padding: 16px 12px; }
    .proposal-reader-paper { padding: 20px 17px; }
    .proposal-reader-footer { padding: 13px 18px; }
    .proposal-reader-footer p { max-width: 145px; line-height: 1.7; }
  }
}
```

### UI source: components/styles/workspace.css

```css
@layer components {
/* Workspace screens share the SupplyEd palette and a calm, consistent rhythm. */
.workspace-kicker {
  margin: 0 0 8px;
  color: var(--se-dark);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: .13em;
  line-height: 1.5;
  text-transform: uppercase;
}

/* Messaging must stay inside the workspace viewport beside the fixed navigation. */
.workspace-frame {
  width: 100%;
  max-width: 100vw;
  overflow-x: clip;
}

.workspace-main,
.workspace-content,
.messaging-page,
.messaging-layout,
.messaging-inbox-layout,
.messaging-conversations,
.messaging-thread,
.messaging-context {
  min-width: 0;
}

.messaging-page {
  width: 100%;
  max-width: none;
  overflow-x: clip;
}

.messaging-layout {
  grid-template-columns: minmax(220px, 0.8fr) minmax(0, 2fr) minmax(260px, 0.9fr);
}

@media (max-width: 1050px) {
  .messaging-layout {
    grid-template-columns: minmax(220px, 260px) minmax(0, 1fr);
  }
}

@media (max-width: 720px) {
  .messaging-layout,
  .messaging-inbox-layout {
    grid-template-columns: minmax(0, 1fr);
  }
}

.workspace-callout {
  display: flex;
  align-items: center;
  gap: 22px;
  margin-bottom: 26px;
  padding: 27px 30px;
  border: 1px solid var(--se-tint-2);
  border-radius: var(--radius-xl);
  background: var(--se-tint);
}

.workspace-callout-icon {
  display: grid;
  width: 54px;
  height: 54px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid rgb(var(--se-rgb) / .16);
  border-radius: var(--radius-lg);
  background: var(--surface);
  color: var(--se-dark);
}

.workspace-callout-copy { min-width: 0; flex: 1; }
.workspace-callout h2 { margin: 0; color: var(--ink); font-size: clamp(18px, 1.5vw, 23px); font-weight: 650; letter-spacing: -.035em; line-height: 1.35; }
.workspace-callout-description { max-width: 650px; margin-top: 8px; color: var(--slate); font-size: 13px; line-height: 1.7; }
.workspace-callout-action { flex-shrink: 0; }

.dashboard-metrics { gap: 18px; }
.dashboard-metrics .metric-card { min-width: 0; position: relative; padding: 23px; }
.dashboard-metrics .metric-value { font-variant-numeric: tabular-nums; }
.dashboard-page > .two-col { gap: 28px; }
.dashboard-page > .two-col > div { min-width: 0; }
.dashboard-page .section-title { margin-bottom: 15px; }
.dashboard-page .profile-strength-panel { border-top: 3px solid var(--se); padding: 25px; }
.dashboard-quick-actions { gap: 10px; }
.dashboard-quick-actions .ui-button { justify-content: flex-start; min-height: 46px; }
.dashboard-messages .msg-list-item { padding: 18px 20px; }
.dashboard-activity > .card > button { padding: 20px 24px; }
.dashboard-activity > .card > button > span:first-child { border-radius: var(--radius-lg); width: 38px; height: 38px; }
.dashboard-activity > .card > button > span:nth-child(2) > span:first-child { line-height: 1.5; }

.workspace-empty {
  display: flex;
  min-height: 220px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 36px 24px;
  text-align: center;
}
.workspace-empty-icon { display: grid; width: 52px; height: 52px; margin-bottom: 17px; place-items: center; border: 1px solid var(--se-tint-2); border-radius: 16px; background: var(--se-tint); color: var(--se-dark); }
.workspace-empty h3 { margin: 0; color: var(--ink); font-size: 19px; font-weight: 650; letter-spacing: -.03em; }
.workspace-empty p { max-width: 440px; margin: 8px 0 0; color: var(--muted); font-size: 13px; line-height: 1.7; }
.workspace-empty-action { margin-top: 20px; }

.workspace-toolbar { padding: 12px; border-radius: var(--radius-lg); box-shadow: none; }
.workspace-toolbar .ui-button[aria-pressed="true"] { border-color: var(--se-tint-2); background: var(--se-tint); color: var(--se-dark); box-shadow: none; }
.workspace-filter-panel { padding: 23px; box-shadow: none; }
.workspace-filter-panel .form-field:last-child { margin-bottom: 0; }
.workspace-status-filters { gap: 6px; }
.workspace-status-filters button { min-height: 36px; border-color: transparent; background: transparent; font-size: 12px; }
.workspace-status-filters button[aria-pressed="true"] { border-color: var(--se-tint-2); background: var(--se-tint); color: var(--se-dark); }

.directory-layout.three-panel { grid-template-columns: 258px minmax(0, 1fr); gap: 28px; }
.directory-filters { padding: 22px; }
.directory-filters .sidebar-heading { padding-bottom: 17px; margin-bottom: 22px; border-bottom: 1px solid var(--border); }
.directory-filters .form-field { margin-bottom: 0; }
.directory-filters .field-label { font-size: 12px; }
.directory-filters .sidebar-section { padding-top: 20px; border-top: 1px solid var(--border); }
.directory-filter-toggle { display: none; }
.directory-search { padding: 13px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); }
.directory-search > label { min-width: min(240px, 100%); border-color: transparent; background: var(--chalk); }
.directory-search > label:focus-within { outline: 2px solid var(--se); outline-offset: 2px; }
.teacher-directory-card { position: relative; padding: 25px; gap: 20px; }
.teacher-directory-copy { flex-basis: 230px; }
.teacher-directory-copy > .block { display: -webkit-box; overflow: hidden; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
.teacher-directory-rate { align-self: stretch; min-width: 120px; text-align: right; padding: 4px 0 4px 22px; border-left: 1px solid var(--border); }
.teacher-directory-rate > span:first-child .font-heading { color: var(--ink); font-size: 25px; letter-spacing: -.04em; font-variant-numeric: tabular-nums; }
.teacher-directory-card:hover { transform: translateY(-2px); }
.teacher-directory-rate .teacher-hire-actions > .flex { justify-content: flex-end; }
.jobs-discovery .two-col { align-items: start; grid-template-columns: minmax(0, 1fr) 285px; gap: 25px; }
.job-result-card { min-width: 0; position: relative; transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease; }
.job-result-card:hover { border-color: var(--se-tint-2); box-shadow: 0 8px 24px rgb(var(--se-rgb) / .07); transform: translateY(-2px); }
.job-result-card .font-heading { letter-spacing: -.035em; }
.job-result-card .min-w-\[220px\], .job-result-card .min-w-\[240px\], .job-result-copy { min-width: min(220px, 100%); }
.jobs-map-panel { overflow: hidden; padding: 20px; }
.jobs-map-panel .sidebar-heading { margin-bottom: 18px; }
.jobs-map { width: 100%; min-height: 280px; aspect-ratio: 4 / 5; background-color: var(--se-tint); background-image: linear-gradient(28deg, transparent 46%, #fff9 46%, #fff9 48%, transparent 48%), linear-gradient(114deg, transparent 43%, #fff9 43%, #fff9 46%, transparent 46%), linear-gradient(rgb(var(--se-rgb) / .045) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--se-rgb) / .045) 1px, transparent 1px); background-size: 100% 100%, 100% 100%, 28px 28px, 28px 28px; }
.jobs-map > div > div { width: 40px; height: 40px; border: 3px solid var(--surface); box-shadow: 0 4px 12px rgb(var(--se-rgb) / .18); font-size: 10px; }

.job-management-row .pill { margin-top: 3px; }
.job-detail-navigation { display: flex; align-items: center; gap: 12px; margin-bottom: 23px; color: var(--muted); font-size: 12px; }
.job-detail-navigation > span { padding-left: 18px; border-left: 1px solid var(--border); }
.job-detail-page > .two-col { gap: 30px; }
.job-detail-page > .two-col > div { min-width: 0; }
.job-detail-page h1 { max-width: 800px; font-size: clamp(27px, 3.4vw, 42px); letter-spacing: -.045em; }
.job-detail-page aside { border-top: 4px solid var(--se); }
.job-detail-page .grid-3 > .card { display: flex; flex-direction: column; justify-content: center; min-height: 112px; box-shadow: none; }
.job-detail-page .grid-3 > .card > div:last-child { margin-top: 7px; }

.job-posting-progress { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); max-width: 1040px; padding: 18px 23px; gap: 16px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); }
.job-posting-step { min-width: 0; position: relative; font-size: 12px; }
.job-posting-step .step { flex-shrink: 0; }
.job-posting-step .step-bar { flex: 1; width: auto; min-width: 12px; max-width: 70px; margin: 0 8px; }
.job-posting-step[aria-current="step"] > span { color: var(--se-dark); }
.job-editor-card { padding: 32px; }
.job-editor-card .eyebrow { font-size: 10px; }
.job-editor-card h2 { letter-spacing: -.035em; }
.posting-type-choice { position: relative; min-height: 150px; padding: 26px; }
.posting-type-choice:hover { box-shadow: 0 5px 18px rgb(var(--se-rgb) / .07); }
.job-editor-actions { gap: 16px; padding-top: 25px; border-top: 1px solid var(--border); }

.workspace-summary { margin-bottom: 24px; overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); }
.workspace-summary-heading { padding: 13px 22px; border-bottom: 1px solid var(--border); background: var(--chalk); color: var(--muted); font-size: 10px; font-weight: 700; letter-spacing: .11em; text-transform: uppercase; }
.workspace-summary dl { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 0; }
.workspace-summary dl > div { display: flex; flex-direction: column-reverse; gap: 5px; min-width: 0; padding: 21px 24px; border-right: 1px solid var(--border); }
.workspace-summary dl > div:last-child { border-right: 0; }
.workspace-summary dt { color: var(--muted); font-size: 12px; }
.workspace-summary dd { margin: 0; color: var(--ink); font-size: 29px; font-weight: 650; letter-spacing: -.05em; line-height: 1.2; font-variant-numeric: tabular-nums; }
.application-list-row { padding: 25px; gap: 22px; transition: background-color 160ms ease; }
.application-list-row:hover { background: color-mix(in srgb, var(--chalk) 65%, var(--surface)); }
.application-list-row > div:first-child > div > div:first-child > button { font-size: 16px; }
.application-list-row > div:nth-child(2) { width: 100%; padding: 15px 12px; border-color: var(--se-tint-2); background: var(--se-tint); }
.application-info-tile { padding: 18px; border-color: transparent; }
.application-info-tile > div:first-child { font-size: 10px; letter-spacing: .075em; }
.application-detail-grid { align-items: start; }
.teacher-application-card { padding: 28px; }
.teacher-application-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; min-width: 170px; padding-left: 24px; border-left: 1px solid var(--border); }
.teacher-application-card .font-heading { font-size: 21px; letter-spacing: -.035em; }

.booking-card, .invoice-card { padding: 27px; }
.booking-card h2, .invoice-card h3 { font-size: 21px; letter-spacing: -.035em; }
.booking-facts { gap: 1px; overflow: hidden; border: 1px solid var(--border); border-radius: 11px; background: var(--border); }
.booking-facts > div { border: 0; border-radius: 0; background: var(--chalk); padding: 15px 18px; }
.booking-actions { margin-top: 23px; }
.booking-actions > div:last-child { gap: 8px; }
.invoice-card > div:first-child > div:last-child { min-width: 140px; padding: 14px 18px; border-radius: 11px; background: var(--chalk); }
.invoice-card > div:first-child > div:last-child .font-heading { font-size: 28px; font-variant-numeric: tabular-nums; letter-spacing: -.04em; }
.billing-metrics .metric-card { border-top: 3px solid var(--se-tint-2); }
.billing-metrics .metric-card:first-child { border-top-color: var(--se); }
.cashout-card { background: var(--se-tint); border-color: var(--se-tint-2); }
.cashout-card .font-heading { letter-spacing: -.045em; font-variant-numeric: tabular-nums; }
.invoice-filters summary { min-height: 24px; color: var(--slate); }
.invoice-filters[open] summary { padding-bottom: 14px; border-bottom: 1px solid var(--border); color: var(--se-dark); }
.admin-payout-lookup { border-left: 3px solid var(--se); }
.admin-payout-lookup h2 { font-size: 21px; }
.invoice-detail-modal > div:first-child { align-items: center; padding-bottom: 20px; border-bottom: 1px solid var(--border); }
.invoice-detail-modal > div:first-child h2 { font-size: 23px; letter-spacing: -.035em; }
.invoice-total { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 24px; padding: 22px; border: 1px solid var(--se-tint-2); border-radius: var(--radius-lg); background: var(--se-tint); }
.invoice-total span { color: var(--se-dark); font-size: 12px; font-weight: 600; }
.invoice-total strong { color: var(--ink); font-size: 29px; letter-spacing: -.045em; font-variant-numeric: tabular-nums; }
.invoice-breakdown-row { gap: 20px; padding: 12px 0; border-bottom: 1px solid var(--border); }
.invoice-breakdown-row:last-child { border-bottom: 0; }
.invoice-breakdown-row dt { flex: 1; }
.invoice-breakdown-row dd { max-width: 60%; }
.invoice-payment-modal .invoice-payment-amount { font-size: 36px; letter-spacing: -.045em; }

.calendar-heading { gap: 15px; padding-bottom: 22px; border-bottom: 1px solid var(--border); }
.calendar-heading .workspace-kicker { margin-bottom: 4px; }
.calendar-day { position: relative; min-width: 0; align-items: flex-start; justify-content: flex-start; flex-direction: column; gap: 9px; padding: 12px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); color: var(--ink); }
.calendar-day > span:first-child { font-weight: 650; }
.calendar-day.available { border-color: var(--se-tint-2); background: var(--se-tint); color: var(--se-dark); }
.calendar-day.booked { border-color: var(--ink); background: var(--ink); color: var(--surface); }
.calendar-day.empty { border-color: transparent; background: transparent; }
.calendar-day-state { font-size: 9px; font-weight: 550; }
.calendar-legend { display: flex; flex-wrap: wrap; gap: 22px; padding-top: 23px; margin-top: 21px; border-top: 1px solid var(--border); }
.calendar-legend > span { display: inline-flex; align-items: center; gap: 8px; color: var(--muted); font-size: 11px; }
.calendar-legend i { display: block; width: 9px; height: 9px; border: 1px solid var(--border-2); border-radius: 3px; background: var(--surface); }
.calendar-legend i.available { background: var(--se-tint); border-color: var(--se); }
.calendar-legend i.booked { background: var(--ink); border-color: var(--ink); }
.calendar-page .sidebar-panel > div:last-child > div { gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--border); line-height: 1.6; }
.calendar-page .sidebar-panel > div:last-child > div:last-child { border-bottom: 0; }
.calendar-page .sidebar-panel .toggle { flex-shrink: 0; }

.messaging-page .messaging-layout { grid-template-columns: 250px minmax(0, 1fr) 290px; gap: 18px; }
.messaging-page .messaging-layout > *, .messaging-page .messaging-inbox-layout > * { min-width: 0; }
.messaging-page .messaging-inbox-layout { grid-template-columns: minmax(260px, 380px) minmax(0, 1fr); }
.messaging-page .page-head { margin-bottom: 24px; }
.messaging-conversations .sidebar-heading { padding-bottom: 18px; }
.messaging-conversations .msg-list-item { gap: 12px; padding: 19px 18px; }
.messaging-conversations .msg-list-item > div:nth-child(2) { display: flex; flex-direction: column; gap: 4px; }
.messaging-conversations .msg-list-item.active { background: var(--se-tint); box-shadow: inset 3px 0 0 var(--se); }
.messaging-thread { padding: 0; }
.messaging-thread > header { padding: 21px 23px; margin: 0; background: var(--surface); }
.message-timeline { padding: 25px; background: color-mix(in srgb, var(--chalk) 75%, var(--surface)); scrollbar-gutter: stable; }
.message-timeline .msg-bubble { max-width: min(85%, 520px); border: 1px solid var(--border); border-radius: 16px; box-shadow: var(--shadow-xs); }
.message-timeline .msg-bubble.in { background: var(--surface); border-bottom-left-radius: 4px; }
.message-timeline .msg-bubble.out { border-color: var(--se-dark); border-bottom-right-radius: 4px; background: var(--se-dark); }
.message-composer { margin: 0; padding: 17px 20px; background: var(--surface); }
.message-composer-controls { display: flex; align-items: flex-end; gap: 8px; }
.message-composer textarea { min-height: 48px; padding: 13px 14px; background: var(--chalk); }
.message-composer-hint { margin: 9px 0 0; color: var(--muted); font-size: 10px; text-align: center; }
.messaging-thread > p { margin: 0; border-radius: 0; }
.messaging-context { background: var(--surface); }
.messaging-context > div:first-child { background: var(--chalk); }
.messaging-context .context-label { font-size: 10px; letter-spacing: .1em; }

/* Inline file actions use the same button and keyboard/disabled states as forms. */
.profile-image-upload:focus-within { outline: 2px solid var(--se); outline-offset: 3px; }
.profile-image-upload[aria-disabled="true"] { opacity: .5; cursor: not-allowed; }
.attachment-preview-dialog[open] { display: flex; flex-direction: column; }
.attachment-preview-dialog > header, .attachment-preview-dialog > footer { flex-shrink: 0; }
.attachment-preview-body { min-height: 0; flex: 1 1 auto; overscroll-behavior: contain; }

/* Long actions and user content must stay inside narrow workspace panels. */
.workspace-empty-action { max-width: 100%; }
.workspace-empty-action .ui-button, .account-payouts .ui-button { max-width: 100%; white-space: normal; }
.account-payouts .min-w-\[220px\] { min-width: min(220px, 100%); }
.account-security-page .ui-button { max-width: 100%; white-space: normal; }
.job-detail-navigation { flex-wrap: wrap; }

.profile-hero { border-color: var(--border); border-radius: var(--radius-xl); background: var(--surface); box-shadow: none; }
.profile-hero::before { content: ""; display: block; height: 7px; background: var(--se); }
.profile-hero > [aria-hidden="true"] { display: none; }
.profile-hero h1 { letter-spacing: -.05em; }
.profile-hero > div:last-child { background: var(--chalk); border-color: var(--border); }
.profile-hero > div:last-child > div { border-color: var(--border); }
.profile-detail-grid { gap: 28px; }
.profile-overview > div:first-child { background: var(--se-dark); }
.profile-overview > div:last-child { background: var(--se-tint); border-color: var(--se-tint-2); }
.profile-reviews-panel { box-shadow: none; }
.profile-reviews-panel > div:first-child { background: var(--surface); }
.profile-reviews-panel article { padding-top: 27px; padding-bottom: 27px; }
.legacy-profile-intro { border-top: 4px solid var(--se); background: var(--se-tint); }
.legacy-profile-intro h1 { letter-spacing: -.045em; }
.profile-page .section-title { margin-bottom: 18px; }
.admin-dashboard > .card { max-width: 900px; padding: 36px; border-top: 4px solid var(--se); }
.admin-dashboard > .card h2 { font-size: 27px; letter-spacing: -.035em; }

@media (min-width: 1200px) {
  .jobs-map-panel { position: sticky; top: 100px; }
  .job-detail-page aside, .profile-page .profile-overview { top: 100px; }
}

@media (min-width: 1024px) {
  .workspace-main:has(.teacher-discovery) { display: flex; flex-direction: column; height: 100dvh; }
}

@media (min-width: 901px) {
  .workspace-frame:has(.teacher-discovery) { height: 100dvh; }
  .workspace-frame:has(.teacher-discovery) .workspace-topbar { flex-shrink: 0; }
  .workspace-content:has(.teacher-discovery) { flex: 1; min-height: 0; }
  .teacher-discovery { display: flex; flex-direction: column; height: 100%; min-height: 0; padding-bottom: 24px; }
  .teacher-discovery > .page-head { flex-shrink: 0; }
  .teacher-discovery .directory-layout { flex: 1; min-height: 0; }
  .teacher-discovery .directory-filters,
  .teacher-discovery .directory-results { position: relative; min-height: 0; max-height: 100%; overflow-y: auto; overscroll-behavior-y: contain; scrollbar-width: thin; }
  .teacher-discovery .directory-results { padding: 4px; margin: -4px; }
}

@media (max-width: 1550px) {
  .messaging-page .messaging-layout { grid-template-columns: 245px minmax(0, 1fr); }
  .messaging-page .messaging-context { grid-column: 2; height: auto; max-height: none; }
}

@media (max-width: 1280px) {
  .application-detail-grid, .profile-detail-grid { grid-template-columns: minmax(0, 1fr); }
  .profile-page .profile-overview { position: static; }
  .jobs-discovery .two-col { grid-template-columns: minmax(0, 1fr); }
  .jobs-map-panel { position: static; }
  .jobs-map { aspect-ratio: 2.5; min-height: 210px; }
}

@media (max-width: 1100px) {
  .workspace-callout { flex-wrap: wrap; }
  .workspace-callout-action { padding-left: 76px; }
  .teacher-directory-rate { width: 100%; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 15px; padding: 15px 0 0; border-left: 0; border-top: 1px solid var(--border); text-align: left; }
  .teacher-directory-rate > .teacher-hire-actions { width: 100%; margin-top: 0; }
  .teacher-directory-rate .teacher-hire-actions > .flex { justify-content: flex-start; }
  .teacher-directory-rate > span { margin: 0; }
  .calendar-day { padding: 9px; }
}

@media (max-width: 900px) {
  .directory-layout.three-panel { grid-template-columns: minmax(0, 1fr); gap: 18px; }
  .directory-filter-toggle { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 48px; padding: 13px 17px; margin-bottom: 14px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); color: var(--ink); font-size: 13px; font-weight: 600; text-align: left; }
  .directory-filter-toggle > span { margin-left: auto; color: var(--se-dark); font-size: 11px; }
  .directory-filters[data-open="false"] { display: none; }
  .directory-filters > .flex.flex-col { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .jobs-discovery .two-col { grid-template-columns: minmax(0, 1fr); }
  .jobs-map { min-height: 220px; aspect-ratio: 2.5; }
  .job-posting-step .step-bar { display: none; }
  .teacher-application-actions { width: 100%; align-items: center; flex-direction: row; flex-wrap: wrap; padding: 17px 0 0; border-top: 1px solid var(--border); border-left: 0; }
  .teacher-application-actions > div { flex: 1; text-align: left; }
}

@media (max-width: 760px) {
  .messaging-page .messaging-layout, .messaging-page .messaging-inbox-layout { grid-template-columns: minmax(0, 1fr); }
  .messaging-page .messaging-layout.has-active .messaging-conversations, .messaging-page .messaging-inbox-overview { display: none; }
  .messaging-page .messaging-context { grid-column: auto; }
  .messaging-page .messaging-back-button { display: inline-flex; }
}

@media (max-width: 640px) {
  .workspace-callout { gap: 15px; padding: 23px 20px; }
  .workspace-callout-icon { width: 42px; height: 42px; border-radius: var(--radius-lg); }
  .workspace-callout-copy { flex-basis: calc(100% - 60px); }
  .workspace-callout-action { width: 100%; padding: 0; }
  .workspace-callout-action > .ui-button { width: 100%; }
  .workspace-callout-description { font-size: 12px; }
  .dashboard-metrics { gap: 12px; }
  .dashboard-metrics .metric-card { padding: 18px; }
  .dashboard-page .two-col { gap: 26px; }
  .workspace-toolbar { gap: 6px; padding: 9px; }
  .workspace-toolbar > label { width: 100%; justify-content: space-between; margin: 5px 0 0; padding: 10px 6px 2px; border-top: 1px solid var(--border); }
  .workspace-filter-panel { padding: 20px; }
  .directory-filters > .flex.flex-col { display: flex; }
  .directory-search { gap: 8px; padding: 9px; }
  .directory-search > label { min-width: 0; padding-left: 9px; }
  .directory-search > .ui-button { padding-right: 12px; padding-left: 12px; }
  .teacher-directory-card { padding: 20px; gap: 15px; }
  .teacher-directory-copy { flex-basis: calc(100% - 80px); }
  .teacher-directory-rate { flex-wrap: wrap; gap: 12px; }
  .teacher-directory-rate > span:last-child { margin-left: auto; }
  .job-result-card { padding: 20px; }
  .job-management-row { gap: 12px; padding: 19px 16px; }
  .job-management-heading { align-items: flex-start; flex-direction: column; gap: 12px; }
  .job-detail-page h1 { font-size: 29px; }
  .job-detail-navigation { margin-bottom: 18px; }
  .job-editor-card { padding: 22px 18px; }
  .job-posting-progress { grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 18px; gap: 16px 10px; }
  .job-posting-step { font-size: 11px; }
  .posting-type-choice { padding: 22px; min-height: 130px; }
  .job-editor-actions { align-items: stretch; flex-direction: column; }
  .job-editor-actions > div { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .job-editor-actions .ui-button { min-width: 0; white-space: normal; }
  .workspace-summary dl { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .workspace-summary dl > div { padding: 17px 20px; }
  .workspace-summary dl > div:nth-child(2) { border-right: 0; }
  .workspace-summary dl > div:nth-child(-n+2) { border-bottom: 1px solid var(--border); }
  .workspace-summary dd { font-size: 26px; }
  .application-list-row, .teacher-application-card { padding: 20px; }
  .application-list-row > div:nth-child(2) { display: flex; align-items: center; justify-content: space-between; padding: 10px 15px; }
  .teacher-application-card > div:first-child { flex-direction: column; }
  .teacher-application-card h2, .teacher-application-card .font-heading { font-size: 20px; }
  .booking-card, .invoice-card { padding: 21px 18px; }
  .booking-card .min-w-\[220px\], .invoice-card .min-w-\[220px\] { min-width: 0; flex-basis: calc(100% - 65px); }
  .booking-card h2, .invoice-card h3 { font-size: 19px; }
  .booking-actions > div:last-child { display: grid; width: 100%; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .booking-actions .ui-button { min-width: 0; white-space: normal; }
  .invoice-card > div:first-child > div:last-child { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .invoice-card > div:last-child { justify-content: flex-start; }
  .invoice-total { padding: 18px; }
  .invoice-total strong { font-size: 25px; }
  .calendar-board { padding: 18px 13px; }
  .calendar-heading { padding: 0 3px 18px; }
  .calendar-heading { flex-wrap: wrap; }
  .calendar-heading h2 { font-size: 19px; }
  .calendar-grid { gap: 5px; }
  .calendar-day { align-items: center; justify-content: center; gap: 5px; padding: 4px; font-size: 12px; }
  .calendar-day-state { width: 4px; height: 4px; overflow: hidden; border-radius: 50%; background: currentColor; font-size: 0; }
  .calendar-legend { gap: 16px; padding-top: 18px; }
  .messaging-thread > header { flex-wrap: wrap; gap: 10px; padding: 15px; }
  .messaging-thread > header > .tag { margin-left: auto; }
  .message-timeline { padding: 17px 13px; }
  .message-timeline .msg-bubble { max-width: 90%; padding: 11px 13px; font-size: 13px; }
  .message-composer { padding: 13px; }
  .message-composer-controls { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 9px; }
  .message-composer-controls textarea { grid-column: 1 / -1; grid-row: 1; min-width: 0; }
  .message-composer-controls > .ui-button:first-of-type { justify-self: start; }
  .message-composer-hint { display: none; }
  .dashboard-activity > .card > button { flex-wrap: wrap; padding: 18px; }
  .dashboard-activity > .card > button > span:nth-child(2) { flex-basis: calc(100% - 54px); }
  .dashboard-activity > .card > button > span:last-child { margin-left: 50px; padding-top: 0; }
  .profile-hero { border-radius: var(--radius-lg); }
  .profile-page h1 { overflow-wrap: anywhere; }
  .admin-dashboard > .card { padding: 25px 20px; }
  .admin-dashboard > .card h2 { font-size: 23px; }
}

@media (prefers-reduced-motion: reduce) {
  .job-result-card, .teacher-directory-card, .application-list-row { transition: none; }
  .job-result-card:hover, .teacher-directory-card:hover { transform: none; }
}

/* Hiring dashboard: keep work and activity together so a short job list never
   leaves an empty main column underneath a taller supporting rail. */
.hiring-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-bottom: 28px; }
.hiring-metric { min-width: 0; padding: 21px 23px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); }
.hiring-metric.is-primary { border-color: var(--se-tint-2); background: var(--se-tint); }
.hiring-metric-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--slate); font-size: 13px; font-weight: 550; }
.hiring-metric-top > svg { flex-shrink: 0; color: var(--se-dark); }
.hiring-metric > strong { display: block; margin-top: 14px; color: var(--ink); font-size: 39px; font-weight: 650; line-height: 1.05; letter-spacing: -.055em; font-variant-numeric: tabular-nums; }
.hiring-metric > p { margin: 10px 0 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
.hiring-workspace-grid { display: grid; grid-template-columns: minmax(0, 1fr) 310px; align-items: start; gap: 24px; }
.hiring-workspace-main, .hiring-workspace-rail { display: grid; min-width: 0; align-content: start; gap: 24px; }
.hiring-panel-heading { display: flex; align-items: center; justify-content: space-between; gap: 15px; padding: 22px 23px; border-bottom: 1px solid var(--border); }
.hiring-panel-heading h2 { margin: 0; color: var(--ink); font-size: 17px; font-weight: 650; letter-spacing: -.025em; line-height: 1.4; }
.hiring-panel-heading p { margin: 5px 0 0; color: var(--muted); font-size: 12px; line-height: 1.55; }
.hiring-panel-icon { display: grid; width: 34px; height: 34px; flex-shrink: 0; place-items: center; border: 1px solid var(--border); border-radius: var(--radius); background: var(--chalk); color: var(--se-dark); }
.hiring-matches-panel, .hiring-actions-panel { overflow: hidden; }
.hiring-match-role { display: flex; flex-direction: column; gap: 4px; padding: 14px 22px; border-bottom: 1px solid var(--border); background: var(--chalk); }
.hiring-match-role > span { color: var(--muted); font-size: 10px; font-weight: 550; letter-spacing: .03em; }
.hiring-match-role > strong { overflow-wrap: anywhere; color: var(--slate); font-size: 12px; font-weight: 600; line-height: 1.6; }
.hiring-teacher-match { display: flex; width: 100%; align-items: center; gap: 12px; padding: 21px 22px; border-bottom: 1px solid var(--border); text-align: left; transition: background-color 160ms ease; }
.hiring-teacher-match:hover { background: var(--chalk); }
.hiring-teacher-match > span { min-width: 0; flex: 1; }
.hiring-teacher-match strong { display: block; overflow: hidden; color: var(--ink); font-size: 14px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.hiring-teacher-match small { display: block; margin-top: 4px; overflow: hidden; color: var(--muted); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.hiring-panel-footer { padding: 8px 13px; }
.hiring-panel-footer > .ui-button { width: 100%; justify-content: space-between; color: var(--se-dark); }
.hiring-match-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 27px 24px; color: var(--se-dark); text-align: center; }
.hiring-match-empty h3 { margin: 3px 0 0; color: var(--ink); font-size: 14px; font-weight: 600; }
.hiring-match-empty p { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.7; }
.hiring-actions-panel .hiring-panel-heading { padding-bottom: 17px; }
.hiring-action { display: flex; width: 100%; align-items: center; gap: 12px; padding: 14px 21px; border-bottom: 1px solid var(--border); text-align: left; transition: background-color 160ms ease; }
.hiring-action:last-child { border-bottom: 0; }
.hiring-action:hover { background: var(--chalk); }
.hiring-action-icon { display: grid; width: 33px; height: 33px; flex: 0 0 auto; place-items: center; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-2); color: var(--se-dark); }
.hiring-action > span:nth-child(2) { min-width: 0; flex: 1; }
.hiring-action strong { display: block; color: var(--graphite); font-size: 13px; font-weight: 600; }
.hiring-action small { display: block; margin-top: 2px; color: var(--muted); font-size: 11px; line-height: 1.5; }
.hiring-action > svg { flex-shrink: 0; color: var(--muted); }
.job-management-workspace { min-width: 0; overflow: visible; }
.job-management-heading { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin: 0; padding: 24px; border-bottom: 1px solid var(--border); }
.job-management-heading h2 { margin: 0; color: var(--ink); font-size: 21px; font-weight: 650; letter-spacing: -.035em; line-height: 1.3; }
.job-management-heading p { margin: 6px 0 0; color: var(--muted); font-size: 12px; line-height: 1.6; }
.job-status-toolbar { display: flex; flex-wrap: wrap; gap: 6px; padding: 12px 18px; border-bottom: 1px solid var(--border); background: var(--surface-2); }
.job-status-toolbar > button { display: inline-flex; align-items: center; gap: 8px; min-height: 35px; padding: 7px 10px; }
.job-status-count { min-width: 19px; padding: 0 4px; border-radius: 4px; background: var(--chalk); font-size: 10px; font-weight: 650; line-height: 18px; text-align: center; font-variant-numeric: tabular-nums; }
.job-status-toolbar > button[aria-pressed="true"] .job-status-count { background: var(--surface); color: var(--se-dark); }
.job-management-row { position: relative; display: grid; grid-template-columns: 44px minmax(0, 1fr) 96px 34px; align-items: start; gap: 15px; padding: 25px 23px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background-color 160ms ease; }
.job-management-row:last-child { border-bottom: 0; }
.job-management-row:hover { background: color-mix(in srgb, var(--chalk) 60%, var(--surface)); }
.job-management-icon { display: grid; width: 44px; height: 48px; margin-top: 3px; place-items: center; border: 1px solid var(--se-tint-2); border-radius: var(--radius-lg); background: var(--se-tint); color: var(--se-dark); }
.job-management-copy { min-width: 0; }
.job-management-status { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 8px; }
.job-management-status > span:last-child:not(.tag) { color: var(--muted); font-size: 10px; }
.job-management-title { display: block; width: 100%; color: var(--ink); font-size: 19px; font-weight: 650; letter-spacing: -.035em; line-height: 1.35; overflow-wrap: anywhere; text-align: left; }
.job-management-title:hover { color: var(--se-dark); }
.job-management-meta { display: flex; flex-wrap: wrap; gap: 7px 16px; margin-top: 10px; color: var(--muted); font-size: 12px; line-height: 1.6; }
.job-management-meta > span { display: inline-flex; min-width: 0; align-items: center; gap: 5px; overflow-wrap: anywhere; }
.job-management-meta > span:first-child { flex-basis: 100%; }
.job-management-meta svg { flex-shrink: 0; color: var(--slate); }
.job-management-skills { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; margin-top: 13px; }
.job-applicant-action { display: flex; flex-direction: column; gap: 12px; align-self: center; padding: 14px 10px; border: 1px solid var(--se-tint-2); border-radius: var(--radius); background: var(--se-tint); text-align: center; }
.job-applicant-action > span:first-child { display: flex; flex-direction: column; gap: 2px; }
.job-applicant-action strong { color: var(--se-dark); font-size: 27px; font-weight: 650; line-height: 1.1; letter-spacing: -.045em; }
.job-applicant-action > span:first-child > span { color: var(--slate); font-size: 11px; }
.job-applicant-action > span:last-child { display: flex; align-items: center; justify-content: center; gap: 5px; color: var(--se-dark); font-size: 11px; font-weight: 650; }
.job-applicant-action:hover { border-color: var(--se); background: var(--se-tint-2); }
.job-management-menu { position: relative; justify-self: end; }
.job-management-menu > button { width: 34px; height: 34px; }
.job-pagination { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 20px; border-top: 1px solid var(--border); border-radius: 0 0 13px 13px; background: var(--surface-2); }
.job-pagination-summary { margin: 0; color: var(--muted); font-size: 11px; line-height: 1.5; }
.job-pagination-controls { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 5px; }
.job-pagination-controls > .ui-button { min-height: 34px; padding: 7px 9px; font-size: 11px; }
.job-pagination-controls > button[aria-label^="Page "] { width: 31px; height: 32px; min-width: 31px; font-size: 11px; }
.applications-job-list-heading { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; padding: 23px 25px; border-bottom: 1px solid var(--border); }
.applications-job-list-heading h2 { margin: 0; color: var(--ink); font-size: 21px; font-weight: 650; letter-spacing: -.03em; }
.applications-job-list-heading p { margin: 6px 0 0; color: var(--muted); font-size: 13px; line-height: 1.6; }
.applications-job-row { display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; align-items: center; gap: 18px; padding: 25px; border-bottom: 1px solid var(--border); }
.applications-job-row:last-child { border-bottom: 0; }
.applications-job-icon { display: grid; width: 44px; height: 48px; place-items: center; border: 1px solid var(--se-tint-2); border-radius: var(--radius-lg); background: var(--se-tint); color: var(--se-dark); }
.applications-job-copy { min-width: 0; }
.applications-job-status { display: flex; flex-wrap: wrap; align-items: center; gap: 9px; margin-bottom: 9px; }
.applications-job-status > span:last-child:not(.tag) { color: var(--muted); font-size: 12px; }
.applications-job-copy h3 { margin: 0; color: var(--ink); font-size: 19px; font-weight: 650; letter-spacing: -.03em; line-height: 1.4; overflow-wrap: anywhere; }
.applications-job-meta { display: flex; flex-wrap: wrap; gap: 7px 16px; margin-top: 10px; color: var(--muted); font-size: 12px; line-height: 1.6; }
.applications-job-meta > span { display: inline-flex; align-items: center; gap: 5px; min-width: 0; overflow-wrap: anywhere; }
.applications-job-meta svg { flex-shrink: 0; }
.applications-job-page-number { padding: 0 7px; color: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; }
@media (max-width: 720px) {
  .applications-job-list-heading { padding: 21px 19px; }
  .applications-job-row { grid-template-columns: 36px minmax(0, 1fr); align-items: start; gap: 13px; padding: 22px 19px; }
  .applications-job-icon { width: 36px; height: 42px; }
  .applications-job-row > .ui-button { grid-column: 2; justify-self: start; max-width: 100%; }
  .applications-job-meta > span:first-child { flex-basis: 100%; }
}
.dashboard-activity { margin-top: 26px; overflow: hidden; }
.hiring-workspace-main .dashboard-activity { margin-top: 0; }
.dashboard-activity-list > button { padding: 18px 22px; }
.dashboard-activity-list > button > span:first-child { width: 35px; height: 35px; border-radius: var(--radius); }
.dashboard-activity-list > button > span:nth-child(2) > span:first-child { font-size: 13px; line-height: 1.5; }
.dashboard-activity-list > button > span:last-child { font-size: 10px; }

@media (max-width: 1200px) and (min-width: 901px) {
  .hiring-workspace-grid { grid-template-columns: minmax(0, 1fr) 280px; gap: 20px; }
  .job-management-row { grid-template-columns: 38px minmax(0, 1fr) 34px; gap: 12px; padding: 22px 20px; }
  .job-management-icon { width: 38px; height: 42px; }
  .job-applicant-action { grid-column: 2 / -1; flex-direction: row; align-items: center; justify-content: space-between; gap: 15px; padding: 10px 15px; }
  .job-applicant-action > span:first-child { flex-direction: row; align-items: baseline; gap: 7px; }
  .job-applicant-action strong { font-size: 21px; }
  .job-management-menu { grid-column: 3; grid-row: 1; }
}
@media (max-width: 900px) {
  .hiring-workspace-grid { grid-template-columns: minmax(0, 1fr); }
  .hiring-workspace-rail { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
  .hiring-metrics { gap: 12px; }
  .hiring-metric { padding: 19px; }
}
@media (max-width: 640px) {
  .hiring-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 11px; margin-bottom: 22px; }
  .hiring-metric { padding: 17px; }
  .hiring-metric-top { gap: 7px; font-size: 12px; }
  .hiring-metric-top svg { width: 15px; height: 15px; }
  .hiring-metric > strong { margin-top: 13px; font-size: 34px; }
  .hiring-metric > p { margin-top: 8px; font-size: 10px; }
  .hiring-workspace-main, .hiring-workspace-rail { gap: 20px; }
  .hiring-workspace-rail { grid-template-columns: minmax(0, 1fr); }
  .job-management-heading { flex-direction: row; align-items: center; gap: 12px; padding: 21px 18px; }
  .job-management-heading h2 { font-size: 20px; }
  .job-management-heading p { max-width: 210px; font-size: 11px; }
  .job-management-heading .ui-button { padding: 8px; font-size: 11px; }
  .job-status-toolbar { gap: 5px; padding: 11px 12px; }
  .job-status-toolbar > button { gap: 5px; padding: 7px 9px; font-size: 11px; }
  .job-management-row { grid-template-columns: 37px minmax(0, 1fr) 30px; align-items: start; gap: 11px; padding: 21px 15px; }
  .job-management-icon { width: 37px; height: 42px; }
  .job-management-icon svg { width: 19px; height: 19px; }
  .job-management-title { font-size: 19px; }
  .job-management-meta { font-size: 11px; gap: 6px 10px; }
  .job-management-menu { grid-column: 3; grid-row: 1; }
  .job-management-menu > button { width: 30px; height: 32px; }
  .job-applicant-action { grid-column: 2 / -1; flex-direction: row; align-items: center; justify-content: space-between; gap: 15px; padding: 11px 14px; }
  .job-applicant-action > span:first-child { flex-direction: row; align-items: baseline; gap: 7px; }
  .job-applicant-action strong { font-size: 22px; }
  .job-pagination { justify-content: center; gap: 12px; padding: 15px; }
  .job-pagination-summary { width: 100%; text-align: center; }
  .job-pagination-controls { justify-content: center; }
  .hiring-panel-heading { padding: 20px; }
  .dashboard-activity-list > button { flex-wrap: wrap; padding: 18px; }
  .dashboard-activity-list > button > span:nth-child(2) { flex-basis: calc(100% - 50px); }
  .dashboard-activity-list > button > span:last-child { margin-left: 47px; padding-top: 0; }
}

}
```

### UI source: components/styles/teacher-dashboard.css

```css
@layer components {
  .teacher-home { --teacher-gap: 24px; max-width: 1520px; }
  .teacher-home-header { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-bottom: 28px; }
  .teacher-home-header h1 { margin: 8px 0 9px; font-size: clamp(26px, 2.25vw, 34px); font-weight: 680; letter-spacing: -.045em; line-height: 1.2; }
  .teacher-home-header p:not(.teacher-eyebrow) { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.7; }
  .teacher-eyebrow { display: flex; align-items: center; gap: 8px; color: var(--se-dark); font-size: 10px; letter-spacing: .12em; text-transform: uppercase; font-weight: 750; }
  .teacher-eyebrow > span { width: 6px; height: 6px; border-radius: 50%; background: var(--se); box-shadow: 0 0 0 4px var(--se-tint); }
  .teacher-header-actions { display: flex; align-items: center; flex-shrink: 0; gap: 9px; }
  .teacher-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-bottom: 28px; }
  .teacher-metric { display: flex; flex-direction: column; align-items: stretch; min-width: 0; padding: 20px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); text-align: left; box-shadow: var(--shadow-xs); transition: border-color .18s, box-shadow .18s; }
  .teacher-metric:hover { border-color: var(--se); box-shadow: 0 5px 18px rgb(var(--se-rgb) / .07); }
  .teacher-metric-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: var(--slate); }
  .teacher-metric-icon { display: grid; place-items: center; flex-shrink: 0; width: 34px; height: 34px; border-radius: 10px; background: var(--se-tint); color: var(--se-dark); }
  .teacher-metric:nth-child(2) .teacher-metric-icon { background: var(--purple-tint); color: var(--purple); }
  .teacher-metric:nth-child(3) .teacher-metric-icon { background: var(--amber-tint); color: var(--amber); }
  .teacher-metric:nth-child(4) .teacher-metric-icon { background: var(--green-tint); color: var(--green); }
  .teacher-metric > strong { margin: 15px 0 12px; font-size: clamp(23px, 2.2vw, 32px); font-weight: 680; letter-spacing: -.045em; line-height: 1.1; font-variant-numeric: tabular-nums; }
  .teacher-metric-caption { display: flex; align-items: center; justify-content: space-between; gap: 6px; color: var(--muted); font-size: 11px; line-height: 1.5; }
  .teacher-home-columns { display: grid; grid-template-columns: minmax(0, 1fr) minmax(290px, 340px); gap: var(--teacher-gap); align-items: start; }
  .teacher-main-column, .teacher-side-column { display: flex; flex-direction: column; gap: var(--teacher-gap); min-width: 0; }
  .teacher-panel, .teacher-message-section { min-width: 0; overflow: hidden; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); box-shadow: var(--shadow-xs); }
  .teacher-section-heading { display: flex; justify-content: space-between; align-items: center; gap: 14px; padding: 21px 24px; border-bottom: 1px solid var(--border); }
  .teacher-section-heading > div { min-width: 0; }
  .teacher-section-heading h2 { margin: 0; color: var(--ink); font-size: 16px; font-weight: 670; letter-spacing: -.025em; line-height: 1.5; }
  .teacher-section-heading p { margin: 3px 0 0; color: var(--muted); font-size: 11px; line-height: 1.65; }
  .teacher-section-heading > .ui-button { font-size: 11px; color: var(--se-dark); padding: 6px 0 6px 8px; }
  .teacher-icon-button { display: grid; place-items: center; flex-shrink: 0; width: 34px; height: 34px; border: 1px solid var(--border); border-radius: 9px; color: var(--slate); background: var(--surface); transition: background .15s; }
  .teacher-icon-button:hover { color: var(--se-dark); background: var(--se-tint); }
  .teacher-next { position: relative; overflow: hidden; min-width: 0; border-radius: 16px; background: linear-gradient(115deg, #12364a 0%, #124760 70%, #155872 100%); color: #fff; padding: 24px 28px; }
  .teacher-next::after { content: ""; position: absolute; width: 260px; height: 260px; top: -155px; right: -110px; border: 36px solid rgb(255 255 255 / .035); border-radius: 50%; pointer-events: none; }
  .teacher-next-top, .teacher-next-footer { display: flex; align-items: center; justify-content: space-between; gap: 15px; }
  .teacher-next-label { display: flex; align-items: center; gap: 8px; color: #c4dfe9; font-size: 10px; font-weight: 650; letter-spacing: .12em; }
  .teacher-next-status { display: inline-flex; align-items: center; gap: 6px; color: #d7f9e4; background: rgb(125 211 169 / .13); border: 1px solid rgb(125 211 169 / .2); padding: 5px 9px; border-radius: 6px; font-size: 10px; }
  .teacher-next-status > span { width: 5px; height: 5px; background: #9fe6b8; border-radius: 50%; }
  .teacher-next-body { display: flex; align-items: center; gap: 20px; margin: 28px 0; }
  .teacher-next-copy { min-width: 0; }
  .teacher-next-copy h2 { color: #fff; font-size: clamp(20px, 1.8vw, 25px); font-weight: 620; letter-spacing: -.035em; line-height: 1.35; overflow-wrap: anywhere; }
  .teacher-next-copy > p { color: #d1e2eb; font-size: 13px; line-height: 1.8; margin: 5px 0 12px; }
  .teacher-next-meta { display: flex; flex-wrap: wrap; gap: 9px 16px; color: #c4dfe9; font-size: 11px; }
  .teacher-next-meta > span { display: inline-flex; align-items: center; gap: 5px; }
  .teacher-next-footer { padding-top: 18px; border-top: 1px solid rgb(255 255 255 / .16); }
  .teacher-next-footer strong { font-size: 19px; font-weight: 620; letter-spacing: -.025em; }
  .teacher-next-footer small { display: block; margin-top: 2px; font-size: 10px; color: #c4dfe9; }
  .teacher-next .ui-button { background: #fff; color: #15455a; border-color: #fff; font-size: 12px; }
  .teacher-next .ui-button:hover { background: #e5f4fa; }
  .teacher-next-empty { padding: 26px 0 4px; max-width: 440px; }
  .teacher-next-loading { padding: 44px 0; font-size: 14px; color: #d1e2eb; }
  .teacher-date-tile { display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; width: 54px; min-height: 68px; padding: 8px 6px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); color: var(--slate); }
  .teacher-date-tile > small { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; line-height: 1.3; }
  .teacher-date-tile > strong { color: var(--ink); font-size: 23px; font-weight: 650; line-height: 1.35; font-variant-numeric: tabular-nums; }
  .teacher-next .teacher-date-tile { background: rgb(255 255 255 / .08); color: #d1e2eb; border-color: rgb(255 255 255 / .2); width: 69px; min-height: 85px; border-radius: 12px; }
  .teacher-next .teacher-date-tile > strong { color: #fff; font-size: 30px; }
  .teacher-schedule-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding: 17px 24px; }
  .teacher-segmented { display: flex; flex-wrap: wrap; gap: 3px; padding: 4px; border: 1px solid var(--border); background: var(--chalk); border-radius: 9px; }
  .teacher-segmented button { padding: 6px 12px; border-radius: 6px; color: var(--muted); font-size: 11px; font-weight: 600; min-height: 32px; }
  .teacher-segmented button[aria-pressed="true"] { background: var(--surface); color: var(--se-dark); box-shadow: var(--shadow-sm); }
  .teacher-count { font-size: 11px; color: var(--muted); }
  .teacher-schedule-row { width: 100%; display: flex; align-items: center; gap: 14px; border-top: 1px solid var(--border); padding: 17px 24px; text-align: left; transition: background .15s; }
  .teacher-schedule-row:hover { background: var(--surface-2); }
  .teacher-row-copy { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
  .teacher-row-copy > strong { font-size: 13px; font-weight: 620; line-height: 1.5; overflow-wrap: anywhere; }
  .teacher-row-copy > span, .teacher-row-copy > small { font-size: 11px; color: var(--muted); line-height: 1.5; }
  .teacher-row-rate { font-size: 12px; font-weight: 650; color: var(--ink); }
  .teacher-schedule-row > svg { flex-shrink: 0; color: var(--muted); }
  .teacher-list-note { padding: 14px 24px; border-top: 1px solid var(--border); color: var(--muted); font-size: 11px; line-height: 1.6; }
  .teacher-pipeline { padding: 23px 24px; }
  .teacher-pipeline-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 12px; color: var(--muted); }
  .teacher-pipeline-heading strong { font-size: 22px; color: var(--ink); font-weight: 650; letter-spacing: -.035em; }
  .teacher-pipeline-heading strong > span { font-size: 12px; color: var(--muted); font-weight: 400; letter-spacing: 0; }
  .teacher-pipeline-bar { display: flex; gap: 3px; overflow: hidden; height: 9px; border-radius: 5px; margin: 17px 0 20px; background: var(--chalk); }
  .teacher-pipeline-bar > span { min-width: 0; }
  .teacher-home [data-stage="APPLIED"] { background: var(--se); }
  .teacher-home [data-stage="VIEWED"] { background: #6b9bbd; }
  .teacher-home [data-stage="SHORTLISTED"] { background: #8975c0; }
  .teacher-home [data-stage="HIRED"] { background: #529d78; }
  .teacher-home [data-stage="REJECTED"] { background: #9aa5af; }
  .teacher-stage-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 5px; }
  .teacher-stage-grid > button { display: grid; grid-template-columns: 8px 1fr; align-items: center; gap: 6px; border: 1px solid transparent; border-radius: 9px; padding: 9px 5px; text-align: left; }
  .teacher-stage-grid > button:hover, .teacher-stage-grid > button[aria-pressed="true"] { border-color: var(--border); background: var(--surface-2); }
  .teacher-stage-dot { width: 6px; height: 6px; border-radius: 50%; }
  .teacher-stage-grid strong { font-size: 18px; font-weight: 650; font-variant-numeric: tabular-nums; }
  .teacher-stage-grid button > span:last-child { grid-column: 1 / -1; color: var(--muted); font-size: 10px; line-height: 1.5; }
  .teacher-stage-detail { display: flex; align-items: flex-start; gap: 10px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 14px; margin-top: 16px; }
  .teacher-stage-detail svg { flex-shrink: 0; color: var(--se-dark); margin-top: 2px; }
  .teacher-stage-detail p { font-size: 11px; color: var(--muted); line-height: 1.75; }
  .teacher-stage-detail strong { display: block; font-size: 12px; font-weight: 650; color: var(--ink); margin-bottom: 2px; }
  .teacher-invitation, .teacher-job { padding: 22px 24px; border-bottom: 1px solid var(--border); }
  .teacher-invitation:last-child, .teacher-job:last-child { border-bottom: 0; }
  .teacher-invitation-heading { display: flex; align-items: center; gap: 11px; }
  .teacher-invitation-heading > div:nth-child(2) { flex: 1; min-width: 0; }
  .teacher-invitation h3, .teacher-job h3, .teacher-profile-identity h3, .teacher-payout h3 { font-size: 14px; font-weight: 650; line-height: 1.55; letter-spacing: -.015em; overflow-wrap: anywhere; }
  .teacher-invitation-heading p, .teacher-job-top p, .teacher-profile-identity p { font-size: 11px; color: var(--muted); line-height: 1.7; margin-top: 3px; }
  .teacher-invitation-heading > .status-tag { font-size: 10px; padding: 3px 7px; }
  .teacher-invitation-meta { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; font-size: 11px; color: var(--muted); margin-top: 14px; }
  .teacher-invitation-meta strong { color: var(--ink); font-weight: 600; }
  .teacher-invitation-message { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin: 12px 0 0; border-left: 2px solid var(--se-tint-2); padding-left: 10px; font-size: 12px; line-height: 1.75; color: var(--slate); overflow-wrap: anywhere; }
  .teacher-invitation-footer, .teacher-job-bottom { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
  .teacher-invitation-footer > span, .teacher-job-bottom > span { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); font-size: 10px; line-height: 1.6; }
  .teacher-invitation-footer .ui-button { font-size: 11px; }
  .teacher-job-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 15px; }
  .teacher-job-top > div { min-width: 0; }
  .teacher-job-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 9px; }
  .teacher-job-tags .status-tag { font-size: 10px; padding: 2px 6px; }
  .teacher-job h3 { font-size: 15px; }
  .teacher-job h3 button { text-align: left; }
  .teacher-job h3 button:hover { color: var(--se-dark); }
  .teacher-job-pay { font-size: 13px; white-space: nowrap; font-weight: 650; padding-top: 2px; }
  .teacher-job-bottom { margin-top: 10px; margin-bottom: 14px; }
  .teacher-job > div:last-child { padding: 12px; }
  .teacher-side-column .teacher-section-heading { padding: 19px 21px; }
  .teacher-profile-content, .teacher-payout { padding: 22px; }
  .teacher-profile-identity { display: flex; align-items: center; gap: 12px; }
  .teacher-profile-identity > div { min-width: 0; }
  .teacher-profile-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 16px; }
  .teacher-profile-tags .status-tag { font-size: 10px; padding: 3px 7px; }
  .teacher-profile-subjects { margin-top: 13px; font-size: 12px; line-height: 1.75; color: var(--slate); }
  .teacher-profile-checklist { padding: 18px 0 12px; border-top: 1px solid var(--border); margin-top: 18px; }
  .teacher-checklist-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; font-size: 11px; }
  .teacher-checklist-heading strong { font-weight: 650; }
  .teacher-checklist-heading > span { color: var(--muted); font-size: 10px; }
  .teacher-checklist-item { display: flex; width: 100%; text-align: left; align-items: center; gap: 9px; font-size: 11px; padding: 9px 0; line-height: 1.6; }
  .teacher-checklist-item > svg { color: var(--se-dark); flex-shrink: 0; }
  .teacher-checklist-item[data-complete="true"] > svg { color: var(--green); }
  .teacher-checklist-item[data-complete="true"] { color: var(--muted); }
  .teacher-checklist-item:hover { color: var(--se-dark); }
  .teacher-add-label { margin-left: auto; color: var(--se-dark); font-size: 10px; font-weight: 600; }
  .teacher-phone-note { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin-top: 14px; font-size: 10px; line-height: 1.7; color: var(--muted); }
  .teacher-phone-note > button { color: var(--se-dark); text-decoration: underline; text-underline-offset: 3px; }
  .teacher-payout-label { color: var(--muted); font-size: 11px; }
  .teacher-payout > strong { display: block; margin-top: 7px; font-size: 30px; font-weight: 650; letter-spacing: -.04em; font-variant-numeric: tabular-nums; }
  .teacher-payout-pending { display: flex; justify-content: space-between; gap: 10px; padding: 13px 0; border-bottom: 1px solid var(--border); margin-top: 9px; font-size: 11px; color: var(--muted); }
  .teacher-payout-pending b { font-weight: 600; color: var(--ink); }
  .teacher-payout > p { color: var(--muted); font-size: 11px; line-height: 1.85; margin: 13px 0 18px; }
  .teacher-payout-setup { display: grid; place-items: center; width: 42px; height: 42px; color: var(--se-dark); background: var(--se-tint); border-radius: 12px; margin-bottom: 13px; }
  .teacher-message-section .dashboard-messages { box-shadow: none; border: 0; border-radius: 0; }
  .teacher-message-section .msg-list-item { padding: 16px 20px; }
  .teacher-side-column .dashboard-activity { border: 1px solid var(--border); border-radius: 16px; box-shadow: var(--shadow-xs); overflow: hidden; }
  .teacher-side-column .hiring-panel-heading { padding: 20px 21px; }
  .teacher-side-column .hiring-panel-heading h2 { font-size: 16px; }
  .teacher-side-column .dashboard-activity-list > button { flex-wrap: wrap; }
  .teacher-side-column .dashboard-activity-list > button > span:last-child { margin-left: 44px; }
  .teacher-dashboard-footnote { display: flex; align-items: flex-start; gap: 7px; padding: 0 8px; font-size: 10px; line-height: 1.75; color: var(--muted); }
  .teacher-dashboard-footnote svg { flex-shrink: 0; margin-top: 2px; }
  .teacher-empty { display: flex; align-items: center; flex-direction: column; padding: 30px 24px; text-align: center; }
  .teacher-empty > span { display: grid; place-items: center; width: 46px; height: 46px; margin-bottom: 13px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface-2); color: var(--se-dark); }
  .teacher-empty h3 { font-size: 14px; font-weight: 650; line-height: 1.5; }
  .teacher-empty p { max-width: 350px; margin: 6px 0 0; color: var(--muted); font-size: 12px; line-height: 1.8; }
  .teacher-empty .ui-button { margin-top: 15px; }
  .teacher-panel-loading { padding: 24px; }
  .teacher-panel-error { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; padding: 24px; color: var(--slate); }
  .teacher-panel-error > div { flex: 1; min-width: 120px; }
  .teacher-panel-error strong { color: var(--ink); font-size: 12px; font-weight: 600; }
  .teacher-panel-error p { font-size: 11px; color: var(--muted); margin-top: 4px; }
  .teacher-home button:focus-visible, .teacher-home a:focus-visible { outline: 2px solid var(--se); outline-offset: 3px; }
  @media (max-width: 1200px) {
    .teacher-home-columns { grid-template-columns: minmax(0, 1fr) minmax(265px, 300px); gap: 18px; }
    .teacher-metrics { gap: 12px; }
    .teacher-metric { padding: 16px; }
    .teacher-section-heading { padding: 18px; }
    .teacher-stage-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .teacher-row-rate { display: none; }
  }
  @media (max-width: 1000px) {
    .teacher-home-header { align-items: flex-start; flex-direction: column; gap: 18px; }
    .teacher-home-columns { grid-template-columns: minmax(0, 1fr); }
    .teacher-side-column { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
    .teacher-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .teacher-row-rate { display: block; }
    .teacher-stage-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); }
  }
  @media (max-width: 600px) {
    .teacher-home { --teacher-gap: 18px; }
    .teacher-home-header h1 { font-size: 27px; }
    .teacher-header-actions { width: 100%; }
    .teacher-header-actions > .ui-button { flex: 1; }
    .teacher-metric { padding: 14px; }
    .teacher-metric-top { font-size: 11px; align-items: flex-start; }
    .teacher-metric-icon { width: 26px; height: 26px; border-radius: 8px; }
    .teacher-metric-icon > svg { width: 15px; }
    .teacher-metric-caption { font-size: 10px; }
    .teacher-metric-caption > svg { display: none; }
    .teacher-home-columns, .teacher-side-column { grid-template-columns: minmax(0, 1fr); }
    .teacher-next { padding: 21px; }
    .teacher-next-body { align-items: flex-start; gap: 14px; }
    .teacher-next-top { flex-wrap: wrap; gap: 10px; }
    .teacher-next-copy h2 { font-size: 21px; }
    .teacher-next-footer strong { font-size: 16px; }
    .teacher-next .teacher-date-tile { width: 55px; min-height: 75px; }
    .teacher-next-footer .ui-button { padding: 8px 12px; font-size: 11px; }
    .teacher-section-heading { align-items: flex-start; gap: 9px; flex-wrap: wrap; }
    .teacher-section-heading > .ui-button { min-height: 25px; padding-left: 0; }
    .teacher-schedule-toolbar { padding: 15px; }
    .teacher-segmented button { padding: 6px 10px; }
    .teacher-schedule-row { padding: 16px; gap: 11px; }
    .teacher-row-rate { display: none; }
    .teacher-pipeline, .teacher-invitation, .teacher-job { padding: 19px; }
    .teacher-stage-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .teacher-invitation-heading { flex-wrap: wrap; }
    .teacher-invitation-heading > .status-tag { margin-left: 51px; }
    .teacher-job-top { flex-direction: column; gap: 9px; }
    .teacher-profile-content, .teacher-payout { padding: 20px; }
  }
}
```

### UI source: components/styles/account.css

```css
@layer components {
  /* Secure access: a quiet brand panel and a focused, consistent form canvas. */
  .auth-shell { display: grid; align-content: start; min-height: 100svh; background: var(--surface); }
  .auth-aside { position: relative; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; padding: 28px; background: #101a21; color: #fff; }
  .auth-aside-rule { position: absolute; inset: 0 auto 0 0; width: 5px; background: var(--se); }
  .auth-aside::after { content: ""; position: absolute; width: 460px; height: 460px; bottom: -340px; right: -180px; border: 1px solid rgb(var(--se-rgb) / .25); border-radius: 50%; box-shadow: 0 0 0 60px rgb(var(--se-rgb) / .035), 0 0 0 120px rgb(var(--se-rgb) / .025); pointer-events: none; }
  .auth-aside > :not(.auth-aside-rule) { position: relative; z-index: 1; }
  .auth-story { max-width: 470px; margin: 60px 0; }
  .auth-story h1 { font-size: clamp(36px, 3.7vw, 58px); font-weight: 600; line-height: 1.08; letter-spacing: -.045em; text-wrap: balance; }
  .auth-shell-signup .auth-story { margin-top: 36px; margin-bottom: 36px; }
  .auth-shell-signup .auth-story h1 { font-size: clamp(34px, 3.2vw, 48px); }
  .auth-story > p { max-width: 410px; margin-top: 24px; font-size: 15px; line-height: 1.85; color: #aebbc5; }
  .auth-story .eyebrow { margin-bottom: 22px; color: color-mix(in srgb, var(--se) 65%, white); }
  .auth-story-label { display: flex; align-items: center; gap: 9px; margin-bottom: 28px; color: #b9c9d2; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; font-weight: 600; }
  .auth-story-label > span { width: 6px; height: 6px; border-radius: 50%; background: color-mix(in srgb, var(--se) 65%, white); }
  .auth-aside-footer { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; border-top: 1px solid #ffffff14; padding-top: 22px; color: #9aabb7; font-size: 11px; letter-spacing: .01em; }
  .auth-benefits { display: grid; gap: 19px; margin-top: 40px; color: #d0dae1; font-size: 13px; }
  .auth-benefits li { gap: 13px; }
  .auth-benefits li > span:first-child { width: 26px; height: 26px; background: #ffffff0a; color: color-mix(in srgb, var(--se) 65%, white); border: 1px solid #ffffff12; }
  .auth-main { display: flex; align-items: center; justify-content: center; min-width: 0; padding: 48px 28px; }
  .auth-main-inner { width: 100%; max-width: 432px; }
  .auth-main-inner-wide { max-width: 570px; }
  .auth-form-heading { margin-bottom: 28px; }
  .auth-form-heading h2 { font-size: clamp(27px, 2.6vw, 36px); letter-spacing: -.035em; font-weight: 600; line-height: 1.2; }
  .auth-form-heading > p { font-size: 14px; line-height: 1.7; overflow-wrap: anywhere; }
  .auth-form { padding: 0; }
  .auth-form .input, .auth-form .select { min-height: var(--control-height); }
  .auth-form .input { font-size: var(--control-font-size); }
  .auth-security-note { display: flex; flex-wrap: wrap; text-align: center; justify-content: center; align-items: center; gap: 7px; padding-top: 24px; margin-top: 26px; border-top: 1px solid var(--border); font-size: 11px; color: var(--muted); }
  .auth-security-badge { display: inline-flex; align-items: center; gap: 9px; margin-bottom: 27px; color: var(--se-dark); border: 1px solid rgb(var(--se-rgb) / .16); background: var(--se-tint); border-radius: 8px; padding: 10px 12px; font-size: 11px; font-weight: 600; }
  .auth-journey { display: grid; gap: 0; margin-top: 36px; }
  .auth-journey-item { display: flex; align-items: flex-start; gap: 14px; padding: 17px 0; border-top: 1px solid #ffffff12; }
  .auth-journey-item > div:first-child { width: 27px; height: 27px; background: #ffffff08; border: 1px solid #ffffff1c; color: color-mix(in srgb, var(--se) 65%, white); font-size: 11px; }
  .auth-journey-item > div:last-child > div:first-child { font-size: 13px; }
  .auth-journey-item > div:last-child > div:last-child { margin-top: 2px; font-size: 12px; color: #aebbc5; line-height: 1.65; }
  .auth-progress { display: flex; gap: 14px; margin-bottom: 35px; padding-bottom: 24px; border-bottom: 1px solid var(--border); list-style: none; }
  .auth-progress li { display: flex; align-items: center; gap: 7px; color: var(--muted); font-size: 10px; font-weight: 500; }
  .auth-progress-number { display: grid; place-items: center; width: 24px; height: 24px; flex-shrink: 0; border-radius: 50%; border: 1px solid var(--border); font-size: 9px; }
  .auth-progress li[aria-current] { color: var(--ink); font-weight: 650; }
  .auth-progress li[aria-current] .auth-progress-number { background: var(--se-dark); color: #fff; border-color: var(--se-dark); box-shadow: 0 0 0 3px var(--se-tint); }
  .auth-progress li[data-complete="true"] .auth-progress-number { background: var(--se-tint); color: var(--se-dark); border-color: transparent; }
  .signup-credentials > :first-child { grid-column: 1 / -1; }
  .account-role-option { position: relative; min-width: 0; }
  .account-role-option[aria-pressed="true"] { box-shadow: 0 0 0 1px var(--se); }
  .account-role-check { position: absolute; display: grid; place-items: center; width: 18px; height: 18px; top: 16px; right: 16px; border-radius: 50%; border: 1px solid var(--border); color: #fff; }
  .account-role-option[aria-pressed="true"] .account-role-check { background: var(--se); border-color: var(--se-dark); }
  .auth-code-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; }
  .auth-code-grid .auth-code-input { height: 58px; min-width: 0; padding: 0; text-align: center; font-size: 23px; font-weight: 600; font-variant-numeric: tabular-nums; }

  /* Account settings: section navigation, readable field groups and a save dock. */
  .settings-layout { display: grid; grid-template-columns: 195px minmax(0, 1fr); align-items: start; gap: 32px; max-width: 1260px; }
  .settings-content { min-width: 0; }
  .settings-navigation { position: sticky; top: 96px; padding-top: 9px; }
  .settings-navigation-label { margin: 0 12px 14px; color: var(--muted); font-size: 10px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; }
  .settings-navigation nav { display: grid; gap: 4px; }
  .settings-navigation nav a, .settings-navigation nav button { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 43px; padding: 10px 12px; border-radius: 8px; text-align: left; color: var(--muted); font-size: 12px; font-weight: 550; transition: background .16s, color .16s; }
  .settings-navigation nav a.active { background: var(--se-tint); color: var(--se-dark); font-weight: 650; }
  .settings-navigation nav a:hover, .settings-navigation nav button:hover { background: var(--surface); color: var(--ink); }
  .settings-navigation nav button > svg:last-child { margin-left: auto; }
  .settings-navigation-note { display: flex; gap: 10px; padding: 22px 12px 0; margin-top: 22px; border-top: 1px solid var(--border); color: var(--muted); font-size: 11px; line-height: 1.8; }
  .settings-navigation-note > svg { margin-top: 3px; color: var(--se-dark); }
  .settings-profile, .account-notifications, .account-payouts, #settings-details { scroll-margin-top: 110px; }
  .settings-profile-header { padding-top: 5px; }
  .settings-profile-header .section-title { font-size: 10px; text-transform: uppercase; letter-spacing: .09em; color: var(--muted); }
  .settings-profile-header > div { min-width: 0; }
  .settings-profile-header p { overflow-wrap: anywhere; }
  .settings-section-heading { display: flex; align-items: flex-start; gap: 13px; grid-column: 1 / -1; padding-top: 25px; margin: 6px 0 6px; border-top: 1px solid var(--border); }
  .settings-section-heading:first-child { padding-top: 0; border-top: 0; margin-top: 0; }
  .settings-section-heading > span { display: grid; place-items: center; width: 29px; height: 29px; border: 1px solid var(--border); border-radius: 8px; color: var(--se-dark); font-size: 10px; font-weight: 600; }
  .settings-section-heading h2 { color: var(--ink); font-size: 16px; font-weight: 600; line-height: 1.45; letter-spacing: -.015em; }
  .settings-section-heading p { margin-top: 3px; color: var(--muted); font-size: 12px; line-height: 1.6; }
  .settings-save-bar { position: sticky; bottom: 16px; z-index: 10; padding: 14px 18px; border: 1px solid var(--border); border-radius: 12px; background: color-mix(in srgb, var(--surface) 96%, transparent); box-shadow: 0 6px 28px #182c3b0c; backdrop-filter: blur(12px); }
  .account-section-icon { display: grid; place-items: center; width: 41px; height: 41px; margin-bottom: 18px; border: 1px solid rgb(var(--se-rgb) / .1); border-radius: 11px; background: var(--se-tint); color: var(--se-dark); }
  .notification-preference-list > div { min-width: 0; }
  .notification-preference-list > div > div { max-width: 580px; }
  .notification-preference-list > div > div > div:last-child { margin-top: 4px; line-height: 1.7; }
  .settings-autosave-note { display: flex; align-items: center; gap: 7px; margin-top: 18px; color: var(--muted); font-size: 11px; }
  .payout-checkpoint { display: flex; align-items: flex-start; gap: 10px; padding: 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--chalk); }
  .payout-checkpoint-icon { display: grid; place-items: center; flex-shrink: 0; width: 25px; height: 25px; border-radius: 50%; color: var(--muted); background: var(--surface); border: 1px solid var(--border); }
  .payout-checkpoint[data-complete="true"] .payout-checkpoint-icon { background: var(--se-tint); color: var(--se-dark); border-color: transparent; }
  .payout-callback { padding-top: 36px; padding-bottom: 72px; }
  .account-back-link { display: inline-flex; margin-bottom: 28px; color: var(--muted); font-size: 12px; font-weight: 500; }
  .account-back-link:hover { color: var(--se-dark); }
  .security-card-header { background: var(--se-tint); }
  .security-metrics > div { background: var(--surface); border: 0; border-radius: 0; padding: 8px 0 12px; }
  .security-metrics > div > div:first-child { font-size: 10px; letter-spacing: .06em; }
  .security-metrics > div > div:nth-child(2) { font-size: 32px; letter-spacing: -.035em; }
  .account-security-page code { overflow-wrap: anywhere; }

  /* Onboarding gives long forms their own canvas and a persistent progress rail. */
  .onboarding-header { min-height: 76px; }
  .onboarding-layout { display: grid; grid-template-columns: 290px minmax(0, 1fr); gap: 36px; width: 100%; max-width: 1376px; margin: 0 auto; padding: 36px 32px 64px; align-items: start; }
  .onboarding-rail { min-width: 0; padding: 16px 6px 0; position: sticky; top: 28px; }
  .onboarding-rail h1 { color: var(--ink); font-size: 29px; line-height: 1.18; letter-spacing: -.035em; font-weight: 600; }
  
  .onboarding-rail .eyebrow { font-size: 10px; margin-bottom: 16px; }
  .onboarding-rail-inner > div:first-child > p { font-size: 12px; line-height: 1.85; margin-top: 16px; }
  .onboarding-steps { display: grid; gap: 9px; margin-top: 30px; }
  .onboarding-step { display: flex; align-items: flex-start; gap: 12px; width: 100%; padding: 15px 13px; border: 1px solid transparent; border-radius: 11px; text-align: left; transition: border-color .15s, background .15s; }
  .onboarding-step[data-active="true"] { background: var(--surface); border-color: var(--border); box-shadow: 0 2px 4px #182c3b03; }
  .onboarding-step[data-complete="true"]:hover { background: var(--surface); }
  .onboarding-step-number { display: grid; place-items: center; flex-shrink: 0; width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--border); background: transparent; color: var(--muted); font-size: 11px; font-weight: 600; }
  .onboarding-step[data-active="true"] .onboarding-step-number { background: var(--se-dark); border-color: var(--se-dark); color: #fff; box-shadow: 0 0 0 3px var(--se-tint); }
  .onboarding-step[data-complete="true"] .onboarding-step-number { background: var(--se-tint); border-color: transparent; color: var(--se-dark); }
  .onboarding-step-label { display: block; color: var(--ink); font-size: 12px; font-weight: 600; line-height: 1.6; }
  .onboarding-step-description { display: block; margin-top: 3px; color: var(--muted); font-size: 10px; line-height: 1.65; }
  .onboarding-path-note { margin: 30px 13px 0; padding-top: 22px; border-top: 1px solid var(--border); }
  .onboarding-path-note > div:nth-child(2) { font-size: 18px; }
  .onboarding-path-note > p { font-size: 11px; line-height: 1.75; margin-top: 6px; }
  .onboarding-canvas { display: flex; flex-direction: column; min-width: 0; min-height: 660px; padding: 34px; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); box-shadow: 0 4px 18px #182c3b04; }
  .onboarding-canvas-heading { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 22px; padding-bottom: 28px; margin-bottom: 28px; border-bottom: 1px solid var(--border); }
  .onboarding-canvas-heading > div:first-child { flex: 1 1 320px; min-width: 0; }
  .onboarding-canvas-heading h2 { font-size: 29px; letter-spacing: -.03em; }
  .onboarding-canvas-heading p { font-size: 13px; line-height: 1.7; }
  .onboarding-canvas-heading > div:last-child { width: 150px; padding-top: 6px; }
  .onboarding-canvas-heading > div:last-child > div:first-child { font-size: 9px; letter-spacing: .05em; }
  .onboarding-canvas .progress { height: 5px; }
  .onboarding-field-section { border-top: 1px solid var(--border); padding-top: 28px; }
  .onboarding-field-section h3 { font-size: 21px; letter-spacing: -.02em; }
  .onboarding-field-heading { grid-column: 1 / -1; margin-bottom: 21px; }
  .onboarding-field-heading h3 { color: var(--ink); font-size: 16px; font-weight: 600; letter-spacing: -.015em; }
  .onboarding-field-heading p { margin-top: 4px; color: var(--muted); font-size: 12px; line-height: 1.7; }
  .onboarding-actions { margin-top: 34px; }
  .onboarding-actions > div > span { font-size: 9px; letter-spacing: .05em; }
  .onboarding-upload-card { border-style: dashed; box-shadow: none; }
  .onboarding-upload-card[data-uploaded="true"] { border-style: solid; }
  .onboarding-upload-card:focus-within { border-color: var(--se-dark); }
  .upload-file-action { min-height: 39px; }
  .onboarding-review-card > div:first-child { padding-bottom: 17px; border-bottom: 1px solid var(--border); }
  .onboarding-review-card > div:last-child > div { border-radius: 0; background: transparent; padding: 6px 0; }
  .document-preview-frame { height: 65dvh; min-height: 220px; }
  .document-preview > div:first-child > div:first-child { flex: 1 1 180px; }

  /* Application states keep the next checkpoint visible without implying approval. */
  .account-status-shell main { max-width: 1000px; padding-top: 54px; padding-bottom: 54px; }
  .account-status-card { position: relative; overflow: hidden; border-radius: 18px; padding: 42px; box-shadow: 0 8px 34px #182c3b06; }
  .account-status-card::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 4px; background: var(--se); }
  .account-status-card h1 { max-width: 650px; font-size: 39px; line-height: 1.15; letter-spacing: -.035em; }
  .application-checkpoints { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; padding: 25px 0; margin-top: 30px; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
  .application-checkpoints li { display: flex; align-items: flex-start; gap: 10px; }
  .application-checkpoints li > span { display: grid; place-items: center; flex-shrink: 0; width: 30px; height: 30px; border: 1px solid var(--border); border-radius: 50%; color: var(--muted); }
  .application-checkpoints li[data-complete="true"] > span { background: var(--se-tint); color: var(--se-dark); border-color: transparent; }
  .application-checkpoints li[aria-current] > span { background: var(--se-dark); color: #fff; border-color: transparent; }
  .application-checkpoints strong { font-size: 12px; font-weight: 600; }
  .application-checkpoints p { margin-top: 4px; font-size: 10px; line-height: 1.7; color: var(--muted); }
  .account-status-details > div { min-width: 0; }
  .account-status-details > div > div:last-child { font-size: 12px; }

  @media (min-width: 1024px) {
    .auth-shell { grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); }
    .auth-aside { position: sticky; top: 0; min-height: 100svh; height: 100svh; padding: 40px clamp(32px, 4vw, 72px); }
    .auth-main { min-height: 100svh; padding: 52px clamp(32px, 4vw, 72px); }
  }
  @media (max-width: 1199px) {
    .settings-layout { grid-template-columns: 165px minmax(0, 1fr); gap: 22px; }
    .onboarding-layout { grid-template-columns: 240px minmax(0, 1fr); gap: 24px; padding-inline: 24px; }
    .onboarding-canvas { padding: 26px; }
  }
  @media (max-width: 1023px) {
    .auth-aside { padding: 24px 28px; }
    .auth-story { margin: 32px 0 8px; max-width: 630px; }
    .auth-shell-signup .auth-story { margin: 28px 0 8px; }
    .auth-story h1 { font-size: 33px; }
    .auth-story h1 br { display: none; }
    .auth-story > p { max-width: 600px; margin-top: 12px; font-size: 13px; }
    .auth-story-label, .auth-benefits, .auth-journey, .auth-aside-footer { display: none; }
    .auth-story .eyebrow { margin-bottom: 12px; }
    .auth-main { padding: 38px 28px 56px; }
    .auth-form .input, .auth-form .select { font-size: 16px; }
    .onboarding-layout { display: block; max-width: 860px; padding: 24px; }
    .onboarding-rail { position: static; padding: 0 0 25px; }
    .onboarding-rail h1 { font-size: 27px; }
    .onboarding-rail-inner > div:first-child > p { margin-top: 8px; }
    .onboarding-steps { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; margin-top: 22px; }
    .onboarding-steps:has(> button:nth-child(2):last-child) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .onboarding-steps:has(> div:only-child) { grid-template-columns: 1fr; }
    .onboarding-step { flex-direction: column; gap: 9px; padding: 12px; }
    .onboarding-step-description, .onboarding-path-note { display: none; }
    .onboarding-step-label { font-size: 11px; line-height: 1.45; }
    .onboarding-canvas { min-height: 0; }
  }
  @media (max-width: 767px) {
    .settings-layout { grid-template-columns: minmax(0, 1fr); gap: 20px; }
    .settings-navigation { position: static; padding-top: 0; }
    .settings-navigation-label, .settings-navigation-note { display: none; }
    .settings-navigation nav { display: flex; flex-wrap: wrap; gap: 6px; }
    .settings-navigation nav a, .settings-navigation nav button { width: auto; min-height: 39px; padding: 8px 10px; border: 1px solid var(--border); font-size: 11px; background: var(--surface); }
    .settings-navigation nav a svg, .settings-navigation nav button svg { width: 14px; height: 14px; }
    .settings-save-bar { bottom: 9px; padding: 12px; flex-direction: row; }
    .account-status-shell main { padding-top: 28px; padding-bottom: 36px; }
    .account-status-card { padding: 26px; }
    .account-status-card h1 { font-size: 31px; }
    .application-checkpoints { grid-template-columns: 1fr; gap: 22px; }
  }
  @media (max-width: 479px) {
    .auth-aside { padding: 20px; }
    .auth-story { margin-top: 28px; }
    .auth-story h1 { font-size: 28px; }
    .auth-shell-signup .auth-story h1 { font-size: 28px; }
    .auth-shell-signup .auth-story > p { font-size: 12px; line-height: 1.75; }
    .auth-main { padding: 30px 20px 48px; }
    .auth-progress { gap: 12px; margin-bottom: 28px; }
    .auth-progress li { flex-direction: column; align-items: flex-start; gap: 6px; flex: 1; }
    .auth-code-grid { gap: 7px; }
    .auth-code-grid .auth-code-input { height: 50px; font-size: 21px; }
    .onboarding-layout { padding: 20px 16px 36px; }
    .onboarding-canvas { padding: 22px 18px; border-radius: 12px; }
    .onboarding-canvas-heading h2 { font-size: 25px; }
    .onboarding-canvas-heading > div:last-child { width: 100%; }
    .onboarding-steps { gap: 4px; }
    .onboarding-step { padding: 10px 7px; }
    .onboarding-step-label { font-size: 10px; }
    .onboarding-step-number { width: 24px; height: 24px; }
    .onboarding-actions > div > span { text-align: center; }
    .onboarding-actions > button { width: 100%; }
    .account-status-card { padding: 25px 20px; }
    .account-status-shell header { flex-wrap: wrap; gap: 12px; }
  }
  @media (min-width: 1024px) and (max-height: 780px) {
    .auth-aside { position: relative; height: auto; }
    .auth-shell-signup .auth-story { margin-top: 30px; margin-bottom: 30px; }
  }
}
```

### UI source: components/styles/waitlist.css

```css
.waitlist-page {
  background: var(--surface);
  color: var(--ink);
}

/* Waitlist additions sit below the existing public-page hero. */
.marketing-registration-grid.waitlist-registration-grid {
  align-items: start;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}
.waitlist-school-intro,
.waitlist-teacher-intro {
  min-width: 0;
  position: static !important;
  padding-top: 12px;
}
.waitlist-pilot-badge {
  display: inline-block;
  border: 1px solid var(--se-tint-2);
  border-radius: 999px;
  background: var(--se-tint);
  color: var(--se-dark);
  padding: 6px 11px;
  font-size: 11px;
  line-height: 1.6;
}
.marketing-registration-grid > .waitlist-school-intro > h2,
.marketing-registration-grid > .waitlist-teacher-intro > h2 {
  font-family: var(--sans);
  font-size: clamp(35px, 3.7vw, 54px);
  font-weight: 600;
  letter-spacing: -0.04em;
  line-height: 1.08;
  margin: 25px 0 20px;
}
.waitlist-school-intro > p,
.waitlist-teacher-intro > p {
  max-width: 540px;
  color: var(--slate);
  font-size: 16px;
  line-height: 1.75;
}
.waitlist-teacher-registration {
  background: var(--chalk);
}
.waitlist-reference-placeholder {
  display: grid;
  place-items: center;
  min-height: 210px;
  margin-top: 34px;
  padding: 28px;
  border: 1px dashed var(--border-2);
  border-radius: 12px;
  background: var(--chalk);
  color: var(--slate);
  font-size: 12px;
  line-height: 1.7;
  text-align: center;
}
.waitlist-teacher-intro .waitlist-reference-placeholder {
  background: var(--surface);
}
.waitlist-teacher-benefits {
  margin-top: 30px;
  padding: 25px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
}
.waitlist-teacher-benefits h3 {
  font-size: 16px;
  font-weight: 650;
}
.waitlist-teacher-benefits .waitlist-checks {
  margin-top: 17px;
}
.waitlist-teacher-bookings {
  margin-top: 28px;
  border: 1px dashed var(--border-2);
  border-radius: 12px;
  background: var(--surface);
  overflow: hidden;
}
.waitlist-teacher-bookings-body {
  padding: 23px;
}
.waitlist-teacher-profile {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 22px;
  font-size: 14px;
}
.waitlist-teacher-profile p {
  color: var(--slate);
  font-size: 12px;
  margin-top: 5px;
}
.waitlist-teacher-booking-row {
  display: flex;
  align-items: center;
  gap: 12px;
  border-top: 1px solid var(--border);
  padding: 15px 0;
  font-size: 12px;
}
.waitlist-teacher-booking-row svg {
  color: var(--se);
  flex-shrink: 0;
}
.waitlist-teacher-booking-row svg:last-child {
  margin-left: auto;
}
.home-waitlist-sections h2,
.home-waitlist-sections .waitlist-programmes h3,
.home-waitlist-sections .waitlist-steps h4 {
  font-family: var(--sans);
}
.home-waitlist-sections .waitlist-benefit-card,
.home-waitlist-sections .waitlist-programmes article {
  border-radius: 9px;
}
.home-waitlist-sections .waitlist-compliance-grid article {
  border: 1px solid var(--border-2);
  border-radius: 8px;
  padding: 24px 20px;
}
.home-waitlist-sections [id] {
  scroll-margin-top: 140px;
}
.marketing-account .marketing-nav-waitlist {
  margin-right: 10px;
}
@media (max-width: 1000px) {
  .marketing-registration-grid.waitlist-registration-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 640px) {
  .marketing-account .marketing-nav-waitlist {
    display: none;
  }
  .waitlist-school-intro > p {
    font-size: 15px;
  }
  .waitlist-school-intro .waitlist-product-preview {
    display: block;
  }
  .home-waitlist-sections .waitlist-compliance-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
.waitlist-wrap {
  width: min(1200px, calc(100% - 64px));
  margin-inline: auto;
}
.waitlist-header {
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}
.waitlist-header > div {
  display: flex;
  align-items: center;
  min-height: 84px;
  gap: 28px;
}
.waitlist-header nav {
  display: flex;
  gap: 26px;
  margin-left: auto;
  font-size: 14px;
  font-weight: 550;
}
.waitlist-header nav a:hover,
.waitlist-back-link:hover {
  color: var(--se);
}
.waitlist-header > div > .ui-button {
  margin-left: 4px;
}
.waitlist-mobile-menu {
  display: none;
}
.waitlist-header .waitlist-back-link {
  margin-left: auto;
}
.waitlist-hero {
  padding-block: 64px 80px;
  background: linear-gradient(145deg, var(--surface) 20%, var(--se-tint) 170%);
}
.waitlist-hero-grid,
.waitlist-signup-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: start;
  gap: 56px;
}
.waitlist-hero-copy {
  padding-top: 14px;
}
.waitlist-launch {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  color: var(--se-dark);
  font-size: 12px;
  font-weight: 650;
  line-height: 1.7;
  margin-bottom: 25px;
}
.waitlist-page h1,
.waitlist-section-heading h2,
.waitlist-closing h2 {
  font-family: var(--sans);
  font-weight: 600;
  letter-spacing: -0.035em;
}
.waitlist-page h1 {
  font-size: clamp(38px, 4.15vw, 59px);
  line-height: 1.08;
  margin-bottom: 23px;
}
.waitlist-page h1 em {
  color: var(--se-dark);
  font-style: normal;
}
.waitlist-hero-copy > p,
.waitlist-signup-copy > p {
  color: var(--slate);
  font-size: 17px;
  line-height: 1.75;
  max-width: 560px;
}
.waitlist-checks {
  display: grid;
  gap: 14px;
  list-style: none;
  padding: 0;
  margin-top: 26px;
}
.waitlist-checks li {
  display: flex;
  align-items: start;
  gap: 12px;
  line-height: 1.65;
  font-size: 14px;
}
.waitlist-checks svg {
  color: var(--se);
  flex-shrink: 0;
  margin-top: 2px;
}
.waitlist-product-preview {
  margin-top: 38px;
  border: 1px solid var(--border);
  border-radius: 15px;
  background: var(--surface);
  box-shadow: 0 18px 45px #15232d09;
  overflow: hidden;
}
.waitlist-preview-top {
  padding: 15px 19px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  font-weight: 600;
}
.waitlist-preview-top > span:first-child {
  display: flex;
  align-items: center;
  gap: 9px;
}
.waitlist-preview-label {
  color: var(--muted);
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.waitlist-preview-content {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 15px;
  padding: 22px;
}
.waitlist-preview-booking h3 {
  margin: 10px 0 19px;
  font-size: 19px;
  line-height: 1.4;
  font-weight: 600;
}
.waitlist-preview-booking > div {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  font-size: 11px;
  color: var(--slate);
}
.waitlist-preview-profile {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 9px;
  background: var(--se-tint);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 18px 10px;
  text-align: center;
}
.waitlist-profile-avatar {
  width: 58px;
  height: 58px;
  border-radius: 50%;
  background: var(--surface);
  color: var(--se-dark);
  display: grid;
  place-items: center;
}
.waitlist-preview-profile strong {
  font-size: 13px;
}
.waitlist-preview-profile > span:not(.waitlist-profile-avatar) {
  font-size: 10px;
  color: var(--slate);
}
.waitlist-preview-profile > div {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  color: var(--se-dark);
}
.waitlist-join,
.waitlist-page [id] {
  scroll-margin-top: 25px;
}
.waitlist-form,
.waitlist-confirmation {
  min-width: 0;
  background: var(--surface);
  border: 1px solid var(--border-2);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow);
}
.waitlist-form-heading {
  padding: 28px 30px 22px;
  border-bottom: 1px solid var(--border);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  background: var(--se-tint);
}
.waitlist-form-heading h2 {
  font-size: 25px;
  font-weight: 650;
  letter-spacing: -0.025em;
  margin-top: 8px;
  line-height: 1.2;
}
.waitlist-form-heading p {
  color: var(--slate);
  font-size: var(--control-font-size);
  line-height: 1.65;
  margin-top: 9px;
}
.waitlist-form-fields {
  min-width: 0;
  padding: 24px 30px 26px;
}
.waitlist-form-fields:disabled {
  opacity: 0.7;
}
.waitlist-audience {
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 4px;
  background: var(--chalk);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  margin-bottom: 24px;
}
.waitlist-audience button {
  min-width: 0;
  min-height: var(--control-height);
  border-radius: var(--control-radius);
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  padding: 9px;
  font-size: var(--control-font-size);
  font-weight: 600;
  cursor: pointer;
  color: var(--slate);
  transition: color var(--duration-ui) var(--ease-ui), background var(--duration-ui) var(--ease-ui), box-shadow var(--duration-ui) var(--ease-ui);
}
.waitlist-audience button:hover:not([aria-pressed="true"]) {
  background: var(--surface);
  color: var(--ink);
}
.waitlist-audience button[aria-pressed="true"] {
  background: var(--se-dark);
  color: var(--on-brand);
  box-shadow: var(--shadow-xs);
}
.waitlist-audience button:focus-visible {
  outline: 2px solid var(--se);
  outline-offset: 2px;
}
.waitlist-field-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0 16px;
}
.waitlist-form .form-field {
  margin-bottom: 20px;
}
.waitlist-form .input,
.waitlist-form .select {
  width: 100%;
}
.waitlist-checkbox {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 3px 0 21px;
  font-size: var(--control-font-size);
  line-height: 1.65;
  color: var(--slate);
  cursor: pointer;
}
.waitlist-form-privacy {
  margin-top: 15px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--muted);
  text-align: center;
}
.waitlist-form-privacy a {
  color: var(--se-dark);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.waitlist-form-error {
  padding: var(--control-padding-y) var(--control-padding-x);
  border: 1px solid color-mix(in srgb, var(--red) 25%, var(--border));
  border-radius: var(--control-radius);
  background: var(--red-tint);
  color: var(--red);
  font-size: 13px;
  margin-bottom: 15px;
}
.waitlist-section {
  padding-block: 88px;
}
.waitlist-soft-section {
  background: var(--chalk);
  border-block: 1px solid var(--border);
}
.waitlist-section-heading {
  max-width: 690px;
  margin-bottom: 38px;
}
.waitlist-section-heading h2,
.waitlist-closing h2 {
  font-size: clamp(30px, 3.2vw, 43px);
  line-height: 1.15;
  margin-top: 10px;
}
.waitlist-section-heading > p {
  margin-top: 16px;
  font-size: 16px;
  line-height: 1.75;
  color: var(--slate);
}
.waitlist-two-columns {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 24px;
}
.waitlist-benefit-card {
  padding: 34px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 15px;
  display: flex;
  align-items: start;
  flex-direction: column;
}
.waitlist-benefit-card h3 {
  font-size: 25px;
  line-height: 1.3;
  font-weight: 600;
  margin-top: 16px;
  letter-spacing: -0.025em;
}
.waitlist-benefit-card .waitlist-checks {
  margin-bottom: 26px;
}
.waitlist-benefit-card button {
  margin-top: auto;
}
.waitlist-steps-group + .waitlist-steps-group {
  margin-top: 36px;
}
.waitlist-steps {
  list-style: none;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
  margin-top: 18px;
}
.waitlist-steps li {
  border-top: 2px solid var(--ink);
  padding-top: 18px;
}
.waitlist-steps li > span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
}
.waitlist-steps h4 {
  font-size: 19px;
  font-weight: 600;
  margin-top: 12px;
}
.waitlist-steps p {
  font-size: 14px;
  line-height: 1.75;
  color: var(--slate);
  margin-top: 10px;
}
.waitlist-programmes {
  background: var(--se-dark);
  color: white;
}
.waitlist-programmes .eyebrow {
  color: var(--se-tint);
}
.waitlist-programmes .waitlist-section-heading > p {
  color: white;
}
.waitlist-programmes article {
  border: 1px solid #ffffff5c;
  border-radius: 15px;
  padding: 30px;
}
.waitlist-programmes article h3 {
  font-size: 22px;
  font-weight: 600;
  margin: 15px 0;
}
.waitlist-programmes article p {
  margin-top: 12px;
  font-size: 15px;
  line-height: 1.7;
  color: white;
}
.waitlist-programmes article a {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 600;
  margin-top: 23px;
  text-decoration: underline;
  text-underline-offset: 5px;
}
.waitlist-compliance-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 24px;
}
.waitlist-compliance-grid article {
  border-top: 1px solid var(--border-2);
  padding-top: 22px;
}
.waitlist-compliance-grid svg {
  color: var(--se-dark);
}
.waitlist-compliance-grid h3 {
  font-size: 17px;
  font-weight: 600;
  margin: 16px 0 9px;
}
.waitlist-compliance-grid p {
  color: var(--slate);
  font-size: 13px;
  line-height: 1.7;
}
.waitlist-faq-grid {
  display: grid;
  grid-template-columns: 0.8fr 1.2fr;
  gap: 60px;
}
.waitlist-faq details {
  border-bottom: 1px solid var(--border-2);
}
.waitlist-faq summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  min-height: 70px;
  padding-block: 17px;
  cursor: pointer;
  list-style: none;
  font-size: 15px;
  font-weight: 600;
}
.waitlist-faq summary::-webkit-details-marker {
  display: none;
}
.waitlist-faq summary svg {
  flex-shrink: 0;
}
.waitlist-faq details[open] summary svg {
  transform: rotate(45deg);
}
.waitlist-faq p {
  color: var(--slate);
  font-size: 14px;
  line-height: 1.8;
  padding-bottom: 23px;
}
.waitlist-closing {
  text-align: center;
}
.waitlist-closing p {
  color: var(--slate);
  font-size: 16px;
  line-height: 1.7;
  margin: 18px 0 26px;
}
.waitlist-closing .waitlist-wrap > div {
  display: flex;
  gap: 14px;
  justify-content: center;
  flex-wrap: wrap;
}
.waitlist-signup-grid {
  padding-block: 65px 85px;
  gap: 70px;
}
.waitlist-signup-copy h1 {
  margin-top: 20px;
  font-size: clamp(36px, 3.8vw, 51px);
}
.waitlist-signup-copy > h2 {
  margin-top: 35px;
  font-size: 19px;
  font-weight: 600;
}
.waitlist-signup-copy .waitlist-checks {
  margin-top: 17px;
}
.waitlist-teacher-preview {
  background: var(--chalk);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 26px;
  margin-top: 38px;
}
.waitlist-teacher-preview > div:first-child {
  display: flex;
  gap: 12px;
  align-items: center;
  color: var(--se-dark);
}
.waitlist-teacher-preview p {
  color: var(--slate);
  font-size: 13px;
  margin-top: 10px;
}
.waitlist-week {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
  margin: 22px 0;
}
.waitlist-week > span {
  display: grid;
  justify-items: center;
  gap: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 9px;
  padding: 13px 4px;
  font-size: 11px;
  color: var(--muted);
}
.waitlist-week .available {
  background: var(--se-tint);
  color: var(--se-dark);
  border-color: var(--se);
}
.waitlist-confirmation-header {
  background: var(--se-tint);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  padding: 30px;
}
.waitlist-success-icon {
  display: grid;
  place-items: center;
  width: 49px;
  height: 49px;
  background: var(--se);
  color: white;
  border-radius: 50%;
  margin-bottom: 20px;
}
.waitlist-confirmation h2 {
  font-size: 28px;
  line-height: 1.2;
  letter-spacing: -0.025em;
  margin-top: 10px;
  font-weight: 650;
}
.waitlist-confirmation h2:focus {
  outline: none;
}
.waitlist-confirmation p {
  font-size: 13px;
  line-height: 1.75;
  color: var(--slate);
  margin-top: 12px;
  overflow-wrap: anywhere;
}
.waitlist-confirmation-body {
  padding: 28px 30px;
}
.waitlist-confirmation h3 {
  font-size: 17px;
  font-weight: 650;
}
.waitlist-next-steps {
  padding-left: 22px;
  margin-top: 18px;
}
.waitlist-next-steps li {
  padding-left: 7px;
  margin-bottom: 19px;
  font-size: 13px;
}
.waitlist-next-steps strong,
.waitlist-next-steps span {
  display: block;
}
.waitlist-next-steps span {
  color: var(--slate);
  margin-top: 6px;
  line-height: 1.7;
}
.waitlist-extra-details,
.waitlist-share {
  border-top: 1px solid var(--border);
  margin-top: 26px;
  padding-top: 26px;
}
.waitlist-extra-details h3 > span {
  font-size: 13px;
  color: var(--muted);
  font-weight: 400;
}
.waitlist-extra-details fieldset {
  margin-top: 19px;
  min-width: 0;
}
.waitlist-extra-details legend {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 12px;
}
.waitlist-phase-options {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 18px;
  margin-bottom: 22px;
}
.waitlist-phase-options label {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  font-size: var(--control-font-size);
  cursor: pointer;
}
.waitlist-share > .input {
  margin-top: 14px;
}
.waitlist-share-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 13px;
  margin-top: 14px;
}
.waitlist-share-actions a {
  font-size: 12px;
  color: var(--se-dark);
  text-decoration: underline;
}
.waitlist-back-link {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-size: 13px;
  font-weight: 600;
}
.waitlist-confirmation .waitlist-back-link {
  margin-top: 20px;
}
@media (max-width: 1050px) {
  .waitlist-hero-grid,
  .waitlist-signup-grid {
    gap: 30px;
  }
  .waitlist-header nav {
    gap: 17px;
    font-size: 12px;
  }
  .waitlist-form-heading,
  .waitlist-form-fields {
    padding-inline: 22px;
  }
  .waitlist-preview-content {
    grid-template-columns: 1fr;
  }
  .waitlist-preview-profile {
    display: none;
  }
}
@media (max-width: 760px) {
  .waitlist-wrap {
    width: calc(100% - 40px);
  }
  .waitlist-header > div {
    min-height: 72px;
    gap: 12px;
  }
  .waitlist-header .waitlist-desktop-nav {
    display: none;
  }
  .waitlist-header > div > .ui-button {
    margin-left: auto;
    font-size: 11px;
  }
  .waitlist-mobile-menu {
    display: block;
    position: relative;
  }
  .waitlist-mobile-menu summary {
    cursor: pointer;
    list-style: none;
    padding: 6px;
  }
  .waitlist-mobile-menu summary::-webkit-details-marker {
    display: none;
  }
  .waitlist-header .waitlist-mobile-menu nav {
    position: absolute;
    right: 0;
    top: 42px;
    width: 200px;
    display: flex;
    flex-direction: column;
    padding: 20px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: var(--shadow);
    z-index: 20;
    font-size: 14px;
  }
  .waitlist-hero {
    padding-block: 34px 45px;
  }
  .waitlist-hero-grid,
  .waitlist-signup-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 32px;
  }
  .waitlist-hero-copy {
    padding-top: 0;
  }
  .waitlist-launch {
    font-size: 11px;
    margin-bottom: 19px;
  }
  .waitlist-launch > span {
    flex-basis: 100%;
  }
  .waitlist-page h1 {
    font-size: clamp(36px, 8vw, 49px);
    max-width: 600px;
  }
  .waitlist-hero-copy > p,
  .waitlist-signup-copy > p {
    font-size: 15px;
  }
  .waitlist-product-preview,
  .waitlist-teacher-preview {
    display: none;
  }
  .waitlist-checks {
    gap: 12px;
    margin-top: 21px;
  }
  .waitlist-checks li {
    font-size: 13px;
  }
  .waitlist-section {
    padding-block: 48px;
  }
  .waitlist-section-heading {
    margin-bottom: 26px;
  }
  .waitlist-section-heading > p {
    font-size: 14px;
  }
  .waitlist-two-columns,
  .waitlist-faq-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 20px;
  }
  .waitlist-benefit-card,
  .waitlist-programmes article {
    padding: 26px;
  }
  .waitlist-benefit-card h3 {
    font-size: 23px;
  }
  .waitlist-steps {
    grid-template-columns: minmax(0, 1fr);
    gap: 22px;
  }
  .waitlist-steps li {
    padding-top: 13px;
  }
  .waitlist-compliance-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 26px 20px;
  }
  .waitlist-faq summary {
    font-size: 14px;
  }
  .waitlist-signup-grid {
    padding-block: 35px 50px;
  }
  .waitlist-signup-copy h1 {
    font-size: 36px;
  }
  .waitlist-signup-copy > h2 {
    margin-top: 25px;
  }
  .waitlist-confirmation-header,
  .waitlist-confirmation-body {
    padding: 25px 22px;
  }
}
@media (max-width: 420px) {
  .waitlist-audience {
    grid-template-columns: minmax(0, 1fr);
  }
  .waitlist-field-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .waitlist-form-heading,
  .waitlist-form-fields {
    padding-inline: 18px;
  }
  .waitlist-form-heading h2 {
    font-size: 23px;
  }
  .waitlist-audience button {
    gap: 6px;
  }
  .waitlist-header > div > .ui-button {
    padding-inline: 10px;
  }
  .waitlist-benefit-card,
  .waitlist-programmes article {
    padding: 22px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .waitlist-page {
    scroll-behavior: auto;
  }
}
```

### UI source: components/styles/my-profile.css

```css
@layer components {
  .my-profile { max-width: 1480px; }
  .my-profile-hero { position: relative; overflow: hidden; border: 1px solid var(--border); border-radius: 18px; background: linear-gradient(115deg, var(--surface) 35%, var(--se-tint)); box-shadow: var(--shadow-xs); }
  .my-profile-hero-main { display: flex; align-items: center; gap: 26px; padding: 32px; }
  .my-profile-avatar { flex-shrink: 0; padding: 6px; border: 1px solid var(--border); border-radius: 50%; background: var(--surface); box-shadow: var(--shadow-xs); }
  .my-profile-identity { flex: 1; min-width: 0; }
  .my-profile-eyebrow { display: flex; align-items: center; gap: 6px; color: var(--se-dark); font-size: 10px; font-weight: 650; letter-spacing: .07em; text-transform: uppercase; }
  .my-profile-identity h2 { margin-top: 9px; color: var(--ink); font-size: clamp(24px, 2.5vw, 36px); font-weight: 650; line-height: 1.2; letter-spacing: -.035em; overflow-wrap: anywhere; }
  .my-profile-meta { display: flex; flex-wrap: wrap; gap: 8px 20px; margin-top: 14px; color: var(--slate); font-size: 12px; }
  .my-profile-meta > span, .my-profile-private { display: inline-flex; align-items: center; gap: 6px; }
  .my-profile-badges { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 17px; }
  .my-profile-private { color: var(--muted); font-size: 11px; }
  .my-profile-reputation { display: flex; flex-direction: column; align-items: center; min-width: 164px; padding-left: 28px; border-left: 1px solid var(--border); }
  .my-profile-reputation > strong { display: block; margin: 10px 0; font-size: 38px; font-weight: 650; line-height: 1.15; letter-spacing: -.04em; }
  .my-profile-reputation > strong > small { color: var(--muted); font-size: 14px; font-weight: 450; letter-spacing: 0; }
  .my-profile-reputation > button { display: flex; align-items: center; gap: 6px; margin-top: 12px; color: var(--se-dark); font-size: 11px; font-weight: 600; }
  .my-profile-hero-footer { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 30px; border-top: 1px solid var(--border); background: var(--surface); }
  .my-profile-hero-footer > span { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 12px; }
  .my-profile-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin: 22px 0 28px; }
  .my-profile-stat { min-width: 0; padding: 20px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); text-align: left; transition: border-color 150ms ease, box-shadow 150ms ease; }
  .my-profile-stat:hover { border-color: var(--se); box-shadow: var(--shadow); }
  .my-profile-stat-top { display: flex; align-items: center; justify-content: space-between; color: var(--muted); }
  .my-profile-stat > strong { display: block; margin-top: 15px; color: var(--ink); font-size: 30px; line-height: 1.2; font-weight: 650; letter-spacing: -.035em; font-variant-numeric: tabular-nums; }
  .my-profile-stat-label { display: block; margin-top: 5px; color: var(--graphite); font-size: 12px; font-weight: 600; }
  .my-profile-stat > small { display: block; margin-top: 6px; color: var(--muted); font-size: 10px; line-height: 1.6; }
  .my-profile-section-nav { display: flex; flex-wrap: wrap; gap: 8px 24px; margin-bottom: 22px; padding: 0 2px 16px; border-bottom: 1px solid var(--border); }
  .my-profile-section-nav a { display: inline-flex; align-items: center; gap: 8px; padding: 5px 0; color: var(--se-dark); font-size: 13px; font-weight: 600; }
  .my-profile-section-nav a:hover { text-decoration: underline; text-underline-offset: 5px; }
  .my-profile-columns { display: grid; grid-template-columns: minmax(0, 1fr); gap: 28px; }
  .my-profile-details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; min-width: 0; scroll-margin-top: 98px; }
  .my-profile-details > .my-profile-section:first-child,
  .my-profile-details > .my-profile-section:last-child { grid-column: 1 / -1; }
  .my-profile-details > .my-profile-section:first-child .my-profile-about { max-width: 85ch; }
  .my-profile-details > .my-profile-section:last-child .my-profile-detail-body { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px; }
  .my-profile-details > .my-profile-section:last-child .my-profile-facts { flex: 1; min-width: 240px; }
  .my-profile-details > .my-profile-section:last-child .ui-button { margin-top: 0; }
  .my-profile-details[data-role="teacher"] > .my-profile-section:nth-child(4) { grid-column: 1 / -1; }
  .my-profile-details[data-role="teacher"] > .my-profile-section:nth-child(4) .my-profile-detail-body { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 20px; }
  .my-profile-details[data-role="teacher"] > .my-profile-section:nth-child(4) .my-profile-facts { grid-template-columns: minmax(0, 1fr); }
  .my-profile-details[data-role="teacher"] > .my-profile-section:nth-child(4) .my-profile-detail-tags { margin: 0; padding: 0 0 0 20px; border-top: 0; border-left: 1px solid var(--border); }
  .my-profile-details[data-role="teacher"] > .my-profile-section:last-child { grid-column: auto; }
  .my-profile-details[data-role="teacher"] > .my-profile-section:last-child .my-profile-detail-body { display: block; }
  .my-profile-details[data-role="teacher"] > .my-profile-section:last-child .ui-button { margin-top: 16px; }
  .my-profile-history { min-width: 0; scroll-margin-top: 98px; }
  .my-profile-section { min-width: 0; overflow: hidden; border: 1px solid var(--border); border-radius: 13px; background: var(--surface); box-shadow: var(--shadow-xs); }
  .my-profile-detail-heading { display: flex; align-items: center; gap: 9px; padding: 19px 22px; border-bottom: 1px solid var(--border); color: var(--se-dark); }
  .my-profile-detail-heading h2 { color: var(--ink); font-size: 13px; font-weight: 650; }
  .my-profile-detail-body { padding: 20px 22px; }
  .my-profile-about { white-space: pre-line; overflow-wrap: anywhere; color: var(--slate); font-size: 13px; line-height: 1.9; }
  .my-profile-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px 26px; }
  .my-profile-facts dt { margin-bottom: 4px; color: var(--muted); font-size: 11px; }
  .my-profile-facts dd { color: var(--graphite); font-size: 13px; line-height: 1.6; font-weight: 500; overflow-wrap: anywhere; }
  .my-profile-detail-tags { margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--border); }
  .my-profile-detail-tags h3 { margin-bottom: 9px; color: var(--muted); font-size: 11px; }
  .my-profile-detail-tags > div { display: flex; flex-wrap: wrap; gap: 6px; }
  .my-profile-section-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 25px 26px; }
  .my-profile-section-heading h2 { margin-top: 6px; color: var(--ink); font-size: 22px; font-weight: 650; letter-spacing: -.025em; }
  .my-profile-section-heading p { margin-top: 5px; color: var(--muted); font-size: 12px; }
  .my-profile-section-heading > svg { color: var(--se-dark); }
  .my-profile-tabs { display: flex; gap: 4px; overflow-x: auto; padding: 0 18px; border-bottom: 1px solid var(--border); background: var(--surface-2); scrollbar-width: thin; }
  .my-profile-tabs > button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; flex: 1; min-height: 54px; padding: 12px 10px; border-bottom: 2px solid transparent; color: var(--slate); font-size: 12px; font-weight: 550; white-space: nowrap; }
  .my-profile-tabs > button[aria-selected="true"] { border-bottom-color: var(--se); color: var(--se-dark); }
  .my-profile-tabs > button > span { padding: 1px 6px; border-radius: 5px; background: var(--border); font-size: 10px; }
  .my-profile-tabs > button[aria-selected="true"] > span { background: var(--se-tint); }
  .my-profile-tab-panel { min-height: 360px; padding: 24px; }
  .my-profile-tab-panel:focus-visible { outline-offset: -3px; }
  .my-profile-activity-heading { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 22px; }
  .my-profile-activity-heading h3 { color: var(--ink); font-size: 15px; font-weight: 650; }
  .my-profile-activity-heading p { max-width: 330px; margin-top: 5px; color: var(--muted); font-size: 12px; line-height: 1.7; }
  .my-profile-records { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  .my-profile-record { display: flex; align-items: flex-start; gap: 14px; padding: 19px; border: 1px solid var(--border); border-radius: 10px; }
  .my-profile-record-icon { display: inline-flex; flex-shrink: 0; align-items: center; justify-content: center; width: 36px; height: 36px; border: 1px solid var(--se-tint-2); border-radius: 9px; color: var(--se-dark); background: var(--se-tint); }
  .my-profile-record-copy { flex: 1; min-width: 0; }
  .my-profile-record-top { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: 10px; }
  .my-profile-record-top h3 { flex: 1; min-width: min(180px, 100%); color: var(--ink); font-size: 13px; line-height: 1.7; font-weight: 650; overflow-wrap: anywhere; }
  .my-profile-record-copy > p, .my-profile-review-person p { margin-top: 4px; color: var(--muted); font-size: 12px; line-height: 1.7; overflow-wrap: anywhere; }
  .my-profile-record-meta { display: flex; flex-wrap: wrap; gap: 7px 16px; margin-top: 12px; color: var(--slate); font-size: 11px; }
  .my-profile-record-meta > span { display: flex; align-items: center; gap: 5px; overflow-wrap: anywhere; }
  .my-profile-record-actions { display: flex; flex-wrap: wrap; gap: 4px 10px; margin-top: 12px; }
  .my-profile-record-actions > .ui-button { padding: 6px 0; color: var(--se-dark); font-size: 11px; }
  .my-profile-review-switch { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 18px; padding: 5px; border: 1px solid var(--border); border-radius: 9px; background: var(--chalk); }
  .my-profile-review-switch > button { display: flex; flex: 1; align-items: center; justify-content: center; gap: 9px; min-height: 38px; padding: 7px 12px; border-radius: 6px; color: var(--muted); font-size: 12px; font-weight: 550; }
  .my-profile-review-switch > button[aria-pressed="true"] { color: var(--se-dark); background: var(--surface); box-shadow: var(--shadow-xs); }
  .my-profile-review-switch > button > span { font-size: 10px; }
  .my-profile-review { padding: 21px; border: 1px solid var(--border); border-radius: 10px; }
  .my-profile-review-person { display: flex; gap: 10px; align-items: center; min-width: 0; }
  .my-profile-review-person h3 { min-width: 0; }
  .my-profile-review-rating { display: grid; justify-items: end; gap: 5px; font-size: 10px; color: var(--muted); }
  .my-profile-review-comment { margin-top: 18px; color: var(--slate); font-size: 13px; line-height: 1.9; white-space: pre-line; overflow-wrap: anywhere; }
  .my-profile-pagination { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; padding-top: 22px; color: var(--muted); font-size: 11px; }
  .my-profile-pagination > div { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px; }
  .my-profile-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 38px 18px; border: 1px dashed var(--border-2); border-radius: 11px; background: var(--surface-2); text-align: center; }
  .my-profile-empty h3 { color: var(--ink); font-size: 15px; font-weight: 600; }
  .my-profile-empty p { max-width: 340px; color: var(--muted); font-size: 12px; line-height: 1.8; }
  .my-profile-refresh { margin-bottom: 12px; color: var(--muted); font-size: 11px; }
  .my-profile-shortcuts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 20px; }
  .my-profile-shortcuts > button { display: flex; align-items: center; gap: 12px; min-width: 0; padding: 19px; border: 1px solid var(--border); border-radius: 11px; background: var(--surface); text-align: left; transition: border-color 150ms ease; }
  .my-profile-shortcuts > button:hover { border-color: var(--se); }
  .my-profile-shortcuts > button > span:nth-child(2) { flex: 1; min-width: 0; }
  .my-profile-shortcuts strong { display: block; color: var(--ink); font-size: 12px; font-weight: 600; }
  .my-profile-shortcuts small { display: block; margin-top: 5px; color: var(--muted); font-size: 10px; line-height: 1.6; }
  .my-profile-shortcuts > button > svg { color: var(--muted); }
  @media (max-width: 1200px) {
    .my-profile-hero-main { padding: 26px; gap: 20px; }
    .my-profile-reputation { min-width: 135px; padding-left: 20px; }
    .my-profile-tabs { padding-inline: 9px; }
    .my-profile-tab-panel { padding: 18px; }
    .my-profile-records { grid-template-columns: minmax(0, 1fr); }
  }
  @media (max-width: 1050px) {
    .my-profile-hero-main { flex-wrap: wrap; }
    .my-profile-reputation { flex-direction: row; justify-content: space-between; flex-wrap: wrap; gap: 12px; width: 100%; padding: 16px 0 0; border-left: 0; border-top: 1px solid var(--border); }
    .my-profile-reputation > strong { margin: 0; font-size: 26px; }
    .my-profile-reputation > button { margin-top: 0; }
  }
  @media (max-width: 900px) {
    .my-profile-details[data-role="teacher"] > .my-profile-section:nth-child(4) .my-profile-detail-body { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .my-profile-details[data-role="teacher"] > .my-profile-section:nth-child(4) .my-profile-detail-tags { padding-left: 0; border-left: 0; }
  }
  @media (max-width: 639px) {
    .my-profile-hero-main { align-items: flex-start; gap: 16px; padding: 22px 18px; }
    .my-profile-avatar { padding: 4px; }
    .my-profile-avatar > div { width: 56px; height: 56px; font-size: 20px; }
    .my-profile-identity h2 { font-size: 24px; }
    .my-profile-hero-footer { padding: 11px 16px; flex-wrap: wrap; }
    .my-profile-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 16px 0 20px; }
    .my-profile-stat { padding: 16px; }
    .my-profile-stat > strong { font-size: 27px; }
    .my-profile-details { grid-template-columns: minmax(0, 1fr); }
    .my-profile-details[data-role="teacher"] > .my-profile-section:nth-child(4) .my-profile-detail-body { grid-template-columns: minmax(0, 1fr); }
    .my-profile-details[data-role="teacher"] > .my-profile-section:nth-child(4) .my-profile-detail-tags { padding-top: 18px; border-top: 1px solid var(--border); }
    .my-profile-facts { grid-template-columns: minmax(0, 1fr); }
    .my-profile-shortcuts { grid-template-columns: minmax(0, 1fr); }
    .my-profile-section-heading { padding: 22px 18px; }
    .my-profile-tabs > button { font-size: 11px; padding-inline: 9px; }
    .my-profile-tabs > button > svg { display: none; }
    .my-profile-tab-panel { padding: 16px; }
    .my-profile-record { padding: 15px; gap: 10px; }
    .my-profile-record > .my-profile-record-icon { display: none; }
    .my-profile-review { padding: 16px; }
    .my-profile-review-switch > button { padding-inline: 8px; font-size: 11px; }
    .my-profile-pagination { justify-content: center; }
    .my-profile-activity-heading > .ui-button { width: 100%; }
  }
}
```

### UI source: components/atoms/Field.tsx

```tsx
"use client";

import { Children, cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";

type ControlProps = {
  id?: string;
  children?: ReactNode;
  value?: unknown;
  type?: string;
  onChange?: unknown;
  "aria-describedby"?: string;
  "aria-labelledby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-required"?: boolean;
};

function findControl(nodes: ReactNode, htmlFor?: string): ReactElement<ControlProps> | undefined {
  for (const child of Children.toArray(nodes)) {
    if (!isValidElement<ControlProps>(child)) continue;
    const props = child.props;
    const native = typeof child.type === "string" && ["input", "select", "textarea"].includes(child.type) && props.type !== "hidden";
    const custom = typeof child.type !== "string" && "value" in props && "onChange" in props;
    if ((native || custom) && (!htmlFor || !props.id || props.id === htmlFor)) return child;
    const nested = findControl(props.children, htmlFor);
    if (nested) return nested;
  }
}

function associateControl(nodes: ReactNode, target: ReactElement<ControlProps>, attributes: Partial<ControlProps>): ReactNode {
  return Children.map(nodes, (child) => {
    if (!isValidElement<ControlProps>(child)) return child;
    // Children.toArray assigns keys, so props identity identifies the original control.
    if (child.props === target.props) return cloneElement(child, attributes);
    return child.props.children ? cloneElement(child, { children: associateControl(child.props.children, target, attributes) }) : child;
  });
}

export function Field({
  label,
  children,
  hint,
  error,
  htmlFor,
  required,
}: {
  label?: string;
  children: ReactNode;
  hint?: string;
  error?: string;
  htmlFor?: string;
  required?: boolean;
}) {
  const generatedId = useId();
  const labelId = `${generatedId}-label`;
  const messageId = `${generatedId}-message`;
  const target = findControl(children, htmlFor);
  const controlId = target?.props.id || htmlFor || `${generatedId}-control`;
  // Link controls inside layout wrappers without changing validation rules.
  const controls = target ? associateControl(children, target, {
    id: controlId,
    "aria-labelledby": target.props["aria-labelledby"] || (label ? labelId : undefined),
    "aria-describedby": [target.props["aria-describedby"], error || hint ? messageId : undefined].filter(Boolean).join(" ") || undefined,
    "aria-invalid": error ? true : target.props["aria-invalid"],
    "aria-required": required || target.props["aria-required"],
  }) : children;
  return (
    <div className="form-field mb-5 min-w-0" data-invalid={error ? true : undefined}>
      {label ? (
        <label id={labelId} className="field-label mb-2 block text-[13px] font-semibold leading-5 text-graphite" htmlFor={target || htmlFor ? controlId : undefined}>
          {label}
          {required ? <span aria-hidden="true" className="ml-1 text-danger">*</span> : null}
        </label>
      ) : null}
      {controls}
      {error ? <div id={messageId} className="mt-2 text-xs font-medium leading-5 text-danger" role="alert">{error}</div> : null}
      {!error && hint ? <div id={messageId} className="mt-2 text-xs leading-5 text-muted">{hint}</div> : null}
    </div>
  );
}
```

### UI source: components/molecules/OptionDropdowns.tsx

```tsx
"use client";

import { Fragment, type AriaAttributes, type KeyboardEvent, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { Icon } from "../atoms";

export type SelectOption = { group?: string; keywords?: string; description?: string | null; label: string; value: string };
type DropdownProps = AriaAttributes & {
  id?: string;
  name?: string;
  className?: string;
  options: readonly (string | SelectOption)[];
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
  required?: boolean;
  searchable?: boolean;
  maxSelections?: number;
};
type SelectDropdownProps = DropdownProps & { value: string; onChange: (value: string) => void };
type MultiSelectDropdownProps = DropdownProps & { value: string[]; onChange: (value: string[]) => void };

function normalizeOption(option: string | SelectOption): SelectOption {
  return typeof option === "string" ? { label: option, value: option } : option;
}

/** One control, menu and keyboard model for single, multiple and searchable selections. */
function OptionDropdown({
  id, name, className, value, options, onChange, placeholder, error,
  disabled = false, required, searchable = false, multiple = false, maxSelections, ...aria
}: DropdownProps & { value: string[]; onChange: (value: string[]) => void; placeholder: string; multiple?: boolean }) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const listId = `${controlId}-options`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [nativeInvalid, setNativeInvalid] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const clearRef = useRef<HTMLButtonElement>(null);
  const typeaheadRef = useRef({ text: "", time: 0 });
  const normalizedOptions = options.map(normalizeOption);
  const filteredOptions = normalizedOptions.filter((option) => `${option.label} ${option.keywords ?? ""}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const labels = value.map((item) => normalizedOptions.find((option) => option.value === item)?.label ?? item);
  const summary = labels.length > 2 ? `${labels.slice(0, 2).join(", ")} +${labels.length - 2} more` : labels.join(", ");
  const activeOptionId = filteredOptions[activeIndex] ? `${listId}-${activeIndex}` : undefined;
  const isOpen = open && !disabled;

  function close(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }
  function show(fromEnd = false) {
    setQuery("");
    const selectedIndex = normalizedOptions.findIndex((option) => value.includes(option.value));
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : fromEnd ? normalizedOptions.length - 1 : 0);
    setOpen(true);
  }
  function change(next: string[]) {
    setNativeInvalid(false);
    onChange(next);
  }
  function choose(option: SelectOption) {
    if (multiple && maxSelections && value.length >= maxSelections && !value.includes(option.value)) return;
    if (multiple) change(value.includes(option.value) ? value.filter((item) => item !== option.value) : [...value, option.value]);
    else { change([option.value]); close(true); }
  }

  useLayoutEffect(() => {
    if (!isOpen) return;
    const menu = menuRef.current;
    const trigger = triggerRef.current;
    if (!menu || !trigger) return;
    // Top-layer menus escape overflow without leaving a parent dialog's DOM/focus scope.
    menu.showPopover?.();
    function position() {
      if (!menu || !trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft ?? 0;
      const top = viewport?.offsetTop ?? 0;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const gap = 6;
      const margin = 8;
      if (rect.bottom < top || rect.top > top + viewportHeight) {
        setOpen(false);
        return;
      }
      const below = top + viewportHeight - rect.bottom - gap - margin;
      const above = rect.top - top - gap - margin;
      const openAbove = below < 260 && above > below;
      const availableHeight = Math.max(0, openAbove ? above : below);
      const width = Math.min(rect.width, viewportWidth - margin * 2);
      menu.style.width = `${width}px`;
      menu.style.left = `${Math.max(left + margin, Math.min(rect.left, left + viewportWidth - width - margin))}px`;
      menu.style.maxHeight = `${Math.min(360, availableHeight)}px`;
      menu.style.top = `${openAbove ? Math.max(top + margin, rect.top - gap - menu.offsetHeight) : rect.bottom + gap}px`;
    }
    position();
    searchRef.current?.focus({ preventScroll: true });
    const observer = new ResizeObserver(position);
    observer.observe(trigger);
    observer.observe(menu);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    window.visualViewport?.addEventListener("resize", position);
    window.visualViewport?.addEventListener("scroll", position);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      window.visualViewport?.removeEventListener("resize", position);
      window.visualViewport?.removeEventListener("scroll", position);
      if (menu.matches(":popover-open")) menu.hidePopover?.();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function dismissOutside(event: Event) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("focusin", dismissOutside);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("focusin", dismissOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && activeOptionId) document.getElementById(activeOptionId)?.scrollIntoView({ block: "nearest" });
  }, [activeOptionId, isOpen]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const inSearch = event.target === searchRef.current;
    const inClear = event.target === clearRef.current;
    if (isOpen && event.key === "Escape") {
      event.preventDefault(); event.stopPropagation(); close(true); return;
    }
    if (event.key === "Tab" && isOpen) {
      if (!event.shiftKey && !inClear && clearRef.current) {
        event.preventDefault(); clearRef.current.focus();
      } else if (event.shiftKey && inClear) {
        event.preventDefault(); (searchRef.current ?? triggerRef.current)?.focus();
      } else {
        // Restore the field's position in tab order before native Tab advances.
        triggerRef.current?.focus(); close();
      }
      return;
    }
    if (inClear) return;
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) && (!inSearch || !["Home", "End"].includes(event.key))) {
      event.preventDefault();
      if (!isOpen) { show(event.key === "ArrowUp" || event.key === "End"); return; }
      const last = filteredOptions.length - 1;
      setActiveIndex(event.key === "Home" ? 0 : event.key === "End" ? last : Math.max(0, Math.min(last, activeIndex + (event.key === "ArrowDown" ? 1 : -1))));
      return;
    }
    if (isOpen && (event.key === "Enter" || (event.key === " " && !inSearch))) {
      event.preventDefault();
      const option = filteredOptions[activeIndex];
      if (option) choose(option);
      return;
    }
    if (!inSearch && event.key.length === 1 && event.key !== " " && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = event.timeStamp;
      const previous = typeaheadRef.current;
      const text = now - previous.time < 700 ? previous.text + event.key : event.key;
      typeaheadRef.current = { text, time: now };
      if (!isOpen) show();
      if (searchable) { setQuery(text); setActiveIndex(0); }
      else {
        const index = normalizedOptions.findIndex((option) => option.label.toLocaleLowerCase().startsWith(text.toLocaleLowerCase()));
        if (index >= 0) setActiveIndex(index);
      }
    }
  }

  return (
    <div ref={rootRef} className="option-dropdown" onKeyDownCapture={handleKeyDown}>
      {name || required ? (
        <select
          className="option-native-control" aria-hidden="true" tabIndex={-1} name={name} required={required} disabled={disabled}
          multiple={multiple} value={multiple ? value : value[0] ?? ""}
          onChange={(event) => change(Array.from(event.target.selectedOptions, (option) => option.value))}
          onInvalid={(event) => { event.preventDefault(); setNativeInvalid(true); triggerRef.current?.focus(); }}
        >
          {!multiple ? <option value="">{placeholder}</option> : null}
          {normalizedOptions.filter((option) => multiple || option.value !== "").map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      ) : null}
      <button
        {...aria} ref={triggerRef}
        aria-label={aria["aria-label"] ?? (aria["aria-labelledby"] || id ? undefined : placeholder)}
        aria-expanded={isOpen} aria-haspopup="listbox" aria-controls={isOpen ? listId : undefined}
        aria-activedescendant={isOpen && !searchable ? activeOptionId : undefined}
        aria-invalid={error || nativeInvalid || aria["aria-invalid"] || undefined}
        aria-required={required || aria["aria-required"] || undefined}
        aria-describedby={[aria["aria-describedby"], nativeInvalid ? `${controlId}-validation` : ""].filter(Boolean).join(" ") || undefined}
        role="combobox" id={controlId} className={cn("select option-trigger", className)}
        data-placeholder={value.length === 0 || (value[0] === "" && summary === placeholder) || undefined} disabled={disabled}
        onClick={() => isOpen ? close() : show()} type="button" title={summary || undefined}
      >
        <span className="option-summary">{summary || placeholder}</span>
        {multiple && value.length > 0 ? <span className="option-count" aria-label={`${value.length} selected`}>{value.length}</span> : null}
        <Icon name="chevronDown" size={16} className={cn("option-chevron", isOpen && "rotate-180")} />
      </button>
      {nativeInvalid ? <div className="option-validation" id={`${controlId}-validation`} role="alert">Please select {multiple ? "at least one option" : "an option"}.</div> : null}
      {isOpen ? (
        <div ref={menuRef} className="option-menu" popover="manual">
          {searchable ? (
            <div className="option-search">
              <Icon name="search" size={16} />
              <input
                ref={searchRef} aria-label={`Search ${placeholder.toLocaleLowerCase().replace(/^select /, "")}`}
                aria-autocomplete="list" aria-controls={listId} aria-expanded="true" aria-activedescendant={activeOptionId}
                autoComplete="off" placeholder="Search options…" role="combobox" value={query}
                onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
              />
            </div>
          ) : null}
          <div className="option-list" role="listbox" id={listId} aria-label={aria["aria-label"] ?? placeholder} aria-labelledby={aria["aria-labelledby"]} aria-multiselectable={multiple || undefined}>
            {filteredOptions.map((option, index) => {
              const selected = value.includes(option.value);
              return (
                <Fragment key={option.value}>
                {option.group && option.group !== filteredOptions[index - 1]?.group ? <div role="presentation" className="px-3 py-2 text-xs font-semibold text-muted">{option.group}</div> : null}
                <button
                  key={option.value} id={`${listId}-${index}`} aria-selected={selected} className="option-item"
                  data-active={activeIndex === index || undefined} onMouseDown={(event) => event.preventDefault()}
                  onClick={() => { setActiveIndex(index); choose(option); }} role="option" tabIndex={-1} type="button"
                >
                  <span className="option-indicator" data-multiple={multiple || undefined} aria-hidden="true">{selected ? <Icon name="check" size={12} /> : null}</span>
                  <span className="option-copy"><span>{option.label}</span>{option.description ? <span className="option-description">{option.description}</span> : null}</span>
                </button>
                </Fragment>
              );
            })}
            {filteredOptions.length === 0 ? <div className="option-empty" role="status">No options found</div> : null}
          </div>
          {multiple && value.length > 0 ? (
            <div className="option-footer">
              <button ref={clearRef} className="option-clear" onClick={() => { change([]); (searchRef.current ?? triggerRef.current)?.focus(); }} type="button">Clear selection</button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function SelectDropdown({ value, onChange, placeholder = "Select an option", ...props }: SelectDropdownProps) {
  const hasEmptyOption = props.options.some((option) => normalizeOption(option).value === "");
  return <OptionDropdown {...props} value={value || hasEmptyOption ? [value] : []} onChange={(values) => onChange(values[0] ?? "")} placeholder={placeholder} />;
}

export function MultiSelectDropdown({ placeholder = "Select options", ...props }: MultiSelectDropdownProps) {
  return <OptionDropdown {...props} placeholder={placeholder} multiple />;
}
```

### UI source: components/molecules/DynamicDropdown.tsx

```tsx
"use client";
import type { ComponentProps } from "react";
import { useDropdown } from "@/features/dropdowns/use-dropdown";
import { dropdownOptions, type DropdownName } from "@/features/dropdowns/types";
import { MultiSelectDropdown, SelectDropdown } from "./OptionDropdowns";

export function DropdownStatus({ name }: { name: DropdownName }) {
  const query = useDropdown(name);
  if (query.isError) return <div role="alert" className="mt-2 rounded-lg border border-warning/20 bg-warning-tint p-3 text-sm text-warning">Choices are temporarily unavailable. Your entries have been kept. <button type="button" className="font-semibold underline" onClick={() => void query.refetch()}>Try again</button></div>;
  if (!query.data) return <p role="status" className="mt-2 text-xs text-muted">Loading choices…</p>;
  if (!query.data.options.length) return <p role="status" className="mt-2 text-xs text-muted">No choices are currently available.</p>;
  return null;
}
type SingleProps = Omit<ComponentProps<typeof SelectDropdown>, "options"> & { collection: DropdownName; emptyLabel?: string };
type MultiProps = Omit<ComponentProps<typeof MultiSelectDropdown>, "options"> & { collection: DropdownName };
export function DynamicSelect({ collection, emptyLabel, ...props }: SingleProps) {
  const query = useDropdown(collection);
  const options = dropdownOptions(query.data);
  const missing = Boolean(query.data && props.value && !options.some(option => option.value === props.value));
  return <div><SelectDropdown {...props} options={[...(emptyLabel !== undefined ? [{ label: emptyLabel, value: "" }] : []), ...options]} disabled={props.disabled || !query.data || query.isError} />
    {missing ? <p className="mt-2 text-xs text-warning">Saved selection: {props.value}. This choice is no longer available; review before changing it.</p> : null}<DropdownStatus name={collection} /></div>;
}
export function DynamicMultiSelect({ collection, ...props }: MultiProps) {
  const query = useDropdown(collection);
  const options = dropdownOptions(query.data);
  const missing = query.data ? props.value.filter(value => !options.some(option => option.value === value)) : [];
  return <div><MultiSelectDropdown {...props} options={options} disabled={props.disabled || !query.data || query.isError} />
    {missing.map(value => <div key={value} className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-warning-tint p-2 text-xs text-warning"><span>{value} — saved choice needs review</span><button type="button" disabled={props.disabled} className="underline" onClick={() => props.onChange(props.value.filter(item => item !== value))}>Remove</button></div>)}<DropdownStatus name={collection} /></div>;
}
```

### UI source: components/molecules/TeachingSelectionFields.tsx

```tsx
"use client";
import { useState } from "react";
import { useTeachingCatalogue } from "@/features/teaching-catalogue/use-teaching-catalogue";
import { allowedSkills, toSubjectEditor, toSkillEditor, cleanOtherSubjects, otherSubjectsError, otherSkillsError, reconcileSkills } from "@/features/teaching-catalogue/selection";
import { DynamicMultiSelect } from "./DynamicDropdown";
import { Field } from "../atoms";
import { MultiSelectDropdown, SelectDropdown, type SelectOption } from "./OptionDropdowns";

export function TeachingSelectionFields({ subjects, skills, otherSubjects, otherSkills, otherError, otherSkillError, onChange, subjectLabel = "Subjects", skillLabel = "Skills", subjectError, skillError }: {
  subjects: string[]; skills?: string[]; otherSubjects?: string[]; otherSkills?: string[]; otherError?: string; otherSkillError?: string; onChange: (subjects: string[], skills: string[], otherSubjects: string[], otherSkills: string[]) => void;
  subjectLabel?: string; skillLabel?: string; subjectError?: string; skillError?: string;
}) {
  const catalogue = useTeachingCatalogue();
  const [notice, setNotice] = useState("");
  if (!catalogue.data) return <CatalogueStatus />;
  const data = catalogue.data;
  const editor = toSubjectEditor(data, subjects, otherSubjects);
  const selected = editor.subjects;
  const custom = editor.otherSubjects ?? [];
  const skillEditor = toSkillEditor(data, skills ?? [], otherSkills);
  const selectedSkills = skillEditor.skills;
  const customSkills = skillEditor.otherSkills ?? [];
  const subjectOptions: SelectOption[] = (data.subjectOptions ?? []).map(option => ({ label: option.label, value: option.value, group: option.group ?? undefined, keywords: option.aliases.join(" ") }));
  const allowed = allowedSkills(selected, data);
  const skillOptions = (data.skillOptions ?? []).filter(option => allowed.includes(option.value)).map(option => ({ label: option.label, value: option.value, keywords: option.aliases.join(" ") }));
  function emit(nextSubjects: string[], nextSkills: string[], nextCustom: string[], nextOtherSkills = customSkills) { onChange(nextSubjects, nextSkills, nextCustom, nextSkills.includes("Other") ? nextOtherSkills : []); }
  function change(next: string[]) {
    const cleaned = reconcileSkills(next, selectedSkills, data);
    const removed = selectedSkills.filter(skill => !cleaned.includes(skill));
    setNotice(removed.length ? `Removed skills that do not apply to these subjects: ${removed.join(", ")}.` : "");
    emit(next, cleaned, next.includes("Other") ? custom : []);
  }
  function reviewValues(values: string[], supported: string[], remove: (value: string) => void) {
    return values.filter(value => !supported.includes(value)).map(value => <div key={value} className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-warning/20 bg-warning-tint p-3 text-sm"><span>{value} <strong className="text-warning">Needs review</strong></span><button type="button" className="font-semibold underline" onClick={() => remove(value)} aria-label={`Remove ${value}`}>Remove</button></div>);
  }
  return <div className="space-y-4">
    <Field label={subjectLabel} error={subjectError} hint="Search by subject or familiar abbreviation. Select up to 50.">
      <MultiSelectDropdown disabled={catalogue.isError} options={subjectOptions} value={selected} searchable maxSelections={50} placeholder={`Select ${subjectLabel.toLowerCase()}`} error={Boolean(subjectError)} onChange={change} />

    </Field>
    {selected.includes("Other") ? <Field label="Other subjects" error={otherError || otherSubjectsError(selected, custom, data)} hint="Add actual subject names one at a time. Custom subjects allow shared skills only; review any imported legacy names.">
      <OtherSubjectsInput value={custom} catalogue={data} maxItems={50 - selected.filter(value => value !== "Other").length} onChange={next => emit(selected, selectedSkills, next)} />
    </Field> : otherError ? <p role="alert" className="text-sm text-danger">{otherError}</p> : null}
    {skills !== undefined ? <Field label={skillLabel} error={skillError} hint="Shared teaching skills and skills for your selected subjects. Optional.">
      <MultiSelectDropdown disabled={catalogue.isError} options={skillOptions} value={selectedSkills} searchable maxSelections={50} placeholder={`Select ${skillLabel.toLowerCase()}`} error={Boolean(skillError)} onChange={next => emit(selected, next, custom)} />
      {reviewValues(selectedSkills, allowed, value => emit(selected, selectedSkills.filter(item => item !== value), custom))}
    </Field> : null}
    {skills !== undefined && selectedSkills.includes("Other") ? <Field label="Other skills" error={otherSkillError || otherSkillsError(selectedSkills, customSkills, data)} hint="Add each actual skill name. Existing named skills must be selected from the menu."><OtherSubjectsInput kind="skills" value={customSkills} catalogue={data} maxItems={50 - selectedSkills.filter(value => value !== "Other").length} onChange={next => emit(selected, selectedSkills, custom, next)} /></Field> : null}
    <CatalogueStatus />
    {notice ? <p role="status" className="rounded-lg bg-brand-tint p-3 text-sm text-brand-dark">{notice}</p> : null}
  </div>;
}

export function CatalogueStatus() {
  const query = useTeachingCatalogue();
  return query.isError ? <div role="alert" className="rounded-xl border border-warning/20 bg-warning-tint p-4 text-sm">Subjects and skills could not be loaded. Your other details are saved in this form. <button type="button" className="font-semibold underline" onClick={() => void query.refetch()}>Try again</button></div> : !query.data ? <p role="status" className="text-sm text-muted">Loading subjects and skills…</p> : null;
}

export function CatalogueSubjectFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const query = useTeachingCatalogue();
  return <><SelectDropdown searchable disabled={!query.data || query.isError} placeholder="All subjects" value={value} onChange={onChange} options={[{ label: "All subjects", value: "" }, ...(query.data?.subjectOptions?.filter(option => option.value !== "Other").map(option => ({ label: option.label, value: option.value, group: option.group ?? undefined, keywords: option.aliases.join(" ") })) ?? [])]} /><label className="mt-2 block text-xs text-muted">Or enter an exact custom subject<input className="input mt-1" disabled={!query.data} maxLength={100} placeholder="e.g. Astronomy" value={query.data?.subjectOptions?.some(option => option.value === value) ? "" : value} onChange={event => onChange(event.target.value)} /></label><CatalogueStatus /></>;
}

export function CatalogueKeyStages({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  return <DynamicMultiSelect searchable collection="keyStage" value={value} onChange={onChange} placeholder="Select key stages" />;
}

function OtherSubjectsInput({ value, onChange, catalogue, maxItems, kind = "subjects" }: { value: string[]; onChange: (value: string[]) => void; catalogue: import("@/features/teaching-catalogue/types").TeachingCatalogue; maxItems: number; kind?: "subjects" | "skills" }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string>();
  function add() {
    if (!draft) return;
    const problem = (kind === "skills" ? otherSkillsError : otherSubjectsError)(["Other"], [draft], catalogue);
    if (problem) { setError(problem); return; }
    const next = cleanOtherSubjects([...value, draft]);
    if (next.length > maxItems) { setError(`Select up to 50 ${kind} in total.`); return; }
    onChange(next); setDraft(""); setError(undefined);
  }
  return <div>
    <div className="mb-2 flex flex-wrap gap-2">{value.map((name, index) => <span key={`${name}-${index}`} className="inline-flex max-w-full items-center gap-2 rounded-full bg-brand-tint px-3 py-1 text-sm"><span className="break-words">{name}</span><button type="button" aria-label={`Remove ${name}`} onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}>&times;</button></span>)}</div>
    <div className="flex gap-2"><input className="input min-w-0 flex-1" aria-label={kind === "skills" ? "Other skill name" : "Other subject name"} aria-invalid={Boolean(error)} maxLength={100} value={draft} placeholder={kind === "skills" ? "e.g. Telescope operation" : "e.g. Astronomy"} onChange={event => { setDraft(event.target.value); setError(undefined); }} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); add(); } }} /><button type="button" className="rounded-lg border border-border px-4 text-sm font-semibold" onClick={add}>Add</button></div>
    {draft ? <p className="mt-1 text-xs text-muted">Choose Add or press Enter to include this name before saving.</p> : null}
    {error ? <p role="alert" className="mt-1 text-sm text-danger">{error}</p> : null}
  </div>;
}
```

### UI source: components/molecules/ProposalEditor.tsx

```tsx
"use client";
import { DynamicSelect } from "./DynamicDropdown";

import { useCallback, useEffect, useRef, useState } from "react";
import type QuillType from "quill";

import "quill/dist/quill.snow.css";

const allowedFormats = ["bold", "italic", "underline", "list", "font", "size", "color", "link"];
const fontSizes = ["12px", "14px", "16px", "18px", "20px", "24px"];
const fontFamilies = ["Arial", "Georgia", "Times New Roman"];

type LinkEditorState = {
  index: number;
  length: number;
  text: string;
  url: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function proposalToHtml(value: string) {
  if (!value.trim()) return "";
  if (/<(?:p|div|br|strong|b|em|i|u|ul|ol|li|span|a)\b/i.test(value)) return value;

  return value
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function editorTextLength(quill: QuillType) {
  return Math.max(0, quill.getLength() - 1);
}

function editorHtml(quill: QuillType) {
  return editorTextLength(quill) === 0 ? "" : quill.getSemanticHTML().trim();
}

function normalizeLink(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const candidate = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? `mailto:${trimmed}` : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    if (url.protocol === "mailto:") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url.pathname) ? url.toString() : null;
    return ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname) && !/\s/.test(trimmed) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function ProposalEditor({
  id,
  invalid = false,
  label = "Application proposal",
  placeholder = "Introduce yourself, highlight relevant experience, and explain why you are a strong fit for this role.",
  "aria-describedby": describedBy,
  "aria-labelledby": labelledBy,
  maxLength,
  onChange,
  value,
}: {
  id: string;
  invalid?: boolean;
  label?: string;
  placeholder?: string;
  "aria-describedby"?: string;
  "aria-labelledby"?: string;
  maxLength: number;
  onChange: (value: string, textLength: number) => void;
  value: string;
}) {
  const [formats, setFormats] = useState<Record<string, string>>({});
  function applyFormat(format: string, value: string) {
    const quill = quillRef.current;
    if (!quill) return;
    quill.focus();
    quill.format(format, value || false, "user");
    setFormats(current => ({ ...current, [format]: value }));
  }
  const editorRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const quillRef = useRef<QuillType | null>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const invalidRef = useRef(invalid);
  const ariaRef = useRef({ describedBy, labelledBy });
  const lastEmittedValueRef = useRef<string | undefined>(undefined);
  const [linkEditor, setLinkEditor] = useState<LinkEditorState | null>(null);
  const [linkError, setLinkError] = useState<string>();

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    invalidRef.current = invalid;
    quillRef.current?.root.setAttribute("aria-invalid", String(invalid));
  }, [invalid]);

  useEffect(() => {
    ariaRef.current = { describedBy, labelledBy };
    const root = quillRef.current?.root;
    for (const [attribute, value] of [["aria-describedby", describedBy], ["aria-labelledby", labelledBy]] as const) {
      if (value) root?.setAttribute(attribute, value);
      else root?.removeAttribute(attribute);
    }
  }, [describedBy, labelledBy]);

  const openLinkEditor = useCallback(() => {
    const quill = quillRef.current;
    if (!quill) return;

    const range = quill.getSelection(true) ?? { index: Math.max(0, quill.getLength() - 1), length: 0 };
    const format = quill.getFormat(range);
    setLinkError(undefined);
    setLinkEditor({
      index: range.index,
      length: range.length,
      text: range.length > 0 ? quill.getText(range.index, range.length) : "",
      url: typeof format.link === "string" ? format.link : "",
    });
  }, []);

  useEffect(() => {
    let active = true;
    let cleanupEditor: (() => void) | undefined;
    const editorElement = editorRef.current;
    const toolbarElement = toolbarRef.current;

    void import("quill").then(({ default: Quill }) => {
      if (!active || !editorElement || !toolbarElement || quillRef.current) return;

      const SizeStyle = Quill.import("attributors/style/size") as { whitelist: string[] };
      const FontStyle = Quill.import("attributors/style/font") as { whitelist: string[] };
      SizeStyle.whitelist = fontSizes;
      FontStyle.whitelist = fontFamilies;
      Quill.register(SizeStyle as never, true);
      Quill.register(FontStyle as never, true);

      const quill = new Quill(editorElement, {
        formats: allowedFormats,
        modules: {
          toolbar: {
            container: toolbarElement,
            handlers: {
              link: openLinkEditor,
            },
          },
        },
        placeholder,
        theme: "snow",
      });

      quill.root.id = id;
      quill.root.setAttribute("role", "textbox");
      quill.root.setAttribute("aria-label", label);
      if (ariaRef.current.describedBy) quill.root.setAttribute("aria-describedby", ariaRef.current.describedBy);
      if (ariaRef.current.labelledBy) quill.root.setAttribute("aria-labelledby", ariaRef.current.labelledBy);
      quill.root.setAttribute("aria-multiline", "true");
      quill.root.setAttribute("aria-required", "true");
      quill.root.setAttribute("aria-invalid", String(invalidRef.current));
      quill.root.style.fontSize = "16px";
      for (const [format, label] of [["font", "Font family"], ["size", "Font size"], ["color", "Text color"]]) {
        toolbarElement.querySelector(`.ql-${format} .ql-picker-label`)?.setAttribute("aria-label", label);
      }
      quill.clipboard.dangerouslyPasteHTML(proposalToHtml(valueRef.current), "silent");
      quillRef.current = quill;
      onChangeRef.current(valueRef.current, editorTextLength(quill));

      const handleTextChange = () => {
        const nextValue = editorHtml(quill);
        const nextLength = editorTextLength(quill);
        lastEmittedValueRef.current = nextValue;
        onChangeRef.current(nextValue, nextLength);
      };

      const syncFormats = () => {
        const format = quill.getFormat();
        setFormats(Object.fromEntries(["font", "size", "color"].map(name => [name, typeof format[name] === "string" ? format[name] as string : ""])));
      };
      quill.on("selection-change", syncFormats);
      quill.on("text-change", handleTextChange);
      cleanupEditor = () => { quill.off("text-change", handleTextChange); quill.off("selection-change", syncFormats); };
    });

    return () => {
      active = false;
      cleanupEditor?.();
      quillRef.current = null;
      editorElement?.replaceChildren();
    };
  }, [id, label, placeholder, maxLength, openLinkEditor]);

  useEffect(() => {
    const quill = quillRef.current;
    if (!quill || value === lastEmittedValueRef.current) return;

    const nextHtml = proposalToHtml(value);
    if (quill.root.innerHTML === nextHtml || (editorTextLength(quill) === 0 && !nextHtml)) return;

    const selection = quill.getSelection();
    quill.clipboard.dangerouslyPasteHTML(nextHtml, "silent");
    if (selection) quill.setSelection(Math.min(selection.index, quill.getLength() - 1), selection.length, "silent");
  }, [value]);

  function closeLinkEditor() {
    setLinkEditor(null);
    setLinkError(undefined);
    quillRef.current?.focus();
  }

  function applyLink() {
    const quill = quillRef.current;
    if (!quill || !linkEditor) return;

    const url = normalizeLink(linkEditor.url);
    if (!url) {
      setLinkError("Enter a valid website or email link.");
      return;
    }

    if (linkEditor.length > 0) {
      quill.formatText(linkEditor.index, linkEditor.length, "link", url, "user");
    } else {
      const text = linkEditor.text.trim() || linkEditor.url.trim();
      if (!text) {
        setLinkError("Add link text or a URL.");
        return;
      }
      quill.insertText(linkEditor.index, text, { link: url }, "user");
      quill.setSelection(linkEditor.index + text.length, 0, "silent");
    }

    closeLinkEditor();
  }

  function removeLink() {
    const quill = quillRef.current;
    if (!quill || !linkEditor) return;
    if (linkEditor.length > 0) quill.formatText(linkEditor.index, linkEditor.length, "link", false, "user");
    closeLinkEditor();
  }

  return (
    <div className="proposal-editor" data-invalid={invalid}>
      <div className="editor-appearance-controls" aria-label="Text appearance">
        <DynamicSelect aria-label="Font family" collection="proposalFontFamily" emptyLabel="SupplyEd Sans" value={formats.font ?? ""} onChange={value => applyFormat("font", value)} />
        <DynamicSelect aria-label="Font size" collection="proposalFontSize" emptyLabel="16" value={formats.size ?? ""} onChange={value => applyFormat("size", value)} />
        <DynamicSelect aria-label="Text color" collection="proposalTextColor" emptyLabel="Default" value={formats.color ?? ""} onChange={value => applyFormat("color", value)} />
      </div>
      <div ref={toolbarRef} aria-label={`${label} formatting`} role="toolbar">
        <span aria-label="Text style" className="ql-formats" role="group">
          <button aria-label="Bold" className="ql-bold" title="Bold" type="button" />
          <button aria-label="Italic" className="ql-italic" title="Italic" type="button" />
          <button aria-label="Underline" className="ql-underline" title="Underline" type="button" />
        </span>
        <span aria-label="Lists" className="ql-formats" role="group">
          <button aria-label="Bullet list" className="ql-list" title="Bullet list" type="button" value="bullet" />
          <button aria-label="Numbered list" className="ql-list" title="Numbered list" type="button" value="ordered" />
        </span>
        <span aria-label="Links and formatting" className="ql-formats" role="group">
          <button aria-label="Add link" className="ql-link" title="Add link" type="button" />
          <button aria-label="Clear formatting" className="ql-clean" title="Clear formatting" type="button" />
        </span>
      </div>

      {linkEditor ? (
        <div className="proposal-link-panel" onKeyDownCapture={(event) => {
          if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
            event.preventDefault();
            event.stopPropagation();
            applyLink();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            closeLinkEditor();
          }
        }}>
          <h3 className="proposal-link-title">Add a link</h3>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto] sm:items-end">
            <label className="grid gap-1 text-xs font-semibold text-ink">
              Link text
              <input
                className="input h-10"
                disabled={linkEditor.length > 0}
                onChange={(event) => setLinkEditor((current) => current ? { ...current, text: event.target.value } : current)}
                placeholder="School website"
                value={linkEditor.text}
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-ink">
              Website or email address
              <input
                autoFocus
                aria-invalid={Boolean(linkError)}
                aria-describedby={linkError ? `${id}-link-error` : undefined}
                className="input h-10"
                onChange={(event) => {
                  setLinkEditor((current) => current ? { ...current, url: event.target.value } : current);
                  if (linkError) setLinkError(normalizeLink(event.target.value) ? undefined : "Enter a valid website or email link.");
                }}
                placeholder="https://example.com"
                value={linkEditor.url}
              />
            </label>
            <div className="flex gap-2">
              {linkEditor.length > 0 && linkEditor.url ? <button className="editor-link-action text-danger" onClick={removeLink} type="button">Remove</button> : null}
              <button className="editor-link-action" onClick={closeLinkEditor} type="button">Cancel</button>
              <button className="editor-link-action editor-link-action-primary" onClick={applyLink} type="button">Apply</button>
            </div>
          </div>
          {linkError ? <p className="mt-2 text-xs text-danger" id={`${id}-link-error`} role="alert">{linkError}</p> : null}
        </div>
      ) : null}

      <div ref={editorRef} className="proposal-editor-surface" />
    </div>
  );
}
```

### UI source: components/molecules/RoleDescriptionEditor.tsx

```tsx
"use client";

import { useId, type ComponentProps } from "react";
import { ProposalEditor } from "./ProposalEditor";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatLegacyInline(value: string) {
  return escapeHtml(value).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function legacyDescriptionToHtml(value: string) {
  if (!value.trim()) return "";
  if (/<(?:p|div|br|strong|b|em|i|u|ul|ol|li|span|a)\b/i.test(value)) return value;

  const blocks: string[] = [];
  let listItems: string[] = [];

  function flushList() {
    if (listItems.length === 0) return;
    blocks.push("<ul>" + listItems.map((item) => "<li>" + formatLegacyInline(item) + "</li>").join("") + "</ul>");
    listItems = [];
  }

  value.replace(/\r/g, "").split("\n").forEach((rawLine) => {
    const line = rawLine.trim();

    if (!line) {
      flushList();
      return;
    }

    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      listItems.push(bullet[1]);
      return;
    }

    flushList();
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    blocks.push("<p>" + (heading ? "<strong>" + formatLegacyInline(heading[1]) + "</strong>" : formatLegacyInline(line)) + "</p>");
  });

  flushList();
  return blocks.join("");
}

/** Role descriptions share the cover-letter editor and its live dropdown collections. */
export function RoleDescriptionEditor({ id, value, onChange, ...props }: Omit<ComponentProps<typeof ProposalEditor>, "id" | "maxLength" | "onChange" | "label" | "placeholder"> & {
  id?: string;
  onChange: (value: string) => void;
}) {
  const generatedId = useId();
  const editorValue = legacyDescriptionToHtml(value);
  return <ProposalEditor
    {...props}
    id={id ?? generatedId}
    label="Role description"
    placeholder="Describe the class, cover expectations, timetable notes, support needs, and arrival instructions."
    maxLength={10000}
    value={editorValue}
    onChange={next => {
      // Initial parsing must not make an untouched saved job look edited.
      if (next !== editorValue) onChange(next);
    }}
  />;
}
```

### UI source: components/molecules/ProposalContent.tsx

```tsx
"use client";

import DOMPurify from "dompurify";
import { useMemo, useSyncExternalStore } from "react";

import { cn } from "@/lib/cn";
import { hasRichTextMarkup, richTextToPlainText } from "@/features/applications/rich-text";

const allowedFontSizes = new Set(["12px", "14px", "16px", "18px", "20px", "24px"]);
const allowedFonts = new Set(["Arial", "Georgia", "Times New Roman"]);
const allowedColors = new Set(["#17211c", "#227557", "#315ca8", "#7a4a9e", "#a1483f"]);

function subscribeToBrowser() {
  return () => undefined;
}

function safeLink(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:", "mailto:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function sanitizeProposal(value: string) {
  const clean = DOMPurify.sanitize(value, {
    ALLOWED_ATTR: ["href", "style"],
    ALLOWED_TAGS: ["a", "b", "br", "em", "i", "li", "ol", "p", "span", "strong", "u", "ul"],
  });
  const template = document.createElement("template");
  template.innerHTML = clean;

  template.content.querySelectorAll<HTMLElement>("[style]").forEach((element) => {
    const nextStyles: string[] = [];
    const size = element.style.fontSize;
    const family = element.style.fontFamily.replace(/^['"]|['"]$/g, "");
    const color = element.style.color;

    if (allowedFontSizes.has(size)) nextStyles.push(`font-size: ${size}`);
    if (allowedFonts.has(family)) nextStyles.push(`font-family: ${family}`);

    const colorProbe = document.createElement("span");
    colorProbe.style.color = color;
    document.body.appendChild(colorProbe);
    const normalizedColor = getComputedStyle(colorProbe).color;
    colorProbe.remove();

    const allowedColor = Array.from(allowedColors).find((candidate) => {
      const probe = document.createElement("span");
      probe.style.color = candidate;
      document.body.appendChild(probe);
      const normalized = getComputedStyle(probe).color;
      probe.remove();
      return normalized === normalizedColor;
    });
    if (allowedColor) nextStyles.push(`color: ${allowedColor}`);

    if (nextStyles.length) element.setAttribute("style", nextStyles.join("; "));
    else element.removeAttribute("style");
  });

  template.content.querySelectorAll<HTMLAnchorElement>("a").forEach((link) => {
    if (!safeLink(link.href)) {
      link.replaceWith(document.createTextNode(link.textContent ?? ""));
      return;
    }
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });

  return template.innerHTML;
}

export function ProposalContent({
  className,
  preview = false,
  value,
}: {
  className?: string;
  preview?: boolean;
  value: string;
}) {
  const plainText = useMemo(() => richTextToPlainText(value), [value]);
  const rich = hasRichTextMarkup(value);
  const browserReady = useSyncExternalStore(subscribeToBrowser, () => true, () => false);
  const safeHtml = useMemo(
    () => browserReady && rich ? sanitizeProposal(value) : null,
    [browserReady, rich, value],
  );

  if (!plainText) return null;

  if (preview || !rich || safeHtml === null) {
    return <p className={cn("whitespace-pre-wrap text-sm leading-6 text-muted", className)}>{plainText}</p>;
  }

  return (
    <div
      className={cn("proposal-content text-sm leading-7 text-muted", className)}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
```

### UI source: components/molecules/FormattedJobDescription.tsx

```tsx
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { hasRichTextMarkup, isEmptyRichText } from "@/features/applications/rich-text";
import { ProposalContent } from "./ProposalContent";

type DescriptionBlock =
  | { text: string; type: "heading" }
  | { items: string[]; type: "list" }
  | { text: string; type: "paragraph" };

function flushParagraph(blocks: DescriptionBlock[], lines: string[]) {
  const text = lines.join(" ").trim();
  if (text) blocks.push({ text, type: "paragraph" });
  lines.length = 0;
}

function flushList(blocks: DescriptionBlock[], items: string[]) {
  if (items.length > 0) blocks.push({ items: [...items], type: "list" });
  items.length = 0;
}

function parseDescription(description: string) {
  const blocks: DescriptionBlock[] = [];
  const paragraphLines: string[] = [];
  const listItems: string[] = [];

  description
    .replace(/\r/g, "")
    .split("\n")
    .forEach((rawLine) => {
      const line = rawLine.trim();

      if (!line) {
        flushParagraph(blocks, paragraphLines);
        flushList(blocks, listItems);
        return;
      }

      const heading = line.match(/^#{1,3}\s+(.+)$/);
      if (heading) {
        flushParagraph(blocks, paragraphLines);
        flushList(blocks, listItems);
        blocks.push({ text: heading[1].trim(), type: "heading" });
        return;
      }

      const bullet = line.match(/^[-*]\s+(.+)$/);
      if (bullet) {
        flushParagraph(blocks, paragraphLines);
        listItems.push(bullet[1].trim());
        return;
      }

      flushList(blocks, listItems);
      paragraphLines.push(line);
    });

  flushParagraph(blocks, paragraphLines);
  flushList(blocks, listItems);

  return blocks;
}

function renderInline(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  return parts.map<ReactNode>((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${keyPrefix}-strong-${index}`} className="font-semibold text-ink">
          {part.slice(2, -2)}
        </strong>
      );
    }

    return part;
  });
}

export function FormattedJobDescription({
  className,
  description,
  emptyText = "Role details will appear here.",
}: {
  className?: string;
  description: string;
  emptyText?: string;
}) {
  if (hasRichTextMarkup(description) && !isEmptyRichText(description)) {
    return <ProposalContent className={className} value={description} />;
  }
  const blocks = parseDescription(description.trim());

  if (blocks.length === 0 || isEmptyRichText(description)) {
    return <p className={cn("text-sm leading-6 text-muted", className)}>{emptyText}</p>;
  }

  return (
    <div className={cn("space-y-3 text-sm leading-6 text-muted", className)}>
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <h3 key={`${block.type}-${index}`} className="font-heading text-lg leading-tight text-ink">
              {renderInline(block.text, `heading-${index}`)}
            </h3>
          );
        }

        if (block.type === "list") {
          return (
            <ul key={`${block.type}-${index}`} className="list-disc space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={`${block.type}-${index}-${itemIndex}`}>{renderInline(item, `item-${index}-${itemIndex}`)}</li>
              ))}
            </ul>
          );
        }

        return <p key={`${block.type}-${index}`}>{renderInline(block.text, `paragraph-${index}`)}</p>;
      })}
    </div>
  );
}
```

### UI source: features/dropdowns/types.ts

```ts
export type DropdownOption = {
  key: string; value: string; label: string; aliases: string[]; group: string | null;
  sortOrder: number; isActive: boolean; isShared: boolean; subjectKeys: string[];
};
export type DropdownSummary = {
  id: string; name: string; label: string; revision: number; isActive: boolean;
  updatedAt: string; expandable: boolean; optionCount: number;
};
export type Dropdown = Omit<DropdownSummary, "optionCount"> & { options: DropdownOption[] };
export type DropdownName = "subject" | "skill" | "keyStage" | "country" | "city" | "region" | "currency" | "institutionType" | "coverType" | "payType" | "timezone" | "waitlistSchoolRole" | "waitlistSchoolArea" | "waitlistSchoolType" | "supplyDaysPerTerm" | "coverBookingMethod" | "waitlistTeacherRole" | "waitlistTeacherArea" | "currentSupply" | "daysPerWeek" | "waitlistPhase" | "discoveryUrgency" | "teacherRating" | "bookingInvoiceState" | "refundReason" | "applicationStatus" | "jobStatus" | "jobInvitationStatus" | "bookingStatus" | "invoiceStatus" | "profileStatus" | "foundingInterestStatus" | "documentVerificationStatus" | "signatoryApprovalStatus" | "proposalFontFamily" | "proposalFontSize" | "proposalTextColor" | "descriptionFontSize" | "themeAccent" | "legacySchoolRole" | "legacySchoolType" | "legacySchoolTier" | "legacyTeacherRole" | "legacyTeacherPhase" | "availability";

export const dropdownOptions = (data?: Dropdown) => (data?.options ?? []).filter(option => option.isActive).map(option => ({
  label: option.label, value: option.value, group: option.group ?? undefined, keywords: option.aliases.join(" "),
}));
```

### UI source: features/dropdowns/use-dropdown.ts

```ts
"use client";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { fetchJson } from "@/lib/query/fetch-json";
import type { Dropdown, DropdownName } from "./types";
export const dropdownKey = (name: string) => ["dropdown", name] as const;
export function useDropdown(name: DropdownName) {
  const query = useQuery({ queryKey: dropdownKey(name), queryFn: () => fetchJson<Dropdown>(`/api/dropdowns/${name}`), staleTime: 30_000, gcTime: 300_000, refetchOnWindowFocus: "always", retry: 1 });
  const refetch = query.refetch;
  useEffect(() => {
    // Several fields may observe one collection; share the in-flight refresh.
    const refresh = () => { void refetch({ cancelRefetch: false }); };
    window.addEventListener("supplyed:refresh-dropdowns", refresh);
    return () => window.removeEventListener("supplyed:refresh-dropdowns", refresh);
  }, [refetch]);
  return query;
}
```

### UI source: features/dropdowns/refresh.ts

```ts
export const dropdownValidationCodes = new Set(["INVALID_DROPDOWN_SELECTION", "DROPDOWNS_NOT_SEEDED", "INVALID_TEACHING_SELECTION", "INVALID_OTHER_SUBJECTS", "INVALID_OTHER_SKILLS", "SKILL_SUBJECT_MISMATCH", "CONFLICTING_JOB_SUBJECTS"]);
export function refreshDropdownsAfterFailure(result: unknown) {
  if (typeof window !== "undefined" && result && typeof result === "object" && "code" in result && dropdownValidationCodes.has(String(result.code))) window.dispatchEvent(new Event("supplyed:refresh-dropdowns"));
}
```

### UI source: features/teaching-catalogue/use-teaching-catalogue.ts

```ts
"use client";
import { useDropdown } from "@/features/dropdowns/use-dropdown";
import { useMemo } from "react";
import type { TeachingCatalogue } from "./types";

// Compatibility export: invalidating this prefix refreshes every source collection.
export const teachingCatalogueKey = ["dropdown"] as const;
export function useTeachingCatalogue() {
  const subjects = useDropdown("subject"), skills = useDropdown("skill"), stages = useDropdown("keyStage");
  const data = useMemo<TeachingCatalogue | undefined>(() => {
    if (!subjects.data || !skills.data || !stages.data) return undefined;
    const subjectOptions = subjects.data.options.filter(option => option.isActive);
    const skillOptions = skills.data.options.filter(option => option.isActive);
    const stageOptions = stages.data.options.filter(option => option.isActive);
    const groups = [...new Set(subjectOptions.map(option => option.group || "Subjects"))];
    return {
      version: `db-${subjects.data.revision}.${skills.data.revision}.${stages.data.revision}`, title: subjects.data.label, description: "Choose subjects and related skills.",
      subjectOptions, skillOptions, stageOptions,
      categories: groups.map(name => ({ name, subjects: subjectOptions.filter(option => (option.group || "Subjects") === name).map(option => ({ name: option.value, aliases: option.aliases, skills: skillOptions.filter(skill => skill.subjectKeys.includes(option.key)).map(skill => skill.value) })) })),
      sharedSkills: skillOptions.filter(option => option.isShared).map(option => option.value), keyStages: stageOptions.map(option => option.value),
    };
  }, [subjects.data, skills.data, stages.data]);
  return { data, isError: subjects.isError || skills.isError || stages.isError, isLoading: subjects.isLoading || skills.isLoading || stages.isLoading, refetch: () => Promise.all([subjects.refetch(), skills.refetch(), stages.refetch()]) };
}
```

### UI source: features/teaching-catalogue/selection.ts

```ts
import type { TeachingCatalogue } from "./types";

/** Preserve a legacy sentence as one reviewable value; never infer subjects from prose. */
export function selectionValues(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : typeof value === "string" && value.trim() ? [value] : [];
}

export function jobSubjects(job: { subjects?: string[] | null; subject?: string | null }): string[] {
  return Array.isArray(job.subjects) ? selectionValues(job.subjects) : job.subject && job.subject !== "General cover" ? [job.subject] : [];
}

export const subjectKey = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const key = subjectKey;
export function canonicalSubjects(values: string[], catalogue: TeachingCatalogue): string[] {
  const subjects = catalogue.categories.flatMap(category => category.subjects);
  return [...new Set(values.map(value => {
    const matches = subjects.filter(subject => [subject.name, ...subject.aliases].some(alias => key(alias) === key(value)));
    return matches.length === 1 ? matches[0].name : value;
  }))];
}

export function allowedSkills(subjects: string[], catalogue: TeachingCatalogue): string[] {
  const names = canonicalSubjects(subjects, catalogue);
  if (catalogue.skillOptions && catalogue.subjectOptions) {
    const keys = new Set(catalogue.subjectOptions.filter(option => option.isActive && names.includes(option.value) && option.value !== "Other").map(option => option.key));
    return catalogue.skillOptions.filter(option => option.isActive && (option.isShared || option.subjectKeys.some(key => keys.has(key)))).map(option => option.value);
  }
  return [...new Set([...catalogue.sharedSkills, ...catalogue.categories.flatMap(category => category.subjects).filter(subject => names.includes(subject.name)).flatMap(subject => subject.skills)])];
}

export function reconcileSkills(subjects: string[], skills: string[], catalogue: TeachingCatalogue): string[] {
  const allowed = new Set(allowedSkills(subjects, catalogue));
  return [...new Set(skills.filter(skill => allowed.has(skill)))];
}

export function catalogueError(code?: string) {
  return code === "INVALID_OTHER_SUBJECTS" || code === "INVALID_OTHER_SKILLS" || code === "INVALID_DROPDOWN_SELECTION" || code === "INVALID_TEACHING_SELECTION" || code === "SKILL_SUBJECT_MISMATCH" || code === "CONFLICTING_JOB_SUBJECTS";
}

export function toSkillEditor(catalogue: TeachingCatalogue | undefined, values: string[], otherSkills?: string[]) {
  if (!catalogue) return { skills: values, otherSkills };
  const options = catalogue.skillOptions ?? [...new Set([...catalogue.sharedSkills, ...catalogue.categories.flatMap(category => category.subjects.flatMap(subject => subject.skills))])].map(value => ({ value, aliases: [] as string[] }));
  const canonical = [...new Set(values.map(value => options.find(option => [option.value, ...option.aliases].some(alias => key(alias) === key(value)))?.value ?? value))];
  if (otherSkills !== undefined) return { skills: canonical, otherSkills };
  const known = new Set(options.map(option => option.value));
  const custom = canonical.filter(value => !known.has(value));
  return { skills: [...canonical.filter(value => known.has(value)), ...(custom.length ? ["Other"] : [])], otherSkills: custom };
}

export function otherSkillsError(skills: string[] | undefined, values: unknown, catalogue?: TeachingCatalogue): string | undefined {
  const error = otherSubjectsError(skills, values);
  if (error) return error.replace(/subjects/g, "skills").replace(/subject names/g, "skill names");
  if (catalogue && Array.isArray(values)) {
    const options = catalogue.skillOptions ?? [...new Set([...catalogue.sharedSkills, ...catalogue.categories.flatMap(category => category.subjects.flatMap(subject => subject.skills))])].map(value => ({ value, aliases: [] as string[] }));
    const match = options.find(option => values.some(value => [option.value, ...option.aliases].some(alias => key(alias) === key(value))));
    if (match) return `Select ${match.value} from the skills menu instead of entering it under Other.`;
  }
  return undefined;
}

/** Responses store actual names. Only requests contain Other + otherSubjects. */
export function toSubjectEditor(catalogue: TeachingCatalogue | undefined, values: string[], otherSubjects?: string[]) {
  if (!catalogue) return { subjects: values, otherSubjects };
  const canonical = canonicalSubjects(values, catalogue);
  if (otherSubjects !== undefined) return { subjects: canonical, otherSubjects };
  const known = new Set(catalogue.categories.flatMap(category => category.subjects.map(subject => subject.name)));
  const custom = canonical.filter(value => !known.has(value));
  return { subjects: [...new Set([...canonical.filter(value => known.has(value)), ...(custom.length ? ["Other"] : [])])], otherSubjects: custom };
}

export function cleanOtherSubjects(values: string[]): string[] {
  const unique = new Map<string, string>();
  for (const value of values) {
    const cleaned = value.trim().replace(/\s+/gu, " ");
    if (!unique.has(subjectKey(cleaned))) unique.set(subjectKey(cleaned), cleaned);
  }
  return [...unique.values()];
}

export function actualSubjects(subjects: string[], otherSubjects?: string[]) {
  return !Array.isArray(subjects) || !Array.isArray(otherSubjects) ? subjects : [...subjects.filter(value => value !== "Other"), ...otherSubjects];
}

export function otherSubjectsError(subjects: string[] | undefined, values: unknown, catalogue?: TeachingCatalogue): string | undefined {
  if (subjects !== undefined && !Array.isArray(subjects)) return undefined;
  // Omission deliberately preserves custom names during a PATCH.
  if (values === undefined) return subjects?.includes("Other") ? "Add at least one name under Other subjects." : undefined;
  if (!Array.isArray(values) || values.length > 50 || values.some(value => typeof value !== "string" || value.length > 100 || /\p{Cc}/u.test(value) || !subjectKey(value))) return "Use up to 50 subject names, each 1–100 characters, without control characters.";
  const names = values as string[];
  if (catalogue) {
    const known = catalogue.categories.flatMap(category => category.subjects);
    const match = known.find(subject => names.some(name => [subject.name, ...subject.aliases].some(alias => subjectKey(alias) === subjectKey(name))));
    if (match) return `Select ${match.name} from the catalogue instead of entering it under Other.`;
  }
  if (subjects && subjects.includes("Other") !== (names.length > 0)) return "Select Other and add at least one name, or remove Other and clear its names.";
  if ((subjects?.filter(value => value !== "Other").length ?? 0) + cleanOtherSubjects(names).length > 50) return "Select up to 50 subjects in total, including Other subjects.";
  return undefined;
}
```

### UI source: features/teaching-catalogue/patch.ts

```ts
/** Unrelated profile edits must not revalidate legacy catalogue values. */
import { actualSubjects } from "./selection";

/** Retired reference values on unchanged fields must not block unrelated edits. */
export function omitUnchangedDropdownFields(payload: object, saved: object | null | undefined) {
  if (!saved) return;
  const current = payload as Record<string, unknown>, previous = saved as Record<string, unknown>;
  for (const field of ["city", "county", "countryCode", "currency", "keyStages", "coverTypes", "institutionType"]) {
    if (field in current && JSON.stringify(current[field]) === JSON.stringify(previous[field])) delete current[field];
  }
}

export function omitUnchangedTeachingFields(payload: { subjects?: string[]; skills?: string[]; staffingNeeds?: string[]; otherSubjects?: string[]; otherSkills?: string[] }, saved: { subjects?: string[]; skills?: string[]; staffingNeeds?: string[] } | null | undefined) {
  if (!saved) return;
  const same = (left?: string[], right?: string[]) => JSON.stringify(left ?? []) === JSON.stringify(right ?? []);
  if (("subjects" in payload || "skills" in payload) && same(actualSubjects(payload.subjects ?? [], payload.otherSubjects), saved.subjects) && same(actualSubjects(payload.skills ?? [], payload.otherSkills), saved.skills)) {
    delete payload.subjects;
    delete payload.skills;
    delete payload.otherSubjects;
    delete payload.otherSkills;
  }
  if ("staffingNeeds" in payload && same(actualSubjects(payload.staffingNeeds ?? [], payload.otherSubjects), saved.staffingNeeds)) { delete payload.staffingNeeds; delete payload.otherSubjects; }
}
```

### UI source: lib/theme.ts

```ts
export const brandPalettes = [
  { name: "Supply blue", accent: "#008CC4" },
  { name: "Emerald", accent: "#16A34A" },
  { name: "Violet", accent: "#7C3AED" },
  { name: "Rose", accent: "#E11D48" },
  { name: "Amber", accent: "#D97706" },
  { name: "Slate", accent: "#334155" },
];

type Rgb = {
  r: number;
  g: number;
  b: number;
};

function clamp(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function normalizeHex(hex: string) {
  const clean = hex.trim().replace("#", "");

  if (/^[0-9a-f]{3}$/i.test(clean)) {
    return `#${clean.split("").map((char) => `${char}${char}`).join("")}`;
  }

  if (/^[0-9a-f]{6}$/i.test(clean)) {
    return `#${clean}`;
  }

  return "#008CC4";
}

function hexToRgb(hex: string): Rgb {
  const normalized = normalizeHex(hex).replace("#", "");
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: Rgb) {
  return `#${[r, g, b].map((value) => clamp(value).toString(16).padStart(2, "0")).join("")}`;
}

function mix(from: Rgb, to: Rgb, weight: number) {
  return {
    r: from.r + (to.r - from.r) * weight,
    g: from.g + (to.g - from.g) * weight,
    b: from.b + (to.b - from.b) * weight,
  };
}

function luminance(rgb: Rgb) {
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((value) => {
    const channel = clamp(value) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function readableDark(rgb: Rgb, tint: Rgb) {
  const black = { r: 0, g: 0, b: 0 };
  let weight = 0.22;
  let dark = mix(rgb, black, weight);
  // Keep the established shade where it is readable; brighten neither the
  // chosen accent nor its surfaces when a pale palette needs darker text.
  while ((luminance(tint) + 0.05) / (luminance(dark) + 0.05) < 4.6 && weight < 1) {
    weight = Math.min(1, weight + 0.02);
    dark = mix(rgb, black, weight);
  }
  return dark;
}

export function deriveBrandTheme(accent: string) {
  const normalized = normalizeHex(accent);
  const rgb = hexToRgb(normalized);
  const white = { r: 255, g: 255, b: 255 };
  const tint = mix(rgb, white, 0.9);

  return {
    accent: normalized,
    rgb: `${rgb.r} ${rgb.g} ${rgb.b}`,
    dark: rgbToHex(readableDark(rgb, tint)),
    tint: rgbToHex(tint),
    tint2: rgbToHex(mix(rgb, white, 0.78)),
  };
}

export function applyBrandTheme(accent: string, root: HTMLElement = document.documentElement) {
  const theme = deriveBrandTheme(accent);

  root.style.setProperty("--se", theme.accent);
  root.style.setProperty("--se-rgb", theme.rgb);
  root.style.setProperty("--se-dark", theme.dark);
  root.style.setProperty("--se-tint", theme.tint);
  root.style.setProperty("--se-tint-2", theme.tint2);
}
```

### UI source: lib/theme-bootstrap.ts

```ts
export const themeBootScript = `
(function () {
  function applySavedTheme() {
  try {
    var saved = JSON.parse(window.localStorage.getItem("supplyed_tweaks") || "{}");
    var accent = String(saved.accent || "#008CC4").trim();
    if (!/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(accent)) accent = "#008CC4";
    if (accent.charAt(0) !== "#") accent = "#" + accent;
    if (accent.length === 4) accent = "#" + accent[1] + accent[1] + accent[2] + accent[2] + accent[3] + accent[3];
    var rgb = {
      r: parseInt(accent.slice(1, 3), 16),
      g: parseInt(accent.slice(3, 5), 16),
      b: parseInt(accent.slice(5, 7), 16)
    };
    function mix(to, weight) {
      var from = rgb;
      return "#" + [from.r + (to.r - from.r) * weight, from.g + (to.g - from.g) * weight, from.b + (to.b - from.b) * weight]
        .map(function (value) { return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0"); })
        .join("");
    }
    function luminance(hex) {
      var channels = [1, 3, 5].map(function (index) {
        var value = parseInt(hex.slice(index, index + 2), 16) / 255;
        return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    }
    var tint = mix({ r: 255, g: 255, b: 255 }, 0.9);
    var darkWeight = 0.22;
    var dark = mix({ r: 0, g: 0, b: 0 }, darkWeight);
    while ((luminance(tint) + 0.05) / (luminance(dark) + 0.05) < 4.6 && darkWeight < 1) {
      darkWeight = Math.min(1, darkWeight + 0.02);
      dark = mix({ r: 0, g: 0, b: 0 }, darkWeight);
    }
    var root = document.documentElement.style;
    root.setProperty("--se", accent);
    root.setProperty("--se-rgb", rgb.r + " " + rgb.g + " " + rgb.b);
    root.setProperty("--se-dark", dark);
    root.setProperty("--se-tint", tint);
    root.setProperty("--se-tint-2", mix({ r: 255, g: 255, b: 255 }, 0.78));
  } catch (error) {}
  }
  applySavedTheme();
  window.addEventListener?.("storage", function (event) {
    if (event.key === "supplyed_tweaks" || event.key === null) applySavedTheme();
  });
  window.addEventListener?.("focus", applySavedTheme);
})();
`;
```

### UI source: lib/supplyed-preferences.ts

```ts
import { defaultTweaks } from "@/data/supplyed";
import type { Tweaks } from "@/types/supplyed";
import { deriveBrandTheme } from "./theme";

let sessionTweaks: Tweaks = { ...defaultTweaks };
const listeners = new Set<() => void>();

function updateSnapshot(next: Tweaks) {
  if (next.accent !== sessionTweaks.accent || next.urgentBanner !== sessionTweaks.urgentBanner) {
    sessionTweaks = next;
  }
}

export function loadTweaks(): Tweaks {
  try {
    const saved = JSON.parse(window.localStorage.getItem("supplyed_tweaks") || "null");
    if (saved && typeof saved === "object") {
      updateSnapshot({
        accent: typeof saved.accent === "string" ? deriveBrandTheme(saved.accent).accent : sessionTweaks.accent,
        urgentBanner: typeof saved.urgentBanner === "boolean" ? saved.urgentBanner : sessionTweaks.urgentBanner,
      });
    }
  } catch { /* Storage may be unavailable; keep the current session preference. */ }
  return { ...sessionTweaks };
}

export function saveTweaks(tweaks: Tweaks) {
  updateSnapshot({ ...tweaks, accent: deriveBrandTheme(tweaks.accent).accent });
  try { window.localStorage.setItem("supplyed_tweaks", JSON.stringify(sessionTweaks)); }
  catch { /* A blocked storage setting must not prevent theme changes. */ }
  for (const listener of listeners) listener();
}

// React needs a stable snapshot identity until the stored values actually change.
export function getTweaksSnapshot(): Tweaks {
  loadTweaks();
  return sessionTweaks;
}

export function getServerTweaksSnapshot(): Tweaks {
  return defaultTweaks;
}

export function subscribeTweaks(listener: () => void) {
  listeners.add(listener);
  const refresh = () => listener();
  const onStorage = (event: StorageEvent) => {
    if (event.key === "supplyed_tweaks" || event.key === null) refresh();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("focus", refresh);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("focus", refresh);
  };
}
```

### UI source: components/molecules/PublicThemeControls.tsx

```tsx
"use client";
import { useDropdown } from "@/features/dropdowns/use-dropdown";
import { DropdownStatus } from "@/components/molecules/DynamicDropdown";


import { useEffect, useRef, useState } from "react";

import { useTweaks } from "@/lib/use-tweaks";
import { applyBrandTheme, deriveBrandTheme } from "@/lib/theme";
import { Icon } from "../atoms";

export function PublicThemeControls() {
  const choices = useDropdown("themeAccent");
  const brandPalettes = (choices.data?.options ?? []).map(option => ({ name: option.label, accent: option.value }));
  const [tweaks, setTweaks] = useTweaks();
  const [open, setOpen] = useState(false);
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const safeAccent = deriveBrandTheme(tweaks.accent).accent;

  function closeControls() {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  useEffect(() => {
    if (!open) return;
    controlsRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
    function dismiss(event: PointerEvent) {
      if (!controlsRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  function openControls() {
    setOpen(true);
  }

  function selectAccent(nextAccent: string) {
    const normalizedAccent = deriveBrandTheme(nextAccent).accent;
    applyBrandTheme(normalizedAccent);
    setTweaks(current => ({ ...current, accent: normalizedAccent }));
  }

  if (!open) {
    return (
      <button
        ref={triggerRef}
        aria-label="Open theme colors"
        aria-expanded={false}
        className="fixed bottom-5 right-5 z-[70] flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface/95 text-ink shadow-panel backdrop-blur transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        onClick={openControls}
        type="button"
      >
        <span className="absolute bottom-2 right-2 h-3 w-3 rounded-full border border-surface" style={{ background: safeAccent }} />
        <Icon name="palette" size={17} />
      </button>
    );
  }

  return (
    <div
      ref={controlsRef}
      role="group"
      aria-label="Theme colors"
      className="fixed bottom-5 right-5 z-[70] flex max-w-[calc(100vw-40px)] flex-wrap items-center gap-1 rounded-panel border border-border bg-surface/95 p-2 shadow-panel backdrop-blur"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeControls();
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <DropdownStatus name="themeAccent" />{brandPalettes.map((palette) => {
        const selected = safeAccent.toLowerCase() === palette.accent.toLowerCase();

        return (
          <button
            key={palette.accent}
            aria-label={palette.name}
            aria-pressed={selected}
            className="h-8 w-8 shrink-0 rounded-full border border-surface transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 cursor-pointer"
            onClick={() => selectAccent(palette.accent)}
            style={{
              background: palette.accent,
              boxShadow: selected ? "0 0 0 2px var(--surface), 0 0 0 3px var(--ink)" : "0 0 0 1px var(--border)",
            }}
            title={palette.name}
            type="button"
          />
        );
      })}

      <button
        aria-label="Close theme colors"
        className="flex h-8 w-8 shrink-0 items-center justify-center cursor-pointer rounded-full text-muted transition hover:bg-chalk hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        onClick={(event) => {
          event.stopPropagation();
          closeControls();
        }}
        type="button"
      >
        <Icon name="x" size={15} />
      </button>
    </div>
  );
}
```

### UI source: components/organisms/TweaksPanel.tsx

```tsx
import { useDropdown } from "@/features/dropdowns/use-dropdown";
import { DropdownStatus } from "@/components/molecules/DynamicDropdown";
import type { AppState, SetAppState, SetTweaks, Tweaks } from "@/types/supplyed";
import { deriveBrandTheme } from "@/lib/theme";

import { Btn, Icon } from "../atoms";

export function TweaksPanel({
  state,
  setState,
  tweaks,
  setTweaks,
}: {
  state: AppState;
  setState: SetAppState;
  tweaks: Tweaks;
  setTweaks: SetTweaks;
}) {
  const choices = useDropdown("themeAccent");
  const brandPalettes = (choices.data?.options ?? []).map(option => ({ name: option.label, accent: option.value }));
  const safeAccent = deriveBrandTheme(tweaks.accent).accent;
  const selectedPreset = brandPalettes.some((palette) => palette.accent.toLowerCase() === safeAccent.toLowerCase());

  if (!state.tweaksOpen) {
    return (
      <button
        className="fixed bottom-5 right-5 z-[70] inline-flex items-center gap-2 rounded-full border border-border bg-white px-3.5 py-2.5 text-ink shadow-panel"
        onClick={() => setState((current) => ({ ...current, tweaksOpen: true }))}
        type="button"
      >
        <Icon name="palette" size={16} />
        <span className="text-sm font-semibold">Theme</span>
        <span className="h-4 w-4 rounded-full border border-border" style={{ background: safeAccent }} />
      </button>
    );
  }

  return (
    <div aria-label="Theme settings" className="tweaks-panel" role="region">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-heading text-lg">Theme</div>
        <Btn aria-label="Close theme settings" variant="ghost" size="sm" icon="x" onClick={() => setState((current) => ({ ...current, tweaksOpen: false }))} />
      </div>

      <div className="flex items-center gap-2.5">
        <DropdownStatus name="themeAccent" />{brandPalettes.map((palette) => {
          const selected = safeAccent.toLowerCase() === palette.accent.toLowerCase();

          return (
            <button
              key={palette.accent}
              aria-label={palette.name}
              aria-pressed={selected}
              className="h-6 w-6 rounded-full border border-white transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2"
              onClick={() => setTweaks((current) => ({ ...current, accent: palette.accent }))}
              style={{
                background: palette.accent,
                boxShadow: selected ? "0 0 0 2px #fff, 0 0 0 4px var(--ink)" : "0 0 0 1px rgba(15, 23, 42, 0.12)",
              }}
              title={palette.name}
              type="button"
            />
          );
        })}
        <label
          aria-label="Custom accent color"
          className="relative h-6 w-6 cursor-pointer rounded-full border border-white transition hover:scale-105 focus-within:ring-2 focus-within:ring-ink focus-within:ring-offset-2"
          style={{
            background: "conic-gradient(from 180deg, #008CC4, #16A34A, #7C3AED, #E11D48, #D97706, #008CC4)",
            boxShadow: selectedPreset ? "0 0 0 1px rgba(15, 23, 42, 0.12)" : "0 0 0 2px #fff, 0 0 0 4px var(--ink)",
          }}
          title="Custom color"
        >
          <input
            aria-label="Custom accent color"
            className="absolute inset-0 cursor-pointer opacity-0"
            onChange={(event) => setTweaks((current) => ({ ...current, accent: event.target.value }))}
            type="color"
            value={safeAccent}
          />
        </label>
      </div>
    </div>
  );
}
```

### UI source: public/dropdown-theme.css

```css
/* Retained standalone forms read the same SupplyEd accent saved by the app. */
:root {
  --cyan: var(--se, #008cc4);
  --cyan-dim: var(--se-dark, #006d99);
  --cyan-light: var(--se, #008cc4);
  --cyan-bg: var(--se-tint, #e6f4f9);
  --cyan-glow: var(--se-tint, #e6f4f9);
  --cyan-border: var(--se-tint-2, #c7e6f2);
}
select[data-dropdown] {
  min-height: 44px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--black);
  color: var(--white);
  font: inherit;
  accent-color: var(--cyan-dim);
}
select[data-dropdown]:not(:disabled):hover { border-color: var(--cyan); }
select[data-dropdown]:focus, select[data-dropdown]:focus-visible {
  border-color: var(--cyan);
  outline: 2px solid var(--cyan-dim);
  outline-offset: 2px;
  box-shadow: 0 0 0 3px var(--cyan-bg);
}
select[data-dropdown]:disabled { background: var(--black-3); color: var(--gray-400); cursor: not-allowed; opacity: .65; }
select[data-dropdown] option { background: var(--black); color: var(--white); padding: 10px 12px; }
select[data-dropdown] option:checked, select[data-dropdown] option:hover { background: var(--cyan-bg); color: var(--cyan-dim); }
select[data-dropdown]::picker-icon { color: var(--cyan-dim); }
@supports (appearance: base-select) {
  select[data-dropdown], select[data-dropdown]::picker(select) { appearance: base-select; }
  select[data-dropdown]::picker(select) { border: 1px solid var(--border); border-radius: var(--radius); padding: 6px; background: var(--black); color: var(--white); box-shadow: var(--shadow-lg); }
}
[data-dropdown-notice] { margin-top: 8px; color: var(--gray-300); font-size: 12px; line-height: 1.6; }
[data-dropdown-notice] button { border: 0; border-radius: var(--radius-sm); padding: 4px 8px; color: var(--cyan-dim); background: var(--cyan-bg); font: inherit; font-weight: 600; cursor: pointer; }
[data-dropdown-notice] button:focus-visible { outline: 2px solid var(--cyan-dim); outline-offset: 2px; }
@media (max-width: 640px) { select[data-dropdown] { font-size: 16px; } }
```

### UI source: public/dynamic-dropdowns.js

```javascript
/* Public legacy forms share the website proxy, without changing their submission transport. */
(() => {
  const cache = new Map();
  async function load(select) {
    const name = select.dataset.dropdown;
    const previous = select.value;
    select.disabled = true;
    let notice = select.nextElementSibling;
    if (!notice?.matches('[data-dropdown-notice]')) { notice = document.createElement('div'); notice.dataset.dropdownNotice = ''; select.after(notice); }
    notice.replaceChildren();
    try {
      if (!cache.has(name)) cache.set(name, fetch('/api/dropdowns/' + encodeURIComponent(name), { cache: 'no-store' }).then(async response => { if (!response.ok) throw new Error('unavailable'); return response.json(); }));
      const data = await cache.get(name);
      if (!Array.isArray(data.options)) throw new Error('unavailable');
      const options = data.options.filter(option => option.isActive);
      const placeholder = new Option('Select an option', '');
      select.replaceChildren(placeholder, ...options.map(option => new Option(option.label, option.value)));
      select.setCustomValidity('');
      if (previous && !options.some(option => option.value === previous)) { select.add(new Option(previous + ' (no longer available)', previous)); select.options[select.options.length - 1].disabled = true; select.setCustomValidity('Choose an available option.'); }
      select.value = previous;
      select.disabled = false;
      select.onchange = () => select.setCustomValidity('');
    } catch {
      cache.delete(name);
      notice.setAttribute('role', 'alert');
      notice.append('Choices are temporarily unavailable. ');
      const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Try again'; retry.onclick = () => load(select); notice.append(retry);
    }
  }
  const controls = Array.from(document.querySelectorAll('select[data-dropdown]'));
  controls.forEach(load);
  window.addEventListener('focus', () => { cache.clear(); controls.forEach(load); });
  for (const form of new Set(controls.map(select => select.form).filter(Boolean))) form.addEventListener('submit', event => {
    if (controls.some(select => select.form === form && (select.disabled || !select.checkValidity()))) { event.preventDefault(); event.stopImmediatePropagation(); const first = controls.find(select => select.form === form && (select.disabled || !select.checkValidity())); first?.focus(); first?.reportValidity(); }
  }, true);
})();
```

### UI source: app/api/dropdowns/route.ts

```ts
import { api } from "@/lib/server/api-client";
import { routeError } from "@/lib/server/route-error";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return Response.json(await api.get("/dropdowns", { auth: false, cache: "no-store" }), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return routeError(error); }
}
```

### UI source: app/api/dropdowns/[name]/route.ts

```ts
import { api } from "@/lib/server/api-client";
import { routeError } from "@/lib/server/route-error";
import type { Dropdown } from "@/features/dropdowns/types";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(name) || name === "admin") return Response.json({ message: "Unknown dropdown." }, { status: 404 });
  try { return Response.json(await api.get<Dropdown>(`/dropdowns/${encodeURIComponent(name)}`, { auth: false, cache: "no-store" }), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return routeError(error); }
}
```

### UI source: app/theme-bootstrap.js/route.ts

```ts
import { themeBootScript } from "@/lib/theme-bootstrap";

/** Standalone forms use the same early theme initialization as the app layout. */
export function GET() {
  return new Response(themeBootScript, {
    headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
```


### UI source: lib/use-tweaks.ts

```ts
"use client";

import { useCallback, useEffect, useSyncExternalStore, type SetStateAction } from "react";
import type { Tweaks } from "@/types/supplyed";
import { getServerTweaksSnapshot, getTweaksSnapshot, loadTweaks, saveTweaks, subscribeTweaks } from "./supplyed-preferences";
import { applyBrandTheme } from "./theme";

export function useTweaks() {
  const tweaks = useSyncExternalStore(subscribeTweaks, getTweaksSnapshot, getServerTweaksSnapshot);
  const setTweaks = useCallback((update: SetStateAction<Tweaks>) => {
    saveTweaks(typeof update === "function" ? update(loadTweaks()) : update);
  }, []);

  useEffect(() => {
    // Read the client snapshot even during hydration; never repaint a saved theme
    // with the server default or persist the default over the user's choice.
    applyBrandTheme(getTweaksSnapshot().accent);
  }, [tweaks.accent]);

  return [tweaks, setTweaks] as const;
}
```


### UI source: lib/query/query-client.tsx

```tsx
"use client";

import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { refreshDropdownsAfterFailure } from "@/features/dropdowns/refresh";
import type { ReactNode } from "react";
import { useState } from "react";

export function QueryProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        mutationCache: new MutationCache({ onSuccess: refreshDropdownsAfterFailure, onError: refreshDropdownsAfterFailure }),
        defaultOptions: {
          mutations: {
            retry: 0,
          },
          queries: {
            gcTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 30 * 1000,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```


### UI source: app/layout.tsx

```tsx
import "./globals.css";
import "@/components/styles/foundation.css";
import "@/components/styles/account.css";
import "@/components/styles/selectors.css";
import "@/components/styles/workspace.css";
import "@/components/styles/teacher-dashboard.css";
import "@/components/styles/proposal.css";
import "@/components/styles/proposal-preview.css";
import "@/components/styles/public.css";
import "@/components/styles/waitlist.css";

import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import type { ReactNode } from "react";
import { RouteLoader } from "@/components/molecules/RouteLoader";
import { themeBootScript } from "@/lib/theme-bootstrap";
import { seoKeywords, siteConfig } from "@/lib/seo";

const inter = localFont({
  src: [
    { path: "./fonts/InterVariable.woff2", weight: "100 900", style: "normal" },
    { path: "./fonts/InterVariable-Italic.woff2", weight: "100 900", style: "italic" },
  ],
  variable: "--font-inter",
  display: "swap",
  fallback: ["Arial", "sans-serif"],
});



export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  applicationName: siteConfig.name,
  title: {
    default: siteConfig.title,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: seoKeywords,
  authors: [{ name: siteConfig.name }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  category: "education",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: siteConfig.name,
    title: siteConfig.title,
    description: siteConfig.description,
    locale: siteConfig.locale,
  },
  twitter: {
    card: "summary",
    title: siteConfig.title,
    description: siteConfig.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html className={inter.variable} lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <Script
          dangerouslySetInnerHTML={{ __html: themeBootScript }}
          id="supplyed-theme-boot"
          strategy="beforeInteractive"
        />
        <RouteLoader />
        {children}
      </body>
    </html>
  );
}
```


### UI source: app/(auth)/layout.tsx

```tsx
import type { ReactNode } from "react";
import { QueryProvider } from "@/lib/query/query-client";

export default function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <QueryProvider>{children}</QueryProvider>;
}
```


### UI source: app/(public)/layout.tsx

```tsx
import type { ReactNode } from "react";
import { PublicThemeControls } from "@/components/molecules/PublicThemeControls";
import { PublicFooter } from "@/components/organisms/PublicFooter";
import { QueryProvider } from "@/lib/query/query-client";

export default function PublicLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <QueryProvider>
      <div className="public-page">
        {children}
        <PublicFooter />
        <PublicThemeControls />
      </div>
    </QueryProvider>
  );
}
```


### UI source: app/(app)/layout.tsx

```tsx
import type { ReactNode } from "react";

import { QueryProvider } from "@/lib/query/query-client";

export default function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <QueryProvider>{children}</QueryProvider>;
}
```

## Final verification record — latest website state

- Full automated suite after dropdown, editor and preference updates: **258 tests passed, 0 failed**.
- TypeScript `tsc --noEmit` passed. Full `npm run lint` passed.
- Read-only dropdown live check: all 45 backend collections available; subject detail observed at revision 2 with 71 options (not a fixed count).
- Website public school waitlist, subject proxy and shared standalone theme script route returned HTTP 200. After the provider fix, `/login`, `/signup` and `/forgot-password` returned HTTP 200 without the reported query-provider error. Login/signup initially serve their normal client-loading shells; the regression test separately renders the real theme control inside the authentication provider.
- Browser automation had no available browser in this session. Interactive visual QA and live form submission were not performed. Verification uses source inspection, automated component/behavior tests and read-only HTTP checks.
- Backend was not modified. No live teacher/school records, jobs, applications, invitations or payments were created for this work.
