# Website form and theme rescan — 14 October 2026

This follow-up addresses the missed overall waitlist styling and revisits all **67 inventoried interfaces**, plus four shared-control/component rows. The coverage checklist is [form-theme-rescan.csv](form-theme-rescan.csv); recorded checks and the source inventory are in [form-theme-rescan-evidence.json](form-theme-rescan-evidence.json). The earlier [validation matrix](form-validation-matrix.csv) still records submission rules and integration limits.

## Changes

- The landing and founding-page waitlists now use the existing brand tint for the heading, a solid brand-selected audience tab, shared control sizing, consistent field spacing, and readable checkbox/privacy text. The optional post-signup details and invite-link input no longer override shared control text with 12px styling.
- Single and multiple selectors share branded open/filled states. Invalid fields retain their red border even when filled or open; disabled controls retain their disabled treatment.
- The mobile notification panel no longer has Tailwind positioning utilities overriding its responsive CSS. Its bounds were checked at all seven requested widths.
- The reusable legacy role-description editor now exposes its textbox, multiline/error state, toolbar and generated font-size button correctly to assistive technology. This component is currently unmounted by active routes but was included in the rescan.
- **The SMS-code input stays visible when the phone number is cleared or edited.** Its entered code and resend cooldown are preserved. A notice identifies the number the code belongs to; confirmation, including Enter submission, is blocked while the current number differs. Restoring that number or changing only its equivalent UK formatting permits confirmation. Requesting a new code binds the challenge to the updated valid UK number and clears the previous code. Foreign numbers cannot request verification.

The earlier UK-only phone, GB country, UK town/region and postcode validation remains in place. Format validation does not imply ownership or successful SMS delivery.

## Coverage and verification

The source scan found **295 field/control usages across 41 TSX files**, including 118 native input/select/textarea declarations. A supplementary search found no native form controls in TSX outside the application/component trees. Hidden native selects, file controls, rich-text editors and inputs inside search/tag wrappers were reviewed separately from standard text fields.

The browser pass exercised real components with local synthetic data and mocked submission boundaries. It inspected controls at different wizard stages and inside conditional dialogs, rather than inferring visual consistency from shared-component imports. Screenshots were reviewed, including mobile forms, uploads, billing, messaging and notification states. This exposed the clipped notification panel despite its page reporting no document overflow.

| Recorded check set | Records | Result |
| --- | ---: | --- |
| Public/auth/settings/security actions | 34 | Pass |
| Workspace form actions and responsive filters | 26 | Pass |
| Teacher, school and MAT onboarding flows | 18 | Pass |
| Additional conditional forms and legacy controls | 22 | Pass |
| Notification panel and legacy editor at seven widths | 14 | Pass |
| Filled-invalid selectors at seven widths and phone error states | 9 | Pass |
| Persistent SMS-code UI after phone edits | 2 | Pass |
| Workspace page renders | 46 | No recorded page errors, overflow or accessibility violations |
| Live local waitlists, both audiences and six palettes | 24 | Pass; invalid submissions blocked |
| Phone/postcode controls with mocked services | 2 | Pass |

These are **197 browser records**, with overlap between shared components and their callers. A separate 42-render sweep covered all 21 onboarding/upload/control variants at 320 and 1440px. The instrumentation captured **504 form states** with no recorded WCAG A/AA axe violations or document overflow. Snapshot groups include diagnostic captures; targeted final checks supersede earlier selector border observations. These counts do not imply 504 independent end-to-end flows or complete accessibility certification.

The requested widths were 320, 375, 430, 768, 1024, 1440 and 1920px. All form groups were revisited at mobile/desktop widths; shared selectors, responsive filters, live waitlists and the corrected notification/editor layouts also received the seven-width checks. OTP digit boxes, textareas, rich-text areas and embedded search inputs remain intentional size variants. Standard text/select controls use the shared 46px minimum height and 9px radius.

Final verification: **141 unit tests passed; ESLint passed; production build and TypeScript checks passed; `git diff --check` passed.** The build emits the existing nonfatal module-type warning for `tailwind.config.ts`.

Local runners, screenshots and detailed state measurements are under `tmp/form-audit/rescan/` and `tmp/form-audit/landing-theme/`. They are ignored local QA artifacts. No real accounts, SMS/email, messages, hiring decisions, signatory approvals, uploads or payments were submitted.

## Remaining verification limits

Every inventory row has a coverage entry; rows are not all claimed live-service verified. Stripe-hosted payment and payout onboarding still require provider sessions. The MAT resend action was source/shared-button reviewed without obtaining a pending live trust approval. Authenticated persistence, SMS ownership/delivery and external postcode availability remain outside local fixture proof.

The existing calendar demo, toast-only candidate invitation and teacher/admin header-search no-ops remain documented in the original validation report. Their visual controls were included; this rescan does not claim those integrations now exist. The UK location dataset is broad but is not an exhaustive address register.

Changes are confined to this website. The separate backend was read only, separate applications were excluded, and nothing was deployed.
