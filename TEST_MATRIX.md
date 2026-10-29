# SupplyEd test matrix

Audit date: 2026-10-28. Companion to [AUDIT_REPORT.md](AUDIT_REPORT.md). Every row separates the test expectation from the actual observation. **PASS** means only the described bounded check passed. **FAIL** includes a reproduced defect or a failed existing check. **BLOCKED** means a check was attempted but its required environment failed. **NOT TESTED** means the listed runtime journey was not executed, even if its code or a related unit test was reviewed.

No browser E2E journey is claimed to pass. The only running website was an isolated web production build on loopback with an auth-denying mock backend; no real accounts, providers, production database or external application endpoint was used. Existing tests use fixtures/mocks unless explicitly marked as skipped database integration. Source-supported findings use their own status in the report and do not convert the planned E2E rows into passes.

## Existing checks and build/tool availability

| Feature / check | Test scenario | Expected behavior | Actual behavior | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| Web lint | npm.cmd run lint | Check completes successfully without modifying application source | No errors at baseline; audit helpers excluded from application assessment | PASS | web-lint.txt |
| Web types | node node_modules/typescript/bin/tsc --noEmit --incremental false | Check completes successfully without modifying application source | No diagnostics | PASS | web-types.txt |
| Web tests | node --test tests/*.test.cjs | Check completes successfully without modifying application source | 9 passed; mostly source assertions plus invoice polling logic | PASS | web-tests.txt |
| Backend lint | node node_modules/eslint/bin/eslint.js "src/**/*.ts" "test/**/*.ts" --no-error-on-unmatched-pattern | Check completes successfully without modifying application source | 55 errors: 52 formatting, 3 unsafe member access; deliberately no --fix | FAIL | backend-lint.txt |
| Backend types | node node_modules/typescript/bin/tsc --noEmit --incremental false | Check completes successfully without modifying application source | No diagnostics | PASS | backend-types.txt |
| Backend tests | node node_modules/jest/bin/jest.js --runInBand --no-cache --json --outputFile=../supplyed-web/audit-evidence/backend-tests.json | Check completes successfully without modifying application source | 347 passed; 52 skipped; 23 passed suites, 2 skipped suites. TEST_DATABASE_URL cleared | PASS / NOT TESTED | backend-tests.json |
| Backend compilation | tsc -p tsconfig.build.json --outDir ../supplyed-web/audit-evidence/backend-build --tsBuildInfoFile ../supplyed-web/audit-evidence/backend-build.tsbuildinfo | Check completes successfully without modifying application source | Compiled into isolated audit output; no database boot | PASS | backend-build.txt |
| Admin lint | node node_modules/eslint/bin/eslint.js . | Check completes successfully without modifying application source | No diagnostics | PASS | admin-lint.txt |
| Admin types | node node_modules/typescript/bin/tsc --noEmit --incremental false | Check completes successfully without modifying application source | No diagnostics | PASS | admin-types.txt |
| Admin tests | node --test tests/*.test.mjs | Check completes successfully without modifying application source | 13 passed; dropdown/role-profile normalization | PASS | admin-tests.txt |
| Web production build | node audit-evidence/build-isolated.cjs web | Check completes successfully without modifying application source | next build --webpack; 234.923 seconds; no .env copied; API points to closed loopback port | PASS | web-build-result.json |
| Admin production build | node audit-evidence/build-isolated.cjs admin | Check completes successfully without modifying application source | next build --webpack failed after 35.852 seconds: network denied while fetching Geist/Geist Mono fonts. Not evidence of a source compile defect | BLOCKED | admin-build.txt |
| Dependency audit | npm.cmd audit --json (web); pnpm.cmd audit --json (backend/admin) | Check completes successfully without modifying application source | Registry requests denied (EACCES/socket 10013). Selective official Next advisories checked separately; no full dependency clearance | BLOCKED | installed-versions.json |
| Secret scan | node audit-evidence/scan.cjs | Check completes successfully without modifying application source | Heuristic source scan: 10 candidates reviewed as false positives; no confirmed credential. No git-history/complete secret-tool scan | PASS (limited) | secret-scan-redacted.json |
| Local HTTP smoke | node audit-evidence/http-smoke.cjs | Check completes successfully without modifying application source | 30 page responses and 8 guest BFF checks; mock backend on loopback; no browser execution | PASS | http-smoke.json |
| Targeted isolated probes | node audit-evidence/verify-findings.cjs | Check completes successfully without modifying application source | 11/11 probes reproduced their stated behavior; real application methods with mocked persistence/providers | FAIL (11 defects reproduced) | verified-findings.json |
| Browser E2E | Available browser inventory / installed runner check | Check completes successfully without modifying application source | No enabled browser; no installed Playwright/E2E setup suitable for this run. No dependency installed | NOT TESTED | TEST_MATRIX.md |


## Executed targeted defect probes

All persistence/provider dependencies are mocked; real service/BFF/validator code is loaded by audit-evidence/verify-findings.cjs. Real bcrypt and JWT signing/verification are used for recovery. No defect probe is a real database, browser or provider test.

| Feature / flow | Test scenario | Expected behavior | Actual behavior | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| Session recovery | AUTH-REVOCATION | Old session rejected after reset | One pre-reset refresh token succeeded twice after the password changed; real JWT verification and bcrypt, mocked user/OTP persistence. | FAIL | A02; verified-findings.json |
| Password reset | OTP-CONCURRENCY | One code permits exactly one password change | Two concurrent calls using one reset OTP both succeeded and each wrote a different password; no database used. | FAIL | A07; verified-findings.json |
| Public recovery | RESET-ENUMERATION | Unknown and existing accounts have indistinguishable responses | Public forgot-password token discloses ADMIN for an existing fixture account and INSTRUCTOR for an absent fixture account. | FAIL | A08; verified-findings.json |
| Signup throttle | BFF-RATE-BUDGET | Different users do not exhaust a tiny shared BFF allowance | Six distinct emails sharing the BFF source IP: five accepted by guard, sixth rejected for 900 seconds; counter mocked. | FAIL | A03; verified-findings.json |
| Instant payout | PAYOUT-KEY-COLLISION | Distinct withdrawal intents have distinct retry identities | Two separate withdrawal intents at a recurring balance produced the same Stripe idempotency key. | FAIL | A10; verified-findings.json |
| Messaging | SOCKET-UNBOUNDED-MAPS | Distinct invalid IDs cannot grow unbounded state/work | Fifty bounded events with different UUIDs created fifty retained map entries and fifty service lookups; no sockets/network used. | FAIL | A12; verified-findings.json |
| Admin login | ADMIN-2FA | A valid challenge has a completion path | A valid two-factor challenge is returned as terminal login failure; only email/password credentials are accepted by the admin provider. | FAIL | A04; verified-findings.json |
| Payout BFF | PAYOUT-ORIGIN | Untrusted-origin text/plain mutation is rejected at route boundary | A sibling-origin text/plain request reached the mocked payout API and returned 201; real-browser cookie delivery remains untested. | FAIL | A11; verified-findings.json |
| Password input | PASSWORD-72-BYTES | All accepted password bytes influence authentication | Two web-valid passwords with the same first 72 bytes and different suffixes compare equal under installed bcrypt. | FAIL | A09; verified-findings.json |
| Founding interest | WAITLIST-DUPLICATE | Duplicate concurrent business requests are idempotent | Two concurrent duplicate checks both created a waitlist row; persistence mocked. Schema has no email/type unique constraint. | FAIL | A20; verified-findings.json |
| Admin users | ADMIN-USER-ROLE-CONTRACT | BFF forwards a request accepted by backend DTO | Admin BFF strips a supplied role; actual backend DTO validation rejects the forwarded body for missing role. No account created. | FAIL | A05; verified-findings.json |


## Executed local guest page/BFF checks

Only GET responses were checked. A streamed login redirect within HTTP 200 is valid Next behavior and is not an authorization bypass. No DOM interaction, hydration or authenticated screen was tested. The invalid signatory fixture only tests safe rendering; it does not verify token decisions. Cache headers on BFF responses were recorded. The mock returning 401 prevents this from proving the real Nest authorization boundary.

| Feature / flow | Test scenario | Expected behavior | Actual behavior | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| /applications | Guest GET, isolated production web build | 307 or a streamed login redirect | 307 → /login | PASS | http-smoke.json |
| /billing | Guest GET, isolated production web build | 307 or a streamed login redirect | 307 → /login | PASS | http-smoke.json |
| /bookings | Guest GET, isolated production web build | 307 or a streamed login redirect | 200 with streamed login redirect | PASS | http-smoke.json |
| /calendar | Guest GET, isolated production web build | 307 or a streamed login redirect | 307 → /login | PASS | http-smoke.json |
| /dashboard | Guest GET, isolated production web build | 307 or a streamed login redirect | 307 → /login | PASS | http-smoke.json |
| /find-jobs | Guest GET, isolated production web build | 307 or a streamed login redirect | 307 → /login | PASS | http-smoke.json |
| /find-teachers | Guest GET, isolated production web build | 307 or a streamed login redirect | 307 → /login | PASS | http-smoke.json |
| /institution-profile | Guest GET, isolated production web build | 307 or a streamed login redirect | 200 with streamed login redirect | PASS | http-smoke.json |
| /job-detail | Guest GET, isolated production web build | 307 or a streamed login redirect | 307 → /login | PASS | http-smoke.json |
| /job-invitations | Guest GET, isolated production web build | 307 or a streamed login redirect | 307 → /login?returnTo=%2Fjob-invitations | PASS | http-smoke.json |
| /job-invitations/[id] | Guest GET, isolated production web build | 307 or a streamed login redirect | 307 → /login | PASS | http-smoke.json |
| /messaging | Guest GET, isolated production web build | 307 or a streamed login redirect | 307 → /login | PASS | http-smoke.json |
| /my-profile | Guest GET, isolated production web build | 307 or a streamed login redirect | 307 → /login | PASS | http-smoke.json |
| /onboarding | Guest GET, isolated production web build | 307 or a streamed login redirect | 307 → /login | PASS | http-smoke.json |
| /payouts/refresh | Guest GET, isolated production web build | 307 or a streamed login redirect | 307 → /login | PASS | http-smoke.json |
| /payouts/return | Guest GET, isolated production web build | 307 or a streamed login redirect | 307 → /login | PASS | http-smoke.json |
| /post-job | Guest GET, isolated production web build | 307 or a streamed login redirect | 307 → /login | PASS | http-smoke.json |
| /security | Guest GET, isolated production web build | 307 or a streamed login redirect | 200 with streamed login redirect | PASS | http-smoke.json |
| /settings | Guest GET, isolated production web build | 307 or a streamed login redirect | 307 → /login | PASS | http-smoke.json |
| /teacher-profile | Guest GET, isolated production web build | 307 or a streamed login redirect | 307 → /login | PASS | http-smoke.json |
| /forgot-password | Guest GET, isolated production web build | 200 | 200 | PASS | http-smoke.json |
| /login | Guest GET, isolated production web build | 200 | 200 | PASS | http-smoke.json |
| /signup | Guest GET, isolated production web build | 200 | 200 | PASS | http-smoke.json |
| /founding-schools | Guest GET, isolated production web build | 200 | 200 | PASS | http-smoke.json |
| /founding-teachers | Guest GET, isolated production web build | 200 | 200 | PASS | http-smoke.json |
| /how-it-works | Guest GET, isolated production web build | 200 | 200 | PASS | http-smoke.json |
| / | Guest GET, isolated production web build | 200 | 200 | PASS | http-smoke.json |
| /signatory-approval/audit-fixture-invalid | Guest GET, isolated production web build | 200 | 200 | PASS | http-smoke.json |
| /terms | Guest GET, isolated production web build | 200 | 200 | PASS | http-smoke.json |
| /post-auth | Guest GET, isolated production web build | 307 or a streamed login redirect | 200 with streamed login redirect | PASS | http-smoke.json |
| /api/auth/session | Guest GET, isolated production web build | 200 | 200; private, no-store, max-age=0, must-revalidate | PASS | http-smoke.json |
| /api/auth/me | Guest GET, isolated production web build | 401 | 401; private, no-store, max-age=0, must-revalidate | PASS | http-smoke.json |
| /api/jobs/mine | Guest GET, isolated production web build | 401 | 401; private, no-store, max-age=0, must-revalidate | PASS | http-smoke.json |
| /api/onboarding/me | Guest GET, isolated production web build | 401 | 401; private, no-store, max-age=0, must-revalidate | PASS | http-smoke.json |
| /api/invoices/me | Guest GET, isolated production web build | 401 | 401; private, no-store, max-age=0, must-revalidate | PASS | http-smoke.json |
| /api/conversations | Guest GET, isolated production web build | 401 | 401; private, no-store, max-age=0, must-revalidate | PASS | http-smoke.json |
| /api/notifications | Guest GET, isolated production web build | 401 | 401; private, no-store, max-age=0, must-revalidate | PASS | http-smoke.json |
| /api/payments/payout-account | Guest GET, isolated production web build | 401 | 401; private, no-store, max-age=0, must-revalidate | PASS | http-smoke.json |


Missing general HTML headers are separately a **FAIL**, A19, even though the route/status checks above passed. All checked page response header objects record the absence. Admin header behavior was not run.

## End-to-end journey backlog and explicit coverage gaps

These 88 scenarios cover meaningful roles, forms, state transitions and failure paths discovered in source. They remain NOT TESTED at E2E level. Passing related unit/source tests below must not be substituted for this coverage. Prioritize the high-severity findings and the skipped database suite first when a safe test environment is provided.

| Feature / flow | Test scenario | Expected behavior | Actual behavior | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| Public pages / accessibility | Landing, how-it-works, terms and founding pages on phone/tablet/desktop | Correct readable layout and navigation; accessible interaction; graceful loading/error/empty state. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Public pages / accessibility | Keyboard-only navigation, focus restoration, dialog trapping and screen-reader announcements | Correct readable layout and navigation; accessible interaction; graceful loading/error/empty state. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Public pages / accessibility | Images, maps, rich text, reduced motion and browser compatibility | Correct readable layout and navigation; accessible interaction; graceful loading/error/empty state. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Public pages / accessibility | Catalogue unavailable, empty results and page hydration after SSR | Correct readable layout and navigation; accessible interaction; graceful loading/error/empty state. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Signup / email OTP | Teacher and school signup with fresh normalized emails | Only verified, intended accounts progress; invalid attempts are bounded and recoverable. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Signup / email OTP | Existing verified versus unverified email and permitted role handling | Only verified, intended accounts progress; invalid attempts are bounded and recoverable. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Signup / email OTP | Invalid email/weak password/long Unicode password and direct API validation | Only verified, intended accounts progress; invalid attempts are bounded and recoverable. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Signup / email OTP | Wrong, expired, exhausted and replayed email OTP | Only verified, intended accounts progress; invalid attempts are bounded and recoverable. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Signup / email OTP | Resend cooldown, delayed email and network interruption | Only verified, intended accounts progress; invalid attempts are bounded and recoverable. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Login / session | Valid and invalid email/password including unverified account | Fail closed with current authorization, safe redirects and no stale private data. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Login / session | Browser logout, back button and private-cache isolation | Fail closed with current authorization, safe redirects and no stale private data. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Login / session | Access expiry with one tab, multiple tabs and concurrent refresh | Fail closed with current authorization, safe redirects and no stale private data. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Login / session | Deleted/demoted user and suspended profile with old session | Fail closed with current authorization, safe redirects and no stale private data. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Login / session | Teacher attempts institution route; institution attempts teacher route; either attempts admin | Fail closed with current authorization, safe redirects and no stale private data. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Google / 2FA / recovery | Google audience/email mismatch and existing-email linking rejection | Verified identity plus required factors; single-use challenges and safe recovery. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Google / 2FA / recovery | Google login with and without enabled 2FA | Verified identity plus required factors; single-use challenges and safe recovery. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Google / 2FA / recovery | TOTP setup, invalid code, replay, disable and recovery-code regeneration | Verified identity plus required factors; single-use challenges and safe recovery. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Google / 2FA / recovery | Recovery code is accepted once under simultaneous requests | Verified identity plus required factors; single-use challenges and safe recovery. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Google / 2FA / recovery | Password recovery end-to-end with delivered OTP and session revocation | Verified identity plus required factors; single-use challenges and safe recovery. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Onboarding / profile | Teacher details, qualifications, documents and submission lifecycle | Persist consistent profile state; enforce current eligibility in backend; retain recoverable form data. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Onboarding / profile | Single school versus MAT school/trust selection and signatory approval | Persist consistent profile state; enforce current eligibility in backend; retain recoverable form data. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Onboarding / profile | Phone OTP send/verify/change and international number validation | Persist consistent profile state; enforce current eligibility in backend; retain recoverable form data. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Onboarding / profile | Profile image upload, reload and URL refresh after signed URL expiry | Persist consistent profile state; enforce current eligibility in backend; retain recoverable form data. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Onboarding / profile | Required document deletion/replacement after approval then direct API mutation | Persist consistent profile state; enforce current eligibility in backend; retain recoverable form data. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Onboarding / profile | Expired/rejected/pending evidence and suspension during an active session | Persist consistent profile state; enforce current eligibility in backend; retain recoverable form data. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Onboarding / profile | Refresh/back navigation and duplicate onboarding submit | Persist consistent profile state; enforce current eligibility in backend; retain recoverable form data. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Signatory approval | Valid, expired, tampered, already-decided and resent approval token | Only authorized live token/admin can decide; one consistent final decision. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Signatory approval | Approve versus decline and concurrent conflicting decisions | Only authorized live token/admin can decide; one consistent final decision. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Signatory approval | Admin override and trust identity changes | Only authorized live token/admin can decide; one consistent final decision. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Documents / uploads | Owned create/upload/complete/download/delete with normal file | Bound bytes/resources; deny nonowners; preserve immutable evidence and review consistency. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Documents / uploads | Cross-user document ID and swapped storage key | Bound bytes/resources; deny nonowners; preserve immutable evidence and review consistency. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Documents / uploads | Mime mismatch, zero-byte, oversize, multiple-file and truncated multipart | Bound bytes/resources; deny nonowners; preserve immutable evidence and review consistency. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Documents / uploads | Abandoned upload and complete request repeated after successful upload | Bound bytes/resources; deny nonowners; preserve immutable evidence and review consistency. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Documents / uploads | Replace file while admin approves old file; duplicate reviewers | Bound bytes/resources; deny nonowners; preserve immutable evidence and review consistency. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Documents / uploads | PDF/image/Word preview content escaping and download headers | Bound bytes/resources; deny nonowners; preserve immutable evidence and review consistency. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Jobs / search | Create draft, edit, validate and publish with correct work-unit/pay terms | Consistent public visibility, authorized ownership and immutable agreed terms. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Jobs / search | Invalid date ranges, past start, missing subject/required fields | Consistent public visibility, authorized ownership and immutable agreed terms. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Jobs / search | Browse/search/filter/sort/paginate across empty and large datasets | Consistent public visibility, authorized ownership and immutable agreed terms. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Jobs / search | Reserved/filled/expired/suspended/unapproved-school visibility | Consistent public visibility, authorized ownership and immutable agreed terms. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Jobs / search | Edit material terms after applications/invitations/bookings exist | Consistent public visibility, authorized ownership and immutable agreed terms. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Jobs / search | Close/reopen/delete and concurrent apply/close | Consistent public visibility, authorized ownership and immutable agreed terms. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Applications / matching | Apply once, duplicate click, duplicate concurrent request and withdraw | One application per teacher/job; current eligibility, stable ranking and bounded query work. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Applications / matching | Cross-user application detail and school applicant list | One application per teacher/job; current eligibility, stable ranking and bounded query work. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Applications / matching | Viewed/shortlisted/rejected/accepted legal and illegal transitions | One application per teacher/job; current eligibility, stable ranking and bounded query work. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Applications / matching | Rank applicants with distance/availability/subject edge cases and missing coordinates | One application per teacher/job; current eligibility, stable ranking and bounded query work. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Applications / matching | Large applicant pages and candidate cap fairness | One application per teacher/job; current eligibility, stable ranking and bounded query work. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Direct hire / bookings | Create, accept, decline, cancel and expire a direct invitation | Exactly one valid occupied job position; consistent agreed terms and overlap policy. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Direct hire / bookings | Concurrent accepts for one job and overlapping teacher bookings | Exactly one valid occupied job position; consistent agreed terms and overlap policy. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Direct hire / bookings | Application acceptance versus direct invitation competing for same position | Exactly one valid occupied job position; consistent agreed terms and overlap policy. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Direct hire / bookings | Suspend/delete/close during invitation acceptance | Exactly one valid occupied job position; consistent agreed terms and overlap policy. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Direct hire / bookings | Booking details, dates/partial days, completion and cancellation permissions | Exactly one valid occupied job position; consistent agreed terms and overlap policy. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Reviews | Eligible completed booking, reciprocal reviews and duplicate submission | Only eligible participants review once per side; aggregates remain correct. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Reviews | Other user/booking spoofing, invalid stars, edit/delete ownership | Only eligible participants review once per side; aggregates remain correct. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Reviews | Concurrent review writes preserve rating aggregate | Only eligible participants review once per side; aggregates remain correct. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Messaging | General, application and booking topic creation and history cursor pagination | Participant isolation and reliable ordered messaging with bounded resources. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Messaging | Nonparticipant attempts message/read/download/socket ticket | Participant isolation and reliable ordered messaging with bounded resources. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Messaging | Send/retry/double-click, reconnect and unread count synchronization | Participant isolation and reliable ordered messaging with bounded resources. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Messaging | Typing/read throttle across valid and random conversation IDs | Participant isolation and reliable ordered messaging with bounded resources. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Messaging | Attachments, content types, size limits, abandoned upload cleanup | Participant isolation and reliable ordered messaging with bounded resources. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Messaging | Role/account changes and backend outage during live connection | Participant isolation and reliable ordered messaging with bounded resources. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Messaging | Conversation migration retains history and prevents duplicate canonical threads | Participant isolation and reliable ordered messaging with bounded resources. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Notifications | In-app unread count, mark-one/all read, preferences and pagination | No cross-user leakage; durable idempotent delivery and explicit retry exhaustion. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Notifications | Job-match creation/deduplication and worker crash/reclaim | No cross-user leakage; durable idempotent delivery and explicit retry exhaustion. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Notifications | Email retry/daily caps/stale leases and message reminder suppression | No cross-user leakage; durable idempotent delivery and explicit retry exhaustion. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Billing / payments | Connect account onboarding, incomplete requirements and return refresh | Authorized immutable money intent, integer-safe amounts, no duplicate business operation and monotonic reconciliation. | NOT TESTED — No real Stripe sandbox, disposable DB or browser; only isolated payout method/route probes were run. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Billing / payments | Invoice creation from agreed terms, rounding and fee/currency boundaries | Authorized immutable money intent, integer-safe amounts, no duplicate business operation and monotonic reconciliation. | NOT TESTED — No real Stripe sandbox, disposable DB or browser; only isolated payout method/route probes were run. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Billing / payments | Payment success/failure/required action and duplicate user requests | Authorized immutable money intent, integer-safe amounts, no duplicate business operation and monotonic reconciliation. | NOT TESTED — No real Stripe sandbox, disposable DB or browser; only isolated payout method/route probes were run. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Billing / payments | Signed/invalid/duplicate/out-of-order webhook and provider retry | Authorized immutable money intent, integer-safe amounts, no duplicate business operation and monotonic reconciliation. | NOT TESTED — No real Stripe sandbox, disposable DB or browser; only isolated payout method/route probes were run. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Billing / payments | Refund/void/payment state convergence and invoice ownership | Authorized immutable money intent, integer-safe amounts, no duplicate business operation and monotonic reconciliation. | NOT TESTED — No real Stripe sandbox, disposable DB or browser; only isolated payout method/route probes were run. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Billing / payments | Instant payout recurring balance, changed destination, retry and timeout | Authorized immutable money intent, integer-safe amounts, no duplicate business operation and monotonic reconciliation. | NOT TESTED — No real Stripe sandbox, disposable DB or browser; only isolated payout method/route probes were run. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Billing / payments | Real browser cross-site/sibling-origin cookie delivery to payout route | Authorized immutable money intent, integer-safe amounts, no duplicate business operation and monotonic reconciliation. | NOT TESTED — No real Stripe sandbox, disposable DB or browser; only isolated payout method/route probes were run. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Settings / calendar | Profile/security updates and cross-tab cache invalidation | Accurate persisted state and clear failure feedback; calendar source defect A17. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Settings / calendar | Calendar month boundaries, real booked days, availability save/reload | Accurate persisted state and clear failure feedback; calendar source defect A17. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Settings / calendar | All preference toggles persist and affect relevant matching behavior | Accurate persisted state and clear failure feedback; calendar source defect A17. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Administration | Admin password/2FA login, unauthorized non-admin denial and logout | Only current admins perform validated operations; clear recoverable errors, consistent auth refresh. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Administration | User create/edit/delete, generic USER versus role assignment and self-demotion constraints | Only current admins perform validated operations; clear recoverable errors, consistent auth refresh. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Administration | Teacher/school approve/reject/suspend and current workspace behavior | Only current admins perform validated operations; clear recoverable errors, consistent auth refresh. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Administration | Document types/requirements/catalogue/dropdown CRUD and referenced-item deletion | Only current admins perform validated operations; clear recoverable errors, consistent auth refresh. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Administration | Document review/preview/download and simultaneous file replacement | Only current admins perform validated operations; clear recoverable errors, consistent auth refresh. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Administration | Waitlist status/filter/export and CSV content edge cases | Only current admins perform validated operations; clear recoverable errors, consistent auth refresh. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Administration | Long-idle session mutation on every BFF route, including omitted matchers | Only current admins perform validated operations; clear recoverable errors, consistent auth refresh. | NOT TESTED — No browser plus disposable backend/database/provider fixture; source review is not E2E execution. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Resilience / data / performance | Disposable-database migrations and populated-data integrity | Bounded work, consistent data and recoverable failure; no resource leaks or uncontrolled retries. | NOT TESTED — No disposable DB/browser/load fixture; source analysis identifies risks but supplies no measured runtime pass. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Resilience / data / performance | Real DB concurrent reset/booking/review/waitlist transactions | Bounded work, consistent data and recoverable failure; no resource leaks or uncontrolled retries. | NOT TESTED — No disposable DB/browser/load fixture; source analysis identifies risks but supplies no measured runtime pass. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Resilience / data / performance | Provider/network timeouts, malformed upstream responses and retry budgets | Bounded work, consistent data and recoverable failure; no resource leaks or uncontrolled retries. | NOT TESTED — No disposable DB/browser/load fixture; source analysis identifies risks but supplies no measured runtime pass. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Resilience / data / performance | Large datasets: applicant ranking, job closure, exports and notification backlog | Bounded work, consistent data and recoverable failure; no resource leaks or uncontrolled retries. | NOT TESTED — No disposable DB/browser/load fixture; source analysis identifies risks but supplies no measured runtime pass. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Resilience / data / performance | Browser memory after repeated navigation, subscriptions and socket reconnect | Bounded work, consistent data and recoverable failure; no resource leaks or uncontrolled retries. | NOT TESTED — No disposable DB/browser/load fixture; source analysis identifies risks but supplies no measured runtime pass. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Resilience / data / performance | Lighthouse/Core Web Vitals, asset waterfalls, bundle loading and image expiry | Bounded work, consistent data and recoverable failure; no resource leaks or uncontrolled retries. | NOT TESTED — No disposable DB/browser/load fixture; source analysis identifies risks but supplies no measured runtime pass. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |
| Resilience / data / performance | Bounded DOCX expanded-content complexity in isolated worker | Bounded work, consistent data and recoverable failure; no resource leaks or uncontrolled retries. | NOT TESTED — No disposable DB/browser/load fixture; source analysis identifies risks but supplies no measured runtime pass. | NOT TESTED | Related route/source inventory; AUDIT_REPORT.md coverage limits |


## Existing backend suite accounting

Jest reports 347 passed tests and 52 pending/skipped tests. A mixed suite can have passing non-DB assertions and skipped DB cases; it is shown as PARTIAL. Suite names are evidence of what ran, not a claim of branch coverage. No coverage percentage was collected.

| Suite | Passed assertions | Skipped assertions | Result | Evidence |
| --- | --- | --- | --- | --- |
| /src/school-chat-direct-hire.integration.spec.ts | 0 | 47 | NOT TESTED | backend-tests.json |
| /src/modules/teaching-catalogue/teaching-catalogue.spec.ts | 66 | 0 | PASS | backend-tests.json |
| /src/job-audit.spec.ts | 29 | 0 | PASS | backend-tests.json |
| /src/modules/dropdowns/dropdowns.spec.ts | 13 | 0 | PASS | backend-tests.json |
| /src/modules/jobs/job-listing-window.spec.ts | 38 | 0 | PASS | backend-tests.json |
| /src/modules/contact/contact.waitlist.spec.ts | 18 | 0 | PASS | backend-tests.json |
| /src/modules/jobs/job-work-units.spec.ts | 33 | 0 | PASS | backend-tests.json |
| /src/modules/applications/application-status.spec.ts | 24 | 0 | PASS | backend-tests.json |
| /src/security.integration.spec.ts | 1 | 4 | PASS / NOT TESTED | backend-tests.json |
| /src/modules/instructors/instructor-bookings.spec.ts | 7 | 0 | PASS | backend-tests.json |
| /src/modules/matching/matching.service.spec.ts | 4 | 0 | PASS | backend-tests.json |
| /src/modules/conversations/conversation-topics.spec.ts | 8 | 0 | PASS | backend-tests.json |
| /src/modules/bookings/invitation-availability.spec.ts | 12 | 0 | PASS | backend-tests.json |
| /src/modules/conversations/conversation-migration.integration.spec.ts | 0 | 1 | NOT TESTED | backend-tests.json |
| /src/modules/bookings/job-invitations-list.spec.ts | 33 | 0 | PASS | backend-tests.json |
| /src/modules/users/workspace-status.service.spec.ts | 5 | 0 | PASS | backend-tests.json |
| /src/modules/jobs/job-policy.spec.ts | 27 | 0 | PASS | backend-tests.json |
| /src/modules/instructors/teacher-dashboard.service.spec.ts | 1 | 0 | PASS | backend-tests.json |
| /src/modules/jobs/job-dates.spec.ts | 13 | 0 | PASS | backend-tests.json |
| /src/modules/auth/auth-config.spec.ts | 5 | 0 | PASS | backend-tests.json |
| /src/modules/users/profile-image-display.service.spec.ts | 2 | 0 | PASS | backend-tests.json |
| /src/modules/payments/invoice-amounts.spec.ts | 4 | 0 | PASS | backend-tests.json |
| /src/modules/applications/application-response.spec.ts | 1 | 0 | PASS | backend-tests.json |
| /src/modules/jobs/job-response.spec.ts | 2 | 0 | PASS | backend-tests.json |
| /src/app.controller.spec.ts | 1 | 0 | PASS | backend-tests.json |


Web: nine node:test cases cover accessibility/cache source contracts and invoice polling behavior; these are not rendered-browser accessibility tests. Admin: thirteen node:test cases cover dropdown and role-profile normalization. Full names and individual outcomes are retained in web-tests.txt and admin-tests.txt.

## Complete discovered page route inventory

This inventory contains 30 web pages and 21 admin pages. Protected page guest responses passing does not prove the corresponding authenticated journey. All authenticated page interaction remains NOT TESTED.

| App | Route | Source | Guest response execution | Authenticated/user interaction |
| --- | --- | --- | --- | --- |
| web | /applications | app/(app)/applications/page.tsx | PASS — 307 | NOT TESTED |
| web | /billing | app/(app)/billing/page.tsx | PASS — 307 | NOT TESTED |
| web | /bookings | app/(app)/bookings/page.tsx | PASS — 200 streamed redirect | NOT TESTED |
| web | /calendar | app/(app)/calendar/page.tsx | PASS — 307 | NOT TESTED |
| web | /dashboard | app/(app)/dashboard/page.tsx | PASS — 307 | NOT TESTED |
| web | /find-jobs | app/(app)/find-jobs/page.tsx | PASS — 307 | NOT TESTED |
| web | /find-teachers | app/(app)/find-teachers/page.tsx | PASS — 307 | NOT TESTED |
| web | /institution-profile | app/(app)/institution-profile/page.tsx | PASS — 200 streamed redirect | NOT TESTED |
| web | /job-detail | app/(app)/job-detail/page.tsx | PASS — 307 | NOT TESTED |
| web | /job-invitations | app/(app)/job-invitations/page.tsx | PASS — 307 | NOT TESTED |
| web | /job-invitations/[id] | app/(app)/job-invitations/[id]/page.tsx | PASS — 307 | NOT TESTED |
| web | /messaging | app/(app)/messaging/page.tsx | PASS — 307 | NOT TESTED |
| web | /my-profile | app/(app)/my-profile/page.tsx | PASS — 307 | NOT TESTED |
| web | /onboarding | app/(app)/onboarding/page.tsx | PASS — 307 | NOT TESTED |
| web | /payouts/refresh | app/(app)/payouts/refresh/page.tsx | PASS — 307 | NOT TESTED |
| web | /payouts/return | app/(app)/payouts/return/page.tsx | PASS — 307 | NOT TESTED |
| web | /post-job | app/(app)/post-job/page.tsx | PASS — 307 | NOT TESTED |
| web | /security | app/(app)/security/page.tsx | PASS — 200 streamed redirect | NOT TESTED |
| web | /settings | app/(app)/settings/page.tsx | PASS — 307 | NOT TESTED |
| web | /teacher-profile | app/(app)/teacher-profile/page.tsx | PASS — 307 | NOT TESTED |
| web | /forgot-password | app/(auth)/forgot-password/page.tsx | PASS — 200 | NOT TESTED |
| web | /login | app/(auth)/login/page.tsx | PASS — 200 | NOT TESTED |
| web | /signup | app/(auth)/signup/page.tsx | PASS — 200 | NOT TESTED |
| web | /founding-schools | app/(public)/founding-schools/page.tsx | PASS — 200 | NOT TESTED |
| web | /founding-teachers | app/(public)/founding-teachers/page.tsx | PASS — 200 | NOT TESTED |
| web | /how-it-works | app/(public)/how-it-works/page.tsx | PASS — 200 | NOT TESTED |
| web | / | app/(public)/page.tsx | PASS — 200 | NOT TESTED |
| web | /signatory-approval/[token] | app/(public)/signatory-approval/[token]/page.tsx | PASS — 200 | NOT TESTED |
| web | /terms | app/(public)/terms/page.tsx | PASS — 200 | NOT TESTED |
| web | /post-auth | app/post-auth/page.tsx | PASS — 200 streamed redirect | NOT TESTED |
| admin | /dashboard/billing-history | app/dashboard/billing-history/page.tsx | NOT TESTED — admin build/browser unavailable | NOT TESTED |
| admin | /dashboard/document-queue | app/dashboard/document-queue/page.tsx | NOT TESTED — admin build/browser unavailable | NOT TESTED |
| admin | /dashboard/document-types/new | app/dashboard/document-types/new/page.tsx | NOT TESTED — admin build/browser unavailable | NOT TESTED |
| admin | /dashboard/document-types | app/dashboard/document-types/page.tsx | NOT TESTED — admin build/browser unavailable | NOT TESTED |
| admin | /dashboard/document-types/[id]/edit | app/dashboard/document-types/[id]/edit/page.tsx | NOT TESTED — admin build/browser unavailable | NOT TESTED |
| admin | /dashboard/dropdowns | app/dashboard/dropdowns/page.tsx | NOT TESTED — admin build/browser unavailable | NOT TESTED |
| admin | /dashboard/dropdowns/[name] | app/dashboard/dropdowns/[name]/page.tsx | NOT TESTED — admin build/browser unavailable | NOT TESTED |
| admin | /dashboard/jobs/new | app/dashboard/jobs/new/page.tsx | NOT TESTED — admin build/browser unavailable | NOT TESTED |
| admin | /dashboard/jobs | app/dashboard/jobs/page.tsx | NOT TESTED — admin build/browser unavailable | NOT TESTED |
| admin | /dashboard/jobs/[id]/conversations | app/dashboard/jobs/[id]/conversations/page.tsx | NOT TESTED — admin build/browser unavailable | NOT TESTED |
| admin | /dashboard/jobs/[id] | app/dashboard/jobs/[id]/page.tsx | NOT TESTED — admin build/browser unavailable | NOT TESTED |
| admin | /dashboard/jobs/[id]/payments | app/dashboard/jobs/[id]/payments/page.tsx | NOT TESTED — admin build/browser unavailable | NOT TESTED |
| admin | /dashboard | app/dashboard/page.tsx | NOT TESTED — admin build/browser unavailable | NOT TESTED |
| admin | /dashboard/settings | app/dashboard/settings/page.tsx | NOT TESTED — admin build/browser unavailable | NOT TESTED |
| admin | /dashboard/users | app/dashboard/users/page.tsx | NOT TESTED — admin build/browser unavailable | NOT TESTED |
| admin | /dashboard/users/[id]/documents/[documentId] | app/dashboard/users/[id]/documents/[documentId]/page.tsx | NOT TESTED — admin build/browser unavailable | NOT TESTED |
| admin | /dashboard/users/[id] | app/dashboard/users/[id]/page.tsx | NOT TESTED — admin build/browser unavailable | NOT TESTED |
| admin | /dashboard/waiting-list | app/dashboard/waiting-list/page.tsx | NOT TESTED — admin build/browser unavailable | NOT TESTED |
| admin | /login | app/login/page.tsx | NOT TESTED — admin build/browser unavailable | NOT TESTED |
| admin | /page.tsx | app/page.tsx | NOT TESTED — admin build/browser unavailable | NOT TESTED |
| admin | /terms-and-conditions | app/terms-and-conditions/page.tsx | NOT TESTED — admin build/browser unavailable | NOT TESTED |


## Complete discovered BFF route inventory

76 route files. The status applies to GET only where listed; mutation methods were not sent through a live session. A05/A11 additionally have isolated handler probes, documented above. NextAuth catch-all handlers may serve multiple internal auth endpoints.

| App | Route | Methods | Source | Runtime result |
| --- | --- | --- | --- | --- |
| web | /api/applications/active-jobs/count | GET | app/api/applications/active-jobs/count/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/applications/job/[jobId] | GET | app/api/applications/job/[jobId]/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/applications/me | GET | app/api/applications/me/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/applications/[id]/history | GET | app/api/applications/[id]/history/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/applications/[id] | GET | app/api/applications/[id]/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/auth/me | GET | app/api/auth/me/route.ts | PASS — guest GET only 401 |
| web | /api/auth/[...nextauth] | GET, POST | app/api/auth/[...nextauth]/route.ts | PASS — guest /api/auth/session GET only |
| web | /api/bookings/me | GET | app/api/bookings/me/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/bookings/[id] | GET | app/api/bookings/[id]/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/conversations | GET | app/api/conversations/route.ts | PASS — guest GET only 401 |
| web | /api/conversations/socket-ticket | POST | app/api/conversations/socket-ticket/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/conversations/unread-count | GET | app/api/conversations/unread-count/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/conversations/[id]/attachments | POST | app/api/conversations/[id]/attachments/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/conversations/[id]/attachments/[attachmentId]/preview | GET | app/api/conversations/[id]/attachments/[attachmentId]/preview/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/conversations/[id]/messages | GET | app/api/conversations/[id]/messages/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/conversations/[id] | GET | app/api/conversations/[id]/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/conversations/[id]/threads | GET | app/api/conversations/[id]/threads/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/dropdowns | GET | app/api/dropdowns/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/dropdowns/[name] | GET | app/api/dropdowns/[name]/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/health | GET | app/api/health/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/institutions/profile/[id] | GET | app/api/institutions/profile/[id]/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/instructors/directory | GET | app/api/instructors/directory/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/instructors/profile/[id] | GET | app/api/instructors/profile/[id]/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/invoices/me | GET | app/api/invoices/me/route.ts | PASS — guest GET only 401 |
| web | /api/invoices | GET | app/api/invoices/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/invoices/[id] | GET | app/api/invoices/[id]/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/job-invitations/me | GET | app/api/job-invitations/me/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/job-invitations/[id] | GET | app/api/job-invitations/[id]/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/jobs/mine | GET | app/api/jobs/mine/route.ts | PASS — guest GET only 401 |
| web | /api/jobs | GET | app/api/jobs/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/jobs/[id] | GET | app/api/jobs/[id]/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/matching/jobs/recommended | GET | app/api/matching/jobs/recommended/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/matching/jobs/[jobId]/applications | GET | app/api/matching/jobs/[jobId]/applications/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/matching/jobs/[jobId]/instructors | GET | app/api/matching/jobs/[jobId]/instructors/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/matching/jobs/[jobId]/score | GET | app/api/matching/jobs/[jobId]/score/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/my-profile/applications | GET | app/api/my-profile/applications/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/my-profile/reviews | GET | app/api/my-profile/reviews/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/notifications/preferences | GET | app/api/notifications/preferences/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/notifications | GET | app/api/notifications/route.ts | PASS — guest GET only 401 |
| web | /api/notifications/unread-count | GET | app/api/notifications/unread-count/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/onboarding/document-requirements | GET | app/api/onboarding/document-requirements/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/onboarding/documents | POST | app/api/onboarding/documents/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/onboarding/documents/[documentId]/preview | GET | app/api/onboarding/documents/[documentId]/preview/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/onboarding/me | GET | app/api/onboarding/me/route.ts | PASS — guest GET only 401 |
| web | /api/payments/payout-account/balance | GET | app/api/payments/payout-account/balance/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/payments/payout-account/instant-payout | POST | app/api/payments/payout-account/instant-payout/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/payments/payout-account | GET | app/api/payments/payout-account/route.ts | PASS — guest GET only 401 |
| web | /api/payments/payout-accounts/instructor/[instructorId] | GET | app/api/payments/payout-accounts/instructor/[instructorId]/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/reviews/institution/[institutionId] | GET | app/api/reviews/institution/[institutionId]/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/reviews/instructor/[instructorId] | GET | app/api/reviews/instructor/[instructorId]/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/settings/profile | GET | app/api/settings/profile/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/signatory-approvals/[token] | GET, POST | app/api/signatory-approvals/[token]/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/teachers | GET | app/api/teachers/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/teachers/[id] | GET | app/api/teachers/[id]/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /api/teaching-catalogue | GET | app/api/teaching-catalogue/route.ts | NOT TESTED — no authenticated integration runtime |
| web | /theme-bootstrap.js | GET | app/theme-bootstrap.js/route.ts | NOT TESTED — no authenticated integration runtime |
| admin | /api/auth/[...nextauth] | GET, POST | app/api/auth/[...nextauth]/route.ts | NOT TESTED — no authenticated integration runtime |
| admin | /api/contact/founding-interest/export | GET | app/api/contact/founding-interest/export/route.ts | NOT TESTED — no authenticated integration runtime |
| admin | /api/contact/founding-interest/[id]/status | PATCH | app/api/contact/founding-interest/[id]/status/route.ts | NOT TESTED — no authenticated integration runtime |
| admin | /api/conversations/[id]/attachments/[attachmentId]/download | GET | app/api/conversations/[id]/attachments/[attachmentId]/download/route.ts | NOT TESTED — no authenticated integration runtime |
| admin | /api/conversations/[id]/messages | GET | app/api/conversations/[id]/messages/route.ts | NOT TESTED — no authenticated integration runtime |
| admin | /api/document-requirements | POST | app/api/document-requirements/route.ts | NOT TESTED — no authenticated integration runtime |
| admin | /api/document-requirements/[id] | PATCH, DELETE | app/api/document-requirements/[id]/route.ts | NOT TESTED — no authenticated integration runtime |
| admin | /api/document-types | POST | app/api/document-types/route.ts | NOT TESTED — no authenticated integration runtime |
| admin | /api/document-types/[id] | PATCH, DELETE | app/api/document-types/[id]/route.ts | NOT TESTED — no authenticated integration runtime |
| admin | /api/documents/[id]/content | GET | app/api/documents/[id]/content/route.ts | NOT TESTED — no authenticated integration runtime |
| admin | /api/documents/[id]/download | GET | app/api/documents/[id]/download/route.ts | NOT TESTED — no authenticated integration runtime |
| admin | /api/documents/[id]/review | POST | app/api/documents/[id]/review/route.ts | NOT TESTED — no authenticated integration runtime |
| admin | /api/dropdowns/[name] | GET, PATCH, DELETE | app/api/dropdowns/[name]/route.ts | NOT TESTED — no authenticated integration runtime |
| admin | /api/institutions/[id]/status | PATCH | app/api/institutions/[id]/status/route.ts | NOT TESTED — no authenticated integration runtime |
| admin | /api/instructors/[id]/status | PATCH | app/api/instructors/[id]/status/route.ts | NOT TESTED — no authenticated integration runtime |
| admin | /api/jobs | POST | app/api/jobs/route.ts | NOT TESTED — no authenticated integration runtime |
| admin | /api/recruiters/[id]/status | PATCH | app/api/recruiters/[id]/status/route.ts | NOT TESTED — no authenticated integration runtime |
| admin | /api/users | POST | app/api/users/route.ts | NOT TESTED — no authenticated integration runtime |
| admin | /api/users/[id] | DELETE, PATCH | app/api/users/[id]/route.ts | NOT TESTED — no authenticated integration runtime |
| admin | /api/users/[id]/two-factor/disable | POST | app/api/users/[id]/two-factor/disable/route.ts | NOT TESTED — no authenticated integration runtime |


## Complete discovered backend HTTP method inventory

176 method declarations under the configured /api prefix. All were inventoried and their guard/controller patterns scanned; none was exercised over HTTP against a real backend/database in this audit. Related unit and isolated service probes do not change these rows to PASS. Use the source line to locate DTO/role/ownership handling. Public exceptions, OTP-purpose paths, webhook signature paths and admin-role paths were traced selectively as described in the report.

| Method | Endpoint | Source line | Expected boundary | Execution |
| --- | --- | --- | --- | --- |
| GET | /api/ | src/app.controller.ts:8 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/applications | src/modules/applications/applications.controller.ts:23 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/applications/me | src/modules/applications/applications.controller.ts:33 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/applications/institution/me | src/modules/applications/applications.controller.ts:43 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/applications/job/:jobId | src/modules/applications/applications.controller.ts:50 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/applications/instructor/:instructorId | src/modules/applications/applications.controller.ts:64 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/applications/:id | src/modules/applications/applications.controller.ts:77 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/applications/:id/history | src/modules/applications/applications.controller.ts:86 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| PATCH | /api/applications/:id/status | src/modules/applications/applications.controller.ts:97 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/auth/login | src/modules/auth/auth.controller.ts:25 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/auth/oauth/google | src/modules/auth/auth.controller.ts:34 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/auth/register | src/modules/auth/auth.controller.ts:43 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/auth/refresh | src/modules/auth/auth.controller.ts:51 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/auth/email/otp/resend | src/modules/auth/auth.controller.ts:60 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/auth/email/otp/verify | src/modules/auth/auth.controller.ts:69 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/auth/password/forgot | src/modules/auth/auth.controller.ts:79 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/auth/password/reset | src/modules/auth/auth.controller.ts:88 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/auth/2fa/verify | src/modules/auth/auth.controller.ts:98 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/auth/me | src/modules/auth/auth.controller.ts:112 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/bookings/me | src/modules/bookings/bookings.controller.ts:25 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/bookings | src/modules/bookings/bookings.controller.ts:33 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/bookings/:id | src/modules/bookings/bookings.controller.ts:41 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| PATCH | /api/bookings/:id/complete | src/modules/bookings/bookings.controller.ts:48 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| PATCH | /api/bookings/:id/no-show | src/modules/bookings/bookings.controller.ts:56 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| PATCH | /api/bookings/:id/cancel | src/modules/bookings/bookings.controller.ts:64 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/bookings/direct-hire | src/modules/bookings/direct-hire.controller.ts:19 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/job-invitations | src/modules/bookings/job-invitations.controller.ts:38 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/job-invitations/me | src/modules/bookings/job-invitations.controller.ts:52 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/job-invitations/me/pending | src/modules/bookings/job-invitations.controller.ts:72 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/job-invitations/me/summaries | src/modules/bookings/job-invitations.controller.ts:84 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/job-invitations/me/history | src/modules/bookings/job-invitations.controller.ts:93 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/job-invitations/:id | src/modules/bookings/job-invitations.controller.ts:105 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/job-invitations/:id/accept | src/modules/bookings/job-invitations.controller.ts:114 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/job-invitations/:id/decline | src/modules/bookings/job-invitations.controller.ts:124 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/job-invitations/:id/cancel | src/modules/bookings/job-invitations.controller.ts:134 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/contact/register-interest | src/modules/contact/contact.controller.ts:21 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/contact/founding-interest | src/modules/contact/contact.controller.ts:29 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| PATCH | /api/contact/founding-interest/:id/details | src/modules/contact/contact.controller.ts:37 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/contact/founding-interest/all | src/modules/contact/contact.controller.ts:44 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/contact/founding-interest | src/modules/contact/contact.controller.ts:51 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| PATCH | /api/contact/founding-interest/:id/status | src/modules/contact/contact.controller.ts:58 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/conversations | src/modules/conversations/conversations.controller.ts:22 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/conversations | src/modules/conversations/conversations.controller.ts:31 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/conversations/unread-count | src/modules/conversations/conversations.controller.ts:39 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/conversations/socket-ticket | src/modules/conversations/conversations.controller.ts:48 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/conversations/application/:applicationId | src/modules/conversations/conversations.controller.ts:57 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/conversations/booking/:bookingId | src/modules/conversations/conversations.controller.ts:64 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/conversations/job/:jobId | src/modules/conversations/conversations.controller.ts:71 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/conversations/:id | src/modules/conversations/conversations.controller.ts:83 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/conversations/:id/threads | src/modules/conversations/conversations.controller.ts:90 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/conversations/:id/messages | src/modules/conversations/conversations.controller.ts:99 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/conversations/:id/messages | src/modules/conversations/conversations.controller.ts:106 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/conversations/:id/read | src/modules/conversations/conversations.controller.ts:114 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/conversations/:id/attachments | src/modules/conversations/conversations.controller.ts:122 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/conversations/:id/attachments/:attachmentId/download-url | src/modules/conversations/conversations.controller.ts:130 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/document-requirements | src/modules/document-requirements/document-requirements.controller.ts:21 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/document-requirements | src/modules/document-requirements/document-requirements.controller.ts:28 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/document-requirements/profile | src/modules/document-requirements/document-requirements.controller.ts:35 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/document-requirements/:id | src/modules/document-requirements/document-requirements.controller.ts:42 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| PATCH | /api/document-requirements/:id | src/modules/document-requirements/document-requirements.controller.ts:49 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| DELETE | /api/document-requirements/:id | src/modules/document-requirements/document-requirements.controller.ts:56 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/document-reviews | src/modules/document-reviews/document-reviews.controller.ts:16 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/document-reviews/:id | src/modules/document-reviews/document-reviews.controller.ts:23 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/document-types | src/modules/document-types/document-types.controller.ts:15 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/document-types | src/modules/document-types/document-types.controller.ts:22 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/document-types/:id | src/modules/document-types/document-types.controller.ts:29 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| PATCH | /api/document-types/:id | src/modules/document-types/document-types.controller.ts:36 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| DELETE | /api/document-types/:id | src/modules/document-types/document-types.controller.ts:43 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/documents | src/modules/documents/documents.controller.ts:29 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/documents | src/modules/documents/documents.controller.ts:36 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/documents/admin | src/modules/documents/documents.controller.ts:52 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/documents/admin/:id | src/modules/documents/documents.controller.ts:60 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/documents/admin/:id/download-url | src/modules/documents/documents.controller.ts:67 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/documents/admin/:id/review | src/modules/documents/documents.controller.ts:74 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/documents/:id/upload-url | src/modules/documents/documents.controller.ts:85 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/documents/:id/upload-complete | src/modules/documents/documents.controller.ts:96 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/documents/:id/download-url | src/modules/documents/documents.controller.ts:107 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| PATCH | /api/documents/:id | src/modules/documents/documents.controller.ts:114 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| DELETE | /api/documents/admin/:id | src/modules/documents/documents.controller.ts:125 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/dropdowns | src/modules/dropdowns/dropdowns.controller.ts:15 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/dropdowns/admin | src/modules/dropdowns/dropdowns.controller.ts:23 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/dropdowns/admin/:name | src/modules/dropdowns/dropdowns.controller.ts:32 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/dropdowns/:name | src/modules/dropdowns/dropdowns.controller.ts:42 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| PATCH | /api/dropdowns/:name | src/modules/dropdowns/dropdowns.controller.ts:50 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| DELETE | /api/dropdowns/:name | src/modules/dropdowns/dropdowns.controller.ts:58 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/health | src/modules/health/health.controller.ts:15 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/institutions | src/modules/institutions/institutions.controller.ts:26 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/institutions | src/modules/institutions/institutions.controller.ts:36 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/institutions/me | src/modules/institutions/institutions.controller.ts:49 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/institutions/profile/:id | src/modules/institutions/institutions.controller.ts:59 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| PATCH | /api/institutions/me/status | src/modules/institutions/institutions.controller.ts:67 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| PATCH | /api/institutions/admin/:id/status | src/modules/institutions/institutions.controller.ts:77 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/institutions/:id | src/modules/institutions/institutions.controller.ts:87 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| PATCH | /api/institutions/:id | src/modules/institutions/institutions.controller.ts:97 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| DELETE | /api/institutions/:id | src/modules/institutions/institutions.controller.ts:111 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/instructors | src/modules/instructors/instructors.controller.ts:33 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/instructors | src/modules/instructors/instructors.controller.ts:43 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/instructors/me | src/modules/instructors/instructors.controller.ts:56 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/instructors/me/dashboard-summary | src/modules/instructors/instructors.controller.ts:64 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/instructors/directory | src/modules/instructors/instructors.controller.ts:75 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| PATCH | /api/instructors/me/status | src/modules/instructors/instructors.controller.ts:83 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/instructors/profile/:id | src/modules/instructors/instructors.controller.ts:93 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/instructors/:id | src/modules/instructors/instructors.controller.ts:101 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| PATCH | /api/instructors/:id | src/modules/instructors/instructors.controller.ts:110 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| PATCH | /api/instructors/admin/:id | src/modules/instructors/instructors.controller.ts:124 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| DELETE | /api/instructors/:id | src/modules/instructors/instructors.controller.ts:134 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/jobs | src/modules/jobs/jobs.controller.ts:23 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/jobs | src/modules/jobs/jobs.controller.ts:33 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/jobs/mine | src/modules/jobs/jobs.controller.ts:43 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/jobs/mine/:id | src/modules/jobs/jobs.controller.ts:53 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/jobs/accessible/:id | src/modules/jobs/jobs.controller.ts:61 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/jobs/:id | src/modules/jobs/jobs.controller.ts:69 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/jobs/:id | src/modules/jobs/jobs.controller.ts:79 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/jobs/admin/all | src/modules/jobs/jobs.controller.ts:80 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/jobs/institution/:institutionId | src/modules/jobs/jobs.controller.ts:93 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| PATCH | /api/jobs/:id | src/modules/jobs/jobs.controller.ts:102 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| DELETE | /api/jobs/:id | src/modules/jobs/jobs.controller.ts:112 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/matching/jobs/recommended | src/modules/matching/matching.controller.ts:21 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/matching/jobs/:jobId/applications | src/modules/matching/matching.controller.ts:37 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/matching/jobs/:jobId/instructors | src/modules/matching/matching.controller.ts:58 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/matching/jobs/:jobId/score | src/modules/matching/matching.controller.ts:78 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/notifications | src/modules/notifications/notifications.controller.ts:16 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/notifications/unread-count | src/modules/notifications/notifications.controller.ts:24 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/notifications/read-all | src/modules/notifications/notifications.controller.ts:31 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/notifications/preferences | src/modules/notifications/notifications.controller.ts:39 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| PATCH | /api/notifications/preferences | src/modules/notifications/notifications.controller.ts:46 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/notifications/:id/read | src/modules/notifications/notifications.controller.ts:53 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/payments/payout-account/balance | src/modules/payments/payments.controller.ts:55 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/payments/payout-account/instant-payout | src/modules/payments/payments.controller.ts:63 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/payments/payout-account | src/modules/payments/payments.controller.ts:71 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/payments/payout-account/session | src/modules/payments/payments.controller.ts:79 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/payments/payout-account/onboarding-link | src/modules/payments/payments.controller.ts:88 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/payments/payout-account/dashboard-link | src/modules/payments/payments.controller.ts:97 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/payments/payout-accounts/instructor/:instructorId | src/modules/payments/payments.controller.ts:106 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/payments/webhooks/stripe | src/modules/payments/payments.controller.ts:124 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/invoices | src/modules/payments/payments.controller.ts:146 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/invoices/me | src/modules/payments/payments.controller.ts:154 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/invoices | src/modules/payments/payments.controller.ts:162 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/invoices/job/:jobId | src/modules/payments/payments.controller.ts:170 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/invoices/:id | src/modules/payments/payments.controller.ts:182 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/invoices/:id/payment-session | src/modules/payments/payments.controller.ts:189 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/invoices/:id/sync | src/modules/payments/payments.controller.ts:201 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/invoices/:id/send | src/modules/payments/payments.controller.ts:209 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/invoices/:id/void | src/modules/payments/payments.controller.ts:218 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/invoices/:id/refund | src/modules/payments/payments.controller.ts:227 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/auth/phone/otp/send | src/modules/phone-verification/phone-verification.controller.ts:15 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/auth/phone/otp/verify | src/modules/phone-verification/phone-verification.controller.ts:23 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/reviews | src/modules/reviews/reviews.controller.ts:26 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/reviews/me | src/modules/reviews/reviews.controller.ts:34 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/reviews/instructor/:instructorId | src/modules/reviews/reviews.controller.ts:41 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/reviews/institution/:institutionId | src/modules/reviews/reviews.controller.ts:51 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| DELETE | /api/reviews/:id | src/modules/reviews/reviews.controller.ts:61 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/institutions/me/signatory-approval | src/modules/signatory-approvals/signatory-approvals.controller.ts:29 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/institutions/me/signatory-approval | src/modules/signatory-approvals/signatory-approvals.controller.ts:37 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/signatory-approvals/token/:token | src/modules/signatory-approvals/signatory-approvals.controller.ts:54 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/signatory-approvals/token/:token/approve | src/modules/signatory-approvals/signatory-approvals.controller.ts:62 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/signatory-approvals/token/:token/decline | src/modules/signatory-approvals/signatory-approvals.controller.ts:79 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/signatory-approvals | src/modules/signatory-approvals/signatory-approvals.controller.ts:95 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/signatory-approvals/:id/override-approve | src/modules/signatory-approvals/signatory-approvals.controller.ts:109 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/auth/2fa/setup | src/modules/two-factor/two-factor.controller.ts:17 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/auth/2fa/enable | src/modules/two-factor/two-factor.controller.ts:24 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/auth/2fa/status | src/modules/two-factor/two-factor.controller.ts:32 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/auth/2fa/disable | src/modules/two-factor/two-factor.controller.ts:39 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/auth/2fa/admin/:userId/disable | src/modules/two-factor/two-factor.controller.ts:47 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/auth/2fa/recovery-codes | src/modules/two-factor/two-factor.controller.ts:56 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/users/me/profile-image/upload-url | src/modules/users/users.controller.ts:35 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/users/me/profile-image/upload-complete | src/modules/users/users.controller.ts:43 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/users/me/profile-image | src/modules/users/users.controller.ts:54 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| POST | /api/users/admin | src/modules/users/users.controller.ts:62 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/users | src/modules/users/users.controller.ts:70 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/users/me/workspace-status | src/modules/users/users.controller.ts:83 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/users/me | src/modules/users/users.controller.ts:91 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| GET | /api/users/:id | src/modules/users/users.controller.ts:99 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| PATCH | /api/users/me | src/modules/users/users.controller.ts:109 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| PATCH | /api/users/admin/:id | src/modules/users/users.controller.ts:118 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |
| DELETE | /api/users/admin/:id | src/modules/users/users.controller.ts:128 | Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO | NOT TESTED — no disposable backend/DB |


## Reproduction and evidence handling

- Existing commands and outcomes are in the first table. The backend npm lint script includes --fix; the audit intentionally used a direct non-fixing eslint command.
- The isolated build helper uses installed dependencies and copies only source/config/assets, never .env. Its temporary copies have been removed after collection. Re-running it recreates them and requires cleanup because the original TypeScript project includes nested source files.
- http-smoke.cjs requires the isolated web build and local-runtime.cjs fixture server, with ports 4317/4320 bound only to 127.0.0.1. These processes were stopped after collection.
- verify-findings.cjs can be inspected without executing. It uses generated secrets, example.test identities, mocked persistence/providers and small bounded inputs. It changes no application/database records.
- Dependency audit failure logs are named *-dependencies.json but contain command error output, not a valid successful vulnerability report. Do not interpret them as an empty vulnerability list.
- Evidence files may contain synthetic test emails and local source paths. Credential values are not included. Preservation and cleanup results are recorded separately.

## Additional framework and socket entry points

These are outside the controller-method count. Swagger setup in backend/src/main.ts registers /api/docs plus its UI assets, /api/docs-json and /api/docs-yaml; no runtime request was made. Their existence alone is not classified as a vulnerability. NextAuth internal endpoints are served by the two catch-all route files listed above. Socket namespace /conversations handles authenticated connection/disconnect, inbound typing/read, and outbound message/read/typing/auth-expired events; actual live socket behavior is NOT TESTED. The bounded onRead method probe is A12.

The following exported declarations were found in top-level use-server modules. This is a source inventory, not a live Next action-ID map; inline actions and generated Auth.js handlers are additional framework behavior. Each actual authenticated browser submission remains NOT TESTED.

| App | Export | Source line | Execution |
| --- | --- | --- | --- |
| web | saveOnboardingAction | app/(app)/onboarding/actions.ts:10 | NOT TESTED — no browser/authenticated backend |
| web | saveOnboardingStep | app/(app)/onboarding/actions.ts:14 | NOT TESTED — no browser/authenticated backend |
| web | uploadOnboardingDocument | app/(app)/onboarding/actions.ts:18 | NOT TESTED — no browser/authenticated backend |
| web | downloadOnboardingDocument | app/(app)/onboarding/actions.ts:22 | NOT TESTED — no browser/authenticated backend |
| web | requestPasswordResetAction | app/(auth)/forgot-password/actions.ts:5 | NOT TESTED — no browser/authenticated backend |
| web | confirmPasswordResetAction | app/(auth)/forgot-password/actions.ts:9 | NOT TESTED — no browser/authenticated backend |
| web | loginAction | app/(auth)/login/actions.ts:12 | NOT TESTED — no browser/authenticated backend |
| web | googleLoginAction | app/(auth)/login/actions.ts:16 | NOT TESTED — no browser/authenticated backend |
| web | microsoftLoginAction | app/(auth)/login/actions.ts:20 | NOT TESTED — no browser/authenticated backend |
| web | verifyLoginEmail | app/(auth)/login/actions.ts:24 | NOT TESTED — no browser/authenticated backend |
| web | verifyLoginTwoFactor | app/(auth)/login/actions.ts:28 | NOT TESTED — no browser/authenticated backend |
| web | resendLoginVerification | app/(auth)/login/actions.ts:32 | NOT TESTED — no browser/authenticated backend |
| web | signupAction | app/(auth)/signup/actions.ts:11 | NOT TESTED — no browser/authenticated backend |
| web | googleSignupAction | app/(auth)/signup/actions.ts:15 | NOT TESTED — no browser/authenticated backend |
| web | microsoftSignupAction | app/(auth)/signup/actions.ts:19 | NOT TESTED — no browser/authenticated backend |
| web | verifySignupEmail | app/(auth)/signup/actions.ts:23 | NOT TESTED — no browser/authenticated backend |
| web | resendSignupVerification | app/(auth)/signup/actions.ts:27 | NOT TESTED — no browser/authenticated backend |
| web | createApplicationAction | features/applications/actions.ts:12 | NOT TESTED — no browser/authenticated backend |
| web | updateApplicationStatusAction | features/applications/actions.ts:45 | NOT TESTED — no browser/authenticated backend |
| web | loginWithEmailAction | features/auth/actions.ts:185 | NOT TESTED — no browser/authenticated backend |
| web | verifyTwoFactorLoginAction | features/auth/actions.ts:235 | NOT TESTED — no browser/authenticated backend |
| web | signupWithEmailAction | features/auth/actions.ts:259 | NOT TESTED — no browser/authenticated backend |
| web | forgotPasswordAction | features/auth/actions.ts:326 | NOT TESTED — no browser/authenticated backend |
| web | resetPasswordAction | features/auth/actions.ts:343 | NOT TESTED — no browser/authenticated backend |
| web | verifyEmailAction | features/auth/actions.ts:371 | NOT TESTED — no browser/authenticated backend |
| web | verifyEmailSessionAction | features/auth/actions.ts:399 | NOT TESTED — no browser/authenticated backend |
| web | resendEmailVerificationAction | features/auth/actions.ts:434 | NOT TESTED — no browser/authenticated backend |
| web | refreshApplicationStatusAction | features/auth/actions.ts:456 | NOT TESTED — no browser/authenticated backend |
| web | signInWithGoogleAction | features/auth/actions.ts:496 | NOT TESTED — no browser/authenticated backend |
| web | signInWithMicrosoftAction | features/auth/actions.ts:500 | NOT TESTED — no browser/authenticated backend |
| web | sendPhoneOtpAction | features/auth/phone-actions.ts:24 | NOT TESTED — no browser/authenticated backend |
| web | verifyPhoneOtpAction | features/auth/phone-actions.ts:49 | NOT TESTED — no browser/authenticated backend |
| web | getTwoFactorStatusAction | features/auth/two-factor-actions.ts:90 | NOT TESTED — no browser/authenticated backend |
| web | startTwoFactorSetupAction | features/auth/two-factor-actions.ts:98 | NOT TESTED — no browser/authenticated backend |
| web | enableTwoFactorAction | features/auth/two-factor-actions.ts:106 | NOT TESTED — no browser/authenticated backend |
| web | disableTwoFactorAction | features/auth/two-factor-actions.ts:125 | NOT TESTED — no browser/authenticated backend |
| web | regenerateTwoFactorRecoveryCodesAction | features/auth/two-factor-actions.ts:144 | NOT TESTED — no browser/authenticated backend |
| web | updateBookingStatusAction | features/bookings/actions.ts:17 | NOT TESTED — no browser/authenticated backend |
| web | createBookingReviewAction | features/bookings/actions.ts:41 | NOT TESTED — no browser/authenticated backend |
| web | registerInterestAction | features/contact/actions.ts:62 | NOT TESTED — no browser/authenticated backend |
| web | foundingInterestAction | features/contact/actions.ts:99 | NOT TESTED — no browser/authenticated backend |
| web | saveWaitlistDetailsAction | features/contact/actions.ts:159 | NOT TESTED — no browser/authenticated backend |
| web | startConversationAction | features/conversations/actions.ts:11 | NOT TESTED — no browser/authenticated backend |
| web | openConversationForApplicationAction | features/conversations/actions.ts:25 | NOT TESTED — no browser/authenticated backend |
| web | openConversationForBookingAction | features/conversations/actions.ts:37 | NOT TESTED — no browser/authenticated backend |
| web | sendMessageAction | features/conversations/actions.ts:46 | NOT TESTED — no browser/authenticated backend |
| web | markConversationReadAction | features/conversations/actions.ts:64 | NOT TESTED — no browser/authenticated backend |
| web | attachmentDownloadUrlAction | features/conversations/actions.ts:73 | NOT TESTED — no browser/authenticated backend |
| web | createInvitationAction | features/invitations/actions.ts:19 | NOT TESTED — no browser/authenticated backend |
| web | decideInvitationAction | features/invitations/actions.ts:66 | NOT TESTED — no browser/authenticated backend |
| web | createJobAction | features/jobs/actions.ts:13 | NOT TESTED — no browser/authenticated backend |
| web | updateJobAction | features/jobs/actions.ts:56 | NOT TESTED — no browser/authenticated backend |
| web | deleteJobAction | features/jobs/actions.ts:102 | NOT TESTED — no browser/authenticated backend |
| web | markNotificationReadAction | features/notifications/actions.ts:11 | NOT TESTED — no browser/authenticated backend |
| web | markAllNotificationsReadAction | features/notifications/actions.ts:21 | NOT TESTED — no browser/authenticated backend |
| web | updateNotificationPreferencesAction | features/notifications/actions.ts:30 | NOT TESTED — no browser/authenticated backend |
| web | getOnboardingProfileSnapshot | features/onboarding/actions.ts:503 | NOT TESTED — no browser/authenticated backend |
| web | uploadOnboardingDocumentAction | features/onboarding/actions.ts:729 | NOT TESTED — no browser/authenticated backend |
| web | downloadOnboardingDocumentAction | features/onboarding/actions.ts:764 | NOT TESTED — no browser/authenticated backend |
| web | saveOnboardingStepAction | features/onboarding/actions.ts:800 | NOT TESTED — no browser/authenticated backend |
| web | submitOnboardingAction | features/onboarding/actions.ts:1214 | NOT TESTED — no browser/authenticated backend |
| web | createPayoutSessionAction | features/payments/actions.ts:16 | NOT TESTED — no browser/authenticated backend |
| web | createInvoicePaymentSessionAction | features/payments/actions.ts:31 | NOT TESTED — no browser/authenticated backend |
| web | syncInvoiceAction | features/payments/actions.ts:55 | NOT TESTED — no browser/authenticated backend |
| web | instantPayoutAction | features/payments/actions.ts:70 | NOT TESTED — no browser/authenticated backend |
| web | createInvoiceAction | features/payments/actions.ts:83 | NOT TESTED — no browser/authenticated backend |
| web | resendInvoiceAction | features/payments/actions.ts:113 | NOT TESTED — no browser/authenticated backend |
| web | voidInvoiceAction | features/payments/actions.ts:117 | NOT TESTED — no browser/authenticated backend |
| web | refundInvoiceAction | features/payments/actions.ts:121 | NOT TESTED — no browser/authenticated backend |
| web | uploadSettingsProfileImageAction | features/settings/actions.ts:224 | NOT TESTED — no browser/authenticated backend |
| web | updateSettingsAction | features/settings/actions.ts:284 | NOT TESTED — no browser/authenticated backend |
| web | updateTeacherProfileAction | features/teachers/actions.ts:15 | NOT TESTED — no browser/authenticated backend |
| admin | logoutAction | app/actions/auth.ts:5 | NOT TESTED — no browser/authenticated backend |
