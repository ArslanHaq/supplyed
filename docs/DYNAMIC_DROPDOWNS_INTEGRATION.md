# SupplyEd website: database dropdown integration

Implemented 19 October 2026 in `supplyed-web`. Read alongside the backend's `DROPDOWNS_FRONTEND_INTEGRATION.md`, `TEACHING_CATALOGUE_FRONTEND_INTEGRATION.md` and the preserved [dropdown.md](dropdown.md) inventory. The original W/O/S/J/I/D/A/B/M/R/L control IDs are unchanged so future work can refer to the same controls.

## Scope and source of truth

Website reference choices now come from the public database dropdown API. This includes school/teacher waitlists, onboarding, settings, job creation/editing, new jobs inside invitations, discovery filters, application/job/invitation/booking/invoice status choices, refunds, editor formatting, theme presets and the retained standalone HTML forms. Labels, active membership and supported subject/skill relationships follow the returned data.

The backend was read only. No backend code, database records, seeds, migrations, invitations or profile data were changed for this integration. The separate `supplyed-admin` dropdown manager is outside this marketplace repository; its integration instructions are in the backend's `DROPDOWNS_ADMIN_INTEGRATION.md`.

Old option snapshots in `dropdown.md` and unused legacy constants are historical references, not fallback choices. Do not reconnect forms to those arrays. Counts are not part of frontend validation.

## Public API and website transport

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

## Shared implementation and lifecycle

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

## Complete collection-to-control map

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

## Subjects, skills and custom-name round trips

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

## Business APIs remain the same

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

## Controls that keep their own source

- Account/navigation menus contain application routes and executable actions. Existing role checks and logout behavior remain local.
- Notifications, conversations, invitation job choices, uploads and bookings use their existing account/entity APIs and IDs.
- Stripe PaymentElement/Connect menus remain owned by Stripe.
- Browser date/time, upload, custom color and ordinary boolean controls are not finite dropdown collections.
- Editor format support and technical status transitions remain enforced by code/backend. Database presentation changes cannot introduce unsupported payment modes or an Interview stage. Quill format menus sit outside Quill's generated toolbar to prevent its picker transformation from conflicting with React controls.
- Application stages remain APPLIED, VIEWED, SHORTLISTED, HIRED, REJECTED. Direct hire/reject remains available where the existing transition/permission rules allow it. Invited is a distinct view, not an application status.

## Validation performed

- Read-only live backend checks succeeded for all 45 collection detail endpoints. The observed subject collection had revision 2 and 71 options, demonstrating that current database data already differed from the initial seed. These are observations, not assumed constants.
- Website `/api/dropdowns/subject` returned HTTP 200 with the unwrapped detail object.
- Website `/founding-schools` returned HTTP 200, contained the waitlist and dropdown loading UI, and contained no missing-query-provider/server-error screen.
- TypeScript no-emit check passed.
- Full automated suite after shared-editor/theme integration: **258 passed, 0 failed**. Includes subject-key relationships, shared/retired skills, editable labels versus payload values, custom skills, explicit clears, unchanged PATCH preservation, current waitlist membership, real dropdown rendering and query context for public forms and authentication theme controls, plus stable theme hydration/persistence.
- Full `npm run lint` passed. TypeScript `tsc --noEmit` passed.

Interactive visual browser QA was unavailable in this session. Live verification used read-only HTTP requests and automated server-rendered component checks; no live form submissions or admin edits were performed.

## Shared role editor and theme follow-up (19 October 2026)

`RoleDescriptionEditor` is now a thin wrapper around `ProposalEditor`, used by the job wizard (create/edit) and the invitation new-job form. The wrapper changes its label/placeholder, preserves existing Markdown descriptions on import and does not emit an edit simply because an existing value was loaded. Both editors fetch the **same** `proposalFontFamily`, `proposalFontSize`, `proposalTextColor` collections. The historical `descriptionFontSize` collection is no longer an independent website menu.

`FormattedJobDescription` delegates HTML to the existing sanitized `ProposalContent` reader; plain/Markdown records keep the old renderer. Job reviews, teacher job details, offered invitation terms and school application job details therefore display rich formatting without exposing raw tags. Payloads remain HTML strings in `description`; no new endpoint or body property is introduced. Job validation retains its 10,000-character serialized description limit, and application proposals retain their separate 2,000-character visible-text rule.

All authored React form dropdowns use the theme-token based `OptionDropdowns` control. Hover/selected/focus/menu/search states use the current SupplyEd accent and surfaces; warnings retain semantic warning colors. The school/teacher standalone HTML dropdowns now load `public/dropdown-theme.css` and `/theme-bootstrap.js`. That route and the root layout share `lib/theme-bootstrap.ts`. Native browser popup styling uses `appearance: base-select` where supported; older browser/OS picker chrome remains platform-controlled.

Theme presets remain database-driven. Preferences now persist under `supplyed_tweaks` with session fallback if browser storage is unavailable. Early bootstrap and interactive updates use the same derived color rules, including a readable dark tone for pale accents. The mobile handoff contains the exact tokens, algorithms, control measurements, interaction rules and current source snapshots.

## Authentication provider coverage and theme hydration

The dynamic public theme control calls `useDropdown("themeAccent")`, which uses TanStack Query. The shared `QueryProvider` must therefore surround it on authentication routes as well as public pages and the signed-in workspace. `app/(auth)/layout.tsx` now wraps login, signup and forgot-password children with the existing provider. The other route-group layouts retain their own providers. Do not fix this by removing the dynamic theme query, returning hardcoded presets, or constructing a new query client during every component render. The existing provider creates a stable client once per mount.

The reported `No QueryClient set, use QueryClientProvider to set one` happened because authentication pages rendered the new dynamic theme control outside a provider. A regression test now renders the real `PublicThemeControls` under the actual authentication layout and its real dropdown hook. Login, signup and forgot-password returned HTTP 200 in read-only checks. Login/signup initially render their normal client-loading shells; the HTTP checks alone do not prove browser hydration. The real-component regression test covers the missing query-context failure.

`lib/use-tweaks.ts` shares theme preferences through React's `useSyncExternalStore`. The server snapshot is the stable default; the client reads saved local preferences without overwriting them during hydration. Snapshot identity changes only when accent or urgent-banner preference changes. Same-page saves notify subscribed controls; storage events and returning focus re-read preferences. Public/auth theme controls and the signed-in shell use the same hook. Only user changes persist preferences; simply loading a screen does not write default values. Mobile should use its own observable local-preferences store and foreground refresh, preserving the same behavior rather than porting browser hooks.
