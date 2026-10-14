# SupplyED website form and UK-only validation audit

Audit date: 14 October 2026.

**67 forms and standalone interfaces were inventoried across 27 frontend route patterns.** UK phone, postcode, country and structured-location rules now run in the relevant website UI handlers and website server boundaries. The reported first-profile failure was corrected: a valid new UK phone can replace a blank or unverified Pakistani number when creating a profile, even when signup has already assigned the account role. Existing verified-number replacements retain the OTP requirement.

All implementation changes are in `supplyed-web`. The separately deployed backend was inspected **read-only**, with explicit authorization, to confirm contracts. No separate backend, separate admin application, mobile application, customer database or deployment was changed. Administrative branches that already exist inside this website remain part of its inventory.

The full unit suite, lint, type check, production build and local production HTTP smoke passed after the final input-preservation and accessibility corrections. **This does not establish that every form works against live services.** The matrix distinguishes implemented fixes, local verification, partial verification and blocked interfaces. Authenticated customer workflows, real SMS/email, Stripe-hosted forms and database outcomes were not exercised against live services.

Retained deliverables:

- [Per-interface matrix](form-validation-matrix.csv): 67 counted interfaces plus four supplemental shared/inactive entries.
- [Machine-readable evidence](form-validation-evidence.json): counts, status definitions, complete frontend/API route lists, 107 compact browser evidence records, 11 local production HTTP cases, test summaries and limits.
- [Earlier UI consistency audit](ui-consistency-audit.md): broader theme, responsive and accessibility evidence. Its former unrestricted-country selector behavior is superseded by this UK-only validation work.

## 1. Forms and standalone inputs discovered

| Scope | Counted interfaces | FIXED | VERIFIED locally | PARTIALLY VERIFIED | BLOCKED |
| --- | ---: | ---: | ---: | ---: | ---: |
| Public, auth, profile settings and security | 23 | 21 | 0 | 2 | 0 |
| Onboarding, role/step variants and postcode lookup | 17 | 16 | 0 | 1 | 0 |
| Workspace, search/filter, application, messaging and payment interfaces | 27 | 0 | 9 | 15 | 3 |
| **Total** | **67** | **37** | **9** | **18** | **3** |

This is an interface inventory, not a count of HTML `<form>` elements. Role and step variants are separate entries; repeated route placements of the same waitlist and shared phone controls are not counted twice. The CSV contains 71 unique audit IDs: 67 counted interfaces and four `counted=false` entries for shared or equivalent inactive onboarding components. Two unmounted legacy workspace interfaces are explicitly retained in the counted source inventory; the total therefore does not mean 67 active submission endpoints.

`FIXED` means validation was changed and audited, with the row stating the checks performed. `VERIFIED` means the named behavior passed its listed local checks. Neither means complete live end-to-end verification. `PARTIALLY VERIFIED` identifies missing state, persistence or integration checks. `BLOCKED` identifies unavailable provider prerequisites or an interface without a persistence implementation.

Readonly invite/setup/recovery values, resend controls, selector search and navigation/theme controls were inspected alongside their parent interface. No independent form was inferred from a readonly field. Shared controls remain subject to the actual caller's required/optional rules.

## 2. Routes and pages inspected

Every `app/**/page.tsx` and all 44 `app/api/**/route.ts` files were included in source discovery. The complete machine-readable paths are retained in the evidence JSON.

| Frontend group | Registered patterns |
| --- | --- |
| Public: 6 | `/`, `/founding-schools`, `/founding-teachers`, `/how-it-works`, `/terms`, `/signatory-approval/[token]` |
| Authentication: 3 | `/login`, `/signup`, `/forgot-password` |
| Application: 17 | `/applications`, `/billing`, `/bookings`, `/calendar`, `/dashboard`, `/find-jobs`, `/find-teachers`, `/institution-profile`, `/job-detail`, `/messaging`, `/onboarding`, `/payouts/refresh`, `/payouts/return`, `/post-job`, `/security`, `/settings`, `/teacher-profile` |
| Session checkpoint: 1 | `/post-auth` |
| Shared fallback, not an additional registered pattern | 404 page; no extra submitted inputs |

The form task added seven live local invalid-submission checks covering auth and both public waitlist audiences. The earlier UI audit visited all protected routes, which redirected without an authenticated test session. Local component fixtures cover many protected-page states but are not counted as authenticated live route verification. Signup/login verification stages, MAT/school/teacher flows and saved-data variants are explicitly listed in the matrix.

## 3. Forms fixed

- Public school and teacher waitlists now run shared required, enum, email, length, consent and applicable UK rules before the client action and again in the website server action. Optional teacher details require a complete UK postcode when supplied.
- Login/signup/reset use bounded shared email/password rules. OTP and recovery-code handling rejects malformed input rather than stripping/truncating it into a different valid value. Signup sends the actual accepted-terms state to its server action; social signup checks role and terms before its provider callback.
- Teacher/institution settings validate all submitted fields, including saved values. GB-only country, UK city/town and UK county/region controls replace global/arbitrary selections. The county field is editable so an invalid saved value can be corrected. Errors are attached to the relevant field.
- All onboarding transitions, review paths, required documents, phone verification and MAT signatory paths were audited. Initial profile creation and existing-profile correction now use the appropriate phone rules described below.
- Onboarding numeric fields preserve negative and malformed input for validation instead of changing it into a different value. Experience and pupil counts reject fractions; valid decimal rates/travel remain supported. Phone OTP paste preserves malformed/overlong input, rejects it before sending, and exposes associated invalid/error accessibility attributes.
- Job creation/editing/drafts/publication, teacher directory filters, match score, cancellation, rating/review, invoice units, proposal content and link dialogs have actual handler validation. Query/API checks cover supplied malformed filters instead of silently broadening a request.
- Security enable/disable/regenerate actions validate code input before calling actions; regeneration now supports Enter through a form. Signatory approval requires explicit terms, and decline validates its required bounded reason. File/message/payment and preference boundaries retain or strengthen their applicable non-UK rules.

The CSV identifies each interface and its exact evidence. No UK rule was applied to unrelated general search text, proposal text, payment amounts or other non-location fields.

## 4. UK phone validation and the reported profile regression

[Shared UK validation](../lib/uk-validation.ts) uses maintained `libphonenumber-js/max` metadata, GB country identification and full `isValid()` checks. It accepts valid UK mobiles, landlines and supported UK telephone ranges. National, `+44`, `0044`, reasonable spaces/dashes/parentheses and supported international `(0)` forms normalize to E.164 before saving. Foreign calling codes, including `+92`, Crown dependencies, malformed values and invalid reserved examples are rejected. The UK phone controls do not offer a country switch.

Empty optional parent fields remain optional. Explicitly requesting a verification code requires a valid phone. The shared client mutation hook and website phone server action both guard requests; the server also rejects a foreign or mismatched challenge/verification response. A valid number does **not** establish ownership, activity or reachability. A verified badge requires the existing OTP result.

The reported onboarding failure came from a role-only early return: signup had already assigned `INSTRUCTOR` or `INSTITUTION`, so profile creation checked the old saved phone instead of accepting the valid entered number. The website now:

1. Rejects an entered foreign/malformed phone before any write.
2. Saves the submitted canonical UK number during initial profile creation when the saved phone is blank or unverified, including an old Pakistani number.
3. Requires OTP for replacing an already verified phone; equivalent national/E.164 UK values preserve verification without rewriting the number.
4. Keeps existing-profile IDs/documents during correction and blocks review while invalid saved data remains.

Unit tests cover both assigned roles and blank, foreign/Pakistani, verified-replacement and equivalent-UK cases. A built-website HTTP smoke test starts with an old Pakistani phone, accepts UK mobile/landline formats, rejects a submitted Pakistani number before a write, and confirms that formatting alone does not set `phoneVerified`.

Settings also distinguishes a locally edited phone draft from refreshed saved data. A verified number updated in another tab no longer blocks an unrelated profile save; a newly edited invalid/unverified number still does.

## 5. Postcode changes

One tested implementation validates complete UK postcode syntax, including common outward/inward layouts, `GIR 0AA` and Northern Ireland `BT` examples. It handles lowercase and reasonable whitespace and normalizes uppercase with one separating space. Foreign postal codes and malformed or outward-only values are rejected where the field represents a postcode. The waitlist's old postcode-area field now explicitly requests an optional full UK postcode.

Postcode lookup validates on blur, lookup and Enter, rejects stale/mismatched responses and never silently inserts a postcode district as a town. Optional empty postcode fields remain optional; required onboarding postcode fields cannot advance empty. A format match does not prove that a postcode exists or verify a street address.

## 6. Country and structured-location restrictions

`GB` is the canonical country. Supported existing aliases such as UK/United Kingdom normalize to GB; foreign saved values are not silently replaced with GB. Dropdowns offer only United Kingdom, and the same restriction applies at relevant website action/query boundaries.

City/town options and validators use the installed `country-state-city` **GB dataset only**: 3,871 source rows and 3,844 unique names, spanning England, Scotland, Wales and Northern Ireland. Arbitrary legacy city values are no longer inserted as selectable options. Regions start from 247 source subdivision rows, exclude incorrectly GB-grouped overseas entries, and include seven common metropolitan county labels plus normalized aliases.

Invalid foreign country, city/town, region, phone and postcode values remain visible for explicit correction. Free-text street addresses are bounded and checked with available structured fields; no claim is made that the text itself has been geocoded or verified.

## 7. Multi-step flow fixes

Onboarding validates the current visible step inside the actual transition handler and revalidates all applicable earlier data before final submission. Button clicks, Enter, `requestSubmit` and direct review/step requests cannot skip invalid required data. Website final submission validates the complete payload even if a caller forges an earlier step. Pending duplicate requests are blocked, relevant controls are disabled during saves, server field errors return users to the affected step, and valid inputs are retained.

Teacher, single-school and MAT paths have separate inventory rows. MAT checks retain trust/signatory/safeguarding rules. Existing invalid profiles reopen correction with IDs/documents retained. Review checks include saved UK location, phone verification and required documents, rather than only a disabled button.

Job wizard validation covers creation, editing, drafts and publication. Draft-specific rules remain intact; activation validates the full saved job through its owned read endpoint. An interrupted publication can retry the existing job rather than creating a duplicate. The auth reset/verification stages also use guarded submit handlers.

## 8. Single-input and small-interface fixes

Single email reset requests, OTP fields, authenticator/recovery-code forms, phone verification, postcode lookup, required decline/cancellation reasons, score/rating filters, UUID lookups, link dialogs and file pickers were included. Security recovery-code generation now uses the same form handler for Enter and button submission. Invalid format and required errors remain visible while the edited value is still invalid.

Optional review notes, optional phone/postcode/location fields and optional profile fields remain optional where the existing business rules allow them. Search text unrelated to location retains its purpose and length rules. The matrix separately identifies demo/no-op and external-provider interfaces rather than claiming they persist data.

## 9. Website server validation and read-only backend contracts

Validation is enforced in this website's server actions, request handlers and relevant direct authentication gateway, before outbound writes. Thirteen action-module groups plus `auth.ts` and all 44 API route files were audited. Covered rules include auth/OTP/terms, onboarding/settings UK data, job creation/publication, public waitlists, proposal/message content, cancellation/rating, notification preferences, filter types/ranges/dates/IDs and payment integer/amount boundaries. Existing provider-derived amount authority, authentication and upload/preview ownership protections were retained.

| API group | Source files inspected |
| --- | ---: |
| Auth/current user/health | 3 |
| Teachers and public profiles | 5 |
| Settings/onboarding/documents | 5 |
| Jobs | 3 |
| Matching | 4 |
| Applications | 4 |
| Bookings/reviews | 3 |
| Conversations/messages/attachments | 6 |
| Notifications | 3 |
| Invoices | 3 |
| Payouts | 4 |
| Signatory | 1 |
| **Total** | **44** |

Authorized read-only inspection of `supplyed-backend` confirmed that its user update DTO permits an optional string phone, `PATCH /users/me` returns the user DTO, a changed phone resets verification, and `/auth/me` supplies phone data through the common response envelope. The owned `/jobs/mine/:id` endpoint supports drafts and the relevant institution/admin roles, while the public detail endpoint is active-only. These contracts informed the website fixes; the backend working tree remained clean.

**The separately deployed backend still owns persistence and does not acquire UK-only database constraints from this website change.** Direct callers of that backend are outside the website's enforcement boundary. An old foreign OTP created outside the website might be persisted externally before its verification response reaches the website; the website rejects that response but cannot undo that excluded external write. No database migration, constraint change or cleanup was performed.

## 10. Tests executed and actual results

The retained browser evidence contains **107 passing records**, not 107 unique forms. Some records are viewport layouts or grouped assertions. Tests used actual UI/controller code with mocked service boundaries unless explicitly identified as live local or built HTTP.

| Suite | Records / result | Boundary |
| --- | --- | --- |
| Public/auth/settings/security components | 34 PASS: 17 scenarios at 320/1440px | Actions, hooks and signatory fetch mocked; external traffic blocked |
| Public/auth live invalid submissions | 7 PASS at 375px | Running local Next.js; every POST intercepted; zero invalid POST attempts and page errors |
| Workspace components and changed selectors | 26 PASS | Local component/mutation fixtures; relevant layouts include all seven requested widths |
| Onboarding teacher/school/MAT matrix | 18 PASS | Valid/invalid/legacy cases at 320/1440px; page/controller real, service boundaries mocked |
| Shared phone/OTP/postcode controls | 2 PASS records, seven named assertions each | Mocked OTP and intercepted postcode responses |
| Existing-profile correction | 2 PASS | Guarded until mocked OTP success, canonical payload and retained profile ID |
| Changed onboarding contact layout | 7 PASS | 320/375/430/768/1024/1440/1920px; no overflow/page errors; axe at 320/1440 clean |
| Alternative transition guards | 3 PASS | `requestSubmit`, duplicate/pending protection, server-error correction/input preservation |
| Assigned-role first-profile regression | 2 PASS | First creation accepts valid entered phone without an initial OTP prerequisite; five UK formats |
| Numeric/OTP raw-input preservation | 6 PASS | Teacher numbers, school pupil count and phone OTP at 320/1440px; malformed input rejected, explicit correction accepted, OTP ARIA checked |

The full Node suite passed **141/141 tests**, with no failures or skips. It includes phone mobile/landline/international/foreign/empty cases, UK postcode layouts and all four nations, direct server/query bypasses, malformed OTP, required/optional rules, invalid saved data, correction, normalization, rich text, uploads, payment authority, session and retry regressions. Earlier targeted results overlap this full suite and are not added to its count.

The production HTTP smoke passed **11/11 tests** against the built website and a **local mock backend/storage/payment service**. It exercises actual HTTP/server-action boundaries, including the Pakistani-to-UK teacher creation regression, invalid phone/job/filter rejection, byte-preserving uploads and limits, session refresh, and job publish/retry behavior. It does not verify the separately deployed backend or live providers.

## 11. Lint, type-check, build and smoke results

| Command | Final result | Local log |
| --- | --- | --- |
| `npm test` | PASS, 141/141, 0 failed, 0 skipped | `tmp/form-audit/final-unit.log` |
| `npm run lint` | PASS, 0 errors and 0 warnings | `tmp/form-audit/final-lint.log` |
| `npx tsc --noEmit --incremental false` | PASS | `tmp/form-audit/final-typecheck.log` |
| `npm run build` | PASS, Next.js 16.2.9 | `tmp/form-audit/final-build.log` |
| `npm run test:smoke` | PASS, 11/11, actual local built HTTP with mock services | `tmp/form-audit/final-smoke.log` |
| `git diff --check` | PASS, no whitespace errors; line-ending notices only | `tmp/form-audit/final-diffcheck.log` |

The build emitted the existing nonfatal `MODULE_TYPELESS_PACKAGE_JSON` warning for the Tailwind configuration. It did not fail the build. Logs, runners and screenshots remain locally under ignored `tmp/form-audit/`; the matrix and compact results are retained in `docs/` so the report does not depend solely on ignored artifacts. No deployment was performed.

## 12. Forms that remain partly verified or blocked

The matrix has **18 PARTIALLY VERIFIED** interfaces: social-provider signup; the teacher-role image upload variant; onboarding document upload; booking filters; invoice refunds and UUID filters; payout lookup and instant payout; candidate invitations; message composition/attachments; application decisions; legacy match score; job deletion; notification preferences/read actions; header search; theme preferences; and the unmounted legacy description editor. These have source and/or local test evidence, with the remaining condition stated per row.

Three interfaces are **BLOCKED** for complete behavior:

- Stripe payment fields need authenticated invoices/payment secrets and a provider session; no payment was executed.
- Stripe payout/account onboarding needs real embedded-provider prerequisites; its external country/address behavior is not claimed verified.
- Calendar availability/preferences are an existing demonstration with no-op persistence/navigation handlers. There is no real save workflow to verify.

Other existing gaps remain explicit: candidate invitations only close the dialog/show a toast; no sending endpoint is wired in that interface. Header search is functional for the institutional route, while teacher/admin header search remains a pre-existing no-op. Authenticated live CRUD, real message delivery, hiring, emails/SMS, uploads and provider transactions are not established by the local fixtures. A locally `FIXED`/`VERIFIED` row does not override these integration limits.

## 13. Location and address-verification limitations

The reused GB town list is maintainable and broad, but it is not an exhaustive UK address register. A legitimate missing town may require a dataset update or supported canonical selection. Region aliases are normalized; city-to-county pairing is intentionally not enforced because the installed dataset contains inaccurate subdivision relationships for some Northern Ireland towns. No town is invented from a postcode district to conceal that limitation.

Postcode syntax does not prove existence. UK dataset membership does not verify an address. Street text is not geocoded. External postcode-provider availability was mocked for deterministic tests. UK landlines pass numbering validation, but actual SMS/landline delivery capabilities depend on the excluded service and remain unverified. No paid lookup service was introduced.

## 14. Existing invalid data and manual review

The user reported that the previously saved phone was Pakistani. That report was not independently checked against a customer record: no customer database was queried or enumerated. Synthetic saved-record fixtures covered Pakistani/other foreign phones, non-GB countries, foreign towns/regions, malformed postcodes, and invalid prefilled email/numeric text. Loaded invalid values stay visible and block the relevant future update or transition until corrected; they are not silently converted into invented UK personal data. Empty optional fields remain empty where permitted.

Any real foreign or unsupported saved values need an authorized per-record correction or separate cleanup decision. A valid unverified phone can be entered during initial profile creation; replacing an already verified number requires OTP. Existing invalid location values need the user's actual UK details. No records were deleted, no destructive migration was added, and no bulk cleanup or automatic reassignment was attempted.

## 15. Remaining attention and acceptance boundary

The website inventory has been revisited and every counted interface has a status and evidence/limit entry. Relevant owned website submission paths apply the shared UK policy and existing field/business rules, with targeted bypass and correction tests. The command table records the final passing run after the numeric-input and OTP-preservation corrections.

Remaining work is the explicitly listed provider/authenticated integration verification, the pre-existing demo/no-op workflows, dataset maintenance where a real UK location is absent, and any separately authorized correction of actual legacy records. Direct UK enforcement in the separately deployed backend/database would require a distinct backend change; read-only contract inspection does not provide it. This report therefore does not claim universal live-service verification or database-wide UK compliance.

## 16. Follow-up form/theme rescan

The user's missed-waitlist report triggered a second rendered-form pass across every inventory row. See [form-theme-rescan.md](form-theme-rescan.md), its [coverage checklist](form-theme-rescan.csv), and [evidence](form-theme-rescan-evidence.json). This pass fixed waitlist presentation and typography, selected/error dropdown precedence, a clipped mobile notification panel and legacy-editor accessibility.

Phone verification now keeps the SMS-code input and typed code visible when the phone is cleared or changed. A mismatched number disables confirmation and is also rejected by the Enter handler; equivalent UK formatting and restoring the original number preserve the challenge. Requesting a new code resets the code for the updated valid UK number. Mobile/desktop fixtures verified this behavior, retained cooldown and foreign-number rejection without sending SMS.
