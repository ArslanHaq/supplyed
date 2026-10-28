# SupplyED UI consistency audit and verification

Audit date: 14 October 2026. Changes were made directly in the existing codebase. Existing backend/deployment work was retained; nothing was deployed.

Follow-up: [the complete form/theme rescan](form-theme-rescan.md) records the missed waitlist presentation, every form inventory row, subsequent selector/error-state and mobile notification fixes, legacy-editor accessibility, and the persistent SMS-code input behavior. Its newer evidence supplements the initial results below.

The shared theme and controls are substantially more consistent. The reported Teacher Onboarding Primary Subjects control now uses the same accessible, searchable selector system as other forms. The live public/authentication screens and the covered component fixtures have no remaining measured overflow or automated accessibility failures after the recorded corrections. **This is not a claim of 100% visual consistency:** authenticated live routes, service-dependent states and several legacy components remain unverified.

## Coverage and evidence boundaries

- **27 registered frontend page patterns** discovered from every `app/**/page.tsx`, including the dynamic signatory token route. There are 17 application routes, 3 auth routes, 6 public routes and the post-auth checkpoint. Query parameters and role variants are included in the matrix, not counted as new routes.
- **9 registered patterns visually verified live**, plus the shared **404 fallback**: 10 screens × 7 requested widths = **70 live responsive renders**. The signatory route was verified only with an invalid token.
- **18 registered patterns blocked for live content** by the absence of an authenticated test session. All 18 were visited; each correctly redirected to login. No authenticated test account/session was available for live browser navigation. Individual component fixtures do not count as authenticated-route verification.
- **119 TSX component files inventoried and scanned**, including atoms, molecules, onboarding, both active/legacy dashboards and conditional panels. The [component matrix](ui-consistency-components.csv) separates source corrections from visual coverage. Source PASS means the source pattern audit found no outstanding issue, not every state was rendered.
- Responsive widths: **320, 375, 430, 768, 1024, 1440 and 1920px**, using headless Chrome. Browser suites checked document overflow, screenshots, console/page errors, relevant keyboard interactions and axe WCAG A/AA rules. Representative short-viewport overlays and menus were also checked.

Detailed evidence is local under `tmp/ui-audit/` (intentionally ignored by Git): public live results, selectors/onboarding fixtures, workspace fixtures, screenshots, runners and before/fixed results. The CSV matrices and this report are retained in `docs/`.

## Existing design system and decisions

The application uses Next.js App Router (installed 16.2.9), React 19, Tailwind 4 with a TypeScript config, CSS component layers, Lucide icons, TanStack Query, NextAuth, Quill and Stripe-hosted embedded forms. Theme variables live in `app/globals.css`; `foundation.css` establishes the primary shared patterns, with account/workspace/public styles extending layouts. `lib/theme.ts` and the early bootstrap apply the saved accent.

Conflicts were resolved in favor of the shared atoms and foundation controls. The blue branding, Inter typography, existing semantic colors and inverse marketing/auth sections were retained. Equivalent fields inherit shared dimensions. Marketing layouts and author-formatted proposal content remain intentional exceptions; Google/Microsoft brand marks and OS/Stripe internals were not recolored indiscriminately.

| Token / pattern | Canonical decision |
|---|---|
| Accent / action / readable brand text | Keep `--se` / default #008cc4. Use `--se-dark` for primary actions and readable small brand text. Existing 22% darkening retained unless contrast against the tint needs at least 4.6:1; all six presets and pale custom colors tested. Early bootstrap and interactive derivation match. |
| Surfaces / text / borders | Existing surface, surface-2, chalk, ink, graphite, slate, border and border-2 tokens. Muted text adjusted to #5f707b and danger to #cf1941 to correct measured contrast on tinted surfaces. No new color scheme. |
| Typography | Inter through `--sans`; heading/legacy serif aliases resolve to Inter. Removed unintended Georgia waitlist override. Base body 15px, controls 14px (16px on mobile), labels 13px; existing semantic heading/type scales retained. |
| Controls | New centralized `--control-height:46px`, `--control-radius:9px`, `--control-padding-x:13px`, `--control-padding-y:11px`, `--control-font-size:14px`. Textareas retain their multiline height. |
| Buttons | Shared primary, secondary, ghost, ink and danger variants; 44px default, 36px small, 48px large, 52px XL. Loading content reserves dimensions; long labels wrap. Legacy .btn equivalents aligned. |
| Radii / shadows | Existing 6/10/12/18px scale, 9px form-control exception from foundation, 4px checkbox corners; shared shadow tokens for surfaces/menus. Pills and avatar circles remain semantic shapes. |
| Focus / interaction | Brand border plus centralized 3px focus halo; danger halo for invalid fields; shared placeholders, disabled states and visible keyboard focus. Native radio accent retained; checkboxes now share one themed primitive. |
| Spacing / responsive | Existing 4px-based utility scale and dedicated page layouts; shared label spacing and field/helper layout retained. Default Tailwind breakpoints plus xs420 and 3xl1800; no new layout system. |
| Motion / scrolling | 150–180ms existing control/surface transitions, shared duration/easing tokens, reduced-motion behavior retained. Thin themed scrollbars; bounded, scrollable menus/dialogs. |

## Corrections implemented

- Unified single, multiple and searchable selectors. Menus use theme tokens, selected indicators, consistent row spacing and disabled/error states. Keyboard supports arrows, Home/End, Enter/Space, typeahead/search, Escape, Tab, clear-all and focus restoration. Native hidden controls preserve named FormData and required validation where applicable. Native popovers keep menus above clipping containers while retaining their parent dialog's focus scope.
- Migrated onboarding country/city, school type, public waitlist, directory filters, booking invoice filters, refund reason and settings selectors. Primary subjects and skills are searchable. The subsequent form-validation task restricts country to GB and city/town/region choices to the UK dataset. It supersedes the original international selector checks; see the form-validation report for final behavior.
- Linked Field labels, helpers, errors and required indicators to nested native/custom controls while preserving native control semantics. The subsequent form task adds shared validation explicitly requested by the user. Unified native-compatible named/required checkboxes, toggles, tag entry and error styling.
- Corrected primary/secondary/destructive surfaces, variable loading dimensions, mobile action wrapping, independent auth/public control sizes and inconsistent button corners. Added focus/pressed/selected semantics to relevant tabs, posting choices and review controls.
- Standardized account menu keyboard behavior and ARIA structure, modal focus-trap handling, job action menus, notification controls and document preview sizing. Reused the shared proposal reader in messaging and added a shared DeleteJobModal in place of native confirmation boxes, preserving the original deletion action.
- Replaced inconsistent surfaces/gradients, text opacity, serif overrides, badge conflicts, invalid legacy rgba syntax and hardcoded status borders. Improved message timestamp, profile, calendar, loader and error contrast. Preserved intentional semantic and vendor colors.
- Aligned Stripe appearance with current Inter/color/control tokens and update existing iframe appearance when the active theme changes; payment secrets, session creation and payment actions are unchanged.
- Added a themed 404 fallback consistent with the shared route-error screen.

## Responsive and state verification

The important defects resolved were clipped dropdown menus; uploaded-document cards expanding to 454px on a 320px viewport when filenames were long; an over-wide decorative jobs map within its panel; mobile postcode/action rows; long tag text; short-viewport document previews; and wrapping job/security/payout/calendar actions. Final corrected evidence reports no unintended document overflow in the covered layouts.

The selector fixture covers teacher empty/populated/error profiles, account role choice, school and MAT details, institution profile/staffing, both compliance variants, review, teacher/school document loading/error/empty/required/uploaded states, upload pending/disabled/error states, and shared controls. Workspace fixtures cover teacher/school/admin dashboards, applications/list/detail, jobs/create/edit/detail, teachers, bookings, calendar, messaging, settings, security, profiles/reviews, billing by role, delete confirmation and proposal reading/composition. Synthetic data and no-op callbacks isolate UI rendering; they do not verify real service integration.

| Component families | Status | Verified scope / exceptions |
|---|---|---|
| Single/multiple/searchable dropdowns, autocomplete | FIXED | Default/open/closed/search/empty/selected/clear/error/disabled; keyboard, FormData, labels, bottom-edge positioning and modal top layer. Six accent palettes checked. |
| Text/email/password/phone/number/textarea/date/time fields | FIXED | Shared field theme/labels/errors and rendered form controls. OS date/time picker internals and SMS exchange are BLOCKED. |
| Checkboxes/radios/toggles | FIXED | Pointer/Space, selected/disabled, native named/required submission semantics; native radio accent retained. |
| Buttons/icon buttons/links | FIXED | Shared variants, focus/hover/loading/disabled, wrapping and constant loading dimensions. Specialized navigation controls remain variants. |
| Chips/tags/badges/status indicators | FIXED | Theme/semantic tokens; tag add/remove; selected counts; readable statuses. |
| Navigation/sidebar/header/footer/breadcrumbs | FIXED | Public live desktop/mobile; application shell fixture; account/job-menu keyboard. Authenticated public header is not live verified. |
| Tabs/cards/tables/pagination/search/filter | FIXED | Workspace fixtures and existing pagination tests; all real-data combinations not asserted. |
| Modals/dialogs/popovers/drawers/tooltips | FIXED | Shared dialog focus, dropdown layering, preview/confirmation/proposal/invoice surfaces; native tooltip/OS behavior retained. No distinct reusable drawer was found. |
| File uploads/drop zones/document previews | FIXED | Empty/loading/error/pending/disabled/uploaded/long filename and preview layout. Real uploaded content not visually verified; backend byte handling covered separately by existing tests. |
| Stepper/progress/accordions | FIXED | Onboarding/review styles, auth progression, marketing FAQ and workflow controls. Actual service-driven progression remains BLOCKED; final form fixtures exercise guarded progression with mocked actions. |
| Toasts/loaders/skeletons/alerts/error screens | FIXED | Shared feedback fixtures and live error/404 screens; retry/dismiss and contrast checks. |
| Rich-text editors | FIXED | Quill toolbar/content styling and proposal composer. Legacy RoleDescriptionEditor source-only; author-selected document fonts/colors preserved. |
| Stripe forms/payout callbacks | BLOCKED | Appearance code and local theme tests passed; real hosted forms/payment/return flows require Stripe and authenticated test data. |
| Legacy/unmounted components | NOT TESTED | Source scanned and corrected where needed; explicit rows in component CSV. |

## Route verification matrix

PASS/FIXED describe only the states stated in the evidence. BLOCKED is a live-route limitation even when its components have fixture evidence. NOT TESTED identifies a separately unrendered state/component. All nine accessible registered routes and the 404 were visually checked at all seven widths; all protected patterns were visited and redirected to login.

| Route | Status | Scope and conditional states |
|---|---|---|
| / | FIXED | Marketing, both waitlist audiences, FAQ, mobile navigation and palette controls. |
| /applications | BLOCKED | Teacher and institution variants; job/application query context and workflow states. |
| /billing | BLOCKED | Institution invoices, teacher payouts and admin lookup/refunds; external Stripe frames blocked. |
| /bookings | BLOCKED | Teacher/institution lists, cancellation, review and invoice dialogs. |
| /calendar | BLOCKED | Teacher calendar; other roles return to their dashboard. |
| /dashboard | BLOCKED | Teacher, institution and admin dashboards; pending/rejected/suspended status branches. |
| /find-jobs | BLOCKED | Teacher jobs, filters, recommendation and list/map views. |
| /find-teachers | BLOCKED | Institution teacher directory, search, key-stage/rating filters. |
| /forgot-password | FIXED | Initial and local validation; reset-code/new-password/success require email token. |
| /founding-schools | FIXED | School waitlist and consent; successful backend submission not performed. |
| /founding-teachers | FIXED | Teacher waitlist; post-registration optional-details state requires a returned capability. |
| /how-it-works | FIXED | Teacher, school and MAT marketing journeys. |
| /institution-profile | BLOCKED | Profile selected by institutionId; school and review data required. |
| /job-detail | BLOCKED | Role selected by jobId; teacher proposal/institution candidate variants. |
| /login | FIXED | Initial and local validation; OTP, OAuth and 2FA transitions require a test account/service. |
| /messaging | BLOCKED | Inbox, threads, proposal reader, attachments and notifications need account records/socket. |
| /onboarding | BLOCKED | Teacher profile/review/documents; school/MAT contact/details/compliance/review/documents. |
| /payouts/refresh | BLOCKED | Stripe link refresh callback needs authenticated payout state. |
| /payouts/return | BLOCKED | Stripe return callback needs authenticated payout state. |
| /post-auth | BLOCKED | Authenticated routing checkpoint; anonymous access redirects to login. |
| /post-job | BLOCKED | Institution four-step create flow and query-selected edit flow. |
| /security | BLOCKED | Account security, 2FA setup/challenge/recovery/disable states. |
| /settings | BLOCKED | Role-specific profile, notification and payout settings. |
| /signatory-approval/[token] | FIXED | Invalid-token state only; valid pending/approved/declined/expired states need real tokens. |
| /signup | FIXED | Initial, role selection and founding-prefill query variants; verification requires account creation/email. |
| /teacher-profile | BLOCKED | Authenticated public teacher profile selected by teacherId; reviews and credentials. |
| /terms | PASS | Legal content and anchors; shared header/footer. |
| Unmatched path (404 fallback) | FIXED | Added themed not-found screen; tested /ui-audit-missing-page. |

Machine-readable route matrix: [ui-consistency-routes.csv](ui-consistency-routes.csv). File-by-file component matrix: [ui-consistency-components.csv](ui-consistency-components.csv).

## Tests and final checks

- `npm.cmd test`: **141 tests passed; 0 failures**.
- `npm.cmd run lint`: **PASS**, no errors or warnings.
- `npx.cmd tsc --noEmit --incremental false`: **PASS**.
- `npm.cmd run build`: **PASS**, including production compilation, TypeScript and route generation.
- `npm.cmd run test:smoke`: **11 tests passed; 0 failures** against a built Next server and an isolated in-memory backend/storage. Includes UK input rejection, normalized replacement of an old Pakistani phone during teacher creation, draft publish retry, real HTTP uploads/previews and session-cookie handling. No real account or third-party service was used.
- `git diff --check`: **PASS**, no whitespace errors (Git reports only its configured LF/CRLF conversion warnings).
- Recorded UI browser evidence: **70 live responsive renders**, **37 public interaction/axe records**, **147 selector/onboarding renders**, **22 selector interactions**, **12 feedback checks**, **7 near-bottom menu checks**, and **222 workspace fixture records**. Final corrected collections have no measured document overflow or axe violations. Earlier harness/failure records are retained locally and superseded explicitly by final result files.
- Additional final UK form, phone/location and correction-path browser evidence is in [form-validation-evidence.json](form-validation-evidence.json). Earlier country-selection tests intentionally covered the old international behavior; final UK restrictions were tested by the later suite.

Browser result summaries and useful screenshot links are recorded in [ui-consistency-evidence.json](ui-consistency-evidence.json). Browser tools were installed only under ignored `tmp/ui-audit/tools`. The UI changes added no production dependency; the subsequent UK phone-validation task added `libphonenumber-js`, as requested. The project has no pre-existing browser-test runner; isolated local fixtures used the production components/styles/fonts and Playwright/axe. Original test suites were reused.

## Remaining risks and limits

1. Live teacher/institution/admin sessions, backend data, OAuth, email/SMS/2FA/reset codes, successful waitlist confirmation, valid signatory decisions and real Stripe states remain blocked. Protected routes are not counted as visually verified merely because their login redirect worked.
2. Chrome automation and screenshots cover the stated sizes/states; Safari, Firefox, physical mobile keyboards, assistive-technology traversal and every dynamic data combination were not tested. The selector top-layer behavior depends on modern Popover API support.
3. Existing CalendarPage has a static March 2026 demonstration, dates 32/33 and no-op navigation/save/preferences. Some legacy dashboards/profile actions and metrics are static, and the school candidate invitation currently uses a local toast. These pre-existing functional limitations were retained because changing them exceeds the theme task.
4. Proposal author formatting, native file/color/date/time pickers, PDF viewers and externally hosted Stripe UI cannot be guaranteed identical to local controls. Source-only legacy components and unavailable conditional states are marked explicitly in the matrices.
5. Automated axe/overflow checks are useful evidence, not proof of complete accessibility or visual identity. The final assessment is **consistent across the verified states, with authenticated live acceptance still blocked**, not 100% coverage. Later UK validation changes have their own targeted browser evidence and do not turn earlier screenshots into final-state evidence for changed controls.

## Files changed for this audit

The list below excludes unrelated pre-existing backend/deployment changes. `PostJobPage.tsx` already had user edits; its existing behavior was retained and UI consistency and the subsequently requested form-validation changes were added without reverting unrelated work. The audit also adds this report, two CSV matrices and the JSON evidence summary. The follow-up [form-validation audit](form-validation-audit.md) documents 67 form/input interfaces and website server boundaries separately.

- `app/(public)/how-it-works/page.tsx`
- `app/globals.css`
- `app/layout.tsx`
- `app/not-found.tsx`
- `components/atoms/Avatar.tsx`
- `components/atoms/Button.tsx`
- `components/atoms/Checkbox.tsx`
- `components/atoms/Chip.tsx`
- `components/atoms/Field.tsx`
- `components/atoms/Stars.tsx`
- `components/atoms/Toggle.tsx`
- `components/molecules/AppAccountMenu.tsx`
- `components/molecules/MatchScorePanel.tsx`
- `components/molecules/Modal.tsx`
- `components/molecules/OptionDropdowns.tsx`
- `components/molecules/PhoneInput.tsx`
- `components/molecules/PhoneVerification.tsx`
- `components/molecules/PostcodeLookup.tsx`
- `components/molecules/ProposalEditor.tsx`
- `components/molecules/PublicAccountMenu.tsx`
- `components/molecules/PublicThemeControls.tsx`
- `components/molecules/RoleDescriptionEditor.tsx`
- `components/molecules/RouteErrorState.tsx`
- `components/molecules/SocialAuthButtons.tsx`
- `components/molecules/TagInput.tsx`
- `components/molecules/ToastStack.tsx`
- `components/molecules/index.ts`
- `components/organisms/AdminPayoutLookup.tsx`
- `components/organisms/AppChrome.tsx`
- `components/organisms/ApplicationStatusPage.tsx`
- `components/organisms/ApplicationsPage.tsx`
- `components/organisms/ApplicationsWorkspacePage.tsx`
- `components/organisms/BillingPage.tsx`
- `components/organisms/BookingsPage.tsx`
- `components/organisms/CalendarPage.tsx`
- `components/organisms/DeleteJobModal.tsx`
- `components/organisms/FindJobsPage.tsx`
- `components/organisms/FindTeachersPage.tsx`
- `components/organisms/ForgotPasswordRouteClient.tsx`
- `components/organisms/FoundingInterestForm.tsx`
- `components/organisms/FoundingInterestPage.tsx`
- `components/organisms/FoundingSchoolSections.tsx`
- `components/organisms/FoundingTeacherSections.tsx`
- `components/organisms/InstitutionDashboard.tsx`
- `components/organisms/InstitutionProfilePage.tsx`
- `components/organisms/JobDetailPage.tsx`
- `components/organisms/JobManagementList.tsx`
- `components/organisms/LoginPage.tsx`
- `components/organisms/MessageAttachmentPreview.tsx`
- `components/organisms/MessagingPage.tsx`
- `components/organisms/NotificationBell.tsx`
- `components/organisms/NotificationSettings.tsx`
- `components/organisms/OnboardingPage.tsx`
- `components/organisms/PayInvoiceModal.tsx`
- `components/organisms/PostJobPage.tsx`
- `components/organisms/PublicTeacherProfilePage.tsx`
- `components/organisms/SecurityPage.tsx`
- `components/organisms/SettingsPage.tsx`
- `components/organisms/SignatoryApprovalPage.tsx`
- `components/organisms/SignupAccessPage.tsx`
- `components/organisms/SignupRouteClient.tsx`
- `components/organisms/SignupVerifyPage.tsx`
- `components/organisms/StripePayoutComponents.tsx`
- `components/organisms/TwoFactorChallengePage.tsx`
- `components/organisms/WaitlistConfirmation.tsx`
- `components/organisms/dashboards/SchoolDashboard.tsx`
- `components/organisms/onboarding/CountryCityFields.tsx`
- `components/organisms/onboarding/DocumentPreviewModal.tsx`
- `components/organisms/onboarding/ReviewCard.tsx`
- `components/organisms/onboarding/UploadCard.tsx`
- `components/organisms/onboarding/steps/AccountBasicsStep.tsx`
- `components/organisms/onboarding/steps/DocumentUploadStep.tsx`
- `components/organisms/onboarding/steps/InstitutionComplianceStep.tsx`
- `components/organisms/onboarding/steps/InstitutionDetailsStep.tsx`
- `components/organisms/onboarding/steps/InstitutionProfileStep.tsx`
- `components/organisms/onboarding/steps/InstitutionStaffingStep.tsx`
- `components/organisms/onboarding/steps/ReviewStep.tsx`
- `components/organisms/onboarding/steps/TeacherDocumentsStep.tsx`
- `components/organisms/onboarding/steps/TeacherProfileStep.tsx`
- `components/organisms/onboarding/types.ts`
- `components/organisms/onboarding/useOnboardingForm.tsx`
- `components/organisms/onboarding/utils.ts`
- `components/organisms/onboarding/validation.ts`
- `components/styles/account.css`
- `components/styles/foundation.css`
- `components/styles/proposal-preview.css`
- `components/styles/proposal.css`
- `components/styles/public.css`
- `components/styles/selectors.css`
- `components/styles/waitlist.css`
- `components/styles/workspace.css`
- `features/payments/stripe-client.ts`
- `lib/theme.ts`
- `tests/stripe-theme.test.cjs`
- `tests/ui-controls.test.cjs`
